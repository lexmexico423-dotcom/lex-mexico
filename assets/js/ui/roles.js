// ── Nov-2026 · ROLES DE EMPLEADOS ─────────────────────────────────────────────
// Roles (columna "rol" de la tabla miembros en Supabase):
//   admin          → Administrador (solo se asigna desde Supabase, con Claude)
//   operador       → AUXILIAR (el que tenía la empleada; hace todo menos admin)
//   recepcionista  → cobra, recibos, cotizaciones, citas, pendientes; sin contabilidad
//   abogado        → escrituras, juicios, carpetas, citas…; nada de dinero
//   consultor      → solo consulta; nada de dinero; solo marca sus tareas
// Permiso por sección: 'w' = trabaja · 'r' = solo ve · '-' = no aparece.
// El rol se cambia en Gestión de Accesos con una lista desplegable (función
// segura lex_asignar_rol en Supabase: solo el administrador puede usarla).
(function(){
  'use strict';
  if (window._lexRoles) return;
  window._lexRoles = true;

  var NOMBRE = { admin:'Administrador', operador:'Auxiliar', empleado:'Auxiliar', recepcionista:'Recepcionista', abogado:'Abogado', consultor:'Consultor' };
  var COLOR  = { admin:['#FAEEDA','#633806'], operador:['#E6F1FB','#0C447C'], empleado:['#E6F1FB','#0C447C'], recepcionista:['#E1F5EE','#085041'], abogado:['#EEEDFE','#3C3489'], consultor:['#F1EFE8','#444441'] };
  var ASIGNABLES = ['operador', 'recepcionista', 'abogado', 'consultor'];

  var PERM = {
    recepcionista: { caja:'w', contabilidad:'-', recibos:'r', 'nuevo-recibo':'w', 'busqueda-cliente':'w', 'pre-recibo':'w', 'recibos-anteriores':'r', 'adeudos-sin-recibo':'r',
                     escrituras:'r', juicios:'-', carpetas:'r', pendientes:'w', 'registro-civil':'w', gestiones:'w', citas:'w', directorio:'w', 'tareas-hoy':'w', configuracion:'-' },
    abogado:       { caja:'w', contabilidad:'-', recibos:'-', 'nuevo-recibo':'-', 'busqueda-cliente':'-', 'pre-recibo':'-', 'recibos-anteriores':'-', 'adeudos-sin-recibo':'-',
                     escrituras:'w', juicios:'w', carpetas:'w', pendientes:'w', 'registro-civil':'w', gestiones:'w', citas:'w', directorio:'w', 'tareas-hoy':'w', configuracion:'-' },
    consultor:     { caja:'w', contabilidad:'-', recibos:'-', 'nuevo-recibo':'-', 'busqueda-cliente':'-', 'pre-recibo':'-', 'recibos-anteriores':'-', 'adeudos-sin-recibo':'-',
                     escrituras:'r', juicios:'r', carpetas:'r', pendientes:'r', 'registro-civil':'r', gestiones:'r', citas:'r', directorio:'r', 'tareas-hoy':'w', configuracion:'-' }
  };
  var SIN_MONTOS = { abogado:true, consultor:true };

  function email(){ try { return String((typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.email) || '').toLowerCase(); } catch(_){ return ''; } }
  function rol(){
    var r = String(window.SB_ROL_ACTUAL || '').toLowerCase();
    try { if (typeof ADMIN_EMAIL !== 'undefined' && email() && email() === String(ADMIN_EMAIL).toLowerCase()) return 'admin'; } catch(_){}
    if (r === 'empleado' || !r) r = 'operador';
    return r;
  }
  function permiso(panel){
    var t = PERM[rol()];
    if (!t) return 'w';                       // admin y auxiliar: todo
    return t[panel] || 'w';
  }
  function puedeBorrar(){ var r = rol(); return r === 'admin' || r === 'operador'; }
  function panelActivo(){ var p = document.querySelector('.content .panel.active'); return p ? String(p.id || '').replace(/^panel-/, '') : ''; }
  function aviso(m){ try { if (typeof toast === 'function') toast(m, 'err'); } catch(_){} }
  window.lexRol = rol;
  window.lexRolNombre = function(r){ return NOMBRE[String(r || '').toLowerCase()] || r || ''; };
  window.lexRolPermiso = permiso;
  window.lexRolPuedeVer = function(panel){ return permiso(panel) !== '-'; };
  window.lexRolSinMontos = function(){ return !!SIN_MONTOS[rol()]; };

  // ── Estilos ──────────────────────────────────────────────────────────────
  var st = document.createElement('style');
  st.textContent = ''
    + '.lex-rol-oculto{display:none !important;}'
    + 'body.lex-rol-sinmontos #panel-caja .caja-top-row>div:first-child,body.lex-rol-sinmontos #panel-caja .stat.verde,body.lex-rol-sinmontos #panel-caja .stat.rojo,'
    + 'body.lex-rol-sinmontos #panel-caja .caja-acciones-titulo,body.lex-rol-sinmontos #panel-caja .caja-acciones-grid,body.lex-rol-sinmontos #panel-caja .srv-card-con-barra,'
    + 'body.lex-rol-sinmontos #panel-caja .cierre-bar{display:none !important;}'
    + 'body.lex-rol-recepcionista #panel-caja .cierre-bar .btn-success{display:none !important;}'
    + '.lex-rol-banner{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:8px 14px;border-radius:8px;background:#F1EFE8;color:#444441;border:1px solid #D3D1C7;font-size:0.78rem;}'
    + '.lex-rol-inicio-oculto{display:none !important;}'
    + '#lex-inicio-rol{padding:4px 2px 10px;}'
    + '.lxi-saludo{font-family:Georgia,"Times New Roman",serif;font-size:1.7rem;color:#f3e3bd;line-height:1.2;}'
    + '.lxi-sub{color:#b59a63;font-size:0.86rem;margin:4px 0 18px;}'
    + '.lxi-cifras{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px;}'
    + '.lxi-cifra{background:#fdfaf4;border-radius:12px;border-top:3px solid #c8952a;padding:14px 16px;cursor:pointer;transition:transform .15s,box-shadow .15s;}'
    + '.lxi-cifra:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(200,149,42,0.25);}'
    + '.lxi-k{font-family:monospace;font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:#8c6518;}'
    + '.lxi-n{font-size:2rem;font-weight:700;color:#4a2f08;line-height:1.15;margin-top:4px;}'
    + '.lxi-dos{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:12px;}'
    + '.lxi-caja{background:#fdfaf4;border-radius:12px;padding:14px 16px;}'
    + '.lxi-tit{margin-bottom:6px;}'
    + '.lxi-li{display:flex;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid #eee2c4;font-size:0.86rem;color:#2a1a06;cursor:pointer;}'
    + '.lxi-li:last-child{border-bottom:none;}'
    + '.lxi-li:hover{background:#fbf2d8;}'
    + '.lxi-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}'
    + '.lxi-dia{min-width:52px;font-size:0.8rem;}'
    + '.lxi-mas{text-align:right;font-size:0.78rem;font-weight:700;color:#8c6518;cursor:pointer;padding-top:8px;}'
    + '.lxi-vacio{color:#7a6440;font-size:0.84rem;padding:12px 2px;}'
    + '@media(max-width:900px){.lxi-cifras{grid-template-columns:repeat(2,minmax(0,1fr));}.lxi-dos{grid-template-columns:1fr;}}'
    + '#lex-rol-chip{display:inline-block;margin-left:8px;padding:1px 9px;border-radius:10px;font-size:0.62rem;font-weight:700;font-family:monospace;letter-spacing:0.04em;vertical-align:1px;}';
  (document.head || document.documentElement).appendChild(st);

  // ── Menú lateral ─────────────────────────────────────────────────────────
  function panelDeNav(el){
    var dp = el.getAttribute('data-panel'); if (dp) return dp;
    var m = /ir\(['"]([\w-]+)['"]\)/.exec(el.getAttribute('onclick') || '');
    return m ? m[1] : '';
  }
  function asegurarNavExtra(){
    var grupo = document.querySelector('.nav .nav-group'); if (!grupo) return;
    var quiere = !!PERM[rol()] && rol() !== 'recepcionista';   // abogado / consultor
    [['directorio', '👥', 'Directorio'], ['tareas-hoy', '✅', 'Tareas de hoy']].forEach(function(x){
      var id = 'lex-nav-' + x[0], el = document.getElementById(id);
      if (quiere && !el) {
        el = document.createElement('div');
        el.className = 'nav-item'; el.id = id; el.setAttribute('data-panel', x[0]);
        el.setAttribute('onclick', x[0] === 'tareas-hoy' ? "if(typeof abrirTareasHoy==='function')abrirTareasHoy();else ir('tareas-hoy')" : "ir('directorio')");
        el.innerHTML = '<span class="ni">' + x[1] + '</span><span>' + x[2] + '</span>';
        grupo.appendChild(el);
      } else if (!quiere && el) el.remove();
    });
  }
  function aplicarMenu(){
    asegurarNavExtra();
    document.querySelectorAll('.nav .nav-item').forEach(function(el){
      var p = panelDeNav(el);
      if (!p) return;
      el.classList.toggle('lex-rol-oculto', permiso(p) === '-');
    });
    var scs = document.getElementById('nav-scansys');
    if (scs && PERM[rol()]) scs.classList.add('lex-rol-oculto'); else if (scs) scs.classList.remove('lex-rol-oculto');
  }

  // ── Etiqueta del rol junto al usuario (barra de arriba) ──────────────────
  // (Nov-2026: el Lic. pidió que NO aparezca el rol junto al correo)
  function aplicarChip(){ var c = document.getElementById('lex-rol-chip'); if (c) c.remove(); }

  // ── Principal para Abogado / Consultor (opción A: bienvenida + mi día) ──
  function hoyISO(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function aISO(f){
    f = String(f || '').trim(); if (!f) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f); if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(f); if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    return '';
  }
  function difDias(iso){ if (!iso) return null; var a = new Date(hoyISO() + 'T00:00:00'), b = new Date(iso + 'T00:00:00'); return Math.round((b - a) / 86400000); }
  function etiquetaDia(iso){
    var d = difDias(iso); if (d === 0) return 'Hoy'; if (d === 1) return 'Mañana';
    var dt = new Date(iso + 'T00:00:00');
    return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dt.getDay()] + ' ' + dt.getDate();
  }
  function h(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function nombreCorto(){
    var n = String((typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.nombre) || '').trim();
    if (!n) return '';
    var p = n.split(/\s+/), cap = function(x){ x = String(x || '').toLowerCase(); return x.charAt(0).toUpperCase() + x.slice(1); };
    if (/^lic\.?$/i.test(p[0]) && p[1]) return 'Lic. ' + cap(p[1]);
    return cap(p[0]);
  }
  function datosInicio(){
    var d = (typeof D !== 'undefined' && D) ? D : {}, hoy = hoyISO();
    var elimT = Array.isArray(d.tareasHoyEliminadas) ? d.tareasHoyEliminadas : [];
    var tareas = (d.tareasHoy || []).filter(function(t){
      if (!t || elimT.indexOf(t.id) >= 0) return false;
      if (/resuel|complet|hecha/i.test(String(t.estado || ''))) return false;
      var f = aISO(t.fechaProgramada); return !f || f <= hoy;
    });
    var citasHoy = (d.citas || []).filter(function(c){ return c && aISO(c.fecha) === hoy && !c.cancelada; });
    var elimE = Array.isArray(d.escriturasEliminadas) ? d.escriturasEliminadas : [];
    var escProc = (d.escrituras || []).filter(function(e){ return e && elimE.indexOf(e.id) < 0 && /^(proceso|espera)$/.test(String(e.estado || 'proceso')); }).length;
    var juiAct = (d.juicios || []).filter(function(j){ return j && !/conclu|archiv|cancel|termin/i.test(String(j.estatus || '')); }).length;
    // Próximos vencimientos: términos y audiencias de juicios + citas (15 días)
    var venc = [];
    (d.juicios || []).forEach(function(j){
      (j && j.terminos || []).forEach(function(t){
        var f = aISO(t && t.fecha); var dd = difDias(f);
        if (t && !t.cumplido && dd !== null && dd >= 0 && dd <= 15) venc.push({ f:f, txt:(t.tipo || 'Término') + ' — ' + (j.cliente || j.tipo || ''), urg: dd <= 1 });
      });
      var fa = aISO(j && j.audiencia); var da = difDias(fa);
      if (da !== null && da >= 0 && da <= 15) venc.push({ f:fa, txt:'Audiencia — ' + (j.cliente || '') + (j.expediente ? ' · Exp. ' + j.expediente : ''), urg: da <= 1 });
    });
    (d.citas || []).forEach(function(c){
      var f = aISO(c && c.fecha); var dc = difDias(f);
      if (c && !c.cancelada && dc !== null && dc >= 0 && dc <= 15) venc.push({ f:f, txt:'Cita' + (c.hora ? ' ' + c.hora : '') + ' — ' + (c.titulo || c.cliente || ''), urg: false, cita: true });
    });
    venc.sort(function(a, b){ return a.f < b.f ? -1 : a.f > b.f ? 1 : 0; });
    var vencHoy = venc.filter(function(v){ return !v.cita && difDias(v.f) <= 1; }).length;
    return { tareas: tareas, citasHoy: citasHoy, escProc: escProc, juiAct: juiAct, venc: venc, vencHoy: vencHoy };
  }
  var _htmlInicio = '';
  function pintarInicio(){
    var panel = document.getElementById('panel-caja'); if (!panel) return;
    var usar = !!SIN_MONTOS[rol()];
    var box = document.getElementById('lex-inicio-rol');
    if (!usar) {
      if (box) box.remove(); _htmlInicio = '';
      panel.querySelectorAll('.lex-rol-inicio-oculto').forEach(function(el){ el.classList.remove('lex-rol-inicio-oculto'); });
      return;
    }
    Array.prototype.forEach.call(panel.children, function(el){ if (el.id !== 'lex-inicio-rol') el.classList.add('lex-rol-inicio-oculto'); });
    if (!box) { box = document.createElement('div'); box.id = 'lex-inicio-rol'; panel.insertBefore(box, panel.firstChild); }
    var x = datosInicio(), hr = new Date().getHours();
    var saludo = hr < 12 ? 'Buenos días' : (hr < 19 ? 'Buenas tardes' : 'Buenas noches');
    var nom = nombreCorto();
    var fecha = new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });
    fecha = fecha.replace(',', ''); fecha = fecha.charAt(0).toUpperCase() + fecha.slice(1);
    var partes = [];
    partes.push(x.tareas.length + ' tarea' + (x.tareas.length === 1 ? '' : 's'));
    partes.push(x.citasHoy.length + ' cita' + (x.citasHoy.length === 1 ? '' : 's'));
    partes.push(x.vencHoy + ' término' + (x.vencHoy === 1 ? '' : 's') + ' por vencer');
    var cifra = function(k, n, accion){ return '<div class="lxi-cifra" onclick="' + accion + '"><div class="lxi-k">' + k + '</div><div class="lxi-n">' + n + '</div></div>'; };
    var html = '<div class="lxi-saludo">' + saludo + (nom ? ', ' + h(nom) : '') + '</div>'
      + '<div class="lxi-sub">' + h(fecha) + ' · tienes ' + partes.join(', ').replace(/, ([^,]*)$/, ' y $1') + '</div>'
      + '<div class="lxi-cifras">'
      + cifra('Tareas hoy', x.tareas.length, "if(typeof abrirTareasHoy==='function')abrirTareasHoy();else ir('tareas-hoy')")
      + cifra('Citas hoy', x.citasHoy.length, "ir('citas')")
      + cifra('Escrituras en proceso', x.escProc, "ir('escrituras')")
      + cifra('Juicios activos', x.juiAct, "ir('juicios')")
      + '</div><div class="lxi-dos">'
      + '<div class="lxi-caja"><div class="lxi-k lxi-tit">Mis tareas de hoy</div>'
      + (x.tareas.length ? x.tareas.slice(0, 6).map(function(t){
          var vencida = aISO(t.fechaProgramada) && aISO(t.fechaProgramada) < hoyISO();
          return '<div class="lxi-li" onclick="if(typeof abrirTareasHoy===\'function\')abrirTareasHoy();else ir(\'tareas-hoy\')"><span class="lxi-dot" style="background:' + (vencida ? '#E24B4A' : '#EF9F27') + '"></span>' + h(t.titulo || t.texto || 'Tarea') + '</div>';
        }).join('') + (x.tareas.length > 6 ? '<div class="lxi-mas" onclick="if(typeof abrirTareasHoy===\'function\')abrirTareasHoy();else ir(\'tareas-hoy\')">Ver las ' + x.tareas.length + ' tareas →</div>' : '')
        : '<div class="lxi-vacio">Sin tareas pendientes para hoy ✓</div>')
      + '</div>'
      + '<div class="lxi-caja"><div class="lxi-k lxi-tit">Próximos vencimientos</div>'
      + (x.venc.length ? x.venc.slice(0, 6).map(function(v){
          var dd = difDias(v.f);
          return '<div class="lxi-li" onclick="ir(\'' + (v.cita ? 'citas' : 'juicios') + '\')"><b class="lxi-dia" style="color:' + (dd <= 1 ? '#791F1F' : '#633806') + '">' + etiquetaDia(v.f) + '</b>' + h(v.txt) + '</div>';
        }).join('')
        : '<div class="lxi-vacio">Nada por vencer en los próximos 15 días ✓</div>')
      + '</div></div>';
    if (html !== _htmlInicio) { box.innerHTML = html; _htmlInicio = html; }
  }

  // ── Navegación: no entrar a secciones sin permiso ────────────────────────
  function envolverIr(){
    if (typeof window.ir !== 'function' || window.ir._lexRol) return;
    var orig = window.ir;
    var env = function(p){
      if (p && permiso(p) === '-') { aviso('🔒 Tu rol (' + (NOMBRE[rol()] || rol()) + ') no tiene acceso a esa sección'); return; }
      var r = orig.apply(this, arguments);
      try { setTimeout(pasada, 60); } catch(_){}
      return r;
    };
    for (var k in orig) { try { env[k] = orig[k]; } catch(_){} }
    env._lexRol = true;
    window.ir = env;
    try { ir = env; } catch(_){}
  }
  // Funciones que cambian datos: bloqueadas si la sección es "solo ve"
  var CAMBIAN = ['escSetEstado', 'lexEscTocarCirculo', 'lexEscMarcarLista', '_carpEditarUbicacion', 'abrirCarpeta', 'guardarCarpeta', 'escGuardar', 'lexEscObsGuardarYa', 'lexEscSiguienteEtapa', 'escNuevaEscritura', 'nuevaCarpeta'];
  // Funciones de dinero: bloqueadas para quien no ve dinero
  var DINERO = ['abrirLibre', 'abrirAdeudosSinRecibo', 'abrirPanelTenencia', 'abrirPanelCSF', 'abrirCopias', 'abrirEscaneo', 'cerrarCaja', 'abrirPreviaDesdeContab'];
  function envolverFunciones(){
    CAMBIAN.forEach(function(n){
      var f = window[n]; if (typeof f !== 'function' || f._lexRol) return;
      var env = function(){
        if (permiso(panelActivo()) === 'r') { aviso('🔒 Tu rol solo permite consultar esta sección'); return; }
        return f.apply(this, arguments);
      };
      env._lexRol = true; window[n] = env;
    });
    DINERO.forEach(function(n){
      var f = window[n]; if (typeof f !== 'function' || f._lexRol) return;
      var env = function(){
        if (SIN_MONTOS[rol()] || (n === 'cerrarCaja' && rol() === 'recepcionista')) { aviso('🔒 Tu rol no tiene acceso a cobros ni a la caja'); return; }
        return f.apply(this, arguments);
      };
      env._lexRol = true; window[n] = env;
    });
    // Borrar: solo Administrador y Auxiliar
    if (typeof window.confirmarBonito === 'function' && !window.confirmarBonito._lexRol) {
      var cb = window.confirmarBonito;
      var envCb = function(o){
        var txt = String((o && (o.titulo || '')) + ' ' + (o && (o.btnSi || '')));
        if (!puedeBorrar() && /eliminar|borrar|vaciar/i.test(txt)) { aviso('🔒 Tu rol no permite eliminar'); return Promise.resolve(false); }
        return cb.apply(this, arguments);
      };
      envCb._lexRol = true; window.confirmarBonito = envCb;
      try { confirmarBonito = envCb; } catch(_){}
    }
    if (!window.confirm._lexRol) {
      var cf = window.confirm;
      var envCf = function(m){
        if (!puedeBorrar() && /eliminar|borrar/i.test(String(m || ''))) { aviso('🔒 Tu rol no permite eliminar'); return false; }
        return cf.apply(window, arguments);
      };
      envCf._lexRol = true; window.confirm = envCf;
    }
  }

  // ── Pasada periódica: solo-ve, botones de borrar, montos ocultos ─────────
  var RX_CAMBIO = /(nuev|guardar|eliminar|borrar|editar|✏|agregar|añadir|＋|^\s*\+|marcar|cobrar|avanzar|siguiente etapa|revertir|asignar|subir|vincular|cambiar|registrar|convertir|entregar|archivar|reactivar|lista para entregar)/i;
  var RX_BORRAR = /(eliminar|borrar|vaciar|🗑)/i;
  function ventanasAbiertas(){
    var out = [];
    document.querySelectorAll('.show[id], .modal-ov.show').forEach(function(el){
      if (el.id === 'global-search-results') return;
      if (/^m[A-Z]/.test(el.id) || /modal/.test(String(el.className))) out.push(el);
    });
    return out;
  }
  function textoBoton(b){ return (b.textContent || '') + ' ' + (b.getAttribute('title') || ''); }
  function ocultar(el){ if (!el.classList.contains('lex-rol-oculto')) { el.classList.add('lex-rol-oculto'); el.setAttribute('data-lex-rol-hid', '1'); } }
  function restaurarTodo(){
    document.querySelectorAll('[data-lex-rol-hid]').forEach(function(el){ el.classList.remove('lex-rol-oculto'); el.removeAttribute('data-lex-rol-hid'); });
    document.querySelectorAll('[data-lex-rol-ro]').forEach(function(el){ el.readOnly = false; el.disabled = false; el.removeAttribute('data-lex-rol-ro'); });
  }
  function esControlDeBusqueda(b){ return b.classList.contains('lex-bx-btn') || b.classList.contains('modal-x') || b.closest('.nav') || b.closest('#global-search-wrap'); }
  var RX_MONTO = /\$\s?-?\d[\d,]*(\.\d+)?/g;
  function ocultarMontos(raiz){
    try {
      var w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, null), n, lista = [];
      while ((n = w.nextNode())) { if (RX_MONTO.test(n.nodeValue)) lista.push(n); RX_MONTO.lastIndex = 0; }
      lista.forEach(function(t){
        var p = t.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) return;
        t.nodeValue = t.nodeValue.replace(RX_MONTO, '$ •••');
      });
    } catch(_){}
  }
  var _rolAnterior = null;
  function pasada(){
    var r = rol();
    if (r !== _rolAnterior) { restaurarTodo(); _rolAnterior = r; }
    document.body.classList.toggle('lex-rol-sinmontos', !!SIN_MONTOS[r]);
    ['recepcionista', 'abogado', 'consultor'].forEach(function(x){ document.body.classList.toggle('lex-rol-' + x, r === x); });
    aplicarMenu(); aplicarChip(); envolverIr(); envolverFunciones();
    try { pintarInicio(); } catch(e){ console.warn('[Roles] inicio', e); }
    if (!PERM[r]) { restaurarTodo(); quitarBanners(); return; }
    var pa = panelActivo();
    if (pa && permiso(pa) === '-') { try { window.ir('caja'); } catch(_){} return; }
    var soloVe = permiso(pa) === 'r';
    var panelEl = document.getElementById('panel-' + pa);
    var zonas = ventanasAbiertas(); if (panelEl) zonas.unshift(panelEl);
    // Volver a mostrar lo que se ocultó si ya no aplica (p. ej. cambió de sección)
    if (!soloVe) document.querySelectorAll('[data-lex-rol-hid]').forEach(function(el){
      if (!puedeBorrar() && RX_BORRAR.test(textoBoton(el))) return;
      el.classList.remove('lex-rol-oculto'); el.removeAttribute('data-lex-rol-hid');
    });
    if (!soloVe) document.querySelectorAll('[data-lex-rol-ro]').forEach(function(el){ el.readOnly = false; el.disabled = false; el.removeAttribute('data-lex-rol-ro'); });
    zonas.forEach(function(z){
      z.querySelectorAll('button, .btn, [role="button"]').forEach(function(b){
        if (esControlDeBusqueda(b)) return;
        var t = textoBoton(b);
        if (!puedeBorrar() && RX_BORRAR.test(t)) { ocultar(b); return; }
        if (soloVe && RX_CAMBIO.test(t)) ocultar(b);
      });
    });
    // En "solo ve", los campos de las ventanas abiertas quedan de solo lectura
    if (soloVe) ventanasAbiertas().forEach(function(v){
      v.querySelectorAll('input, textarea, select').forEach(function(i){
        var t = String(i.type || '').toLowerCase();
        if (t === 'search' || /Q$|buscar/i.test(i.id || '') || i.hasAttribute('data-lex-rol-ro')) return;
        if (i.tagName === 'SELECT' || t === 'checkbox' || t === 'radio') i.disabled = true; else i.readOnly = true;
        i.setAttribute('data-lex-rol-ro', '1');
      });
    });
    // Aviso "Modo consulta" arriba de la sección
    quitarBanners(soloVe ? panelEl : null);
    if (soloVe && panelEl && !panelEl.querySelector(':scope > .lex-rol-banner')) {
      var bn = document.createElement('div'); bn.className = 'lex-rol-banner';
      bn.innerHTML = '👁 <b>Modo consulta</b> · Tu rol (' + (NOMBRE[r] || r) + ') solo permite ver esta sección.';
      panelEl.insertBefore(bn, panelEl.firstChild);
    }
    if (SIN_MONTOS[r]) { if (panelEl) ocultarMontos(panelEl); ventanasAbiertas().forEach(ocultarMontos); var gs = document.getElementById('global-search-results'); if (gs) ocultarMontos(gs); }
  }
  function quitarBanners(salvo){ document.querySelectorAll('.lex-rol-banner').forEach(function(b){ if (!salvo || b.parentNode !== salvo) b.remove(); }); }
  window.lexRolAplicar = pasada;

  var _t = null;
  function programar(){ if (_t) return; _t = setTimeout(function(){ _t = null; try { pasada(); } catch(e){ console.warn('[Roles]', e); } }, 250); }
  try { new MutationObserver(function(){ if (PERM[rol()]) programar(); }).observe(document.documentElement, { childList: true, subtree: true }); } catch(_){}
  setInterval(function(){ try { pasada(); } catch(_){} }, 2000);

  // ── Cambio de rol en vivo ────────────────────────────────────────────────
  var _canal = null;
  function engancharCanal(){
    var ch = window._lexRealtimeChannel;
    if (!ch || ch === _canal || typeof ch.on !== 'function') return;
    _canal = ch;
    try { ch.on('broadcast', { event: 'rol_actualizado' }, function(p){
      var pl = p && p.payload; if (!pl || !pl.email) return;
      if (String(pl.email).toLowerCase() === email()) releerMiRol(true);
    }); } catch(_){}
  }
  async function releerMiRol(avisar){
    try {
      if (!window.SB || !window.SB_DESPACHO_ID || !email()) return;
      var u = await window.SB.auth.getUser();
      var uid = u && u.data && u.data.user && u.data.user.id; if (!uid) return;
      var q = await window.SB.from('miembros').select('rol,nombre').eq('user_id', uid).eq('despacho_id', window.SB_DESPACHO_ID).limit(1);
      var nuevo = q && q.data && q.data[0] && q.data[0].rol;
      aplicarMiNombre(q && q.data && q.data[0] && q.data[0].nombre);
      if (nuevo && nuevo !== window.SB_ROL_ACTUAL) {
        window.SB_ROL_ACTUAL = nuevo;
        pasada();
        if (avisar !== false) { try { if (typeof toast === 'function') toast('👤 Tu rol ahora es: ' + (NOMBRE[nuevo] || nuevo), 'ok'); } catch(_){} }
      }
    } catch(e){ console.warn('[Roles] releer', e); }
  }
  // Nombre del empleado: el que el administrador le puso en Gestión de Accesos
  // (columna nombre de miembros). "Administrador" es el genérico de la cuenta
  // principal y no reemplaza a "LIC NAHUM PELAEZ".
  function aplicarMiNombre(nom){
    nom = String(nom || '').trim();
    if (!nom || /^administrador$/i.test(nom) || typeof empleadoActual === 'undefined' || !empleadoActual) return;
    if (empleadoActual.nombre === nom) return;
    var antes = empleadoActual.nombre;
    empleadoActual.nombre = nom;
    try { if (typeof EMPLEADOS !== 'undefined' && EMPLEADOS) EMPLEADOS[email()] = nom; } catch(_){}
    try { localStorage.setItem('empleado_nombre', nom); } catch(_){}
    if (antes) { try { if (typeof toast === 'function') toast('👤 Tu nombre ahora es: ' + nom, 'ok'); } catch(_){} }
  }
  setInterval(function(){ engancharCanal(); releerMiRol(true); }, 60000);
  setTimeout(function(){ engancharCanal(); releerMiRol(false); }, 3000);

  // ── Gestión de Accesos: lista desplegable de rol ─────────────────────────
  function envolverGestion(){
    var orig = window._renderGestionAccesos;
    if (typeof orig !== 'function' || orig._lexRol) return;
    var env = function(){
      var r = orig.apply(this, arguments);
      try { pintarSelects(); } catch(e){ console.warn('[Roles] gestión', e); }
      return r;
    };
    env._lexRol = true;
    window._renderGestionAccesos = env;
    try { _renderGestionAccesos = env; } catch(_){}
  }
  // Nov-2026: cada renglón se ve fijo; con "Editar" se abren nombre y rol, y
  // "Guardar" guarda los dos juntos (ya no se guarda nada solo con elegir).
  var _gaEditando = null;
  var BTN = 'padding:5px 10px;border-radius:6px;font-size:0.72rem;cursor:pointer;margin-right:6px;';
  function pintarSelects(){
    var tbody = document.getElementById('ga-tbody'); if (!tbody) return;
    Array.prototype.forEach.call(tbody.children, function(tr){
      if (tr.id) return;   // renglones ocultos de contraseña / tiempo extra
      var b = tr.querySelector('[onclick*="_gaTogglePassRow("]'); if (!b) return;
      var i = parseInt((/_gaTogglePassRow\((\d+)\)/.exec(b.getAttribute('onclick')) || [])[1], 10);
      var u = (window._gaUsuarios || [])[i]; if (!u) return;
      var tdN = tr.children[1], tdR = tr.children[2], tdA = tr.children[4];
      var rr = String(u.rol || '').toLowerCase(); if (rr === 'empleado' || !rr) rr = 'operador';
      var esAdm = rr === 'admin';
      if (tdR) tdR.style.textTransform = 'none';
      if (_gaEditando === i && !esAdm) {
        tdN.innerHTML = '<input id="lex-ga-nom-' + i + '" value="' + h(u.nombre || '') + '" maxlength="80" style="width:100%;max-width:280px;padding:6px 8px;border:1.5px solid #c8952a;border-radius:7px;font-size:0.82rem;box-sizing:border-box;" '
          + 'onkeydown="if(event.key===\'Enter\'){event.preventDefault();lexGaGuardarFila(' + i + ');}if(event.key===\'Escape\'){event.preventDefault();lexGaCancelarFila();}">';
        tdR.innerHTML = '<select id="lex-ga-rol-' + i + '" style="padding:6px 8px;border:1.5px solid #c8952a;border-radius:7px;background:#fff;color:#2a1a06;font-size:0.8rem;cursor:pointer;min-width:140px;">'
          + ASIGNABLES.map(function(x){ return '<option value="' + x + '"' + (x === rr ? ' selected' : '') + '>' + NOMBRE[x] + '</option>'; }).join('') + '</select>';
        tr.style.background = '#fff8ec';
        if (tdA && !tdA.querySelector('.lex-ga-acc')) {
          var sp = document.createElement('span'); sp.className = 'lex-ga-acc';
          sp.innerHTML = '<button type="button" onclick="lexGaGuardarFila(' + i + ')" style="' + BTN + 'border:none;background:#8c6518;color:#fff;">💾 Guardar</button>'
            + '<button type="button" onclick="lexGaCancelarFila()" style="' + BTN + 'border:1px solid #d4b870;background:none;color:#8c6518;">Cancelar</button>';
          tdA.insertBefore(sp, tdA.firstChild);
        }
        var inp = document.getElementById('lex-ga-nom-' + i); if (inp && !inp._foco) { inp._foco = true; setTimeout(function(){ inp.focus(); }, 30); }
        return;
      }
      tdN.textContent = u.nombre || '—';
      tdR.innerHTML = esAdm
        ? '<span style="display:inline-block;padding:3px 10px;border-radius:10px;background:#FAEEDA;color:#633806;font-size:0.74rem;font-weight:700;">🛡 Administrador</span>'
        : '<span style="display:inline-block;padding:3px 10px;border-radius:10px;background:' + (COLOR[rr] || COLOR.operador)[0] + ';color:' + (COLOR[rr] || COLOR.operador)[1] + ';font-size:0.74rem;font-weight:700;">' + (NOMBRE[rr] || rr) + '</span>';
      if (tdA && !esAdm && !tdA.querySelector('.lex-ga-acc')) {
        var sp2 = document.createElement('span'); sp2.className = 'lex-ga-acc';
        sp2.innerHTML = '<button type="button" onclick="lexGaEditarFila(' + i + ')" style="' + BTN + 'border:1px solid #c8952a;background:none;color:#8c6518;">✏️ Editar</button>';
        tdA.insertBefore(sp2, tdA.firstChild);
      }
    });
    pintarAlta();
  }
  window.lexGaEditarFila = function(i){ _gaEditando = i; window._renderGestionAccesos(); };
  window.lexGaCancelarFila = function(){ _gaEditando = null; window._renderGestionAccesos(); };
  function avisarEnVivoRol(u, rolNuevo){
    var ch = window._lexRealtimeChannel;
    if (ch && ch.state === 'joined') { try { ch.send({ type:'broadcast', event:'rol_actualizado', payload:{ email:String(u.email).toLowerCase(), rol:rolNuevo || null, ts:Date.now() } }).catch(function(){}); } catch(_){} }
  }
  window.lexGaGuardarFila = async function(i){
    var u = (window._gaUsuarios || [])[i]; if (!u) return;
    var inp = document.getElementById('lex-ga-nom-' + i), sel = document.getElementById('lex-ga-rol-' + i);
    if (!inp || !sel) return;
    var nom = String(inp.value || '').trim().replace(/\s+/g, ' ');
    var actual = String(u.rol || 'operador').toLowerCase(); if (actual === 'empleado') actual = 'operador';
    var nuevoRol = sel.value;
    if (nom.length < 2) { aviso('⚠ Escribe el nombre'); inp.focus(); return; }
    var cambiaNom = nom !== String(u.nombre || ''), cambiaRol = nuevoRol !== actual;
    if (!cambiaNom && !cambiaRol) { window.lexGaCancelarFila(); return; }
    if (cambiaRol) {
      var msg = '¿Cambiar a ' + (nom || u.email) + ' de ' + (NOMBRE[actual] || actual) + ' a ' + NOMBRE[nuevoRol] + '?';
      var ok = false;
      try { ok = (typeof confirmarBonito === 'function') ? await confirmarBonito({ titulo: 'Cambiar rol', mensaje: msg, btnSi: 'Sí, cambiar', btnNo: 'Cancelar' }) : window.confirm(msg); } catch(_){ ok = false; }
      if (!ok) return;
    }
    inp.disabled = true; sel.disabled = true;
    try {
      if (cambiaNom) {
        var r1 = await window.SB.rpc('lex_cambiar_nombre_miembro', { p_despacho: window.SB_DESPACHO_ID, p_user_id: u.userId, p_nombre: nom });
        if (r1 && r1.error) throw r1.error;
        u.nombre = nom;
        if (String(u.email).toLowerCase() === email()) aplicarMiNombre(nom);
      }
      if (cambiaRol) {
        var r2 = await window.SB.rpc('lex_asignar_rol', { p_despacho: window.SB_DESPACHO_ID, p_user_id: u.userId, p_rol: nuevoRol });
        if (r2 && r2.error) throw r2.error;
        u.rol = nuevoRol;
      }
      avisarEnVivoRol(u, cambiaRol ? nuevoRol : null);
      try { if (typeof toast === 'function') toast('✓ Cambios guardados: ' + (u.nombre || u.email) + (cambiaRol ? ' · ' + NOMBRE[nuevoRol] : ''), 'ok'); } catch(_){}
      _gaEditando = null;
      window._renderGestionAccesos();
    } catch(e){
      inp.disabled = false; sel.disabled = false;
      aviso('❌ No se pudo guardar: ' + (e && e.message || e));
    }
  };

  // ── Dar de alta un correo nuevo (función del servidor lex-alta-usuario) ──
  var CAMPO = 'padding:8px 10px;border:1px solid #d4b870;border-radius:7px;font-size:0.82rem;background:#fff;color:#2a1a06;box-sizing:border-box;width:100%;';
  function pintarAlta(){
    var wrap = document.getElementById('ga-tabla-wrap'); if (!wrap || document.getElementById('lex-ga-alta')) return;
    var d = document.createElement('div'); d.id = 'lex-ga-alta';
    d.style.cssText = 'margin-top:16px;background:#fff;border:1.5px dashed #c8952a;border-radius:10px;padding:14px 16px;';
    d.innerHTML = '<div style="font-weight:700;color:#4a2f08;margin-bottom:10px;font-size:0.9rem;">👤➕ Dar de alta un correo nuevo</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">'
      + '<input id="lex-alta-email" type="email" autocomplete="off" placeholder="correo@gmail.com" style="' + CAMPO + '">'
      + '<input id="lex-alta-nombre" type="text" autocomplete="off" placeholder="Nombre completo" maxlength="80" style="' + CAMPO + '">'
      + '<select id="lex-alta-rol" style="' + CAMPO + 'cursor:pointer;">' + ASIGNABLES.map(function(x){ return '<option value="' + x + '"' + (x === 'recepcionista' ? ' selected' : '') + '>Rol: ' + NOMBRE[x] + '</option>'; }).join('') + '</select>'
      + '<input id="lex-alta-pass" type="password" autocomplete="new-password" placeholder="Contraseña inicial (mín. 6)" style="' + CAMPO + '">'
      + '</div>'
      + '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:12px;">'
      + '<span id="lex-alta-msg" style="font-size:0.76rem;"></span>'
      + '<button type="button" id="lex-alta-btn" onclick="lexGaDarDeAlta()" style="padding:8px 18px;border:none;border-radius:8px;background:#8c6518;color:#fff;font-size:0.8rem;font-weight:700;cursor:pointer;">Dar de alta</button>'
      + '</div>';
    wrap.appendChild(d);
  }
  window.lexGaDarDeAlta = async function(){
    var $v = function(id){ var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
    var msg = document.getElementById('lex-alta-msg'), btn = document.getElementById('lex-alta-btn');
    var setMsg = function(t, ok){ if (msg) { msg.textContent = t; msg.style.color = ok ? '#27500A' : '#a32d2d'; } };
    var correo = $v('lex-alta-email').toLowerCase(), nom = $v('lex-alta-nombre').replace(/\s+/g, ' '), rolN = $v('lex-alta-rol'), pass = (document.getElementById('lex-alta-pass') || {}).value || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { setMsg('⚠ Escribe un correo válido'); return; }
    if (nom.length < 2) { setMsg('⚠ Escribe el nombre'); return; }
    if (pass.length < 6) { setMsg('⚠ La contraseña debe tener al menos 6 caracteres'); return; }
    if ((window._gaUsuarios || []).some(function(x){ return String(x.email || '').toLowerCase() === correo; })) { setMsg('⚠ Ese correo ya está en la lista'); return; }
    var ok = false, txt = '¿Dar de alta a ' + nom + ' (' + correo + ') como ' + NOMBRE[rolN] + '?';
    try { ok = (typeof confirmarBonito === 'function') ? await confirmarBonito({ titulo: 'Dar de alta', mensaje: txt, btnSi: 'Sí, dar de alta', btnNo: 'Cancelar' }) : window.confirm(txt); } catch(_){ ok = false; }
    if (!ok) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Creando…'; }
    setMsg('', true);
    try {
      var r = await window.SB.functions.invoke('lex-alta-usuario', { body: { despacho_id: window.SB_DESPACHO_ID, email: correo, nombre: nom, rol: rolN, password: pass } });
      var data = r && r.data, err = r && r.error;
      if (err) {
        var det = '';
        try { if (err.context && typeof err.context.json === 'function') { var j = await err.context.json(); det = j && j.error; } } catch(_){}
        throw new Error(det || err.message || 'Error');
      }
      if (!data || data.error) throw new Error((data && data.error) || 'Error');
      ['lex-alta-email', 'lex-alta-nombre', 'lex-alta-pass'].forEach(function(id){ var el = document.getElementById(id); if (el) el.value = ''; });
      setMsg('✓ ' + nom + ' ya puede entrar con su correo y la contraseña que le asignó', true);
      try { if (typeof toast === 'function') toast('👤 Alta lista: ' + nom + ' · ' + NOMBRE[rolN], 'ok'); } catch(_){}
      try { if (typeof cargarGestionAccesos === 'function') await cargarGestionAccesos(); } catch(_){}
    } catch(e){
      setMsg('❌ ' + (e && e.message || e));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Dar de alta'; }
    }
  };

  function iniciar(){ envolverGestion(); envolverIr(); envolverFunciones(); try { pasada(); } catch(_){} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  setInterval(envolverGestion, 3000);
})();
