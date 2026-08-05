import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Box, ZoomIn, ZoomOut, RotateCcw, Activity } from 'lucide-react';
import { Memory } from '../App.js';
import * as d3 from 'd3';

interface MemoryGraph3DProps {
  memories: Memory[];
}

interface Node3D extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  fullText: string;
  type: 'root' | 'tag' | 'memory';
  r: number;
  color: string;
  strength?: number;
  sentiment?: number;
  z: number;
  vz: number;
  // 2D projection coords
  projX?: number;
  projY?: number;
  projZ?: number;
  projScale?: number;
}

interface Link3D extends d3.SimulationLinkDatum<Node3D> {
  source: string | Node3D;
  target: string | Node3D;
  value: number;
  color: string;
}

const PALETTE = [
  '#2dd4bf', // teal-400
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
];

export const MemoryGraph3D: React.FC<MemoryGraph3DProps> = ({ memories }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Layout states
  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });
  const [selectedNode, setSelectedNode] = useState<Node3D | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node3D | null>(null);
  
  // Interactive variables
  const [autoRotate, setAutoRotate] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showLabels, setShowLabels] = useState(true);

  // Refs for tracking interactive states in RAF loop
  const pitchRef = useRef<number>(0.2); // vertical rotation
  const yawRef = useRef<number>(0.5);   // horizontal rotation
  const zoomRef = useRef<number>(1.0);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragAnglesRef = useRef<{ pitch: number; yaw: number }>({ pitch: 0.2, yaw: 0.5 });
  const lastActiveRef = useRef<number>(Date.now());

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 300),
          height: Math.max(height || 400, 350),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Construct 3D Nodes and Links
  const graphData = useMemo(() => {
    const nodes: Node3D[] = [];
    const links: Link3D[] = [];

    // 1. Root Anchor Node (Cognitive Hub)
    nodes.push({
      id: 'root',
      label: 'Cognitive Core',
      fullText: 'Central orchestrator of the Arcane Quantum Brain synaptic matrix',
      type: 'root',
      r: 14,
      color: '#6366f1',
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    });

    const tagNodesMap = new Map<string, Node3D>();
    const tagColors = new Map<string, string>();
    let colorIndex = 0;

    // 2. Build Tag Nodes
    memories.forEach((mem) => {
      if (mem.tags && mem.tags.length > 0) {
        mem.tags.forEach((tag) => {
          const cleanTag = tag.trim();
          if (!cleanTag) return;
          if (!tagNodesMap.has(cleanTag)) {
            const color = PALETTE[colorIndex % PALETTE.length];
            colorIndex++;
            
            // Distribute tags spherically around root
            const phi = Math.acos(-1 + (2 * tagNodesMap.size) / 10) || 0;
            const theta = Math.sqrt(10 * Math.PI) * phi || 0;
            const radius = 90;

            const tagNode: Node3D = {
              id: `tag_${cleanTag}`,
              label: `#${cleanTag}`,
              fullText: `Semantic clustering index for context topic: ${cleanTag}`,
              type: 'tag',
              r: 9,
              color,
              x: radius * Math.cos(theta) * Math.sin(phi),
              y: radius * Math.sin(theta) * Math.sin(phi),
              z: radius * Math.cos(phi),
              vx: 0,
              vy: 0,
              vz: 0,
            };

            tagNodesMap.set(cleanTag, tagNode);
            tagColors.set(cleanTag, color);
            nodes.push(tagNode);

            // Link Tag to Root
            links.push({
              source: 'root',
              target: tagNode.id,
              value: 2.5,
              color: 'rgba(99, 102, 241, 0.4)',
            });
          }
        });
      }
    });

    // 3. Build Memory Nodes
    memories.forEach((mem) => {
      const primaryTag = mem.tags && mem.tags.length > 0 ? mem.tags[0].trim() : null;
      const color = primaryTag ? (tagColors.get(primaryTag) || '#2dd4bf') : '#94a3b8';
      
      const textSnippet = mem.text.length > 30 ? mem.text.substring(0, 27) + '...' : mem.text;
      
      // Compute semi-random starting position around its primary tag or root
      const parentNode = primaryTag ? tagNodesMap.get(primaryTag) : nodes[0];
      const startX = (parentNode?.x || 0) + (Math.random() - 0.5) * 50;
      const startY = (parentNode?.y || 0) + (Math.random() - 0.5) * 50;
      const startZ = (parentNode?.z || 0) + (Math.random() - 0.5) * 50;

      const memNode: Node3D = {
        id: `mem_${mem.id}`,
        label: textSnippet,
        fullText: mem.text,
        type: 'memory',
        r: 5.5,
        color,
        strength: mem.strength || 100,
        sentiment: mem.sentiment,
        x: startX,
        y: startY,
        z: startZ,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        vz: (Math.random() - 0.5) * 2,
      };

      nodes.push(memNode);

      // Links
      if (mem.tags && mem.tags.length > 0) {
        mem.tags.forEach((tag) => {
          const cleanTag = tag.trim();
          if (tagNodesMap.has(cleanTag)) {
            links.push({
              source: `tag_${cleanTag}`,
              target: memNode.id,
              value: 1.2,
              color: 'rgba(255, 255, 255, 0.12)',
            });
          }
        });
      } else {
        // No tag, connect directly to root
        links.push({
          source: 'root',
          target: memNode.id,
          value: 1.0,
          color: 'rgba(255, 255, 255, 0.08)',
        });
      }
    });

    return { nodes, links };
  }, [memories]);

  // Sync zoom control with ref
  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  // Main 3D Simulation using D3 and Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const nodes: Node3D[] = graphData.nodes.map(n => ({ ...n }));
    const links: Link3D[] = graphData.links.map(l => ({ ...l }));

    // Initialize D3 Force Simulation for X and Y layout, with customized Z calculation inside tick
    const simulation = d3.forceSimulation<Node3D>(nodes)
      .force('charge', d3.forceManyBody().strength(d => {
        const node = d as Node3D;
        return node.type === 'root' ? -500 : node.type === 'tag' ? -150 : -60;
      }))
      .force('link', d3.forceLink<Node3D, Link3D>(links)
        .id(d => d.id)
        .distance(l => {
          const sNode = l.source as Node3D;
          const tNode = l.target as Node3D;
          if (sNode.type === 'root' || tNode.type === 'root') return 120;
          if (sNode.type === 'tag' && tNode.type === 'memory') return 45;
          return 70;
        })
        .strength(0.8)
      )
      .force('center', d3.forceCenter(0, 0).strength(0.04))
      .velocityDecay(0.3)
      .alphaDecay(0.015);

    // D3 Tick handles coordinates and Z-axis physics calculations
    simulation.on('tick', () => {
      // 1. Z-axis Repulsion (3D electrostatics)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const ni = nodes[i];
          const nj = nodes[j];
          const dz = nj.z - ni.z;
          const distZ = Math.abs(dz) || 1;
          if (distZ < 250) {
            const k = ni.type === 'root' || nj.type === 'root' ? 1000 : 250;
            const force = -k / (distZ * distZ + 10);
            ni.vz += force * (dz > 0 ? 1 : -1);
            nj.vz -= force * (dz > 0 ? 1 : -1);
          }
        }
      }

      // 2. Z-axis Attraction (Spring-like bonds along Links)
      links.forEach((link) => {
        const s = link.source as Node3D;
        const t = link.target as Node3D;
        if (!s || !t) return;

        const dz = t.z - s.z;
        let targetDist = 70;
        if (s.type === 'root' && t.type === 'tag') targetDist = 100;
        if (s.type === 'tag' && t.type === 'memory') targetDist = 40;

        const k = 0.05; // stiffness
        const force = k * (Math.abs(dz) - targetDist);
        const fz = (force * (dz || 1)) / (Math.abs(dz) || 1);

        s.vz += fz;
        t.vz -= fz;
      });

      // 3. Central Anchor Gravity pulling Z back to center plane
      nodes.forEach((node) => {
        const gravityStrength = node.type === 'root' ? 0.08 : 0.015;
        node.vz += (0 - node.z) * gravityStrength;

        // Keep core node absolutely pinned at 3D center
        if (node.type === 'root') {
          node.x = 0;
          node.y = 0;
          node.z = 0;
          node.vx = 0;
          node.vy = 0;
          node.vz = 0;
          return;
        }

        // Apply velocity to position
        node.z += node.vz;
        // Apply Z-axis friction dampening
        node.vz *= 0.85;
      });
    });

    const render = () => {
      // Clear with deep obsidian theme
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Auto rotation logic if idle
      if (autoRotate && !isDraggingRef.current) {
        const idleTime = Date.now() - lastActiveRef.current;
        if (idleTime > 2500) {
          yawRef.current += 0.003; // Smooth rotation orbit
        }
      }

      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const focalLength = 320; // Perspective projection distance

      // Trigonometric constants for camera matrix
      const cosY = Math.cos(yawRef.current);
      const sinY = Math.sin(yawRef.current);
      const cosP = Math.cos(pitchRef.current);
      const sinP = Math.sin(pitchRef.current);

      // Map nodes to 2D screen coordinates using perspective projection
      nodes.forEach((node) => {
        const nx = node.x || 0;
        const ny = node.y || 0;
        const nz = node.z || 0;

        // Y-axis rotation (yaw)
        const x1 = nx * cosY - nz * sinY;
        const z1 = nz * cosY + nx * sinY;

        // X-axis rotation (pitch)
        const y2 = ny * cosP - z1 * sinP;
        const z2 = z1 * cosP + ny * sinP;

        // Perspective zoom scaling
        const scale = (focalLength / (focalLength + z2)) * zoomRef.current;

        node.projX = centerX + x1 * scale;
        node.projY = centerY + y2 * scale;
        node.projZ = z2; // For Painter's algorithm depth sort
        node.projScale = scale;
      });

      // Depth Sort: painters algorithm (draw rear objects first)
      const sortedNodes = [...nodes].sort((a, b) => (b.projZ || 0) - (a.projZ || 0));

      // Draw Connection Links
      links.forEach((link) => {
        const s = link.source as Node3D;
        const t = link.target as Node3D;
        if (!s || !t || s.projX === undefined || t.projX === undefined) return;

        // Depth alpha projection
        const avgZ = ((s.projZ || 0) + (t.projZ || 0)) / 2;
        const depthAlpha = Math.max(0.04, Math.min(0.8, (focalLength - avgZ) / (focalLength * 1.5)));
        
        // Match selection highlights
        const isHoveredLine = hoveredNode && (hoveredNode.id === s.id || hoveredNode.id === t.id);
        const isSelectedLine = selectedNode && (selectedNode.id === s.id || selectedNode.id === t.id);

        ctx.beginPath();
        ctx.moveTo(s.projX, s.projY || 0);
        ctx.lineTo(t.projX, t.projY || 0);

        if (isHoveredLine) {
          ctx.strokeStyle = '#2dd4bf';
          ctx.lineWidth = 2.5;
        } else if (isSelectedLine) {
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2.0;
        } else {
          ctx.strokeStyle = link.color;
          ctx.lineWidth = link.value * Math.max(0.3, s.projScale || 1);
        }

        ctx.globalAlpha = depthAlpha * (isHoveredLine || isSelectedLine ? 1.0 : 0.6);
        ctx.stroke();
        ctx.globalAlpha = 1.0; // Reset
      });

      // Draw Nodes as gorgeous shaded spheres
      sortedNodes.forEach((node) => {
        if (node.projX === undefined || node.projY === undefined || node.projScale === undefined) return;

        const isHovered = hoveredNode && hoveredNode.id === node.id;
        const isSelected = selectedNode && selectedNode.id === node.id;

        // Sphere radius based on depth projection
        const radius = Math.max(1.5, node.r * node.projScale);
        
        ctx.beginPath();
        ctx.arc(node.projX, node.projY, radius, 0, Math.PI * 2);

        // Alpha based on depth
        const nodeAlpha = Math.max(0.15, Math.min(1.0, (focalLength - (node.projZ || 0)) / focalLength));
        ctx.globalAlpha = nodeAlpha;

        // Radial shading for highly-polished 3D sphere illusion
        const gradient = ctx.createRadialGradient(
          node.projX - radius * 0.3,
          node.projY - radius * 0.3,
          radius * 0.05,
          node.projX,
          node.projY,
          radius
        );

        let baseColor = node.color;
        if (isHovered) baseColor = '#ffffff';
        else if (isSelected) baseColor = '#a855f7';

        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.2, baseColor);
        gradient.addColorStop(1, '#000000');

        ctx.fillStyle = gradient;
        ctx.fill();

        // High-contrast outer orbital glow on selected/hovered nodes
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(node.projX, node.projY, radius + 3.5, 0, Math.PI * 2);
          ctx.strokeStyle = isHovered ? '#2dd4bf' : '#a855f7';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Draw node labels on high scale/selection
        if (showLabels) {
          const showLabelThreshold = node.type === 'root' || node.type === 'tag' || isHovered || isSelected;
          if (showLabelThreshold) {
            ctx.fillStyle = isHovered ? '#ffffff' : isSelected ? '#a855f7' : '#cbd5e1';
            
            const fontSize = Math.max(7.5, Math.min(13, 10 * node.projScale));
            ctx.font = `${node.type === 'root' ? 'bold' : 'normal'} ${fontSize}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(node.label, node.projX, node.projY + radius + 4.5);
            ctx.shadowBlur = 0;
          }
        }

        ctx.globalAlpha = 1.0; // Reset
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      simulation.stop();
      cancelAnimationFrame(animationFrameId);
    };
  }, [graphData, dimensions, autoRotate, showLabels, hoveredNode, selectedNode]);

  // Handle Drag / Rotation controls
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragAnglesRef.current = { pitch: pitchRef.current, yaw: yawRef.current };
    lastActiveRef.current = Date.now();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mX = e.clientX - rect.left;
    const mY = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      // Rotate camera viewport
      yawRef.current = dragAnglesRef.current.yaw - dx * 0.007;
      pitchRef.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, dragAnglesRef.current.pitch + dy * 0.007));
      lastActiveRef.current = Date.now();
    } else {
      // 3D Projection Hover Hit-testing
      let hitNode: Node3D | null = null;
      let minDistance = 15; 

      graphData.nodes.forEach((node) => {
        if (node.projX === undefined || node.projY === undefined || node.projScale === undefined) return;
        
        const dist = Math.hypot(node.projX - mX, node.projY - mY);
        const radius = Math.max(4, node.r * node.projScale);
        
        if (dist < radius + 8 && dist < minDistance) {
          minDistance = dist;
          hitNode = node;
        }
      });

      if (hitNode !== hoveredNode) {
        setHoveredNode(hitNode);
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    lastActiveRef.current = Date.now();
  };

  const handleClick = () => {
    setSelectedNode(hoveredNode);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.001;
    setZoomLevel((prev) => Math.max(0.4, Math.min(3.0, prev + zoomDelta)));
    lastActiveRef.current = Date.now();
  };

  const handleResetCamera = () => {
    pitchRef.current = 0.2;
    yawRef.current = 0.5;
    setZoomLevel(1.0);
    setSelectedNode(null);
  };

  return (
    <div ref={containerRef} className="relative flex flex-col h-full w-full border border-teal-500/20 bg-slate-950/60 backdrop-blur-md rounded-2xl overflow-hidden shadow-xl select-none min-h-[460px]">
      
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row items-center justify-between border-b border-white/5 bg-slate-950/80 p-4 gap-3 z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-500/10 rounded-lg border border-teal-500/20 text-teal-400">
            <Box size={18} className="animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest font-sans flex items-center gap-1.5">
              3D Synaptic D3 Graph
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              Drag to orbit · Scroll to zoom · Click nodes to inspect
            </p>
          </div>
        </div>

        {/* Floating Quick Action Controls */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-white/10 gap-1 shadow-inner">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-200 ${
              autoRotate ? 'bg-teal-500 text-teal-950 shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle autonomous rotation around cognitive center"
          >
            Orbiting: {autoRotate ? 'ON' : 'OFF'}
          </button>
          
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-200 ${
              showLabels ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Labels
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          <button
            onClick={() => setZoomLevel((z) => Math.min(3.0, z + 0.15))}
            className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={12} />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.15))}
            className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={12} />
          </button>
          <button
            onClick={handleResetCamera}
            className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded transition-colors"
            title="Reset view angles and zoom"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Stage */}
      <div className="relative flex-1 bg-black/60 w-full overflow-hidden" style={{ minHeight: '360px' }}>
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
          className="absolute inset-0 block w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* Legend overlays */}
        <div className="absolute top-3 left-3 p-2.5 bg-slate-950/80 border border-white/5 backdrop-blur-md rounded-xl text-[9px] font-mono text-slate-400 flex flex-col gap-1.5 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1] border border-white/10" />
            <span>Cognitive Core Anchor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 border border-white/10" />
            <span>Semantic Tags</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8] border border-white/10" />
            <span>Synaptic Memories</span>
          </div>
        </div>

        {/* Floating details inspection banner */}
        {(selectedNode || hoveredNode) && (
          <div className="absolute bottom-3 left-3 right-3 md:left-4 md:right-auto md:max-w-md bg-slate-950/95 border border-teal-500/30 backdrop-blur p-4 rounded-xl text-xs shadow-2xl flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-300 z-10 border-l-4 border-l-teal-500">
            {(() => {
              const activeNode = selectedNode || hoveredNode;
              if (!activeNode) return null;

              return (
                <>
                  <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <span 
                      className="font-mono uppercase font-bold tracking-widest text-[9px]" 
                      style={{ color: activeNode.color || '#2dd4bf' }}
                    >
                      {activeNode.type === 'root' ? '🧠 CORE INSTANCE' : activeNode.type === 'tag' ? '🏷️ SEMANTIC TOPIC' : '💾 ENCODED MEMORY'}
                    </span>
                    {selectedNode && (
                      <button 
                        onClick={() => setSelectedNode(null)} 
                        className="text-slate-500 hover:text-slate-300 text-[9px] uppercase tracking-widest font-mono cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <h4 className="text-slate-100 font-bold tracking-tight text-sm">
                    {activeNode.label}
                  </h4>
                  <p className="text-slate-300 font-normal leading-relaxed text-[11px] font-sans">
                    {activeNode.fullText}
                  </p>
                  
                  {activeNode.strength !== undefined && (
                    <div className="flex items-center gap-1.5 mt-1 border-t border-white/5 pt-1.5 justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-slate-500 uppercase font-mono">Consolidation Strength:</span>
                        <span className="text-[10px] text-teal-400 font-bold font-mono">{activeNode.strength}%</span>
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                           <div 
                            key={i} 
                            className={`w-1.5 h-2 rounded-sm ${i * 20 <= (activeNode.strength || 0) ? 'bg-teal-500/80' : 'bg-white/10'}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {activeNode.sentiment !== undefined && (
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className="text-[9px] text-slate-500 uppercase font-mono">Inherent Sentiment Score:</span>
                      <span className={`text-[10px] font-bold font-mono ${activeNode.sentiment > 0.1 ? 'text-emerald-400' : activeNode.sentiment < -0.1 ? 'text-red-400' : 'text-slate-400'}`}>
                        {(activeNode.sentiment || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Empty state overlay */}
        {(!memories || memories.length === 0) && (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/90 text-center p-6">
            <div className="flex flex-col items-center gap-2 max-w-sm">
              <Activity size={32} className="text-slate-700 animate-pulse" />
              <h4 className="text-slate-300 font-bold uppercase tracking-widest text-xs font-sans">No Synapses Initialized</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                The neural cortex is blank. Inject cognitive memories first in order to construct tag relations.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
