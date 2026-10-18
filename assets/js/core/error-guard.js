/* ════════════════════════════════════════
   LOGGER GLOBAL + SAFE EXEC
════════════════════════════════════════ */
window.LEX_ERRORS = [];
// Sello de versión del archivo. Sirve para comprobar de un vistazo si el
// navegador está ejecutando esta copia de index.html o una versión anterior
// guardada en caché / alojada en otro lado. Se muestra en SCANSYS PRO.
window.LEX_BUILD = '2026-08-12-adjuntar-drive';
try{ console.log('%cLEX-MÉXICO · BUILD ' + window.LEX_BUILD, 'background:#1a1008;color:#e8c875;padding:3px 8px;border-radius:4px;font-weight:700'); }catch(e){}
function registrarError(modulo, error, extra = {}) {
  try {
    const payload = {
      fecha: new Date().toISOString(),
      modulo,
      mensaje: error?.message || String(error),
      stack: error?.stack || null,
      extra
    };
    // Usar el console original para no disparar el interceptor SCANSYS y evitar recursión
    const _logFn = (window.__ssOrigConsole && window.__ssOrigConsole.error) || console.error;
    _logFn(`[${modulo}]`, error);
    // SCANSYS envuelve esta función y reenvía el error a _lexPush(), que ya
    // hace su propio push a LEX_ERRORS. Si además empujáramos aquí, cada error
    // aparecería DUPLICADO en el panel "Errores del Sistema".
    if (typeof window._lexPush !== 'function') {
      window.LEX_ERRORS.push(payload);
      if (window.LEX_ERRORS.length > 300) {
        window.LEX_ERRORS.shift();
      }
    }
    if (typeof toast === 'function') {
      toast(`⚠ Error en ${modulo}`, 'err');
    }
  } catch (e) {
    // Silencioso — no llamar console aquí para evitar recursión
  }
}
// Oct-2026 · Errores que antes se ignoraban sin dejar rastro (catch vacíos).
// Ahora quedan anotados en "Errores del Sistema" como advertencia (amarillo), SIN
// avisos en pantalla ni contar en el globo rojo. Cada mensaje distinto se anota
// una sola vez por sesión (las repeticiones solo suman al contador).
window.LEX_SILENCIOSOS = {};
function _lexSil(error) {
  try {
    var msg = (error && (error.message || error)) ? String(error.message || error) : 'error sin mensaje';
    var reg = window.LEX_SILENCIOSOS[msg];
    if (reg) { reg.veces++; return; }
    var stk = (error && error.stack) ? String(error.stack) : '';
    var origen = (stk.split('\n')[1] || '').trim().slice(0, 160);
    window.LEX_SILENCIOSOS[msg] = { veces: 1, origen: origen, fecha: new Date().toISOString() };
    if (typeof window._lexPush === 'function') window._lexPush('warn', 'Error silencioso', msg, stk, { origen: origen });
    else if (Array.isArray(window.LEX_ERRORS)) {
      window.LEX_ERRORS.push({ fecha: new Date().toISOString(), nivel: 'warn', modulo: 'Error silencioso', mensaje: msg.slice(0, 800), stack: stk.split('\n').slice(0, 8).join('\n'), extra: { origen: origen } });
      if (window.LEX_ERRORS.length > 500) window.LEX_ERRORS.shift();
    }
  } catch (_) { /* nunca debe fallar */ }
}
function safeExec(nombre, fn, fallback = null) {
  try {
    return fn();
  } catch (e) {
    registrarError(nombre, e);
    return fallback;
  }
}
async function safeExecAsync(nombre, fn, fallback = null) {
  try {
    return await fn();
  } catch (e) {
    registrarError(nombre, e);
    return fallback;
  }
}
window.addEventListener('error', function(event){
  registrarError('window.error', event.error || event.message, {
    archivo: event.filename,
    linea: event.lineno,
    columna: event.colno
  });
});
window.addEventListener('unhandledrejection', function(event){
  registrarError('Promise Rejection', event.reason);
});
window.addEventListener('online', ()=>{
  if(typeof toast === 'function'){
    toast('🌐 Conexión restaurada', 'ok');
  }
});
window.addEventListener('offline', ()=>{
  if(typeof toast === 'function'){
    toast('📴 Sin conexión', 'err');
  }
});
