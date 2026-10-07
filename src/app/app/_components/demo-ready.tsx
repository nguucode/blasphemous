import Link from "next/link";
import { demoUrl, displayUrl } from "@/lib/demo-url";
import { CopyButton } from "./copy-button";

// Success screen after creating a Demo (spec 8.5).
export function DemoReady({ slug, name, demoBase }: { slug: string; name: string; demoBase: string }) {
  const url = demoUrl(demoBase, slug);
  return (
    <div className="mx-auto flex max-w-2xl animate-rise flex-col items-center py-16 text-center">
      <p className="text-[17px] text-ink-secondary">“{name.trim()}” đã sẵn sàng.</p>
      <h1 className="mt-2 text-[40px] leading-tight font-semibold tracking-[-0.015em] md:text-[56px]">Gửi link này cho khách.</h1>
      <p className="mt-8 rounded-[20px] bg-stage-raised px-6 py-4 font-mono text-[19px] break-all text-ink md:text-[24px]">{displayUrl(demoBase, slug)}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <CopyButton text={url} className="min-h-11 rounded-full bg-cta px-6 text-[17px] text-white hover:bg-cta-hover active:scale-[0.97]" />
        <a href={url} target="_blank" rel="noopener" className="min-h-11 content-center text-[17px] text-link hover:underline">
          Mở trang khách xem ›
        </a>
        <Link href="/app" className="min-h-11 content-center text-[17px] text-link hover:underline">
          Sửa Demo
        </Link>
      </div>
    </div>
  );
}
