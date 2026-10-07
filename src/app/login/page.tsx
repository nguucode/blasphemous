import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { getDesigner } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Đăng nhập · Blasphemous", robots: { index: false } };

// Spec 8.2.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const target = safeNext(typeof next === "string" ? next : undefined);
  const designer = await getDesigner();
  if (designer && !designer.isAnonymous) redirect(target);

  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-stage px-4 font-display text-ink antialiased">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 40% 45% at 50% 40%, rgb(255 255 255 / 0.07), transparent 72%)" }}
      />
      <LoginForm next={target} error={error === "callback" || error === "google" ? error : undefined} anonymous={!!designer} />
    </main>
  );
}
