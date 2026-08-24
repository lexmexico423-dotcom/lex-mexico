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
