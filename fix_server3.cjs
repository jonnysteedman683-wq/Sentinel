const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /if \(jsonParsed\.extractedMemory\) parsed\.extractedMemory = jsonParsed\.extractedMemory;/,
  "if (jsonParsed.extractedMemory) parsed.extractedMemory = typeof jsonParsed.extractedMemory === 'string' ? jsonParsed.extractedMemory : JSON.stringify(jsonParsed.extractedMemory);"
);

fs.writeFileSync('server.ts', content);
console.log("Successfully updated server.ts for extractedMemory");
