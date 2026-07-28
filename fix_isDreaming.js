import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/App.tsx', 'utf-8');

// The error is `Cannot access 'isDreaming' before initialization`.
// Let's find where `const [isDreaming, setIsDreaming] = useState(false);` is located.
// It is at line 708.
// And it's used at line 523 and 554 in some hooks (probably useEffect or useCallback) which are defined *before* the state.
// We must move `const [isDreaming, setIsDreaming] = useState(false);` UP before it is used.
// Let's move all standard states up. Wait, why was it moved down?
// Did we accidentally move it when sorting imports? No.

const lines = content.split('\n');

const isDreamingStateIndex = lines.findIndex(l => l.includes('const [isDreaming, setIsDreaming] = useState(false);'));

const isDreamingCode = lines[isDreamingStateIndex];

// Remove it from its current position
lines.splice(isDreamingStateIndex, 1);

// Find a good place to insert it. e.g. after `const [modelState, setModelState] = useState<ModelState>('Idle');`
const insertIndex = lines.findIndex(l => l.includes('const [modelState, setModelState] = useState<ModelState>(\'Idle\');'));

if (insertIndex !== -1) {
    lines.splice(insertIndex + 1, 0, isDreamingCode);
} else {
    // Just find the start of the component `export default function MainApp()`
    const compIndex = lines.findIndex(l => l.includes('export default function MainApp()'));
    lines.splice(compIndex + 1, 0, isDreamingCode);
}

writeFileSync('src/App.tsx', lines.join('\n'));
console.log('Moved isDreaming state declaration up.');
