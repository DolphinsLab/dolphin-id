export const docsVersion = "v1.0 draft";

export interface DocsPage {
  readonly slug: string;
  readonly title: string;
  readonly section: string;
  readonly description: string;
  readonly version: string;
  readonly summary: readonly string[];
  readonly bullets: readonly string[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
}

export const docsPages: readonly DocsPage[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    section: "Open-source core",
    description: "Install Dolphin ID, configure EVM and Sui adapters, and wire the React provider.",
    version: docsVersion,
    summary: [
      "Start with the open-source packages: core contracts, React hooks, default UI, chain adapters, and the server SDK.",
      "Use self-hosted auth routes by default. Hosted auth is optional and called out separately wherever it appears."
    ],
    bullets: [
      "Install @dolphin-id/react, @dolphin-id/ui, @dolphin-id/adapter-evm, @dolphin-id/adapter-sui, and @dolphin-id/server.",
      "Wrap the app in DolphinProvider with selected adapters and nonce/verify endpoints.",
      "Use ConnectButton for the default UI or useDolphin for headless flows.",
      "Run the Next.js example when validating EVM and Sui login end to end."
    ],
    links: [
      { label: "Getting started guide", href: "/docs/getting-started" },
      { label: "Next.js example", href: "/docs/examples" }
    ]
  },
  {
    slug: "api-reference",
    title: "API Reference",
    section: "Open-source core",
    description: "Core, React, UI, adapter, and server APIs exposed by the SDK packages.",
    version: docsVersion,
    summary: [
      "The public API is organized around the chain-neutral ChainAdapter contract and SIWX message model.",
      "React and UI packages consume the same contracts, so third-party adapters work without changes to the provider."
    ],
    bullets: [
      "Core exports ChainAdapter, Wallet, Account, SiwxMessage, DolphinState, DolphinEvent, and DolphinError.",
      "React exports DolphinProvider, useDolphin, useWallets, useConnect, useSignIn, and useSession.",
      "UI exports ConnectButton, WalletModal, AccountDisplay, theme tokens, locales, and copy overrides.",
      "Server exports nonce stores, session helpers, verification helpers, and Express/Fastify route adapters."
    ],
    links: [
      { label: "Adapter spec", href: "/docs/adapter-spec" },
      { label: "Security", href: "/docs/security" }
    ]
  },
  {
    slug: "server-sdks",
    title: "Server SDKs",
    section: "Open-source core",
    description:
      "Self-hosted server verification, sessions, middleware, and future language SDK parity.",
    version: docsVersion,
    summary: [
      "The Node SDK is the source of truth for nonce lifecycle, signature verification, and JWT sessions.",
      "Go, Rust, and Python SDKs are tracked as future parity work and should match Node fixtures."
    ],
    bullets: [
      "Use createServerAuth for issueNonce, consumeNonce, verifySignIn, and issueSession.",
      "Use verifyEvmSiweMessage and verifySuiPersonalMessage for chain-specific signature checks.",
      "Use createAuthRouteHandlers, createExpressAuthRoutes, or registerFastifyAuthRoutes for common frameworks.",
      "Keep production secrets strong and origins HTTPS unless a local development override is explicit."
    ],
    links: [
      { label: "Security guide", href: "/docs/security" },
      { label: "API reference", href: "/docs/api-reference" }
    ]
  },
  {
    slug: "hosted-service",
    title: "Hosted Service",
    section: "Hosted value-add",
    description: "Optional hosted nonce/session service concepts, boundaries, and configuration.",
    version: docsVersion,
    summary: [
      "Hosted auth is an optional value-add service. The open-source SDK remains fully self-hostable.",
      "Projects using hosted auth should configure allowed domains, API keys, usage limits, and audit logs."
    ],
    bullets: [
      "Hosted endpoints must cover nonce issue, login verification, session creation, current user, and logout.",
      "Allowed domains should be enforced before nonce issue and again during signature verification.",
      "API keys should be scoped per project and rotated without breaking active sessions.",
      "Audit logs should capture nonce issue, verify success/failure, and session invalidation."
    ],
    links: [
      { label: "CLI hosted recipe", href: "/docs/examples" },
      { label: "Security", href: "/docs/security" }
    ]
  },
  {
    slug: "security",
    title: "Security",
    section: "Open-source core",
    description: "Nonce, domain, signature, session, cookie, and production deployment guidance.",
    version: docsVersion,
    summary: [
      "Security-critical flows bind nonces to domains and reject weak production session secrets.",
      "Self-hosted and hosted modes share the same verification principles even when operational controls differ."
    ],
    bullets: [
      "Bind nonce records to domain, address, chain type, and purpose before signing.",
      "Consume nonces exactly once and reject expired or mismatched records.",
      "Use HTTPS origins and secure HttpOnly cookies in production.",
      "Add explicit risk acceptance for any production HTTP or weak-secret override."
    ],
    links: [
      { label: "Troubleshooting", href: "/docs/troubleshooting" },
      { label: "Hosted service", href: "/docs/hosted-service" }
    ]
  },
  {
    slug: "examples",
    title: "Examples",
    section: "Open-source core",
    description: "Runnable app, CLI scaffolder, and third-party adapter sample coverage.",
    version: docsVersion,
    summary: [
      "The Next.js example demonstrates EVM and Sui login with default UI and self-hosted routes.",
      "The CLI can generate default UI or headless examples with self-hosted or hosted auth settings."
    ],
    bullets: [
      "Run pnpm --filter @dolphin-id/example-next test for browser E2E login coverage.",
      "Run dolphin-id create my-app --chains evm,sui --ui default for a generated app.",
      "Use examples/adapter-third-party as the contract-test template for external adapters.",
      "Keep examples focused on working integrations, not marketing pages."
    ],
    links: [
      { label: "CLI scaffolder", href: "/docs/getting-started" },
      { label: "Adapter spec", href: "/docs/adapter-spec" }
    ]
  },
  {
    slug: "migration",
    title: "Migration",
    section: "Open-source core",
    description:
      "Upgrade notes for package boundaries, auth routes, UI options, and adapter changes.",
    version: docsVersion,
    summary: [
      "Migration notes should separate SDK changes from optional hosted-service changes.",
      "Breaking adapter contract changes must include fixture and sample adapter updates."
    ],
    bullets: [
      "Move chain-neutral types to @dolphin-id/core and chain behavior to adapter packages.",
      "Prefer createAuthRouteHandlers or framework helpers for route migrations.",
      "Keep custom UI on headless hooks and adopt @dolphin-id/ui only when default components fit.",
      "Run adapter contract tests before shipping a third-party adapter upgrade."
    ],
    links: [
      { label: "API reference", href: "/docs/api-reference" },
      { label: "Adapter spec", href: "/docs/adapter-spec" }
    ]
  },
  {
    slug: "adapter-spec",
    title: "Third-party Adapter Spec",
    section: "Open-source core",
    description: "Required adapter methods, events, normalization, signing, and fixtures.",
    version: docsVersion,
    summary: [
      "Third-party adapters implement the ChainAdapter contract from @dolphin-id/core.",
      "Adapters own wallet discovery, account normalization, SIWX message creation, and wallet signing."
    ],
    bullets: [
      "discoverWallets returns stable wallet IDs, supported chain types, install status, and capabilities.",
      "connect returns accounts with normalized address, display address, wallet ID, adapter ID, and chain.",
      "createSiwxMessage must include domain, address, chainType, chainId, nonce, uri, issuedAt, expirationTime, version, and raw payload when useful.",
      "signSiwxMessage returns the account, message, signature, and ISO signedAt timestamp.",
      "on must support lifecycle event subscription and return an unsubscribe function.",
      "Contract tests should cover discovery, connection, normalization, message construction, signing, and emitted events."
    ],
    links: [
      { label: "Spec page", href: "/docs/adapter-spec" },
      { label: "Sample adapter", href: "/docs/examples" }
    ]
  }
];

export function findDocsPage(slug: string): DocsPage | undefined {
  return docsPages.find((page) => page.slug === slug);
}
