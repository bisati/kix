"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_ROSTER } from "@/data/demo-roster";
import { buildTeams, manualSwap, rerollTeams } from "@/lib/engine";
import { Constraints, Player, SplitResult } from "@/lib/types";
import RosterTab from "@/components/RosterTab";
import MatchDayTab from "@/components/MatchDayTab";
import TeamsTab from "@/components/TeamsTab";

type Tab = "match" | "teams" | "roster";

const ROSTER_KEY = "fair-teams:roster";
const SELECTED_KEY = "fair-teams:selected";

export default function Home() {
  const [tab, setTab] = useState<Tab>("match");
  const [roster, setRoster] = useState<Player[]>(DEMO_ROSTER);
  const [isDemo, setIsDemo] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [constraints, setConstraints] = useState<Constraints>({
    apart: [],
    together: [],
  });
  const [result, setResult] = useState<SplitResult | null>(null);
  const [matchPlayers, setMatchPlayers] = useState<Player[]>([]);

  // Load persisted state after mount (static export has no server state).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ROSTER_KEY);
      if (stored) {
        const parsed: Player[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRoster(parsed);
          setIsDemo(false);
        }
      }
      const sel = localStorage.getItem(SELECTED_KEY);
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
    // Drop selections/constraints that reference players no longer in the roster.
    const ids = new Set(players.map((p) => p.id));
    setSelectedIds((prev) => new Set([...prev].filter((id) => ids.has(id))));
    setConstraints((prev) => ({
      apart: prev.apart.filter(([x, y]) => ids.has(x) && ids.has(y)),
      together: prev.together.filter(([x, y]) => ids.has(x) && ids.has(y)),
    }));
  };

  const selectedPlayers = useMemo(
    () => roster.filter((p) => selectedIds.has(p.id)),
    [roster, selectedIds]
  );

  const build = () => {
    const seed = (Date.now() % 100000) + 1;
    setMatchPlayers(selectedPlayers);
    setResult(buildTeams(selectedPlayers, constraints, seed));
    setTab("teams");
  };

  const reroll = () => {
    if (!result) return;
    setResult(rerollTeams(matchPlayers, constraints, result));
  };

  const swap = (idX: string, idY: string) => {
    if (!result) return;
    setResult(manualSwap(result, matchPlayers, constraints, idX, idY));
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "match", label: "Match day" },
    { id: "teams", label: "Teams" },
    { id: "roster", label: "Roster" },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 pb-24 pt-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">
          ⚽ Fair Teams
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Pick who showed up. Get two even teams — with the proof.
        </p>
        {isDemo && hydrated && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            You&apos;re on the demo roster. Import your own CSV in the Roster
            tab — it stays in your browser, nothing is uploaded.
          </p>
        )}
      </header>

      <main className="flex-1">
        {tab === "match" && (
          <MatchDayTab
            roster={roster}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            constraints={constraints}
            setConstraints={setConstraints}
            onBuild={build}
          />
        )}
        {tab === "teams" && (
          <TeamsTab result={result} onReroll={reroll} onSwap={swap} />
        )}
        {tab === "roster" && (
          <RosterTab roster={roster} isDemo={isDemo} onChange={updateRoster} />
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-sm font-medium ${
                tab === t.id
                  ? "border-t-2 border-green-600 text-green-700"
                  : "text-stone-500"
              }`}
            >
              {t.label}
              {t.id === "match" && selectedIds.size > 0 && (
                <span className="ml-1 rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {selectedIds.size}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
