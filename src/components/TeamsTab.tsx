"use client";

import { useState } from "react";
import { toShareText } from "@/lib/format";
import { POS_SHORT, Player, SplitResult, TeamView } from "@/lib/types";
import { Ball } from "@/components/Logo";
import { initials } from "@/components/MatchDayTab";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Bolt, RunBadge, SkillBadge, Star } from "@/components/Icons";

interface Props {
  result: SplitResult | null;
  prevResult: SplitResult | null;
  lastSwap: [string, string] | null;
  canUndo: boolean;
  onUndo: () => void;
  onReroll: () => void;
  onSwap: (idX: string, idY: string) => void;
  onGoPick: () => void;
}

/* Kit colors: Team A plays in white, Team B in red. The kit name appears in
   text beside every colored mark, so identity is never color-alone, and the
   white kit always wears a stone outline to stay visible on white cards. */
const TEAM_META = {
  A: {
    kit: "Whites",
    strip: "border-b border-stone-300 bg-teama",
    chip: "bg-teama text-ink ring-1 ring-stone-300",
  },
  B: {
    kit: "Reds",
    strip: "bg-teamb",
    chip: "bg-teamb text-white",
  },
} as const;

/* ---------------- List view ---------------- */

function TeamCard({
  team,
  swapArmed,
  onRowTap,
  armedId,
  swappedIds,
  delay,
}: {
  team: TeamView;
  swapArmed: boolean;
  onRowTap: (id: string) => void;
  armedId: string | null;
  swappedIds: Set<string>;
  delay: number;
}) {
  const meta = TEAM_META[team.team];
  return (
    <div
      className="animate-rise flex-1 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`h-1.5 ${meta.strip}`} />
      <div className="p-3.5">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <span
              className={`grid h-6 w-6 place-items-center rounded-lg text-xs font-black ${meta.chip}`}
            >
              {team.team}
            </span>
            Team {team.team}
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              {meta.kit}
            </span>
          </h3>
          <span className="flex items-center gap-1 text-xs font-semibold text-stone-500">
            <Star className="h-3.5 w-3.5 text-pitch" />
            {team.skillTotal} · avg {team.skillAvg.toFixed(1)} ·
            <Bolt className="h-3.5 w-3.5 text-sky-600" />
            {team.runningTotal}
          </span>
        </div>
        <ul className="space-y-0.5">
          {team.rows.map((r) => {
            const justSwapped = swappedIds.has(r.player.id);
            return (
              <li key={r.player.id}>
                <button
                  onClick={() => onRowTap(r.player.id)}
                  disabled={!swapArmed}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors ${
                    armedId === r.player.id
                      ? "bg-amber-100 ring-2 ring-amber-400"
                      : justSwapped
                      ? "bg-amber-50 ring-1 ring-amber-300"
                      : swapArmed
                      ? "cursor-pointer hover:bg-stone-50 active:bg-stone-100"
                      : ""
                  }`}
                >
                  <span
                    className={`w-10 shrink-0 rounded-md py-0.5 text-center text-[10px] font-extrabold ${
                      r.isSecondary
                        ? "bg-amber-100 text-amber-800"
                        : "bg-stone-100 text-stone-500"
                    }`}
                    title={
                      r.isSecondary
                        ? `out of position (primary: ${r.player.primary})`
                        : "primary position"
                    }
                  >
                    {POS_SHORT[r.position]}
                    {r.isSecondary ? "*" : ""}
                  </span>
                  <span className="flex-1 truncate font-medium">
                    {r.player.name}
                  </span>
                  {justSwapped && (
                    <span className="rounded-md bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                      ⇄ swapped
                    </span>
                  )}
                  {r.player.control && (
                    <span className="text-xs" title="game controller">
                      🎮
                    </span>
                  )}
                  {/* Skill is the headline rating, so it leads; running trails. */}
                  <SkillBadge value={r.player.skill} />
                  <RunBadge value={r.player.running} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Field view ---------------- */

/** Lines from the goal outward: GK → back line (FBs wide) → mid → front (WNGs wide). */
function fieldLines(team: TeamView) {
  const of = (pos: string) => team.rows.filter((r) => r.position === pos);
  const gk = of("GK");
  const fbs = of("Full-back");
  const defs = of("Defence");
  const back = [
    ...fbs.slice(0, Math.ceil(fbs.length / 2)),
    ...defs,
    ...fbs.slice(Math.ceil(fbs.length / 2)),
  ];
  const mid = of("Midfield");
  const wngs = of("Winger");
  const sts = of("Striker");
  const front = [
    ...wngs.slice(0, Math.ceil(wngs.length / 2)),
    ...sts,
    ...wngs.slice(Math.ceil(wngs.length / 2)),
  ];
  return [gk, back, mid, front].filter((line) => line.length > 0);
}

/** Kit shirt with the player's initials on the chest: white for A, red for B. */
function Jersey({
  name,
  team,
  armed,
  swapped,
  hoverable,
}: {
  name: string;
  team: "A" | "B";
  armed: boolean;
  swapped: boolean;
  hoverable: boolean;
}) {
  const white = team === "A";
  return (
    <svg
      viewBox="0 0 64 60"
      aria-hidden="true"
      className={`h-11 w-11 drop-shadow-md transition-transform ${
        armed ? "scale-110" : hoverable ? "hover:scale-110" : ""
      }`}
    >
      <path
        d="M23 5 L8 13 L13 29 L20 25 L20 55 L44 55 L44 25 L51 29 L56 13 L41 5 C38 12 26 12 23 5 Z"
        fill={white ? "#ffffff" : "var(--color-teamb)"}
        stroke={
          armed || swapped
            ? "#fbbf24"
            : white
            ? "#a8a29e"
            : "var(--color-teamb-deep)"
        }
        strokeWidth={armed ? 3 : 2}
        strokeLinejoin="round"
      />
      <text
        x="32"
        y="41"
        textAnchor="middle"
        fontSize="16"
        fontWeight="800"
        fill={white ? "var(--color-ink)" : "#ffffff"}
      >
        {initials(name)}
      </text>
    </svg>
  );
}

function FieldDot({
  row,
  team,
  swapArmed,
  armedId,
  swappedIds,
  onTap,
}: {
  row: TeamView["rows"][number];
  team: "A" | "B";
  swapArmed: boolean;
  armedId: string | null;
  swappedIds: Set<string>;
  onTap: (id: string) => void;
}) {
  const p: Player = row.player;
  const armed = armedId === p.id;
  const justSwapped = swappedIds.has(p.id);
  return (
    <button
      onClick={() => onTap(p.id)}
      disabled={!swapArmed}
      className={`flex w-14 flex-col items-center ${
        swapArmed ? "cursor-pointer" : ""
      }`}
      title={`${p.name} · ${row.position}${row.isSecondary ? " (secondary)" : ""}`}
    >
      <span className="relative">
        <Jersey
          name={p.name}
          team={team}
          armed={armed}
          swapped={justSwapped}
          hoverable={swapArmed && !armed}
        />
        {row.isSecondary && (
          <span
            className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-400 text-[9px] font-black text-amber-950 shadow"
            title={`out of position (primary: ${p.primary})`}
          >
            *
          </span>
        )}
        {justSwapped && (
          <span className="absolute -left-1.5 -top-1.5 grid h-4.5 w-4.5 animate-pop place-items-center rounded-full bg-amber-400 text-[9px] font-black text-amber-950 shadow">
            ⇄
          </span>
        )}
      </span>
      <span className="max-w-full truncate rounded bg-black/45 px-1 py-px text-[9.5px] font-semibold leading-tight text-white">
        {p.name}
      </span>
    </button>
  );
}

function FieldView({
  A,
  B,
  swapArmed,
  armedId,
  swappedIds,
  onTap,
}: {
  A: TeamView;
  B: TeamView;
  swapArmed: boolean;
  armedId: string | null;
  swappedIds: Set<string>;
  onTap: (id: string) => void;
}) {
  const half = (team: TeamView, invert: boolean) => {
    const lines = fieldLines(team);
    const ordered = invert ? lines : [...lines].reverse();
    return (
      <div className="flex flex-1 flex-col justify-around py-2">
        {ordered.map((line, i) => (
          <div key={i} className="flex items-center justify-evenly px-2">
            {line.map((row) => (
              <FieldDot
                key={row.player.id}
                row={row}
                team={team.team}
                swapArmed={swapArmed}
                armedId={armedId}
                swappedIds={swappedIds}
                onTap={onTap}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="animate-rise relative mx-auto max-w-md overflow-hidden rounded-2xl border border-pitch-deep/30 shadow-md">
      <div className="absolute inset-0 bg-gradient-to-b from-[#1d8a4a] via-[#177a41] to-[#1d8a4a]">
        {/* mowing stripes */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              "repeating-linear-gradient(0deg, #fff 0 44px, transparent 44px 88px)",
          }}
        />
      </div>
      {/* pitch markings */}
      <svg
        viewBox="0 0 300 480"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-40"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
      >
        <rect x="8" y="8" width="284" height="464" rx="2" />
        <line x1="8" y1="240" x2="292" y2="240" />
        <circle cx="150" cy="240" r="36" />
        <circle cx="150" cy="240" r="2.5" fill="#fff" />
        <rect x="75" y="8" width="150" height="52" />
        <rect x="117" y="8" width="66" height="22" />
        <rect x="75" y="420" width="150" height="52" />
        <rect x="117" y="450" width="66" height="22" />
      </svg>

      <div className="relative flex h-[520px] flex-col">
        {/* Team B defends the top goal */}
        <div className="absolute left-2.5 top-2.5 z-10 rounded-lg bg-teamb px-2 py-0.5 text-[10px] font-black text-white shadow">
          TEAM B · REDS
        </div>
        {half(B, true)}
        {half(A, false)}
        <div className="absolute bottom-2.5 right-2.5 z-10 rounded-lg bg-teama px-2 py-0.5 text-[10px] font-black text-ink shadow">
          TEAM A · WHITES
        </div>
      </div>
    </div>
  );
}

/* ---------------- Swap impact ---------------- */

function tierStacking(t: TeamView, other: TeamView): number {
  let v = 0;
  for (const tier of [5, 4, 3, 2, 1]) {
    const a = t.rows.filter((r) => r.player.skill === tier).length;
    const b = other.rows.filter((r) => r.player.skill === tier).length;
    v += Math.max(0, Math.abs(a - b) - 1);
  }
  return v;
}

function secondaries(t: TeamView) {
  return t.rows.filter((r) => r.isSecondary).length;
}

interface ImpactRow {
  label: string;
  before: number;
  after: number;
  higherIsBetter?: boolean;
}

function SwapImpact({
  prev,
  curr,
  names,
  onUndo,
}: {
  prev: SplitResult;
  curr: SplitResult;
  names: [string, string];
  onUndo: () => void;
}) {
  const rows: ImpactRow[] = [
    {
      label: "Skill gap",
      before: Math.abs(prev.teams.A.skillTotal - prev.teams.B.skillTotal),
      after: Math.abs(curr.teams.A.skillTotal - curr.teams.B.skillTotal),
    },
    {
      label: "Stacked tiers",
      before: tierStacking(prev.teams.A, prev.teams.B),
      after: tierStacking(curr.teams.A, curr.teams.B),
    },
    {
      label: "Controller gap",
      before: Math.abs(prev.teams.A.controllers - prev.teams.B.controllers),
      after: Math.abs(curr.teams.A.controllers - curr.teams.B.controllers),
    },
    {
      label: "Running gap",
      before: Math.abs(prev.teams.A.runningTotal - prev.teams.B.runningTotal),
      after: Math.abs(curr.teams.A.runningTotal - curr.teams.B.runningTotal),
    },
    {
      label: "Out-of-position gap",
      before: Math.abs(secondaries(prev.teams.A) - secondaries(prev.teams.B)),
      after: Math.abs(secondaries(curr.teams.A) - secondaries(curr.teams.B)),
    },
    {
      label: "Checks passing",
      before: prev.checks.filter((c) => c.pass).length,
      after: curr.checks.filter((c) => c.pass).length,
      higherIsBetter: true,
    },
  ];
  const changed = rows.filter((r) => r.before !== r.after);

  const prevPass = new Map(prev.checks.map((c) => [c.id, c.pass]));
  const flipped = curr.checks.filter(
    (c) => prevPass.has(c.id) && prevPass.get(c.id) !== c.pass
  );

  return (
    <section className="animate-pop rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-amber-950">
          ⇄ Swapped {names[0]} & {names[1]}
        </h3>
        <button
          onClick={onUndo}
          className="min-h-[2.2rem] rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-900 shadow-sm transition-all hover:-translate-y-px active:scale-95"
        >
          ↩ Undo swap
        </button>
      </div>

      {changed.length === 0 && flipped.length === 0 ? (
        <p className="text-xs font-medium text-amber-800">
          Perfectly even trade. No balance metric moved.
        </p>
      ) : (
        <div className="space-y-1.5">
          {changed.map((r) => {
            const improved = r.higherIsBetter
              ? r.after > r.before
              : r.after < r.before;
            return (
              <div key={r.label} className="flex items-center gap-2 text-xs">
                <span className="w-36 shrink-0 font-medium text-stone-600">
                  {r.label}
                </span>
                <span className="font-bold tabular-nums text-stone-500">
                  {r.before}
                </span>
                <svg viewBox="0 0 16 16" className="h-3 w-3 stroke-stone-400" fill="none" strokeWidth="2">
                  <path d="M2 8h11M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-bold tabular-nums text-ink">{r.after}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    improved
                      ? "bg-pitch-soft text-pitch-deep"
                      : "bg-amber-200 text-amber-900"
                  }`}
                >
                  {improved ? "better" : "worse"}
                </span>
              </div>
            );
          })}
          {flipped.map((c) => (
            <p key={c.id} className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
              <span
                className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-black text-white ${
                  c.pass ? "bg-pitch" : "bg-amber-500"
                }`}
              >
                {c.pass ? "✓" : "!"}
              </span>
              {c.pass ? "Now passing:" : "This broke:"} {c.label}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- Balance & checks (unchanged visuals) ---------------- */

function BalanceBar({ label, a, b }: { label: string; a: number; b: number }) {
  const total = a + b || 1;
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className="w-24 shrink-0 font-medium text-stone-500">{label}</span>
      <span className="w-7 shrink-0 text-right font-bold tabular-nums text-ink">
        {a}
      </span>
      <div className="flex h-2 flex-1 gap-[2px]">
        <div
          className="animate-bar rounded-l-[4px] bg-teama ring-1 ring-inset ring-teama-line"
          style={{ width: `calc(${(a / total) * 100}% - 1px)` }}
        />
        <div
          className="animate-bar rounded-r-[4px] bg-teamb"
          style={{ width: `calc(${(b / total) * 100}% - 1px)` }}
        />
      </div>
      <span className="w-7 shrink-0 font-bold tabular-nums text-ink">{b}</span>
    </div>
  );
}

/* ---------------- Tab ---------------- */

export default function TeamsTab({
  result,
  prevResult,
  lastSwap,
  canUndo,
  onUndo,
  onReroll,
  onSwap,
  onGoPick,
}: Props) {
  const [view, setView] = useState<"list" | "field">("list");
  const [swapMode, setSwapMode] = useState(false);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmReroll, setConfirmReroll] = useState(false);

  if (!result) {
    return (
      <div className="animate-rise flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-stone-200 px-6 py-14 text-center">
        <Ball className="h-12 w-12 opacity-70" />
        <div>
          <p className="font-bold">No teams yet</p>
          <p className="mt-1 text-sm text-stone-500">
            Pick today&apos;s players and Kix will split them fairly.
          </p>
        </div>
        <button
          onClick={onGoPick}
          className="cta rounded-xl px-5 py-2.5 text-sm font-bold text-white"
        >
          Pick players
        </button>
      </div>
    );
  }

  const { A, B } = result.teams;
  const teamOf = new Map(result.assignments.map((a) => [a.playerId, a.team]));
  const swappedIds = new Set(lastSwap ?? []);
  const nameOf = (id: string) =>
    result.assignments.length
      ? [...A.rows, ...B.rows].find((r) => r.player.id === id)?.player.name ?? id
      : id;

  const rowTap = (id: string) => {
    if (!swapMode) return;
    if (!armedId) return setArmedId(id);
    if (armedId === id) return setArmedId(null);
    if (teamOf.get(armedId) === teamOf.get(id)) return setArmedId(id);
    onSwap(armedId, id);
    setArmedId(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toShareText(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy the team sheet:", toShareText(result));
    }
  };

  const passCount = result.checks.filter((c) => c.pass).length;
  const allPass = passCount === result.checks.length;

  return (
    <div className="gap-5 lg:grid lg:grid-cols-[1fr_21rem] lg:items-start">
      {/* Left column: teams + actions */}
      <div className="space-y-4">
        {/* View toggle */}
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
            {(["list", "field"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`min-h-[2.2rem] rounded-lg px-4 text-xs font-bold capitalize transition-colors ${
                  view === v
                    ? "bg-pitch text-white shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {v === "list" ? "☰ List" : "▦ Field"}
              </button>
            ))}
          </div>
          {canUndo && !lastSwap && (
            <button
              onClick={onUndo}
              className="text-xs font-bold text-stone-500 underline underline-offset-2 hover:text-ink"
            >
              ↩ Undo last swap
            </button>
          )}
        </div>

        {lastSwap && prevResult && (
          <SwapImpact
            prev={prevResult}
            curr={result}
            names={[nameOf(lastSwap[0]), nameOf(lastSwap[1])]}
            onUndo={onUndo}
          />
        )}

        {view === "list" ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <TeamCard team={A} swapArmed={swapMode} onRowTap={rowTap} armedId={armedId} swappedIds={swappedIds} delay={0} />
            <TeamCard team={B} swapArmed={swapMode} onRowTap={rowTap} armedId={armedId} swappedIds={swappedIds} delay={80} />
          </div>
        ) : (
          <FieldView
            A={A}
            B={B}
            swapArmed={swapMode}
            armedId={armedId}
            swappedIds={swappedIds}
            onTap={rowTap}
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setConfirmReroll(true)}
            className="min-h-[2.9rem] flex-1 rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-700 shadow-sm transition-all hover:-translate-y-px hover:border-pitch hover:text-pitch active:scale-95"
          >
            ↻ Re-roll
          </button>
          <button
            onClick={() => {
              setSwapMode(!swapMode);
              setArmedId(null);
            }}
            aria-pressed={swapMode}
            className={`min-h-[2.9rem] flex-1 rounded-xl border text-sm font-bold shadow-sm transition-all active:scale-95 ${
              swapMode
                ? "border-amber-400 bg-amber-50 text-amber-800"
                : "border-stone-200 bg-white text-stone-700 hover:-translate-y-px hover:border-amber-400"
            }`}
          >
            {swapMode ? "Tap 2 players…" : "⇄ Swap"}
          </button>
          <button
            onClick={copy}
            className="cta min-h-[2.9rem] flex-[1.4] rounded-xl text-sm font-bold text-white"
          >
            {copied ? "Copied ✓" : "Share to WhatsApp"}
          </button>
        </div>
        {swapMode && (
          <p className="animate-rise -mt-2 text-center text-xs font-medium text-amber-700">
            Swap mode: tap one player from each team. Works in both views.
          </p>
        )}
      </div>

      {/* Right rail: proof */}
      <div className="mt-5 space-y-4 lg:mt-0">
        <section className="animate-rise rounded-2xl border border-stone-200 bg-white p-4 shadow-sm" style={{ animationDelay: "120ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">Balance</h3>
            <span className="flex items-center gap-3 text-[11px] font-semibold text-stone-500">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-teama ring-1 ring-inset ring-stone-400" />{" "}
                Team A
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-teamb" /> Team B
              </span>
            </span>
          </div>
          <div className="space-y-2">
            <BalanceBar label="Skill total" a={A.skillTotal} b={B.skillTotal} />
            {[5, 4, 3, 2, 1].map((tier) => {
              const a = A.rows.filter((r) => r.player.skill === tier).length;
              const b = B.rows.filter((r) => r.player.skill === tier).length;
              if (a + b === 0) return null;
              return <BalanceBar key={tier} label={`${tier}-star players`} a={a} b={b} />;
            })}
            <BalanceBar label="Controllers" a={A.controllers} b={B.controllers} />
            <BalanceBar label="Running" a={A.runningTotal} b={B.runningTotal} />
          </div>
        </section>

        <section className="animate-rise rounded-2xl border border-stone-200 bg-white p-4 shadow-sm" style={{ animationDelay: "180ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold">Fairness checks</h3>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                allPass
                  ? "bg-pitch-soft text-pitch-deep"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {passCount}/{result.checks.length} pass
            </span>
          </div>
          <ul className="space-y-2">
            {result.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2.5 text-sm">
                <span
                  aria-label={c.pass ? "pass" : "attention"}
                  className={`mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full text-[10px] font-black text-white ${
                    c.pass ? "bg-pitch" : "bg-amber-500"
                  }`}
                >
                  {c.pass ? "✓" : "!"}
                </span>
                <div className="min-w-0">
                  <p
                    className={`leading-tight ${
                      c.pass ? "font-medium text-stone-700" : "font-bold text-amber-900"
                    }`}
                  >
                    {c.label}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-stone-400">
                    {c.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {result.flags.length > 0 && (
            <div className="mt-3 border-t border-stone-100 pt-2.5">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Notes
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-xs text-stone-500">
                {result.flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmReroll}
        title="Re-roll the teams?"
        body="Kix builds a fresh split from the same squad. Today's teams are replaced, along with any swaps you've made, and this arrangement can't be brought back."
        confirmLabel="Re-roll teams"
        tone="neutral"
        onConfirm={() => {
          setConfirmReroll(false);
          setSwapMode(false);
          setArmedId(null);
          onReroll();
        }}
        onCancel={() => setConfirmReroll(false)}
      />
    </div>
  );
}
