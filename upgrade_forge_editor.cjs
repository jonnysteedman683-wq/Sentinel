const fs = require('fs');
let content = fs.readFileSync('src/ForgePanel.tsx', 'utf-8');

const importLines = `
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/themes/prism-twilight.css'; // Or another theme
`;

content = content.replace(/import \{ db \} from '\.\/db';/, `import { db } from './db';\n${importLines}`);

const oldTextarea = `<textarea
              value={code}
              onChange={e => setCode(e.target.value)}
              spellCheck={false}
              className="absolute inset-0 w-full h-full bg-transparent text-[#D4D4D4] p-4 font-mono text-[13px] leading-relaxed resize-none outline-none overflow-y-auto"
              style={{ tabSize: 2 }}
            />`;

const newEditor = `<div className="absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden">
              <Editor
                value={code}
                onValueChange={code => setCode(code)}
                highlight={code => Prism.highlight(code, Prism.languages.typescript, 'typescript')}
                padding={16}
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontSize: 13,
                  backgroundColor: 'transparent',
                  minHeight: '100%',
                }}
                textareaClassName="focus:outline-none"
              />
            </div>`;

content = content.replace(oldTextarea, newEditor);

fs.writeFileSync('src/ForgePanel.tsx', content);
