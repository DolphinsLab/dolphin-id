import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./styles.css";

export const metadata: Metadata = {
  title: "Dolphin ID Next.js Example",
  description: "EVM and Sui login with Dolphin ID, mocked wallets, and self-hosted auth routes."
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
