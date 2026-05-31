import { createContext, useContext, type ReactNode } from "react";

import type { ChainAdapter } from "@dolphin-id/core";

export interface DolphinProviderConfig {
  readonly adapters: readonly ChainAdapter[];
}

const DolphinContext = createContext<DolphinProviderConfig | null>(null);

export interface DolphinProviderProps {
  readonly config: DolphinProviderConfig;
  readonly children: ReactNode;
}

export function DolphinProvider({ config, children }: DolphinProviderProps) {
  return <DolphinContext.Provider value={config}>{children}</DolphinContext.Provider>;
}

export function useDolphinConfig(): DolphinProviderConfig {
  const config = useContext(DolphinContext);

  if (!config) {
    throw new Error("useDolphinConfig must be used within DolphinProvider.");
  }

  return config;
}
