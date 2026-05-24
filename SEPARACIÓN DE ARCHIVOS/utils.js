/* ═══════════════════════════════════════════════════════════════
   LEX-MÉXICO · utils.js
   Funciones globales reutilizables
   Debe cargarse ANTES que cualquier otro módulo JS
═══════════════════════════════════════════════════════════════ */
'use strict';

/* ── LOGGER Y SAFE EXEC ── */
window.LEX_ERRORS = [];

function registrarError(modulo, error, extra = {}) {
  try {
    const payload = {
      fecha: new Date().toISOString(),
      modulo,
      mensaje: error?.message || String(error),
      stack: error?.stack || null,
      extra
    };

    console.error(`[${modulo}]`, error);

    window.LEX_ERRORS.push(payload);

    if (window.LEX_ERRORS.length > 300) {
      window.LEX_ERRORS.shift();
    }

    if (typeof toast === 'function') {
      toast(`⚠ Error en ${modulo}`, 'err');
    }

  } catch (e) {
    console.error('[LOGGER]', e);
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

/* ── ACCESO DOM ── */
function $(id) {
  let el = _domCache.get(id);
  if (el && el.isConnected) return el;
  el = document.getElementById(id);
  if (el) _domCache.set(id, el);
  return el;
}

/* ── DEBOUNCE ── */
function debounce(fn, ms = 200) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/* ── FORMATO DE FOLIO ── */
function folioFormato(num, anioFolio){
  const anio = anioFolio
    ? String(anioFolio).slice(-2)
    : new Date().getFullYear().toString().slice(2);
  const n = Number(num);
  // Padding de 3 dígitos: 26-001 a 26-999
  return anio + '-' + String(n).padStart(3, '0');
}

/* ── QR CODE ── */
function qrToDataURL(texto){
  return new Promise(resolve=>{
    const div=document.createElement('div');
    div.style.position='absolute'; div.style.left='-9999px'; document.body.appendChild(div);
    new QRCode(div,{text:texto,width:110,height:110,colorDark:'#1a1008',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    setTimeout(()=>{
      const img=div.querySelector('img')||div.querySelector('canvas');
      const url=img?(img.src||img.toDataURL()):'';
      document.body.removeChild(div); resolve(url);
    },350);
  });
}

/* ── STATUS BAR ── */
function setStatus(t,msg,cls){
  document.getElementById('status-text').textContent=msg;
  document.getElementById('status-dot').className='dot '+(cls||'');
}

/* ── HORA Y FECHA CDMX ── */
function ahoraCDMX(){
  // Siempre usa la hora real del equipo (Date.now()), zona CDMX via Intl
  return new Date(Date.now());
}

// Convierte un Date a hora CDMX usando Intl (maneja DST automáticamente)
function partesHoraCDMX(d){
  const x = d || ahoraCDMX();
  const fmt = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
  });
  const parts = fmt.formatToParts(x).reduce((o,p)=>{ o[p.type]=p.value; return o; },{});
  return {
    iso: parts.year+'-'+parts.month+'-'+parts.day,
    hora: parts.hour+':'+parts.minute,
    fechaHora: parts.day+'/'+parts.month+'/'+parts.year+' '+parts.hour+':'+parts.minute+' hrs.',
    timestamp: x.getTime()
  };
}

function fechaCDMX_ISO(){ return partesHoraCDMX().iso; }
function horaCDMX_HHMM(){ return partesHoraCDMX().hora; }

/* ── TOAST NOTIFICACIONES ── */
function toast(msg,t='ok'){
  const el=$('toast');el.className='toast '+t;el.textContent=msg;el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),3200);
}

/* ── NAVEGACIÓN ir() ── */
function ir(p){
  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-sub-item').forEach(x=>x.classList.remove('active'));
  $('panel-'+p).classList.add('active');
  // Marcar en body el panel activo para CSS condicional
  document.body.className = document.body.className.replace(/\bpanel-[\w-]+/g,'').trim();
  document.body.classList.add('panel-'+p);
  document.querySelector(`.nav-item[onclick="ir('${p}')"]`)?.classList.add('active');
  document.querySelector(`.nav-sub-item[onclick="ir('${p}')"]`)?.classList.add('active');
  // También marcar items con data-panel (para los que tienen onclick compuesto)
  document.querySelectorAll(`.nav-item[data-panel="${p}"]`).forEach(el => el.classList.add('active'));
  if(p==='recibos'||p==='finanzas-internas'){
    document.querySelector(`.nav-item[onclick="ir('contabilidad')"]`)?.classList.add('active');
  }
  $('topTitle').textContent=TITULOS[p]||p;
  if(p==='contabilidad')renderContab();
  if(p==='recibos')renderRec();
  if(p==='finanzas-internas'){initFI();FI.prestamos=D.prestamos;renderFI();fiCambiarTab(fiTabActual||'caja');}
  if(p==='directorio'){renderDir();}
  if(p==='carpetas')renderCarp();
  if(p==='juicios'){renderJuicios();$('juicio-detalle').classList.remove('visible');$('juicios-lista-view').style.display='';}
  if(p==='pendientes')renderPend();
  if(p==='caja')renderCaja();
  if(p==='registro-civil')rcAbrirSubpanel('home');
  if(p==='escrituras'){ if(!Array.isArray(D.escrituras))D.escrituras=[]; escRender(); }
  if(p==='configuracion'){ setTimeout(ocrCargarKeyEnCfg, 100); }
  if(p==='nuevo-recibo'){
    // Sincronizar token de Drive con el sistema de recibos al navegar al panel
    if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
    if(typeof appData !== 'undefined' && typeof sbSession !== 'undefined' && sbSession
       && (!appData.recibos || !appData.recibos.length)
       && typeof cargarDatosIniciales === 'function') {
      cargarDatosIniciales();
    }
    // Asegurar que haya al menos 1 fila de cliente y 1 concepto
    const wrap = $('clientes-wrapper');
    if (wrap && !wrap.querySelector('.cliente-row')) {
      if (typeof agregarCliente === 'function') agregarCliente();
      else if (typeof idxAgregarCliente === 'function') idxAgregarCliente();
    }
    const tbody = $('conceptos-tbody');
    if (tbody && !tbody.querySelector('tr')) {
      if (typeof agregarConcepto === 'function') agregarConcepto();
      else if (typeof idxAgregarConcepto === 'function') idxAgregarConcepto();
    }
    // Regenerar QR si es necesario
    if (typeof generarQRPreview === 'function') generarQRPreview();
  }
  if(p==='configuracion'){setTimeout(renderConfig,50);}
}