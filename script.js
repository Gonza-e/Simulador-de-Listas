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

    getArrowColor() {
        return document.body.classList.contains('dark-neon') ? '#bf5fff' : '#9b59b6';
    },

    update() {
        this.svg.innerHTML = '';
        State.connections.forEach(conn => this.drawConnection(conn));
    },

    drawConnection(conn) {
        const f = document.getElementById(conn.from);
        const t = document.getElementById(conn.to);
        if (!f || !t) return;

        const fW = f.offsetWidth;
        const fH = f.offsetHeight;

        let startX, startY;
        if (conn.port === 'next') {
            startX = f.offsetLeft + fW + State.OFFSET;
            startY = f.offsetTop + (fH / 2) - 8 + State.OFFSET;
        } else {
            startX = f.offsetLeft + State.OFFSET;
            startY = f.offsetTop + (fH / 2) + 8 + State.OFFSET;
        }

        const end = this.getIntersection(startX, startY, t);
        const dx = end.x - startX;
        const flex = Math.min(Math.abs(dx) * 0.4, 60);
        const d = `M ${startX} ${startY} C ${startX + (conn.port === 'prev' ? -flex : flex)} ${startY}, ${end.x - (dx > 0 ? flex : -flex)} ${end.y}, ${end.x} ${end.y}`;

        const color = this.getArrowColor();

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('fill', 'none');

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', end.x);
        dot.setAttribute('cy', end.y);
        dot.setAttribute('r', '5');
        dot.setAttribute('fill', color);

        this.svg.appendChild(path);
        this.svg.appendChild(dot);
    },

    getIntersection(sx, sy, el) {
        const r = {
            l: el.offsetLeft + State.OFFSET,
            t: el.offsetTop + State.OFFSET,
            w: el.offsetWidth,
            h: el.offsetHeight
        };
        const cx = r.l + r.w / 2;
        const cy = r.t + r.h / 2;
        const dx = cx - sx, dy = cy - sy;

        if (el.classList.contains('ptr-circle') || el.classList.contains('nil-node')) {
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            return { x: cx - (dx / dist) * (r.w / 2), y: cy - (dy / dist) * (r.h / 2) };
        } else {
            const m = dy / dx;
            if (Math.abs(m) <= r.h / r.w) {
                return { x: dx > 0 ? r.l : r.l + r.w, y: cy - m * (dx > 0 ? r.w / 2 : -r.w / 2) };
            } else {
                return { x: cx - (dy > 0 ? r.h / 2 : -r.h / 2) / m, y: dy > 0 ? r.t : r.t + r.h };
            }
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

        div.style.left = (window.innerWidth / 2 - State.worldX - (w / 2)) + 'px';
        div.style.top  = (window.innerHeight / 2 - State.worldY - (h / 2)) + 'px';

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

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-neon');
        document.getElementById('btn-theme').textContent = isDark ? '☀️' : '🌙';
        Renderer.update();
    },

    init() {
        window.onmousemove = (e) => {
            if (State.isPanning) {
                State.worldX += e.movementX;
                State.worldY += e.movementY;
                document.getElementById('world').style.transform = `translate(${State.worldX}px, ${State.worldY}px)`;
            } else if (State.currentDrag) {
                State.currentDrag.style.left = (e.clientX - State.worldX - State.currentDrag.ox) + 'px';
                State.currentDrag.style.top  = (e.clientY - State.worldY - State.currentDrag.oy) + 'px';
                if (!State.frameRequested) {
                    State.frameRequested = true;
                    requestAnimationFrame(() => { Renderer.update(); State.frameRequested = false; });
                }
            }
        };
        window.onmouseup = () => { State.isPanning = false; State.currentDrag = null; };
        document.getElementById('viewport').onmousedown = (e) => { if (e.target.id === 'viewport') State.isPanning = true; };
        window.onclick = () => this.menu.style.display = 'none';

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
        this.menu.style.left = x + 'px';
        this.menu.style.top  = y + 'px';

        const isNil    = el.classList.contains('nil-node');
        const isPtr    = el.classList.contains('ptr-circle');
        const isDouble = el.classList.contains('node-double');

        const btnNext = document.getElementById('m-con-next');
        const btnDis  = document.getElementById('m-dis');

        if (isPtr) {
            btnNext.innerText = 'Realizar Conexión'; btnNext.style.display = 'block'; btnDis.style.display = 'block';
        } else if (isNil) {
            btnNext.style.display = 'none'; btnDis.style.display = 'none';
        } else {
            btnNext.innerText = 'Conectar Próximo (Derecha)'; btnNext.style.display = 'block'; btnDis.style.display = 'block';
        }
        document.getElementById('m-del').innerText = 'Eliminar Elemento';
        document.getElementById('m-con-prev').style.display = isDouble ? 'block' : 'none';
    }
};

const App = {
    currentMode: 'simple',
    start(mode) {
        UI.init();
        document.getElementById('mode-selector').style.display = 'none';
        document.getElementById('back-to-menu').style.display = 'flex';
        document.getElementById('toolbar').style.display = 'flex';
        App.currentMode = mode;
        const btn = document.getElementById('btnSpawn');
        btn.innerText = mode === 'simple' ? 'Nuevo Nodo Simple' : 'Nuevo Nodo Doble';
        btn.onclick = () => Nodes.create(mode);
    },
    reset() { if (confirm('¿Seguro que quieres volver al menú?')) location.reload(); }
};

/**
 * ============================================================
 * TUTORIAL — guía paso a paso del simulador
 * ============================================================
 */
const Tutorial = {
    step: 0,

    steps: [
        {
            title: 'Bienvenido al Simulador',
            desc: 'Esta herramienta te permite crear y visualizar estructuras de listas enlazadas de forma interactiva. Hay tres tipos de elementos: <strong>Nodos</strong>, <strong>Punteros</strong> y <strong>NIL</strong>.',
            visual() {
                return `
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;">
                        <div class="demo-node">
                            <div class="demo-data">42</div>
                            <div class="demo-ptr"><div class="demo-ptr-dot"></div></div>
                        </div>
                        <div class="demo-arrow">→</div>
                        <div class="demo-ptr-node">Head</div>
                        <div class="demo-arrow">→</div>
                        <div class="demo-nil">=</div>
                    </div>
                    <div class="demo-label">Nodo · Puntero · NIL</div>`;
            }
        },
        {
            title: 'Elegir modo de estructura',
            desc: 'Desde el menú inicial podés elegir entre <strong>Nodo Simple</strong> (puntero solo hacia adelante) y <strong>Nodo Doble</strong> (punteros hacia adelante y hacia atrás). El modo determina qué tipo de nodo crea el botón principal de la barra.',
            visual() {
                return `
                    <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;justify-content:center;">
                        <div style="text-align:center;">
                            <div class="demo-node">
                                <div class="demo-data">A</div>
                                <div class="demo-ptr"><div class="demo-ptr-dot"></div></div>
                            </div>
                            <div style="font-size:11px;margin-top:7px;opacity:0.5;color:var(--text-color);">Nodo Simple</div>
                        </div>
                        <div style="text-align:center;">
                            <div class="demo-double-node">
                                <div class="demo-side"><div class="demo-ptr-dot"></div></div>
                                <div class="demo-center">B</div>
                                <div class="demo-side"><div class="demo-ptr-dot"></div></div>
                            </div>
                            <div style="font-size:11px;margin-top:7px;opacity:0.5;color:var(--text-color);">Nodo Doble</div>
                        </div>
                    </div>`;
            }
        },
        {
            title: 'Crear elementos desde la barra',
            desc: 'Escribí un valor en el campo de texto y presioná el botón correspondiente:<br><br>• <strong>Nuevo Nodo</strong> — crea un nodo con el valor ingresado<br>• <strong>Puntero</strong> — crea un nodo puntero con etiqueta<br>• <strong>Nil</strong> — crea el nodo de fin de lista',
            visual() {
                return `
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;">
                        <div style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:7px 12px;font-size:13px;color:var(--input-color);min-width:70px;">42</div>
                        <div style="background:var(--node-data-border);color:white;padding:7px 12px;border-radius:6px;font-size:12px;font-weight:700;">Nuevo Nodo</div>
                        <div style="background:var(--ptr-border);color:white;padding:7px 12px;border-radius:6px;font-size:12px;font-weight:700;">Puntero</div>
                        <div style="background:var(--nil-border);color:white;padding:7px 12px;border-radius:6px;font-size:12px;font-weight:700;">Nil</div>
                    </div>
                    <div class="demo-label">Los elementos aparecen centrados en el lienzo</div>`;
            }
        },
        {
            title: 'Mover elementos',
            desc: 'Hacé <strong>clic sostenido</strong> sobre cualquier nodo y arrastralo a la posición que quieras. Las flechas de conexión se actualizan en tiempo real mientras movés.',
            visual() {
                return `
                    <div style="display:flex;align-items:center;gap:14px;justify-content:center;">
                        <div class="demo-drag-hint">✥</div>
                        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start;">
                            <div style="font-size:13px;color:var(--text-color);opacity:0.75;">Clic + arrastrar → mover nodo</div>
                            <div style="font-size:13px;color:var(--text-color);opacity:0.75;">Clic en fondo + arrastrar → desplazar lienzo</div>
                        </div>
                    </div>`;
            }
        },
        {
            title: 'Conectar nodos',
            desc: 'Para crear una flecha entre dos nodos: hacé <strong>clic derecho</strong> en el nodo origen, elegí <em>Conectar Próximo</em> (o <em>Conectar Anterior</em> en nodos dobles), y luego hacé clic en el nodo destino. La flecha se dibuja automáticamente.',
            visual() {
                return `
                    <div style="display:flex;align-items:center;gap:12px;justify-content:center;flex-wrap:wrap;">
                        <div class="demo-ctx-menu">
                            <div class="demo-ctx-item highlight">Conectar Próximo (Derecha)</div>
                            <div class="demo-ctx-item">Conectar Anterior (Izquierda)</div>
                            <div class="demo-ctx-item">Eliminar Salidas</div>
                            <div class="demo-ctx-item">Eliminar Elemento</div>
                        </div>
                        <div class="demo-arrow" style="font-size:26px;">→</div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <div class="demo-node">
                                <div class="demo-data">1</div>
                                <div class="demo-ptr"><div class="demo-ptr-dot"></div></div>
                            </div>
                            <div class="demo-arrow">→</div>
                            <div class="demo-node">
                                <div class="demo-data">2</div>
                                <div class="demo-ptr"><div class="demo-ptr-dot"></div></div>
                            </div>
                        </div>
                    </div>`;
            }
        },
        {
            title: 'Menú contextual (clic derecho)',
            desc: 'Al hacer clic derecho sobre cualquier elemento aparece un menú con todas las acciones disponibles según el tipo de nodo:<br><br>• <strong>Conectar</strong> — inicia una conexión<br>• <strong>Eliminar Salidas</strong> — borra las flechas que salen del nodo<br>• <strong>Eliminar Elemento</strong> — elimina el nodo y sus conexiones',
            visual() {
                return `
                    <div style="display:flex;gap:16px;align-items:flex-start;justify-content:center;flex-wrap:wrap;">
                        <div>
                            <div style="font-size:11px;opacity:0.45;color:var(--text-color);margin-bottom:5px;text-align:center;">Nodo / Puntero</div>
                            <div class="demo-ctx-menu">
                                <div class="demo-ctx-item">Conectar Próximo</div>
                                <div class="demo-ctx-item">Eliminar Salidas</div>
                                <div class="demo-ctx-item">Eliminar Elemento</div>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:11px;opacity:0.45;color:var(--text-color);margin-bottom:5px;text-align:center;">Nodo Doble</div>
                            <div class="demo-ctx-menu">
                                <div class="demo-ctx-item">Conectar Próximo</div>
                                <div class="demo-ctx-item">Conectar Anterior</div>
                                <div class="demo-ctx-item">Eliminar Salidas</div>
                                <div class="demo-ctx-item">Eliminar Elemento</div>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:11px;opacity:0.45;color:var(--text-color);margin-bottom:5px;text-align:center;">NIL</div>
                            <div class="demo-ctx-menu">
                                <div class="demo-ctx-item">Eliminar Elemento</div>
                            </div>
                        </div>
                    </div>`;
            }
        },
        {
            title: 'Ejemplo: lista enlazada simple',
            desc: 'Una lista típica se construye así: un <strong>puntero Head</strong> apunta al primer nodo, los nodos se conectan en cadena con <em>Conectar Próximo</em>, y el último nodo apunta a un <strong>NIL</strong> que indica el fin de la lista.',
            visual() {
                return `
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;">
                        <div class="demo-ptr-node">Head</div>
                        <div class="demo-arrow">→</div>
                        <div class="demo-node">
                            <div class="demo-data">10</div>
                            <div class="demo-ptr"><div class="demo-ptr-dot"></div></div>
                        </div>
                        <div class="demo-arrow">→</div>
                        <div class="demo-node">
                            <div class="demo-data">20</div>
                            <div class="demo-ptr"><div class="demo-ptr-dot"></div></div>
                        </div>
                        <div class="demo-arrow">→</div>
                        <div class="demo-nil">=</div>
                    </div>
                    <div class="demo-label">Head → 10 → 20 → NIL</div>`;
            }
        },
        {
            title: 'Ejemplo: lista doblemente enlazada',
            desc: 'Con nodos dobles podés conectar en ambas direcciones: usá <em>Conectar Próximo</em> para la flecha hacia la derecha y <em>Conectar Anterior</em> para la flecha hacia la izquierda. Esto te permite recorrer la lista en ambos sentidos.',
            visual() {
                return `
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;">
                        <div class="demo-double-node">
                            <div class="demo-side"><div class="demo-ptr-dot"></div></div>
                            <div class="demo-center">1</div>
                            <div class="demo-side"><div class="demo-ptr-dot"></div></div>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
                            <span style="font-size:16px;color:var(--ptr-border);">→</span>
                            <span style="font-size:16px;color:var(--ptr-border);">←</span>
                        </div>
                        <div class="demo-double-node">
                            <div class="demo-side"><div class="demo-ptr-dot"></div></div>
                            <div class="demo-center">2</div>
                            <div class="demo-side"><div class="demo-ptr-dot"></div></div>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
                            <span style="font-size:16px;color:var(--ptr-border);">→</span>
                            <span style="font-size:16px;color:var(--ptr-border);">←</span>
                        </div>
                        <div class="demo-double-node">
                            <div class="demo-side"><div class="demo-ptr-dot"></div></div>
                            <div class="demo-center">3</div>
                            <div class="demo-side"><div class="demo-ptr-dot"></div></div>
                        </div>
                    </div>
                    <div class="demo-label">Conexiones bidireccionales entre nodos</div>`;
            }
        },
        {
            title: '¡Listo para empezar!',
            desc: 'Ya conocés todo lo que necesitás para usar el simulador. Podés consultar esta guía en cualquier momento desde el botón <strong>?</strong> en la barra de herramientas.<br><br>Elegí un modo y empezá a construir tus estructuras.',
            visual() {
                return `
                    <div style="font-size:52px;text-align:center;padding:10px 0;">🎉</div>
                    <div style="font-size:14px;text-align:center;color:var(--text-color);opacity:0.6;margin-top:4px;">
                        Nodo Simple · Nodo Doble · Puntero · NIL
                    </div>`;
            }
        }
    ],

    open() {
        this.step = 0;
        document.getElementById('tut-overlay').classList.add('open');
        this._render();
    },

    close() {
        document.getElementById('tut-overlay').classList.remove('open');
    },

    closeOnOverlay(e) {
        if (e.target.id === 'tut-overlay') this.close();
    },

    prev() {
        if (this.step > 0) { this.step--; this._render(); }
    },

    next() {
        if (this.step < this.steps.length - 1) {
            this.step++;
            this._render();
        } else {
            this.close();
        }
    },

    _render() {
        const s = this.steps[this.step];
        const total = this.steps.length;

        // Visual
        document.getElementById('tut-visual').innerHTML = s.visual();

        // Texto
        document.getElementById('tut-step-title').textContent = s.title;
        document.getElementById('tut-step-desc').innerHTML = s.desc;

        // Dots
        const dotsEl = document.getElementById('tut-steps-indicator');
        dotsEl.innerHTML = '';
        this.steps.forEach((_, i) => {
            const d = document.createElement('div');
            d.className = 'tut-dot' + (i === this.step ? ' active' : '');
            dotsEl.appendChild(d);
        });

        // Navegación
        document.getElementById('tut-counter').textContent = `${this.step + 1} / ${total}`;
        document.getElementById('tut-prev').disabled = this.step === 0;

        const nextBtn = document.getElementById('tut-next');
        const isLast = this.step === total - 1;
        nextBtn.textContent = isLast ? 'Comenzar ✓' : 'Siguiente →';
        nextBtn.classList.toggle('finish', isLast);
    }
};