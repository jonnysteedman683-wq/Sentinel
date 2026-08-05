import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import ForceGraph2D from 'react-force-graph-2d';
import { Network, Search, Zap, SlidersHorizontal, Compass, Layers, Eye } from 'lucide-react';
import KnowledgeGraphPanel, { Spark } from './KnowledgeGraphPanel.js';

interface MindMapProps {
  memories: any[];
  theme?: 'dark' | 'light';
  sparks?: Spark[];
  onBindSpark?: (spark: Spark) => void;
}

const COLORS = [
  '#ec4899', // pink-500
  '#a855f7', // purple-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
];

type VizMode = 'synaptic' | 'radial' | 'pca';

interface ERDEntity {
  name: string;
  type: string;
  canonical: string;
  relations: string[];
}

export const MindMap: React.FC<MindMapProps> = ({ memories, theme = 'dark', sparks, onBindSpark }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fgRef = useRef<any>(null);

  // States
  const [mode, setMode] = useState<VizMode>('synaptic');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  const [erdNodes, setErdNodes] = useState<any[]>([]);
  const [erdLinks, setErdLinks] = useState<any[]>([]);
  const [isExtractingErd, setIsExtractingErd] = useState<boolean>(false);
  const [extractedMems, setExtractedMems] = useState<Set<string>>(new Set());

  // Physics Configs
  const [gravity, setGravity] = useState<number>(-220);
  const linkDist = 75;
  const [enableParticles, setEnableParticles] = useState<boolean>(true);
  const particleSpeed = 0.006;

  // Dynamic Size State
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // 1. Observe container dimensions dynamically to respect frame bounds and handle sidebar toggles perfectly
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 400),
          height: Math.max(height || 500, 450)
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 2. Preprocess memories into structured nodes and links
  const { nodes: mapNodes, links: mapLinks } = useMemo(() => {
    const listNodes: any[] = [];
    const listLinks: any[] = [];

    // Core root node representing the central agent schema
    const rootNode = { 
      id: 'root', 
      group: 0, 
      label: 'Cognitive Core', 
      fullText: 'Central orchestrator of the Arcane Quantum Brain synaptic matrix', 
      r: 15,
      color: '#6366f1' // elegant indigo
    };
    listNodes.push(rootNode);

    const tagMap = new Map();
    const tagColors = new Map();
    let colorIdx = 0;

    // Create tag nodes
    memories.forEach(mem => {
      if (mem.tags) {
        mem.tags.forEach((tag: string) => {
          if (!tagMap.has(tag)) {
            const color = COLORS[colorIdx % COLORS.length];
            colorIdx++;
            const tagNode = { 
              id: `tag_${tag}`, 
              group: 1, 
              label: `#${tag}`, 
              fullText: `Semantic clustering index for context topic: ${tag}`, 
              r: 10, 
              color 
            };
            tagMap.set(tag, tagNode);
            tagColors.set(tag, color);
            listNodes.push(tagNode);
            listLinks.push({ source: 'root', target: tagNode.id, value: 3, speed: 0.01 });
          }
        });
      }
    });

    // Create individual memory nodes
    memories.forEach(mem => {
      const primaryTag = mem.tags && mem.tags.length > 0 ? mem.tags[0] : null;
      const color = primaryTag ? tagColors.get(primaryTag) : (theme === 'dark' ? '#94a3b8' : '#475569');

      const textSnippet = mem.text.length > 25 ? mem.text.substring(0, 22) + '...' : mem.text;
      const memNode = { 
        id: `mem_${mem.id}`, 
        group: 2, 
        label: textSnippet, 
        fullText: mem.text, 
        r: 6, 
        color,
        strength: mem.strength || 100
      };
      listNodes.push(memNode);

      if (mem.tags && mem.tags.length > 0) {
        mem.tags.forEach((tag: string) => {
          listLinks.push({ source: `tag_${tag}`, target: memNode.id, value: 1.5, speed: 0.005 });
        });
      } else {
        listLinks.push({ source: 'root', target: memNode.id, value: 1.5, speed: 0.005 });
      }
    });

    return { 
      nodes: [...listNodes, ...erdNodes], 
      links: [...listLinks, ...erdLinks] 
    };
  }, [memories, theme, erdNodes, erdLinks]);

  // 3. Highlight nodes and links based on search criteria
  const highlightNodes = useMemo(() => {
    const set = new Set<string>();
    if (!searchQuery.trim()) return set;
    const queryLower = searchQuery.toLowerCase();

    mapNodes.forEach(node => {
      if (
        node.label.toLowerCase().includes(queryLower) || 
        (node.fullText && node.fullText.toLowerCase().includes(queryLower))
      ) {
        set.add(node.id);
        // Also add connected tag nodes to highlight paths
        if (node.id.startsWith('mem_')) {
          const index = mapNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            // Find its connection links
            mapLinks.forEach(link => {
              if (link.target === node.id || (typeof link.target === 'object' && (link.target as any).id === node.id)) {
                const sId = typeof link.source === 'object' ? (link.source as any).id : link.source;
                set.add(sId);
              }
            });
          }
        }
      }
    });
    return set;
  }, [searchQuery, mapNodes, mapLinks]);

  // Handle zooming / focusing on camera click
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      fgRef.current.centerAt(node.x, node.y, 750);
      fgRef.current.zoom(3, 750);
    }
  }, []);

  const extractErd = async (memoryNode: any) => {
    const rawId = memoryNode.id.replace('mem_', '');
    if (extractedMems.has(rawId)) return;
    
    setIsExtractingErd(true);
    try {
      const res = await fetch('/api/knowledge/erd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: memoryNode.fullText })
      });
      const data = await res.json();
      
      if (data.success && data.erd && data.erd.entities) {
        const newNodes: any[] = [];
        const newLinks: any[] = [];
        
        data.erd.entities.forEach((entity: ERDEntity) => {
          const eId = `erd_${entity.name.toLowerCase().replace(/\\s+/g, '_')}`;
          
          newNodes.push({
            id: eId,
            group: 3,
            label: entity.name,
            fullText: `Type: ${entity.type}\\nCanonical: ${entity.canonical}`,
            r: 8,
            color: '#f59e0b', // amber
            erdType: entity.type
          });
          
          newLinks.push({
            source: memoryNode.id,
            target: eId,
            value: 2,
            speed: 0.02
          });
        });
        
        setErdNodes(prev => [...prev, ...newNodes]);
        setErdLinks(prev => [...prev, ...newLinks]);
        setExtractedMems(prev => new Set(prev).add(rawId));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsExtractingErd(false);
    }
  };

  // 4. Custom radial tree d3 SVG simulation
  useEffect(() => {
    if (mode !== 'radial' || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create nodes clone to avoid mutations causing React render cycles
    const d3Nodes = mapNodes.map(n => ({ ...n }));
    const d3Links = mapLinks.map(l => ({ ...l }));

    const width = dimensions.width;
    const height = dimensions.height;

    // Center d3 simulation
    const simulation = d3.forceSimulation(d3Nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(d3Links).id((d: any) => d.id).distance((d: any) => d.value === 3 ? linkDist * 1.6 : linkDist * 0.75))
      .force('charge', d3.forceManyBody().strength(gravity))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d: any) => (d.r || 5) + 12));

    // Render paths
    const link = svg.append('g')
      .selectAll('line')
      .data(d3Links)
      .join('line')
      .attr('stroke', theme === 'dark' ? 'rgba(34, 211, 238, 0.15)' : 'rgba(15, 118, 110, 0.15)')
      .attr('stroke-width', (d: any) => d.value)
      .style('transition', 'stroke 0.3s');

    // Render node groups
    const nodeG = svg.append('g')
      .selectAll('g')
      .data(d3Nodes)
      .join('g')
      .attr('class', 'cursor-pointer')
      .on('mouseover', (_e, d: any) => setHoveredNode(d.id))
      .on('mouseout', () => setHoveredNode(null))
      .on('click', (_e, d: any) => setSelectedNode(d));

    // Glow effects
    const glowDef = svg.append('defs');
    const filter = glowDef.append('filter')
      .attr('id', 'neon-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'blur');
    filter.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .join('feMergeNode')
      .attr('in', d => d);

    // Draw node circles
    nodeG.append('circle')
      .attr('r', (d: any) => d.r)
      .attr('fill', (d: any) => d.color || '#94a3b8')
      .attr('stroke', theme === 'dark' ? '#0f172a' : '#ffffff')
      .attr('stroke-width', 1.5)
      .style('transition', 'r 0.2s, filter 0.2s')
      .attr('filter', (d: any) => hoveredNode === d.id || highlightNodes.has(d.id) ? 'url(#neon-glow)' : 'none');

    // Draw node text labels
    nodeG.append('text')
      .attr('dy', (d: any) => d.r + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', theme === 'dark' ? '#cbd5e1' : '#1e293b')
      .attr('font-size', '10px')
      .attr('font-family', 'JetBrains Mono, SFMono-Regular, monospace')
      .attr('font-weight', (d: any) => d.group === 0 ? 'bold' : 'normal')
      .text((d: any) => d.label)
      .style('pointer-events', 'none')
      .attr('fill-opacity', (d: any) => {
        if (highlightNodes.size > 0) {
          return highlightNodes.has(d.id) ? 1.0 : 0.25;
        }
        return hoveredNode && hoveredNode !== d.id ? 0.35 : 1.0;
      });

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeG.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [mode, mapNodes, mapLinks, dimensions, theme, hoveredNode, highlightNodes, gravity]);

  // Adjust particle flow rate
  const linkParticles = useCallback((link: any) => {
    return enableParticles ? (link.value === 3 ? 3 : 1) : 0;
  }, [enableParticles]);

  const linkParticleSpeed = useCallback((_link: any) => {
    return particleSpeed;
  }, [particleSpeed]);

  return (
    <div ref={containerRef} className="relative flex flex-col h-full w-full border border-cyan-500/20 bg-slate-900/60 backdrop-blur-md rounded-2xl overflow-hidden shadow-lg select-none">
      
      {/* 1. Header and Workspace Tabs */}
      <div className="flex flex-col md:flex-row items-center justify-between border-b border-white/5 bg-slate-950/40 p-4 gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-pink-500/10 rounded-lg border border-pink-500/20 text-pink-400">
            <Network size={18} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest font-sans flex items-center gap-1.5">
              Synaptic Mind Map
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              {mapNodes.length - 1} Synapses · {mapLinks.length} Connections · {memories.length} Memoria {erdNodes.length > 0 ? `· ${erdNodes.length} Deep Entities` : ''}
            </p>
          </div>
        </div>

        {/* View Mode Selectors */}
        <div className="flex items-center bg-slate-900/80 p-1.5 rounded-xl border border-white/5 gap-1 shadow-inner">
          <button
            onClick={() => setMode('synaptic')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
              mode === 'synaptic'
                ? 'bg-pink-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Compass size={12} />
            Interactive Web
          </button>
          <button
            onClick={() => setMode('radial')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
              mode === 'radial'
                ? 'bg-purple-500 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Layers size={12} />
            SVG Hierarchy
          </button>
          <button
            onClick={() => setMode('pca')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
              mode === 'pca'
                ? 'bg-cyan-500 text-cyan-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Eye size={12} />
            PCA Projection
          </button>
        </div>
      </div>

      {/* 2. Control overlay Panel (floating/translucent) */}
      <div className="grid grid-cols-1 md:grid-cols-4 border-b border-white/5 bg-slate-950/20 px-4 py-3 gap-3">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Query mind map (e.g. quantum, logic, tag...)"
            className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-1.5 pl-9 pr-4 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 transition-all shadow-inner"
          />
        </div>

        {/* Physics toggle controls */}
        <div className="flex items-center justify-between bg-slate-900/40 px-3 py-1.5 rounded-xl border border-white/5">
          <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Zap size={10} className="text-yellow-400 animate-pulse" /> Signal Flow
          </span>
          <button
            onClick={() => setEnableParticles(!enableParticles)}
            className={`text-[9px] px-2.5 py-1 rounded-md border font-mono font-bold transition-colors ${
              enableParticles 
                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' 
                : 'bg-slate-800 border-white/5 text-slate-500'
            }`}
          >
            {enableParticles ? 'ACTIVE' : 'MUTED'}
          </button>
        </div>

        {/* Advanced Settings Drawer Trigger */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={12} className="text-pink-400" />
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Physics Panel</span>
          <div className="flex-1 flex items-center gap-1">
            <input
              type="range"
              min="-600"
              max="-50"
              value={gravity}
              onChange={(e) => setGravity(Number(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
              title="Simulation gravity strength"
            />
          </div>
        </div>
      </div>

      {/* 3. Main Stage */}
      <div className="relative flex-1 bg-slate-950/40 w-full overflow-hidden" style={{ minHeight: '400px' }}>
        
        {/* Render PCA Projection View */}
        {mode === 'pca' && (
          <div className="w-full h-full p-4 overflow-auto">
            <KnowledgeGraphPanel memories={memories} sparks={sparks} onBindSpark={onBindSpark} />
          </div>
        )}

        {/* Render SVG Custom Radial Hierarchy View */}
        {mode === 'radial' && (
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="w-full h-full transition-transform duration-300"
          />
        )}

        {/* Render Interactive Canvas Force Graph (React Force Graph 2D) */}
        {mode === 'synaptic' && (
          <div className="w-full h-full">
            <ForceGraph2D
              ref={fgRef}
              graphData={{ nodes: mapNodes, links: mapLinks }}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="transparent"
              nodeRelSize={1}
              nodeVal={(node: any) => node.r}
              nodeColor={(node: any) => {
                const isHighlighted = highlightNodes.size > 0 && highlightNodes.has(node.id);
                if (isHighlighted) return '#f43f5e'; // Highlighted nodes are hot coral red
                if (hoveredNode === node.id) return '#ffffff';
                return node.color || '#2dd4bf';
              }}
              nodeLabel={(node: any) => node.label}
              onNodeClick={handleNodeClick}
              onNodeHover={(node: any) => setHoveredNode(node ? node.id : null)}
              linkWidth={(link: any) => {
                return hoveredNode === link.source.id || hoveredNode === link.target.id ? 2.5 : link.value;
              }}
              linkColor={(link: any) => {
                const isSourceHovered = hoveredNode === link.source.id;
                const isTargetHovered = hoveredNode === link.target.id;
                if (isSourceHovered || isTargetHovered) return '#f472b6'; // hot pink connection
                return theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
              }}
              linkDirectionalParticles={linkParticles}
              linkDirectionalParticleSpeed={linkParticleSpeed}
              linkDirectionalParticleWidth={1.8}
              linkDirectionalParticleColor={() => '#fbbf24'} // Amber action potential flows
              cooldownTicks={120}
              d3AlphaDecay={0.08}
              d3VelocityDecay={0.35}
            />
          </div>
        )}

        {/* Interactive floating node information banner */}
        {(selectedNode || hoveredNode) && (
          <div className="absolute bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-md bg-slate-900/95 border border-pink-500/20 backdrop-blur p-3.5 rounded-xl text-xs shadow-xl flex flex-col gap-1.5 animate-in slide-in-from-bottom-2 duration-300 z-10">
            {(() => {
              const activeNode = selectedNode || mapNodes.find(n => n.id === hoveredNode);
              if (!activeNode) return null;

              return (
                <>
                  <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <span 
                      className="font-mono uppercase font-bold tracking-wider" 
                      style={{ color: activeNode.color || '#2dd4bf' }}
                    >
                      {activeNode.group === 0 ? 'COGNITIVE CORE' : activeNode.group === 1 ? 'TOPIC INDEX' : activeNode.group === 3 ? 'ERD ENTITY' : 'SYNAPTIC MEMORY'}
                    </span>
                    <button 
                      onClick={() => setSelectedNode(null)} 
                      className="text-slate-500 hover:text-slate-300 text-[9px] uppercase tracking-widest font-mono"
                    >
                      Dismiss
                    </button>
                  </div>
                  <h4 className="text-slate-100 font-bold tracking-tight">
                    {activeNode.label}
                  </h4>
                  <p className="text-slate-400 font-normal leading-relaxed text-[11px]">
                    {activeNode.fullText || activeNode.label}
                  </p>
                  
                  {activeNode.group === 2 && (
                    <button
                      onClick={() => extractErd(activeNode)}
                      disabled={isExtractingErd || extractedMems.has(activeNode.id.replace('mem_', ''))}
                      className="mt-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg px-2 py-1 text-[10px] font-bold font-mono tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isExtractingErd ? 'EXTRACTING ERD...' : extractedMems.has(activeNode.id.replace('mem_', '')) ? 'ERD EXTRACTED' : 'EXTRACT ERD (DEEP)'}
                    </button>
                  )}

                  {activeNode.strength !== undefined && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] text-slate-500 uppercase font-mono">Synapse strength:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div 
                            key={i} 
                            className={`w-1 h-2 rounded-sm ${i * 20 <= activeNode.strength ? 'bg-pink-500/80' : 'bg-white/10'}`}
                          />
                        ))}
                      </div>
                      <span className="text-[9px] text-pink-400 font-bold font-mono">{activeNode.strength}%</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* No Memories Fallback Overlay */}
        {!memories || memories.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/80 border border-white/5 text-center p-6">
            <div className="flex flex-col items-center gap-2 max-w-sm">
              <Network size={36} className="text-slate-700 animate-pulse" />
              <h4 className="text-slate-300 font-bold uppercase tracking-widest text-xs">Awaiting Synaptic Data</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                No memories or telemetry have been initialized. Inject concepts via neural interface to visualize the mind map structure.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
