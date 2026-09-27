"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DEVICES, DeviceStage, DeviceSwitcher, type Device } from "@/components/device-view";
import { FORM_DEVICES, suggestSlug, validateDemoForm, type DemoForm, type FormErrors, type FormField } from "@/lib/demo-rules";
import { parseFigmaLink } from "@/lib/figma-link";
import { isReservedSlug, isSlugFormat } from "@/lib/slug";
import { isSlugAvailable, publishDemo, removeDemo, saveDemo } from "../actions";
import { CopyButton, demoUrl, displayUrl } from "./copy-button";

// Create and edit screen, spec 8.4: form on the left, a live Viewer preview on the right.

const DEFAULT_BACKGROUND = "#1e1b4b"; // spec 7.1
const LABEL: Record<Device, string> = { phone: "Phone", tablet: "Tablet", desktop: "Desktop" };
const FIELD_ORDER: FormField[] = ["name", "slug", "links", "phone", "tablet", "desktop", "backgroundColor", "confirmedPublic"];
const FIELD_ID: Record<FormField, string> = {
  name: "name", slug: "slug", links: "link-phone", phone: "link-phone", tablet: "link-tablet", desktop: "link-desktop",
  backgroundColor: "background-hex", confirmedPublic: "confirmed-public",
};

const input =
  "min-h-11 w-full rounded-xl bg-white/8 px-4 text-[15px] text-ink placeholder:text-ink-secondary focus-visible:outline-2 focus-visible:outline-link aria-invalid:outline-2 aria-invalid:outline-danger-on-stage";
const label = "text-[13px] font-semibold tracking-[-0.01em] text-ink";

export type EditorDemo = Omit<DemoForm, "isNew" | "confirmedPublic"> & { id: string; isPublished: boolean };

export function DemoEditor({ demo, demoBase }: { demo?: EditorDemo; demoBase: string }) {
  const router = useRouter();
  const isNew = !demo;
  const [form, setForm] = useState<DemoForm>({
    name: demo?.name ?? "",
    slug: demo?.slug ?? "",
    links: demo?.links ?? { phone: "", tablet: "", desktop: "" },
    backgroundColor: demo?.backgroundColor ?? DEFAULT_BACKGROUND,
    responsiveDesktop: demo?.responsiveDesktop ?? false,
    confirmedPublic: false,
    isNew,
  });
  const [slugEdited, setSlugEdited] = useState(!isNew);
  const [touched, setTouched] = useState<Set<FormField>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [takenSlug, setTakenSlug] = useState<string>(); // last slug the server said is taken
  const [serverErrors, setServerErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<string>();
  const [isPublished, setIsPublished] = useState(demo?.isPublished ?? true);

  const set = <K extends keyof DemoForm>(key: K, value: DemoForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors({});
    setMessage(undefined);
  };
  const touch = (f: FormField) => setTouched((t) => new Set(t).add(f));

  // Slug availability, checked on the server while typing (spec 8.4). Unchanged slug of an existing Demo is fine.
  useEffect(() => {
    const slug = form.slug;
    if (!isSlugFormat(slug) || isReservedSlug(slug) || slug === demo?.slug) return;
    const t = setTimeout(() => isSlugAvailable(slug, demo?.id).then((ok) => setTakenSlug(ok ? undefined : slug)), 350);
    return () => clearTimeout(t);
  }, [form.slug, demo?.slug, demo?.id]);
  const slugTaken = takenSlug === form.slug;

  const checked = validateDemoForm(form);
  const errors: FormErrors = { ...(checked.ok ? {} : checked.errors), ...(slugTaken && { slug: "Đường dẫn này đã có người dùng." }), ...serverErrors };
  const shown = (f: FormField) => (submitted || touched.has(f) ? errors[f] : undefined);

  // Preview uses every link that parses, even while other fields are still wrong.
  const links = useMemo(() => {
    const out: Partial<Record<Device, { fileKey: string; nodeId: string }>> = {};
    for (const d of FORM_DEVICES) {
      const p = parseFigmaLink(form.links[d]);
      if (p.ok) out[d] = { fileKey: p.fileKey, nodeId: p.nodeId };
    }
    return out;
  }, [form.links]);
  const previewDevices = FORM_DEVICES.filter((d) => links[d]);
  const [device, setDevice] = useState<Device>("phone");
  const [opened, setOpened] = useState<Set<Device>>(new Set(["phone"]));
  const activeDevice = previewDevices.includes(device) ? device : previewDevices[0];
  const background = /^#[0-9a-f]{6}$/i.test(form.backgroundColor) ? form.backgroundColor : DEFAULT_BACKGROUND;
  const openedWithActive = activeDevice && !opened.has(activeDevice) ? new Set(opened).add(activeDevice) : opened;

  const focusFirstError = (errs: FormErrors) => {
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (first) document.getElementById(FIELD_ID[first])?.focus();
  };

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return focusFirstError(errors);
    if (demo && form.slug !== demo.slug) {
      const ok = confirm(`Đổi đường dẫn thành ${displayUrl(demoBase, form.slug)}? Link cũ ${displayUrl(demoBase, demo.slug)} vẫn tự chuyển về Demo này.`);
      if (!ok) return;
    }
    setSaving(true);
    const r = await saveDemo(form, demo?.id).finally(() => setSaving(false));
    if (!r.ok) {
      setServerErrors(r.errors);
      setMessage(r.message);
      return focusFirstError(r.errors);
    }
    if (isNew) setCreated(r.slug);
    else router.push("/app?saved=1");
  };

  const togglePublished = async () => {
    const next = !isPublished;
    setIsPublished(next);
    if (!(await publishDemo(demo!.id, next))) setIsPublished(!next);
  };

  const remove = async () => {
    const ok = confirm(
      `Xóa Demo “${demo!.name}”? Khách mở ${displayUrl(demoBase, demo!.slug)} sẽ thấy “Demo này không còn khả dụng”, và đường dẫn này sẽ không được cấp cho người khác.`,
    );
    if (ok && (await removeDemo(demo!.id))) router.push("/app");
  };

  if (created) return <Created slug={created} name={form.name} demoBase={demoBase} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex animate-rise flex-col gap-5 rounded-[28px] bg-stage-raised p-6 md:p-8"
      >
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.015em]">{isNew ? "Tạo Demo" : "Sửa Demo"}</h1>

        <Field id="name" label="Tên Demo" error={shown("name")} hint="Khách thấy tên này ở góc trên trang.">
          <input
            id="name"
            value={form.name}
            maxLength={120}
            onChange={(e) => {
              set("name", e.target.value);
              if (!slugEdited) set("slug", suggestSlug(e.target.value));
            }}
            onBlur={() => touch("name")}
            aria-invalid={!!shown("name")}
            placeholder="Ví dụ: Acme App v2"
            className={input}
          />
        </Field>

        <Field id="slug" label="Demo Link" error={shown("slug")} hint={!shown("slug") && form.slug ? displayUrl(demoBase, form.slug) : undefined}>
          <div className="flex items-center rounded-xl bg-white/8 focus-within:outline-2 focus-within:outline-link">
            <span className="pl-4 text-[15px] text-ink-secondary">{displayUrl(demoBase, "")}</span>
            <input
              id="slug"
              value={form.slug}
              onChange={(e) => {
                setSlugEdited(true);
                set("slug", e.target.value.toLowerCase());
              }}
              onBlur={() => touch("slug")}
              aria-invalid={!!shown("slug")}
              placeholder="acme-app"
              className="min-h-11 min-w-0 flex-1 bg-transparent pr-4 text-[15px] text-ink placeholder:text-ink-secondary focus:outline-none"
            />
          </div>
        </Field>

        <fieldset className="flex flex-col gap-3">
          <legend className={label}>Link prototype</legend>
          <p className="-mt-1 text-xs text-ink-secondary">Mỗi thiết bị một link từ Present, Copy link trong Figma. Các link phải cùng một file.</p>
          {FORM_DEVICES.map((d) => {
            const err = shown(d);
            const parsed = parseFigmaLink(form.links[d]);
            return (
              <div key={d} className="flex flex-col gap-1">
                <label htmlFor={`link-${d}`} className="text-xs text-ink-secondary">
                  {LABEL[d]}
                </label>
                <input
                  id={`link-${d}`}
                  value={form.links[d]}
                  onChange={(e) => set("links", { ...form.links, [d]: e.target.value })}
                  onBlur={() => touch(d)}
                  aria-invalid={!!err}
                  placeholder="https://www.figma.com/proto/…"
                  className={input}
                />
                {err ? (
                  <p className="text-xs text-danger-on-stage">{err}</p>
                ) : (
                  parsed.ok && !errors[d] && <p className="text-xs text-[#30d158]">✓ Nhận flow {parsed.nodeId}</p>
                )}
              </div>
            );
          })}
          {shown("links") && <p className="text-xs text-danger-on-stage">{shown("links")}</p>}
        </fieldset>

        {links.desktop && (
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
            <span>
              <span className={label}>Co giãn theo kích thước màn hình</span>
              <span className="block text-xs text-ink-secondary">Chỉ cho Desktop, khi frame dùng auto layout hoặc constraints.</span>
            </span>
            <Switch checked={form.responsiveDesktop} onChange={(v) => set("responsiveDesktop", v)} />
          </label>
        )}

        <Field id="background-hex" label="Màu nền" error={shown("backgroundColor")}>
          <div className="flex gap-2">
            <input
              type="color"
              aria-label="Chọn màu nền"
              value={background}
              onChange={(e) => set("backgroundColor", e.target.value)}
              className="h-11 w-14 cursor-pointer rounded-xl bg-white/8 p-1.5"
            />
            <input
              id="background-hex"
              value={form.backgroundColor}
              onChange={(e) => set("backgroundColor", e.target.value)}
              onBlur={() => touch("backgroundColor")}
              aria-invalid={!!shown("backgroundColor")}
              className={`${input} font-mono`}
            />
          </div>
        </Field>

        {isNew && (
          <div className="flex flex-col gap-1">
            <label className="flex cursor-pointer gap-3 text-[13px] leading-snug text-ink">
              <input
                id="confirmed-public"
                type="checkbox"
                checked={form.confirmedPublic}
                onChange={(e) => set("confirmedPublic", e.target.checked)}
                aria-invalid={!!shown("confirmedPublic")}
                className="mt-0.5 size-5 shrink-0 accent-cta"
              />
              Tôi đã bật “Anyone with the link can view” cho file này trong Figma.
            </label>
            {shown("confirmedPublic") && <p className="pl-8 text-xs text-danger-on-stage">{shown("confirmedPublic")}</p>}
          </div>
        )}

        {message && <p className="rounded-xl bg-danger-on-stage/10 px-4 py-3 text-[13px] text-danger-on-stage">{message}</p>}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 cursor-pointer rounded-full bg-cta px-6 text-[15px] text-white transition-transform duration-150 hover:bg-cta-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : isNew ? "Tạo Demo" : "Lưu"}
          </button>
          <Link href="/app" className="min-h-11 content-center text-[15px] text-link hover:underline">
            Hủy
          </Link>
        </div>

        {demo && (
          <div className="mt-2 flex flex-col gap-4 border-t border-white/10 pt-5">
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
              <span>
                <span className={label}>Công khai</span>
                <span className="block text-xs text-ink-secondary">
                  {isPublished ? "Ai có link đều xem được." : "Khách mở link sẽ thấy “không khả dụng”."}
                </span>
              </span>
              <Switch checked={isPublished} onChange={togglePublished} />
            </label>
            <button
              type="button"
              onClick={remove}
              className="min-h-11 cursor-pointer self-start text-[15px] text-danger-on-stage hover:underline focus-visible:outline-2 focus-visible:outline-link"
            >
              Xóa Demo
            </button>
          </div>
        )}
      </form>

      <section
        aria-label="Xem trước"
        className="relative grid h-[70dvh] min-h-[480px] animate-rise grid-rows-[auto_1fr] overflow-hidden rounded-[28px] [animation-delay:120ms] lg:sticky lg:top-6 lg:h-[calc(100dvh-7.5rem)]"
        style={{ background }}
      >
        <div className="flex items-center justify-between gap-3 p-4">
          <span className="truncate rounded-[14px] bg-glass-strong px-4 py-2 text-[13px] font-semibold backdrop-blur-xl">
            {form.name.trim() || "Xem trước"}
          </span>
          {previewDevices.length > 1 && (
            <DeviceSwitcher
              devices={DEVICES.map((d) => d.id).filter((d) => previewDevices.includes(d))}
              value={activeDevice}
              onChange={(d) => {
                setDevice(d);
                setOpened((s) => new Set(s).add(d));
              }}
            />
          )}
        </div>
        <div className="relative min-h-0 pb-4">
          {activeDevice ? (
            <DeviceStage
              device={activeDevice}
              opened={openedWithActive}
              links={links}
              resetSignal={0}
              emptyText=""
              responsiveDesktop={form.responsiveDesktop}
            />
          ) : (
            <p className="grid h-full place-items-center px-8 text-center text-[15px] text-ink-secondary">
              Dán một link prototype để xem trước đúng như khách sẽ thấy.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ id, label: text, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={label}>
        {text}
      </label>
      {children}
      {error ? <p className="text-xs text-danger-on-stage">{error}</p> : hint && <p className="text-xs text-ink-secondary">{hint}</p>}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-[31px] w-[51px] shrink-0 cursor-pointer rounded-full bg-white/20 transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link aria-checked:bg-[#30d158]"
    >
      <span className={`absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow transition-transform duration-300 ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

function Created({ slug, name, demoBase }: { slug: string; name: string; demoBase: string }) {
  const url = demoUrl(demoBase, slug);
  return (
    <div className="mx-auto flex max-w-2xl animate-rise flex-col items-center py-16 text-center">
      <p className="text-[17px] text-ink-secondary">“{name.trim()}” đã sẵn sàng.</p>
      <h1 className="mt-2 text-[40px] leading-tight font-semibold tracking-[-0.015em] md:text-[56px]">Gửi link này cho khách.</h1>
      <p className="mt-8 rounded-[20px] bg-stage-raised px-6 py-4 font-mono text-[19px] break-all text-ink md:text-[24px]">{displayUrl(demoBase, slug)}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <CopyButton text={url} className="min-h-11 rounded-full bg-cta px-6 text-[17px] text-white hover:bg-cta-hover active:scale-[0.97]" />
        <a href={url} target="_blank" rel="noopener" className="min-h-11 content-center text-[17px] text-link hover:underline">
          Mở trang khách xem ›
        </a>
        <Link href="/app" className="min-h-11 content-center text-[17px] text-link hover:underline">
          Về danh sách
        </Link>
      </div>
    </div>
  );
}
