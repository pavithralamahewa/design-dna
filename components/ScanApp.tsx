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
type ReportTab = "report" | "capture" | "export";

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

function hostFromUrl(raw: string): string {
  try {
    return new URL(raw).host;
  } catch {
    return raw;
  }
}

function withLiveHost(bundle: MockScanBundle, nextUrl: string): MockScanBundle {
  const host = hostFromUrl(nextUrl);
  return {
    ...bundle,
    capture: {
      ...bundle.capture,
      url: nextUrl,
      host,
    },
  };
}

export function ScanApp() {
  const [stage, setStage] = useState<Stage>("enter");
  const [leaving, setLeaving] = useState(false);
  const [url, setUrl] = useState("");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [bundle, setBundle] = useState<MockScanBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportTab, setReportTab] = useState<ReportTab>("report");

  useEffect(() => {
    document.body.dataset.stage = stage;
    return () => {
      delete document.body.dataset.stage;
    };
  }, [stage]);

  const reset = useCallback(() => {
    setStage("enter");
    setLeaving(false);
    setUrl("");
    setCapture(null);
    setBundle(null);
    setError(null);
    setReportTab("report");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const startScan = useCallback(async (nextUrl: string) => {
    setError(null);
    setUrl(nextUrl);
    setLeaving(true);
    setReportTab("report");
    setCapture(null);
    setBundle(null);

    // Enter the run stage immediately so the wait shows real work, not a blank dial.
    window.setTimeout(() => {
      setStage("run");
      setLeaving(false);
      window.scrollTo({ top: 0 });
    }, 280);

    try {
      const data = USE_MOCK ? await loadMockScan() : await runCapture(nextUrl);
      const withUrl = withLiveHost(data, nextUrl);
      setCapture(withUrl.capture);
      setBundle(withUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
      setStage("enter");
      setLeaving(false);
    }
  }, []);

  const finishRun = useCallback(() => {
    setStage("results");
    setReportTab("report");
    window.scrollTo({ top: 0 });
  }, []);

  const onReportTab = useCallback((tab: ReportTab) => {
    setReportTab(tab);
    if (tab === "report") scrollToId("overview");
    else if (tab === "capture") scrollToId("redlines");
    else scrollToId("verify");
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
      const liveUrl = `${window.location.origin}/demo`;
      const withUrl = withLiveHost(data, liveUrl);
      setUrl(liveUrl);
      setCapture(withUrl.capture);
      setBundle(withUrl);
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
        reportTab={reportTab}
        onNewScan={reset}
        onReportTab={onReportTab}
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
      {stage === "results" && bundle ? (
        <StageReport bundle={bundle} />
      ) : null}
      {error ? (
        <div className="wrap" role="alert" style={{ paddingBlock: 24 }}>
          <p className="box">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
