import os
import json
import io
import time
import uuid
from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Response, Depends
from fastapi.responses import StreamingResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI(title="Math Tech-Tree Collaborative Wiki")

# Secret key for session management (normally read from environment)
SECRET_KEY = os.environ.get("SESSION_SECRET", "super-secret-key-132908")
app.add_middleware(SessionMiddleware, secret_key=SECRET_KEY)

DATA_FILE = "math_tree.json"
STRUCTURE_FILE = "structure_overrides.json"  # Add/remove nodes/edges without touching math_tree.json
STATUS_FILE = "node_status.json"   # Separate status store
CONTRIB_FILE = "contributions.json"
AUDIT_FILE = "audit_log.json"      # Change history log
UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Google client ID placeholder - users can fill this or use Mock Sign-in
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

class Subnode(BaseModel):
    id: str
    label: str
    status: str # Completed, In Progress, Locked

class Node(BaseModel):
    id: str
    label: str
    importance: str # High, Medium, Low
    status: str # Completed, In Progress, Locked
    comment: str
    x: Optional[float] = 100
    y: Optional[float] = 100
    shape: Optional[str] = "circle"
    subnodes: Optional[List[Subnode]] = []

class Edge(BaseModel):
    id: str
    source: str
    target: str

class GraphData(BaseModel):
    nodes: List[Node]
    edges: List[Edge]

class CommitChange(BaseModel):
    action: str # add, modify, delete
    type: str # node, edge
    id: str
    data: Optional[dict] = None # Detailed structure of Node or Edge

class GitCommit(BaseModel):
    id: str
    message: str
    author: dict
    timestamp: float
    changes: List[CommitChange]

class ContributionProposal(BaseModel):
    description: str
    commits: List[GitCommit]

# Helper to load/save JSON
def load_data() -> dict:
    if not os.path.exists(DATA_FILE):
        return {"nodes": [], "edges": []}
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            # Guarantee structure
            for node in data.get("nodes", []):
                if "shape" not in node:
                    node["shape"] = "circle"
                if "subnodes" not in node:
                    node["subnodes"] = []
            return data
        except json.JSONDecodeError:
            return {"nodes": [], "edges": []}

def save_data(data: dict):
    """Atomic write — write to temp file first, then rename to avoid corruption."""
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DATA_FILE)

def load_structure_overrides() -> dict:
    """Load structure_overrides.json: {added_nodes:[], removed_node_ids:[], added_edges:[], removed_edge_ids:[]}"""
    if not os.path.exists(STRUCTURE_FILE):
        return {"added_nodes": [], "removed_node_ids": [], "added_edges": [], "removed_edge_ids": []}
    with open(STRUCTURE_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"added_nodes": [], "removed_node_ids": [], "added_edges": [], "removed_edge_ids": []}

def save_structure_overrides(overrides: dict):
    tmp = STRUCTURE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(overrides, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STRUCTURE_FILE)

def load_contributions() -> list:
    if not os.path.exists(CONTRIB_FILE):
        return []
    with open(CONTRIB_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def save_contributions(contribs: list):
    with open(CONTRIB_FILE, "w", encoding="utf-8") as f:
        json.dump(contribs, f, ensure_ascii=False, indent=2)

def load_status() -> dict:
    """Load node_status.json: {nodeId: status_string}"""
    if not os.path.exists(STATUS_FILE):
        return {}
    with open(STATUS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def save_status(status_map: dict):
    with open(STATUS_FILE, "w", encoding="utf-8") as f:
        json.dump(status_map, f, ensure_ascii=False, indent=2)

def load_audit() -> list:
    if not os.path.exists(AUDIT_FILE):
        return []
    with open(AUDIT_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def append_audit(entry: dict):
    log = load_audit()
    log.append(entry)
    with open(AUDIT_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)

# Session Helpers
def get_current_user(request: Request):
    user = request.session.get("user")
    if not user:
        # Default anonymous guest user
        return {"id": "guest", "name": "Guest Reader", "email": "", "role": "guest"}
    return user

# AUTHENTICATION APIS
@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return user

@app.post("/api/auth/mock-login")
def mock_login(request: Request, body: dict):
    email = body.get("email", "contributor@test.com")
    name = body.get("name", "Test Contributor")
    role = body.get("role", "contributor") # admin, contributor
    
    user = {
        "id": f"google-{uuid.uuid4().hex[:8]}",
        "name": name,
        "email": email,
        "role": role
    }
    request.session["user"] = user
    return user

@app.post("/api/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"status": "logged_out"}

@app.post("/api/auth/google-login")
async def google_login(request: Request, body: dict):
    # This endpoint receives the credential token from Google Identity script
    credential = body.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Missing credential")
        
    try:
        # For simplicity and ease of offline deployment, decode the token payload locally.
        # In a fully strict environment, one would call google.oauth2.id_token.verify_oauth2_token.
        # Here we parse the JWT payload segment to extract name, email, sub (unique id)
        from jose import jwt
        payload = jwt.get_unverified_claims(credential)
        
        # Determine role (you can customize admin emails here)
        email = payload.get("email", "")
        role = "contributor"
        admin_emails = ["admin@test.com", "bckang@example.com", "bckang@gmail.com"] # Add admin emails
        if email in admin_emails or email.endswith("@deepmind.com"):
            role = "admin"
            
        user = {
            "id": f"google-{payload.get('sub')}",
            "name": payload.get("name", "Google User"),
            "email": email,
            "role": role
        }
        request.session["user"] = user
        return user
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid token: {str(e)}")

# WIKI / COLLABORATIVE CORE APIS
@app.get("/api/graph")
def get_graph(response: Response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    data = load_data()
    status_map = load_status()
    overrides = load_structure_overrides()

    # Apply structural overrides (added/removed nodes and edges)
    removed_node_ids = set(overrides.get("removed_node_ids", []))
    removed_edge_ids = set(overrides.get("removed_edge_ids", []))

    # Filter out removed nodes/edges
    data["nodes"] = [n for n in data.get("nodes", []) if n["id"] not in removed_node_ids]
    data["edges"] = [e for e in data.get("edges", []) if e.get("id") not in removed_edge_ids]

    # Add new nodes (skip if id already exists from base data)
    existing_node_ids = {n["id"] for n in data["nodes"]}
    for n in overrides.get("added_nodes", []):
        if n["id"] not in existing_node_ids:
            data["nodes"].append(n)

    # Add new edges (skip duplicates)
    existing_edge_keys = {(e["source"], e["target"]) for e in data["edges"]}
    for e in overrides.get("added_edges", []):
        if (e["source"], e["target"]) not in existing_edge_keys:
            data["edges"].append(e)

    # Merge edge curvatures
    edge_curvatures = overrides.get("edge_curvatures", {})
    for e in data["edges"]:
        # Edge ID can be present, otherwise use source-target string as fallback ID
        eid = e.get("id") or f"{e['source']}-{e['target']}"
        e["id"] = eid # Ensure every edge has an ID
        if eid in edge_curvatures:
            e["curvature"] = edge_curvatures[eid]

    # Merge saved statuses into nodes
    for node in data.get("nodes", []):
        nid = node.get("id")
        if nid in status_map:
            node["status"] = status_map[nid]
    return data

@app.get("/api/icons")
def get_icons():
    icons_dir = os.path.join(os.path.dirname(__file__), "static", "icons")
    if not os.path.exists(icons_dir):
        return []
    
    valid_exts = (".png", ".jpg", ".jpeg", ".svg")
    icons = []
    for f in os.listdir(icons_dir):
        if f.lower().endswith(valid_exts):
            icons.append(f)
    return sorted(icons)

@app.post("/api/graph")
def save_graph(data: GraphData, user: dict = Depends(get_current_user)):
    # Legacy endpoint — admin direct save of entire graph
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Direct save is only allowed for Admins.")
    save_data(data.dict())
    return {"status": "success"}

# ── NEW: Save node statuses (Completed/Locked/In Progress) ────────────────────
class StatusSaveRequest(BaseModel):
    changes: dict  # {nodeId: newStatus, ...}
    pr_description: Optional[str] = None  # If contributor, auto-create PR

@app.post("/api/graph/status")
def save_node_status(body: StatusSaveRequest, user: dict = Depends(get_current_user)):
    role = user.get("role", "guest")
    if role == "guest":
        raise HTTPException(status_code=403, detail="로그인이 필요합니다.")

    if role == "admin":
        # Admin: direct apply
        current = load_status()
        current.update(body.changes)
        save_status(current)
        append_audit({
            "type": "status_change", "user": user,
            "changes": body.changes, "timestamp": time.time(), "direct": True
        })
        return {"status": "saved"}
    else:
        # Contributor: create PR
        desc = body.pr_description or f"{user['name']}의 할당 상태 변경 요청 ({len(body.changes)}개 노드)"
        pr = {
            "id": f"pr-{int(time.time() * 1000)}",
            "type": "status",
            "contributor": user,
            "description": desc,
            "changes": body.changes,
            "status": "pending",
            "timestamp": time.time()
        }
        contribs = load_contributions()
        contribs.append(pr)
        save_contributions(contribs)
        append_audit({
            "type": "status_pr_submitted", "user": user,
            "pr_id": pr["id"], "changes": body.changes, "timestamp": time.time()
        })
        return {"status": "pr_submitted", "pr_id": pr["id"]}

# ── NEW: Save node description (name/comment) ─────────────────────────────────
class DescriptionSaveRequest(BaseModel):
    node_id: str
    field: str        # "label" or "comment"
    value: str
    pr_description: Optional[str] = None

@app.post("/api/graph/description")
def save_node_description(body: DescriptionSaveRequest, user: dict = Depends(get_current_user)):
    role = user.get("role", "guest")
    if role == "guest":
        raise HTTPException(status_code=403, detail="로그인이 필요합니다.")
    if body.field not in ("label", "comment"):
        raise HTTPException(status_code=400, detail="field must be 'label' or 'comment'")

    if role == "admin":
        data = load_data()
        for node in data["nodes"]:
            if node["id"] == body.node_id:
                node[body.field] = body.value
                break
        else:
            raise HTTPException(status_code=404, detail="Node not found")
        save_data(data)
        append_audit({
            "type": "description_change", "user": user, "node_id": body.node_id,
            "field": body.field, "value": body.value, "timestamp": time.time(), "direct": True
        })
        return {"status": "saved"}
    else:
        desc = body.pr_description or f"{user['name']}의 노드 설명 수정 요청 ({body.node_id})"
        pr = {
            "id": f"pr-{int(time.time() * 1000)}",
            "type": "description",
            "contributor": user,
            "description": desc,
            "changes": {"node_id": body.node_id, "field": body.field, "value": body.value},
            "status": "pending",
            "timestamp": time.time()
        }
        contribs = load_contributions()
        contribs.append(pr)
        save_contributions(contribs)
        append_audit({
            "type": "description_pr_submitted", "user": user, "pr_id": pr["id"],
            "node_id": body.node_id, "timestamp": time.time()
        })
        return {"status": "pr_submitted", "pr_id": pr["id"]}

@app.post("/api/graph/reset_progress")
def reset_graph_progress(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    data = load_data()
    count = 0
    for node in data["nodes"]:
        if node.get("status") == "Completed":
            node["status"] = "Locked"
            count += 1
    save_data(data)
    append_audit({
        "type": "reset_progress", "user": user, "reset_count": count, "timestamp": time.time()
    })
    return {"status": "success", "reset_count": count}

# ── Admin-only structure changes (add/remove node/edge) ────────────────────────
# Uses structure_overrides.json — never touches math_tree.json directly.
class StructureChange(BaseModel):
    action: str   # add_node | remove_node | add_edge | remove_edge
    data: dict

@app.post("/api/graph/structure")
def save_structure(body: StructureChange, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    overrides = load_structure_overrides()
    action = body.action
    d = body.data

    if action == "add_node":
        # Remove any existing override with same id first
        overrides["added_nodes"] = [n for n in overrides.get("added_nodes", []) if n["id"] != d["id"]]
        overrides["added_nodes"].append(d)
        # Also un-remove if it was in removed list
        overrides["removed_node_ids"] = [nid for nid in overrides.get("removed_node_ids", []) if nid != d["id"]]

    elif action == "remove_node":
        nid = d["id"]
        # Add to removed set
        if nid not in overrides.get("removed_node_ids", []):
            overrides.setdefault("removed_node_ids", []).append(nid)
        # Also remove from added_nodes if it was a custom added node
        overrides["added_nodes"] = [n for n in overrides.get("added_nodes", []) if n["id"] != nid]
        # Remove its edges from added_edges
        overrides["added_edges"] = [e for e in overrides.get("added_edges", []) if e["source"] != nid and e["target"] != nid]

    elif action == "add_edge":
        # Prevent duplicate
        exists = any(
            e["source"] == d["source"] and e["target"] == d["target"]
            for e in overrides.get("added_edges", [])
        )
        if not exists:
            overrides.setdefault("added_edges", []).append(d)

    elif action == "remove_edge":
        eid = d.get("id", "")
        # Remove from added_edges if it was a custom edge
        overrides["added_edges"] = [e for e in overrides.get("added_edges", []) if e.get("id") != eid]
        # Add to removed set for base edges
        if eid and eid not in overrides.get("removed_edge_ids", []):
            overrides.setdefault("removed_edge_ids", []).append(eid)
            
    elif action == "edit_edge_curvature":
        eid = d.get("id", "")
        curvature = d.get("curvature", 0.3)
        if eid:
            overrides.setdefault("edge_curvatures", {})[eid] = curvature

    else:
        raise HTTPException(status_code=400, detail="Unknown action")

    save_structure_overrides(overrides)
    append_audit({"type": action, "user": user, "data": d, "timestamp": time.time()})
    return {"status": "saved"}

# ── Audit Log ─────────────────────────────────────────────────────────────────
@app.get("/api/admin/audit")
def get_audit(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return load_audit()

@app.post("/api/contributions/submit")
def submit_contribution(proposal: ContributionProposal, user: dict = Depends(get_current_user)):
    if user.get("role") == "guest":
        raise HTTPException(status_code=401, detail="Guests cannot submit proposals. Please log in.")
    contribs = load_contributions()
    new_proposal = {
        "id": f"prop-{int(time.time() * 1000)}",
        "type": "legacy_commit",
        "contributor": user,
        "description": proposal.description,
        "commits": [c.dict() for c in proposal.commits],
        "status": "pending",
        "timestamp": time.time()
    }
    contribs.append(new_proposal)
    save_contributions(contribs)
    return {"status": "success", "proposal_id": new_proposal["id"]}

@app.get("/api/admin/contributions")
def list_contributions(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin panel access denied.")
    return load_contributions()

@app.post("/api/admin/contributions/{prop_id}/approve")
def approve_contribution(prop_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    contribs = load_contributions()
    found = False
    for c in contribs:
        if c["id"] == prop_id and c["status"] == "pending":
            pr_type = c.get("type", "legacy_commit")

            if pr_type == "status":
                current = load_status()
                current.update(c["changes"])
                save_status(current)

            elif pr_type == "description":
                ch = c["changes"]
                data = load_data()
                for node in data["nodes"]:
                    if node["id"] == ch["node_id"]:
                        node[ch["field"]] = ch["value"]
                        break
                save_data(data)

            else:  # legacy_commit
                current_tree = load_data()
                for commit in c.get("commits", []):
                    for change in commit["changes"]:
                        action = change["action"]; ctype = change["type"]
                        target_id = change["id"]; cdata = change["data"]
                        if ctype == "node":
                            if action == "add":
                                current_tree["nodes"] = [n for n in current_tree["nodes"] if n["id"] != target_id]
                                current_tree["nodes"].append(cdata)
                            elif action == "modify":
                                for idx, node in enumerate(current_tree["nodes"]):
                                    if node["id"] == target_id:
                                        current_tree["nodes"][idx] = cdata; break
                            elif action == "delete":
                                current_tree["nodes"] = [n for n in current_tree["nodes"] if n["id"] != target_id]
                                current_tree["edges"] = [e for e in current_tree["edges"] if e["source"] != target_id and e["target"] != target_id]
                        elif ctype == "edge":
                            if action == "add":
                                current_tree["edges"] = [e for e in current_tree["edges"] if e["id"] != target_id]
                                current_tree["edges"].append(cdata)
                            elif action == "delete":
                                current_tree["edges"] = [e for e in current_tree["edges"] if e["id"] != target_id]
                save_data(current_tree)

            c["status"] = "merged"
            c["reviewed_by"] = user
            c["reviewed_at"] = time.time()
            append_audit({"type": "pr_merged", "pr_id": prop_id, "user": user, "timestamp": time.time()})
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Pending contribution proposal not found.")
    save_contributions(contribs)
    return {"status": "success"}

@app.post("/api/admin/contributions/{prop_id}/reject")
def reject_contribution(prop_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")
    contribs = load_contributions()
    found = False
    for c in contribs:
        if c["id"] == prop_id and c["status"] == "pending":
            c["status"] = "rejected"
            c["reviewed_by"] = user
            c["reviewed_at"] = time.time()
            append_audit({"type": "pr_rejected", "pr_id": prop_id, "user": user, "timestamp": time.time()})
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Pending contribution proposal not found.")
    save_contributions(contribs)
    return {"status": "success"}

# MULTI-FORMAT EXPORT (TSV, CSV, Excel)
@app.get("/api/export/{fmt}")
def export_file(fmt: str):
    data = load_data()
    
    # Format subnodes to string to serialize in table format nicely
    flat_nodes = []
    for n in data.get("nodes", []):
        subnodes_str = json.dumps(n.get("subnodes", []), ensure_ascii=False)
        flat_nodes.append({
            "id": n.get("id"),
            "label": n.get("label"),
            "importance": n.get("importance"),
            "status": n.get("status"),
            "comment": n.get("comment"),
            "shape": n.get("shape", "circle"),
            "subnodes": subnodes_str,
            "x": n.get("x"),
            "y": n.get("y")
        })

    nodes_df = pd.DataFrame(flat_nodes)
    if nodes_df.empty:
        nodes_df = pd.DataFrame(columns=['id', 'label', 'importance', 'status', 'comment', 'shape', 'subnodes', 'x', 'y'])
        
    edges_df = pd.DataFrame(data.get("edges", []))
    if edges_df.empty:
        edges_df = pd.DataFrame(columns=['id', 'source', 'target'])

    if fmt == "excel":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            nodes_df.to_excel(writer, sheet_name='Nodes', index=False)
            edges_df.to_excel(writer, sheet_name='Edges', index=False)
        output.seek(0)
        return StreamingResponse(
            output,
            headers={'Content-Disposition': 'attachment; filename="math_tech_tree.xlsx"'},
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    elif fmt == "csv":
        csv_data = nodes_df.to_csv(index=False)
        return StreamingResponse(
            io.BytesIO(csv_data.encode('utf-8')),
            headers={'Content-Disposition': 'attachment; filename="math_tech_tree_nodes.csv"'},
            media_type="text/csv"
        )
    elif fmt == "tsv":
        tsv_data = nodes_df.to_csv(sep='\t', index=False)
        return StreamingResponse(
            io.BytesIO(tsv_data.encode('utf-8')),
            headers={'Content-Disposition': 'attachment; filename="math_tech_tree_nodes.tsv"'},
            media_type="text/tab-separated-values"
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid format.")

# MULTI-FILE BATCH IMPORT
@app.post("/api/import/batch")
async def import_batch_files(files: List[UploadFile] = File(...)):
    combined_nodes = {}
    combined_edges = []
    
    # Load current graph to merge or reference
    existing_data = load_data()
    
    # Key current structure maps
    for n in existing_data.get("nodes", []):
        combined_nodes[n["id"]] = n
    for e in existing_data.get("edges", []):
        combined_edges.append(e)
        
    imported_nodes_count = 0
    imported_edges_count = 0
    
    for file in files:
        filename = file.filename.lower()
        contents = await file.read()
        
        nodes_list = []
        edges_list = []
        
        try:
            if filename.endswith('.xlsx') or filename.endswith('.xls'):
                excel_file = io.BytesIO(contents)
                xl = pd.ExcelFile(excel_file)
                
                # Check sheets
                if 'Nodes' in xl.sheet_names:
                    df_nodes = pd.read_excel(excel_file, sheet_name='Nodes')
                    nodes_list = df_nodes.fillna("").to_dict(orient='records')
                elif len(xl.sheet_names) > 0:
                    df_nodes = pd.read_excel(excel_file, sheet_name=xl.sheet_names[0])
                    nodes_list = df_nodes.fillna("").to_dict(orient='records')
                    
                if 'Edges' in xl.sheet_names:
                    df_edges = pd.read_excel(excel_file, sheet_name='Edges')
                    edges_list = df_edges.fillna("").to_dict(orient='records')
                    
            elif filename.endswith('.csv'):
                csv_str = contents.decode('utf-8')
                df_nodes = pd.read_csv(io.StringIO(csv_str))
                nodes_list = df_nodes.fillna("").to_dict(orient='records')
                
            elif filename.endswith('.tsv') or filename.endswith('.txt'):
                tsv_str = contents.decode('utf-8')
                df_nodes = pd.read_csv(io.StringIO(tsv_str), sep='\t')
                nodes_list = df_nodes.fillna("").to_dict(orient='records')
            else:
                continue # Skip unknown formats in batch
                
            # Process nodes
            for n in nodes_list:
                node_id = str(n.get('id')).strip() if n.get('id') else f"node-{int(time.time()*1000)}"
                if not node_id:
                    continue
                
                # Parse subnodes field if present
                subnodes_data = []
                subnodes_raw = n.get('subnodes', '')
                if subnodes_raw:
                    try:
                        # Could be JSON string
                        subnodes_data = json.loads(subnodes_raw)
                    except:
                        pass
                
                combined_nodes[node_id] = {
                    "id": node_id,
                    "label": str(n.get('label', '새로운 과목')),
                    "importance": str(n.get('importance', 'Medium')),
                    "status": str(n.get('status', 'Locked')),
                    "comment": str(n.get('comment', '')),
                    "shape": str(n.get('shape', 'circle')),
                    "subnodes": subnodes_data,
                    "x": float(n.get('x', 100)) if n.get('x') != "" else 100,
                    "y": float(n.get('y', 100)) if n.get('y') != "" else 100
                }
                imported_nodes_count += 1
                
            # Process edges
            for e in edges_list:
                src = str(e.get('source')).strip()
                tgt = str(e.get('target')).strip()
                if src and tgt:
                    edge_id = str(e.get('id', f"edge-{src}-{tgt}")).strip()
                    # Avoid duplicated edges
                    if not any(item['source'] == src and item['target'] == tgt for item in combined_edges):
                        combined_edges.append({
                            "id": edge_id,
                            "source": src,
                            "target": tgt
                        })
                        imported_edges_count += 1
                        
        except Exception as err:
            raise HTTPException(status_code=500, detail=f"Failed parsing file {file.filename}: {str(err)}")
            
    # Save back
    new_data = {
        "nodes": list(combined_nodes.values()),
        "edges": combined_edges
    }
    save_data(new_data)
    
    return {
        "status": "success", 
        "total_nodes": len(new_data["nodes"]), 
        "total_edges": len(new_data["edges"]),
        "imported_nodes": imported_nodes_count,
        "imported_edges": imported_edges_count
    }

# IMAGE PASTE UPLOAD API
@app.post("/api/upload/image")
async def upload_paste_image(file: UploadFile = File(...)):
    filename = f"paste_{int(time.time() * 1000)}.png"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        # Return web accessible path
        return {"url": f"/uploads/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")

# Obsidian Export
@app.get("/api/export/obsidian")
def export_obsidian_canvas():
    data = load_data()
    obsidian_canvas = {"nodes": [], "edges": []}
    
    status_colors = {
        "Completed": "4",
        "In Progress": "2",
        "Locked": "6"
    }
    
    for n in data.get("nodes", []):
        label = n.get("label", "무제")
        comment = n.get("comment", "")
        importance = n.get("importance", "Medium")
        status = n.get("status", "Locked")
        
        # Calculate subnodes count & complete percentage
        subnodes = n.get("subnodes", [])
        total_sub = len(subnodes)
        completed_sub = sum(1 for s in subnodes if s.get("status") == "Completed")
        pct = int((completed_sub / total_sub) * 100) if total_sub > 0 else 0
        
        text_content = f"### 📌 {label}\n**중요도**: {importance} | **상태**: {status}\n**체크포인트**: {completed_sub}/{total_sub} ({pct}%)\n\n---\n\n{comment}"
        
        canvas_node = {
            "id": n["id"],
            "type": "text",
            "text": text_content,
            "x": int(n.get("x", 0) * 1.5),
            "y": int(n.get("y", 0) * 1.5),
            "width": 300,
            "height": 220,
            "color": status_colors.get(status, "3")
        }
        obsidian_canvas["nodes"].append(canvas_node)
        
    for e in data.get("edges", []):
        canvas_edge = {
            "id": e["id"],
            "fromNode": e["source"],
            "fromSide": "right",
            "toNode": e["target"],
            "toSide": "left"
        }
        obsidian_canvas["edges"].append(canvas_edge)

    canvas_json = json.dumps(obsidian_canvas, ensure_ascii=False, indent=2)
    output = io.BytesIO(canvas_json.encode('utf-8'))
    
    headers = {
        'Content-Disposition': 'attachment; filename="Math_Tech_Tree.canvas"'
    }
    return StreamingResponse(
        output,
        headers=headers,
        media_type="application/json"
    )

if not os.path.exists("static"):
    os.makedirs("static")

# Static files mapping (serving uploads as well)
app.mount("/uploads", StaticFiles(directory="static/uploads"), name="uploads")
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
