"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AmbientLayer } from "@/components/AmbientLayer";
import { ScanNav } from "@/components/ScanNav";
import { StageEnter } from "@/components/StageEnter";
import { StageRun } from "@/components/StageRun";
import { StageReport } from "@/components/StageReport";
import { StageExport } from "@/components/StageExport";
import {
  isDemoScanUrl,
  loadMockScan,
  runCapture,
  type Capture,
  type MockScanBundle,
} from "@/lib/mock-scan";
import {
  classifyScanError,
  type ScanUserError,
} from "@/lib/scan-errors";
import { resolveScanKeys } from "@/lib/scan-keys";
import "@/app/scan/dna.css";

type Stage = "enter" | "run" | "results";
type ReportTab = "report" | "capture" | "export";

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

export function ScanApp() {
  const [stage, setStage] = useState<Stage>("enter");
  const [leaving, setLeaving] = useState(false);
  const [url, setUrl] = useState("");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [bundle, setBundle] = useState<MockScanBundle | null>(null);
  const [error, setError] = useState<ScanUserError | null>(null);
  const [reportTab, setReportTab] = useState<ReportTab>("report");
  const [usedMock, setUsedMock] = useState(false);
  const scanGen = useRef(0);
  const bootstrapped = useRef(false);

  useEffect(() => {
    document.body.dataset.stage = stage;
    return () => {
      delete document.body.dataset.stage;
    };
  }, [stage]);

  const reset = useCallback(() => {
    scanGen.current += 1;
    setStage("enter");
    setLeaving(false);
    setUrl("");
    setCapture(null);
    setBundle(null);
    setError(null);
    setReportTab("report");
    setUsedMock(false);
    if (typeof window !== "undefined") {
      const path = window.location.pathname || "/";
      window.history.replaceState(null, "", path);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const startScan = useCallback(async (nextUrl: string) => {
    const gen = ++scanGen.current;
    setError(null);
    setUrl(nextUrl);
    setLeaving(true);
    setReportTab("report");
    setCapture(null);
    setBundle(null);
    setUsedMock(false);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("stage");
      params.set("url", nextUrl);
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname || "/"}${qs ? `?${qs}` : ""}`,
      );
    }

    window.setTimeout(() => {
      if (gen !== scanGen.current) return;
      setStage("run");
      setLeaving(false);
      window.scrollTo({ top: 0 });
    }, 280);

    try {
      const data = await runCapture(nextUrl);
      if (gen !== scanGen.current) return;

      const asked = resolveScanKeys(nextUrl).host;
      const got = data.capture.host;
      if (!isDemoScanUrl(nextUrl)) {
        const askedKey = asked.toLowerCase();
        const gotKey = got.toLowerCase();
        if (askedKey !== gotKey) {
          throw new Error(
            `Scan host mismatch: asked for ${asked}, got ${got}. Refusing to show another site's data.`,
          );
        }
      }

      setUsedMock(isDemoScanUrl(nextUrl));
      setCapture(data.capture);
      setBundle(data);
    } catch (e) {
      if (gen !== scanGen.current) return;
      // Never show a partial report after a failed capture.
      setCapture(null);
      setBundle(null);
      setError(classifyScanError(e));
      setStage("enter");
      setLeaving(false);
      // Keep nextUrl in the field (already set above).
    }
  }, []);

  const finishRun = useCallback(() => {
    setStage("results");
    setReportTab("report");
    window.scrollTo({ top: 0 });
  }, []);

  const onReportTab = useCallback((tab: ReportTab) => {
    setReportTab(tab);
    if (tab === "export") {
      window.setTimeout(() => scrollToId("export"), 40);
      return;
    }
    if (tab === "report") scrollToId("overview");
    else if (tab === "capture") scrollToId("redlines");
    else scrollToId("verify");
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("url");
    if (urlParam) {
      void startScan(urlParam);
      return;
    }
    const want = params.get("stage");
    if (want !== "run" && want !== "results") return;
    let cancelled = false;
    (async () => {
      const data = await loadMockScan();
      if (cancelled) return;
      const liveUrl = `${window.location.origin}/demo`;
      const host = resolveScanKeys(liveUrl).host;
      setUrl(liveUrl);
      setUsedMock(true);
      setCapture({ ...data.capture, url: liveUrl, host });
      setBundle({
        ...data,
        capture: { ...data.capture, url: liveUrl, host },
      });
      setStage(want);
    })();
    return () => {
      cancelled = true;
    };
  }, [startScan]);

  return (
    <div
      className={`dna-root${leaving ? " leaving" : ""}`}
      data-stage={stage}
      data-mock={usedMock ? "true" : "false"}
    >
      <ScanNav
        stage={stage}
        findingsCount={bundle?.findings.length ?? 0}
        reportTab={reportTab}
        onNewScan={reset}
        onReportTab={onReportTab}
      />
      <AmbientLayer />
      <StageEnter
        leaving={leaving}
        urlValue={url}
        onUrlChange={setUrl}
        error={error}
        onSubmit={startScan}
        onClientError={(err) => {
          setCapture(null);
          setBundle(null);
          setError(err);
          setStage("enter");
          setLeaving(false);
        }}
      />
      {stage === "run" ? (
        <StageRun
          url={url || capture?.url || ""}
          capture={capture}
          onComplete={finishRun}
        />
      ) : null}
      {stage === "results" && bundle ? (
        reportTab === "export" ? (
          <StageExport bundle={bundle} scanUrl={url || bundle.capture.url} />
        ) : (
          <StageReport bundle={bundle} />
        )
      ) : null}
    </div>
  );
}
