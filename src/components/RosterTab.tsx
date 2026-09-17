"use client";

import { useRef, useState } from "react";
import { DEMO_ROSTER } from "@/data/demo-roster";
import { parseRosterCsv, serializeRosterCsv } from "@/lib/csv";
import { Player, Position, POSITIONS } from "@/lib/types";

interface Props {
  roster: Player[];
  isDemo: boolean;
  onChange: (players: Player[], demo: boolean) => void;
}

const EMPTY: Omit<Player, "id"> = {
  name: "",
  primary: "Midfield",
  secondary: "Midfield",
  skill: 3,
  running: 3,
  control: false,
  ageBand: "26-30",
};

export default function RosterTab({ roster, isDemo, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<string | null>(null); // player id or "new"
  const [draft, setDraft] = useState<Omit<Player, "id">>(EMPTY);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const startEdit = (p?: Player) => {
    if (p) {
      setEditing(p.id);
      setDraft({ ...p });
    } else {
      setEditing("new");
      setDraft(EMPTY);
    }
  };

  const saveDraft = () => {
    const name = draft.name.trim();
    if (!name) return;
    const clash = roster.some((p) => p.name === name && p.id !== editing);
    if (clash) {
      setImportErrors([`A player named "${name}" already exists.`]);
      return;
    }
    setImportErrors([]);
    const player: Player = { ...draft, name, id: name };
    const next =
      editing === "new"
        ? [...roster, player]
        : roster.map((p) => (p.id === editing ? player : p));
    onChange(next, false);
    setEditing(null);
  };

  const remove = (id: string) => {
    onChange(roster.filter((p) => p.id !== id), false);
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const { players, errors } = parseRosterCsv(text);
    if (players.length > 0) {
      onChange(players, false);
      setImportErrors(errors);
    } else {
      setImportErrors(errors.length ? errors : ["No players found in file."]);
    }
  };

  const exportCsv = () => {
    const blob = new Blob([serializeRosterCsv(roster)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roster.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const field = (label: string, input: React.ReactNode) => (
    <label className="flex flex-col gap-1 text-xs text-stone-500">
      {label}
      {input}
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-lg bg-stone-800 px-3 py-2 font-medium text-white"
        >
          Import CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importCsv(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={exportCsv}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-medium"
        >
          Export CSV
        </button>
        <button
          onClick={() => startEdit()}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-medium"
        >
          + Add player
        </button>
        {!isDemo && (
          <button
            onClick={() => onChange(DEMO_ROSTER, true)}
            className="ml-auto text-xs text-stone-400 underline"
          >
            reset to demo
          </button>
        )}
      </div>

      <p className="text-xs text-stone-400">
        {roster.length} players · stored only in this browser
        {isDemo && " · demo data"}
      </p>

      {importErrors.length > 0 && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {importErrors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {editing && (
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {field(
              "Name",
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="rounded border border-stone-300 px-2 py-1.5 text-sm text-stone-900"
              />
            )}
            {field(
              "Primary",
              <select
                value={draft.primary}
                onChange={(e) =>
                  setDraft({ ...draft, primary: e.target.value as Position })
                }
                className="rounded border border-stone-300 px-2 py-1.5 text-sm text-stone-900"
              >
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            )}
            {field(
              "Secondary",
              <select
                value={draft.secondary}
                onChange={(e) =>
                  setDraft({ ...draft, secondary: e.target.value as Position })
                }
                className="rounded border border-stone-300 px-2 py-1.5 text-sm text-stone-900"
              >
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            )}
            {field(
              "Age band",
              <input
                value={draft.ageBand}
                onChange={(e) => setDraft({ ...draft, ageBand: e.target.value })}
                placeholder="26-30"
                className="rounded border border-stone-300 px-2 py-1.5 text-sm text-stone-900"
              />
            )}
            {field(
              `Skill: ${draft.skill}`,
              <input
                type="range"
                min={1}
                max={5}
                value={draft.skill}
                onChange={(e) =>
                  setDraft({ ...draft, skill: +e.target.value as Player["skill"] })
                }
              />
            )}
            {field(
              `Running: ${draft.running}`,
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
              />
            )}
            <label className="flex items-center gap-2 text-xs text-stone-600">
              <input
                type="checkbox"
                checked={draft.control}
                onChange={(e) => setDraft({ ...draft, control: e.target.checked })}
              />
              Game controller 🎮
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={saveDraft}
              className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
        {roster.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <div className="flex-1">
              <p className="font-medium">
                {p.name} {p.control && <span title="game controller">🎮</span>}
              </p>
              <p className="text-xs text-stone-400">
                {p.primary}
                {p.secondary !== p.primary && ` / ${p.secondary}`} · skill{" "}
                {p.skill} · run {p.running} · {p.ageBand}
              </p>
            </div>
            <button
              onClick={() => startEdit(p)}
              className="text-xs text-stone-500 underline"
            >
              edit
            </button>
            <button
              onClick={() => remove(p.id)}
              className="text-xs text-red-400 underline"
            >
              remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
