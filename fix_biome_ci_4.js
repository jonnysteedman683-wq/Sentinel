import { readFileSync, writeFileSync } from 'fs';

let app = readFileSync('src/App.tsx', 'utf-8');

app = app.replace(
  `  // biome-ignore lint/correctness/useExhaustiveDependencies: needed behavior
  }, [
    user,`,
  `  }, [
    user,`
);
app = app.replace(
  `    sendDebate,
    setMessages,`,
  `    sendDebate,
    // biome-ignore lint/correctness/useExhaustiveDependencies: needed behavior
    setMessages,`
);
writeFileSync('src/App.tsx', app);
