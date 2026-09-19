import {
  MATCH_FLOOR,
  formatPct,
  matchCorpus,
  resolveSite,
  type CorpusEntry,
  type CorpusMatch,
  type CorpusMatchResult,
  type TokenFingerprint,
} from "@/lib/corpus";

export type SamenessWallProps = {
  /** Host of the page just scanned. */
  host: string;
  /** Measured token sets from the scan. */
  fingerprint: TokenFingerprint;
  /** Parsed corpus sites (from public/corpus.json). Never invent placeholders. */
  corpus: readonly CorpusEntry[];
  /** Optional precomputed match result; if omitted, computed from props. */
  result?: CorpusMatchResult;
  className?: string;
};

/**
 * Position the scanned page against the measured corpus.
 * Missing entry / no twin ≥ 40% / no thumbnail → said on screen, never substituted.
 */
export function SamenessWall({
  host,
  fingerprint,
  corpus,
  result: resultProp,
  className,
}: SamenessWallProps) {
  const result = resultProp ?? matchCorpus(fingerprint, corpus, host);
  const identity = resolveSite(host, corpus);

  const showMatches = result.hasMatchAboveFloor;
  const matchesToShow = showMatches
    ? result.top5.filter((m) => m.score >= MATCH_FLOOR)
    : [];
  const top = result.closest;

  return (
    <section
      className={className}
      aria-labelledby="sameness-wall-heading"
      data-host={identity.host}
      data-corpus-key={identity.corpusKey}
    >
      <header className="mb-4">
        <h2 id="sameness-wall-heading" className="text-lg font-semibold tracking-tight">
          Where you sit in the corpus
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Weighted Jaccard against sites fingerprinted before this scan — not a design
          quality score.
        </p>
      </header>

      <SelfRow identityHost={identity.host} self={result.self} hasEntry={identity.hasCorpusEntry} />

      {result.absenceNote ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-absence="true"
          data-closest-score={result.closest ? String(result.closest.score) : undefined}
        >
          {result.absenceNote}
        </p>
      ) : null}

      {top ? (
        <div
          className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700"
          data-jaccard-inputs="true"
          data-top-host={top.host}
          data-top-score={String(top.score)}
        >
          <div className="font-medium text-neutral-900">
            Top candidate inputs — {top.host} → {formatPct(top.score)}
          </div>
          <ul className="mt-2 space-y-1 font-mono tabular-nums">
            {top.explain.channels.map((c) => (
              <li key={c.key}>
                {c.key}: w={c.weight} · scan={c.scanCount} · corpus={c.corpusCount} · ∩=
                {c.intersection} · J={c.jaccard.toFixed(3)} · wJ={c.weighted.toFixed(3)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!identity.hasThumbnail && identity.hasCorpusEntry ? (
        <p className="mt-2 text-sm text-neutral-600" data-missing-thumbnail="true">
          No thumbnail on file for {identity.host}.
        </p>
      ) : null}

      {showMatches && matchesToShow.length > 0 ? (
        <ol className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {matchesToShow.map((match, index) => (
            <MatchCard key={match.key} match={match} rank={index + 1} />
          ))}
        </ol>
      ) : null}

      {!showMatches && result.closest ? (
        <p className="mt-3 text-sm text-neutral-600" data-closest-host={result.closest.host}>
          Closest measured neighbour: {result.closest.host} at{" "}
          <span data-closest-pct>{formatPct(result.closest.score)}</span>
          {" "}(below the {formatPct(MATCH_FLOOR)} floor).
        </p>
      ) : null}
    </section>
  );
}

function SelfRow({
  identityHost,
  self,
  hasEntry,
}: {
  identityHost: string;
  self: CorpusMatch | null;
  hasEntry: boolean;
}) {
  if (!hasEntry || !self) {
    return (
      <p className="text-sm text-neutral-600" data-self-entry="missing">
        {identityHost} has no entry in the corpus.
      </p>
    );
  }

  return (
    <p className="text-sm text-neutral-700" data-self-entry="present">
      Your corpus row: <span className="font-medium">{self.host}</span>
      {self.score > 0 ? (
        <>
          {" "}
          — self-similarity {formatPct(self.score)}
        </>
      ) : null}
    </p>
  );
}

function MatchCard({ match, rank }: { match: CorpusMatch; rank: number }) {
  const id = resolveSite(match.host, [match.entry]);
  const thumb = id.hasThumbnail ? id.thumbnailPath : null;

  return (
    <li
      className="flex flex-col gap-2"
      data-match-host={match.host}
      data-match-score={String(match.score)}
      data-match-rank={rank}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- corpus thumbs are static public paths
        <img
          src={thumb}
          alt=""
          className="aspect-[16/10] w-full object-cover object-top"
        />
      ) : (
        <div
          className="flex aspect-[16/10] w-full items-center justify-center border border-dashed border-neutral-300 text-xs text-neutral-500"
          data-missing-thumbnail="true"
        >
          No thumbnail
        </div>
      )}
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium truncate">{match.host}</span>
        <span className="tabular-nums text-neutral-700">{formatPct(match.score)}</span>
      </div>
    </li>
  );
}

export default SamenessWall;
