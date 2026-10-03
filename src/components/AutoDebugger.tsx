import React from 'react';
import { SystemLog } from '../types.js';
import { Terminal, AlertTriangle, AlertCircle, Info, Cpu, Zap } from 'lucide-react';

interface AutoDebuggerProps {
  logs: SystemLog[];
}

export const AutoDebugger: React.FC<AutoDebuggerProps> = ({ logs }) => {
  const getIcon = (level: SystemLog['level']) => {
    switch (level) {
      case 'ERROR': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'CRITICAL': return <Zap className="w-4 h-4 text-red-600" />;
      case 'WARN': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'NEURAL': return <Cpu className="w-4 h-4 text-teal-400" />;
      default: return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const recentErrors = logs.filter(log => log.level === 'ERROR' || log.level === 'CRITICAL');

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-lg w-full max-w-md">
      <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
        <Terminal className="w-4 h-4 text-teal-400" />
        Auto Debugger
      </h2>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {recentErrors.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No critical errors detected.</p>
        ) : (
          recentErrors.map(log => (
            <div key={log.id} className="flex gap-2 text-xs border-b border-slate-800 pb-1">
              {getIcon(log.level)}
              <span className="text-slate-300 font-mono flex-1">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
