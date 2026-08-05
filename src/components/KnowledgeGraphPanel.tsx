import { useEffect, useRef, useState } from 'react';
import { Network, RefreshCw, Loader2 } from 'lucide-react';
import * as d3 from 'd3';

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
export interface Spark {
  id: string;
  text: string;
  embedding: number[];
}

interface Memory {
  id: string;
  text: string;
  embedding?: number[];
}

interface KnowledgeGraphPanelProps {
  memories: Memory[];
  sparks?: Spark[];
  onBindSpark?: (spark: Spark) => void;
}

export default function KnowledgeGraphPanel({ memories, sparks, onBindSpark }: KnowledgeGraphPanelProps) {

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<KBNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<KBNode | null>(null);
  
  const simRef = useRef<d3.Simulation<KBNode, Edge> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const visualSparksRef = useRef<any[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/ml.worker.ts', import.meta.url), { type: 'module' });
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

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
    const id = Date.now().toString();

    if (!workerRef.current) return;

    const handleMessage = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      if (e.data.status === 'error') {
        console.error("Worker error:", e.data.error);
        setLoading(false);
        workerRef.current?.removeEventListener('message', handleMessage);
        return;
      }

      const { proj, clusters, edges: workerEdges } = e.data.data;
      
      const xs = proj.map((p: number[]) => p[0]), ys = proj.map((p: number[]) => p[1]);
      const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
      const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
      
      const newNodes: KBNode[] = raw.map((r, i) => {
        const px = (dimensions.width * 0.1) + ((proj[i][0] - x0) / (x1 - x0 + 1e-9)) * (dimensions.width * 0.8);
        const py = (dimensions.height * 0.1) + ((proj[i][1] - y0) / (y1 - y0 + 1e-9)) * (dimensions.height * 0.8);
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
      
      const newEdges: Edge[] = workerEdges.map((e: any) => ({
        source: newNodes[e.sourceIdx].id,
        target: newNodes[e.targetIdx].id,
        sim: e.sim
      }));
      
      setNodes(newNodes);
      setEdges(newEdges);
      setLoading(false);
      workerRef.current?.removeEventListener('message', handleMessage);
    };

    workerRef.current.addEventListener('message', handleMessage);
    workerRef.current.postMessage({
      id,
      type: 'analyze_graph',
      embeddings,
      maxDocs: MAX_DOCS,
      simThreshold: SIM_THRESHOLD
    });
  };

  useEffect(() => { load(); }, [memories]);

  useEffect(() => {
    if (!sparks || sparks.length === 0 || nodes.length === 0) return;
    
    // Find newly added sparks
    const currentSparkIds = new Set(visualSparksRef.current.map(s => s.spark.id));
    const newSparks = sparks.filter(s => !currentSparkIds.has(s.id));
    
    newSparks.forEach(spark => {
      // Find closest node
      let bestNode = nodes[0];
      let bestSim = -Infinity;
      
      const sEmb = spark.embedding;
      const sNorm = Math.sqrt(sEmb.reduce((a, b) => a + b * b, 0)) + 1e-9;
      
      for (const n of nodes) {
        const nEmb = n.embedding;
        const nNorm = Math.sqrt(nEmb.reduce((a, b) => a + b * b, 0)) + 1e-9;
        let dot = 0;
        for (let i = 0; i < sEmb.length; i++) dot += sEmb[i] * nEmb[i];
        const sim = dot / (sNorm * nNorm);
        if (sim > bestSim) {
          bestSim = sim;
          bestNode = n;
        }
      }
      
      // Start from random edge
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.max(dimensions.width, dimensions.height);
      const startX = dimensions.width / 2 + Math.cos(angle) * radius;
      const startY = dimensions.height / 2 + Math.sin(angle) * radius;
      
      visualSparksRef.current.push({
        spark,
        x: startX,
        y: startY,
        targetNode: bestNode,
        color: COLORS[bestNode.cluster % COLORS.length] || '#ec4899',
        bound: false
      });
    });
  }, [sparks, nodes, dimensions]);


  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let timeoutId: NodeJS.Timeout;
    const observer = new ResizeObserver((entries) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (entries[0]) {
          const { width } = entries[0].contentRect;
          // Maintain 3/2 aspect ratio
          setDimensions({ width, height: width * (2 / 3) });
        }
      }, 100); // Debounce
    });
    
    observer.observe(container);
    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (nodes.length < 2) return;
    
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    cv.width = dimensions.width * dpr; cv.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    if (simRef.current) simRef.current.stop();

    simRef.current = d3.forceSimulation<KBNode, Edge>(nodes)
      .force("link", d3.forceLink<KBNode, Edge>(edges).id(d => d.id).distance(d => 100 - (d.sim - SIM_THRESHOLD) * 200).strength(d => d.sim * 0.5))
      .force("charge", d3.forceManyBody().strength(-30))
      .force("collide", d3.forceCollide().radius(10))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2).strength(0.05))
      // Add a force to slightly attract to PCA coordinates to maintain overall structure
      .force("x", d3.forceX<KBNode>(d => d.px_init).strength(0.1))
      .force("y", d3.forceY<KBNode>(d => d.py_init).strength(0.1))
      .alphaDecay(0.1) // Faster decay since we start from a good position
      .on("tick", () => {
        ctx.clearRect(0, 0, dimensions.width, dimensions.height);
        
        // edges
        for (const e of edges) {
          const s = e.source as KBNode;
          const t = e.target as KBNode;
          ctx.strokeStyle = `rgba(34, 211, 238, ${(e.sim - SIM_THRESHOLD) / (1 - SIM_THRESHOLD) * 0.5 + 0.1})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(s.x || 0, s.y || 0); ctx.lineTo(t.x || 0, t.y || 0); ctx.stroke();
        }
        
        
        // sparks
        const sparksToRemove = new Set<string>();
        for (const s of visualSparksRef.current) {
          if (s.bound) continue;
          
          const tx = s.targetNode.x || dimensions.width / 2;
          const ty = s.targetNode.y || dimensions.height / 2;
          
          s.x += (tx - s.x) * 0.08;
          s.y += (ty - s.y) * 0.08;
          
          const dist = Math.sqrt((tx - s.x) ** 2 + (ty - s.y) ** 2);
          if (dist < 10) {
            s.bound = true;
            sparksToRemove.add(s.spark.id);
            if (onBindSpark) onBindSpark(s.spark);
          }
          
          ctx.shadowColor = s.color;
          ctx.shadowBlur = 15;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        
        if (sparksToRemove.size > 0) {
          visualSparksRef.current = visualSparksRef.current.filter(s => !sparksToRemove.has(s.spark.id));
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
  }, [nodes, edges, hover, dimensions]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * dimensions.width;
    const my = ((e.clientY - rect.top) / rect.height) * dimensions.height;
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
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-cyan-400 transition-colors">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
      </div>
      <div className="relative" ref={containerRef}>
        <canvas ref={canvasRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
          className="w-full rounded-xl bg-slate-950/80 border border-slate-800" style={{ aspectRatio: '3/2' }} />
        {hover && (
          <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-slate-900/95 border border-cyan-500/30 p-2 text-xs">
            <p className="text-cyan-300 font-mono mb-0.5" style={{ color: COLORS[hover.cluster % COLORS.length] }}>Cluster {hover.cluster}</p>
            <p className="text-slate-300 line-clamp-2">{hover.text}</p>
          </div>
        )}
        {!loading && nodes.length < 2 && (
          <p className="absolute inset-0 grid place-items-center text-slate-500 text-sm">Need ≥2 embedded documents</p>
        )}
      </div>
    </div>
  );
}
