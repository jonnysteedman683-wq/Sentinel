const fs = require('fs');
let content = fs.readFileSync('src/components/MemoriaDashboard.tsx', 'utf8');

// Add import
content = content.replace(
  "import { fetchWithTracing } from '../lib/fetchWithTracing.js';",
  "import { fetchWithTracing } from '../lib/fetchWithTracing.js';\nimport { FederationDashboard } from './FederationDashboard.js';"
);

// Add the dashboard in the grid
content = content.replace(
  `        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">`,
  `        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">\n          <div className="col-span-1 lg:col-span-2">\n            <FederationDashboard />\n          </div>`
);

fs.writeFileSync('src/components/MemoriaDashboard.tsx', content);
