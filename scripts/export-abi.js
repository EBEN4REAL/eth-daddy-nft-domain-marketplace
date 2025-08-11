// scripts/export-abi.js
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function run() {
  const artifact = await hre.artifacts.readArtifact("ETHDaddy");
  const outDir = path.join(__dirname, "../src/abi_test");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "ETHDaddy.json"),
    JSON.stringify(artifact.abi, null, 2)
  );
  console.log("ABI written to /src/abi_test/ETHDaddy.json");
}
run();
