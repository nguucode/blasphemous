import { expect, test } from "@playwright/test";
import { createDemo, openNewDemo } from "./helpers";

// Spec §7.3 and §8.4: renaming keeps the old link, hiding and deleting take the Demo offline,
// and a deleted Demo's slug is never given to someone else.
test("rename, hide and delete a Demo", async ({ page, browser, request }) => {
  const id = await createDemo(page, { name: "Studio Acme", slug: "studio-acme" });

  // Rename: a confirmation, then the old link redirects permanently.
  await page.goto(`/app/demos/${id}`);
  await page.getByRole("button", { name: "Cài đặt Demo" }).click();
  await page.getByLabel("Demo Link").fill("studio-acme-v2");
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("studio-acme-v2");
    return dialog.accept();
  });
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page).toHaveURL(/\/app\?saved=1$/);
  await expect(page.getByRole("status")).toHaveText("Đã lưu.");

  const old = await request.get("/studio-acme", { maxRedirects: 0 });
  expect(old.status()).toBe(308);
  expect(old.headers()["location"]).toMatch(/\/studio-acme-v2$/);
  expect((await request.get("/studio-acme-v2")).status()).toBe(200);

  // Hide: clients get the "no longer available" page.
  await page.goto(`/app/demos/${id}`);
  await page.getByRole("button", { name: "Cài đặt Demo" }).click();
  await page.getByRole("switch").last().click();
  await expect(page.getByRole("switch").last()).toHaveAttribute("aria-checked", "false");
  const hidden = await request.get("/studio-acme-v2");
  expect(hidden.status()).toBe(404);
  expect(await hidden.text()).toContain("Demo này không còn khả dụng.");

  // Delete: gone from the list, and nobody else can take the slug.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Xóa Demo" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Chưa có Demo nào." })).toBeVisible();
  await expect(page.getByText("0/3 Demo")).toBeVisible();
  expect((await request.get("/studio-acme-v2")).status()).toBe(404);

  const other = await browser.newContext();
  const form = await other.newPage();
  await openNewDemo(form);
  await form.getByRole("button", { name: "Cài đặt Demo" }).click();
  await form.getByLabel("Demo Link").fill("studio-acme-v2");
  await form.getByLabel("Demo Link").blur();
  await expect(form.getByText("Đường dẫn này đã có người dùng.")).toBeVisible();
  await other.close();
});
