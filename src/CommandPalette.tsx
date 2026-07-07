import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronRight, CornerDownLeft } from 'lucide-react';

interface Action {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  section: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: Action[];
}

export function CommandPalette({ isOpen, onClose, actions }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredActions = actions.filter(action =>
    action.title.toLowerCase().includes(search.toLowerCase()) ||
    (action.subtitle && action.subtitle.toLowerCase().includes(search.toLowerCase())) ||
    action.section.toLowerCase().includes(search.toLowerCase())
  );

  // Group by section
  const sections: { [key: string]: Action[] } = {};
  filteredActions.forEach(action => {
    if (!sections[action.section]) {
      sections[action.section] = [];
    }
    sections[action.section].push(action);
  });

  const flattenedActions = Object.values(sections).flat();

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev + 1) % Math.max(1, flattenedActions.length));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev - 1 + Math.max(1, flattenedActions.length)) % Math.max(1, flattenedActions.length));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (flattenedActions[selectedIndex]) {
          flattenedActions[selectedIndex].onSelect();
          onClose();
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flattenedActions, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center pt-32"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center px-4 border-b border-slate-800">
                <Search size={20} className="text-slate-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Type a command or search..."
                  className="w-full bg-transparent border-none text-slate-200 placeholder-slate-500 p-4 focus:outline-none focus:ring-0 text-lg"
                />
                <div className="hidden sm:flex items-center gap-1 shrink-0 text-xs font-mono text-slate-500 bg-slate-800 px-2 py-1 rounded">
                  <span>esc</span>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto p-2">
                {Object.entries(sections).map(([sectionName, sectionActions]) => (
                  <div key={sectionName} className="mb-2">
                    <div className="text-xs font-bold tracking-widest text-slate-500 px-3 py-2 uppercase">
                      {sectionName}
                    </div>
                    {sectionActions.map((action) => {
                      const globalIndex = flattenedActions.indexOf(action);
                      const isSelected = globalIndex === selectedIndex;
                      
                      return (
                        <div
                          key={action.id}
                          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                          }`}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          onClick={() => {
                            action.onSelect();
                            onClose();
                          }}
                        >
                          <div className="flex items-center gap-3">
                            {action.icon && <div className={`${isSelected ? 'text-emerald-400' : 'text-slate-500'}`}>{action.icon}</div>}
                            <div className="flex flex-col">
                              <span className="font-medium">{action.title}</span>
                              {action.subtitle && <span className="text-xs opacity-60">{action.subtitle}</span>}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-1 text-xs font-mono text-emerald-400/80 bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/50">
                              <CornerDownLeft size={12} /> ENTER
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                
                {flattenedActions.length === 0 && (
                  <div className="py-12 text-center text-slate-500 font-mono text-sm">
                    No matching commands found.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
