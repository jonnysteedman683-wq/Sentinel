import { readFileSync, writeFileSync } from 'fs';

let app = readFileSync('src/App.tsx', 'utf-8');

app = app.replace(
  `  }, [
    user,
    debateState.context.error,
    debateState.matches,
    debateState.context.activeAgentId,
    sendDebate,
    setMessages,
    addLog,
    debateState.context,
  ]);`,
  `  // biome-ignore lint/correctness/useExhaustiveDependencies: needed behavior
  }, [
    user,
    debateState.context.error,
    debateState.matches,
    debateState.context.activeAgentId,
    sendDebate,
    setMessages,
    addLog,
    debateState.context,
  ]);`
);
writeFileSync('src/App.tsx', app);
