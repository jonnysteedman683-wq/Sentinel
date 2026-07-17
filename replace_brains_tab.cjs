const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const startStr = ") : activeTab === 'Brains' ? (";
const startIdx = content.indexOf(startStr);
if (startIdx !== -1) {
  const nextTabIdx = content.indexOf(") : activeTab === 'Heartbeat' ? (", startIdx);
  if (nextTabIdx !== -1) {
    const tabCall = `) : activeTab === 'Brains' ? (
              <BrainsTab 
                neuralSway={neuralSway}
                triggerSwayRNG={triggerSwayRNG}
                isSpinning={isSpinning}
                PERSONAS={PERSONAS}
                activePersona={activePersona}
                setActivePersona={setActivePersona}
                cognitiveMode={cognitiveMode}
                setCognitiveMode={setCognitiveMode}
                agentStats={agentStats}
                policyConfidence={policyConfidence}
                efeScore={efeScore}
                depth={depth}
                setDepth={setDepth}
                isDebateMode={isDebateMode}
                setIsDebateMode={setIsDebateMode}
                addLog={addLog}
              />
            `;
    content = content.substring(0, startIdx) + tabCall + content.substring(nextTabIdx);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Successfully replaced BrainsTab block.");
  } else {
    console.log("Could not find Heartbeat tab.");
  }
} else {
  console.log("Could not find Brains tab start.");
}
