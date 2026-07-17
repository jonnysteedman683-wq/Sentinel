import { useEffect, useRef } from 'react';
import { Copy, Flag, Trash2 } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  msgId: string;
  onClose: () => void;
  onCopy: (id: string) => void;
  onFlag: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ContextMenu({ x, y, msgId, onClose, onCopy, onFlag, onDelete }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div 
      ref={menuRef}
      className="fixed z-50 bg-slate-900 border border-slate-700/50 shadow-xl rounded-lg py-1 min-w-[160px] animate-in fade-in slide-in-from-top-2 duration-150"
      style={{ top: Math.min(y, window.innerHeight - 150), left: Math.min(x, window.innerWidth - 200) }}
    >
      <button 
        onClick={() => { onCopy(msgId); onClose(); }}
        className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white flex items-center gap-2"
      >
        <Copy className="w-4 h-4" />
        Copy text
      </button>
      <button 
        onClick={() => { onFlag(msgId); onClose(); }}
        className="w-full text-left px-4 py-2 text-sm text-amber-400 hover:bg-amber-500/10 flex items-center gap-2"
      >
        <Flag className="w-4 h-4" />
        Flag for review
      </button>
      <div className="h-px bg-slate-700/50 my-1"></div>
      <button 
        onClick={() => { onDelete(msgId); onClose(); }}
        className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </div>
  );
}
