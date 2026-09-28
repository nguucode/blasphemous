import Link from "next/link";
import type { ReactNode } from "react";
import { SITE } from "@/lib/site";

// Shared shell for /privacy and /terms: plain reading page in the stage style.
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-stage font-display text-ink antialiased">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4 md:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-3">
          <span className="text-[21px] font-semibold tracking-[-0.02em]">Blasphemous</span>
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] font-medium tracking-wide text-ink-secondary uppercase">Beta</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16 md:px-8">
        <h1 className="text-[40px] leading-tight font-semibold tracking-[-0.015em]">{title}</h1>
        <p className="mt-2 text-[13px] text-ink-secondary">Cập nhật {updated}</p>
        <div className="mt-10 flex max-w-[65ch] flex-col gap-8 text-[17px] leading-relaxed tracking-[-0.012em] text-ink-secondary [&_a]:text-link [&_a:hover]:underline [&_h2]:mb-2 [&_h2]:text-[21px] [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
        <p className="mt-12 text-[13px] text-ink-secondary">
          Câu hỏi: <a href={`mailto:${SITE.contactEmail}`} className="text-link hover:underline">{SITE.contactEmail}</a> ·{" "}
          <Link href="/privacy" className="text-link hover:underline">Quyền riêng tư</Link> ·{" "}
          <Link href="/terms" className="text-link hover:underline">Điều khoản</Link>
        </p>
      </main>
    </div>
  );
}
