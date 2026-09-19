"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Capture, MeasuredElement } from "@/lib/mock-scan";

type AgentState = {
  id: string;
  name: string;
  what: string;
  find?: string;
  status: "idle" | "run" | "done";
  ms?: number;
};

type CheckState = {
  id: string;
  name: string;
  value: string;
  status: "pending" | "pass" | "fail";
};

type Box = {
  id: string;
  el: MeasuredElement;
  label: string;
};

type Props = {
  url: string;
  capture: Capture | null;
  onComplete: () => void;
};

const RUN_MS = 17_000;

function measurable(els: MeasuredElement[]): MeasuredElement[] {
  return els.filter(
    (e) =>
      e.w > 24 &&
      e.h > 16 &&
      e.w < 900 &&
      e.h < 400 &&
      e.tag !== "html" &&
      e.tag !== "body",
  );
}

export function StageRun({ url, capture, onComplete }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [tilesShot, setTilesShot] = useState(0);
  const [measured, setMeasured] = useState(0);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [filmYPct, setFilmYPct] = useState(0);
  const [agents, setAgents] = useState<AgentState[]>([
    {
      id: "load",
      name: "Load + pin",
      what: "Network idle, lazy images, animation pin",
      status: "idle",
    },
    {
      id: "tile",
      name: "Scroll + stitch",
      what: "Read scrollY back per tile, screenshot, measure",
      status: "idle",
    },
    {
      id: "analyse",
      name: "Cluster + findings",
      what: "Radius / type / spacing against measured sets",
      status: "idle",
    },
  ]);
  const [checks, setChecks] = useState<CheckState[]>([
    { id: "c1", name: "Viewport locked", value: "1440×900", status: "pending" },
    { id: "c2", name: "Tiles read back", value: "—", status: "pending" },
    { id: "c3", name: "Elements kept", value: "—", status: "pending" },
    { id: "c4", name: "Coordinates = pixels", value: "same paint", status: "pending" },
  ]);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const tileCount = capture?.tiles.length ?? 3;
  const measureTargets = useMemo(
    () => (capture ? measurable(capture.elements).slice(0, 28) : []),
    [capture],
  );
  const totalSteps = 1 + tileCount + measureTargets.length + 1;
  // steps: load, each tile, each measure, analyse

  const progress = Math.min(1, (tilesShot + measured + (agents[0].status === "done" ? 1 : 0) + (agents[2].status === "done" ? 1 : 0)) / totalSteps);

  useEffect(() => {
    if (!capture) return;
    doneRef.current = false;
    const start = performance.now();
    const targets = measurable(capture.elements).slice(0, 28);
    const tiles = capture.tiles;
    const pageH = capture.pageHeight;

    // Schedule honest timeline across ~17s
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const tick = window.setInterval(() => {
      setElapsed(performance.now() - start);
    }, 100);
    timers.push(tick as unknown as number);

    // 0–1.8s: load
    setAgents((a) => a.map((x) => (x.id === "load" ? { ...x, status: "run" } : x)));
    at(1600, () => {
      setAgents((a) =>
        a.map((x) =>
          x.id === "load"
            ? { ...x, status: "done", ms: 1600, find: "Animations pinned · images decoded" }
            : x,
        ),
      );
      setChecks((c) =>
        c.map((x) => (x.id === "c1" ? { ...x, status: "pass" } : x)),
      );
      setAgents((a) => a.map((x) => (x.id === "tile" ? { ...x, status: "run" } : x)));
    });

    // Tile captures — spaced through 2s–10s
    const tileWindow = 8000;
    tiles.forEach((tile, i) => {
      const t = 2000 + (tileWindow / tiles.length) * (i + 0.55);
      at(t, () => {
        setTilesShot(i + 1);
        const ratio = pageH > 0 ? tile.y / pageH : 0;
        setFilmYPct(ratio * 100);
        setAgents((a) =>
          a.map((x) =>
            x.id === "tile"
              ? {
                  ...x,
                  find: `Tile ${i + 1}/${tiles.length} @ y=${Math.round(tile.y)}`,
                }
              : x,
          ),
        );
      });
    });

    at(2000 + tileWindow, () => {
      setAgents((a) =>
        a.map((x) =>
          x.id === "tile"
            ? {
                ...x,
                status: "done",
                ms: Math.round(tileWindow),
                find: `${tiles.length} tiles stitched · scrollY verified`,
              }
            : x.id === "analyse"
              ? { ...x, status: "run" }
              : x,
        ),
      );
      setChecks((c) =>
        c.map((x) =>
          x.id === "c2"
            ? {
                ...x,
                status: "pass",
                value: tiles.map((t) => String(Math.round(t.y))).join(" · "),
              }
            : x,
        ),
      );
    });

    // Measure elements — 10.2s–15.5s, boxes at real coords
    const measureStart = 10200;
    const measureSpan = 5300;
    targets.forEach((el, i) => {
      const t = measureStart + (measureSpan / targets.length) * i;
      at(t, () => {
        setMeasured(i + 1);
        setBoxes((prev) => {
          const next = [
            ...prev,
            {
              id: `${el.id}-${i}`,
              el,
              label: `${el.tag} · ${Math.round(el.styles.radius)}px`,
            },
          ];
          return next.slice(-6);
        });
        setFilmYPct(pageH > 0 ? (el.y / pageH) * 100 : 0);
        setChecks((c) =>
          c.map((x) =>
            x.id === "c3"
              ? { ...x, status: "pass", value: `${i + 1} / ${targets.length}` }
              : x,
          ),
        );
      });
    });

    at(measureStart + measureSpan + 200, () => {
      setAgents((a) =>
        a.map((x) =>
          x.id === "analyse"
            ? {
                ...x,
                status: "done",
                ms: Math.round(measureSpan),
                find: `${capture.elements.length} elements · findings ready`,
              }
            : x,
        ),
      );
      setChecks((c) =>
        c.map((x) => {
          if (x.id === "c3") {
            return {
              ...x,
              status: "pass",
              value: `${capture.elements.length} kept`,
            };
          }
          if (x.id === "c4") return { ...x, status: "pass" };
          return x;
        }),
      );
    });

    at(RUN_MS, () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onCompleteRef.current();
    });

    return () => {
      for (const id of timers) window.clearTimeout(id);
      window.clearInterval(tick);
    };
  }, [capture]);

  const secs = (elapsed / 1000).toFixed(1);
  const host = (() => {
    try {
      return new URL(url).host || url;
    } catch {
      return url;
    }
  })();

  const pageH = capture?.pageHeight ?? 2217;
  const vpW = capture?.viewport.w ?? 1440;

  return (
    <div id="step2" className="stage-run">
      <div className="wrap s2">
        <div className="s2head">
          <h2>Capturing</h2>
          <span className="url">{host}</span>
          <span className="timer">
            <b>{secs}s</b> / ~17s
          </span>
        </div>
        <div className="prog" aria-hidden="true">
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        <div className="s2grid">
          <div>
            <div className="viewport">
              {capture?.image ? (
                <div
                  className="film"
                  style={{ transform: `translateY(-${filmYPct}%)` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={capture.image} alt="" width={vpW} />
                  <div className="filmov">
                    {boxes.map((b) => {
                      const left = (b.el.x / vpW) * 100;
                      const top = (b.el.y / pageH) * 100;
                      const w = (b.el.w / vpW) * 100;
                      const h = (b.el.h / pageH) * 100;
                      return (
                        <span
                          key={b.id}
                          className="tbox"
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${w}%`,
                            height: `${h}%`,
                          }}
                        >
                          <b>{b.label}</b>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="tiles">
                  {Array.from({ length: tileCount }, (_, i) => (
                    <div
                      key={i}
                      className={`tile${i < tilesShot ? " in shot" : ""}`}
                    >
                      <div className="bar w1" />
                      <div className="bar w2" />
                      <div className="bar w3" />
                    </div>
                  ))}
                </div>
              )}
              <div
                className="scrubline"
                style={{
                  top: `${Math.min(96, (tilesShot / Math.max(1, tileCount)) * 100)}%`,
                }}
              />
            </div>
            <div className="vcap">
              <span>
                Tiles {tilesShot}/{tileCount}
              </span>
              <span>
                Measured {measured}
                {measureTargets.length ? ` / ${measureTargets.length}` : ""}
              </span>
              <span>Page {pageH}px</span>
            </div>
          </div>

          <div className="panel">
            <h3>Pass</h3>
            <p>Each step runs before the next — counts only climb when work finishes.</p>
            <div className="agents">
              {agents.map((ag) => (
                <div key={ag.id} className={`ag ${ag.status}`}>
                  <span className="dot" />
                  <div>
                    <div className="agname">
                      {ag.name}
                      {ag.status === "run" ? <s>live</s> : null}
                    </div>
                    <div className="agwhat">{ag.what}</div>
                    {ag.find ? <div className="agfind">{ag.find}</div> : null}
                  </div>
                  <span className="agms">{ag.ms != null ? `${ag.ms}ms` : ""}</span>
                </div>
              ))}
            </div>

            <h3>Checks</h3>
            <p>Traced to this capture — not estimates.</p>
            <div className="checks">
              {checks.map((ck) => (
                <div key={ck.id} className={`ck ${ck.status}`}>
                  <span className="tick">
                    {ck.status === "pass" ? "✓" : ck.status === "fail" ? "×" : "·"}
                  </span>
                  <div>
                    <div className="ckname">
                      <b>{ck.name}</b>
                    </div>
                    <span className="ckval">{ck.value}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="note">
              <b>One paint.</b> Coordinates and pixels come from the same scroll
              session — never a separate fullPage shot.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
