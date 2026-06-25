import json
with open('data.json') as f:
    data = json.load(f)
nodes = data.get('nodes', {})
for k, v in nodes.items():
    if v.get('isMastery'):
        print("Mastery node icon:", v.get('icon'), "name:", v.get('name'))
