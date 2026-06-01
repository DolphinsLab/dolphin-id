import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export type CliFramework = "next";
export type CliChain = "evm" | "sui";
export type CliUiMode = "default" | "headless";
export type CliAuthMode = "self-hosted" | "hosted";
export type CliTokenStorage = "cookie" | "memory";

export interface ScaffoldOptions {
  readonly outDir: string;
  readonly framework?: CliFramework;
  readonly chains?: readonly CliChain[];
  readonly ui?: CliUiMode;
  readonly auth?: CliAuthMode;
  readonly tokenStorage?: CliTokenStorage;
  readonly hostedUrl?: string;
  readonly force?: boolean;
}

export interface ResolvedScaffoldOptions {
  readonly outDir: string;
  readonly framework: CliFramework;
  readonly chains: readonly CliChain[];
  readonly ui: CliUiMode;
  readonly auth: CliAuthMode;
  readonly tokenStorage: CliTokenStorage;
  readonly hostedUrl?: string;
  readonly force: boolean;
}

interface FileTemplate {
  readonly path: string;
  readonly content: string;
}

const DEFAULT_HOSTED_URL = "https://auth.example.com";
const DEV_JWT_SECRET = "replace-with-a-strong-development-secret-32";

export async function scaffoldApp(options: ScaffoldOptions): Promise<readonly string[]> {
  const normalized = normalizeScaffoldOptions(options);
  const files = createNextTemplates(normalized);

  await assertWritableTarget(normalized);
  await mkdir(normalized.outDir, { recursive: true });
  await Promise.all(
    files.map(async (file) => {
      const path = join(normalized.outDir, file.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, file.content, { flag: normalized.force ? "w" : "wx" });
    })
  );

  return files.map((file) => file.path);
}

export function parseCliArgs(argv: readonly string[]): ResolvedScaffoldOptions {
  const [command, ...rest] = argv;

  if (command !== "create") {
    throw new Error(helpText());
  }

  const { flags, positional } = readFlags(rest);
  const outDir = flags.out ?? positional[0];

  if (!outDir) {
    throw new Error(helpText());
  }

  return normalizeScaffoldOptions({
    outDir,
    framework: readEnum(flags.framework, ["next"], "next"),
    chains: readChains(flags.chains),
    ui: readEnum(flags.ui, ["default", "headless"], "default"),
    auth: readEnum(flags.auth, ["self-hosted", "hosted"], "self-hosted"),
    tokenStorage: readEnum(flags["token-storage"], ["cookie", "memory"], "cookie"),
    ...(flags["hosted-url"] ? { hostedUrl: flags["hosted-url"] } : {}),
    force: flags.force === "true" || flags.yes === "true"
  });
}

export function helpText(): string {
  return [
    "Usage: dolphin-id create <app-name> [options]",
    "",
    "Options:",
    "  --out <dir>                         Write to a target directory",
    "  --framework next                    Scaffold a Next.js app",
    "  --chains evm,sui                    Select wallet chains",
    "  --ui default|headless               Select default UI or headless hooks",
    "  --auth self-hosted|hosted           Select nonce/session mode",
    "  --token-storage cookie|memory       Select session token storage",
    "  --hosted-url https://auth.example.com",
    "  --force                             Overwrite scaffolded files"
  ].join("\n");
}

export function normalizeScaffoldOptions(options: ScaffoldOptions): ResolvedScaffoldOptions {
  const framework = options.framework ?? "next";
  const auth = options.auth ?? "self-hosted";
  const hostedUrl = auth === "hosted" ? (options.hostedUrl ?? DEFAULT_HOSTED_URL) : undefined;
  const chains = Array.from(new Set(options.chains ?? ["evm", "sui"])) as CliChain[];

  if (framework !== "next") {
    throw new Error("Only Next.js scaffolding is supported.");
  }

  if (chains.length === 0) {
    throw new Error("Select at least one chain.");
  }

  return {
    outDir: resolve(options.outDir),
    framework,
    chains,
    ui: options.ui ?? "default",
    auth,
    tokenStorage: options.tokenStorage ?? "cookie",
    ...(hostedUrl ? { hostedUrl } : {}),
    force: options.force ?? false
  };
}

function createNextTemplates(options: ResolvedScaffoldOptions): readonly FileTemplate[] {
  return [
    { path: "package.json", content: packageJsonTemplate(options) },
    { path: "README.md", content: readmeTemplate(options) },
    { path: ".env.example", content: envExampleTemplate(options) },
    { path: "next-env.d.ts", content: nextEnvTemplate() },
    { path: "next.config.ts", content: nextConfigTemplate() },
    { path: "tsconfig.json", content: tsconfigTemplate() },
    { path: "app/globals.css", content: globalsCssTemplate() },
    { path: "app/layout.tsx", content: layoutTemplate() },
    { path: "app/page.tsx", content: pageTemplate(options) },
    { path: "app/dolphin-config.ts", content: dolphinConfigTemplate(options) },
    ...(options.auth === "self-hosted" ? selfHostedRouteTemplates(options) : []),
    { path: "tests/scaffold.test.mjs", content: scaffoldTestTemplate(options) }
  ];
}

function packageJsonTemplate(options: ResolvedScaffoldOptions): string {
  const useEvm = options.chains.includes("evm");
  const useSui = options.chains.includes("sui");

  return json({
    name: safePackageName(basename(options.outDir)),
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "next dev",
      build: "next build",
      typecheck: "tsc --noEmit",
      test: "node --test tests/scaffold.test.mjs"
    },
    dependencies: {
      "@dolphin-id/react": "latest",
      ...(options.auth === "self-hosted" ? { "@dolphin-id/server": "latest" } : {}),
      ...(options.ui === "default" ? { "@dolphin-id/ui": "latest" } : {}),
      ...(useEvm ? { "@dolphin-id/adapter-evm": "latest" } : {}),
      ...(useSui ? { "@dolphin-id/adapter-sui": "latest" } : {}),
      next: "^16.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0"
    },
    devDependencies: {
      "@types/node": "^25.0.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      typescript: "^5.9.0"
    }
  });
}

function readmeTemplate(options: ResolvedScaffoldOptions): string {
  const hostedNote =
    options.auth === "hosted"
      ? `\nHosted auth is configured through \`NEXT_PUBLIC_DOLPHIN_HOSTED_URL\`. The generated default is \`${options.hostedUrl}\`.\n`
      : "";
  const storageNote =
    options.tokenStorage === "cookie"
      ? "The self-hosted routes persist the session token in an HttpOnly cookie."
      : "The provider keeps the session in React state; persist it in your app if you need refresh recovery.";

  return `# Dolphin ID App

Generated with \`@dolphin-id/cli\`.

- Framework: ${options.framework}
- Chains: ${options.chains.join(", ")}
- UI integration: ${options.ui}
- Auth mode: ${options.auth}
- Token storage: ${options.tokenStorage}

${storageNote}
${hostedNote}
## Run

\`\`\`bash
pnpm install
pnpm test
pnpm dev
\`\`\`

## Recipes

- Switch to headless UI: regenerate with \`--ui headless\`.
- Use hosted auth: regenerate with \`--auth hosted --hosted-url https://auth.example.com\`.
- Use in-memory sessions only: regenerate with \`--token-storage memory\`.
`;
}

function envExampleTemplate(options: ResolvedScaffoldOptions): string {
  if (options.auth === "hosted") {
    return `NEXT_PUBLIC_DOLPHIN_HOSTED_URL=${options.hostedUrl}
NEXT_PUBLIC_DOLPHIN_DOMAIN=localhost:3000
`;
  }

  return `DOLPHIN_JWT_SECRET=${DEV_JWT_SECRET}
DOLPHIN_PUBLIC_ORIGIN=http://localhost:3000
NEXT_PUBLIC_DOLPHIN_DOMAIN=localhost:3000
`;
}

function nextEnvTemplate(): string {
  return `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file is generated by Next.js. It is checked in here so the scaffold
// type-checks before the first dev server run.
`;
}

function nextConfigTemplate(): string {
  return `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`;
}

function tsconfigTemplate(): string {
  return json({
    compilerOptions: {
      target: "ES2022",
      lib: ["dom", "dom.iterable", "es2022"],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }]
    },
    include: ["next-env.d.ts", "app/**/*.ts", "app/**/*.tsx"],
    exclude: ["node_modules"]
  });
}

function globalsCssTemplate(): string {
  return `:root {
  color-scheme: light;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f8fafc;
  color: #111827;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button {
  font: inherit;
}
`;
}

function layoutTemplate(): string {
  return `import type { ReactNode } from "react";

import "./globals.css";

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
}

function pageTemplate(options: ResolvedScaffoldOptions): string {
  if (options.ui === "headless") {
    return `"use client";

import { DolphinProvider, useDolphin } from "@dolphin-id/react";

import { adapters, auth } from "./dolphin-config";

function Login() {
  const { wallets, state, activeAccount, connectWallet, signIn } = useDolphin();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      <h1>Dolphin ID</h1>
      <div style={{ display: "grid", gap: 12 }}>
        {wallets.map((wallet) => (
          <button
            key={wallet.id}
            type="button"
            onClick={() => connectWallet({ adapterId: wallet.adapterId, walletId: wallet.id })}
          >
            Connect {wallet.name}
          </button>
        ))}
      </div>
      <p>{activeAccount ? activeAccount.displayAddress : "No wallet connected"}</p>
      <button type="button" disabled={state.status !== "connected"} onClick={() => signIn()}>
        Sign in
      </button>
    </main>
  );
}

export default function Page() {
  return (
    <DolphinProvider config={{ adapters, auth }}>
      <Login />
    </DolphinProvider>
  );
}
`;
  }

  return `"use client";

import { DolphinProvider, useDolphin } from "@dolphin-id/react";
import { AccountDisplay, ConnectButton } from "@dolphin-id/ui";

import { adapters, auth } from "./dolphin-config";

function Login() {
  const { state, signIn } = useDolphin();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      <h1>Dolphin ID</h1>
      <ConnectButton />
      <AccountDisplay />
      <button type="button" disabled={state.status !== "connected"} onClick={() => signIn()}>
        Sign in
      </button>
    </main>
  );
}

export default function Page() {
  return (
    <DolphinProvider config={{ adapters, auth }}>
      <Login />
    </DolphinProvider>
  );
}
`;
}

function dolphinConfigTemplate(options: ResolvedScaffoldOptions): string {
  const imports = [
    options.chains.includes("evm")
      ? 'import { createEvmAdapter } from "@dolphin-id/adapter-evm";'
      : "",
    options.chains.includes("sui")
      ? 'import { createSuiAdapter } from "@dolphin-id/adapter-sui";'
      : ""
  ]
    .filter(Boolean)
    .join("\n");
  const adapters = [
    options.chains.includes("evm")
      ? '  createEvmAdapter({ chainId: 1, chainName: "Ethereum" })'
      : "",
    options.chains.includes("sui") ? '  createSuiAdapter({ network: "testnet" })' : ""
  ]
    .filter(Boolean)
    .join(",\n");
  const auth =
    options.auth === "hosted"
      ? `{
  nonceUrl: hostedAuthUrl("/auth/nonce"),
  verifyUrl: hostedAuthUrl("/auth/verify"),
  refreshUrl: hostedAuthUrl("/auth/refresh"),
  logoutUrl: hostedAuthUrl("/auth/logout"),
  credentials: "${options.tokenStorage === "cookie" ? "include" : "omit"}"
}`
      : `{
  nonceUrl: "/auth/nonce",
  verifyUrl: "/auth/verify",
  refreshUrl: "/auth/refresh",
  logoutUrl: "/auth/logout",
  credentials: "${options.tokenStorage === "cookie" ? "same-origin" : "omit"}"
}`;
  const hostedHelper =
    options.auth === "hosted"
      ? `
const hostedBaseUrl = process.env.NEXT_PUBLIC_DOLPHIN_HOSTED_URL ?? "${options.hostedUrl}";

function hostedAuthUrl(path: string): string {
  return new URL(path, hostedBaseUrl).toString();
}
`
      : "";

  return `${imports}${hostedHelper}
export const adapters = [
${adapters}
];

export const auth = ${auth};
`;
}

function selfHostedRouteTemplates(options: ResolvedScaffoldOptions): readonly FileTemplate[] {
  return [
    { path: "app/auth/auth-store.ts", content: authStoreTemplate(options) },
    { path: "app/auth/nonce/route.ts", content: nonceRouteTemplate() },
    { path: "app/auth/verify/route.ts", content: verifyRouteTemplate(options) },
    { path: "app/auth/refresh/route.ts", content: refreshRouteTemplate(options) },
    { path: "app/auth/me/route.ts", content: meRouteTemplate(options) },
    { path: "app/auth/logout/route.ts", content: logoutRouteTemplate(options) }
  ];
}

function authStoreTemplate(options: ResolvedScaffoldOptions): string {
  const supportsEvm = options.chains.includes("evm");
  const supportsSui = options.chains.includes("sui");

  return `import {
  createServerAuth,
  decodeJwtPayload,
  ${supportsEvm ? "verifyEvmSiweMessage," : ""}
  ${supportsSui ? "verifySuiPersonalMessage," : ""}
  type VerificationRequest
} from "@dolphin-id/server";

export const SESSION_COOKIE = "dolphin_session";
export const REFRESH_COOKIE = "dolphin_refresh";

const publicOrigin = process.env.DOLPHIN_PUBLIC_ORIGIN;

export const auth = createServerAuth({
  jwtSecret: process.env.DOLPHIN_JWT_SECRET ?? "${DEV_JWT_SECRET}",
  runtimeEnvironment: process.env.NODE_ENV,
  ...(publicOrigin ? { publicOrigin } : {}),
  verifySiwx: (request: VerificationRequest) => {
    const expectedDomain = process.env.NEXT_PUBLIC_DOLPHIN_DOMAIN;

    ${
      supportsEvm
        ? `if (request.message.chainType === "evm") {
      return verifyEvmSiweMessage(request, {
        ...(expectedDomain ? { expectedDomain } : {})
      });
    }`
        : ""
    }

    ${
      supportsSui
        ? `if (request.message.chainType === "sui") {
      return verifySuiPersonalMessage(request);
    }`
        : ""
    }

    return Promise.resolve({ ok: false, reason: "Unsupported chain type." });
  }
});

export function readSession(token: string | undefined) {
  if (!token) {
    return null;
  }

  const payload = decodeJwtPayload(token);
  const expiresAtSeconds = typeof payload.exp === "number" ? payload.exp : 0;

  if (expiresAtSeconds * 1000 <= Date.now()) {
    return null;
  }

  return {
    subject: String(payload.sub),
    issuedAt: new Date(Number(payload.iat) * 1000).toISOString(),
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    token
  };
}
`;
}

function nonceRouteTemplate(): string {
  return `import { NextResponse } from "next/server";

import { auth } from "../auth-store";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    readonly purpose?: string;
    readonly domain?: string;
    readonly address?: string;
    readonly chainType?: string;
    readonly walletName?: string;
  };

  const nonce = await auth.issueNonce({
    purpose: body.purpose ?? "sign-in",
    ...(body.domain ? { domain: body.domain } : {}),
    ...(body.address ? { address: body.address } : {}),
    ...(body.chainType ? { chainType: body.chainType } : {}),
    ...(body.walletName ? { walletName: body.walletName } : {})
  });

  return NextResponse.json({
    nonce: nonce.nonce,
    expiresAt: nonce.expiresAt.toISOString()
  });
}
`;
}

function verifyRouteTemplate(options: ResolvedScaffoldOptions): string {
  if (options.tokenStorage === "memory") {
    return `import { NextResponse } from "next/server";

import { auth } from "../auth-store";

export async function POST(request: Request) {
  const result = await auth.verifySignIn(await request.json());

  return NextResponse.json({
    session: result.session,
    refreshToken: result.refreshToken,
    user: result.user,
    verification: result.verification
  });
}
`;
  }

  return `import { NextResponse } from "next/server";
import { createSessionCookieOptions } from "@dolphin-id/server";

import { REFRESH_COOKIE, SESSION_COOKIE, auth } from "../auth-store";

export async function POST(request: Request) {
  const result = await auth.verifySignIn(await request.json());
  const response = NextResponse.json({
    session: result.session,
    refreshToken: result.refreshToken,
    user: result.user,
    verification: result.verification
  });
  const cookieOptions = createSessionCookieOptions({
    name: SESSION_COOKIE,
    expires: result.session.expiresAt,
    runtimeEnvironment: process.env.NODE_ENV
  });
  const refreshCookieOptions = createSessionCookieOptions({
    name: REFRESH_COOKIE,
    expires: result.refreshToken.expiresAt,
    runtimeEnvironment: process.env.NODE_ENV
  });

  response.cookies.set(cookieOptions.name, result.session.token, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
    expires: cookieOptions.expires
  });
  response.cookies.set(refreshCookieOptions.name, result.refreshToken.token, {
    httpOnly: refreshCookieOptions.httpOnly,
    secure: refreshCookieOptions.secure,
    sameSite: refreshCookieOptions.sameSite,
    path: refreshCookieOptions.path,
    expires: refreshCookieOptions.expires
  });

  return response;
}
`;
}

function refreshRouteTemplate(options: ResolvedScaffoldOptions): string {
  if (options.tokenStorage === "memory") {
    return `import { NextResponse } from "next/server";

import { auth } from "../auth-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { readonly refreshToken?: string };
  const result = await auth.refreshSession({ refreshToken: body.refreshToken ?? "" });

  return NextResponse.json({
    session: result.session,
    refreshToken: result.refreshToken
  });
}
`;
  }

  return `import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSessionCookieOptions } from "@dolphin-id/server";

import { REFRESH_COOKIE, SESSION_COOKIE, auth } from "../auth-store";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const body = (await request.json().catch(() => ({}))) as { readonly refreshToken?: string };
  const result = await auth.refreshSession({
    refreshToken: body.refreshToken ?? cookieStore.get(REFRESH_COOKIE)?.value ?? ""
  });
  const response = NextResponse.json({
    session: result.session,
    refreshToken: result.refreshToken
  });
  const cookieOptions = createSessionCookieOptions({
    name: SESSION_COOKIE,
    expires: result.session.expiresAt,
    runtimeEnvironment: process.env.NODE_ENV
  });
  const refreshCookieOptions = createSessionCookieOptions({
    name: REFRESH_COOKIE,
    expires: result.refreshToken.expiresAt,
    runtimeEnvironment: process.env.NODE_ENV
  });

  response.cookies.set(cookieOptions.name, result.session.token, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
    expires: cookieOptions.expires
  });
  response.cookies.set(refreshCookieOptions.name, result.refreshToken.token, {
    httpOnly: refreshCookieOptions.httpOnly,
    secure: refreshCookieOptions.secure,
    sameSite: refreshCookieOptions.sameSite,
    path: refreshCookieOptions.path,
    expires: refreshCookieOptions.expires
  });

  return response;
}
`;
}

function meRouteTemplate(options: ResolvedScaffoldOptions): string {
  if (options.tokenStorage === "memory") {
    return `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ session: null }, { status: 401 });
}
`;
  }

  return `import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, readSession } from "../auth-store";

export async function GET() {
  const cookieStore = await cookies();
  const session = readSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  return NextResponse.json({ session });
}
`;
}

function logoutRouteTemplate(options: ResolvedScaffoldOptions): string {
  if (options.tokenStorage === "memory") {
    return `import { NextResponse } from "next/server";

import { auth } from "../auth-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { readonly refreshToken?: string };
  if (body.refreshToken) {
    await auth.revokeRefreshToken(body.refreshToken);
  }

  return NextResponse.json({ ok: true });
}
`;
  }

  return `import { NextResponse } from "next/server";

import { REFRESH_COOKIE, SESSION_COOKIE, auth } from "../auth-store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { readonly refreshToken?: string };
  if (body.refreshToken) {
    await auth.revokeRefreshToken(body.refreshToken);
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return response;
}
`;
}

function scaffoldTestTemplate(options: ResolvedScaffoldOptions): string {
  return `import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";

test("scaffold includes selected Dolphin ID integration", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/dolphin-config.ts", import.meta.url), "utf8");
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(page, /DolphinProvider/);
  ${options.ui === "default" ? "assert.match(page, /ConnectButton/);" : "assert.doesNotMatch(page, /ConnectButton/);"}
  ${options.chains.includes("evm") ? "assert.match(config, /createEvmAdapter/);" : "assert.doesNotMatch(config, /createEvmAdapter/);"}
  ${options.chains.includes("sui") ? "assert.match(config, /createSuiAdapter/);" : "assert.doesNotMatch(config, /createSuiAdapter/);"}
  assert.equal(pkg.scripts.dev, "next dev");
});

test("scaffold matches selected auth mode", async () => {
  ${
    options.auth === "self-hosted"
      ? 'await access(new URL("../app/auth/nonce/route.ts", import.meta.url));'
      : 'await assert.rejects(access(new URL("../app/auth/nonce/route.ts", import.meta.url)));'
  }
  ${
    options.auth === "self-hosted"
      ? 'await access(new URL("../app/auth/refresh/route.ts", import.meta.url));'
      : 'await assert.rejects(access(new URL("../app/auth/refresh/route.ts", import.meta.url)));'
  }
});
`;
}

async function assertWritableTarget(options: ResolvedScaffoldOptions): Promise<void> {
  try {
    await access(options.outDir);
  } catch {
    return;
  }

  if (options.force) {
    return;
  }

  const entries = await readdir(options.outDir);

  if (entries.length > 0) {
    throw new Error(`Target directory is not empty: ${options.outDir}`);
  }
}

function readFlags(args: readonly string[]): {
  readonly flags: Record<string, string>;
  readonly positional: readonly string[];
} {
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [rawKey, rawValue] = arg.slice(2).split("=", 2);

    if (!rawKey) {
      continue;
    }

    if (rawValue !== undefined) {
      flags[rawKey] = rawValue;
      continue;
    }

    const next = args[index + 1];

    if (!next || next.startsWith("--")) {
      flags[rawKey] = "true";
    } else {
      flags[rawKey] = next;
      index += 1;
    }
  }

  return { flags, positional };
}

function readChains(value: string | undefined): readonly CliChain[] {
  const chains = (value ?? "evm,sui")
    .split(",")
    .map((chain) => chain.trim())
    .filter(Boolean);

  chains.forEach((chain) => {
    if (chain !== "evm" && chain !== "sui") {
      throw new Error(`Unsupported chain: ${chain}`);
    }
  });

  return chains as readonly CliChain[];
}

function readEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  const selected = value ?? fallback;

  if (!allowed.includes(selected as T)) {
    throw new Error(`Unsupported value: ${selected}`);
  }

  return selected as T;
}

function safePackageName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function runCli(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);
  const files = await scaffoldApp(options);

  console.log(`Created Dolphin ID app at ${options.outDir}`);
  files.forEach((file) => console.log(`- ${file}`));
}
