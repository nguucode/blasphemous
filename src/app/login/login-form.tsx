"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";

const callbackUrl = (next: string) => `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

export function LoginForm({ next, failed }: { next: string; failed: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState(failed ? "Link đăng nhập đã hết hạn hoặc đã dùng. Thử lại nhé." : "");

  const google = async () => {
    setError("");
    const { error } = await createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(next) } });
    if (error) setError("Chưa đăng nhập được bằng Google. Thử lại hoặc dùng email.");
  };

  const magicLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Nhập một địa chỉ email hợp lệ.");
    setError("");
    setState("sending");
    const { error } = await createClient().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callbackUrl(next) } });
    if (error) {
      setState("idle");
      return setError(error.status === 429 ? "Gửi quá nhiều lần. Đợi một lát rồi thử lại." : "Chưa gửi được email. Thử lại sau.");
    }
    setState("sent");
  };

  if (state === "sent") {
    return (
      <div className="relative w-full max-w-sm animate-rise rounded-[28px] bg-stage-raised p-8 text-center">
        <h1 className="text-[24px] font-semibold tracking-[-0.015em]">Kiểm tra hộp thư.</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
          Đã gửi link đăng nhập tới <span className="text-ink">{email.trim()}</span>. Kiểm tra cả thư mục Spam.
        </p>
        <button type="button" onClick={() => setState("idle")} className="mt-6 min-h-11 cursor-pointer text-[15px] text-link hover:underline">
          Dùng email khác
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex w-full max-w-sm animate-rise flex-col gap-4 rounded-[28px] bg-stage-raised p-8">
      <div>
        <p className="text-[21px] font-semibold tracking-[-0.02em]">Blasphemous</p>
        <p className="mt-1 text-[15px] text-ink-secondary">Trình chiếu prototype Figma cho khách bằng một link.</p>
      </div>

      <button
        type="button"
        onClick={google}
        className="min-h-11 cursor-pointer rounded-full bg-ink text-[15px] font-medium text-stage transition-transform duration-150 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link active:scale-[0.98]"
      >
        Tiếp tục với Google
      </button>

      <div className="flex items-center gap-3 text-xs text-ink-secondary" aria-hidden>
        <span className="h-px flex-1 bg-white/10" />
        hoặc
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form onSubmit={magicLink} noValidate className="flex flex-col gap-2">
        <label htmlFor="email" className="text-[13px] font-semibold">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ban@studio.vn"
          aria-invalid={!!error}
          aria-describedby={error ? "login-error" : undefined}
          className="min-h-11 rounded-xl bg-white/8 px-4 text-[15px] text-ink placeholder:text-ink-secondary focus-visible:outline-2 focus-visible:outline-link aria-invalid:outline-2 aria-invalid:outline-danger-on-stage"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="mt-1 min-h-11 cursor-pointer rounded-full bg-cta text-[15px] text-white transition-transform duration-150 hover:bg-cta-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
        >
          {state === "sending" ? "Đang gửi…" : "Gửi magic link"}
        </button>
      </form>

      {error && (
        <p id="login-error" role="alert" className="text-[13px] text-danger-on-stage">
          {error}
        </p>
      )}

      {/* ponytail: plain text until /terms and /privacy exist (launch checklist, spec 9). */}
      <p className="text-xs leading-relaxed text-ink-secondary">Tiếp tục nghĩa là bạn đồng ý với Điều khoản và Chính sách quyền riêng tư.</p>
    </div>
  );
}
