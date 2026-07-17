const fs = require('fs');

let tab = fs.readFileSync('src/components/tabs/BrainsTab.tsx', 'utf8');
tab = tab.replace(/import \{ InfoTooltip \} from '\.\.\/InfoTooltip';/, "import { InfoTooltip } from '../InfoTooltip';\nimport { PersonaForm } from '../PersonaForm';\nimport { Activity } from 'lucide-react';");

tab = tab.replace(/export interface BrainsTabProps \{/, "export interface BrainsTabProps {\n  modelState: string;\n  skills: any[];\n  toggleSkill: (id: string) => void;");

tab = tab.replace(/isDebateMode, setIsDebateMode, addLog/, 'isDebateMode, setIsDebateMode, addLog, modelState, skills, toggleSkill');

// Remove unused
tab = tab.replace(/Dices, CheckCircle2, Brain, GitMerge, Scale, MessageSquare, Layers/, '');

fs.writeFileSync('src/components/tabs/BrainsTab.tsx', tab);
