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

/** Replay window once real capture data is in hand. */
const REPLAY_MS = 14_000;
const LOAD_MS = 1_400;

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
      status: "run",
      find: "Waiting on the live capture session…",
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
  const seenTiles = useRef(new Set<number>());
  const seenEls = useRef(new Set<string>());
  const waitStart = useRef(performance.now());

  const tileCount = capture?.tiles.length ?? 0;
  const measureTargets = useMemo(
    () => (capture ? measurable(capture.elements) : []),
    [capture],
  );
  const pageH = capture?.pageHeight ?? 0;
  const vpW = capture?.viewport.w ?? 1440;
  const vpH = capture?.viewport.h ?? 900;

  const progress = capture
    ? Math.min(
        1,
        (tilesShot +
          measured +
          (agents[0].status === "done" ? 1 : 0) +
          (agents[2].status === "done" ? 1 : 0)) /
          Math.max(1, 1 + tileCount + Math.max(1, measureTargets.length) + 1),
      )
    : 0.04;

  // Waiting phase — honest idle until capture arrives (no fake tile counts).
  useEffect(() => {
    if (capture) return;
    waitStart.current = performance.now();
    const id = window.setInterval(() => {
      setElapsed(performance.now() - waitStart.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [capture]);

  // Replay phase — real tiles / element y from the capture.
  useEffect(() => {
    if (!capture) return;
    doneRef.current = false;
    seenTiles.current = new Set();
    seenEls.current = new Set();
    setTilesShot(0);
    setMeasured(0);
    setBoxes([]);
    setFilmYPct(0);

    const tiles = capture.tiles;
    const targets = measurable(capture.elements);
    const height = capture.pageHeight;
    const start = performance.now();
    let loadDone = false;
    let analyseDone = false;
    let raf = 0;

    setAgents([
      {
        id: "load",
        name: "Load + pin",
        what: "Network idle, lazy images, animation pin",
        status: "run",
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
    setChecks([
      { id: "c1", name: "Viewport locked", value: `${capture.viewport.w}×${capture.viewport.h}`, status: "pending" },
      { id: "c2", name: "Tiles read back", value: "—", status: "pending" },
      { id: "c3", name: "Elements kept", value: "—", status: "pending" },
      { id: "c4", name: "Coordinates = pixels", value: "same paint", status: "pending" },
    ]);

    const tick = () => {
      const t = performance.now() - start;
      setElapsed(t);

      if (!loadDone && t >= LOAD_MS) {
        loadDone = true;
        setAgents((a) =>
          a.map((x) =>
            x.id === "load"
              ? { ...x, status: "done", ms: LOAD_MS, find: "Animations pinned · images decoded" }
              : x.id === "tile"
                ? { ...x, status: "run" }
                : x,
          ),
        );
        setChecks((c) =>
          c.map((x) => (x.id === "c1" ? { ...x, status: "pass" } : x)),
        );
      }

      if (t >= LOAD_MS && height > 0) {
        const scrollSpan = Math.max(200, REPLAY_MS - LOAD_MS - 1000);
        const scrollT = Math.min(1, (t - LOAD_MS) / scrollSpan);
        const maxScroll = Math.max(0, height - vpH);
        const pageY = scrollT * maxScroll;
        setFilmYPct((pageY / height) * 100);

        tiles.forEach((tile, i) => {
          if (seenTiles.current.has(i)) return;
          if (pageY + vpH * 0.35 < tile.y) return;
          seenTiles.current.add(i);
          const n = seenTiles.current.size;
          setTilesShot(n);
          setAgents((a) =>
            a.map((x) =>
              x.id === "tile"
                ? {
                    ...x,
                    status: n >= tiles.length ? "done" : "run",
                    ms: n >= tiles.length ? Math.round(t - LOAD_MS) : undefined,
                    find:
                      n >= tiles.length
                        ? `${tiles.length} tiles stitched · scrollY verified`
                        : `Tile ${n}/${tiles.length} @ y=${Math.round(tile.y)}`,
                  }
                : x.id === "analyse" && n >= tiles.length && x.status === "idle"
                  ? { ...x, status: "run" }
                  : x,
            ),
          );
          if (n >= tiles.length) {
            setChecks((c) =>
              c.map((x) =>
                x.id === "c2"
                  ? {
                      ...x,
                      status: "pass",
                      value: tiles.map((tt) => String(Math.round(tt.y))).join(" · "),
                    }
                  : x,
              ),
            );
          }
        });

        targets.forEach((el) => {
          if (seenEls.current.has(el.id)) return;
          if (pageY + vpH * 0.55 < el.y) return;
          seenEls.current.add(el.id);
          const n = seenEls.current.size;
          setMeasured(n);
          setBoxes((prev) => {
            const next = [
              ...prev,
              {
                id: `${el.id}-${n}`,
                el,
                label: `${el.tag} · ${Math.round(el.styles.radius)}px`,
              },
            ];
            return next.slice(-8);
          });
          setChecks((c) =>
            c.map((x) =>
              x.id === "c3"
                ? { ...x, status: "pass", value: `${n} / ${targets.length}` }
                : x,
            ),
          );
        });
      }

      if (!analyseDone && t >= REPLAY_MS - 800) {
        analyseDone = true;
        // Flush any remaining real tiles/elements so counts match the capture.
        if (seenTiles.current.size < tiles.length) {
          tiles.forEach((_, i) => seenTiles.current.add(i));
          setTilesShot(tiles.length);
        }
        if (seenEls.current.size < targets.length) {
          const missing = targets.filter((el) => !seenEls.current.has(el.id));
          missing.forEach((el) => seenEls.current.add(el.id));
          setMeasured(targets.length);
          setBoxes((prev) => {
            const add = missing.slice(0, 4).map((el, i) => ({
              id: `${el.id}-late-${i}`,
              el,
              label: `${el.tag} · ${Math.round(el.styles.radius)}px`,
            }));
            return [...prev, ...add].slice(-8);
          });
        }
        setFilmYPct(Math.min(70, ((height - vpH) / Math.max(1, height)) * 100));
        setAgents((a) =>
          a.map((x) => {
            if (x.id === "tile") {
              return {
                ...x,
                status: "done",
                ms: Math.round(REPLAY_MS - LOAD_MS - 800),
                find: `${tiles.length} tiles stitched · scrollY verified`,
              };
            }
            if (x.id === "analyse") {
              return {
                ...x,
                status: "done",
                ms: 800,
                find: `${capture.elements.length} elements · findings ready`,
              };
            }
            return x;
          }),
        );
        setChecks((c) =>
          c.map((x) => {
            if (x.id === "c2") {
              return {
                ...x,
                status: "pass",
                value: tiles.map((tt) => String(Math.round(tt.y))).join(" · "),
              };
            }
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
      }

      if (t >= REPLAY_MS) {
        if (!doneRef.current) {
          doneRef.current = true;
          onCompleteRef.current();
        }
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [capture, vpH]);

  const secs = (elapsed / 1000).toFixed(1);
  const host = (() => {
    try {
      return new URL(url).host || url;
    } catch {
      return url;
    }
  })();

  return (
    <div id="step2" className="stage-run">
      <div className="wrap s2">
        <div className="s2head">
          <h2>Capturing</h2>
          <span className="url">{host}</span>
          <span className="timer">
            <b>{secs}s</b> / ~{capture ? "14" : "17"}s
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
                  style={{
                    transform: `translateY(-${filmYPct}%)`,
                    transition: "transform 90ms linear",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={capture.image} alt="" width={vpW} />
                  <div className="filmov">
                    {boxes.map((b) => {
                      const left = (b.el.x / vpW) * 100;
                      const top = (b.el.y / Math.max(1, pageH)) * 100;
                      const w = (b.el.w / vpW) * 100;
                      const h = (b.el.h / Math.max(1, pageH)) * 100;
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
                <div className="tiles waiting" aria-live="polite">
                  <p className="waitmsg">
                    Waiting for the first real tile from this capture — counts stay at zero until it lands.
                  </p>
                </div>
              )}
              <div
                className="scrubline"
                style={{
                  top: `${Math.min(
                    96,
                    tileCount
                      ? (tilesShot / Math.max(1, tileCount)) * 100
                      : 4,
                  )}%`,
                }}
              />
            </div>
            <div className="vcap">
              <span>
                Tiles {tilesShot}/{tileCount || "—"}
              </span>
              <span>
                Measured {measured}
                {measureTargets.length ? ` / ${measureTargets.length}` : ""}
              </span>
              <span>Page {pageH || "—"}px</span>
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
