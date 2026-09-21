/**
 * The two rating marks, shared by the Teams and Roster tabs so a player's
 * numbers look identical wherever they appear.
 *
 * Both are drawn with the same trick: a rounded stroke painted in the fill
 * color, which fattens the arms and softens every join. That's the solid look
 * the ★ and ⚡ text glyphs can't give — and unlike glyphs, these render
 * identically on every platform.
 */

export function Star({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 3.4 14.35 8.76 20.18 9.34 15.8 13.24 17.06 18.96 12 16 6.94 18.96 8.2 13.24 3.82 9.34 9.65 8.76Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Bolt({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M14.2 2.4 5.2 13.6 10.4 13.6 9.4 21.6 18.6 10.2 13.2 10.2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Skill and running badges, used in both team lists and the roster. */
export function SkillBadge({ value }: { value: number }) {
  return (
    <span
      className="inline-flex w-9 shrink-0 items-center justify-center gap-0.5 rounded-md bg-pitch-soft py-0.5 text-xs font-bold text-pitch-deep"
      title={`skill ${value}/5`}
    >
      <Star className="h-3 w-3" />
      {value}
    </span>
  );
}

export function RunBadge({ value }: { value: number }) {
  return (
    <span
      className="inline-flex w-9 shrink-0 items-center justify-center gap-0.5 rounded-md bg-sky-50 py-0.5 text-xs font-semibold text-sky-700"
      title={`running ${value}/5`}
    >
      <Bolt className="h-3 w-3" />
      {value}
    </span>
  );
}
