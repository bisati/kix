"use client";

import { useEffect, useRef, useState } from "react";
import { Constraints, Player, Position } from "@/lib/types";
import { Ball } from "@/components/Logo";

interface Props {
  roster: Player[];
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  constraints: Constraints;
  setConstraints: (c: Constraints) => void;
  onBuild: () => void;
}

const POS_SHORT: Record<Position, string> = {
  GK: "GK",
  Defence: "DEF",
  "Full-back": "FB",
  Midfield: "MID",
  Winger: "WNG",
  Striker: "ST",
};

/* Deterministic pastel avatar per player. */
const AVATAR_STYLES = [
  "bg-emerald-200 text-emerald-950",
  "bg-sky-200 text-sky-950",
  "bg-violet-200 text-violet-950",
  "bg-amber-200 text-amber-950",
  "bg-rose-200 text-rose-950",
  "bg-lime-200 text-lime-950",
];

function avatarStyle(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_STYLES[h % AVATAR_STYLES.length];
}

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ name, className = "h-8 w-8 text-[11px]" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-bold ${avatarStyle(name)} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

function Hero() {
  return (
    <div className="relative h-24 overflow-hidden rounded-2xl bg-gradient-to-r from-pitch-deep via-pitch to-[#22a04f] shadow-sm sm:h-28">
      {/* pitch markings */}
      <svg
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-25"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
      >
        <rect x="8" y="8" width="384" height="84" rx="4" />
        <line x1="200" y1="8" x2="200" y2="92" />
        <circle cx="200" cy="50" r="22" />
        <rect x="8" y="28" width="42" height="44" />
        <rect x="350" y="28" width="42" height="44" />
      </svg>
      <div className="relative flex h-full items-center justify-between px-5">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Match day
          </h2>
          <p className="text-xs font-medium text-green-100 sm:text-sm">
            Pick your squad — Kix does the rest.
          </p>
        </div>
        <span className="rotate-12 drop-shadow-md">
          <Ball className="h-12 w-12 sm:h-14 sm:w-14" />
        </span>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  selected,
  onToggle,
}: {
  player: Player;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      role="option"
      aria-selected={selected}
      className="flex min-h-[2.9rem] w-full items-center gap-3 px-3.5 py-1.5 text-left transition-colors hover:bg-stone-50 active:bg-stone-100"
    >
      <Avatar name={player.name} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {player.name}
      </span>
      <span className="w-11 shrink-0 rounded-md bg-stone-100 py-1 text-center text-[10px] font-extrabold text-stone-500">
        {POS_SHORT[player.primary]}
      </span>
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all ${
          selected
            ? "border-pitch bg-pitch text-white"
            : "border-stone-300 text-transparent"
        }`}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
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
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [pinX, setPinX] = useState("");
  const [pinY, setPinY] = useState("");
  const [pinKind, setPinKind] = useState<"apart" | "together">("apart");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const q = query.trim().toLowerCase();
  const selectedPlayers = roster.filter((p) => selectedIds.has(p.id));
  // Search filters only the available list; the Selected group stays visible.
  const available = roster.filter(
    (p) => !selectedIds.has(p.id) && p.name.toLowerCase().includes(q)
  );

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
    <div className="space-y-5">
      <Hero />

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-base font-bold tracking-tight">Who showed up?</h3>
          {selectedIds.size > 0 && (
            <span className="text-xs font-semibold text-pitch">
              {selectedIds.size} in the squad
            </span>
          )}
        </div>

        {/* Searchable player picker */}
        <div ref={boxRef} className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 shadow-sm transition-shadow focus-within:border-pitch focus-within:shadow-md">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0 stroke-stone-400" fill="none" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.8-3.8" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              placeholder="Search & add players…"
              role="combobox"
              aria-expanded={open}
              className="min-h-[2.9rem] w-full bg-transparent text-[15px] placeholder:text-stone-400 focus:outline-none"
            />
            <button
              onClick={() => setOpen(!open)}
              aria-label={open ? "close player list" : "open player list"}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-stone-100"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {open && (
            <div className="animate-pop absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-stone-100 px-3.5 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  {roster.length} in roster
                </span>
                <div className="flex gap-1 text-xs font-semibold">
                  <button
                    onClick={() => setSelectedIds(new Set(roster.map((p) => p.id)))}
                    className="rounded-lg px-2.5 py-1.5 text-pitch hover:bg-pitch-soft"
                  >
                    Everyone
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="rounded-lg px-2.5 py-1.5 text-stone-500 hover:bg-stone-100"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-ink px-3 py-1.5 text-white"
                  >
                    Done
                  </button>
                </div>
              </div>

              <div className="max-h-[46vh] overflow-y-auto overscroll-contain">
                {selectedPlayers.length > 0 && (
                  <div>
                    <p className="sticky top-0 z-10 bg-pitch-soft/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-pitch-deep backdrop-blur-sm">
                      Selected · {selectedPlayers.length}
                    </p>
                    {selectedPlayers.map((p) => (
                      <PlayerRow
                        key={p.id}
                        player={p}
                        selected
                        onToggle={() => toggle(p.id)}
                      />
                    ))}
                  </div>
                )}
                <div>
                  <p className="sticky top-0 z-10 bg-stone-50/90 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-400 backdrop-blur-sm">
                    {q ? `Matching “${query.trim()}”` : "Available"} ·{" "}
                    {available.length}
                  </p>
                  {available.map((p) => (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      selected={false}
                      onToggle={() => toggle(p.id)}
                    />
                  ))}
                  {available.length === 0 && (
                    <p className="px-3.5 py-4 text-center text-sm text-stone-400">
                      {q ? `No one else matches “${query.trim()}”.` : "Everyone's in!"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Squad summary on the page — compact, removable */}
        {selectedPlayers.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selectedPlayers.map((p) => (
              <span
                key={p.id}
                className="animate-pop inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white py-1 pl-1 pr-1.5 text-xs font-semibold text-stone-700 shadow-sm"
              >
                <Avatar name={p.name} className="h-6 w-6 text-[9px]" />
                {p.name}
                <button
                  onClick={() => toggle(p.id)}
                  aria-label={`remove ${p.name}`}
                  className="grid h-5 w-5 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-stone-400">
            Tap the search box to start picking today&apos;s squad.
          </p>
        )}
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
