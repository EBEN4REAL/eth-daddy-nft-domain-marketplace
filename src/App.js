import { useEffect, useState } from "react";
import { Contract, BrowserProvider, getAddress } from "ethers";

// Components
import Navigation from "./components/Navigation";
import Search from "./components/Search";
import Domain from "./components/Domain";

// ABIs
import ETHDaddyArtifact from "./abis/ETHDaddy.json"; // artifact with { abi, bytecode, ... }

import config from "./config.json";

function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);

  const [ethDaddy, setETHDaddy] = useState(null);
  const [domains, setDomains] = useState([]);

  const loadBlockchainData = async () => {
    // 1) Connect provider
    const provider = new BrowserProvider(window.ethereum);
    setProvider(provider);

    // Optional: request accounts so MetaMask is connected
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts?.length) setAccount(getAddress(accounts[0]));
    } catch {}

    // 2) Resolve chain and config
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    console.log("Connected chainId:", chainId);

    const netCfg = config[chainId];
    if (!netCfg || !netCfg.ETHDaddy?.address) {
      throw new Error(`No config for chainId ${chainId}. Update config.json.`);
    }

    const address = netCfg.ETHDaddy.address;

    // 3) Make sure there's code at the address on this chain
    const code = await provider.getCode(address);
    if (code === "0x") {
      throw new Error(
        `No contract found at ${address} on chain ${chainId}. Check your address & network.`
      );
    }

    // 4) Build contract with the ABI array (not the whole artifact)
    const abi = ETHDaddyArtifact.abi ?? ETHDaddyArtifact; // support both shapes
    const contract = new Contract(address, abi, provider);
    setETHDaddy(contract);

    // 5) Ensure maxSupply() exists in the ABI
    try {
      contract.interface.getFunction("maxSupply");
    } catch {
      throw new Error(
        "ABI/function mismatch: 'maxSupply()' not found. Does the contract actually expose it?"
      );
    }

    // 6) Read maxSupply and then fetch domains
    const maxSupplyBig = await contract.maxSupply(); // bigint
    const maxSupply = Number(maxSupplyBig);

    const items = [];
    for (let i = 1; i <= maxSupply; i++) {
      const domain = await contract.getDomain(i);
      console.log("domain => 185", domain);
      items.push(domain);
    }
    setDomains(items);

    // 7) Account change listener
    const onAccountsChanged = (accs) => {
      if (accs?.length) setAccount(getAddress(accs[0]));
      else setAccount(null);
    };
    window.ethereum.on("accountsChanged", onAccountsChanged);

    // optional cleanup when component unmounts
    return () =>
      window.ethereum?.removeListener?.("accountsChanged", onAccountsChanged);
  };

  useEffect(() => {
    loadBlockchainData().catch((e) => {
      console.error(e);
      alert(e.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />

      <Search ethDaddy={ethDaddy} provider={provider} />

      <div className="cards__section">
        <h2 className="cards__title">Why you need a domain name.</h2>
        <p className="cards__description">
          Own your custom username, use it across services, and be able to store
          an avatar and other profile data.
        </p>

        <hr />

        <div className="cards">
          {domains.map((domain, index) => (
            <Domain
              key={index}
              id={index + 1}
              domain={domain}
              ethDaddy={ethDaddy}
              provider={provider}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
