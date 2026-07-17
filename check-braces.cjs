const fs = require('fs');
const ts = require('typescript');
const code = fs.readFileSync('server.ts', 'utf8');

const sourceFile = ts.createSourceFile('server.ts', code, ts.ScriptTarget.Latest, true);

function printNode(node, depth) {
  if (node.kind === ts.SyntaxKind.Block) {
    // block
  }
}

// But wait, there is a syntax error, so AST is broken.
// I will just parse with esbuild or SWC to see where it breaks.
