import json
with open('data.json') as f:
    data = json.load(f)
nodes = data.get('nodes', {})
empty = 0
for k, v in nodes.items():
    if not v.get('icon'):
        empty += 1
        print("Empty icon node:", v.get('name'), v.get('stats'))
print(f"Total empty: {empty}")
