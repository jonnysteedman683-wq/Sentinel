# Base Architect Directives

## 1. Stability Mandate
- **Zero-Regression Policy:** The current architecture (comprising the QPU-ERD integrations, MAML/RML modules, and cognitive agents) is in a profound, stable state. Do not jeopardize this.
- **Surgical Edits Only:** Do not perform large-scale refactors of `App.tsx` or `server.ts`. All modifications must be strictly additive, isolated, and non-destructive.

## 2. Knowledge Graph & ERD Architecture
- The `/api/knowledge/erd` endpoint is precisely tuned for biomedical, gene function, disease pathway, and quantum meta-learning contexts.
- Prompting instructions emphasize: precise object recognition, highly specific concepts, and extraction via action-oriented verbs. Do not alter these prompts without explicit user consent.

## 3. Future-Proofing Guidelines
- Prioritize strict TypeScript interfaces for any new data structures.
- Ensure all API endpoints implement graceful degradation to prevent cascading failures.
- Keep new components modularized to prevent further monolithic bloat in core files.

## 4. Manifest Protocol
- **Machine-Readable Manifest:** Whenever generating or updating files, you MUST emit a JSON manifest alongside your code block artifacts. 
- The manifest must be enclosed in a \`\`\`json\`\`\` block and include the files created/modified, their exported interfaces/functions, and any external dependencies.

## 5. Test Contract
- **Vitest Spec Requirement:** Mandate a Vitest spec file per ML module with fixed-seed numerical assertions. This turns the quality gate from a self-check into enforceable output.
