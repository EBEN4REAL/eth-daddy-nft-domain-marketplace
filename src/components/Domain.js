import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import {
  Card,
  Tag,
  Space,
  Typography,
  Popconfirm,
  Modal,
  InputNumber,
  Tooltip,
  message,
  Divider,
} from "antd";
import {
  ShoppingCartOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  CrownOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import "./Domain.css";

import ActionButton from "./ui/ActionButton/ActionButton";

const { Text, Title } = Typography;

const ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function shorten(addr) {
  if (!addr) return "";
  try {
    const a = ethers.getAddress(addr);
    return `${a.slice(0, 6)}...${a.slice(-4)}`;
  } catch {
    return addr;
  }
}

const Domain = ({ id, domain, ethDaddy, provider, account }) => {
  const [owner, setOwner] = useState(null);
  const [pending, setPending] = useState(false);
  const [, setIsAdmin] = useState(false);
  const [, setIsLister] = useState(false);

  // Set Price modal
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceInput, setPriceInput] = useState(0);

  const priceEth = useMemo(
    () => (domain?.cost ? ethers.formatEther(domain.cost) : "0"),
    [domain?.cost]
  );

  const sold = domain?.isOwned || !!owner;

  // ---- Data fetchers ----
  const refreshOwner = async () => {
    if (!ethDaddy) return;
    try {
      if (domain.isOwned) {
        const o = await ethDaddy.ownerOf(id);
        setOwner(o);
      } else {
        setOwner(null);
      }
    } catch {
      setOwner(null);
    }
  };

  const refreshAccess = async () => {
    if (!ethDaddy || !account) return;
    try {
      const admin = await ethDaddy.hasRole(ADMIN_ROLE, account);
      setIsAdmin(admin);

      let lister = false;
      try {
        if (domain.lister) {
          lister =
            ethers.getAddress(domain.lister) === ethers.getAddress(account);
        }
      } catch {}
      setIsLister(lister);
    } catch {
      setIsAdmin(false);
      setIsLister(false);
    }
  };

  useEffect(() => {
    refreshOwner();
    refreshAccess();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ethDaddy, id, domain.isOwned, domain.lister, account]); // eslint-ok

  // ---- Handlers ----
  const buyHandler = async () => {
    try {
      setPending(true);
      const signer = await provider.getSigner();
      const tx = await ethDaddy.connect(signer).mint(id, { value: domain.cost });
      message.loading({ content: "Minting…", key: `buy-${id}` });
      await tx.wait();
      message.success({ content: "Minted successfully!", key: `buy-${id}` });
      await refreshOwner();
    } catch (e) {
      console.error(e);
      message.error(e.shortMessage || e.message || "Mint failed");
    } finally {
      setPending(false);
    }
  };

  const openSetPrice = () => {
    setPriceInput(Number(priceEth) || 0);
    setPriceOpen(true);
  };

  const submitSetPrice = async () => {
    try {
      if (priceInput <= 0) {
        message.warning("Price must be greater than 0");
        return;
      }
      setPending(true);
      const wei = ethers.parseEther(String(priceInput));
      const signer = await provider.getSigner();
      const tx = await ethDaddy.connect(signer).setPrice(id, wei);
      message.loading({ content: "Updating price…", key: `price-${id}` });
      await tx.wait();
      message.success({ content: "Price updated", key: `price-${id}` });
      setPriceOpen(false);
    } catch (e) {
      console.error(e);
      message.error(e.shortMessage || e.message || "Update failed");
    } finally {
      setPending(false);
    }
  };

  const delist = async () => {
    try {
      setPending(true);
      const signer = await provider.getSigner();
      const tx = await ethDaddy.connect(signer).delist(id);
      message.loading({ content: "Delisting…", key: `delist-${id}` });
      await tx.wait();
      message.success({ content: "Delisted", key: `delist-${id}` });
    } catch (e) {
      console.error(e);
      message.error(e.shortMessage || e.message || "Delist failed");
    } finally {
      setPending(false);
    }
  };

  // ---- UI ----
  const title = (
    <Space align="center" size="small">
      <Title level={4} style={{ margin: 0 }}>
        {domain?.name}
      </Title>
      {sold ? (
        <Tag color="default">Owned</Tag>
      ) : (
        <Tag color="green">Available</Tag>
      )}
    </Space>
  );

  const listerLine = domain?.lister && (
    <Space size="small">
      <CrownOutlined />
      <Text type="secondary">
        Lister: <Text copyable>{shorten(domain.lister)}</Text>
      </Text>
    </Space>
  );

  const ownerLine = sold && (
    <Space size="small">
      <UserOutlined />
      <Text type="secondary">
        Owner: <Text copyable>{shorten(owner)}</Text>
      </Text>
    </Space>
  );

  const priceBlock = !sold ? (
    <Space direction="vertical" size={0}>
      <Text type="secondary">Price</Text>
      <Title level={3} style={{ margin: 0 }}>
        <Space>
          <DollarOutlined />
          {priceEth} ETH
        </Space>
      </Title>
    </Space>
  ) : null;

  // keep it open for admins/listers if you want: const canEdit = (isAdmin || isLister) && !sold;
  const canEdit = !sold;

  return (
    <>
      <Card
        size="default"
        title={title}
        loading={!domain}
        style={{ width: 360 }}
        className="domain-card"
        actions={[
          !sold ? (
            <Tooltip title="Buy this domain" key="buy-tt">
              <ActionButton
                icon={<ShoppingCartOutlined />}
                loading={pending}
                disabled={pending}
                onClick={buyHandler}
              >
                Buy
              </ActionButton>
            </Tooltip>
          ) : (
            <Text key="sold" type="secondary">
              Already owned
            </Text>
          ),
          canEdit ? (
            <Tooltip title="Set listing price" key="edit-tt">
              <ActionButton
                icon={<EditOutlined />}
                disabled={pending}
                onClick={openSetPrice}
              >
                Set Price
              </ActionButton>
            </Tooltip>
          ) : (
            <span key="spacer" />
          ),
          canEdit ? (
            <Popconfirm
              key="del-tt"
              title={`Delist ${domain?.name}?`}
              okText="Delist"
              okButtonProps={{ danger: true, loading: pending }}
              onConfirm={delist}
            >
              <ActionButton icon={<DeleteOutlined />} danger disabled={pending}>
                Delist
              </ActionButton>
            </Popconfirm>
          ) : (
            <span key="spacer2" />
          ),
        ]}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          {priceBlock}
          {priceBlock && <Divider style={{ margin: "8px 0" }} />}

          {ownerLine}
          {listerLine}
        </Space>
      </Card>

      {/* Set Price Modal */}
      <Modal
        title={`Set Price – ${domain?.name}`}
        open={priceOpen}
        okText="Update Price"
        confirmLoading={pending}
        onOk={submitSetPrice}
        onCancel={() => setPriceOpen(false)}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text type="secondary">New price (in ETH)</Text>
          <InputNumber
            min={0}
            step={0.001}
            precision={6}
            style={{ width: "100%" }}
            value={priceInput}
            onChange={(v) => setPriceInput(Number(v || 0))}
            stringMode
            placeholder="e.g. 2.5"
          />
          <Text type="secondary">
            Current: <b>{priceEth} ETH</b>
          </Text>
        </Space>
      </Modal>
    </>
  );
};

export default Domain;
