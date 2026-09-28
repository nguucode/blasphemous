import { expect, test } from "@playwright/test";
import { DESKTOP_LINK, FILE_KEY, PHONE_LINK } from "./helpers";

// Spec §10: a Designer creates a Demo, copies the link, a client opens it and switches Device.
test("a visitor creates a Demo, copies the link, and a client views it on both devices", async ({ page, context, browser, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/");
  await page.getByRole("link", { name: "Tạo Demo miễn phí" }).click();
  await expect(page).toHaveURL(/\/app\/new$/);

  // The slug follows the name, Vietnamese diacritics removed, until edited by hand.
  await page.getByLabel("Tên Demo").fill("Ứng dụng Đặt Lịch");
  await expect(page.getByLabel("Demo Link")).toHaveValue("ung-dung-dat-lich");

  await page.getByLabel("Phone", { exact: true }).fill(PHONE_LINK);
  await page.getByLabel("Desktop", { exact: true }).fill(DESKTOP_LINK);
  await expect(page.getByText("✓ Nhận flow 3:10")).toBeVisible();
  await expect(page.getByText("✓ Nhận flow 5:1")).toBeVisible();
  await page.getByLabel(/Anyone with the link can view/).check();
  await page.getByRole("button", { name: "Tạo Demo", exact: true }).click();

  // Success screen: the link, and Copy puts the full URL on the clipboard.
  await expect(page).toHaveURL(/\/app\/demos\/[0-9a-f-]{36}\/ready$/);
  const demoId = page.url().match(/demos\/([0-9a-f-]{36})/)![1];
  const demoUrl = `${baseURL}/ung-dung-dat-lich`;
  await expect(page.getByText(demoUrl.replace(/^https?:\/\//, ""))).toBeVisible();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Đã copy" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(demoUrl);

  // The Designer's list shows it; a second Demo is not allowed from this browser.
  await page.goto("/app");
  await expect(page.getByRole("cell", { name: "Ứng dụng Đặt Lịch" })).toBeVisible();
  await expect(page.getByText("1/1 Demo")).toBeVisible();
  await page.goto("/app/new");
  await expect(page.getByRole("heading", { name: "Bạn đã có 1 Demo." })).toBeVisible();

  // A client, in their own browser, opens the link.
  const client = await browser.newContext();
  const viewer = await client.newPage();
  const response = await viewer.goto(demoUrl);
  expect(response?.status()).toBe(200);
  await expect(viewer).toHaveTitle("Ứng dụng Đặt Lịch");
  await expect(viewer.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(viewer.getByRole("heading", { name: "Ứng dụng Đặt Lịch" })).toBeVisible();

  // Opens on the phone (3D iPhone), with the phone flow embedded.
  await expect(viewer.getByRole("button", { name: "Mobile" })).toHaveAttribute("aria-pressed", "true");
  await expect(viewer.locator(`iframe[src*="embed.figma.com/proto/${FILE_KEY}"][src*="node-id=3-10"]`)).toBeAttached();
  // Switching to Desktop loads the desktop flow.
  await viewer.getByRole("button", { name: "Desktop" }).click();
  await expect(viewer.getByRole("button", { name: "Desktop" })).toHaveAttribute("aria-pressed", "true");
  await expect(viewer.locator(`iframe[src*="node-id=5-1"]`)).toBeVisible();

  // The client cannot open the Designer's edit page.
  await viewer.goto(`/app/demos/${demoId}`);
  await expect(viewer).toHaveURL(/\/app\/new$/);
  await client.close();
});
