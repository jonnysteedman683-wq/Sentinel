import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as d3 from 'd3';
import type { Episode, SemanticEntry } from './types';

interface CognitiveHeatmapProps {
  episodes: Episode[];
  semanticEntries: SemanticEntry[];
}

export function CognitiveHeatmap({ episodes, semanticEntries }: CognitiveHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const data = useMemo(() => {
    const tagStats: Record<string, { count: number, lastAccessed: number }> = {};

    episodes.forEach(e => {
      e.tags.forEach(t => {
        const tag = t.toLowerCase().trim();
        if (!tag) return;
        if (!tagStats[tag]) tagStats[tag] = { count: 0, lastAccessed: 0 };
        tagStats[tag].count += 1;
        tagStats[tag].lastAccessed = Math.max(tagStats[tag].lastAccessed, e.timestamp);
      });
    });

    semanticEntries.forEach(s => {
      s.tags.forEach(t => {
        const tag = t.toLowerCase().trim();
        if (!tag) return;
        if (!tagStats[tag]) tagStats[tag] = { count: 0, lastAccessed: 0 };
        tagStats[tag].count += (s.retrievalCount || 1) * 2; // Semantic retrievals weighed more
        tagStats[tag].lastAccessed = Math.max(tagStats[tag].lastAccessed, s.timestamp);
      });
    });

    const children = Object.entries(tagStats)
      .map(([name, stats]) => ({
        name,
        value: stats.count,
        lastAccessed: stats.lastAccessed
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 60); // top 60 topics

    return { name: 'root', children };
  }, [episodes, semanticEntries]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current || data.children.length === 0 || dimensions.width === 0 || dimensions.height === 0) return;

    const width = dimensions.width;
    const height = dimensions.height;

    // Clear previous
    d3.select(containerRef.current).selectAll('svg').remove();

    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('font-family', 'monospace');

    const root = d3.hierarchy(data)
      .sum((d: any) => d.value)
      .sort((a: any, b: any) => b.value - a.value);

    d3.treemap()
      .size([width, height])
      .padding(2)
      .round(true)(root);

    const maxVal = d3.max(data.children, d => d.value) || 1;
    // We want a nice heatmap color scale from cool to hot. Let's use d3.interpolateYlOrRd
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxVal]);

    const leaf = svg.selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

    leaf.append('rect')
      .attr('width', (d: any) => Math.max(0, d.x1 - d.x0))
      .attr('height', (d: any) => Math.max(0, d.y1 - d.y0))
      .attr('fill', (d: any) => colorScale(d.data.value))
      .attr('opacity', 0.9)
      .attr('rx', 4)
      .attr('ry', 4)
      .on('mouseover', function() {
        d3.select(this).attr('opacity', 1).attr('stroke', '#fff').attr('stroke-width', 2);
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 0.9).attr('stroke', 'none');
      });

    leaf.append('text')
      .attr('x', 4)
      .attr('y', 14)
      .attr('fill', (d: any) => d.data.value > maxVal * 0.4 ? '#000' : '#fff')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const text = (d.data as any).name;
        const width = d.x1 - d.x0;
        return width > text.length * 6 + 8 ? text.toUpperCase() : '';
      });

    leaf.append('text')
      .attr('x', 4)
      .attr('y', 26)
      .attr('fill', (d: any) => d.data.value > maxVal * 0.4 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)')
      .attr('font-size', '9px')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const val = (d.data as any).value;
        const width = d.x1 - d.x0;
        const height = d.y1 - d.y0;
        return width > 20 && height > 30 ? `Hits: ${val}` : '';
      });

    leaf.append('title')
      .text((d: any) => `${((d.data as any).name).toUpperCase()}\nHeat (Accesses): ${(d.data as any).value}\nLast Accessed: ${new Date((d.data as any).lastAccessed).toLocaleString()}`);

  }, [data, dimensions]);

  return (
    <div className="flex flex-col h-full bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden shadow-inner w-full min-h-[400px]">
      <div className="text-xs font-bold tracking-widest text-slate-500 p-3 border-b border-slate-800 flex justify-between items-center bg-slate-950/80 shrink-0">
        <span className="flex items-center gap-2 text-orange-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
          COGNITIVE HEATMAP
        </span>
        <div className="flex items-center gap-2">
           <span className="text-[9px] text-slate-500">COLD</span>
           <div className="w-16 h-2 rounded bg-gradient-to-r from-[#ffffcc] via-[#fd8d3c] to-[#800026]"></div>
           <span className="text-[9px] text-orange-500">HOT</span>
        </div>
      </div>
      <div className="flex-1 w-full relative p-2" ref={containerRef}>
        {data.children.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs tracking-widest">
            NO TOPIC DATA TO VISUALIZE
          </div>
        )}
      </div>
    </div>
  );
}
