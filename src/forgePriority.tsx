import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types + ranking
// ---------------------------------------------------------------------------
export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_RANK: Record<Priority, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

// House style — rose is the Forge domain; priorities escalate toward it
export const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'text-slate-400 border-slate-700 bg-slate-800/50',
  medium: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  high: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  critical:
    'text-rose-400 border-rose-500/40 bg-rose-500/10 shadow-[0_0_10px_rgba(244,63,94,0.25)]',
};

// ---------------------------------------------------------------------------
// Sort logic
// ---------------------------------------------------------------------------
export function sortByPriority<
  T extends { priority?: Priority; createdAt?: number },
>(tasks: T[], enabled: boolean): T[] {
  if (!enabled) return tasks;
  return [...tasks].sort((a, b) => {
    const diff =
      PRIORITY_RANK[b.priority ?? 'medium'] -
      PRIORITY_RANK[a.priority ?? 'medium'];
    return diff !== 0 ? diff : (b.createdAt ?? 0) - (a.createdAt ?? 0);
  });
}

// ---------------------------------------------------------------------------
// Hook — state + sorted list in one call
// ---------------------------------------------------------------------------
export function usePrioritySort<
  T extends { priority?: Priority; createdAt?: number },
>(tasks: T[]) {
  const [enabled, setEnabled] = useState(false);
  const sorted = useMemo(
    () => sortByPriority(tasks, enabled),
    [tasks, enabled],
  );
  return {
    sorted,
    enabled,
    toggle: { enabled, onToggle: () => setEnabled((v) => !v) },
  };
}

// ---------------------------------------------------------------------------
// UI — sort toggle button
// ---------------------------------------------------------------------------
export function PrioritySortToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px]
        uppercase tracking-widest transition-colors ${
          enabled
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
            : 'border-slate-700 text-slate-500 hover:text-slate-300'
        }`}
    >
      <ArrowDownWideNarrow size={12} />
      Priority {enabled ? 'ON' : 'OFF'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// UI — per-task priority selector (badge-styled)
// ---------------------------------------------------------------------------
export function PrioritySelect({
  value,
  onChange,
}: {
  value?: Priority;
  onChange: (p: Priority) => void;
}) {
  const current = value ?? 'medium';
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value as Priority)}
      className={`cursor-pointer rounded border px-1.5 py-0.5 font-mono text-[10px]
        uppercase tracking-widest outline-none transition-colors ${PRIORITY_STYLES[current]}`}
    >
      {PRIORITIES.map((p) => (
        <option key={p} value={p} className="bg-slate-900 text-slate-300">
          {p}
        </option>
      ))}
    </select>
  );
}
