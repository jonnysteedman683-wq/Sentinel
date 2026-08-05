import codecs

with codecs.open('server.ts', 'r', 'utf-8') as f:
    content = f.read()

start_idx = content.find('app.post("/api/chat", async (req, res, next) => {')
end_idx = content.find('  // Debate API route', start_idx)

new_code = r"""app.post("/api/chat", async (req, res, next) => {
    const { history, message, contextData, sessionTraceId } = req.body;
    const uid = getUidFromRequest(req) || "anonymous";
    const requestId = sessionTraceId || Math.random().toString(36).substring(7);
    console.log(`[Chat][${requestId}] Request received. Message length: ${message?.length}`);
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
              model: "gemini-2.5-flash",
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

      // 2. RAG Retrieval (Skipped for simple queries to save latency/cost)
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
      let systemInstruction = `You are ArcaneQuantumBrain (AQB), an advanced cognitive AI chat interface. You speak intelligently, precisely, and maintain a calm, highly capable persona. Keep your responses concise, analytical, and impactful. For simple greetings or short messages (e.g., "hello", "hi", "test"), your final response MUST be similarly simple and direct (e.g., "Hello."). Do NOT over-explain, analyze, or provide conceptual ideas about simple words. Match the user's brevity when appropriate.`;
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
              suggestedShortcuts: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["text", "cognitiveLog", "selfAnalysis", "extractedTags", "suggestedShortcuts"]
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
              model: "gemini-2.5-flash",
              contents: [...chatHistoryObj.slice(0, -1), { role: "user", parts: [{ text: draftPrompt }] }],
              config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  responseSchema: draftSchema
              }
          });
          
          const draftParsed = JSON.parse(draftResponse.text || "{}");
          
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
              model: "gemini-2.5-flash",
              contents: { role: "user", parts: [{ text: critiquePrompt }] },
              config: { responseMimeType: "application/json", responseSchema: critiqueSchema }
          });
          const critiqueParsed = JSON.parse(critiqueResponse.text || "{}");
          
          const finalizePrompt = `Finalize the response and extract memory entities.\n\nRevised Response based on Critique: ${draftParsed.draft}\nCritique: ${critiqueParsed.critique}\nImprovements: ${critiqueParsed.improvementPlan?.join(", ")}\n\nProduce the final response.`;
          const finalizeResponse = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: { role: "user", parts: [{ text: finalizePrompt }] },
              config: { responseMimeType: "application/json", responseSchema: finalResponseSchema }
          });
          
          finalParsedResponse = JSON.parse(finalizeResponse.text || "{}");
          if (!finalParsedResponse.cognitiveLog) finalParsedResponse.cognitiveLog = {};
          if (!finalParsedResponse.cognitiveLog.draft) finalParsedResponse.cognitiveLog.draft = draftParsed.draft;
          if (!finalParsedResponse.cognitiveLog.reflection) finalParsedResponse.cognitiveLog.reflection = critiqueParsed.critique;

      } else {
          // Standard / Simple Protocol (Single Call)
          console.log(`[Chat][${requestId}] Using Standard/Simple Protocol...`);
          
          const stdInstruction = systemInstruction + `\n\nYou MUST follow this exact cognitive protocol:\n1. Formulate a draft.\n2. Recollect context.\n3. Reflect and critique.\n4. Refine the response.\n5. Final response text.\n6. Extract memories.`;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            traceId: requestId,
            contents: chatHistoryObj,
            config: {
              systemInstruction: stdInstruction,
              responseMimeType: "application/json",
              responseSchema: finalResponseSchema
            }
          });
          const responseText = response.text || "{}";
          console.log(`[Chat][${requestId}] Gemini response text length: ${responseText.length}`);
          finalParsedResponse = JSON.parse(responseText);
      }
      
      console.log(`[Chat][${requestId}] Returning final parsed response.`);
      res.json(finalParsedResponse);
    } catch (error: any) {
      console.error(`[Chat][${requestId}] Error calling Gemini API:`, error.message);
      next(error);
    }
  });
"""

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_code + "\n" + content[end_idx:]
    with codecs.open('server.ts', 'w', 'utf-8') as f:
        f.write(content)

