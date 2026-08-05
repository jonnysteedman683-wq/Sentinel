import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Insert slmWorkerRef after mlWorkerRef
content = content.replace(
  "const mlWorkerRef = useRef<Worker | null>(null);",
  "const mlWorkerRef = useRef<Worker | null>(null);\n  const slmWorkerRef = useRef<Worker | null>(null);\n  const [slmLoaded, setSlmLoaded] = useState(false);\n  const [slmProgress, setSlmProgress] = useState<any>(null);"
);

// Insert slm useEffect
content = content.replace(
  "mlWorkerRef.current = new Worker(new URL('./lib/ml.worker.ts', import.meta.url), { type: 'module' });\n    return () => {\n      if (mlWorkerRef.current) {\n        mlWorkerRef.current.terminate();\n      }\n    };\n  }, []);",
  "mlWorkerRef.current = new Worker(new URL('./lib/ml.worker.ts', import.meta.url), { type: 'module' });\n\n    slmWorkerRef.current = new Worker(new URL('./lib/slm-worker.ts', import.meta.url), { type: 'module' });\n    slmWorkerRef.current.addEventListener('message', (e) => {\n        if (e.data.type === 'loaded') {\n            setSlmLoaded(true);\n        } else if (e.data.type === 'progress') {\n            setSlmProgress(e.data.progress);\n        } else if (e.data.type === 'complete' && e.data.id && e.data.id.startsWith('intrusive_')) {\n            // Add intrusive thought as a system log or minor message\n            const thought = e.data.result;\n            if (thought) {\n              setMessages(prev => [...prev, { id: e.data.id, role: 'ai', content: '', selfAnalysis: `[SLM System 1 Insight] ${thought}` }]);\n            }\n        }\n    });\n    slmWorkerRef.current.postMessage({ action: 'load' });\n\n    return () => {\n      if (mlWorkerRef.current) mlWorkerRef.current.terminate();\n      if (slmWorkerRef.current) slmWorkerRef.current.terminate();\n    };\n  }, []);"
);

fs.writeFileSync('src/App.tsx', content);
