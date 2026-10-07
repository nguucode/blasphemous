import { expect, type Page } from "@playwright/test";

// The sample prototype used across the app (public Figma Community file).
export const FILE_KEY = "k0piuu0Zxvnmz3rpCaGLfa";
export const PHONE_LINK = `https://www.figma.com/proto/${FILE_KEY}/Live-Chat?node-id=3-10&starting-point-node-id=3%3A10`;
export const DESKTOP_LINK = `https://www.figma.com/proto/${FILE_KEY}/Live-Chat?node-id=5-1`;
export const OTHER_FILE_LINK = "https://www.figma.com/proto/AnotherFileKey123/X?node-id=1-2";

export const PHONE_FIELD = "Link prototype Figma cho Mobile";
export const DESKTOP_FIELD = "Link prototype Figma cho Desktop";

// Name, slug and the public-link confirmation live in the "Cài đặt Demo" popover.
export async function fillSettings(page: Page, { name, slug, confirm = true }: { name?: string; slug?: string; confirm?: boolean }) {
  await page.getByRole("button", { name: "Cài đặt Demo" }).click();
  if (name !== undefined) await page.getByLabel("Tên Demo").fill(name);
  if (slug) await page.getByLabel("Demo Link").fill(slug);
  if (confirm) await page.getByLabel(/Anyone with the link can view/).check();
  await page.getByRole("button", { name: "Xong" }).click();
}

// Creating a Demo needs an account: the first visit to /app/new goes through /login, where the fake
// sign-in (E2E_FAKE_AUTH) stands in for Google and comes straight back.
export async function openNewDemo(page: Page) {
  await page.goto("/app/new");
  if (new URL(page.url()).pathname === "/login") await page.getByRole("button", { name: "Tiếp tục với Google" }).click();
  await expect(page).toHaveURL(/\/app\/new$/);
}

// Fill the create screen the way a person does and save. Returns the Demo's id from the success URL.
export async function createDemo(
  page: Page,
  { name, slug, phone = PHONE_LINK, desktop }: { name: string; slug?: string; phone?: string; desktop?: string },
) {
  await openNewDemo(page);
  await fillSettings(page, { name, slug });
  await page.getByLabel(PHONE_FIELD).fill(phone);
  if (desktop) {
    await page.getByRole("checkbox", { name: "Desktop" }).check();
    await page.getByLabel(DESKTOP_FIELD).fill(desktop);
  }
  await page.getByRole("button", { name: "Tạo Demo", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/demos\/[0-9a-f-]{36}\/ready$/);
  return page.url().match(/demos\/([0-9a-f-]{36})/)![1];
}
