import { readFileSync } from 'fs';
const content = readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const chatStart = lines.findIndex(l => l.includes("{activeTab === 'Chat' ? ("));
const chatEnd = lines.findIndex((l, i) => i > chatStart && l.includes("activeTab === 'Memory' ? ("));

console.log(`Chat UI starts at ${chatStart} and ends around ${chatEnd}`);
