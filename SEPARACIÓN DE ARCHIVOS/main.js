/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   LEX-MÃ‰XICO Â· main.js
   Bloque principal del sistema â€” recibos, supabase, caja, dashboard
   Contiene el nÃºcleo de la aplicaciÃ³n que inicializa todo el sistema
   Dependencias: utils.js, ia.js deben cargarse primero
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BLOQUE 1 â€” originalmente en lÃ­nea 3552 de index.html
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// ================================================================
// LEX-MÃ‰XICO â€” Recibo Oficial v6
// Sistema completo: Supabase como BD Â· Folio persistente Â· Pagos complementarios Â· Directorio telefÃ³nico
// ================================================================

// â•â•â• CACHÃ‰ DE DOM â•â•â•
// $(id) reemplaza document.getElementById(id) con cachÃ© automÃ¡tico.
// Si el elemento se elimina y se vuelve a crear, el cachÃ© lo detecta y refresca.
// Reduce el costo de las bÃºsquedas repetidas (responsable, folio-display, etc.)
const _domCache = new Map();
function $(id) {
  let el = _domCache.get(id);
  if (el && el.isConnected) return el;
  el = document.getElementById(id);
  if (el) _domCache.set(id, el);
  return el;
}
// Para invalidar manualmente cuando se reemplaza un contenedor:
function $invalidate(id) { _domCache.delete(id); }

// â•â•â• DEBOUNCE â•â•â• (para bÃºsqueda global y filtros, Punto 6)
function debounce(fn, ms = 200) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// LEX-MÃ‰XICO Â· BACKEND: SUPABASE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// La aplicaciÃ³n ahora persiste datos en Supabase en lugar de Drive.
// Para no reescribir cientos de funciones, mantenemos los nombres de
// variables (sbSession, appData, etc.) pero apuntando a Supabase.
//
// ConfiguraciÃ³n Supabase:
const SUPABASE_URL      = 'https://zrmpawigjufgsuamqflv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpybXBhd2lnanVmZ3N1YW1xZmx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTQ2NjgsImV4cCI6MjA5NDE5MDY2OH0.rRV6vbNImhyAxfFPsje5QgEg6M35bojX2vDlLaTb3K4';  // â¬… PEGA TU ANON KEY DE SUPABASE AQUÃ
const STORAGE_BUCKET    = 'lex-files';
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function agregarConcepto() {
  conceptoCount++;
  const id = 'cp' + conceptoCount;
  const tbody = document.getElementById('conceptos-tbody');
  const tr = document.createElement('tr');
  tr.id = 'concepto-row-' + id;

  tr.innerHTML =
    '<td style="position:relative;">' +
      '<textarea class="concepto concepto-ta" placeholder="Concepto" rows="1" ' +
        'oninput="iaConceptoInput(this)" ' +
        'onblur="iaConceptoBlur(this)" ' +
        'onkeydown="iaSugerenciaKeydown(event,this)"' +
      '></textarea>' +
      '<div class="ia-dropdown" style="display:none;"></div>' +
    '</td>' +
    '<td>' +
      '<textarea class="descripcion concepto-ta" placeholder="DescripciÃ³n" rows="1" ' +
        'onblur="iaDescBlur(this)"' +
      '></textarea>' +
    '</td>' +
    '<td><input type="text" class="precio price-input" placeholder="0.00" inputmode="decimal" oninput="formatPrecio(this)"></td>' +
    '<td><button class="del-concept" onclick="quitarConcepto(\'' + id + '\')">âœ•</button></td>';

  tbody.appendChild(tr);
}
// â”€â”€ FUNCIÃ“N AUXILIAR (ya existe en tu sistema, incluida por si acaso)

// â”€â”€ DIRECTORIO DE EMPLEADOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Mapeo de correo â†’ nombre que aparece en recibos e historial
EMPLEADOS = {
  'lexmexico423@gmail.com':     'LIC NAHUM PELAEZ',
  'lexantonieta2025@gmail.com': 'LIC ANTONIETA CHAVEZ MONTAR'
};
// Correo del administrador â€” puede elegir quiÃ©n autoriza en los PDFs
const ADMIN_EMAIL = 'lexmexico423@gmail.com';
NOMBRE_TITULAR = 'LIC NAHUM PELAEZ';

// Variables de estado (mantienen nombres legacy pero apuntan a Supabase)
sbSession      = null;   // se setea a "supabase-active" cuando hay sesiÃ³n
sbExpiry     = 0;
folioFileId     = 'supabase';  // ya no es un fileId de Drive
appData         = { folioActual: 1, anioFolioActual: new Date().getFullYear(), recibos: [] };
empleadoActual  = null;
window.SB       = null;   // cliente de Supabase
window.SB_DESPACHO_ID = null;  // ID del despacho activo

// â”€â”€ FORMATEO DE MONEDA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function fmtMXN(num) {
  const n = parseFloat(num) || 0;
  return n.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
}

// Convierte nÃºmero a letras en espaÃ±ol (pesos mexicanos)
function numeroALetras(num){
  const n = Math.abs(parseFloat(num)||0);
  const entero = Math.floor(n);
  const cents = Math.round((n - entero)*100);
  const unidades=['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE',
    'DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÃ‰IS','DIECISIETE','DIECIOCHO','DIECINUEVE'];
  const decenas=['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  const centenas=['','CIEN','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
    'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
  function grupo(n){
    let s='';
    const c=Math.floor(n/100), d=Math.floor((n%100)/10), u=n%10;
    if(c>0){ s+=c===1&&(n%100)===0?'CIEN':centenas[c]; if(n%100>0) s+=' '; }
    if((d*10+u)>0){
      if(d*10+u<20){ s+=unidades[d*10+u]; }
      else{
        s+=decenas[d];
        if(u>0) s+=' Y '+unidades[u];
      }
    }
    return s;
  }
  function miles(n){
    if(n===0) return 'CERO';
    let s='';
    const mill=Math.floor(n/1000000);
    const mil=Math.floor((n%1000000)/1000);
    const resto=n%1000;
    if(mill>0){ s+=(mill===1?'UN MILLÃ“N':grupo(mill)+' MILLONES')+' '; }
    if(mil>0){ s+=(mil===1?'MIL':grupo(mil)+' MIL')+' '; }
    if(resto>0){ s+=grupo(resto); }
    return s.trim();
  }
  let resultado = miles(entero)+' PESOS';
  resultado += ' '+String(cents).padStart(2,'0')+'/100 M.N.';
  return resultado;
}

// â”€â”€ TIPO DE TRÃMITE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
tipoTramite = 'normal';
function setTipoTramite(tipo) {
  tipoTramite = tipo;
  document.getElementById('btn-tramite-normal').classList.toggle('active', tipo === 'normal');
  document.getElementById('btn-tramite-vehicular').classList.toggle('active', tipo === 'vehicular');
  const secVeh = document.getElementById('seccion-vehiculo');
  if (secVeh) secVeh.style.display = tipo === 'vehicular' ? '' : 'none';

  // TrÃ¡mite Normal: ocultar vehiculos; TrÃ¡mite Vehicular: ocultar familiares y propiedad
  const catVehiculos  = document.getElementById('cat-vehiculos');
  const catFamiliares = document.getElementById('cat-familiares');
  const catPropiedad  = document.getElementById('cat-propiedad');
  if (tipo === 'normal') {
    if (catVehiculos)  catVehiculos.style.display  = 'none';
    if (catFamiliares) catFamiliares.style.display = '';
    if (catPropiedad)  catPropiedad.style.display  = '';
  } else {
    if (catVehiculos)  catVehiculos.style.display  = '';
    if (catFamiliares) catFamiliares.style.display = 'none';
    if (catPropiedad)  catPropiedad.style.display  = 'none';
  }
}

// â”€â”€ TOGGLE CATEGORÃA DE DOCUMENTOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toggleCategoria(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector('span');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  arrow.textContent = open ? 'â–¸' : 'â–¾';
}

// â”€â”€ DESPLEGABLE: DATOS GENERALES DEL VEHICULO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function toggleVehiculo(header) {
  const body = document.getElementById('vehicle-grid-body');
  const arrow = header.querySelector('.veh-arrow');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'grid';
  arrow.textContent = open ? 'â–¸' : 'â–¾';
}

// â”€â”€ TIPO DE DOCUMENTO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setTipoDoc(tipo) {
  document.getElementById('btn-doc-copia').classList.toggle('active', tipo === 'copia');
  document.getElementById('btn-doc-escaneo').classList.toggle('active', tipo === 'escaneo');
  document.getElementById('tipo_doc').value = tipo;
}

function getDocumentosSeleccionados() {
  const tipodoc = document.getElementById('tipo_doc').value === 'escaneo'
    ? 'DOCUMENTOS QUE SE ESCANEARON' : 'DOCUMENTOS EN COPIA SIMPLE';
  const categorias = document.querySelectorAll('#docs-checklist .doc-category');
  const docs = [];
  categorias.forEach(cat => {
    const checks = Array.from(cat.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value);
    checks.forEach(d => docs.push(d));
  });
  if (!docs.length) return '';
  // Aviso si el usuario excede el lÃ­mite (defensa por si fallara el listener)
  if (docs.length > 15) {
    console.warn('Documentos seleccionados ('+docs.length+') excede el lÃ­mite de 15. Se truncarÃ¡n los Ãºltimos '+(docs.length-15)+'.');
    setStatus('err','âš  Solo los primeros 15 documentos aparecerÃ¡n en el PDF ('+docs.length+' seleccionados)','err');
  }
  // Return as JSON string so PDF can parse it; also keep plain text fallback
  return JSON.stringify({ tipodoc, docs: docs.slice(0, 15) });
}

// ValidaciÃ³n en tiempo real: avisar al marcar el documento 16
function validarLimiteDocumentos(checkbox) {
  const seleccionados = document.querySelectorAll('#docs-checklist input[type="checkbox"]:checked').length;
  if (seleccionados > 15 && checkbox.checked) {
    checkbox.checked = false;
    setStatus('err','âš  MÃ¡ximo 15 documentos. Desmarca alguno antes de agregar otro.','err');
    return false;
  }
  if (seleccionados > 0) {
    setStatus('ok','Documentos seleccionados: '+seleccionados+'/15','ok');
  }
  return true;
}

// â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ PARTE 1: GOOGLE DRIVE AUTH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SUPABASE: InicializaciÃ³n del cliente y autenticaciÃ³n
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function initSupabase(){
  if(window.SB) return window.SB;
  // El SDK se carga como script global desde el <head> (window.supabase)
  // Esto evita el "Failed to fetch dynamically imported module" en navegadores
  // con bloqueadores activos (Brave Shields, uBlock, etc.)
  if(typeof window.supabase === 'undefined' || !window.supabase.createClient){
    // Intento de carga de respaldo si el script principal fallÃ³
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar el SDK de Supabase desde unpkg ni jsdelivr. Desactiva bloqueadores y recarga.'));
      document.head.appendChild(s);
    });
  }
  window.SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: window.sessionStorage,
      storageKey: 'lex-supabase-auth'
    }
  });
  // Escuchar cambios de sesiÃ³n
  window.SB.auth.onAuthStateChange((event, session) => {
    console.log('[SB] Auth event:', event);
    if(event === 'SIGNED_IN' || event === 'INITIAL_SESSION'){
      // FIX: cargar la key de Gemini en cuanto la sesiÃ³n estÃ© autenticada
      // Antes solo se cargaba con setTimeout(1s) â†’ la sesiÃ³n podÃ­a no estar lista â†’ warning falso
      if(session){
        // Cargar key de Gemini
        setTimeout(_cargarYCachearKey, 300);
        // Cargar key de Groq desde Supabase al hacer login
        setTimeout(_cargarGroqKey, 400);
        // Cargar key de Mistral OCR al hacer login
        setTimeout(_cargarMistralKey, 500);
        // Re-disparar si los IIFE ya agotaron reintentos antes del login
        setTimeout(function(){
          if(!window._geminiKeyCached || window._geminiKeyCached.length <= 10){
            _cargarYCachearKey().then(function(){
              if(!window._geminiKeyCached || window._geminiKeyCached.length <= 10)
                console.warn('[Gemini] âš  Key no encontrada tras login â€” configÃºrala en âš™ï¸');
            });
          }
          if(!window._groqKeyCached || window._groqKeyCached.length <= 10){
            _cargarGroqKey().then(function(){
              if(!window._groqKeyCached || window._groqKeyCached.length <= 10)
                console.warn('[Groq] âš  Key no encontrada tras login â€” configÃºrala en âš™ï¸ ConfiguraciÃ³n');
            });
          }
        }, 1000);
      }
    }
    if(event === 'SIGNED_OUT'){
      sbSession = null; sbExpiry = 0;
      window.SB_DESPACHO_ID = null;
      window._geminiKeyCached = ''; // limpiar cache Gemini al cerrar sesiÃ³n
      window._groqKeyCached = '';    // limpiar cache Groq al cerrar sesiÃ³n
      window._mistralKeyCached = ''; // limpiar cache Mistral al cerrar sesiÃ³n
      try { localStorage.removeItem('drive_token'); localStorage.removeItem('drive_expiry'); } catch(e){ registrarError('catch vacio', e); }
      mostrarLoginSupabase();
    }
  });
  return window.SB;
}

// Obtener (o crear) el despacho del usuario actual
async function obtenerDespachoActivo(){
  const sb = await initSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if(!user) return null;

  // Buscar despachos en los que sea miembro
  const { data: mems, error } = await sb.from('miembros').select('despacho_id, rol, nombre').eq('user_id', user.id).limit(1);
  if(error){ console.error('[SB] obtenerDespachoActivo:', error); return null; }

  if(mems && mems.length > 0){
    window.SB_DESPACHO_ID = mems[0].despacho_id;
    window.SB_ROL_ACTUAL  = mems[0].rol || 'empleado';
    console.log('[SB] Despacho activo:', window.SB_DESPACHO_ID, 'â€” Rol:', window.SB_ROL_ACTUAL);
    // Cargar config de captura retroactiva ahora que SB_DESPACHO_ID estÃ¡ listo
    setTimeout(function(){
      if(typeof capturaMesCargarSupabase==='function') capturaMesCargarSupabase();
    }, 500);
    return window.SB_DESPACHO_ID;
  }

  // â”€â”€ PROTECCIÃ“N: Si el usuario no es admin, NO crear despacho nuevo â”€â”€â”€â”€â”€â”€
  // Un empleado sin membresÃ­a significa que el admin aÃºn no lo registrÃ³.
  // Crear un despacho vacÃ­o a su nombre serÃ­a un error silencioso grave.
  const esAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  if(!esAdmin){
    console.error('[SB] Usuario sin membresÃ­a asignada:', user.email);
    // Cerrar sesiÃ³n y mostrar mensaje claro
    await sb.auth.signOut();
    sbSession = null; sbExpiry = 0;
    empleadoActual = null;
    mostrarLoginSupabase();
    // Mostrar error descriptivo en el modal de login
    setTimeout(() => {
      const eErr = document.getElementById('sb-err');
      if(eErr){
        eErr.textContent = 'âš  Tu cuenta no tiene acceso al despacho. Pide al administrador que te registre en el sistema.';
        eErr.style.display = 'block';
      }
    }, 400);
    return null;
  }

  // Solo para el admin: crear despacho inicial si no existe (cuenta nueva)
  console.log('[SB] Admin sin despacho â€” creando despacho inicial...');
  const { data: d } = await sb.from('despachos').insert({ nombre: 'Despacho de '+user.email, owner_id: user.id }).select().single();
  if(!d) return null;
  await sb.from('miembros').insert({ despacho_id: d.id, user_id: user.id, rol: 'admin', nombre: user.email.split('@')[0] });
  await sb.from('app_state').insert({
    despacho_id: d.id,
    data: {movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],cierres:[],prestamos:[],saldoAcumulado:0},
    recibos: {folioActual:1, recibos:[]}
  });
  window.SB_DESPACHO_ID = d.id;
  window.SB_ROL_ACTUAL  = 'admin';
  return d.id;
}

// â”€â”€ Verificar sesiÃ³n activa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function tokenOk(){
  return !!(window.SB && window.SB_DESPACHO_ID);
}

// â”€â”€ REEMPLAZA al antiguo iniciarDriveAuth â€” ahora abre modal Supabase
function iniciarDriveAuth() {
  if(sbSession && Date.now() < sbExpiry){
    setStatus('ok','SesiÃ³n activa','ok');
    actualizarAmbossBadges(true);
    return;
  }
  mostrarLoginSupabase();
}

// Modal de login con Supabase (email + password)
function mostrarLoginSupabase(){
  // Cierra otros modales
  document.querySelectorAll('.modal-overlay.show, .modal.show').forEach(m => m.classList.remove('show'));

  let modal = document.getElementById('sb-login-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sb-login-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(12,9,5,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:Outfit,sans-serif;';
    modal.innerHTML = `
      <div style="background:#fdfaf4;border-radius:22px;padding:28px 32px 28px;width:420px;max-width:93vw;box-shadow:0 40px 100px rgba(0,0,0,0.55);">

        <!-- LOGO -->
        <div style="margin-bottom:16px;">
          <img src="data:image/png;base64,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" alt="LEX MÃ‰XICO Despacho JurÃ­dico" style="width:100%;max-width:360px;display:block;">
        </div>

        <!-- TÃTULO -->
        <h2 id="sb-title" style="font-family:sans-serif;font-size:1.45rem;font-weight:700;color:#1a1008;margin:0 0 14px;">Iniciar sesiÃ³n</h2>
        <p id="sb-sub" style="display:none;"></p>

        <!-- CAMPO CORREO -->
        <label style="display:block;font-family:sans-serif;font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8c6518;margin-bottom:5px;">Correo</label>
        <input id="sb-email" type="email" autocomplete="email" placeholder="ejemplo@correo.com"
          style="width:100%;padding:11px 16px;border:2px solid #d4b870;border-radius:12px;font-family:sans-serif;font-size:0.92rem;color:#1a1008;background:#fff;box-sizing:border-box;margin-bottom:12px;outline:none;transition:border-color 0.2s;"
          onfocus="this.style.borderColor='#c8952a'" onblur="this.style.borderColor='#d4b870'">

        <!-- CAMPO CONTRASEÃ‘A -->
        <label style="display:block;font-family:sans-serif;font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8c6518;margin-bottom:5px;">ContraseÃ±a</label>
        <div style="position:relative;margin-bottom:8px;">
          <input id="sb-pwd" type="password" autocomplete="current-password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            style="width:100%;padding:11px 48px 11px 16px;border:2px solid #d4b870;border-radius:12px;font-family:sans-serif;font-size:0.92rem;color:#1a1008;background:#fff;box-sizing:border-box;outline:none;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='#c8952a'" onblur="this.style.borderColor='#d4b870'">
          <!-- Ojo SVG -->
          <button type="button" id="sb-ojo"
            onclick="(function(){const i=document.getElementById('sb-pwd'),c=document.getElementById('sb-pwd-check');i.type=i.type==='password'?'text':'password';c.checked=i.type==='text';})()"
            style="position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:0;color:#7a6840;display:flex;align-items:center;">
            <svg id="sb-ojo-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </button>
        </div>

        <!-- CHECKBOX MOSTRAR CONTRASEÃ‘A -->
        <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-family:monospace;font-size:0.72rem;color:#7a6840;user-select:none;margin-bottom:16px;">
          <input type="checkbox" id="sb-pwd-check"
            onchange="document.getElementById('sb-pwd').type=this.checked?'text':'password';"
            style="width:16px;height:16px;accent-color:#c8952a;cursor:pointer;border-radius:3px;">
          Mostrar contraseÃ±a
        </label>

        <!-- MENSAJE ERROR / OK -->
        <div id="sb-err" style="display:none;background:#fff0f0;color:#c0161a;border:1px solid rgba(192,22,26,0.2);border-radius:8px;padding:9px 13px;font-size:0.8rem;margin-bottom:10px;"></div>
        <div id="sb-ok"  style="display:none;background:#e8f5ec;color:#0f5228;border:1px solid rgba(26,122,58,0.3);border-radius:8px;padding:9px 13px;font-size:0.8rem;margin-bottom:10px;"></div>

        <!-- BOTÃ“N ENTRAR -->
        <button id="sb-go"
          style="width:100%;padding:13px;border:none;border-radius:12px;background:linear-gradient(135deg,#a07020,#c8952a,#e8c060);color:#fff;font-family:sans-serif;font-size:1rem;font-weight:700;cursor:pointer;letter-spacing:0.04em;transition:opacity 0.18s;box-shadow:0 4px 18px rgba(200,149,42,0.35);"
          onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Ingresar</button>
      </div>
    `;
    document.body.appendChild(modal);

    let modoSB = 'login';
    const eEmail = ()=>document.getElementById('sb-email');
    const ePwd   = ()=>document.getElementById('sb-pwd');
    const eErr   = ()=>document.getElementById('sb-err');
    const eOk    = ()=>document.getElementById('sb-ok');

    document.getElementById('sb-go').onclick = async () => {
      const email = eEmail().value.trim();
      const password = ePwd().value;
      eErr().style.display = 'none'; eOk().style.display = 'none';
      if(!email || password.length < 6){
        eErr().textContent = 'Correo y contraseÃ±a (mÃ­n 6 caracteres) requeridos';
        eErr().style.display = 'block'; return;
      }
      const btn = document.getElementById('sb-go');
      btn.disabled = true; btn.textContent = '...';
      try {
        const sb = await initSupabase();
        let res;
        if(false && modoSB === 'signup'){
          res = await sb.auth.signUp({ email, password });
          if(res.error) throw res.error;
          if(!res.data.session){
            eOk().textContent = 'âœ“ Cuenta creada. Revisa tu correo o desactiva "Confirm email" en Supabase para entrar directo.';
            eOk().style.display = 'block';
            btn.disabled = false; btn.textContent = 'Entrar';
            modoSB = 'login';
            document.getElementById('sb-title').textContent = 'Iniciar sesiÃ³n';
            return;
          }
        } else {
          res = await sb.auth.signInWithPassword({ email, password });
          if(res.error) throw res.error;
        }
        // Login exitoso
        sbSession  = 'supabase-active-' + res.data.user.id;
        sbExpiry = Date.now() + 1000*60*60*12;
        window._miUserId = res.data.user.id; // guardar para distinguir cambios propios
        // Cargar config de captura retroactiva despuÃ©s del login
        setTimeout(capturaMesCargarSupabase, 2000);
        empleadoActual = {
          email: res.data.user.email,
          nombre: EMPLEADOS[res.data.user.email.toLowerCase()] || res.data.user.email.split('@')[0]
        };
        try{ localStorage.setItem('empleado_email', empleadoActual.email); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('empleado_nombre', empleadoActual.nombre); } catch(e){ registrarError('localStorage.setItem', e); }
const _despachoOk = await obtenerDespachoActivo();
        // Si obtenerDespachoActivo devuelve null, el empleado no tiene membresÃ­a asignada.
        // La funciÃ³n ya cerrÃ³ la sesiÃ³n y mostrarÃ¡ el error â€” detener el flujo aquÃ­.
        if(!_despachoOk){ btn.disabled = false; btn.textContent = 'Entrar'; return; }
        modal.remove();
        actualizarAmbossBadges(true);
        setStatus('loading','Cargando datos del despacho...','loading');
        await sincronizarFolio();
        setStatus('ok','Sistema conectado â€” ' + empleadoActual.nombre,'ok');
        const _btnCS = document.getElementById('btn-cerrar-sesion'); if(_btnCS) _btnCS.style.display = 'block';
        auditoriaRegistrar('login', 'Inicio de sesiÃ³n â€” ' + empleadoActual.email);
        // Conectar Realtime para sincronizaciÃ³n entre usuarios
        setTimeout(lexRealtimeConectar, 1500);
        // Registrar sesiÃ³n en monitor
        setTimeout(sesionesRegistrarLogin, 2000);
      } catch(e) {
        let msg = e.message || String(e);
        if(/invalid login credentials/i.test(msg)) msg = 'Correo o contraseÃ±a incorrectos';
        else if(/user already registered/i.test(msg)) msg = 'Ya existe una cuenta con ese correo';
        else if(/email not confirmed/i.test(msg)) msg = 'Confirma tu correo o desactiva la confirmaciÃ³n en Supabase';
        eErr().textContent = msg;
        eErr().style.display = 'block';
        btn.disabled = false;
        btn.textContent = modoSB==='login' ? 'Entrar' : 'Crear cuenta';
      }
    };

    // Enter para enviar
    [eEmail(), ePwd()].forEach(el => {
      el.addEventListener('keypress', e => {
        if(e.key === 'Enter') document.getElementById('sb-go').click();
      });
    });

    setTimeout(()=> eEmail().focus(), 100);
  } else {
    modal.style.display = 'flex';
  }
}

function actualizarDriveBadge(ok){ // Ahora gestiona estado Supabase
  actualizarAmbossBadges(ok);
}

// â•â•â• MEJORA 3: INDICADOR DE ESTADO DE SINCRONIZACIÃ“N â•â•â•
// Estados: 'idle' (todo guardado), 'syncing' (subiendo a Supabase),
//          'error' (fallÃ³ Ãºltima subida), 'pending' (cambios sin subir)
let _syncState = 'idle';
let _syncCounter = 0;     // contador de operaciones en curso
let _lastSyncTime = null;
let _lastSyncError = null;
let _syncCounterChangedAt = Date.now();  // timestamp del Ãºltimo cambio del contador

function setSyncState(estado, error) {
  _syncState = estado;
  if (estado === 'idle') _lastSyncTime = Date.now();
  if (estado === 'error') _lastSyncError = error || 'Error desconocido';
  if (estado === 'syncing') _lastSyncError = null;
  renderSyncIndicator();
  // Actualizar medidor de Drive cuando cambia el estado de sincronizaciÃ³n
  if (typeof actualizarMedidorDrive === 'function') {
    setTimeout(actualizarMedidorDrive, 100);
  }
}

function syncStart() {
  _syncCounter++;
  _syncCounterChangedAt = Date.now();
  if (_syncCounter > 0) setSyncState('syncing');
}

function syncEnd(exito, errorMsg) {
  _syncCounter = Math.max(0, _syncCounter - 1);
  _syncCounterChangedAt = Date.now();
  if (_syncCounter === 0) {
    setSyncState(exito ? 'idle' : 'error', errorMsg);
  }
}

// â”€â”€ WATCHDOG: previene atascos permanentes del contador â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Si una operaciÃ³n llamÃ³ syncStart() pero por algÃºn error de red u
// otra excepciÃ³n nunca llamÃ³ su syncEnd() correspondiente, el contador
// se quedarÃ­a en >0 indefinidamente y el modal "SincronizaciÃ³n en curso"
// aparecerÃ­a siempre al recargar. Este watchdog detecta ese caso:
// si el contador lleva >15 segundos sin cambiar y aÃºn estÃ¡ en >0,
// lo resetea automÃ¡ticamente.
function _syncWatchdog() {
  if (_syncCounter > 0) {
    const inactividad = Date.now() - _syncCounterChangedAt;
    if (inactividad > 15000) {
      console.warn('[syncWatchdog] Contador atascado en', _syncCounter,
        'por', Math.round(inactividad/1000), 'segundos â€” reseteando');
      _syncCounter = 0;
      _syncCounterChangedAt = Date.now();
      setSyncState('idle');
    }
  }
}
setInterval(_syncWatchdog, 5000);  // revisar cada 5 segundos

function renderSyncIndicator() {
  // Actualizar el chip existente para reflejar estado de sincronizaciÃ³n
  const dot = document.getElementById('driveDot');
  const lbl = document.getElementById('driveLabel');
  if (!dot || !lbl) return;
  
  const driveOk = sbSession && Date.now() < sbExpiry;
  if (!driveOk) {
    // SesiÃ³n desconectada: el badge normal se encarga
    return;
  }
  
  if (_syncState === 'syncing') {
    dot.className = 'drive-dot syncing';
    lbl.textContent = 'Guardando en Supabase...';
  } else if (_syncState === 'error') {
    dot.className = 'drive-dot err';
    lbl.textContent = 'âš  Error al guardar â€” clic para reintentar';
  } else if (_syncState === 'pending') {
    dot.className = 'drive-dot pending';
    lbl.textContent = 'Cambios sin guardar';
  } else {
    // idle: todo OK
    dot.className = 'drive-dot on';
    if (_lastSyncTime) {
      const segundos = Math.round((Date.now() - _lastSyncTime) / 1000);
      if (segundos < 5) {
        lbl.textContent = 'Supabase âœ“ guardado';
      } else if (segundos < 60) {
        lbl.textContent = 'Supabase âœ“ hace ' + segundos + 's';
      } else {
        const min = Math.round(segundos / 60);
        lbl.textContent = 'Supabase âœ“ hace ' + min + 'min';
      }
    } else {
      lbl.textContent = 'Supabase âœ“';
    }
  }
}

// Actualizar el indicador cada 10 segundos para refrescar el "hace Xs"
setInterval(function(){
  if (_syncState === 'idle') renderSyncIndicator();
}, 10000);

// â•â•â• MEJORA: DETECTOR DE CONECTIVIDAD (online/offline) â•â•â•
// Muestra/oculta un chip rojo en el sidebar cuando se pierde internet.
// Cuando vuelve la conexiÃ³n, intenta resincronizar lo que estÃ© pendiente.
let _conexionPerdidaTime = null;

function actualizarEstadoConexion() {
  const chip = document.getElementById('connChip');
  if (!chip) return;
  const online = navigator.onLine;
  
  if (online) {
    chip.style.display = 'none';
    if (_conexionPerdidaTime !== null) {
      // VolviÃ³ la conexiÃ³n â€” notificar
      const segundos = Math.round((Date.now() - _conexionPerdidaTime) / 1000);
      const tiempoTxt = segundos < 60 ? segundos + 's' : Math.round(segundos/60) + 'min';
      toast('ðŸŒ ConexiÃ³n restablecida (estuvo offline ' + tiempoTxt + ')', 'ok');
      _conexionPerdidaTime = null;
      // Intentar resincronizar con Supabase
      try {
        if (sbSession && Date.now() < sbExpiry) {
          // Re-disparar guardado para mandar lo que estÃ© en localStorage a Supabase
          syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
        }
      } catch(e){ console.warn('reconectar:', e); }
    }
  } else {
    chip.style.display = 'flex';
    if (_conexionPerdidaTime === null) {
      _conexionPerdidaTime = Date.now();
      toast('âš  Sin conexiÃ³n a internet â€” los cambios se guardan localmente', 'err');
      // Marcar el indicador como pendiente
      if (typeof setSyncState === 'function') setSyncState('pending');
    }
  }
  // Actualizar medidor cuando cambia conectividad
  if (typeof actualizarMedidorDrive === 'function') {
    setTimeout(actualizarMedidorDrive, 100);
  }
}

window.addEventListener('online', actualizarEstadoConexion);
window.addEventListener('offline', actualizarEstadoConexion);
// Verificar al cargar
setTimeout(actualizarEstadoConexion, 1000);
function actualizarAmbossBadges(ok){
  // Badge del encabezado del recibo
  const dot1 = document.getElementById('driveDot');
  const lbl1 = document.getElementById('driveLabel');
  if(dot1) dot1.className = 'drive-dot '+(ok?'on':'err');
  if(lbl1){ const nombre = empleadoActual ? empleadoActual.nombre : (ok ? NOMBRE_TITULAR : ''); lbl1.textContent = ok ? ('Conectado Â· ' + nombre + ' âœ“') : 'Error â€” Reconectar'; }
  // Ocultar barra al conectar
  const bar = document.querySelector('.drive-bar');
  if(bar) bar.style.display = ok ? 'none' : 'flex';
  const horaBadge = document.getElementById('hora-badge');
  if(horaBadge) horaBadge.style.display = ok ? 'none' : 'flex';
  // Badge del sidebar (chip de conexiÃ³n)
  const dot2 = document.getElementById('driveDot');
  const lbl2 = document.getElementById('driveLabel');
  if(dot2) dot2.className = 'drive-dot '+(ok?'on':'err');
  if(lbl2) lbl2.textContent = ok ? 'Supabase âœ“' : 'Reconectar Supabase';
}

// â”€â”€ DETECTAR EMPLEADO POR CUENTA GOOGLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function detectarEmpleado(){
  // En Supabase ya tenemos al usuario del login. Solo aseguramos el campo "responsable".
  if(!empleadoActual){
    const emailLS = localStorage.getItem('empleado_email');
    const nombreLS = localStorage.getItem('empleado_nombre');
    if(emailLS && nombreLS) empleadoActual = { email: emailLS, nombre: nombreLS };
  }
  if(empleadoActual){
    const respField = $('responsable');
    if(respField){
      const esAdmin = empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      if(esAdmin){
        // Admin: convertir en selector con todos los empleados
        const sel = document.createElement('select');
        sel.id = 'responsable';
        sel.style.cssText = respField.style.cssText;
        sel.className = respField.className;
        sel.style.textTransform = 'uppercase';
        sel.style.fontFamily = 'Outfit,sans-serif';
        Object.entries(EMPLEADOS).forEach(([email, nombre]) => {
          const opt = document.createElement('option');
          opt.value = nombre;
          opt.textContent = nombre;
          if(nombre === empleadoActual.nombre) opt.selected = true;
          sel.appendChild(opt);
        });
        respField.parentNode.replaceChild(sel, respField);
      } else {
        // Empleado: solo lectura con su nombre
        respField.value = empleadoActual.nombre;
        respField.readOnly = true;
        respField.style.opacity = '0.75';
        respField.style.cursor = 'not-allowed';
      }
    }
    console.log('âœ“ Empleado activo:', empleadoActual.nombre, '(' + empleadoActual.email + ')');
  }
}

// â”€â”€ PARTE 1: ESTADO PERSISTENTE EN SUPABASE (antes JSON en Drive) â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _sincronizando = false;
let _sincronizandoTs = 0; // timestamp para detectar locks infinitos

async function sincronizarFolio(){
  // Guard: si lleva mÃ¡s de 15s activo, el flag quedÃ³ trabado â€” resetear
  if(_sincronizando && (Date.now() - _sincronizandoTs) < 15000) return;
  if(!window.SB || !window.SB_DESPACHO_ID){
    console.warn('[SB] sincronizarFolio: sin sesiÃ³n / despacho');
    return;
  }
  _sincronizando = true;
  _sincronizandoTs = Date.now();
  try {
    // Leer el estado del despacho desde la tabla app_state
    const { data, error } = await window.SB
      .from('app_state')
      .select('data, recibos, folio_actual')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .single();

    if(error){
      // Si no existe, crearlo
      if(error.code === 'PGRST116'){
        console.log('[SB] No hay estado previo â€” creando inicial...');
        await window.SB.from('app_state').insert({
          despacho_id: window.SB_DESPACHO_ID,
          data: {movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],cierres:[],prestamos:[],saldoAcumulado:0},
          recibos: {folioActual:1, recibos:[]},
          folio_actual: 100
        });
        appData = { folioActual: 1, anioFolioActual: new Date().getFullYear(), recibos: [] };
      } else {
        console.error('[SB] sincronizarFolio:', error);
      }
    } else if(data){
      // Reconstruir appData â€” SIEMPRE usar Supabase para recibos
      // (la columna 'recibos' es la fuente de verdad, no el backup local)
      const recibosData = data.recibos || {};
      const sbRecibos = recibosData.recibos || [];
      appData = {
        folioActual:     recibosData.folioActual || data.folio_actual || 1,
        anioFolioActual: recibosData.anioFolioActual || new Date().getFullYear(),
        recibos:         sbRecibos
      };

      // Reconstruir D â€” PROTECCIÃ“N TOTAL CONTRA PÃ‰RDIDA DE DATOS
      if(typeof D !== 'undefined' && data.data){

        const sbMovs    = data.data.movimientos || [];
        const sbJuicios = data.data.juicios     || [];
        const sbPends   = data.data.pendientes  || [];

        // Hacer backup del estado actual ANTES de cualquier cambio
        try { if(typeof backupLocal==='function') backupLocal('D', D); } catch(e){ registrarError('catch vacio', e); }

        // Regla: si Supabase trae MENOS datos que lo actual en memoria â†’ NO sobreescribir
        const movsActuales    = (D.movimientos||[]).length;
        const juiciosActuales = (D.juicios||[]).length;

        const usarMovsSB    = sbMovs.length    >= movsActuales    || movsActuales    === 0;

        // Para juicios: comparar por timestamp ademÃ¡s de cantidad.
        // Si los juicios locales tienen alguno mÃ¡s reciente que cualquier juicio en SB â†’ conservar local.
        const tsMaxLocal = Math.max(0, ...(D.juicios||[]).map(j => j.updatedAt || 0));
        const tsMaxSB    = Math.max(0, ...sbJuicios.map(j => j.updatedAt || 0));
        const usarJuiciosSB = sbJuicios.length > juiciosActuales
          || juiciosActuales === 0
          || (sbJuicios.length >= juiciosActuales && tsMaxSB >= tsMaxLocal);

        if (!usarMovsSB)    console.warn('[SB] Supabase movs('+sbMovs.length+') < memoria('+movsActuales+') â€” conservando memoria');
        if (!usarJuiciosSB) console.warn('[SB] Supabase juicios('+sbJuicios.length+') < memoria('+juiciosActuales+') â€” conservando memoria');

        D.movimientos    = usarMovsSB    ? sbMovs    : D.movimientos;
        D.juicios        = usarJuiciosSB ? sbJuicios : D.juicios;
        D.directorio     = data.data.directorio     || D.directorio  || [];
        D.carpetas       = data.data.carpetas       || D.carpetas     || [];
        D.pendientes     = sbPends.length >= (D.pendientes||[]).length ? sbPends : D.pendientes;
        // Migrar pendientes legacy: marca/clase â†’ vehMarca/vehClase
        (D.pendientes||[]).forEach(p=>{ if(p.seccion==='placas'){ if(!p.vehMarca&&p.marca) p.vehMarca=p.marca; if(!p.vehClase&&p.clase) p.vehClase=p.clase; } });
        D.cierres               = data.data.cierres               || D.cierres               || [];
        D.prestamos             = data.data.prestamos             || D.prestamos             || [];
        D.saldoAcumulado        = data.data.saldoAcumulado        || D.saldoAcumulado        || 0;
        D.escrituras            = data.data.escrituras            || D.escrituras            || [];
        D.recibosExcluidosCaja  = data.data.recibosExcluidosCaja  || D.recibosExcluidosCaja  || [];
        // â”€â”€ Proteger captura_meses: nunca sobreescribir con vacÃ­o â”€â”€
        const sbCapturaMeses = data.data.captura_meses || {};
        const localCapturaMeses = capturaMesCargar() || {};
        // Usar el que tenga mÃ¡s meses configurados (el mÃ¡s completo)
        const sbKeys    = Object.keys(sbCapturaMeses).length;
        const localKeys = Object.keys(localCapturaMeses).length;
        if(sbKeys >= localKeys && sbKeys > 0){
          D.captura_meses = sbCapturaMeses;
          try{ localStorage.setItem(CAPTURA_KEY, JSON.stringify(sbCapturaMeses)); } catch(e){ registrarError('localStorage.setItem', e); }
} else if(localKeys > 0){
          D.captura_meses = localCapturaMeses;
          // Si el local tiene mÃ¡s datos, subir a Supabase
          if(localKeys > sbKeys){
            setTimeout(function(){
              window.SB.from('app_state').select('data').eq('despacho_id', window.SB_DESPACHO_ID).single()
                .then(function(r){
                  if(r.data && r.data.data){
                    r.data.data.captura_meses = localCapturaMeses;
                    window.SB.from('app_state').update({data: r.data.data}).eq('despacho_id', window.SB_DESPACHO_ID).then(function(){
                      console.log('[CapturaMes] Local mÃ¡s completo subido a Supabase');
                    });
                  }
                }).catch(function(e){ registrarError('Promise catch vacio', e); });
            }, 1000);
          }
        } else {
          D.captura_meses = {};
        }

        // Si conservamos datos locales mÃ¡s completos â†’ subirlos a Supabase
        if (!usarMovsSB || !usarJuiciosSB) {
          _ultimoSyncPropio = Date.now();
          setTimeout(function(){ syncEstadoSupabase().catch((e)=>{ registrarError('Promise catch vacio', e); }); }, 500);
        }
      }

      // MigraciÃ³n: asignar anio_folio a recibos histÃ³ricos que no lo tienen
      // Se asume 2026 para todos los recibos existentes sin el campo
      (appData.recibos||[]).forEach(r => {
        if(!r.anio_folio) r.anio_folio = 2026;
      });

      // Reconstruir REC
      if(typeof REC !== 'undefined'){
        REC.folioActual = appData.folioActual;
        REC.recibos     = appData.recibos;
      }

      console.log('[SB] Estado cargado:', {
        folio: appData.folioActual,
        recibos: (appData.recibos||[]).length,
        movimientos: (D?.movimientos||[]).length,
        juicios: (D?.juicios||[]).length,
        carpetas: (D?.carpetas||[]).length,
        directorio: (D?.directorio||[]).length
      });
    }

    // Refrescar UI
    if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
    if(typeof renderHistorial==='function') renderHistorial();
    if(typeof renderCaja==='function') renderCaja();
    if(typeof renderContab==='function') renderContab();
    if(typeof renderJuicios==='function') renderJuicios();
    if(typeof renderCarp==='function') renderCarp();
    if(typeof renderDirec==='function') renderDirec();
    if(typeof renderPend==='function') renderPend();
    if(typeof badges==='function') badges();
    if(typeof capturaMesCargarSupabase==='function') capturaMesCargarSupabase();

  } catch(e){
    console.error('[SB] sincronizarFolio error:', e);
  } finally {
    _sincronizando = false;
  }
}

// â”€â”€ Helper: carga datos del JSON con soporte de formatos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _cargarDatosDesdeJSON(data){
  if(data && typeof data.folioActual === 'number'){
    appData.folioActual = data.folioActual;
    appData.recibos     = data.recibos || [];
  } else if(data && (data.folio_actual || data.siguiente_folio)){
    // Formato legacy â€” corregir y reescribir
    console.warn('âš  Formato JSON legacy detectado â€” migrando...');
    appData.folioActual = data.folio_actual || data.siguiente_folio || data.folio_inicial || 1;
    appData.anioFolioActual = data.anio_folio_actual || new Date().getFullYear();
    appData.recibos     = data.recibos || [];
    actualizarArchivoControl(); // reescribir con formato correcto (no bloqueante)
  } else {
    // Archivo vacÃ­o o corrupto â€” mantener el folio en memoria sin resetear a 100
    console.warn('âš  JSON sin datos vÃ¡lidos â€” manteniendo estado en memoria');
    if(!appData.folioActual || appData.folioActual < 1) appData.folioActual = 1;
  }
}

// â”€â”€ RESERVAR FOLIO ATÃ“MICO EN DRIVE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Implementa "optimistic locking" con reintentos:
// 1. Lee el folio actual desde Supabase (fresco, no cachÃ©)
// 2. Intenta escribir folio+1 inmediatamente
// 3. Si dos usuarios colisionan, el que llegue segundo reintenta con el folio ya incrementado
// Garantiza que dos usuarios nunca obtengan el mismo folio.
async function reservarFolioEnDrive(){
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RESERVA ATÃ“MICA DE FOLIO â€” vÃ­a funciÃ³n SQL en PostgreSQL
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // Antes: lectura â†’ incremento JS â†’ escritura (race condition)
  // Ahora: UNA llamada RPC que PostgreSQL ejecuta atÃ³micamente.
  // Es IMPOSIBLE que dos llamadas obtengan el mismo folio.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  if(!window.SB || !window.SB_DESPACHO_ID){
    // Sin sesiÃ³n: fallback local (solo para que no rompa offline)
    const f = appData.folioActual;
    appData.folioActual = f + 1;
    console.warn('âš  Folio local usado (sin sesiÃ³n Supabase):', f);
    return f;
  }

  try {
    // Llamada atÃ³mica a PostgreSQL â€” lock + increment + return en 1 transacciÃ³n
    const { data: folio, error } = await window.SB.rpc('reservar_folio_atomico', {
      p_despacho_id: window.SB_DESPACHO_ID
    });

    if(error) throw error;
    if(folio == null) throw new Error('La funciÃ³n no devolviÃ³ folio');

    // Actualizar display local (solo cosmÃ©tico, la fuente de verdad es la DB)
    appData.folioActual = folio + 1;
    console.log('âœ“ Folio reservado (atÃ³mico):', folio, 'â€” prÃ³ximo:', folio + 1);
    return folio;

  } catch(e) {
    console.error('âŒ reservarFolioEnDrive (RPC):', e);

    // Fallback local: buscar el primer folio que NO exista ya en appData.recibos
    console.warn('âš  Usando fallback local para folio (RPC no disponible)');
    const recibosActuales = new Set((appData.recibos || []).map(r => r.folio));
    let f = Math.max(
      appData.folioActual || 1,
      // tambiÃ©n considerar el mayor folio existente + 1
      ...([...(appData.recibos || [])].map(r => (r.folio || 0) + 1))
    );
    // Saltar cualquier folio ya usado
    while(recibosActuales.has(f)) f++;
    appData.folioActual = f + 1;
    console.warn('âš  Folio fallback asignado:', f, '(prÃ³ximo:', f+1, ')');
    return f;
  }
}

async function crearArchivoControl(){
  // En Supabase ya se crea el app_state vÃ­a trigger al registrar usuario.
  // Pero si por algo no existe, lo creamos aquÃ­.
  if(!window.SB || !window.SB_DESPACHO_ID) return 'supabase';
  const { error } = await window.SB.from('app_state').upsert({
    despacho_id: window.SB_DESPACHO_ID,
    data: {movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],cierres:[],prestamos:[],saldoAcumulado:0},
    recibos: { folioActual:1, anioFolioActual: new Date().getFullYear(), recibos:[] },
    folio_actual: 100
  });
  if(error) console.error('[SB] crearArchivoControl:', error);
  return 'supabase';
}

async function actualizarArchivoControl(){
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  syncStart();
  try {
    // Estructura compatible con la versiÃ³n anterior
    const ligero = {
      folioActual: appData.folioActual,
      anioFolioActual: appData.anioFolioActual || new Date().getFullYear(),
      recibos: appData.recibos.map(r=>({
        folio:r.folio, anio_folio:r.anio_folio||new Date().getFullYear(),
        nombre:r.nombre, fecha:r.fecha, hora:r.hora,
        archivo:r.archivo, saldoPendiente:r.saldoPendiente,
        esComplemento:r.esComplemento||false, folioRef:r.folioRef||null,
        generadoPor:r.generadoPor||NOMBRE_TITULAR,
        clientes: r.clientes||[{nombre:r.nombre||'',movil:'',tel:'',domicilio:''}],
        tipoTramite: r.tipoTramite||'normal',
        tipo_doc: r.tipo_doc||'copia',
        copias: r.copias||[],
        tramites: r.tramites||'',
        clase:r.clase||'', marca:r.marca||'', serie:r.serie||'',
        motor:r.motor||'', anio:r.anio||'', puertas:r.puertas||'',
        color_veh:r.color_veh||'', transmision:r.transmision||'',
        cilindros:r.cilindros||'', placa:r.placa||'',
        ultima_tenencia:r.ultima_tenencia||'', origen:r.origen||'', combustible:r.combustible||'',
        responsable: r.responsable||'',
        nombre_cliente_firma: r.nombre_cliente_firma||'',
        fecha_recibo: r.fecha_recibo||r.fecha||'',
        hora_recibo: r.hora_recibo||r.hora||'',
        anticipo: r.anticipo||'0',
        conceptos: r.conceptos||[],
        total: r.total||0,
        costosExtra: r.costosExtra||[],
        pagosParciales: r.pagosParciales||[],
        fechasImpresion: r.fechasImpresion||[],
        placasEntregadas: r.placasEntregadas||null,
        estadoPlacas: r.estadoPlacas||null,
        cancelado: r.cancelado||false,
        motivoCancelacion: r.motivoCancelacion||'',
        fechaCancelacion: r.fechaCancelacion||''
      }))
    };

    const { error } = await window.SB
      .from('app_state')
      .update({
        recibos: ligero,
        folio_actual: ligero.folioActual,
        updated_by: (await window.SB.auth.getUser()).data.user?.id || null
      })
      .eq('despacho_id', window.SB_DESPACHO_ID);

    if(error){
      throw new Error('actualizarArchivoControl: '+error.message);
    }
    console.log('âœ“ archivoControl actualizado â€” folioActual:', ligero.folioActual, 'â€” recibos:', ligero.recibos.length);
    try { backupAppData(); } catch(e){ console.warn('backup appData:', e); }
    // â”€â”€ Notificar a otros usuarios que los recibos cambiaron â”€â”€
    try { lexRealtimeBroadcast(); } catch(e){ registrarError('catch vacio', e); }
    syncEnd(true);
  } catch(e) {
    syncEnd(false, e.message || 'Error al sincronizar recibos');
    throw e;
  }
}

// â”€â”€ PARTE 2: SUBIR PDF A SUPABASE STORAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function subirPDFaDrive(pdfBlob, nombreArchivo){
  if(!window.SB || !window.SB_DESPACHO_ID) return false;
  try {
    const path = window.SB_DESPACHO_ID + '/recibos/' + nombreArchivo;
    const { error } = await window.SB.storage.from(STORAGE_BUCKET).upload(path, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true
    });
    if(error){ console.error('subirPDFaDrive:', error); return false; }
    console.log('âœ“ PDF subido a Supabase:', nombreArchivo);
    return true;
  } catch(e){ console.error('subirPDFaDrive:', e); return false; }
}

// Reemplaza un PDF existente (mismo nombre) o lo sube si no existe
async function reemplazarPDFenDrive(pdfBlob, nombreArchivo){
  // En Supabase Storage upsert:true ya cubre ambos casos
  return await subirPDFaDrive(pdfBlob, nombreArchivo);
}

// Compat: driveGET ahora retorna estado desde Supabase
async function driveGET(url){
  // Algunas funciones legacy invocan driveGET con URLs de Drive especÃ­ficas.
  // Mapeamos la Ãºnica realmente Ãºtil (leer el JSON principal) y devolvemos
  // el estado actual desde Supabase.
  if(!window.SB || !window.SB_DESPACHO_ID) return null;
  const { data, error } = await window.SB
    .from('app_state')
    .select('data, recibos, folio_actual')
    .eq('despacho_id', window.SB_DESPACHO_ID)
    .single();
  if(error){
    console.warn('[SB] driveGET compat:', error.message);
    return { folioActual: appData.folioActual || 1, anioFolioActual: appData.anioFolioActual || new Date().getFullYear(), recibos: appData.recibos || [] };
  }
  // Si la URL pide files/list, devolver lista no-vacÃ­a para compat
  if(url && url.includes('files?q=')){
    return { files: [{ id: 'supabase', name: 'lexmexico_folio_control.json', createdTime: new Date().toISOString() }] };
  }
  // Devolver el contenido del archivo de control en formato esperado
  return data.recibos || { folioActual: data.folio_actual || 100, recibos: [] };
}

// â”€â”€ PARTE 4: GUARDAR EN DIRECTORIO (antes Sheets, ahora estado) â”€â”€
async function guardarEnDirectorio(datos){
  // El directorio se sincroniza automÃ¡ticamente vÃ­a el array D.directorio,
  // que se persiste como parte del estado. Esta funciÃ³n ahora solo
  // agrega/actualiza contactos en memoria y dispara sync.
  if(typeof D === 'undefined') return false;
  try {
    if(!Array.isArray(D.directorio)) D.directorio = [];
    const folioStr = folioFormato(dados_folio_tmp);
    (datos.clientes || []).forEach(c => {
      const nombre = (c.nombre || '').trim();
      if(!nombre) return;
      const tel = c.movil || c.tel || '';
      const dom = c.domicilio || '';
      const existe = D.directorio.find(d => (d.nombre||'').trim().toLowerCase() === nombre.toLowerCase());
      if(existe){
        // Si hay tel nuevo, agregar al historial
        if(tel && tel !== existe.telefono){
          if(!Array.isArray(existe.historial)) existe.historial = [];
          existe.historial.push({ tel: existe.telefono, fecha: new Date().toISOString().slice(0,10) });
          existe.telefono = tel;
        }
        if(dom && !existe.domicilio) existe.domicilio = dom;
        if(datos.tramites) existe.tramite = datos.tramites;
        existe.folio_ref = folioStr;
      } else {
        D.directorio.push({
          nombre, telefono: tel, domicilio: dom,
          tramite: datos.tramites || '',
          fecha_alta: datos.fecha_recibo || new Date().toISOString().slice(0,10),
          folio_ref: folioStr,
          historial: []
        });
      }
    });
    // Persistir cambios
    try{ if(typeof save==='function') save(); }catch(e){ console.warn('guardarEnDirectorio save:',e); }
    console.log('âœ“ Directorio actualizado para folio #'+folioStr);
    return true;
  } catch(e){
    console.error('guardarEnDirectorio:', e);
    return false;
  }
}

// â”€â”€ PARTE 3: PAGOS COMPLEMENTARIOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function abrirComplemento(folioOrig){
  // â”€â”€ GUARDIA DE SESIÃ“N â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if(!sbSession || Date.now() >= sbExpiry){
    mostrarDriveOverlay('abrirComplemento_'+folioOrig);
    return;
  }

  const recibo = appData.recibos.find(r=>r.folio===folioOrig);
  if(!recibo){ showModal('No encontrado','Recibo no encontrado en historial.'); return; }
  const saldo = recibo.saldoPendiente!==undefined ? recibo.saldoPendiente : 0;
  if(saldo<=0){ showModal('Sin saldo','El recibo #'+folioFormato(folioOrig)+' ya estÃ¡ liquidado.'); return; }
  const pago = parseFloat(prompt(
    'Recibo #'+folioFormato(folioOrig)+'\n'+
    'Cliente: '+recibo.nombre+'\n'+
    'Saldo pendiente: $'+fmtMXN(saldo)+'\n\n'+
    'Â¿CuÃ¡nto abona en este pago?'
  ));
  if(isNaN(pago)||pago<=0) return;
  const auth = await pedirAutorizacion();
  if(auth === null){ setStatus('ok','Complemento cancelado â€” autorizaciÃ³n no proporcionada','ok'); return; }
  window._autorizacionActual = auth;
  generarComplemento(recibo, Math.min(pago,saldo));
}

async function generarComplemento(reciboOrig, pago){
  const saldoAnterior  = reciboOrig.saldoPendiente !== undefined ? reciboOrig.saldoPendiente : 0;
  const saldoNuevo     = Math.max(0, saldoAnterior - pago);
  const liquidado      = pago >= saldoAnterior;

  const autorizacion = window._autorizacionActual || null;
  window._autorizacionActual = null;

  // Reservar folio atÃ³mico (igual que en recibo normal)
  const folioComp = await reservarFolioEnDrive();

  const datos = {
    folio:folioComp, folioRef:reciboOrig.folio, esComplemento:true,
    nombre:reciboOrig.nombre,
    fecha_recibo:new Date().toISOString().split('T')[0],
    hora_recibo:new Date().toTimeString().slice(0,5),
    pago, saldoAnterior, saldoNuevo, liquidado,
    responsable: reciboOrig.responsable || $('responsable')?.value || '',
    nombre_cliente_firma: reciboOrig.nombre_cliente_firma || reciboOrig.nombre || '',
    autorizacion: autorizacion
  };

  const doc = await generarPDFComplemento(datos);
  const prefijo = liquidado ? 'LIQUIDADO' : 'COMPLEMENTO';
  const nombreArchivo = 'Recibo_'+folioFormato(folioComp)+'_'+prefijo
    +'_ref'+folioFormato(reciboOrig.folio, reciboOrig.anio_folio)
    +'_'+reciboOrig.nombre.replace(/\s+/g,'_')+'.pdf';

  // Guardar en la nube silenciosamente
  subirPDFaDrive(doc.output('blob'), nombreArchivo).catch(e=>console.warn('SB:',e));

  // Actualizar saldo del recibo original
  const idx = appData.recibos.findIndex(r=>r.folio===reciboOrig.folio);
  if(idx>=0){
    // â”€â”€ Snapshot ANTES de mutar â€” historial de versiones â”€â”€â”€â”€â”€â”€â”€â”€â”€
    _guardarSnapshotRecibo(appData.recibos[idx], 'Complemento de pago Â· Folio #'+folioFormato(folioComp));
    appData.recibos[idx].saldoPendiente = saldoNuevo;
  }

  // Agregar al historial con generadoPor
  appData.recibos.unshift({
    folio:folioComp, nombre:reciboOrig.nombre, fecha:datos.fecha_recibo,
    hora:datos.hora_recibo, archivo:nombreArchivo, esComplemento:true,
    folioRef:reciboOrig.folio, saldoPendiente:saldoNuevo,
    pago, pdfBase64: doc.output('datauristring'),
    generadoPor: empleadoActual ? empleadoActual.nombre : NOMBRE_TITULAR
  });
  // â”€â”€ ESCRITURA BLOQUEANTE: esperar que Supabase confirme el guardado â”€â”€
  // Evita que una impresiÃ³n siguiente lea el JSON antes de que este complemento quede registrado.
  try {
    await actualizarArchivoControl();
  } catch(eCtrl) {
    console.error('âŒ Error guardando complemento:', eCtrl);
    try { await actualizarArchivoControl(); } catch(e2){ console.error('âŒ Segundo intento fallido:', e2); }
  }
  actualizarFolioDisplay(); renderHistorial();
  // Si se liquidÃ³, eliminar el pendiente de placas vinculado
  if (liquidado) _eliminarPendientePorFolio(reciboOrig.folio);
  setStatus('ok', liquidado ? 'Recibo #'+folioFormato(reciboOrig.folio, reciboOrig.anio_folio)+' LIQUIDADO âœ“'
    : 'Complemento #'+folioFormato(folioComp)+' generado','ok');

  // Abrir en nueva pestaÃ±a para ver con opciones de descargar/imprimir
  const pdfBlob2 = doc.output('blob');
  const nombreComp = 'Complemento_'+folioFormato(folioComp)+'.pdf';
  imprimirDesdeBlob(pdfBlob2, nombreComp);
}

  // â”€â”€ REGISTRAR INGRESO EN CAJA/CONTABILIDAD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if(typeof D !== 'undefined' && Array.isArray(D.movimientos)){
    const tipoMov = liquidado ? 'LiquidaciÃ³n' : 'Abono parcial';
    const mov = {
      id: 'M-COMP-' + folioComp + '-' + Date.now(),
      folioCaja: '',
      fecha: reciboOrig.fecha_recibo || reciboOrig.fecha || (typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0]),
      hora: reciboOrig.hora_recibo || reciboOrig.hora || (typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5)),
      descripcion: (function(){
        const c0 = reciboOrig.conceptos && reciboOrig.conceptos[0];
        const conc = c0 ? (c0.concepto||'') : '';
        const desc = c0 ? (c0.descripcion||'') : '';
        const txt  = conc + (desc ? ' â€” ' + desc : '');
        return tipoMov + ' Â· Recibo #' + folioFormato(reciboOrig.folio, reciboOrig.anio_folio) + ' Â· ' + (reciboOrig.nombre||'') + (txt ? ' Â· ' + txt : '');
      })(),
      nombre: reciboOrig.nombre || '',
      folio: reciboOrig.folio,
      monto: pago,
      tipo: 'ingreso',
      cat: (liquidado ? 'LiquidaciÃ³n' : 'Abono parcial') + ' Â· #' + folioFormato(reciboOrig.folio, reciboOrig.anio_folio),
      estatus: liquidado ? 'Liquidado' : 'Abono parcial',
      fuente: 'recibo',
      responsable: typeof empNombre === 'function' ? empNombre() : (reciboOrig.responsable||'')
    };
    _registrarMovimiento(mov);
    if(typeof save === 'function') save();
    if(typeof renderCaja === 'function') renderCaja();
    if(typeof renderContab === 'function') renderContab();
    syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
  }
// â”€â”€ PDF COMPLEMENTO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generarPDFComplemento(datos){
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
  const margin=14,pageW=215.9,cW=pageW-margin*2;
  const logoObj = await getLogoDataURL();

  // â”€â”€ ENCABEZADO (idÃ©ntico al recibo normal) â”€â”€
  const hBotC = dibujarEncabezadoPDF(doc, margin, cW, datos.folio, logoObj);
  const yAftC = hBotC + 7;

  // Titulo
  const tipo = datos.liquidado ? 'RECIBO DE LIQUIDACIÃ“N' : 'RECIBO COMPLEMENTARIO';
  doc.setTextColor(154,110,24); doc.setFontSize(10); doc.setFont('times','bold');
  doc.text(tipo,margin,yAftC);
  doc.setFontSize(7.5); doc.setFont('helvetica','italic'); doc.setTextColor(80,65,40);
  doc.text('Referencia Folio Original: #'+folioFormato(datos.folioRef),margin,yAftC+5);
  const fechaStr=datos.fecha_recibo?new Date(datos.fecha_recibo+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}):'';
  doc.setFont('helvetica','normal');
  doc.text(fechaStr+' â€” '+datos.hora_recibo+' hrs.',pageW-margin,yAftC,{align:'right'});
  doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.line(margin,yAftC+8,pageW-margin,yAftC+8);

  let y=yAftC+16;
  // Cliente
  doc.setFillColor(248,244,232); doc.rect(margin,y-4,cW,5.5,'F');
  doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
  doc.text('DATOS DEL CLIENTE',margin+1,y); y+=6;
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
  doc.text(datos.nombre,margin,y); y+=12;

  // Resumen
  doc.setFillColor(248,244,232); doc.rect(margin,y-4,cW,5.5,'F');
  doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
  doc.text('RESUMEN DE PAGO',margin+1,y); y+=6;

  const rW=90, rX=margin+cW-rW;
  doc.setFillColor(248,244,232); doc.rect(rX-2,y,rW+2,38,'F');
  doc.setDrawColor(200,160,60); doc.rect(rX-2,y,rW+2,38);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,80,40);
  doc.text('Saldo anterior:',rX,y+7);
  doc.text('Pago recibido:',rX,y+15);
  doc.text('Saldo restante:',rX,y+23);
  doc.setFont('helvetica','bold');
  doc.setTextColor(datos.liquidado?30:176, datos.liquidado?140:16, datos.liquidado?60:16);
  doc.text(datos.liquidado?'LIQUIDADO':'PENDIENTE',rX,y+32);
  doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
  doc.text('$'+fmtMXN(datos.saldoAnterior),margin+cW-1,y+7,{align:'right'});
  doc.setTextColor(30,120,50);
  doc.text('$'+fmtMXN(datos.pago),margin+cW-1,y+15,{align:'right'});
  doc.setTextColor(datos.saldoNuevo>0?176:30, datos.saldoNuevo>0?16:120, datos.saldoNuevo>0?16:50);
  doc.text('$'+fmtMXN(datos.saldoNuevo),margin+cW-1,y+23,{align:'right'}); y+=48;

  // â”€â”€ FIRMAS con lÃ³gica de autorizaciÃ³n â”€â”€
  doc.setDrawColor(80,65,40); doc.setLineWidth(0.3);
  const fw=cW*0.38, fS=margin+28;
  const _limpAuth = s => String(s||'').toUpperCase()
    .replace(/\b(LIC\.?|LICENCIADO|LICENCIADA|MTRO\.?|MTRA\.?|DR\.?|DRA\.?|ING\.?|ARQ\.?|C\.?|SR\.?|SRA\.?|SRTA\.?)\b/g,'')
    .replace(/\s+/g,' ').trim();
  const _tieneAuth    = datos.autorizacion && datos.autorizacion.nombre;
  const _mismaPersona = _tieneAuth ? (_limpAuth(datos.responsable) === _limpAuth(datos.autorizacion.nombre)) : false;

  doc.line(fS, y+8, fS+fw, y+8);
  doc.line(fS+fw+14, y+8, fS+fw*2+14, y+8);

  if(_mismaPersona){
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(154,110,24);
    doc.text('AUTORIZÃ“', fS+fw/2, y+4, {align:'center'});
  }
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(40,30,15);
  doc.text((datos.responsable||'Responsable del TrÃ¡mite').toUpperCase(), fS+fw/2, y+12, {align:'center'});
  doc.text('C. '+(datos.nombre_cliente_firma || datos.nombre || 'Cliente'), fS+fw+14+fw/2, y+12, {align:'center'});
  doc.setFontSize(6); doc.setTextColor(120,100,60);
  doc.text('Responsable del trÃ¡mite', fS+fw/2, y+15.5, {align:'center'});
  doc.text('Cliente', fS+fw+14+fw/2, y+15.5, {align:'center'});

  if(_tieneAuth && !_mismaPersona){
    const yAuth = y + 22;
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(154,110,24);
    doc.text('AUTORIZÃ“', fS+fw/2, yAuth, {align:'center'});
    doc.setDrawColor(80,65,40); doc.setLineWidth(0.3);
    doc.line(fS, yAuth+6, fS+fw, yAuth+6);
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(40,30,15);
    doc.text(String(datos.autorizacion.nombre).toUpperCase(), fS+fw/2, yAuth+10, {align:'center'});
    doc.setFontSize(6); doc.setTextColor(120,100,60);
    doc.text('Firma de quien autorizÃ³', fS+fw/2, yAuth+13.5, {align:'center'});
    y += 16;
  }

  // Footer
  doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.line(margin,271,pageW-margin,271);
  doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','normal');
  doc.text('LEX-MÃ‰XICO DESPACHO JURÃDICO Â· CALLE MIGUEL HIDALGO ESQ. MÃ‰XICO NO. 200, LOCAL B Â· TEL: 953 128 7511',pageW/2,275,{align:'center'});

  // â”€â”€ MARCA DE AGUA â”€â”€
  // PAGADO: cuando saldo final es 0 (recibo normal) o cuando es un complemento liquidado
  const _saldoFinalWM = (datos.saldoNuevo !== undefined) ? datos.saldoNuevo
    : Math.max(0, ((datos.totalGeneral !== undefined ? datos.totalGeneral : 0) - (datos.totalAbonado !== undefined ? datos.totalAbonado : (parseFloat(datos.anticipo)||0))));
  if((_saldoFinalWM <= 0 && datos.totalGeneral > 0) || datos.liquidado === true){
    dibujarMarcaAgua(doc, 'PAGADO', [30, 140, 60]);
  }
  // CANCELADO: si se pasa el flag
  if(datos.cancelado){
    dibujarMarcaAgua(doc, 'CANCELADO', [120, 120, 120]);
  }

  return doc;
}

// â”€â”€ FOLIO DISPLAY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Formato: AA-NN (aÃ±o 2 dÃ­gitos + nÃºmero sin padding fijo, mÃ­nimo 2 dÃ­gitos)
// Ejemplos: 26-01, 26-10, 26-100, 26-1000
// El aÃ±o en folioFormato puede venir del recibo (anio_folio) o del aÃ±o actual
function folioFormato(num, anioFolio){
  const anio = anioFolio
    ? String(anioFolio).slice(-2)
    : new Date().getFullYear().toString().slice(2);
  const n = Number(num);
  // Padding de 3 dÃ­gitos: 26-001 a 26-999
  return anio + '-' + String(n).padStart(3, '0');
}

// Detecta cambio de aÃ±o y reinicia el contador anual
function verificarReinicioAnual(){
  const anioActual = new Date().getFullYear();
  if(!appData.anioFolioActual) appData.anioFolioActual = anioActual;
  if(appData.anioFolioActual !== anioActual){
    console.log('[LEX] Nuevo aÃ±o detectado â€” reiniciando contador de folios a 1');
    appData.folioActual    = 1;
    appData.anioFolioActual = anioActual;
  }
}

function actualizarFolioDisplay(){
  verificarReinicioAnual();
  $('folio-display').textContent = folioFormato(appData.folioActual);
  if(typeof actualizarBadgeArchivoDesdeRecibo==='function') actualizarBadgeArchivoDesdeRecibo(appData.folioActual);
}

// â”€â”€ CÃLCULOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatTelefono(input) {
  // Remove non-digits
  let digits = input.value.replace(/\D/g, '').slice(0, 10);
  // Format: XXX-XXX-XXXX
  let formatted = '';
  if (digits.length <= 3) {
    formatted = digits;
  } else if (digits.length <= 6) {
    formatted = digits.slice(0,3) + '-' + digits.slice(3);
  } else {
    formatted = digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
  }
  input.value = formatted;
}

function parsePrecio(val) {
  // Remove currency symbol, spaces, and commas â†’ get float
  return parseFloat((val||'').replace(/[$\s,]/g,'')) || 0;
}

function formatPrecio(input) {
  const raw = input.value.replace(/[$\s,]/g, '');
  // Allow digits and a single dot
  const clean = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  if (clean === '' || clean === '.') { input.value = clean; calcTotales(); return; }
  const parts = clean.split('.');
  const intPart = parseInt(parts[0]||'0', 10);
  const decPart = parts.length > 1 ? '.' + parts[1].slice(0,2) : '';
  input.value = intPart.toLocaleString('es-MX') + decPart;
  calcTotales();
}

function calcTotales(){
  let total=0;
  document.querySelectorAll('.precio').forEach(p=>{ total+=parsePrecio(p.value); });
  const antipoInput = $('anticipo');
  const anticipo=parsePrecio(antipoInput.value);
  document.getElementById('total-display').textContent='$'+fmtMXN(total);
  document.getElementById('resta-display').textContent='$'+fmtMXN(total-anticipo);

  // â”€â”€ Advertencia modal: anticipo supera el total â”€â”€
  // No disparar si el campo fue actualizado programÃ¡ticamente (no por el usuario)
  if(antipoInput.dataset.programmatic === '1') return;

  // Determinar el lÃ­mite: en modo actualizaciÃ³n usar saldoPendiente del recibo en curso,
  // en modo normal usar el total de los conceptos.
  let limite = total;
  if(typeof reciboEnActualizacion !== 'undefined' && reciboEnActualizacion){
    // En modo actualizaciÃ³n, el lÃ­mite es el saldo pendiente ACTUALIZADO
    // (saldoPendiente + costos extra nuevos), no el saldo original sin los extra
    const saldoBase = parseFloat(reciboEnActualizacion.saldoPendiente) || 0;
    const sumaCE = (typeof getCostosExtra === 'function')
      ? getCostosExtra().reduce((s,c)=>s+(parseFloat(c.precio)||0), 0) : 0;
    limite = saldoBase + sumaCE;
    if(!limite) limite = total;
  }

  if(anticipo > 0 && limite > 0 && anticipo > limite){
    const tipo = (typeof reciboEnActualizacion !== 'undefined' && reciboEnActualizacion) ? 'saldo pendiente' : 'total';
    const excedente = anticipo - limite;
    document.getElementById('modal-anticipo-warn-msg').innerHTML =
      'El anticipo ingresado <strong>supera el ' + tipo + '</strong> del recibo. Por favor verifica y corrige el monto antes de continuar.';
    document.getElementById('modal-anticipo-warn-detalle').innerHTML =
      'ðŸ“¥ Anticipo ingresado: <strong>$' + fmtMXN(anticipo) + '</strong><br>' +
      'ðŸ“‹ ' + (tipo === 'saldo pendiente' ? 'Saldo pendiente' : 'Total del recibo') + ': <strong>$' + fmtMXN(limite) + '</strong><br>' +
      'âš ï¸ Excedente: <strong style="color:#c0161a;">$' + fmtMXN(excedente) + '</strong>';
    document.getElementById('modal-anticipo-warn').classList.add('show');
    antipoInput.style.borderColor = '#c0161a';
    antipoInput.style.boxShadow   = '0 0 0 2px rgba(192,22,26,0.18)';
  } else {
    antipoInput.style.borderColor = '';
    antipoInput.style.boxShadow   = '';
  }
}

// â”€â”€ QR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function generarQRPreview(){
  const div=document.getElementById('qr-preview'); div.innerHTML='';
  const folio=folioFormato(appData.folioActual);
  const nombre=document.querySelector('[id^="nombre_"]')?.value||'Cliente';
  const fecha=$('fecha_recibo')?.value||'';
  const hora =$('hora_recibo')?.value||'';
  // QR sin total para mantener privacidad del monto y consistencia con el PDF
  new QRCode(div,{text:'LEX-MEXICO|Folio:'+folio+'|'+nombre+'|'+fecha+' '+hora,
    width:80,height:80,colorDark:'#1a1008',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
}

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

// â”€â”€ CLIENTES DINÃMICOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
clienteCount=0;
conceptoCount=0;
function sincronizarFirmaCliente(input, id) {
  // Solo el primer cliente sincroniza el campo de firma
  const primerInput = document.querySelector('#clientes-wrapper .cliente-row [id^="nombre_"]');
  if (primerInput && primerInput.id === 'nombre_' + id) {
    const firmaField = $('nombre_cliente_firma');
    if (firmaField && !firmaField.dataset.manualEdit) {
      firmaField.value = input.value;
    }
  }
}
function agregarCliente(){
  clienteCount++;
  const id='c'+clienteCount;
  const wrap=$('clientes-wrapper');
  const div=document.createElement('div'); div.className='cliente-row'; div.id='cliente-row-'+id;
  div.innerHTML=
    '<div class="cliente-fila-top">'
      +'<div class="field-group"><label>Nombre completo</label>'
        +'<input type="text" id="nombre_'+id+'" placeholder="NOMBRE DEL CLIENTE" style="text-transform:uppercase" '
        +'oninput="this.value=this.value.toUpperCase().normalize(\'NFD\').replace(/[\\u0300-\\u036f]/g,\'\').replace(/\\./g,\'\');generarQRPreview();sincronizarFirmaCliente(this,\''+id+'\')""></div>'
      +'<div class="field-group"><label>MÃ³vil</label>'
        +'<input type="text" id="movil_'+id+'" placeholder="000-000-0000" oninput="formatTelefono(this)" maxlength="12"></div>'
      +'<div class="field-group"><label>Tel. Casa</label>'
        +'<input type="text" id="tel_'+id+'" placeholder="000-000-0000" oninput="formatTelefono(this)" maxlength="12"></div>'
      +(clienteCount>1?'<button class="remove-btn" onclick="quitarCliente(\''+id+'\')">âœ•</button>':'<div></div>')
    +'</div>'
    +'<div class="cliente-fila-bot">'
      +'<div class="field-group"><label>Domicilio</label>'
        +'<input type="text" id="domicilio_'+id+'" placeholder="Calle, nÃºmero, colonia, municipio..."></div>'
    +'</div>';
  wrap.appendChild(div);
}
function quitarCliente(id){ const r=document.getElementById('cliente-row-'+id); if(r)r.remove(); }
function getClientes(){
  return Array.from(document.querySelectorAll('.cliente-row')).map(r=>({
    nombre:   r.querySelector('[id^="nombre_"]')?.value||'',
    movil:    r.querySelector('[id^="movil_"]')?.value||'',
    tel:      r.querySelector('[id^="tel_"]')?.value||'',
    domicilio:r.querySelector('[id^="domicilio_"]')?.value||''
  })).filter(c=>c.nombre||c.movil||c.tel);
}

function quitarConcepto(id){ const r=document.getElementById('concepto-row-'+id); if(r){r.remove();calcTotales();} }
function getConceptos(){
  const cs=document.querySelectorAll('.concepto'),ds=document.querySelectorAll('.descripcion'),ps=document.querySelectorAll('.precio');
  return Array.from(cs).map((el,i)=>({concepto:el.value,descripcion:ds[i].value,precio:String(parsePrecio(ps[i]?.value))}));
}

// â”€â”€ LIMPIAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function limpiarForm(){
  $('clientes-wrapper').innerHTML=''; clienteCount=0; agregarCliente();
  $('conceptos-tbody').innerHTML=''; conceptoCount=0; agregarConcepto();
  ['tramites','clase','marca','serie','motor','anio','puertas','color_veh',
   'transmision','cilindros','placa','ultima_tenencia','origen','combustible','anticipo','folio_anterior']
    .forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
  // Restaurar valores por defecto
  const respField = $('responsable');
  if(respField) respField.value = empleadoActual ? empleadoActual.nombre : NOMBRE_TITULAR;
  const firmaField = $('nombre_cliente_firma');
  if(firmaField){ firmaField.value=''; delete firmaField.dataset.manualEdit; }
  // Salir de modo consulta si estaba activo
  salirModoConsulta();
  // Ocultar historial de folio anterior
  const infoBox=document.getElementById('info-folio-anterior');
  const histDiv=document.getElementById('historial-pagos-prev');
  if(infoBox) infoBox.style.display='none';
  if(histDiv) histDiv.style.display='none';
  // Limpiar checkboxes documentos
  document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(c=>c.checked=false);
  setTipoDoc('copia');
  setTipoTramite('normal');
  // Reiniciar fecha con hora local correcta (sin desfase UTC)
  if(typeof window._aplicarFechaLocal === 'function'){
    try { window._aplicarFechaLocal(new Date()); } catch(e){ console.warn('aplicarFechaLocal:', e); }
  }
  // Limpiar cuadro rojo de placas (no debe persistir entre folios)
  mostrarPlacasEnPantalla(null, null);
  calcTotales(); generarQRPreview(); actualizarFolioDisplay();
  setStatus('ok','Formulario limpio â€” mismo Folio #'+folioFormato(appData.folioActual),'ok');
}

// Limpieza TOTAL del formulario â€” idÃ©ntico al estado de primer arranque (modo nativo virgen).
// Se usa al presionar "Siguiente Folio" o "Nuevo Folio" para que no quede
// ningÃºn dato del recibo anterior. Cada paso estÃ¡ envuelto en try/catch para
// que un fallo aislado no impida la limpieza del resto.
function limpiarFormCompleto(){
  // Helper: ejecutar un paso aislado sin que un error rompa la cadena
  const paso = (nombre, fn) => { try { fn(); } catch(e){ console.warn('[limpiarFormCompleto:'+nombre+']', e); } };

  // 0. Quitar TODAS las clases de modo (actualizaciÃ³n, congelado, consulta, etc.)
  paso('clases-body', ()=>{
    ['modo-actualizacion','recibo-frozen','desde-liquidacion','actualizacion-impresa',
     'modo-consulta','folio-liquidado','folio-cancelado','modo-edicion-completa','paneles-busqueda-abiertos'].forEach(c=>document.body.classList.remove(c));
    _panelesBusquedaAbiertos = false;
    _reciboEnEdicionCompleta = null;
    const _pbcRst = document.getElementById('pbc-body');
    const _pfcRst = document.getElementById('pfc-body');
    const _panRst = document.getElementById('paneles-busqueda-cuerpo');
    if(_pbcRst) _pbcRst.removeAttribute('style');
    if(_pfcRst) _pfcRst.removeAttribute('style');
    if(_panRst) _panRst.setAttribute('style','display:none; padding:0 20px 14px;');
    if(typeof syncFormVisibility==='function') syncFormVisibility();
  });

  // 0.b Restaurar panel de acciones al estado inicial
  paso('paneles-acciones', ()=>{
    const aNormal = document.getElementById('actions-normal');
    const aPost   = document.getElementById('actions-post-print');
    const aAct    = document.getElementById('actions-actualizacion');
    const aCons   = document.getElementById('actions-consulta');
    const banner  = document.getElementById('frozen-banner');
    const btnGuardar = document.getElementById('btn-guardar');
    if(aNormal) aNormal.style.display = 'flex';
    if(aPost)   aPost.style.display   = 'none';
    if(aAct)    aAct.style.display    = 'none';
    if(aCons)   aCons.style.display   = 'none';
    if(banner)  banner.style.display  = 'none';
    if(btnGuardar) btnGuardar.disabled = false;
  });

  // 1. Limpiar clientes y conceptos dinÃ¡micos (1 fila vacÃ­a cada uno)
  paso('clientes', ()=>{
    $('clientes-wrapper').innerHTML='';
    clienteCount=0;
    agregarCliente();
  });
  paso('conceptos', ()=>{
    $('conceptos-tbody').innerHTML='';
    conceptoCount=0;
    agregarConcepto();
  });

  // 2. Limpiar todos los campos de texto / select del bloque vehicular y trÃ¡mites
  paso('campos-texto', ()=>{
    ['tramites','clase','marca','serie','motor','anio','puertas','color_veh',
     'transmision','cilindros','placa','ultima_tenencia','origen','combustible',
     'anticipo','folio_anterior'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.value='';
    });
  });

  // 3. Restaurar valores por defecto fijos (responsable, firma)
  paso('defaults', ()=>{
    const respField = $('responsable');
    if(respField) respField.value = empleadoActual ? empleadoActual.nombre : NOMBRE_TITULAR;
    const firmaField = $('nombre_cliente_firma');
    if(firmaField){ firmaField.value=''; delete firmaField.dataset.manualEdit; }
  });

  // 4. Salir de modo consulta (cierra iframe del PDF si estaba abierto)
  paso('salir-consulta', ()=>{ if(typeof salirModoConsulta==='function') salirModoConsulta(); });

  // 5. Ocultar bloque "Folio anterior" e historial de pagos
  paso('folio-anterior', ()=>{
    const infoBox = document.getElementById('info-folio-anterior');
    const histDiv = document.getElementById('historial-pagos-prev');
    if(infoBox){ infoBox.style.display='none'; infoBox.classList.remove('cancelado-box'); }
    if(histDiv) histDiv.style.display='none';
  });

  // 6. Limpiar checkboxes de documentos Y CERRAR todas las categorÃ­as (modo nativo virgen)
  paso('docs-checkboxes', ()=>{
    document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(c=>{
      c.checked=false; c.disabled=false;
    });
  });
  paso('docs-categorias-cerrar', ()=>{
    document.querySelectorAll('#docs-checklist .doc-category').forEach(cat=>{
      const body  = cat.querySelector('.doc-category-body');
      const arrow = cat.querySelector('.doc-category-header span');
      if(body)  body.style.display = 'none';
      if(arrow) arrow.textContent = '\u25b8'; // â–¸ flecha cerrada
    });
  });

  // 7. Restablecer tipo doc y tipo trÃ¡mite al estado inicial
  paso('tipo-doc-tramite', ()=>{
    if(typeof setTipoDoc==='function') setTipoDoc('copia');
    if(typeof setTipoTramite==='function') setTipoTramite('normal');
  });

  // 8. Cerrar secciÃ³n vehiculo (volver a flecha plegada â–¸)
  paso('cerrar-vehiculo', ()=>{
    // setTipoTramite('normal') ya oculta seccion-vehiculo, pero reforzamos:
    const secVeh = document.getElementById('seccion-vehiculo');
    if(secVeh) secVeh.style.display = 'none';
    const vBody = document.getElementById('vehicle-grid-body');
    const vArrow = document.querySelector('.section-label-toggle .veh-arrow');
    if(vBody)  vBody.style.display = 'none';
    if(vArrow) vArrow.textContent = '\u25b8'; // â–¸ cerrada
  });

  // 9. Limpiar cuadro rojo de placas
  paso('placas', ()=>{ if(typeof mostrarPlacasEnPantalla==='function') mostrarPlacasEnPantalla(null, null); });

  // 10. Limpiar costos extra / pagos parciales del modo actualizaciÃ³n
  paso('costos-extra-pagos', ()=>{
    const ceBody  = document.getElementById('costos-extra-tbody');
    const ppBody  = document.getElementById('pagos-parciales-tbody');
    const resumen = document.getElementById('resumen-pagos-parciales');
    const secCE   = document.getElementById('seccion-costos-extra');
    const secPP   = document.getElementById('seccion-pagos-parciales');
    if(ceBody) ceBody.innerHTML='';
    if(ppBody) ppBody.innerHTML='';
    if(resumen){ resumen.style.display='none'; resumen.innerHTML=''; }
    if(secCE) secCE.style.display='none';
    if(secPP) secPP.style.display='none';
    // Resetear contadores globales si existen
    if(typeof costoExtraCount !== 'undefined') costoExtraCount = 0;
    if(typeof pagoParcialCount !== 'undefined') pagoParcialCount = 0;
  });

  // 11. Resetear variables internas de modo actualizaciÃ³n, consulta y autorizaciÃ³n
  paso('vars-internas', ()=>{
    if(typeof reciboEnActualizacion !== 'undefined') reciboEnActualizacion = null;
    if(typeof reciboEnConsulta      !== 'undefined') reciboEnConsulta      = null;
    window._autorizacionActual      = null;
    window._autorizacionCancelacion = null;
    if(typeof lastActualizacionBlob   !== 'undefined') lastActualizacionBlob   = null;
    if(typeof lastActualizacionNombre !== 'undefined') lastActualizacionNombre = null;
    if(typeof lastPdfBlob !== 'undefined') lastPdfBlob = null;
  });

  // 12. Reiniciar fecha/hora con la hora CDMX actual (vÃ­a referencia global)
  paso('fecha-hora', ()=>{
    if(typeof window._aplicarFechaLocal === 'function'){
      window._aplicarFechaLocal(new Date());
    }
  });

  // 13. Resetear cuadro marrÃ³n Total/Anticipo/Resta a $0.00
  //     (DEBE hacerse DESPUÃ‰S de limpiar conceptos para que calcTotales no lo sobreescriba con basura)
  paso('totales-display', ()=>{
    const totalDisp = document.getElementById('total-display');
    const restaDisp = document.getElementById('resta-display');
    const antInput  = $('anticipo');
    if(totalDisp) totalDisp.textContent = '$0.00';
    if(restaDisp) restaDisp.textContent = '$0.00';
    if(antInput)  antInput.value = '';
  });

  // 14. Resetear botones de actualizaciÃ³n a su estado original (texto + onclick)
  paso('botones-actualizacion', ()=>{
    const btnCancelarAct = document.getElementById('btn-cancelar-actualizacion');
    if(btnCancelarAct){
      btnCancelarAct.innerHTML = '\u2715 Cancelar Actualizaci\u00f3n';
      btnCancelarAct.onclick = (typeof cancelarActualizacion === 'function') ? cancelarActualizacion : null;
    }
    const btnImprimirAct = document.getElementById('btn-imprimir-actualizacion');
    if(btnImprimirAct){
      btnImprimirAct.innerHTML = '\ud83d\udda8 Imprimir Actualizaci\u00f3n';
      btnImprimirAct.onclick = (typeof imprimirActualizacion === 'function') ? imprimirActualizacion : null;
    }
  });

  // 15. Recalcular totales (con la fila vacÃ­a ya creada â†’ da $0.00), QR y folio display
  paso('recalcular', ()=>{
    if(typeof calcTotales==='function') calcTotales();
    if(typeof generarQRPreview==='function') generarQRPreview();
    if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
  });

  // 16. Estado final y mensaje
  paso('status', ()=>{
    setStatus('ok','Nuevo folio #'+folioFormato(appData.folioActual)+' listo para capturar','ok');
  });
}

function setStatus(t,msg,cls){
  document.getElementById('status-text').textContent=msg;
  document.getElementById('status-dot').className='dot '+(cls||'');
}

// â”€â”€ Helper: convierte img a dataURL y devuelve proporciones reales â”€â”€
function getLogoDataURL(){
  return new Promise(resolve => {
    const imgEl = document.querySelector('.header-logo img');
    if(!imgEl){ resolve({ url:'', w:1, h:1 }); return; }
    const nW = imgEl.naturalWidth  || imgEl.width  || 200;
    const nH = imgEl.naturalHeight || imgEl.height || 200;
    const canvas = document.createElement('canvas');
    canvas.width  = nW;
    canvas.height = nH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, nW, nH);
    resolve({ url: canvas.toDataURL('image/jpeg', 0.92), w: nW, h: nH });
  });
}

// â”€â”€ Helper: dibuja el encabezado en el PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function dibujarEncabezadoPDF(doc, margin, cW, folio, logoObj){
  const GOLD  = [154,110,24];
  const GBORD = [200,160,60];
  const DARK  = [60, 45, 20];
  const MUTED = [122,104,64];
  const RED   = [192, 22, 26];

  const PAD   = 3;
  const hH    = 28;
  const hTop  = 6;
  const hBot  = hTop + hH;

  // â”€â”€ COLUMNAS â”€â”€
  const logoColW   = 28;
  const folioColW  = 34;
  const centerColW = cW - logoColW - folioColW;
  const centerColX = margin + logoColW;
  const centerMidX = centerColX + centerColW / 2;
  const folioX     = margin + logoColW + centerColW;
  const folioMidX  = folioX + folioColW / 2;

  // â”€â”€ RECT EXTERIOR â”€â”€
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.7);
  doc.rect(margin, hTop, cW, hH);

  // â”€â”€ LOGO â€” proporcional usando dimensiones reales de la imagen â”€â”€
  const logoDataURL = logoObj && logoObj.url ? logoObj.url : (typeof logoObj === 'string' ? logoObj : '');
  const imgW = logoObj && logoObj.w ? logoObj.w : 1;
  const imgH = logoObj && logoObj.h ? logoObj.h : 1;
  const ratio = imgW / imgH;   // relaciÃ³n ancho/alto real de la imagen

  if(logoDataURL){
    try{
      // Espacio disponible dentro de la columna con padding
      const maxW = logoColW - 6;    // margen lateral
      const maxH = hH - PAD * 2;   // margen vertical

      // Calcular tamaÃ±o que quepa respetando la proporciÃ³n
      let lW = maxW;
      let lH = lW / ratio;
      if(lH > maxH){ lH = maxH; lW = lH * ratio; }

      // Centrar horizontal y verticalmente en la columna
      const lX = margin + (logoColW - lW) / 2;
      const lY = hTop + (hH - lH) / 2;
      doc.addImage(logoDataURL, 'JPEG', lX, lY, lW, lH);
    }catch(e){ console.warn('Logo error:', e); }
  }

  // â”€â”€ SEPARADOR VERTICAL izquierdo de columna folio â”€â”€
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.3);
  doc.line(folioX, hTop + 1, folioX, hBot - 1);

  // â”€â”€ FOLIO: "NO. RECIBO" FUERA del rect, arriba â€” mÃ¡s grande â”€â”€
  // Distribuimos verticalmente: centrar el bloque folio en hH
  // Bloque = labelH(2.5) + gap(1.5) + rectH(12) + gap(1.5) + labelH(2.5) = 20mm
  const fBlkH  = 20;
  const fBlkY  = hTop + (hH - fBlkH) / 2;   // Y inicio del bloque folio

  // "NO. RECIBO" â€” fuera del rect del nÃºmero, letra grande bold
  doc.setFontSize(7); doc.setFont('courier','bold'); doc.setTextColor(...GOLD);
  doc.text('NO. RECIBO', folioMidX, fBlkY + 2.5, {align:'center', charSpace:0.6});

  // RectÃ¡ngulo del nÃºmero â€” solo cubre el dÃ­gito, fondo crema suave
  const rY = fBlkY + 4.5;
  const rH = 12;
  const rX = folioX + 2;
  const rW = folioColW - 4;
  doc.setFillColor(250, 246, 236);
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.6);
  doc.rect(rX, rY, rW, rH, 'FD');

  // NÃºmero dentro del rect â€” Courier bold, rojo â€” formato AÃ‘O-NÃšMERO (ej. 26-001)
  const folioTexto = folioFormato(folio); // ya incluye aÃ±o: 26-001
  // Font adaptable: 6 caracteres (26-001) caben bien a 16pt
  const folioFontSize = folioTexto.length <= 6 ? 16 : folioTexto.length <= 7 ? 14 : 12;
  doc.setFontSize(folioFontSize); doc.setFont('courier','bold'); doc.setTextColor(...RED);
  doc.text(folioTexto, folioMidX, rY + 8.5, {align:'center', charSpace:0.5});

  // "FOLIO OFICIAL" â€” fuera del rect, abajo, mÃ¡s grande y bold
  doc.setFontSize(7); doc.setFont('courier','bold'); doc.setTextColor(...MUTED);
  doc.text('FOLIO OFICIAL', folioMidX, rY + rH + 4, {align:'center', charSpace:0.5});

  // â”€â”€ COLUMNA CENTRAL â€” distribuida en el espacio interior del rect â”€â”€
  // Bloque: tÃ­tulo(4mm) + dir1(4mm) + dir2(3.5mm) + sep(2mm) + tel-label(3mm) + tel(4mm) = 20.5mm
  // Partimos desde hTop+2 (2mm de padding superior dentro del rect)
  const cPadTop = hTop + 2.5;

  // TÃ­tulo
  doc.setFontSize(12.5); doc.setFont('times','bold'); doc.setTextColor(...GOLD);
  doc.text('LEX-MÃ‰XICO Â· DESPACHO JURÃDICO', centerMidX, cPadTop + 3.5, {align:'center'});

  // DirecciÃ³n
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...DARK);
  doc.text('CALLE MIGUEL HIDALGO ESQ. MÃ‰XICO NO. 200, LOCAL B, COL. CENTRO', centerMidX, cPadTop + 7.5, {align:'center'});
  doc.text('SANTIAGO JUXTLAHUACA, OAXACA', centerMidX, cPadTop + 11, {align:'center'});

  // Separador fino dorado
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.2);
  doc.line(centerColX + 4, cPadTop + 13, centerColX + centerColW - 4, cPadTop + 13);

  // "TELÃ‰FONO DE OFICINA â€” Informes y citas" en una sola lÃ­nea, mÃ¡s grandes
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...GOLD);
  doc.text('TEL. OFICINA Â· INFORMES Y CITAS:', centerMidX, cPadTop + 16.5, {align:'center'});

  // NÃºmero de telÃ©fono â€” grande y destacado
  doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...GOLD);
  doc.text('953 128 7511', centerMidX, cPadTop + 21.5, {align:'center'});

  return hBot;   // Y donde termina el encabezado
}

// â”€â”€ GENERAR PDF RECIBO NORMAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ MARCA DE AGUA EN PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function dibujarMarcaAgua(doc, texto, color){
  const pageW = 215.9, pageH = 279.4;
  const cx = pageW / 2;
  const cy = pageH * 0.62; // â‰ˆ 173 mm â€” tercio inferior-medio, lejos del encabezado
  const angleDeg = Math.atan2(pageH, pageW) * 180 / Math.PI; // â‰ˆ 52.3Â°
  const paginaOriginal = doc.internal.getCurrentPageInfo
    ? doc.internal.getCurrentPageInfo().pageNumber : 1;
  const totalPaginas = doc.internal.getNumberOfPages();
  for(let pg = 1; pg <= totalPaginas; pg++){
    doc.setPage(pg);
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({opacity: 0.11}));
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont('helvetica','bold');
    doc.setFontSize(82);
    doc.text(texto, cx, cy, {angle: angleDeg, align:'center', baseline:'middle'});
    doc.restoreGraphicsState();
  }
  doc.setPage(paginaOriginal);
}

async function generarPDF(datos,folio,qrDataURL){
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
  const margin=11,pageW=215.9,cW=pageW-margin*2;
  const logoObj = await getLogoDataURL();

  // â”€â”€ ENCABEZADO â”€â”€
  const hBot = dibujarEncabezadoPDF(doc, margin, cW, folio, logoObj);
  const yAfterH = hBot + 3;

  // â”€â”€ RECIBO OFICIAL / COMPROBANTE DE ABONO + fecha â”€â”€
  doc.setTextColor(154,110,24); doc.setFontSize(10); doc.setFont('times','bold');
  doc.text('RECIBO OFICIAL', margin, yAfterH);
  const fechaRec=datos.fecha_recibo?new Date(datos.fecha_recibo+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}):'';
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(80,65,40);
  doc.text('Santiago Juxtlahuaca, Oaxaca \u2014 '+fechaRec+' '+datos.hora_recibo+' hrs.',pageW-margin,yAfterH,{align:'right'});

  // Fechas adicionales de reimpresiÃ³n (acumuladas, debajo de la original)
  let yLineaFechas = yAfterH;
  if(datos.fechasImpresion && datos.fechasImpresion.length > 1){
    doc.setFontSize(6.5); doc.setFont('helvetica','italic'); doc.setTextColor(154,110,24);
    // Saltar la primera (original ya impresa arriba) y pintar las demÃ¡s
    for(let i=1; i<datos.fechasImpresion.length; i++){
      const f = datos.fechasImpresion[i];
      const fStr = f.fecha ? new Date(f.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}) : '';
      yLineaFechas += 3;
      doc.text((f.etiqueta||'Reimpresi\u00f3n')+': '+fStr+' '+(f.hora||'')+' hrs.', pageW-margin, yLineaFechas, {align:'right'});
    }
    doc.setFont('helvetica','normal'); doc.setTextColor(80,65,40);
  }
  doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.line(margin,yLineaFechas+1.5,pageW-margin,yLineaFechas+1.5);

  let y=yLineaFechas+4.5;
  const campo=(label,val,x,cy,w)=>{
    doc.setFontSize(5.5); doc.setTextColor(130,100,50); doc.setFont('helvetica','normal'); doc.text(label,x,cy);
    doc.setFontSize(8); doc.setTextColor(20,10,5); doc.text(val||'â€”',x,cy+4);
    doc.setDrawColor(210,185,120); doc.line(x,cy+5,x+w,cy+5);
  };

  // Clientes
  doc.setFillColor(248,244,232); doc.rect(margin,y-3,cW,5,'F');
  doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
  doc.text('DATOS DEL CLIENTE',margin+1,y); y+=2.5;
  datos.clientes.forEach((c,i)=>{
    if(i>0){ doc.setDrawColor(230,210,170); doc.setLineWidth(0.2); doc.line(margin,y-1,margin+cW,y-1); }
    campo('NOMBRE',c.nombre,margin,y,cW*0.55);
    campo('MÃ“VIL',c.movil,margin+cW*0.6,y,cW*0.18);
    campo('TEL. CASA',c.tel,margin+cW*0.82,y,cW*0.18); y+=8;
    if(c.domicilio){ campo('DOMICILIO',c.domicilio,margin,y,cW); y+=8; }
  });

  // Poder â€” texto importante, fuente mÃ¡s grande y legible
  doc.setFontSize(7); doc.setTextColor(60,45,20); doc.setFont('helvetica','bolditalic');
  const ptr='Por medio de la presente, otorgo al responsable del trÃ¡mite, quien forma parte del personal del Despacho JurÃ­dico LEX-MÃ‰XICO, poder amplio, cumplido y bastante para que, en mi nombre y representaciÃ³n, gestione, promueva y realice los trÃ¡mites descritos en el apartado de concepto y descripciÃ³n del presente recibo.';
  const pL=doc.splitTextToSize(ptr,cW); doc.text(pL,margin,y); y+=pL.length*3.8+2;

  // Vehiculo â€” solo si es trÃ¡mite vehicular
  if(datos.tipoTramite === 'vehicular') {
  doc.setFillColor(248,244,232); doc.rect(margin,y-3,cW,5,'F');
  doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
  doc.text('DATOS GENERALES DEL VEHICULO',margin+1,y); y+=2.5;
  // Fila 1: Clase Â· Marca Â· Serie/VIN Â· No. Motor
  const c2=cW/2, c4=cW/4;
  campo('CLASE',datos.clase,margin,y,c4-3);
  campo('MARCA',datos.marca,margin+c4,y,c4-3);
  campo('SERIE / VIN',datos.serie,margin+c4*2,y,c4-3);
  campo('NO. MOTOR',datos.motor,margin+c4*3,y,c4-3); y+=8;
  // Fila 2: AÃ±o Â· Puertas Â· Color Â· TransmisiÃ³n
  campo('AÃ‘O',datos.anio,margin,y,c4-3);
  campo('PUERTAS',datos.puertas,margin+c4*0.7,y,c4*0.6-3);
  campo('COLOR',datos.color_veh,margin+c4*1.3,y,c4-3);
  campo('TRANSMISIÃ“N',datos.transmision,margin+c4*2.3,y,c4-3);
  campo('CILINDROS',datos.cilindros,margin+c4*3.3,y,c4*0.7-3); y+=8;
  // Fila 3: Placas Â· Ãšlt. Tenencia Â· Origen Â· Combustible
  campo('PLACAS ACTUALES',datos.placa,margin,y,c4-3);
  campo('ÃšLTIMA TENENCIA',datos.ultima_tenencia,margin+c4,y,c4-3);
  campo('ORIGEN',datos.origen,margin+c4*2,y,c4-3);
  campo('COMBUSTIBLE',datos.combustible,margin+c4*3,y,c4-3); y+=8.5;
  } // end vehicular section

  // Documentos
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(100,80,40);
  doc.text('DOCUMENTOS QUE DEJA EL INTERESADO:',margin,y); y+=3.5;
  let docsData = null;
  try { if(datos.copias) docsData = JSON.parse(datos.copias); } catch(e){ registrarError('catch vacio', e); }
  if (docsData && docsData.docs && docsData.docs.length) {
    // SubtÃ­tulo: tipo de documento (Copia Simple / Escaneado)
    doc.setFontSize(6.5); doc.setFont('helvetica','italic'); doc.setTextColor(110,85,35);
    doc.text('(' + docsData.tipodoc + ')', margin, y); y += 3.5;

    // Layout en 2 columnas, fuente Arial/Helvetica normal, tamaÃ±o legible
    doc.setFont('helvetica','normal'); doc.setTextColor(15,10,5); doc.setFontSize(7.5);
    const colW = cW / 2 - 4;
    const docList = docsData.docs;
    const perCol = Math.ceil(docList.length / 2);  // dividir equitativamente
    const col1Items = docList.slice(0, perCol);
    const col2Items = docList.slice(perCol);
    const maxRows = Math.max(col1Items.length, col2Items.length);
    const lineH = 4.2;  // espacio compacto entre lÃ­neas
    const checkMark = '\u2714 ';  // palomita âœ”

    for (let i = 0; i < maxRows; i++) {
      if (col1Items[i]) {
        doc.setTextColor(30,110,30); doc.text('\u2714', margin, y);
        doc.setTextColor(15,10,5);
        const label1 = doc.splitTextToSize(col1Items[i], colW - 6);
        doc.text(label1[0], margin + 5, y);
      }
      if (col2Items[i]) {
        const col2X = margin + cW / 2 + 2;
        doc.setTextColor(30,110,30); doc.text('\u2714', col2X, y);
        doc.setTextColor(15,10,5);
        const label2 = doc.splitTextToSize(col2Items[i], colW - 6);
        doc.text(label2[0], col2X + 5, y);
      }
      y += lineH;
    }
    y += 1;
  } else if (datos.copias && !docsData) {
    // Legacy plain text fallback
    doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5); doc.setFontSize(8);
    const cL=doc.splitTextToSize(datos.copias,cW); doc.text(cL,margin,y); y+=cL.length*4+1;
  } else {
    doc.setFont('helvetica','normal'); doc.setTextColor(120,100,60); doc.setFontSize(8);
    doc.text('â€” Ninguno â€”', margin, y); y+=5;
  }

  // Conceptos â€” altura dinÃ¡mica segÃºn contenido del texto
  doc.setFillColor(248,244,232); doc.rect(margin,y-3,cW,5,'F');
  doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
  doc.text('CONCEPTO',margin+1,y); doc.text('DESCRIPCIÃ“N',margin+cW*0.38,y);
  doc.text('PRECIO',margin+cW,y,{align:'right'}); y+=2.5;
  let total=0;
  const colConceptoW = cW*0.35;
  const colDescripW  = cW*0.42;
  // Salto de pÃ¡gina automÃ¡tico para conceptos
  const yMaxConceptos = 262;
  function asegurarEspacioConceptos(altoFila){
    if(y + altoFila > yMaxConceptos){
      doc.addPage();
      y = 18;
      doc.setFillColor(248,244,232); doc.rect(margin,y-3,cW,5,'F');
      doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
      doc.text('CONCEPTO (continuaci\u00f3n)',margin+1,y);
      doc.text('DESCRIPCI\u00d3N',margin+cW*0.38,y);
      doc.text('PRECIO',margin+cW,y,{align:'right'}); y+=2.5;
    }
  }
  datos.conceptos.forEach(c=>{
    if(c.concepto||c.precio){
      const p=parseFloat(c.precio)||0; total+=p;
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
      const cLines = doc.splitTextToSize(c.concepto||'', colConceptoW);
      const dLines = doc.splitTextToSize(c.descripcion||'', colDescripW);
      const maxLines = Math.max(cLines.length, dLines.length, 1);
      const rowH = maxLines * 4 + 1.5;
      asegurarEspacioConceptos(rowH);
      doc.text(cLines, margin, y);
      doc.text(dLines, margin+cW*0.38, y);
      doc.text('$'+fmtMXN(p), margin+cW, y, {align:'right'});
      doc.setDrawColor(220,195,140); doc.setLineWidth(0.3);
      doc.line(margin, y+rowH-1.2, margin+cW, y+rowH-1.2);
      y += rowH;
    }
  });

  // â”€â”€ HISTORIAL DE PAGOS (solo en comprobante de abono) â”€â”€
  if(datos.folioAnterior && datos.historialPagosRef){
    const recOrig = (typeof appData!=='undefined' ? appData.recibos : []).find(r=>r.folio===datos.folioAnterior);
    y += 1;
    doc.setFillColor(232,245,224); doc.rect(margin,y-3,cW,5,'F');
    doc.setTextColor(42,122,58); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text('HISTORIAL DE PAGOS',margin+1,y); y+=3;

    // LÃ­nea de encabezado
    const colW = [cW*0.25, cW*0.15, cW*0.15, cW*0.2, cW*0.25];
    doc.setFontSize(5.5); doc.setFont('helvetica','bold'); doc.setTextColor(80,80,80);
    doc.text('Tipo', margin, y);
    doc.text('Folio', margin+colW[0], y);
    doc.text('Fecha', margin+colW[0]+colW[1], y);
    doc.text('Monto', margin+cW, y, {align:'right'});
    doc.setDrawColor(180,210,180); doc.line(margin,y+1,margin+cW,y+1); y+=3.5;

    // Anticipo original del recibo referenciado
    const anticipoOrig = parseFloat(recOrig?.anticipo||0);
    const fechaOrig = recOrig?.fecha_recibo || recOrig?.fecha || datos.fecha_recibo || '';
    const fechaOrigFmt = fechaOrig ? new Date(fechaOrig+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : 'â€”';

    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
    doc.text('Anticipo inicial', margin, y);
    doc.text(folioFormato(datos.folioAnterior), margin+colW[0], y);
    doc.text(fechaOrigFmt, margin+colW[0]+colW[1], y);
    doc.text('$'+fmtMXN(anticipoOrig), margin+cW, y, {align:'right'});
    doc.setDrawColor(210,230,210); doc.line(margin,y+1.5,margin+cW,y+1.5); y+=4;

    // Abonos anteriores del historial
    (datos.historialPagosRef||[]).forEach(h=>{
      const fh = h.fecha ? new Date(h.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : (h.fechaHora||'');
      doc.text('Abono', margin, y);
      doc.text(h.folio ? folioFormato(h.folio, h.anio_folio) : 'â€”', margin+colW[0], y);
      doc.text(fh, margin+colW[0]+colW[1], y);
      doc.text('$'+fmtMXN(parseFloat(h.pago)||0), margin+cW, y, {align:'right'});
      doc.setDrawColor(210,230,210); doc.line(margin,y+1.5,margin+cW,y+1.5); y+=4;
    });

    // Este comprobante (resaltado)
    const montoEste = parseFloat(datos.anticipo)||0;
    const fechaEste = datos.fecha_recibo ? new Date(datos.fecha_recibo+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : 'â€”';
    doc.setFillColor(42,122,58); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
    doc.rect(margin, y-2.5, cW, 6, 'F');
    doc.text('Abono â† este doc.', margin+1, y+1);
    doc.text(folioFormato(folio), margin+colW[0]+1, y+1);
    doc.text(fechaEste, margin+colW[0]+colW[1]+1, y+1);
    doc.text('$'+fmtMXN(montoEste), margin+cW-1, y+1, {align:'right'});
    doc.setTextColor(20,10,5); doc.setFont('helvetica','normal');
    y += 8;

    // LÃ­nea separadora
    doc.setDrawColor(42,122,58); doc.setLineWidth(0.5); doc.line(margin,y,margin+cW,y); y+=2;
  }

  // â”€â”€ SERVICIO COMPLEMENTARIO (si hay) â”€â”€
  let totalCostosExtra = 0;
  if(datos.costosExtra && datos.costosExtra.length){
    y += 0.5;
    const yMaxContenidoCE = 262;
    function asegurarEspacioCE(altoFila){
      if(y + altoFila > yMaxContenidoCE){
        doc.addPage();
        y = 18;
        doc.setFillColor(255,240,220); doc.rect(margin,y-3,cW,5,'F');
        doc.setTextColor(160,80,16); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
        doc.text('+ SERVICIO COMPLEMENTARIO (continuaci\u00f3n)',margin+1,y); y+=2.5;
      }
    }
    doc.setFillColor(255,240,220); doc.rect(margin,y-3,cW,5,'F');
    doc.setTextColor(160,80,16); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text('+ SERVICIO COMPLEMENTARIO',margin+1,y); y+=2.5;
    datos.costosExtra.forEach(c=>{
      const p=parseFloat(c.precio)||0; totalCostosExtra+=p; total+=p;
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
      const cLines = doc.splitTextToSize(c.concepto||'', colConceptoW);
      const dLines = doc.splitTextToSize((c.descripcion||'')+' ['+(c.fechaHora||'')+']', colDescripW);
      const maxLines = Math.max(cLines.length, dLines.length, 1);
      const rowH = maxLines * 3.6 + 1.2;
      asegurarEspacioCE(rowH);
      doc.text(cLines, margin, y);
      doc.setFontSize(7); doc.setTextColor(80,60,30);
      doc.text(dLines, margin+cW*0.38, y);
      doc.setFontSize(8); doc.setTextColor(20,10,5);
      doc.text('$'+fmtMXN(p), margin+cW, y, {align:'right'});
      doc.setDrawColor(220,180,120); doc.setLineWidth(0.2);
      doc.line(margin, y+rowH-1, margin+cW, y+rowH-1);
      y += rowH;
    });
  }

  // â”€â”€ PAGOS PARCIALES (si hay) â”€â”€
  let totalPagosParciales = 0;
  if(datos.pagosParciales && datos.pagosParciales.length){
    y += 0.5;
    // Helper: saltar a pÃ¡gina 2 si la fila se va a salir del Ã¡rea Ãºtil
    const yMaxContenido = 262; // antes del footer en 271
    function asegurarEspacio(altoFila){
      if(y + altoFila > yMaxContenido){
        doc.addPage();
        y = 18;
        // Repetir encabezado mÃ­nimo en la pÃ¡gina 2
        doc.setFillColor(232,245,224); doc.rect(margin,y-3,cW,5,'F');
        doc.setTextColor(42,122,58); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
        doc.text('PAGOS PARCIALES (continuaci\u00f3n)',margin+1,y); y+=2.5;
      }
    }
    doc.setFillColor(232,245,224); doc.rect(margin,y-3,cW,5,'F');
    doc.setTextColor(42,122,58); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text('PAGOS PARCIALES',margin+1,y); y+=2.5;
    datos.pagosParciales.forEach(p=>{
      const cant=parseFloat(p.cantidad)||0; totalPagosParciales+=cant;
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
      const cLines = doc.splitTextToSize(p.concepto||'Abon\u00f3', colConceptoW);
      // Si la descripciÃ³n ya trae auth inline (-fecha-), NO agregar [fechaHora] extra
      const descripFinal = p._hasAuthInline
        ? (p.descripcion || '')
        : ((p.descripcion || '') + ' [' + (p.fechaHora || '') + ']');
      const dLines = doc.splitTextToSize(descripFinal, colDescripW);
      const maxLines = Math.max(cLines.length, dLines.length, 1);
      const rowH = maxLines * 3.6 + 1.2;
      asegurarEspacio(rowH);
      doc.text(cLines, margin, y);
      doc.setFontSize(7); doc.setTextColor(80,60,30);
      doc.text(dLines, margin+cW*0.38, y);
      doc.setFontSize(8); doc.setTextColor(42,122,58); doc.setFont('helvetica','bold');
      doc.text('$'+fmtMXN(cant), margin+cW, y, {align:'right'});
      doc.setDrawColor(160,200,140); doc.setLineWidth(0.2);
      doc.line(margin, y+rowH-1, margin+cW, y+rowH-1);
      y += rowH;
    });
  }

  // Totales (usa valores recalculados si vienen del modo actualizaciÃ³n)
  const anticipo=parseFloat(datos.anticipo)||0;
  const totalGeneral = (datos.totalGeneral !== undefined) ? datos.totalGeneral : total;

  // Calcular totalAbonado real:
  // â€” Si hay pagosParciales dibujados arriba, usar su suma (incluye el anticipo original)
  // â€” Si no, usar el anticipo del recibo directamente (parseado como nÃºmero)
  const totalAbonado_raw = datos.totalAbonado !== undefined ? parseFloat(datos.totalAbonado)||0 : anticipo;
  const abonadoCalculado = totalPagosParciales > 0
    ? totalPagosParciales
    : (totalAbonado_raw > 0 ? totalAbonado_raw : anticipo);

  // saldoFinal: prioridad â†’ datos.saldoNuevo â†’ saldoPendiente guardado â†’ cÃ¡lculo desde abonado
  const saldoFinal = (datos.saldoNuevo !== undefined && datos.saldoNuevo !== null)
    ? parseFloat(datos.saldoNuevo)
    : (datos.saldoPendiente !== undefined && datos.saldoPendiente !== null
        ? parseFloat(datos.saldoPendiente)
        : Math.max(0, totalGeneral - abonadoCalculado));
  // totalAbonado final â€” siempre coherente con saldoFinal
  const totalAbonado = Math.max(0, totalGeneral - saldoFinal);

  // Si el cuadro de totales (alto ~22mm) + QR + firmas (~38mm) no cabe, ir a pÃ¡gina 2
  if(y + 62 > 262){
    doc.addPage();
    y = 18;
  }

  y += 0.5;
  // QR a la izquierda, alineado con el inicio del cuadro de totales
  if(qrDataURL){ try{doc.addImage(qrDataURL,'PNG',margin,y,18,18);}catch(e){ registrarError('catch vacio', e); } }
  // Cuadro de totales a la derecha (mismo nivel que el QR)
  doc.setFillColor(248,244,232); doc.rect(margin+cW-62,y,62,22,'F');
  doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.rect(margin+cW-62,y,62,22);
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,80,40);
  doc.text('TOTAL:',margin+cW-60,y+5);
  doc.text('ABONADO:',margin+cW-60,y+11);
  doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
  doc.text('RESTA:',margin+cW-60,y+18);
  doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(20,10,5);
  doc.text('$'+fmtMXN(totalGeneral),margin+cW-1.5,y+5,{align:'right'});
  doc.text('$'+fmtMXN(totalAbonado),margin+cW-1.5,y+11,{align:'right'});
  doc.setFontSize(11.5); doc.setTextColor(saldoFinal>0?154:42, saldoFinal>0?110:122, saldoFinal>0?24:58);
  doc.text('$'+fmtMXN(Math.max(0,saldoFinal)),margin+cW-1.5,y+18.5,{align:'right'}); y+=24;

  // Historial de pagos (si hay folio anterior)
  if(datos.folioAnterior && datos.historialPagosRef && datos.historialPagosRef.length){
    y+=2;
    doc.setFillColor(248,244,232); doc.rect(margin,y-3.5,cW,5,'F');
    doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text('HISTORIAL DE PAGOS â€” Ref. Folio #'+folioFormato(datos.folioAnterior),margin+1,y); y+=4;
    const hCols=[22,28,36,30,36];
    const hHdrs=['Folio','Fecha','Tipo','Abono','Saldo resta'];
    let hx=margin;
    doc.setFontSize(6); doc.setFont('helvetica','bold'); doc.setTextColor(100,80,40);
    hHdrs.forEach((h,i)=>{ doc.text(h,hx,y); hx+=hCols[i]; }); y+=3.5;
    doc.setDrawColor(200,160,60); doc.line(margin,y-1,margin+cW,y-1);
    datos.historialPagosRef.forEach(h=>{
      hx=margin;
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
      doc.text('#'+folioFormato(h.folio, h.anio_folio),hx,y); hx+=hCols[0];
      doc.text(h.fecha||'â€”',hx,y); hx+=hCols[1];
      doc.text(h.tipo||'',hx,y); hx+=hCols[2];
      doc.setTextColor(30,120,50);
      doc.text('$'+fmtMXN(h.pago||0),hx,y); hx+=hCols[3];
      doc.setTextColor(h.saldo>0?176:30,h.saldo>0?16:120,h.saldo>0?16:50);
      doc.text('$'+fmtMXN(h.saldo||0),hx,y);
      doc.setTextColor(20,10,5);
      doc.setDrawColor(230,210,170); doc.line(margin,y+1.5,margin+cW,y+1.5);
      y+=5;
    });
    y+=2;
  } else { y+=2; }

  // Firmas
  doc.setDrawColor(80,65,40); doc.setLineWidth(0.3);
  const fw=cW*0.38, fS=margin+28;
  doc.line(fS,y+8,fS+fw,y+8); doc.line(fS+fw+14,y+8,fS+fw*2+14,y+8);

  // â”€â”€ Determinar si autorizador es la MISMA persona que el responsable â”€â”€
  let mismaPersona = false;
  if(datos.autorizacion && datos.autorizacion.nombre){
    const limpiar = (s)=>String(s||'').toUpperCase()
      .replace(/\b(LIC\.?|LICENCIADO|LICENCIADA|MTRO\.?|MTRA\.?|DR\.?|DRA\.?|ING\.?|ARQ\.?|C\.?|SR\.?|SRA\.?|SRTA\.?)\b/g,'')
      .replace(/\s+/g,' ').trim();
    mismaPersona = (limpiar(datos.responsable) === limpiar(datos.autorizacion.nombre));
  }

  // Si es la MISMA persona: poner "AUTORIZÃ“" arriba del nombre del responsable
  if(mismaPersona){
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(154,110,24);
    doc.text('AUTORIZÃ“', fS+fw/2, y+5, {align:'center'});
  }

  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(40,30,15);
  doc.text((datos.responsable||'Responsable del TrÃ¡mite').toUpperCase(),fS+fw/2,y+12,{align:'center'});
  doc.text('C. '+(datos.nombre_cliente_firma||(datos.clientes[0]?.nombre)||'Cliente'),fS+fw+14+fw/2,y+12,{align:'center'});
  doc.setFontSize(6); doc.setTextColor(120,100,60);
  doc.text('Responsable del trÃ¡mite',fS+fw/2,y+15.5,{align:'center'});
  doc.text('Cliente',fS+fw+14+fw/2,y+15.5,{align:'center'});

  // â”€â”€ AUTORIZADOR â€” solo si es DISTINTO al responsable: dibujar firma adicional debajo â”€â”€
  if(datos.autorizacion && datos.autorizacion.nombre && !mismaPersona){
    const yAuth = y + 20;
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(154,110,24);
    doc.text('AUTORIZÃ“', fS+fw/2, yAuth, {align:'center'});
    // LÃ­nea de firma
    doc.setDrawColor(80,65,40); doc.setLineWidth(0.3);
    doc.line(fS, yAuth+6, fS+fw, yAuth+6);
    // Nombre del autorizador (con "Lic." y mayÃºsculas para consistencia con el responsable)
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(40,30,15);
    doc.text(String(datos.autorizacion.nombre).toUpperCase(), fS+fw/2, yAuth+10, {align:'center'});
    doc.setFontSize(6); doc.setTextColor(120,100,60);
    doc.text('Firma de quien autorizÃ³ la actualizaciÃ³n', fS+fw/2, yAuth+13.5, {align:'center'});
    y += 14; // empujar el resto del contenido (placas, etc.) hacia abajo
  }

  // â”€â”€ PLACAS GENERADAS â€” contorno VERDE, debajo de las firmas â”€â”€
  if(datos.placasEntregadas){
    const placasY = y + 20;
    const placasH = 12;
    doc.setFillColor(240,255,242); doc.setDrawColor(30,130,60); doc.setLineWidth(0.6);
    doc.rect(margin, placasY, cW, placasH, 'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(20,100,40);
    doc.text('PLACAS GENERADAS EN EL TR\u00c1MITE', margin+3, placasY+3.5);
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(10,80,30);
    doc.text('N\u00b0:', margin+3, placasY+9);
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(10,120,40);
    doc.text(String(datos.placasEntregadas), margin+11, placasY+9);
    if(datos.estadoPlacas){
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(10,80,30);
      doc.text('Estado:', margin+cW*0.45, placasY+9);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(10,100,35);
      doc.text(String(datos.estadoPlacas), margin+cW*0.45+14, placasY+9);
    }
    y += placasH + 2;
  }

  // â”€â”€ NOTA DE CANCELACIÃ“N â”€â”€
  if(datos.cancelado){
    const fechaCan = datos.fechaCancelacion
      ? new Date(datos.fechaCancelacion).toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})
      : new Date().toLocaleDateString('es-MX');
    const motivo = datos.motivoCancelacion || 'Sin motivo especificado';
    const boxY = y + 24;
    const boxH = 22;
    doc.setFillColor(255,245,245); doc.setDrawColor(180,40,40); doc.setLineWidth(0.5);
    doc.rect(margin, boxY, cW, boxH, 'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(160,20,20);
    doc.text('TRAMITE CANCELADO', margin+4, boxY+6);
    doc.setFont('helvetica','normal'); doc.setFontSize(6.8); doc.setTextColor(100,20,20);
    doc.text('Fecha de cancelacion: '+fechaCan, margin+4, boxY+12);
    const motivoLines = doc.splitTextToSize('Motivo: '+motivo, cW-10);
    doc.text(motivoLines[0], margin+4, boxY+18);
  }

  // Footer â€” aplicar a TODAS las pÃ¡ginas (en caso de salto por muchos abonos)
  const totalPaginas = doc.internal.getNumberOfPages();
  for(let pg = 1; pg <= totalPaginas; pg++){
    doc.setPage(pg);
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.line(margin,271,pageW-margin,271);
    doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','normal');
    doc.text('LEX-MÃ‰XICO DESPACHO JURÃDICO Â· CALLE MIGUEL HIDALGO ESQ. MÃ‰XICO NO. 200, LOCAL B Â· TEL: 953 128 7511',pageW/2,275,{align:'center'});
    if(totalPaginas > 1){
      doc.setFontSize(6); doc.setTextColor(120,100,60);
      doc.text('P\u00e1gina '+pg+' de '+totalPaginas, pageW-margin, 278, {align:'right'});
    }
  }
  doc.setPage(totalPaginas);

  // â”€â”€ MARCA DE AGUA â”€â”€
  // PAGADO: cuando saldo final es 0
  const _saldoFinalWM = (datos.saldoNuevo !== undefined && datos.saldoNuevo !== null)
    ? parseFloat(datos.saldoNuevo)
    : (datos.saldoPendiente !== undefined && datos.saldoPendiente !== null
        ? parseFloat(datos.saldoPendiente)
        : Math.max(0, (parseFloat(datos.totalGeneral)||0) - (datos.totalAbonado !== undefined ? parseFloat(datos.totalAbonado)||0 : parseFloat(datos.anticipo)||0)));
  if(_saldoFinalWM <= 0 && datos.totalGeneral > 0){
    dibujarMarcaAgua(doc, 'PAGADO', [30, 140, 60]);
  }
  // CANCELADO: si se pasa el flag
  if(datos.cancelado){
    dibujarMarcaAgua(doc, 'CANCELADO', [120, 120, 120]);
  }

  return doc;
}

// â”€â”€ FOLIO ANTERIOR â€” HISTORIAL DE PAGOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function obtenerHistorialPagos(folioRef){
  // Buscar recibo original + todos sus complementos
  const hist = [];
  const orig = appData.recibos.find(r=>r.folio===folioRef && !r.esComplemento);
  if(orig){
    hist.push({ folio:orig.folio, fecha:orig.fecha, tipo:'Recibo original',
      pago: orig.anticipo||0, saldo: orig.saldoPendiente });
  }
  // Complementos ligados a este folio
  appData.recibos.filter(r=>r.folioRef===folioRef).forEach(r=>{
    hist.push({ folio:r.folio, fecha:r.fecha, tipo: r.saldoPendiente<=0?'LiquidaciÃ³n':'Abono',
      pago: r.pago||0, saldo: r.saldoPendiente });
  });
  return hist;
}

// Referencia al recibo en modo consulta
reciboEnConsulta = null;

// â”€â”€ Buscar recibo por nÃºmero de expediente (ARCH-00001) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function cargarHistorialExpediente(){
  const raw = ($('expediente_buscar')||{}).value || '';
  const infoBox = document.getElementById('info-folio-anterior');
  const resumen = document.getElementById('resumen-folio-anterior');
  const histDiv  = document.getElementById('historial-pagos-prev');

  if(!raw.trim()){
    infoBox.style.display='none';
    histDiv.style.display='none';
    salirModoConsulta();
    return;
  }

  // Limpiar campo de folio para no tener dos bÃºsquedas activas
  const folioInp = document.getElementById('folio_anterior');
  if(folioInp) folioInp.value='';

  // Buscar en appData.recibos el campo expedienteNum
  const q = raw.trim().toUpperCase();
  const recibo = appData.recibos.find(r => r.expedienteNum && r.expedienteNum.toUpperCase() === q && !r.esComplemento);

  if(!recibo){
    infoBox.style.display='';
    infoBox.classList.remove('cancelado-box');
    histDiv.style.display='none';
    resumen.innerHTML='<span style="color:#b01010">Expediente <strong>'+q+'</strong> no encontrado en historial.</span>';
    reciboEnConsulta = null;
    salirModoConsulta();
    return;
  }

  // Redirigir al folio para usar el flujo existente de visualizaciÃ³n
  if(folioInp){ folioInp.value = recibo.folio; }
  // Vaciar campo expediente para no entrar en loop
  if($('expediente_buscar')) $('expediente_buscar').value = q; // mantener visible para referencia
  cargarHistorialFolio();
}

function cargarHistorialFolio(){
  const val = parseInt($('folio_anterior').value)||null;
  const infoBox = document.getElementById('info-folio-anterior');
  const resumen = document.getElementById('resumen-folio-anterior');
  const histDiv  = document.getElementById('historial-pagos-prev');
  const histBody = document.getElementById('historial-pagos-tbody');

  if(!val){
    infoBox.style.display='none';
    infoBox.classList.remove('cancelado-box');
    histDiv.style.display='none';
    salirModoConsulta();
    return;
  }

  const recibo = appData.recibos.find(r=>r.folio===val && !r.esComplemento);
  if(!recibo){
    resumen.innerHTML='<span style="color:#b01010">Folio #'+folioFormato(val)+' no encontrado en historial.</span>';
    infoBox.style.display='';
    infoBox.classList.remove('cancelado-box');
    histDiv.style.display='none';
    // Limpiar completamente el visor PDF â€” no mostrar el Ãºltimo recibo cargado (confunde al usuario)
    reciboEnConsulta = null;
    (function _limpiarVisorPDF(){
      var ifr = document.getElementById('pdf-consulta-iframe');
      if(ifr){ ifr.removeAttribute('src'); ifr.style.display='none'; }
      var wrap = document.getElementById('visor-pdf-wrap');
      if(wrap) wrap.style.display='none';
      var badge = document.getElementById('pdf-folio-badge');
      if(badge) badge.textContent='';
      var sbar = document.getElementById('pdf-status-bar');
      if(sbar) sbar.style.display='none';
    })();
    salirModoConsulta();
    return;
  }

  const totalTramite = parseFloat(recibo.total) || (recibo.conceptos||[]).reduce((s,c)=>s+(parseFloat(c.precio)||0),0);
  const _abonadoCalc = (recibo.pagosParciales||[]).reduce((s,p)=>s+(Number(p.cantidad)||0),0);
  const saldo = (recibo.saldoPendiente !== undefined && recibo.saldoPendiente !== null)
    ? Math.max(0, Number(recibo.saldoPendiente))
    : Math.max(0, totalTramite - _abonadoCalc);
  const totalAbonado = (recibo.totalAbonado != null && Number(recibo.totalAbonado) > 0)
    ? Number(recibo.totalAbonado)
    : (_abonadoCalc > 0 ? _abonadoCalc : Math.max(0, totalTramite - saldo));

  // Fecha formateada: "28 enero 2026 Â· 10:35 hrs."
  function formatearFechaHora(fechaISO, hora) {
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    let fechaStr = 'â€”';
    if(fechaISO) {
      const partes = fechaISO.split('-');
      if(partes.length === 3) {
        const d = parseInt(partes[2],10);
        const m = parseInt(partes[1],10) - 1;
        const y = partes[0];
        fechaStr = d + ' de ' + meses[m] + ' de ' + y;
      }
    }
    return fechaStr + (hora ? ' Â· ' + hora + ' hrs.' : '');
  }
  const fechaHoraStr = formatearFechaHora(recibo.fecha, recibo.hora);

  const statusColor = saldo<=0 ? '#2a7a3a' : '#b01010';
  const statusIcon  = saldo<=0 ? 'âœ… LIQUIDADO' : 'âš  SALDO PENDIENTE';

  // Fila monetaria: etiqueta | monto numÃ©rico con comas
  function filaMonetaria(label, valor, color, bold, borderTop){
    const estiloLbl = 'font-family:\'DM Mono\',monospace;font-size:0.6rem;color:'+(color||'#7a6840')+';text-transform:uppercase;letter-spacing:0.08em;'+(bold?'font-weight:700;':'')+(borderTop?'padding-top:5px;border-top:1px solid #e0d8c0;':'');
    const estiloVal = 'font-family:\'DM Mono\',monospace;font-size:0.85rem;text-align:right;font-weight:'+(bold?'700':'600')+';color:'+(color||'#1a1008')+';'+(borderTop?'padding-top:5px;border-top:1px solid #e0d8c0;':'');
    return '<span style="'+estiloLbl+'">'+label+'</span>'
          +'<span style="'+estiloVal+'">$'+fmtMXN(valor)+'</span>';
  }

  resumen.innerHTML=
    '<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 14px;align-items:baseline;margin-bottom:6px;"'
    +(recibo.cancelado?' style="color:#888;text-decoration:line-through;"':'')+
    '>'
    +'<span style="font-family:\'DM Mono\',monospace;font-size:0.6rem;color:'+(recibo.cancelado?'#999':'#7a6840')+';text-transform:uppercase;letter-spacing:0.1em;'+(recibo.cancelado?'text-decoration:line-through;':'')+'">Cliente</span>'
    +'<strong style="font-size:0.88rem;color:'+(recibo.cancelado?'#999':'inherit')+';'+(recibo.cancelado?'text-decoration:line-through;':'')+'">'+recibo.nombre+'</strong>'
    +'<span style="font-family:\'DM Mono\',monospace;font-size:0.6rem;color:'+(recibo.cancelado?'#999':'#7a6840')+';text-transform:uppercase;letter-spacing:0.1em;'+(recibo.cancelado?'text-decoration:line-through;':'')+'">Fecha original</span>'
    +'<span style="font-size:0.82rem;font-family:\'DM Mono\',monospace;color:'+(recibo.cancelado?'#999':'inherit')+';'+(recibo.cancelado?'text-decoration:line-through;':'')+'">'+fechaHoraStr+'</span>'
    +(recibo.expedienteNum
      ? '<span style="font-family:\'DM Mono\',monospace;font-size:0.6rem;color:#5a1a6a;text-transform:uppercase;letter-spacing:0.1em;">Expediente</span>'
        +'<span style="font-size:0.82rem;font-family:\'DM Mono\',monospace;color:#5a1a6a;font-weight:700;">'+recibo.expedienteNum+'</span>'
      : '<span style="font-family:\'DM Mono\',monospace;font-size:0.6rem;color:#aaa;text-transform:uppercase;letter-spacing:0.1em;">Expediente</span>'
        +'<span style="font-size:0.75rem;font-family:\'DM Mono\',monospace;color:#aaa;">Sin asignar '
        +'<button onclick="abrirModalExpedienteDesdeConsulta('+val+')" style="font-size:0.6rem;background:rgba(90,26,106,0.1);border:1px solid rgba(90,26,106,0.3);color:#5a1a6a;border-radius:3px;padding:1px 6px;cursor:pointer;font-family:inherit;">+ Asignar</button>'
        +'</span>'
    )
    +'</div>'
    +'<div style="background:'+(recibo.cancelado?'#f5f5f5':'#fff')+';border:1px solid '+(recibo.cancelado?'#ccc':'#e0d8c0')+';border-radius:3px;padding:7px 10px;margin-bottom:6px;">'
    +'<div style="display:grid;grid-template-columns:1fr auto;gap:3px 14px;">'
    + filaMonetaria('Total del TrÃ¡mite', totalTramite, recibo.cancelado?'#aaa':'#1a1008', false, false)
    + filaMonetaria('Total Abonado', totalAbonado, recibo.cancelado?'#aaa':'#2a7a3a', false, false)
    +(recibo.cancelado
      ? ('<span style="font-family:\'DM Mono\',monospace;font-size:0.6rem;color:#999;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;padding-top:5px;border-top:1px solid #e0d8c0;text-decoration:line-through;">TRÃMITE CANCELADO</span>'
        +'<span style="font-family:\'DM Mono\',monospace;font-size:0.85rem;text-align:right;font-weight:700;color:#999;padding-top:5px;border-top:1px solid #e0d8c0;text-decoration:line-through;">â€”</span>')
      : filaMonetaria(statusIcon, saldo, statusColor, true, true)
    )
    +'</div>'
    +(recibo.cancelado
      ? '<div style="font-size:0.67rem;color:#999;font-style:italic;font-weight:600;margin-top:6px;border-top:1px dashed #ddd;padding-top:5px;text-decoration:line-through;">TRÃMITE CANCELADO</div>'
      : (saldo>0
        ? '<div style="font-size:0.67rem;color:'+statusColor+';font-style:italic;font-weight:600;margin-top:6px;border-top:1px dashed #e0d8c0;padding-top:5px;line-height:1.6;letter-spacing:0.01em;">'+numeroALetras(saldo)+'</div>'
        : '<div style="font-size:0.67rem;color:#2a7a3a;font-style:italic;margin-top:5px;border-top:1px dashed #e0d8c0;padding-top:4px;">Sin saldo pendiente</div>'
      )
    )
    +'</div>';
  infoBox.style.display='';
  // Aplicar estilo visual de cancelado si corresponde
  if(recibo.cancelado){
    infoBox.classList.add('cancelado-box');
  } else {
    infoBox.classList.remove('cancelado-box');
  }

  const hist = obtenerHistorialPagos(val);
  if(hist.length){
    // Si el recibo estÃ¡ cancelado, todas las filas del historial van tachadas y en gris
    const trStyle = recibo.cancelado
      ? ' style="color:#999;text-decoration:line-through;background:#f5f5f5;"'
      : '';
    const cellGray = recibo.cancelado ? 'color:#999;text-decoration:line-through;' : '';
    histBody.innerHTML = hist.map(h=>'<tr'+trStyle+'>'
      +'<td style="font-family:\'DM Mono\',monospace;white-space:nowrap;'+cellGray+'">#'+folioFormato(h.folio, h.anio_folio)+'</td>'
      +'<td style="white-space:nowrap;'+cellGray+'">'+(h.fecha||'\u2014')+'</td>'
      +'<td style="white-space:nowrap;'+cellGray+'">'+h.tipo+'</td>'
      +'<td style="text-align:right;white-space:nowrap;font-family:\'DM Mono\',monospace;'+cellGray+'">$'+fmtMXN(h.pago||0)+'</td>'
      +'<td style="text-align:right;white-space:nowrap;font-family:\'DM Mono\',monospace;'+(recibo.cancelado?'color:#999;text-decoration:line-through;':('color:'+(h.saldo>0?'#b01010':'#2a7a3a')))+'">$'+fmtMXN(h.saldo||0)+'</td>'
      +'</tr>').join('');
    histDiv.style.display='';
  } else {
    histDiv.style.display='none';
  }

  // Activar modo consulta siempre que haya un folio vÃ¡lido (con o sin saldo)
  reciboEnConsulta = saldo > 0 ? recibo : null;
  activarModoConsulta(recibo, saldo);
}

async function activarModoConsulta(recibo, saldo){
  // saldo puede llegar como parÃ¡metro o calcularse desde el recibo
  if(typeof saldo === 'undefined' || saldo === null){
    const _tot = parseFloat(recibo.total) || (recibo.conceptos||[]).reduce((s,c)=>s+(parseFloat(c.precio)||0),0);
    const _ab  = (recibo.pagosParciales||[]).reduce((s,p)=>s+(Number(p.cantidad)||0),0);
    saldo = (recibo.saldoPendiente !== undefined && recibo.saldoPendiente !== null)
      ? Math.max(0, Number(recibo.saldoPendiente))
      : Math.max(0, _tot - _ab);
  }
  // Activar clase en body
  document.body.classList.add('modo-consulta');
  // Ocultar formulario directamente via JS (respaldo al CSS)
  const _rb = document.querySelector('.recibo-body');
  if(_rb) _rb.style.setProperty('display','none','important');
  if(typeof syncFormVisibility==='function') syncFormVisibility();
  // Abrir los paneles si estÃ¡n cerrados
  if(typeof _panelesBusquedaAbiertos !== 'undefined' && !_panelesBusquedaAbiertos){
    if(typeof togglePanelesBusqueda === 'function') togglePanelesBusqueda();
  }

  // Mostrar PDF original en el iframe
  const iframe = document.getElementById('pdf-consulta-iframe');

  // Limpiar src anterior
  iframe.removeAttribute('src');

  // Helper: muestra un data URI de PDF directamente en el embed (compatible con todos los navegadores)
  async function mostrarBlobEnIframe(src){
    try {
      // Convertir data URI a Blob URL â€” Chrome bloquea data URIs en embed/iframe
      let blobUrl = src;
      if(src.startsWith('data:application/pdf') || src.includes('base64,')){
        const b64 = src.split(',')[1];
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for(let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
        const blob = new Blob([buf], {type:'application/pdf'});
        // Revocar URL anterior si existe
        if(iframe._blobUrl){ try{URL.revokeObjectURL(iframe._blobUrl);}catch(e){ registrarError('catch vacio', e); } }
        blobUrl = URL.createObjectURL(blob);
        iframe._blobUrl = blobUrl;
      }
      iframe.setAttribute('src', blobUrl);
      iframe.style.display = 'block';
      const wrapOk = document.getElementById('visor-pdf-wrap');
      if(wrapOk) wrapOk.style.display = '';
      const sbarOk = document.getElementById('pdf-status-bar');
      if(sbarOk) sbarOk.style.display = '';
    } catch(e) {
      console.error('mostrarBlobEnIframe:', e);
    }
  }

  if(recibo.pdfBase64){
    // SesiÃ³n actual: ya tenemos el PDF en memoria
    await mostrarBlobEnIframe(recibo.pdfBase64);
  } else if(window.SB && window.SB_DESPACHO_ID && recibo.archivo){
    // Descargar el PDF desde Supabase Storage
    setStatus('loading','Cargando PDFâ€¦','loading');
    try {
      const path = window.SB_DESPACHO_ID + '/recibos/' + recibo.archivo;
      const { data: blob, error: dlErr } = await window.SB.storage
        .from(STORAGE_BUCKET)
        .download(path);
      if(!dlErr && blob){
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            recibo.pdfBase64 = reader.result;
            iframe.setAttribute('src', reader.result);
            resolve();
          };
          reader.readAsDataURL(blob);
        });
        setStatus('ok','PDF cargado desde Supabase','ok');
      } else {
        // PDF no encontrado en Storage â€” regenerar
        await rec_regenerarPDFDesdeRecibo(recibo, iframe, mostrarBlobEnIframe);
      }
    } catch(e){
      console.error('activarModoConsulta storage:', e);
      await rec_regenerarPDFDesdeRecibo(recibo, iframe, mostrarBlobEnIframe);
    }
  } else {
    // Sin sesiÃ³n activa â€” intentar regenerar desde datos locales
    await rec_regenerarPDFDesdeRecibo(recibo, iframe, mostrarBlobEnIframe);
  }

  // Helper compartido: regenerar PDF desde datos del recibo
  async function rec_regenerarPDFDesdeRecibo(rec, iframeEl, mostrar){
    if(!rec.clientes && !rec.nombre){ setStatus('err','Sin datos suficientes para generar el PDF','err'); return; }
    try {
      setStatus('loading','Regenerando PDF del folio #'+folioFormato(rec.folio, rec.anio_folio)+'â€¦','loading');

      // â”€â”€ VALIDACIÃ“N AUTOMÃTICA DE SALDOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      // Recalcula totalAbonado y saldoNuevo desde los pagosParciales para garantizar
      // que el PDF siempre muestre los valores correctos, sin importar lo que
      // haya quedado guardado en el JSON.
      (function _validarSaldos(r){
        const total        = parseFloat(r.total) || 0;
        const anticipo     = parseFloat(r.anticipo) || 0;
        const pagos        = r.pagosParciales || [];
        const costosExtra  = r.costosExtra || [];

        // Suma total real de costos extra
        const sumaExtra = costosExtra.reduce((s,c) => s + (parseFloat(c.precio)||0), 0);
        const totalReal = total; // 'total' ya incluye costos extra

        // Suma real de todos los pagos parciales registrados
        const sumaPagos = pagos.reduce((s,p) => s + (parseFloat(p.cantidad)||0), 0);

        // El total abonado real = anticipo si no hay pagosParciales, o sumaPagos si los hay
        // CRÃTICO: si sumaPagos=0 pero hay anticipo, usar el anticipo
        const totalAbonadoReal = sumaPagos > 0
          ? Math.min(sumaPagos, totalReal)
          : Math.min(anticipo, totalReal);
        const saldoReal        = Math.max(0, totalReal - totalAbonadoReal);

        // Si hay discrepancia, corregir en memoria antes de generar el PDF
        if(r.totalAbonado === undefined || r.totalAbonado === null || r.totalAbonado !== totalAbonadoReal){
          console.warn('[LEX] Folio', r.folio, 'â€” totalAbonado corregido de', r.totalAbonado, 'a', totalAbonadoReal);
          r.totalAbonado = totalAbonadoReal;
        }
        if(r.saldoNuevo === undefined || r.saldoNuevo === null || r.saldoNuevo !== saldoReal){
          console.warn('[LEX] Folio', r.folio, 'â€” saldoNuevo corregido de', r.saldoNuevo, 'a', saldoReal);
          r.saldoNuevo = saldoReal;
        }
        if(r.saldoPendiente !== saldoReal){
          r.saldoPendiente = saldoReal;
        }
      })(rec);
      // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

      const datos = {
        folio: rec.folio,
        clientes: rec.clientes||[{nombre:rec.nombre||'',movil:'',tel:'',domicilio:''}],
        conceptos: rec.conceptos||[],
        tipoTramite: rec.tipoTramite||'normal',
        fecha_recibo: rec.fecha_recibo||rec.fecha,
        hora_recibo: rec.hora_recibo||rec.hora,
        anticipo: rec.anticipo||'0',
        responsable: rec.responsable||'',
        nombre_cliente_firma: rec.nombre_cliente_firma||rec.nombre||'',
        tramites: rec.tramites||'',
        clase:rec.clase||'', marca:rec.marca||'',
        serie:rec.serie||'', motor:rec.motor||'',
        anio:rec.anio||'', puertas:rec.puertas||'',
        color_veh:rec.color_veh||'', transmision:rec.transmision||'',
        cilindros:rec.cilindros||'', placa:rec.placa||'',
        ultima_tenencia:rec.ultima_tenencia||'',
        origen:rec.origen||'', combustible:rec.combustible||'',
        copias:rec.copias||[], costosExtra:rec.costosExtra||[],
        pagosParciales:rec.pagosParciales||[], fechasImpresion:rec.fechasImpresion||[],
        totalGeneral: rec.total||0,
        totalAbonado: rec.totalAbonado,
        saldoNuevo:   rec.saldoNuevo
      };
      const qrTexto='LEX-MEXICO|Folio:'+folioFormato(rec.folio, rec.anio_folio)+'|'+rec.nombre+'|'+datos.fecha_recibo+' '+datos.hora_recibo;
      const qrDataURL=await qrToDataURL(qrTexto);
      const doc=await generarPDF(datos,rec.folio,qrDataURL);
      const pdfDataUri=doc.output('datauristring');
      rec.pdfBase64=pdfDataUri;
      await mostrar(pdfDataUri);
      // Subir a Supabase (upsert evita duplicados)
      if(window.SB && window.SB_DESPACHO_ID && rec.archivo){
        subirPDFaDrive(doc.output('blob'), rec.archivo).catch(e=>console.warn('Storage PDF regen:', e));
      }
      setStatus('ok','PDF regenerado para folio #'+folioFormato(rec.folio, rec.anio_folio),'ok');
    } catch(eRegen){
      console.error('rec_regenerarPDFDesdeRecibo:',eRegen);
      setStatus('err','No se pudo regenerar el PDF: '+eRegen.message,'err');
    }
  }

  // Actualizar toolbar
  const folioStr = folioFormato(recibo.folio, recibo.anio_folio);
  document.getElementById('pdf-folio-badge').textContent = 'FOLIO #' + folioStr;
  document.getElementById('pdf-toolbar-nombre').textContent = recibo.nombre || 'â€”';
  const saldoBadge = document.getElementById('pdf-saldo-badge');
  if(recibo.cancelado){
    saldoBadge.textContent = 'ðŸš« TRÃMITE CANCELADO';
    saldoBadge.style.color = '#999';
    saldoBadge.style.textDecoration = 'line-through';
  } else if(saldo > 0){
    saldoBadge.textContent = 'Saldo pendiente: $' + fmtMXN(saldo);
    saldoBadge.style.color = '#c0161a';
    saldoBadge.style.textDecoration = '';
  } else {
    saldoBadge.textContent = 'âœ… LIQUIDADO';
    saldoBadge.style.color = '#2a9a4a';
    saldoBadge.style.textDecoration = '';
  }

  // Actualizar folio display con el folio consultado
  $('folio-display').textContent = folioStr;

  // Actualizar banner
  const bannerTxt = document.getElementById('banner-saldo-txt');
  if(bannerTxt){
    if(recibo.cancelado){
      bannerTxt.textContent = 'ðŸš« TRÃMITE CANCELADO';
      bannerTxt.style.color = '#aaa';
      bannerTxt.style.textDecoration = 'line-through';
    } else if(saldo > 0){
      bannerTxt.textContent = 'âš  Saldo: $' + fmtMXN(saldo);
      bannerTxt.style.color = '#ffccaa';
      bannerTxt.style.textDecoration = '';
    } else {
      bannerTxt.textContent = 'âœ… Liquidado';
      bannerTxt.style.color = '#aaffcc';
      bannerTxt.style.textDecoration = '';
    }
  }

  if(saldo <= 0){
    document.body.classList.add('folio-liquidado');
  } else {
    document.body.classList.remove('folio-liquidado');
  }
  // Si el recibo estÃ¡ cancelado: ocultar botones de pago y anular
  if(recibo.cancelado){
    document.body.classList.add('folio-cancelado');
  } else {
    document.body.classList.remove('folio-cancelado');
  }
  document.body.classList.add('modo-consulta');
  // Ocultar formulario directamente via JS (respaldo al CSS)
  const _rb2 = document.querySelector('.recibo-body');
  if(_rb2) _rb2.style.setProperty('display','none','important');
  // Abrir los paneles si estÃ¡n cerrados para que el usuario vea el folio consultado
  if(typeof _panelesBusquedaAbiertos !== 'undefined' && !_panelesBusquedaAbiertos){
    if(typeof togglePanelesBusqueda === 'function') togglePanelesBusqueda();
  }
  // Sincronizar visibilidad del formulario (cubre el caso donde el panel ya estaba abierto)
  if(typeof syncFormVisibility === 'function') syncFormVisibility();
}

function salirModoConsulta(){
  reciboEnConsulta = null;
  document.body.classList.remove('modo-consulta');
  document.body.classList.remove('folio-liquidado');
  document.body.classList.remove('folio-cancelado');
  // Restaurar formulario (solo si el panel de bÃºsqueda estÃ¡ cerrado)
  const _rb = document.querySelector('.recibo-body');
  if(_rb) _rb.style.removeProperty('display');
  if(typeof syncFormVisibility==='function') syncFormVisibility();
  // Limpiar embed PDF y ocultar visor
  const iframe = document.getElementById('pdf-consulta-iframe');
  if(iframe){ iframe.removeAttribute('src'); iframe.style.display='none'; }
  const wrap = document.getElementById('visor-pdf-wrap');
  if(wrap) wrap.style.display='none';
  const badge = document.getElementById('pdf-folio-badge');
  if(badge) badge.textContent='';
  const sbar = document.getElementById('pdf-status-bar');
  if(sbar) sbar.style.display='none';
  // Restaurar folio display al actual
  if(typeof appData !== 'undefined') actualizarFolioDisplay();
}

function cargarReciboEnFormulario(recibo){
  // Mostrar folio del recibo consultado
  $('folio-display').textContent = folioFormato(recibo.folio, recibo.anio_folio);

  // Cargar clientes
  const wrap = $('clientes-wrapper');
  wrap.innerHTML = ''; clienteCount = 0;
  const clientes = recibo.clientes || [{nombre: recibo.nombre||'', movil:'', tel:'', domicilio:''}];
  clientes.forEach(c => {
    clienteCount++;
    const cid = 'c'+clienteCount;
    const div = document.createElement('div');
    div.className = 'cliente-row'; div.id = 'cliente-row-'+cid;
    div.innerHTML =
      '<div class="cliente-fila-top">'
      +'<div class="field-group"><label>Nombre completo</label>'
        +'<input type="text" id="nombre_'+cid+'" value="'+escHTML(c.nombre||'')+'" style="text-transform:uppercase"></div>'
      +'<div class="field-group"><label>M\u00f3vil</label>'
        +'<input type="text" id="movil_'+cid+'" value="'+escHTML(c.movil||'')+'"></div>'
      +'<div class="field-group"><label>Tel. Casa</label>'
        +'<input type="text" id="tel_'+cid+'" value="'+escHTML(c.tel||'')+'"></div>'
      +'<div></div>'
      +'</div>'
      +'<div class="cliente-fila-bot">'
        +'<div class="field-group"><label>Domicilio</label>'
          +'<input type="text" id="domicilio_'+cid+'" value="'+escHTML(c.domicilio||'')+'"></div>'
      +'</div>';
    wrap.appendChild(div);
  });

  // Campos de vehiculo / trÃ¡mite â€” selects e inputs simples
  ['tramites','clase','marca','serie','motor','anio','puertas',
   'color_veh','transmision','cilindros','placa','ultima_tenencia','origen','combustible'].forEach(fid=>{
    const el = document.getElementById(fid);
    if(el && recibo[fid]!==undefined) el.value = recibo[fid];
  });

  // Fecha y hora
  if(recibo.fecha_recibo){
    $('fecha_recibo').value = recibo.fecha_recibo;
    try{
      const fd = new Date(recibo.fecha_recibo+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
      document.getElementById('fecha_recibo_display').textContent = fd.charAt(0).toUpperCase()+fd.slice(1);
    }catch(e){ registrarError('catch vacio', e); }
  }
  if(recibo.hora_recibo){
    $('hora_recibo').value = recibo.hora_recibo;
    document.getElementById('hora_recibo_display').textContent = (recibo.hora_recibo||'')+' hrs.';
  }

  // Tipo trÃ¡mite y documento â€” restaurar ANTES de documentos para que las categorÃ­as correctas estÃ©n visibles
  if(recibo.tipoTramite) setTipoTramite(recibo.tipoTramite);
  const tipoDocGuardado = recibo.tipo_doc || 'copia';
  setTipoDoc(tipoDocGuardado);

  // Documentos seleccionados â€” copias puede ser: array, JSON string {tipodoc,docs:[]}, o string vacÃ­o
  document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  let copiasArr = [];
  const copiasRaw = recibo.copias;
  if(Array.isArray(copiasRaw)){
    copiasArr = copiasRaw;
  } else if(typeof copiasRaw === 'string' && copiasRaw.trim().startsWith('{')){
    try{ const p = JSON.parse(copiasRaw); copiasArr = p.docs || []; }catch(e){ copiasArr = []; }
  }
  copiasArr.forEach(val => {
    const cb = document.querySelector('#docs-checklist input[value="'+val+'"]');
    if(cb) cb.checked = true;
  });
  // Restaurar tipo_doc desde el JSON de copias si no estaba guardado directamente
  if(!recibo.tipo_doc && typeof copiasRaw === 'string' && copiasRaw.includes('ESCANEARON')){
    setTipoDoc('escaneo');
  }
  // Abrir automÃ¡ticamente las categorÃ­as de documentos que tengan Ã­tems seleccionados
  document.querySelectorAll('#docs-checklist .doc-category').forEach(cat => {
    const tieneSeleccionados = cat.querySelectorAll('input[type="checkbox"]:checked').length > 0;
    const body = cat.querySelector('.doc-category-body');
    const arrow = cat.querySelector('.doc-category-header span');
    if(tieneSeleccionados && body && arrow){
      body.style.display = '';
      arrow.textContent = '\u25be';
    }
  });
  // Si el trÃ¡mite es vehicular, abrir secciÃ³n datos del vehiculo automÃ¡ticamente
  if(recibo.tipoTramite === 'vehicular'){
    const vBody = document.getElementById('vehicle-grid-body');
    const vArrow = document.querySelector('.section-label-toggle .veh-arrow');
    if(vBody) vBody.style.display = 'grid';
    if(vArrow) vArrow.textContent = '\u25be';
  }

  // Conceptos
  const tbody = $('conceptos-tbody');
  tbody.innerHTML = ''; conceptoCount = 0;
  (recibo.conceptos||[]).forEach(c => {
    conceptoCount++;
    const cid2 = 'cp'+conceptoCount;
    const tr = document.createElement('tr'); tr.id = 'concepto-row-'+cid2;
    tr.innerHTML = '<td><textarea class="concepto concepto-ta" rows="1">'+escHTML(c.concepto||'')+'</textarea></td>'
      +'<td><textarea class="descripcion concepto-ta" rows="1">'+escHTML(c.descripcion||'')+'</textarea></td>'
      +'<td><input type="text" class="precio price-input" value="'+escHTML(String(c.precio||'0'))+'"></td>'
      +'<td></td>';
    tbody.appendChild(tr);
  });

  // Anticipo y firmas
  const elAnticipo = $('anticipo');
  if(elAnticipo) elAnticipo.value = parseFloat(recibo.anticipo||'0').toLocaleString('es-MX');
  const elResp = $('responsable');
  if(elResp && recibo.responsable) elResp.value = recibo.responsable;
  const elFirma = $('nombre_cliente_firma');
  if(elFirma && recibo.nombre_cliente_firma) elFirma.value = recibo.nombre_cliente_firma;

  // Mostrar bloque de placas si el recibo ya tiene capturadas
  mostrarPlacasEnPantalla(recibo.placasEntregadas, recibo.estadoPlacas);

  calcTotales();
}

// Mostrar/ocultar el cuadro rojo de placas en el formulario
function mostrarPlacasEnPantalla(placas, estado){
  const box = document.getElementById('placas-display-box');
  if(!box) return;
  if(placas){
    box.style.display = 'block';
    document.getElementById('placas-display-numero').textContent = placas;
    document.getElementById('placas-display-estado').textContent = estado || 'â€”';
  } else {
    box.style.display = 'none';
    document.getElementById('placas-display-numero').textContent = 'â€”';
    document.getElementById('placas-display-estado').textContent = 'â€”';
  }
}

function escHTML(str){
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function cerrarConsulta(){
  // 1. Quitar clases de modo
  reciboEnConsulta = null;
  document.body.classList.remove('modo-consulta');
  document.body.classList.remove('folio-liquidado');
  document.body.classList.remove('folio-cancelado');
  document.body.classList.remove('paneles-busqueda-abiertos');
  _panelesBusquedaAbiertos = false;
  if(typeof _pbcAbierto !== 'undefined') _pbcAbierto = false;
  if(typeof _pfcAbierto !== 'undefined') _pfcAbierto = false;

  // 2. CRÃTICO: El CSS body.modo-consulta fuerza paneles-busqueda-cuerpo a display:block !important
  // quitando el atributo style inline. El selector CSS :has(:not([style*="display:none"]))
  // entonces oculta recibo-body. Restaurar el atributo setAttribute para que el selector lo detecte.
  const cuerpo = document.getElementById('paneles-busqueda-cuerpo');
  if(cuerpo) cuerpo.setAttribute('style','display:none;padding:0 20px 14px;');

  // 3. Limpiar PDF
  const iframe = document.getElementById('pdf-consulta-iframe');
  if(iframe){ iframe.removeAttribute('src'); iframe.style.display='none'; }
  const visorWrap = document.getElementById('visor-pdf-wrap');
  if(visorWrap) visorWrap.style.display='none';
  const sbar = document.getElementById('pdf-status-bar');
  if(sbar) sbar.style.display='none';

  // 4. Limpiar auxiliares
  const fa = $('folio_anterior');
  if(fa) fa.value = '';
  const infoBox = document.getElementById('info-folio-anterior');
  const histDiv  = document.getElementById('historial-pagos-prev');
  if(infoBox) infoBox.style.display = 'none';
  if(histDiv)  histDiv.style.display = 'none';
  if(typeof mostrarPlacasEnPantalla === 'function') mostrarPlacasEnPantalla(null, null);

  // 5. Limpiar formulario y folio
  if(typeof limpiarFormCompleto === 'function') limpiarFormCompleto();
  if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
  setStatus('ok','Folio #'+folioFormato(appData.folioActual)+' listo para capturar','ok');
  setTimeout(()=>{
    const rb = document.getElementById('recibo-body');
    if(rb) rb.scrollIntoView({behavior:'smooth', block:'start'});
    else window.scrollTo({top:0, behavior:'smooth'});
  }, 150);
}

async function ejecutarPagoParcial(){
  if(!reciboEnConsulta){ showModal('Error','No hay un recibo en consulta.'); return; }
  const recibo = reciboEnConsulta;
  const saldo = parseFloat(recibo.saldoPendiente)||0;
  if(saldo<=0){ showModal('Sin saldo','Este recibo ya estÃ¡ liquidado.'); return; }

  auditoriaRegistrar('abono', 'Comprobante abono â€” Ref. Folio #' + folioFormato(recibo.folio, recibo.anio_folio));

  // Cerrar modo consulta y abrir formulario nuevo prellenado
  salirModoConsulta();
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto();
  if(typeof ir==='function') ir('nuevo-recibo');

  setTimeout(()=>{
    // Precargar datos del recibo original
    const cliente = (recibo.clientes && recibo.clientes[0]) ? recibo.clientes[0] : { nombre: recibo.nombre||'', movil:'', tel:'', domicilio:'' };

    // Cargar cliente
    if(typeof cargarReciboEnFormulario==='function'){
      cargarReciboEnFormulario({
        clientes: recibo.clientes || [cliente],
        tipoTramite: recibo.tipoTramite || 'normal',
        responsable: recibo.responsable || '',
        nombre_cliente_firma: recibo.nombre_cliente_firma || recibo.nombre || '',
        conceptos: [], // comprobante de abono no tiene conceptos propios
        anticipo: String(saldo), // el monto del abono por defecto es el saldo
      });
    }

    // Marcar como comprobante de abono con referencia al folio original
    window._folioReferencia = recibo.folio;
    window._reciboOriginalRef = recibo;

    // Mostrar banner de referencia
    let banner = document.getElementById('abono-ref-banner');
    if(!banner){
      banner = document.createElement('div');
      banner.id = 'abono-ref-banner';
      banner.style.cssText = 'background:linear-gradient(135deg,#1a4a8a,#0f2a5a);color:#c8e0ff;padding:10px 18px;font-family:JetBrains Mono,monospace;font-size:0.68rem;letter-spacing:0.08em;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid rgba(59,130,246,0.4);margin-bottom:8px;border-radius:8px;';
      const reciboCont = document.getElementById('panel-nuevo-recibo');
      if(reciboCont) reciboCont.insertBefore(banner, reciboCont.firstChild);
    }
    banner.innerHTML = `<span>ðŸ’° COMPROBANTE DE ABONO â€” Referencia: <strong>${folioFormato(recibo.folio, recibo.anio_folio)}</strong> Â· Cliente: <strong>${cliente.nombre}</strong> Â· Saldo pendiente: <strong>$${saldo.toFixed(2)}</strong></span>
      <button onclick="cancelarAbonoNuevo()" style="background:rgba(192,22,26,0.2);border:1px solid rgba(192,22,26,0.4);color:#ffaaaa;border-radius:4px;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:0.65rem;">âœ• Cancelar</button>`;
    banner.style.display='flex';

    if(typeof toast==='function') toast('ðŸ’° Comprobante de abono â€” completa los datos y presiona ðŸ–¨ Imprimir');
    if(typeof setStatus==='function') setStatus('ok','Comprobante de abono â€” Ref. '+folioFormato(recibo.folio, recibo.anio_folio)+' Â· Saldo: $'+saldo.toFixed(2),'ok');
  }, 300);
}

function cancelarAbonoNuevo(){
  window._folioReferencia = null;
  window._reciboOriginalRef = null;
  const banner = document.getElementById('abono-ref-banner');
  if(banner) banner.style.display='none';
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto();
  if(typeof setStatus==='function') setStatus('ok','Comprobante cancelado','ok');
}

// â”€â”€ MODO ACTUALIZACIÃ“N (mismo folio, conceptos originales bloqueados, costos extra + pagos parciales editables) â”€â”€
reciboEnActualizacion = null;

function abrirModoActualizacion(recibo){
  reciboEnActualizacion = recibo;

  // Salir del modo consulta (oculta el iframe del PDF) y entrar al formulario congelado
  document.body.classList.remove('modo-consulta');
  document.body.classList.remove('folio-liquidado');
  document.body.classList.remove('folio-cancelado');
  document.body.classList.remove('actualizacion-impresa');
  const iframe = document.getElementById('pdf-consulta-iframe');
  if(iframe){
    iframe.removeAttribute('src');
  }

  // Cargar todos los datos del recibo en el formulario
  cargarReciboEnFormulario(recibo);

  // Asegurar que el folio mostrado sea el ORIGINAL (no se cambia)
  $('folio-display').textContent = folioFormato(recibo.folio, recibo.anio_folio);

  // Congelar el formulario (todos los campos originales bloqueados)
  document.body.classList.add('recibo-frozen');
  document.body.classList.add('modo-actualizacion');
  // Deshabilitar checkboxes del checklist tambiÃ©n
  document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(cb => { cb.disabled = true; });

  // Limpiar y poblar las dos secciones nuevas con lo que ya estÃ© guardado
  pintarCostosExtra(recibo.costosExtra || []);
  pintarPagosParciales(recibo.pagosParciales || []);

  setStatus('ok','Modo actualizaci\u00f3n: folio #'+folioFormato(recibo.folio, recibo.anio_folio)+' \u2014 agrega servicios complementarios o pagos parciales','ok');

  setTimeout(()=>{ document.getElementById('seccion-pagos-parciales').scrollIntoView({behavior:'smooth',block:'center'}); }, 200);
}

function cancelarActualizacion(){
  reciboEnActualizacion = null;
  document.body.classList.remove('modo-actualizacion','recibo-frozen','desde-liquidacion',
    'actualizacion-impresa','en-accion-pago','paneles-abiertos-consulta');
  const _sbCan = document.querySelector('.status-bar');
  if(_sbCan) _sbCan.removeAttribute('style');
  const _btnTogCan = document.getElementById('btn-toggle-paneles');
  if(_btnTogCan) _btnTogCan.style.removeProperty('display');
  const _aActF = document.getElementById('actions-actualizacion');
  if(_aActF) _aActF.setAttribute('style','display:none !important;');
  document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(cb => { cb.disabled = false; });
  document.getElementById('costos-extra-tbody').innerHTML = '';
  document.getElementById('pagos-parciales-tbody').innerHTML = '';
  document.getElementById('seccion-costos-extra').style.display = 'none';
  document.getElementById('seccion-pagos-parciales').style.display = 'none';
  document.getElementById('resumen-pagos-parciales').style.display = 'none';
  // Resetear botones de actualizaciÃ³n a su estado original
  const btnCancelar = document.getElementById('btn-cancelar-actualizacion');
  if(btnCancelar){
    btnCancelar.innerHTML = 'âœ• Cancelar ActualizaciÃ³n';
    btnCancelar.onclick = cancelarActualizacion;
  }
  const btnImprimir = document.getElementById('btn-imprimir-actualizacion');
  if(btnImprimir){
    btnImprimir.innerHTML = '\uD83D\uDDA8 Imprimir ActualizaciÃ³n';
    btnImprimir.onclick = imprimirActualizacion;
  }
  lastActualizacionBlob = null;
  lastActualizacionNombre = null;
  // Limpiar cuadro rojo de placas antes de limpiar el formulario
  mostrarPlacasEnPantalla(null, null);
  const _panCuerpo = document.getElementById('paneles-busqueda-cuerpo');
  if(_panCuerpo) _panCuerpo.setAttribute('style','display:none; padding:0 20px 14px;');
  const _pbcB = document.getElementById('pbc-body');
  const _pfcB = document.getElementById('pfc-body');
  if(_pbcB) _pbcB.removeAttribute('style');
  if(_pfcB) _pfcB.removeAttribute('style');
  _panelesBusquedaAbiertos = false;
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto(); else limpiarForm();
  const _sbFin = document.querySelector('.status-bar');
  if(_sbFin) _sbFin.removeAttribute('style');
  const _btnFin = document.getElementById('btn-toggle-paneles');
  if(_btnFin) _btnFin.style.removeProperty('display');
  if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
  renderHistorial();
  setStatus('ok','Listo \u2014 formulario limpio con folio #'+folioFormato(appData.folioActual),'ok');
  setTimeout(()=>{
    const rb = document.getElementById('recibo-body');
    if(rb) rb.scrollIntoView({behavior:'smooth', block:'start'});
    else window.scrollTo({top:0, behavior:'smooth'});
  }, 150);
}

// â”€â”€ SERVICIO COMPLEMENTARIO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
costoExtraCount = 0;
function pintarCostosExtra(arr){
  const tbody = document.getElementById('costos-extra-tbody');
  tbody.innerHTML = ''; costoExtraCount = 0;
  // Todos los costos extra ya guardados se consideran impresos -> locked
  (arr||[]).forEach(ce => agregarCostoExtra(Object.assign({}, ce, {locked: true})));
}
function agregarCostoExtra(data){
  costoExtraCount++;
  const id = 'ce'+costoExtraCount;
  const tbody = document.getElementById('costos-extra-tbody');
  const tr = document.createElement('tr'); tr.id = 'costo-extra-row-'+id;
  const isLocked   = !!(data && data.locked);
  const isExisting = !!(data && data.fechaHora);
  const fechaHora  = isExisting ? data.fechaHora : nuevaFechaHoraStr();
  tr.dataset.fechaHora = fechaHora;
  if(isLocked) tr.dataset.locked = '1';

  if(isLocked){
    tr.classList.add('ce-row-locked');
    tr.innerHTML =
        '<td><textarea class="ce-concepto concepto-ta ce-locked-field" rows="1" readonly>'+escHTML((data&&data.concepto)||'')+'</textarea></td>'
      + '<td><textarea class="ce-descripcion concepto-ta ce-locked-field" rows="1" readonly>'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td><input type="text" class="ce-precio price-input ce-locked-field" readonly value="'+escHTML(fmtMXN(parseFloat(data.precio)||0))+'"></td>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:#7a6840;">'+fechaHora+'</td>'
      + '<td></td>';
  } else {
    tr.innerHTML =
        '<td><textarea class="ce-concepto concepto-ta" rows="1" placeholder="Escribe el concepto...">'+escHTML((data&&data.concepto)||'')+'</textarea></td>'
      + '<td><textarea class="ce-descripcion concepto-ta" rows="1" placeholder="Descripci\u00f3n">'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td><input type="text" class="ce-precio price-input" placeholder="0.00" inputmode="decimal" value="'+escHTML(String((data&&data.precio)||''))+'" oninput="formatPrecio(this);recalcularResumenActualizacion()"></td>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:#7a6840;">'+fechaHora+'</td>'
      + '<td><button class="del-concept" onclick="quitarCostoExtra(\''+id+'\')">\u2715</button></td>';
  }
  tbody.appendChild(tr);
  recalcularResumenActualizacion();
}
function quitarCostoExtra(id){
  const r = document.getElementById('costo-extra-row-'+id);
  if(r){ r.remove(); recalcularResumenActualizacion(); }
}
function getCostosExtra(){
  const filas = document.querySelectorAll('#costos-extra-tbody tr');
  return Array.from(filas).map(tr => ({
    concepto:    tr.querySelector('.ce-concepto').value || '',
    descripcion: tr.querySelector('.ce-descripcion').value || '',
    precio:      String(parsePrecio(tr.querySelector('.ce-precio').value)),
    fechaHora:   tr.dataset.fechaHora || '',
    locked:      tr.dataset.locked === '1'
  })).filter(c => c.concepto || parseFloat(c.precio) > 0);
}

// â”€â”€ PAGOS PARCIALES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
pagoParcialCount = 0;

function pintarPagosParciales(arr){
  const tbody = document.getElementById('pagos-parciales-tbody');
  tbody.innerHTML = ''; pagoParcialCount = 0;

  // NO se inyecta fila del anticipo original â€” el saldo pendiente ya refleja
  // los abonos anteriores. Solo se muestran pagos nuevos desde esta sesion.
  const recibo = reciboEnActualizacion;

  (arr||[]).forEach(pp => agregarPagoParcial(Object.assign({}, pp, {locked: true})));
  recalcularResumenActualizacion();
}

function agregarPagoParcial(data){
  pagoParcialCount++;
  const id = 'pp'+pagoParcialCount;
  const tbody = document.getElementById('pagos-parciales-tbody');
  const tr = document.createElement('tr'); tr.id = 'pago-parcial-row-'+id;

  const isLocked   = !!(data && data.locked);
  const isExisting = !!(data && data.fechaHora);
  const fechaHora  = isExisting ? data.fechaHora : nuevaFechaHoraStr();
  const concepto   = (data && data.concepto) || 'Abon\u00f3';
  // Propagar marca de "auth inline" para que al releer no se duplique fecha
  const hasAuthInline = !!(data && data._hasAuthInline);

  tr.dataset.fechaHora = fechaHora;
  if(isLocked) tr.dataset.locked = '1';
  if(hasAuthInline) tr.dataset.hasAuthInline = '1';

  if(isLocked){
    // Fila completamente bloqueada (anticipo original o pagos ya impresos)
    tr.classList.add('pp-row-locked');
    tr.innerHTML =
        '<td><textarea class="pp-concepto concepto-ta pp-concepto-fijo" rows="1" readonly>'+escHTML(concepto)+'</textarea></td>'
      + '<td><textarea class="pp-descripcion concepto-ta pp-locked-field" rows="1" readonly>'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td><input type="text" class="pp-cantidad price-input pp-locked-field" readonly value="'+escHTML(fmtMXN(parseFloat(data.cantidad)||0))+'"></td>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:#7a6840;">'+fechaHora+'</td>'
      + '<td></td>';
  } else {
    // Fila editable normal
    tr.innerHTML =
        '<td><textarea class="pp-concepto concepto-ta pp-concepto-fijo" rows="1" readonly>'+escHTML(concepto)+'</textarea></td>'
      + '<td><textarea class="pp-descripcion concepto-ta" rows="1" placeholder="\u00bfPor qu\u00e9 se hizo este pago?">'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td><input type="text" class="pp-cantidad price-input" placeholder="0.00" inputmode="decimal" value="'+escHTML(String((data&&data.cantidad)||''))+'" oninput="formatPrecio(this);recalcularResumenActualizacion()"></td>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:#7a6840;">'+fechaHora+'</td>'
      + '<td><button class="del-concept" onclick="quitarPagoParcial(\''+id+'\')">\u2715</button></td>';
  }
  tbody.appendChild(tr);
  recalcularResumenActualizacion();
}
function quitarPagoParcial(id){
  const r = document.getElementById('pago-parcial-row-'+id);
  if(r){ r.remove(); recalcularResumenActualizacion(); }
}
function getPagosParciales(){
  const filas = document.querySelectorAll('#pagos-parciales-tbody tr');
  return Array.from(filas).map(tr => ({
    concepto:    tr.querySelector('.pp-concepto').value || 'Abon\u00f3',
    descripcion: tr.querySelector('.pp-descripcion').value || '',
    cantidad:    String(parsePrecio(tr.querySelector('.pp-cantidad').value)),
    fechaHora:   tr.dataset.fechaHora || '',
    locked:      tr.dataset.locked === '1',
    _hasAuthInline: tr.dataset.hasAuthInline === '1'
  })).filter(p => parseFloat(p.cantidad) > 0);
}

function nuevaFechaHoraStr(){
  // Usar hora CDMX sincronizada (cae al local si no hay conexiÃ³n)
  return fechaHoraCDMX_Str();
}

// Devuelve la fecha local en formato ISO (YYYY-MM-DD) sin desfase por zona horaria
function fechaLocalISO(d){
  const x = d || new Date();
  const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,'0');
  const dd = String(x.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+dd;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SINCRONIZACIÃ“N DE HORA CDMX (multi-fuente con fallback)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Mantiene un offset (ms) entre el reloj de la PC y la hora oficial de CDMX.
// ================================================================
// SISTEMA DE HORA â€” Fuente primaria: PC / VerificaciÃ³n: Supabase
// La hora del equipo (PC) es SIEMPRE la fuente de tiempo.
// La verificaciÃ³n remota se usa solo para confirmar que la PC estÃ© bien configurada.
// Si no hay sesiÃ³n o falla â†’ PC sin advertencia.
// Si detecta diferencia > 2 min â†’ badge amarillo (nunca bloquea).
// ================================================================
horaOffsetMs = 0;      // siempre 0: la PC es la fuente, sin ajuste externo
horaSincOK = true;     // siempre true: PC siempre estÃ¡ disponible
horaFuente = 'local';  // 'local' | 'drive-verificado'
horaUltimaSinc = 0;
horaDriveDesviacion = null; // ms de diferencia PC vs Drive (null = sin dato)

function ahoraCDMX(){
  // Siempre usa la hora real del equipo (Date.now()), zona CDMX via Intl
  return new Date(Date.now());
}

// Convierte un Date a hora CDMX usando Intl (maneja DST automÃ¡ticamente)
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
function fechaHoraCDMX_Str(){ return partesHoraCDMX().fechaHora; }

// â”€â”€ VERIFICACIÃ“N DE HORA (antes usaba Drive, ahora usa Supabase) â”€â”€
async function verificarHoraConDrive(){
  // VersiÃ³n Supabase: usa el endpoint de auth para obtener un timestamp del servidor
  if(typeof window.SB === 'undefined' || !window.SB) return null;
  try {
    const tAntes = Date.now();
    // Usamos Promise.race para el timeout â€” evita el error de clonaciÃ³n de AbortSignal
    const fetchPromise = fetch(SUPABASE_URL + '/auth/v1/health', {
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: 'no-store'
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 6000)
    );
    const r = await Promise.race([fetchPromise, timeoutPromise]);
    const tDespues = Date.now();
    const dateHeader = r.headers.get('Date');
    if(!dateHeader) return null;
    const serverMs = Date.parse(dateHeader);
    if(isNaN(serverMs)) return null;
    const latencia = (tDespues - tAntes) / 2;
    const pcMs = tAntes + latencia;
    return serverMs - pcMs;
  } catch(e){ console.warn('VerificaciÃ³n hora Supabase fallÃ³:', e.message); return null; }
}

async function sincronizarHoraCDMX(){
  // La PC es siempre la fuente â€” mostramos su hora inmediatamente
  horaOffsetMs = 0;
  horaSincOK = true;
  horaFuente = 'local';
  horaUltimaSinc = Date.now();
  const partes = partesHoraCDMX();
  setHoraBadge('loading', 'â³ Verificando horaâ€¦ ' + partes.hora);
  iniciarRelojBadge();

  // Verificar en background (no bloquea la UI)
  verificarHoraConDrive().then(desviacionMs => {
    horaDriveDesviacion = desviacionMs;
    const partes2 = partesHoraCDMX();
    if(desviacionMs === null){
      // Sin sesiÃ³n o fallÃ³ â†’ PC sin advertencia, todo OK
      horaFuente = 'local';
      setHoraBadge('ok', 'ðŸ–¥ PC Â· ' + partes2.hora);
      console.log('âœ“ Hora del equipo (sin verificaciÃ³n remota):', partes2.hora);
    } else {
      const diffMin = Math.abs(desviacionMs) / 60000;
      if(diffMin < 2){
        // VerificaciÃ³n confirma que la PC estÃ¡ bien
        horaFuente = 'drive-verificado';
        setHoraBadge('ok', 'ðŸ–¥ PC Â· âœ“ Hora Â· ' + partes2.hora);
        console.log('âœ“ Hora del equipo verificada â€” diferencia:', Math.round(desviacionMs/1000)+'s');
      } else {
        // Diferencia grande: advertir pero NO bloquear
        horaFuente = 'local';
        setHoraBadge('warn', 'âš  PC ' + partes2.hora + ' Â· Hora difiere ' + diffMin.toFixed(1) + 'min');
        console.warn('âš  Diferencia PC vs hora remota:', diffMin.toFixed(1), 'min â€” verifica la hora del equipo');
      }
    }
    iniciarRelojBadge();
  }).catch(()=>{
    // Error inesperado â†’ PC sin problema
    const partes2 = partesHoraCDMX();
    setHoraBadge('ok', 'ðŸ–¥ PC Â· ' + partes2.hora);
    iniciarRelojBadge();
  });

  if(typeof window._aplicarFechaLocal === 'function'){
    try { window._aplicarFechaLocal(new Date()); } catch(e){ registrarError('catch vacio', e); }
  }
  return true;
}

function labelFuente(nom){
  return nom === 'drive-verificado' ? 'PC Â· âœ“ Hora'
       : nom === 'local'            ? 'PC'
       : nom;
}

function setHoraBadge(estado, texto){
  const badge = document.getElementById('hora-badge');
  const icon  = document.getElementById('hora-icon');
  const label = document.getElementById('hora-label');
  if(!badge) return;
  badge.classList.remove('ok','warn','err','loading');
  badge.classList.add(estado);
  if(estado==='ok')        icon.textContent = 'ðŸ–¥';
  else if(estado==='warn') icon.textContent = 'âš ';
  else if(estado==='err')  icon.textContent = 'âœ•';
  else                     icon.textContent = 'â³';
  label.textContent = texto;
}

// Reloj del badge: actualiza cada 30 s
_relojBadgeTimer = null;
function iniciarRelojBadge(){
  if(_relojBadgeTimer) clearInterval(_relojBadgeTimer);
  const tick = () => {
    const partes = partesHoraCDMX();
    const label = document.getElementById('hora-label');
    if(!label) return;
    if(horaDriveDesviacion !== null && Math.abs(horaDriveDesviacion)/60000 >= 2){
      const diffMin = (Math.abs(horaDriveDesviacion)/60000).toFixed(1);
      label.textContent = 'âš  PC ' + partes.hora + ' Â· Hora difiere ' + diffMin + 'min';
    } else if(horaFuente === 'drive-verificado'){
      label.textContent = 'ðŸ–¥ PC Â· âœ“ Hora Â· ' + partes.hora;
    } else {
      label.textContent = 'ðŸ–¥ PC Â· ' + partes.hora;
    }
  };
  tick();
  _relojBadgeTimer = setInterval(tick, 30000);
}

function forzarSincronizacionHora(){
  sincronizarHoraCDMX();
}

// Re-verificar con Drive cada 30 minutos
setInterval(()=>{ sincronizarHoraCDMX(); }, 30*60*1000);

// Iniciar al cargar
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', sincronizarHoraCDMX);
} else {
  sincronizarHoraCDMX();
}

function recalcularResumenActualizacion(){
  if(!reciboEnActualizacion) return;
  const totalOriginal = parseFloat(reciboEnActualizacion.total) || 0;
  const sumaCostosExtra = getCostosExtra().reduce((s,c)=>s+(parseFloat(c.precio)||0), 0);
  const todosLosPagos = getPagosParciales();
  const sumaAbonosNuevos = todosLosPagos
    .filter(p => p.locked !== true)
    .reduce((s,p)=>s+(parseFloat(p.cantidad)||0), 0);

  // El saldo anterior ya refleja todos los pagos previos (anticipo + abonos ya guardados)
  const saldoAnterior = parseFloat(reciboEnActualizacion.saldoPendiente) || 0;
  const totalGeneral = totalOriginal + sumaCostosExtra;
  // El nuevo saldo = saldo anterior + costos extra agregados ahora - abonos nuevos de esta sesion
  const nuevoSaldo = Math.max(0, saldoAnterior + sumaCostosExtra - sumaAbonosNuevos);
  const totalAbonado = totalGeneral - nuevoSaldo;

  const box = document.getElementById('resumen-pagos-parciales');
  box.style.display = '';
  box.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr auto;gap:4px 14px;">'
    + '<span>Total tr\u00e1mite original:</span><span style="text-align:right">$'+fmtMXN(totalOriginal)+'</span>'
    + (sumaCostosExtra > 0
        ? '<span>+ Servicios complementarios:</span><span style="text-align:right;color:#a05010">$'+fmtMXN(sumaCostosExtra)+'</span>'
          + '<span style="font-weight:700;border-top:1px solid #c0dba8;padding-top:4px;">TOTAL ACTUALIZADO:</span>'
          + '<span style="text-align:right;font-weight:700;border-top:1px solid #c0dba8;padding-top:4px;">$'+fmtMXN(totalGeneral)+'</span>'
        : '')
    + '<span style="color:#a05010;">Saldo anterior (resta):</span><span style="text-align:right;color:#a05010;">$'+fmtMXN(saldoAnterior)+'</span>'
    + (sumaAbonosNuevos > 0
        ? '<span style="font-weight:700;color:#2a7a3a;">\u2212 Nuevo abono:</span><span style="text-align:right;font-weight:700;color:#2a7a3a;">$'+fmtMXN(sumaAbonosNuevos)+'</span>'
        : '')
    + '<span style="border-top:1.5px solid #2a7a3a;padding-top:5px;font-weight:700;font-size:0.95rem;">SALDO RESTANTE (RESTA):</span>'
    + '<span style="border-top:1.5px solid #2a7a3a;padding-top:5px;text-align:right;font-weight:700;font-size:1rem;color:'+(nuevoSaldo>0?'#b01010':'#2a7a3a')+'">$'+fmtMXN(nuevoSaldo)+'</span>'
    + '</div>';

  // Sincronizar cuadro dorado derecha
  const totalDisp = document.getElementById('total-display');
  const restaDisp = document.getElementById('resta-display');
  const antInput  = $('anticipo');
  if(totalDisp) totalDisp.textContent = '$'+fmtMXN(totalGeneral);
  if(restaDisp) restaDisp.textContent = '$'+fmtMXN(nuevoSaldo);
  // Actualizar campo anticipo con el total abonado SIN disparar validacion de alerta
  if(antInput){
    antInput.dataset.programmatic = '1';
    antInput.value = fmtMXN(totalAbonado);
    delete antInput.dataset.programmatic;
  }
}

// â”€â”€ IMPRIMIR ACTUALIZACIÃ“N (mismo folio) â”€â”€
async function imprimirActualizacion(){
  // â”€â”€ GUARDIA DE SESIÃ“N â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if(!sbSession || Date.now() >= sbExpiry){
    mostrarDriveOverlay('imprimirActualizacion');
    return;
  }

  // Validaciones rÃ¡pidas antes de pedir confirmaciÃ³n
  if(!reciboEnActualizacion){ showModal('Error','No hay un recibo en actualizaci\u00f3n.'); return; }
  const _costosExtraTmp = getCostosExtra();
  const _pagosTmp       = getPagosParciales();
  const _abonosNuevosTmp = _pagosTmp.filter(p => p.locked !== true);
  if(!_costosExtraTmp.length && !_abonosNuevosTmp.length){
    showModal('Sin cambios','Agrega al menos un servicio complementario o un abono nuevo antes de imprimir.');
    return;
  }

  // Abrir modal de confirmaciÃ³n. Si el usuario acepta, ejecutamos el flujo real.
  abrirConfirmacionRecibo({
    onAceptar: () => { _imprimirActualizacionReal(); }
  });
}

async function _imprimirActualizacionReal(){
  // â”€â”€ GUARDIA DE SESIÃ“N â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if(!sbSession || Date.now() >= sbExpiry){
    mostrarDriveOverlay('imprimirActualizacion');
    return;
  }

  console.log('[ACTUALIZACION] Click en IMPRIMIR ACTUALIZACIÃ“N â€” flujo:', document.body.classList.contains('desde-liquidacion') ? 'PAGO TOTAL' : 'PAGO PARCIAL');
  if(!reciboEnActualizacion){ showModal('Error','No hay un recibo en actualizaci\u00f3n.'); return; }
  const recibo = reciboEnActualizacion;
  const costosExtra = getCostosExtra();
  const pagosParciales = getPagosParciales();
  const abonosNuevos = pagosParciales.filter(p => p.locked !== true);

  if(!costosExtra.length && !abonosNuevos.length){
    showModal('Sin cambios','Agrega al menos un servicio complementario o un abono nuevo antes de imprimir.');
    return;
  }

  // AutorizaciÃ³n ya capturada al iniciar el flujo (Pago Parcial o Pago Total).
  const autorizacion = window._autorizacionActual || null;
  window._autorizacionActual = null; // limpiar para el siguiente uso

  // Modal de placas: SOLO en Pago Total (desde-liquidacion) Y trÃ¡mite vehicular.
  // En Pago Parcial o trÃ¡mite normal se reutilizan placas ya guardadas sin preguntar.
  let _placasCapturadas;
  const esVehicular = (recibo.tipoTramite === 'vehicular');
  if(document.body.classList.contains('desde-liquidacion') && esVehicular){
    const resultado = await pedirDatosPlacas();
    if(resultado === null){
      setStatus('ok','ImpresiÃ³n cancelada â€” modal de placas cerrado','ok');
      return;
    }
    _placasCapturadas = { placas: resultado.placas, estado: resultado.estado };
  } else {
    _placasCapturadas = { placas: recibo.placasEntregadas || null, estado: recibo.estadoPlacas || null };
  }

  setStatus('loading','Generando PDF actualizado...','loading');
  // Re-verificar hora con Drive en background (no bloquea)
  sincronizarHoraCDMX().catch((e)=>{ registrarError('Promise catch vacio', e); });

  const totalOriginal = parseFloat(recibo.total) || 0;
  const anticipoOriginal = parseFloat(recibo.anticipo) || 0;
  const sumaCostosExtra = costosExtra.reduce((s,c)=>s+(parseFloat(c.precio)||0), 0);
  // Usar saldoPendiente como base â€” ya incluye anticipo original y todos los abonos anteriores
  const saldoAnterior = parseFloat(recibo.saldoPendiente) || 0;
  const sumaAbonosNuevos = pagosParciales
    .filter(p => p.locked !== true)
    .reduce((s,p)=>s+(parseFloat(p.cantidad)||0), 0);
  const totalGeneral = totalOriginal + sumaCostosExtra;
  const saldoNuevo = Math.max(0, saldoAnterior + sumaCostosExtra - sumaAbonosNuevos);
  const totalAbonado = totalGeneral - saldoNuevo;

  const fechasImpresion = (recibo.fechasImpresion && recibo.fechasImpresion.length)
    ? recibo.fechasImpresion.slice()
    : [{ fecha: recibo.fecha || recibo.fecha_recibo || '', hora: recibo.hora || recibo.hora_recibo || '', etiqueta: 'Original' }];
  fechasImpresion.push({
    fecha: fechaCDMX_ISO(),
    hora:  horaCDMX_HHMM(),
    etiqueta: 'Actualizaci\u00f3n'
  });

  // Inyectar autorizaciÃ³n en pagos NUEVOS (no bloqueados). Usamos guiones -fecha-
  // para no chocar con los corchetes [fechaHora] que el PDF agrega automÃ¡ticamente.
  const pagosParciales_conAuth = pagosParciales.map(p => {
    if(p.locked) return p; // los ya impresos conservan su auth previa
    const authTag = ' \u2014 Autoriz\u00f3: ' + autorizacion.iniciales + ' -' + autorizacion.fechaHora + '-';
    return Object.assign({}, p, {
      descripcion: (p.descripcion || '') + authTag,
      // Marca para que el PDF NO agregue el corchete [fechaHora] redundante
      _hasAuthInline: true
    });
  });

  const datos = {
    folio: recibo.folio,
    clientes: recibo.clientes || [{nombre:recibo.nombre,movil:'',tel:'',domicilio:''}],
    tramites: recibo.tramites || '',
    clase:recibo.clase, marca:recibo.marca, serie:recibo.serie,
    motor:recibo.motor, anio:recibo.anio, puertas:recibo.puertas,
    color_veh:recibo.color_veh, transmision:recibo.transmision,
    cilindros:recibo.cilindros, placa:recibo.placa,
    ultima_tenencia:recibo.ultima_tenencia, origen:recibo.origen, combustible:recibo.combustible,
    copias: recibo.copias || [],
    tipoTramite: recibo.tipoTramite,
    fecha_recibo: recibo.fecha || recibo.fecha_recibo || '',
    hora_recibo:  recibo.hora || recibo.hora_recibo || '',
    anticipo: String(anticipoOriginal),
    responsable: recibo.responsable || $('responsable').value,
    nombre_cliente_firma: recibo.nombre_cliente_firma || '',
    conceptos: recibo.conceptos || [],
    costosExtra,
    pagosParciales: pagosParciales_conAuth,
    fechasImpresion,
    totalGeneral,
    totalAbonado,
    saldoNuevo,
    placasEntregadas: _placasCapturadas.placas,
    estadoPlacas:     _placasCapturadas.estado,
    autorizacion: autorizacion,
    timestamp: ahoraCDMX().toISOString()
  };

  try {
    const primerNombre = datos.clientes[0].nombre || recibo.nombre;
    const qrTexto = 'LEX-MEXICO|Folio:'+folioFormato(recibo.folio, recibo.anio_folio)+'|'+primerNombre+'|ACTUALIZADO|'+datos.timestamp;
    const qrDataURL = await qrToDataURL(qrTexto);
    const doc = await generarPDF(datos, recibo.folio, qrDataURL);
    const nombreArchivo = 'Recibo_'+folioFormato(recibo.folio, recibo.anio_folio)+'_'+primerNombre.replace(/\s+/g,'_')+'.pdf';

    reemplazarPDFenDrive(doc.output('blob'), nombreArchivo).catch(e=>console.warn('SB update:',e));

    const idx = appData.recibos.findIndex(r=>r.folio===recibo.folio && !r.esComplemento);
    if(idx >= 0){
      // â”€â”€ Snapshot ANTES de mutar â€” historial de versiones â”€â”€â”€â”€â”€â”€â”€â”€â”€
      _guardarSnapshotRecibo(appData.recibos[idx], saldoNuevo<=0 ? 'LiquidaciÃ³n' : 'Abono parcial');
      // Todo lo que acabamos de imprimir queda locked para futuras actualizaciones.
      // CRÃTICO: guardar pagosParciales_conAuth (NO pagosParciales sin auth) para que
      // la autorizaciÃ³n del abono actual permanezca FIJA en prÃ³ximas actualizaciones.
      appData.recibos[idx].costosExtra = costosExtra.map(c => Object.assign({}, c, {locked:true}));
      appData.recibos[idx].pagosParciales = pagosParciales_conAuth.map(p => Object.assign({}, p, {locked:true}));
      appData.recibos[idx].fechasImpresion = fechasImpresion;
      appData.recibos[idx].total = totalGeneral;
      appData.recibos[idx].saldoPendiente = saldoNuevo;
      appData.recibos[idx].saldoNuevo = saldoNuevo;
      appData.recibos[idx].totalAbonado = totalAbonado;
      appData.recibos[idx].pdfBase64 = doc.output('datauristring');
      appData.recibos[idx].archivo = nombreArchivo;
      appData.recibos[idx].placasEntregadas = _placasCapturadas.placas;
      appData.recibos[idx].estadoPlacas     = _placasCapturadas.estado;
    }

    if(!appData.historialPagos) appData.historialPagos = {};
    if(!appData.historialPagos[recibo.folio]) appData.historialPagos[recibo.folio] = [];
    const yaRegistrados = new Set(appData.historialPagos[recibo.folio].map(h=>h.fechaHora||''));
    pagosParciales.forEach(p => {
      if(p.locked) return; // El "DejÃ³ un anticipo" no se duplica en el historial
      if(!yaRegistrados.has(p.fechaHora)){
        appData.historialPagos[recibo.folio].push({
          folio: recibo.folio,
          fecha: p.fechaHora,
          fechaHora: p.fechaHora,
          tipo: saldoNuevo<=0 ? 'LIQUIDADO' : 'PAGO PARCIAL',
          pago: parseFloat(p.cantidad)||0,
          saldoRestante: saldoNuevo
        });
      }
    });

    // â”€â”€ REGISTRAR INGRESO EN CAJA/CONTABILIDAD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if(typeof D !== 'undefined' && Array.isArray(D.movimientos)){
      const montoNuevosAbonos = abonosNuevos.reduce((s,p)=>s+(parseFloat(p.cantidad)||0),0);
      if(montoNuevosAbonos > 0){
        const tipoMov = saldoNuevo<=0 ? 'LiquidaciÃ³n' : 'Abono parcial';
        const mov = {
          id: 'M-REC-' + recibo.folio + '-' + Date.now(),
          folioCaja: '',
          fecha: recibo.fecha_recibo || recibo.fecha || (typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0]),
          hora: recibo.hora_recibo || recibo.hora || (typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5)),
          descripcion: (function(){
            const c0 = recibo.conceptos && recibo.conceptos[0];
            const conc = c0 ? (c0.concepto||'') : '';
            const desc = c0 ? (c0.descripcion||'') : '';
            const txt  = conc + (desc ? ' â€” ' + desc : '');
            return tipoMov + ' Â· Recibo #' + folioFormato(recibo.folio, recibo.anio_folio) + ' Â· ' + (recibo.nombre||'') + (txt ? ' Â· ' + txt : '');
          })(),
          nombre: recibo.nombre || '',
          folio: recibo.folio,
          monto: montoNuevosAbonos,
          tipo: 'ingreso',
          cat: (saldoNuevo<=0 ? 'LiquidaciÃ³n' : 'Abono parcial') + ' Â· #' + folioFormato(recibo.folio, recibo.anio_folio),
          estatus: saldoNuevo<=0 ? 'Liquidado' : 'Abono parcial',
          fuente: 'recibo',
          responsable: typeof empNombre === 'function' ? empNombre() : (recibo.responsable||'')
        };
        _registrarMovimiento(mov);
        if(typeof save === 'function') save();
        if(typeof renderCaja === 'function') renderCaja();
        if(typeof renderContab === 'function') renderContab();
        // Sync inmediato a Supabase (no debounced) para pagos retroactivos
        try { await syncEstadoSupabase(); } catch(e){ syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); }); }
      }
    }

    // â”€â”€ ESCRITURA BLOQUEANTE en Drive antes de imprimir â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    setStatus('loading','Guardando actualizaciÃ³n del folio #'+folioFormato(recibo.folio, recibo.anio_folio)+'...','loading');
    try {
      await actualizarArchivoControl();
    } catch(eCtrl) {
      console.error('âŒ Error guardando actualizaciÃ³n:', eCtrl);
      try { await actualizarArchivoControl(); } catch(e2){ console.error('âŒ Segundo intento fallido:', e2); }
    }
    renderHistorial();

    setStatus('ok','Folio #'+folioFormato(recibo.folio, recibo.anio_folio)+' actualizado e impreso \u2014 puedes seguir agregando','ok');

    const pdfBlob = doc.output('blob');
    lastActualizacionBlob = pdfBlob;
    lastActualizacionNombre = nombreArchivo;

    // El modal de placas ya se mostrÃ³ al inicio de la funciÃ³n. Las placas ya estÃ¡n
    // en `datos` y por tanto incluidas en el PDF generado. Ahora solo abrimos la
    // ventana de impresora.
    console.log('[PLACAS] PDF generado. Abriendo ventana de impresora...');
    imprimirDesdeBlob(pdfBlob, nombreArchivo);

    // â”€â”€â”€ FLUJO SIMPLIFICADO: regreso automÃ¡tico a pÃ¡gina principal â”€â”€â”€
    setTimeout(() => {
      try {
        if(typeof siguienteFolio === 'function'){
          siguienteFolio();
        } else {
          if(typeof cancelarActualizacion === 'function') cancelarActualizacion();
          if(typeof limpiarFormCompleto    === 'function') limpiarFormCompleto();
        }
        const tipoFlujo = (saldoNuevo <= 0) ? 'liquidado completamente' : 'actualizado';
        // Si se liquidÃ³ completamente, eliminar pendiente de placas vinculado
        if (saldoNuevo <= 0) _eliminarPendientePorFolio(recibo.folio);
        setStatus('ok', 'Folio #'+folioFormato(recibo.folio, recibo.anio_folio)+' '+tipoFlujo+' Â· Listo para el siguiente recibo', 'ok');
      } catch(e){
        console.error('[post-imprimir-actualizacion]', e);
      }
    }, 700);
  } catch(e){
    console.error(e);
    setStatus('err','Error al generar PDF actualizado','err');
    showModal('Error','No se pudo generar el PDF: '+e.message);
  }
}

async function ejecutarLiquidacionTotal(){
  if(reciboEnConsulta) auditoriaRegistrar('liquidacion', 'LiquidaciÃ³n total â€” Folio #' + folioFormato(reciboEnConsulta.folio||0));
  if(!reciboEnConsulta){ showModal('Error','No hay un recibo en consulta.'); return; }
  const recibo = reciboEnConsulta;
  const saldo = recibo.saldoPendiente||0;
  if(saldo<=0){ showModal('Sin saldo','Este recibo ya est\u00e1 liquidado.'); return; }
  // Solicitar autorizaciÃ³n ANTES de abrir el modo actualizaciÃ³n
  const auth = await pedirAutorizacion();
  if(auth === null){ setStatus('ok','Pago total cancelado \u2014 autorizaci\u00f3n no proporcionada','ok'); return; }
  window._autorizacionActual = auth;
  // Abrir modo actualizaciÃ³n con el saldo completo prellenado
  abrirModoActualizacion(recibo);
  document.body.classList.add('desde-liquidacion');
  // Agregar automÃ¡ticamente una fila de pago parcial con el saldo total como cantidad
  setTimeout(()=>{
    agregarPagoParcial({
      concepto: 'Liquidaci\u00f3n total',
      descripcion: 'Pago final \u2014 saldo liquidado completamente',
      cantidad: String(saldo),
      locked: false
    });
    recalcularResumenActualizacion();
  }, 150);
}

function cerrarModalCancelacion(){
  document.getElementById('modal-cancelacion').classList.remove('show');
  document.getElementById('cancelacion-motivo').value='';
}

async function ejecutarTramiteCancelado(){
  auditoriaRegistrar('cancelacion', 'Intento de cancelaciÃ³n de recibo');
  if(!reciboEnConsulta){ showModal('Error','No hay un recibo en consulta.'); return; }
  // Primero pedir autorizaciÃ³n, luego motivo de cancelaciÃ³n
  const auth = await pedirAutorizacion();
  if(auth === null){ setStatus('ok','Cancelaci\u00f3n anulada \u2014 autorizaci\u00f3n no proporcionada','ok'); return; }
  window._autorizacionCancelacion = auth;
  // Mostrar modal con campo de motivo
  document.getElementById('cancelacion-motivo').value='';
  document.getElementById('modal-cancelacion').classList.add('show');
  document.getElementById('cancelacion-motivo').focus();
}

async function confirmarCancelacion(){
  const recibo = reciboEnConsulta;
  if(!recibo) return;
  const motivo = document.getElementById('cancelacion-motivo').value.trim();
  document.getElementById('modal-cancelacion').classList.remove('show');
  const auth = window._autorizacionCancelacion || null;

  // Mostrar modal de confirmaciÃ³n general antes de regenerar el PDF.
  abrirConfirmacionRecibo({
    onAceptar: () => { _confirmarCancelacionReal(recibo, motivo, auth); }
  });
}

async function _confirmarCancelacionReal(recibo, motivo, auth){
  window._autorizacionCancelacion = null;

  const folio = folioFormato(recibo.folio, recibo.anio_folio);
  recibo.cancelado = true;
  recibo.fechaCancelacion = new Date().toISOString();
  recibo.motivoCancelacion = (motivo || 'Sin motivo especificado')
    + (auth ? ' \u2014 Autoriz\u00f3: ' + auth.iniciales + ' [' + auth.fechaHora + ']' : '');

  if(!appData.historialPagos) appData.historialPagos = {};
  if(!appData.historialPagos[recibo.folio]) appData.historialPagos[recibo.folio] = [];
  appData.historialPagos[recibo.folio].push({
    folio: recibo.folio,
    fecha: new Date().toLocaleDateString('es-MX'),
    tipo: 'CANCELADO',
    pago: 0,
    saldoRestante: recibo.saldoPendiente || 0
  });
  // Regenerar el PDF con marca de agua CANCELADO, nota y motivo
  try {
    const clientes = recibo.clientes || [{nombre: recibo.nombre, movil:'', tel:'', domicilio:''}];
    const primerNombre = clientes[0].nombre || recibo.nombre;
    const qrTexto = 'LEX-MEXICO|Folio:'+folio+'|'+primerNombre+'|CANCELADO';
    const qrDataURL = await qrToDataURL(qrTexto);
    const datosCancelado = Object.assign({}, recibo, {
      clientes, cancelado: true,
      motivoCancelacion: recibo.motivoCancelacion,
      fechaCancelacion: recibo.fechaCancelacion,
      fecha_recibo: recibo.fecha || recibo.fecha_recibo || '',
      hora_recibo:  recibo.hora  || recibo.hora_recibo  || '',
      anticipo: String(recibo.anticipo || 0),
      conceptos: recibo.conceptos || [],
      responsable: recibo.responsable || '',
      nombre_cliente_firma: recibo.nombre_cliente_firma || ''
    });
    const docCan = await generarPDF(datosCancelado, recibo.folio, qrDataURL);
    const nombreArch = 'Recibo_'+folio+'_'+primerNombre.replace(/\s+/g,'_')+'.pdf';
    recibo.pdfBase64 = docCan.output('datauristring');
    reemplazarPDFenDrive(docCan.output('blob'), nombreArch).catch(e=>console.warn('SB cancel:',e));
  } catch(e){ console.warn('PDF cancelado no regenerado:', e); }
  actualizarArchivoControl().catch(e=>console.warn('Control:',e));
  renderHistorial();
  cerrarConsulta();

  // â”€â”€â”€ REGRESO AUTOMÃTICO A PÃGINA PRINCIPAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setTimeout(() => {
    try {
      if(typeof siguienteFolio === 'function'){
        siguienteFolio();
      } else if(typeof limpiarFormCompleto === 'function'){
        limpiarFormCompleto();
      }
      setStatus('ok', 'Recibo #'+folio+' cancelado Â· Listo para el siguiente recibo', 'ok');
    } catch(e){
      console.error('[post-cancelacion]', e);
    }
  }, 200);

  if(typeof toast === 'function'){
    toast('ðŸš« Recibo #'+folio+' cancelado');
  }
}

lastPdfBlob = null;
lastActualizacionBlob = null;
lastActualizacionNombre = null;
pendingNextFolio = null; // Folio siguiente pendiente â€” se aplica al presionar 'Siguiente Folio'

// â”€â”€ OVERLAY DRIVE-REQUERIDO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Almacena la acciÃ³n que se intentÃ³ ejecutar sin sesiÃ³n Supabase,
// para reintentarla automÃ¡ticamente al conectarse exitosamente.
_pendingActionAfterDrive = null;

function mostrarDriveOverlay(accion){
  _pendingActionAfterDrive = accion || null;
  document.getElementById('drive-required-overlay').classList.add('show');
}

function cerrarDriveOverlay(){
  document.getElementById('drive-required-overlay').classList.remove('show');
  _pendingActionAfterDrive = null;
}

async function conectarDriveDesdeOverlay(){
  // Cambiar texto del botÃ³n mientras conecta
  const btnConnect = document.getElementById('btn-drive-overlay-connect');
  if(btnConnect){ btnConnect.disabled = true; btnConnect.textContent = 'â³ Conectando...'; }

  // Llamar al flujo normal de autenticaciÃ³n
  iniciarDriveAuth();

  // Esperar a que el token aparezca (polling cada 600ms, mÃ¡ximo 60s)
  let espera = 0;
  const MAX_ESPERA = 60000;
  const INTERVALO = 600;
  while(espera < MAX_ESPERA){
    await new Promise(r => setTimeout(r, INTERVALO));
    espera += INTERVALO;
    if(sbSession && Date.now() < sbExpiry){
      // Conectado âœ“ â€” cerrar overlay y reintentar la acciÃ³n pendiente
      cerrarDriveOverlay();
      if(btnConnect){ btnConnect.disabled = false; btnConnect.textContent = 'ðŸ”‘ Iniciar sesiÃ³n en Supabase'; }
      // Reintentar la acciÃ³n que se interrumpiÃ³
      if(_pendingActionAfterDrive){
        const acc = _pendingActionAfterDrive;
        _pendingActionAfterDrive = null;
        if(acc === 'guardarRecibo')          { setTimeout(guardarRecibo, 400); }
        else if(acc === 'imprimirActualizacion') { setTimeout(imprimirActualizacion, 400); }
        else if(acc && acc.startsWith('abrirComplemento_')){
          const folioRef = parseInt(acc.split('_')[1]);
          if(!isNaN(folioRef)) setTimeout(()=>abrirComplemento(folioRef), 400);
        }
      }
      return;
    }
  }
  // Timeout â€” restaurar botÃ³n
  if(btnConnect){ btnConnect.disabled = false; btnConnect.textContent = 'ðŸ”‘ Iniciar sesiÃ³n en Supabase'; }
  setStatus('err','No se pudo conectar. Intenta de nuevo.','err');
}

function congelarFormulario() {
  const _folioAudit = document.getElementById('folio-display')?.textContent || 'â€”';
  const _clienteAudit = document.querySelector('#clientes-wrapper .cliente-row input')?.value || 'â€”';
  auditoriaRegistrar('impresion', 'Recibo impreso â€” Folio #' + _folioAudit + ' â€” Cliente: ' + _clienteAudit);
  document.body.classList.add('recibo-frozen');
  document.getElementById('actions-normal').style.display = 'none';
  document.getElementById('actions-post-print').style.display = 'flex';
  document.getElementById('frozen-banner').style.display = 'block';
  // Deshabilitar todos los checkboxes de documentos para que no puedan volver a seleccionarse
  document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(function(cb) {
    cb.disabled = true;
  });
}

function descongelarFormulario() {
  document.body.classList.remove('recibo-frozen');
  document.getElementById('actions-normal').style.display = 'flex';
  document.getElementById('actions-post-print').style.display = 'none';
  document.getElementById('frozen-banner').style.display = 'none';
  lastPdfBlob = null;
  // Re-habilitar checkboxes al descongelar
  document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(function(cb) {
    cb.disabled = false;
  });
}

function siguienteFolio() {
  // â”€â”€ PASO 1: El folio ya fue incrementado en Drive al imprimir.
  // Solo limpiar pendingNextFolio por si quedÃ³ algÃºn valor residual â”€â”€
  try {
    pendingNextFolio = null;
  } catch(e){ console.warn('[siguienteFolio:folio]', e); }

  // â”€â”€ PASO 2: Si venÃ­amos de modo actualizaciÃ³n, desmontar primero â”€â”€
  // Esto se hace ANTES de limpiar para que limpiarFormCompleto trabaje en un DOM normalizado.
  try {
    const enActualizacion = document.body.classList.contains('modo-actualizacion')
                         || document.body.classList.contains('actualizacion-impresa')
                         || document.body.classList.contains('desde-liquidacion');
    if (enActualizacion && typeof cancelarActualizacion === 'function'){
      cancelarActualizacion();
    }
  } catch(e){ console.warn('[siguienteFolio:cancelarAct]', e); }

  // â”€â”€ PASO 3: Descongelar formulario (quita banner, restaura action panels) â”€â”€
  try {
    if(typeof descongelarFormulario === 'function') descongelarFormulario();
  } catch(e){ console.warn('[siguienteFolio:descongelar]', e); }

  // â”€â”€ PASO 4: LIMPIEZA TOTAL (modo nativo virgen) â”€â”€
  // limpiarFormCompleto ya tiene try/catch internos por paso, asÃ­ que es idempotente y seguro.
  try {
    limpiarFormCompleto();
  } catch(e){ console.error('[siguienteFolio:limpiar]', e); }

  // â”€â”€ PASO 5: Leer folio actual desde Supabase y mostrar â”€â”€
  try {
    if(typeof generarQRPreview === 'function') generarQRPreview();
    // Leer folio_actual directo de Supabase para evitar desfases
    if(window.SB && window.SB_DESPACHO_ID){
      window.SB.from('app_state')
        .select('folio_actual')
        .eq('despacho_id', window.SB_DESPACHO_ID)
        .single()
        .then(function(res){
          if(res.data && res.data.folio_actual){
            appData.folioActual = res.data.folio_actual;
            if(typeof REC !== 'undefined') REC.folioActual = res.data.folio_actual;
          }
          if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
          setStatus('ok', 'Folio #'+folioFormato(appData.folioActual)+' listo â€” formulario en blanco', 'ok');
        }).catch(function(){
          if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
          setStatus('ok', 'Folio #'+folioFormato(appData.folioActual)+' listo â€” formulario en blanco', 'ok');
        });
    } else {
      if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
      setStatus('ok', 'Folio #'+folioFormato(appData.folioActual)+' listo â€” formulario en blanco', 'ok');
    }
  } catch(e){ console.warn('[siguienteFolio:qr]', e); }
}

function reimprimirRecibo() {
  if (!lastPdfBlob) { setStatus('err','No hay recibo disponible para reimprimir','err'); return; }
  imprimirDesdeBlob(lastPdfBlob, nombreArchivo);
}

function imprimirDesdeBlob(blob, nombreArchivo) {
  const pdfUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = pdfUrl;
  a.download = nombreArchivo || 'Recibo.pdf';
  a.target = '_blank';
  // Abrir en nueva pestaÃ±a para ver con opciones de descargar/imprimir
  const win = window.open(pdfUrl, '_blank');
  if (!win) {
    // Fallback: forzar descarga si popup bloqueado
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 30000);
}

// â”€â”€ MODAL DE AUTORIZACIÃ“N (aparece ANTES del modal de placas) â”€â”€
// Devuelve una Promise que resuelve a {iniciales, nombre, fechaHora} si confirma, o null si cancela.
_autorizacionPromiseResolver = null;

// Calcula iniciales con punto a partir del nombre completo. Ej: "Antonieta ChÃ¡vez Montar" â†’ "A.C.M."
// Ignora tÃ­tulos profesionales (Lic., Mtro., Dr., etc.) y conectores (de, del, la, etc.)
function calcularIniciales(nombreCompleto){
  if(!nombreCompleto) return '';
  const conectores = new Set(['de','del','la','las','los','y','el']);
  const titulos    = new Set(['lic','licenciado','licenciada','mtro','mtra','maestro','maestra',
                              'dr','dra','doctor','doctora','ing','ingeniero','ingeniera',
                              'arq','arquitecto','arquitecta','c','sr','sra','srta']);
  const palabras = nombreCompleto.trim().split(/\s+/).filter(w => {
    const lw = w.toLowerCase().replace(/[.,;:]/g,'');
    return w.length > 0 && !conectores.has(lw) && !titulos.has(lw);
  });
  if(!palabras.length) return '';
  return palabras.map(p => p.charAt(0).toUpperCase()).join('.') + '.';
}

// Live preview en el modal mientras el usuario teclea
function calcularInicialesEnVivo(){
  const nombre = $('auth-nombre-completo').value;
  const display = document.getElementById('auth-iniciales-display');
  const iniciales = calcularIniciales(nombre);
  display.textContent = iniciales || 'â€”';
}

function pedirAutorizacion(){
  return new Promise((resolve) => {
    _autorizacionPromiseResolver = resolve;

    const emailActual = (empleadoActual && empleadoActual.email) ? empleadoActual.email.toLowerCase() : '';
    const esAdmin = emailActual === ADMIN_EMAIL.toLowerCase();

    // Timestamp
    const tsPreview = document.getElementById('auth-timestamp-preview');
    const nowStr = new Date().toLocaleString('es-MX', {
      timeZone:'America/Mexico_City',
      weekday:'short', day:'numeric', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
    tsPreview.textContent = '\ud83d\udcc5 Se registrar\u00e1: ' + nowStr.toUpperCase() + ' (CDMX)';
    tsPreview.style.display = 'block';

    if(esAdmin){
      // Admin: mostrar selector de empleados
      const nombreActual = empleadoActual ? empleadoActual.nombre : NOMBRE_TITULAR;
      const opcionesHTML = Object.values(EMPLEADOS).map(nombre =>
        '<option value="' + nombre + '"' + (nombre === nombreActual ? ' selected' : '') + '>' + nombre + '</option>'
      ).join('');

      $('auth-nombre-completo').style.display = 'none';
      document.getElementById('auth-iniciales-display').parentElement.style.display = 'none';

      // Crear selector si no existe
      let sel = document.getElementById('auth-selector-empleado');
      if(!sel){
        sel = document.createElement('select');
        sel.id = 'auth-selector-empleado';
        sel.style.cssText = 'width:100%;padding:9px 11px;border:1.5px solid #d4b870;border-radius:4px;font-family:Outfit,sans-serif;font-size:0.95rem;color:#1a1008;background:#fdfaf4;margin-bottom:12px;';
        $('auth-nombre-completo').parentNode.insertBefore(sel, $('auth-nombre-completo'));
      }
      sel.innerHTML = opcionesHTML;
      sel.style.display = 'block';

      // Ajustar label
      const lbl = document.querySelector('label[for="auth-nombre-completo"]');
      if(lbl) lbl.textContent = 'Empleado que autoriza';

      document.getElementById('auth-error-msg').classList.remove('show');
      document.getElementById('modal-autorizacion').classList.add('show');
    } else {
      // Empleado: usar su propio nombre directamente, sin input manual
      const nombre = empleadoActual ? empleadoActual.nombre : NOMBRE_TITULAR;
      $('auth-nombre-completo').value = nombre;
      $('auth-nombre-completo').style.display = 'none';
      document.getElementById('auth-iniciales-display').parentElement.style.display = 'none';

      // Ocultar selector si existe
      const sel = document.getElementById('auth-selector-empleado');
      if(sel) sel.style.display = 'none';

      // Ajustar subtÃ­tulo
      const sub = document.querySelector('.auth-modal-sub');
      if(sub) sub.innerHTML = 'Autorizas como <strong>' + nombre + '</strong>.<br>Â¿Confirmas esta acciÃ³n?';

      document.getElementById('auth-error-msg').classList.remove('show');
      document.getElementById('modal-autorizacion').classList.add('show');
    }
  });
}

function cerrarModalAutorizacion(){
  document.getElementById('modal-autorizacion').classList.remove('show');
  if(_autorizacionPromiseResolver){
    const r = _autorizacionPromiseResolver;
    _autorizacionPromiseResolver = null;
    r(null); // cancelado
  }
}

function confirmarAutorizacion(){
  const emailActual = (empleadoActual && empleadoActual.email) ? empleadoActual.email.toLowerCase() : '';
  const esAdmin = emailActual === ADMIN_EMAIL.toLowerCase();
  const errBox = document.getElementById('auth-error-msg');

  // Obtener el nombre segÃºn el rol
  let nombreCapturado;
  if(esAdmin){
    const sel = document.getElementById('auth-selector-empleado');
    nombreCapturado = sel ? sel.value.trim() : '';
  } else {
    nombreCapturado = (empleadoActual ? empleadoActual.nombre : NOMBRE_TITULAR).trim();
  }

  if(!nombreCapturado){
    errBox.textContent = 'No se pudo determinar el empleado autorizador.';
    errBox.classList.add('show');
    return;
  }

  errBox.classList.remove('show');

  const iniciales = calcularIniciales(nombreCapturado);
  const fechaHora = new Date().toLocaleString('es-MX', {
    timeZone:'America/Mexico_City',
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit'
  });

  // Restaurar visibilidad original del modal para la prÃ³xima vez
  $('auth-nombre-completo').style.display = '';
  const inicialesRow = document.getElementById('auth-iniciales-display');
  if(inicialesRow && inicialesRow.parentElement) inicialesRow.parentElement.style.display = '';
  const sel = document.getElementById('auth-selector-empleado');
  if(sel) sel.style.display = 'none';
  const sub = document.querySelector('.auth-modal-sub');
  if(sub) sub.innerHTML = 'Para continuar, registra el <strong>nombre completo</strong> del empleado que autoriza este movimiento.<br><em>Las iniciales se calcularÃ¡n automÃ¡ticamente.</em>';

  document.getElementById('modal-autorizacion').classList.remove('show');
  if(_autorizacionPromiseResolver){
    const r = _autorizacionPromiseResolver;
    _autorizacionPromiseResolver = null;
    r({
      iniciales: (iniciales || '?') + '*',
      nombre:    nombreCapturado,
      fechaHora: fechaHora
    });
  }
}

// â”€â”€ MODAL DE CAPTURA DE PLACAS (flujo Pago Total â†’ Imprimir ActualizaciÃ³n) â”€â”€
// Devuelve una Promise que resuelve a {placas, estado} si el empleado confirma,
// o a null si cancela. Pausa el flujo de imprimirActualizacion hasta que el empleado responda.
_placasPromiseResolver = null;

function pedirDatosPlacas(){
  return new Promise((resolve) => {
    _placasPromiseResolver = resolve;
    // Resetear el estado del modal
    $('placas-numero').value = '';
    $('placas-numero').disabled = false;
    $('placas-estado').value = '';
    $('placas-estado').disabled = false;
    $('placas-sin-placas').checked = false;
    $('placas-error-msg').classList.remove('show');
    $('placas-error-msg').textContent = '';
    // Mostrar el modal y enfocar el primer campo
    document.getElementById('modal-placas').classList.add('show');
    setTimeout(()=>$('placas-numero').focus(), 80);
  });
}

function togglePlacasSinPlacasFromRow(ev){
  // Click en la fila (no en el checkbox ni el label, porque ellos tienen stopPropagation)
  const chk = $('placas-sin-placas');
  chk.checked = !chk.checked;
  aplicarEstadoSinPlacas();
}

function aplicarEstadoSinPlacas(){
  const chk = $('placas-sin-placas');
  const inpNum = $('placas-numero');
  const selEst = $('placas-estado');
  if(chk.checked){
    inpNum.value = '';
    selEst.value = '';
    inpNum.disabled = true;
    selEst.disabled = true;
    $('placas-error-msg').classList.remove('show');
  } else {
    inpNum.disabled = false;
    selEst.disabled = false;
    setTimeout(()=>inpNum.focus(), 50);
  }
}

function cerrarModalAnticipo(){
  document.getElementById('modal-anticipo-warn').classList.remove('show');
  // Re-enfocar el campo anticipo para que el usuario corrija
  setTimeout(()=>{ const a=$('anticipo'); if(a){a.focus();a.select();} }, 80);
}

function cerrarModalPlacas(){
  document.getElementById('modal-placas').classList.remove('show');
  if(_placasPromiseResolver){
    const r = _placasPromiseResolver;
    _placasPromiseResolver = null;
    r(null); // null = cancelado
  }
}

function confirmarModalPlacas(){
  const sinPlacas = $('placas-sin-placas').checked;
  const errBox = $('placas-error-msg');
  let placas = '';
  let estado = '';
  if(sinPlacas){
    placas = 'SIN PLACAS';
    estado = 'N/A â€” vehiculo nuevo o trÃ¡mite sin placas';
  } else {
    placas = $('placas-numero').value.trim().toUpperCase();
    estado = $('placas-estado').value;
    // ValidaciÃ³n
    const errores = [];
    if(!placas) errores.push('Ingresa el nÃºmero de placas o marca "Sin placas".');
    if(!estado) errores.push('Selecciona el estado emisor de las placas.');
    if(errores.length){
      errBox.textContent = errores.join(' ');
      errBox.classList.add('show');
      return;
    }
  }
  errBox.classList.remove('show');
  document.getElementById('modal-placas').classList.remove('show');
  if(_placasPromiseResolver){
    const r = _placasPromiseResolver;
    _placasPromiseResolver = null;
    r({ placas: placas, estado: estado });
  }
}

// â”€â”€ VALIDACIÃ“N â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
_guardarForzado = false;
_descripcionVehicular = '';   // nota adicional capturada en modal vehicular

function cerrarModalVehicular(){
  document.getElementById('modal-vehicular').classList.remove('show');
  document.getElementById('vehicular-descripcion').value = '';
}

function confirmarVehicular(){
  _descripcionVehicular = document.getElementById('vehicular-descripcion').value.trim();
  document.getElementById('modal-vehicular').classList.remove('show');
  document.getElementById('vehicular-descripcion').value = '';
  _saltarModalVehicular = true;
  guardarRecibo();
}

function validarAntesDeSalvar(clientes, conceptos, total, anticipo){
  const advertencias = [];
  // Campo tramites eliminado â€” ya no se valida
  if(!conceptos.length || total <= 0)
    advertencias.push('No hay conceptos con precio. Agrega al menos un concepto mayor a $0.');
  if(anticipo > total && total > 0)
    advertencias.push('El anticipo ($'+fmtMXN(anticipo)+') supera el total ($'+fmtMXN(total)+'). Verifica el monto.');
  if(!$('responsable').value.trim())
    advertencias.push('El campo "Responsable del TrÃ¡mite" estÃ¡ vacÃ­o.');
  return advertencias;
}

function cerrarModalValidacion(){ document.getElementById('modal-validacion').classList.remove('show'); _guardarForzado=false; }

function guardarDeTodasFormas(){
  document.getElementById('modal-validacion').classList.remove('show');
  _guardarForzado = true;
  guardarRecibo();
}

// â”€â”€ GUARDAR RECIBO NORMAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
_saltarModalVehicular = false;

// â•â•â• MODAL DE CONFIRMACIÃ“N â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let _confirmacionCallback = null;

function confirmarAntesDeGuardar(){
  if(typeof sbSession === 'undefined' || !sbSession || Date.now() >= sbExpiry){
    if(typeof mostrarDriveOverlay === 'function'){ mostrarDriveOverlay('guardarRecibo'); return; }
  }
  const clientes  = (typeof getClientes  === 'function') ? getClientes()  : [];
  const conceptos = (typeof getConceptos === 'function') ? getConceptos() : [];
  if(!clientes.length || !clientes[0].nombre){
    if(typeof setStatus==='function') setStatus('err','Ingresa el nombre del cliente','err');
    return;
  }
  if(!conceptos.length){
    if(typeof setStatus==='function') setStatus('err','Agrega al menos un concepto','err');
    return;
  }
  abrirConfirmacionRecibo({
    onAceptar: () => { _guardarForzado = true; guardarRecibo(); }
  });
}

function abrirConfirmacionRecibo(opts){
  opts = opts || {};
  _confirmacionCallback = (typeof opts.onAceptar === 'function') ? opts.onAceptar : null;
  document.getElementById('modal-confirmar-recibo').classList.add('show');
}

function confirmarRecibo_Aceptar(){
  document.getElementById('modal-confirmar-recibo').classList.remove('show');
  const cb = _confirmacionCallback;
  _confirmacionCallback = null;
  if(typeof cb === 'function') {
    try { cb(); } catch(e){ console.error('[confirmarRecibo_Aceptar]', e); }
  }
}

function confirmarRecibo_Cancelar(){
  document.getElementById('modal-confirmar-recibo').classList.remove('show');
  _confirmacionCallback = null;
}

// â”€â”€ Eliminar pendiente de placas al liquidar recibo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _eliminarPendientePorFolio(folio) {
  if (typeof D === 'undefined' || !Array.isArray(D.pendientes)) return;
  const idPend = 'PEND-REC-' + folio;
  const idx = D.pendientes.findIndex(p => 
    p.id === idPend || 
    (p.reciboVinculadoFolio === folio && p.seccion === 'placas')
  );
  if (idx >= 0) {
    D.pendientes.splice(idx, 1);
    if (typeof save === 'function') save();
    if (typeof renderPend === 'function') renderPend();
    if (typeof badges === 'function') badges();
    if (typeof syncEstadoSupabaseDebounced === 'function') 
      syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
    console.log('[Auto-pendiente] Pendiente de placas eliminado â€” folio #' + folio);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SELECTOR DE RESPONSABLE â€” solo visible para el administrador
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Retorna true si el usuario actual es administrador
function esAdministrador() {
  if (empleadoActual && empleadoActual.email) {
    return empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }
  return false;
}

// Muestra modal para elegir responsable. 
// Llama callback(nombreElegido) al confirmar.
// Si no es admin, llama callback directamente con empNombre().

// â”€â”€ Helper: registrar movimiento con selecciÃ³n de responsable (admin) â”€â”€
function _regMov(mov) {
  elegirResponsable(function(resp) {
    mov.responsable = resp || empNombre();
    if (!_registrarMovimiento(mov)) return; // dedup bloqueÃ³
    if(typeof renderCaja==='function') renderCaja();
    if(typeof renderContab==='function') renderContab();
    _ultimoSyncPropio = Date.now(); // marcar ANTES de subir
    syncEstadoSupabase().catch(function(e){ console.warn('[_regMov]', e); });
  });
}

function elegirResponsable(callback) {
  if (!esAdministrador()) {
    callback(empNombre());
    return;
  }

  // Construir lista de empleados desde EMPLEADOS (excluir admin primero)
  const lista = Object.entries(EMPLEADOS || {}).map(([email, nombre]) => ({
    email, nombre,
    esAdmin: email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  }));
  // Ordenar: empleados primero, admin al final
  lista.sort((a, b) => a.esAdmin - b.esAdmin);

  // Crear overlay
  const ov = document.createElement('div');
  ov.id = 'resp-selector-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,9,5,0.82);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;';

  const opciones = lista.map((emp, i) => {
    const esDefault = !emp.esAdmin; // primero que no sea admin = default
    return '<label id="resp-opt-'+i+'" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;cursor:pointer;border:1.5px solid '+(esDefault ? 'rgba(200,149,42,0.6)' : 'rgba(200,149,42,0.2)')+';background:'+(esDefault ? 'rgba(200,149,42,0.1)' : 'rgba(200,149,42,0.03)')+';margin-bottom:8px;transition:all 0.15s;" onclick="respSeleccionar('+i+')">'
      + '<input type="radio" name="resp-radio" value="'+emp.nombre+'" '+(esDefault?'checked':'')+' style="accent-color:var(--gold);width:16px;height:16px;flex-shrink:0;">'
      + '<div><div style="font-family:sans-serif;font-size:0.9rem;font-weight:600;color:var(--ink);">'+emp.nombre+'</div>'
      + '<div style="font-family:monospace;font-size:0.58rem;color:var(--muted);">'+emp.email+(emp.esAdmin ? ' Â· Administrador' : ' Â· Empleado')+'</div></div>'
      + '</label>';
  }).join('');

  ov.innerHTML = '<div style="background:var(--surface,#1a1510);border:1.5px solid rgba(200,149,42,0.35);border-radius:14px;padding:22px;width:100%;max-width:420px;box-shadow:0 12px 48px rgba(0,0,0,0.6);">'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid rgba(200,149,42,0.15);">'
    + '<span style="font-size:1.2rem;">ðŸ‘¤</span>'
    + '<div><div style="font-family:serif;font-size:1rem;color:var(--gold-l);font-weight:600;">Â¿QuiÃ©n registra este movimiento?</div>'
    + '<div style="font-family:monospace;font-size:0.6rem;color:var(--muted);margin-top:2px;">Selecciona el responsable que aparecerÃ¡ en contabilidad</div></div>'
    + '</div>'
    + '<div id="resp-opciones">' + opciones + '</div>'
    + '<div style="display:flex;gap:10px;margin-top:16px;">'
    + '<button onclick="respCancelar()" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(200,149,42,0.25);background:none;color:var(--muted);cursor:pointer;font-size:0.85rem;">Cancelar</button>'
    + '<button onclick="respConfirmar()" style="flex:2;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#fff;font-weight:700;cursor:pointer;font-size:0.88rem;">âœ“ Confirmar</button>'
    + '</div></div>';

  document.body.appendChild(ov);

  // Guardar callback en window temporal
  window._respCallback = callback;
  window._respLista    = lista;
}

function respSeleccionar(idx) {
  // Actualizar estilos visuales al seleccionar
  const lista = window._respLista || [];
  lista.forEach((_, i) => {
    const lbl = document.getElementById('resp-opt-'+i);
    if (!lbl) return;
    if (i === idx) {
      lbl.style.borderColor = 'rgba(200,149,42,0.6)';
      lbl.style.background  = 'rgba(200,149,42,0.1)';
      lbl.querySelector('input').checked = true;
    } else {
      lbl.style.borderColor = 'rgba(200,149,42,0.2)';
      lbl.style.background  = 'rgba(200,149,42,0.03)';
    }
  });
}

function respConfirmar() {
  const radio = document.querySelector('input[name="resp-radio"]:checked');
  const nombre = radio ? radio.value : empNombre();
  document.getElementById('resp-selector-ov')?.remove();
  if (typeof window._respCallback === 'function') {
    window._respCallback(nombre);
    window._respCallback = null;
    window._respLista    = null;
  }
}

function respCancelar() {
  document.getElementById('resp-selector-ov')?.remove();
  // Si hay un callback pendiente, llamarlo con null para que el flujo pueda abortar
  if (typeof window._respCallback === 'function') {
    window._respCallback(null);
  }
  window._respCallback = null;
  window._respLista    = null;
}

async function guardarRecibo(){
  // â”€â”€ GUARDIA DE SESIÃ“N: si no hay conexiÃ³n, mostrar panel central â”€â”€
  if(!sbSession || Date.now() >= sbExpiry){
    mostrarDriveOverlay('guardarRecibo');
    return;
  }

  const clientes=getClientes();
  if(!clientes.length||!clientes[0].nombre){ setStatus('err','Ingresa el nombre del cliente','err'); return; }

  // (El modal vehicular antiguo de "descripciÃ³n adicional" fue removido del flujo de creaciÃ³n.
  //  El modal vehicular ahora SOLO aparece en el flujo: Consultar folio â†’ Pago Total â†’
  //  Imprimir ActualizaciÃ³n, para capturar las placas generadas.)

  const conceptos=getConceptos();
  const anticipo=parsePrecio($('anticipo').value);
  const total=conceptos.reduce((s,c)=>s+(parseFloat(c.precio)||0),0);

  // Validar si no se forzÃ³
  if(!_guardarForzado){
    const advertencias = validarAntesDeSalvar(clientes, conceptos, total, anticipo);
    if(advertencias.length){
      const ul = document.getElementById('validacion-lista');
      ul.innerHTML = advertencias.map(a=>'<li>'+a+'</li>').join('');
      document.getElementById('modal-validacion').classList.add('show');
      return;
    }
  }
  _guardarForzado = false;
  const btn=document.getElementById('btn-guardar');
  btn.disabled=true; setStatus('loading','Preparando...','loading');
  // Re-verificar hora con Drive en background (no bloquea)
  sincronizarHoraCDMX().catch((e)=>{ registrarError('Promise catch vacio', e); });
  // Actualizar hora al momento exacto de imprimir â€” SOLO si NO estamos en modo retroactivo
  const horaAhora = horaCDMX_HHMM();
  const fechaAhora = fechaCDMX_ISO();
  if (!window._reciboRetroactivoActivo && !window._capturaMesActivo) {
    $('hora_recibo').value = horaAhora;
    document.getElementById('hora_recibo_display').textContent = horaAhora + ' hrs.';
    $('fecha_recibo').value = fechaAhora;
  } else if (window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada) {
    // Modo retroactivo â€” blindar los campos con la fecha elegida
    $('fecha_recibo').value = window._reciboRetroactivoFechaPersonalizada;
    $('hora_recibo').value  = window._reciboRetroactivoHoraPersonalizada || horaAhora;
    document.getElementById('hora_recibo_display').textContent = ($('hora_recibo').value) + ' hrs.';
  } else if (window._capturaMesActivo) {
    // Modo captura retroactiva de mes â€” usar fecha del mes
    var _fm = window._capturaFechaManual || (window._capturaMesActivo.anio+'-'+window._capturaMesActivo.mesNum+'-01');
    var _hm = window._capturaHoraManual || horaAhora;
    $('fecha_recibo').value = _fm;
    $('hora_recibo').value  = _hm;
    document.getElementById('hora_recibo_display').textContent = _hm + ' hrs.';
  } else {
    $('hora_recibo').value = horaAhora;
    document.getElementById('hora_recibo_display').textContent = horaAhora + ' hrs.';
    $('fecha_recibo').value = fechaAhora;
  }

  // â”€â”€ RESERVAR FOLIO ATÃ“MICO â€” lee Drive en este instante y lo incrementa â”€â”€
  // Esto garantiza que aunque Antonieta y el Lic. estÃ©n trabajando al mismo tiempo,
  // cada quien obtiene un nÃºmero diferente: el primero en imprimir toma el N,
  // el segundo automÃ¡ticamente obtiene el N+1.
  setStatus('loading','Reservando folio Ãºnico...','loading');
  const folio = await reservarFolioEnDrive();
  // Actualizar el display con el folio reservado (formato 26-0001)
  $('folio-display').textContent = folioFormato(folio);

  const primerNombre=clientes[0].nombre;
  const saldoPendiente=Math.max(0,total-anticipo);

  // Folio anterior: si es comprobante de abono usar _folioReferencia, si no el campo manual
  const folioAntNum = window._folioReferencia || parseInt($('folio_anterior').value)||null;
  const historialPagosRef = folioAntNum ? obtenerHistorialPagosAbono(folioAntNum) : [];

  const datos={
    folio,clientes,
    tramites:document.getElementById('tramites').value,
    clase:document.getElementById('clase').value,
    marca:document.getElementById('marca').value,
    serie:document.getElementById('serie').value,
    motor:document.getElementById('motor').value,
    anio:document.getElementById('anio').value,
    puertas:document.getElementById('puertas').value,
    color_veh:document.getElementById('color_veh').value,
    transmision:document.getElementById('transmision').value,
    cilindros:document.getElementById('cilindros').value,
    placa:document.getElementById('placa').value,
    ultima_tenencia:document.getElementById('ultima_tenencia').value,
    origen:document.getElementById('origen').value,
    combustible:document.getElementById('combustible').value,
    copias:getDocumentosSeleccionados(),
    tipoTramite,
    fecha_recibo:$('fecha_recibo').value,
    hora_recibo:$('hora_recibo').value,
    anticipo:String(parsePrecio($('anticipo').value)),
    responsable:window._respSeleccionado || $('responsable').value || empNombre(),
    nombre_cliente_firma:$('nombre_cliente_firma').value,
    conceptos, timestamp:ahoraCDMX().toISOString(),
    folioAnterior: folioAntNum,
    historialPagosRef,
    totalGeneral: total,
    totalAbonado: anticipo,
    saldoNuevo: Math.max(0, total - anticipo),
    descripcionVehicular: tipoTramite === 'vehicular' ? _descripcionVehicular : ''
  };

  // â”€â”€ Seleccionar responsable (solo admin ve el modal) â”€â”€
  const respSelec = await new Promise(function(resolve){
    elegirResponsable(function(nombre){ resolve(nombre); });
  });
  if (!respSelec) {
    // Usuario cancelÃ³ el modal â€” abortar guardado y rehabilitar botÃ³n
    const btnAbort = document.getElementById('btn-guardar');
    if (btnAbort) btnAbort.disabled = false;
    setStatus('ok', 'Guardado cancelado', 'ok');
    return;
  }
  window._respSeleccionado = respSelec;

  try {
    const qrTexto='LEX-MEXICO|Folio:'+folioFormato(folio)+'|'+primerNombre+'|'+datos.fecha_recibo+' '+datos.hora_recibo;
    const qrDataURL=await qrToDataURL(qrTexto);
    const doc=await generarPDF(datos,folio,qrDataURL);
    const nombreArchivo='Recibo_'+folioFormato(folio)+'_'+primerNombre.replace(/\s+/g,'_')+'.pdf';

    setStatus('loading','Generando PDF Â· Folio #'+folioFormato(folio)+'...','loading');
    // Subir PDF a Supabase Storage
    subirPDFaDrive(doc.output('blob'), nombreArchivo).catch(e=>console.warn('SB upload:',e));
    guardarEnDirectorio(datos).catch(e=>console.warn('Directorio:',e));

    // â”€â”€ Guardar TODOS los campos necesarios para restaurar el formulario en modo actualizaciÃ³n â”€â”€
    const copiasParsed = (()=>{
      try{ const p=JSON.parse(datos.copias||'{}'); return p.docs||[]; }catch(e){ return []; }
    })();

    // â”€â”€ CRÃTICO: insertar el recibo en appData PRIMERO, luego escribir en Drive de forma BLOQUEANTE â”€â”€
    // Esto corrige el bug donde dos impresiones seguidas (ej. folio 102 y 103) hacen que
    // la segunda escritura sobreescriba la primera porque la fusiÃ³n de recibos en Drive
    // no tenÃ­a el recibo #102 todavÃ­a (actualizarArchivoControl se llamaba con .catch sin await).
    appData.recibos.unshift({
      folio, anio_folio: appData.anioFolioActual || new Date().getFullYear(),
      nombre:primerNombre, fecha:datos.fecha_recibo, hora:datos.hora_recibo,
      archivo:nombreArchivo, saldoPendiente, pdfBase64:doc.output('datauristring'),
      folioAnterior: folioAntNum,
      anticipo: String(anticipo),
      totalAbonado: anticipo,
      saldoNuevo: saldoPendiente,
      conceptos: conceptos,
      total: total,
      generadoPor: window._respSeleccionado || (empleadoActual ? empleadoActual.nombre : NOMBRE_TITULAR),
      // Datos completos del recibo para restaurar en modo actualizaciÃ³n
      clientes: datos.clientes,
      tipoTramite: datos.tipoTramite,
      tipo_doc: document.getElementById('tipo_doc').value,
      copias: copiasParsed,
      tramites: datos.tramites,
      clase: datos.clase, marca: datos.marca, serie: datos.serie,
      motor: datos.motor, anio: datos.anio, puertas: datos.puertas,
      color_veh: datos.color_veh, transmision: datos.transmision,
      cilindros: datos.cilindros, placa: datos.placa,
      ultima_tenencia: datos.ultima_tenencia,
      origen: datos.origen, combustible: datos.combustible,
      responsable: datos.responsable,
      nombre_cliente_firma: datos.nombre_cliente_firma,
      fecha_recibo: datos.fecha_recibo,
      hora_recibo: datos.hora_recibo
    });

    // â”€â”€ ESCRITURA BLOQUEANTE: esperar confirmaciÃ³n de Drive antes de continuar â”€â”€
    // Sin este await, una segunda impresiÃ³n inmediata podrÃ­a leer el JSON antes de que
    // esta escritura termine y sobrescribir borrando este recibo del historial.
    setStatus('loading','Guardando recibo #'+folioFormato(folio)+'...','loading');
    try {
      await actualizarArchivoControl();
    } catch(eControl) {
      console.error('âŒ Error crÃ­tico al guardar:', eControl);
      // Reintentar una vez mÃ¡s antes de continuar
      try { await actualizarArchivoControl(); } catch(e2){ console.error('âŒ Segundo intento fallido:', e2); }
    }

    // El folio ya fue reservado e incrementado en Drive al inicio de guardarRecibo().
    pendingNextFolio = null;

    // Si es comprobante de abono: actualizar saldo del recibo original
    if(folioAntNum){
      const idxOrig = appData.recibos.findIndex(r=>r.folio===folioAntNum);
      if(idxOrig>=0){
        const recOrig = appData.recibos[idxOrig];
        const nuevoAbonado = (parseFloat(recOrig.totalAbonado)||0) + anticipo;
        const nuevoSaldo   = Math.max(0,(parseFloat(recOrig.total)||0) - nuevoAbonado);
        appData.recibos[idxOrig].totalAbonado  = nuevoAbonado;
        appData.recibos[idxOrig].saldoPendiente= nuevoSaldo;
        appData.recibos[idxOrig].saldoNuevo    = nuevoSaldo;
        if(nuevoSaldo<=0) appData.recibos[idxOrig].liquidado = true;
      }
      // Limpiar referencia
      window._folioReferencia   = null;
      window._reciboOriginalRef = null;
      const banner = document.getElementById('abono-ref-banner');
      if(banner) banner.style.display='none';
    }

    // Mostrar el folio del recibo impreso (no el siguiente)
    $('folio-display').textContent = folioFormato(folio);
    setStatus('ok','Recibo #'+folioFormato(folio)+' guardado â€” abriendo impresora...','ok');

    // Guardar blob para reimprimir sin cambiar folio
    lastPdfBlob = new Blob([doc.output('arraybuffer')], {type:'application/pdf'});

    // Abrir nueva pestaÃ±a con el PDF para que el empleado configure la impresora
    imprimirDesdeBlob(lastPdfBlob, nombreArchivo);

    // â”€â”€â”€ OFERTA AUTOMÃTICA DE EXPEDIENTE â€” solo en recibos originales (no abonos) â”€â”€
    if(!folioAntNum){
      const expNums = (appData.recibos||[])
        .map(r => r.expedienteNum).filter(Boolean)
        .map(n => parseInt((n||'').replace('ARCH-','')) || 0);
      const siguienteExp = (expNums.length > 0 ? Math.max(...expNums) : 0) + 1;
      const expSugerido = 'ARCH-' + String(siguienteExp).padStart(5,'0');
      setTimeout(() => abrirModalExpediente(folio, expSugerido, primerNombre), 1200);
    }

    // â”€â”€â”€ FLUJO POST-IMPRESIÃ“N: limpiar, sincronizar y volver al panel principal â”€â”€â”€
    // Capturamos los valores necesarios ANTES de que el formulario se limpie (evita "datos is not defined")
    const _folioGuardado  = folio;
    const _anticoGuardado = anticipo;
    const _nombreGuardado = primerNombre;
    const _concepto0      = conceptos && conceptos[0] ? (conceptos[0].concepto||'') : '';

    setTimeout(() => {
      try {
        // 1. Limpiar formulario y volver a estado virgen
        if(typeof siguienteFolio === 'function'){
          siguienteFolio();
        } else {
          if(typeof descongelarFormulario === 'function') descongelarFormulario();
          if(typeof limpiarFormCompleto    === 'function') limpiarFormCompleto();
        }

        // 2. Registrar anticipo en contabilidad (evitar duplicado con guard de ID)
        if(typeof D !== 'undefined' && Array.isArray(D.movimientos) && _anticoGuardado > 0){
          const idMov = 'M-REC-' + _folioGuardado;
          if(!D.movimientos.some(m => m.id === idMov)){
            const mov = {
              id: idMov,
              folioCaja: '',
              fecha: typeof hoy  === 'function' ? hoy()  : new Date().toISOString().split('T')[0],
              hora:  typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5),
              descripcion: (function(){
                const c0 = conceptos && conceptos[0];
                const conc = c0 ? (c0.concepto||'') : '';
                const desc = c0 ? (c0.descripcion||'') : '';
                const txt  = conc + (desc ? ' â€” ' + desc : '');
                return 'Recibo #' + folioFormato(_folioGuardado) + ' Â· ' + _nombreGuardado + (txt ? ' Â· ' + txt : '');
              })(),
              nombre: _nombreGuardado,
              folio:  _folioGuardado,
              monto:  _anticoGuardado,
              tipo:   'ingreso',
              cat:    'Anticipo Â· #' + folioFormato(_folioGuardado),
              estatus:'Anticipo',
              fuente: 'recibo',
              responsable: window._respSeleccionado || empNombre()
            };
            if(typeof _registrarMovimiento === 'function') _registrarMovimiento(mov);
          }
        }

        // 3. Crear pendiente de placas automÃ¡ticamente si es trÃ¡mite vehicular
        if(typeof D !== 'undefined' && Array.isArray(D.pendientes) && tipoTramite === 'vehicular'){
          try {
            // Detectar tipo de trÃ¡mite vehicular desde el primer concepto
            const concepto0 = (_concepto0 || '').toLowerCase();
            let tipoVeh = 'alta';
            if (concepto0.includes('reemplac'))               tipoVeh = 'reemplacamiento';
            else if (concepto0.includes('baja'))              tipoVeh = 'baja';
            else if (concepto0.includes('cambio') || concepto0.includes('propiet')) tipoVeh = 'cambio_propietario';
            else if (concepto0.includes('tarjeta') || concepto0.includes('circulac')) tipoVeh = 'tarjeta_circulacion';

            const tipoLbl = {
              'alta':'Alta de placas','baja':'Baja de placas',
              'cambio_propietario':'Cambio de propietario',
              'tarjeta_circulacion':'Tarjeta de circulaciÃ³n',
              'reemplacamiento':'Reemplacamiento'
            }[tipoVeh] || 'TrÃ¡mite vehicular';

            // Datos del vehÃ­culo desde el formulario (ya guardados en appData.recibos[0])
            const recGuardado = appData.recibos[0] || {};
            const placaNum  = recGuardado.placa  || '';
            const estadoRec = recGuardado.origen || '';
            const marcaRec  = recGuardado.marca  || '';
            const claseRec  = recGuardado.clase  || '';

            // DescripciÃ³n del pendiente â€” usar Concepto + DescripciÃ³n del recibo como tÃ­tulo
            const _desc0    = conceptos && conceptos[0] ? (conceptos[0].descripcion||'') : '';
            const concDesc  = [_concepto0, _desc0].filter(Boolean).join(' â€” ');
            const textoPend = concDesc || (tipoLbl + ' â€” ' + _nombreGuardado + (placaNum ? ' ('+placaNum+')' : ''));
            const descPend  = concDesc || tipoLbl;

            // Evitar duplicado: no crear si ya existe pendiente no resuelto con mismo folio
            const idPend = 'PEND-REC-' + _folioGuardado;
            const yaExiste = D.pendientes.some(p => p.id === idPend);

            if (!yaExiste && _saldoInicial > 0) {
              const nuevoPend = {
                id: idPend,
                texto: textoPend,
                persona: _nombreGuardado,
                categoria: 'Placas',
                seccion: 'placas',
                prioridad: 'normal',
                resp: typeof empNombre === 'function' ? empNombre() : '',
                obs: '',
                fechaLimite: '',
                carpeta: '',
                resuelto: false,
                fechaCreacion: typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0],
                fechaResolucion: '',
                // Datos vehiculares
                placasEstado: estadoRec,
                placasNumero: placaNum,
                tipoVehicular: tipoVeh,
                descripcionPlacas: descPend,
                // VinculaciÃ³n con recibo
                reciboVinculadoFolio: _folioGuardado,
                // Datos extra del vehÃ­culo para mostrar en el header del pendiente
                vehMarca: marcaRec,
                vehClase: claseRec,
                marca: marcaRec,
                clase: claseRec,
                documentos: []
              };
              D.pendientes.unshift(nuevoPend);
              console.log('[Auto-pendiente] Creado pendiente de placas para recibo #' + _folioGuardado);
            }
          } catch(ePend) {
            console.warn('[Auto-pendiente]', ePend);
          }
        }

        // 3. Persistir todo el estado
        if(typeof save === 'function') try { save(); } catch(e){ registrarError('catch vacio', e); }

        // 4. Refrescar TODOS los paneles en cascada
        if(typeof renderHistorial      === 'function') try { renderHistorial();      } catch(e){ registrarError('catch vacio', e); }
        if(typeof renderCaja           === 'function') safeExec('renderCaja', () => renderCaja());
        if(typeof renderContab         === 'function') try { renderContab();         } catch(e){ registrarError('catch vacio', e); }
        if(typeof renderDir            === 'function') try { renderDir();            } catch(e){ registrarError('catch vacio', e); }
        if(typeof renderPend           === 'function') safeExec('renderPend', () => renderPend());
        if(typeof renderCarp           === 'function') try { renderCarp();           } catch(e){ registrarError('catch vacio', e); }
        if(typeof badges               === 'function') try { badges();               } catch(e){ registrarError('catch vacio', e); }
        if(typeof actualizarFolioDisplay === 'function') try { actualizarFolioDisplay(); } catch(e){ registrarError('catch vacio', e); }

        // 5. Sincronizar con Supabase en background
        try { syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); }); } catch(e){ registrarError('catch vacio', e); }

        setStatus('ok', 'Recibo #' + folioFormato(_folioGuardado) + ' guardado Â· Listo para el siguiente recibo', 'ok');
      } catch(ePost){
        console.error('[post-imprimir]', ePost);
        setStatus('ok', 'Recibo #' + folioFormato(_folioGuardado) + ' guardado', 'ok');
      }
    }, 700);

  } catch(e){ setStatus('err','Error: '+e.message,'err'); console.error(e); }
  btn.disabled=false;
}

// â”€â”€ HISTORIAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
historialFiltroActivo = 'todos';

function setFiltroHistorial(filtro){
  historialFiltroActivo = filtro;
  ['todos','pendiente','pagado','cancelado'].forEach(f=>{
    document.getElementById('filtro-'+f).classList.toggle('activo', f===filtro);
  });
  filtrarHistorial();
}

// â”€â”€ HISTORIAL DE VERSIONES DE RECIBOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Guarda un snapshot completo del recibo ANTES de cualquier mutaciÃ³n.
// Se llama desde: actualizarRecibo, complemento de pago, liquidaciÃ³n.
function _guardarSnapshotRecibo(recibo, motivo){
  try{
    if(!recibo || recibo.folio==null) return;
    if(!appData.historialVersiones) appData.historialVersiones = {};
    if(!appData.historialVersiones[recibo.folio]) appData.historialVersiones[recibo.folio] = [];
    const quien = (typeof empleadoActual!=='undefined' && empleadoActual && empleadoActual.nombre)
      ? empleadoActual.nombre
      : (typeof NOMBRE_TITULAR!=='undefined' ? NOMBRE_TITULAR : 'â€”');
    appData.historialVersiones[recibo.folio].push({
      fecha: typeof hoy==='function' ? hoy() : new Date().toISOString().split('T')[0],
      hora:  typeof hora==='function' ? hora() : new Date().toTimeString().slice(0,5),
      quien,
      motivo: motivo || 'ModificaciÃ³n',
      snapshot: structuredClone(recibo)
    });
  } catch(e){ console.warn('[snapshot]',e); }
}

// Abre el modal con el historial de versiones de un folio
function verHistorialVersiones(folio){
  const versiones = (appData.historialVersiones||{})[folio] || [];
  const recibo    = (appData.recibos||[]).find(r=>r.folio===folio && !r.esComplemento);
  const el = document.getElementById('modal-versiones');
  const body = document.getElementById('modal-versiones-body');
  if(!el || !body) return;
  document.getElementById('modal-versiones-folio').textContent = 'Folio #'+folioFormato(folio);
  if(!versiones.length){
    body.innerHTML='<p style="color:var(--muted);font-size:0.8rem;text-align:center;padding:20px;">Sin versiones anteriores registradas para este folio.</p>';
  } else {
    // Mostrar de mÃ¡s reciente a mÃ¡s antigua
    const lista = [...versiones].reverse();
    body.innerHTML = lista.map((v,i)=>{
      const snap = v.snapshot;
      const saldo = snap.saldoPendiente!=null ? snap.saldoPendiente : 'â€”';
      const total = snap.total != null ? snap.total : (snap.totalGeneral||'â€”');
      const abonado = snap.totalAbonado!=null ? snap.totalAbonado : (parseFloat(snap.anticipo)||0);
      return `<div style="border:1px solid var(--border-light);border-radius:6px;padding:12px 14px;margin-bottom:10px;background:var(--field-bg);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-family:'DM Mono',monospace;font-size:0.72rem;font-weight:700;color:var(--gold-d);">VersiÃ³n ${lista.length-i}</span>
          <span style="font-size:0.7rem;color:var(--muted);">${v.fecha} ${v.hora} Â· ${v.quien}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--ink);margin-bottom:6px;"><strong>Motivo:</strong> ${v.motivo}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-family:'DM Mono',monospace;font-size:0.72rem;">
          <div style="background:#f5f0e8;border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.65rem;">TOTAL</span>$${typeof fmtMXN==='function'?fmtMXN(total):total}</div>
          <div style="background:#eaf4ea;border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.65rem;">ABONADO</span>$${typeof fmtMXN==='function'?fmtMXN(abonado):abonado}</div>
          <div style="background:${saldo>0?'#fff4e0':'#eafaea'};border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.65rem;">SALDO</span>$${typeof fmtMXN==='function'?fmtMXN(saldo):saldo}</div>
        </div>
        ${snap.pagosParciales&&snap.pagosParciales.length?`<div style="margin-top:8px;font-size:0.7rem;color:var(--muted);">Abonos registrados: ${snap.pagosParciales.length}</div>`:''}
        <div style="margin-top:10px;display:flex;gap:8px;">
          <button onclick="descargarSnapshotPDF(${folio},${versiones.length-1-i})"
            style="font-size:0.7rem;padding:5px 12px;border-radius:4px;border:1px solid var(--border-light);background:transparent;cursor:pointer;color:var(--ink);">
            ðŸ“„ Ver PDF de esta versiÃ³n
          </button>
          <button onclick="restaurarVersionRecibo(${folio},${versiones.length-1-i})"
            style="font-size:0.7rem;padding:5px 12px;border-radius:4px;border:1.5px solid #c07a10;background:#fff8ed;cursor:pointer;color:#7a4a00;font-weight:600;">
            â†© Restaurar esta versiÃ³n
          </button>
        </div>
      </div>`;
    }).join('');
  }
  el.classList.add('show');
}

// Descarga el PDF guardado en el snapshot (si existe)
function descargarSnapshotPDF(folio, idx){
  const versiones = (appData.historialVersiones||{})[folio] || [];
  const v = versiones[idx];
  if(!v || !v.snapshot || !v.snapshot.pdfBase64){
    showModal('Sin PDF','Esta versiÃ³n no tiene PDF guardado (es anterior a la implementaciÃ³n del historial).'); return;
  }
  const a = document.createElement('a');
  a.href = v.snapshot.pdfBase64;
  a.download = 'Recibo_'+folioFormato(folio)+'_version'+String(idx+1)+'.pdf';
  a.click();
}

// Restaura el recibo al estado del snapshot seleccionado
function restaurarVersionRecibo(folio, idx){
  const versiones = (appData.historialVersiones||{})[folio] || [];
  const v = versiones[idx];
  if(!v){ showModal('Error','VersiÃ³n no encontrada.'); return; }
  if(!confirm('Â¿Confirmas restaurar el Folio #'+folioFormato(folio)+' al estado del '+v.fecha+' '+v.hora+'?\n\nEsto reemplazarÃ¡ los datos actuales del recibo. El historial de versiones se conserva.')){return;}
  const recIdx = (appData.recibos||[]).findIndex(r=>r.folio===folio && !r.esComplemento);
  if(recIdx<0){ showModal('Error','Recibo no encontrado.'); return; }
  // Guardar snapshot del estado actual antes de restaurar
  _guardarSnapshotRecibo(appData.recibos[recIdx], 'Antes de restaurar versiÃ³n '+String(idx+1));
  // Restaurar
  const campos = ['costosExtra','pagosParciales','fechasImpresion','total','saldoPendiente','pdfBase64','archivo','placasEntregadas','estadoPlacas','totalAbonado','anticipo','cancelado'];
  campos.forEach(c=>{ if(v.snapshot[c]!==undefined) appData.recibos[recIdx][c]=structuredClone(v.snapshot[c]); });
  if(typeof save==='function') save();
  if(typeof renderHistorial==='function') renderHistorial();
  if(typeof renderCaja==='function') renderCaja();
  document.getElementById('modal-versiones').classList.remove('show');
  showModal('VersiÃ³n restaurada','El Folio #'+folioFormato(folio)+' fue restaurado al estado del '+v.fecha+' a las '+v.hora+'. El historial de versiones se conserva completo.');
}

function filtrarHistorial(){
  const q = (document.getElementById('hist-buscar')?.value||'').toLowerCase().trim();
  const filtro = historialFiltroActivo;
  const lista = appData.recibos.filter((r,i)=>{
    // Filtro por estado
    if(filtro==='cancelado' && !r.cancelado) return false;
    if(filtro==='pendiente' && (r.cancelado || !(r.saldoPendiente>0))) return false;
    if(filtro==='pagado'    && (r.cancelado || r.saldoPendiente>0)) return false;
    // Filtro por texto
    if(q){
      const folioStr = folioFormato(r.folio, r.anio_folio);
      const nombre   = (r.nombre||'').toLowerCase();
      // Buscar en telÃ©fonos de todos los clientes del recibo
      const telefonos = (r.clientes||[]).map(c=>(c.telefono||'').toLowerCase()).join(' ');
      if(!folioStr.includes(q) && !nombre.includes(q) && !telefonos.includes(q)) return false;
    }
    return true;
  });
  const list = document.getElementById('historial-list');
  // Contador muestra filtrados / total
  const total = appData.recibos.length;
  document.getElementById('hist-count').textContent =
    (lista.length < total ? lista.length+' / ' : '') + total + ' recibos';
  if(!lista.length){
    list.innerHTML='<div class="empty-hist">'+(total?'Sin resultados para la bÃºsqueda':'AÃºn no hay recibos generados')+'</div>';
    return;
  }
  list.innerHTML = lista.map(r=>{
    const i = appData.recibos.indexOf(r);
    const folioStr='#'+folioFormato(r.folio, r.anio_folio);
    const compTag=r.esComplemento?'<span style="color:#b07f1e;font-size:0.58rem;margin-left:3px">â†³ ref #'+folioFormato(r.folioRef)+'</span>':'';
    const cancelTag=r.cancelado?'<span style="color:#8a1a1a;font-size:0.58rem;margin-left:5px;background:#fff0f0;border:1px solid #c04040;border-radius:3px;padding:1px 5px;font-family:DM Mono,monospace;letter-spacing:0.06em;">ðŸš« CANCELADO</span>':'';
    const saldoColor=r.saldoPendiente>0?'#b01010':'#2a7a3a';
    const saldoTag=(!r.cancelado && r.saldoPendiente!==undefined)
      ?'<span style="color:'+saldoColor+';font-family:DM Mono,monospace;font-size:0.65rem;margin-left:6px">$'+r.saldoPendiente.toFixed(2)+'</span>':'';
    const btnPago=(!r.cancelado && !r.esComplemento && r.saldoPendiente>0)
      ?'<button class="download-btn" style="color:#9a6e18;border-color:#c8952a" onclick="abrirComplemento('+r.folio+')">ï¼‹ Pago</button>':'';
    return '<div class="historial-item"'+(r.cancelado?' style="opacity:0.65;"':'')+' >'
      +'<span class="folio-num">'+folioStr+'</span>'+compTag+cancelTag
      +'<span class="client-name">'+escHTML(r.nombre||'')+'</span>'
      +'<span class="fecha-item">'+(r.fecha||'â€”')+' '+(r.hora||'')+'</span>'
      +(r.generadoPor?'<span style="font-family:\'DM Mono\',monospace;font-size:0.58rem;color:#7a6040;white-space:nowrap;margin-left:4px;" title="Generado por">ðŸ‘¤ '+escHTML(r.generadoPor)+'</span>':'')
      +saldoTag+btnPago
      +'<button class="download-btn" onclick="reDescargar('+i+')">â¬‡ PDF</button>'
      +'</div>';
  }).join('');
}

function renderHistorial(){
  filtrarHistorial();
}

function reDescargar(i){
  const r=appData.recibos[i];
  if(r.pdfBase64){ const a=document.createElement('a'); a.href=r.pdfBase64; a.download=r.archivo; a.click(); }
}

// â”€â”€ MODALES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showModal(titulo,msg){
  document.getElementById('modal-title').textContent=titulo;
  document.getElementById('modal-msg').innerHTML=msg;
  document.getElementById('modal').classList.add('show');
}
function cerrarModal(){ document.getElementById('modal').classList.remove('show'); }

// â”€â”€ EVENTOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€ BUSCADOR POR CLIENTE + FOLIOS â€” botÃ³n Ãºnico unificado â”€â”€â”€â”€â”€â”€â”€â”€
_pbcAbierto = false;
_pfcAbierto = false;
_panelesBusquedaAbiertos = false;

function togglePanelesBusqueda(){
  _panelesBusquedaAbiertos = !_panelesBusquedaAbiertos;
  _pbcAbierto = _panelesBusquedaAbiertos;
  _pfcAbierto = _panelesBusquedaAbiertos;
  const cuerpo = document.getElementById('paneles-busqueda-cuerpo');
  const arrow  = document.getElementById('toggle-paneles-arrow');
  const btn    = document.getElementById('btn-toggle-paneles');
  if(cuerpo) cuerpo.style.display = _panelesBusquedaAbiertos ? 'block' : 'none';
  if(arrow)  arrow.style.transform = _panelesBusquedaAbiertos ? 'rotate(90deg)' : 'rotate(0deg)';
  if(btn){
    btn.style.borderColor   = _panelesBusquedaAbiertos ? '#1a5a28' : '#2a7a3a';
    btn.style.background    = _panelesBusquedaAbiertos ? 'rgba(42,122,58,0.10)' : 'none';
  }
  /* Sincronizar clase en body para que CSS oculte el formulario */
  if(_panelesBusquedaAbiertos){
    document.body.classList.add('paneles-busqueda-abiertos');
  } else {
    document.body.classList.remove('paneles-busqueda-abiertos');
  }
  if(typeof syncFormVisibility==='function') syncFormVisibility();
  if(_panelesBusquedaAbiertos) setTimeout(()=>{ const inp=$('pbc-input'); if(inp) inp.focus(); }, 80);
}

// Funciones de compatibilidad â€” redirigen al toggle unificado
function togglePanelBusqueda(){ togglePanelesBusqueda(); }
function togglePanelFolios(){
  // Si solo se pide abrir folios (modo-consulta), abrimos todo el panel
  if(!_panelesBusquedaAbiertos) togglePanelesBusqueda();
  setTimeout(()=>{ const f=$('folio_anterior'); if(f) f.focus(); }, 100);
}

function buscarClientePBC(){
  const q = ($('pbc-input').value || '').trim();
  const clearBtn = document.getElementById('pbc-clear');
  const countEl  = document.getElementById('pbc-count');
  const resDiv   = document.getElementById('pbc-resultados');
  clearBtn.style.display = q ? 'inline-block' : 'none';
  if(q.length < 2){ resDiv.innerHTML=''; countEl.textContent=''; return; }
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const qn = norm(q);
  const grupos = {};
  (appData.recibos||[]).forEach(r=>{
    const nk = norm(r.nombre);
    if(!nk.includes(qn)) return;
    if(!grupos[nk]) grupos[nk]={ nombre:r.nombre, recibos:[] };
    grupos[nk].recibos.push(r);
  });
  const clientes = Object.values(grupos);
  if(!clientes.length){
    resDiv.innerHTML='<div class="pbc-empty">Sin resultados para "<strong>'+escHTML(q)+'</strong>"</div>';
    countEl.textContent=''; return;
  }
  countEl.textContent = clientes.length+(clientes.length===1?' cliente encontrado':' clientes encontrados');
  resDiv.innerHTML = clientes.map(g=>{
    const prioridad = r => r.cancelado?3:(r.esComplemento?2:(r.saldoPendiente>0?0:1));
    const sorted = [...g.recibos].sort((a,b)=>prioridad(a)-prioridad(b)||b.folio-a.folio);
    const chips = sorted.map(r=>{
      const fs='#'+folioFormato(r.folio, r.anio_folio);
      let clase,ico;
      if(r.cancelado)            { clase='cancelado';   ico='ðŸš«'; }
      else if(r.esComplemento)   { clase='complemento'; ico='â†³';  }
      else if(r.saldoPendiente>0){ clase='pendiente';   ico='âš ï¸'; }
      else                       { clase='pagado';      ico='âœ…'; }
      const tip=r.cancelado?'CANCELADO':r.esComplemento?'Complemento ref.#'+folioFormato(r.folioRef||0):(r.saldoPendiente>0?'Pendiente $'+fmtMXN(r.saldoPendiente):'Liquidado');
      return '<span class="pbc-chip '+clase+'" title="'+fs+' Â· '+(r.fecha||'â€”')+' Â· '+tip+'" onclick="abrirFolioPBC('+r.folio+','+(!!r.esComplemento)+')">'
        +ico+' '+fs+(r.fecha?'<span class="pbc-chip-fecha">'+r.fecha+'</span>':'')+'</span>';
    }).join('');
    const nPend=g.recibos.filter(r=>!r.cancelado&&!r.esComplemento&&r.saldoPendiente>0).length;
    const nPag =g.recibos.filter(r=>!r.cancelado&&!r.esComplemento&&!(r.saldoPendiente>0)).length;
    const nCanc=g.recibos.filter(r=>r.cancelado).length;
    const total=g.recibos.length;
    const partes=[];
    if(nPend) partes.push('<span style="color:#9a5a10">'+nPend+' pend.</span>');
    if(nPag)  partes.push('<span style="color:#1a5a2a">'+nPag+' liq.</span>');
    if(nCanc) partes.push('<span style="color:#888">'+nCanc+' canc.</span>');
    return '<div class="pbc-card">'
      +'<div class="pbc-nombre-row">'+escHTML(g.nombre)
      +'<span class="pbc-badge">'+total+(total===1?' trÃ¡mite':' trÃ¡mites')+'</span>'
      +(partes.length?'<span class="pbc-estados">'+partes.join('')+'</span>':'')
      +'</div><div class="pbc-chips">'+chips+'</div></div>';
  }).join('');
}

function limpiarPBC(){
  $('pbc-input').value='';
  document.getElementById('pbc-clear').style.display='none';
  document.getElementById('pbc-resultados').innerHTML='';
  document.getElementById('pbc-count').textContent='';
  $('pbc-input').focus();
}

function abrirFolioPBC(folio, esComplemento){
  if(esComplemento){
    const r=(appData.recibos||[]).find(rc=>rc.folio===folio);
    if(r&&r.folioRef){
      showModal('Folio complemento','Este es un abono del folio #'+folioFormato(r.folioRef)+'. Se abrirÃ¡ el recibo original.');
      setTimeout(()=>abrirFolioPBC(r.folioRef,false),1400); return;
    }
  }
  const campo=$('folio_anterior');
  if(!campo) return;
  campo.value=folio;
  campo.scrollIntoView({behavior:'smooth',block:'center'});
  campo.focus();
  if(typeof cargarHistorialFolio==='function') cargarHistorialFolio();
}

// â”€â”€ EVENTOS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener('input',function(e){
  if(e.target.id?.startsWith('nombre_')||['fecha_recibo','hora_recibo'].includes(e.target.id))
    generarQRPreview();
});
function regresarAlFormulario(){
  if(document.body.classList.contains('modo-consulta')||document.body.classList.contains('paneles-abiertos-consulta')){
    if(typeof cerrarConsulta==='function') cerrarConsulta();
  } else {
    const panCuerpo=document.getElementById('paneles-busqueda-cuerpo');
    if(panCuerpo) panCuerpo.setAttribute('style','display:none; padding:0 20px 14px;');
    const pbcB=document.getElementById('pbc-body');
    const pfcB=document.getElementById('pfc-body');
    if(pbcB) pbcB.removeAttribute('style');
    if(pfcB) pfcB.removeAttribute('style');
    if(typeof _panelesBusquedaAbiertos!=='undefined') _panelesBusquedaAbiertos=false;
    if(typeof _pbcAbierto!=='undefined') _pbcAbierto=false;
    if(typeof _pfcAbierto!=='undefined') _pfcAbierto=false;
    document.body.classList.remove('paneles-busqueda-abiertos');
    document.body.classList.remove('paneles-abiertos-consulta');
    const arrow=document.getElementById('toggle-paneles-arrow');
    if(arrow) arrow.style.transform='rotate(0deg)';
    const btn=document.getElementById('btn-toggle-paneles');
    if(btn){btn.style.borderColor='#2a7a3a';btn.style.background='none';}
    if(typeof syncFormVisibility==='function') syncFormVisibility();
    setTimeout(()=>{
      const rb=document.getElementById('recibo-body');
      if(rb) rb.scrollIntoView({behavior:'smooth',block:'start'});
      else window.scrollTo({top:0,behavior:'smooth'});
    },80);
  }
}