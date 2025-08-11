// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ETHDaddy is
    ERC721,
    Ownable,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    // ----- Roles -----
    bytes32 public constant LISTER_ROLE = keccak256("LISTER_ROLE");

    // ----- State -----
    uint256 public maxSupply;    // highest id ever listed
    uint256 public totalSupply;  // number minted
    address payable public treasury;

    struct Domain {
        string name;      // stored in lowercase canonical form
        uint256 cost;     // price in wei
        bool isOwned;     // true once minted
        address lister;   // who listed it
    }

    mapping(uint256 => Domain) public domains;      // id => Domain
    mapping(bytes32 => uint256) public idByLabel;    // labelHash => id (0 means none)

    // ----- Events -----
    event DomainListed(uint256 indexed id, string name, uint256 cost, address indexed lister);
    event DomainPriceUpdated(uint256 indexed id, uint256 oldCost, uint256 newCost, address indexed editor);
    event DomainDelisted(uint256 indexed id, address indexed editor);
    event DomainMinted(uint256 indexed id, address indexed to, uint256 cost);
    event Withdraw(address indexed to, uint256 amount);
    event TreasuryUpdated(address indexed newTreasury);
    event PausedState(bool paused);
    event BaseURIUpdated(string newBaseURI);

    // ----- Metadata -----
    string private _baseTokenURI;

    constructor(string memory _name, string memory _symbol)
        ERC721(_name, _symbol)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LISTER_ROLE, msg.sender);
        treasury = payable(msg.sender);
    }

    // ---------------------------
    // Listing / Editing / Delist
    // ---------------------------

    function list(string memory _name, uint256 _cost)
        external
        whenNotPaused
        onlyRole(LISTER_ROLE)
    {
        require(_cost > 0, "Price must be > 0");

        string memory lower = _toLower(_name);
        bytes32 label = keccak256(bytes(lower));
        require(idByLabel[label] == 0, "Name already exists");

        uint256 newId = ++maxSupply;
        idByLabel[label] = newId;

        domains[newId] = Domain({
            name: lower,
            cost: _cost,
            isOwned: false,
            lister: msg.sender
        });

        emit DomainListed(newId, lower, _cost, msg.sender);
    }

    function setPrice(uint256 id, uint256 newCost)
        external
        whenNotPaused
    {
        require(newCost > 0, "Price must be > 0");
        Domain storage d = domains[id];
        require(bytes(d.name).length != 0, "Invalid id");
        require(!d.isOwned, "Already sold");

        // Only original lister or admin can edit
        require(
            msg.sender == d.lister || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );

        uint256 old = d.cost;
        d.cost = newCost;
        emit DomainPriceUpdated(id, old, newCost, msg.sender);
    }

    function delist(uint256 id) external whenNotPaused {
        Domain storage d = domains[id];
        require(bytes(d.name).length != 0, "Invalid id");
        require(!d.isOwned, "Already sold");
        require(
            msg.sender == d.lister || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );

        // clear label index
        bytes32 label = keccak256(bytes(d.name));
        idByLabel[label] = 0;

        delete domains[id]; // leaves gap in ids by design
        emit DomainDelisted(id, msg.sender);
    }

    // --------------
    // Buying / Mint
    // --------------

    function mint(uint256 id)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        require(id != 0 && id <= maxSupply, "Invalid id");
        Domain storage d = domains[id];
        require(bytes(d.name).length != 0, "Not listed");
        require(!d.isOwned, "Already sold");
        require(msg.value >= d.cost, "Insufficient payment");

        d.isOwned = true;
        totalSupply += 1;

        _safeMint(msg.sender, id);
        emit DomainMinted(id, msg.sender, d.cost);

        // Forward funds immediately to treasury (optional: hold & withdraw later)
        (bool ok, ) = treasury.call{value: msg.value}("");
        require(ok, "Treasury transfer failed");
    }

    // --------------
    // Admin / Config
    // --------------

    function setTreasury(address payable _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setBaseURI(string calldata newBase) external onlyOwner {
        _baseTokenURI = newBase;
        emit BaseURIUpdated(newBase);
    }

    function pause(bool p) external onlyOwner {
        if (p) _pause();
        else _unpause();
        emit PausedState(p);
    }

    // Fallback withdraw if contract ever holds ETH (e.g., before this version)
    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        (bool ok, ) = treasury.call{value: bal}("");
        require(ok, "Withdraw failed");
        emit Withdraw(treasury, bal);
    }

    // --------------
    // Views / Utils
    // --------------

    function getDomain(uint256 id) external view returns (Domain memory) {
        return domains[id];
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // ASCII lowercase (A–Z -> a–z). Keep names simple: a–z, 0–9, dot, hyphen, etc.
    function _toLower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 65 && c <= 90) {
                b[i] = bytes1(c + 32);
            }
        }
        return string(b);
    }

    // Required override for AccessControl + ERC721
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}