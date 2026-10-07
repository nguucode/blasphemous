import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db";
import { findOwnedDemo } from "@/db/repo";
import { demoBase, requireDesigner } from "@/lib/session";
import { DEVICES } from "@/lib/devices";
import { DemoEditor, type EditorDemo } from "../../_components/demo-editor";

const protoLink = (fileKey: string, nodeId?: string) =>
  nodeId ? `https://www.figma.com/proto/${fileKey}/?node-id=${nodeId.replaceAll(":", "-")}&starting-point-node-id=${encodeURIComponent(nodeId)}` : "";

export default async function EditDemo({ params }: PageProps<"/app/demos/[id]">) {
  await connection();
  const { id } = await params;
  const designer = await requireDesigner();
  // Only the owner's own, not-deleted Demos; anything else is a 404, never a 403 (spec 7.5).
  const d = await findOwnedDemo(getDb(), designer, id);
  if (!d) notFound();

  return (
    <DemoEditor
      demoBase={await demoBase()}
      demo={{
        id: d.id,
        name: d.name,
        slug: d.slug,
        devices: Object.fromEntries(
          DEVICES.map(({ id: x }) => [x, { ...d.devices[x], link: protoLink(d.fileKey, d.nodeIds[x]) }]),
        ) as EditorDemo["devices"],
        flows: d.flows,
        brandColor: d.brandColor,
        backgroundColor: d.backgroundColor,
        backgroundImage: d.backgroundImage,
        logo: d.logo,
        isPublished: d.isPublished,
      }}
    />
  );
}
