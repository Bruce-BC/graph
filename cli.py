#!/usr/bin/env python3
import sys
import json
import argparse
import urllib.request
import urllib.parse
import os
import time
import uuid
import yaml

BASE_URL = "http://localhost:8000"

def make_request(path, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    url = f"{BASE_URL}{path}"
    
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
        
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"Error {e.code}: {e.read().decode('utf-8')}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Connection failed: {e}", file=sys.stderr)
        sys.exit(1)

def get_session_headers(username="CLIAdmin", role="admin"):
    # Perform mock login to establish credentials
    login_url = f"{BASE_URL}/api/auth/mock-login"
    data = json.dumps({"name": username, "email": f"{username.lower()}@cli.com", "role": role}).encode("utf-8")
    req = urllib.request.Request(login_url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            cookie = response.info().get("Set-Cookie")
            if cookie:
                # Extract session cookie value
                session_cookie = cookie.split(";")[0]
                return {"Cookie": session_cookie}
    except Exception as e:
        print(f"Auth failed: {e}", file=sys.stderr)
    return {}

DRAFT_FILE = "math_tree_draft.json"
INDEX_FILE = ".git_index.json"
COMMITS_FILE = ".git_commits.json"

def load_local_file(filename, default=None):
    if not os.path.exists(filename):
        return default if default is not None else {}
    with open(filename, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return default if default is not None else {}

def save_local_file(filename, data):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def is_node_modified(n1, n2):
    if n1.get("label") != n2.get("label"): return True
    if n1.get("importance") != n2.get("importance"): return True
    if n1.get("status") != n2.get("status"): return True
    if n1.get("shape", "circle") != n2.get("shape", "circle"): return True
    if n1.get("comment", "") != n2.get("comment", ""): return True
    
    # Compare subnodes
    subs1 = n1.get("subnodes", []) or []
    subs2 = n2.get("subnodes", []) or []
    if len(subs1) != len(subs2): return True
    for s1, s2 in zip(subs1, subs2):
        if s1.get("id") != s2.get("id"): return True
        if s1.get("label") != s2.get("label"): return True
        if s1.get("status") != s2.get("status"): return True
        
    return False

def apply_commits(base, commits):
    import copy
    g = copy.deepcopy(base)
    for commit in commits:
        for change in commit.get("changes", []):
            action = change.get("action")
            ctype = change.get("type")
            target_id = change.get("id")
            cdata = change.get("data")
            
            if ctype == "node":
                if action == "add":
                    g["nodes"] = [n for n in g.get("nodes", []) if n.get("id") != target_id]
                    g["nodes"].append(copy.deepcopy(cdata))
                elif action == "modify":
                    for idx, node in enumerate(g.get("nodes", [])):
                        if node.get("id") == target_id:
                            g["nodes"][idx] = copy.deepcopy(cdata)
                            break
                elif action == "delete":
                    g["nodes"] = [n for n in g.get("nodes", []) if n.get("id") != target_id]
                    g["edges"] = [e for e in g.get("edges", []) if e.get("source") != target_id and e.get("target") != target_id]
            elif ctype == "edge":
                if action == "add":
                    g["edges"] = [e for e in g.get("edges", []) if e.get("id") != target_id]
                    g["edges"].append(copy.deepcopy(cdata))
                elif action == "delete":
                    g["edges"] = [e for e in g.get("edges", []) if e.get("id") != target_id]
    return g

def diff_graph(old_g, new_g):
    changes = []
    
    # Diff Nodes
    old_nodes = {n["id"]: n for n in old_g.get("nodes", [])}
    new_nodes = {n["id"]: n for n in new_g.get("nodes", [])}
    
    for nid, new_node in new_nodes.items():
        old_node = old_nodes.get(nid)
        if not old_node:
            changes.append({
                "action": "add",
                "type": "node",
                "id": nid,
                "data": new_node
            })
        else:
            if is_node_modified(old_node, new_node):
                changes.append({
                    "action": "modify",
                    "type": "node",
                    "id": nid,
                    "data": new_node
                })
                
    for nid, old_node in old_nodes.items():
        if nid not in new_nodes:
            changes.append({
                "action": "delete",
                "type": "node",
                "id": nid,
                "data": None
            })
            
    # Diff Edges
    old_edges = {e["id"]: e for e in old_g.get("edges", [])}
    new_edges = {e["id"]: e for e in new_g.get("edges", [])}
    
    for eid, new_edge in new_edges.items():
        if eid not in old_edges:
            changes.append({
                "action": "add",
                "type": "edge",
                "id": eid,
                "data": new_edge
            })
            
    for eid, old_edge in old_edges.items():
        if eid not in new_edges:
            changes.append({
                "action": "delete",
                "type": "edge",
                "id": eid,
                "data": None
            })
            
    return changes

def get_draft_state():
    official = make_request("/api/graph")
    if not os.path.exists(DRAFT_FILE):
        save_local_file(DRAFT_FILE, official)
    draft = load_local_file(DRAFT_FILE, official)
    return official, draft

def show_status():
    official, draft = get_draft_state()
    commits = load_local_file(COMMITS_FILE, [])
    staged = load_local_file(INDEX_FILE, [])
    
    commit_base = apply_commits(official, commits)
    all_working_changes = diff_graph(commit_base, draft)
    
    # Filter staged changes that are still in all_working_changes
    staged = [sc for sc in staged if any(
        wc["type"] == sc["type"] and wc["id"] == sc["id"] and wc["action"] == sc["action"]
        for wc in all_working_changes
    )]
    save_local_file(INDEX_FILE, staged)
    
    # Unstaged changes
    unstaged = [wc for wc in all_working_changes if not any(
        sc["type"] == wc["type"] and sc["id"] == wc["id"] and sc["action"] == wc["action"]
        for sc in staged
    )]
    
    print("=== Git Tech Tree Status ===")
    print(f"Draft: {len(draft.get('nodes', []))} nodes, {len(draft.get('edges', []))} edges.")
    print(f"Official (HEAD): {len(official.get('nodes', []))} nodes, {len(official.get('edges', []))} edges.")
    print(f"Unpushed local commits: {len(commits)}")
    print()
    
    if commits:
        print("Unpushed commits:")
        for c in commits:
            print(f"  [{c['id'][:7]}] {c['message']} ({len(c['changes'])} changes)")
        print()
        
    print("Changes to be committed:")
    if not staged:
        print("  (nothing staged for commit - use \"./cli.py add <id>\" to stage)")
    else:
        for sc in staged:
            print(f"  [{sc['action'].upper()}] {sc['type']}: {sc['id']}")
    print()
            
    print("Changes not staged for commit:")
    if not unstaged:
        print("  (working tree clean)")
    else:
        for uc in unstaged:
            print(f"  [{uc['action'].upper()}] {uc['type']}: {uc['id']}")
        print("  (use \"./cli.py add <id>\" or \"./cli.py add .\" to stage)")
    print()

def add_node(args):
    official, draft = get_draft_state()
    # Check duplicate
    if any(n["id"] == args.id for n in draft["nodes"]):
        print(f"Error: Node ID '{args.id}' already exists.")
        sys.exit(1)
        
    new_node = {
        "id": args.id,
        "label": args.label,
        "importance": args.importance,
        "status": args.status,
        "comment": args.comment,
        "x": 200,
        "y": 200,
        "shape": args.shape,
        "subnodes": []
    }
    draft["nodes"].append(new_node)
    save_local_file(DRAFT_FILE, draft)
    print(f"Successfully created node '{args.label}' [{args.id}] locally in draft.")

def add_subnode(args):
    official, draft = get_draft_state()
    
    parent = None
    for n in draft["nodes"]:
        if n["id"] == args.parent_id:
            parent = n
            break
            
    if not parent:
        print(f"Error: Parent Node ID '{args.parent_id}' not found.")
        sys.exit(1)
        
    sub_id = args.id if args.id else f"sub-{int(time.time() * 1000)}"
    
    if any(s["id"] == sub_id for s in parent.get("subnodes", [])):
        print(f"Error: Subnode ID '{sub_id}' already exists in parent node.")
        sys.exit(1)
        
    new_sub = {
        "id": sub_id,
        "label": args.label,
        "status": args.status
    }
    if "subnodes" not in parent or parent["subnodes"] is None:
        parent["subnodes"] = []
    parent["subnodes"].append(new_sub)
    
    save_local_file(DRAFT_FILE, draft)
    print(f"Successfully added subnode '{args.label}' [{sub_id}] to parent '{parent['label']}' in draft.")

def add_edge(args):
    official, draft = get_draft_state()
    
    node_ids = {n["id"] for n in draft["nodes"]}
    if args.source not in node_ids or args.target not in node_ids:
        print(f"Error: Source '{args.source}' or Target '{args.target}' node does not exist.")
        sys.exit(1)
        
    if args.source == args.target:
        print("Error: Self-loops are not allowed.")
        sys.exit(1)
        
    if any((e["source"] == args.source and e["target"] == args.target) for e in draft["edges"]):
        print("Error: Edge already exists.")
        sys.exit(1)
        
    edge_id = args.id if args.id else f"edge-{args.source}-{args.target}"
    draft["edges"].append({
        "id": edge_id,
        "source": args.source,
        "target": args.target
    })
    
    save_local_file(DRAFT_FILE, draft)
    print(f"Successfully created edge {args.source} ===> {args.target} [{edge_id}] in draft.")

def list_proposals():
    headers = get_session_headers()
    proposals = make_request("/api/admin/contributions", headers=headers)
    pending = [p for p in proposals if p.get("status") == "pending"]
    
    print(f"=== Pending Proposals ({len(pending)}) ===")
    for p in pending:
        print(f"ID: {p['id']} | Submitter: {p['contributor']['name']} ({p['contributor']['email']})")
        print(f"Description: {p['description']}")
        print("Commits in this proposal:")
        for c in p.get("commits", []):
            print(f"  - [{c['id'][:7]}] {c['message']} ({len(c['changes'])} changes)")
            for chg in c.get("changes", []):
                print(f"    * [{chg['action'].upper()}] {chg['type']}: {chg['id']}")
        print("-" * 40)

def approve_proposal(args):
    headers = get_session_headers()
    res = make_request(f"/api/admin/contributions/{args.prop_id}/approve", method="POST", headers=headers)
    if res.get("status") == "success":
        print(f"Successfully merged proposal {args.prop_id} into production.")
    else:
        print(f"Failed to merge proposal: {res}")

def reject_proposal(args):
    headers = get_session_headers()
    res = make_request(f"/api/admin/contributions/{args.prop_id}/reject", method="POST", headers=headers)
    if res.get("status") == "success":
        print(f"Successfully rejected proposal {args.prop_id}.")
    else:
        print(f"Failed to reject proposal: {res}")

def delete_node(args):
    official, draft = get_draft_state()
    
    node_exists = any(n["id"] == args.id for n in draft["nodes"])
    if not node_exists:
        print(f"Error: Node ID '{args.id}' not found.")
        sys.exit(1)
        
    draft["nodes"] = [n for n in draft["nodes"] if n["id"] != args.id]
    draft["edges"] = [e for e in draft["edges"] if e["source"] != args.id and e["target"] != args.id]
    
    save_local_file(DRAFT_FILE, draft)
    print(f"Successfully deleted node '{args.id}' and its connected edges in draft.")

def export_yaml(args):
    official, draft = get_draft_state()
    yaml_data = {"skills": {}}
    for node in draft.get("nodes", []):
        yaml_data["skills"][str(node["id"])] = {
            "name": node.get("label", ""),
            "status": node.get("status", "Locked")
        }
    
    out_file = args.file
    with open(out_file, "w", encoding="utf-8") as f:
        yaml.dump(yaml_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    print(f"Successfully exported {len(draft.get('nodes', []))} skills to {out_file}")

def import_yaml(args):
    official, draft = get_draft_state()
    in_file = args.file
    if not os.path.exists(in_file):
        print(f"Error: file {in_file} not found.")
        sys.exit(1)
        
    with open(in_file, "r", encoding="utf-8") as f:
        try:
            yaml_data = yaml.safe_load(f)
        except Exception as e:
            print(f"Error reading YAML: {e}")
            sys.exit(1)
            
    skills = yaml_data.get("skills", {})
    updated = 0
    
    for node in draft.get("nodes", []):
        nid = str(node["id"])
        if nid in skills:
            new_name = skills[nid].get("name")
            new_status = skills[nid].get("status")
            changed = False
            if new_name is not None and new_name != node.get("label"):
                node["label"] = new_name
                changed = True
            if new_status is not None and new_status != node.get("status"):
                node["status"] = new_status
                changed = True
            if changed:
                updated += 1
                
    if updated > 0:
        save_local_file(DRAFT_FILE, draft)
    print(f"Successfully imported and updated {updated} nodes from {in_file} into draft.")

def git_add(args):
    target = args.target
    official, draft = get_draft_state()
    commits = load_local_file(COMMITS_FILE, [])
    staged = load_local_file(INDEX_FILE, [])
    
    commit_base = apply_commits(official, commits)
    all_working_changes = diff_graph(commit_base, draft)
    
    if target == ".":
        staged = all_working_changes
        save_local_file(INDEX_FILE, staged)
        print("Staged all changes.")
    else:
        matching = [wc for wc in all_working_changes if wc["id"] == target]
        if not matching:
            print(f"No changes matching '{target}' found.")
            sys.exit(1)
        for m in matching:
            if not any(sc["type"] == m["type"] and sc["id"] == m["id"] and sc["action"] == m["action"] for sc in staged):
                staged.append(m)
        save_local_file(INDEX_FILE, staged)
        print(f"Staged changes for '{target}'.")

def git_commit(args):
    staged = load_local_file(INDEX_FILE, [])
    if not staged:
        print("Nothing to commit. Create changes and stage them with \"./cli.py add <id>\" or \"./cli.py add .\"")
        return
        
    msg = args.message
    commit_id = f"commit-{uuid.uuid4().hex[:8]}"
    
    new_commit = {
        "id": commit_id,
        "message": msg,
        "author": {"id": "cli-user", "name": "CLI Contributor", "email": "cli@test.com", "role": "contributor"},
        "timestamp": time.time(),
        "changes": staged
    }
    
    commits = load_local_file(COMMITS_FILE, [])
    commits.append(new_commit)
    save_local_file(COMMITS_FILE, commits)
    save_local_file(INDEX_FILE, [])
    
    print(f"[{commit_id[:7]}] {msg}")
    print(f" {len(staged)} changes committed locally.")

def git_push(args):
    commits = load_local_file(COMMITS_FILE, [])
    if not commits:
        print("No commits to push. Use \"./cli.py commit\" first.")
        return
        
    description = args.description
    if not description:
        description = input("Enter Pull Request Description: ").strip()
    if not description:
        description = "CLI 기여 제출"
        
    headers = get_session_headers(username="CLIContributor", role="contributor")
    payload = {
        "description": description,
        "commits": commits
    }
    
    res = make_request("/api/contributions/submit", method="POST", data=payload, headers=headers)
    if res.get("status") == "success":
        print("Successfully pushed commits as a Pull Request/Contribution Proposal!")
        if os.path.exists(COMMITS_FILE):
            os.remove(COMMITS_FILE)
        # Note: we do not delete DRAFT_FILE so that the user keeps their working draft tree,
        # but we can optionally delete it to start fresh, or keep it.
        # Keeping it is fine as it will diff against the updated official tree if merged.
        # But to be safe and clean, let's delete DRAFT_FILE to start clean.
        if os.path.exists(DRAFT_FILE):
            os.remove(DRAFT_FILE)
    else:
        print(f"Push failed: {res}")

def main():
    parser = argparse.ArgumentParser(description="Math Tech-Tree Visualizer CLI Manager")
    subparsers = parser.add_subparsers(dest="command")

    # Status / View
    subparsers.add_parser("status", help="Show current tech tree nodes, subnodes, and edges connections")

    # Git command add
    parser_add = subparsers.add_parser("add", help="Stage changes for commit")
    parser_add.add_argument("target", help="Specific node/edge ID to stage or '.' for all changes")

    # Git command commit
    parser_commit = subparsers.add_parser("commit", help="Commit staged changes locally")
    parser_commit.add_argument("-m", "--message", required=True, help="Commit message")

    # Git command push
    parser_push = subparsers.add_parser("push", help="Push local commits as a proposal/PR")
    parser_push.add_argument("--description", help="PR description message")

    # Create Node
    parser_node = subparsers.add_parser("create-node", help="Create a new official node")
    parser_node.add_argument("--id", required=True, help="Unique Node ID")
    parser_node.add_argument("--label", required=True, help="Node Name Label")
    parser_node.add_argument("--importance", default="Medium", choices=["High", "Medium", "Low"], help="Importance Level")
    parser_node.add_argument("--status", default="Locked", choices=["Completed", "In Progress", "Locked"], help="Status")
    parser_node.add_argument("--shape", default="circle", choices=["circle", "rect", "hexagon", "diamond"], help="Node shape")
    parser_node.add_argument("--comment", default="# 과목 세부 정보", help="Markdown details comment")

    # Add Subnode
    parser_sub = subparsers.add_parser("add-subnode", help="Add a subnode checkpoint to parent node")
    parser_sub.add_argument("--parent-id", required=True, help="Parent Node ID")
    parser_sub.add_argument("--label", required=True, help="Subnode Label")
    parser_sub.add_argument("--status", default="Locked", choices=["Completed", "In Progress", "Locked"], help="Subnode status")
    parser_sub.add_argument("--id", help="Optional subnode unique ID")

    # Connect Edges
    parser_edge = subparsers.add_parser("connect", help="Connect two nodes with a dependency edge")
    parser_edge.add_argument("--source", required=True, help="Source Node ID")
    parser_edge.add_argument("--target", required=True, help="Target Node ID")
    parser_edge.add_argument("--id", help="Optional Edge unique ID")

    # Proposals view/management
    subparsers.add_parser("proposals", help="List all pending contribution requests")
    
    parser_approve = subparsers.add_parser("approve", help="Approve and merge a pending contribution proposal")
    parser_approve.add_argument("prop_id", help="Proposal ID to merge")

    parser_reject = subparsers.add_parser("reject", help="Reject a pending contribution proposal")
    parser_reject.add_argument("prop_id", help="Proposal ID to reject")

    # Delete Node
    parser_del = subparsers.add_parser("delete-node", help="Delete a node and its connections")
    parser_del.add_argument("id", help="Node ID to remove")

    # YAML Commands
    parser_export = subparsers.add_parser("export-yaml", help="Export skill names and statuses to a YAML file")
    parser_export.add_argument("--file", default="skills_config.yaml", help="Output YAML file name")

    parser_import = subparsers.add_parser("import-yaml", help="Import and update skill names/statuses from a YAML file")
    parser_import.add_argument("--file", default="skills_config.yaml", help="Input YAML file name")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "status":
        show_status()
    elif args.command == "add":
        git_add(args)
    elif args.command == "commit":
        git_commit(args)
    elif args.command == "push":
        git_push(args)
    elif args.command == "create-node":
        add_node(args)
    elif args.command == "add-subnode":
        add_subnode(args)
    elif args.command == "connect":
        add_edge(args)
    elif args.command == "proposals":
        list_proposals()
    elif args.command == "approve":
        approve_proposal(args)
    elif args.command == "reject":
        reject_proposal(args)
    elif args.command == "delete-node":
        delete_node(args)
    elif args.command == "export-yaml":
        export_yaml(args)
    elif args.command == "import-yaml":
        import_yaml(args)

if __name__ == "__main__":
    main()
