const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');

if (!content.includes('import OpenAI')) {
  content = content.replace('import { GoogleGenAI } from "@google/genai";', 
  `import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";`);
}

// Replace the /api/gemini/generate route entirely
const startRoute = 'app.post("/api/gemini/generate", async (req, res) => {';
const endRoute = '  app.post("/api/gemini/embed", async (req, res) => {';

const newRoute = `app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      
      // Setup format helpers
      let systemPrompt = undefined;
      let textContent = "";
      let messages = [];

      if (typeof contents === 'string') {
        textContent = contents;
        messages = [{ role: 'user', content: textContent }];
      } else {
        // Find system prompt if it exists
        const sysMsg = contents.find((c: any) => c.role === 'system');
        if (sysMsg) {
           systemPrompt = sysMsg.parts.map((p: any) => p.text).join('\\n');
        }
        
        messages = contents.filter((c: any) => c.role !== 'system').map((c: any) => ({
          role: c.role === 'model' ? 'assistant' : 'user',
          content: c.parts.map((p: any) => p.text).join('\\n')
        }));
      }

      if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });
        
        if (systemPrompt && messages[0]?.role !== 'system') {
           messages.unshift({ role: 'system', content: systemPrompt });
        }

        const completion = await openai.chat.completions.create({
          model,
          messages,
          temperature: config?.temperature,
          response_format: config?.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        });
        
        const text = completion.choices[0].message.content || "";
        res.json({ text });
        
      } else if (model.startsWith('claude-')) {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'dummy' });
        
        let anthropicMessages = messages;
        if (messages[0]?.role === 'system') {
           systemPrompt = messages[0].content;
           anthropicMessages = messages.slice(1);
        }

        // Prepare prompt to force JSON if needed
        if (config?.responseMimeType === 'application/json' && anthropicMessages.length > 0) {
            const lastMsg = anthropicMessages[anthropicMessages.length - 1];
            if (lastMsg.role === 'user') {
                lastMsg.content += "\\n\\nPlease output ONLY valid JSON.";
            }
        }

        const msg = await anthropic.messages.create({
          model,
          max_tokens: 4096,
          temperature: config?.temperature,
          system: systemPrompt,
          messages: anthropicMessages
        });
        
        const text = msg.content.map(c => c.type === 'text' ? c.text : '').join('');
        res.json({ text });
        
      } else {
        // Default Gemini
        const response = await ai.models.generateContent({
          model,
          contents,
          config
        });
        res.json({
          ...response,
          text: response.text
        });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

`;

const firstPart = content.split(startRoute)[0];
const lastPart = content.split(endRoute)[1];

fs.writeFileSync('server.ts', firstPart + newRoute + endRoute + lastPart);
