const { expect } = require("chai");
const { ethers } = require("hardhat");

const tokens = (n) => ethers.parseUnits(n.toString(), "ether");

describe("ETHDaddy", () => {
  let ethDaddy;
  let deployer, user;

  const NAME = "ETH Daddy";
  const SYMBOL = "ETHD";

  beforeEach(async () => {
    [deployer, user] = await ethers.getSigners();

    const ETHDaddy = await ethers.getContractFactory("ETHDaddy");
    ethDaddy = await ETHDaddy.deploy(NAME, SYMBOL);
    await ethDaddy.waitForDeployment();

    // seed one listing (deployer has LISTER_ROLE)
    await (await ethDaddy.list("jack.eth", tokens(10))).wait();
  });

  describe("Deployment", () => {
    it("sets name & symbol", async () => {
      expect(await ethDaddy.name()).to.equal(NAME);
      expect(await ethDaddy.symbol()).to.equal(SYMBOL);
    });

    it("sets owner and treasury to deployer", async () => {
      expect(await ethDaddy.owner()).to.equal(deployer.address);
      expect(await ethDaddy.treasury()).to.equal(deployer.address);
    });

    it("grants DEFAULT_ADMIN_ROLE and LISTER_ROLE to deployer", async () => {
      const ADMIN = await ethDaddy.DEFAULT_ADMIN_ROLE();
      const LISTER = await ethDaddy.LISTER_ROLE();
      expect(await ethDaddy.hasRole(ADMIN, deployer.address)).to.equal(true);
      expect(await ethDaddy.hasRole(LISTER, deployer.address)).to.equal(true);
    });

    it("initial supplies", async () => {
      expect(await ethDaddy.maxSupply()).to.equal(1);
      expect(await ethDaddy.totalSupply()).to.equal(0);
    });
  });

  describe("Listing", () => {
    it("stores domain in lowercase and emits DomainListed", async () => {
      await expect(ethDaddy.list("John.ETH", tokens(2.5)))
        .to.emit(ethDaddy, "DomainListed")
        .withArgs(2, "john.eth", tokens(2.5), deployer.address);

      const d = await ethDaddy.getDomain(2);
      expect(d.name).to.equal("john.eth");
      expect(d.cost).to.equal(tokens(2.5));
      expect(d.isOwned).to.equal(false);
      expect(d.lister).to.equal(deployer.address);
    });

    it("rejects duplicate labels case-insensitively", async () => {
      await expect(ethDaddy.list("JACK.ETH", tokens(1))).to.be.revertedWith(
        "Name already exists"
      );
    });

    it("non-lister cannot list until granted LISTER_ROLE", async () => {
      await expect(
        ethDaddy.connect(user).list("user.eth", tokens(1))
      ).to.be.reverted; // AccessControl revert string varies

      const LISTER = await ethDaddy.LISTER_ROLE();
      await (await ethDaddy.grantRole(LISTER, user.address)).wait();

      await expect(ethDaddy.connect(user).list("user.eth", tokens(1)))
        .to.emit(ethDaddy, "DomainListed")
        .withArgs(2, "user.eth", tokens(1), user.address);
    });
  });

  describe("Editing & Delisting", () => {
    it("only lister or admin can set price", async () => {
      await expect(
        ethDaddy.connect(user).setPrice(1, tokens(12))
      ).to.be.revertedWith("Not authorized");

      await expect(ethDaddy.setPrice(1, tokens(12)))
        .to.emit(ethDaddy, "DomainPriceUpdated")
        .withArgs(1, tokens(10), tokens(12), deployer.address);

      const d = await ethDaddy.getDomain(1);
      expect(d.cost).to.equal(tokens(12));
    });

    it("only lister or admin can delist; clears label index", async () => {
      await expect(ethDaddy.connect(user).delist(1)).to.be.revertedWith(
        "Not authorized"
      );

      const name = (await ethDaddy.getDomain(1)).name;
      const label = ethers.keccak256(ethers.toUtf8Bytes(name));

      await expect(ethDaddy.delist(1))
        .to.emit(ethDaddy, "DomainDelisted")
        .withArgs(1, deployer.address);

      expect(await ethDaddy.idByLabel(label)).to.equal(0);

      const d = await ethDaddy.getDomain(1);
      expect(d.name).to.equal("");
      expect(d.cost).to.equal(0n);
      expect(d.isOwned).to.equal(false);
      expect(d.lister).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Pausable", () => {
    it("blocks actions when paused", async () => {
      await (await ethDaddy.pause(true)).wait();

      await expect(ethDaddy.list("pause.eth", tokens(1))).to.be.revertedWith(
        "Pausable: paused"
      );
      await expect(
        ethDaddy.setPrice(1, tokens(11))
      ).to.be.revertedWith("Pausable: paused");
      await expect(ethDaddy.delist(1)).to.be.revertedWith("Pausable: paused");
      await expect(
        ethDaddy.connect(user).mint(1, { value: tokens(10) })
      ).to.be.revertedWith("Pausable: paused");

      await (await ethDaddy.pause(false)).wait();
      await expect(ethDaddy.list("after.eth", tokens(1))).to.emit(
        ethDaddy,
        "DomainListed"
      );
    });
  });

  describe("Minting", () => {
    const ID = 1;
    const AMOUNT = tokens(10);

    it("mints, marks owned, increments supply, forwards funds to treasury, keeps contract balance 0", async () => {
      const treasury = await ethDaddy.treasury();
      const before = await ethers.provider.getBalance(treasury);

      await expect(ethDaddy.connect(user).mint(ID, { value: AMOUNT }))
        .to.emit(ethDaddy, "DomainMinted")
        .withArgs(ID, user.address, AMOUNT);

      expect(await ethDaddy.ownerOf(ID)).to.equal(user.address);
      const d = await ethDaddy.getDomain(ID);
      expect(d.isOwned).to.equal(true);
      expect(await ethDaddy.totalSupply()).to.equal(1);

      const after = await ethers.provider.getBalance(treasury);
      expect(after - before).to.equal(AMOUNT);

      expect(await ethDaddy.getBalance()).to.equal(0);
    });

    it("reverts on insufficient payment", async () => {
      await expect(
        ethDaddy.connect(user).mint(ID, { value: tokens(9.99) })
      ).to.be.revertedWith("Insufficient payment");
    });
  });

  describe("Metadata / BaseURI", () => {
    it("returns tokenURI using base + tokenId", async () => {
      await (await ethDaddy.setBaseURI("ipfs://bafy/")).wait();
      await (await ethDaddy.connect(user).mint(1, { value: tokens(10) })).wait();
      expect(await ethDaddy.tokenURI(1)).to.equal("ipfs://bafy/1");
    });
  });

  describe("Withdraw", () => {
    it("owner can withdraw (zero balance path) and emits event", async () => {
      await expect(ethDaddy.withdraw())
        .to.emit(ethDaddy, "Withdraw")
        .withArgs(await ethDaddy.treasury(), 0n);
    });

    it("non-owner cannot withdraw", async () => {
      await expect(ethDaddy.connect(user).withdraw()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });
});
