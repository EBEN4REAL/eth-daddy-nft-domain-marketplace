// scripts/grant-lister.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners(); // this has DEFAULT_ADMIN_ROLE
  const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // paste from deploy logs
  const TARGET = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"; // your MetaMask account

  const c = await hre.ethers.getContractAt("ETHDaddy", CONTRACT, deployer);
  const LISTER_ROLE = await c.LISTER_ROLE();

  console.log("Deployer:", deployer.address);
  await (await c.grantRole(LISTER_ROLE, TARGET)).wait();
  console.log("Granted LISTER_ROLE to", TARGET);

  console.log("Check:", await c.hasRole(LISTER_ROLE, TARGET));
}
main().catch(e => { console.error(e); process.exit(1); });
