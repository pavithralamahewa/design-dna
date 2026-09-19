"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AmbientLayer } from "@/components/AmbientLayer";
import { ScanNav } from "@/components/ScanNav";
import { StageEnter } from "@/components/StageEnter";
import { StageRun } from "@/components/StageRun";
import { StageReport } from "@/components/StageReport";
import {
  isDemoScanUrl,
  loadMockScan,
  runCapture,
  type Capture,
  type MockScanBundle,
} from "@/lib/mock-scan";
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
  const [error, setError] = useState<string | null>(null);
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
    // Drop scan deep-link params so a remount does not auto-restart.
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

    // Keep the inspected URL in the address bar without a full navigation.
    // Also recovers when a pre-hydration form GET already wrote ?url=.
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

    // Enter the run stage immediately so the wait shows real work, not a blank dial.
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
      // Demo mock may keep Ledgerly numbers under the live demo host — still same specimen.
      // For every other URL, refuse a host mismatch (rule 12/13).
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

  // Boot from ?url= (form GET before hydration) or ?stage= (screenshot deep-links).
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
    // Deep-link stages without ?url= are demo-only — never invent another host.
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
