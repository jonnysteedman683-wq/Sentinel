const fs = require('fs');
let content = fs.readFileSync('src/SystemMetrics.tsx', 'utf-8');

const oldState = `  const [tokenStats, setTokenStats] = useState({
    google: { reqs: 0, tokens: 0 },
    openai: { reqs: 0, tokens: 0 },
    anthropic: { reqs: 0, tokens: 0 }
  });`;

const newState = `  const [tokenStats, setTokenStats] = useState({
    google: { reqs: 0, tokens: 0 },
    openai: { reqs: 0, tokens: 0 },
    anthropic: { reqs: 0, tokens: 0 }
  });

  const [providerStatus, setProviderStatus] = useState({
    google: { status: 'ONLINE', uptime: 99.99, ping: 45 },
    openai: { status: 'ONLINE', uptime: 99.85, ping: 120 },
    anthropic: { status: 'ONLINE', uptime: 99.92, ping: 85 }
  });`;

const oldEffect = `      setLatency(newLatency);
      setHistory(prev => {`;

const newEffect = `      setLatency(newLatency);
      setProviderStatus(prev => {
        const next = { ...prev };
        (Object.keys(next) as Array<keyof typeof next>).forEach(key => {
          next[key] = { ...next[key] };
          next[key].ping = Math.max(10, next[key].ping + (Math.random() * 20 - 10));
          if (Math.random() > 0.98) {
            next[key].status = next[key].status === 'ONLINE' ? 'DEGRADED' : 'ONLINE';
          }
        });
        return next;
      });
      setHistory(prev => {`;

const oldUI = `      {/* System Health Widget */}`;

const newUI = `      {/* AI Provider Status Widget */}
      <div className="pt-3 border-t border-slate-800/50 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Network size={10} className="text-blue-500" />
            <span className="text-slate-400">AI PROVIDERS</span>
          </div>
          <span className="text-[8px] text-slate-500">STATUS</span>
        </div>

        <div className="flex flex-col gap-2">
          {Object.entries(providerStatus).map(([provider, details]) => (
            <div key={provider} className="flex items-center justify-between text-[8px]">
              <div className="flex items-center gap-1.5 w-16">
                <div className={\`w-1.5 h-1.5 rounded-full \${details.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}\`} />
                <span className="uppercase text-slate-500">{provider}</span>
              </div>
              <div className="flex flex-col items-end w-16">
                 <span className={details.status === 'ONLINE' ? 'text-emerald-500' : 'text-amber-500'}>{details.status}</span>
                 <span className="text-[7px] text-slate-600">{details.uptime}% UPTIME</span>
              </div>
              <span className="w-10 text-right">{Math.round(details.ping)}ms</span>
            </div>
          ))}
        </div>
      </div>

      {/* System Health Widget */}`;

content = content.replace(oldState, newState);
content = content.replace(oldEffect, newEffect);
content = content.replace(oldUI, newUI);

fs.writeFileSync('src/SystemMetrics.tsx', content);
