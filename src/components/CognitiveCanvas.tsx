import React, { useMemo, useEffect, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  Node,
  Edge,
  MarkerType
} from 'reactflow';

const ReactFlowComponent = ReactFlow as any;
const BackgroundComponent = Background as any;
import 'reactflow/dist/style.css';
import { Brain, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

interface CognitiveCanvasProps {
  messages: ChatMessage[];
}

// Custom Node component for User Messages
const UserNode = ({ data }: any) => (
  <div className="px-4 py-3 rounded-xl border border-cyan-500/50 bg-cyan-950/80 backdrop-blur-md shadow-lg shadow-cyan-500/5 max-w-sm font-sans text-slate-200">
    <div className="flex items-center gap-2 mb-2 opacity-80">
      <User className="w-4 h-4 text-cyan-400" />
      <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">User Query</span>
    </div>
    <p className="text-sm font-light leading-relaxed">{data.label}</p>
  </div>
);

// Custom Node component for AI Thoughts
const AiNode = ({ data }: any) => (
  <div className="px-4 py-3 rounded-xl border border-indigo-500/50 bg-indigo-950/80 backdrop-blur-md shadow-lg shadow-indigo-500/5 max-w-md font-sans text-slate-200">
    <div className="flex items-center gap-2 mb-2 opacity-80">
      <Brain className="w-4 h-4 text-indigo-400" />
      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Cognitive Synthesis</span>
    </div>
    <div className="text-sm font-light leading-relaxed prose prose-invert prose-xs max-w-none">
      <ReactMarkdown>{data.label}</ReactMarkdown>
    </div>
  </div>
);

const nodeTypes = {
  userNode: UserNode,
  aiNode: AiNode,
};

export default function CognitiveCanvas({ messages }: CognitiveCanvasProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    messages.forEach((msg, idx) => {
      const isUser = msg.role === 'user';
      const nodeId = msg.id || `msg_${idx}`;
      
      // Compute layout position (horizontal steps, alternating height slightly)
      const x = idx * 300 + 50;
      const y = isUser ? 100 : 250;

      newNodes.push({
        id: nodeId,
        type: isUser ? 'userNode' : 'aiNode',
        position: { x, y },
        data: { label: msg.content }
      });

      // Connect each message to the next chronological one
      if (idx > 0) {
        const prevNodeId = messages[idx - 1].id || `msg_${idx - 1}`;
        newEdges.push({
          id: `e_${prevNodeId}_${nodeId}`,
          source: prevNodeId,
          target: nodeId,
          animated: true,
          style: { stroke: isUser ? '#22d3ee' : '#818cf8', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isUser ? '#22d3ee' : '#818cf8'
          }
        });
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [messages]);

  return (
    <div className="w-full h-full bg-slate-950/95 relative border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      <div className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2 pointer-events-none backdrop-blur-md shadow-lg">
        <h3 className="text-sm font-medium text-white flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400 animate-pulse" />
          Infinite Cognitive Workspace
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">Drag nodes to reorganize your thought architecture.</p>
      </div>

      <ReactFlowComponent
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        className="text-slate-200"
      >
        <BackgroundComponent color="#ffffff" gap={16} size={1} style={{ opacity: 0.03 }} />
        <Controls className="bg-slate-900/80 border border-white/10 text-white rounded-lg p-1 fill-white [&_button]:border-none [&_button]:bg-transparent [&_button:hover]:bg-white/5" />
        <MiniMap 
          nodeColor={(node) => node.type === 'userNode' ? 'rgba(34, 211, 238, 0.2)' : 'rgba(129, 140, 248, 0.2)'}
          maskColor="rgba(2, 6, 23, 0.7)"
          className="border border-white/10 bg-slate-900/90 rounded-lg overflow-hidden"
        />
      </ReactFlowComponent>
    </div>
  );
}
