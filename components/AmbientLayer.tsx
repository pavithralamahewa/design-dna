"use client";

/** Persistent ambient dials — must stay mounted across stage changes. */
export function AmbientLayer() {
  // Static SVG geometry (no Math.*) so SSR and client markup match.
  return (
    <div id="amb" aria-hidden="true">
      <div className="s1grid" />
      <div className="s1cell" style={{ left: "calc(50% - 208px)", top: "28%" }} />
      <div
        className="s1cell"
        style={{ left: "calc(50% + 104px)", top: "42%", animationDelay: "3s" }}
      />
      <div
        className="s1cell"
        style={{ left: "calc(50% - 52px)", top: "58%", animationDelay: "6s" }}
      />
      <div className="s1bg">
        <svg className="dial d1" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r="92"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeWidth="0.6"
          />
          <circle
            cx="100"
            cy="100"
            r="68"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeWidth="0.5"
            strokeDasharray="2 6"
          />
          <g stroke="currentColor" strokeOpacity="0.14" strokeWidth="0.5">
            <line x1="100" y1="8" x2="100" y2="22" />
            <line x1="100" y1="178" x2="100" y2="192" />
            <line x1="8" y1="100" x2="22" y2="100" />
            <line x1="178" y1="100" x2="192" y2="100" />
            <line x1="35" y1="35" x2="45" y2="45" />
            <line x1="155" y1="155" x2="165" y2="165" />
            <line x1="165" y1="35" x2="155" y2="45" />
            <line x1="45" y1="155" x2="35" y2="165" />
            <line x1="100" y1="30" x2="100" y2="38" strokeOpacity="0.08" />
            <line x1="100" y1="162" x2="100" y2="170" strokeOpacity="0.08" />
            <line x1="30" y1="100" x2="38" y2="100" strokeOpacity="0.08" />
            <line x1="162" y1="100" x2="170" y2="100" strokeOpacity="0.08" />
          </g>
        </svg>
        <svg className="dial d2" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.14"
            strokeWidth="0.5"
          />
          <g stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.45">
            <line x1="100" y1="46" x2="100" y2="54" />
            <line x1="100" y1="146" x2="100" y2="154" />
            <line x1="46" y1="100" x2="54" y2="100" />
            <line x1="146" y1="100" x2="154" y2="100" />
            <line x1="64" y1="64" x2="70" y2="70" />
            <line x1="130" y1="130" x2="136" y2="136" />
            <line x1="136" y1="64" x2="130" y2="70" />
            <line x1="70" y1="130" x2="64" y2="136" />
          </g>
        </svg>
      </div>
      <div className="s1rule" style={{ top: "18%" }} />
      <div className="s1rule" style={{ top: "82%" }} />
    </div>
  );
}
