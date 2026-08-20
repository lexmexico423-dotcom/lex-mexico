// GESTION DE CORTES DE CAJA - Habilitar / Deshabilitar

function abrirGestionCortesAdmin() {
  if (!adminSesionUsuario) {
    if (typeof toast === 'function') toast('Acceso restringido al administrador', 'err');
    return;
  }
  _renderListaCortes();
  var panel = document.getElementById('gestion-cortes-panel');
  if (panel) { panel.style.display = 'flex'; }
}

function cerrarModalGestionCortes() {
  var panel = document.getElementById('gestion-cortes-panel');
  if (panel) { panel.style.display = 'none'; }
}

function _renderListaCortes() {
  var cortes = (D.cierres || []).filter(function(c){ return c && c.esCorte === true && c.fecha; });
  cortes.sort(function(a,b){ return ((b.fecha||'')+'T'+(b.hora||'')).localeCompare((a.fecha||'')+'T'+(a.hora||'')); });

  var lista = document.getElementById('gestion-cortes-lista');
  var vacio = document.getElementById('gestion-cortes-vacio');

  if (!cortes.length) {
    lista.innerHTML = '';
    vacio.style.display = 'block';
    return;
  }
  vacio.style.display = 'none';

  if (!D.cortesDeshabilitados) D.cortesDeshabilitados = [];
  var deshabilitados = D.cortesDeshabilitados.map(String);

  lista.innerHTML = cortes.map(function(c) {
    var cid = c.fecha + '_' + (c.hora || '00:00');
    var deshabilitado = deshabilitados.indexOf(cid) >= 0;
    var fechaFmt = (function(){
      try {
        var d = new Date(c.fecha + 'T12:00:00');
        return d.toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'long', year:'numeric' });
      } catch(e) { return c.fecha; }
    })();
    var saldoFmt = c.saldoEntregado != null
      ? '$' + (parseFloat(c.saldoEntregado)||0).toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2})
      : '&#8212;';
    var icono     = deshabilitado ? '&#128275;' : '&#128274;';
    var estadoTxt = deshabilitado ? 'DESHABILITADO' : 'HABILITADO';
    var estadoClr = deshabilitado ? '#e89c30' : '#2dba58';
    var estadoBg  = deshabilitado ? 'rgba(232,156,48,0.1)' : 'rgba(45,186,88,0.08)';
    var estadoBdr = deshabilitado ? 'rgba(232,156,48,0.35)' : 'rgba(45,186,88,0.3)';
    var btnTxt    = deshabilitado ? '&#128274; Habilitar' : '&#128275; Deshabilitar';
    var btnBg     = deshabilitado ? 'rgba(45,186,88,0.15)' : 'rgba(192,22,26,0.12)';
    var btnClr    = deshabilitado ? '#2dba58' : '#e85555';
    var btnBdr    = deshabilitado ? 'rgba(45,186,88,0.4)' : 'rgba(192,22,26,0.35)';
    var resp      = c.responsable ? '<span style="font-size:0.58rem;color:var(--muted);">&middot; ' + escHTML(c.responsable) + '</span>' : '';

    return '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;background:' + estadoBg + ';border:1.5px solid ' + estadoBdr + ';transition:all 0.2s;">'
      + '<div style="font-size:1.4rem;flex-shrink:0;">' + icono + '</div>'
      + '<div style="flex:1;min-width:0;">'
        + '<div style="font-family:monospace;font-size:0.72rem;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + fechaFmt.toUpperCase() + ' &nbsp;&middot;&nbsp; ' + (c.hora || '00:00') + '</div>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-top:3px;">'
          + '<span style="font-family:monospace;font-size:0.6rem;font-weight:700;color:' + estadoClr + ';letter-spacing:0.1em;">' + estadoTxt + '</span>'
          + '<span style="font-size:0.58rem;color:var(--muted);">&middot; Saldo entregado: ' + saldoFmt + '</span>'
          + resp
        + '</div>'
      + '</div>'
      + '<button onclick="toggleCorteDeshabilitado(\'' + cid + '\')" style="flex-shrink:0;padding:6px 13px;border-radius:7px;border:1.5px solid ' + btnBdr + ';background:' + btnBg + ';color:' + btnClr + ';font-family:monospace;font-size:0.6rem;font-weight:700;cursor:pointer;white-space:nowrap;transition:all 0.18s;">' + btnTxt + '</button>'
      + '</div>';
  }).join('');
}

function toggleCorteDeshabilitado(cid) {
  if (!D.cortesDeshabilitados) D.cortesDeshabilitados = [];
  var idx = D.cortesDeshabilitados.indexOf(cid);
  if (idx >= 0) {
    D.cortesDeshabilitados.splice(idx, 1);
    if (typeof toast === 'function') toast('Corte habilitado - el periodo vuelve a estar bloqueado', 'ok');
  } else {
    D.cortesDeshabilitados.push(cid);
    if (typeof toast === 'function') toast('Corte deshabilitado - el periodo esta abierto para modificaciones', 'warn');
  }
  if (typeof save === 'function') save();
  if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced().catch(function(){});
  _renderListaCortes();
}

var _esPeriodoCerradoOrig = (typeof esPeriodoCerrado === 'function') ? esPeriodoCerrado : null;
esPeriodoCerrado = function(fecha, hora) {
  if (!_esPeriodoCerradoOrig) return false;
  var cortes = (D.cierres || []).filter(function(c){ return c && c.esCorte === true && c.fecha; });
  if (!cortes.length) return false;
  var deshabilitados = (D.cortesDeshabilitados || []);
  var tsMov = (fecha || '') + 'T' + (hora || '00:00') + ':00';
  return cortes.some(function(c) {
    var tsCorte = c.fecha + 'T' + (c.hora || '00:00') + ':00';
    if (tsMov > tsCorte) return false;
    var cid = c.fecha + '_' + (c.hora || '00:00');
    if (deshabilitados.indexOf(cid) >= 0) return false;
    return true;
  });
};

(function() {
  var _checkInit = function() {
    if (typeof D !== 'undefined' && !D.cortesDeshabilitados) D.cortesDeshabilitados = [];
  };
  setTimeout(_checkInit, 500);
  setTimeout(_checkInit, 2000);
})();

// ── Reubicación estética de "Consultar Folio" junto a Vincular Archivo ──
// Solo aplica visualmente en modo consulta (folio abierto). El campo real
// (#folio_anterior, mismo id, misma función de búsqueda) se mueve de sitio
// según el estado de body.modo-consulta; fuera de consulta regresa exactamente
// a su lugar original en el panel "Consultar Folios y Expedientes". No se creó
// ningún campo nuevo ni se tocó ninguna función de búsqueda.
(function() {
  function _folioAnteriorSync() {
    var wrap  = document.getElementById('folio-anterior-wrapper');
    var slot  = document.getElementById('folio-consulta-slot');
    var oSep  = document.getElementById('folio-o-separador');
    var label = document.getElementById('folio-anterior-label');
    if (!wrap || !slot || !oSep) return;
    // FIX (caso real: al escribir "11" en el buscador solo quedaba el "1" y el
    // cursor se salía del campo): mover #folio-anterior-wrapper de un panel a
    // otro con appendChild/insertBefore es lo que activa este observer (se
    // dispara al entrar/salir de modo-consulta mientras el usuario escribe) —
    // y aunque es el MISMO nodo, el navegador le quita el foco al reinsertarlo
    // en otro punto del DOM. Se guarda el foco (y la posición del cursor, si
    // el navegador la expone) antes de mover el nodo, y se restaura justo
    // después, en el mismo tick — invisible para el usuario.
    var input = document.getElementById('folio_anterior');
    var teniaFoco = !!(input && document.activeElement === input);
    var selStart, selEnd;
    if (teniaFoco) {
      try { selStart = input.selectionStart; selEnd = input.selectionEnd; } catch(e){}
    }
    var enConsulta = document.body.classList.contains('modo-consulta');
    if (enConsulta) {
      if (wrap.parentNode !== slot) slot.appendChild(wrap);
      if (label) label.textContent = '🔢 Consultar Folios';
    } else {
      if (wrap.nextSibling !== oSep || wrap.parentNode !== oSep.parentNode) {
        oSep.parentNode.insertBefore(wrap, oSep);
      }
      if (label) label.textContent = '🔢 Por Número de Folio';
    }
    if (teniaFoco) {
      input.focus();
      if (selStart != null) { try { input.setSelectionRange(selStart, selEnd); } catch(e){} }
    }
  }
  var _moFolioAnt = new MutationObserver(function() { _folioAnteriorSync(); });
  _moFolioAnt.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _folioAnteriorSync);
  } else {
    _folioAnteriorSync();
  }
})();

// ── Igualar la altura de los 4 botones de pago (Pago Total, Pago Parcial,
// Servicio Complementario, Cerrar Consulta) a la altura real de Servicio
// Complementario (el más alto, por su texto en 2 líneas). Solo ajusta alto,
// nunca el ancho ni ninguna función de los botones. ──
(function() {
  function _igualarAltoBotonesPago() {
    var ref = document.querySelector('.btn-serv-comp');
    var otros = document.querySelectorAll('.btn-liquidacion, .btn-pago-parcial, .btn-cerrar-consulta');
    if (!ref || !otros.length) return;
    // Reset para medir la altura natural de referencia sin arrastrar un alto viejo
    ref.style.height = '';
    var h = ref.getBoundingClientRect().height;
    if (!h) return;
    ref.style.height = h + 'px';
    otros.forEach(function(btn) { btn.style.height = h + 'px'; });
  }
  window.addEventListener('load', _igualarAltoBotonesPago);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _igualarAltoBotonesPago);
  } else {
    _igualarAltoBotonesPago();
  }
  setTimeout(_igualarAltoBotonesPago, 300);
  var _moAltoBotones = new MutationObserver(function() { _igualarAltoBotonesPago(); });
  _moAltoBotones.observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
