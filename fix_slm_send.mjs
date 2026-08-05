import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// First, remove the wrong injection
const badInjection = `
    if (slmLoaded && slmWorkerRef.current) {
      slmWorkerRef.current.postMessage({
        action: 'generate_thought',
        text: userText,
        id: \`intrusive_\${traceId}\`,
        context: activeMessages.slice(-3).map(m => m.content || m.selfAnalysis).join(' ')
      });
    }`;

content = content.replace(badInjection, "");

// Now find handleSend and inject correctly
// handleSend starts with:
// const handleSend = async (e?: React.FormEvent) => {
//     if (e) e.preventDefault();
//     rlAgent.current?.applyDelayedInsightReward(0.1);
//     if (!input.trim() || (modelState !== 'Idle' && modelState !== 'Listening')) return;
//     const userText = input.trim();
//     setInput('');
//     const traceId = `tr_${Math.random().toString(36).substring(2, 11)}`;

// I'll just replace the specific block inside handleSend
const handleSendMatch = "const userText = input.trim();\\n    setInput('');\\n    const traceId = `tr_${Math.random().toString(36).substring(2, 11)}`;";

content = content.replace(
    /const userText = input\.trim\(\);\s*setInput\(''\);\s*const traceId = `tr_\$\{Math\.random\(\)\.toString\(36\)\.substring\(2, 11\)\}`;/,
    `const userText = input.trim();\n    setInput('');\n    const traceId = \`tr_\${Math.random().toString(36).substring(2, 11)}\`;\n    if (slmLoaded && slmWorkerRef.current) {\n      slmWorkerRef.current.postMessage({\n        action: 'generate_thought',\n        text: userText,\n        id: \`intrusive_\${traceId}\`,\n        context: activeMessages.slice(-3).map(m => m.content || m.selfAnalysis).join(' ')\n      });\n    }`
);

fs.writeFileSync('src/App.tsx', content);
