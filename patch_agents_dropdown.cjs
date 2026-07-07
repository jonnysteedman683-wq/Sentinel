const fs = require('fs');
let content = fs.readFileSync('src/AgentsPanel.tsx', 'utf-8');

const oldSelect = `<select 
                      value={newAgent.model}
                      onChange={e => setNewAgent({...newAgent, model: e.target.value})}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500/50 focus:outline-none"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      <option value="gpt-4o">GPT-4o (OpenAI)</option>
                      <option value="gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
                      <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Anthropic)</option>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Anthropic)</option>
                      <option value="groq/llama3-70b-8192">Llama 3 70B (Groq)</option>
                      <option value="groq/mixtral-8x7b-32768">Mixtral 8x7B (Groq)</option>
                      <option value="openrouter/anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (OpenRouter)</option>
                      <option value="openrouter/meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B (OpenRouter)</option>
                    </select>`;

const newSelect = `<select 
                      value={newAgent.model}
                      onChange={e => setNewAgent({...newAgent, model: e.target.value})}
                      className="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-sm focus:border-emerald-500/50 focus:outline-none appearance-none"
                    >
                      <optgroup label="Google (Gemini)">
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      </optgroup>
                      <optgroup label="OpenAI">
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                      </optgroup>
                      <optgroup label="Anthropic">
                        <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet</option>
                        <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                      </optgroup>
                      <optgroup label="OpenRouter (Free)">
                        <option value="openrouter/meta-llama/llama-3.1-8b-instruct:free">Llama 3.1 8B (Free)</option>
                        <option value="openrouter/deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
                        <option value="openrouter/google/gemini-2.5-flash:free">Gemini 2.5 Flash (Free)</option>
                      </optgroup>
                      <optgroup label="OpenRouter (Premium)">
                        <option value="openrouter/anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                        <option value="openrouter/meta-llama/llama-3.1-70b-instruct">Llama 3.1 70B</option>
                      </optgroup>
                    </select>`;

content = content.replace(oldSelect, newSelect);
fs.writeFileSync('src/AgentsPanel.tsx', content);
