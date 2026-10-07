import Link from "next/link";
import { moreDemosMailto } from "@/lib/site";
import { connection } from "next/server";
import { getDb } from "@/db";
import { listDemos } from "@/db/repo";
import { DEMO_LIMIT, demoBase, requireAccount } from "@/lib/session";
import { DemoEditor } from "../_components/demo-editor";

export default async function NewDemo() {
  await connection();
  const designer = await requireAccount("/app/new");

  // Spec 8.3: arriving here with no free slot shows the limit message instead of the form.
  if ((await listDemos(getDb(), designer)).length >= DEMO_LIMIT) {
    return (
      <div className="flex max-w-xl animate-rise flex-col gap-4 rounded-[28px] bg-stage-raised p-8 md:p-12">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Bạn đã có {DEMO_LIMIT} Demo.</h1>
        <p className="text-[17px] leading-relaxed text-ink-secondary">
          Mỗi tài khoản tạo được {DEMO_LIMIT} Demo. Sửa Demo hiện có, hoặc xóa một Demo để tạo mới.
        </p>
        <p className="flex flex-wrap gap-x-6">
          <Link href="/app" className="min-h-11 content-center text-link hover:underline">Xem Demo của bạn ›</Link>
          <a href={moreDemosMailto} className="min-h-11 content-center text-link hover:underline">
            Cần thêm? Báo cho mình ›
          </a>
        </p>
      </div>
    );
  }
  return <DemoEditor demoBase={await demoBase()} />;
}
