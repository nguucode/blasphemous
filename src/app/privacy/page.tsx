import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { LegalPage } from "../_legal/legal-page";

export const metadata: Metadata = { title: "Quyền riêng tư · Blasphemous" };

// Spec 8.8. Keep in step with what the app really stores (src/db/schema.ts) and where it runs.
export default function Privacy() {
  return (
    <LegalPage title="Quyền riêng tư" updated="28/09/2026">
      <section>
        <p>
          Blasphemous là một sản phẩm cá nhân của {SITE.maker}, đang ở giai đoạn Beta. Trang này nói rõ Blasphemous lưu gì, để
          làm gì, và bạn làm gì được với dữ liệu đó.
        </p>
      </section>

      <section>
        <h2>Blasphemous lưu gì</h2>
        <p>Khi bạn tạo một Demo, Blasphemous lưu:</p>
        <ul>
          <li>Tên Demo, đường dẫn (slug) và màu nền bạn chọn.</li>
          <li>
            Mã file Figma và mã điểm bắt đầu của từng thiết bị, lấy từ link prototype bạn dán. Blasphemous không lưu nguyên link,
            không đọc nội dung file Figma.
          </li>
          <li>Trạng thái Công khai / Ẩn, thời điểm tạo, sửa, xóa.</li>
          <li>
            Một mã người dùng ẩn danh. Hiện chưa cần tài khoản: lần lưu đầu tiên tạo một tài khoản ẩn danh không có email, gắn với
            trình duyệt của bạn bằng cookie đăng nhập.
          </li>
        </ul>
        <p>Nếu sau này bạn đăng nhập bằng Google hoặc email, Blasphemous lưu thêm địa chỉ email đó.</p>
      </section>

      <section>
        <h2>Cookie</h2>
        <p>
          Blasphemous chỉ dùng cookie đăng nhập của Supabase, để nhận ra trình duyệt đã tạo Demo và cho phép sửa lại. Không có
          cookie quảng cáo, không có công cụ phân tích hay theo dõi. Người xem Demo Link không nhận cookie nào của Blasphemous.
        </p>
      </section>

      <section>
        <h2>Ai xử lý dữ liệu</h2>
        <ul>
          <li>
            <strong>Supabase</strong> lưu cơ sở dữ liệu và phiên đăng nhập, máy chủ ở Seoul (ap-northeast-2).
          </li>
          <li>
            <strong>Figma</strong> hiển thị prototype trong khung nhúng. Khi xem một Demo, trình duyệt tải khung đó trực tiếp từ
            Figma, theo chính sách quyền riêng tư của Figma.
          </li>
          <li>
            <strong>Vercel</strong> sẽ chạy ứng dụng khi Blasphemous được đưa lên mạng.
          </li>
        </ul>
        <p>Blasphemous không bán hay chia sẻ dữ liệu cho bên nào khác.</p>
      </section>

      <section>
        <h2>Xóa dữ liệu</h2>
        <p>
          Bạn xóa được Demo của mình trong trang sửa Demo. Sau khi xóa, khách mở link sẽ thấy “không khả dụng”. Bản ghi của Demo
          vẫn được giữ lại, vì đường dẫn đó không bao giờ được cấp cho người khác (để link cũ không trỏ nhầm sang Demo của người
          lạ).
        </p>
        <p>
          Muốn xóa hẳn mọi dữ liệu, gửi email tới <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> kèm đường dẫn
          Demo.
        </p>
        <p>
          Nếu bạn xóa dữ liệu trình duyệt, cookie đăng nhập mất theo: Demo và link vẫn còn, nhưng bạn không sửa được nữa. Email
          cho Blasphemous nếu cần lấy lại quyền sửa.
        </p>
      </section>
    </LegalPage>
  );
}
