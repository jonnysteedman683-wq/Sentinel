import React, { useState, useEffect, useRef } from 'react';
import { Network, Search, Loader2, Link2, BrainCircuit, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGeminiClient } from './geminiClient';
import { db } from './db';
import { generateEmbedding, rankBySimilarity } from './embeddings';
import * as d3 from 'd3';
import Markdown from 'react-markdown';
import type { SemanticEntry, Episode, AgentProfile } from './types';
import { useLiveQuery } from 'dexie-react-hooks';

export function ContextWeaverPanel() {
  const [query, setQuery] = useState('');
  const [isWeaving, setIsWeaving] = useState(false);
  const [wovenNodes, setWovenNodes] = useState<{ id: string, content: string, type: string, similarity: number }[]>([]);
  const [insight, setInsight] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('default');
  const agents = useLiveQuery(() => db.agents.where('status').equals('active').toArray(), []);
  
  const svgRef = useRef<SVGSVGElement>(null);

  const handleWeave = async () => {
    if (!query.trim()) return;
    setIsWeaving(true);
    setWovenNodes([]);
    setInsight(null);

    try {
      // 1. Generate query embedding
      const queryEmb = await generateEmbedding(query);

      // 2. Fetch all memories
      const allSemantic = await db.semanticEntries.toArray();
      const allEpisodes = await db.episodes.toArray();

      // 3. Rank
      const rankedSemantic = rankBySimilarity(queryEmb, allSemantic, 5);
      const rankedEpisodes = rankBySimilarity(queryEmb, allEpisodes, 5);

      // 4. Combine and format
      const nodes = [
        ...rankedSemantic.map(r => ({ id: r.item.id!, content: r.item.content, type: 'semantic', similarity: r.score })),
        ...rankedEpisodes.map(r => ({ id: r.item.id!, content: r.item.content, type: 'episodic', similarity: r.score }))
      ].sort((a, b) => b.similarity - a.similarity).slice(0, 8); // Top 8 combined

      setWovenNodes(nodes);

      // 5. Generate Insight via Gemini
      if (nodes.length > 0) {
        const ai = getGeminiClient();
        const selectedAgent = agents?.find(a => a.id === selectedAgentId);
        
        let persona = "You are the Context Weaver.";
        let model = 'gemini-2.5-flash';
        
        if (selectedAgent) {
           persona = `You are playing the role of "${selectedAgent.name}". Your core persona is:\n${selectedAgent.systemPrompt}\n\nAdditionally, you act as the Context Weaver.`;
           model = selectedAgent.model || 'gemini-2.5-flash';
        }

        const prompt = `${persona} The user is asking about: "${query}".
        
Here are the most relevant fragmented memories and facts retrieved from the infinite context store:
${nodes.map((n, i) => `[Node ${i + 1} - ${n.type}]: ${n.content}`).join('\n')}

Weave these disparate nodes into a cohesive, highly insightful narrative that directly answers or addresses the user's query. Connect the dots across time and context. Be concise and profound.`;

        const response = await ai.models.generateContent({
          model: model,
          contents: prompt
        });

        setInsight(response.text || 'Synthesis failed to produce insight.');
      } else {
        setInsight('No relevant context found in memory banks to weave.');
      }
    } catch (error) {
      console.error('Weaving failed:', error);
      setInsight('Error connecting to context weaver matrix.');
    } finally {
      setIsWeaving(false);
    }
  };

  useEffect(() => {
    if (!svgRef.current || wovenNodes.length === 0) return;

    // D3 force-directed graph setup
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svg.node()?.getBoundingClientRect().width || 600;
    const height = 300;

    svg.attr('viewBox', [0, 0, width, height]);

    // Create central query node
    const graphNodes = [
      { id: 'query', label: 'QUERY', type: 'query', content: query, similarity: 0 },
      ...wovenNodes.map(n => ({ ...n, label: n.type.toUpperCase() }))
    ];

    // Connect all woven nodes to the query, and maybe to each other based on similarity
    const links: any[] = wovenNodes.map(n => ({ source: 'query', target: n.id, value: n.similarity }));

    const simulation = d3.forceSimulation(graphNodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(30));

    const link = svg.append('g')
      .attr('stroke', '#0ea5e9')
      .attr('stroke-opacity', 0.4)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.max(1, d.value * 3))
      .attr('stroke-dasharray', '5,5');

    const nodeGroup = svg.append('g')
      .selectAll('g')
      .data(graphNodes)
      .join('g')
      .call(drag(simulation) as any);

    nodeGroup.append('circle')
      .attr('r', d => d.type === 'query' ? 16 : 10)
      .attr('fill', d => d.type === 'query' ? '#38bdf8' : d.type === 'semantic' ? '#818cf8' : '#34d399')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2)
      .attr('class', 'shadow-xl');

    nodeGroup.append('text')
      .text(d => d.type === 'query' ? 'Q' : d.similarity ? Math.round(d.similarity * 100) + '%' : '')
      .attr('text-anchor', 'middle')
      .attr('dy', '.3em')
      .attr('fill', '#0f172a')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold');
    
    // Add pulsing effect for query
    svg.selectAll('circle').filter((d: any) => d.type === 'query')
      .append('animate')
      .attr('attributeName', 'r')
      .attr('values', '16;20;16')
      .attr('dur', '2s')
      .attr('repeatCount', 'indefinite');

    nodeGroup.append('title')
      .text(d => d.content);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeGroup.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
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
  }, [wovenNodes]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 via-slate-950 to-slate-950 pointer-events-none z-0"></div>
      
      <div className="p-4 md:p-6 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur flex justify-between items-center z-10 shadow-sm relative">
        <div className="flex items-center gap-3 text-cyan-400 font-bold tracking-[0.2em] uppercase">
          <div className="p-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
            <Network size={18} />
          </div>
          <span className="font-display text-lg">Context Weaver</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10 flex flex-col">
        <div className="max-w-5xl mx-auto w-full flex flex-col gap-8 h-full">
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl shrink-0"
          >
            <h3 className="text-xs font-bold text-slate-400 mb-4 tracking-widest uppercase flex items-center justify-between">
              <span className="flex items-center gap-2"><Search size={14} className="text-cyan-400" /> Infinite Context Retrieval</span>
              <div className="flex items-center gap-2">
                 <span className="text-[10px] text-slate-500">SYNTHESIS AGENT:</span>
                 <select 
                   value={selectedAgentId}
                   onChange={e => setSelectedAgentId(e.target.value)}
                   className="bg-slate-950 border border-slate-800 rounded p-1 text-xs text-cyan-400 focus:outline-none"
                   disabled={isWeaving}
                 >
                   <option value="default">Core System (Default)</option>
                   {agents?.map(a => (
                     <option key={a.id} value={a.id}>{a.name}</option>
                   ))}
                 </select>
              </div>
            </h3>
            <div className="flex gap-4">
              <input 
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleWeave()}
                placeholder="e.g. What were we discussing about memory limits last week?"
                className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 shadow-inner transition-all"
                disabled={isWeaving}
              />
              <button 
                onClick={handleWeave}
                disabled={isWeaving || !query.trim()}
                className="bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-900/80 text-cyan-400 px-8 py-3 rounded-xl font-bold tracking-widest text-xs shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isWeaving ? <><Loader2 size={16} className="animate-spin" /> WEAVING...</> : 'WEAVE CONTEXT'}
              </button>
            </div>
          </motion.div>

          {wovenNodes.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-inner flex flex-col"
              >
                <h3 className="text-xs font-bold text-slate-400 mb-4 tracking-widest uppercase flex items-center gap-2">
                  <Link2 size={14} className="text-cyan-500" /> Relational Memory Graph
                </h3>
                <div className="flex-1 bg-slate-950/80 rounded-xl border border-slate-800 overflow-hidden relative min-h-[300px]">
                  <svg ref={svgRef} className="w-full h-full"></svg>
                  <div className="absolute bottom-4 right-4 flex gap-4 text-[10px] font-bold tracking-widest">
                    <div className="flex items-center gap-2 text-indigo-400"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> SEMANTIC</div>
                    <div className="flex items-center gap-2 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> EPISODIC</div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-inner flex flex-col overflow-y-auto"
              >
                <h3 className="text-xs font-bold text-slate-400 mb-6 tracking-widest uppercase flex items-center gap-2">
                  <BrainCircuit size={14} className="text-cyan-400" /> Woven Synthesis
                </h3>
                {insight ? (
                  <div className="prose prose-invert prose-cyan max-w-none text-slate-300">
                    <Markdown>{insight}</Markdown>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-cyan-500/50 gap-4">
                    <Sparkles size={32} className="animate-pulse" />
                    <span className="text-xs font-bold tracking-widest uppercase">Synthesizing Narrative...</span>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {!wovenNodes.length && !isWeaving && (
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 pointer-events-none">
              <Network size={64} className="mb-4" />
              <div className="text-sm font-bold tracking-[0.2em] uppercase">Context Awaiting Query</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
