class CanvasGraph {
  constructor(config) {
    this.canvas = document.getElementById('tree-canvas');
    if(!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    // Make canvas responsive
    this.canvas.width = config.width || this.canvas.parentElement.clientWidth;
    this.canvas.height = config.height || this.canvas.parentElement.clientHeight || 800;
    
    this.dataObj = { nodes: [], edges: [], groups: {} };
    this.itemStates = new Map();
    this.events = {};
    this.clickEffects = [];
    this.isAnimating = false;
    this.edgeStyle = 'straight'; // 'straight' | 'curve'
    this.curvature = 0.3;
    this.prDimOpacity = 0.2;
    
    // Initialize zoom transform (center tree, zoom out since coordinates are large now)
    this.transform = d3.zoomIdentity.translate(this.canvas.width/2, this.canvas.height/2).scale(0.08);
    
    this.images = {};
    this.imageLoadCount = 0;
    this.imageTotal = 0;
    
    const imgNames = [
        'groupBackground_PSGroupBackground1.png',
        'groupBackground_PSGroupBackground2.png',
        'groupBackground_PSGroupBackground3.png',
        'frame_PSSkillFrame.png',
        'frame_PSSkillFrameActive.png',
        'frame_NotableFrameUnallocated.png',
        'frame_NotableFrameAllocated.png',
        'frame_KeystoneFrameUnallocated.png',
        'frame_KeystoneFrameAllocated.png'
    ];
    
    this.imageTotal = imgNames.length;
    imgNames.forEach(file => {
       this.images[file] = new Image();
       this.images[file].onload = () => {
           this.imageLoadCount++;
           this.render();
       };
       this.images[file].src = '/icons/' + file;
    });
    
    this.setupInteractions();
    
    // G6 mock APIs
    this.on = (eventName, callback) => { this.events[eventName] = callback; };
    this.setItemState = (item, stateName, value) => {
        let node = typeof item === 'string' ? this.findById(item) : item;
        if(node) {
            let state = this.itemStates.get(node.id) || {};
            state[stateName] = value;
            this.itemStates.set(node.id, state);
            this.render();
        }
    };
    this.clearItemStates = (item) => {
        let node = typeof item === 'string' ? this.findById(item) : item;
        if(node) {
            this.itemStates.set(node.id, {});
            this.render();
        }
    };
  }
  
  findById(id) {
      return this.dataObj.nodes.find(n => n.id === id);
  }
  
  getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.transform.x) / this.transform.k;
    const y = (e.clientY - rect.top - this.transform.y) / this.transform.k;
    return { x, y };
  }
  
  hitTestNode(x, y) {
    // Exact original coordinates scale. A node frame is ~51 * 1.33 = 68 pixels wide.
    // Radius ~34.
    for(let i = this.dataObj.nodes.length - 1; i >= 0; i--) {
       let n = this.dataObj.nodes[i];
       let dx = n.x - x;
       let dy = n.y - y;
       if(dx*dx + dy*dy < 1200) return n; // Radius ~35
    }
    return null;
  }
  
  hitTestEdge(x, y) {
    // Iterate backwards for z-index (drawn last = top)
    for(let i = this.dataObj.edges.length - 1; i >= 0; i--) {
        let e = this.dataObj.edges[i];
        let n1 = e.sourceNode;
        let n2 = e.targetNode;
        if(!n1 || !n2) continue;
        
        let isCurve = this.edgeStyle === 'curve' || e.curvature !== undefined;
        let perp = 0;
        if (isCurve) {
            let dx = n2.x - n1.x;
            let dy = n2.y - n1.y;
            let len = Math.sqrt(dx*dx + dy*dy) || 1;
            let curveValue = e.curvature !== undefined ? e.curvature : this.curvature;
            perp = curveValue * len;
        }

        const mx = (n1.x + n2.x) / 2;
        const my = (n1.y + n2.y) / 2;
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        const cpx = mx - (dy / len) * perp;
        const cpy = my + (dx / len) * perp;

        // Sample 20 points along the bezier curve
        let minDistSq = Infinity;
        for (let t = 0; t <= 1; t += 0.05) {
            let cx = (1-t)*(1-t)*n1.x + 2*(1-t)*t*cpx + t*t*n2.x;
            let cy = (1-t)*(1-t)*n1.y + 2*(1-t)*t*cpy + t*t*n2.y;
            let distSq = (cx - x)*(cx - x) + (cy - y)*(cy - y);
            if (distSq < minDistSq) minDistSq = distSq;
        }

        if (minDistSq < 400) { // 20 pixels radius
            return e;
        }
    }
    return null;
  }
  
  setupInteractions() {
    const zoom = d3.zoom()
        .scaleExtent([0.02, 3])
        .on('zoom', (e) => {
            this.transform = e.transform;
            this.render();
        });
    this.zoom = zoom;
    this.d3canvas = d3.select(this.canvas);
    this.d3canvas.call(zoom).on('dblclick.zoom', null);
    
    // Expose reset method
    this.resetView = () => {
        const initTransform = d3.zoomIdentity
            .translate(this.canvas.width/2, this.canvas.height/2)
            .scale(0.08);
        this.d3canvas.transition().duration(400).call(zoom.transform, initTransform);
    };

    let hoveredNode = null;

    this.canvas.addEventListener('mousemove', (e) => {
        const coords = this.getCanvasCoords(e);
        const node = this.hitTestNode(coords.x, coords.y);
        
        if(node !== hoveredNode) {
            if(hoveredNode && this.events['node:mouseleave']) {
                this.events['node:mouseleave']({ item: hoveredNode });
            }
            hoveredNode = node;
            if(hoveredNode && this.events['node:mouseenter']) {
                this.events['node:mouseenter']({ item: hoveredNode, originalEvent: e });
            }
            this.render();
        } else if(hoveredNode && this.events['node:mousemove']) {
            this.events['node:mousemove']({ item: hoveredNode, originalEvent: e });
        }
    });

    this.canvas.addEventListener('click', (e) => {
        const coords = this.getCanvasCoords(e);
        const node = this.hitTestNode(coords.x, coords.y);
        if(node) {
            this.clickEffects.push({ x: node.x, y: node.y, time: performance.now(), duration: 800, maxRadius: 150 });
            if(this.events['node:click']) {
                this.events['node:click']({ item: node, originalEvent: e });
            }
            this.render();
        } else {
            if(this.events['canvas:click']) {
                this.events['canvas:click']({ originalEvent: e });
            }
        }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const coords = this.getCanvasCoords(e);
        const node = this.hitTestNode(coords.x, coords.y);
        if(node) {
            if(this.events['node:contextmenu']) {
                this.events['node:contextmenu']({ item: node, originalEvent: e });
            }
            e.stopPropagation();
            return;
        }
        
        const edge = this.hitTestEdge(coords.x, coords.y);
        if(edge) {
            if(this.events['edge:contextmenu']) {
                this.events['edge:contextmenu']({ item: edge, originalEvent: e });
            }
            e.stopPropagation();
        }
    });
  }
  
  changeData(d) {
    this.dataObj = {
        nodes: (d.nodes || []).map(n => {
            n.getModel = () => n;
            return n;
        }),
        edges: d.edges || [],
        groups: d.groups || {},
        extraImages: d.extraImages || []
    };
    
    // Map edges to actual node references
    this.dataObj.edges.forEach(e => {
        e.sourceNode = this.findById(e.source);
        e.targetNode = this.findById(e.target);
    });
    
    this.render();
  }
  
  render() {
    if (!this.isAnimating) {
        this.isAnimating = true;
        requestAnimationFrame(() => this._draw());
    }
  }
  
  _draw() {
    const now = performance.now();
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.k, this.transform.k);
    
    // PathOfBuilding uses a width = img.width * 1.33 and draws with width*2, so total scale is 2.66
    const artScale = 2.66; 

    // 0. Draw Extra Images (Class Backgrounds)
    for(let imgData of this.dataObj.extraImages || []) {
        if(!this.images[imgData.image]) {
            this.images[imgData.image] = new Image();
            this.images[imgData.image].onload = () => this.render();
            this.images[imgData.image].src = '/icons/' + imgData.image;
        }
        let img = this.images[imgData.image];
        if(img && img.complete) {
            let w = img.width * artScale;
            let h = img.height * artScale;
            // The coordinates are centered
            ctx.drawImage(img, imgData.x - w/2, imgData.y - h/2, w, h);
        }
    }

    // 1. Draw Backgrounds
    for(let gid in this.dataObj.groups) {
       let g = this.dataObj.groups[gid];
       if(!g.bg) continue;
       
       let bgFile = 'groupBackground_' + g.bg + '.png';
       if(!this.images[bgFile]) {
           this.images[bgFile] = new Image();
           this.images[bgFile].onload = () => this.render();
           this.images[bgFile].src = '/icons/' + bgFile;
       }
       
       let img = this.images[bgFile];
       if(img && img.complete) {
          let w = img.width * artScale;
          let h = img.height * artScale;
          ctx.drawImage(img, g.x - w/2, g.y - h/2, w, h);
       }
    }
    
    // 2. Draw Edges
    ctx.lineWidth = 42; 
    for(let e of this.dataObj.edges) {
        if(!e.sourceNode || !e.targetNode) continue;
        let n1 = e.sourceNode;
        let n2 = e.targetNode;
        
        let isAllocated = (n1.status === 'Completed' && n2.status === 'Completed');
        ctx.strokeStyle = isAllocated ? 'rgba(212, 175, 55, 0.9)' : 'rgba(100, 100, 100, 0.5)';
        
        if (isAllocated) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = 'rgba(212, 175, 55, 0.8)';
            ctx.setLineDash([60, 30]);
            ctx.lineDashOffset = -(now / 15) % 90;
        } else {
            ctx.shadowBlur = 0;
            ctx.setLineDash([]);
        }
        
        // Arc connection (same group + same orbit → draw arc)
        if (n1.group === n2.group && n1.orbit === n2.orbit && n1.orbit > 0 && n1.group !== "") {
            let group = this.dataObj.groups[n1.group];
            if (group && n1.orbit_radius > 0) {
                let a1 = n1.angle;
                let a2 = n2.angle;
                let arcAngle = a2 - a1;
                if (arcAngle >= Math.PI) { a1 = n2.angle; a2 = n1.angle; arcAngle = Math.PI * 2 - arcAngle; }
                else if (arcAngle <= -Math.PI) { a1 = n2.angle; a2 = n1.angle; arcAngle = Math.PI * 2 + arcAngle; }
                let canvasA1 = a1 - Math.PI / 2;
                let canvasA2 = a2 - Math.PI / 2;
                ctx.beginPath();
                let diff = a2 - a1;
                while (diff < 0) diff += 2 * Math.PI;
                let counterclockwise = diff > Math.PI;
                ctx.arc(group.x, group.y, n1.orbit_radius, canvasA1, canvasA2, counterclockwise);
                ctx.stroke();
                continue;
            }
        }

        // Custom edge: straight or bezier curve
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        if (this.edgeStyle === 'curve' || e.curvature !== undefined) {
            // Quadratic bezier: control point perpendicular to midpoint
            const mx = (n1.x + n2.x) / 2;
            const my = (n1.y + n2.y) / 2;
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const len = Math.sqrt(dx*dx + dy*dy) || 1;
            const curveValue = e.curvature !== undefined ? e.curvature : this.curvature;
            const perp = curveValue * len;
            const cpx = mx - (dy / len) * perp;
            const cpy = my + (dx / len) * perp;
            ctx.quadraticCurveTo(cpx, cpy, n2.x, n2.y);
        } else {
            ctx.lineTo(n2.x, n2.y);
        }
        ctx.stroke();
    }
    
    // Reset canvas state after drawing edges
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    
    // 3. Draw Nodes (Icons)
    for(let n of this.dataObj.nodes) {
        if(!n.icon) continue;
        
        let isAllocated = (n.status === 'Completed');
        let iconFile = n.icon;
        if(!isAllocated) {
            iconFile = iconFile.replace('normalActive_', 'normalInactive_')
                               .replace('notableActive_', 'notableInactive_')
                               .replace('keystoneActive_', 'keystoneInactive_');
        }
        
        if(!this.images[iconFile]) {
            this.images[iconFile] = new Image();
            this.images[iconFile].onload = () => this.render();
            this.images[iconFile].onerror = () => {
                // Fall back to active icon if inactive is missing
                if (iconFile !== n.icon) {
                    this.images[iconFile] = this.images[n.icon] || new Image();
                    this.render();
                }
            };
            this.images[iconFile].src = '/icons/' + iconFile;
        }
        
        let img = this.images[iconFile];
        if(img && img.complete && img.naturalWidth > 0) {
            let w = img.width * artScale;
            let h = img.height * artScale;
            ctx.drawImage(img, n.x - w/2, n.y - h/2, w, h);
        }
    }
    
    // 4. Draw Frames
    for(let n of this.dataObj.nodes) {
        if(!n.icon) continue;
        
        let isAllocated = (n.status === 'Completed');
        let frameName = 'PSSkillFrame';
        
        if(n.shape === 'hexagon') frameName = isAllocated ? 'KeystoneFrameAllocated' : 'KeystoneFrameUnallocated';
        else if(n.shape === 'diamond') frameName = isAllocated ? 'NotableFrameAllocated' : 'NotableFrameUnallocated';
        else frameName = isAllocated ? 'PSSkillFrameActive' : 'PSSkillFrame';
        
        if(n.isMastery) continue; // Mastery uses a different drawing logic or no frame in this simple view for now
        
        let frameFile = 'frame_' + frameName + '.png';
        if(!this.images[frameFile]) {
            this.images[frameFile] = new Image();
            this.images[frameFile].onload = () => this.render();
            this.images[frameFile].src = '/icons/' + frameFile;
        }
        
        let img = this.images[frameFile];
        if(img && img.complete) {
            let fw = img.width * artScale;
            let fh = img.height * artScale;
            ctx.drawImage(img, n.x - fw/2, n.y - fh/2, fw, fh);
        }
    }
    
    // 5. Draw Hover/Selection/PR Highlights
    for(let n of this.dataObj.nodes) {
        let state = this.itemStates.get(n.id) || {};
        let isHover = state.hover;
        let isSelected = state.selected;
        let isPrHighlight = state.pr_highlight;
        let isPrDim = state.pr_dim;

        // PR Dim: darken non-highlighted nodes
        if (isPrDim) {
            let radius = (n.shape === 'hexagon') ? 80 : (n.shape === 'diamond' ? 70 : 55);
            ctx.beginPath();
            ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(0,0,0,${1 - this.prDimOpacity})`;
            ctx.fill();
        }

        if (isPrHighlight) {
            // Amber pulsing ring for PR diff highlight
            let t = (performance.now() / 500) % (2 * Math.PI);
            let pulse = 0.5 + 0.5 * Math.sin(t);
            let radius = (n.shape === 'hexagon') ? 75 : (n.shape === 'diamond' ? 65 : 50);
            ctx.beginPath();
            ctx.arc(n.x, n.y, radius + pulse * 12, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(255, 200, 0, ${0.6 + 0.4 * pulse})`;
            ctx.lineWidth = 5;
            ctx.shadowBlur = 20;
            ctx.shadowColor = 'rgba(255, 200, 0, 0.9)';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        if (isSelected) {
            let radius = (n.shape === 'hexagon') ? 68 : (n.shape === 'diamond' ? 58 : 44);
            ctx.beginPath();
            ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.9)';
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 6]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (isHover) {
            ctx.beginPath();
            let radius = (n.shape === 'hexagon') ? 60 : (n.shape === 'diamond' ? 50 : 35);
            ctx.arc(n.x, n.y, radius, 0, 2*Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    // 6. Draw Click Effects
    for(let i = this.clickEffects.length - 1; i >= 0; i--) {
        let effect = this.clickEffects[i];
        let elapsed = now - effect.time;
        if(elapsed > effect.duration) {
            this.clickEffects.splice(i, 1);
            continue;
        }
        let progress = elapsed / effect.duration;
        let easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease out
        let radius = effect.maxRadius * easeOut;
        let alpha = 1 - progress;
        
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius, 0, 2*Math.PI);
        ctx.strokeStyle = `rgba(212, 175, 55, ${alpha})`;
        ctx.lineWidth = 5 * (1 - progress);
        ctx.stroke();
    }

    ctx.restore();
    
    // Continue loop
    requestAnimationFrame(() => this._draw());
  }
}

window.CanvasGraph = CanvasGraph;
