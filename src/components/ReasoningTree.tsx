import React, { useState } from 'react';
import { Network, Zap, Cpu } from 'lucide-react';

interface ReasoningTreeProps {
  branches: { name: string; text: string }[];
  synthesis: string;
}

export function ReasoningTree({ branches = [], synthesis }: ReasoningTreeProps) {
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);

  // Define nodes coordinates
  const leftNode = { x: 50, y: 100, label: "User Query", type: "query" };
  const rightNode = { x: 550, y: 100, label: "Cognitive Synthesis", type: "synthesis" };

  const midNodes = branches.map((b, i) => {
    const spacing = 70;
    const startY = 100 - ((branches.length - 1) * spacing) / 2;
    return {
      x: 300,
      y: startY + i * spacing,
      label: b.name,
      text: b.text,
      index: i
    };
  });

  return (
    <div className="flex flex-col bg-slate-950/45 border border-fuchsia-500/20 rounded-2xl p-6 gap-6 my-4 w-full">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-fuchsia-400 animate-pulse" />
          <h4 className="text-xs uppercase tracking-widest font-bold text-fuchsia-400 font-mono">
            Fractal Core: Tree-of-Thoughts
          </h4>
        </div>
        <span className="text-[10px] text-slate-500 uppercase font-mono">
          Hover nodes to trace hypotheses
        </span>
      </div>

      {/* SVG Tree Graph */}
      <div className="relative w-full overflow-x-auto flex justify-center bg-black/20 rounded-xl py-4 border border-white/5">
        <svg width="600" height="200" className="overflow-visible select-none max-w-full">
          {/* Paths connecting left to middle */}
          {midNodes.map((node) => (
            <path
              key={`left-to-${node.index}`}
              d={`M ${leftNode.x} ${leftNode.y} C ${(leftNode.x + node.x) / 2} ${leftNode.y}, ${(leftNode.x + node.x) / 2} ${node.y}, ${node.x} ${node.y}`}
              fill="none"
              stroke={selectedBranch === node.index ? "url(#teal-glow)" : "rgba(217, 70, 239, 0.25)"}
              strokeWidth={selectedBranch === node.index ? 3 : 1.5}
              className="transition-all duration-300"
            />
          ))}

          {/* Paths connecting middle to right */}
          {midNodes.map((node) => (
            <path
              key={`mid-to-${node.index}`}
              d={`M ${node.x} ${node.y} C ${(node.x + rightNode.x) / 2} ${node.y}, ${(node.x + rightNode.x) / 2} ${rightNode.y}, ${rightNode.x} ${rightNode.y}`}
              fill="none"
              stroke={selectedBranch === node.index ? "url(#teal-glow)" : "rgba(217, 70, 239, 0.25)"}
              strokeWidth={selectedBranch === node.index ? 3 : 1.5}
              className="transition-all duration-300"
            />
          ))}

          {/* Definitions for glowing gradients */}
          <defs>
            <linearGradient id="teal-glow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d946ef" />
              <stop offset="100%" stopColor="#2dd4bf" />
            </linearGradient>
          </defs>

          {/* Left Node */}
          <g transform={`translate(${leftNode.x}, ${leftNode.y})`}>
            <circle r="14" fill="#0f172a" stroke="#d946ef" strokeWidth="2" />
            <circle r="6" fill="#d946ef" className="animate-ping opacity-75" />
            <circle r="4" fill="#d946ef" />
            <text y="-20" textAnchor="middle" fill="#94a3b8" fontSize="10" className="font-semibold uppercase tracking-wider">
              {leftNode.label}
            </text>
          </g>

          {/* Middle Nodes */}
          {midNodes.map((node) => (
            <g
              key={node.index}
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer group"
              onMouseEnter={() => setSelectedBranch(node.index)}
              onMouseLeave={() => setSelectedBranch(null)}
            >
              <circle
                r="12"
                fill="#0f172a"
                stroke={selectedBranch === node.index ? "#2dd4bf" : "#d946ef"}
                strokeWidth="2"
                className="transition-all duration-300 group-hover:scale-110"
              />
              <text y="5" textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="bold">
                {node.index + 1}
              </text>
              <text y="-18" textAnchor="middle" fill={selectedBranch === node.index ? "#2dd4bf" : "#94a3b8"} fontSize="9" className="font-semibold transition-colors duration-300">
                {node.label}
              </text>
            </g>
          ))}

          {/* Right Node */}
          <g transform={`translate(${rightNode.x}, ${rightNode.y})`}>
            <circle r="14" fill="#0f172a" stroke="#2dd4bf" strokeWidth="2" />
            <circle r="4" fill="#2dd4bf" />
            <text y="-20" textAnchor="middle" fill="#2dd4bf" fontSize="10" className="font-semibold uppercase tracking-wider">
              {rightNode.label}
            </text>
          </g>
        </svg>
      </div>

      {/* Rationale and Details box */}
      <div className="bg-black/40 border border-white/10 rounded-xl p-4 h-24 overflow-y-auto flex items-center justify-center transition-all duration-300">
        {selectedBranch !== null ? (
          <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-200">
            <h5 className="text-xs font-bold text-teal-400 mb-1 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" /> {branches[selectedBranch].name} Approach
            </h5>
            <p className="text-xs text-slate-300 leading-relaxed">
              {branches[selectedBranch].text}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-500">
            <Zap className="w-4 h-4" />
            <span className="text-[11px] font-medium uppercase tracking-wider">Hover timeline nodes to unpack cognitive threads</span>
          </div>
        )}
      </div>
    </div>
  );
}
