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

  // Envolver ir() para mostrar/ocultar la ✕ al cambiar de sección
  function envolver(){
    if (typeof window.ir !== 'function' || window.ir._lexCerrarSec) return;
    var orig = window.ir;
    var env = function(){ var r = orig.apply(this, arguments); try { actualizar(); } catch(e){} return r; };
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
