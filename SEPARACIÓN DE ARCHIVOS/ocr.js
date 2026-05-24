/* ═══════════════════════════════════════════════════════════════
   LEX-MÉXICO · ocr.js
   Módulo OCR — Análisis de documentos judiciales
   Incluye:
     · Motor Gemini Vision (gemini-2.5-flash)
     · Motor Mistral OCR
     · Tesseract.js — todas las páginas
     · PDF.js — extracción de texto digital
     · Prompts jurídicos: urgencia, audiencia, recursos, acciones
     · Google Drive — listado y análisis
     · Configuración OCR inline
   Dependencias: utils.js e ia.js deben cargarse primero
═══════════════════════════════════════════════════════════════ */

// ════════════════════════════════════════════════════════════════════════
//  OCR MODULE — INTEGRADO EN NUEVA ENTRADA DEL HISTORIAL
//  Prefijo "ocrMod" para evitar colisiones con funciones existentes
//  Motor: Gemini 1.5 Flash — Gratis 1500 análisis/día
// ════════════════════════════════════════════════════════════════════════

// ─── Estado del módulo ────────────────────────────────────────────────
let ocrModArchivos  = [];
let ocrModDriveSel  = [];
let ocrModTipoS     = 'Civil';
let ocrModTipoD     = 'Civil';
let ocrModResultado = null;

const OCR_GEMINI_MODEL = 'gemini-2.5-flash';
function ocrGeminiURL(key){ return 'https://generativelanguage.googleapis.com/v1beta/models/'+OCR_GEMINI_MODEL+':generateContent?key='+encodeURIComponent(key); }

// ─── API Key y config ─────────────────────────────────────────────────
// Cache global de la API Key
window._geminiKeyCached = window._geminiKeyCached || '';

// Cargar key desde Supabase a memoria global
async function _cargarYCachearKey(){
  try{
    // Intento rápido desde localStorage antes de tocar Supabase
    const _quickLS = localStorage.getItem('lex-gemini-key')||'';
    if(_quickLS && _quickLS.length > 10 && !window._geminiKeyCached){
      window._geminiKeyCached = _quickLS;
      console.log('[Gemini] ✅ Key (rápida) desde localStorage:', _quickLS.substring(0,8)+'...');
    }
    if(!window.SB){ return; } // SB aún no inicializado — localStorage ya fue revisado
    // Verificar sesión activa antes de consultar
    const { data: sessionData } = await window.SB.auth.getSession();
    if(!sessionData?.session){
      // Sin sesión: intentar desde localStorage como fallback inmediato
      const fromLS = localStorage.getItem('lex-gemini-key')||'';
      if(fromLS && fromLS.length > 10){
        window._geminiKeyCached = fromLS;
        console.log('[Gemini] ✅ Key cargada desde localStorage (sin sesión):', fromLS.substring(0,8)+'...');
      }
      return;
    }
    // Con sesión: consultar Supabase
    // Usar maybeSingle() en lugar de single() para evitar error PGRST116 cuando la fila no existe
    const {data, error} = await window.SB.from('configuracion').select('valor').eq('id','gemini_api_key').maybeSingle();
    if(!error && data && data.valor && data.valor.length > 10){
      window._geminiKeyCached = data.valor.trim();
      // Mantener localStorage sincronizado
      try{ localStorage.setItem('lex-gemini-key', data.valor.trim()); }catch(_){}
      console.log('[Gemini] ✅ Key cargada desde Supabase:', data.valor.substring(0,8)+'...');
      return;
    }
    // Supabase no tiene la fila (o error): intentar localStorage
    const fromLS = localStorage.getItem('lex-gemini-key')||'';
    if(fromLS && fromLS.length > 10){
      window._geminiKeyCached = fromLS;
      console.log('[Gemini] ✅ Key cargada desde localStorage (fallback):', fromLS.substring(0,8)+'...');
      // Persistir en Supabase para la próxima vez
      window.SB.from('configuracion')
        .upsert({id:'gemini_api_key', valor: fromLS, updated_at: new Date().toISOString()})
        .then(()=>console.log('[Gemini] Key sincronizada a Supabase desde localStorage'))
        .catch(()=>{});
      return;
    }
    console.warn('[Gemini] ⚠ API Key no encontrada en Supabase ni en localStorage');
  }catch(e){ console.warn('[Gemini] Error cargando key:', e.message, e); }
}

function ocrModGetKey(){
  // 1. Memoria global (cargada desde Supabase)
  if(window._geminiKeyCached && window._geminiKeyCached.length > 10) return window._geminiKeyCached;
  // 2. Campo visible en pantalla
  const fromInput = (document.getElementById('ocr-cfg-key-inline')?.value||'').trim();
  if(fromInput && fromInput.length > 10){ window._geminiKeyCached = fromInput; return fromInput; }
  // 3. localStorage como último recurso
  const fromLS = localStorage.getItem('lex-gemini-key')||'';
  if(fromLS && fromLS.length > 10){ window._geminiKeyCached = fromLS; return fromLS; }
  return '';
}

// FIX: reintentar la carga de la key hasta que haya sesión activa
// El problema era que se ejecutaba antes de autenticar → query regresaba vacía
(function _intentarCargarKey(intento){
  // PASO 0: si ya está en caché, no hacer nada
  if(window._geminiKeyCached && window._geminiKeyCached.length > 10) return;

  // PASO 1: intentar localStorage INMEDIATAMENTE (no requiere sesión ni SB)
  const fromLS = localStorage.getItem('lex-gemini-key')||'';
  if(fromLS && fromLS.length > 10){
    window._geminiKeyCached = fromLS;
    console.log('[Gemini] ✅ Key cargada desde localStorage:', fromLS.substring(0,8)+'...');
    return; // listo — no necesitamos Supabase
  }

  // PASO 2: sin key en localStorage → esperar a que SB esté listo y haya sesión
  if(intento > 10){
    console.warn('[Gemini] ⚠ API Key no encontrada — configúrala en ⚙️ Configuración > Gemini');
    return;
  }
  setTimeout(async function(){
    if(window._geminiKeyCached && window._geminiKeyCached.length > 10) return;
    // Verificar localStorage de nuevo (puede haber cambiado entre reintentos)
    const fromLS2 = localStorage.getItem('lex-gemini-key')||'';
    if(fromLS2 && fromLS2.length > 10){
      window._geminiKeyCached = fromLS2;
      console.log('[Gemini] ✅ Key cargada desde localStorage (reintento '+intento+'):', fromLS2.substring(0,8)+'...');
      return;
    }
    // Si SB no está inicializado aún, reintentar
    if(!window.SB){ _intentarCargarKey(intento + 1); return; }
    try {
      const { data } = await window.SB.auth.getSession();
      if(!data?.session){ _intentarCargarKey(intento + 1); return; }
      await _cargarYCachearKey();
      if(window._geminiKeyCached && window._geminiKeyCached.length > 10)
        console.log('[Gemini] ✅ Key cargada desde Supabase (intento '+intento+'):', window._geminiKeyCached.substring(0,8)+'...');
      else
        _intentarCargarKey(intento + 1);
    } catch(e){ _intentarCargarKey(intento + 1); }
  }, intento === 1 ? 1500 : 2000 * intento);
})(1);
function ocrModGetDriveToken(){
  return window._ocrDriveTokenCached
    || localStorage.getItem('lex-drive-token')
    || localStorage.getItem('lex-ocr-drive-token')
    || localStorage.getItem('drive_token')
    || localStorage.getItem('ocr-drive-token')
    || (()=>{ try{ const c=JSON.parse(localStorage.getItem('lex-ocr-cfg')||'{}'); return c.dtoken||''; }catch(e){return '';} })()
    || '';
}
// ─── Cargar toda la config OCR desde Supabase ──────────────────────────────
async function _cargarConfigOCRDesdeSupabase(){
  if(!window.SB) return;
  try{
    const { data: sd } = await window.SB.auth.getSession();
    if(!sd?.session) return;
    const ids = ['gemini_api_key','drive_token','ocr_prof','ocr_extra'];
    const { data, error } = await window.SB.from('configuracion').select('id,valor').in('id', ids);
    if(error || !data) return;
    data.forEach(row => {
      if(!row.valor) return;
      const v = row.valor.trim();
      switch(row.id){
        case 'gemini_api_key':
          if(v.length > 10){
            window._geminiKeyCached = v;
            try{ localStorage.setItem('lex-gemini-key', v); }catch(_){}
            console.log('[Config] ✅ Gemini key cargada desde Supabase');
          }
          break;
        case 'drive_token':
          if(v.length > 10){
            window._ocrDriveTokenCached = v;
            try{ localStorage.setItem('lex-drive-token', v); }catch(_){}
            try{ localStorage.setItem('lex-ocr-drive-token', v); }catch(_){}
            console.log('[Config] ✅ Drive token cargado desde Supabase');
          }
          break;
        case 'ocr_prof':
          try{ localStorage.setItem('lex-ocr-prof', v); }catch(_){}
          break;
        case 'ocr_extra':
          try{ localStorage.setItem('lex-ocr-extra', v); }catch(_){}
          break;
      }
    });
  }catch(e){ console.warn('[Config] Error cargando config OCR desde Supabase:', e.message); }
}
// Ejecutar al iniciar (con reintentos hasta que haya sesión)
(function _intentarCargarConfigOCR(intento){
  if(intento > 10) return;
  setTimeout(async function(){
    if(!window.SB){ _intentarCargarConfigOCR(intento + 1); return; }
    try{
      const { data } = await window.SB.auth.getSession();
      if(!data?.session){ _intentarCargarConfigOCR(intento + 1); return; }
      await _cargarConfigOCRDesdeSupabase();
    }catch(e){ _intentarCargarConfigOCR(intento + 1); }
  }, intento === 1 ? 2000 : 2500 * intento);
})(1);

function ocrModGetFolder(){
  return localStorage.getItem('lex-ocr-folder')
    || (()=>{ try{ return JSON.parse(localStorage.getItem('lex-ocr-cfg')||'{}').folder||''; }catch(e){return '';} })()
    || '1jgwqgCv0OAD9NBDimlY6L-9bfCktqyz0';
}
function ocrModGetProf(){
  return localStorage.getItem('lex-ocr-prof')
    || localStorage.getItem('lex-ocr-cfg') && (() => { try { return JSON.parse(localStorage.getItem('lex-ocr-cfg')).prof || 'detallado'; } catch(e){ return 'detallado'; } })()
    || 'detallado';
}
function ocrModGetExtra(){
  return localStorage.getItem('lex-ocr-extra')
    || localStorage.getItem('lex-ocr-cfg') && (() => { try { return JSON.parse(localStorage.getItem('lex-ocr-cfg')).extra || ''; } catch(e){ return ''; } })()
    || '';
}

// ─── Tabs del módulo OCR ──────────────────────────────────────────────
function ocrModTab(tab, el){
  // Mostrar botón de conectar Drive si no hay refresh token
  if(tab === 'drive'){
    const hasRefresh = !!localStorage.getItem('lex-drive-refresh-token');
    const hasManual  = !!ocrModGetDriveToken();
    const connectBtn = document.getElementById('ocr-drive-connect-btn');
    if(connectBtn) connectBtn.style.display = (!hasRefresh && !hasManual) ? 'block' : 'none';
  }
  // Cargar refresh token de Supabase si no está en localStorage
  if(tab === 'drive' && !localStorage.getItem('lex-drive-refresh-token') && window.SB){
    window.SB.from('configuracion').select('valor').eq('id','drive_refresh_token').single()
      .then(({data,error}) => {
        if(!error && data && data.valor){
          try{ localStorage.setItem('lex-drive-refresh-token', data.valor); } catch(e){ registrarError('localStorage.setItem', e); }
ocrModActualizarDrive();
        }
      }).catch((e)=>{ registrarError('Promise catch vacio', e); });
  }
  // Actualizar estilo de los botones
  const btnSubir = document.getElementById('ocr-btn-subir');
  const btnDrive = document.getElementById('ocr-btn-drive');
  if(btnSubir && btnDrive){
    const activeStyle  = 'border:1.5px solid var(--gold);background:rgba(200,149,42,0.15);color:var(--gold-l);';
    const inactiveStyle= 'border:1.5px solid rgba(200,149,42,0.25);background:rgba(200,149,42,0.05);color:rgba(200,149,42,0.6);';
    btnSubir.style.cssText = btnSubir.style.cssText.replace(/border:[^;]+;|background:[^;]+;|color:[^;]+;/g,'') + (tab==='subir'?activeStyle:inactiveStyle);
    btnDrive.style.cssText = btnDrive.style.cssText.replace(/border:[^;]+;|background:[^;]+;|color:[^;]+;/g,'') + (tab==='drive'?activeStyle:inactiveStyle);
    // Forma más limpia: setear directamente
    if(tab==='subir'){
      btnSubir.style.border='1.5px solid var(--gold)';btnSubir.style.background='rgba(200,149,42,0.15)';btnSubir.style.color='var(--gold-l)';
      btnDrive.style.border='1.5px solid rgba(200,149,42,0.25)';btnDrive.style.background='rgba(200,149,42,0.05)';btnDrive.style.color='rgba(200,149,42,0.6)';
    } else {
      btnDrive.style.border='1.5px solid var(--gold)';btnDrive.style.background='rgba(200,149,42,0.15)';btnDrive.style.color='var(--gold-l)';
      btnSubir.style.border='1.5px solid rgba(200,149,42,0.25)';btnSubir.style.background='rgba(200,149,42,0.05)';btnSubir.style.color='rgba(200,149,42,0.6)';
    }
  }
  document.getElementById('ocr-tab-subir').classList.toggle('hidden', tab !== 'subir');
  document.getElementById('ocr-tab-drive').classList.toggle('hidden', tab !== 'drive');
  document.getElementById('ocr-result').style.display = 'none';
  if(tab === 'drive') ocrModActualizarDrive();
}

// ─── Estado Drive ────────────────────────────────────────────────────
async function ocrModActualizarDrive(){
  const el  = document.getElementById('ocr-dst');
  const txt = document.getElementById('ocr-dst-txt');
  if(!el) return;
  let refresh = localStorage.getItem('lex-drive-refresh-token');
  // Si no hay en localStorage, buscar en Supabase
  if(!refresh && window.SB){
    try{
      const {data, error} = await window.SB.from('configuracion').select('valor').eq('id','drive_refresh_token').single();
      if(!error && data && data.valor){
        refresh = data.valor;
        try{ localStorage.setItem('lex-drive-refresh-token', refresh); } catch(e){ registrarError('localStorage.setItem', e); }
}
    }catch(e){ registrarError('catch vacio', e); }
  }
  const manual  = ocrModGetDriveToken();
  if(refresh){
    el.className = 'ocr-drive-st on';
    txt.textContent = '✅ Drive conectado permanentemente · Carpeta JUICIOS lista';
  } else if(manual){
    el.className = 'ocr-drive-st on';
    txt.innerHTML = '🔑 Token manual activo · <span style="cursor:pointer;text-decoration:underline;color:var(--gold-d);" onclick="driveIniciarOAuth()">Conectar permanente ⚡</span>';
  } else {
    el.className = 'ocr-drive-st off';
    txt.innerHTML = 'Sin conexión · <button onclick="driveIniciarOAuth()" style="background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.68rem;font-weight:600;cursor:pointer;margin-left:6px;">⚡ Conectar Drive</button>';
  }
}

// ─── Drag & Drop ─────────────────────────────────────────────────────
function ocrDov(e){ e.preventDefault(); document.getElementById('ocr-uz').classList.add('drag-over'); }
function ocrDlv(){ document.getElementById('ocr-uz').classList.remove('drag-over'); }
function ocrDdr(e){ e.preventDefault(); ocrDlv(); ocrFilesIn(e.dataTransfer.files); }

// ─── Archivos locales ─────────────────────────────────────────────────
function ocrFilesIn(files){
  [...files].forEach(f => {
    if(!ocrModArchivos.find(a => a.name===f.name && a.size===f.size)) ocrModArchivos.push(f);
  });
  ocrRenderPrevs();
}
function ocrRenderPrevs(){
  const g = document.getElementById('ocr-pg');
  if(!g) return;
  g.innerHTML = '';
  ocrModArchivos.forEach((f, i) => {
    const d = document.createElement('div');
    d.className = 'ocr-prev-item';
    if(f.type.startsWith('image/')){
      d.innerHTML = '<img src="'+URL.createObjectURL(f)+'" alt="'+f.name+'">';
    } else {
      d.innerHTML = '<div class="ocr-prev-pdf">📄</div>';
    }
    d.innerHTML += '<div class="ocr-prev-name">'+f.name+'</div>'
      +'<button class="ocr-prev-rm" onclick="ocrQuitarFile('+i+')">✕</button>';
    g.appendChild(d);
  });
}
function ocrQuitarFile(i){ ocrModArchivos.splice(i,1); ocrRenderPrevs(); }

// ─── Chips ────────────────────────────────────────────────────────────
function ocrSelChip(el, tipo, containerId){
  document.querySelectorAll('#'+containerId+' .ocr-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  if(containerId === 'ocr-chips-s') ocrModTipoS = tipo;
  else ocrModTipoD = tipo;
}

// ─── Conversión a base64 ──────────────────────────────────────────────

// ─── Mime type válido para Gemini ─────────────────────────────────────
function ocrGetMime(fileOrBlob){
  const t = fileOrBlob.type || '';
  if(t === 'application/pdf') return 'application/pdf';
  if(['image/jpeg','image/png','image/webp','image/heic'].includes(t)) return t;
  if(t.startsWith('image/')) return 'image/jpeg';
  const ext = (fileOrBlob.name || '').split('.').pop().toLowerCase();
  const map = {pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic'};
  return map[ext] || 'image/jpeg';
}

// ─── Progreso ─────────────────────────────────────────────────────────
function ocrSetProg(wrapId, show, label, stepId){
  const w = document.getElementById(wrapId);
  if(!w) return;
  if(show){ w.classList.add('show'); } else { w.classList.remove('show'); }
  const lbl = document.getElementById(wrapId === 'ocr-pw-s' ? 'ocr-pl-s' : 'ocr-pl-d');
  if(lbl && label) lbl.textContent = label;
  if(stepId){ const s = document.getElementById(stepId); if(s) s.classList.add('act'); }
}
function ocrDoneStep(id){
  if(!id) return;
  const el = document.getElementById(id);
  if(el){ el.classList.remove('act'); el.classList.add('done'); }
}
function ocrResetProg(wrapId){
  const w = document.getElementById(wrapId);
  if(!w) return;
  w.classList.remove('show');
  w.querySelectorAll('.ocr-step').forEach(s => s.classList.remove('act','done'));
}

// ─── Prompt legal ─────────────────────────────────────────────────────
function ocrBuildPrompt(tipo){
  const extra = ocrModGetExtra();
  const j = D && D.juicios && D.juicios[jdetIdx];
  const ctx = j ? ('Juicio: '+(j.tipo||'')+' · Exp. '+(j.expediente||'')+' · Cliente: '+(j.cliente||j.nombre||'')) : '';
  return 'ACTUA COMO UN ANALISTA JURIDICO ESPECIALIZADO EN ACUERDOS JUDICIALES EN MEXICO.'
    + (ctx ? '\nCONTEXTO DEL EXPEDIENTE: '+ctx : '')
    + '\n\nAnaliza el documento adjunto (PDF, imagen o acuerdo escaneado).'
    + '\nAplica OCR completo para leer TODO el contenido.'
    + '\n\nINSTRUCCIONES:'
    + '\n- Explica que ocurrio en el acuerdo.'
    + '\n- Indica que ordeno el juez.'
    + '\n- Menciona fechas y plazos importantes.'
    + '\n- Usa lenguaje juridico simple y entendible.'
    + '\n- El resumen debe ser COMPLETO Y DETALLADO, no corto.'
    + '\n- No inventes informacion. Si un dato no consta escribe: No consta en el documento'
    + '\n\nExtrae los siguientes campos:'
    + '\n- Numero de expediente'
    + '\n- Juzgado o tribunal completo'
    + '\n- Fecha de resolucion'
    + '\n- Fecha en que causo ejecutoria'
    + '\n- Tipo de juicio'
    + '\n- Parte actora (nombre completo)'
    + '\n- Parte demandada (nombre completo)'
    + '\n- Hijos o menores (si aplica)'
    + '\n- Pension alimenticia mensual (si aplica)'
    + '\n- Compensacion o pago unico (si aplica)'
    + '\n- Fecha limite de pagos importantes'
    + '\n- Nombre y cargo del juzgador/a'
    + '\n\nFormato EXACTO de respuesta en espanol:'
    + '\n\n📌 TITULO DEL ACUERDO: [tipo de resolucion]'
    + '\n📋 EXPEDIENTE: [numero]'
    + '\n🏛 JUZGADO / TRIBUNAL: [nombre completo]'
    + '\n⚖ TIPO DE JUICIO: [tipo]'
    + '\n📅 FECHA DE RESOLUCION: [fecha]'
    + '\n📅 FECHA EJECUTORIA: [fecha o No consta]'
    + '\n👤 ACTOR: [nombre]'
    + '\n👤 DEMANDADO: [nombre]'
    + '\n👨 JUZGADOR/A: [nombre y cargo]'
    + '\n\nRESUMEN EJECUTIVO:'
    + '\n[3 a 5 parrafos completos — que ocurrio, que se resolvio, que ordeno el juez]'
    + '\n\nPUNTOS IMPORTANTES:'
    + '\n- [punto 1 — lo mas relevante]'
    + '\n- [punto 2]'
    + '\n- [incluye TODOS los puntos necesarios]'
    + '\n\nPLAZOS Y FECHAS CLAVE:'
    + '\n[lista detallada, o: No constan plazos]'
    + '\n\nOBSERVACIONES PARA EL ABOGADO:'
    + '\n[acciones concretas que el abogado debe atender]'
    + (extra ? '\n\nINSTRUCCIONES ADICIONALES DEL DESPACHO:\n'+extra : '')
    + '\n\nTono estrictamente profesional. NO truncar ni resumir en exceso.';
}

// ─── Llamar a Gemini API ──────────────────────────────────────────────
// FIX: flag para evitar llamadas concurrentes a Gemini que generan 429 en cascada
let _geminiEnCurso = false;
let _geminiCooldownHasta = 0;

// ══════════════════════════════════════════════════════════════════════
// MISTRAL OCR — extracción de texto especializada
// API gratuita: console.mistral.ai → API Keys
// Soporta PDFs e imágenes directamente, devuelve markdown estructurado
// Mucho más simple que PDF.js + Tesseract, misma calidad o mejor
// ══════════════════════════════════════════════════════════════════════

window._mistralKeyCached = window._mistralKeyCached || '';

function _mistralGetKey(){
  return window._mistralKeyCached
    || localStorage.getItem('lex-mistral-key')
    || (document.getElementById('cfg-mistral-key')?.value || '').trim()
    || '';
}

function mistralGuardarKey(){
  const inp = document.getElementById('cfg-mistral-key');
  const st  = document.getElementById('cfg-mistral-st');
  const k   = (inp?.value || '').trim();
  if(!k){ if(st){ st.textContent='⚠ Ingresa una API Key'; st.style.color='var(--rojo)'; } return; }
  _mistralSaveKey(k);
  if(st){ st.textContent='✅ Key guardada'; st.style.color='var(--verde)'; }
}

function _mistralSaveKey(k){
  k = k.trim();
  if(!k) return;
  try{ localStorage.setItem('lex-mistral-key', k); }catch(e){ registrarError('localStorage.setItem', e); }
  window._mistralKeyCached = k;
  if(window.SB && k.length > 10){
    window.SB.from('configuracion')
      .upsert({id:'mistral_api_key', valor: k, updated_at: new Date().toISOString()})
      .then(()=>{ console.log('[Mistral] ✅ Key guardada en Supabase'); if(typeof toast==='function') toast('📄 Mistral OCR configurado','ok'); })
      .catch(e=> console.warn('[Mistral] Error guardando key:', e));
  }
}

async function _cargarMistralKey(){
  try{
    // localStorage primero
    const fromLS = localStorage.getItem('lex-mistral-key') || '';
    if(fromLS.length > 10){ window._mistralKeyCached = fromLS; }
    // Supabase si hay sesión
    if(!window.SB) return;
    const { data: sd } = await window.SB.auth.getSession();
    if(!sd?.session) return;
    const { data, error } = await window.SB.from('configuracion').select('valor').eq('id','mistral_api_key').maybeSingle();
    if(!error && data?.valor && data.valor.length > 10){
      window._mistralKeyCached = data.valor.trim();
      try{ localStorage.setItem('lex-mistral-key', data.valor.trim()); }catch(_){}
      console.log('[Mistral] ✅ Key cargada desde Supabase:', data.valor.substring(0,8)+'...');
    }
  }catch(e){ console.warn('[Mistral] Error cargando key:', e.message); }
}

async function mistralTestKey(){
  const inp = document.getElementById('cfg-mistral-key');
  const st  = document.getElementById('cfg-mistral-st');
  const k   = (inp?.value || '').trim() || _mistralGetKey();
  if(!k){ if(st){ st.textContent='⚠ Ingresa una API Key'; st.style.color='var(--rojo)'; } return; }
  if(st){ st.textContent='🔄 Probando...'; st.style.color='var(--muted)'; }
  try{
    const resp = await fetch('https://api.mistral.ai/v1/models', {
      headers: { Authorization: 'Bearer ' + k }
    });
    if(resp.ok){
      _mistralSaveKey(k);
      if(st){ st.textContent='✓ Conexión exitosa — key guardada'; st.style.color='var(--verde)'; }
    } else {
      const e = await resp.json().catch(()=>({}));
      if(st){ st.textContent='❌ '+(e?.message||'Error '+resp.status); st.style.color='var(--rojo)'; }
    }
  }catch(e){
    if(st){ st.textContent='❌ '+e.message; st.style.color='var(--rojo)'; }
  }
}

// ── Llamada principal a Mistral OCR ──────────────────────────────────
// file: File | Blob con el documento
// Devuelve { texto, metodo:'mistral' } o null si no hay key
// ESTRATEGIA: subir primero a Files API de Mistral y usar signed_url
// (más confiable que base64 inline — evita truncado silencioso en PDFs grandes)
async function _mistralOCR(file, onProgreso){
  const key = _mistralGetKey();
  if(!key || key.length < 10) return null;

  const mime  = ocrMime(file);
  const isPDF = mime === 'application/pdf';

  onProgreso && onProgreso('📤 Subiendo archivo a Mistral...');

  try{
    // ── PASO 1: Subir a Files API ────────────────────────────────────
    const formData = new FormData();
    // Asegurar nombre de archivo con extensión correcta
    const filename = file.name || (isPDF ? 'documento.pdf' : 'imagen.jpg');
    formData.append('file', new File([file], filename, { type: mime }));
    formData.append('purpose', 'ocr');

    const uploadResp = await fetch('https://api.mistral.ai/v1/files', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: formData
    });

    if(!uploadResp.ok){
      const err = await uploadResp.json().catch(()=>({}));
      console.warn('[Mistral OCR] Error subiendo archivo:', uploadResp.status, err?.message||'');
      // Fallback a base64 inline para archivos pequeños (<4MB)
      if(file.size < 4 * 1024 * 1024){
        return await _mistralOCRBase64Fallback(file, key, mime, isPDF, onProgreso);
      }
      return null;
    }

    const uploadData = await uploadResp.json();
    const fileId = uploadData.id;
    if(!fileId){ console.warn('[Mistral OCR] No se obtuvo file_id'); return null; }

    // ── PASO 2: Obtener signed URL del archivo ───────────────────────
    onProgreso && onProgreso('🔗 Obteniendo URL del documento...');
    const urlResp = await fetch(`https://api.mistral.ai/v1/files/${fileId}/url?expiry=1`, {
      headers: { Authorization: 'Bearer ' + key }
    });

    let documentRef;
    if(urlResp.ok){
      const urlData = await urlResp.json();
      const signedUrl = urlData.url || urlData.signed_url || '';
      if(signedUrl){
        documentRef = isPDF
          ? { type: 'document_url', document_url: signedUrl }
          : { type: 'image_url',    image_url:    signedUrl };
      }
    }

    // Si no hay URL firmada, usar document_url con referencia de archivo
    if(!documentRef){
      documentRef = isPDF
        ? { type: 'document_url', document_url: `https://api.mistral.ai/v1/files/${fileId}/content` }
        : { type: 'image_url',    image_url:    `https://api.mistral.ai/v1/files/${fileId}/content` };
    }

    // ── PASO 3: Llamar a OCR con la URL ─────────────────────────────
    onProgreso && onProgreso('📄 Mistral OCR procesando el documento completo...');

    const ocrResp = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document: documentRef
      })
    });

    // Limpiar el archivo de Mistral Files API (async, no bloqueante)
    fetch(`https://api.mistral.ai/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + key }
    }).catch(()=>{});

    if(!ocrResp.ok){
      const err = await ocrResp.json().catch(()=>({}));
      console.warn('[Mistral OCR] HTTP', ocrResp.status, err?.message||'');
      return null;
    }

    const data  = await ocrResp.json();
    const pages = data.pages || [];
    const texto = pages.map(p => p.markdown || '').join('\n\n').trim();

    if(texto.length > 50){
      console.log(`[Mistral OCR] ✅ ${pages.length} páginas, ${texto.length} chars extraídos`);
      onProgreso && onProgreso(`✅ ${pages.length} páginas procesadas`);
      return { texto, metodo: 'mistral' };
    }
    return null;

  }catch(e){
    console.warn('[Mistral OCR] Error:', e.message);
    // Último recurso: base64 inline para archivos pequeños
    if(file.size < 4 * 1024 * 1024){
      return await _mistralOCRBase64Fallback(file, key, mime, isPDF, onProgreso);
    }
    return null;
  }
}

// Fallback: base64 inline para archivos pequeños (comportamiento anterior)
async function _mistralOCRBase64Fallback(file, key, mime, isPDF, onProgreso){
  try{
    onProgreso && onProgreso('📄 Mistral OCR (modo directo)...');
    const b64  = await ocrToB64(file);
    const body = {
      model: 'mistral-ocr-latest',
      document: isPDF
        ? { type: 'document_url', document_url: `data:application/pdf;base64,${b64}` }
        : { type: 'image_url',    image_url:    `data:${mime};base64,${b64}` }
    };
    const resp = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body)
    });
    if(!resp.ok) return null;
    const data  = await resp.json();
    const texto = (data.pages || []).map(p => p.markdown || '').join('\n\n').trim();
    if(texto.length > 50){
      console.log('[Mistral OCR fallback] ✅', texto.length, 'chars');
      return { texto, metodo: 'mistral' };
    }
    return null;
  }catch(e){ console.warn('[Mistral OCR fallback]', e.message); return null; }
}

// ══════════════════════════════════════════════════════════════════════
// EXTRACTOR LOCAL DE TEXTO — PDF.js + Tesseract.js
// Extrae texto ANTES de llamar a cualquier IA.
// - PDFs con texto: PDF.js (instantáneo, sin API)
// - Imágenes / PDFs escaneados: Tesseract.js (OCR local en browser)
// ══════════════════════════════════════════════════════════════════════

// Configurar worker de PDF.js cuando esté disponible
function _ocrConfigurarPDFjs() {
  if (typeof pdfjsLib !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
}

// ── Extractor principal ───────────────────────────────────────────────
// Cadena de extracción:
//   1. Mistral OCR (si hay key) — mejor calidad, soporta todo
//   2. PDF.js (PDFs con texto) — gratis, instantáneo
//   3. Tesseract.js (imágenes/PDFs escaneados) — gratis, local
//   4. Gemini Vision (último recurso) — caro, solo si todo falla
// Devuelve { texto, metodo } o null
async function _ocrExtraerTexto(file, onProgreso) {
  // CAPA 1: Mistral OCR (más preciso, soporta cualquier formato)
  const resMistral = await _mistralOCR(file, onProgreso);
  if (resMistral) return resMistral;

  const mime = ocrMime(file);
  const isPDF = mime === 'application/pdf';

  if (isPDF) {
    // INTENTO 1: PDF con capa de texto (más rápido, sin IA)
    try {
      onProgreso && onProgreso('📄 Leyendo PDF...');
      _ocrConfigurarPDFjs();
      if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js no disponible');
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      let texto = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        onProgreso && onProgreso(`📄 Leyendo página ${i}/${pdf.numPages}...`);
        const pg  = await pdf.getPage(i);
        const tc  = await pg.getTextContent();
        texto += tc.items.map(it => it.str).join(' ') + '\n';
      }
      const textoLimpio = texto.trim();
      // Si tiene suficiente texto, usarlo directamente
      if (textoLimpio.length > 100) {
        return { texto: textoLimpio, metodo: 'pdf-texto' };
      }
      // PDF escaneado (poco o nada de texto) → caer a Tesseract
    } catch(e) {
      console.warn('[OCR-Local] PDF.js falló:', e.message);
    }
  }

  // INTENTO 2: OCR con Tesseract.js (imágenes o PDFs escaneados)
  try {
    if (typeof Tesseract === 'undefined') throw new Error('Tesseract.js no disponible');
    onProgreso && onProgreso('🔍 OCR local en progreso...');

    let imageBlob = file;

    // Si es PDF escaneado, convertir primera página a imagen con PDF.js + canvas
    if (isPDF) {
      try {
        _ocrConfigurarPDFjs();
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        const pg  = await pdf.getPage(1);
        const vp  = pg.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width  = vp.width;
        canvas.height = vp.height;
        await pg.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        imageBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      } catch(e) {
        console.warn('[OCR-Local] Conversión PDF→imagen falló:', e.message);
        return null; // No se pudo convertir, usar Gemini Vision
      }
    }

    const { data } = await Tesseract.recognize(imageBlob, 'spa', {
      logger: m => {
        if (m.status === 'recognizing text' && onProgreso) {
          onProgreso(`🔍 OCR: ${Math.round((m.progress || 0) * 100)}%`);
        }
      }
    });
    const textoLimpio = (data.text || '').trim();
    if (textoLimpio.length > 50) {
      return { texto: textoLimpio, metodo: 'tesseract' };
    }
  } catch(e) {
    console.warn('[OCR-Local] Tesseract falló:', e.message);
  }

  return null; // No se pudo extraer texto — usar Gemini Vision como último recurso
}

// ── Construir prompt de texto para _iaLlamar ─────────────────────────
// ── Límites de contexto ────────────────────────────────────────────────
const _OCR_LIMITE_DIRECTO  = 80000;  // chars — un solo llamado a Groq
const _OCR_CHUNK_SIZE      = 60000;  // chars por bloque en modo chunked

// Prompt para analizar UNA sección/bloque del documento
function _ocrPromptSeccion(texto, ctxJuicio, numSec, totalSec) {
  return `ACTÚA COMO UN ANALISTA JURÍDICO ESPECIALIZADO EN ACUERDOS JUDICIALES EN MÉXICO.
${ctxJuicio ? 'CONTEXTO DEL EXPEDIENTE: ' + ctxJuicio + '\n' : ''}
Estás analizando la SECCIÓN ${numSec} de ${totalSec} de un documento judicial extenso.
Extrae y lista TODOS los datos relevantes de esta sección sin omitir nada:
- Número de expediente, juzgado, fechas, partes, tipo de juicio
- Todo lo que el juez ordenó o resolvió
- Todos los plazos y fechas mencionados
- Cualquier dato que el abogado deba conocer

No hagas resumen final todavía. Solo extrae los datos clave en formato de lista clara.

TEXTO DE LA SECCIÓN ${numSec}/${totalSec}:
---
${texto}
---

Responde en español. Sé exhaustivo — es mejor incluir de más que omitir datos importantes.`;
}

// Prompt de síntesis final a partir de los resúmenes de cada sección
function _ocrPromptSintesis(resumenesSecciones, ctxJuicio, extra) {
  return `ACTÚA COMO UN ANALISTA JURÍDICO ESPECIALIZADO EN ACUERDOS JUDICIALES EN MÉXICO.
${ctxJuicio ? 'CONTEXTO DEL EXPEDIENTE: ' + ctxJuicio + '\n' : ''}
A continuación tienes el análisis de TODAS las secciones de un documento judicial extenso.
Sintetiza toda la información en un resumen final completo y coherente.

${resumenesSecciones.map((r,i) => `=== SECCIÓN ${i+1} ===\n${r}`).join('\n\n')}

Redacta el resumen final en español con el siguiente formato EXACTO:

📌 TÍTULO DEL ACUERDO: [tipo de resolución — acuerdo, auto, sentencia, notificación, requerimiento, etc.]
📋 EXPEDIENTE: [número — si no consta: "No consta en el documento"]
🏛️ JUZGADO / TRIBUNAL: [nombre completo — si no consta: "No consta en el documento"]
⚖️ TIPO DE JUICIO: [tipo — si no consta: "No consta en el documento"]
📅 FECHA DE RESOLUCIÓN: [fecha — si no consta: "No consta en el documento"]
📅 FECHA EJECUTORIA: [fecha en que causó ejecutoria — si no consta: "No consta en el documento"]
👤 ACTOR: [nombre completo — si no consta: "No consta en el documento"]
👤 DEMANDADO: [nombre completo — si no consta: "No consta en el documento"]
👨‍👩‍👧 HIJOS / MENORES: [nombres y edades — si no aplica: "No aplica"]
💰 PENSIÓN ALIMENTICIA: [monto mensual — si no aplica: "No aplica"]
💵 COMPENSACIÓN O PAGO ÚNICO: [monto — si no aplica: "No aplica"]
📅 FECHA LÍMITE DE PAGOS: [fecha — si no aplica: "No aplica"]
👨 JUZGADOR/A: [nombre y cargo — si no consta: "No consta en el documento"]

RESUMEN EJECUTIVO:
[3 a 5 párrafos completos explicando qué ocurrió, qué se resolvió y qué ordenó el juez]

PUNTOS IMPORTANTES:
• [punto 1 — lo más relevante]
• [punto 2]
• [incluye TODOS los puntos necesarios, sin omitir nada]

⏰ PLAZOS Y FECHAS CLAVE:
[lista detallada de todos los plazos y fechas con su descripción, o "No constan plazos en el documento"]

⚠️ OBSERVACIONES PARA EL ABOGADO:
[acciones concretas que el abogado debe atender urgentemente]
${extra ? '\nINSTRUCCIONES ADICIONALES DEL DESPACHO:\n' + extra : ''}

Tono estrictamente profesional. NO truncar ni resumir en exceso. Incluye absolutamente toda la información relevante.`;
}

// Prompt unificado para documentos que caben en un solo llamado
function _ocrBuildPromptTexto(textoExtraido, ctxJuicio, extra) {
  return `ACTÚA COMO UN ANALISTA JURÍDICO ESPECIALIZADO EN ACUERDOS JUDICIALES EN MÉXICO.
${ctxJuicio ? 'CONTEXTO DEL EXPEDIENTE: ' + ctxJuicio + '\n' : ''}
El siguiente texto fue extraído COMPLETO del documento judicial mediante OCR:

---
${textoExtraido}
---

INSTRUCCIONES:
- Analiza TODO el documento sin omitir nada.
- Explica qué ocurrió en el acuerdo y qué ordenó el juez.
- Menciona TODAS las fechas, plazos, montos y obligaciones.
- Extrae datos de familia (hijos, pensión, compensación) si aplica.
- Usa lenguaje jurídico simple y entendible.
- No inventes información. Si un dato no consta, escribe "No consta en el documento".

Redacta el resumen en español con el siguiente formato EXACTO:

📌 TÍTULO DEL ACUERDO: [tipo de resolución — acuerdo, auto, sentencia, notificación, requerimiento, etc.]
📋 EXPEDIENTE: [número — si no consta: "No consta en el documento"]
🏛️ JUZGADO / TRIBUNAL: [nombre completo — si no consta: "No consta en el documento"]
⚖️ TIPO DE JUICIO: [tipo — si no consta: "No consta en el documento"]
📅 FECHA DE RESOLUCIÓN: [fecha — si no consta: "No consta en el documento"]
📅 FECHA EJECUTORIA: [fecha en que causó ejecutoria — si no consta: "No consta en el documento"]
👤 ACTOR: [nombre completo — si no consta: "No consta en el documento"]
👤 DEMANDADO: [nombre completo — si no consta: "No consta en el documento"]
👨‍👩‍👧 HIJOS / MENORES: [nombres y edades — si no aplica: "No aplica"]
💰 PENSIÓN ALIMENTICIA: [monto mensual — si no aplica: "No aplica"]
💵 COMPENSACIÓN O PAGO ÚNICO: [monto — si no aplica: "No aplica"]
📅 FECHA LÍMITE DE PAGOS: [fecha — si no aplica: "No aplica"]
👨 JUZGADOR/A: [nombre y cargo — si no consta: "No consta en el documento"]

RESUMEN EJECUTIVO:
[3 a 5 párrafos completos explicando qué ocurrió, qué se resolvió y qué ordenó el juez]

PUNTOS IMPORTANTES:
• [punto 1 — lo más relevante]
• [punto 2]
• [incluye TODOS los puntos necesarios, sin omitir nada]

⏰ PLAZOS Y FECHAS CLAVE:
[lista detallada de todos los plazos y fechas con su descripción, o "No constan plazos en el documento"]

⚠️ OBSERVACIONES PARA EL ABOGADO:
[acciones concretas que el abogado debe atender urgentemente]
${extra ? '\nINSTRUCCIONES ADICIONALES DEL DESPACHO:\n' + extra : ''}

Tono estrictamente profesional. NO truncar ni resumir en exceso. Incluye absolutamente toda la información relevante.`;
}

// ── Función central Opción C ───────────────────────────────────────────
// Si el texto cabe en _OCR_LIMITE_DIRECTO → un solo llamado (rápido)
// Si es más grande → análisis por secciones + síntesis final (completo)
async function _ocrAnalizarTexto(texto, ctxJuicio, extra, onProgreso) {
  if (texto.length <= _OCR_LIMITE_DIRECTO) {
    // ── RUTA A: documento normal → un solo llamado ──────────────────
    onProgreso && onProgreso('🧠 Analizando documento con IA...');
    const prompt = _ocrBuildPromptTexto(texto, ctxJuicio, extra);
    return await _iaLlamar(prompt, 8192, 0.1);
  }

  // ── RUTA B: documento grande → análisis por secciones ──────────────
  const chunks = [];
  for (let i = 0; i < texto.length; i += _OCR_CHUNK_SIZE) {
    chunks.push(texto.slice(i, i + _OCR_CHUNK_SIZE));
  }
  const total = chunks.length;
  onProgreso && onProgreso(`📄 Documento extenso — analizando ${total} secciones...`);

  const resumenesSecciones = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgreso && onProgreso(`🧠 Analizando sección ${i+1} de ${total}...`);
    const promptSec = _ocrPromptSeccion(chunks[i], ctxJuicio, i+1, total);
    const resumenSec = await _iaLlamar(promptSec, 4096, 0.1);
    resumenesSecciones.push(resumenSec);
  }

  onProgreso && onProgreso(`✍️ Sintetizando ${total} secciones en resumen final...`);
  const promptFinal = _ocrPromptSintesis(resumenesSecciones, ctxJuicio, extra);
  return await _iaLlamar(promptFinal, 8192, 0.1);
}

async function ocrLlamarGemini(partes, prompt, _intento){
  // FIX: respetar cooldown global si el último intento recibió 429
  const ahora = Date.now();
  if(_geminiCooldownHasta > ahora){
    const espMs = _geminiCooldownHasta - ahora;
    if(typeof toast==='function') toast('⏳ Esperando cooldown de rate-limit ('+Math.ceil(espMs/1000)+'s)...','loading');
    await new Promise(r => setTimeout(r, espMs));
  }
  // Obtener key: primero caché, luego Supabase directo
  let key = window._geminiKeyCached || '';
  if(!key || key.length < 10){
    try{
      const {data} = await window.SB.from('configuracion').select('valor').eq('id','gemini_api_key').maybeSingle();
      if(data && data.valor && data.valor.length > 10){
        key = data.valor.trim();
        window._geminiKeyCached = key;
      }
    }catch(e){ registrarError('catch vacio', e); }
  }
  if(!key || key.length < 10) throw new Error('SIN_KEY');
  _intento = _intento || 1;

  // FIX: validar que partes no tenga b64 vacío antes de enviar (causa 400 "required oneof field 'data'")
  const partesValidas = partes.filter(p => p && p.b64 && p.b64.length > 10 && p.mime);
  if(partes.length > 0 && partesValidas.length === 0){
    throw new Error('Los archivos seleccionados no pudieron leerse correctamente. Intenta de nuevo.');
  }

  const parts = [{ text: prompt }];
  partesValidas.forEach(p => parts.push({ inlineData:{ mimeType: p.mime, data: p.b64 } }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      systemInstruction: {
        parts: [{ text: "Eres un asistente legal experto en derecho mexicano. Tu trabajo es resumir acuerdos judiciales de forma clara, precisa, ejecutiva y estrictamente profesional para un despacho de abogados." }]
      },
      generationConfig: { temperature: 0.2, topP: 0.95, maxOutputTokens: 8192 }
    })
  });

  if(!resp.ok){
    const err = await resp.json().catch(()=>({}));
    const msg = err?.error?.message || '';
    if(resp.status===400||resp.status===403) throw new Error(msg || 'API Key de Gemini inválida. Verifica en ⚙️ Configuración');
    if(resp.status===402) throw new Error('💳 Créditos de Gemini agotados. Recarga en aistudio.google.com o configura Groq (gratis) en ⚙️ Configuración');
    if(resp.status===429){
      // Detectar si es créditos agotados (no es rate-limit temporal — no reintentar)
      const esAgotado = msg.toLowerCase().includes('depleted') || msg.toLowerCase().includes('prepayment');
      if(esAgotado){
        // Marcar cooldown permanente para no seguir intentando en esta sesión
        _geminiCooldownHasta = Date.now() + 24 * 60 * 60 * 1000; // 24h
        throw new Error('💳 Créditos de Gemini agotados. Recarga en aistudio.google.com o configura Groq (gratis) en ⚙️ Configuración.');
      }
      // Rate-limit real — rotar key y reintentar
      if(typeof ocrRotarKey==='function') ocrRotarKey();
      if(_intento < 3){
        const espera = _intento === 1 ? 15000 : 30000;
        _geminiCooldownHasta = Date.now() + espera;
        if(typeof toast==='function') toast('⏳ Límite de tasa alcanzado — esperando '+Math.round(espera/1000)+'s...','loading');
        await new Promise(r => setTimeout(r, espera));
        _geminiCooldownHasta = 0;
        return ocrLlamarGemini(partes, prompt, _intento + 1);
      }
      throw new Error('Límite de Gemini persistente. Espera 1 minuto e intenta de nuevo.');
    }
    throw new Error('Error Gemini: '+msg);
  }

  const data = await resp.json();
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if(!texto) throw new Error('Gemini no devolvió contenido. El documento puede ser ilegible.');
  return texto;
}

// ─── Parsear JSON de Gemini ───────────────────────────────────────────
function ocrParsearJSON(raw){
  let txt = raw.trim();
  // Quitar bloques de código markdown
  txt = txt.replace(/^```json\s*/im,'').replace(/^```\s*/im,'').replace(/```\s*$/m,'');
  txt = txt.trim();
  // Extraer solo el JSON entre { }
  const first = txt.indexOf('{');
  const last  = txt.lastIndexOf('}');
  if(first !== -1 && last > first){
    txt = txt.slice(first, last+1);
  }
  // Intentar parsear
  try {
    return JSON.parse(txt);
  } catch(e1) {
    // Intentar reparar JSON con comillas rotas
    const fixed = txt
      .replace(/([\w\s]+):/g, (m, k) => {
        if(k.trim().startsWith('"')) return m;
        return '"'+k.trim()+'":';
      });
    return JSON.parse(fixed);
  }
}

function ocrFallback(raw, tipo){
  return { resumenEjecutivo: raw, numeroExpediente:'N/A', tribunal:'N/A', tipoJuicio:tipo,
    estadoProceso:'Ver resumen', actor:{nombre:'Ver resumen',representante:'N/A'},
    demandado:{nombre:'Ver resumen',representante:'N/A'}, hechosRelevantes:[], textOCR:'' };
}

// Parsear respuesta de texto libre de Gemini
function ocrTextoAResultado(raw, tipo){
  const txt = raw || '';
  const get = (pat) => {
    const m = txt.match(pat);
    return m ? m[1].trim() : 'N/A';
  };
  // Extraer campos del formato estructurado
  const expediente     = get(/📋 EXPEDIENTE:\s*(.+)/);
  const tribunal       = get(/🏛️ TRIBUNAL:\s*(.+)/);
  const juzgadoCity    = get(/📍 JUZGADO:\s*(.+)/);
  const juzgadoParts   = juzgadoCity.split('—');
  const juzgado        = (juzgadoParts[0]||'').trim();
  const ciudad         = (juzgadoParts[1]||'').trim();
  const materia        = get(/⚖️ MATERIA:\s*(.+)/);
  const actor          = get(/👤 ACTOR:\s*(.+)/);
  const demandado      = get(/👤 DEMANDADO:\s*(.+)/);
  const estado         = get(/📊 ESTADO:\s*(.+)/);
  const ultimaAct      = get(/📅 ÚLTIMA ACTUACIÓN:\s*(.+)/);
  const proxAud        = get(/📅 PRÓXIMA AUDIENCIA:\s*(.+)/);
  const montos         = get(/💰 MONTOS:\s*(.+)/);

  // Extraer resumen (texto entre RESUMEN: y PUNTOS CLAVE:)
  const resumenMatch = txt.match(/RESUMEN:\n([\s\S]*?)(?=PUNTOS CLAVE:|$)/);
  let resumen = resumenMatch ? resumenMatch[1].trim() : txt;
  // Limpiar texto introductorio que Gemini agrega antes del contenido
  resumen = resumen
    .replace(/^Aquí tienes el análisis[^\n]*\n*/i, '')
    .replace(/^A continuación[^\n]*\n*/i, '')
    .replace(/^Con base en[^\n]*\n*/i, '')
    .replace(/^El documento[^\n]*\n*/i, '')
    .trim();

  // Extraer puntos clave como hechos relevantes
  const puntosMatch = txt.match(/PUNTOS CLAVE:\n([\s\S]*?)$/);
  const hechosRaw = puntosMatch ? puntosMatch[1].trim() : '';
  const hechos = hechosRaw.split('\n')
    .filter(l => l.trim())
    .map(l => {
      const dateMatch = l.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2} de \w+ de \d{4})/i);
      return { fecha: dateMatch ? dateMatch[0] : '—', hecho: l.replace(/^[•\-\*]\s*/, '').trim() };
    });

  return {
    numeroExpediente: expediente,
    tribunal:         tribunal,
    juzgado:          juzgado,
    ciudad:           ciudad,
    tipoJuicio:       tipo,
    materia:          materia,
    estadoProceso:    estado,
    ultimaActuacion:  ultimaAct,
    proximaAudiencia: proxAud,
    montos:           montos,
    actor:            { nombre: actor,     representante: 'N/A' },
    demandado:        { nombre: demandado, representante: 'N/A' },
    prestaciones:     [],
    resumenEjecutivo: resumen || txt,
    hechosRelevantes: hechos,
    textOCR:          ''
  };
}

// ─── ANALIZAR SUBIDOS ────────────────────────────────────────────────
async function ocrAnalizarSubidos(){
  if(ocrModArchivos.length === 0){ if(typeof toast==='function') toast('⚠ Sube al menos un archivo','err'); return; }
  document.getElementById('ocr-no-key')?.classList.remove('show');
  document.getElementById('ocr-result').style.display = 'none';
  ocrResetProg('ocr-pw-s');

  try {
    ocrSetProg('ocr-pw-s', true, 'Leyendo archivos...', 'ocr-s1');

    // ── INTENTO 1: Extracción local con PDF.js / Tesseract.js (sin API) ──
    const j = D.juicios && D.juicios[jdetIdx];
    const ctxJuicio = j ? `Juicio: ${j.tipo||''} — Expediente: ${j.expediente||j.num||''} — Cliente: ${j.nombre||j.cliente||''}` : '';
    const extra = ocrGetExtra();

    // Intentar extraer texto del primer archivo (el principal)
    const archivoP = ocrModArchivos[0];
    const extraccion = await _ocrExtraerTexto(archivoP, (msg) => {
      ocrSetProg('ocr-pw-s', true, msg, 'ocr-s1');
    });

    ocrDoneStep('ocr-s1');

    if (extraccion && extraccion.texto.length > 100) {
      // ✅ Texto extraído localmente — Opción C (directo o por secciones según tamaño)
      const metodoLabel = extraccion.metodo === 'pdf-texto' ? 'PDF.js (sin API)' : extraccion.metodo === 'mistral' ? 'Mistral OCR' : 'Tesseract OCR';
      ocrSetProg('ocr-pw-s', true, `Texto extraído [${metodoLabel}]`, 'ocr-s2');
      ocrDoneStep('ocr-s2');

      ocrSetProg('ocr-pw-s', true, 'IA: análisis legal...', 'ocr-s3');
      const raw = await _ocrAnalizarTexto(extraccion.texto, ctxJuicio, extra, (msg) => {
        ocrSetProg('ocr-pw-s', true, msg, 'ocr-s3');
      });
      ocrDoneStep('ocr-s3');

      ocrSetProg('ocr-pw-s', true, 'Generando resumen...', 'ocr-s4');
      let resultado;
      try { resultado = ocrParsearJSON(raw); }
      catch(e){ resultado = ocrTextoAResultado(raw, ocrModTipoS); }
      // Guardar texto OCR en el resultado
      resultado.textOCR = extraccion.texto.substring(0, 3000);
      ocrDoneStep('ocr-s4');

      ocrModResultado = resultado;
      ocrMostrarResultado(resultado, ocrModArchivos.map(f=>f.name).join(', '));
      return; // Terminado sin gastar tokens de visión
    }

    // ── INTENTO 2 (respaldo): Gemini Vision — solo si la extracción local falló ──
    ocrSetProg('ocr-pw-s', true, 'Preparando para Gemini Vision...', 'ocr-s1');
    const partes = [];
    for(const f of ocrModArchivos){
      partes.push({ b64: await ocrToB64(f), mime: ocrGetMime(f) });
    }
    ocrDoneStep('ocr-s1');

    ocrSetProg('ocr-pw-s', true, 'Enviando a Gemini Vision...', 'ocr-s2');
    ocrDoneStep('ocr-s2');

    ocrSetProg('ocr-pw-s', true, 'Gemini: OCR + análisis legal...', 'ocr-s3');
    const raw = await ocrLlamarGemini(partes, ocrBuildPrompt(ocrModTipoS));
    ocrDoneStep('ocr-s3');

    ocrSetProg('ocr-pw-s', true, 'Generando resumen...', 'ocr-s4');
    let resultado;
    try { resultado = ocrParsearJSON(raw); }
    catch(e){ resultado = ocrTextoAResultado(raw, ocrModTipoS); }
    ocrDoneStep('ocr-s4');

    ocrModResultado = resultado;
    ocrMostrarResultado(resultado, ocrModArchivos.map(f=>f.name).join(', '));

  } catch(err){
    ocrResetProg('ocr-pw-s');
    if(err.message === 'SIN_KEY'){
      document.getElementById('ocr-no-key').classList.add('show');
    } else {
      if(typeof toast==='function') toast('❌ '+err.message, 'err');
    }
    console.error('[OCR-Subir]', err);
  }
}

// ─── GOOGLE DRIVE ────────────────────────────────────────────────────
// Carpeta fija de todos los juicios en Google Drive — ÚNICA fuente
const OCR_JUICIOS_FOLDER_ID = '1jgwqgCv0OAD9NBDimlY6L-9bfCktqyz0';

// ── OAuth2 para Drive con Refresh Token automático ────────────────
const DRIVE_CLIENT_ID     = '331190113413-cc7vvh3uujh06rnsmta20vlkidpt38i3.apps.googleusercontent.com';
const DRIVE_CLIENT_SECRET = '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';
const DRIVE_TOKEN_URL     = 'https://oauth2.googleapis.com/token';

// Obtener Access Token válido — renueva automáticamente si expiró
async function driveGetAccessToken(){
  // Siempre intentar renovar primero si el token guardado tiene más de 50 min
  const saved    = localStorage.getItem('lex-drive-token') || '';
  const savedAt  = parseInt(localStorage.getItem('lex-drive-token-saved-at') || '0');
  const age      = Date.now() - savedAt;
  const MAX_AGE  = 50 * 60 * 1000; // 50 minutos

  if(saved && age < MAX_AGE) return saved; // Token reciente, usarlo directo

  // Obtener Refresh Token: siempre desde Supabase (fuente de verdad)
  let refresh = '';
  if(window.SB){
    try{
      const {data, error} = await window.SB.from('configuracion').select('valor').eq('id','drive_refresh_token').single();
      if(!error && data && data.valor){
        refresh = data.valor;
        try{ localStorage.setItem('lex-drive-refresh-token', refresh); } catch(e){ registrarError('localStorage.setItem', e); }
console.log('[Drive] Refresh token cargado desde Supabase');
      }
    }catch(e){ console.warn('[Drive] No se pudo cargar refresh token de Supabase:', e.message); }
  }
  // Fallback a localStorage si Supabase no responde
  if(!refresh) refresh = localStorage.getItem('lex-drive-refresh-token') || '';

  if(!refresh) return saved || '';
  try{
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id:     '331190113413-cc7vvh3uujh06rnsmta20vlkidpt38i3.apps.googleusercontent.com',
        client_secret: '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',
        refresh_token: refresh,
        grant_type:    'refresh_token'
      })
    });
    if(resp.ok){
      const data = await resp.json();
      if(data.access_token && !data.error){
        try{ localStorage.setItem('lex-drive-token',          data.access_token); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('lex-drive-token-saved-at', String(Date.now())); } catch(e){ registrarError('localStorage.setItem', e); }
// Sincronizar con token de OCR para que ambos componentes lo encuentren
        try{ localStorage.setItem('lex-ocr-drive-token',      data.access_token); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('drive_token',               data.access_token); } catch(e){ registrarError('localStorage.setItem', e); }
console.log('[Drive] ✅ Token renovado');
        return data.access_token;
      }
    }
  }catch(e){console.warn('[Drive] Error renovando:', e.message);}

  // Fallback: token guardado aunque sea viejo
  return saved || localStorage.getItem('lex-ocr-drive-token') || localStorage.getItem('drive_token') || '';
}

// Guardar Refresh Token (se llama una vez al completar el flujo OAuth)
function driveSaveRefreshToken(refreshToken, accessToken, expiresIn){
  if(refreshToken) try{ localStorage.setItem('lex-drive-refresh-token', refreshToken); } catch(e){ registrarError('localStorage.setItem', e); }
if(accessToken){
    try{ localStorage.setItem('lex-drive-access-token', accessToken); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('lex-drive-token-expiry', String(Date.now() + (expiresIn||3600)*1000)); } catch(e){ registrarError('localStorage.setItem', e); }
}
}

// Iniciar flujo OAuth para obtener Refresh Token
// Redirige a Google, al volver captura el código y lo intercambia
function driveIniciarOAuth(){
  const params = new URLSearchParams({
    client_id:     DRIVE_CLIENT_ID,
    redirect_uri:  'https://lexmexico423-dotcom.github.io/lex-mexico/',
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/drive.readonly',
    access_type:   'offline',
    prompt:        'consent'
  });
  try{ localStorage.setItem('lex-drive-oauth-pending', '1'); } catch(e){ registrarError('localStorage.setItem', e); }
window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

// Procesar código OAuth al regresar de Google
async function driveProcessOAuthCallback(){
  const url    = new URL(window.location.href);
  const code   = url.searchParams.get('code');
  const pending = localStorage.getItem('lex-drive-oauth-pending');
  if(!code || !pending) return;

  localStorage.removeItem('lex-drive-oauth-pending');
  // Limpiar la URL
  window.history.replaceState({}, '', window.location.pathname);

  try{
    const resp = await fetch(DRIVE_TOKEN_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id:     DRIVE_CLIENT_ID,
        client_secret: DRIVE_CLIENT_SECRET,
        code:          code,
        redirect_uri:  'https://lexmexico423-dotcom.github.io/lex-mexico/',
        grant_type:    'authorization_code'
      })
    });
    const data = await resp.json();
    if(data.refresh_token){
      driveSaveRefreshToken(data.refresh_token, data.access_token, data.expires_in);
      // Guardar refresh token en Supabase para persistencia permanente
      if(window.SB){
        window.SB.from('configuracion').upsert({id:'drive_refresh_token', valor: data.refresh_token, updated_at: new Date().toISOString()})
          .then(()=>console.log('[Drive] Refresh token guardado en Supabase'))
          .catch(e=>console.warn('[Drive] Error guardando en Supabase:', e));
      }
      // Sincronizar access token para componente OCR
      try{ localStorage.setItem('lex-ocr-drive-token', data.access_token); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('drive_token', data.access_token); } catch(e){ registrarError('localStorage.setItem', e); }
if(typeof toast==='function') toast('✅ Drive conectado permanentemente — ya no necesitas tokens manuales','ok');
      // Actualizar estado del módulo OCR
      setTimeout(ocrModActualizarDrive, 500);
    } else {
      console.error('[Drive OAuth] Respuesta:', data);
      if(typeof toast==='function') toast('⚠ Google no devolvió refresh token — intenta de nuevo','err');
    }
  }catch(e){
    console.error('[Drive OAuth]', e);
    if(typeof toast==='function') toast('❌ Error al conectar Drive: '+e.message,'err');
  }
}

// Verificar si hay un callback OAuth pendiente al cargar la página
window.addEventListener('load', ()=>{
  setTimeout(driveProcessOAuthCallback, 800);
  // Siempre sobreescribir el refresh token con el más reciente
  // Refresh token previo eliminado (tenía scope incorrecto). Reconéctate en ⚙️ Drive.
  // Limpiar access token si tiene más de 50 minutos
  const savedAt = parseInt(localStorage.getItem('lex-drive-token-saved-at')||'0');
  if(Date.now() - savedAt > 50*60*1000){
    localStorage.removeItem('lex-drive-token');
    localStorage.removeItem('lex-drive-token-saved-at');
  }
});

function ocrGetCarpetaActiva(){
  return OCR_JUICIOS_FOLDER_ID;
}

async function ocrListarDrive(){
  await ocrFetchDrive('', OCR_JUICIOS_FOLDER_ID, null);
}
async function ocrBuscarDrive(){
  const q = document.getElementById('ocr-ds-inp').value.trim();
  await ocrFetchDrive(q, OCR_JUICIOS_FOLDER_ID, null);
}
async function ocrFetchDrive(query, folderId, tokenManual){
  const dl = document.getElementById('ocr-dl');
  dl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:0.78rem;">🔄 Buscando en carpeta de juicios...</div>';
  try {
    // Usar token automático (refresh) o el manual como fallback
    const token = await driveGetAccessToken() || tokenManual;
    if(!token) throw new Error('Sin token de Drive — haz clic en "Conectar Drive" en ⚙️');
    const carpeta = folderId || OCR_JUICIOS_FOLDER_ID;

    let q, url;
    if(query){
      // Búsqueda: PDFs e imágenes que coincidan con el nombre
      q = "(mimeType='application/pdf' or mimeType contains 'image/' or mimeType='application/vnd.google-apps.folder') and trashed=false and '"+carpeta+"' in parents and name contains '"+query.replace(/'/g,"\'")+"'";
    } else {
      // Sin búsqueda: mostrar subcarpetas de juicios + PDFs directos
      q = "trashed=false and '"+carpeta+"' in parents";
    }

    url = 'https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)
      +'&fields=files(id,name,mimeType,modifiedTime)&pageSize=50&orderBy=name'
      +'&includeItemsFromAllDrives=true&supportsAllDrives=true&corpora=allDrives';

    const resp = await fetch(url, { headers:{ Authorization:'Bearer '+token } });

    if(resp.status === 401){
      // Limpiar token expirado
      localStorage.removeItem('lex-drive-token');
      localStorage.removeItem('lex-ocr-drive-token');
      throw new Error('Token expirado — haz clic en ⚙️ y pega un token nuevo de developers.google.com/oauthplayground');
    }
    if(resp.status === 403){
      const e403 = await resp.json().catch(()=>({}));
      throw new Error('Sin permisos — verifica que la cuenta de Drive tenga acceso a la carpeta. Detalle: '+(e403?.error?.message||'403'));
    }
    if(resp.status === 404){
      const e404 = await resp.json().catch(()=>({}));
      const msg404 = e404?.error?.message || '404';
      // Intentar sin filtro de carpeta como diagnóstico
      const urlDiag = 'https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent("trashed=false and mimeType='application/vnd.google-apps.folder'")
        +'&fields=files(id,name)&pageSize=5&includeItemsFromAllDrives=true&supportsAllDrives=true';
      const diagResp = await fetch(urlDiag, {headers:{Authorization:'Bearer '+token}});
      if(diagResp.ok){
        const diagData = await diagResp.json();
        const nombres = (diagData.files||[]).map(f=>f.name).join(', ');
        throw new Error('Carpeta no encontrada. Tu cuenta puede ver: ['+nombres+']. Verifica que tengas acceso a la carpeta JUICIOS.');
      }
      throw new Error('Carpeta no encontrada (404): '+msg404+'. Verifica que fcolex0@gmail.com tenga acceso a la carpeta JUICIOS.');
    }
    if(!resp.ok){
      const eGen = await resp.json().catch(()=>({}));
      throw new Error('Error Drive '+resp.status+': '+(eGen?.error?.message||''));
    }

    const data = await resp.json();
    ocrRenderDrive(data.files || [], carpeta);
    ocrModActualizarDrive();
  } catch(err){
    dl.innerHTML = '<div style="padding:14px 16px;background:rgba(192,22,26,0.06);border:1px solid rgba(192,22,26,0.2);border-radius:8px;color:var(--rojo);font-size:0.75rem;line-height:1.6;">'
      +'<strong>❌ Error al conectar con Drive</strong><br>'+err.message
      +'<br><br><span style="color:var(--muted);font-size:0.68rem;">Solución: haz clic en ⚙️ → genera un nuevo token en developers.google.com/oauthplayground con la cuenta que tiene acceso a la carpeta JUICIOS</span>'
      +'</div>';
  }
}

// Navegar a una subcarpeta (al hacer clic en una carpeta de juicio)
async function ocrEntrarCarpeta(folderId, encodedFolderName){
  const folderName = decodeURIComponent(encodedFolderName);
  const token = ocrModGetDriveToken();
  if(!token) return;
  // Actualizar breadcrumb
  const dst = document.getElementById('ocr-dst-txt');
  if(dst) dst.textContent = '📂 '+folderName;
  await ocrFetchDrive('', folderId, token);
  // Agregar botón volver
  const dl = document.getElementById('ocr-dl');
  if(dl){
    const volver = document.createElement('div');
    volver.style.cssText = 'padding:8px 11px;border-bottom:1px solid var(--border-l);font-size:0.75rem;cursor:pointer;color:var(--azul);display:flex;align-items:center;gap:6px;';
    volver.innerHTML = '← Volver a JUICIOS';
    volver.onclick = () => ocrListarDrive();
    dl.insertBefore(volver, dl.firstChild);
  }
}
function ocrRenderDrive(files, parentFolder){
  const dl = document.getElementById('ocr-dl');
  if(!files.length){
    dl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:0.78rem;">No se encontraron archivos en esta carpeta</div>';
    return;
  }

  const carpetas = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  const archivos = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

  dl.innerHTML = '';

  // Carpetas navegables
  carpetas.forEach(f => {
    const fecha = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('es-MX') : '';
    const safeId   = encodeURIComponent(f.id||'');
    const safeName = encodeURIComponent(f.name||'');
    const div = document.createElement('div');
    div.className = 'ocr-di';
    div.style.background = 'rgba(200,149,42,0.04)';
    div.innerHTML = '<span style="font-size:1rem;flex-shrink:0;">📁</span>'
      +'<div style="flex:1;min-width:0;"><div class="ocr-di-name" style="font-weight:600;">'+f.name+'</div>'
      +'<div class="ocr-di-meta">'+fecha+' · clic para abrir</div></div>'
      +'<span style="font-size:0.7rem;color:var(--muted);">›</span>';
    div.onclick = () => ocrEntrarCarpeta(f.id, safeName);
    dl.appendChild(div);
  });

  // Archivos seleccionables
  archivos.forEach(f => {
    const ico   = f.mimeType === 'application/pdf' ? '📄' : '🖼️';
    const fecha = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('es-MX') : '';
    const isSel = ocrModDriveSel.find(s => s.id === f.id) ? 'sel' : '';
    const div = document.createElement('div');
    div.className = 'ocr-di'+(isSel?' sel':'');
    div.id = 'ocr-di-'+f.id;
    div.innerHTML = '<span style="font-size:1rem;flex-shrink:0;">'+ico+'</span>'
      +'<div style="flex:1;min-width:0;"><div class="ocr-di-name">'+f.name+'</div>'
      +'<div class="ocr-di-meta">'+fecha+'</div></div>'
      +'<div class="ocr-di-chk">'+(isSel?'✓':'')+'</div>';
    div.onclick = () => ocrToggleDI(f.id, encodeURIComponent(f.name||''), f.mimeType, div);
    dl.appendChild(div);
  });
}
function ocrToggleDI(id, encodedName, mime, el){
  const name = decodeURIComponent(encodedName);
  const idx = ocrModDriveSel.findIndex(f => f.id === id);
  if(idx >= 0){
    ocrModDriveSel.splice(idx,1);
    el.classList.remove('sel');
    el.querySelector('.ocr-di-chk').textContent = '';
  } else {
    ocrModDriveSel.push({ id, name, mime });
    el.classList.add('sel');
    el.querySelector('.ocr-di-chk').textContent = '✓';
  }
  document.getElementById('ocr-sel-n').textContent = ocrModDriveSel.length;
}

// ─── ANALIZAR DESDE DRIVE ─────────────────────────────────────────────
async function ocrAnalizarDrive(){
  if(!ocrModDriveSel.length){ if(typeof toast==='function') toast('⚠ Selecciona al menos un archivo','err'); return; }
  // Key obtenida directamente en ocrLlamarGemini desde Supabase
  document.getElementById('ocr-no-key')?.classList.remove('show');
  const token = ocrModGetDriveToken();
  if(!token){ if(typeof toast==='function') toast('⚠ Configura el token de Drive en ⚙️ Configuración','err'); return; }
  document.getElementById('ocr-no-key').classList.remove('show');
  document.getElementById('ocr-result').style.display = 'none';
  ocrResetProg('ocr-pw-d');

  try {
    ocrSetProg('ocr-pw-d', true, 'Descargando de Drive...', 'ocr-d1');
    const partes = [];
    for(const f of ocrModDriveSel){
      const resp = await fetch('https://www.googleapis.com/drive/v3/files/'+f.id+'?alt=media',
        { headers:{ Authorization:'Bearer '+token } });
      if(resp.status===401) throw new Error('Token de Drive expirado. Genera uno nuevo en ⚙️ Configuración');
      if(!resp.ok) throw new Error('No se pudo descargar "'+f.name+'": HTTP '+resp.status);
      const blob = await resp.blob();
      partes.push({ b64: await ocrToB64(blob), mime: ocrGetMime({ type: blob.type||f.mime, name: f.name }) });
    }
    ocrDoneStep('ocr-d1');

    // ── INTENTO 1: Extracción local ──
    const jD = D.juicios && D.juicios[jdetIdx];
    const ctxJuicioD = jD ? `Juicio: ${jD.tipo||''} — Expediente: ${jD.expediente||jD.num||''} — Cliente: ${jD.nombre||jD.cliente||''}` : '';
    const extraD = ocrGetExtra();

    // Convertir primer archivo de partes a File para el extractor local
    let extraccionD = null;
    if (partes.length > 0) {
      try {
        const p0 = partes[0];
        const byteStr = atob(p0.b64);
        const byteArr = new Uint8Array(byteStr.length);
        for(let i=0;i<byteStr.length;i++) byteArr[i]=byteStr.charCodeAt(i);
        const blobD = new Blob([byteArr], {type: p0.mime});
        const fileD = new File([blobD], ocrModDriveSel[0]?.name || 'archivo', {type: p0.mime});
        extraccionD = await _ocrExtraerTexto(fileD, (msg) => {
          ocrSetProg('ocr-pw-d', true, msg, 'ocr-d2');
        });
      } catch(eExt){ console.warn('[OCR-Drive] Extracción local falló:', eExt.message); }
    }

    if (extraccionD && extraccionD.texto.length > 100) {
      // ✅ Texto extraído localmente — Opción C
      const metodoLabelD = extraccionD.metodo === 'pdf-texto' ? 'PDF.js' : extraccionD.metodo === 'mistral' ? 'Mistral OCR' : 'Tesseract';
      ocrSetProg('ocr-pw-d', true, `Texto extraído [${metodoLabelD}]`, 'ocr-d2');
      ocrDoneStep('ocr-d2');
      ocrSetProg('ocr-pw-d', true, 'IA: análisis legal...', 'ocr-d3');
      const rawD = await _ocrAnalizarTexto(extraccionD.texto, ctxJuicioD, extraD, (msg) => {
        ocrSetProg('ocr-pw-d', true, msg, 'ocr-d3');
      });
      ocrDoneStep('ocr-d3');

      ocrSetProg('ocr-pw-d', true, 'Generando resumen...', 'ocr-d4');
      let resultadoD;
      try { resultadoD = ocrParsearJSON(rawD); }
      catch(e){ resultadoD = ocrTextoAResultado(rawD, ocrModTipoD); }
      resultadoD.textOCR = extraccionD.texto.substring(0, 3000);
      ocrDoneStep('ocr-d4');
      ocrModResultado = resultadoD;
      ocrMostrarResultado(resultadoD, ocrModDriveSel.map(f=>f.name).join(', '));
      return;
    }

    // ── INTENTO 2 (respaldo): Gemini Vision ──
    ocrSetProg('ocr-pw-d', true, 'Enviando a Gemini Vision...', 'ocr-d2');
    ocrDoneStep('ocr-d2');

    ocrSetProg('ocr-pw-d', true, 'Gemini: OCR + análisis...', 'ocr-d3');
    const raw = await ocrLlamarGemini(partes, ocrBuildPrompt(ocrModTipoD));
    ocrDoneStep('ocr-d3');

    ocrSetProg('ocr-pw-d', true, 'Generando resumen...', 'ocr-d4');
    let resultado;
    try { resultado = ocrParsearJSON(raw); }
    catch(e){ resultado = ocrTextoAResultado(raw, ocrModTipoD); }
    ocrDoneStep('ocr-d4');

    ocrModResultado = resultado;
    ocrMostrarResultado(resultado, ocrModDriveSel.map(f=>f.name).join(', '));

  } catch(err){
    ocrResetProg('ocr-pw-d');
    if(err.message === 'SIN_KEY'){
      document.getElementById('ocr-no-key').classList.add('show');
    } else {
      if(typeof toast==='function') toast('❌ '+err.message, 'err');
    }
    const _ocrDriveMsg = err?.message || err?.toString() || 'Error desconocido';
    console.error('[OCR-Drive]', _ocrDriveMsg, err);
    registrarError('OCR-Drive', err);
  }
}

// ─── MOSTRAR RESULTADO ────────────────────────────────────────────────
function ocrMostrarResultado(d, fuente){
  const rw = document.getElementById('ocr-result');
  if(!rw) return;
  rw.style.display = 'block';

  // Datos del juicio
  const campos = [
    {l:'N° Expediente',v:d.numeroExpediente},{l:'Tribunal',v:d.tribunal},
    {l:'Juzgado',v:d.juzgado},{l:'Ciudad',v:d.ciudad},
    {l:'Tipo/Materia',v:[d.tipoJuicio,d.materia&&d.materia!=='N/A'?d.materia:''].filter(Boolean).join(' · ')},
    {l:'Estado',v:d.estadoProceso},{l:'Inicio',v:d.fechaInicio},
    {l:'Última actuación',v:d.ultimaActuacion},{l:'Próxima audiencia',v:d.proximaAudiencia},
    {l:'Montos',v:d.montos}
  ];
  document.getElementById('ocr-r-datos').innerHTML = campos
    .filter(c => c.v && c.v !== 'N/A' && c.v.trim())
    .map(c => '<div class="ocr-campo"><div class="ocr-campo-lbl">'+c.l+'</div><div class="ocr-campo-val">'+c.v+'</div></div>')
    .join('');

  // Partes
  const aOk = d.actor?.nombre && d.actor.nombre !== 'N/A';
  const dOk = d.demandado?.nombre && d.demandado.nombre !== 'N/A';
  if(aOk || dOk){
    document.getElementById('ocr-r-partes').innerHTML =
      '<div class="ocr-parte actor"><div class="ocr-parte-lbl">Actor / Quejoso</div><div class="ocr-parte-nom">'+(d.actor?.nombre||'N/A')+'</div></div>'
      +'<div class="ocr-parte demandado"><div class="ocr-parte-lbl">Demandado / Autoridad</div><div class="ocr-parte-nom">'+(d.demandado?.nombre||'N/A')+'</div></div>';
    document.getElementById('ocr-r-partes-sec').style.display = 'block';
  } else {
    document.getElementById('ocr-r-partes-sec').style.display = 'none';
  }

  // Resumen
  const texto = d.resumenEjecutivo || 'No disponible';
  document.getElementById('ocr-r-resumen').innerHTML =
    texto.split('\n\n').filter(p=>p.trim()).map(p=>'<p>'+p+'</p>').join('');

  // Timeline
  const hechos = Array.isArray(d.hechosRelevantes) ? d.hechosRelevantes : [];
  document.getElementById('ocr-r-tl').innerHTML = hechos.length > 0
    ? hechos.map(h=>'<li><div class="ocr-tl-dot"></div><div class="ocr-tl-date">'+(h.fecha||'—')+'</div><div class="ocr-tl-txt">'+h.hecho+'</div></li>').join('')
    : '<li><div class="ocr-tl-dot"></div><div class="ocr-tl-txt" style="color:var(--muted);">No se detectaron fechas específicas</div></li>';

  // OCR text
  document.getElementById('ocr-r-ocr').textContent = d.textOCR || '(no disponible)';

  // Scroll al resultado
  rw.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── USAR RESUMEN EN ENTRADA ──────────────────────────────────────────
// El botón principal: toma el resumen de Gemini y lo inserta en el textarea
// del historial para guardarlo como entrada cronológica
function ocrUsarResumen(){
  if(!ocrModResultado) return;
  const d = ocrModResultado;
  const ta = document.getElementById('hj-texto');
  if(!ta) return;

  // Construir texto formateado para el historial
  let texto = '';
  if(d.resumenEjecutivo && d.resumenEjecutivo !== 'N/A'){
    texto = d.resumenEjecutivo;
  }
  // Agregar datos clave al inicio si están disponibles
  const datos = [];
  if(d.numeroExpediente && d.numeroExpediente !== 'N/A') datos.push('Exp. '+d.numeroExpediente);
  if(d.ultimaActuacion  && d.ultimaActuacion  !== 'N/A') datos.push('Fecha: '+d.ultimaActuacion);
  if(d.proximaAudiencia && d.proximaAudiencia !== 'N/A') datos.push('Próx. audiencia: '+d.proximaAudiencia);
  if(d.montos && d.montos !== 'N/A') datos.push('Montos: '+d.montos);
  if(datos.length) texto = '['+datos.join(' · ')+']\n\n'+texto;

  ta.value = texto.trim();
  ta.style.borderColor = 'var(--gold)';
  setTimeout(() => { ta.style.borderColor = 'var(--border-l)'; }, 2500);
  ta.dispatchEvent(new Event('input'));

  // Auto-detectar tipo de entrada
  const t = texto.toLowerCase();
  const tipoSel = document.getElementById('hj-tipo');
  if(tipoSel){
    if(t.includes('acuerdo'))         tipoSel.value = 'acuerdo';
    else if(t.includes('requerimiento')) tipoSel.value = 'requerimiento';
    else if(t.includes('audiencia'))  tipoSel.value = 'audiencia';
    else if(t.includes('notificaci')) tipoSel.value = 'notificacion';
    else if(t.includes('apelaci')||t.includes('recurso')) tipoSel.value = 'apelacion';
    else if(t.includes('sentencia'))  tipoSel.value = 'acuerdo';
  }

  // Auto-detectar fecha
  const fechaMatch = texto.match(/\b(\d{1,2})[\s\/\-](?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[\s\/\-,\s]*(20\d{2})/i);
  if(fechaMatch){
    const meses = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',
                   julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
    const dia = fechaMatch[1].padStart(2,'0');
    const mes = meses[fechaMatch[2].toLowerCase()] || '01';
    const anio = fechaMatch[3];
    const fechaInp = document.getElementById('hj-fecha');
    if(fechaInp && !fechaInp.value) fechaInp.value = anio+'-'+mes+'-'+dia;
  }

  if(typeof toast==='function') toast('✅ Resumen cargado en la entrada — revisa y guarda','ok');

  // Scroll al textarea
  ta.scrollIntoView({ behavior:'smooth', block:'nearest' });
  ta.focus();
}

// ─── NUEVO ANÁLISIS ───────────────────────────────────────────────────
function ocrNuevoAnalisis(){
  ocrModArchivos = [];
  ocrModDriveSel = [];
  ocrRenderPrevs();
  const selN = document.getElementById('ocr-sel-n');
  if(selN) selN.textContent = '0';
  document.getElementById('ocr-result').style.display = 'none';
  ocrResetProg('ocr-pw-s');
  ocrResetProg('ocr-pw-d');
  document.getElementById('ocr-no-key').classList.remove('show');
  ocrModResultado = null;
}

// Inicializar estado Drive cuando se abre el formulario
const _hjAbrirNueva_orig = typeof hjAbrirNueva === 'function' ? hjAbrirNueva : null;
if(_hjAbrirNueva_orig){
  window.hjAbrirNueva = function(){
    _hjAbrirNueva_orig();
    ocrNuevoAnalisis();
    ocrModActualizarDrive();
  };
}

// ─── CONFIG OCR INLINE (botón ⚙️ dentro del formulario de nueva entrada) ───
function ocrAbrirConfig(){
  const modal = document.getElementById('ocr-cfg-modal');
  if(!modal) return;
  // Cargar valores guardados
  const keyInp    = document.getElementById('ocr-cfg-key-inline');
  const driveInp  = document.getElementById('ocr-cfg-drive-inline');
  const profInp   = document.getElementById('ocr-cfg-prof-inline');
  const extInp    = document.getElementById('ocr-cfg-extra-inline');
  if(keyInp)   keyInp.value   = ocrModGetKey();
  if(driveInp) driveInp.value = ocrModGetDriveToken();
  if(profInp)  profInp.value  = ocrModGetProf();
  if(extInp)   extInp.value   = ocrModGetExtra();
  modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
  if(modal.style.display !== 'none') ocrModActualizarDrive();
}
function ocrCerrarConfig(){
  const modal = document.getElementById('ocr-cfg-modal');
  if(modal) modal.style.display = 'none';
}
async function ocrTestKeyInline(){
  const key = (document.getElementById('ocr-cfg-key-inline')?.value||'').trim();
  const st  = document.getElementById('ocr-cfg-key-st');
  if(!key){ if(st){ st.textContent='⚠ Ingresa una API Key'; st.style.color='var(--rojo)'; } return; }
  if(st){ st.textContent='🔄 Probando...'; st.style.color='var(--muted)'; }
  try{
    const resp = await fetch(ocrGeminiURL(key),{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{text:'OK'}]}],generationConfig:{maxOutputTokens:5}})
    });
    if(resp.ok){
      try{ localStorage.setItem('lex-gemini-key', key); } catch(e){ registrarError('localStorage.setItem', e); }
if(st){ st.textContent='✓ Conexión exitosa — clave guardada'; st.style.color='var(--verde)'; }
      // Clave guardada en localStorage
    } else {
      const e = await resp.json().catch(()=>({}));
      if(st){ st.textContent='❌ '+(e?.error?.message||'Error '+resp.status); st.style.color='var(--rojo)'; }
    }
  } catch(e){
    if(st){ st.textContent='❌ '+e.message; st.style.color='var(--rojo)'; }
  }
}
function ocrGuardarConfigInline(){
  const key   = (document.getElementById('ocr-cfg-key-inline')?.value||'').trim();
  const token = (document.getElementById('ocr-cfg-drive-inline')?.value||'').trim();
  const prof  = document.getElementById('ocr-cfg-prof-inline')?.value||'detallado';
  const extra = document.getElementById('ocr-cfg-extra-inline')?.value||'';

  // 1. Guardar en localStorage
  if(key)   try{ localStorage.setItem('lex-gemini-key',      key); } catch(e){ registrarError('localStorage.setItem', e); }
  if(token){
    try{ localStorage.setItem('lex-drive-token',       token); } catch(e){ registrarError('localStorage.setItem', e); }
    try{ localStorage.setItem('lex-ocr-drive-token',   token); } catch(e){ registrarError('localStorage.setItem', e); }
  }
  try{ localStorage.setItem('lex-ocr-prof',  prof); } catch(e){ registrarError('localStorage.setItem', e); }
  try{ localStorage.setItem('lex-ocr-extra', extra); } catch(e){ registrarError('localStorage.setItem', e); }

  // 2. Guardar en caché global inmediato
  if(key)   window._geminiKeyCached  = key;
  if(token) window._ocrDriveTokenCached = token;

  // 3. Guardar en Supabase (persistencia definitiva)
  if(window.SB){
    const ts = new Date().toISOString();
    const ops = [];
    if(key   && key.length   > 10) ops.push({id:'gemini_api_key',    valor: key,   updated_at: ts});
    if(token && token.length > 10) ops.push({id:'drive_token',       valor: token, updated_at: ts});
    if(prof)                        ops.push({id:'ocr_prof',          valor: prof,  updated_at: ts});
    if(extra)                       ops.push({id:'ocr_extra',         valor: extra, updated_at: ts});
    if(ops.length > 0){
      window.SB.from('configuracion')
        .upsert(ops)
        .then(({error})=>{
          if(error){ console.warn('[OCR-Config] Error guardando en Supabase:', error.message); }
          else { console.log('[OCR-Config] ✅ Configuración guardada en Supabase'); }
        })
        .catch(e=> console.warn('[OCR-Config] Error Supabase:', e.message));
    }
  }

  if(typeof toast==='function') toast('✓ Configuración OCR guardada en la nube','ok');
  ocrCerrarConfig();
  document.getElementById('ocr-no-key').classList.remove('show');
}

// ─── MOSTRAR/OCULTAR Service Role Key según si es otro usuario ───────────────
function passMostrarServiceKey(){
  const email = (document.getElementById('cfg-target-email')?.value||'').trim();
  const wrap  = document.getElementById('cfg-service-key-wrap');
  if(wrap) wrap.style.display = email ? 'block' : 'none';
}

// ─── CAMBIAR CONTRASEÑA ─────────────────────────────────────────────────────
async function cambiarPassword(){
  const targetEmail = (document.getElementById('cfg-target-email')?.value||'').trim();
  const serviceKey  = (document.getElementById('cfg-service-key')?.value||'').trim();
  const newPass     = (document.getElementById('cfg-new-pass')?.value||'').trim();
  const confPass    = (document.getElementById('cfg-confirm-pass')?.value||'').trim();
  const st = document.getElementById('cfg-pass-status');

  const setStatus = (msg, color) => { if(st){ st.textContent=msg; st.style.color=color||'var(--rojo)'; } };

  // Validaciones
  if(!newPass || !confPass){ setStatus('⚠ Completa los campos de contraseña'); return; }
  if(newPass.length < 6){    setStatus('⚠ La contraseña debe tener al menos 6 caracteres'); return; }
  if(newPass !== confPass){  setStatus('⚠ Las contraseñas no coinciden'); return; }

  // ── CASO A: Cambiar la de OTRO usuario con Service Role Key ──────────────
  if(targetEmail){
    if(!serviceKey){ setStatus('⚠ Ingresa la Service Role Key de Supabase para cambiar la contraseña de otro usuario'); return; }

    setStatus('🔄 Buscando usuario...','var(--muted)');
    try {
      // Usar la API Admin de Supabase con Service Role Key
      const SUPABASE_URL_BASE = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '';
      if(!SUPABASE_URL_BASE){ setStatus('❌ No se encontró la URL de Supabase'); return; }

      // 1. Listar usuarios para encontrar el UID por correo
      const listResp = await fetch(SUPABASE_URL_BASE+'/auth/v1/admin/users?email='+encodeURIComponent(targetEmail), {
        headers: {
          'Authorization': 'Bearer '+serviceKey,
          'apikey': serviceKey
        }
      });
      if(!listResp.ok){
        const e = await listResp.json().catch(()=>({}));
        setStatus('❌ Error buscando usuario: '+(e.message||listResp.status));
        return;
      }
      const listData = await listResp.json();
      // La API devuelve {users:[...]} o directamente un array
      const users = listData.users || listData;
      const targetUser = Array.isArray(users) ? users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase()) : null;

      if(!targetUser){ setStatus('❌ No se encontró ningún usuario con el correo: '+targetEmail); return; }

      setStatus('🔄 Actualizando contraseña de '+targetEmail+'...','var(--muted)');

      // 2. Actualizar la contraseña usando el UID
      const updateResp = await fetch(SUPABASE_URL_BASE+'/auth/v1/admin/users/'+targetUser.id, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer '+serviceKey,
          'apikey': serviceKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: newPass })
      });

      if(!updateResp.ok){
        const e = await updateResp.json().catch(()=>({}));
        setStatus('❌ Error: '+(e.message||updateResp.status));
        return;
      }

      setStatus('✓ Contraseña de '+targetEmail+' actualizada correctamente','var(--verde)');
      document.getElementById('cfg-new-pass').value     = '';
      document.getElementById('cfg-confirm-pass').value = '';
      document.getElementById('cfg-target-email').value = '';
      document.getElementById('cfg-service-key').value  = '';
      document.getElementById('cfg-service-key-wrap').style.display = 'none';
      if(typeof toast==='function') toast('🔐 Contraseña de '+targetEmail+' actualizada','ok');

    } catch(e){
      setStatus('❌ '+e.message);
      console.error('[cambiarPassword-otro]', e);
    }
    return;
  }

  // ── CASO B: Cambiar la PROPIA contraseña con updateUser ─────────────────
  if(!window.SB){ setStatus('⚠ No hay sesión activa. Inicia sesión en Supabase primero'); return; }

  setStatus('🔄 Actualizando tu contraseña...','var(--muted)');
  try {
    const { error } = await window.SB.auth.updateUser({ password: newPass });
    if(error){
      setStatus('❌ '+error.message);
    } else {
      setStatus('✓ Tu contraseña fue actualizada correctamente','var(--verde)');
      document.getElementById('cfg-new-pass').value     = '';
      document.getElementById('cfg-confirm-pass').value = '';
      if(typeof toast==='function') toast('🔐 Contraseña actualizada','ok');
    }
  } catch(e){
    setStatus('❌ '+e.message);
    console.error('[cambiarPassword-propio]', e);
  }
}

// ─── Toggle ojo contraseña en sección Cambiar Contraseña ─────────────────────
function cfgTogglePass(inputId, svgId){
  const inp = document.getElementById(inputId);
  const svg = document.getElementById(svgId);
  if(!inp) return;
  const visible = inp.type === 'text';
  inp.type = visible ? 'password' : 'text';
  if(svg){
    // Ojo abierto = contraseña oculta, ojo tachado = contraseña visible
    svg.innerHTML = visible
      ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
    svg.setAttribute('stroke', visible ? 'rgba(122,104,64,0.6)' : 'var(--azul)');
  }
  // Sincronizar checkbox
  const chk = document.getElementById('cfg-ver-pass');
  if(chk) chk.checked = !visible;
}
function cfgToggleVerPass(chk){
  const newInp  = document.getElementById('cfg-new-pass');
  const confInp = document.getElementById('cfg-confirm-pass');
  const newSvg  = document.getElementById('cfg-eye-new');
  const confSvg = document.getElementById('cfg-eye-confirm');
  const tipo = chk.checked ? 'text' : 'password';
  const eyeAbierto = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  const eyeTachado = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  if(newInp)  newInp.type  = tipo;
  if(confInp) confInp.type = tipo;
  if(newSvg){  newSvg.innerHTML  = chk.checked ? eyeTachado : eyeAbierto; newSvg.setAttribute('stroke',  chk.checked ? 'var(--azul)' : 'rgba(122,104,64,0.6)'); }
  if(confSvg){ confSvg.innerHTML = chk.checked ? eyeTachado : eyeAbierto; confSvg.setAttribute('stroke', chk.checked ? 'var(--azul)' : 'rgba(122,104,64,0.6)'); }
}

// ─── Guardar token de Drive directo desde el modal ⚙️ ────────────────────────
function ocrGuardarTokenDrive(){
  const inp = document.getElementById('ocr-cfg-drive-inline-v2');
  const token = (inp?.value||'').trim();
  if(!token){ if(typeof toast==='function') toast('⚠ Pega el token primero','err'); return; }
  // Guardar en TODAS las claves posibles para garantizar que se use
  try{ localStorage.setItem('lex-drive-token',       token); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('lex-ocr-drive-token',   token); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('drive_token',            token); } catch(e){ registrarError('localStorage.setItem', e); }
if(typeof toast==='function') toast('✅ Token de Drive guardado — haz clic en Ver todo','ok');
  ocrModActualizarDrive();
  // Cerrar config y abrir tab drive
  ocrCerrarConfig();
  setTimeout(()=>{
    const btnDrive = document.getElementById('ocr-btn-drive');
    if(btnDrive) ocrModTab('drive', btnDrive);
  }, 300);
}