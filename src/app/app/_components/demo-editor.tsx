"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DemoShell, FlowList, glass, useDemoPlayer } from "@/components/demo-shell";
import {
  DEFAULT_BACKGROUND, DEFAULT_BRAND, IMAGE_RULES, imageError, suggestSlug, validateDemoForm,
  type DemoForm, type FormErrors, type FormField, type ImageKind,
} from "@/lib/demo-rules";
import { displayUrl } from "@/lib/demo-url";
import { DEFAULT_MODEL, DEVICE_OPTIONS, DEVICES, type Device, type Flow } from "@/lib/devices";
import { parseFigmaLink } from "@/lib/figma-link";
import { isReservedSlug, isSlugFormat } from "@/lib/slug";
import { checkFigmaAccess, fetchFigmaFlows, isSlugAvailable, publishDemo, removeDemo, saveDemo } from "../actions";

// Create and edit screen (spec 12): the Viewer's own layout, plus a Brand config popover on the logo,
// a Demo settings popover top right, and a column to turn Devices on, pick the device and paste links.

const HEX = /^#[0-9a-f]{6}$/i;
const SETTINGS_FIELDS: FormField[] = ["name", "slug", "confirmedPublic"];
const BRAND_FIELDS: FormField[] = ["logo", "brandColor", "backgroundColor", "backgroundImage"];
const FIELD_ID: Partial<Record<FormField, string>> = {
  name: "name", slug: "slug", confirmedPublic: "confirmed-public", desktop: "link-desktop", tablet: "link-tablet", phone: "link-phone",
};
// After the popover holding it has rendered.
const focusField = (f: FormField) => requestAnimationFrame(() => FIELD_ID[f] && document.getElementById(FIELD_ID[f])?.focus());

const input =
  "min-h-11 w-full rounded-xl bg-white/8 px-4 text-[15px] text-ink placeholder:text-ink-secondary focus-visible:outline-2 focus-visible:outline-link aria-invalid:outline-2 aria-invalid:outline-danger-on-stage";
const label = "text-[13px] font-semibold tracking-[-0.01em] text-ink";
const pill =
  "inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-full px-5 text-[15px] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link active:scale-[0.97] disabled:cursor-wait disabled:opacity-60";
const textButton = "min-h-11 cursor-pointer text-[13px] text-link hover:underline focus-visible:outline-2 focus-visible:outline-link";

export type EditorDemo = Omit<DemoForm, "isNew" | "confirmedPublic"> & { id: string; isPublished: boolean };

type Brand = Pick<DemoForm, "logo" | "brandColor" | "backgroundColor" | "backgroundImage">;

const EMPTY_DEVICES: DemoForm["devices"] = {
  desktop: { enabled: false, model: DEFAULT_MODEL.desktop, link: "" },
  tablet: { enabled: false, model: DEFAULT_MODEL.tablet, link: "" },
  phone: { enabled: true, model: DEFAULT_MODEL.phone, link: "" },
};

export function DemoEditor({ demo, demoBase }: { demo?: EditorDemo; demoBase: string }) {
  const router = useRouter();
  const isNew = !demo;
  const [form, setForm] = useState<DemoForm>({
    name: demo?.name ?? "",
    slug: demo?.slug ?? "",
    devices: demo?.devices ?? EMPTY_DEVICES,
    flows: demo?.flows ?? [],
    brandColor: demo?.brandColor ?? DEFAULT_BRAND,
    backgroundColor: demo?.backgroundColor ?? DEFAULT_BACKGROUND,
    backgroundImage: demo?.backgroundImage ?? null,
    logo: demo?.logo ?? null,
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
  const [isPublished, setIsPublished] = useState(demo?.isPublished ?? true);
  const [open, setOpen] = useState<"brand" | "settings">();
  const [brandDraft, setBrandDraft] = useState<Brand>(); // while Brand config is open; Cancel drops it

  const set = <K extends keyof DemoForm>(key: K, value: DemoForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors({});
    setMessage(undefined);
  };
  const setDevice = (d: Device, patch: Partial<DemoForm["devices"][Device]>) =>
    set("devices", { ...form.devices, [d]: { ...form.devices[d], ...patch } });
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
    for (const { id: d } of DEVICES) {
      const p = parseFigmaLink(form.devices[d].link);
      if (p.ok) out[d] = { fileKey: p.fileKey, nodeId: p.nodeId };
    }
    return out;
  }, [form.devices]);
  const fileKey = Object.values(links)[0]?.fileKey;

  // Warn while editing when Figma would show clients its sign-in wall instead of the prototype.
  const [privateKey, setPrivateKey] = useState<string>();
  useEffect(() => {
    if (!fileKey) return;
    let current = true; // a late answer for an earlier file is dropped
    const t = setTimeout(() => checkFigmaAccess(fileKey).then((a) => current && setPrivateKey(a === "private" ? fileKey : undefined)), 350);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [fileKey]);
  const enabled = DEVICES.map((d) => d.id).filter((d) => form.devices[d].enabled);
  const player = useDemoPlayer({ enabled, flows: form.flows });
  const brand: Brand = brandDraft ?? form;
  const models = Object.fromEntries(DEVICES.map(({ id }) => [id, form.devices[id].model]));

  const showError = (errs: FormErrors) => {
    const first = (["name", "slug", "confirmedPublic", "desktop", "tablet", "phone", ...BRAND_FIELDS] as FormField[]).find((f) => errs[f]);
    if (!first) return;
    // Open the popover that holds the first problem; the Device column is always on screen.
    if (SETTINGS_FIELDS.includes(first)) setOpen("settings");
    else if (BRAND_FIELDS.includes(first)) {
      setBrandDraft(form);
      setOpen("brand");
    }
    focusField(first);
  };

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return showError(errors);
    if (demo && form.slug !== demo.slug) {
      const ok = confirm(`Đổi đường dẫn thành ${displayUrl(demoBase, form.slug)}? Link cũ ${displayUrl(demoBase, demo.slug)} vẫn tự chuyển về Demo này.`);
      if (!ok) return;
    }
    setSaving(true);
    const r = await saveDemo(form, demo?.id).finally(() => setSaving(false));
    if (!r.ok) {
      setServerErrors(r.errors);
      setMessage(r.message);
      return showError(r.errors);
    }
    // Own route for the success screen: saving re-renders /app/new, which would drop any in-page state.
    router.push(isNew ? `/app/demos/${r.id}/ready` : "/app?saved=1");
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

  const brandButton = (
    <Popover
      open={open === "brand"}
      onClose={() => {
        setOpen(undefined);
        setBrandDraft(undefined);
      }}
      align="left"
      trigger={
        <button
          type="button"
          aria-expanded={open === "brand"}
          onClick={() => {
            if (open === "brand") return;
            setBrandDraft(form);
            setOpen("brand");
          }}
          className={`flex min-h-11 max-w-56 cursor-pointer items-center rounded-[18px] px-4 text-[15px] font-semibold hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-link ${glass}`}
        >
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- a data URL the Designer just picked
            <img src={brand.logo} alt="Logo" className="max-h-8 max-w-48 object-contain" />
          ) : (
            "Brand logo"
          )}
        </button>
      }
    >
      {brandDraft && (
        <BrandConfig
          value={brandDraft}
          onChange={setBrandDraft}
          errors={submitted ? errors : {}}
          onCancel={() => {
            setOpen(undefined);
            setBrandDraft(undefined);
          }}
          onSave={() => {
            setForm((f) => ({ ...f, ...brandDraft }));
            setServerErrors({});
            setOpen(undefined);
            setBrandDraft(undefined);
          }}
        />
      )}
    </Popover>
  );

  const actions = (
    <>
      <Popover
        open={open === "settings"}
        onClose={() => setOpen(undefined)}
        align="right"
        trigger={
          <button
            type="button"
            aria-expanded={open === "settings"}
            onClick={() => setOpen(open === "settings" ? undefined : "settings")}
            className={`${pill} ${glass} text-ink hover:bg-white/12`}
          >
            Cài đặt Demo
            {SETTINGS_FIELDS.some((f) => shown(f)) && <span aria-label="có lỗi" className="ml-2 size-2 rounded-full bg-danger-on-stage" />}
          </button>
        }
      >
        <div className="flex flex-col gap-5">
          <Field id="name" label="Tên Demo" error={shown("name")} hint="Khách thấy tên này khi Demo chưa có logo.">
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
          {isNew && (
            <p className="text-xs leading-relaxed text-ink-secondary">
              Tạo Demo nghĩa là bạn đồng ý với <Link href="/terms" className="text-link hover:underline">Điều khoản</Link> và{" "}
              <Link href="/privacy" className="text-link hover:underline">Quyền riêng tư</Link>.
            </p>
          )}
          {demo && (
            <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
                <span>
                  <span className={label}>Công khai</span>
                  <span className="block text-xs text-ink-secondary">
                    {isPublished ? "Ai có link đều xem được." : "Khách mở link sẽ thấy “không khả dụng”."}
                  </span>
                </span>
                <Switch checked={isPublished} onChange={togglePublished} />
              </label>
              <button type="button" onClick={remove} className="min-h-11 cursor-pointer self-start text-[15px] text-danger-on-stage hover:underline focus-visible:outline-2 focus-visible:outline-link">
                Xóa Demo
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <Link href="/app" className="text-[13px] text-link hover:underline">‹ Demo của bạn</Link>
            <button type="button" onClick={() => setOpen(undefined)} className={`${pill} bg-white/12 text-ink hover:bg-white/20`}>
              Xong
            </button>
          </div>
        </div>
      </Popover>
      <button type="submit" disabled={saving} className={`${pill} bg-cta text-white hover:bg-cta-hover`}>
        {saving ? "Đang lưu…" : isNew ? "Tạo Demo" : "Lưu"}
      </button>
    </>
  );

  const panel = (
    <>
      {DEVICES.map(({ id: d, label: name }) => {
        const err = shown(d);
        const parsed = parseFigmaLink(form.devices[d].link);
        return (
          <fieldset key={d} className="flex flex-col gap-2 rounded-2xl bg-white/5 p-3">
            <legend className="sr-only">{name}</legend>
            <label className="flex min-h-9 cursor-pointer items-center gap-3 text-[15px] font-semibold">
              <input
                type="checkbox"
                checked={form.devices[d].enabled}
                onChange={(e) => {
                  setDevice(d, { enabled: e.target.checked });
                  if (e.target.checked) player.choose(d);
                }}
                className="size-5 shrink-0 accent-cta"
              />
              {name}
            </label>
            <label className="sr-only" htmlFor={`model-${d}`}>Thiết bị cho {name}</label>
            <select
              id={`model-${d}`}
              value={form.devices[d].model}
              onChange={(e) => setDevice(d, { model: e.target.value })}
              className={`${input} cursor-pointer`}
            >
              {DEVICE_OPTIONS[d].map((o) => (
                <option key={o.value} value={o.value} className="bg-stage-raised">{o.label}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`link-${d}`}>Link prototype Figma cho {name}</label>
            <input
              id={`link-${d}`}
              value={form.devices[d].link}
              onChange={(e) => setDevice(d, { link: e.target.value })}
              onBlur={() => touch(d)}
              aria-invalid={!!err}
              placeholder="Figma link: https://www.figma.com/proto/…"
              className={input}
            />
            {err ? (
              <p className="text-xs text-danger-on-stage">{err}</p>
            ) : (
              parsed.ok && !errors[d] && <p className="text-xs text-[#30d158]">✓ Bắt đầu ở frame {parsed.nodeId}</p>
            )}
          </fieldset>
        );
      })}
      {shown("links") && <p className="text-xs text-danger-on-stage">{shown("links")}</p>}
      {fileKey && privateKey === fileKey && <PrivateFileWarning />}
      <p className="-mt-2 text-xs leading-relaxed text-ink-secondary">
        Link lấy từ Present, Copy link trong Figma. Mọi link phải cùng một file. Mỗi thiết bị một page, hay chung một page, đều được.
      </p>

      <div className="border-t border-white/10 pt-4">
        <FlowEditor
          player={player}
          brandColor={brand.brandColor}
          fileKey={fileKey}
          links={links}
          flows={form.flows}
          onChange={(flows) => set("flows", flows)}
          error={shown("flows")}
        />
      </div>
      {message && <p className="rounded-xl bg-danger-on-stage/10 px-4 py-3 text-[13px] text-danger-on-stage">{message}</p>}
    </>
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="h-[calc(100dvh-6.5rem)] min-h-[600px] animate-rise overflow-hidden rounded-[28px]"
    >
      <DemoShell
        player={player}
        links={links}
        models={models}
        background={{ color: HEX.test(brand.backgroundColor) ? brand.backgroundColor : DEFAULT_BACKGROUND, image: brand.backgroundImage }}
        brandColor={HEX.test(brand.brandColor) ? brand.brandColor : DEFAULT_BRAND}
        logo={brandButton}
        actions={actions}
        panel={panel}
        emptyText={enabled.length ? "Dán link prototype để xem trước đúng như khách sẽ thấy." : "Bật một thiết bị ở cột bên phải."}
      />
    </form>
  );
}

function FlowEditor({
  player, brandColor, fileKey, links, flows, onChange, error,
}: {
  player: ReturnType<typeof useDemoPlayer>;
  brandColor: string;
  fileKey?: string;
  links: Partial<Record<Device, { fileKey: string; nodeId: string }>>;
  flows: Flow[];
  onChange: (flows: Flow[]) => void;
  error?: string;
}) {
  const [mode, setMode] = useState<"figma" | "manual">();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const device = player.device;
  const deviceName = DEVICES.find((d) => d.id === device)?.label;

  const fetchFlows = async () => {
    if (!fileKey) return setNote("Dán link prototype trước.");
    setBusy(true);
    const r = await fetchFigmaFlows(token, fileKey, Object.fromEntries(Object.entries(links).map(([d, l]) => [d, l.nodeId]))).finally(() => setBusy(false));
    setToken(""); // used once, never kept
    if (!r.ok) return setNote(r.message);
    // Flows from Figma are replaced; the ones added by link stay.
    onChange([...r.flows, ...flows.filter((f) => f.source === "manual")]);
    const lost = r.missing.map((d) => DEVICES.find((x) => x.id === d)!.label);
    setNote(
      `Đã lấy ${r.flows.length} flow.` +
        (lost.length ? ` Không thấy frame của ${lost.join(", ")} trong file (frame nằm sâu hơn một section thì không đọc được).` : ""),
    );
    setMode(undefined);
  };

  const addFlow = () => {
    const p = parseFigmaLink(link);
    if (!device) return;
    if (!p.ok) return setNote("Link chưa đúng. Trong Present, chọn flow rồi bấm Copy link.");
    if (fileKey && p.fileKey !== fileKey) return setNote("Link phải thuộc cùng file với các thiết bị.");
    if (!name.trim()) return setNote("Đặt tên cho flow.");
    onChange([...flows, { device, name: name.trim().slice(0, 80), nodeId: p.nodeId, source: "manual" }]);
    setName("");
    setLink("");
    setNote(undefined);
    setMode(undefined);
  };
  // Enter in these fields must not submit the whole Demo.
  const onEnter = (run: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <FlowList
        player={player}
        brandColor={brandColor}
        onRemove={(f) => onChange(flows.filter((x) => x !== f))}
        header={
          <button type="button" onClick={() => setMode(mode === "figma" ? undefined : "figma")} className={textButton}>
            Lấy flow từ Figma
          </button>
        }
        empty={<p className="text-xs text-ink-secondary">{deviceName ? `${deviceName} chưa có flow.` : "Chưa có flow."}</p>}
      />
      {mode === "figma" && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white/5 p-3">
          <label htmlFor="figma-token" className="text-xs text-ink-secondary">
            Personal access token, quyền đọc file. Chỉ dùng một lần, không lưu.{" "}
            <a href="https://help.figma.com/hc/en-us/articles/8085703771159" target="_blank" rel="noopener" className="text-link hover:underline">
              Tạo token ›
            </a>
          </label>
          <input
            id="figma-token"
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={onEnter(fetchFlows)}
            placeholder="figd_…"
            className={input}
          />
          <button type="button" disabled={busy || !token.trim()} onClick={fetchFlows} className={`${pill} self-start bg-white/12 text-ink hover:bg-white/20`}>
            {busy ? "Đang đọc file…" : "Lấy flow"}
          </button>
        </div>
      )}
      {mode === "manual" ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-white/5 p-3">
          <input aria-label="Tên flow" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onEnter(addFlow)} placeholder="Tên flow" className={input} />
          <input aria-label="Link flow" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={onEnter(addFlow)} placeholder="https://www.figma.com/proto/…" className={input} />
          <div className="flex gap-4">
            <button type="button" onClick={addFlow} className={`${pill} bg-white/12 text-ink hover:bg-white/20`}>Thêm</button>
            <button type="button" onClick={() => setMode(undefined)} className={textButton}>Hủy</button>
          </div>
        </div>
      ) : (
        device && (
          <button type="button" onClick={() => setMode("manual")} className={`${textButton} self-start`}>
            + Thêm flow bằng link cho {deviceName}
          </button>
        )
      )}
      {note && <p className="text-xs text-ink-secondary">{note}</p>}
      {error && <p className="text-xs text-danger-on-stage">{error}</p>}
    </div>
  );
}

function BrandConfig({
  value, onChange, errors, onCancel, onSave,
}: { value: Brand; onChange: (b: Brand) => void; errors: FormErrors; onCancel: () => void; onSave: () => void }) {
  const [kind, setKind] = useState<"color" | "image">(value.backgroundImage ? "image" : "color");
  const [fileError, setFileError] = useState<Partial<Record<ImageKind, string>>>({});

  const pick = (key: ImageKind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const err = imageError(key, url);
      setFileError((f) => ({ ...f, [key]: err }));
      if (!err) onChange({ ...value, [key]: url });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex w-72 flex-col gap-4">
      <h2 className="text-[17px] font-semibold">Brand config</h2>
      <div className="flex flex-col gap-2">
        <span className={label}>Logo</span>
        <div className="flex items-center gap-3">
          <label className={`${pill} bg-white/12 text-ink hover:bg-white/20`}>
            {value.logo ? "Đổi logo" : "Upload logo (PNG, SVG)"}
            <input type="file" accept={IMAGE_RULES.logo.types.join(",")} onChange={pick("logo")} className="sr-only" />
          </label>
          {value.logo && (
            <button type="button" onClick={() => onChange({ ...value, logo: null })} className={textButton}>Bỏ</button>
          )}
        </div>
        <p className="text-xs text-ink-secondary">{IMAGE_RULES.logo.label}.</p>
        {(fileError.logo || errors.logo) && <p className="text-xs text-danger-on-stage">{fileError.logo || errors.logo}</p>}
      </div>

      <ColorField id="brand-color" label="Brand color" hint="Tab và flow đang chọn." value={value.brandColor} onChange={(c) => onChange({ ...value, brandColor: c })} error={errors.brandColor} />

      <div className="flex flex-col gap-2">
        <span className={label}>Background</span>
        <div role="radiogroup" aria-label="Kiểu nền" className="inline-flex gap-1 self-start rounded-[14px] bg-white/8 p-1">
          {(["color", "image"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k);
                if (k === "color") onChange({ ...value, backgroundImage: null });
              }}
              className="min-h-9 cursor-pointer rounded-[10px] px-4 text-[13px] text-ink-secondary aria-checked:bg-white/15 aria-checked:font-semibold aria-checked:text-ink"
            >
              {k === "color" ? "Màu" : "Ảnh"}
            </button>
          ))}
        </div>
        {kind === "color" ? (
          <ColorField id="background-color" label="Màu nền" value={value.backgroundColor} onChange={(c) => onChange({ ...value, backgroundColor: c })} error={errors.backgroundColor} />
        ) : (
          <>
            <label className={`${pill} self-start bg-white/12 text-ink hover:bg-white/20`}>
              {value.backgroundImage ? "Đổi ảnh nền" : "Chọn ảnh nền"}
              <input type="file" accept={IMAGE_RULES.backgroundImage.types.join(",")} onChange={pick("backgroundImage")} className="sr-only" />
            </label>
            <p className="text-xs text-ink-secondary">{IMAGE_RULES.backgroundImage.label}.</p>
          </>
        )}
        {(fileError.backgroundImage || errors.backgroundImage) && (
          <p className="text-xs text-danger-on-stage">{fileError.backgroundImage || errors.backgroundImage}</p>
        )}
      </div>

      <div className="flex gap-2 border-t border-white/10 pt-4">
        <button type="button" onClick={onCancel} className={`${pill} flex-1 justify-center bg-white/12 text-ink hover:bg-white/20`}>Cancel</button>
        <button type="button" onClick={onSave} className={`${pill} flex-1 justify-center bg-cta text-white hover:bg-cta-hover`}>Save</button>
      </div>
    </div>
  );
}

function ColorField({ id, label: text, hint, value, onChange, error }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field id={id} label={text} error={error} hint={hint}>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`Chọn ${text.toLowerCase()}`}
          value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-xl bg-white/8 p-1.5"
        />
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} className={`${input} font-mono`} />
      </div>
    </Field>
  );
}

// Anchored panel under its trigger. Escape or a click outside closes it (Cancel, for Brand config).
function Popover({ open, onClose, align, trigger, children }: { open: boolean; onClose: () => void; align: "left" | "right"; trigger: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const click = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    addEventListener("keydown", key);
    addEventListener("pointerdown", click);
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("pointerdown", click);
    };
  }, [open, onClose]);
  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div
          role="dialog"
          className={`absolute top-full z-30 mt-2 max-h-[calc(100dvh-10rem)] w-max max-w-[22rem] overflow-y-auto rounded-[22px] p-5 ${glass} ${align === "left" ? "left-0" : "right-0"}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Field({ id, label: text, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
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

function PrivateFileWarning() {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-warning-on-stage/12 p-3 text-xs leading-relaxed text-ink">
      <p>
        <strong className="font-semibold">Khách chưa xem được file này.</strong> Figma đang chặn người ngoài, nên khách sẽ thấy màn hình bắt đăng
        nhập Figma. Trong Figma, bấm Share và chọn <span className="whitespace-nowrap">“Anyone with the link · can view”</span>.
      </p>
      <details>
        <summary className="cursor-pointer text-link">Org dùng Figma Enterprise và không đổi được?</summary>
        <p className="mt-2 text-ink-secondary">
          Admin của org có thể đã tắt link công khai hoặc bắt buộc mật khẩu, và Figma không cho nhúng file như vậy. Có hai cách: nhờ admin
          mở ngoại lệ cho project dùng để trình bày khách, hoặc mời email của khách vào file trong Figma. Với cách thứ hai, khách phải đăng nhập
          Figma mới xem được.
        </p>
      </details>
    </div>
  );
}
