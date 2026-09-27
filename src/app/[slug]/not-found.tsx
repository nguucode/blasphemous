// Spec 8.7: same page for unknown, hidden and deleted Demos; never says which.
export default function DemoNotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-stage px-6 font-display text-ink antialiased">
      <div className="max-w-md animate-rise text-center">
        <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.015em] md:text-[40px]">Demo này không còn khả dụng.</h1>
        <p className="mt-4 text-[17px] leading-relaxed tracking-[-0.022em] text-ink-secondary">
          Đường dẫn có thể đã bị đổi hoặc Demo đã được tắt. Hãy hỏi lại người đã gửi link cho bạn.
        </p>
      </div>
    </main>
  );
}
