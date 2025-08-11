const hre = require("hardhat");
const { parseUnits } = require("ethers");

const tokens = (n) => parseUnits(n.toString(), "ether");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const ETHDaddy = await hre.ethers.getContractFactory("ETHDaddy");
  const ethDaddy = await ETHDaddy.deploy("ETH Daddy", "ETHD");
  await ethDaddy.waitForDeployment();

  console.log(`Deployed Domain Contract at: ${ethDaddy.target}\n`);

  const names = ["jack.eth","john.eth","henry.eth","cobalt.eth","oxygen.eth","carbon.eth"];
  const costs = [tokens(10), tokens(25), tokens(15), tokens(2.5), tokens(3), tokens(1)];

  for (let i = 0; i < names.length; i++) {
    const tx = await ethDaddy.connect(deployer).list(names[i], costs[i]);
    await tx.wait();
    console.log(`Listed Domain ${i + 1}: ${names[i]}`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
