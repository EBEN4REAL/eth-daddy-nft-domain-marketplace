import { Button } from "antd";
import "./ActionButton.css";

export default function ActionButton({
  children,
  icon,
  onClick,
  loading,
  disabled,
  danger = false,
  block = false,
  size = "middle",
  className = "",
}) {
  return (
    <Button
      icon={icon}
      onClick={onClick}
      loading={loading}
      disabled={disabled}
      block={block}
      size={size}
      className={`action-btn ${danger ? "action-btn--danger" : ""} ${className}`}
    >
      {children}
    </Button>
  );
}
