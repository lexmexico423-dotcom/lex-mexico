// ═══════════════════════════════════════════════════════════
// PANEL DE DIAGNÓSTICO EN TIEMPO REAL — LEX-MÉXICO
// Captura console.log/warn/error, fetch a Gemini/Supabase,
// y errores globales. Muestra timestamps y permite copiar reporte.
// ═══════════════════════════════════════════════════════════
(function(){
  const _lexLogs = [];
  let _lexErrCount = 0;
  let _lexFiltroActivo = 'all';
  function _lexTs(){
    const d = new Date();
    return d.toTimeString().substring(0,8)+'.'+String(d.getMilliseconds()).padStart(3,'0');
  }
  function _lexAdd(tipo, tag, msg, extra){
    const entry = { tipo, tag, msg: String(msg), extra: extra||'', ts: _lexTs(), t: Date.now() };
    _lexLogs.push(entry);
    if(tipo === 'err' || tipo === 'warn') _lexErrCount++;
    _lexRenderEntry(entry);
    _lexUpdateBadge();
  }
  function _lexRenderEntry(entry){
    const cont = document.getElementById('lex-diag-logs');
    if(!cont) return;
    // Filtro activo
    const filt = _lexFiltroActivo;
    const visible = filt === 'all'
      || entry.tipo === filt
      || (filt === 'gemini' && entry.tag.toLowerCase().includes('gemini'))
      || (filt === 'supabase' && entry.tag.toLowerCase().includes('supa'))
      || (filt === 'net' && entry.tipo === 'net');
    if(!visible) return;
    const div = document.createElement('div');
    div.className = 'lex-diag-entry ' + entry.tipo;
    div.dataset.tipo = entry.tipo;
    div.dataset.tag = entry.tag.toLowerCase();
    const msgFull = entry.msg + (entry.extra ? ' → ' + entry.extra : '');
    div.innerHTML =
      '<span class="lex-diag-ts">'+entry.ts+'</span>' +
      '<span class="lex-diag-tag">'+entry.tag+'</span>' +
      '<span class="lex-diag-msg">'+_lexEsc(msgFull)+'</span>';
    cont.appendChild(div);
    cont.scrollTop = cont.scrollHeight;
  }
  function _lexEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _lexUpdateBadge(){
    const badge = document.getElementById('lex-diag-badge');
    if(!badge) return;
    const errores = _lexLogs.filter(l => l.tipo === 'err' || l.tipo === 'warn').length;
    badge.textContent = errores > 99 ? '99+' : errores;
    badge.style.display = errores > 0 ? 'block' : 'none';
    const cnt = document.getElementById('lex-diag-count');
    if(cnt) cnt.textContent = _lexLogs.length + ' entradas · ' + errores + ' errores';
  }
  // ── Interceptar console ────────────────────────────────────
  const _origLog   = console.log.bind(console);
  const _origWarn  = console.warn.bind(console);
  const _origError = console.error.bind(console);
  console.log = function(){
    _origLog.apply(console, arguments);
    const msg = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const tag = msg.includes('[Gemini]') ? 'GEMINI' :
                msg.includes('[SB]') || msg.includes('Supabase') ? 'SUPABASE' :
                msg.includes('[OCR') ? 'OCR' : 'LOG';
    const tipo = msg.includes('✅') || msg.includes('OK') ? 'ok' : 'info';
    _lexAdd(tipo, tag, msg);
  };
  console.warn = function(){
    _origWarn.apply(console, arguments);
    const msg = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    const tag = msg.includes('[Gemini]') ? 'GEMINI' :
                msg.includes('[SB]') || msg.includes('Supabase') ? 'SUPABASE' :
                msg.includes('[OCR') ? 'OCR' : 'WARN';
    _lexAdd('warn', tag, msg);
  };
  console.error = function(){
    _origError.apply(console, arguments);
    const msg = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    _lexAdd('err', 'ERROR', msg);
  };
  // ── Interceptar fetch para capturar llamadas a Gemini/Supabase ────
  const _origFetch = window.fetch;
  window.fetch = async function(url, opts){
    const urlStr = String(url);
    const isGemini = urlStr.includes('generativelanguage');
    const isSupa   = urlStr.includes('supabase');
    const isNet    = isGemini || isSupa;
    if(isNet){
      const label = isGemini ? 'GEMINI' : 'SUPABASE';
      const method = (opts?.method || 'GET').toUpperCase();
      // Mostrar qué se está enviando
      let bodyPreview = '';
      if(opts?.body){
        try{
          const b = JSON.parse(opts.body);
          if(isGemini){
            const part0 = b?.contents?.[0]?.parts?.[0];
            const textLen = part0?.text?.length || 0;
            const hasInline = !!part0?.inlineData;
            bodyPreview = 'text:'+textLen+'chars' + (hasInline?' +inlineData':'') + (textLen===0?' ⚠VACÍO':'');
          } else {
            bodyPreview = JSON.stringify(b).substring(0,80);
          }
        }catch(e){ bodyPreview = '(no parseable)'; }
      }
      _lexAdd('net', label, method + ' ' + urlStr.substring(0,60)+'...', bodyPreview);
    }
    let resp;
    try {
      resp = await _origFetch.apply(this, arguments);
    } catch(e) {
      if(isNet) _lexAdd('err', isGemini?'GEMINI':'SUPABASE', '❌ fetch falló: ' + e.message);
      throw e;
    }
    if(isNet){
      const label = isGemini ? 'GEMINI' : 'SUPABASE';
      if(resp.ok){
        _lexAdd('ok', label, '✅ ' + resp.status + ' OK — ' + urlStr.substring(urlStr.lastIndexOf('/')+1, urlStr.lastIndexOf('/')+30));
      } else {
        // Clonar para poder leer el body sin consumirlo
        const clone = resp.clone();
        clone.json().then(err => {
          const msg = err?.error?.message || JSON.stringify(err).substring(0,120);
          _lexAdd('err', label, '❌ HTTP ' + resp.status + ': ' + msg);
        }).catch(()=>{
          _lexAdd('err', label, '❌ HTTP ' + resp.status);
        });
      }
    }
    return resp;
  };
  // ── Capturar errores globales ──────────────────────────────
  window.addEventListener('error', function(e){
    _lexAdd('err', 'JS-ERROR', e.message, (e.filename||'')+':#'+(e.lineno||''));
  });
  window.addEventListener('unhandledrejection', function(e){
    const msg = e.reason?.message || String(e.reason);
    _lexAdd('err', 'PROMISE', '❌ Unhandled rejection: ' + msg);
  });
  // ── API pública ────────────────────────────────────────────
  window.lexDiag = { add: _lexAdd, logs: _lexLogs };
  window.lexDiagToggle = function(){
    const panel = document.getElementById('lex-diag-panel');
    if(panel) panel.classList.toggle('show');
  };
  window.lexDiagFilter = function(chip){
    document.querySelectorAll('.lex-diag-chip').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    _lexFiltroActivo = chip.dataset.filter;
    // Re-renderizar
    const cont = document.getElementById('lex-diag-logs');
    if(!cont) return;
    cont.innerHTML = '';
    _lexLogs.forEach(_lexRenderEntry);
  };
  window.lexDiagLimpiar = function(){
    _lexLogs.length = 0;
    _lexErrCount = 0;
    const cont = document.getElementById('lex-diag-logs');
    if(cont) cont.innerHTML = '';
    _lexUpdateBadge();
  };
  window.lexDiagCopiar = function(){
    const txt = '=== REPORTE DE DIAGNÓSTICO LEX-MÉXICO ===\n'
      + 'Generado: ' + new Date().toLocaleString('es-MX') + '\n'
      + 'URL: ' + window.location.href + '\n'
      + '==========================================\n\n'
      + _lexLogs.map(l =>
          '['+l.ts+'] ['+l.tipo.toUpperCase()+'] ['+l.tag+'] '+l.msg+(l.extra?' → '+l.extra:'')
        ).join('\n');
    navigator.clipboard.writeText(txt).then(()=>{
      if(typeof toast==='function') toast('📋 Reporte copiado al portapapeles','ok');
      else alert('Reporte copiado');
    });
  };
  // Registrar inicio
  _lexAdd('ok', 'SISTEMA', '✅ Panel de diagnóstico iniciado — ' + new Date().toLocaleString('es-MX'));
  _lexAdd('info', 'SISTEMA', 'ℹ Supabase URL: ' + (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL.substring(0,40)+'...' : 'no definida'));
})();
// ═══ VARIABLES GLOBALES — declaradas aquí para evitar errores de inicialización ═══
const CAPTURA_KEY   = 'lex_captura_retroactiva';
const SESIONES_MAX  = 200;   // máx. entradas guardadas en Supabase/localStorage
// ═══ PRODUCCIÓN: console.log y console.info silenciados ═══
// Para reactivar logs durante depuración, comenta las 2 líneas siguientes:
window.console.log = function(){};
window.console.info = function(){};
// console.warn y console.error se mantienen activos para errores reales.
