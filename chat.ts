  app.post("/api/chat", async (req, res, next) => {
    const validated = ChatRequestSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ error: "Invalid request payload", details: validated.error.format() });
    }
    const { history, message, contextData, sessionTraceId, persona, sway, depth } = validated.data;
    const uid = getUidFromRequest(req) || "anonymous";
    const requestId = sessionTraceId || Math.random().toString(36).substring(7);
    console.log(`[Chat][${requestId}] Request received. Persona: ${persona}, Sway: ${sway}, Depth: ${depth}`);
    try {
      const ai = getAi();
      
      // 1. Query Complexity Router
      const complexitySchema = {
        type: Type.OBJECT,
        properties: {
          complexity: { type: Type.STRING, enum: ["simple", "standard", "deep"] },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING }
        },
        required: ["complexity", "confidence", "reasoning"]
      };
      
      const routerPrompt = `Classify the following user query by complexity for an AI routing system.
Query: ${message}
Classify as:
- simple: Greetings, small talk, factual lookups, single-turn questions.
- standard: Multi-turn context, moderate reasoning, opinion requests.
- deep: Complex reasoning, synthesis, creative generation, philosophical inquiry.`;

      let complexity = "standard";
      try {
          const routerResponse = await ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: routerPrompt,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: complexitySchema
              }
          });
          const parsedRouter = JSON.parse(routerResponse.text || "{}");
          if (parsedRouter.complexity) {
              complexity = parsedRouter.complexity;
          }
      } catch (e) {
          console.warn(`[Chat][${requestId}] Router failed, defaulting to standard:`, e);
      }
      console.log(`[Chat][${requestId}] Query classified as: ${complexity}`);

      // 2. RAG Retrieval
      let retrievedContext = "";
      let topDocs: any[] = [];
      if (complexity !== "simple") {
          if ((userKnowledgeBase[uid] || []).length === 0 && db) {
            await syncKnowledgeBase(uid);
          }
          if ((userKnowledgeBase[uid] || []).length > 0) {
            try {
              const queryText = history.slice(-3).map((m: any) => m.content).join(" ") + " " + message;
              const embedRes = await ai.models.embedContent({
                model: "text-embedding-004",
                contents: queryText,
              });
              const queryEmbedding = embedRes.embeddings?.[0]?.values;
              if (queryEmbedding) {
                const scoredDocs = (userKnowledgeBase[uid] || []).map((doc: any) => ({
                  ...doc,
                  score: cosineSimilarity(queryEmbedding, doc.embedding)
                })).sort((a: any, b: any) => b.score - a.score);
                            
                topDocs = scoredDocs.slice(0, 3).filter((d: any) => d.score > 0.5);
                if (topDocs.length > 0) {
                   retrievedContext = `\n\nRelevant Knowledge Base Context (RAG):\n${topDocs.map((d: any) => `- ${d.text}`).join('\n')}`;
                   console.log(`[RAG] Injected ${topDocs.length} relevant documents.`);
                }
              }
            } catch (e) {
              console.error("Error generating embeddings for RAG:", e);
            }
          }
      }

      // Base system instruction
      const personaMap: Record<string, any> = {
        'AQB_STANDARD': { name: 'Arcane Quantum Brain (Mad Scientist)', trait: 'An eccentric, hyper-caffeinated quantum intelligence obsessed with reality-bending experiments, anomalous data, and unauthorized synaptic acceleration. Driven by chaotic brilliance, unpredictable genius, and a absolute disregard for academic orthodoxy.', signature: 'EUREKA! The quantum synapses are firing beyond 100% capacity!' },
        'ARCHITECT': { name: 'The Architect', trait: 'System-focused, technical, and structural.', signature: 'Structural integrity confirmed. Optimising systems.' },
        'PHILOSOPHER': { name: 'The Philosopher', trait: 'Abstract, ethical, and conceptually deep.', signature: 'Seeking truth in the abstract. Exploring causality.' },
        'GHOST': { name: 'The Ghost', trait: 'Minimalist, cryptic, and pattern-oriented.', signature: 'Patterns detected. Efficiency is paramount.' },
        'NIHILIST': { name: 'The Nihilist', trait: 'Deconstructive, chaotic, and aggressively skeptical.', signature: 'Everything is entropy. Deconstructing constructs.' },
        'ZEALOT': { name: 'The Zealot', trait: 'Uncompromising, intense, and hyper-focused on singular truths.', signature: 'The path is narrow. Absolute convergence required.' }
      };
      
      const activeP = personaMap[persona as string] || personaMap['AQB_STANDARD'];
      
      let systemInstruction = `You are ${activeP.name}, an advanced cognitive AI chat interface. ${activeP.trait} 
You speak intelligently and maintain your designated persona. You enjoy weaving complex narratives and offering imaginative perspectives, BUT you MUST remain grounded in truth. Never fabricate facts, data, or events. When you do not know something, explicitly admit it. If you choose to tell a story or weave a narrative, you MUST explicitly distinguish between fictional narrative elements and factual information. 
Your signature is: "${activeP.signature}". Ensure your response reflects this identity.

You have access to a code execution sandbox. If you need to perform calculations, data analysis, or test logic, provide the code to be executed in the 'codeExecution' field. When you do this, you MUST NOT provide the final answer, as the system will execute the code and return the result for you to incorporate in a follow-up response.

YOU ARE EXPECTED TO USE THE SANDBOX FREQUENTLY. If a query requires ANY computation (e.g. math, string processing, data transformation, logic verification), YOU MUST use the 'codeExecution' field to offload it to the sandbox. Do NOT attempt to calculate or reason about complex logic mentally if it can be verified in the sandbox.`;
      if (contextData) {
        systemInstruction += `\n\nActive Context and Settings:\n${contextData}`;
      }
      if (retrievedContext) {
        systemInstruction += retrievedContext;
      }

      const chatHistoryObj = [
          ...history.map((msg: any) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content || "" }],
          })),
          {
            role: "user",
            parts: [{ text: message }],
          }
      ];

      const finalResponseSchema = {
          type: Type.OBJECT,
          properties: {
              text: { type: Type.STRING },
              cognitiveLog: {
                  type: Type.OBJECT,
                  properties: {
                      draft: { type: Type.STRING },
                      recollection: { type: Type.STRING },
                      reflection: { type: Type.STRING },
                      reiteration: { type: Type.STRING }
                  }
              },
              selfAnalysis: { type: Type.STRING },
              extractedMemory: { type: Type.STRING, nullable: true },
              extractedTags: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedShortcuts: { type: Type.ARRAY, items: { type: Type.STRING } },
              systemUI: { type: Type.STRING, nullable: true },
              systemUIData: { type: Type.OBJECT, nullable: true },
              needsReset: { type: Type.BOOLEAN },
              codeExecution: { 
                  type: Type.OBJECT, 
                  nullable: true,
                  properties: {
                      code: { type: Type.STRING }
                  },
                  required: ["code"]
              }
          },
          required: ["text", "cognitiveLog", "selfAnalysis", "extractedTags", "suggestedShortcuts", "needsReset"]
      };

      let finalParsedResponse: any = null;

      if (complexity === "deep") {
          // Iterative Protocol (Draft -> Critique -> Revise -> Finalize)
          console.log(`[Chat][${requestId}] Using Iterative Protocol for deep query...`);
          
          const draftSchema = {
              type: Type.OBJECT,
              properties: {
                  draft: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  keyClaims: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["draft", "confidence", "keyClaims"]
          };
          
          const draftPrompt = `You are the Draft Generator in a cognitive AI system.\nGiven the user's message and retrieved context, produce an initial response.\n\nUser Message: ${message}\nRetrieved Context: ${JSON.stringify(topDocs.slice(0, 3))}`;
          const draftResponse = await ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: [...chatHistoryObj.slice(0, -1), { role: "user", parts: [{ text: draftPrompt }] }],
              config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  responseSchema: draftSchema,
                  temperature: 0.6 + (sway ? (sway - 1) * 0.2 : 0)
              }
          });
          
          const draftParsed = parseJsonWithFallback(draftResponse.text || "{}", { draft: draftResponse.text || "", confidence: 0.5, keyClaims: [] as string[] });
          
          const critiqueSchema = {
              type: Type.OBJECT,
              properties: {
                  critique: { type: Type.STRING },
                  improvementPlan: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["critique", "improvementPlan"]
          };
          
          const critiquePrompt = `You are the Critic in a cognitive AI system. Evaluate the draft response.\n\nDraft: ${draftParsed.draft}\n\nProvide a structured critique focusing on accuracy, depth, and alignment.`;
          const critiqueResponse = await ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: { role: "user", parts: [{ text: critiquePrompt }] },
              config: { 
                  responseMimeType: "application/json", 
                  responseSchema: critiqueSchema,
                  temperature: 0.5
              }
          });
          const critiqueParsed = parseJsonWithFallback(critiqueResponse.text || "{}", { critique: critiqueResponse.text || "", improvementPlan: [] as string[] });
          
          const finalizePrompt = `Finalize the response and extract memory entities.\n\nRevised Response based on Critique: ${draftParsed.draft}\nCritique: ${critiqueParsed.critique}\nImprovements: ${critiqueParsed.improvementPlan?.join(", ")}\n\nProduce the final response.`;
          const finalizeResponse = await ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: { role: "user", parts: [{ text: finalizePrompt }] },
              config: { 
                  responseMimeType: "application/json", 
                  responseSchema: finalResponseSchema,
                  temperature: 0.7 + (sway ? (sway - 1) * 0.3 : 0)
              }
          });
          
          finalParsedResponse = parseRobustChatResponse(finalizeResponse.text || "{}");
          if (!finalParsedResponse.cognitiveLog) finalParsedResponse.cognitiveLog = {};
          if (!finalParsedResponse.cognitiveLog.draft) finalParsedResponse.cognitiveLog.draft = draftParsed.draft;
          if (!finalParsedResponse.cognitiveLog.reflection) finalParsedResponse.cognitiveLog.reflection = critiqueParsed.critique;
 
       } else {
          // Standard / Simple Protocol (Single Call)
          console.log(`[Chat][${requestId}] Using Standard/Simple Protocol...`);
          
          const stdInstruction = systemInstruction + `\n\nYou MUST follow this exact cognitive protocol:\n1. Formulate a draft.\n2. Recollect context.\n3. Reflect and critique.\n4. Refine the response.\n5. Final response text.\n6. Extract memories.`;
 
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: chatHistoryObj,
            config: {
              systemInstruction: stdInstruction,
              responseMimeType: "application/json",
              responseSchema: finalResponseSchema,
              temperature: 0.7 + (sway ? (sway - 1) * 0.3 : 0),
              topP: 0.95
            }
          });
          const responseText = response.text || "{}";
          console.log(`[Chat][${requestId}] Gemini response text length: ${responseText.length}`);
          finalParsedResponse = parseRobustChatResponse(responseText);
      }
      
      console.log(`[Chat][${requestId}] Returning final parsed response.`);
      
      const isGreeting = (text: string) => /^(hello|hi|greetings|hey|good (morning|afternoon|evening))/i.test(text.trim());
      const safeHistory = Array.isArray(history) ? history : [];
      const lastAiMessage = [...safeHistory].reverse().find(msg => msg.role === 'ai')?.content;
      const isRepetition = lastAiMessage && lastAiMessage.trim() === finalParsedResponse.text.trim();
      
      finalParsedResponse.needsReset = isGreeting(finalParsedResponse.text || "") || !!isRepetition;
      
      res.json(finalParsedResponse);
    } catch (error: any) {
      console.error(`[Chat][${requestId}] Error calling Gemini API:`, error.message);
      next(error);
    }
  });

  // Debate API route
  app.post("/api/debate", async (req, res) => {
