"use client";

import { useCallback, useEffect, useState } from "react";
import { AmbientLayer } from "@/components/AmbientLayer";
import { ScanNav } from "@/components/ScanNav";
import { StageEnter } from "@/components/StageEnter";
import { StageRun } from "@/components/StageRun";
import { StageReport } from "@/components/StageReport";
import {
  USE_MOCK,
  loadMockScan,
  runCapture,
  type Capture,
  type MockScanBundle,
} from "@/lib/mock-scan";
import "@/app/scan/dna.css";

type Stage = "enter" | "run" | "results";

export function ScanApp() {
  const [stage, setStage] = useState<Stage>("enter");
  const [leaving, setLeaving] = useState(false);
  const [url, setUrl] = useState("");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [bundle, setBundle] = useState<MockScanBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStage("enter");
    setLeaving(false);
    setUrl("");
    setCapture(null);
    setBundle(null);
    setError(null);
  }, []);

  const startScan = useCallback(async (nextUrl: string) => {
    setError(null);
    setUrl(nextUrl);
    setLeaving(true);

    // Prefetch mock (or later: kick off real capture) while enter lifts away
    try {
      const data = USE_MOCK ? await loadMockScan() : await runCapture(nextUrl);
      // Keep submitted URL on the capture identity line
      const withUrl: MockScanBundle = {
        ...data,
        capture: {
          ...data.capture,
          url: nextUrl,
          host: (() => {
            try {
              return new URL(nextUrl).host;
            } catch {
              return data.capture.host;
            }
          })(),
        },
      };
      setCapture(withUrl.capture);
      setBundle(withUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
      setLeaving(false);
      return;
    }

    window.setTimeout(() => {
      setStage("run");
      setLeaving(false);
    }, 420);
  }, []);

  const finishRun = useCallback(() => {
    setStage("results");
  }, []);

  // Deep-link helpers for screenshots / demos: ?stage=run|results
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const want = params.get("stage");
    if (want !== "run" && want !== "results") return;
    let cancelled = false;
    (async () => {
      const data = await loadMockScan();
      if (cancelled) return;
      setUrl(data.capture.url);
      setCapture(data.capture);
      setBundle(data);
      setStage(want);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={`dna-root${leaving ? " leaving" : ""}`}
      data-stage={stage}
      data-mock={USE_MOCK ? "true" : "false"}
    >
      <ScanNav
        stage={stage}
        findingsCount={bundle?.findings.length ?? 0}
        onNewScan={reset}
      />
      <AmbientLayer />
      <StageEnter leaving={leaving} onSubmit={startScan} />
      {stage === "run" ? (
        <StageRun
          url={url || capture?.url || ""}
          capture={capture}
          onComplete={finishRun}
        />
      ) : null}
      {stage === "results" && bundle ? <StageReport bundle={bundle} /> : null}
      {error ? (
        <div className="wrap" role="alert" style={{ paddingBlock: 24 }}>
          <p className="box">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
