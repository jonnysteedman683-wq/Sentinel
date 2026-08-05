import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Insert slmWorkerRef postMessage
content = content.replace(
  "const traceId = `tr_${Math.random().toString(36).substring(2, 11)}`;",
  "const traceId = `tr_${Math.random().toString(36).substring(2, 11)}`;\n    if (slmLoaded && slmWorkerRef.current) {\n      slmWorkerRef.current.postMessage({\n        action: 'generate_thought',\n        text: userText,\n        id: `intrusive_${traceId}`,\n        context: activeMessages.slice(-3).map(m => m.content || m.selfAnalysis).join(' ')\n      });\n    }"
);

fs.writeFileSync('src/App.tsx', content);
