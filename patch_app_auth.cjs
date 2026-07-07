const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const importAdd = `
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
`;

content = content.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect } from 'react';" + importAdd);

const originalApp = `export default function App() {
  return (
    <SentinelProvider>
      <SentinelDashboard />
    </SentinelProvider>
  );
}`;

const newApp = `export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center text-emerald-400 font-mono tracking-widest text-xs font-bold flex-col gap-4">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
        INITIALIZING SECURE UPLINK...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center text-slate-300 font-mono">
        <div className="w-full max-w-md p-8 bg-slate-900/50 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-slate-900/0 to-slate-900/0 pointer-events-none"></div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(52,211,153,0.15)]">
              <Fingerprint size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Access Required</h1>
            <p className="text-sm text-slate-400 mb-8 max-w-[280px]">Authenticate to access the Sentinel command node.</p>
            
            <button 
              onClick={handleLogin}
              className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold tracking-widest text-xs transition-all duration-300 shadow-[0_0_20px_rgba(52,211,153,0.2)] hover:shadow-[0_0_30px_rgba(52,211,153,0.4)] flex items-center justify-center gap-3 group"
            >
              <Zap size={16} className="text-emerald-200 group-hover:scale-110 transition-transform" />
              AUTHORIZE ACCESS
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SentinelProvider>
      <SentinelDashboard />
    </SentinelProvider>
  );
}`;

content = content.replace("import { Loader2 } from 'lucide-react';", "");
content = content.replace("import { Cpu, Database,", "import { Loader2, Cpu, Database,");
content = content.replace(originalApp, newApp);
fs.writeFileSync('src/App.tsx', content);
