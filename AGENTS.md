# AQB System Directives

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

## 4. Node.js & React 19 Build Environments
- **Peer Dependency Conflicts:** When creating or modifying CI/CD pipelines (e.g., GitHub Actions) or `Dockerfile`s for projects using React 19 alongside older ecosystem packages (like `lucide-react`), you MUST append `--legacy-peer-deps` to all `npm ci` and `npm install` commands to prevent strict peer dependency resolution failures.
