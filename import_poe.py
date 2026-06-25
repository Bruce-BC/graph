#!/usr/bin/env python3
import sys
import json
import urllib.request
import urllib.error
import re
import os

POE_JSON_URL = "https://web.poecdn.com/public/news/PassiveSkillTree/passive-skill-tree.json"
POE_HTML_URL = "https://www.pathofexile.com/passive-skill-tree/"

def fetch_poe_tree():
    print(f"Downloading PoE Passive Skill Tree JSON from CDN...")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    
    try:
        req = urllib.request.Request(POE_JSON_URL, headers=headers)
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"CDN download failed ({e.code}). Attempting to scrape from HTML page...")
    except Exception as e:
        print(f"CDN download failed: {e}. Attempting to scrape from HTML page...")
        
    try:
        req = urllib.request.Request(POE_HTML_URL, headers=headers)
        with urllib.request.urlopen(req) as response:
            html = response.read().decode("utf-8")
            # Look for: var passiveSkillTreeData = { ... };
            match = re.search(r"var\s+passiveSkillTreeData\s*=\s*(\{.*?\});", html, re.DOTALL)
            if match:
                return json.loads(match.group(1))
            else:
                # Try another search pattern
                match = re.search(r"passiveSkillTreeData\s*=\s*(\{.*?\})\s*,\s*", html, re.DOTALL)
                if match:
                    return json.loads(match.group(1))
    except Exception as e:
        print(f"Scraping failed: {e}")
        
    return None

def import_tree():
    raw_data = fetch_poe_tree()
    if not raw_data:
        print("Error: Could not retrieve passive skill tree data from Path of Exile.")
        sys.exit(1)
        
    print("Parsing PoE Passive Skill Tree...")
    nodes = []
    edges = []
    
    poe_nodes = raw_data.get("nodes", {})
    
    # Scale coordinates to fit nicely
    # PoE positions can be large (e.g. -8000 to 8000). We center and scale them.
    scale_factor = 0.25 # Scale down by 4
    x_offset = 2000
    y_offset = 2000
    
    node_count = 0
    edge_count = 0
    
    for key, node_data in poe_nodes.items():
        # Skip root and starting placeholder nodes that have no label
        if not node_data.get("name") or node_data.get("name") == "Root":
            continue
            
        nid = str(key)
        label = node_data.get("name", f"Skill {nid}")
        
        # Decide importance
        importance = "Low"
        if node_data.get("isKeystone"):
            importance = "High"
        elif node_data.get("isNotable"):
            importance = "Medium"
            
        # Parse status (default to Locked)
        status = "Locked"
        
        # Build comment with stats modifiers
        stats = node_data.get("stats", [])
        stats_md = "\n".join([f"- {s}" for s in stats])
        comment = f"# ⚔️ {label}\n\n**스킬 ID**: {nid}\n\n### 📊 스킬 효과\n{stats_md if stats else '*속성 없음*'}\n"
        
        # Parse shape
        shape = "circle"
        if node_data.get("isKeystone"):
            shape = "hexagon"
        elif node_data.get("isNotable"):
            shape = "diamond"
            
        # Scaling coords
        raw_x = node_data.get("x", 0)
        raw_y = node_data.get("y", 0)
        x = float(raw_x) * scale_factor + x_offset
        y = float(raw_y) * scale_factor + y_offset
        
        # Handle subnodes if any (mapping group stats or attributes)
        subnodes = []
        
        nodes.append({
            "id": nid,
            "label": label,
            "importance": importance,
            "status": status,
            "comment": comment,
            "x": x,
            "y": y,
            "shape": shape,
            "subnodes": subnodes
        })
        node_count += 1
        
        # Add dependency edges
        out_nodes = node_data.get("out", []) or []
        for target_id in out_nodes:
            target_str = str(target_id)
            # Only connect to existing nodes (avoid duplicate or self-loop edges)
            if target_str != nid:
                edges.append({
                    "id": f"edge-{nid}-{target_str}",
                    "source": nid,
                    "target": target_str
                })
                edge_count += 1
                
    # Filter out edges where target node does not exist in our imported nodes list
    valid_node_ids = {n["id"] for n in nodes}
    edges = [e for e in edges if e["source"] in valid_node_ids and e["target"] in valid_node_ids]
    
    result = {
        "nodes": nodes,
        "edges": edges
    }
    
    # Save to official tree
    with open("math_tree.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        
    print(f"Import complete! Imported {node_count} nodes and {len(edges)} connections successfully.")
    print("Copied to 'math_tree.json'. Open your browser and refresh to view the PoE passive skill tree!")

if __name__ == "__main__":
    import_tree()
