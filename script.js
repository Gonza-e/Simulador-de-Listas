/**
 * ESTADO Y CONFIGURACIÓN
 */
const State = {
    worldX: 0, worldY: 0,
    isPanning: false,
    currentDrag: null,
    connections: [],
    contextTargetId: null,
    connectingFromId: null,
    currentPort: 'next',
    OFFSET: 5000
};

/**
 * MOTOR DE RENDERIZADO (FLECHAS)
 */
const Renderer = {
    svg: document.getElementById('svg-layer'),

    update() {
        this.svg.innerHTML = '';
        State.connections.forEach(conn => this.drawConnection(conn));
    },

    drawConnection(conn) {
        const f = document.getElementById(conn.from);
        const t = document.getElementById(conn.to);
        if (!f || !t) return;

        let startX, startY;
        if (conn.port === 'next') {
            startX = f.offsetLeft + f.offsetWidth + State.OFFSET;
            startY = f.offsetTop + (f.offsetHeight / 2) - 8 + State.OFFSET;
        } else {
            startX = f.offsetLeft + State.OFFSET;
            startY = f.offsetTop + (f.offsetHeight / 2) + 8 + State.OFFSET;
        }

        const end = this.getIntersection(startX, startY, t);
        const dx = end.x - startX;
        const flex = Math.min(Math.abs(dx) * 0.4, 60);

        const d = `M ${startX} ${startY} C ${startX + (conn.port === 'prev' ? -flex : flex)} ${startY}, ${end.x - (dx > 0 ? flex : -flex)} ${end.y}, ${end.x} ${end.y}`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#9b59b6');
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('fill', 'none');

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', end.x);
        dot.setAttribute('cy', end.y);
        dot.setAttribute('r', '5');
        dot.setAttribute('fill', '#9b59b6');

        this.svg.appendChild(path);
        this.svg.appendChild(dot);
    },

    getIntersection(sx, sy, el) {
        const rect = {
            left: el.offsetLeft + State.OFFSET,
            top: el.offsetTop + State.OFFSET,
            w: el.offsetWidth,
            h: el.offsetHeight
        };
        const cx = rect.left + rect.w / 2;
        const cy = rect.top + rect.h / 2;
        const dx = cx - sx, dy = cy - sy;

        if (el.classList.contains('ptr-circle') || el.classList.contains('nil-node')) {
            const rad = rect.w / 2;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            return { x: cx - (dx / dist) * rad, y: cy - (dy / dist) * rad };
        } else {
            const m = dy / dx;
            if (Math.abs(m) <= rect.h / rect.w) return { x: dx > 0 ? rect.left : rect.left + rect.w, y: cy - m * (dx > 0 ? rect.w / 2 : -rect.w / 2) };
            else return { x: cx - (dy > 0 ? rect.h / 2 : -rect.h / 2) / m, y: dy > 0 ? rect.top : rect.top + rect.h };
        }
    }
};

/**
 * GESTIÓN DE NODOS
 */
const Nodes = {
    world: document.getElementById('world'),

    create(type) {
        const id = 'el-' + Date.now();
        const val = document.getElementById('contentInput').value || 'Data';
        const div = document.createElement('div');
        div.id = id;
        
        let w = 160, h = 50;
        if (type === 'simple') {
            div.className = 'element node-rect';
            div.innerHTML = `<div class="data-core" style="border-right:none; border-radius:8px 0 0 8px">${val}</div><div class="side-ptr" style="border-radius:0 8px 8px 0"><div class="ptr-dot"></div></div>`;
        } else if (type === 'double') {
            w = 200; div.className = 'element node-double';
            div.innerHTML = `<div class="side-ptr" style="border-right:none; border-radius:8px 0 0 8px"><div class="ptr-dot"></div></div><div class="data-core" style="border-right:none;">${val}</div><div class="side-ptr" style="border-radius:0 8px 8px 0"><div class="ptr-dot"></div></div>`;
        } else if (type === 'ptr') {
            w = 50; h = 50; div.className = 'element ptr-circle'; div.innerText = val || 'P';
        } else if (type === 'nil') {
            w = 45; h = 45; div.className = 'element nil-node'; div.innerText = '=';
        }
        
        // Posicionamiento central
        div.style.left = (window.innerWidth / 2 - State.worldX - (w / 2)) + 'px';
        div.style.top = (window.innerHeight / 2 - State.worldY - (h / 2)) + 'px';

        this.bindEvents(div);
        this.world.appendChild(div);
        Renderer.update();
    },

    bindEvents(div) {
        div.onmousedown = (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (State.connectingFromId) {
                if (State.connectingFromId !== div.id) {
                    State.connections = State.connections.filter(c => !(c.from === State.connectingFromId && c.port === State.currentPort));
                    State.connections.push({ from: State.connectingFromId, to: div.id, port: State.currentPort });
                }
                State.connectingFromId = null; Renderer.update(); return;
            }
            State.currentDrag = div;
            div.ox = e.clientX - div.getBoundingClientRect().left;
            div.oy = e.clientY - div.getBoundingClientRect().top;
        };

        div.oncontextmenu = (e) => {
            e.preventDefault(); e.stopPropagation();
            UI.showContextMenu(e.clientX, e.clientY, div);
        };
    }
};

/**
 * INTERFAZ Y APLICACIÓN
 */
const UI = {
    menu: document.getElementById('context-menu'),

    init() {
        window.onmousemove = (e) => {
            if (State.isPanning) {
                State.worldX += e.movementX; State.worldY += e.movementY;
                document.getElementById('world').style.transform = `translate(${State.worldX}px, ${State.worldY}px)`;
            } else if (State.currentDrag) {
                State.currentDrag.style.left = (e.clientX - State.worldX - State.currentDrag.ox) + 'px';
                State.currentDrag.style.top = (e.clientY - State.worldY - State.currentDrag.oy) + 'px';
                Renderer.update();
            }
        };
        window.onmouseup = () => { State.isPanning = false; State.currentDrag = null; };
        document.getElementById('viewport').onmousedown = (e) => { if (e.target.id === 'viewport') State.isPanning = true; };
        window.onclick = () => this.menu.style.display = 'none';
        
        // Botones del menú contextual
        document.getElementById('m-del').onclick = () => {
            State.connections = State.connections.filter(c => c.from !== State.contextTargetId && c.to !== State.contextTargetId);
            document.getElementById(State.contextTargetId).remove(); Renderer.update();
        };
        document.getElementById('m-dis').onclick = () => {
            State.connections = State.connections.filter(c => c.from !== State.contextTargetId); Renderer.update();
        };
        document.getElementById('m-con-next').onclick = () => { State.connectingFromId = State.contextTargetId; State.currentPort = 'next'; };
        document.getElementById('m-con-prev').onclick = () => { State.connectingFromId = State.contextTargetId; State.currentPort = 'prev'; };
    },

    showContextMenu(x, y, el) {
        State.contextTargetId = el.id;
        this.menu.style.display = 'block';
        this.menu.style.left = x + 'px'; this.menu.style.top = y + 'px';
        const isNil = el.classList.contains('nil-node');
        const isDouble = el.classList.contains('node-double');
        document.getElementById('m-con-next').style.display = isNil ? 'none' : 'block';
        document.getElementById('m-con-prev').style.display = isDouble ? 'block' : 'none';
    }
};

const App = {
    start(mode) {
        UI.init();
        document.getElementById('mode-selector').style.display = 'none';
        document.getElementById('back-to-menu').style.display = 'flex';
        document.getElementById('toolbar').style.display = 'flex';
        const btn = document.getElementById('btnSpawn');
        btn.innerText = mode === 'simple' ? 'Nuevo Nodo Simple' : 'Nuevo Nodo Doble';
        btn.onclick = () => Nodes.create(mode);
    },
    reset() { if(confirm("¿Seguro que quieres volver al menú?")) location.reload(); }
};