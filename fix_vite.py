import re

with open('server.ts', 'r') as f:
    content = f.read()

content = content.replace(
    'if (process.env.NODE_ENV !== "production") {',
    'const isProd = process.env.NODE_ENV === "production" || require("fs").existsSync(require("path").join(process.cwd(), "dist/index.html"));\n  if (!isProd) {'
)

with open('server.ts', 'w') as f:
    f.write(content)
