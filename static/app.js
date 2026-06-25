// State Management
let graph = null;
let graphData = { nodes: [], edges: [] };
let baseGraphData = { nodes: [], edges: [] };
let stagedChanges = [];
let localCommits = [];
let selectedNodes = []; // Support multiple node selections
let selectedNode = null;
let animationEnabled = false;
let currentTheme = 'poe'; // Force default dark theme
localStorage.setItem('theme', 'poe'); // Wipe any saved light mode setting to ensure default is dark
let currentLayout = 'preset';
let currentOrbit = 'none'; // Orbit motion disabled by default

// Orbit animation loop control variables
let orbitAnimationFrameId = null;
let orbitTime = 0;

// User state
let currentUser = { id: "guest", name: "Guest Reader", email: "", role: "guest" };

// DOM Elements
const emptyState = document.getElementById('empty-state');
const editorState = document.getElementById('editor-state');
const editorTitle = document.getElementById('editor-title');
const inputLabel = document.getElementById('nodeLabel');
const selectImportance = document.getElementById('nodeImportance');
const selectStatus = document.getElementById('nodeStatus');
const selectShape = document.getElementById('nodeShape');
const textComment = document.getElementById('nodeComment');
const previewComment = document.getElementById('commentPreview');
const btnTabEdit = document.getElementById('btnTabEdit');
const btnTabPreview = document.getElementById('btnTabPreview');
const btnApply = document.getElementById('btnApplyNodeChanges');
const btnDelete = document.getElementById('btnDeleteNode');
const btnSaveAll = document.getElementById('btnSaveAll');
const animToggle = document.getElementById('animationToggle');
const themeSelect = document.getElementById('themeSelect');
const layoutSelect = document.getElementById('layoutSelect');
const orbitSelect = document.getElementById('orbitSelect');
const btnExportMenu = document.getElementById('btnExportMenu');
const exportMenu = document.getElementById('exportMenu');
const importFile = document.getElementById('importFile');

// Subnode Collapsible Elements
const btnToggleSubnodes = document.getElementById('btnToggleSubnodes');
const subnodesContainer = document.getElementById('subnodes-container');
const btnAddSubnode = document.getElementById('btnAddSubnode');
const subnodesListBody = document.getElementById('subnodes-list-body');
const subnodeVisSelect = document.getElementById('subnodeVisSelect');
const subnodeRotSelect = document.getElementById('subnodeRotSelect');
const subnodeSpeedRange = document.getElementById('subnodeSpeedRange');

let subnodesVisible = true; // Subnode satellites visibility flag
let subnodesRotationEnabled = false;
let subnodesRotationSpeed = 1.0;

// Theme Color Settings mapping
const themeColors = {
  poe: {
    Completed: { stroke: '#00ff87', fill: '#00331b', glow: 'rgba(0, 255, 135, 0.7)' },
    'In Progress': { stroke: '#ff9f00', fill: '#3a2000', glow: 'rgba(255, 159, 0, 0.7)' },
    Locked: { stroke: '#a855f7', fill: '#240d3a', glow: 'rgba(168, 85, 247, 0.5)' },
    edgeDefault: '#2e4a75',
    edgeFlow: '#00ff87',
    text: '#e2e8f0'
  },
  cyber: {
    Completed: { stroke: '#00f0ff', fill: '#082535', glow: 'rgba(0, 240, 255, 0.8)' },
    'In Progress': { stroke: '#ff007f', fill: '#32021b', glow: 'rgba(255, 0, 127, 0.8)' },
    Locked: { stroke: '#ffff00', fill: '#252500', glow: 'rgba(255, 255, 0, 0.6)' },
    edgeDefault: '#ec4899',
    edgeFlow: '#00f0ff',
    text: '#f8fafc'
  },
  light: {
    Completed: { stroke: '#10b981', fill: '#ecfdf5', glow: 'rgba(16, 185, 129, 0.2)' },
    'In Progress': { stroke: '#f59e0b', fill: '#fffbeb', glow: 'rgba(245, 158, 11, 0.2)' },
    Locked: { stroke: '#64748b', fill: '#f8fafc', glow: 'rgba(100, 116, 139, 0.1)' },
    edgeDefault: '#cbd5e1',
    edgeFlow: '#2563eb',
    text: '#0f172a'
  },
  classic: {
    Completed: { stroke: '#22c55e', fill: '#14532d', glow: 'rgba(34, 197, 94, 0.3)' },
    'In Progress': { stroke: '#eab308', fill: '#713f12', glow: 'rgba(234, 179, 8, 0.3)' },
    Locked: { stroke: '#71717a', fill: '#27272a', glow: 'rgba(113, 113, 122, 0.2)' },
    edgeDefault: '#3f3f46',
    edgeFlow: '#3b82f6',
    text: '#f4f4f5'
  },
  phylo: {
    Completed: { stroke: '#2e7d32', fill: '#e8f5e9', glow: 'rgba(46, 125, 50, 0.1)' },
    'In Progress': { stroke: '#ed6c02', fill: '#fff3e0', glow: 'rgba(237, 108, 2, 0.1)' },
    Locked: { stroke: '#757575', fill: '#f5f5f5', glow: 'rgba(117, 117, 117, 0.05)' },
    edgeDefault: '#424242',
    edgeFlow: '#2e7d32',
    text: '#1a1a1a'
  }
};

// Initial API Load
async function fetchGraphData() {
  try {
    await checkAuthStatus();
    const response = await fetch('/api/graph');
    graphData = await response.json();
    baseGraphData = JSON.parse(JSON.stringify(graphData));
    stagedChanges = [];
    localCommits = [];
    document.body.className = `theme-${currentTheme}`;
    const oldTransform = graph ? graph.transform : null;
    initGraph();
    if (oldTransform && graph && graph.zoom && graph.d3canvas) {
      const transform = d3.zoomIdentity.translate(oldTransform.x, oldTransform.y).scale(oldTransform.k);
      graph.d3canvas.call(graph.zoom.transform, transform);
    }
    updateCharacterStats();
    updateGitWorkspace();
  } catch (error) {
    console.error('Failed to load tech tree data:', error);
  }
}

// Update Character Stats Panel (Set Effects)
function updateCharacterStats() {
    const statsPanel = document.getElementById('character-stats-list');
    if(!statsPanel) return;
    
    let allStats = {};
    
    graphData.nodes.forEach(n => {
        if (n.status === 'Completed' && n.stats) {
            n.stats.forEach(stat => {
                // Try to extract a numeric prefix to aggregate
                const match = stat.match(/^([+-]?\d+)(.*)/);
                if (match) {
                    const val = parseInt(match[1]);
                    const suffix = match[2];
                    if (allStats[suffix]) {
                        allStats[suffix] += val;
                    } else {
                        allStats[suffix] = val;
                    }
                } else {
                    if (allStats[stat]) {
                        allStats[stat] += 1;
                    } else {
                        allStats[stat] = 1;
                    }
                }
            });
        }
    });
    
    statsPanel.innerHTML = '';
    const keys = Object.keys(allStats);
    if (keys.length === 0) {
        statsPanel.innerHTML = '<div class="empty-stats">활성화된 스킬이 없습니다.</div>';
        return;
    }
    
    keys.sort().forEach(key => {
        const div = document.createElement('div');
        div.className = 'stat-item';
        const val = allStats[key];
        
        if (key.startsWith(' ') || key.startsWith('%')) {
            div.textContent = (val > 0 ? '+' : '') + val + key;
        } else {
            div.textContent = val > 1 ? `${key} (x${val})` : key;
        }
        
        if (div.textContent.toLowerCase().includes('reduced') || div.textContent.includes('-')) {
            div.style.color = '#ff6b6b';
        }
        
        statsPanel.appendChild(div);
    });
}

// Save Graph via API (role-based)
async function saveGraphData() {
  const role = currentUser?.role || 'guest';
  if (role === 'guest') {
    alert('저장하려면 로그인이 필요합니다.');
    return;
  }

  // Collect current status changes from graphData
  const changes = {};
  graphData.nodes.forEach(n => { changes[n.id] = n.status; });

  const prDesc = role === 'admin' ? null : `${currentUser.name}의 할당 상태 변경 요청`;

  try {
    const response = await fetch('/api/graph/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes, pr_description: prDesc })
    });
    const res = await response.json();
    if (response.ok) {
      if (res.status === 'saved') {
        showToast('✅ 할당 상태가 저장되었습니다.', 'success');
      } else if (res.status === 'pr_submitted') {
        showToast(`📬 PR이 제출되었습니다 (${res.pr_id})`, 'info');
      }
    } else {
      showToast('저장 실패: ' + (res.detail || '알 수 없는 오류'), 'error');
    }
  } catch (error) {
    console.error('Save failed:', error);
    showToast('네트워크 오류로 저장에 실패했습니다.', 'error');
  }
}

// Toast notification
function showToast(msg, type = 'info') {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;padding:10px 22px;border-radius:8px;font-size:14px;font-family:Fontin,serif;transition:opacity 0.4s;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.background = type === 'success' ? '#1a4a2e' : type === 'error' ? '#4a1a1a' : '#2a1e14';
  toast.style.color = type === 'success' ? '#4ade80' : type === 'error' ? '#f87171' : '#c8a96e';
  toast.style.border = `1px solid ${type === 'success' ? '#4ade80' : type === 'error' ? '#f87171' : '#8a6a2e'}`;
  toast.style.opacity = '1';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ── Right-click context menu ────────────────────────────────────────────────
let ctxTargetNode = null;
let edgeModeActive = false;
let edgeModeSourceNode = null;

// Track where canvas was right-clicked (in graph coordinates)
let canvasCtxPos = { x: 0, y: 0 };

function setupContextMenu() {
  const menu = document.getElementById('ctx-menu');
  if (!menu) return;

  document.getElementById('ctx-close')?.addEventListener('click', closeCtxMenu);
  document.getElementById('ctx-edit-node')?.addEventListener('click', () => { openInlineEdit(ctxTargetNode); closeCtxMenu(); });
  // Legacy IDs kept for backward compat (may no longer exist in HTML)
  document.getElementById('ctx-edit-label')?.addEventListener('click', () => { openInlineEdit(ctxTargetNode); closeCtxMenu(); });
  document.getElementById('ctx-edit-comment')?.addEventListener('click', () => { openInlineEdit(ctxTargetNode); closeCtxMenu(); });
  document.getElementById('ctx-add-edge')?.addEventListener('click', () => { startEdgeMode(ctxTargetNode); closeCtxMenu(); });
  document.getElementById('ctx-remove-node')?.addEventListener('click', () => { adminRemoveNode(ctxTargetNode); closeCtxMenu(); });

  // Canvas right-click menu
  const canvasMenu = document.getElementById('canvas-ctx-menu');
  document.getElementById('canvas-ctx-close')?.addEventListener('click', closeCanvasCtxMenu);
  document.getElementById('canvas-ctx-reset-view')?.addEventListener('click', () => {
    if (graph) graph.resetView();
    closeCanvasCtxMenu();
  });
  document.getElementById('canvas-ctx-add-node')?.addEventListener('click', () => {
    if (currentUser?.role !== 'admin') { showToast('Admin만 노드를 추가할 수 있습니다.', 'error'); closeCanvasCtxMenu(); return; }
    adminAddNodeAtPos(canvasCtxPos.x, canvasCtxPos.y);
    closeCanvasCtxMenu();
  });

  // Close menus on outside click
  document.addEventListener('click', (e) => {
    if (menu && !menu.contains(e.target)) closeCtxMenu();
    if (canvasMenu && !canvasMenu.contains(e.target)) closeCanvasCtxMenu();
  });
}

function openCtxMenu(node, clientX, clientY) {
  const menu = document.getElementById('ctx-menu');
  if (!menu || !node) return;
  ctxTargetNode = node;
  document.getElementById('ctx-node-title').textContent = node.label || node.name || node.id;
  const isAdmin = currentUser?.role === 'admin';
  const adminSection = document.getElementById('ctx-admin-section');
  if (adminSection) adminSection.style.display = isAdmin ? 'block' : 'none';
  // Keep menu inside viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  const mw = 210, mh = isAdmin ? 200 : 130;
  menu.style.left = Math.min(clientX, vw - mw) + 'px';
  menu.style.top = Math.min(clientY, vh - mh) + 'px';
  menu.style.display = 'block';
}

function closeCtxMenu() {
  const menu = document.getElementById('ctx-menu');
  if (menu) menu.style.display = 'none';
}

function openCanvasCtxMenu(clientX, clientY, graphX, graphY) {
  const menu = document.getElementById('canvas-ctx-menu');
  if (!menu) return;
  canvasCtxPos = { x: graphX, y: graphY };
  const isAdmin = currentUser?.role === 'admin';
  const addBtn = document.getElementById('canvas-ctx-add-node');
  if (addBtn) addBtn.style.display = isAdmin ? 'flex' : 'none';
  const vw = window.innerWidth, vh = window.innerHeight;
  menu.style.left = Math.min(clientX, vw - 200) + 'px';
  menu.style.top = Math.min(clientY, vh - 120) + 'px';
  menu.style.display = 'block';
}

function closeCanvasCtxMenu() {
  const menu = document.getElementById('canvas-ctx-menu');
  if (menu) menu.style.display = 'none';
}

// ── Custom Node Add UI ───────────────────────────────────────────────────────
let pendingAddNodePos = null;

function openAddNodePopup(x, y) {
  pendingAddNodePos = { x, y };
  // Reset icon selection
  window.selectedIconNode = null;
  const previewImg = document.getElementById('addNodeIconImg');
  const placeholder = document.getElementById('addNodeIconPlaceholder');
  if (previewImg) { previewImg.src = ''; previewImg.style.display = 'none'; }
  if (placeholder) placeholder.style.display = 'inline';

  const popup = document.getElementById('addNodePopup');
  const posText = document.getElementById('addNodePosText');
  const input = document.getElementById('addNodeLabelInput');
  if (!popup) return;

  posText.textContent = `위치: (${Math.round(x)}, ${Math.round(y)})`;
  input.value = '';
  popup.style.display = 'block';
  
  // Center popup
  const vw = window.innerWidth, vh = window.innerHeight;
  popup.style.left = Math.max(16, (vw - 300) / 2) + 'px';
  popup.style.top = Math.max(16, (vh - 200) / 2) + 'px';
  
  setTimeout(() => input.focus(), 50);
}

window.closeAddNodePopup = function() {
  const popup = document.getElementById('addNodePopup');
  if (popup) popup.style.display = 'none';
  pendingAddNodePos = null;
};

window.submitAddNode = async function() {
  if (!pendingAddNodePos) return;
  const input = document.getElementById('addNodeLabelInput');
  const label = input.value.trim();
  if (!label) {
    showToast('노드 이름을 입력하세요.', 'error');
    return;
  }
  
  let iconToUse = window.selectedIconNode || 'normalActive_Art_2DArt_SkillIcons_passives_AtlasTrees_AulBloodlineNode.png.png';
  
  const { x, y } = pendingAddNodePos;
  const newNode = {
    id: `custom_${Date.now()}`,
    label: label,
    name: label,
    importance: 'Medium',
    status: 'Locked',
    comment: `# ${label}\n\n설명을 추가하세요.`,
    x: x,
    y: y,
    shape: 'circle',
    icon: iconToUse,
    group: '',
    orbit: 0,
    orbit_index: 0,
    subnodes: [],
    stats: []
  };
  
  try {
    const res = await fetch('/api/graph/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_node', data: newNode })
    });
    if (res.ok) {
      showToast(`✅ "${label}" 노드가 추가됐습니다.`, 'success');
      closeAddNodePopup();
      await fetchGraphData();
    } else {
      const d = await res.json();
      showToast('노드 추가 실패: ' + (d.detail || '오류'), 'error');
    }
  } catch(err) {
    showToast('네트워크 오류: ' + err.message, 'error');
  }
}

// Admin: Add node at specific canvas coordinates
function adminAddNodeAtPos(x, y) {
  openAddNodePopup(x, y);
}

// ── Inline Node Edit Popup (merged label + comment) ────────────────────────
function openNodeEditModal(field) {
  // Legacy shim — just open unified popup
  openInlineEdit(ctxTargetNode);
}

function openInlineEdit(node) {
  if (!node) return;
  ctxTargetNode = node;
  const popup  = document.getElementById('inlineEditPopup');
  const nodeId = document.getElementById('inlineEditNodeId');
  const labelEl   = document.getElementById('inlineEditLabel');
  const commentEl = document.getElementById('inlineEditComment');
  const prDesc = document.getElementById('inlineEditPrDesc');
  if (!popup) return;

  nodeId.textContent = `ID: ${node.serial_id || node.id}  ·  ${node.label || ''}`;
  if (labelEl)   labelEl.value   = node.label   || '';
  if (commentEl) commentEl.value = node.comment  || '';
  prDesc.value = '';

  const role = currentUser?.role || 'guest';
  prDesc.placeholder = role === 'admin'
    ? '(Admin: 즉시 반영됨)'
    : '변경 사유 — PR로 제출됩니다';

  popup.style.display = 'block';
  const vw = window.innerWidth, vh = window.innerHeight;
  popup.style.left = Math.max(16, (vw - 460) / 2) + 'px';
  popup.style.top  = Math.max(16, (vh - 360) / 2) + 'px';
  if (labelEl) labelEl.focus();
}

window.closeInlineEdit = function() {
  const popup = document.getElementById('inlineEditPopup');
  if (popup) popup.style.display = 'none';
};

window.submitInlineEdit = async function() {
  if (!ctxTargetNode) return;
  const labelEl   = document.getElementById('inlineEditLabel');
  const commentEl = document.getElementById('inlineEditComment');
  const prDesc    = document.getElementById('inlineEditPrDesc').value.trim();
  const newLabel   = labelEl?.value.trim()   ?? '';
  const newComment = commentEl?.value.trim() ?? '';
  const role = currentUser?.role || 'guest';
  if (role === 'guest') { showToast('로그인이 필요합니다.', 'error'); return; }

  try {
    // Save label
    const resLabel = await fetch('/api/graph/description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: ctxTargetNode.id, field: 'label', value: newLabel, pr_description: prDesc || undefined })
    });
    // Save comment
    const resComment = await fetch('/api/graph/description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: ctxTargetNode.id, field: 'comment', value: newComment, pr_description: prDesc || undefined })
    });
    const dataLabel   = await resLabel.json();
    const dataComment = await resComment.json();

    if (resLabel.ok && resComment.ok) {
      const localNode = graphData.nodes.find(n => n.id === ctxTargetNode.id);
      if (localNode) { localNode.label = newLabel; localNode.comment = newComment; }
      ctxTargetNode.label   = newLabel;
      ctxTargetNode.comment = newComment;
      if (graph) graph.render();
      if (dataLabel.status === 'saved') {
        showToast('✅ 저장되었습니다.', 'success');
      } else {
        showToast('📬 PR이 제출되었습니다.', 'info');
      }
      closeInlineEdit();
    } else {
      const err = dataLabel.detail || dataComment.detail || '저장 실패';
      showToast('오류: ' + err, 'error');
    }
  } catch(err) {
    showToast('네트워크 오류', 'error');
  }
};

function setupNodeEditModal() {
  // Legacy modal — kept for compatibility but inline popup is primary
  document.getElementById('btnCloseNodeEdit')?.addEventListener('click', () => {
    document.getElementById('nodeEditModal').classList.add('hidden');
  });
  document.getElementById('btnCancelNodeEdit')?.addEventListener('click', () => {
    document.getElementById('nodeEditModal').classList.add('hidden');
  });
}

// ── Admin: Edge connect mode ─────────────────────────────────────────────────
function startEdgeMode(sourceNode) {
  edgeModeActive = true;
  edgeModeSourceNode = sourceNode;
  const btn = document.getElementById('btnAdminEdgeMode');
  if (btn) { btn.style.background = '#c8a96e'; btn.style.color = '#000'; }
  showToast('🔗 엣지 연결 모드: 연결할 대상 노드를 클릭하세요.', 'info');
}

function cancelEdgeMode() {
  edgeModeActive = false;
  edgeModeSourceNode = null;
  const btn = document.getElementById('btnAdminEdgeMode');
  if (btn) { btn.style.background = ''; btn.style.color = ''; }
}

async function adminAddEdge(sourceNode, targetNode) {
  // Admin can connect any two nodes freely
  // Only check for duplicate edge
  const alreadyExists = graphData.edges.some(
    e => (e.source === sourceNode.id && e.target === targetNode.id) ||
         (e.source === targetNode.id && e.target === sourceNode.id)
  );
  if (alreadyExists) {
    showToast('⚠️ 이미 연결된 노드입니다.', 'error');
    cancelEdgeMode();
    return;
  }
  const edgeId = `edge-${sourceNode.id}-${targetNode.id}-${Date.now()}`;
  try {
    const res = await fetch('/api/graph/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_edge', data: { id: edgeId, source: sourceNode.id, target: targetNode.id } })
    });
    if (res.ok) {
      await fetchGraphData(); // Reload to reflect change
      showToast('✅ 엣지가 추가되었습니다.', 'success');
    } else {
      const d = await res.json();
      showToast('오류: ' + (d.detail || '엣지 추가 실패'), 'error');
    }
  } catch(err) {
    showToast('네트워크 오류: ' + err.message, 'error');
  }
  cancelEdgeMode();
}

// ── Icon Picker Logic ─────────────────────────────────────────────────────────
window.selectedIconNode = null;
let allIconsCache = [];

window.openIconPicker = async function() {
  const modal = document.getElementById('iconPickerModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.getElementById('iconSearchInput').value = '';
  
  if (allIconsCache.length === 0) {
    try {
      const res = await fetch('/api/icons');
      if (res.ok) allIconsCache = await res.json();
    } catch(err) {
      console.error('Failed to load icons', err);
    }
  }
  window.filterIcons();
};

window.closeIconPicker = function() {
  const modal = document.getElementById('iconPickerModal');
  if (modal) modal.classList.add('hidden');
};

window.filterIcons = function() {
  const q = document.getElementById('iconSearchInput').value.toLowerCase();
  const grid = document.getElementById('iconGrid');
  grid.innerHTML = '';
  
  const filtered = allIconsCache.filter(icon => icon.toLowerCase().includes(q));
  // Render up to 200 items for performance
  const limit = Math.min(filtered.length, 200);
  
  for (let i = 0; i < limit; i++) {
    const icon = filtered[i];
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = '/static/icons/' + icon;
    img.style.width = '48px';
    img.style.height = '48px';
    img.style.objectFit = 'contain';
    img.style.cursor = 'pointer';
    img.style.border = '1px solid #3a2e1e';
    img.style.borderRadius = '4px';
    img.title = icon;
    
    img.onclick = () => {
      window.selectedIconNode = icon;
      const previewImg = document.getElementById('addNodeIconImg');
      const placeholder = document.getElementById('addNodeIconPlaceholder');
      if (previewImg) { previewImg.src = '/static/icons/' + icon; previewImg.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
      closeIconPicker();
    };
    grid.appendChild(img);
  }
};

// ── Edge Edit Popup (Right-click edge) ───────────────────────────────────────
let edgeEditTarget = null;

window.updateEdgeCurvaturePreview = function(val) {
  if (edgeEditTarget && graph) {
    edgeEditTarget.curvature = parseFloat(val);
    graph.render();
  }
};

function openEdgeEditPopup(edge, x, y) {
  edgeEditTarget = edge;
  const popup = document.getElementById('edgeEditPopup');
  const infoText = document.getElementById('edgeEditInfoText');
  const slider = document.getElementById('edgeCurvatureSlider');
  const valText = document.getElementById('edgeCurvatureVal');
  if (!popup) return;

  const n1 = edge.sourceNode?.label || edge.source;
  const n2 = edge.targetNode?.label || edge.target;
  infoText.textContent = `연결: ${n1} ↔ ${n2}`;
  
  const currentCurv = edge.curvature !== undefined ? edge.curvature : (graph ? graph.curvature : 0.3);
  slider.value = currentCurv;
  valText.innerText = currentCurv;
  
  popup.style.display = 'block';
  popup.style.left = Math.min(x, window.innerWidth - 280) + 'px';
  popup.style.top = Math.min(y, window.innerHeight - 150) + 'px';
}

window.closeEdgeEditPopup = function() {
  const popup = document.getElementById('edgeEditPopup');
  if (popup) popup.style.display = 'none';
  edgeEditTarget = null;
};

window.submitEdgeEdit = async function() {
  if (!edgeEditTarget) return;
  const slider = document.getElementById('edgeCurvatureSlider');
  const val = parseFloat(slider.value);
  
  // Find edge ID or use source-target as fallback
  const edgeId = edgeEditTarget.id || `${edgeEditTarget.source}-${edgeEditTarget.target}`;
  
  try {
    const res = await fetch('/api/graph/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'edit_edge_curvature', 
        data: { id: edgeId, curvature: val } 
      })
    });
    if (res.ok) {
      showToast('✅ 엣지 곡률이 저장되었습니다.', 'success');
      closeEdgeEditPopup();
      await fetchGraphData();
    } else {
      const d = await res.json();
      showToast('저장 실패: ' + (d.detail || '오류'), 'error');
    }
  } catch(err) {
    showToast('네트워크 오류: ' + err.message, 'error');
  }
}

async function adminRemoveNode(node) {
  if (!node || currentUser?.role !== 'admin') return;
  if (!confirm(`"${node.label}" 노드를 삭제하시겠습니까? 연결된 엣지도 모두 제거됩니다.`)) return;
  try {
    const res = await fetch('/api/graph/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_node', data: { id: node.id } })
    });
    if (res.ok) {
      graphData.nodes = graphData.nodes.filter(n => n.id !== node.id);
      graphData.edges = graphData.edges.filter(e => e.source !== node.id && e.target !== node.id);
      fetchGraphData();
      showToast('✅ 노드가 삭제되었습니다.', 'success');
    } else {
      const d = await res.json();
      showToast('오류: ' + (d.detail || '삭제 실패'), 'error');
    }
  } catch(err) {
    showToast('네트워크 오류', 'error');
  }
}

// ── Admin Toolbar setup ──────────────────────────────────────────────────────
function setupAdminToolbar() {
  // Node Add — use center of current viewport
  document.getElementById('btnAdminAddNode')?.addEventListener('click', () => {
    if (currentUser?.role !== 'admin') { showToast('Admin만 가능합니다.', 'error'); return; }
    
    // Place new node at the current viewport center (in graph coordinates)
    let cx = 0, cy = 0;
    if (graph && graph.transform) {
      cx = (-graph.transform.x) / graph.transform.k + (graph.canvas.width / 2) / graph.transform.k;
      cy = (-graph.transform.y) / graph.transform.k + (graph.canvas.height / 2) / graph.transform.k;
    }
    openAddNodePopup(cx, cy);
  });

  document.getElementById('btnAdminEdgeMode')?.addEventListener('click', () => {
    if (edgeModeActive) { cancelEdgeMode(); showToast('엣지 연결 모드 취소', 'info'); }
    else if (selectedNode) { startEdgeMode(selectedNode); }
    else { showToast('먼저 소스 노드를 클릭해 선택하세요.', 'error'); }
  });

  document.getElementById('btnAdminDeleteNode')?.addEventListener('click', () => {
    if (!selectedNode) { showToast('삭제할 노드를 먼저 선택하세요.', 'error'); return; }
    adminRemoveNode(selectedNode);
  });

  // PR panel button → show sidebar PR section
  document.getElementById('btnOpenPrPanelAdmin')?.addEventListener('click', showPrSidebar);
  document.getElementById('btnRefreshPr')?.addEventListener('click', () => loadPrSidebar());
}

// ── PR Sidebar Panel ──────────────────────────────────────────────────────────
let prHighlightedNodes = [];

function showPrSidebar() {
  // Hide other sections, show PR section
  document.querySelectorAll('.sidebar-section').forEach(s => s.classList.remove('active'));
  const prSection = document.getElementById('pr-sidebar-section');
  if (prSection) {
    prSection.style.display = 'block';
    prSection.classList.add('active');
  }
  loadPrSidebar();
}

function clearPrHighlights() {
  if (!graph) return;
  prHighlightedNodes.forEach(id => {
    graph.setItemState(id, 'pr_highlight', false);
    graph.setItemState(id, 'pr_dim', false);
  });
  // Also clear dim on all nodes
  graphData.nodes.forEach(n => {
    graph.setItemState(n.id, 'pr_dim', false);
  });
  prHighlightedNodes = [];
}

function highlightPrNodes(nodeIds) {
  if (!graph) return;
  clearPrHighlights();

  const highlightSet = new Set(nodeIds);

  // Highlight changed nodes, dim all others
  graphData.nodes.forEach(n => {
    if (highlightSet.has(n.id)) {
      graph.setItemState(n.id, 'pr_highlight', true);
      graph.setItemState(n.id, 'pr_dim', false);
      prHighlightedNodes.push(n.id);
    } else {
      graph.setItemState(n.id, 'pr_highlight', false);
      graph.setItemState(n.id, 'pr_dim', true);
    }
  });

  // Pan to first highlighted node
  if (nodeIds.length > 0) {
    const node = graph.findById(nodeIds[0]);
    if (node && graph.transform) {
      const canvas = document.getElementById('tree-canvas');
      const targetX = canvas.width/2 - node.x * graph.transform.k;
      const targetY = canvas.height/2 - node.y * graph.transform.k;
      graph.d3canvas.transition().duration(500).call(
        graph.zoom.transform,
        d3.zoomIdentity.translate(targetX, targetY).scale(graph.transform.k)
      );
    }
  }
}

async function loadPrSidebar() {
  const list = document.getElementById('prSidebarList');
  if (!list) return;
  list.innerHTML = '<p style="color:#666;font-size:13px;">로딩 중...</p>';
  try {
    const res = await fetch('/api/admin/contributions');
    if (!res.ok) {
      list.innerHTML = '<p style="color:#f87171;font-size:13px;">권한이 없습니다.</p>';
      return;
    }
    const prs = await res.json();
    const pending = prs.filter(p => p.status === 'pending');

    if (prs.length === 0) {
      list.innerHTML = '<p style="color:#666;font-size:13px;padding:8px;">제출된 PR이 없습니다.</p>';
      return;
    }

    const useName = document.getElementById('prShowNodeNameToggle')?.checked;
    const getNodeLabel = (id) => {
      if (!useName) return id;
      const n = graph?.findById(id);
      return n ? n.label : id;
    };

    list.innerHTML = prs.map(pr => {
      const ts = new Date(pr.timestamp * 1000).toLocaleString('ko-KR');
      const statusColor = pr.status === 'merged' ? '#4ade80' : pr.status === 'rejected' ? '#f87171' : '#f0c060';
      const statusLabel = pr.status === 'merged' ? '✅ Merged' : pr.status === 'rejected' ? '❌ Rejected' : '⏳ Pending';

      let addedIds = [];
      let removedIds = [];
      let editedIds = [];
      let affectedIds = [];
      let changeDesc = '';

      if (pr.type === 'status') {
        editedIds = Object.keys(pr.changes || {});
        affectedIds = editedIds;
        changeDesc = `상태 변경: ${affectedIds.length}개 노드`;
      } else if (pr.type === 'description') {
        if(pr.changes?.node_id) editedIds.push(pr.changes.node_id);
        affectedIds = editedIds;
        changeDesc = `설명 수정: ${pr.changes?.node_id}`;
      } else {
        changeDesc = `커밋: ${(pr.commits || []).length}개`;
        for (let c of (pr.commits || [])) {
          for (let change of (c.changes || [])) {
            if (change.type === 'node') {
              if (change.action === 'add') addedIds.push(change.id);
              if (change.action === 'delete') removedIds.push(change.id);
              if (change.action === 'modify') editedIds.push(change.id);
            }
          }
        }
        affectedIds = [...addedIds, ...removedIds, ...editedIds];
      }

      // Deduplicate lists
      addedIds = [...new Set(addedIds)];
      removedIds = [...new Set(removedIds)];
      editedIds = [...new Set(editedIds)];
      
      let detailsHtml = '';
      if (addedIds.length > 0) detailsHtml += `<div style="margin-top:4px;">🟢 <b>추가:</b> ${addedIds.map(getNodeLabel).join(', ')}</div>`;
      if (removedIds.length > 0) detailsHtml += `<div style="margin-top:4px;">🔴 <b>삭제:</b> ${removedIds.map(getNodeLabel).join(', ')}</div>`;
      if (editedIds.length > 0) detailsHtml += `<div style="margin-top:4px;">🟡 <b>수정:</b> ${editedIds.map(getNodeLabel).join(', ')}</div>`;

      if (detailsHtml) {
        detailsHtml = `
          <div class="pr-details" style="display:none; margin-top:8px; padding-top:8px; border-top:1px dashed #3a2e1e; color:#a89068; font-size:11px; line-height:1.4;">
            ${detailsHtml}
          </div>
        `;
      }

      const idsJson = JSON.stringify(affectedIds).replace(/"/g, '&quot;');
      return `<div class="pr-card" data-ids="${idsJson}" style="border:1px solid #3a2e1e;border-radius:6px;margin-bottom:10px;padding:10px;background:#0f0a05;cursor:pointer;transition:border-color 0.2s;"
              onmouseenter="this.style.borderColor='#8a6a2e'" onmouseleave="this.style.borderColor='#3a2e1e'"
              onclick="prCardClick(this, '${idsJson.replace(/'/g, "\\'")}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;">
          <span style="font-size:12px;font-weight:bold;color:#c8a96e;line-height:1.3;">${pr.description || '(제목 없음)'}</span>
          <div style="display:flex;align-items:center;">
             <span style="color:${statusColor};font-size:11px;white-space:nowrap;margin-left:6px;margin-right:6px;">${statusLabel}</span>
             ${detailsHtml ? `<button onclick="event.stopPropagation(); const d = this.closest('.pr-card').querySelector('.pr-details'); d.style.display = d.style.display === 'none' ? 'block' : 'none';" style="background:none;border:none;color:#8a6a2e;cursor:pointer;font-size:13px;padding:0;width:16px;height:16px;display:flex;align-items:center;justify-content:center;">➕</button>` : ''}
          </div>
        </div>
        <div style="font-size:11px;color:#7a6d5a;margin-bottom:4px;">${pr.contributor?.name || '알 수 없음'} · ${ts}</div>
        <div style="font-size:11px;color:#9a8d7a;margin-bottom:6px;">${changeDesc}</div>
        ${detailsHtml}
        ${pr.status === 'pending' ? `
          <div style="display:flex;gap:6px;margin-top:4px;">
            <button class="btn btn-primary" style="font-size:11px;padding:3px 10px;" onclick="event.stopPropagation();approvePr('${pr.id}')">✅ Merge</button>
            <button class="btn" style="font-size:11px;padding:3px 10px;color:#f87171;border-color:#f87171;" onclick="event.stopPropagation();rejectPr('${pr.id}')">❌ Reject</button>
          </div>` : ''}
      </div>`;
    }).join('');
  } catch(err) {
    list.innerHTML = '<p style="color:#f87171;font-size:13px;">PR 목록을 불러오는데 실패했습니다.</p>';
  }
}

window.prCardClick = function(el, idsJson) {
  try {
    const ids = JSON.parse(idsJson.replace(/&quot;/g, '"'));
    highlightPrNodes(ids);
    // Visual feedback on card
    document.querySelectorAll('.pr-card').forEach(c => c.style.background = '#0f0a05');
    el.style.background = '#1a1208';
  } catch(e) {}
};

window.approvePr = async function(prId) {
  const res = await fetch(`/api/admin/contributions/${prId}/approve`, { method: 'POST' });
  if (res.ok) {
    showToast('✅ PR이 Merge되었습니다.', 'success');
    clearPrHighlights();
    loadPrSidebar();
    fetchGraphData();
  } else { showToast('Merge 실패', 'error'); }
};

window.rejectPr = async function(prId) {
  const res = await fetch(`/api/admin/contributions/${prId}/reject`, { method: 'POST' });
  if (res.ok) {
    showToast('PR이 Reject되었습니다.', 'info');
    clearPrHighlights();
    loadPrSidebar();
  } else { showToast('Reject 실패', 'error'); }
};

// Initialize Custom Canvas Graph
function initGraph() {
  if (orbitAnimationFrameId) {
    cancelAnimationFrame(orbitAnimationFrameId);
    orbitAnimationFrameId = null;
  }

  const container = document.getElementById('tree-canvas');
  if(!container) return;
  const width = container.parentElement.clientWidth;
  const height = container.parentElement.clientHeight || 800;

  // Format nodes
  const formattedNodes = graphData.nodes.map(n => ({
    id: n.id,
    label: n.label,
    importance: n.importance,
    status: n.status,
    stats: n.stats || [],
    shape: n.shape || 'circle',
    subnodes: n.subnodes || [],
    icon: n.icon,
    x: n.x,
    y: n.y,
    group: n.group,
    orbit: n.orbit,
    orbit_index: n.orbit_index,
    angle: n.angle,
    orbit_radius: n.orbit_radius,
    isMastery: n.isMastery,
    serial_id: n.serial_id,
    comment: n.comment
  }));

  const formattedEdges = graphData.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    curvature: e.curvature  // preserve per-edge curvature override
  }));

  graph = new CanvasGraph({ width, height });
  graph.changeData({ nodes: formattedNodes, edges: formattedEdges, groups: graphData.groups });

  if (animationEnabled && currentOrbit !== 'none') {
    startOrbitMotion();
  }

  // Event Listeners
  graph.on('node:click', (evt) => {
    const { item } = evt;
    const model = item.getModel();

    // ── Edge connect mode (admin) ──
    if (edgeModeActive && edgeModeSourceNode) {
      if (model.id !== edgeModeSourceNode.id) {
        adminAddEdge(edgeModeSourceNode, model);
      } else {
        showToast('같은 노드는 연결할 수 없습니다.', 'error');
        cancelEdgeMode();
      }
      return;
    }

    const isMultiSelect = evt.originalEvent.shiftKey || evt.originalEvent.metaKey || evt.originalEvent.ctrlKey;
    if (isMultiSelect) {
      const idx = selectedNodes.indexOf(model.id);
      if (idx > -1) {
        selectedNodes.splice(idx, 1);
        graph.setItemState(item, 'selected', false);
      } else {
        selectedNodes.push(model.id);
        graph.setItemState(item, 'selected', true);
      }
      if (selectedNodes.length > 0) {
        selectNode(selectedNodes[selectedNodes.length - 1], true);
      } else {
        clearSelection();
      }
    } else {
      // Toggle allocation
      const newStatus = model.status === 'Completed' ? 'Locked' : 'Completed';
      model.status = newStatus;
      
      const dataNode = graphData.nodes.find(n => n.id === model.id);
      if (dataNode) dataNode.status = newStatus;
      
      graph.setItemState(item, 'status', newStatus);
      
      selectedNodes = [model.id];
      selectNode(model.id, false);
      updateCharacterStats();
    }
  });

  graph.on('canvas:click', () => {
    clearSelection();
    closeInlineEdit();
    closeAddNodePopup();
    closeEdgeEditPopup();
    if (edgeModeActive) cancelEdgeMode();
  });

  const tooltip = document.getElementById('poe-tooltip');
  const ttTitle = document.getElementById('tt-title');
  const ttStats = document.getElementById('tt-stats');
  const ttUnallocStats = document.getElementById('tt-unalloc-stats');
  const ttUnalloc = document.getElementById('tt-unalloc');

  graph.on('node:mouseenter', (evt) => {
    const model = evt.item.getModel();
    if (!tooltip) return;
    
    ttTitle.textContent = model.label || 'Unknown';
    ttTitle.style.color = (model.importance === 'High') ? '#e7b655' : 
                          (model.importance === 'Medium') ? '#d4af37' : '#fff';

    // Render stats as a clean list (not the full comment markdown)
    const stats = model.stats || [];
    if (stats.length > 0) {
      ttStats.innerHTML = `<p style="font-size:12px;color:#9a8d7a;margin:2px 0 6px">📊 스킬 효과</p><ul style="margin:0;padding-left:18px">` 
        + stats.map(s => `<li>${s}</li>`).join('') + '</ul>';
    } else {
      ttStats.innerHTML = '<p style="color:#6a5e4c;font-size:12px">속성 없음</p>';
    }
    const ttNodeId = document.getElementById('tt-node-id');
    if(ttNodeId) ttNodeId.innerText = model.serial_id || '';
    
    if (model.status === 'Completed') {
      ttUnalloc.style.display = 'block';
      ttUnallocStats.innerHTML = '';
      stats.forEach(s => {
        const div = document.createElement('div');
        div.textContent = s;
        div.style.color = '#d20000';
        div.style.marginBottom = '2px';
        ttUnallocStats.appendChild(div);
      });
    } else {
      ttUnalloc.style.display = 'none';
    }

    tooltip.classList.add('visible');
    const x = evt.originalEvent.clientX + 15;
    const y = evt.originalEvent.clientY + 15;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  });

  graph.on('node:mousemove', (evt) => {
    if (!tooltip) return;
    const x = evt.originalEvent.clientX + 15;
    const y = evt.originalEvent.clientY + 15;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  });

  graph.on('node:mouseleave', () => {
    if (tooltip) tooltip.classList.remove('visible');
  });

  // Right-click context menu via canvas_engine event (on node)
  graph.on('node:contextmenu', (evt) => {
    if (!evt.item) return;
    const e = evt.originalEvent;
    e.preventDefault();
    e.stopPropagation(); // prevent bubbling to canvasEl contextmenu listener
    closeCtxMenu();
    closeCanvasCtxMenu();
    const node = evt.item.getModel ? evt.item.getModel() : evt.item;
    
    // Open dropdown context menu
    if (!edgeModeActive) {
      if (currentUser?.role === 'admin') {
        openCtxMenu(node, e.clientX, e.clientY);
      }
    }
  });

  // Right-click context menu on edge
  graph.on('edge:contextmenu', (evt) => {
    if (!evt.item) return;
    const e = evt.originalEvent;
    e.preventDefault();
    e.stopPropagation(); // prevent bubbling to canvasEl contextmenu listener
    closeCtxMenu();
    closeCanvasCtxMenu();
    
    if (currentUser?.role === 'admin' && !edgeModeActive) {
       openEdgeEditPopup(evt.item, e.clientX, e.clientY);
    }
  });

  // Right-click on empty canvas
  const canvasEl = document.getElementById('tree-canvas');
  canvasEl?.addEventListener('contextmenu', (e) => {
    // canvas_engine handles node/edge right-clicks internally and stops propagation
    // so this only fires for empty canvas clicks
    e.preventDefault();
    e.stopPropagation();
    const coords = graph.getCanvasCoords(e);
    const hitNode = graph.hitTestNode(coords.x, coords.y);
    if (hitNode) return; // node handled by node:contextmenu
    const hitEdge = graph.hitTestEdge(coords.x, coords.y);
    if (hitEdge) return; // edge handled by edge:contextmenu
    closeCtxMenu();
    openCanvasCtxMenu(e.clientX, e.clientY, coords.x, coords.y);
  });
}

// Refresh Graph elements
function updateGraphData() {
  if (!graph) return;
  const formattedNodes = graphData.nodes.map(n => ({
    id: n.id,
    label: n.label,
    importance: n.importance,
    status: n.status,
    shape: n.shape || 'circle',
    subnodes: n.subnodes || [],
    type: 'poe-node',
    x: currentLayout === 'preset' ? n.x : undefined,
    y: currentLayout === 'preset' ? n.y : undefined,
    icon: n.icon,
    group: n.group,
    orbit: n.orbit,
    orbit_index: n.orbit_index,
    angle: n.angle,
    orbit_radius: n.orbit_radius,
    isMastery: n.isMastery
  }));

  const formattedEdges = graphData.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'poe-edge',
    curvature: e.curvature  // preserve per-edge curvature override
  }));

  graph.changeData({ nodes: formattedNodes, edges: formattedEdges });
  
  if (animationEnabled && currentOrbit !== 'none') {
    startOrbitMotion();
  }
  
  if (typeof updateGitWorkspace === 'function') {
    updateGitWorkspace();
  }
  
  updateCharacterStats();
}

// Node Orbit Motion Calculation Loop
function startOrbitMotion() {
  if (orbitAnimationFrameId) {
    cancelAnimationFrame(orbitAnimationFrameId);
  }

  const initialPositions = {};
  graph.getNodes().forEach(node => {
    const model = node.getModel();
    initialPositions[model.id] = { x: model.x || 0, y: model.y || 0 };
  });

  function tick() {
    if (!graph) return;
    
    // Slow tick speed for satellite rotation
    orbitTime += 0.015;
    
    graph.getNodes().forEach(node => {
      const model = node.getModel();
      const initPos = initialPositions[model.id];
      if (!initPos) return;

      // 1. Move parent nodes gently if orbit is enabled
      let dx = 0;
      let dy = 0;
      const amplitude = 8;

      if (animationEnabled && currentOrbit !== 'none') {
        if (currentOrbit === 'orbit') {
          dx = Math.cos(orbitTime + parseInt(model.id.replace(/\D/g, '') || 0)) * amplitude;
          dy = Math.sin(orbitTime + parseInt(model.id.replace(/\D/g, '') || 0)) * amplitude;
        } else if (currentOrbit === 'infinity') {
          const t = orbitTime + parseInt(model.id.replace(/\D/g, '') || 0);
          dx = Math.cos(t) * amplitude;
          dy = (Math.sin(2 * t) / 2) * amplitude * 1.5;
        } else if (currentOrbit === 'lissajous') {
          const t = orbitTime + parseInt(model.id.replace(/\D/g, '') || 0);
          dx = Math.sin(3 * t) * amplitude;
          dy = Math.sin(2 * t) * amplitude;
        }

        graph.updateItem(node, {
          x: initPos.x + dx,
          y: initPos.y + dy
        });
      }

      // 2. Animate satellite subnodes physically orbiting around the parent node center
      if (subnodesVisible) {
        const group = node.getContainer();
        const subnodesCount = model.subnodes ? model.subnodes.length : 0;
        const baseSize = model.importance === 'High' ? 60 : (model.importance === 'Medium' ? 46 : 32);
        const size = Math.min(100, baseSize + (subnodesCount * 5));
        const trackRadius = (size / 2) + 24;

        // Satellite rotation offset speed
        const satelliteSpeed = subnodesRotationEnabled ? (orbitTime * 1.8 * subnodesRotationSpeed) : 0;

        for (let i = 0; i < subnodesCount; i++) {
          const glowShape = group.find(item => item.get('name') === `sub-sat-glow-${i}`);
          const bodyShape = group.find(item => item.get('name') === `sub-sat-body-${i}`);
          const textShape = group.find(item => item.get('name') === `sub-sat-text-${i}`);
          
          if (glowShape && bodyShape) {
            const initialAngle = glowShape.get('initialAngle') || 0;
            // Calculate dynamic orbital angle
            const currentAngle = initialAngle + satelliteSpeed;

            const satX = trackRadius * Math.cos(currentAngle);
            const satY = trackRadius * Math.sin(currentAngle);

            // Update local coordinates inside parent node group
            glowShape.attr({ x: satX, y: satY });
            bodyShape.attr({ x: satX, y: satY });
            
            if (textShape) {
              textShape.attr({ x: satX, y: satY - 10 });
            }
          }
        }
      }

      // 3. Selection Pulse Animation: highlight currently selected nodes with a subtle breathe scale/pulse
      if (selectedNodes.includes(model.id)) {
        const group = node.getContainer();
        const glowShape = group.find(item => item.get('name') === 'glow-shape');
        if (glowShape) {
          const pulseScale = 1.0 + Math.sin(orbitTime * 5) * 0.12; // breathing rate
          glowShape.attr('opacity', 0.4 + Math.sin(orbitTime * 5) * 0.15);
          glowShape.attr('transform', `scale(${pulseScale})`);
        }
      } else {
        // Reset scale transform on unselected node glows
        const group = node.getContainer();
        const glowShape = group.find(item => item.get('name') === 'glow-shape');
        if (glowShape) {
          glowShape.attr('transform', 'scale(1)');
          glowShape.attr('opacity', currentTheme === 'light' ? 0.08 : 0.25);
        }
      }
    });

    orbitAnimationFrameId = requestAnimationFrame(tick);
  }

  orbitAnimationFrameId = requestAnimationFrame(tick);
}

// Render Subnodes List inside editor sidebar
function renderSubnodesList() {
  subnodesListBody.innerHTML = '';
  if (!selectedNode || !selectedNode.subnodes) return;

  selectedNode.subnodes.forEach((sub, idx) => {
    const item = document.createElement('div');
    item.className = 'subnode-item';
    
    item.innerHTML = `
      <input type="text" class="subnode-input" value="${sub.label}" data-idx="${idx}">
      <span class="subnode-status ${sub.status}" data-idx="${idx}">${sub.status}</span>
      <button class="subnode-delete" data-idx="${idx}"><i class="fa-solid fa-circle-xmark"></i></button>
    `;

    // Bind rename event
    item.querySelector('.subnode-input').addEventListener('change', (e) => {
      const i = e.target.getAttribute('data-idx');
      selectedNode.subnodes[i].label = e.target.value.trim() || '세부 단원';
      updateGraphData();
    });

    // Bind status toggle
    item.querySelector('.subnode-status').addEventListener('click', (e) => {
      const i = e.target.getAttribute('data-idx');
      const curStatus = selectedNode.subnodes[i].status;
      let nextStatus = 'Locked';
      if (curStatus === 'Locked') nextStatus = 'In Progress';
      else if (curStatus === 'In Progress') nextStatus = 'Completed';
      
      selectedNode.subnodes[i].status = nextStatus;
      e.target.className = `subnode-status ${nextStatus}`;
      e.target.textContent = nextStatus;
      updateGraphData();
    });

    // Bind delete event
    item.querySelector('.subnode-delete').addEventListener('click', (e) => {
      const i = e.currentTarget.getAttribute('data-idx');
      selectedNode.subnodes.splice(i, 1);
      renderSubnodesList();
      updateGraphData();
    });

    subnodesListBody.appendChild(item);
  });
}

// Add a subnode to currently selected node
function addSubnode() {
  if (!selectedNode) return;
  if (!selectedNode.subnodes) {
    selectedNode.subnodes = [];
  }
  const newSub = {
    id: `sub-${Date.now()}`,
    label: '세부 체크포인트',
    status: 'Locked'
  };
  selectedNode.subnodes.push(newSub);
  renderSubnodesList();
  updateGraphData();
}

// Toggle subnodes visibility
btnToggleSubnodes.addEventListener('click', () => {
  subnodesContainer.classList.toggle('hidden');
  const isHidden = subnodesContainer.classList.contains('hidden');
  btnToggleSubnodes.innerHTML = isHidden 
    ? `<i class="fa-solid fa-list-check"></i> 목록 펼치기`
    : `<i class="fa-solid fa-list-check"></i> 목록 접기`;
});

btnAddSubnode.addEventListener('click', addSubnode);

// Select node details
function selectNode(id, appendMode = false) {
  selectedNode = graphData.nodes.find(n => n.id === id);
  if (!selectedNode) return;

  if (!appendMode) {
    selectedNodes = [id];
    graph.getNodes().forEach(n => {
      graph.clearItemStates(n);
      if (n.getModel().id === id) {
        graph.setItemState(n, 'selected', true);
      }
    });
  } else {
    // Sync states on G6 nodes matching selectedNodes
    graph.getNodes().forEach(n => {
      const nid = n.getModel().id;
      if (selectedNodes.includes(nid)) {
        graph.setItemState(n, 'selected', true);
      } else {
        graph.setItemState(n, 'selected', false);
      }
    });
  }

  emptyState.classList.remove('active');
  editorState.classList.add('active');

  editorTitle.textContent = selectedNode.label;
  inputLabel.value = selectedNode.label;
  selectImportance.value = selectedNode.importance;
  selectStatus.value = selectedNode.status;
  selectShape.value = selectedNode.shape || 'circle';
  textComment.value = selectedNode.comment || '';
  
  // Fill subnodes list
  renderSubnodesList();

  showEditTab();
}

function clearSelection() {
  selectedNode = null;
  selectedNodes = [];
  graph.getNodes().forEach(n => graph.clearItemStates(n));
  editorState.classList.remove('active');
  emptyState.classList.add('active');
}

// Markdown tabs
function showEditTab() {
  btnTabEdit.classList.add('active');
  btnTabPreview.classList.remove('active');
  textComment.classList.remove('hidden');
  previewComment.classList.add('hidden');
}

function showPreviewTab() {
  btnTabEdit.classList.remove('active');
  btnTabPreview.classList.add('active');
  textComment.classList.add('hidden');
  previewComment.classList.remove('hidden');
  
  // 1. Compile Markdown using marked
  const compiledHtml = marked.parse(textComment.value || '*코멘트가 없습니다.*');
  previewComment.innerHTML = compiledHtml;
  
  // 2. Trigger MathJax typesetting for rendering LaTeX equations
  if (window.MathJax) {
    MathJax.Hub.Queue(["Typeset", MathJax.Hub, previewComment]);
  }
}

// Clipboard Image Paste Handling
textComment.addEventListener('paste', async (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      e.preventDefault();
      const file = items[i].getAsFile();
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const res = await response.json();
          // Insert image markdown at cursor position
          const cursorPos = textComment.selectionStart;
          const text = textComment.value;
          const imgMarkdown = `\n![이미지](${res.url})\n`;
          textComment.value = text.substring(0, cursorPos) + imgMarkdown + text.substring(cursorPos);
          
          // Switch to preview if desired or show alert
          alert('클립보드 이미지가 업로드되어 마크다운에 추가되었습니다.');
        } else {
          alert('이미지 업로드에 실패했습니다.');
        }
      } catch (err) {
        console.error('Upload error:', err);
        alert('이미지 업로드 중 오류가 발생했습니다.');
      }
    }
  }
});

// Side Panel Apply Changes
btnApply.addEventListener('click', () => {
  if (!selectedNode) return;

  selectedNode.label = inputLabel.value.trim() || '이름 없음';
  selectedNode.importance = selectImportance.value;
  selectedNode.status = selectStatus.value;
  selectedNode.shape = selectShape.value;
  selectedNode.comment = textComment.value;

  editorTitle.textContent = selectedNode.label;
  
  updateGraphData();
  alert('노드 수정 내용이 일시 저장되었습니다. (전체 저장을 눌러 영구 저장하세요)');
});

// Delete Selected Node & Connected Edges
btnDelete.addEventListener('click', () => {
  if (!selectedNode) return;
  
  if (confirm(`'${selectedNode.label}' 과목을 정말로 테크트리에서 제거하시겠습니까?`)) {
    const idToDelete = selectedNode.id;
    graphData.nodes = graphData.nodes.filter(n => n.id !== idToDelete);
    graphData.edges = graphData.edges.filter(e => e.source !== idToDelete && e.target !== idToDelete);
    clearSelection();
    updateGraphData();
  }
});

// Save All to server
btnSaveAll.addEventListener('click', saveGraphData);

// Tab Controls
btnTabEdit.addEventListener('click', showEditTab);
btnTabPreview.addEventListener('click', showPreviewTab);

// Animation Switch Toggle
animToggle.addEventListener('click', (e) => {
  animationEnabled = e.target.checked;
  
  // Toggle edge animations
  graph.getEdges().forEach(edge => {
    const group = edge.getContainer();
    const flowShape = group.find(item => item.get('name') === 'flow-shape');
    if (flowShape) {
      if (animationEnabled) {
        const shape = group.get('children')[0];
        const length = shape.getTotalLength();
        flowShape.animate(
          (ratio) => {
            return {
              lineDashOffset: -length * ratio
            };
          },
          {
            repeat: true,
            duration: 3000
          }
        );
      } else {
        flowShape.stopAnimate();
        flowShape.attr('lineDashOffset', 0);
      }
    }
  });

  // Toggle orbit animation
  if (animationEnabled && currentOrbit !== 'none') {
    startOrbitMotion();
  } else {
    if (orbitAnimationFrameId) {
      cancelAnimationFrame(orbitAnimationFrameId);
      orbitAnimationFrameId = null;
    }
    updateGraphData();
  }
});

// Theme Select Handler
themeSelect.addEventListener('change', (e) => {
  currentTheme = e.target.value;
  document.body.className = `theme-${currentTheme}`;
  initGraph();
});

// Layout Select Handler
layoutSelect.addEventListener('change', (e) => {
  currentLayout = e.target.value;
  initGraph();
});

// Orbit Select Handler
orbitSelect.addEventListener('change', (e) => {
  currentOrbit = e.target.value;
  if (currentOrbit === 'none') {
    if (orbitAnimationFrameId) {
      cancelAnimationFrame(orbitAnimationFrameId);
      orbitAnimationFrameId = null;
    }
    updateGraphData();
  } else {
    startOrbitMotion();
  }
});

// Subnode Visualization Select Handler
subnodeVisSelect.addEventListener('change', (e) => {
  subnodesVisible = (e.target.value === 'show');
  initGraph();
});

// Subnode Orbit Rotation Enable Handler
subnodeRotSelect.addEventListener('change', (e) => {
  subnodesRotationEnabled = (e.target.value === 'true');
});

// Subnode Orbit Speed Range Handler
subnodeSpeedRange.addEventListener('input', (e) => {
  subnodesRotationSpeed = parseFloat(e.target.value);
});

// Export Dropdown Click Handler
btnExportMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  exportMenu.classList.toggle('show');
});

// Settings Drawer Toggle Handlers
const btnToggleSettings = document.getElementById('btnToggleSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const settingsDrawer = document.getElementById('settingsDrawer');

btnToggleSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsDrawer.classList.toggle('open');
});

btnCloseSettings.addEventListener('click', () => {
  settingsDrawer.classList.remove('open');
});

window.addEventListener('click', (e) => {
  exportMenu.classList.remove('show');
  
  // Close settings drawer when clicking outside it
  if (settingsDrawer.classList.contains('open') && !settingsDrawer.contains(e.target) && !btnToggleSettings.contains(e.target)) {
    settingsDrawer.classList.remove('open');
  }
});

// File Batch Import Handler
importFile.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  try {
    const response = await fetch('/api/import/batch', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const resData = await response.json();
      alert(`일괄 가져오기가 완료되었습니다!\n가져온 노드: ${resData.imported_nodes}개, 에지: ${resData.imported_edges}개\n전체 노드 수: ${resData.total_nodes}개, 에지 수: ${resData.total_edges}개`);
      fetchGraphData();
    } else {
      const err = await response.json();
      alert(`일괄 가져오기 실패: ${err.detail || '파일 형식을 확인하세요.'}`);
    }
  } catch (error) {
    console.error('Import failed:', error);
    alert('가져오기 도중 네트워크 오류가 발생했습니다.');
  } finally {
    importFile.value = '';
  }
});

// ── Node Search Overlay ───────────────────────────────────────────────────────
let searchResultIndex = -1;
let searchResultNodes = [];

function openSearchOverlay() {
  const overlay = document.getElementById('searchOverlay');
  const input = document.getElementById('searchInput');
  if (!overlay || !input) return;
  overlay.style.display = 'block';
  input.value = '';
  input.focus();
  renderSearchResults('');
}

window.closeSearchOverlay = function() {
  const overlay = document.getElementById('searchOverlay');
  if (overlay) overlay.style.display = 'none';
  searchResultIndex = -1;
  searchResultNodes = [];
};

function renderSearchResults(query) {
  const list = document.getElementById('searchResults');
  const status = document.getElementById('searchStatus');
  if (!list) return;
  if (!query.trim()) {
    list.innerHTML = '<p style="color:#6a5e4c;font-size:12px;padding:4px 0;">검색어를 입력하세요</p>';
    if (status) status.textContent = '';
    searchResultNodes = [];
    return;
  }
  const q = query.toLowerCase();
  searchResultNodes = (graphData?.nodes || []).filter(n =>
    (n.label || '').toLowerCase().includes(q) ||
    (n.name || '').toLowerCase().includes(q) ||
    (n.serial_id || '').toLowerCase().includes(q)
  ).slice(0, 50);

  if (status) status.textContent = `${searchResultNodes.length}개 결과`;

  if (searchResultNodes.length === 0) {
    list.innerHTML = '<p style="color:#6a5e4c;font-size:12px;padding:4px 0;">결과 없음</p>';
    return;
  }

  list.innerHTML = searchResultNodes.map((n, i) => {
    const statusColor = n.status === 'Completed' ? '#4ade80' : n.status === 'In Progress' ? '#f0c060' : '#6a5e4c';
    const statusDot = `<span style="width:7px;height:7px;border-radius:50%;background:${statusColor};display:inline-block;margin-right:6px;flex-shrink:0;"></span>`;
    const highlight = (txt) => txt.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi'), m => `<mark style="background:#8a5a00;color:#ffd78a;border-radius:2px;">${m}</mark>`);
    return `<div class="search-result-item" data-idx="${i}"
              style="display:flex;align-items:center;padding:7px 10px;border-radius:6px;cursor:pointer;
                     margin-bottom:2px;transition:background 0.1s;font-size:13px;"
              onmouseenter="this.style.background='rgba(200,169,110,0.12)'"
              onmouseleave="this.style.background=''"
              onclick="searchJumpTo(${i})">
      ${statusDot}
      <span style="flex:1;color:#e8d098;">${highlight(n.label || n.name || n.id)}</span>
      <span style="color:#6a5e4c;font-size:11px;margin-left:8px;">${n.serial_id || ''}</span>
    </div>`;
  }).join('');
  searchResultIndex = -1;
}

window.searchJumpTo = function(idx) {
  const node = searchResultNodes[idx];
  if (!node || !graph) return;
  searchResultIndex = idx;

  // Highlight in results
  document.querySelectorAll('.search-result-item').forEach((el, i) => {
    el.style.background = i === idx ? 'rgba(200,169,110,0.2)' : '';
  });

  // Pan canvas to node
  const canvas = document.getElementById('tree-canvas');
  const k = graph.transform.k;
  const targetX = canvas.width / 2 - node.x * k;
  const targetY = canvas.height / 2 - node.y * k;
  graph.d3canvas.transition().duration(400).call(
    graph.zoom.transform,
    d3.zoomIdentity.translate(targetX, targetY).scale(Math.max(k, 0.3))
  );

  // Highlight node on canvas
  graph.setItemState(node.id, 'selected', true);
  selectNode(node.id, false);
};

// Setup search input events
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', (e) => renderSearchResults(e.target.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSearchOverlay(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      searchResultIndex = Math.min(searchResultIndex + 1, searchResultNodes.length - 1);
      searchJumpTo(searchResultIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      searchResultIndex = Math.max(searchResultIndex - 1, 0);
      searchJumpTo(searchResultIndex);
    } else if (e.key === 'Enter' && searchResultNodes.length > 0) {
      e.preventDefault();
      const nextIdx = searchResultIndex < 0 ? 0 : (searchResultIndex + 1) % searchResultNodes.length;
      searchJumpTo(nextIdx);
    }
  });
});

// Keyboard Shortcuts (PoE Style)
window.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  const inInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

  // Cmd+F / Ctrl+F — open search overlay (intercept browser Find)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openSearchOverlay();
    return;
  }

  // Esc — close search or clear selection
  if (e.key === 'Escape') {
    const overlay = document.getElementById('searchOverlay');
    if (overlay && overlay.style.display !== 'none') {
      closeSearchOverlay();
      return;
    }
    if (!inInput) {
      e.preventDefault();
      if (edgeModeActive) { cancelEdgeMode(); return; }
      clearSelection();
    }
    return;
  }

  if (inInput) return; // Don't intercept other keys while typing

  // Space: Reset Zoom & Center
  if (e.code === 'Space') {
    e.preventDefault();
    if (graph && graph.resetView) graph.resetView();
  }

  // Delete/Backspace: Admin → delete selected nodes; others → unallocate (set Locked)
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // Ignore if focus is in an input/textarea to not interfere with text editing
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (selectedNodes.length > 0) {
      e.preventDefault();
      if (currentUser?.role === 'admin') {
        // Admin: hard-delete all selected nodes
        const labels = selectedNodes.map(id => {
          const n = graphData.nodes.find(x => x.id === id);
          return n ? (n.label || n.id) : id;
        }).join(', ');
        if (!confirm(`선택된 ${selectedNodes.length}개 노드를 삭제하시겠습니까?\n[${labels}]\n연결된 엣지도 모두 제거됩니다.`)) return;

        // Delete each node sequentially
        const idsToDelete = [...selectedNodes];
        selectedNodes = [];
        for (const id of idsToDelete) {
          const nodeObj = graphData.nodes.find(n => n.id === id);
          if (nodeObj) await adminRemoveNode(nodeObj, true /* silent */);
        }
        showToast(`🗑️ ${idsToDelete.length}개 노드가 삭제되었습니다.`, 'success');
      } else {
        // Non-admin: just set status to Locked
        selectedNodes.forEach(id => {
          const nodeObj = graphData.nodes.find(n => n.id === id);
          if (nodeObj) {
            nodeObj.status = 'Locked';
            const item = graph.findById(id);
            if (item) item.status = 'Locked';
          }
        });
        graph.render();
        updateCharacterStats();
        const sel = document.getElementById('nodeStatus');
        if (sel && selectedNode) sel.value = 'Locked';
      }
    }
  }

  // Ctrl+S / Cmd+S: Save graph
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveGraphData();
  }
});

// Resize window handler
window.addEventListener('resize', () => {
  if (graph) {
    const container = document.getElementById('g6-container');
    graph.changeSize(container.scrollWidth, container.scrollHeight || 600);
  }
});

// Load everything on start
fetchGraphData();
setupContextMenu();
setupNodeEditModal();
setupAdminToolbar();

// ── Edge Style & Curvature wiring ───────────────────────────────────────────
document.getElementById('edgeStyleSelect')?.addEventListener('change', (e) => {
  const style = e.target.value;
  const curGroup = document.getElementById('curvatureGroup');
  if (curGroup) curGroup.style.display = style === 'curve' ? 'block' : 'none';
  if (graph) { graph.edgeStyle = style; graph.render(); }
});

document.getElementById('curvatureRange')?.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  const label = document.getElementById('curvatureVal');
  if (label) label.textContent = val.toFixed(2);
  if (graph) { graph.curvature = val; graph.render(); }
});

// ── PR Dim Opacity wiring ───────────────────────────────────────────────────
document.getElementById('prDimRange')?.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  const label = document.getElementById('prDimVal');
  if (label) label.textContent = val.toFixed(2);
  if (graph) { graph.prDimOpacity = val; graph.render(); }
});


// COLLABORATIVE WIKI & AUTH LOGIC FOR APP.JS

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      currentUser = await res.json();
      updateAuthUI();
    }
  } catch (err) {
    console.error('Failed checking authentication status:', err);
  }
}

function updateAuthUI() {
  const txtRole = document.getElementById('txtUserRole');
  const txtName = document.getElementById('txtUserName');
  const btnSave = document.getElementById('btnSaveAll');
  const btnSubmitProp = document.getElementById('btnSubmitProposal');
  const adminOnlyEls = document.querySelectorAll('.admin-only');
  const contributorOnlyEls = document.querySelectorAll('.contributor-only');
  const gitWorkspacePanel = document.getElementById('gitWorkspacePanel');

  txtRole.textContent = currentUser.role;
  txtRole.className = `role-badge ${currentUser.role}`;
  
  if (currentUser.role === 'guest') {
    txtName.textContent = '로그인이 필요합니다';
    btnSave.classList.add('hidden');
    btnSubmitProp.classList.add('hidden');
    adminOnlyEls.forEach(el => el.classList.add('hidden'));
    contributorOnlyEls.forEach(el => el.classList.add('hidden'));
    if (gitWorkspacePanel) gitWorkspacePanel.classList.add('hidden');
  } else {
    txtName.textContent = `${currentUser.name} (${currentUser.email || 'OAuth User'})`;
    
    // Non-guest logged in users get the git workspace panel
    if (gitWorkspacePanel) gitWorkspacePanel.classList.remove('hidden');
    
    if (currentUser.role === 'admin') {
      btnSave.classList.remove('hidden');
      btnSubmitProp.classList.add('hidden');
      adminOnlyEls.forEach(el => el.classList.remove('hidden'));
      contributorOnlyEls.forEach(el => el.classList.add('hidden'));
      // Show admin toolbar
      const toolbar = document.getElementById('adminToolbar');
      if (toolbar) toolbar.style.display = 'flex';
      loadAdminProposals();
    } else {
      // Contributor role
      btnSave.classList.remove('hidden'); // Ctrl+S triggers PR submission
      btnSubmitProp.classList.remove('hidden');
      adminOnlyEls.forEach(el => el.classList.add('hidden'));
      contributorOnlyEls.forEach(el => el.classList.remove('hidden'));
      const toolbar = document.getElementById('adminToolbar');
      if (toolbar) toolbar.style.display = 'none';
    }
  }

  // Configure G6 behaviors depending on permissions (Read-only for guests)
  if (graph) {
    if (currentUser.role === 'guest') {
      graph.removeBehaviors(['drag-node', 'create-edge'], 'default');
      // Read-only info sidebar delete button
      document.getElementById('btnDeleteNode').classList.add('hidden');
    } else {
      graph.addBehaviors(['drag-node', 'create-edge'], 'default');
      document.getElementById('btnDeleteNode').classList.remove('hidden');
    }
  }
  
  if (typeof updateGitWorkspace === 'function') {
    updateGitWorkspace();
  }
}

// Google Sign-In Callback handler
window.handleCredentialResponse = async function(response) {
  try {
    const res = await fetch('/api/auth/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    if (res.ok) {
      currentUser = await res.json();
      updateAuthUI();
      alert(`구글 로그인 성공: ${currentUser.name}님 환영합니다!`);
    } else {
      alert('로그인 처리에 실패했습니다.');
    }
  } catch (err) {
    console.error('Google OAuth error:', err);
  }
};

// Initialize Google One Tap / Sign In button
function initGoogleAuth() {
  if (typeof google === 'undefined') {
    setTimeout(initGoogleAuth, 500);
    return;
  }
  
  google.accounts.id.initialize({
    client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com", // Fallback or local testing client id
    callback: window.handleCredentialResponse
  });
  
  google.accounts.id.renderButton(
    document.getElementById("googleBtnContainer"),
    { theme: "outline", size: "medium" }
  );
  
  google.accounts.id.prompt(); // One Tap prompt
}

// Mock authentication helper dialog hooks
const btnShowAuth = document.getElementById('btnShowAuthModal');
const mockLoginModal = document.getElementById('mockLoginModal');
const btnCloseMock = document.getElementById('btnCloseMockModal');
const btnMockConfirm = document.getElementById('btnMockLoginConfirm');

btnShowAuth.addEventListener('click', () => {
  mockLoginModal.classList.remove('hidden');
});

btnCloseMock.addEventListener('click', () => {
  mockLoginModal.classList.add('hidden');
});

btnMockConfirm.addEventListener('click', async () => {
  const name = document.getElementById('mockName').value.trim() || '기여자';
  const email = document.getElementById('mockEmail').value.trim() || 'contributor@test.com';
  const role = document.getElementById('mockRole').value;

  try {
    const res = await fetch('/api/auth/mock-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role })
    });
    if (res.ok) {
      currentUser = await res.json();
      updateAuthUI();
      mockLoginModal.classList.add('hidden');
      alert(`테스트 계정으로 로그인했습니다 (${currentUser.role})`);
    }
  } catch (err) {
    console.error(err);
  }
});

// Proposal Modal Form Control
const btnSubmitProp = document.getElementById('btnSubmitProposal');
const proposalModal = document.getElementById('proposalModal');
const btnCloseProp = document.getElementById('btnCloseProposalModal');
const btnCancelProp = document.getElementById('btnCancelProposal');
const btnSubmitPropConfirm = document.getElementById('btnSubmitProposalConfirm');

btnSubmitProp.addEventListener('click', () => {
  proposalModal.classList.remove('hidden');
});

btnCloseProp.addEventListener('click', () => {
  proposalModal.classList.add('hidden');
});

btnCancelProp.addEventListener('click', () => {
  proposalModal.classList.add('hidden');
});

btnSubmitPropConfirm.addEventListener('click', async () => {
  const description = document.getElementById('proposalDesc').value.trim();
  if (!description) {
    alert('기여 제안 내용을 설명해주세요!');
    return;
  }

  if (localCommits.length === 0) {
    alert('제출할 로컬 커밋이 없습니다! 먼저 변경 사항을 커밋해주세요.');
    return;
  }

  try {
    const res = await fetch('/api/contributions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: description,
        commits: localCommits
      })
    });
    if (res.ok) {
      proposalModal.classList.add('hidden');
      document.getElementById('proposalDesc').value = '';
      localCommits = [];
      updateGitWorkspace();
      alert('기여 제안서(Pull Request)가 성공적으로 전송되었습니다! 관리자가 검토 후 적용합니다.');
    } else {
      const err = await res.json();
      alert(`제출 실패: ${err.detail || '오류가 발생했습니다.'}`);
    }
  } catch (err) {
    console.error(err);
    alert('기여 제안 전송에 실패했습니다.');
  }
});

// Admin review proposals fetching
async function loadAdminProposals() {
  const proposalList = document.getElementById('proposalList');
  proposalList.innerHTML = '<span style="font-size:11px; color:var(--text-secondary);">로딩 중...</span>';
  
  try {
    const res = await fetch('/api/admin/contributions');
    if (res.ok) {
      const proposals = await res.json();
      const pending = proposals.filter(p => p.status === 'pending');
      
      if (pending.length === 0) {
        proposalList.innerHTML = '<span style="font-size:11px; color:var(--text-secondary);">대기 중인 제안이 없습니다.</span>';
        return;
      }

      proposalList.innerHTML = '';
      pending.forEach(prop => {
        const card = document.createElement('div');
        card.className = 'proposal-card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
          <div class="proposal-card-header">
            <strong>${prop.contributor.name} (${prop.contributor.role})</strong>
            <span style="font-size:10px; color:var(--accent-color);">${new Date(prop.timestamp * 1000).toLocaleTimeString()}</span>
          </div>
          <div class="proposal-desc">${prop.description}</div>
          <div class="proposal-actions">
            <button class="btn btn-primary btn-approve" data-id="${prop.id}">승인 (Merge)</button>
            <button class="btn btn-danger btn-reject" data-id="${prop.id}">반려</button>
          </div>
        `;
        
        card.addEventListener('click', (e) => {
          if (e.target.tagName === 'BUTTON') return;
          previewProposalDiff(prop);
        });
        
        card.querySelector('.btn-approve').addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          if (confirm('이 제안을 승인하고 공식 테크트리에 머지하시겠습니까?')) {
            await reviewProposal(id, 'approve');
          }
        });

        card.querySelector('.btn-reject').addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          if (confirm('이 제안을 반려하시겠습니까?')) {
            await reviewProposal(id, 'reject');
          }
        });

        proposalList.appendChild(card);
      });
    }
  } catch (err) {
    console.error(err);
    proposalList.innerHTML = '<span style="font-size:11px; color:#ef4444;">제안 로드 실패</span>';
  }
}

async function reviewProposal(id, action) {
  try {
    const res = await fetch(`/api/admin/contributions/${id}/${action}`, {
      method: 'POST'
    });
    if (res.ok) {
      alert(`제안이 성공적으로 ${action === 'approve' ? '승인 및 머지' : '반려'}되었습니다.`);
      fetchGraphData(); // reload tree
    } else {
      alert('요청 처리 실패');
    }
  } catch (err) {
    console.error(err);
  }
}

// Run auth button renders
setTimeout(initGoogleAuth, 100);

// --- Git Version Control Engine ---

function isNodeModified(n1, n2) {
  if (n1.label !== n2.label) return true;
  if (n1.importance !== n2.importance) return true;
  if (n1.status !== n2.status) return true;
  if (n1.shape !== n2.shape) return true;
  if (n1.comment !== n2.comment) return true;
  
  // Compare positions (approximate to avoid float jitter)
  if (Math.abs((n1.x || 0) - (n2.x || 0)) > 2.0) return true;
  if (Math.abs((n1.y || 0) - (n2.y || 0)) > 2.0) return true;
  
  // Compare subnodes
  const subs1 = n1.subnodes || [];
  const subs2 = n2.subnodes || [];
  if (subs1.length !== subs2.length) return true;
  for (let i = 0; i < subs1.length; i++) {
    if (subs1[i].id !== subs2[i].id) return true;
    if (subs1[i].label !== subs2[i].label) return true;
    if (subs1[i].status !== subs2[i].status) return true;
  }
  
  return false;
}

function applyCommits(base, commits) {
  const g = JSON.parse(JSON.stringify(base));
  for (const commit of commits) {
    for (const change of commit.changes) {
      const action = change.action;
      const ctype = change.type;
      const targetId = change.id;
      const cdata = change.data;
      
      if (ctype === 'node') {
        if (action === 'add') {
          g.nodes = g.nodes.filter(n => n.id !== targetId);
          g.nodes.push(JSON.parse(JSON.stringify(cdata)));
        } else if (action === 'modify') {
          for (let i = 0; i < g.nodes.length; i++) {
            if (g.nodes[i].id === targetId) {
              g.nodes[i] = JSON.parse(JSON.stringify(cdata));
              break;
            }
          }
        } else if (action === 'delete') {
          g.nodes = g.nodes.filter(n => n.id !== targetId);
          g.edges = g.edges.filter(e => e.source !== targetId && e.target !== targetId);
        }
      } else if (ctype === 'edge') {
        if (action === 'add') {
          g.edges = g.edges.filter(e => e.id !== targetId);
          g.edges.push(JSON.parse(JSON.stringify(cdata)));
        } else if (action === 'delete') {
          g.edges = g.edges.filter(e => e.id !== targetId);
        }
      }
    }
  }
  return g;
}

function diffGraph(oldG, newG) {
  const changes = [];
  
  // 1. Diff Nodes
  const oldNodesMap = new Map(oldG.nodes.map(n => [n.id, n]));
  const newNodesMap = new Map(newG.nodes.map(n => [n.id, n]));
  
  // Added or Modified Nodes
  for (const [id, newNode] of newNodesMap) {
    const oldNode = oldNodesMap.get(id);
    if (!oldNode) {
      changes.push({
        action: 'add',
        type: 'node',
        id: id,
        data: JSON.parse(JSON.stringify(newNode))
      });
    } else {
      if (isNodeModified(oldNode, newNode)) {
        changes.push({
          action: 'modify',
          type: 'node',
          id: id,
          data: JSON.parse(JSON.stringify(newNode))
        });
      }
    }
  }
  
  // Deleted Nodes
  for (const [id, oldNode] of oldNodesMap) {
    if (!newNodesMap.has(id)) {
      changes.push({
        action: 'delete',
        type: 'node',
        id: id,
        data: null
      });
    }
  }
  
  // 2. Diff Edges
  const oldEdgesMap = new Map(oldG.edges.map(e => [e.id, e]));
  const newEdgesMap = new Map(newG.edges.map(e => [e.id, e]));
  
  // Added Edges
  for (const [id, newEdge] of newEdgesMap) {
    if (!oldEdgesMap.has(id)) {
      changes.push({
        action: 'add',
        type: 'edge',
        id: id,
        data: JSON.parse(JSON.stringify(newEdge))
      });
    }
  }
  
  // Deleted Edges
  for (const [id, oldEdge] of oldEdgesMap) {
    if (!newEdgesMap.has(id)) {
      changes.push({
        action: 'delete',
        type: 'edge',
        id: id,
        data: null
      });
    }
  }
  
  return changes;
}

function toggleStageChange(change, isChecked) {
  if (isChecked) {
    const exists = stagedChanges.some(c => c.type === change.type && c.id === change.id && c.action === change.action);
    if (!exists) {
      stagedChanges.push(JSON.parse(JSON.stringify(change)));
    }
  } else {
    stagedChanges = stagedChanges.filter(c => !(c.type === change.type && c.id === change.id && c.action === change.action));
  }
  updateGitWorkspace();
}

function updateGitWorkspace() {
  const panel = document.getElementById('gitWorkspacePanel');
  if (!panel) return;
  
  if (currentUser.role === 'guest') {
    panel.classList.add('hidden');
    return;
  }
  
  const commitBase = applyCommits(baseGraphData, localCommits);
  const allWorkingChanges = diffGraph(commitBase, graphData);
  
  // Filter out stagedChanges that are no longer valid working changes
  stagedChanges = stagedChanges.filter(sc => 
    allWorkingChanges.some(wc => wc.type === sc.type && wc.id === sc.id && wc.action === sc.action)
  );
  
  // Unstaged changes are those in allWorkingChanges not in stagedChanges
  const unstagedList = allWorkingChanges.filter(wc => 
    !stagedChanges.some(sc => sc.type === wc.type && sc.id === wc.id && sc.action === wc.action)
  );
  
  // Render Unstaged Changes List
  const unstagedContainer = document.getElementById('gitUnstagedList');
  if (allWorkingChanges.length === 0 && stagedChanges.length === 0) {
    unstagedContainer.innerHTML = '<span style="font-size:10px; color:var(--text-secondary);">변경된 항목이 없습니다.</span>';
  } else if (unstagedList.length === 0) {
    unstagedContainer.innerHTML = '<span style="font-size:10px; color:var(--text-secondary);">모든 변경 사항이 스테이지되었습니다.</span>';
  } else {
    unstagedContainer.innerHTML = '';
    unstagedList.forEach((change) => {
      const item = document.createElement('div');
      item.className = 'git-change-item';
      
      let labelText = `${change.type === 'node' ? '노드' : '연결선'} [${change.id}]`;
      if (change.type === 'node') {
        const nodeObj = change.data || commitBase.nodes.find(n => n.id === change.id);
        if (nodeObj) labelText = `노드: ${nodeObj.label}`;
      } else if (change.type === 'edge') {
        const edgeObj = change.data || commitBase.edges.find(e => e.id === change.id);
        if (edgeObj) {
          const srcNode = graphData.nodes.find(n => n.id === edgeObj.source) || commitBase.nodes.find(n => n.id === edgeObj.source);
          const tgtNode = graphData.nodes.find(n => n.id === edgeObj.target) || commitBase.nodes.find(n => n.id === edgeObj.target);
          labelText = `연결선: ${srcNode ? srcNode.label : edgeObj.source} -> ${tgtNode ? tgtNode.label : edgeObj.target}`;
        }
      }
      
      const badgeClass = change.action;
      const badgeText = change.action === 'add' ? 'ADD' : (change.action === 'modify' ? 'MOD' : 'DEL');
      
      item.innerHTML = `
        <label>
          <input type="checkbox" class="git-stage-checkbox">
          <span>${labelText}</span>
        </label>
        <span class="git-badge ${badgeClass}">${badgeText}</span>
      `;
      
      item.querySelector('.git-stage-checkbox').addEventListener('change', (e) => {
        toggleStageChange(change, e.target.checked);
      });
      
      unstagedContainer.appendChild(item);
    });
  }
  
  // Render Staged Changes List
  const stagedContainer = document.getElementById('gitStagedList');
  if (stagedChanges.length === 0) {
    stagedContainer.innerHTML = '<span style="font-size:10px; color:var(--text-secondary);">스테이지된 변경이 없습니다.</span>';
  } else {
    stagedContainer.innerHTML = '';
    stagedChanges.forEach((change) => {
      const item = document.createElement('div');
      item.className = 'git-change-item';
      
      let labelText = `${change.type === 'node' ? '노드' : '연결선'} [${change.id}]`;
      if (change.type === 'node') {
        const nodeObj = change.data || commitBase.nodes.find(n => n.id === change.id);
        if (nodeObj) labelText = `노드: ${nodeObj.label}`;
      } else if (change.type === 'edge') {
        const edgeObj = change.data || commitBase.edges.find(e => e.id === change.id);
        if (edgeObj) {
          const srcNode = graphData.nodes.find(n => n.id === edgeObj.source) || commitBase.nodes.find(n => n.id === edgeObj.source);
          const tgtNode = graphData.nodes.find(n => n.id === edgeObj.target) || commitBase.nodes.find(n => n.id === edgeObj.target);
          labelText = `연결선: ${srcNode ? srcNode.label : edgeObj.source} -> ${tgtNode ? tgtNode.label : edgeObj.target}`;
        }
      }
      
      const badgeClass = change.action;
      const badgeText = change.action === 'add' ? 'ADD' : (change.action === 'modify' ? 'MOD' : 'DEL');
      
      item.innerHTML = `
        <label>
          <input type="checkbox" class="git-stage-checkbox" checked>
          <span>${labelText}</span>
        </label>
        <span class="git-badge ${badgeClass}">${badgeText}</span>
      `;
      
      item.querySelector('.git-stage-checkbox').addEventListener('change', (e) => {
        toggleStageChange(change, e.target.checked);
      });
      
      stagedContainer.appendChild(item);
    });
  }
  
  // Render Commits list
  const logsContainer = document.getElementById('gitCommitLogsList');
  if (localCommits.length === 0) {
    logsContainer.innerHTML = '<span style="font-size:10px; color:var(--text-secondary);">제출할 커밋이 없습니다.</span>';
  } else {
    logsContainer.innerHTML = '';
    localCommits.forEach((commit) => {
      const item = document.createElement('div');
      item.className = 'git-commit-log-item';
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>[${commit.id.substring(7,13)}] ${commit.message}</strong>
          <span style="font-size:9px; color:var(--text-secondary);">${new Date(commit.timestamp * 1000).toLocaleTimeString()}</span>
        </div>
        <div style="font-size:9px; color:var(--text-secondary); padding-left:5px; margin-top:2px;">
          총 ${commit.changes.length}개 항목 수정됨
        </div>
      `;
      logsContainer.appendChild(item);
    });
  }
}

// Stage All Button Event
const btnGitAddAll = document.getElementById('btnGitAddAll');
if (btnGitAddAll) {
  btnGitAddAll.addEventListener('click', () => {
    const commitBase = applyCommits(baseGraphData, localCommits);
    const allWorkingChanges = diffGraph(commitBase, graphData);
    if (allWorkingChanges.length === 0) {
      alert('스테이지할 변경 사항이 없습니다.');
      return;
    }
    stagedChanges = JSON.parse(JSON.stringify(allWorkingChanges));
    updateGitWorkspace();
    alert('모든 변경 사항이 스테이지되었습니다 (git add .)');
  });
}

// Commit Button Event
const btnGitCommit = document.getElementById('btnGitCommit');
const gitCommitMsgInput = document.getElementById('gitCommitMsg');
if (btnGitCommit) {
  btnGitCommit.addEventListener('click', () => {
    if (stagedChanges.length === 0) {
      alert('스테이지된 변경 사항이 없습니다! 먼저 체크박스를 누르거나 모두 스테이지에 추가하세요.');
      return;
    }
    const msg = gitCommitMsgInput.value.trim();
    if (!msg) {
      alert('커밋 메시지를 입력해주세요!');
      return;
    }
    
    const commitId = 'commit-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now();
    const newCommit = {
      id: commitId,
      message: msg,
      author: { id: currentUser.id, name: currentUser.name, email: currentUser.email, role: currentUser.role },
      timestamp: Date.now() / 1000,
      changes: JSON.parse(JSON.stringify(stagedChanges))
    };
    
    localCommits.push(newCommit);
    stagedChanges = [];
    gitCommitMsgInput.value = '';
    updateGitWorkspace();
    alert(`로컬 커밋이 정상적으로 생성되었습니다:\n[${commitId.substring(7,13)}] ${msg}`);
  });
}

// Visual PR Difference Preview Mode inside G6
function previewProposalDiff(prop) {
  const previewNodes = [];
  const previewEdges = [];
  
  // Deep copy base official tree
  const baseNodes = JSON.parse(JSON.stringify(baseGraphData.nodes));
  const baseEdges = JSON.parse(JSON.stringify(baseGraphData.edges));
  
  // Extract all changes from commits in the proposal
  const nodeChanges = {};
  const edgeChanges = {};
  
  prop.commits.forEach(commit => {
    commit.changes.forEach(change => {
      if (change.type === 'node') {
        nodeChanges[change.id] = change;
      } else if (change.type === 'edge') {
        edgeChanges[change.id] = change;
      }
    });
  });
  
  // Process base nodes
  baseNodes.forEach(node => {
    const change = nodeChanges[node.id];
    if (change) {
      if (change.action === 'modify') {
        const modifiedNode = { ...change.data, diffStatus: 'modify' };
        previewNodes.push(modifiedNode);
      } else if (change.action === 'delete') {
        const deletedNode = { ...node, diffStatus: 'delete' };
        previewNodes.push(deletedNode);
      }
    } else {
      previewNodes.push(node);
    }
  });
  
  // Proposed added nodes
  Object.values(nodeChanges).forEach(change => {
    if (change.action === 'add') {
      const addedNode = { ...change.data, diffStatus: 'add' };
      previewNodes.push(addedNode);
    }
  });
  
  // Process base edges
  baseEdges.forEach(edge => {
    const change = edgeChanges[edge.id];
    if (change && change.action === 'delete') {
      const deletedEdge = { ...edge, diffStatus: 'delete' };
      previewEdges.push(deletedEdge);
    } else {
      previewEdges.push(edge);
    }
  });
  
  // Proposed added edges
  Object.values(edgeChanges).forEach(change => {
    if (change.action === 'add') {
      const addedEdge = { ...change.data, diffStatus: 'add' };
      previewEdges.push(addedEdge);
    }
  });
  
  // Set UI warning banner
  let banner = document.getElementById('gitDiffBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'gitDiffBanner';
    banner.className = 'git-diff-banner';
    document.querySelector('.canvas-area').appendChild(banner);
  }
  banner.innerHTML = `
    <span><i class="fa-solid fa-eye"></i> <b>기여 제안 프리뷰 모드:</b> ${prop.contributor.name}님의 제안을 보고 있습니다.</span>
    <button id="btnExitDiffPreview" class="btn btn-compact btn-save"><i class="fa-solid fa-xmark"></i> 프리뷰 종료</button>
  `;
  banner.classList.add('show');
  
  document.getElementById('btnExitDiffPreview').addEventListener('click', () => {
    exitDiffPreview();
  });
  
  // Update G6 graph with preview data
  const formattedNodes = previewNodes.map(n => ({
    id: n.id,
    label: n.label,
    importance: n.importance,
    status: n.status,
    shape: n.shape || 'circle',
    subnodes: n.subnodes || [],
    type: 'poe-node',
    diffStatus: n.diffStatus,
    x: currentLayout === 'preset' ? n.x : undefined,
    y: currentLayout === 'preset' ? n.y : undefined
  }));

  const formattedEdges = previewEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'poe-edge',
    diffStatus: e.diffStatus
  }));

  graph.changeData({ nodes: formattedNodes, edges: formattedEdges });
}

function exitDiffPreview() {
  const banner = document.getElementById('gitDiffBanner');
  if (banner) {
    banner.classList.remove('show');
  }
  updateGraphData(); // returns to normal graphData
}
