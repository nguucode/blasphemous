import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { SampleDemo } from "./_home/sample-demo";

export const metadata: Metadata = {
  title: "Blasphemous · Gửi khách một link",
  description: "Trình chiếu prototype Figma cho khách bằng một link. Khách không cần tài khoản Figma.",
};

// Homepage, spec 8.1 variant D: hero beside a live sample Demo.
export default function Home() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-stage font-display text-ink antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 32% 50% at 70% 48%, rgb(255 255 255 / 0.09), transparent 72%)" }}
      />

      <header className="relative mx-auto flex w-full max-w-[1400px] animate-rise items-center gap-3 px-4 py-4 md:px-8">
        <span className="text-[21px] font-semibold tracking-[-0.02em]">Blasphemous</span>
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] font-medium tracking-wide text-ink-secondary uppercase">Beta</span>
        <a href={SITE.makerUrl} className="ml-auto min-h-11 content-center text-[13px] text-ink-secondary hover:text-ink">
          by {SITE.maker}
        </a>
      </header>

      <main className="relative mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 items-center gap-10 px-4 pb-8 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="max-w-xl">
          <h1 className="animate-rise text-[40px] leading-[1.08] font-semibold tracking-[-0.02em] [animation-delay:100ms] md:text-[56px] xl:text-[64px]">
            Gửi khách một link.
            <span className="block text-ink-secondary">Họ thấy sản phẩm, không thấy Figma.</span>
          </h1>
          <p className="mt-6 max-w-[46ch] animate-rise text-[19px] leading-[1.45] tracking-[-0.012em] text-ink-secondary [animation-delay:200ms] md:text-[21px]">
            Dán link prototype cho phone, tablet, desktop. Khách mở một đường dẫn gọn, tự bấm thử, không cần tài khoản Figma.
          </p>
          <div className="mt-8 flex animate-rise flex-wrap items-center gap-x-6 gap-y-3 [animation-delay:300ms]">
            {/* No sign-in for now: straight to the create form (2026-09-27). */}
            <Link
              href="/app/new"
              className="inline-flex min-h-11 items-center rounded-full bg-cta px-6 text-[17px] text-white transition-transform duration-150 hover:bg-cta-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link active:scale-[0.97]"
            >
              Tạo Demo miễn phí
            </Link>
            <Link href="/try" className="min-h-11 content-center text-[17px] text-link hover:underline focus-visible:outline-2 focus-visible:outline-link">
              Thử với prototype của bạn ›
            </Link>
          </div>
        </section>

        <section aria-label="Demo mẫu" className="h-[72dvh] min-h-[520px] animate-rise [animation-delay:250ms] lg:h-[calc(100dvh-9rem)]">
          <SampleDemo />
        </section>
      </main>

      <footer className="relative mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-white/10 px-4 py-5 text-xs text-ink-secondary md:px-8">
        <p>Not affiliated with Figma. Figma is a trademark of Figma, Inc.</p>
        <p className="flex flex-wrap items-center gap-x-5">
          <a href={SITE.makerUrl} className="min-h-11 content-center hover:text-ink hover:underline">
            Một sản phẩm của {SITE.maker}
          </a>
          <a href={`mailto:${SITE.contactEmail}`} className="min-h-11 content-center hover:text-ink hover:underline">
            {SITE.contactEmail}
          </a>
        </p>
      </footer>
    </div>
  );
}
