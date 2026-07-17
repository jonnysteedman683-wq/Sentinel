import json

with open('package.json', 'r') as f:
    data = json.load(f)

dev_deps = data.get('devDependencies', {})
deps = data.get('dependencies', {})

# Move all devDependencies to dependencies just to be safe
for k, v in dev_deps.items():
    deps[k] = v

data['dependencies'] = deps
data['devDependencies'] = {}

with open('package.json', 'w') as f:
    json.dump(data, f, indent=2)

print("Moved devDependencies to dependencies")
