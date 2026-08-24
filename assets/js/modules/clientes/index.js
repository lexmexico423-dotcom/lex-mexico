/* LEX-MÉXICO · Módulo clientes
 * Funciones extraídas sin modificar su contenido.
 */

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

async function _acuerdosBuscarDuplicados() {
  const jId = window._jdetId;
  if (!jId) { if (typeof toast === 'function') toast('⚠ Abre un expediente primero', 'err'); return; }
  if (typeof toast === 'function') toast('🔍 Revisando duplicados…', 'ok');
  const juicioActivo = D.juicios && D.juicios[typeof jdetIdx !== 'undefined' ? jdetIdx : _mexpIdx];
  const nombreCarpetaJuicio = (juicioActivo ? (juicioActivo.nombre || juicioActivo.cliente || 'Juicio') + ' - Exp.' + (juicioActivo.expediente || juicioActivo.num || jId) : 'Juicio-' + jId).replace(/[<>:"/\\|?*]/g,'_');
  const lista = await _acuerdosListarDriveFresco(jId, nombreCarpetaJuicio);
  const grupos = _acuerdosAgruparDuplicados(lista);
  if (!grupos.length) { if (typeof toast === 'function') toast('✓ No se encontraron duplicados', 'ok'); return; }
  const totalExtra = grupos.reduce((s,g) => s + g.length - 1, 0);
  const detalle = grupos.map(g => '• ' + (g[0].nombre || g[0].archivo) + ' (' + g.length + ' copias)').join('\n');
  const ok = await confirmarBonito({
    titulo: 'Duplicados encontrados',
    mensaje: 'Se encontraron ' + totalExtra + ' archivo(s) duplicado(s):\n\n' + detalle + '\n\nSe conservará la copia más reciente de cada uno y se eliminarán las demás (de Drive y de la lista). Esta acción no se puede deshacer.',
    btnSi: 'Sí, eliminar duplicados',
    btnNo: 'Cancelar',
    peligro: true
  });
  if (!ok) return;
  let listaLimpia = lista.slice();
  const token = await driveGetAccessToken();
  for (const grupo of grupos) {
    const sobrantes = grupo.slice(1); // el primero (más reciente) se conserva
    for (const sobra of sobrantes) {
      if (sobra.driveFileId && token) {
        try {
          await fetch('https://www.googleapis.com/drive/v3/files/' + sobra.driveFileId, {
            method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
          });
        } catch(e) { console.warn('[Acuerdos] No se pudo eliminar duplicado de Drive:', e); }
      }
      listaLimpia = listaLimpia.filter(a => a.id !== sobra.id);
    }
  }
  try { localStorage.setItem('lex_acuerdos_'+jId, JSON.stringify(listaLimpia)); } catch(e){}
  renderAcuerdosDrive(listaLimpia);
  if (typeof toast === 'function') toast('🗑 ' + totalExtra + ' duplicado(s) eliminado(s)', 'ok');
}

function clickSrv(s){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  if(s.p>0){
    elegirResponsable(function(resp){
      const mov={id:'M-'+Date.now(),folioCaja:generarFolioMovCaja(),fecha:hoy(),hora:hora(),descripcion:s.nom,monto:s.p,
        tipo:s.e?'egreso':'ingreso',cat:s.cat,fuente:'caja',responsable:resp};
      _registrarMovimiento(mov);save();renderCaja();setTimeout(()=>syncEstadoSupabaseDebounced(),100);
      toast(`${s.e?'▼':'▲'} ${s.nom} — $${fmt(s.p)}`,s.e?'err':'ok');
    });
  } else {
    abrirLibre(s);
  }
}

function _carpTextoBusqueda(c){
  const partes = [
    c.cliente, c.num, c.estatus, c.tipoTramite,
    c.juicioDesc, c.escTipo, c.escNotario, c.escVolumen, c.escInstrumento,
    c.regCivilTipo, c.docDesc
  ];
  _carpObsArray(c).forEach(o => partes.push(o.texto));
  return partes.filter(Boolean).join(' ').toLowerCase();
}

async function guardarCarpeta(){
  const numRaw=$('kNum').value.trim();
  const cliente=$('kCliente').value.trim();
  if(!numRaw){
    toast('El número de carpeta es obligatorio','err');
    const el=$('kNum'); if(el){el.style.borderColor='var(--rojo)';el.scrollIntoView({behavior:'smooth',block:'center'});el.focus();}
    return;
  }
  if(!cliente){
    toast('El cliente es obligatorio','err');
    const el=$('kCliente'); if(el){el.style.borderColor='var(--rojo)';el.scrollIntoView({behavior:'smooth',block:'center'});el.focus();}
    return;
  }
  // Formato CARP.- 1 (sin ceros a la izquierda, del 1 al infinito)
  const numFormateado = 'CARP.- ' + (parseInt(numRaw)||1);
  // Re-ubicar la carpeta por su número permanente (no por eiK a ciegas): si
  // D.carpetas se reordenó o se reconstruyó (p. ej. sincronización con
  // Supabase) mientras el modal estaba abierto, eiK puede apuntar ahora a
  // OTRA carpeta distinta — guardar ahí encima borraría datos ajenos.
  if(eiK>=0){
    const idxLive = eiKNum!=null ? D.carpetas.findIndex(x=>x.num===eiKNum) : -1;
    if(idxLive<0){
      toast('⚠ No se encontró la carpeta a guardar — vuelve a abrirla e inténtalo de nuevo','err');
      return;
    }
    eiK = idxLive;
    // Guardrail contra pérdida de datos: si el formulario guardaría las
    // Observaciones vacías pero la carpeta YA tenía texto real ahí, es más
    // probable que sea un error (el formulario no cargó bien) que una
    // intención real de borrarlo todo — se pide confirmación explícita.
    const _obsNuevoVacio = !_kObsState.some(o => String((o&&o.texto)||'').trim()!=='');
    const _obsViejo = D.carpetas[eiK] || {};
    const _teniaObsReal =
      (Array.isArray(_obsViejo.obsLista) && _obsViejo.obsLista.some(o => String((o&&typeof o==='object')?o.texto:o||'').trim()!=='')) ||
      (_obsViejo.obs && String(_obsViejo.obs).trim()!=='') ||
      (_obsViejo.descripcion && String(_obsViejo.descripcion).trim()!=='');
    if(_obsNuevoVacio && _teniaObsReal){
      const ok = await confirmarBonito({
        titulo: 'Observaciones vacías',
        mensaje: 'Esta carpeta ya tenía texto en Observaciones/Notas internas y así se guardaría vacío.\n\n¿Seguro que quieres borrar ese contenido?',
        btnSi: 'Sí, guardar vacío',
        btnNo: 'Cancelar',
        peligro: true
      });
      if(!ok) return;
    }
  }
  if(eiK<0){
    const existe=D.carpetas.find(x=>x.num===numFormateado);
    if(existe){toast('⚠ Ya existe la carpeta '+numFormateado,'err');return;}
  }
  const tipoTramite=$('kTipoTramite').value;
  // Descripción/Asunto, Total Pactado, Estado del Archivo y Prioridad se
  // quitaron del formulario (campo Estatus/Trámite ya cubre lo mismo que
  // Estado del Archivo). Para no borrar en silencio esos datos en carpetas
  // ya existentes que sí los tenían, se conservan tal cual venían al editar;
  // una carpeta nueva simplemente no los tiene.
  const c={
    num: eiK>=0?D.carpetas[eiK].num:numFormateado,
    cliente,
    // La antigua "Descripción/Asunto" ya se fusionó como nota #1 dentro de
    // obsLista (ver migración en abrirCarpeta) — se limpia aquí para que no
    // se vuelva a duplicar la próxima vez que se abra esta carpeta.
    descripcion: '',
    estatus:$('kEstatus').value.trim(), ingreso:$('kIngreso').value.trim(),
    celebEscritura:($('kCelebEscritura')||{value:''}).value.trim(),
    obsLista: _kObsState
      .map(o => ({ texto:String((o&&o.texto)||'').trim(), fecha:(o&&o.fecha)||_fechaHoyCorta() }))
      .filter(o => o.texto!==''),
    obs: _kObsState.map(o=>String((o&&o.texto)||'').trim()).filter(t=>t!=='').join('\n\n'),
    reciboOficial:($('kReciboOficial')||{value:''}).value.trim(),
    estadoArchivo: eiK>=0?(D.carpetas[eiK].estadoArchivo||''):'',
    prioridad: eiK>=0?(D.carpetas[eiK].prioridad||''):'',
    totalPactado: eiK>=0?(D.carpetas[eiK].totalPactado||0):0,
    tipoTramite,
    // fechaCreacion se conserva de la carpeta original al editar (o se rellena
    // ahora si nunca se registró); fechaModificacion sí se actualiza en cada
    // guardado — juntas alimentan el contador "Sin actividad >30 días".
    fechaCreacion: (eiK>=0 && D.carpetas[eiK].fechaCreacion) ? D.carpetas[eiK].fechaCreacion : new Date().toISOString(),
    fechaModificacion: new Date().toISOString(),
    juicioDesc: tipoTramite==='juicio'?$('kJuicioDesc').value.trim():'',
    escNotario: tipoTramite==='escritura'?$('kEscNotario').value.trim():'',
    escVolumen: tipoTramite==='escritura'?$('kEscVolumen').value.trim():'',
    escInstrumento: tipoTramite==='escritura'?$('kEscInstrumento').value.trim():'',
    escTipo: tipoTramite==='escritura'?$('kEscTipo').value.trim():'',
    regCivilTipo: tipoTramite==='registro_civil'?$('kRegCivilTipo').value:'',
    docDesc: tipoTramite==='documentos'?$('kDocDesc').value.trim():''
  };
  try {
    if(eiK>=0) D.carpetas[eiK]=c; else D.carpetas.unshift(c);
  } catch(e) {
    console.error('[guardarCarpeta] Error al modificar D.carpetas:', e);
    toast('Error al guardar carpeta: '+e.message,'err');
    return;
  }
  // 1. Cerrar modal inmediatamente — respuesta visual instantánea
  try { cerrar('mCarpeta'); } catch(e){ console.warn('[guardarCarpeta] cerrar:', e); }
  // 2. Re-renderizar la lista al instante
  try { renderCarp(); } catch(e){ console.warn('[guardarCarpeta] renderCarp:', e); }
  // 3. Actualizar badges si existen
  try { if(typeof badges==='function') badges(); } catch(e){ registrarError('catch vacio', e); }
  // 4. Toast de confirmación
  try { toast('Carpeta '+c.num+' guardada ✓'); } catch(e){ registrarError('catch vacio', e); }
  // 4.5 Si esta carpeta se creó desde "＋ Crear carpeta nueva" dentro del modal
  // de Escritura, vincular automáticamente el número recién creado de vuelta
  // al campo de la escritura (que sigue abierta detrás de este modal).
  if (eiK < 0 && window._crearCarpetaOrigenEscritura) {
    window._crearCarpetaOrigenEscritura = false;
    try {
      const inpEsc = document.getElementById('eNum');
      if (inpEsc) { inpEsc.value = c.num; inpEsc.style.borderColor = ''; }
      const listaComp = document.getElementById('eCompradores-list');
      if (listaComp && !listaComp.children.length && typeof escAgregarPersona === 'function') {
        escAgregarPersona('comprador', { nombre: c.cliente });
      }
      if (typeof toast === 'function') toast('📁 Carpeta ' + c.num + ' creada y vinculada a la escritura');
    } catch(e){ console.error('[guardarCarpeta] vínculo con escritura:', e); }
  }
  // 5. Persistir en Supabase de forma asíncrona (no bloquea la UI)
  try {
    save();
  } catch(e){ console.warn('[guardarCarpeta] save:', e); }
  try {
    saveCarpetas();
  } catch(e){ console.warn('[guardarCarpeta] saveCarpetas:', e); }
}

function _verRecibosCliente(nombre){
  // Navegar a Contabilidad con el nombre pre-filtrado
  ir('contabilidad');
  setTimeout(()=>{
    const el = document.getElementById('cBuscar');
    if(el){ el.value = nombre; renderContab(); }
  }, 150);
}

function _juEsResponsableNuestro(t){
  return !t || !t.responsable || t.responsable === 'nosotros';
}

function _juTerminosPropiosAbiertos(j){
  return _juTerminosAbiertos(j).filter(_juEsResponsableNuestro);
}

function renderJuicios(){
  // Total de juicios/expedientes registrados (todos los estatus), mismo
  // formato de caja que el contador de Pendientes.
  const _juTotBox = document.getElementById('juiciosTotalNum');
  if (_juTotBox) _juTotBox.textContent = (D.juicios || []).length;
  const q=($('juicioQ')?.value||'').toLowerCase();
  let l=D.juicios.filter(j=>{
    if(filtroJ!=='todos'&&j.estatus!==filtroJ)return false;
    if(q)return(j.cliente||'').toLowerCase().includes(q)||(j.expediente||'').toLowerCase().includes(q)||(j.tipo||'').toLowerCase().includes(q);
    return true;
  });
  const el=$('listaJuicios');
  // ── VISTA NUEVA: tira de indicadores + tabla comparable ────────────────
  // Sustituye las tarjetas por una tabla con dos columnas que antes no
  // existían y son las que sirven para trabajar: "Próxima actuación" y
  // "Vence". El estatus de urgencia ya NO se escribe a mano: se calcula del
  // término abierto más próximo, así no se desactualiza solo.
  if(typeof _juRenderListaTabla === 'function'){ _juRenderListaTabla(l, el); return; }
  if(!l.length){el.innerHTML='<div style="color:var(--muted);padding:24px;font-size:0.76rem;">Sin expedientes en este filtro.</div>';return;}
  const hoyD=new Date();
  el.innerHTML=l.map(j=>{
    const idx=D.juicios.indexOf(j);
    const tagC={'urgente':'tag-r','proceso':'tag-a','estable':'tag-v','concluido':'tag-m','inicio':'tag-b'}[j.estatus]||'tag-m';
    const tagL={'urgente':'🔴 Urgente','proceso':'🟡 En Proceso','estable':'🟢 Estable','concluido':'⚫ Concluido','inicio':'🔵 Inicio'}[j.estatus]||j.estatus;
    let alerta='';
    // Check próxima audiencia
    const audFecha=j.audiencia||proximaAudienciaDeTerminos(j);
    if(audFecha){
      const diff=Math.ceil((new Date(audFecha+'T12:00:00')-hoyD)/86400000);
      if(diff>=0&&diff<=30)alerta=`<div class="audiencia-alerta">⚠ Audiencia/Término en ${diff} día${diff===1?'':'s'} — ${audFecha}</div>`;
      else if(diff<0)alerta=`<div class="audiencia-alerta">🚨 Término vencido: ${audFecha}</div>`;
    }
    const folioTag=j.folioRecibo?`<span style="font-family:monospace;font-size:0.58rem;color:var(--gold-d);background:var(--gold-bg);border:1px solid var(--border-l);border-radius:10px;padding:1px 8px;">🧾 #${folioFormato(j.folioRecibo)}</span>`:'';
    const driveTag=j.driveFolderId?`<span style="font-size:0.58rem;color:var(--azul);background:var(--azul-l);border:1px solid rgba(26,74,138,0.15);border-radius:10px;padding:1px 8px;font-family:monospace;">📁 Drive</span>`:'';
    // FIX: había expedientes (como el de CRISTINA BAZANTE) cuyos acuerdos se
    // registraron en j.historial (tipo:'acuerdo', vía análisis de documentos)
    // en vez de en j.acuerdos (el formulario manual "Nuevo Acuerdo") — la
    // etiqueta marcaba 0 aunque sí había acuerdos reales. Se cuentan ambas
    // fuentes para reflejar la realidad sin importar por dónde se cargaron.
    const acuerdosCount=(j.acuerdos||[]).length + (j.historial||[]).filter(h=>h&&h.tipo==='acuerdo').length;
    const acuerdosTag=acuerdosCount?`<span style="font-size:0.58rem;color:var(--muted);background:var(--surface2);border:1px solid var(--border-l);border-radius:10px;padding:1px 8px;font-family:monospace;">📄 ${acuerdosCount} acuerdo${acuerdosCount===1?'':'s'}</span>`:'';
    const terminosVivos=(j.terminos||[]).filter(t=>!t.cumplido);
    const terminosTag=terminosVivos.length?`<span style="font-size:0.58rem;color:var(--amarillo);background:var(--amarillo-l);border:1px solid rgba(154,96,16,0.15);border-radius:10px;padding:1px 8px;font-family:monospace;">⏱ ${terminosVivos.length} término${terminosVivos.length===1?'':'s'}</span>`:'';
    return `<div class="juicio ${j.estatus}" onclick="abrirDetalle(${idx})">
      <div class="juicio-top">
        <div><div class="juicio-nombre">${esc(j.cliente)}</div><div class="juicio-tipo">${esc(j.tipo)}</div></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span class="tag ${tagC}">${tagL}</span>
          <span class="mono" style="font-size:0.62rem;color:var(--muted)">${esc(j.expediente)}</span>
        </div>
      </div>
      <div class="juicio-info">
        <div class="jdato"><strong>Juzgado:</strong> ${esc(j.juzgado)}</div>
        <div class="jdato"><strong>Ingreso:</strong> ${j.fechaIngreso||'—'}</div>
        ${j.tel?`<div class="jdato"><strong>Tel:</strong> ${esc(j.tel)}</div>`:''}
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;align-items:center;">
        ${folioTag}${driveTag}${acuerdosTag}${terminosTag}
        <button class="juicio-btn-vincular" onclick="event.stopPropagation();abrirGestionReciboJuicio(${idx})" title="${j.folioRecibo?'Cambiar / Desvincular recibo':'Vincular un recibo'}">
          ${j.folioRecibo?'✏️ Cambiar recibo':'🔗 Vincular recibo'}
        </button>
      </div>
      ${_finResumen(j.cliente, j.folioRecibo)}
      ${j.movimiento?`<div style="font-size:0.72rem;color:var(--gold-d);margin-top:6px;font-style:italic;">→ ${esc(j.movimiento)}</div>`:''}
      ${alerta}
    </div>`;
  }).join('');
}

function _abrirDetalleLegacyV1_NoUsar(idx){
  jdetIdx=idx;
  const j=D.juicios[idx];
  $('juicios-lista-view').style.display='none';
  const det=$('juicio-detalle');
  det.classList.add('visible');
  // Header
  $('jdet-nombre').textContent=j.cliente||'—';
  $('jdet-tipo').textContent=(j.tipo||'')+(j.expediente?' · Exp. '+j.expediente:'');
  // Estatus tag
  const tagC={'urgente':'tag-r','proceso':'tag-a','estable':'tag-v','concluido':'tag-m','inicio':'tag-b'}[j.estatus]||'tag-m';
  const tagL={'urgente':'🔴 Urgente','proceso':'🟡 En Proceso','estable':'🟢 Estable','concluido':'⚫ Concluido','inicio':'🔵 Inicio'}[j.estatus]||j.estatus;
  $('jdet-estatus-tag').className='tag '+tagC;
  $('jdet-estatus-tag').textContent=tagL;
  $('jdet-exp-badge').textContent=j.expediente?'Exp. '+j.expediente:'';
  // Folio
  if(j.folioRecibo){
    $('jdet-folio-badge').style.display='';
    $('jdet-folio-badge').textContent='🧾 Folio #'+folioFormato(j.folioRecibo);
  } else {
    $('jdet-folio-badge').style.display='none';
  }
  // Drive badge
  if(j.driveFolderId){
    $('jdet-drive-label').textContent='📂 '+j.driveFolderName;
    $('jdet-drive-badge').title='Abrir carpeta en Drive';
    $('jdet-drive-badge').onclick=()=>{
      // Solo abrir Drive si el ID es un ID real de Google Drive (empieza con 1 y tiene ~33 chars)
      const fid = j.driveFolderId || '';
      const esIdReal = fid.length > 25 && !fid.startsWith('juicio-');
      if(esIdReal){
        window.open('https://drive.google.com/drive/folders/'+fid,'_blank');
      } else {
        abrirVinculacionDrive();
      }
    };
  } else {
    $('jdet-drive-label').textContent='Vincular juicio';
    $('jdet-drive-badge').onclick=()=>abrirVinculacionDrive();
  }
  // Tab datos
  $('jd-expediente').textContent = j.expediente || '— Sin asignar —';
  // Control interno: si existe, mostrar; si no, mostrar botón para asignar
  const ciEl = $('jd-control-interno');
  if (ciEl) {
    if (j.controlInterno) {
      ciEl.innerHTML = '<span style="font-weight:700;color:var(--ink);">' + esc(j.controlInterno) + '</span>' +
        '<button onclick="editarControlInterno()" title="Editar" style="background:rgba(200,149,42,0.1);border:1px solid rgba(200,149,42,0.25);color:var(--gold-d);border-radius:3px;padding:2px 8px;font-size:0.58rem;cursor:pointer;font-family:\'JetBrains Mono\',monospace;font-weight:600;">✏️</button>';
    } else {
      ciEl.innerHTML = '<button onclick="editarControlInterno()" style="background:rgba(26,74,138,0.08);border:1px dashed rgba(26,74,138,0.3);color:var(--azul);border-radius:4px;padding:4px 10px;font-size:0.65rem;cursor:pointer;font-family:\'JetBrains Mono\',monospace;font-weight:600;letter-spacing:0.05em;">+ Asignar control interno</button>';
    }
  }
  $('jd-juzgado').textContent=j.juzgado||'—';
  $('jd-ingreso').textContent=j.fechaIngreso||'—';
  $('jd-audiencia').textContent=j.audiencia||proximaAudienciaDeTerminos(j)||'Sin audiencia programada';
  $('jd-tel').textContent=j.tel||'—';
  $('jd-movimiento').textContent=j.movimiento||'Sin movimientos registrados';
  $('jd-obs').textContent=j.obs||'';
  // Carpeta Drive: mostrar enlace clickeable o botón para vincular
  const driveEl = $('jd-drive-carpeta');
  if (driveEl) {
    if (j.driveFolderId) {
      const url = 'https://drive.google.com/drive/folders/' + j.driveFolderId;
      driveEl.innerHTML = '<a href="' + url + '" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:rgba(26,74,138,0.08);border:1px solid rgba(26,74,138,0.25);color:var(--azul);border-radius:4px;padding:6px 12px;text-decoration:none;font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;font-weight:600;transition:all 0.15s;">📁 Abrir carpeta en Drive ↗</a>' +
        '<button onclick="abrirVinculacionDrive()" title="Cambiar carpeta vinculada" style="margin-left:6px;background:none;border:1px solid var(--border-l);color:var(--muted);border-radius:3px;padding:4px 8px;font-size:0.58rem;cursor:pointer;font-family:\'JetBrains Mono\',monospace;">✏️</button>' +
        '<button onclick="desvincularCarpetaDrive()" title="Desvincular carpeta" style="margin-left:4px;background:none;border:1px solid var(--rojo-l);color:var(--rojo);border-radius:3px;padding:4px 8px;font-size:0.58rem;cursor:pointer;font-family:\'JetBrains Mono\',monospace;">✕</button>';
    } else {
      driveEl.innerHTML = '<button onclick="abrirVinculacionDrive()" style="background:rgba(26,74,138,0.08);border:1px dashed rgba(26,74,138,0.3);color:var(--azul);border-radius:4px;padding:6px 12px;font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;cursor:pointer;font-weight:600;letter-spacing:0.05em;">📁 Vincular carpeta de Drive</button>';
    }
  }
  renderFolioReciboDetalle(j);
  // Ir a tab datos
  switchJTab('datos',document.querySelector('.jdet-tab'));
  renderAcuerdos();
  renderTerminos();
}

function confirmarEliminarJuicio(idx){
  const j = D.juicios[idx];
  if(!j) return;
  const nombre = j.cliente || j.nombre || 'este expediente';
  const exp = j.expediente || j.num || '';
  const msg = '¿Eliminar el juicio de ' + nombre + (exp ? ' (Exp. '+exp+')' : '') + '?\n\nEsta acción no se puede deshacer.';
  if(!confirm(msg)) return;

  // Eliminar resúmenes de R2 y caché local antes de borrar el juicio
  const jId = j.id || idx;
  const lsKey = 'lex_acuerdos_' + jId;
  try {
    const acuerdos = JSON.parse(localStorage.getItem(lsKey) || '[]');
    acuerdos.forEach(ac => {
      if (ac.driveFileId && typeof _r2ResumenPath === 'function') {
        window.borrarR2(_r2ResumenPath(ac.driveFileId), 'expedientes')
          .catch(e => console.warn('[EliminarJuicio] R2:', e));
      }
    });
    localStorage.removeItem(lsKey);
  } catch(e) { console.warn('[EliminarJuicio] limpieza:', e); }

  _marcarJuicioEliminadoLocal(j.id);
  D.juicios.splice(idx, 1);
  try { backupLocal('D', D); } catch(e){ registrarError('catch vacio', e); }
  saveJuicios();
  cerrarDetalle();
  renderJuicios();
  badges();
  toast('Juicio eliminado', 'ok');
}

function abrirJuicioEdit(idx){
  const j=idx>=0?D.juicios[idx]:{};
  $('jCli').value=j.cliente||''; const jTipoEl=$('jTipo'); if(jTipoEl){ jTipoEl.value=j.tipo||''; if(!jTipoEl.value && j.tipo) jTipoEl.setAttribute('value',j.tipo||''); }
  if($('jCalidad')) $('jCalidad').value = j.calidadCliente || '';
  $('jExp').value=j.expediente||'';$('jJuz').value=j.juzgado||'Juzgado Mixto Juxtlahuaca';
  $('jFIng').value=j.fechaIngreso||'';$('jAud').value=j.audiencia||'';
  $('jEst').value=j.estatus||'proceso';$('jTel').value=j.tel||'';
  $('jMov').value=j.movimiento||'';$('jObs').value=j.obs||'';
  // Control interno (campo nuevo)
  if($('jCtrlInt')) $('jCtrlInt').value = j.controlInterno || '';
  $('mJTitulo').textContent=idx>=0?'Editar Expediente':'Nuevo Expediente';
  eiJ=idx;
  try{ _mJuActualizarVinculaciones(idx>=0?j:null, idx); }catch(e){ registrarError('mJuicio · vinculaciones', e); }
  $('mJuicio').classList.add('show');
}

function _juActualizarHintResponsable(){
  const hint = document.getElementById('trResponsableHint');
  if(!hint) return;
  const j = D.juicios[jdetIdx];
  const calidad = j && j.calidadCliente ? _JU_CALIDAD_LABELS[j.calidadCliente] : null;
  hint.textContent = calidad
    ? 'Representamos a: ' + (j.cliente||'nuestro cliente') + ' (' + calidad + ')'
    : 'Sugerencia: define la calidad de nuestro cliente en "Editar Expediente" para tener esta referencia aquí.';
}

function abrirNuevoTermino(){
  _terminoEditIdx = null;
  $('trTipo').value='Audiencia';$('trDesc').value='';$('trFecha').value='';$('trHora').value='';$('trNota').value='';
  if($('trResponsable')) $('trResponsable').value='nosotros';
  _juActualizarHintResponsable();
  // Limpiar y preparar la calculadora de vencimiento
  try{
    _juLlenarCatalogoPlazos();
    const c=document.getElementById('trPlazoCat'); if(c) c.value='';
    const n=document.getElementById('trNotif');    if(n) n.value='';
    const d=document.getElementById('trDias');     if(d) d.value='';
    const h=document.getElementById('trHabiles');  if(h) h.value='1';
    _juRecalcularVenc();
  }catch(e){ console.warn('[Juicios] calculadora de plazos:', e); }
  const hdr = document.querySelector('#mNuevoTermino .modal-hdr h3');
  if(hdr) hdr.textContent = '⏱ Agregar Término / Audiencia';
  const btn = document.querySelector('#mNuevoTermino .btn-primary');
  if(btn) btn.textContent = '💾 Guardar';
  $('mNuevoTermino').classList.add('show');
}

function editarTermino(i){
  const j=D.juicios[jdetIdx];if(!j||!j.terminos)return;
  const sorted=j.terminos.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const t=sorted[i];if(!t)return;
  _terminoEditIdx = j.terminos.findIndex(x=>x.id===t.id);
  $('trTipo').value  = t.tipo||'Audiencia';
  $('trDesc').value  = t.descripcion||'';
  $('trFecha').value = t.fecha||'';
  $('trHora').value  = t.hora||'';
  $('trNota').value  = t.nota||'';
  if($('trResponsable')) $('trResponsable').value = t.responsable || 'nosotros';
  _juActualizarHintResponsable();
  // Recuperar los datos del cálculo si el término se creó con la calculadora
  try{
    _juLlenarCatalogoPlazos();
    const c=document.getElementById('trPlazoCat'); if(c) c.value='';
    const n=document.getElementById('trNotif');    if(n) n.value = t.fechaNotificacion || '';
    const d=document.getElementById('trDias');     if(d) d.value = t.dias || '';
    const h=document.getElementById('trHabiles');  if(h) h.value = (t.habiles === false) ? '0' : '1';
    const out=document.getElementById('trCalcResultado');
    if(out && !t.fechaNotificacion){
      out.textContent = 'Este término se capturó con fecha directa. Puedes recalcularlo aquí si quieres.';
      out.style.color = 'var(--muted)';
    }
  }catch(e){ console.warn('[Juicios] calculadora de plazos:', e); }
  const hdr = document.querySelector('#mNuevoTermino .modal-hdr h3');
  if(hdr) hdr.textContent = '✏ Editar Término / Audiencia';
  const btn = document.querySelector('#mNuevoTermino .btn-primary');
  if(btn) btn.textContent = '💾 Actualizar';
  $('mNuevoTermino').classList.add('show');
}

async function cargarCarpetasDrive(){
  // Cargar carpetas reales de Google Drive desde la carpeta JUICIOS
  try {
    const token = await driveGetAccessToken();
    if(!token){
      // Sin token — usar lista de juicios como fallback
      driveFoldersCache = (D.juicios || []).map(j => ({
        id: '', // Sin ID real de Drive
        name: j.expediente ? (j.expediente + ' — ' + (j.cliente||'')) : (j.cliente || 'Juicio')
      }));
      return;
    }
    // Buscar subcarpetas dentro de la carpeta JUICIOS
    const q = "mimeType='application/vnd.google-apps.folder' and trashed=false and '1jgwqgCv0OAD9NBDimlY6L-9bfCktqyz0' in parents";
    const url = 'https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)
      +'&fields=files(id,name)&pageSize=50&orderBy=name'
      +'&includeItemsFromAllDrives=true&supportsAllDrives=true';
    const resp = await fetch(url, { headers:{ Authorization:'Bearer '+token } });
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const data = await resp.json();
    driveFoldersCache = (data.files || []).map(f => ({ id: f.id, name: f.name }));
    console.log('[Drive] Carpetas cargadas:', driveFoldersCache.length);
  } catch(e){
    console.warn('cargarCarpetasDrive:', e);
    // Fallback: lista vacía — no mostrar IDs falsos
    driveFoldersCache = [];
  }
}

function _actualizarBadgeArchivoVinculado(c) {
  const badge=document.getElementById('badge-archivo-vinculado');
  const btn=document.getElementById('btn-vincular-archivo');
  if(!badge||!btn)return;
  if(c){
    badge.style.display='block';
    btn.style.borderColor='#1a7a3a'; btn.style.color='#1a7a3a';
    btn.title='Carpeta #'+c.num+' — '+c.cliente+' (vinculada)';
  }else{
    badge.style.display='none';
    btn.style.borderColor='#1a4a8a'; btn.style.color='#1a4a8a';
    btn.title='Vincular con Carpetas (solo interno)';
  }
}

async function _placasBuscarEnDrive(nombreArchivo, token, carpetaCliente){
  try{
    const q = "name = '" + nombreArchivo.replace(/'/g, "\\'") + "' and '" + carpetaCliente + "' in parents and trashed = false";
    const url = 'https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name)&pageSize=1';
    const resp = await _sbConTimeout(fetch(url, { headers:{ Authorization:'Bearer '+token } }), 10000, 'Drive buscar '+nombreArchivo);
    if(!resp.ok) return null;
    const data = await resp.json();
    return (data.files && data.files.length) ? data.files[0] : null;
  }catch(e){
    console.warn('[Drive placas] no se pudo verificar duplicado de '+nombreArchivo+':', e && e.message);
    return null;
  }
}

async function _placasNombreCopiaLibre(nombreArchivo, token, carpetaCliente){
  const punto = nombreArchivo.lastIndexOf('.');
  const base = punto > 0 ? nombreArchivo.slice(0, punto) : nombreArchivo;
  const ext  = punto > 0 ? nombreArchivo.slice(punto)   : '';
  for(let n = 2; n <= 50; n++){
    const cand = base + ' (' + n + ')' + ext;
    if(!(await _placasBuscarEnDrive(cand, token, carpetaCliente))) return cand;
  }
  return base + ' (' + Date.now() + ')' + ext;
}

async function _placasSubirResumibleDrive(file, token, carpetaCliente, nombreArchivo, reemplazarId, onProgreso){
  const esReemplazo = !!reemplazarId;
  const url = esReemplazo
    ? 'https://www.googleapis.com/upload/drive/v3/files/'+reemplazarId+'?uploadType=resumable&fields=id'
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id';
  const meta = esReemplazo ? {} : { name: nombreArchivo, parents: [carpetaCliente] };
  const inicio = await _sbConTimeout(fetch(url, {
    method: esReemplazo ? 'PATCH' : 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type':   file.type || 'application/octet-stream',
      'X-Upload-Content-Length': String(file.size)
    },
    body: JSON.stringify(meta)
  }), 20000, 'Drive iniciar subida '+nombreArchivo);
  if(!inicio.ok){
    throw new Error('No se pudo iniciar la subida (HTTP ' + inicio.status + ')');
  }
  const sessionUri = inicio.headers.get('Location') || inicio.headers.get('location');
  if(!sessionUri) throw new Error('Drive no devolvió la URL de subida');
  // Tiempo máximo proporcional al tamaño (base 60s + 15s por MB, tope 15 min),
  // porque un archivo de decenas de MB no cabe en el límite fijo de 20s.
  const mb = file.size / (1024*1024);
  const timeoutMs = Math.min(15*60*1000, Math.round(60000 + mb * 15000));
  const data = await _placasPutConProgreso(sessionUri, file, onProgreso, timeoutMs);
  return { id: data.id || reemplazarId, nombreArchivo };
}

async function _placasSubirArchivoDrive(file, token, carpetaCliente, nombreForzado, reemplazarId, onProgreso){
  const nombreArchivo = nombreForzado || _placasNombreLimpio(file.name);
  // Se guarda el detalle del último fallo para poder REGISTRARLO. Antes solo se
  // hacía console.warn, así que el panel "Errores del Sistema" de SCANSYS PRO
  // salía en cero aunque la subida hubiera fallado.
  let _ultimoDetalle = 'motivo desconocido';
  for(let intento=1; intento<=2; intento++){
    try{
      // Archivos grandes → subida resumible (la directa no los soporta).
      if(file.size > _DRIVE_UMBRAL_RESUMIBLE){
        return await _placasSubirResumibleDrive(file, token, carpetaCliente, nombreArchivo, reemplazarId, onProgreso);
      }
      let resp;
      if(reemplazarId){
        // Reemplazo: solo se sustituye el contenido del archivo ya existente.
        resp = await _sbConTimeout(fetch('https://www.googleapis.com/upload/drive/v3/files/'+reemplazarId+'?uploadType=media&fields=id',{
          method:'PATCH', headers:{ Authorization:'Bearer '+token, 'Content-Type': file.type || 'application/octet-stream' }, body:file
        }), 20000, 'Drive reemplazo '+file.name);
      } else {
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({name:nombreArchivo,parents:[carpetaCliente]})],{type:'application/json'}));
        form.append('file', file);
        resp = await _sbConTimeout(fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',{
          method:'POST', headers:{Authorization:'Bearer '+token}, body:form
        }), 20000, 'Drive subida '+file.name);
      }
      if(resp.ok){
        const data = await resp.json();
        return { id: data.id || reemplazarId, nombreArchivo };
      }
      const _cuerpo = await resp.text().catch(function(){ return ''; });
      _ultimoDetalle = 'HTTP ' + resp.status + (resp.statusText ? ' ' + resp.statusText : '') + (_cuerpo ? ' — ' + _cuerpo.slice(0,300) : '');
      // 401 = token vencido a media subida: no tiene caso reintentar igual
      if(resp.status === 401){
        if(typeof registrarError === 'function') registrarError('Placas · subida a Drive',
          new Error('Token de Drive rechazado (401) al subir "'+nombreArchivo+'"'),
          { archivo:nombreArchivo, bytes:file.size, tipo:file.type||'', detalle:_ultimoDetalle });
        return null;
      }
    }catch(e){
      _ultimoDetalle = (e && e.message) || String(e);
      console.warn('[Drive placas] intento '+intento+'/2 falló para '+file.name+':', _ultimoDetalle);
    }
  }
  // Se agotaron los intentos: ahora SÍ queda asentado en "Errores del Sistema".
  if(typeof registrarError === 'function') registrarError('Placas · subida a Drive',
    new Error('No se pudo subir "'+nombreArchivo+'" tras 2 intentos: '+_ultimoDetalle),
    { archivo:nombreArchivo, bytes:file.size, mb:(file.size/1024/1024).toFixed(1)+' MB', tipo:file.type||'', reemplazo:!!reemplazarId, detalle:_ultimoDetalle });
  return null;
}

function _placasPreguntarDuplicado(nombreArchivo, nombreCliente){
  return new Promise(function(resolve){
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(10,6,2,0.72);display:flex;align-items:center;justify-content:center;padding:20px;';
    const card = document.createElement('div');
    card.style.cssText = 'background:#fdfaf3;border:2px solid #c8952a;border-radius:12px;max-width:520px;width:100%;padding:22px;font-family:monospace;box-shadow:0 18px 50px rgba(0,0,0,0.5);';
    card.innerHTML =
      '<div style="font-size:0.95rem;font-weight:700;color:#8c6518;margin-bottom:10px;">Este archivo ya existe en Drive</div>'
      + '<div style="font-size:0.78rem;color:#3a2a10;line-height:1.6;margin-bottom:6px;">En la carpeta de <strong>' + escHTML(nombreCliente) + '</strong> ya hay un archivo llamado:</div>'
      + '<div style="font-size:0.8rem;color:#1a1008;background:#f3ead6;border:1px solid #e0cfa8;border-radius:6px;padding:8px 10px;margin-bottom:14px;word-break:break-all;">' + escHTML(nombreArchivo) + '</div>'
      + '<div style="font-size:0.72rem;color:#6a5230;line-height:1.6;margin-bottom:16px;">¿Qué quieres hacer?</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px;">'
      + '<button data-op="reemplazar" style="padding:11px;border-radius:7px;border:1.5px solid #a0560a;background:#a0560a;color:#fff;font-family:inherit;font-size:0.76rem;font-weight:700;cursor:pointer;">Reemplazar el que ya está</button>'
      + '<button data-op="copia" style="padding:11px;border-radius:7px;border:1.5px solid #c8952a;background:#fff;color:#8c6518;font-family:inherit;font-size:0.76rem;font-weight:700;cursor:pointer;">Guardar los dos (se renombra como copia)</button>'
      + '<button data-op="cancelar" style="padding:11px;border-radius:7px;border:1.5px solid #bbb;background:#fff;color:#666;font-family:inherit;font-size:0.76rem;cursor:pointer;">No subir este archivo</button>'
      + '</div>';
    ov.appendChild(card);
    document.body.appendChild(ov);
    card.addEventListener('click', function(ev){
      const op = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-op');
      if(!op) return;
      try{ ov.remove(); }catch(e){}
      resolve(op);
    });
  });
}

function vincularReciboVehicular(folio){
  _pPlacasState.reciboFolio = folio;
  document.getElementById('pPlacasReciboFolio').value = '#'+folioFormato(folio);
  cerrar('mSelRecVeh');
  // Auto-llenar campos con datos del recibo
  const r = ((typeof appData !== 'undefined' ? appData : (typeof REC !== 'undefined' ? REC : {recibos:[]})).recibos || [])
    .find(x => String(x.folio) === String(folio));
  if (r) {
    // Auto-rellenar nombre del cliente del recibo si el campo está vacío
    const pNombre = document.getElementById('pPlacasNombre');
    if (pNombre && !pNombre.value.trim() && r.nombre) pNombre.value = r.nombre;
    // Auto-rellenar placa si está disponible y vacía
    const pNum = document.getElementById('pPlacasNumero');
    const placa = r.placa || r.placasEntregadas;
    if (pNum && !pNum.value.trim() && placa) pNum.value = placa;
    // Auto-rellenar estado si está disponible y vacío
    const pEst = document.getElementById('pPlacasEstado');
    if (pEst && !pEst.value && r.estadoPlacas) {
      // Verificar que sea una opción válida
      const opciones = Array.from(pEst.options).map(o => o.value);
      if (opciones.includes(r.estadoPlacas)) pEst.value = r.estadoPlacas;
    }
  }
  _pPlacasActualizarInfoRecibo();
  toast('Recibo vinculado ✓');
}

async function _pPlacasVerExpediente(){
  const nombre = document.getElementById('pPlacasNombre')?.value.trim();
  const cont = document.getElementById('pPlacasExpedienteList');
  if (!cont) return;
  if (!nombre) { toast('Ingresa el nombre del cliente primero','err'); return; }
  if (!window.SB_DESPACHO_ID || typeof window.listarR2 !== 'function') { toast('Sin conexion R2','err'); return; }
  cont.style.display = 'block';
  cont.innerHTML = '<div style="padding:12px;text-align:center;font-size:0.78rem;color:var(--muted);">Cargando...</div>';
  const nombreSafe = nombre.replace(/[^a-zA-Z0-9]/g,'_').substring(0,40);
  const prefix = window.SB_DESPACHO_ID + '/placas/' + nombreSafe + '/';
  const archivos = await window.listarR2(prefix, 'recibos');
  if (!archivos.length) {
    cont.innerHTML = '<div style="padding:12px;text-align:center;font-size:0.78rem;color:var(--muted);">Sin archivos en R2 para este cliente.</div>';
    return;
  }
  const fmtSize = b => b < 1024 ? b+'B' : b < 1048576 ? (b/1024).toFixed(1)+'KB' : (b/1048576).toFixed(1)+'MB';
  cont.innerHTML =
    '<div style="padding:8px 12px;background:var(--gold-pale);font-size:0.65rem;font-family:monospace;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold-d);border-bottom:1px solid var(--border);">🗂 Expediente R2 — '+esc(nombre)+' ('+archivos.length+' archivo'+(archivos.length===1?'':'s')+')</div>' +
    archivos.map(function(a){
      const ico = /\.pdf$/i.test(a.name) ? '📄' : '🖼';
      const fecha = a.uploaded ? new Date(a.uploaded).toLocaleDateString('es-MX') : '';
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid var(--border);font-size:0.78rem;">' +
        '<span>'+ico+'</span>' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(a.key)+'">'+esc(a.name)+'</span>' +
        '<span style="font-size:0.65rem;color:var(--muted);white-space:nowrap;">'+fmtSize(a.size||0)+(fecha?' · '+fecha:'')+'</span>' +
        '<button type="button" class="btn btn-ghost" style="padding:2px 8px;font-size:0.7rem;" onclick="_pPlacasAbrirR2(\''+esc(a.key)+'\',\''+esc(a.name)+'\')">👁 Ver</button>' +
      '</div>';
    }).join('');
}

function _pJuiCargar(p){
  _pJuiState.juicioIdx = (p && typeof p.juicioVinculadoIdx === 'number') ? p.juicioVinculadoIdx : -1;
  const _set = (id, val) => { const e = document.getElementById(id); if (e) e.value = val || ''; };
  _set('pJuiCliente',    p && p.juiCliente);
  _set('pJuiExpediente', p && p.juiExpediente);
  const tipoEl = document.getElementById('pJuiTipo');
  if (tipoEl) tipoEl.value = (p && p.juiTipo) || 'Juicio Ordinario Civil';
  _set('pJuiEtapa',     p && p.juiEtapa);
  _set('pJuiTermino',   p && p.juiTermino);
  _set('pJuiAudiencia', p && p.juiAudiencia);
  _set('pJuiDesc',      p && p.juiDescripcion);
  _pJuiActualizarVinculacionUI();
}

function _pJuiLimpiar(){
  _pJuiState = { juicioIdx: -1 };
  ['pJuiCliente','pJuiExpediente','pJuiEtapa','pJuiTermino','pJuiAudiencia','pJuiDesc','pJuiExpedienteVinc'].forEach(id=>{
    const e = document.getElementById(id); if (e) e.value = '';
  });
  const tipoEl = document.getElementById('pJuiTipo');
  if (tipoEl) tipoEl.value = 'Juicio Ordinario Civil';
  _pJuiActualizarVinculacionUI();
}

function _pJuiRecopilar(){
  return {
    juicioVinculadoIdx: _pJuiState.juicioIdx,
    juiCliente:     document.getElementById('pJuiCliente')?.value.trim() || '',
    juiExpediente:  document.getElementById('pJuiExpediente')?.value.trim() || '',
    juiTipo:        document.getElementById('pJuiTipo')?.value || '',
    juiEtapa:       document.getElementById('pJuiEtapa')?.value.trim() || '',
    juiTermino:     document.getElementById('pJuiTermino')?.value.trim() || '',
    juiAudiencia:   document.getElementById('pJuiAudiencia')?.value || '',
    juiDescripcion: document.getElementById('pJuiDesc')?.value.trim() || ''
  };
}

function vincularJuicio(idx){
  _pJuiState.juicioIdx = idx;
  const j = D.juicios[idx];
  if (!j) return;
  // Auto-rellenar campos
  document.getElementById('pJuiCliente').value    = j.cliente || '';
  document.getElementById('pJuiExpediente').value = j.expediente || '';
  if (j.tipo) {
    const sel = document.getElementById('pJuiTipo');
    const opciones = Array.from(sel.options).map(o => o.value);
    if (opciones.includes(j.tipo)) sel.value = j.tipo;
    else sel.value = 'Otro';
  }
  if (j.audiencia && !document.getElementById('pJuiAudiencia').value) {
    document.getElementById('pJuiAudiencia').value = j.audiencia;
  }
  cerrar('mSelJuicio');
  _pJuiActualizarVinculacionUI();
  toast('Expediente vinculado ✓');
}

function pPersonaInput(){
  const q=($('pPersona').value||'').trim().toLowerCase();
  const sug=document.getElementById('pPersonaSug');
  if(!sug) return;
  if(q.length < 2){ sug.style.display='none'; return; }
  // Buscar en recibos originales (no complementos)
  const src = (typeof appData!=='undefined'?appData:REC).recibos || [];
  // Agrupar por nombre: tomar el recibo más reciente por cliente
  const visto={};
  src.filter(r=>!r.esComplemento && r.nombre && r.nombre.toLowerCase().includes(q))
     .sort((a,b)=>b.folio-a.folio)
     .forEach(r=>{ if(!visto[r.nombre.toLowerCase()]) visto[r.nombre.toLowerCase()]=r; });
  const matches=Object.values(visto).slice(0,6);
  if(!matches.length){ sug.style.display='none'; return; }
  sug.innerHTML=matches.map(r=>`
    <div onclick="pSeleccionarPersona(${r.folio}, '${escHTML((r.nombre||'').replace(/'/g,"\\'"))}', '${escHTML((r.tramites||r.conceptos&&r.conceptos[0]&&r.conceptos[0].descripcion||'').replace(/'/g,"\\'").substring(0,40))}')"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-l);font-size:0.8rem;transition:background 0.1s;"
      onmouseover="this.style.background='var(--gold-pale)'" onmouseout="this.style.background=''">
      <span style="font-weight:600;color:var(--ink);">${escHTML(r.nombre||'')}</span>
      <span style="font-family:monospace;font-size:0.6rem;color:var(--gold-d);margin-left:8px;">Folio #${folioConLetra(r.folio, r.anio_folio, r.letra||letraVersion(r)||'A')}</span>
      <div style="font-size:0.65rem;color:var(--muted);margin-top:2px;">${escHTML(r.fecha||'')} · ${escHTML(r.tramites||'')}</div>
    </div>`).join('');
  sug.style.display='block';
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

function agregarClienteRecibo() {
  if (reciboFrozen) return;
  rClientes.push({ nombre:'', telefono:'', direccion:'' });
  renderClientesRecibo();
}

function eliminarCliente(i) {
  if (reciboFrozen) return;
  rClientes.splice(i,1);
  renderClientesRecibo();
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
  // _tomarFolioSeguro usa lock para evitar colisiones si dos secretarias imprimen simultáneamente
  var folio = await _tomarFolioSeguro();
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
    tipodocRecibo: (typeof recTipoDoc!=='undefined' && recTipoDoc==='escaneo') ? 'DOCUMENTOS QUE SE ESCANEARON' : 'DOCUMENTOS EN COPIA SIMPLE',
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
    var _docRI = await generarPDF(datos, folio, qrDataURL);
    var blob = _docRI.output('blob');
    datos.pdfBase64 = _docRI.output('datauristring');
    lastPdfBlob = blob;
    // ── Guardar PDF en R2 con nombre descriptivo ──
    var _folioRIStr = typeof folioConLetra === 'function'
      ? folioConLetra(folio, (typeof appData !== 'undefined' ? appData.anioFolioActual : null) || new Date().getFullYear(), 'A')
      : String(folio);
    var _r2NombreRI = typeof _nombreArchivoR2 === 'function'
      ? _nombreArchivoR2(_folioRIStr, rClientes[0] ? rClientes[0].nombre : datos.nombre)
      : _folioRIStr + '.pdf';
    if (typeof subirR2 === 'function' && window.SB_DESPACHO_ID) {
      const r2Path = window.SB_DESPACHO_ID + '/recibos/' + _r2NombreRI;
      subirR2(new File([blob], _r2NombreRI, {type:'application/pdf'}), r2Path, 'recibos')
        .then(ok => { if(ok) console.log('PDF guardado en R2:', r2Path); });
    }
    datos.archivoR2 = _r2NombreRI;
    if (!REC.recibos) REC.recibos = [];
    REC.recibos.unshift(datos);
    // ── Sincronizar con appData.recibos para que Contabilidad lo vea ──
    if(typeof appData!=='undefined'){
      if(!appData.recibos) appData.recibos=[];
      if (typeof _revivirSiTombstone === 'function') _revivirSiTombstone(datos);
      const yaExiste=appData.recibos.findIndex(r=>r.folio===datos.folio&&(r.letra||(typeof letraVersion==='function'?letraVersion(r):'A')||'A')===(datos.letra||'A'));
      if(yaExiste>=0) appData.recibos[yaExiste]=datos;
      else appData.recibos.unshift(datos);
    }
    pendingNextFolioRecibo = folio + 1;
    // Actualizar contadores locales ANTES de cualquier save() para que syncEstadoSupabase
    // use el valor correcto y no revierta folio_actual al número ya usado.
    REC.folioActual = folio + 1;
    if(typeof appData!=='undefined') appData.folioActual = folio + 1;
    await guardarFolioEnDrive(folio + 1);
    // CORRECCIÓN: subirPDFaD NO debe bloquear el flujo con await — si falla o tarda,
    // imprimirBlob(blob) nunca se ejecutaba y el usuario no recibía su PDF.
    // Se convierte a fire-and-forget igual que en _imprimirActualizacionReal.
    subirPDFaD(blob, 'LEX-Recibo-' + folioFormato(folio) + '-' + datos.nombre.replace(/[^a-zA-Z0-9]/g,'_').substring(0,30) + '.pdf')
      .catch(function(e){ console.warn('[subirPDFaD recibo inicial]', e); });
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
    // ── REGISTRAR EN CAJA/CONTABILIDAD — siempre, incluso si monto=$0 ──────
    // Los recibos sin anticipo se registran como "Sin Anticipo" con monto $0.
    // NO se usa datos.total para evitar registrar ingresos ficticios cuando
    // el cliente no dejó ningún pago al momento de generar el recibo.
    const _montoMov = datos.anticipo > 0 ? datos.anticipo : 0;
    if(typeof D !== 'undefined' && Array.isArray(D.movimientos)){
      const _esLiq         = datos.anticipo >= datos.total && datos.total > 0;
      const _esSinAnticipo = _montoMov === 0 && parseFloat(datos.total || 0) > 0;
      const _folioStr = folioFormato(folio);
      const _estatusRec  = _esLiq ? 'Liquidado' : (_esSinAnticipo ? 'Sin Anticipo' : (_montoMov > 0 ? 'Anticipo' : 'Pendiente'));
      const _c0Nuevo = datos.conceptos && datos.conceptos[0];
      const _txtConcNuevo = _c0Nuevo ? ((_c0Nuevo.concepto||'') + (_c0Nuevo.descripcion ? ' — ' + _c0Nuevo.descripcion : '')) : '';
      const mov = {
        id: 'M-REC-NEW-' + folio + '-' + Date.now(),
        folioCaja: typeof generarFolioMovCaja === 'function' ? generarFolioMovCaja() : '',
        fecha: datos.fecha || (typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0]),
        hora: datos.hora || (typeof hora === 'function' ? hora() : ''),
        descripcion: _txtConcNuevo || _folioStr,
        nombre: datos.nombre,
        folio: folio,
        monto: _montoMov,
        tipo: 'ingreso',
        cat: _estatusRec + ' · #' + _folioStr,
        estatus: _estatusRec,
        fuente: 'recibo',
        letra: 'A', /* ⚠️ CRÍTICO — NO QUITAR: sin esta línea, _fila() toma la letra de la versión más reciente */
        responsable: datos.generadoPor || (typeof empNombre === 'function' ? empNombre() : '')
      };
      _registrarMovimiento(mov);
      if(typeof renderCaja === 'function') renderCaja();
      setTimeout(()=>syncEstadoSupabaseDebounced(),100);
    }
    // ── PRE-RECIBO de origen: marcarlo convertido SOLO ahora que el recibo
    // se generó realmente (botón Imprimir/Generar confirmado). Si el usuario
    // entró al formulario desde "Convertir a Recibo" pero se regresó sin
    // generar, el pre-recibo permanece intacto en su lista.
    if (window._prDatosParaRecibo && window._prDatosParaRecibo.id) {
      try {
        const _prOrigen = (D.preRecibos || []).find(p => p.id === window._prDatosParaRecibo.id);
        if (_prOrigen) {
          _prOrigen.convertido = true;
          _prOrigen.folioRecibo = folio;
          if (typeof _prGuardar === 'function') _prGuardar();
        }
      } catch(e) { console.warn('[PreRecibo] marcar convertido:', e); }
      window._prDatosParaRecibo = null;
    }
    congelarRecibo();
    imprimirBlob(blob);
    renderRecibosRecientes();
    renderRec();
    btn.textContent = '✅ Impreso';
    // Intentar vincular con gestión activa
    setTimeout(function(){ _gestVincularModal(datos, folio); }, 600);
    // Auto-limpiar formulario y avanzar al siguiente folio sin requerir clic manual
    setTimeout(function(){ if(typeof nuevoReciboLimpio === 'function') nuevoReciboLimpio(); }, 700);
  } catch(e) {
    console.error(e);
    toast('Error: ' + e.message, 'err');
    btn.disabled = false;
    btn.textContent = '🖨 Generar PDF e Imprimir';
  }
}

function _recalcularFolioActual() {
  // Excluir registros con tombstone (eliminados): un array REC.recibos obsoleto
  // o un cliente que aún no aplicó el broadcast podría seguir conteniendo el
  // folio recién borrado e inflar el máximo, dejando el hueco permanente.
  var _tombs = (appData && Array.isArray(appData.folios_eliminados)) ? appData.folios_eliminados : [];
  function _vivo(r){
    if(!r || !r.folio) return false;
    return !_tombs.some(function(t){
      return String(t.folio) === String(r.folio) && t.letra === (r.letra || 'A');
    });
  }
  var folios = ((appData && appData.recibos) ? appData.recibos : [])
    .concat((typeof REC !== 'undefined' && REC.recibos) ? REC.recibos : [])
    .filter(_vivo)
    .map(function(r){ return Number(r.folio); });
  // Siguiente = máximo existente + 1 (no rellena huecos intermedios)
  // Solo si se eliminó el último folio queda disponible ese número.
  if(!folios.length) return 1;
  return Math.max.apply(null, folios) + 1;
}

function registrarCarrito(){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  if(!CARRITO.length){toast('El carrito está vacío','err');return;}
  var total=CARRITO.reduce(function(s,i){return s+i.total;},0);
  var descs=_agruparCarritoDescs(CARRITO);
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

function fichaImprimirHistorial(){
  var nombre=document.getElementById('ficha-cliente-nombre').textContent;
  var folio=document.getElementById('ficha-folio-ref').textContent;
  var concepto=document.getElementById('ficha-concepto').textContent;
  var notas=document.getElementById('fichaNotasDisplay').dataset.texto||'';
  var total=document.getElementById('ficha-total').textContent;
  var abonado=document.getElementById('ficha-abonado').textContent;
  var pendiente=document.getElementById('ficha-pendiente').textContent;
  var fecha=new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  var recibosHTML='';
  document.getElementById('ficha-recibos-lista').querySelectorAll('div[style*=grid]').forEach(function(r){
    var celdas=r.querySelectorAll('div');
    recibosHTML+='<tr><td>'+(celdas[0]?celdas[0].textContent.trim():'')+'</td><td>'+(celdas[1]?celdas[1].textContent.trim():'')+'</td><td>'+(celdas[2]?celdas[2].textContent.trim():'')+'</td><td>'+(celdas[3]?celdas[3].textContent.trim():'')+'</td></tr>';
  });
  var win=window.open('','_blank','width=800,height=900');
  if(!win){if(typeof toast==='function')toast('El navegador bloqueó la ventana de impresión — permite ventanas emergentes e intenta de nuevo','err');return;}
  win.document.write('<!DOCTYPE html><html><head><meta charset=UTF-8><title>Historial '+folio+'</title>'
    +'<style>body{font-family:monospace;padding:32px;color:#1a1008;background:#fdfaf4;font-size:12px;}h1{font-size:16px;color:#c8952a;border-bottom:2px solid #c8952a;padding-bottom:8px;margin-bottom:16px;}.header{display:grid;grid-template-columns:1fr auto;gap:10px;background:#f5f0e0;padding:12px 16px;border-radius:6px;border:1px solid #d4b870;margin-bottom:16px;}.label{font-size:9px;color:#7a6840;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px;}.val{font-size:14px;font-weight:700;}.notas{background:#fffdf5;border:1px solid #e0d4a8;border-radius:4px;padding:10px;margin-bottom:16px;font-size:11px;line-height:1.6;}.sec{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#7a6840;margin-bottom:8px;}table{width:100%;border-collapse:collapse;margin-bottom:16px;}th{font-size:9px;font-weight:700;text-transform:uppercase;color:#7a6840;padding:6px 8px;border-bottom:1px solid #d4b870;text-align:left;background:#f5f0e0;}td{padding:6px 8px;border-bottom:1px solid #ecdfa8;font-size:11px;}.tots{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;background:#f5f0e0;border:1px solid #d4b870;border-radius:6px;padding:10px 14px;}.tl{font-size:9px;color:#7a6840;text-transform:uppercase;}.tv{font-size:13px;font-weight:700;}.foot{margin-top:24px;border-top:1px solid #d4b870;padding-top:12px;font-size:10px;color:#7a6840;text-align:center;}</style></head><body>'
    +'<h1>HISTORIAL DEL FOLIO - '+folio+'</h1>'
    +'<div class=header><div><div class=label>Cliente</div><div class=val>'+nombre+'</div><div style="font-size:11px;color:#7a6840;margin-top:4px;">'+concepto+'</div></div><div style=text-align:right><div class=label>Folio</div><div class=val style=color:#1a5fa8>'+folio+'</div><div style="font-size:11px;color:#7a6840;margin-top:4px;">'+fecha+'</div></div></div>'
    +(notas?'<div class=notas><strong>Notas:</strong><br>'+notas+'</div>':'')
    +'<div class=sec>Recibos Oficiales</div><table><thead><tr><th>Folio</th><th>Concepto / Tipo</th><th>Pago</th><th>Saldo</th></tr></thead><tbody>'+recibosHTML+'</tbody></table>'
    +'<div class=tots><div><div class=tl>Total</div><div class=tv>'+total+'</div></div><div><div class=tl>Abonado</div><div class=tv style=color:#1a7a3a>'+abonado+'</div></div><div><div class=tl>Pendiente</div><div class=tv style=color:#a32d2d>'+pendiente+'</div></div></div>'
    +'<div class=foot>LEX-MEXICO Despacho Juridico - Documento interno</div>'
    +'<scr'+'ipt>window.onload=function(){window.print();window.addEventListener(\'afterprint\',function(){window.close();});};<'+'/script></body></html>');
  win.document.close();
  win.addEventListener('beforeunload',function(){
    setTimeout(function(){if(reciboEnConsulta&&document.getElementById('modal-ficha-folio'))abrirFichaFolio();},400);
  });
}

function _juNuevaNota(idx){
  const j = D.juicios && D.juicios[idx];
  if(!j){ if(typeof toast === 'function') toast('Abre un expediente primero','err'); return; }
  abrirPendiente(-1);
  const secEl = document.getElementById('pSec');
  if(secEl){ secEl.value = 'juicios'; if(typeof pSecCambio === 'function') pSecCambio(); }
  _pJuiState.juicioIdx = idx;
  const _set = (id, v) => { const e = document.getElementById(id); if(e) e.value = v || ''; };
  _set('pJuiCliente', j.cliente);
  _set('pJuiExpediente', j.expediente);
  const tipoEl = document.getElementById('pJuiTipo');
  if(tipoEl && j.tipo) tipoEl.value = j.tipo;
  if(typeof _pJuiActualizarVinculacionUI === 'function') _pJuiActualizarVinculacionUI();
}

function _docRelNombreCarpetaJuicio(idx){
  const j = D.juicios && D.juicios[idx];
  const jId = (j && j.id) || ('idx_' + idx);
  const nombre = (j ? (j.nombre || j.cliente || 'Juicio') + ' - Exp.' + (j.expediente || j.num || jId) : 'Juicio-' + jId).replace(/[<>:"/\\|?*]/g,'_');
  return { jId, nombre };
}

async function confirmarCerrarExpediente(){
  const j = D.juicios[_mexpIdx];
  if(!j) return;
  const nombre = j.cliente || 'este expediente';
  if(!confirm('¿Cerrar y archivar el expediente de ' + nombre + '?\n\nSe eliminarán los documentos de R2 vinculados y el expediente quedará como Concluido.\n\nEsta acción no se puede deshacer.')) return;
  // Eliminar docs de R2
  const docs = j.r2Docs || [];
  for(const doc of docs){
    try{
      const path = (window.SB_DESPACHO_ID||'despacho') + '/juicios/' + (_mexpIdx) + '/' + doc.nombre;
      if(typeof window.eliminarR2 === 'function') await window.eliminarR2(path, 'juicios');
    } catch(e){ console.warn('eliminarR2 juicio:', e); }
  }
  // Eliminar resúmenes de acuerdos de R2
  const jIdCerrar = j.id || _mexpIdx;
  const lsKeyCerrar = 'lex_acuerdos_' + jIdCerrar;
  try {
    const acuerdosCerrar = JSON.parse(localStorage.getItem(lsKeyCerrar) || '[]');
    acuerdosCerrar.forEach(ac => {
      if (ac.driveFileId && typeof _r2ResumenPath === 'function')
        window.borrarR2(_r2ResumenPath(ac.driveFileId), 'expedientes').catch(()=>{});
    });
    localStorage.removeItem(lsKeyCerrar);
  } catch(e) {}
  // Marcar como concluido
  D.juicios[_mexpIdx].estatus = 'concluido';
  D.juicios[_mexpIdx].r2Docs = [];
  try{ backupLocal('D', D); } catch(e){}
  saveJuicios();
  cerrarModalExpediente();
  renderJuicios();
  if(typeof toast==='function') toast('Expediente cerrado y documentos eliminados de R2', 'ok');
}

async function analizarExpedienteIA(){
  const j = D.juicios[_mexpIdx];
  if(!j) return;
  const hist = (j.historial||[]).map(h=>`[${h.fecha} - ${h.tipo}]: ${h.texto}`).join('\n') || 'Sin historial';
  const leyes = (j.leyesActivas||[]).join(', ') || 'Sin leyes específicas';
  const prompt = 'Analiza este expediente jurídico y proporciona un resumen ejecutivo:\n' +
    'Cliente: ' + (j.cliente||'—') + '\nTipo: ' + (j.tipo||'—') + '\nExpediente: ' + (j.expediente||'—') +
    '\nJuzgado: ' + (j.juzgado||'—') + '\nEstatus: ' + (j.estatus||'—') + '\nAudiencia: ' + (j.audiencia||'—') +
    '\nLeyes activas: ' + leyes + '\nHistorial:\n' + hist +
    '\n\nIncluye: resumen ejecutivo, estado procesal actual, riesgos, próximos pasos recomendados. Fundamenta cada punto citando el artículo exacto de las leyes activas del caso. Responde en español.';
  $('mexp-ia-resumen').textContent = '⏳ Analizando...';
  const textoLeyes = await _obtenerTextoLeyesActivas(j, (msg) => { $('mexp-ia-resumen').textContent = msg; });
  $('mexp-ia-resumen').textContent = '⏳ Analizando...';
  const resultado = await _iaLlamarGrounded(prompt, textoLeyes, 2048, 0.3, 'consulta');
  $('mexp-ia-resumen').textContent = resultado || 'No se obtuvo respuesta.';
}

function preguntaRapidaIA(tipo){
  const j = D.juicios[_mexpIdx];
  if(!j){ if(typeof toast==='function') toast('Abre un expediente primero', 'err'); return; }
  const prompts = {
    argumentos: 'Para el caso de ' + (j.cliente||'el cliente') + ' (' + (j.tipo||'') + '), ¿cuáles son los argumentos jurídicos más sólidos? Leyes activas: ' + (j.leyesActivas||[]).join(', ') + '. Fundamenta cada argumento citando el artículo exacto de las leyes activas del caso.',
    riesgos: 'Analiza los riesgos procesales del expediente de ' + (j.cliente||'el cliente') + '. Estatus: ' + (j.estatus||'—') + '. Historial: ' + (j.historial||[]).map(h=>h.texto).join('; ') + '. Fundamenta cada riesgo citando el artículo exacto de las leyes activas del caso.',
    'resumen-cliente': 'Redacta un resumen en lenguaje sencillo (no técnico) del estado actual del caso de ' + (j.cliente||'el cliente') + ' para presentar al cliente. Tipo: ' + (j.tipo||'—') + '. Estatus: ' + (j.estatus||'—')
  };
  const labels = { argumentos:'Argumentos clave', riesgos:'Análisis de riesgos', 'resumen-cliente':'Resumen para cliente' };
  _agregarMensajeIA(labels[tipo]||tipo, 'user');
  _llamarGeminiIAConLeyes(j, prompts[tipo]||tipo);
}

async function enviarPreguntaIA(){
  const input = $('mexp-ia-input');
  const texto = input.value.trim();
  if(!texto) return;
  input.value = '';
  const j = D.juicios[_mexpIdx];
  const contexto = j ? 'Contexto del expediente: ' + (j.cliente||'') + ', ' + (j.tipo||'') + ', Exp. ' + (j.expediente||'') + '. ' : '';
  _agregarMensajeIA(texto, 'user');
  if (j) {
    await _llamarGeminiIAConLeyes(j, contexto + texto + ' Fundamenta tu respuesta citando el artículo exacto de las leyes activas del caso cuando aplique.');
  } else {
    await _llamarGeminiIA(contexto + texto);
  }
}
