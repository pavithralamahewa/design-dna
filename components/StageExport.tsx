"use client";

import { useCallback, useMemo, useState } from "react";
import type { MockScanBundle } from "@/lib/mock-scan";
import {
  buildFixPrompt,
  buildPostconditionsJson,
  buildTokensCss,
} from "@/lib/export-artifacts";

type Panel = "fix" | "tokens" | "postconditions";

type Props = {
  bundle: MockScanBundle;
  scanUrl: string;
};

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function StageExport({ bundle, scanUrl }: Props) {
  const [panel, setPanel] = useState<Panel>("fix");
  const [copied, setCopied] = useState<Panel | null>(null);

  const fixPrompt = useMemo(
    () => buildFixPrompt(bundle, scanUrl || bundle.capture.url),
    [bundle, scanUrl],
  );
  const tokens = useMemo(
    () => buildTokensCss(bundle.capture.elements),
    [bundle.capture.elements],
  );
  const postJson = useMemo(
    () => buildPostconditionsJson(bundle.postconditions),
    [bundle.postconditions],
  );

  const body =
    panel === "fix" ? fixPrompt : panel === "tokens" ? tokens : postJson;

  const onCopy = useCallback(async () => {
    const ok = await copyText(body);
    if (!ok) return;
    setCopied(panel);
    window.setTimeout(() => setCopied((c) => (c === panel ? null : c)), 1600);
  }, [body, panel]);

  return (
    <div className="stage-export wrap sec" id="export">
      <p className="eyebrow">Export</p>
      <h2 className="sh">Take it into your coding agent</h2>
      <p className="sub">
        FIX PROMPT is built from <b>FAIL</b> findings only. REVIEW stays out of
        the change list. Tokens and postconditions are measured on this capture.
      </p>

      <div className="seg" role="tablist" aria-label="Export panels">
        <button
          type="button"
          className={panel === "fix" ? "on" : undefined}
          aria-selected={panel === "fix"}
          onClick={() => setPanel("fix")}
        >
          FIX PROMPT
        </button>
        <button
          type="button"
          className={panel === "tokens" ? "on" : undefined}
          aria-selected={panel === "tokens"}
          onClick={() => setPanel("tokens")}
        >
          TOKENS
        </button>
        <button
          type="button"
          className={panel === "postconditions" ? "on" : undefined}
          aria-selected={panel === "postconditions"}
          onClick={() => setPanel("postconditions")}
        >
          POSTCONDITIONS
        </button>
      </div>

      <pre className="code" data-panel={panel}>
        {body}
      </pre>
      <div className="copyrow">
        <button type="button" className="btn btn-a" onClick={() => void onCopy()}>
          Copy
        </button>
        {copied === panel ? <span className="copied">Copied</span> : null}
      </div>
    </div>
  );
}
