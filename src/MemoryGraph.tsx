import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { cosineSimilarity } from './embeddings';
import type { Episode, SemanticEntry } from './types';

interface MemoryGraphProps {
  episodes: Episode[];
  semanticEntries: SemanticEntry[];
}

export function MemoryGraph({ episodes, semanticEntries }: MemoryGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || (episodes.length === 0 && semanticEntries.length === 0)) return;
    
    // Process nodes
    const nodes = [
      ...episodes.map(e => ({ id: e.id!, group: 'episodic' as const, label: e.type.toUpperCase(), embedding: e.embedding, data: e })),
      ...semanticEntries.map(s => ({ id: s.id!, group: 'semantic' as const, label: 'FACT', embedding: s.embedding, data: s }))
    ];

    // Compute edges based on cosine similarity
    const links: { source: string; target: string; value: number }[] = [];
    const threshold = 0.5; // Similarity threshold

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].embedding && nodes[j].embedding) {
          const sim = cosineSimilarity(nodes[i].embedding!, nodes[j].embedding!);
          if (sim > threshold) {
            links.push({ source: nodes[i].id, target: nodes[j].id, value: sim });
          }
        }
      }
    }

    // D3 setup
    const width = 600;
    const height = 400;

    const svg = d3.select(svgRef.current)
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [0, 0, width, height]);
      
    svg.selectAll('*').remove();

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(20));

    const link = svg.append('g')
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.max(0.5, d.value * 3));

    const node = svg.append('g')
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => d.group === 'semantic' ? 10 : 6)
      .attr('fill', d => d.group === 'semantic' ? '#3b82f6' : (d.data as any).type === 'user' ? '#818cf8' : '#34d399')
      .call(drag(simulation) as any);

    node.append('title')
      .text(d => d.group === 'semantic' ? (d.data as SemanticEntry).content : (d.data as Episode).content);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
    });

    function drag(simulation: d3.Simulation<any, any>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [episodes, semanticEntries]);

  return (
    <div className="w-full h-64 bg-slate-900/50 border border-slate-800 rounded mb-4 overflow-hidden">
      {episodes.length === 0 && semanticEntries.length === 0 ? (
        <div className="flex items-center justify-center h-full text-slate-500 text-xs">
          NO DATA FOR GRAPH
        </div>
      ) : (
        <svg ref={svgRef}></svg>
      )}
    </div>
  );
}
