import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDesigner } from "@/lib/session";
import { signOut } from "./sign-out";

export const metadata: Metadata = { title: "Demo của bạn · Blasphemous", robots: { index: false } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const designer = await getDesigner();
  if (!designer) redirect("/login?next=/app");

  return (
    <div className="min-h-[100dvh] bg-stage font-display text-ink antialiased">
      <header className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link href="/app" className="flex min-h-11 items-center gap-3">
          <span className="text-[21px] font-semibold tracking-[-0.02em]">Blasphemous</span>
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] font-medium tracking-wide text-ink-secondary uppercase">Beta</span>
        </Link>
        <form action={signOut} className="flex min-w-0 items-center gap-4 text-[13px]">
          <span className="truncate text-ink-secondary">{designer.email}</span>
          <button type="submit" className="min-h-11 shrink-0 cursor-pointer text-link hover:underline focus-visible:outline-2 focus-visible:outline-link">
            Đăng xuất
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-10 md:px-8">{children}</main>
    </div>
  );
}
