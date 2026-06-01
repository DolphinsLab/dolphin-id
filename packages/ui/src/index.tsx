import { useMemo, useState, type ButtonHTMLAttributes, type CSSProperties } from "react";

import {
  useAccounts,
  useConnect,
  useDisconnect,
  useDolphin,
  useSignIn,
  useWallets
} from "@dolphin-id/react";
import type { ChainType, DolphinStateStatus, Wallet } from "@dolphin-id/core";

export type DolphinThemeMode = "light" | "dark";

export interface DolphinTheme {
  readonly mode?: DolphinThemeMode;
  readonly accent?: string;
  readonly background?: string;
  readonly foreground?: string;
  readonly muted?: string;
  readonly border?: string;
  readonly surface?: string;
  readonly danger?: string;
}

export interface ConnectButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick"
> {
  readonly label?: string;
  readonly connectedLabel?: string;
  readonly signingLabel?: string;
  readonly signedInLabel?: string;
  readonly theme?: DolphinThemeMode | DolphinTheme;
  readonly onConnectClick?: () => void;
}

export interface WalletModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly theme?: DolphinThemeMode | DolphinTheme;
  readonly signInAfterConnect?: boolean;
}

export interface AccountDisplayProps {
  readonly theme?: DolphinThemeMode | DolphinTheme;
  readonly showDisconnect?: boolean;
}

export function ConnectButton(props: ConnectButtonProps) {
  const {
    label,
    connectedLabel,
    signingLabel,
    signedInLabel,
    theme,
    onConnectClick,
    type = "button",
    ...buttonProps
  } = props;
  const { state, activeAccount } = useDolphin();
  const [open, setOpen] = useState(false);
  const themeStyles = createDolphinThemeStyles(theme);
  const buttonLabel = getConnectButtonLabel({
    status: state.status,
    ...(activeAccount?.displayAddress || activeAccount?.address
      ? { address: activeAccount.displayAddress ?? activeAccount.address }
      : {}),
    ...(label ? { label } : {}),
    ...(connectedLabel ? { connectedLabel } : {}),
    ...(signingLabel ? { signingLabel } : {}),
    ...(signedInLabel ? { signedInLabel } : {})
  });

  return (
    <>
      <button
        type={type}
        {...buttonProps}
        style={{ ...baseButtonStyle(themeStyles), ...buttonProps.style }}
        onClick={() => {
          onConnectClick?.();
          setOpen(true);
        }}
      >
        {buttonLabel}
      </button>
      <WalletModal open={open} onOpenChange={setOpen} {...(theme ? { theme } : {})} />
    </>
  );
}

export function WalletModal({
  open,
  onOpenChange,
  theme,
  signInAfterConnect = false
}: WalletModalProps) {
  const { wallets, refreshWallets } = useWallets();
  const connect = useConnect();
  const signIn = useSignIn();
  const [pendingWalletId, setPendingWalletId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const themeStyles = createDolphinThemeStyles(theme);
  const groups = useMemo(() => groupWalletsByChain(wallets), [wallets]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="presentation"
      style={overlayStyle}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connect wallet"
        style={modalStyle(themeStyles)}
      >
        <div style={modalHeaderStyle}>
          <strong style={modalTitleStyle}>Connect Wallet</strong>
          <button
            type="button"
            aria-label="Close"
            style={iconButtonStyle(themeStyles)}
            onClick={() => onOpenChange(false)}
          >
            x
          </button>
        </div>

        <div style={walletGroupListStyle}>
          {groups.length === 0 ? (
            <button
              type="button"
              style={walletRowStyle(themeStyles, false)}
              onClick={() => void refreshWallets()}
            >
              Refresh wallets
            </button>
          ) : (
            groups.map((group) => (
              <section key={group.chainType} style={walletGroupStyle}>
                <div style={chainLabelStyle(themeStyles)}>{formatChainLabel(group.chainType)}</div>
                {group.wallets.map((wallet) => {
                  const pending = pendingWalletId === wallet.id;
                  return (
                    <button
                      key={`${wallet.adapterId}:${wallet.id}`}
                      type="button"
                      disabled={!wallet.installed || pending}
                      style={walletRowStyle(themeStyles, !wallet.installed || pending)}
                      onClick={async () => {
                        setPendingWalletId(wallet.id);
                        setError(null);
                        try {
                          await connect({ adapterId: wallet.adapterId, walletId: wallet.id });
                          if (signInAfterConnect) {
                            await signIn();
                          }
                          onOpenChange(false);
                        } catch (caught) {
                          setError(caught instanceof Error ? caught.message : "Connection failed.");
                        } finally {
                          setPendingWalletId(null);
                        }
                      }}
                    >
                      <span style={walletNameStyle}>{wallet.name}</span>
                      <span style={walletStatusStyle(themeStyles)}>
                        {pending ? "Connecting" : wallet.installed ? "Installed" : "Install"}
                      </span>
                    </button>
                  );
                })}
              </section>
            ))
          )}
        </div>

        {error ? <div style={errorStyle(themeStyles)}>{error}</div> : null}
      </div>
    </div>
  );
}

export function AccountDisplay({ theme, showDisconnect = true }: AccountDisplayProps) {
  const { activeAccount } = useAccounts();
  const disconnect = useDisconnect();
  const themeStyles = createDolphinThemeStyles(theme);

  if (!activeAccount) {
    return null;
  }

  return (
    <div style={accountDisplayStyle(themeStyles)}>
      <span style={accountTextStyle}>
        <strong>{formatChainLabel(activeAccount.chain.type)}</strong>
        <span>{shortenAddress(activeAccount.displayAddress ?? activeAccount.address)}</span>
      </span>
      {showDisconnect ? (
        <button
          type="button"
          style={secondaryButtonStyle(themeStyles)}
          onClick={() => disconnect()}
        >
          Disconnect
        </button>
      ) : null}
    </div>
  );
}

export function groupWalletsByChain(wallets: readonly Wallet[]) {
  const groups = new Map<ChainType, Wallet[]>();

  wallets.forEach((wallet) => {
    const chainType = wallet.chains[0] ?? "unknown";
    groups.set(chainType, [...(groups.get(chainType) ?? []), wallet]);
  });

  return [...groups.entries()].map(([chainType, groupWallets]) => ({
    chainType,
    wallets: groupWallets
  }));
}

export function getConnectButtonLabel(input: {
  readonly status: DolphinStateStatus;
  readonly address?: string;
  readonly label?: string;
  readonly connectedLabel?: string;
  readonly signingLabel?: string;
  readonly signedInLabel?: string;
}): string {
  if (input.status === "loading") {
    return input.signingLabel ?? "Connecting...";
  }

  if (input.status === "signed-in") {
    return input.signedInLabel ?? "Signed in";
  }

  if (input.status === "connected") {
    return input.connectedLabel ?? shortenAddress(input.address ?? "");
  }

  return input.label ?? "Connect Wallet";
}

export function shortenAddress(address: string, visible = 4): string {
  if (address.length <= visible * 2 + 3) {
    return address;
  }

  return `${address.slice(0, visible + 2)}...${address.slice(-visible)}`;
}

export function formatChainLabel(chainType: ChainType): string {
  const labels: Readonly<Record<string, string>> = {
    evm: "EVM",
    sui: "Sui",
    solana: "Solana",
    bitcoin: "Bitcoin",
    aptos: "Aptos"
  };

  return labels[chainType] ?? chainType;
}

export function createDolphinThemeStyles(theme: DolphinThemeMode | DolphinTheme = "light") {
  const mode = typeof theme === "string" ? theme : (theme.mode ?? "light");
  const dark = mode === "dark";
  const input = typeof theme === "string" ? {} : theme;

  return {
    mode,
    accent: input.accent ?? (dark ? "#7dd3fc" : "#0f766e"),
    background: input.background ?? (dark ? "#0f172a" : "#ffffff"),
    foreground: input.foreground ?? (dark ? "#f8fafc" : "#111827"),
    muted: input.muted ?? (dark ? "#94a3b8" : "#64748b"),
    border: input.border ?? (dark ? "#334155" : "#d1d5db"),
    surface: input.surface ?? (dark ? "#1e293b" : "#f8fafc"),
    danger: input.danger ?? (dark ? "#fb7185" : "#be123c")
  };
}

type ThemeStyles = ReturnType<typeof createDolphinThemeStyles>;

function baseButtonStyle(theme: ThemeStyles): CSSProperties {
  return {
    minHeight: 40,
    maxWidth: "100%",
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: "0 14px",
    background: theme.accent,
    color: theme.mode === "dark" ? "#082f49" : "#ffffff",
    font: "inherit",
    fontWeight: 650,
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  };
}

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "rgba(15, 23, 42, 0.52)",
  zIndex: 50
};

function modalStyle(theme: ThemeStyles): CSSProperties {
  return {
    width: "min(420px, 100%)",
    maxHeight: "min(620px, calc(100dvh - 32px))",
    overflow: "auto",
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    background: theme.background,
    color: theme.foreground,
    boxShadow: "0 24px 80px rgba(15, 23, 42, 0.28)"
  };
}

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: 16,
  borderBottom: "1px solid currentColor"
};

const modalTitleStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

function iconButtonStyle(theme: ThemeStyles): CSSProperties {
  return {
    width: 32,
    height: 32,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    background: theme.surface,
    color: theme.foreground,
    cursor: "pointer"
  };
}

const walletGroupListStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 16
};

const walletGroupStyle: CSSProperties = {
  display: "grid",
  gap: 8
};

function chainLabelStyle(theme: ThemeStyles): CSSProperties {
  return {
    color: theme.muted,
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase"
  };
}

function walletRowStyle(theme: ThemeStyles, disabled: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    minHeight: 48,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: "0 12px",
    background: theme.surface,
    color: theme.foreground,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.62 : 1,
    textAlign: "left"
  };
}

const walletNameStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontWeight: 650
};

function walletStatusStyle(theme: ThemeStyles): CSSProperties {
  return {
    flex: "0 0 auto",
    color: theme.muted,
    fontSize: 12
  };
}

function errorStyle(theme: ThemeStyles): CSSProperties {
  return {
    margin: "0 16px 16px",
    color: theme.danger,
    fontSize: 13,
    overflowWrap: "anywhere"
  };
}

function accountDisplayStyle(theme: ThemeStyles): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    maxWidth: "100%",
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: 8,
    background: theme.surface,
    color: theme.foreground
  };
}

const accountTextStyle: CSSProperties = {
  display: "grid",
  minWidth: 0,
  gap: 2,
  overflow: "hidden"
};

function secondaryButtonStyle(theme: ThemeStyles): CSSProperties {
  return {
    minHeight: 32,
    border: `1px solid ${theme.border}`,
    borderRadius: 8,
    padding: "0 10px",
    background: theme.background,
    color: theme.foreground,
    cursor: "pointer"
  };
}
