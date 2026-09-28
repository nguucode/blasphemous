import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { LegalPage } from "../_legal/legal-page";

export const metadata: Metadata = { title: "Điều khoản · Blasphemous" };

// Spec 8.8. Plain terms for a free Beta; not legal advice.
export default function Terms() {
  return (
    <LegalPage title="Điều khoản" updated="28/09/2026">
      <section>
        <p>
          Blasphemous giúp bạn trình chiếu prototype Figma cho khách bằng một link. Dùng Blasphemous nghĩa là bạn đồng ý với các
          điều dưới đây.
        </p>
      </section>

      <section>
        <h2>Beta và miễn phí</h2>
        <ul>
          <li>Blasphemous đang ở giai đoạn Beta và miễn phí.</li>
          <li>Giới hạn số Demo, tính năng và giá có thể thay đổi. Thay đổi lớn sẽ được báo trên trang này.</li>
          <li>
            Dịch vụ được cung cấp như hiện có, chưa có cam kết thời gian hoạt động. Hãy giữ file Figma gốc: Blasphemous chỉ trình
            chiếu, không phải nơi lưu thiết kế của bạn.
          </li>
        </ul>
      </section>

      <section>
        <h2>Nội dung của bạn</h2>
        <ul>
          <li>
            Bạn chịu trách nhiệm về prototype mình chia sẻ, và phải có quyền chia sẻ nó (ví dụ khách đã đồng ý cho xem bản thiết kế).
          </li>
          <li>
            Chỉ dùng prototype đã bật “Anyone with the link can view” trong Figma. Ai có Demo Link đều xem được Demo đang công khai.
          </li>
          <li>
            Không dùng Blasphemous để chia sẻ nội dung vi phạm pháp luật, lừa đảo hay xâm phạm quyền của người khác. Demo như vậy có
            thể bị ẩn hoặc xóa mà không báo trước.
          </li>
        </ul>
      </section>

      <section>
        <h2>Đường dẫn</h2>
        <p>
          Mỗi đường dẫn chỉ thuộc về một Demo và không bao giờ được cấp lại cho người khác, kể cả khi Demo đã bị xóa. Đổi đường
          dẫn thì link cũ vẫn tự chuyển về Demo đó.
        </p>
      </section>

      <section>
        <h2>Không liên kết</h2>
        <p>
          Blasphemous không liên kết với Figma. Figma là thương hiệu của Figma, Inc. Khung iPhone dùng mô hình 3D “iPhone 17 Pro
          Max” của Taufiq K theo giấy phép CC BY 4.0; Blasphemous không liên kết với Apple.
        </p>
      </section>

      <section>
        <h2>Liên hệ</h2>
        <p>
          Blasphemous là sản phẩm cá nhân của {SITE.maker}. Mọi câu hỏi gửi về{" "}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
