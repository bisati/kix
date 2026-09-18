"use client";

import { useState } from "react";
import { Constraints, Player, Position, POSITIONS } from "@/lib/types";

interface Props {
  roster: Player[];
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  constraints: Constraints;
  setConstraints: (c: Constraints) => void;
  onBuild: () => void;
}

const GROUP_LABEL: Record<Position, string> = {
  GK: "In goal",
  Defence: "Defence",
  "Full-back": "Full-backs",
  Midfield: "Midfield",
  Winger: "Wingers",
  Striker: "Strikers",
};

export default function MatchDayTab({
  roster,
  selectedIds,
  setSelectedIds,
  constraints,
  setConstraints,
  onBuild,
}: Props) {
  const [query, setQuery] = useState("");
  const [pinX, setPinX] = useState("");
  const [pinY, setPinY] = useState("");
  const [pinKind, setPinKind] = useState<"apart" | "together">("apart");

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const q = query.trim().toLowerCase();
  const visible = roster.filter((p) => p.name.toLowerCase().includes(q));
  const selectedPlayers = roster.filter((p) => selectedIds.has(p.id));

  const addPin = () => {
    if (!pinX || !pinY || pinX === pinY) return;
    const pair: [string, string] = [pinX, pinY];
    setConstraints({ ...constraints, [pinKind]: [...constraints[pinKind], pair] });
    setPinX("");
    setPinY("");
  };

  const removePin = (kind: "apart" | "together", idx: number) => {
    setConstraints({
      ...constraints,
      [kind]: constraints[kind].filter((_, i) => i !== idx),
    });
  };

  const nameOf = (id: string) => roster.find((p) => p.id === id)?.name ?? id;
  const ready = selectedIds.size >= 4;

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">
            Who showed up?
          </h2>
          <div className="flex shrink-0 gap-1.5 text-xs font-semibold">
            <button
              onClick={() => setSelectedIds(new Set(roster.map((p) => p.id)))}
              className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-stone-600 transition-colors hover:border-pitch hover:text-pitch"
            >
              Everyone
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-stone-600 transition-colors hover:border-stone-400"
            >
              Clear
            </button>
          </div>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players…"
          type="search"
          className="mb-4 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-[15px] shadow-sm transition-shadow placeholder:text-stone-400 focus:border-pitch focus:shadow-md focus:outline-none"
        />

        <div className="space-y-4">
          {POSITIONS.map((pos) => {
            const group = visible.filter((p) => p.primary === pos);
            if (group.length === 0) return null;
            const groupSelected = group.filter((p) => selectedIds.has(p.id)).length;
            return (
              <div key={pos}>
                <p className="mb-1.5 flex items-baseline gap-2 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  {GROUP_LABEL[pos]}
                  {groupSelected > 0 && (
                    <span className="text-pitch">{groupSelected} in</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.map((p) => {
                    const on = selectedIds.has(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggle(p.id)}
                        aria-pressed={on}
                        className={`inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-pitch active:scale-95 ${
                          on
                            ? "border-pitch bg-pitch text-white shadow-sm shadow-pitch/30"
                            : "border-stone-200 bg-white text-stone-700 hover:border-pitch/50"
                        }`}
                      >
                        {on && (
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {p.name}
                        <span className={on ? "text-[11px] text-green-100" : "text-[11px] text-stone-400"}>
                          {p.skill}★{p.control ? " ·🎮" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="rounded-xl border border-dashed border-stone-200 py-6 text-center text-sm text-stone-400">
              No one matches “{query}”.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-bold">Pins</h3>
        <p className="mb-3 text-xs text-stone-400">
          Force a pair apart or together — pins outrank every balance rule.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={pinX}
            onChange={(e) => setPinX(e.target.value)}
            className="min-h-[2.5rem] rounded-lg border border-stone-200 bg-white px-2"
          >
            <option value="">Player…</option>
            {selectedPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={pinKind}
            onChange={(e) => setPinKind(e.target.value as "apart" | "together")}
            className="min-h-[2.5rem] rounded-lg border border-stone-200 bg-white px-2"
          >
            <option value="apart">vs</option>
            <option value="together">with</option>
          </select>
          <select
            value={pinY}
            onChange={(e) => setPinY(e.target.value)}
            className="min-h-[2.5rem] rounded-lg border border-stone-200 bg-white px-2"
          >
            <option value="">Player…</option>
            {selectedPlayers
              .filter((p) => p.id !== pinX)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <button
            onClick={addPin}
            disabled={!pinX || !pinY}
            className="min-h-[2.5rem] rounded-lg bg-ink px-4 font-semibold text-white transition-transform hover:-translate-y-px active:scale-95 disabled:opacity-30"
          >
            Pin it
          </button>
        </div>
        {(constraints.apart.length > 0 || constraints.together.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {constraints.apart.map(([x, y], i) => (
              <span
                key={`a${i}`}
                className="animate-pop inline-flex items-center gap-1.5 rounded-full bg-rose-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200"
              >
                {nameOf(x)} vs {nameOf(y)}
                <button
                  onClick={() => removePin("apart", i)}
                  aria-label="remove pin"
                  className="grid h-5 w-5 place-items-center rounded-full hover:bg-rose-100"
                >
                  ×
                </button>
              </span>
            ))}
            {constraints.together.map(([x, y], i) => (
              <span
                key={`t${i}`}
                className="animate-pop inline-flex items-center gap-1.5 rounded-full bg-teamb-soft py-1 pl-3 pr-1.5 text-xs font-semibold text-teamb-deep ring-1 ring-indigo-200"
              >
                {nameOf(x)} + {nameOf(y)}
                <button
                  onClick={() => removePin("together", i)}
                  aria-label="remove pin"
                  className="grid h-5 w-5 place-items-center rounded-full hover:bg-indigo-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Sticky build CTA, docked above the tab bar in thumb reach */}
      <div
        className="fixed inset-x-0 z-30"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-5xl px-4 pb-2">
          <button
            onClick={onBuild}
            disabled={!ready}
            className="cta w-full rounded-2xl py-3.5 text-base font-bold text-white shadow-lg shadow-pitch/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {ready
              ? `Build teams · ${selectedIds.size} players`
              : `Pick at least 4 players (${selectedIds.size}/4)`}
          </button>
        </div>
      </div>
    </div>
  );
}
