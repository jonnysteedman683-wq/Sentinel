const fs = require('fs');
const file = 'src/components/TelemetryDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the Promise.all array to include health-history
content = content.replace(
  /const \[telRes, dreamRes\] = await Promise\.all\(\[\s*fetch\('\/api\/telemetry', \{ headers \}\),\s*fetch\('\/api\/dream\/history', \{ headers \}\)\s*\]\);/,
  `const [telRes, dreamRes, healthRes] = await Promise.all([
          fetch('/api/telemetry', { headers }),
          fetch('/api/dream/history', { headers }),
          fetch('/api/system/health-history', { headers })
        ]);`
);

// Add the processing block for healthRes
content = content.replace(
  /if \(dreamRes\.ok\) \{\s*const json = await dreamRes\.json\(\);\s*setDreamHistory\(json\);\s*\}/,
  `if (dreamRes.ok) {
          const json = await dreamRes.json();
          setDreamHistory(json);
        }
        if (healthRes && healthRes.ok) {
          const json = await healthRes.json();
          setHealthHistory(json);
        }`
);

fs.writeFileSync(file, content);
