import json
import math
import os
import yaml
from PIL import Image

def get_orbit_angle(skills_in_orbit, orbit_index):
    if skills_in_orbit == 16:
        angles = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]
        deg = angles[orbit_index] if orbit_index < len(angles) else 0
    elif skills_in_orbit == 40:
        angles = [0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170, 180, 190, 200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290, 300, 310, 315, 320, 330, 340, 350]
        deg = angles[orbit_index] if orbit_index < len(angles) else 0
    else:
        deg = 360 * orbit_index / skills_in_orbit
    return math.radians(deg)

def build_data():
    os.makedirs('static/icons', exist_ok=True)
    
    with open('data.json', 'r') as f:
        data = json.load(f)

    with open('sprites.json', 'r') as f:
        sprites_data = json.load(f)

    # Load existing skills config (for status)
    try:
        with open('skills_config.yaml', 'r', encoding='utf-8') as f:
            skills_config = yaml.safe_load(f) or {'skills': {}}
    except FileNotFoundError:
        skills_config = {'skills': {}}
        
    # Load existing poe_skills config (for name and stats localization)
    try:
        with open('poe_skills.yaml', 'r', encoding='utf-8') as f:
            poe_skills = yaml.safe_load(f) or {}
    except FileNotFoundError:
        poe_skills = {}
        
    poe_skills_by_id = {}
    for k, v in poe_skills.items():
        if isinstance(v, dict):
            # Support lookup by serial_id key (e.g. node_1620) OR by 'id' field (PoE node id)
            if 'id' in v:
                poe_skills_by_id[str(v['id'])] = v  # lookup by PoE node id
            poe_skills_by_id[k] = v  # also keep lookup by serial_id key
    poe_skills_export = {}
    serial_num = 1

    # Use Path of Building local sprite sheets
    pob_dir = 'PathOfBuilding.app/Contents/MacOS/TreeData/3_27'
    
    # Map sprite types to their local file names in PoB
    sprite_files = {
        'normalActive': 'skills-3.jpg',
        'notableActive': 'skills-3.jpg',
        'keystoneActive': 'skills-3.jpg',
        'normalInactive': 'skills-disabled-3.jpg',
        'notableInactive': 'skills-disabled-3.jpg',
        'keystoneInactive': 'skills-disabled-3.jpg',
        'mastery': 'mastery-3.png',
        'masteryActiveSelected': 'mastery-active-selected-3.png',
        'ascendancy': 'ascendancy-3.webp', # WebP in 3.27
        'groupBackground': 'group-background-3.png',
        'frame': 'frame-3.png',
        'line': 'line-3.png'
    }
    
    for sprite_type, local_filename in sprite_files.items():
        if sprite_type not in sprites_data['sprites']:
            continue
            
        sprite_dict = sprites_data['sprites'][sprite_type]
        
        if 'coords' not in sprite_dict:
            continue
            
        coords = sprite_dict['coords']
        local_path = os.path.join(pob_dir, local_filename)
        
        if not os.path.exists(local_path):
            # Try png alternative if webp/jpg fails or vice-versa
            alt_filename = local_filename.replace('.webp', '.png').replace('.png', '.webp')
            local_path_alt = os.path.join(pob_dir, alt_filename)
            if os.path.exists(local_path_alt):
                local_path = local_path_alt
            else:
                print(f"Missing local sprite sheet: {local_path}")
                continue
            
        try:
            sheet = Image.open(local_path)
            print(f"Loaded {local_path} for {sprite_type} ({sheet.width}x{sheet.height})")
            
            for icon_key, box in coords.items():
                icon_filename = sprite_type + '_' + icon_key.replace('/', '_') + '.png'
                icon_path = os.path.join('static/icons', icon_filename)
                
                try:
                    crop = sheet.crop((box['x'], box['y'], box['x'] + box['w'], box['y'] + box['h']))
                    crop.save(icon_path)
                except Exception as e:
                    print(f"Error saving {icon_path}: {e}")
        except Exception as e:
            print(f"Failed to process {local_path}: {e}")

    print("Processing nodes...")
    out_nodes = []
    out_edges = []
    
    orbit_radii = data['constants']['orbitRadii']
    skills_per_orbit = data['constants']['skillsPerOrbit']
    
    scale_factor = 1.0
    x_offset = 0
    y_offset = 0
    
    node_count = 0
    for nid, n in data['nodes'].items():
        if not n.get('name') or n.get('name') == 'Root':
            continue
            
        group_id = str(n.get('group', ''))
        orbit = n.get('orbit', 0)
        orbit_index = n.get('orbitIndex', 0)
        
        x, y = 0, 0
        angle = 0
        if group_id in data.get('groups', {}):
            group = data['groups'][group_id]
            gx = group.get('x', 0)
            gy = group.get('y', 0)
            
            if orbit < len(orbit_radii) and orbit < len(skills_per_orbit):
                radius = orbit_radii[orbit]
                skills = skills_per_orbit[orbit]
                if skills > 0:
                    angle = get_orbit_angle(skills, orbit_index)
                    x = gx + radius * math.sin(angle)
                    y = gy - radius * math.cos(angle)
                else:
                    x, y = gx, gy
            else:
                x, y = gx, gy
                
        final_x = x * scale_factor + x_offset
        final_y = y * scale_factor + y_offset
        
        raw_icon = n.get('icon', '')
        
        sprite_type = 'normalActive'
        if n.get('isMastery'):
            sprite_type = 'mastery'
        elif n.get('isKeystone') or n.get('type') == 'Keystone': # PoE data might use isKeystone
            sprite_type = 'keystoneActive'
        elif n.get('isNotable') or n.get('type') == 'Notable':
            sprite_type = 'notableActive'
        elif n.get('isJewelSocket') or n.get('type') == 'JewelSocket':
            sprite_type = 'normalActive' # Jewel sockets usually use normalActive icons
            
        safe_icon_name = sprite_type + '_' + raw_icon.replace('/', '_') + '.png' if raw_icon else ''     
        importance = "Low"
        shape = "circle"
        if n.get("isKeystone"):
            importance = "High"
            shape = "hexagon"
        elif n.get("isNotable"):
            importance = "Medium"
            shape = "diamond"
            
        yaml_node = skills_config['skills'].get(str(nid), {})
        custom_status = yaml_node.get('status', 'Locked')
        
        yaml_skill = poe_skills_by_id.get(str(nid), {})
        custom_name = yaml_skill.get('name', n.get('name', f"Node {nid}"))
        stats = yaml_skill.get('stats', n.get("stats", []))
        stats_md = "\n".join([f"- {s}" for s in stats])
        
        serial_id = f"node_{serial_num}"
        serial_num += 1
        
        poe_skills_export[serial_id] = {
            "id": str(nid),
            "name": custom_name,
            "stats": stats
        }
        
        # Update config so that we can write it out fully later
        skills_config['skills'][str(nid)] = {
            'status': custom_status
        }
        
        comment = f"# ⚔️ {custom_name}\n\n**스킬 ID**: {nid}\n\n### 📊 스킬 효과\n{stats_md if stats else '*속성 없음*'}\n"
            
        out_nodes.append({
            "id": str(nid),
            "serial_id": serial_id,
            "label": custom_name,
            "name": custom_name,
            "icon": safe_icon_name if raw_icon else "",
            "status": custom_status,
            "stats": stats,
            "comment": comment,
            "x": final_x,
            "y": final_y,
            "importance": importance,
            "shape": shape,
            "group": group_id,
            "orbit": orbit,
            "orbit_index": orbit_index,
            "angle": angle,
            "orbit_radius": orbit_radii[orbit] * scale_factor if orbit < len(orbit_radii) else 0,
            "subnodes": [],
            "type": n.get('type', 'Normal'),
            "isMastery": n.get('isMastery', False)
        })
        node_count += 1
        
        for tgt_str in n.get('out', []):
            tgt_node = data['nodes'].get(str(tgt_str))
            if not tgt_node:
                continue
            
            tgt_group_id = str(tgt_node.get('group', ''))
            tgt_group = data.get('groups', {}).get(tgt_group_id, {})
            src_group = data.get('groups', {}).get(group_id, {})
            
            # Exact connector rules from PathOfBuilding's PassiveTree.lua (lines 574-578)
            if n.get('type') == 'ClassStart' or tgt_node.get('type') == 'ClassStart':
                continue
            if n.get('type') == 'Mastery' or tgt_node.get('type') == 'Mastery':
                continue
            if n.get('ascendancyName') != tgt_node.get('ascendancyName'):
                continue

            if str(tgt_str) != str(nid):
                out_edges.append({
                    "id": f"edge-{nid}-{tgt_str}",
                    "source": str(nid),
                    "target": str(tgt_str)
                })
                
    valid_ids = {n["id"] for n in out_nodes}
    out_edges = [e for e in out_edges if e["source"] in valid_ids and e["target"] in valid_ids]
    
    out_groups = {}
    for gid, g in data.get('groups', {}).items():
        if g.get('isProxy'):
            continue
        max_orbit = max(g.get('orbits', [0])) if g.get('orbits') else 0
        bg_type = "PSGroupBackground1"
        if max_orbit == 3:
            bg_type = "PSGroupBackground3"
        elif max_orbit == 2:
            bg_type = "PSGroupBackground2"
            
        out_groups[gid] = {
            "x": g.get('x', 0) * scale_factor + x_offset,
            "y": g.get('y', 0) * scale_factor + y_offset,
            "max_orbit": max_orbit,
            "bg": bg_type
        }
    
    import shutil
    out_extra_images = []
    for k, v in sprites_data.get('extraImages', {}).items():
        img_name = v['image'].split('/')[-1]
        bg_name = f"Background{img_name}"
        
        # Copy from TreeData to static/icons
        src_path = f"PathOfBuilding.app/Contents/MacOS/TreeData/{bg_name}"
        dst_path = f"static/icons/{bg_name}"
        if os.path.exists(src_path) and not os.path.exists(dst_path):
            shutil.copy2(src_path, dst_path)
            
        out_extra_images.append({
            "x": v['x'] * scale_factor + x_offset,
            "y": v['y'] * scale_factor + y_offset,
            "image": bg_name
        })
        
    # And centerscion
    if os.path.exists("PathOfBuilding.app/Contents/MacOS/TreeData/centerscion.png") and not os.path.exists("static/icons/centerscion.png"):
        shutil.copy2("PathOfBuilding.app/Contents/MacOS/TreeData/centerscion.png", "static/icons/centerscion.png")
        
    out_extra_images.append({
        "x": 0 * scale_factor + x_offset,
        "y": 0 * scale_factor + y_offset,
        "image": "centerscion.png"
    })

    with open('math_tree.json', 'w') as f:
        json.dump({
            "nodes": out_nodes, 
            "edges": out_edges, 
            "groups": out_groups,
            "extraImages": out_extra_images
        }, f, ensure_ascii=False, indent=2)
        
    with open('skills_config.yaml', 'w', encoding='utf-8') as f:
        yaml.dump(skills_config, f, allow_unicode=True, default_flow_style=False)
        
    with open('poe_skills.yaml', 'w', encoding='utf-8') as f:
        yaml.dump(poe_skills_export, f, allow_unicode=True, sort_keys=False)
        
    print(f"Generated math_tree.json with {node_count} nodes and {len(out_edges)} edges!")

if __name__ == "__main__":
    build_data()
