"use client";

import { useState } from "react";
import { Constraints, Player } from "@/lib/types";

interface Props {
  roster: Player[];
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  constraints: Constraints;
  setConstraints: (c: Constraints) => void;
  onBuild: () => void;
}

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

  const visible = roster.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const selectedPlayers = roster.filter((p) => selectedIds.has(p.id));

  const addPin = () => {
    if (!pinX || !pinY || pinX === pinY) return;
    const pair: [string, string] = [pinX, pinY];
    setConstraints({
      ...constraints,
      [pinKind]: [...constraints[pinKind], pair],
    });
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

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">
            Who&apos;s playing today?
          </h2>
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setSelectedIds(new Set(roster.map((p) => p.id)))}
              className="text-green-700 underline"
            >
              all
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-stone-500 underline"
            >
              none
            </button>
          </div>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players…"
          className="mb-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          {visible.map((p) => {
            const on = selectedIds.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  on
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-stone-300 bg-white text-stone-700"
                }`}
              >
                {p.name}
                <span className={`ml-1 text-[10px] ${on ? "text-green-100" : "text-stone-400"}`}>
                  {p.primary === "Full-back" ? "FB" : p.primary === "Midfield" ? "MID" : p.primary === "Defence" ? "DEF" : p.primary === "Winger" ? "WING" : p.primary === "Striker" ? "ST" : "GK"}·{p.skill}
                </span>
              </button>
            );
          })}
          {visible.length === 0 && (
            <p className="text-sm text-stone-400">No players match.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-3">
        <h3 className="mb-2 text-sm font-semibold text-stone-700">
          Pins <span className="font-normal text-stone-400">(optional)</span>
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={pinX}
            onChange={(e) => setPinX(e.target.value)}
            className="rounded-lg border border-stone-300 px-2 py-1.5"
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
            className="rounded-lg border border-stone-300 px-2 py-1.5"
          >
            <option value="apart">opposite teams</option>
            <option value="together">same team</option>
          </select>
          <select
            value={pinY}
            onChange={(e) => setPinY(e.target.value)}
            className="rounded-lg border border-stone-300 px-2 py-1.5"
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
            className="rounded-lg bg-stone-800 px-3 py-1.5 text-white disabled:opacity-40"
          >
            Pin
          </button>
        </div>
        {(constraints.apart.length > 0 || constraints.together.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {constraints.apart.map(([x, y], i) => (
              <span
                key={`a${i}`}
                className="rounded-full bg-red-50 px-2 py-1 text-xs text-red-700"
              >
                {nameOf(x)} ⇄ {nameOf(y)} apart{" "}
                <button onClick={() => removePin("apart", i)} className="font-bold">
                  ×
                </button>
              </span>
            ))}
            {constraints.together.map(([x, y], i) => (
              <span
                key={`t${i}`}
                className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700"
              >
                {nameOf(x)} + {nameOf(y)} together{" "}
                <button onClick={() => removePin("together", i)} className="font-bold">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onBuild}
        disabled={selectedIds.size < 4}
        className="w-full rounded-xl bg-green-600 py-3 text-base font-semibold text-white shadow-sm transition disabled:opacity-40"
      >
        {selectedIds.size < 4
          ? `Select at least 4 players (${selectedIds.size})`
          : `Build teams for ${selectedIds.size} players`}
      </button>
    </div>
  );
}
