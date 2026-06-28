// ==========================================
// State Management
// ==========================================
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
const sidebarPanel = document.getElementById('sidebarPanel');
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

// Stats Panel Elements
const statsPanelContainer = document.getElementById('statsPanelContainer');
const statsPanelHeader = document.getElementById('statsPanelHeader');
const btnMinimizeStats = document.getElementById('btnMinimizeStats');
const btnMaximizeStats = document.getElementById('btnMaximizeStats');
const btnResetProgress = document.getElementById('btnResetProgress');
const subnodesListBody = document.getElementById('subnodes-list-body');
const subnodeVisSelect = document.getElementById('subnodeVisSelect');
const subnodeRotSelect = document.getElementById('subnodeRotSelect');
const subnodeSpeedRange = document.getElementById('subnodeSpeedRange');

let subnodesVisible = true; // Subnode satellites visibility flag
let subnodesRotationEnabled = false;
let subnodesRotationSpeed = 1.0;

// Add Node / Cluster Modal Elements
const addNodeModal = document.getElementById('addNodeModal');
const btnCloseAddNodeModal = document.getElementById('btnCloseAddNodeModal');
const btnCancelAddNode = document.getElementById('btnCancelAddNode');
const btnConfirmAddNode = document.getElementById('btnConfirmAddNode');
const addNodeStandardInputs = document.getElementById('addNodeStandardInputs');
const addNodeClusterInputs = document.getElementById('addNodeClusterInputs');
const addNodeLabel = document.getElementById('addNodeLabel');
const addClusterLabel = document.getElementById('addClusterLabel');
const addClusterCount = document.getElementById('addClusterCount');
const addClusterIcon = document.getElementById('addClusterIcon');

// Mastery Sidebar Elements
const masteryStatsGroup = document.getElementById('masteryStatsGroup');
const masteryStatsInput = document.getElementById('masteryStatsInput');
const dependentSubnodesGroup = document.getElementById('dependentSubnodesGroup');
const dependentSubnodesList = document.getElementById('dependentSubnodesList');
const subnodeStatusCount = document.getElementById('subnodeStatusCount');
const btnLinkSubnodeMode = document.getElementById('btnLinkSubnodeMode');

let isLinkSubnodeMode = false;

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

// Mastery System Logic
function checkMasteryAutoActivation() {
  let changed = false;
  graphData.nodes.forEach(mastery => {
    if (mastery.isMastery && mastery.subnodes && mastery.subnodes.length > 0) {
      // Check if all subnodes are completed
      let allCompleted = true;
      mastery.subnodes.forEach(subId => {
        const sub = graphData.nodes.find(n => n.id === subId);
        if (!sub || sub.status !== 'Completed') {
          allCompleted = false;
        }
      });
      
      const targetStatus = allCompleted ? 'Completed' : 'Locked';
      if (mastery.status !== targetStatus) {
        mastery.status = targetStatus;
        if (graph) {
          const item = graph.findById(mastery.id);
          if (item) {
            graph.setItemState(item, 'status', targetStatus);
          }
        }
        changed = true;
      }
    }
  });
  
  if (changed && selectedNode && selectedNode.isMastery) {
    renderDependentSubnodesList(); // refresh count
  }
}

function renderDependentSubnodesList() {
  if (!dependentSubnodesList || !subnodeStatusCount) return;
  dependentSubnodesList.innerHTML = '';
  
  if (!selectedNode || !selectedNode.isMastery) return;
  
  const subs = selectedNode.subnodes || [];
  let completedCount = 0;
  
  if (subs.length === 0) {
    dependentSubnodesList.innerHTML = '<div style="font-size:11px; color:#888; text-align:center; padding:10px;">등록된 서브노드가 없습니다.</div>';
    subnodeStatusCount.textContent = `0/0 연결됨`;
    return;
  }
  
  subs.forEach((subId, idx) => {
    const subNode = graphData.nodes.find(n => n.id === subId);
    if (!subNode) return;
    
    if (subNode.status === 'Completed') completedCount++;
    
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:11px; padding:3px 5px; border-bottom:1px solid #2a2a2a;';
    
    const nameSpan = document.createElement('span');
    nameSpan.style.color = '#ccc';
    nameSpan.textContent = subNode.label || subId;
    
    const statusSpan = document.createElement('span');
    statusSpan.textContent = subNode.status === 'Completed' ? '완료' : '미완료';
    statusSpan.style.color = subNode.status === 'Completed' ? 'var(--status-completed)' : 'var(--text-secondary)';
    
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    delBtn.style.cssText = 'background:none; border:none; color:#f87171; cursor:pointer; font-size:10px; margin-left:5px;';
    delBtn.onclick = () => {
      selectedNode.subnodes.splice(idx, 1);
      renderDependentSubnodesList();
      checkMasteryAutoActivation();
      updateCharacterStats();
    };
    
    const rightBox = document.createElement('div');
    rightBox.style.display = 'flex';
    rightBox.style.alignItems = 'center';
    rightBox.appendChild(statusSpan);
    rightBox.appendChild(delBtn);
    
    div.appendChild(nameSpan);
    div.appendChild(rightBox);
    dependentSubnodesList.appendChild(div);
  });
  
  subnodeStatusCount.textContent = `${completedCount}/${subs.length} 연결됨`;
}

// Update Character Stats Panel (Set Effects)
function updateCharacterStats() {
  const statsPanel = document.getElementById('character-stats-list');
  if (!statsPanel) return;

  let allStats = {};

  graphData.nodes.forEach(n => {
    if (n.status === 'Completed' && n.stats) {
      n.stats.forEach(stat => {
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

// Context Menu Setup
let ctxTargetNode = null;
let edgeModeActive = false;
let edgeModeSourceNode = null;
let canvasCtxPos = { x: 0, y: 0 };

function setupContextMenu() {
  const menu = document.getElementById('ctx-menu');
  if (!menu) return;

  document.getElementById('ctx-close')?.addEventListener('click', closeCtxMenu);
  document.getElementById('ctx-edit-node')?.addEventListener('click', () => { openInlineEdit(ctxTargetNode); closeCtxMenu(); });
  document.getElementById('ctx-edit-label')?.addEventListener('click', () => { openInlineEdit(ctxTargetNode); closeCtxMenu(); });
  document.getElementById('ctx-edit-comment')?.addEventListener('click', () => { openInlineEdit(ctxTargetNode); closeCtxMenu(); });
  document.getElementById('ctx-add-edge')?.addEventListener('click', () => { startEdgeMode(ctxTargetNode); closeCtxMenu(); });
  document.getElementById('ctx-remove-node')?.addEventListener('click', () => { adminRemoveNode(ctxTargetNode); closeCtxMenu(); });

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

// Node Add Popup UI
let pendingAddNodePos = null;

function openAddNodePopup(x, y) {
  pendingAddNodePos = { x, y };
  window.selectedIconNode = null;
  
  if (addNodeModal) {
    addNodeModal.classList.remove('hidden');
    // reset inputs
    addNodeLabel.value = '';
    addClusterLabel.value = '';
    document.querySelector('input[name="addNodeType"][value="single"]').checked = true;
    addNodeStandardInputs.classList.remove('hidden');
    addNodeClusterInputs.classList.add('hidden');
    setTimeout(() => addNodeLabel.focus(), 50);
  }
}

window.closeAddNodePopup = function () {
  if (addNodeModal) addNodeModal.classList.add('hidden');
  pendingAddNodePos = null;
};

// Add Node Modal Events
if (addNodeModal) {
  document.querySelectorAll('input[name="addNodeType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'single') {
        addNodeStandardInputs.classList.remove('hidden');
        addNodeClusterInputs.classList.add('hidden');
      } else {
        addNodeStandardInputs.classList.add('hidden');
        addNodeClusterInputs.classList.remove('hidden');
      }
    });
  });

  btnCancelAddNode.addEventListener('click', closeAddNodePopup);
  btnCloseAddNodeModal.addEventListener('click', closeAddNodePopup);

  btnConfirmAddNode.addEventListener('click', async () => {
    if (!pendingAddNodePos) return;
    const type = document.querySelector('input[name="addNodeType"]:checked').value;
    
    let nodesToCreate = [];
    const { x, y } = pendingAddNodePos;
    const groupId = `group_${Date.now()}`;

    if (type === 'single') {
      const label = addNodeLabel.value.trim();
      if (!label) { showToast('노드 이름을 입력하세요.', 'error'); return; }
      nodesToCreate.push({
        id: `custom_${Date.now()}`,
        label: label,
        name: label,
        importance: 'Medium',
        status: 'Locked',
        comment: `# ${label}\n\n설명을 추가하세요.`,
        x: x, y: y,
        shape: 'circle',
        icon: 'normalActive_Art_2DArt_SkillIcons_passives_AtlasTrees_AulBloodlineNode.png.png',
        group: '', orbit: 0, orbit_index: 0,
        subnodes: [], stats: []
      });
    } else {
      // Cluster creation
      const label = addClusterLabel.value.trim();
      if (!label) { showToast('마스터리 이름을 입력하세요.', 'error'); return; }
      const count = parseInt(addClusterCount.value) || 3;
      const icon = addClusterIcon.value || 'mastery_Art_2DArt_SkillIcons_passives_MasteryGroupEvasion.png.png';
      
      const masteryId = `mastery_${Date.now()}`;
      let subnodeIds = [];
      
      // Calculate subnode positions (orbit 3, radius ~335)
      const radius = 335;
      for(let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2; // start from top
        const sx = x + radius * Math.cos(angle);
        const sy = y + radius * Math.sin(angle);
        const sId = `sub_${Date.now()}_${i}`;
        subnodeIds.push(sId);
        
        nodesToCreate.push({
          id: sId,
          label: `${label} 서브노드 ${i+1}`,
          name: `${label} 서브노드 ${i+1}`,
          importance: 'Medium',
          status: 'Locked',
          comment: `# ${label} 서브노드 ${i+1}\n\n설명을 추가하세요.`,
          x: sx, y: sy,
          shape: 'circle',
          icon: 'normalActive_Art_2DArt_SkillIcons_passives_AtlasTrees_AulBloodlineNode.png.png',
          group: groupId, orbit: 3, orbit_index: i,
          subnodes: [], stats: [],
          mastery_parent: masteryId
        });
      }
      
      nodesToCreate.push({
        id: masteryId,
        label: label,
        name: label,
        importance: 'High',
        status: 'Locked',
        comment: `# ${label}\n\n이 마스터리는 서브노드가 모두 완료되면 자동으로 활성화됩니다.`,
        x: x, y: y,
        shape: 'circle',
        icon: icon,
        group: groupId, orbit: 0, orbit_index: 0,
        subnodes: subnodeIds, stats: [],
        isMastery: true
      });
    }

    try {
      btnConfirmAddNode.disabled = true;
      for (const node of nodesToCreate) {
        const res = await fetch('/api/graph/structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add_node', data: node })
        });
        if (!res.ok) throw new Error('노드 생성 실패');
      }
      
      // If cluster, create edges to the mastery node
      if (type === 'cluster') {
        const masteryNode = nodesToCreate.find(n => n.isMastery);
        for (const sub of nodesToCreate.filter(n => !n.isMastery)) {
          await fetch('/api/graph/structure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add_edge',
              data: {
                id: `edge_${sub.id}_${masteryNode.id}`,
                source: sub.id,
                target: masteryNode.id,
                type: 'line'
              }
            })
          });
        }
      }
      
      showToast(`✅ 성공적으로 추가되었습니다.`, 'success');
      closeAddNodePopup();
      await fetchGraphData();
    } catch (err) {
      showToast('생성 중 오류: ' + err.message, 'error');
    } finally {
      btnConfirmAddNode.disabled = false;
    }
  });
}

function adminAddNodeAtPos(x, y) {
  openAddNodePopup(x, y);
}

// Inline Node Edit Popup
function openNodeEditModal(field) {
  openInlineEdit(ctxTargetNode);
}

function openInlineEdit(node) {
  if (!node) return;
  ctxTargetNode = node;
  const popup = document.getElementById('inlineEditPopup');
  const nodeId = document.getElementById('inlineEditNodeId');
  const labelEl = document.getElementById('inlineEditLabel');
  const commentEl = document.getElementById('inlineEditComment');
  const prDesc = document.getElementById('inlineEditPrDesc');
  if (!popup) return;

  nodeId.textContent = `ID: ${node.serial_id || node.id}  ·  ${node.label || ''}`;
  if (labelEl) labelEl.value = node.label || '';
  if (commentEl) commentEl.value = node.comment || '';
  prDesc.value = '';

  const role = currentUser?.role || 'guest';
  prDesc.placeholder = role === 'admin' ? '(Admin: 즉시 반영됨)' : '변경 사유 — PR로 제출됩니다';

  popup.style.display = 'block';
  const vw = window.innerWidth, vh = window.innerHeight;
  popup.style.left = Math.max(16, (vw - 460) / 2) + 'px';
  popup.style.top = Math.max(16, (vh - 360) / 2) + 'px';
  if (labelEl) labelEl.focus();
}

window.closeInlineEdit = function () {
  const popup = document.getElementById('inlineEditPopup');
  if (popup) popup.style.display = 'none';
};

window.submitInlineEdit = async function () {
  if (!ctxTargetNode) return;
  const labelEl = document.getElementById('inlineEditLabel');
  const commentEl = document.getElementById('inlineEditComment');
  const prDesc = document.getElementById('inlineEditPrDesc').value.trim();
  const newLabel = labelEl?.value.trim() ?? '';
  const newComment = commentEl?.value.trim() ?? '';
  const role = currentUser?.role || 'guest';
  if (role === 'guest') { showToast('로그인이 필요합니다.', 'error'); return; }

  try {
    const resLabel = await fetch('/api/graph/description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: ctxTargetNode.id, field: 'label', value: newLabel, pr_description: prDesc || undefined })
    });
    const resComment = await fetch('/api/graph/description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: ctxTargetNode.id, field: 'comment', value: newComment, pr_description: prDesc || undefined })
    });
    const dataLabel = await resLabel.json();
    const dataComment = await resComment.json();

    if (resLabel.ok && resComment.ok) {
      const localNode = graphData.nodes.find(n => n.id === ctxTargetNode.id);
      if (localNode) { localNode.label = newLabel; localNode.comment = newComment; }
      ctxTargetNode.label = newLabel;
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
  } catch (err) {
    showToast('네트워크 오류', 'error');
  }
};

function setupNodeEditModal() {
  document.getElementById('btnCloseNodeEdit')?.addEventListener('click', () => {
    document.getElementById('nodeEditModal').classList.add('hidden');
  });
  document.getElementById('btnCancelNodeEdit')?.addEventListener('click', () => {
    document.getElementById('nodeEditModal').classList.add('hidden');
  });
}

// Admin: Edge Connect Mode
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
      await fetchGraphData();
      showToast('✅ 엣지가 추가되었습니다. 곡률을 설정하세요.', 'success');
      openEdgeConnectCurvaturePopup(edgeId, sourceNode, targetNode);
    } else {
      const d = await res.json();
      showToast('오류: ' + (d.detail || '엣지 추가 실패'), 'error');
    }
  } catch (err) {
    showToast('네트워크 오류: ' + err.message, 'error');
  }
  cancelEdgeMode();
}

// Edge Connect Curvature Popup
let edgeConnectTarget = null;

function openEdgeConnectCurvaturePopup(edgeId, sourceNode, targetNode) {
  const popup = document.getElementById('edgeConnectCurvaturePopup');
  const info = document.getElementById('edgeConnectInfoText');
  const slider = document.getElementById('edgeConnectCurvatureSlider');
  const valEl = document.getElementById('edgeConnectCurvatureVal');
  if (!popup) return;

  const edgeRef = graph?.dataObj?.edges?.find(e => e.id === edgeId);
  edgeConnectTarget = { id: edgeId, edgeRef, sourceNode, targetNode };

  // ── Parallel edge overlay detection ──────────────────────────────────────
  // Check if there's already another edge between the same two nodes (reverse direction)
  const parallelEdge = graph?.dataObj?.edges?.find(e =>
    e.id !== edgeId &&
    ((e.source == sourceNode.id && e.target == targetNode.id) ||
     (e.source == targetNode.id && e.target == sourceNode.id))
  );

  const warnEl = document.getElementById('edgeConnectOverlapWarning');
  let suggestedCurvature = 0;
  if (parallelEdge) {
    // Suggest opposite curvature to avoid overlap
    const existingCurv = parallelEdge.curvature ?? 0;
    suggestedCurvature = existingCurv >= 0 ? -0.3 : 0.3;
    if (warnEl) {
      warnEl.style.display = 'block';
      warnEl.textContent = `⚠️ 평행 엣지 감지! 곡률 ${suggestedCurvature > 0 ? '+' : ''}${suggestedCurvature} 자동 제안`;
    }
  } else {
    if (warnEl) warnEl.style.display = 'none';
  }

  info.textContent = `${sourceNode.label || sourceNode.id} ↔ ${targetNode.label || targetNode.id}`;
  slider.value = suggestedCurvature;
  valEl.innerText = String(suggestedCurvature);

  if (edgeRef && graph) {
    edgeRef.curvature = suggestedCurvature || undefined;
    graph.highlightedEdge = edgeRef;
    graph.render();
  }

  popup.style.display = 'block';
  const vw = window.innerWidth, vh = window.innerHeight;
  popup.style.left = Math.max(16, (vw - 290) / 2) + 'px';
  popup.style.top  = Math.max(16, (vh - 240) / 2) + 'px';
}

window.updateNewEdgeCurvaturePreview = function (val) {
  if (!edgeConnectTarget?.edgeRef || !graph) return;
  edgeConnectTarget.edgeRef.curvature = parseFloat(val);
  graph.render();
};

window.skipEdgeConnectCurvature = function () {
  if (graph) { graph.highlightedEdge = null; graph.render(); }
  const popup = document.getElementById('edgeConnectCurvaturePopup');
  if (popup) popup.style.display = 'none';
  edgeConnectTarget = null;
};

window.saveEdgeConnectCurvature = async function () {
  if (!edgeConnectTarget) return;
  const slider = document.getElementById('edgeConnectCurvatureSlider');
  const curvature = parseFloat(slider.value);
  if (curvature === 0) { skipEdgeConnectCurvature(); return; }
  try {
    const res = await fetch('/api/graph/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit_edge_curvature', data: { id: edgeConnectTarget.id, curvature } })
    });
    if (res.ok) {
      if (edgeConnectTarget.edgeRef) edgeConnectTarget.edgeRef.curvature = curvature;
      showToast('✅ 곡률이 저장되었습니다.', 'success');
    } else {
      showToast('곡률 저장 실패', 'error');
    }
  } catch (e) {
    showToast('네트워크 오류', 'error');
  }
  skipEdgeConnectCurvature();
};

// Icon Picker Logic
let allIconsCache = [];

window.openIconPicker = async function () {
  const modal = document.getElementById('iconPickerModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.getElementById('iconSearchInput').value = '';

  if (allIconsCache.length === 0) {
    try {
      const res = await fetch('/api/icons');
      if (res.ok) allIconsCache = await res.json();
    } catch (err) {
      console.error('Failed to load icons', err);
    }
  }
  window.filterIcons();
};

window.closeIconPicker = function () {
  const modal = document.getElementById('iconPickerModal');
  if (modal) modal.classList.add('hidden');
};

window.filterIcons = function () {
  const q = document.getElementById('iconSearchInput').value.toLowerCase();
  const grid = document.getElementById('iconGrid');
  grid.innerHTML = '';

  const filtered = allIconsCache.filter(icon => icon.toLowerCase().includes(q));
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

// Edge Edit Popup
let edgeEditTarget = null;

window.updateEdgeCurvaturePreview = function (val) {
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

window.closeEdgeEditPopup = function () {
  const popup = document.getElementById('edgeEditPopup');
  if (popup) popup.style.display = 'none';
  if (graph) { graph.highlightedEdge = null; graph.render(); }
  edgeEditTarget = null;
};

window.submitEdgeEdit = async function () {
  if (!edgeEditTarget) return;
  const slider = document.getElementById('edgeCurvatureSlider');
  const val = parseFloat(slider.value);
  const edgeId = edgeEditTarget.id || `${edgeEditTarget.source}-${edgeEditTarget.target}`;

  try {
    const res = await fetch('/api/graph/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit_edge_curvature', data: { id: edgeId, curvature: val } })
    });
    if (res.ok) {
      showToast('✅ 엣지 곡률이 저장되었습니다.', 'success');
      if (edgeEditTarget) edgeEditTarget.curvature = val;
      closeEdgeEditPopup();
      await fetchGraphData();
    } else {
      const d = await res.json();
      showToast('저장 실패: ' + (d.detail || '오류'), 'error');
    }
  } catch (err) {
    showToast('네트워크 오류: ' + err.message, 'error');
  }
};

window.deleteHighlightedEdge = async function () {
  const edge = edgeEditTarget || graph?.highlightedEdge;
  if (!edge) return;
  if (currentUser?.role !== 'admin') { showToast('Admin만 삭제할 수 있습니다.', 'error'); return; }
  
  const n1 = edge.sourceNode?.label || edge.source;
  const n2 = edge.targetNode?.label || edge.target;
  if (!confirm(`엣지 [${n1} ↔ ${n2}]를 삭제하시겠습니까?`)) return;

  const edgeId = edge.id || `${edge.source}-${edge.target}`;
  try {
    const res = await fetch('/api/graph/structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_edge', data: { id: edgeId } })
    });
    if (res.ok) {
      showToast('🗑 엣지가 삭제되었습니다.', 'success');
      closeEdgeEditPopup();
      await fetchGraphData();
    } else {
      const d = await res.json();
      showToast('삭제 실패: ' + (d.detail || '오류'), 'error');
    }
  } catch (err) {
    showToast('네트워크 오류: ' + err.message, 'error');
  }
};

async function adminRemoveNode(node, silent = false) {
  if (!node || currentUser?.role !== 'admin') return;
  if (!silent && !confirm(`"${node.label}" 노드를 삭제하시겠습니까? 연결된 엣지도 모두 제거됩니다.`)) return;
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
  } catch (err) {
    showToast('네트워크 오류', 'error');
  }
}

// Admin Toolbar setup
function setupAdminToolbar() {
  document.getElementById('btnAdminAddNode')?.addEventListener('click', () => {
    if (currentUser?.role !== 'admin') { showToast('Admin만 가능합니다.', 'error'); return; }
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

  document.getElementById('btnOpenPrPanelAdmin')?.addEventListener('click', showPrSidebar);
  document.getElementById('btnRefreshPr')?.addEventListener('click', () => loadPrSidebar());
}

// PR Sidebar Panel
let prHighlightedNodes = [];

function showPrSidebar() {
  document.querySelectorAll('.sidebar-section').forEach(s => s.classList.remove('active'));
  const prSection = document.getElementById('pr-sidebar-section');
  if (prSection) { prSection.style.display = 'block'; prSection.classList.add('active'); }
  if (sidebarPanel) sidebarPanel.style.display = 'flex';
  loadPrSidebar();
}

function clearPrHighlights() {
  if (!graph) return;
  prHighlightedNodes.forEach(id => {
    graph.setItemState(id, 'pr_highlight', false);
    graph.setItemState(id, 'pr_dim', false);
  });
  graphData.nodes.forEach(n => graph.setItemState(n.id, 'pr_dim', false));
  prHighlightedNodes = [];
}

function highlightPrNodes(nodeIds) {
  if (!graph) return;
  clearPrHighlights();
  const highlightSet = new Set(nodeIds);
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
  if (nodeIds.length > 0) {
    const node = graph.findById(nodeIds[0]);
    if (node && graph.transform) {
      const canvas = document.getElementById('tree-canvas');
      const targetX = canvas.width / 2 - node.x * graph.transform.k;
      const targetY = canvas.height / 2 - node.y * graph.transform.k;
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

    if (prs.length === 0) {
      list.innerHTML = '<p style="color:#666;font-size:13px;padding:8px;">제출된 PR이 없습니다.</p>';
      return;
    }

    const useName = document.getElementById('prShowNodeNameToggle')?.checked;
    const getLabel = (id) => {
      if (!id) return '?';
      if (!useName) return String(id);
      const n = graphData?.nodes?.find(x => x.id == id);
      return n ? (n.label || String(id)) : String(id);
    };

    list.innerHTML = prs.map(pr => {
      const ts = new Date(pr.timestamp * 1000).toLocaleString('ko-KR');
      const statusColor = pr.status === 'merged' ? '#4ade80' : pr.status === 'rejected' ? '#f87171' : '#f0c060';
      const statusBg = pr.status === 'merged' ? '#0a1a0a' : pr.status === 'rejected' ? '#1a0a0a' : '#1a1400';
      const statusLabel = pr.status === 'merged' ? '✅ Merged' : pr.status === 'rejected' ? '❌ Rejected' : '⏳ Pending';

      const changes = { addedNodes: [], removedNodes: [], editedNodes: [], addedEdges: [], removedEdges: [], fieldEdits: [] };

      if (pr.type === 'status') {
        for (const [nid, info] of Object.entries(pr.changes || {})) {
          changes.editedNodes.push({ id: nid, from: info.from, to: info.to });
        }
      } else if (pr.type === 'description') {
        const nid = pr.changes?.node_id;
        const field = pr.changes?.field;
        const val = pr.changes?.value;
        if (nid) changes.fieldEdits.push({ id: nid, field, value: val });
      } else {
        for (const c of (pr.commits || [])) {
          for (const ch of (c.changes || [])) {
            if (ch.type === 'node') {
              if (ch.action === 'add') changes.addedNodes.push(ch.id);
              if (ch.action === 'delete') changes.removedNodes.push(ch.id);
              if (ch.action === 'modify') changes.editedNodes.push({ id: ch.id });
            } else if (ch.type === 'edge') {
              if (ch.action === 'add') changes.addedEdges.push(ch);
              if (ch.action === 'delete') changes.removedEdges.push(ch);
            }
          }
        }
        if (pr.graphData?.nodes && changes.addedNodes.length === 0 && changes.removedNodes.length === 0) {
          for (const n of (pr.graphData.nodes || [])) changes.addedNodes.push(n.id);
          for (const e of (pr.graphData.edges || [])) changes.addedEdges.push(e);
        }
      }

      const rows = [];

      for (const id of [...new Set(changes.addedNodes)]) {
        const label = getLabel(id);
        rows.push(`<div style="display:flex;align-items:baseline;gap:5px;margin-top:5px;cursor:pointer;" onclick="event.stopPropagation(); window.focusPrItem('node', '${id}')">
          <span style="font-size:16px;line-height:1;">🟢</span>
          <span><b style="color:#4ade80;">노드 추가</b> &nbsp;<span style="background:#0f2010;border:1px solid #4ade8044;border-radius:3px;padding:1px 6px;font-size:11px;color:#a0e8a0;">${label}</span></span>
        </div>`);
      }

      for (const id of [...new Set(changes.removedNodes)]) {
        const label = getLabel(id);
        rows.push(`<div style="display:flex;align-items:baseline;gap:5px;margin-top:5px;cursor:pointer;" onclick="event.stopPropagation(); window.focusPrItem('node', '${id}')">
          <span style="font-size:16px;line-height:1;">🔴</span>
          <span><b style="color:#f87171;">노드 삭제</b> &nbsp;<span style="background:#200f0f;border:1px solid #f8717144;border-radius:3px;padding:1px 6px;font-size:11px;color:#fca5a5;text-decoration:line-through;">${label}</span></span>
        </div>`);
      }

      for (const item of changes.editedNodes) {
        const id = item.id || item;
        const label = getLabel(id);
        const detail = item.from && item.to ? ` <span style="color:#888;">${item.from} → ${item.to}</span>` : '';
        rows.push(`<div style="display:flex;align-items:baseline;gap:5px;margin-top:5px;cursor:pointer;" onclick="event.stopPropagation(); window.focusPrItem('node', '${id}')">
          <span style="font-size:16px;line-height:1;">🟡</span>
          <span><b style="color:#f0c060;">노드 수정</b> &nbsp;<span style="background:#1a1200;border:1px solid #f0c06044;border-radius:3px;padding:1px 6px;font-size:11px;color:#fde68a;">${label}</span>${detail}</span>
        </div>`);
      }

      for (const fe of changes.fieldEdits) {
        const label = getLabel(fe.id);
        const fieldName = fe.field === 'label' ? '이름' : fe.field === 'comment' ? '설명' : fe.field;
        rows.push(`<div style="display:flex;align-items:baseline;gap:5px;margin-top:5px;cursor:pointer;" onclick="event.stopPropagation(); window.focusPrItem('node', '${fe.id}')">
          <span style="font-size:16px;line-height:1;">✏️</span>
          <span><b style="color:#a78bfa;">${fieldName} 수정</b> &nbsp;<span style="background:#120f1a;border:1px solid #a78bfa44;border-radius:3px;padding:1px 6px;font-size:11px;color:#c4b5fd;">${label}</span>
          ${fe.value ? `<span style="color:#666;font-size:10px;margin-left:4px;">"${String(fe.value).slice(0, 30)}${fe.value.length > 30 ? '...' : ''}"</span>` : ''}</span>
        </div>`);
      }

      for (const e of changes.addedEdges) {
        const sid = e.source || e.from || '';
        const tid = e.target || e.to || '';
        const s = getLabel(sid || '?');
        const t = getLabel(tid || '?');
        rows.push(`<div style="display:flex;align-items:baseline;gap:5px;margin-top:5px;cursor:pointer;" onclick="event.stopPropagation(); window.focusPrItem('edge', '${sid}', '${tid}')">
          <span style="font-size:14px;line-height:1;">🔗</span>
          <span><b style="color:#67e8f9;">엣지 추가</b> &nbsp;<span style="background:#0a1a1f;border:1px solid #67e8f944;border-radius:3px;padding:1px 6px;font-size:11px;color:#a5f3fc;">${s} ↔ ${t}</span></span>
        </div>`);
      }

      for (const e of changes.removedEdges) {
        const sid = e.source || e.from || '';
        const tid = e.target || e.to || '';
        const s = getLabel(sid || '?');
        const t = getLabel(tid || '?');
        rows.push(`<div style="display:flex;align-items:baseline;gap:5px;margin-top:5px;cursor:pointer;" onclick="event.stopPropagation(); window.focusPrItem('edge', '${sid}', '${tid}')">
          <span style="font-size:14px;line-height:1;">⛔</span>
          <span><b style="color:#fb923c;">엣지 삭제</b> &nbsp;<span style="background:#1a0f0a;border:1px solid #fb923c44;border-radius:3px;padding:1px 6px;font-size:11px;color:#fed7aa;text-decoration:line-through;">${s} ↔ ${t}</span></span>
        </div>`);
      }

      const changeSummary = [
        changes.addedNodes.length ? `+${changes.addedNodes.length}노드` : '',
        changes.removedNodes.length ? `-${changes.removedNodes.length}노드` : '',
        changes.editedNodes.length ? `~${changes.editedNodes.length}수정` : '',
        changes.addedEdges.length ? `+${changes.addedEdges.length}엣지` : '',
        changes.removedEdges.length ? `-${changes.removedEdges.length}엣지` : '',
        changes.fieldEdits.length ? `~${changes.fieldEdits.length}필드` : '',
      ].filter(Boolean).join('  ');

      const affectedIds = [
        ...changes.addedNodes, ...changes.removedNodes,
        ...changes.editedNodes.map(x => x.id || x),
        ...changes.fieldEdits.map(x => x.id)
      ].filter(Boolean);
      const idsJson = JSON.stringify([...new Set(affectedIds)]).replace(/"/g, '&quot;');

      const hasDetail = rows.length > 0;
      const detailsHtml = hasDetail ? `
        <div class="pr-details" style="display:none;margin-top:8px;padding:8px;background:#050302;border-radius:4px;border:1px solid #2a1e0e;">
          ${rows.join('')}
        </div>` : '';

      return `
      <div class="pr-card" data-ids="${idsJson}" onclick="prCardClick(this, '${idsJson.replace(/'/g, "\\'")}')"
           style="border:1px solid #2a2010;border-radius:8px;margin-bottom:10px;padding:0;background:${statusBg};
                  cursor:pointer;transition:border-color 0.2s,box-shadow 0.2s;overflow:hidden;"
           onmouseenter="this.style.borderColor='#8a6a2e';this.style.boxShadow='0 2px 12px #c8a96e22';"
           onmouseleave="this.style.borderColor='#2a2010';this.style.boxShadow='none';">

        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;
                    background:linear-gradient(90deg,#1a1208,transparent);border-bottom:1px solid #2a2010;">
          <span style="font-size:12px;font-weight:bold;color:#c8a96e;flex:1;margin-right:8px;line-height:1.3;">${pr.description || '(제목 없음)'}</span>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <span style="color:${statusColor};font-size:11px;font-weight:bold;white-space:nowrap;">${statusLabel}</span>
            ${hasDetail ? `<button onclick="event.stopPropagation();const d=this.closest('.pr-card').querySelector('.pr-details');d.style.display=d.style.display==='none'?'block':'none';this.textContent=d.style.display==='none'?'▼':'▲';" style="background:#1a1410;border:1px solid #3a2e1e;border-radius:4px;color:#8a6a2e;cursor:pointer;font-size:10px;padding:2px 6px;">▼</button>` : ''}
          </div>
        </div>

        <div style="padding:8px 12px 4px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
            <span style="font-size:10px;color:#7a6d5a;">${pr.contributor?.name || '알 수 없음'}</span>
            <span style="font-size:10px;color:#4a4030;">|</span>
            <span style="font-size:10px;color:#6a5e4c;">${ts}</span>
          </div>
          ${changeSummary ? `<div style="font-size:10px;color:#8a7a5a;letter-spacing:0.5px;">${changeSummary}</div>` : ''}
        </div>

        <div style="padding:0 12px 8px;">${detailsHtml}</div>

        ${pr.status === 'pending' ? `
        <div style="display:flex;gap:6px;padding:8px 12px;border-top:1px solid #2a1e0e;background:#080604;">
          <button class="btn btn-primary" style="font-size:11px;padding:4px 12px;flex:1;" onclick="event.stopPropagation();approvePr('${pr.id}')">✅ Merge</button>
          <button class="btn" style="font-size:11px;padding:4px 12px;flex:1;color:#f87171;border-color:#f87171;" onclick="event.stopPropagation();rejectPr('${pr.id}')">❌ Reject</button>
        </div>` : ''}
      </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = '<p style="color:#f87171;font-size:13px;">PR 목록을 불러오는데 실패했습니다.</p>';
  }
}

window.prCardClick = function (el, idsJson) {
  try {
    const ids = JSON.parse(idsJson.replace(/&quot;/g, '"'));
    highlightPrNodes(ids);
    document.querySelectorAll('.pr-card').forEach(c => c.style.background = '#0f0a05');
    el.style.background = '#1a1208';
  } catch (e) { }
};

window.focusPrItem = function(type, id1, id2) {
  if (!graph) return;
  if (type === 'node') {
    const item = graph.findById(id1);
    if (item) {
      graph.focusItem(item, true, { easing: 'easeCubic', duration: 400 });
      // Blink or highlight the node slightly
      graph.setItemState(item, 'selected', true);
      setTimeout(() => graph.setItemState(item, 'selected', false), 1500);
    }
  } else if (type === 'edge') {
    const edges = graph.getEdges();
    const edge = edges.find(e => {
      const model = e.getModel();
      return (model.source === id1 && model.target === id2) || (model.source === id2 && model.target === id1);
    });
    if (edge) {
      // Focus on the center of the edge (focusItem mostly works for nodes, but G6 supports it for edges too, or we get edge center)
      graph.focusItem(edge, true, { easing: 'easeCubic', duration: 400 });
    }
  }
};

window.approvePr = async function (prId) {
  const res = await fetch(`/api/admin/contributions/${prId}/approve`, { method: 'POST' });
  if (res.ok) {
    showToast('✅ PR이 Merge되었습니다.', 'success');
    clearPrHighlights();
    loadPrSidebar();
    fetchGraphData();
  } else { showToast('Merge 실패', 'error'); }
};

window.rejectPr = async function (prId) {
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
  if (!container) return;
  const width = container.parentElement.clientWidth;
  const height = container.parentElement.clientHeight || 800;

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
    curvature: e.curvature
  }));

  if (!graph) {
    // Ensure CanvasGraph is instantiated correctly with the target container element if required by implementation
    graph = new CanvasGraph({ container, width, height });

    graph.on('node:click', (evt) => {
      const { item } = evt;
      const model = item.getModel();

      if (edgeModeActive && edgeModeSourceNode) {
        if (model.id !== edgeModeSourceNode.id) {
          adminAddEdge(edgeModeSourceNode, model);
        } else {
          showToast('같은 노드는 연결할 수 없습니다.', 'error');
          cancelEdgeMode();
        }
        return;
      }

      if (isLinkSubnodeMode && selectedNode && selectedNode.isMastery) {
        if (model.id !== selectedNode.id) {
          if (!selectedNode.subnodes) selectedNode.subnodes = [];
          if (!selectedNode.subnodes.includes(model.id)) {
            selectedNode.subnodes.push(model.id);
            if (model.mastery_parent !== selectedNode.id) model.mastery_parent = selectedNode.id;
            
            // Add a visual edge if they want
            const edgeExists = graphData.edges.some(e => 
              (e.source === model.id && e.target === selectedNode.id) || 
              (e.source === selectedNode.id && e.target === model.id)
            );
            
            if (!edgeExists) {
              const newEdge = { id: `edge_${model.id}_${selectedNode.id}`, source: model.id, target: selectedNode.id, type: 'line' };
              graphData.edges.push(newEdge);
              if(graph && typeof graph.addItem === 'function') graph.addItem('edge', newEdge);
            }
            
            showToast(`✅ "${model.label}" 노드를 서브노드로 등록했습니다.`, 'success');
            renderDependentSubnodesList();
          } else {
            showToast('이미 등록된 서브노드입니다.', 'error');
          }
        }
        isLinkSubnodeMode = false;
        btnLinkSubnodeMode.classList.remove('active');
        btnLinkSubnodeMode.innerHTML = '<i class="fa-solid fa-link"></i> 새로운 서브노드 연결하기';
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
        const newStatus = model.status === 'Completed' ? 'Locked' : 'Completed';
        model.status = newStatus;

        const dataNode = graphData.nodes.find(n => n.id === model.id);
        if (dataNode) dataNode.status = newStatus;

        graph.setItemState(item, 'status', newStatus);
        
        // Auto-Activation Logic
        checkMasteryAutoActivation();

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

    graph.on('node:mouseenter', (evt) => {
      const model = evt.item.getModel();
      if (!tooltip) return;

      ttTitle.textContent = model.label || 'Unknown';
      ttTitle.style.color = (model.importance === 'High') ? '#e7b655' :
        (model.importance === 'Medium') ? '#d4af37' : '#fff';

      const stats = model.stats || [];
      if (stats.length > 0) {
        ttStats.innerHTML = `<p style="font-size:12px;color:#9a8d7a;margin:2px 0 6px">📊 스킬 효과</p><ul style="margin:0;padding-left:18px">`
          + stats.map(s => `<li>${s}</li>`).join('') + '</ul>';
      } else {
        ttStats.innerHTML = '<p style="color:#6a5e4c;font-size:12px">속성 없음</p>';
      }
      const ttNodeId = document.getElementById('tt-node-id');
      if (ttNodeId) ttNodeId.innerText = model.serial_id || '';

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

    graph.on('node:contextmenu', (evt) => {
      if (!evt.item) return;
      const e = evt.originalEvent;
      e.preventDefault();
      e.stopPropagation();
      closeCtxMenu();
      closeCanvasCtxMenu();
      const node = evt.item.getModel ? evt.item.getModel() : evt.item;

      if (!edgeModeActive) {
        if (currentUser?.role === 'admin') {
          openCtxMenu(node, e.clientX, e.clientY);
        }
      }
    });

    graph.on('edge:contextmenu', (evt) => {
      if (!evt.item) return;
      const e = evt.originalEvent;
      e.preventDefault();
      e.stopPropagation();
      closeCtxMenu();
      closeCanvasCtxMenu();

      if (graph) {
        graph.highlightedEdge = evt.item;
        graph.render();
      }

      openEdgeEditPopup(evt.item, e.clientX, e.clientY);
    });

    const canvasEl = document.getElementById('tree-canvas');
    canvasEl?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const coords = graph.getCanvasCoords(e);
      const hitNode = graph.hitTestNode(coords.x, coords.y);
      if (hitNode) return;
      const hitEdge = graph.hitTestEdge(coords.x, coords.y);
      if (hitEdge) return;
      closeCtxMenu();
      openCanvasCtxMenu(e.clientX, e.clientY, coords.x, coords.y);
    });
  } else {
    // If graph already exists, update size if necessary
    if (typeof graph.changeSize === 'function') {
      graph.changeSize(width, height);
    }
  }

  // Always update data
  graph.changeData({ nodes: formattedNodes, edges: formattedEdges, groups: graphData.groups });

  if (animationEnabled && currentOrbit !== 'none') {
    startOrbitMotion();
  }
}

// Refresh Graph Elements
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
    curvature: e.curvature
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

    orbitTime += 0.015;

    try {
      graph.getNodes().forEach(node => {
        const model = node.getModel();
        const initPos = initialPositions[model.id];
        if (!initPos) return;

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

        // Add defensive checking for engine wrapper structure
        if (subnodesVisible && typeof node.getContainer === 'function') {
          const group = node.getContainer();
          if (group && typeof group.find === 'function') {
            const subnodesCount = model.subnodes ? model.subnodes.length : 0;
            const baseSize = model.importance === 'High' ? 60 : (model.importance === 'Medium' ? 46 : 32);
            const size = Math.min(100, baseSize + (subnodesCount * 5));
            const trackRadius = (size / 2) + 24;
            const satelliteSpeed = subnodesRotationEnabled ? (orbitTime * 1.8 * subnodesRotationSpeed) : 0;

            for (let i = 0; i < subnodesCount; i++) {
              const glowShape = group.find(item => item.get && item.get('name') === `sub-sat-glow-${i}`);
              const bodyShape = group.find(item => item.get && item.get('name') === `sub-sat-body-${i}`);
              const textShape = group.find(item => item.get && item.get('name') === `sub-sat-text-${i}`);

              if (glowShape && bodyShape && typeof glowShape.attr === 'function') {
                const initialAngle = glowShape.get('initialAngle') || 0;
                const currentAngle = initialAngle + satelliteSpeed;
                const satX = trackRadius * Math.cos(currentAngle);
                const satY = trackRadius * Math.sin(currentAngle);

                glowShape.attr({ x: satX, y: satY });
                bodyShape.attr({ x: satX, y: satY });
                if (textShape && typeof textShape.attr === 'function') {
                  textShape.attr({ x: satX, y: satY - 10 });
                }
              }
            }
          }
        }

        if (typeof node.getContainer === 'function') {
          const group = node.getContainer();
          if (group && typeof group.find === 'function') {
            const glowShape = group.find(item => item.get && item.get('name') === 'glow-shape');
            if (glowShape && typeof glowShape.attr === 'function') {
              if (selectedNodes.includes(model.id)) {
                const pulseScale = 1.0 + Math.sin(orbitTime * 5) * 0.12;
                glowShape.attr('opacity', 0.4 + Math.sin(orbitTime * 5) * 0.15);
                glowShape.attr('transform', `scale(${pulseScale})`);
              } else {
                glowShape.attr('transform', 'scale(1)');
                glowShape.attr('opacity', currentTheme === 'light' ? 0.08 : 0.25);
              }
            }
          }
        }
      });
    } catch (err) {
      console.warn("Animation loop exception muted:", err);
    }

    orbitAnimationFrameId = requestAnimationFrame(tick);
  }

  orbitAnimationFrameId = requestAnimationFrame(tick);
}

// Render Subnodes List
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

    item.querySelector('.subnode-input').addEventListener('change', (e) => {
      const i = e.target.getAttribute('data-idx');
      selectedNode.subnodes[i].label = e.target.value.trim() || '세부 단원';
      updateGraphData();
    });

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

    item.querySelector('.subnode-delete').addEventListener('click', (e) => {
      const i = e.currentTarget.getAttribute('data-idx');
      selectedNode.subnodes.splice(i, 1);
      renderSubnodesList();
      updateGraphData();
    });

    subnodesListBody.appendChild(item);
  });
}

// --- Stats Panel Draggable & Window Controls ---
if (statsPanelContainer && statsPanelHeader) {
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  statsPanelHeader.addEventListener('mousedown', dragStart);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('mousemove', drag);

  function dragStart(e) {
    if (e.target.closest('button')) return; // Ignore buttons
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
  }

  function dragEnd(e) {
    if (!isDragging) return;
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      statsPanelContainer.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
  }
}

if (btnMinimizeStats) {
  btnMinimizeStats.addEventListener('click', () => {
    const list = document.getElementById('character-stats-list');
    if (list.style.display === 'none') {
      list.style.display = 'flex';
      btnMinimizeStats.innerHTML = '<i class="fa-solid fa-minus"></i>';
      statsPanelContainer.classList.remove('minimized');
    } else {
      list.style.display = 'none';
      btnMinimizeStats.innerHTML = '<i class="fa-solid fa-window-restore"></i>';
      statsPanelContainer.classList.add('minimized');
    }
  });
}

if (btnMaximizeStats) {
  btnMaximizeStats.addEventListener('click', () => {
    const list = document.getElementById('character-stats-list');
    list.style.display = 'flex'; // Un-minimize if it was
    btnMinimizeStats.innerHTML = '<i class="fa-solid fa-minus"></i>';
    statsPanelContainer.classList.remove('minimized');
    
    if (statsPanelContainer.classList.contains('maximized')) {
      statsPanelContainer.classList.remove('maximized');
      btnMaximizeStats.innerHTML = '<i class="fa-solid fa-expand"></i>';
    } else {
      statsPanelContainer.classList.add('maximized');
      btnMaximizeStats.innerHTML = '<i class="fa-solid fa-compress"></i>';
    }
  });
}

if (btnResetProgress) {
  btnResetProgress.addEventListener('click', async () => {
    if (!confirm('정말로 스킬트리의 누적 스킬 효과(진척도)를 모두 초기화하시겠습니까? (커스텀 노드는 삭제되지 않습니다)')) return;
    try {
      const res = await fetch('/api/graph/reset_progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        showToast('스킬트리가 초기화되었습니다.', 'success');
        fetchGraphData();
      } else {
        showToast('초기화에 실패했습니다.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('오류가 발생했습니다.', 'error');
    }
  });
}

// Select Node Logic
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
    graph.getNodes().forEach(n => {
      const nid = n.getModel().id;
      if (selectedNodes.includes(nid)) {
        graph.setItemState(n, 'selected', true);
      } else {
        graph.setItemState(n, 'selected', false);
      }
    });
  }

  sidebarPanel.style.display = 'flex';
  editorState.classList.add('active');

  editorTitle.textContent = selectedNode.label;
  inputLabel.value = selectedNode.label;
  selectImportance.value = selectedNode.importance;
  selectStatus.value = selectedNode.status;
  selectShape.value = selectedNode.shape || 'circle';
  textComment.value = selectedNode.comment || '';

  // Mastery Logic UI
  if (selectedNode.isMastery) {
    masteryStatsGroup.classList.remove('hidden');
    dependentSubnodesGroup.classList.remove('hidden');
    masteryStatsInput.value = (selectedNode.stats || []).join('\n');
    renderDependentSubnodesList();
  } else {
    masteryStatsGroup.classList.add('hidden');
    dependentSubnodesGroup.classList.add('hidden');
  }

  isLinkSubnodeMode = false;
  if (btnLinkSubnodeMode) {
    btnLinkSubnodeMode.classList.remove('active');
    btnLinkSubnodeMode.innerHTML = '<i class="fa-solid fa-link"></i> 새로운 서브노드 연결하기';
  }

  renderSubnodesList();
  showEditTab();
}

function clearSelection() {
  selectedNode = null;
  selectedNodes = [];
  if (graph && typeof graph.getNodes === 'function') {
    graph.getNodes().forEach(n => graph.clearItemStates(n));
  }
  editorState.classList.remove('active');
  sidebarPanel.style.display = 'none';
}

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

  const compiledHtml = marked.parse(textComment.value || '*코멘트가 없습니다.*');
  previewComment.innerHTML = compiledHtml;

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
          const cursorPos = textComment.selectionStart;
          const text = textComment.value;
          const imgMarkdown = `\n![이미지](${res.url})\n`;
          textComment.value = text.substring(0, cursorPos) + imgMarkdown + text.substring(cursorPos);
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

btnApply.addEventListener('click', () => {
  if (!selectedNode) return;

  const label = inputLabel.value.trim() || '이름 없음';
  const importance = selectImportance.value;
  const status = selectStatus.value;
  const shape = selectShape.value;
  const comment = textComment.value;

  if (selectedNodes.length === 1) {
    const node = selectedNode;
    node.label = label;
    node.name = label;
    node.importance = importance;
    node.status = status;
    node.comment = comment;
    node.shape = shape;

    if (node.isMastery) {
      const statsText = masteryStatsInput.value.trim();
      node.stats = statsText ? statsText.split('\n').map(s => s.trim()).filter(s => s) : [];
    }
  } else if (selectedNodes.length > 1) {
    selectedNodes.forEach(nid => {
      const n = graphData.nodes.find(dn => dn.id === nid);
      if (n) {
        n.importance = importance;
        n.status = status;
        n.shape = shape;
        // Don't override label/comment for bulk edit
      }
    });
  }

  // Update in visual graph
  selectedNodes.forEach(nid => {
    const item = graph.findById(nid);
    if (item) {
      const n = graphData.nodes.find(dn => dn.id === nid);
      if (n) {
        graph.updateItem(item, {
          label: n.label,
          style: { fill: n.shape === 'rect' ? '#222' : undefined } // force re-render style if needed
        });
        graph.setItemState(item, 'status', n.status);
      }
    }
  });
  
  checkMasteryAutoActivation();

  editorTitle.textContent = selectedNode.label;

  updateGraphData();
  alert('노드 수정 내용이 일시 저장되었습니다. (전체 저장을 눌러 영구 저장하세요)');
});

if (btnLinkSubnodeMode) {
  btnLinkSubnodeMode.addEventListener('click', () => {
    if (!selectedNode || !selectedNode.isMastery) return;
    isLinkSubnodeMode = !isLinkSubnodeMode;
    if (isLinkSubnodeMode) {
      btnLinkSubnodeMode.classList.add('active');
      btnLinkSubnodeMode.innerHTML = '<i class="fa-solid fa-check"></i> 캔버스에서 등록할 서브노드 클릭...';
      showToast('마스터리에 연결할 서브노드를 캔버스에서 차례로 클릭하세요.', 'info');
    } else {
      btnLinkSubnodeMode.classList.remove('active');
      btnLinkSubnodeMode.innerHTML = '<i class="fa-solid fa-link"></i> 새로운 서브노드 연결하기';
    }
  });
}

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

btnSaveAll.addEventListener('click', saveGraphData);
btnTabEdit.addEventListener('click', showEditTab);
btnTabPreview.addEventListener('click', showPreviewTab);

animToggle.addEventListener('click', (e) => {
  animationEnabled = e.target.checked;

  graph.getEdges().forEach(edge => {
    if (typeof edge.getContainer !== 'function') return;
    const group = edge.getContainer();
    const flowShape = group.find(item => item.get && item.get('name') === 'flow-shape');
    if (flowShape && typeof flowShape.animate === 'function') {
      if (animationEnabled) {
        const shape = group.get('children')[0];
        const length = shape.getTotalLength();
        flowShape.animate(
          (ratio) => { return { lineDashOffset: -length * ratio }; },
          { repeat: true, duration: 3000 }
        );
      } else {
        flowShape.stopAnimate();
        flowShape.attr('lineDashOffset', 0);
      }
    }
  });

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

themeSelect.addEventListener('change', (e) => {
  currentTheme = e.target.value;
  document.body.className = `theme-${currentTheme}`;
  initGraph();
});

layoutSelect.addEventListener('change', (e) => {
  currentLayout = e.target.value;
  initGraph();
});

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

subnodeVisSelect.addEventListener('change', (e) => {
  subnodesVisible = (e.target.value === 'show');
  initGraph();
});

subnodeRotSelect.addEventListener('change', (e) => {
  subnodesRotationEnabled = (e.target.value === 'true');
});

subnodeSpeedRange.addEventListener('input', (e) => {
  subnodesRotationSpeed = parseFloat(e.target.value);
});

btnExportMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  exportMenu.classList.toggle('show');
});

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
  if (settingsDrawer.classList.contains('open') && !settingsDrawer.contains(e.target) && !btnToggleSettings.contains(e.target)) {
    settingsDrawer.classList.remove('open');
  }
});

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

// Node Search Overlay
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

window.closeSearchOverlay = function () {
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
    const highlight = (txt) => txt.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark style="background:#8a5a00;color:#ffd78a;border-radius:2px;">${m}</mark>`);
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

window.searchJumpTo = function (idx) {
  const node = searchResultNodes[idx];
  if (!node || !graph) return;
  searchResultIndex = idx;

  document.querySelectorAll('.search-result-item').forEach((el, i) => {
    el.style.background = i === idx ? 'rgba(200,169,110,0.2)' : '';
  });

  const canvas = document.getElementById('tree-canvas');
  const k = graph.transform.k;
  const targetX = canvas.width / 2 - node.x * k;
  const targetY = canvas.height / 2 - node.y * k;
  graph.d3canvas.transition().duration(400).call(
    graph.zoom.transform,
    d3.zoomIdentity.translate(targetX, targetY).scale(Math.max(k, 0.3))
  );

  graph.setItemState(node.id, 'selected', true);
  selectNode(node.id, false);
};

// Search keyboard binding setup
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('searchInput');
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
window.addEventListener('keydown', async (e) => {
  const activeEl = document.activeElement;
  const inInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openSearchOverlay();
    return;
  }

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

  if (inInput) return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (graph && graph.resetView) graph.resetView();
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // ── Priority 1: delete highlighted edge ──────────────────────────────
    if (graph?.highlightedEdge && currentUser?.role === 'admin') {
      e.preventDefault();
      await deleteHighlightedEdge();
      return;
    }

    // ── Priority 2: delete/unallocate selected nodes ──────────────────────
    if (selectedNodes.length > 0) {
      e.preventDefault();
      if (currentUser?.role === 'admin') {
        const labels = selectedNodes.map(id => {
          const n = graphData.nodes.find(x => x.id === id);
          return n ? (n.label || n.id) : id;
        }).join(', ');
        if (!confirm(`선택된 ${selectedNodes.length}개 노드를 삭제하시겠습니까?\n[${labels}]\n연결된 엣지도 모두 제거됩니다.`)) return;

        const idsToDelete = [...selectedNodes];
        selectedNodes = [];
        for (const id of idsToDelete) {
          const nodeObj = graphData.nodes.find(n => n.id === id);
          if (nodeObj) await adminRemoveNode(nodeObj, true);
        }
        showToast(`🗑️ ${idsToDelete.length}개 노드가 삭제되었습니다.`, 'success');
      } else {
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

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveGraphData();
  }
});

window.addEventListener('resize', () => {
  if (graph && typeof graph.changeSize === 'function') {
    const container = document.getElementById('g6-container');
    if (container) graph.changeSize(container.scrollWidth, container.scrollHeight || 600);
  }
});

// App Initiation Entrypoint
fetchGraphData();
setupContextMenu();
setupNodeEditModal();
setupAdminToolbar();

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

document.getElementById('prDimRange')?.addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  const label = document.getElementById('prDimVal');
  if (label) label.textContent = val.toFixed(2);
  if (graph) { graph.prDimOpacity = val; graph.render(); }
});


// ==========================================
// Collaborative Wiki & Auth Logic
// ==========================================
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

  if (txtRole) {
    txtRole.textContent = currentUser.role;
    txtRole.className = `role-badge ${currentUser.role}`;
  }

  if (currentUser.role === 'guest') {
    if (txtName) txtName.textContent = '로그인이 필요합니다';
    btnSave?.classList.add('hidden');
    btnSubmitProp?.classList.add('hidden');
    adminOnlyEls.forEach(el => el.classList.add('hidden'));
    contributorOnlyEls.forEach(el => el.classList.add('hidden'));
    if (gitWorkspacePanel) gitWorkspacePanel.classList.add('hidden');
  } else {
    if (txtName) txtName.textContent = `${currentUser.name} (${currentUser.email || 'OAuth User'})`;
    if (gitWorkspacePanel) gitWorkspacePanel.classList.remove('hidden');

    if (currentUser.role === 'admin') {
      btnSave?.classList.remove('hidden');
      btnSubmitProp?.classList.add('hidden');
      adminOnlyEls.forEach(el => el.classList.remove('hidden'));
      contributorOnlyEls.forEach(el => el.classList.add('hidden'));
      const toolbar = document.getElementById('adminToolbar');
      if (toolbar) toolbar.style.display = 'flex';
      loadAdminProposals();
    } else {
      btnSave?.classList.remove('hidden');
      btnSubmitProp?.classList.remove('hidden');
      adminOnlyEls.forEach(el => el.classList.add('hidden'));
      contributorOnlyEls.forEach(el => el.classList.remove('hidden'));
      const toolbar = document.getElementById('adminToolbar');
      if (toolbar) toolbar.style.display = 'none';
    }
  }

  if (graph && typeof graph.removeBehaviors === 'function') {
    if (currentUser.role === 'guest') {
      graph.removeBehaviors(['drag-node', 'create-edge'], 'default');
      document.getElementById('btnDeleteNode')?.classList.add('hidden');
    } else {
      graph.addBehaviors(['drag-node', 'create-edge'], 'default');
      document.getElementById('btnDeleteNode')?.classList.remove('hidden');
    }
  }

  if (typeof updateGitWorkspace === 'function') {
    updateGitWorkspace();
  }
}

window.handleCredentialResponse = async function (response) {
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

function initGoogleAuth() {
  if (typeof google === 'undefined') {
    setTimeout(initGoogleAuth, 500);
    return;
  }

  google.accounts.id.initialize({
    client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    callback: window.handleCredentialResponse
  });

  const container = document.getElementById("googleBtnContainer");
  if (container) {
    google.accounts.id.renderButton(container, { theme: "outline", size: "medium" });
  }
  google.accounts.id.prompt();
}

const btnShowAuth = document.getElementById('btnShowAuthModal');
const mockLoginModal = document.getElementById('mockLoginModal');
const btnCloseMock = document.getElementById('btnCloseMockModal');
const btnMockConfirm = document.getElementById('btnMockLoginConfirm');

btnShowAuth?.addEventListener('click', () => {
  mockLoginModal?.classList.remove('hidden');
});

btnCloseMock?.addEventListener('click', () => {
  mockLoginModal?.classList.add('hidden');
});

btnMockConfirm?.addEventListener('click', async () => {
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
      mockLoginModal?.classList.add('hidden');
      alert(`테스트 계정으로 로그인했습니다 (${currentUser.role})`);
    }
  } catch (err) {
    console.error(err);
  }
});

const proposalModal = document.getElementById('proposalModal');
const btnCloseProp = document.getElementById('btnCloseProposalModal');
const btnCancelProp = document.getElementById('btnCancelProposal');
const btnSubmitPropConfirm = document.getElementById('btnSubmitProposalConfirm');

btnSubmitProp?.addEventListener('click', () => {
  proposalModal?.classList.remove('hidden');
});

btnCloseProp?.addEventListener('click', () => {
  proposalModal?.classList.add('hidden');
});

btnCancelProp?.addEventListener('click', () => {
  proposalModal?.classList.add('hidden');
});

btnSubmitPropConfirm?.addEventListener('click', async () => {
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
      proposalModal?.classList.add('hidden');
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

async function loadAdminProposals() {
  const proposalList = document.getElementById('proposalList');
  if (!proposalList) return;
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
    const res = await fetch(`/api/admin/contributions/${id}/${action}`, { method: 'POST' });
    if (res.ok) {
      alert(`제안이 성공적으로 ${action === 'approve' ? '승인 및 머지' : '반려'}되었습니다.`);
      fetchGraphData();
    } else {
      alert('요청 처리 실패');
    }
  } catch (err) {
    console.error(err);
  }
}

setTimeout(initGoogleAuth, 100);


// ==========================================
// Git Version Control Engine
// ==========================================
function isNodeModified(n1, n2) {
  if (n1.label !== n2.label) return true;
  if (n1.importance !== n2.importance) return true;
  if (n1.status !== n2.status) return true;
  if (n1.shape !== n2.shape) return true;
  if (n1.comment !== n2.comment) return true;

  if (Math.abs((n1.x || 0) - (n2.x || 0)) > 2.0) return true;
  if (Math.abs((n1.y || 0) - (n2.y || 0)) > 2.0) return true;

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

  const oldNodesMap = new Map(oldG.nodes.map(n => [n.id, n]));
  const newNodesMap = new Map(newG.nodes.map(n => [n.id, n]));

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

  const oldEdgesMap = new Map(oldG.edges.map(e => [e.id, e]));
  const newEdgesMap = new Map(newG.edges.map(e => [e.id, e]));

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

  stagedChanges = stagedChanges.filter(sc =>
    allWorkingChanges.some(wc => wc.type === sc.type && wc.id === sc.id && wc.action === sc.action)
  );

  const unstagedList = allWorkingChanges.filter(wc =>
    !stagedChanges.some(sc => sc.type === wc.type && sc.id === wc.id && sc.action === wc.action)
  );

  const unstagedContainer = document.getElementById('gitUnstagedList');
  if (!unstagedContainer) return;

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

  const stagedContainer = document.getElementById('gitStagedList');
  if (stagedContainer) {
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
  }

  const logsContainer = document.getElementById('gitCommitLogsList');
  if (logsContainer) {
    if (localCommits.length === 0) {
      logsContainer.innerHTML = '<span style="font-size:10px; color:var(--text-secondary);">제출할 커밋이 없습니다.</span>';
    } else {
      logsContainer.innerHTML = '';
      localCommits.forEach((commit) => {
        const item = document.createElement('div');
        item.className = 'git-commit-log-item';
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>[${commit.id.substring(7, 13)}] ${commit.message}</strong>
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
}

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
    if (gitCommitMsgInput) gitCommitMsgInput.value = '';
    updateGitWorkspace();
    alert(`로컬 커밋이 정상적으로 생성되었습니다:\n[${commitId.substring(7, 13)}] ${msg}`);
  });
}

function previewProposalDiff(prop) {
  const previewNodes = [];
  const previewEdges = [];

  const baseNodes = JSON.parse(JSON.stringify(baseGraphData.nodes));
  const baseEdges = JSON.parse(JSON.stringify(baseGraphData.edges));

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

  Object.values(nodeChanges).forEach(change => {
    if (change.action === 'add') {
      const addedNode = { ...change.data, diffStatus: 'add' };
      previewNodes.push(addedNode);
    }
  });

  baseEdges.forEach(edge => {
    const change = edgeChanges[edge.id];
    if (change && change.action === 'delete') {
      const deletedEdge = { ...edge, diffStatus: 'delete' };
      previewEdges.push(deletedEdge);
    } else {
      previewEdges.push(edge);
    }
  });

  Object.values(edgeChanges).forEach(change => {
    if (change.action === 'add') {
      const addedEdge = { ...change.data, diffStatus: 'add' };
      previewEdges.push(addedEdge);
    }
  });

  let banner = document.getElementById('gitDiffBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'gitDiffBanner';
    banner.className = 'git-diff-banner';
    document.querySelector('.canvas-area')?.appendChild(banner);
  }
  if (banner) {
    banner.innerHTML = `
      <span><i class="fa-solid fa-eye"></i> <b>기여 제안 프리뷰 모드:</b> ${prop.contributor.name}님의 제안을 보고 있습니다.</span>
      <button id="btnExitDiffPreview" class="btn btn-compact btn-save"><i class="fa-solid fa-xmark"></i> 프리뷰 종료</button>
    `;
    banner.classList.add('show');
    document.getElementById('btnExitDiffPreview')?.addEventListener('click', () => {
      exitDiffPreview();
    });
  }

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

  if (graph) graph.changeData({ nodes: formattedNodes, edges: formattedEdges });
}

function exitDiffPreview() {
  const banner = document.getElementById('gitDiffBanner');
  if (banner) {
    banner.classList.remove('show');
  }
  updateGraphData();
}