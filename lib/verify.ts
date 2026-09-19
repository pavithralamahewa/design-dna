/**
 * Verify postconditions against a re-capture.
 * Named targets only — never checks that the old value's page-wide count hit zero.
 */

import { capturePageWithMeasure } from "./measure";
import type { CaptureElement, CaptureResult } from "./capture";
import {
  emitPostconditions,
  emitPostconditionsFromElements,
  styleKeyFromCssProperty,
  valuesMatch,
  formatPx,
  type Finding,
  type MeasuredElement,
  type Postcondition,
  type StylePropertyKey,
} from "./postconditions";

export type VerifyTargetResult = {
  id: string;
  resolved: string;
  status: "PASS" | "FAIL" | "MISSING";
};

export type VerifyResult = {
  id: string;
  status: "PASS" | "FAIL" | "UNSUPPORTED";
  targets: VerifyTargetResult[];
};

function readResolved(
  el: MeasuredElement | CaptureElement,
  styleKey: StylePropertyKey,
): string | null {
  const styles = el.styles;
  if (styleKey === "color") {
    if (!styles.color) return null;
    return styles.color;
  }
  const n = styles[styleKey];
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return formatPx(n);
}

/**
 * Check each postcondition against measured elements.
 * PASS only when EVERY target resolves to expected.
 * FAIL if any target keeps before, a third value, or is missing.
 * UNSUPPORTED if the property cannot be measured reliably.
 */
export function checkPostconditions(
  elements: MeasuredElement[] | CaptureElement[],
  postconditions: Postcondition[],
): VerifyResult[] {
  const byId = new Map(elements.map((e) => [e.id, e]));

  return postconditions.map((pc) => {
    const styleKey = styleKeyFromCssProperty(pc.property);
    if (!styleKey) {
      return {
        id: pc.id,
        status: "UNSUPPORTED" as const,
        targets: pc.targets.map((id) => ({
          id,
          resolved: "",
          status: "MISSING" as const,
        })),
      };
    }

    const targets: VerifyTargetResult[] = [];
    let anyUnsupported = false;

    for (const tid of pc.targets) {
      const el = byId.get(tid);
      if (!el) {
        targets.push({ id: tid, resolved: "", status: "MISSING" });
        continue;
      }
      const resolved = readResolved(el, styleKey);
      if (resolved === null) {
        anyUnsupported = true;
        targets.push({ id: tid, resolved: "", status: "MISSING" });
        continue;
      }
      const ok = valuesMatch(resolved, pc.expected, styleKey);
      targets.push({
        id: tid,
        resolved,
        status: ok ? "PASS" : "FAIL",
      });
    }

    if (anyUnsupported && targets.every((t) => t.status === "MISSING")) {
      return { id: pc.id, status: "UNSUPPORTED", targets };
    }

    const allPass =
      targets.length > 0 && targets.every((t) => t.status === "PASS");
    return {
      id: pc.id,
      status: allPass ? "PASS" : "FAIL",
      targets,
    };
  });
}

export type VerifyRequest = {
  url: string;
  postconditions: Postcondition[];
  /** Optional findings — when provided without postconditions, emit first. */
  findings?: Finding[];
};

export type VerifyResponse = {
  url: string;
  host: string;
  capturedAt: string;
  viewport: { w: number; h: number };
  results: VerifyResult[];
  /** Echo of postconditions that were checked */
  postconditions: Postcondition[];
};

/**
 * Re-run capture on the same URL at the capture viewport, then check
 * each postcondition against named targets only.
 */
export async function verifyUrl(
  url: string,
  postconditions: Postcondition[],
): Promise<{ capture: CaptureResult; response: VerifyResponse }> {
  const capture = await capturePageWithMeasure(url);
  const results = checkPostconditions(capture.elements, postconditions);
  return {
    capture,
    response: {
      url: capture.url,
      host: capture.host,
      capturedAt: capture.capturedAt,
      viewport: capture.viewport,
      results,
      postconditions,
    },
  };
}

export {
  emitPostconditions,
  emitPostconditionsFromElements,
  checkPostconditions as verifyPostconditions,
};
