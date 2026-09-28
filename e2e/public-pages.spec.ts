import { expect, test } from "@playwright/test";
import { FILE_KEY, PHONE_LINK } from "./helpers";

test("homepage shows the pitch, the sample Demo and the legal links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Gửi khách một link/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tạo Demo miễn phí" })).toHaveAttribute("href", "/app/new");
  await expect(page.locator(`iframe[src*="embed.figma.com/proto/${FILE_KEY}"]`).first()).toBeAttached();
  await expect(page.getByText("Not affiliated with Figma. Figma is a trademark of Figma, Inc.")).toBeVisible();

  await page.getByRole("link", { name: "Quyền riêng tư" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Quyền riêng tư" })).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Điều khoản" })).toBeVisible();
});

test("the /try playground previews a pasted link without saving", async ({ page }) => {
  await page.goto("/try");
  await page.getByPlaceholder("https://www.figma.com/proto/…").fill("https://www.figma.com/design/KEY/X?node-id=1-2");
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.getByText("Đây là link thiết kế. Mở Present trong Figma rồi bấm Copy link.")).toBeVisible();

  await page.getByPlaceholder("https://www.figma.com/proto/…").fill(PHONE_LINK);
  await page.getByRole("button", { name: "Import" }).click();
  await expect(page.locator(`iframe[src*="embed.figma.com/proto/${FILE_KEY}"]`)).toBeAttached();
});

test("an unknown or malformed Demo Link is a 404", async ({ request }) => {
  for (const path of ["/khong-ton-tai", "/AB"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
  }
});
