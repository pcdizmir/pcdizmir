/**
 * Space Colonization Algorithm Canvas Engine
 * Generates an organic branching growth network inspired by natural vascular & tree systems.
 * Scroll progress controls the step-by-step growth and colonization across the page.
 */

export class SpaceColonizationEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Algorithmic parameters
    this.maxAttractors = 450;
    this.attractionDistance = 160;
    this.killDistance = 14;
    this.stepSize = 7;
    
    this.nodes = [];
    this.attractors = [];
    this.branches = []; // Pairs of connected node indices
    
    this.targetGrowthSteps = 0;
    this.currentGrowthSteps = 0;
    this.mouseAttractor = null;
    
    this.init();
  }

  init() {
    this.onResize();
    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('scroll', this.onScroll.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    
    this.resetNetwork();
    this.onScroll();
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * Math.min(window.devicePixelRatio, 2);
    this.canvas.height = this.height * Math.min(window.devicePixelRatio, 2);
    this.ctx.scale(Math.min(window.devicePixelRatio, 2), Math.min(window.devicePixelRatio, 2));
    this.resetNetwork();
  }

  resetNetwork() {
    this.nodes = [];
    this.attractors = [];
    this.branches = [];
    this.currentGrowthSteps = 0;

    // Seed Root Nodes (Top header & mid points)
    const root1 = { x: this.width * 0.5, y: 40, count: 0, dir: { x: 0, y: 1 } };
    const root2 = { x: this.width * 0.15, y: 80, count: 0, dir: { x: 0.5, y: 1 } };
    const root3 = { x: this.width * 0.85, y: 80, count: 0, dir: { x: -0.5, y: 1 } };
    
    this.nodes.push(root1, root2, root3);

    // Seed Attractor Points evenly across canvas area
    for (let i = 0; i < this.maxAttractors; i++) {
      this.attractors.push({
        x: Math.random() * (this.width - 80) + 40,
        y: Math.random() * (this.height * 1.5) + 60,
        reached: false
      });
    }
  }

  onScroll() {
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    ) - window.innerHeight;
    
    const scrollPercent = docHeight > 0 ? window.scrollY / docHeight : 0;
    
    // Map scroll percentage to total growth steps (0 to 600 steps)
    this.targetGrowthSteps = Math.floor(scrollPercent * 650);
  }

  onMouseMove(e) {
    this.mouseAttractor = {
      x: e.clientX,
      y: e.clientY + window.scrollY,
      reached: false
    };
  }

  growStep() {
    if (this.attractors.length === 0) return;

    // Add mouse attractor temporarily if available
    let activeAttractors = [...this.attractors];
    if (this.mouseAttractor) {
      activeAttractors.push(this.mouseAttractor);
    }

    // Reset node direction accumulators
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].dir = { x: 0, y: 0 };
      this.nodes[i].count = 0;
    }

    // 1. For each attractor, find closest node within attraction distance
    for (let i = activeAttractors.length - 1; i >= 0; i--) {
      const attr = activeAttractors[i];
      let closestNode = null;
      let minDist = this.attractionDistance;

      for (let j = 0; j < this.nodes.length; j++) {
        const node = this.nodes[j];
        const dx = attr.x - node.x;
        const dy = attr.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.killDistance && attr !== this.mouseAttractor) {
          attr.reached = true;
          break;
        }

        if (dist < minDist) {
          minDist = dist;
          closestNode = node;
        }
      }

      if (closestNode && !attr.reached) {
        const dx = attr.x - closestNode.x;
        const dy = attr.y - closestNode.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        
        if (len > 0) {
          closestNode.dir.x += dx / len;
          closestNode.dir.y += dy / len;
          closestNode.count++;
        }
      }
    }

    // Remove reached attractors
    this.attractors = this.attractors.filter(a => !a.reached);

    // 2. Create new nodes in average direction
    const newNodes = [];
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (node.count > 0) {
        const avgX = node.dir.x / node.count;
        const avgY = node.dir.y / node.count;
        const len = Math.sqrt(avgX * avgX + avgY * avgY);

        if (len > 0) {
          const newNode = {
            x: node.x + (avgX / len) * this.stepSize,
            y: node.y + (avgY / len) * this.stepSize,
            count: 0,
            dir: { x: 0, y: 0 }
          };

          const parentIndex = i;
          const childIndex = this.nodes.length + newNodes.length;
          this.branches.push([parentIndex, childIndex]);
          newNodes.push(newNode);
        }
      }
    }

    this.nodes.push(...newNodes);
  }

  update() {
    // Incrementally grow network towards targetGrowthSteps driven by scroll
    if (this.currentGrowthSteps < this.targetGrowthSteps) {
      const stepsToRun = Math.min(4, this.targetGrowthSteps - this.currentGrowthSteps);
      for (let i = 0; i < stepsToRun; i++) {
        this.growStep();
        this.currentGrowthSteps++;
      }
    }
  }

  render() {
    this.update();

    const scrollY = window.scrollY;
    this.ctx.clearRect(0, 0, this.width, this.height);

    this.ctx.save();
    // Offset rendering by current scroll position
    this.ctx.translate(0, -scrollY);

    // 1. Draw Attractor points (subtle gray dots)
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let i = 0; i < this.attractors.length; i++) {
      const a = this.attractors[i];
      if (a.y >= scrollY - 50 && a.y <= scrollY + this.height + 50) {
        this.ctx.beginPath();
        this.ctx.arc(a.x, a.y, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // 2. Draw Branch Network (Sharp black lines matching onurolgac aesthetic)
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1.1;
    this.ctx.lineCap = 'round';

    this.ctx.beginPath();
    for (let i = 0; i < this.branches.length; i++) {
      const [pIdx, cIdx] = this.branches[i];
      const parent = this.nodes[pIdx];
      const child = this.nodes[cIdx];

      if (
        (parent.y >= scrollY - 50 && parent.y <= scrollY + this.height + 50) ||
        (child.y >= scrollY - 50 && child.y <= scrollY + this.height + 50)
      ) {
        this.ctx.moveTo(parent.x, parent.y);
        this.ctx.lineTo(child.x, child.y);
      }
    }
    this.ctx.stroke();

    // 3. Draw Network Tips / Node Junctions (small crisp dots)
    this.ctx.fillStyle = '#000000';
    for (let i = 0; i < this.nodes.length; i += 6) {
      const node = this.nodes[i];
      if (node.y >= scrollY - 50 && node.y <= scrollY + this.height + 50) {
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, 1.2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }
}
