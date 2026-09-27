import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db";
import { demoLimit, listDemos } from "@/db/repo";
import { demoBase, getDesigner, limitFor } from "@/lib/session";
import { DemoEditor } from "../_components/demo-editor";

export default async function NewDemo() {
  await connection();
  // Open to everyone; the anonymous Designer is created on the first save (actions.ts).
  const designer = await getDesigner();
  const { limit: baseLimit, unlimitedEmails } = limitFor(designer);
  const limit = designer ? demoLimit(designer, baseLimit, unlimitedEmails) : baseLimit;

  // Spec 8.3: arriving here with no free slot shows the limit message instead of the form.
  if (designer && (await listDemos(getDb(), designer)).length >= limit) {
    return (
      <div className="flex max-w-xl animate-rise flex-col gap-4 rounded-[28px] bg-stage-raised p-8 md:p-12">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Bạn đã có {limit} Demo.</h1>
        <p className="text-[17px] leading-relaxed text-ink-secondary">
          Mỗi trình duyệt tạo được {limit} Demo. Sửa Demo hiện có, hoặc xóa nó để tạo mới.
        </p>
        <p className="flex flex-wrap gap-x-6">
          <Link href="/app" className="min-h-11 content-center text-link hover:underline">Xem Demo của bạn ›</Link>
          <a href="mailto:hello@blasphemous.app?subject=C%E1%BA%A7n%20th%C3%AAm%20Demo" className="min-h-11 content-center text-link hover:underline">
            Cần thêm? Báo cho mình ›
          </a>
        </p>
      </div>
    );
  }
  return <DemoEditor demoBase={await demoBase()} />;
}
