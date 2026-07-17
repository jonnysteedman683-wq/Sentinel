const fs = require('fs');
let content = fs.readFileSync('src/components/tabs/MemoryTab.tsx', 'utf8');

// Fix imports
content = content.replace(/ThermometerSnowflake \n} from 'lucide-react';/, "ThermometerSnowflake, Lightbulb, Loader2, ChevronDown, Plus \n} from 'lucide-react';");

// Add props to interface
const interfaceAddition = `
  setModelState: React.Dispatch<React.SetStateAction<any>>;
  fetchInsight: (text: string) => Promise<any>;
  setActiveInsight: React.Dispatch<React.SetStateAction<any>>;
  startDateFilter: string;
  setStartDateFilter: (val: string) => void;
  endDateFilter: string;
  setEndDateFilter: (val: string) => void;
  handleAddMemory: (e: React.FormEvent) => void;
  newMemory: string;
  setNewMemory: (val: string) => void;
`;
content = content.replace(/export interface MemoryTabProps \{/, "export interface MemoryTabProps {\n" + interfaceAddition);

// Add props to destructuring
const destructuringAddition = `
    setModelState, fetchInsight, setActiveInsight, startDateFilter, setStartDateFilter,
    endDateFilter, setEndDateFilter, handleAddMemory, newMemory, setNewMemory,
`;
content = content.replace(/const \{/, "const {\n" + destructuringAddition);

fs.writeFileSync('src/components/tabs/MemoryTab.tsx', content);
