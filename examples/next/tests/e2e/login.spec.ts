import { expect, test } from "@playwright/test";

test("completes EVM sign-in and restores the session after refresh", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("connect-wallet").click();
  await page.getByRole("button", { name: /Mock EVM Wallet/ }).click();
  await expect(page.getByTestId("sdk-status")).toContainText("connected");

  await page.getByTestId("sign-in").click();
  await expect(page.getByTestId("session-status")).toContainText("evm:1:");

  await page.reload();
  await expect(page.getByTestId("recovered-session")).toContainText("evm:1:");
});

test("completes Sui sign-in and supports logout", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("connect-wallet").click();
  await page.getByRole("button", { name: /Mock Sui Wallet/ }).click();
  await expect(page.getByTestId("sdk-status")).toContainText("connected");

  await page.getByTestId("sign-in").click();
  await expect(page.getByTestId("session-status")).toContainText("sui:testnet:");
  await expect(page.getByTestId("recovered-session")).toContainText("sui:testnet:");

  await page.getByTestId("logout").click();
  await expect(page.getByTestId("recovered-session")).toContainText("none");
});
