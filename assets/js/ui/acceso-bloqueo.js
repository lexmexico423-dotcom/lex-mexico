// ── Nov-2026 · DESHABILITAR = SACAR DE INMEDIATO A LA EMPLEADA ──────────────
// Problema real (04-nov-2026): el administrador deshabilitó a la empleada y ella
// siguió trabajando. Supabase solo bloquea NUEVOS inicios de sesión; el token
// que ya tenía seguía sirviendo hasta una hora, y la revisión de cada 25 s
// usaba una consulta que solo funciona con la cuenta del administrador, así
// que en la computadora de la empleada nunca se enteraba.
//
// Ahora hay TRES avisos independientes (basta con uno):
//  1. Aviso en vivo: al deshabilitar, el administrador manda un aviso
//     "cuenta_deshabilitada" a todas las computadoras conectadas.
//  2. Lista guardada: el correo queda anotado en D.tiempoExtra.__bloqueados
//     (viaja con la sincronización normal); cada 15 s se revisa.
//  3. Revisión con Supabase: cada 60 s se renueva la sesión; si Supabase
//     responde que la cuenta está bloqueada (banned), se cierra.
// Al administrador nunca se le aplica.
(function(){
  'use strict';
  if (window._lexAccesoBloqueo) return;
  window._lexAccesoBloqueo = true;

  function miEmail(){ try { return String((typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.email) || '').toLowerCase(); } catch(_){ return ''; } }
  function soyAdmin(){
    try {
      if (String(window.SB_ROL_ACTUAL || '').toLowerCase() === 'admin') return true;
      if (typeof empleadoActual !== 'undefined' && empleadoActual && String(empleadoActual.rol || '').toLowerCase() === 'admin') return true;
    } catch(_){}
    return false;
  }
  function bloqueados(){
    try { var t = (typeof D !== 'undefined' && D && D.tiempoExtra) ? D.tiempoExtra.__bloqueados : null; return (t && typeof t === 'object') ? t : {}; } catch(_){ return {}; }
  }
  var _sacando = false;
  function sacar(motivo){
    if (_sacando || soyAdmin() || !miEmail()) return;
    _sacando = true;
    console.warn('[Acceso] cuenta deshabilitada → cerrar sesión (' + motivo + ')');
    if (typeof _forzarCierreSesionPorDeshabilitado === 'function') { try { _forzarCierreSesionPorDeshabilitado(); return; } catch(_){} }
    try { if (window.SB) window.SB.auth.signOut().catch(function(){}); } catch(_){}
    try { localStorage.removeItem('empleado_email'); localStorage.removeItem('empleado_nombre'); } catch(_){}
    location.reload();   // sin mensaje: solo regresa al inicio de sesión
  }

  // 2. Lista guardada
  function revisarLista(){
    var yo = miEmail();
    if (yo && !soyAdmin() && bloqueados()[yo]) sacar('lista de bloqueados');
  }
  // 3. Revisión con Supabase (solo "banned" saca; un error de red no)
  var _ultimaRenov = 0;
  async function revisarSupabase(){
    if (soyAdmin() || !miEmail() || !window.SB || !window.SB.auth) return;
    if (Date.now() - _ultimaRenov < 55000) return;
    _ultimaRenov = Date.now();
    try {
      var r = await window.SB.auth.refreshSession();
      var err = r && r.error;
      if (err && /bann?ed|bloquead/i.test(String(err.message || err.code || ''))) sacar('Supabase: ' + (err.message || err.code));
    } catch(e){
      if (/bann?ed/i.test(String(e && e.message || ''))) sacar('Supabase');
    }
  }
  // 1. Aviso en vivo (se vuelve a enganchar si el canal se reconecta)
  var _canalEnganchado = null;
  function engancharCanal(){
    var ch = window._lexRealtimeChannel;
    if (!ch || ch === _canalEnganchado || typeof ch.on !== 'function') return;
    _canalEnganchado = ch;
    try {
      ch.on('broadcast', { event: 'cuenta_deshabilitada' }, function(p){
        var pl = p && p.payload; if (!pl || !pl.email) return;
        var em = String(pl.email).toLowerCase();
        try {
          if (typeof D !== 'undefined' && D) {
            if (!D.tiempoExtra) D.tiempoExtra = {};
            if (!D.tiempoExtra.__bloqueados || typeof D.tiempoExtra.__bloqueados !== 'object') D.tiempoExtra.__bloqueados = {};
            if (pl.bloqueado) D.tiempoExtra.__bloqueados[em] = pl.ts || Date.now(); else delete D.tiempoExtra.__bloqueados[em];
          }
        } catch(_){}
        if (pl.bloqueado && em === miEmail()) sacar('aviso en vivo');
      });
    } catch(e){ console.warn('[Acceso] canal', e); }
  }
  function avisarEnVivo(email, bloqueado){
    var ch = window._lexRealtimeChannel;
    if (!(ch && ch.state === 'joined')) return;
    try { ch.send({ type:'broadcast', event:'cuenta_deshabilitada', payload:{ email:email, bloqueado:bloqueado, ts:Date.now() } }).catch(function(){}); } catch(_){}
  }

  // Lado del administrador: al habilitar/deshabilitar, anotar y avisar
  function envolverToggle(){
    var orig = window._gaToggleHabilitado;
    if (typeof orig !== 'function' || orig._lexBloqueo) return;
    var env = async function(i){
      var u = (window._gaUsuarios || [])[i];
      var antes = u ? u.habilitado : null;
      var r = await orig.apply(this, arguments);
      try {
        u = (window._gaUsuarios || [])[i];
        if (u && u.email && antes !== null && u.habilitado !== antes) {
          var em = String(u.email).toLowerCase();
          if (!D.tiempoExtra) D.tiempoExtra = {};
          if (!D.tiempoExtra.__bloqueados || typeof D.tiempoExtra.__bloqueados !== 'object') D.tiempoExtra.__bloqueados = {};
          if (u.habilitado === false) D.tiempoExtra.__bloqueados[em] = Date.now(); else delete D.tiempoExtra.__bloqueados[em];
          avisarEnVivo(em, u.habilitado === false);
          try { _ultimoSyncPropio = Date.now(); } catch(_){}
          try { if (typeof syncEstadoSupabase === 'function') await syncEstadoSupabase(); } catch(e){ console.warn('[Acceso] sync', e); }
          if (u.habilitado === false && typeof toast === 'function') toast('🔒 Se le cerrará el sistema en su computadora en unos segundos', 'ok');
        }
      } catch(e){ console.warn('[Acceso] toggle', e); }
      return r;
    };
    env._lexBloqueo = true;
    window._gaToggleHabilitado = env;
    try { _gaToggleHabilitado = env; } catch(_){}
  }

  function tick(){ engancharCanal(); envolverToggle(); revisarLista(); revisarSupabase(); }
  setInterval(tick, 15000);
  setTimeout(tick, 4000);
  document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'visible') { _ultimaRenov = 0; tick(); } });
  window.lexAccesoRevisar = tick;
})();
