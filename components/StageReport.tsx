"use client";

import { useEffect, useMemo, useState } from "react";
import SamenessWall from "@/components/SamenessWall";
import { parseCorpusJson, type CorpusEntry } from "@/lib/corpus";
import type {
  ComponentCluster,
  Finding,
  MockScanBundle,
  MeasuredElement,
  Postcondition,
} from "@/lib/mock-scan";

type Props = {
  bundle: MockScanBundle;
};

function classSlug(c: Finding["class"]): string {
  return c.toLowerCase();
}

function clsLabel(c: Finding["class"]): string {
  return c;
}

function elementMap(els: MeasuredElement[]): Map<string, MeasuredElement> {
  return new Map(els.map((e) => [e.id, e]));
}

export function StageReport({ bundle }: Props) {
  const { capture, findings, postconditions, facts, topFixes, components, fingerprint, verdict } =
    bundle;
  const [annoMode, setAnnoMode] = useState<"fail" | "all">("fail");
  const [corpus, setCorpus] = useState<readonly CorpusEntry[]>([]);
  const [corpusNote, setCorpusNote] = useState<string | null>(null);
  const byId = useMemo(() => elementMap(capture.elements), [capture.elements]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/corpus.json");
        if (!res.ok) {
          if (!cancelled) setCorpusNote("Corpus file missing — wall cannot compare.");
          return;
        }
        const data = await res.json();
        const parsed = parseCorpusJson(data);
        if (!cancelled) setCorpus(parsed.sites);
      } catch {
        if (!cancelled) setCorpusNote("Corpus failed to load — wall cannot compare.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const redlineFindings = findings.filter((f) =>
    annoMode === "fail" ? f.class === "FAIL" || f.class === "REVIEW" : true,
  );

  const boxes = redlineFindings.flatMap((f) =>
    f.elementIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((el) => ({ finding: f, el: el as MeasuredElement })),
  );

  const emphasisParts = verdict.headline.split(verdict.emphasis);

  return (
    <div className="stage-results">
      <div className="wrap ovw" id="overview">
        <p className="ovwid">
          <b>{capture.host}</b> · captured {new Date(capture.capturedAt).toISOString()} ·{" "}
          {capture.viewport.w}×{capture.viewport.h} · page {capture.pageHeight}px
        </p>
        <h2 className="verdict">
          {emphasisParts.length === 2 ? (
            <>
              {emphasisParts[0]}
              <em>{verdict.emphasis}</em>
              {emphasisParts[1]}
            </>
          ) : (
            verdict.headline
          )}
        </h2>
        <p className="vsub">{verdict.sub}</p>

        <div className="facts">
          {facts.map((f) => {
            const deco = /decoration/i.test(f.label);
            const countMatch =
              f.detail.match(/(\d+)\s+decorative/i) ||
              f.value.match(/(\d+)/);
            const decoCount = countMatch?.[1] ?? "2";
            const value = deco
              ? `negligible — ${decoCount} decorative paint nodes`
              : f.value;
            const detail = deco
              ? "Paint-only nodes with no text, icon, image, or controls"
              : f.detail;
            return (
              <div key={f.label} className="fact">
                <b>{value}</b>
                <span>{f.label}</span>
                <i>{detail}</i>
              </div>
            );
          })}
        </div>

        <div className="first">
          <h4>Top three fixes</h4>
          {topFixes.map((fix) => (
            <div key={fix.n} className="frow">
              <span className="fnum">{String(fix.n).padStart(2, "0")}</span>
              <div className="ftxt">
                {fix.title}
                <s>{fix.detail}</s>
              </div>
              <a className="fjump" href={fix.jump}>
                Jump
              </a>
            </div>
          ))}
        </div>
      </div>

      <div className="wrap wall">
        {corpusNote ? (
          <p className="box" role="status">
            {corpusNote}
          </p>
        ) : (
          <SamenessWall host={capture.host} fingerprint={fingerprint} corpus={corpus} />
        )}
      </div>

      <section className="wrap sec" id="findings">
        <p className="eyebrow">Findings</p>
        <h2 className="sh">Measured differences</h2>
        <p className="sub">
          Each row is a classed finding. <b>REVIEW</b> is a real difference that
          still needs intent — never auto-merged with FAIL.
        </p>
        <div className="fixlist">
          {findings.map((f) => (
            <FindingRow key={f.id} finding={f} />
          ))}
        </div>
      </section>

      <section className="wrap sec" id="redlines">
        <p className="eyebrow">On the page</p>
        <h2 className="sh">Redlines on the real capture</h2>
        <p className="sub">
          Boxes use the same page coordinates as the measurement pass.
        </p>
        <div className="anno">
          <div>
            <div className="annoseg" role="tablist">
              <button
                type="button"
                className={annoMode === "fail" ? "on" : undefined}
                onClick={() => setAnnoMode("fail")}
              >
                Failures + review
              </button>
              <button
                type="button"
                className={annoMode === "all" ? "on" : undefined}
                onClick={() => setAnnoMode("all")}
              >
                All findings
              </button>
            </div>
            <div className="sheetwrap">
              <div className="sheet2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capture.image} alt={`Capture of ${capture.host}`} />
                <div className="ov">
                  {boxes.map(({ finding, el }) => (
                    <span
                      key={`${finding.id}-${el.id}`}
                      className={`obox${finding.class === "FAIL" ? " deco" : ""}`}
                      style={{
                        left: `${(el.x / capture.viewport.w) * 100}%`,
                        top: `${(el.y / capture.pageHeight) * 100}%`,
                        width: `${(el.w / capture.viewport.w) * 100}%`,
                        height: `${(el.h / capture.pageHeight) * 100}%`,
                      }}
                    >
                      <b>
                        {finding.class} · {el.id}
                      </b>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="legend">
            {redlineFindings.map((f) => (
              <div key={f.id} className="li" id={`finding-${f.id}`}>
                <span
                  className="sw2"
                  style={{
                    background:
                      f.class === "FAIL"
                        ? "rgba(198,70,44,.35)"
                        : f.class === "REVIEW"
                          ? "rgba(154,107,30,.35)"
                          : "var(--fill-2)",
                    border: "1px solid var(--hair)",
                  }}
                />
                <div>
                  <b>
                    {f.label} · {f.value}
                  </b>
                  <div>{f.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap sec" id="components">
        <p className="eyebrow">Components</p>
        <h2 className="sh">Visual clusters</h2>
        <p className="sub">
          Grouped by shape fingerprint only — never by class names.
        </p>
        <div className="comps">
          {components.map((c) => (
            <ComponentCard key={c.id} cluster={c} image={capture.image} viewportW={capture.viewport.w} />
          ))}
        </div>
      </section>

      <section className="wrap sec" id="verify">
        <p className="eyebrow">Verify</p>
        <h2 className="sh">What a re-scan will check</h2>
        <div className="pcond">
          <p className="projected">projected, not measured</p>
          <h4>Postconditions</h4>
          <p>
            A correction passes only when <b>every listed target</b> resolves to{" "}
            <b>expected</b>. Global counts are never used.
          </p>
          <div className="pclist">
            {postconditions.map((pc) => (
              <PostRow key={pc.id} pc={pc} />
            ))}
          </div>
        </div>
      </section>

      <footer className="wrap foot">
        <span>
          <b>Design DNA</b> — deterministic inspection for AI coding workflows
        </span>
        <span>No model calls · mock scan flag in lib/mock-scan.ts</span>
      </footer>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const k = classSlug(finding.class);
  return (
    <div
      className={`fix ${k}`}
      id={`finding-${finding.id}`}
      data-class={finding.class}
    >
      <span className={`cls k-${k}`}>{clsLabel(finding.class)}</span>
      <div>
        <div className="ftxt" style={{ fontSize: 15, lineHeight: "21px" }}>
          {finding.label}
          <s>{finding.note}</s>
        </div>
        {finding.class === "FAIL" && finding.elementIds.length === 0 ? (
          <div className="why">Missing element ids for a FAIL — data incomplete.</div>
        ) : null}
        {finding.class === "UNSUPPORTED" ? (
          <div className="why">Unsupported on this page: {finding.note}</div>
        ) : null}
      </div>
      <span className="snap">
        <span>{finding.value}</span>
      </span>
      <span className="hits">
        <b>{finding.elementIds.length || "—"}</b> els
      </span>
      <span className="kind">{finding.elementIds[0] ?? "—"}</span>
    </div>
  );
}

function PostRow({ pc }: { pc: Postcondition }) {
  return (
    <div className="pc">
      <span className={`cls ${pc.class === "FIX" ? "k-fix" : "k-review"}`}>
        {pc.class}
      </span>
      <span>
        {pc.property}: <span className="st">{pc.before}</span> → {pc.expected}
      </span>
      <span className="tgt">{pc.targets.join(", ")}</span>
    </div>
  );
}

function ComponentCard({
  cluster,
  image,
  viewportW,
}: {
  cluster: ComponentCluster;
  image: string;
  viewportW: number;
}) {
  const crop = cluster.crop;
  const style = crop
    ? {
        backgroundImage: `url(${image})`,
        backgroundSize: `${(viewportW / crop.w) * 100}%`,
        backgroundPosition: `-${(crop.x / crop.w) * 100}% -${crop.y}px`,
      }
    : undefined;

  return (
    <div>
      <div className={`crop${crop ? "" : " none"}`} style={style}>
        {!crop ? "No crop" : null}
      </div>
      <div className="cinfo">
        <div className="clabel">{cluster.label}</div>
        <div className="crow">
          <span className="crole">{cluster.role}</span>
          <span className="cn">×{cluster.count}</span>
        </div>
        <div className="recipe">
          {cluster.recipe.map((r) => (
            <span key={r} className={`rt${cluster.warn && r.startsWith("r") ? " warn" : ""}`}>
              {r}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
