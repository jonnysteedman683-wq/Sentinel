const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const regex = /if \(jsonParsed\.text\) parsed\.text = jsonParsed\.text;\n\s*if \(jsonParsed\.selfAnalysis\) parsed\.selfAnalysis = jsonParsed\.selfAnalysis;/;

const replacement = `if (jsonParsed.text) parsed.text = typeof jsonParsed.text === 'string' ? jsonParsed.text : JSON.stringify(jsonParsed.text);
      if (jsonParsed.selfAnalysis) parsed.selfAnalysis = typeof jsonParsed.selfAnalysis === 'string' ? jsonParsed.selfAnalysis : JSON.stringify(jsonParsed.selfAnalysis);`;

if(regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('server.ts', content);
    console.log("Successfully updated server.ts");
} else {
    console.log("Could not find match in server.ts");
}
