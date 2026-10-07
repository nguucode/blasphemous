import { getDb } from "@/db";
import { findPublishedMedia } from "@/db/repo";

// Brand images of a published Demo (spec 12). They live in the row as data URLs; this turns them
// back into files the browser can cache. The ?v= version in the URL changes with every save.
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[id]/[kind]">) {
  const { id, kind } = await ctx.params;
  if (kind !== "logo" && kind !== "background") return new Response(null, { status: 404 });
  const url = await findPublishedMedia(getDb(), id, kind);
  const m = url && /^data:([a-z+/]+);base64,(.*)$/.exec(url);
  if (!m) return new Response(null, { status: 404 });
  return new Response(Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)), {
    headers: {
      "Content-Type": m[1],
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // An SVG opened on its own must not run scripts on our origin.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
