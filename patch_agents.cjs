const fs = require('fs');
let content = fs.readFileSync('src/AgentsPanel.tsx', 'utf-8');

const oldModels = `<option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Anthropic)</option>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Anthropic)</option>`;

const newModels = `<option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Anthropic)</option>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Anthropic)</option>
                      <option value="groq/llama3-70b-8192">Llama 3 70B (Groq)</option>
                      <option value="groq/mixtral-8x7b-32768">Mixtral 8x7B (Groq)</option>
                      <option value="openrouter/anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (OpenRouter)</option>
                      <option value="openrouter/meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B (OpenRouter)</option>`;

content = content.replace(oldModels, newModels);
fs.writeFileSync('src/AgentsPanel.tsx', content);
