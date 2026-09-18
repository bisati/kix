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
  const [editing, setEditing] = useState<string | null>(null);
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
    if (roster.some((p) => p.name === name && p.id !== editing)) {
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
    a.download = "kix-roster.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const field = (label: string, input: React.ReactNode) => (
    <label className="flex flex-col gap-1 text-xs font-semibold text-stone-500">
      {label}
      {input}
    </label>
  );

  const inputCls =
    "rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm font-normal text-ink focus:border-pitch focus:outline-none";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          onClick={() => fileRef.current?.click()}
          className="cta min-h-[2.6rem] rounded-xl px-4 font-bold text-white"
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
          className="min-h-[2.6rem] rounded-xl border border-stone-200 bg-white px-4 font-bold text-stone-700 shadow-sm transition-all hover:-translate-y-px hover:border-pitch hover:text-pitch active:scale-95"
        >
          Export
        </button>
        <button
          onClick={() => startEdit()}
          className="min-h-[2.6rem] rounded-xl border border-stone-200 bg-white px-4 font-bold text-stone-700 shadow-sm transition-all hover:-translate-y-px hover:border-pitch hover:text-pitch active:scale-95"
        >
          + Add player
        </button>
        {!isDemo && (
          <button
            onClick={() => onChange(DEMO_ROSTER, true)}
            className="ml-auto text-xs font-medium text-stone-400 underline underline-offset-2 hover:text-stone-600"
          >
            reset to demo
          </button>
        )}
      </div>

      <p className="text-xs font-medium text-stone-400">
        {roster.length} players · stored only in this browser
        {isDemo && " · demo data"}
      </p>

      {importErrors.length > 0 && (
        <div className="animate-rise rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200">
          {importErrors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {editing && (
        <div className="animate-pop rounded-2xl border border-pitch/25 bg-pitch-soft/40 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {field(
              "Name",
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={inputCls}
              />
            )}
            {field(
              "Primary",
              <select
                value={draft.primary}
                onChange={(e) =>
                  setDraft({ ...draft, primary: e.target.value as Position })
                }
                className={inputCls}
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
                className={inputCls}
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
                className={inputCls}
              />
            )}
            {field(
              `Skill · ${draft.skill}`,
              <input
                type="range"
                min={1}
                max={5}
                value={draft.skill}
                onChange={(e) =>
                  setDraft({ ...draft, skill: +e.target.value as Player["skill"] })
                }
                className="accent-pitch"
              />
            )}
            {field(
              `Running · ${draft.running}`,
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
                className="accent-pitch"
              />
            )}
            <label className="col-span-2 flex items-center gap-2 text-xs font-semibold text-stone-600">
              <input
                type="checkbox"
                checked={draft.control}
                onChange={(e) => setDraft({ ...draft, control: e.target.checked })}
                className="h-4 w-4 accent-pitch"
              />
              Game controller 🎮 (runs the play)
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={saveDraft}
              className="cta rounded-xl px-5 py-2 text-sm font-bold text-white"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-xl border border-stone-200 bg-white px-5 py-2 text-sm font-bold text-stone-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {POSITIONS.map((pos) => {
          const group = roster.filter((p) => p.primary === pos);
          if (group.length === 0) return null;
          return (
            <div key={pos}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                {pos} · {group.length}
              </p>
              <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                {group.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {p.name}{" "}
                        {p.control && (
                          <span className="text-xs" title="game controller">
                            🎮
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-stone-400">
                        {p.secondary !== p.primary && `also ${p.secondary} · `}
                        skill {p.skill} · run {p.running} · {p.ageBand}
                      </p>
                    </div>
                    <button
                      onClick={() => startEdit(p)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-stone-500 hover:bg-stone-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        onChange(roster.filter((x) => x.id !== p.id), false)
                      }
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-400 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
