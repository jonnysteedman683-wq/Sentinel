import React from 'react';
import { 
  Brain, Search, CheckSquare, 
  Square, Trash2, Zap, Pin, Lightbulb, Loader2, ChevronDown, Plus 
} from 'lucide-react';
import { MemoryChart } from '../MemoryChart.js';
import { MemoryForceGraph } from '../MemoryForceGraph.js';
import { MemoryGraph3D } from '../MemoryGraph3D.js';
import { formatTimeAgo } from '../../lib/utils.js';
import { Memory } from '../../App.js';

export interface MemoryTabProps {

  setModelState: React.Dispatch<React.SetStateAction<any>>;
  fetchInsight: () => Promise<any>;
  setActiveInsight: React.Dispatch<React.SetStateAction<any>>;
  startDateFilter: string;
  setStartDateFilter: (val: string) => void;
  endDateFilter: string;
  setEndDateFilter: (val: string) => void;
  handleAddMemory: (e: React.FormEvent) => void;
  newMemory: string;
  setNewMemory: (val: string) => void;

  memoryViewMode: 'list' | 'timeline' | 'graph' | '3d';
  setMemoryViewMode: (mode: 'list' | 'timeline' | 'graph' | '3d') => void;
  isConsolidating: boolean;
  memories: Memory[];
  handleManualConsolidate: () => void;
  memorySearchQuery: string;
  setMemorySearchQuery: (q: string) => void;
  selectedMemoryIds: string[];
  handleSelectAllMemories: () => void;
  handleClearMemorySelection: () => void;
  handleBulkDelete: () => void;
  isBulkDeleting: boolean;
  handleBulkUpdateStrength: (val: number) => void;
  isBulkReinforcing: boolean;
  isBulkDecaying: boolean;
  isBulkTagging: boolean;
  bulkTagInput: string;
  setBulkTagInput: (val: string) => void;
  handleBulkTag: () => void;
  selectedTagFilter: string | null;
  setSelectedTagFilter: (val: string | null) => void;
    filteredMemories: Memory[];
  handleSingleUpdateStrength: (id: string, val: number) => void;
  togglePinMemory: (id: string) => void;
  removeMemory: (id: string) => void;
    setSelectedMemoryIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export const MemoryTab: React.FC<MemoryTabProps> = (props) => {
  const {

    setModelState, fetchInsight, setActiveInsight, startDateFilter, setStartDateFilter,
    endDateFilter, setEndDateFilter, handleAddMemory, newMemory, setNewMemory,

    memoryViewMode, setMemoryViewMode, isConsolidating, memories,
    handleManualConsolidate, memorySearchQuery, setMemorySearchQuery,
    selectedMemoryIds, handleSelectAllMemories, handleClearMemorySelection,
    handleBulkDelete, isBulkDeleting, handleBulkUpdateStrength,
    isBulkReinforcing, isBulkDecaying, isBulkTagging,
    bulkTagInput, setBulkTagInput, handleBulkTag,
    selectedTagFilter, setSelectedTagFilter,
    filteredMemories, handleSingleUpdateStrength, togglePinMemory,
    removeMemory,  setSelectedMemoryIds
  } = props;

  return (
    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                    <button 
                      onClick={() => setMemoryViewMode('list')}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                        memoryViewMode === 'list' ? 'bg-teal-500 text-white' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Registry
                    </button>
                    <button 
                      onClick={() => setMemoryViewMode('timeline')}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                        memoryViewMode === 'timeline' ? 'bg-teal-500 text-white' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Chronology
                    </button>
                    <button 
                      onClick={() => setMemoryViewMode('graph')}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                        memoryViewMode === 'graph' ? 'bg-teal-500 text-white' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Force Graph
                    </button>
                    <button
                      onClick={() => setMemoryViewMode('3d')}
                      className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${
                        memoryViewMode === '3d' ? 'bg-teal-500 text-white' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      3D Graph
                    </button>
                  </div>
                  <button
                    onClick={handleManualConsolidate}
                    disabled={isConsolidating || memories.length === 0}
                    className="flex items-center gap-1.5 bg-teal-500/10 hover:bg-teal-500/25 border border-teal-500/20 text-teal-400 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-all disabled:opacity-40"
                    title="Consolidate and cluster current memory space using AI"
                  >
                    <Brain className={`w-3.5 h-3.5 ${isConsolidating ? 'animate-spin' : ''}`} />
                    <span>Synthesize</span>
                  </button>
                  <button
                    onClick={async () => {
                      setModelState('Inspired');
                      const insight = await fetchInsight();
                      if (insight) setActiveInsight(insight);
                      else setModelState('Idle');
                    }}
                    className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider transition-all"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Deep Dive</span>
                  </button>
                </div>

                {isConsolidating && (
                  <div className="mb-4 text-xs text-teal-400/80 font-mono flex items-center gap-2 bg-teal-500/10 p-2 rounded-lg border border-teal-500/20">
                    <Brain className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} /> Consolidating core memory...
                  </div>
                )}

                {memoryViewMode === 'list' ? (
                  <>
                    <MemoryChart memories={memories} />
                    <div className="mb-4 relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={memorySearchQuery}
                        onChange={(e) => setMemorySearchQuery(e.target.value)}
                        placeholder="Search memories..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all placeholder:text-slate-600"
                      />
                    </div>
                    
                    <div className="flex gap-2 mb-4">
                      <input
                        type="date"
                        value={startDateFilter}
                        onChange={(e) => setStartDateFilter(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-slate-300 focus:outline-none focus:border-teal-500/50 flex-1"
                      />
                      <input
                        type="date"
                        value={endDateFilter}
                        onChange={(e) => setEndDateFilter(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-slate-300 focus:outline-none focus:border-teal-500/50 flex-1"
                      />
                      <button
                        onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                        className="bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-slate-400 hover:text-white hover:bg-white/10"
                      >
                        Clear
                      </button>
                    </div>

                    {/* Interactive Tag Cloud */}
                    {(() => {
                      const allMemoryTags = Array.from(new Set(memories.flatMap(m => m.tags || []))).filter(Boolean).sort();
                      if (allMemoryTags.length === 0) return null;
                      return (
                        <div className="mb-4 bg-white/5 border border-white/5 p-3 rounded-lg">
                          <div className="text-[9px] uppercase font-mono tracking-widest text-slate-500 mb-1.5 flex items-center justify-between">
                            <span>Filter by Tag</span>
                            {selectedTagFilter && (
                              <button 
                                onClick={() => setSelectedTagFilter(null)} 
                                className="text-teal-400 hover:text-teal-300"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                            <button
                              onClick={() => setSelectedTagFilter(null)}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                                !selectedTagFilter 
                                  ? 'bg-teal-500 text-teal-950 font-bold' 
                                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                              }`}
                            >
                              All
                            </button>
                            {allMemoryTags.map(tag => (
                              <button
                                key={tag}
                                onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all flex items-center gap-1 ${
                                  selectedTagFilter === tag 
                                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' 
                                    : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10 hover:text-slate-200'
                                }`}
                              >
                                <span>{tag}</span>
                                {selectedTagFilter === tag && <span className="text-[9px] opacity-75">✕</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Bulk Selection and Action Controls */}
                    {filteredMemories.length > 0 && (
                      <div className="mb-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleSelectAllMemories}
                              className="hover:text-teal-400 transition-colors"
                            >
                              Select All ({filteredMemories.length})
                            </button>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={handleClearMemorySelection}
                              disabled={selectedMemoryIds.length === 0}
                              className="hover:text-teal-400 transition-colors disabled:opacity-40 disabled:hover:text-slate-400"
                            >
                              Clear Selection
                            </button>
                          </div>
                          <span className="font-mono text-[10px] text-teal-400/80">
                            {selectedMemoryIds.length} Selected
                          </span>
                        </div>

                        {selectedMemoryIds.length > 0 && (
                          <div className="bg-teal-950/40 border border-teal-500/20 p-3 rounded-lg flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-teal-400 font-bold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                                Bulk Operations
                              </span>
                              <button 
                                type="button"
                                onClick={handleClearMemorySelection}
                                className="text-[10px] uppercase tracking-widest text-slate-400 hover:text-white transition-all"
                              >
                                Cancel
                              </button>
                            </div>

                            <div className="flex gap-2">
                              <input 
                                type="text"
                                placeholder="Common tag (e.g. Core)..."
                                value={bulkTagInput}
                                onChange={(e) => setBulkTagInput(e.target.value)}
                                className="flex-1 bg-black/50 border border-white/10 rounded-md py-1.5 px-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
                                disabled={isBulkTagging}
                              />
                              <button 
                                type="button"
                                onClick={handleBulkTag}
                                disabled={!bulkTagInput.trim() || isBulkTagging}
                                className="bg-teal-500 hover:bg-teal-400 text-teal-950 font-bold px-3 py-1.5 rounded-md text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isBulkTagging ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Applying...</span>
                                  </>
                                ) : (
                                  'Apply Tag'
                                )}
                              </button>
                            </div>

                            <div className="flex items-center justify-between border-t border-white/5 pt-2">
                              <span className="text-[9px] text-slate-500 italic font-mono uppercase tracking-wider">Strength Tuning</span>
                              <div className="flex gap-1.5">
                                <button 
                                  type="button"
                                  onClick={() => handleBulkUpdateStrength(100)}
                                  disabled={isBulkReinforcing}
                                  className="text-[10px] font-bold text-teal-400/80 hover:text-teal-300 hover:bg-teal-500/10 px-2 py-1 rounded border border-teal-500/10 transition-colors flex items-center gap-1"
                                  title="Restore strength to 100%"
                                >
                                  {isBulkReinforcing ? 'Boosting...' : (
                                    <>
                                      <Zap className="w-3 h-3 text-teal-400" />
                                      <span>Reinforce</span>
                                    </>
                                  )}
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => handleBulkUpdateStrength(20)}
                                  disabled={isBulkDecaying}
                                  className="text-[10px] font-bold text-slate-400 hover:text-slate-300 hover:bg-white/5 px-2 py-1 rounded border border-white/5 transition-colors flex items-center gap-1"
                                  title="Reduce strength to 20%"
                                >
                                  {isBulkDecaying ? 'Fading...' : (
                                    <>
                                      <ChevronDown className="w-3 h-3 text-slate-400" />
                                      <span>Decay</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-white/5 pt-2">
                              <span className="text-[9px] text-slate-500 italic">Apply to all selected memories</span>
                              <button 
                                type="button"
                                onClick={handleBulkDelete}
                                disabled={isBulkDeleting}
                                className="text-[10px] font-bold text-red-400/80 hover:text-red-400 hover:bg-red-500/10 px-2 py-0.5 rounded transition-colors"
                              >
                                {isBulkDeleting ? 'Purging...' : 'Delete Selected'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-3 mb-6">
                      {filteredMemories.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm italic">
                          {memories.length === 0 ? 'Core memory empty.' : 'No matching memories.'}
                        </div>
                      ) : (
                        filteredMemories.map(mem => {
                          const isSelected = selectedMemoryIds.includes(mem.id);
                          return (
                            <div 
                              key={mem.id} 
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedMemoryIds(prev => prev.filter(id => id !== mem.id));
                                } else {
                                  setSelectedMemoryIds(prev => [...prev, mem.id]);
                                }
                              }}
                              className={`group relative border p-3 rounded-lg hover:bg-white/10 transition-all text-sm flex gap-3 cursor-pointer select-none ${
                                isSelected 
                                  ? 'bg-teal-500/10 border-teal-500/40 shadow-sm shadow-teal-500/5' 
                                  : 'bg-white/5 border-white/10'
                              }`}
                            >
                              {/* Selection Indicator */}
                              <div className="flex-shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedMemoryIds(prev => prev.filter(id => id !== mem.id));
                                    } else {
                                      setSelectedMemoryIds(prev => [...prev, mem.id]);
                                    }
                                  }}
                                  className={`p-0.5 rounded hover:bg-white/10 transition-colors ${
                                    isSelected ? 'text-teal-400' : 'text-slate-500'
                                  }`}
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4" />
                                  ) : (
                                    <Square className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                                  )}
                                </button>
                              </div>

                              <div className="flex-1 flex flex-col gap-2">
                                <p className="pr-6 text-slate-300 leading-relaxed">{mem.text}</p>
                                
                                {mem.tags && mem.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {mem.tags.map((tag, i) => (
                                      <span 
                                        key={i} 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTagFilter(selectedTagFilter === tag ? null : tag);
                                        }}
                                        className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                          selectedTagFilter === tag 
                                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' 
                                            : 'bg-white/10 text-slate-400 border-white/5 hover:bg-white/20 hover:text-slate-200'
                                        }`}
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <div className="flex items-center justify-between mt-1">
                                  <span className="text-[10px] text-slate-500 font-mono">{formatTimeAgo(mem.timestamp)}</span>
                                  <div className="flex items-center gap-2" title={`Memory Strength: ${mem.strength}%`}>
                                    <div className="flex gap-0.5">
                                      {[1, 2, 3, 4, 5].map(i => (
                                        <div 
                                          key={i} 
                                          className={`w-1 h-2 rounded-sm ${i * 20 <= mem.strength ? 'bg-teal-500/80' : 'bg-white/10'}`}
                                        />
                                      ))}
                                    </div>
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => handleSingleUpdateStrength(mem.id, 100)}
                                        className={`p-0.5 rounded hover:bg-teal-500/15 transition-all ${mem.strength >= 100 ? 'text-teal-500 opacity-40' : 'text-slate-500 hover:text-teal-400'}`}
                                        title="Reinforce to 100%"
                                      >
                                        <Zap className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSingleUpdateStrength(mem.id, 20)}
                                        className={`p-0.5 rounded hover:bg-white/10 transition-all ${mem.strength <= 20 ? 'text-slate-400 opacity-40' : 'text-slate-500 hover:text-slate-300'}`}
                                        title="Decay to 20%"
                                      >
                                        <ChevronDown className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Operations Menu */}
                              <div className="absolute top-2 right-2 flex gap-1 transition-all" onClick={e => e.stopPropagation()}>
                                <button 
                                  type="button"
                                  onClick={() => togglePinMemory(mem.id)}
                                  className={`p-1.5 rounded transition-all ${mem.pinned ? 'text-teal-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-100 hover:text-teal-400 hover:bg-white/5'}`}
                                  title={mem.pinned ? 'Unpin Memory' : 'Pin Memory'}
                                >
                                  <Pin className={`w-3.5 h-3.5 ${mem.pinned ? 'fill-current' : ''}`} />
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => removeMemory(mem.id)}
                                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 hover:bg-white/5 transition-all"
                                  title="Delete Memory"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : memoryViewMode === 'timeline' ? (
                  <div className="space-y-6 mb-6 pl-4 border-l border-white/10">
                    {/* Selection Controls also in timeline view */}
                    {filteredMemories.length > 0 && (
                      <div className="mb-4 flex flex-col gap-2 -ml-4 pr-1">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleSelectAllMemories}
                              className="hover:text-teal-400 transition-colors"
                            >
                              Select All ({filteredMemories.length})
                            </button>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={handleClearMemorySelection}
                              disabled={selectedMemoryIds.length === 0}
                              className="hover:text-teal-400 transition-colors disabled:opacity-40 disabled:hover:text-slate-400"
                            >
                              Clear
                            </button>
                          </div>
                          <span className="font-mono text-[10px] text-teal-400/80">
                            {selectedMemoryIds.length} Selected
                          </span>
                        </div>

                        {selectedMemoryIds.length > 0 && (
                          <div className="bg-teal-950/40 border border-teal-500/20 p-3 rounded-lg flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                placeholder="Common tag..."
                                value={bulkTagInput}
                                onChange={(e) => setBulkTagInput(e.target.value)}
                                className="flex-1 bg-black/50 border border-white/10 rounded-md py-1.5 px-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500/50"
                                disabled={isBulkTagging}
                              />
                              <button 
                                type="button"
                                onClick={handleBulkTag}
                                disabled={!bulkTagInput.trim() || isBulkTagging}
                                className="bg-teal-500 hover:bg-teal-400 text-teal-950 font-bold px-3 py-1.5 rounded-md text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isBulkTagging ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Applying...</span>
                                  </>
                                ) : (
                                  'Apply Tag'
                                )}
                              </button>
                            </div>
                            <div className="flex items-center justify-between border-t border-white/5 pt-2">
                              <span className="text-[9px] text-slate-500">Apply to selected items</span>
                              <button 
                                type="button"
                                onClick={handleBulkDelete}
                                disabled={isBulkDeleting}
                                className="text-[10px] font-bold text-red-400/80 hover:text-red-400 transition-colors"
                              >
                                Delete Selected
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {[...filteredMemories].sort((a, b) => b.timestamp - a.timestamp).map((mem) => {
                      const isSelected = selectedMemoryIds.includes(mem.id);
                      return (
                        <div key={mem.id} className="relative group" style={{ '--app-hue': (mem.sentiment || 0) * 100 + 220 + 'deg' } as React.CSSProperties}>
                          <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-teal-500 border-4 border-[#0a0a0a] z-10" />
                          <div className="flex flex-col gap-1 sentiment-themed border-l-2 p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-teal-400/60 uppercase tracking-tighter">
                                {new Date(mem.timestamp).toLocaleString()}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedMemoryIds(prev => prev.filter(id => id !== mem.id));
                                  } else {
                                    setSelectedMemoryIds(prev => [...prev, mem.id]);
                                  }
                                }}
                                className={`p-1 rounded text-xs transition-colors flex items-center gap-1 ${
                                  isSelected ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {isSelected ? (
                                  <>
                                    <CheckSquare className="w-3.5 h-3.5" />
                                    <span className="text-[10px]">Selected</span>
                                  </>
                                ) : (
                                  <>
                                    <Square className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
                                    <span className="text-[10px] opacity-0 group-hover:opacity-100">Select</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div 
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedMemoryIds(prev => prev.filter(id => id !== mem.id));
                                } else {
                                  setSelectedMemoryIds(prev => [...prev, mem.id]);
                                }
                              }}
                              className={`border p-4 rounded-xl transition-all cursor-pointer select-none ${
                                isSelected 
                                  ? 'bg-teal-500/10 border-teal-500/40' 
                                  : 'bg-white/5 border-white/5 hover:bg-white/10'
                              }`}
                            >
                              <p className="text-sm text-slate-300 leading-relaxed italic">"{mem.text}"</p>
                              {mem.tags && mem.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                  {mem.tags.map((tag, j) => (
                                    <span key={j} className="text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {filteredMemories.length === 0 && (
                      <div className="text-center py-12 text-slate-600 text-sm italic">
                        Temporal history is void.
                      </div>
                    )}
                  </div>
                ) : memoryViewMode === 'graph' ? (
                  <div className="mb-6">
                    <MemoryForceGraph memories={memories} />
                  </div>
                ) : (
                  <div className="mb-6">
                    <MemoryGraph3D memories={memories} />
                  </div>
                )}

                <form onSubmit={handleAddMemory} className="relative">
                  <input 
                    type="text" 
                    value={newMemory}
                    onChange={e => setNewMemory(e.target.value)}
                    placeholder="Inject new context..."
                    className="w-full bg-black/50 border border-white/10 rounded-lg py-3 px-4 text-sm focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all placeholder:text-slate-600"
                  />
                  <button type="submit" className="absolute right-2 top-2 p-1 text-slate-500 hover:text-teal-400 transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              </div>
    </div>
  );
};
