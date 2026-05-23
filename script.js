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
 * svg leído lazy para evitar null en GitHub Pages
 */
const Renderer = {
    get svg() { return document.getElementById('svg-layer'); },

    getArrowColor() {
        return document.body.classList.contains('dark-neon') ? '#bf5fff' : '#9b59b6';
    },

    update() {
        const svg = this.svg;
        if (!svg) return;
        svg.innerHTML = '';
        State.connections.forEach(conn => this.drawConnection(conn));
    },

    drawConnection(conn) {
        const svg = this.svg;
        if (!svg) return;
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

        const end  = this.getIntersection(startX, startY, t);
        const dx   = end.x - startX;
        const flex = Math.min(Math.abs(dx) * 0.4, 60);
        const d    = `M ${startX} ${startY} C ${startX + (conn.port === 'prev' ? -flex : flex)} ${startY}, ${end.x - (dx > 0 ? flex : -flex)} ${end.y}, ${end.x} ${end.y}`;

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

        svg.appendChild(path);
        svg.appendChild(dot);
    },

    getIntersection(sx, sy, el) {
        const r = {
            l: el.offsetLeft + State.OFFSET,
            t: el.offsetTop  + State.OFFSET,
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
    get world() { return document.getElementById('world'); },

    create(type) {
        const id  = 'el-' + Date.now();
        const val = document.getElementById('contentInput').value || 'Data';
        const div = document.createElement('div');
        div.id = id;

        let w = 160, h = 50;
        if (type === 'simple') {
            div.className = 'element node-rect';
            div.innerHTML = '<div class="data-core" style="border-right:none;border-radius:8px 0 0 8px">' + val + '</div><div class="side-ptr" style="border-radius:0 8px 8px 0"><div class="ptr-dot"></div></div>';
        } else if (type === 'double') {
            w = 200;
            div.className = 'element node-double';
            div.innerHTML = '<div class="side-ptr" style="border-right:none;border-radius:8px 0 0 8px"><div class="ptr-dot"></div></div><div class="data-core" style="border-right:none;">' + val + '</div><div class="side-ptr" style="border-radius:0 8px 8px 0"><div class="ptr-dot"></div></div>';
        } else if (type === 'ptr') {
            w = 50; h = 50;
            div.className = 'element ptr-circle';
            div.textContent = val || 'P';
        } else if (type === 'nil') {
            w = 45; h = 45;
            div.className = 'element nil-node';
            div.textContent = '=';
        }

        div.style.left = (window.innerWidth  / 2 - State.worldX - w / 2) + 'px';
        div.style.top  = (window.innerHeight / 2 - State.worldY - h / 2) + 'px';

        this.bindEvents(div);
        this.world.appendChild(div);
        Renderer.update();
    },

    bindEvents(div) {
        // ── MOUSE ──
        div.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            e.stopPropagation();
            if (State.connectingFromId) {
                if (State.connectingFromId !== div.id) {
                    State.connections = State.connections.filter(function(c) {
                        return !(c.from === State.connectingFromId && c.port === State.currentPort);
                    });
                    State.connections.push({ from: State.connectingFromId, to: div.id, port: State.currentPort });
                }
                State.connectingFromId = null;
                Renderer.update();
                return;
            }
            State.currentDrag = div;
            var rect = div.getBoundingClientRect();
            div.ox = e.clientX - rect.left;
            div.oy = e.clientY - rect.top;
        });

        div.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            UI.showContextMenu(e.clientX, e.clientY, div);
        });

        // ── TOUCH ──
        var longPressTimer = null;
        var touchMoved = false;

        div.addEventListener('touchstart', function(e) {
            e.stopPropagation();
            var touch = e.touches[0];
            touchMoved = false;

            if (State.connectingFromId) {
                e.preventDefault();
                if (State.connectingFromId !== div.id) {
                    State.connections = State.connections.filter(function(c) {
                        return !(c.from === State.connectingFromId && c.port === State.currentPort);
                    });
                    State.connections.push({ from: State.connectingFromId, to: div.id, port: State.currentPort });
                }
                State.connectingFromId = null;
                Renderer.update();
                return;
            }

            State.currentDrag = div;
            var rect = div.getBoundingClientRect();
            div.ox = touch.clientX - rect.left;
            div.oy = touch.clientY - rect.top;

            longPressTimer = setTimeout(function() {
                if (!touchMoved) {
                    State.currentDrag = null;
                    if (navigator.vibrate) navigator.vibrate(40);
                    UI.showContextMenu(touch.clientX, touch.clientY, div);
                }
            }, 500);
        }, { passive: false });

        div.addEventListener('touchmove', function(e) {
            e.preventDefault();
            e.stopPropagation();
            touchMoved = true;
            clearTimeout(longPressTimer);
            if (!State.currentDrag) return;
            var touch = e.touches[0];
            State.currentDrag.style.left = (touch.clientX - State.worldX - State.currentDrag.ox) + 'px';
            State.currentDrag.style.top  = (touch.clientY - State.worldY - State.currentDrag.oy) + 'px';
            if (!State.frameRequested) {
                State.frameRequested = true;
                requestAnimationFrame(function() { Renderer.update(); State.frameRequested = false; });
            }
        }, { passive: false });

        div.addEventListener('touchend', function() {
            clearTimeout(longPressTimer);
            State.currentDrag = null;
        });
    }
};

/**
 * INTERFAZ
 */
const UI = {
    get menu() { return document.getElementById('context-menu'); },

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-neon');
        document.getElementById('btn-theme').textContent = isDark ? '\u2600' : '\u263D';
        Renderer.update();
    },

    init() {
        // ── MOUSE: paneo y arrastre ──
        window.addEventListener('mousemove', function(e) {
            if (State.isPanning) {
                State.worldX += e.movementX;
                State.worldY += e.movementY;
                document.getElementById('world').style.transform = 'translate(' + State.worldX + 'px,' + State.worldY + 'px)';
            } else if (State.currentDrag) {
                State.currentDrag.style.left = (e.clientX - State.worldX - State.currentDrag.ox) + 'px';
                State.currentDrag.style.top  = (e.clientY - State.worldY - State.currentDrag.oy) + 'px';
                if (!State.frameRequested) {
                    State.frameRequested = true;
                    requestAnimationFrame(function() { Renderer.update(); State.frameRequested = false; });
                }
            }
        });

        window.addEventListener('mouseup', function() {
            State.isPanning   = false;
            State.currentDrag = null;
        });

        document.getElementById('viewport').addEventListener('mousedown', function(e) {
            if (e.target.id === 'viewport') State.isPanning = true;
        });

        // ── TOUCH: paneo del lienzo con un dedo sobre el fondo ──
        var panLastX = 0, panLastY = 0;

        document.getElementById('viewport').addEventListener('touchstart', function(e) {
            if (e.target.id !== 'viewport' && e.target.id !== 'world' && e.target.id !== 'svg-layer') return;
            if (e.touches.length === 1) {
                State.isPanning = true;
                panLastX = e.touches[0].clientX;
                panLastY = e.touches[0].clientY;
            }
        }, { passive: true });

        document.getElementById('viewport').addEventListener('touchmove', function(e) {
            if (!State.isPanning || e.touches.length !== 1) return;
            e.preventDefault();
            var dx = e.touches[0].clientX - panLastX;
            var dy = e.touches[0].clientY - panLastY;
            panLastX = e.touches[0].clientX;
            panLastY = e.touches[0].clientY;
            State.worldX += dx;
            State.worldY += dy;
            document.getElementById('world').style.transform = 'translate(' + State.worldX + 'px,' + State.worldY + 'px)';
        }, { passive: false });

        document.getElementById('viewport').addEventListener('touchend', function() {
            State.isPanning = false;
        });

        document.getElementById('m-del').addEventListener('click', function(e) {
            e.stopPropagation();
            document.getElementById('context-menu').style.display = 'none';
            State.connections = State.connections.filter(function(c) {
                return c.from !== State.contextTargetId && c.to !== State.contextTargetId;
            });
            var el = document.getElementById(State.contextTargetId);
            if (el) el.remove();
            Renderer.update();
        });

        document.getElementById('m-dis').addEventListener('click', function(e) {
            e.stopPropagation();
            document.getElementById('context-menu').style.display = 'none';
            State.connections = State.connections.filter(function(c) {
                return c.from !== State.contextTargetId;
            });
            Renderer.update();
        });

        document.getElementById('m-con-next').addEventListener('click', function(e) {
            e.stopPropagation();
            document.getElementById('context-menu').style.display = 'none';
            State.connectingFromId = State.contextTargetId;
            State.currentPort = 'next';
        });

        document.getElementById('m-con-prev').addEventListener('click', function(e) {
            e.stopPropagation();
            document.getElementById('context-menu').style.display = 'none';
            State.connectingFromId = State.contextTargetId;
            State.currentPort = 'prev';
        });
    },

    showContextMenu(x, y, el) {
        var menu = this.menu;
        State.contextTargetId = el.id;
        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top  = y + 'px';

        var isNil    = el.classList.contains('nil-node');
        var isPtr    = el.classList.contains('ptr-circle');
        var isDouble = el.classList.contains('node-double');

        var btnNext = document.getElementById('m-con-next');
        var btnDis  = document.getElementById('m-dis');

        if (isPtr) {
            btnNext.textContent    = 'Realizar Conexion';
            btnNext.style.display  = 'block';
            btnDis.style.display   = 'block';
        } else if (isNil) {
            btnNext.style.display  = 'none';
            btnDis.style.display   = 'none';
        } else {
            btnNext.textContent    = 'Conectar Proximo (Derecha)';
            btnNext.style.display  = 'block';
            btnDis.style.display   = 'block';
        }
        document.getElementById('m-del').textContent = 'Eliminar Elemento';
        document.getElementById('m-con-prev').style.display = isDouble ? 'block' : 'none';
    }
};

/**
 * APP
 */
const App = {
    currentMode: 'simple',

    start(mode) {
        UI.init();
        document.getElementById('mode-selector').style.display = 'none';
        document.getElementById('back-to-menu').style.display  = 'flex';
        document.getElementById('toolbar').style.display       = 'flex';
        App.currentMode = mode;
        var btn = document.getElementById('btnSpawn');
        btn.textContent = mode === 'simple' ? 'Nuevo Nodo Simple' : 'Nuevo Nodo Doble';
        btn.addEventListener('click', function() { Nodes.create(mode); });
    },

    reset() {
        if (confirm('Seguro que quieres volver al menu?')) location.reload();
    }
};

/**
 * ============================================================
 * TUTORIAL
 * ============================================================
 */
const Tutorial = {
    step: 0,

    steps: [
        {
            title: 'Bienvenido al Simulador',
            desc: 'Esta herramienta te permite crear y visualizar estructuras de listas enlazadas. Hay tres tipos de elementos: <strong>Nodos</strong>, <strong>Punteros</strong> y <strong>NIL</strong>.',
            visual: function() {
                return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;">'
                     + '<div class="demo-node"><div class="demo-data">42</div><div class="demo-ptr"><div class="demo-ptr-dot"></div></div></div>'
                     + '<div class="demo-arrow">&#8594;</div>'
                     + '<div class="demo-ptr-node">Head</div>'
                     + '<div class="demo-arrow">&#8594;</div>'
                     + '<div class="demo-nil">=</div>'
                     + '</div>'
                     + '<div class="demo-label">Nodo &middot; Puntero &middot; NIL</div>';
            }
        },
        {
            title: 'Elegir modo de estructura',
            desc: 'Desde el menu inicial podes elegir entre <strong>Nodo Simple</strong> (puntero solo hacia adelante) y <strong>Nodo Doble</strong> (punteros hacia adelante y hacia atras).',
            visual: function() {
                return '<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;justify-content:center;">'
                     + '<div style="text-align:center;">'
                     + '<div class="demo-node"><div class="demo-data">A</div><div class="demo-ptr"><div class="demo-ptr-dot"></div></div></div>'
                     + '<div style="font-size:11px;margin-top:7px;opacity:0.5;color:var(--text-color);">Nodo Simple</div></div>'
                     + '<div style="text-align:center;">'
                     + '<div class="demo-double-node"><div class="demo-side"><div class="demo-ptr-dot"></div></div><div class="demo-center">B</div><div class="demo-side"><div class="demo-ptr-dot"></div></div></div>'
                     + '<div style="font-size:11px;margin-top:7px;opacity:0.5;color:var(--text-color);">Nodo Doble</div></div>'
                     + '</div>';
            }
        },
        {
            title: 'Crear elementos desde la barra',
            desc: 'Escribi un valor en el campo de texto y presiona el boton correspondiente:<br><br>&#8226; <strong>Nuevo Nodo</strong> &mdash; crea un nodo con el valor ingresado<br>&#8226; <strong>Puntero</strong> &mdash; crea un nodo puntero con etiqueta<br>&#8226; <strong>Nil</strong> &mdash; crea el nodo de fin de lista',
            visual: function() {
                return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;">'
                     + '<div style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:7px 12px;font-size:13px;color:var(--input-color);">42</div>'
                     + '<div style="background:var(--node-data-border);color:white;padding:7px 12px;border-radius:6px;font-size:12px;font-weight:700;">Nuevo Nodo</div>'
                     + '<div style="background:var(--ptr-border);color:white;padding:7px 12px;border-radius:6px;font-size:12px;font-weight:700;">Puntero</div>'
                     + '<div style="background:var(--nil-border);color:white;padding:7px 12px;border-radius:6px;font-size:12px;font-weight:700;">Nil</div>'
                     + '</div>'
                     + '<div class="demo-label">Los elementos aparecen centrados en el lienzo</div>';
            }
        },
        {
            title: 'Mover elementos',
            desc: 'Haz <strong>clic sostenido</strong> sobre cualquier nodo y arrastralo. Las flechas se actualizan en tiempo real. Para desplazar todo el lienzo, arrastra desde el fondo.',
            visual: function() {
                return '<div style="display:flex;align-items:center;gap:14px;justify-content:center;">'
                     + '<div class="demo-drag-hint">&#10021;</div>'
                     + '<div style="display:flex;flex-direction:column;gap:8px;">'
                     + '<div style="font-size:13px;color:var(--text-color);opacity:0.75;">Clic + arrastrar &rarr; mover nodo</div>'
                     + '<div style="font-size:13px;color:var(--text-color);opacity:0.75;">Clic en fondo + arrastrar &rarr; mover lienzo</div>'
                     + '</div></div>';
            }
        },
        {
            title: 'Conectar nodos',
            desc: 'Para crear una flecha: haz <strong>clic derecho</strong> en el nodo origen, elige <em>Conectar Proximo</em> y luego haz clic en el nodo destino.',
            visual: function() {
                return '<div style="display:flex;align-items:center;gap:12px;justify-content:center;flex-wrap:wrap;">'
                     + '<div class="demo-ctx-menu">'
                     + '<div class="demo-ctx-item highlight">Conectar Proximo (Derecha)</div>'
                     + '<div class="demo-ctx-item">Conectar Anterior (Izquierda)</div>'
                     + '<div class="demo-ctx-item">Eliminar Salidas</div>'
                     + '<div class="demo-ctx-item">Eliminar Elemento</div>'
                     + '</div>'
                     + '<div class="demo-arrow" style="font-size:26px;">&#8594;</div>'
                     + '<div style="display:flex;align-items:center;gap:8px;">'
                     + '<div class="demo-node"><div class="demo-data">1</div><div class="demo-ptr"><div class="demo-ptr-dot"></div></div></div>'
                     + '<div class="demo-arrow">&#8594;</div>'
                     + '<div class="demo-node"><div class="demo-data">2</div><div class="demo-ptr"><div class="demo-ptr-dot"></div></div></div>'
                     + '</div></div>';
            }
        },
        {
            title: 'Ejemplo: lista simple',
            desc: 'Un <strong>puntero Head</strong> apunta al primer nodo, los nodos se conectan en cadena, y el ultimo apunta a <strong>NIL</strong>.',
            visual: function() {
                return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;">'
                     + '<div class="demo-ptr-node">Head</div>'
                     + '<div class="demo-arrow">&#8594;</div>'
                     + '<div class="demo-node"><div class="demo-data">10</div><div class="demo-ptr"><div class="demo-ptr-dot"></div></div></div>'
                     + '<div class="demo-arrow">&#8594;</div>'
                     + '<div class="demo-node"><div class="demo-data">20</div><div class="demo-ptr"><div class="demo-ptr-dot"></div></div></div>'
                     + '<div class="demo-arrow">&#8594;</div>'
                     + '<div class="demo-nil">=</div>'
                     + '</div>'
                     + '<div class="demo-label">Head &rarr; 10 &rarr; 20 &rarr; NIL</div>';
            }
        },
        {
            title: 'Ejemplo: lista doble',
            desc: 'Con nodos dobles podes conectar en ambas direcciones usando <em>Conectar Proximo</em> y <em>Conectar Anterior</em>.',
            visual: function() {
                return '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;">'
                     + '<div class="demo-double-node"><div class="demo-side"><div class="demo-ptr-dot"></div></div><div class="demo-center">1</div><div class="demo-side"><div class="demo-ptr-dot"></div></div></div>'
                     + '<div style="display:flex;flex-direction:column;gap:4px;align-items:center;"><span style="font-size:16px;color:var(--ptr-border);">&#8594;</span><span style="font-size:16px;color:var(--ptr-border);">&#8592;</span></div>'
                     + '<div class="demo-double-node"><div class="demo-side"><div class="demo-ptr-dot"></div></div><div class="demo-center">2</div><div class="demo-side"><div class="demo-ptr-dot"></div></div></div>'
                     + '<div style="display:flex;flex-direction:column;gap:4px;align-items:center;"><span style="font-size:16px;color:var(--ptr-border);">&#8594;</span><span style="font-size:16px;color:var(--ptr-border);">&#8592;</span></div>'
                     + '<div class="demo-double-node"><div class="demo-side"><div class="demo-ptr-dot"></div></div><div class="demo-center">3</div><div class="demo-side"><div class="demo-ptr-dot"></div></div></div>'
                     + '</div>'
                     + '<div class="demo-label">Conexiones bidireccionales</div>';
            }
        },
        {
            title: 'Listo para empezar!',
            desc: 'Ya sabes todo lo necesario. Podes consultar esta guia en cualquier momento con el boton <strong>?</strong> en la barra.<br><br>Elegi un modo y empieza a construir.',
            visual: function() {
                return '<div style="font-size:52px;text-align:center;padding:10px 0;">&#127881;</div>'
                     + '<div style="font-size:14px;text-align:center;color:var(--text-color);opacity:0.6;margin-top:4px;">Nodo Simple &middot; Nodo Doble &middot; Puntero &middot; NIL</div>';
            }
        }
    ],

    open: function() {
        Tutorial.step = 0;
        document.getElementById('tut-overlay').classList.add('open');
        Tutorial._render();
    },

    close: function() {
        document.getElementById('tut-overlay').classList.remove('open');
    },

    prev: function() {
        if (Tutorial.step > 0) { Tutorial.step--; Tutorial._render(); }
    },

    next: function() {
        if (Tutorial.step < Tutorial.steps.length - 1) {
            Tutorial.step++;
            Tutorial._render();
        } else {
            Tutorial.close();
        }
    },

    _render: function() {
        var s     = Tutorial.steps[Tutorial.step];
        var total = Tutorial.steps.length;

        document.getElementById('tut-visual').innerHTML     = s.visual();
        document.getElementById('tut-step-title').textContent = s.title;
        document.getElementById('tut-step-desc').innerHTML  = s.desc;

        var dotsEl = document.getElementById('tut-steps-indicator');
        dotsEl.innerHTML = '';
        Tutorial.steps.forEach(function(_, i) {
            var d = document.createElement('div');
            d.className = 'tut-dot' + (i === Tutorial.step ? ' active' : '');
            dotsEl.appendChild(d);
        });

        document.getElementById('tut-counter').textContent = (Tutorial.step + 1) + ' / ' + total;
        document.getElementById('tut-prev').disabled = Tutorial.step === 0;

        var nextBtn = document.getElementById('tut-next');
        var isLast  = Tutorial.step === total - 1;
        nextBtn.textContent = isLast ? 'Comenzar \u2713' : 'Siguiente \u2192';
        nextBtn.classList.toggle('finish', isLast);
    }
};

/**
 * INICIALIZACIÓN — todo arranca aquí, sin depender del orden de carga
 */
document.addEventListener('DOMContentLoaded', function() {

    // Menú inicial
    document.getElementById('card-simple').addEventListener('click', function() { App.start('simple'); });
    document.getElementById('card-double').addEventListener('click', function() { App.start('double'); });
    document.getElementById('card-tutorial').addEventListener('click', function() { Tutorial.open(); });

    // Toolbar
    document.getElementById('back-to-menu').addEventListener('click', function() { App.reset(); });
    document.getElementById('btn-ptr').addEventListener('click', function() { Nodes.create('ptr'); });
    document.getElementById('btn-nil').addEventListener('click', function() { Nodes.create('nil'); });
    document.getElementById('btn-theme').addEventListener('click', function() { UI.toggleTheme(); });
    document.getElementById('btn-help').addEventListener('click', function() { Tutorial.open(); });

    // Tutorial — botones de navegación
    document.getElementById('tut-close').addEventListener('click', function() { Tutorial.close(); });
    document.getElementById('tut-prev').addEventListener('click', function() { Tutorial.prev(); });
    document.getElementById('tut-next').addEventListener('click', function() { Tutorial.next(); });
    document.getElementById('tut-overlay').addEventListener('click', function(e) {
        if (e.target.id === 'tut-overlay') Tutorial.close();
    });

    // Cierre del menú contextual al hacer clic fuera
    document.addEventListener('click', function(e) {
        var menu = document.getElementById('context-menu');
        if (menu && !menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
});