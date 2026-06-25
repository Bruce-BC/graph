import json
import yaml

with open('data.json') as f:
    data = json.load(f)

nodes = data.get('nodes', {})
yaml_data = {}
serial_num = 1

for nid, n in nodes.items():
    if n.get('type') == 'ClassStart':
        continue
    if n.get('isProxy'):
        continue
        
    stats = n.get('stats', [])
    yaml_data[f"node_{serial_num}"] = {
        "id": str(nid),
        "name": n.get('name', f"Node {nid}"),
        "stats": stats
    }
    serial_num += 1

with open('poe_skills.yaml', 'w', encoding='utf-8') as f:
    yaml.dump(yaml_data, f, allow_unicode=True, sort_keys=False)

print(f"Generated poe_skills.yaml with {serial_num - 1} nodes.")
