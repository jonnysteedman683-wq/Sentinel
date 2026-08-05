const fs = require('fs');
let content = fs.readFileSync('src/components/MemoriaDashboard.tsx', 'utf8');

if (!content.includes('import { Activity, Beaker } from "lucide-react";')) {
  content = content.replace("import { fetchWithTracing } from '../lib/fetchWithTracing.js';", "import { fetchWithTracing } from '../lib/fetchWithTracing.js';\nimport { Activity, Beaker } from 'lucide-react';\nimport { auth } from '../firebase.js';");
}

const functionCode = `
  const [isDistilling, setIsDistilling] = useState(false);
  const handleDistill = async () => {
    if (!user) return;
    setIsDistilling(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/knowledge/distill', {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      const data = await res.json();
      console.log('Distillation result:', data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDistilling(false);
    }
  };
`;

if (!content.includes('const handleDistill = async')) {
  content = content.replace('// Compute metrics for chart', `${functionCode}\n\n  // Compute metrics for chart`);
}

const buttonCode = `
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Activity className="text-teal-500" />
          Memoria Analytics
        </h2>
        <button
          onClick={handleDistill}
          disabled={isDistilling}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 border border-teal-500/40 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Beaker size={16} className={isDistilling ? "animate-pulse" : ""} />
          {isDistilling ? "Distilling..." : "Run Quantum Distillation"}
        </button>
      </div>
`;

if (!content.includes('Run Quantum Distillation')) {
  content = content.replace(
    `<h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-4">\n        <Activity className="text-teal-500" />\n        Memoria Analytics\n      </h2>`,
    buttonCode
  );
  // Also try catching if it's slightly different
  content = content.replace(
    `<h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 mb-4"><Activity className="text-teal-500" />Memoria Analytics</h2>`,
    buttonCode
  );
}

fs.writeFileSync('src/components/MemoriaDashboard.tsx', content);
