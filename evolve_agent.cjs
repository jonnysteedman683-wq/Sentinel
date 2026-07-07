const fs = require('fs');
let content = fs.readFileSync('src/AgentsPanel.tsx', 'utf-8');

if (!content.includes("getGeminiClient")) {
    content = content.replace(
        "import { AgentRole, AgentProfile } from './types';", 
        "import { AgentRole, AgentProfile } from './types';\nimport { getGeminiClient } from './geminiClient';"
    );
}

if (!content.includes("Sparkles")) {
    content = content.replace("Trash2, Edit2, CheckCircle2 }", "Trash2, Edit2, CheckCircle2, Sparkles, Loader2 }");
}

const handleEvolve = `
  const [isEvolving, setIsEvolving] = useState(false);

  const handleEvolveAgent = async (agent: AgentProfile) => {
    setIsEvolving(true);
    try {
      const ai = getGeminiClient();
      const prompt = \`
You are an AI tasked with upgrading another agent's operational parameters based on self-reflection and best practices.
Analyze the following agent profile and produce a heavily optimized, upgraded version.
Make the system prompt more robust, adding specific constraints, formatting rules, and chain-of-thought directives.
Add any new capabilities that would make it more effective at its role.

Current Profile:
Name: \${agent.name}
Role: \${agent.role}
System Prompt: \${agent.systemPrompt}
Capabilities: \${agent.capabilities.join(', ')}

Respond ONLY with a JSON object containing the fields: 'systemPrompt' (string) and 'capabilities' (array of strings). Do not use markdown blocks.\`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature: 0.7,
            responseMimeType: "application/json"
        }
      });
      
      let txt = response.text || "";
      if (txt.startsWith('\`\`\`json')) {
        txt = txt.replace(/\`\`\`json\\n/, '').replace(/\\n\`\`\`/, '');
      }
      
      const update = JSON.parse(txt);
      
      await db.agents.update(agent.id!, {
        systemPrompt: update.systemPrompt,
        capabilities: update.capabilities
      });
      
    } catch (e) {
      console.error('Failed to evolve agent:', e);
    } finally {
      setIsEvolving(false);
    }
  };
`;

content = content.replace("const handleAddAgent = async () => {", handleEvolve + "\n  const handleAddAgent = async () => {");


const oldButton = `<button 
                  onClick={() => toggleStatus(selectedAgent)}
                  className={\`px-4 py-2 rounded-lg font-bold text-xs tracking-widest border transition-colors \${
                    selectedAgent.status === 'active' 
                      ? 'bg-rose-950/30 text-rose-400 border-rose-900/50 hover:bg-rose-900/50'
                      : 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/50'
                  }\`}
                >
                  {selectedAgent.status === 'active' ? 'SUSPEND AGENT' : 'ACTIVATE AGENT'}
                </button>`;

const newButtons = `<div className="flex flex-col gap-3 items-end">
                <button 
                  onClick={() => handleEvolveAgent(selectedAgent)}
                  disabled={isEvolving}
                  className="px-4 py-2 flex items-center gap-2 rounded-lg font-bold text-xs tracking-widest border border-purple-500/50 bg-purple-900/30 text-purple-400 hover:bg-purple-900/50 transition-all shadow-[0_0_15px_rgba(168,85,247,0.15)] disabled:opacity-50"
                >
                  {isEvolving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {isEvolving ? 'EVOLVING COGNITION...' : 'INITIATE SELF-MODIFICATION'}
                </button>
                <button 
                  onClick={() => toggleStatus(selectedAgent)}
                  className={\`px-4 py-2 rounded-lg font-bold text-xs tracking-widest border transition-colors \${
                    selectedAgent.status === 'active' 
                      ? 'bg-rose-950/30 text-rose-400 border-rose-900/50 hover:bg-rose-900/50'
                      : 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50 hover:bg-emerald-900/50'
                  }\`}
                >
                  {selectedAgent.status === 'active' ? 'SUSPEND AGENT' : 'ACTIVATE AGENT'}
                </button>
                </div>`;

content = content.replace(oldButton, newButtons);

fs.writeFileSync('src/AgentsPanel.tsx', content);
