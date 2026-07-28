import { readFileSync, writeFileSync } from 'fs';

// Let's run a dumb regex on App.tsx to change `<button\n` to `<button type="button"\n` if it's missing type="button"
let appContent = readFileSync('src/App.tsx', 'utf-8');

appContent = appContent.replace(/<button\n/g, '<button type="button"\n');
appContent = appContent.replace(/<button /g, '<button type="button" ');
appContent = appContent.replace(/type="button" type="button"/g, 'type="button"');
appContent = appContent.replace(/type="button" type="submit"/g, 'type="submit"');
appContent = appContent.replace(/type="submit" type="button"/g, 'type="submit"');

writeFileSync('src/App.tsx', appContent);
