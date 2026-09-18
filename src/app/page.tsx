"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_ROSTER } from "@/data/demo-roster";
import { buildTeams, manualSwap, rerollTeams } from "@/lib/engine";
import {
  Instruction,
  applyInstructions,
  pruneInstructions,
  toConstraints,
} from "@/lib/instructions";
import { Constraints, Player, SplitResult } from "@/lib/types";
import Logo from "@/components/Logo";
import RosterTab from "@/components/RosterTab";
import MatchDayTab from "@/components/MatchDayTab";
import TeamsTab from "@/components/TeamsTab";

type Tab = "match" | "teams" | "roster";

const ROSTER_KEY = "kix:roster";
const SELECTED_KEY = "kix:selected";
// One-time migration from the pre-rename keys.
const LEGACY_KEYS = { roster: "fair-teams:roster", selected: "fair-teams:selected" };

const TabIcon = ({ tab, active }: { tab: Tab; active: boolean }) => {
  const cls = `h-5 w-5 ${active ? "stroke-pitch" : "stroke-stone-400"}`;
  if (tab === "match")
    return (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" className={cls}>
        <path d="M9 11.5 11 13.5 15.5 9" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="4" y="5" width="16" height="16" rx="3" />
        <path d="M8 3v4M16 3v4" strokeLinecap="round" />
      </svg>
    );
  if (tab === "teams")
    return (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" className={cls}>
        <circle cx="8" cy="8.5" r="3" />
        <circle cx="16.5" cy="9.5" r="2.5" />
        <path d="M3.5 19c.6-3 2.4-4.5 4.5-4.5S12 16 12.5 19M13.5 18.5c.5-2.2 1.7-3.4 3-3.4s2.6 1.2 3.1 3.4" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" className={cls}>
      <path d="M5 6.5h14M5 12h14M5 17.5h9" strokeLinecap="round" />
    </svg>
  );
};

export default function Home() {
  const [tab, setTab] = useState<Tab>("match");
  const [roster, setRoster] = useState<Player[]>(DEMO_ROSTER);
  const [isDemo, setIsDemo] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [matchConstraints, setMatchConstraints] = useState<Constraints>({
    apart: [],
    together: [],
  });
  const [result, setResult] = useState<SplitResult | null>(null);
  const [matchPlayers, setMatchPlayers] = useState<Player[]>([]);
  const [history, setHistory] = useState<SplitResult[]>([]);
  const [lastSwap, setLastSwap] = useState<[string, string] | null>(null);

  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(ROSTER_KEY) ?? localStorage.getItem(LEGACY_KEYS.roster);
      if (stored) {
        const parsed: Player[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRoster(parsed);
          setIsDemo(false);
        }
      }
      const sel =
        localStorage.getItem(SELECTED_KEY) ?? localStorage.getItem(LEGACY_KEYS.selected);
      if (sel) setSelectedIds(new Set(JSON.parse(sel) as string[]));
    } catch {
      // Corrupt or blocked storage: fall through to the demo roster.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (!isDemo) localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
      localStorage.setItem(SELECTED_KEY, JSON.stringify([...selectedIds]));
    } catch {
      // Storage unavailable — the app still works for this session.
    }
  }, [roster, isDemo, selectedIds, hydrated]);

  const updateRoster = (players: Player[], demo: boolean) => {
    setRoster(players);
    setIsDemo(demo);
    if (demo) {
      try {
        localStorage.removeItem(ROSTER_KEY);
      } catch {}
    }
    const ids = new Set(players.map((p) => p.id));
    setSelectedIds((prev) => new Set([...prev].filter((id) => ids.has(id))));
    setInstructions((prev) => pruneInstructions(prev, ids));
  };

  const selectedPlayers = useMemo(
    () => roster.filter((p) => selectedIds.has(p.id)),
    [roster, selectedIds]
  );

  const build = () => {
    const seed = (Date.now() % 100000) + 1;
    // Instructions compile here: overrides/injuries transform the pool,
    // pair instructions become engine constraints.
    const todaysPlayers = applyInstructions(selectedPlayers, instructions);
    const constraints = toConstraints(instructions);
    setMatchPlayers(todaysPlayers);
    setMatchConstraints(constraints);
    setResult(buildTeams(todaysPlayers, constraints, seed));
    setHistory([]);
    setLastSwap(null);
    setTab("teams");
  };

  const reroll = () => {
    if (!result) return;
    setResult(rerollTeams(matchPlayers, matchConstraints, result));
    setHistory([]);
    setLastSwap(null);
  };

  const swap = (idX: string, idY: string) => {
    if (!result) return;
    const next = manualSwap(result, matchPlayers, matchConstraints, idX, idY);
    if (next === result) return; // illegal/no-op swap
    setHistory((h) => [...h, result]);
    setLastSwap([idX, idY]);
    setResult(next);
  };

  const undoSwap = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      setResult(h[h.length - 1]);
      return h.slice(0, -1);
    });
    setLastSwap(null);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "match", label: "Match day" },
    { id: "teams", label: "Teams" },
    { id: "roster", label: "Roster" },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pt-5 pb-[7.5rem]">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <Logo />
          <p className="mt-1.5 text-sm font-medium text-stone-500">
            Fair teams. Zero arguments.
          </p>
        </div>
        {isDemo && hydrated && (
          <p className="animate-rise rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Demo squad loaded — import yours in{" "}
            <button
              onClick={() => setTab("roster")}
              className="underline underline-offset-2"
            >
              Roster
            </button>
            . It stays on this device.
          </p>
        )}
      </header>

      <main className="flex-1">
        {tab === "match" && (
          <MatchDayTab
            roster={roster}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            instructions={instructions}
            setInstructions={setInstructions}
            onBuild={build}
          />
        )}
        {tab === "teams" && (
          <TeamsTab
            result={result}
            prevResult={history.length > 0 ? history[history.length - 1] : null}
            lastSwap={lastSwap}
            canUndo={history.length > 0}
            onUndo={undoSwap}
            onReroll={reroll}
            onSwap={swap}
            onGoPick={() => setTab("match")}
          />
        )}
        {tab === "roster" && (
          <RosterTab roster={roster} isDemo={isDemo} onChange={updateRoster} />
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/80 bg-white/90 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-5xl px-2">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-pitch ${
                  active ? "text-pitch" : "text-stone-400 hover:text-stone-600"
                }`}
              >
                <TabIcon tab={t.id} active={active} />
                <span className="flex items-center gap-1">
                  {t.label}
                  {t.id === "match" && selectedIds.size > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-bold text-white ${
                        active ? "bg-pitch" : "bg-stone-400"
                      }`}
                    >
                      {selectedIds.size}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
