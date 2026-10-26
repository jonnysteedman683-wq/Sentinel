import { getAi } from './ai-service.js';

export type SwarmAgentRole = 'Architect' | 'Critic' | 'Coder' | 'Tester' | 'Philosopher';

export interface SwarmMessage {
  id: string;
  role: SwarmAgentRole | 'System';
  content: string;
  timestamp: number;
}

export interface SwarmState {
  taskId: string;
  taskDescription: string;
  status: 'initializing' | 'brainstorming' | 'drafting' | 'refining' | 'finalizing' | 'completed';
  scratchpad: string;
  messages: SwarmMessage[];
  activeAgent: SwarmAgentRole | null;
}

const AGENT_PROMPTS: Record<SwarmAgentRole, string> = {
  Architect: "You are the Architect. Design the high-level structure and algorithms. Provide clear blueprints. Do not write implementation code yet.",
  Philosopher: "You are the Philosopher. Question the underlying assumptions, ethical implications, and broader impact of the solution. Guide the overarching vision.",
  Coder: "You are the Coder. Write the actual implementation code based on the Architect's blueprints and the Philosopher's vision.",
  Tester: "You are the Tester. Find edge cases, bugs, and security vulnerabilities in the Coder's implementation or the Architect's design.",
  Critic: "You are the Critic. You challenge the group's decisions. Play devil's advocate. Ensure the final output is robust, optimal, and elegant."
};

export class AgenticSwarm {
  public state: SwarmState;
  private onStateUpdate: (state: SwarmState) => void;

  constructor(taskId: string, taskDescription: string, onStateUpdate: (state: SwarmState) => void) {
    this.state = {
      taskId,
      taskDescription,
      status: 'initializing',
      scratchpad: "Initial Task: " + taskDescription,
      messages: [],
      activeAgent: null
    };
    this.onStateUpdate = onStateUpdate;
  }

  private broadcast(role: SwarmAgentRole | 'System', content: string) {
    this.state.messages.push({
      id: Math.random().toString(36).substring(2, 9),
      role,
      content,
      timestamp: Date.now()
    });
    this.onStateUpdate(this.state);
  }

  private async activateAgent(role: SwarmAgentRole, instruction: string) {
    this.state.activeAgent = role;
    this.onStateUpdate(this.state);

    try {
      const ai = getAi();
      const prompt = `${AGENT_PROMPTS[role]}
      
Task: ${this.state.taskDescription}

Current Scratchpad:
${this.state.scratchpad}

Recent Discussion:
${this.state.messages.slice(-5).map(m => `[${m.role}]: ${m.content}`).join('\n')}

Instruction: ${instruction}

Respond with your thoughts and contribution. If you want to update the scratchpad, enclose the NEW complete scratchpad content within <SCRATCHPAD>...</SCRATCHPAD> tags.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-pro",
        contents: prompt,
        config: { temperature: 0.7 }
      });

      const text = response.text || "";
      let publicMessage = text;

      // Extract scratchpad update if present
      const scratchpadMatch = text.match(/<SCRATCHPAD>([\s\S]*?)<\/SCRATCHPAD>/i);
      if (scratchpadMatch) {
        this.state.scratchpad = scratchpadMatch[1].trim();
        publicMessage = text.replace(/<SCRATCHPAD>([\s\S]*?)<\/SCRATCHPAD>/i, '').trim();
      }

      this.broadcast(role, publicMessage);
    } catch (e: any) {
      this.broadcast('System', `Agent ${role} encountered an error: ${e.message}`);
    } finally {
      this.state.activeAgent = null;
      this.onStateUpdate(this.state);
    }
  }

  public async runSwarmSequence() {
    this.state.status = 'brainstorming';
    this.broadcast('System', 'Swarm initiated. Brainstorming phase commencing.');
    
    await this.activateAgent('Philosopher', 'Analyze the core intent and implications of the task.');
    await this.activateAgent('Architect', 'Propose a high-level design to solve the task.');
    
    this.state.status = 'drafting';
    this.broadcast('System', 'Transitioning to drafting phase.');
    
    await this.activateAgent('Coder', 'Implement the first draft based on the Architect\'s design. Update the scratchpad with the code.');
    
    this.state.status = 'refining';
    this.broadcast('System', 'Transitioning to refining phase.');
    
    await this.activateAgent('Tester', 'Analyze the Coder\'s draft in the scratchpad for bugs or edge cases.');
    await this.activateAgent('Critic', 'Critique the overall solution. Is it elegant? What can be better?');
    await this.activateAgent('Coder', 'Refine the implementation in the scratchpad based on feedback from the Tester and Critic.');
    
    this.state.status = 'finalizing';
    this.broadcast('System', 'Finalizing output.');
    
    await this.activateAgent('Architect', 'Review the final scratchpad. Provide a concluding summary.');
    
    this.state.status = 'completed';
    this.broadcast('System', 'Swarm execution completed.');
    this.onStateUpdate(this.state);
  }
}
