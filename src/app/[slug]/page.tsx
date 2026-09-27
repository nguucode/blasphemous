import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedDemo } from "@/lib/demos";
import { isSlugFormat } from "@/lib/slug";
import { Viewer } from "./viewer";

// Viewer page, spec 8.6. Served at bls.to/<slug>; the proxy moves blasphemous.app/<slug> there.

async function load(params: PageProps<"/[slug]">["params"]) {
  const { slug } = await params;
  return isSlugFormat(slug) ? getPublishedDemo(slug) : undefined;
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const demo = await load(params);
  return demo ? { title: demo.name, openGraph: { title: demo.name } } : { title: "Demo không khả dụng" };
}

export default async function ViewerPage({ params }: PageProps<"/[slug]">) {
  const demo = await load(params);
  // Unknown, hidden and deleted Demos all look the same and return 404 (spec 8.7).
  if (!demo) notFound();
  return <Viewer demo={demo} />;
}
