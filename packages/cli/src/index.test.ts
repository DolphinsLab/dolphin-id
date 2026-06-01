import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { parseCliArgs, scaffoldApp } from "./index";

const execFileAsync = promisify(execFile);

describe("parseCliArgs", () => {
  it("parses scriptable scaffolding flags", () => {
    expect(
      parseCliArgs([
        "create",
        "demo",
        "--framework=next",
        "--chains",
        "evm,sui",
        "--ui",
        "headless",
        "--auth",
        "hosted",
        "--token-storage",
        "memory",
        "--hosted-url",
        "https://auth.example.test",
        "--yes"
      ])
    ).toMatchObject({
      framework: "next",
      chains: ["evm", "sui"],
      ui: "headless",
      auth: "hosted",
      tokenStorage: "memory",
      hostedUrl: "https://auth.example.test",
      force: true
    });
  });

  it("defaults to a hosted auth placeholder when hosted mode is selected", () => {
    expect(parseCliArgs(["create", "demo", "--auth", "hosted"]).hostedUrl).toBe(
      "https://auth.example.com"
    );
  });
});

describe("scaffoldApp", () => {
  it("creates a Next.js app with EVM and Sui default UI plus self-hosted cookie auth", async () => {
    const outDir = await makeTempDir();
    const files = await scaffoldApp({ outDir, force: true });

    expect(files).toContain("app/page.tsx");
    expect(files).toContain("app/auth/nonce/route.ts");
    expect(files).toContain("tests/scaffold.test.mjs");

    const page = await readFile(join(outDir, "app/page.tsx"), "utf8");
    const config = await readFile(join(outDir, "app/dolphin-config.ts"), "utf8");
    const verifyRoute = await readFile(join(outDir, "app/auth/verify/route.ts"), "utf8");
    const packageJson = JSON.parse(await readFile(join(outDir, "package.json"), "utf8")) as {
      readonly dependencies: Readonly<Record<string, string>>;
      readonly scripts: Readonly<Record<string, string>>;
    };

    expect(page).toContain("ConnectButton");
    expect(config).toContain("createEvmAdapter");
    expect(config).toContain("createSuiAdapter");
    expect(verifyRoute).toContain("createSessionCookieOptions");
    expect(packageJson.dependencies["@dolphin-id/ui"]).toBe("latest");
    expect(packageJson.dependencies["@dolphin-id/server"]).toBe("latest");
    expect(packageJson.scripts.dev).toBe("next dev");

    await runGeneratedTest(outDir);
  });

  it("creates a headless hosted app without self-hosted routes", async () => {
    const outDir = await makeTempDir();
    const files = await scaffoldApp({
      outDir,
      chains: ["sui"],
      ui: "headless",
      auth: "hosted",
      tokenStorage: "memory",
      hostedUrl: "https://auth.example.test",
      force: true
    });

    expect(files).not.toContain("app/auth/nonce/route.ts");

    const page = await readFile(join(outDir, "app/page.tsx"), "utf8");
    const config = await readFile(join(outDir, "app/dolphin-config.ts"), "utf8");
    const packageJson = JSON.parse(await readFile(join(outDir, "package.json"), "utf8")) as {
      readonly dependencies: Readonly<Record<string, string>>;
    };

    expect(page).not.toContain("ConnectButton");
    expect(config).not.toContain("createEvmAdapter");
    expect(config).toContain("createSuiAdapter");
    expect(config).toContain("https://auth.example.test");
    expect(packageJson.dependencies["@dolphin-id/ui"]).toBeUndefined();
    expect(packageJson.dependencies["@dolphin-id/server"]).toBeUndefined();

    await runGeneratedTest(outDir);
  });
});

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dolphin-cli-"));
}

async function runGeneratedTest(cwd: string): Promise<void> {
  await execFileAsync(process.execPath, ["--test", "tests/scaffold.test.mjs"], { cwd });
}
