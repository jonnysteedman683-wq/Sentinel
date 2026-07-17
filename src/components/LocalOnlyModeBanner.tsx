import React from 'react';
import { WifiOff, Info } from 'lucide-react';

export const LocalOnlyModeBanner: React.FC = () => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-900/90 border-b border-amber-700/50 text-amber-100 px-4 py-2 flex items-center justify-center gap-3 shadow-lg backdrop-blur-sm">
      <WifiOff size={16} className="text-amber-400" />
      <span className="text-xs font-bold tracking-tight">API Services Unreachable: Operating in Local-Only Knowledge Mode</span>
      <div title="AI processing services are currently offline. Local persistence remains active.">
        <Info size={14} className="text-amber-400/70" />
      </div>
    </div>
  );
};
