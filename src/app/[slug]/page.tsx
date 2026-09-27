import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { lookupDemo } from "@/lib/demos";
import { isSlugFormat } from "@/lib/slug";
import { Viewer } from "./viewer";

// Viewer page, spec 8.6. Served at bls.to/<slug>; the proxy moves blasphemous.app/<slug> there.

async function load(params: PageProps<"/[slug]">["params"]) {
  await connection();
  const { slug } = await params;
  return isSlugFormat(slug) ? lookupDemo(slug) : undefined;
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const found = await load(params);
  return found && "demo" in found ? { title: found.demo.name, openGraph: { title: found.demo.name } } : { title: "Demo không khả dụng" };
}

export default async function ViewerPage({ params }: PageProps<"/[slug]">) {
  const found = await load(params);
  // Unknown, hidden and deleted Demos all look the same and return 404 (spec 8.7).
  if (!found) notFound();
  // An old slug keeps working forever (spec 7.3).
  if ("redirectTo" in found) permanentRedirect(`/${found.redirectTo}`);
  return <Viewer demo={found.demo} />;
}
