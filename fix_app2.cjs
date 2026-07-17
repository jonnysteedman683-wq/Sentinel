const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
let lines = code.split('\\n');

let startDelete = -1;
let endDelete = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(') : (') && lines[i-1].includes('</div>')) {
    // Check if next line contains '<div className={`max-w-[80%]'
    if (lines[i+1] && lines[i+1].includes('className={`max-w-[80%] p-5 rounded-2xl')) {
      startDelete = i;
    }
  }
}

if (startDelete !== -1) {
  // Find closing </div>
  let depth = 1; // It starts with <div
  for (let j = startDelete + 1; j < lines.length; j++) {
    if (lines[j].includes(') : (')) depth++;
    if (lines[j].includes('</p>')) continue;
    if (lines[j].includes('<div') && !lines[j].includes('</div>')) depth++;
    if (lines[j].includes('</div>')) depth--;
    
    if (lines[j].includes(') : (') && lines[j+1].includes('<p className="leading-relaxed">')) {
       // found the fallback block
    }
    
    // Actually, just find the next `))} `
    if (lines[j].includes('))}')) {
      endDelete = j - 2; // Keep </div> </div> ))}
      break;
    }
  }
}

console.log(startDelete, endDelete);

if (startDelete !== -1 && endDelete !== -1) {
  lines[startDelete] = lines[startDelete].replace(') : (', ') : null}');
  lines.splice(startDelete + 1, endDelete - startDelete);
  fs.writeFileSync('src/App.tsx', lines.join('\\n'));
}
