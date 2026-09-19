/**
 * Map capture/scan failures to plain English for the enter stage.
 * Technical detail stays behind a details toggle — never invent a reason.
 */

export type ScanUserError = {
  /** One plain sentence: what happened + what to do */
  message: string;
  /** Raw / technical detail for the optional toggle */
  detail: string;
  /** Stable key for tests / screenshots */
  kind:
    | "dns"
    | "refused"
    | "timeout"
    | "forbidden"
    | "not_found"
    | "invalid_url"
    | "other";
};

const MESSAGES = {
  dns: "That domain doesn't resolve. Check the spelling, or try it in a browser first.",
  refused:
    "Nothing is answering at that address. If it's a local server, make sure it's running.",
  timeout:
    "The page took longer than 45 seconds to settle. Some sites hold the connection open — try again, or try a specific page rather than the homepage.",
  forbidden:
    "That page refused an automated browser. We can only measure pages a browser can open without signing in.",
  not_found: "That page doesn't exist at that address.",
  invalid_url:
    "That doesn't look like a web address. It needs to start with http:// or https://.",
  other:
    "The capture didn't complete. Nothing was measured, so there is nothing to report.",
} as const;

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Client-side invalid URL before any network call. */
export function invalidUrlError(raw: string): ScanUserError {
  return {
    kind: "invalid_url",
    message: MESSAGES.invalid_url,
    detail: raw.trim() ? `Entered: ${raw.trim()}` : "Empty URL",
  };
}

/**
 * Classify a thrown error / API detail string into a user-facing message.
 * Only maps reasons we can observe in the text — never invents.
 */
export function classifyScanError(err: unknown): ScanUserError {
  const detail =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String(err ?? "Unknown error");

  const text = detail.toLowerCase();

  if (
    text.includes("err_name_not_resolved") ||
    text.includes("enotfound") ||
    text.includes("getaddrinfo") ||
    text.includes("name_not_resolved") ||
    text.includes("dns")
  ) {
    // Avoid false DNS on unrelated "dns" substrings in stack noise —
    // require a clear resolution signal when only "dns" matched.
    if (
      text.includes("err_name_not_resolved") ||
      text.includes("enotfound") ||
      text.includes("getaddrinfo") ||
      text.includes("name_not_resolved") ||
      /dns.*(fail|error|resolv)/i.test(detail)
    ) {
      return { kind: "dns", message: MESSAGES.dns, detail };
    }
  }

  if (
    text.includes("err_connection_refused") ||
    text.includes("econnrefused") ||
    text.includes("connection refused")
  ) {
    return { kind: "refused", message: MESSAGES.refused, detail };
  }

  if (
    text.includes("timeout") ||
    text.includes("etimedout") ||
    text.includes("err_timed_out") ||
    text.includes("navigation timeout") ||
    text.includes("exceeded")
  ) {
    return { kind: "timeout", message: MESSAGES.timeout, detail };
  }

  // HTTP status / bot wall
  if (
    /\b401\b/.test(detail) ||
    /\b403\b/.test(detail) ||
    text.includes("unauthorized") ||
    text.includes("forbidden") ||
    text.includes("access denied") ||
    text.includes("bot") ||
    text.includes("captcha") ||
    text.includes("cf-challenge")
  ) {
    return { kind: "forbidden", message: MESSAGES.forbidden, detail };
  }

  if (/\b404\b/.test(detail) || text.includes("not found")) {
    // "No scan on file" is absence of our cache, not HTTP 404 of the page —
    // only treat as page 404 when capture/navigation reported it.
    if (
      text.includes("no scan on file") &&
      !text.includes("404") &&
      !/page\.goto.*404|status[=:]?\s*404|http\/1\.\d 404/i.test(detail)
    ) {
      // fall through — likely wrapped capture failure with other detail
    } else if (
      /\b404\b/.test(detail) ||
      text.includes("net::err_http_response_code_failure") ||
      /http.*404|status.*404|404.*not found/i.test(detail)
    ) {
      return { kind: "not_found", message: MESSAGES.not_found, detail };
    }
  }

  if (
    text.includes("invalid url") ||
    text.includes("valid http") ||
    text.includes("doesn't look like") ||
    text.includes("provide a valid")
  ) {
    return { kind: "invalid_url", message: MESSAGES.invalid_url, detail };
  }

  return { kind: "other", message: MESSAGES.other, detail };
}
