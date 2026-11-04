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
    consultor:     { caja:'r', contabilidad:'-', recibos:'-', 'nuevo-recibo':'-', 'busqueda-cliente':'-', 'pre-recibo':'-', 'recibos-anteriores':'-', 'adeudos-sin-recibo':'-',
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
  function aplicarChip(){
    var u = document.getElementById('topbar-usuario-txt'); if (!u) return;
    var c = document.getElementById('lex-rol-chip');
    if (!email()) { if (c) c.remove(); return; }
    if (!c) { c = document.createElement('span'); c.id = 'lex-rol-chip'; u.parentNode.insertBefore(c, u.nextSibling); }
    var r = rol(), col = COLOR[r] || COLOR.operador;
    c.textContent = NOMBRE[r] || r; c.style.background = col[0]; c.style.color = col[1];
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
      var q = await window.SB.from('miembros').select('rol').eq('user_id', uid).eq('despacho_id', window.SB_DESPACHO_ID).limit(1);
      var nuevo = q && q.data && q.data[0] && q.data[0].rol;
      if (nuevo && nuevo !== window.SB_ROL_ACTUAL) {
        window.SB_ROL_ACTUAL = nuevo;
        pasada();
        if (avisar !== false) { try { if (typeof toast === 'function') toast('👤 Tu rol ahora es: ' + (NOMBRE[nuevo] || nuevo), 'ok'); } catch(_){} }
      }
    } catch(e){ console.warn('[Roles] releer', e); }
  }
  setInterval(function(){ engancharCanal(); releerMiRol(true); }, 60000);
  setTimeout(function(){ engancharCanal(); }, 3000);

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
  function pintarSelects(){
    var tbody = document.getElementById('ga-tbody'); if (!tbody) return;
    Array.prototype.forEach.call(tbody.children, function(tr){
      if (tr.id) return;   // renglones ocultos de contraseña / tiempo extra
      var b = tr.querySelector('[onclick*="_gaTogglePassRow("]'); if (!b) return;
      var i = parseInt((/_gaTogglePassRow\((\d+)\)/.exec(b.getAttribute('onclick')) || [])[1], 10);
      var u = (window._gaUsuarios || [])[i]; var td = tr.children[2]; if (!u || !td) return;
      var rr = String(u.rol || '').toLowerCase();
      if (rr === 'admin') {
        td.innerHTML = '<span style="display:inline-block;padding:3px 10px;border-radius:10px;background:#FAEEDA;color:#633806;font-size:0.74rem;font-weight:700;">🛡 Administrador</span>';
        return;
      }
      if (rr === 'empleado' || !rr) rr = 'operador';
      td.style.textTransform = 'none';
      td.innerHTML = '<select onchange="lexGaCambiarRol(' + i + ',this)" style="padding:6px 8px;border:1.5px solid #c8952a;border-radius:7px;background:#fff;color:#2a1a06;font-size:0.8rem;cursor:pointer;min-width:140px;">'
        + ASIGNABLES.map(function(x){ return '<option value="' + x + '"' + (x === rr ? ' selected' : '') + '>' + NOMBRE[x] + '</option>'; }).join('')
        + '</select>';
    });
  }
  window.lexGaCambiarRol = async function(i, sel){
    var u = (window._gaUsuarios || [])[i]; if (!u || !sel) return;
    var actual = String(u.rol || 'operador').toLowerCase(); if (actual === 'empleado') actual = 'operador';
    var nuevo = sel.value;
    if (nuevo === actual) return;
    var ok = true;
    var msg = '¿Cambiar a ' + (u.nombre || u.email) + ' de ' + (NOMBRE[actual] || actual) + ' a ' + NOMBRE[nuevo] + '?';
    try { ok = (typeof confirmarBonito === 'function') ? await confirmarBonito({ titulo: 'Cambiar rol', mensaje: msg, btnSi: 'Sí, cambiar', btnNo: 'Cancelar' }) : window.confirm(msg); } catch(_){ ok = false; }
    if (!ok) { sel.value = actual; return; }
    sel.disabled = true;
    try {
      var r = await window.SB.rpc('lex_asignar_rol', { p_despacho: window.SB_DESPACHO_ID, p_user_id: u.userId, p_rol: nuevo });
      if (r && r.error) throw r.error;
      u.rol = nuevo;
      var ch = window._lexRealtimeChannel;
      if (ch && ch.state === 'joined') { try { ch.send({ type:'broadcast', event:'rol_actualizado', payload:{ email:String(u.email).toLowerCase(), rol:nuevo, ts:Date.now() } }).catch(function(){}); } catch(_){} }
      try { if (typeof toast === 'function') toast('👤 ' + (u.nombre || u.email) + ' ahora es ' + NOMBRE[nuevo], 'ok'); } catch(_){}
    } catch(e){
      sel.value = actual;
      aviso('❌ No se pudo cambiar el rol: ' + (e && e.message || e));
    } finally { sel.disabled = false; }
  };

  function iniciar(){ envolverGestion(); envolverIr(); envolverFunciones(); try { pasada(); } catch(_){} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  setInterval(envolverGestion, 3000);
})();
