import "server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { emptyState, type DemoRecord, type DemoState } from "./demo-store";

// ponytail: TEMPORARY storage until Supabase + Drizzle (spec 5, 7.1). One JSON file, read and
// rewritten whole on every change, no locking: fine for one developer, not for real traffic.
// Delete this file and point lib/demos.ts at the database when it exists.
const FILE = join(process.cwd(), ".data", "dev-demos.json");

const LIVE_CHAT = { fileKey: "k0piuu0Zxvnmz3rpCaGLfa", nodeId: "3:10" };
const sample = (over: Partial<DemoRecord>): DemoRecord => ({
  id: "", ownerId: "sample", name: "", slug: "", fileKey: LIVE_CHAT.fileKey, nodeIds: {}, backgroundColor: "#000000",
  responsiveDesktop: false, isPublished: true, createdAt: "2026-09-27T00:00:00.000Z", updatedAt: "2026-09-27T00:00:00.000Z", deletedAt: null,
  ...over,
});
const SEED: DemoState = {
  ...emptyState(),
  demos: [
    sample({ id: "sample-live-chat", name: "Live Chat", slug: "live-chat", nodeIds: { desktop: LIVE_CHAT.nodeId, phone: LIVE_CHAT.nodeId } }),
    sample({
      id: "sample-live-chat-responsive", name: "Live Chat (responsive)", slug: "live-chat-responsive",
      nodeIds: { desktop: LIVE_CHAT.nodeId }, responsiveDesktop: true, backgroundColor: "#1e1b4b",
    }),
  ],
};

export function readState(): DemoState {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as DemoState;
  } catch {
    return SEED; // no file yet (or a read-only deploy): just the sample Demos
  }
}

export function writeState(state: DemoState) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(`${FILE}.tmp`, JSON.stringify(state, null, 2));
  renameSync(`${FILE}.tmp`, FILE);
}
