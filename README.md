# Arcane Quantum Brain 🧠✨

Arcane Quantum Brain is an experimental, next-generation neural interface and memory consolidation engine. Designed to simulate cognitive processes, it acts as an intelligent knowledge graph that autonomously organizes thoughts, visualizes semantic clusters, and surfaces insights using simulated reinforcement learning (RL) and autonomous background processing.

## 🌟 Key Features

- **Neural Memory Consolidation (REM Sleep)**: The system monitors user activity and, during periods of inactivity, enters a "Dreaming" phase. It autonomously synthesizes raw memories into structured insight clusters.
- **Reinforcement Learning (RL) Engine**: A proactive agent that tracks sentiment drift and Q-value convergence to suggest memory nudges, creative insights, and proactive consolidation proposals.
- **Telemetry Dashboard & Real-Time Visualization**: Monitor the health of the "brain" in real-time, including metrics like Memory Formation rates, Policy Convergence, and Semantic Density using dynamic charts.
- **Interactive Knowledge Graphs**: Visualize interconnected thoughts and data points through an interactive Mind Map.
- **Auto Debugger**: An integrated neural event stream that monitors system logs, alerts, and critical anomalies in real-time.
- **Cognitive Sculpting**: Advanced workspace for direct integration with the agent's logic modules.
- **Dark/Light Themes**: A heavily stylized, premium user interface built with aesthetic precision.

## 🛠️ Tech Stack

- **Framework**: [React 18](https://reactjs.org/) & [Vite](https://vitejs.dev/)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Motion (Framer)](https://motion.dev/)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend / DB**: [Firebase Firestore](https://firebase.google.com/products/firestore)

## 📁 Project Structure

```text
/src
├── components/          # Modular UI components (MindMap, TelemetryDashboard, AutoDebugger, BrainsTab, etc.)
├── lib/                 # Core engine logic (RL-agent, API utilities)
├── types.ts             # Global TypeScript interfaces (SystemLog, Memory, etc.)
├── App.tsx              # Main application orchestrator and neural layout
└── index.css            # Global Tailwind styling
```

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/arcane-quantum-brain.git
   cd arcane-quantum-brain
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Copy `.env.example` to `.env` and fill in your Firebase configuration and any necessary API keys.

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000` to interact with your neural engine.

## 🧠 Core Philosophy

Arcane Quantum Brain was built on the principle of *Architectural Honesty* combined with *Cognitive Simulation*. It goes beyond standard note-taking by mimicking how the human brain actually processes information: taking raw inputs, drawing connections while idle, and surfacing those connections precisely when relevant.

---
*Crafted with precision.*
