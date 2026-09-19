"use client";

type Stage = "enter" | "run" | "results";
type ReportTab = "report" | "capture" | "export";

type Props = {
  stage: Stage;
  findingsCount?: number;
  reportTab?: ReportTab;
  onNewScan?: () => void;
  onReportTab?: (tab: ReportTab) => void;
};

export function ScanNav({
  stage,
  findingsCount = 0,
  reportTab = "report",
  onNewScan,
  onReportTab,
}: Props) {
  const showTabs = stage === "results";

  return (
    <nav className="nav">
      <div className="nav-in">
        <button
          type="button"
          className="mark"
          onClick={() => {
            if (stage !== "enter") onNewScan?.();
            else window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="Design DNA — new scan"
        >
          Design DNA
          <span className="cnt">inspect</span>
        </button>
        {showTabs ? (
          <div className="tabs" role="tablist" aria-label="Report sections">
            <button
              type="button"
              className={reportTab === "report" ? "on" : undefined}
              aria-selected={reportTab === "report"}
              onClick={() => onReportTab?.("report")}
            >
              Report
              <span className="k">{findingsCount}</span>
            </button>
            <button
              type="button"
              className={reportTab === "capture" ? "on" : undefined}
              aria-selected={reportTab === "capture"}
              onClick={() => onReportTab?.("capture")}
            >
              Capture
            </button>
            <button
              type="button"
              className={reportTab === "export" ? "on" : undefined}
              aria-selected={reportTab === "export"}
              onClick={() => onReportTab?.("export")}
            >
              Export
            </button>
          </div>
        ) : null}
        {stage === "results" && onNewScan ? (
          <button type="button" id="newscan" onClick={onNewScan}>
            New scan
          </button>
        ) : null}
      </div>
    </nav>
  );
}
