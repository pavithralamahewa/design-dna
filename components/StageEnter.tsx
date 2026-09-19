"use client";

import { FormEvent, useState } from "react";

const RECENT = [
  "127.0.0.1:43135/demo",
  "stripe.com",
  "linear.app",
] as const;

type Props = {
  leaving: boolean;
  onSubmit: (url: string) => void;
};

export function StageEnter({ leaving, onSubmit }: Props) {
  const [url, setUrl] = useState("http://127.0.0.1:43135/demo");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
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
        <form className="field" onSubmit={handleSubmit}>
          <input
            type="url"
            name="url"
            autoComplete="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={leaving}
            aria-label="Page URL"
          />
          <button className="go" type="submit" disabled={leaving}>
            Inspect
          </button>
        </form>
        <p className="hint">~15–20s real capture · one paint · no estimates</p>
        <div className="recent">
          <span>Try</span>
          {RECENT.map((host) => (
            <button
              key={host}
              type="button"
              disabled={leaving}
              onClick={() => {
                const next = host.startsWith("http") ? host : `https://${host}`;
                setUrl(next);
                onSubmit(next);
              }}
            >
              {host}
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
