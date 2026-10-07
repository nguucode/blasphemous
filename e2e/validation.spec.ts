import { expect, test } from "@playwright/test";
import { DESKTOP_FIELD, OTHER_FILE_LINK, PHONE_FIELD, PHONE_LINK, createDemo } from "./helpers";

// Spec §8.4: errors show on save (focus on the first one) and while typing.
test("saving an empty form opens Demo settings on the first error and shows the rest", async ({ page }) => {
  await page.goto("/app/new");
  await page.getByRole("button", { name: "Tạo Demo", exact: true }).click();
  await expect(page.getByText("Nhập tên Demo.")).toBeVisible();
  await expect(page.getByText(/Đường dẫn dài 3–48 ký tự/)).toBeVisible();
  await expect(page.getByText("Dán link prototype cho thiết bị này.")).toBeVisible();
  await expect(page.getByText(/Xác nhận file đã bật/)).toBeVisible();
  await expect(page.getByLabel("Tên Demo")).toBeFocused();
  await expect(page).toHaveURL(/\/app\/new$/);
});

test("design links, links from two files and reserved slugs are refused", async ({ page }) => {
  await page.goto("/app/new");
  await page.getByLabel(PHONE_FIELD).fill("https://www.figma.com/design/KEY/X?node-id=1-2");
  await page.getByLabel(PHONE_FIELD).blur();
  await expect(page.getByText("Đây là link thiết kế. Mở Present trong Figma rồi bấm Copy link.")).toBeVisible();

  await page.getByLabel(PHONE_FIELD).fill(PHONE_LINK);
  await page.getByLabel(DESKTOP_FIELD).fill(OTHER_FILE_LINK); // checked even while Desktop is off
  await page.getByLabel(DESKTOP_FIELD).blur();
  await expect(page.getByText("Các link phải thuộc cùng một file Figma.")).toHaveCount(2);

  await page.getByRole("button", { name: "Cài đặt Demo" }).click();
  await page.getByLabel("Demo Link").fill("app");
  await page.getByLabel("Demo Link").blur();
  await expect(page.getByText(/dành riêng cho hệ thống/)).toBeVisible();
});

test("a slug someone already has is refused while typing", async ({ page, browser }) => {
  await createDemo(page, { name: "Đã có chủ", slug: "da-co-chu" });

  const other = await browser.newContext();
  const form = await other.newPage();
  await form.goto("/app/new");
  await form.getByRole("button", { name: "Cài đặt Demo" }).click();
  await form.getByLabel("Demo Link").fill("da-co-chu");
  await form.getByLabel("Demo Link").blur();
  await expect(form.getByText("Đường dẫn này đã có người dùng.")).toBeVisible();
  await other.close();
});
