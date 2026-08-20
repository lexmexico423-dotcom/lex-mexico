// ════════════════════════════════════════════════════════════════
// BLOQUE 1 — originalmente en línea 3552 de index.html
// ════════════════════════════════════════════════════════════════
// ================================================================
// LEX-MÉXICO — Recibo Oficial v6
// Sistema completo: Supabase como BD · Folio persistente · Pagos complementarios · Directorio telefónico
// ================================================================
// ═══ MODO ABIERTO (SIN COSTO TOTAL PACTADO) — Juicio + Escritura ═══
// Resuelve el modoCosto EFECTIVO a nivel de FOLIO (no de una versión suelta).
// La versión A (Original) es la fuente de verdad del modo de cobro; las
// versiones B/C/D pueden no haber heredado el flag, por eso se consulta el
// conjunto completo del folio. Excepción: si alguna versión fue cerrada con
// "Cerrar Juicio/Escritura", el folio queda 'cerrado' (liquidado definitivo).
window._modoCostoFolio = function(r){
  if(!r) return '';
  try {
    var fol = Number(r.folio);
    var vers = (typeof appData!=='undefined' && appData.recibos ? appData.recibos : [])
      .filter(function(x){ return x && Number(x.folio)===fol && !x.esComplemento; });
    if(!vers.length) return r.modoCosto || '';
    // Cierre definitivo tiene prioridad
    if(vers.some(function(x){ return x.modoCosto==='cerrado'; })) return 'cerrado';
    // La versión más antigua (A) define el modo de cobro del folio
    vers.sort(function(a,b){ return String(a.letra||'A').charCodeAt(0)-String(b.letra||'A').charCodeAt(0); });
    if(vers[0] && vers[0].modoCosto) return vers[0].modoCosto;
    // Respaldo: si cualquier versión quedó marcada como abierta
    if(vers.some(function(x){ return x.modoCosto==='abierto'; })) return 'abierto';
    return r.modoCosto || '';
  } catch(e){ return r.modoCosto || ''; }
};
// Predicado único: un folio está en "Sin Costo Total Pactado" cuando su modo
// efectivo (a nivel de folio) es 'abierto' y el trámite es Juicio O Escritura.
window._abiertoSinCosto = function(r){
  // Vehicular y Normal SIEMPRE tienen costo total pactado desde su creación —
  // "Sin Costo Pactado" solo existe para Juicio y Escritura.
  return !!r && window._modoCostoFolio(r) === 'abierto' && (r.tipoTramite === 'juicio' || r.tipoTramite === 'escritura');
};
// ── ADEUDO REAL POR SERVICIOS COMPLEMENTARIOS (Sin Costo Total Pactado) ──────────
// IMPORTANTE: cada versión del folio (A, B, C…) guarda su costosExtra/pagosParciales
// de forma ACUMULADA — es decir, la versión más reciente ya incluye todos los
// Servicios Complementarios y abonos de las versiones anteriores, más los nuevos de
// esa sesión. Por eso este cálculo lee SOLO LA ÚLTIMA VERSIÓN del folio — sumar
// entre todas las versiones duplicaría cada cargo/abono tantas veces como versiones
// existan. Aplica los abonos en orden cronológico (FIFO) contra los cargos — el
// anticipo original NUNCA se cuenta aquí porque es un pago aparte, sin relación con
// cargos posteriores. Esta es la MISMA fuente de verdad que usa el PDF (generarPDF)
// para el cuadro de totales y el desglose "ADEUDO ANTERIOR"; se usa también para
// validar y precargar los botones Pago Parcial / Pago Total en la ficha.
window._adeudoServicioComplementario = function(recibo){
  if(!recibo) return { total: 0, items: [] };
  var folio = Number(recibo.folio);
  var versiones = (typeof appData!=='undefined' && appData.recibos ? appData.recibos : [])
    .filter(function(x){ return x && Number(x.folio)===folio && !x.esComplemento; });
  if(!versiones.length) return { total: 0, items: [] };
  versiones.sort(function(a,b){ return String(a.letra||'A').charCodeAt(0)-String(b.letra||'A').charCodeAt(0); });
  var ultima = versiones[versiones.length-1];
  var items = (ultima.costosExtra||[]).filter(Boolean).map(function(ce){
    // Atribuir el cargo a quien lo generó realmente (la versión donde se originó,
    // vía folioLetra) y no siempre a la última versión que lo trae acumulado.
    var _letraOrigen = (ce.folioLetra || ultima.letra || 'A').toUpperCase();
    var _origen = versiones.find(function(v){ return (v.letra||'A').toUpperCase()===_letraOrigen; }) || ultima;
    return { concepto: ce.concepto||'Servicio', fecha: ce.fechaHora||'', responsable: _origen.responsable||'', monto: parseFloat(ce.precio)||0 };
  });
  // Total BRUTO acumulado (antes de restar abonos) — sirve como cifra estable de
  // "servicios complementarios cargados hasta ahora" para cualquier UI que necesite
  // guardar/mostrar un total, deduplicado por si algun dato viejo ya trae repetidos.
  var _seenBruto = {};
  var bruto = (ultima.costosExtra||[]).filter(Boolean).reduce(function(s,ce){
    var k=(ce.concepto||'')+'|'+(ce.descripcion||'')+'|'+String(ce.precio||'')+'|'+(ce.fechaHora||'');
    if(_seenBruto[k]) return s;
    _seenBruto[k]=1;
    return s+(parseFloat(ce.precio)||0);
  }, 0);
  var abonadoAcum = (ultima.pagosParciales||[]).reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0);
  var restante = abonadoAcum;
  items = items.map(function(it){
    var aplicado = Math.min(it.monto, restante);
    restante -= aplicado;
    return Object.assign({}, it, { monto: Math.max(0, it.monto - aplicado) });
  }).filter(function(it){ return it.monto > 0.005; });
  var total = items.reduce(function(s,it){ return s+it.monto; }, 0);
  return { total: total, items: items, bruto: bruto };
};
// Etiquetas dinámicas según el tipo de trámite (Juicio ⚖️ / Escritura 📜).
window._abLbl = function(r){
  var _map = {
    escritura: { ico:'📜', nom:'Escritura' },
    juicio:    { ico:'⚖️', nom:'Juicio' },
    normal:    { ico:'📄', nom:'Trámite' },
    vehicular: { ico:'🚗', nom:'Trámite Vehicular' }
  };
  var m = (r && _map[r.tipoTramite]) || _map.juicio;
  return {
    ico:      m.ico,
    nom:      m.nom,
    curso:    m.ico+' '+m.nom.toUpperCase()+' EN CURSO',
    cursoCap: m.ico+' '+m.nom+' en curso',
    mini:     m.ico+' '+m.nom.toLowerCase(),
    corto:    m.nom+' en curso'
  };
};
// ═══ CACHÉ DE DOM ═══
// $(id) reemplaza document.getElementById(id) con caché automático.
// Si el elemento se elimina y se vuelve a crear, el caché lo detecta y refresca.
// Reduce el costo de las búsquedas repetidas (responsable, folio-display, etc.)
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
// ═══ DEBOUNCE ═══ (para búsqueda global y filtros, Punto 6)
function debounce(fn, ms = 200) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}
// ═══════════════════════════════════════════════════════════════════
// LEX-MÉXICO · BACKEND: SUPABASE
// ═══════════════════════════════════════════════════════════════════
// La aplicación ahora persiste datos en Supabase en lugar de Drive.
// Para no reescribir cientos de funciones, mantenemos los nombres de
// variables (sbSession, appData, etc.) pero apuntando a Supabase.
//
// Configuración Supabase:
const SUPABASE_URL      = window.LEX_PUBLIC_CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = window.LEX_PUBLIC_CONFIG.supabaseAnonKey;
const STORAGE_BUCKET    = window.LEX_PUBLIC_CONFIG.storageBucket;
// ═══════════════════════════════════════════════════════════════════
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
      '<textarea class="descripcion concepto-ta" placeholder="Descripción" rows="1" ' +
        'onblur="iaDescBlur(this)"' +
      '></textarea>' +
    '</td>' +
    '<td><input type="text" class="precio price-input" placeholder="0.00" inputmode="decimal" oninput="formatPrecio(this)"></td>' +
    '<td><button class="del-concept" onclick="quitarConcepto(\'' + id + '\')">✕</button></td>';
  tbody.appendChild(tr);
}
// ── AUTO-CRECIMIENTO de Concepto/Descripción al escribir ──────────
// Ajusta la altura del textarea a su contenido en cada tecleo, sin quitar
// la posibilidad de ampliar/reducir manualmente (resize:vertical sigue activo
// vía CSS; si el usuario arrastra la esquina, ese tamaño se respeta hasta el
// siguiente tecleo, que recalcula según el texto).
function _autoGrowConceptoTA(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, 32) + 'px';
}
document.addEventListener('input', function (e) {
  if (e.target && e.target.classList && e.target.classList.contains('concepto-ta')) {
    _autoGrowConceptoTA(e.target);
  }
}, true);
// ── FUNCIÓN AUXILIAR (ya existe en tu sistema, incluida por si acaso)
// ── DIRECTORIO DE EMPLEADOS ──────────────────────────────────────
// Mapeo de correo → nombre que aparece en recibos e historial
EMPLEADOS = {
  'lexmexico423@gmail.com':     'LIC NAHUM PELAEZ',
  'lexantonieta2025@gmail.com': 'LIC ANTONIETA CHAVEZ MONTAR'
};
// Correo del administrador — puede elegir quién autoriza en los PDFs
const ADMIN_EMAIL = 'lexmexico423@gmail.com';
NOMBRE_TITULAR = 'LIC NAHUM PELAEZ';
// Variables de estado (mantienen nombres legacy pero apuntan a Supabase)
sbSession      = null;   // se setea a "supabase-active" cuando hay sesión
sbExpiry     = 0;
folioFileId     = 'supabase';  // ya no es un fileId de Drive
appData         = { folioActual: 1, anioFolioActual: new Date().getFullYear(), recibos: [] };
empleadoActual  = null;
window.SB       = null;   // cliente de Supabase
window.SB_DESPACHO_ID = null;  // ID del despacho activo
// ── FORMATEO DE MONEDA ───────────────────────────────────────────
// Formatea fecha ISO AAAA-MM-DD a DD/MM/AAAA para mostrar al usuario
function fmtFecha(iso) {
  if (!iso || typeof iso !== 'string') return iso || '—';
  var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return m[3] + '/' + m[2] + '/' + m[1];
}

function fmtMXN(num) {
  const n = parseFloat(num) || 0;
  return n.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
}
// Convierte número a letras en español (pesos mexicanos)
function numeroALetras(num){
  const n = Math.abs(parseFloat(num)||0);
  const entero = Math.floor(n);
  const cents = Math.round((n - entero)*100);
  const unidades=['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE',
    'DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE'];
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
    if(mill>0){ s+=(mill===1?'UN MILLÓN':grupo(mill)+' MILLONES')+' '; }
    if(mil>0){ s+=(mil===1?'MIL':grupo(mil)+' MIL')+' '; }
    if(resto>0){ s+=grupo(resto); }
    return s.trim();
  }
  let resultado = miles(entero)+' PESOS';
  resultado += ' '+String(cents).padStart(2,'0')+'/100 M.N.';
  return resultado;
}
// ── TIPO DE TRÁMITE ──────────────────────────────────────────────
tipoTramite = 'normal';
function setTipoTramite(tipo) {
  // Escrituras y Juicio reutilizan EXACTAMENTE el flujo de Trámite Normal (Opción B):
  // se guardan como 'normal' y el concepto/descripción dirá de qué se trata. El
  // botón oprimido se ilumina solo como referencia visual para el usuario.
  const esVehicular = (tipo === 'vehicular');
  tipoTramite = tipo; // guardar el tipo real: normal, vehicular, escritura, juicio
  const _bN = document.getElementById('btn-tramite-normal');
  const _bV = document.getElementById('btn-tramite-vehicular');
  const _bE = document.getElementById('btn-tramite-escritura');
  const _bJ = document.getElementById('btn-tramite-juicio');
  if (_bN) _bN.classList.toggle('active', tipo === 'normal');
  if (_bV) _bV.classList.toggle('active', tipo === 'vehicular');
  if (_bE) _bE.classList.toggle('active', tipo === 'escritura');
  if (_bJ) _bJ.classList.toggle('active', tipo === 'juicio');
  const secVeh = document.getElementById('seccion-vehiculo');
  if (secVeh) secVeh.style.display = esVehicular ? '' : 'none';
  // No vehicular (normal/escritura/juicio): ocultar vehiculos, mostrar familiares y propiedad
  const catVehiculos  = document.getElementById('cat-vehiculos');
  const catFamiliares = document.getElementById('cat-familiares');
  const catPropiedad  = document.getElementById('cat-propiedad');
  if (!esVehicular) {
    if (catVehiculos)  catVehiculos.style.display  = 'none';
    if (catFamiliares) catFamiliares.style.display = '';
    if (catPropiedad)  catPropiedad.style.display  = '';
  } else {
    if (catVehiculos)  catVehiculos.style.display  = '';
    if (catFamiliares) catFamiliares.style.display = 'none';
    if (catPropiedad)  catPropiedad.style.display  = 'none';
  }
  // En Escrituras y Juicio: ocultar botones de tipo doc y mostrar etiqueta fija en copia simple
  const esSoloCopiasSimple = (tipo === 'escritura' || tipo === 'juicio');
  const toggleWrap = document.getElementById('doc-type-toggle-wrap');
  const copiaLabel = document.getElementById('doc-copia-label');
  const docsLabel  = document.getElementById('docs-section-label');
  const docsChecklist = document.getElementById('docs-checklist');
  if (toggleWrap)    toggleWrap.style.display    = esSoloCopiasSimple ? 'none' : '';
  if (copiaLabel)    copiaLabel.style.display    = 'none';
  if (docsLabel)     docsLabel.style.display     = esSoloCopiasSimple ? 'none' : '';
  if (docsChecklist) docsChecklist.style.display = esSoloCopiasSimple ? 'none' : '';
  if (esSoloCopiasSimple) {
    setTipoDoc('copia');
  }
  // Texto del Poder para Trámites según tipo
  const _poderEl = document.getElementById('poder-text');
  if (_poderEl) {
    if (tipo === 'escritura') {
      _poderEl.innerHTML =
        '<span style="display:inline-block;text-indent:2em;">Otorgo al Despacho Jurídico LEX-MÉXICO y a sus integrantes debidamente autorizados facultades amplias y suficientes para realizar, en mi nombre y representación, las gestiones, trámites y diligencias necesarias para la debida tramitación de mi escritura pública.</span>' +
        '<br><br>' +
        '<span style="display:inline-block;text-indent:2em;">Manifiesto haber sido debidamente informado, que el importe señalado en el presente recibo no incluye el pago del Impuesto Sobre la Renta (ISR) ni del Impuesto de Traslación de Dominio, cuyos montos serán determinados posteriormente por la base catastral asignada.</span>' +
        '<br><br>' +
        '<span style="display:inline-block;text-indent:2em;">Bajo protesta de decir verdad, declaro que la documentación proporcionada es auténtica, completa y veraz. En caso de detectarse inconsistencias, omisiones o requerirse documentación complementaria durante el trámite, me comprometo a subsanarlas a la brevedad. Asimismo, manifiesto contar con la solvencia económica para cubrir cualquier gasto, derecho, contribución o erogación adicional que resulte necesaria para la conclusión del trámite, deslindando al Despacho Jurídico LEX-MÉXICO de cualquier responsabilidad derivada de dichas circunstancias.</span>';
    } else if (tipo === 'juicio') {
      _poderEl.innerHTML =
        '<span style="display:inline-block;text-indent:2em;">Otorgo al Despacho Jurídico LEX-MÉXICO y a sus integrantes debidamente autorizados poder amplio y suficiente para representarme en el juicio o procedimiento legal correspondiente, incluyendo la realización de gestiones, promociones, recursos y diligencias necesarias para la atención, seguimiento y defensa del presente asunto.</span>' +
        '<br><br>' +
        '<span style="display:inline-block;text-indent:2em;">Los importes señalados en el presente recibo corresponden exclusivamente a los servicios profesionales contratados y no incluyen gastos, derechos, impuestos, certificaciones, peritajes, viáticos, honorarios de terceros ni cualquier otra erogación que pudiera generarse durante la sustanciación del procedimiento.</span>' +
        '<br><br>' +
        '<span style="display:inline-block;text-indent:2em;">Bajo protesta de decir verdad, declaro que la información y documentación proporcionadas son auténticas, completas y veraces, comprometiéndome a entregar cualquier documento adicional que se requiera y a comparecer cuando resulte necesario. En caso de detectarse omisiones o inconsistencias en la documentación, me comprometo a subsanarlas a la brevedad, deslindando al Despacho Jurídico LEX-MÉXICO de cualquier responsabilidad atribuible a tales circunstancias.</span>';
    } else {
      _poderEl.textContent = 'Otorgo al responsable del trámite del Despacho Jurídico LEX-MÉXICO, poder amplio, cumplido y bastante para que, en mi nombre y representación, realice y gestione las diligencias y trámites necesarios para la debida tramitación de los servicios solicitados.';
    }
  }
  // Ocultar poder si es Escritura o Juicio y la letra no es A
  const _letraActual = (typeof window._letraReciboActual !== 'undefined') ? window._letraReciboActual : 'A';
  _actualizarVisibilidadPoder(tipo, _letraActual);
  // Mostrar botones modalidad de cobro solo en Serie A de Escritura/Juicio
  _actualizarSeccionModoCosto(tipo, _letraActual);
}
// ── MODALIDAD DE COBRO (solo Serie A de Escritura y Juicio) ──
function setModoCosto(modo) {
  var inp = document.getElementById('modo-costo-pactado');
  if (inp) inp.value = modo;
  var btnP = document.getElementById('btn-costo-pactado');
  var btnA = document.getElementById('btn-sin-costo-pactado');
  if (btnP) { btnP.style.borderColor = modo==='pactado' ? '#c8952a' : ''; btnP.style.background = modo==='pactado' ? '#fff5e0' : ''; btnP.style.color = modo==='pactado' ? '#7a4010' : ''; }
  if (btnA) { btnA.style.borderColor = modo==='abierto' ? '#1a5fa8' : ''; btnA.style.background = modo==='abierto' ? '#e6f1fb' : ''; btnA.style.color = modo==='abierto' ? '#0c3a7a' : ''; }
}
function _actualizarSeccionModoCosto(tipo, letra) {
  var sec = document.getElementById('seccion-modo-costo');
  if (!sec) return;
  var esSerieA = (!letra || letra === 'A');
  var esTipo   = (tipo === 'escritura' || tipo === 'juicio');
  sec.style.display = (esTipo && esSerieA) ? '' : 'none';
}
// ── Toggle acordeón del bloque Poder para Trámites
function togglePoderSection() {
  const body  = document.getElementById('poder-body');
  const arrow = document.getElementById('poder-arrow');
  if (!body) return;
  const abierto = body.style.display !== 'none';
  body.style.display  = abierto ? 'none' : '';
  if (arrow) arrow.textContent = abierto ? '▸' : '▾';
}
// Oculta el bloque "Poder para Trámites" en Escrituras y Juicio cuando la letra NO es A
function _actualizarVisibilidadPoder(tipo, letra) {
  const seccionPoder = document.getElementById('seccion-poder');
  if (!seccionPoder) return;
  const esTipoConPoder = (tipo === 'escritura' || tipo === 'juicio');
  const esLetraA = (!letra || letra === 'A');
  if (esTipoConPoder && !esLetraA) {
    seccionPoder.style.display = 'none';
  } else {
    seccionPoder.style.display = '';
  }
}
window._actualizarVisibilidadPoder = _actualizarVisibilidadPoder;
function toggleCategoria(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector('span');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  arrow.textContent = open ? '▸' : '▾';
}
// ── DESPLEGABLE: DATOS GENERALES DEL VEHICULO ───────────────────
function toggleVehiculo(header) {
  const body = document.getElementById('vehicle-grid-body');
  const arrow = header.querySelector('.veh-arrow');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'grid';
  arrow.textContent = open ? '▸' : '▾';
}
// ── TIPO DE DOCUMENTO ────────────────────────────────────────────
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
  // Aviso si el usuario excede el límite (defensa por si fallara el listener)
  if (docs.length > 15) {
    console.warn('Documentos seleccionados ('+docs.length+') excede el límite de 15. Se truncarán los últimos '+(docs.length-15)+'.');
    setStatus('err','⚠ Solo los primeros 15 documentos aparecerán en el PDF ('+docs.length+' seleccionados)','err');
  }
  // Return as JSON string so PDF can parse it; also keep plain text fallback
  return JSON.stringify({ tipodoc, docs: docs.slice(0, 15) });
}
// Validación en tiempo real: avisar al marcar el documento 16
function validarLimiteDocumentos(checkbox) {
  const seleccionados = document.querySelectorAll('#docs-checklist input[type="checkbox"]:checked').length;
  if (seleccionados > 15 && checkbox.checked) {
    checkbox.checked = false;
    setStatus('err','⚠ Máximo 15 documentos. Desmarca alguno antes de agregar otro.','err');
    return false;
  }
  if (seleccionados > 0) {
    setStatus('ok','Documentos seleccionados: '+seleccionados+'/15','ok');
  }
  return true;
}
// ── INIT ─────────────────────────────────────────────────────────
// ── PARTE 1: GOOGLE DRIVE AUTH ───────────────────────────────────
// ═══════════════════════════════════════════════════════════════════
// SUPABASE: Inicialización del cliente y autenticación
// ═══════════════════════════════════════════════════════════════════
async function initSupabase(){
  if(window.SB) return window.SB;
  // El SDK se carga como script global desde el <head> (window.supabase)
  // Esto evita el "Failed to fetch dynamically imported module" en navegadores
  // con bloqueadores activos (Brave Shields, uBlock, etc.)
  if(typeof window.supabase === 'undefined' || !window.supabase.createClient){
    // Intento de carga de respaldo si el script principal falló
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
      storage: window.localStorage,
      storageKey: 'lex-supabase-auth'
    }
  });
  // Escuchar cambios de sesión
  window.SB.auth.onAuthStateChange((event, session) => {
    console.log('[SB] Auth event:', event);
    if(event === 'SIGNED_IN' || event === 'INITIAL_SESSION'){
      // FIX: cargar la key de Gemini en cuanto la sesión esté autenticada
      // Antes solo se cargaba con setTimeout(1s) → la sesión podía no estar lista → warning falso
      if(session){
        // FIX 2: restaurar sbSession y sbExpiry al recargar la página (INITIAL_SESSION)
        if(!sbSession || Date.now() >= sbExpiry){
          sbSession = 'supabase-active-' + session.user.id;
          sbExpiry  = session.expires_at ? session.expires_at * 1000 : Date.now() + 1000*60*60*12;
          window._miUserId = session.user.id;
          try {
            var _em = localStorage.getItem('empleado_email');
            var _en = localStorage.getItem('empleado_nombre');
            if(_em && typeof empleadoActual !== 'undefined'){
              empleadoActual = { email: _em, nombre: _en || _em.split('@')[0] };
            }
          } catch(e){}
          if(event === 'INITIAL_SESSION'){
            obtenerDespachoActivo().then(function(did){
              if(did){
                if(typeof actualizarAmbossBadges === 'function') actualizarAmbossBadges(true);
                if(typeof setStatus === 'function') setStatus('ok','Sistema conectado','ok');
                if(typeof sincronizarFolio === 'function') sincronizarFolio();
                if(typeof lexRealtimeConectar === 'function') setTimeout(lexRealtimeConectar, 1000);
              }
            });
          }
        }
        // Cargar key de Groq desde Supabase al hacer login
        setTimeout(_cargarGroqKey, 400);
        // Cargar key de Mistral OCR al hacer login
        setTimeout(_cargarMistralKey, 500);
        // Cargar credenciales de Cloudflare Workers AI (respaldo de Groq / lector de documentos)
        setTimeout(_cargarCfaiCreds, 550);
        // Re-disparar si los IIFE ya agotaron reintentos antes del login
        setTimeout(function(){
          if(!window._groqKeyCached || window._groqKeyCached.length <= 10){
            _cargarGroqKey().then(function(){
              if(!window._groqKeyCached || window._groqKeyCached.length <= 10)
                console.warn('[Groq] ⚠ Key no encontrada tras login — configúrala en ⚙️ Configuración');
            });
          }
        }, 1000);
      }
    }
    if(event === 'SIGNED_OUT'){
      sbSession = null; sbExpiry = 0;
      window.SB_DESPACHO_ID = null;
      window._geminiKeyCached = ''; // limpiar cache Gemini al cerrar sesión
      window._groqKeyCached = '';    // limpiar cache Groq al cerrar sesión
      window._mistralKeyCached = ''; // limpiar cache Mistral al cerrar sesión
      window._cfaiAccountCached = ''; window._cfaiTokenCached = ''; // limpiar cache Cloudflare al cerrar sesión
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
    console.log('[SB] Despacho activo:', window.SB_DESPACHO_ID, '— Rol:', window.SB_ROL_ACTUAL);
    // Cargar config de captura retroactiva ahora que SB_DESPACHO_ID está listo
    setTimeout(function(){
      if(typeof capturaMesCargarSupabase==='function') capturaMesCargarSupabase();
      if(typeof retroGlobalCargarSupabase==='function') retroGlobalCargarSupabase();
    }, 500);
    return window.SB_DESPACHO_ID;
  }
  // ── PROTECCIÓN: Si el usuario no es admin, NO crear despacho nuevo ──────
  // Un empleado sin membresía significa que el admin aún no lo registró.
  // Crear un despacho vacío a su nombre sería un error silencioso grave.
  const esAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  if(!esAdmin){
    console.error('[SB] Usuario sin membresía asignada:', user.email);
    // Cerrar sesión y mostrar mensaje claro
    await sb.auth.signOut();
    sbSession = null; sbExpiry = 0;
    empleadoActual = null;
    mostrarLoginSupabase();
    // Mostrar error descriptivo en el modal de login
    setTimeout(() => {
      const eErr = document.getElementById('sb-err');
      if(eErr){
        eErr.textContent = '⚠ Tu cuenta no tiene acceso al despacho. Pide al administrador que te registre en el sistema.';
        eErr.style.display = 'block';
      }
    }, 400);
    return null;
  }
  // Solo para el admin: crear despacho inicial si no existe (cuenta nueva)
  console.log('[SB] Admin sin despacho — creando despacho inicial...');
  const { data: d } = await sb.from('despachos').insert({ nombre: 'Despacho de '+user.email, owner_id: user.id }).select().single();
  if(!d) return null;
  await sb.from('miembros').insert({ despacho_id: d.id, user_id: user.id, rol: 'admin', nombre: user.email.split('@')[0] });
  await sb.from('app_state').insert({
    despacho_id: d.id,
    data: {movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],cierres:[],prestamos:[],saldoAcumulado:0,leyes:[]},
    recibos: {folioActual:1, recibos:[]}
  });
  window.SB_DESPACHO_ID = d.id;
  window.SB_ROL_ACTUAL  = 'admin';
  return d.id;
}
// ── Verificar sesión activa ──────────────────────────────────────
function tokenOk(){
  return !!(window.SB && window.SB_DESPACHO_ID);
}
// ── REEMPLAZA al antiguo iniciarDriveAuth — ahora abre modal Supabase
function iniciarDriveAuth() {
  if(sbSession && Date.now() < sbExpiry){
    setStatus('ok','Sesión activa','ok');
    actualizarAmbossBadges(true);
    return;
  }
  mostrarLoginSupabase();
}
// Modal de login con Supabase (email + password)
function _lexSplashOcultar(){
  var s = document.getElementById('lex-splash');
  if(!s) return;
  s.style.opacity = '0';
  setTimeout(function(){ if(s && s.parentNode) s.parentNode.removeChild(s); }, 380);
}
function mostrarLoginSupabase(){
  // Ocultar splash antes de mostrar login
  _lexSplashOcultar();
  // Cierra otros modales
  document.querySelectorAll('.modal-overlay.show, .modal.show').forEach(m => m.classList.remove('show'));
  let modal = document.getElementById('sb-login-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sb-login-modal';
    modal.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:Outfit,sans-serif;background-color:#0b0a08;background-repeat:no-repeat,repeat;background-size:cover,130px 130px;';
    modal.style.backgroundImage = 'radial-gradient(ellipse at center, rgba(255,255,255,0.03), rgba(0,0,0,0) 62%), ' + (typeof _lexFondoTexturaSVG === 'function' ? _lexFondoTexturaSVG(0.48) : 'none');
    modal.innerHTML = `
      <div style="background:#fdfaf4;border-radius:22px;padding:28px 32px 28px;width:420px;max-width:93vw;box-shadow:0 40px 100px rgba(0,0,0,0.55);">
        <!-- LOGO -->
        <div style="margin-bottom:16px;">
          <img src="data:image/png;base64,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" alt="LEX MÉXICO Despacho Jurídico" style="width:100%;max-width:360px;display:block;">
        </div>
        <!-- TÍTULO -->
        <h2 id="sb-title" style="font-family:sans-serif;font-size:1.45rem;font-weight:700;color:#1a1008;margin:0 0 14px;">Iniciar sesión</h2>
        <p id="sb-sub" style="display:none;"></p>
        <!-- CAMPO CORREO -->
        <label style="display:block;font-family:sans-serif;font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8c6518;margin-bottom:5px;">Correo</label>
        <input id="sb-email" type="email" autocomplete="email" placeholder="ejemplo@correo.com"
          style="width:100%;padding:11px 16px;border:2px solid #d4b870;border-radius:12px;font-family:sans-serif;font-size:0.92rem;color:#1a1008;background:#fff;box-sizing:border-box;margin-bottom:12px;outline:none;transition:border-color 0.2s;"
          onfocus="this.style.borderColor='#c8952a'" onblur="this.style.borderColor='#d4b870'">
        <!-- CAMPO CONTRASEÑA -->
        <label style="display:block;font-family:sans-serif;font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8c6518;margin-bottom:5px;">Contraseña</label>
        <div style="position:relative;margin-bottom:8px;">
          <input id="sb-pwd" type="password" autocomplete="current-password" placeholder="••••••••••••"
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
        <!-- CHECKBOX MOSTRAR CONTRASEÑA -->
        <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-family:monospace;font-size:0.72rem;color:#7a6840;user-select:none;margin-bottom:16px;">
          <input type="checkbox" id="sb-pwd-check"
            onchange="document.getElementById('sb-pwd').type=this.checked?'text':'password';"
            style="width:16px;height:16px;accent-color:#c8952a;cursor:pointer;border-radius:3px;">
          Mostrar contraseña
        </label>
        <!-- MENSAJE ERROR / OK -->
        <div id="sb-err" style="display:none;background:#fff0f0;color:#c0161a;border:1px solid rgba(192,22,26,0.2);border-radius:8px;padding:9px 13px;font-size:0.8rem;margin-bottom:10px;"></div>
        <div id="sb-ok"  style="display:none;background:#e8f5ec;color:#0f5228;border:1px solid rgba(26,122,58,0.3);border-radius:8px;padding:9px 13px;font-size:0.8rem;margin-bottom:10px;"></div>
        <!-- BOTÓN ENTRAR -->
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
        eErr().textContent = 'Correo y contraseña (mín 6 caracteres) requeridos';
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
            eOk().textContent = '✓ Cuenta creada. Revisa tu correo o desactiva "Confirm email" en Supabase para entrar directo.';
            eOk().style.display = 'block';
            btn.disabled = false; btn.textContent = 'Entrar';
            modoSB = 'login';
            document.getElementById('sb-title').textContent = 'Iniciar sesión';
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
        // Cargar config de captura retroactiva después del login
        setTimeout(function(){ capturaMesCargarSupabase(); if(typeof retroGlobalCargarSupabase==='function') retroGlobalCargarSupabase(); }, 2000);
        empleadoActual = {
          email: res.data.user.email,
          nombre: EMPLEADOS[res.data.user.email.toLowerCase()] || res.data.user.email.split('@')[0]
        };
        try{ if(typeof _driveSyncRefreshPendiente==='function') _driveSyncRefreshPendiente(); } catch(e){}
        // SEGURIDAD: el "Modo administrador" del panel de Placas (_mpeAdminActivo)
        // es una variable en memoria que antes NO se reseteaba al cambiar de
        // usuario dentro de la misma pestaña — si el admin lo activaba y luego
        // otra persona iniciaba sesión con su propia cuenta sin recargar la
        // página, heredaba el modo administrador sin haber puesto su contraseña.
        // Se fuerza a "apagado" en cada login nuevo, sin importar quién entre.
        try{
          if(typeof _mpeAdminActivo !== 'undefined') _mpeAdminActivo = false;
          if(typeof _mpeAdminOff !== 'undefined') _mpeAdminOff = false;
          sessionStorage.removeItem('mpe_admin_off');
        } catch(e){}
        try{ localStorage.setItem('empleado_email', empleadoActual.email); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('empleado_nombre', empleadoActual.nombre); } catch(e){ registrarError('localStorage.setItem', e); }
// Bloquea "Responsable del Trámite" al nombre de quien inició sesión (o lo
// convierte en selector si es admin) — antes esta función existía pero nunca
// se llamaba, dejando el campo libre para cualquiera.
try{ if(typeof detectarEmpleado==='function') await detectarEmpleado(); } catch(e){ console.warn('[detectarEmpleado]', e); }
const _despachoOk = await obtenerDespachoActivo();
        // Si obtenerDespachoActivo devuelve null, el empleado no tiene membresía asignada.
        // La función ya cerró la sesión y mostrará el error — detener el flujo aquí.
        if(!_despachoOk){ btn.disabled = false; btn.textContent = 'Entrar'; return; }
        // No se quita el modal de login todavía — se deja puesto como "cortina"
        // (con su mismo fondo negro texturizado) para que el sistema NUNCA se
        // vea de fondo, ni siquiera borroso detrás del aviso de horario. Solo
        // se oculta la tarjeta beige del formulario; el fondo se queda. La
        // retira _lexCortinaQuitar() SOLO cuando el usuario queda realmente
        // autorizado a entrar (admin de inmediato; empleado hasta que cierre
        // el aviso de mañana/tarde o termine la cuenta regresiva). Si el
        // horario está "cerrado", la cortina se queda puesta indefinidamente
        // — la única salida es cerrar sesión (recarga la página sola).
        var _sbCard = modal.firstElementChild;
        if(_sbCard) _sbCard.style.display = 'none';
        window._lexLoginCortina = modal;
        setTimeout(function(){ // red de seguridad — igual que el splash
          // Si para entonces ya está mostrado el aviso de horario (candado
          // legítimo, puede durar horas a propósito), NO se toca la cortina.
          var gate = document.getElementById('modal-horario-gate');
          if(gate && gate.classList.contains('show')) return;
          if(window._lexLoginCortina && window._lexLoginCortina.parentNode){
            window._lexLoginCortina.parentNode.removeChild(window._lexLoginCortina);
            window._lexLoginCortina = null;
          }
        }, 12000);
        actualizarAmbossBadges(true);
        setStatus('loading','Cargando datos del despacho...','loading');
        await sincronizarFolio();
        setStatus('ok','Sistema conectado — ' + empleadoActual.nombre,'ok');
        const _btnCS = document.getElementById('btn-cerrar-sesion'); if(_btnCS) _btnCS.style.display = 'block';
        auditoriaRegistrar('login', 'Inicio de sesión — ' + empleadoActual.email);
        // Conectar Realtime para sincronización entre usuarios
        setTimeout(lexRealtimeConectar, 1500);
        // Registrar sesión en monitor
        setTimeout(sesionesRegistrarLogin, 2000);
        // Activar SCANSYS si es administrador
        if(typeof scansysInit==='function' && empleadoActual.email.toLowerCase()===(typeof ADMIN_EMAIL!=='undefined'?ADMIN_EMAIL.toLowerCase():'')) setTimeout(scansysInit, 2500);
        // Horario de captura: bienvenida/espera/cierre + avisos programados
        setTimeout(function(){ if(typeof horarioGateLogin==='function') horarioGateLogin(); }, 700);
      } catch(e) {
        let msg = e.message || String(e);
        if(/invalid login credentials/i.test(msg)) msg = 'Correo o contraseña incorrectos';
        else if(/user already registered/i.test(msg)) msg = 'Ya existe una cuenta con ese correo';
        else if(/email not confirmed/i.test(msg)) msg = 'Confirma tu correo o desactiva la confirmación en Supabase';
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
// ═══ MEJORA 3: INDICADOR DE ESTADO DE SINCRONIZACIÓN ═══
// Estados: 'idle' (todo guardado), 'syncing' (subiendo a Supabase),
//          'error' (falló última subida), 'pending' (cambios sin subir)
let _syncState = 'idle';
let _syncCounter = 0;     // contador de operaciones en curso
let _lastSyncTime = null;
let _lastSyncError = null;
let _syncCounterChangedAt = Date.now();  // timestamp del último cambio del contador
function setSyncState(estado, error) {
  _syncState = estado;
  if (estado === 'idle') _lastSyncTime = Date.now();
  if (estado === 'error') _lastSyncError = error || 'Error desconocido';
  if (estado === 'syncing') _lastSyncError = null;
  renderSyncIndicator();
  // Actualizar medidor de Drive cuando cambia el estado de sincronización
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
// ═══ TOMBSTONES CON SUPERSESIÓN POR TIMESTAMP ═══════════════════════
// Regla central: un tombstone (eliminación) SOLO aplica a recibos creados
// ANTES de esa eliminación. Un recibo regenerado/restaurado lleva _revivedTs
// (momento de su re-creación); si _revivedTs > tombstone.ts, el tombstone
// queda superado y NO puede eliminar al recibo nuevo — en ningún cliente.
// Esto resuelve el ciclo fatal: borrar folio → tombstone propagado →
// regenerar folio → la siguiente sync lo filtraba y "desaparecía solo".
function _tombstoneAplicaA(t, r) {
  if (!t || !r) return false;
  if (String(t.folio) !== String(r.folio)) return false;
  if ((t.letra || 'A') !== (r.letra || 'A')) return false;
  // Recibo revivido DESPUÉS de la eliminación → el tombstone no aplica.
  // Tombstones legados sin ts cuentan como ts=0 (cualquier revivido los supera).
  if (r._revivedTs && Number(r._revivedTs) > Number(t.ts || 0)) return false;
  return true;
}
// Marca un recibo recién creado como "revivido" si su folio+letra tiene
// tombstone, y elimina ese tombstone de la lista local. Llamar en TODOS
// los caminos de creación de recibos (generación, restauración, R2).
function _revivirSiTombstone(rec) {
  try {
    if (!rec || typeof appData === 'undefined') return rec;
    // Siempre marcar el recibo con el momento de creación. Si SB tiene un
    // tombstone que aún no llegó a este dispositivo, _revivedTs protegerá
    // el recibo en la comparación _revivedTs > t.ts del pre-read de syncEstadoSupabase.
    if (!rec._revivedTs) rec._revivedTs = Date.now();
    const tombs = Array.isArray(appData.folios_eliminados) ? appData.folios_eliminados : [];
    const hayTomb = tombs.some(function(t){
      return String(t.folio) === String(rec.folio) && (t.letra || 'A') === (rec.letra || 'A');
    });
    if (hayTomb) {
      rec._revivedTs = Date.now();
      appData.folios_eliminados = tombs.filter(function(t){
        return !(String(t.folio) === String(rec.folio) && (t.letra || 'A') === (rec.letra || 'A'));
      });
      console.log('[Tombstone] Folio ' + rec.folio + (rec.letra || 'A') + ' revivido — tombstone superado (_revivedTs=' + rec._revivedTs + ')');
    }
  } catch(e) { console.warn('[_revivirSiTombstone]', e); }
  return rec;
}
// Purga de la lista local los tombstones superados por algún recibo revivido.
// Hace converger a TODOS los clientes hacia la eliminación del tombstone viejo.
function _purgarTombstonesSuperados(tombs, recibos) {
  return (tombs || []).filter(function(t){
    return !(recibos || []).some(function(r){
      return r && r._revivedTs && String(t.folio) === String(r.folio) &&
             (t.letra || 'A') === (r.letra || 'A') && Number(r._revivedTs) > Number(t.ts || 0);
    });
  });
}
// ── Helper: envuelve una petición Supabase con timeout ──────────────
// Las peticiones colgadas (red inestable) no lanzan excepción por sí solas;
// sin esto, el await queda detenido indefinidamente y el contador se atasca.
function _sbConTimeout(promesa, ms, etiqueta) {
  return Promise.race([
    promesa,
    new Promise(function(_, rej) {
      setTimeout(function(){ rej(new Error((etiqueta||'Supabase') + ': tiempo de espera agotado (' + Math.round(ms/1000) + 's)')); }, ms);
    })
  ]);
}
// ── WATCHDOG: previene atascos permanentes del contador ─────────────
// Si una operación llamó syncStart() pero por algún error de red u
// otra excepción nunca llamó su syncEnd() correspondiente, el contador
// se quedaría en >0 indefinidamente y el modal "Sincronización en curso"
// aparecería siempre al recargar. Con los timeouts de _sbConTimeout las
// peticiones colgadas ahora fallan solas (~30s), así que este watchdog
// es solo último recurso: umbral de 45s y estado 'error' (no 'idle')
// porque una subida que nunca confirmó NO puede reportarse como guardada.
function _syncWatchdog() {
  if (_syncCounter > 0) {
    const inactividad = Date.now() - _syncCounterChangedAt;
    if (inactividad > 45000) {
      console.warn('[syncWatchdog] Contador atascado en', _syncCounter,
        'por', Math.round(inactividad/1000), 'segundos — reseteando');
      _syncCounter = 0;
      _syncCounterChangedAt = Date.now();
      // Resetear tambien _syncEnCurso para desbloquear futuros syncs
      if(typeof _syncEnCurso !== 'undefined') _syncEnCurso = false;
      setSyncState('error', 'Última sincronización no confirmada — vuelve a guardar');
    }
  }
}
setInterval(_syncWatchdog, 5000);  // revisar cada 5 segundos
function renderSyncIndicator() {
  // Actualizar el chip existente para reflejar estado de sincronización
  const dot = document.getElementById('driveDot');
  const lbl = document.getElementById('driveLabel');
  if (!dot || !lbl) return;
  const driveOk = sbSession && Date.now() < sbExpiry;
  if (!driveOk) {
    // Sesión desconectada: el badge normal se encarga
    return;
  }
  if (_syncState === 'syncing') {
    dot.className = 'drive-dot syncing';
    lbl.textContent = 'Guardando en Supabase...';
  } else if (_syncState === 'error') {
    dot.className = 'drive-dot err';
    lbl.textContent = '⚠ Error al guardar — clic para reintentar';
  } else if (_syncState === 'pending') {
    dot.className = 'drive-dot pending';
    lbl.textContent = 'Cambios sin guardar';
  } else {
    // idle: todo OK
    dot.className = 'drive-dot on';
    if (_lastSyncTime) {
      const segundos = Math.round((Date.now() - _lastSyncTime) / 1000);
      if (segundos < 5) {
        lbl.textContent = 'Supabase ✓ guardado';
      } else if (segundos < 60) {
        lbl.textContent = 'Supabase ✓ hace ' + segundos + 's';
      } else {
        const min = Math.round(segundos / 60);
        lbl.textContent = 'Supabase ✓ hace ' + min + 'min';
      }
    } else {
      lbl.textContent = 'Supabase ✓';
    }
  }
}
// Actualizar el indicador cada 10 segundos para refrescar el "hace Xs"
setInterval(function(){
  if (_syncState === 'idle') renderSyncIndicator();
}, 10000);
// ═══ MEJORA: DETECTOR DE CONECTIVIDAD (online/offline) ═══
// Muestra/oculta un chip rojo en el sidebar cuando se pierde internet.
// Cuando vuelve la conexión, intenta resincronizar lo que esté pendiente.
let _conexionPerdidaTime = null;
function actualizarEstadoConexion() {
  const chip = document.getElementById('connChip');
  if (!chip) return;
  const online = navigator.onLine;
  if (online) {
    chip.style.display = 'none';
    if (_conexionPerdidaTime !== null) {
      // Volvió la conexión — notificar
      const segundos = Math.round((Date.now() - _conexionPerdidaTime) / 1000);
      const tiempoTxt = segundos < 60 ? segundos + 's' : Math.round(segundos/60) + 'min';
      toast('🌐 Conexión restablecida (estuvo offline ' + tiempoTxt + ')', 'ok');
      _conexionPerdidaTime = null;
      // Intentar resincronizar con Supabase
      try {
        if (sbSession && Date.now() < sbExpiry) {
          // Re-disparar guardado para mandar lo que esté en localStorage a Supabase
          syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
        }
      } catch(e){ console.warn('reconectar:', e); }
    }
  } else {
    chip.style.display = 'flex';
    if (_conexionPerdidaTime === null) {
      _conexionPerdidaTime = Date.now();
      toast('⚠ Sin conexión a internet — los cambios se guardan localmente', 'err');
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
  if(lbl1){ const nombre = empleadoActual ? empleadoActual.nombre : (ok ? NOMBRE_TITULAR : ''); lbl1.textContent = ok ? ('Conectado · ' + nombre + ' ✓') : 'Error — Reconectar'; }
  // Ocultar barra al conectar
  const bar = document.querySelector('.drive-bar');
  if(bar) bar.style.display = ok ? 'none' : 'flex';
  const horaBadge = document.getElementById('hora-badge');
  if(horaBadge) horaBadge.style.display = ok ? 'none' : 'flex';
  // Badge del sidebar (chip de conexión)
  const dot2 = document.getElementById('driveDot');
  const lbl2 = document.getElementById('driveLabel');
  if(dot2) dot2.className = 'drive-dot '+(ok?'on':'err');
  if(lbl2) lbl2.textContent = ok ? 'Supabase ✓' : 'Reconectar Supabase';
}
// ── DETECTAR EMPLEADO POR CUENTA GOOGLE ─────────────────────────
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
    // La rueda dentada (⚙️) abre el Panel de Administrador — solo el admin
    // debe siquiera verla; a un empleado no le sirve de nada (no tiene
    // usuario/contraseña de admin) y solo genera confusión. Vive en el
    // mismo lugar que el logotipo del sidebar: para el admin se muestra la
    // rueda y se oculta el logotipo (nunca los dos encimados); para un
    // empleado se ve el logotipo normal, sin rueda.
    const gearBtn = document.getElementById('adminGearBtn');
    const logoImg = document.getElementById('sidebarLogoImg');
    const esAdminUI = empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if(gearBtn){
      gearBtn.style.display = esAdminUI ? 'flex' : 'none';
    }
    if(logoImg){
      logoImg.style.display = esAdminUI ? 'none' : '';
    }
    // "🔎 Scanner" de Contabilidad — herramienta de auditoría propia del
    // administrador, se oculta para empleados por la misma razón.
    const scannerBtn = document.getElementById('btnContabScanner');
    if(scannerBtn){
      scannerBtn.style.display = esAdminUI ? '' : 'none';
    }
    // "🛡️ Monitor" de Contabilidad — bitácora real de auditoría, oculto
    // para empleados por la misma razón que Scanner.
    const monitorBtn = document.getElementById('btnContabMonitor');
    if(monitorBtn){
      monitorBtn.style.display = esAdminUI ? '' : 'none';
    }
    console.log('✓ Empleado activo:', empleadoActual.nombre, '(' + empleadoActual.email + ')');
  }
}
// ── PARTE 1: ESTADO PERSISTENTE EN SUPABASE (antes JSON en Drive) ─────────
let _sincronizando = false;
let _sincronizandoTs = 0; // timestamp para detectar locks infinitos
async function sincronizarFolio(forzarSB){
  // Guard: si lleva más de 15s activo, el flag quedó trabado — resetear
  if(_sincronizando && (Date.now() - _sincronizandoTs) < 15000) return;
  if(!window.SB || !window.SB_DESPACHO_ID){
    console.warn('[SB] sincronizarFolio: sin sesión / despacho');
    return;
  }
  _sincronizando = true;
  _sincronizandoTs = Date.now();
  // ═══════════════════════════════════════════════════════════════════
  // FIX GENERAL — causa raíz común a varios bugs ya reportados ("edito o
  // borro algo, sale el aviso de éxito, pero al rato vuelve a su valor
  // viejo": Editar Cobros/Egresos, Borrar Cobro Específico, y
  // potencialmente cualquier otra pantalla que use
  // syncEstadoSupabaseDebounced/guardarTodo para subir un cambio puntual).
  // syncEstadoSupabaseDebounced() agenda la subida real 800ms después y
  // devuelve una promesa ya resuelta de inmediato — así que, durante esos
  // 800ms (más lo que tarde la red), Supabase todavía tiene la fila VIEJA.
  // Si en esa ventana llega un pull (polling de respaldo cada 30s, un
  // broadcast Realtime de otro dispositivo/pestaña, o incluso otro login),
  // este mismo sincronizarFolio() bajaba esos datos viejos y sobreescribía
  // la memoria local, borrando el cambio recién hecho antes de que la
  // subida debounced pudiera confirmarlo.
  // En vez de seguir marcando "protegido" cada función de edición/borrado
  // una por una, se ataca la causa raíz UNA sola vez aquí: si hay una
  // subida pendiente en el debounce, este pull la ADELANTA y ESPERA a que
  // termine ANTES de leer nada de Supabase — así el servidor SIEMPRE
  // refleja el último cambio local antes de que cualquier pull (presente o
  // futuro, de cualquier pantalla) pueda competir con él.
  if(typeof _syncDebounceTimer !== 'undefined' && _syncDebounceTimer){
    clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = null;
    try { if(typeof syncEstadoSupabase === 'function') await syncEstadoSupabase(); }
    catch(e){ console.warn('[SB] sincronizarFolio: fallo al adelantar subida pendiente antes del pull:', e); }
  }
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
        console.log('[SB] No hay estado previo — creando inicial...');
        await window.SB.from('app_state').insert({
          despacho_id: window.SB_DESPACHO_ID,
          data: {movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],cierres:[],prestamos:[],saldoAcumulado:0,leyes:[]},
          recibos: {folioActual:1, recibos:[]},
          folio_actual: 100
        });
        appData = { folioActual: 1, anioFolioActual: new Date().getFullYear(), recibos: [] };
      } else {
        console.error('[SB] sincronizarFolio:', error);
      }
    } else if(data){
      // Reconstruir appData — usar Supabase para recibos CON PROTECCIÓN
      const recibosData = data.recibos || {};
      const sbRecibos = recibosData.recibos || [];
      const recibosActuales = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
      // ── Tombstones: unión de folios eliminados en SB y en memoria local ────────
      // Cuando el admin elimina un folio, se registra en folios_eliminados.
      // Todos los clientes reciben esta lista al sincronizar y filtran antes de fusionar,
      // lo que evita que un browser con estado viejo re-suba folios ya eliminados.
      const _sbTombs  = recibosData.folios_eliminados || [];
      const _locTombs = (typeof appData !== 'undefined' && Array.isArray(appData.folios_eliminados)) ? appData.folios_eliminados : [];
      // Unión: ningún tombstone se pierde nunca
      const _tombstones = [..._sbTombs];
      _locTombs.forEach(function(t){
        if(!_tombstones.some(function(x){ return String(x.folio)===String(t.folio) && x.letra===t.letra; }))
          _tombstones.push(t);
      });
      function _esTombstone(r){
        // Supersesión: el tombstone NO aplica si el recibo fue revivido después
        return _tombstones.some(function(t){ return _tombstoneAplicaA(t, r); });
      }

      // ⚠️ CRÍTICO: proteger recibos igual que movimientos.
      // Si Supabase trae MENOS versiones del mismo folio que memoria → conservar memoria.
      // Esto evita que una sync tardía sobreescriba el B recién generado con solo el A.
      // Los tombstones se filtran ANTES de fusionar para que ningún cliente re-suba eliminados.
      function _mergeRecibos(sbArr, localArr) {
        // ── BLOQUEO: proteger recibos locales de tombstones remotos obsoletos ──────
        // Si un recibo está en el backup local y NO fue eliminado en esta sesión
        // (_locTombs no lo tiene), darle _revivedTs = ahora para protegerlo de
        // tombstones históricos obsoletos.
        // EXCEPCIÓN: si el tombstone en SB tiene ts > Date.now() + 5000, es un
        // tombstone de admin (_adminForce con +10000ms) — NO proteger el recibo.
        var _ahora = Date.now();
        localArr.forEach(function(r) {
          if (!r || r._revivedTs) return;
          var tieneLocTomb = _locTombs.some(function(t){
            return String(t.folio) === String(r.folio) && (t.letra||'A') === (r.letra||'A');
          });
          if (tieneLocTomb) return;
          // Tombstone de admin en SB (ts futuro = _adminForce con +10000)
          var tieneSbAdminTomb = _sbTombs.some(function(t){
            return String(t.folio) === String(r.folio) && (t.letra||'A') === (r.letra||'A')
                   && Number(t.ts||0) > _ahora + 5000;
          });
          if (tieneSbAdminTomb) return; // admin eliminó — no proteger
          r._revivedTs = _ahora;
        });
        // Filtrar tombstones de ambos lados antes de cualquier fusión
        const sbFilt    = sbArr.filter(function(r){ return !_esTombstone(r); });
        const localFilt = localArr.filter(function(r){ return !_esTombstone(r); });
        if (!localFilt.length) return sbFilt;
        if (!sbFilt.length)   return localFilt;
        // Construir mapa de versiones: folio+letra → recibo
        const mapaLocal = {};
        localFilt.forEach(function(r) {
          var k = r.folio + '|' + (r.letra || 'A');
          mapaLocal[k] = r;
        });
        const mapaSB = {};
        sbFilt.forEach(function(r) {
          var k = r.folio + '|' + (r.letra || 'A');
          mapaSB[k] = r;
        });
        // Resultado: unión de ambos, priorizando SB pero conservando versiones locales que SB no tiene
        const claves = new Set([...Object.keys(mapaSB), ...Object.keys(mapaLocal)]);
        const resultado = [];
        claves.forEach(function(k) {
          if (mapaSB[k]) {
            resultado.push(mapaSB[k]); // SB tiene esta versión → usar SB
          } else {
            resultado.push(mapaLocal[k]); // solo local la tiene → conservar
            console.warn('[merge recibos] versión solo en local conservada:', k);
          }
        });
        // Ordenar: A antes de B del mismo folio.
        // ⚠️ NO usar sort() con return 0 para folios distintos — el comparador
        // no transitivo producía orden indefinido (B antes que A), lo que hacía
        // que las limpiezas de duplicados conservaran el B y eliminaran el A.
        // Aquí se agrupa por folio preservando el orden de aparición y se
        // ordenan las letras DENTRO de cada folio de forma determinista.
        const _ordenFolios = [];
        const _porFolio = {};
        resultado.forEach(function(r) {
          var f = String(r.folio);
          if (!_porFolio[f]) { _porFolio[f] = []; _ordenFolios.push(f); }
          _porFolio[f].push(r);
        });
        const _ordenado = [];
        _ordenFolios.forEach(function(f) {
          _porFolio[f].sort(function(a, b) {
            var la = (a.letra || 'A'); var lb = (b.letra || 'A');
            return la < lb ? -1 : la > lb ? 1 : 0;
          });
          _porFolio[f].forEach(function(r) { _ordenado.push(r); });
        });
        return _ordenado;
      }
      const recibosFinales = _mergeRecibos(sbRecibos, recibosActuales);
      // Purgar tombstones superados por recibos revividos para que este cliente
      // deje de re-subirlos y todos converjan a su eliminación definitiva.
      const _tombstonesFinales = (typeof _purgarTombstonesSuperados === 'function')
        ? _purgarTombstonesSuperados(_tombstones, recibosFinales) : _tombstones;
      // folioActual viene de la columna folio_actual de Supabase (actualizada atómicamente
      // por reservar_folio_atomico), no del campo recibos que puede llegar tarde.
      // data.folio_actual es siempre el más actualizado.
      appData = {
        folioActual:      data.folio_actual || recibosData.folioActual || 1,
        anioFolioActual:  recibosData.anioFolioActual || new Date().getFullYear(),
        folios_eliminados: _tombstonesFinales,
        recibos:          recibosFinales
      };
      // Re-subir si local tiene más recibos que SB (conservación de versiones locales)
      // O si local tiene tombstones que SB no tiene (propagación de tombstones a otros clientes)
      const _sbFiltCount    = sbRecibos.filter(function(r){ return !_esTombstone(r); }).length;
      const _hayTombsNuevos = _tombstonesFinales.length > _sbTombs.length;
      const _hayTombsPurgados = _tombstonesFinales.length < _tombstones.length;
      if (recibosFinales.length > _sbFiltCount || _hayTombsNuevos || _hayTombsPurgados) {
        console.warn('[merge recibos] re-subiendo — recibos extra:', recibosFinales.length - _sbFiltCount, '| tombstones nuevos:', _tombstonesFinales.length - _sbTombs.length, '| purgados:', _tombstones.length - _tombstonesFinales.length);
        setTimeout(function(){ if(typeof actualizarArchivoControl==='function') actualizarArchivoControl().catch(function(e){ console.warn('re-upload recibos:', e); }); }, 800);
      }
      // Reconstruir D — PROTECCIÓN TOTAL CONTRA PÉRDIDA DE DATOS
      if(typeof D !== 'undefined' && data.data){
        // ══════════════════════════════════════════════════════════════
        // SUPABASE ES LA FUENTE DE VERDAD para todo, EXCEPTO movimientos
        // de recibo (fuente==='recibo'). Para esos se hace UNIÓN por id
        // con lo que ya hay en memoria local, igual que ya hace
        // syncEstadoSupabase() al subir (ver "Fusionar MOVIMIENTOS de
        // recibo de SB con los locales", ~línea 36149).
        // Por qué: sin esto, si este dispositivo acaba de crear un
        // movimiento de recibo (ej. una recuperación M-RECUP-) y ESTA
        // función se ejecuta antes de que ese movimiento termine de
        // confirmarse en Supabase, el sobreescribir con sbMovs lo borra
        // de memoria. En el siguiente ciclo el sistema vuelve a ver la
        // misma brecha y fabrica OTRO movimiento con ID distinto — la
        // causa raíz de los duplicados M-RECUP- diagnosticada por
        // SCANSYS PRO ("🔬 Diagnosticar por qué se duplicó").
        // Los movimientos que NO son de recibo (caja/retiro/manual)
        // conservan el comportamiento original (SB gana tal cual).
        // ══════════════════════════════════════════════════════════════
        const sbMovs    = data.data.movimientos || [];
        const sbJuicios = data.data.juicios     || [];
        const sbPends   = data.data.pendientes  || [];
        const _localMovsPrev = Array.isArray(D.movimientos) ? D.movimientos : [];
        const _sbMovTombsPull = data.data.movimientos_eliminados || [];
        if(!Array.isArray(D.movimientos_eliminados)) D.movimientos_eliminados = [];
        _sbMovTombsPull.forEach(function(t){
          if(t && t.id && !D.movimientos_eliminados.some(function(x){ return x.id===t.id; }))
            D.movimientos_eliminados.push(t);
        });
        const _movTombSetPull = new Set(D.movimientos_eliminados.map(function(t){ return t && t.id; }));
        const _logKeyPull = function(m){
          return String(m.folio)+'|'+(m.letra||'A')+'|'+(m.fecha||'')+'|'+((m.hora||'').slice(0,5))+'|'+(parseFloat(m.monto)||0)+'|'+(m.estatus||'');
        };
        // FIX (caso real: "Editar Cobros/Egresos" — la edición de un movimiento
        // manual/caja parecía guardarse [toast de éxito] pero al rato volvía a
        // su valor viejo). Causa raíz: la protección de abajo ("conservar
        // locales aún no confirmados en Supabase") SOLO existía para
        // movimientos fuente==='recibo' — cualquier movimiento manual/caja
        // (ingreso, egreso, corrección, etc.) tomaba SIEMPRE la versión de
        // Supabase tal cual, sin fusionar. adminGuardarEdicion2Mov() aplica el
        // cambio en memoria y AGENDA la subida a Supabase con 800ms de
        // debounce (syncEstadoSupabaseDebounced) — si en esa ventana llega un
        // pull (polling de respaldo cada 30s, o broadcast Realtime de otro
        // dispositivo/pestaña) ANTES de que la subida propia termine, este
        // sincronizarFolio() sobreescribía D.movimientos con la fila vieja de
        // Supabase, borrando la edición de la memoria — y como la subida
        // debounced lee D en el momento en que finalmente dispara (800ms
        // después), terminaba re-subiendo esa misma versión vieja,
        // "confirmando" permanentemente la pérdida del cambio.
        // Se resuelve igual que ya se hace con los movimientos de recibo:
        // cualquier movimiento editado localmente hace muy poco (ver
        // _marcarMovEditadoLocal, usado por adminGuardarEdicion2Mov y
        // adminGuardarEdicionMov) conserva su versión LOCAL en este pull
        // durante una ventana de gracia, dando tiempo de sobra a que la
        // subida debounced llegue a Supabase.
        const _VENTANA_PROTEC_EDICION_MS = 15000;
        const _editsLocalesRecientesPull = window._movsEditadosRecientemente || {};
        Object.keys(_editsLocalesRecientesPull).forEach(function(id){
          if(Date.now() - _editsLocalesRecientesPull[id] > _VENTANA_PROTEC_EDICION_MS) delete _editsLocalesRecientesPull[id];
        });
        const _localNoRecEditadosMapPull = {};
        _localMovsPrev.forEach(function(m){
          if(m && m.fuente !== 'recibo' && m.id && _editsLocalesRecientesPull[m.id]) _localNoRecEditadosMapPull[m.id] = m;
        });
        // FIX (caso real: "Borrar Cobro Específico" — se borraba un movimiento
        // manual/caja, aparecía el toast de éxito, pero volvía a aparecer en
        // la lista al rato). Misma causa raíz que la edición: adminBorrarMovEspec()
        // quita el movimiento de D.movimientos en memoria y agenda el push
        // 800ms después — si un pull llega antes, Supabase todavía tiene el
        // movimiento (el borrado aún no se le confirmó) y lo reintroducía sin
        // que nada lo impidiera. Se excluyen aquí, durante la misma ventana de
        // gracia, los ids marcados como recién borrados localmente (ver
        // _marcarMovEliminadoLocal, usado por adminBorrarMovEspec).
        const _delsLocalesRecientesPull = window._movsEliminadosRecientemente || {};
        Object.keys(_delsLocalesRecientesPull).forEach(function(id){
          if(Date.now() - _delsLocalesRecientesPull[id] > _VENTANA_PROTEC_EDICION_MS) delete _delsLocalesRecientesPull[id];
        });
        const _sbNoRecPull = sbMovs
          .filter(function(m){ return !m || m.fuente !== 'recibo'; })
          .filter(function(m){ return !(m && m.id && _delsLocalesRecientesPull[m.id]); })
          .map(function(m){ return (m && m.id && _localNoRecEditadosMapPull[m.id]) ? _localNoRecEditadosMapPull[m.id] : m; });
        Object.keys(_localNoRecEditadosMapPull).forEach(function(id){
          if(!_sbNoRecPull.some(function(m){ return m && m.id === id; })) _sbNoRecPull.push(_localNoRecEditadosMapPull[id]);
        });
        if(Object.keys(_localNoRecEditadosMapPull).length){
          console.warn('[SB] sincronizarFolio: conservando '+Object.keys(_localNoRecEditadosMapPull).length+' movimiento(s) manual(es)/caja editados localmente hace <15s (aún no confirmados en Supabase)');
        }
        if(Object.keys(_delsLocalesRecientesPull).length){
          console.warn('[SB] sincronizarFolio: excluyendo '+Object.keys(_delsLocalesRecientesPull).length+' movimiento(s) manual(es)/caja borrados localmente hace <15s (aún no confirmados en Supabase)');
        }
        const _sbRecVivosPull = sbMovs.filter(function(m){ return m && m.fuente==='recibo' && m.id && !_movTombSetPull.has(m.id); });
        const _sbRecIdsPull  = new Set(_sbRecVivosPull.map(function(m){ return m.id; }));
        const _sbRecKeysPull = new Set(_sbRecVivosPull.map(_logKeyPull));
        const _soloLocalRecPull = _localMovsPrev.filter(function(m){
          return m && m.fuente==='recibo' && m.id && !_movTombSetPull.has(m.id)
            && !_sbRecIdsPull.has(m.id) && !_sbRecKeysPull.has(_logKeyPull(m));
        });
        if(_soloLocalRecPull.length){
          console.warn('[SB] sincronizarFolio: conservando '+_soloLocalRecPull.length+' movimiento(s) de recibo locales aún no confirmados en Supabase — '+_soloLocalRecPull.map(function(m){ return m.folio+(m.letra||'')+' $'+m.monto; }).join(', '));
        }
        D.movimientos           = _sbNoRecPull.concat(_sbRecVivosPull, _soloLocalRecPull);
        D._juiciosModTs         = data.data._juiciosModTs || 0;
        // Merge juicios: mismo problema de carrera ya corregido en
        // carpetas/escrituras/citas/pendientes — D.juicios = sbJuicios (sin
        // fusión) perdía en silencio cualquier término/acuerdo/edición local
        // reciente si un pull llegaba antes de que el push se confirmara.
        // Los juicios viejos no tenían id — guardarJuicio()/saveJuicios()
        // ahora les asigna uno (y actualiza updatedAt) en su primera edición;
        // mientras tanto se usa el expediente como llave de respaldo.
        (function(){
          const _VENTANA_PROTEC_JUI_MS = 15000;
          const _delsLocalesRecientesJui = window._juiciosEliminadosRecientemente || {};
          Object.keys(_delsLocalesRecientesJui).forEach(function(id){
            if(Date.now() - _delsLocalesRecientesJui[id] > _VENTANA_PROTEC_JUI_MS) delete _delsLocalesRecientesJui[id];
          });
          const _keyJui = function(j){ return j && (j.id || (j.expediente ? 'EXP:'+j.expediente : null)); };
          const _localJuicios = Array.isArray(D.juicios) ? D.juicios : [];
          const _mapaLocalJui = {};
          _localJuicios.forEach(function(j){ const k=_keyJui(j); if(k) _mapaLocalJui[k]=j; });
          const _sbJuiKeys = new Set(sbJuicios.map(_keyJui).filter(Boolean));
          const _fusionadasJui = sbJuicios
            .filter(function(j){ const k=_keyJui(j); return !(k && _delsLocalesRecientesJui[k]); })
            .map(function(j){
              const k = _keyJui(j);
              const _loc = k ? _mapaLocalJui[k] : null;
              if (_loc) {
                const tsLoc = _loc.updatedAt || 0;
                const tsSb  = j.updatedAt || 0;
                if (tsLoc > tsSb) return _loc;
              }
              return j;
            });
          const _soloLocalesJui = _localJuicios.filter(function(j){ const k=_keyJui(j); return k ? !_sbJuiKeys.has(k) : true; });
          D.juicios = [..._fusionadasJui, ..._soloLocalesJui];
        })();
        // Merge gestiones: mismo problema — g.id siempre existe, se compara
        // fechaMod (estampado por _gestGuardarYRefrescar/gestGuardarCambios).
        (function(){
          const _sbGestiones = data.data.gestiones || [];
          const _localGestiones = Array.isArray(D.gestiones) ? D.gestiones : [];
          const _mapaLocalGest = {};
          _localGestiones.forEach(function(g){ if(g && g.id) _mapaLocalGest[g.id] = g; });
          const _sbGestIds = new Set(_sbGestiones.map(function(g){ return g.id; }));
          const _fusionadasGest = _sbGestiones.map(function(g){
            const _loc = g && g.id ? _mapaLocalGest[g.id] : null;
            if (_loc) {
              const tsLoc = Date.parse(_loc.fechaMod || 0) || 0;
              const tsSb  = Date.parse(g.fechaMod || 0) || 0;
              if (tsLoc > tsSb) return _loc;
            }
            return g;
          });
          const _soloLocalesGest = _localGestiones.filter(function(g){ return g && g.id && !_sbGestIds.has(g.id); });
          D.gestiones = [..._fusionadasGest, ..._soloLocalesGest];
        })();
        // Merge directorio: mismo problema — guardarContacto() ahora asigna
        // id+fechaMod a cada contacto (los viejos lo reciben en su primera
        // edición); mientras tanto se usa nombre+teléfono como llave de
        // respaldo. eliminarContacto() protege contra resurrección igual
        // que pendientes/juicios.
        (function(){
          const _VENTANA_PROTEC_CONT_MS = 15000;
          const _delsLocalesRecientesCont = window._contactosEliminadosRecientemente || {};
          Object.keys(_delsLocalesRecientesCont).forEach(function(id){
            if(Date.now() - _delsLocalesRecientesCont[id] > _VENTANA_PROTEC_CONT_MS) delete _delsLocalesRecientesCont[id];
          });
          const _sbDirectorio = data.data.directorio || [];
          const _keyCont = function(c){ return c && (c.id || ((c.nombre||'')+'|'+(c.tel||''))); };
          const _localDirectorio = Array.isArray(D.directorio) ? D.directorio : [];
          const _mapaLocalCont = {};
          _localDirectorio.forEach(function(c){ const k=_keyCont(c); if(k) _mapaLocalCont[k]=c; });
          const _sbContKeys = new Set(_sbDirectorio.map(_keyCont).filter(Boolean));
          const _fusionadosCont = _sbDirectorio
            .filter(function(c){ const k=_keyCont(c); return !(k && _delsLocalesRecientesCont[k]); })
            .map(function(c){
              const k = _keyCont(c);
              const _loc = k ? _mapaLocalCont[k] : null;
              if (_loc) {
                const tsLoc = Date.parse(_loc.fechaMod || 0) || 0;
                const tsSb  = Date.parse(c.fechaMod || 0) || 0;
                if (tsLoc > tsSb) return _loc;
              }
              return c;
            });
          const _soloLocalesCont = _localDirectorio.filter(function(c){ const k=_keyCont(c); return k ? !_sbContKeys.has(k) : true; });
          D.directorio = [..._fusionadosCont, ..._soloLocalesCont];
        })();
        // Merge carpetas: mismo problema que ya se corrigió en pre-recibos —
        // si una carpeta se editó/creó localmente y ese cambio aún no se
        // confirmó en Supabase, un pull que llegue en ese momento no debe
        // pisarlo con la copia vieja. Se compara fechaModificacion y gana
        // la más reciente; las carpetas que solo existen en memoria local
        // (recién creadas, aún sin subir) se conservan igual que antes.
        (function(){
          const _sbCarpetas = data.data.carpetas || [];
          const _localCarpetas = Array.isArray(D.carpetas) ? D.carpetas : [];
          const _mapaLocalCarp = {};
          _localCarpetas.forEach(function(c){ if(c && c.num) _mapaLocalCarp[c.num] = c; });
          const _sbCarpNums = new Set(_sbCarpetas.map(function(c){ return c.num; }));
          const _fusionadasCarp = _sbCarpetas.map(function(c){
            const _loc = _mapaLocalCarp[c.num];
            if (_loc) {
              const tsLoc = Date.parse(_loc.fechaModificacion || 0) || 0;
              const tsSb  = Date.parse(c.fechaModificacion || 0) || 0;
              if (tsLoc > tsSb) return _loc;
            }
            return c;
          });
          const _soloLocalesCarp = _localCarpetas.filter(function(c){ return !_sbCarpNums.has(c.num); });
          D.carpetas = [..._fusionadasCarp, ..._soloLocalesCarp];
        })();
        // Merge pendientes: mismo problema de carrera ya corregido en
        // carpetas/escrituras/citas — sobreescribir D.pendientes entero con
        // sbPends perdía en silencio cualquier cambio local reciente (ej. el
        // botón "+ Adjuntar" de Placas subía el archivo a Drive y lo agregaba
        // a p.documentos, pero si el polling de 30s hacía un pull antes de que
        // el push local se confirmara en Supabase, el documento desaparecía).
        // También protege contra "resucitar" un pendiente borrado a mano
        // (eliminarPend/toggleP) hace <15s cuyo borrado aún no se confirma
        // (ver _marcarPendEliminadoLocal).
        (function(){
          const _VENTANA_PROTEC_PEND_MS = 15000;
          const _delsLocalesRecientesPend = window._pendsEliminadosRecientemente || {};
          Object.keys(_delsLocalesRecientesPend).forEach(function(id){
            if(Date.now() - _delsLocalesRecientesPend[id] > _VENTANA_PROTEC_PEND_MS) delete _delsLocalesRecientesPend[id];
          });
          const _localPends = Array.isArray(D.pendientes) ? D.pendientes : [];
          const _mapaLocalPend = {};
          _localPends.forEach(function(p){ if(p && p.id) _mapaLocalPend[p.id] = p; });
          const _sbPendIds = new Set(sbPends.map(function(p){ return p.id; }));
          const _fusionadasPend = sbPends
            .filter(function(p){ return !(p && p.id && _delsLocalesRecientesPend[p.id]); })
            .map(function(p){
              const _loc = p && p.id ? _mapaLocalPend[p.id] : null;
              if (_loc) {
                const tsLoc = Date.parse(_loc.fechaMod || 0) || 0;
                const tsSb  = Date.parse(p.fechaMod || 0) || 0;
                if (tsLoc > tsSb) return _loc;
              }
              return p;
            });
          const _soloLocalesPend = _localPends.filter(function(p){ return p && p.id && !_sbPendIds.has(p.id); });
          D.pendientes = [..._fusionadasPend, ..._soloLocalesPend];
          // La numeración de ficha ya NO se guarda ni se reinicia aquí
          // (18/ago/2026) — pasó a ser dinámica, recalculada en cada render
          // de renderPend() según los pendientes activos del momento. Ver
          // _pendNumMapa ahí.
        })();
        // Merge citas: mismo problema ya corregido en carpetas/pre-recibos/
        // escrituras — si se agendó/eliminó una cita localmente y ese cambio
        // aún no se confirmó en Supabase, un pull que llegue en ese momento
        // no debe pisarla con la copia vieja. Se compara actualizadaEn y gana
        // la más reciente; las citas que solo existen en memoria local (recién
        // creadas, aún sin subir) se conservan igual que en carpetas.
        // FIX: además, si la cita fue BORRADA localmente (a mano con
        // citaEliminar, o automáticamente por citasLimpiarPasadas al vencer)
        // hace <15s, no se resucita aunque Supabase todavía tenga la copia
        // vieja — mismo patrón de ventana de gracia que ya protege
        // movimientos/pendientes/juicios/contactos. Sin esto, con dos
        // computadoras conectadas al mismo despacho (admin + empleada), el
        // pull de cualquiera de las dos podía "revivir" una cita recién
        // borrada antes de que el borrado terminara de confirmarse en el
        // servidor.
        (function(){
          const _VENTANA_PROTEC_CITA_MS = 15000;
          const _delsLocalesRecientesCitas = window._citasEliminadasRecientemente || {};
          Object.keys(_delsLocalesRecientesCitas).forEach(function(id){
            if(Date.now() - _delsLocalesRecientesCitas[id] > _VENTANA_PROTEC_CITA_MS) delete _delsLocalesRecientesCitas[id];
          });
          const _sbCitas = (data.data.citas || []).filter(function(c){
            return !(c && c.id && _delsLocalesRecientesCitas[c.id]);
          });
          const _localCitas = Array.isArray(D.citas) ? D.citas : [];
          const _mapaLocalCitas = {};
          _localCitas.forEach(function(c){ if(c && c.id) _mapaLocalCitas[c.id] = c; });
          const _sbCitaIds = new Set(_sbCitas.map(function(c){ return c.id; }));
          const _fusionadasCitas = _sbCitas.map(function(c){
            const _loc = _mapaLocalCitas[c.id];
            if (_loc) {
              const tsLoc = Date.parse(_loc.actualizadaEn || _loc.creadaEn || 0) || 0;
              const tsSb  = Date.parse(c.actualizadaEn || c.creadaEn || 0) || 0;
              if (tsLoc > tsSb) return _loc;
            }
            return c;
          });
          const _soloLocalesCitas = _localCitas.filter(function(c){ return !_sbCitaIds.has(c.id); });
          D.citas = [..._fusionadasCitas, ..._soloLocalesCitas];
        })();
        // Merge cierres: los cierres no se editan en línea (solo se crean o
        // se deduplican), así que no necesitan fechaMod — basta con no
        // perder un cierre creado localmente (cerrarCaja/cerrarCajaAutomatico/
        // adminCorteDeCaja) que todavía no se confirma en Supabase cuando
        // llega un pull. Se identifica por fecha+hora+tipo (mismo criterio
        // que ya usa limpiarCierresDuplicados para deduplicar).
        (function(){
          const _sbCierres = data.data.cierres || [];
          const _localCierres = Array.isArray(D.cierres) ? D.cierres : [];
          const _keyCierre = function(c){ return c && ((c.fecha||'')+'|'+(c.hora||'')+'|'+(c.automatico||c.auto?'auto':'man')); };
          const _sbCierreKeys = new Set(_sbCierres.map(_keyCierre));
          const _soloLocalesCierre = _localCierres.filter(function(c){ const k=_keyCierre(c); return k && !_sbCierreKeys.has(k); });
          D.cierres = [..._sbCierres, ..._soloLocalesCierre];
        })();
        D.prestamos             = data.data.prestamos     || [];
        D.saldoAcumulado        = data.data.saldoAcumulado || 0;
        // Merge escrituras: mismo problema ya corregido en carpetas/pre-recibos —
        // si una escritura se creó/editó/avanzó de paso localmente y ese cambio
        // aún no se confirmó en Supabase, un pull que llegue en ese momento no
        // debe pisarlo con la copia vieja. Se compara fechaMod y gana la más
        // reciente; las escrituras que solo existen en memoria local (recién
        // creadas, aún sin subir) se conservan igual que en carpetas.
        (function(){
          const _sbEscrituras = data.data.escrituras || [];
          const _localEscrituras = Array.isArray(D.escrituras) ? D.escrituras : [];
          const _mapaLocalEsc = {};
          _localEscrituras.forEach(function(e){ if(e && e.num) _mapaLocalEsc[e.num] = e; });
          const _sbEscNums = new Set(_sbEscrituras.map(function(e){ return e.num; }));
          const _fusionadasEsc = _sbEscrituras.map(function(e){
            const _loc = _mapaLocalEsc[e.num];
            if (_loc) {
              const tsLoc = Date.parse(_loc.fechaMod || 0) || 0;
              const tsSb  = Date.parse(e.fechaMod || 0) || 0;
              if (tsLoc > tsSb) return _loc;
            }
            return e;
          });
          const _soloLocalesEsc = _localEscrituras.filter(function(e){ return !_sbEscNums.has(e.num); });
          D.escrituras = [..._fusionadasEsc, ..._soloLocalesEsc];
        })();
        // Estos dos son listas de folios (strings) que se agregan/quitan desde
        // varias funciones admin — se unen local+SB (en vez de sobreescribir)
        // para no perder una adición local reciente que un pull adelantado
        // todavía no ve confirmada en Supabase.
        D.recibosExcluidosCaja  = Array.from(new Set([...(data.data.recibosExcluidosCaja||[]), ...(Array.isArray(D.recibosExcluidosCaja)?D.recibosExcluidosCaja:[])].map(String)));
        D.cortesDeshabilitados  = Array.from(new Set([...(data.data.cortesDeshabilitados||[]), ...(Array.isArray(D.cortesDeshabilitados)?D.cortesDeshabilitados:[])].map(String)));
        // Merge pre-recibos: conservar los que están en memoria local y no están en Supabase
        // para evitar pérdida de pre-recibos creados entre sincronizaciones.
        // ⚠️ PROTECCIÓN: si un pre-recibo YA se marcó convertido:true en memoria local
        // (se generó su recibo con folio) pero la copia de Supabase todavía no llegó
        // a reflejar esa conversión (push aún no confirmado), NO revertirlo — si no,
        // el pre-recibo "revive" en el panel de pendientes aunque ya tenga folio real.
        const _sbPreRecibos = data.data.preRecibos || [];
        const _localPreRecibos = Array.isArray(D.preRecibos) ? D.preRecibos : [];
        const _mapaLocalPR = {};
        _localPreRecibos.forEach(function(p){ if(p && p.id) _mapaLocalPR[p.id] = p; });
        const _sbIds = new Set(_sbPreRecibos.map(p => p.id));
        const _fusionadosSB = _sbPreRecibos.map(function(p){
          const _loc = _mapaLocalPR[p.id];
          if (_loc && _loc.convertido && !p.convertido) return _loc;
          return p;
        });
        const _soloLocales = _localPreRecibos.filter(p => !_sbIds.has(p.id));
        D.preRecibos = [..._fusionadosSB, ..._soloLocales];
        // Catálogo de leyes del despacho — compartido entre todos los dispositivos
        if (Array.isArray(data.data.leyes) && data.data.leyes.length) {
          D.leyes = data.data.leyes;
          localStorage.setItem('lex-leyes-despacho', JSON.stringify(D.leyes));
        } else if (!D.leyes || !D.leyes.length) {
          // Migración: si hay leyes en localStorage pero aún no en SB, conservarlas
          const _localLeyes = JSON.parse(localStorage.getItem('lex-leyes-despacho') || '[]');
          if (_localLeyes.length) D.leyes = _localLeyes;
        }

        if(data.data.retro_global !== undefined) D.retro_global = data.data.retro_global;
        if(data.data.tiempoExtra !== undefined) D.tiempoExtra = data.data.tiempoExtra || {};
        // Migrar pendientes legacy: marca/clase → vehMarca/vehClase
        D.pendientes.forEach(p=>{ if(p.seccion==='placas'){ if(!p.vehMarca&&p.marca) p.vehMarca=p.marca; if(!p.vehClase&&p.clase) p.vehClase=p.clase; } });
        // ── LIMPIEZA INMEDIATA: eliminar pendientes de placas cuyo recibo ya está liquidado ──
        // Se corre aquí porque Supabase acaba de sobreescribir D.pendientes con los datos del servidor
        (function _limpiarPlacasLiquidadas(){
          if(!Array.isArray(appData.recibos)) return;
          var _lbSB = JSON.parse(localStorage.getItem('lex-placas-liquidados') || '[]');
          var _borrados = 0;
          D.pendientes = D.pendientes.filter(function(p){
            if(p.seccion !== 'placas' || !p.reciboVinculadoFolio) return true;
            var _versLb = appData.recibos.filter(function(r){ return Number(r.folio) === Number(p.reciboVinculadoFolio); });
            // Calcular saldo mínimo — tratar string "0", null y undefined como 0
            var saldo = _versLb.reduce(function(m,r){
              var s = (r.saldoPendiente !== undefined && r.saldoPendiente !== null) ? parseFloat(r.saldoPendiente) : NaN;
              if(!isNaN(s)) return Math.min(m, s);
              var sn = (r.saldoNuevo !== undefined && r.saldoNuevo !== null) ? parseFloat(r.saldoNuevo) : NaN;
              if(!isNaN(sn)) return Math.min(m, sn);
              if(r.liquidado === true) return Math.min(m, 0);
              // Sin dato de saldo en este recibo — asumir 0 si es versión secundaria (B,C,D)
              // para evitar que Infinity bloquee la limpieza
              var letra = r.letra || 'A';
              if(letra !== 'A') return Math.min(m, 0);
              return m;
            }, Infinity);
            // Si ningún recibo tiene saldo definido, saldo queda Infinity → no eliminar (dato faltante, no liquidado)
            // Excepto si el folio tiene al menos un recibo secundario con saldo 0 (ya manejado arriba)
            var _cancelLb = _versLb.some(function(r){ return r.cancelado; });
            if(_versLb.length === 0 || _cancelLb || !(saldo > 0)){
              var fs = String(p.reciboVinculadoFolio);
              if(_lbSB.indexOf(fs) < 0) _lbSB.push(fs);
              _borrados++;
              return false;
            }
            return true;
          });
          if(_borrados > 0){
            localStorage.setItem('lex-placas-liquidados', JSON.stringify(_lbSB));
            console.log('[LEX] Limpieza SB-load: ' + _borrados + ' pendiente(s) de placas liquidados eliminados.');
            // Persistir en Supabase para que no vuelvan en la próxima recarga
            setTimeout(function(){ if(typeof save === 'function') save(); }, 800);
          }
          // Migración: propagar saldo mínimo real al registro A para folios históricos
          // donde _imprimirActualizacionReal nunca actualizó A (bug corregido en 2026-06-04).
          // Esto evita que PASO 2 de sincronizarPendientesPlacas recree pendientes en otros dispositivos.
          var _migrados = 0;
          var _foliosVistos = {};
          appData.recibos.forEach(function(r){
            if(!r || r.esComplemento || !r.folio) return;
            var fk = String(r.folio);
            if(_foliosVistos[fk]) return;
            _foliosVistos[fk] = true;
            var _vers = appData.recibos.filter(function(v){ return Number(v.folio) === Number(r.folio); });
            if(_vers.length < 2) return; // sin versiones secundarias, no hay nada que migrar
            var _saldoMin = _vers.reduce(function(m,v){
              var s=parseFloat(v.saldoPendiente); if(!isNaN(s)) return Math.min(m,s);
              var sn=parseFloat(v.saldoNuevo);   if(!isNaN(sn)) return Math.min(m,sn);
              if(v.liquidado===true) return Math.min(m,0);
              return m;
            }, Infinity);
            if(_saldoMin === Infinity) return;
            var _idxA = appData.recibos.findIndex(function(v){
              return Number(v.folio) === Number(r.folio) && !v.esComplemento && !v.esActualizacion;
            });
            if(_idxA < 0) return;
            var _recA = appData.recibos[_idxA];
            var _saldoA = parseFloat(_recA.saldoPendiente);
            if(!isNaN(_saldoA) && _saldoA <= _saldoMin) return; // ya está correcto
            appData.recibos[_idxA] = Object.assign({}, _recA, {
              saldoPendiente: _saldoMin,
              saldoNuevo:     _saldoMin,
              liquidado:      _saldoMin <= 0 ? true : (_recA.liquidado || false)
            });
            _migrados++;
          });
          if(_migrados > 0){
            console.log('[LEX] Migración saldo-A: ' + _migrados + ' recibo(s) originales sincronizados con saldo mínimo real.');
            setTimeout(function(){ if(typeof save === 'function') save(); }, 1200);
          }
        })();
        // captura_meses: cargar desde Supabase
        const sbCapturaMeses = data.data.captura_meses || {};
        if(Object.keys(sbCapturaMeses).length > 0){
          D.captura_meses = sbCapturaMeses;
        }
      }
      // Migración: asignar anio_folio a recibos históricos que no lo tienen
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
    // ⚠️ NO actualizar el display del folio si estamos en modo actualización (B, C, D…):
    // abrirModoActualizacion() ya puso la letra correcta y Realtime pisaría el display con el folio_actual principal.
    if(typeof actualizarFolioDisplay==='function' && !document.body.classList.contains('modo-actualizacion')){
      actualizarFolioDisplay();
    }
    if(typeof renderHistorial==='function') renderHistorial();
    if(typeof renderCaja==='function') renderCaja();
    if(typeof renderContab==='function') renderContab();
    if(typeof renderJuicios==='function') renderJuicios();
    if(typeof renderCarp==='function') renderCarp();
    if(typeof renderDirec==='function') renderDirec();
    if(typeof renderPend==='function') renderPend();
    if(typeof badges==='function') badges();
    if(typeof capturaMesCargarSupabase==='function') capturaMesCargarSupabase();
    if(typeof retroGlobalCargarSupabase==='function') retroGlobalCargarSupabase();
    // Auto-corregir letras de movimientos y paths R2 (silencioso, 8s después)
    if(typeof _autoCorregirLetrasR2 === 'function') _autoCorregirLetrasR2();
    // Verificar y corregir movimientos con monto erróneo para recibos Sin Anticipo (con modal de confirmación)
    // [DESACTIVADO a pedido del usuario] Auto-popup de "Corrección de movimientos Sin Anticipo".
    // La función verificarYCorregirMovimientosSinAnticipo SIGUE definida (puede invocarse
    // manualmente si se quisiera), pero ya NO se dispara sola al cargar, para que el modal
    // no vuelva a aparecer ni a empujar a aplicar cambios masivos sin revisión.
    // if(typeof verificarYCorregirMovimientosSinAnticipo === 'function') setTimeout(verificarYCorregirMovimientosSinAnticipo, 1500);
    // Backup diario a R2 — corre silenciosamente 3s despues de cargar datos
    setTimeout(function(){ backupAppData().catch(function(e){ console.warn('[Backup] inicio:', e); }); }, 3000);
  } catch(e){
    console.error('[SB] sincronizarFolio error:', e);
  } finally {
    _sincronizando = false;
  }
}
// ── Helper: carga datos del JSON con soporte de formatos ────────────────────
function _cargarDatosDesdeJSON(data){
  if(data && typeof data.folioActual === 'number'){
    appData.folioActual = data.folioActual;
    // ⚠️ CRÍTICO: ordenar para que A siempre preceda a B del mismo folio
    appData.recibos     = (data.recibos || []).slice().sort(function(a, b) {
      if (a.folio !== b.folio) return 0;
      var la = (a.letra || 'A'); var lb = (b.letra || 'A');
      return la < lb ? -1 : la > lb ? 1 : 0;
    });
  } else if(data && (data.folio_actual || data.siguiente_folio)){
    // Formato legacy — corregir y reescribir
    console.warn('⚠ Formato JSON legacy detectado — migrando...');
    appData.folioActual = data.folio_actual || data.siguiente_folio || data.folio_inicial || 1;
    appData.anioFolioActual = data.anio_folio_actual || new Date().getFullYear();
    // ⚠️ CRÍTICO: ordenar para que A siempre preceda a B del mismo folio
    appData.recibos     = (data.recibos || []).slice().sort(function(a, b) {
      if (a.folio !== b.folio) return 0;
      var la = (a.letra || 'A'); var lb = (b.letra || 'A');
      return la < lb ? -1 : la > lb ? 1 : 0;
    });
    actualizarArchivoControl(); // reescribir con formato correcto (no bloqueante)
  } else {
    // Archivo vacío o corrupto — mantener el folio en memoria sin resetear a 100
    console.warn('⚠ JSON sin datos válidos — manteniendo estado en memoria');
    if(!appData.folioActual || appData.folioActual < 1) appData.folioActual = 1;
  }
  // Tras cualquier carga/merge: el contador nunca puede quedar rebobinado.
  if(typeof _blindarContadorFolio === 'function') _blindarContadorFolio();
}
// ── RESERVAR FOLIO ATÓMICO EN DRIVE ─────────────────────────────
// Implementa "optimistic locking" con reintentos:
// 1. Lee el folio actual desde Supabase (fresco, no caché)
// 2. Intenta escribir folio+1 inmediatamente
// 3. Si dos usuarios colisionan, el que llegue segundo reintenta con el folio ya incrementado
// Garantiza que dos usuarios nunca obtengan el mismo folio.
async function reservarFolioEnDrive(){
  // ═══════════════════════════════════════════════════════════════
  // RESERVA ATÓMICA DE FOLIO — vía función SQL en PostgreSQL
  // ═══════════════════════════════════════════════════════════════
  // Antes: lectura → incremento JS → escritura (race condition)
  // Ahora: UNA llamada RPC que PostgreSQL ejecuta atómicamente.
  // Es IMPOSIBLE que dos llamadas obtengan el mismo folio.
  // ═══════════════════════════════════════════════════════════════
  if(!window.SB || !window.SB_DESPACHO_ID){
    // Sin sesión: fallback local (solo para que no rompa offline)
    const f = appData.folioActual;
    appData.folioActual = f + 1;
    console.warn('⚠ Folio local usado (sin sesión Supabase):', f);
    return f;
  }
  try {
    // Llamada atómica a PostgreSQL — lock + increment + return en 1 transacción
    const { data: folio, error } = await window.SB.rpc('reservar_folio_atomico', {
      p_despacho_id: window.SB_DESPACHO_ID
    });
    if(error) throw error;
    if(folio == null) throw new Error('La función no devolvió folio');
    // Actualizar AMBOS contadores locales para que syncEstadoSupabase no revierta con el valor viejo
    appData.folioActual = folio + 1;
    if(typeof REC !== 'undefined' && REC) REC.folioActual = folio + 1;
    console.log('✓ Folio reservado (atómico):', folio, '— próximo:', folio + 1);
    return folio;
  } catch(e) {
    console.error('❌ reservarFolioEnDrive (RPC):', e);
    // Fallback local: buscar el primer folio que NO exista ya en appData.recibos
    console.warn('⚠ Usando fallback local para folio (RPC no disponible)');
    const recibosActuales = new Set((appData.recibos || []).map(r => r.folio));
    let f = Math.max(
      appData.folioActual || 1,
      // también considerar el mayor folio existente + 1
      ...([...(appData.recibos || [])].map(r => (r.folio || 0) + 1))
    );
    // Saltar cualquier folio ya usado
    while(recibosActuales.has(f)) f++;
    appData.folioActual = f + 1;
    if(typeof REC !== 'undefined' && REC) REC.folioActual = f + 1;
    console.warn('⚠ Folio fallback asignado:', f, '(próximo:', f+1, ')');
    return f;
  }
}
async function crearArchivoControl(){
  // En Supabase ya se crea el app_state vía trigger al registrar usuario.
  // Pero si por algo no existe, lo creamos aquí.
  if(!window.SB || !window.SB_DESPACHO_ID) return 'supabase';
  const { error } = await window.SB.from('app_state').upsert({
    despacho_id: window.SB_DESPACHO_ID,
    data: {movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],cierres:[],prestamos:[],saldoAcumulado:0,leyes:[]},
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
    // ── Sellar recibos activos contra tombstones remotos obsoletos ──────────────
    // Igual que en syncEstadoSupabase: recibos sin _revivedTs son vulnerables a
    // tombstones históricos de SB. Sellarlos antes del pre-read los protege.
    // EXCEPCIÓN: no sellar recibos que tienen tombstone local (admin los eliminó).
    var _ahoraAC = Date.now();
    (appData.recibos||[]).forEach(function(r){
      if(!r || r._revivedTs) return;
      var tieneLocTombAC = (appData.folios_eliminados||[]).some(function(t){
        return String(t.folio)===String(r.folio) && (t.letra||'A')===(r.letra||'A');
      });
      if(!tieneLocTombAC) r._revivedTs = _ahoraAC;
    });
    // ── Leer tombstones actuales de SB antes de escribir ────────────────────
    // CRÍTICO en multi-usuario: si el admin eliminó un folio y guardó el tombstone
    // en SB, este cliente (empleada) debe leerlo y fusionarlo ANTES de subir,
    // de lo contrario su upload sobreescribiría el tombstone y el folio volvería.
    try {
      const { data: _sbPreRead } = await _sbConTimeout(window.SB
        .from('app_state').select('recibos')
        .eq('despacho_id', window.SB_DESPACHO_ID).maybeSingle(), 4000, 'pre-lectura tombstones');
      const _sbTombsPre = (_sbPreRead?.recibos?.folios_eliminados) || [];
      if (_sbTombsPre.length > 0) {
        if (!Array.isArray(appData.folios_eliminados)) appData.folios_eliminados = [];
        _sbTombsPre.forEach(function(t){
          if(!appData.folios_eliminados.some(function(x){
            return String(x.folio)===String(t.folio) && x.letra===t.letra;
          })) appData.folios_eliminados.push(t);
        });
        // Restauraciones explícitas ganan sobre tombstones: limpiar tombstone de folios_eliminados
        // para que no se re-escriba en SB ni bloquee futuras sincronizaciones.
        (appData.recibos||[]).forEach(function(r){
          if(!r.esRestaurado) return;
          appData.folios_eliminados = appData.folios_eliminados.filter(function(t){
            return !(String(t.folio)===String(r.folio) && t.letra===(r.letra||'A'));
          });
        });
        // Supersesión por timestamp: tombstones superados por recibos revividos
        // (_revivedTs posterior a la eliminación) se purgan definitivamente.
        if (typeof _purgarTombstonesSuperados === 'function') {
          appData.folios_eliminados = _purgarTombstonesSuperados(appData.folios_eliminados, appData.recibos);
        }
        // Proteger el folio que se está guardando AHORA MISMO (modo retro, abono de folio eliminado).
        // _folioGuardandose se establece en guardarRecibo() justo antes de llamar aquí.
        if (window._folioGuardandose != null) {
          appData.folios_eliminados = (appData.folios_eliminados||[]).filter(function(t){
            return !(String(t.folio)===String(window._folioGuardandose) && t.letra===(window._letraGuardandose||'A'));
          });
        }
        // ⚠ NO filtrar appData.recibos en memoria — solo filtrar en el payload de escritura.
        // Filtrar aquí elimina recibos recién creados de la memoria local si su folio
        // coincide con un tombstone (modo retro, abono eliminado, contador reseteado).
      }
    } catch(_eTombPre){ /* fallo silencioso — se usarán tombstones locales */ }

    // Estructura compatible con la versión anterior
    const ligero = {
      folioActual: appData.folioActual,
      anioFolioActual: appData.anioFolioActual || new Date().getFullYear(),
      folios_eliminados: appData.folios_eliminados || [],
      recibos: (appData.recibos||[]).filter(function(r){
        return !(appData.folios_eliminados||[]).some(function(t){
          return typeof _tombstoneAplicaA === 'function'
            ? _tombstoneAplicaA(t, r)
            : (String(t.folio)===String(r.folio) && t.letra===(r.letra||'A'));
        });
      }).map(r=>({
        folio:r.folio, anio_folio:r.anio_folio||new Date().getFullYear(),
        _revivedTs: r._revivedTs || null,
        nombre:r.nombre, fecha:r.fecha, hora:r.hora,
        archivo:r.archivo, saldoPendiente:r.saldoPendiente,
        esComplemento:r.esComplemento||false, folioRef:r.folioRef||null,
        generadoPor:r.generadoPor||NOMBRE_TITULAR,
        clientes: r.clientes||[{nombre:r.nombre||'',movil:'',tel:'',domicilio:''}],
        tipoTramite: r.tipoTramite||'normal',
        tipo_doc: r.tipo_doc||'copia',
        saldoRestanteConcepto: r.saldoRestanteConcepto||'',
        saldoRestanteDescripcion: r.saldoRestanteDescripcion||'',
        copias: r.copias||[],
        tramites: r.tramites||'',
        clase:r.clase||'', marca:r.marca||'', tipo_veh:r.tipo_veh||'', serie:r.serie||'',
        motor:r.motor||'', personas_veh:r.personas_veh||'', anio:r.anio||'', puertas:r.puertas||'',
        color_veh:r.color_veh||'', transmision:r.transmision||'',
        cilindros:r.cilindros||'', placa:r.placa||'', placaEstado:r.placaEstado||'',
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
        fechaCancelacion: r.fechaCancelacion||'',
        letra: r.letra||null,
        archivoR2: r.archivoR2||null,
        esVersionAnterior: r.esVersionAnterior||false,
        esActualizacion: r.esActualizacion||false,
        fechaActualizacion: r.fechaActualizacion||null,
        horaActualizacion: r.horaActualizacion||null,
        cancelacionConceptoInterno: r.cancelacionConceptoInterno||'',
        cancelacionTipo: r.cancelacionTipo||'',
        cancelacionMonto: r.cancelacionMonto||0,
        modoCosto: r.modoCosto||'',
        _cargosInternos: r._cargosInternos||[],
        _tituloFichaJuicio: r._tituloFichaJuicio||''
      }))
    };
    // Obtener user ID fuera del objeto para evitar await dentro de literal
    let _updByArc = null;
    try { _updByArc = (await Promise.race([window.SB.auth.getUser(), new Promise((_,rj)=>setTimeout(()=>rj(new Error('getUser timeout')),4000))])).data?.user?.id || null; } catch(_egu){}
    const { error } = await _sbConTimeout(window.SB
      .from('app_state')
      .update({
        recibos: ligero,
        folio_actual: ligero.folioActual,
        updated_by: _updByArc
      })
      .eq('despacho_id', window.SB_DESPACHO_ID), 30000, 'subida de recibos');
    if(error){
      throw new Error('actualizarArchivoControl: '+error.message);
    }
    console.log('✓ archivoControl actualizado — folioActual:', ligero.folioActual, '— recibos:', ligero.recibos.length);
    try { backupAppData(); } catch(e){ console.warn('backup appData:', e); }
    // ⚠️ CRÍTICO: marcar timestamp para que _realtimeSincronizar no baje Supabase
    // inmediatamente después de subir — evita que el B recién guardado sea sobreescrito
    _ultimoSyncPropio = Date.now();
    // ── Notificar a otros usuarios que los recibos cambiaron ──
    try { lexRealtimeBroadcast(); } catch(e){ registrarError('catch vacio', e); }
    syncEnd(true);
  } catch(e) {
    syncEnd(false, e.message || 'Error al sincronizar recibos');
    throw e;
  }
}
// Nombre de archivo CANÓNICO para R2: corto y estable (depende solo de folio+letra).
// Ej: "72A.pdf". No cambia si se edita el nombre del cliente → garantiza UN archivo por recibo.
function _nombreArchivoR2(folioStr, nombre) {
  return folioStr + '.pdf';
}
// Nombre DESCRIPTIVO legacy (formato viejo "72A_NOMBRE.pdf"). Solo se usa para
// localizar y purgar archivos antiguos; NO se generan nuevos con este formato.
function _nombreArchivoR2Legacy(folioStr, nombre) {
  var sanitizado = (nombre || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return folioStr + '_' + sanitizado + '.pdf';
}
// Purga TODAS las variantes del PDF de un folio (corta canónica + descriptiva legacy)
// en R2 y en Drive. Úsala al editar, eliminar o renumerar para no dejar duplicados.
async function _purgarPDFRecibo(folioStr, nombre){
  var variantes = new Set([folioStr + '.pdf']);
  if(typeof _nombreArchivoR2Legacy === 'function') variantes.add(_nombreArchivoR2Legacy(folioStr, nombre||''));
  var arr = Array.from(variantes);
  for(var i=0;i<arr.length;i++){
    var pn = arr[i];
    try{ if(typeof window.borrarR2==='function' && window.SB_DESPACHO_ID) await window.borrarR2(window.SB_DESPACHO_ID+'/recibos/'+pn, 'recibos').catch(function(){}); }catch(e){}
    try{ if(typeof borrarPDFdeDrive==='function') await borrarPDFdeDrive(pn).catch(function(){}); }catch(e){}
  }
}
// ══════════════════════════════════════════════════════════════════
// LIMPIEZA ÚNICA — Elimina PDFs duplicados ya acumulados en R2.
// Para cada folio+letra que tenga AMBOS nombres (corto "72A.pdf" y
// descriptivo "72A_NOMBRE.pdf"), conserva el corto (canónico) y borra el
// descriptivo. NO toca folios que solo tengan una versión → cero pérdida.
// ══════════════════════════════════════════════════════════════════
async function adminLimpiarDuplicadosR2(){
  if(!window.SB_DESPACHO_ID || typeof window.listarR2!=='function'){ alert('Sin conexión a R2.'); return; }
  if(!confirm('LIMPIAR PDFs DUPLICADOS EN R2\n\nPara cada recibo que tenga dos archivos (el corto "72A.pdf" y el descriptivo "72A_NOMBRE.pdf"), se conserva el CORTO y se borra el descriptivo.\n\nLos recibos con una sola versión NO se tocan (cero pérdida).\n\n¿Continuar?')) return;
  var prefix = window.SB_DESPACHO_ID + '/recibos/';
  if(typeof toast==='function') toast('⏳ Listando archivos en R2…');
  var objetos = await window.listarR2(prefix, 'recibos');
  if(!objetos || !objetos.length){ alert('No se encontraron archivos en R2/recibos/.'); return; }
  // Agrupar por folio+letra
  var reCorto = /^(\d+)([A-Z])\.pdf$/i;
  var reDesc  = /^(\d+)([A-Z])_.+\.pdf$/i;
  var grupos = {}; // "folio|letra" → { corto:[rutas], desc:[rutas] }
  objetos.forEach(function(obj){
    var ruta = obj.key || obj.name || '';
    var nombre = ruta.split('/').pop();
    var m = reCorto.exec(nombre), tipo=null;
    if(m){ tipo='corto'; }
    else { m = reDesc.exec(nombre); if(m) tipo='desc'; }
    if(!m) return;
    var k = Number(m[1]) + '|' + m[2].toUpperCase();
    if(!grupos[k]) grupos[k] = { corto:[], desc:[] };
    grupos[k][tipo].push(ruta);
  });
  // Borrar descriptivos solo donde también existe el corto
  var borrados=0, gruposAfectados=0, refsActualizadas=0;
  var keys = Object.keys(grupos);
  for(var i=0;i<keys.length;i++){
    var g = grupos[keys[i]];
    if(g.corto.length && g.desc.length){
      gruposAfectados++;
      var partes = keys[i].split('|');
      var folioNum = Number(partes[0]), letra = partes[1];
      var folioStr = folioConLetra(folioNum, 2026, letra);
      if(typeof toast==='function') toast('🧹 Limpiando #'+folioStr+' ('+g.desc.length+' duplicado(s))…');
      for(var j=0;j<g.desc.length;j++){
        try{ var ok = await window.borrarR2(g.desc[j], 'recibos'); if(ok) borrados++; }catch(e){ console.warn('[limpiarDup] borrar', g.desc[j], e); }
      }
      // Normalizar la referencia del recibo al nombre corto canónico
      (appData.recibos||[]).forEach(function(r){
        if(r && Number(r.folio)===folioNum && (r.letra||'A')===letra){
          r.archivo = folioStr + '.pdf';
          r.archivoR2 = folioStr + '.pdf';
          refsActualizadas++;
        }
      });
    }
  }
  if(refsActualizadas){
    try{ if(typeof save==='function') save(); }catch(e){ if(typeof registrarError==='function') registrarError('save (guardado)', e); }
    try{ if(typeof actualizarArchivoControl==='function') await actualizarArchivoControl(); }catch(e){ if(typeof registrarError==='function') registrarError('actualizarArchivoControl', e); }
    try{ if(typeof syncEstadoSupabase==='function') await syncEstadoSupabase(); }catch(e){ if(typeof registrarError==='function') registrarError('syncEstadoSupabase', e); }
  }
  alert('LIMPIEZA TERMINADA\n\n'
    + '• Folios con duplicado: '+gruposAfectados+'\n'
    + '• Archivos descriptivos borrados: '+borrados+'\n'
    + '• Referencias normalizadas a nombre corto: '+refsActualizadas+'\n\n'
    + (gruposAfectados? 'El bucket quedó con un solo PDF por recibo.' : 'No había duplicados que limpiar.'));
}
// ══════════════════════════════════════════════════════════════════
// RECUPERAR PDFs FALTANTES EN R2 — regenera desde los datos del recibo
// (sin OCR) y sube SOLO los que no existen. No toca los que ya están.
// ══════════════════════════════════════════════════════════════════
async function adminRecuperarPDFsFaltantesR2(){
  if(!window.SB_DESPACHO_ID || typeof window.listarR2!=='function' || typeof generarPDF!=='function'){
    alert('Sin conexión a R2 o falta el generador de PDF.'); return;
  }
  var _arr1 = (typeof appData!=='undefined' && appData.recibos) ? appData.recibos : [];
  var _arr2 = (typeof REC!=='undefined' && REC.recibos) ? REC.recibos : [];
  var recibos = Array.from(new Map(
    _arr1.concat(_arr2).filter(function(x){ return x && x.folio!=null; })
      .map(function(x){ return [x.folio+'|'+(x.letra||(typeof letraVersion==='function'?letraVersion(x):'A')||'A'), x]; })
  ).values());
  if(!recibos.length){ alert('No hay recibos en el sistema.'); return; }
  if(!confirm('RECUPERAR PDFs FALTANTES EN R2\n\nSe revisarán '+recibos.length+' recibo(s). A los que NO tengan PDF en R2 se les regenera desde sus datos y se sube (nombre corto canónico). Los que ya están NO se tocan.\n\nLos recibos cancelados se omiten (su PDF lleva sello especial).\n\n¿Continuar?')) return;
  // ── overlay de progreso ──
  try{ var _ex=document.getElementById('rec-recover-ov'); if(_ex) _ex.remove(); }catch(e){}
  var ov=document.createElement('div');
  ov.id='rec-recover-ov';
  ov.style.cssText='position:fixed;inset:0;background:rgba(12,9,5,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML=''
    +'<div style="background:var(--surface);border:1px solid var(--border-l);border-radius:var(--radius);width:480px;max-width:96vw;padding:22px;box-shadow:var(--shadow-lg);">'
    +  '<div style="font-size:0.9rem;font-weight:700;color:var(--ink);margin-bottom:6px;">📥 Recuperar PDFs faltantes en R2</div>'
    +  '<div id="rec-recover-status" style="font-size:0.7rem;color:var(--muted);font-family:monospace;margin-bottom:10px;min-height:1.2em;">Iniciando…</div>'
    +  '<div style="height:8px;background:var(--surface2);border-radius:5px;overflow:hidden;"><div id="rec-recover-bar" style="height:100%;width:0%;background:var(--gold);transition:width 0.2s;"></div></div>'
    +  '<button id="rec-recover-close" onclick="document.getElementById(\'rec-recover-ov\').remove()" style="display:none;margin-top:14px;padding:8px 16px;border-radius:6px;border:1px solid var(--border-l);background:var(--surface2);color:var(--ink);font-size:0.74rem;font-weight:700;cursor:pointer;">Cerrar</button>'
    +'</div>';
  document.body.appendChild(ov);
  var _status=function(t){ var el=document.getElementById('rec-recover-status'); if(el) el.textContent=t; };
  var _bar=function(f){ var el=document.getElementById('rec-recover-bar'); if(el) el.style.width=Math.round(f*100)+'%'; };

  if(typeof _ultimoSyncPropio!=='undefined') _ultimoSyncPropio=Date.now();
  _status('Listando lo que ya hay en R2…');
  var objetos = await window.listarR2(window.SB_DESPACHO_ID+'/recibos/', 'recibos');
  var existentes = new Set((objetos||[]).map(function(o){ return (o.key||o.name||'').split('/').pop().toLowerCase(); }));

  var recuperados=0, yaExistian=0, omitidosCancelados=0, errores=0;
  for(var i=0;i<recibos.length;i++){
    var r = recibos[i];
    var letra = r.letra || (typeof letraVersion==='function'?letraVersion(r):'A') || 'A';
    var fStr = folioConLetra(r.folio, r.anio_folio||2026, letra);
    _status('Revisando '+(i+1)+'/'+recibos.length+' — #'+fStr); _bar((i+1)/recibos.length);
    if(r.cancelado){ omitidosCancelados++; continue; }
    var corto = (fStr+'.pdf').toLowerCase();
    var desc  = (typeof _nombreArchivoR2Legacy==='function'? _nombreArchivoR2Legacy(fStr, r.nombre||'') : fStr+'.pdf').toLowerCase();
    if(existentes.has(corto) || existentes.has(desc)){
      yaExistian++;
      if(existentes.has(corto)){ r.archivo=fStr+'.pdf'; r.archivoR2=fStr+'.pdf'; }
      continue;
    }
    _status('Recuperando '+(i+1)+'/'+recibos.length+' — #'+fStr);
    try{
      var qrTxt='LEX-MEXICO|Folio:'+fStr+'|'+(r.nombre||'')+'|'+(r.fecha_recibo||r.fecha||'')+' '+(r.hora_recibo||r.hora||'');
      var qrURL=await qrToDataURL(qrTxt);
      var doc=await generarPDF(Object.assign({}, r, {anio_folio:r.anio_folio||2026, letra:letra}), r.folio, qrURL);
      r.pdfBase64=doc.output('datauristring');
      r.archivo=fStr+'.pdf'; r.archivoR2=fStr+'.pdf';
      await subirPDFaDrive(doc.output('blob'), fStr+'.pdf');
      recuperados++;
    }catch(e){ console.warn('[recuperarPDF] folio', r.folio, e); errores++; }
    await new Promise(function(res){ setTimeout(res, 60); });
  }
  if(recuperados){
    try{ if(typeof save==='function') save(); }catch(e){ if(typeof registrarError==='function') registrarError('save (guardado)', e); }
    try{ if(typeof actualizarArchivoControl==='function') await actualizarArchivoControl(); }catch(e){ if(typeof registrarError==='function') registrarError('actualizarArchivoControl', e); }
    try{ if(typeof syncEstadoSupabase==='function') await syncEstadoSupabase(); }catch(e){ if(typeof registrarError==='function') registrarError('syncEstadoSupabase', e); }
  }
  _status('Listo.'); _bar(1);
  var btn=document.getElementById('rec-recover-close'); if(btn) btn.style.display='inline-block';
  alert('RECUPERACIÓN TERMINADA\n\n'
    + '• Recibos revisados: '+recibos.length+'\n'
    + '• PDFs recuperados (subidos): '+recuperados+'\n'
    + '• Ya estaban en R2: '+yaExistian+'\n'
    + '• Cancelados omitidos: '+omitidosCancelados+'\n'
    + '• Errores: '+errores);
}
// ── PARTE 2: SUBIR PDF A SUPABASE STORAGE ────────────────────────
// r2Nombre (opcional): nombre descriptivo solo para R2. Supabase usa siempre nombreArchivo.
async function subirPDFaDrive(pdfBlob, nombreArchivo, r2Nombre){
  // Intentar subir a R2 primero (con nombre descriptivo si se proporcionó)
  if(typeof window.subirR2 === 'function' && window.SB_DESPACHO_ID){
    try {
      const r2n  = r2Nombre || nombreArchivo;
      const path = window.SB_DESPACHO_ID + '/recibos/' + r2n;
      const file = new File([pdfBlob], r2n, {type:'application/pdf'});
      const ok = await window.subirR2(file, path, 'recibos');
      if(ok){
        console.log('✓ PDF guardado en R2:', r2n);
        return true;
      }
    } catch(e){ console.warn('R2 upload falló, intentando Supabase:', e); }
  }
  // Fallback a Supabase Storage (siempre con el nombre corto)
  if(!window.SB || !window.SB_DESPACHO_ID) return false;
  try {
    const path = window.SB_DESPACHO_ID + '/recibos/' + nombreArchivo;
    const { error } = await window.SB.storage.from(STORAGE_BUCKET).upload(path, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true
    });
    if(error){ console.error('subirPDFaDrive:', error); return false; }
    console.log('✓ PDF subido a Supabase (fallback):', nombreArchivo);
    return true;
  } catch(e){ console.error('subirPDFaDrive:', e); return false; }
}
// Reemplaza un PDF existente (mismo nombre) o lo sube si no existe
async function reemplazarPDFenDrive(pdfBlob, nombreArchivo){
  return await subirPDFaDrive(pdfBlob, nombreArchivo);
}
// Compat: driveGET ahora retorna estado desde Supabase
async function driveGET(url){
  // Algunas funciones legacy invocan driveGET con URLs de Drive específicas.
  // Mapeamos la única realmente útil (leer el JSON principal) y devolvemos
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
  // Si la URL pide files/list, devolver lista no-vacía para compat
  if(url && url.includes('files?q=')){
    return { files: [{ id: 'supabase', name: 'lexmexico_folio_control.json', createdTime: new Date().toISOString() }] };
  }
  // Devolver el contenido del archivo de control en formato esperado
  return data.recibos || { folioActual: data.folio_actual || 100, recibos: [] };
}
// ── PARTE 4: GUARDAR EN DIRECTORIO (antes Sheets, ahora estado) ──
async function guardarEnDirectorio(datos){
  // DESACTIVADO: el directorio ya no se llena automáticamente al generar recibos.
  // Ahora el directorio se gestiona únicamente de forma manual.
  console.log('[Directorio] Auto-fill desactivado. Usa el directorio manual.');
  return false;
}
// ── FOLIO DISPLAY ────────────────────────────────────────────────
// Formato: AA-NN (año 2 dígitos + número sin padding fijo, mínimo 2 dígitos)
// Ejemplos: 26-01, 26-10, 26-100, 26-1000
// Formato de folio: número consecutivo infinito sin año (1, 2, 3 …)
function folioFormato(num, anioFolio){
  return String(Number(num));
}
// Devuelve la letra de versión de un recibo: A (original), B (1ra actualización), etc.
// Cuenta solo entradas que NO son 'Original' para derivar la versión correctamente.
function letraVersion(recibo){
  if(!recibo) return 'A';
  const n = (recibo.fechasImpresion || []).filter(f => f.etiqueta !== 'Original').length;
  return String.fromCharCode(65 + n); // 0=A, 1=B, 2=C...
}
// Devuelve el folio con su letra de versión: "1A", "1B", "130A", etc.
function folioConLetra(num, anioFolio, letra){
  return String(Number(num)) + (letra || 'A');
}
// Busca un recibo en appData por número de folio y devuelve su letra actual.
// Usa recibo.letra (campo guardado) o lo computa con letraVersion(); default 'A'.
function letraDeRecibo(folio) {
  const r = (typeof appData !== 'undefined' ? appData.recibos||[] : [])
    .find(function(r){ return r.folio === folio && !r.esComplemento; });
  return r ? (r.letra || letraVersion(r) || 'A') : 'A';
}
// Detecta cambio de año y reinicia el contador anual
// Blindaje del contador: garantiza que appData.folioActual NUNCA retroceda por
// debajo de (mayor folio ya emitido + 1). Protege contra el viejo reinicio anual,
// merges de Supabase con un valor stale, y regresiones por borrado de recibos.
function _blindarContadorFolio(){
  try {
    const usados = Object.create(null);
    const recs = (appData && appData.recibos) || [];
    for(let i=0; i<recs.length; i++){
      const f = Number(recs[i] && recs[i].folio);
      if(Number.isFinite(f)) usados[f] = true;
    }
    let f = Number(appData.folioActual);
    if(!Number.isFinite(f) || f < 1) f = 1;
    // El contador SOLO se corrige si apunta a un folio YA OCUPADO (riesgo de
    // duplicado por reinicio anual viejo, merge stale o regresión por borrado).
    // Si apunta a un hueco LIBRE (p. ej. tras "Insertar espacio" o "Usar
    // siguiente hueco"), se respeta — los huecos son números válidos por llenar.
    if(usados[f]){
      const prev = f;
      while(usados[f]) f++;
      console.warn('[LEX] folioActual apuntaba a un folio ocupado (' + prev +
        '); corregido al primer libre: ' + f);
    }
    if(appData.folioActual !== f){
      appData.folioActual = f;
      if(typeof REC !== 'undefined' && REC) REC.folioActual = f;
    }
  } catch(e){ console.error('[_blindarContadorFolio]', e); }
}
function verificarReinicioAnual(){
  // ── MODELO DE FOLIO CONTINUO E INFINITO ──────────────────────────────
  // El número de folio NUNCA se reinicia: es una secuencia perpetua (1,2,3…).
  // Solo se actualiza el año-sello (anio_folio) para los registros; el
  // contador folioActual sigue creciendo sin importar el cambio de año.
  const anioActual = new Date().getFullYear();
  if(!appData.anioFolioActual) appData.anioFolioActual = anioActual;
  if(appData.anioFolioActual !== anioActual){
    console.log('[LEX] Nuevo año detectado — folioActual NO se reinicia (secuencia continua). Año-sello: ' + anioActual);
    appData.anioFolioActual = anioActual;
    // ⚠️ NO se toca appData.folioActual: la secuencia es infinita.
  }
  // El contador jamás debe quedar por debajo del mayor folio ya emitido.
  _blindarContadorFolio();
}
function actualizarFolioDisplay(){
  // ⚠️ GUARD: en modo actualización (B, C, D…) abrirModoActualizacion() ya puso
  // la letra correcta. Sobreescribir con el folio_actual principal causaría que el
  // display saltara de "1B" a "96A" mientras el usuario llena el formulario.
  if(document.body.classList.contains('modo-actualizacion')) return;
  // ⚠️ GUARD: en modo edición completa el folio ya fue fijado por cargarReciboEnFormulario.
  // Sobreescribir con folioActual lo movería al folio libre del sistema (ej. folio 1).
  if(document.body.classList.contains('modo-edicion-completa')) return;
  // ⚠️ GUARD (caso real: restaurar folio #78A mostraba #97A): en modo restauración
  // rgenCapturar() ya fijó el folio EXACTO que se está restaurando vía
  // cargarReciboEnFormulario(). Sin este guard, cualquier oninput del formulario
  // (calcTotales(), etc. llaman a esta función en decenas de sitios) sobreescribía
  // el display con el folio_actual del sistema — el PRÓXIMO folio libre — en vez
  // de respetar el folio que el usuario pidió restaurar.
  if(document.body.classList.contains('modo-restauracion')) return;
  verificarReinicioAnual();
  $('folio-display').textContent = folioConLetra(appData.folioActual, null, 'A');
  if(typeof actualizarBadgeArchivoDesdeRecibo==='function') actualizarBadgeArchivoDesdeRecibo(appData.folioActual);
}
// ── CÁLCULOS ─────────────────────────────────────────────────────
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
  // Remove currency symbol, spaces, and commas → get float
  return parseFloat((val||'').replace(/[$\s,]/g,'')) || 0;
}

// ── Formateador automático de placas — formato XXX-XXX-X (mayúsculas) ──────
// Permite letras y números. Inserta guiones en posición 4 y 8 automáticamente.
// Funciona en todos los campos de placas del sistema.
function formatearPlaca(input) {
  var pos = input.selectionStart;
  var raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Limitar a 7 caracteres alfanuméricos (3+3+1)
  raw = raw.substring(0, 7);
  // Insertar guiones: XXX-XXX-X
  var formatted = '';
  if (raw.length <= 3) {
    formatted = raw;
  } else if (raw.length <= 6) {
    formatted = raw.substring(0, 3) + '-' + raw.substring(3);
  } else {
    formatted = raw.substring(0, 3) + '-' + raw.substring(3, 6) + '-' + raw.substring(6);
  }
  // Calcular nueva posición del cursor ajustando por guiones insertados
  var guionesAntes = (input.value.substring(0, pos).match(/-/g) || []).length;
  var rawPos = pos - guionesAntes;
  var guionesNuevos = (formatted.substring(0, rawPos <= 3 ? rawPos : rawPos <= 6 ? rawPos + 1 : rawPos + 2).match(/-/g) || []).length;
  var newPos = rawPos + guionesNuevos;
  input.value = formatted;
  // Restaurar posición del cursor
  try { input.setSelectionRange(newPos, newPos); } catch(e) {}
}

// ════════════════════════════════════════════════════════════════════
// SELECTOR DE ESTADO DE PLACAS — ventana flotante con nombres completos
// El valor vive en #placa-estado (hidden):
//   ''        → sin tocar (en pantalla se ve "Estado")
//   'SIN_ESP' → Sin especificar
//   'OAX'...  → código de estado
// En el PDF: estado real → abreviatura; vacío o SIN_ESP → "Sin esp.".
// ════════════════════════════════════════════════════════════════════
var _ESTADOS_PLACA = [
  ['SIN_ESP','Sin esp.','Sin especificar'],
  ['AGU','AGU','Aguascalientes'],
  ['BC','BC','Baja California'],
  ['BCS','BCS','Baja California Sur'],
  ['CAM','CAM','Campeche'],
  ['COA','COA','Coahuila'],
  ['COL','COL','Colima'],
  ['CHP','CHP','Chiapas'],
  ['CHH','CHH','Chihuahua'],
  ['CDMX','CDMX','Ciudad de México'],
  ['DUR','DUR','Durango'],
  ['EMEX','E.MEX','Estado de México'],
  ['GUA','GUA','Guanajuato'],
  ['GRO','GRO','Guerrero'],
  ['HID','HID','Hidalgo'],
  ['JAL','JAL','Jalisco'],
  ['MIC','MIC','Michoacán'],
  ['MOR','MOR','Morelos'],
  ['NAY','NAY','Nayarit'],
  ['NLE','NLE','Nuevo León'],
  ['OAX','OAX','Oaxaca'],
  ['PUE','PUE','Puebla'],
  ['QUE','QUE','Querétaro'],
  ['ROO','ROO','Quintana Roo'],
  ['SLP','SLP','San Luis Potosí'],
  ['SIN','SIN','Sinaloa'],
  ['SON','SON','Sonora'],
  ['TAB','TAB','Tabasco'],
  ['TAM','TAM','Tamaulipas'],
  ['TLA','TLA','Tlaxcala'],
  ['VER','VER','Veracruz'],
  ['YUC','YUC','Yucatán'],
  ['ZAC','ZAC','Zacatecas']
];

// Devuelve la abreviatura visible para un código de estado.
// Compatible con datos antiguos (donde el valor guardado YA era la abreviatura).
function _abrevEstadoPlaca(valor){
  if(!valor) return '';
  for(var i=0;i<_ESTADOS_PLACA.length;i++){ if(_ESTADOS_PLACA[i][0]===valor) return _ESTADOS_PLACA[i][1]; }
  return valor;
}

// Nombre completo del estado (para mostrar en pantalla, donde ya hay espacio de sobra
// desde que Placas+Estado se unificaron en una sola casilla). El PDF sigue usando la
// abreviatura (_abrevEstadoPlaca) porque ahí sí es un espacio reducido.
function _nombreCompletoEstadoPlaca(valor){
  if(!valor) return '';
  for(var i=0;i<_ESTADOS_PLACA.length;i++){ if(_ESTADOS_PLACA[i][0]===valor) return _ESTADOS_PLACA[i][2]; }
  return valor;
}

// Sincroniza el botón visible con el valor del input oculto.
// Llamar tras restaurar un recibo o limpiar el formulario.
function _sincronizarDisplayEstadoPlaca(){
  var inp = document.getElementById('placa-estado');
  var btn = document.getElementById('placa-estado-display');
  if(!inp || !btn) return;
  var v = inp.value || '';
  var caret = ' <span style="font-size:0.7rem;color:var(--muted);">▾</span>';
  if(!v){
    btn.innerHTML = 'Estado' + caret;
    btn.style.color = 'var(--ink)';
  } else {
    btn.innerHTML = escapeHtml(_nombreCompletoEstadoPlaca(v)) + caret;
    btn.style.color = 'var(--ink)';
  }
}

function _escEstadoPlacaKey(ev){ if(ev.key === 'Escape') cerrarSelectorEstadoPlaca(); }

function cerrarSelectorEstadoPlaca(){
  document.removeEventListener('keydown', _escEstadoPlacaKey);
  var ov = document.getElementById('overlay-estado-placa');
  if(ov && ov.parentNode) ov.parentNode.removeChild(ov);
}

function _elegirEstadoPlaca(valor){
  var inp = document.getElementById('placa-estado');
  if(inp) inp.value = valor || '';
  _sincronizarDisplayEstadoPlaca();
  cerrarSelectorEstadoPlaca();
}

function abrirSelectorEstadoPlaca(){
  // No permitir editar el estado de las placas cuando el recibo está congelado
  // o en consulta: pago parcial, liquidación total, cancelación y consulta de folio.
  // El estado queda fijo en la opción del recibo principal.
  var _bcl = document.body.classList;
  if(_bcl.contains('recibo-frozen') || _bcl.contains('modo-actualizacion') ||
     _bcl.contains('desde-liquidacion') || _bcl.contains('modo-consulta') ||
     _bcl.contains('folio-cancelado') || _bcl.contains('folio-liquidado')) return;
  if(document.getElementById('overlay-estado-placa')) return; // evitar duplicados
  var inp = document.getElementById('placa-estado');
  var actual = inp ? (inp.value || '') : '';

  var ov = document.createElement('div');
  ov.id = 'overlay-estado-placa';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(26,16,8,0.45);display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.addEventListener('click', function(e){ if(e.target === ov) cerrarSelectorEstadoPlaca(); });

  var panel = document.createElement('div');
  panel.style.cssText = "background:#fffdf6;border:1.5px solid #d4b870;border-radius:14px;box-shadow:0 18px 50px rgba(26,16,8,0.4);width:360px;max-width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;font-family:'DM Sans',sans-serif;";

  var head = document.createElement('div');
  head.style.cssText = "padding:13px 18px;background:#1a1008;color:#f0e6d2;font-family:'DM Mono',monospace;font-size:0.78rem;letter-spacing:0.08em;text-transform:uppercase;display:flex;align-items:center;justify-content:space-between;";
  head.innerHTML = '<span>🪪 Estado de las placas</span>';
  var xb = document.createElement('span');
  xb.textContent = '✕';
  xb.style.cssText = 'cursor:pointer;opacity:0.85;font-size:0.9rem;';
  xb.onclick = cerrarSelectorEstadoPlaca;
  head.appendChild(xb);

  var lista = document.createElement('div');
  lista.style.cssText = 'overflow-y:auto;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;';

  _ESTADOS_PLACA.forEach(function(e){
    var it = document.createElement('button');
    it.type = 'button';
    var sel = (e[0] === actual);
    var esSinEsp = (e[0] === 'SIN_ESP');
    it.style.cssText = "text-align:left;border:1.5px solid " + (sel ? '#c8952a' : '#e6d8b8') +
      ";background:" + (sel ? '#fbf0d8' : (esSinEsp ? '#f3ece0' : '#fffdf6')) +
      ";border-radius:8px;padding:9px 11px;cursor:pointer;font-family:'DM Sans',sans-serif;color:#3a2a14;display:flex;flex-direction:column;gap:2px;transition:border-color 0.15s;" +
      (esSinEsp ? 'grid-column:1 / -1;' : '');
    it.innerHTML = '<span style="font-weight:600;font-size:0.8rem;">' + escapeHtml(e[2]) + '</span>' +
      '<span style="font-family:\'DM Mono\',monospace;font-size:0.6rem;color:#a9925f;letter-spacing:0.05em;">' + escapeHtml(e[1]) + '</span>';
    it.onmouseenter = function(){ if(!sel) it.style.borderColor = '#d4b870'; };
    it.onmouseleave = function(){ if(!sel) it.style.borderColor = '#e6d8b8'; };
    it.onclick = function(){ _elegirEstadoPlaca(e[0]); };
    lista.appendChild(it);
  });

  panel.appendChild(head);
  panel.appendChild(lista);
  ov.appendChild(panel);
  document.body.appendChild(ov);
  document.addEventListener('keydown', _escEstadoPlacaKey);
}

// ════════════════════════════════════════════════════════════════════
// GUÍA VISUAL DE CLASES DE VEHÍCULO — ayuda para que el personal
// distinga bien entre clases parecidas (ej. SUV/Camioneta vs. Van vs. Pickup).
// Solo informativo, no selecciona nada por sí sola.
// ════════════════════════════════════════════════════════════════════
var _GUIA_CLASES_VEH_IMG = "data:image/jpeg;base64,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";
var _guiaZoomScale = 1;
var _guiaMinScale = 1;
var _guiaPanX = 0, _guiaPanY = 0;
var _guiaArrastrando = false, _guiaStartX = 0, _guiaStartY = 0, _guiaPanStartX = 0, _guiaPanStartY = 0;
var _guiaViewportEl = null, _guiaImgWrapEl = null, _guiaPanLayerEl = null;
function _escGuiaClasesKey(ev){ if(ev.key === 'Escape') cerrarGuiaClasesVehiculo(); }
function _guiaAplicarPan(){
  if(_guiaPanLayerEl) _guiaPanLayerEl.style.transform = 'translate(' + _guiaPanX + 'px,' + _guiaPanY + 'px)';
}
function _guiaAplicarZoom(){
  if(_guiaImgWrapEl) _guiaImgWrapEl.style.transform = 'scale(' + _guiaZoomScale + ')';
}
function _guiaMouseDown(e){
  if(!_guiaViewportEl) return;
  e.preventDefault();
  _guiaArrastrando = true;
  _guiaStartX = e.clientX; _guiaStartY = e.clientY;
  _guiaPanStartX = _guiaPanX; _guiaPanStartY = _guiaPanY;
  _guiaViewportEl.style.cursor = 'grabbing';
}
function _guiaMouseMove(e){
  if(!_guiaArrastrando) return;
  _guiaPanX = _guiaPanStartX + (e.clientX - _guiaStartX);
  _guiaPanY = _guiaPanStartY + (e.clientY - _guiaStartY);
  _guiaAplicarPan();
}
function _guiaMouseUp(){
  if(_guiaArrastrando){ _guiaArrastrando = false; if(_guiaViewportEl) _guiaViewportEl.style.cursor = 'grab'; }
}
function _guiaWheel(e){
  e.preventDefault();
  var delta = e.deltaY < 0 ? 0.15 : -0.15;
  _guiaZoomScale = Math.min(4, Math.max(_guiaMinScale, _guiaZoomScale + delta));
  _guiaAplicarZoom();
}
function _guiaCalcularMinScale(){
  if(!_guiaViewportEl || !_guiaImgWrapEl) return;
  var img = _guiaImgWrapEl.querySelector('img');
  if(!img || !img.naturalWidth) return;
  var vpW = _guiaViewportEl.clientWidth - 32;
  var vpH = _guiaViewportEl.clientHeight - 32;
  // ancho renderizado actual (con max-width:100% ya aplicado, sin el transform de zoom)
  var renderW = img.clientWidth || vpW;
  var renderH = img.clientHeight || (renderW * (img.naturalHeight / img.naturalWidth));
  if(renderW <= 0 || renderH <= 0) return;
  var minScale = Math.min(1, vpW / renderW, vpH / renderH);
  if(!isFinite(minScale) || minScale <= 0) minScale = 1;
  _guiaMinScale = minScale;
  if(_guiaZoomScale < _guiaMinScale){
    _guiaZoomScale = _guiaMinScale;
    _guiaAplicarZoom();
  }
}
function cerrarGuiaClasesVehiculo(){
  document.removeEventListener('keydown', _escGuiaClasesKey);
  window.removeEventListener('mousemove', _guiaMouseMove);
  window.removeEventListener('mouseup', _guiaMouseUp);
  var ov = document.getElementById('overlay-guia-clases');
  if(ov && ov.parentNode) ov.parentNode.removeChild(ov);
  _guiaViewportEl = null; _guiaImgWrapEl = null; _guiaPanLayerEl = null;
  _guiaArrastrando = false; _guiaZoomScale = 1; _guiaMinScale = 1; _guiaPanX = 0; _guiaPanY = 0;
}
function abrirGuiaClasesVehiculo(){
  if(document.getElementById('overlay-guia-clases')) return; // evitar duplicados
  _guiaZoomScale = 1; _guiaMinScale = 1; _guiaPanX = 0; _guiaPanY = 0; _guiaArrastrando = false;

  var ov = document.createElement('div');
  ov.id = 'overlay-guia-clases';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(26,16,8,0.55);display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.addEventListener('click', function(e){ if(e.target === ov) cerrarGuiaClasesVehiculo(); });

  var panel = document.createElement('div');
  panel.style.cssText = "position:relative;background:#fffdf6;border:1.5px solid #d4b870;border-radius:14px;box-shadow:0 18px 50px rgba(26,16,8,0.4);width:min(94vw,640px);height:min(90vh,900px);overflow:hidden;padding:0;display:flex;flex-direction:column;";

  var xb = document.createElement('button');
  xb.type = 'button';
  xb.textContent = '\u2715';
  xb.title = 'Cerrar';
  xb.style.cssText = 'position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:50%;border:none;background:#1a1008;color:#f0e6d2;font-size:0.95rem;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);z-index:3;';
  xb.onclick = cerrarGuiaClasesVehiculo;

  var toolbar = document.createElement('div');
  toolbar.style.cssText = 'position:absolute;top:10px;left:10px;display:flex;gap:6px;z-index:3;';
  function _mkZoomBtn(txt, titulo){
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    b.title = titulo;
    b.style.cssText = 'width:32px;height:32px;border-radius:50%;border:none;background:#1a1008;color:#f0e6d2;font-size:1rem;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);line-height:1;';
    return b;
  }
  var zoomInBtn = _mkZoomBtn('+', 'Acercar');
  var zoomOutBtn = _mkZoomBtn('\u2212', 'Alejar');
  var zoomResetBtn = _mkZoomBtn('\u27F2', 'Restablecer zoom');
  zoomResetBtn.style.fontSize = '0.85rem';
  toolbar.appendChild(zoomInBtn);
  toolbar.appendChild(zoomOutBtn);
  toolbar.appendChild(zoomResetBtn);

  var viewport = document.createElement('div');
  viewport.style.cssText = 'flex:1;overflow:hidden;position:relative;cursor:grab;background:#fffdf6;';

  var panLayer = document.createElement('div');
  panLayer.style.cssText = 'width:100%;height:100%;display:flex;align-items:flex-start;justify-content:center;will-change:transform;';

  var imgWrap = document.createElement('div');
  imgWrap.style.cssText = 'display:flex;justify-content:center;padding:16px;transform-origin:center center;transition:transform 0.08s ease-out;';

  var img = document.createElement('img');
  img.src = _GUIA_CLASES_VEH_IMG;
  img.alt = 'Guia de clases de vehiculo';
  img.draggable = false;
  img.style.cssText = 'display:block;max-width:100%;height:auto;border-radius:10px;pointer-events:none;user-select:none;';

  imgWrap.appendChild(img);
  panLayer.appendChild(imgWrap);
  viewport.appendChild(panLayer);
  _guiaViewportEl = viewport;
  _guiaImgWrapEl = imgWrap;
  _guiaPanLayerEl = panLayer;

  function _guiaInicializarLimite(){
    _guiaCalcularMinScale();
  }
  if(img.complete && img.naturalWidth){
    requestAnimationFrame(_guiaInicializarLimite);
  } else {
    img.addEventListener('load', function(){ requestAnimationFrame(_guiaInicializarLimite); });
  }

  viewport.addEventListener('wheel', _guiaWheel, { passive: false });
  viewport.addEventListener('mousedown', _guiaMouseDown);
  window.addEventListener('mousemove', _guiaMouseMove);
  window.addEventListener('mouseup', _guiaMouseUp);

  zoomInBtn.onclick = function(){ _guiaZoomScale = Math.min(4, _guiaZoomScale + 0.25); _guiaAplicarZoom(); };
  zoomOutBtn.onclick = function(){ _guiaZoomScale = Math.max(_guiaMinScale, _guiaZoomScale - 0.25); _guiaAplicarZoom(); };
  zoomResetBtn.onclick = function(){ _guiaZoomScale = 1; _guiaPanX = 0; _guiaPanY = 0; _guiaAplicarZoom(); _guiaAplicarPan(); };

  var hint = document.createElement('div');
  hint.textContent = 'Rueda del mouse para acercar/alejar \u00B7 Arrastra con clic izquierdo para mover \u00B7 Esc o \u2715 para cerrar';
  hint.style.cssText = 'position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:0.68rem;color:#8a7550;pointer-events:none;z-index:3;';

  panel.appendChild(xb);
  panel.appendChild(toolbar);
  panel.appendChild(viewport);
  panel.appendChild(hint);
  ov.appendChild(panel);
  document.body.appendChild(ov);
  document.addEventListener('keydown', _escGuiaClasesKey);
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
  // Validar excedente SOLO cuando el usuario edita el campo anticipo
  if(input.id === 'anticipo') validarAnticipo();
}
// calcTotales: actualiza cuadro dorado — llamada por sistema Y por usuario
// NO contiene validación del modal (eso es responsabilidad de validarAnticipo)
function calcTotales(){
  let total=0;
  document.querySelectorAll('.precio').forEach(p=>{ total+=parsePrecio(p.value); });
  const antipoInput = $('anticipo');
  const anticipo    = parsePrecio(antipoInput.value);
  // Solo actualizar cuadro dorado en modo recibo normal
  // En modo actualizacion lo gestiona recalcularResumenActualizacion()
  const _enModoAct = (typeof reciboEnActualizacion !== 'undefined' && reciboEnActualizacion);
  if(!_enModoAct){
    document.getElementById('total-display').textContent='$'+fmtMXN(total);
    document.getElementById('resta-display').textContent='$'+fmtMXN(total-anticipo);
  }
}

// validarAnticipo: valida el monto y muestra/oculta el modal de excedente
// SOLO se llama desde formatPrecio, que solo se activa por oninput del usuario
// Nunca se llama cuando el sistema asigna .value directamente
function validarAnticipo(){
  const antipoInput = $('anticipo');
  const anticipo    = parsePrecio(antipoInput.value);
  // No validar si el campo está vacío
  if(!antipoInput.value || anticipo <= 0){
    antipoInput.style.borderColor = '';
    antipoInput.style.boxShadow   = '';
    return;
  }
  // Calcular el límite correcto según contexto
  let total = 0;
  document.querySelectorAll('.precio').forEach(p=>{ total+=parsePrecio(p.value); });
  let limite = total;
  const _enModoAct = (typeof reciboEnActualizacion !== 'undefined' && reciboEnActualizacion);
  if(_enModoAct){
    // En modo actualización: límite = saldo pendiente + costos extra nuevos
    const saldoBase = parseFloat(reciboEnActualizacion.saldoPendiente) || 0;
    const sumaCE    = (typeof getCostosExtra === 'function')
      ? getCostosExtra().filter(c => c.locked !== true).reduce((s,c)=>s+(parseFloat(c.precio)||0), 0)
      : 0;
    limite = saldoBase + sumaCE;
    if(!limite) limite = total;
  }
  // Mostrar modal solo si hay excedente real (tolerancia 0.01 para decimales)
  if(limite > 0 && anticipo > limite + 0.01){
    const tipo     = _enModoAct ? 'saldo pendiente' : 'total';
    const excedente = anticipo - limite;
    document.getElementById('modal-anticipo-warn-msg').innerHTML =
      'El anticipo ingresado <strong>supera el ' + tipo + '</strong> del recibo. '
      +'Por favor verifica y corrige el monto antes de continuar.';
    document.getElementById('modal-anticipo-warn-detalle').innerHTML =
      '📥 Anticipo ingresado: <strong>$' + fmtMXN(anticipo) + '</strong><br>'
      +'📋 ' + (tipo === 'saldo pendiente' ? 'Saldo pendiente' : 'Total del recibo')
      +': <strong>$' + fmtMXN(limite) + '</strong><br>'
      +'⚠️ Excedente: <strong style="color:#c0161a;">$' + fmtMXN(excedente) + '</strong>';
    document.getElementById('modal-anticipo-warn').classList.add('show');
    antipoInput.style.borderColor = '#c0161a';
    antipoInput.style.boxShadow   = '0 0 0 2px rgba(192,22,26,0.18)';
  } else {
    document.getElementById('modal-anticipo-warn').classList.remove('show');
    antipoInput.style.borderColor = '';
    antipoInput.style.boxShadow   = '';
  }
}
// ── QR ───────────────────────────────────────────────────────────
// Quita acentos/diacríticos (á,é,í,ó,ú,ñ,Ñ…) SOLO para el texto que se
// codifica dentro del QR — el nombre visible impreso en el recibo NUNCA se
// toca, solo esta copia interna. Causa raíz confirmada y reproducida: la
// función interna de la librería qrcode.min.js que calcula cuántos bytes
// necesita el texto (para elegir el tamaño del QR) cuenta cada carácter
// acentuado como 1 byte, cuando en UTF-8 real ocupa 2 — al codificar de
// verdad, el texto real resulta más pesado de lo calculado y revienta con
// "code length overflow" (caso real: folio 56C, nombre con acentos).
// Quitar el acento evita el conteo erróneo de raíz, sin acortar ni recortar
// ningún dato (fecha, hora, nombre completo) — solo cambia "Á"→"A" etc.
// dentro del QR. NOTA: pasar typeNumber en las opciones de QRCode NO sirve
// como mitigación — se probó y confirmó que esta versión de la librería lo
// ignora siempre y recalcula su propio tamaño internamente.
function _quitarAcentosQR(str){
  return String(str||'').normalize('NFD').replace(/[̀-ͯ]/g,'');
}
function generarQRPreview(){
  const div=document.getElementById('qr-preview'); div.innerHTML='';
  const folio=folioFormato(appData.folioActual);
  const nombre=document.querySelector('[id^="nombre_"]')?.value||'Cliente';
  const fecha=$('fecha_recibo')?.value||'';
  const hora =$('hora_recibo')?.value||'';
  // QR sin total para mantener privacidad del monto y consistencia con el PDF
  new QRCode(div,{text:_quitarAcentosQR('LEX-MEXICO|Folio:'+folio+'|'+nombre+'|'+fecha+' '+hora),
    width:90,height:90,colorDark:'#1a1008',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
}
function qrToDataURL(texto){
  return new Promise(resolve=>{
    const div=document.createElement('div');
    div.style.position='absolute'; div.style.left='-9999px'; document.body.appendChild(div);
    new QRCode(div,{text:_quitarAcentosQR(texto),width:130,height:130,colorDark:'#1a1008',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    setTimeout(()=>{
      const img=div.querySelector('img')||div.querySelector('canvas');
      const url=img?(img.src||img.toDataURL()):'';
      document.body.removeChild(div); resolve(url);
    },350);
  });
}
// ── CLIENTES DINÁMICOS ───────────────────────────────────────────
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
      +'<div class="field-group"><label>Móvil</label>'
        +'<input type="text" id="movil_'+id+'" placeholder="000-000-0000" oninput="formatTelefono(this)" maxlength="12"></div>'
      +'<div class="field-group"><label>Tel. Casa</label>'
        +'<input type="text" id="tel_'+id+'" placeholder="000-000-0000" oninput="formatTelefono(this)" maxlength="12"></div>'
      +(clienteCount>1?'<button class="remove-btn" onclick="quitarCliente(\''+id+'\')">✕</button>':'<div></div>')
    +'</div>'
    +'<div class="cliente-fila-bot">'
      +'<div class="field-group"><label>Domicilio</label>'
        +'<input type="text" id="domicilio_'+id+'" placeholder="Calle, número, colonia, municipio..."></div>'
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
// ── LIMPIAR ──────────────────────────────────────────────────────
function limpiarForm(){
  $('clientes-wrapper').innerHTML=''; clienteCount=0; agregarCliente();
  $('conceptos-tbody').innerHTML=''; conceptoCount=0; agregarConcepto();
  ['tramites','clase','marca','tipo_veh','serie','motor','anio','puertas','color_veh',
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
  setStatus('ok','Formulario limpio — mismo Folio #'+folioFormato(appData.folioActual),'ok');
}
// Limpieza TOTAL del formulario — idéntico al estado de primer arranque (modo nativo virgen).
// Se usa al presionar "Siguiente Folio" o "Nuevo Folio" para que no quede
// ningún dato del recibo anterior. Cada paso está envuelto en try/catch para
// que un fallo aislado no impida la limpieza del resto.
function limpiarFormCompleto(){
  // Helper: ejecutar un paso aislado sin que un error rompa la cadena
  const paso = (nombre, fn) => { try { fn(); } catch(e){ console.warn('[limpiarFormCompleto:'+nombre+']', e); } };
  // Resetear letra actual a A (nuevo recibo siempre es A)
  window._letraReciboActual = 'A';
  if (typeof _actualizarVisibilidadPoder === 'function') _actualizarVisibilidadPoder('', 'A');
  if (typeof _actualizarSeccionModoCosto === 'function') _actualizarSeccionModoCosto('', 'A');
  var _mcInp = document.getElementById('modo-costo-pactado'); if(_mcInp) _mcInp.value = '';
  var _btnP = document.getElementById('btn-costo-pactado'); if(_btnP){ _btnP.style.borderColor=''; _btnP.style.background=''; _btnP.style.color=''; }
  var _btnA = document.getElementById('btn-sin-costo-pactado'); if(_btnA){ _btnA.style.borderColor=''; _btnA.style.background=''; _btnA.style.color=''; }
  // Desvincular pre-recibo de origen: si el formulario se limpia (nuevo recibo,
  // navegación, etc.) el vínculo deja de aplicar — un recibo posterior ajeno
  // NO debe marcar como convertido el pre-recibo abandonado.
  paso('pre-recibo-link', ()=>{ window._prDatosParaRecibo = null; });
  // 0. Quitar TODAS las clases de modo (actualización, congelado, consulta, etc.)
  paso('clases-body', ()=>{
    ['modo-actualizacion','recibo-frozen','desde-liquidacion','actualizacion-impresa',
     'modo-consulta','folio-liquidado','folio-cancelado','modo-edicion-completa',
     'modo-restauracion',
     'paneles-busqueda-abiertos','paneles-abiertos-consulta','en-accion-pago'].forEach(c=>document.body.classList.remove(c));
    var _antReset = document.getElementById('anticipo'); if(_antReset) _antReset.readOnly = false;
    _panelesBusquedaAbiertos = false;
    _reciboEnEdicionCompleta = null;
    window._edicionCompletaActiva = false; // liberar guard al limpiar form
    // Resetear estilos inline de paneles para que togglePanelesBusqueda pueda reabrirlos
    // (pbc-body/pfc-body pueden tener display:none !important de _cerrarPanelesBusqueda)
    const _pbcRst = document.getElementById('pbc-body');
    const _pfcRst = document.getElementById('pfc-body');
    const _panRst = document.getElementById('paneles-busqueda-cuerpo');
    if(_pbcRst) _pbcRst.removeAttribute('style');
    if(_pfcRst) _pfcRst.removeAttribute('style');
    if(_panRst) _panRst.setAttribute('style','display:none; padding:0 20px 14px;');
    if(typeof syncFormVisibility==='function') syncFormVisibility();
  });
  // 0.a1 Cerrar la Ficha del Folio si estaba abierta — de lo contrario se queda
  // flotando sobre el formulario de nuevo recibo aunque ya no se esté consultando nada.
  paso('cerrar-ficha', ()=>{
    if(typeof cerrarFichaFolio==='function') cerrarFichaFolio();
  });
  // 0.b Restaurar panel de acciones al estado inicial
  paso('paneles-acciones', ()=>{
    const aNormal = document.getElementById('actions-normal');
    const aPost   = document.getElementById('actions-post-print');
    const aAct    = document.getElementById('actions-actualizacion');
    const aCons   = document.getElementById('actions-consulta');
    const aRest   = document.getElementById('actions-restauracion');
    const banner  = document.getElementById('frozen-banner');
    const bannerRest = document.getElementById('restauracion-banner');
    const btnGuardar = document.getElementById('btn-guardar');
    if(aNormal) aNormal.style.display = 'flex';
    if(aPost)   aPost.style.display   = 'none';
    if(aAct)    aAct.style.removeProperty('display'); aAct && (aAct.style.display = 'none');
    if(aCons)   aCons.style.display   = 'none';
    if(aRest)   aRest.style.display   = 'none';
    if(banner)  banner.style.display  = 'none';
    if(bannerRest) bannerRest.style.display = 'none';
    if(btnGuardar) btnGuardar.disabled = false;
    // Forzar ocultar actions-actualizacion con atributo inline (gana al CSS !important)
    const _aActForce = document.getElementById('actions-actualizacion');
    if(_aActForce) _aActForce.setAttribute('style','display:none !important;');
    // ── Banner y botones de "MODO EDICIÓN COMPLETA" ──────────────────────
    // editarReciboEnConsulta()/adminAbrirEdicionCompleta() fijan su display
    // directo en el estilo inline (banner.style.display='flex'). La regla CSS
    // que los muestra depende de la clase body.modo-edicion-completa con
    // !important, así que MIENTRAS la clase está presente esa regla gana; pero
    // en cuanto se quita la clase (como hace cancelarEdicionCompleta), deja de
    // aplicar y el navegador vuelve a usar el inline "flex" que quedó puesto
    // — el banner se queda pegado en pantalla aunque el formulario ya se
    // limpió. Hay que resetear el inline explícitamente, igual que ya se hace
    // en el flujo de "modo-restauracion" (más abajo en el archivo).
    const _edcBanner  = document.getElementById('edicion-completa-banner');
    const _edcActions = document.getElementById('actions-edicion-completa');
    if(_edcBanner)  _edcBanner.style.display  = 'none';
    if(_edcActions) _edcActions.style.display = 'none';
  });
  // 1. Limpiar clientes y conceptos dinámicos (1 fila vacía cada uno)
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
  // 2. Limpiar todos los campos de texto / select del bloque vehicular y trámites
  paso('campos-texto', ()=>{
    ['tramites','clase','marca','tipo_veh','serie','motor','anio','puertas','color_veh',
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
  // 6. Limpiar checkboxes de documentos Y CERRAR todas las categorías (modo nativo virgen)
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
      if(arrow) arrow.textContent = '\u25b8'; // ▸ flecha cerrada
    });
  });
  // 7. Restablecer tipo doc y tipo trámite al estado inicial
  paso('tipo-doc-tramite', ()=>{
    if(typeof setTipoDoc==='function') setTipoDoc('copia');
    if(typeof setTipoTramite==='function') setTipoTramite('normal');
  });
  // 8. Cerrar sección vehiculo (volver a flecha plegada ▸)
  paso('cerrar-vehiculo', ()=>{
    // setTipoTramite('normal') ya oculta seccion-vehiculo, pero reforzamos:
    const secVeh = document.getElementById('seccion-vehiculo');
    if(secVeh) secVeh.style.display = 'none';
    const vBody = document.getElementById('vehicle-grid-body');
    const vArrow = document.querySelector('.section-label-toggle .veh-arrow');
    if(vBody)  vBody.style.display = 'none';
    if(vArrow) vArrow.textContent = '\u25b8'; // ▸ cerrada
  });
  // 9. Limpiar cuadro rojo de placas
  paso('placas', ()=>{ if(typeof mostrarPlacasEnPantalla==='function') mostrarPlacasEnPantalla(null, null); });
  // 10. Limpiar costos extra / pagos parciales del modo actualización
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
    // Ocultar y vaciar la sección "Saldo Restante" (ADEUDO ANTERIOR de Costo
    // Pactado) — si no se limpia aquí, la fila con el saldo del recibo
    // editado se queda visible al cancelar/limpiar el formulario.
    const secSR = document.getElementById('seccion-saldo-restante-cp');
    if(secSR) secSR.style.display='none';
    const _cptoSR = document.getElementById('sr-cp-concepto');
    const _descSR = document.getElementById('sr-cp-descripcion');
    if(_cptoSR){ _cptoSR.value=''; delete _cptoSR.dataset.manualEdit; }
    if(_descSR){ _descSR.value=''; delete _descSR.dataset.manualEdit; }
  });
  // 11. Resetear variables internas de modo actualización, consulta, abono y retroactivo
  paso('vars-internas', ()=>{
    if(typeof reciboEnActualizacion !== 'undefined') reciboEnActualizacion = null;
    if(typeof reciboEnConsulta      !== 'undefined') reciboEnConsulta      = null;
    window._autorizacionActual               = null;
    window._autorizacionCancelacion          = null;
    // Modo abono: limpiar referencia para evitar que el siguiente recibo quede como abono
    window._folioReferencia                  = null;
    window._letraAbonoRetroactivo            = null;
    window._respSeleccionado                 = null;
    // Modo retroactivo
    window._reciboRetroactivoActivo          = false;
    window._reciboRetroactivoFechaPersonalizada = null;
    window._reciboRetroactivoHoraPersonalizada  = null;
    if(typeof lastActualizacionBlob   !== 'undefined') lastActualizacionBlob   = null;
    if(typeof lastActualizacionNombre !== 'undefined') lastActualizacionNombre = null;
    if(typeof lastPdfBlob !== 'undefined') lastPdfBlob = null;
  });
  // 11b. Resetear visualmente el botón RETRO y estilos de fecha/hora
  paso('reset-retro-visual', ()=>{
    var _btnRetro = document.getElementById('btn-toggle-retro');
    if(_btnRetro){
      _btnRetro.style.background  = 'none';
      _btnRetro.style.color       = 'var(--muted)';
      _btnRetro.style.borderColor = 'rgba(200,149,42,0.3)';
      _btnRetro.textContent       = '⏰ RETRO';
    }
    var _fDisp = document.getElementById('fecha_recibo_display');
    if(_fDisp){ _fDisp.style.borderBottom=''; _fDisp.style.color=''; _fDisp.style.fontWeight=''; }
    var _hDisp = document.getElementById('hora_recibo_display');
    if(_hDisp){ _hDisp.style.color=''; _hDisp.style.fontWeight=''; }
  });
  // 12. Reiniciar fecha/hora con la hora CDMX actual (vía referencia global)
  paso('fecha-hora', ()=>{
    if(typeof window._aplicarFechaLocal === 'function'){
      window._aplicarFechaLocal(new Date());
    }
  });
  // 13. Resetear cuadro marrón Total/Anticipo/Resta a $0.00
  //     (DEBE hacerse DESPUÉS de limpiar conceptos para que calcTotales no lo sobreescriba con basura)
  paso('totales-display', ()=>{
    const totalDisp = document.getElementById('total-display');
    const restaDisp = document.getElementById('resta-display');
    const antInput  = $('anticipo');
    if(totalDisp) totalDisp.textContent = '$0.00';
    if(restaDisp) restaDisp.textContent = '$0.00';
    if(antInput)  antInput.value = '';
    // Restaurar etiqueta 'Total Restante' → 'Total' al salir del modo pago total
    const _lblReset = totalDisp ? totalDisp.previousElementSibling : null;
    if(_lblReset && _lblReset.tagName === 'LABEL') _lblReset.textContent = 'Total';
  });
  // 14. Resetear botones de actualización a su estado original (texto + onclick)
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
  // 15. Recalcular totales (con la fila vacía ya creada → da $0.00), QR y folio display
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
// ── Helper: convierte img a dataURL y devuelve proporciones reales ──
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
// ── Helper: dibuja el encabezado en el PDF ───────────────────────
function dibujarEncabezadoPDF(doc, margin, cW, folio, logoObj, letra, anioFolio){
  const GOLD  = [154,110,24];
  const GBORD = [200,160,60];
  const DARK  = [60, 45, 20];
  const MUTED = [122,104,64];
  const RED   = [192, 22, 26];
  const PAD   = 3;
  const hH    = 28;
  const hTop  = 6;
  const hBot  = hTop + hH;
  // ── COLUMNAS ──
  const logoColW   = 28;
  const folioColW  = 34;
  const centerColW = cW - logoColW - folioColW;
  const centerColX = margin + logoColW;
  const centerMidX = centerColX + centerColW / 2;
  const folioX     = margin + logoColW + centerColW;
  const folioMidX  = folioX + folioColW / 2;
  // ── RECT EXTERIOR ──
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.7);
  doc.rect(margin, hTop, cW, hH);
  // ── LOGO — proporcional usando dimensiones reales de la imagen ──
  const logoDataURL = logoObj && logoObj.url ? logoObj.url : (typeof logoObj === 'string' ? logoObj : '');
  const imgW = logoObj && logoObj.w ? logoObj.w : 1;
  const imgH = logoObj && logoObj.h ? logoObj.h : 1;
  const ratio = imgW / imgH;   // relación ancho/alto real de la imagen
  if(logoDataURL){
    try{
      // Espacio disponible dentro de la columna con padding
      const maxW = logoColW - 6;    // margen lateral
      const maxH = hH - PAD * 2;   // margen vertical
      // Calcular tamaño que quepa respetando la proporción
      let lW = maxW;
      let lH = lW / ratio;
      if(lH > maxH){ lH = maxH; lW = lH * ratio; }
      // Centrar horizontal y verticalmente en la columna
      const lX = margin + (logoColW - lW) / 2;
      const lY = hTop + (hH - lH) / 2;
      doc.addImage(logoDataURL, 'JPEG', lX, lY, lW, lH);
    }catch(e){ console.warn('Logo error:', e); }
  }
  // ── SEPARADOR VERTICAL izquierdo de columna folio ──
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.3);
  doc.line(folioX, hTop + 1, folioX, hBot - 1);
  // ── FOLIO: "NO. RECIBO" FUERA del rect, arriba — más grande ──
  // Distribuimos verticalmente: centrar el bloque folio en hH
  // Bloque = labelH(2.5) + gap(1.5) + rectH(12) + gap(1.5) + labelH(2.5) = 20mm
  const fBlkH  = 20;
  const fBlkY  = hTop + (hH - fBlkH) / 2;   // Y inicio del bloque folio
  // "NO. RECIBO" — fuera del rect del número, letra grande bold
  doc.setFontSize(7); doc.setFont('courier','bold'); doc.setTextColor(...GOLD);
  doc.text('NO. RECIBO', folioMidX, fBlkY + 2.5, {align:'center', charSpace:0.6});
  // Rectángulo del número — solo cubre el dígito, fondo crema suave
  const rY = fBlkY + 4.5;
  const rH = 9;
  const rX = folioX + 2;
  const rW = folioColW - 4;
  doc.setFillColor(250, 246, 236);
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.6);
  doc.rect(rX, rY, rW, rH, 'FD');
  // Número dentro del rect — Courier bold, rojo — formato AÑO-NÚMERO (ej. 26-001)
  const folioTexto = folioConLetra(folio, anioFolio || null, letra || 'A'); // ej. 26-001A
  // Font adaptable: 7 caracteres (26-001A) — ajuste por letra extra
  const folioFontSize = folioTexto.length <= 6 ? 14 : folioTexto.length <= 7 ? 12 : 10;
  doc.setFontSize(folioFontSize); doc.setFont('courier','bold'); doc.setTextColor(...RED);
  doc.text(folioTexto, folioMidX, rY + 6.2, {align:'center', charSpace:0.5});
  // "FOLIO OFICIAL" — fuera del rect, abajo, más grande y bold
  doc.setFontSize(7); doc.setFont('courier','bold'); doc.setTextColor(...MUTED);
  doc.text('FOLIO OFICIAL', folioMidX, rY + rH + 4, {align:'center', charSpace:0.5});
  // ── COLUMNA CENTRAL — distribuida en el espacio interior del rect ──
  // Bloque: título(4mm) + dir1(4mm) + dir2(3.5mm) + sep(2mm) + tel-label(3mm) + tel(4mm) = 20.5mm
  // Partimos desde hTop+2 (2mm de padding superior dentro del rect)
  const cPadTop = hTop + 2.5;
  // Título
  doc.setFontSize(12.5); doc.setFont('times','bold'); doc.setTextColor(...GOLD);
  doc.text('LEX-MÉXICO · DESPACHO JURÍDICO', centerMidX, cPadTop + 3.5, {align:'center'});
  // Dirección
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...DARK);
  doc.text('CALLE MIGUEL HIDALGO ESQ. MÉXICO NO. 200, LOCAL B, COL. CENTRO', centerMidX, cPadTop + 7.5, {align:'center'});
  doc.text('SANTIAGO JUXTLAHUACA, OAXACA', centerMidX, cPadTop + 11, {align:'center'});
  // Separador fino dorado
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.2);
  doc.line(centerColX + 4, cPadTop + 13, centerColX + centerColW - 4, cPadTop + 13);
  // "TELÉFONO DE OFICINA — Informes y citas" en una sola línea, más grandes
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...GOLD);
  doc.text('TEL. OFICINA · INFORMES Y CITAS:', centerMidX, cPadTop + 16.5, {align:'center'});
  // Número de teléfono — grande y destacado
  doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...GOLD);
  doc.text('953 128 7511', centerMidX, cPadTop + 21.5, {align:'center'});
  return hBot;   // Y donde termina el encabezado
}
// ── GENERAR PDF RECIBO NORMAL ────────────────────────────────────
// ── MARCA DE AGUA EN PDF ─────────────────────────────────────────
function dibujarMarcaAgua(doc, texto, color){
  const pageW = 215.9, pageH = 279.4;
  const cx = pageW / 2;
  const cy = pageH * 0.62; // ≈ 173 mm — tercio inferior-medio, lejos del encabezado
  const angleDeg = Math.atan2(pageH, pageW) * 180 / Math.PI; // ≈ 52.3°
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
// ── FORMATO ÚNICO DE FECHA/HORA PARA PDF ─────────────────────────────
// Petición expresa: toda fecha+hora impresa en un recibo debe verse
// "10-feb-2026 2:14 pm" — día, mes abreviado en español (minúsculas),
// año, hora 12h sin cero a la izquierda y am/pm en minúsculas.
// Esto SOLO cambia cómo se DIBUJA la fecha en el PDF — no toca ni
// reescribe el texto ya guardado en pagosParciales/costosExtra (que
// puede venir en formatos viejos, ej. "DD/MM/YYYY HH:MM hrs." o
// "YYYY-MM-DD HH:MM"): se interpreta ese texto y se reformatea al vuelo
// cada vez que se genera/regenera un PDF, sin migrar datos históricos.
const _MESES_ABREV_PDF = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const _MESES_LARGOS_PDF = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
// Formato SOLO para la fecha principal del encabezado del recibo (por instrucción
// expresa): "a 23 de febrero de 2026 3:15 pm" — mes completo, con "a" en vez de
// guión largo. Las demás fechas del recibo (etiquetas de versión en cada cargo/
// abono, "Generó: ... — fecha", ADEUDO ANTERIOR, etc.) siguen usando _fmtFHNueva
// tal cual (formato corto "23-feb-2026 3:15 pm") — no se tocan.
function _fmtFHEncabezado(fechaISO, horaHHMM) {
  if (!fechaISO) return '';
  try {
    const p = String(fechaISO).slice(0, 10).split('-');
    if (p.length < 3 || p[0].length !== 4) return String(fechaISO) + (horaHHMM ? ' ' + horaHHMM : '');
    const dd = parseInt(p[2], 10);
    const mm = _MESES_LARGOS_PDF[parseInt(p[1], 10) - 1] || '';
    const yyyy = p[0];
    let out = 'a ' + dd + ' de ' + mm + ' de ' + yyyy;
    if (horaHHMM) {
      const hp = String(horaHHMM).match(/(\d{1,2}):(\d{2})/);
      if (hp) {
        const hh = parseInt(hp[1], 10);
        const mi = hp[2];
        const ampm = hh >= 12 ? 'pm' : 'am';
        let hh12 = hh % 12; if (hh12 === 0) hh12 = 12;
        out += ' ' + hh12 + ':' + mi + ' ' + ampm;
      }
    }
    return out;
  } catch (e) { return String(fechaISO); }
}
function _fmtFHNueva(fechaISO, horaHHMM) {
  if (!fechaISO) return '';
  try {
    const p = String(fechaISO).slice(0, 10).split('-');
    if (p.length < 3 || p[0].length !== 4) return String(fechaISO) + (horaHHMM ? ' ' + horaHHMM : '');
    const dd = String(p[2]).padStart(2, '0');
    const mm = _MESES_ABREV_PDF[parseInt(p[1], 10) - 1] || '';
    const yyyy = p[0];
    let out = dd + '-' + mm + '-' + yyyy;
    if (horaHHMM) {
      const hp = String(horaHHMM).match(/(\d{1,2}):(\d{2})/);
      if (hp) {
        const hh = parseInt(hp[1], 10);
        const mi = hp[2];
        const ampm = hh >= 12 ? 'pm' : 'am';
        let hh12 = hh % 12; if (hh12 === 0) hh12 = 12;
        out += ' ' + hh12 + ':' + mi + ' ' + ampm;
      }
    }
    return out;
  } catch (e) { return String(fechaISO); }
}
// Interpreta un texto de fecha/hora ya guardado (varios formatos históricos
// conviven en los datos) y lo separa en {fecha:'YYYY-MM-DD', hora:'HH:MM'}.
// Devuelve null si no reconoce el formato (se deja el texto original tal cual).
function _parseFHTexto(str) {
  if (!str) return null;
  const s = String(str).trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/); // DD/MM/YYYY [HH:MM]
  if (m) return { fecha: m[3] + '-' + m[2] + '-' + m[1], hora: m[4] != null ? (String(m[4]).padStart(2, '0') + ':' + m[5]) : '' };
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/); // YYYY-MM-DD [HH:MM]
  if (m) return { fecha: m[1] + '-' + m[2] + '-' + m[3], hora: m[4] != null ? (String(m[4]).padStart(2, '0') + ':' + m[5]) : '' };
  return null;
}
// Reformatea un texto de fecha/hora YA GUARDADO (cualquiera de los formatos
// de arriba) al formato único nuevo. Si no lo reconoce, devuelve el texto
// original sin tocar (defensivo — nunca deja la línea vacía).
function _fmtFHDesdeTexto(str) {
  const p = _parseFHTexto(str);
  if (!p) return str || '';
  return _fmtFHNueva(p.fecha, p.hora);
}
async function generarPDF(datos,folio,qrDataURL){
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
  const margin=11,pageW=215.9,cW=pageW-margin*2;
  const logoObj = await getLogoDataURL();
  // ── ENCABEZADO ──
  const hBot = dibujarEncabezadoPDF(doc, margin, cW, folio, logoObj, datos.letra, datos.anio_folio);
  const yAfterH = hBot + 3;
  // ── RECIBO OFICIAL / RECIBO DE LIQUIDACIÓN / RECIBO DE ABONO PARCIAL / RECIBO DE SERVICIO COMPLEMENTARIO ──
  const _fps = datos.fechasImpresion || [];
  // FIX (caso real: folio 74A): el folio A NUNCA debe tratarse como
  // "actualización" (_esUpdate), sin importar cuántas entradas traiga
  // fechasImpresion (reimpresiones/ediciones directas de la letra A, como
  // editarReciboEnConsulta/adminAbrirEdicionCompleta, pueden dejar más de una
  // entrada ahí). Cuando _esUpdate se colaba en true para la letra A, el PDF
  // usaba el cuadro de totales de B+ (SALDO ANTERIOR/PAGO RECIBIDO, basado en
  // pagosParciales) en vez del propio de la letra A (TOTAL/ABONADO/RESTA,
  // basado en el anticipo — ver _esVersionA más abajo) y el anticipo editado
  // ($5,500 en vez de $5,000) no se contaba como "pago recibido", dejando el
  // cuadro de totales $500 corto y el título en "PAGO PARCIAL" en vez de
  // "PAGO INICIAL". El folio A siempre es el original — solo B, C, D… son
  // actualizaciones reales.
  const _esUpdate = _fps.length > 1 && (datos.letra||'A').toUpperCase() !== 'A';
  // ⚠️ FIX: si anticipo = total (pago completo desde el inicio), también es liquidación
  const _pagadoCompleto = parseFloat(datos.saldoPendiente) <= 0 &&
                          parseFloat(datos.totalAbonado || datos.anticipo || 0) >= parseFloat(datos.total || 0);
  const _esFinalLiq = (_esUpdate || _pagadoCompleto) && (parseFloat(datos.saldoNuevo)<=0 || parseFloat(datos.saldoPendiente)<=0);
  const _esParcial  = _esUpdate && !_esFinalLiq;
  const _esCancelacion = !!datos.cancelado && _esUpdate;
  // ── Detectar si esta actualización incluye Servicio Complementario ──
  // Condición: hay al menos un costoExtra nuevo (no locked), sin importar si además hay abonos.
  // Cubre los 3 casos: (1) solo suma al total, (2) complementario liquidado en el acto,
  // (3) complementario + abono extra al saldo principal.
  const _ceNuevos = (datos.costosExtra || []).filter(c => c.locked !== true);
  // FIX: Al reimprimir/regenerar, los costosExtra ya están todos locked.
  // Detectar si ESTE recibo (esta letra) fue originalmente un Servicio Complementario:
  // hay costosExtra locked cuyo folioLetra coincide con la letra actual (fueron agregados en esta versión).
  const _letraActual = (datos.letra || 'A').toUpperCase();
  const _ceLocked = (datos.costosExtra || []).filter(c => c.locked === true &&
    ((c.folioLetra || '').toUpperCase() === _letraActual));
  // También detectar por el campo tipoVersion si existe
  const _esCEVersion = datos.tipoVersion === 'complementario' || datos.tipoVersion === 'ce';
  const _tieneCE = _esUpdate && (_ceNuevos.length > 0 || _ceLocked.length > 0 || _esCEVersion);
  // ── SIN COSTO TOTAL PACTADO (Juicio/Escritura abierto): cada recibo (A, B, C…) es un
  // comprobante INDEPENDIENTE del pago/cargo de ese momento — no una actualización que
  // arrastra saldo/historial de versiones ya liquidadas. Se calcula aquí, antes de dibujar
  // nada, porque el título y el cuadro de totales dependen de estos mismos números.
  const _esAbiertoPDF = (datos.modoCosto === 'abierto') || ((typeof window._abiertoSinCosto==='function') && window._abiertoSinCosto(datos));
  // ── LÓGICA ÚNICA de totales para folios de Costo Pactado (normal), calculada
  // AQUÍ (antes de dibujar nada) para que tanto el nuevo bloque "SUMA TOTAL DE
  // ADEUDOS / PAGOS REALIZADOS" (más abajo, junto al Servicio Complementario)
  // como el cuadro final TOTAL/ABONADO/RESTA usen los MISMOS números — una
  // sola fuente de verdad, nunca dos cálculos separados que puedan divergir.
  // Se basa exclusivamente en folioLetra (igual que la Ficha del Folio):
  //   PAGO RECIBIDO (esta versión) = Σ pagosParciales con folioLetra = esta
  //                                   + cargos liquidados al momento en esta versión.
  //   SALDO ANTERIOR                = totalGeneral (ya incluye costosExtra
  //                                    acumulados) − anticipo − Σ pagosParciales
  //                                    de versiones ANTERIORES.
  //   SALDO RESTANTE                = SALDO ANTERIOR − PAGO RECIBIDO.
  const _todosPP_CP = datos.pagosParciales || [];
  const _misPPEsta_CP = _todosPP_CP.filter(function(p){ return p && (p.folioLetra||'A').toUpperCase() === _letraActual; });
  const _ppAntes_CP   = _todosPP_CP.filter(function(p){ return p && (p.folioLetra||'A').toUpperCase() <  _letraActual; });
  const _ceLiquidadosEsta_CP = (datos.costosExtra||[]).filter(function(c){
    return c && c.liquidadoAlMomento && (c.folioLetra||'A').toUpperCase() === _letraActual;
  });
  const _pagoCELiquidadoEsta_CP = _ceLiquidadosEsta_CP.reduce(function(s,c){ return s+(parseFloat(c.montoLiquidado)||0); }, 0);
  const _pagoEstaVersion_CP = _misPPEsta_CP.reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0) + _pagoCELiquidadoEsta_CP;
  const _totalPPAntes_CP    = _ppAntes_CP.reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0);
  const _anticipoBase_CP = parseFloat(datos.anticipo)||0;
  // FIX: varios call sites de generarPDF() (reimpresión, regeneración masiva,
  // visor de PDF, etc.) pasan el recibo guardado directo (spread de `r`) sin
  // fijar explícitamente `datos.totalGeneral` — el campo que SÍ se guarda en
  // cada recibo es `total` (ver nuevoRegistro.total = totalGeneral en
  // _imprimirActualizacionReal). Sin este fallback, _totalGeneralCP caía a 0
  // en esos casos y el "SALDO RESTANTE"/"ADEUDO ANTERIOR" del recibo salía en
  // $0.00 en vez del monto real (caso real: folio 1B mostraba $0.00 en vez
  // de $7,000.00 al reimprimir/regenerar).
  const _totalGeneralCP  = (datos.totalGeneral !== undefined) ? parseFloat(datos.totalGeneral) : (parseFloat(datos.total)||0);
  const _saldoAnteriorResumen_CP = Math.max(0, _totalGeneralCP - _anticipoBase_CP - _totalPPAntes_CP);
  const _saldoRestante_CP = Math.max(0, _saldoAnteriorResumen_CP - _pagoEstaVersion_CP);
  // Este recibo es, en concreto, un "recibo de Servicio Complementario" bajo
  // Costo Pactado (folio 6 y similares): la variante que ahora necesita el
  // mismo nivel de detalle visual que ya usa Sin Costo Total Pactado.
  const _esRecCEDetalladoCP = _tieneCE && !_esAbiertoPDF && _esUpdate;
  // Iniciales de un nombre completo (mismo criterio que se usa en el resto del PDF).
  function _inicialesDeSC(nombre){
    return (nombre||'').trim().split(/\s+/).map(function(w){ return (w[0]||'').toUpperCase(); }).join('').slice(0,4) || '—';
  }
  // Adeudo anterior real. IMPORTANTE: cada versión guardada del folio (A, B, C…)
  // acumula en su costosExtra/pagosParciales TODO el historial hasta ese punto (los
  // de versiones previas + los nuevos de esa sesión) — por eso basta con leer la
  // ÚLTIMA versión ANTERIOR a esta (nunca sumar entre varias versiones, que
  // duplicaría cada cargo tantas veces como versiones existan). "Cargos internos"
  // de la ficha NO se incluyen aquí porque se guardan por folio completo (no por
  // versión) y no se pueden atribuir de forma confiable a una letra específica.
  let _adeudoItemsSC = [];
  let _saldoAnteriorSC = 0;
  let _totalPagosParcialesPreSC = 0;
  let _totalCostosExtraPreSC = 0;
  if(_esAbiertoPDF){
    _totalPagosParcialesPreSC = (datos.pagosParciales||[]).reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0);
    _totalCostosExtraPreSC = (datos.costosExtra||[]).reduce(function(s,c){ return s+(parseFloat(c.precio)||0); }, 0);
    if(_esUpdate){
      const _folioSC = Number(datos.folio);
      const _letraActualSC = (datos.letra||'A').toUpperCase();
      const _todasVersSC = (typeof appData!=='undefined' && appData.recibos ? appData.recibos : [])
        .filter(function(x){ return x && Number(x.folio)===_folioSC && !x.esComplemento; });
      const _anterioresSC = _todasVersSC
        .filter(function(x){ return (x.letra||'A').toUpperCase() < _letraActualSC; })
        .sort(function(a,b){ return String(b.letra||'A').charCodeAt(0)-String(a.letra||'A').charCodeAt(0); });
      const _prevRecSC = _anterioresSC[0] || null;
      if(_prevRecSC){
        (_prevRecSC.costosExtra||[]).forEach(function(ce){
          if(!ce) return;
          const m = parseFloat(ce.precio)||0;
          // Atribuir el cargo a quien realmente lo generó (la versión donde se
          // originó, vía folioLetra), no siempre al responsable de la versión
          // anterior que lo trae acumulado.
          const _letraOrigenSC = (ce.folioLetra || _prevRecSC.letra || 'A').toUpperCase();
          const _origenSC = _todasVersSC.find(function(v){ return (v.letra||'A').toUpperCase()===_letraOrigenSC; }) || _prevRecSC;
          _adeudoItemsSC.push({ concepto: ce.concepto||'Servicio', fecha: ce.fechaHora||'', iniciales: _inicialesDeSC(_origenSC.responsable||''), monto: m });
        });
        // Aplicar los abonos acumulados (de esa misma versión anterior, que ya
        // incluye todos los abonos hasta ese punto) en orden cronológico (FIFO)
        // contra cada cargo, para que cada línea de "ADEUDO ANTERIOR" muestre lo
        // que REALMENTE sigue pendiente — los cargos ya cubiertos por completo
        // desaparecen del listado (no se arrastra historial ya liquidado).
        let _restanteFIFOsc = (_prevRecSC.pagosParciales||[]).reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0);
        _adeudoItemsSC = _adeudoItemsSC.map(function(it){
          const aplicado = Math.min(it.monto, _restanteFIFOsc);
          _restanteFIFOsc -= aplicado;
          return Object.assign({}, it, { monto: Math.max(0, it.monto - aplicado) });
        }).filter(function(it){ return it.monto > 0.005; });
        _saldoAnteriorSC = _adeudoItemsSC.reduce(function(s,it){ return s+it.monto; }, 0);
      }
    }
  }
  // Hay un cargo real detrás de esta transacción (adeudo previo sin liquidar, o un
  // Servicio Complementario nuevo en este mismo recibo). Si NO lo hay, es un abono
  // suelto sin relación a ningún cargo — se mantiene el comportamiento independiente
  // ya construido (Total=Abonó=lo entregado, Resta $0.00, título "RECIBO DE PAGO PARCIAL").
  const _totalConAdeudoSC = _saldoAnteriorSC + _totalCostosExtraPreSC;
  const _restaTransSC = Math.max(0, _totalConAdeudoSC - _totalPagosParcialesPreSC);
  const _hayCargoRealSC = _totalConAdeudoSC > 0;
  // ── Título unificado: solo 4 nombres posibles en todo el sistema, sin
  // importar el modo de costo (Pactado o Abierto), más el caso aparte de
  // cancelación. Antes "RECIBO OFICIAL"/"RECIBO DE LIQUIDACIÓN"/"RECIBO DE
  // ABONO PARCIAL"/"RECIBO DE SERVICIOS" eran nombres duplicados del mismo
  // caso ya cubierto por su equivalente en Sin Costo Pactado — se unificaron
  // a petición expresa para que el título dependa solo de QUÉ pasó en el
  // recibo, no de en qué modo de costo está el folio.
  // FIX (caso real: folio 56C): antes, "RECIBO DE SERVICIO COMPLEMENTARIO"
  // en modo Sin Costo Pactado SOLO aplicaba si el folio no traía ningún
  // adeudo anterior arrastrado — si ya había deuda previa, un recibo que
  // agregaba un cargo nuevo cambiaba a "PAGO PARCIAL"/"PAGO TOTAL" y nunca
  // más volvía a decir servicio complementario. A petición expresa, ahora
  // se unifica con el modo Costo Pactado: CUALQUIER recibo que agregue un
  // cargo nuevo en esta versión (_totalCostosExtraPreSC > 0) se titula
  // SERVICIO COMPLEMENTARIO, sin importar si ya había adeudo anterior.
  const _tituloSinCostoSC = (_totalCostosExtraPreSC > 0)
    ? 'RECIBO DE SERVICIO COMPLEMENTARIO'
    : (!_hayCargoRealSC
        ? 'RECIBO DE PAGO PARCIAL'
        : (_restaTransSC > 0 ? 'RECIBO DE PAGO PARCIAL' : 'RECIBO DE PAGO TOTAL'));
  const _tituloRecibo = _esCancelacion ? 'RECIBO DE CANCELACIÓN'
                      : _esAbiertoPDF  ? (_esUpdate ? _tituloSinCostoSC : 'RECIBO DE PAGO INICIAL')
                      : _esFinalLiq    ? 'RECIBO DE PAGO TOTAL'
                      : _tieneCE       ? 'RECIBO DE SERVICIO COMPLEMENTARIO'
                      : _esParcial     ? 'RECIBO DE PAGO PARCIAL'
                      :                  'RECIBO DE PAGO INICIAL';
  doc.setTextColor(154,110,24); doc.setFontSize(10); doc.setFont('times','bold');
  doc.text(_tituloRecibo, margin, yAfterH);
  // Referencia al folio original (solo en versiones B+; se omite en Sin Costo Total
  // Pactado porque cada recibo es un comprobante independiente sin historial).
  // NOTA: se quitó por instrucción expresa la leyenda "Referencia Folio Original:
  // #4A" que antes aparecía aquí en las versiones B, C, D… — ya no se imprime nada
  // en su lugar.
  // Para actualizaciones (B, C, D…): la fecha principal es la de ESTA versión
  // (última entrada de fechasImpresion). Para la versión original (A): la fecha
  // principal es datos.fecha_recibo.
  const _fpPrincipal = _esUpdate ? _fps[_fps.length - 1] : null;
  const _fechaRecISO = _esUpdate ? (_fpPrincipal.fecha || '') : (datos.fecha_recibo || '');
  const _horaRecHM   = _esUpdate ? (_fpPrincipal.hora || datos.hora_recibo || '') : (datos.hora_recibo || '');
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(80,65,40);
  doc.text('Santiago Juxtlahuaca, Oaxaca '+_fmtFHEncabezado(_fechaRecISO,_horaRecHM),pageW-margin,yAfterH,{align:'right'});
  // Versiones anteriores: YA NO se listan aquí como historial de fechas — esa
  // información redundaba con la etiqueta de versión y fecha que ya trae cada
  // línea de concepto/cargo/abono (ej. "[6B 20-ene-2026 1:31 pm]"). Se quitó
  // por instrucción expresa para no repetir la misma fecha dos veces.
  let yLineaFechas = yAfterH;
  doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.line(margin,yLineaFechas+1.5,pageW-margin,yLineaFechas+1.5);
  let y=yLineaFechas+4.5;
  const campo=(label,val,x,cy,w)=>{
    doc.setFontSize(5.5); doc.setTextColor(130,100,50); doc.setFont('helvetica','normal'); doc.text(label,x,cy);
    doc.setFontSize(8); doc.setTextColor(20,10,5); doc.text(val||'—',x,cy+4);
    doc.setDrawColor(210,185,120); doc.line(x,cy+5,x+w,cy+5);
  };
  // Clientes
  doc.setFillColor(248,244,232); doc.rect(margin,y-3,cW,5,'F');
  doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
  doc.text('DATOS DEL CLIENTE',margin+1,y); y+=2.5;
  datos.clientes.forEach((c,i)=>{
    if(i>0){ doc.setDrawColor(230,210,170); doc.setLineWidth(0.2); doc.line(margin,y-1,margin+cW,y-1); }
    campo('NOMBRE',c.nombre,margin,y,cW*0.55);
    campo('MÓVIL',c.movil,margin+cW*0.6,y,cW*0.18);
    campo('TEL. CASA',c.tel,margin+cW*0.82,y,cW*0.18); y+=8;
    if(c.domicilio){ campo('DOMICILIO',c.domicilio,margin,y,cW); y+=8; }
  });
  // Renderiza un párrafo (o varios separados por "\n\n") con sangría en la
  // primera línea de cada párrafo y justificado (excepto la última línea de
  // cada párrafo, como es estándar tipográfico). Calcula el ancho de wrap
  // de cada línea tomando en cuenta el punto de inicio real en x, para que
  // el texto NUNCA se salga del margen de impresión.
  function _pdfParrafoJustificado(texto, x, yStart, maxWidth, opts){
    opts = opts || {};
    var sangria = opts.sangria != null ? opts.sangria : 6;
    var lineHeight = opts.lineHeight || 3.2;
    var espacioParrafo = opts.espacioParrafo != null ? opts.espacioParrafo : lineHeight * 0.5;
    var y = yStart;
    String(texto).split('\n\n').forEach(function(parrafo, pi){
      if(pi > 0) y += espacioParrafo;
      var palabras = parrafo.replace(/\n/g,' ').split(' ').filter(function(w){ return w.length; });
      var lineas = [];
      var actual = '';
      var anchoDisp = maxWidth - sangria;
      palabras.forEach(function(palabra){
        var prueba = actual ? actual + ' ' + palabra : palabra;
        if(doc.getTextWidth(prueba) > anchoDisp && actual){
          lineas.push(actual);
          actual = palabra;
          anchoDisp = maxWidth;
        } else {
          actual = prueba;
        }
      });
      if(actual) lineas.push(actual);
      lineas.forEach(function(linea, li){
        var esPrimera = (li === 0);
        var esUltima = (li === lineas.length - 1);
        var xLinea = esPrimera ? x + sangria : x;
        var anchoLinea = esPrimera ? maxWidth - sangria : maxWidth;
        if(!esUltima && lineas.length > 1){
          // Justificación MANUAL: jsPDF re-parte cada string que recibe usando su
          // propio splitTextToSize(text, maxWidth) — como aquí ya le pasamos una
          // sola línea que cabe entera en anchoLinea, jsPDF la trata como un
          // arreglo de 1 elemento y por diseño NUNCA estira la "última" línea de
          // ese arreglo (aunque para nosotros no sea la última del párrafo). El
          // resultado es que align:'justify' no hacía nada. Por eso distribuimos
          // el espacio sobrante entre palabras nosotros mismos.
          var palabrasLinea = linea.split(' ').filter(function(w){ return w.length; });
          if(palabrasLinea.length > 1){
            var anchoTexto = 0;
            palabrasLinea.forEach(function(w){ anchoTexto += doc.getTextWidth(w); });
            var gap = (anchoLinea - anchoTexto) / (palabrasLinea.length - 1);
            var xCursor = xLinea;
            palabrasLinea.forEach(function(w, wi){
              doc.text(w, xCursor, y);
              xCursor += doc.getTextWidth(w) + (wi < palabrasLinea.length - 1 ? gap : 0);
            });
          } else {
            doc.text(linea, xLinea, y);
          }
        } else {
          doc.text(linea, xLinea, y);
        }
        y += lineHeight;
      });
    });
    return y; // y tras el/los párrafo(s), lista para continuar el layout
  }
  // Poder — texto según tipo de trámite y letra. A petición expresa: ya NO se
  // oculta en ningún caso — escritura/juicio en B/C/D (que antes no mostraban
  // nada) ahora caen al texto corto de siempre, igual que cualquier otro
  // trámite normal y que vehicular en B/C/D.
  const _tipoTramitePDF = datos.tipoTramite || datos.tramites || '';
  const _letraPDF = (datos.letra || 'A').toUpperCase();
  // Se conserva (usada más abajo para ocultar "DOCUMENTOS QUE DEJA EL
  // INTERESADO" en Escritura/Juicio — sección aparte, sin relación con el
  // texto del poder).
  const _esEscrituraOJuicio = (_tipoTramitePDF === 'escritura' || _tipoTramitePDF === 'juicio');
  {
    let _textoPoder = '';
    if (_tipoTramitePDF === 'escritura' && _letraPDF === 'A') {
      _textoPoder = 'Otorgo al Despacho Jurídico LEX-MÉXICO y a sus integrantes debidamente autorizados facultades amplias y suficientes para realizar, en mi nombre y representación, las gestiones, trámites y diligencias necesarias para la debida tramitación de mi escritura pública.\n\nManifiesto haber sido debidamente informado, que el importe señalado en el presente recibo no incluye el pago del Impuesto Sobre la Renta (ISR) ni del Impuesto de Traslación de Dominio, cuyos montos serán determinados posteriormente por la base catastral asignada.\n\nBajo protesta de decir verdad, declaro que la documentación proporcionada es auténtica, completa y veraz. En caso de detectarse inconsistencias, omisiones o requerirse documentación complementaria durante el trámite, me comprometo a subsanarlas a la brevedad. Asimismo, manifiesto contar con la solvencia económica para cubrir cualquier gasto, derecho, contribución o erogación adicional que resulte necesaria para la conclusión del trámite, deslindando al Despacho Jurídico LEX-MÉXICO de cualquier responsabilidad derivada de dichas circunstancias.';
    } else if (_tipoTramitePDF === 'juicio' && _letraPDF === 'A') {
      _textoPoder = 'Otorgo al Despacho Jurídico LEX-MÉXICO y a sus integrantes debidamente autorizados poder amplio y suficiente para representarme en el juicio o procedimiento legal correspondiente, incluyendo la realización de gestiones, promociones, recursos y diligencias necesarias para la atención, seguimiento y defensa del presente asunto.\n\nLos importes señalados en el presente recibo corresponden exclusivamente a los servicios profesionales contratados y no incluyen gastos, derechos, impuestos, certificaciones, peritajes, viáticos, honorarios de terceros ni cualquier otra erogación que pudiera generarse durante la sustanciación del procedimiento.\n\nBajo protesta de decir verdad, declaro que la información y documentación proporcionadas son auténticas, completas y veraces, comprometiéndome a entregar cualquier documento adicional que se requiera y a comparecer cuando resulte necesario. En caso de detectarse omisiones o inconsistencias en la documentación, me comprometo a subsanarlas a la brevedad, deslindando al Despacho Jurídico LEX-MÉXICO de cualquier responsabilidad atribuible a tales circunstancias.';
    } else if (_tipoTramitePDF === 'vehicular' && _letraPDF === 'A') {
      // A petición expresa: solo en el folio A de trámites vehiculares (las
      // versiones posteriores B/C/D conservan el texto corto de siempre).
      _textoPoder = 'Manifiesto bajo protesta de decir verdad que el vehículo es de procedencia lícita, no cuenta con reporte de robo o impedimento legal, y que la documentación proporcionada es auténtica, legítima y corresponde al mismo. Otorgo al responsable del trámite del Despacho Jurídico LEX-MÉXICO, poder amplio, cumplido y bastante para que, en mi nombre y representación, realice y gestione las diligencias y trámites necesarios para la debida tramitación de los servicios solicitados. Asumo toda responsabilidad por falsedad, alteración, apocrificidad, irregularidad o ilegal procedencia del vehículo o documentación proporcionada, liberando al Despacho de cualquier responsabilidad derivada de ello.';
    } else {
      _textoPoder = 'Otorgo al responsable del trámite del Despacho Jurídico LEX-MÉXICO, poder amplio, cumplido y bastante para que, en mi nombre y representación, realice y gestione las diligencias y trámites necesarios para la debida tramitación de los servicios solicitados.';
    }
    doc.setFontSize(7); doc.setTextColor(_esCancelacion?150:60,_esCancelacion?150:45,_esCancelacion?145:20); doc.setFont('helvetica','bolditalic');
    y = _pdfParrafoJustificado(_textoPoder, margin, y, cW, { sangria: 6, lineHeight: 3.2 }) + 2;
  }
  // Vehiculo — solo si es trámite vehicular
  // En recibo de cancelación, esta sección ya no aplica (el trámite quedó sin
  // efecto) — se muestra en gris con cada dato tachado, como el resto de la
  // información del trámite original, dejando claro que solo el cuadro de
  // totales de arriba refleja el estado real.
  const campoV = _esCancelacion ? (label,val,x,cy,w)=>{
    doc.setFontSize(5.5); doc.setTextColor(165,165,160); doc.setFont('helvetica','normal'); doc.text(label,x,cy);
    doc.setFontSize(8); doc.setTextColor(150,150,145); doc.text(val||'—',x,cy+4);
    const _tw = Math.min(w, doc.getStringUnitWidth(val||'—')*8/doc.internal.scaleFactor+1);
    doc.setDrawColor(150,150,145); doc.setLineWidth(0.3); doc.line(x,cy+2.4,x+_tw,cy+2.4);
    doc.setDrawColor(210,210,205); doc.line(x,cy+5,x+w,cy+5);
  } : campo;
  if(datos.tipoTramite === 'vehicular') {
  doc.setFillColor(_esCancelacion?235:248,_esCancelacion?235:244,_esCancelacion?230:232); doc.rect(margin,y-3,cW,5,'F');
  doc.setTextColor(_esCancelacion?130:154,_esCancelacion?130:110,_esCancelacion?125:24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
  doc.text('DATOS GENERALES DEL VEHICULO',margin+1,y); y+=2.5;
  // Fila 1: Clase · Marca · Tipo · Serie/VIN · No. Motor
  const c2=cW/2, c4=cW/4, c5=cW/5;
  campoV('CLASE',datos.clase,margin,y,c5-3);
  campoV('MARCA',datos.marca,margin+c5,y,c5-3);
  campoV('TIPO',datos.tipo_veh,margin+c5*2,y,c5-3);
  campoV('SERIE / VIN',datos.serie,margin+c5*3,y,c5-3);
  campoV('NO. MOTOR',datos.motor,margin+c5*4,y,c5-3); y+=8;
  // Fila 2: Año · Puertas · Color · Transmisión
  campoV('AÑO',datos.anio,margin,y,c4-3);
  campoV('PUERTAS',datos.puertas,margin+c4*0.7,y,c4*0.6-3);
  campoV('COLOR',datos.color_veh,margin+c4*1.3,y,c4-3);
  campoV('TRANSMISIÓN',datos.transmision,margin+c4*2.3,y,c4-3);
  campoV('CILINDROS',datos.cilindros,margin+c4*3.3,y,c4*0.7-3); y+=8;
  // Fila 3: Placas · Últ. Tenencia · Origen · Combustible
  // Estado de placas solo en recibo original (serie A) de tramite vehicular
  var _esSerieA = (datos.letra || 'A').toUpperCase() === 'A' && !_esUpdate;
  var _esVehicular = datos.tipoTramite === 'vehicular' || datos.tipoVeh || datos.clase_veh;
  // ── PLACAS ACTUALES: renderizado dedicado ───────────────────────────────
  // El estado va en MAYÚSCULAS y separado de la placa con un espacio
  // considerable para que no se confundan visualmente. Donde no haya
  // información (placa o estado) se deja un simple "—", igual que el resto
  // de los campos vacíos del PDF — sin frases como "SIN ESPECIFICAR".
  (function(){
    var _wCampo = c4-3, _xCampo = margin;
    var _colLabel = _esCancelacion ? [165,165,160] : [130,100,50];
    var _colVal   = _esCancelacion ? [150,150,145] : [20,10,5];
    var _colLinea = _esCancelacion ? [210,210,205] : [210,185,120];
    doc.setFontSize(5.5); doc.setTextColor(_colLabel[0],_colLabel[1],_colLabel[2]); doc.setFont('helvetica','normal');
    doc.text('PLACAS ACTUALES', _xCampo, y);
    var _placaTxt = (datos.placa||'').trim();
    var _estadoTxt = '';
    if(_esSerieA && _esVehicular){
      var _estPlaca = (datos.placaEstado||'').trim();
      _estadoTxt = (_estPlaca && _estPlaca !== 'SIN_ESP') ? _nombreCompletoEstadoPlaca(_estPlaca).toUpperCase() : '—';
    }
    doc.setTextColor(_colVal[0],_colVal[1],_colVal[2]);
    if(!_placaTxt){
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.text('—', _xCampo, y+4);
    } else {
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.text(_placaTxt, _xCampo, y+4);
      if(_estadoTxt){
        var _anchoPlaca = doc.getStringUnitWidth(_placaTxt)*8/doc.internal.scaleFactor;
        doc.setFontSize(_estadoTxt === '—' ? 8 : 7.2);
        doc.text(_estadoTxt, _xCampo + _anchoPlaca + 6, y+4);
      }
    }
    doc.setDrawColor(_colLinea[0],_colLinea[1],_colLinea[2]); doc.line(_xCampo, y+5, _xCampo+_wCampo, y+5);
  })();
  campoV('¿ADEUDA TENENCIAS?',datos.ultima_tenencia,margin+c4,y,c4-3);
  campoV('ORIGEN',datos.origen,margin+c4*2,y,c4-3);
  campoV('COMBUSTIBLE',datos.combustible,margin+c4*3,y,c4-3); y+=8.5;
  } // end vehicular section
  // Documentos — solo en trámites que no sean Escritura ni Juicio
  if (!_esEscrituraOJuicio) {
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(_esCancelacion?130:100,_esCancelacion?130:80,_esCancelacion?125:40);
  doc.text('DOCUMENTOS QUE DEJA EL INTERESADO:',margin,y); y+=3.5;
  let docsData = null;
  try {
    if(datos.copias){
      const _cop = typeof datos.copias==='string' ? JSON.parse(datos.copias) : datos.copias;
      if(_cop && _cop.docs && Array.isArray(_cop.docs)){
        docsData = _cop;
      } else if(Array.isArray(_cop) && _cop.length){
        docsData = { docs: _cop, tipodoc: '' };
      }
    }
  } catch(e){ /* copias en formato anterior */ }
  // Nunca debe quedar sin especificar si son copias, escaneos u originales —
  // por seguridad/responsabilidad legal. Primero se intenta recuperar lo que
  // REALMENTE se eligió en el formulario vía datos.tipo_doc (campo aparte, que
  // sí se guarda siempre como string plano y no se pierde al re-guardar). Solo
  // si tampoco existe eso, se asume COPIA SIMPLE — nunca originales.
  if (docsData && !docsData.tipodoc) {
    docsData.tipodoc = (datos.tipo_doc === 'escaneo') ? 'DOCUMENTOS QUE SE ESCANEARON' : 'DOCUMENTOS EN COPIA SIMPLE';
  }
  if (docsData && docsData.docs && docsData.docs.length) {
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(_esCancelacion?130:42,_esCancelacion?130:100,_esCancelacion?125:42);
    doc.text('• Tipo: ' + docsData.tipodoc, margin, y); y += 4;
    doc.setFont('helvetica','normal'); doc.setTextColor(_esCancelacion?145:15,_esCancelacion?145:10,_esCancelacion?140:5); doc.setFontSize(7.5);
    const colW = cW / 2 - 4;
    const docList = docsData.docs;
    const perCol = Math.ceil(docList.length / 2);
    const col1Items = docList.slice(0, perCol);
    const col2Items = docList.slice(perCol);
    const maxRows = Math.max(col1Items.length, col2Items.length);
    const lineH = 4.2;
    for (let i = 0; i < maxRows; i++) {
      if (col1Items[i]) {
        doc.setTextColor(_esCancelacion?150:30,_esCancelacion?150:110,_esCancelacion?145:30); doc.text('\u2714', margin, y);
        doc.setTextColor(_esCancelacion?145:15,_esCancelacion?145:10,_esCancelacion?140:5);
        const label1 = doc.splitTextToSize(col1Items[i], colW - 6);
        doc.text(label1[0], margin + 5, y);
        if(_esCancelacion){
          const _tw1 = doc.getStringUnitWidth(label1[0])*7.5/doc.internal.scaleFactor;
          doc.setDrawColor(150,150,145); doc.setLineWidth(0.3); doc.line(margin+5, y-1.4, margin+5+_tw1, y-1.4);
        }
      }
      if (col2Items[i]) {
        const col2X = margin + cW / 2 + 2;
        doc.setTextColor(_esCancelacion?150:30,_esCancelacion?150:110,_esCancelacion?145:30); doc.text('\u2714', col2X, y);
        doc.setTextColor(_esCancelacion?145:15,_esCancelacion?145:10,_esCancelacion?140:5);
        const label2 = doc.splitTextToSize(col2Items[i], colW - 6);
        doc.text(label2[0], col2X + 5, y);
        if(_esCancelacion){
          const _tw2 = doc.getStringUnitWidth(label2[0])*7.5/doc.internal.scaleFactor;
          doc.setDrawColor(150,150,145); doc.setLineWidth(0.3); doc.line(col2X+5, y-1.4, col2X+5+_tw2, y-1.4);
        }
      }
      y += lineH;
    }
    y += 1;
  } else if (datos.copias && !docsData) {
    doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5); doc.setFontSize(8);
    const cL=doc.splitTextToSize(datos.copias,cW); doc.text(cL,margin,y); y+=cL.length*4+1;
  } else {
    doc.setFont('helvetica','normal'); doc.setTextColor(120,100,60); doc.setFontSize(8);
    doc.text('— Ninguno —', margin, y); y+=5;
  }
  } // fin bloque documentos
  // Conceptos — altura dinámica según contenido del texto.
  // En Sin Costo Total Pactado, las versiones B+ NO repiten la tabla de conceptos
  // original (ese "COSTO DEL TRÁMITE" pertenece al recibo inicial ya liquidado, no
  // a esta transacción) — el pago de ESTA transacción ya se detalla más abajo en
  // "PAGOS PARCIALES". Mantiene el recibo como comprobante independiente.
  let total=0;
  const colConceptoW = cW*0.35;
  const colDescripW  = cW*0.42;
  // ── Actualización simple de Costo Pactado (B, C, D… sin Servicio
  // Complementario ni cancelación): la tabla de conceptos original ya no
  // repite el "COSTO DEL TRÁMITE" completo — a petición expresa, el
  // encabezado pasa a "SALDO RESTANTE" y se colapsa a UN solo renglón con
  // lo que quedaba pendiente al entrar a este recibo (_saldoAnteriorResumen_CP).
  // El texto de CONCEPTO/DESCRIPCIÓN depende de qué pasa en este recibo:
  //   - Si liquida por completo (_esFinalLiq): "LIQUIDACIÓN TOTAL" / "DEL TRÁMITE".
  //   - Si es abono parcial y el trámite original tenía varios conceptos:
  //     "ADEUDO ANTERIOR" / "DEL TRÁMITE" (no caben varias líneas originales
  //     en un solo renglón consolidado).
  //   - Si es abono parcial con un solo concepto original: se conserva tal
  //     cual el concepto/descripción de la versión A (comportamiento previo).
  const _esActualizacionSimpleCP = _esUpdate && !_esRecCEDetalladoCP && !_esCancelacion;
  // ── Servicio Complementario sobre Costo Pactado con adeudo previo real ──
  // A petición expresa: en vez de repetir el concepto original con el COSTO
  // TOTAL pactado (dato obsoleto en cuanto ya hubo abonos), se muestra
  // "ADEUDO ANTERIOR" con lo que de verdad se arrastraba ANTES de este
  // recibo — SIN contar el costo del Servicio Complementario nuevo (ese ya
  // se desglosa aparte, más abajo, en su propia sección "SERVICIO
  // COMPLEMENTARIO"). Mismo criterio/estilo que _esActualizacionSimpleCP,
  // pero solo para el caso _esRecCEDetalladoCP.
  const _totalCEAntesCP = (datos.costosExtra||[]).reduce(function(s,c){ return s+(parseFloat(c.precio)||0); }, 0);
  const _adeudoAnteriorPrevioCP = _esRecCEDetalladoCP ? Math.max(0, _saldoAnteriorResumen_CP - _totalCEAntesCP) : 0;
  const _mostrarFilaAdeudoCE_CP = _esRecCEDetalladoCP && _adeudoAnteriorPrevioCP > 0.005;
  // A petición expresa (folios B, C, D… — NUNCA el folio A): toda fila que
  // muestre el saldo que se arrastra de la versión anterior (abono simple o
  // Servicio Complementario con adeudo previo) se unifica en un solo formato:
  // título "SALDO PENDIENTE:", dos columnas (CONCEPTO / SALDO PENDIENTE), SIN
  // DESCRIPCIÓN. El CONCEPTO ya no depende de qué pasó en este recibo (antes
  // era "ADEUDO ANTERIOR"/"LIQUIDACIÓN TOTAL"/concepto original según el caso)
  // — ahora es SIEMPRE el/los concepto(s) originales del folio A, permanentes,
  // unificados en un solo renglón si el trámite original tenía varios.
  const _esFilaSaldoPendienteCP = _esActualizacionSimpleCP || _mostrarFilaAdeudoCE_CP;
  function _conceptoFolioAUnificado(){
    const _cs = (datos.conceptos||[]).filter(c=>c && (c.concepto||c.precio));
    const _nombres = _cs.map(c=>c.concepto).filter(Boolean);
    return _nombres.length ? _nombres.join('; ') : 'ADEUDO ANTERIOR';
  }
  // conMonto=true conserva el formato viejo completo (título "SALDO
  // PENDIENTE:", columna de dinero) — solo se sigue usando en Servicio
  // Complementario con adeudo previo, donde conviven dos cargos distintos y
  // hace falta ver cuál es cuál. En todo lo demás (abono simple de Costo
  // Pactado y "Sin Costo Total Pactado"), a petición expresa ya NO se repite
  // el monto aquí — ese número ya se ve abajo en el cuadro de totales — así
  // que solo queda el encabezado "CONCEPTO" y el nombre del trámite.
  function _dibujarEncabezadoSaldoPendiente(continuacion, conMonto){
    doc.setFillColor(248,244,232); doc.rect(margin,y-3,cW,5,'F');
    doc.setTextColor(154,110,24); doc.setFontSize(7); doc.setFont('helvetica','bold');
    if(conMonto){
      doc.text('SALDO PENDIENTE'+(continuacion?' (continuación):':':'),margin+1,y); y+=4;
      doc.setFontSize(6.5);
      doc.text('CONCEPTO',margin+1,y); doc.text('SALDO PENDIENTE',margin+cW,y,{align:'right'}); y+=2.5;
    } else {
      doc.setFontSize(6.5);
      doc.text('CONCEPTO'+(continuacion?' (continuación)':''),margin+1,y); y+=2.5;
    }
  }
  function _dibujarFilaSaldoPendiente(conceptoTxt, monto, conMonto){
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
    const anchoSP = conMonto ? cW*0.72 : cW*0.98;
    const cLinesSP = doc.splitTextToSize(conceptoTxt, anchoSP);
    const rowHSP = cLinesSP.length * 4 + 1.5;
    asegurarEspacioConceptos(rowHSP);
    // A petición expresa: CONCEPTO también justificado (sin sangría) cuando
    // ocupa varias líneas — jsPDF nunca justifica la última línea de un
    // párrafo, así que un concepto de una sola línea se queda como estaba.
    doc.text(conceptoTxt, margin, y, {maxWidth: anchoSP, align: 'justify'});
    if(conMonto) doc.text('$'+fmtMXN(monto), margin+cW, y, {align:'right'});
    doc.setDrawColor(220,195,140); doc.setLineWidth(0.3);
    // FIX (líneas "tachando" texto — caso real: folio 63A): con solo -1.2mm de
    // holgura antes del renglón siguiente, la línea caía DENTRO de la altura de
    // capital (ascent≈2.15mm a 8pt Helvetica) de la primera línea del siguiente
    // renglón. -2.8mm despeja ese ascent con margen y sigue sobrando espacio
    // respecto al propio texto de ESTE renglón (verificado con jsPDF+pdftoppm).
    doc.line(margin, y+rowHSP-2.8, margin+cW, y+rowHSP-2.8);
    y += rowHSP;
  }
  // Solo el caso de Servicio Complementario con adeudo previo conserva el
  // monto en este bloque (ver comentario arriba de _dibujarEncabezadoSaldoPendiente).
  const _conMontoSaldoPendiente = _esRecCEDetalladoCP && _mostrarFilaAdeudoCE_CP;
  // Salto de página automático para conceptos
  const yMaxConceptos = 262;
  function asegurarEspacioConceptos(altoFila){
    if(y + altoFila > yMaxConceptos){
      doc.addPage();
      y = 18;
      if(_esFilaSaldoPendienteCP || (_esAbiertoPDF && _esUpdate)){
        _dibujarEncabezadoSaldoPendiente(true, _conMontoSaldoPendiente);
      } else {
        doc.setFillColor(248,244,232); doc.rect(margin,y-3,cW,5,'F');
        doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
        doc.text('CONCEPTO (continuación)',margin+1,y);
        doc.text('DESCRIPCIÓN',margin+cW*0.38,y);
        doc.text('COSTO DEL TRÁMITE',margin+cW,y,{align:'right'}); y+=2.5;
      }
    }
  }
  if(!(_esAbiertoPDF && _esUpdate)){
    if(_esFilaSaldoPendienteCP){
      _dibujarEncabezadoSaldoPendiente(false, _conMontoSaldoPendiente);
      const _montoSP_CP = _esActualizacionSimpleCP ? _saldoAnteriorResumen_CP : _adeudoAnteriorPrevioCP;
      total += _montoSP_CP;
      _dibujarFilaSaldoPendiente(_conceptoFolioAUnificado(), _montoSP_CP, _conMontoSaldoPendiente);
    } else if(_esRecCEDetalladoCP){
      // Servicio Complementario sobre Costo Pactado SIN adeudo previo (ej.
      // primer Servicio Complementario justo tras liquidar el trámite base):
      // no hay nada que mostrar aquí — el desglose completo vive en la
      // sección "SERVICIO COMPLEMENTARIO" de abajo. No se imprime ningún
      // renglón para no mostrar un "$0.00" sin explicación.
    } else {
    // Encabezado de la tabla de conceptos (franja café con CONCEPTO /
    // DESCRIPCIÓN / COSTO DEL TRÁMITE) — se había quedado SOLO dentro de
    // asegurarEspacioConceptos() (para saltos de página), por lo que la
    // franja nunca aparecía la primera vez, antes de la primera fila. FIX
    // (caso real: folio 76A): se restaura aquí, una sola vez, antes del loop.
    if(datos.conceptos.some(c=>c.concepto||c.precio)){
      doc.setFillColor(_esCancelacion?235:248,_esCancelacion?235:244,_esCancelacion?230:232); doc.rect(margin,y-3,cW,5,'F');
      doc.setTextColor(_esCancelacion?130:154,_esCancelacion?130:110,_esCancelacion?125:24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
      doc.text('CONCEPTO',margin+1,y);
      doc.text('DESCRIPCIÓN',margin+cW*0.38,y);
      doc.text('COSTO DEL TRÁMITE',margin+cW,y,{align:'right'}); y+=2.5;
    }
    let _totalConceptosTabla = 0, _nConceptosTabla = 0;
    datos.conceptos.forEach(c=>{
      if(c.concepto||c.precio){
        const p=parseFloat(c.precio)||0; total+=p; _totalConceptosTabla+=p; _nConceptosTabla++;
        doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(_esCancelacion?150:20,_esCancelacion?150:10,_esCancelacion?145:5);
        const cLines = doc.splitTextToSize(c.concepto||'', colConceptoW);
        const _vTagC = ' ['+folioConLetra(folio, datos.anio_folio, c.folioLetra||'A')+']';
        const dLines = doc.splitTextToSize((c.descripcion||'')+_vTagC, colDescripW);
        const maxLines = Math.max(cLines.length, dLines.length, 1);
        const rowH = maxLines * 4 + 1.5;
        asegurarEspacioConceptos(rowH);
        // A petición expresa: CONCEPTO también justificado (sin sangría) cuando
        // ocupa varias líneas — igual que DESCRIPCIÓN abajo, jsPDF nunca
        // justifica la última línea, así que un concepto corto (1 línea) no cambia.
        doc.text(c.concepto||'', margin, y, {maxWidth: colConceptoW, align: 'justify'});
        // A petición expresa: DESCRIPCIÓN se justifica (ambos márgenes parejos)
        // en vez de ragged-right. Se pasa el texto completo (no el arreglo ya
        // partido dLines) con maxWidth — jsPDF usa el MISMO algoritmo de
        // partición por dentro, así que el número de líneas real coincide
        // exactamente con dLines.length (usado arriba para rowH/maxLines) —
        // verificado con casos de 0, 1 y varias líneas. La última línea de
        // cada párrafo queda alineada a la izquierda automáticamente (jsPDF
        // nunca estira la última línea), como es tipográficamente correcto.
        doc.text((c.descripcion||'')+_vTagC, margin+cW*0.38, y, {maxWidth: colDescripW, align: 'justify'});
        doc.text('$'+fmtMXN(p), margin+cW, y, {align:'right'});
        doc.setDrawColor(_esCancelacion?200:220,_esCancelacion?200:195,_esCancelacion?195:140); doc.setLineWidth(0.3);
        // FIX (líneas "tachando" texto — caso real: folio 63A, filas con 2-3
        // líneas de CONCEPTO pero 1 sola de DESCRIPCIÓN): -1.2mm de holgura no
        // alcanza a despejar el ascent (~2.15mm a 8pt) de la primera línea del
        // renglón siguiente — la línea quedaba dentro de su altura de capital.
        // -2.8mm despeja ese ascent con margen; sigue sobrando espacio respecto
        // al propio texto de este renglón (verificado con jsPDF+pdftoppm).
        doc.line(margin, y+rowH-2.8, margin+cW, y+rowH-2.8);
        // Recibo de cancelación: tachar cada línea del concepto/descripción/costo —
        // el trámite quedó sin efecto, el desglose real vive en el cuadro de totales.
        if(_esCancelacion){
          doc.setDrawColor(150,150,145); doc.setLineWidth(0.3);
          cLines.forEach(function(_ln,_i){
            const _twL = doc.getStringUnitWidth(_ln)*8/doc.internal.scaleFactor;
            doc.line(margin, y+_i*4-1.2, margin+_twL, y+_i*4-1.2);
          });
          const _twP = doc.getStringUnitWidth('$'+fmtMXN(p))*8/doc.internal.scaleFactor;
          doc.line(margin+cW-_twP, y-1.2, margin+cW, y-1.2);
        }
        y += rowH;
      }
    });
    // ── SUMA TOTAL DEL TRÁMITE (2+ conceptos, SOLO folio A) ─────────────────
    // Misma lógica que "SUMA TOTAL DE ADEUDOS" en Servicio Complementario más
    // abajo: cuando el trámite se desglosa en varias líneas (ej. folio 63A con
    // 3 conceptos: $5,000 + $30,000 + $53,000), se agrega un renglón con la
    // suma para que no haya que sumarlas a mano. Con un solo concepto no hace
    // falta (ya es el total). Se omite en cancelación — ahí el total real vive
    // en el cuadro de totales, no en esta tabla tachada. A petición expresa:
    // JAMÁS en recibos B, C, D… (solo el folio A original desglosa el pacto
    // completo en varios conceptos; las versiones posteriores solo agregan
    // servicios complementarios, que ya tienen su propia suma aparte).
    const _esLetraA_SumaTotal = (datos.letra || 'A').toUpperCase() === 'A';
    if(_nConceptosTabla > 1 && !_esCancelacion && _esLetraA_SumaTotal){
      asegurarEspacioConceptos(6);
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(154,110,24);
      doc.text('SUMA TOTAL DEL TRÁMITE', margin, y+2.5);
      doc.text('$'+fmtMXN(_totalConceptosTabla), margin+cW, y+2.5, {align:'right'});
      doc.setDrawColor(180,140,40); doc.setLineWidth(0.4);
      doc.line(margin, y+3.8, margin+cW, y+3.8);
      y += 6;
    }
    }
  } else if(_saldoAnteriorSC > 0){
    // ── SALDO PENDIENTE (Sin Costo Total Pactado) ───────────────────────────
    // A petición expresa: se unifica con el mismo formato que Costo Pactado —
    // un solo renglón "SALDO PENDIENTE:" (CONCEPTO / SALDO PENDIENTE, sin
    // DESCRIPCIÓN) en vez del desglose itemizado por cada Servicio
    // Complementario previo. El CONCEPTO es siempre el del folio A (permanente)
    // y el monto es la suma total de lo que aún no se cubre (_saldoAnteriorSC).
    _dibujarEncabezadoSaldoPendiente(false, false);
    _dibujarFilaSaldoPendiente(_conceptoFolioAUnificado(), _saldoAnteriorSC, false);
  }
  // ── HISTORIAL DE PAGOS (solo en comprobante de abono) ──
  if(datos.folioAnterior && datos.historialPagosRef){
    const recOrig = (typeof appData!=='undefined' ? appData.recibos : []).find(r=>r.folio===datos.folioAnterior);
    y += 1;
    doc.setFillColor(232,245,224); doc.rect(margin,y-3,cW,5,'F');
    doc.setTextColor(42,122,58); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text('HISTORIAL DE PAGOS',margin+1,y); y+=3;
    // Línea de encabezado
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
    const fechaOrigFmt = fechaOrig ? new Date(fechaOrig+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '—';
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
      doc.text(h.folio ? folioFormato(h.folio, h.anio_folio) : '—', margin+colW[0], y);
      doc.text(fh, margin+colW[0]+colW[1], y);
      doc.text('$'+fmtMXN(parseFloat(h.pago)||0), margin+cW, y, {align:'right'});
      doc.setDrawColor(210,230,210); doc.line(margin,y+1.5,margin+cW,y+1.5); y+=4;
    });
    // Este comprobante (resaltado)
    const montoEste = parseFloat(datos.anticipo)||0;
    const fechaEste = datos.fecha_recibo ? new Date(datos.fecha_recibo+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '—';
    doc.setFillColor(42,122,58); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
    doc.rect(margin, y-2.5, cW, 6, 'F');
    doc.text('Abono ← este doc.', margin+1, y+1);
    doc.text(folioFormato(folio), margin+colW[0]+1, y+1);
    doc.text(fechaEste, margin+colW[0]+colW[1]+1, y+1);
    doc.text('$'+fmtMXN(montoEste), margin+cW-1, y+1, {align:'right'});
    doc.setTextColor(20,10,5); doc.setFont('helvetica','normal');
    y += 8;
    // Línea separadora
    doc.setDrawColor(42,122,58); doc.setLineWidth(0.5); doc.line(margin,y,margin+cW,y); y+=2;
  }
  // ── SERVICIO COMPLEMENTARIO (si hay) ──
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
        doc.text('SERVICIO COMPLEMENTARIO (continuaci\u00f3n)',margin+1,y); y+=2.5;
      }
    }
    doc.setFillColor(255,240,220); doc.rect(margin,y-3,cW,5,'F');
    doc.setTextColor(160,80,16); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text('SERVICIO COMPLEMENTARIO',margin+1,y); y+=2.5;
    datos.costosExtra.forEach(c=>{
      const p=parseFloat(c.precio)||0;
      // Todos los costos extra siempre suman al total
      totalCostosExtra+=p; total+=p;
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
      const cLines = doc.splitTextToSize(c.concepto||'', colConceptoW);
      const _vTagCE = '['+folioConLetra(folio, datos.anio_folio, c.folioLetra||datos.letra||'A')+(c.fechaHora?' '+_fmtFHDesdeTexto(c.fechaHora):'')+']';
      const dLines = doc.splitTextToSize((c.descripcion ? c.descripcion+' ' : '')+_vTagCE, colDescripW);
      const maxLines = Math.max(cLines.length, dLines.length, 1);
      const rowH = maxLines * 3.6 + 1.2;
      asegurarEspacioCE(rowH);
      // A petición expresa: CONCEPTO también justificado (sin sangría) cuando
      // ocupa varias líneas — un concepto de una sola línea no cambia.
      doc.text(c.concepto||'', margin, y, {maxWidth: colConceptoW, align: 'justify'});
      doc.setFontSize(7); doc.setTextColor(80,60,30);
      // A petición expresa: DESCRIPCIÓN justificada, igual que en la tabla CONCEPTO.
      doc.text((c.descripcion ? c.descripcion+' ' : '')+_vTagCE, margin+cW*0.38, y, {maxWidth: colDescripW, align: 'justify'});
      doc.setFontSize(8); doc.setTextColor(20,10,5);
      doc.text('$'+fmtMXN(p), margin+cW, y, {align:'right'});
      doc.setDrawColor(220,180,120); doc.setLineWidth(0.2);
      // FIX (líneas "tachando" texto — mismo caso que tabla CONCEPTO): -1mm de
      // holgura no despeja el ascent del CONCEPTO del renglón siguiente.
      doc.line(margin, y+rowH-2.8, margin+cW, y+rowH-2.8);
      y += rowH;
    });
    if(_saldoAnteriorSC > 0 || _esRecCEDetalladoCP){
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(160,80,16);
      doc.text('SUMA TOTAL DE ADEUDOS', margin, y+2.5);
      doc.text('(incluye costo de este recibo)', margin, y+5.3);
      doc.setFontSize(7.5);
      // En Costo Pactado, "totalGeneral" ya incluye el costo base del trámite
      // (tabla CONCEPTO) más todo costosExtra bloqueado — por eso se usa
      // _saldoAnteriorResumen_CP directamente (misma fuente de verdad que el
      // cuadro final), en vez de sumar aparte (evita doble conteo).
      const _sumaTotalAdeudosMostrar = _esRecCEDetalladoCP ? _saldoAnteriorResumen_CP : (_saldoAnteriorSC + totalCostosExtra);
      doc.text('$'+fmtMXN(_sumaTotalAdeudosMostrar), margin+cW, y+2.5, {align:'right'});
      doc.setDrawColor(200,140,60); doc.setLineWidth(0.3); doc.line(margin,y+6.5,margin+cW,y+6.5);
      y += 9.5;
    }
    // ── "PAGOS REALIZADOS" quitado a petición expresa (redundante con el
    // cuadro final TOTAL/ABONADO/RESTA, que ya muestra el abono de esta
    // transacción) — solo queda "SUMA TOTAL DE ADEUDOS" arriba.
  }
  // ── PAGO REGISTRADO EN ESTE RECIBO — ELIMINADA a petición expresa ───────
  // (para todos los recibos, letra A y posteriores B/C/D): en la práctica
  // era confusa para el cliente. Ya no se imprime nada aquí; el cuadro de
  // totales de más abajo sigue mostrando el monto abonado.
  // Se conserva SOLO el cálculo de totalPagosParciales aquí abajo, porque el
  // cuadro de totales de más abajo depende de esta suma.
  let totalPagosParciales = 0;
  (datos.pagosParciales||[]).forEach(function(p){
    totalPagosParciales += parseFloat(p.cantidad)||0;
  });
  // Totales (usa valores recalculados si vienen del modo actualización)
  const anticipo=parseFloat(datos.anticipo)||0;
  const totalGeneral = (datos.totalGeneral !== undefined) ? datos.totalGeneral : total;
  // ── FIX RAÍZ: la versión A (recibo original) NUNCA debe leer
  // saldoNuevo/saldoPendiente/totalAbonado guardados — esos campos reflejan
  // el estado VIVO/ACTUAL del folio completo, que cambia conforme se abonan
  // versiones posteriores (B, C…). La impresión de A debe mostrar SIEMPRE su
  // propio estado histórico: lo único pagado en ese momento fue el anticipo.
  // Sin este fix, cada regeneración masiva volvía a mostrar "PAGADO" en el
  // recibo original aunque solo se hubiera dado un anticipo parcial (folios
  // 1A, 4A y otros) — el parche anterior vivía en un script aparte, no aquí
  // en generarPDF(), así que la siguiente regeneración lo revertía.
  const _esVersionA = (datos.letra||'A').toUpperCase() === 'A';
  let saldoFinal, totalAbonado;
  if(_esVersionA){
    totalAbonado = anticipo;
    saldoFinal = Math.max(0, totalGeneral - anticipo);
  } else {
    // Calcular totalAbonado real:
    // totalPagosParciales solo suma el array pagosParciales (abonos).
    // El anticipo inicial se muestra por separado — sumarlo aquí para el total abonado correcto.
    const _anticipoEnTotal = anticipo;
    const totalAbonado_raw = datos.totalAbonado !== undefined ? parseFloat(datos.totalAbonado)||0 : _anticipoEnTotal;
    const abonadoCalculado = totalPagosParciales > 0
      ? totalPagosParciales + _anticipoEnTotal
      : (totalAbonado_raw > 0 ? totalAbonado_raw : _anticipoEnTotal);
    // saldoFinal: prioridad → datos.saldoNuevo → saldoPendiente guardado → cálculo desde abonado
    saldoFinal = (datos.saldoNuevo !== undefined && datos.saldoNuevo !== null)
      ? parseFloat(datos.saldoNuevo)
      : (datos.saldoPendiente !== undefined && datos.saldoPendiente !== null
          ? parseFloat(datos.saldoPendiente)
          : Math.max(0, totalGeneral - abonadoCalculado));
    // totalAbonado final — siempre coherente con saldoFinal
    totalAbonado = Math.max(0, totalGeneral - saldoFinal);
  }
  // Si el cuadro de totales (alto ~22mm) + QR + firmas (~38mm) no cabe, ir a página 2
  if(y + 62 > 262){
    doc.addPage();
    y = 18;
  }
  // ── RECIBO DE CANCELACIÓN: cuadro de totales especial ──
  // El trámite quedó sin efecto, así que TOTAL/PAGO RECIBIDO/SALDO RESTANTE
  // (o TOTAL/ABONADO/RESTA) ya no tienen sentido — quedarían en $0.00 sin
  // explicar por qué. En su lugar se muestra el cálculo real del cierre: lo
  // que se había recibido, lo que el despacho retiene por gestiones ya
  // realizadas, y lo que efectivamente se reintegra al cliente (o, si el
  // saldo fue a favor del despacho / sin movimiento, la variante correspondiente).
  const _canTipo  = datos.cancelacionTipo || '';
  const _canMonto = parseFloat(datos.cancelacionMonto||0);
  function _dibujarCajaCancelacion(yBox){
    if(qrDataURL){ try{doc.addImage(qrDataURL,'PNG',margin,yBox,18,18);}catch(e){ registrarError('catch vacio', e); } }
    doc.setFillColor(255,255,255); doc.rect(margin+cW-62,yBox,62,22,'F');
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.rect(margin+cW-62,yBox,62,22);
    doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,80,40);
    if(_canTipo==='ingreso'){
      // Cancelación con cargo a favor del despacho (honorarios): NO se arrastra
      // ningún saldo anterior — el anticipo ya se cobró y liquidó aparte. El
      // único monto en juego es el cargo que genera la propia cancelación, así
      // que CARGO DE CANCEL. y TOTAL A PAGAR son el mismo importe.
      doc.text('CARGO DE CANCEL.:',margin+cW-60,yBox+9);
      doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
      doc.text('TOTAL A PAGAR:',margin+cW-60,yBox+17);
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(139,90,43);
      doc.text('+$'+fmtMXN(_canMonto),margin+cW-1.5,yBox+9,{align:'right'});
      doc.setFontSize(12); doc.setTextColor(176,30,30);
      doc.text('$'+fmtMXN(_canMonto),margin+cW-1.5,yBox+17.5,{align:'right'});
    } else if(_canTipo==='sin_movimiento'){
      // Sin movimiento económico: el anticipo recibido se consumió íntegro en
      // gastos/gestiones ya realizadas — no hay reintegro ni cobro adicional,
      // quedan a mano. Se muestra el anticipo contra el gasto que lo absorbe
      // para que el $0.00 final se entienda (no es un dato faltante).
      doc.text('ANTICIPO RECIBIDO:',margin+cW-60,yBox+5);
      doc.text('GASTOS DEL TRÁMITE:',margin+cW-60,yBox+11);
      doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
      doc.text('SALDO:',margin+cW-60,yBox+18);
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(20,10,5);
      doc.text('$'+fmtMXN(totalAbonado),margin+cW-1.5,yBox+5,{align:'right'});
      doc.setTextColor(139,90,43);
      doc.text('-$'+fmtMXN(totalAbonado),margin+cW-1.5,yBox+11,{align:'right'});
      doc.setFontSize(11.5); doc.setTextColor(42,122,58);
      doc.text('$0.00',margin+cW-1.5,yBox+18.5,{align:'right'});
    } else {
      // egreso — el caso más común: reintegro al cliente
      const _retencion = Math.max(0, totalAbonado - _canMonto);
      doc.text('ANTICIPO RECIBIDO:',margin+cW-60,yBox+5);
      doc.text('RETENCIÓN ADMIN.:',margin+cW-60,yBox+11);
      doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
      doc.text('REINTEGRO CLIENTE:',margin+cW-60,yBox+18);
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(20,10,5);
      doc.text('$'+fmtMXN(totalAbonado),margin+cW-1.5,yBox+5,{align:'right'});
      doc.setTextColor(139,90,43);
      doc.text('-$'+fmtMXN(_retencion),margin+cW-1.5,yBox+11,{align:'right'});
      doc.setFontSize(11.5); doc.setTextColor(176,30,30);
      doc.text('$'+fmtMXN(_canMonto),margin+cW-1.5,yBox+18.5,{align:'right'});
    }
  }
  // ── RESUMEN DE PAGO (solo en versiones B+ que NO son Sin Costo Total Pactado:
  // liquidación o abono parcial normal, que sí arrastra saldo anterior) ──
  if(_esUpdate && !_esAbiertoPDF){
    // Los números (_saldoAnteriorResumen_CP / _pagoEstaVersion_CP /
    // _saldoRestante_CP) ya se calcularon arriba, al inicio de la función —
    // misma fuente de verdad que usa también el bloque "SUMA TOTAL DE
    // ADEUDOS / PAGOS REALIZADOS" (ver sección de Servicio Complementario).
    // Verificar espacio
    if(y + 25 > 262){ doc.addPage(); y = 18; }
    // QR + cuadro resumen al mismo nivel que versión A
    y += 0.5;
    if(_esCancelacion){
      _dibujarCajaCancelacion(y);
      y += 24;
    } else {
    if(qrDataURL){ try{doc.addImage(qrDataURL,'PNG',margin,y,18,18);}catch(e){ registrarError('catch vacio', e); } }
    // Cuadro pequeño idéntico al de versión A — solo borde, fondo blanco
    doc.setFillColor(255,255,255); doc.rect(margin+cW-62,y,62,22,'F');
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.rect(margin+cW-62,y,62,22);
    // Cuando esta versión es un recibo de Servicio Complementario (_esRecCEDetalladoCP),
    // las etiquetas del cuadro pasan a TOTAL/ABONADO/RESTA (igual que el modo Sin
    // Costo Total Pactado) para que sea consistente con el desglose de "SUMA TOTAL
    // DE ADEUDOS" y "PAGOS REALIZADOS" que ya se imprimió arriba. En un recibo de
    // abono/liquidación normal (sin cargo nuevo) se mantienen las etiquetas de
    // siempre (SALDO ANTERIOR/PAGO RECIBIDO/SALDO RESTANTE).
    const _sinDeudaPreviaPDF = (_saldoAnteriorResumen_CP || 0) <= 0;
    const _labelSaldoPrev = _esRecCEDetalladoCP
      ? 'TOTAL:'
      : (_sinDeudaPreviaPDF ? 'TOTAL:' : 'ADEUDO:');
    const _labelPagoRecibido = 'PAGO RECIBIDO:';
    const _labelSaldoRestante = 'RESTA:';
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,80,40);
    doc.text(_labelSaldoPrev,margin+cW-60,y+5);
    doc.text(_labelPagoRecibido,margin+cW-60,y+11);
    doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
    doc.text(_labelSaldoRestante,margin+cW-60,y+18);
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(20,10,5);
    doc.text('$'+fmtMXN(_saldoAnteriorResumen_CP),margin+cW-1.5,y+5,{align:'right'});
    doc.setTextColor(139,90,43);
    doc.text('$'+fmtMXN(_pagoEstaVersion_CP),margin+cW-1.5,y+11,{align:'right'});
    doc.setFontSize(11.5); doc.setTextColor(42,122,58);
    doc.text('$'+fmtMXN(_saldoRestante_CP),margin+cW-1.5,y+18.5,{align:'right'});
    y += 24;
    }
  }
  // ── SIN COSTO TOTAL PACTADO en versión B+: recibo independiente por transacción ──
  // Si HAY un cargo real (adeudo anterior sin liquidar, o un Servicio Complementario
  // nuevo en este recibo): TOTAL = adeudo anterior + cargo nuevo, ABONADO = lo pagado
  // en ESTA transacción, RESTA = lo que sigue faltando de ESE cargo específico.
  // Si NO hay ningún cargo real (abono suelto, sin relación a ningún servicio): el
  // recibo es completamente independiente — TOTAL = ABONADO = lo entregado, RESTA $0.00.
  if(_esUpdate && _esAbiertoPDF){
    const _totalCajaSC  = _hayCargoRealSC ? _totalConAdeudoSC : _totalPagosParcialesPreSC;
    const _abonoCajaSC  = _totalPagosParcialesPreSC;
    const _restaCajaSC  = _hayCargoRealSC ? _restaTransSC : 0;
    if(y + 25 > 262){ doc.addPage(); y = 18; }
    y += 0.5;
    if(_esCancelacion){
      _dibujarCajaCancelacion(y);
      y += 24;
    } else {
    if(qrDataURL){ try{doc.addImage(qrDataURL,'PNG',margin,y,18,18);}catch(e){ registrarError('catch vacio', e); } }
    doc.setFillColor(255,255,255); doc.rect(margin+cW-62,y,62,22,'F');
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.rect(margin+cW-62,y,62,22);
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,80,40);
    doc.text('TOTAL:',margin+cW-60,y+5);
    // A petición expresa: en Servicio Complementario (_tieneCE) esta etiqueta
    // dice "PAGO RECIBIDO:" (igual que el cuadro equivalente de Costo Pactado,
    // _labelPagoRecibido más arriba). Los abonos sueltos sin CE conservan "ABONADO:".
    doc.text(_tieneCE ? 'PAGO RECIBIDO:' : 'ABONADO:',margin+cW-60,y+11);
    doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
    doc.text('RESTA:',margin+cW-60,y+18);
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(20,10,5);
    doc.text('$'+fmtMXN(_totalCajaSC),margin+cW-1.5,y+5,{align:'right'});
    doc.text('$'+fmtMXN(_abonoCajaSC),margin+cW-1.5,y+11,{align:'right'});
    doc.setFontSize(11.5); doc.setTextColor(_restaCajaSC>0?154:42, _restaCajaSC>0?110:122, _restaCajaSC>0?24:58);
    doc.text('$'+fmtMXN(_restaCajaSC),margin+cW-1.5,y+18.5,{align:'right'});
    y += 24;
    }
  }
  y += 0.5;
  // QR + cuadro TOTAL/ANTICIPO/RESTA — solo versión A (primaria). A petición
  // expresa, la etiqueta de la segunda línea pasó de "ABONADO" a "ANTICIPO"
  // (solo en el folio A original — los recibos posteriores B/C/D conservan
  // sus propias etiquetas, ver los otros dos cuadros de totales arriba).
  if(!_esUpdate){
    if(qrDataURL){ try{doc.addImage(qrDataURL,'PNG',margin,y,18,18);}catch(e){ registrarError('catch vacio', e); } }
    doc.setFillColor(255,255,255); doc.rect(margin+cW-62,y,62,22,'F');
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.rect(margin+cW-62,y,62,22);
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,80,40);
    doc.text('TOTAL:',margin+cW-60,y+5);
    doc.text('ANTICIPO:',margin+cW-60,y+11);
    doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
    doc.text('RESTA:',margin+cW-60,y+18);
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(20,10,5);
    doc.text('$'+fmtMXN(totalGeneral),margin+cW-1.5,y+5,{align:'right'});
    doc.text('$'+fmtMXN(totalAbonado),margin+cW-1.5,y+11,{align:'right'});
    doc.setFontSize(11.5); doc.setTextColor(saldoFinal>0?154:42, saldoFinal>0?110:122, saldoFinal>0?24:58);
    doc.text('$'+fmtMXN(Math.max(0,saldoFinal)),margin+cW-1.5,y+18.5,{align:'right'});
    y += 24;
  }
  // Historial de pagos (si hay folio anterior)
  if(datos.folioAnterior && datos.historialPagosRef && datos.historialPagosRef.length){
    y+=2;
    doc.setFillColor(248,244,232); doc.rect(margin,y-3.5,cW,5,'F');
    doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text('HISTORIAL DE PAGOS — Ref. Folio #'+folioFormato(datos.folioAnterior),margin+1,y); y+=4;
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
      doc.text(h.fecha||'—',hx,y); hx+=hCols[1];
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
  // ── TEXTO DE CONFORMIDAD ──
  const _mesesPDF = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  // Fecha del texto de conformidad: en actualizaciones (B, C, D…) usa la fecha de
  // ESTA versión (misma fuente que el encabezado), no la del recibo original.
  const _fechaConf = (_esUpdate && _fpPrincipal && _fpPrincipal.fecha)
    ? _fpPrincipal.fecha
    : (datos.fecha_recibo || new Date().toISOString().slice(0,10));
  const _dConf = _fechaConf.split('-');
  const _textoConf = 'Leído que fue el presente documento y enterado de su contenido y alcance legal, lo firman por duplicado de conformidad en Santiago Juxtlahuaca, Oaxaca, a los ' + parseInt(_dConf[2],10) + ' días del mes de ' + _mesesPDF[parseInt(_dConf[1],10)-1] + ' de ' + _dConf[0] + '.';
  doc.setFontSize(7); doc.setFont('helvetica','bolditalic'); doc.setTextColor(60,45,20);
  // Estimación de líneas solo para el salto de página (el layout real usa
  // _pdfParrafoJustificado, que además respeta el margen de impresión —
  // antes se dibujaba desplazado a "margin+4" pero envuelto al ancho
  // completo "cW" sin descontar ese desplazamiento, por lo que el texto
  // se salía del área imprimible por la derecha).
  const _confLines = doc.splitTextToSize(_textoConf, cW);
  // Verificar espacio
  if(y + _confLines.length * 3.2 + 14 > 262){ doc.addPage(); y = 18; }
  y = _pdfParrafoJustificado(_textoConf, margin, y, cW, { sangria: 6, lineHeight: 3.2 }) + 5;
  doc.line(fS,y+8,fS+fw,y+8); doc.line(fS+fw+14,y+8,fS+fw*2+14,y+8);
  // ── Determinar si autorizador es la MISMA persona que el responsable ──
  let mismaPersona = false;
  if(datos.autorizacion && datos.autorizacion.nombre){
    const limpiar = (s)=>String(s||'').toUpperCase()
      .replace(/\b(LIC\.?|LICENCIADO|LICENCIADA|MTRO\.?|MTRA\.?|DR\.?|DRA\.?|ING\.?|ARQ\.?|C\.?|SR\.?|SRA\.?|SRTA\.?)\b/g,'')
      .replace(/\s+/g,' ').trim();
    mismaPersona = (limpiar(datos.responsable) === limpiar(datos.autorizacion.nombre));
  }
  // Si es la MISMA persona: poner "AUTORIZÓ" arriba del nombre del responsable
  if(mismaPersona){
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(154,110,24);
    doc.text('AUTORIZÓ', fS+fw/2, y+5, {align:'center'});
  }
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(40,30,15);
  doc.text((datos.responsable||'Responsable del Trámite').toUpperCase(),fS+fw/2,y+12,{align:'center'});
  doc.text('C. '+(datos.nombre_cliente_firma||(datos.clientes[0]?.nombre)||'Cliente'),fS+fw+14+fw/2,y+12,{align:'center'});
  doc.setFontSize(6); doc.setTextColor(120,100,60);
  doc.text('Responsable del trámite',fS+fw/2,y+15.5,{align:'center'});
  doc.text('Cliente',fS+fw+14+fw/2,y+15.5,{align:'center'});
  // ── AUTORIZADOR — solo si es DISTINTO al responsable: dibujar firma adicional debajo ──
  if(datos.autorizacion && datos.autorizacion.nombre && !mismaPersona){
    const yAuth = y + 20;
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(154,110,24);
    doc.text('AUTORIZÓ', fS+fw/2, yAuth, {align:'center'});
    // Línea de firma
    doc.setDrawColor(80,65,40); doc.setLineWidth(0.3);
    doc.line(fS, yAuth+6, fS+fw, yAuth+6);
    // Nombre del autorizador (con "Lic." y mayúsculas para consistencia con el responsable)
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(40,30,15);
    doc.text(String(datos.autorizacion.nombre).toUpperCase(), fS+fw/2, yAuth+10, {align:'center'});
    doc.setFontSize(6); doc.setTextColor(120,100,60);
    doc.text('Firma de quien autorizó la actualización', fS+fw/2, yAuth+13.5, {align:'center'});
    y += 14; // empujar el resto del contenido (placas, etc.) hacia abajo
  }
  // ── PLACAS GENERADAS — línea simple sin cuadro, pegada encima del footer ──
  if(datos.placasEntregadas){
    // Posicionar justo encima del footer (línea en 271, footer en 275)
    const placasY = 264;
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.3);
    doc.line(margin, placasY-1, margin+cW, placasY-1);
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(20,100,40);
    const placasLabel = 'PLACAS GENERADAS EN EL TRÁMITE:  N°: ' + String(datos.placasEntregadas) +
      (datos.estadoPlacas ? '   Estado: ' + String(datos.estadoPlacas) : '');
    doc.text(placasLabel, margin, placasY+3);
  }
  // ── NOTA DE CANCELACIÓN ──
  if(datos.cancelado){
    const fechaCan = datos.fechaCancelacion
      ? new Date(datos.fechaCancelacion).toLocaleString('es-MX',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})
      : '';
    // Motivo sin la parte de autorización (quitar desde " — Autorizó:")
    const motivoCompleto = datos.motivoCancelacion || 'Sin motivo especificado';
    const motivo = motivoCompleto.split(' — Autoriz')[0].trim();
    // Concepto de liquidación (ingreso/egreso/sin movimiento)
    const tipoCan = datos.cancelacionTipo || '';
    const montoCan = parseFloat(datos.cancelacionMonto || 0);
    const conceptoCan = tipoCan==='ingreso'
      ? 'Honorarios por cancelación'
      : tipoCan==='egreso'
      ? 'Reintegro por cancelación'
      : tipoCan==='sin_movimiento' ? 'Cancelación sin movimiento económico' : '';
    const montoCanStr = montoCan > 0
      ? (tipoCan==='egreso' ? '  EGRESO: -$' : '  INGRESO: +$') + montoCan.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')
      : (tipoCan==='sin_movimiento' ? '  Sin movimiento económico' : '');

    // Calcular altura del box según contenido real
    doc.setFontSize(6.8);
    const motivoLines = doc.splitTextToSize('Motivo: '+motivo, cW-12);
    const nLineas = motivoLines.length;
    const lineH = 4.5;
    const boxY = y + 24;
    const boxH = 7 + 5.5 + 5 + (nLineas * lineH) + (conceptoCan ? 9 : 2);

    doc.setDrawColor(180,40,40); doc.setLineWidth(0.5);
    doc.rect(margin, boxY, cW, boxH, 'D');

    // Título
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(160,20,20);
    doc.text('TRÁMITE CANCELADO', margin+4, boxY+6);

    // Fecha
    doc.setFont('helvetica','normal'); doc.setFontSize(6.8); doc.setTextColor(100,20,20);
    let _ly = boxY + 12;
    if(fechaCan){ doc.text('Fecha de cancelación: '+fechaCan, margin+4, _ly); _ly += lineH + 1; }

    // Motivo completo — todas las líneas
    motivoLines.forEach(function(ln){ doc.text(ln, margin+4, _ly); _ly += lineH; });

    // Concepto ingreso/egreso/sin movimiento — debajo del motivo con separación
    if(conceptoCan){
      _ly += 2;
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(80,20,20);
      // Concepto a la izquierda, monto a la derecha
      doc.text(conceptoCan, margin+4, _ly);
      if(montoCanStr.trim()) doc.text(montoCanStr.trim(), margin+cW-4, _ly, {align:'right'});
    }
  }
  // Footer — aplicar a TODAS las páginas (en caso de salto por muchos abonos)
  const totalPaginas = doc.internal.getNumberOfPages();
  for(let pg = 1; pg <= totalPaginas; pg++){
    doc.setPage(pg);
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.line(margin,271,pageW-margin,271);
    doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','normal');
    doc.text('LEX-MÉXICO DESPACHO JURÍDICO · CALLE MIGUEL HIDALGO ESQ. MÉXICO NO. 200, LOCAL B · TEL: 953 128 7511',pageW/2,275,{align:'center'});
    if(totalPaginas > 1){
      doc.setFontSize(6); doc.setTextColor(120,100,60);
      doc.text('P\u00e1gina '+pg+' de '+totalPaginas, pageW-margin, 278, {align:'right'});
    }
  }
  doc.setPage(totalPaginas);
  // ── MARCA DE AGUA ──
  // PAGADO: cuando saldo final es 0. Reutiliza el mismo `saldoFinal` ya
  // calculado arriba (letra A = solo anticipo, nunca el saldo vivo del
  // folio completo) — una sola fuente de verdad, no una copia que se pueda
  // desincronizar.
  // FIX (caso real: folio 56C): en Sin Costo Pactado, `saldoFinal` (arriba)
  // prioriza datos.saldoNuevo/datos.saldoPendiente guardados, los mismos
  // campos que en otras partes del código ya se documentaron como poco
  // confiables (pueden quedar desincronizados del PDF real). El cuerpo del
  // recibo SÍ usa el cálculo recalculado y correcto (_restaTransSC) para
  // mostrar la RESTA — así que el sello PAGADO debe usar esa MISMA fuente,
  // no el campo guardado, para no contradecir lo que el propio PDF muestra.
  if(_esAbiertoPDF && _esUpdate){
    saldoFinal = _restaTransSC;
  }
  if(saldoFinal <= 0 && (parseFloat(datos.totalGeneral||datos.total||0)) > 0){
    dibujarMarcaAgua(doc, 'PAGADO', [30, 140, 60]);
  }
  // CANCELADO: si se pasa el flag
  if(datos.cancelado){
    dibujarMarcaAgua(doc, 'CANCELADO', [120, 120, 120]);
  }
  return doc;
}
// ── FOLIO ANTERIOR — HISTORIAL DE PAGOS ─────────────────────────
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
    hist.push({ folio:r.folio, fecha:r.fecha, tipo: r.saldoPendiente<=0?'Liquidación':'Abono',
      pago: r.pago||0, saldo: r.saldoPendiente });
  });
  return hist;
}
// Referencia al recibo en modo consulta
reciboEnConsulta = null;
// ── Buscar recibo por número de expediente (CARP.- 1) ─────────────────────
function cargarHistorialExpediente(){
  const raw = ($('expediente_buscar')||{}).value || '';
  // Los paneles antiguos (chips + tabla de historial) fueron reemplazados por
  // la Ficha del Folio (ver cargarHistorialFolio) — se mantienen ocultos siempre.
  const infoBox = document.getElementById('info-folio-anterior');
  const histDiv  = document.getElementById('historial-pagos-prev');
  if(infoBox) infoBox.style.display='none';
  if(histDiv) histDiv.style.display='none';
  if(!raw.trim()){
    salirModoConsulta();
    return;
  }
  // Limpiar campo de folio para no tener dos búsquedas activas
  const folioInp = document.getElementById('folio_anterior');
  if(folioInp) folioInp.value='';
  // Buscar en appData.recibos el campo expedienteNum
  const q = raw.trim().toUpperCase();
  const recibo = appData.recibos.find(r => r.expedienteNum && r.expedienteNum.toUpperCase() === q && !r.esComplemento);
  if(!recibo){
    if(typeof toast==='function') toast('⚠ Expediente '+q+' no encontrado en historial.', 'err');
    reciboEnConsulta = null;
    salirModoConsulta();
    return;
  }
  // Redirigir al folio para usar el flujo existente de visualización
  if(folioInp){ folioInp.value = recibo.folio; }
  // Vaciar campo expediente para no entrar en loop
  if($('expediente_buscar')) $('expediente_buscar').value = q; // mantener visible para referencia
  cargarHistorialFolio();
}
// ── Debounce: espera 350ms desde el último teclazo antes de buscar ──
var _cargarHistFolioTimer = null;
function cargarHistorialFolioDebounce(){
  var v = parseInt((document.getElementById('folio_anterior')||{}).value||0)||0;
  clearTimeout(_cargarHistFolioTimer);
  if(!v){ cargarHistorialFolio(); return; } // limpiar inmediatamente
  _cargarHistFolioTimer = setTimeout(cargarHistorialFolio, 350);
}

// ── Token de cancelación para activarModoConsulta ──
// Cada llamada nueva incrementa el token; las llamadas viejas abortan cuando detectan discrepancia.
var _modoConsultaToken = 0;

function cargarHistorialFolio(){
  const val = parseInt(document.getElementById('folio_anterior').value)||null;
  // Los paneles antiguos (chips A/B/C + panel "Estado" + tabla de historial de
  // pagos) fueron reemplazados por la Ficha del Folio, que muestra la misma
  // información (y más) de forma correcta y unificada para cualquier tipo de
  // trámite. Se mantienen ocultos siempre; solo se activa Modo Consulta (recibo
  // + PDF) y se abre la Ficha del Folio encima.
  const infoBox = document.getElementById('info-folio-anterior');
  const histDiv  = document.getElementById('historial-pagos-prev');
  const chipsDiv = document.getElementById('folios-relacionados');
  if(infoBox) infoBox.style.display='none';
  if(histDiv) histDiv.style.display='none';
  if(chipsDiv) chipsDiv.style.display='none';
  // A petición expresa: al borrar todos los dígitos del campo, se debe
  // regresar a la pantalla inicial (modo captura), no quedarse mostrando la
  // última consulta. Antes esto NO cerraba la consulta porque salirModoConsulta()
  // reubicaba #folio_anterior de vuelta a su panel original y eso le quitaba
  // el foco al campo (no se podía seguir escribiendo un folio nuevo sin volver
  // a hacer clic). Ese problema de raíz ya se corrigió en _folioAnteriorSync()
  // (preserva el foco/cursor al mover el nodo entre paneles), así que ahora sí
  // es seguro volver a cerrar la consulta al vaciar el campo.
  if(!val){
    if(document.body.classList.contains('modo-consulta') && typeof salirModoConsulta==='function'){
      salirModoConsulta();
    }
    return;
  }
  // Buscar TODOS los recibos con ese número base (distintas letras: A, B, C...)
  const todosConFolio = (appData.recibos||[]).filter(r => r.folio===val && !r.esComplemento);
  // Ordenar siempre: A primero, última letra al final
  const ordenados = todosConFolio.slice().sort(function(a,b){
    const la = (a.letra||(typeof letraVersion==='function'?letraVersion(a):'A')||'A');
    const lb = (b.letra||(typeof letraVersion==='function'?letraVersion(b):'A')||'A');
    return la < lb ? -1 : la > lb ? 1 : 0;
  });
  // Usar el más reciente para activar Modo Consulta (igual que antes)
  const recibo = ordenados.length ? ordenados[ordenados.length-1] : null;
  if(!recibo){
    if(typeof toast==='function') toast('⚠ Folio #'+folioFormato(val)+' no encontrado en historial.', 'err');
    salirModoConsulta();
    return;
  }
  reciboEnConsulta = recibo;
  activarModoConsulta(recibo);
  // Abrir la Ficha del Folio encima de la consulta — pequeño delay para que el
  // formulario de consulta ya haya terminado de pintarse (mismo patrón usado en
  // el resto del código para evitar parpadeos al encadenar navegación + modal).
  setTimeout(function(){ if(typeof abrirFichaFolio==='function') abrirFichaFolio(); }, 200);
}
async function activarModoConsulta(recibo){
  // Token de cancelación: si el usuario cambia de folio mientras descarga, la llamada vieja aborta.
  const myToken = ++_modoConsultaToken;
  const iframe = document.getElementById('pdf-consulta-iframe');
  const _esJuicioAbierto = window._abiertoSinCosto(recibo);
  const saldo = parseFloat(recibo.saldoPendiente || 0); // saldo real siempre
  // Limpiar blob URL anterior si existe
  if(iframe._blobUrl){ try{ URL.revokeObjectURL(iframe._blobUrl); }catch(e){} iframe._blobUrl = null; }
  iframe.src = '';
  // ── Asignación robusta del PDF al visor ───────────────────────────────────
  // FIX (caso real 10-ago-2026, folio 114): al consultar un folio cuyo PDF YA
  // estaba en memoria (porque se vio antes en la misma sesión o se acababa de
  // imprimir), la asignación ocurría en el mismo instante en que se abren los
  // paneles de búsqueda — el iframe todavía medía 0 de alto, el visor de PDF
  // del navegador no pinta nada en ese estado y se quedaba en blanco SIN error
  // (por eso el estado decía "PDF cargado"). Al recargar la página el PDF se
  // descargaba de R2, y esa espera daba tiempo a que el panel terminara de
  // abrirse — de ahí que "recargando sí se veía".
  //
  // Ahora se espera a que el iframe tenga alto real antes de asignar el src, y
  // si aun así el visor no reporta haber cargado, se reasigna una vez para
  // forzar el repintado. Solo cambia CUÁNDO se asigna; el origen del PDF y toda
  // la cadena de respaldos siguen exactamente igual.
  function _asignarPdfAlVisor(src){
    var intentos = 0;
    function ponerlo(){
      if(myToken !== _modoConsultaToken) return;      // el usuario cambió de folio
      var alto = iframe.getBoundingClientRect().height;
      if(alto < 40 && intentos < 40){                 // aún sin espacio: reintentar (máx ~2s)
        intentos++;
        return setTimeout(ponerlo, 50);
      }
      iframe.src = src;
      // Verificación: si el visor no dispara "load", reasignar UNA vez.
      var cargo = false;
      iframe.addEventListener('load', function _ok(){ cargo = true; iframe.removeEventListener('load', _ok); }, { once:true });
      setTimeout(function(){
        if(cargo || myToken !== _modoConsultaToken) return;
        if(iframe._reintentoPdf) return;
        iframe._reintentoPdf = true;
        console.warn('[Visor PDF] Sin evento load — se reasigna para forzar repintado');
        iframe.src = src;
        setTimeout(function(){ iframe._reintentoPdf = false; }, 2000);
      }, 1500);
    }
    requestAnimationFrame(function(){ requestAnimationFrame(ponerlo); });
  }
  // Helper: convierte un data URI o blob a blob URL y lo pone en el iframe
  async function mostrarBlobEnIframe(src){
    try {
      const b64 = src.split(',')[1];
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
      const blob = new Blob([bytes],{type:'application/pdf'});
      const blobUrl = URL.createObjectURL(blob);
      if(myToken !== _modoConsultaToken){ try{URL.revokeObjectURL(blobUrl);}catch(e){} return; }
      iframe._blobUrl = blobUrl;
      // view=Fit (no FitH): ajusta la página COMPLETA (ancho y alto) dentro del
      // visor, para que el recibo se vea entero sin necesitar scroll.
      var _srcFinal = blobUrl + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH';
      window._fichaPdfDefaultSrc = _srcFinal; // referencia para restaurar al cerrar
      _asignarPdfAlVisor(_srcFinal);
    } catch(e) {
      if(myToken !== _modoConsultaToken) return;
      window._fichaPdfDefaultSrc = src;
      _asignarPdfAlVisor(src);
    }
  }
  // ── Pintar el layout de CONSULTA y sus datos DE INMEDIATO ──
  // (antes de descargar el PDF: evita el parpadeo del formulario de captura mientras carga)
  // Actualizar toolbar
  const folioStr = String(recibo.folio).padStart(4,'0');
  document.getElementById('pdf-folio-badge').textContent = 'FOLIO #' + folioStr;
  document.getElementById('pdf-toolbar-nombre').textContent = recibo.nombre || '—';
  const saldoBadge = document.getElementById('pdf-saldo-badge');
  if(recibo.cancelado){
    saldoBadge.textContent = '🚫 TRÁMITE CANCELADO';
    saldoBadge.style.color = '#999';
    saldoBadge.style.textDecoration = 'line-through';
  } else if(_esJuicioAbierto){
    saldoBadge.textContent = window._abLbl(recibo).curso;
    saldoBadge.style.color = '#1a3a70';
    saldoBadge.style.textDecoration = '';
  } else if(saldo > 0){
    saldoBadge.textContent = 'Saldo pendiente: $' + fmtMXN(saldo);
    saldoBadge.style.color = '#c0161a';
    saldoBadge.style.textDecoration = '';
  } else {
    saldoBadge.textContent = '✅ LIQUIDADO';
    saldoBadge.style.color = '#2a9a4a';
    saldoBadge.style.textDecoration = '';
  }
  // Actualizar folio display con el folio consultado (formato completo: año-número-letra)
  document.getElementById('folio-display').textContent = folioConLetra(recibo.folio, recibo.anio_folio, recibo.letra || 'A');
  // Actualizar banner
  const bannerTxt = document.getElementById('banner-saldo-txt');
  if(bannerTxt){
    if(recibo.cancelado){
      bannerTxt.textContent = '🚫 TRÁMITE CANCELADO';
      bannerTxt.style.color = '#aaa';
      bannerTxt.style.textDecoration = 'line-through';
    } else if(_esJuicioAbierto){
      bannerTxt.textContent = window._abLbl(recibo).cursoCap;
      bannerTxt.style.color = '#a0c4ff';
      bannerTxt.style.textDecoration = '';
    } else if(saldo > 0){
      bannerTxt.textContent = '⚠ Saldo: $' + fmtMXN(saldo);
      bannerTxt.style.color = '#ffccaa';
      bannerTxt.style.textDecoration = '';
    } else {
      bannerTxt.textContent = '✅ Liquidado';
      bannerTxt.style.color = '#aaffcc';
      bannerTxt.style.textDecoration = '';
    }
  }
  if(saldo <= 0 && !_esJuicioAbierto){
    document.body.classList.add('folio-liquidado');
  } else {
    document.body.classList.remove('folio-liquidado');
  }
  // Si el recibo está cancelado: ocultar botones de pago y anular
  if(recibo.cancelado){
    document.body.classList.add('folio-cancelado');
  } else {
    document.body.classList.remove('folio-cancelado');
  }
  document.body.classList.add('modo-consulta');
  // Abrir los paneles si están cerrados para que el usuario vea el folio consultado
  if(!_panelesBusquedaAbiertos) togglePanelesBusqueda();
  if(recibo.pdfBase64 && recibo.pdfBase64.startsWith('data:application/pdf')){
    // Sesión actual: ya tenemos el PDF en memoria (validado como PDF real)
    await mostrarBlobEnIframe(recibo.pdfBase64);
    if(myToken !== _modoConsultaToken) return;
  } else if(recibo.archivo && window.SB_DESPACHO_ID){
    // Nueva sesión: recuperación robusta y validada
    // (R2 directo → listado del bucket → Supabase Storage → versiones_recibo), todo con %PDF.
    let _cargado = false;
    setStatus('loading','Cargando PDF…','loading');
    try{
      const _blob = await window.obtenerBlobPdfReciboValidado(recibo, function(){ return myToken !== _modoConsultaToken; });
      if(myToken !== _modoConsultaToken) return;
      if(_blob && _blob.size > 0){
        const _url = URL.createObjectURL(_blob);
        if(myToken !== _modoConsultaToken){ try{URL.revokeObjectURL(_url);}catch(e){} return; }
        iframe._blobUrl = _url;
        const _srcR2 = _url + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH';
        window._fichaPdfDefaultSrc = _srcR2; // referencia para restaurar al cerrar
        _asignarPdfAlVisor(_srcR2);
        const _rd = new FileReader();
        _rd.onload = () => { recibo.pdfBase64 = _rd.result; };
        _rd.readAsDataURL(_blob);
        setStatus('ok','PDF cargado','ok');
        _cargado = true;
      }
    }catch(_e){ if(myToken !== _modoConsultaToken) return; console.warn('[activarModoConsulta] PDF:', _e); }
    // ── Fallback: versiones anteriores del mismo folio (B→A, C→B→A…) ──
    // Ocurre cuando la subida del PDF de la última versión falló silenciosamente.
    if(!_cargado){
      var _versiones=((typeof appData!=='undefined'&&appData.recibos)||[])
        .filter(function(r){ return r.folio===recibo.folio&&!r.esComplemento&&r.archivo&&r.archivo!==recibo.archivo; })
        .sort(function(a,b){ return (b.letra||'A').localeCompare(a.letra||'A'); });
      for(var _vi=0;_vi<_versiones.length&&!_cargado;_vi++){
        if(myToken !== _modoConsultaToken) return;
        var _rv=_versiones[_vi];
        try{
          var _rvBlob=await window.obtenerBlobPdfReciboValidado(_rv, function(){ return myToken !== _modoConsultaToken; });
          if(myToken !== _modoConsultaToken) return;
          if(_rvBlob&&_rvBlob.size>0){
            var _rvUrl=URL.createObjectURL(_rvBlob);
            if(myToken !== _modoConsultaToken){ try{URL.revokeObjectURL(_rvUrl);}catch(e){} return; }
            iframe._blobUrl=_rvUrl;
            var _srcVer = _rvUrl+'#toolbar=0&navpanes=0&scrollbar=0&view=FitH';
            window._fichaPdfDefaultSrc = _srcVer; // referencia para restaurar al cerrar
            _asignarPdfAlVisor(_srcVer);
            setStatus('ok','PDF versión '+(_rv.letra||'A')+' cargado (versión más reciente no disponible)','ok');
            _cargado=true;
          }
        }catch(_e2){ if(myToken !== _modoConsultaToken) return; }
      }
    }
    if(myToken !== _modoConsultaToken) return;
    if(!_cargado){
      setStatus('err','No se encontró el PDF del folio #'+String(recibo.folio).padStart(4,'0'),'err');
    }
  } else if(!recibo.archivo){
    if(myToken !== _modoConsultaToken) return;
    setStatus('err','Este folio no tiene PDF generado','err');
  }
}
function salirModoConsulta(){
  _modoConsultaToken++; // cancela cualquier activarModoConsulta en vuelo
  reciboEnConsulta = null;
  if(typeof cerrarFichaFolio==='function') cerrarFichaFolio();
  document.body.classList.remove('modo-consulta');
  document.body.classList.remove('folio-liquidado');
  document.body.classList.remove('folio-cancelado');
  // Limpiar iframe y liberar blob URL
  const iframe = document.getElementById('pdf-consulta-iframe');
  if(iframe){
    if(iframe._blobUrl){ try{ URL.revokeObjectURL(iframe._blobUrl); }catch(e){} iframe._blobUrl = null; }
    iframe.src = '';
  }
  // Restaurar folio display al actual
  if(typeof appData !== 'undefined') actualizarFolioDisplay();
}
function cargarReciboEnFormulario(recibo){
  // Mostrar folio del recibo consultado (con letra de versión almacenada)
  $('folio-display').textContent = folioConLetra(recibo.folio, recibo.anio_folio, recibo.letra || 'A');
  // Cargar clientes
  const wrap = $('clientes-wrapper');
  wrap.innerHTML = ''; clienteCount = 0;
  const clientes = recibo.clientes || [{nombre: recibo.nombre||'', movil:'', tel:'', domicilio:''}];
  clientes.forEach(c => {
    clienteCount++;
    const cid = 'c'+clienteCount;
    const _nomUp = (c.nombre||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[.]/g,'');
    const div = document.createElement('div');
    div.className = 'cliente-row'; div.id = 'cliente-row-'+cid;
    div.innerHTML =
      '<div class="cliente-fila-top">'
      +'<div class="field-group"><label>Nombre completo</label>'
        +'<input type="text" id="nombre_'+cid+'" value="'+escHTML(_nomUp)+'" style="text-transform:uppercase" '
        +'oninput="this.value=this.value.toUpperCase().normalize(\'NFD\').replace(/[\\u0300-\\u036f]/g,\'\').replace(/\\./g,\'\');if(typeof generarQRPreview===\'function\')generarQRPreview();if(typeof sincronizarFirmaCliente===\'function\')sincronizarFirmaCliente(this,\''+cid+'\')"></div>'
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
  // Campos de vehiculo / trámite — selects e inputs simples
  ['tramites','clase','marca','tipo_veh','serie','motor','personas_veh','anio','puertas',
   'color_veh','transmision','cilindros','placa','ultima_tenencia','origen','combustible'].forEach(fid=>{
    if(fid==='placa' && document.getElementById('placa-estado')){ document.getElementById('placa-estado').value = recibo.placaEstado || ''; if(typeof _sincronizarDisplayEstadoPlaca==='function') _sincronizarDisplayEstadoPlaca(); }
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
  // Tipo trámite y documento — restaurar ANTES de documentos para que las categorías correctas estén visibles
  if(recibo.tipoTramite) setTipoTramite(recibo.tipoTramite);
  const tipoDocGuardado = recibo.tipo_doc || 'copia';
  setTipoDoc(tipoDocGuardado);
  // Documentos seleccionados — copias puede ser: array, JSON string {tipodoc,docs:[]}, o string vacío
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
  // Abrir automáticamente las categorías de documentos que tengan ítems seleccionados
  document.querySelectorAll('#docs-checklist .doc-category').forEach(cat => {
    const tieneSeleccionados = cat.querySelectorAll('input[type="checkbox"]:checked').length > 0;
    const body = cat.querySelector('.doc-category-body');
    const arrow = cat.querySelector('.doc-category-header span');
    if(tieneSeleccionados && body && arrow){
      body.style.display = '';
      arrow.textContent = '\u25be';
    }
  });
  // Si el trámite es vehicular, abrir sección datos del vehiculo automáticamente
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
      +'<td><input type="text" class="precio price-input" inputmode="decimal" onfocus="this.select()" oninput="formatPrecio(this)" value="'+escHTML(String(c.precio||''))+'"></td>'
      +'<td></td>';
    tbody.appendChild(tr);
    tr.querySelectorAll('.concepto-ta').forEach(function(ta){ _autoGrowConceptoTA(ta); });
  });
  // Si el recibo no trae conceptos (p.ej. modo restauración con folio vacío),
  // dejar una fila lista para capturar en lugar de la tabla vacía.
  if(conceptoCount === 0 && typeof agregarConcepto === 'function') agregarConcepto();
  // Anticipo y firmas
  const elAnticipo = $('anticipo');
  if(elAnticipo){
    elAnticipo.dataset.programmatic = '1';
    elAnticipo.value = parseFloat(recibo.anticipo||'0').toLocaleString('es-MX');
    delete elAnticipo.dataset.programmatic;
  }
  const elResp = $('responsable');
  if(elResp && recibo.responsable) elResp.value = recibo.responsable;
  const elFirma = $('nombre_cliente_firma');
  if(elFirma){
    const _firmaSrc = recibo.nombre_cliente_firma || (recibo.clientes&&recibo.clientes[0]?.nombre) || recibo.nombre || '';
    const _firmaUp = _firmaSrc.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[.]/g,'');
    elFirma.value = _firmaUp;
    if(recibo.nombre_cliente_firma) elFirma.dataset.manualEdit='1';
    else delete elFirma.dataset.manualEdit;
  }
  // Mostrar bloque de placas si el recibo ya tiene capturadas
  mostrarPlacasEnPantalla(recibo.placasEntregadas, recibo.estadoPlacas);
  // En modo edición completa: folio editable + costosExtra y pagosParciales desbloqueados
  if(document.body.classList.contains('modo-edicion-completa')){
    const folioInput = document.getElementById('folio-edit-input');
    if(folioInput) folioInput.value = recibo.folio;
    const letraSelect = document.getElementById('folio-letra-select');
    if(letraSelect) letraSelect.value = recibo.letra || 'A';
    const tbodyCE = document.getElementById('costos-extra-tbody');
    if(tbodyCE){ tbodyCE.innerHTML = ''; costoExtraCount = 0; }
    (recibo.costosExtra||[]).forEach(ce => agregarCostoExtra(Object.assign({}, ce, {locked: false})));
    const tbodyPP = document.getElementById('pagos-parciales-tbody');
    if(tbodyPP){ tbodyPP.innerHTML = ''; pagoParcialCount = 0; }
    (recibo.pagosParciales||[]).forEach(pp => agregarPagoParcial(Object.assign({}, pp, {locked: true})));
  }
  // Actualizar visibilidad del poder según tipo y letra del recibo cargado
  const _letraRec = recibo.letra || (typeof letraVersion === 'function' ? letraVersion(recibo) : 'A') || 'A';
  window._letraReciboActual = _letraRec;
  if (typeof _actualizarVisibilidadPoder === 'function') {
    _actualizarVisibilidadPoder(recibo.tipoTramite || '', _letraRec);
  }
  // Restaurar modalidad de cobro
  if (typeof _actualizarSeccionModoCosto === 'function') _actualizarSeccionModoCosto(recibo.tipoTramite || '', _letraRec);
  if (typeof setModoCosto === 'function') {
    var _mcFolio = (typeof window._modoCostoFolio === 'function') ? window._modoCostoFolio(recibo) : recibo.modoCosto;
    if (_mcFolio) setModoCosto(_mcFolio);
  }
  calcTotales();
}
// Mostrar/ocultar el cuadro rojo de placas en el formulario
function mostrarPlacasEnPantalla(placas, estado){
  const box = document.getElementById('placas-display-box');
  if(!box) return;
  if(placas){
    box.style.display = 'block';
    document.getElementById('placas-display-numero').textContent = placas;
    document.getElementById('placas-display-estado').textContent = estado || '—';
  } else {
    box.style.display = 'none';
    document.getElementById('placas-display-numero').textContent = '—';
    document.getElementById('placas-display-estado').textContent = '—';
  }
}
function escHTML(str){
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function cerrarConsulta(){
  document.body.classList.remove('modo-consulta');
  document.body.classList.remove('folio-liquidado');
  document.body.classList.remove('folio-cancelado');
  document.body.classList.remove('paneles-busqueda-abiertos');
  document.body.classList.remove('en-accion-pago');
  document.body.classList.remove('paneles-abiertos-consulta');
  _panelesBusquedaAbiertos = false;
  if(typeof _pbcAbierto !== 'undefined') _pbcAbierto = false;
  if(typeof _pfcAbierto !== 'undefined') _pfcAbierto = false;
  // CRÍTICO: body.modo-consulta fuerza paneles-busqueda-cuerpo a display:block !important.
  // .style.display='none' serializa "display: none;" (con espacio) y el selector CSS
  // [style*="display:none"] NO lo detecta. setAttribute garantiza el string exacto sin espacio.
  const cuerpo = document.getElementById('paneles-busqueda-cuerpo');
  if(cuerpo) cuerpo.setAttribute('style','display:none;padding:0 20px 14px;');
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto(); else salirModoConsulta();
  renderHistorial();
  setStatus('ok','Formulario listo — folio #'+folioFormato(appData.folioActual),'ok');
  setTimeout(()=>{
    const rb = document.getElementById('recibo-body');
    if(rb) rb.scrollIntoView({behavior:'smooth', block:'start'});
    else window.scrollTo({top:0, behavior:'smooth'});
  }, 150);
}
function _cerrarPanelesBusqueda(){
  // Añadir clase que el CSS respeta con mayor especificidad que modo-consulta
  document.body.classList.add('en-accion-pago');
  // Cerrar paneles toggle
  if(typeof _panelesBusquedaAbiertos !== 'undefined' && _panelesBusquedaAbiertos){
    if(typeof togglePanelesBusqueda === 'function') togglePanelesBusqueda();
  }
  // Forzar ocultado directo con !important via style
  const pbcBody = document.getElementById('pbc-body');
  const pfcBody = document.getElementById('pfc-body');
  const panCuerpo = document.getElementById('paneles-busqueda-cuerpo');
  if(pbcBody) pbcBody.setAttribute('style','display:none !important;');
  if(pfcBody) pfcBody.setAttribute('style','display:none !important;');
  if(panCuerpo) panCuerpo.setAttribute('style','display:none !important; padding:0 20px 14px;');
  if(typeof _panelesBusquedaAbiertos !== 'undefined') _panelesBusquedaAbiertos = false;
  if(typeof _pbcAbierto !== 'undefined') _pbcAbierto = false;
  if(typeof _pfcAbierto !== 'undefined') _pfcAbierto = false;
}
function _restaurarPanelesBusqueda(){
  // Quitar clase auxiliar después de que la acción de pago terminó
  document.body.classList.remove('en-accion-pago');
  const panCuerpo = document.getElementById('paneles-busqueda-cuerpo');
  if(panCuerpo) panCuerpo.setAttribute('style','display:none; padding:0 20px 14px;');
}
async function ejecutarPagoParcial(){
  if(!reciboEnConsulta){ showModal('Error','No hay un recibo en consulta.'); return; }
  const recibo = reciboEnConsulta;
  const saldo = recibo.saldoPendiente||0;
  const _esSinCosto = window._abiertoSinCosto(recibo);
  if(saldo<=0 && !_esSinCosto){ showModal('Sin saldo','Este recibo ya está liquidado.'); return; }
  // Sin Costo Pactado: advertir si no hay ningún Servicio Complementario pendiente
  // que respalde el cobro (evita abonos sin ningún cargo/monto que los justifique,
  // como pasó en folio 56). El adeudo real se calcula igual que en el PDF: a partir
  // de los Servicios Complementarios (costosExtra) menos lo ya abonado — NO de
  // "Cargos internos", que es un mecanismo aparte de la ficha.
  if(_esSinCosto){
    const _adeudoSC = (typeof window._adeudoServicioComplementario==='function') ? window._adeudoServicioComplementario(recibo) : {total:0};
    if(_adeudoSC.total <= 0){
      const _msgSinCargo = 'Este trámite (Sin Costo Total Pactado) no tiene ningún Servicio Complementario pendiente de pago (adeudo actual: $0.00).\n\nRegistra primero el cargo con "Servicio Complementario" para que el total del trámite cuadre.\n\n¿Continuar de todas formas?';
      if(!confirm(_msgSinCargo)) return;
    }
  }
  // Solicitar autorización ANTES de abrir el modo actualización
  const auth = await pedirAutorizacion();
  if(auth === null){ setStatus('ok','Pago parcial cancelado — autorización no proporcionada','ok'); return; }
  window._autorizacionActual = auth;
  abrirModoActualizacion(recibo);
  // Crear automáticamente una fila de abono parcial editable
  setTimeout(()=>{
    agregarPagoParcial({
      concepto: 'Abono parcial',
      descripcion: '',
      cantidad: '',
      locked: false
    });
    recalcularResumenActualizacion();
    if (typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
    // Auto-focus al campo de cantidad para captura inmediata
    const inputCantidad = document.querySelector('#pagos-parciales-tbody tr:last-child .pp-cantidad');
    if(inputCantidad){
      inputCantidad.focus();
      inputCantidad.scrollIntoView({ behavior:'smooth', block:'center' });
    }
  }, 200);
}
// ── SERVICIO COMPLEMENTARIO ──
async function ejecutarServicioComplementario(){
  if(!reciboEnConsulta){ showModal('Error','No hay un recibo en consulta.'); return; }
  const recibo = reciboEnConsulta;
  // Solicitar autorización igual que pago parcial
  const auth = await pedirAutorizacion();
  if(auth === null){ setStatus('ok','Servicio complementario cancelado — autorización no proporcionada','ok'); return; }
  window._autorizacionActual = auth;
  // Marcar que venimos de servicio complementario
  window._modoServicioComplementario = true;
  // ── FIX: preservar estado retro ANTES de abrirModoActualizacion,
  //    porque limpiarFormCompleto() (llamado internamente) lo resetea a false. ──
  const _retroPreservar        = !!window._reciboRetroactivoActivo;
  const _retroFechaPreservar   = window._reciboRetroactivoFechaPersonalizada || null;
  const _retroHoraPreservar    = window._reciboRetroactivoHoraPersonalizada  || null;
  abrirModoActualizacion(recibo);
  // Restaurar estado retro (fue anulado por limpiarFormCompleto dentro de abrirModoActualizacion)
  if(_retroPreservar && _retroFechaPreservar){
    window._reciboRetroactivoActivo             = true;
    window._reciboRetroactivoFechaPersonalizada = _retroFechaPreservar;
    window._reciboRetroactivoHoraPersonalizada  = _retroHoraPreservar;
  }
  // Re-sincronizar aquí (no solo dentro de abrirModoActualizacion): el estado
  // retro se restauró recién arriba, después de que abrirModoActualizacion ya
  // hubiera sincronizado con el estado viejo (limpio) — sin esto el texto de
  // conformidad podía quedar desfasado del RETRO en este flujo específico.
  if (typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
  // Agregar automáticamente una fila editable en Servicio Complementario
  // (el estado retro ya está restaurado, por lo que agregarCostoExtra() tomará la fecha correcta)
  setTimeout(()=>{
    agregarCostoExtra();
    recalcularResumenActualizacion();
    if (typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
    // Auto-focus al campo de concepto del servicio complementario
    const inputConcepto = document.querySelector('#costos-extra-tbody tr:last-child .ce-concepto');
    if(inputConcepto){
      inputConcepto.focus();
      inputConcepto.scrollIntoView({ behavior:'smooth', block:'center' });
    }
  }, 200);
}
// ── MODO ACTUALIZACIÓN (mismo folio, conceptos originales bloqueados, costos extra + pagos parciales editables) ──
function cancelarAbonoNuevo(){
  window._folioReferencia = null;
  window._reciboOriginalRef = null;
  const banner = document.getElementById('abono-ref-banner');
  if(banner) banner.style.display='none';
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto();
  // Restaurar estado limpio con buscador visible
  document.body.classList.remove('modo-consulta','folio-liquidado','folio-cancelado',
    'modo-actualizacion','recibo-frozen','en-accion-pago','paneles-abiertos-consulta');
  if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
  if(typeof setStatus==='function') setStatus('ok','Folio #'+(typeof folioFormato==='function'?folioFormato(appData.folioActual):appData.folioActual)+' listo para capturar','ok');
  // Restaurar status-bar
  const _sb = document.querySelector('.status-bar');
  if(_sb) _sb.removeAttribute('style');
}
// ── MODO ACTUALIZACIÓN (mismo folio, conceptos originales bloqueados, costos extra + pagos parciales editables) ──
reciboEnActualizacion = null;
function abrirModoActualizacion(recibo){
  // Guardar respaldo ANTES de ir() porque limpiarFormCompleto (llamado por ir) anula la variable.
  // window._reciboActualizacionBackup es la fuente de verdad que nada más toca.
  window._reciboActualizacionBackup = recibo;
  // Navegar al panel — esto llama limpiarFormCompleto() internamente
  if(typeof ir === 'function') ir('nuevo-recibo');
  // Reasignar inmediatamente tras el reset de limpiarFormCompleto
  reciboEnActualizacion = recibo;
  // Salir del modo consulta (oculta el iframe del PDF) y entrar al formulario congelado
  document.body.classList.remove('modo-consulta');
  document.body.classList.remove('folio-liquidado');
  document.body.classList.remove('folio-cancelado');
  document.body.classList.remove('actualizacion-impresa');
  // Cerrar paneles forzadamente para que el formulario sea visible
  if(_panelesBusquedaAbiertos) togglePanelesBusqueda();
  // Forzar cierre directo también (por si _panelesBusquedaAbiertos no estaba sincronizado)
  const _pCuerpo = document.getElementById('paneles-busqueda-cuerpo');
  const _pbc = document.getElementById('pbc-body');
  const _pfc = document.getElementById('pfc-body');
  if(_pCuerpo) _pCuerpo.style.display = 'none';
  if(_pbc) _pbc.style.display = 'none';
  if(_pfc) _pfc.style.display = 'none';
  document.body.classList.remove('paneles-busqueda-abiertos');
  _panelesBusquedaAbiertos = false;
  const iframe = document.getElementById('pdf-consulta-iframe');
  if(iframe){
    if(iframe._blobUrl){ try{ URL.revokeObjectURL(iframe._blobUrl); }catch(e){} iframe._blobUrl = null; }
    iframe.src = '';
  }
  // Cargar todos los datos del recibo en el formulario
  cargarReciboEnFormulario(recibo);
  // Calcular la letra que se GENERARÁ al imprimir la actualización (misma lógica que _imprimirActualizacionReal)
  const _letrasUsadasAct = (appData.recibos || [])
    .filter(_r => _r.folio === recibo.folio && !_r.esComplemento)
    .map(_r => (_r.letra || 'A').toUpperCase().charCodeAt(0));
  const _letraBaseAct = (recibo.letra || 'A').toUpperCase().charCodeAt(0);
  const _maxLetraAct  = _letrasUsadasAct.length > 0 ? Math.max(..._letrasUsadasAct) : _letraBaseAct;
  const _letraProximaAct = String.fromCharCode(_maxLetraAct + 1);
  // Mostrar desde el inicio el folio con la letra que se asignará al imprimir
  document.getElementById('folio-display').textContent = folioConLetra(recibo.folio, recibo.anio_folio, _letraProximaAct);
  // Congelar el formulario (todos los campos originales bloqueados)
  document.body.classList.add('recibo-frozen');
  document.body.classList.add('modo-actualizacion');
  // Resetear campo anticipo a 0 — en modo actualización es el PAGO RECIBIDO de esta sesión
  var _antReset = $('anticipo');
  if(_antReset){ _antReset.dataset.programmatic='1'; _antReset.value=''; delete _antReset.dataset.programmatic; }
  // El inline !important supera cualquier regla de hoja de estilos con !important.
  // limpiarFormCompleto() deja display:none !important inline en actions-actualizacion;
  // hay que forzarlo a flex aquí para que los botones de actualización sean visibles.
  const _aActShow = document.getElementById('actions-actualizacion');
  if(_aActShow) _aActShow.style.setProperty('display', 'flex', 'important');
  const _aNormHide = document.getElementById('actions-normal');
  if(_aNormHide) _aNormHide.style.display = 'none';
  const _aPostHide = document.getElementById('actions-post-print');
  if(_aPostHide) _aPostHide.style.display = 'none';
  const _rbActualizacion = document.getElementById('recibo-body');
  if(_rbActualizacion) _rbActualizacion.style.setProperty('display', 'block', 'important');
  // Deshabilitar checkboxes del checklist también
  document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(cb => { cb.disabled = true; });
  // Limpiar el "Saldo Restante" (concepto/descripción editable) de cualquier
  // folio anterior — se repuebla con los valores de ESTE folio en el
  // recalcularResumenActualizacion() que dispara pintarPagosParciales() abajo.
  const _elCptoSRReset = document.getElementById('sr-cp-concepto');
  const _elDescSRReset = document.getElementById('sr-cp-descripcion');
  if(_elCptoSRReset){ _elCptoSRReset.value=''; delete _elCptoSRReset.dataset.manualEdit; }
  if(_elDescSRReset){ _elDescSRReset.value=''; delete _elDescSRReset.dataset.manualEdit; }
  // Limpiar y poblar las dos secciones nuevas con lo que ya esté guardado
  pintarCostosExtra(recibo.costosExtra || []);
  pintarPagosParciales(recibo.pagosParciales || []);
  // A petición expresa: en TODOS los formularios de actualización (Pago
  // Parcial, Pago Total, Servicio Complementario) la fecha/hora del pago y el
  // texto de conformidad deben responder siempre a la fecha/hora maestra del
  // encabezado (la que cambia con el modo RETRO) — nunca a valores propios.
  if (typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
  setStatus('ok','Modo actualización: folio #'+folioConLetra(recibo.folio, recibo.anio_folio, _letraProximaAct)+' — agrega costos extra o pagos parciales','ok');
  setTimeout(()=>{ document.getElementById('seccion-pagos-parciales').scrollIntoView({behavior:'smooth',block:'center'}); }, 200);
}
function cancelarActualizacion(){
  reciboEnActualizacion = null;
  window._reciboActualizacionBackup = null;
  window._flujoEsPagoTotal = false;
  document.body.classList.remove('modo-actualizacion','recibo-frozen','desde-liquidacion',
    'actualizacion-impresa','en-accion-pago','paneles-abiertos-consulta');
  var _antCan = document.getElementById('anticipo'); if(_antCan) _antCan.readOnly = false;
  // Restaurar status-bar y botón de búsqueda
  const _sbCan = document.querySelector('.status-bar');
  if(_sbCan) _sbCan.removeAttribute('style');
  const _btnTogCan = document.getElementById('btn-toggle-paneles');
  if(_btnTogCan) _btnTogCan.style.removeProperty('display');
  // Forzar ocultar actions-actualizacion con !important para ganar al CSS
  const _aActF = document.getElementById('actions-actualizacion');
  if(_aActF) _aActF.setAttribute('style','display:none !important;');
  document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(cb => { cb.disabled = false; });
  document.getElementById('costos-extra-tbody').innerHTML = '';
  document.getElementById('pagos-parciales-tbody').innerHTML = '';
  document.getElementById('seccion-costos-extra').style.display = 'none';
  document.getElementById('seccion-pagos-parciales').style.display = 'none';
  document.getElementById('resumen-pagos-parciales').style.display = 'none';
  const _seccionSRCancel = document.getElementById('seccion-saldo-restante-cp');
  if(_seccionSRCancel) _seccionSRCancel.style.display = 'none';
  // Resetear botones de actualización a su estado original
  const btnCancelar = document.getElementById('btn-cancelar-actualizacion');
  if(btnCancelar){
    btnCancelar.innerHTML = '✕ Cancelar Actualización';
    btnCancelar.onclick = cancelarActualizacion;
  }
  const btnImprimir = document.getElementById('btn-imprimir-actualizacion');
  if(btnImprimir){
    btnImprimir.innerHTML = '\uD83D\uDDA8 Imprimir Actualización';
    btnImprimir.onclick = imprimirActualizacion;
  }
  lastActualizacionBlob = null;
  lastActualizacionNombre = null;
  // Limpiar cuadro rojo de placas antes de limpiar el formulario
  mostrarPlacasEnPantalla(null, null);
  // Cerrar el contenedor de paneles con setAttribute para satisfacer el selector CSS
  // [style*="display:none"] que controla la visibilidad de #recibo-body.
  // NO llamamos _cerrarPanelesBusqueda() porque pone !important en pbc-body/pfc-body
  // impidiendo que togglePanelesBusqueda() los vuelva a abrir.
  const _panCuerpo = document.getElementById('paneles-busqueda-cuerpo');
  if(_panCuerpo) _panCuerpo.setAttribute('style','display:none; padding:0 20px 14px;');
  const _pbcB = document.getElementById('pbc-body');
  const _pfcB = document.getElementById('pfc-body');
  if(_pbcB) _pbcB.removeAttribute('style');
  if(_pfcB) _pfcB.removeAttribute('style');
  _panelesBusquedaAbiertos = false;
  // limpiarFormCompleto resetea acciones, banners, clases y visibilidad del formulario
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto(); else limpiarForm();
  const _sbFin = document.querySelector('.status-bar');
  if(_sbFin) _sbFin.removeAttribute('style');
  const _btnFin = document.getElementById('btn-toggle-paneles');
  if(_btnFin) _btnFin.style.removeProperty('display');
  if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
  renderHistorial();
  setStatus('ok','Listo \u2014 formulario limpio con folio #'+folioFormato(appData.folioActual),'ok');
  // Subir al inicio del formulario para que el usuario vea el recibo limpio
  setTimeout(()=>{
    const rb = document.getElementById('recibo-body');
    if(rb) rb.scrollIntoView({behavior:'smooth', block:'start'});
    else window.scrollTo({top:0, behavior:'smooth'});
  }, 150);
}
// ── COSTOS EXTRA ─────────────────────────────────────────────────
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
  // Modo retro: solo para filas nuevas
  const _ceRetroActivo = !isLocked && !isExisting && !!window._reciboRetroactivoActivo && !!window._reciboRetroactivoFechaPersonalizada;
  const _ceRetroFecha  = _ceRetroActivo ? window._reciboRetroactivoFechaPersonalizada : null;
  const _ceRetroHora   = _ceRetroActivo ? (window._reciboRetroactivoHoraPersonalizada || horaCDMX_HHMM()) : null;
  const fechaHora = isExisting ? data.fechaHora
    : (_ceRetroActivo ? (_ceRetroFecha + ' ' + _ceRetroHora + ' hrs.') : nuevaFechaHoraStr());
  tr.dataset.fechaHora = fechaHora;
  if(isLocked) tr.dataset.locked = '1';
  // Preservar la letra de ORIGEN real del cargo (la versión donde se creó), no la
  // versión que se está guardando ahora — evita que un cargo de 56B quede
  // reetiquetado como 56C solo por venir arrastrado como fila bloqueada.
  tr.dataset.folioLetra = (data && data.folioLetra) || '';
  if(isLocked){
    // Mismo criterio que en agregarPagoParcial(): esta tabla debe mostrar solo
    // los servicios complementarios que se agregan AHORA, no el historial
    // completo del folio (ya visible en la Ficha del Folio). El renglón se
    // mantiene oculto en el DOM, no eliminado, porque getCostosExtra() sigue
    // necesitando leerlo al guardar para arrastrar el historial a la
    // siguiente versión del recibo.
    tr.classList.add('ce-row-locked');
    tr.style.display = 'none';
    tr.innerHTML =
        '<td><textarea class="ce-concepto concepto-ta ce-locked-field" rows="1" readonly>'+escHTML((data&&data.concepto)||'')+'</textarea></td>'
      + '<td><textarea class="ce-descripcion concepto-ta ce-locked-field" rows="1" readonly>'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td style="vertical-align:top"><input type="text" class="ce-precio price-input ce-locked-field" readonly value="'+escHTML(fmtMXN(parseFloat(data.precio)||0))+'"></td>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:#7a6840;">'+fechaHora+'</td>'
      + '<td></td>';
  } else {
    tr.innerHTML =
        '<td><textarea class="ce-concepto concepto-ta" rows="1" placeholder="Escribe el concepto...">'+escHTML((data&&data.concepto)||'')+'</textarea></td>'
      + '<td><textarea class="ce-descripcion concepto-ta" rows="1" placeholder="Descripci\u00f3n">'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td style="vertical-align:top">'
      +   '<input type="text" class="ce-precio price-input" placeholder="0.00" inputmode="decimal" value="'+escHTML(String((data&&data.precio)||''))+'" oninput="formatPrecio(this);recalcularResumenActualizacion()">'
      + '</td>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:#7a6840;">'+fechaHora+'</td>'
      + '<td><button class="del-concept" onclick="quitarCostoExtra(\''+id+'\')">✕</button></td>';
  }
  tbody.appendChild(tr);
  recalcularResumenActualizacion();
}
function toggleCeLiquidado(id){ /* eliminado: ya no se usa el modo liquidar-al-momento */ }
function quitarCostoExtra(id){
  const r = document.getElementById('costo-extra-row-'+id);
  if(r){ r.remove(); recalcularResumenActualizacion(); }
}
function getCostosExtra(){
  const filas = document.querySelectorAll('#costos-extra-tbody tr');
  return Array.from(filas).map(tr => {
    const liquidadoAlMomento = false;
    const montoLiquidado = 0;
    return {
      concepto:            tr.querySelector('.ce-concepto').value || '',
      descripcion:         tr.querySelector('.ce-descripcion').value || '',
      precio:              String(parsePrecio(tr.querySelector('.ce-precio').value)),
      fechaHora:           tr.dataset.fechaHora || '',
      locked:              tr.dataset.locked === '1',
      folioLetra:          tr.dataset.folioLetra || '',
      liquidadoAlMomento:  liquidadoAlMomento,
      montoLiquidado:      montoLiquidado
    };
  }).filter(c => c.concepto || parseFloat(c.precio) > 0);
}
// ── PAGOS PARCIALES ──────────────────────────────────────────────
pagoParcialCount = 0;
function pintarPagosParciales(arr){
  const tbody = document.getElementById('pagos-parciales-tbody');
  tbody.innerHTML = ''; pagoParcialCount = 0;
  // NO se inyecta fila del anticipo original — el saldo pendiente ya refleja
  // los abonos anteriores. Solo se muestran pagos nuevos desde esta sesion.
  const recibo = reciboEnActualizacion;
  (arr||[]).forEach(pp => agregarPagoParcial(Object.assign({}, pp, {locked: true})));
  recalcularResumenActualizacion();
}
// Interpreta un fechaHora ya guardado, que puede venir en dos formatos seg\u00fan
// c\u00f3mo se haya creado: "DD/MM/AAAA HH:MM hrs." (captura normal) o
// "AAAA-MM-DD HH:MM hrs." (creado en modo retro hist\u00f3rico). Devuelve
// {fecha:'AAAA-MM-DD', hora:'HH:MM'} listos para <input type="date"/"time">,
// o null si no se pudo interpretar.
function _ppParsearFechaHoraExistente(str){
  if(!str) return null;
  var s = String(str);
  var m = s.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
  if(m) return { fecha: m[1]+'-'+m[2]+'-'+m[3], hora: (m[4].length<2?'0'+m[4]:m[4])+':'+m[5] };
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if(m) return { fecha: m[3]+'-'+(m[2].length<2?'0'+m[2]:m[2])+'-'+(m[1].length<2?'0'+m[1]:m[1]), hora: (m[4].length<2?'0'+m[4]:m[4])+':'+m[5] };
  return null;
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
  // \u26a0\ufe0f FIX (editar folio secundario desde admin): adem\u00e1s del modo retro normal
  // (fila NUEVA, fecha/hora en blanco), data.fechaEditable fuerza los mismos
  // inputs de fecha/hora para una fila YA EXISTENTE \u2014 para poder corregir el
  // pago de la versi\u00f3n que se est\u00e1 editando, no solo agregar uno nuevo.
  const forzarFechaEditable = !!(data && data.fechaEditable);
  const _fechaExistenteParsed = (forzarFechaEditable && isExisting) ? _ppParsearFechaHoraExistente(data.fechaHora) : null;
  // Modo retro cl\u00e1sico: solo para filas NUEVAS (no locked, no cargadas del historial)
  const retroActivo = !isLocked && !isExisting && !!window._reciboRetroactivoActivo;
  const mostrarInputsFecha = !isLocked && (retroActivo || forzarFechaEditable);
  const retroFecha  = mostrarInputsFecha
    ? ((_fechaExistenteParsed && _fechaExistenteParsed.fecha) || (retroActivo && window._reciboRetroactivoFechaPersonalizada) || fechaCDMX_ISO())
    : fechaCDMX_ISO();
  const retroHora   = mostrarInputsFecha
    ? ((_fechaExistenteParsed && _fechaExistenteParsed.hora) || (retroActivo && window._reciboRetroactivoHoraPersonalizada) || horaCDMX_HHMM())
    : horaCDMX_HHMM();
  tr.dataset.fechaHora = mostrarInputsFecha ? (retroFecha + ' ' + retroHora) : fechaHora;
  if(isLocked) tr.dataset.locked = '1';
  if(hasAuthInline) tr.dataset.hasAuthInline = '1';
  // Preservar la letra de ORIGEN real del abono (ver misma nota en agregarCostoExtra).
  tr.dataset.folioLetra = (data && data.folioLetra) || '';
  if(isLocked){
    // Fila completamente bloqueada (anticipo original o pagos ya impresos).
    // A petición expresa: esta tabla ("PAGO REGISTRADO EN ESTE RECIBO") debe
    // mostrar SOLO el pago que se está registrando AHORA, no el historial
    // general de abonos del folio (eso ya se puede consultar en la Ficha del
    // Folio). El renglón sigue existiendo en el DOM — oculto, no eliminado —
    // porque getPagosParciales() lee estas filas al guardar y necesita seguir
    // arrastrando el historial completo hacia la siguiente versión del
    // recibo; lo único que cambia es que ya no se le muestra al usuario.
    tr.classList.add('pp-row-locked');
    tr.style.display = 'none';
    tr.innerHTML =
        '<td><textarea class="pp-concepto concepto-ta pp-concepto-fijo" rows="1" readonly>'+escHTML(concepto)+'</textarea></td>'
      + '<td><textarea class="pp-descripcion concepto-ta pp-locked-field" rows="1" readonly>'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td><input type="text" class="pp-cantidad price-input pp-locked-field" readonly value="'+escHTML(fmtMXN(parseFloat(data.cantidad)||0))+'"></td>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:#7a6840;">'+fechaHora+'</td>'
      + '<td></td>';
  } else if(mostrarInputsFecha){
    // A petici\u00f3n expresa: esta fecha/hora YA NO se edita a mano por fila \u2014
    // debe ser siempre un espejo de la fecha/hora MAESTRA del encabezado
    // ("FECHA DEL RECIBO" / "HORA DE GENERACI\u00d3N", la que responde al modo
    // RETRO). Se muestra como texto de solo lectura, y se mantiene
    // sincronizada por _sincronizarFechaHoraMaestraPagos() \u2014 llamada al
    // cargar el formulario y cada vez que se aplica una fecha retroactiva.
    var _ddmmyyyy = retroFecha.split('-').reverse().join('/');
    tr.classList.add('pp-fecha-sincronizada');
    tr.innerHTML =
        '<td><textarea class="pp-concepto concepto-ta pp-concepto-fijo" rows="1" readonly>'+escHTML(concepto)+'</textarea></td>'
      + '<td><textarea class="pp-descripcion concepto-ta" rows="1" placeholder="\u00bfPor qu\u00e9 se hizo este pago?">'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td><input type="text" class="pp-cantidad price-input" placeholder="0.00" inputmode="decimal" value="'+escHTML(String((data&&data.cantidad)||''))+'" oninput="formatPrecio(this);recalcularResumenActualizacion()"></td>'
      + '<td class="pp-fecha-master" style="font-family:\'DM Mono\',monospace;font-size:0.7rem;color:#8b5cf6;font-weight:700;" title="Sincronizada con la fecha del encabezado (RETRO)">'+escHTML(_ddmmyyyy+' '+retroHora+' hrs.')+'</td>'
      + '<td><button class="del-concept" onclick="quitarPagoParcial(\''+id+'\')">\u2715</button></td>';
  } else {
    // Fila editable normal \u2014 fecha/hora autom\u00e1tica
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
  if(!r) return;
  const btn = r.querySelector('.del-concept');
  if(r.dataset.oculto === '1'){
    r.dataset.oculto = '0';
    r.querySelectorAll('td:not(:last-child)').forEach(td => td.style.display = '');
    if(btn){ btn.textContent = '\u2715'; btn.title = 'Ocultar'; btn.style.color = ''; }
  } else {
    r.dataset.oculto = '1';
    r.querySelectorAll('td:not(:last-child)').forEach(td => td.style.display = 'none');
    if(btn){ btn.textContent = '+'; btn.title = 'Mostrar'; btn.style.color = 'var(--verde)'; }
  }
  recalcularResumenActualizacion();
}
// Sincroniza tr.dataset.fechaHora cuando el usuario edita los inputs de fecha/hora retro
function _ppSyncFechaRetro(el){
  const tr = el.closest('tr');
  if(!tr) return;
  const f = (tr.querySelector('.pp-fecha-retro')||{}).value || '';
  const h = (tr.querySelector('.pp-hora-retro')||{}).value  || '';
  if(f && h) tr.dataset.fechaHora = f + ' ' + h;
}
// ── FECHA/HORA MAESTRA ───────────────────────────────────────────────────
// A petición expresa: la fecha/hora del encabezado ("FECHA DEL RECIBO" /
// "HORA DE GENERACIÓN", campos ocultos #fecha_recibo/#hora_recibo — la que
// responde al modo RETRO) es la referencia ÚNICA. Antes cada parte del
// formulario (fila de "Pago Registrado en Este Recibo", texto de
// conformidad "Leído que fue...") manejaba su propia fecha por separado y
// se desincronizaban entre sí. Esta función replica la fecha/hora maestra
// hacia las filas de pago marcadas como sincronizadas (.pp-fecha-sincronizada,
// ver agregarPagoParcial) y hacia el texto de conformidad.
function _sincronizarFechaHoraMaestraPagos(){
  // GUARDIA (caso real: folio 101 — el pago de liquidación de $7,700 quedó
  // fechado 29/jun/2026 13:41 en vez de la fecha real del cobro, 16/ago/2026,
  // porque esta función se llama en CUALQUIER actualización de recibo, no solo
  // en modo RETRO. #fecha_recibo/#hora_recibo son el encabezado "FECHA DEL
  // RECIBO", que SIEMPRE muestra la fecha ORIGINAL de creación del folio (por
  // diseño, para que A/B/C impriman el mismo encabezado) — NO la fecha de hoy.
  // Sin esta guardia, cualquier pago nuevo (Pago Total/Parcial) en un folio
  // viejo se estampaba silenciosamente con la fecha de creación del folio en
  // vez de la fecha real del cobro. Esta función solo debe actuar cuando el
  // modo retroactivo está deliberadamente activo (el usuario eligió una fecha
  // retro a propósito) — en cualquier otro caso no debe tocar las filas.
  if(!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada)) return;
  var fEl = document.getElementById('fecha_recibo');
  var hEl = document.getElementById('hora_recibo');
  var fechaMaestra = fEl ? fEl.value : '';
  var horaMaestra  = hEl ? hEl.value : '';
  if(!fechaMaestra) return;
  var ddmmyyyy = fechaMaestra.split('-').reverse().join('/');
  // FIX (caso real: Liquidación Total retroactiva registrada con la fecha de
  // HOY en Contabilidad, pese a que el recibo mostraba la fecha correcta):
  // antes esto solo sincronizaba filas YA marcadas .pp-fecha-sincronizada —
  // es decir, filas creadas DESPUÉS de activar el modo RETRO. Si el usuario
  // primero abre "Pago Total" (que agrega la fila "Liquidación total" de
  // inmediato, con la fecha/hora real de ESE momento) y RECIÉN DESPUÉS
  // activa RETRO, esa fila nunca tuvo la clase y se queda huérfana para
  // siempre con la fecha real de creación — ni esta función ni ninguna otra
  // la vuelve a tocar, aunque el encabezado del recibo sí cambie. Esa fecha
  // real (hoy) terminaba impresa en "PAGO REGISTRADO EN ESTE RECIBO" y de ahí
  // se "anclaba" también el movimiento de Contabilidad. Ahora se sincroniza
  // CUALQUIER fila no bloqueada (no solo las ya marcadas) — mismo criterio
  // que ya usa el sync de Servicio Complementario un poco más abajo en
  // confirmarFechaRetro() — así la fecha/hora maestra del encabezado es de
  // verdad la única fuente de verdad, sin importar en qué orden se activó
  // RETRO respecto a cuándo se creó la fila.
  document.querySelectorAll('#pagos-parciales-tbody tr').forEach(function(tr){
    if(tr.dataset.locked === '1') return;
    tr.classList.add('pp-fecha-sincronizada');
    tr.dataset.fechaHora = fechaMaestra + ' ' + horaMaestra;
    var celda = tr.querySelector('.pp-fecha-master');
    if(celda){
      celda.textContent = ddmmyyyy + ' ' + horaMaestra + ' hrs.';
    } else {
      // Fila que nació en modo "normal" (retro aún no estaba activo): su 4ª
      // celda es un <td> de texto plano, no la celda .pp-fecha-master de las
      // filas nacidas ya en retro — se actualiza directamente y se le da el
      // mismo estilo/título, para que quede igual y no vuelva a desincronizarse.
      var tds = tr.querySelectorAll('td');
      var celdaFecha = tds[3];
      if(celdaFecha && !celdaFecha.querySelector('input,textarea')){
        celdaFecha.classList.add('pp-fecha-master');
        celdaFecha.style.color = '#8b5cf6';
        celdaFecha.style.fontWeight = '700';
        celdaFecha.title = 'Sincronizada con la fecha del encabezado (RETRO)';
        celdaFecha.textContent = ddmmyyyy + ' ' + horaMaestra + ' hrs.';
      }
    }
  });
  if(typeof _actualizarTextoConformidad === 'function') _actualizarTextoConformidad(fechaMaestra);
}
window._sincronizarFechaHoraMaestraPagos = _sincronizarFechaHoraMaestraPagos;
function getPagosParciales(){
  const filas = document.querySelectorAll('#pagos-parciales-tbody tr');
  return Array.from(filas).map(tr => ({
    concepto:    tr.querySelector('.pp-concepto').value || 'Abon\u00f3',
    descripcion: tr.querySelector('.pp-descripcion').value || '',
    cantidad:    String(parsePrecio(tr.querySelector('.pp-cantidad').value)),
    fechaHora:   tr.dataset.fechaHora || '',
    locked:      tr.dataset.locked === '1',
    folioLetra:  tr.dataset.folioLetra || '',
    _hasAuthInline: tr.dataset.hasAuthInline === '1'
  })).filter(p => parseFloat(p.cantidad) > 0);
}
function nuevaFechaHoraStr(){
  // En modo RETRO usar la fecha/hora retroactiva configurada
  if(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada){
    var _f = window._reciboRetroactivoFechaPersonalizada;
    var _h = window._reciboRetroactivoHoraPersonalizada || horaCDMX_HHMM();
    return _f + ' ' + _h + ' hrs.';
  }
  return fechaHoraCDMX_Str();
}
// Actualiza el display de Hora de Generación al hacer clic en el reloj
function actualizarHoraDisplay(){
  if(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada) return;
  var horaActual = (typeof horaCDMX_HHMM === 'function') ? horaCDMX_HHMM() : new Date().toTimeString().slice(0,5);
  var inp = document.getElementById('hora_recibo');
  var disp = document.getElementById('hora_recibo_display');
  if(inp)  inp.value = horaActual;
  if(disp) disp.textContent = horaActual + ' hrs.';
  if(typeof toast === 'function') toast('🕐 Hora actualizada: ' + horaActual + ' hrs.', 'ok');
}
// Devuelve la fecha local en formato ISO (YYYY-MM-DD) sin desfase por zona horaria
function fechaLocalISO(d){
  const x = d || new Date();
  const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,'0');
  const dd = String(x.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+dd;
}
// ════════════════════════════════════════════════════════════════
// SINCRONIZACIÓN DE HORA CDMX (multi-fuente con fallback)
// ════════════════════════════════════════════════════════════════
// Mantiene un offset (ms) entre el reloj de la PC y la hora oficial de CDMX.
// ================================================================
// SISTEMA DE HORA — Fuente primaria: PC / Verificación: Supabase
// La hora del equipo (PC) es SIEMPRE la fuente de tiempo.
// La verificación remota se usa solo para confirmar que la PC esté bien configurada.
// Si no hay sesión o falla → PC sin advertencia.
// Si detecta diferencia > 2 min → badge amarillo (nunca bloquea).
// ================================================================
horaOffsetMs = 0;      // siempre 0: la PC es la fuente, sin ajuste externo
horaSincOK = true;     // siempre true: PC siempre está disponible
horaFuente = 'local';  // 'local' | 'drive-verificado'
horaUltimaSinc = 0;
horaDriveDesviacion = null; // ms de diferencia PC vs Drive (null = sin dato)
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
function fechaHoraCDMX_Str(){ return partesHoraCDMX().fechaHora; }
// ── VERIFICACIÓN DE HORA (antes usaba Drive, ahora usa Supabase) ──
async function verificarHoraConDrive(){
  // Versión Supabase: usa el endpoint de auth para obtener un timestamp del servidor
  if(typeof window.SB === 'undefined' || !window.SB) return null;
  try {
    const tAntes = Date.now();
    // Usamos Promise.race para el timeout — evita el error de clonación de AbortSignal
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
  } catch(e){ console.warn('Verificación hora Supabase falló:', e.message); return null; }
}
async function sincronizarHoraCDMX(){
  // La PC es siempre la fuente — mostramos su hora inmediatamente
  horaOffsetMs = 0;
  horaSincOK = true;
  horaFuente = 'local';
  horaUltimaSinc = Date.now();
  const partes = partesHoraCDMX();
  setHoraBadge('loading', '⏳ Verificando hora… ' + partes.hora);
  iniciarRelojBadge();
  // Verificar en background (no bloquea la UI)
  verificarHoraConDrive().then(desviacionMs => {
    horaDriveDesviacion = desviacionMs;
    const partes2 = partesHoraCDMX();
    if(desviacionMs === null){
      // Sin sesión o falló → PC sin advertencia, todo OK
      horaFuente = 'local';
      setHoraBadge('ok', '🖥 PC · ' + partes2.hora);
      console.log('✓ Hora del equipo (sin verificación remota):', partes2.hora);
    } else {
      const diffMin = Math.abs(desviacionMs) / 60000;
      if(diffMin < 2){
        // Verificación confirma que la PC está bien
        horaFuente = 'drive-verificado';
        setHoraBadge('ok', '🖥 PC · ✓ Hora · ' + partes2.hora);
        console.log('✓ Hora del equipo verificada — diferencia:', Math.round(desviacionMs/1000)+'s');
      } else {
        // Diferencia grande: advertir pero NO bloquear
        horaFuente = 'local';
        setHoraBadge('warn', '⚠ PC ' + partes2.hora + ' · Hora difiere ' + diffMin.toFixed(1) + 'min');
        console.warn('⚠ Diferencia PC vs hora remota:', diffMin.toFixed(1), 'min — verifica la hora del equipo');
      }
    }
    iniciarRelojBadge();
  }).catch(()=>{
    // Error inesperado → PC sin problema
    const partes2 = partesHoraCDMX();
    setHoraBadge('ok', '🖥 PC · ' + partes2.hora);
    iniciarRelojBadge();
  });
  if(typeof window._aplicarFechaLocal === 'function'){
    try { window._aplicarFechaLocal(new Date()); } catch(e){ registrarError('catch vacio', e); }
  }
  return true;
}
function labelFuente(nom){
  return nom === 'drive-verificado' ? 'PC · ✓ Hora'
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
  if(estado==='ok')        icon.textContent = '🖥';
  else if(estado==='warn') icon.textContent = '⚠';
  else if(estado==='err')  icon.textContent = '✕';
  else                     icon.textContent = '⏳';
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
      label.textContent = '⚠ PC ' + partes.hora + ' · Hora difiere ' + diffMin + 'min';
    } else if(horaFuente === 'drive-verificado'){
      label.textContent = '🖥 PC · ✓ Hora · ' + partes.hora;
    } else {
      label.textContent = '🖥 PC · ' + partes.hora;
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
  // Solo costos NUEVOS (no locked) — recibo.total ya incluye los de versiones anteriores
  // Solo costos NUEVOS — exacto=precio==monto (independiente); parcial/exceso=suma a deuda
  const _costosExtraNuevos = getCostosExtra().filter(c => c.locked !== true);
  // Todos los costos extra siempre suman al total (no hay "liquidado al momento")
  const sumaCostosExtra = _costosExtraNuevos
    .reduce((s,c)=>s+(parseFloat(c.precio)||0), 0);
  const sumaAbonosImplicitos = 0;
  const sumaLiquidadosAhora = 0;
  const todosLosPagos = getPagosParciales();
  const _abonosPP = todosLosPagos
    .filter(p => p.locked !== true)
    .reduce((s,p)=>s+(parseFloat(p.cantidad)||0), 0);
  // El campo anticipo es el pago recibido en esta sesion — leerlo siempre
  const _antEl = $('anticipo');
  const _antManual = (_antEl && !_antEl.dataset.programmatic)
    ? (parsePrecio(_antEl.value)||0) : 0;
  const sumaAbonosNuevos = _abonosPP > 0 ? _abonosPP : _antManual;
  // En modo Sin Costo Total Pactado (juicio/escritura abierto) el complementario NUNCA
  // se auto-cubre: el folio no se liquida por saldo, así que el complementario debe
  // sumar como cargo real (de lo contrario la suma se anularía a $0).
  const _esAbiertoRes = (typeof window._abiertoSinCosto==='function') && window._abiertoSinCosto(reciboEnActualizacion);
  // El saldo anterior: en modo normal, reciboEnActualizacion.saldoPendiente ya refleja
  // todos los pagos previos (anticipo + abonos ya guardados). En Sin Costo Total
  // Pactado ese campo NO se mantiene actualizado — el adeudo real se calcula igual
  // que en el PDF y en los botones Pago Parcial/Total: a partir de los Servicios
  // Complementarios pendientes menos lo ya abonado. Así la vista previa que ve el
  // cajero SIEMPRE coincide con lo que el PDF va a imprimir.
  const saldoAnterior = _esAbiertoRes
    ? ((typeof window._adeudoServicioComplementario==='function') ? window._adeudoServicioComplementario(reciboEnActualizacion).total : 0)
    : (parseFloat(reciboEnActualizacion.saldoPendiente) || 0);
  const totalGeneral = totalOriginal + sumaCostosExtra;
  // PAGO TOTAL: el complementario se paga en el momento (sigue el flujo del folio).
  // NO se mete en la fila de liquidación; solo se cuenta como cubierto para que el
  // folio quede en ceros. En PAGO PARCIAL el complementario se suma a la deuda (igual que antes).
  const _esPagoTotalRes = document.body.classList.contains('desde-liquidacion') || !!reciboEnActualizacion._esPagoTotal;
  const _compCubierto = (_esPagoTotalRes && !_esAbiertoRes) ? sumaCostosExtra : 0;
  const _abonoTotalSesion = sumaAbonosNuevos + _compCubierto;
  // El nuevo saldo = saldo anterior + costos nuevos - abonos (en pago total el complementario va como cubierto)
  const nuevoSaldo = Math.max(0, saldoAnterior + sumaCostosExtra - _abonoTotalSesion);
  const totalAbonado = totalGeneral - nuevoSaldo;
  const box = document.getElementById('resumen-pagos-parciales');
  box.style.display = '';
  if (_esAbiertoRes) {
    // Modo Sin Costo Total Pactado: el recuadro encabeza con ADEUDO ANTERIOR
    // (deuda acumulada del folio), suma el servicio nuevo y todo se totaliza.
    // El cliente abona todo o una parte sin desglosar qué cubre.
    var _hayAdeudoPrev = (parseFloat(saldoAnterior)||0) > 0;
    box.innerHTML =
        '<div style="display:grid;grid-template-columns:1fr auto;gap:4px 14px;">'
      + (_hayAdeudoPrev
          ? '<span style="font-weight:700;">ADEUDO ANTERIOR:</span><span style="text-align:right;font-weight:700;">$'+fmtMXN(saldoAnterior)+'</span>'
          : '')
      + (sumaCostosExtra > 0
          ? '<span style="color:#a05010;">'+(_hayAdeudoPrev?'+ ':'')+'Servicio complementario:</span><span style="text-align:right;color:#a05010;">$'+fmtMXN(sumaCostosExtra)+'</span>'
          : '')
      + '<span style="font-weight:700;border-top:1px solid #c0dba8;padding-top:4px;">'+(_hayAdeudoPrev?'TOTAL A PAGAR:':'TOTAL:')+'</span>'
      + '<span style="text-align:right;font-weight:700;border-top:1px solid #c0dba8;padding-top:4px;">$'+fmtMXN(saldoAnterior + sumaCostosExtra)+'</span>'
      + (_abonoTotalSesion > 0
          ? '<span style="font-weight:700;color:#2a7a3a;">\u2212 Abono:</span><span style="text-align:right;font-weight:700;color:#2a7a3a;">$'+fmtMXN(_abonoTotalSesion)+'</span>'
          : '')
      + '<span style="border-top:1.5px solid #2a7a3a;padding-top:5px;font-weight:700;font-size:0.95rem;">SALDO RESTANTE (RESTA):</span>'
      + '<span style="border-top:1.5px solid #2a7a3a;padding-top:5px;text-align:right;font-weight:700;font-size:1rem;color:'+(nuevoSaldo>0?'#b01010':'#2a7a3a')+'">$'+fmtMXN(nuevoSaldo)+'</span>'
      + '</div>';
  } else {
  box.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr auto;gap:4px 14px;">'
    + '<span>Total tr\u00e1mite original:</span><span style="text-align:right">$'+fmtMXN(totalOriginal)+'</span>'
    + (sumaCostosExtra > 0
        ? '<span>+ Servicios complementarios:</span><span style="text-align:right;color:#a05010">$'+fmtMXN(sumaCostosExtra)+'</span>'
          + '<span style="font-weight:700;border-top:1px solid #c0dba8;padding-top:4px;">TOTAL ACTUALIZADO:</span>'
          + '<span style="text-align:right;font-weight:700;border-top:1px solid #c0dba8;padding-top:4px;">$'+fmtMXN(totalGeneral)+'</span>'
        : '')
    + '<span style="color:#a05010;">'+(sumaCostosExtra>0?'Saldo actualizado (resta):':'Saldo anterior (resta):')+'</span><span style="text-align:right;color:#a05010;">$'+fmtMXN(saldoAnterior+(sumaCostosExtra>0?sumaCostosExtra:0))+'</span>'
    + (_abonoTotalSesion > 0
        ? '<span style="font-weight:700;color:#2a7a3a;">\u2212 Nuevo abono:</span><span style="text-align:right;font-weight:700;color:#2a7a3a;">$'+fmtMXN(_abonoTotalSesion)+'</span>'
        : '')

    + '<span style="border-top:1.5px solid #2a7a3a;padding-top:5px;font-weight:700;font-size:0.95rem;">SALDO RESTANTE (RESTA):</span>'
    + '<span style="border-top:1.5px solid #2a7a3a;padding-top:5px;text-align:right;font-weight:700;font-size:1rem;color:'+(nuevoSaldo>0?'#b01010':'#2a7a3a')+'">$'+fmtMXN(nuevoSaldo)+'</span>'
    + '</div>';
  }
  // Sincronizar cuadro dorado derecha
  // En modo actualización el cuadro muestra SOLO esta operación:
  // Total    = saldo pendiente + costos nuevos de esta sesión (lo que se debe ahora)
  // Anticipo = abono nuevo de esta sesión (lo que se cobra ahora)
  // Resta    = lo que sigue pendiente después de esta operación
  const totalDisp = document.getElementById('total-display');
  const restaDisp = document.getElementById('resta-display');
  const antInput  = $('anticipo');
  const totalEstaOperacion = saldoAnterior + sumaCostosExtra;
  const _labelTotal = totalDisp ? totalDisp.previousElementSibling : null;
  if(_labelTotal && _labelTotal.tagName === 'LABEL'){
    // Mostrar 'Total Restante' en cualquier modo actualización (no solo pago total)
    // porque siempre muestra lo que se debe en esta sesión, no el total histórico
    _labelTotal.textContent = 'Total Restante';
  }
  if(totalDisp) totalDisp.textContent = '$'+fmtMXN(totalEstaOperacion);
  if(restaDisp) restaDisp.textContent = '$'+fmtMXN(nuevoSaldo);
  if(antInput){
    // Si un pago parcial maneja el abono, Anticipo es solo display: bloquearlo para
    // que no se escriba un valor que el cálculo ignora (causaba el cuadro contradictorio).
    antInput.readOnly = (_abonosPP > 0);
    // Solo sincronizar el campo si NO tiene foco (el usuario no está escribiendo)
    // y si el valor no fue ya capturado manualmente por el usuario
    if(document.activeElement !== antInput){
      antInput.dataset.programmatic = '1';
      antInput.value = fmtMXN(_abonoTotalSesion);
      delete antInput.dataset.programmatic;
    }
  }
  // ── SALDO RESTANTE (vista previa editable) ──────────────────────────────
  // Aplica a actualizaciones B,C,D… de Costo Total Pactado, CON o SIN
  // Servicio Complementario. Con Servicio Complementario (getCostosExtra()
  // con datos), el monto mostrado es el adeudo que se arrastraba ANTES de
  // este recibo — SIN el costo del Servicio Complementario nuevo, que ya
  // se ve por separado en su propia sección — y el texto por defecto
  // siempre es "ADEUDO ANTERIOR" (misma simplificación que usa generarPDF()
  // para este caso). Sin Servicio Complementario, se conserva la lógica
  // previa (LIQUIDACIÓN TOTAL / ADEUDO ANTERIOR / concepto original). No
  // aplica en modo Sin Costo Total Pactado (_esAbiertoRes), que tiene su
  // propia sección "SUMA TOTAL DE ADEUDOS"/"PAGOS REALIZADOS". Refleja
  // EXACTAMENTE la misma lógica que usa generarPDF(), sin tocar el
  // concepto/precio original (que sigue siendo la fuente real del total).
  // Si el usuario ya editó el texto a mano (dataset.manualEdit), no se
  // sobreescribe en los recálculos siguientes.
  const _seccionSaldoRestCP = document.getElementById('seccion-saldo-restante-cp');
  if(_seccionSaldoRestCP){
    const _hayCEEnEsteRes = getCostosExtra().length > 0;
    if(_esAbiertoRes || (_hayCEEnEsteRes && saldoAnterior <= 0.005)){
      _seccionSaldoRestCP.style.display = 'none';
    } else {
      _seccionSaldoRestCP.style.display = '';
      const elCptoSR = document.getElementById('sr-cp-concepto');
      const elValSR  = document.getElementById('sr-cp-valor');
      if(elValSR) elValSR.value = '$'+fmtMXN(saldoAnterior);
      // A petición expresa: el CONCEPTO ya no depende de qué pasó en este
      // recibo (antes variaba entre "ADEUDO ANTERIOR"/"LIQUIDACIÓN TOTAL"/el
      // concepto original según el caso) — ahora es SIEMPRE el/los concepto(s)
      // originales del folio A, permanentes, unificados en un solo renglón
      // si el trámite original tenía varios. Mismo criterio que generarPDF().
      if(elCptoSR){
        const _conceptosOrigRes = (reciboEnActualizacion.conceptos || []).filter(c => c.concepto || c.precio);
        const _nombresRes = _conceptosOrigRes.map(c => c.concepto).filter(Boolean);
        elCptoSR.value = _nombresRes.length ? _nombresRes.join('; ') : 'ADEUDO ANTERIOR';
      }
    }
  }
}
// ── IMPRIMIR ACTUALIZACIÓN (mismo folio) ──
async function imprimirActualizacion(){
  // ── GUARDIA DE SESIÓN ─────────────────────────────────────────────
  if(!sbSession || Date.now() >= sbExpiry){
    window._desactivarRegistrandoRecibo();
    mostrarDriveOverlay('imprimirActualizacion');
    return;
  }
  // Validaciones rápidas antes de pedir confirmación
  // Restaurar desde respaldo si la variable fue anulada por algun reset interno
  if(!reciboEnActualizacion && window._reciboActualizacionBackup){
    reciboEnActualizacion = window._reciboActualizacionBackup;
  }
  if(!reciboEnActualizacion){ window._desactivarRegistrandoRecibo(); showModal('Error','No hay un recibo en actualizaci\u00f3n.'); return; }
  // Validar con fecha de HOY (fecha del pago nuevo), no la del recibo original.
  // El recibo puede ser anterior al corte de caja pero el abono se registra hoy.
  const _retroAct2 = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  const _fechaVal  = _retroAct2 ? window._reciboRetroactivoFechaPersonalizada : (typeof fechaCDMX_ISO==='function' ? fechaCDMX_ISO() : new Date().toISOString().slice(0,10));
  const _horaVal   = _retroAct2 ? (window._reciboRetroactivoHoraPersonalizada||'00:00') : (typeof horaCDMX_HHMM==='function' ? horaCDMX_HHMM() : '00:00');
  if(esPeriodoCerrado(_fechaVal, _horaVal)){
    toast(_msgPeriodoCerrado(), 'err'); return;
  }
  const _costosExtraTmp = getCostosExtra();
  const _pagosTmp       = getPagosParciales();
  const _abonosNuevosTmp = _pagosTmp.filter(p => p.locked !== true);
  if(!_costosExtraTmp.length && !_abonosNuevosTmp.length){
    showModal('Sin cambios','Agrega al menos un servicio complementario o un abono nuevo antes de imprimir.');
    return;
  }
  // Todas las validaciones pasaron: activar flag justo antes de confirmar.
  // Si el usuario cancela el modal de confirmacion, desactivar el flag.
  window._activarRegistrandoRecibo();
  abrirConfirmacionRecibo({
    onAceptar:  () => { _imprimirActualizacionReal(); },
    onCancelar: () => { window._desactivarRegistrandoRecibo(); }
  });
}
async function _imprimirActualizacionReal(){
  // ── GUARDIA DE SESIÓN ─────────────────────────────────────────────
  if(!sbSession || Date.now() >= sbExpiry){
    window._desactivarRegistrandoRecibo();
    mostrarDriveOverlay('imprimirActualizacion');
    return;
  }
  console.log('[ACTUALIZACION] Click en IMPRIMIR ACTUALIZACIÓN — flujo:', document.body.classList.contains('desde-liquidacion') ? 'PAGO TOTAL' : 'PAGO PARCIAL');
  // Restaurar desde respaldo si la variable fue anulada por algun reset interno
  if(!reciboEnActualizacion && window._reciboActualizacionBackup){
    reciboEnActualizacion = window._reciboActualizacionBackup;
  }
  if(!reciboEnActualizacion){ showModal('Error','No hay un recibo en actualizaci\u00f3n.'); return; }
  const recibo = reciboEnActualizacion;
  const costosExtra = getCostosExtra();
  const pagosParciales = getPagosParciales();
  // ── SÍNTESIS DE ABONO DEL CAMPO ANTICIPO ──────────────────────────
  // En el flujo de Servicio Complementario el abono se captura en el campo
  // "Anticipo" (cuadro dorado), no como fila de pago parcial. Si no hay pago
  // parcial nuevo pero el campo Anticipo trae monto, se convierte aquí en un
  // pago parcial real para que se ACUMULE en las versiones siguientes (p.ej.
  // 56C/56D), aparezca en el recibo y en el historial, y se registre en
  // contabilidad — igual que cualquier abono. La versión guarda su anticipo
  // original por separado, así que esto NO duplica el monto.
  (function(){
    var _ppNuevosSint = pagosParciales.filter(function(p){ return p.locked !== true; });
    var _antValSint = (typeof parsePrecio==='function' ? parsePrecio((($('anticipo')||{}).value)||'0') : 0) || 0;
    if(_ppNuevosSint.length === 0 && _antValSint > 0){
      pagosParciales.push({
        concepto: 'Abon\u00f3',
        descripcion: 'Abono del tr\u00e1mite',
        cantidad: String(_antValSint),
        fechaHora: (typeof nuevaFechaHoraStr==='function' ? nuevaFechaHoraStr() : ''),
        locked: false,
        _hasAuthInline: false
      });
    }
  })();
  const abonosNuevos = pagosParciales.filter(p => p.locked !== true);
  if(!costosExtra.length && !abonosNuevos.length){
    window._desactivarRegistrandoRecibo();
    showModal('Sin cambios','Agrega al menos un servicio complementario o un abono nuevo antes de imprimir.');
    return;
  }
  // Autorización capturada al iniciar el flujo. Si se perdió (flujo retomado
  // tras reconexión de sesión), pedirla ahora antes de continuar.
  let autorizacion = window._autorizacionActual || null;
  window._autorizacionActual = null;
  if(!autorizacion){
    autorizacion = await pedirAutorizacion();
    if(autorizacion === null){
      window._desactivarRegistrandoRecibo();
      setStatus('ok','Impresión cancelada — autorización no proporcionada','ok');
      return;
    }
  }
  // Modal de placas: cuando se cumplen las DOS condiciones:
  //  1. Trámite vehicular
  //  2. Pago Total (liquidación)
  // Se eliminó la condición de "día anterior": el modal ahora aparece también
  // cuando se liquida el mismo día. Si las placas aún no existen, se puede usar
  // "⏭ No hay placas aún" para omitir y capturarlas después desde Editar Recibo.
  // (esDeDiaAnterior se conserva solo para el log de diagnóstico.)
  let _placasCapturadas;
  const esVehicular     = (recibo.tipoTramite === 'vehicular');
  const esPagoTotal     = document.body.classList.contains('desde-liquidacion') || !!(recibo._esPagoTotal) || !!window._flujoEsPagoTotal;
  const _hoyStr         = typeof hoy === 'function' ? hoy() : new Date().toISOString().slice(0,10);
  const _fechaOrig      = (recibo.fecha || recibo.fecha_recibo || '').slice(0,10);
  const esDeDiaAnterior = !!(_fechaOrig && _fechaOrig < _hoyStr);
  console.log('[PLACAS] esVehicular:', esVehicular, '| esPagoTotal:', esPagoTotal, '| esDeDiaAnterior:', esDeDiaAnterior, '| fechaOrig:', _fechaOrig, '| hoy:', _hoyStr, '| _esPagoTotal en recibo:', recibo._esPagoTotal);
  if(esVehicular && esPagoTotal){
    const resultado = await pedirDatosPlacas();
    if(resultado === null){
      window._desactivarRegistrandoRecibo();
      setStatus('ok','Impresión cancelada — modal de placas cerrado','ok');
      return;
    }
    _placasCapturadas = { placas: resultado.placas, estado: resultado.estado };
  } else {
    // Pago Parcial, mismo día o no vehicular: conservar placas ya guardadas
    _placasCapturadas = { placas: recibo.placasEntregadas || null, estado: recibo.estadoPlacas || null };
  }
  window._flujoEsPagoTotal = false; // limpiar flag tras captura de placas
  // Bloquear "Imprimir Actualización"/"Cancelar" y mostrar overlay — de aquí en
  // adelante es puro trabajo async (generar PDF, subir, guardar); sin este bloqueo
  // el botón seguía disponible y permitía dar clic varias veces de más mientras
  // el sistema ya estaba procesando la primera solicitud.
  const _btnImprimirAct2 = document.getElementById('btn-imprimir-actualizacion');
  const _btnCancelarAct2 = document.getElementById('btn-cancelar-actualizacion');
  window._mostrarGenerandoPDF([_btnImprimirAct2, _btnCancelarAct2], 'Generando PDF…');
  setStatus('loading','Generando PDF actualizado...','loading');
  // Re-verificar hora con Drive en background (no bloquea)
  sincronizarHoraCDMX().catch((e)=>{ registrarError('Promise catch vacio', e); });
  const totalOriginal = parseFloat(recibo.total) || 0;
  const anticipoOriginal = parseFloat(recibo.anticipo) || 0;
  // Solo costos NUEVOS (no locked) — recibo.total ya incluye los de versiones anteriores
  // Separar complementarios: exacto(precio==monto)=independiente; parcial/exceso=suma a deuda
  const _costosNuevos = costosExtra.filter(c => c.locked !== true);
  // Todos los costos extra siempre suman al total
  const sumaCostosExtra = _costosNuevos
    .reduce((s,c)=>s+(parseFloat(c.precio)||0), 0);
  const sumaAbonosImplicitos = 0;
  // Modo Sin Costo Total Pactado (abierto): NUNCA se auto-cubre — el folio no se
  // liquida por saldo, el complementario debe sumar como cargo real.
  const _esAbiertoImp = (typeof window._abiertoSinCosto==='function') && window._abiertoSinCosto(recibo);
  // Saldo anterior: en modo normal, recibo.saldoPendiente ya incluye el anticipo
  // original y todos los abonos anteriores. En Sin Costo Total Pactado se recalcula
  // con la MISMA fuente de verdad que usan el PDF, la vista previa en pantalla y los
  // botones Pago Parcial/Total (Servicios Complementarios pendientes menos lo ya
  // abonado) — así lo que se guarda en el folio nunca se desincroniza de lo impreso.
  const _adeudoSCImp = (_esAbiertoImp && typeof window._adeudoServicioComplementario==='function')
    ? window._adeudoServicioComplementario(recibo) : null;
  const saldoAnterior = _esAbiertoImp
    ? (_adeudoSCImp ? _adeudoSCImp.total : 0)
    : (parseFloat(recibo.saldoPendiente) || 0);
  // ── GUARDRAIL (caso real: folio 12) ─────────────────────────────────────
  // El folio 12 quedó con saldoPendiente desincronizado de Contabilidad por una
  // corrupción de datos ajena a este flujo (mecanismo AUTO-PROTECTOR, ya
  // desactivado) y el recibo se imprimió con una cifra distinta a la realmente
  // cobrada, sin que nadie lo notara hasta que ScanSys lo detectó semanas
  // después. Este chequeo cruza ANTES de imprimir: si lo que el recibo CREE que
  // ya se cobró no coincide con lo que Contabilidad tiene registrado para este
  // folio, se avisa y se pide confirmación explícita antes de continuar.
  if(typeof D !== 'undefined' && Array.isArray(D.movimientos) && !_esAbiertoImp){
    const _tolGuard = 0.5;
    const _regHonGuard = D.movimientos
      .filter(m => m && !m.borrado && m.fuente === 'recibo' && Number(m.folio) === Number(recibo.folio) && (m.estatus||'') !== 'Complementario')
      .reduce((s,m) => s + (parseFloat(m.monto)||0), 0);
    const _esperadoGuard = totalOriginal - saldoAnterior; // lo que el recibo cree ya cobrado
    const _difGuard = _regHonGuard - _esperadoGuard;
    if(Math.abs(_difGuard) > _tolGuard){
      const _seguirGuard = confirm(
        '⚠ El saldo de este recibo no coincide con lo registrado en Contabilidad.\n\n' +
        'El recibo cree que ya se cobraron $' + _esperadoGuard.toFixed(2) + '.\n' +
        'Contabilidad tiene registrados $' + _regHonGuard.toFixed(2) + ' para este folio.\n' +
        'Diferencia: $' + _difGuard.toFixed(2) + '\n\n' +
        'Antes de continuar, verifica el folio en SCANSYS PRO → Diagnóstico de Folios.\n' +
        '¿Deseas continuar de todos modos?'
      );
      if(!_seguirGuard){
        window._desactivarRegistrandoRecibo();
        window._ocultarGenerandoPDF([_btnImprimirAct2, _btnCancelarAct2]);
        setStatus('ok','Impresión cancelada — revisa el folio en SCANSYS','ok');
        return;
      }
    }
  }
  const _abonosPPImp = pagosParciales
    .filter(p => p.locked !== true)
    .reduce((s,p)=>s+(parseFloat(p.cantidad)||0), 0);
  // Si no hay pagos parciales, leer el monto capturado en el campo anticipo (cuadro dorado)
  const _antValImp = parsePrecio(($('anticipo') || {}).value || '0') || 0;
  const sumaAbonosNuevos = _abonosPPImp > 0 ? _abonosPPImp : _antValImp;
  // En Sin Costo Total Pactado NO se encadena el .total guardado de la versión
  // anterior (esa fórmula es para trámites con total pactado) — se recalcula desde
  // el bruto acumulado real de servicios complementarios (deduplicado) más lo nuevo
  // de esta sesión, así el campo .total nunca se infla versión tras versión.
  const totalGeneral = _esAbiertoImp
    ? ((_adeudoSCImp ? _adeudoSCImp.bruto : 0) + sumaCostosExtra)
    : (totalOriginal + sumaCostosExtra);
  // PAGO TOTAL: el complementario se paga en el momento (cubierto), no deja saldo.
  // En PAGO PARCIAL se suma a la deuda como siempre.
  const _compCubiertoImp = (esPagoTotal && !_esAbiertoImp) ? sumaCostosExtra : 0;
  const saldoNuevo = Math.max(0, saldoAnterior + sumaCostosExtra - sumaAbonosNuevos - _compCubiertoImp);
  const totalAbonado = totalGeneral - saldoNuevo;
  const fechasImpresion = (recibo.fechasImpresion && recibo.fechasImpresion.length)
    ? recibo.fechasImpresion.slice()
    : [{ fecha: recibo.fecha || recibo.fecha_recibo || '', hora: recibo.hora || recibo.hora_recibo || '', etiqueta: 'Original' }];
  const _retroActivo = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  const _fechaActualizacion = _retroActivo ? window._reciboRetroactivoFechaPersonalizada : fechaCDMX_ISO();
  const _horaActualizacion  = _retroActivo ? (window._reciboRetroactivoHoraPersonalizada || horaCDMX_HHMM()) : horaCDMX_HHMM();
  fechasImpresion.push({
    fecha: _fechaActualizacion,
    hora:  _horaActualizacion,
    etiqueta: 'Actualizaci\u00f3n'
  });
  // Letra de esta versi\u00f3n: se toma la letra m\u00e1s alta ya existente y se avanza una posici\u00f3n.
  // Usar r.letra (campo inmutable guardado) como fuente de verdad, nunca fechasImpresion.
  // BLINDAJE 2026-07: no confiar SOLO en appData.recibos en memoria -- puede estar
  // desincronizado (pestana vieja, debounce de sync todavia sin bajar, etc.). Sin esto
  // la letra puede calcularse mal e incluso REPETIR una ya usada (caso real: folio 56,
  // se genero un movimiento etiquetado "C" cuando la letra maxima real ya era "G" y
  // debia tocar "H" -- la copia local en memoria estaba atrasada). Se cruza contra el
  // estado mas reciente de Supabase antes de decidir la siguiente letra; si la
  // verificacion falla (sin red, etc.) se sigue con la copia local como respaldo.
  const _letrasLocalPrevias = new Set((appData.recibos || [])
    .filter(_r => _r.folio === recibo.folio && !_r.esComplemento)
    .map(_r => (_r.letra || 'A').toUpperCase()));
  let _letrasSet = new Set(_letrasLocalPrevias);
  let _folioDesincronizado = false;
  try {
    if (window.SB && window.SB_DESPACHO_ID) {
      const _freshRes = await window.SB.from('app_state')
        .select('recibos').eq('despacho_id', window.SB_DESPACHO_ID).single();
      const _freshData = _freshRes && _freshRes.data;
      const _recFrescos = (_freshData && _freshData.recibos && _freshData.recibos.recibos) || [];
      _recFrescos
        .filter(_r => _r && _r.folio === recibo.folio && !_r.esComplemento)
        .forEach(_r => {
          const _lFresca = (_r.letra || 'A').toUpperCase();
          if (!_letrasLocalPrevias.has(_lFresca)) _folioDesincronizado = true;
          _letrasSet.add(_lFresca);
        });
    }
  } catch (eFresh) { console.warn('[letra fresca -- usando copia local]', eFresh); }
  // Si Supabase tiene letras de este folio que esta pantalla NO tenía cargadas, la copia
  // local está atrasada (pestaña vieja, otra sesión actualizó el folio mientras tanto).
  // Abortar en vez de seguir: no solo la letra podría calcularse mal, TODO lo demás que
  // lee `recibo` (costosExtra, pagosParciales, saldoPendiente...) también sería viejo.
  // Esto es lo que causó folio 56: un movimiento quedó etiquetado "C" en vez de "H"
  // porque la pantalla llevaba abierta desde antes de que existieran las letras C-G.
  if (_folioDesincronizado) {
    window._desactivarRegistrandoRecibo();
    window._ocultarGenerandoPDF([_btnImprimirAct2, _btnCancelarAct2]);
    showModal('Folio actualizado en otra sesión',
      'El folio #' + folioConLetra(recibo.folio, recibo.anio_folio, recibo.letra || 'A') +
      ' tiene versiones más recientes que esta pantalla no había cargado (se actualizó desde ' +
      'otra sesión, o esta pantalla lleva tiempo abierta). Para no registrar mal la letra o el ' +
      'monto, cierra esta pantalla, vuelve a abrir el folio desde cero y repite la actualización.');
    return;
  }
  const _letrasUsadas = [..._letrasSet].map(l => l.charCodeAt(0));
  // Fallback: si appData no tiene el recibo en memoria, usar recibo.letra como base
  // (evita _maxLetraCode=64 \u2192 letraActual='A' cuando deber\u00eda ser 'B' o superior)
  const _letraBaseCode = (recibo.letra || 'A').toUpperCase().charCodeAt(0);
  const _maxLetraCode = _letrasUsadas.length > 0 ? Math.max(..._letrasUsadas) : _letraBaseCode;
  const letraActual = String.fromCharCode(_maxLetraCode + 1);
  // Inyectar autorización en pagos NUEVOS (no bloqueados). Usamos guiones -fecha-
  // para no chocar con los corchetes [fechaHora] que el PDF agrega automáticamente.
  const pagosParciales_conAuth = pagosParciales.map(p => {
    if(p.locked) return p; // los ya impresos conservan su auth previa
    // En modo retro: priorizar la fecha capturada por fila (input editable);
    // si no viene (pago agregado sin retro activo), caer al retro global.
    const fechaHoraFinal = _retroActivo
      ? (p.fechaHora || _fechaActualizacion + ' ' + _horaActualizacion)
      : (p.fechaHora || '');
    const _vTagPP = ' ['+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+']';
    const authTag = _vTagPP + ' \u2014 Autoriz\u00f3: ' + autorizacion.iniciales + ' -' + fechaHoraFinal + '-';
    return Object.assign({}, p, {
      descripcion: (p.descripcion || '') + authTag,
      fechaHora: fechaHoraFinal || p.fechaHora,
      folioLetra: letraActual,
      _hasAuthInline: true
    });
  });
  // Sin Costo Total Pactado: la tabla en pantalla trae precargado (bloqueado) todo
  // lo ya guardado de la versión anterior, como referencia visual — pero el PDF de
  // ESTA transacción solo debe mostrar lo genuinamente NUEVO de esta sesión (el
  // cargo/abono que se agrega ahora). Lo anterior ya se muestra aparte en "ADEUDO
  // ANTERIOR". Sin este filtro, cada recibo repetía los cargos/abonos de todas las
  // versiones previas, inflando el total (folio 56, caso audiencia de pruebas +
  // audiencia de alegatos). Los trámites normales conservan el comportamiento previo.
  const _costosExtraParaPDF = _esAbiertoImp ? _costosNuevos : costosExtra;
  // "PAGO REGISTRADO EN ESTE RECIBO" (sección impresa) debe mostrar SOLO el
  // abono de ESTA transacción, nunca un historial acumulado — antes esto solo
  // se filtraba para Sin Costo Total Pactado; ahora aplica siempre, para todo
  // tipo de recibo (Costo Pactado, con o sin Servicio Complementario).
  const _pagosParcialesParaPDF = pagosParciales_conAuth.filter(p => !p.locked);
  // Texto de "Saldo Restante" (concepto/descripción) editado en pantalla — visible
  // tanto con como sin Servicio Complementario, siempre que NO sea Sin Costo Total
  // Pactado y haya algo que mostrar (ver recalcularResumenActualizacion). Si el
  // usuario lo dejó vacío o la sección no aplica, generarPDF() recalcula el mismo
  // default por su cuenta — esto solo sirve para respetar una edición manual.
  const _seccionSRImp = document.getElementById('seccion-saldo-restante-cp');
  const _srCptoImp = (_seccionSRImp && _seccionSRImp.style.display !== 'none') ? ($('sr-cp-concepto')||{}).value : '';
  const _srDescImp = (_seccionSRImp && _seccionSRImp.style.display !== 'none') ? ($('sr-cp-descripcion')||{}).value : '';
  const datos = {
    folio: recibo.folio,
    clientes: recibo.clientes || [{nombre:recibo.nombre,movil:'',tel:'',domicilio:''}],
    tramites: recibo.tramites || '',
    clase:recibo.clase, marca:recibo.marca, tipo_veh:recibo.tipo_veh, serie:recibo.serie,
    motor:recibo.motor, personas_veh:recibo.personas_veh, anio:recibo.anio, puertas:recibo.puertas,
    color_veh:recibo.color_veh, transmision:recibo.transmision,
    cilindros:recibo.cilindros, placa:recibo.placa, placaEstado:recibo.placaEstado||'',
    ultima_tenencia:recibo.ultima_tenencia, origen:recibo.origen, combustible:recibo.combustible,
    copias: recibo.copias || null,
    tipo_doc: recibo.tipo_doc || 'copia',
    tipoTramite: recibo.tipoTramite,
    modoCosto: recibo.modoCosto || '',
    fecha_recibo: recibo.fecha || recibo.fecha_recibo || '',
    hora_recibo:  recibo.hora || recibo.hora_recibo || '',
    anticipo: String(anticipoOriginal),
    responsable: recibo.responsable || $('responsable').value,
    nombre_cliente_firma: recibo.nombre_cliente_firma || '',
    conceptos: recibo.conceptos || [],
    costosExtra: _costosExtraParaPDF,
    pagosParciales: _pagosParcialesParaPDF,
    fechasImpresion,
    saldoAnterior,
    totalGeneral,
    totalAbonado,
    saldoNuevo,
    saldoRestanteConcepto:    _srCptoImp || '',
    saldoRestanteDescripcion: _srDescImp || '',
    placasEntregadas: _placasCapturadas.placas,
    estadoPlacas:     _placasCapturadas.estado,
    autorizacion: autorizacion,
    timestamp: ahoraCDMX().toISOString(),
    letra: letraActual,
    anio_folio: recibo.anio_folio || new Date().getFullYear()
  };
  try {
    const primerNombre = datos.clientes[0].nombre || recibo.nombre;
    const qrTexto = 'LEX-MEXICO|Folio:'+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+'|'+primerNombre+'|ACTUALIZADO|'+datos.timestamp;
    const qrDataURL = await qrToDataURL(qrTexto);
    const doc = await generarPDF(datos, recibo.folio, qrDataURL);
    const nombreArchivo = folioConLetra(recibo.folio, recibo.anio_folio, letraActual) + '.pdf';
    const _r2NombreAct  = _nombreArchivoR2(folioConLetra(recibo.folio, recibo.anio_folio, letraActual), primerNombre);
    // Subir como archivo nuevo (no sobrescribir la versión anterior)
    subirPDFaDrive(doc.output('blob'), nombreArchivo, _r2NombreAct).catch(e=>console.warn('SB upload version:',e));
    // Buscar el registro de la versión que se está actualizando (por folio + letra exacta)
    const letraOriginal = recibo.letra || letraVersion(recibo) || 'A';
    // Busqueda primaria: folio + letra exacta + no complemento
    let idx = appData.recibos.findIndex(r => r.folio === recibo.folio && !r.esComplemento && (r.letra || letraVersion(r) || 'A') === letraOriginal);
    // FALLBACK 1: misma letra sin importar esActualizacion
    if(idx < 0) idx = appData.recibos.findIndex(r => r.folio === recibo.folio && !r.esComplemento && (r.letra || 'A') === letraOriginal);
    // FALLBACK 2: cualquier registro del folio que no sea complemento (toma el mas reciente)
    if(idx < 0){
      const _candidatos = appData.recibos.map((r,i)=>({r,i})).filter(({r})=> r.folio === recibo.folio && !r.esComplemento);
      if(_candidatos.length > 0) idx = _candidatos[_candidatos.length - 1].i;
    }
    // FALLBACK 3: insertar como nuevo registro si definitivamente no existe
    if(idx < 0){
      console.warn('[LEX] findIndex fallback: recibo folio', recibo.folio, 'letra', letraOriginal, 'no encontrado en appData \u2014 insertando directamente');
      appData.recibos.push(Object.assign({}, recibo));
      idx = appData.recibos.length - 1;
    }
    if(idx >= 0){
      // ── Snapshot del registro anterior antes de crear la nueva versión ─────
      _guardarSnapshotRecibo(appData.recibos[idx], saldoNuevo<=0 ? 'Liquidación' : 'Abono parcial');
      // Crear un NUEVO registro independiente con la letra nueva (B, C, D…).
      // El registro original (A, B anterior, etc.) queda INTACTO en el historial.
      // CRÍTICO: usar pagosParciales_conAuth para que la autorización quede fija.
      const nuevoRegistro = Object.assign({}, appData.recibos[idx], {
        costosExtra:      costosExtra.map(c => Object.assign({}, c, {locked:true, folioLetra: c.folioLetra || letraActual})),
        // ⚠️ FIX: igual que costosExtra arriba — si un abono llega sin folioLetra
        // (dato viejo previo a esta corrección), se estampa aquí como respaldo.
        // Sin esto, el filtro de la Ficha del Folio (p.folioLetra||rletra) atribuye
        // el abono a TODAS las filas futuras sin letra propia, inflando el ABONÓ
        // de cada versión posterior (bug detectado en folio 6, fila 6C).
        pagosParciales:   pagosParciales_conAuth.map(p => Object.assign({}, p, {locked:true, folioLetra: p.folioLetra || letraActual})),
        copias:           appData.recibos[idx].copias,
        fechasImpresion:  fechasImpresion,
        total:            totalGeneral,
        saldoPendiente:   saldoNuevo,
        saldoNuevo:       saldoNuevo,
        totalAbonado:     totalAbonado,
        pdfBase64:        doc.output('datauristring'),
        archivo:          nombreArchivo,
        archivoR2:        _r2NombreAct,
        letra:            letraActual,
        placasEntregadas: _placasCapturadas.placas,
        estadoPlacas:     _placasCapturadas.estado,
        esActualizacion:  true,
        fechaActualizacion: _fechaActualizacion,
        horaActualizacion:  _horaActualizacion,
        // Preservar explícitamente el modo de cobro y tipo del folio en cada versión
        modoCosto: (typeof window._modoCostoFolio==='function' ? (window._modoCostoFolio(appData.recibos[idx])||appData.recibos[idx].modoCosto) : appData.recibos[idx].modoCosto) || '',
        tipoTramite: appData.recibos[idx].tipoTramite || recibo.tipoTramite || '',
        // Concepto/descripción de "Saldo Restante" que se imprimió en ESTE
        // recibo (respeta si el usuario lo editó a mano) — se guarda para que
        // una futura regeneración de este mismo PDF reproduzca el mismo texto
        // en vez de recalcular el default desde cero.
        saldoRestanteConcepto:    datos.saldoRestanteConcepto || '',
        saldoRestanteDescripcion: datos.saldoRestanteDescripcion || ''
      });
      // ⚠️ CRÍTICO: insertar B inmediatamente DESPUÉS de A usando splice(idx+1).
      // Esto garantiza que find(r => r.folio === n) sin filtro de letra siempre
      // devuelve A primero. push() + sort() fue reemplazado porque el comparador
      // con return 0 para folios distintos viola la transitividad de sort() y
      // producía que B quedara antes que A, rompiendo el display en historial y contab.
      if (typeof _revivirSiTombstone === 'function') _revivirSiTombstone(nuevoRegistro);
      appData.recibos.splice(idx + 1, 0, nuevoRegistro);
      _guardarVersionEnSupabase(nuevoRegistro, letraActual, nombreArchivo).catch(e=>console.warn('[SB versiones] actualizacion:',e));
    }
  if(!appData.historialPagos) appData.historialPagos = {};
    if(!appData.historialPagos[recibo.folio]) appData.historialPagos[recibo.folio] = [];
    const yaRegistrados = new Set(appData.historialPagos[recibo.folio].map(h=>h.fechaHora||''));
    pagosParciales.forEach(p => {
      if(p.locked) return; // El "Dejó un anticipo" no se duplica en el historial
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
    // ── REGISTRAR INGRESO EN CAJA/CONTABILIDAD ──────────────────────
    if(typeof D !== 'undefined' && Array.isArray(D.movimientos)){
      // Un solo ingreso por folio: en pago total incluye el complementario cubierto.
      // Usar sumaAbonosNuevos (no solo abonosNuevos): incluye el abono capturado en el
      // campo Anticipo del cuadro dorado — que es por donde el flujo de Servicio
      // Complementario captura el pago. Antes solo contaba pagos parciales, por lo que
      // el abono del complementario (campo anticipo) quedaba en $0 y NO se registraba.
      const montoNuevosAbonos = sumaAbonosNuevos + _compCubiertoImp;
      // ⚠️ BLINDAJE 2026-07: ancla la fecha/hora del movimiento al propio renglón de
      // pago (folioLetra + fechaHora) que ya quedó impreso en el PDF/pagosParciales,
      // en vez de usar "ahora" (momento de dar clic en Imprimir Actualización). Antes,
      // si el renglón se había escrito minutos u horas antes de imprimir (o si el clic
      // de guardado se demoraba/reintentaba), el movimiento podía terminar con una
      // hora — o en casos raros una letra — desalineada de lo que el propio recibo ya
      // tiene guardado como verdad (caso detectado: folio 56D, pago de $7,000 a las
      // 18:42 impreso correctamente en el PDF, pero el movimiento de Contabilidad
      // quedó con datos de otra letra). Se usa SIEMPRE el último renglón nuevo de
      // pagosParciales_conAuth (que ya trae folioLetra=letraActual, fuente de verdad),
      // con fallback al comportamiento anterior si no hay renglón (p.ej. complementario
      // pagado solo vía el campo Anticipo, sin fila de pago parcial).
      const _nuevosParaMov = pagosParciales_conAuth.filter(p => !p.locked);
      const _ultimoNuevoMov = _nuevosParaMov.length ? _nuevosParaMov[_nuevosParaMov.length - 1] : null;
      // FIX: el regex original solo reconocía "DD/MM/YYYY HH:MM" (el formato
      // que produce fechaHoraCDMX_Str() en el flujo normal). Las filas creadas
      // en modo RETRO guardan tr.dataset.fechaHora en formato ISO
      // "YYYY-MM-DD HH:MM" (viene directo del <input type="date"> del editor
      // retro) — el regex nunca hacía match ahí, así que el ancla quedaba
      // silenciosamente nula para CUALQUIER pago retroactivo. Se reconocen
      // ahora los 2 formatos, para que el ancla refleje siempre lo que
      // realmente quedó guardado en el renglón, sea cual sea su origen.
      const _fhTxt = (_ultimoNuevoMov && _ultimoNuevoMov.fechaHora) || '';
      const _fhMatchSlash = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/.exec(_fhTxt);
      const _fhMatchISO   = !_fhMatchSlash ? /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/.exec(_fhTxt) : null;
      const _fechaMovAnclada = _fhMatchSlash ? (_fhMatchSlash[3] + '-' + _fhMatchSlash[2] + '-' + _fhMatchSlash[1])
        : _fhMatchISO ? (_fhMatchISO[1] + '-' + _fhMatchISO[2] + '-' + _fhMatchISO[3])
        : null;
      const _horaMovAnclada = _fhMatchSlash ? _fhMatchSlash[4] : _fhMatchISO ? _fhMatchISO[4] : null;
      if(montoNuevosAbonos > 0){
        // Dedup: evita crear un segundo movimiento para el mismo folio+letra si esta
        // función corre dos veces para la misma versión (doble clic, reintento, etc.)
        // — mismo patrón que ya usa guardarRecibo() para sus propios movimientos.
        // ⚠️ FIX: Number() en ambos lados — m.folio puede venir como STRING desde
        // Supabase/jsonb (visto en movimientos restaurados, ej. folio 88A) mientras
        // que recibo.folio es NUMBER; la comparación estricta anterior nunca
        // detectaba el movimiento ya existente y terminaba creando un duplicado.
        const _yaExisteMovAct = D.movimientos.some(m =>
          m && m.fuente === 'recibo' && Number(m.folio) === Number(recibo.folio) && (m.letra||'A') === letraActual
        );
        if(_yaExisteMovAct){
          console.warn('[Contabilidad] Ya existe un movimiento para folio ' + folioConLetra(recibo.folio, recibo.anio_folio, letraActual) + ' — no se duplica.');
        } else {
        const tipoMov = saldoNuevo<=0 ? 'Liquidación' : 'Abono parcial';
        const mov = {
          id: 'M-REC-' + recibo.folio + '-' + Date.now(),
          folioCaja: '',
          fecha: _fechaMovAnclada || (_retroActivo ? _fechaActualizacion : (typeof hoy  === 'function' ? hoy()  : new Date().toISOString().split('T')[0])),
          hora:  _horaMovAnclada  || (_retroActivo ? _horaActualizacion  : (typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5))),
          descripcion: (function(){
            // FIX (unificación de descripciones en Contabilidad): folio y nombre
            // ya tienen su propia columna — repetirlos aquí era redundante (mismo
            // ajuste ya aplicado en guardarRecibo()). Además, si en ESTA versión
            // (B/C/D…) se agregó un servicio complementario nuevo (costoExtra sin
            // locked), se muestra ESE concepto — antes siempre se mostraba el
            // concepto original del trámite (A), aunque el abono fuera en realidad
            // por un servicio distinto agregado después.
            const ceEsta = (costosExtra||[]).filter(function(ce){ return ce && !ce.locked; });
            if(ceEsta.length){
              return tipoMov + ' · ' + ceEsta.map(function(ce){ return (ce.concepto||'') + (ce.descripcion ? ' — ' + ce.descripcion : ''); }).join(' · ');
            }
            const c0 = recibo.conceptos && recibo.conceptos[0];
            const conc = c0 ? (c0.concepto||'') : '';
            const desc = c0 ? (c0.descripcion||'') : '';
            const txt  = conc + (desc ? ' — ' + desc : '');
            return tipoMov + (txt ? ' · ' + txt : '');
          })(),
          nombre: recibo.nombre || '',
          folio: recibo.folio,
          monto: montoNuevosAbonos,
          tipo: 'ingreso',
          cat: (saldoNuevo<=0 ? 'Liquidación' : 'Abono parcial') + ' · #' + folioConLetra(recibo.folio, recibo.anio_folio, letraActual),
          estatus: saldoNuevo<=0 ? 'Liquidado' : 'Abono parcial',
          fuente: 'recibo',
          letra: letraActual,
          // El responsable del trámite queda fijo desde que se creó el folio (recibo.responsable,
          // elegido por el admin vía elegirResponsable() o heredado). Antes esto usaba empNombre()
          // (quien tiene la sesión abierta) primero, así que si el admin imprimía la actualización
          // de un trámite asignado a su empleada, el movimiento quedaba registrado con las
          // iniciales del admin en vez de las de la empleada — aunque el PDF sí salía correcto.
          responsable: recibo.responsable || $('responsable').value || (typeof empNombre === 'function' ? empNombre() : '')
        };
        _registrarMovimiento(mov);
        if(typeof save === 'function') save();
        if(typeof renderCaja === 'function') renderCaja();
        if(typeof renderContab === 'function') renderContab();
        // ⚠️ NO llamar await syncEstadoSupabase() aquí — save() ya lo dispara.
        // Una segunda llamada inmediata entra al debounce de 500ms y cuando corre
        // puede bajar D.movimientos de SB antes de que save() termine de subir,
        // borrando el movimiento recién registrado de la memoria local.
        }
      }
      // ── REGISTRAR PAGO DEL SERVICIO COMPLEMENTARIO (si hay abono nuevo) ──
      // El abono ya fue registrado como movimiento principal arriba (sumaAbonosNuevos).
      // No se necesita un movimiento adicional por complementario.
    }
    // Guard de registro: apagar SOLO tras registrar honorarios Y complementarios.
    // Si se apagaba antes (justo tras el honorario), _protegerMovimientosRecibo()
    // —que corre síncrono dentro de save()— veía el folio a medias y podía fabricar
    // un duplicado del complementario/abono parcial que aún no se registraba.
    //
    // ⚠️ FIX 2026-06: NO apagar el guard aquí todavía. El segundo save() de abajo
    // también dispara syncEstadoSupabase() → _protegerMovimientosRecibo(). Si el guard
    // ya está apagado cuando corre ese segundo save(), _protegerMovimientosRecibo() ve
    // la brecha del recibo B recién insertado en appData.recibos y crea un segundo
    // movimiento M-RECUP con monto distinto — ese es el duplicado visible en contabilidad.
    // El guard se apaga DESPUÉS del segundo save() para cubrir ambas llamadas.
    // ── ESCRITURA BLOQUEANTE en Drive antes de imprimir ──────────────
    setStatus('loading','Guardando actualización del folio #'+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+'...','loading');
    try {
      await actualizarArchivoControl();
    } catch(eCtrl) {
      console.error('❌ Error guardando actualización:', eCtrl);
      try { await actualizarArchivoControl(); } catch(e2){ console.error('❌ Segundo intento fallido:', e2); }
    }
    // ── Persistir D.movimientos DESPUÉS de que actualizarArchivoControl() terminó ──
    // Garantiza que el movimiento de Liquidación/Abono quede en SB aunque save()
    // anterior haya colisionado con _syncEnCurso y quedado en el debounce de 500ms.
    // FIX (mismo caso raíz que folio 113A en guardarRecibo()): un solo save()
    // fire-and-forget podía fallar en silencio y dejar el abono/liquidación
    // huérfano solo en memoria local. Se reintenta varias veces y, si de plano
    // no se puede, se avisa de forma visible en vez de perderse sin aviso.
    let _syncOkAct = false;
    for (let _intentoSyncAct = 1; _intentoSyncAct <= 4 && !_syncOkAct; _intentoSyncAct++) {
      try {
        await syncEstadoSupabase();
        _syncOkAct = true;
      } catch (eSyncAct) {
        console.warn('[_imprimirActualizacionReal] intento ' + _intentoSyncAct + '/4 de sincronizar falló:', eSyncAct);
        if (_intentoSyncAct < 4) await new Promise(res => setTimeout(res, 1000 * _intentoSyncAct));
      }
    }
    if (!_syncOkAct) {
      const _folioLetraActTxt = folioConLetra(recibo.folio, recibo.anio_folio, letraActual);
      toast('⚠️ La actualización del recibo #' + _folioLetraActTxt + ' NO se pudo guardar en el servidor tras varios intentos. Verifica tu conexión y vuelve a intentar, o revisa SCANSYS PRO.', 'err');
      if (typeof _lexPush === 'function') {
        try { _lexPush('error', 'recibo.sync', 'Actualización del recibo #' + _folioLetraActTxt + ' no se pudo sincronizar tras 4 intentos.', null, { folio: recibo.folio, letra: letraActual }); } catch(eLex){}
      }
    }
    // ✅ Apagar guard AQUÍ, después del segundo save(), para que _protegerMovimientosRecibo()
    // no vea la brecha del recibo B recién registrado en ninguno de los dos save() anteriores.
    window._desactivarRegistrandoRecibo();
    renderHistorial();
    setStatus(_syncOkAct ? 'ok' : 'err', _syncOkAct ? ('Folio #'+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+' actualizado e impreso \u2014 puedes seguir agregando') : ('\u26a0\ufe0f Folio #'+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+' impreso, pero no se confirmo en el servidor \u2014 revisa el aviso'), _syncOkAct ? 'ok' : 'err');
    const pdfBlob = doc.output('blob');
    lastActualizacionBlob = pdfBlob;
    lastActualizacionNombre = nombreArchivo;
    // El modal de placas ya se mostró al inicio de la función. Las placas ya están
    // en `datos` y por tanto incluidas en el PDF generado. Ahora solo abrimos la
    // ventana de impresora.
    console.log('[PLACAS] PDF generado. Abriendo ventana de impresora...');
    imprimirDesdeBlob(pdfBlob, nombreArchivo);
    // Resetear modo retro si estaba activo (evita que persista en la siguiente operación)
    if(_retroActivo){
      window._reciboRetroactivoActivo = false;
      window._reciboRetroactivoFechaPersonalizada = null;
      window._reciboRetroactivoHoraPersonalizada = null;
      window._reciboRetroactivoMotivo = null;
      var _btnRetroUpd = document.getElementById('btn-toggle-retro');
      if(_btnRetroUpd){
        _btnRetroUpd.style.background = 'none';
        _btnRetroUpd.style.color = 'var(--muted)';
        _btnRetroUpd.style.borderColor = 'rgba(200,149,42,0.3)';
        _btnRetroUpd.textContent = '⏰ RETRO';
      }
    }
    // ─── FLUJO SIMPLIFICADO: regreso automático a página principal ───
    setTimeout(() => {
      try {
        if(typeof siguienteFolio === 'function'){
          // Marcar que venimos de un pago/actualización (no de un recibo nuevo).
          // Esto evita que siguienteFolio() lea folio_actual de Supabase y lo pise
          // con el valor del siguiente folio principal, en lugar de mantener el
          // appData.folioActual local que ya es correcto.
          window._vieneDePagoActualizacion = true;
          siguienteFolio();
        } else {
          if(typeof cancelarActualizacion === 'function') cancelarActualizacion();
          if(typeof limpiarFormCompleto    === 'function') limpiarFormCompleto();
        }
        const tipoFlujo = (saldoNuevo <= 0) ? 'liquidado completamente' : 'actualizado';
        // Si se liquidó completamente, eliminar pendiente de placas vinculado
        // EXCEPTO en modo Sin Costo Total Pactado — solo se cierra con "Cerrar Juicio"
        const _esSinCostoPost = window._abiertoSinCosto(recibo);
        if (saldoNuevo <= 0 && !_esSinCostoPost) _eliminarPendientePorFolio(recibo.folio);
        const _msgFlujo = _esSinCostoPost ? 'actualizado (sin costo pactado)' : tipoFlujo;
        setStatus('ok', 'Folio #'+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+' '+_msgFlujo+' · Listo para el siguiente recibo', 'ok');
      } catch(e){
        console.error('[post-imprimir-actualizacion]', e);
      }
    }, 700);
  } catch(e){
    console.error(e);
    setStatus('err','Error al generar PDF actualizado','err');
    showModal('Error','No se pudo generar el PDF: '+e.message);
  } finally {
    window._ocultarGenerandoPDF([_btnImprimirAct2, _btnCancelarAct2]);
  }
}
async function ejecutarLiquidacionTotal(){
  if(!reciboEnConsulta){ showModal('Error','No hay un recibo en consulta.'); return; }
  const recibo = reciboEnConsulta;
  const saldo = recibo.saldoPendiente||0;
  const _esSinCosto = window._abiertoSinCosto(recibo);
  if(saldo<=0 && !_esSinCosto){ showModal('Sin saldo','Este recibo ya está liquidado.'); return; }
  // Sin Costo Pactado: el saldo real NO es recibo.saldoPendiente (no se mantiene
  // actualizado en este modo) sino el adeudo de Servicios Complementarios pendientes,
  // igual que en el PDF. Se calcula una sola vez y se reutiliza para validar y precargar.
  const _adeudoSC = _esSinCosto && (typeof window._adeudoServicioComplementario==='function')
    ? window._adeudoServicioComplementario(recibo) : {total:0};
  // Sin Costo Pactado: advertir si no hay ningún Servicio Complementario pendiente
  // que respalde el cobro (evita liquidaciones sin ningún cargo/monto que las
  // justifique, como pasó en folio 56).
  if(_esSinCosto){
    if(_adeudoSC.total <= 0){
      const _msgSinCargo = 'Este trámite (Sin Costo Total Pactado) no tiene ningún Servicio Complementario pendiente de pago (adeudo actual: $0.00).\n\nRegistra primero el cargo con "Servicio Complementario" para que el total del trámite cuadre.\n\n¿Continuar de todas formas?';
      if(!confirm(_msgSinCargo)) return;
    }
  }
  // Solicitar autorización ANTES de abrir el modo actualización
  const auth = await pedirAutorizacion();
  if(auth === null){ setStatus('ok','Pago total cancelado — autorización no proporcionada','ok'); return; }
  window._autorizacionActual = auth;
  // Abrir modo actualización con el saldo completo prellenado
  document.body.classList.add('desde-liquidacion');
  recibo._esPagoTotal = true;
  window._flujoEsPagoTotal = true; // variable global — nada la borra excepto cancelar/terminar
  abrirModoActualizacion(recibo);
  // Agregar automáticamente una fila de pago parcial con el saldo total como cantidad.
  // En Sin Costo Pactado se precarga con el adeudo real de Servicios Complementarios,
  // no con el saldo crudo del recibo (que en este modo puede estar desactualizado).
  const _montoLiqTotal = _esSinCosto ? _adeudoSC.total : saldo;
  setTimeout(()=>{
    agregarPagoParcial({
      concepto: 'Liquidaci\u00f3n total',
      descripcion: 'del tr\u00e1mite',
      cantidad: String(_montoLiqTotal),
      locked: false
    });
    recalcularResumenActualizacion();
    if (typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
  }, 150);
}
function cerrarModalCancelacion(){
  document.getElementById('modal-cancelacion').classList.remove('show');
  document.getElementById('cancelacion-motivo').value='';
}
// ── Helpers de retro para la Ficha del Folio ──
function fichaRetroToggle(){
  if(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada){
    fichaRetroDesactivar();
  } else {
    // Usar el mismo editor de fecha retro
    abrirEditorFechaRetro();
  }
}
function fichaRetroDesactivar(){
  window._reciboRetroactivoActivo = false;
  window._reciboRetroactivoFechaPersonalizada = null;
  window._reciboRetroactivoHoraPersonalizada = null;
  // Restaurar botón principal retro del formulario si existe
  var btnRetro = document.getElementById('btn-toggle-retro');
  if(btnRetro){ btnRetro.style.background='none'; btnRetro.style.color='var(--muted)'; btnRetro.style.borderColor='rgba(200,149,42,0.3)'; btnRetro.textContent='⏰ RETRO'; }
  fichaRetroActualizarDisplay();
  if(typeof toast==='function') toast('Modo retroactivo desactivado','ok');
}
function fichaRetroEditar(){
  abrirEditorFechaRetro();
}
function fichaRetroActualizarDisplay(){
  var btn = document.getElementById('ficha-btn-retro');
  var bar = document.getElementById('ficha-retro-bar');
  var fechaDisp = document.getElementById('ficha-retro-fecha-display');
  var activo = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  if(btn){
    btn.style.background = activo ? '#5a3a8a' : 'none';
    btn.style.color = activo ? '#fff' : '#7a6840';
    btn.style.borderColor = activo ? '#5a3a8a' : 'rgba(200,149,42,0.3)';
    btn.textContent = activo ? '⏰ RETRO ACTIVO' : '⏰ RETRO';
  }
  if(bar){ bar.style.display = activo ? 'flex' : 'none'; }
  if(fechaDisp && activo){
    fechaDisp.textContent = (window._reciboRetroactivoFechaPersonalizada||'') + ' ' + (window._reciboRetroactivoHoraPersonalizada||'');
  }
}

// ── Helpers del modal de cancelación ──

function seleccionarTipoCancelacion(tipo){
  ['ingreso','egreso','sin'].forEach(t => {
    const el = document.getElementById('cancel-opt-'+t);
    if(el) el.style.borderColor = t===tipo ? (t==='ingreso'?'#27500A':t==='egreso'?'#8a1a1a':'#666') : '#ddd';
  });
  const wrap = document.getElementById('cancel-monto-wrap');
  const lbl  = document.getElementById('cancel-monto-label');
  if(tipo === 'sin'){
    wrap.style.display = 'none';
  } else {
    wrap.style.display = 'block';
    lbl.textContent = tipo==='ingreso' ? 'Monto a cobrar al cliente ($)' : 'Monto a reintegrar al cliente ($)';
  }
  const radio = document.querySelector('input[name="cancel-tipo"][value="'+tipo+'"]');
  if(radio) radio.checked = true;
  window._cancelTipoSeleccionado = tipo;
}

async function ejecutarTramiteCancelado(){
  if(!reciboEnConsulta){ showModal('Error','No hay un recibo en consulta.'); return; }
  const auth = await pedirAutorizacion();
  if(auth === null){ setStatus('ok','Cancelación anulada — autorización no proporcionada','ok'); return; }
  window._autorizacionCancelacion = auth;
  document.getElementById('cancelacion-motivo').value = '';
  document.getElementById('cancelacion-monto').value = '';
  document.getElementById('cancelacion-concepto-interno').value = '';
  document.getElementById('cancel-monto-wrap').style.display = 'none';
  window._cancelTipoSeleccionado = null;
  ['ingreso','egreso','sin'].forEach(t => {
    const el = document.getElementById('cancel-opt-'+t);
    if(el) el.style.borderColor = '#ddd';
    const radio = document.querySelector('input[name="cancel-tipo"][value="'+t+'"]');
    if(radio) radio.checked = false;
  });
  document.getElementById('modal-cancelacion').classList.add('show');
  document.getElementById('cancelacion-motivo').focus();
}

async function confirmarCancelacion(){
  const recibo = reciboEnConsulta;
  if(!recibo) return;
  if(esPeriodoCerrado(recibo.fecha || recibo.fecha_recibo, recibo.hora || recibo.hora_recibo || '00:00')){
    toast(_msgPeriodoCerrado(), 'err'); return;
  }
  const motivo = document.getElementById('cancelacion-motivo').value.trim();
  const tipoCancelacion = window._cancelTipoSeleccionado;
  const montoInput = parseFloat(document.getElementById('cancelacion-monto').value) || 0;
  if(!tipoCancelacion){
    if(typeof toast==='function') toast('⚠ Selecciona el tipo de cancelación','err');
    return;
  }
  if((tipoCancelacion==='ingreso' || tipoCancelacion==='egreso') && montoInput <= 0){
    if(typeof toast==='function') toast('⚠ Ingresa el monto','err');
    return;
  }
  document.getElementById('modal-cancelacion').classList.remove('show');
  const auth = window._autorizacionCancelacion || null;
  window._autorizacionCancelacion = null;
  // Capturar desde el DOM antes de cerrar el modal (cerrarConsulta limpia globals)
  const _conceptoInterno = (document.getElementById('cancelacion-concepto-interno')?.value || '').trim();
  const _retroCanConf = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  const _fechaCanConf = _retroCanConf ? window._reciboRetroactivoFechaPersonalizada : new Date().toISOString().slice(0,10);
  const _horaCanConf  = _retroCanConf ? (window._reciboRetroactivoHoraPersonalizada || '00:00') : new Date().toTimeString().slice(0,5);
  if(!appData.historialPagos) appData.historialPagos = {};
  if(!appData.historialPagos[recibo.folio]) appData.historialPagos[recibo.folio] = [];
  appData.historialPagos[recibo.folio].push({
    folio: recibo.folio,
    fecha: _retroCanConf ? new Date(_fechaCanConf + 'T12:00:00').toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'),
    tipo: 'CANCELADO',
    pago: 0,
    saldoRestante: recibo.saldoPendiente || 0
  });
  actualizarArchivoControl().catch(e=>console.warn('Control:',e));
  renderHistorial();
  // Capturar retro ANTES de cerrarConsulta() que limpia los globals vía limpiarFormCompleto()
  const _retroOptsCanConf = { activo: _retroCanConf, fecha: _fechaCanConf, hora: _horaCanConf };
  cerrarConsulta();
  // Los tres tipos generan folio B — sin movimiento genera folio en $0 como precedente documental
  setTimeout(async () => {
    await _lanzarFolioCancelacion(recibo, tipoCancelacion, tipoCancelacion==='sin' ? 0 : montoInput, motivo, auth, _retroOptsCanConf, _conceptoInterno);
  }, 400);
}

async function _lanzarFolioCancelacion(recibo, tipo, monto, motivo, auth, retroOpts, conceptoInterno){
  // Etiqueta del movimiento
  const etiqueta = tipo==='ingreso' ? 'Honorarios por cancelación'
    : tipo==='egreso' ? 'Reintegro por cancelación'
    : 'Cancelación sin movimiento económico';

  // ── 1. Calcular letra del folio B/C/D ──
  const letrasUsadas = (appData.recibos||[])
    .filter(_r => _r.folio === recibo.folio && !_r.esComplemento)
    .map(_r => (_r.letra||'A').toUpperCase().charCodeAt(0));
  const letraBase = (recibo.letra||'A').toUpperCase().charCodeAt(0);
  const maxLetra  = letrasUsadas.length > 0 ? Math.max(...letrasUsadas) : letraBase;
  const letraActual = String.fromCharCode(maxLetra + 1);
  const folioLetraStr = folioConLetra(recibo.folio, recibo.anio_folio, letraActual);

  // ── 2. Fecha/hora — retroOpts tiene prioridad (capturado antes de que limpiarFormCompleto limpie globals) ──
  const _retroOptActivo = !!(retroOpts?.activo && retroOpts?.fecha);
  const _retroCan = _retroOptActivo || !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  const ahora     = _retroCan ? (_retroOptActivo ? retroOpts.fecha : window._reciboRetroactivoFechaPersonalizada) : (typeof fechaCDMX_ISO === 'function' ? fechaCDMX_ISO() : new Date().toISOString().slice(0,10));
  const horaAhora = _retroCan ? (_retroOptActivo ? (retroOpts.hora || '00:00') : (window._reciboRetroactivoHoraPersonalizada || '00:00')) : (typeof horaCDMX_HHMM === 'function' ? horaCDMX_HHMM() : new Date().toTimeString().slice(0,5));
  const fechaHoraStr = ahora + ' ' + horaAhora + ' hrs.';

  // ── 3. Construir el pago parcial de cancelación (monto = 0 para no alterar saldos) ──
  // El movimiento va en pagosParciales como registro histórico al final del PDF
  // SIN sumar ni restar al total del trámite original
  const ppCancelacion = {
    concepto: etiqueta,
    descripcion: '',  // descripción vacía — el motivo solo va en el bloque rojo
    cantidad: '0',  // siempre 0 — no afecta sumas
    fechaHora: fechaHoraStr,
    locked: false,
    folioLetra: letraActual,
    _hasAuthInline: true
  };

  // ── 4. Fechas de impresión ──
  const fechasImpresion = (recibo.fechasImpresion && recibo.fechasImpresion.length)
    ? recibo.fechasImpresion.slice()
    : [{ fecha: recibo.fecha||recibo.fecha_recibo||'', hora: recibo.hora||recibo.hora_recibo||'', etiqueta:'Original' }];
  fechasImpresion.push({ fecha: ahora, hora: horaAhora, etiqueta: 'Cancelación' });

  // ── 5. Generar PDF ──
  setStatus('loading', 'Generando folio de cancelación ' + folioLetraStr + '...', 'loading');
  try {
    const clientes = recibo.clientes || [{nombre:recibo.nombre,movil:'',tel:'',domicilio:''}];
    const primerNombre = clientes[0].nombre || recibo.nombre;
    const qrTexto = 'LEX-MEXICO|Folio:'+folioLetraStr+'|'+primerNombre+'|CANCELACION';
    const qrDataURL = await qrToDataURL(qrTexto);

    // ⚠️ FIX: mismo respaldo que en _imprimirActualizacionReal — si un abono viene
    // sin folioLetra (dato viejo), se estampa aquí para no romper la atribución
    // en la Ficha del Folio de las versiones futuras.
    const pagosPrevios = (recibo.pagosParciales||[]).map(p=>Object.assign({},p,{locked:true, folioLetra: p.folioLetra || letraActual}));
    const costosPrevios = (recibo.costosExtra||[]).map(c=>Object.assign({},c,{locked:true}));

    // Auth tag solo para auditoría interna — NO se agrega a pagosParciales del PDF
    const authTag = 'Autorizó: ' + (auth ? auth.iniciales : '') + ' [' + (auth ? auth.fechaHora : '') + ']';

    const datos = Object.assign({}, recibo, {
      clientes,
      tramites: recibo.tramites||'',
      fecha_recibo: recibo.fecha||recibo.fecha_recibo||'',
      hora_recibo:  recibo.hora||recibo.hora_recibo||'',
      anticipo: String(recibo.anticipo||0),
      conceptos: recibo.conceptos||[],
      costosExtra: costosPrevios,
      pagosParciales: pagosPrevios,  // sin línea de cancelación — va solo en bloque rojo
      // Saldos: NO cambian — cancelación no afecta la deuda del trámite
      total: recibo.total,
      saldoPendiente: recibo.saldoPendiente,
      totalAbonado: recibo.totalAbonado||recibo.anticipo||0,
      fechasImpresion,
      letra: letraActual,
      esActualizacion: true,
      cancelado: true,
      fechaCancelacion: ahora + 'T' + horaAhora + ':00.000',
      motivoCancelacion: (motivo || 'Sin motivo especificado') + (auth ? ' — Autorizó: ' + auth.iniciales + ' [' + auth.fechaHora + ']' : ''),
      cancelacionConceptoInterno: conceptoInterno || '',
      cancelacionTipo: tipo,
      cancelacionMonto: monto,
      responsable: recibo.responsable||'',
      nombre_cliente_firma: recibo.nombre_cliente_firma||''
    });

    const doc = await generarPDF(datos, recibo.folio, qrDataURL);
    const nombreArchivo = folioLetraStr + '.pdf'; // nombre corto canónico
    const pdfBase64 = doc.output('datauristring');

    // ── 6. Guardar el nuevo registro B en appData.recibos ──
    // Misma lógica robusta de detección/registro que usa _imprimirActualizacionReal()
    // (Pago Parcial / Servicio Complementario / Pago Total): localizar por folio +
    // letra EXACTA de la versión que se está cancelando, con niveles de respaldo,
    // para que la cancelación SIEMPRE quede detectada en la Ficha del Folio aunque
    // el registro original no se encuentre por la ruta principal.
    const letraOriginalCan = recibo.letra || (typeof letraVersion === 'function' ? letraVersion(recibo) : null) || 'A';
    let idx = appData.recibos.findIndex(r => r.folio === recibo.folio && !r.esComplemento && (r.letra || (typeof letraVersion === 'function' ? letraVersion(r) : null) || 'A') === letraOriginalCan);
    // FALLBACK 1: misma letra sin importar esActualizacion
    if(idx < 0) idx = appData.recibos.findIndex(r => r.folio === recibo.folio && !r.esComplemento && (r.letra || 'A') === letraOriginalCan);
    // FALLBACK 2: cualquier registro del folio que no sea complemento (toma el más reciente)
    if(idx < 0){
      const _candidatosCan = appData.recibos.map((r,i)=>({r,i})).filter(({r})=> r.folio === recibo.folio && !r.esComplemento);
      if(_candidatosCan.length > 0) idx = _candidatosCan[_candidatosCan.length - 1].i;
    }
    // FALLBACK 3: insertar como nuevo registro si definitivamente no existe
    if(idx < 0){
      console.warn('[LEX] findIndex fallback: recibo folio', recibo.folio, 'letra', letraOriginalCan, 'no encontrado en appData — insertando directamente (cancelación)');
      appData.recibos.push(Object.assign({}, recibo));
      idx = appData.recibos.length - 1;
    }
    if(idx >= 0){
      _guardarSnapshotRecibo(appData.recibos[idx], 'Cancelación');
      const nuevoRegistro = Object.assign({}, appData.recibos[idx], datos, {
        pdfBase64,
        archivo: nombreArchivo,
        letra: letraActual,
        esActualizacion: true,
        fechaActualizacion: ahora,
        horaActualizacion: horaAhora,
        cancelado: true,
        cancelacionTipo: tipo,
        cancelacionMonto: monto,
        // Preservar el modo de cobro del folio (datos puede traerlo vacío)
        modoCosto: appData.recibos[idx].modoCosto || datos.modoCosto || ''
      });
      if (typeof _revivirSiTombstone === 'function') _revivirSiTombstone(nuevoRegistro);
      appData.recibos.splice(idx + 1, 0, nuevoRegistro);

      if(typeof _guardarVersionEnSupabase === 'function')
        _guardarVersionEnSupabase(nuevoRegistro, letraActual, nombreArchivo).catch(e=>console.warn('[SB cancelacion]:',e));
    }

    // ── 7. Registrar en contabilidad ──
    // Se crea el movimiento incluso cuando monto=0 (cancelación sin cambio económico)
    // para que el folio aparezca en el año de la cancelación aunque el pago original
    // fuera de un año diferente. El monto $0 indica que no hubo flujo de efectivo.
    if(typeof D !== 'undefined' && Array.isArray(D.movimientos)){
      const tipoMov = tipo === 'ingreso' ? 'ingreso' : 'egreso';
      const mov = {
        id: 'M-CAN-' + recibo.folio + '-' + Date.now(),
        folioCaja: '',
        fecha: ahora,
        hora: horaAhora,
        // FIX (unificación de descripciones en Contabilidad): folio y nombre ya
        // tienen su propia columna — se reemplaza por el motivo real de la
        // cancelación, que sí es información nueva y útil aquí.
        descripcion: etiqueta + (motivo ? ' — ' + motivo : ''),
        nombre: recibo.nombre||'',
        folio: recibo.folio,
        letra: letraActual,
        monto: monto,
        tipo: tipoMov,
        cat: etiqueta + ' · #' + folioLetraStr,
        estatus: 'Cancelación',
        fuente: 'recibo',
        // Mismo fix que en _imprimirActualizacionReal: usar el responsable del
        // trámite (elegido por el admin al crear el folio), no empNombre().
        responsable: recibo.responsable || (typeof empNombre === 'function' ? empNombre() : '')
      };
      _registrarMovimiento(mov);
    }

    // ── 8a. Persistir concepto interno en R2 (lex-expedientes) ──
    // Se guarda como archivo .txt separado para que sobreviva syncs ligeros.
    // Ruta: {despacho_id}/concepto_cancelacion/{anio}/{folio}.txt
    if(conceptoInterno && window.subirR2 && window.SB_DESPACHO_ID){
      try{
        const _anioConc  = recibo.anio_folio || new Date().getFullYear();
        const _pathConc  = window.SB_DESPACHO_ID+'/concepto_cancelacion/'+_anioConc+'/'+recibo.folio+'.txt';
        const _blobConc  = new Blob([conceptoInterno],{type:'text/plain'});
        const _fileConc  = new File([_blobConc], recibo.folio+'.txt',{type:'text/plain'});
        window.subirR2(_fileConc, _pathConc, 'expedientes').catch(e=>console.warn('[ConceptoCancelR2]',e));
      }catch(e){ console.warn('[ConceptoCancelR2 init]',e); }
    }

    // ── 8b. Guardar y renderizar ──
    if(typeof actualizarArchivoControl === 'function')
      await actualizarArchivoControl().catch(e=>console.warn('[Control cancelacion]:',e));
    if(typeof save === 'function') save();
    if(typeof renderHistorial === 'function') renderHistorial();
    if(typeof renderCaja === 'function') renderCaja();
    if(typeof renderContab === 'function') renderContab();
    try { await syncEstadoSupabase(); } catch(e){ syncEstadoSupabaseDebounced().catch(()=>{}); }

    // ── 9. Imprimir ──
    reemplazarPDFenDrive(doc.output('blob'), nombreArchivo).catch(e=>console.warn('[Drive cancelacion]:',e));
    setStatus('ok', 'Folio ' + folioLetraStr + ' de cancelación generado', 'ok');
    imprimirDesdeBlob(doc.output('blob'), nombreArchivo);

    if(typeof siguienteFolio === 'function'){
      setTimeout(()=>{ try{ window._vieneDePagoActualizacion = true; siguienteFolio(); }catch(e){} }, 700);
    }

  } catch(e){
    console.error('[Cancelacion folio B]', e);
    setStatus('err', 'Error al generar folio de cancelación: ' + e.message, 'err');
    showModal('Error', 'No se pudo generar el folio de cancelación: ' + e.message);
  }
}

async function _confirmarCancelacionReal(recibo, motivo, auth){
  window._autorizacionCancelacion = null;
  const folio = folioConLetra(recibo.folio, recibo.anio_folio, recibo.letra||letraVersion(recibo)||'A');
  // Restaurar status-bar antes de operar
  const _sbCanR = document.querySelector('.status-bar');
  if(_sbCanR) _sbCanR.removeAttribute('style');
  const _retroCanReal = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  const _fechaCanReal = _retroCanReal ? window._reciboRetroactivoFechaPersonalizada : new Date().toISOString().slice(0,10);
  const _horaCanReal  = _retroCanReal ? (window._reciboRetroactivoHoraPersonalizada || '00:00') : new Date().toTimeString().slice(0,5);
  recibo.cancelado = true;
  recibo.fechaCancelacion = _retroCanReal ? (_fechaCanReal + 'T' + _horaCanReal + ':00.000') : new Date().toISOString();
  recibo.motivoCancelacion = (motivo || 'Sin motivo especificado')
    + (auth ? ' \u2014 Autoriz\u00f3: ' + auth.iniciales + ' [' + auth.fechaHora + ']' : '');
  if(!appData.historialPagos) appData.historialPagos = {};
  if(!appData.historialPagos[recibo.folio]) appData.historialPagos[recibo.folio] = [];
  appData.historialPagos[recibo.folio].push({
    folio: recibo.folio,
    fecha: _retroCanReal ? new Date(_fechaCanReal + 'T12:00:00').toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'),
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
    const nombreArch = (typeof folioConLetra==='function' ? folioConLetra(folio, recibo.anio_folio, recibo.letra||'A') : String(folio)) + '.pdf'; // nombre corto canónico
    recibo.pdfBase64 = docCan.output('datauristring');
    reemplazarPDFenDrive(docCan.output('blob'), nombreArch).catch(e=>console.warn('SB cancel:',e));
  } catch(e){ console.warn('PDF cancelado no regenerado:', e); }
  actualizarArchivoControl().catch(e=>console.warn('Control:',e));
  renderHistorial();
  cerrarConsulta();
  // ─── REGRESO AUTOMÁTICO A PÁGINA PRINCIPAL ────────────────────────
  setTimeout(() => {
    try {
      if(typeof siguienteFolio === 'function'){
        window._vieneDePagoActualizacion = true;
        siguienteFolio();
      } else if(typeof limpiarFormCompleto === 'function'){
        limpiarFormCompleto();
      }
      setStatus('ok', 'Recibo #'+folio+' cancelado · Listo para el siguiente recibo', 'ok');
    } catch(e){
      console.error('[post-cancelacion]', e);
    }
  }, 200);
  if(typeof toast === 'function'){
    toast('🚫 Recibo #'+folio+' cancelado');
  }
}
lastPdfBlob = null;
lastActualizacionBlob = null;
lastActualizacionNombre = null;
pendingNextFolio = null; // Folio siguiente pendiente — se aplica al presionar 'Siguiente Folio'
// ── OVERLAY DRIVE-REQUERIDO ──────────────────────────────────────────────────
// Almacena la acción que se intentó ejecutar sin sesión Supabase,
// para reintentarla automáticamente al conectarse exitosamente.
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
  // Cambiar texto del botón mientras conecta
  const btnConnect = document.getElementById('btn-drive-overlay-connect');
  if(btnConnect){ btnConnect.disabled = true; btnConnect.textContent = '⏳ Conectando...'; }
  // Llamar al flujo normal de autenticación
  iniciarDriveAuth();
  // Esperar a que el token aparezca (polling cada 600ms, máximo 60s)
  let espera = 0;
  const MAX_ESPERA = 60000;
  const INTERVALO = 600;
  while(espera < MAX_ESPERA){
    await new Promise(r => setTimeout(r, INTERVALO));
    espera += INTERVALO;
    if(sbSession && Date.now() < sbExpiry){
      // Conectado ✓ — cerrar overlay y reintentar la acción pendiente
      cerrarDriveOverlay();
      if(btnConnect){ btnConnect.disabled = false; btnConnect.textContent = '🔑 Iniciar sesión en Supabase'; }
      // Reintentar la acción que se interrumpió
      // FIX (caso real: "Restaurar Recibo" no reintentaba tras reconectar
      // sesión expirada): esta lista solo cubría 2 de las 6 acciones que
      // realmente usan mostrarDriveOverlay(acción) en todo el sistema — las
      // otras 4 (incluida guardarRestauracion) se descartaban en silencio: el
      // overlay se cerraba, pero la acción que el usuario pidió nunca se
      // volvía a ejecutar, y no había ningún aviso de que se había perdido.
      // Se completa la lista con las 6 acciones reales.
      if(_pendingActionAfterDrive){
        const acc = _pendingActionAfterDrive;
        _pendingActionAfterDrive = null;
        if(acc === 'guardarRecibo')                { setTimeout(guardarRecibo, 400); }
        else if(acc === 'imprimirActualizacion')   { setTimeout(imprimirActualizacion, 400); }
        else if(acc === 'guardarRestauracion')     { setTimeout(guardarRestauracion, 400); }
        else if(acc === 'guardarEdicionCompleta')  { setTimeout(guardarEdicionCompleta, 400); }
        else if(acc === 'adminGuardarEdicionMov')  { setTimeout(adminGuardarEdicionMov, 400); }
        else if(acc === 'adminReordenarFolios')    { setTimeout(adminReordenarFolios, 400); }
      }
      return;
    }
  }
  // Timeout — restaurar botón
  if(btnConnect){ btnConnect.disabled = false; btnConnect.textContent = '🔑 Iniciar sesión en Supabase'; }
  setStatus('err','No se pudo conectar. Intenta de nuevo.','err');
}
function congelarFormulario() {
  const _folioAudit = document.getElementById('folio-display')?.textContent || '—';
  const _clienteAudit = document.querySelector('#clientes-wrapper .cliente-row input')?.value || '—';
  auditoriaRegistrar('impresion', 'Recibo impreso — Folio #' + _folioAudit + ' — Cliente: ' + _clienteAudit);
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
  // ── PASO 1: El folio ya fue incrementado en Drive al imprimir.
  // Solo limpiar pendingNextFolio por si quedó algún valor residual ──
  try {
    pendingNextFolio = null;
  } catch(e){ console.warn('[siguienteFolio:folio]', e); }
  // ── PASO 2: Si veníamos de modo actualización, desmontar primero ──
  // Esto se hace ANTES de limpiar para que limpiarFormCompleto trabaje en un DOM normalizado.
  try {
    const enActualizacion = document.body.classList.contains('modo-actualizacion')
                         || document.body.classList.contains('actualizacion-impresa')
                         || document.body.classList.contains('desde-liquidacion');
    if (enActualizacion && typeof cancelarActualizacion === 'function'){
      cancelarActualizacion();
    }
  } catch(e){ console.warn('[siguienteFolio:cancelarAct]', e); }
  // ── PASO 3: Descongelar formulario (quita banner, restaura action panels) ──
  try {
    if(typeof descongelarFormulario === 'function') descongelarFormulario();
  } catch(e){ console.warn('[siguienteFolio:descongelar]', e); }
  // ── PASO 4: LIMPIEZA TOTAL (modo nativo virgen) ──
  // limpiarFormCompleto ya tiene try/catch internos por paso, así que es idempotente y seguro.
  try {
    limpiarFormCompleto();
  } catch(e){ console.error('[siguienteFolio:limpiar]', e); }
  // ── PASO 5: Leer folio actual desde Supabase y mostrar ──
  try {
    if(typeof generarQRPreview === 'function') generarQRPreview();
    // Si venimos de un pago/actualización (Pago Total, Pago Parcial, Servicio
    // Complementario), NO leemos folio_actual de Supabase porque:
    //   1. No se consumió un folio nuevo — solo se generó una letra B/C/D.
    //   2. actualizarArchivoControl() ya subió appData.folioActual (correcto) a SB.
    //   3. La lectura asíncrona puede llegar tarde y pisar el display con el folio
    //      del SIGUIENTE recibo principal en lugar de mantenerse limpio.
    // En este caso confiamos en appData.folioActual que ya es el valor correcto.
    const _skipSBRead = !!window._vieneDePagoActualizacion;
    window._vieneDePagoActualizacion = false; // consumir la bandera siempre
    if(!_skipSBRead && window.SB && window.SB_DESPACHO_ID){
      // Leer folio_actual directo de Supabase para evitar desfases (recibo nuevo)
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
          setStatus('ok', 'Folio #'+folioFormato(appData.folioActual)+' listo — formulario en blanco', 'ok');
        }).catch(function(){
          if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
          setStatus('ok', 'Folio #'+folioFormato(appData.folioActual)+' listo — formulario en blanco', 'ok');
        });
    } else {
      if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
      setStatus('ok', 'Folio #'+folioFormato(appData.folioActual)+' listo — formulario en blanco', 'ok');
    }
  } catch(e){ console.warn('[siguienteFolio:qr]', e); }
  // ── PASO 6: Regresar el scroll al inicio del formulario ──────────────────
  // FIX (caso real: "genero un recibo y al regresar la página queda a la mitad,
  // cerca del QR/Imprimir/Historial en vez de arriba en Cliente/Folio"): esta
  // función limpia todo para el SIGUIENTE recibo, pero nunca movía el scroll —
  // el usuario se quedaba viendo la parte baja de la pantalla justo donde
  // estaba cuando imprimió, dando la impresión de que el sistema no había
  // vuelto a su estado normal. Mismo patrón ya usado en salirModoConsulta().
  try {
    setTimeout(()=>{
      const rb = document.getElementById('recibo-body');
      if(rb) rb.scrollIntoView({behavior:'smooth', block:'start'});
      else window.scrollTo({top:0, behavior:'smooth'});
    }, 150);
  } catch(e){ console.warn('[siguienteFolio:scroll]', e); }
}
function reimprimirRecibo() {
  if (!lastPdfBlob) { setStatus('err','No hay recibo disponible para reimprimir','err'); return; }
  imprimirDesdeBlob(lastPdfBlob, nombreArchivo);
}
// ── VISOR DE RECIBO ──────────────────────────────────────────────────────
// A petición expresa: (1) nunca debe verse una pestaña en blanco mientras se
// genera el PDF (parecía un error), y (2) de preferencia debe abrirse en una
// pestaña INDEPENDIENTE, sin bloquear la página del sistema. Este punto
// (llamado justo cuando el PDF ya está listo — nunca antes, nunca durante un
// modal) es el más tardío posible dentro del flujo, así que es el momento con
// más probabilidad de que el navegador SÍ permita abrir la pestaña. Por eso
// primero se intenta window.open() (pestaña real e independiente); solo si el
// navegador la bloquea (Brave, por ejemplo) se usa como respaldo el visor
// embebido en la misma página, para que el usuario siempre pueda ver el PDF
// de alguna forma y nunca se quede con una descarga forzada sin explicación.
function _mostrarVisorReciboPDF(blob, nombreArchivo){
  var nombre = nombreArchivo || 'Recibo.pdf';
  var url = URL.createObjectURL(blob);
  var winIndependiente = window.open(url, '_blank');
  if (winIndependiente) {
    // Pestaña independiente abierta con éxito — no se necesita el visor
    // embebido. Se libera la URL hasta un buen rato después, dando tiempo de
    // sobra a que la pestaña termine de cargar el PDF.
    setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} }, 60000);
    return;
  }
  // Pestaña bloqueada por el navegador — respaldo: visor embebido en la misma
  // página (overlay + iframe), nunca una descarga forzada sin avisar.
  // Si había un visor anterior abierto, liberar su URL antes de reemplazarlo.
  _cerrarVisorReciboPDF();
  var overlay = document.createElement('div');
  overlay.id = 'recibo-pdf-visor-overlay';
  overlay.dataset.blobUrl = url;
  overlay.style.cssText = 'position:fixed;inset:0;z-index:150000;background:rgba(20,14,4,0.85);display:flex;flex-direction:column;';
  overlay.innerHTML =
      '<div style="background:#1a1a0e;padding:10px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(200,149,42,0.3);flex-shrink:0;">'
    +   '<span style="font-size:16px;">📄</span>'
    +   '<span style="font-size:0.85rem;font-weight:700;color:#f0d890;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escHTML(nombre)+'</span>'
    +   '<button onclick="_imprimirDesdeVisorReciboPDF()" style="border:1px solid #c8951a;border-radius:6px;padding:6px 14px;font-size:0.72rem;font-weight:700;color:#f0d890;background:rgba(200,149,42,0.15);cursor:pointer;">🖨 Imprimir</button>'
    +   '<a href="'+url+'" download="'+escHTML(nombre)+'" style="border:1px solid #c8951a;border-radius:6px;padding:6px 14px;font-size:0.72rem;font-weight:700;color:#f0d890;text-decoration:none;background:rgba(200,149,42,0.15);">⬇ Guardar</a>'
    +   '<button onclick="_cerrarVisorReciboPDF()" style="background:#c0392b;border:none;border-radius:6px;color:#fff;font-size:0.8rem;font-weight:700;padding:6px 14px;cursor:pointer;">✕ Cerrar</button>'
    + '</div>'
    + '<iframe id="recibo-pdf-visor-iframe" src="'+url+'" style="flex:1;border:none;background:#525659;"></iframe>';
  document.body.appendChild(overlay);
}
function _imprimirDesdeVisorReciboPDF(){
  var f = document.getElementById('recibo-pdf-visor-iframe');
  if(f && f.contentWindow){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ console.warn('[imprimir visor recibo]', e); } }
}
function _cerrarVisorReciboPDF(){
  var overlay = document.getElementById('recibo-pdf-visor-overlay');
  if(!overlay) return;
  var url = overlay.dataset.blobUrl;
  overlay.remove();
  if(url){ try{ URL.revokeObjectURL(url); }catch(e){} }
}
function imprimirDesdeBlob(blob, nombreArchivo) {
  _mostrarVisorReciboPDF(blob, nombreArchivo);
}
// ── MODAL DE AUTORIZACIÓN (aparece ANTES del modal de placas) ──
// Devuelve una Promise que resuelve a {iniciales, nombre, fechaHora} si confirma, o null si cancela.
_autorizacionPromiseResolver = null;
// Calcula iniciales con punto a partir del nombre completo. Ej: "Antonieta Chávez Montar" → "A.C.M."
// Ignora títulos profesionales (Lic., Mtro., Dr., etc.) y conectores (de, del, la, etc.)
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
  display.textContent = iniciales || '—';
}
function pedirAutorizacion(){
  return new Promise((resolve) => {
    _autorizacionPromiseResolver = resolve;
    const emailActual = (empleadoActual && empleadoActual.email) ? empleadoActual.email.toLowerCase() : '';
    const esAdmin = emailActual === ADMIN_EMAIL.toLowerCase();
    // Timestamp — si hay modo retro activo, mostrar la fecha retroactiva
    const tsPreview = document.getElementById('auth-timestamp-preview');
    const _retroActivo = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
    let tsStr;
    if(_retroActivo){
      const _rf = window._reciboRetroactivoFechaPersonalizada; // YYYY-MM-DD
      const _rh = window._reciboRetroactivoHoraPersonalizada || '00:00';
      const _retroDate = new Date(_rf + 'T' + _rh + ':00');
      tsStr = _retroDate.toLocaleString('es-MX', {
        weekday:'short', day:'numeric', month:'short', year:'numeric',
        hour:'2-digit', minute:'2-digit'
      });
      tsPreview.style.background = '#fff8e0';
      tsPreview.style.borderColor = '#c8952a';
      tsPreview.style.color = '#7a4010';
      tsPreview.textContent = '\ud83d\udcc5 Se registrar\u00e1 (RETRO): ' + tsStr.toUpperCase();
    } else {
      const nowStr = new Date().toLocaleString('es-MX', {
        timeZone:'America/Mexico_City',
        weekday:'short', day:'numeric', month:'short', year:'numeric',
        hour:'2-digit', minute:'2-digit', second:'2-digit'
      });
      tsPreview.style.background = '';
      tsPreview.style.borderColor = '';
      tsPreview.style.color = '';
      tsPreview.textContent = '\ud83d\udcc5 Se registrar\u00e1: ' + nowStr.toUpperCase() + ' (CDMX)';
    }
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
      // Ajustar subtítulo
      const sub = document.querySelector('.auth-modal-sub');
      if(sub) sub.innerHTML = 'Autorizas como <strong>' + escHTML(nombre) + '</strong>.<br>¿Confirmas esta acción?';
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
  // Obtener el nombre según el rol
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
  const _retroActAuth = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  let fechaHora;
  if(_retroActAuth){
    const _rf = window._reciboRetroactivoFechaPersonalizada;
    const _rh = window._reciboRetroactivoHoraPersonalizada || '00:00';
    fechaHora = new Date(_rf + 'T' + _rh + ':00').toLocaleString('es-MX', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
  } else {
    fechaHora = new Date().toLocaleString('es-MX', {
      timeZone:'America/Mexico_City',
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
  }
  // Restaurar visibilidad original del modal para la próxima vez
  $('auth-nombre-completo').style.display = '';
  const inicialesRow = document.getElementById('auth-iniciales-display');
  if(inicialesRow && inicialesRow.parentElement) inicialesRow.parentElement.style.display = '';
  const sel = document.getElementById('auth-selector-empleado');
  if(sel) sel.style.display = 'none';
  const sub = document.querySelector('.auth-modal-sub');
  if(sub) sub.innerHTML = 'Para continuar, registra el <strong>nombre completo</strong> del empleado que autoriza este movimiento.<br><em>Las iniciales se calcularán automáticamente.</em>';
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
// ── MODAL DE CAPTURA DE PLACAS (flujo Pago Total → Imprimir Actualización) ──
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
    if($('placas-sin-placas')) $('placas-sin-placas').checked = false;
    if($('placas-tipo')){ $('placas-tipo').value = 'placas'; actualizarLabelPlacas(); }
    $('placas-error-msg').classList.remove('show');
    $('placas-error-msg').textContent = '';
    // Mostrar el modal y enfocar el primer campo
    document.getElementById('modal-placas').classList.add('show');
    setTimeout(()=>$('placas-numero').focus(), 80);
  });
}
function togglePlacasSinPlacasFromRow(ev){
  const chk = $('placas-sin-placas');
  if(!chk) return;
  chk.checked = !chk.checked;
  aplicarEstadoSinPlacas();
}
function aplicarEstadoSinPlacas(){
  const chk = $('placas-sin-placas');
  if(!chk) return;
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
    r(null); // null = cancelar impresión
  }
}
function omitirModalPlacas(){
  // Continúa la impresión sin registrar placas (se podrán agregar después)
  document.getElementById('modal-placas').classList.remove('show');
  if(_placasPromiseResolver){
    const r = _placasPromiseResolver;
    _placasPromiseResolver = null;
    r({ placas: null, estado: null }); // omitido → continúa sin placas
  }
}
function actualizarLabelPlacas(){
  const tipo = ($('placas-tipo')||{value:'placas'}).value;
  const lbl = document.getElementById('placas-numero-label');
  const inp = $('placas-numero');
  if(tipo === 'placas'){
    if(lbl) lbl.textContent = 'Número de placas';
    if(inp){ inp.placeholder = 'Ej. ABC-123-D'; inp.maxLength = 9; }
  } else if(tipo === 'tarjeta'){
    if(lbl) lbl.textContent = 'Folio de tarjeta de circulación';
    if(inp){ inp.placeholder = 'Ej. 1234567890'; inp.maxLength = 20; }
  } else {
    if(lbl) lbl.textContent = 'Descripción';
    if(inp){ inp.placeholder = 'Ej. Permiso temporal'; inp.maxLength = 40; }
  }
}
// Formateo del campo según el tipo de documento elegido:
//  • placas  → formato de placa XXX-XXX-X (máx. 7 alfanuméricos)
//  • tarjeta / otro → folio libre (5–12+ caracteres), solo mayúsculas, sin guiones forzados
function formatearCampoPlacas(inp){
  const tipo = (document.getElementById('placas-tipo')||{value:'placas'}).value;
  if(tipo === 'placas'){
    formatearPlaca(inp);
  } else {
    const posF = inp.selectionStart;
    inp.value = inp.value.toUpperCase();
    try { inp.setSelectionRange(posF, posF); } catch(e){}
  }
}
function confirmarModalPlacas(){
  const sinPlacas = $('placas-sin-placas') ? $('placas-sin-placas').checked : false;
  const errBox = $('placas-error-msg');
  const tipo = ($('placas-tipo')||{value:'placas'}).value;
  let placas = '';
  let estado = '';
  if(sinPlacas){
    placas = 'SIN PLACAS';
    estado = 'N/A — vehiculo nuevo o trámite sin placas';
  } else {
    placas = $('placas-numero').value.trim().toUpperCase();
    estado = $('placas-estado').value;
    // Prefijo según tipo
    if(tipo === 'tarjeta') placas = 'TARJETA: ' + placas;
    else if(tipo === 'otro') placas = 'OTRO: ' + placas;
    // Validación
    const errores = [];
    if(!$('placas-numero').value.trim()) errores.push('Ingresa el número o folio correspondiente o marca "Sin placas".');
    if(tipo === 'placas' && !estado) errores.push('Selecciona el estado emisor de las placas.');
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
// ── VALIDACIÓN ───────────────────────────────────────────────────
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
  // Campo tramites eliminado — ya no se valida
  if(!conceptos.length || total <= 0)
    advertencias.push('No hay conceptos con precio. Agrega al menos un concepto mayor a $0.');
  if(anticipo > total && total > 0)
    advertencias.push('El anticipo ($'+fmtMXN(anticipo)+') supera el total ($'+fmtMXN(total)+'). Verifica el monto.');
  if(!$('responsable').value.trim())
    advertencias.push('El campo "Responsable del Trámite" está vacío.');
  return advertencias;
}
function cerrarModalValidacion(){ document.getElementById('modal-validacion').classList.remove('show'); _guardarForzado=false; }
function guardarDeTodasFormas(){
  document.getElementById('modal-validacion').classList.remove('show');
  _guardarForzado = true;
  guardarRecibo();
}
// ── GUARDAR RECIBO NORMAL ────────────────────────────────────────
_saltarModalVehicular = false;
// ═══ MODAL DE CONFIRMACIÓN ════════════════════════════════════════
let _confirmacionCallback = null;
let _confirmacionCallbackCancelar = null;
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
  _confirmacionCallback         = (typeof opts.onAceptar  === 'function') ? opts.onAceptar  : null;
  _confirmacionCallbackCancelar = (typeof opts.onCancelar === 'function') ? opts.onCancelar : null;
  document.getElementById('modal-confirmar-recibo').classList.add('show');
}
function confirmarRecibo_Aceptar(){
  document.getElementById('modal-confirmar-recibo').classList.remove('show');
  const cb = _confirmacionCallback;
  _confirmacionCallback         = null;
  _confirmacionCallbackCancelar = null;
  if(typeof cb === 'function') {
    try { cb(); } catch(e){ console.error('[confirmarRecibo_Aceptar]', e); }
  }
}
function confirmarRecibo_Cancelar(){
  document.getElementById('modal-confirmar-recibo').classList.remove('show');
  const cbCancel = _confirmacionCallbackCancelar;
  _confirmacionCallback         = null;
  _confirmacionCallbackCancelar = null;
  if(typeof cbCancel === 'function'){
    try { cbCancel(); } catch(e){ console.error('[confirmarRecibo_Cancelar]', e); }
  }
}
// ── Eliminar pendiente de placas al liquidar recibo ──────────────────
function _eliminarPendientePorFolio(folio) {
  if (typeof D === 'undefined' || !Array.isArray(D.pendientes)) return;
  const idPend = 'PEND-REC-' + folio;
  const idx = D.pendientes.findIndex(p => 
    p.id === idPend || 
    (Number(p.reciboVinculadoFolio) === Number(folio) && p.seccion === 'placas')
  );
  // Guardar en lista negra para que sincronizarPendientesPlacas no lo recree
  try {
    const _lb = JSON.parse(localStorage.getItem('lex-placas-liquidados') || '[]');
    if (_lb.indexOf(String(folio)) < 0) {
      _lb.push(String(folio));
      localStorage.setItem('lex-placas-liquidados', JSON.stringify(_lb));
    }
  } catch(e) {}
  if (idx >= 0) {
    D.pendientes.splice(idx, 1);
    if (typeof save === 'function') save();
    if (typeof renderPend === 'function') renderPend();
    if (typeof badges === 'function') badges();
    if (typeof syncEstadoSupabaseDebounced === 'function') 
      syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
    console.log('[Auto-pendiente] Pendiente de placas eliminado permanentemente — folio #' + folio);
  }
}
// ═══════════════════════════════════════════════════════════════
// SELECTOR DE RESPONSABLE — solo visible para el administrador
// ═══════════════════════════════════════════════════════════════
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
// ── Helper: registrar movimiento con selección de responsable (admin) ──
function _regMov(mov) {
  elegirResponsable(function(resp) {
    mov.responsable = resp || empNombre();
    if (!_registrarMovimiento(mov)) return; // dedup bloqueó
    window._desactivarRegistrandoRecibo();
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
      + '<input type="radio" name="resp-radio" value="'+escHTML(emp.nombre)+'" '+(esDefault?'checked':'')+' style="accent-color:var(--gold);width:16px;height:16px;flex-shrink:0;">'
      + '<div><div style="font-family:sans-serif;font-size:0.9rem;font-weight:600;color:var(--ink);">'+escHTML(emp.nombre)+'</div>'
      + '<div style="font-family:monospace;font-size:0.58rem;color:var(--muted);">'+escHTML(emp.email)+(emp.esAdmin ? ' · Administrador' : ' · Empleado')+'</div></div>'
      + '</label>';
  }).join('');
  ov.innerHTML = '<div style="background:var(--surface,#1a1510);border:1.5px solid rgba(200,149,42,0.35);border-radius:14px;padding:22px;width:100%;max-width:420px;box-shadow:0 12px 48px rgba(0,0,0,0.6);">'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid rgba(200,149,42,0.15);">'
    + '<span style="font-size:1.2rem;">👤</span>'
    + '<div><div style="font-family:serif;font-size:1rem;color:var(--gold-l);font-weight:600;">¿Quién registra este movimiento?</div>'
    + '<div style="font-family:monospace;font-size:0.6rem;color:var(--muted);margin-top:2px;">Selecciona el responsable que aparecerá en contabilidad</div></div>'
    + '</div>'
    + '<div id="resp-opciones">' + opciones + '</div>'
    + '<div style="display:flex;gap:10px;margin-top:16px;">'
    + '<button onclick="respCancelar()" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(200,149,42,0.25);background:none;color:var(--muted);cursor:pointer;font-size:0.85rem;">Cancelar</button>'
    + '<button onclick="respConfirmar()" style="flex:2;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#fff;font-weight:700;cursor:pointer;font-size:0.88rem;">✓ Confirmar</button>'
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
  // _activarRegistrandoRecibo se activa después de pasar todas las validaciones (L11769)
  // ── GUARDIA DE SESIÓN: si no hay conexión, mostrar panel central ──
  if(!sbSession || Date.now() >= sbExpiry){
    mostrarDriveOverlay('guardarRecibo');
    window._desactivarRegistrandoRecibo(); mostrarDriveOverlay('guardarRecibo'); return;
  }
  const clientes=getClientes();
  if(!clientes.length||!clientes[0].nombre){ window._desactivarRegistrandoRecibo(); setStatus('err','Ingresa el nombre del cliente','err'); return; }
  // (El modal vehicular antiguo de "descripción adicional" fue removido del flujo de creación.
  //  El modal vehicular ahora SOLO aparece en el flujo: Consultar folio → Pago Total →
  //  Imprimir Actualización, para capturar las placas generadas.)
  const conceptos=getConceptos();
  const anticipo=parsePrecio($('anticipo').value);
  const total=conceptos.reduce((s,c)=>s+(parseFloat(c.precio)||0),0);
  // Validar si no se forzó
  if(!_guardarForzado){
    const advertencias = validarAntesDeSalvar(clientes, conceptos, total, anticipo);
    if(advertencias.length){
      const ul = document.getElementById('validacion-lista');
      ul.innerHTML = advertencias.map(a=>'<li>'+a+'</li>').join('');
      document.getElementById('modal-validacion').classList.add('show');
      window._desactivarRegistrandoRecibo();
      return;
    }
  }
  _guardarForzado = false;
  // Blindaje de período: en modo retroactivo verificar que la fecha no esté en un período cerrado
  if(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada){
    if(esPeriodoCerrado(window._reciboRetroactivoFechaPersonalizada, window._reciboRetroactivoHoraPersonalizada || '00:00')){
      window._desactivarRegistrandoRecibo(); toast(_msgPeriodoCerrado(), 'err'); return;
    }
  }
  const btn=document.getElementById('btn-guardar');
  btn.disabled=true; setStatus('loading','Preparando...','loading');
  // Re-verificar hora con Drive en background (no bloquea)
  sincronizarHoraCDMX().catch((e)=>{ registrarError('Promise catch vacio', e); });
  // Actualizar hora al momento exacto de imprimir — SOLO si NO estamos en modo retroactivo
  const horaAhora = horaCDMX_HHMM();
  const fechaAhora = fechaCDMX_ISO();
  // Misma vigencia estricta que hoy()/hora() (ver _capturaRetroVigente): el modo
  // de captura de mes solo cuenta si su banner sigue visible, no ha caducado y
  // hay una fecha elegida a mano. Si no, el recibo lleva la fecha real de hoy.
  const _capMesRec = (typeof _capturaRetroVigente === 'function' ? _capturaRetroVigente() : null)
                     && window._capturaFechaManual ? window._capturaMesActivo : null;
  if (!window._reciboRetroactivoActivo && !_capMesRec) {
    $('hora_recibo').value = horaAhora;
    document.getElementById('hora_recibo_display').textContent = horaAhora + ' hrs.';
    $('fecha_recibo').value = fechaAhora;
  } else if (window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada) {
    // Modo retroactivo — blindar los campos con la fecha elegida
    $('fecha_recibo').value = window._reciboRetroactivoFechaPersonalizada;
    $('hora_recibo').value  = window._reciboRetroactivoHoraPersonalizada || horaAhora;
    document.getElementById('hora_recibo_display').textContent = ($('hora_recibo').value) + ' hrs.';
  } else if (_capMesRec) {
    // Modo captura retroactiva de mes — usar la fecha elegida explícitamente
    var _fm = window._capturaFechaManual;
    var _hm = window._capturaHoraManual || horaAhora;
    $('fecha_recibo').value = _fm;
    $('hora_recibo').value  = _hm;
    document.getElementById('hora_recibo_display').textContent = _hm + ' hrs.';
  } else {
    $('hora_recibo').value = horaAhora;
    document.getElementById('hora_recibo_display').textContent = horaAhora + ' hrs.';
    $('fecha_recibo').value = fechaAhora;
  }
  // Folio anterior: si es comprobante de abono usar _folioReferencia, si no el campo manual
  // ⚠️ CRÍTICO: leer folioAntNum ANTES de reservar folio para detectar si es abono
  const folioAntNum = window._folioReferencia || parseInt($('folio_anterior').value)||null;
  const historialPagosRef = folioAntNum ? obtenerHistorialPagosAbono(folioAntNum) : [];
  const _esAbono = !!(window._folioReferencia);

  // ── PEDIR RESPONSABLE ANTES DE RESERVAR FOLIO ────────────────────────────
  // El folio se toma en el último momento posible (dentro del try, abajo).
  // Si el usuario cancela aquí, ningún folio se quema.
  const respSelec = await new Promise(function(resolve){
    elegirResponsable(function(nombre){ resolve(nombre); });
  });
  if (!respSelec) {
    const btnAbort = document.getElementById('btn-guardar');
    if (btnAbort) btnAbort.disabled = false;
    window._desactivarRegistrandoRecibo();
    setStatus('ok', 'Guardado cancelado', 'ok');
    return;
  }
  window._respSeleccionado = respSelec;
  window._activarRegistrandoRecibo(); // ✅ aquí sí: ya pasaron todas las validaciones
  // ─────────────────────────────────────────────────────────────────────────

  const primerNombre=clientes[0].nombre;
  const saldoPendiente=Math.max(0,total-anticipo);
  // ── CORRECCIÓN BUG #2 y #3 — Cálculo de saldos en folio secundario ────────
  let _totalGeneralDatos = total;
  let _totalAbonadoDatos = anticipo;
  let _saldoNuevoDatos   = Math.max(0, total - anticipo);
  if(folioAntNum){
    const recPrim = appData.recibos.find(r => r.folio === folioAntNum);
    if(recPrim){
      _totalGeneralDatos = parseFloat(recPrim.total) || _totalGeneralDatos;
      const _yaAbonado = parseFloat(recPrim.totalAbonado) || parseFloat(recPrim.anticipo) || 0;
      _totalAbonadoDatos = _yaAbonado + anticipo;
      _saldoNuevoDatos   = Math.max(0, _totalGeneralDatos - _totalAbonadoDatos);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────
  const datos={
    folio: null, clientes,
    tramites:document.getElementById('tramites').value,
    clase:document.getElementById('clase').value,
    marca:document.getElementById('marca').value,
    tipo_veh:document.getElementById('tipo_veh').value,
    serie:document.getElementById('serie').value,
    motor:document.getElementById('motor').value,
    personas_veh:document.getElementById('personas_veh').value,
    anio:document.getElementById('anio').value,
    puertas:document.getElementById('puertas').value,
    color_veh:document.getElementById('color_veh').value,
    transmision:document.getElementById('transmision').value,
    cilindros:document.getElementById('cilindros').value,
    placa:document.getElementById('placa').value,
    placaEstado:(document.getElementById('placa-estado')||{value:''}).value||'',
    ultima_tenencia:document.getElementById('ultima_tenencia').value,
    origen:document.getElementById('origen').value,
    combustible:document.getElementById('combustible').value,
    copias:getDocumentosSeleccionados(),
    tipoTramite,
    modoCosto: (document.getElementById('modo-costo-pactado')||{}).value || '',
    fecha_recibo:$('fecha_recibo').value,
    hora_recibo:$('hora_recibo').value,
    anticipo:String(parsePrecio($('anticipo').value)),
    responsable:window._respSeleccionado || $('responsable').value || empNombre(),
    nombre_cliente_firma:$('nombre_cliente_firma').value,
    conceptos, timestamp:ahoraCDMX().toISOString(),
    folioAnterior: folioAntNum,
    historialPagosRef,
    totalGeneral: _totalGeneralDatos,
    totalAbonado: _totalAbonadoDatos,
    saldoNuevo:   _saldoNuevoDatos,
    descripcionVehicular: tipoTramite === 'vehicular' ? _descripcionVehicular : '',
    letra: window._letraAbonoRetroactivo || 'A'
  };
  try {
    // ── RESERVAR FOLIO — lo más tarde posible, ya con responsable confirmado ──
    // Si dos usuarios dan clic simultáneo, reservarFolioEnDrive() tiene lock atómico
    // y les asigna folios distintos. Si el usuario canceló antes (modal responsable),
    // nunca llegamos aquí, por lo que ningún folio se quema.
    let folio;
    if (_esAbono) {
      folio = folioAntNum;
      const _letrasUsadas = (appData.recibos || [])
        .filter(_r => _r.folio === folioAntNum && !_r.esComplemento)
        .map(_r => (_r.letra || 'A').toUpperCase().charCodeAt(0));
      const _maxLetra = _letrasUsadas.length > 0 ? Math.max(..._letrasUsadas) : 'A'.charCodeAt(0);
      const _letraNueva = String.fromCharCode(_maxLetra + 1);
      window._letraAbonoRetroactivo = _letraNueva;
      const _modoLabel = window._reciboRetroactivoActivo ? 'abono retroactivo' : 'abono';
      setStatus('loading', 'Preparando ' + _modoLabel + ' — folio #' + folioAntNum + _letraNueva + '...', 'loading');
    } else {
      window._letraAbonoRetroactivo = null;
      setStatus('loading','Reservando folio único...','loading');
      folio = await reservarFolioEnDrive();
    }
    const _letraDisplay = window._letraAbonoRetroactivo || 'A';
    $('folio-display').textContent = folioConLetra(folio, null, _letraDisplay);
    datos.folio = folio;
    datos.letra = window._letraAbonoRetroactivo || 'A';
    // ─────────────────────────────────────────────────────────────────────────
    const qrTexto='LEX-MEXICO|Folio:'+folioFormato(folio)+'|'+primerNombre+'|'+datos.fecha_recibo+' '+datos.hora_recibo;
    const qrDataURL=await qrToDataURL(qrTexto);
    const doc=await generarPDF(datos,folio,qrDataURL);
    const nombreArchivo = folioConLetra(folio, appData.anioFolioActual || new Date().getFullYear(), 'A') + '.pdf';
    const _r2NombreNuevo = _nombreArchivoR2(folioConLetra(folio, appData.anioFolioActual || new Date().getFullYear(), 'A'), primerNombre);
    setStatus('loading','Generando PDF · Folio #'+folioConLetra(folio, appData.anioFolioActual, 'A')+'...','loading');
    // Subir PDF a Supabase Storage
    subirPDFaDrive(doc.output('blob'), nombreArchivo, _r2NombreNuevo).catch(e=>console.warn('SB upload:',e));
    // guardarEnDirectorio: desactivado — el directorio ahora se llena solo manualmente
    // ── Guardar TODOS los campos necesarios para restaurar el formulario en modo actualización ──
    const copiasParsed = (()=>{
      try{ const p=JSON.parse(datos.copias||'{}'); return p.docs||[]; }catch(e){ return []; }
    })();
    // ── CRÍTICO: insertar el recibo en appData PRIMERO, luego escribir en Drive de forma BLOQUEANTE ──
    // Esto corrige el bug donde dos impresiones seguidas (ej. folio 102 y 103) hacen que
    // la segunda escritura sobreescriba la primera porque la fusión de recibos en Drive
    // no tenía el recibo #102 todavía (actualizarArchivoControl se llamaba con .catch sin await).
    appData.recibos.unshift({
      folio, anio_folio: appData.anioFolioActual || new Date().getFullYear(),
      nombre:primerNombre, fecha:datos.fecha_recibo, hora:datos.hora_recibo,
      archivo:nombreArchivo, archivoR2:_r2NombreNuevo, saldoPendiente: _saldoNuevoDatos, pdfBase64:doc.output('datauristring'),
      folioAnterior: folioAntNum,
      anticipo: String(anticipo),
      totalAbonado: _totalAbonadoDatos,
      saldoNuevo: _saldoNuevoDatos,
      conceptos: conceptos,
      total: _totalGeneralDatos,
      generadoPor: window._respSeleccionado || (empleadoActual ? empleadoActual.nombre : NOMBRE_TITULAR),
      // Datos completos del recibo para restaurar en modo actualización
      clientes: datos.clientes,
      tipoTramite: datos.tipoTramite,
      tipo_doc: document.getElementById('tipo_doc').value,
      copias: copiasParsed,
      tramites: datos.tramites,
      clase: datos.clase, marca: datos.marca, tipo_veh: datos.tipo_veh, serie: datos.serie,
      motor: datos.motor, personas_veh: datos.personas_veh, anio: datos.anio, puertas: datos.puertas,
      color_veh: datos.color_veh, transmision: datos.transmision,
      cilindros: datos.cilindros, placa: datos.placa, placaEstado: datos.placaEstado||'',
      ultima_tenencia: datos.ultima_tenencia,
      origen: datos.origen, combustible: datos.combustible,
      responsable: datos.responsable,
      nombre_cliente_firma: datos.nombre_cliente_firma,
      fecha_recibo: datos.fecha_recibo,
      hora_recibo: datos.hora_recibo,
      letra: window._letraAbonoRetroactivo || 'A'
    });
    // Si el folio recién creado coincide con un tombstone (folio reutilizado tras
    // borrar el último, o abono sobre folio eliminado), marcarlo revivido para que
    // ningún cliente lo filtre en el merge.
    if (typeof _revivirSiTombstone === 'function') _revivirSiTombstone(appData.recibos[0]);
    // Registrar folio/letra para protegerlos de tombstones ANTES de abrir la impresora
    // (por si abrir la pestaña dispara algún sync) y durante actualizarArchivoControl().
    window._folioGuardandose = folio;
    window._letraGuardandose = window._letraAbonoRetroactivo || 'A';
    // ── MOSTRAR EL PDF DE INMEDIATO (antes del guardado bloqueante) ─────────────
    // El PDF ya está listo y el recibo ya está insertado en appData. Abrir la
    // impresora aquí evita que el usuario espere las idas y vueltas de red del
    // guardado. El guardado sigue igual justo abajo, con su misma protección
    // (_folioGuardandose) y reintentos — solo dejó de bloquear la vista del PDF.
    try {
      lastPdfBlob = new Blob([doc.output('arraybuffer')], {type:'application/pdf'});
      imprimirDesdeBlob(lastPdfBlob, nombreArchivo);
      congelarFormulario();
    } catch(ePrintTemprano){ console.warn('[imprimir temprano]', ePrintTemprano); }
    // ── ESCRITURA BLOQUEANTE: esperar confirmación de Drive antes de continuar ──
    // Sin este await, una segunda impresión inmediata podría leer el JSON antes de que
    // esta escritura termine y sobrescribir borrando este recibo del historial.
    setStatus('loading','Guardando recibo #'+folioFormato(folio)+'...','loading');
    let _guardarFallo = false;
    try {
      await actualizarArchivoControl();
    } catch(eControl) {
      console.error('❌ Error crítico al guardar:', eControl);
      // Reintentar una vez más antes de continuar
      try {
        await actualizarArchivoControl();
      } catch(e2){
        console.error('❌ Segundo intento fallido:', e2);
        _guardarFallo = true;
        // Rescate: sync completo AWAITED mientras _folioGuardandose sigue activo
        try { await syncEstadoSupabase(); } catch(e3){ console.warn('[rescate sync guardarRecibo]', e3); }
      }
    }
    window._folioGuardandose = null;
    window._letraGuardandose = null;
    // El folio ya fue reservado e incrementado en Drive al inicio de guardarRecibo().
    pendingNextFolio = null;
    // ── Guardar versión inicial A en Supabase versiones_recibo ──
    _guardarVersionEnSupabase(appData.recibos[0], 'A', nombreArchivo).catch(e=>console.warn('[SB versiones] inicial:',e));
    // Si es comprobante de abono: actualizar saldo del recibo original
    // ── CORRECCIÓN BUG #1 ──────────────────────────────────────────────────────
    // Antes: se mutaban directamente los campos del registro primario (A) en memoria,
    // lo que hacía que cualquier lectura posterior del folio A viera datos del folio B.
    // Ahora: se sustituye el slot del array por una COPIA NUEVA del objeto con solo los
    // campos de saldo actualizados.  Los datos originales (fecha, anticipo, conceptos,
    // hora, pdfBase64, etc.) del folio A quedan intactos en la nueva copia.
    if(folioAntNum){
      // Buscar el recibo ORIGINAL (letra A): excluir los abonos B/C/D que tienen folioAnterior
      // Sin este filtro, el unshift() de arriba hace que findIndex() encuentre el recibo B
      // recién insertado en lugar del A, dejando a A con saldoPendiente desactualizado
      // en Supabase y provocando que PASO 2 de sincronizarPendientesPlacas lo recree.
      const idxOrig = appData.recibos.findIndex(r=>r.folio===folioAntNum && !r.folioAnterior);
      if(idxOrig>=0){
        const recOrig = appData.recibos[idxOrig];
        const nuevoAbonado = (parseFloat(recOrig.totalAbonado)||0) + anticipo;
        const nuevoSaldo   = Math.max(0,(parseFloat(recOrig.total)||0) - nuevoAbonado);
        // Reemplazar por una copia desconectada — NUNCA mutar el objeto original
        appData.recibos[idxOrig] = Object.assign({}, recOrig, {
          totalAbonado:   nuevoAbonado,
          saldoPendiente: nuevoSaldo,
          saldoNuevo:     nuevoSaldo,
          liquidado:      nuevoSaldo <= 0 ? true : (recOrig.liquidado || false)
        });
        if(nuevoSaldo<=0){
          if(typeof _eliminarPendientePorFolio === 'function') _eliminarPendientePorFolio(folioAntNum);
        }
      }
      // Limpiar referencia
      window._folioReferencia   = null;
      window._reciboOriginalRef = null;
      const banner = document.getElementById('abono-ref-banner');
      if(banner) banner.style.display='none';
    }
    // La letra del recibo — se captura aquí, ANTES de usarla (evita TDZ con const)
    const _letraGuardada = window._letraAbonoRetroactivo || 'A';
    // Mostrar el folio del recibo impreso con la letra correcta (A para nuevos, B/C/… para abonos)
    $('folio-display').textContent = folioConLetra(folio, null, _letraGuardada);
    if (_guardarFallo) {
      setStatus('err','⚠️ RECIBO #'+folioConLetra(folio, null, _letraGuardada)+' GENERADO PERO NO REGISTRADO — verifica conexión y recarga','err');
    } else {
      setStatus('ok','Recibo #'+folioConLetra(folio, null, _letraGuardada)+' guardado — abriendo impresora...','ok');
    }
    // El PDF ya se abrió y el formulario ya se congeló antes del guardado bloqueante
    // (ver "MOSTRAR EL PDF DE INMEDIATO" arriba). lastPdfBlob ya está listo para reimprimir.
    // ─── OFERTA AUTOMÁTICA DE EXPEDIENTE — solo en recibos originales (no abonos) ──
    if(!folioAntNum){
      const expNums = (appData.recibos||[])
        .map(r => r.expedienteNum).filter(Boolean)
        .map(n => parseInt((n||'').replace('CARP.-','').replace('ARCH-','')) || 0);
      const siguienteExp = (expNums.length > 0 ? Math.max(...expNums) : 0) + 1;
      const expSugerido = 'CARP.- ' + siguienteExp;
      setTimeout(() => abrirModalExpediente(folio, expSugerido, primerNombre), 1200);
    }
    // ─── FLUJO POST-IMPRESIÓN: limpiar, sincronizar y volver al panel principal ───
    // Capturamos los valores necesarios ANTES de que el formulario se limpie (evita "datos is not defined")
    const _folioGuardado        = folio;
    const _anticoGuardado       = anticipo;
    const _nombreGuardado       = primerNombre;
    const _concepto0            = conceptos && conceptos[0] ? (conceptos[0].concepto||'') : '';
    const _tipoTramiteGuardado  = tipoTramite;
    const _saldoInicialGuardado = saldoPendiente;
    const _retroFechaGuardada   = window._reciboRetroactivoFechaPersonalizada || null;
    const _retroHoraGuardada    = window._reciboRetroactivoHoraPersonalizada  || null;
    // Fecha/hora REALES que ya quedaron impresas en el PDF (campo del formulario,
    // fijado más arriba para los 3 modos posibles: normal, "recibo retroactivo" y
    // "captura retroactiva de mes"). El movimiento de abajo debe usar SIEMPRE esto
    // en vez de _retroFechaGuardada — ese solo cubre el modo "recibo retroactivo" y
    // se quedaba en blanco cuando el recibo se cargó vía "captura de mes", haciendo
    // que el movimiento cayera en hoy() aunque el PDF sí mostrara la fecha real.
    const _fechaRecGuardada = datos.fecha_recibo || _retroFechaGuardada || null;
    const _horaRecGuardada  = datos.hora_recibo  || _retroHoraGuardada  || null;
    // _letraGuardada se captura antes de imprimirDesdeBlob() — no repetir aquí
    // Marcar sync propio ANTES del timeout para proteger contra Realtime durante esos 700ms
    _ultimoSyncPropio = Date.now();
    setTimeout(async () => {
      try {
        // 1. Registrar en contabilidad PRIMERO — antes de siguienteFolio() que puede
        // disparar save() → syncEstadoSupabase() → _protegerMovimientosRecibo() y
        // encontrar el recibo sin movimiento, rescatándolo innecesariamente.
        if(typeof D !== 'undefined' && Array.isArray(D.movimientos)){
          // El ID incluye la letra para que los abonos (B, C…) no colisionen con el ID de la versión A
          const idMov = _letraGuardada === 'A'
            ? 'M-REC-' + _folioGuardado
            : 'M-REC-' + _folioGuardado + '-' + _letraGuardada;
          // FIX (caso real: folio 113 usado de prueba, borrado, y reutilizado para
          // un cliente real): al borrar un recibo se deja un tombstone en
          // D.movimientos_eliminados con este mismo id, para que una sincronización
          // vieja no lo resucite. Pero si el folio se reutiliza de verdad (como
          // aquí, un alta nueva y legítima), ese tombstone viejo seguía bloqueando
          // para siempre el movimiento nuevo — el merge lo quitaba en cada sync.
          // Al dar de alta el recibo de nuevo, ya no aplica: se purga aquí mismo.
          if(Array.isArray(D.movimientos_eliminados)){
            const _nEliminadosAntes = D.movimientos_eliminados.length;
            D.movimientos_eliminados = D.movimientos_eliminados.filter(function(t){ return !t || t.id !== idMov; });
            if(D.movimientos_eliminados.length !== _nEliminadosAntes){
              console.warn('[recibo] Folio reutilizado — tombstone viejo purgado para', idMov);
            }
          }
          // Dedup exacto por ID, o por folio+letra+fuente (evita duplicados entre reinicios)
          const _yaExisteMovRecibo = D.movimientos.some(m =>
            m.id === idMov ||
            (m.folio === _folioGuardado && (m.letra||'A') === _letraGuardada && m.fuente === 'recibo')
          );
          if(!_yaExisteMovRecibo){
            const _esSinAntCont = _anticoGuardado === 0 && _saldoInicialGuardado > 0;
            const _estatusCont  = _anticoGuardado > 0 ? 'Anticipo'
                                : (_esSinAntCont    ? 'Sin Anticipo' : 'Pendiente');
            const mov = {
              id: idMov,
              folioCaja: '',
              fecha: _fechaRecGuardada || (typeof hoy  === 'function' ? hoy()  : new Date().toISOString().split('T')[0]),
              hora:  _horaRecGuardada  || (typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5)),
              // FIX (caso real: folio 56B-56G): antes SIEMPRE usaba conceptos[0] (el
              // concepto original del trámite, ej. "ANTICIPO INICIAL — JUICIO
              // REIVINDICATORIO"), incluso en versiones B/C/D… que en realidad
              // agregaron un servicio complementario distinto o solo pagaron
              // adeudo anterior — por eso Contabilidad mostraba la misma
              // descripción genérica en todos los recibos del folio. Ahora, para
              // versiones B+, se usa el mismo criterio ya verificado para el
              // estado de cuenta: costosExtra agregados en ESTE guardado
              // (aún no bloqueados) si los hay, o "ADEUDO ANTERIOR" si el
              // recibo es de puro pago sin cargo nuevo.
              // FIX: solo CONCEPTO — DESCRIPCIÓN, sin repetir "Recibo #X · NOMBRE"
              // (folio y nombre ya tienen su propia columna en Contabilidad).
              descripcion: (function(){
                if(_letraGuardada === 'A'){
                  const c0 = conceptos && conceptos[0];
                  const conc = c0 ? (c0.concepto||'') : '';
                  const desc = c0 ? (c0.descripcion||'') : '';
                  return conc + (desc ? ' — ' + desc : '');
                }
                const ceEsta = (costosExtra||[]).filter(function(ce){ return ce && !ce.locked; });
                return ceEsta.length
                  ? ceEsta.map(function(ce){ return (ce.concepto||'') + (ce.descripcion ? ' — ' + ce.descripcion : ''); }).join(' · ')
                  : ((saldoPendiente <= 0 ? 'LIQUIDACIÓN TOTAL' : 'ABONO PARCIAL') + ' — DEL ADEUDO ANTERIOR');
              })(),
              nombre: _nombreGuardado,
              folio:  _folioGuardado,
              monto:  _anticoGuardado,
              tipo:   'ingreso',
              cat:    _estatusCont + ' · #' + folioConLetra(_folioGuardado, appData.anioFolioActual || new Date().getFullYear(), _letraGuardada),
              estatus: _estatusCont,
              fuente: 'recibo',
              letra:  _letraGuardada,
              // Mismo responsable que ya quedó resuelto para el PDF (window._respSeleccionado,
              // elegido por el admin vía el modal "¿Quién registra este movimiento?", o el valor
              // del campo del formulario) — antes esto ignoraba esa selección por completo y
              // siempre usaba empNombre() (quien tiene la sesión abierta).
              responsable: window._respSeleccionado || ($('responsable') ? $('responsable').value : '') || (typeof empNombre === 'function' ? empNombre() : '—')
            };
            if(typeof _registrarMovimiento === 'function') _registrarMovimiento(mov);
          }
        }
        window._desactivarRegistrandoRecibo(); // movimiento registrado — protección puede correr
        // 2. Limpiar formulario y volver a estado virgen — DESPUÉS de registrar el movimiento
        // para que siguienteFolio() → save() → _protegerMovimientosRecibo() ya lo encuentre
        window._reciboRetroactivoActivo = false;
        window._reciboRetroactivoFechaPersonalizada = null;
        window._reciboRetroactivoHoraPersonalizada  = null;
        if(typeof siguienteFolio === 'function'){
          siguienteFolio();
        } else {
          if(typeof descongelarFormulario === 'function') descongelarFormulario();
          if(typeof limpiarFormCompleto    === 'function') limpiarFormCompleto();
        }
        // 3. Crear pendiente de placas automáticamente si es trámite vehicular
        if(typeof D !== 'undefined' && Array.isArray(D.pendientes) && _tipoTramiteGuardado === 'vehicular'){
          try {
            // Detectar tipo de trámite vehicular desde el primer concepto
            const concepto0 = (_concepto0 || '').toLowerCase();
            let tipoVeh = 'alta';
            if (concepto0.includes('reemplac'))               tipoVeh = 'reemplacamiento';
            else if (concepto0.includes('baja'))              tipoVeh = 'baja';
            else if (concepto0.includes('cambio') || concepto0.includes('propiet')) tipoVeh = 'cambio_propietario';
            else if (concepto0.includes('tarjeta') || concepto0.includes('circulac')) tipoVeh = 'tarjeta_circulacion';
            const tipoLbl = {
              'alta':'Alta de placas','baja':'Baja de placas',
              'cambio_propietario':'Cambio de propietario',
              'tarjeta_circulacion':'Tarjeta de circulación',
              'reemplacamiento':'Reemplacamiento'
            }[tipoVeh] || 'Trámite vehicular';
            // Datos del vehículo desde el formulario (ya guardados en appData.recibos[0])
            const recGuardado = appData.recibos[0] || {};
            const placaNum  = recGuardado.placa  || '';
            const estadoRec = recGuardado.origen || '';
            const marcaRec  = recGuardado.marca  || '';
            const claseRec  = recGuardado.clase  || '';
            // Descripción del pendiente — usar Concepto + Descripción del recibo como título
            const _desc0    = conceptos && conceptos[0] ? (conceptos[0].descripcion||'') : '';
            const concDesc  = [_concepto0, _desc0].filter(Boolean).join(' — ');
            const textoPend = concDesc || (tipoLbl + ' — ' + _nombreGuardado + (placaNum ? ' ('+placaNum+')' : ''));
            const descPend  = concDesc || tipoLbl;
            // Evitar duplicado: no crear si ya existe pendiente no resuelto con mismo folio
            const idPend = 'PEND-REC-' + _folioGuardado;
            const yaExiste = D.pendientes.some(p => p.id === idPend);
            if (!yaExiste) {
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
                // Vinculación con recibo
                reciboVinculadoFolio: _folioGuardado,
                // Datos extra del vehículo para mostrar en el header del pendiente
                vehMarca: marcaRec,
                vehClase: claseRec,
                marca: marcaRec,
                clase: claseRec,
                documentos: []
              };
              D.pendientes.unshift(nuevoPend);
              console.log('[Auto-pendiente] Creado pendiente de placas para recibo #' + _folioGuardado);
            }
            // Si el recibo quedó liquidado desde el primer momento, eliminar el pendiente
            if (_saldoInicialGuardado <= 0 && typeof _eliminarPendientePorFolio === 'function') {
              _eliminarPendientePorFolio(_folioGuardado);
            }
          } catch(ePend) {
            console.warn('[Auto-pendiente]', ePend);
          }
        }
        // 3. Persistir todo el estado
        // FIX (caso real: folio 113A — el recibo se guardó y se veía correcto en
        // Contabilidad porque D.movimientos ya lo tenía en memoria, pero el
        // movimiento NUNCA llegó a Supabase: save() es "fire and forget"
        // (solo un console.warn si falla, sin reintento ni aviso visible), y
        // si esta única llamada fallaba —red inestable, choque de concurrencia
        // agotando sus 5 reintentos internos, timeout— el cobro quedaba
        // huérfano en el navegador para siempre, hasta que alguien lo notara
        // días después en SCANSYS PRO. Ahora se reintenta varias veces con
        // espera creciente y, si de plano no se puede guardar, se avisa de
        // forma visible y persistente (no solo en la consola) para que se
        // revise de inmediato en vez de descubrirlo después.
        let _syncOkRecibo = false;
        for (let _intentoSyncRec = 1; _intentoSyncRec <= 4 && !_syncOkRecibo; _intentoSyncRec++) {
          try {
            await syncEstadoSupabase();
            _syncOkRecibo = true;
          } catch (eSyncRec) {
            console.warn('[guardarRecibo] intento ' + _intentoSyncRec + '/4 de sincronizar el movimiento falló:', eSyncRec);
            if (_intentoSyncRec < 4) await new Promise(res => setTimeout(res, 1000 * _intentoSyncRec));
          }
        }
        const _folioLetraTxt = folioConLetra(_folioGuardado, appData.anioFolioActual || new Date().getFullYear(), _letraGuardada);
        if (!_syncOkRecibo) {
          toast('⚠️ El cobro del recibo #' + _folioLetraTxt + ' NO se pudo guardar en el servidor tras varios intentos. Verifica tu conexión — no cierres esta pestaña y vuelve a intentar, o revisa SCANSYS PRO → Diagnóstico de Folios.', 'err');
          if (typeof _lexPush === 'function') {
            try { _lexPush('error', 'recibo.sync', 'Movimiento del recibo #' + _folioLetraTxt + ' no se pudo sincronizar tras 4 intentos — sigue solo en memoria local.', null, { folio: _folioGuardado, letra: _letraGuardada }); } catch(eLex){}
          }
        }
        // 4. Refrescar TODOS los paneles en cascada
        if(typeof renderHistorial      === 'function') try { renderHistorial();      } catch(e){ registrarError('catch vacio', e); }
        if(typeof renderCaja           === 'function') safeExec('renderCaja', () => renderCaja());
        if(typeof renderContab         === 'function') try { renderContab();         } catch(e){ registrarError('catch vacio', e); }
        if(typeof renderDir            === 'function') try { renderDir();            } catch(e){ registrarError('catch vacio', e); }
        if(typeof renderPend           === 'function') safeExec('renderPend', () => renderPend());
        if(typeof renderCarp           === 'function') try { renderCarp();           } catch(e){ registrarError('catch vacio', e); }
        if(typeof badges               === 'function') try { badges();               } catch(e){ registrarError('catch vacio', e); }
        if(typeof actualizarFolioDisplay === 'function') try { actualizarFolioDisplay(); } catch(e){ registrarError('catch vacio', e); }
        // 5. Red de seguridad adicional: agenda otro intento debounced por si
        // los 4 anteriores fallaron (ej. la red volvió en ese momento).
        if (!_syncOkRecibo) {
          try { syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); }); } catch(e){ registrarError('catch vacio', e); }
        }
        setStatus(_syncOkRecibo ? 'ok' : 'err',
          _syncOkRecibo
            ? 'Recibo #' + folioFormato(_folioGuardado) + ' guardado · Listo para el siguiente recibo'
            : '⚠️ Recibo #' + folioFormato(_folioGuardado) + ' impreso, pero el cobro no se confirmó en el servidor — ver aviso arriba',
          _syncOkRecibo ? 'ok' : 'err');
      } catch(ePost){
        console.error('[post-imprimir]', ePost);
        setStatus('ok', 'Recibo #' + folioFormato(_folioGuardado) + ' guardado', 'ok');
      }
    }, 700);
  } catch(e){ setStatus('err','Error: '+e.message,'err'); console.error(e); }
  btn.disabled=false;
}
// ── HISTORIAL ────────────────────────────────────────────────────
historialFiltroActivo = 'todos';
function setFiltroHistorial(filtro){
  historialFiltroActivo = filtro;
  ['todos','pendiente','pagado','cancelado'].forEach(f=>{
    document.getElementById('filtro-'+f).classList.toggle('activo', f===filtro);
  });
  filtrarHistorial();
}
// ── HISTORIAL DE VERSIONES DE RECIBOS ─────────────────────────────────────
// Guarda un snapshot completo del recibo ANTES de cualquier mutación.
// Se llama desde: actualizarRecibo, complemento de pago, liquidación.
function _guardarSnapshotRecibo(recibo, motivo){
  try{
    if(!recibo || recibo.folio==null) return;
    if(!appData.historialVersiones) appData.historialVersiones = {};
    if(!appData.historialVersiones[recibo.folio]) appData.historialVersiones[recibo.folio] = [];
    const quien = (typeof empleadoActual!=='undefined' && empleadoActual && empleadoActual.nombre)
      ? empleadoActual.nombre
      : (typeof NOMBRE_TITULAR!=='undefined' ? NOMBRE_TITULAR : '—');
    appData.historialVersiones[recibo.folio].push({
      fecha: typeof hoy==='function' ? hoy() : new Date().toISOString().split('T')[0],
      hora:  typeof hora==='function' ? hora() : new Date().toTimeString().slice(0,5),
      quien,
      motivo: motivo || 'Modificación',
      snapshot: structuredClone(recibo)
    });
  } catch(e){ console.warn('[snapshot]',e); }
}
// Guarda un registro permanente de la versión en la tabla versiones_recibo de Supabase.
// Complementa (no reemplaza) el historial local en appData.historialVersiones.
async function _guardarVersionEnSupabase(recibo, letra, pdfNombreArchivo){
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  try {
    const quien = (typeof empleadoActual!=='undefined' && empleadoActual && empleadoActual.nombre)
      ? empleadoActual.nombre
      : (typeof NOMBRE_TITULAR!=='undefined' ? NOMBRE_TITULAR : '—');
    const pdfPath = pdfNombreArchivo
      ? (window.SB_DESPACHO_ID + '/recibos/' + pdfNombreArchivo)
      : null;
    const { error } = await window.SB.from('versiones_recibo').upsert({
      despacho_id:      window.SB_DESPACHO_ID,
      folio_base:       recibo.folio,
      anio_folio:       recibo.anio_folio || new Date().getFullYear(),
      letra:            letra || 'A',
      datos_completos:  structuredClone(recibo),
      pdf_storage_path: pdfPath,
      fecha:            typeof hoy==='function' ? hoy() : new Date().toISOString().split('T')[0],
      hora:             typeof hora==='function' ? hora() : new Date().toTimeString().slice(0,5),
      usuario:          quien
    }, { onConflict: 'despacho_id,folio_base,anio_folio,letra' });
    if(error) console.warn('[versiones_recibo] upsert error:', error.message);
    else console.log('[versiones_recibo] ✓ guardada versión', letra, 'folio', recibo.folio);
  } catch(e){ console.warn('[versiones_recibo]', e); }
}
// Abre el modal con versiones del recibo. Admin ve todo; empleado solo la versión actual.
async function verHistorialVersiones(folio){
  const el = document.getElementById('modal-versiones');
  const body = document.getElementById('modal-versiones-body');
  if(!el || !body) return;
  const recibo = (appData.recibos||[]).find(r=>r.folio===folio && !r.esComplemento);
  const anioFolio = recibo?.anio_folio || new Date().getFullYear();
  const letraActual = recibo?.letra || letraVersion(recibo) || 'A';
  document.getElementById('modal-versiones-folio').textContent = 'Folio #'+folioConLetra(folio, anioFolio, letraActual);
  const emailActual = (typeof empleadoActual!=='undefined' && empleadoActual && empleadoActual.email)
    ? empleadoActual.email.toLowerCase() : '';
  const esAdmin = typeof ADMIN_EMAIL!=='undefined'
    ? emailActual === ADMIN_EMAIL.toLowerCase()
    : false;
  // Mostrar botón de edición completa (siempre visible; la función verifica el contexto)
  const footer = document.getElementById('modal-versiones-footer');
  if(footer) footer.style.display = 'flex';
  body.innerHTML = '<p style="color:var(--muted);font-size:0.8rem;text-align:center;padding:20px;">⏳ Cargando versiones...</p>';
  el.classList.add('show');
  // Empleado: solo ve la versión actual sin historial
  if(!esAdmin){
    body.innerHTML = `<div style="border:1px solid var(--gold);border-radius:6px;padding:14px;background:#fffbf0;text-align:center;">
      <div style="font-family:'DM Mono',monospace;font-size:0.85rem;font-weight:700;color:var(--gold-d);margin-bottom:6px;">Versión actual: ${folioConLetra(folio, anioFolio, letraActual)}</div>
      <div style="font-size:0.72rem;color:var(--muted);">El historial completo de versiones es visible solo para el administrador.</div>
    </div>`;
    return;
  }
  // Admin: cargar desde Supabase
  let versionesSB = [];
  if(window.SB && window.SB_DESPACHO_ID && recibo){
    try {
      const { data, error } = await window.SB.from('versiones_recibo')
        .select('*')
        .eq('despacho_id', window.SB_DESPACHO_ID)
        .eq('folio_base', folio)
        .eq('anio_folio', anioFolio)
        .order('letra', {ascending: true});
      if(!error && data) versionesSB = data;
    } catch(e){ console.warn('[versiones_recibo]', e); }
  }
  if(versionesSB.length){
    const lista = [...versionesSB].reverse(); // más reciente primero
    body.innerHTML = lista.map((v, i)=>{
      const snap = v.datos_completos || {};
      const saldo   = snap.saldoPendiente != null ? snap.saldoPendiente : '—';
      const total   = snap.total != null ? snap.total : (snap.totalGeneral || '—');
      const abonado = snap.totalAbonado != null ? snap.totalAbonado : (parseFloat(snap.anticipo)||0);
      const esUltima = (i === 0);
      const puedeRestaurar = !esUltima;
      const badgeActual = esUltima
        ? ' <span style="font-size:0.62rem;color:#2a7a3a;background:#e8f5e9;padding:2px 6px;border-radius:3px;vertical-align:middle;font-weight:600;">ACTUAL</span>'
        : '';
      return `<div style="border:1.5px solid ${esUltima?'var(--gold)':'var(--border-light)'};border-radius:6px;padding:12px 14px;margin-bottom:10px;background:${esUltima?'#fffbf0':'var(--field-bg)'};">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-family:'DM Mono',monospace;font-size:0.82rem;font-weight:700;color:var(--gold-d);">${folioConLetra(folio, anioFolio, v.letra)}${badgeActual}</span>
          <span style="font-size:0.68rem;color:var(--muted);">${v.fecha} ${v.hora} · ${v.usuario}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-family:'DM Mono',monospace;font-size:0.72rem;margin-bottom:10px;">
          <div style="background:#f5f0e8;border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.62rem;">TOTAL</span>$${typeof fmtMXN==='function'?fmtMXN(total):total}</div>
          <div style="background:#eaf4ea;border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.62rem;">ABONADO</span>$${typeof fmtMXN==='function'?fmtMXN(abonado):abonado}</div>
          <div style="background:${saldo>0?'#fff4e0':'#eafaea'};border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.62rem;">SALDO</span>$${typeof fmtMXN==='function'?fmtMXN(saldo):saldo}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${v.pdf_storage_path?`<button onclick="verPDFVersionSupabase('${v.pdf_storage_path}')"
            style="font-size:0.7rem;padding:5px 12px;border-radius:4px;border:1px solid var(--border-light);background:transparent;cursor:pointer;color:var(--ink);">📄 Ver PDF</button>`:''}
          ${puedeRestaurar?`<button onclick="restaurarVersionDesdeSupabase(${folio},'${v.letra}')"
            style="font-size:0.7rem;padding:5px 12px;border-radius:4px;border:1.5px solid #c07a10;background:#fff8ed;cursor:pointer;color:#7a4a00;font-weight:600;">↩ Restaurar esta versión</button>`:''}
        </div>
      </div>`;
    }).join('');
    return;
  }
  // Fallback: historial local (para recibos anteriores al sistema de versiones Supabase)
  const versionesLocal = (appData.historialVersiones||{})[folio] || [];
  if(!versionesLocal.length){
    body.innerHTML='<p style="color:var(--muted);font-size:0.8rem;text-align:center;padding:20px;">Sin versiones registradas para este folio.</p>';
    return;
  }
  const lista = [...versionesLocal].reverse();
  body.innerHTML = lista.map((v,i)=>{
    const snap = v.snapshot;
    const saldo   = snap.saldoPendiente!=null ? snap.saldoPendiente : '—';
    const total   = snap.total!=null ? snap.total : (snap.totalGeneral||'—');
    const abonado = snap.totalAbonado!=null ? snap.totalAbonado : (parseFloat(snap.anticipo)||0);
    return `<div style="border:1px solid var(--border-light);border-radius:6px;padding:12px 14px;margin-bottom:10px;background:var(--field-bg);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-family:'DM Mono',monospace;font-size:0.72rem;font-weight:700;color:var(--gold-d);">Versión ${lista.length-i}</span>
        <span style="font-size:0.7rem;color:var(--muted);">${v.fecha} ${v.hora} · ${v.quien}</span>
      </div>
      <div style="font-size:0.75rem;color:var(--ink);margin-bottom:6px;"><strong>Motivo:</strong> ${v.motivo}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-family:'DM Mono',monospace;font-size:0.72rem;">
        <div style="background:#f5f0e8;border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.65rem;">TOTAL</span>$${typeof fmtMXN==='function'?fmtMXN(total):total}</div>
        <div style="background:#eaf4ea;border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.65rem;">ABONADO</span>$${typeof fmtMXN==='function'?fmtMXN(abonado):abonado}</div>
        <div style="background:${saldo>0?'#fff4e0':'#eafaea'};border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.65rem;">SALDO</span>$${typeof fmtMXN==='function'?fmtMXN(saldo):saldo}</div>
      </div>
      ${snap.pagosParciales&&snap.pagosParciales.length?`<div style="margin-top:8px;font-size:0.7rem;color:var(--muted);">Abonos registrados: ${snap.pagosParciales.length}</div>`:''}
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button onclick="descargarSnapshotPDF(${folio},${versionesLocal.length-1-i})"
          style="font-size:0.7rem;padding:5px 12px;border-radius:4px;border:1px solid var(--border-light);background:transparent;cursor:pointer;color:var(--ink);">
          📄 Ver PDF de esta versión
        </button>
        <button onclick="restaurarVersionRecibo(${folio},${versionesLocal.length-1-i})"
          style="font-size:0.7rem;padding:5px 12px;border-radius:4px;border:1.5px solid #c07a10;background:#fff8ed;cursor:pointer;color:#7a4a00;font-weight:600;">
          ↩ Restaurar esta versión
        </button>
      </div>
    </div>`;
  }).join('');
}
// ═══════════════════════════════════════════════════════════════
// ═══ CONSULTAR PDF POR FOLIO (panel admin) ══════════════════════
// ═══════════════════════════════════════════════════════════════
let _cpdfVersiones = [];
async function adminAbrirConsultarPDF(){
  document.getElementById('adminPanelZone').classList.remove('show');
  document.getElementById('adminConsultarPDFZone').classList.add('show');
  const buscar = document.getElementById('cpdf-buscar');
  if(buscar) buscar.value = '';
  document.getElementById('cpdf-lista').innerHTML =
    '<p style="color:var(--muted);text-align:center;padding:24px;font-size:0.75rem;">⏳ Sincronizando versiones…</p>';
  // Migración silenciosa: registrar en versiones_recibo cualquier recibo de appData que falte
  await _cpdfMigrarSilencioso();
  await adminConsultarPDFCargar();
}
async function _cpdfMigrarSilencioso(){
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  const recibos = (typeof appData!=='undefined' ? appData.recibos||[] : []).filter(function(r){ return !r.esComplemento; });
  if(!recibos.length) return;
  // Obtener los (folio_base, letra) que ya existen para no hacer upserts innecesarios
  try {
    const { data: existentes } = await window.SB.from('versiones_recibo')
      .select('folio_base,anio_folio,letra')
      .eq('despacho_id', window.SB_DESPACHO_ID);
    const claves = new Set((existentes||[]).map(function(v){
      return v.folio_base+'_'+v.anio_folio+'_'+v.letra;
    }));
    const faltantes = recibos.filter(function(r){
      var letra  = r.letra || letraVersion(r) || 'A';
      var anio   = r.anio_folio || new Date().getFullYear();
      return !claves.has(r.folio+'_'+anio+'_'+letra);
    });
    for(var i=0; i<faltantes.length; i++){
      var r = faltantes[i];
      var letra   = r.letra || letraVersion(r) || 'A';
      var archivo = r.archivo || (folioConLetra(r.folio, r.anio_folio, letra)+'.pdf');
      await _guardarVersionEnSupabase(r, letra, archivo);
    }
  } catch(e){ console.warn('[cpdf migración silenciosa]', e); }
}
async function adminConsultarPDFCargar(){
  if(!window.SB || !window.SB_DESPACHO_ID){
    document.getElementById('cpdf-lista').innerHTML =
      '<p style="color:#f88;text-align:center;padding:20px;font-size:0.75rem;">Sin conexión a Supabase.</p>';
    return;
  }
  try {
    const { data, error } = await window.SB.from('versiones_recibo')
      .select('folio_base,anio_folio,letra,fecha,hora,usuario,pdf_storage_path,datos_completos')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .order('anio_folio', { ascending: false })
      .order('folio_base', { ascending: false })
      .order('letra',      { ascending: true });
    if(error) throw error;
    _cpdfVersiones = data || [];
    // Actualizar contador de la tarjeta en el panel principal
    const cnt = document.getElementById('adminVersCnt');
    if(cnt) cnt.textContent = _cpdfVersiones.length;
    adminConsultarPDFRender();
  } catch(e){
    document.getElementById('cpdf-lista').innerHTML =
      '<p style="color:#f88;text-align:center;padding:20px;font-size:0.75rem;">Error: '+e.message+'</p>';
  }
}
function adminConsultarPDFRender(){
  const filtro = ((document.getElementById('cpdf-buscar')||{}).value||'').toLowerCase().trim();
  const lista  = document.getElementById('cpdf-lista');
  const countEl= document.getElementById('cpdf-count');
  let vers = _cpdfVersiones;
  if(filtro){
    vers = vers.filter(function(v){
      const folioStr = folioConLetra(v.folio_base, v.anio_folio, v.letra).toLowerCase();
      const nombre   = ((v.datos_completos && (v.datos_completos.nombre ||
                        (v.datos_completos.clientes && v.datos_completos.clientes[0] && v.datos_completos.clientes[0].nombre) || ''))+'').toLowerCase();
      return folioStr.includes(filtro) || nombre.includes(filtro) || String(v.folio_base).includes(filtro);
    });
  }
  if(!vers.length){
    lista.innerHTML = '<p style="color:var(--muted);text-align:center;padding:24px;font-size:0.75rem;">Sin versiones que coincidan.</p>';
    if(countEl) countEl.textContent = '';
    return;
  }
  const tdBase = 'padding:8px 10px;border-bottom:1px solid rgba(42,180,130,0.08);vertical-align:middle;';
  lista.innerHTML = '<table style="width:100%;border-collapse:collapse;font-family:monospace;font-size:0.72rem;">'
    + '<thead><tr style="background:rgba(42,180,130,0.07);">'
    + '<th style="'+tdBase+'color:rgba(160,232,200,0.6);font-weight:600;text-align:left;padding-left:12px;">Folio</th>'
    + '<th style="'+tdBase+'color:rgba(160,232,200,0.6);font-weight:600;text-align:left;">Nombre</th>'
    + '<th style="'+tdBase+'color:rgba(160,232,200,0.6);font-weight:600;text-align:left;">Fecha</th>'
    + '<th style="'+tdBase+'color:rgba(160,232,200,0.6);font-weight:600;text-align:left;">Usuario</th>'
    + '<th style="'+tdBase+'color:rgba(160,232,200,0.6);font-weight:600;text-align:center;">PDF</th>'
    + '</tr></thead><tbody>'
    + vers.map(function(v){
        const folio  = folioConLetra(v.folio_base, v.anio_folio, v.letra);
        const nombre = (v.datos_completos && (v.datos_completos.nombre ||
                       (v.datos_completos.clientes && v.datos_completos.clientes[0] && v.datos_completos.clientes[0].nombre))) || '—';
        const fecha  = (v.fecha||'') + (v.hora ? ' '+v.hora : '');
        const user   = (v.usuario||'—');
        const pathEsc = (v.pdf_storage_path||'').replace(/'/g,"\\'");
        const pdfBtn = v.pdf_storage_path
          ? '<button onclick="adminAbrirURLVersion(\''+pathEsc+'\',\''+folio+'\')" '
            + 'style="background:rgba(42,180,130,0.12);border:1px solid rgba(42,180,130,0.35);border-radius:5px;padding:4px 9px;cursor:pointer;font-family:monospace;font-size:0.62rem;color:#a0e8c8;white-space:nowrap;">'
            + '🔗 Abrir</button>'
          : '<span style="color:rgba(255,100,100,0.45);font-size:0.6rem;">sin PDF</span>';
        return '<tr style="transition:background 0.12s;" onmouseover="this.style.background=\'rgba(42,180,130,0.05)\'" onmouseout="this.style.background=\'\'">'
          + '<td style="'+tdBase+'padding-left:12px;font-weight:700;color:#a0e8c8;letter-spacing:0.04em;">'+folio+'</td>'
          + '<td style="'+tdBase+'color:rgba(200,232,220,0.75);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(nombre)+'</td>'
          + '<td style="'+tdBase+'color:rgba(160,232,200,0.5);white-space:nowrap;">'+fecha+'</td>'
          + '<td style="'+tdBase+'color:rgba(160,232,200,0.45);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(user)+'</td>'
          + '<td style="'+tdBase+'text-align:center;">'+pdfBtn+'</td>'
          + '</tr>';
      }).join('')
    + '</tbody></table>';
  if(countEl) countEl.textContent = vers.length + ' versión' + (vers.length===1 ? '' : 'es');
}
async function adminAbrirURLVersion(pdfPath, folioLabel){
  if(!window.SB){ toast('Sin conexión a Supabase','err'); return; }
  if(typeof toast==='function') toast('Generando enlace para '+folioLabel+'…','loading');
  try {
    const { data, error } = await window.SB.storage.from(STORAGE_BUCKET).createSignedUrl(pdfPath, 300);
    if(error || !data || !data.signedUrl) throw new Error((error&&error.message)||'Sin URL');
    window.open(data.signedUrl, '_blank');
    if(typeof toast==='function') toast('Enlace abierto · válido 5 minutos','ok');
  } catch(e){
    if(typeof toast==='function') toast('Error: '+e.message,'err');
  }
}
async function adminMigrarFoliosAVersiones(){
  if(!window.SB || !window.SB_DESPACHO_ID){ toast('Sin conexión a Supabase','err'); return; }
  const recibos = (typeof appData!=='undefined' ? appData.recibos||[] : []).filter(function(r){ return !r.esComplemento; });
  if(!recibos.length){ toast('No hay recibos en memoria para migrar','err'); return; }
  if(!confirm('Se van a registrar '+recibos.length+' recibos en versiones_recibo.\nLos que ya existan se actualizarán (upsert). ¿Continuar?')) return;
  if(typeof toast==='function') toast('Migrando '+recibos.length+' recibos…','loading');
  let ok=0, err=0;
  for(var i=0; i<recibos.length; i++){
    var r = recibos[i];
    try {
      var letra   = r.letra || letraVersion(r) || 'A';
      var archivo = r.archivo || (folioConLetra(r.folio, r.anio_folio, letra)+'.pdf');
      await _guardarVersionEnSupabase(r, letra, archivo);
      ok++;
    } catch(e){ err++; }
  }
  if(typeof toast==='function') toast('Migración: '+ok+' OK'+(err?' · '+err+' error(es)':''),'ok');
  await adminConsultarPDFCargar();
}
// ─────────────────────────────────────────────────────────────────
// Descarga el PDF guardado en el snapshot (si existe)
function descargarSnapshotPDF(folio, idx){
  const versiones = (appData.historialVersiones||{})[folio] || [];
  const v = versiones[idx];
  if(!v || !v.snapshot || !v.snapshot.pdfBase64){
    showModal('Sin PDF','Esta versión no tiene PDF guardado (es anterior a la implementación del historial).'); return;
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
  if(!v){ showModal('Error','Versión no encontrada.'); return; }
  if(!confirm('¿Confirmas restaurar el Folio #'+folioFormato(folio)+' al estado del '+v.fecha+' '+v.hora+'?\n\nEsto reemplazará los datos actuales del recibo. El historial de versiones se conserva.')){return;}
  const recIdx = (appData.recibos||[]).findIndex(r=>r.folio===folio && !r.esComplemento);
  if(recIdx<0){ showModal('Error','Recibo no encontrado.'); return; }
  // Guardar snapshot del estado actual antes de restaurar
  _guardarSnapshotRecibo(appData.recibos[recIdx], 'Antes de restaurar versión '+String(idx+1));
  // Restaurar
  const campos = ['costosExtra','pagosParciales','fechasImpresion','total','saldoPendiente','pdfBase64','archivo','placasEntregadas','estadoPlacas','totalAbonado','anticipo','cancelado'];
  campos.forEach(c=>{ if(v.snapshot[c]!==undefined) appData.recibos[recIdx][c]=structuredClone(v.snapshot[c]); });
  if(typeof save==='function') save();
  if(typeof renderHistorial==='function') renderHistorial();
  if(typeof renderCaja==='function') renderCaja();
  document.getElementById('modal-versiones').classList.remove('show');
  showModal('Versión restaurada','El Folio #'+folioFormato(folio)+' fue restaurado al estado del '+v.fecha+' a las '+v.hora+'. El historial de versiones se conserva completo.');
}
// Abre el PDF de una versión directamente desde Supabase Storage (firmado por 60 s)
async function verPDFVersionSupabase(pdfPath){
  if(!window.SB){ showModal('Error','Sin conexión a Supabase.'); return; }
  try {
    const { data, error } = await window.SB.storage.from(STORAGE_BUCKET).createSignedUrl(pdfPath, 300);
    if(error || !data){ showModal('Error','No se pudo obtener el PDF: '+(error?.message||'sin URL')); return; }
    window.open(data.signedUrl, '_blank');
  } catch(e){ showModal('Error','Error al obtener PDF: '+e.message); }
}
// Restaura (admin) el folio a la letraTarget y elimina las versiones más nuevas de Supabase
async function restaurarVersionDesdeSupabase(folio, letraTarget){
  if(!window.SB || !window.SB_DESPACHO_ID){ showModal('Error','Sin conexión a Supabase.'); return; }
  const recibo = (appData.recibos||[]).find(r=>r.folio===folio && !r.esComplemento);
  const anioFolio = recibo?.anio_folio || new Date().getFullYear();
  if(!confirm('¿Restaurar el folio '+folioConLetra(folio, anioFolio, letraTarget)+'?\n\nLas versiones más recientes serán eliminadas permanentemente. Esta acción no se puede deshacer.')){ return; }
  try {
    // 1. Obtener la versión objetivo
    const { data: vTarget, error: e1 } = await window.SB.from('versiones_recibo')
      .select('*')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .eq('folio_base', folio)
      .eq('anio_folio', anioFolio)
      .eq('letra', letraTarget)
      .single();
    if(e1 || !vTarget){ showModal('Error','Versión no encontrada: '+(e1?.message||'')); return; }
    // 2. Obtener versiones posteriores a letraTarget (letras > target → las que se borran)
    const { data: vMasRecientes } = await window.SB.from('versiones_recibo')
      .select('letra, pdf_storage_path')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .eq('folio_base', folio)
      .eq('anio_folio', anioFolio)
      .gt('letra', letraTarget);
    if(vMasRecientes && vMasRecientes.length){
      for(const v of vMasRecientes){
        if(v.pdf_storage_path)
          await window.SB.storage.from(STORAGE_BUCKET).remove([v.pdf_storage_path]).catch(()=>{});
      }
      const letrasABorrar = vMasRecientes.map(v=>v.letra);
      await window.SB.from('versiones_recibo').delete()
        .eq('despacho_id', window.SB_DESPACHO_ID)
        .eq('folio_base', folio)
        .eq('anio_folio', anioFolio)
        .in('letra', letrasABorrar);
    }
    // 3. Restaurar campos del recibo en appData
    const snap = vTarget.datos_completos || {};
    const recIdx = (appData.recibos||[]).findIndex(r=>r.folio===folio && !r.esComplemento);
    if(recIdx<0){ showModal('Error','Recibo no encontrado en datos locales.'); return; }
    _guardarSnapshotRecibo(appData.recibos[recIdx], 'Antes de restaurar a '+letraTarget);
    const campos = ['costosExtra','pagosParciales','fechasImpresion','total','saldoPendiente','saldoNuevo','totalAbonado','anticipo','placasEntregadas','estadoPlacas','cancelado'];
    campos.forEach(c=>{ if(snap[c]!==undefined) appData.recibos[recIdx][c]=structuredClone(snap[c]); });
    appData.recibos[recIdx].letra  = letraTarget;
    appData.recibos[recIdx].archivo = folioConLetra(folio, anioFolio, letraTarget)+'.pdf';
    if(typeof save==='function') save();
    if(typeof actualizarArchivoControl==='function') actualizarArchivoControl().catch(()=>{});
    document.getElementById('modal-versiones').classList.remove('show');
    showModal('Versión restaurada','Folio '+folioConLetra(folio, anioFolio, letraTarget)+' restaurado correctamente.');
    if(typeof renderHistorial==='function') renderHistorial();
    if(typeof renderCaja==='function') renderCaja();
  } catch(e){ showModal('Error','Error al restaurar: '+e.message); }
}
function filtrarHistorial(){
  const q = (document.getElementById('hist-buscar')?.value||'').toLowerCase().trim();
  const filtro = historialFiltroActivo;
  // Pre-calcular saldo REAL por folio: usa el minimo saldo entre todas sus versiones.
  // Evita que versiones intermedias (ej. 26-071A) sean mal clasificadas.
  const _saldoPorFolio = {};
  const _canceladoPorFolio = {};
  (appData.recibos || []).forEach(function(r){
    const k = r.folio;
    if(k == null) return;
    const sE = (r.saldoPendiente != null) ? parseFloat(r.saldoPendiente)
             : (r.saldoNuevo     != null) ? parseFloat(r.saldoNuevo) : NaN;
    if(!_canceladoPorFolio[k]) _canceladoPorFolio[k] = false;
    if(r.cancelado) _canceladoPorFolio[k] = true;
    if(_saldoPorFolio[k] === undefined) _saldoPorFolio[k] = isNaN(sE) ? Infinity : sE;
    else _saldoPorFolio[k] = Math.min(_saldoPorFolio[k], isNaN(sE) ? _saldoPorFolio[k] : sE);
  });
  const lista = appData.recibos.filter((r,i)=>{
    const _sf = _saldoPorFolio[r.folio];
    const _cf = _canceladoPorFolio[r.folio];
    // Filtro por estado: usa el saldo minimo del folio (la ultima liquidacion gana)
    if(filtro==='cancelado' && !r.cancelado) return false;
    if(filtro==='pendiente' && (_cf || !(_sf > 0))) return false;
    if(filtro==='pagado'    && (_cf || _sf > 0))    return false;
    // Filtro por texto
    if(q){
      const folioStr = folioConLetra(r.folio, r.anio_folio, r.letra || 'A');
      const nombre   = (r.nombre||'').toLowerCase();
      // Buscar en teléfonos de todos los clientes del recibo
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
    list.innerHTML='<div class="empty-hist">'+(total?'Sin resultados para la búsqueda':'Aún no hay recibos generados')+'</div>';
    return;
  }
  // Fecha efectiva de cada versión: B/C/D usan fechasImpresion[última] o fechaActualizacion
  function _fechaEfRec(r){
    if(r.fechasImpresion && r.fechasImpresion.length > 1){
      var fp = r.fechasImpresion[r.fechasImpresion.length - 1];
      return { f: fp.fecha || r.fechaActualizacion || r.fecha || '', h: fp.hora || r.horaActualizacion || r.hora || '00:00' };
    }
    if(r.fechaActualizacion) return { f: r.fechaActualizacion, h: r.horaActualizacion || r.hora || '00:00' };
    return { f: r.fecha || '', h: r.hora || '00:00' };
  }
  // ── Orden IGUAL que contabilidad: por la fecha+hora del MOVIMIENTO del recibo ──
  // (respaldo a la fecha efectiva del recibo si no existe un movimiento vinculado)
  const _movFechaMap = {};
  (typeof D !== 'undefined' && Array.isArray(D.movimientos) ? D.movimientos : []).forEach(function(m){
    if(!m || m.fuente !== 'recibo' || m.borrado || m.folio == null) return;
    const k = m.folio + '|' + (m.letra || 'A');
    const clave = (m.fecha || '') + 'T' + (m.hora || '00:00');
    if(!_movFechaMap[k] || clave > _movFechaMap[k]) _movFechaMap[k] = clave;
  });
  function _claveOrdenRec(r){
    const k = r.folio + '|' + (r.letra || 'A');
    if(_movFechaMap[k]) return _movFechaMap[k];
    const ef = _fechaEfRec(r);
    return (ef.f || '') + 'T' + (ef.h || '00:00');
  }
  lista.sort(function(a, b) {
    const ca = _claveOrdenRec(a), cb = _claveOrdenRec(b);
    if (cb !== ca) return cb.localeCompare(ca);
    // Mismo instante: letra mayor primero (D > C > B > A), luego folio mayor
    const la = (a.letra || 'A'), lb = (b.letra || 'A');
    if(la !== lb) return lb.localeCompare(la);
    return (b.folio || 0) - (a.folio || 0);
  });
  list.innerHTML = lista.map(r=>{
    const i = appData.recibos.indexOf(r);
    const ef = _fechaEfRec(r);
    const folioStr='#'+folioConLetra(r.folio, r.anio_folio, r.letra || 'A');
    const compTag=r.esComplemento?'<span style="color:#b07f1e;font-size:0.58rem;margin-left:3px">↳ ref #'+folioFormato(r.folioRef)+'</span>':'';
    const cancelTag=r.cancelado?'<span style="color:#8a1a1a;font-size:0.58rem;margin-left:5px;background:#fff0f0;border:1px solid #c04040;border-radius:3px;padding:1px 5px;font-family:DM Mono,monospace;letter-spacing:0.06em;">🚫 CANCELADO</span>':'';
    const saldoColor=r.saldoPendiente>0?'#b01010':'#2a7a3a';
    const saldoTag=(!r.cancelado && r.saldoPendiente!==undefined)
      ?'<span style="color:'+saldoColor+';font-family:DM Mono,monospace;font-size:0.65rem;margin-left:6px">$'+r.saldoPendiente.toFixed(2)+'</span>':'';
    return '<div class="historial-item"'+(r.cancelado?' style="opacity:0.65;"':'')+' >'
      +'<span class="folio-num">'+folioStr+'</span>'+compTag+cancelTag
      +'<span class="client-name">'+escHTML((r.nombre||'').toUpperCase())+'</span>'
      +'<span class="fecha-item">'+(ef.f||'—')+' '+(ef.h||'')+'</span>'
      +(r.generadoPor?'<span style="font-family:\'DM Mono\',monospace;font-size:0.58rem;color:#7a6040;white-space:nowrap;margin-left:4px;" title="Generado por">👤 '+escHTML(r.generadoPor)+'</span>':'')
      +saldoTag
      +'<button class="download-btn" onclick="reDescargar('+i+')">⬇ PDF</button>'
      +'</div>';
  }).join('');
}
function renderHistorial(){
  filtrarHistorial();
}
async function reDescargar(i){
  const r=appData.recibos[i];
  if(!r) return;
  // Misma sesión: usar pdfBase64 en memoria
  if(r.pdfBase64){
    const a=document.createElement('a'); a.href=r.pdfBase64; a.download=r.archivo||'recibo.pdf'; a.click(); return;
  }
  if(!r.archivo || !window.SB_DESPACHO_ID){ setStatus('err','No hay PDF disponible para este folio','err'); return; }
  const _pathSBRD = window.SB_DESPACHO_ID + '/recibos/' + r.archivo;
  const _pathR2RD = window.SB_DESPACHO_ID + '/recibos/' + (r.archivoR2 || r.archivo);
  let _blob = null;
  // Intentar R2
  if(typeof window.descargarR2 === 'function'){
    try { const b = await window.descargarR2(_pathR2RD,'recibos'); if(b&&b.size>0) _blob=b; } catch(e){ console.warn('[reDescargar] R2:',e); }
  }
  // Intentar Supabase Storage
  if(!_blob && window.SB){
    try {
      const {data:sd,error:se}=await window.SB.storage.from(STORAGE_BUCKET).createSignedUrl(_pathSBRD,120);
      if(!se&&sd&&sd.signedUrl){ const res=await fetch(sd.signedUrl); if(res.ok) _blob=await res.blob(); }
    } catch(e){ console.warn('[reDescargar] SB:',e); }
  }
  if(_blob){
    const url=URL.createObjectURL(_blob);
    const a=document.createElement('a'); a.href=url; a.download=r.archivo||'recibo.pdf'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    const rd=new FileReader(); rd.onload=()=>{ r.pdfBase64=rd.result; }; rd.readAsDataURL(_blob);
  } else {
    setStatus('err','No se pudo descargar el PDF del folio #'+String(r.folio).padStart(4,'0'),'err');
  }
}
// ── MODALES ──────────────────────────────────────────────────────
function showModal(titulo,msg){
  document.getElementById('modal-title').textContent=titulo;
  document.getElementById('modal-msg').innerHTML=msg;
  document.getElementById('modal').classList.add('show');
}
function cerrarModal(){ document.getElementById('modal').classList.remove('show'); }
// ── EVENTOS ──────────────────────────────────────────────────────
// ── BUSCADOR POR CLIENTE + FOLIOS — botón único unificado ────────
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
  if(_panelesBusquedaAbiertos) setTimeout(()=>{ const inp=$('folio_anterior'); if(inp) inp.focus(); }, 80);
}
// Funciones de compatibilidad — redirigen al toggle unificado
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
  const qnFolio = qn.replace(/^#/,'');
  const grupos = {};
  (appData.recibos||[]).forEach(r=>{
    const nk = norm(r.nombre);
    // Coincide por nombre O por número de folio (con o sin letra, ej. "57" / "57b" / "#57B")
    const folioStr = norm(folioConLetra(r.folio, r.anio_folio, r.letra || 'A'));
    if(!nk.includes(qn) && !folioStr.includes(qnFolio)) return;
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
      const fs='#'+folioConLetra(r.folio, r.anio_folio, r.letra || 'A');
      let clase,ico;
      if(r.cancelado)            { clase='cancelado';   ico='🚫'; }
      else if(r.esComplemento)   { clase='complemento'; ico='↳';  }
      else if(r.saldoPendiente>0){ clase='pendiente';   ico='⚠️'; }
      else                       { clase='pagado';      ico='✅'; }
      const _esJuicAb2=window._abiertoSinCosto(r); const tip=r.cancelado?'CANCELADO':r.esComplemento?'Complemento ref.#'+folioFormato(r.folioRef||0):(_esJuicAb2?window._abLbl(r).corto:(r.saldoPendiente>0?'Pendiente $'+fmtMXN(r.saldoPendiente):'Liquidado'));
      return '<span class="pbc-chip '+clase+'" title="'+fs+' · '+(r.fecha||'—')+' · '+tip+'" onclick="abrirFolioPBC('+r.folio+','+(!!r.esComplemento)+')">'
        +ico+' '+fs+(r.fecha?'<span class="pbc-chip-fecha">'+fmtFecha(r.fecha)+'</span>':'')+'</span>';
    }).join('');
    const nPend=g.recibos.filter(r=>!r.cancelado&&!r.esComplemento&&r.saldoPendiente>0).length;
    const nPag =g.recibos.filter(r=>!r.cancelado&&!r.esComplemento&&!(r.saldoPendiente>0)).length;
    const nCanc=g.recibos.filter(r=>r.cancelado).length;
    const total=g.recibos.length;
    const partes=[];
    if(nPend) partes.push('<span style="color:#9a5a10">'+nPend+' pend.</span>');
    if(nPag)  partes.push('<span style="color:#1a5a2a">'+nPag+' liq.</span>');
    if(nCanc) partes.push('<span style="color:#888">'+nCanc+' canc.</span>');
    const _nomAttr = escHTML(g.nombre).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<div class="pbc-card">'
      +'<div class="pbc-nombre-row" style="cursor:pointer;" onclick="abrirClienteRapido(\''+_nomAttr+'\')" title="Ver resumen e iniciar trámite">'
      +'<span style="text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;">'+escHTML(g.nombre)+'</span>'
      +'<span class="pbc-badge">'+total+(total===1?' trámite':' trámites')+'</span>'
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
// ── BÚSQUEDA DE CLIENTES EN PANEL PRINCIPAL (solo recibos, independiente) ──
// Renderiza el listado de clientes/recibos encontrados (compartido entre la
// búsqueda en vivo por nombre y la búsqueda exacta por folio vía Enter).
function _renderCajaBuscaResultados(clientes, resDiv, countEl, qEsc){
  resDiv.style.display = 'block';
  if(!clientes.length){
    resDiv.innerHTML='<div class="pbc-empty">Sin resultados para "<strong>'+qEsc+'</strong>"</div>';
    countEl.textContent=''; return;
  }
  countEl.textContent = clientes.length+(clientes.length===1?' cliente encontrado':' clientes encontrados');
  resDiv.innerHTML = clientes.map(g=>{
    const prioridad = r => r.cancelado?3:(r.esComplemento?2:(r.saldoPendiente>0?0:1));
    const sorted = [...g.recibos].sort((a,b)=>prioridad(a)-prioridad(b)||b.folio-a.folio);
    const chips = sorted.map(r=>{
      const fs='#'+folioConLetra(r.folio, r.anio_folio, r.letra||'A');
      let clase,ico;
      if(r.cancelado)             { clase='cancelado';   ico='🚫'; }
      else if(r.esComplemento)    { clase='complemento'; ico='↳';  }
      else if(r.saldoPendiente>0) { clase='pendiente';   ico='⚠️'; }
      else                        { clase='pagado';      ico='✅'; }
      const _esJuicAb3=window._abiertoSinCosto(r); const tip = r.cancelado?'CANCELADO':r.esComplemento?'Complemento ref.#'+folioFormato(r.folioRef||0):(_esJuicAb3?window._abLbl(r).corto:(r.saldoPendiente>0?'Pendiente $'+fmtMXN(r.saldoPendiente):'Liquidado'));
      return '<span class="pbc-chip '+clase+'" title="'+fs+' · '+(r.fecha||'—')+' · '+tip+'">'
        +ico+' '+fs+(r.fecha?'<span class="pbc-chip-fecha">'+fmtFecha(r.fecha)+'</span>':'')+'</span>';
    }).join('');
    const nPend=g.recibos.filter(r=>!r.cancelado&&!r.esComplemento&&r.saldoPendiente>0).length;
    const nPag =g.recibos.filter(r=>!r.cancelado&&!r.esComplemento&&!(r.saldoPendiente>0)).length;
    const nCanc=g.recibos.filter(r=>r.cancelado).length;
    const total=g.recibos.length;
    const partes=[];
    if(nPend) partes.push('<span style="color:#9a5a10">'+nPend+' pend.</span>');
    if(nPag)  partes.push('<span style="color:#1a5a2a">'+nPag+' liq.</span>');
    if(nCanc) partes.push('<span style="color:#888">'+nCanc+' canc.</span>');
    const _nomAttr = escHTML(g.nombre).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<div class="pbc-card">'
      +'<div class="pbc-nombre-row" style="cursor:pointer;margin-bottom:0;" onclick="abrirClienteRapido(\''+_nomAttr+'\')" title="Ver historial e iniciar trámite">'
      +'<span style="text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;">'+escHTML(g.nombre)+'</span>'
      +'</div></div>';
  }).join('');
}
function buscarClienteCaja(){
  const inp     = document.getElementById('cajaBusca-input');
  const clearBtn= document.getElementById('cajaBusca-clear');
  const countEl = document.getElementById('cajaBusca-count');
  const resDiv  = document.getElementById('cajaBusca-res');
  if(!inp) return;
  const q = (inp.value || '').trim();
  clearBtn.style.display = q ? 'inline-block' : 'none';
  // Si es puramente numérico (folio), se permite buscar desde 1 solo dígito
  // (ej. "1") y la coincidencia es EXACTA — evita que "1" traiga también
  // 11, 111, 1111, 12, 13, etc. Para nombre se mantiene el mínimo de 2 y la
  // coincidencia parcial de siempre.
  const esNumerico = /^[0-9]+$/.test(q);
  if(!esNumerico && q.length < 2){
    resDiv.style.display='none'; resDiv.innerHTML=''; countEl.textContent=''; return;
  }
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  const qn = norm(q);
  const qnFolio = qn.replace(/^#/,'');
  const folioExacto = esNumerico ? parseInt(q, 10) : null;
  const grupos = {};
  (appData.recibos||[]).forEach(r=>{
    const nk = norm(r.nombre);
    // Coincide por nombre, o por folio: exacto si se escribió solo el número
    // (ej. "1" → solo folio 1), o parcial si se combina con letra (ej. "57b")
    const coincideFolio = esNumerico
      ? (r.folio === folioExacto)
      : norm(folioConLetra(r.folio, r.anio_folio, r.letra || 'A')).includes(qnFolio);
    if(!nk.includes(qn) && !coincideFolio) return;
    if(!grupos[nk]) grupos[nk]={ nombre:r.nombre, recibos:[] };
    grupos[nk].recibos.push(r);
  });
  _renderCajaBuscaResultados(Object.values(grupos), resDiv, countEl, escHTML(q));
}
function limpiarBuscaCaja(){
  const inp = document.getElementById('cajaBusca-input');
  if(inp){ inp.value=''; inp.focus(); }
  const cl = document.getElementById('cajaBusca-clear');
  if(cl) cl.style.display='none';
  const res = document.getElementById('cajaBusca-res');
  if(res){ res.style.display='none'; res.innerHTML=''; }
  const cnt = document.getElementById('cajaBusca-count');
  if(cnt) cnt.textContent='';
}
function abrirFolioPBC(folio, esComplemento){
  if(esComplemento){
    const r=(appData.recibos||[]).find(rc=>rc.folio===folio);
    if(r&&r.folioRef){
      showModal('Folio complemento','Este es un abono del folio #'+folioFormato(r.folioRef)+'. Se abrirá el recibo original.');
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
function abrirFolioDesdeCliente(folio){
  if(typeof cerrar==='function') cerrar('mClienteRapido');
  if(typeof ir==='function') ir('nuevo-recibo');
  // Ir DIRECTO a la consulta del folio SIN mostrar el formulario de captura.
  // ir('nuevo-recibo') ejecutó limpiarFormCompleto(), que quitó 'modo-consulta' y
  // reveló el formulario vacío. Reactivamos 'modo-consulta' de inmediato (lo oculta por
  // CSS) y cargamos de forma SÍNCRONA —sin setTimeout— para que el navegador no alcance
  // a pintar el formulario antes de que aparezca la consulta.
  document.body.classList.add('modo-consulta');
  if(typeof abrirFolioPBC==='function') abrirFolioPBC(folio, false);
}
// ── BUSCADOR RÁPIDO DE CLIENTES ───────────────────────────────────
function abrirClienteRapido(nombre){
  // FIX: limpiar la búsqueda de "Buscar cliente (por recibos)" al seleccionar
  // un resultado — antes se quedaba abierta con el texto y la lista visibles.
  if(typeof limpiarBuscaCaja==='function') limpiarBuscaCaja();
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  const nNorm = norm(nombre);
  const recibos = (appData.recibos||[]).filter(r => norm(r.nombre) === nNorm);
  if(!recibos.length) return;
  // Datos de contacto: tomar del recibo más reciente que los tenga
  const sorted = [...recibos].sort((a,b) => b.folio - a.folio);
  let movil = '', tel = '', domicilio = '';
  for(const r of sorted){
    const c = (r.clientes||[])[0] || {};
    if(!movil    && c.movil)    movil    = c.movil;
    if(!tel      && c.tel)      tel      = c.tel;
    if(!domicilio && c.domicilio) domicilio = c.domicilio;
    if(movil && tel && domicilio) break;
  }
  // ── Lista de trámites (solo folios principales serie "A") ──
  function _saldoRv(r){
    if(r.saldoPendiente !== undefined && r.saldoPendiente !== null) return parseFloat(r.saldoPendiente)||0;
    if(r.saldoNuevo     !== undefined && r.saldoNuevo     !== null) return parseFloat(r.saldoNuevo)||0;
    return 0;
  }
  function _fechaModal(iso){
    if(!iso) return '—';
    var p = String(iso).split('-');
    if(p.length < 3) return iso;
    var _meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    var dd = ('0'+parseInt(p[2],10)).slice(-2);
    var mm = _meses[parseInt(p[1],10)-1] || '???';
    var aa = String(p[0]).slice(-2);
    return dd+'-'+mm+'-'+aa;
  }
  var _porFolio = {};
  recibos.filter(function(r){ return !r.esComplemento; }).forEach(function(r){
    if(_porFolio[r.folio] === undefined) _porFolio[r.folio] = [];
    _porFolio[r.folio].push(r);
  });
  var _folios = Object.keys(_porFolio).map(Number).sort(function(a,b){ return b-a; });
  var listaHtml = _folios.map(function(fol){
    var vers = _porFolio[fol].slice().sort(function(a,b){
      var la=(a.letra||'A'), lb=(b.letra||'A');
      return la<lb?-1:la>lb?1:0;
    });
    var primero = vers[0], ultimo = vers[vers.length-1];
    // Sin Costo Pactado: usar el adeudo real (misma fuente que el PDF/Ficha) en vez
    // del campo .total guardado, que no representa un total pactado real.
    var _esJuicioAbModal = (typeof window._abiertoSinCosto==='function') && window._abiertoSinCosto(ultimo);
    var saldoFinal = _esJuicioAbModal
      ? ((typeof window._adeudoServicioComplementario==='function') ? window._adeudoServicioComplementario(ultimo).total : 0)
      : _saldoRv(ultimo);
    var totalTram  = _esJuicioAbModal
      ? 0
      : (parseFloat(ultimo.total)||parseFloat(primero.total)||(primero.conceptos||[]).reduce(function(s,c){return s+(parseFloat(c.precio)||0);},0));
    var cancelado  = !!ultimo.cancelado;
    var liquidado  = _esJuicioAbModal ? false : (!cancelado && saldoFinal <= 0 && totalTram > 0);
    var color   = cancelado ? '#5F5E5A' : (liquidado ? '#1a7a3a' : '#b06a10');
    var estatus = cancelado ? 'CANCELADO' : (liquidado ? 'LIQUIDADO' : 'PENDIENTE');
    var folioTxt = folioFormato(fol) + 'A';
    var fechaTxt = _fechaModal(primero.fecha || primero.fecha_recibo);
    var _c0 = (primero.conceptos||[])[0] || {};
    var _concepto = String(_c0.concepto||'').trim();
    var _descrip  = String(_c0.descripcion||'').trim();
    var textoFull = (_concepto + ' ' + _descrip).trim() || '(sin concepto)';
    // Mostrar máximo 125 caracteres (ancho del modal a 1190px); el resto se corta con "…"
    var textoCorto = textoFull.length > 125 ? textoFull.slice(0,125).replace(/\s+$/,'') + '…' : textoFull;
    return '<div class="mcr-row" onclick="abrirFolioDesdeCliente('+fol+')" title="'+escHTML(textoFull)+'">'
      + '<span class="mcr-folio" style="color:'+color+';">'+escHTML(folioTxt)+'</span>'
      + '<span class="mcr-fecha">'+fechaTxt+'</span>'
      + '<span class="mcr-desc" style="color:'+color+';font-weight:700;">'+escHTML(textoCorto)+'</span>'
      + '<span class="mcr-estatus" style="color:'+color+';">'+estatus+'</span>'
      + '</div>';
  }).join('');
  if(!listaHtml) listaHtml = '<div class="pbc-empty">Sin trámites registrados.</div>';
  // Iniciales para avatar
  const initials = nombre.trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('');
  const modal = document.getElementById('mClienteRapido');
  document.getElementById('mCR-avatar').textContent  = initials;
  document.getElementById('mCR-nombre').textContent  = nombre;
  document.getElementById('mCR-lista').innerHTML     = listaHtml;
  document.getElementById('mCR-tel').textContent     = movil || tel || '—';
  document.getElementById('mCR-dom').textContent     = domicilio || '—';
  modal.dataset.nombre    = nombre;
  modal.dataset.movil     = movil;
  modal.dataset.tel       = tel;
  modal.dataset.domicilio = domicilio;
  modal.classList.add('show');
}
function iniciarTramiteDesdeCliente(){
  const modal    = document.getElementById('mClienteRapido');
  const nombre   = modal.dataset.nombre    || '';
  const movil    = modal.dataset.movil     || '';
  const tel      = modal.dataset.tel       || '';
  const domicilio= modal.dataset.domicilio || '';
  cerrar('mClienteRapido');
  if(typeof ir === 'function') ir('nuevo-recibo');
  if(window._panelesBusquedaAbiertos) togglePanelesBusqueda();
  if(typeof limpiarForm === 'function') limpiarForm();
  setTimeout(()=>{
    const elNombre = document.querySelector('#clientes-wrapper .cliente-row [id^="nombre_"]');
    const elMovil  = document.querySelector('#clientes-wrapper .cliente-row [id^="movil_"]');
    const elTel    = document.querySelector('#clientes-wrapper .cliente-row [id^="tel_"]');
    const elDom    = document.querySelector('#clientes-wrapper .cliente-row [id^="domicilio_"]');
    if(elNombre && nombre)   { elNombre.value = nombre;    elNombre.dispatchEvent(new Event('input')); }
    if(elMovil  && movil)    elMovil.value    = movil;
    if(elTel    && tel)      elTel.value      = tel;
    if(elDom    && domicilio) elDom.value     = domicilio;
    if(nombre) toast('✅ Datos de '+nombre.split(' ')[0]+' cargados — completa el trámite','ok');
  }, 120);
}
// ── EVENTOS ──────────────────────────────────────────────────────
document.addEventListener('input',function(e){
  if(e.target.id?.startsWith('nombre_')||['fecha_recibo','hora_recibo'].includes(e.target.id))
    generarQRPreview();
});
