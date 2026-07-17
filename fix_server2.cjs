const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const regex2 = /parsed\.cognitiveLog = \{\n\s*draft: jsonParsed\.cognitiveLog\.draft \|\| "",\n\s*recollection: jsonParsed\.cognitiveLog\.recollection \|\| "",\n\s*reflection: jsonParsed\.cognitiveLog\.reflection \|\| "",\n\s*reiteration: jsonParsed\.cognitiveLog\.reiteration \|\| ""\n\s*\};/;

const replacement2 = `parsed.cognitiveLog = {
          draft: typeof jsonParsed.cognitiveLog.draft === 'string' ? jsonParsed.cognitiveLog.draft : JSON.stringify(jsonParsed.cognitiveLog.draft || ""),
          recollection: typeof jsonParsed.cognitiveLog.recollection === 'string' ? jsonParsed.cognitiveLog.recollection : JSON.stringify(jsonParsed.cognitiveLog.recollection || ""),
          reflection: typeof jsonParsed.cognitiveLog.reflection === 'string' ? jsonParsed.cognitiveLog.reflection : JSON.stringify(jsonParsed.cognitiveLog.reflection || ""),
          reiteration: typeof jsonParsed.cognitiveLog.reiteration === 'string' ? jsonParsed.cognitiveLog.reiteration : JSON.stringify(jsonParsed.cognitiveLog.reiteration || "")
        };`;

if(regex2.test(content)) {
    content = content.replace(regex2, replacement2);
    fs.writeFileSync('server.ts', content);
    console.log("Successfully updated server.ts for cognitiveLog");
} else {
    console.log("Could not find match in server.ts for cognitiveLog");
}
