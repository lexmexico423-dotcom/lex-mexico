/* ═══════════════════════════════════════════════════════════════
   LEX-MÉXICO · recibos.js
   Sistema de recibos completo, PDF, dashboard, login email
   Dependencias: utils.js debe cargarse primero
═══════════════════════════════════════════════════════════════ */

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

function setTipoDocRecibo(tipo) {
  recTipoDoc = tipo;
  var btnC = document.getElementById('r-btn-doc-copia');
  var btnE = document.getElementById('r-btn-doc-escaneo');
  if (btnC) btnC.classList.toggle('active', tipo === 'copia');
  if (btnE) btnE.classList.toggle('active', tipo === 'escaneo');
}

function siguienteFolioRecibo() {
  if (pendingNextFolioRecibo) {
    REC.folioActual = pendingNextFolioRecibo;
    pendingNextFolioRecibo = null;
    actualizarFolioDisplayRecibo();
    descongelarRecibo();
    toast('Folio #' + folioFormato(REC.folioActual) + ' listo');
  }
}

function renderClientesRecibo() {
  var c = document.getElementById('clientes-container');
  if (!c) return;
  c.innerHTML = rClientes.map(function(cl,i) {
    return '<div style="border:1px solid var(--border-l);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px;background:var(--surface2);">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
      '<span style="font-family:JetBrains Mono,monospace;font-size:0.6rem;color:var(--muted);">CLIENTE ' + (i+1) + '</span>' +
      (rClientes.length > 1 ? '<button class="btn btn-ghost btn-sm" onclick="eliminarCliente(' + i + ')">✕</button>' : '') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
      '<div class="field" style="margin:0;grid-column:1/-1;"><label>Nombre completo</label>' +
      '<input type="text" value="' + esc(cl.nombre) + '" oninput="rClientes[' + i + '].nombre=this.value;generarQRRecibo()" placeholder="Nombre del cliente" ' + (reciboFrozen?'disabled':'') + '></div>' +
      '<div class="field" style="margin:0;"><label>Teléfono</label>' +
      '<input type="tel" value="' + esc(cl.telefono) + '" oninput="rClientes[' + i + '].telefono=this.value" placeholder="953..." ' + (reciboFrozen?'disabled':'') + '></div>' +
      '<div class="field" style="margin:0;"><label>Dirección</label>' +
      '<input type="text" value="' + esc(cl.direccion) + '" oninput="rClientes[' + i + '].direccion=this.value" placeholder="Domicilio" ' + (reciboFrozen?'disabled':'') + '></div>' +
      '</div></div>';
  }).join('');
}

function eliminarCliente(i) {
  if (reciboFrozen) return;
  rClientes.splice(i,1);
  renderClientesRecibo();
}

function renderConceptosRecibo() {
  var c = document.getElementById('conceptos-container');
  if (!c) return;
  c.innerHTML = rConceptos.map(function(con,i) {
    return '<div style="display:grid;grid-template-columns:3fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;">' +
      '<div class="field" style="margin:0;"><label>Descripción</label>' +
      '<input type="text" value="' + esc(con.descripcion) + '" oninput="rConceptos[' + i + '].descripcion=this.value" placeholder="Servicio..." ' + (reciboFrozen?'disabled':'') + '></div>' +
      '<div class="field" style="margin:0;"><label>Cant.</label>' +
      '<input type="number" value="' + con.cantidad + '" min="1" oninput="rConceptos[' + i + '].cantidad=parseInt(this.value)||1" ' + (reciboFrozen?'disabled':'') + '></div>' +
      '<div class="field" style="margin:0;"><label>Precio</label>' +
      '<input type="text" value="' + esc(con.precio) + '" oninput="rConceptos[' + i + '].precio=this.value;autoCalcTotal()" placeholder="$0.00" ' + (reciboFrozen?'disabled':'') + '></div>' +
      '<button class="btn btn-ghost btn-sm" onclick="eliminarConcepto(' + i + ')" style="margin-bottom:2px;" ' + (reciboFrozen?'disabled':'') + '>✕</button>' +
      '</div>';
  }).join('');
}

function eliminarConcepto(i) {
  if (reciboFrozen) return;
  rConceptos.splice(i,1);
  renderConceptosRecibo();
  autoCalcTotal();
}

function autoCalcTotal() {
  var total = rConceptos.reduce(function(s,c) {
    return s + parsePrecioR(c.precio) * (parseInt(c.cantidad)||1);
  }, 0);
  if (total > 0) {
    var _rt = document.getElementById('r-total');
    if(_rt) { _rt.value = formatPrecioR(total); calcTotalesRecibo(); }
  }
}

function parsePrecioR(v) {
  if (!v) return 0;
  return parseFloat(String(v).replace(/[^0-9.]/g,'')) || 0;
}

function formatPrecioR(n) {
  return '$' + Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
}

function calcTotalesRecibo() {
  var _rt = document.getElementById('r-total');
  var _ra = document.getElementById('r-anticipo');
  var _rs = document.getElementById('r-saldo');
  var total = parsePrecioR(_rt ? _rt.value : '');
  var anticipo = parsePrecioR(_ra ? _ra.value : '');
  var saldo = Math.max(0, total - anticipo);
  if(_rs) _rs.value = formatPrecioR(saldo);
}

function renderDocsRecibo() {
  var c = document.getElementById('docs-container');
  if (!c) return;
  c.innerHTML = DOCS_LIST.map(function(d,i) {
    return '<label style="display:flex;align-items:center;gap:7px;font-size:0.75rem;cursor:pointer;padding:5px 8px;border:1px solid var(--border-l);border-radius:4px;transition:all 0.15s;">' +
      '<input type="checkbox" id="doc-' + i + '" ' + (reciboFrozen?'disabled':'') + '> ' + d + '</label>';
  }).join('');
}

function rec_getDocumentosSeleccionados() {
  return DOCS_LIST.filter(function(d,i) {
    var el = document.getElementById('doc-'+i);
    return el && el.checked;
  });
}

function recToggleVehiculo() {
  var _rv = document.getElementById('r-vehiculo-activo');
  var _vs = document.getElementById('vehiculo-section');
  var activo = _rv ? _rv.checked : false;
  if(_vs) _vs.style.display = activo ? 'block' : 'none';
}

function generarQRRecibo() {
  var folio = REC.folioActual || 1;
  var nombre = (rClientes[0] && rClientes[0].nombre) ? rClientes[0].nombre : 'Cliente';
  var fecha = (document.getElementById('r-fecha') && document.getElementById('r-fecha').value) || hoy();
  var horaVal = (document.getElementById('r-hora') && document.getElementById('r-hora').value) || '00:00';
  var qrText = 'LEX-MEXICO|Folio:' + folioFormato(folio) + '|' + nombre + '|' + fecha + ' ' + horaVal;
  var container = document.getElementById('r-qr-preview');
  if (!container) return;
  container.innerHTML = '';
  try {
    rQRInstance = new QRCode(container, {
      text: qrText, width:150, height:150,
      colorDark:'#1a1008', colorLight:'#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch(e) {
    container.innerHTML = '<div style="font-size:0.6rem;color:var(--muted);padding:10px;">QR no disponible</div>';
  }
}

function getQRDataURL() {
  return new Promise(function(resolve) {
    var canvas = document.querySelector('#r-qr-preview canvas');
    if (canvas) { resolve(canvas.toDataURL('image/png')); return; }
    var img = document.querySelector('#r-qr-preview img');
    if (img) { resolve(img.src); return; }
    resolve(null);
  });
}

function initRecibo() {
  var now = new Date();
  var fEl = document.getElementById('r-fecha');
  var hEl = document.getElementById('r-hora');
  if (fEl) fEl.value = hoy();
  if (hEl) hEl.value = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  actualizarFolioDisplayRecibo();
  if (!rClientes.length) rClientes = [{nombre:'',telefono:'',direccion:''}];
  if (!rConceptos.length) rConceptos = [{descripcion:'',cantidad:1,precio:''}];
  renderClientesRecibo();
  renderConceptosRecibo();
  renderDocsRecibo();
  var selAnio = document.getElementById('v-anio');
  if (selAnio && !selAnio.options.length) {
    for (var y = new Date().getFullYear()+1; y >= 1960; y--) {
      selAnio.add(new Option(y,y));
    }
  }
  renderRecibosRecientes();
  setTimeout(generarQRRecibo, 300);
}

async function guardarReciboInterno() {
  if (!rClientes[0] || !rClientes[0].nombre || !rClientes[0].nombre.trim()) {
    toast('Ingresa el nombre del cliente','err'); return;
  }
  var btn = document.getElementById('btn-imprimir-recibo');
  if (!btn) return; // Sistema REC no activo en este panel
  btn.disabled = true; btn.textContent = '⏳ Generando...';
  var now = new Date();
  var _rfecha = document.getElementById('r-fecha'); if(_rfecha) _rfecha.value = hoy();
  var _rhora = document.getElementById('r-hora'); if(_rhora) _rhora.value = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  var folio = REC.folioActual || 1;
  var total = parsePrecioR((document.getElementById('r-total')||{value:''}).value);
  var anticipo = parsePrecioR((document.getElementById('r-anticipo')||{value:''}).value);
  var saldo = Math.max(0, total - anticipo);
  var _rvehEl = document.getElementById('r-vehiculo-activo');
  var vehiculoActivo = _rvehEl ? _rvehEl.checked : false;
  var _gp = document.getElementById('r-generado-por');
  var _obs = document.getElementById('r-obs');
  var datos = {
    folio: folio,
    fecha: _rfecha ? _rfecha.value : hoy(),
    hora: _rhora ? _rhora.value : '00:00',
    generadoPor: _gp ? _gp.value : '',
    nombre: rClientes.map(function(c){return c.nombre;}).filter(Boolean).join(' / '),
    clientes: structuredClone(rClientes),
    conceptos: structuredClone(rConceptos),
    total: total, anticipo: anticipo, saldo: saldo,
    obs: _obs ? _obs.value : '',
    documentos: rec_getDocumentosSeleccionados(),
    tipodocRecibo: recTipoDoc === 'escaneo' ? 'DOCUMENTOS QUE SE ESCANEARON' : 'DOCUMENTOS EN COPIA SIMPLE',
    vehiculo: vehiculoActivo ? {
      clase: (document.getElementById('v-clase')||{value:''}).value,
      marca: (document.getElementById('v-marca')||{value:''}).value,
      anio: (document.getElementById('v-anio')||{value:''}).value,
      motor: (document.getElementById('v-motor')||{value:''}).value,
      serie: (document.getElementById('v-serie')||{value:''}).value,
      placa: (document.getElementById('v-placa')||{value:''}).value,
      repuve: (document.getElementById('v-repuve')||{value:''}).value,
      tonelaje: (document.getElementById('v-tonelaje')||{value:''}).value,
      color: (document.getElementById('v-color')||{value:''}).value
    } : null,
    saldoPendiente: saldo, cancelado: false, complementos: []
  };
  try {
    await generarQRRecibo();
    await new Promise(function(r){setTimeout(r,500);});
    var qrDataURL = await getQRDataURL();
    var blob = await generarPDFRecibo(datos, folio, qrDataURL);
    lastPdfBlob = blob;
    if (!REC.recibos) REC.recibos = [];
    REC.recibos.unshift(datos);
    // ── Sincronizar con appData.recibos para que Contabilidad lo vea ──
    if(typeof appData!=='undefined'){
      if(!appData.recibos) appData.recibos=[];
      const yaExiste=appData.recibos.findIndex(r=>r.folio===datos.folio);
      if(yaExiste>=0) appData.recibos[yaExiste]=datos;
      else appData.recibos.unshift(datos);
    }
    pendingNextFolioRecibo = folio + 1;
    // Actualizar contador local ANTES de cualquier save(), para que syncEstadoSupabase
    // use el valor correcto y no revierta folio_actual al número ya usado.
    REC.folioActual = folio + 1;
    if(typeof appData!=='undefined') appData.folioActual = folio + 1;
    await guardarFolioEnDrive(folio + 1);
    await subirPDFaD(blob, 'LEX-Recibo-' + folioFormato(folio) + '-' + datos.nombre.replace(/[^a-zA-Z0-9]/g,'_').substring(0,30) + '.pdf');
    save();
    // Refrescar contabilidad con el nuevo recibo
    if(typeof renderContab==='function') renderContab();

    // ── Actualizar Directorio desde recibo nuevo ──────────────────
    // Revisa cada cliente del recibo: si existe por nombre, compara teléfono.
    // Si el tel ya coincide → no hace nada.
    // Si hay tel nuevo → lo agrega al historial con fecha, sin borrar el anterior.
    // Si no existe → crea contacto nuevo.
    (datos.clientes || []).forEach(function(cliente) {
      if (!cliente.nombre) return;
      const telNuevo = (cliente.tel || '').trim();
      if (!telNuevo) return; // ← Sin teléfono: no se agrega ni actualiza
      const nombreNorm = cliente.nombre.trim().toUpperCase();
      // Buscar en directorio por nombre
      const idx = D.directorio.findIndex(function(c) {
        return (c.nombre || '').trim().toUpperCase() === nombreNorm;
      });
      if (idx === -1) {
        // No existe → crear contacto nuevo
        D.directorio.unshift({
          nombre: cliente.nombre.trim(),
          tel: telNuevo,
          telHistorial: telNuevo ? [{ tel: telNuevo, desde: hoy() }] : [],
          tipo: 'Cliente',
          pob: '', obs: 'Creado desde recibo #' + folioFormato(folio)
        });
      } else {
        // Existe → revisar teléfono
        const contacto = D.directorio[idx];
        const telActual = (contacto.tel || '').trim();
        if (!telNuevo || telNuevo === telActual) {
          // Mismo tel o sin tel → no hacer nada
          return;
        }
        // Tel nuevo diferente → agregar al historial sin borrar el anterior
        if (!contacto.telHistorial) {
          // Migrar tel actual al historial si no existía
          contacto.telHistorial = telActual ? [{ tel: telActual, desde: 'anterior' }] : [];
        }
        const yaRegistrado = contacto.telHistorial.some(function(h) { return h.tel === telNuevo; });
        if (!yaRegistrado) {
          contacto.telHistorial.push({ tel: telNuevo, desde: hoy() });
          contacto.tel = telNuevo; // el más reciente queda como principal
          contacto.obs = (contacto.obs ? contacto.obs + ' | ' : '') +
                         'Tel actualizado ' + hoy() + ' desde recibo #' + folioFormato(folio);
        }
      }
    });
    save();
    renderDir();
    // ─────────────────────────────────────────────────────────────

    // ── Persistir recibo en Supabase ──────────────────────────────
    // Solo al generar por primera vez. Abonos/complementos NO se sincronizan.
    setTimeout(()=>syncEstadoSupabaseDebounced(),300);
    // ─────────────────────────────────────────────────────────────

    // ── REGISTRAR ANTICIPO EN CAJA/CONTABILIDAD ──────────────────────
    if(typeof D !== 'undefined' && Array.isArray(D.movimientos) && datos.anticipo > 0){
      const mov = {
        id: 'M-REC-NEW-' + folio + '-' + Date.now(),
        folioCaja: typeof generarFolioMovCaja === 'function' ? generarFolioMovCaja() : '',
        fecha: datos.fecha || (typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0]),
        hora: datos.hora || (typeof hora === 'function' ? hora() : ''),
        descripcion: 'Anticipo — Recibo #' + folioFormato(folio) + ' · ' + datos.nombre + (datos.conceptos&&datos.conceptos[0] ? ' · ' + (datos.conceptos[0].concepto||'') : ''),
        nombre: datos.nombre,
        folio: folio,
        monto: datos.anticipo,
        tipo: 'ingreso',
        cat: 'Anticipo · #' + folioFormato(folio),
        estatus: 'Anticipo',
        fuente: 'recibo',
        responsable: datos.generadoPor || (typeof empNombre === 'function' ? empNombre() : '')
      };
      _registrarMovimiento(mov);
      if(typeof renderCaja === 'function') renderCaja();
      setTimeout(()=>syncEstadoSupabaseDebounced(),100);
    }
    congelarRecibo();
    imprimirBlob(blob);
    renderRecibosRecientes();
    renderRec();
    btn.textContent = '✅ Impreso';
  } catch(e) {
    console.error(e);
    toast('Error: ' + e.message, 'err');
    btn.disabled = false;
    btn.textContent = '🖨 Generar PDF e Imprimir';
  }
}

async function generarPDFRecibo(datos, folio, qrDataURL) {
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({orientation:'portrait', unit:'mm', format:'letter'});
  var W=216, H=279, mg=14, y=mg;
  doc.setFillColor(253,250,244); doc.rect(0,0,W,H,'F');
  doc.setDrawColor(200,149,42); doc.setLineWidth(0.8); doc.rect(8,8,W-16,H-16);
  doc.setLineWidth(0.3); doc.rect(9.5,9.5,W-19,H-19);
  try { doc.addImage(LOGO_SRC,'JPEG',mg,y,38,24); } catch(e){ registrarError('catch vacio', e); }
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(200,149,42);
  doc.text('LEX-MEXICO', W-mg, y+6, {align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(80,60,20);
  doc.text('Despacho Juridico', W-mg, y+11, {align:'right'});
  doc.text('Santiago Juxtlahuaca, Oaxaca', W-mg, y+15.5, {align:'right'});
  doc.text('Tel: 953-100-0000', W-mg, y+20, {align:'right'});
  doc.setFillColor(192,22,26); doc.roundedRect(mg,y+26,60,10,2,2,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(255,255,255);
  doc.text('RECIBO OFICIAL No. ' + folioFormato(folio), mg+30, y+32.5, {align:'center'});
  y+=38;
  doc.setDrawColor(200,149,42); doc.setLineWidth(0.5); doc.line(mg,y,W-mg,y); y+=5;
  var cliH = datos.clientes.filter(function(c){return c.nombre;}).length*14+8;
  doc.setFillColor(253,250,244); doc.setDrawColor(212,184,112); doc.setLineWidth(0.3);
  doc.roundedRect(mg,y,W-mg*2,cliH,2,2,'FD');
  doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(140,101,24);
  doc.text('DATOS DEL CLIENTE', mg+4, y+5); y+=8;
  datos.clientes.forEach(function(cl,i) {
    if (!cl.nombre) return;
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(26,16,8);
    doc.text((datos.clientes.length>1?(i+1)+'. ':'')+cl.nombre, mg+4, y+4);
    var info = [];
    if (cl.telefono) info.push('Tel: '+cl.telefono);
    if (cl.direccion) info.push(cl.direccion);
    if (info.length) { doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(80,60,20); doc.text(info.join('  ·  '), mg+4, y+9); }
    y+=14;
  });
  y+=4;
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(80,60,20);
  var fechaFmt = datos.fecha ? datos.fecha.split('-').reverse().join('/') : '';
  doc.text('Fecha: '+fechaFmt+'   Hora: '+datos.hora+'   Atendio: '+datos.generadoPor, mg, y); y+=7;
  doc.setFillColor(26,16,8); doc.rect(mg,y,W-mg*2,7,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(253,250,244);
  doc.text('CANT.', mg+4, y+4.5);
  doc.text('DESCRIPCION DEL SERVICIO', mg+20, y+4.5);
  doc.text('P.UNIT.', W-mg-40, y+4.5, {align:'right'});
  doc.text('TOTAL', W-mg-4, y+4.5, {align:'right'});
  y+=7;
  datos.conceptos.forEach(function(con,i) {
    if (!con.descripcion) return;
    var bg = i%2===0 ? [255,255,255] : [247,243,232];
    doc.setFillColor(bg[0],bg[1],bg[2]); doc.rect(mg,y,W-mg*2,7,'F');
    var pu = parsePrecioR(con.precio), pt = pu*(parseInt(con.cantidad)||1);
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(26,16,8);
    doc.text(String(con.cantidad||1), mg+4, y+4.5);
    doc.text(String(con.descripcion).substring(0,60), mg+20, y+4.5);
    if (pu>0) { doc.text('$'+pu.toFixed(2), W-mg-40, y+4.5,{align:'right'}); doc.text('$'+pt.toFixed(2), W-mg-4, y+4.5,{align:'right'}); }
    doc.setDrawColor(212,184,112); doc.setLineWidth(0.2); doc.line(mg,y+7,W-mg,y+7); y+=7;
  });
  y+=2;
  doc.setDrawColor(200,149,42); doc.setLineWidth(0.5); doc.line(W-mg-65,y,W-mg,y); y+=4;
  [['TOTAL:',datos.total],['ANTICIPO:',datos.anticipo],['SALDO:',datos.saldo]].forEach(function(row) {
    var lbl=row[0], monto=row[1];
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(80,60,20); doc.text(lbl, W-mg-63, y);
    doc.setFontSize(10);
    if (lbl==='SALDO:' && monto>0) doc.setTextColor(192,22,26);
    else if (lbl==='ANTICIPO:') doc.setTextColor(26,122,58);
    else doc.setTextColor(26,16,8);
    doc.text('$'+Number(monto||0).toFixed(2), W-mg, y, {align:'right'}); y+=7;
  });
  y+=3;
  if (datos.documentos && datos.documentos.length) {
    var dH = Math.ceil(datos.documentos.length/3)*6+12;
    doc.setFillColor(253,250,244); doc.setDrawColor(212,184,112); doc.setLineWidth(0.3);
    doc.roundedRect(mg,y,W-mg*2,dH,2,2,'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(140,101,24);
    doc.text(datos.tipodocRecibo || 'DOCUMENTOS ENTREGADOS', mg+4, y+5); y+=10;
    datos.documentos.forEach(function(d,i) {
      var col=i%3, row=Math.floor(i/3);
      var x=mg+4+col*((W-mg*2-8)/3);
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(26,122,58);
      doc.text('ok '+d, x, y+row*6);
    });
    y+=Math.ceil(datos.documentos.length/3)*6+4;
  }
  if (datos.vehiculo) {
    var v=datos.vehiculo;
    doc.setFillColor(238,243,255); doc.setDrawColor(26,74,138); doc.setLineWidth(0.3);
    doc.roundedRect(mg,y,W-mg*2,30,2,2,'FD');
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(26,74,138);
    doc.text('DATOS VEHICULARES', mg+4, y+5); y+=8;
    var vDatos=[['Clase:',v.clase],['Marca:',v.marca],['Anio:',v.anio],['Motor:',v.motor],['Serie:',v.serie],['Placas:',v.placa],['REPUVE:',v.repuve],['Tonelaje:',v.tonelaje],['Color:',v.color]].filter(function(r){return r[1];});
    vDatos.forEach(function(r,i) {
      var col=i%3, row=Math.floor(i/3), x=mg+4+col*((W-mg*2-8)/3);
      doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(80,60,20); doc.text(r[0],x,y+row*6);
      doc.setFont('helvetica','normal'); doc.text(String(r[1]||''),x+16,y+row*6);
    });
    y+=Math.ceil(vDatos.length/3)*6+4;
  }
  if (datos.obs) { doc.setFont('helvetica','italic'); doc.setFontSize(7.5); doc.setTextColor(122,104,64); doc.text('Obs: '+datos.obs, mg, y); y+=7; }
  if (qrDataURL) {
    try { doc.addImage(qrDataURL,'PNG',W-mg-30,H-mg-50,28,28); doc.setFont('helvetica','normal'); doc.setFontSize(5.5); doc.setTextColor(122,104,64); doc.text('Escanea para verificar',W-mg-16,H-mg-20,{align:'center'}); } catch(e){ registrarError('catch vacio', e); }
  }
  var fY=H-mg-28;
  doc.setDrawColor(26,16,8); doc.setLineWidth(0.4);
  doc.line(mg,fY,mg+65,fY); doc.line(W-mg-65,fY,W-mg,fY);
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(80,60,20);
  doc.text('Firma del Responsable',mg+32,fY+4,{align:'center'});
  doc.text('Firma del Cliente',W-mg-32,fY+4,{align:'center'});
  doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(140,101,24);
  doc.text('LEX-MEXICO Despacho Juridico · Santiago Juxtlahuaca, Oaxaca · Comprobante oficial de pago.', W/2, H-mg+2, {align:'center'});
  return doc.output('blob');
}

function congelarRecibo() {
  reciboFrozen = true;
  var banner = document.getElementById('recibo-frozen-banner');
  if (banner) banner.style.display = 'block';
  var bi = document.getElementById('btn-imprimir-recibo');
  if (bi) bi.style.display = 'none';
  var br = document.getElementById('btn-reimprimir-recibo');
  if (br) br.style.display = 'block';
  var bn = document.getElementById('btn-nuevo-desde-recibo');
  if (bn) bn.style.display = 'block';
  var bs = document.getElementById('btn-sig-folio');
  if (bs) bs.style.display = 'inline-flex';
  document.querySelectorAll('#panel-nuevo-recibo input, #panel-nuevo-recibo select, #panel-nuevo-recibo textarea').forEach(function(el){el.disabled=true;});
}

function descongelarRecibo() {
  reciboFrozen = false;
  var banner = document.getElementById('recibo-frozen-banner');
  if (banner) banner.style.display = 'none';
  var bi = document.getElementById('btn-imprimir-recibo');
  if (bi) { bi.style.display='block'; bi.disabled=false; bi.textContent='🖨 Generar PDF e Imprimir'; }
  var br = document.getElementById('btn-reimprimir-recibo');
  if (br) br.style.display = 'none';
  var bn = document.getElementById('btn-nuevo-desde-recibo');
  if (bn) bn.style.display = 'none';
  var bs = document.getElementById('btn-sig-folio');
  if (bs) bs.style.display = 'none';
  document.querySelectorAll('#panel-nuevo-recibo input, #panel-nuevo-recibo select, #panel-nuevo-recibo textarea').forEach(function(el){el.disabled=false;});
}

function nuevoReciboLimpio() {
  if (pendingNextFolioRecibo) { REC.folioActual=pendingNextFolioRecibo; pendingNextFolioRecibo=null; }
  rClientes=[{nombre:'',telefono:'',direccion:''}];
  rConceptos=[{descripcion:'',cantidad:1,precio:''}];
  lastPdfBlob=null;
  recTipoDoc='copia'; setTipoDocRecibo('copia');
  descongelarRecibo();
  actualizarFolioDisplayRecibo();
  renderClientesRecibo();
  renderConceptosRecibo();
  renderDocsRecibo();
  var obs=document.getElementById('r-obs'); if(obs) obs.value='';
  var tot=document.getElementById('r-total'); if(tot) tot.value='';
  var ant=document.getElementById('r-anticipo'); if(ant) ant.value='';
  var sal=document.getElementById('r-saldo'); if(sal) sal.value='';
  var veh=document.getElementById('r-vehiculo-activo'); if(veh) veh.checked=false;
  var vsec=document.getElementById('vehiculo-section'); if(vsec) vsec.style.display='none';
  var now=new Date();
  var fEl=document.getElementById('r-fecha'); if(fEl) fEl.value=hoy();
  var hEl=document.getElementById('r-hora'); if(hEl) hEl.value=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  generarQRRecibo();
  toast('Folio #'+folioFormato(REC.folioActual)+' listo');
}

function reimprimirReciboInterno() {
  if (!lastPdfBlob) { toast('No hay PDF para reimprimir','err'); return; }
  imprimirBlob(lastPdfBlob);
}

function imprimirBlob(blob) {
  var url = URL.createObjectURL(blob);
  var win = window.open(url,'_blank');
  if (win) {
    win.addEventListener('load',function(){setTimeout(function(){win.print();URL.revokeObjectURL(url);},500);});
  } else {
    var a=document.createElement('a'); a.href=url; a.download='recibo.pdf'; a.click();
  }
}

async function guardarFolioEnDrive(nuevoFolio) {
  // Versión Supabase: actualizar folio_actual + recibos en app_state
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  try {
    var payload = Object.assign({}, REC, { folioActual: nuevoFolio, folioRapido: REC.folioRapido || 1 });
    await window.SB.from('app_state').update({
      recibos: payload,
      folio_actual: nuevoFolio
    }).eq('despacho_id', window.SB_DESPACHO_ID);
  } catch(e){ console.warn('guardarFolioEnDrive:', e); }
}

async function subirPDFaD(blob, nombre) {
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  try {
    const path = window.SB_DESPACHO_ID + '/recibos/' + nombre;
    const { error } = await window.SB.storage.from(STORAGE_BUCKET).upload(path, blob, {
      contentType: 'application/pdf',
      upsert: true
    });
    if(error){ console.warn('subirPDF:', error); return; }
    toast('PDF guardado ✓');
  } catch(e){ console.warn('subirPDF:', e); }
}

function renderRecibosRecientes() {
  var el=document.getElementById('recibos-recientes-panel');
  if (!el) return;
  var recent=(REC.recibos||[]).slice(0,8);
  if (!recent.length) { el.innerHTML='<div style="padding:14px;text-align:center;font-size:0.7rem;color:var(--muted);">Sin recibos aun</div>'; return; }
  el.innerHTML=recent.map(function(r) {
    var saldo=r.saldoPendiente!=null?r.saldoPendiente:Math.max(0,(r.total||0)-(r.anticipo||0));
    return '<div style="padding:10px 14px;border-bottom:1px solid var(--border-l);cursor:pointer;" onclick="abrirComplementoR('+r.folio+')">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<span style="font-family:JetBrains Mono,monospace;font-size:0.65rem;font-weight:700;color:var(--gold-d);">#'+folioFormato(r.folio, r.anio_folio)+'</span>' +
      '<span class="tag '+(saldo>0?'tag-a':'tag-v')+'" style="font-size:0.55rem;">'+(saldo>0?'Pendiente':'Liquidado')+'</span>' +
      '</div><div style="font-size:0.75rem;margin-top:2px;">'+esc(r.nombre)+'</div>' +
      '<div style="font-family:JetBrains Mono,monospace;font-size:0.62rem;color:var(--muted);">'+(r.fecha||'')+(saldo>0?' · $'+fmt(saldo)+' restante':' · Saldado')+'</div>' +
      '</div>';
  }).join('');
}

function abrirComplementoR(folioNum) {
  var rec=(REC.recibos||[]).find(function(r){return r.folio===folioNum;});
  if (!rec) { toast('Recibo no encontrado','err'); return; }
  var saldo=rec.saldoPendiente!=null?rec.saldoPendiente:Math.max(0,(rec.total||0)-(rec.anticipo||0));
  if (saldo<=0) { toast('Este recibo ya esta liquidado'); return; }
  var montoStr=prompt('Recibo #'+folioFormato(folioNum)+' - '+rec.nombre+'\nSaldo pendiente: $'+fmt(saldo)+'\n\nMonto del pago/abono:');
  if (!montoStr) return;
  var monto=parseFloat(montoStr);
  if (!monto||monto<=0) return;
  var nuevoSaldo=Math.max(0,saldo-monto);
  rec.saldoPendiente=nuevoSaldo;
  if (!rec.complementos) rec.complementos=[];
  rec.complementos.push({fecha:hoy(),hora:hora(),monto:monto,saldoAntes:saldo,saldoDespues:nuevoSaldo});
  // ── REGISTRAR EN CAJA/CONTABILIDAD ──────────────────────────────
  if(typeof D !== 'undefined' && Array.isArray(D.movimientos)){
    var tipoMov = nuevoSaldo<=0 ? 'Liquidación' : 'Abono parcial';
    var mov = {
      id: 'M-RECR-' + rec.folio + '-' + Date.now(),
      folioCaja: typeof generarFolioMovCaja === 'function' ? generarFolioMovCaja() : '',
      fecha: typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0],
      hora: typeof hora === 'function' ? hora() : '',
      descripcion: tipoMov + ' — Recibo #' + folioFormato(folioNum) + ' · ' + rec.nombre + ((rec.conceptos&&rec.conceptos[0]) ? ' · ' + (rec.conceptos[0].concepto||'') : ''),
      nombre: rec.nombre,
      folio: folioNum,
      monto: monto,
      tipo: 'ingreso',
      cat: (nuevoSaldo<=0 ? 'Liquidación' : 'Abono parcial') + ' · #' + folioFormato(folioNum),
      estatus: nuevoSaldo<=0 ? 'Liquidado' : 'Abono parcial',
      fuente: 'recibo',
      responsable: typeof empNombre === 'function' ? empNombre() : ''
    };
    _registrarMovimiento(mov);
    if(typeof renderCaja === 'function') renderCaja();
    setTimeout(()=>syncEstadoSupabaseDebounced(),100);
  }
  save();
  renderRecibosRecientes();
  renderRec();
  toast('Pago $'+fmt(monto)+' registrado. Saldo: $'+fmt(nuevoSaldo)+(nuevoSaldo===0?' LIQUIDADO':''));
}

// ═══ CONFIGURACION ═══
function renderConfig() {
  var s=JSON.stringify(D);
  var kb=(new TextEncoder().encode(s).length/1024).toFixed(1);
  var el=document.getElementById('cfg-size'); if(el) el.textContent=kb+' KB';
  var er=document.getElementById('cfg-rec-cnt'); if(er) er.textContent=(REC.recibos||[]).length;
  var em=document.getElementById('cfg-mov-cnt'); if(em) em.textContent=D.movimientos.length;
  var emp=document.getElementById('cfg-empleado'); if(emp) emp.value=empNombre();

  // ── DASHBOARD: actualizar fecha, hora, indicadores ──
  try { dashActualizarIndicadores(); } catch(e){ console.warn('dashActualizar:', e); }
}

// ═══ DASHBOARD: actualización de indicadores en tiempo real ═══
function dashActualizarIndicadores(){
  // Fecha y hora
  var ahora = new Date();
  var dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var fechaTxt = dias[ahora.getDay()] + ', ' + ahora.getDate() + ' ' + meses[ahora.getMonth()] + ' ' + ahora.getFullYear();
  var horaTxt = String(ahora.getHours()).padStart(2,'0') + ':' + String(ahora.getMinutes()).padStart(2,'0') + ':' + String(ahora.getSeconds()).padStart(2,'0');
  var elFecha = document.getElementById('dash-fecha');
  var elHora = document.getElementById('dash-hora');
  if(elFecha) elFecha.textContent = fechaTxt.toUpperCase();
  if(elHora) elHora.textContent = horaTxt;

  // Estado de Drive
  var driveOk = (typeof sbSession !== 'undefined') && sbSession && (Date.now() < sbExpiry);
  var elDrv = document.getElementById('dash-drive-status');
  var elDrvI = document.getElementById('dash-drive-info');
  if(elDrv){
    if(driveOk){
      elDrv.textContent = '🟢 Conectado';
      elDrv.style.color = '#1a7a3a';
      var minRest = Math.round((sbExpiry - Date.now()) / 60000);
      if(elDrvI) elDrvI.textContent = 'Token: ~' + minRest + ' min restantes';
    } else {
      elDrv.textContent = '🔴 Desconectado';
      elDrv.style.color = '#c0161a';
      if(elDrvI) elDrvI.textContent = 'Sin sesión activa';
    }
  }

  // Estado de Sync con Sheets
  var elSyn = document.getElementById('dash-sync-status');
  var elSynI = document.getElementById('dash-sync-info');
  if(elSyn){
  var activo = true;
    var cola = (typeof syncQueue !== 'undefined') ? syncQueue.length : 0;
    if(activo){
      elSyn.textContent = '🟢 Activo';
      elSyn.style.color = '#1a4a8a';
    } else {
      elSyn.textContent = '⏸ Pausado';
      elSyn.style.color = '#8c6518';
    }
    if(elSynI) elSynI.textContent = cola + ' en cola pendientes';
  }

  // Estado de Caja
  var elCaja = document.getElementById('dash-caja-status');
  var elCajaI = document.getElementById('dash-caja-info');
  if(elCaja){
    var bloq = (typeof cajaBloqueada === 'function') ? cajaBloqueada() : false;
    if(bloq){
      elCaja.textContent = '🔒 Cerrada';
      elCaja.style.color = '#c0161a';
      if(elCajaI) elCajaI.textContent = 'Cerrada para hoy';
    } else {
      elCaja.textContent = '🔓 Abierta';
      elCaja.style.color = '#1a7a3a';
      if(elCajaI){
        var hh = (typeof hoy === 'function') ? hoy() : '';
        var movHoy = (D.movimientos||[]).filter(function(m){return m.fecha===hh;}).length;
        elCajaI.textContent = movHoy + ' movs. hoy';
      }
    }
  }

  // Saldo de caja
  var elSaldo = document.getElementById('dash-saldo-caja');
  var elSaldoI = document.getElementById('dash-saldo-info');
  if(elSaldo){
    try {
      var saldo = (typeof getSaldo === 'function') ? getSaldo() : 0;
      var fmtSaldo = '$' + Math.abs(saldo).toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
      if(saldo < 0) fmtSaldo = '-' + fmtSaldo;
      elSaldo.textContent = fmtSaldo;
      elSaldo.style.color = saldo < 0 ? '#c0161a' : (saldo === 0 ? '#8c6518' : '#1a7a3a');
      if(elSaldoI){
        var ultCierre = (D.cierres||[]).slice(-1)[0];
        elSaldoI.textContent = ultCierre ? ('Ult. cierre: ' + ultCierre.fecha) : 'Sin cierres aún';
      }
    } catch(e){ elSaldo.textContent = '—'; }
  }

  // Info de sesión
  var elSes = document.getElementById('cfg-sesion-info');
  if(elSes){
    var em = (typeof empNombre === 'function') ? empNombre() : '';
    var correo = localStorage.getItem('user_email') || '';
    elSes.textContent = (correo || '—') + (em ? ' · ' + em : '');
  }
}

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
function dashAccionAdmin(accion){
  // Si admin no está autenticado, abrir modal y guardar acción pendiente
  if(typeof adminSesionActiva === 'undefined' || !adminSesionActiva){
    window._dashAccionPendiente = accion;
    if(typeof abrirAdminModal === 'function'){
      abrirAdminModal();
      // Mostrar mensaje de qué se intentaba hacer
      setTimeout(function(){
        var msg = document.getElementById('adminAuthMsg');
        if(msg){
          msg.textContent = 'Inicia sesión para acceder a: ' + dashNombreAccion(accion);
          msg.style.display = 'block';
        }
      }, 200);
    }
    return;
  }
  // Admin ya autenticado, ejecutar directamente
  dashEjecutarAccion(accion);
}

function dashNombreAccion(accion){
  var nombres = {
    'desbloquear': '🔓 Desbloquear Caja',
    'borrarHoy': '🗑 Borrar Cobros de Hoy',
    'borrarEspec': '✏️ Borrar Cobro Específico',
    'gestionRec': '🧾 Gestionar Recibos',
    'restaurarRec': '🔄 Restaurar Recibo Eliminado',
    'historicos': '📅 Movimientos Históricos',
    'backup': '💾 Backup Manual',
    'verificar': '🔍 Verificar Conflictos',
    'limpiarCierres': '🧹 Limpiar Cierres Duplicados',
    'repararFolios': '🔢 Reparar Numeración de Folios',
    'corte': '🔒 Corte de Caja'
  };
  return nombres[accion] || accion;
}

function dashEjecutarAccion(accion){
  // Mapa de acciones a sus funciones existentes
  switch(accion){
    case 'desbloquear':
      if(typeof adminDesbloquearCaja === 'function') adminDesbloquearCaja();
      break;
    case 'borrarHoy':
      if(typeof adminBorrarCobrosHoy === 'function') adminBorrarCobrosHoy();
      break;
    case 'borrarEspec':
      if(typeof adminAbrirBorrarEspecifico === 'function') adminAbrirBorrarEspecifico();
      break;
    case 'gestionRec':
      if(typeof adminAbrirGestionRecibos === 'function') adminAbrirGestionRecibos();
      break;
    case 'restaurarRec':
      if(typeof cerrarAdminModal === 'function') cerrarAdminModal();
      if(typeof abrirRestaurarRecibo === 'function') abrirRestaurarRecibo();
      break;
    case 'historicos':
      if(typeof adminAbrirHistoricos === 'function') adminAbrirHistoricos();
      break;
    case 'backup':
      if(typeof forzarBackup === 'function') forzarBackup();
      break;
    case 'verificar':
      if(typeof adminVerificarConflicto === 'function') adminVerificarConflicto();
      break;
    case 'limpiarCierres':
      if(typeof limpiarCierresDuplicados === 'function') {
        // Contar primero
        const porFecha = {};
        (D.cierres||[]).forEach(c => {
          if(c && c.fecha){
            if(!porFecha[c.fecha]) porFecha[c.fecha] = 0;
            porFecha[c.fecha]++;
          }
        });
        const fechasDup = Object.keys(porFecha).filter(f => porFecha[f] > 1);
        let totalDup = 0;
        fechasDup.forEach(f => totalDup += porFecha[f]-1);

        if(totalDup === 0){
          alert('✅ No se encontraron cierres duplicados.\n\nTu sistema está limpio.');
          return;
        }

        let msg = '🧹 LIMPIEZA DE CIERRES DUPLICADOS\n\n';
        msg += 'Se encontraron ' + totalDup + ' cierre(s) duplicado(s) en ' + fechasDup.length + ' fecha(s):\n\n';
        fechasDup.forEach(f => {
          msg += '  • ' + f + ': ' + porFecha[f] + ' cierres (eliminará ' + (porFecha[f]-1) + ')\n';
        });
        msg += '\nSe conservará el cierre más completo de cada fecha.\n\n¿Proceder con la limpieza?';

        if(confirm(msg)){
          const eliminados = limpiarCierresDuplicados(false);
          alert('✅ Limpieza completada.\n\n' + eliminados + ' cierres duplicados eliminados.\nTu Contabilidad ahora reflejará datos correctos.');
          if(typeof renderContab === 'function') renderContab();
          if(typeof renderCaja === 'function') renderCaja();
        }
      }
      break;
    case 'repararFolios':
      if(typeof adminRepararFoliosCaja === 'function') adminRepararFoliosCaja();
      break;
    case 'corte':
      if(typeof adminCorteDeCaja === 'function') adminCorteDeCaja();
      break;
    default:
      if(typeof toast === 'function') toast('Acción desconocida: ' + accion, 'err');
  }
}

// Hook después del login admin: si hay acción pendiente, ejecutarla
window._dashHookOriginalLogin = window._dashHookOriginalLogin || null;

function cambiarEmpleado(val) {
  try{ localStorage.setItem('empleado_nombre',val); } catch(e){ registrarError('localStorage.setItem', e); }
actualizarInfoSesion();toast('Empleado: '+val);
}

function limpiarDiaActual() {
  var hh=hoy();
  var movHoy=D.movimientos.filter(function(m){return m.fecha===hh && !m.borrado;});
  if (!movHoy.length) { toast('No hay movimientos de hoy para eliminar.','err'); return; }
  if (!confirm('Eliminar los '+movHoy.length+' movimientos del dia de hoy ('+hh+')? Los dias anteriores NO se modifican.')) return;

  // Soft-delete con tombstones (mismo patrón que adminBorrarCobrosHoy)
  var fechaBorrado = new Date().toISOString();
  var borradoPor = (typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.email)
    ? empleadoActual.email : 'admin';
  var idsABorrar = new Set(movHoy.map(function(m){ return m.id; }));
  var cnt = movHoy.length;

  D.movimientos.forEach(function(m){
    if(idsABorrar.has(m.id)){
      m.borrado = true;
      m.fechaBorrado = fechaBorrado;
      m.borradoPor = borradoPor;
    }
  });

  guardarTodo()
    .then(function(){
      // 1. Quitar tombstones definitivamente
      D.movimientos = D.movimientos.filter(function(m){ return !idsABorrar.has(m.id); });
      // 2. Reordenar folios ya sin los borrados y persistir
      _reordenarFoliosCaja();
          if(typeof renderCaja === 'function') renderCaja();
      if(typeof renderContab === 'function') renderContab();
      if(typeof renderConfig === 'function') renderConfig();
      toast('Movimientos de hoy eliminados ('+cnt+'). Dias anteriores intactos.');
    })
    .catch(function(e){console.warn('limpiar dia:',e);});
}

function reiniciarSistema() {
  if (!confirm('ADVERTENCIA: Borrará TODOS los datos locales del sistema. Los datos en Supabase no se afectan. Continuar?')) return;
  if (!confirm('ULTIMA CONFIRMACION: Esta accion es irreversible. Confirmas el reinicio completo?')) return;
  D={movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],cierres:[]};
  REC={folioActual:1,recibos:[]};
  localStorage.removeItem('lex_app');
  localStorage.removeItem('drive_token');
  localStorage.removeItem('drive_expiry');
  save(); renderCaja(); renderConfig();
  toast('Sistema reiniciado. Recarga la pagina.','err');
}

function exportarCopia() {
  var backup={version:'6.0',fecha:new Date().toISOString(),appData:D,reciboData:REC};
  var json=JSON.stringify(backup,null,2);
  var blob=new Blob([json],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='LEX-MEXICO-backup-'+hoy()+'.json';
  a.click(); URL.revokeObjectURL(a.href);
  toast('Copia de seguridad descargada.');
}

function importarCopia(input) {
  var file=input.files[0];
  if (!file) return;
  if (!confirm('Restaurar datos desde "'+file.name+'"? Los datos actuales seran reemplazados.')) { input.value=''; return; }
  var reader=new FileReader();
  reader.onload=function(e) {
    try {
      var backup=JSON.parse(e.target.result);
      if (!backup.appData||!backup.reciboData) { toast('Archivo invalido.','err'); return; }
      D=Object.assign({},D,backup.appData);
      REC=Object.assign({},REC,backup.reciboData);
      save(); renderCaja(); renderConfig(); renderDir(); renderJuicios(); renderPend(); badges();
      toast('Datos restaurados desde: '+file.name);
    } catch(err) { toast('Error al leer el archivo: '+err.message,'err'); }
    input.value='';
  };
  reader.readAsText(file);
}

function verCierres() {
  var panel=document.getElementById('cfg-cierres-panel');
  var tb=document.getElementById('tb-cierres');
  if (!panel||!tb) return;
  panel.style.display='block';
  if (!D.cierres||!D.cierres.length) {
    tb.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">Sin cierres registrados.</td></tr>';
    return;
  }
  tb.innerHTML=D.cierres.map(function(c) {
    // Cierres sin movimientos contables (manuales o auto-registrados)
    if (c.sinMovimientos === true) {
      var etiqAuto = c.auto ? ' <span style="font-size:0.55rem;color:#888;font-style:italic;">(auto)</span>' : '';
      return '<tr style="background:rgba(180,180,180,0.06);">' +
        '<td class="mono" style="font-size:0.7rem;">'+(c.fecha||'—')+etiqAuto+'</td>' +
        '<td class="mono" style="font-size:0.68rem;color:var(--muted);">'+(c.hora||'—')+'</td>' +
        '<td colspan="3" style="font-style:italic;color:var(--muted);font-size:0.72rem;">'+
        (c.leyenda || 'Sin movimientos contables durante la jornada')+'</td>' +
        '<td class="mono" style="font-size:0.65rem;color:var(--muted);">0</td></tr>';
    }
    return '<tr><td class="mono" style="font-size:0.7rem;">'+(c.fecha||'—')+'</td>' +
      '<td class="mono" style="font-size:0.68rem;color:var(--muted);">'+(c.hora||'—')+'</td>' +
      '<td class="monto ing">+$'+fmt(c.ingresos||0)+'</td>' +
      '<td class="monto egr">-$'+fmt(c.egresos||0)+'</td>' +
      '<td class="monto" style="font-weight:700;">$'+fmt(c.saldo||0)+'</td>' +
      '<td class="mono" style="font-size:0.65rem;color:var(--muted);">'+(c.movimientos||0)+'</td></tr>';
  }).join('');
}

// ═══ PANEL DE RESPALDOS LOCALES (Mejora 1) ═══
function abrirPanelBackups() {
  var panel = document.getElementById('cfg-backups-panel');
  if (!panel) return;
  panel.style.display = 'block';
  renderBackupsList();
}

// ═══ DIAGNÓSTICO DE NUMERACIÓN DE CARPETAS ═══
// Compara el número total real (D.carpetas.length) con la numeración visible
// y muestra qué números están faltando o duplicados.

// Función auxiliar: calcula los números faltantes en la secuencia
// Devuelve { faltantes: [...], min, max, total, numeros }
function calcularFaltantesCarpetas() {
  const carpetas = D.carpetas || [];
  const numeros = [];
  carpetas.forEach(c => {
    const numStr = String(c.num || '').trim();
    if (!numStr) return;
    const n = parseInt(numStr, 10);
    if (!isNaN(n) && String(n) === numStr) numeros.push(n);
  });
  
  if (numeros.length === 0) {
    return { faltantes: [], min: null, max: null, total: 0, numeros: [] };
  }
  
  const min = Math.min(...numeros);
  const max = Math.max(...numeros);
  const usados = new Set(numeros);
  const faltantes = [];
  for (let i = min; i <= max; i++) {
    if (!usados.has(i)) faltantes.push(i);
  }
  return { faltantes, min, max, total: numeros.length, numeros };
}

// Función auxiliar: devuelve el siguiente número para ARCH-NNNNN
function sugerirNumeroCarpeta() {
  const carpetas = D.carpetas || [];
  const numeros = carpetas
    .map(c => parseInt((c.num||'').replace('ARCH-','')) || 0)
    .filter(n => n > 0);
  if(!numeros.length) return 1;
  return Math.max(...numeros) + 1;
}

// Crear nueva carpeta con un número específico (desde el diagnóstico)
function crearCarpetaConNumero(numero) {
  // Cerrar el diagnóstico primero
  cerrar('modal-diag-carpetas');
  // Abrir el modal de nueva carpeta
  abrirCarpeta(-1);
  // Sobrescribir el número con el que se eligió desde el diagnóstico
  setTimeout(() => {
    const inp = document.getElementById('kNum');
    if (inp) {
      inp.value = String(numero);
      inp.focus();
      // Mover foco al campo de cliente para que pueda escribir directamente
      const cliInp = document.getElementById('kCliente');
      if (cliInp) cliInp.focus();
    }
  }, 100);
}

function diagnosticoCarpetas() {
  const carpetas = D.carpetas || [];
  const total = carpetas.length;
  
  // Extraer todos los números (solo los que sean numéricos)
  const numeros = [];
  const sinNumero = [];
  const noNumericos = [];
  const ocurrencias = {};  // para detectar duplicados
  
  carpetas.forEach((c, idx) => {
    const numStr = String(c.num || '').trim();
    if (!numStr) {
      sinNumero.push({ idx, cliente: c.cliente || '—' });
    } else {
      const n = parseInt(numStr, 10);
      if (isNaN(n) || String(n) !== numStr) {
        // No es un número simple (puede ser "100A", "B-12", etc.)
        noNumericos.push({ num: numStr, cliente: c.cliente || '—' });
      } else {
        numeros.push(n);
        ocurrencias[n] = (ocurrencias[n] || 0) + 1;
      }
    }
  });
  
  // Detectar duplicados
  const duplicados = Object.entries(ocurrencias)
    .filter(([n, count]) => count > 1)
    .map(([n, count]) => ({ num: parseInt(n,10), count }));
  
  // Detectar números faltantes en el rango
  const faltantes = [];
  if (numeros.length > 0) {
    const min = Math.min(...numeros);
    const max = Math.max(...numeros);
    const usados = new Set(numeros);
    for (let i = min; i <= max; i++) {
      if (!usados.has(i)) faltantes.push(i);
    }
  }
  
  const minNum = numeros.length > 0 ? Math.min(...numeros) : '—';
  const maxNum = numeros.length > 0 ? Math.max(...numeros) : '—';
  
  // Construir el HTML del modal
  let html = '<div class="modal" style="max-width:680px;width:95vw;max-height:85vh;display:flex;flex-direction:column;">' +
    '<div class="modal-hdr"><h3>📊 Diagnóstico de Numeración de Carpetas</h3>' +
    '<button class="modal-x" onclick="cerrar(\'modal-diag-carpetas\')">✕</button></div>' +
    '<div class="modal-body" style="padding:18px;overflow-y:auto;">';
  
  // Resumen principal
  html += '<div style="background:var(--surface2);padding:14px 16px;border-radius:6px;margin-bottom:14px;border-left:3px solid var(--gold);">' +
    '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;color:var(--muted);letter-spacing:0.1em;margin-bottom:8px;">RESUMEN</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.85rem;">' +
    '<div><strong>' + total + '</strong> carpetas en el sistema</div>' +
    '<div>Rango: <strong>#' + minNum + ' → #' + maxNum + '</strong></div>' +
    '<div>Con número numérico: <strong>' + numeros.length + '</strong></div>' +
    '<div>Sin número: <strong style="color:' + (sinNumero.length > 0 ? 'var(--rojo)' : 'var(--verde-d)') + ';">' + sinNumero.length + '</strong></div>' +
    '</div></div>';
  
  // Explicación del usuario
  if (numeros.length > 0) {
    const rangoEsperado = (maxNum - minNum + 1);
    html += '<div style="background:rgba(26,74,138,0.05);border:1px solid rgba(26,74,138,0.15);padding:12px 14px;border-radius:6px;margin-bottom:14px;font-size:0.78rem;color:var(--ink);line-height:1.6;">' +
      '<strong style="color:var(--azul);">💡 Por qué la numeración llega a #' + maxNum + ' pero solo hay ' + total + ' carpetas:</strong><br>' +
      'Si tu numeración va de <strong>#' + minNum + ' a #' + maxNum + '</strong>, el rango total esperado sería <strong>' + rangoEsperado + '</strong> carpetas. ' +
      'Pero tienes solo <strong>' + total + '</strong>. Eso significa que faltan <strong>' + faltantes.length + '</strong> números en la secuencia ' +
      '(probablemente carpetas eliminadas, números saltados o duplicados).' +
      '</div>';
  }
  
  // Duplicados
  if (duplicados.length > 0) {
    html += '<div style="background:rgba(192,22,26,0.05);border:1px solid rgba(192,22,26,0.2);padding:12px 14px;border-radius:6px;margin-bottom:14px;">' +
      '<strong style="color:var(--rojo);">⚠ Números duplicados (' + duplicados.length + '):</strong><br>' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.74rem;margin-top:6px;color:var(--ink);">' +
      duplicados.map(d => '#' + d.num + ' (×' + d.count + ')').join(' · ') +
      '</div></div>';
  }
  
  // Sin número
  if (sinNumero.length > 0) {
    html += '<div style="background:rgba(232,156,48,0.05);border:1px solid rgba(232,156,48,0.25);padding:12px 14px;border-radius:6px;margin-bottom:14px;">' +
      '<strong style="color:#9a6010;">⚠ Carpetas sin número (' + sinNumero.length + '):</strong><br>' +
      '<div style="font-size:0.74rem;margin-top:6px;color:var(--ink);max-height:120px;overflow-y:auto;">' +
      sinNumero.slice(0, 10).map(s => '• ' + esc(s.cliente)).join('<br>') +
      (sinNumero.length > 10 ? '<br>... y ' + (sinNumero.length - 10) + ' más' : '') +
      '</div></div>';
  }
  
  // No numéricos
  if (noNumericos.length > 0) {
    html += '<div style="background:rgba(200,149,42,0.05);border:1px solid rgba(200,149,42,0.2);padding:12px 14px;border-radius:6px;margin-bottom:14px;">' +
      '<strong style="color:var(--gold-d);">ℹ Números no estándar (' + noNumericos.length + '):</strong> Carpetas con identificador alfanumérico (ej: 100A, B-12)<br>' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.74rem;margin-top:6px;color:var(--ink);max-height:100px;overflow-y:auto;">' +
      noNumericos.slice(0, 15).map(n => '#' + n.num + ' — ' + esc(n.cliente)).join('<br>') +
      (noNumericos.length > 15 ? '<br>... y ' + (noNumericos.length - 15) + ' más' : '') +
      '</div></div>';
  }
  
  // Faltantes
  if (faltantes.length > 0) {
    const mostrar = faltantes.slice(0, 80);
    const todosString = faltantes.join(', ');
    html += '<div style="background:rgba(45,186,88,0.04);border:1px solid rgba(45,186,88,0.25);padding:12px 14px;border-radius:6px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">' +
        '<strong style="color:var(--verde-d);">📋 Números disponibles para nuevas carpetas (' + faltantes.length + '):</strong>' +
        '<button onclick="copiarFaltantesCarpetas(\'' + todosString.replace(/'/g, "\\'") + '\', this)" style="background:rgba(200,149,42,0.1);border:1px solid rgba(200,149,42,0.3);color:var(--gold-d);border-radius:4px;padding:4px 10px;font-size:0.65rem;cursor:pointer;font-family:\'JetBrains Mono\',monospace;font-weight:700;">📋 Copiar lista</button>' +
      '</div>' +
      '<div style="font-size:0.7rem;color:var(--muted);margin-bottom:10px;line-height:1.5;font-style:italic;">' +
        'Haz clic en cualquier número para crear una nueva carpeta con ese folio. Se reaprovechan los huecos antes de avanzar al siguiente número.' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;max-height:200px;overflow-y:auto;padding:4px;">' +
      mostrar.map(n => 
        '<button onclick="crearCarpetaConNumero(' + n + ')" ' +
        'class="num-faltante-btn" ' +
        'title="Crear carpeta nueva con el número #' + n + '">#' + n + '</button>'
      ).join('') +
      (faltantes.length > 80 ? '<div style="width:100%;font-size:0.7rem;color:var(--muted);text-align:center;margin-top:6px;font-style:italic;">... y ' + (faltantes.length - 80) + ' más (visibles al copiar la lista)</div>' : '') +
      '</div>' +
      '<div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border-l);font-size:0.72rem;color:var(--ink);">' +
        '💡 <strong>Sugerencia automática:</strong> al crear una carpeta nueva (botón <em>+ Nueva Carpeta</em>), el sistema te asignará automáticamente <strong style="color:var(--gold-d);font-family:\'JetBrains Mono\',monospace;">#' + faltantes[0] + '</strong> (el primer hueco disponible).' +
      '</div>' +
      '</div>';
  } else if (numeros.length > 0) {
    html += '<div style="background:rgba(45,186,88,0.06);border:1px solid rgba(45,186,88,0.25);padding:12px 14px;border-radius:6px;text-align:center;color:var(--verde-d);">' +
      '✅ <strong>No hay huecos en la numeración.</strong> La próxima carpeta tendrá el número <strong style="font-family:\'JetBrains Mono\',monospace;">#' + (maxNum + 1) + '</strong>.' +
      '</div>';
  }
  
  html += '</div>' +  // cierre modal-body
    '<div class="modal-ftr"><button class="btn btn-primary" onclick="cerrar(\'modal-diag-carpetas\')">Entendido</button></div>' +
    '</div>';  // cierre modal
  
  // Crear o reutilizar el modal
  let modal = document.getElementById('modal-diag-carpetas');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-diag-carpetas';
    modal.className = 'modal-ov';
    document.body.appendChild(modal);
  }
  modal.innerHTML = html;
  modal.classList.add('show');
}

// Copiar la lista de números faltantes al portapapeles
function copiarFaltantesCarpetas(texto, btn) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(() => {
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = '✓ Copiado';
        btn.style.background = 'rgba(45,186,88,0.15)';
        btn.style.borderColor = 'var(--verde)';
        btn.style.color = 'var(--verde-d)';
        setTimeout(() => {
          btn.innerHTML = original;
          btn.style.background = '';
          btn.style.borderColor = '';
          btn.style.color = '';
        }, 1500);
      }
      toast('✓ Lista copiada al portapapeles', 'ok');
    }).catch(e => {
      toast('No se pudo copiar: ' + e.message, 'err');
    });
  } else {
    // Fallback: crear textarea temporal
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast('✓ Lista copiada', 'ok');
    } catch(e) {
      toast('No se pudo copiar', 'err');
    }
    document.body.removeChild(ta);
  }
}

function renderBackupsList() {
  var cont = document.getElementById('tb-backups');
  if (!cont) return;
  
  var tipos = ['D', 'appData'];
  var html = '';
  
  tipos.forEach(function(tipo) {
    var lista = listarBackups(tipo);
    var titulo = tipo === 'D' ? '📊 Movimientos y Caja (D)' : '🧾 Recibos (appData)';
    
    html += '<div style="margin-bottom:18px;">';
    html += '<div style="font-family:\'Fraunces\',serif;font-size:0.95rem;font-weight:700;color:var(--ink);margin-bottom:8px;border-bottom:1px solid var(--border-l);padding-bottom:6px;">' + titulo + '</div>';
    
    if (lista.length === 0) {
      html += '<div style="padding:10px;color:var(--muted);font-size:0.78rem;">Sin respaldos disponibles aún. Se generarán automáticamente al guardar cambios.</div>';
    } else {
      html += '<table style="width:100%;border-collapse:collapse;">';
      html += '<thead><tr style="background:var(--surface2);"><th style="padding:6px 10px;text-align:left;font-size:0.7rem;color:var(--muted);">Fecha y hora</th><th style="padding:6px 10px;text-align:right;font-size:0.7rem;color:var(--muted);">Items</th><th style="padding:6px 10px;text-align:right;font-size:0.7rem;color:var(--muted);">Acciones</th></tr></thead>';
      html += '<tbody>';
      lista.forEach(function(b, idx) {
        var d = new Date(b.timestamp);
        var fecha = d.toLocaleDateString('es-MX') + ' ' + d.toLocaleTimeString('es-MX');
        var items = '';
        if (tipo === 'D' && b.datos.movimientos) {
          items = b.datos.movimientos.length + ' movs';
        } else if (tipo === 'appData' && b.datos.recibos) {
          items = b.datos.recibos.length + ' recibos';
        } else {
          items = '—';
        }
        var esActual = idx === 0;
        html += '<tr style="border-bottom:1px solid var(--border-l);' + (esActual ? 'background:rgba(45,186,88,0.04);' : '') + '">';
        html += '<td style="padding:8px 10px;">' + fecha + (esActual ? ' <span style="color:#2dba58;font-weight:700;font-size:0.65rem;">[más reciente]</span>' : '') + '</td>';
        html += '<td style="padding:8px 10px;text-align:right;color:var(--gold-d);font-weight:600;">' + items + '</td>';
        html += '<td style="padding:8px 10px;text-align:right;">';
        html += '<button onclick="restaurarBackupConfirm(\'' + tipo + '\',\'' + b.clave + '\')" style="background:var(--rojo);color:#fff;border:none;border-radius:4px;padding:5px 10px;font-size:0.7rem;cursor:pointer;font-family:inherit;">⤴ Restaurar</button>';
        html += '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div>';
  });
  
  cont.innerHTML = html;
}

function restaurarBackupConfirm(tipo, clave) {
  var datos = restaurarBackup(tipo, clave);
  if (!datos) {
    toast('No se pudo leer el respaldo', 'err');
    return;
  }
  
  var info = '';
  if (tipo === 'D' && datos.movimientos) {
    info = datos.movimientos.length + ' movimientos';
  } else if (tipo === 'appData' && datos.recibos) {
    info = datos.recibos.length + ' recibos';
  }
  
  var confirmacion = confirm(
    '¿Restaurar este respaldo?\n\n' +
    'Tipo: ' + tipo + '\n' +
    'Contiene: ' + info + '\n\n' +
    '⚠ Esto SOBRESCRIBIRÁ los datos actuales en memoria y en Drive.\n' +
    'Solo úsalo si estás seguro de que los datos actuales están corruptos.'
  );
  
  if (!confirmacion) return;
  
  try {
    if (tipo === 'D') {
      D = { ...D, ...datos };
      save();
      if (typeof renderCaja === 'function') renderCaja();
      if (typeof renderContab === 'function') renderContab();
      toast('✓ Respaldo de D restaurado — sincronizando con Drive...', 'ok');
    } else if (tipo === 'appData') {
      appData.folioActual = datos.folioActual;
      appData.recibos = datos.recibos;
      if (typeof actualizarArchivoControl === 'function') {
        actualizarArchivoControl().catch(function(e){ console.error('Error sincronizando:', e); });
      }
      if (typeof renderHistorial === 'function') renderHistorial();
      if (typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
      toast('✓ Respaldo de recibos restaurado — sincronizando con Drive...', 'ok');
    }
    renderBackupsList();
  } catch(e) {
    toast('Error al restaurar: ' + e.message, 'err');
    console.error('restaurarBackup:', e);
  }
}

// ═══ IMPRESIÓN DE TENENCIA ═══
var _tenEstado='';
var _tenOtrasCount=0;

function abrirPanelTenencia(){
  _tenEstado='';_tenOtrasCount=0;
  document.getElementById('ten-estado-seleccionado').style.display='none';
  document.getElementById('ten-select-otro').style.display='none';
  document.getElementById('ten-precio').value='40';
  document.getElementById('ten-cant').value='1';
  document.getElementById('ten-total').textContent='$0.00';
  document.querySelectorAll('#ten-estados-rapidos .estado-pill').forEach(function(b){b.classList.remove('sel');});
  document.getElementById('mTenencia').classList.add('show');
}

function selEstadoTen(estado, btn){
  if(estado==='__otro__'){
    document.getElementById('ten-select-otro').style.display='block';
    document.querySelectorAll('#ten-estados-rapidos .estado-pill').forEach(function(b){b.classList.remove('sel');});
    btn.classList.add('sel');
    return;
  }
  document.getElementById('ten-select-otro').style.display='none';
  document.querySelectorAll('#ten-estados-rapidos .estado-pill').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  _tenEstado=estado;
  var el=document.getElementById('ten-estado-seleccionado');
  el.style.display='block';
  document.getElementById('ten-estado-txt').textContent=estado;
  calcTenTotal();
}

function selEstadoTenOtro(val){
  if(!val)return;
  _tenEstado=val;
  var el=document.getElementById('ten-estado-seleccionado');
  el.style.display='block';
  document.getElementById('ten-estado-txt').textContent=val;
  calcTenTotal();
}

function toggleTenExtra(wrapId){
  var wrap=document.getElementById(wrapId);
  var chkId=wrapId.replace('-wrap','-chk');
  var chk=document.getElementById(chkId);
  wrap.style.display=chk.checked?'flex':'none';
  calcTenTotal();
}

function adjTen(id,d){
  var el=document.getElementById(id);
  var v=parseInt(el.value||1)+d;
  if(v<1)v=1;
  el.value=v;
  calcTenTotal();
}

function calcTenTotal(){
  var precio=toNumero(document.getElementById('ten-precio').value,0);
  var cant=toEntero(document.getElementById('ten-cant').value,1);
  document.getElementById('ten-total').textContent='$'+fmt(precio*cant);
}

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

function _abrirUrlTenencia(estado){
  var url=TENENCIA_URLS[estado]||'https://www.gob.mx/tramites/ficha/pago-de-tenencia-o-uso-vehicular/SRE2931';
  window.location.href=url; // misma pestaña — siempre funciona, sin bloqueo
}

function registrarTenencia(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  if(!_tenEstado){toast('Selecciona un estado primero','err');return;}
  var precio=toNumero(document.getElementById('ten-precio').value,0);
  var cant=toEntero(document.getElementById('ten-cant').value,1);
  if(precio<=0){toast('Ingresa un precio de impresión','err');return;}
  var total=precio*cant;
  var desc=(cant>1?cant+'× ':'')+'Impresión Tenencia '+_tenEstado+(cant>1?' $'+precio+'c/u':'');
  var mov={id:'M-'+Date.now(),folioCaja:generarFolioMovCaja(),fecha:hoy(),hora:hora(),descripcion:desc,monto:total,
    tipo:'ingreso',cat:'tenencia',fuente:'caja',responsable:empNombre()};
  cerrar('mTenencia');
  _regMov(mov);
  // Abrir URL en nueva pestaña usando window.open directo en el hilo del click
  var w=window.open('','_blank');
  if(w){w.location.href=TENENCIA_URLS[_tenEstado]||'https://www.gob.mx/tramites/ficha/pago-de-tenencia-o-uso-vehicular/SRE2931';}
  toast('▲ '+desc+' — $'+fmt(total));
}

function registrarTenenciaCarrito(){
  if(!_tenEstado){toast('Selecciona un estado primero','err');return;}
  var precio=toNumero(document.getElementById('ten-precio').value,0);
  var cant=toEntero(document.getElementById('ten-cant').value,1);
  if(precio<=0){toast('Ingresa un precio de impresión','err');return;}
  var total=precio*cant;
  var desc=(cant>1?cant+'× ':'')+'Impresión Tenencia '+_tenEstado+(cant>1?' $'+precio+'c/u':'');
  agregarAlCarrito(desc,total,'tenencia');
  cerrar('mTenencia');
  var w=window.open('','_blank');
  if(w){w.location.href=TENENCIA_URLS[_tenEstado]||'https://www.gob.mx/tramites/ficha/pago-de-tenencia-o-uso-vehicular/SRE2931';}
  toast('🛒 Carrito — '+desc);
}

// ═══ CONSTANCIA DE SITUACIÓN FISCAL ═══

function abrirPanelCSF(){
  document.getElementById('csf-nombre').value='';
  document.getElementById('csf-precio').value='550';
  calcCSFTotal();
  document.getElementById('mCSF').classList.add('show');
}

function calcCSFTotal(){
  var total=parseFloat(document.getElementById('csf-precio').value)||0;
  document.getElementById('csf-total').textContent='$'+fmt(total);
}

function registrarCSF(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  var nombre=document.getElementById('csf-nombre').value.trim();
  var precio=toNumero(document.getElementById('csf-precio').value,0);
  if(precio<=0){toast('El total debe ser mayor a $0','err');return;}
  var desc='Constancia Situación Fiscal'+(nombre?' — '+nombre:'');
  var mov={id:'M-'+Date.now(),folioCaja:generarFolioMovCaja(),fecha:hoy(),hora:hora(),descripcion:desc,monto:precio,
    tipo:'ingreso',cat:'gobierno',fuente:'caja',responsable:empNombre()};
  _regMov(mov);
  cerrar('mCSF');
  var msg=encodeURIComponent('Constancia de Situación Fiscal'+(nombre?' — '+nombre:''));
  var w=window.open('','_blank');
  if(w){w.location.href='https://wa.me/'+RC_WA_NUM+'?text='+msg;}
  toast('▲ '+desc+' — $'+fmt(precio));
}
function registrarCSFCarrito(){
  var nombre=document.getElementById('csf-nombre').value.trim();
  var precio=toNumero(document.getElementById('csf-precio').value,0);
  if(precio<=0){toast('El total debe ser mayor a $0','err');return;}
  var desc='Constancia Situación Fiscal'+(nombre?' — '+nombre:'');
  agregarAlCarrito(desc,precio,'gobierno');
  cerrar('mCSF');
  var msg=encodeURIComponent('Constancia de Situación Fiscal'+(nombre?' — '+nombre:''));
  var w=window.open('','_blank');
  if(w){w.location.href='https://wa.me/'+RC_WA_NUM+'?text='+msg;}
  toast('🛒 Carrito — '+desc);
}

// Navegacion integrada en ir() principal

// ═══ LOGIN POR EMAIL ═══
function abrirLogin(){
  document.getElementById('mLogin').classList.add('show');
}
function doLogin(){
  var email=document.getElementById('login-email').value.trim();
  var nombre=document.getElementById('login-nombre').value.trim();
  if(!email||!email.includes('@')){toast('Ingresa un correo válido','err');return;}
  if(!nombre){nombre=email.split('@')[0];}
  try{ localStorage.setItem('empleado_email',email); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('empleado_nombre',nombre); } catch(e){ registrarError('localStorage.setItem', e); }
document.getElementById('mLogin').classList.remove('show');
  actualizarInfoSesion();
  toast('✓ Sesión iniciada como '+nombre);
}
function verificarLogin(){
  // Login desactivado — se asigna usuario genérico automáticamente
  if(!empEmail()){
    try{ localStorage.setItem('empleado_email','usuario@lexmexico.mx'); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('empleado_nombre','Usuario'); } catch(e){ registrarError('localStorage.setItem', e); }
}
  actualizarInfoSesion();
}
function actualizarInfoSesion(){
  var el=document.getElementById('cfg-sesion-info');
  if(el)el.textContent=empEmail()||'(sin sesión)';
  var topEl=document.getElementById('topSub');
  if(topEl)topEl.textContent='Responsable: '+empNombre();
}

// ═══ CARRITO ═══
var CARRITO=[];

function updateCarritoBadge(){
  var total=CARRITO.reduce(function(s,i){return s+i.total;},0);
  var btn=document.getElementById('carritoFloating');
  var cnt=document.getElementById('carritoCnt');
  var tot=document.getElementById('carritoTotal');
  if(CARRITO.length>0){
    btn.classList.add('visible');
    if(cnt)cnt.textContent=CARRITO.length;
    if(tot)tot.textContent='$'+fmt(total);
  } else {
    btn.classList.remove('visible');
  }
}

function agregarAlCarrito(desc,monto,cat){
  CARRITO.push({desc:desc,total:monto,cat:cat||'otro'});
  updateCarritoBadge();
  toast('🛒 Agregado al carrito: '+desc);
}

function abrirCarrito(){
  renderCarrito();
  document.getElementById('mCarrito').classList.add('show');
}

function renderCarrito(){
  var lista=document.getElementById('carrito-lista');
  var vacio=document.getElementById('carrito-vacio');
  var totalEl=document.getElementById('carrito-total');
  if(!CARRITO.length){
    lista.innerHTML='';
    vacio.style.display='block';
    totalEl.textContent='$0.00';
    return;
  }
  vacio.style.display='none';
  var total=0;
  lista.innerHTML=CARRITO.map(function(item,i){
    total+=item.total;
    return '<div class="carrito-item">'+
      '<span class="carrito-item-nom">'+esc(item.desc)+'</span>'+
      '<span class="carrito-item-precio">$'+fmt(item.total)+'</span>'+
      '<button onclick="quitarCarritoItem('+i+')" style="width:22px;height:22px;border:1px solid var(--rojo-l);border-radius:4px;cursor:pointer;font-size:0.8rem;color:var(--rojo);background:var(--rojo-l);">✕</button>'+
    '</div>';
  }).join('');
  totalEl.textContent='$'+fmt(total);
}

function quitarCarritoItem(i){
  CARRITO.splice(i,1);
  renderCarrito();
  updateCarritoBadge();
}

async function vaciarCarrito(){
  const ok = await confirmarBonito({
    titulo: 'Vaciar carrito',
    mensaje: '¿Quitar todos los items del carrito?',
    btnSi: 'Sí, vaciar',
    btnNo: 'Cancelar'
  });
  if(!ok) return;
  CARRITO=[];
  renderCarrito();
  updateCarritoBadge();
}

function registrarCarrito(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  if(!CARRITO.length){toast('El carrito está vacío','err');return;}
  var total=CARRITO.reduce(function(s,i){return s+i.total;},0);
  var descs=CARRITO.map(function(i){return i.desc+' $'+fmt(i.total);}).join(' | ');
  var cat=CARRITO.length===1?CARRITO[0].cat:'otro';
  var cliente=(document.getElementById('carrito-cliente').value||'').trim();
  var descripcion='[Carrito] '+(cliente?cliente+' — ':'')+descs;
  var mov={id:'M-'+Date.now(),folioCaja:generarFolioMovCaja(),fecha:hoy(),hora:hora(),
    descripcion:descripcion,
    monto:total,tipo:'ingreso',cat:cat,fuente:'caja',responsable:empNombre()};
  CARRITO=[];
  document.getElementById('carrito-cliente').value='';
  updateCarritoBadge();
  cerrar('mCarrito');
  _regMov(mov);
  toast('✅ Carrito registrado — $'+fmt(total));
}

// ═══ MODOS TENENCIA / CSF ═══
var _tenModo='caja';
var _csfModo='caja';

function setTenModo(m){
  _tenModo=m;
  document.getElementById('tenModo-caja').className='servicio-modo-btn'+(m==='caja'?' active-caja':'');
  document.getElementById('tenModo-carrito').className='servicio-modo-btn'+(m==='carrito'?' active-carrito':'');
}
function setCSFModo(m){
  _csfModo=m;
  document.getElementById('csfModo-caja').className='servicio-modo-btn'+(m==='caja'?' active-caja':'');
  document.getElementById('csfModo-carrito').className='servicio-modo-btn'+(m==='carrito'?' active-carrito':'');
}

// ═══ COPIAS ═══
var _copiaTipo='bn';
var _copiasModo='caja';

function abrirCopias(){
  document.getElementById('copias-precio').value='2';
  document.getElementById('copias-cant').value='1';
  _copiaTipo='bn';
  selCopia('bn',document.getElementById('copiaBtn-bn'));
  calcCopiaTotal();
  document.getElementById('mCopias').classList.add('show');
}
function selCopia(tipo,btn){
  _copiaTipo=tipo;
  document.querySelectorAll('.copia-tipo-btn').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  var precio=tipo==='bn'?2:5;
  document.getElementById('copias-precio').value=precio;
  calcCopiaTotal();
}
function adjCopias(d){
  var el=document.getElementById('copias-cant');
  var v=parseInt(el.value||1)+d;if(v<1)v=1;el.value=v;calcCopiaTotal();
}
function calcCopiaTotal(){
  var p=parseFloat(document.getElementById('copias-precio').value)||0;
  var c=parseInt(document.getElementById('copias-cant').value)||1;
  document.getElementById('copias-total').textContent='$'+fmt(p*c);
}
function setCopiasModo(m){
  _copiasModo=m;
  document.getElementById('copiasModo-caja').className='servicio-modo-btn'+(m==='caja'?' active-caja':'');
  document.getElementById('copiasModo-carrito').className='servicio-modo-btn'+(m==='carrito'?' active-carrito':'');
}
function registrarCopias(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  var precio=toNumero(document.getElementById('copias-precio').value,0);
  var cant=toEntero(document.getElementById('copias-cant').value,1);
  var total=precio*cant;
  if(total<=0){toast('El total debe ser mayor a $0','err');return;}
  var tipoLabel=_copiaTipo==='bn'?'Blanco y negro':'Color';
  var desc=cant+'× Copia '+tipoLabel+' $'+precio+'c/u';
  var mov={id:'M-'+Date.now(),folioCaja:generarFolioMovCaja(),fecha:hoy(),hora:hora(),descripcion:desc,monto:total,
    tipo:'ingreso',cat:'copia',fuente:'caja',responsable:empNombre()};
  cerrar('mCopias');
  _regMov(mov);
  toast('▲ '+desc+' — $'+fmt(total));
}
function registrarCopiasCarrito(){
  var precio=toNumero(document.getElementById('copias-precio').value,0);
  var cant=toEntero(document.getElementById('copias-cant').value,1);
  var total=precio*cant;
  if(total<=0){toast('El total debe ser mayor a $0','err');return;}
  var tipoLabel=_copiaTipo==='bn'?'Blanco y negro':'Color';
  var desc=cant+'× Copia '+tipoLabel+' $'+precio+'c/u';
  agregarAlCarrito(desc,total,'copia');
  cerrar('mCopias');
}

// ═══ ESCANEO ═══
var _escanModo='caja';
var _escanTam='carta';

function setEscanTam(t){
  _escanTam=t;
  var precio=t==='carta'?15:20;
  document.getElementById('escan-precio').value=precio;
  var btnC=document.getElementById('escanTam-carta');
  var btnO=document.getElementById('escanTam-oficio');
  var baseStyle='flex:1;padding:10px 6px;border-radius:var(--radius-sm);cursor:pointer;font-family:JetBrains Mono,monospace;font-size:0.7rem;font-weight:700;letter-spacing:0.05em;transition:all 0.15s;';
  if(t==='carta'){
    btnC.style.cssText=baseStyle+'border:2px solid var(--verde);background:var(--verde-l);color:var(--verde-d);';
    btnO.style.cssText=baseStyle+'border:2px solid var(--border);background:var(--surface2);color:var(--muted);';
    btnC.innerHTML='📄 CARTA';
    btnO.innerHTML='📋 OFICIO';
  } else {
    btnO.style.cssText=baseStyle+'border:2px solid var(--verde);background:var(--verde-l);color:var(--verde-d);';
    btnC.style.cssText=baseStyle+'border:2px solid var(--border);background:var(--surface2);color:var(--muted);';
    btnC.innerHTML='📄 CARTA';
    btnO.innerHTML='📋 OFICIO';
  }
  calcEscanTotal();
}

function abrirEscaneo(){
  _escanTam='carta';
  document.getElementById('escan-precio').value='15';
  document.getElementById('escan-cant').value='1';
  setEscanTam('carta');
  calcEscanTotal();
  document.getElementById('mEscaneo').classList.add('show');
}
function adjEscan(d){
  var el=document.getElementById('escan-cant');
  var v=parseInt(el.value||1)+d;if(v<1)v=1;el.value=v;calcEscanTotal();
}
function calcEscanTotal(){
  var p=parseFloat(document.getElementById('escan-precio').value)||0;
  var c=parseInt(document.getElementById('escan-cant').value)||1;
  document.getElementById('escan-total').textContent='$'+fmt(p*c);
}
function setEscanModo(m){
  _escanModo=m;
  document.getElementById('escanModo-caja').className='servicio-modo-btn'+(m==='caja'?' active-caja':'');
  document.getElementById('escanModo-carrito').className='servicio-modo-btn'+(m==='carrito'?' active-carrito':'');
}
function registrarEscaneo(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  var precio=toNumero(document.getElementById('escan-precio').value,0);
  var cant=toEntero(document.getElementById('escan-cant').value,1);
  var total=precio*cant;
  if(total<=0){toast('El total debe ser mayor a $0','err');return;}
  var tamLabel=_escanTam==='carta'?'Carta':'Oficio';
  var desc=cant+'× Escaneo '+tamLabel+' $'+precio+'c/u';
  var mov={id:'M-'+Date.now(),folioCaja:generarFolioMovCaja(),fecha:hoy(),hora:hora(),descripcion:desc,monto:total,
    tipo:'ingreso',cat:'copia',fuente:'caja',responsable:empNombre()};
  cerrar('mEscaneo');
  _regMov(mov);
  toast('▲ '+desc+' — $'+fmt(total));
}
function registrarEscaneoCarrito(){
  var precio=toNumero(document.getElementById('escan-precio').value,0);
  var cant=toEntero(document.getElementById('escan-cant').value,1);
  var total=precio*cant;
  if(total<=0){toast('El total debe ser mayor a $0','err');return;}
  var tamLabel=_escanTam==='carta'?'Carta':'Oficio';
  var desc=cant+'× Escaneo '+tamLabel+' $'+precio+'c/u';
  agregarAlCarrito(desc,total,'copia');
  cerrar('mEscaneo');
}

// ═══ CAPTURA RÁPIDA (nuevo diseño) ═══
var _libreTipo='ingreso';
var _libreModo='caja';
var _libreConceptos=[];

function setLibreTipo(tipo){
  _libreTipo=tipo;
  var hdr=document.getElementById('mLibreHdr');
  var body=document.getElementById('mLibreBody');
  var ftr=document.getElementById('mLibreFtr');
  var totalBox=document.getElementById('libreTotal-box');
  var totalVal=document.getElementById('libre-total');
  var btnIng=document.getElementById('libreBtn-ingreso');
  var btnEgr=document.getElementById('libreBtn-egreso');
  var btnReg=document.getElementById('libreBtn-registrar');
  var btnCarrito=document.getElementById('libreBtn-carrito');
  if(tipo==='ingreso'){
    hdr.style.background='linear-gradient(135deg,#e8f5ec,#f0faf2)';
    hdr.style.borderBottom='2px solid rgba(26,122,58,0.25)';
    body.style.background='linear-gradient(180deg,#f5fcf7 0%,var(--surface) 60%)';
    totalBox.style.background='rgba(26,122,58,0.07)';
    totalBox.style.borderColor='rgba(26,122,58,0.25)';
    totalVal.style.color='var(--verde)';
    btnReg.style.background='var(--verde)';
    btnIng.style.background='var(--verde)';
    btnIng.style.borderColor='var(--verde)';
    btnIng.style.color='#fff';
    btnIng.style.opacity='1';
    btnEgr.style.background='transparent';
    btnEgr.style.borderColor='var(--border)';
    btnEgr.style.color='var(--muted)';
    btnEgr.style.opacity='0.6';
    // Mostrar Carrito
    if(btnCarrito)btnCarrito.style.display='inline-flex';
  } else {
    hdr.style.background='linear-gradient(135deg,#fff0f0,#fff5f5)';
    hdr.style.borderBottom='2px solid rgba(192,22,26,0.2)';
    body.style.background='linear-gradient(180deg,#fff5f5 0%,var(--surface) 60%)';
    totalBox.style.background='rgba(192,22,26,0.06)';
    totalBox.style.borderColor='rgba(192,22,26,0.2)';
    totalVal.style.color='var(--rojo)';
    btnReg.style.background='var(--rojo)';
    btnEgr.style.background='var(--rojo)';
    btnEgr.style.borderColor='var(--rojo)';
    btnEgr.style.color='#fff';
    btnEgr.style.opacity='1';
    btnIng.style.background='transparent';
    btnIng.style.borderColor='var(--border)';
    btnIng.style.color='var(--muted)';
    btnIng.style.opacity='0.6';
    // Ocultar Carrito en modo egreso
    if(btnCarrito)btnCarrito.style.display='none';
  }
}

function abrirLibre(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  _libreTipo='ingreso';
  _libreConceptos=[];
  // reset visual
  var hdr=document.getElementById('mLibreHdr');
  var body=document.getElementById('mLibreBody');
  if(hdr)hdr.style.background='linear-gradient(135deg,#e8f5ec,#f0faf2)';
  if(hdr)hdr.style.borderBottom='2px solid rgba(26,122,58,0.25)';
  if(body)body.style.background='linear-gradient(180deg,#f5fcf7 0%,var(--surface) 60%)';
  var totalBox=document.getElementById('libreTotal-box');
  if(totalBox){totalBox.style.background='rgba(26,122,58,0.07)';totalBox.style.borderColor='rgba(26,122,58,0.25)';}
  var totalVal=document.getElementById('libre-total');
  if(totalVal){totalVal.style.color='var(--verde)';totalVal.textContent='$0.00';}
  var btnIng=document.getElementById('libreBtn-ingreso');
  var btnEgr=document.getElementById('libreBtn-egreso');
  if(btnIng){btnIng.style.background='var(--verde)';btnIng.style.borderColor='var(--verde)';btnIng.style.color='#fff';btnIng.style.opacity='1';}
  if(btnEgr){btnEgr.style.background='transparent';btnEgr.style.borderColor='var(--border)';btnEgr.style.color='var(--muted)';btnEgr.style.opacity='0.6';}
  var btnReg=document.getElementById('libreBtn-registrar');
  if(btnReg)btnReg.style.background='var(--verde)';
  var btnCarrito=document.getElementById('libreBtn-carrito');
  if(btnCarrito)btnCarrito.style.display='inline-flex';
  renderConceptosLibre();
  agregarConceptoLibre();

  // Mostrar campos de fecha/hora si estamos en modo captura retroactiva
  const retroCampos = document.getElementById('libre-retro-campos');
  const retroFecha  = document.getElementById('libre-retro-fecha');
  const retroHora   = document.getElementById('libre-retro-hora');
  if(retroCampos && retroFecha && retroHora){
    if(window._capturaMesActivo){
      retroCampos.style.display = 'block';
      // Pre-llenar con fecha actual dentro del mes o la que ya tenía
      const fechaActual = window._capturaFechaManual || (window._capturaMesActivo.anio+'-'+window._capturaMesActivo.mesNum+'-01');
      const horaActual  = window._capturaHoraManual  || _horaReal();
      retroFecha.value = fechaActual;
      retroHora.value  = horaActual;
      retroFecha.min   = window._capturaMesActivo.anio+'-'+window._capturaMesActivo.mesNum+'-01';
      // Calcular último día del mes
      const maxDay = new Date(window._capturaMesActivo.anio, window._capturaMesActivo.mes+1, 0).getDate();
      retroFecha.max = window._capturaMesActivo.anio+'-'+window._capturaMesActivo.mesNum+'-'+String(maxDay).padStart(2,'0');
      window._capturaFechaManual = fechaActual;
      window._capturaHoraManual  = horaActual;
    } else {
      retroCampos.style.display = 'none';
      window._capturaFechaManual = null;
      window._capturaHoraManual  = null;
    }
  }

  document.getElementById('mLibre').classList.add('show');
}

function renderConceptosLibre(){
  var lista=document.getElementById('libre-conceptos-lista');
  if(!lista)return;
  lista.innerHTML='';
  _libreConceptos.forEach(function(c,i){
    var div=document.createElement('div');
    div.style.cssText='display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:10px;border:1.5px solid var(--border-l);border-radius:var(--radius-sm);padding:12px;background:var(--surface);position:relative;';
    div.innerHTML=
      '<div class="field" style="margin:0;">'+
        '<label style="font-family:JetBrains Mono,monospace;font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);font-weight:500;">Descripción</label>'+
        '<input type="text" placeholder="Ej: Carta responsiva, Asesoría..." value="'+esc(c.desc||'')+'" oninput="_libreConceptos['+i+'].desc=this.value;" style="width:100%;background:var(--surface);border:1.5px solid var(--border-l);border-radius:var(--radius-sm);padding:8px 11px;font-family:Outfit,sans-serif;font-size:0.82rem;color:var(--ink);outline:none;margin-top:5px;" onfocus="this.style.borderColor=\'var(--gold)\'" onblur="this.style.borderColor=\'var(--border-l)\'">'+
      '</div>'+
      (i>0?'<button onclick="eliminarConceptoLibre('+i+')" style="align-self:flex-start;margin-top:22px;width:26px;height:26px;border:1px solid var(--rojo-l);border-radius:4px;cursor:pointer;font-size:0.85rem;color:var(--rojo);background:var(--rojo-l);flex-shrink:0;">✕</button>':'<div></div>')+
      '<div class="field" style="margin:0;grid-column:1/3;">'+
        '<label style="font-family:JetBrains Mono,monospace;font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);font-weight:500;">Precio ($)</label>'+
        '<input type="number" placeholder="0.00" value="'+(c.precio||'')+'" min="0" step="0.5" oninput="_libreConceptos['+i+'].precio=parseFloat(this.value)||0;calcLibreTotal();" style="width:100%;background:var(--surface);border:1.5px solid var(--border-l);border-radius:var(--radius-sm);padding:8px 11px;font-family:JetBrains Mono,monospace;font-size:0.9rem;color:var(--ink);outline:none;margin-top:5px;" onfocus="this.style.borderColor=\'var(--gold)\'" onblur="this.style.borderColor=\'var(--border-l)\'">'+
      '</div>';
    lista.appendChild(div);
  });
}

function agregarConceptoLibre(){
  _libreConceptos.push({desc:'',precio:0});
  renderConceptosLibre();
}

function eliminarConceptoLibre(i){
  _libreConceptos.splice(i,1);
  renderConceptosLibre();
  calcLibreTotal();
}

function calcLibreTotal(){
  var total=_libreConceptos.reduce(function(s,c){return s+(parseFloat(c.precio)||0);},0);
  var el=document.getElementById('libre-total');
  if(el)el.textContent='$'+fmt(total);
}

function setLibreModo(m){
  _libreModo=m;
}

function registrarLibre(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  var validos=_libreConceptos.filter(function(c){return c.desc.trim()&&(parseFloat(c.precio)||0)>0;});
  if(!validos.length){toast('Ingresa al menos una descripción con precio','err');return;}
  var total=validos.reduce(function(s,c){return s+(parseFloat(c.precio)||0);},0);
  if(total<=0){toast('El precio debe ser mayor a $0','err');return;}
  var desc=validos.length===1?validos[0].desc.trim():validos.map(function(c){return c.desc.trim()+' $'+fmt(c.precio);}).join(' | ');
  elegirResponsable(function(resp){
    var mov={id:'M-'+Date.now(),folioCaja:generarFolioMovCaja(),fecha:hoy(),hora:hora(),descripcion:desc,monto:total,
      tipo:_libreTipo,cat:'otro',fuente:'caja',responsable:resp};
    _registrarMovimiento(mov);save();renderCaja();setTimeout(()=>syncEstadoSupabaseDebounced(),100);
    cerrar('mLibre');
    var pref=_libreTipo==='ingreso'?'▲':'▼';
    toast(pref+' '+desc+' — $'+fmt(total));
  });
}

function registrarLibreCarrito(){
  var validos=_libreConceptos.filter(function(c){return c.desc.trim()&&(parseFloat(c.precio)||0)>0;});
  if(!validos.length){toast('Ingresa al menos una descripción con precio','err');return;}
  var total=validos.reduce(function(s,c){return s+(parseFloat(c.precio)||0);},0);
  var desc=validos.length===1?validos[0].desc.trim():validos.map(function(c){return c.desc.trim()+' $'+fmt(c.precio);}).join(' | ');
  agregarAlCarrito(desc,total,'otro');
  cerrar('mLibre');
}

// ═══ CAPTURA RETROACTIVA ═══
// Permite registrar movimientos con fecha y hora anteriores
// Útil cuando se cobra después del cierre de caja
function abrirCapturaRetro(){
  var fechaHoy = (typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0]);
  var horaAhora = (typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5));

  var modalHTML = ''
    + '<div id="modalCapturaRetro" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">'
    + '<div style="background:#1a1410;border:2px solid #5a3a8a;border-radius:12px;max-width:520px;width:100%;padding:24px;color:#e8d4a8;font-family:system-ui,sans-serif;max-height:90vh;overflow-y:auto;">'

    + '<h2 style="margin:0 0 6px 0;color:#c8952a;font-family:Fraunces,serif;">📅 Captura Retroactiva</h2>'
    + '<div style="font-size:0.78rem;color:rgba(200,149,42,0.7);margin-bottom:14px;">'
    + 'Registra un movimiento con fecha/hora anterior. Útil para cobros recibidos después del cierre.'
    + '</div>'

    + '<div style="display:flex;gap:8px;margin-bottom:14px;">'
    + '<button onclick="retroSetTipo(\'ingreso\')" id="retroBtnIng" style="flex:1;padding:10px;background:#2a7a3a;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;">▲ Ingreso</button>'
    + '<button onclick="retroSetTipo(\'egreso\')" id="retroBtnEgr" style="flex:1;padding:10px;background:#3a2018;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;">▼ Egreso</button>'
    + '</div>'

    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">'
    + '<div>'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Fecha:</label>'
    + '<input type="date" id="retroFecha" value="' + fechaHoy + '" max="' + fechaHoy + '" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:1rem;">'
    + '</div>'
    + '<div>'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Hora:</label>'
    + '<input type="time" id="retroHora" value="' + horaAhora + '" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:1rem;">'
    + '</div>'
    + '</div>'
    + '<div style="font-size:0.7rem;color:rgba(200,149,42,0.6);margin-bottom:12px;margin-top:-4px;">⚠️ No se permiten fechas futuras</div>'

    + '<div style="margin-bottom:12px;">'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Descripción:</label>'
    + '<input type="text" id="retroDesc" placeholder="Ej: Pago de Juan Pérez recibido por la noche" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:0.95rem;">'
    + '</div>'

    + '<div style="margin-bottom:12px;">'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Monto:</label>'
    + '<input type="number" id="retroMonto" placeholder="0.00" min="0" step="0.01" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:1rem;">'
    + '</div>'

    + '<div style="margin-bottom:14px;">'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Motivo de captura retroactiva (auditoría):</label>'
    + '<input type="text" id="retroMotivo" placeholder="Ej: Cliente llegó después del cierre" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:0.9rem;">'
    + '</div>'

    + '<div style="background:rgba(200,149,42,0.08);border:1px solid rgba(200,149,42,0.3);padding:10px;border-radius:6px;margin-bottom:14px;font-size:0.75rem;">'
    + '<b>📝 Importante:</b> Este movimiento se registrará con la fecha/hora indicadas, '
    + 'no con la del momento actual. Quedará registro de auditoría con el usuario, '
    + 'la fecha real de captura y el motivo.'
    + '</div>'

    + '<div style="display:flex;gap:8px;">'
    + '<button onclick="document.getElementById(\'modalCapturaRetro\').remove()" style="flex:1;padding:12px;background:#444;border:none;border-radius:6px;color:#fff;cursor:pointer;">Cancelar</button>'
    + '<button onclick="confirmarCapturaRetro()" style="flex:2;padding:12px;background:#5a3a8a;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;">✅ Registrar movimiento</button>'
    + '</div>'

    + '</div>'
    + '</div>';

  var div = document.createElement('div');
  div.innerHTML = modalHTML;
  document.body.appendChild(div.firstChild);
  retroSetTipo('ingreso');
}

function retroSetTipo(tipo){
  var btnIng = document.getElementById('retroBtnIng');
  var btnEgr = document.getElementById('retroBtnEgr');
  if(tipo === 'ingreso'){
    btnIng.style.background = '#2a9a4a';
    btnEgr.style.background = '#3a2018';
  } else {
    btnIng.style.background = '#1a4a2a';
    btnEgr.style.background = '#c0161a';
  }
  window._retroTipo = tipo;
}

function confirmarCapturaRetro(){
  var fecha = document.getElementById('retroFecha').value;
  var hr = document.getElementById('retroHora').value;
  var desc = document.getElementById('retroDesc').value.trim();
  var monto = parseFloat(document.getElementById('retroMonto').value) || 0;
  var motivo = document.getElementById('retroMotivo').value.trim();
  var tipo = window._retroTipo || 'ingreso';
  var fechaHoy = (typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0]);

  // Validaciones
  if(!fecha){ alert('Debes elegir una fecha.'); return; }
  if(fecha > fechaHoy){
    alert('No se permiten fechas futuras. Solo puedes capturar movimientos con fechas pasadas o de hoy.');
    return;
  }
  if(!hr){ alert('Debes elegir una hora.'); return; }
  if(!desc){ alert('Debes escribir una descripción.'); return; }
  if(monto <= 0){ alert('El monto debe ser mayor a cero.'); return; }
  if(!motivo){
    if(!confirm('¿Capturar sin motivo? Para auditoría es recomendable escribir el motivo.')) return;
    motivo = '(sin motivo registrado)';
  }

  // Confirmación final
  var icono = tipo === 'ingreso' ? '▲' : '▼';
  var resumen = icono + ' ' + tipo.toUpperCase() + ': $' + monto.toLocaleString() + '\n'
    + 'Fecha: ' + fecha + ' ' + hr + '\n'
    + 'Desc: ' + desc + '\n\n'
    + '¿Confirmar registro?';
  if(!confirm(resumen)) return;

  // Crear movimiento con fecha retroactiva
  var mov = {
    id: 'M-RETRO-' + Date.now(),
    folioCaja: (typeof generarFolioMovCaja === 'function' ? generarFolioMovCaja(fecha) : ''),
    fecha: fecha,
    hora: hr,
    descripcion: desc,
    monto: monto,
    tipo: tipo,
    cat: 'otro',
    fuente: 'caja',
    responsable: (typeof empNombre === 'function' ? empNombre() : ''),
    retroactivo: true,
    auditoria: {
      capturadoEn: new Date().toISOString(),
      fechaRealCaptura: fechaHoy,
      horaRealCaptura: (typeof hora === 'function' ? hora() : ''),
      usuario: (typeof empNombre === 'function' ? empNombre() : 'Admin'),
      motivo: motivo
    }
  };

  _registrarMovimiento(mov);
  if(typeof save === 'function') save();
  if(typeof renderCaja === 'function') renderCaja();
  if(typeof renderContab === 'function') renderContab();
  setTimeout(()=>syncEstadoSupabaseDebounced(),100);

  document.getElementById('modalCapturaRetro').remove();
  if(typeof toast === 'function'){
    toast('✅ Movimiento retroactivo registrado: ' + fecha + ' ' + hr, 'ok');
  } else {
    alert('Registrado: ' + fecha + ' ' + hr + ' — $' + monto);
  }
}
// ═══ FIN CAPTURA RETROACTIVA ═══

// ═══ REGISTRO CIVIL ═══

// Número de WhatsApp del grupo (configurable)
var RC_WA_NUM = '529544000000'; // <- Cambiar al número real del grupo

function abrirRegistroCivil(){
  rcMostrar('home');
  document.getElementById('mRegistroCivil').classList.add('show');
}

function rcMostrar(sub){
  ['home','acta','curp'].forEach(function(n){
    var el=document.getElementById('mRC-'+n);
    if(el)el.style.display=(n===sub)?'block':'none';
  });
  if(sub==='curp'){
    _curpPanelActivo = 'curp'; // PARCHE: asegurar que el panel activo sea el correcto
    rcCalcCurpTotal('curp');
  }
}

// Compatibilidad con llamadas antiguas del panel lateral
function rcAbrirSubpanel(nombre){ rcMostrar(nombre); }

// ── ACTA: abrir WhatsApp con mensaje preescrito ──
function rcEnviarWA(tipoActa){
  var etiquetas={nacimiento:'Acta de nacimiento',matrimonio:'Acta de matrimonio',divorcio:'Acta de divorcio'};
  var nombre=etiquetas[tipoActa]||'Acta';
  var msg=encodeURIComponent(nombre+' + CURP');
  window.open('https://wa.me/'+RC_WA_NUM+'?text='+msg,'_blank');
  toast('💬 Abriendo WhatsApp: '+nombre,'ok');
}

// ── CURP: abrir página oficial del gobierno ──
function rcAbrirCurpGov(){
  // Construir URL del portal oficial CURP. Si hay datos capturados los
  // intentamos pasar como hint (el portal los ignora si no le sirven, pero
  // ayudan al usuario a no escribirlos otra vez).
  try {
    var n1 = (document.getElementById('curp-nombre1')||{}).value || '';
    var ap1 = (document.getElementById('curp-ap1')||{}).value || '';
    var resumen = (n1 + ' ' + ap1).trim();
    if(resumen && typeof toast === 'function'){
      toast('🌐 Abriendo portal CURP (' + resumen + ')', 'ok');
    } else if(typeof toast === 'function'){
      toast('🌐 Abriendo portal CURP del gobierno', 'ok');
    }
  } catch(e){ registrarError('catch vacio', e); }
  window.open('https://www.gob.mx/curp/', '_blank');
}

// ── CURP: actualizar vista en captura (stub, los inputs guardan su valor solos) ──
// Esta función existía como handler oninput en los campos del formulario CURP.
// Su único propósito histórico era refrescar una vista previa que ya no existe.
// Se mantiene como no-op para que los inputs no lancen ReferenceError.
function rcActualizarVista(){
  // Hook intencionalmente vacío. Los inputs actualizan su .value por sí solos.
  // Si en el futuro se quiere agregar una vista previa, este es el lugar.
}

// ── CURP: cálculo de total ──
function rcCalcCurpTotal(){
  var precio = parseFloat(document.getElementById('curp2-precio').value) || 0;
  var cant   = Math.max(1, parseInt(document.getElementById('curp2-cant').value) || 1);
  document.getElementById('curp2-total').textContent = '$' + fmt(precio * cant);
}

function rcAdjCurp(d){
  var el = document.getElementById('curp2-cant');
  el.value = Math.max(1, (parseInt(el.value) || 1) + d);
  rcCalcCurpTotal();
}

// ── CURP: agregar al carrito ──
function rcCurpCarrito(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  var p = parseFloat(document.getElementById('curp2-precio').value) || 0;
  var c = parseInt(document.getElementById('curp2-cant').value) || 1;
  var total = p * c;
  if(total <= 0){toast('El total debe ser mayor a $0','err');return;}
  var desc = c > 1 ? (c + '× CURP $' + fmt(p) + ' c/u') : ('Impresión CURP $' + fmt(p));
  agregarAlCarrito(desc, total, 'curp');
  cerrar('mRegistroCivil');
  var w = window.open('', '_blank');
  if(w){ w.location.href = 'https://www.gob.mx/curp/'; }
  toast('🛒 Agregado — ' + desc, 'ok');
}

// ── CURP: registrar ──
function rcRegistrarCurp(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  var p = parseFloat(document.getElementById('curp2-precio').value) || 0;
  var c = parseInt(document.getElementById('curp2-cant').value) || 1;
  var total = p * c;
  if(total <= 0){toast('El total debe ser mayor a $0','err');return;}
  var desc = c > 1 ? (c + '× CURP $' + fmt(p) + ' c/u') : ('Impresión CURP $' + fmt(p));
  var mov = {id:'M-'+Date.now(), folioCaja:generarFolioMovCaja(), fecha:hoy(), hora:hora(),
    descripcion:desc, monto:total, tipo:'ingreso', cat:'curp', fuente:'caja', responsable:empNombre()};
  _regMov(mov);
  cerrar('mRegistroCivil');
  var w = window.open('', '_blank');
  if(w){ w.location.href = 'https://www.gob.mx/curp/'; }
  toast('▲ ' + desc + ' — $' + fmt(total), 'ok');
}
// ═══ ACTAS DEL REGISTRO CIVIL ═══
var _actaTipo='';
var _actaEstado='';
var _actaTipoLabels={
  nacimiento:'Acta de Nacimiento',
  matrimonio:'Acta de Matrimonio',
  divorcio:  'Acta de Divorcio',
  defuncion: 'Acta de Defunción'
};

function rcSelTipoActa(tipo, btn){
  _actaTipo=tipo;
  document.querySelectorAll('#mRC-acta .rc-acta-tipo-btn').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  rcCalcActaTotal();
  rcActualizarIndicadorActa();
}

var _OTROS_ESTADOS_ACTA=['Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Estado de México','Guanajuato','Guerrero','Hidalgo','Jalisco','Michoacán','Morelos','Nayarit','Nuevo León','Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas'];

function _rcBuildOtroDropdown(){
  var list=document.getElementById('acta-otro-list');
  if(!list||list.children.length>0)return;
  _OTROS_ESTADOS_ACTA.forEach(function(e){
    var d=document.createElement('div');
    d.textContent=e;
    d.style.cssText='padding:9px 14px;font-size:0.78rem;cursor:pointer;border-bottom:1px solid var(--border-l);transition:background 0.1s;';
    d.onmouseover=function(){this.style.background='var(--gold-pale)';};
    d.onmouseout=function(){this.style.background='';};
    d.onclick=function(){rcSelEstadoActaOtro(e);};
    list.appendChild(d);
  });
}

function rcToggleOtroDropdown(){
  _rcBuildOtroDropdown();
  var dd=document.getElementById('acta-otro-dropdown');
  dd.style.display=(dd.style.display==='none')?'block':'none';
}

function rcSelEstadoActa(estado, btn){
  document.getElementById('acta-otro-dropdown').style.display='none';
  // Todos los pills a gris
  document.getElementById('acta-btn-oaxaca').style.background='#bbb';
  document.getElementById('acta-btn-oaxaca').style.borderColor='#bbb';
  document.getElementById('acta-btn-otro').style.background='#bbb';
  document.getElementById('acta-btn-otro').style.borderColor='#bbb';
  // El seleccionado a verde
  btn.style.background='var(--verde)';btn.style.borderColor='var(--verde)';
  _actaEstado=estado;
  document.getElementById('acta-precio').value='240';
  rcCalcActaTotal();
  rcActualizarIndicadorActa();
}

function rcSelEstadoActaOtro(val){
  if(!val)return;
  document.getElementById('acta-otro-dropdown').style.display='none';
  // Oaxaca a gris, Otro a verde
  document.getElementById('acta-btn-oaxaca').style.background='#bbb';
  document.getElementById('acta-btn-oaxaca').style.borderColor='#bbb';
  document.getElementById('acta-btn-otro').style.background='var(--verde)';
  document.getElementById('acta-btn-otro').style.borderColor='var(--verde)';
  document.getElementById('acta-btn-otro').textContent=val+' ▾';
  _actaEstado=val;
  document.getElementById('acta-precio').value='280';
  rcCalcActaTotal();
  rcActualizarIndicadorActa();
}

function rcActualizarIndicadorActa(){
  var lbl=_actaTipoLabels[_actaTipo]||'';
  var estado=_actaEstado||'';
  var indEl=document.getElementById('acta-tipo-sel');
  var lblEl=document.getElementById('acta-tipo-label');
  if(lbl&&estado){
    lblEl.textContent=lbl+' de '+estado;
    indEl.style.display='block';
  } else if(lbl){
    lblEl.textContent=lbl;
    indEl.style.display='block';
  } else {
    indEl.style.display='none';
  }
}

function rcCalcActaTotal(){
  var p=parseFloat(document.getElementById('acta-precio').value)||0;
  var c=parseInt(document.getElementById('acta-cant').value)||1;
  document.getElementById('acta-total').textContent='$'+fmt(p*c);
}

function rcAdjActa(d){
  var el=document.getElementById('acta-cant');
  el.value=Math.max(1,(parseInt(el.value)||1)+d);
  rcCalcActaTotal();
}

function _rcActaValidar(){
  if(!_actaTipo){toast('Selecciona el tipo de acta','err');return false;}
  if(!_actaEstado){toast('Selecciona el estado','err');return false;}
  var p=parseFloat(document.getElementById('acta-precio').value)||0;
  if(p<=0){toast('El precio debe ser mayor a $0','err');return false;}
  return true;
}

function _rcActaDesc(){
  var lbl=_actaTipoLabels[_actaTipo]||_actaTipo;
  var c=parseInt(document.getElementById('acta-cant').value)||1;
  var p=parseFloat(document.getElementById('acta-precio').value)||0;
  return (c>1?c+'× ':'')+lbl+' — '+_actaEstado+(c>1?' $'+p+'c/u':'');
}

function _rcActaWA(){
  var lbl=_actaTipoLabels[_actaTipo]||_actaTipo;
  var msg=encodeURIComponent(lbl+' — '+_actaEstado);
  var w=window.open('','_blank');
  if(w){w.location.href='https://wa.me/'+RC_WA_NUM+'?text='+msg;}
}

function rcRegistrarActa(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  if(!_rcActaValidar())return;
  var p=parseFloat(document.getElementById('acta-precio').value)||0;
  var c=parseInt(document.getElementById('acta-cant').value)||1;
  var total=p*c;
  var desc=_rcActaDesc();
  var mov={id:'M-'+Date.now(),folioCaja:generarFolioMovCaja(),fecha:hoy(),hora:hora(),descripcion:desc,
    monto:total,tipo:'ingreso',cat:'acta',fuente:'caja',responsable:empNombre()};
  _regMov(mov);
  cerrar('mRegistroCivil');
  _rcActaWA();
  toast('▲ '+desc+' — $'+fmt(total),'ok');
}

function rcActaCarrito(){
  if(!_rcActaValidar())return;
  var p=parseFloat(document.getElementById('acta-precio').value)||0;
  var c=parseInt(document.getElementById('acta-cant').value)||1;
  var total=p*c;
  var desc=_rcActaDesc();
  agregarAlCarrito(desc,total,'acta');
  cerrar('mRegistroCivil');
  _rcActaWA();
  toast('🛒 Agregado — '+desc,'ok');
}

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

// ═══ FINANZAS INTERNAS v2 ═══
// Estructura: D.prestamos = array de objetos con campo "subtipo": 'caja' | 'anticipo'
let FI = { prestamos: [] };
let fiPagoTarget = null;     // id del registro en edición de pago
let fiPagoTipo   = 'caja';   // 'caja' | 'anticipo'
let fiFiltroCaja     = 'todos';
let fiFiltroAnticipo = 'todos';
let fiTabActual      = 'caja';

function initFI() {
  if (!D.prestamos) D.prestamos = [];
  // Migración legacy localStorage
  const oldSaved = localStorage.getItem('lex-fi');
  if (oldSaved) {
    try {
      const old = JSON.parse(oldSaved);
      if (old.prestamos && old.prestamos.length > 0 && D.prestamos.length === 0) {
        D.prestamos = old.prestamos;
        save();
      }
    } catch(e){ registrarError('catch vacio', e); }
    localStorage.removeItem('lex-fi');
  }
  // Migración: normalizar subtipos viejos
  D.prestamos.forEach(p => {
    if (!p.subtipo) p.subtipo = (p.tipo === 'cliente') ? 'anticipo' : 'caja';
    if (!p.notasSeguimiento) p.notasSeguimiento = [];
  });
  FI.prestamos = D.prestamos;
  // Poblar datalists con datos del directorio y carpetas
  _poblarDatalistsAnticipo();
}

// ── MEJORA 3: ALERTA AL ABRIR LA APP ──────────────────────────────────
function mostrarAlertaFIStartup() {
  if (!D.prestamos || !D.prestamos.length) return;
  const hoyStr = hoy();
  const vencidosCaja = D.prestamos.filter(p =>
    p.subtipo === 'caja' && p.estado !== 'saldado' && p.fechaDev && p.fechaDev < hoyStr
  );
  const vencidosAnticipo = D.prestamos.filter(p =>
    p.subtipo === 'anticipo' && p.estado !== 'saldado' && p.fechaDev && p.fechaDev < hoyStr
  );
  const pendCaja = D.prestamos.filter(p => p.subtipo === 'caja' && p.estado !== 'saldado');
  const pendAnticipo = D.prestamos.filter(p => p.subtipo === 'anticipo' && p.estado !== 'saldado');
  if (!pendCaja.length && !pendAnticipo.length) return;
  const totalPend = pendCaja.reduce((a,p)=>a+(p.monto-(p.pagos||[]).reduce((b,pg)=>b+pg.monto,0)),0)
    + pendAnticipo.reduce((a,p)=>a+(p.monto-(p.pagos||[]).reduce((b,pg)=>b+pg.monto,0)),0);
  let lineas = [];
  if (pendCaja.length) lineas.push(`🏦 ${pendCaja.length} préstamo${pendCaja.length>1?'s':''} a caja sin saldar`);
  if (pendAnticipo.length) lineas.push(`📋 ${pendAnticipo.length} pago${pendAnticipo.length>1?'s':''} de derechos por cobrar`);
  if (vencidosCaja.length + vencidosAnticipo.length > 0)
    lineas.push(`⚠️ ${vencidosCaja.length + vencidosAnticipo.length} registro${(vencidosCaja.length+vencidosAnticipo.length)>1?'s':''} con fecha límite vencida`);
  lineas.push(`💵 Total por recuperar: ${fmtMx(totalPend)}`);
  const msgToast = lineas[0] + (vencidosCaja.length+vencidosAnticipo.length > 0 ? ' · ⚠️ hay vencidos' : '');
  // Toast rápido
  toast('💰 Finanzas: ' + msgToast, vencidosCaja.length+vencidosAnticipo.length > 0 ? 'err' : 'ok');
}

// ── MEJORA 1: AGREGAR NOTA DE SEGUIMIENTO ─────────────────────────────
async function agregarNotaFI(id) {
  const p = FI.prestamos.find(x => x.id === id);
  if (!p) return;
  const texto = await pedirTexto({
    titulo: '📝 Nota de seguimiento',
    mensaje: `Préstamo de ${escapeHtml(p.prestamista)} — $${fmtMx(p.monto)}\nAgrega una nota sobre el estado o acuerdo:`,
    placeholder: 'Ej: Acordó pagar el viernes por transferencia...',
    validar: v => v.trim().length > 0 ? null : 'Escribe algo en la nota'
  });
  if (!texto) return;
  if (!p.notasSeguimiento) p.notasSeguimiento = [];
  p.notasSeguimiento.push({ fecha: hoy(), texto: texto.trim() });
  saveFI(); renderCajaFI();
  toast('Nota guardada ✓');
}

function _poblarDatalistsAnticipo() {
  // Clientes del directorio
  const dlC = document.getElementById('anti-cliente-list');
  if (dlC && D.directorio) {
    dlC.innerHTML = D.directorio.map(c=>`<option value="${escH(c.nombre)}">`).join('');
  }
  // Expedientes del control de archivo
  const dlE = document.getElementById('anti-exp-list');
  if (dlE && D.carpetas) {
    dlE.innerHTML = D.carpetas.map(c=>`<option value="${c.num} — ${escH(c.cliente||'')}">` ).join('');
  }
}

function filtrarClientesAnticipo() { /* datalist nativo lo hace solo */ }
function filtrarExpedientesAnticipo() { /* datalist nativo */ }

function saveFI() {
  D.prestamos = FI.prestamos;
  save();
  actualizarStatsFI();
}

// ── STATS ──────────────────────────────────────────────────────────────
function actualizarStatsFI() {
  const ps = FI.prestamos;
  const cajaActivos     = ps.filter(p => p.subtipo==='caja'     && p.estado!=='saldado');
  const antiActivos     = ps.filter(p => p.subtipo==='anticipo' && p.estado!=='saldado');
  const totalPagado     = ps.reduce((a,p)=>(p.pagos||[]).reduce((b,pg)=>b+pg.monto,a),0);
  const totalPrestado   = ps.reduce((a,p)=>a+p.monto,0);
  const saldoTotal      = totalPrestado - totalPagado;

  const e = id => document.getElementById(id);
  if(e('fi-cnt-caja'))       e('fi-cnt-caja').textContent       = cajaActivos.length;
  if(e('fi-cnt-cliente'))    e('fi-cnt-cliente').textContent    = antiActivos.length;
  if(e('fi-saldo-pend'))     e('fi-saldo-pend').textContent     = '$'+fmtM2(saldoTotal);
  if(e('fi-total-recuperado')) e('fi-total-recuperado').textContent = '$'+fmtM2(totalPagado);
  const badge = e('badgeFI');
  const tot = cajaActivos.length + antiActivos.length;
  if(badge){ badge.style.display = tot>0?'':'none'; badge.textContent=tot; }
}

// ── TABS ───────────────────────────────────────────────────────────────
function fiCambiarTab(tab) {
  fiTabActual = tab;
  const esCaja = tab==='caja';
  document.getElementById('fi-sec-caja').style.display    = esCaja ? '' : 'none';
  document.getElementById('fi-sec-anticipo').style.display = esCaja ? 'none' : '';
  document.getElementById('fi-tab-caja').style.cssText    = esCaja
    ? 'flex:1;padding:14px;border-radius:var(--radius);border:2px solid var(--gold);background:var(--gold);color:#fff;font-family:Fraunces,serif;font-size:0.95rem;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;justify-content:center;gap:8px;'
    : 'flex:1;padding:14px;border-radius:var(--radius);border:2px solid var(--border-l);background:var(--surface);color:var(--muted);font-family:Fraunces,serif;font-size:0.95rem;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;justify-content:center;gap:8px;';
  document.getElementById('fi-tab-anticipo').style.cssText = esCaja
    ? 'flex:1;padding:14px;border-radius:var(--radius);border:2px solid var(--border-l);background:var(--surface);color:var(--muted);font-family:Fraunces,serif;font-size:0.95rem;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;justify-content:center;gap:8px;'
    : 'flex:1;padding:14px;border-radius:var(--radius);border:2px solid var(--azul);background:var(--azul);color:#fff;font-family:Fraunces,serif;font-size:0.95rem;cursor:pointer;transition:all 0.18s;display:flex;align-items:center;justify-content:center;gap:8px;';
  if(tab==='anticipo') renderResumenClientes();
}

// ── RENDER CAJA ────────────────────────────────────────────────────────
function renderFI() { renderCajaFI(); renderAnticipoFI(); actualizarStatsFI(); }

function setFIFiltroCaja(f,el) {
  fiFiltroCaja = f;
  document.querySelectorAll('#fi-sec-caja .fbtn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); renderCajaFI();
}
function setFIFiltroAnticipo(f,el) {
  fiFiltroAnticipo = f;
  document.querySelectorAll('#fi-sec-anticipo .fbtn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); renderAnticipoFI(); renderResumenClientes();
}

function renderCajaFI() {
  const tbody = document.getElementById('tbCajaBody');
  if(!tbody) return;
  let ps = FI.prestamos.filter(p=>p.subtipo==='caja');
  if(fiFiltroCaja!=='todos') ps = ps.filter(p=>p.estado===fiFiltroCaja);
  const vacio = document.getElementById('fi-caja-vacio');
  if(!ps.length){ tbody.innerHTML=''; if(vacio) vacio.style.display=''; return; }
  if(vacio) vacio.style.display='none';
  tbody.innerHTML = ps.map(p=>{
    const pagado = (p.pagos||[]).reduce((a,pg)=>a+pg.monto,0);
    const saldo  = p.monto - pagado;
    const estadoTag = p.estado==='saldado'
      ? '<span class="tag tag-v">✅ Saldado</span>'
      : p.estado==='parcial'
        ? '<span class="tag tag-a">🔄 Parcial</span>'
        : '<span class="tag tag-r">⏳ Pendiente</span>';
    const devAlert = p.fechaDev && p.fechaDev < hoy() && p.estado!=='saldado'
      ? ' <span style="color:var(--rojo);font-size:0.7rem;">⚠ Vencido</span>' : '';
    const accPago = p.estado!=='saldado'
      ? `<button class="btn btn-success btn-sm" onclick="abrirModalPago('${p.id}','caja')">💳 Pago</button> ` : '';
    const notasHtml = (p.notasSeguimiento||[]).length
      ? `<div style="font-size:0.68rem;color:var(--muted);margin-top:3px;font-style:italic;">📝 ${escH((p.notasSeguimiento[p.notasSeguimiento.length-1]||{}).texto||'')}</div>` : '';
    return `<tr>
      <td class="mono">${p.fecha}</td>
      <td style="font-weight:600;">${escH(p.prestamista)}${notasHtml}</td>
      <td style="max-width:160px;font-size:0.74rem;">${escH(p.concepto||'—')}</td>
      <td class="monto mono egr">${fmtMx(p.monto)}</td>
      <td class="monto mono ing">${fmtMx(pagado)}</td>
      <td class="monto mono ${saldo>0?'egr':''}">${fmtMx(saldo)}</td>
      <td class="mono" style="font-size:0.72rem;">${p.fechaDev||'—'}${devAlert}</td>
      <td>${estadoTag}</td>
      <td style="white-space:nowrap;">${accPago}<button class="btn btn-ghost btn-sm" onclick="agregarNotaFI('${p.id}')" title="Agregar nota de seguimiento">📝</button> <button class="btn btn-ghost btn-sm" onclick="verHistorialPagos('${p.id}')">📋</button> <button class="btn btn-ghost btn-sm" style="color:var(--rojo);" onclick="eliminarFI('${p.id}')">✕</button></td>
    </tr>`;
  }).join('');
}

// ── RENDER ANTICIPO ────────────────────────────────────────────────────
function renderAnticipoFI() {
  const tbody = document.getElementById('tbAnticipoBody');
  if(!tbody) return;
  let ps = FI.prestamos.filter(p=>p.subtipo==='anticipo');
  if(fiFiltroAnticipo!=='todos') ps = ps.filter(p=>p.estado===fiFiltroAnticipo);
  const vacio = document.getElementById('fi-anticipo-vacio');
  if(!ps.length){ tbody.innerHTML=''; if(vacio) vacio.style.display=''; return; }
  if(vacio) vacio.style.display='none';
  tbody.innerHTML = ps.map(p=>{
    const reemb  = (p.pagos||[]).reduce((a,pg)=>a+pg.monto,0);
    const porCob = p.monto - reemb;
    const estadoTag = p.estado==='saldado'
      ? '<span class="tag tag-v">✅ Saldado</span>'
      : p.estado==='parcial'
        ? '<span class="tag tag-a">🔄 Parcial</span>'
        : '<span class="tag tag-r">⏳ Pendiente</span>';
    const devAlert = p.fechaDev && p.fechaDev < hoy() && p.estado!=='saldado'
      ? ' <span style="color:var(--rojo);font-size:0.68rem;font-weight:700;">⚠ Vencido</span>' : '';
    const expLink = p.expediente
      ? `<span class="tag tag-b" style="cursor:pointer;" onclick="irAExpediente('${escH(p.expediente)}')" title="Ver expediente">🗂 ${escH(p.expediente)}</span>` : '—';
    const recLink = p.recibo
      ? `<span class="mono" style="font-size:0.72rem;">🧾 ${escH(p.recibo)}</span>` : '—';
    const accPago = p.estado!=='saldado'
      ? `<button class="btn btn-success btn-sm" onclick="abrirModalPago('${p.id}','anticipo')">💳 Cobrar</button> ` : '';
    const histBtn = (p.pagos||[]).length
      ? `<button class="btn btn-primary btn-sm" onclick="verHistorialPagos('${p.id}')" title="Ver historial de reembolsos" style="background:var(--azul);">📋 ${(p.pagos||[]).length}</button> `
      : `<button class="btn btn-ghost btn-sm" onclick="verHistorialPagos('${p.id}')" title="Sin pagos aún">📋</button> `;
    return `<tr>
      <td class="mono">${p.fecha}${devAlert}</td>
      <td style="font-weight:600;">${escH(p.cliente||p.deudor||'—')}</td>
      <td>${expLink}</td>
      <td>${recLink}</td>
      <td style="font-size:0.74rem;">${escH(p.dependencia||'—')}</td>
      <td style="max-width:160px;font-size:0.74rem;">${escH(p.concepto||'—')}</td>
      <td class="monto mono egr">${fmtMx(p.monto)}</td>
      <td class="monto mono ing">${fmtMx(reemb)}</td>
      <td class="monto mono ${porCob>0?'egr':''}">${fmtMx(porCob)}</td>
      <td>${estadoTag}</td>
      <td style="white-space:nowrap;">${accPago}${histBtn}<button class="btn btn-ghost btn-sm" style="color:var(--rojo);" onclick="eliminarFI('${p.id}')">✕</button></td>
    </tr>`;
  }).join('');
}

// ── RESUMEN POR CLIENTE ────────────────────────────────────────────────
function renderResumenClientes() {
  const tbody = document.getElementById('tbResumenClientesBody');
  if(!tbody) return;
  const ps = FI.prestamos.filter(p=>p.subtipo==='anticipo');
  const mapa = {};
  ps.forEach(p=>{
    const nom = p.cliente||p.deudor||'Sin nombre';
    if(!mapa[nom]) mapa[nom]={total:0,reemb:0,cnt:0};
    mapa[nom].total += p.monto;
    mapa[nom].reemb += (p.pagos||[]).reduce((a,pg)=>a+pg.monto,0);
    mapa[nom].cnt++;
  });
  const keys = Object.keys(mapa);
  if(!keys.length){ tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:16px;">Sin anticipos a clientes.</td></tr>'; return; }
  tbody.innerHTML = keys.sort().map(nom=>{
    const d = mapa[nom];
    const por = d.total - d.reemb;
    return `<tr>
      <td style="font-weight:600;">${escH(nom)}</td>
      <td class="monto mono egr">${fmtMx(d.total)}</td>
      <td class="monto mono ing">${fmtMx(d.reemb)}</td>
      <td class="monto mono ${por>0?'egr':''}">${fmtMx(por)}</td>
      <td class="mono" style="text-align:center;">${d.cnt}</td>
    </tr>`;
  }).join('');
}

// ── LINK a expediente ──────────────────────────────────────────────────
function irAExpediente(numStr) {
  const num = numStr.split('—')[0].trim();
  ir('carpetas');
  setTimeout(()=>{
    const el = document.getElementById('carpQ');
    if(el){ el.value=num; if(typeof renderCarp==='function') renderCarp(); }
  },300);
}

// ── MODALES: ABRIR ─────────────────────────────────────────────────────
function abrirModalCaja() {
  document.getElementById('caja-prestamista').value      = '';
  document.getElementById('caja-fecha').value            = hoy();
  document.getElementById('caja-monto').value            = '';
  document.getElementById('caja-fecha-dev').value        = '';
  document.getElementById('caja-concepto').value         = '';
  document.getElementById('caja-nota-seguimiento').value = '';
  document.getElementById('modal-prestamo-caja').classList.add('show');
}

function abrirModalAnticipo() {
  _poblarDatalistsAnticipo();
  document.getElementById('anti-cliente').value     = '';
  document.getElementById('anti-dependencia').value = '';
  document.getElementById('anti-expediente').value  = '';
  document.getElementById('anti-recibo').value      = '';
  document.getElementById('anti-monto').value       = '';
  document.getElementById('anti-fecha').value       = hoy();
  document.getElementById('anti-fecha-dev').value   = '';
  document.getElementById('anti-concepto').value    = '';
  document.getElementById('modal-anticipo-cliente').classList.add('show');
}

// ── ABRIR MODAL PAGO ───────────────────────────────────────────────────
function abrirModalPago(id, tipo) {
  const p = FI.prestamos.find(x=>x.id===id);
  if(!p) return;
  fiPagoTarget = id;
  fiPagoTipo   = tipo || p.subtipo || 'caja';
  const pagado = (p.pagos||[]).reduce((a,pg)=>a+pg.monto,0);
  const saldo  = p.monto - pagado;
  const nombre = tipo==='caja'
    ? (p.prestamista + ' → Caja')
    : (p.cliente||p.deudor||'Cliente');
  const titulo = tipo==='anticipo' ? '💳 Registrar Reembolso del Cliente' : '💳 Registrar Devolución a Prestamista';
  document.getElementById('pago-fi-titulo').textContent = titulo;
  document.getElementById('pago-fi-nombre').textContent = nombre;
  document.getElementById('pago-fi-saldo').textContent  = fmtMx(saldo);
  document.getElementById('pago-fi-fecha').value        = hoy();
  document.getElementById('pago-fi-monto').value        = '';
  document.getElementById('pago-fi-nota').value         = '';
  // La opción de registrar en caja solo aplica cuando el cliente reembolsa al despacho
  const optCaja = document.getElementById('pago-fi-caja-opt');
  if(optCaja) optCaja.style.display = tipo==='anticipo' ? '' : 'none';
  document.getElementById('modal-pago-fi').classList.add('show');
}

function cerrarModalPago() {
  document.getElementById('modal-pago-fi').classList.remove('show');
  fiPagoTarget = null;
}

// ── GUARDAR ────────────────────────────────────────────────────────────
function guardarPrestamoCaja() {
  const prest = document.getElementById('caja-prestamista').value.trim();
  const monto = parseFloat(document.getElementById('caja-monto').value)||0;
  const fecha = document.getElementById('caja-fecha').value;
  const conc  = document.getElementById('caja-concepto').value.trim();
  const fdev  = document.getElementById('caja-fecha-dev').value;
  const nota  = document.getElementById('caja-nota-seguimiento').value.trim();
  if(!prest){ toast('Escribe quién prestó el dinero','err'); return; }
  if(monto<=0){ toast('Ingresa un monto válido','err'); return; }
  FI.prestamos.unshift({
    id: Date.now().toString(), subtipo:'caja', tipo:'caja',
    prestamista:prest, deudor:'Caja Despacho',
    fecha, monto, concepto:conc, fechaDev:fdev,
    notasSeguimiento: nota ? [{fecha:hoy(), texto:nota}] : [],
    estado:'pendiente', pagos:[]
  });
  saveFI(); cerrar('modal-prestamo-caja'); renderCajaFI();
  toast('Préstamo a caja registrado ✓');
}

function guardarAnticipo() {
  const cliente    = document.getElementById('anti-cliente').value.trim();
  const dep        = document.getElementById('anti-dependencia').value.trim();
  const exp        = document.getElementById('anti-expediente').value.trim();
  const recibo     = document.getElementById('anti-recibo').value.trim();
  const monto      = parseFloat(document.getElementById('anti-monto').value)||0;
  const fecha      = document.getElementById('anti-fecha').value;
  const fdev       = document.getElementById('anti-fecha-dev').value;
  const pagador    = document.getElementById('anti-pagador').value;
  const conc       = document.getElementById('anti-concepto').value.trim();
  if(!cliente){ toast('Escribe el nombre del cliente','err'); return; }
  if(monto<=0){ toast('Ingresa un monto válido','err'); return; }
  FI.prestamos.unshift({
    id: Date.now().toString(), subtipo:'anticipo', tipo:'cliente',
    cliente, deudor:cliente, prestamista:pagador,
    dependencia:dep, expediente:exp, recibo,
    fecha, monto, concepto:conc, fechaDev:fdev,
    estado:'pendiente', pagos:[]
  });
  saveFI(); cerrar('modal-anticipo-cliente'); renderAnticipoFI(); renderResumenClientes();
  toast('Anticipo registrado ✓');
}

function guardarPagoFI() {
  if(!fiPagoTarget) return;
  const p = FI.prestamos.find(x=>x.id===fiPagoTarget);
  if(!p) return;
  const monto = parseFloat(document.getElementById('pago-fi-monto').value)||0;
  if(monto<=0){ toast('Ingresa un monto válido','err'); return; }
  const fecha  = document.getElementById('pago-fi-fecha').value;
  const nota   = document.getElementById('pago-fi-nota').value.trim();
  if(!p.pagos) p.pagos=[];
  p.pagos.push({fecha,monto,nota});
  const pagado = p.pagos.reduce((a,pg)=>a+pg.monto,0);
  p.estado = pagado >= p.monto ? 'saldado' : 'parcial';
  // Si es anticipo de cliente y el usuario quiere registrar en caja:
  const chkCaja = document.getElementById('pago-fi-a-caja');
  if(fiPagoTipo==='anticipo' && chkCaja && chkCaja.checked) {
    const cliente = p.cliente||p.deudor||'Cliente';
    const desc    = `REEMBOLSO DE ANTICIPO — ${cliente}${p.expediente?' Exp.'+p.expediente:''}`;
    const mov = {
      id:'M-'+Date.now(),folioCaja:generarFolioMovCaja(fecha), fecha, hora:hora(),
      descripcion:desc, monto, tipo:'ingreso',
      cat:'reembolso', fuente:'finanzas', responsable: p.prestamista||empNombre()
    };
    _registrarMovimiento(mov);
    setTimeout(()=>syncEstadoSupabaseDebounced(),100);
    toast(`✅ Reembolso de ${fmtMx(monto)} registrado y sumado a la caja`);
  } else {
    toast(`✅ Pago de ${fmtMx(monto)} registrado`);
  }
  saveFI(); cerrarModalPago();
  renderCajaFI(); renderAnticipoFI(); renderResumenClientes();
  save();
}

// ── HISTORIAL ──────────────────────────────────────────────────────────
function cerrarHistorialPagos() {
  const card = document.getElementById('fi-historial-pagos-card');
  if (card) card.style.display = 'none';
}

function verHistorialPagos(id) {
  const p = FI.prestamos.find(x=>x.id===id);
  if(!p) return;
  const card = document.getElementById('fi-historial-pagos-card');
  document.getElementById('fi-hpago-nombre').textContent = p.cliente||p.prestamista||p.deudor||'—';
  const tbody = document.getElementById('fi-hpago-body');
  if(!p.pagos||!p.pagos.length) {
    tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:16px;">Sin pagos registrados aún.</td></tr>';
  } else {
    tbody.innerHTML = p.pagos.map((pg,idx)=>`<tr>
      <td class="mono">${pg.fecha}</td>
      <td>${escH(pg.nota||'Pago')}</td>
      <td class="monto mono ing">${fmtMx(pg.monto)}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="editarPagoFI('${p.id}',${idx})" title="Editar monto">✏️</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--rojo);" onclick="eliminarPagoFI('${p.id}',${idx})" title="Eliminar pago">✕</button>
      </td>
    </tr>`).join('');
  }
  // Actualizar thead para incluir columna acciones
  const thead = card.querySelector('thead tr');
  if (thead && thead.children.length < 4) {
    const th = document.createElement('th'); th.textContent = 'Acciones'; thead.appendChild(th);
  }
  card.style.display=''; card.scrollIntoView({behavior:'smooth'});
}

async function editarPagoFI(id, idx) {
  const p = FI.prestamos.find(x=>x.id===id);
  if(!p||!p.pagos[idx]) return;
  const pg = p.pagos[idx];
  const nuevoMonto = await pedirTexto({
    titulo: '✏️ Editar monto del pago',
    mensaje: `Pago del ${pg.fecha}\nMonto actual: ${fmtMx(pg.monto)}\n\nIngresa el monto correcto:`,
    valorInicial: String(pg.monto),
    placeholder: '0.00',
    validar: v => parseFloat(v) > 0 ? null : 'Ingresa un monto válido'
  });
  if (!nuevoMonto) return;
  const montoNuevo = parseFloat(nuevoMonto);
  if (!montoNuevo || montoNuevo <= 0) return;
  pg.monto = montoNuevo;
  // Recalcular estado
  const totalPagado = p.pagos.reduce((a,pg2)=>a+pg2.monto, 0);
  p.estado = totalPagado >= p.monto ? 'saldado' : totalPagado > 0 ? 'parcial' : 'pendiente';
  saveFI(); verHistorialPagos(id); renderCajaFI(); renderAnticipoFI();
  toast('Monto actualizado ✓');
}

async function eliminarPagoFI(id, idx) {
  const p = FI.prestamos.find(x=>x.id===id);
  if(!p||!p.pagos[idx]) return;
  const pg = p.pagos[idx];
  const ok = await confirmarBonito({
    titulo: 'Eliminar pago',
    mensaje: `¿Eliminar el pago de ${fmtMx(pg.monto)} del ${pg.fecha}?`,
    btnSi: 'Sí, eliminar',
    btnNo: 'Cancelar',
    peligro: true
  });
  if (!ok) return;
  p.pagos.splice(idx, 1);
  const totalPagado = p.pagos.reduce((a,pg2)=>a+pg2.monto, 0);
  p.estado = totalPagado >= p.monto ? 'saldado' : totalPagado > 0 ? 'parcial' : 'pendiente';
  saveFI(); verHistorialPagos(id); renderCajaFI(); renderAnticipoFI();
  toast('Pago eliminado ✓');
}

// ── ELIMINAR ───────────────────────────────────────────────────────────
async function eliminarFI(id) {
  const p = FI.prestamos.find(x => x.id === id);
  if (!p) return;
  const nombre = p.subtipo === 'caja'
    ? `Préstamo de ${p.prestamista} por ${fmtMx(p.monto)}`
    : `Pago de derechos — ${p.cliente||p.deudor||'Cliente'} por ${fmtMx(p.monto)}`;
  const ok = await confirmarBonito({
    titulo: 'Eliminar registro',
    mensaje: `¿Eliminar "${nombre}"?\n\nEsta acción no se puede deshacer.`,
    btnSi: 'Sí, eliminar',
    btnNo: 'Cancelar',
    peligro: true
  });
  if (!ok) return;
  FI.prestamos = FI.prestamos.filter(p => p.id !== id);
  saveFI(); renderCajaFI(); renderAnticipoFI(); renderResumenClientes();
  toast('Registro eliminado');
}

// ── EXPORTAR CSV ───────────────────────────────────────────────────────
function exportarFICSV(subtipo) {
  const ps = FI.prestamos.filter(p=>p.subtipo===subtipo);
  let headers, rows;
  if(subtipo==='caja') {
    headers = ['Fecha','Prestamista','Concepto','Monto','Pagado','Saldo','Dev.Esperada','Estado'];
    rows = ps.map(p=>{
      const pagado=(p.pagos||[]).reduce((a,pg)=>a+pg.monto,0);
      return [p.fecha,p.prestamista,p.concepto,p.monto,pagado,p.monto-pagado,p.fechaDev||'',p.estado];
    });
  } else {
    headers = ['Fecha','Cliente','Expediente','Recibo','Dependencia','Concepto','Pagado x Despacho','Reembolsado','Por Cobrar','Estado'];
    rows = ps.map(p=>{
      const reemb=(p.pagos||[]).reduce((a,pg)=>a+pg.monto,0);
      return [p.fecha,p.cliente||p.deudor,p.expediente||'',p.recibo||'',p.dependencia||'',p.concepto,p.monto,reemb,p.monto-reemb,p.estado];
    });
  }
  const csv = [headers.join(','), ...rows.map(r=>r.map(v=>{
    const s=String(v||'').replace(/"/g,'""');
    return s.includes(',')||s.includes('"')?`"${s}"`:s;
  }).join(','))].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download=`FinanzasInternas_${subtipo}_${hoy()}.csv`; a.click();
  toast('CSV exportado ✓');
}

// ── HELPERS ────────────────────────────────────────────────────────────
function escH(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtMx(v){ return '$'+(+v||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtM2(v){ return (+(v||0)).toLocaleString('es-MX',{minimumFractionDigits:0}); }
function fmtFIMonto(el){ el.value=el.value.replace(/[^0-9.]/g,''); }

// ═══ SINCRONIZACIÓN CON GOOGLE SHEETS v18 — API append (no sobreescribe) ═══
// Usa values:append para AGREGAR filas al final. Nunca sobreescribe datos.
// Columnas: A=Encabezado día / vacío  B=Descripción  C=Ingreso  D=Egreso  E=Responsable  F=Categoría  G=ID

let syncQueue = [];
let syncEnProgreso = false;

// formatearFechaContabilidad() — definida más abajo (única copia activa).

// Formato compatible (lo usaba syncMovimientoASheets para fechas)
function formatearFechaContabilidad(fechaISO){
  const dias  = ["DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO"];
  const meses = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  const f = new Date(fechaISO + "T12:00:00");
  return `${dias[f.getDay()]} ${String(f.getDate()).padStart(2,"0")} ${meses[f.getMonth()]} ${f.getFullYear()}`;
}

// ─── Exportar directorio CSV ─────────────────────────────────────
function exportarDirectorioCSV(){
  const cols=['nombre','tipo','tel','tel2','desc','pob','email','rfc'];
  const headers=['Nombre Completo','Tipo/Relación','Tel. Principal','Tel. Alternativo','Descripción','Población','Correo','RFC'];
  const rows=[headers.join(','),...D.directorio.map(c=>cols.map(k=>{
    const v=(c[k]||'').replace(/"/g,'""');
    return v.includes(',')||v.includes('"')?`"${v}"`:v;
  }).join(','))];
  const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='Directorio_LEX_'+hoy()+'.csv';a.click();
  toast('Directorio exportado ✓','ok');
}

// ─── Background sync (legacy eliminado tras migración a Supabase) ────────
// La versión stub que dispara syncEstadoSupabaseDebounced está definida arriba.
// El sistema de cola persiste offline y drena automáticamente al reconectar:
// Supabase maneja sus propios reintentos en el SDK.

// ─── Cerrar Caja ─────────────────────────────────────────────────
function cerrarCaja() {
  if (cajaBloqueada()) { toast('La caja ya está cerrada. Se habilitará mañana.', 'err'); return; }
  const m = getMovHoy();

  // ── CIERRE SIN MOVIMIENTOS ──────────────────────────────────────
  // Si no hubo movimientos en el día, igualmente se registra un cierre formal
  // con la leyenda "Sin movimientos contables durante la jornada".
  if (!m.length) {
    if (!confirm(
      '¿Cerrar caja de hoy SIN MOVIMIENTOS?\n\n' +
      'No se registró ningún ingreso ni egreso durante la jornada.\n\n' +
      'Se registrará el día con la leyenda:\n' +
      '"Sin movimientos contables durante la jornada"\n\n' +
      '⚠ Una vez cerrada NO se puede reabrir hasta mañana.'
    )) return;
    const cierreSM = {
      fecha: hoy(), hora: hora(),
      ingresos: 0, egresos: 0, saldo: 0,
      movimientos: 0,
      sinMovimientos: true,
      leyenda: 'Sin movimientos contables durante la jornada'
    };
    if (!D.cierres) D.cierres = [];
    D.cierres.unshift(cierreSM);
    if (!D.saldoAcumulado) D.saldoAcumulado = 0;
    // No hay saldo nuevo que acumular — el saldo acumulado de días anteriores se conserva intacto.
    marcarCajaCerrada();
    save();
    aplicarEstadoCierre();
    toast('🔒 Caja cerrada — Sin movimientos contables durante la jornada');
    syncEstadoSupabaseDebounced();
    
    return;
  }

  const ing  = m.filter(x => x.tipo === 'ingreso').reduce((s,x) => s + x.monto, 0);
  const egr  = m.filter(x => x.tipo === 'egreso').reduce((s,x)  => s + x.monto, 0);
  const saldo = ing - egr;
  const signo = saldo >= 0 ? '' : '-';

  if (!confirm(`¿Cerrar caja de hoy?\n\nIngresos:  $${fmt(ing)}\nEgresos:   $${fmt(egr)}\nSALDO:     $${fmt(saldo)}\n\n⚠ Una vez cerrada NO se puede reabrir hasta mañana.\n\nEl estado se sincronizará con Supabase.`)) return;

  const cierre = { fecha: hoy(), hora: hora(), ingresos: ing, egresos: egr, saldo, movimientos: m.length };
  D.cierres.unshift(cierre);
  // Acumular saldo del día (el corte de caja es independiente y lo resetea cuando se hace)
  if (!D.saldoAcumulado) D.saldoAcumulado = 0;
  D.saldoAcumulado += saldo;
  marcarCajaCerrada();
  save();
  aplicarEstadoCierre();
  toast(`🔒 Caja cerrada — Saldo del día: $${fmt(saldo)}`);
  syncEstadoSupabaseDebounced();
}

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
function _ymdAddDays(ymd, dias) {
  // ymd = "YYYY-MM-DD" — suma `dias` (puede ser negativo) y regresa "YYYY-MM-DD"
  const [y, m, d] = ymd.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.getFullYear() + '-' +
         String(fecha.getMonth() + 1).padStart(2, '0') + '-' +
         String(fecha.getDate()).padStart(2, '0');
}

// ═══ LIMPIEZA DE CIERRES DUPLICADOS ═══════════════════════════════
// Detecta y elimina cierres duplicados del mismo día.
// Mantiene solo el más reciente (por hora). Si dos tienen misma hora,
// prioriza: corte de caja > cierre normal > cierre sinMovimientos.
// Esta función es segura: solo se ejecuta si encuentra duplicados reales.
function limpiarCierresDuplicados(silencioso=false) {
  if (!D || !Array.isArray(D.cierres) || D.cierres.length === 0) return 0;

  // Agrupar cierres por fecha
  const porFecha = {};
  (D.cierres || []).forEach((c, i) => {
    if (!c || !c.fecha) return;
    if (!porFecha[c.fecha]) porFecha[c.fecha] = [];
    porFecha[c.fecha].push({ cierre: c, idxOriginal: i });
  });

  // Detectar fechas con duplicados
  const fechasDuplicadas = Object.keys(porFecha).filter(f => porFecha[f].length > 1);
  if (!fechasDuplicadas.length) return 0;

  // Para cada fecha duplicada, decidir cuál conservar
  const idsAEliminar = new Set();
  fechasDuplicadas.forEach(fecha => {
    const lista = porFecha[fecha];

    // Ordenar por prioridad: corte > normal > sinMov; dentro mismo tipo: hora desc
    lista.sort((a, b) => {
      // Prioridad por tipo (menor número = mayor prioridad)
      const prioA = a.cierre.esCorte ? 0 : (a.cierre.sinMovimientos ? 2 : 1);
      const prioB = b.cierre.esCorte ? 0 : (b.cierre.sinMovimientos ? 2 : 1);
      if (prioA !== prioB) return prioA - prioB;

      // Misma prioridad → más completo (con más datos) gana
      const completA = (a.cierre.ingresos || 0) + (a.cierre.egresos || 0);
      const completB = (b.cierre.ingresos || 0) + (b.cierre.egresos || 0);
      if (completA !== completB) return completB - completA;

      // Mismo nivel de completitud → hora más tardía gana
      const horaA = a.cierre.hora || '00:00';
      const horaB = b.cierre.hora || '00:00';
      return horaB.localeCompare(horaA);
    });

    // Conservar el primero (mejor), marcar el resto para eliminar
    for (let i = 1; i < lista.length; i++) {
      idsAEliminar.add(lista[i].idxOriginal);
    }
  });

  if (!idsAEliminar.size) return 0;

  // Filtrar el array
  const original = D.cierres.length;
  D.cierres = D.cierres.filter((c, i) => !idsAEliminar.has(i));
  const eliminados = original - D.cierres.length;

  if (!silencioso) {
    console.log('[limpiarCierresDuplicados] Eliminados ' + eliminados + ' cierres duplicados de ' + fechasDuplicadas.length + ' fecha(s).');
  }

  // Persistir cambio
  try { if (typeof save === 'function') save(); } catch(e){ registrarError('catch vacio', e); }

  return eliminados;
}

function autoRegistrarDiasSinActividad() {
  if (!D || !Array.isArray(D.cierres) && D.cierres !== undefined) return;
  if (!D.cierres) D.cierres = [];

  const hoyStr = hoy();
  const ayerStr = _ymdAddDays(hoyStr, -1);

  // ── Determinar fecha de inicio del barrido ───────────────────────
  // Tomar la fecha más reciente entre: último cierre registrado y primer movimiento.
  // Si hay cierres → empezar el día siguiente al último cierre.
  // Si no hay cierres pero sí movimientos → empezar desde el primer movimiento.
  // Si no hay nada → no hacer nada.
  const fechasCierres = (D.cierres || [])
    .map(c => c && c.fecha)
    .filter(Boolean)
    .sort();
  const fechasMovs = (D.movimientos || [])
    .map(m => m && m.fecha)
    .filter(Boolean)
    .sort();

  let fechaInicio = null;
  if (fechasCierres.length) {
    // Empezar el día siguiente al último cierre
    fechaInicio = _ymdAddDays(fechasCierres[fechasCierres.length - 1], 1);
  } else if (fechasMovs.length) {
    // Sin cierres previos: empezar desde el primer movimiento registrado
    fechaInicio = fechasMovs[0];
  } else {
    // Sin datos previos: no generar nada
    return;
  }

  // Si la fecha de inicio ya es hoy o futura, no hay días anteriores que cubrir
  if (fechaInicio > ayerStr) return;

  // ── Sets para verificación rápida ───────────────────────────────
  const setCierres = new Set((D.cierres || []).map(c => c && c.fecha).filter(Boolean));
  const setFechasConMovs = new Set((D.movimientos || []).map(m => m && m.fecha).filter(Boolean));

  // ── Iterar día por día desde fechaInicio hasta ayer ─────────────
  let cursor = fechaInicio;
  let registrados = 0;
  const nuevosCierres = [];

  // Tope de seguridad: máximo 730 iteraciones (~2 años) para evitar bucles patológicos
  let safety = 0;
  while (cursor <= ayerStr && safety < 730) {
    safety++;
    // Saltar fechas con cierre ya registrado (cualquier tipo)
    // Saltar fechas que sí tuvieron movimientos (deben cerrarse manualmente)
    if (!setCierres.has(cursor) && !setFechasConMovs.has(cursor)) {
      const cierreAuto = {
        fecha: cursor,
        hora: '23:59',
        ingresos: 0,
        egresos: 0,
        saldo: 0,
        movimientos: 0,
        sinMovimientos: true,
        auto: true,
        leyenda: 'Sin movimientos contables durante la jornada'
      };
      D.cierres.push(cierreAuto);
      nuevosCierres.push(cierreAuto);
      setCierres.add(cursor);
      registrados++;
    }
    cursor = _ymdAddDays(cursor, 1);
  }

  if (registrados > 0) {
    // Reordenar D.cierres por fecha descendente (consistente con el resto del sistema)
    D.cierres.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    save();
    try { if (typeof renderCaja === 'function') renderCaja(); } catch(e){ registrarError('catch vacio', e); }
    try { if (typeof renderContab === 'function') renderContab(); } catch(e){ registrarError('catch vacio', e); }
    try { if (typeof aplicarEstadoCierre === 'function') aplicarEstadoCierre(); } catch(e){ registrarError('catch vacio', e); }
    toast(`📅 ${registrados} día(s) sin actividad registrados automáticamente`);
    console.log('Auto-registro días sin movimientos:', nuevosCierres.map(c => c.fecha));

    // Persistir estado con cierres nuevos
    syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
  }
}

// ─── Retirar dinero de la caja ───────────────────────────────────
// ─── Modal Retiro de Caja ─────────────────────────────────────────
function abrirModalRetiro() {
  const saldo = getSaldo();
  const el = document.getElementById('retiroDisponible');
  if (el) el.textContent = '$' + fmt(saldo);
  const montoEl = document.getElementById('retiroMonto');
  if (montoEl) montoEl.value = '';
  const obsEl = document.getElementById('retiroObs');
  if (obsEl) obsEl.value = '';
  const respEl = document.getElementById('retiroResponsable');
  if (respEl) respEl.value = empNombre();
  const prev = document.getElementById('retiroPreview');
  if (prev) prev.style.display = 'none';
  document.getElementById('mRetiro').classList.add('show');
}

function retirarTodo() {
  cerrar('mRetiro');
  setTimeout(()=>{
    if(confirm(
      '⚠ RETIRO TOTAL NO PERMITIDO\n\n'+
      'Para retirar la totalidad del saldo usa el botón\n'+
      '🔒 CORTE DE CAJA — registra el cierre formal\n'+
      'y la entrega a administración.\n\n'+
      '¿Ir a Corte de Caja ahora?'
    )){
      ir('contabilidad');
      setTimeout(()=>cerrarCaja(), 300);
    }
  }, 200);
}

function calcRetiroPreview() {
  const saldo = getSaldo();
  const monto = parseFloat(document.getElementById('retiroMonto')?.value) || 0;
  const prev = document.getElementById('retiroPreview');
  const restante = document.getElementById('retiroSaldoRestante');
  if (!prev || !restante) return;
  if (monto > 0) {
    prev.style.display = 'block';
    const r = saldo - monto;
    restante.textContent = '$' + fmt(Math.max(0, r));
    restante.style.color = r < 0 ? 'var(--rojo)' : 'var(--verde)';
  } else {
    prev.style.display = 'none';
  }
}

function confirmarRetiro() {
  const saldo = getSaldo();
  const monto = parseFloat(document.getElementById('retiroMonto')?.value) || 0;
  const resp = (document.getElementById('retiroResponsable')?.value || '').trim() || empNombre();
  const obs = (document.getElementById('retiroObs')?.value || '').trim();

  if (monto <= 0) { toast('Ingresa un monto mayor a $0', 'err'); return; }
  if (monto > saldo) { toast(`El monto ($${fmt(monto)}) supera el saldo en caja ($${fmt(saldo)})`, 'err'); return; }
  if (saldo - monto < 1000) { toast(`Debe quedar mínimo $1,000.00 en caja. Máximo a retirar: $${fmt(saldo - 1000)}`, 'err'); return; }

  // ── BLOQUEAR RETIRO TOTAL ──────────────────────────────────────
  if (monto >= saldo) {
    cerrar('mRetiro');
    setTimeout(()=>{
      if(confirm(
        '⚠ RETIRO TOTAL NO PERMITIDO\n\n'+
        'El retiro de $'+fmt(monto)+' equivale al saldo completo de la caja.\n\n'+
        'Para vaciar la caja por completo usa el botón\n'+
        '🔒 CORTE DE CAJA — que registra formalmente el cierre\n'+
        'y la entrega a administración.\n\n'+
        '¿Ir a Corte de Caja ahora?'
      )){
        ir('contabilidad');
        setTimeout(()=>cerrarCaja(), 300);
      }
    }, 200);
    return;
  }

  const desc = `RETIRO PARCIAL — $${fmt(monto)}${obs ? ' · ' + obs : ''}`;

  const mov = {
    id: 'M-' + Date.now(),
    fecha: hoy(), hora: hora(),
    descripcion: desc,
    monto, tipo: 'egreso', cat: 'retiro',
    fuente: 'retiro', responsable: resp
  };

  _registrarMovimiento(mov);
  if (!D.saldoAcumulado) D.saldoAcumulado = 0;
  const reducirAcum = Math.min(D.saldoAcumulado, monto);
  D.saldoAcumulado = Math.max(0, D.saldoAcumulado - reducirAcum);

  save();
  cerrar('mRetiro');
  renderCaja();
  renderContab();
  aplicarEstadoCierre();
  toast(`💵 Retiro parcial — $${fmt(monto)} por ${resp}. Restante en caja: $${fmt(saldo - monto)}`);
  syncEstadoSupabaseDebounced();
}

async function sincronizarTodoAhora() {
  if (!tokenOk()) { toast('Conecta tu sesión primero', 'err'); return; }
  syncErrorCount = 0;
  if (!syncQueue.length) { toast('No hay pendientes ✓'); return; }
  toast(`Sincronizando ${syncQueue.length} movimientos...`);
  const lista = [...syncQueue]; syncQueue = [];
  for (const mov of lista) { await syncMovimientoASheets(mov); await new Promise(r => setTimeout(r, 500)); }
  toast('Sincronización completa ✓');
}

// ─── UI ──────────────────────────────────────────────────────────
function toggleSyncSheetsUI() {
  // Sync siempre activo (Supabase)
  syncErrorCount = 0; syncQueue = [];
  const el = document.getElementById('sync-estado');
  if (el) el.textContent = '🟢 Activo';
  toast('🟢 Sync ACTIVO');
}
function actualizarSyncUI() {
  const elCnt = document.getElementById('sync-cola-count');
  if (elCnt) elCnt.textContent = syncQueue.length;
  const elEstado = document.getElementById('sync-estado');
  if (elEstado) elEstado.textContent = '🟢 Activo';
}
setInterval(() => {
  const panel = document.getElementById('panel-configuracion');
  if (panel && panel.classList.contains('active')) actualizarSyncUI();
}, 2000);

// ═══════════════════════════════════════════════════════════════