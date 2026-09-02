/* LEX-MÉXICO · Módulo caja
 * Funciones extraídas sin modificar su contenido.
 */

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

function cajaBloqueada() { return _cajaCerradaHoy; }

function marcarCajaCerrada() { _cajaCerradaHoy = true; }

function esPeriodoCerrado(fecha, hora) {
  const cortes = (D.cierres || []).filter(function(c){ return c && c.esCorte === true && c.fecha; });
  if (!cortes.length) return false;
  const tsMov = (fecha || '') + 'T' + (hora || '00:00') + ':00';
  return cortes.some(function(c){
    const tsCorte = c.fecha + 'T' + (c.hora || '00:00') + ':00';
    return tsMov <= tsCorte;
  });
}

function _msgPeriodoCerrado() {
  const cortes = (D.cierres || []).filter(function(c){ return c && c.esCorte === true && c.fecha; })
    .sort(function(a,b){ return ((b.fecha||'')+'T'+(b.hora||'')).localeCompare((a.fecha||'')+'T'+(a.hora||'')); });
  const ult = cortes[0];
  return '🔒 Período cerrado por corte de caja' + (ult ? ' del ' + ult.fecha + (ult.hora ? ' ' + ult.hora : '') : '') + ' — este registro no se puede modificar.';
}

function _foliosExcluidos() {
  const raw = Array.isArray(D.recibosExcluidosCaja) ? D.recibosExcluidosCaja : [];
  // Normalizar a string para comparación consistente (r.folio puede ser number o string)
  return new Set(raw.map(f => String(f)));
}

function getSaldo() {
  const ultimoCorte = ((D.cierres || [])
    .filter(c => c.fecha && c.esCorte === true)
    .sort((a, b) => (b.fecha + 'T' + (b.hora || '00:00'))
      .localeCompare(a.fecha + 'T' + (a.hora || '00:00'))))[0] || null;
  const tsCorte = ultimoCorte
    ? ultimoCorte.fecha + 'T' + (ultimoCorte.hora || '00:00') + ':00' : null;
  function despuesDelCorte(m) {
    if (!tsCorte) return true;
    return ((m.fecha || '') + 'T' + (m.hora || '00:00') + ':00') > tsCorte;
  }
  const movsCaja  = _movimientosDeCaja().filter(despuesDelCorte);
  const excluidos = _foliosExcluidos();
  const yaEnCaja  = _foliosYaEnCaja(movsCaja);
  const sinteticos = Object.values(_recibosMap())
    .filter(r => !r.cancelado && !excluidos.has(String(r.folio)) && !yaEnCaja.has(Number(r.folio)))
    .filter(r => despuesDelCorte({ fecha: r.fecha, hora: r.hora || r.hora_recibo || '00:00' }))
    .filter(r => parseFloat(r.totalAbonado || 0) > 0 || parseFloat(r.anticipo || 0) > 0)
    .map(r => {
      const ab = parseFloat(r.totalAbonado || 0), an = parseFloat(r.anticipo || 0);
      return { tipo: 'ingreso', monto: ab > 0 ? ab : an };
    });
  const todos = [...movsCaja, ...sinteticos];
  const ing = todos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const egr = todos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  return ing - egr;
}

function _poblarSelectorAnios() {
  const sel = document.getElementById('cFiltroAnio');
  if (!sel) return;
  const anios = new Set();
  getAllMovs().forEach(m => { if (m.fecha && m.fecha.length >= 4) anios.add(m.fecha.substring(0, 4)); });
  (D.cierres || []).forEach(c => { if (c.fecha && c.fecha.length >= 4) anios.add(c.fecha.substring(0, 4)); });
  const anioActual = new Date().getFullYear().toString();
  anios.add(anioActual);
  const sorted = [...anios].sort((a, b) => b.localeCompare(a));
  const prev = sel.value;
  sel.innerHTML = '<option value="">Todos los años</option>' +
    sorted.map(a => `<option value="${a}"${a === anioActual ? ' selected' : ''}>${a}</option>`).join('');
  if (prev && sorted.includes(prev)) sel.value = prev;
}

function _csHome(){
  const sub = document.getElementById('cs-subtitulo');
  if(sub) sub.textContent = 'HERRAMIENTAS RÁPIDAS';
  const body = document.getElementById('cs-body');
  if(!body) return;
  body.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
    + _csTarjeta('💰','Préstamos','Ver préstamos y pagos registrados en Caja Rápida, con total prestado/pagado/pendiente.','_csAbrirPrestamos()')
    + _csTarjeta('📒','Cuentas por Cobrar','Gastos pagados a nombre de clientes (trámites viejos, sin folio en el sistema) pendientes de cobro.','_csAbrirCuentasPorCobrar()')
    + _csTarjeta('📋','Folios sin Liquidar','Lista completa de folios con saldo pendiente &gt; $0, ordenados de mayor a menor.','_csAbrirSinLiquidar()')
    + _csTarjeta('🚗','Folios Vehiculares','Folios de trámite vehicular: en proceso, liquidados y cancelados.',"_csAbrirFolios('vehicular')")
    + _csTarjeta('📁','Folios Normales','Folios de trámite normal: en proceso, liquidados y cancelados.',"_csAbrirFolios('normal')")
    + _csTarjeta('📜','Folios de Escrituras','Folios de trámite de escrituras: en proceso, liquidados y cancelados.',"_csAbrirFolios('escritura')")
    + _csTarjeta('⚖️','Folios de Juicios','Folios de trámite de juicio: en proceso, liquidados y cancelados.',"_csAbrirFolios('juicio')")
    + '</div>';
}

function _csAbrirSinLiquidar(){
  const sub = document.getElementById('cs-subtitulo');
  if(sub) sub.textContent = 'FOLIOS SIN LIQUIDAR';
  const body = document.getElementById('cs-body');
  if(!body) return;
  const recs = (typeof appData!=='undefined' && Array.isArray(appData.recibos) ? appData.recibos : [])
    .filter(function(r){ return r && !r.cancelado && (parseFloat(r.saldoPendiente)||0) > 0; })
    .sort(function(a,b){ return (parseFloat(b.saldoPendiente)||0) - (parseFloat(a.saldoPendiente)||0); });
  const totalPend = recs.reduce(function(s,r){ return s + (parseFloat(r.saldoPendiente)||0); }, 0);
  let html = '<button onclick="_csHome()" style="background:none;border:1.5px solid rgba(200,149,42,0.4);border-radius:20px;padding:6px 14px;font-size:0.74rem;color:#8c6518;cursor:pointer;margin-bottom:14px;">← Volver</button>';
  html += '<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">'
    + '<div style="flex:1;min-width:140px;background:#fff8e8;border:1.5px solid #e0c060;border-radius:8px;padding:10px 14px;">'
    +   '<div style="font-size:0.6rem;color:#8c6518;letter-spacing:0.05em;">FOLIOS SIN LIQUIDAR</div>'
    +   '<div style="font-size:1.1rem;font-weight:700;color:#8c6518;">'+recs.length+'</div>'
    + '</div>'
    + '<div style="flex:1;min-width:140px;background:#fff0f0;border:1.5px solid #e0a0a0;border-radius:8px;padding:10px 14px;">'
    +   '<div style="font-size:0.6rem;color:#a03030;letter-spacing:0.05em;">SALDO PENDIENTE TOTAL</div>'
    +   '<div style="font-size:1.1rem;font-weight:700;color:#c0161a;">$'+fmt(totalPend)+'</div>'
    + '</div>'
    + '</div>';
  if(!recs.length){
    html += '<div style="padding:24px;text-align:center;color:#9a8050;">No hay folios con saldo pendiente — todo liquidado ✓</div>';
  } else {
    html += '<div style="border:1px solid rgba(200,149,42,0.25);border-radius:8px;overflow:hidden;max-height:50vh;overflow-y:auto;">'
      + recs.map(function(r){
        const letra = r.letra || 'A';
        const str = (typeof folioConLetra==='function') ? folioConLetra(r.folio, r.anio_folio, letra) : (r.folio+letra);
        return '<div style="display:flex;gap:10px;padding:9px 12px;border-bottom:1px solid rgba(200,149,42,0.15);font-size:0.76rem;align-items:center;">'
          + '<div style="width:70px;flex-shrink:0;"><span onclick="cerrarContabScanner();abrirFichaDesdeContab('+r.folio+')" style="cursor:pointer;text-decoration:underline;text-underline-offset:2px;color:#1a4a8a;font-weight:700;">#'+esc(str)+'</span></div>'
          + '<div style="flex:1;font-weight:600;color:#3a2a10;">'+esc(r.nombre||(r.clientes&&r.clientes[0]&&r.clientes[0].nombre)||'—')+'</div>'
          + '<div style="width:110px;flex-shrink:0;text-align:right;font-weight:700;color:#c0161a;">$'+fmt(parseFloat(r.saldoPendiente)||0)+'</div>'
          + '</div>';
      }).join('')
      + '</div>';
  }
  body.innerHTML = html;
}

function _csNormPrestamo(s){
  return String(s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
}

function _csPersonaPrestamo(desc){
  const norm = _csNormPrestamo(desc);
  const palabras = norm.replace(/[^A-Z\s]/g,' ').split(/\s+/).filter(Boolean);
  const candidatos = palabras.filter(function(w){ return w.length>=3 && !_CS_STOP_PRESTAMO.has(w) && isNaN(w); });
  return candidatos.length ? candidatos.join(' ') : 'SIN IDENTIFICAR';
}

function _csIconoFlujo(tipo){
  const color = tipo==='ingreso' ? '#1a7a3a' : '#c0161a';
  const flecha = tipo==='ingreso' ? 'M12 19V26M7 21L12 26L17 21' : 'M12 26V19M7 24L12 19L17 24';
  return '<svg width="22" height="28" viewBox="0 0 24 30" style="vertical-align:middle;margin-right:5px;flex-shrink:0;">'
    + '<circle cx="12" cy="10" r="9" fill="none" stroke="'+color+'" stroke-width="2"/>'
    + '<text x="12" y="14" text-anchor="middle" font-size="11" font-weight="800" fill="'+color+'" font-family="monospace,sans-serif">$</text>'
    + '<path d="'+flecha+'" fill="none" stroke="'+color+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>';
}

function _csAbrirPrestamos(){
  const sub = document.getElementById('cs-subtitulo');
  if(sub) sub.textContent = 'PRÉSTAMOS — QUIÉN DEBE A QUIÉN';
  const body = document.getElementById('cs-body');
  if(!body) return;
  const _RE_PRESTAMO = /PREST(?!ACION|IGIO)/;
  const _RE_ES_PAGO  = /SE\s?LE\s+(PAGO|DEVOLV|DEVUELV)/;
  const todos = (typeof getAllMovs==='function' ? getAllMovs() : []).filter(function(m){
    return _RE_PRESTAMO.test(_csNormPrestamo((m.descripcion||'')+' '+(m.cat||'')));
  }).map(function(m){
    const norm = _csNormPrestamo(m.descripcion||'');
    return {
      fecha: m.fecha||'', hora: m.hora||'', monto: parseFloat(m.monto)||0,
      tipo: m.tipo, desc: m.descripcion||'', persona: _csPersonaPrestamo(m.descripcion),
      esPago: _RE_ES_PAGO.test(norm)
    };
  }).sort(function(a,b){ return (a.fecha+'T'+a.hora).localeCompare(b.fecha+'T'+b.hora); });
  const prestamosReales = todos.filter(function(m){ return !m.esPago; });
  const pagos           = todos.filter(function(m){ return m.esPago; });
  // Emparejar cada préstamo con un pago de la MISMA persona, tipo OPUESTO
  // (si prestaron ingreso, el pago sale como egreso, y viceversa), mismo
  // monto, fecha igual o posterior — sin repetir el mismo pago dos veces.
  const pagoUsado = new Array(pagos.length).fill(false);
  prestamosReales.forEach(function(p){
    p.liquidado = false; p.fechaPago = null;
    for(let i=0;i<pagos.length;i++){
      if(pagoUsado[i]) continue;
      const g = pagos[i];
      if(g.persona===p.persona && g.tipo!==p.tipo && Math.abs(g.monto-p.monto)<0.01 && (g.fecha+'T'+g.hora) >= (p.fecha+'T'+p.hora)){
        pagoUsado[i] = true; p.liquidado = true; p.fechaPago = g.fecha; break;
      }
    }
  });
  const pagosSinPrestamo = pagos.filter(function(g,i){ return !pagoUsado[i]; });
  // Agrupar por persona
  const grupos = {};
  prestamosReales.forEach(function(p){
    if(!grupos[p.persona]) grupos[p.persona] = [];
    grupos[p.persona].push(p);
  });
  let html = '<button onclick="_csHome()" style="background:none;border:1.5px solid rgba(200,149,42,0.4);border-radius:20px;padding:6px 14px;font-size:0.74rem;color:#8c6518;cursor:pointer;margin-bottom:14px;">← Volver</button>';
  html += '<div style="font-size:0.72rem;color:#7a6840;margin-bottom:16px;line-height:1.5;display:flex;align-items:center;flex-wrap:wrap;gap:14px;">'
    + '<span style="display:flex;align-items:center;">'+_csIconoFlujo('ingreso')+'<b>&nbsp;Entró dinero</b>&nbsp;= la persona le prestó AL despacho.</span>'
    + '<span style="display:flex;align-items:center;">'+_csIconoFlujo('egreso')+'<b>&nbsp;Salió dinero</b>&nbsp;= el despacho le prestó A la persona.</span>'
    + '</div>';
  if(!Object.keys(grupos).length){
    html += '<div style="padding:24px;text-align:center;color:#9a8050;">No se encontró ningún préstamo en la descripción de los movimientos.</div>';
  } else {
    Object.keys(grupos).sort().forEach(function(persona){
      const items = grupos[persona];
      // Saldo simple: lo que el despacho le debe a la persona (préstamos que
      // ELLA hizo y siguen sin pagarse) menos lo que ella le debe al despacho
      // (préstamos que EL DESPACHO le dio y ella no ha regresado).
      const leDebeDespacho = items.filter(function(p){ return p.tipo==='ingreso' && !p.liquidado; }).reduce(function(s,p){ return s+p.monto; },0);
      const ellaDebe       = items.filter(function(p){ return p.tipo==='egreso'  && !p.liquidado; }).reduce(function(s,p){ return s+p.monto; },0);
      let fraseSaldo, colorSaldo;
      if(Math.abs(leDebeDespacho-ellaDebe) < 0.01){
        fraseSaldo = '✅ A mano — no se deben nada'; colorSaldo = '#1a7a3a';
      } else if(leDebeDespacho > ellaDebe){
        fraseSaldo = '🔴 El despacho le debe $'+fmt(leDebeDespacho-ellaDebe); colorSaldo = '#c0161a';
      } else {
        fraseSaldo = '🟡 '+esc(persona)+' le debe $'+fmt(ellaDebe-leDebeDespacho)+' al despacho'; colorSaldo = '#8c6518';
      }
      html += '<div style="border:1.5px solid rgba(200,149,42,0.4);border-radius:10px;margin-bottom:14px;overflow:hidden;">'
        + '<div style="background:rgba(200,149,42,0.12);padding:10px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">'
        +   '<span style="font-weight:700;color:#3a2a10;font-size:0.88rem;">'+(persona==='SIN IDENTIFICAR' ? '❓ Sin identificar' : esc(persona))+'</span>'
        +   '<span style="font-weight:700;font-size:0.8rem;color:'+colorSaldo+';">'+fraseSaldo+'</span>'
        + '</div>';
      items.forEach(function(p){
        const badge = _csIconoFlujo(p.tipo);
        const direccion = p.tipo==='ingreso'
          ? '<span style="display:inline-flex;align-items:center;">'+badge+esc(persona)+' le prestó al despacho</span>'
          : '<span style="display:inline-flex;align-items:center;">'+badge+'El despacho le prestó a '+esc(persona)+'</span>';
        const estado = p.liquidado
          ? '<span style="color:#1a7a3a;font-weight:700;">✅ Ya se pagó'+(p.fechaPago?' ('+esc(p.fechaPago)+')':'')+'</span>'
          : '<span style="color:#c0161a;font-weight:700;">⏳ Todavía se debe</span>';
        const descCorta = p.desc.length>70 ? p.desc.slice(0,70)+'…' : p.desc;
        html += '<div style="padding:10px 14px;border-top:1px solid rgba(200,149,42,0.15);font-size:0.78rem;">'
          + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">'
          +   '<span>'+direccion+' — <b>$'+fmt(p.monto)+'</b></span>'
          +   '<span>'+estado+'</span>'
          + '</div>'
          + '<div style="color:#9a8050;font-size:0.68rem;margin-top:2px;" title="'+esc(p.desc)+'">'+esc(p.fecha)+' · '+esc(descCorta)+'</div>'
          + '</div>';
      });
      html += '</div>';
    });
  }
  if(pagosSinPrestamo.length){
    html += '<div style="margin-top:6px;padding:10px 14px;background:#fff8e8;border:1px dashed #e0c060;border-radius:8px;font-size:0.72rem;color:#8c6518;">'
      + '⚠ Hay '+pagosSinPrestamo.length+' pago(s) de préstamo cuyo préstamo original no encontré (monto o persona no coinciden) — revísalos aparte: '
      + pagosSinPrestamo.map(function(g){ return esc(g.fecha)+' "'+esc(g.desc.slice(0,50))+'" $'+fmt(g.monto); }).join('; ')
      + '</div>';
  }
  body.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════
// 📒 CUENTAS POR COBRAR — gastos pagados a nombre de clientes que no están
// en el sistema (trámites viejos, sin folio) y que hay que cobrarles
// después. A diferencia de Préstamos (que se detecta solo escaneando
// descripciones), esto es un registro propio: D.cuentasPorCobrar[], con
// persistencia y sincronización igual que Pendientes/Escrituras.
// ═══════════════════════════════════════════════════════════════════════
function _csAbrirCuentasPorCobrar(){
  const sub = document.getElementById('cs-subtitulo');
  if(sub) sub.textContent = 'CUENTAS POR COBRAR';
  _csCxcRenderLista();
}

function _csCxcRenderLista(){
  const body = document.getElementById('cs-body');
  if(!body) return;
  const todas = Array.isArray(D.cuentasPorCobrar) ? D.cuentasPorCobrar : [];
  const pendientes = todas.filter(function(c){ return c && c.estado !== 'cobrado'; })
    .sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
  const cobradas = todas.filter(function(c){ return c && c.estado === 'cobrado'; })
    .sort(function(a,b){ return (b.fechaCobro||'').localeCompare(a.fechaCobro||''); });
  const totalPend = pendientes.reduce(function(s,c){ return s + (parseFloat(c.monto)||0); }, 0);
  let html = '<button onclick="_csHome()" style="background:none;border:1.5px solid rgba(200,149,42,0.4);border-radius:20px;padding:6px 14px;font-size:0.74rem;color:#8c6518;cursor:pointer;margin-bottom:14px;">← Volver</button>';
  html += '<div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">'
    + '<div style="flex:1;min-width:140px;background:#fff8e8;border:1.5px solid #e0c060;border-radius:8px;padding:10px 14px;">'
    +   '<div style="font-size:0.6rem;color:#8c6518;letter-spacing:0.05em;">CUENTAS PENDIENTES</div>'
    +   '<div style="font-size:1.1rem;font-weight:700;color:#8c6518;">'+pendientes.length+'</div>'
    + '</div>'
    + '<div style="flex:1;min-width:140px;background:#fff0f0;border:1.5px solid #e0a0a0;border-radius:8px;padding:10px 14px;">'
    +   '<div style="font-size:0.6rem;color:#a03030;letter-spacing:0.05em;">TOTAL POR COBRAR</div>'
    +   '<div style="font-size:1.1rem;font-weight:700;color:#c0161a;">$'+fmt(totalPend)+'</div>'
    + '</div>'
    + '</div>';
  html += '<button onclick="_csCxcForm()" class="btn btn-primary" style="margin-bottom:14px;">＋ Nueva cuenta por cobrar</button>';
  const renderItem = function(c, esCobrada){
    const badge = esCobrada
      ? '<span style="color:#1a7a3a;font-weight:700;font-size:0.7rem;">✅ Cobrado'+(c.fechaCobro?' ('+esc(c.fechaCobro)+')':'')+'</span>'
      : '<span style="color:#c0161a;font-weight:700;font-size:0.7rem;">⏳ Pendiente</span>';
    const acciones = esCobrada
      ? '<button onclick="_csCxcReabrir(\''+c.id+'\')" style="background:none;border:1px solid rgba(200,149,42,0.4);border-radius:6px;padding:4px 10px;font-size:0.68rem;color:#8c6518;cursor:pointer;">↩ Reabrir</button>'
      : '<button onclick="_csCxcMarcarCobrado(\''+c.id+'\')" style="background:#1a7a3a;border:none;border-radius:6px;padding:4px 10px;font-size:0.68rem;color:#fff;cursor:pointer;margin-right:6px;">✅ Marcar cobrado</button>'
      + '<button onclick="_csCxcEliminar(\''+c.id+'\')" style="background:none;border:1px solid rgba(192,22,26,0.4);border-radius:6px;padding:4px 10px;font-size:0.68rem;color:#c0161a;cursor:pointer;">🗑 Eliminar</button>';
    return '<div style="border:1.5px solid rgba(200,149,42,0.3);border-radius:8px;padding:10px 14px;margin-bottom:8px;'+(esCobrada?'opacity:0.7;':'')+'">'
      + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">'
      +   '<span style="font-weight:700;color:#3a2a10;font-size:0.85rem;">'+esc(c.cliente||'(sin nombre)')+'</span>'
      +   badge
      + '</div>'
      + '<div style="font-size:0.78rem;color:#4a3a1a;margin-top:3px;">'+esc(c.concepto||'')+' — <b>$'+fmt(parseFloat(c.monto)||0)+'</b></div>'
      + '<div style="font-size:0.65rem;color:#9a8050;margin-top:2px;">'+esc(c.fecha||'')+(c.obs?' · '+esc(c.obs):'')+'</div>'
      + '<div style="margin-top:8px;">'+acciones+'</div>'
      + '</div>';
  };
  if(!pendientes.length && !cobradas.length){
    html += '<div style="padding:24px;text-align:center;color:#9a8050;">No hay cuentas por cobrar registradas todavía.</div>';
  } else {
    html += pendientes.map(function(c){ return renderItem(c, false); }).join('');
    if(cobradas.length){
      html += '<div style="font-family:monospace;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:#7a6840;margin:16px 0 8px;">Ya cobradas ('+cobradas.length+')</div>';
      html += cobradas.map(function(c){ return renderItem(c, true); }).join('');
    }
  }
  body.innerHTML = html;
}

function _csCxcForm(){
  const body = document.getElementById('cs-body');
  if(!body) return;
  const hoyStr = (typeof hoy === 'function') ? hoy() : new Date().toISOString().slice(0,10);
  let html = '<button onclick="_csAbrirCuentasPorCobrar()" style="background:none;border:1.5px solid rgba(200,149,42,0.4);border-radius:20px;padding:6px 14px;font-size:0.74rem;color:#8c6518;cursor:pointer;margin-bottom:14px;">← Volver</button>';
  html += '<div style="font-family:monospace;font-size:0.62rem;letter-spacing:0.14em;text-transform:uppercase;color:#555;font-weight:700;margin-bottom:10px;">📒 Nueva Cuenta por Cobrar</div>';
  html += '<div class="field"><label>👤 Cliente *</label><input id="cxcCliente" type="text" placeholder="Nombre del cliente..."></div>';
  html += '<div class="field"><label>📝 Concepto *</label><input id="cxcConcepto" type="text" placeholder="Ej: Pago de recibo predial 2022..."></div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
    + '<div class="field"><label>💵 Monto *</label><input id="cxcMonto" type="number" step="0.01" min="0" placeholder="0.00"></div>'
    + '<div class="field"><label>📅 Fecha del gasto</label><input id="cxcFecha" type="date" value="'+hoyStr+'"></div>'
    + '</div>';
  html += '<div class="field"><label>📝 Observaciones (opcional)</label><textarea id="cxcObs" rows="2" placeholder="Contexto adicional..."></textarea></div>';
  html += '<button onclick="_csCxcGuardarNueva()" class="btn btn-primary">💾 Guardar</button>';
  body.innerHTML = html;
}

function _csCxcGuardarNueva(){
  const cliente  = document.getElementById('cxcCliente')?.value.trim() || '';
  const concepto = document.getElementById('cxcConcepto')?.value.trim() || '';
  const monto    = parseFloat(document.getElementById('cxcMonto')?.value) || 0;
  const fecha    = document.getElementById('cxcFecha')?.value || ((typeof hoy === 'function') ? hoy() : new Date().toISOString().slice(0,10));
  const obs      = document.getElementById('cxcObs')?.value.trim() || '';
  if(!cliente){ if(typeof toast==='function') toast('El cliente es obligatorio','err'); return; }
  if(!concepto){ if(typeof toast==='function') toast('El concepto es obligatorio','err'); return; }
  if(!monto || monto <= 0){ if(typeof toast==='function') toast('El monto debe ser mayor a 0','err'); return; }
  if(!Array.isArray(D.cuentasPorCobrar)) D.cuentasPorCobrar = [];
  D.cuentasPorCobrar.unshift({
    id: 'CXC-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
    cliente: cliente, concepto: concepto, monto: monto, fecha: fecha, obs: obs,
    estado: 'pendiente', fechaCobro: '',
    creadoPor: (typeof empleadoActual !== 'undefined' && empleadoActual) ? empleadoActual.nombre : (typeof NOMBRE_TITULAR !== 'undefined' ? NOMBRE_TITULAR : ''),
    fechaMod: new Date().toISOString()
  });
  if(typeof save === 'function') save();
  if(typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced().catch(function(e){ if(typeof registrarError==='function') registrarError('Promise catch vacio', e); });
  if(typeof toast==='function') toast('✅ Cuenta por cobrar guardada — sincronizando...');
  _csAbrirCuentasPorCobrar();
}

function _csCxcMarcarCobrado(id){
  const c = (D.cuentasPorCobrar||[]).find(function(x){ return x && x.id === id; });
  if(!c) return;
  if(!confirm('¿Marcar como cobrado el pago de "'+c.cliente+'" por $'+fmt(parseFloat(c.monto)||0)+'?')) return;
  c.estado = 'cobrado';
  c.fechaCobro = (typeof hoy === 'function') ? hoy() : new Date().toISOString().slice(0,10);
  c.fechaMod = new Date().toISOString();
  if(typeof save === 'function') save();
  if(typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced().catch(function(e){ if(typeof registrarError==='function') registrarError('Promise catch vacio', e); });
  if(typeof toast==='function') toast('✅ Marcado como cobrado — sincronizando...');
  _csCxcRenderLista();
}

function _csCxcReabrir(id){
  const c = (D.cuentasPorCobrar||[]).find(function(x){ return x && x.id === id; });
  if(!c) return;
  c.estado = 'pendiente';
  c.fechaCobro = '';
  c.fechaMod = new Date().toISOString();
  if(typeof save === 'function') save();
  if(typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced().catch(function(e){ if(typeof registrarError==='function') registrarError('Promise catch vacio', e); });
  if(typeof toast==='function') toast('↩ Cuenta reabierta como pendiente');
  _csCxcRenderLista();
}

function _csCxcEliminar(id){
  const c = (D.cuentasPorCobrar||[]).find(function(x){ return x && x.id === id; });
  if(!c) return;
  if(!confirm('¿Eliminar definitivamente esta cuenta por cobrar de "'+c.cliente+'"?')) return;
  D.cuentasPorCobrar = (D.cuentasPorCobrar||[]).filter(function(x){ return x && x.id !== id; });
  if(typeof save === 'function') save();
  if(typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced().catch(function(e){ if(typeof registrarError==='function') registrarError('Promise catch vacio', e); });
  if(typeof toast==='function') toast('🗑 Cuenta por cobrar eliminada');
  _csCxcRenderLista();
}

function exportCSV() {
  const q       = (document.getElementById('cBuscar')?.value || '').toLowerCase().trim();
  const filtroA = (document.getElementById('cFiltroAnio')?.value || '');
  const filtroM = (document.getElementById('cFiltroMes')?.value  || '');
  let movs = getAllMovs();
  if (filtroC === 'ing') movs = movs.filter(m => m.tipo === 'ingreso');
  else if (filtroC === 'egr') movs = movs.filter(m => m.tipo === 'egreso');
  if (filtroA) movs = movs.filter(m => m.fecha && m.fecha.startsWith(filtroA));
  if (filtroM) movs = movs.filter(m => m.fecha && m.fecha.substring(5,7) === filtroM);
  if (q) movs = movs.filter(m =>
    (m.descripcion||'').toLowerCase().includes(q) ||
    (m.nombre||'').toLowerCase().includes(q) ||
    (m.cat||'').toLowerCase().includes(q) ||
    (m.folioCaja||'').toLowerCase().includes(q) ||
    (m.folio!=null && folioConLetra(m.folio, m.anio_folio, letraDeRecibo(m.folio)).includes(q)) ||
    (m.responsable||'').toLowerCase().includes(q)
  );
  const DIAS_S  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MESES_S = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function _fb(f){
    try{ const [y,m,d]=f.split('-').map(Number); return DIAS_S[new Date(y,m-1,d).getDay()].toUpperCase()+' '+d+' DE '+MESES_S[m-1].toUpperCase()+' '+y; }
    catch(e){return f;}
  }
  // Incluir cierres sin movimientos en el rango
  const cierresSM = (D.cierres||[]).filter(c => {
    if(!c||!c.sinMovimientos||!c.fecha) return false;
    if(filtroA && !c.fecha.startsWith(filtroA)) return false;
    if(filtroM && c.fecha.substring(5,7)!==filtroM) return false;
    return true;
  });
  const grupos = {};
  movs.forEach(m => { const f=m.fecha||'—'; if(!grupos[f]) grupos[f]=[]; grupos[f].push(m); });
  cierresSM.forEach(c => { if(!grupos[c.fecha]) grupos[c.fecha]=[]; });
  const fechasAsc = Object.keys(grupos).filter(f=>f!=='—').sort();
  let acum = 0;
  const dataFecha = {};
  fechasAsc.forEach(f => {
    const ms  = grupos[f];
    const ing = ms.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
    const egr = ms.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
    acum += ing - egr;
    const cierre = (D.cierres||[]).find(c=>c.fecha===f);
    dataFecha[f] = { ing, egr, saldo:ing-egr, acum, cierre };
    if(cierre && cierre.esCorte) acum = 0;
  });
  const lineas = ['\uFEFF' + 'HORA,FOLIO,NOMBRE,DESCRIPCIÓN,CATEGORÍA,FUENTE,RESPONSABLE,MONTO'];
  const periodo = (filtroA||'todos') + (filtroM?'-'+filtroM:'');
  lineas.push(`"=== LEX-MEXICO · Contabilidad · Periodo: ${periodo} ==="`);
  [...fechasAsc].reverse().forEach(f => {
    const { ing, egr, saldo, acum:acumDia, cierre } = dataFecha[f];
    const esSM = cierre && cierre.sinMovimientos;
    lineas.push('');
    lineas.push(`"📅 ${_fb(f)}${cierre&&!esSM?' 🔒':esSM?' 🔒 sin movimientos':''}"`);
    if (esSM) {
      const etiq = cierre.auto?' (auto)':'';
      lineas.push([cierre.hora||'23:59','—','""',`"${(cierre.leyenda||'Sin movimientos').replace(/"/g,"'")}${etiq}"`,'—','Cierre','—','$0.00'].join(','));
      lineas.push(['"EFECTIVO EN CAJA"','','','','','','',`"$${fmt(acumDia)}"`].join(','));
      return;
    }
    grupos[f].forEach(m => {
      const folio   = m.fuente==='recibo' ? folioFormato(m.folio||0) : (m.folioCaja||'—');
      const nombre  = m.fuente==='recibo' ? (m.nombre||'') : '';
      const desc    = m.fuente==='recibo' ? (m.descripcion||m.nombre||'') : (m.descripcion||'');
      const monto   = (m.tipo==='egreso'?'-':'+')+' $'+fmt(m.monto);
      lineas.push([
        m.hora||'—', folio,
        `"${nombre.replace(/"/g,"'")}"`,
        `"${desc.replace(/"/g,"'")}"`,
        m.cat||'—',
        m.fuente==='recibo'?'Recibo':'Caja',
        m.responsable||'—',
        monto
      ].join(','));
    });
    lineas.push(['"RESUMEN DEL DÍA"','','','','',`"▲ $${fmt(ing)}${egr>0?' | ▼ $'+fmt(egr):''}"`,'',`"${saldo>=0?'+':''} $${fmt(saldo)}"`].join(','));
    lineas.push(['"EN CAJA"','','','','','','',`"$${fmt(acumDia)}"`].join(','));
    if(cierre && cierre.esCorte) {
      lineas.push([`"🔒 CORTE ${cierre.hora||''}"`, '','','','','','',`"-$${fmt(acumDia)} → $0.00"`].join(','));
    }
  });
  // Totales finales
  const tIng = movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
  const tEgr = movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
  lineas.push('');
  lineas.push(['"TOTAL DEL PERIODO"','','','','',`"▲ $${fmt(tIng)} | ▼ $${fmt(tEgr)}"`, '',`"${tIng-tEgr>=0?'+':''} $${fmt(tIng-tEgr)}"`].join(','));
  const suffix = (filtroA?'_'+filtroA:'') + (filtroM?'_'+filtroM:'');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lineas.join('\n')],{type:'text/csv;charset=utf-8;'}));
  a.download = 'LEX_Contabilidad' + suffix + '_' + hoy() + '.csv';
  a.click();
  toast('CSV descargado ✓','ok');
}

function aplicarFiltrosRecibos(lista) {
  const q = (document.getElementById('recFiltroQ')?.value || '').toLowerCase().trim();
  const desde = document.getElementById('recFiltroDesde')?.value || '';
  const hasta = document.getElementById('recFiltroHasta')?.value || '';
  const estado = document.getElementById('recFiltroEstado')?.value || 'todos';
  return lista.filter(x => {
    // Filtro por estado
    if (estado === 'liquidado') {
      if (x.cancelado || (x.saldoPendiente || 0) > 0) return false;
    } else if (estado === 'pendiente') {
      if (x.cancelado || !((x.saldoPendiente || 0) > 0)) return false;
    } else if (estado === 'cancelado') {
      if (!x.cancelado) return false;
    }
    // Filtro por rango de fechas (formato YYYY-MM-DD)
    if (desde || hasta) {
      const fechaRec = x.fecha || x.fecha_recibo || '';
      // Normalizar fecha del recibo a YYYY-MM-DD
      let fechaNorm = '';
      if (/^\d{4}-\d{2}-\d{2}/.test(fechaRec)) {
        fechaNorm = fechaRec.substring(0, 10);
      } else if (/^\d{2}\/\d{2}\/\d{4}/.test(fechaRec)) {
        const partes = fechaRec.substring(0, 10).split('/');
        fechaNorm = partes[2] + '-' + partes[1] + '-' + partes[0];
      }
      if (fechaNorm) {
        if (desde && fechaNorm < desde) return false;
        if (hasta && fechaNorm > hasta) return false;
      }
    }
    // Filtro de búsqueda por texto
    if (q) {
      const folioStr = String(x.folio || '');
      const nombre = (x.nombre || '').toLowerCase();
      const responsable = (x.responsable || '').toLowerCase();
      // Conceptos: buscar en descripciones
      const conceptosTxt = ((x.conceptos || []).map(c => 
        (c.concepto || '') + ' ' + (c.descripcion || '')
      ).join(' ')).toLowerCase();
      const tramites = (x.tramites || '').toLowerCase();
      const placa = (x.placa || '').toLowerCase();
      if (!folioStr.includes(q) && 
          !nombre.includes(q) && 
          !responsable.includes(q) &&
          !conceptosTxt.includes(q) &&
          !tramites.includes(q) &&
          !placa.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

function renderFoliosVinculacion(q=''){
  const recibos=(REC.recibos||[]);
  const filtrados=q?recibos.filter(r=>(r.nombre||'').toLowerCase().includes(q.toLowerCase())||String(r.folio).includes(q)):recibos;
  const el=$('folio-list');
  if(!filtrados.length){el.innerHTML='<div style="padding:16px;color:var(--muted);font-size:0.76rem;text-align:center;">Sin recibos encontrados.</div>';return;}
  el.innerHTML=filtrados.slice(0,30).map(r=>{
    const saldo=r.saldoPendiente!=null?r.saldoPendiente:Math.max(0,(r.total||0)-(r.anticipo||0));
    return `<div class="drive-folder-item" onclick="vincularFolioRecibo(${r.folio})">
      <span style="font-family:monospace;font-size:0.75rem;font-weight:700;color:var(--gold-d);">#${folioFormato(r.folio, r.anio_folio)}</span>
      <div style="flex:1;">
        <div style="font-size:0.82rem;font-weight:600;">${esc(r.nombre||'—')}</div>
        <div style="font-family:monospace;font-size:0.6rem;color:var(--muted);">${r.fecha||''}${r.total?' · $'+fmt(r.total):''} ${saldo>0?'· <span style="color:var(--amarillo);">$'+fmt(saldo)+' pendiente</span>':'· <span style="color:var(--verde);">Liquidado</span>'}</div>
      </div>
    </div>`;
  }).join('');
}

function renderFolioReciboDetalle(j){
  const el=$('jd-folio-recibo-detalle');
  if(!j.folioRecibo){el.innerHTML='<div style="color:var(--muted);font-size:0.76rem;">Sin recibo vinculado.</div>';return;}
  const rec=(REC.recibos||[]).find(r=>r.folio===j.folioRecibo);
  if(!rec){el.innerHTML=`<div style="font-family:monospace;font-size:0.75rem;color:var(--gold-d);">Folio #${folioFormato(j.folioRecibo)} — (recibo no encontrado en sistema)</div>`;return;}
  const saldo=rec.saldoPendiente!=null?rec.saldoPendiente:Math.max(0,(rec.total||0)-(rec.anticipo||0));
  el.innerHTML=`<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
    <div style="font-family:monospace;font-size:1.2rem;font-weight:700;color:var(--gold-d);">#${folioFormato(rec.folio, rec.anio_folio)}</div>
    <div>
      <div style="font-weight:600;font-size:0.85rem;">${esc(rec.nombre||'')}</div>
      <div style="font-family:monospace;font-size:0.65rem;color:var(--muted);">${fmtFecha(rec.fecha)||''}</div>
    </div>
    <div style="margin-left:auto;text-align:right;">
      <div style="font-family:monospace;font-size:0.9rem;font-weight:700;color:var(--verde);">$${fmt(rec.total||0)}</div>
      <span class="tag ${saldo>0?'tag-a':'tag-v'}" style="font-size:0.55rem;">${saldo>0?'$'+fmt(saldo)+' pendiente':'Liquidado'}</span>
    </div>
  </div>`;
}

function _getInfoPagoCarpeta(c) {
  const recibos = (typeof appData!=='undefined'?appData.recibos:REC.recibos)||[];
  const folioStr = String(c.reciboOficial||'').replace('#','').trim();
  let rec = null;
  if (folioStr) rec = recibos.find(r=>r.folio===parseInt(folioStr));
  if (!rec) rec = recibos.find(r=>String(r.carpeta||'')===String(c.num));
  if (!rec) return 'Sin recibo vinculado';
  const saldo = rec.saldoPendiente!=null?rec.saldoPendiente:Math.max(0,(rec.total||0)-parseFloat(rec.anticipo||0));
  if (rec.cancelado) return '🚫 Cancelado';
  if (saldo<=0) return '✅ Liquidado';
  return '⚠ Saldo: $'+fmt(saldo);
}

async function groqBuscarIA(pregunta) {
  const res = document.getElementById('global-search-results');
  res.innerHTML = '<div class="gs-empty" style="color:rgba(139,92,246,0.7);">✨ Buscando con IA...</div>';
  res.classList.add('show');
  // Snapshot de datos del sistema (resumido para no exceder tokens)
  const snapshot = {
    recibos: (appData.recibos || []).map(r => ({
      folio: r.folio, nombre: r.nombre, fecha: r.fecha,
      total: r.total, saldoPendiente: r.saldoPendiente || 0,
      responsable: r.responsable || '', cancelado: r.cancelado || false
    })).slice(0, 80),
    juicios: (D.juicios || []).map(j => ({
      cliente: j.cliente, tipo: j.tipo, expediente: j.expediente,
      estatus: j.estatus, audiencia: j.audiencia, movimiento: j.movimiento
    })),
    pendientes: (D.pendientes || []).map(p => ({
      texto: p.texto, responsable: p.resp, prioridad: p.prioridad,
      resuelto: p.resuelto, fecha: p.fecha
    })),
    directorio: (D.directorio || []).map(d => ({
      nombre: d.nombre, tipo: d.tipo, tel: d.tel
    }))
  };
  const systemPrompt = `Eres un asistente de búsqueda para un despacho legal mexicano.
Recibirás datos del sistema (recibos, juicios, pendientes, directorio) y una pregunta en lenguaje natural.
Responde SOLO con un JSON válido con esta estructura exacta (sin markdown ni texto extra):
{
  "resultados": [
    { "tipo": "recibo|juicio|pendiente|directorio", "indice": 0, "titulo": "...", "razon": "..." }
  ],
  "explicacion": "Una frase breve explicando qué encontraste"
}
El campo "indice" es la posición en el array correspondiente (0-based).
Devuelve máximo 6 resultados relevantes. Si no hay resultados, devuelve array vacío.`;
  const userPrompt = `PREGUNTA: "${pregunta}"\n\nDATOS DEL SISTEMA:\n${JSON.stringify(snapshot)}`;
  try {
    // Usar _iaLlamar (Groq primero, Gemini como respaldo)
    const respuesta = await _iaLlamar(systemPrompt + '\n\n' + userPrompt, 800, 0.2, 'general');
    let parsed;
    try {
      parsed = JSON.parse(respuesta.replace(/```json|```/g, '').trim());
    } catch(e) {
      throw new Error('La IA devolvió un formato inesperado. Intenta reformular la pregunta.');
    }
    const items = parsed.resultados || [];
    if (!items.length) {
      res.innerHTML = `<div class="gs-empty">✨ ${esc(parsed.explicacion || 'Sin resultados para esa búsqueda.')}</div>`;
      return;
    }
    // Construir acciones para cada resultado
    const acciones = items.map(item => {
      let accion = () => {};
      if (item.tipo === 'recibo' && appData.recibos[item.indice]) {
        const r = appData.recibos[item.indice];
        accion = () => abrirPreviaDesdeContab(r.folio);
      } else if (item.tipo === 'juicio' && D.juicios[item.indice]) {
        accion = () => { ir('juicios'); setTimeout(() => abrirDetalle(item.indice), 150); };
      } else if (item.tipo === 'pendiente' && D.pendientes[item.indice]) {
        accion = () => { abrirPendiente(item.indice); };
      } else if (item.tipo === 'directorio' && D.directorio[item.indice]) {
        accion = () => { ir('directorio'); setTimeout(() => _abrirPerfilContacto(item.indice), 150); };
      }
      return { ...item, accion };
    });
    const iconos = { recibo: '🧾', juicio: '⚖️', pendiente: '📌', directorio: '👤' };
    let html = `<div class="gs-section"><div class="gs-section-title" style="color:rgba(139,92,246,0.8);">✨ ${esc(parsed.explicacion || 'Resultados IA')}</div>`;
    acciones.forEach((item, i) => {
      html += `<div class="gs-item" onclick="_groqGsClick(${i})">
        <div class="gs-item-icon">${iconos[item.tipo] || '📄'}</div>
        <div class="gs-item-main">
          <div class="gs-item-title">${esc(item.titulo)}</div>
          <div class="gs-item-sub" style="color:rgba(139,92,246,0.6);">${esc(item.razon)}</div>
        </div>
      </div>`;
    });
    html += '</div>';
    res.innerHTML = html;
    window._groqAcciones = acciones;
  } catch(e) {
    res.innerHTML = `<div class="gs-empty" style="color:var(--rojo);">⚠ ${esc(e.message)}</div>`;
  }
}

async function _limpiarBackupsViejos(did, ahora) {
  try {
    if (!window.listarR2) return;
    var prefix = did + '/backups/';
    var lista  = await window.listarR2(prefix, 'backups');
    if (!lista || !lista.length) return;
    var corte  = new Date(ahora - 90 * 86400000).toISOString().slice(0, 10);
    var viejos = lista.filter(function(item) {
      var nombre = (item.key || item.name || '').split('/').pop().replace('.json', '');
      return /^\d{4}-\d{2}-\d{2}$/.test(nombre) && nombre < corte;
    });
    if (!viejos.length) return;
    var eliminados = 0;
    for (var i = 0; i < viejos.length; i++) {
      try {
        var path = viejos[i].key || viejos[i].name || '';
        if (!path) continue;
        var _tokBackup = await _r2AuthToken();
        var url = R2_WORKER + '/r2/delete?path=' + encodeURIComponent(path)
                + '&bucket=backups';
        var res = await fetch(url, { method: 'DELETE', headers: { 'X-Auth-Token': _tokBackup } });
        if (res.ok) eliminados++;
      } catch(_){}
    }
    if (eliminados) console.log('[Backup] Snapshots viejos eliminados:', eliminados);
  } catch(e) { console.warn('[Backup] limpiar:', e); }
}

function calcSaldoRecibo(){
  var total=parsePrecioR((document.getElementById('r-total')||{}).value||'');
  var anticipo=parsePrecioR((document.getElementById('r-anticipo')||{}).value||'');
  var saldo=Math.max(0,total-anticipo);
  var el=document.getElementById('r-saldo');if(el)el.value=saldo>0?'$'+fmt(saldo):'—';
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

function renderRecibosRecientes() {
  var el=document.getElementById('recibos-recientes-panel');
  if (!el) return;
  var recent=(REC.recibos||[]).slice(0,8);
  if (!recent.length) { el.innerHTML='<div style="padding:14px;text-align:center;font-size:0.7rem;color:var(--muted);">Sin recibos aun</div>'; return; }
  el.innerHTML=recent.map(function(r) {
    var saldo=r.saldoPendiente!=null?r.saldoPendiente:Math.max(0,(r.total||0)-(r.anticipo||0));
    return '<div style="padding:10px 14px;border-bottom:1px solid var(--border-l);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<span style="font-family:JetBrains Mono,monospace;font-size:0.65rem;font-weight:700;color:var(--gold-d);">#'+folioConLetra(r.folio, r.anio_folio, r.letra||letraVersion(r)||'A')+'</span>' +
      '<span class="tag '+(saldo>0?'tag-a':'tag-v')+'" style="font-size:0.55rem;">'+(saldo>0?'Pendiente':'Liquidado')+'</span>' +
      '</div><div style="font-size:0.75rem;margin-top:2px;">'+esc(r.nombre)+'</div>' +
      '<div style="font-family:JetBrains Mono,monospace;font-size:0.62rem;color:var(--muted);">'+(r.fecha||'')+(saldo>0?' · $'+fmt(saldo)+' restante':' · Saldado')+'</div>' +
      '</div>';
  }).join('');
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
    // Vigencia estricta (banner visible + no caducado) — ver _capturaRetroVigente.
    if(typeof _capturaRetroVigente === 'function' ? _capturaRetroVigente() : window._capturaMesActivo){
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

function rcCurpCarrito(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  var p = parseFloat(document.getElementById('curp2-precio').value) || 0;
  var c = parseInt(document.getElementById('curp2-cant').value) || 1;
  var total = p * c;
  if(total <= 0){toast('El total debe ser mayor a $0','err');return;}
  var desc = c > 1 ? (c + '× CURP $' + fmt(p) + ' c/u') : ('Impresión CURP $' + fmt(p));
  // FIX (caso real: "[Carrito] ... Impresión CURP $45.00 $45.00" — precio
  // duplicado en el cobro conjunto): registrarCarrito() arma la descripción
  // final agregando SIEMPRE " $total" al final de cada item del carrito. El
  // texto de un solo CURP (arriba) ya trae el precio incluido dentro de
  // `desc` — a diferencia del resto de items del sistema, que solo llevan el
  // precio unitario ("c/u") o ningún precio — así que quedaba impreso dos
  // veces. Para el carrito se usa un texto SIN precio; `desc` (con precio)
  // se conserva solo para el toast, que no pasa por ese segundo "$total".
  var descCarrito = c > 1 ? desc : 'Impresión CURP';
  agregarAlCarrito(descCarrito, total, 'curp');
  cerrar('mRegistroCivil');
  var w = window.open('', '_blank');
  if(w){ w.location.href = 'https://www.gob.mx/curp/'; }
  toast('🛒 Agregado — ' + desc, 'ok');
}

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

async function _chequearCierreAutomaticoCaja() {
  try {
    if (!window.SB || !window.SB_DESPACHO_ID) return;
    const { data } = await window.SB.from('app_state')
      .select('caja_auto_cierre_pendiente, caja_auto_cierre_fecha')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .single();
    if (!data || data.caja_auto_cierre_pendiente !== true) return;
    const fechaObjetivo = data.caja_auto_cierre_fecha || hoy();
    // Si la fecha pendiente es HOY y hoy ya está cerrada (por click manual o
    // por otra pestaña que ya la procesó), no hay nada que repetir. Si la
    // fecha pendiente es un día ANTERIOR, se procesa siempre — que hoy esté
    // bloqueada o no es irrelevante para poner al corriente un día atrasado.
    if (fechaObjetivo === hoy() && cajaBloqueada()) return;
    await cerrarCajaAutomatico(fechaObjetivo);
  } catch(e) { registrarError('_chequearCierreAutomaticoCaja', e); }
}

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

function _inferirTipoFolioSecundario(r) {
  if (!r) return 'desconocido';
  // Pago total / Liquidación: _esPagoTotal explícito O saldo cero con pagos parciales
  if (r._esPagoTotal === true) return 'liquidacion';
  var saldo = parseFloat(r.saldoPendiente);
  var totalRec = parseFloat(r.total || 0);
  var pp = (r.pagosParciales || []).filter(function(p){ return !p._esAnticipoOriginal; });
  var ce = (r.costosExtra || []);
  // Liquidación: saldo pagado y tiene al menos un pago parcial nuevo (el abono final)
  if (!isNaN(saldo) && saldo <= 0 && totalRec > 0 && pp.length > 0) return 'liquidacion';
  // Pago parcial: saldo pendiente mayor a cero y tiene pagos parciales nuevos
  if (!isNaN(saldo) && saldo > 0 && pp.length > 0) return 'pago_parcial';
  // Servicio complementario: tiene costos extra y NO tiene pagos parciales nuevos
  if (ce.length > 0 && pp.length === 0) return 'servicio_complementario';
  // Servicio complementario con pago incluido: costos extra + pagos parciales
  if (ce.length > 0 && pp.length > 0) return 'servicio_complementario';
  // Fallback: si saldo cero sin pagos parciales, asumir liquidación
  if (!isNaN(saldo) && saldo <= 0 && totalRec > 0) return 'liquidacion';
  return 'desconocido';
}

async function fichaCerrarJuicio() {
  var recibo = window._fichaReciboActual || reciboEnConsulta;
  if (!recibo) return;
  // Textos por categoría (Juicio/Escritura conservan exactamente su texto original;
  // Trámite Normal y Vehicular usan la misma lógica respetando su propia categoría).
  var _cierreMap = {
    escritura: { nom:'escritura',          art:'esta', ico:'📜', cerrado:'Escritura cerrada' },
    juicio:    { nom:'juicio',             art:'este', ico:'⚖️', cerrado:'Juicio cerrado' },
    normal:    { nom:'trámite',            art:'este', ico:'📄', cerrado:'Trámite cerrado' },
    vehicular: { nom:'trámite vehicular',  art:'este', ico:'🚗', cerrado:'Trámite vehicular cerrado' }
  };
  var _c = _cierreMap[recibo.tipoTramite] || _cierreMap.juicio;
  if (!confirm('¿Estás seguro de cerrar definitivamente '+_c.art+' '+_c.nom+'?\nEsta acción liquidará el folio y no podrá reabrirse.')) return;
  // Marcar como cerrado y liquidar. `recibo` aquí suele ser la versión A
  // (window._fichaReciboActual la ancla así) — el cierre real del trámite le
  // pertenece a la versión MÁS RECIENTE del folio, así que modoCosto/liquidado
  // se marcan en A (metadato del folio completo) pero saldoPendiente=0 se
  // escribe sobre la última versión, para no corromper el histórico congelado
  // de A si el folio tuvo actualizaciones (mismo fix que en _fichaActualizarTotalesConCargos).
  recibo.modoCosto = 'cerrado';
  var _folioVivoCJ = Number(recibo.folio);
  var _versionesVivoCJ = (typeof appData !== 'undefined' && appData.recibos ? appData.recibos : [])
    .filter(function(x){ return x && Number(x.folio) === _folioVivoCJ && !x.esComplemento; });
  var _reciboVivoCJ = recibo;
  if (_versionesVivoCJ.length) {
    _versionesVivoCJ.sort(function(a, b){
      var la = (a.letra || 'A').toUpperCase(), lb = (b.letra || 'A').toUpperCase();
      return la < lb ? -1 : la > lb ? 1 : 0;
    });
    _reciboVivoCJ = _versionesVivoCJ[_versionesVivoCJ.length - 1];
  }
  _reciboVivoCJ.saldoPendiente = 0;
  _reciboVivoCJ.saldoNuevo = 0;
  _reciboVivoCJ.liquidado = true;
  recibo.liquidado = true;
  try {
    if(typeof save==='function') save();
    if(typeof _eliminarPendientePorFolio==='function') _eliminarPendientePorFolio(recibo.folio);
    if(typeof toast==='function') toast(_c.ico+' '+_c.cerrado+' y folio liquidado', 'ok');
  } catch(e) { console.warn('Error cerrando trámite:', e); }
  cerrarFichaFolio();
  setTimeout(function(){
    if(typeof ejecutarLiquidacionTotal==='function') ejecutarLiquidacionTotal();
  }, 300);
}
