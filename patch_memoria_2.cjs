const fs = require('fs');
let content = fs.readFileSync('src/components/MemoriaDashboard.tsx', 'utf8');

const buttonCode = `
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-purple-400">Memoria – Eternal Learning</h2>
        <button
          onClick={handleDistill}
          disabled={isDistilling}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/40 text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <Beaker size={16} className={isDistilling ? "animate-pulse" : ""} />
          {isDistilling ? "Distilling..." : "Run Quantum Distillation"}
        </button>
      </div>
`;

if (content.includes('<h2 className="text-2xl font-bold text-purple-400">Memoria – Eternal Learning</h2>')) {
  content = content.replace(
    '<h2 className="text-2xl font-bold text-purple-400">Memoria – Eternal Learning</h2>',
    buttonCode
  );
}

fs.writeFileSync('src/components/MemoriaDashboard.tsx', content);
