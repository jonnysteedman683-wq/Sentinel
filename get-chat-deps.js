import { readFileSync } from 'fs';

const content = readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const chatStart = lines.findIndex(l => l.includes("{activeTab === 'Chat' ? ("));
const chatEnd = lines.findIndex((l, i) => i > chatStart && l.includes("activeTab === 'Memory' ? ("));

const chatCode = lines.slice(chatStart, chatEnd).join('\n');
console.log(chatCode.substring(0, 500));
