"use client";

import { useState } from "react";
import { demoUrl, displayUrl } from "@/lib/demo-url";


export function CopyButton({ text, className, label = "Copy link" }: { text: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className={`cursor-pointer transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link ${className ?? ""}`}
    >
      {copied ? "Đã copy" : label}
    </button>
  );
}

export function DemoLinkCell({ demoBase, slug }: { demoBase: string; slug: string }) {
  return (
    <span className="flex items-center gap-3">
      <a href={demoUrl(demoBase, slug)} target="_blank" rel="noopener" className="font-mono text-[13px] text-ink hover:underline">
        {displayUrl(demoBase, slug)}
      </a>
      <CopyButton text={demoUrl(demoBase, slug)} label="Copy" className="min-h-11 text-[13px] text-link hover:underline" />
    </span>
  );
}
