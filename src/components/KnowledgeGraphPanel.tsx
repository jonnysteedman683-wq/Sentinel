import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Network, RefreshCw, Loader2, Box } from 'lucide-react';
import * as d3 from 'd3';
import { sphericalKMeans } from '../lib/clustering.js';

const KnowledgeGraph3D = lazy(() => import('./KnowledgeGraph3D.js'));

interface KBNode extends d3.SimulationNodeDatum { id: string; text: string; source: string; embedding: number[]; cluster: number; px_init: number; py_init: number; }
interface Edge extends d3.SimulationLinkDatum<KBNode> { sim: number; }

const SIM_THRESHOLD = 0.82;
const MAX_DOCS = 200;

const COLORS = [
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
];


function pca2D(vectors: number[][]): [number, number][] {
  const n = vectors.length, d = vectors[0].length;
  const mean = new Float64Array(d);
  vectors.forEach(v => { for (let j = 0; j < d; j++) mean[j] += v[j] / n; });
  const centered = vectors.map(v => v.map((x, j) => x - mean[j]));
  const covMul = (vec: Float64Array, deflate?: Float64Array) => {
    const out = new Float64Array(d);
    for (const row of centered) {
      let dot = 0;
      for (let j = 0; j < d; j++) dot += row[j] * vec[j];
      for (let j = 0; j < d; j++) out[j] += dot * row[j] / n;
    }
    if (deflate) {
      let proj = 0;
      for (let j = 0; j < d; j++) proj += out[j] * deflate[j];
      for (let j = 0; j < d; j++) out[j] -= proj * deflate[j];
    }
    return out;
  };
  const powerIter = (deflate?: Float64Array) => {
    let v = new Float64Array(d).map(() => Math.random() - 0.5);
    for (let it = 0; it < 40; it++) {
      const nv = covMul(v, deflate);
      const norm = Math.sqrt(nv.reduce((s, x) => s + x * x, 0)) + 1e-9;
      v = new Float64Array(nv.map(x => x / norm));
    }
    return v;
  };
  const pc1 = powerIter();
  const pc2 = powerIter(pc1);
  return centered.map(row => {
    let x = 0, y = 0;
    for (let j = 0; j < d; j++) { x += row[j] * pc1[j]; y += row[j] * pc2[j]; }
    return [x, y];
  });
}


interface Memory {
  id: string;
  text: string;
  embedding?: number[];
}

interface KnowledgeGraphPanelProps {
  memories: Memory[];
}

export default function KnowledgeGraphPanel({ memories }: KnowledgeGraphPanelProps) {

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<KBNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<KBNode | null>(null);
  const [is3D, setIs3D] = useState(false);
  const simRef = useRef<d3.Simulation<KBNode, Edge> | null>(null);

  const load = () => {
    setLoading(true);
    
    // 1. Filter memories to those with embeddings and map to raw format
    const raw = memories
      .filter(m => Array.isArray(m.embedding) && m.embedding.length > 0)
      .slice(0, MAX_DOCS);
    
    if (raw.length < 2) { 
      setNodes([]); 
      setEdges([]); 
      setLoading(false); 
      return; 
    }
    
    const embeddings = raw.map(r => r.embedding as number[]);
    const proj = pca2D(embeddings);
    const clusters = sphericalKMeans(embeddings, Math.min(8, Math.max(3, Math.floor(raw.length / 5))));
    const xs = proj.map(p => p[0]), ys = proj.map(p => p[1]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    
    const newNodes: KBNode[] = raw.map((r, i) => {
      const px = 40 + ((proj[i][0] - x0) / (x1 - x0 + 1e-9)) * 520;
      const py = 40 + ((proj[i][1] - y0) / (y1 - y0 + 1e-9)) * 320;
      return { 
        id: r.id,
        text: r.text,
        source: 'memory',
        embedding: embeddings[i],
        cluster: clusters[i],
        px_init: px,
        py_init: py,
        x: px, 
        y: py 
      };
    });
    
    // Optimized cosine similarity calculation
    const newEdges: Edge[] = [];
    const norms = embeddings.map(v => {
      let n = 0;
      for (let i = 0; i < v.length; i++) n += v[i] * v[i];
      return Math.sqrt(n) + 1e-9;
    });

    for (let i = 0; i < newNodes.length; i++) {
      const ei = embeddings[i];
      const ni = norms[i];
      for (let j = i + 1; j < newNodes.length; j++) {
        const ej = embeddings[j];
        const nj = norms[j];
        let dot = 0;
        for (let k = 0; k < ei.length; k++) {
          dot += ei[k] * ej[k];
        }
        const s = dot / (ni * nj);
        if (s >= SIM_THRESHOLD) {
          newEdges.push({ source: newNodes[i].id, target: newNodes[j].id, sim: s });
        }
      }
    }
    
    setNodes(newNodes);
    setEdges(newEdges);
    setLoading(false);
  };

  useEffect(() => { load(); }, [memories]);

  useEffect(() => {
    if (nodes.length < 2 || is3D) return;
    
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    cv.width = 600 * dpr; cv.height = 400 * dpr;
    ctx.scale(dpr, dpr);

    if (simRef.current) simRef.current.stop();

    simRef.current = d3.forceSimulation<KBNode, Edge>(nodes)
      .force("link", d3.forceLink<KBNode, Edge>(edges).id(d => d.id).distance(d => 100 - (d.sim - SIM_THRESHOLD) * 200).strength(d => d.sim * 0.5))
      .force("charge", d3.forceManyBody().strength(-30))
      .force("collide", d3.forceCollide().radius(10))
      .force("center", d3.forceCenter(300, 200).strength(0.05))
      // Add a force to slightly attract to PCA coordinates to maintain overall structure
      .force("x", d3.forceX<KBNode>(d => d.px_init).strength(0.1))
      .force("y", d3.forceY<KBNode>(d => d.py_init).strength(0.1))
      .alphaDecay(0.1) // Faster decay since we start from a good position
      .on("tick", () => {
        ctx.clearRect(0, 0, 600, 400);
        
        // edges
        for (const e of edges) {
          const s = e.source as KBNode;
          const t = e.target as KBNode;
          const isEntangled = e.sim >= 0.9;
          
          if (isEntangled) {
            ctx.strokeStyle = `rgba(217, 70, 239, ${(e.sim - SIM_THRESHOLD) / (1 - SIM_THRESHOLD) * 0.8 + 0.2})`; // fuchsia
            ctx.lineWidth = 2;
            ctx.shadowColor = '#d946ef';
            ctx.shadowBlur = 8;
            
            // Add a slight wave/dash for quantum effect
            ctx.setLineDash([5, 5]);
          } else {
            ctx.strokeStyle = `rgba(34, 211, 238, ${(e.sim - SIM_THRESHOLD) / (1 - SIM_THRESHOLD) * 0.5 + 0.1})`; // cyan
            ctx.lineWidth = 1;
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.setLineDash([]);
          }
          
          ctx.beginPath(); ctx.moveTo(s.x || 0, s.y || 0); ctx.lineTo(t.x || 0, t.y || 0); ctx.stroke();
          
          // Reset shadow for nodes
          ctx.shadowBlur = 0;
          ctx.setLineDash([]);
        }
        
        // nodes
        for (const n of nodes) {
          const isHover = hover?.id === n.id;
          const color = COLORS[n.cluster % COLORS.length];
          
          if (isHover) {
            ctx.shadowColor = color; 
            ctx.shadowBlur = 18;
          } else {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }
          
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(n.x || 0, n.y || 0, isHover ? 7 : 5, 0, Math.PI * 2); ctx.fill();
        }
      });

    return () => {
      if (simRef.current) simRef.current.stop();
    };
  }, [nodes, edges, hover, is3D]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 600;
    const my = ((e.clientY - rect.top) / rect.height) * 400;
    let best: any = null, bd = 144; // 12px radius
    for (const n of nodes) {
      if (n.x === undefined || n.y === undefined) continue;
      const d = (n.x - mx) ** 2 + (n.y - my) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    setHover(best);
  };

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 backdrop-blur p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-cyan-300">
          <Network size={16} />
          <h3 className="text-sm font-semibold tracking-wide uppercase">Knowledge Graph</h3>
          <span className="text-xs text-slate-500">{nodes.length} nodes · {edges.length} links</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIs3D(!is3D)} 
            className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors text-xs font-semibold uppercase tracking-wider ${
              is3D ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'hover:bg-cyan-500/10 text-cyan-600 border border-transparent'
            }`}
          >
            <Box size={14} /> 3D
          </button>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-cyan-400 transition-colors">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>
      <div className="relative">
        {is3D ? (
          <Suspense fallback={<div className="w-full aspect-[3/2] grid place-items-center text-cyan-500"><Loader2 className="animate-spin" /></div>}>
            <KnowledgeGraph3D memories={memories} />
          </Suspense>
        ) : (
          <>
            <canvas ref={canvasRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
              className="w-full rounded-xl bg-slate-950/80 border border-slate-800" style={{ aspectRatio: '3/2' }} />
            {hover && (
              <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-slate-900/95 border border-cyan-500/30 p-2 text-xs backdrop-blur-md pointer-events-none">
                <p className="text-cyan-300 font-mono mb-0.5 font-bold tracking-widest" style={{ color: COLORS[hover.cluster % COLORS.length] }}>Cluster {hover.cluster}</p>
                <p className="text-slate-300 line-clamp-2">{hover.text}</p>
              </div>
            )}
            {!loading && nodes.length < 2 && (
              <p className="absolute inset-0 grid place-items-center text-slate-500 text-sm">Need ≥2 embedded documents</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
