import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDesigner } from "@/lib/session";

export const metadata: Metadata = { title: "Demo của bạn · Blasphemous", robots: { index: false } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const designer = await getDesigner();
  if (!designer) notFound(); // no sign-in yet (spec 8.2): the app area stays closed outside development

  return (
    <div className="min-h-[100dvh] bg-stage font-display text-ink antialiased">
      <header className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-4 md:px-8">
        <Link href="/app" className="flex min-h-11 items-center gap-3">
          <span className="text-[21px] font-semibold tracking-[-0.02em]">Blasphemous</span>
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] font-medium tracking-wide text-ink-secondary uppercase">Beta</span>
        </Link>
        <span className="truncate text-[13px] text-ink-secondary">{designer.email}</span>
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-10 md:px-8">{children}</main>
    </div>
  );
}
