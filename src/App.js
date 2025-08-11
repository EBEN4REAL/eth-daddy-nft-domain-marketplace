import { useEffect, useState } from "react";
import { Contract, BrowserProvider, getAddress } from "ethers";

// Components
import Navigation from "./components/Navigation";
import Search from "./components/Search";
import Domain from "./components/Domain";

// ABIs
import ETHDaddyArtifact from "./abis/ETHDaddy.json";

import config from "./config.json";

function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);

  const [ethDaddy, setETHDaddy] = useState(null);
  const [domains, setDomains] = useState([]);

  // -- Reusable loader for domains
  const refreshDomains = async (contract) => {
    if (!contract) return;
    // Ensure function exists (helps with mismatched ABI)
    try {
      contract.interface.getFunction("maxSupply");
      contract.interface.getFunction("getDomain");
    } catch {
      console.warn("ABI mismatch: maxSupply/getDomain not found.");
      return;
    }

    const maxSupplyBig = await contract.maxSupply();
    const maxSupply = Number(maxSupplyBig);

    const items = [];
    for (let i = 1; i <= maxSupply; i++) {
      const d = await contract.getDomain(i);
      items.push(d);
    }
    setDomains(items);
  };

  const loadBlockchainData = async () => {
    // 1) Connect provider
    const provider = new BrowserProvider(window.ethereum);
    setProvider(provider);

    // Ask for accounts
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

    // 3) Ensure code exists at address
    const code = await provider.getCode(address);
    if (code === "0x") {
      throw new Error(
        `No contract found at ${address} on chain ${chainId}. Check your address & network.`
      );
    }

    // 4) Build contract
    const abi = ETHDaddyArtifact.abi ?? ETHDaddyArtifact;
    const contract = new Contract(address, abi, provider);
    setETHDaddy(contract);

    // 5) Initial load
    await refreshDomains(contract);

    // 6) Wallet + chain listeners
    const onAccountsChanged = (accs) => {
      if (accs?.length) setAccount(getAddress(accs[0]));
      else setAccount(null);
    };
    const onChainChanged = () => {
      // MetaMask recommends a full reload on chain change
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    // Cleanup
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", onChainChanged);
    };
  };

  // Initial bootstrap
  useEffect(() => {
    loadBlockchainData().catch((e) => {
      console.error(e);
      alert(e.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Event listeners: attach when contract is ready
  useEffect(() => {
    if (!ethDaddy) return;

    // Helper to safely refresh on events (debounced a bit to avoid bursts)
    let refreshTimeout = null;
    const scheduleRefresh = () => {
      if (refreshTimeout) return;
      refreshTimeout = setTimeout(async () => {
        refreshTimeout = null;
        try {
          await refreshDomains(ethDaddy);
        } catch (e) {
          console.error("Refresh error:", e);
        }
      }, 150); // small debounce to coalesce rapid events in the same block
    };

    // --- Listeners ---
    const onListed = (id, name, cost, lister, evt) => {
      console.log("DomainListed:", { id: id.toString(), name, cost: cost.toString(), lister, evt });
      scheduleRefresh();
    };
    const onPriceUpdated = (id, oldCost, newCost, editor, evt) => {
      console.log("DomainPriceUpdated:", {
        id: id.toString(),
        oldCost: oldCost.toString(),
        newCost: newCost.toString(),
        editor,
        evt,
      });
      scheduleRefresh();
    };
    const onDelisted = (id, editor, evt) => {
      console.log("DomainDelisted:", { id: id.toString(), editor, evt });
      scheduleRefresh();
    };
    const onMinted = (id, to, cost, evt) => {
      console.log("DomainMinted:", { id: id.toString(), to, cost: cost.toString(), evt });
      scheduleRefresh();
    };

    // Attach
    ethDaddy.on("DomainListed", onListed);
    ethDaddy.on("DomainPriceUpdated", onPriceUpdated);
    ethDaddy.on("DomainDelisted", onDelisted);
    ethDaddy.on("DomainMinted", onMinted);

    // Cleanup on contract change/unmount
    return () => {
      try {
        ethDaddy.off("DomainListed", onListed);
        ethDaddy.off("DomainPriceUpdated", onPriceUpdated);
        ethDaddy.off("DomainDelisted", onDelisted);
        ethDaddy.off("DomainMinted", onMinted);
      } catch {}
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
    };
  }, [ethDaddy]); // reattach when contract instance changes

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
