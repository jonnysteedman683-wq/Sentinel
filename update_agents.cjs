const fs = require('fs');
let content = fs.readFileSync('src/AgentsPanel.tsx', 'utf-8');

const originalOptions = `<option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>`;

const newOptions = `<option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      <option value="gpt-4o">GPT-4o (OpenAI)</option>
                      <option value="gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
                      <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Anthropic)</option>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Anthropic)</option>`;

content = content.replace(originalOptions, newOptions);

fs.writeFileSync('src/AgentsPanel.tsx', content);
