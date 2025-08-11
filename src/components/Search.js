import React, { useState } from "react";
import { Drawer, message } from "antd";
import { ethers } from "ethers";

const Search = ({ ethDaddy, provider }) => {
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [priceEth, setPriceEth] = useState("");
  const [loading, setLoading] = useState(false);

  const showDrawer = () => setOpen(true);
  const onClose = () => setOpen(false);

  const listDomain = async () => {
    try {
      if (!ethDaddy) return message.error("Contract not available.");
      if (!provider) return message.error("Provider not available.");
      if (!domain.trim()) return message.warning("Please enter a domain.");
      if (!priceEth || Number(priceEth) <= 0)
        return message.warning("Enter a valid price in ETH.");

      setLoading(true);

      const signer = await provider.getSigner();
      const contract = ethDaddy.connect(signer);
      const priceWei = ethers.parseEther(priceEth.toString());
      
      await contract.list.staticCall(domain.trim(), priceWei);

      // If we got here, tx *should* succeed
      const tx = await contract.list(domain.trim(), priceWei);
      message.loading({ content: "Submitting transaction…", key: "tx" });
      await tx.wait();
      message.success({ content: "Domain listed successfully!", key: "tx" });

      setOpen(false);
      setDomain("");
      setPriceEth("");
    } catch (err) {
      console.error(err);
      message.error(err?.shortMessage || err?.message || "Transaction failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <header>
      <h2 className="header__title">It all begins with a domain name.</h2>
      <p className="header__subtitle">You can list your domain here</p>
      <button type="button" className="nav__connect mt-30" onClick={showDrawer}>
        List domain
      </button>

      <Drawer title="List Domain" closable onClose={onClose} open={open}>
        <div>
          <input
            type="text"
            className="app-input"
            placeholder="Enter your domain (e.g., coolname.eth)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
        </div>

        <div className="mt-30">
          <input
            type="number"
            className="app-input"
            placeholder="Enter a cost in ETH"
            value={priceEth}
            onChange={(e) => setPriceEth(e.target.value)}
            min="0"
            step="0.0001"
          />
        </div>

        <button
          type="button"
          className="header__button mt-30 w-100"
          onClick={listDomain}
          disabled={loading}
        >
          {loading ? "Listing..." : "List It"}
        </button>
      </Drawer>
    </header>
  );
};

export default Search;
