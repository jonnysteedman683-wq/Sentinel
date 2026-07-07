import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from 'dotenv';
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Initialize Gemini
  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || 'dummy',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API routes FIRST
  app.post("/api/gemini/generate", async (req, res) => {
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
           systemPrompt = sysMsg.parts.map((p: any) => p.text).join('\n');
        }
        
        messages = contents.filter((c: any) => c.role !== 'system').map((c: any) => ({
          role: c.role === 'model' ? 'assistant' : 'user',
          content: c.parts.map((p: any) => p.text).join('\n')
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
        res.json({ 
          text,
          provider: 'openai',
          usage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0
          }
        });
        
      } else if (model.startsWith('openrouter/')) {
        const actualModel = model.replace('openrouter/', '');
        const openai = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY || 'dummy', baseURL: 'https://openrouter.ai/api/v1' });
        
        if (systemPrompt && messages[0]?.role !== 'system') {
           messages.unshift({ role: 'system', content: systemPrompt });
        }
        const completion = await openai.chat.completions.create({
          model: actualModel,
          messages,
          temperature: config?.temperature,
          response_format: config?.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        });
        
        const text = completion.choices[0].message.content || "";
        res.json({ 
          text,
          provider: 'openrouter',
          usage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0
          }
        });
      } else if (model.startsWith('groq/')) {
        const actualModel = model.replace('groq/', '');
        const openai = new OpenAI({ apiKey: process.env.GROQ_API_KEY || 'dummy', baseURL: 'https://api.groq.com/openai/v1' });
        
        if (systemPrompt && messages[0]?.role !== 'system') {
           messages.unshift({ role: 'system', content: systemPrompt });
        }
        const completion = await openai.chat.completions.create({
          model: actualModel,
          messages,
          temperature: config?.temperature,
          response_format: config?.responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
        });
        
        const text = completion.choices[0].message.content || "";
        res.json({ 
          text,
          provider: 'groq',
          usage: {
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0
          }
        });
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
                lastMsg.content += "\n\nPlease output ONLY valid JSON.";
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
        res.json({ 
          text,
          provider: 'anthropic',
          usage: {
            promptTokens: msg.usage?.input_tokens || 0,
            completionTokens: msg.usage?.output_tokens || 0,
            totalTokens: (msg.usage?.input_tokens || 0) + (msg.usage?.output_tokens || 0)
          }
        });
        
      } else {
        // Default Gemini
        const response = await ai.models.generateContent({
          model,
          contents,
          config
        });
        res.json({
          ...response,
          text: response.text,
          provider: 'google',
          usage: {
            promptTokens: response.usageMetadata?.promptTokenCount || 0,
            completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.usageMetadata?.totalTokenCount || 0
          }
        });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gemini/embed", async (req, res) => {
    try {
      const { model, contents } = req.body;
      const response = await ai.models.embedContent({
        model,
        contents
      });
      res.json({
        ...response,
        embeddings: response.embeddings
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
