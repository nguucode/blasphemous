import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db";
import { deviceLinks, demoLimit, listDemos } from "@/db/repo";
import { demoBase, limitFor, requireDesigner } from "@/lib/session";
import { DemoLinkCell } from "./_components/copy-button";

// Dashboard, spec 8.3.
const DEVICE_LABEL = { phone: "Phone", tablet: "Tablet", desktop: "Desktop" } as const;
const cta =
  "inline-flex min-h-11 items-center rounded-full bg-cta px-5 text-[15px] text-white transition-transform duration-150 hover:bg-cta-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link active:scale-[0.97]";

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  await connection();
  const designer = await requireDesigner();
  const demos = await listDemos(getDb(), designer);
  const { limit: baseLimit, unlimitedEmails } = limitFor(designer);
  const limit = demoLimit(designer, baseLimit, unlimitedEmails);
  const full = demos.length >= limit;
  const base = await demoBase();
  const { saved } = await searchParams;

  return (
    <div className="animate-rise">
      {saved && <p className="mb-6 rounded-[18px] bg-stage-raised px-5 py-3 text-[15px] text-ink" role="status">Đã lưu.</p>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[40px] leading-tight font-semibold tracking-[-0.015em]">Demo của bạn</h1>
        <div className="flex flex-wrap items-center gap-4">
          {Number.isFinite(limit) && (
            <span className="text-[15px] text-ink-secondary">
              {demos.length}/{limit} Demo
            </span>
          )}
          {full ? (
            <span aria-disabled className={`${cta} cursor-not-allowed opacity-40`}>
              + Tạo Demo
            </span>
          ) : (
            demos.length > 0 && (
              <Link href="/app/new" className={cta}>
                + Tạo Demo
              </Link>
            )
          )}
        </div>
      </div>

      {full && (
        <p className="mt-4 text-[15px] text-ink-secondary">
          {designer.isAnonymous ? `Mỗi trình duyệt tạo được ${limit} Demo.` : `Beta giới hạn ${limit} Demo.`} Xóa một Demo để tạo mới.{" "}
          <a href="mailto:hello@blasphemous.app?subject=C%E1%BA%A7n%20th%C3%AAm%20Demo" className="text-link hover:underline">
            Cần thêm? Báo cho mình ›
          </a>
        </p>
      )}

      {demos.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-4 rounded-[28px] bg-stage-raised p-8 md:p-12">
          <h2 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">Chưa có Demo nào.</h2>
          <p className="max-w-[52ch] text-[17px] leading-relaxed text-ink-secondary">
            Dán link prototype Figma cho phone, tablet hoặc desktop, đặt tên và màu nền, rồi gửi một link gọn cho khách.
          </p>
          <Link href="/app/new" className={`${cta} mt-2`}>
            Tạo Demo đầu tiên
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-[28px] bg-stage-raised">
          <table className="w-full min-w-[720px] text-left text-[15px]">
            <thead className="text-[12px] text-ink-secondary">
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 font-medium">Tên</th>
                <th className="px-6 py-4 font-medium">Demo Link</th>
                <th className="px-6 py-4 font-medium">Thiết bị</th>
                <th className="px-6 py-4 font-medium">Trạng thái</th>
                <th className="px-6 py-4">
                  <span className="sr-only">Sửa</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {demos.map((d) => (
                <tr key={d.id}>
                  <td className="px-6 py-3 font-semibold">{d.name}</td>
                  <td className="px-6 py-1">
                    <DemoLinkCell demoBase={base} slug={d.slug} />
                  </td>
                  <td className="px-6 py-3 text-ink-secondary">
                    {(["phone", "tablet", "desktop"] as const).filter((x) => deviceLinks(d)[x]).map((x) => DEVICE_LABEL[x]).join(" · ")}
                  </td>
                  <td className="px-6 py-3">
                    <span className={d.isPublished ? "text-[#30d158]" : "text-ink-secondary"}>{d.isPublished ? "Công khai" : "Đang ẩn"}</span>
                  </td>
                  <td className="px-6 py-1 text-right">
                    <Link href={`/app/demos/${d.id}`} className="inline-flex min-h-11 items-center text-link hover:underline">
                      Sửa ›
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
