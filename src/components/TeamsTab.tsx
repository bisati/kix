"use client";

import { useState } from "react";
import { toShareText } from "@/lib/format";
import { SplitResult, TeamView } from "@/lib/types";

interface Props {
  result: SplitResult | null;
  onReroll: () => void;
  onSwap: (idX: string, idY: string) => void;
}

const POS_SHORT: Record<string, string> = {
  GK: "GK",
  Defence: "DEF",
  "Full-back": "FB",
  Midfield: "MID",
  Winger: "WNG",
  Striker: "ST",
};

function TeamCard({
  team,
  swapArmed,
  onRowTap,
  armedId,
}: {
  team: TeamView;
  swapArmed: boolean;
  onRowTap: (id: string) => void;
  armedId: string | null;
}) {
  return (
    <div className="flex-1 rounded-xl border border-stone-200 bg-white p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-bold">Team {team.team}</h3>
        <span className="text-xs text-stone-500">
          skill {team.skillTotal} · avg {team.skillAvg.toFixed(1)}
        </span>
      </div>
      <ul className="space-y-1">
        {team.rows.map((r) => (
          <li key={r.player.id}>
            <button
              onClick={() => onRowTap(r.player.id)}
              disabled={!swapArmed}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm ${
                armedId === r.player.id
                  ? "bg-amber-100 ring-1 ring-amber-400"
                  : swapArmed
                  ? "hover:bg-stone-100"
                  : ""
              }`}
            >
              <span
                className={`w-9 shrink-0 rounded px-1 text-center text-[10px] font-bold ${
                  r.isSecondary
                    ? "bg-amber-100 text-amber-800"
                    : "bg-stone-100 text-stone-600"
                }`}
                title={
                  r.isSecondary
                    ? `secondary (primary: ${r.player.primary})`
                    : "primary position"
                }
              >
                {POS_SHORT[r.position]}
                {r.isSecondary ? "*" : ""}
              </span>
              <span className="flex-1 truncate">{r.player.name}</span>
              <span className="text-xs text-stone-400">{r.player.skill}</span>
              {r.player.control && <span className="text-xs" title="game controller">🎮</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BalanceBar({
  label,
  a,
  b,
}: {
  label: string;
  a: number;
  b: number;
}) {
  const total = a + b || 1;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-stone-500">{label}</span>
      <span className="w-6 text-right font-semibold">{a}</span>
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
        <div
          className="bg-green-600"
          style={{ width: `${(a / total) * 100}%` }}
        />
        <div className="bg-sky-500" style={{ width: `${(b / total) * 100}%` }} />
      </div>
      <span className="w-6 font-semibold">{b}</span>
    </div>
  );
}

export default function TeamsTab({ result, onReroll, onSwap }: Props) {
  const [swapMode, setSwapMode] = useState(false);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!result) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
        No teams yet — pick today&apos;s players in the Match day tab and hit
        Build.
      </p>
    );
  }

  const { A, B } = result.teams;
  const teamOf = new Map(result.assignments.map((a) => [a.playerId, a.team]));

  const rowTap = (id: string) => {
    if (!armedId) {
      setArmedId(id);
      return;
    }
    if (armedId === id) {
      setArmedId(null);
      return;
    }
    if (teamOf.get(armedId) === teamOf.get(id)) {
      setArmedId(id); // same team: re-arm on the new player
      return;
    }
    onSwap(armedId, id);
    setArmedId(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toShareText(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (http, permissions) — show the text instead.
      window.prompt("Copy the team sheet:", toShareText(result));
    }
  };

  const passCount = result.checks.filter((c) => c.pass).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <TeamCard team={A} swapArmed={swapMode} onRowTap={rowTap} armedId={armedId} />
        <TeamCard team={B} swapArmed={swapMode} onRowTap={rowTap} armedId={armedId} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onReroll}
          className="flex-1 rounded-xl border border-stone-300 bg-white py-2.5 text-sm font-medium"
        >
          🎲 Re-roll
        </button>
        <button
          onClick={() => {
            setSwapMode(!swapMode);
            setArmedId(null);
          }}
          className={`flex-1 rounded-xl border py-2.5 text-sm font-medium ${
            swapMode
              ? "border-amber-400 bg-amber-50 text-amber-800"
              : "border-stone-300 bg-white"
          }`}
        >
          {swapMode ? "Tap two players to swap" : "↔️ Swap players"}
        </button>
        <button
          onClick={copy}
          className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white"
        >
          {copied ? "Copied ✓" : "📋 Copy for WhatsApp"}
        </button>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-3">
        <h3 className="mb-2 text-sm font-semibold text-stone-700">
          Balance <span className="text-green-700">A</span> v{" "}
          <span className="text-sky-600">B</span>
        </h3>
        <div className="space-y-1.5">
          <BalanceBar label="Skill total" a={A.skillTotal} b={B.skillTotal} />
          {[5, 4, 3, 2, 1].map((tier) => {
            const a = A.rows.filter((r) => r.player.skill === tier).length;
            const b = B.rows.filter((r) => r.player.skill === tier).length;
            if (a + b === 0) return null;
            return <BalanceBar key={tier} label={`${tier}-star players`} a={a} b={b} />;
          })}
          <BalanceBar label="Controllers 🎮" a={A.controllers} b={B.controllers} />
          <BalanceBar label="Running" a={A.runningTotal} b={B.runningTotal} />
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-3">
        <h3 className="mb-2 text-sm font-semibold text-stone-700">
          Verification — {passCount}/{result.checks.length} checks pass
        </h3>
        <ul className="space-y-1.5">
          {result.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              <span>{c.pass ? "✅" : "⚠️"}</span>
              <div>
                <p className={c.pass ? "text-stone-700" : "font-medium text-amber-800"}>
                  {c.label}
                </p>
                <p className="text-xs text-stone-400">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        {result.flags.length > 0 && (
          <div className="mt-3 border-t border-stone-100 pt-2">
            <p className="mb-1 text-xs font-semibold text-stone-500">Notes</p>
            <ul className="list-inside list-disc space-y-0.5 text-xs text-stone-500">
              {result.flags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
