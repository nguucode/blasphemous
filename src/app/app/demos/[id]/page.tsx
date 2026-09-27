import { notFound } from "next/navigation";
import { connection } from "next/server";
import { listDemos } from "@/lib/demo-store";
import { readState } from "@/lib/dev-db";
import { demoBase, getDesigner } from "@/lib/session";
import { DemoEditor } from "../../_components/demo-editor";

const protoLink = (fileKey: string, nodeId?: string) =>
  nodeId ? `https://www.figma.com/proto/${fileKey}/?node-id=${nodeId.replaceAll(":", "-")}&starting-point-node-id=${encodeURIComponent(nodeId)}` : "";

export default async function EditDemo({ params }: PageProps<"/app/demos/[id]">) {
  await connection();
  const { id } = await params;
  const designer = (await getDesigner())!;
  // Only the owner's own, not-deleted Demos; anything else is a 404, never a 403 (spec 7.5).
  const d = listDemos(readState(), designer).find((x) => x.id === id);
  if (!d) notFound();

  return (
    <DemoEditor
      demoBase={await demoBase()}
      demo={{
        id: d.id,
        name: d.name,
        slug: d.slug,
        links: { phone: protoLink(d.fileKey, d.nodeIds.phone), tablet: protoLink(d.fileKey, d.nodeIds.tablet), desktop: protoLink(d.fileKey, d.nodeIds.desktop) },
        backgroundColor: d.backgroundColor,
        responsiveDesktop: d.responsiveDesktop,
        isPublished: d.isPublished,
      }}
    />
  );
}
