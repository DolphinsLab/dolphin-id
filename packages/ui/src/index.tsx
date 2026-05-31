import type { ButtonHTMLAttributes } from "react";

export type ConnectButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function ConnectButton({
  children = "Connect Wallet",
  type = "button",
  ...props
}: ConnectButtonProps) {
  return (
    <button type={type} {...props}>
      {children}
    </button>
  );
}
