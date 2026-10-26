import React, { useEffect, useState, useRef, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { sphericalKMeans } from '../lib/clustering.js';
import * as THREE from 'three';

interface Memory {
  id: string;
  text: string;
  embedding?: number[];
}

interface GraphNode {
  id: string;
  name: string;
  cluster: number;
  val: number;
  color: string;
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
  isEntangled: boolean;
}

interface KnowledgeGraph3DProps {
  memories: Memory[];
}

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

const SIM_THRESHOLD = 0.82;
const ENTANGLED_THRESHOLD = 0.9;
const MAX_DOCS = 200;

export default function KnowledgeGraph3D({ memories }: KnowledgeGraph3DProps) {
  const fgRef = useRef<any>(null);
  
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({ nodes: [], links: [] });
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    const raw = memories
      .filter(m => Array.isArray(m.embedding) && m.embedding.length > 0)
      .slice(0, MAX_DOCS);
      
    if (raw.length < 2) {
      setGraphData({ nodes: [], links: [] });
      return;
    }

    const embeddings = raw.map(r => r.embedding as number[]);
    const clusters = sphericalKMeans(embeddings, Math.min(8, Math.max(3, Math.floor(raw.length / 5))));

    const nodes: GraphNode[] = raw.map((r, i) => ({
      id: r.id,
      name: r.text,
      cluster: clusters[i],
      val: 2,
      color: COLORS[clusters[i] % COLORS.length]
    }));

    const links: GraphLink[] = [];
    const norms = embeddings.map(v => {
      let n = 0;
      for (let i = 0; i < v.length; i++) n += v[i] * v[i];
      return Math.sqrt(n) + 1e-9;
    });

    for (let i = 0; i < nodes.length; i++) {
      const ei = embeddings[i];
      const ni = norms[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const ej = embeddings[j];
        const nj = norms[j];
        let dot = 0;
        for (let k = 0; k < ei.length; k++) {
          dot += ei[k] * ej[k];
        }
        const s = dot / (ni * nj);
        if (s >= SIM_THRESHOLD) {
          links.push({ 
            source: nodes[i].id, 
            target: nodes[j].id, 
            value: s,
            isEntangled: s >= ENTANGLED_THRESHOLD
          });
        }
      }
    }

    setGraphData({ nodes, links });
  }, [memories]);

  // Handle graph spinning animation and auto-centering
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      fgRef.current.d3Force('charge').strength(-120);
      
      // Auto-rotate camera
      let angle = 0;
      const interval = setInterval(() => {
        if (fgRef.current) {
          angle += Math.PI / 800; // very slow rotation
          const distance = 300;
          fgRef.current.cameraPosition({
            x: distance * Math.sin(angle),
            z: distance * Math.cos(angle)
          });
        }
      }, 30);
      
      return () => clearInterval(interval);
    }
  }, [graphData]);

  if (graphData.nodes.length < 2) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950/80 rounded-xl border border-slate-800 text-slate-500 text-sm p-4">
        Need ≥2 embedded documents to render 3D Memory Palace
      </div>
    );
  }

  return (
    <div className="relative w-full h-[400px] rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden cursor-crosshair">
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeLabel="name"
        nodeColor={node => (node as GraphNode).color}
        nodeRelSize={6}
        nodeOpacity={0.9}
        nodeResolution={16}
        
        // Link styling: entangled links get bright glowing fuchsia, standard links get dim cyan
        linkColor={link => (link as GraphLink).isEntangled ? 'rgba(217, 70, 239, 0.8)' : 'rgba(34, 211, 238, 0.2)'}
        linkWidth={link => (link as GraphLink).isEntangled ? 2 : 0.5}
        linkOpacity={0.6}
        
        // Advanced 3D rendering properties
        enableNodeDrag={false}
        enableNavigationControls={true}
        showNavInfo={false}
        backgroundColor="#020617" // tailwind slate-950
        
        onNodeHover={(node: any) => setHoverNode(node)}
      />
      
      {/* HUD overlay for hovered node */}
      {hoverNode && (
        <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-slate-900/90 border border-cyan-500/30 p-3 text-xs backdrop-blur-md pointer-events-none z-10 transition-opacity">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: hoverNode.color }} />
            <p className="font-mono uppercase tracking-widest font-bold" style={{ color: hoverNode.color }}>Cluster {hoverNode.cluster}</p>
          </div>
          <p className="text-slate-300 font-serif leading-relaxed line-clamp-2">{hoverNode.name}</p>
        </div>
      )}
      
      <div className="absolute top-2 left-2 pointer-events-none bg-black/40 backdrop-blur px-2 py-1 rounded text-[10px] text-cyan-500/70 font-mono uppercase border border-cyan-500/20">
        3D Memory Palace Active
      </div>
    </div>
  );
}
