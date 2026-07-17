with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("        </nav>\n        </aside>", "        </nav>")
code = code.replace("        </nav>\n</aside>", "        </nav>")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
