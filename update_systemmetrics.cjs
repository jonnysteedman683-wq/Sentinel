const fs = require('fs');
let content = fs.readFileSync('src/SystemMetrics.tsx', 'utf-8');

const oldState = `  const [latency, setLatency] = useState(120);`;
const newState = `  const [latency, setLatency] = useState(120);
  const [tokenStats, setTokenStats] = useState({
    google: { reqs: 0, tokens: 0 },
    openai: { reqs: 0, tokens: 0 },
    anthropic: { reqs: 0, tokens: 0 }
  });`;

const oldEffect = `    return () => clearInterval(interval);
  }, [mem, latency]);`;
const newEffect = `    return () => clearInterval(interval);
  }, [mem, latency]);

  useEffect(() => {
    const handleUsage = (e: any) => {
      const { provider, usage } = e.detail;
      setTokenStats(prev => {
        const prov = provider as keyof typeof prev;
        if (!prev[prov]) return prev;
        return {
          ...prev,
          [prov]: {
            reqs: prev[prov].reqs + 1,
            tokens: prev[prov].tokens + (usage.totalTokens || 0)
          }
        };
      });
    };
    window.addEventListener('ai-usage', handleUsage);
    return () => window.removeEventListener('ai-usage', handleUsage);
  }, []);`;

const oldUI = `      {/* System Health Widget */}`;
const newUI = `      {/* AI Token Usage Widget */}
      <div className="pt-3 border-t border-slate-800/50 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Cpu size={10} className="text-purple-500" />
            <span className="text-slate-400">AI TOKENS</span>
          </div>
          <span className="text-[8px] text-slate-500">
            TOTAL: {(tokenStats.google.tokens + tokenStats.openai.tokens + tokenStats.anthropic.tokens).toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {Object.entries(tokenStats).map(([provider, stats]) => (
            <div key={provider} className="flex items-center justify-between text-[8px]">
              <div className="flex items-center gap-1.5 w-16">
                <span className="uppercase text-slate-500">{provider}</span>
              </div>
              <div className="flex-1 mx-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={\`h-full transition-all duration-500 \${
                    provider === 'google' ? 'bg-blue-500' : 
                    provider === 'openai' ? 'bg-emerald-500' : 'bg-amber-500'
                  }\`} 
                  style={{ width: \`\${Math.min(100, (stats.tokens / 5000) * 100)}%\` }} 
                />
              </div>
              <span className="w-10 text-right">{stats.tokens.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* System Health Widget */}`;

content = content.replace(oldState, newState);
content = content.replace(oldEffect, newEffect);
content = content.replace(oldUI, newUI);

fs.writeFileSync('src/SystemMetrics.tsx', content);
