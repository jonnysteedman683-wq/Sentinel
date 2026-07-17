const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
let lines = code.split('\\n');

let newLines = [];
let i = 0;
while (i < lines.length) {
  if (i === 2368) { // 0-indexed, so line 2369 is i=2368
    newLines.push(lines[i].replace(') : (', ') : null}'));
    // skip until 2458 (which is index 2457)
    i = 2458; 
    continue;
  }
  newLines.push(lines[i]);
  i++;
}

fs.writeFileSync('src/App.tsx', newLines.join('\\n'));
