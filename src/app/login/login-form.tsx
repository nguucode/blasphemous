"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { signInWithGoogle } from "./actions";

const ERRORS = {
  callback: "Chưa đăng nhập được. Thử lại nhé.",
  google: "Chưa kết nối được Google. Thử lại sau ít phút.",
};

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-11 cursor-pointer rounded-full bg-ink text-[15px] font-medium text-stage transition-transform duration-150 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Đang chuyển tới Google…" : "Tiếp tục với Google"}
    </button>
  );
}

export function LoginForm({ next, error, anonymous }: { next: string; error?: keyof typeof ERRORS; anonymous: boolean }) {
  return (
    <form action={signInWithGoogle.bind(null, next)} className="relative flex w-full max-w-sm animate-rise flex-col gap-4 rounded-[28px] bg-stage-raised p-8">
      <div>
        <p className="text-[21px] font-semibold tracking-[-0.02em]">Blasphemous</p>
        <p className="mt-1 text-[15px] text-ink-secondary">
          {anonymous
            ? "Đăng nhập để giữ Demo bạn đã tạo trên trình duyệt này và tạo thêm Demo mới."
            : "Đăng nhập để tạo và quản lý Demo trên mọi máy. Khách xem Demo không cần tài khoản."}
        </p>
      </div>

      <GoogleButton />

      {error && (
        <p role="alert" className="text-[13px] text-danger-on-stage">
          {ERRORS[error]}
        </p>
      )}

      <p className="text-xs leading-relaxed text-ink-secondary">
        Tiếp tục nghĩa là bạn đồng ý với{" "}
        <Link href="/terms" className="text-link hover:underline">
          Điều khoản
        </Link>{" "}
        và{" "}
        <Link href="/privacy" className="text-link hover:underline">
          Chính sách quyền riêng tư
        </Link>
        .
      </p>
    </form>
  );
}
