import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, ChevronRight, Activity, BrainCircuit, Bot } from 'lucide-react';
import { fetchWithTracing } from '../../lib/fetchWithTracing.js';
import { getFirestore, collection, query, onSnapshot, orderBy } from '../../firebase.js';
import { useAuth } from '../../hooks/useAuth.js';

interface Subtask {
  id: string;
  text: string;
  status: 'pending' | 'active' | 'completed';
}

interface Goal {
  id: string;
  title: string;
  description: string;
  progress: number;
  subtasks: Subtask[];
}

const DUMMY_GOALS: Goal[] = [
  {
    id: 'g1',
    title: 'Understand Quantum Tunneling',
    description: 'Synthesize literature on quantum tunneling effects in biological systems.',
    progress: 33,
    subtasks: [
      { id: 's1', text: 'Scan ArXiv for recent papers', status: 'completed' },
      { id: 's2', text: 'Cross-reference with enzyme kinetics', status: 'active' },
      { id: 's3', text: 'Simulate proton tunneling probability', status: 'pending' },
    ]
  },
  {
    id: 'g2',
    title: 'Self-Improvement Protocol',
    description: 'Analyze own prompt architecture for cognitive bottlenecks.',
    progress: 80,
    subtasks: [
      { id: 's4', text: 'Extract execution logs', status: 'completed' },
      { id: 's5', text: 'Identify redundant thought loops', status: 'completed' },
      { id: 's6', text: 'Propose prompt optimizations', status: 'active' },
      { id: 's7', text: 'Deploy optimizations', status: 'pending' },
    ]
  }
];

export function GoalFormationUI({ theme, handleSend, handleTabChange }: { theme: 'dark' | 'light', handleSend?: (text: string, syntheticId?: string) => void, handleTabChange?: (tab: string) => void }) {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    const q = query(collection(db, `users/${user.uid}/goals`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, snap => {
      const dbGoals = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Goal));
      setGoals(dbGoals);
    });
    return () => unsubscribe();
  }, [user]);

  const generateNewGoal = async () => {
    setIsGenerating(true);
    try {
      const res = await fetchWithTracing('/api/goals/generate', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.goal) {
        const newGoal: Goal = {
          id: `g${Date.now()}`,
          title: data.goal.title || 'Synthesized Objective',
          description: data.goal.description || 'No description provided.',
          progress: 0,
          subtasks: (data.goal.subtasks || []).map((text: string, i: number) => ({
            id: `s${Date.now()}-${i}`,
            text,
            status: i === 0 ? 'active' : 'pending'
          }))
        };
        // Save to backend
        await fetchWithTracing('/api/goals/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal: newGoal })
        });
      }
    } catch (error) {
      console.error("Failed to generate goal", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSubtask = async (goalId: string, taskId: string, currentStatus: string) => {
    // Cycle: pending -> active -> completed -> pending
    let nextStatus = 'pending';
    if (currentStatus === 'pending') nextStatus = 'active';
    else if (currentStatus === 'active') nextStatus = 'completed';
    
    try {
      await fetchWithTracing('/api/goals/update-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, taskId, status: nextStatus })
      });
    } catch (err) {
      console.error("Failed to update task", err);
    }
  };

  const delegateToAgent = (taskText: string) => {
    if (handleSend) {
      handleSend(`[GOAL DELEGATION] Please execute the following subtask autonomously:\n${taskText}`);
      if (handleTabChange) {
        handleTabChange('Chat');
      }
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)] animate-in fade-in slide-in-from-right-4 duration-300 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30">
            <Target className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-500 tracking-tight">
              Goal Formation Engine
            </h2>
            <p className="text-xs text-slate-400 font-medium">Autonomous strategic objective synthesis</p>
          </div>
        </div>
        
        <button 
          onClick={generateNewGoal}
          disabled={isGenerating}
          className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-sm font-semibold transition-all ${
            isGenerating 
              ? 'bg-orange-500/10 border-orange-500/20 text-orange-400/50 cursor-not-allowed'
              : 'bg-orange-500/20 border-orange-500/30 text-orange-400 hover:bg-orange-500/30 hover:border-orange-500/50 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)]'
          }`}
        >
          {isGenerating ? (
            <><Activity className="w-4 h-4 animate-spin" /> Synthesizing Goal...</>
          ) : (
            <><BrainCircuit className="w-4 h-4" /> Formulate Objective</>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
        {goals.map(goal => (
          <div key={goal.id} className={`p-6 rounded-2xl border transition-all ${
            theme === 'dark' 
              ? 'bg-slate-900/50 border-white/10 hover:border-orange-500/30 hover:bg-slate-900/80' 
              : 'bg-white border-slate-200 hover:border-orange-400 hover:shadow-xl'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className={`text-lg font-bold mb-1 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>
                  {goal.title}
                </h3>
                <p className="text-sm text-slate-500">{goal.description}</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-500">
                  {goal.progress}%
                </span>
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Progress</span>
              </div>
            </div>

            <div className="w-full bg-slate-800/50 rounded-full h-2 mb-6 border border-white/5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-orange-500 to-amber-400 h-2 rounded-full transition-all duration-1000 relative"
                style={{ width: `${goal.progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/5 pt-4">
              {goal.subtasks.map((task) => (
                <div key={task.id} 
                  onClick={() => toggleSubtask(goal.id, task.id, task.status)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:scale-[1.01] transition-all ${
                  task.status === 'completed'
                    ? 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                    : task.status === 'active'
                      ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20'
                      : theme === 'dark' ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}>
                  <div className={`p-1.5 rounded-full transition-all ${
                    task.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : task.status === 'active'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-slate-500/20 text-slate-400'
                  }`}>
                    {task.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : task.status === 'active' ? <Activity className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                  <span className={`text-sm font-medium flex-1 ${
                    task.status === 'completed'
                      ? 'text-emerald-400 line-through opacity-70'
                      : task.status === 'active'
                        ? 'text-orange-400'
                        : theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {task.text}
                  </span>
                  
                  {task.status === 'active' && handleSend && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); delegateToAgent(task.text); }}
                      className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white transition-colors flex items-center gap-1 border border-orange-500/30 text-[10px] uppercase font-bold tracking-wider"
                    >
                      <Bot className="w-3 h-3" />
                      Delegate
                    </button>
                  )}
                  {task.status === 'active' && !handleSend && (
                    <span className="text-[10px] uppercase tracking-widest text-orange-500 font-bold px-2 py-1 bg-orange-500/10 rounded border border-orange-500/20 animate-pulse">
                      In Progress
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
