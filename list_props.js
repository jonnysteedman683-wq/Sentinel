import { readFileSync } from 'fs';
const content = readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');

const chatStart = lines.findIndex(l => l.includes("{activeTab === 'Chat' ? ("));
const chatEnd = lines.findIndex((l, i) => i > chatStart && l.includes("activeTab === 'Memory' ? ("));

const chatCode = lines.slice(chatStart, chatEnd).join('\n');

// very basic regex to find variable names used in JSX
const variables = new Set();
// Find words not enclosed in quotes, ignoring standard HTML/React stuff
// Let's just find everything that looks like a state or function and manually filter.
const matches = chatCode.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g);
if (matches) {
  matches.forEach(m => variables.add(m));
}
// output it all so I can inspect manually.
console.log(Array.from(variables).join(', '));
