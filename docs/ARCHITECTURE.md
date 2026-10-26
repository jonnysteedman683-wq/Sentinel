# Sentinel Architecture

## System Overview

Sentinel (package: `arcane-quantum-brain`) is a neural memory consolidation engine with reinforcement learning, dreaming, and swarm intelligence capabilities. It runs as a full-stack TypeScript application with a React frontend and Express server.

```
┌─────────────────────────────────────────────────┐
│                  Frontend (React + Vite)          │
│                                                   │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ Chat UI │  │ Memory    │  │ RL Agent        │  │
│  │         │  │ Engine    │  │ (CuriousAgent)  │  │
│  └────┬────┘  └────┬─────┘  └────┬────────────┘  │
│       │            │              │                │
│  ┌────┴────────────┴──────────────┴────────────┐  │
│  │           TF.js Neural Networks               │  │
│  │  DQN │ Encoder │ Inverse Model │ Forward     │  │
│  └───────────────────────────────────────────────┘  │
│                     │                              │
│  ┌──────────────────┴───────────────────────────┐ │
│  │  Voice Bridge (Web Speech API + ElevenLabs)   │ │
│  └───────────────────────────────────────────────┘ │
└────────────────────────┬──────────────────────────┘
                         │
┌────────────────────────┴──────────────────────────┐
│              Backend (Express + Firebase)          │
│                                                    │
│  ┌──────────┐  ┌───────────┐  ┌────────────────┐   │
│  │ Firestore│  │ Auth      │  │ Voice Gateway  │   │
│  │ (data)   │  │ (anon)    │  │ (Gemini Live)  │   │
│  └──────────┘  └───────────┘  └────────────────┘   │
└────────────────────────────────────────────────────┘
```

## Key Modules

### Reinforcement Learning
- **`src/lib/tf-rl-core.ts`** — TF.js neural networks (QNetwork, Encoder, InverseModel, ForwardModel)
- **`src/lib/rl-agent.ts`** — CuriousAgent with DQN + ICM training loop
- **`src/lib/options.ts`** — Hierarchical RL options (macro-actions)
- **`src/lib/active-inference.ts`** — Active inference planner (alternative to DQN)
- **`src/lib/world-model.ts`** — World model for active inference
- **`src/lib/preferences.ts`** — User preference manager

### Memory & Cognition
- **`src/lib/api.ts`** — API layer for memory operations, insights, telemetry
- **`src/lib/swarm-engine.ts`** — Swarm intelligence for multi-agent task decomposition
- **`src/components/MindMap.tsx`** — 3D mind map visualization (d3 + three.js)

### Voice
- **`src/components/VoiceBridge.tsx`** — Speech recognition (STT) + text-to-speech (TTS) with VAD
- **`src/lib/voice-gateway.ts`** — WebSocket proxy for Gemini Live API
- **`src/lib/elevenlabs-tts.ts`** — ElevenLabs TTS integration for natural voices

### Infrastructure
- **`vite.config.ts`** — Vite 8 with Rolldown, manualChunks vendor splitting
- **`src/firebase.ts`** — Firebase initialization (auth + Firestore)
- **`server.ts`** — Express server with voice gateway
- **`src/lib/otel-bridge.ts`** — OpenTelemetry tracing

## Code Splitting

Tab-specific components are lazy-loaded via `React.lazy` + `Suspense`:
- Initial bundle (Chat tab): ~654 kB gzipped
- Heavy libs (three.js, recharts, d3) load only when their tab is opened
- Vendor libraries split into separate chunks via Vite manualChunks

## Build & Test

```bash
npm run build     # Vite build + esbuild server bundling
npm test          # Vitest (6 tests, jsdom environment)
npx tsc --noEmit  # Type checking
```
