// ════════════════════════════════════════════════════════════════
// BLOQUE 2 — originalmente en línea 9154 de index.html
// ════════════════════════════════════════════════════════════════
// ═══ CONFIGURACIÓN DRIVE ═══
// CLIENT ID unificado con el sistema de recibos (proyecto único en Google Cloud Console)
// (Referencia eliminada: contabilidad migrada a Supabase)
// DEMO: 1yAY4BUGx6cUQWflctoeK6WVKulS3AHsZR9ksexQrIlg (archivo de prueba)
// PRODUCCIÓN: cambiar por el ID del archivo CONTABILIDAD 2026 real cuando esté listo
// ─── DIRECTORIO (directorio guardado en Supabase vía D.directorio) ─
// ─── Variables de runtime (juicios/carpetas modal) ───────────────
let jdetIdx=-1; // índice del juicio abierto en detalle
let driveFoldersCache=[]; // cache de carpetas de Drive vinculadas a juicios
let driveFolderSeleccionado=null; // {id, name} carpeta seleccionada en modal
let acuerdoPDFPendiente=null; // File object pendiente de subir
// ═══ ESTADO ═══
let D={movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],citas:[],cierres:[],prestamos:[],cuentasPorCobrar:[],saldoAcumulado:0,leyes:[],tiempoExtra:{}};
let REC={folioActual:100,recibos:[]}; // Se sobrescribe con datos de Drive al conectar
let filtroC='todo',filtroDT='todos',filtroCT='todas',filtroJ='todos',filtroP='activos',filtroSeccion='todas',modo='ingreso';
let eiC=-1,eiK=-1,eiJ=-1,eiP=-1;
// Número de carpeta (permanente) capturado al ABRIR "Editar Carpeta" — eiK es
// solo un índice dentro de D.carpetas y ese arreglo puede reordenarse o
// reconstruirse en segundo plano (sincronización con Supabase) mientras el
// modal sigue abierto; guardar o eliminar usando eiK a ciegas puede terminar
// escribiendo encima de OTRA carpeta distinta a la que el usuario editó. Por
// eso, al guardar/eliminar se vuelve a ubicar la carpeta por este número.
let eiKNum=null;
// ─── BLOQUEO DE CAJA ─────────────────────────────────────────────
// Estado en memoria — se reinicia al recargar la página (ya no usa localStorage)
let _cajaCerradaHoy = false;
/* Movido a modules/caja/index.js: cajaBloqueada */
/* Movido a modules/caja/index.js: marcarCajaCerrada */

// ─── BLINDAJE DE PERÍODO POR CORTE DE CAJA ───────────────────────
// Un registro es inmutable si su fecha+hora es anterior o igual al
// timestamp del corte de caja que cerró ese período.
// Una vez blindado, NADA (usuario, modo retroactivo, auto-corrección)
// puede modificar, cancelar ni eliminar ese registro.
/* Movido a modules/caja/index.js: esPeriodoCerrado */
/* Movido a modules/caja/index.js: _msgPeriodoCerrado */
/* Movido a modules/administracion/index.js: aplicarEstadoCierre */
// ═══ DATOS PRECARGADOS ═══
// DIR0 — Semilla inicial del directorio
// Solo se usa la PRIMERA VEZ para crear directorio.json en Drive
// Después, Drive es la fuente de verdad — NO modificar este array
const DIR0=[];
// CARP0 — Semilla inicial de carpetas desde CARPETAS_INTERNAS.xlsm
// Solo se usa la PRIMERA VEZ para crear carpetas_internas.json en Drive
// Después, Drive es la fuente de verdad — NO modificar este array
const CARP0=[];
const JUI0=[];
// PEND0 vacío — los pendientes se cargan exclusivamente desde pendientes.json en Drive.
// Al conectar Drive por primera vez se crea el archivo automáticamente.
const PEND0=[];
const SRVS={
  tenencias:[
    {nom:'Tenencia EDOMEX',p:40,cat:'tenencia',ico:'📄'},{nom:'Tenencia OAXACA',p:40,cat:'tenencia',ico:'📄'},
    {nom:'Tenencia CDMX',p:40,cat:'tenencia',ico:'📄'},{nom:'Tenencia MICHOACÁN',p:40,cat:'tenencia',ico:'📄'},
    {nom:'Tenencia TLAXCALA',p:40,cat:'tenencia',ico:'📄'},{nom:'Tenencia DURANGO',p:50,cat:'tenencia',ico:'📄'},
    {nom:'Tenencia VERACRUZ',p:50,cat:'tenencia',ico:'📄'},{nom:'Copia simple',p:2,cat:'copia',ico:'📑'},
    {nom:'Impresión doc.',p:50,cat:'copia',ico:'🖨'},
  ],
  actas:[
    {nom:'Acta Nac. OAX',p:240,cat:'acta',ico:'📋'},{nom:'Acta + CURP',p:280,cat:'acta',ico:'📋'},
    {nom:'Acta+CURP+Copia',p:320,cat:'acta',ico:'📋'},{nom:'Acta otros estados',p:280,cat:'acta',ico:'📋'},
    {nom:'CURP simple',p:40,cat:'curp',ico:'🆔'},{nom:'CURP + Copia',p:48,cat:'curp',ico:'🆔'},
    {nom:'RFC genérico',p:50,cat:'curp',ico:'🆔'},{nom:'Const.Sit.Fiscal',p:300,cat:'gobierno',ico:'📜'},
    {nom:'Escaneo docs.',p:150,cat:'copia',ico:'📷'},
  ],
  juridico:[
    {nom:'Asesoría',p:300,cat:'asesoria',ico:'⚖️'},{nom:'Cotización',p:100,cat:'asesoria',ico:'💰'},
    {nom:'Carta Responsiva',p:300,cat:'honorario',ico:'📄'},{nom:'Investigación veh.',p:550,cat:'placa',ico:'🔍'},
    {nom:'Cita Pasaporte',p:300,cat:'gobierno',ico:'🛂'},
  ],
  egresos:[
    {nom:'Pago actas sistema',p:0,cat:'gobierno',ico:'💻',e:1},{nom:'Pago tenencia',p:0,cat:'gobierno',ico:'🏛',e:1},
    {nom:'Traslado dominio',p:905,cat:'catastro',ico:'🏠',e:1},{nom:'Renta despacho',p:6500,cat:'renta',ico:'🏢',e:1},
    {nom:'Sueldo personal',p:3000,cat:'sueldo',ico:'👤',e:1},{nom:'Compra insumos',p:0,cat:'insumo',ico:'📦',e:1},
    {nom:'Paquetería',p:150,cat:'insumo',ico:'📬',e:1},{nom:'Al Lic. (entrega)',p:0,cat:'otro',ico:'➡️',e:1},
  ]
};
// ═══ UTILS ═══
// Nota: $() ya está definido al inicio del archivo con caché de DOM.
const fmt=n=>Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
// ═══ MEJORA 2: PARSEO SEGURO DE NÚMEROS ═══
// toNumero(valor, default) — convierte texto a número con validación.
// Si el valor no es un número válido, devuelve el default.
// Acepta strings con comas como separador de miles ("1,234.56" → 1234.56).
// Si esperas decimales (precios, totales) usa toNumero(v, 0).
// Si esperas entero (cantidades), usa toEntero(v, 1).
/* Movido a modules/core/index.js: toNumero */
/* Movido a modules/core/index.js: toEntero */
const _hoyReal=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const _horaReal=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
// ═══ CAPTURA RETROACTIVA — VIGENCIA ESTRICTA ══════════════════════════════
// BUG RAÍZ (caso real 08-ago-2026): window._capturaMesActivo es una bandera de
// sesión que reescribe hoy()/hora() para TODO lo que se registre después. Solo
// se limpiaba al pulsar "✕ Salir" del banner: si en vez de eso se cerraba el
// panel de admin (adminVolverPanel), se abría un modal encima del banner, o
// simplemente se seguía trabajando, el modo quedaba prendido en silencio y
// CADA movimiento posterior se guardaba con fecha pasada — y el Monitor lo
// marcaba (correctamente) como "SÍ retroactivo". El movimiento no estaba mal
// etiquetado: su fecha REALMENTE estaba mal. Huella inconfundible del bug:
// movimientos capturados el 08-ago que quedaron con fecha 2026-08-01, es decir
// exactamente el `anio-mes-01` que devolvía el fallback de abajo cuando el
// usuario nunca eligió fecha manual.
//
// Blindaje (3 candados independientes, cualquiera corta el modo):
//   1. El banner azul debe existir y estar VISIBLE. El modo ya no puede estar
//      activo sin su indicador en pantalla: si el banner se oculta o se quita,
//      el modo se apaga solo.
//   2. Vigencia máxima de 2 h desde la última acción retroactiva. Una sesión de
//      captura olvidada caduca sola en vez de contaminar el resto del día.
//   3. Requiere fecha elegida explícitamente. Ya NO existe el fallback mudo al
//      día 1 del mes: sin fecha manual, se usa la fecha real de hoy.
const CAPTURA_RETRO_VIGENCIA_MS = 2*60*60*1000;
/* Movido a modules/core/index.js: _capturaRetroApagar */
// Devuelve el modo retroactivo SOLO si sigue vigente; si no, lo apaga y devuelve null.
/* Movido a modules/core/index.js: _capturaRetroVigente */
window._capturaRetroVigente = _capturaRetroVigente;
window._capturaRetroApagar  = _capturaRetroApagar;
// hoy() y hora() respetan el modo captura retroactiva SOLO mientras esté vigente
const hoy=()=>{
  const m = _capturaRetroVigente();
  // Sin fecha elegida explícitamente NO se inventa una del pasado: se usa hoy.
  if(m && window._capturaFechaManual){
    window._capturaMesActivadoTs = Date.now(); // renovar vigencia por uso real
    return window._capturaFechaManual;
  }
  return _hoyReal();
};
const hora=()=>{
  const m = _capturaRetroVigente();
  if(m && window._capturaFechaManual && window._capturaHoraManual){
    return window._capturaHoraManual;
  }
  return _horaReal();
};
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// ═══ COLOR POR TIPO DE ARCHIVO ════════════════════════════════════════════
// A petición expresa: en las listas de documentos adjuntos (Placas, Expediente
// Digital, Escrituras) todas las etiquetas se veían iguales — con 8 o 10
// archivos por trámite era imposible distinguir de un vistazo cuál es una foto,
// cuál un PDF y cuál un Word. Ahora cada familia de archivo tiene su color e
// icono. Las imágenes (jpg, jpeg, png, webp…) comparten un mismo color, tal
// como se pidió, porque para el trámite son la misma cosa: una foto del documento.
// Paleta elegida por la usuaria (11-ago-2026):
//   imágenes → beige (el color que ya tenían todas las etiquetas)
//   PDF      → azul claro
//   ofimática (Word y Excel juntos) → verde suave
//   cualquier otro → morado pastel
const _DOC_ESTILOS = {
  imagen: { bg:'#f7f0dc', borde:'#d4b870', texto:'#633806', icono:'🖼️' },
  pdf:    { bg:'#e3f0fb', borde:'#7aa8d0', texto:'#123a5c', icono:'📕' },
  office: { bg:'#e6f4ea', borde:'#8dc4a0', texto:'#1a5233', icono:'📗' },
  otro:   { bg:'#f0eafa', borde:'#b9a5db', texto:'#493068', icono:'📄' }
};
/* Movido a modules/documentos/index.js: _docFamilia */
/* Movido a modules/core/index.js: _docEstilo */
window._docFamilia = _docFamilia;
window._docEstilo  = _docEstilo;
const empNombre=()=>localStorage.getItem('empleado_nombre')||'Usuario';
const empEmail=()=>localStorage.getItem('empleado_email')||'';
// ═══ HORARIO DE CAPTURA — checador + avisos programados ═══════════════════
// HORARIO_CAPTURA_INICIO sigue siendo el horario OFICIAL (8:30) — es la
// referencia contra la que se mide puntualidad/tardanza en el Checador y no
// cambia. HORARIO_APERTURA_SISTEMA es aparte: la hora real desde la que el
// sistema deja entrar a los empleados (7:00, permanente, para todos) — a
// petición expresa: a veces llegan temprano y se les habilita el acceso,
// pero seguir contando "tarde" a partir de las 8:30 tal cual siempre.
const HORARIO_CAPTURA_INICIO  = '08:30';
const HORARIO_APERTURA_SISTEMA = '07:00';
const HORARIO_CAPTURA_FIN     = '17:30';
const TOLERANCIA_TARDANZA_MIN = 10;
/* Movido a modules/core/index.js: _minutosDeHHMM */
// Hora "verificada": corrige el reloj de la PC con el desvío medido contra
// el servidor (horaDriveDesviacion, ver sincronizarHoraCDMX/verificarHoraConDrive
// más arriba) — así, si un empleado adelanta o atrasa el reloj de su equipo
// para intentar burlar el horario/checador/captura retroactiva, el sistema
// sigue usando la hora real. Si aún no hay verificación disponible (recién
// cargó la página, o sin conexión), se usa el reloj local tal cual — nunca
// bloquea por falta de red, solo dejamos de corregir mientras no haya dato.
/* Movido a modules/documentos/index.js: _ahoraVerificado */
/* Movido a modules/core/index.js: _minutosAhora */
// ═══ TIEMPO EXTRA POR EMPLEADO (otorgado por el administrador) ═════════════
// D.tiempoExtra[email] = { tipo:'hora'|'indefinido_hoy'|'indefinido_permanente',
//   hasta:'HH:MM' (solo tipo 'hora'), fecha:'YYYY-MM-DD' (día en que se otorgó,
//   usado para que 'hora' e 'indefinido_hoy' expiren solos al día siguiente),
//   otorgadoPor, otorgadoTs }. 'indefinido_permanente' no expira solo — se
// queda activo hasta que el administrador lo apague a mano.
/* Movido a modules/core/index.js: _teClaveHoy */
/* Movido a modules/administracion/index.js: _teObtener */
// ¿el tiempo extra otorgado deja el sistema abierto en este momento exacto?
/* Movido a modules/core/index.js: _teEstaAbierto */
/* Movido a modules/core/index.js: _teDescribir */
// domingo | antes | manana | tarde | cerrado
/* Movido a modules/administracion/index.js: _horarioEstado */
// "Buenos días" / "Buenas tardes" / "Buenas noches" según la hora real —
// usado en avisos que pueden aparecer a cualquier hora (ej. domingo).
/* Movido a modules/core/index.js: _saludoPorHora */
// Extrae el primer nombre de pila, saltando prefijos como LIC/ING/DR/MTRO
/* Movido a modules/administracion/index.js: _primerNombreEmpleado */
// Quita cualquier "cortina" de carga que siga tapando el sistema (el splash
// negro texturizado de sesión restaurada, o el modal de login dejado puesto
// en el login manual). Se llama justo en el momento en que ya se sabe qué
// mostrar (aviso de horario, o nada si es admin) — nunca antes — para que el
// dashboard sin bloquear jamás quede expuesto ni un instante de por medio.
/* Movido a modules/core/index.js: _lexCortinaQuitar */
// ── Modal de bienvenida por horario (antes/mañana/tarde/cerrado) ──────────
let _hgCountdownTimer = null;
/* Movido a modules/core/index.js: _horarioGateMostrar */
/* Movido a modules/core/index.js: _horarioGateCountdownIniciar */
/* Movido a modules/administracion/index.js: _horarioGateCerrar */
// Punto de entrada: se llama tras cada login/restauración de sesión
/* Movido a modules/administracion/index.js: horarioGateLogin */
// ── Avisos programados durante la jornada (aplican a todos, incluido admin) ──
// _formatoFaltaTiempo: expresa en minutos/horas el tiempo REAL que falta para
// el cierre — usado por los avisos 16:30/17:15 para que, si el sistema se abre
// tarde (después de esa hora exacta), el mensaje diga cuánto falta DE VERDAD
// en vez de repetir el texto fijo pensado solo para quien lo ve justo a tiempo.
/* Movido a modules/core/index.js: _formatoFaltaTiempo */
const AVISOS_PROGRAMADOS = [
  { hhmm:'12:00', color:'#2dba58', titulo:'RECORDATORIO DE CONTABILIDAD',
    cuerpo:'Se recomienda registrar oportunamente los ingresos, egresos y demás movimientos realizados durante la jornada para mantener la información actualizada.' },
  { hhmm:'15:00', color:'#1a5fa0', titulo:'SEGUIMIENTO DE REGISTROS CONTABLES',
    cuerpo:'Verifique que todos los movimientos efectuados hasta este momento se encuentren debidamente registrados en el sistema.' },
  { hhmm:'16:30', color:'#c8952a', titulo:'AVISO DE CIERRE CONTABLE',
    cuerpo: function(){
      const falta = _minutosDeHHMM(HORARIO_CAPTURA_FIN) - _minutosAhora();
      return 'Falta ' + _formatoFaltaTiempo(falta) + ' para el cierre del sistema. Si existen movimientos pendientes, regístrelos ahora para evitar omisiones en la contabilidad del día.';
    } },
  { hhmm:'17:15', color:'#e0781a', titulo:'ÚLTIMO AVISO',
    cuerpo: function(){
      const falta = _minutosDeHHMM(HORARIO_CAPTURA_FIN) - _minutosAhora();
      return 'El sistema cerrará en ' + _formatoFaltaTiempo(falta) + '. Después de las 5:30 p. m. no será posible registrar ingresos, egresos ni movimientos correspondientes a la jornada de hoy.';
    } },
  { hhmm:'17:30', color:'#c0161a', titulo:'SISTEMA CERRADO',
    cuerpo:'El horario autorizado para el registro de movimientos ha concluido. La captura de información permanecerá deshabilitada hasta el siguiente día hábil. En caso de una incidencia justificada, comuníquese con el administrador del sistema.' }
];
/* Movido a modules/administracion/index.js: _avisoProgramadoVistoHoyKey */
/* Movido a modules/administracion/index.js: _avisoProgramadoChequear */
/* Movido a modules/core/index.js: _avisoProgramadoMostrar */
// ── CANDADO DE EDICIÓN POR FOLIO ──────────────────────────────────────
// A petición expresa: si dos personas editan el mismo folio al mismo
// tiempo, gana quien guarda al último y el otro cambio se pierde sin
// aviso. Este candado bloquea de forma ESTRICTA (no solo advierte):
// al abrir cualquier flujo de edición de un folio, primero se intenta
// tomar el candado en Supabase (tabla folio_locks, función RPC atómica
// intentar_candado_folio — evita condición de carrera entre 2 clientes
// que lo pidan en el mismo instante). Si otra persona ya lo tiene, se
// bloquea la edición y se avisa quién lo tiene. El candado expira solo
// a los 10 minutos por si alguien cierra el navegador sin guardar/cancelar.
/* Movido a modules/documentos/index.js: _lockSessionId */
// Intenta adquirir el candado del folio. Resuelve siempre (nunca rechaza):
// {ok:true} si se pudo (o ya era tuyo), {ok:false, locked_by_name, expires_at} si no.
// Si Supabase no responde, "falla abierto" (permite editar) para no dejar
// el sistema inutilizable por un problema de red — solo avisa por consola.
/* Movido a modules/recibos/index.js: _lockIntentarAdquirir */
/* Movido a modules/recibos/index.js: _lockLiberar */
/* Movido a modules/recibos/index.js: _lockAvisoBloqueo */
window._lockLiberar = _lockLiberar;
// ═══ R2 CLOUDFLARE — configuración y helpers ═══
const R2_WORKER = window.LEX_PUBLIC_CONFIG.workerUrl;
// SEGURIDAD: no existe token fijo de respaldo en el cliente. Todos los accesos
// a R2, Drive, administración e IA deben presentar un JWT vigente de Supabase.
/* Movido a modules/documentos/index.js: _r2AuthToken */
window.subirR2 = async function(file, path, bucket) {
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('path', path);
    fd.append('bucket', bucket || 'recibos');
    const res = await fetch(R2_WORKER + '/r2/upload?bucket=' + encodeURIComponent(bucket || 'recibos'), {
      method: 'POST',
      headers: { 'X-Auth-Token': await _r2AuthToken() },
      body: fd
    });
    if (!res.ok) { console.error('subirR2 error', res.status, await res.text()); return false; }
    return true;
  } catch(e) { console.error('subirR2 excepcion', e); return false; }
}
window.descargarR2 = async function(path, bucket, _silencioso) {
  try {
    // ⚠️ Cache-busting: sin esto, el navegador puede servir una copia vieja en
    // caché para la MISMA url (mismo path) aunque el archivo en R2 ya se haya
    // regenerado — causaba que un PDF recién corregido y resubido siguiera
    // mostrando el contenido anterior hasta cerrar/reabrir el navegador.
    const url = R2_WORKER + '/r2/file?path=' + encodeURIComponent(path)
              + '&bucket=' + (bucket || 'recibos')
              + '&_cb=' + Date.now();
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'X-Auth-Token': await _r2AuthToken() }
    });
    if (res.ok) return await res.blob();
    // 404 en archivos opcionales (meta.json) es normal — no llenar consola
    var esOpcional = path.endsWith('meta.json') || _silencioso;
    if (!esOpcional) console.error('descargarR2 error', res.status, path);
    return null;
  } catch(e) { console.error('descargarR2 excepcion', e); return null; }
}
window.listarR2 = async function(prefix, bucket) {
  try {
    const url = R2_WORKER + '/r2/list?prefix=' + encodeURIComponent(prefix || '')
              + '&bucket=' + (bucket || 'recibos')
              + '&_cb=' + Date.now();
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'X-Auth-Token': await _r2AuthToken() }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.objects || [];
  } catch(e) { console.error('listarR2 excepcion', e); return []; }
}
window.borrarR2 = async function(path, bucket) {
  try {
    const url = R2_WORKER + '/r2/file?path=' + encodeURIComponent(path)
              + '&bucket=' + (bucket || 'recibos');
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'X-Auth-Token': await _r2AuthToken() }
    });
    return res.ok;
  } catch(e) { console.error('borrarR2 excepcion', e); return false; }
}
// ── Recuperación robusta y validada del PDF de un recibo (compartida) ──
// Devuelve un Blob PDF VÁLIDO (cabecera %PDF) o null. Repara la ruta guardada
// en el recibo cuando lo encuentra por listado. No toca el DOM.
// `abortar` (opcional): callback que, si devuelve true, cancela la operación en vuelo.
window.obtenerBlobPdfReciboValidado = async function(recibo, abortar){
  if(!recibo || !window.SB_DESPACHO_ID) return null;
  const _ab = typeof abortar === 'function' ? abortar : function(){ return false; };
  const _letra    = (recibo.letra || (typeof letraVersion==='function'?letraVersion(recibo):'A') || 'A').toUpperCase();
  const _folioStr = typeof folioFormato==='function' ? folioFormato(recibo.folio, recibo.anio_folio) : String(recibo.folio);

  // Descarga + validación de que el blob sea un PDF real (empieza con %PDF)
  const _bajar = async function(path){
    if(!path || typeof window.descargarR2!=='function') return null;
    const b = await window.descargarR2(path, 'recibos', true);
    if(_ab()) return null;
    if(!b || b.size < 100) return null;
    if(!(b.type.includes('pdf') || b.type==='application/octet-stream' || b.type==='')) return null;
    const a = await b.slice(0,4).arrayBuffer();
    return String.fromCharCode.apply(null, new Uint8Array(a)) === '%PDF' ? b : null;
  };

  let _blob = null;

  // 1) Rutas directas guardadas en el recibo
  const _cands = [];
  if(recibo.archivoR2Raiz) _cands.push(recibo.archivoR2Raiz);
  if(recibo.archivoR2 || recibo.archivo) _cands.push(window.SB_DESPACHO_ID + '/recibos/' + (recibo.archivoR2 || recibo.archivo));
  if(recibo.archivo) _cands.push(window.SB_DESPACHO_ID + '/recibos/' + recibo.archivo);
  if(recibo.nombre && recibo.archivo && typeof _nombreArchivoR2Legacy==='function'){
    _cands.push(window.SB_DESPACHO_ID + '/recibos/' + _nombreArchivoR2Legacy(recibo.archivo.replace(/\.pdf$/i,''), recibo.nombre));
  }
  for(let i=0;i<_cands.length && !_blob;i++){
    if(_ab()) return null;
    _blob = await _bajar(_cands[i]);
  }

  // 2) Búsqueda por listado del bucket (prefijo del despacho → raíz). Repara la ruta.
  if(!_blob && typeof window.listarR2==='function'){
    if(_ab()) return null;
    const _folioEsc = _folioStr.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const _reNuevo  = new RegExp('(^|[^0-9])' + _folioEsc + (_letra==='A'?'a?':_letra) + '([^0-9]|_|\\.pdf)', 'i');
    const _reViejo  = _letra==='A' ? new RegExp('Recibo_0*' + (parseInt(recibo.folio)||0) + '_', 'i') : null;
    const _buscar = function(objs){
      if(!objs || !objs.length) return null;
      let m = objs.find(o => _reNuevo.test((o.key||o.name||'').split('/').pop()));
      if(!m && _reViejo) m = objs.find(o => _reViejo.test((o.key||o.name||'').split('/').pop()));
      return m ? (m.key||m.name||null) : null;
    };
    let _key = _buscar(await window.listarR2(window.SB_DESPACHO_ID + '/recibos/', 'recibos'));
    if(_ab()) return null;
    if(!_key) _key = _buscar(await window.listarR2('', 'recibos'));
    if(_ab()) return null;
    if(_key){
      _blob = await _bajar(_key);
      if(_blob){
        if(_key.startsWith(window.SB_DESPACHO_ID + '/recibos/')){
          recibo.archivoR2 = _key.split('/').pop();
          if(!recibo.archivo) recibo.archivo = recibo.archivoR2;
        } else {
          recibo.archivoR2Raiz = _key; // ruta completa en la raíz del bucket
        }
      }
    }
  }

  // 3) Supabase Storage (validado %PDF)
  if(!_blob && window.SB && recibo.archivo){
    try{
      const _sbPath = window.SB_DESPACHO_ID + '/recibos/' + recibo.archivo;
      const { data:_sd, error:_se } = await window.SB.storage.from(STORAGE_BUCKET).createSignedUrl(_sbPath, 120);
      if(_ab()) return null;
      if(!_se && _sd && _sd.signedUrl){
        const _res = await fetch(_sd.signedUrl);
        if(_ab()) return null;
        if(_res.ok){
          const _b = await _res.blob();
          if(_ab()) return null;
          const _arr = await _b.slice(0,4).arrayBuffer();
          if(String.fromCharCode.apply(null, new Uint8Array(_arr)) === '%PDF') _blob = _b;
        }
      }
    }catch(_eSB){ console.warn('[obtenerBlobPdfReciboValidado] Storage:', _eSB); }
  }

  // 4) Recuperar pdfBase64 desde versiones_recibo (y re-subir a R2 en 2º plano)
  if(!_blob && window.SB){
    try{
      const _anio = recibo.anio_folio || new Date().getFullYear();
      let _vr = null;
      const { data:_vd1 } = await window.SB.from('versiones_recibo')
        .select('datos_completos, pdf_storage_path, letra')
        .eq('despacho_id', window.SB_DESPACHO_ID).eq('folio_base', recibo.folio)
        .eq('anio_folio', _anio).eq('letra', _letra).limit(1);
      _vr = (_vd1 && _vd1.length) ? _vd1[0] : null;
      if(!_vr){
        const { data:_vd2 } = await window.SB.from('versiones_recibo')
          .select('datos_completos, pdf_storage_path, letra')
          .eq('despacho_id', window.SB_DESPACHO_ID).eq('folio_base', recibo.folio)
          .eq('anio_folio', _anio).order('letra',{ascending:false}).limit(1);
        _vr = (_vd2 && _vd2.length) ? _vd2[0] : null;
      }
      if(_ab()) return null;
      if(_vr && _vr.datos_completos && _vr.datos_completos.pdfBase64){
        const _b64  = _vr.datos_completos.pdfBase64;
        const _b64d = _b64.includes(',') ? _b64.split(',')[1] : _b64;
        const _bin  = atob(_b64d);
        const _buf  = new Uint8Array(_bin.length);
        for(let i=0;i<_bin.length;i++) _buf[i]=_bin.charCodeAt(i);
        _blob = new Blob([_buf],{type:'application/pdf'});
        recibo.pdfBase64 = _b64;
        try{
          const _r2path = _vr.pdf_storage_path
            || (window.SB_DESPACHO_ID + '/recibos/' + (recibo.archivoR2 || recibo.archivo || (String(recibo.folio).padStart(4,'0') + (_vr.letra||'A') + '.pdf')));
          const _f = new File([_blob], _r2path.split('/').pop(), {type:'application/pdf'});
          if(typeof window.subirR2==='function') window.subirR2(_f, _r2path, 'recibos').catch(function(){});
        }catch(_eUp){}
      }
    }catch(_eVR){ console.warn('[obtenerBlobPdfReciboValidado] versiones_recibo:', _eVR); }
  }

  return _blob;
};
// ═══ FIN R2 ═══

// ── Helpers R2 para resúmenes de acuerdos ──────────────────────
/* Movido a modules/expedientes/index.js: _r2ResumenPath */
/* Movido a modules/documentos/index.js: _r2GuardarResumen */
/* Movido a modules/expedientes/index.js: _r2CargarResumen */
// ───────────────────────────────────────────────────────────────
// ═══ ACUERDOS EN DRIVE ═══════════════════════════════════════════════════
// Tabla de tipos de acuerdo detectados por Gemini
const ACUERDO_TIPOS = {
  auto:           { label: 'Auto',         color: '#185FA5', bg: '#E6F1FB' },
  sentencia:      { label: 'Sentencia',    color: '#27500A', bg: '#EAF3DE' },
  notificacion:   { label: 'Notificación', color: '#633806', bg: '#FAEEDA' },
  acuerdo:        { label: 'Acuerdo',      color: '#3C3489', bg: '#EEEDFE' },
  requerimiento:  { label: 'Requerimiento',color: '#712B13', bg: '#FAECE7' },
  otro:           { label: 'Otro',         color: '#5F5E5A', bg: '#F1EFE8' },
};

// Clave Supabase para guardar acuerdos del juicio activo
/* Movido a modules/expedientes/index.js: _acuerdosClave */

// Buscar carpeta en Drive sin crearla. Devuelve id o null.
/* Movido a modules/expedientes/index.js: driveBuscarCarpetaId */

// Listar PDFs en una carpeta de Drive.
/* Movido a modules/expedientes/index.js: driveListarArchivosCarpeta */

// Convertir un archivo de Drive en objeto acuerdo para la lista.
/* Movido a modules/expedientes/index.js: _parsearArchivoAcuerdoDrive */

// Cargar acuerdos: muestra caché local inmediatamente, luego refresca desde Drive en background.
/* Movido a modules/expedientes/index.js: cargarAcuerdosDrive */

// Refresca la lista de acuerdos consultando Drive directamente (a diferencia
// de cargarAcuerdosDrive, que devuelve el caché local de inmediato y refresca
// en segundo plano SIN esperar). Se usa antes de subir un archivo nuevo y
// antes de buscar duplicados, para que la comparación no dependa de un caché
// local que puede estar vacío o desactualizado (otro navegador, storage
// borrado, etc.).
/* Movido a modules/expedientes/index.js: _acuerdosListarDriveFresco */

// Guardar acuerdos — persiste en localStorage (Drive es la fuente de verdad).
/* Movido a modules/expedientes/index.js: guardarAcuerdosDrive */

// Renderizar la lista de acuerdos en el panel
/* Movido a modules/expedientes/index.js: renderAcuerdosDrive */

// Editar fecha de notificación de un acuerdo (inline con input date)
/* Movido a modules/expedientes/index.js: _editarNotifAcuerdo */

// Eliminar un acuerdo — borra el archivo en Drive (si existe) y lo quita de
// la lista local. Pide confirmación porque no se puede deshacer.
/* Movido a modules/expedientes/index.js: eliminarAcuerdoDrive */

// Agrupa acuerdos duplicados — mismo SHA-256 del contenido (más confiable) o,
// como respaldo cuando falta el hash, mismo nombre de archivo original.
// Devuelve solo los grupos con más de una copia, cada grupo ordenado con la
// copia más reciente primero (la que se conserva al limpiar).
/* Movido a modules/expedientes/index.js: _acuerdosAgruparDuplicados */

// Botón "🧹 Duplicados" — vuelve a listar Drive (no solo el caché local),
// agrupa los archivos repetidos y, si el usuario confirma, borra todas las
// copias de cada grupo salvo la más reciente (de Drive y de la lista local).
/* Movido a modules/clientes/index.js: _acuerdosBuscarDuplicados */

// Handler para el input file
/* Movido a modules/expedientes/index.js: subirAcuerdoDrive */

// Subir uno o varios archivos
/* Movido a modules/expedientes/index.js: subirAcuerdoDriveFiles */

// Obtener o crear carpeta en Drive (devuelve el ID)
/* Movido a modules/expedientes/index.js: driveObtenerOCrearCarpeta */

// Agregar entrada al historial cronológico desde un acuerdo analizado
/* Movido a modules/expedientes/index.js: agregarEntradaHistorialDesdeAcuerdo */

// Abrir visualizador PDF inline dentro del modal
/* Movido a modules/expedientes/index.js: verAcuerdoPDF */

/* Movido a modules/expedientes/index.js: cerrarVisorAcuerdo */

// Modal de resumen IA al hacer clic en la tarjeta (no en el ojito)
/* Movido a modules/expedientes/index.js: verResumenAcuerdoModal */

// Mostrar resumen del acuerdo al hacer clic en el historial o en la tarjeta
/* Movido a modules/expedientes/index.js: verResumenAcuerdo */

// Inicializar panel de acuerdos al abrir un juicio
/* Movido a modules/expedientes/index.js: initAcuerdosDrive */
// ═══ FIN ACUERDOS EN DRIVE ═══════════════════════════════════════════════

/* Movido a modules/core/index.js: toast */
// ═══ MEJORA: BOTÓN ACTUALIZAR (recarga forzada con caché limpio) ═══
// Recarga la página descartando el caché del navegador. Equivale a Ctrl+Shift+R.
// Si hay cambios sin sincronizar, advierte primero.
/* Movido a modules/administracion/index.js: recargarPaginaForzado */
// ═══ MEDIDOR DE CONECTIVIDAD CON DRIVE (estilo batería) ═══
// Calcula un porcentaje (0-100) basado en 5 verificaciones:
// - Internet (20%)        : navigator.onLine
// - Sesión activa (20%)   : token de Drive válido y no expirado
// - Archivo principal (20%): folioFileId existe (control de recibos)
// - Sincronización (20%)  : última sincronización exitosa < 5 min
// - Respaldo local (20%)  : hay respaldos locales recientes
/* Movido a modules/documentos/index.js: calcularConectividadDrive */
// Bandera: la primera vez que se calcula, mostrar barra azul ("cargando")
// hasta que termine la primera verificación real.
let _medidorYaInicializado = false;
/* Movido a modules/documentos/index.js: actualizarMedidorDrive */
// Animar un número de un valor a otro suavemente
/* Movido a modules/core/index.js: animarNumero */
// Actualizar el medidor cada 15 segundos para reflejar estado en vivo
setInterval(actualizarMedidorDrive, 15000);
// Primera actualización al cargar la página (después de 1.5s para dar tiempo a que cargue todo)
setTimeout(actualizarMedidorDrive, 1500);
// Inicializar el primer respaldo al cargar la página si no existe ninguno todavía.
// Esto hace que el medidor llegue al 100% sin tener que esperar a que el usuario
// haga un cambio que dispare el guardado normal.
setTimeout(function() {
  try {
    if (typeof D !== 'undefined' && typeof backupLocal === 'function') {
      const existentes = listarBackups('D');
      if (existentes.length === 0) {
        // Forzar el primer backup ignorando el límite de tiempo
        if (typeof _lastBackupTime === 'object') {
          _lastBackupTime['D'] = 0;  // Resetear para permitir que se cree
        }
        backupLocal('D', D);
        // Y también de appData si existe
        if (typeof appData !== 'undefined' && appData) {
          if (typeof _lastBackupTime === 'object') {
            _lastBackupTime['appData'] = 0;
          }
          backupLocal('appData', { folioActual: appData.folioActual, recibos: appData.recibos || [] });
        }
        // Refrescar el medidor para reflejar el nuevo estado
        if (typeof actualizarMedidorDrive === 'function') {
          setTimeout(actualizarMedidorDrive, 200);
        }
      }
    }
  } catch(e) { console.warn('inicializar backup:', e); }
}, 3000);
/* Movido a modules/core/index.js: cerrar */
// ═══ MEJORA: MODALES PROPIOS (reemplazo de confirm/prompt nativos) ═══
// Uso: const ok = await confirmarBonito({titulo, mensaje, btnSi, btnNo, peligro});
// Devuelve Promise<boolean>. Funciona como drop-in replacement de confirm() pero con UX mucho mejor.
/* Movido a modules/core/index.js: confirmarBonito */
// pedirTexto({titulo, mensaje, valorInicial, placeholder, validar}) → Promise<string|null>
/* Movido a modules/core/index.js: pedirTexto */
// Helper de escape (puede ya existir, pero por si acaso)
/* Movido a modules/core/index.js: escapeHtml */
// ═══ MEJORA 5: ATAJOS DE TECLADO GLOBALES ═══
// Los atajos solo se activan cuando el foco NO está en un input/textarea/select.
// Esto evita interferir con la escritura del usuario.
const ATAJOS = [
  { tecla: '1', alt: true, accion: function(){ if(typeof ir==='function') ir('caja'); }, descripcion: 'Ir a Caja' },
  { tecla: '2', alt: true, accion: function(){ if(typeof ir==='function') ir('nuevo-recibo'); }, descripcion: 'Nuevo Recibo' },
  { tecla: '3', alt: true, accion: function(){ if(typeof ir==='function') ir('recibos'); }, descripcion: 'Historial Recibos' },
  { tecla: '4', alt: true, accion: function(){ if(typeof ir==='function') ir('contabilidad'); }, descripcion: 'Contabilidad' },
  { tecla: '5', alt: true, accion: function(){ if(typeof ir==='function') ir('directorio'); }, descripcion: 'Directorio' },
  { tecla: '6', alt: true, accion: function(){ if(typeof ir==='function') ir('carpetas'); }, descripcion: 'Carpetas' },
  { tecla: '7', alt: true, accion: function(){ if(typeof ir==='function') ir('juicios'); }, descripcion: 'Juicios' },
  { tecla: '8', alt: true, accion: function(){ if(typeof ir==='function') ir('pendientes'); }, descripcion: 'Pendientes' },
  { tecla: 'r', ctrl: true, alt: true, accion: function(){ if(typeof ir==='function') ir('nuevo-recibo'); }, descripcion: 'Crear Recibo' },
  { tecla: 'q', ctrl: true, alt: true, accion: () => { if (typeof abrirLibre === 'function') abrirLibre(); }, descripcion: 'Caja Rápida' },
  { tecla: 'b', ctrl: true, alt: true, accion: () => { 
    const inp = document.getElementById('global-search-inp'); 
    if (inp) inp.focus(); 
  }, descripcion: 'Buscar' },
  { tecla: '?', shift: true, accion: () => mostrarAtajosAyuda(), descripcion: 'Mostrar esta ayuda' },
];
/* Movido a modules/administracion/index.js: manejarAtajos */
/* Movido a modules/core/index.js: cerrarModalesAbiertos */
/* Movido a modules/core/index.js: mostrarAtajosAyuda */
// Activar atajos globales
document.addEventListener('keydown', manejarAtajos);
// ═══ NAVEGACIÓN ═══
const TITULOS={'pre-recibo':'📋 Pre-Recibos',sesiones:'👁 Monitor de Sesiones',caja:'🏠 Principal','registro-civil':'📋 Impresión Registro Civil',contabilidad:'📊 Contabilidad',recibos:'🧾 Recibos Oficiales','nuevo-recibo':'✍️ Nuevo Recibo','configuracion':'⚙️ Configuración',directorio:'👥 Directorio',carpetas:'🗂️ Carpetas',juicios:'⚖️ Juicios',pendientes:'📌 Pendientes',escrituras:'📄 Control de Escrituras',gestiones:'📋 Recibos en Gestión',citas:'📅 Citas'};
/* Movido a modules/recibos/index.js: ir */
// ═══ RECIBOS — SISTEMA EXTERNO (iframe) ═══
/* Movido a modules/recibos/index.js: recargarReciboFrame */
// Detectar si el iframe se carga correctamente; si no, mostrar fallback
window.addEventListener('load', function() {
  try { localStorage.removeItem('lex-supabase-auth'); } catch(e){ registrarError('catch vacio', e); }
  setTimeout(function() {
    var iframe = document.getElementById('recibo-iframe');
    var fallback = document.getElementById('recibo-iframe-fallback');
    if (!iframe || !fallback) return;
    try {
      // Si X-Frame-Options bloquea, contentDocument lanza error o queda vacío
      // No podemos acceder al contenido por CORS, pero si no carga nada visible se nota
      iframe.addEventListener('error', function(){ fallback.style.display='block'; });
    } catch(e){ registrarError('catch vacio', e); }
  }, 3000);
});
// ═══ MODO ═══
/* Movido a modules/core/index.js: setModo */
// ═══ SERVICIOS 1-CLIC ═══
/* Movido a modules/core/index.js: renderSrvs */
/* Movido a modules/clientes/index.js: clickSrv */
// ═══ ORDENAMIENTO UNIFICADO DE MOVIMIENTOS ═══
// Función global que aplica el mismo criterio de ordenamiento en TODOS los paneles
// (Caja, Contabilidad, Historial, Admin de movimientos).
// Orden: descendente (más reciente arriba), con desempate inteligente.
/* Movido a modules/core/index.js: _ordenarMovs */
// ═══ RENDER CAJA ═══
/* Movido a modules/administracion/index.js: renderCaja */
/* Movido a modules/contabilidad/index.js: delMov */
// ═══ CONTABILIDAD ═══
// ═══════════════════════════════════════════════════════════════════
// CAPA DE DATOS — CONTABILIDAD
// Fuente única de verdad. Sin parches, sin estado duplicado.
// ═══════════════════════════════════════════════════════════════════
/* Movido a modules/contabilidad/index.js: _movimientosDeCaja */
/* Movido a modules/recibos/index.js: _recibosMap */
/* Movido a modules/caja/index.js: _foliosExcluidos */
/* Movido a modules/contabilidad/index.js: _foliosYaEnCaja */
/* Movido a modules/contabilidad/index.js: _reciboAMovSintetico */

// ── TAREA 2: Modal de confirmación para cambios contables automáticos ──────────
/* Movido a modules/contabilidad/index.js: confirmarCambioContable */

// ── TAREA 1: Detecta movimientos reales con monto erróneo para recibos Sin Anticipo ──
/* Movido a modules/contabilidad/index.js: _corregirMovimientosSinAnticipo */

/* Movido a modules/administracion/index.js: verificarYCorregirMovimientosSinAnticipo */

/* Movido a modules/contabilidad/index.js: getAllMovs */
/* Movido a modules/core/index.js: getMovHoy */
/* Movido a modules/caja/index.js: getSaldo */
// ═══════════════════════════════════════════════════════════════════
// PANEL CONTABILIDAD — RENDER
// ═══════════════════════════════════════════════════════════════════
let _contabDebounce = null;
/* Movido a modules/contabilidad/index.js: contabBuscarDebounce */
/* Movido a modules/contabilidad/index.js: contabLimpiarFiltros */
// Poblar selector de años con los años presentes en los datos
/* Movido a modules/caja/index.js: _poblarSelectorAnios */
// ═══ FOLIOS DE MOVIMIENTOS DE CAJA: F-MY2026-1 ═══
// Formato: F-{MES2L}{AÑO4}-{CONSECUTIVO}
// Ejemplos:
//   F-EN2026-1   primer movimiento de enero 2026
//   F-EN2026-15  decimoquinto de enero 2026
//   F-MY2025-3   tercer movimiento de mayo 2025
//   F-MY2026-3   tercer movimiento de mayo 2026  ← distinto al de 2025
// Consecutivo sin ceros al frente, crece sin límite, reinicia cada mes-año.
// Los movimientos de recibos no usan folioCaja — su identificador es el número de recibo.
const _MESES_FOLIO = [
  'EN','FB','MR','AB','MY','JN','JL','AG','SP','OC','NV','DC'
];
/* Movido a modules/recibos/index.js: _folioMY */
/* Movido a modules/contabilidad/index.js: generarFolioMovCaja */
// Reasigna folios correlativos sin huecos después de borrar movimientos.
// Agrupa por MES-AÑO — cada combinación tiene su propio consecutivo desde 1.
// Úsalo desde admin → Reparar Folios.
/* Movido a modules/contabilidad/index.js: _reordenarFoliosCaja */
/* Movido a modules/contabilidad/index.js: setFiltroC */
/* Movido a modules/administracion/index.js: renderContab */
// Panel flotante con los resultados de "cBuscar" — se crea una sola vez y se
// reutiliza; solo se muestra cuando hay texto en el buscador (q no vacío).
/* Movido a modules/contabilidad/index.js: _renderContabFlotante */
/* Movido a modules/contabilidad/index.js: _cerrarContabFlotante */
// ═══ SCANNER DE CONTABILIDAD ══════════════════════════════════════════════
// Botón "🔎 Scanner" en Contabilidad — herramientas rápidas: Préstamos,
// Ir a Folio, Caja Rápida (solo movimientos manuales, sin recibos).
/* Movido a modules/contabilidad/index.js: abrirContabScanner */
/* Movido a modules/contabilidad/index.js: cerrarContabScanner */
// ═══ MONITOR DE CONTABILIDAD ══════════════════════════════════════════════
// Botón "🛡️ Monitor" — oculto para empleados, igual que Scanner. Bitácora
// real de auditoría (quién y cuándo REAL causó cada alta/baja, aunque el
// movimiento en sí quede fechado de forma retroactiva — created_at de
// sesiones_log lo pone el propio servidor, nadie lo puede alterar desde el
// navegador), errores/alteraciones del sistema relacionados a Contabilidad,
// y una reconciliación mensual (sumas reales, cortes de caja, generado o
// perdido por mes) para tener certeza de que nada se infla ni se elimina
// sin dejar rastro.
let _monTabActual = 'bitacora';
/* Movido a modules/contabilidad/index.js: abrirContabMonitor */
/* Movido a modules/contabilidad/index.js: _monPintarTabs */
/* Movido a modules/contabilidad/index.js: cerrarContabMonitor */
/* Movido a modules/contabilidad/index.js: _monRender */
/* Movido a modules/administracion/index.js: _monRenderBitacora */
/* Movido a modules/contabilidad/index.js: _monRenderErrores */
/* Movido a modules/administracion/index.js: _monRenderReconciliacion */
// ── El botón que de verdad pidió el usuario: recalcula todos los ingresos y
// egresos y los compara contra lo que cada corte de caja formal (esCorte)
// declaró haber entregado. Si coincide (con $1 de tolerancia por redondeo),
// palomita verde. Si no, alerta en rojo con el corte y la diferencia exacta
// — así se detecta si algo se infló o se borró después de un corte.
/* Movido a modules/core/index.js: _monRecalcularTodo */
/* Movido a modules/core/index.js: _csTarjeta */
/* Movido a modules/caja/index.js: _csHome */
// ── Herramienta 4: Folios sin Liquidar (saldoPendiente > 0) ───────────────
/* Movido a modules/caja/index.js: _csAbrirSinLiquidar */
// ── Herramienta 1: Préstamos ──────────────────────────────────────────────
// Heurística simple: busca la palabra PRESTAMO/PRÉSTAMO en la descripción de
// los movimientos de Caja Rápida (no hay un módulo dedicado de préstamos —
// hoy se registran como movimientos manuales normales). No distingue
// automáticamente de quién es cada préstamo; el usuario revisa la descripción.
// Palabras sin valor para identificar a la "persona" del préstamo — se
// descartan y lo que sobra de la descripción se usa como su nombre.
const _CS_STOP_PRESTAMO = new Set(['SE','SELE','LE','LA','LO','LOS','LAS','UN','UNA','UNOS','UNAS','A','AL','DEL','DE',
  'EL','ELLA','ELLOS','QUE','PARA','POR','CON','EN','Y','O','U','SU','SUS','MI','MIS','TU','TUS',
  'ESTE','ESTA','ESTOS','ESTAS','ESE','ESA','ESOS','ESAS','SIN',
  'HIZO','HACE','DEVUELVE','DEVUELVEN','DEVOLVIO','DEVOLVIERON','PAGO','PAGARON','PAGA',
  'PRESTAMO','PRESTAMOS','PRESTA','PRESTO','PRESTADO','PRESTARON','PRESTAR',
  'CAJA','DESPACHO','LIC','DINERO','RECIBOS','RECIBO','MULTAS','MULTA','CATASTRO','OAXACA',
  'COMPLETAR','COMPRA','BOLETOS','OTRO','OTROS','DIA','DIAS',
  'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']);
/* Movido a modules/caja/index.js: _csNormPrestamo */
/* Movido a modules/caja/index.js: _csPersonaPrestamo */
// Herramienta 1: Préstamos — simple, una tarjeta por persona.
// Lógica contable:
//   · Un movimiento de préstamo puede ser el PRÉSTAMO EN SÍ o el PAGO/DEVOLUCIÓN
//     de uno anterior — hay que distinguirlos, si no, cada pago se cuenta
//     también como si fuera un préstamo nuevo (doble conteo).
//   · Se detecta que es un PAGO cuando el texto dice "SE LE PAGÓ" o
//     "SE LE DEVUELVE/DEVOLVIÓ" (con o sin espacio: "SELE") — esa frase
//     concreta solo se usa para saldar un préstamo, nunca para darlo.
//   · Cada préstamo (no-pago) se compara contra los pagos de esa misma
//     persona para ver si ya se saldó (mismo monto, fecha igual o posterior).
//   · Ingreso = la persona prestó AL despacho. Egreso = el despacho le
//     prestó A la persona. El saldo por persona es una sola resta simple:
//     lo que le debe el despacho a ella, menos lo que ella le debe al despacho.
// Ícono moneda-con-$ + flecha (verde/abajo = ingreso, rojo/arriba = egreso),
// tamaño regular y bien visible — reemplaza los emojis 📥/📤 que se veían
// casi idénticos entre sí.
/* Movido a modules/caja/index.js: _csIconoFlujo */
/* Movido a modules/caja/index.js: _csAbrirPrestamos */
// ── Herramienta: Folios por Tipo de Trámite ───────────────────────────────
// Agrupa los folios "puros" (número+letra) por r.tipoTramite (normal,
// vehicular, escritura, juicio) y dentro de cada uno separa 3 estados:
//   🟡 En proceso   = !cancelado && saldoPendiente > 0
//   ✅ Liquidados   = !cancelado && saldoPendiente <= 0
//   🔴 Cancelados   = r.cancelado === true
const _CS_TIPO_LABEL = {
  vehicular: '🚗 FOLIOS VEHICULARES',
  normal:    '📁 FOLIOS NORMALES',
  escritura: '📜 FOLIOS DE ESCRITURAS',
  juicio:    '⚖️ FOLIOS DE JUICIOS'
};
/* Movido a modules/recibos/index.js: _csAbrirFolios */
// Estado de sesión para acordeones (en memoria, se resetea al recargar)
// true = abierto manualmente, false = cerrado manualmente, undefined = sin tocar (usa default)
window._contabMesesAbiertos = window._contabMesesAbiertos || {};
window._contabAniosAbiertos = window._contabAniosAbiertos || {};

// Toggle acordeón de mes
/* Movido a modules/contabilidad/index.js: contabToggleMes */
// Toggle acordeón de año
/* Movido a modules/contabilidad/index.js: contabToggleAnio */
// ── Export CSV — respeta TODOS los filtros activos ──────────────
/* Movido a modules/caja/index.js: exportCSV */
// ═══ RECIBOS ═══
/* Movido a modules/recibos/index.js: renderRec */
// ═══ MEJORA 4: FILTROS Y EXPORTACIÓN DE RECIBOS ═══
/* Movido a modules/caja/index.js: aplicarFiltrosRecibos */
/* Movido a modules/recibos/index.js: filtrarRecibos */
/* Movido a modules/recibos/index.js: limpiarFiltrosRecibos */
/* Movido a modules/recibos/index.js: exportarRecibosCSV */
// ═══ DIRECTORIO ═══
/* Movido a modules/directorio/index.js: setDirF */
// Mejora 2: actualizar el datalist global de clientes para autocompletado
// Se llama cada vez que el directorio cambia (renderDir, sincronización, etc.)
/* Movido a modules/directorio/index.js: actualizarDatalistClientes */
/* Movido a modules/directorio/index.js: renderDir */
/* Movido a modules/directorio/index.js: abrirContacto */
let _perfilIdxActual = -1;
/* Movido a modules/directorio/index.js: _abrirPerfilContacto */
/* Movido a modules/recibos/index.js: _perfilRenderRecibos */
/* Movido a modules/expedientes/index.js: _perfilRenderPendientes */
/* Movido a modules/expedientes/index.js: _perfilRenderJuicios */
/* Movido a modules/directorio/index.js: perfilTab */
/* Movido a modules/directorio/index.js: perfilEditar */
/* Movido a modules/directorio/index.js: _abrirFormContacto */
/* Movido a modules/directorio/index.js: guardarContacto */
/* Movido a modules/directorio/index.js: eliminarContacto */
// ═══ CARPETAS ═══
/* Movido a modules/expedientes/index.js: setCarpF */
// Devuelve las observaciones de una carpeta como arreglo de {texto,fecha}
// (lista numerada nueva, con la fecha registrada sola al agregarse). Si la
// carpeta es vieja y solo tiene el texto legado en c.obs, lo trata como una
// entrada más. La antigua "Descripción/Asunto" (c.descripcion) — antes un
// campo aparte — ahora se muestra como la nota #1, adelante de las demás;
// en cuanto se vuelva a guardar desde Editar Carpeta, ese texto pasa a vivir
// dentro de obsLista y c.descripcion se limpia (evita que se duplique).
/* Movido a modules/core/index.js: _carpObsArray */
// HTML de las observaciones como lista numerada, justificada y con fecha
// (usa esc() global si existe).
/* Movido a modules/core/index.js: _carpObsHtmlEnum */
// Texto completo de una carpeta para el buscador — incluye todo lo que se
// ve en la ficha de Detalles (subtipo del trámite, notario/volumen de
// escrituras, etc.) y cada nota de Observaciones/Notas internas, para que
// buscar una palabra que solo está adentro de esos cuadros sí encuentre la
// carpeta (antes solo buscaba en cliente/número/estatus/descripcion).
/* Movido a modules/clientes/index.js: _carpTextoBusqueda */
// Espacio dedicado y amplio para CONSULTAR qué contiene la carpeta. Ya no es
// editable aquí — es solo lectura; la numeración de Observaciones/Notas
// internas se edita exclusivamente desde "Editar Carpeta" (kObsLista) y esta
// ficha simplemente la muestra con espacio de sobra y bien distinguida.
/* Movido a modules/expedientes/index.js: abrirDetallesCarpeta */
// Estado del widget de Observaciones dentro de la ficha de Detalles —
// independiente del de "Editar Carpeta" (_kObsState), aunque ambos leen y
// escriben el mismo dato (c.obsLista). _dObsEditMode controla si se muestra
// en modo CONSULTA (solo lectura, por defecto al abrir) o en modo EDICIÓN
// (textareas numerados, "＋" para agregar); se activa con el botón junto a
// la etiqueta "Observaciones / Notas internas".
let _dObsState = [{ texto:'' }];
let _dObsEditMode = false;
/* Movido a modules/integraciones/index.js: _dObsSyncBoton */
/* Movido a modules/core/index.js: _dObsRender */
/* Movido a modules/core/index.js: _dObsAutoGrow */
/* Movido a modules/core/index.js: _dObsActualizar */
/* Movido a modules/core/index.js: _dObsAgregar */
// ELIMINADA: la ficha "Ver Detalle" (verDetalleCarpeta) — modal viejo,
// duplicaba la ficha de Detalles nueva (abrirDetallesCarpeta) y mostraba
// datos desactualizados (columna Descripción, botón "Editar" ambiguo).
// Todos los puntos que la abrían ahora usan abrirDetallesCarpeta().
/* Movido a modules/recibos/index.js: _verDetalleCarpeta_ELIMINADA_ */
// Formatea el número de carpeta para mostrarlo como HTML: el prefijo "CARP.-"
// en el mismo tono del texto circundante y el número en negro, negrita y
// ligeramente más grande, para identificarlo más rápido de un vistazo.
/* Movido a modules/core/index.js: fmtCarpNumHTML */
/* Movido a modules/contabilidad/index.js: renderCarp */
// Abre el detalle del expediente y lanza el diálogo de impresión del
// navegador sobre esa misma vista — antes este botón llamaba a una función
// que no existía y no hacía nada al hacer clic.
/* Movido a modules/expedientes/index.js: imprimirCarpeta */
/* Movido a modules/expedientes/index.js: abrirMenuCarpeta */
/* Movido a modules/expedientes/index.js: kActualizarSubtipo */
// ── Observaciones / Notas internas de Carpetas — lista numerada ────────────
// Antes era un solo cuadro de texto libre. Ahora la nota #1 siempre está
// visible por defecto y "＋" agrega notas adicionales numeradas. Se guarda
// como c.obsLista (array); c.obs (texto legado de carpetas viejas) se
// migra automáticamente a la nota #1 la primera vez que se abre para editar.
// La fecha de cada observación se registra sola (fecha en que se agregó la
// nota) — nadie la escribe a mano, así que nunca se puede editar mal.
/* Movido a modules/core/index.js: _fechaHoyCorta */
/* Movido a modules/core/index.js: _fechaCorta */
let _kObsState = [{ texto:'', fecha:'' }];
/* Movido a modules/core/index.js: _kObsRender */
/* Movido a modules/core/index.js: _kObsAutoGrow */
/* Movido a modules/expedientes/index.js: _kObsActualizar */
/* Movido a modules/core/index.js: _kObsAgregar */
/* Movido a modules/core/index.js: _kObsQuitar */

/* Movido a modules/administracion/index.js: abrirCarpeta */
/* Movido a modules/clientes/index.js: guardarCarpeta */
/* Movido a modules/expedientes/index.js: eliminarCarpeta */
// ─── Colores de Estado y Prioridad ──────────────────────────────────────────
// ═══ JUICIOS ═══
/* Movido a modules/expedientes/index.js: setJF */
// ══════════════════════════════════════════════════════════════════
// RESUMEN FINANCIERO — helper reutilizable para Juicios y Pendientes
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: _finResumen */
/* Movido a modules/clientes/index.js: _verRecibosCliente */
// ═══ GESTIÓN DE RECIBO VINCULADO A UN JUICIO ═══
// Permite vincular, cambiar o desvincular el recibo de un juicio.
// Resuelve los 2 problemas reales:
//   1. Vincular el recibo correcto cuando hay coincidencias de nombre falsas
//   2. Las cantidades se leen dinámicamente desde appData.recibos, así que
//      cualquier actualización del recibo se refleja al instante en el juicio
let _juicioVincRecIdx = -1;
let _juicioVincBusqueda = '';
// ── Soporte de MÚLTIPLES folios vinculados por expediente (18/ago/2026) ──
// Antes un juicio solo podía tener UN recibo vinculado (j.folioRecibo). Ahora
// se guarda como arreglo (j.foliosRecibo). Se conserva j.folioRecibo = primer
// elemento del arreglo por compatibilidad con lecturas viejas (tag de la
// lista, _finResumen, etc.) que todavía leen el campo singular.
/* Movido a modules/recibos/index.js: _juFoliosRecibo */
/* Movido a modules/recibos/index.js: _juGuardarFoliosRecibo */
// Repinta el bloque "FOLIOS VINCULADOS" dentro del modal de vinculación, sin
// tocar el buscador (para poder seguir agregando varios sin que se resetee).
/* Movido a modules/recibos/index.js: _jvrRenderActual */
/* Movido a modules/recibos/index.js: abrirGestionReciboJuicio */
/* Movido a modules/recibos/index.js: filtrarRecibosParaJuicio */
/* Movido a modules/recibos/index.js: vincularReciboAJuicio */
/* Movido a modules/recibos/index.js: desvincularReciboDeJuicio */
// ══════════════════════════════════════════════════════════════════════════
// MOTOR DE PLAZOS  ·  Juicios
// ──────────────────────────────────────────────────────────────────────────
// Convierte "me notificaron el día X y tengo N días" en una fecha de
// vencimiento real, descontando sábados, domingos y días inhábiles.
// Todo es aritmética local: no usa IA, no necesita internet y es instantáneo.
// Nada de esto altera los términos ya capturados — t.fecha sigue siendo el
// vencimiento que manda; los campos nuevos solo sirven para calcularlo.
// ══════════════════════════════════════════════════════════════════════════

// Días inhábiles oficiales (art. 74 LFT y suspensión de labores típica).
// Es solo la semilla: la usuaria puede agregar o quitar fechas y se guardan
// en D.diasInhabiles, que viaja con el resto del estado a Supabase.
const _JU_INHABILES_BASE = [
  '01-01', // Año Nuevo
  '02-05', // Constitución
  '03-21', // Natalicio de Juárez
  '05-01', // Día del Trabajo
  '09-16', // Independencia
  '11-02', // Día de Muertos
  '11-20', // Revolución
  '12-12', // Guadalupe
  '12-25'  // Navidad
];

// Catálogo inicial de plazos. Editable desde el sistema; se guarda en
// D.catalogoPlazos. Son los términos más usados en materia civil y familiar.
const _JU_PLAZOS_BASE = [
  { nombre:'Contestar demanda',            dias:9,  habiles:true },
  { nombre:'Contestar vista',              dias:3,  habiles:true },
  { nombre:'Ofrecer pruebas',              dias:10, habiles:true },
  { nombre:'Desahogar prevención',         dias:3,  habiles:true },
  { nombre:'Presentar alegatos',           dias:5,  habiles:true },
  { nombre:'Interponer apelación',         dias:9,  habiles:true },
  { nombre:'Interponer revocación',        dias:3,  habiles:true },
  { nombre:'Amparo indirecto',             dias:15, habiles:true },
  { nombre:'Amparo directo',               dias:15, habiles:true },
  { nombre:'Cumplir requerimiento',        dias:3,  habiles:true },
  { nombre:'Exhibir documentos',           dias:3,  habiles:true },
  { nombre:'Objetar pruebas',              dias:3,  habiles:true },
  { nombre:'Personalizado',                dias:0,  habiles:true }
];

/* Movido a modules/core/index.js: _juCatalogoPlazos */
/* Movido a modules/core/index.js: _juInhabilesExtra */

// ¿Es día hábil? Falso en sábado, domingo, feriado fijo o inhábil capturado.
/* Movido a modules/core/index.js: _juEsHabil */
/* Movido a modules/core/index.js: _juISO */
// Suma días a partir de la notificación y devuelve la fecha de vencimiento.
// En días hábiles el conteo arranca al día hábil SIGUIENTE al de la
// notificación (el acuerdo surte efectos al día siguiente), que es la regla
// general en el procedimiento mexicano.
/* Movido a modules/core/index.js: _juCalcVencimiento */
// Estado de un término respecto a hoy. Devuelve el color y los días.
/* Movido a modules/expedientes/index.js: _juEstadoTermino */
// Todos los términos abiertos de un expediente, INCLUYENDO el que vive en el
// campo antiguo j.audiencia.
// IMPORTANTE: en los expedientes ya capturados la fecha límite muchas veces no
// está en j.terminos sino en j.audiencia (así se guardaba antes). Si solo
// leyéramos j.terminos, expedientes con término vencido —como el de Cristina
// Bazante— aparecerían como "sin términos", que es justo lo que pasaba.
// El término derivado de j.audiencia se marca con _virtual:true para saber que
// todavía no es un registro propio.
/* Movido a modules/contabilidad/index.js: _juTerminosAbiertos */
// ── Responsable de cumplir un término ───────────────────────────────────
// A petición expresa (18/ago/2026): hay términos que le corresponde cumplir
// a la CONTRAPARTE o a una AUTORIDAD (juez/DIF/etc.) — no son una obligación
// nuestra, así que no deben contar como "urgente" ni aparecer en el aviso
// del expediente (que es una lista de pendientes DE NOSOTROS). Los términos
// viejos no tienen este campo — se tratan como "nosotros" por compatibilidad
// (nunca se ocultaba nada antes de esto, así que ocultar por default sería
// un cambio de comportamiento peligroso: mejor pecar de mostrar de más).
/* Movido a modules/clientes/index.js: _juEsResponsableNuestro */
// Todos los términos abiertos que nos corresponde cumplir a NOSOTROS (excluye
// contraparte/autoridad), ordenados por urgencia — se usa tanto para la lista
// del aviso (puede mostrar varios a la vez) como para "el más urgente".
/* Movido a modules/clientes/index.js: _juTerminosPropiosAbiertos */
// Término abierto más urgente de un expediente que nos corresponda a
// nosotros (el que ordena la lista principal de Juicios).
/* Movido a modules/expedientes/index.js: _juTerminoUrgente */
// Etapas por tipo de juicio. Configurable en D.etapasPorTipo; si el tipo no
// está catalogado se usa la secuencia genérica.
const _JU_ETAPAS_BASE = ['Demanda','Emplazamiento','Contestación','Probatoria','Alegatos','Sentencia'];
/* Movido a modules/core/index.js: _juEtapas */
/* Movido a modules/core/index.js: _juEtapaActual */

// Píldora del estatus del expediente. Al darle clic abre la MISMA ventana que
// se usa para capturar un expediente nuevo (abrirJuicioEdit), donde está el
// campo de estatus — así no hay dos formas distintas de editar lo mismo.
/* Movido a modules/core/index.js: _juPillEstatus */

// ── Lista de expedientes en tabla (Pantalla 1 aprobada) ───────────────────
// Se deja como función aparte y renderJuicios() la invoca solo si existe: si
// algún día hubiera que volver a las tarjetas viejas, basta con quitar esta
// función y el sistema regresa solo al comportamiento anterior.
/* Movido a modules/expedientes/index.js: _juRenderListaTabla */

/* Movido a modules/clientes/index.js: renderJuicios */
/* Movido a modules/expedientes/index.js: proximaAudienciaDeTerminos */
// ─── Detalle de Juicio (LEGACY — ya NO es la versión activa) ───────
// FIX (18/ago/2026): había TRES funciones llamadas "abrirDetalle" en el
// archivo (esta, otra en ~línea 56575, y la vigente en ~línea 66237, con
// pestañas/notas/documentos/aviso de término). Al haber más de una definición
// con el mismo nombre global, cuál "gana" en tiempo de ejecución depende del
// orden de hoisting/reasignación — frágil y confuso, y probablemente la causa
// de que ediciones recientes al modal de expediente no se reflejaran de forma
// consistente. Se renombra esta (obsoleta: usa #juicio-detalle/.jdet-tab, un
// sistema de pestañas viejo que ya no existe en el HTML actual) para que ya
// no compita por el nombre "abrirDetalle" — deja de ejecutarse nunca.
/* Movido a modules/clientes/index.js: _abrirDetalleLegacyV1_NoUsar */
/* Movido a modules/expedientes/index.js: cerrarDetalle */
/* Movido a modules/clientes/index.js: confirmarEliminarJuicio */
/* Movido a modules/core/index.js: switchJTab */
/* Movido a modules/clientes/index.js: abrirJuicioEdit */
// ─── Vincular carpeta/recibo desde el modal Nuevo/Editar Expediente ───
// Reusa los flujos ya existentes (abrirVinculacionDrive / abrirVinculacionFolio),
// que operan sobre jdetIdx — por eso lo apuntamos al mismo expediente (eiJ)
// antes de invocarlos. Solo disponible si el expediente ya existe (eiJ>=0):
// no tiene sentido vincular carpeta/recibo a un juicio que aún no se ha guardado.
/* Movido a modules/recibos/index.js: _mJuActualizarVinculaciones */
/* Movido a modules/expedientes/index.js: _mJuVincularCarpeta */
/* Movido a modules/recibos/index.js: _mJuVincularRecibo */
/* Movido a modules/expedientes/index.js: abrirJuicio */
/* Movido a modules/recibos/index.js: guardarJuicio */
// ─── Acuerdos ─────────────────────────────────────────────────────
/* Movido a modules/expedientes/index.js: renderAcuerdos */
/* Movido a modules/expedientes/index.js: abrirNuevoAcuerdo */
/* Movido a modules/expedientes/index.js: previewAcuerdoPDF */
/* Movido a modules/expedientes/index.js: guardarAcuerdo */
/* Movido a modules/expedientes/index.js: eliminarAcuerdo */
/* Movido a modules/expedientes/index.js: verPDFAcuerdo */
/* Movido a modules/documentos/index.js: cerrarVisorPDF */
/* Movido a modules/expedientes/index.js: resumirUltimoAcuerdoIA */
// ─── Términos ─────────────────────────────────────────────────────
/* Movido a modules/expedientes/index.js: renderTerminos */
// Texto de referencia para el modal de término: qué calidad tiene nuestro
// cliente en el asunto, según lo capturado en "Nuevo/Editar Expediente"
// (j.calidadCliente) — ayuda a decidir el selector de responsable de abajo
// sin tener que ir a revisar el expediente.
const _JU_CALIDAD_LABELS = {
  actor: 'Actor / Demandante / Promovente', demandado: 'Demandado',
  tercero: 'Tercero interesado', ofendido: 'Ofendido / Víctima',
  imputado: 'Denunciado / Imputado', otro: 'Otro'
};
/* Movido a modules/clientes/index.js: _juActualizarHintResponsable */
let _terminoEditIdx = null;
/* Movido a modules/clientes/index.js: abrirNuevoTermino */
/* Movido a modules/clientes/index.js: editarTermino */
// ── Calculadora de vencimiento dentro del modal de término ────────────────
// Llena el <select> del catálogo de plazos la primera vez que se abre.
/* Movido a modules/core/index.js: _juLlenarCatalogoPlazos */
/* Movido a modules/core/index.js: _juPlazoCatCambio */
/* Movido a modules/core/index.js: _juRecalcularVenc */

/* Movido a modules/expedientes/index.js: guardarTermino */
/* Movido a modules/expedientes/index.js: toggleTermino */
/* Movido a modules/expedientes/index.js: eliminarTermino */
// ─── Vincular Carpeta Drive ───────────────────────────────────────
/* Movido a modules/expedientes/index.js: abrirVinculacionDrive */
// ═══ EDITAR CONTROL INTERNO DEL EXPEDIENTE ═══
// Identificador único del despacho para localizar físicamente la carpeta del juicio.
/* Movido a modules/expedientes/index.js: editarControlInterno */
// ═══ DESVINCULAR CARPETA DRIVE DEL JUICIO ═══
/* Movido a modules/expedientes/index.js: desvincularCarpetaDrive */
/* Movido a modules/clientes/index.js: cargarCarpetasDrive */
// ─── Subir PDF al juicio (Supabase Storage) ──────────────────────
/* Movido a modules/expedientes/index.js: subirPDFaJuicio */
/* Movido a modules/expedientes/index.js: renderCarpetasDriveModal */
/* Movido a modules/expedientes/index.js: filtrarCarpetasDrive */
/* Movido a modules/expedientes/index.js: seleccionarCarpetaDrive */
/* Movido a modules/expedientes/index.js: confirmarVinculacionDrive */
// ─── Vincular Folio de Recibo ─────────────────────────────────────
/* Movido a modules/recibos/index.js: abrirVinculacionFolio */
/* Movido a modules/recibos/index.js: filtrarFoliosVinculacion */
/* Movido a modules/caja/index.js: renderFoliosVinculacion */
/* Movido a modules/recibos/index.js: vincularFolioRecibo */
/* Movido a modules/caja/index.js: renderFolioReciboDetalle */
// ════════════════════════════════════════════════════════════════
// VINCULAR RECIBO CON CONTROL DE ARCHIVO — Solo interno, no imprime
// ════════════════════════════════════════════════════════════════
let _carpetaVinculadaActual = null;
/* Movido a modules/recibos/index.js: abrirVincularArchivo */
/* Movido a modules/expedientes/index.js: mVAFiltrar */
/* Movido a modules/caja/index.js: _getInfoPagoCarpeta */
/* Movido a modules/recibos/index.js: seleccionarCarpetaArchivo */
/* Movido a modules/recibos/index.js: desvincularArchivo */
// Cierra el modal de Vincular Archivo y, si se abrió desde la Ficha del Folio
// (botón "Exp. Digital" en folios no vehiculares, que cierra la ficha antes de
// abrir este modal), la reabre — mismo patrón que cerrarExpDigital/cerrarContabPDF.
/* Movido a modules/recibos/index.js: cerrarVincularArchivo */
/* Movido a modules/clientes/index.js: _actualizarBadgeArchivoVinculado */
/* Movido a modules/recibos/index.js: actualizarBadgeArchivoDesdeRecibo */
/* Movido a modules/recibos/index.js: saveJuicios */
// ═══ PENDIENTES ═══
/* Movido a modules/core/index.js: setPF */
/* Movido a modules/core/index.js: verPendResueltos */
// Borra para siempre TODOS los pendientes resueltos actuales, sin esperar
// los 35 días — pensado para limpiar pruebas o vaciar el respaldo a mano.
// Los números de ficha de los borrados NO se reutilizan (política normal:
// un número nunca se vuelve a asignar, salvo excepción manual expresa).
/* Movido a modules/expedientes/index.js: vaciarResueltosDefinitivo */
// ── Inferir sección a partir de categoría legacy (para pendientes sin seccion explícita)
/* Movido a modules/expedientes/index.js: _inferirSeccion */
// ── Resolver la sección efectiva de un pendiente (con fallback)
/* Movido a modules/core/index.js: _seccionDe */
// ── Cambiar de sección (panel principal)
/* Movido a modules/expedientes/index.js: setPSec */
// ── Estatus automático por antigüedad (días desde el alta del pendiente) ──
// Reemplaza la necesidad de marcar prioridad a mano: la tarjeta escala sola
// mientras más tiempo lleve sin resolverse, así ningún pendiente viejo queda
// "oculto" con un estatus verde/normal solo porque nadie lo actualizó.
// Escala pedida por la Lic. Nahúm:
//   PENDIENTE  (amarillo #FFFF00): 0-29 días  (menos de 1 mes)
//   URGENTE    (naranja #FFA500): 30-59 días (1 a 2 meses)
//   CRÍTICO    (rojo    #FF0000): 60-89 días (2 a 3 meses)
//   ABANDONADO (negro   #000000): 90+ días   (más de 3 meses)
/* Movido a modules/core/index.js: _pendDiasAbierto */
// Mismo estilo que los botones de estado por entidad (Oaxaca/Edo.Méx/CDMX/
// Michoacán): el efecto de esos botones se logra con un fondo OSCURO y
// saturado del color (como si el color puro se viera encima de una capa
// negra), borde de un tono más claro del mismo color, y texto en un tono
// brillante del mismo color — nada de fondo plano brillante ni de badge
// pálido, que es justo lo que se perdía en la tarjeta antes.
// Mapa único reutilizado tanto para el cálculo automático por antigüedad
// como para la selección manual desde el botón "🔄 Estatus".
const _PEND_ESTADOS = {
  pendiente:  { key:'pendiente',  label:'PENDIENTE',  rango:'0-29 días',   icon:'📋', bg:'#5a4a08', border:'#9a8420', fg:'#f5dc70' },
  urgente:    { key:'urgente',    label:'URGENTE',    rango:'30-59 días',  icon:'⚠️', bg:'#5a3a0a', border:'#a8621a', fg:'#f5a855' },
  critico:    { key:'critico',    label:'CRÍTICO',    rango:'60-89 días',  icon:'🔴', bg:'#5a1a1a', border:'#aa2a2a', fg:'#f07a7a' },
  abandonado: { key:'abandonado', label:'ABANDONADO', rango:'90+ días',    icon:'🚫', bg:'#1c1c1c', border:'#4a4a4a', fg:'#d8d8d8' }
};
/* Movido a modules/expedientes/index.js: _pendEstadoPorClave */
/* Movido a modules/expedientes/index.js: _pendEstadoPorEdad */
// Botón "✈ Enviar" en las tarjetas de Pendientes de Placas: solo el
// administrador puede presionarlo; en cuanto lo hace, TODOS (empleadas
// incluidas) ven "✈ Enviado" en su lugar en esa misma tarjeta.
/* Movido a modules/administracion/index.js: _pendEsAdminGlobal */
/* Movido a modules/administracion/index.js: _pendMarcarEnviado */
// Estilos de la animación de envío — se inyectan una sola vez.
let _pendEstiloEnvioListo = false;
/* Movido a modules/core/index.js: _pendInyectarEstiloEnvio */
// Dibuja la animación del avión de papel (mismo ícono que queda fijo en
// "✈ Enviado") volando sobre una estela punteada azul marino, encima de la
// tarjeta del pendiente — sin desplazar ni recolorear ningún elemento ya
// existente. Al terminar (≈1.9s) llama cb() para refrescar la tarjeta con
// el estado final "Enviado" ya fijo.
/* Movido a modules/core/index.js: _pendAnimarEnvio */
/* Movido a modules/administracion/index.js: renderPend */
// Botón "🔄 Estatus" en la tarjeta de Pendientes (solo en Pendientes
// generales — en Placas este botón no existe, ver template de la tarjeta).
// Antes controlaba un campo (estatusTramite) que no se mostraba en ningún
// lado; ahora permite fijar A MANO el estatus por antigüedad (Pendiente/
// Urgente/Crítico/Abandonado) que se ve en el badge de la tarjeta, por si
// se necesita forzarlo antes de que cumpla los días correspondientes (o
// bajarlo). "🔄 Automático" regresa al cálculo por días.
/* Movido a modules/expedientes/index.js: _pendEstatus */
/* Movido a modules/expedientes/index.js: _placasVerDocFromCard */
// Caché en memoria de carpetas de Drive ya resueltas (root "Placas" y una
// por cliente) — evita repetir 2 búsquedas/creaciones en Drive cada vez que
// se adjunta un archivo más para el mismo cliente dentro de la misma sesión.
window._driveFolderCache = window._driveFolderCache || {};

/* Movido a modules/documentos/index.js: _placasAdjBtnEstado */

// ── Nombre del archivo en Drive ───────────────────────────────────────────
// FIX (a petición expresa, 11-ago-2026): antes se anteponía
// `Date.now()+'_'+azar+'_'` al nombre, así que en Drive se veía
// "1786303656857_b0e4_TRAMITE_DE_PLACAS.pdf". Ese sello garantizaba que dos
// archivos NUNCA se llamaran igual, lo que volvía imposible detectar que ya
// habías subido el mismo documento: se guardaban las dos copias en silencio.
// Ahora se conserva el nombre real (solo se limpian caracteres problemáticos)
// y la duplicidad se resuelve preguntando, no inventando nombres distintos.
/* Movido a modules/documentos/index.js: _placasNombreLimpio */
// Busca en la carpeta del cliente un archivo con exactamente ese nombre.
// Devuelve {id, name} si existe, o null. Ante cualquier fallo devuelve null
// (nunca bloquea la subida por un problema de consulta).
/* Movido a modules/clientes/index.js: _placasBuscarEnDrive */
// Nombre libre del tipo "documento (2).pdf", "documento (3).pdf"… para cuando
// el usuario decide conservar AMBOS archivos.
/* Movido a modules/clientes/index.js: _placasNombreCopiaLibre */
// Sube UN archivo a Drive con timeout + 1 reintento acotado (no infinito) —
// si el primer intento falla o tarda, se reintenta una sola vez antes de
// rendirse y caer al respaldo base64. Devuelve {id, nombreArchivo} o null.
// `reemplazarId` (opcional): actualiza el contenido de ese archivo existente
// en vez de crear uno nuevo, conservando su nombre, su id y su enlace.
// Umbral a partir del cual hay que usar subida RESUMIBLE. La subida directa
// (multipart) de la API de Drive solo está soportada para cargas pequeñas
// (~5 MB); con archivos grandes falla o se corta. Por eso un PDF de 30 MB
// nunca podía llegar a Drive con el método anterior.
const _DRIVE_UMBRAL_RESUMIBLE = 4 * 1024 * 1024;

// PUT del contenido con XMLHttpRequest para poder reportar el porcentaje real
// de avance (fetch no expone progreso de subida).
/* Movido a modules/documentos/index.js: _placasPutConProgreso */

// Subida resumible: primero se abre una "sesión" (solo metadatos) y Google
// devuelve una URL temporal; el contenido se manda después a esa URL.
/* Movido a modules/clientes/index.js: _placasSubirResumibleDrive */

/* Movido a modules/clientes/index.js: _placasSubirArchivoDrive */
// Diálogo de duplicado — 3 opciones reales (confirm() solo permite 2).
// Devuelve 'reemplazar' | 'copia' | 'cancelar'.
/* Movido a modules/clientes/index.js: _placasPreguntarDuplicado */

/* Movido a modules/documentos/index.js: _placasLeerBase64 */

// Marca el folio como "carpeta vinculada en Drive" automáticamente en cuanto
// se sube EXITOSAMENTE al menos un archivo a esa carpeta — ya no hace falta
// un clic aparte en "Vincular Carpeta en Drive": si la carpeta ya existe y
// tiene contenido, ya está vinculada de facto. El botón manual de Expediente
// Digital solo queda para el caso de crear una carpeta vacía de antemano,
// antes de adjuntar el primer archivo.
/* Movido a modules/recibos/index.js: _marcarExpDigitalVinculado */

// Vuelve a localizar el pendiente SIEMPRE de forma fresca dentro de
// D.pendientes. Es indispensable porque entre que el usuario da clic en
// "+ Adjuntar" y termina de elegir el archivo en el explorador pueden pasar
// muchos segundos, y en ese lapso una sincronización de fondo REEMPLAZA el
// arreglo D.pendientes completo. La referencia vieja queda huérfana: se le
// empujaban los documentos a un objeto que ya no forma parte de los datos, y
// al guardar no se persistía nada (síntoma: "elijo el archivo y no pasa nada").
/* Movido a modules/expedientes/index.js: _placasResolverPend */
// Aviso fijo de progreso (el toast normal se esconde solo a los 3.2s, muy poco
// para una subida). Se llama con null para quitarlo.
/* Movido a modules/documentos/index.js: _placasProgreso */
/* Movido a modules/administracion/index.js: _placasAdjuntarDoc */
/* Movido a modules/recibos/index.js: toggleP */
// ── Purga definitiva de pendientes resueltos con más de 10 días ────────────
// Complementa toggleP(): resolver ya no borra al instante, solo oculta de
// "Activos" y guarda fechaResuelto. Esta función corre en cada renderPend()
// y borra para siempre (ya sin marcha atrás) los que llevan >10 días
// resueltos — así "Resueltos" no crece sin límite.
/* Movido a modules/expedientes/index.js: _pendPurgarResueltosViejos */
// ─── ABRIR MODAL PENDIENTE (nuevo o editar) ─────────────────────────────────
/* Movido a modules/recibos/index.js: abrirPendiente */
/* Movido a modules/documentos/index.js: guardarPend */
// ─── DETALLE DE PENDIENTE (clic en la card) ─────────────────────────────────
/* Movido a modules/expedientes/index.js: _verDetallePendiente */
// Construir el objeto base preservando metadatos previos (resuelto, fechas, etc.)
/* Movido a modules/expedientes/index.js: _construirPendienteBase */
// Guardar el pendiente (insertar/actualizar) y refrescar la UI
/* Movido a modules/expedientes/index.js: _persistirPendiente */
/* Movido a modules/contabilidad/index.js: eliminarPend */
// ═══════════════════════════════════════════════════════════════
// PENDIENTES DE PLACAS — bloque exclusivo del modal
// ═══════════════════════════════════════════════════════════════
// Estado en memoria mientras está abierto el modal de pendiente
let _pPlacasState = {
  tipo: '',                  // 'alta'|'baja'|'cambio_propietario'|'reemplacamiento'
  reciboFolio: '',           // folio de recibo vehicular vinculado
  documentos: []             // [{nombre, tipo, dataURL, fechaSubida, tamano}]
};
// Mostrar/ocultar bloques de sección — solo se muestra el bloque activo.
// Los campos genéricos (Tarea, Persona, Prioridad, Responsable, Fecha,
// Carpeta, Subcategoría, Observaciones) están siempre ocultos cuando hay
// un bloque especializado activo (todas las secciones tienen uno).
/* Movido a modules/expedientes/index.js: pSecCambio */
// Cargar datos de placas desde un pendiente existente (al abrir modal en modo edición)
/* Movido a modules/recibos/index.js: _pPlacasCargar */
// Limpiar bloque placas (al crear nuevo)
/* Movido a modules/recibos/index.js: _pPlacasLimpiar */
// Recopilar datos del bloque placas al guardar
/* Movido a modules/recibos/index.js: _pPlacasRecopilar */
// Selector de tipo de trámite vehicular
/* Movido a modules/documentos/index.js: setPlacasTipo */
// ── Vinculación con recibo vehicular ─────────────────────────────
/* Movido a modules/recibos/index.js: abrirSelectorReciboVehicular */
/* Movido a modules/recibos/index.js: renderSelectorReciboVehicular */
/* Movido a modules/clientes/index.js: vincularReciboVehicular */
/* Movido a modules/recibos/index.js: pPlacasDesvincular */
/* Movido a modules/recibos/index.js: _pPlacasActualizarInfoRecibo */
// ── Adjuntar documentos escaneados ───────────────────────────────
/* Movido a modules/expedientes/index.js: pPlacasAdjuntar */
/* Movido a modules/documentos/index.js: _pPlacasMostrarResultadoSubida */
/* Movido a modules/documentos/index.js: _pPlacasFormatearTamano */
/* Movido a modules/documentos/index.js: _pPlacasRenderDocs */
/* Movido a modules/documentos/index.js: pPlacasVerDoc */
/* Movido a modules/clientes/index.js: _pPlacasVerExpediente */
/* Movido a modules/recibos/index.js: _pPlacasAbrirR2 */
/* Movido a modules/expedientes/index.js: pPlacasEliminarDoc */
// Abrir el recibo vinculado en su panel (modo consulta)
/* Movido a modules/recibos/index.js: _irAReciboVinculado */
// ═══════════════════════════════════════════════════════════════
// PENDIENTES DE ESCRITURAS — bloque exclusivo del modal
// ═══════════════════════════════════════════════════════════════
let _pEscState = { documentos: [] };
/* Movido a modules/documentos/index.js: _pEscCargar */
/* Movido a modules/recibos/index.js: _pEscLimpiar */
/* Movido a modules/documentos/index.js: _pEscRecopilar */
// Calcula automáticamente el resto por cobrar
/* Movido a modules/recibos/index.js: pEscActualizarResto */
// Adjuntar archivos a Escritura — reusa la misma lógica de validación que Placas
/* Movido a modules/documentos/index.js: pEscAdjuntar */
/* Movido a modules/documentos/index.js: _pEscRenderDocs */
/* Movido a modules/documentos/index.js: pEscVerDoc */
/* Movido a modules/expedientes/index.js: pEscEliminarDoc */
// Autocompletado nombre comprador (busca clientes en cualquier recibo)
/* Movido a modules/recibos/index.js: pEscCompradorInput */
// ═══════════════════════════════════════════════════════════════
// PENDIENTES DE JUICIOS — bloque exclusivo del modal
// ═══════════════════════════════════════════════════════════════
let _pJuiState = { juicioIdx: -1 }; // índice del juicio en D.juicios al que se vincula
/* Movido a modules/clientes/index.js: _pJuiCargar */
/* Movido a modules/clientes/index.js: _pJuiLimpiar */
/* Movido a modules/clientes/index.js: _pJuiRecopilar */
/* Movido a modules/expedientes/index.js: abrirSelectorJuicio */
/* Movido a modules/expedientes/index.js: renderSelectorJuicio */
/* Movido a modules/clientes/index.js: vincularJuicio */
/* Movido a modules/expedientes/index.js: pJuiDesvincular */
/* Movido a modules/expedientes/index.js: _pJuiActualizarVinculacionUI */
// Navegar al detalle del juicio en Juicios
/* Movido a modules/expedientes/index.js: _irAJuicio */
// ═══════════════════════════════════════════════════════════════
// PENDIENTES DE OTROS — bloque exclusivo del modal
// ═══════════════════════════════════════════════════════════════
/* Movido a modules/core/index.js: _pOtrosCargar */
/* Movido a modules/core/index.js: _pOtrosLimpiar */
/* Movido a modules/core/index.js: _pOtrosRecopilar */
// ═══════════════════════════════════════════════════════════════
// HELPERS COMPARTIDOS para adjuntar/ver documentos
// ═══════════════════════════════════════════════════════════════
/* Movido a modules/expedientes/index.js: _pAdjuntarArchivos */
// Contexto actual del visor de documentos
window._docPreviewCtx = null;
window._docZoomLevel  = 1;
const _DOC_ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
// Abre el modal con soporte de navegación entre documentos del mismo grupo
// lista: array de documentos (opcional). Si se pasa, se activan las flechas.
/* Movido a modules/expedientes/index.js: _pVerDoc */
/* Movido a modules/documentos/index.js: _pVerDocRender */
// ── Zoom + Pan ────────────────────────────────────────────────
window._docPanOffset = { x:0, y:0 };
/* Movido a modules/core/index.js: _docZoom */
/* Movido a modules/core/index.js: _docZoomReset */
/* Movido a modules/core/index.js: _docZoomApply */
/* Movido a modules/core/index.js: _docZoomUpdateLabel */
// ── Pan (arrastrar imagen con zoom) ──────────────────────────
/* Movido a modules/core/index.js: _docPanInit */
// Navegación ◀ ▶
/* Movido a modules/documentos/index.js: _pVerDocNav */
// Teclado: flechas, +/-, Escape
document.addEventListener('keydown', function(e){
  const m = document.getElementById('mDocPreview');
  if (!m || !m.classList.contains('show')) return;
  if (e.key === 'ArrowLeft')  _pVerDocNav(-1);
  if (e.key === 'ArrowRight') _pVerDocNav(1);
  if (e.key === '+'||e.key==='=') _docZoom(1);
  if (e.key === '-')           _docZoom(-1);
  if (e.key === '0')           _docZoomReset();
  if (e.key === 'Escape')      cerrar('mDocPreview');
});
/* Movido a modules/documentos/index.js: _pVerDocDescargar */
/* Movido a modules/expedientes/index.js: _pVerDocEliminar */
// ═══ PENDIENTE — autocompletado de nombre con folios ═══
/* Movido a modules/clientes/index.js: pPersonaInput */
/* Movido a modules/recibos/index.js: pSeleccionarPersona */
/* Movido a modules/recibos/index.js: pLimpiarFolioVinculado */
// ══════════════════════════════════════════════════════════════════
// AUTOCOMPLETADO DE NOMBRE EN BLOQUE PLACAS
// Busca clientes en recibos vehiculares y al seleccionar uno auto-vincula el recibo.
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/recibos/index.js: pPlacasNombreInput */
/* Movido a modules/recibos/index.js: pPlacasSelNombre */
// ══════════════════════════════════════════════════════════════════
// BÚSQUEDA GLOBAL
// ══════════════════════════════════════════════════════════════════
let _gsTimer=null;
/* Movido a modules/recibos/index.js: globalSearch */
/* Movido a modules/core/index.js: _gsClick */
/* Movido a modules/core/index.js: globalSearchCerrar */
/* Movido a modules/core/index.js: globalSearchKey */
// Cerrar al hacer clic fuera
document.addEventListener('click',function(e){
  if(!document.getElementById('global-search-wrap').contains(e.target)){
    document.getElementById('global-search-results').classList.remove('show');
  }
});
// ══════════════════════════════════════════════════════════════════════
// BÚSQUEDA EN LENGUAJE NATURAL CON IA (Groq)
// Se activa escribiendo "?" al inicio del buscador global
// Ej: "? clientes con saldo pendiente", "? juicios urgentes"
// ══════════════════════════════════════════════════════════════════════
let _groqSearchTimer = null;
// Envolver globalSearch original para interceptar el modo "?"
const _globalSearchOriginal = globalSearch;
globalSearch = function(q) {
  q = (q || '').trim();
  if (q.startsWith('?') && q.length > 2) {
    document.getElementById('global-search-icon').textContent = '✨';
    clearTimeout(_groqSearchTimer);
    _groqSearchTimer = setTimeout(() => groqBuscarIA(q.slice(1).trim()), 600);
    return;
  }
  document.getElementById('global-search-icon').textContent = '🔍';
  _globalSearchOriginal(q);
};
/* Movido a modules/caja/index.js: groqBuscarIA */
/* Movido a modules/integraciones/index.js: _groqGsClick */
// ═══ FIN BÚSQUEDA IA ═══
// ══════════════════════════════════════════════════════════════
// RECORDATORIO DE TÉRMINOS — pantalla principal
// ══════════════════════════════════════════════════════════════
/* Movido a modules/expedientes/index.js: renderVencimientos */
/* Movido a modules/expedientes/index.js: badges */
// ═══ RELOJ ═══
/* Movido a modules/core/index.js: reloj */
// ═══ PERSISTENCIA ═══
// ═══ REGISTRO DEDUPLICADO DE MOVIMIENTOS ═══
// Unica puerta de entrada para insertar movimientos en D.movimientos.
// Garantiza que nunca existan dos movimientos para el mismo folio+fecha+monto+fuente.
// Devuelve true si se inserto, false si ya existia (duplicado ignorado).
/* Movido a modules/contabilidad/index.js: _registrarMovimiento */
// ═══ AUDITORÍA CONTABLE REAL (para MONITOR) ═══════════════════════════════
// Registra en sesiones_log (tabla real de Supabase, ya existente, nunca usada
// hasta ahora) quién causó cada alta/baja/restauración de un movimiento de
// Contabilidad y A QUÉ HORA REAL ocurrió — sin importar si el movimiento en
// sí quedó fechado de forma retroactiva. created_at lo pone el propio
// servidor de Supabase (default now()), así que esa hora nunca se puede
// alterar desde el navegador. Fire-and-forget: nunca bloquea ni rompe el
// flujo normal si falla (solo se pierde ese renglón de bitácora).
/* Movido a modules/administracion/index.js: _auditoriaRegistrar */
// ── Borrado AUDITADO de movimientos ───────────────────────────────────────
// Reemplaza el patrón `D.movimientos = D.movimientos.filter(conservar)` en todos
// los flujos que dan de baja movimientos de Contabilidad. Hace exactamente lo
// mismo, pero antes de descartarlos deja constancia de cada uno en la Bitácora
// Real del MONITOR (sesiones_log, con hora real de servidor). `conservar` debe
// devolver true para los movimientos que SE QUEDAN — misma semántica que filter.
// Devuelve el número de movimientos retirados.
/* Movido a modules/administracion/index.js: _filtrarMovsAuditado */
window._filtrarMovsAuditado = _filtrarMovsAuditado;
// NOTA — vigilante automático RETIRADO (10-ago-2026). Se probó un observador
// periódico que comparaba la lista de movimientos contra una foto previa para
// cazar bajas sin registrar. En producción falló: tomaba su primera foto antes
// de que terminara de bajar la información de Supabase, así que al llegar los
// datos reales los leyó como altas nuevas y metió cientos de renglones falsos
// en la Bitácora Real. La idea es mala de raíz — desde el cliente no se puede
// distinguir con certeza "el usuario borró esto" de "esto todavía no cargaba"
// o "esto lo borró otra persona en su equipo". El rastro correcto se consigue
// auditando cada flujo en su punto exacto (los 12 call sites de
// _filtrarMovsAuditado más arriba), que es lo que quedó vigente.
/* Movido a modules/integraciones/index.js: save */
// Función global para excluir folio de contabilidad (accesible desde consola)
window.lexExcluirFolioContabilidad = function(folioNum) {
  if (!D.recibosExcluidosCaja) D.recibosExcluidosCaja = [];
  // Guardar como string (normalizado) para comparación consistente
  var folioStr = String(folioNum);
  if (!D.recibosExcluidosCaja.map(String).includes(folioStr)) D.recibosExcluidosCaja.push(folioStr);
  if (typeof REC !== 'undefined' && REC.recibos) {
    REC.recibos = REC.recibos.filter(function(r){ return r && r.folio != folioNum; });
  }
  if (typeof appData !== 'undefined' && appData.recibos) {
    appData.recibos = appData.recibos.filter(function(r){ return r && r.folio != folioNum; });
  }
  _filtrarMovsAuditado(function(m){
    return !(m && m.fuente==='recibo' && m.folio==folioNum);
  }, 'lexExcluirFolioContabilidad', { folio: folioNum });
  _ultimoSyncPropio = Date.now();
  syncEstadoSupabase().catch(function(e){ registrarError('Promise catch vacio', e); });
  if(typeof renderContab==='function') renderContab();
  if(typeof renderCaja==='function') renderCaja();
  if(typeof renderHistorial==='function') renderHistorial();
  if(typeof badges==='function') badges();
  console.log('✅ Folio '+folioNum+' excluido de contabilidad y sincronizado');
  if(typeof toast==='function') toast('✅ Folio '+folioNum+' eliminado de contabilidad', 'ok');
};
// Quita un folio de la lista negra de contabilidad (recibosExcluidosCaja) y lo restaura
window.lexRestaurarFolioContabilidad = function(folioNum) {
  if (!D.recibosExcluidosCaja) { console.log('No hay exclusiones registradas.'); return; }
  var folioStr = String(folioNum);
  var antes = D.recibosExcluidosCaja.length;
  D.recibosExcluidosCaja = D.recibosExcluidosCaja.filter(function(f){ return String(f) !== folioStr; });
  if (D.recibosExcluidosCaja.length === antes) {
    console.warn('[lexRestaurarFolioContabilidad] Folio '+folioNum+' no estaba en la lista de exclusión.');
    if(typeof toast==='function') toast('Folio '+folioNum+' no estaba excluido', 'warn');
    return;
  }
  _ultimoSyncPropio = Date.now();
  syncEstadoSupabase().catch(function(e){ registrarError('Promise catch vacio', e); });
  if(typeof renderContab==='function') renderContab();
  if(typeof renderCaja==='function') renderCaja();
  if(typeof renderHistorial==='function') renderHistorial();
  if(typeof badges==='function') badges();
  console.log('✅ Folio '+folioNum+' restaurado en contabilidad y sincronizado con Supabase');
  if(typeof toast==='function') toast('✅ Folio '+folioNum+' restaurado en contabilidad', 'ok');
};
// Quita el tombstone de un folio+letra de la lista local y de Supabase.
// Úsala en consola ANTES de restaurar el recibo por el panel "Restaurar desde PDF":
//   lexQuitarTombstone(3, 'A')   → limpia folio 3A
// Después de ejecutarla, usa el panel de restauración para re-registrar el recibo.
window.lexQuitarTombstone = async function(folioNum, letra) {
  letra = (letra || 'A').toUpperCase();
  var folioStr = String(folioNum);
  // 1. Quitar de memoria local
  if (Array.isArray(appData.folios_eliminados)) {
    var antes = appData.folios_eliminados.length;
    appData.folios_eliminados = appData.folios_eliminados.filter(function(t){
      return !(String(t.folio) === folioStr && (t.letra||'A') === letra);
    });
    console.log('[lexQuitarTombstone] Tombstones locales eliminados:', antes - appData.folios_eliminados.length);
  }
  // 2. Quitar de Supabase directamente
  try {
    var _r = await window.SB.from('app_state').select('recibos').eq('despacho_id', window.SB_DESPACHO_ID).maybeSingle();
    if (_r.data && _r.data.recibos) {
      var dat = JSON.parse(JSON.stringify(_r.data.recibos));
      var antSB = (dat.folios_eliminados||[]).length;
      dat.folios_eliminados = (dat.folios_eliminados||[]).filter(function(t){
        return !(String(t.folio)===folioStr && (t.letra||'A')===letra);
      });
      await window.SB.from('app_state').update({ recibos: dat }).eq('despacho_id', window.SB_DESPACHO_ID);
      console.log('[lexQuitarTombstone] Tombstones en Supabase eliminados:', antSB - dat.folios_eliminados.length);
    }
  } catch(e) { console.error('[lexQuitarTombstone] Error Supabase:', e); return; }
  if(typeof toast==='function') toast('✅ Tombstone de folio '+folioNum+letra+' eliminado — ya puedes restaurar el recibo', 'ok');
  console.log('✅ Tombstone folio '+folioNum+letra+' limpiado. Ahora usa el panel "Restaurar desde PDF" en Herramientas > Restaurar recibo desde PDF.');
};

// ══════════════════════════════════════════════════════════════════════════════
// LIMPIEZA DE RASTROS DE MOVIMIENTOS — elimina movimientos huérfanos de folios
// que ya no existen en appData.recibos. Se llama automáticamente al eliminar
// un recibo, y también está disponible como botón en el scanner SCANSYS.
//
// Parámetros:
//   folioNum  — número de folio (ej: 4)
//   letras    — array de letras a limpiar (ej: ['B','C']), o null para TODAS
//               las letras que no tengan recibo en appData.recibos
//
// Retorna: { eliminados: N, descripcion: '...' }
// ══════════════════════════════════════════════════════════════════════════════
window.limpiarRastrosMovimientos = async function(folioNum, letras) {
  folioNum = parseInt(folioNum, 10);
  if (!folioNum) return { eliminados: 0, descripcion: 'Folio inválido' };

  var recibosActivos = (typeof appData !== 'undefined' && Array.isArray(appData.recibos))
    ? appData.recibos : [];

  // Letras que SÍ tienen recibo activo para este folio
  var letrasConRecibo = new Set(
    recibosActivos
      .filter(function(r){ return r && parseInt(r.folio) === folioNum; })
      .map(function(r){ return (r.letra || 'A').toUpperCase(); })
  );

  // Si se pasan letras explícitas, solo limpiar esas; si no, limpiar todo lo que no tenga recibo
  var letrasALimpiar = letras
    ? letras.map(function(l){ return l.toUpperCase(); })
    : null; // null = automático

  if (!Array.isArray(D.movimientos)) { return { eliminados: 0, descripcion: 'Sin movimientos' }; }

  var antes = D.movimientos.length;
  _filtrarMovsAuditado(function(m) {
    if (!m) return false;
    var mismoFolio = (m.fuente === 'recibo' && parseInt(m.folio) === folioNum);
    if (!mismoFolio) return true; // no es de este folio → conservar

    var letraM = (m.letra || 'A').toUpperCase();
    if (letrasConRecibo.has(letraM)) return true; // tiene recibo activo → conservar

    if (letrasALimpiar && !letrasALimpiar.includes(letraM)) return true; // no está en la lista → conservar

    return false; // ← eliminar: movimiento huérfano sin recibo correspondiente
  }, 'limpiarRastrosMovimientos (huérfanos)', { folio: folioNum });

  // También limpiar por ID de recibo genérico si no quedan versiones del folio
  if (letrasConRecibo.size === 0) {
    var folioStr = typeof folioFormato === 'function' ? folioFormato(folioNum) : String(folioNum);
    _filtrarMovsAuditado(function(m) {
      if (!m) return false;
      var porId = (m.id||'').includes('REC-'+folioNum) ||
                  (m.id||'').includes('M-REC-'+folioNum) ||
                  (m.id||'').includes('recibo-'+folioNum) ||
                  (m.id||'').includes('rec-'+folioNum);
      var porDesc = (m.descripcion||'').includes('#'+folioStr);
      return !(porId || porDesc);
    }, 'limpiarRastrosMovimientos (sin versiones)', { folio: folioNum });

    // Limpiar historialPagos si no quedan versiones
    if (typeof appData !== 'undefined' && appData.historialPagos) {
      delete appData.historialPagos[folioNum];
    }
    // Limpiar snapshots
    if (typeof D !== 'undefined' && Array.isArray(D.snapshotsRecibos)) {
      D.snapshotsRecibos = D.snapshotsRecibos.filter(function(s){ return parseInt(s.folio) !== folioNum; });
    }
  }

  // ── Barrido de fantasmas en letras VIVAS (estado anticipo) ───────────────
  // Movimientos auto-recuperados/protección (id M-RECUP-/M-PROT-) con estatus
  // Liquidado/Liquidación sobre una letra que SÍ tiene recibo, pero cuyo recibo
  // está en estado anticipo (saldo > 0), son contradictorios: son el rastro del
  // folio viejo ya liquidado. Se purgan; la letra viva conserva su anticipo real
  // (el legítimo M-REC-… queda intacto, y _protegerMovimientosRecibo regenera el
  // Anticipo correcto si hiciera falta).
  _filtrarMovsAuditado(function(m) {
    if (!m) return false;
    if (m.fuente !== 'recibo' || parseInt(m.folio) !== folioNum) return true;
    var letraM = (m.letra || 'A').toUpperCase();
    if (!letrasConRecibo.has(letraM)) return true; // letras huérfanas ya tratadas arriba
    var esFantasma = /^M-(RECUP|PROT)-/.test(m.id || '');
    var esLiq = (m.estatus === 'Liquidado' || m.estatus === 'Liquidación');
    if (!(esFantasma && esLiq)) return true;
    var recLetra = recibosActivos.find(function(r){
      return r && parseInt(r.folio) === folioNum && (r.letra || 'A').toUpperCase() === letraM;
    });
    var saldoRec = recLetra ? parseFloat(recLetra.saldoPendiente) : NaN;
    if (!isNaN(saldoRec) && saldoRec > 0) return false; // ← purgar fantasma de liquidación
    return true;
  }, 'limpiarRastrosMovimientos (fantasmas de liquidación)', { folio: folioNum });

  var eliminados = antes - D.movimientos.length;

  // Notificar al monitor de SCANSYS que estas eliminaciones son intencionales del sistema
  // (limpieza de movimientos huerfanos) — no son perdidas accidentales de datos
  if (eliminados > 0) {
    window._adminDeletedMovs = (window._adminDeletedMovs || 0) + eliminados;
  }

  // Limpiar tombstones del folio si ya no hay ningun recibo activo
  if (letrasConRecibo.size === 0 && typeof appData !== 'undefined' && Array.isArray(appData.folios_eliminados)) {
    appData.folios_eliminados = appData.folios_eliminados.filter(function(t){
      return parseInt(t.folio) !== folioNum;
    });
  }

  // Persistir cambios — CRÍTICO: debe escribir la columna `data` (movimientos),
  // no solo `recibos`. actualizarArchivoControl() solo sube `recibos`; por eso
  // antes los movimientos limpiados reaparecían al recargar (Supabase es la única
  // fuente de verdad y conservaba data.movimientos). syncEstadoSupabase() sube
  // `data` + `recibos` y recompone los movimientos de recibo legítimos.
  try {
    if (window.SB && window.SB_DESPACHO_ID && typeof syncEstadoSupabase === 'function') {
      await syncEstadoSupabase();
    } else if (typeof actualizarArchivoControl === 'function') {
      await actualizarArchivoControl();
    }
  } catch(e) { console.warn('[limpiarRastrosMovimientos] Error al persistir:', e); }

  // Refrescar UI
  if (typeof renderCaja    === 'function') renderCaja();
  if (typeof renderContab  === 'function') renderContab();
  if (typeof renderHistorial === 'function') renderHistorial();
  if (typeof badges        === 'function') badges();

  var desc = 'Folio ' + folioNum + ': ' + eliminados + ' movimiento(s) huérfano(s) eliminado(s)'
    + (letrasConRecibo.size === 0 ? ' + historial y snapshots limpiados' : '');
  console.log('[limpiarRastrosMovimientos]', desc);
  return { eliminados: eliminados, descripcion: desc };
};

// Restaura la inmutabilidad de todos los recibos A que fueron modificados retroactivamente
// cuando se generó un B (abono, liquidación o cancelación).
// Uso: lexRestaurarInmutabilidadRecibos(true) → vista previa sin cambios
//      lexRestaurarInmutabilidadRecibos()     → aplica y guarda
window.lexRestaurarInmutabilidadRecibos = function(dryRun) {
  if (!appData || !Array.isArray(appData.recibos)) {
    console.warn('[lexRestaurarInmutabilidadRecibos] appData.recibos no disponible'); return;
  }
  // Set de folios que tienen al menos una versión B (esActualizacion:true)
  var foliosConB = new Set(
    (appData.recibos).filter(function(v){ return v && v.esActualizacion; }).map(function(v){ return Number(v.folio); })
  );
  var cambios = [];

  appData.recibos.forEach(function(r, idx) {
    if (!r || r.esActualizacion || r.esComplemento) return;
    if (!foliosConB.has(Number(r.folio))) return; // sin B → A original intacto, no tocar

    var totalOrig    = parseFloat(r.total)   || 0;
    var anticipoOrig = parseFloat(r.anticipo) || 0;
    var saldoOrig    = Math.max(0, totalOrig - anticipoOrig);
    var diff = {};

    // Corregir saldo si fue sobreescrito retroactivamente (solo aplica cuando hay saldo original > 0)
    if (saldoOrig > 0) {
      if (parseFloat(r.saldoPendiente) !== saldoOrig) diff.saldoPendiente = saldoOrig;
      if (parseFloat(r.saldoNuevo)     !== saldoOrig) diff.saldoNuevo     = saldoOrig;
      if (r.liquidado === true)                        diff.liquidado      = false;
    }

    // Corregir cancelado si fue pegado al A desde el B
    if (r.cancelado) {
      var bCancelado = appData.recibos.some(function(v){
        return v && v.esActualizacion && Number(v.folio) === Number(r.folio) && v.cancelado;
      });
      if (bCancelado) {
        diff.cancelado                          = false;
        diff._del_fechaCancelacion              = true;
        diff._del_motivoCancelacion             = true;
        diff._del_cancelacionTipo               = true;
        diff._del_cancelacionMonto              = true;
        diff._del_cancelacionConceptoInterno    = true;
      }
    }

    if (!Object.keys(diff).length) return;
    cambios.push({ idx: idx, folio: r.folio, letra: r.letra || 'A', diff: diff });

    if (!dryRun) {
      var restored = Object.assign({}, r, diff);
      ['fechaCancelacion','motivoCancelacion','cancelacionTipo','cancelacionMonto','cancelacionConceptoInterno'].forEach(function(k){
        if (diff['_del_' + k]) { delete restored[k]; delete restored['_del_' + k]; }
      });
      appData.recibos[idx] = restored;
    }
  });

  if (!cambios.length) {
    console.log('[lexRestaurarInmutabilidadRecibos] ✅ No se encontraron recibos A corruptos.');
    if(typeof toast === 'function') toast('✅ Todos los recibos A ya están en estado original', 'ok');
    return [];
  }

  console.log('[lexRestaurarInmutabilidadRecibos] ' + (dryRun ? '[DRY RUN] ' : '') + cambios.length + ' recibo(s) con correcciones:');
  console.table(cambios.map(function(c){ return { folio: c.folio, letra: c.letra, cambios: JSON.stringify(c.diff) }; }));

  if (dryRun) {
    console.log('Llama lexRestaurarInmutabilidadRecibos() sin argumentos para aplicar.');
    return cambios;
  }

  if (typeof save === 'function') save();
  if (typeof actualizarArchivoControl === 'function') actualizarArchivoControl();
  if(typeof toast === 'function') toast('✅ ' + cambios.length + ' recibo(s) A restaurados a su estado original', 'ok');
  return cambios;
};

// Limpia todo el caché y respaldos de localStorage — los datos se cargarán desde Supabase y R2
window.limpiarCacheLocal = function() {
  var clavesMantener = new Set([
    'empleado_email', 'empleado_nombre',
    'drive_token', 'drive_expiry',
    'lex-supabase-auth', 'lex-supabase-session'
  ]);
  var eliminadas = 0;
  // Recopilar todas las claves a eliminar (no se puede iterar y borrar a la vez)
  var clavesABorrar = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && !clavesMantener.has(k)) clavesABorrar.push(k);
  }
  clavesABorrar.forEach(function(k) {
    try { localStorage.removeItem(k); eliminadas++; } catch(e) {}
  });
  console.log('[limpiarCacheLocal] Eliminadas ' + eliminadas + ' entradas de localStorage. La próxima carga tomará datos de Supabase.');
  if(typeof toast==='function') toast('🧹 Caché local limpiado ('+eliminadas+' entradas). Recargando...', 'ok');
  setTimeout(function(){ window.location.reload(); }, 1500);
};
// ═══ FUNCIÓN UNIFICADA DE GUARDADO ═══
// Guarda el estado completo en Supabase (debounced)
// 8 veces en el código causando triples llamadas redundantes y race conditions.
// Esta función orquesta el guardado en el orden correcto y devuelve una promesa
// que resuelve cuando AMBOS archivos de Drive están actualizados.
/* Movido a modules/expedientes/index.js: guardarTodo */
// ═══ SISTEMA DE RESPALDOS LOCALES ROTATIVOS ═══
// Mantiene los últimos N respaldos de cada tipo de dato.
// Si Drive falla o algo se corrompe, se puede restaurar el último estado conocido.
// Los respaldos se guardan en localStorage con timestamp.
const BACKUP_MAX = 5;       // últimos 5 respaldos de cada tipo
const BACKUP_MIN_INTERVAL_MS = 30000; // mínimo 30s entre respaldos del mismo tipo
const _lastBackupTime = {};
/* Movido a modules/documentos/index.js: backupLocal */
/* Movido a modules/documentos/index.js: listarBackups */
/* Movido a modules/documentos/index.js: restaurarBackup */
/* Movido a modules/directorio/index.js: limpiarBackupsViejos */
// ══════════════════════════════════════════════════════════════════════════════
// SISTEMA DE BACKUP DIARIO A R2
// Guarda un snapshot completo de app_state (recibos + D) cada dia.
// Bucket: 'backups'   Ruta: {despacho_id}/YYYY/MM/YYYY-MM-DD.json
// Retencion: 90 snapshots (~3 meses). El mas reciente siempre en /latest.json.
// ══════════════════════════════════════════════════════════════════════════════
var _backupHecho = false; // Solo una vez por sesion

/* Movido a modules/recibos/index.js: backupAppData */

/* Movido a modules/caja/index.js: _limpiarBackupsViejos */

window.restoreFromBackup = async function(fecha) {
  if (!window.descargarR2 || !window.SB_DESPACHO_ID) { alert('R2 no disponible'); return; }
  var did  = window.SB_DESPACHO_ID;
  var path = fecha
    ? did + '/backups/' + fecha.slice(0,4) + '/' + fecha.slice(5,7) + '/' + fecha + '.json'
    : did + '/backups/latest.json';
  try {
    var blob = await window.descargarR2(path, 'backups');
    if (!blob) { alert('Backup no encontrado: ' + path); return; }
    var snap = JSON.parse(await blob.text());
    console.log('[Backup] Snapshot encontrado:', snap.fecha, snap.hora,
      '| recibos:', snap.recibos.recibos.length,
      '| movimientos:', snap.data.movimientos.length,
      '| juicios:', snap.data.juicios.length);
    if (!confirm(
      'RESTAURAR BACKUP\n\n' +
      'Fecha: ' + fmtFecha(snap.fecha) + ' ' + snap.hora + '\n' +
      'Recibos: ' + snap.recibos.recibos.length + '\n' +
      'Movimientos: ' + snap.data.movimientos.length + '\n' +
      'Juicios: ' + snap.data.juicios.length + '\n\n' +
      'Confirmar SOBREESCRIBE el estado actual en Supabase.\n' +
      'Recarga la pagina despues de restaurar.'
    )) return;
    var user = (await window.SB.auth.getUser()).data.user;
    var res  = await window.SB.from('app_state').update({
      recibos:      snap.recibos,
      folio_actual: snap.recibos.folioActual,
      data:         snap.data,
      updated_by:   user ? user.id : null
    }).eq('despacho_id', did);
    if (res.error) { alert('Error: ' + res.error.message); return; }
    alert('Datos restaurados. Recarga la pagina.');
  } catch(e) { alert('Error: ' + e.message); console.error('[Backup]', e); }
};

/* Movido a modules/expedientes/index.js: saveCarpetas */
/* Movido a modules/directorio/index.js: load */
// ═══ DRIVE ═══
/* Movido a modules/documentos/index.js: driveChipClick */
/* Movido a modules/caja/index.js: calcSaldoRecibo */
/* Movido a modules/recibos/index.js: actualizarFolioDisplayRecibo */
/* Movido a modules/directorio/index.js: recAgregarCliente */
/* Movido a modules/recibos/index.js: recAgregarConcepto */
/* Movido a modules/integraciones/index.js: iniciarAuth */
/* Movido a modules/core/index.js: setBadge */
/* Movido a modules/contabilidad/index.js: sync */
// ═══════════════════════════════════════════════════════════════════
// SINCRONIZACIÓN UNIFICADA CON SUPABASE
// ═══════════════════════════════════════════════════════════════════
// Reemplaza todas las funciones save*Drive con una sola sincronización
// del estado completo (D + REC + folioActual) al app_state de Supabase.
let _syncDebounceTimer = null;
// ── Bandera global: operación de guardado en curso ───────────────────────────
// Cuando es true, _protegerMovimientosRecibo() salta el rescate para evitar
// falsos positivos durante el intervalo entre guardar el recibo y registrar
// su movimiento en D.movimientos.
window._registrandoRecibo = false;
// Activar con timeout de seguridad: si la función falla antes de apagar la bandera,
// este timer la apaga automáticamente a los 5s para no bloquear la protección permanentemente.
window._activarRegistrandoRecibo = function() {
  window._registrandoRecibo = true;
  window._registrandoReciboTS = Date.now();
  clearTimeout(window._registrandoReciboTimer);
  window._registrandoReciboTimer = setTimeout(function() {
    if(window._registrandoRecibo){
      console.warn('[LEX] _registrandoRecibo auto-apagado por timeout de seguridad');
      window._registrandoRecibo = false;
    }
  }, 30000);
};
window._desactivarRegistrandoRecibo = function() {
  window._registrandoRecibo = false;
  clearTimeout(window._registrandoReciboTimer);
};
// ── Overlay "Generando PDF" — bloquea visualmente la pantalla mientras se genera
// y sube el PDF de un recibo (pago total, parcial, servicio complementario, edición
// o regeneración), y deshabilita el/los botón(es) de imprimir pasados como argumento
// para que no se pueda dar clic varias veces mientras el sistema ya está procesando
// la primera solicitud. Usar siempre en pareja: mostrar al iniciar, ocultar al
// terminar (éxito o error) — idealmente en un finally para no dejarlo pegado.
window._mostrarGenerandoPDF = function(botones, texto, subtexto){
  (botones || []).forEach(function(btn){ if(btn) btn.disabled = true; });
  var ov = document.getElementById('overlay-generando-pdf');
  if(!ov) return;
  var txt = document.getElementById('overlay-generando-pdf-texto');
  if(txt) txt.textContent = texto || 'Generando PDF…';
  var sub = document.getElementById('overlay-generando-pdf-subtexto');
  if(sub) sub.textContent = subtexto || 'Espera un momento, no presiones Imprimir de nuevo';
  ov.style.display = 'flex';
};
window._ocultarGenerandoPDF = function(botones){
  (botones || []).forEach(function(btn){ if(btn) btn.disabled = false; });
  var ov = document.getElementById('overlay-generando-pdf');
  if(ov) ov.style.display = 'none';
  // Restaurar el subtítulo por defecto para que el overlay quede listo para su
  // uso original (Generando PDF) la próxima vez, aunque lo haya usado otro flujo.
  var sub = document.getElementById('overlay-generando-pdf-subtexto');
  if(sub) sub.textContent = 'Espera un momento, no presiones Imprimir de nuevo';
};
// ══════════════════════════════════════════════════════════════════════════════
// RECONSTRUCCIÓN DE MOVIMIENTOS DE RECIBO — modelo por BRECHA DE MONTO
// ──────────────────────────────────────────────────────────────────────────────
// Reemplaza la lógica vieja "por folio|letra con presencia" que (1) se saltaba las
// liquidaciones (if saldo<=0 return) y (2) no veía un honorario perdido cuando bajo
// la misma letra sobrevivía un movimiento de complementario. Razona por DOS
// sub-libros separados, tal como los define la Guía de Recibos y Folios:
//   • HONORARIOS  → estatus Anticipo / Sin Anticipo / Abono parcial / Liquidado /
//                   Liquidación. Incluye complementarios NO exactos (se suman a la
//                   deuda y se tratan como abono parcial). Lo abonado acumulado de
//                   la última versión = ultima.total − ultima.saldoPendiente.
//   • COMPLEMENTARIOS EXACTOS → estatus 'Complementario'. Independientes, NO entran
//                   al total/saldo. Esperado = Σ montoLiquidado de los exactos de la
//                   última versión (ya vienen heredados/locked, por eso solo la última).
// Compara lo esperado contra lo YA registrado y devuelve SOLO la brecha faltante.
// No inventa, no duplica, es idempotente (si está completo, brecha = 0 → nada).
// Los folios CANCELADOS se atienden por su rama propia (movimiento 'Cancelación').
// opts.soloFolio → limitar a un folio (para pruebas).
// Devuelve un array de movimientos listos para insertar (NO los inserta).
// Concepto — Descripción de un recibo (costosExtra si los tiene, si no
// conceptos[0] del trámite base). Usado para que los movimientos "Recuperado"
// (brechas detectadas por _calcularRecibosFaltantes) muestren lo mismo que
// cualquier recibo guardado normalmente, en vez de solo "Recibo #X · NOMBRE".
/* Movido a modules/recibos/index.js: _conceptoTxtDeRecibo */
/* Movido a modules/contabilidad/index.js: _calcularRecibosFaltantes */
// ── Protección permanente de movimientos de recibo ───────────────────────────
// Se ejecuta antes de cada subida a Supabase. Si una carrera de sync borró en
// memoria movimientos que el recibo de respaldo todavía exige, los restaura aquí
// ANTES de que el daño se persista, usando el modelo de brecha de monto.
/* Movido a modules/administracion/index.js: _protegerMovimientosRecibo */
// ── RECONCILIACIÓN ASISTIDA · eliminación duradera de movimientos por id ──────
// Elimina movimientos de contabilidad por id EXACTO, con tombstone (no vuelven
// desde otro dispositivo), respaldo y confirmación. SIMULACIÓN por defecto.
//   reconciliarAplicar(['M-REC-86'])                    → simula (no borra)
//   reconciliarAplicar(['M-REC-86'], {confirmar:true})  → ejecuta (pide confirm)
// El respaldo de lo borrado queda en window._reconcBackup por si hay que revertir.
/* Movido a modules/contabilidad/index.js: reconciliarAplicar */
window.reconciliarAplicar = reconciliarAplicar;
// ── RECONCILIACIÓN ASISTIDA · deshacer eliminaciones ─────────────────────────
// Restaura movimientos borrados por reconciliarAplicar() usando el snapshot
// COMPLETO guardado en D.movimientos_eliminados (campo _snapshotCompleto).
// Antes de este fix el tombstone solo guardaba {id,folio,letra,monto,ts} — no
// alcanzaba para restaurar nada y la única forma de recuperar un movimiento
// borrado por error era editar Supabase directamente. Ahora cualquier
// eliminación reciente se puede deshacer desde la propia consola de la app:
//   reconciliarDeshacerUltimo()          → deshace la última eliminación
//   reconciliarDeshacerUltimo({n:3})     → deshace las últimas 3
/* Movido a modules/contabilidad/index.js: reconciliarDeshacerUltimo */
window.reconciliarDeshacerUltimo = reconciliarDeshacerUltimo;
/* Movido a modules/contabilidad/index.js: syncEstadoSupabase */
// Debounce: si hay varias llamadas en menos de 800ms, solo se ejecuta una
/* Movido a modules/integraciones/index.js: syncEstadoSupabaseDebounced */
// ─── Funciones save*Drive: ahora todas redirigen a la sync global ──────
// ═══ REALTIME — SINCRONIZACIÓN EN TIEMPO REAL ENTRE USUARIOS ═══
// Cuando cualquier usuario guarda, emite una señal en el canal "lex-sync".
// Todos los demás la reciben y descargan el estado fresco de Supabase.
let _lexRealtimeChannel = null;
let _ultimoSyncPropio = 0; // timestamp del último sync que nosotros iniciamos (solo en memoria)
let _syncEnCurso = false;  // previene llamadas concurrentes a syncEstadoSupabase
let _lexRealtimeUltimaRecarga = 0;
const _LEX_REALTIME_COOLDOWN = 800; // reducido a 800ms para sincronización casi instantánea
/* Movido a modules/administracion/index.js: lexRealtimeConectar */
// ── Sincronizar UI cuando llegan cambios de OTRO usuario ──────────────
/* Movido a modules/contabilidad/index.js: _realtimeSincronizar */
/* Movido a modules/administracion/index.js: lexRealtimeBroadcast */
/* Movido a modules/core/index.js: lexRealtimeDesconectar */
// ── Polling de respaldo: cada 30s sincroniza aunque no llegue broadcast ──
// Reactivado: la causa original (sincronizarFolio sobreescribía movimientos
// locales aún no confirmados en Supabase) ya se corrigió — ahora fusiona por
// id con respeto a tombstones, igual que hace syncEstadoSupabase() al subir.
// Este polling es solo una red de seguridad para cuando el canal Realtime
// (broadcast + postgres_changes) se cae en silencio (wifi inestable, laptop
// suspendida, pestaña en segundo plano) y ningún aviso llega — sin esto, el
// usuario se queda con datos viejos hasta que refresca la página a mano.
let _lexPollingTimer = null;
const _LEX_POLLING_MS = 30000;
/* Movido a modules/core/index.js: lexPollingIniciar */
/* Movido a modules/recibos/index.js: _lexPollingTick */
// ═══ FIN REALTIME ═══
// ══════════════════════════════════════════════════════════════════
// BACKUP DIARIO AUTOMÁTICO (ahora en Supabase Storage)
// ══════════════════════════════════════════════════════════════════
// Flag en memoria para evitar múltiples backups el mismo día (no usa localStorage)
let _backupDiarioHecho = false;
/* Movido a modules/recibos/index.js: hacerBackupDiario */
/* Movido a modules/integraciones/index.js: forzarBackup */
// ══════════════════════════════════════════════════════════════════
// CONFLICTO DE EDICIÓN SIMULTÁNEA (ahora delegado a Supabase)
// ══════════════════════════════════════════════════════════════════
let _driveTimestampAlCargar = null;
/* Movido a modules/documentos/index.js: obtenerTimestampDrive */
/* Movido a modules/documentos/index.js: verificarConflicto */
/* Movido a modules/integraciones/index.js: guardarConVerificacion */
// ═══ INIT ═══
window.onload=async function(){
  // ── LIMPIEZA PERMANENTE DE localStorage ─────────────────────────────────
  // Todo dato de caché/respaldo se elimina al cargar. Solo se conservan credenciales de sesión.
  (function() {
    var mantener = new Set(['empleado_email','empleado_nombre','drive_token','drive_expiry','lex-supabase-auth','lex-supabase-session','lex_pend_caja_movs']);
    var borrar = [];
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && !mantener.has(k)) borrar.push(k); }
    borrar.forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });
    if (borrar.length) console.log('[LEX] localStorage limpiado al inicio —', borrar.length, 'entradas eliminadas');
  })();
  // ── INIT UI: selectores, fecha, formulario ───────────────────────────────
  // (código que estaba en el primer window.onload — ahora fusionado aquí)
  const sel = document.getElementById('anio');
  if(sel && sel.options.length <= 1){
    // <= 1: el HTML ya tiene el placeholder "—", solo agregar si no hay años aún
    if(sel.options.length === 0){ const op=document.createElement('option'); op.value=''; op.textContent='—'; sel.appendChild(op); }
    for(let y = new Date().getFullYear()+1; y>=1950; y--) {
      const o = document.createElement('option'); o.value=y; o.textContent=y; sel.appendChild(o);
    }
  }
  // (el select #ultima_tenencia ahora es "¿Adeuda Tenencias?" con opciones fijas
  // SI/NO/NO OPERA definidas directamente en el HTML — ya no requiere poblarse
  // dinámicamente con años como antes.)
  function aplicarFechaLocal(dt) {
    let yy, mm, dd, hh, mi, fechaISO, fechaStr;
    if(typeof horaSincOK !== 'undefined' && horaSincOK){
      const p = partesHoraCDMX();
      fechaISO = p.iso;
      const partesISO = p.iso.split('-');
      yy = partesISO[0]; mm = partesISO[1]; dd = partesISO[2];
      hh = p.hora.split(':')[0]; mi = p.hora.split(':')[1];
      fechaStr = new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(p.timestamp));
    } else {
      yy = dt.getFullYear();
      mm = String(dt.getMonth()+1).padStart(2,'0');
      dd = String(dt.getDate()).padStart(2,'0');
      hh = String(dt.getHours()).padStart(2,'0');
      mi = String(dt.getMinutes()).padStart(2,'0');
      fechaISO = yy+'-'+mm+'-'+dd;
      fechaStr = dt.toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    }
  function _actualizarTextoConformidad(fechaISO) {
    const el = document.getElementById('texto-conformidad');
    if (!el) return;
    try {
      const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const d = fechaISO ? new Date(fechaISO + 'T12:00:00') : new Date();
      const dia  = d.getDate();
      const mes  = meses[d.getMonth()];
      const anio = d.getFullYear();
      el.textContent = 'Leído que fue el presente documento y enterado de su contenido y alcance legal, lo firman por duplicado de conformidad en Santiago Juxtlahuaca, Oaxaca, a los ' + dia + ' días del mes de ' + mes + ' de ' + anio + '.';
    } catch(e) { el.textContent = ''; }
  }
  window._actualizarTextoConformidad = _actualizarTextoConformidad;
    $('hora_recibo').value  = hh+':'+mi;
    document.getElementById('fecha_recibo_display').textContent = fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1);
    document.getElementById('hora_recibo_display').textContent  = hh+':'+mi + ' hrs.';
    _actualizarTextoConformidad(fechaISO);
  }
  aplicarFechaLocal(new Date());
  window._aplicarFechaLocal = aplicarFechaLocal;
  agregarCliente();
  agregarConcepto();
  actualizarFolioDisplay();
  generarQRPreview();
  renderHistorial();
  setTipoTramite('normal');
  const docsChecklist = document.getElementById('docs-checklist');
  if(docsChecklist){
    docsChecklist.addEventListener('change', function(e){
      if(e.target && e.target.type === 'checkbox') validarLimiteDocumentos(e.target);
    });
  }
  // ─────────────────────────────────────────────────────────────────────────
  // ── INICIALIZAR SUPABASE Y VERIFICAR SESIÓN PERSISTENTE ─────────
  // load() se llama DESPUÉS de conocer si hay sesión:
  // - Con sesión: Supabase puebla D vía sincronizarFolio(), load() no se usa
  // - Sin sesión: load() carga el fallback offline desde localStorage
  try {
    await initSupabase();
    const { data: { session } } = await window.SB.auth.getSession();
    if(session && session.user){
      // Hay sesión activa — Supabase es la fuente de verdad, ignorar localStorage
      sbSession  = 'supabase-active-' + session.user.id;
      window._miUserId = session.user.id;
      sbExpiry = Date.now() + 1000*60*60*12;
      empleadoActual = {
        email:  session.user.email,
        nombre: EMPLEADOS[session.user.email.toLowerCase()] || session.user.email.split('@')[0]
      };
      try{ localStorage.setItem('empleado_email', empleadoActual.email); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('empleado_nombre', empleadoActual.nombre); } catch(e){ registrarError('localStorage.setItem', e); }
// Ver nota en el flujo de login manual: bloquea "Responsable del Trámite"
// también al restaurar una sesión ya abierta (recarga de página).
try{ if(typeof detectarEmpleado==='function') await detectarEmpleado(); } catch(e){ console.warn('[detectarEmpleado]', e); }
try{ if(typeof _driveSyncRefreshPendiente==='function') _driveSyncRefreshPendiente(); } catch(e){}
const _despachoRestaurado = await obtenerDespachoActivo();
      // Si no tiene membresía asignada, obtenerDespachoActivo ya cerró la sesión
      if(!_despachoRestaurado) return;
      actualizarAmbossBadges(true);
      await sincronizarFolio();
      try { if(typeof window._pendMovsRecuperar === 'function') window._pendMovsRecuperar(); } catch(_ePend){}
      // El splash NO se oculta aquí todavía — se deja como cortina (mismo
      // fondo negro texturizado) hasta que horarioGateLogin() esté listo para
      // mostrar su aviso (o de inmediato si es admin). Así, igual que en el
      // login manual, el sistema nunca se ve sin bloquear ni un instante.
      // Lo retira _lexCortinaQuitar() desde horarioGateLogin().
      // Mostrar botones según rol al restaurar sesión
      const _btnCS2 = document.getElementById('btn-cerrar-sesion'); if(_btnCS2) _btnCS2.style.display = 'block';
      const _esAdm2 = empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      if(_esAdm2 && typeof scansysInit==='function') setTimeout(scansysInit, 3000);
      setTimeout(lexRealtimeConectar, 1500);
      setTimeout(sesionesRegistrarLogin, 2000);
      // Horario de captura: bienvenida/espera/cierre + avisos programados
      setTimeout(function(){ if(typeof horarioGateLogin==='function') horarioGateLogin(); }, 700);
      console.log('[SB] Sesión restaurada para:', empleadoActual.nombre);
    } else {
      // Sin sesión — cargar datos locales como fallback offline
      sbSession = null;
      sbExpiry = 0;
      load(); // solo en modo offline
      // Splash se ocultará en mostrarLoginSupabase()
    }
  } catch(e){
    console.warn('[SB] init onload:', e);
    sbSession = null;
    sbExpiry = 0;
    load(); // error de conexión — intentar offline
  }
  renderSrvs();renderCaja();renderDir();badges();
  // PARCHE: migración hardcodeada del recibo #120 DESACTIVADA (causa pérdida de datos)
  setTimeout(()=>{ if(typeof migrarConceptoCostosExtra==='function') migrarConceptoCostosExtra(); }, 900);
  setTimeout(()=>{ if(typeof migrarMovimientosRecibos==='function') migrarMovimientosRecibos(); }, 1600);
  // Login se muestra desde el flujo del splash (no necesita delay)
  if(!sbSession || Date.now()>=sbExpiry){
    mostrarLoginSupabase();
  }
  verificarLogin();
  reloj();
  setInterval(reloj,1000);
  // Sync periódico a Supabase (cada 5 min)
  setInterval(()=>{
    if(!sbSession || Date.now()>=sbExpiry) return;
    const totalDatos = (D.movimientos||[]).length + (D.cierres||[]).length;
    if(totalDatos < 2){
      console.warn('[sync periódico] Saltado: D parece vacío o recién inicializado');
      return;
    }
    syncEstadoSupabaseDebounced();
  }, 5*60*1000);
  // Aplicar bloqueo si la caja ya fue cerrada hoy
  setTimeout(aplicarEstadoCierre, 200);
  // Inicializar sistema de recibos después del LEX
  if(typeof _idxInitRecibos === 'function') _idxInitRecibos();
};
// ═══ LOGO ═══
const LOGO_SRC = "data:image/jpeg;base64,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";
// ═══ SISTEMA DE RECIBOS ═══
const DOCS_LIST = [
  'Acta de Nacimiento','Acta de Matrimonio','Acta de Defunción','CURP','INE/IFE',
  'Pasaporte','RFC','Comprobante domicilio','Escritura pública','Título de propiedad',
  'Copia simple de acta','Constancia sit. fiscal','Permiso de circulación',
  'Tarjeta de circulación','Factura vehículo','Pedimento importación',
  'Carta responsiva','Poder notarial','Sentencia','Convenio','Exhorto',
  'Certificado catastral','Constancia de no adeudo','Plano','Fotografías'
];
let reciboFrozen = false;
let recTipoDoc = 'copia';
// lastPdfBlob — compartido con LEX (declarado arriba)
let rClientes = [];
let rConceptos = [];
let rQRInstance = null;
let pendingNextFolioRecibo = null;
/* Movido a modules/recibos/index.js: siguienteFolioRecibo */
/* Movido a modules/clientes/index.js: renderClientesRecibo */
/* Movido a modules/clientes/index.js: eliminarCliente */
/* Movido a modules/recibos/index.js: renderConceptosRecibo */
/* Movido a modules/recibos/index.js: eliminarConcepto */
/* Movido a modules/recibos/index.js: autoCalcTotal */
/* Movido a modules/core/index.js: parsePrecioR */
/* Movido a modules/core/index.js: formatPrecioR */
/* Movido a modules/caja/index.js: calcTotalesRecibo */
/* Movido a modules/recibos/index.js: renderDocsRecibo */
/* Movido a modules/documentos/index.js: rec_getDocumentosSeleccionados */
/* Movido a modules/recibos/index.js: setTipoDocRecibo */
/* Movido a modules/documentos/index.js: recToggleVehiculo */
/* Movido a modules/clientes/index.js: generarQRRecibo */
/* Movido a modules/core/index.js: getQRDataURL */
/* Movido a modules/directorio/index.js: initRecibo */
/* Movido a modules/clientes/index.js: guardarReciboInterno */

/* Movido a modules/recibos/index.js: congelarRecibo */
/* Movido a modules/recibos/index.js: descongelarRecibo */
/* Movido a modules/directorio/index.js: nuevoReciboLimpio */
/* Movido a modules/recibos/index.js: reimprimirReciboInterno */
/* Movido a modules/recibos/index.js: imprimirBlob */
// ── Obtener siguiente folio único (no duplicado) ─────────────────────
// Verifica que el folio no exista ya en appData.recibos ni en REC.recibos
/* Movido a modules/recibos/index.js: _folioSiguienteUnico */
// Devuelve el primer número de folio libre (≥1). Úsalo para recalcular folioActual
// después de eliminar un recibo o al activar el modo "llenar huecos".
/* Movido a modules/clientes/index.js: _recalcularFolioActual */
// ── Lock de folio: evita que dos generaciones simultáneas tomen el mismo ──
let _folioEnUso = false;
/* Movido a modules/recibos/index.js: _tomarFolioSeguro */
/* Movido a modules/recibos/index.js: guardarFolioEnDrive */
/* Movido a modules/recibos/index.js: subirPDFaD */
/* Movido a modules/caja/index.js: renderRecibosRecientes */
// ═══ CONFIGURACION ═══
/* Movido a modules/administracion/index.js: renderConfig */
// ═══ DASHBOARD: actualización de indicadores en tiempo real ═══
/* Movido a modules/core/index.js: dashActualizarIndicadores */
// Auto-refrescar el dashboard cada segundo cuando esté visible
setInterval(function(){
  var panel = document.getElementById('panel-configuracion');
  if(panel && panel.classList.contains('active')){
    try { dashActualizarIndicadores(); } catch(e){ registrarError('catch vacio', e); }
  }
}, 1000);
// ═══ DASHBOARD: enrutar acciones admin con autenticación ═══
// Cada acción que requiere admin verifica si hay sesión activa.
// Si no hay, abre el modal de login. Si hay, ejecuta la acción directamente.
/* Movido a modules/administracion/index.js: dashAccionAdmin */
/* Movido a modules/contabilidad/index.js: dashNombreAccion */
/* Movido a modules/administracion/index.js: dashEjecutarAccion */
// Hook después del login admin: si hay acción pendiente, ejecutarla
window._dashHookOriginalLogin = window._dashHookOriginalLogin || null;
/* Movido a modules/administracion/index.js: cambiarEmpleado */
/* Movido a modules/administracion/index.js: limpiarDiaActual */
/* Movido a modules/directorio/index.js: reiniciarSistema */
/* Movido a modules/recibos/index.js: exportarCopia */
/* Movido a modules/recibos/index.js: importarCopia */
/* Movido a modules/contabilidad/index.js: verCierres */
// ═══ PANEL DE RESPALDOS LOCALES (Mejora 1) ═══
/* Movido a modules/core/index.js: abrirPanelBackups */
// Función auxiliar: devuelve el siguiente número para CARP.- N
/* Movido a modules/expedientes/index.js: sugerirNumeroCarpeta */
/* Movido a modules/contabilidad/index.js: renderBackupsList */
/* Movido a modules/contabilidad/index.js: restaurarBackupConfirm */
// ═══ IMPRESIÓN DE TENENCIA ═══
var _tenEstado='';
var _tenOtrasCount=0;
/* Movido a modules/documentos/index.js: abrirPanelTenencia */
/* Movido a modules/core/index.js: selEstadoTen */
/* Movido a modules/core/index.js: selEstadoTenOtro */
/* Movido a modules/core/index.js: toggleTenExtra */
/* Movido a modules/core/index.js: adjTen */
/* Movido a modules/core/index.js: calcTenTotal */
// URLs oficiales de tenencia/refrendo por estado (verificadas mayo 2026)
var TENENCIA_URLS={
  // ── PILLS PRINCIPALES ──
  'Oaxaca':              'https://siox.finanzasoaxaca.gob.mx/pagoTenencia',
  'Estado de México':    'https://tenencia.edomex.gob.mx/TenenciaIndividual/tenencia/A06E1A88B8A6ED4B#/',
  'CDMX':               'https://data.finanzas.cdmx.gob.mx/Front_ten/',
  'Michoacán':           'https://refrendodigital.michoacan.gob.mx/',
  'Guerrero':            'https://esefina.ingresos-guerrero.gob.mx/Tenencia/ModuloExterno/',
  'Puebla':              'https://rl.puebla.gob.mx/PagosVehiculo',
  'Veracruz':            'https://ovh.veracruz.gob.mx/ovh/consultavehicular',
  'Chiapas':             'https://www.ingresos.haciendachiapas.gob.mx/vehicular/liquidacion_vehicular/p_vehicular.asp',
  // ── OTROS ESTADOS ──
  'Aguascalientes':      'https://epagos.aguascalientes.gob.mx/controlvehicular',
  'Baja California':     'https://www.bajacalifornia.gob.mx/portal/gobierno/secretarias/sf/control_vehicular.jsp',
  'Baja California Sur': 'https://hacienda.bcs.gob.mx/control-vehicular/',
  'Campeche':            'https://contribunet.campeche.gob.mx/',
  'Chihuahua':           'https://www.chihuahua.gob.mx/hacienda/revalidacion-vehicular',
  'Coahuila':            'https://pagafacil.gob.mx/pagafacilV2/epago/cv/cv2.php',
  'Colima':              'https://pagos.col.gob.mx/pagos/vehicular',
  'Durango':             'https://www.pagos.durango.gob.mx/tramite/DPC-Refrendo/',
  'Guanajuato':          'https://refrendo.guanajuato.gob.mx/',
  'Hidalgo':             'https://hidalgo.gob.mx/tramite/impuesto-sobre-tenencia-o-uso-de-vehiculos',
  'Jalisco':             'https://gobiernoenlinea1.jalisco.gob.mx/serviciosVehiculares/pagos',
  'Morelos':             'https://hacienda.morelos.gob.mx/refrendo-vehicular',
  'Nayarit':             'https://hacienda.nayarit.gob.mx/refrendo',
  'Nuevo León':          'https://www.icvnl.gob.mx/',
  'Querétaro':           'https://recaudanet.queretaro.gob.mx/',
  'Quintana Roo':        'https://finanzas.qroo.gob.mx/control-vehicular/',
  'San Luis Potosí':     'https://www.slp.gob.mx/sfa/servicios/vehicular',
  'Sinaloa':             'https://ciudadanodigital.sinaloa.gob.mx/',
  'Sonora':              'https://cuentaunica.siiafhacienda.gob.mx/expressvehicular/verificacion',
  'Tabasco':             'https://www.hacienda.tabasco.gob.mx/pago-refrendo',
  'Tamaulipas':          'https://sat.tamaulipas.gob.mx/vehicular/',
  'Tlaxcala':            'https://finanzas.tlaxcala.gob.mx/refrendo',
  'Yucatán':             'https://www.hacienda.yucatan.gob.mx/refrendo-vehicular',
  'Zacatecas':           'https://www.finanzas.zacatecas.gob.mx/control-vehicular/'
};
/* Movido a modules/recibos/index.js: _abrirUrlTenencia */
/* Movido a modules/caja/index.js: registrarTenencia */
/* Movido a modules/documentos/index.js: registrarTenenciaCarrito */
// ═══ CONSTANCIA DE SITUACIÓN FISCAL ═══
/* Movido a modules/core/index.js: abrirPanelCSF */
/* Movido a modules/core/index.js: calcCSFTotal */
/* Movido a modules/caja/index.js: registrarCSF */
/* Movido a modules/core/index.js: registrarCSFCarrito */
// Navegacion integrada en ir() principal
// ═══ LOGIN POR EMAIL ═══
/* Movido a modules/core/index.js: abrirLogin */
/* Movido a modules/administracion/index.js: doLogin */
/* Movido a modules/administracion/index.js: verificarLogin */
/* Movido a modules/administracion/index.js: actualizarInfoSesion */
// ═══ CARRITO ═══
var CARRITO=[];
/* Movido a modules/core/index.js: updateCarritoBadge */
/* Movido a modules/core/index.js: agregarAlCarrito */
/* Movido a modules/core/index.js: abrirCarrito */
/* Movido a modules/core/index.js: renderCarrito */
/* Movido a modules/core/index.js: quitarCarritoItem */
/* Movido a modules/integraciones/index.js: vaciarCarrito */
// Agrupa artículos idénticos (mismo nombre y mismo precio unitario) del carrito
// en "N× nombre $unit c/u $subtotal" — evita repetir "Impresión CURP $45.00"
// dos veces cuando se agregó el mismo trámite por separado dos veces.
/* Movido a modules/core/index.js: _agruparCarritoDescs */
/* Movido a modules/clientes/index.js: registrarCarrito */
// ═══ MODOS TENENCIA / CSF ═══
var _tenModo='caja';
var _csfModo='caja';
/* Movido a modules/caja/index.js: setTenModo */
/* Movido a modules/caja/index.js: setCSFModo */
// ═══ COPIAS ═══
var _copiaTipo='bn';
var _copiasModo='caja';
/* Movido a modules/core/index.js: abrirCopias */
/* Movido a modules/core/index.js: selCopia */
/* Movido a modules/core/index.js: adjCopias */
/* Movido a modules/core/index.js: calcCopiaTotal */
/* Movido a modules/caja/index.js: setCopiasModo */
/* Movido a modules/caja/index.js: registrarCopias */
/* Movido a modules/core/index.js: registrarCopiasCarrito */
// ═══ ESCANEO ═══
var _escanModo='caja';
var _escanTam='carta';
/* Movido a modules/core/index.js: setEscanTam */
/* Movido a modules/core/index.js: abrirEscaneo */
/* Movido a modules/core/index.js: adjEscan */
/* Movido a modules/core/index.js: calcEscanTotal */
/* Movido a modules/caja/index.js: setEscanModo */
/* Movido a modules/caja/index.js: registrarEscaneo */
/* Movido a modules/core/index.js: registrarEscaneoCarrito */
// ═══ CAPTURA RÁPIDA (nuevo diseño) ═══
var _libreTipo='ingreso';
var _libreModo='caja';
var _libreConceptos=[];
/* Movido a modules/caja/index.js: setLibreTipo */
/* Movido a modules/caja/index.js: abrirLibre */
// Formatea el precio de Captura Rápida con signo $, separador de miles y hasta 2 decimales
/* Movido a modules/core/index.js: _precioLibreFmt */
/* Movido a modules/recibos/index.js: formatPrecioLibre */
/* Movido a modules/recibos/index.js: renderConceptosLibre */
/* Movido a modules/recibos/index.js: agregarConceptoLibre */
/* Movido a modules/recibos/index.js: eliminarConceptoLibre */
/* Movido a modules/recibos/index.js: calcLibreTotal */
/* Movido a modules/core/index.js: setLibreModo */
/* Movido a modules/caja/index.js: registrarLibre */
/* Movido a modules/recibos/index.js: registrarLibreCarrito */
// ═══ CAPTURA RETROACTIVA ═══
// Permite registrar movimientos con fecha y hora anteriores
// Útil cuando se cobra después del cierre de caja
/* Movido a modules/core/index.js: abrirCapturaRetro */
/* Movido a modules/caja/index.js: retroSetTipo */
/* Movido a modules/caja/index.js: confirmarCapturaRetro */
// ═══ FIN CAPTURA RETROACTIVA ═══
// ═══ REGISTRO CIVIL ═══
// Número de WhatsApp del grupo (configurable)
var RC_WA_NUM = '529544000000'; // <- Cambiar al número real del grupo
/* Movido a modules/core/index.js: abrirRegistroCivil */
/* Movido a modules/documentos/index.js: rcMostrar */
// Compatibilidad con llamadas antiguas del panel lateral
/* Movido a modules/core/index.js: rcAbrirSubpanel */
// ── ACTA: abrir WhatsApp con mensaje preescrito ──
/* Movido a modules/documentos/index.js: rcEnviarWA */
// ── CURP: abrir página oficial del gobierno ──
/* Movido a modules/administracion/index.js: rcAbrirCurpGov */
// ── CURP: actualizar vista en captura (stub, los inputs guardan su valor solos) ──
// Esta función existía como handler oninput en los campos del formulario CURP.
// Su único propósito histórico era refrescar una vista previa que ya no existe.
// Se mantiene como no-op para que los inputs no lancen ReferenceError.
/* Movido a modules/core/index.js: rcActualizarVista */
// ── CURP: cálculo de total ──
/* Movido a modules/documentos/index.js: rcCalcCurpTotal */
/* Movido a modules/documentos/index.js: rcAdjCurp */
// ── CURP: agregar al carrito ──
/* Movido a modules/caja/index.js: rcCurpCarrito */
// ── CURP: registrar ──
/* Movido a modules/caja/index.js: rcRegistrarCurp */
// ═══ ACTAS DEL REGISTRO CIVIL ═══
var _actaTipo='';
var _actaEstado='';
var _actaTipoLabels={
  nacimiento:'Acta de Nacimiento',
  matrimonio:'Acta de Matrimonio',
  divorcio:  'Acta de Divorcio',
  defuncion: 'Acta de Defunción'
};
/* Movido a modules/core/index.js: rcSelTipoActa */
var _OTROS_ESTADOS_ACTA=['Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'];
/* Movido a modules/core/index.js: _rcBuildOtroDropdown */
/* Movido a modules/core/index.js: rcToggleOtroDropdown */
/* Movido a modules/core/index.js: rcSelEstadoActa */
/* Movido a modules/core/index.js: rcSelEstadoActaOtro */
/* Movido a modules/core/index.js: rcActualizarIndicadorActa */
/* Movido a modules/core/index.js: rcCalcActaTotal */
/* Movido a modules/core/index.js: rcAdjActa */
/* Movido a modules/core/index.js: _rcActaValidar */
/* Movido a modules/core/index.js: _rcActaDesc */
/* Movido a modules/core/index.js: _rcActaWA */
/* Movido a modules/clientes/index.js: rcRegistrarActa */
/* Movido a modules/core/index.js: rcActaCarrito */
// Reset acta al abrir subpanel
var _rcMostrarOrig=rcMostrar;
rcMostrar=function(sub){
  if(sub==='acta'){
    _actaTipo='';_actaEstado='';
    document.querySelectorAll('#mRC-acta .rc-acta-tipo-btn').forEach(function(b){b.classList.remove('sel');});
    var btnOax=document.getElementById('acta-btn-oaxaca');
    var btnOtro=document.getElementById('acta-btn-otro');
    if(btnOax){btnOax.style.background='#bbb';btnOax.style.borderColor='#bbb';}
    if(btnOtro){btnOtro.style.background='#bbb';btnOtro.style.borderColor='#bbb';btnOtro.textContent='Otro estado ▾';}
    var dd=document.getElementById('acta-otro-dropdown');
    if(dd)dd.style.display='none';
    document.getElementById('acta-tipo-sel').style.display='none';
    document.getElementById('acta-precio').value='240';
    document.getElementById('acta-cant').value='1';
    document.getElementById('acta-total').textContent='$240.00';
  }
  _rcMostrarOrig(sub);
};
// Cerrar dropdown de "Otro estado" al hacer clic fuera
document.addEventListener('click',function(e){
  var dd=document.getElementById('acta-otro-dropdown');
  var btn=document.getElementById('acta-btn-otro');
  if(dd&&btn&&!btn.contains(e.target)&&!dd.contains(e.target)){
    dd.style.display='none';
  }
});
// ── HELPERS ────────────────────────────────────────────────────────────
/* Movido a modules/core/index.js: escH */
/* Movido a modules/core/index.js: fmtMx */
/* Movido a modules/core/index.js: fmtM2 */
/* Movido a modules/core/index.js: fmtFIMonto */
// ═══ SINCRONIZACIÓN CON GOOGLE SHEETS v18 — API append (no sobreescribe) ═══
// Usa values:append para AGREGAR filas al final. Nunca sobreescribe datos.
// Columnas: A=Encabezado día / vacío  B=Descripción  C=Ingreso  D=Egreso  E=Responsable  F=Categoría  G=ID
let syncQueue = [];
let syncEnProgreso = false;
// formatearFechaContabilidad() — definida más abajo (única copia activa).
// Formato compatible (lo usaba syncMovimientoASheets para fechas)
/* Movido a modules/contabilidad/index.js: formatearFechaContabilidad */
// ─── Exportar directorio CSV ─────────────────────────────────────
/* Movido a modules/directorio/index.js: exportarDirectorioCSV */
// ─── Background sync (legacy eliminado tras migración a Supabase) ────────
// La versión stub que dispara syncEstadoSupabaseDebounced está definida arriba.
// El sistema de cola persiste offline y drena automáticamente al reconectar:
// Supabase maneja sus propios reintentos en el SDK.
// ─── Cerrar Caja ─────────────────────────────────────────────────
/* Movido a modules/administracion/index.js: cerrarCaja */
// ═══════════════════════════════════════════════════════════════
// CIERRE AUTOMÁTICO DE CAJA (5:30 p.m., disparado por el reloj del
// servidor vía pg_cron — ver columna app_state.caja_auto_cierre_pendiente)
// Misma lógica que cerrarCaja(), pero sin confirm() y sin depender de que
// ningún empleado haga clic; el responsable queda marcado como el sistema.
// ═══════════════════════════════════════════════════════════════
/* Movido a modules/contabilidad/index.js: cerrarCajaAutomatico */
// Revisa si el servidor marcó que ya pasaron las 5:30 p.m. y hoy no se ha
// cerrado la caja — si es así, la cierra automáticamente (sin importar quién
// tenga el sistema abierto ni la hora de su reloj local).
/* Movido a modules/caja/index.js: _chequearCierreAutomaticoCaja */
// ═══════════════════════════════════════════════════════════════
// AUTO-REGISTRO DE DÍAS SIN ACTIVIDAD
// ═══════════════════════════════════════════════════════════════
// Al abrir el sistema, detecta días anteriores (incluyendo domingos) que
// quedaron sin movimientos NI cierre registrado, y los registra
// automáticamente con la leyenda:
//   "Sin movimientos contables durante la jornada"
//
// Reglas:
// - Solo cubre fechas estrictamente anteriores a hoy (nunca el día actual).
// - Solo registra si NO existe ningún cierre (normal, histórico o corte) para
//   esa fecha y NO hay movimientos en D.movimientos para esa fecha.
// - El rango se calcula desde el día siguiente al último cierre conocido (o
//   desde el primer movimiento si no hay cierres) hasta ayer inclusive.
// - Si no hay ningún dato previo (sistema nuevo, sin cierres ni movimientos),
//   no genera nada — evita poblar el historial con días pre-instalación.
// - Cada registro incluye `auto: true` para distinguirlo de los manuales.
// - El saldoAcumulado NO se modifica (días vacíos no aportan saldo).
// ═══════════════════════════════════════════════════════════════
/* Movido a modules/core/index.js: _ymdAddDays */
// ═══ LIMPIEZA DE CIERRES DUPLICADOS ═══════════════════════════════
// Detecta y elimina recibos duplicados generados en la misma fecha y hora.
// Dos recibos son "duplicados" si tienen el mismo folio, misma fecha y misma hora.
// Conserva el primero (índice menor) y elimina los sobrantes.
// También detecta movimientos duplicados en D.movimientos (mismo folio+letra+fecha+monto+estatus)
// que causan que el mismo recibo aparezca dos veces en contabilidad aunque appData.recibos esté limpio.
/* Movido a modules/administracion/index.js: adminEliminarRecibosDuplicados */

// ── Duplicados Contabilidad: selector manual ─────────────────────────────
// Exclusivo de D.movimientos. Muestra panel interactivo para elegir cuál
// entrada conservar en cada grupo de duplicados antes de eliminar.
/* Movido a modules/administracion/index.js: adminLimpiarDupContab */

// Aplica las selecciones del modal y elimina los movimientos no elegidos.
// USA reconciliarAplicar() con tombstone para que la eliminación sea PERMANENTE
// y no vuelva a aparecer al sincronizar con Supabase.
/* Movido a modules/administracion/index.js: adminLimpiarDupContabAplicar */

// Detecta y elimina cierres duplicados del mismo día.
// Mantiene solo el más reciente (por hora). Si dos tienen misma hora,
// prioriza: corte de caja > cierre normal > cierre sinMovimientos.
// Esta función es segura: solo se ejecuta si encuentra duplicados reales.
/* Movido a modules/caja/index.js: limpiarCierresDuplicados */
/* Movido a modules/contabilidad/index.js: autoRegistrarDiasSinActividad */
// ─── Retirar dinero de la caja ───────────────────────────────────
// ─── Modal Retiro de Caja ─────────────────────────────────────────
/* Movido a modules/clientes/index.js: abrirModalRetiro */
/* Movido a modules/administracion/index.js: retirarTodo */
/* Movido a modules/caja/index.js: calcRetiroPreview */
/* Movido a modules/clientes/index.js: confirmarRetiro */
/* Movido a modules/contabilidad/index.js: sincronizarTodoAhora */
// ─── UI ──────────────────────────────────────────────────────────
/* Movido a modules/integraciones/index.js: toggleSyncSheetsUI */
/* Movido a modules/integraciones/index.js: actualizarSyncUI */
setInterval(() => {
  const panel = document.getElementById('panel-configuracion');
  if (panel && panel.classList.contains('active')) actualizarSyncUI();
}, 2000);
// ═══════════════════════════════════════════════════════════════
// ═══ PANEL ADMINISTRADOR ════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// Antes había aquí una contraseña fija en texto plano ('1234**'), visible
// para cualquiera que abriera "Ver código fuente" del navegador — la viera
// o no el botón de la rueda dentada. Se quitó por completo: ahora el acceso
// al Panel de Administrador se basa en la sesión REAL de Supabase (la misma
// que ya se usa para entrar al sistema, verificada con contraseña cifrada
// en el servidor) — si el correo logueado es el del administrador, entra
// directo; si no, se le niega el acceso sin mostrar ningún formulario.
/* Movido a modules/administracion/index.js: _esAdminReal */
let adminSesionActiva = false;
let adminSesionUsuario = '';
let adminSesionHora = '';
/* Movido a modules/administracion/index.js: abrirAdminModal */
/* Movido a modules/administracion/index.js: cerrarAdminModal */
const cerrarAdmin = cerrarAdminModal;
// ── ELIMINAR RECIBO POR FOLIO (desde tarjeta rueda dentada) ──────────────────
/* Movido a modules/administracion/index.js: adminDelFolioBtnClick */
// Abrir la Ficha del Folio desde la tabla de Contabilidad — clic en el folio
// azul (1A, 1B, 56D...) manda a la Ficha del Folio de ese número, exactamente
// como si se hubiera escrito ese número en el buscador de "Consultar Folios y
// Expedientes" (campo #folio_anterior). Reutiliza el mismo flujo ya probado
// que usa abrirFolioDesdeCliente() — no importa la letra específica en la que
// se hizo clic: la Ficha siempre ancla en la versión A y muestra el historial
// completo de todas las letras.
/* Movido a modules/contabilidad/index.js: abrirFichaDesdeContab */
// Abrir preview de recibo desde la tabla de Contabilidad — overlay flotante
/* Movido a modules/contabilidad/index.js: abrirPreviaDesdeContab */
// Muestra el formulario de confirmación dentro del overlay de contabilidad.
// r = recibo a generar; fuente = recibo del que se toman los datos base.
/* Movido a modules/recibos/index.js: _cpdfMostrarFormGenerar */
/* Movido a modules/recibos/index.js: cpdfConfirmarGenerar */
/* Movido a modules/contabilidad/index.js: cerrarContabPDF */
// Ya no queda ningún formulario de usuario/contraseña que llame a esta
// función en el flujo normal (abrirAdminModal ahora concede o niega el
// acceso directo, según la sesión real de Supabase) — se conserva solo
// como respaldo por si algún camino legacy la sigue invocando.
/* Movido a modules/administracion/index.js: adminLogin */
/* Movido a modules/administracion/index.js: adminMostrarPanel */
/* Movido a modules/administracion/index.js: adminVerificarConflicto */
/* Movido a modules/administracion/index.js: adminCorteDeCaja */
/* Movido a modules/administracion/index.js: adminDiagnosticoSaldo */
/* Movido a modules/administracion/index.js: adminRepararFoliosCaja */
/* Movido a modules/administracion/index.js: cerrarSesionUsuario */
// ── Vigilancia automática de cuenta deshabilitada ───────────────────────────
// Supabase no puede invalidar al instante un token de acceso ya emitido (es un
// JWT sin estado — solo deja de renovarse/iniciar sesión). Para que "Deshabilitar"
// también cierre una sesión YA ABIERTA sin esperar a que el token expire solo,
// revisamos cada 25s si la cuenta activa sigue habilitada; si el administrador
// la deshabilitó, se cierra la sesión sola de inmediato (dentro de esa ventana).
let _watchCuentaTimer = null;
const _WATCH_CUENTA_MS = 25000;
/* Movido a modules/administracion/index.js: _checkCuentaHabilitada */
/* Movido a modules/administracion/index.js: _forzarCierreSesionPorDeshabilitado */
if(!_watchCuentaTimer) _watchCuentaTimer = setInterval(_checkCuentaHabilitada, _WATCH_CUENTA_MS);
/* Movido a modules/administracion/index.js: adminLogout */
/* Movido a modules/administracion/index.js: adminDesbloquearCaja */
/* Movido a modules/administracion/index.js: adminAbrirEliminarMovimiento */
/* Movido a modules/administracion/index.js: adminElimMovRender */
/* Movido a modules/administracion/index.js: adminElimMovConfirmar */
/* Movido a modules/administracion/index.js: adminBorrarCobrosHoy */
// ══════════════════════════════════════════════════════════════════
// REGENERAR PDFs HISTÓRICOS — corrige título y cuadro de totales
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// VINCULAR PDFs HUÉRFANOS DESDE R2
// Busca todos los archivos en R2/recibos/, cruza con recibos en
// memoria y vincula los que no tienen archivoR2 guardado.
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// R2 RECOVERY CENTER
// ══════════════════════════════════════════════════════════════

/* Movido a modules/administracion/index.js: adminAbrirR2Recovery */

// ── Opción 1: Vincular (reutiliza adminVincularPDFsR2) ──
/* Movido a modules/administracion/index.js: _r2RecoveryVincular */

/* Movido a modules/administracion/index.js: adminVincularPDFsR2 */

/* Movido a modules/administracion/index.js: adminModernizarPDFs */

// Regenera TODOS los PDFs para que el recuadro "DOCUMENTOS QUE DEJA EL
// INTERESADO" muestre correctamente Copia Simple o Escaneo — corrige recibos
// donde ese dato se guardó sin la etiqueta (quedaba genérico/ambiguo). Usa
// exactamente el mismo patrón que adminModernizarPDFs(): recorre appData.recibos,
// vuelve a llamar generarPDF() con los datos ya guardados de cada recibo
// (incluyendo su tipo_doc real) y sube el PDF nuevo a R2/Drive reemplazando el viejo.
/* Movido a modules/administracion/index.js: adminRegenerarPDFsDocumentos */

// ── Regenerar PDFs de recibos VEHICULARES ──
// Identifica todo recibo de trámite vehicular (tipoTramite === 'vehicular' o
// con datos.clase capturado) para regenerar su PDF con los datos más
// recientes del formulario: estado de placas con nombre completo (ya no
// abreviado), campo Tipo, ancho de Serie/NIV, ¿Adeuda Tenencias? y demás
// ajustes de esta sección. No toca recibos de trámites no vehiculares.
/* Movido a modules/recibos/index.js: _vehPDFEsCandidato */
/* Movido a modules/administracion/index.js: adminRegenerarPDFsVehiculares */
window.adminRegenerarPDFsVehiculares = adminRegenerarPDFsVehiculares;

// ════════════════════════════════════════════════════════════════════
// GESTOR DE FOLIOS — Insertar (hacer espacio) / Eliminar (cerrar o dejar hueco)
// Módulo INDEPENDIENTE. No modifica las demás opciones de borrado/reparación.
// Modelo de folio continuo (sin año): solo cambia el número impreso del PDF,
// los datos del recibo quedan intactos.
// ════════════════════════════════════════════════════════════════════
/* Movido a modules/recibos/index.js: _gfRecibosVivos */
/* Movido a modules/recibos/index.js: _gfMaxFolio */
/* Movido a modules/recibos/index.js: _gfFolioExiste */
/* Movido a modules/recibos/index.js: _gfRecibosEnRango */
/* Movido a modules/recibos/index.js: _gfDistintosFolios */
// Respaldo previo en localStorage (snapshot puntual antes de mutar).
/* Movido a modules/contabilidad/index.js: _gfBackup */
// Regenera el PDF de cada recibo afectado (ya con su folio NUEVO aplicado en r.folio) y lo sube.
/* Movido a modules/recibos/index.js: _gfRegenerarPDFs */
// Borra de R2/Drive los PDFs viejos identificados por {folio, letra, nombre}.
// FIX: igual que _gfActualizarVersionesSB y _gfRegenerarPDFs — estas llamadas
// no tenían timeout. `.catch(function(){})` solo protege contra un RECHAZO,
// no contra una petición que se queda pendiente sin resolver ni rechazar
// (worker sin responder). Se envuelve cada llamada con _sbConTimeout para
// garantizar que el loop siempre avance, aunque una borrada falle o tarde.
/* Movido a modules/recibos/index.js: _gfBorrarPDFsViejos */
// Nombres cortos NUEVOS (canónicos) de un conjunto de recibos ya renumerados.
/* Movido a modules/recibos/index.js: _gfNombresNuevos */
// Actualiza folio_base en versiones_recibo (Supabase) en el ORDEN dado, para
// no chocar con el índice único (despacho_id, folio_base, anio_folio, letra).
/* Movido a modules/integraciones/index.js: _gfActualizarVersionesSB */
// ── PROTECCIÓN CONTRA RESURRECCIÓN DE FOLIOS VIEJOS ──────────────────
// BUG RAÍZ encontrado: syncEstadoSupabase() hace una fusión "local vs SB"
// por clave folio+letra, y si una clave YA NO existe en local pero SÍ existe
// en el snapshot de SB (leído justo antes de escribir), la trae de vuelta
// asumiendo que es un recibo que "solo existe en un lado" y debe conservarse
// (protección normal contra pérdida de datos entre 2 usuarios). Pero cuando
// el Gestor de Folios RENUMERA (folio 74→75, 75→76…), la clave vieja "74|A"
// desaparece de local a propósito — y como SB todavía no tiene la
// renumeración (se lee ANTES de escribir), su versión vieja de "74|A" se
// resucita y se vuelve a guardar, dejando el folio "ocupado" otra vez pese a
// que el Gestor de Folios reportó éxito. Este set marca esas claves como
// vaciadas A PROPÓSITO para que syncEstadoSupabase() NO las resucite.
// FIX (corrupción real del 28/jul): la protección de arriba SOLO vivía en la
// memoria de la pestaña donde corría el Gestor de Folios. Cualquier OTRA
// pestaña/dispositivo abierto (ej. la de la empleada) no tenía este Set, así
// que cuando SU sync corría, no sabía que esas claves estaban vaciadas a
// propósito y las resucitaba igual — creando duplicados que el siguiente
// intento de "Insertar espacio" volvía a desplazar, produciendo el desastre
// donde el mismo cliente terminó smeared en 8 folios distintos. Ahora,
// además del Set en memoria (que se conserva por si algo más lo usa), se
// agrega un tombstone REAL y PERSISTENTE en folios_eliminados — el mismo
// mecanismo que usa el resto del sistema (con ts=Date.now()+10000 para que
// gane sobre cualquier _revivedTs viejo) — así que CUALQUIER sesión que
// sincronice después, no solo esta pestaña, respeta la vacante.
window._gfClavesVacadasTemporal = window._gfClavesVacadasTemporal || new Set();
/* Movido a modules/recibos/index.js: _gfMarcarVaciados */
// ── PROTECCIÓN CONTRA TOMBSTONE APLICADO A RECIBO RENUMERADO ─────────
// BUG RAÍZ encontrado (folio 97→eliminado con "cerrar hueco", folio 98
// desapareció por completo): al eliminar un folio se agrega un tombstone
// {folio:folioN, letra} para que ese folio+letra no reaparezca. Pero acto
// seguido, "cerrar hueco" RENUMERA los folios siguientes hacia abajo, y el
// recibo que antes era folioN+1 pasa a ocupar EXACTAMENTE folioN — la misma
// clave folio+letra que el tombstone recién creado. _tombstoneAplicaA()
// compara solo por folio+letra (sin distinguir "el recibo viejo que se
// eliminó" de "el recibo distinto que ahora legítimamente ocupa ese
// número"), y como el recibo renumerado no pasa por _revivirSiTombstone()
// (eso solo corre en creación, no en renumeración), quedaba sin
// _revivedTs y el tombstone lo borraba por completo en el siguiente
// syncEstadoSupabase(). Aquí, justo después de renumerar, se elimina de
// folios_eliminados cualquier tombstone cuya clave folio+letra ahora esté
// ocupada por un recibo VIVO que acaba de renumerarse a ese número —
// ese tombstone ya cumplió su propósito (el recibo original sí se borró)
// y dejarlo solo pondría en riesgo al nuevo ocupante legítimo.
/* Movido a modules/recibos/index.js: _gfLimpiarTombstonesRenumerados */
// Verifica que el folio realmente haya quedado libre tras la operación —
// si el bug de resurrección (o cualquier otra falla silenciosa de sync)
// dejó el folio ocupado, avisa claramente en vez de reportar éxito falso.
/* Movido a modules/recibos/index.js: _gfVerificarLibre */
// Apunta el contador al folio indicado y lo persiste (mismo flujo que el sistema).
/* Movido a modules/recibos/index.js: _gfFijarContador */

// ── OPERACIÓN: INSERTAR (hacer espacio, recorre +1) ──────────────────
/* Movido a modules/recibos/index.js: _gfInsertarEjecutar */

// ── OPERACIÓN: ELIMINAR (cerrar o dejar hueco) ───────────────────────
/* Movido a modules/recibos/index.js: _gfEliminarEjecutar */

// ── UI: modal del gestor ─────────────────────────────────────────────
/* Movido a modules/recibos/index.js: abrirGestorFolios */
/* Movido a modules/core/index.js: _gfLog */
/* Movido a modules/core/index.js: _gfBloquear */
/* Movido a modules/recibos/index.js: _gfUIInsertar */
/* Movido a modules/recibos/index.js: _gfUIEliminar */

// ── Cerrar hueco vacío (folio sin recibo) ────────────────────────
/* Movido a modules/recibos/index.js: _gfUICerrarHuecoVacio */

// ══════════════════════════════════════════════════════════════════
// CORREGIR LETRAS DE MOVIMIENTOS — Repara movimientos con letra 'A'
// que deberían tener la letra de la versión más reciente del recibo
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// CORREGIR LETRAS + VERIFICAR R2 — función permanente
// Se ejecuta: (1) manualmente desde el panel admin,
//             (2) automáticamente al cargar (modo silencioso, sin confirm)
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: adminCorregirLetrasMovimientos */
// ══════════════════════════════════════════════════════════════════
// SIMPLIFICAR DESCRIPCIONES HISTÓRICAS — reescribe la descripción de TODOS
// los movimientos de recibo ya guardados al formato "Concepto — Descripción"
// (el mismo que usan ahora los 4 flujos de guardado y el motor de
// auto-recuperación), reemplazando el formato viejo "Recibo #X · Nombre · ...".
// NO toca montos, fechas, folios ni letras — solo el texto de descripcion.
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: adminSimplificarDescripcionesRecibos */
// ══════════════════════════════════════════════════════════════════
// AGRUPAR DESCRIPCIONES DE CARRITO HISTÓRICAS — reescribe movimientos de
// Contabilidad ya guardados con "[Carrito] X $Y | X $Y" (mismo artículo
// repetido dos o más veces por separado) al formato agrupado
// "2× X $Y c/u $Z" que ya usan los carritos nuevos.
// NO toca montos, fechas ni folios — solo el texto de descripcion.
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: adminAgruparDescripcionesCarrito */
// ══════════════════════════════════════════════════════════════════
// VINCULAR HISTORIAL ↔ CONTABILIDAD — repara enlaces folio/letra (sin
// tocar montos) y regulariza el orden del historial igual que contabilidad.
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: adminVincularHistorialContab */
// Ejecutar automáticamente al cargar — modo silencioso
// Se lanza después de que Supabase cargó los datos (debounced 8s)
var _autoCorregirTimer = null;
/* Movido a modules/administracion/index.js: _autoCorregirLetrasR2 */
// ══════════════════════════════════════════════════════════════════
// MARCAR PAGADO — Regenera PDFs liquidados que no tienen marca de agua
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: adminMarcaPagadoPDFs */
// ══════════════════════════════════════════════════════════════════
// MIGRAR A FOLIOS INFINITOS — Renumera todos los recibos 26-083A → 1A, 2A, 3A…
// Regenera todos los PDFs y actualiza R2, Supabase y datos locales.
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: adminMigrarFoliosInfinitos */

// ══════════════════════════════════════════════════════════════════
// NORMALIZAR NOMBRES R2 — Renombra cualquier nombre largo a formato corto canónico
// Ej: Recibo_14A_NOMBRE.pdf → 14A.pdf    |    26-083A_NOMBRE.pdf → 26-083A.pdf
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: adminNormalizarNombresR2 */
// ══════════════════════════════════════════════════════════════════
// LIMPIAR PDFs HUÉRFANOS EN R2 — Elimina archivos sin recibo vinculado
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: adminLimpiarPDFsHuerfanos */
// ══════════════════════════════════════════════════════════════════
// BORRAR MOVIMIENTOS POR FECHA — Eliminación permanente con sync garantizado
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: adminAbrirBorrarPorFecha */
/* Movido a modules/administracion/index.js: adminBorrarFechaPreview */
/* Movido a modules/administracion/index.js: adminBorrarMovimientosPorFecha */
// ══════════════════════════════════════════════════════════════════
// EDITAR COBROS / EGRESOS — Zona nueva (botón 11)
// ══════════════════════════════════════════════════════════════════
var _adminEditarTipoFiltro = 'todos';
/* Movido a modules/administracion/index.js: adminAbrirEditarCobros */
/* Movido a modules/administracion/index.js: adminVolverEditarCobros */
/* Movido a modules/administracion/index.js: adminFiltroTipo */
/* Movido a modules/administracion/index.js: adminActualizarBotonesFiltro */
/* Movido a modules/administracion/index.js: adminFiltrarMovsEditar */
/* Movido a modules/core/index.js: _fechaDDMMAAAA */
// Si la búsqueda viene como "11/06/2026" o "11-06-2026" (dd/mm/aaaa con / o -),
// la convierte a "2026-06-11" (formato ISO en que se guarda m.fecha) para poder
// compararla. Si no tiene esa forma, regresa null (se usa la búsqueda normal).
/* Movido a modules/core/index.js: _normalizarFechaBusqueda */
/* Movido a modules/administracion/index.js: adminRenderMovsEditar */
/* Movido a modules/administracion/index.js: adminAbrirEditarMovDesdeEditar */
// Marca que un movimiento (manual/caja, no de recibo) se acaba de editar
// localmente — usado por sincronizarFolio() para NO dejar que un pull de
// Supabase (polling de respaldo cada 30s, o broadcast Realtime de otro
// dispositivo/pestaña) revierta la edición mientras la subida debounced
// (syncEstadoSupabaseDebounced, 800ms) todavía no llega al servidor.
/* Movido a modules/core/index.js: _marcarMovEditadoLocal */
// Misma idea que _marcarMovEditadoLocal pero para BORRADOS de movimientos
// manuales/caja (botón ✕ "Eliminar movimiento" en Borrar Cobro Específico).
// El borrado quita el id de D.movimientos en memoria y agenda la subida a
// Supabase 800ms después (vía guardarTodo→syncEstadoSupabaseDebounced) — si
// un pull llega antes (polling/Realtime), Supabase todavía tiene el
// movimiento viejo y, sin esta marca, el merge de sincronizarFolio() lo
// reinserta en D.movimientos, haciendo parecer que "no se guardó" el borrado.
/* Movido a modules/core/index.js: _marcarMovEliminadoLocal */
// Mismo patrón que _marcarMovEliminadoLocal, aplicado a pendientes: al marcar
// resuelto (toggleP) o eliminar (eliminarPend) ahora se borra el pendiente
// para siempre en memoria y se agenda el push a Supabase — si un pull llega
// antes de que ese push se confirme, sin esta marca el merge de
// sincronizarFolio() lo resucitaría con la copia vieja del servidor.
/* Movido a modules/core/index.js: _marcarPendEliminadoLocal */
// Mismo patrón, para juicios (confirmarEliminarJuicio) y contactos del
// directorio (eliminarContacto) — ver uso en el merge de sincronizarFolio().
/* Movido a modules/expedientes/index.js: _marcarJuicioEliminadoLocal */
/* Movido a modules/directorio/index.js: _marcarContactoEliminadoLocal */
// Mismo patrón, para citas (citaEliminar y la auto-limpieza citasLimpiarPasadas).
// Caso real: se borra una cita (manual o por vencida) pero, con dos
// computadoras conectadas al mismo despacho (admin + empleada), el pull de
// alguna de las dos (polling de 30s, Realtime, o al entrar al panel) llegaba
// antes de que el push del borrado se confirmara en Supabase — el merge de
// sincronizarFolio() todavía veía la cita en la copia vieja del servidor y la
// resucitaba en D.citas. Por eso la cita "se borraba y luego volvía a
// aparecer".
/* Movido a modules/expedientes/index.js: _marcarCitaEliminadaLocal */
/* Movido a modules/administracion/index.js: adminGuardarEdicion2Mov */
// ══ FIN EDITAR COBROS / EGRESOS ══
/* Movido a modules/administracion/index.js: adminAbrirBorrarEspecifico */
/* Movido a modules/administracion/index.js: adminVolverPanel */
/* Movido a modules/administracion/index.js: adminFiltrarMovimientos */
/* Movido a modules/administracion/index.js: adminRenderMovimientos */
/* Movido a modules/administracion/index.js: adminBorrarMovEspec */
/* Movido a modules/administracion/index.js: adminEditarMovEspec */
/* Movido a modules/administracion/index.js: adminVolverBorrar */
/* Movido a modules/administracion/index.js: adminGuardarEdicionMov */
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// MOVIMIENTOS HISTÓRICOS — Solo captura RETROACTIVA
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: adminAbrirHistoricos */
/* Movido a modules/administracion/index.js: adminVolverDesdeHistoricos */
// Stub no-op para compatibilidad con código antiguo que pueda seguir llamándola
/* Movido a modules/administracion/index.js: adminHistTab */
/* Movido a modules/core/index.js: escHtml */
// ═══ CAPTURA RETROACTIVA — integrada en Movs. Históricos (rueda dentada) ═══
/* Movido a modules/administracion/index.js: adminRetroInicializar */
/* Movido a modules/administracion/index.js: adminRetroSetTipo */
/* Movido a modules/administracion/index.js: adminConfirmarRetro */
// ═══ FIN CAPTURA RETROACTIVA INTEGRADA ═══
// Cerrar modal al click fuera
document.getElementById('adminModalOv').addEventListener('click', function(e){
  if (e.target === this) cerrarAdminModal();
});
/* Movido a modules/administracion/index.js: adminTogglePass */
// ── PUENTE DRIVE: iniciarDriveAuth() del recibo → iniciarAuth() del LEX ──
// El botón del sidebar (driveChipClick → iniciarAuth) es el único punto de entrada.
// Cuando el recibo llama iniciarDriveAuth(), redirigimos al LEX.
var _origIniciarDriveAuth = typeof iniciarDriveAuth === 'function' ? iniciarDriveAuth : null;
/* Movido a modules/documentos/index.js: rec_iniciarDriveAuth */
// Sincronizar el badge del recibo con el estado del LEX
/* Movido a modules/recibos/index.js: _sincronizarDriveBadgeRecibo */
// AVISO: cuando se intenta movimiento sin Drive → modal del LEX
/* Movido a modules/documentos/index.js: _checkDriveAntesDe */
// ── Modal Drive desconectado para el LEX ──────────────────────────
/* Movido a modules/documentos/index.js: mostrarModalDriveDesconectado */
/* Movido a modules/documentos/index.js: cerrarModalDriveDesconectado */
// Parchear _registrarMovimiento para avisar si no hay sesión activa al registrar movimientos
// NOTA: addMov no existe en este archivo; la función real es _registrarMovimiento
var _origRegistrarMovimiento = typeof _registrarMovimiento === 'function' ? _registrarMovimiento : null;
if (_origRegistrarMovimiento) {
  _registrarMovimiento = function(mov) {
    if (!sbSession || Date.now() >= sbExpiry) {
      mostrarModalDriveDesconectado();
      // Igual permitir el movimiento local
    }
    return _origRegistrarMovimiento.apply(this, arguments);
  };
}
// ── MODAL: REORDENAR / COMPACTAR FOLIOS ─────────────────────────────────────
/* Movido a modules/administracion/index.js: adminReordenarFolios */
/* Movido a modules/administracion/index.js: adminConfirmarReordenarFolios */
// Apunta folioActual al primer hueco disponible sin renumerar nada.
// Los nuevos recibos irán llenando huecos de forma natural.
/* Movido a modules/administracion/index.js: adminUsarSiguienteHueco */
// ══════════════════════════════════════════════════════════════════
// ADMIN — GESTIÓN DE RECIBOS
// ══════════════════════════════════════════════════════════════════
/* Movido a modules/administracion/index.js: adminAbrirGestionRecibos */
/* Movido a modules/administracion/index.js: adminFiltrarRecibos */

// ── CORREGIR MOVIMIENTOS HUÉRFANOS ────────────────────────────────────────
/* Movido a modules/administracion/index.js: adminAbrirCorregirMovs */

/* Movido a modules/administracion/index.js: adminCorregirRender */

/* Movido a modules/administracion/index.js: adminCorregirCambiarLetra */

/* Movido a modules/administracion/index.js: adminCorregirEliminarMov */

// Filtrado compartido por la lista normal y por "Eliminar varios" (deben ver
// exactamente los mismos resultados). Si la búsqueda es puramente numérica,
// compara el NÚMERO DE FOLIO exacto (ignorando la letra de versión) — antes
// "6" hacía match de texto contra fecha/folio formateado y traía folios como
// 16, 26, 36, o cualquier recibo de 2026 (la fecha "2026-06-13" ya contiene
// un "6"). Con número exacto, "6" solo trae 6A, 6B, 6C, etc.
/* Movido a modules/administracion/index.js: adminFiltrarRecibosArr */

/* Movido a modules/administracion/index.js: adminRenderRecibos */

// ═══════════════════════════════════════════════════════════════════════════
// "ELIMINAR VARIOS" — selección múltiple sobre los resultados de búsqueda
// Flujo: se pulsa "Eliminar varios" → se muestran TODOS los resultados ya
// marcados con casilla; el usuario desmarca los que NO quiere borrar; al
// confirmar, se eliminan solo los que quedaron marcados.
// ═══════════════════════════════════════════════════════════════════════════
var _adminBulkModoActivo = false;
var _adminBulkSeleccionados = new Set();

/* Movido a modules/administracion/index.js: adminBulkActivar */

/* Movido a modules/administracion/index.js: adminBulkToggle */

/* Movido a modules/administracion/index.js: adminBulkActualizarContador */

/* Movido a modules/administracion/index.js: adminBulkSeleccionarTodos */

/* Movido a modules/administracion/index.js: adminBulkDeseleccionarTodos */

/* Movido a modules/administracion/index.js: adminBulkCancelar */

/* Movido a modules/administracion/index.js: adminBulkEliminarSeleccionados */
// ═════════════════════════════════════════════════════════════════
// MODAL #modal-eliminar-recibo — handlers para sus botones
// ─────────────────────────────────────────────────────────────────
// El modal está en el HTML pero ningún flujo actual lo invoca; estas
// funciones existen para evitar ReferenceError si el modal se llegara
// a disparar por algún camino legacy. Validan la sesión real de
// administrador (_esAdminReal) y delegan en adminEliminarRecibo(), que
// es el flujo real de borrado.
//
// Si quieres usar el modal explícitamente, llama:
//   _abrirModalEliminarRecibo(folioNumero)
// y los handlers harán el resto.
// ─────────────────────────────────────────────────────────────────
var _delRecFolioObjetivo = null;
/* Movido a modules/recibos/index.js: _abrirModalEliminarRecibo */
/* Movido a modules/recibos/index.js: cerrarModalEliminarRecibo */
/* Movido a modules/administracion/index.js: confirmarEliminarRecibo */
// ── Crear pendiente de placas manualmente desde un recibo existente ──
/* Movido a modules/administracion/index.js: adminCrearPendientePlacas */
// También accesible desde consola
window.lexCrearPendientePlacas = adminCrearPendientePlacas;
/* Movido a modules/administracion/index.js: adminEliminarReciboPorFolio */
// ═══════════════════════════════════════════════════════════════════════════
// SCAN DE RECIBOS — Auditoría dato-vs-dato (Fase 1)
// Verifica por folio: consistencia de montos, recibo↔contabilidad, e integridad
// del nombre/folio del PDF (formato viejo 26-001A vs nuevo). Acciones por folio:
// Ver PDF · Editar · Migrar nombre · Regenerar PDF · Eliminar (confirma 1x1).
// ═══════════════════════════════════════════════════════════════════════════
(function(){
  function _scEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function _scNum(v){ var n=parseFloat(v); return isNaN(n)?0:n; }
  function _scFmt(v){ return typeof fmtMXN==='function'?fmtMXN(_scNum(v)):_scNum(v).toFixed(2); }
  var _scTOL = 0.5; // tolerancia en pesos
  // Estatus VÁLIDOS reales que el sistema escribe en contabilidad (verificados en el código).
  var _scESTATUS_VALIDOS = ['Original','Anticipo','Sin Anticipo','Abono parcial','Liquidado','Liquidación','Complementario','Cancelación','Pendiente'];
  // ── REGLAS ESPERADAS DE UN FOLIO SANO (qué debe buscar y comparar el scan) ──
  //  1) Existe la versión A (original) y la secuencia de letras es CONTIGUA (A,B,C… sin huecos).
  //  2) No hay letras duplicadas; la letra guardada coincide con la calculada por impresiones.
  //  3) Cada versión con abono tiene su movimiento; sin movimientos huérfanos.
  //  4) El estatus de cada movimiento está dentro del set válido real.
  //  5) Cancelado ⇒ existe movimiento 'Cancelación'.  Liquidado (saldo $0) ⇒ existe 'Liquidado/Liquidación'.
  //     Si hay 'Liquidado' pero el saldo no es $0 → incoherencia crítica.
  //  6) total = abonado + saldo; el PDF de la última versión tiene formato nuevo y su mismo folio.

  function _scAnalizarNombre(archivo){
    if(!archivo) return {tieneNombre:false};
    var nuevo = /^(\d+)([A-Za-z])\.pdf$/i.exec(archivo);
    if(nuevo) return {tieneNombre:true, formato:'nuevo', folio:parseInt(nuevo[1],10)};
    var viejo = /^(\d{2})-(\d+)([A-Za-z])\.pdf$/i.exec(archivo);
    if(viejo) return {tieneNombre:true, formato:'viejo', folio:parseInt(viejo[2],10)};
    var desc = /^(\d+)([A-Za-z])_/i.exec(archivo);
    if(desc) return {tieneNombre:true, formato:'descriptivo', folio:parseInt(desc[1],10)};
    return {tieneNombre:true, formato:'desconocido'};
  }

  window.scanRecibosAuditar = function(){
    var recibos = (typeof appData!=='undefined' && appData.recibos) ? appData.recibos : [];
    var movs = (typeof getAllMovs==='function') ? getAllMovs() : ((typeof D!=='undefined'&&D.movimientos)?D.movimientos:[]);
    var folios = {};
    recibos.forEach(function(r){
      if(r.esComplemento) return;
      var f=r.folio;
      if(!folios[f]) folios[f]={folio:f,nombre:r.nombre||'',versiones:[]};
      folios[f].versiones.push(r);
    });
    var resultados=[];
    Object.keys(folios).forEach(function(fk){
      var g=folios[fk], folio=g.folio;
      g.versiones.sort(function(a,b){return (a.letra||'A').localeCompare(b.letra||'A');});
      var ultima=g.versiones[g.versiones.length-1];
      var primera=g.versiones[0];
      var problemas=[];
      var movsFolio=movs.filter(function(m){return m.folio===folio||m.folio===String(folio)||parseInt(m.folio)===parseInt(folio);});

      // total: usa el recibo ORIGINAL (letra A), no "ultima" — el campo total
      // del último recibo no siempre es el pactado completo (en un Pago
      // Total/Liquidación se reescribe como el adeudo que se está saldando a
      // $0). Ver mismo criterio y ejemplo real en reconstruirFolio (SCANSYS PRO).
      var total=_scNum(primera.total), saldo=_scNum(ultima.saldoPendiente), abonadoSist=total-saldo;
      if(saldo < -_scTOL) problemas.push({sev:'critico', txt:'Saldo pendiente negativo: '+_scFmt(saldo)});
      if(total<=0) problemas.push({sev:'warn', txt:'Total del trámite en cero o inválido'});

      // ── Detectar si el folio es un anticipo pendiente de liquidar ──
      // Casos normales con saldo pendiente:
      //   1. El movimiento tiene estatus 'Anticipo' — pago parcial registrado, aún falta liquidar
      //   2. El recibo tiene campo anticipo > 0 y saldo > 0 sin movimiento de Liquidado/Liquidación
      // En cualquiera de estos casos los "errores" contables son ESPERADOS, no reales.
      var esAnticipoEnProceso = (function(){
        var hayLiquidacion = movsFolio.some(function(m){
          var e=(m.estatus||''); return e==='Liquidado'||e==='Liquidación';
        });
        if(hayLiquidacion || ultima.cancelado || saldo <= _scTOL) return false;
        // El movimiento dice explícitamente que es un anticipo parcial
        var movDiceAnticipo = movsFolio.some(function(m){
          var e=(m.estatus||''); return e==='Anticipo'||e==='Abono parcial'||e==='Sin Anticipo'||e==='Pendiente';
        });
        // O el recibo tiene campo anticipo menor al total (no está liquidado completamente)
        var campoAnticipo = _scNum(ultima.anticipo||0) > 0 ||
                            g.versiones.some(function(v){ return _scNum(v.anticipo||0)>0; });
        return movDiceAnticipo || campoAnticipo;
      })();

      var abonadoMovs=0;
      movsFolio.forEach(function(m){
        var est=(m.estatus||'');
        if(est==='Complementario') return;
        if(est==='Cancelado' || m.cancelado) return;
        var mo=_scNum(m.monto); if(mo>0) abonadoMovs+=mo;
      });
      // Para anticipos en proceso, el descuadre es esperado: los movimientos
      // reflejan solo lo recibido hasta ahora, el total incluye lo pendiente.
      if(!ultima.cancelado && !esAnticipoEnProceso && Math.abs(abonadoMovs-abonadoSist) > _scTOL){
        problemas.push({sev:'critico', txt:'Contabilidad no cuadra: abonado en recibo '+_scFmt(abonadoSist)+' vs movimientos '+_scFmt(abonadoMovs)+' (dif '+_scFmt(Math.abs(abonadoMovs-abonadoSist))+')'});
      }

      g.versiones.forEach(function(r){
        if(r.cancelado) return;
        var letra=r.letra||'A', esA=letra==='A';
        var montoV= esA ? _scNum(r.anticipo) : _scNum(r.pago||r.anticipo);
        if(montoV<=0) return;
        var tiene=movsFolio.some(function(m){return (m.letra||'A')===letra && (m.estatus||'')!=='Complementario';});
        // En anticipos en proceso, versiones intermedias sin movimiento contable aún son normales.
        if(!tiene && !esAnticipoEnProceso) problemas.push({sev:'warn', txt:'Versión '+letra+' sin movimiento en contabilidad (abono '+_scFmt(montoV)+')'});
      });

      movsFolio.forEach(function(m){
        if((m.estatus||'')==='Complementario') return;
        var ml=m.letra||'A';
        var hay=g.versiones.some(function(r){return (r.letra||'A')===ml;});
        // En anticipos en proceso, puede haber movimientos de abonos sin recibo de versión aún — normal.
        if(!hay && !esAnticipoEnProceso) problemas.push({sev:'warn', txt:'Movimiento de versión '+ml+' sin recibo correspondiente'});
      });

      var info=_scAnalizarNombre(ultima.archivo||ultima.archivoR2||'');
      var nombreCanon=(typeof folioConLetra==='function'?folioConLetra(folio,ultima.anio_folio,ultima.letra||'A'):folio)+'.pdf';
      if(!info.tieneNombre){
        problemas.push({sev:'critico', txt:'Sin archivo PDF asignado'});
      } else if(info.formato==='viejo'){
        problemas.push({sev:'warn', migrar:true, txt:'PDF en formato viejo ('+_scEsc(ultima.archivo)+') — conviene migrar a '+nombreCanon});
      } else if(info.formato==='desconocido'){
        problemas.push({sev:'warn', txt:'Nombre de PDF con formato no reconocido: '+_scEsc(ultima.archivo)});
      } else if(info.folio!=null && info.folio!==parseInt(folio)){
        problemas.push({sev:'critico', txt:'El PDF apunta a otro folio: archivo '+_scEsc(ultima.archivo)+' pero el recibo es folio '+folio});
      }

      // ── Reglas estructurales del folio (qué buscar y comparar) ──
      var letrasPresentes = g.versiones.map(function(r){return (r.letra||'A');});
      // a) Existe la versión A
      if(letrasPresentes.indexOf('A')<0) problemas.push({sev:'critico', txt:'Falta la versión original (A) del folio'});
      // b) Letras duplicadas
      var _dups={}, _vistos={};
      letrasPresentes.forEach(function(l){ if(_vistos[l]) _dups[l]=true; _vistos[l]=true; });
      Object.keys(_dups).forEach(function(l){ problemas.push({sev:'critico', txt:'Letra de versión duplicada: '+l}); });
      // c) Secuencia contigua (sin huecos)
      var _codes = letrasPresentes.map(function(l){return l.charCodeAt(0);}).sort(function(a,b){return a-b;});
      for(var _k=1;_k<_codes.length;_k++){
        if(_codes[_k]-_codes[_k-1] > 1){
          problemas.push({sev:'warn', txt:'Hueco en la secuencia de versiones: falta '+String.fromCharCode(_codes[_k-1]+1)+' (hay '+String.fromCharCode(_codes[_k-1])+' y '+String.fromCharCode(_codes[_k])+')'});
        }
      }
      // d) Letra guardada vs calculada por impresiones
      g.versiones.forEach(function(r){
        if(typeof letraVersion!=='function') return;
        var calc=letraVersion(r);
        if(r.letra && calc && r.letra!==calc){
          problemas.push({sev:'warn', txt:'Versión '+r.letra+': la letra guardada no coincide con la calculada por impresiones ('+calc+')'});
        }
      });
      // e) Estatus válido en los movimientos
      movsFolio.forEach(function(m){
        var est=(m.estatus||'');
        if(est && _scESTATUS_VALIDOS.indexOf(est)<0){
          problemas.push({sev:'warn', txt:'Movimiento con estatus no reconocido: "'+_scEsc(est)+'" (versión '+(m.letra||'?')+')'});
        }
      });
      // f) Coherencia de liquidación / cancelación
      var hayLiqMov=movsFolio.some(function(m){ var e=(m.estatus||''); return e==='Liquidado'||e==='Liquidación'; });
      var hayCancelMov=movsFolio.some(function(m){ return (m.estatus||'')==='Cancelación'; });
      if(ultima.cancelado){
        if(!hayCancelMov) problemas.push({sev:'warn', txt:'Folio marcado como cancelado pero sin movimiento de Cancelación en contabilidad'});
      } else {
        if(saldo<=_scTOL && total>0 && g.versiones.length>1 && !hayLiqMov){
          problemas.push({sev:'warn', txt:'Folio liquidado (saldo $0) sin movimiento de Liquidación registrado'});
        }
        // Solo marcar error si hay liquidación Y saldo pendiente Y NO es anticipo en proceso.
        // En anticipos en proceso, un movimiento de "Liquidación parcial" o anticipo
        // con saldo pendiente es normal — el trámite aún no está terminado.
        if(saldo>_scTOL && hayLiqMov && !esAnticipoEnProceso){
          problemas.push({sev:'critico', txt:'Hay movimiento de Liquidación pero el saldo no es $0 (saldo '+_scFmt(saldo)+')'});
        }
      }
      // g) Informativo: anticipo en proceso (no es error, solo informar)
      if(esAnticipoEnProceso){
        problemas.push({sev:'info', txt:'Anticipo en proceso — pendiente de liquidar (saldo '+_scFmt(saldo)+')'});
      }

      var critico=problemas.some(function(p){return p.sev==='critico';});
      var warn=problemas.some(function(p){return p.sev==='warn';});
      // Los problemas de severidad 'info' (ej: anticipo en proceso) no elevan la severidad a warn/critico
      var soloInfo=!critico && !warn && problemas.some(function(p){return p.sev==='info';});
      resultados.push({folio:folio,nombre:g.nombre,anio:ultima.anio_folio,ultimaLetra:ultima.letra||'A',
        cancelado:!!ultima.cancelado, severidad:critico?'critico':(warn?'warn':'ok'),
        problemas:problemas, total:total, abonado:abonadoSist, saldo:saldo});
    });
    var orden={critico:0,warn:1,ok:2};
    resultados.sort(function(a,b){return (orden[a.severidad]-orden[b.severidad])||(parseInt(a.folio)-parseInt(b.folio));});
    return resultados;
  };

  window.ssRenderRecibos = function(body){
    if(!body) return;
    var res;
    try{ res=window.scanRecibosAuditar(); }
    catch(e){ body.innerHTML='<div style="color:rgba(220,80,80,0.9);padding:20px;font-size:0.7rem;">Error al auditar: '+_scEsc(e.message)+'</div>'; return; }
    var nOk=res.filter(function(r){return r.severidad==='ok';}).length;
    var nWarn=res.filter(function(r){return r.severidad==='warn';}).length;
    var nCrit=res.filter(function(r){return r.severidad==='critico';}).length;
    var head='<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center;">'
      +'<button onclick="ssRenderRecibos(document.getElementById(\'ss-body\'))" style="background:rgba(200,149,42,0.12);border:1px solid rgba(200,149,42,0.35);border-radius:9px;padding:6px 14px;color:rgba(200,149,42,0.9);font-family:monospace;font-size:0.64rem;cursor:pointer;letter-spacing:0.06em;">🔄 RE-ESCANEAR</button>'
      +'<span style="font-size:0.62rem;color:rgba(80,200,120,0.85);">✅ '+nOk+' OK</span>'
      +'<span style="font-size:0.62rem;color:rgba(200,160,60,0.9);">⚠️ '+nWarn+' advertencias</span>'
      +'<span style="font-size:0.62rem;color:rgba(220,80,80,0.9);">❌ '+nCrit+' críticos</span>'
      +'<span style="font-size:0.62rem;color:rgba(200,149,42,0.4);margin-left:auto;">'+res.length+' folios revisados</span>'
      +'</div>'
      +'<label style="display:flex;align-items:center;gap:6px;font-size:0.6rem;color:rgba(200,149,42,0.55);margin-bottom:10px;cursor:pointer;"><input type="checkbox" '+(window._scSoloProb?'checked':'')+' onchange="window._scSoloProb=this.checked;ssRenderRecibos(document.getElementById(\'ss-body\'))"> Mostrar solo folios con problemas</label>';
    var lista=res.filter(function(r){return window._scSoloProb?r.severidad!=='ok':true;});
    if(!lista.length){ body.innerHTML=head+'<div style="text-align:center;color:rgba(80,200,120,0.6);font-size:0.7rem;padding:24px;">✅ Todo en orden</div>'; return; }
    body.innerHTML=head+lista.map(_scTarjeta).join('');
  };

  function _scTarjeta(r){
    var col=r.severidad==='critico'?{b:'rgba(192,22,26,0.5)',bg:'rgba(192,22,26,0.06)',ic:'❌'}
          :r.severidad==='warn'?{b:'rgba(200,149,42,0.45)',bg:'rgba(200,149,42,0.05)',ic:'⚠️'}
          :{b:'rgba(80,200,120,0.35)',bg:'rgba(80,200,120,0.04)',ic:'✅'};
    var folioStr=(typeof folioConLetra==='function'?folioConLetra(r.folio,r.anio,r.ultimaLetra):r.folio+r.ultimaLetra);
    var probs=r.problemas.map(function(p){
      var c = p.sev==='critico' ? 'rgba(230,120,120,0.95)'
            : p.sev==='info'   ? 'rgba(100,180,255,0.85)'
            :                    'rgba(210,180,120,0.9)';
      return '<div style="font-size:0.64rem;color:'+c+';line-height:1.5;">• '+_scEsc(p.txt)+'</div>';
    }).join('');
    var hayViejo=r.problemas.some(function(p){return p.migrar;});
    var hayRastros=r.problemas.some(function(p){
      return p.txt && (
        p.txt.indexOf('Movimiento de versión')>=0 ||
        p.txt.indexOf('sin recibo correspondiente')>=0 ||
        p.txt.indexOf('Hueco en la secuencia')>=0
      );
    });
    var L="'"+r.ultimaLetra+"'";
    var acciones='<div style="display:flex;gap:6px;margin-top:9px;justify-content:flex-end;flex-wrap:wrap;">'
      +'<button onclick="scanRecibosVerPDF('+r.folio+','+L+')" style="background:rgba(80,150,255,0.12);border:1px solid rgba(80,150,255,0.4);border-radius:7px;padding:4px 12px;color:rgba(140,190,255,0.95);font-family:monospace;font-size:0.6rem;cursor:pointer;">👁 Ver PDF</button>'
      +'<button onclick="scanRecibosEditar('+r.folio+','+L+')" style="background:rgba(200,149,42,0.1);border:1px solid rgba(200,149,42,0.35);border-radius:7px;padding:4px 12px;color:rgba(210,180,110,0.95);font-family:monospace;font-size:0.6rem;cursor:pointer;">✏️ Editar</button>'
      +(hayViejo?'<button onclick="scanRecibosMigrarNombre('+r.folio+','+L+',this)" style="background:rgba(120,80,220,0.12);border:1px solid rgba(120,80,220,0.4);border-radius:7px;padding:4px 12px;color:rgba(180,150,255,0.95);font-family:monospace;font-size:0.6rem;cursor:pointer;">🔁 Migrar nombre</button>':'')
      +(hayRastros?'<button onclick="scanRecibosLimpiarRastros('+r.folio+',this)" style="background:rgba(200,120,30,0.14);border:1.5px solid rgba(230,160,50,0.6);border-radius:7px;padding:4px 12px;color:rgba(255,195,100,0.97);font-family:monospace;font-size:0.6rem;cursor:pointer;font-weight:700;">🧹 Limpiar rastros</button>':'')
      +'<button onclick="scanRecibosRegenerar('+r.folio+','+L+',this)" style="background:rgba(80,200,120,0.1);border:1px solid rgba(80,200,120,0.3);border-radius:7px;padding:4px 12px;color:rgba(120,220,150,0.9);font-family:monospace;font-size:0.6rem;cursor:pointer;">♻️ Regenerar PDF</button>'
      +'<button onclick="scanRecibosEliminar('+r.folio+','+L+',this)" style="background:rgba(192,22,26,0.1);border:1px solid rgba(192,22,26,0.4);border-radius:7px;padding:4px 12px;color:rgba(230,110,110,0.95);font-family:monospace;font-size:0.6rem;cursor:pointer;">🗑 Eliminar</button>'
      +'</div>';
    return '<div style="border:1px solid '+col.b+';background:'+col.bg+';border-radius:10px;padding:11px 14px;margin-bottom:8px;">'
      +'<div style="display:flex;align-items:center;gap:8px;">'
      +'<span style="font-size:0.95rem;">'+col.ic+'</span>'
      +'<span style="font-family:monospace;font-weight:700;color:rgba(200,149,42,0.95);font-size:0.78rem;">#'+folioStr+'</span>'
      +'<span style="font-size:0.66rem;color:rgba(220,205,180,0.85);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_scEsc(r.nombre)+'</span>'
      +(r.cancelado?'<span style="font-size:0.55rem;color:rgba(220,110,110,0.9);border:1px solid rgba(192,22,26,0.4);border-radius:10px;padding:1px 7px;">CANCELADO</span>':'')
      +'</div>'
      +'<div style="display:flex;gap:14px;margin-top:5px;font-size:0.6rem;color:rgba(200,149,42,0.55);font-family:monospace;">'
      +'<span>Total '+_scFmt(r.total)+'</span><span>Abonado '+_scFmt(r.abonado)+'</span><span>Saldo '+_scFmt(r.saldo)+'</span></div>'
      +(probs?'<div style="margin-top:7px;">'+probs+'</div>':'<div style="margin-top:5px;font-size:0.62rem;color:rgba(80,200,120,0.7);">Sin observaciones</div>')
      +(r.severidad!=='ok'?acciones:'')
      +'</div>';
  }

  function _scBuscar(folio,letra){ return (typeof appData!=='undefined'&&appData.recibos?appData.recibos:[]).find(function(x){return x.folio===folio && (x.letra||'A')===letra;}); }
  function _scRefrescar(){ var b=document.getElementById('ss-body'); if(b && typeof ssRenderRecibos==='function') ssRenderRecibos(b); }
  // Exponer globalmente para que RFC y modal de duplicados puedan refrescar SCANSYS
  window._scRefrescar = _scRefrescar;

  window.scanRecibosVerPDF=function(folio,letra){
    if(typeof abrirPreviaDesdeContab==='function') abrirPreviaDesdeContab(folio,letra);
    else if(typeof toast==='function') toast('Visor no disponible','err');
  };
  window.scanRecibosEditar=function(folio,letra){
    var r=_scBuscar(folio,letra); if(!r){ toast('Recibo no encontrado','err'); return; }
    var p=document.getElementById('scansys-panel');
    if(typeof scansysToggle==='function' && p && p.style.display!=='none') scansysToggle();
    if(typeof editarReciboEnConsulta==='function') editarReciboEnConsulta(r);
    else if(typeof abrirPreviaDesdeContab==='function') abrirPreviaDesdeContab(folio,letra);
  };
  window.scanRecibosEliminar=function(folio,letra,btn){
    if(typeof adminEliminarReciboPorFolio==='function'){
      adminEliminarReciboPorFolio(btn,folio,letra);
      setTimeout(_scRefrescar,700);
    }
  };

  // ── Limpiar rastros: borra movimientos huérfanos sin eliminar ningún recibo ──
  window.scanRecibosLimpiarRastros=async function(folio,btn){
    if(!confirm('🧹 LIMPIAR RASTROS DEL FOLIO #'+folio+'\n\nSe eliminarán todos los movimientos contables de versiones que ya no existen como recibo (B, C, etc.).\n\nLos recibos activos y sus movimientos NO se tocan.\n\n¿Continuar?')) return;
    if(btn){ btn.disabled=true; btn.textContent='⏳ Limpiando...'; btn.style.opacity='0.6'; }
    try{
      var resultado = typeof window.limpiarRastrosMovimientos==='function'
        ? await window.limpiarRastrosMovimientos(folio, null)
        : { eliminados:0, descripcion:'Función no disponible' };
      if(typeof toast==='function') toast('🧹 '+resultado.descripcion, 'ok');
      setTimeout(_scRefrescar, 500);
    } catch(e){
      if(typeof toast==='function') toast('❌ Error al limpiar: '+(e.message||e), 'err');
      console.warn('[scanRecibosLimpiarRastros]', e);
    } finally {
      if(btn){ btn.disabled=false; btn.textContent='🧹 Limpiar rastros'; btn.style.opacity=''; }
    }
  };
  window.scanRecibosRegenerar=async function(folio,letra,btn){
    var r=_scBuscar(folio,letra); if(!r){ toast('Recibo no encontrado','err'); return; }
    var folioStr=typeof folioConLetra==='function'?folioConLetra(r.folio,r.anio_folio,letra):r.folio+letra;
    if(!confirm('¿Regenerar el PDF del folio #'+folioStr+'?')) return;
    if(btn){ btn.disabled=true; btn.style.opacity='0.5'; }
    try{
      // ── Blindar contra interrupciones del ciclo realtime durante la regeneración ──
      // Sin esto, el broadcast de otros clientes dispara syncEstadoSupabase() que hace
      // el merge local↔SB y puede crear un duplicado (10B) o borrar el 10A actualizado.
      _ultimoSyncPropio = Date.now();
      var qrTxt='LEX-MEXICO|Folio:'+folioStr+'|'+r.nombre+'|'+(r.fecha_recibo||r.fecha||'');
      var qrURL=(typeof qrToDataURL==='function')?await qrToDataURL(qrTxt):'';
      var doc=await generarPDF(Object.assign({},r,{anio_folio:r.anio_folio||2026,letra:letra}),r.folio,qrURL);
      r.pdfBase64=doc.output('datauristring');
      var nombreArch=folioStr+'.pdf';
      r.archivo=nombreArch; r.archivoR2=nombreArch; delete r.archivoR2Raiz;
      // ── Marcar _revivedTs para que este recibo gane en cualquier merge ──
      // Sin esto, en el merge bidireccional SB gana con la copia antigua y el
      // PDF regenerado queda huérfano o desaparece en el siguiente sync.
      r._revivedTs = Date.now();
      if(typeof window.subirR2==='function' && window.SB_DESPACHO_ID){
        var f=new File([doc.output('blob')],nombreArch,{type:'application/pdf'});
        await window.subirR2(f, window.SB_DESPACHO_ID+'/recibos/'+nombreArch, 'recibos');
      }
      // ── Persistir con actualizarArchivoControl (no sincronizarTodoAhora) ──
      // sincronizarTodoAhora() solo vacía la cola de Sheets — no graba recibos.
      // actualizarArchivoControl() hace el READ-MERGE-WRITE atómico en Supabase
      // y propaga _revivedTs para que todos los clientes vean la versión nueva.
      _ultimoSyncPropio = Date.now(); // renovar justo antes de escribir
      if(typeof actualizarArchivoControl==='function') await actualizarArchivoControl();
      toast('✅ PDF regenerado: '+folioStr,'ok');
    }catch(e){ console.warn('[scanRecibosRegenerar]',e); toast('❌ Error al regenerar','err'); }
    finally{ if(btn){ btn.disabled=false; btn.style.opacity=''; } _scRefrescar(); }
  };
  window.scanRecibosMigrarNombre=async function(folio,letra,btn){
    var r=_scBuscar(folio,letra); if(!r){ toast('Recibo no encontrado','err'); return; }
    var nuevo=(typeof folioConLetra==='function'?folioConLetra(r.folio,r.anio_folio,letra):r.folio+letra)+'.pdf';
    if(!confirm('¿Migrar el nombre del PDF de "'+(r.archivo||'(sin nombre)')+'" a "'+nuevo+'"?\n\nSe re-sube el PDF con el nombre nuevo en R2.')) return;
    if(btn){ btn.disabled=true; btn.style.opacity='0.5'; }
    try{
      var blob=(typeof window.obtenerBlobPdfReciboValidado==='function')?await window.obtenerBlobPdfReciboValidado(r):null;
      if(!blob && r.pdfBase64){
        var b64=r.pdfBase64.indexOf(',')>=0?r.pdfBase64.split(',')[1]:r.pdfBase64;
        var bin=atob(b64), buf=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
        blob=new Blob([buf],{type:'application/pdf'});
      }
      if(!blob){ toast('No se encontró el PDF para migrar','err'); throw new Error('sin blob'); }
      if(typeof window.subirR2==='function' && window.SB_DESPACHO_ID){
        var f=new File([blob],nuevo,{type:'application/pdf'});
        await window.subirR2(f, window.SB_DESPACHO_ID+'/recibos/'+nuevo, 'recibos');
      }
      r.archivo=nuevo; r.archivoR2=nuevo; delete r.archivoR2Raiz;
      if(typeof sincronizarTodoAhora==='function') await sincronizarTodoAhora();
      toast('✅ Nombre migrado a '+nuevo,'ok');
    }catch(e){ console.warn('[scanRecibosMigrarNombre]',e); }
    finally{ if(btn){ btn.disabled=false; btn.style.opacity=''; } _scRefrescar(); }
  };
})();
// Purga del HISTORIAL de pagos parciales guardado en las versiones del folio los
// abonos que pertenecen a la letra eliminada (los que traen el tag "[folioLetra]" en
// su descripción). Así, al eliminar un recibo, ese abono deja de aparecer como pago
// parcial "fantasma" en el formulario de actualización de las demás versiones.
/* Movido a modules/recibos/index.js: _purgarPagosParcialesDeVersion */
/* Movido a modules/administracion/index.js: adminEliminarRecibo */
// ── CAMBIAR FECHA DE RECIBO v2 (con checkboxes individuales por movimiento) ──
/* Movido a modules/administracion/index.js: adminAbrirCambiarFecha */
/* Movido a modules/administracion/index.js: adminCFSetModo */
/* Movido a modules/administracion/index.js: adminCFMarcarTodos */
/* Movido a modules/administracion/index.js: adminConfirmarCambioFecha */
// ── EDITAR RECIBO ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════
// REVERTIR RECIBO DE VER.B (o C,D...) A VER.A — solución definitiva
// ══════════════════════════════════════════════════════════════════
// El problema raíz: al actualizar un recibo (pago parcial o error), el sistema
// crea una nueva versión B y el movimiento en contabilidad queda con letra:'B'.
// Al mismo tiempo el movimiento del anticipo (letra:'A') permanece en la fecha
// original. Si se usa el botón Editar sobre el recibo B, el movimiento A quedaba
// sin letra guardada → renderContab caía al fallback 'A' y mostraba ambos como A.
// Esta función: (1) revierte la letra del recibo a 'A', (2) elimina la versión B
// de appData.recibos, (3) corrige TODOS los movimientos del folio en D.movimientos,
// (4) sincroniza con Supabase de forma directa (no debounced).
/* Movido a modules/administracion/index.js: adminRevertirLetraA */
// ─── Inferir el tipo de un folio secundario a partir de sus datos ──────────
// Retorna: 'liquidacion' | 'pago_parcial' | 'servicio_complementario' | 'desconocido'
/* Movido a modules/caja/index.js: _inferirTipoFolioSecundario */

// ─── Cargar folio secundario en modo actualización recalculado desde su padre ─
// padreLetra: letra del padre directo (ej. 'A' para B, 'B' para C, etc.)
/* Movido a modules/recibos/index.js: _abrirEdicionSecundario */

/* Movido a modules/administracion/index.js: adminAbrirEditarRecibo */
/* Movido a modules/administracion/index.js: adminEditRecalcSaldo */
// ═══ EDICIÓN COMPLETA DE RECIBO (abre formulario desbloqueado) ═══════════════
let _reciboEnEdicionCompleta = null; // índice en appData.recibos del recibo que se está editando
// Llamada desde el botón del sidebar — abre modal admin en zona de edición completa
/* Movido a modules/administracion/index.js: abrirEdicionCompletaSidebar */
// Abre la zona de búsqueda para edición completa desde el panel admin
/* Movido a modules/administracion/index.js: adminAbrirEdicionCompletaZona */
/* Movido a modules/administracion/index.js: adminEdicionFiltrar */
/* Movido a modules/administracion/index.js: adminSeleccionarParaEditar */
// Llamada desde el botón ⚙ → modal versiones → "Editar este recibo"
// También llamada desde adminSeleccionarParaEditar con el recibo como parámetro
// Iguala el ancho de la barra "MODO EDICIÓN COMPLETA" al ancho real y
// renderizado del formulario (recibo-body) — así queda exacto sin importar
// el tamaño de pantalla o si la barra lateral está colapsada, en vez de
// intentar adivinarlo con una fórmula CSS aparte que puede quedar desfasada.
/* Movido a modules/recibos/index.js: _ajustarAnchoBannerEdicion */
window.addEventListener('resize', function(){
  var banner = document.getElementById('edicion-completa-banner');
  if(banner && banner.style.display !== 'none' && banner.offsetParent !== null) _ajustarAnchoBannerEdicion();
});
/* Movido a modules/recibos/index.js: editarReciboEnConsulta */
/* Movido a modules/administracion/index.js: adminAbrirEdicionCompleta */
/* Movido a modules/recibos/index.js: cancelarEdicionCompleta */
/* Movido a modules/recibos/index.js: guardarEdicionCompleta */
/* Movido a modules/administracion/index.js: adminVolverGestion */
/* Movido a modules/administracion/index.js: adminGuardarEdicionRecibo */
// Borrar PDF de Storage por nombre — para forzar regeneración desde JSON al consultar
/* Movido a modules/recibos/index.js: borrarPDFdeDrive */
// Movimientos en ceros (dinero retirado) — solo consulta
// ══════════════════════════════════════════════════════════════════
const HISTORIAL_FILE = 'contabilidad_historial_2026.json';
let historialFileId = HISTORIAL_FILE;
let historialData = null;
/* Movido a modules/contabilidad/index.js: cargarHistorialContabilidad */
/* Movido a modules/contabilidad/index.js: _buildHistorialHTML */
/* Movido a modules/administracion/index.js: abrirHistorialContabilidad */
/* Movido a modules/administracion/index.js: pedirClaveHistorial */
/* Movido a modules/core/index.js: _abrirHistorialReal */
/* Movido a modules/contabilidad/index.js: renderHistorial2026 */
// ─── VISTA PREVIA RECIBO ────────────────────────────────────────
/* Movido a modules/recibos/index.js: verVistaPrevia */
/* Movido a modules/recibos/index.js: buscarReciboFolio */
/* Movido a modules/recibos/index.js: sincronizarFolioConREC */
// ─── VINCULAR RECIBO CON CARPETA / JUICIO ──────────────────────
var _recibo_vincular_idx = null;
/* Movido a modules/recibos/index.js: abrirVincularRecibo */
/* Movido a modules/recibos/index.js: confirmarVincularRecibo */
