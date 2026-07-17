import os
import re

def add_js_extension(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Pattern to find relative imports: from '...' or import '...'
    # Only if it doesn't already end with .js, .ts, .tsx, .json
    pattern = r'(from\s+[\'"]\.)([^\'"]+)([\'"])'
    
    def replacer(match):
        prefix = match.group(1)
        path = match.group(2)
        quote = match.group(3)
        
        if path.endswith(('.js', '.ts', '.tsx', '.json')):
            return match.group(0)
        
        # Check if it's a directory
        full_path = os.path.join(os.path.dirname(file_path), path)
        if os.path.isdir(full_path):
            return f"{prefix}{path}/index.js{quote}"
        
        return f"{prefix}{path}.js{quote}"

    new_content = re.sub(pattern, replacer, content)
    
    with open(file_path, 'w') as f:
        f.write(new_content)

def main():
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith(('.ts', '.tsx')):
                add_js_extension(os.path.join(root, file))

if __name__ == '__main__':
    main()
