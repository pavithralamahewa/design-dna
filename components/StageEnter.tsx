"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const TRY_PATHS = ["/demo", "https://stripe.com", "https://linear.app"] as const;

type Props = {
  leaving: boolean;
  onSubmit: (url: string) => void;
};

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function readOrigin(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:43123";
  return window.location.origin;
}

export function StageEnter({ leaving, onSubmit }: Props) {
  const [origin, setOrigin] = useState("http://127.0.0.1:43123");
  const demoUrl = `${origin}/demo`;
  const [url, setUrl] = useState(demoUrl);

  useEffect(() => {
    const next = readOrigin();
    setOrigin(next);
    setUrl((prev) => {
      // Replace any stale hardcoded demo host with the live origin.
      try {
        const u = new URL(prev);
        if (
          u.pathname === "/demo" &&
          (u.hostname === "127.0.0.1" || u.hostname === "localhost")
        ) {
          return `${next}/demo`;
        }
      } catch {
        /* keep */
      }
      return prev === "http://127.0.0.1:43135/demo" ||
        prev === "http://127.0.0.1:43123/demo"
        ? `${next}/demo`
        : prev;
    });
  }, []);

  const recent = useMemo(
    () =>
      TRY_PATHS.map((p) => (p.startsWith("http") ? p : `${origin}${p}`)),
    [origin],
  );

  function launch() {
    const next = normalizeUrl(url);
    if (!next) return;
    setUrl(next);
    onSubmit(next);
  }

  function handleSubmit(e: FormEvent) {
    // Always cancel native navigation — a GET before hydration remounts on
    // /?url=… and used to leave the app stuck on the enter stage.
    e.preventDefault();
    e.stopPropagation();
    launch();
  }

  return (
    <div id="step1" className="stage-enter">
      <div className="wrap s1">
        <p className="eyebrowpill">
          <i />
          Deterministic inspection — no LLM
        </p>
        <h1 className="big">
          Paste a URL. See what the page <em>actually</em> is.
        </h1>
        <p className="lede">
          Real headless capture, measured elements, checkable corrections. Same
          page in — same numbers out.
        </p>
        {/* method=post + no name= avoids /?url= full reloads if JS is late */}
        <form
          className="field"
          method="post"
          action="#"
          onSubmit={handleSubmit}
        >
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={leaving}
            aria-label="Page URL"
          />
          <button
            className="go"
            type="button"
            disabled={leaving}
            onClick={launch}
          >
            Inspect
          </button>
        </form>
        <p className="hint">~15–20s real capture · one paint · no estimates</p>
        <div className="recent">
          <span>Try</span>
          {recent.map((host) => (
            <button
              key={host}
              type="button"
              disabled={leaving}
              onClick={() => {
                setUrl(host);
                onSubmit(host);
              }}
            >
              {host.replace(/^https?:\/\//, "")}
            </button>
          ))}
        </div>
        <div className="corpusline">
          <div className="cstat">
            <b>573</b>
            <span>Corpus sites</span>
          </div>
          <div className="cstat">
            <b>18 Sep</b>
            <span>Fingerprinted 2026</span>
          </div>
          <div className="cstat">
            <b>0</b>
            <span>Model calls</span>
          </div>
        </div>
      </div>
    </div>
  );
}
