"use client";

import { useEffect, useRef, useState } from "react";
import { Instruction, OverrideValues, Severity } from "@/lib/instructions";
import { Player, Position, POSITIONS } from "@/lib/types";
import { Ball } from "@/components/Logo";

interface Props {
  roster: Player[];
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  instructions: Instruction[];
  setInstructions: (i: Instruction[]) => void;
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

export function initials(name: string) {
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

/*
 * Every layer keeps its own aspect ratio (fixed height, w-auto, cropped by
 * the card) — nothing stretches at any viewport width. The stripes tile,
 * the goal mouth anchors left, the center circle sits behind the ball, and
 * a tactics doodle fills the desktop middle.
 */
function Hero() {
  return (
    <div className="relative h-24 overflow-hidden rounded-2xl bg-gradient-to-r from-pitch-deep via-pitch to-[#22a04f] shadow-sm sm:h-28 lg:h-32">
      {/* mowing stripes */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          background:
            "repeating-linear-gradient(90deg, #fff 0 52px, transparent 52px 104px)",
        }}
      />
      {/* left: goal mouth, zoomed past the card edges */}
      <svg
        viewBox="0 0 150 160"
        className="absolute -left-1 top-1/2 h-[135%] w-auto -translate-y-1/2 opacity-25"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
      >
        <line x1="4" y1="0" x2="4" y2="160" />
        <rect x="4" y="20" width="88" height="120" />
        <rect x="4" y="50" width="36" height="60" />
        <circle cx="70" cy="80" r="3" fill="#fff" stroke="none" />
        <path d="M92 52a38 38 0 0 1 0 56" />
      </svg>
      {/* right: halfway line + center circle, the ball sits on the spot */}
      <svg
        viewBox="0 0 160 160"
        className="absolute -right-10 top-1/2 h-[135%] w-auto -translate-y-1/2 opacity-20"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
      >
        <line x1="80" y1="0" x2="80" y2="160" />
        <circle cx="80" cy="80" r="52" />
      </svg>
      {/* desktop middle: chalkboard doodle — X makes the run over to O */}
      <svg
        viewBox="0 0 220 100"
        className="absolute right-32 top-1/2 hidden h-full w-auto -translate-y-1/2 opacity-30 md:block"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
      >
        <path
          d="M42 58C78 16 148 14 182 48"
          strokeDasharray="1 8"
          strokeLinecap="round"
        />
        <path d="M182 48l-11-3m11 3-2-11" strokeLinecap="round" />
        <path d="M28 62l14 14m0-14-14 14" strokeWidth="3" strokeLinecap="round" />
        <circle cx="196" cy="68" r="9" strokeWidth="3" />
      </svg>
      <div className="relative flex h-full items-center justify-between px-5 sm:px-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Match day
          </h2>
          <p className="text-xs font-medium text-green-100 sm:text-sm">
            Pick your squad — Kix does the rest.
          </p>
        </div>
        <span className="rotate-12 drop-shadow-md">
          <Ball className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16" />
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

/* ---------------- Instructions ---------------- */

type InstrKind = "pair" | "injury" | "override";

const KIND_META: Record<InstrKind, { label: string; icon: string }> = {
  pair: { label: "Pair", icon: "⇄" },
  injury: { label: "Injury", icon: "🩹" },
  override: { label: "Today's rating", icon: "✏️" },
};

function InstructionsSection({
  selectedPlayers,
  instructions,
  setInstructions,
  nameOf,
}: {
  selectedPlayers: Player[];
  instructions: Instruction[];
  setInstructions: (i: Instruction[]) => void;
  nameOf: (id: string) => string;
}) {
  const [kind, setKind] = useState<InstrKind>("pair");
  const [pinX, setPinX] = useState("");
  const [pinY, setPinY] = useState("");
  const [pinMode, setPinMode] = useState<"apart" | "together">("apart");
  const [injuredId, setInjuredId] = useState("");
  const [severity, setSeverity] = useState<Severity>("mild");
  const [overrideId, setOverrideId] = useState("");
  const [draft, setDraft] = useState<OverrideValues | null>(null);

  const playerSelect = (
    value: string,
    onChange: (v: string) => void,
    exclude?: string
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-[2.5rem] rounded-lg border border-stone-200 bg-white px-2 text-sm"
    >
      <option value="">Player…</option>
      {selectedPlayers
        .filter((p) => p.id !== exclude)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  );

  const add = (ins: Instruction) => {
    // One injury and one override per player: adding again replaces.
    const rest =
      ins.kind === "pair"
        ? instructions
        : instructions.filter(
            (i) => !(i.kind === ins.kind && i.playerId === ins.playerId)
          );
    setInstructions([...rest, ins]);
  };

  const remove = (idx: number) =>
    setInstructions(instructions.filter((_, i) => i !== idx));

  const chooseOverridePlayer = (id: string) => {
    setOverrideId(id);
    const p = selectedPlayers.find((x) => x.id === id);
    setDraft(
      p
        ? {
            primary: p.primary,
            secondary: p.secondary,
            skill: p.skill,
            running: p.running,
            control: p.control,
          }
        : null
    );
  };

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-bold">Instructions</h3>
      <p className="mb-3 text-xs text-stone-400">
        Tell the engine about today — pairs to split or keep, knocks, one-day
        form. Applies to this match only; your roster is untouched.
      </p>

      {/* Type selector */}
      <div className="mb-3 inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1">
        {(Object.keys(KIND_META) as InstrKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`min-h-[2.1rem] rounded-lg px-3 text-xs font-bold transition-colors ${
              kind === k
                ? "bg-white text-ink shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {KIND_META[k].icon} {KIND_META[k].label}
          </button>
        ))}
      </div>

      {/* Pair form */}
      {kind === "pair" && (
        <div className="flex flex-wrap items-center gap-2">
          {playerSelect(pinX, setPinX)}
          <select
            value={pinMode}
            onChange={(e) => setPinMode(e.target.value as "apart" | "together")}
            className="min-h-[2.5rem] rounded-lg border border-stone-200 bg-white px-2 text-sm"
          >
            <option value="apart">opposite teams</option>
            <option value="together">same team</option>
          </select>
          {playerSelect(pinY, setPinY, pinX)}
          <button
            onClick={() => {
              if (!pinX || !pinY || pinX === pinY) return;
              add({ kind: "pair", mode: pinMode, a: pinX, b: pinY });
              setPinX("");
              setPinY("");
            }}
            disabled={!pinX || !pinY}
            className="min-h-[2.5rem] rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-transform hover:-translate-y-px active:scale-95 disabled:opacity-30"
          >
            Add
          </button>
        </div>
      )}

      {/* Injury form */}
      {kind === "injury" && (
        <div className="flex flex-wrap items-center gap-2">
          {playerSelect(injuredId, setInjuredId)}
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
            className="min-h-[2.5rem] rounded-lg border border-stone-200 bg-white px-2 text-sm"
          >
            <option value="mild">Mild — running −1</option>
            <option value="serious">Serious — running −2, skill −1</option>
          </select>
          <button
            onClick={() => {
              if (!injuredId) return;
              add({ kind: "injury", playerId: injuredId, severity });
              setInjuredId("");
              setSeverity("mild");
            }}
            disabled={!injuredId}
            className="min-h-[2.5rem] rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-transform hover:-translate-y-px active:scale-95 disabled:opacity-30"
          >
            Add
          </button>
        </div>
      )}

      {/* Today's rating form */}
      {kind === "override" && (
        <div className="space-y-3">
          {playerSelect(overrideId, chooseOverridePlayer)}
          {draft && (
            <div className="animate-pop rounded-xl border border-violet-200 bg-violet-50/50 p-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-stone-500">
                  Primary
                  <select
                    value={draft.primary}
                    onChange={(e) =>
                      setDraft({ ...draft, primary: e.target.value as Position })
                    }
                    className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm font-normal text-ink"
                  >
                    {POSITIONS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-stone-500">
                  Secondary
                  <select
                    value={draft.secondary}
                    onChange={(e) =>
                      setDraft({ ...draft, secondary: e.target.value as Position })
                    }
                    className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm font-normal text-ink"
                  >
                    {POSITIONS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-stone-500">
                  Skill · {draft.skill}
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={draft.skill}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        skill: +e.target.value as Player["skill"],
                      })
                    }
                    className="accent-violet-600"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-stone-500">
                  Running · {draft.running}
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={draft.running}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        running: +e.target.value as Player["running"],
                      })
                    }
                    className="accent-violet-600"
                  />
                </label>
                <label className="col-span-2 flex items-center gap-2 text-xs font-semibold text-stone-600">
                  <input
                    type="checkbox"
                    checked={draft.control}
                    onChange={(e) =>
                      setDraft({ ...draft, control: e.target.checked })
                    }
                    className="h-4 w-4 accent-violet-600"
                  />
                  Game controller 🎮 today
                </label>
              </div>
              <button
                onClick={() => {
                  if (!overrideId || !draft) return;
                  add({ kind: "override", playerId: overrideId, values: draft });
                  setOverrideId("");
                  setDraft(null);
                }}
                className="mt-3 min-h-[2.4rem] rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white transition-transform hover:-translate-y-px active:scale-95"
              >
                Set for today
              </button>
            </div>
          )}
        </div>
      )}

      {/* Active instructions */}
      {instructions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {instructions.map((ins, i) => {
            let cls = "";
            let text = "";
            if (ins.kind === "pair") {
              cls =
                ins.mode === "apart"
                  ? "bg-rose-50 text-rose-700 ring-rose-200"
                  : "bg-indigo-50 text-indigo-700 ring-indigo-200";
              text = `⇄ ${nameOf(ins.a)} ${ins.mode === "apart" ? "vs" : "+"} ${nameOf(ins.b)}`;
            } else if (ins.kind === "injury") {
              cls = "bg-amber-50 text-amber-800 ring-amber-200";
              text = `🩹 ${nameOf(ins.playerId)} — ${
                ins.severity === "mild" ? "mild (run −1)" : "serious (run −2, skill −1)"
              }`;
            } else {
              cls = "bg-violet-50 text-violet-800 ring-violet-200";
              const v = ins.values;
              text = `✏️ ${nameOf(ins.playerId)} today: ${POS_SHORT[v.primary]} · skill ${v.skill} · run ${v.running}${v.control ? " · 🎮" : ""}`;
            }
            return (
              <span
                key={i}
                className={`animate-pop inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 text-xs font-semibold ring-1 ${cls}`}
              >
                {text}
                <button
                  onClick={() => remove(i)}
                  aria-label="remove instruction"
                  className="grid h-5 w-5 place-items-center rounded-full hover:bg-black/10"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------------- Tab ---------------- */

export default function MatchDayTab({
  roster,
  selectedIds,
  setSelectedIds,
  instructions,
  setInstructions,
  onBuild,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

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

      <InstructionsSection
        selectedPlayers={selectedPlayers}
        instructions={instructions}
        setInstructions={setInstructions}
        nameOf={nameOf}
      />

      {/* Sticky build CTA, docked above the tab bar in thumb reach */}
      <div className="cta-dock fixed inset-x-0 z-30">
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
