"use client";

type Stage = "enter" | "run" | "results";

type Props = {
  stage: Stage;
  findingsCount?: number;
  onNewScan?: () => void;
};

export function ScanNav({ stage, findingsCount = 0, onNewScan }: Props) {
  const showTabs = stage === "results";

  return (
    <nav className="nav">
      <div className="nav-in">
        <a className="mark" href="/">
          Design DNA
          <span className="cnt">inspect</span>
        </a>
        {showTabs ? (
          <div className="tabs" role="tablist" aria-label="Report sections">
            <button type="button" className="on">
              Report
              <span className="k">{findingsCount}</span>
            </button>
            <button type="button">
              Capture
            </button>
            <button type="button">
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
