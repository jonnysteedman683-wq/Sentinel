import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Add imports
if (!content.includes('Volume2')) {
  content = content.replace(
    /import {\s*/,
    "import { Volume2, VolumeX, "
  );
}

if (!content.includes('ambientSynth')) {
  content = content.replace(
    "import { Spark } from './components/KnowledgeGraphPanel.js';",
    "import { Spark } from './components/KnowledgeGraphPanel.js';\nimport { ambientSynth } from './lib/audio-synth.js';"
  );
}

// Add state
content = content.replace(
  "const [isSidebarOpen, setSidebarOpen] = useState(true);",
  "const [isSidebarOpen, setSidebarOpen] = useState(true);\n  const [isSynthPlaying, setIsSynthPlaying] = useState(false);"
);

// Toggle function
const toggleSynth = `
  const toggleSynth = () => {
    if (isSynthPlaying) {
      ambientSynth.stop();
      setIsSynthPlaying(false);
    } else {
      ambientSynth.start();
      setIsSynthPlaying(true);
    }
  };
`;

content = content.replace(
  "const handleTabChange",
  `${toggleSynth}\n  const handleTabChange`
);

// Add effect to modulate synth when vitals or qValueHistory change
const synthEffect = `
  useEffect(() => {
    if (isSynthPlaying) {
      // Calculate anomaly score from vitals (e.g. high entropy, high errors, low stability -> anomaly)
      let anomalyScore = 0;
      if (vitals.entropy > 50) anomalyScore += (vitals.entropy - 50) / 100;
      if (vitals.errors > 0) anomalyScore += 0.2;
      if (vitals.stability < 80) anomalyScore += (80 - vitals.stability) / 100;
      anomalyScore = Math.min(1.0, Math.max(0.0, anomalyScore));
      
      let convergence = 0;
      if (qValueHistory.length > 0) {
        // Last 5 qValues diff
        const lastFew = qValueHistory.slice(-5);
        if (lastFew.length > 1) {
          const max = Math.max(...lastFew.map(q => q.qValue));
          const min = Math.min(...lastFew.map(q => q.qValue));
          const diff = max - min;
          convergence = Math.max(0, 1.0 - (diff * 2.0)); // Rough heuristic
        } else {
          convergence = 0.5;
        }
      }
      
      ambientSynth.modulate(anomalyScore, convergence);
    }
  }, [vitals, qValueHistory, isSynthPlaying]);
`;

content = content.replace(
  "const sessionStartTime = useRef<number>(0);",
  `${synthEffect}\n  const sessionStartTime = useRef<number>(0);`
);

// Add button to sidebar
const volumeBtn = `
             <button onClick={toggleSynth} title="Ambient Synth" className={\`p-3 w-full flex items-center justify-center rounded-xl transition-all mt-auto \${isSynthPlaying ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-black/5'}\`}>
               {isSynthPlaying ? <Volume2 className="w-5 h-5 animate-pulse" /> : <VolumeX className="w-5 h-5" />}
             </button>
             <div className="h-4" />
`;

content = content.replace(
  '<button onClick={() => handleTabChange(\'Memoria\')}',
  `${volumeBtn}\n             <button onClick={() => handleTabChange('Memoria')}`
);

fs.writeFileSync('src/App.tsx', content);
