// ── Oct-2026 · BOTÓN ✕ "CERRAR" EN TODAS LAS SECCIONES ─────────────────────
// Un solo botón en la barra superior (a la altura del buscador, a la derecha)
// que aparece en cualquier sección del menú y regresa a Principal (panel
// 'caja'). En Principal no aparece. En "Consulta de folio" tampoco (esa
// pantalla ya tiene su propio "Cerrar consulta").
(function(){
  'use strict';
  if (window._lexCerrarSeccion) return;
  window._lexCerrarSeccion = true;

  function panelActivo(){
    var p = document.querySelector('.content .panel.active');
    return p ? String(p.id || '').replace(/^panel-/, '') : '';
  }
  function actualizar(){
    var b = document.getElementById('lex-cerrar-seccion'); if (!b) return;
    var p = panelActivo();
    var ocultar = !p || p === 'caja' || document.body.classList.contains('modo-consulta');
    b.style.display = ocultar ? 'none' : 'inline-flex';
    // Alinear con el buscador general (misma altura)
    try {
      var sw = document.getElementById('global-search-wrap');
      if (!ocultar && sw && sw.offsetParent && sw.offsetHeight) { b.style.top = (sw.offsetTop + (sw.offsetHeight - 36) / 2) + 'px'; b.style.bottom = 'auto'; }
    } catch(e){}
  }
  function crear(){
    if (document.getElementById('lex-cerrar-seccion')) return;
    var top = document.querySelector('.topbar'); if (!top) return;
    var b = document.createElement('button');
    b.id = 'lex-cerrar-seccion'; b.type = 'button';
    b.title = 'Cerrar esta sección y volver a Principal';
    b.setAttribute('aria-label', 'Cerrar sección');
    b.innerHTML = '<span style="font-size:1rem;line-height:1;">✕</span><span>Cerrar</span>';
    b.style.cssText = 'position:absolute;right:28px;bottom:22px;display:none;align-items:center;gap:7px;height:36px;padding:0 16px;'
      + 'border-radius:20px;border:2px solid rgba(200,149,42,0.55);background:rgba(255,255,255,0.04);color:var(--gold-l);'
      + "font-family:'JetBrains Mono',monospace;font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;transition:all 0.15s;z-index:2;";
    b.onmouseover = function(){ b.style.borderColor = '#e05a5a'; b.style.color = '#f08a8a'; b.style.background = 'rgba(192,22,26,0.12)'; };
    b.onmouseout  = function(){ b.style.borderColor = 'rgba(200,149,42,0.55)'; b.style.color = 'var(--gold-l)'; b.style.background = 'rgba(255,255,255,0.04)'; };
    b.onclick = function(){
      // Cerrar ventanas abiertas de la sección (visor de PDF de cotización / recibo anterior)
      ['lex-cot-pdf', 'lex-sa-pdf'].forEach(function(id){ var v = document.getElementById(id); if (v) v.remove(); });
      if (typeof window.ir === 'function') window.ir('caja');
    };
    top.appendChild(b);
    actualizar();
  }

  function limpiarBusquedas(panel){
    var campos = panel.querySelectorAll('input.search-inp, input[type="search"], input[id$="Q"]');
    var cambiados = [];
    campos.forEach(function(i){
      var t = String(i.type || 'text').toLowerCase();
      if (t !== 'text' && t !== 'search') return;
      if (i.value) { i.value = ''; cambiados.push(i); }
    });
    // Repintar la lista de esa sección sin filtro (ya oculta, no se nota)
    if (cambiados.length) setTimeout(function(){
      cambiados.forEach(function(i){ try { i.dispatchEvent(new Event('input', { bubbles: true })); } catch(e){} });
    }, 0);
  }
  window._lexLimpiarBusquedas = limpiarBusquedas;

  // Envolver ir() para mostrar/ocultar la ✕ al cambiar de sección
  function envolver(){
    if (typeof window.ir !== 'function' || window.ir._lexCerrarSec) return;
    var orig = window.ir;
    var env = function(destino){
      var antes = null; try { antes = document.querySelector('.content .panel.active'); } catch(e){}
      var r = orig.apply(this, arguments);
      try { actualizar(); } catch(e){}
      // Oct-2026: al SALIR de una sección se borra lo que se haya escrito en sus
      // buscadores (ej. "FRAN" en Escrituras); al volver aparece la lista completa.
      try {
        var ahora = document.querySelector('.content .panel.active');
        if (antes && antes !== ahora) limpiarBusquedas(antes);
      } catch(e){}
      return r;
    };
    for (var k in orig) { try { env[k] = orig[k]; } catch(e){} }
    env._lexCerrarSec = true;
    window.ir = env;
  }
  function iniciar(){ crear(); envolver(); actualizar(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  // Por si otra parte del sistema cambia de panel sin pasar por ir() o entra/sale de Consulta
  try {
    new MutationObserver(function(){ actualizar(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  } catch(e){}
  window.addEventListener('resize', actualizar);
  window.lexCerrarSeccionActualizar = actualizar;
})();

// ── Oct-2026 · ✕ PARA BORRAR LA BÚSQUEDA (opción A) EN TODOS LOS BUSCADORES ──
// Una equis pequeña dentro de la casilla, a la derecha. Solo se ve cuando hay
// algo escrito; al tocarla se borra lo buscado y la lista vuelve completa.
(function(){
  'use strict';
  if (window._lexBuscadorX) return;
  window._lexBuscadorX = true;
  var st = document.createElement('style');
  st.textContent = '.lex-bx-wrap{position:relative;box-sizing:border-box;}'
    + '.search-row>.lex-bx-wrap{flex:1;min-width:0;margin:0 !important;}'
    + '.lex-bx-wrap>input{width:100% !important;margin:0 !important;padding-right:34px !important;box-sizing:border-box;}'
    + '.lex-bx-btn{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;border:none;background:#e3d6b4;color:#5a4a2a;font-size:12px;line-height:22px;text-align:center;cursor:pointer;padding:0;display:none;z-index:2;}'
    + '.lex-bx-btn:hover{background:#c8952a;color:#fff;}'
    + '.lex-bx-wrap input[type=search]::-webkit-search-cancel-button{-webkit-appearance:none;display:none;}';
  (document.head || document.documentElement).appendChild(st);

  function esBuscador(i){
    if (!i || i.tagName !== 'INPUT' || i.dataset.lexBx) return false;
    var t = String(i.type || 'text').toLowerCase();
    if (t !== 'text' && t !== 'search') return false;
    if (i.readOnly || i.disabled) return false;
    var ph = String(i.getAttribute('placeholder') || ''), id = String(i.id || ''), cls = String(i.className || '');
    if (id === 'global-search-inp') return false;            // el buscador general tiene su propio manejo
    return /search-inp/.test(cls) || t === 'search' || /buscar|🔍/i.test(ph) || /Q$/.test(id) || /buscar/i.test(id);
  }
  function actualizarX(i){ var b = i && i._lexBx; if (b) b.style.display = String(i.value || '') ? 'block' : 'none'; }
  function poner(i){
    if (!esBuscador(i) || !i.parentNode) return;
    i.dataset.lexBx = '1';
    var cs = window.getComputedStyle ? getComputedStyle(i) : null;
    var w = document.createElement('span');
    w.className = 'lex-bx-wrap';
    // El envoltorio ocupa el mismo lugar que tenía la casilla
    w.style.display = (cs && cs.display === 'block') ? 'block' : 'inline-block';
    if (cs) {
      if (cs.flexGrow && cs.flexGrow !== '0') w.style.flex = cs.flexGrow + ' ' + cs.flexShrink + ' ' + cs.flexBasis;
      w.style.marginTop = cs.marginTop; w.style.marginBottom = cs.marginBottom; w.style.marginLeft = cs.marginLeft; w.style.marginRight = cs.marginRight;
      if (cs.minWidth && cs.minWidth !== 'auto' && cs.minWidth !== '0px') w.style.minWidth = cs.minWidth;
    }
    if (i.style.width) w.style.width = i.style.width; else if (cs && cs.display === 'block') w.style.width = '100%';
    if (i.style.flex) w.style.flex = i.style.flex;
    if (i.style.maxWidth) w.style.maxWidth = i.style.maxWidth;
    i.parentNode.insertBefore(w, i);
    w.appendChild(i);
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'lex-bx-btn'; b.textContent = '✕';
    b.title = 'Borrar búsqueda'; b.setAttribute('aria-label', 'Borrar búsqueda');
    b.addEventListener('mousedown', function(ev){ ev.preventDefault(); });   // no quitar el foco
    b.addEventListener('click', function(ev){
      ev.preventDefault(); ev.stopPropagation();
      i.value = '';
      ['input', 'keyup', 'change'].forEach(function(tipo){ try { i.dispatchEvent(new Event(tipo, { bubbles: true })); } catch(_){} });
      actualizarX(i); i.focus();
    });
    w.appendChild(b);
    i._lexBx = b;
    i.addEventListener('input', function(){ actualizarX(i); });
    actualizarX(i);
  }
  function revisar(raiz){
    try { (raiz && raiz.querySelectorAll ? raiz : document).querySelectorAll('input').forEach(poner); } catch(_){}
  }
  // Cuando el sistema borra una búsqueda por su cuenta (al cambiar de sección), ocultar la ✕
  setInterval(function(){ document.querySelectorAll('input[data-lex-bx]').forEach(actualizarX); }, 1500);
  function iniciar(){
    revisar(document);
    try {
      new MutationObserver(function(muts){
        muts.forEach(function(m){ m.addedNodes && m.addedNodes.forEach(function(n){ if (n.nodeType === 1) { if (n.tagName === 'INPUT') poner(n); else revisar(n); } }); });
      }).observe(document.body, { childList: true, subtree: true });
    } catch(_){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.lexBuscadorXRevisar = revisar;
})();
