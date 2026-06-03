import { AppShell } from "../../app-shell";
import { ChainSwitch } from "../../product-ui";

export const metadata = {
  title: "Chain Policy | Dolphin ID"
};

const chains = [
  ["EVM", "Enabled for injected wallets and SIWE verification.", true],
  ["Sui", "Adapter available; production wallet sign-in can be enabled after UI wiring.", true],
  ["Solana", "Keep disabled until cluster and wallet adapter policy are finalized.", false],
  ["Bitcoin", "Keep disabled until signing format and address policy are finalized.", false],
  ["Aptos", "Keep disabled until network and wallet event policy are finalized.", false]
] as const;

export default function ChainsPage() {
  return (
    <AppShell
      active="/dashboard/chains"
      eyebrow="CHAIN POLICY"
      summary="Review which chain families the production application should expose to users."
      title="Verification policy"
    >
      <div className="grid grid-2">
        {chains.map(([name, copy, active]) => (
          <div className="chain-card" key={name}>
            <div>
              <h3>{name}</h3>
              <p className="muted">{copy}</p>
            </div>
            <ChainSwitch active={active} label={name} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
