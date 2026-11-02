import * as d3 from 'd3';
import {
  AlertTriangle,
  Brain,
  Link2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api.js';
import type { MemoryGraph, MemoryGraphEdge, MemoryGraphNode } from '../lib/unisync-memory.js';

interface UniSyncMemoryResponse {
  enabled: boolean;
  reason?: string;
  error?: string;
  cached?: boolean;
  graph?: MemoryGraph;
}

type SimNode = MemoryGraphNode & d3.SimulationNodeDatum;
type SimEdge = d3.SimulationLinkDatum<SimNode> & { kind: MemoryGraphEdge['kind'] };

const EDGE_COLOR: Record<MemoryGraphEdge['kind'], string> = {
  wrote: 'rgba(148,163,184,0.25)',
  links: '#22d3ee',
  duplicate: '#f59e0b',
};

/** Shared UniSync memory (LinX stage 2): read-only graph of facts, agents, links and conflicts. */
export default function UniSyncMemoryPanel({ theme = 'dark' }: { theme?: string }) {
  const [data, setData] = useState<UniSyncMemoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [selected, setSelected] = useState<MemoryGraphNode | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      setData(await apiRequest<UniSyncMemoryResponse>('/unisync/memory', {}, 1));
    } catch (err) {
      setFailure(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const graph = data?.graph;

  useEffect(() => {
    if (!graph || !svgRef.current) return;
    const width = svgRef.current.clientWidth || 640;
    const height = 380;
    const nodes: SimNode[] = graph.nodes.map((n) => ({ ...n }));
    const edges: SimEdge[] = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
    }));
    const scopes = [...new Set(nodes.filter((n) => n.scope).map((n) => n.scope as string))];
    const color = d3.scaleOrdinal<string, string>(d3.schemeTableau10).domain(scopes);

    const svg = d3.select(svgRef.current).attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();
    const link = svg
      .append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', (d) => EDGE_COLOR[d.kind])
      .attr('stroke-width', (d) => (d.kind === 'wrote' ? 1 : 2))
      .attr('stroke-dasharray', (d) => (d.kind === 'duplicate' ? '4 3' : null));
    const node = svg
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d) => (d.kind === 'agent' ? 6 : 7 + Math.min(d.writes ?? 1, 6)))
      .attr('fill', (d) => (d.kind === 'agent' ? '#64748b' : color(d.scope ?? '')))
      .attr('stroke', (d) => (d.conflict ? '#ef4444' : d.stale ? '#94a3b8' : 'transparent'))
      .attr('stroke-width', (d) => (d.conflict ? 3 : 2))
      .attr('opacity', (d) => (d.stale ? 0.55 : 1))
      .style('cursor', 'pointer')
      .on('click', (_e, d) => setSelected(d));
    node.append('title').text((d) => (d.kind === 'agent' ? `agent ${d.label}` : d.id));
    const label = svg
      .append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text((d) => d.label)
      .attr('font-size', 10)
      .attr('fill', theme === 'dark' ? '#cbd5e1' : '#334155')
      .attr('pointer-events', 'none');

    const sim = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(edges)
          .id((d) => d.id)
          .distance((e) => (e.kind === 'wrote' ? 90 : 60)),
      )
      .force('charge', d3.forceManyBody().strength(-160))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .on('tick', () => {
        link
          .attr('x1', (d) => (d.source as SimNode).x ?? 0)
          .attr('y1', (d) => (d.source as SimNode).y ?? 0)
          .attr('x2', (d) => (d.target as SimNode).x ?? 0)
          .attr('y2', (d) => (d.target as SimNode).y ?? 0);
        node.attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
        label.attr('x', (d) => (d.x ?? 0) + 10).attr('y', (d) => (d.y ?? 0) + 3);
      });
    return () => {
      sim.stop();
    };
  }, [graph, theme]);

  const card =
    theme === 'dark'
      ? 'bg-white/5 border-white/10 text-slate-200'
      : 'bg-black/5 border-black/10 text-slate-800';

  return (
    <section
      className={`rounded-2xl border p-4 flex flex-col gap-3 ${card}`}
      aria-label="Shared UniSync memory"
    >
      <header className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-cyan-400" />
        <h3 className="font-semibold text-sm">Shared memory (UniSync)</h3>
        {graph && (
          <span className="text-xs opacity-70 flex items-center gap-1">
            {graph.chain.continuous && graph.chain.digestMismatches.length === 0 ? (
              <>
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> chain verified
              </>
            ) : (
              <>
                <ShieldAlert className="w-3 h-3 text-amber-400" /> chain needs a check (run linx
                selftest)
              </>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto p-1 rounded hover:bg-white/10"
          title="Refresh"
          aria-label="Refresh shared memory"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      </header>

      {failure && <p className="text-xs text-red-400">Could not load shared memory: {failure}</p>}
      {data && !data.enabled && <p className="text-xs opacity-70">Not connected: {data.reason}</p>}
      {data?.error && <p className="text-xs text-red-400">Ledger unavailable: {data.error}</p>}

      {graph && (
        <>
          <p className="text-xs opacity-70">
            {graph.facts} facts at ledger #{graph.head} · {graph.conflicts.length} conflicts ·{' '}
            {graph.stale.length} stale · {graph.duplicates.length} duplicate groups ·{' '}
            {Object.keys(graph.links).length} linked
          </p>
          <svg
            ref={svgRef}
            className="w-full h-[380px] rounded-xl bg-black/20"
            role="img"
            aria-label="Shared memory graph"
          />
          {graph.conflicts.length > 0 && (
            <ul className="text-xs flex flex-col gap-1">
              {graph.conflicts.map((c) => (
                <li key={c.ref} className="flex items-start gap-1 text-red-300">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>
                    <b>{c.ref}</b>:{' '}
                    {Object.entries(c.values)
                      .map(([who, v]) => `${who}=${JSON.stringify(v)}`)
                      .join('; ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {selected?.kind === 'fact' && (
            <div className="text-xs rounded-lg bg-black/20 p-2">
              <div className="flex items-center gap-1 font-semibold">
                <Link2 className="w-3 h-3" /> {selected.id}
              </div>
              <div className="opacity-70">
                set by {selected.lastWriter} at #{selected.lastSeq} · {selected.writes} write(s)
              </div>
              <pre className="whitespace-pre-wrap break-all mt-1">
                {JSON.stringify(selected.value, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </section>
  );
}
