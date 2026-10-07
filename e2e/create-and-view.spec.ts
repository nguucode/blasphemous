import { expect, test } from "@playwright/test";
import { DESKTOP_FIELD, DESKTOP_LINK, FILE_KEY, PHONE_FIELD, PHONE_LINK, fillSettings, openNewDemo } from "./helpers";

// Spec §10: a Designer creates a Demo, copies the link, a client opens it and switches Device.
test("a visitor creates a Demo, copies the link, and a client views it on both devices", async ({ page, context, browser, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/");
  await page.getByRole("link", { name: "Tạo Demo miễn phí" }).click();
  // Creating needs an account: sign in (fake Google in E2E) and land back on the form.
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fnew$/);
  await page.getByRole("button", { name: "Tiếp tục với Google" }).click();
  await expect(page).toHaveURL(/\/app\/new$/);

  // The slug follows the name, Vietnamese diacritics removed, until edited by hand.
  await page.getByRole("button", { name: "Cài đặt Demo" }).click();
  await page.getByLabel("Tên Demo").fill("Ứng dụng Đặt Lịch");
  await expect(page.getByLabel("Demo Link")).toHaveValue("ung-dung-dat-lich");
  await page.getByLabel(/Anyone with the link can view/).check();
  await page.getByRole("button", { name: "Xong" }).click();

  // Mobile is on by default; Desktop is turned on, which adds its tab.
  await page.getByLabel(PHONE_FIELD).fill(PHONE_LINK);
  await page.getByRole("checkbox", { name: "Desktop" }).check();
  await page.getByLabel(DESKTOP_FIELD).fill(DESKTOP_LINK);
  await expect(page.getByText("✓ Bắt đầu ở frame 3:10")).toBeVisible();
  await expect(page.getByText("✓ Bắt đầu ở frame 5:1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Desktop", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tạo Demo", exact: true }).click();

  // Success screen: the link, and Copy puts the full URL on the clipboard.
  await expect(page).toHaveURL(/\/app\/demos\/[0-9a-f-]{36}\/ready$/);
  const demoId = page.url().match(/demos\/([0-9a-f-]{36})/)![1];
  const demoUrl = `${baseURL}/ung-dung-dat-lich`;
  await expect(page.getByText(demoUrl.replace(/^https?:\/\//, ""))).toBeVisible();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByRole("button", { name: "Đã copy" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(demoUrl);

  // The Designer's list shows it, out of three per account (the limit itself: src/db/repo.test.ts).
  await page.goto("/app");
  await expect(page.getByRole("cell", { name: "Ứng dụng Đặt Lịch" })).toBeVisible();
  await expect(page.getByText("1/3 Demo")).toBeVisible();

  // A client, in their own browser, opens the link.
  const client = await browser.newContext();
  const viewer = await client.newPage();
  const response = await viewer.goto(demoUrl);
  expect(response?.status()).toBe(200);
  await expect(viewer).toHaveTitle("Ứng dụng Đặt Lịch");
  await expect(viewer.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(viewer.getByRole("heading", { name: "Ứng dụng Đặt Lịch" })).toBeVisible();

  // A desktop-sized screen opens on Desktop, with the desktop flow embedded.
  await expect(viewer.getByRole("button", { name: "Desktop" })).toHaveAttribute("aria-pressed", "true");
  await expect(viewer.locator(`iframe[src*="embed.figma.com/proto/${FILE_KEY}"][src*="node-id=5-1"]`)).toBeVisible();
  // Switching to Mobile loads the phone flow in the 3D iPhone.
  await viewer.getByRole("button", { name: "Mobile" }).click();
  await expect(viewer.getByRole("button", { name: "Mobile" })).toHaveAttribute("aria-pressed", "true");
  await expect(viewer.locator(`iframe[src*="node-id=3-10"]`)).toBeAttached();
  // No flows yet: no Flow list, no W/S.
  await expect(viewer.getByRole("region", { name: "Flow list" })).toHaveCount(0);

  // The client cannot open the Designer's edit page.
  await viewer.goto(`/app/demos/${demoId}`);
  await expect(viewer).toHaveURL(/\/login\?next=/);
  await client.close();
});

// Spec 12: flows added by link show in the Viewer's Flow list, filtered by Device, and W/S move between them.
test("flows and brand colour reach the Viewer, and W/S switch flows", async ({ page, browser, baseURL }) => {
  await openNewDemo(page);
  await fillSettings(page, { name: "Flow Demo", slug: "flow-demo" });
  await page.getByLabel(PHONE_FIELD).fill(PHONE_LINK);
  await page.getByRole("button", { name: /Thêm flow bằng link cho Mobile/ }).click();
  await page.getByLabel("Tên flow").fill("Đặt lịch");
  await page.getByLabel("Link flow").fill(`https://www.figma.com/proto/${FILE_KEY}/X?node-id=7-7`);
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await page.getByRole("button", { name: /Thêm flow bằng link cho Mobile/ }).click();
  await page.getByLabel("Tên flow").fill("Thanh toán");
  await page.getByLabel("Link flow").fill(`https://www.figma.com/proto/${FILE_KEY}/X?node-id=8-8`);
  await page.getByLabel("Link flow").press("Enter"); // adds the flow, does not submit the Demo
  await expect(page.getByRole("button", { name: "Thanh toán", exact: true })).toBeVisible();

  // Brand colour, applied only on Save in the popover.
  await page.getByRole("button", { name: "Brand logo" }).click();
  await page.locator("#brand-color").fill("#ff2d55");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Tạo Demo", exact: true }).click();
  await expect(page).toHaveURL(/\/ready$/);

  const client = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const viewer = await client.newPage();
  await viewer.goto(`${baseURL}/flow-demo`);
  // Only Mobile is on, so it opens there whatever the screen size.
  await expect(viewer.getByRole("button", { name: "Mobile" })).toHaveCSS("background-color", "rgb(255, 45, 85)");
  const flows = viewer.getByRole("region", { name: "Flow list" });
  await expect(flows.getByRole("button")).toHaveText(["Đặt lịch", "Thanh toán"]);
  await viewer.keyboard.press("s");
  await expect(viewer.locator('iframe[src*="node-id=7-7"]')).toBeAttached();
  await viewer.keyboard.press("s");
  await expect(viewer.locator('iframe[src*="node-id=8-8"]')).toBeAttached();
  await viewer.keyboard.press("w");
  await expect(viewer.locator('iframe[src*="node-id=7-7"]')).toBeAttached();
  await client.close();
});
