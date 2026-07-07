const fs = require('fs');
let content = fs.readFileSync('src/SystemMetrics.tsx', 'utf-8');

content = content.replace(
  "import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';",
  "import { LineChart, Line, ResponsiveContainer } from 'recharts';"
);

fs.writeFileSync('src/SystemMetrics.tsx', content);
