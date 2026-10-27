// ── Oct-2026 · CONFIRMACIONES Y CAMBIOS SIN GUARDAR (todo el sistema) ─────
// A petición del Lic. Nahúm:
//  · Tecla Esc: antes cerraba TODAS las ventanas de golpe y se perdía lo
//    capturado. Ahora, si una ventana tiene cambios sin guardar, pregunta.
//  · Caja rápida (Tenencia, CSF, Copias, Escaneo): confirmar el cobro antes
//    de registrarlo.
//  · Panel de administrador: confirmar antes de modificar un recibo o un
//    movimiento (afecta la contabilidad).
// (Escrituras tiene su propio aviso en ui/escrituras-asistente.js.)
(function(){
  'use strict';
  if (window._lexConfirmaciones) return;
  window._lexConfirmaciones = true;

  function $(id){ return document.getElementById(id); }
  function num(v){ var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
  function ent(v){ var n = parseInt(v, 10); return isNaN(n) || n < 1 ? 1 : n; }
  function mx(n){ try { return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } catch(e){ return '$' + n; } }
  function envolver(nombre, antes){
    var o = window[nombre];
    if (typeof o !== 'function' || o._lexConf) return;
    var w = function(){ try { if (antes.apply(this, arguments) === false) return; } catch(e){ console.warn('[Confirmación ' + nombre + ']', e); } return o.apply(this, arguments); };
    for (var k in o) { try { w[k] = o[k]; } catch(_){} }
    w._lexConf = true; window[nombre] = w;
  }

  // ════════════════ 1) Tecla Esc con cambios sin guardar ════════════════
  // Se marca "con cambios" la ventana en la que el usuario escribe o elige
  // algo; al abrirse de nuevo vuelve a quedar limpia.
  var IGNORAR = { 'mEscritura':1, 'mLogin':1, 'modal-horario-gate':1, 'modal-aviso-programado':1, 'mDocPreview':1, 'modal-confirmar-recibo':1, 'modal-validacion':1, 'modal-anticipo-warn':1, 'modal-drive-desconectado':1 };
  function marcar(ev){
    if (!ev.isTrusted) return;
    var t = ev.target; if (!t || !t.closest) return;
    if (t.type === 'search' || t.type === 'file') return;
    var m = t.closest('.modal-ov, .modal-overlay'); if (!m || !m.id || IGNORAR[m.id]) return;
    m.dataset.lexSucio = '1';
  }
  document.addEventListener('input', marcar, true);
  document.addEventListener('change', marcar, true);
  try {
    new MutationObserver(function(muts){
      muts.forEach(function(mu){
        var m = mu.target;
        if (m && m.classList && m.classList.contains('show') && !(mu.oldValue || '').split(/\s+/).includes('show')) delete m.dataset.lexSucio;
        if (m && m.classList && !m.classList.contains('show')) delete m.dataset.lexSucio;
      });
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  } catch(e){}
  function tituloDe(m){
    var h = m.querySelector('.modal-hdr h3, .modal-hdr h2, h3, h2');
    var t = h ? String(h.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return t || 'la ventana abierta';
  }
  window.lexVentanasConCambios = function(){
    return Array.prototype.filter.call(document.querySelectorAll('.modal-ov.show, .modal-overlay.show'), function(m){ return m.dataset.lexSucio === '1' && !IGNORAR[m.id]; });
  };
  function engancharEsc(){
    var o = window.cerrarModalesAbiertos;
    if (typeof o !== 'function' || o._lexConfEsc) return;
    var w = function(){
      if ($('lex-dlg-cambios')) return;            // ya se está preguntando
      var sucias = window.lexVentanasConCambios();
      if (sucias.length && typeof window.lexDialogoCambios === 'function') {
        var self = this, args = arguments;
        window.lexDialogoCambios({
          cambios: sucias.map(tituloDe), accion: 'cerrar',
          sinGuardar: true,
          onSalir: function(){ sucias.forEach(function(m){ delete m.dataset.lexSucio; }); o.apply(self, args); }
        });
        return;
      }
      return o.apply(this, arguments);
    };
    w._lexConfEsc = true; window.cerrarModalesAbiertos = w;
  }

  // ════════════════ 2) Caja rápida: confirmar el cobro ════════════════
  // Se usa la confirmación nativa (instantánea) para no romper la apertura de
  // la página de Tenencia / WhatsApp, que debe ocurrir en el mismo clic.
  function cobro(concepto, total){
    return confirm('¿Registrar este cobro en CAJA?\n\n' + concepto + '\nTotal: ' + mx(total) + '\n\nAceptar = registrar · Cancelar = regresar');
  }
  function engancharCaja(){
    envolver('registrarTenencia', function(){
      var est = (typeof _tenEstado !== 'undefined') ? _tenEstado : '';
      var p = num(($('ten-precio') || {}).value), c = ent(($('ten-cant') || {}).value);
      if (!est || p <= 0) return true;              // la validación de siempre avisa
      return cobro((c > 1 ? c + '× ' : '') + 'Impresión de Tenencia ' + est, p * c);
    });
    envolver('registrarCSF', function(){
      var p = num(($('csf-precio') || {}).value), n = String(($('csf-nombre') || {}).value || '').trim();
      if (p <= 0) return true;
      return cobro('Constancia de Situación Fiscal' + (n ? ' — ' + n : ''), p);
    });
    envolver('registrarCopias', function(){
      var p = num(($('copias-precio') || {}).value), c = ent(($('copias-cant') || {}).value);
      if (p * c <= 0) return true;
      var tipo = (typeof _copiaTipo !== 'undefined' && _copiaTipo === 'bn') ? 'blanco y negro' : 'color';
      return cobro(c + '× Copia ' + tipo + ' (' + mx(p) + ' c/u)', p * c);
    });
    envolver('registrarEscaneo', function(){
      var p = num(($('escan-precio') || {}).value), c = ent(($('escan-cant') || {}).value);
      if (p * c <= 0) return true;
      var tam = (typeof _escanTam !== 'undefined' && _escanTam === 'carta') ? 'carta' : 'oficio';
      return cobro(c + '× Escaneo ' + tam + ' (' + mx(p) + ' c/u)', p * c);
    });
  }

  // ════════════════ 3) Panel de administrador ════════════════
  function engancharAdmin(){
    envolver('adminGuardarEdicionRecibo', function(){
      var folio = String(($('adminEditFolioRef') || {}).value || '').trim(), letra = String(($('adminEditLetraRef') || {}).value || 'A');
      var nom = String(($('adminEditNombre') || {}).value || '').trim();
      if (!nom) return true;
      return confirm('¿Modificar el RECIBO ' + (folio ? folio + letra : '') + '?\n\nCliente: ' + nom
        + '\nTotal: ' + mx(num(($('adminEditTotal') || {}).value)) + '   ·   Anticipo/abono: ' + mx(num(($('adminEditAnticipo') || {}).value))
        + '\nFecha: ' + String(($('adminEditFecha') || {}).value || '') + ' ' + String(($('adminEditHora') || {}).value || '')
        + '\n\nEste cambio afecta la contabilidad.');
    });
    function confMov(pref){
      var id = String(($(pref + 'MovId') || {}).value || '');
      var m = ((typeof D !== 'undefined' && D.movimientos) || []).filter(function(x){ return x && x.id === id; })[0];
      var monto = parseFloat(($(pref + 'MovMonto') || {}).value);
      if (!m || isNaN(monto) || monto < 0) return true;
      var d = String(($(pref + 'MovDesc') || {}).value || '').trim() || m.descripcion || '';
      var f = String(($(pref + 'MovFecha') || {}).value || m.fecha || ''), h = String(($(pref + 'MovHora') || {}).value || m.hora || '');
      var cambios = [];
      if (Number(m.monto) !== monto) cambios.push('Monto: ' + mx(m.monto) + ' → ' + mx(monto));
      if (d !== (m.descripcion || '')) cambios.push('Descripción: "' + (m.descripcion || '') + '" → "' + d + '"');
      if (f !== (m.fecha || '')) cambios.push('Fecha: ' + (m.fecha || '') + ' → ' + f);
      if (h !== (m.hora || '')) cambios.push('Hora: ' + (m.hora || '') + ' → ' + h);
      return confirm('¿Modificar este MOVIMIENTO de caja?\n\n' + (cambios.length ? cambios.join('\n') : '(sin cambios en monto, descripción, fecha u hora)') + '\n\nEste cambio afecta la contabilidad.');
    }
    envolver('adminGuardarEdicionMov', function(){ return confMov('adminEdit'); });
    envolver('adminGuardarEdicion2Mov', function(){ return confMov('adminEdit2'); });
  }

  // ════════════════ 4) Cerrar una ventana con cambios sin guardar ════════
  // Botón ✕ / Cerrar / Cancelar de las ventanas de captura. Si se escribió algo,
  // pregunta: Guardar y cerrar · Cerrar sin guardar · Regresar.
  var GUARDAR_DE = {
    mCarpeta:'guardarCarpeta', mJuicio:'guardarJuicio', mNuevoAcuerdo:'guardarAcuerdo', mNuevoTermino:'guardarTermino',
    mPendiente:'guardarPend', mContacto:'guardarContacto', mClienteRapido:'gestGuardarCambios', mAgendarCita:'agendarCitaGuardar',
    mTareaEditar:'guardarTareaHoy', mAdeudoEditar:'guardarAdeudo'
  };
  var _guardando = 0;   // mientras una función de guardar trabaja, su propio cierre no pregunta
  function marcarGuardado(fn){
    var o = window[fn]; if (typeof o !== 'function' || o._lexGuardaMod) return;
    var w = function(){
      _guardando++;
      var fin = function(){ _guardando = Math.max(0, _guardando - 1); };
      try { var r = o.apply(this, arguments); if (r && typeof r.then === 'function') { r.then(fin, fin); } else fin(); return r; }
      catch(e){ fin(); throw e; }
    };
    for (var k in o) { try { w[k] = o[k]; } catch(_){} }
    w._lexGuardaMod = true; window[fn] = w;
  }
  function engancharCerrar(){
    Object.keys(GUARDAR_DE).forEach(function(id){ marcarGuardado(GUARDAR_DE[id]); });
    var o = window.cerrar;
    if (typeof o !== 'function' || o._lexConfCerrar) return;
    var w = function(id){
      var m = id && typeof id === 'string' ? $(id) : null;
      if (m && !_guardando && !IGNORAR[id] && m.classList.contains('show') && m.dataset.lexSucio === '1' && typeof window.lexDialogoCambios === 'function' && !$('lex-dlg-cambios')) {
        var self = this, args = arguments, fn = GUARDAR_DE[id];
        window.lexDialogoCambios({
          cambios: [tituloDe(m)], accion: 'cerrar', sinGuardar: !(fn && typeof window[fn] === 'function'),
          onGuardar: function(){ try { window[fn](); } catch(e){ console.warn(e); } },     // guarda (y cierra) con sus validaciones de siempre
          onSalir: function(){ delete m.dataset.lexSucio; o.apply(self, args); }
        });
        return;
      }
      return o.apply(this, arguments);
    };
    for (var k in o) { try { w[k] = o[k]; } catch(_){} }
    w._lexConfCerrar = true; window.cerrar = w;
  }

  // ════════════════ 5) Salir de una sección a media captura ════════════════
  // Generar recibo y Cotizaciones: al regresar a Generar recibo el formulario
  // se limpia solo, así que salir a media captura = perder lo escrito.
  var _reciboSucio = false, _cotEl = null;
  function marcarSecciones(ev){
    if (!ev.isTrusted) return;
    var t = ev.target; if (!t || !t.closest || t.type === 'search') return;
    if (t.closest('#panel-nuevo-recibo')) _reciboSucio = true;
    if (t.closest('#pr-panel-contenido') && $('pr-f-nombre')) _cotEl = $('pr-f-nombre');
  }
  document.addEventListener('input', marcarSecciones, true);
  document.addEventListener('change', marcarSecciones, true);
  function reciboPendiente(){
    if (!_reciboSucio || window._edicionCompletaActiva) return false;
    var pp = $('actions-post-print'); if (pp && pp.style.display !== 'none' && getComputedStyle(pp).display !== 'none') return false;   // ya se imprimió/guardó
    var p = $('panel-nuevo-recibo'); return !!(p && p.classList.contains('active'));
  }
  function cotPendiente(){ var n = $('pr-f-nombre'); return !!(_cotEl && n && _cotEl === n && document.contains(n)); }
  function engancharSecciones(){
    var ol = window.limpiarFormCompleto;
    if (typeof ol === 'function' && !ol._lexConfLimpio) { var wl = function(){ _reciboSucio = false; return ol.apply(this, arguments); }; for (var k in ol) { try { wl[k] = ol[k]; } catch(_){} } wl._lexConfLimpio = true; window.limpiarFormCompleto = wl; }
    var oi = window.ir;
    if (typeof oi === 'function' && !oi._lexConfIr) {
      var wi = function(dest){
        var ev = window.event, porUsuario = !!(ev && ev.isTrusted && /click|keydown|touchend/.test(ev.type));
        var actual = (document.querySelector('.content .panel.active') || {}).id || '';
        var self = this, args = arguments, cambios = [];
        if (porUsuario && actual === 'panel-nuevo-recibo' && dest !== 'nuevo-recibo' && reciboPendiente()) cambios.push('Recibo en captura (Generar recibo)');
        if (porUsuario && actual === 'panel-pre-recibo' && dest !== 'pre-recibo' && cotPendiente()) cambios.push('Cotización en captura');
        if (cambios.length && typeof window.lexDialogoCambios === 'function' && !$('lex-dlg-cambios')) {
          window.lexDialogoCambios({ cambios: cambios, accion: 'salir', sinGuardar: true,
            onSalir: function(){ _reciboSucio = false; _cotEl = null; oi.apply(self, args); } });
          return;
        }
        return oi.apply(this, arguments);
      };
      for (var k2 in oi) { try { wi[k2] = oi[k2]; } catch(_){} }
      wi._lexConfIr = true; window.ir = wi;
    }
    // ✕ / ← del formulario de cotización
    ['_prVolverLista', '_prAbrirFormulario'].forEach(function(n){
      var o = window[n]; if (typeof o !== 'function' || o._lexConfCot) return;
      var w = function(){
        var self = this, args = arguments;
        if (cotPendiente() && typeof window.lexDialogoCambios === 'function' && !$('lex-dlg-cambios')) {
          window.lexDialogoCambios({ cambios: ['Cotización en captura'], accion: 'cerrar', sinGuardar: true, onSalir: function(){ _cotEl = null; o.apply(self, args); } });
          return;
        }
        return o.apply(this, arguments);
      };
      for (var k3 in o) { try { w[k3] = o[k3]; } catch(_){} }
      w._lexConfCot = true; window[n] = w;
    });
    // Guardar cotización = ya no hay pendiente
    var og = window._prGuardarFormulario;
    if (typeof og === 'function' && !og._lexConfCotG) { var wg = function(){ var r = og.apply(this, arguments); if (r) _cotEl = null; return r; }; for (var k4 in og) { try { wg[k4] = og[k4]; } catch(_){} } wg._lexConfCotG = true; window._prGuardarFormulario = wg; }
    window.addEventListener('beforeunload', function(ev){ if (reciboPendiente() || cotPendiente() || window.lexVentanasConCambios().length) { ev.preventDefault(); ev.returnValue = ''; } });
  }

  // ════════════════ 6) Confirmaciones puntuales ════════════════
  function engancharPuntuales(){
    // 14 · "▶ Ya inicié este paso" / "✓ Terminé este paso" (escrituras)
    envolver('escAccionRapidaPaso', function(i, destino){
      var nom = (typeof ESC_PASOS !== 'undefined' && ESC_PASOS[i]) ? ESC_PASOS[i] : ('paso ' + (i + 1));
      return confirm(destino === 'completado'
        ? '¿Marcar como TERMINADO el paso "' + nom + '"?\n\nSe abrirá la ventana para registrarlo.'
        : '¿Confirma que YA INICIÓ el paso "' + nom + '"?\n\nEmpieza a contar su plazo. Se abrirá la ventana para registrarlo.');
    });
    // 15 · Citas
    envolver('agendarCitaGuardar', function(){
      var t = String(($('citaTitulo') || {}).value || '').trim(), f = String(($('citaFecha') || {}).value || ''), h = String(($('citaHora') || {}).value || '');
      if (!t || !f || !h) return true;
      var fl = f; try { fl = new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' }); } catch(_){}
      var c = String(($('citaCliente') || {}).value || '').trim(), l = String(($('citaLugar') || {}).value || '').trim();
      return confirm('¿Guardar esta cita?\n\n' + t + (c ? '\nCliente: ' + c : '') + '\nFecha: ' + fl + '\nHora: ' + h + (l ? '\nLugar: ' + l : ''));
    });
    // 16 · Juicios: solo si cambia el estatus o la audiencia
    envolver('guardarJuicio', function(){
      if (typeof eiJ === 'undefined' || eiJ < 0 || !D.juicios || !D.juicios[eiJ]) return true;
      var j = D.juicios[eiJ], c = [];
      var est = String(($('jEst') || {}).value || ''), aud = String(($('jAud') || {}).value || '');
      if (est !== String(j.estatus || '')) c.push('Estatus: ' + (j.estatus || '—') + ' → ' + (est || '—'));
      if (aud !== String(j.audiencia || '')) c.push('Audiencia: ' + (j.audiencia || '—') + ' → ' + (aud || '—'));
      return !c.length || confirm('¿Guardar estos cambios del juicio de ' + (j.cliente || '') + '?\n\n' + c.join('\n'));
    });
    // 16 · Pendientes (Placas y demás): solo si cambia la fecha límite o el estado de las placas
    envolver('guardarPend', function(){
      if (typeof eiP === 'undefined' || eiP < 0 || !D.pendientes || !D.pendientes[eiP]) return true;
      var p = D.pendientes[eiP], c = [];
      var f = String(($('pFecha') || {}).value || '');
      if (f !== String(p.fechaLimite || '')) c.push('Fecha límite: ' + (p.fechaLimite || '—') + ' → ' + (f || '—'));
      try { if (p.seccion === 'placas' && typeof _pPlacasRecopilar === 'function') { var d = _pPlacasRecopilar(); if (d && String(d.placasEstado || '') !== String(p.placasEstado || '')) c.push('Estado de placas: ' + (p.placasEstado || '—') + ' → ' + (d.placasEstado || '—')); } } catch(_){}
      return !c.length || confirm('¿Guardar estos cambios del pendiente de ' + (p.persona || p.texto || '') + '?\n\n' + c.join('\n'));
    });
  }

  function iniciar(){ engancharEsc(); engancharCaja(); engancharAdmin(); engancharCerrar(); engancharSecciones(); engancharPuntuales(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  setTimeout(iniciar, 1500);   // por si algún módulo se cargó después
})();
