import type { Metadata } from "next";

// A Designer's client work should not show up in search results (spec 8.6), found or not.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DemoLayout({ children }: LayoutProps<"/[slug]">) {
  return children;
}
