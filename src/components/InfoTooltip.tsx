import React from 'react';

export const InfoTooltip = ({ label, children }: { label: string | React.ReactNode, children: React.ReactNode }) => (
  <div className="relative group inline-flex items-center">
    <div className="cursor-help">{label}</div>
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 p-2 bg-slate-800 text-[10px] text-slate-300 rounded border border-white/20 z-50 shadow-xl whitespace-normal break-words leading-relaxed pointer-events-none">
      {children}
    </div>
  </div>
);
