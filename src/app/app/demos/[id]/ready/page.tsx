import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db";
import { findOwnedDemo } from "@/db/repo";
import { demoBase, requireDesigner } from "@/lib/session";
import { DemoReady } from "../../../_components/demo-ready";

export default async function Ready({ params }: PageProps<"/app/demos/[id]/ready">) {
  await connection();
  const { id } = await params;
  const designer = await requireDesigner(`/app/demos/${id}`);
  const demo = await findOwnedDemo(getDb(), designer, id);
  if (!demo) notFound();
  return <DemoReady slug={demo.slug} name={demo.name} demoBase={await demoBase()} />;
}
