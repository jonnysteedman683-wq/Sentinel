const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

// The unused imports are from lucide-react mostly, or local imports.
app = app.replace(/import \{ MemoryChart \} from "\.\/components\/MemoryChart";\n/, '');
app = app.replace(/import \{ formatTimeAgo \} from "\.\/lib\/utils";\n/, '');

app = app.replace(/Plus, /, '');
app = app.replace(/Pin, /, '');
app = app.replace(/Loader2, /, '');
app = app.replace(/CheckSquare, /, '');
app = app.replace(/Square, /, '');
app = app.replace(/ChevronDown, /, '');
app = app.replace(/LayoutList, /, '');
app = app.replace(/Clock, /, '');
// Wait, LayoutList, Clock etc were in MemoryTab.tsx. Let's fix MemoryTab.tsx unused imports.

let memTab = fs.readFileSync('src/components/tabs/MemoryTab.tsx', 'utf8');
memTab = memTab.replace(/LayoutList, /, '');
memTab = memTab.replace(/Clock, /, '');
memTab = memTab.replace(/Activity, /, '');
memTab = memTab.replace(/Tag, /, '');
memTab = memTab.replace(/X, /, '');
memTab = memTab.replace(/ThermometerSnowflake, /, '');
fs.writeFileSync('src/components/tabs/MemoryTab.tsx', memTab);
fs.writeFileSync('src/App.tsx', app);
