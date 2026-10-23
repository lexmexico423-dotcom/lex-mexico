// ── Oct-2026 · SINCRONIZACIÓN EN VIVO ENTRE COMPUTADORAS ──────────────
// Caso real: la Lic. Antonieta resolvió una tarea y en la computadora del
// Lic. Nahúm (abierta, 3 horas sin tocar) seguía viéndose pendiente.
// Causas que se corrigen aquí:
//  1) Al bajar datos nuevos no se volvían a dibujar Tareas para hoy,
//     Escrituras ni Cobranza → lexRefrescarVistas() repinta TODO lo visible
//     (sin tocar lo que el usuario esté escribiendo).
//  2) Avisos de otra computadora que se descartaban (enfriamiento de 800 ms,
//     "guardé hace menos de 30 s", "bajada en curso") → lexPedirSync() los
//     junta y los procesa en cuanto se puede; ninguno se pierde.
//  3) El canal en vivo se caía (suspensión, internet) y no se reconectaba
//     → lexRealtimeReconectar() lo reconecta solo.
//  4) Al volver a la computadora (foco, internet, pestaña visible) se revisa
//     de inmediato si hubo cambios (solo se consulta el número de versión).
// No muestra avisos: solo mantiene la información al día.
(function(){
  'use strict';
  if (window.lexPedirSync) return;

  // ── 1. Repintar todo lo visible ───────────────────────────────────────
  var VISTAS = ['renderHistorial','renderCaja','renderContab','badges','hjRenderTerminos','hjRenderLista',
    'renderVencimientos','renderPend','renderJuicios','renderCitas','gestFiltrar','escRender',
    'renderTareasHoyLista','renderTareasHoyCount','renderAdeudosLista','_cobranzaRefrescar','_lexRAPintar'];
  // ¿El usuario está escribiendo en un campo? (no se repinta para no borrarle nada)
  function escribiendo(){
    var el = document.activeElement;
    if (!el || el === document.body) return false;
    var tag = (el.tagName || '').toUpperCase();
    if (!(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable)) return false;
    var tipo = String(el.type || '').toLowerCase();
    if (tipo === 'checkbox' || tipo === 'radio' || tipo === 'button' || tipo === 'submit') return false;
    // Los buscadores sí se pueden quedar con foco: la lista se repinta con el mismo filtro
    var id = String(el.id || '') + ' ' + String(el.placeholder || '');
    if (tipo === 'search' || /buscar|busca|search|filtro/i.test(id) || /Q$/.test(el.id || '')) return false;
    // Un campo escondido (ventana cerrada) no cuenta como "escribiendo"
    try {
      for (var n = el; n && n !== document.body; n = n.parentElement) {
        var cs = window.getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      }
    } catch(e){}
    return true;
  }
  var _tRefresco = null, _esperandoBlur = false;
  function refrescarAhora(){
    _tRefresco = null;
    if (escribiendo()) {
      if (_esperandoBlur) return;
      _esperandoBlur = true;
      var el = document.activeElement;
      var alSalir = function(){ el.removeEventListener('blur', alSalir); _esperandoBlur = false; setTimeout(refrescarAhora, 300); };
      el.addEventListener('blur', alSalir);
      return;
    }
    var y = window.scrollY;
    VISTAS.forEach(function(n){
      try { if (typeof window[n] === 'function') window[n](); } catch(e){ console.warn('[SyncVivo] ' + n + ':', e); }
    });
    try { if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y); } catch(e){}
  }
  window.lexRefrescarVistas = function(){
    if (_tRefresco) clearTimeout(_tRefresco);
    _tRefresco = setTimeout(refrescarAhora, 250);
  };

  // ── 2. Pedir una bajada de datos (se juntan, ninguna se pierde) ──────
  var _pendiente = false, _enCurso = false, _tSync = null;
  function ocupado(){
    try {
      if (typeof _syncEnCurso !== 'undefined' && _syncEnCurso) return true;
      if (typeof _sincronizando !== 'undefined' && _sincronizando && (Date.now() - (_sincronizandoTs || 0)) < 15000) return true;
      if (window._lexDatosFrescosPendiente) return true;
    } catch(e){}
    return false;
  }
  async function revActual(){
    try {
      var r = await window.SB.from('app_state').select('rev').eq('despacho_id', window.SB_DESPACHO_ID).maybeSingle();
      return (r && r.data && typeof r.data.rev === 'number') ? r.data.rev : null;
    } catch(e){ return null; }
  }
  async function correr(){
    _tSync = null;
    if (!_pendiente) return;
    if (!window.SB || !window.SB_DESPACHO_ID || typeof sincronizarFolio !== 'function') { _pendiente = false; return; }
    if (_enCurso || ocupado()) { _tSync = setTimeout(correr, 1500); return; }
    _pendiente = false; _enCurso = true;
    var ok = false;
    try {
      var rev = await revActual();
      await sincronizarFolio(true);
      ok = true;
      try { if (rev !== null && typeof _lexUltimaRevConocida !== 'undefined') _lexUltimaRevConocida = rev; } catch(e){}
    } catch(e) {
      console.warn('[SyncVivo] bajada:', e);
      _pendiente = true;
    } finally { _enCurso = false; }
    if (ok) window.lexRefrescarVistas();
    if (_pendiente && !_tSync) _tSync = setTimeout(correr, 3000);
  }
  window.lexPedirSync = function(motivo){
    _pendiente = true;
    if (_tSync) return;
    _tSync = setTimeout(correr, 1200);
  };

  // ── 3. Reconectar el canal en vivo si se cae ─────────────────────────
  var _tRecon = null, _intentos = 0;
  window._lexRtFueReconexion = false;
  window.lexRealtimeReconectar = function(ch){
    if (typeof _lexRealtimeChannel === 'undefined' || !ch || _lexRealtimeChannel !== ch) return; // desconexión intencional
    if (_tRecon) return;
    _intentos++;
    var espera = Math.min(60000, 5000 * Math.pow(2, _intentos - 1));
    console.log('[SyncVivo] Canal en vivo caído — reconectando en ' + Math.round(espera / 1000) + ' s');
    _tRecon = setTimeout(function(){
      _tRecon = null;
      if (_lexRealtimeChannel !== ch) return; // se cerró sesión o ya se reconectó
      _lexRealtimeChannel = null;            // primero soltar la referencia (evita bucle con el aviso CLOSED)
      try { window.SB.removeChannel(ch); } catch(e){}
      window._lexRtFueReconexion = true;
      try { if (typeof lexRealtimeConectar === 'function') lexRealtimeConectar(); } catch(e){ console.warn('[SyncVivo] reconectar:', e); }
    }, espera);
  };
  window.lexRealtimeConectado = function(){
    _intentos = 0;
    if (window._lexRtFueReconexion) { window._lexRtFueReconexion = false; window.lexPedirSync('reconexion'); }
  };

  // ── 4. Al volver a la computadora: revisar de inmediato ──────────────
  var _ultRevision = 0;
  async function revisarAhora(){
    if (!window.SB || !window.SB_DESPACHO_ID) return;
    if (Date.now() - _ultRevision < 5000) return;
    _ultRevision = Date.now();
    try {
      if (typeof _lexRealtimeChannel !== 'undefined' && _lexRealtimeChannel) {
        var st = _lexRealtimeChannel.state;
        if (st && st !== 'joined' && st !== 'joining') window.lexRealtimeReconectar(_lexRealtimeChannel);
      }
    } catch(e){}
    try {
      if (typeof _lexHayCambiosPendientes === 'function' && await _lexHayCambiosPendientes()) window.lexPedirSync('volver');
    } catch(e){}
  }
  window.addEventListener('focus', revisarAhora);
  window.addEventListener('online', function(){ _ultRevision = 0; revisarAhora(); });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) revisarAhora(); });
  window._lexSyncVivoRevisar = revisarAhora;
})();
