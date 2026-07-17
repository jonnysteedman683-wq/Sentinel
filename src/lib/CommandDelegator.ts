/**
 * @file CommandDelegator.ts
 * @description Robust client-side command delegation module for the ArcaneQuantumBrain neural interface.
 * Parses and executes visual diagnostic commands and re-routes flows in case of API anomalies.
 */

export type CognitionDepth = 'Fast' | 'Balanced' | 'Deep Reasoning';

/**
 * Result returned by executing a slash command.
 * 
 * @interface CommandResult
 * @property {boolean} handled - Indicates if the input was handled as a command.
 * @property {string} [content] - Text content of the response.
 * @property {string} [systemUI] - Key indicating a specific custom system visual component to render.
 * @property {any} [systemUIData] - Context data to pass to the custom system component.
 */
export interface CommandResult {
  handled: boolean;
  content?: string;
  systemUI?: 'help' | 'vitals' | 'logs' | 'diagnose' | 'reboot' | 'persona' | 'qpu-erd';
  systemUIData?: any;
}

/**
 * Execution context provided to commands at runtime.
 * 
 * @interface CommandContext
 * @property {string} uid - Authenticated user identifier.
 * @property {any} db - Firestore database instance.
 * @property {any} auth - Firebase Auth instance.
 * @property {any} vitals - Current real-time vitals.
 * @property {any[]} systemLogs - Read-only list of system logs.
 * @property {any[]} memories - Active memory registry list.
 * @property {(depth: string) => void} setDepth - State updater for depth.
 * @property {(persona: any) => void} setActivePersona - State updater for persona.
 * @property {() => Promise<void>} handleManualConsolidate - Callback to trigger consolidation.
 * @property {() => Promise<void>} clearChat - Callback to reset chat history.
 * @property {() => void} triggerNudge - Callback to fire active RL nudge.
 * @property {(msg: string, level?: 'INFO' | 'WARN' | 'ERROR' | 'NEURAL' | 'CRITICAL', source?: string) => void} addLog - System log writer.
 */
export interface CommandContext {
  uid: string;
  db: any;
  auth: any;
  vitals: any;
  systemLogs: any[];
  memories: any[];
  setDepth: (depth: CognitionDepth) => void;
  setActivePersona: (persona: any) => void;
  handleManualConsolidate: () => Promise<void>;
  clearChat: () => Promise<void>;
  triggerNudge: () => void;
  addLog: (msg: string, level?: 'INFO' | 'WARN' | 'ERROR' | 'NEURAL' | 'CRITICAL', source?: string) => void;
}

/**
 * Parses and delegates inputs starting with "/" to their respective routines.
 * 
 * @param {string} input - The raw string inputted by the user.
 * @param {CommandContext} context - The runtime execution context.
 * @returns {Promise<CommandResult>} - The resolved command result.
 * @throws {Error} - When command execution fails.
 * @example
 * const result = await handleSlashCommand("/vitals", context);
 */
export async function handleSlashCommand(input: string, context: CommandContext): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return { handled: false };
  }

  const parts = trimmed.split(/\s+/);
  const commandName = parts[0].substring(1).toLowerCase();
  const args = parts.slice(1);

  context.addLog(`Delegating command: /${commandName} ${args.join(' ')}`, 'NEURAL', 'DELEGATOR');

  switch (commandName) {
    case 'help': {
      return {
        handled: true,
        content: "Initializing Neural Interface Command Index...",
        systemUI: 'help',
        systemUIData: {
          commands: [
            { cmd: '/help', desc: 'Display this command directory.' },
            { cmd: '/vitals', desc: 'Acquire real-time engine health and system metrics.' },
            { cmd: '/persona <name>', desc: 'Hot-swap active persona. (e.g. /persona AQB_STANDARD)' },
            { cmd: '/depth <mode>', desc: 'Configure cognition speed. (e.g. /depth Fast, Balanced, "Deep Reasoning")' },
            { cmd: '/diagnose', desc: 'Run comprehensive connection, database, and API integrity checks.' },
            { cmd: '/logs <count>', desc: 'Fetch latest system log entries directly inside the interface.' },
            { cmd: '/consolidate', desc: 'Initiate manual memory consolidation routines.' },
            { cmd: '/nudge', desc: 'Request immediate proactive RL feedback nudge.' },
            { cmd: '/reboot', desc: 'Perform system-wide diagnostics, self-heal, and clear volatile caches.' },
            { cmd: '/erd <text>', desc: 'Perform QPU Entity Recognition and Disambiguation (Biomedical/General).' },
            { cmd: '/debug', desc: 'Open the Neural Debugger and Trace Viewer.' },
            { cmd: '/memoria', desc: 'Access the high-density Memoria analytics dashboard.' },
            { cmd: '/clear', desc: 'Purge active chat session logs.' }
          ]
        }
      };
    }

    case 'debug': {
      context.addLog("Navigating to Neural Debugger interface...", "NEURAL", "SYSTEM");
      // Use a special return that App.tsx can catch to change tab
      return {
        handled: true,
        content: "Entering the Neural Debugger. Analyzing active traces and circuit states...",
        systemUI: 'help', // Placeholder, we will catch the 'debug' intent in App.tsx if needed, but for now we just log it and the user can see it's intended
        systemUIData: { intent: 'NAVIGATE_DEBUG' }
      };
    }

    case 'memoria': {
      context.addLog("Navigating to Memoria analytics dashboard...", "NEURAL", "SYSTEM");
      return {
        handled: true,
        content: "Accessing the Memoria vault. Synchronizing long-term semantic records...",
        systemUIData: { intent: 'NAVIGATE_MEMORIA' }
      };
    }

    case 'vitals':
    case 'status': {
      return {
        handled: true,
        content: "Acquiring core cognitive vitals metrics...",
        systemUI: 'vitals',
        systemUIData: {
          vitals: context.vitals,
          memoryCount: context.memories.length,
          logCount: context.systemLogs.length
        }
      };
    }

    case 'persona': {
      if (args.length === 0) {
        return {
          handled: true,
          content: "Command requires an argument. Usage: `/persona <AQB_STANDARD>`"
        };
      }
      const requested = args[0].toUpperCase();
      return {
        handled: true,
        content: `Hot-swapping active core persona state...`,
        systemUIData: { requestedPersona: requested }
      };
    }

    case 'depth': {
      if (args.length === 0) {
        return {
          handled: true,
          content: "Command requires an argument. Usage: `/depth <Fast | Balanced | \"Deep Reasoning\">`"
        };
      }
      const rawDepth = args.join(' ').toLowerCase();
      let selectedDepth: CognitionDepth = 'Balanced';
      if (rawDepth.includes('fast')) selectedDepth = 'Fast';
      else if (rawDepth.includes('reasoning') || rawDepth.includes('deep')) selectedDepth = 'Deep Reasoning';
      else selectedDepth = 'Balanced';

      context.setDepth(selectedDepth);
      context.addLog(`Cognition depth configured to ${selectedDepth}`, 'INFO', 'SYSTEM');
      return {
        handled: true,
        content: `Cognitive path configured to **${selectedDepth}**.`
      };
    }

    case 'logs': {
      const count = args[0] ? parseInt(args[0], 10) : 10;
      const slicedLogs = context.systemLogs.slice(0, Math.min(count, 50));
      return {
        handled: true,
        content: `Acquiring latest system logs (limit: ${count})...`,
        systemUI: 'logs',
        systemUIData: { logs: slicedLogs }
      };
    }

    case 'consolidate': {
      context.addLog("Manual trigger: Consolidation protocol initiated", "WARN", "NEURAL");
      try {
        await context.handleManualConsolidate();
        return {
          handled: true,
          content: "⚡ **Consolidation cycle completed successfully.** Memory registry is defragmented and stabilized."
        };
      } catch (err: any) {
        context.addLog(`Consolidation failed: ${err.message}`, "ERROR", "NEURAL");
        return {
          handled: true,
          content: `❌ **Consolidation anomaly:** ${err.message}`
        };
      }
    }

    case 'nudge': {
      context.addLog("Manual trigger: Active RL Nudge selected", "INFO", "NEURAL");
      context.triggerNudge();
      return {
        handled: true,
        content: "⚡ **Synaptic nudge fired.** Requesting proactive active-inference evaluation."
      };
    }

    case 'clear': {
      context.addLog("Manual trigger: Resetting dialogue records", "WARN", "SYSTEM");
      await context.clearChat();
      return {
        handled: true,
        content: "🧹 **Core dialogue records cleared successfully.**"
      };
    }

    case 'erd': {
      const text = args.join(' ');
      if (!text) {
        return {
          handled: true,
          content: "⚠️ **Missing text argument.** Usage: `/erd <text>`."
        };
      }
      context.addLog("Executing QPU-based ERD semantic parsing...", "NEURAL", "DIAGNOSTIC");
      return {
        handled: true,
        content: `Initiating Entity Recognition and Disambiguation for: "${text}"`,
        systemUI: 'qpu-erd',
        systemUIData: { text }
      };
    }

    case 'diagnose': {
      context.addLog("Initiating self-healing network & diagnostic tests...", "WARN", "DIAGNOSTIC");
      return {
        handled: true,
        content: "Running full stack diagnostic suite...",
        systemUI: 'diagnose',
        systemUIData: {
          timestamp: Date.now()
        }
      };
    }

    case 'reboot': {
      context.addLog("Full system reboot command initiated.", "CRITICAL", "SYSTEM");
      return {
        handled: true,
        content: "Performing cold re-synchronization of the cognitive engine...",
        systemUI: 'reboot',
        systemUIData: {
          timestamp: Date.now()
        }
      };
    }

    default: {
      return {
        handled: true,
        content: `⚠️ **Command unrecognized:** \`/${commandName}\`. Type \`/help\` for a directory of valid instructions.`
      };
    }
  }
}
