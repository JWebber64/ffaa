import type { DraftOrderMode } from "./types";

export function ModeArtwork({ mode }: { mode: DraftOrderMode }) {
  if (mode === "draft-dash") {
    return <svg viewBox="0 0 240 120" role="img" aria-label="Football helmets racing across a marked field"><rect x="8" y="8" width="224" height="104" rx="14" /><path d="M38 8v104M70 8v104M102 8v104M134 8v104M166 8v104M198 8v104" /><path className="art-ball" d="M72 42c14-11 31-9 40 2-5 16-18 23-38 16-5-6-5-12-2-18Z" /><path className="art-ball" d="M119 70c17-10 32-7 40 5-7 14-22 18-39 10-4-5-4-10-1-15Z" /><path className="art-finish" d="M208 20v80M216 20v80" /></svg>;
  }
  if (mode === "football-plinko") {
    return <svg viewBox="0 0 240 120" role="img" aria-label="Football tokens falling through a stadium Plinko board"><path d="M54 22v79M186 22v79M54 29h132" /><g className="art-pegs">{[0, 1, 2, 3].flatMap((row) => Array.from({ length: 6 }, (_, column) => <circle key={`${row}-${column}`} cx={74 + column * 19 + (row % 2) * 9} cy={43 + row * 15} r="3" />))}</g><path className="art-ball" d="M112 17c8-6 18-5 24 2-3 10-12 14-23 9-3-4-3-7-1-11Z" /><path d="M67 96h106M78 82v24M99 82v24M120 82v24M141 82v24M162 82v24" /></svg>;
  }
  return <svg viewBox="0 0 240 120" role="img" aria-label="A football arcing over yard markers"><path d="M18 96h204M42 84v24M82 84v24M122 84v24M162 84v24M202 84v24" /><path className="art-arc" d="M35 87C76 17 143 16 200 74" /><path className="art-ball" d="M181 62c10-6 21-4 27 4-5 9-15 12-25 6-3-3-3-7-2-10Z" /><path d="m206 79 8-2-4 8" /></svg>;
}
