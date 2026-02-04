// Graph Visualization Logic
// Dependencies: D3.js, Force-Graph

class ObsidianGraph {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.graph = ForceGraph()(this.container);
        this.data = { nodes: [], links: [] };

        // State
        this.highlightNodes = new Set();
        this.highlightLinks = new Set();
        this.hoverNode = null;
        this.isDark = true;

        // Config
        this.config = {
            nodeSizeBase: 4,
            nodeSizeMultiplier: 0.7,
            linkWidth: 0.6,
            particleWidth: 1.5,
            colors: {
                bg: '#1e1e2e', // Catppuccin Base
                nodeDefault: '#585b70', // Surface 2
                text: '#cdd6f4', // Text
                link: 'rgba(147, 153, 178, 0.2)', // Overlay0 with opacity
                linkHighlight: 'rgba(137, 180, 250, 0.5)', // Blue with opacity
                // Catppuccin Mocha Palette
                groups: {
                    til: '#cba6f7',      // Mauve
                    portfolio: '#a6e3a1', // Green
                    random: '#eba0ac',   // Maroon
                    default: '#bac2de'   // Lavender
                }
            }
        };

        this.init();
    }

    async init() {
        try {
            // Fetch data from Hugo generated JSON
            // We expect the URL to be passed or inferred
            const dataUrl = this.container.dataset.source || '/graph/index.json';
            const res = await fetch(dataUrl);
            if (!res.ok) throw new Error('Failed to load graph data');

            const rawData = await res.json();
            this.data = this.processData(rawData);

            this.render();
            this.setupWindowEvents();
            this.setupControls();

        } catch (e) {
            console.error("Graph initialization failed:", e);
            this.container.innerHTML = `<div class="graph-error">Error loading graph data.</div>`;
        }
    }

    processData(data) {
        // Calculate degrees for sizing
        const neighborCounts = {};
        data.links.forEach(link => {
            const s = link.source;
            const t = link.target;
            neighborCounts[s] = (neighborCounts[s] || 0) + 1;
            neighborCounts[t] = (neighborCounts[t] || 0) + 1;
        });

        // Enrich nodes
        data.nodes.forEach(node => {
            node.val = neighborCounts[node.id] || 0;
            node.color = this.config.colors.groups[node.section] || this.config.colors.groups.default;
            node.label = node.name || node.id;
        });

        return data;
    }

    render() {
        const { width, height } = this.container.getBoundingClientRect();

        this.graph
            .width(width)
            .height(height)
            .backgroundColor(this.config.colors.bg)
            .graphData(this.data)

            // Physics
            .d3Force('charge', d3.forceManyBody().strength(-120))
            .d3Force('link', d3.forceLink().distance(60).strength(0.5))
            .d3Force('center', d3.forceCenter(0, 0))
            .d3VelocityDecay(0.1) // Lower friction for "space" feel

            // Nodes
            .nodeRelSize(this.config.nodeSizeBase)
            .nodeVal(n => (n.val * this.config.nodeSizeMultiplier) + 2) // Radius calculated from value
            .nodeColor(n => n.color)
            .nodeLabel(n => '') // Custom label handling

            // Links
            .linkColor(link => this.highlightLinks.has(link) ? this.config.colors.linkHighlight : this.config.colors.link)
            .linkWidth(link => this.highlightLinks.has(link) ? 1.5 : this.config.linkWidth)
            .linkDirectionalParticles(link => this.highlightLinks.has(link) ? 2 : 0)
            .linkDirectionalParticleWidth(this.config.particleWidth)

            // Canvas Drawing
            .nodeCanvasObject((node, ctx, globalScale) => this.drawNode(node, ctx, globalScale))
            .nodePointerAreaPaint((node, color, ctx) => {
                const r = Math.sqrt(Math.max(0, (node.val * this.config.nodeSizeMultiplier) + 2)) * 4;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
                ctx.fill();
            })

            // Interactions
            .onNodeHover(node => this.handleHover(node))
            .onNodeClick(node => {
                if (node) {
                    // Center and Zoom before navigation (aesthetic touch)
                    this.graph.centerAt(node.x, node.y, 400);
                    this.graph.zoom(3, 1000);
                    setTimeout(() => {
                        window.location.href = node.id;
                    }, 500);
                }
            })
            .onBackgroundClick(() => {
                this.hoverNode = null;
                this.updateHighlights();
            });
    }

    drawNode(node, ctx, globalScale) {
        const isHovered = node === this.hoverNode;
        const isHighlight = this.highlightNodes.has(node.id);
        const isNeighbor = isHighlight && !isHovered;
        const isDimmed = this.hoverNode && !isHighlight;

        if (isDimmed) {
            ctx.globalAlpha = 0.1;
        }

        const r = Math.sqrt(Math.max(0, (node.val * this.config.nodeSizeMultiplier) + 2)) * 4;

        // Glow effect
        if (isHighlight || isHovered) {
            const glowStrength = isHovered ? 3.5 : 2.0;
            const glow = ctx.createRadialGradient(node.x, node.y, r * 0.5, node.x, node.y, r * glowStrength);
            glow.addColorStop(0, node.color);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * glowStrength, 0, 2 * Math.PI, false);
            ctx.fill();
        }

        // Core Node
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
        ctx.fill();

        // Label Logic
        let showLabel = false;
        let fontSize = 12 / globalScale;
        let fontWeight = 'normal';
        let customTextColor = this.config.colors.text;
        let bgOpacity = 0.7;

        // Visual Hierarchy: Hovered > Neighbor > Zoomed-in
        if (isHovered) {
            showLabel = true;
            fontSize = (15 / globalScale) * 1.1;
            fontWeight = 'bold';
            customTextColor = '#ffffff';
            bgOpacity = 0.9;
        } else if (isNeighbor) {
            showLabel = true;
            // Slightly smaller/muted for neighbors
            fontSize = 12 / globalScale;
            // Use Catppuccin Surface1 for text to make it muted but readable
            customTextColor = 'rgba(205, 214, 244, 0.75)';
            bgOpacity = 0.5;
        } else if (globalScale > 2.5) {
            showLabel = true;
        }

        if (showLabel) {
            ctx.font = `${fontWeight} ${fontSize}px "JetBrains Mono", "Fira Code", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const label = node.label;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth + 8, fontSize + 6];

            ctx.fillStyle = `rgba(30, 30, 46, ${bgOpacity})`;

            // Highlight box for hovered
            if (isHovered) {
                ctx.strokeStyle = this.config.colors.linkHighlight;
                ctx.lineWidth = 1 / globalScale;
                ctx.strokeRect(node.x - bckgDimensions[0] / 2, node.y + r + 2, bckgDimensions[0], bckgDimensions[1]);
            }

            ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + r + 2, bckgDimensions[0], bckgDimensions[1]);

            ctx.fillStyle = customTextColor;
            ctx.fillText(label, node.x, node.y + r + 2 + bckgDimensions[1] / 2);
        }

        ctx.globalAlpha = 1;
    }

    handleHover(node) {
        this.hoverNode = node || null;
        this.updateHighlights();
        this.container.style.cursor = node ? 'pointer' : null;
    }

    updateHighlights() {
        this.highlightNodes.clear();
        this.highlightLinks.clear();

        if (this.hoverNode) {
            this.highlightNodes.add(this.hoverNode.id);
            this.data.links.forEach(link => {
                const sId = typeof link.source === 'object' ? link.source.id : link.source;
                const tId = typeof link.target === 'object' ? link.target.id : link.target;

                if (sId === this.hoverNode.id || tId === this.hoverNode.id) {
                    this.highlightLinks.add(link);
                    this.highlightNodes.add(sId);
                    this.highlightNodes.add(tId);
                }
            });
        }


        this.graph.linkWidth(this.graph.linkWidth()); // Trigger update
        this.graph.linkDirectionalParticles(this.graph.linkDirectionalParticles());
    }

    setupWindowEvents() {
        window.addEventListener('resize', () => {
            const { width, height } = this.container.getBoundingClientRect();
            this.graph.width(width).height(height);
        });
    }

    setupControls() {
        const ids = {
            in: 'zoom-in',
            out: 'zoom-out',
            fit: 'zoom-fit'
        };

        const get = id => document.getElementById(id);

        if (get(ids.in)) get(ids.in).onclick = () => this.graph.zoom(this.graph.zoom() * 1.5, 400);
        if (get(ids.out)) get(ids.out).onclick = () => this.graph.zoom(this.graph.zoom() / 1.5, 400);
        if (get(ids.fit)) get(ids.fit).onclick = () => this.graph.zoomToFit(400);
    }
}

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    window.Graph = new ObsidianGraph('graph-container');
});
