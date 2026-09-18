"use client";

import { useState } from "react";
import { toShareText } from "@/lib/format";
import { SplitResult, TeamView } from "@/lib/types";
import { Ball } from "@/components/Logo";

interface Props {
  result: SplitResult | null;
  onReroll: () => void;
  onSwap: (idX: string, idY: string) => void;
  onGoPick: () => void;
}

const POS_SHORT: Record<string, string> = {
  GK: "GK",
  Defence: "DEF",
  "Full-back": "FB",
  Midfield: "MID",
  Winger: "WNG",
  Striker: "ST",
};

const TEAM_META = {
  A: { color: "var(--color-pitch)", chip: "bg-pitch", soft: "bg-pitch-soft" },
  B: { color: "var(--color-teamb)", chip: "bg-teamb", soft: "bg-teamb-soft" },
} as const;

function TeamCard({
  team,
  swapArmed,
  onRowTap,
  armedId,
  delay,
}: {
  team: TeamView;
  swapArmed: boolean;
  onRowTap: (id: string) => void;
  armedId: string | null;
  delay: number;
}) {
  const meta = TEAM_META[team.team];
  return (
    <div
      className="animate-rise flex-1 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="h-1.5" style={{ background: meta.color }} />
      <div className="p-3.5">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h3 className="flex items-center gap-2 text-base font-extrabold">
            <span
              className={`grid h-6 w-6 place-items-center rounded-lg text-xs font-black text-white ${meta.chip}`}
            >
              {team.team}
            </span>
            Team {team.team}
          </h3>
          <span className="text-xs font-semibold text-stone-500">
            {team.skillTotal} skill · {team.skillAvg.toFixed(1)} avg
          </span>
        </div>
        <ul className="space-y-0.5">
          {team.rows.map((r) => (
            <li key={r.player.id}>
              <button
                onClick={() => onRowTap(r.player.id)}
                disabled={!swapArmed}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors ${
                  armedId === r.player.id
                    ? "bg-amber-100 ring-2 ring-amber-400"
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
                {r.player.control && (
                  <span className="text-xs" title="game controller">
                    🎮
                  </span>
                )}
                <span className="w-7 rounded-md bg-stone-50 py-0.5 text-center text-xs font-bold text-stone-600">
                  {r.player.skill}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A-vs-B comparison meter: two fills on one track, 2px surface gap, ink labels. */
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
          className="animate-bar rounded-l-[4px] bg-pitch"
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

export default function TeamsTab({ result, onReroll, onSwap, onGoPick }: Props) {
  const [swapMode, setSwapMode] = useState(false);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const rowTap = (id: string) => {
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
        <div className="flex flex-col gap-3 sm:flex-row">
          <TeamCard team={A} swapArmed={swapMode} onRowTap={rowTap} armedId={armedId} delay={0} />
          <TeamCard team={B} swapArmed={swapMode} onRowTap={rowTap} armedId={armedId} delay={80} />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onReroll}
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
            Swap mode: tap one player from each team — Kix re-verifies after the swap.
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
                <span className="h-2.5 w-2.5 rounded-[3px] bg-pitch" /> Team A
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
    </div>
  );
}
