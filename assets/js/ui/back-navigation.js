// ── Flecha "Atrás" del navegador (oct-2026) ──────────────────────────────
// 1) Los visores de PDF (iframes) ya no crean entradas en el historial del
//    navegador: antes, cada PDF cargado contaba como "página visitada" y la
//    flecha ← solo regresaba el iframe a vacío (PDF en blanco).
// 2) La flecha ← funciona como "Regresar" dentro del sistema:
//    · en Consulta de folio → cierra la consulta;
//    · si se cambió de sección → vuelve a la sección anterior;
//    · si no hay a dónde regresar → se queda (no saca del sistema).
(function(){
  'use strict';
  if (window._lexBackNavLista) return;
  window._lexBackNavLista = true;

  // ── 1) iframes sin historial ──
  // Se desconecta el iframe, se cambia src y se vuelve a insertar en el mismo
  // lugar: la carga inicial de un iframe recién insertado REEMPLAZA en vez de
  // agregar una entrada al historial. Se conserva el mismo elemento (y sus
  // propiedades como _blobUrl), así que el resto del código no nota diferencia.
  try {
    var proto = HTMLIFrameElement.prototype;
    var dSrc = Object.getOwnPropertyDescriptor(proto, 'src');
    var nativoSetAttr = Element.prototype.setAttribute;
    var cambiarSinHistorial = function(el, fijar){
      var padre = el.parentNode;
      if (!el.isConnected || !padre) { fijar(); return; }
      var sig = el.nextSibling;
      padre.removeChild(el);
      try { fijar(); } finally { padre.insertBefore(el, sig); }
    };
    if (dSrc && dSrc.set && dSrc.get) {
      Object.defineProperty(proto, 'src', {
        configurable: true, enumerable: dSrc.enumerable,
        get: dSrc.get,
        set: function(v){ var el = this; cambiarSinHistorial(el, function(){ dSrc.set.call(el, v); }); }
      });
    }
    proto.setAttribute = function(nombre, valor){
      var el = this, args = arguments;
      if (String(nombre).toLowerCase() === 'src') {
        cambiarSinHistorial(el, function(){ nativoSetAttr.apply(el, args); });
        return;
      }
      return nativoSetAttr.apply(el, args);
    };
  } catch(e){ console.warn('[backNav] iframes:', e); }

  // ── 2) Flecha ← como "Regresar" ──
  var pila = [], volviendo = false;
  function panelActual(){
    var p = document.querySelector('.panel.active');
    return p && p.id ? p.id.replace(/^panel-/, '') : '';
  }
  function envolverIr(){
    if (typeof window.ir !== 'function' || window.ir._lexBack) return;
    var orig = window.ir;
    var envuelta = function(p){
      try {
        var prev = panelActual();
        if (!volviendo && prev && p && prev !== p) {
          pila.push(prev);
          if (pila.length > 30) pila.shift();
        }
      } catch(e){}
      return orig.apply(this, arguments);
    };
    envuelta._lexBack = true;
    window.ir = envuelta;
  }
  function ponerGuardia(){
    try {
      if (!history.state || history.state.lexAtras !== 'guardia') history.pushState({ lexAtras: 'guardia' }, '');
    } catch(e){}
  }
  function aviso(msg){ if (typeof toast === 'function') toast(msg, 'err'); }
  function regresar(){
    var b = document.body.classList;
    if (b.contains('modo-edicion-completa') || b.contains('modo-actualizacion')) {
      aviso('Termina o cancela la edición del recibo antes de regresar');
      return;
    }
    if (b.contains('modo-consulta') && typeof cerrarConsulta === 'function') { cerrarConsulta(); return; }
    var actual = panelActual();
    while (pila.length && (pila[pila.length - 1] === actual || !document.getElementById('panel-' + pila[pila.length - 1]))) pila.pop();
    var prev = pila.pop();
    if (prev && typeof window.ir === 'function') {
      volviendo = true;
      try { window.ir(prev); } finally { volviendo = false; }
    }
  }
  window.addEventListener('popstate', function(){
    try { regresar(); } catch(e){ console.warn('[backNav]', e); }
    ponerGuardia();
  });
  // Chrome solo respeta entradas creadas después de que el usuario interactúa:
  // la "guardia" se pone con el primer clic/tecla (y se repone tras cada ←).
  ['pointerdown', 'keydown'].forEach(function(ev){
    document.addEventListener(ev, ponerGuardia, true);
  });
  // Envolver ir() al final, después de que todos los módulos ya la definieron/envolvieron
  function iniciar(){ envolverIr(); setTimeout(envolverIr, 0); }
  if (document.readyState === 'complete') iniciar(); else window.addEventListener('load', iniciar);
})();
