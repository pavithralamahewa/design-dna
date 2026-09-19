"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ScanUserError } from "@/lib/scan-errors";
import { invalidUrlError, isValidHttpUrl } from "@/lib/scan-errors";

const TRY_PATHS = ["/demo", "https://stripe.com", "https://linear.app"] as const;

type Props = {
  leaving: boolean;
  /** Keep the last attempted URL so the user can edit rather than retype. */
  urlValue: string;
  onUrlChange: (url: string) => void;
  error: ScanUserError | null;
  onSubmit: (url: string) => void;
  onClientError: (err: ScanUserError) => void;
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

export function StageEnter({
  leaving,
  urlValue,
  onUrlChange,
  error,
  onSubmit,
  onClientError,
}: Props) {
  const [origin, setOrigin] = useState(() => readOrigin());

  useEffect(() => {
    const next = readOrigin();
    setOrigin(next);
    // Seed default demo URL once; never wipe a typed / failed attempt.
    if (!urlValue) {
      onUrlChange(`${next}/demo`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount seed only
  }, []);

  const recent = useMemo(
    () =>
      TRY_PATHS.map((p) => (p.startsWith("http") ? p : `${origin}${p}`)),
    [origin],
  );

  function launch(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      onClientError(invalidUrlError(raw));
      return;
    }
    // Scheme present but not http(s) → invalid (do not auto-upgrade ftp:/mailto:)
    if (
      /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) &&
      !/^https?:/i.test(trimmed)
    ) {
      onUrlChange(trimmed);
      onClientError(invalidUrlError(trimmed));
      return;
    }
    const next = normalizeUrl(trimmed);
    if (!isValidHttpUrl(next)) {
      onUrlChange(trimmed);
      onClientError(invalidUrlError(trimmed));
      return;
    }
    onUrlChange(next);
    onSubmit(next);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    launch(urlValue);
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
            value={urlValue}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={leaving}
            aria-label="Page URL"
            aria-invalid={error ? true : undefined}
          />
          <button
            className="go"
            type="button"
            disabled={leaving}
            onClick={() => launch(urlValue)}
          >
            Inspect
          </button>
        </form>
        {error ? (
          <div className="scan-err" role="alert" data-kind={error.kind}>
            <p className="scan-err-msg">{error.message}</p>
            <details className="scan-err-details">
              <summary>Details</summary>
              <pre>{error.detail}</pre>
            </details>
          </div>
        ) : null}
        <p className="hint">~15–20s real capture · one paint · no estimates</p>
        <div className="recent">
          <span>Try</span>
          {recent.map((host) => (
            <button
              key={host}
              type="button"
              disabled={leaving}
              onClick={() => {
                onUrlChange(host);
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
