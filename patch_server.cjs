const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const importStatement = `import { runQuantumDistillation } from './src/lib/distillation.js';\n`;
if (!content.includes('import { runQuantumDistillation }')) {
  content = content.replace(`import { dbShim as db } from "./src/lib/firestore-shim.js";`, `import { dbShim as db } from "./src/lib/firestore-shim.js";\n${importStatement}`);
}

const endpoint = `  app.post("/api/knowledge/distill", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const token = authHeader.split('Bearer ')[1];
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      const userId = decodedToken.uid;
      
      const result = await runQuantumDistillation(userId);
      res.json(result);
    } catch (error: any) {
      console.error('Distillation error:', error);
      res.status(500).json({ error: error.message });
    }
  });
`;

if (!content.includes('/api/knowledge/distill')) {
  content = content.replace(`  app.post("/api/knowledge/erd", async (req, res) => {`, `${endpoint}\n  app.post("/api/knowledge/erd", async (req, res) => {`);
}

fs.writeFileSync('server.ts', content);
