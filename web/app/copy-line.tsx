"use client";

import { useState } from "react";

/** A line of text to paste into an agent, with a Copy button (landing.js copy handler). */
export function CopyLine({ text, label = "Copy", className = "copyline", hideText = false }: { text: string; label?: string; className?: string; hideText?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div className={className}>
      {hideText ? null : <code>{text}</code>}
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
          } catch {
            /* the text stays selectable */
          }
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }}
      >
        {done ? "Copied" : label}
      </button>
    </div>
  );
}
