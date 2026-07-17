import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Memory } from '../App.js';

interface MemoryForceGraphProps {
  memories: Memory[];
}

export const MemoryForceGraph: React.FC<MemoryForceGraphProps> = ({ memories }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || memories.length === 0) return;

    // Build nodes and links based on shared tags
    const nodes: any[] = memories.map(m => ({
      id: m.id,
      text: m.text,
      tags: m.tags || [],
      strength: m.strength || 0,
      radius: 8 + Math.min(20, (m.strength || 0) / 10)
    }));

    const links: any[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const sharedTags = nodes[i].tags.filter((t: string) => nodes[j].tags.includes(t));
        if (sharedTags.length > 0) {
          links.push({
            source: nodes[i].id,
            target: nodes[j].id,
            value: sharedTags.length,
            sharedTags
          });
        }
      }
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // clear old chart

    const { width, height } = dimensions;

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => d.radius + 5).iterations(2));

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (e) => {
        g.attr("transform", e.transform);
      });
      
    svg.call(zoom as any);

    const link = g.append("g")
      .attr("stroke", "#334155")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d: any) => Math.min(5, d.value));

    const nodeGroup = g.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<any, any>()
        .on("start", (e, d) => {
          if (!e.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (e, d) => {
          d.fx = e.x;
          d.fy = e.y;
        })
        .on("end", (e, d) => {
          if (!e.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any);

    nodeGroup.append("circle")
      .attr("r", (d: any) => d.radius)
      .attr("fill", "#2dd4bf")
      .attr("stroke", "#0f172a")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("click", (e, d) => {
        setSelectedNode(d);
        e.stopPropagation();
      });

    nodeGroup.append("title")
      .text((d: any) => d.text);
      
    svg.on("click", () => setSelectedNode(null));

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [memories, dimensions]);

  return (
    <div className="relative w-full border border-white/10 rounded-xl overflow-hidden bg-black/60" style={{ minHeight: '500px' }} ref={containerRef}>
      <svg ref={svgRef} width="100%" height="100%" className="absolute inset-0" />
      
      {/* Visual Header */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest font-sans">
          Force-Directed Relationship Graph
        </h3>
        <p className="text-[10px] text-slate-400 font-mono">
          Linked by shared tags
        </p>
      </div>

      {selectedNode && (
        <div className="absolute bottom-4 left-4 max-w-sm p-4 bg-slate-900 border border-teal-500/30 rounded-xl shadow-xl z-10 animate-in slide-in-from-bottom-2">
          <h4 className="text-xs font-bold text-teal-400 font-mono uppercase tracking-widest mb-2">Memory Node</h4>
          <p className="text-sm text-slate-200 mb-3">{selectedNode.text}</p>
          <div className="flex flex-wrap gap-1">
            {selectedNode.tags.map((t: string) => (
              <span key={t} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-slate-400">
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
