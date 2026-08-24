// ══════════════════════════════════════════════════════════════════════════════
// RESTAURAR FLUJO CONTABLE — Motor completo
// Solo toca D.movimientos donde fuente === 'recibo'
// Fuente de verdad: PDF en R2 leídos con Mistral OCR
// ══════════════════════════════════════════════════════════════════════════════

function adminAbrirRestaurarFlujo() {
  document.querySelectorAll('#adminModal .admin-panel').forEach(function(z){ z.classList.remove('show'); });
  var zona = document.getElementById('adminRestaurarFlujoZone');
  if (zona) zona.classList.add('show');
  var inp = document.getElementById('rfc-folio-input');
  if (inp) { inp.value = ''; setTimeout(function(){ inp.focus(); }, 120); }
  var prog = document.getElementById('rfc-progreso');
  if (prog) { prog.style.display = 'none'; prog.innerHTML = ''; }
  var res = document.getElementById('rfc-resultado');
  if (res) res.innerHTML = '';
}


// ── Parser corregido: extrae los 9 campos del PDF LEX-MÉXICO ────────────────
// Versión A: cuadro inferior = TOTAL / ABONADO / RESTA
// Versión B,C,D: cuadro inferior = SALDO ANTERIOR / PAGO RECIBIDO / SALDO RESTANTE
// La fecha y hora de CADA versión está en la línea principal del encabezado.
function _rfcParsearPDF(texto) {
  var t     = (texto || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  var tFlat = t.replace(/[\r\n]+/g, ' ').replace(/\|/g, ' ').replace(/\s{2,}/g, ' ');

  function buscarMonto() {
    for (var i = 0; i < arguments.length; i++) {
      var re = new RegExp(
        arguments[i] + '[\\s:]*\\$?\\s*([\\d]{1,3}(?:,\\d{3})+(?:\\.\\d{2})?|\\d{4,}(?:\\.\\d{2})?|\\d+\\.\\d{2})',
        'i'
      );
      var m = re.exec(tFlat);
      if (m) return parseFloat(m[1].replace(/,/g, ''));
    }
    return null;
  }

  function buscarTexto() {
    for (var i = 0; i < arguments.length; i++) {
      var re = new RegExp(
        arguments[i] + '[\\s:]+([^\\n$\\d]{3,80}?)(?:\\s{2,}|\\n|\\$|\\d{4})',
        'i'
      );
      var m = re.exec(t);
      if (m && m[1].trim().length > 2) return m[1].trim().replace(/\s+/g, ' ');
    }
    return null;
  }

  // Fecha/hora: buscar guión largo seguido de fecha larga en el encabezado
  var fechaISO = null, horaVal = null;
  var MESES = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',
               julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};

  var encRe = /\u2014\s*(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})\s+(\d{1,2}:\d{2})\s*hrs?/i;
  var enc = encRe.exec(tFlat);
  if (enc) {
    fechaISO = enc[3] + '-' + (MESES[enc[2].toLowerCase()]||'01') + '-' + enc[1].padStart(2,'0');
    horaVal  = enc[4].padStart(5, '0');
  }
  if (!fechaISO) {
    var fd1 = /(\d{4}-\d{2}-\d{2})/.exec(tFlat);
    var fd2 = /(\d{2})\/(\d{2})\/(\d{4})/.exec(tFlat);
    if (fd1) fechaISO = fd1[1];
    else if (fd2) fechaISO = fd2[3] + '-' + fd2[2] + '-' + fd2[1];
  }
  if (!horaVal) {
    var hm = /(\d{1,2}:\d{2})(?:\s*hrs?\.?)?/i.exec(tFlat);
    if (hm) horaVal = hm[1].padStart(5, '0');
  }

  // Nombre — la fila de datos suele ser "NOMBRE  MÓVIL  TEL. CASA" (encabezados)
  // y el nombre real va en el renglón siguiente. Evitar capturar los encabezados.
  // FIX (caso real: folio 76): cuando el campo NOMBRE del PDF viene vac\u00edo, la
  // extracci\u00f3n de texto a veces arrastra el separador de columnas ("|") antes
  // del siguiente encabezado \u2014 el texto capturado queda "| M\u00d3VIL | TEL. CASA"
  // en vez de "M\u00d3VIL...". El check original solo miraba si el texto EMPEZABA
  // exactamente con la palabra de encabezado, as\u00ed que ese "|" al frente lo
  // dejaba pasar como si fuera un nombre real. Ahora se ignoran los s\u00edmbolos
  // no alfanum\u00e9ricos (|, espacios, :, -) al inicio antes de comparar.
  var _esEncabezadoNom = function(s){
    return !s || /^[^A-Za-z0-9\u00c0-\u00ff]*(M[\u00d3O]VIL|TEL\.?\s*CASA|TEL[\u00c9E]FONO|DOMICILIO|NOMBRE)\b/i.test(s.trim());
  };
  var _limpNom = function(s){ return s ? s.trim().replace(/\s+/g,' ').replace(/[\s|]+$/,'') : s; };
  var nombreVal = null;
  // 1) Renglón siguiente a los encabezados NOMBRE/MÓVIL/TEL
  var _mNom1 = /NOMBRE[^\n]*\n\s*([A-Za-z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF.'\- ]{4,70}?)(?:\s{2,}|\n|\d|\$)/.exec(t);
  if (_mNom1 && !_esEncabezadoNom(_mNom1[1])) nombreVal = _limpNom(_mNom1[1]);
  // 2) Flattened: "...NOMBRE MÓVIL TEL. CASA <NOMBRE REAL> <telefono>..."
  if (!nombreVal) {
    var _mNom2 = /NOMBRE\s+M[\u00d3O]VIL\s+TEL\.?\s*CASA\s+([A-Za-z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF.'\- ]{4,70}?)(?:\s{2,}|\d|DOMICILIO)/i.exec(tFlat);
    if (_mNom2) nombreVal = _limpNom(_mNom2[1]);
  }
  // 3) Tras DATOS DEL CLIENTE, saltando la fila de encabezados si la hay
  if (!nombreVal) {
    var _mNom3 = /DATOS DEL CLIENTE\s*\n(?:[^\n]*NOMBRE[^\n]*\n)?\s*([A-Za-z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF.'\- ]{4,70}?)(?:\s{2,}|\n|\d|\$)/i.exec(t);
    if (_mNom3 && !_esEncabezadoNom(_mNom3[1])) nombreVal = _limpNom(_mNom3[1]);
  }
  // 4) Fallback original, descartando encabezados
  if (!nombreVal) {
    var _btNom = buscarTexto('NOMBRE', 'Cliente', 'Sr\\.', 'Sra\\.', 'C\\.');
    if (_btNom && !_esEncabezadoNom(_btNom)) nombreVal = _limpNom(_btNom);
  }

  // Concepto y descripción
  var conceptoVal    = buscarTexto('CONCEPTO', 'Concepto del tr\u00e1mite', 'Tr\u00e1mite');
  var descripcionVal = buscarTexto('DESCRIPCI[\u00d3O]N', 'Descripcion');

  // Montos
  // NOTA (formato nuevo, sin bloque "PAGOS PARCIALES"): "ANTICIPO INICIAL" y
  // el fallback "Liquidación total" de abajo solo existen en PDFs viejos ya
  // archivados (antes de quitar ese bloque del recibo impreso). En un PDF con
  // el formato nuevo estas dos búsquedas simplemente no harán match — eso es
  // esperado, no un error — porque `_rfcMonto()` ya cae a `totalAbonado`
  // (etiqueta "ABONADO:" del cuadro de totales, que nunca se quitó) para dar
  // el mismo monto. Se conservan ambas para poder seguir leyendo folios con
  // versiones mezcladas (viejas y nuevas) sin distinguir el formato aquí.
  var pagoRecibido  = buscarMonto('PAGO RECIBIDO', 'PAGO RECIBIDO EN ESTE RECIBO', 'CANTIDAD RECIBIDA');
  var saldoAnterior = buscarMonto('SALDO ANTERIOR');
  var saldoRestante = buscarMonto('SALDO RESTANTE', 'SALDO PENDIENTE');
  var totalAbonado  = buscarMonto('TOTAL ABONADO', 'ABONADO:', 'TOTAL ABONADO:');
  var resta         = buscarMonto('RESTA:', 'RESTA ');
  var totalTramite  = buscarMonto('TOTAL DEL TR[A\u00c1]MITE', 'TOTAL:', 'COSTO DEL TR[A\u00c1]MITE');
  var anticipo      = buscarMonto('ANTICIPO INICIAL', 'ANTICIPO:', 'Anticipo Inicial'); // legacy: solo PDFs viejos

  // Fallback: "Liquidación total $7,000.00" en tabla de pagos (legacy, ver nota arriba)
  if (!pagoRecibido || pagoRecibido <= 0) {
    var liqM = /Liquidaci[o\u00f3]n\s+total[^$]*\$\s*([\d]{1,3}(?:,\d{3})+(?:\.\d{2})?|\d{4,}(?:\.\d{2})?|\d+\.\d{2})/i.exec(tFlat);
    if (liqM) pagoRecibido = parseFloat(liqM[1].replace(/,/g, ''));
  }

  // ── RECIBO DE CANCELACIÓN: detectar monto y tipo desde el cuadro TRÁMITE CANCELADO ──
  // El PDF imprime: "EGRESO: -$2,400.00" o "INGRESO: +$500.00" dentro del recuadro rojo
  var esCancelacion = /TR[\u00c1A]MITE\s+CANCELADO/i.test(tFlat) || /RECIBO\s+DE\s+CANCELACI[\u00d3O]N/i.test(tFlat);
  var montoCancel = null, tipoCancel = null;
  if (esCancelacion) {
    // Buscar EGRESO: -$X,XXX.XX
    var egRe = /EGRESO\s*:\s*-?\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{4,}(?:\.\d{2})?|\d+\.\d{2})/i.exec(tFlat);
    if (egRe) { montoCancel = parseFloat(egRe[1].replace(/,/g,'')); tipoCancel = 'egreso'; }
    // Buscar INGRESO: +$X,XXX.XX (honorarios por cancelación)
    if (!montoCancel) {
      var inRe = /INGRESO\s*:\s*\+?\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{4,}(?:\.\d{2})?|\d+\.\d{2})/i.exec(tFlat);
      if (inRe) { montoCancel = parseFloat(inRe[1].replace(/,/g,'')); tipoCancel = 'ingreso'; }
    }
    // Fallback: "Reintegro por cancelación $X" o "Honorarios por cancelación $X"
    if (!montoCancel) {
      var rcRe = /(?:Reintegro|Honorarios)\s+por\s+cancelaci[o\u00f3]n[^\d$]*\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{4,}(?:\.\d{2})?)/i.exec(tFlat);
      if (rcRe) { montoCancel = parseFloat(rcRe[1].replace(/,/g,'')); tipoCancel = 'egreso'; }
    }
  }

  // ── Servicio complementario: detectar por título o sección del PDF ──
  var esServicioComp = /RECIBO\s+DE\s+SERVICIO\s+COMPLEMENTARIO/i.test(tFlat) || /SERVICIO\s+COMPLEMENTARIO/i.test(tFlat);

  return {
    pagoRecibido:  pagoRecibido,
    totalAbonado:  totalAbonado,
    anticipo:      anticipo,
    saldoAnterior: saldoAnterior,
    saldoRestante: saldoRestante,
    resta:         resta,
    totalTramite:  totalTramite,
    fecha:         fechaISO,
    hora:          horaVal,
    nombre:        nombreVal,
    concepto:      conceptoVal,
    descripcion:   descripcionVal,
    esServicioComp: esServicioComp,
    // Campos de cancelación
    esCancelacion: esCancelacion,
    montoCancel:   montoCancel,
    tipoCancel:    tipoCancel
  };
}

// Formato nuevo: campos.anticipo suele salir null (ver nota en _rfcParsearPDF)
// pero el fallback a totalAbonado ("ABONADO:") da el mismo monto, así que el
// resultado de esta función no cambia con el recibo nuevo sin PAGOS PARCIALES.
function _rfcMonto(campos) {
  // Cancelaciones: el monto real está en montoCancel (EGRESO/INGRESO del cuadro de cancelacion (rojo o verde))
  if (campos.esCancelacion && campos.montoCancel != null && campos.montoCancel > 0) return campos.montoCancel;
  if (campos.pagoRecibido  != null && campos.pagoRecibido  > 0) return campos.pagoRecibido;
  if (campos.anticipo      != null && campos.anticipo      > 0) return campos.anticipo; // legacy
  if (campos.saldoAnterior != null && campos.saldoRestante != null) {
    var diff = campos.saldoAnterior - campos.saldoRestante;
    if (diff > 0) return diff;
  }
  if (campos.totalAbonado  != null && campos.totalAbonado  > 0) return campos.totalAbonado;
  return 0;
}

function _rfcEstatus(campos, letraV) {
  // Cancelaciones tienen su propio estatus
  if (campos.esCancelacion) return 'Cancelaci\u00f3n';
  if (campos.saldoRestante != null && campos.saldoRestante <= 0.5) return 'Liquidado';
  if (campos.resta         != null && campos.resta         <= 0.5) return 'Liquidado';
  if (letraV === 'A') return 'Anticipo';
  return 'Abono parcial';
}

// Estatus a mostrar por fila: prioriza el PDF; si no hay monto, cae a Contabilidad.
function _rfcEstatusFila(p) {
  var c = p.campos || {};
  var tieneSaldoPdf = (c.saldoRestante != null) || (c.resta != null);
  if (p.campos && ((p.montoPdf || 0) > 0 || tieneSaldoPdf)) {
    return _rfcEstatus(c, p.letra);
  }
  var movs = p.movsLv || [];
  if (movs.length) {
    return movs[movs.length - 1].estatus || movs[0].estatus || '\u2014';
  }
  return '\u2014';
}

// Badge con color segun estatus (mismo criterio que el modal Cliente encontrado)
function _rfcBadgeEstatus(est) {
  if (!est || est === '\u2014') return '';
  var col = {
    'Liquidado':       ['#1a7a3a', '#eef8f0', '#b8e0c0'],
    'Liquidaci\u00f3n':['#1a7a3a', '#eef8f0', '#b8e0c0'],
    'Anticipo':        ['#8c6518', '#fff8ec', '#e8c875'],
    'Abono parcial':   ['#a0560a', '#fff3e0', '#f0c878'],
    'Sin Anticipo':    ['#7a6840', '#f5f1e8', '#d8c8a0'],
    'Pendiente':       ['#8c6518', '#fff8ec', '#e8c875'],
    'Complementario':  ['#1a5a8c', '#eaf2fb', '#a8c8e8'],
    'Cancelaci\u00f3n':['#777777', '#f0f0f0', '#cccccc'],
    'CANCELADO':       ['#777777', '#f0f0f0', '#cccccc']
  }[est] || ['#7a6840', '#f5f5f5', '#cccccc'];
  return '<span style="display:inline-block;padding:2px 9px;border-radius:10px;font-size:0.56rem;font-weight:700;font-family:monospace;color:' +
    col[0] + ';background:' + col[1] + ';border:1px solid ' + col[2] + ';white-space:nowrap;">' + est.toUpperCase() + '</span>';
}

function _rfcConstruirMov(folio, letraV, campos) {
  var monto   = _rfcMonto(campos);
  var estatus = _rfcEstatus(campos, letraV);
  var nombre  = campos.nombre  || '\u2014';
  var conc    = campos.concepto    || '';
  var desc    = campos.descripcion || '';
  var fechaHoy  = typeof hoy  === 'function' ? hoy()  : new Date().toISOString().split('T')[0];
  var horaAhora = typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5);
  var responsable = (typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.nombre)
                    ? empleadoActual.nombre
                    : (typeof NOMBRE_TITULAR !== 'undefined' ? NOMBRE_TITULAR : '\u2014');
  // FIX (unificaci\u00f3n de descripciones en Contabilidad): folio y nombre ya
  // tienen su propia columna \u2014 no hace falta repetirlos en la descripci\u00f3n.
  var partes = [estatus, conc, desc].filter(Boolean);
  var descFinal = partes.join(' \u00b7 ') + ' [RESTAURADO-R2]';
  // Cancelaciones: respetar el tipo (egreso=reintegro, ingreso=honorarios)
  var tipoMov = (campos.esCancelacion && campos.tipoCancel) ? campos.tipoCancel : 'ingreso';
  return {
    id:          'M-REST-' + folio + '-' + letraV + '-' + Date.now(),
    folio:       Number(folio),
    letra:       letraV,
    monto:       monto,
    tipo:        tipoMov,
    estatus:     estatus,
    fuente:      'recibo',
    origen:      'RESTAURACION-PDF',
    fecha:       campos.fecha   || fechaHoy,
    hora:        campos.hora    || horaAhora,
    nombre:      nombre,
    descripcion: descFinal,
    cat:         estatus + ' \u00b7 #' + folio + letraV + (conc ? ' \u00b7 ' + conc : ''),
    folioCaja:   '',
    responsable: responsable
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  SUPER RFC · Motor de causa raíz, triangulación, confianza OCR e impacto.
//  Todo es ADITIVO y de SOLO LECTURA sobre otras fuentes (recibos / Caja); no
//  toca sync. Las correcciones siguen pasando por confirmación individual.
// ════════════════════════════════════════════════════════════════════════════
function _rfcFmt(n){ return '$' + Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); }

// Recibo en memoria (appData.recibos) para un folio + letra.
function _rfcReciboMem(folio, letraV){
  if(typeof appData==='undefined' || !Array.isArray(appData.recibos)) return null;
  var LV=String(letraV||'A').toUpperCase();
  return appData.recibos.find(function(r){
    return r && Number(r.folio)===Number(folio) && String(r.letra||'A').toUpperCase()===LV;
  }) || null;
}

// Suma de servicios complementarios (costosExtra) de un recibo.
function _rfcSumaCE(rec){
  if(!rec || !Array.isArray(rec.costosExtra)) return 0;
  return rec.costosExtra.reduce(function(s,ce){ return s+(parseFloat(ce&&ce.precio||0)||0); }, 0);
}

// Confianza del OCR por consistencia interna de los montos del PDF (0–100).
function _rfcConfianza(campos){
  if(!campos) return { pct:0, notas:['sin datos del PDF'] };
  var notas=[], pts=0, max=0;
  max+=40; if(_rfcMonto(campos)>0) pts+=40; else notas.push('monto no reconocido');
  max+=15; if(campos.fecha)  pts+=15; else notas.push('sin fecha');
  max+=10; if(campos.hora)   pts+=10; else notas.push('sin hora');
  max+=10; if(campos.nombre && campos.nombre!=='\u2014') pts+=10; else notas.push('sin nombre');
  max+=25;
  if(campos.saldoAnterior!=null && campos.saldoRestante!=null && campos.pagoRecibido!=null){
    var calc=campos.saldoAnterior - campos.saldoRestante;
    if(Math.abs(calc - campos.pagoRecibido)<=1) pts+=25;
    else notas.push('pago recibido no cuadra con saldos');
  } else { pts+=12; }
  return { pct:Math.round(pts/max*100), notas:notas };
}

// Motor de causa raíz: explica POR QUÉ existe la discrepancia.
function _rfcDiagnosticarCausa(folio, p){
  var movs=p.movsLv||[], letraV=p.letra;
  var recMem=_rfcReciboMem(folio, letraV);
  var ceRec=_rfcSumaCE(recMem);
  var out={ causa:'', txt:'', sev:'info', fixFaltante:false, montoFalt:0 };

  // 1) Asientos de otro despacho (datos mezclados) — máxima prioridad
  var ajeno=movs.filter(function(m){
    var d=m.despacho_id||m.despachoId||m.despacho||null;
    return d && window.SB_DESPACHO_ID && String(d)!==String(window.SB_DESPACHO_ID);
  });
  if(ajeno.length){ out.causa='despacho-ajeno'; out.sev='alta';
    out.txt='\u26d4 '+ajeno.length+' asiento(s) traen un despacho_id distinto al actual: posible mezcla de datos de otro despacho.'; return out; }

  if(p.tipo==='sobra'){
    var fant=movs.filter(function(m){ return /^M-(RECUP|PROT|REST)-/.test(m.id||''); });
    var ghost=movs.filter(function(m){ return (parseFloat(m.monto)||0)===0; });
    var porMonto={}; movs.forEach(function(m){ var k=(parseFloat(m.monto)||0).toFixed(2); (porMonto[k]=porMonto[k]||[]).push(m); });
    var dups=Object.keys(porMonto).filter(function(k){ return parseFloat(k)>0 && porMonto[k].length>1; });
    if(fant.length){ out.causa='fantasma'; out.sev='media'; out.txt='\ud83d\udc7b Sobra por '+fant.length+' asiento(s) fantasma del autoprotector ('+fant.map(function(m){return m.id;}).slice(0,3).join(', ')+'). No corresponden a un cobro real.'; }
    else if(ghost.length){ out.causa='ghost'; out.sev='media'; out.txt='\ud83d\udd73\ufe0f Sobra por '+ghost.length+' asiento(s) en $0 (ghost), típicos de un hueco del contador de folio.'; }
    else if(dups.length){ out.causa='duplicado'; out.sev='media'; out.txt='\ud83d\udc6f Monto duplicado con IDs distintos \u2014 posible asiento revivido por un tombstone.'; }
    else { out.causa='sobra-otra'; out.sev='media'; out.txt='Contabilidad supera al PDF sin un patrón conocido; conviene revisar en SCANSYS PRO.'; }
    return out;
  }

  if(p.tipo==='falta'){
    var falt=Math.abs(p.dif||0); out.montoFalt=falt;
    if(ceRec>0 && Math.abs(falt-ceRec)<=1){
      out.causa='complementario'; out.sev='media'; out.fixFaltante=true;
      out.txt='\u2795 El faltante ('+_rfcFmt(falt)+') coincide con el servicio complementario del recibo ('+_rfcFmt(ceRec)+'): no se sumó al ingreso en contabilidad.';
    } else {
      out.causa='faltante'; out.sev='alta'; out.fixFaltante=true;
      out.txt='\u2795 Contabilidad tiene menos que el PDF; falta registrar '+_rfcFmt(falt)+'.';
    }
    return out;
  }

  if(p.tipo==='crear'){ out.causa='sin-asiento'; out.sev='alta';
    out.txt='\u2795 Esta versión no tiene ningún asiento en contabilidad; el PDF respalda un ingreso de '+_rfcFmt(p.montoPdf)+'.'; return out; }

  if(p.tipo==='corregir-meta'){ out.causa='meta'; out.sev='baja';
    out.txt='\u270f\ufe0f El monto cuadra; solo difieren fecha/hora/nombre respecto al PDF.'; return out; }

  return out;
}

// Triangulación read-only: valor por fuente para ver dónde está la verdad.
function _rfcTriangular(folio, p){
  var pdf = (p.montoPdf!=null)?p.montoPdf:_rfcMonto(p.campos||{});
  var contab = (p.totalContab!=null)?p.totalContab:null;
  var recMem=_rfcReciboMem(folio, p.letra);
  var recTotal=recMem?parseFloat(recMem.total||0):null;
  var tieneCaja=(p.movsLv||[]).some(function(m){ return (m.folioCaja||'').toString().trim().length>0; });
  return { pdf:pdf, contab:contab, recibo:recTotal, caja:tieneCaja };
}

// ── Motor principal ─────────────────────────────────────────────────────────
window.adminRestaurarFlujoAnalizar = async function() {
  var inp  = document.getElementById('rfc-folio-input');
  var prog = document.getElementById('rfc-progreso');
  var res  = document.getElementById('rfc-resultado');
  if (!inp || !prog || !res) return;

  var folioRaw = (inp.value || '').replace(/[^0-9]/g, '').trim();
  if (!folioRaw) {
    prog.style.display = 'block';
    prog.innerHTML = '\u26a0 Ingresa un n\u00famero de folio v\u00e1lido (ej: 25)';
    return;
  }
  var folioNum = Number(folioRaw);

  if (typeof window.obtenerBlobPdfReciboValidado !== 'function' || typeof _ocrExtraerTexto !== 'function') {
    prog.style.display = 'block';
    prog.innerHTML = '\u26a0 OCR o R2 no disponibles. Inicia sesi\u00f3n primero.';
    return;
  }
  if (typeof D === 'undefined' || !Array.isArray(D.movimientos)) {
    prog.style.display = 'block';
    prog.innerHTML = '\u26a0 D.movimientos no disponible. Inicia sesi\u00f3n primero.';
    return;
  }
  if (!window.SB_DESPACHO_ID) {
    prog.style.display = 'block';
    prog.innerHTML = '\u26a0 Sin SB_DESPACHO_ID. Inicia sesi\u00f3n primero.';
    return;
  }

  prog.style.display = 'block';
  prog.innerHTML = '\u23f3 Buscando PDFs del folio #' + folioRaw + ' en R2\u2026';
  res.innerHTML  = '';

  try {
    var prefix  = window.SB_DESPACHO_ID + '/recibos/';
    var objetos = await window.listarR2(prefix, 'recibos');
    var reNombre = new RegExp('^' + folioRaw + '([A-Z])(?:_[^/]*)?\\.pdf$', 'i');
    var pdfsEnR2 = objetos.filter(function(o) {
      var nombre = (o.key || o.name || '').replace(/^.*\//, '');
      return reNombre.test(nombre);
    }).map(function(o) {
      var nombre = (o.key || o.name || '').replace(/^.*\//, '');
      var match  = reNombre.exec(nombre);
      return { key: o.key || o.name, nombre: nombre, letra: match ? match[1].toUpperCase() : '?' };
    }).sort(function(a, b) { return a.letra.localeCompare(b.letra); });

    if (!pdfsEnR2.length) {
      prog.innerHTML = '\u26a0 No se encontraron PDFs del folio #' + folioRaw + ' en R2.';
      return;
    }

    prog.innerHTML = '\u2705 ' + pdfsEnR2.length + ' PDF(s) encontrado(s): ' +
      pdfsEnR2.map(function(p){ return folioRaw + p.letra; }).join(', ') +
      ' \u00b7 Leyendo con Mistral OCR\u2026';

    var versiones = [];
    for (var i = 0; i < pdfsEnR2.length; i++) {
      var pdfInfo = pdfsEnR2[i];
      var lv = pdfInfo.letra;
      prog.innerHTML = '\u23f3 Leyendo ' + folioRaw + lv + '.pdf (' + (i+1) + '/' + pdfsEnR2.length + ')\u2026';

      var reciboMin = { folio: folioNum, letra: lv, archivoR2: pdfInfo.nombre, archivoR2Raiz: pdfInfo.key, nombre: '' };
      try {
        var blob = await window.obtenerBlobPdfReciboValidado(reciboMin);
        if (!blob) { versiones.push({ letra: lv, campos: null, error: 'PDF no descargable desde R2' }); continue; }
        var ocrRes = await _ocrExtraerTexto(blob, null);
        if (!ocrRes || !ocrRes.texto) { versiones.push({ letra: lv, campos: null, error: 'No se pudo extraer texto del PDF' }); continue; }
        var campos = _rfcParsearPDF(ocrRes.texto);
        versiones.push({ letra: lv, campos: campos, error: null });
      } catch(eOcr) {
        versiones.push({ letra: lv, campos: null, error: eOcr.message });
      }
    }

    prog.innerHTML = '\u2705 OCR completado. Analizando diferencias\u2026';

    var movsActuales = (D.movimientos || []).filter(function(m) {
      return m && !m.borrado && m.fuente === 'recibo' && String(m.folio) === String(folioNum);
    });

    var plan = versiones.map(function(v) {
      var lv     = v.letra;
      var campos = v.campos;
      var movsLv = movsActuales.filter(function(m) {
        return (m.letra || 'A').toUpperCase() === lv;
      });

      if (v.error || !campos) {
        return { letra: lv, tipo: 'error', error: v.error || 'Sin campos', movsLv: movsLv };
      }

      var montoPdf    = _rfcMonto(campos);

      // Para cancelaciones: el monto en contabilidad es egreso (negativo al sumar con signo).
      // Comparamos en valor absoluto y verificamos que el tipo sea el correcto.
      var esCan = !!(campos && campos.esCancelacion);
      var tipoEsperado = esCan ? (campos.tipoCancel || 'egreso') : 'ingreso';

      // totalContab: suma con signo (egreso negativo, ingreso positivo)
      var totalContabConSigno = +movsLv.reduce(function(s, m) {
        return s + (m.tipo === 'egreso' ? -(parseFloat(m.monto)||0) : (parseFloat(m.monto)||0));
      }, 0).toFixed(2);

      // Para cancelaciones comparamos en valor absoluto —
      // el PDF reporta siempre positivo, el movimiento puede ser egreso (negativo)
      var totalContab = esCan ? +Math.abs(totalContabConSigno).toFixed(2) : +totalContabConSigno.toFixed(2);
      var dif = +(totalContab - montoPdf).toFixed(2);

      if (montoPdf <= 0) {
        return { letra: lv, tipo: 'sin-monto', campos: campos, movsLv: movsLv, montoPdf: 0, totalContab: totalContab };
      }

      // Sin movimiento en contabilidad para esta letra
      if (movsLv.length === 0) {
        return { letra: lv, tipo: 'crear', campos: campos, movsLv: [], montoPdf: montoPdf, totalContab: 0, dif: dif };
      }

      // Cuadra exactamente (±$0.50)
      if (Math.abs(dif) <= 0.5) {
        var camposDif = [];
        if (movsLv.length === 1) {
          var mov0 = movsLv[0];
          if (campos.fecha && mov0.fecha && campos.fecha !== mov0.fecha)
            camposDif.push('fecha: PDF=' + campos.fecha + ' Contab=' + mov0.fecha);
          if (campos.hora && mov0.hora && campos.hora.slice(0,5) !== (mov0.hora||'').slice(0,5))
            camposDif.push('hora: PDF=' + campos.hora + ' Contab=' + (mov0.hora||''));
        }
        return { letra: lv, tipo: camposDif.length ? 'corregir-meta' : 'ok',
                 campos: campos, movsLv: movsLv, montoPdf: montoPdf,
                 totalContab: totalContab, dif: dif, camposDif: camposDif };
      }

      // Sobra en contabilidad
      if (dif > 0.5) {
        var candidatos = movsLv.filter(function(m) {
          return /^M-(RECUP|PROT|REST)-/.test(m.id||'') || (parseFloat(m.monto)||0) === 0;
        });
        var sinCand  = movsLv.filter(function(m) {
          return !candidatos.some(function(c){ return c.id === m.id; });
        });
        var totalSin = sinCand.reduce(function(s, m) {
          return s + (m.tipo==='egreso' ? -(parseFloat(m.monto)||0) : (parseFloat(m.monto)||0));
        }, 0);
        var planElim = (Math.abs(totalSin - montoPdf) <= 0.5 && candidatos.length > 0)
          ? { ids: candidatos.map(function(m){ return m.id; }) } : null;
        if (!planElim && movsLv.length === 2) {
          for (var jj = 0; jj < movsLv.length; jj++) {
            var jjj = jj;
            var sinEste = movsLv.filter(function(_, ix){ return ix !== jjj; })
              .reduce(function(s, m){ return s + (m.tipo==='egreso' ? -(parseFloat(m.monto)||0) : (parseFloat(m.monto)||0)); }, 0);
            if (Math.abs(sinEste - montoPdf) <= 0.5) { planElim = { ids: [movsLv[jj].id] }; break; }
          }
        }
        return { letra: lv, tipo: 'sobra', campos: campos, movsLv: movsLv,
                 montoPdf: montoPdf, totalContab: totalContab, dif: dif, planElim: planElim };
      }

      // Falta en contabilidad
      return { letra: lv, tipo: 'falta', campos: campos, movsLv: movsLv,
               montoPdf: montoPdf, totalContab: totalContab, dif: dif };
    });

    // ── SUPER RFC: enriquecer cada versión con causa raíz, confianza y triangulación ──
    plan.forEach(function(p){
      p._causa  = _rfcDiagnosticarCausa(folioNum, p);
      p._conf   = _rfcConfianza(p.campos);
      p._triang = _rfcTriangular(folioNum, p);
    });

    // ── Avisos a nivel folio: huecos de versión y cadena de saldo rota ──
    var avisos=[];
    var _soloLetraSolitaria = null;
    var letras=pdfsEnR2.map(function(x){return x.letra;}).filter(function(l){return /^[A-Z]$/.test(l);}).sort();
    if(letras.length){
      // FIX (caso real: folio 76): si hay UNA sola versión y no es la 'A',
      // casi siempre es un recibo único mal etiquetado (debería ser A, todo
      // folio empieza en A) — no un hueco real donde faltaría la versión
      // original Y existiría de verdad una versión posterior. Se distingue con
      // un aviso propio y un botón para corregirlo, en vez del mensaje genérico
      // de "falta el PDF de la versión A" (que sugiere que A existe en otro lado).
      if(letras.length === 1 && letras[0] !== 'A'){
        _soloLetraSolitaria = letras[0];
        avisos.push('\u26a0 Este folio tiene UNA sola versión (' + folioRaw + letras[0] + ') y no está etiquetada como A — todo folio debería empezar en letra A. Esto normalmente es un error de etiquetado del recibo único, no una versión A perdida. Usa el botón "🔧 Corregir a Folio A" de abajo.');
      } else {
        var maxCode=letras[letras.length-1].charCodeAt(0);
        for(var cc=65; cc<=maxCode; cc++){
          var L=String.fromCharCode(cc);
          if(letras.indexOf(L)<0) avisos.push('\u26a0 Falta el PDF de la versión ' + folioRaw + L + ' en R2 (existe ' + folioRaw + letras[letras.length-1] + ' pero no ' + folioRaw + L + ').');
        }
      }
    }
    for(var vi=0; vi<versiones.length-1; vi++){
      var ca=versiones[vi].campos, cb=versiones[vi+1].campos;
      if(ca && cb && ca.saldoRestante!=null && cb.saldoAnterior!=null && Math.abs(ca.saldoRestante-cb.saldoAnterior)>1){
        avisos.push('\u26a0 Cadena de saldo rota: ' + folioRaw + versiones[vi].letra + ' deja resta ' + _rfcFmt(ca.saldoRestante) + ' pero ' + folioRaw + versiones[vi+1].letra + ' parte de saldo anterior ' + _rfcFmt(cb.saldoAnterior) + '.');
      }
    }

    // ── Historial reciente (navegación 1×1, sin escaneo global) ──
    window._rfcHistorial = window._rfcHistorial || [];
    if(window._rfcHistorial.indexOf(folioRaw)<0){ window._rfcHistorial.unshift(folioRaw); window._rfcHistorial=window._rfcHistorial.slice(0,8); }

    window._rfcPlanActual = { folio: folioRaw, plan: plan, avisos: avisos, soloLetraSolitaria: _soloLetraSolitaria };
    _rfcRenderVistaPre(folioRaw, plan, res, prog);

  } catch(e) {
    prog.innerHTML = '\u274c Error al analizar: ' + (e && e.message ? e.message : String(e));
  }
};

// ── Renderizar vista previa ─────────────────────────────────────────────────

// ── Helpers de tipo y color para sub de versiones RFC ──────────────────────
function _rfcTipoLabel(campos, letraV) {
  if (!campos) return 'ANTICIPO';
  if (campos.esCancelacion) return campos.tipoCancel === 'ingreso' ? 'INGRESO' : 'EGRESO';
  if (campos.saldoRestante != null && campos.saldoRestante <= 0.5) return 'LIQUIDADO';
  if (campos.resta         != null && campos.resta         <= 0.5) return 'LIQUIDADO';
  if (letraV === 'A') return 'ANTICIPO';
  return 'ABONO PARCIAL';
}
function _rfcTipoColor(campos, letraV) {
  if (!campos) return '#1a7a3a';
  if (campos.esCancelacion) return campos.tipoCancel === 'ingreso' ? '#1a7a3a' : '#c0161a';
  return '#1a7a3a';
}
function _rfcRenderVistaPre(folio, plan, resEl, progEl) {
  var totalProblemas = plan.filter(function(p){ return p.tipo !== 'ok' && p.tipo !== 'sin-monto'; }).length;

  var filas = plan.map(function(p, idx) {
    var lv  = p.letra;
    var cls = { ok:'ok', 'corregir-meta':'partido', crear:'falta', sobra:'sobra',
                falta:'partido', partido:'partido', error:'sin-pdf', 'sin-monto':'sin-pdf' }[p.tipo] || 'sin-pdf';

    var titulo = '', sub = '', accionHtml = '';
    var fmtM   = function(n){ return '$' + Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); };

    if (p.tipo === 'ok') {
      var c = p.campos || {};
      var partesFecha = [];
      if (c.fecha) partesFecha.push('Fecha: ' + fmtFecha(c.fecha));
      if (c.hora)  partesFecha.push('Hora: ' + c.hora + ' hrs');
      if (c.nombre) partesFecha.push(c.nombre);
      titulo = '\u2705 ' + folio + lv + ' \u2014 Correcto';
      // Tipo con color: rojo para egresos/cancelaciones, verde para ingresos
      var _tipoLabel = _rfcTipoLabel(p.campos, lv);
      var _tipoColor = _rfcTipoColor(p.campos, lv);
      var _tipoSpan  = '<span style="font-weight:700;color:' + _tipoColor + ';">' + _tipoLabel + '</span>';
      sub    = _tipoSpan + ' ' + fmtM(p.montoPdf) + (partesFecha.length ? ' \u00b7 ' + partesFecha.join(' \u00b7 ') : '');
    } else if (p.tipo === 'corregir-meta') {
      titulo = '\u270f\ufe0f ' + folio + lv + ' \u2014 Monto OK \u00b7 metadata a corregir (' + p.camposDif.join(', ') + ')';
      sub    = 'Monto: ' + fmtM(p.montoPdf);
      accionHtml = '<button class="rfc-btn-accion" data-idx="' + idx + '" data-accion="corregir-meta" style="background:#8c6518;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-family:monospace;font-size:0.62rem;font-weight:700;cursor:pointer;">\u270f\ufe0f Corregir metadata</button>';
    } else if (p.tipo === 'crear') {
      var c = p.campos || {};
      titulo = '\u2795 ' + folio + lv + ' \u2014 FALTA en Contabilidad';
      sub    = 'PDF: ' + fmtM(p.montoPdf) + ' \u00b7 ' + fmtFecha(c.fecha||'sin fecha') + ' ' + (c.hora||'') + ' \u00b7 ' + (c.nombre||'') + ' \u00b7 ' + (c.concepto||'');
      accionHtml = '<button class="rfc-btn-accion" data-idx="' + idx + '" data-accion="crear" style="background:#1a7a3a;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-family:monospace;font-size:0.62rem;font-weight:700;cursor:pointer;">\u2795 Crear movimiento</button>';
    } else if (p.tipo === 'sobra') {
      titulo = '\ud83d\udd34 ' + folio + lv + ' \u2014 SOBRA en Contabilidad';
      sub    = 'PDF: ' + fmtM(p.montoPdf) + ' \u00b7 Contabilidad: ' + fmtM(p.totalContab) + ' \u00b7 Sobran: ' + fmtM(Math.abs(p.dif));
      accionHtml = p.planElim
        ? '<button class="rfc-btn-accion" data-idx="' + idx + '" data-accion="eliminar" style="background:#c0161a;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-family:monospace;font-size:0.62rem;font-weight:700;cursor:pointer;">\ud83d\uddd1 Eliminar ' + p.planElim.ids.length + ' sobrante(s)</button>'
        : '<span style="font-size:0.58rem;color:#c0161a;font-family:monospace;">\u26a0 Revisar manualmente en SCANSYS PRO</span>';
    } else if (p.tipo === 'falta') {
      var _esCan2 = !!(p.campos && p.campos.esCancelacion);
      var _tipoCan2 = _esCan2 ? (p.campos.tipoCancel || 'egreso').toUpperCase() : '';
      titulo = '\u26a0\ufe0f ' + folio + lv + (_esCan2 ? ' \u2014 Cancelaci\u00f3n \u00b7 ' + _tipoCan2 + ' sin registrar' : ' \u2014 Monto insuficiente en Contabilidad');
      sub    = 'PDF: ' + fmtM(p.montoPdf) + ' \u00b7 Contabilidad: ' + fmtM(p.totalContab) + ' \u00b7 Faltan: ' + fmtM(Math.abs(p.dif));
    } else if (p.tipo === 'partido') {
      titulo = '\u26a0\ufe0f ' + folio + lv + ' \u2014 Monto OK pero partido en ' + (p.movsLv||[]).length + ' asientos';
      sub    = 'PDF: ' + fmtM(p.montoPdf) + ' \u00b7 Ver SCANSYS PRO para consolidar';
    } else if (p.tipo === 'error') {
      titulo = '\u274c ' + folio + lv + ' \u2014 Error al leer PDF';
      sub    = p.error || 'Error desconocido';
    } else {
      // Verificar si el PDF sin montos es una cancelación — puede tener EGRESO válido
      var _camposF = p.campos || {};
      if (_camposF.esCancelacion) {
        titulo = '\ud83d\udeab ' + folio + lv + ' \u2014 Recibo de Cancelaci\u00f3n';
        sub    = 'Cancelaci\u00f3n detectada. Monto del EGRESO/INGRESO extraído del cuadro de cancelacion (rojo o verde segun el tipo).';
      } else {
        titulo = '\ud83d\udd0d ' + folio + lv + ' \u2014 PDF sin montos reconocibles';
        sub    = 'Puede ser formato antiguo o r' + '\u00e9' + 'cibo sin monto';
      }
    }

    var estTxt   = _rfcEstatusFila(p);
    var estBadge = _rfcBadgeEstatus(estTxt);
    var compBadge = (p.campos && p.campos.esServicioComp)
      ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.56rem;font-weight:700;font-family:monospace;color:#1a5a8c;background:#eaf2fb;border:1px solid #a8c8e8;white-space:nowrap;">\uD83E\uDDE9 SERV. COMPL.</span>'
      : '';

    var bg = { ok:'#eef8f0', falta:'#fff8ec', sobra:'#fdeeee', partido:'#fff3e0', 'sin-pdf':'#f5f5f5' }[cls] || '#f5f5f5';
    var br = { ok:'#b8e0c0', falta:'#d4b060', sobra:'#f0b8b8', partido:'#f0c878', 'sin-pdf':'#ccc' }[cls] || '#ccc';

    // ── SUPER RFC: causa raíz, confianza OCR, triangulación y botón faltante ──
    var causaHtml='', confHtml='', triangHtml='';
    if (p._causa && p._causa.txt) {
      var _sevCol = { alta:'#c0161a', media:'#a0560a', baja:'#1a5a8c', info:'#7a6840' }[p._causa.sev] || '#7a6840';
      causaHtml = '<div style="font-size:0.62rem;color:' + _sevCol + ';line-height:1.5;margin-bottom:6px;"><b>Causa:</b> ' + p._causa.txt + '</div>';
    }
    if (p._conf && p._conf.pct < 80) {
      confHtml = '<div style="font-size:0.58rem;color:#a0560a;margin-bottom:6px;">\u26a0 Confianza OCR ' + p._conf.pct + '%' + ((p._conf.notas&&p._conf.notas.length)?' ('+p._conf.notas.join(', ')+')':'') + ' \u2014 verifica con \u201cVer PDF\u201d.</div>';
    }
    if (p._triang) {
      var _tr = p._triang;
      var _cell = function(lbl,val,ref){
        if(val==null) return '<span style="color:#999;">'+lbl+' \u2014</span>';
        var _mis=(ref!=null && Math.abs(val-ref)>1);
        return '<span style="color:'+(_mis?'#c0161a':'#5a4010')+';font-weight:'+(_mis?'700':'400')+';">'+lbl+' '+_rfcFmt(val)+'</span>';
      };
      triangHtml = '<div style="font-size:0.58rem;font-family:monospace;margin-bottom:6px;">'+
        _cell('PDF',_tr.pdf,null)+' \u00b7 '+_cell('Contab',_tr.contab,_tr.pdf)+' \u00b7 '+_cell('Recibo',_tr.recibo,_tr.pdf)+
        ' \u00b7 <span style="color:'+(_tr.caja?'#1a7a3a':'#999')+';">Caja '+(_tr.caja?'\u2713':'\u2014')+'</span></div>';
    }
    // El caso "falta" deja de ser solo aviso: ofrece registrar el faltante.
    if (p.tipo==='falta' && p._causa && p._causa.fixFaltante && p._causa.montoFalt>0) {
      accionHtml = '<button class="rfc-btn-accion" data-idx="' + idx + '" data-accion="crear-faltante" style="background:#1a7a3a;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-family:monospace;font-size:0.62rem;font-weight:700;cursor:pointer;">\u2795 Registrar faltante ' + _rfcFmt(p._causa.montoFalt) + '</button>';
    }

    return '<div id="rfc-fila-' + idx + '" style="background:' + bg + ';border:1px solid ' + br + ';border-radius:8px;padding:12px 14px;margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;">' +
        '<span style="font-size:0.75rem;font-weight:700;color:#1a1008;line-height:1.3;">' + titulo + '</span>' +
        ((compBadge || estBadge) ? '<span style="flex-shrink:0;display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">' + compBadge + estBadge + '</span>' : '') +
      '</div>' +
      '<div style="font-size:0.65rem;color:#5a4010;line-height:1.6;margin-bottom:6px;">' + sub + '</div>' +
      causaHtml + triangHtml + confHtml +
      '<div style="margin-bottom:6px;">' +
        '<button class="rfc-btn-ver-pdf" data-folio="' + folio + '" data-letra="' + lv + '" ' +
          'style="display:inline-flex;align-items:center;gap:5px;background:rgba(26,74,138,0.08);border:1px solid rgba(26,74,138,0.3);border-radius:6px;padding:4px 10px;font-family:monospace;font-size:0.6rem;font-weight:700;color:#1a4a8a;cursor:pointer;transition:all 0.18s;" ' +
          'onmouseover="this.style.background=\'rgba(26,74,138,0.18)\'" ' +
          'onmouseout="this.style.background=\'rgba(26,74,138,0.08)\'">' +
          '\uD83D\uDC41 Ver PDF</button>' +
        '<button class="rfc-btn-accion" data-idx="' + idx + '" data-accion="reparar" style="display:inline-flex;align-items:center;gap:5px;background:rgba(26,122,58,0.10);border:1px solid rgba(26,122,58,0.45);border-radius:6px;padding:4px 10px;margin-left:6px;font-family:monospace;font-size:0.6rem;font-weight:700;color:#1a7a3a;cursor:pointer;" title="Toma la verdad del PDF/movimientos y corrige el recibo en todos lados">🔧 Reparar</button>' +
        '<button class="rfc-btn-accion" data-idx="' + idx + '" data-accion="eliminar-recibo" style="display:inline-flex;align-items:center;gap:5px;background:rgba(192,22,26,0.08);border:1px solid rgba(192,22,26,0.45);border-radius:6px;padding:4px 10px;margin-left:6px;font-family:monospace;font-size:0.6rem;font-weight:700;color:#c0161a;cursor:pointer;" title="Elimina el recibo y todos sus registros (contabilidad, R2, Supabase, local) de forma permanente">🗑 Eliminar</button>' +
      '</div>' +
      (accionHtml ? '<div>' + accionHtml + '</div>' : '') +
      '<div id="rfc-prog-' + idx + '" style="margin-top:4px;font-size:0.58rem;font-family:monospace;color:#7a6840;min-height:14px;"></div>' +
      '</div>';
  }).join('');

  var tieneAcciones = plan.some(function(p){
    return p.tipo === 'crear' || (p.tipo === 'sobra' && p.planElim) || p.tipo === 'corregir-meta'
        || (p.tipo === 'falta' && p._causa && p._causa.fixFaltante && p._causa.montoFalt > 0);
  });

  // ── SUPER RFC: impacto en $ de aplicar (Caja nunca se toca) ──
  var _impCre=0, _impEli=0;
  plan.forEach(function(p){
    if (p.tipo==='crear' && p.campos) _impCre += _rfcMonto(p.campos);
    else if (p.tipo==='falta' && p._causa && p._causa.fixFaltante) _impCre += (p._causa.montoFalt||0);
    else if (p.tipo==='sobra' && p.planElim) {
      _impEli += (p.movsLv||[]).filter(function(m){ return p.planElim.ids.indexOf(m.id)>=0; })
                   .reduce(function(s,m){ return s+(parseFloat(m.monto)||0); }, 0);
    }
  });
  var _impNeto = _impCre - _impEli;
  var impactoHtml = tieneAcciones
    ? '<div style="margin-top:12px;padding:10px 14px;border-radius:8px;background:#f5f1e8;border:1px solid #e8c875;font-size:0.62rem;color:#5a4010;font-family:monospace;line-height:1.6;">'+
        '\ud83d\udcca Impacto al aplicar: Contabilidad <b>' + (_impNeto>=0?'+':'\u2212') + _rfcFmt(Math.abs(_impNeto)) + '</b>'+
        ' (crea ' + _rfcFmt(_impCre) + ', elimina ' + _rfcFmt(_impEli) + '). <b style="color:#1a7a3a;">Caja no se toca.</b> Se guarda respaldo \u2014 reversible.</div>'
    : '';

  // ── SUPER RFC: avisos a nivel folio (hueco de versión / cadena de saldo) ──
  var _avisos = (window._rfcPlanActual && window._rfcPlanActual.avisos) || [];
  var avisosHtml = _avisos.length
    ? '<div style="padding:9px 14px;border-radius:8px;background:#fff3e0;border:1px solid #f0c878;font-size:0.62rem;color:#a0560a;line-height:1.6;margin-bottom:12px;">'+
        _avisos.map(function(a){ return a; }).join('<br>') + '</div>'
    : '';

  // ── SUPER RFC: recibo único mal etiquetado (debería ser folio A) ──────────
  var _soloLetraSolitaria = (window._rfcPlanActual && window._rfcPlanActual.soloLetraSolitaria) || null;
  var soloLetraHtml = _soloLetraSolitaria
    ? '<div style="padding:10px 14px;border-radius:8px;background:#fff3e0;border:1.5px solid #d4a020;margin-bottom:12px;">' +
        '<button id="rfc-btn-corregir-letra-solitaria" style="width:100%;padding:9px;border-radius:6px;border:none;background:#a0560a;color:#fff;font-family:monospace;font-size:0.68rem;font-weight:700;cursor:pointer;">🔧 Corregir a Folio A</button>' +
      '</div>'
    : '';

  // ── SUPER RFC: historial reciente (clic para reanalizar, sigue siendo 1×1) ──
  var _hist = (window._rfcHistorial||[]).filter(function(f){ return String(f)!==String(folio); });
  var chipsHtml = _hist.length
    ? '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:12px;">'+
        '<span style="font-size:0.58rem;color:#7a6840;font-family:monospace;">Recientes:</span>'+
        _hist.map(function(f){ return '<button class="rfc-chip-hist" data-folio="'+f+'" style="background:rgba(200,149,42,0.12);border:1px solid rgba(200,149,42,0.4);border-radius:14px;padding:3px 11px;font-family:monospace;font-size:0.6rem;font-weight:700;color:#8c6518;cursor:pointer;">#'+f+'</button>'; }).join('')+
      '</div>'
    : '';

  // Nombre del cliente: directo de appData.recibos usando clientes[0].nombre
  var clienteNom = '';
  if (typeof appData !== 'undefined' && Array.isArray(appData.recibos)) {
    var _recs = appData.recibos.filter(function(r){ return r && Number(r.folio) === Number(folio); });
    for (var ri = 0; ri < _recs.length; ri++) {
      var _r = _recs[ri];
      // Intentar clientes[0].nombre primero
      if (Array.isArray(_r.clientes) && _r.clientes.length && (_r.clientes[0].nombre||'').trim().length > 2) {
        clienteNom = _r.clientes[0].nombre.trim(); break;
      }
    }
  }

  // Colores del resultado siguiendo la tematica del sistema
  // Verde: todo correcto | Amarillo/dorado: hay diferencias | Rojo: errores graves
  var _tieneErrores = plan.some(function(p){ return p.tipo === 'error'; });
  var resColor, resBg, resBr, resTxt;
  // FIX (caso real: folio 76): "totalProblemas" solo cuenta discrepancias entre
  // las versiones que S\u00cd tienen PDF en R2 y Contabilidad \u2014 no se enteraba de
  // los avisos a nivel de folio (huecos de versi\u00f3n, cadena de saldo rota,
  // _avisos m\u00e1s arriba), as\u00ed que pod\u00eda decir "\u2705 Todas las versiones coinciden"
  // al mismo tiempo que el aviso naranja de arriba dec\u00eda que falta una versi\u00f3n
  // completa. Ahora ambos mensajes se contradicen \u2014 se enteran uno del otro.
  if (totalProblemas === 0 && _avisos.length === 0) {
    resColor = '#1a7a3a'; resBg = '#eef8f0'; resBr = '#b8e0c0';
    resTxt = '\u2705 Todas las versiones coinciden con sus PDFs en R2';
  } else if (_tieneErrores) {
    resColor = '#c0161a'; resBg = '#fdeeee'; resBr = '#f0b8b8';
    resTxt = totalProblemas + ' versi\u00f3n(es) con error al leer PDF';
  } else if (totalProblemas > 0) {
    resColor = '#8c6518'; resBg = '#fff8ec'; resBr = '#e8c875';
    resTxt = '\u26a0\ufe0f ' + totalProblemas + ' versi\u00f3n(es) con diferencias';
  } else {
    resColor = '#8c6518'; resBg = '#fff8ec'; resBr = '#e8c875';
    resTxt = '\u26a0\ufe0f Revisa el aviso de arriba \u2014 hay ' + _avisos.length + ' aviso(s) a nivel de folio';
  }

  var btnApli = tieneAcciones
    ? '<div style="margin-top:14px;display:flex;gap:10px;">' +
        '<button id="rfc-btn-aplicar-todo" style="flex:1;padding:11px;border-radius:8px;border:none;background:#c8952a;color:#1a1008;font-family:monospace;font-size:0.75rem;font-weight:700;cursor:pointer;">\u26a1 Aplicar todas las correcciones</button>' +
        '<button id="rfc-btn-cancelar" style="padding:11px 18px;border-radius:8px;border:1.5px solid rgba(200,149,42,0.4);background:transparent;color:var(--gold-l);font-family:monospace;font-size:0.72rem;cursor:pointer;">Cancelar</button>' +
      '</div>'
    : '';

  // Banner cliente: mismo estilo que la casilla de resultado pero verde, con nombre del cliente
  var bannerCliente = clienteNom
    ? '<div style="padding:10px 14px;border-radius:8px;background:#eef8f0;border:1px solid #b8e0c0;font-size:0.72rem;font-weight:700;color:#1a7a3a;margin-bottom:12px;">' +
        'Folio #' + folio + ' &nbsp;&middot;&nbsp; ' + clienteNom +
      '</div>'
    : '';

  resEl.innerHTML =
    bannerCliente +
    chipsHtml +
    avisosHtml +
    soloLetraHtml +
    '<div style="padding:10px 14px;border-radius:8px;background:' + resBg + ';border:1px solid ' + resBr + ';font-size:0.72rem;font-weight:700;color:' + resColor + ';margin-bottom:12px;">' + resTxt + '</div>' +
    filas + impactoHtml + btnApli +
    '<div id="rfc-apply-log" style="margin-top:10px;font-family:monospace;font-size:0.62rem;color:#7a6840;"></div>' +
    '<div id="rfc-dupcontab-zona"></div>';
  var _btnCorregirSolitaria = document.getElementById('rfc-btn-corregir-letra-solitaria');
  if (_btnCorregirSolitaria) {
    _btnCorregirSolitaria.onclick = function(){ _rfcCorregirLetraSolitaria(folio); };
  }

  // Bindear chips de historial (reanalizar el folio elegido, 1×1)
  resEl.querySelectorAll('.rfc-chip-hist').forEach(function(ch){
    ch.onclick = function(){
      var inp = document.getElementById('rfc-folio-input');
      if (inp) inp.value = ch.getAttribute('data-folio');
      if (typeof window.adminRestaurarFlujoAnalizar === 'function') window.adminRestaurarFlujoAnalizar();
    };
  });

  // Bindear botones
  resEl.querySelectorAll('.rfc-btn-accion').forEach(function(btn) {
    btn.onclick = function() { _rfcAplicarUno(Number(btn.getAttribute('data-idx')), btn.getAttribute('data-accion')); };
  });
  // Bindear botones Ver PDF
  resEl.querySelectorAll('.rfc-btn-ver-pdf').forEach(function(btn) {
    btn.onclick = function() {
      var f = btn.getAttribute('data-folio');
      var lv = btn.getAttribute('data-letra');
      _rfcAbrirVisorPDF(f, lv, btn);
    };
  });
  var btnAplicar = document.getElementById('rfc-btn-aplicar-todo');
  if (btnAplicar) btnAplicar.onclick = function() { adminRestaurarFlujoAplicarTodo(); };
  var btnCancelar = document.getElementById('rfc-btn-cancelar');
  if (btnCancelar) btnCancelar.onclick = function() { resEl.innerHTML = ''; };

  if (progEl) { progEl.innerHTML = ''; progEl.style.display = 'none'; }

  // Renderizar duplicados en contabilidad para este folio
  _rfcRenderDupContab(folio, document.getElementById('rfc-dupcontab-zona'));
}


// Seccion de duplicados en Contabilidad dentro de Restaurar Flujo Contable.
// Misma logica que adminLimpiarDupContab pero filtrada por folio especifico.
function _rfcRenderDupContab(folioNum, zona) {
  if (!zona) return;
  var folioN = Number(folioNum);
  var movimientos = (typeof D !== 'undefined' && Array.isArray(D.movimientos)) ? D.movimientos : [];

  // Agrupar por folio+letra — igual que adminLimpiarDupContab
  var grupos = {};
  movimientos.forEach(function(m, idx) {
    if (!m || m.borrado || m.fuente !== 'recibo') return;
    if (Number(m.folio) !== folioN) return;
    var letraEf = (m.letra || 'A').toUpperCase();
    var clave = folioN + '|' + letraEf;
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push({ idx: idx, mov: m });
  });

  var gruposDup = Object.keys(grupos).filter(function(k) { return grupos[k].length > 1; });

  if (gruposDup.length === 0) { zona.innerHTML = ''; return; }

  // Construir HTML con mismo estilo que el modal de duplicados
  var html = '<div style="margin-top:18px;border-top:1.5px solid rgba(160,80,220,0.25);padding-top:14px;">'
    + '<div style="font-family:monospace;font-size:0.7rem;font-weight:700;color:#9a4aff;margin-bottom:10px;">'
    + '\uD83D\uDCC2 Duplicados en Contabilidad para este folio (' + gruposDup.length + ' grupo(s))</div>';

  gruposDup.forEach(function(clave, gi) {
    var grupo  = grupos[clave];
    var m0     = grupo[0].mov;
    var letra  = (m0.letra || 'A').toUpperCase();
    var montos  = grupo.map(function(g) { return parseFloat(g.mov.monto) || 0; });
    var estatus = grupo.map(function(g) { return g.mov.estatus || g.mov.cat || ''; });
    var exacto  = montos.every(function(v) { return v === montos[0]; }) && estatus.every(function(v) { return v === estatus[0]; });
    var badge = exacto
      ? '<span style="font-size:0.5rem;padding:2px 7px;border-radius:4px;background:#7a1adf;color:#fff;font-weight:700;margin-left:6px;">EXACTO</span>'
      : '<span style="font-size:0.5rem;padding:2px 7px;border-radius:4px;background:#b04a00;color:#fff;font-weight:700;margin-left:6px;">MISMO FOLIO \u00b7 DIFERENTE ESTADO</span>';

    html += '<div style="border:1px solid rgba(160,80,220,0.25);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:rgba(100,30,160,0.04);">';
    html += '<div style="font-family:monospace;font-size:0.65rem;font-weight:700;color:#9a4aff;margin-bottom:8px;display:flex;align-items:center;flex-wrap:wrap;gap:4px;">'
      + '\uD83D\uDCCB Folio #' + folioN + letra + ' \u00b7 ' + grupo.length + ' entradas' + badge + '</div>';

    grupo.forEach(function(g, oi) {
      var m      = g.mov;
      var rid    = 'rfcdup-' + gi + '-' + oi;
      var mFila  = parseFloat(m.monto) || 0;
      var mColor = m.tipo === 'egreso' ? '#c0161a' : '#1a7a3a';
      var mStr   = (m.tipo === 'egreso' ? '-' : '+') + '$' + Number(mFila||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
      var eFila  = m.estatus || m.cat || '-';
      var desc   = (m.descripcion || '-').substring(0, 60) + ((m.descripcion || '').length > 60 ? '...' : '');

      html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid rgba(160,80,220,0.18);border-radius:6px;margin-bottom:5px;background:' + (oi === 0 ? 'rgba(100,30,160,0.07)' : 'transparent') + ';">';
      html += '<input type="radio" id="' + rid + '" name="rfcdup-g-' + gi + '" value="' + g.idx + '"' + (oi === 0 ? ' checked' : '') + ' style="margin-top:3px;accent-color:#9a4aff;">';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-family:monospace;font-size:0.62rem;font-weight:700;color:#5a1a9a;">' + (oi === 0 ? '\u2B50 ' : '') + 'ID: ' + (m.id || 'sin-id') + '</div>';
      html += '<div style="font-size:0.62rem;color:#5a4070;margin-top:2px;">'
        + '\u{1F550} ' + (m.hora || '-') + ' hrs \u00b7 \u{1F464} ' + (m.nombre || '-') + ' \u00b7 ' + desc + '</div>';
      html += '<div style="font-size:0.6rem;margin-top:3px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">';
      html += '<span style="font-family:monospace;font-weight:700;color:' + mColor + ';">' + mStr + '</span>';
      html += '<span style="background:rgba(90,26,154,0.12);border:1px solid rgba(90,26,154,0.3);border-radius:4px;padding:1px 6px;color:#5a1a9a;font-size:0.58rem;font-weight:600;">' + eFila + '</span>';
      html += '</div></div>';
      html += '<div style="display:flex;flex-direction:column;gap:4px;">';
      html += '<button data-folio="' + folioN + '" data-letra="' + letra + '" class="rfc-dup-ver-pdf" style="padding:4px 8px;border-radius:5px;border:1px solid rgba(26,74,138,0.4);background:rgba(26,74,138,0.08);color:#1a4a8a;font-family:monospace;font-size:0.56rem;font-weight:700;cursor:pointer;white-space:nowrap;">\u{1F441} Ver PDF</button>';
      html += '<button data-movid="' + (m.id || '') + '" data-folio="' + folioN + '" class="rfc-dup-eliminar" style="padding:4px 8px;border-radius:5px;border:1px solid rgba(192,22,26,0.4);background:rgba(192,22,26,0.07);color:#c0161a;font-family:monospace;font-size:0.56rem;font-weight:700;cursor:pointer;white-space:nowrap;">\u{1F5D1} Eliminar</button>';
      html += '</div></div>';
    });

    html += '<div style="margin-top:6px;text-align:right;">';
    html += '<button data-gi="' + gi + '" class="rfc-dup-conservar" style="padding:5px 14px;border-radius:6px;border:none;background:#7a1adf;color:#fff;font-family:monospace;font-size:0.62rem;font-weight:700;cursor:pointer;">\u26A1 Conservar seleccionado \u2014 eliminar resto</button>';
    html += '</div></div>';
  });

  html += '</div>';
  zona.innerHTML = html;

  // Bindear Ver PDF
  zona.querySelectorAll('.rfc-dup-ver-pdf').forEach(function(btn) {
    btn.onclick = function() { _rfcAbrirVisorPDF(btn.getAttribute('data-folio'), btn.getAttribute('data-letra'), btn); };
  });

  // Bindear Eliminar individual con tombstone permanente
  zona.querySelectorAll('.rfc-dup-eliminar').forEach(function(btn) {
    btn.onclick = async function() {
      var idMov = btn.getAttribute('data-movid');
      var movR  = D.movimientos.find(function(m) { return m && m.id === idMov; });
      if (!movR) { alert('Movimiento no encontrado.'); return; }
      var desc  = (movR.descripcion || movR.estatus || '').substring(0, 70);
      var monto = (movR.tipo === 'egreso' ? '-' : '+') + '$' + Number(parseFloat(movR.monto)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
      if (!confirm('Eliminar este movimiento de Contabilidad?\n\n' + desc + '\n' + monto + '\n\nEsta accion NO se puede deshacer.')) return;
      if (typeof reconciliarAplicar !== 'function') { alert('reconciliarAplicar no disponible'); return; }
      var res = await reconciliarAplicar([idMov], { confirmar: true, sinConfirm: true });
      if (res && res.eliminados && res.eliminados.length) {
        if (typeof renderContab === 'function') renderContab();
        if (typeof renderCaja   === 'function') renderCaja();
        _rfcRenderDupContab(folioNum, zona);
      }
    };
  });

  // Bindear Conservar seleccionado
  zona.querySelectorAll('.rfc-dup-conservar').forEach(function(btn) {
    btn.onclick = async function() {
      var gi    = Number(btn.getAttribute('data-gi'));
      var clave = gruposDup[gi];
      var grupo = grupos[clave];
      var radio = zona.querySelector('input[name="rfcdup-g-' + gi + '"]:checked');
      var idxConservar = radio ? parseInt(radio.value) : grupo[0].idx;
      var idsElim = [];
      grupo.forEach(function(g) {
        if (g.idx !== idxConservar) {
          var movR = D.movimientos[g.idx];
          if (movR && movR.id) idsElim.push(movR.id);
        }
      });
      if (!idsElim.length) { alert('Nada que eliminar.'); return; }
      if (!confirm('Eliminar ' + idsElim.length + ' movimiento(s) duplicado(s)?\n\nEsta accion NO se puede deshacer.')) return;
      if (typeof reconciliarAplicar !== 'function') { alert('reconciliarAplicar no disponible'); return; }
      var res = await reconciliarAplicar(idsElim, { confirmar: true, sinConfirm: true });
      if (res && res.eliminados && res.eliminados.length) {
        if (typeof renderContab === 'function') renderContab();
        if (typeof renderCaja   === 'function') renderCaja();
        _rfcRenderDupContab(folioNum, zona);
      }
    };
  });
}

// ── Visor PDF inline para Restaurar Flujo Contable ─────────────────────────
async function _rfcAbrirVisorPDF(folio, letra, btnOrigen) {
  if (!window.SB_DESPACHO_ID) { if(typeof toast==='function') toast('Sin conexion R2', 'err'); return; }
  var nombreArchivo = folio + letra + '.pdf';
  var path = window.SB_DESPACHO_ID + '/recibos/' + nombreArchivo;

  // Mostrar estado cargando en el botón
  var textoOrig = btnOrigen ? btnOrigen.innerHTML : '';
  if (btnOrigen) { btnOrigen.innerHTML = '\u231B Cargando\u2026'; btnOrigen.disabled = true; }

  try {
    var blob = await window.descargarR2(path, 'recibos');
    if (!blob) {
      if (btnOrigen) { btnOrigen.innerHTML = textoOrig; btnOrigen.disabled = false; }
      if (typeof toast === 'function') toast('PDF no encontrado en R2: ' + nombreArchivo, 'err');
      return;
    }
    var blobUrl = URL.createObjectURL(blob);

    // ── Ventana flotante a pantalla completa con X para cerrar ──────────────
    var prev = document.getElementById('rfc-pdf-modal');
    if (prev) { try{ URL.revokeObjectURL(prev.dataset.bloburl); }catch(_e){} prev.remove(); }
    var modal = document.createElement('div');
    modal.id = 'rfc-pdf-modal';
    modal.dataset.bloburl = blobUrl;
    modal.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(20,12,6,0.82);display:flex;flex-direction:column;padding:22px;box-sizing:border-box;';
    var _cerrarModal = function(){ try{ URL.revokeObjectURL(blobUrl); }catch(_e){} modal.remove(); document.removeEventListener('keydown', _onEscModal); };
    var _onEscModal = function(ev){ if(ev.key==='Escape') _cerrarModal(); };
    document.addEventListener('keydown', _onEscModal);
    // Barra superior con nombre y botón X
    var barra = document.createElement('div');
    barra.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;background:#1a1008;color:#e8d9b0;padding:10px 16px;border-radius:10px 10px 0 0;font-family:monospace;';
    barra.innerHTML = '<span style="font-size:0.8rem;font-weight:700;">📄 ' + folio + letra + '.pdf</span>';
    var xbtn = document.createElement('button');
    xbtn.innerHTML = '\\u2715 Cerrar';
    xbtn.style.cssText = 'background:#993c1d;color:#fff;border:none;border-radius:6px;padding:7px 16px;font-family:monospace;font-size:0.75rem;font-weight:700;cursor:pointer;letter-spacing:0.05em;';
    xbtn.onmouseover = function(){ this.style.background = '#b8492a'; };
    xbtn.onmouseout  = function(){ this.style.background = '#993c1d'; };
    xbtn.onclick = _cerrarModal;
    barra.appendChild(xbtn);
    // Visor PDF
    var iframe = document.createElement('iframe');
    iframe.src = blobUrl + '#toolbar=1&navpanes=0';
    iframe.style.cssText = 'flex:1;width:100%;border:none;border-radius:0 0 10px 10px;background:#fff;';
    iframe.title = 'PDF ' + folio + letra;
    modal.appendChild(barra);
    modal.appendChild(iframe);
    // Clic en el fondo (fuera del visor) también cierra
    modal.addEventListener('click', function(ev){ if(ev.target === modal) _cerrarModal(); });
    document.body.appendChild(modal);
  } catch(e) {
    if (typeof toast === 'function') toast('Error al cargar PDF: ' + e.message, 'err');
    console.error('[rfcVisorPDF]', e);
  }

  if (btnOrigen) { btnOrigen.innerHTML = textoOrig; btnOrigen.disabled = false; }
}

// ── Corregir un recibo único mal etiquetado (debería ser folio A) ──────────
// Caso real: folio 76 — un solo recibo existía, etiquetado como letra B (sin
// que exista ninguna letra A real). Relabela el registro a A, regenera su PDF
// con el nombre correcto, borra el PDF viejo mal nombrado y actualiza el
// movimiento de Contabilidad correspondiente. Si el nombre del cliente venía
// vacío en el recibo, intenta recuperarlo desde Contabilidad.
async function _rfcCorregirLetraSolitaria(folioRaw) {
  var planData = window._rfcPlanActual;
  var letraDetectadaR2 = (planData && planData.soloLetraSolitaria) || null;
  var folioNum = Number(String(folioRaw).replace(/[^0-9]/g, ''));
  if (!folioNum) { if (typeof toast === 'function') toast('Folio inválido', 'err'); return; }

  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var candidatos = recibos.filter(function(r){ return r && Number(r.folio) === folioNum && !r.esComplemento; });
  if (candidatos.length !== 1) {
    if (typeof toast === 'function') toast('Se esperaba un único recibo para el folio #' + folioNum + ', se encontraron ' + candidatos.length + '. No se aplica la corrección automática — revisa manualmente.', 'err');
    return;
  }
  var r = candidatos[0];
  var letraVieja = r.letra || (typeof letraVersion === 'function' ? letraVersion(r) : 'A') || 'A';
  var nombreActual = (r.clientes && r.clientes[0] && r.clientes[0].nombre) || r.nombre || '';

  var confirmado = confirm(
    'Corregir folio #' + folioNum + ':\n\n' +
    '- Actualmente etiquetado como letra "' + letraVieja + '" (PDF en R2 detectado como "' + (letraDetectadaR2 || letraVieja) + '").\n' +
    '- Cliente: ' + (nombreActual || '(sin nombre registrado — se intentará recuperar de otros registros del folio y de Contabilidad)') + '\n\n' +
    'Se relabelará como el folio A original, se regenerará su PDF con el nombre correcto y se actualizará Contabilidad. ¿Continuar?'
  );
  if (!confirmado) return;

  var btn = document.getElementById('rfc-btn-corregir-letra-solitaria');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Corrigiendo…'; }

  try {
    // Recuperar nombre del cliente si el recibo lo trae vacío — se intenta en
    // este orden: (1) otros registros del mismo folio en memoria (lo mismo que
    // agrega la Ficha del Folio: complementos, versiones adicionales, etc.),
    // (2) Contabilidad (movimientos ya registrados con el nombre del cliente).
    if (!nombreActual) {
      var _otrosDelFolio = recibos.filter(function(x){
        return x && x !== r && (Number(x.folio) === folioNum || Number(x.folioRef) === folioNum);
      });
      for (var _oi = 0; _oi < _otrosDelFolio.length && !nombreActual; _oi++) {
        var _ox = _otrosDelFolio[_oi];
        if (Array.isArray(_ox.clientes) && _ox.clientes.length && (_ox.clientes[0].nombre || '').trim().length > 2) {
          nombreActual = _ox.clientes[0].nombre.trim();
        } else if ((_ox.nombre || '').trim().length > 2) {
          nombreActual = _ox.nombre.trim();
        }
      }
      if (nombreActual) {
        if (!r.clientes || !r.clientes[0]) r.clientes = [{}];
        r.clientes[0].nombre = nombreActual;
        r.nombre = nombreActual;
        r.nombre_cliente_firma = nombreActual;
      }
    }
    if (!nombreActual && typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
      var movMatch = D.movimientos.find(function(m){ return m && !m.borrado && String(m.folio) === String(folioNum) && (m.nombre || '').trim().length > 2; });
      if (movMatch) {
        nombreActual = movMatch.nombre.trim();
        if (!r.clientes || !r.clientes[0]) r.clientes = [{}];
        r.clientes[0].nombre = nombreActual;
        r.nombre = nombreActual;
        r.nombre_cliente_firma = nombreActual;
      }
    }

    var nombreArchivoViejo = r.archivo || (folioConLetra(folioNum, r.anio_folio, letraDetectadaR2 || letraVieja) + '.pdf');
    r.letra = 'A';
    // Es el original — no arrastra historial de reimpresiones con la letra incorrecta.
    r.fechasImpresion = [];
    r.pdfBase64 = null;
    var nombreArchivoNuevo = folioConLetra(folioNum, r.anio_folio, 'A') + '.pdf';

    var _qrTxt = 'LEX-MEXICO|Folio:' + folioFormato(folioNum, r.anio_folio) + '|' + (r.nombre || '') + '|' + (r.fecha_recibo || r.fecha || '') + ' ' + (r.hora_recibo || r.hora || '');
    var _qrURL = typeof qrToDataURL === 'function' ? await qrToDataURL(_qrTxt) : null;
    var _blob = null;
    if (typeof generarPDF === 'function') {
      var _datos = {
        folio: r.folio, clientes: r.clientes || [{ nombre: r.nombre || '' }],
        conceptos: r.conceptos || [], tipoTramite: r.tipoTramite || 'normal',
        fecha_recibo: r.fecha_recibo || r.fecha, hora_recibo: r.hora_recibo || r.hora,
        anticipo: r.anticipo || '0', responsable: r.responsable || '',
        nombre_cliente_firma: r.nombre_cliente_firma || r.nombre || '',
        tramites: r.tramites || '', clase: r.clase || '', marca: r.marca || '', tipo_veh: r.tipo_veh || '',
        serie: r.serie || '', motor: r.motor || '', personas_veh: r.personas_veh || '', anio: r.anio || '', puertas: r.puertas || '',
        color_veh: r.color_veh || '', transmision: r.transmision || '',
        cilindros: r.cilindros || '', placa: r.placa || '', placaEstado: r.placaEstado || '',
        ultima_tenencia: r.ultima_tenencia || '', origen: r.origen || '', combustible: r.combustible || '',
        copias: r.copias || [], tipo_doc: r.tipo_doc || 'copia', costosExtra: r.costosExtra || [],
        pagosParciales: r.pagosParciales || [], fechasImpresion: [],
        totalGeneral: r.total || 0, totalAbonado: r.totalAbonado || r.anticipo || 0,
        saldoNuevo: r.saldoPendiente || 0, saldoPendiente: r.saldoPendiente || 0,
        letra: 'A', anio_folio: r.anio_folio
      };
      var _doc = await generarPDF(_datos, r.folio, _qrURL);
      if (_doc && typeof _doc.output === 'function') _blob = _doc.output('blob');
    }
    if (_blob) {
      r.archivo = nombreArchivoNuevo;
      r.archivoR2 = nombreArchivoNuevo;
      var _rd = new FileReader();
      _rd.onload = function(){ r.pdfBase64 = _rd.result; };
      _rd.readAsDataURL(_blob);
      if (typeof subirPDFaDrive === 'function') await subirPDFaDrive(_blob, nombreArchivoNuevo);
      if (window.subirR2 && window.SB_DESPACHO_ID) {
        try { await window.subirR2(window.SB_DESPACHO_ID + '/recibos/' + nombreArchivoNuevo, _blob, 'application/pdf', 'lex-recibos-pdf'); }
        catch (eR2) { console.warn('[CorregirLetraSolitaria] R2:', eR2); }
      }
    }
    // Borrar el archivo viejo mal nombrado, si es distinto del nuevo
    if (nombreArchivoViejo && nombreArchivoViejo !== nombreArchivoNuevo && typeof borrarPDFdeDrive === 'function') {
      await borrarPDFdeDrive(nombreArchivoViejo);
    }

    // Actualizar el/los movimiento(s) de Contabilidad que traían la letra vieja
    if (typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
      D.movimientos.forEach(function(m){
        if (m && !m.borrado && String(m.folio) === String(folioNum) && (m.letra || 'A') === letraVieja) {
          m.letra = 'A';
          if (typeof m.cat === 'string') m.cat = m.cat.replace(new RegExp('#' + folioNum + letraVieja + '\\b'), '#' + folioNum + 'A');
        }
      });
    }

    if (typeof appData !== 'undefined') appData.recibos = recibos;
    if (typeof REC !== 'undefined') REC.recibos = recibos;
    await actualizarArchivoControl();
    if (typeof renderRec === 'function') renderRec();
    if (typeof renderHistorial === 'function') renderHistorial();
    if (typeof renderContab === 'function') renderContab();
    if (typeof save === 'function') save();
    if (typeof syncEstadoSupabaseDebounced === 'function') setTimeout(syncEstadoSupabaseDebounced, 200);

    if (typeof toast === 'function') toast('✅ Folio #' + folioNum + ' corregido a letra A' + (nombreActual ? ' · ' + nombreActual : '') + '.');

    // Re-analizar para reflejar el estado ya corregido
    var inp = document.getElementById('rfc-folio-input');
    if (inp) inp.value = String(folioNum);
    if (typeof window.adminRestaurarFlujoAnalizar === 'function') setTimeout(window.adminRestaurarFlujoAnalizar, 600);

  } catch (e) {
    console.error('[CorregirLetraSolitaria]', e);
    if (typeof toast === 'function') toast('❌ Error al corregir: ' + e.message, 'err');
    if (btn) { btn.disabled = false; btn.textContent = '🔧 Corregir a Folio A'; }
  }
}

// ── Aplicar una corrección individual ──────────────────────────────────────
async function _rfcAplicarUno(idx, accion) {
  var planData = window._rfcPlanActual;
  if (!planData) return;
  var p     = planData.plan[idx];
  var folio = planData.folio;
  if (!p) return;

  var btn    = document.querySelector('.rfc-btn-accion[data-idx="' + idx + '"][data-accion="' + accion + '"]');
  var progEl = document.getElementById('rfc-prog-' + idx);
  var filaEl = document.getElementById('rfc-fila-' + idx);
  if (btn) { btn.disabled = true; btn.textContent = '\u23f3 Procesando\u2026'; }

  try {
    if (accion === 'crear') {
      var movNuevo = _rfcConstruirMov(folio, p.letra, p.campos);
      if (!movNuevo || movNuevo.monto <= 0) throw new Error('No se pudo construir el movimiento');
      if (typeof _registrarMovimiento !== 'function') throw new Error('_registrarMovimiento no disponible');
      var ok = _registrarMovimiento(movNuevo);
      if (!ok) throw new Error('Movimiento ya existe o fue rechazado por deduplicaci\u00f3n');
      if (typeof save === 'function') save();
      if (typeof renderContab === 'function') renderContab();
      if (filaEl) { filaEl.style.background = '#eef8f0'; filaEl.querySelector('div').textContent = '\u2705 ' + folio + p.letra + ' \u2014 Movimiento creado'; }
      if (progEl) progEl.textContent = '\u2705 ID: ' + movNuevo.id + ' \u00b7 $' + Number(movNuevo.monto||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
      if (btn) btn.remove();

    } else if (accion === 'eliminar') {
      if (!p.planElim || !p.planElim.ids.length) throw new Error('Sin IDs para eliminar');
      if (typeof reconciliarAplicar !== 'function') throw new Error('reconciliarAplicar no disponible');
      if (progEl) progEl.textContent = 'Eliminando ' + p.planElim.ids.length + ' movimiento(s)\u2026';
      await reconciliarAplicar(p.planElim.ids, { confirmar: true });
      if (filaEl) { filaEl.style.background = '#eef8f0'; filaEl.querySelector('div').textContent = '\u2705 ' + folio + p.letra + ' \u2014 Cuadrado en $' + Number(p.montoPdf||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); }
    // Refrescar SCANSYS PRO al corregir un folio individual
    setTimeout(function(){ if(typeof window._scRefrescar==='function') window._scRefrescar(); }, 800);
      if (progEl) progEl.textContent = '\u2705 Sincronizado con Supabase.';
      if (btn) btn.remove();

    } else if (accion === 'corregir-meta') {
      var mov = p.movsLv && p.movsLv[0];
      if (!mov) throw new Error('No se encontr\u00f3 el movimiento');
      if (p.campos.fecha)  mov.fecha  = p.campos.fecha;
      if (p.campos.hora)   mov.hora   = p.campos.hora;
      if (p.campos.nombre) mov.nombre = p.campos.nombre;
      if (typeof save === 'function') save();
      if (typeof renderContab === 'function') renderContab();
      if (filaEl) { filaEl.style.background = '#eef8f0'; filaEl.querySelector('div').textContent = '\u2705 ' + folio + p.letra + ' \u2014 Metadata corregida'; }
      if (progEl) progEl.textContent = '\u2705 Guardado.';
      if (btn) btn.remove();

    } else if (accion === 'crear-faltante') {
      var falt = (p._causa && p._causa.montoFalt) ? p._causa.montoFalt : Math.abs(p.dif || 0);
      if (!(falt > 0)) throw new Error('Sin monto faltante por registrar');
      var movF = _rfcConstruirMov(folio, p.letra, p.campos);
      if (!movF) throw new Error('No se pudo construir el movimiento');
      movF.monto       = +Number(falt).toFixed(2);
      movF.id          = 'M-REST-FALT-' + folio + '-' + p.letra + '-' + Date.now();
      movF.descripcion = (movF.descripcion || '').replace('[RESTAURADO-R2]', '[RESTAURADO-R2 \u00b7 FALTANTE]');
      movF.cat         = (movF.cat || '') + ' \u00b7 faltante';
      if (typeof _registrarMovimiento !== 'function') throw new Error('_registrarMovimiento no disponible');
      if (!_registrarMovimiento(movF)) throw new Error('Movimiento ya existe o rechazado por deduplicaci\u00f3n');
      if (typeof save === 'function') save();
      if (typeof renderContab === 'function') renderContab();
      if (typeof _lexPush === 'function') _lexPush('info', 'admin.rfc.faltante', 'Faltante registrado ' + folio + p.letra + ' por $' + Number(falt).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}), null, { id: movF.id });
      if (filaEl) { filaEl.style.background = '#eef8f0'; filaEl.querySelector('div').textContent = '\u2705 ' + folio + p.letra + ' \u2014 Faltante registrado'; }
      if (progEl) progEl.textContent = '\u2705 ID: ' + movF.id + ' \u00b7 $' + Number(movF.monto||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
      if (btn) btn.remove();

    } else if (accion === 'reparar') {
      var cR = p.campos || {};
      var folioR = Number(folio);
      var _sumAbR = function(){
        return (typeof D !== 'undefined' && Array.isArray(D.movimientos))
          ? D.movimientos.filter(function(m){ return m && !m.borrado && Number(m.folio)===folioR && m.tipo!=='egreso'; }).reduce(function(s,m){ return s+(parseFloat(m.monto)||0); }, 0)
          : 0;
      };
      // 1) Si esta versión no tiene asiento y el PDF respalda un ingreso, crearlo
      var _tieneMovR = (p.movsLv && p.movsLv.length > 0);
      if (!_tieneMovR && (p.montoPdf||0) > 0 && typeof _rfcConstruirMov === 'function' && typeof _registrarMovimiento === 'function') {
        var _movR = _rfcConstruirMov(folio, p.letra, cR);
        if (_movR && _movR.monto > 0) { try { _registrarMovimiento(_movR); } catch(_eR){} }
      }
      // 2) Reparar los campos guardados del recibo desde el PDF (fuente de verdad).
      //    Si el recibo NO está en local, se OMITE esta parte (no hay campos que reparar);
      //    el movimiento contable ya se aseguró arriba.
      var _recR = (appData.recibos||[]).find(function(r){ return r && Number(r.folio)===folioR && (r.letra||'A')===p.letra && !r.esComplemento; });
      var _saldoTxt = '';
      if (_recR) {
        if (cR.nombre) _recR.nombre = cR.nombre;
        if (cR.fecha)  _recR.fecha  = cR.fecha;
        if (cR.hora)   _recR.hora   = cR.hora;
        if (cR.totalTramite != null && cR.totalTramite > 0) _recR.total = cR.totalTramite;
        if (cR.anticipo != null && cR.anticipo > 0) _recR.anticipo = cR.anticipo;
        var _abR  = _sumAbR();
        var _totR = parseFloat(_recR.total)||0;
        _recR.saldoPendiente = Math.max(0, _totR - _abR);
        _recR.totalAbonado   = _abR;
        _saldoTxt = ' (saldo $' + _recR.saldoPendiente.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}) + ')';
      }
      if (typeof save === 'function') save();
      if (typeof renderContab === 'function') renderContab();
      setTimeout(function(){ if(typeof window._scRefrescar==='function') window._scRefrescar(); }, 800);
      var _txtOkR = _recR ? ('Reparado desde el PDF' + _saldoTxt) : ('Contabilidad reparada desde el PDF (no está en local — se omitió)');
      if (filaEl) { filaEl.style.background = '#eef8f0'; var _dR=filaEl.querySelector('div'); if(_dR) _dR.textContent = '✅ ' + folio + p.letra + ' — ' + _txtOkR; }
      if (progEl) progEl.textContent = '✅ ' + _txtOkR + '.';
      if (btn) btn.remove();

    } else if (accion === 'eliminar-recibo') {
      var folioE = Number(folio);
      var letraE = p.letra || 'A';
      var _idxE = (appData.recibos||[]).findIndex(function(r){ return r && Number(r.folio)===folioE && (r.letra||'A')===letraE && !r.esComplemento; });
      if (_idxE >= 0) {
        // ── Está en local → función completa (borra en todos lados, con su confirmación) ──
        if (typeof adminEliminarRecibo !== 'function') throw new Error('adminEliminarRecibo no disponible');
        await adminEliminarRecibo(_idxE);
        var _sigue = (appData.recibos||[]).some(function(r){ return r && Number(r.folio)===folioE && (r.letra||'A')===letraE && !r.esComplemento; });
        if (_sigue) {
          if (btn) { btn.disabled = false; btn.textContent = '🗑 Eliminar'; }
          if (progEl) progEl.textContent = 'Eliminación cancelada.';
          return;
        }
      } else {
        // ── NO está en local → borrar SOLO donde exista (contabilidad, R2, tombstone) y omitir local ──
        if (!confirm('☢️ ELIMINAR ' + folioE + letraE + '\n\nEste recibo NO está en local (solo en R2/contabilidad).\nSe eliminará de:\n• Contabilidad y movimientos\n• PDF en R2 (Cloudflare)\n• Se deja tombstone para que no regrese de Supabase\n\n⚠️ Esta acción NO se puede deshacer.')) {
          if (btn) { btn.disabled = false; btn.textContent = '🗑 Eliminar'; }
          if (progEl) progEl.textContent = 'Eliminación cancelada.';
          return;
        }
        if (typeof _ultimoSyncPropio !== 'undefined') _ultimoSyncPropio = Date.now();
        // Tombstone folio+letra (gana sobre _revivedTs con +10s)
        if (!Array.isArray(appData.folios_eliminados)) appData.folios_eliminados = [];
        if (!appData.folios_eliminados.some(function(t){ return String(t.folio)===String(folioE) && t.letra===letraE; }))
          appData.folios_eliminados.push({ folio: folioE, letra: letraE, ts: Date.now() + 10000 });
        // Avisar por realtime a los demás dispositivos
        try {
          if (typeof _lexRealtimeChannel !== 'undefined' && _lexRealtimeChannel && _lexRealtimeChannel.state === 'joined') {
            _lexRealtimeChannel.send({ type:'broadcast', event:'folio_eliminado', payload:{ folio: folioE, letra: letraE, ts: Date.now()+10000, _adminForce:true } }).catch(function(){});
          }
        } catch(_ebE){}
        // Eliminar movimientos de esa letra + tombstone (si hay)
        var _movsBorrados = 0;
        if (typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
          if (!Array.isArray(D.movimientos_eliminados)) D.movimientos_eliminados = [];
          var _movsDelE = D.movimientos.filter(function(m){ return m && m.fuente==='recibo' && Number(m.folio)===folioE && (m.letra||'A')===letraE; });
          _movsDelE.forEach(function(m){ if(m.id && !D.movimientos_eliminados.some(function(t){return t.id===m.id;})) D.movimientos_eliminados.push({ id:m.id, folio:m.folio, letra:m.letra||'A', monto:m.monto, ts:Date.now() }); });
          _movsBorrados = _movsDelE.length;
          _filtrarMovsAuditado(function(m){ return !(m && m.fuente==='recibo' && Number(m.folio)===folioE && (m.letra||'A')===letraE); },
            '_rfcAplicarUno (corrección desde PDF)', { folio: folioE, letra: letraE });
        }
        // Purgar historial de pagos parciales de esta letra en las demás versiones del folio
        if (typeof _purgarPagosParcialesDeVersion === 'function') _purgarPagosParcialesDeVersion(folioE, letraE);
        // Borrar PDF de R2 (si existe la función y el despacho)
        try {
          if (typeof window.borrarR2 === 'function' && window.SB_DESPACHO_ID) {
            var _pathR2E = window.SB_DESPACHO_ID + '/recibos/' + folioE + letraE + '.pdf';
            await window.borrarR2(_pathR2E, 'recibos').catch(function(){});
          }
        } catch(_erE){}
        if (typeof save === 'function') save();
        if (typeof renderContab === 'function') renderContab();
        if (typeof syncEstadoSupabase === 'function') { try { await syncEstadoSupabase(); } catch(_esE){} }
        if (progEl) progEl.textContent = '✅ Eliminado donde existía (R2 + ' + _movsBorrados + ' movimiento(s) + tombstone). Local omitido.';
      }
      if (filaEl) { filaEl.style.opacity = '0.55'; var _dE=filaEl.querySelector('div'); if(_dE) _dE.textContent = '🗑 ' + folio + p.letra + ' — Eliminado (permanente)'; }
      if (btn) btn.remove();
    }
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '\u274c Error \u2014 reintentar'; }
    if (progEl) { progEl.style.color = '#c0161a'; progEl.textContent = 'Error: ' + (e && e.message ? e.message : String(e)); }
  }
}

// ── Aplicar todo ───────────────────────────────────────────────────────────
window.adminRestaurarFlujoAplicarTodo = async function() {
  var planData = window._rfcPlanActual;
  if (!planData) return;
  var log   = document.getElementById('rfc-apply-log');
  var folio = planData.folio;
  var plan  = planData.plan;
  var aplicados = 0, errores = 0;

  if (log) log.textContent = '\u23f3 Aplicando correcciones\u2026';

  for (var i = 0; i < plan.length; i++) {
    var p = plan[i];
    try {
      if (p.tipo === 'crear' && p.campos && _rfcMonto(p.campos) > 0) {
        var mov = _rfcConstruirMov(folio, p.letra, p.campos);
        if (mov && typeof _registrarMovimiento === 'function' && _registrarMovimiento(mov)) aplicados++;
      } else if ((p.tipo === 'sobra' || p.tipo === 'eliminar') && p.planElim && p.planElim.ids.length) {
        if (typeof reconciliarAplicar === 'function') { await reconciliarAplicar(p.planElim.ids, { confirmar: true }); aplicados++; }
      } else if (p.tipo === 'corregir-meta') {
        var m = p.movsLv && p.movsLv[0];
        if (m && p.campos) { if (p.campos.fecha) m.fecha = p.campos.fecha; if (p.campos.hora) m.hora = p.campos.hora; aplicados++; }
      } else if (p.tipo === 'falta' && p._causa && p._causa.fixFaltante && p._causa.montoFalt > 0) {
        var movF = _rfcConstruirMov(folio, p.letra, p.campos);
        if (movF) {
          movF.monto = +Number(p._causa.montoFalt).toFixed(2);
          movF.id    = 'M-REST-FALT-' + folio + '-' + p.letra + '-' + Date.now();
          movF.descripcion = (movF.descripcion || '').replace('[RESTAURADO-R2]', '[RESTAURADO-R2 \u00b7 FALTANTE]');
          if (typeof _registrarMovimiento === 'function' && _registrarMovimiento(movF)) aplicados++;
        }
      }
    } catch(e) { errores++; }
  }

  if (typeof save === 'function') save();
  if (typeof renderContab === 'function') renderContab();
  // Refrescar SCANSYS PRO para que quite el folio de la lista de problemas
  setTimeout(function(){
    if(typeof window._scRefrescar==='function') window._scRefrescar();
    var sxN = document.getElementById('sxpro-n');
    if(sxN && typeof foliosConProblema==='function') sxN.textContent = foliosConProblema().length + ' folio(s) con problema';
  }, 800);

  var resEl = document.getElementById('rfc-resultado');
  if (resEl) {
    resEl.innerHTML =
      '<div style="text-align:center;padding:32px 20px;background:#eef8f0;border:1.5px solid #b8e0c0;border-radius:12px;">' +
      '<div style="font-size:2rem;margin-bottom:10px;">\u2705</div>' +
      '<div style="font-size:0.85rem;font-weight:700;color:#1a7a3a;margin-bottom:6px;">Restauraci\u00f3n completada</div>' +
      '<div style="font-size:0.68rem;color:#3a6a3a;">' + aplicados + ' correcci\u00f3n(es) aplicada(s)' + (errores ? ' \u00b7 ' + errores + ' con error' : '') + '</div>' +
      '<div style="font-size:0.62rem;color:#7a6840;margin-top:8px;">Contabilidad actualizada. Caja no fue modificada.</div>' +
      '<button id="rfc-btn-reanalizar" style="margin-top:14px;padding:8px 20px;border-radius:7px;border:none;background:#c8952a;color:#1a1008;font-family:monospace;font-size:0.68rem;font-weight:700;cursor:pointer;">\ud83d\udd0d Analizar de nuevo</button>' +
      '</div>';
    var btnRe = document.getElementById('rfc-btn-reanalizar');
    if (btnRe) btnRe.onclick = function() { window.adminRestaurarFlujoAnalizar(); };
  }
};

// ── Auto-restaurar folios con brecha detectada por el sistema ───────────────
// Se llama automáticamente cuando _brechasContables tiene entradas.
// Lee el PDF de R2 de cada folio con brecha y crea el movimiento faltante
// sin pasos intermedios — el PDF es la fuente de verdad.
window.rfcAutoRestaurarBrechas = async function() {
  var brechas = window._brechasContables || [];
  if (!brechas.length) return;

  // Validaciones mínimas
  if (typeof window.obtenerBlobPdfReciboValidado !== 'function') return;
  if (typeof _ocrExtraerTexto !== 'function') return;
  if (typeof D === 'undefined' || !Array.isArray(D.movimientos)) return;
  if (!window.SB_DESPACHO_ID) return;

  // Agrupar brechas por folio único
  var foliosConBrecha = [];
  brechas.forEach(function(b) {
    if (foliosConBrecha.indexOf(String(b.folio)) < 0) {
      foliosConBrecha.push(String(b.folio));
    }
  });

  var totalCreados = 0;
  var errores      = [];

  for (var fi = 0; fi < foliosConBrecha.length; fi++) {
    var folioRaw = foliosConBrecha[fi];
    var folioNum = Number(folioRaw);

    try {
      // Listar PDFs del folio en R2
      var prefix   = window.SB_DESPACHO_ID + '/recibos/';
      var objetos  = await window.listarR2(prefix, 'recibos');
      var reNombre = new RegExp('^' + folioRaw + '([A-Z])(?:_[^/]*)?\\.pdf$', 'i');
      var pdfsEnR2 = objetos.filter(function(o) {
        return reNombre.test((o.key || o.name || '').replace(/^.*\//, ''));
      }).map(function(o) {
        var nombre = (o.key || o.name || '').replace(/^.*\//, '');
        var match  = reNombre.exec(nombre);
        return { key: o.key || o.name, nombre: nombre, letra: match ? match[1].toUpperCase() : '?' };
      });

      // Para cada PDF encontrado, verificar si hay brecha en esa letra
      for (var pi = 0; pi < pdfsEnR2.length; pi++) {
        var pdfInfo = pdfsEnR2[pi];
        var lv      = pdfInfo.letra;

        // ¿Hay brecha para este folio+letra?
        var tieneBrecha = brechas.some(function(b) {
          return String(b.folio) === folioRaw && (b.letra || 'A').toUpperCase() === lv;
        });
        if (!tieneBrecha) continue;

        // ¿Ya existe un movimiento válido en D.movimientos para este folio+letra?
        var yaExiste = (D.movimientos || []).some(function(m) {
          return m && !m.borrado &&
                 m.fuente === 'recibo' &&
                 String(m.folio) === folioRaw &&
                 (m.letra || 'A').toUpperCase() === lv &&
                 (parseFloat(m.monto) || 0) > 0;
        });
        if (yaExiste) continue; // No crear duplicado

        // Descargar y leer PDF con OCR
        var reciboMin = { folio: folioNum, letra: lv, archivoR2: pdfInfo.nombre, archivoR2Raiz: pdfInfo.key, nombre: '' };
        var blob = await window.obtenerBlobPdfReciboValidado(reciboMin);
        if (!blob) { errores.push(folioRaw + lv + ': PDF no descargable'); continue; }

        var ocrRes = await _ocrExtraerTexto(blob, null);
        if (!ocrRes || !ocrRes.texto) { errores.push(folioRaw + lv + ': OCR sin texto'); continue; }

        var campos = _rfcParsearPDF(ocrRes.texto);
        var monto  = _rfcMonto(campos);

        // Validar que el monto del PDF coincide con la brecha detectada
        var brechaLv = brechas.find(function(b) {
          return String(b.folio) === folioRaw && (b.letra || 'A').toUpperCase() === lv;
        });
        // Si el PDF no tiene monto legible, usar el de la brecha como fallback
        if ((!monto || monto <= 0) && brechaLv && brechaLv.monto > 0) {
          monto = brechaLv.monto;
          campos.pagoRecibido = monto;
        }
        if (!monto || monto <= 0) { errores.push(folioRaw + lv + ': monto no identificado'); continue; }

        // Construir y registrar el movimiento
        var mov = _rfcConstruirMov(folioRaw, lv, campos);
        if (!mov) { errores.push(folioRaw + lv + ': no se pudo construir movimiento'); continue; }

        if (typeof _registrarMovimiento === 'function') {
          var ok = _registrarMovimiento(mov);
          if (ok) {
            totalCreados++;
            console.log('[RFC AUTO-RESTAURAR] Movimiento creado: ' + mov.id + ' folio ' + folioRaw + lv + ' $' + monto);
          } else {
            errores.push(folioRaw + lv + ': rechazado por deduplicación (ya existe)');
          }
        }
      }
    } catch(e) {
      errores.push(folioRaw + ': error — ' + (e && e.message ? e.message : String(e)));
    }
  }

  // Limpiar brechas resueltas y persistir
  if (totalCreados > 0) {
    window._brechasContables = [];
    if (typeof save === 'function') save();
    if (typeof renderContab === 'function') renderContab();
    if (typeof toast === 'function') {
      toast('\u2705 ' + totalCreados + ' movimiento(s) restaurado(s) desde PDF en R2', 'ok');
    }
    console.log('[RFC AUTO-RESTAURAR] ' + totalCreados + ' movimiento(s) creado(s) correctamente.');
  }
  if (errores.length) {
    console.warn('[RFC AUTO-RESTAURAR] Errores:', errores);
  }
  return { creados: totalCreados, errores: errores };
};

// ── Hook: conectar con el sistema de brechas ────────────────────────────────
// DESACTIVADO: LEX PROTECCIÓN está apagado manualmente, este hook no corre.
// (función comentada)
