/* LEX-MÉXICO · Módulo documentos
 * Funciones extraídas sin modificar su contenido.
 */

function toggleVehiculo(header) {
  const body = document.getElementById('vehicle-grid-body');
  const arrow = header.querySelector('.veh-arrow');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'grid';
  arrow.textContent = open ? '▸' : '▾';
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

function iniciarDriveAuth() {
  if(sbSession && Date.now() < sbExpiry){
    setStatus('ok','Sesión activa','ok');
    actualizarAmbossBadges(true);
    return;
  }
  mostrarLoginSupabase();
}

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

async function reemplazarPDFenDrive(pdfBlob, nombreArchivo){
  return await subirPDFaDrive(pdfBlob, nombreArchivo);
}

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

function _abrevEstadoPlaca(valor){
  if(!valor) return '';
  for(var i=0;i<_ESTADOS_PLACA.length;i++){ if(_ESTADOS_PLACA[i][0]===valor) return _ESTADOS_PLACA[i][1]; }
  return valor;
}

function _nombreCompletoEstadoPlaca(valor){
  if(!valor) return '';
  for(var i=0;i<_ESTADOS_PLACA.length;i++){ if(_ESTADOS_PLACA[i][0]===valor) return _ESTADOS_PLACA[i][2]; }
  return valor;
}

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

function _escGuiaClasesKey(ev){ if(ev.key === 'Escape') cerrarGuiaClasesVehiculo(); }

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

async function verPDFVersionSupabase(pdfPath){
  if(!window.SB){ showModal('Error','Sin conexión a Supabase.'); return; }
  try {
    const { data, error } = await window.SB.storage.from(STORAGE_BUCKET).createSignedUrl(pdfPath, 300);
    if(error || !data){ showModal('Error','No se pudo obtener el PDF: '+(error?.message||'sin URL')); return; }
    window.open(data.signedUrl, '_blank');
  } catch(e){ showModal('Error','Error al obtener PDF: '+e.message); }
}

function _docFamilia(nombre, tipo){
  const n = String(nombre||'').toLowerCase();
  const t = String(tipo||'').toLowerCase();
  const ext = n.includes('.') ? n.slice(n.lastIndexOf('.')+1) : '';
  if(t.startsWith('image/') || ['jpg','jpeg','png','webp','gif','bmp','heic','heif','tif','tiff','svg'].includes(ext)) return 'imagen';
  if(t === 'application/pdf' || ext === 'pdf') return 'pdf';
  // Word y Excel comparten color: ambos son documentos de ofimática.
  if(t.includes('word') || t.includes('sheet') || t.includes('excel') ||
     ['doc','docx','odt','rtf','xls','xlsx','csv','ods'].includes(ext)) return 'office';
  return 'otro';
}

function _ahoraVerificado(){
  const desvio = (typeof horaDriveDesviacion === 'number') ? horaDriveDesviacion : 0;
  return new Date(Date.now() + desvio);
}

function _lockSessionId(){
  var k = 'lex_session_id';
  var v = localStorage.getItem(k);
  if(!v){ v = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2); localStorage.setItem(k, v); }
  return v;
}

async function _r2AuthToken(){
  try{
    if(window.SB){
      const { data } = await window.SB.auth.getSession();
      const tok = data && data.session && data.session.access_token;
      if(tok) return tok;
    }
  } catch(e){ /* silencioso */ }
  throw new Error('R2_SIN_SESION: inicia sesión nuevamente para acceder a archivos.');
}

async function _r2GuardarResumen(driveFileId, resumen) {
  try {
    // Leer ocrTexto existente para no sobreescribirlo
    let ocrTexto = '';
    try {
      const prev = await _r2CargarResumen(driveFileId);
      if (prev && prev.ocrTexto) ocrTexto = prev.ocrTexto;
    } catch(e) {}
    const json = JSON.stringify({ resumen, ocrTexto, ts: Date.now() });
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], 'resumen.json', { type: 'application/json' });
    await window.subirR2(file, _r2ResumenPath(driveFileId), 'expedientes');
  } catch(e) { console.warn('[R2Resumen] guardar:', e); }
}

function calcularConectividadDrive() {
  const checks = {
    conexion: { nombre: 'Internet', estado: 'fail' },
    token: { nombre: 'Sesión activa', estado: 'fail' },
    archivo: { nombre: 'Archivo principal', estado: 'fail' },
    sync: { nombre: 'Sincronización', estado: 'fail' },
    backup: { nombre: 'Respaldo local', estado: 'fail' }
  };
  let pct = 0;
  // 1. Internet (20%)
  if (navigator.onLine) {
    checks.conexion.estado = 'ok';
    pct += 20;
  }
  // 2. Sesión activa (token de Drive vigente) (20%)
  if (typeof sbSession !== 'undefined' && sbSession && Date.now() < sbExpiry) {
    checks.token.estado = 'ok';
    pct += 20;
  } else if (typeof sbSession !== 'undefined' && sbSession) {
    // Token existe pero expiró
    checks.token.estado = 'warn';
    pct += 8;
  }
  // 3. Archivo principal (folioFileId vinculado) (20%)
  if (typeof folioFileId !== 'undefined' && folioFileId) {
    checks.archivo.estado = 'ok';
    pct += 20;
  }
  // 4. Sincronización (20%) - estable: solo penaliza errores reales
  // (antes la barra "parpadeaba" porque el tiempo desde el último guardado
  //  hacía caer el porcentaje cada 5/30 min aunque todo estuviera bien)
  if (typeof _syncState !== 'undefined') {
    if (_syncState === 'error') {
      checks.sync.estado = 'fail';
    } else {
      checks.sync.estado = 'ok';
      pct += 20;
    }
  } else {
    checks.sync.estado = 'ok';
    pct += 20;
  }
  // 5. Respaldo local (20%)
  try {
    if (typeof listarBackups === 'function') {
      const backupsD = listarBackups('D');
      const backupsApp = listarBackups('appData');
      if (backupsD.length > 0 || backupsApp.length > 0) {
        // Respaldos rotativos disponibles (lo mejor)
        checks.backup.estado = 'ok';
        pct += 20;
      } else {
        // Aún no hay backups en Supabase
        checks.backup.estado = 'warn';
        pct += 12;
      }
    } else {
      // Si la función no existe, marcar como pendiente
      checks.backup.estado = 'warn';
      pct += 5;
    }
  } catch(e){ registrarError('catch vacio', e); }
  return { pct: Math.round(pct), checks };
}

function actualizarMedidorDrive() {
  // Barra integrada al card de Servicios
  const fill = document.getElementById('drive-meter-slim-fill');
  const slim = document.getElementById('drive-meter-slim');
  if (!fill && !slim) return;
  const { pct, checks } = calcularConectividadDrive();
  if (fill) {
    // En la primera carga: mostrar pulso azul al 100% mientras se verifica realmente
    if (!_medidorYaInicializado) {
      fill.style.width = '100%';
      // Sin clase de color = se queda con el azul por defecto del CSS
      fill.classList.remove('bajo','medio','alto','completo');
      _medidorYaInicializado = true;
      // Después de 2.5s aplicar el porcentaje real
      setTimeout(() => {
        const { pct: pct2 } = calcularConectividadDrive();
        fill.style.width = pct2 + '%';
        fill.classList.remove('bajo','medio','alto','completo');
        if (pct2 >= 100) fill.classList.add('completo');
        else if (pct2 >= 70) fill.classList.add('alto');
        else if (pct2 >= 35) fill.classList.add('medio');
        else if (pct2 > 0) fill.classList.add('bajo');
      }, 2500);
    } else {
      fill.style.width = pct + '%';
      fill.classList.remove('bajo','medio','alto','completo');
      if (pct >= 100) fill.classList.add('completo');
      else if (pct >= 70) fill.classList.add('alto');
      else if (pct >= 35) fill.classList.add('medio');
      else if (pct > 0) fill.classList.add('bajo');
      // Si pct=0 sin clase: queda azul (sin conectividad inicializando)
    }
  }
  // Tooltip dinámico con el porcentaje y los componentes
  if (slim) {
    let estado;
    if (!_medidorYaInicializado) estado = '⏳ Verificando conectividad...';
    else if (pct >= 100) estado = '✓ Conectividad óptima';
    else if (pct >= 70) estado = '✓ Conectividad buena';
    else if (pct >= 35) estado = '⚠ Conectividad parcial';
    else if (pct > 0) estado = '⚠ Conectividad baja';
    else estado = '✕ Sin conectividad';
    const detalles = Object.entries(checks).map(([key, c]) => {
      const ico = c.estado === 'ok' ? '✓' : c.estado === 'warn' ? '⚠' : '✕';
      return ico + ' ' + c.nombre;
    }).join('\n');
    slim.title = 'Conectividad: ' + pct + '% — ' + estado + '\n\n' + detalles;
  }
}

function cerrarVisorPDF(){
  const w=$('visor-pdf-wrap');
  if(w){w.style.display='none';$('visor-pdf-iframe').src='';}
}

function _placasAdjBtnEstado(idx, estado){
  // estado: 'normal' | 'subiendo'
  const btn = document.getElementById('placas-adj-btn-'+idx);
  if(!btn) return;
  if(estado==='subiendo'){
    btn.textContent = '⏳ Subiendo…';
    btn.style.opacity = '0.6';
    btn.style.pointerEvents = 'none';
    btn.style.cursor = 'default';
  } else {
    btn.textContent = '+ Adjuntar';
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
    btn.style.cursor = 'pointer';
  }
}

function _placasNombreLimpio(nombre){
  return String(nombre || 'archivo')
    .replace(/[\\/:*?"<>|]/g, '_')   // caracteres inválidos para un nombre de archivo
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 120) || 'archivo';
}

function _placasPutConProgreso(sessionUri, file, onProgreso, timeoutMs){
  return new Promise(function(resolve, reject){
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUri, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = function(ev){
      if(ev.lengthComputable && typeof onProgreso === 'function'){
        onProgreso(Math.round(ev.loaded / ev.total * 100));
      }
    };
    xhr.onload = function(){
      if(xhr.status >= 200 && xhr.status < 300){
        let data = {};
        try{ data = JSON.parse(xhr.responseText || '{}'); }catch(e){}
        resolve(data);
      } else {
        reject(new Error('HTTP ' + xhr.status + ' ' + String(xhr.responseText||'').slice(0,200)));
      }
    };
    xhr.onerror   = function(){ reject(new Error('Error de red durante la subida')); };
    xhr.ontimeout = function(){ reject(new Error('La subida tardó demasiado')); };
    xhr.send(file);
  });
}

function _placasLeerBase64(file){
  return new Promise(function(resolve,reject){
    const reader=new FileReader();
    reader.onloadend=function(){ resolve(reader.result); };
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

function _placasProgreso(texto){
  let el = document.getElementById('_placasProgresoBox');
  if(texto === null || texto === undefined || texto === false){ if(el) el.remove(); return; }
  if(!el){
    el = document.createElement('div');
    el.id = '_placasProgresoBox';
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100001;background:#1a1008;border:1.5px solid #c8952a;color:#f7e9cb;border-radius:10px;padding:11px 22px;font-family:monospace;font-size:0.8rem;font-weight:700;box-shadow:0 12px 34px rgba(0,0,0,0.5);letter-spacing:0.02em;';
    document.body.appendChild(el);
  }
  el.textContent = texto;
}

function guardarPend(){
  const sec = document.getElementById('pSec')?.value || 'otros';
  let especifico = {};
  if(sec === 'placas'){
    const d = _pPlacasRecopilar();
    if(!d.nombre){ toast('El nombre es obligatorio','err'); return; }
    if(!d.tipoVehicular){ toast('Selecciona el tipo de trámite','err'); return; }
    const _tipoTexto = {'alta':'Alta de placas','baja':'Baja de placas','cambio_propietario':'Cambio de propietario','tarjeta_circulacion':'Tarjeta de circulación','reemplacamiento':'Reemplacamiento'}[d.tipoVehicular]||'Trámite vehicular';
    especifico = {
      id: (eiP>=0 && D.pendientes[eiP]?.id) || ('P-'+Date.now()),
      texto: _tipoTexto + ' — ' + d.nombre.toUpperCase(),
      persona: d.nombre, seccion:'placas',
      tipoVehicular: d.tipoVehicular, placasEstado: d.placasEstado,
      placasNumero: d.placasNumero, descripcionPlacas: d.descripcionPlacas,
      reciboVinculadoFolio: d.reciboVinculadoFolio, documentos: d.documentos,
      prioridad: document.getElementById('pPri')?.value||'normal',
      resp: document.getElementById('pRe')?.value||'Antonieta',
      fechaLimite: document.getElementById('pFecha')?.value||'',
      carpeta: document.getElementById('pCarpeta')?.value.trim()||''
    };
  } else if(sec === 'escrituras'){
    const d = _pEscRecopilar();
    if(!d.escDescripcion){ toast('La descripción es obligatoria','err'); return; }
    especifico = Object.assign({
      id: (eiP>=0 && D.pendientes[eiP]?.id) || ('P-'+Date.now()),
      texto: d.escDescripcion,
      persona: d.escComprador || d.escVendedor || '',
      seccion: 'escrituras',
      prioridad: document.getElementById('pPri')?.value||'normal',
      resp: document.getElementById('pRe')?.value||'Antonieta',
      fechaLimite: document.getElementById('pFecha')?.value||'',
      carpeta: document.getElementById('pCarpeta')?.value.trim()||''
    }, d);
  } else if(sec === 'juicios'){
    const d = _pJuiRecopilar();
    if(!d.juiDescripcion){ toast('La descripción es obligatoria','err'); return; }
    especifico = Object.assign({
      id: (eiP>=0 && D.pendientes[eiP]?.id) || ('P-'+Date.now()),
      texto: d.juiDescripcion,
      persona: d.juiCliente || '',
      seccion: 'juicios',
      prioridad: document.getElementById('pPri')?.value||'normal',
      resp: document.getElementById('pRe')?.value||'Antonieta',
      fechaLimite: document.getElementById('pFecha')?.value||'',
      carpeta: document.getElementById('pCarpeta')?.value.trim()||''
    }, d);
  } else {
    const nombre = document.getElementById('pOtrosNombre')?.value.trim()||document.getElementById('pPersona')?.value.trim()||'';
    const desc   = document.getElementById('pOtrosDesc')?.value.trim()||document.getElementById('pTxt')?.value.trim()||'';
    if(!desc){ toast('La descripción es obligatoria','err'); return; }
    especifico = {
      id: (eiP>=0 && D.pendientes[eiP]?.id) || ('P-'+Date.now()),
      texto: desc, persona: nombre, seccion: sec,
      prioridad: document.getElementById('pPri')?.value||'normal',
      resp: document.getElementById('pRe')?.value||'Antonieta',
      fechaLimite: document.getElementById('pFecha')?.value||'',
      carpeta: document.getElementById('pCarpeta')?.value.trim()||'',
      // FIX (caso real: pendiente "Copias certificadas para el Sr Jesus Cerero",
      // 2026-09-30): el campo "Detalle / Observaciones" (#pOb) está OCULTO en
      // todas las secciones (ver pSecCambio) y nunca se limpiaba al abrir un
      // pendiente nuevo — cualquier texto que quedara ahí se guardaba sin que
      // nadie lo viera (apareció "Firma de contrato del sr Víctor Zarate…"
      // dentro de un pendiente ajeno). Ya no se lee ese campo oculto: al
      // editar se conservan las observaciones que ya tenía el pendiente y uno
      // nuevo nace sin ellas.
      obs: (eiP>=0 && D.pendientes[eiP] && D.pendientes[eiP].obs) || ''
    };
  }
  const prevP = eiP >= 0 ? D.pendientes[eiP] : null;
  const p = _construirPendienteBase(prevP, especifico);
  _persistirPendiente(p, sec==='placas'?'Pendiente de placas guardado ✓':'Pendiente guardado ✓');
}

function setPlacasTipo(tipo){
  _pPlacasState.tipo = tipo;
  document.querySelectorAll('#pPlacasTipoBtns .placas-tipo-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.tipo === tipo);
  });
}

function _pPlacasMostrarResultadoSubida(agregados, rechazados){
  if (rechazados > 0 && agregados > 0) {
    toast('✓ '+agregados+' adjuntado(s) · '+rechazados+' rechazado(s) (formato/tamaño)', 'err');
  } else if (rechazados > 0) {
    toast('⚠ Archivos rechazados: solo PDF/JPG/PNG hasta 5 MB', 'err');
  } else if (agregados > 0) {
    toast('✓ '+agregados+' archivo(s) adjuntado(s)');
  }
}

function _pPlacasFormatearTamano(bytes){
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}

function _pPlacasRenderDocs(){
  const cont = document.getElementById('pPlacasFilesList');
  const cnt  = document.getElementById('pPlacasFilesCount');
  if (!cont || !cnt) return;
  const docs = _pPlacasState.documentos;
  if (!docs.length) {
    cont.innerHTML = '';
    cnt.textContent = 'Ninguno adjunto';
    return;
  }
  cnt.textContent = docs.length + ' archivo(s) adjunto(s)';
  cont.innerHTML = docs.map((d, i) => {
    const _st = _docEstilo(d.nombre, d.tipo);
    const ico = _st.icono;
    return '<div class="placas-doc-chip" style="background:'+_st.bg+';border-color:'+_st.borde+';">' +
      '<span class="placas-doc-chip-ico">'+ico+'</span>' +
      '<div class="placas-doc-chip-info">' +
        '<div class="placas-doc-chip-nombre" style="color:'+_st.texto+';">'+esc(d.nombre)+'</div>' +
        '<div class="placas-doc-chip-meta">'+_pPlacasFormatearTamano(d.tamano||0)+' · '+esc(d.fechaSubida||'')+'</div>' +
      '</div>' +
      '<div class="placas-doc-chip-acciones">' +
        '<button type="button" class="placas-doc-chip-btn" onclick="event.stopPropagation();pPlacasVerDoc('+i+')" title="Ver">👁</button>' +
        '<button type="button" class="placas-doc-chip-btn danger" onclick="pPlacasEliminarDoc('+i+')" title="Quitar">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function pPlacasVerDoc(i){
  const docs = _pPlacasState.documentos;
  const d = docs[i];
  if (!d) return;
  _pVerDoc(d, undefined, i, docs);
}

function _pEscCargar(p){
  _pEscState.documentos = Array.isArray(p && p.escDocumentos) ? p.escDocumentos.slice() : [];
  const _set = (id, val) => { const e = document.getElementById(id); if (e) e.value = val || ''; };
  _set('pEscComprador',     p && p.escComprador);
  _set('pEscVendedor',      p && p.escVendedor);
  _set('pEscArchivoFisico', p && p.escArchivoFisico);
  _set('pEscNotaria',       p && p.escNotaria);
  _set('pEscVolumen',       p && p.escVolumen);
  _set('pEscInstrumento',   p && p.escInstrumento);
  _set('pEscFolio',         p && p.escFolio);
  _set('pEscCosto',         p && p.escCosto);
  _set('pEscCobrado',       p && p.escCobrado);
  _set('pEscServiciosComp', p && p.escServiciosComp);
  _set('pEscSiguientePaso', p && p.escSiguientePaso);
  _set('pEscEtapa',         p && p.escEtapa);
  _set('pEscDesc',          p && p.escDescripcion);
  pEscActualizarResto();
  _pEscRenderDocs();
}

function _pEscRecopilar(){
  const costo   = parseFloat(document.getElementById('pEscCosto')?.value)||0;
  const cobrado = parseFloat(document.getElementById('pEscCobrado')?.value)||0;
  const resto   = costo - cobrado;
  return {
    escComprador:     document.getElementById('pEscComprador')?.value.trim() || '',
    escVendedor:      document.getElementById('pEscVendedor')?.value.trim() || '',
    escArchivoFisico: document.getElementById('pEscArchivoFisico')?.value.trim() || '',
    escNotaria:       document.getElementById('pEscNotaria')?.value.trim() || '',
    escVolumen:       document.getElementById('pEscVolumen')?.value.trim() || '',
    escInstrumento:   document.getElementById('pEscInstrumento')?.value.trim() || '',
    escFolio:         document.getElementById('pEscFolio')?.value.trim() || '',
    escCosto:         costo || '',
    escCobrado:       cobrado || '',
    escResto:         (costo > 0) ? resto : '',
    escServiciosComp: document.getElementById('pEscServiciosComp')?.value.trim() || '',
    escSiguientePaso: document.getElementById('pEscSiguientePaso')?.value.trim() || '',
    escEtapa:         document.getElementById('pEscEtapa')?.value || '',
    escDescripcion:   document.getElementById('pEscDesc')?.value.trim() || '',
    escDocumentos:    _pEscState.documentos.slice()
  };
}

function pEscAdjuntar(event){
  _pAdjuntarArchivos(event, _pEscState.documentos, _pEscRenderDocs);
}

function _pEscRenderDocs(){
  const cont = document.getElementById('pEscFilesList');
  const cnt  = document.getElementById('pEscFilesCount');
  if (!cont || !cnt) return;
  const docs = _pEscState.documentos;
  if (!docs.length) {
    cont.innerHTML = '';
    cnt.textContent = 'Ninguno adjunto';
    return;
  }
  cnt.textContent = docs.length + ' archivo(s) adjunto(s)';
  cont.innerHTML = docs.map((d, i) => {
    const _st = _docEstilo(d.nombre, d.tipo);
    const ico = _st.icono;
    return '<div class="placas-doc-chip" style="background:'+_st.bg+';border-color:'+_st.borde+';">' +
      '<span class="placas-doc-chip-ico">'+ico+'</span>' +
      '<div class="placas-doc-chip-info">' +
        '<div class="placas-doc-chip-nombre" style="color:'+_st.texto+';">'+esc(d.nombre)+'</div>' +
        '<div class="placas-doc-chip-meta">'+_pPlacasFormatearTamano(d.tamano||0)+' · '+esc(d.fechaSubida||'')+'</div>' +
      '</div>' +
      '<div class="placas-doc-chip-acciones">' +
        '<button type="button" class="placas-doc-chip-btn" onclick="pEscVerDoc('+i+')" title="Ver">👁</button>' +
        '<button type="button" class="placas-doc-chip-btn danger" onclick="pEscEliminarDoc('+i+')" title="Quitar">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function pEscVerDoc(i){ _pVerDoc(_pEscState.documentos[i], undefined, i, _pEscState.documentos); }

function _pVerDocRender(){
  const ctx  = window._docPreviewCtx;
  if (!ctx || !ctx.d) return;
  const d    = ctx.d;
  const titulo = document.getElementById('docPreviewTitulo');
  const cont   = document.getElementById('docPreviewContenido');
  const btnDl  = document.getElementById('docPreviewBtnDescargar');
  const btnEl  = document.getElementById('docPreviewBtnEliminar');
  const counter= document.getElementById('docPreviewCounter');
  const btnPrev= document.getElementById('docPrevBtnPrev');
  const btnNext= document.getElementById('docPrevBtnNext');
  const zoomBar= document.getElementById('docZoomBar');
  const esPDF = d.tipo === 'application/pdf';
  if (titulo) titulo.textContent = (esPDF ? '📄 ' : '🖼 ') + d.nombre;
  if (btnDl) btnDl.style.display = 'inline-flex';
  if (btnEl) btnEl.style.display = ctx.pendienteIdx !== undefined ? 'inline-flex' : 'none';
  // Zoom: solo para imágenes
  if (zoomBar) zoomBar.style.display = esPDF ? 'none' : 'flex';
  window._docZoomLevel = 1;
  _docZoomUpdateLabel();
  // Contador y flechas
  const lista = ctx.lista;
  const idx   = ctx.docIdx;
  if (lista && lista.length > 1 && idx !== undefined) {
    if (counter) { counter.style.display = 'inline-block'; counter.textContent = (idx+1) + ' / ' + lista.length; }
    if (btnPrev) { btnPrev.style.display = 'flex'; btnPrev.disabled = idx <= 0; }
    if (btnNext) { btnNext.style.display = 'flex'; btnNext.disabled = idx >= lista.length - 1; }
  } else {
    if (counter) counter.style.display = 'none';
    if (btnPrev) btnPrev.style.display = 'none';
    if (btnNext) btnNext.style.display = 'none';
  }
  // Renderizar contenido
  if (cont) cont.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">Cargando…</div>';
  const src = d.dataURL || d.base64;
  window._docPrevBlob = null;
  function mostrarContenido(url, blob){
    if (!cont) return;
    if (blob) window._docPrevBlob = { d: d, blob: blob };
    if (esPDF) {
      // Sin la barra propia del visor del navegador: su botón de descarga
      // ponía un nombre de números y letras (el del enlace interno) y no el
      // nombre real del archivo. Descargar e Imprimir se hacen con los botones
      // del sistema, que sí conservan el nombre con el que se subió.
      cont.innerHTML = '<iframe id="docPreviewIframe" src="'+url+'#toolbar=0&navpanes=0&scrollbar=1&view=FitH" title="'+escHTML(d.nombre||'')+'" allowfullscreen></iframe>';
    } else {
      cont.innerHTML = '<img src="'+url+'" id="docPreviewImg" alt="'+escHTML(d.nombre||'')+'" style="max-width:100%;max-height:65vh;border-radius:4px;display:block;margin:0 auto;transform-origin:center center;">';
      // Wheel zoom
      cont.onwheel = function(e){ e.preventDefault(); _docZoom(e.deltaY < 0 ? 1 : -1); };
      // Pan / drag
      _docPanInit(cont);
    }
  }
  if (d.r2path && typeof window.descargarR2 === 'function') {
    window.descargarR2(d.r2path, d.bucket || 'placas').then(blob => {
      if (!blob) {
        if(cont) cont.innerHTML = '<p style="color:#c0161a;padding:20px;text-align:center;">No se pudo cargar el archivo.<br><small>Verifica tu conexión.</small></p>';
        return;
      }
      mostrarContenido(URL.createObjectURL(blob), blob);
    }).catch(e => {
      if(cont) cont.innerHTML = '<p style="color:#c0161a;padding:20px;text-align:center;">Error al cargar desde R2.</p>';
      console.error('_pVerDoc R2:', e);
    });
  } else if (d.driveFileId) {
    // El archivo se descarga COMPLETO antes de poder mostrarse (un iframe no
    // puede ir mostrando un PDF a medias). Con documentos de decenas de MB eso
    // tarda, y antes solo se veía "Cargando…" sin saber si avanzaba o se había
    // trabado. Ahora se muestra el porcentaje real y un atajo para abrirlo
    // directo en Google Drive, que sí lo va mostrando mientras carga.
    const _urlDrive = 'https://drive.google.com/file/d/' + d.driveFileId + '/view';
    if (cont) cont.innerHTML =
        '<div style="text-align:center;padding:38px 20px;color:var(--muted);">'
      +   '<div id="docPrevProgTxt" style="font-family:monospace;font-size:0.8rem;">Cargando…</div>'
      +   '<div style="margin:12px auto 0;max-width:320px;height:7px;background:rgba(0,0,0,0.10);border-radius:4px;overflow:hidden;">'
      +     '<div id="docPrevProgBar" style="height:100%;width:0%;background:#c8952a;transition:width .12s linear;"></div>'
      +   '</div>'
      +   '<div style="margin-top:16px;font-size:0.72rem;line-height:1.6;">Los archivos grandes tardan porque se descargan completos.<br>'
      +     '<a href="' + _urlDrive + '" target="_blank" rel="noopener" style="color:#1a4a8a;font-weight:700;text-decoration:underline;">Abrirlo directamente en Google Drive ↗</a>'
      +   '</div>'
      + '</div>';
    // Tamaño del archivo: hace falta para calcular el porcentaje. La cabecera
    // Content-Length de la descarga NO es legible desde JavaScript (Google no la
    // expone por CORS), por eso antes el porcentaje nunca aparecía. Se pide
    // aparte a la API de Drive, que sí lo devuelve; es una consulta mínima.
    // Si el documento ya trae el tamaño guardado (d.bytes), se usa ese y ni
    // siquiera se hace la consulta.
    window._docPrevTotal = Number(d.bytes) || 0;
    driveGetAccessToken().then(function(token){
      if (!token) { if(cont) cont.innerHTML = '<p style="color:#c0161a;padding:20px;text-align:center;">Drive no conectado. Reconecta en Panel Admin.</p>'; return; }
      const _pedirTamano = window._docPrevTotal
        ? Promise.resolve(window._docPrevTotal)
        : fetch('https://www.googleapis.com/drive/v3/files/'+d.driveFileId+'?fields=size',{headers:{Authorization:'Bearer '+token}})
            .then(function(r){ return r.ok ? r.json() : null; })
            .then(function(j){ return (j && j.size) ? Number(j.size) : 0; })
            .catch(function(){ return 0; });
      return _pedirTamano.then(function(tam){
        window._docPrevTotal = tam || 0;
        return fetch('https://www.googleapis.com/drive/v3/files/'+d.driveFileId+'?alt=media',{headers:{Authorization:'Bearer '+token}});
      }).then(function(resp){
        // Un 401/403 aquí (a pesar de que driveGetAccessToken() sí devolvió
        // un token) significa que ese token es el viejo de respaldo y ya no
        // sirve — es la misma situación de "hay que reconectar Drive", solo
        // que se detectó en este punto en vez del refresh. Se avisa igual.
        if (resp && (resp.status === 401 || resp.status === 403) && typeof _driveMarcarDesconectado === 'function') {
          _driveMarcarDesconectado('Drive API respondió ' + resp.status);
        }
        return resp;
      });
    }).then(async function(resp){
      if (!resp || !resp.ok) throw new Error('No se pudo descargar de Drive');
      // Tamaño: primero el que se consultó a la API; si no, la cabecera (que casi
      // nunca es legible); si tampoco, se avanza mostrando solo los MB bajados.
      const total = window._docPrevTotal || parseInt(resp.headers.get('Content-Length') || '0', 10) || 0;
      if (!resp.body || typeof resp.body.getReader !== 'function') return resp.blob();
      const reader = resp.body.getReader();
      const partes = [];
      let recibido = 0;
      const elTxt = document.getElementById('docPrevProgTxt');
      const elBar = document.getElementById('docPrevProgBar');
      const _fmtMb = function(b){ return (b/1024/1024).toFixed(1); };
      for(;;){
        const paso = await reader.read();
        if (paso.done) break;
        partes.push(paso.value);
        recibido += paso.value.length;
        if (total){
          const pct = Math.min(100, Math.round(recibido / total * 100));
          if (elTxt) elTxt.textContent = 'Cargando… ' + pct + '%  (' + _fmtMb(recibido) + ' de ' + _fmtMb(total) + ' MB)';
          if (elBar) elBar.style.width = pct + '%';
        } else {
          // Sin tamaño conocido: se informa lo descargado y la barra avanza de
          // forma aproximada, sin llegar nunca al 100% hasta terminar de verdad.
          if (elTxt) elTxt.textContent = 'Cargando… ' + _fmtMb(recibido) + ' MB descargados';
          if (elBar) elBar.style.width = Math.min(92, Math.round(recibido / (recibido + 6*1024*1024) * 100)) + '%';
        }
      }
      if (elBar) elBar.style.width = '100%';
      if (elTxt) elTxt.textContent = 'Abriendo el documento…';
      return new Blob(partes, { type: d.tipo || 'application/octet-stream' });
    }).then(function(blob){
      mostrarContenido(URL.createObjectURL(blob), blob);
    }).catch(function(e){
      const msg = window._driveNecesitaReconexion
        ? 'Google Drive necesita reconectarse (pide a un administrador que lo haga desde Panel de Control).'
        : 'Error al cargar desde Drive.';
      if(cont) cont.innerHTML = '<p style="color:#c0161a;padding:20px;text-align:center;">'+msg+'</p>';
      console.error('_pVerDoc Drive:', e);
    });
  } else if (src) {
    mostrarContenido(src);
  } else {
    if(cont) cont.innerHTML = '<p style="color:#c0161a;padding:20px;text-align:center;">Sin fuente de datos.</p>';
  }
}

function _pVerDocNav(dir){
  const ctx = window._docPreviewCtx;
  if (!ctx || !ctx.lista) return;
  const newIdx = (ctx.docIdx || 0) + dir;
  if (newIdx < 0 || newIdx >= ctx.lista.length) return;
  ctx.docIdx = newIdx;
  ctx.d = ctx.lista[newIdx];
  window._docZoomLevel = 1;
  window._docPanOffset = { x:0, y:0 };
  _pVerDocRender();
}

// Nombre con el que se descarga: el que tenía el archivo al subirlo. Se quita
// el prefijo numérico que el sistema le agrega en Drive (p. ej. "1712345678901_")
// y se asegura la extensión correcta.
function _docNombreDescarga(d){
  var n = String((d && d.nombre) || 'documento').trim().replace(/^\d{10,}_/, '');
  n = n.replace(/[\\/:*?"<>|]+/g, '_');
  if (!/\.[a-z0-9]{2,5}$/i.test(n)) {
    var t = (d && d.tipo) || '';
    var ext = t === 'application/pdf' ? '.pdf' : t === 'image/png' ? '.png' : t === 'image/webp' ? '.webp'
            : /jpe?g/.test(t) ? '.jpg' : /wordprocessingml/.test(t) ? '.docx' : t === 'application/msword' ? '.doc' : '';
    n += ext;
  }
  return n || 'documento';
}
async function _docObtenerBlobActual(d){
  if (window._docPrevBlob && window._docPrevBlob.d === d && window._docPrevBlob.blob) return window._docPrevBlob.blob;
  if (d.driveFileId) {
    const token = await driveGetAccessToken();
    if (!token) throw new Error('Drive no conectado');
    const resp = await fetch('https://www.googleapis.com/drive/v3/files/'+d.driveFileId+'?alt=media',{headers:{Authorization:'Bearer '+token}});
    if (!resp.ok) throw new Error('Drive '+resp.status);
    return await resp.blob();
  }
  if (d.r2path && typeof window.descargarR2 === 'function') return await window.descargarR2(d.r2path, d.bucket || 'placas');
  if (d.dataURL || d.base64) { const res = await fetch(d.dataURL || d.base64); return await res.blob(); }
  return null;
}
async function _pVerDocDescargar(){
  const ctx = window._docPreviewCtx;
  if (!ctx || !ctx.d) return;
  const d = ctx.d;
  const btn = document.getElementById('docPreviewBtnDescargar');
  const txtOrig = btn ? btn.innerHTML : '';
  try {
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Descargando…'; }
    const blob = await _docObtenerBlobActual(d);
    if (!blob) throw new Error('Sin archivo');
    const nombre = _docNombreDescarga(d);
    const file = (typeof File === 'function') ? new File([blob], nombre, { type: blob.type || d.tipo || 'application/octet-stream' }) : blob;
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.style.display = 'none';
    document.body.appendChild(a);   // algunos navegadores (Brave/Firefox) ignoran el clic si el enlace no está en la página
    a.click();
    setTimeout(function(){ a.remove(); URL.revokeObjectURL(url); }, 4000);
    if (typeof toast === 'function') toast('⭳ Descargado: ' + nombre, 'ok');
  } catch(e) {
    console.error('[Descargar documento]', e);
    if (typeof toast === 'function') toast('Error al descargar: ' + ((e && e.message) || e), 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = txtOrig; }
  }
}
function _pVerDocImprimir(){
  const ctx = window._docPreviewCtx;
  if (!ctx || !ctx.d) return;
  const ifr = document.getElementById('docPreviewIframe');
  if (ifr && ifr.contentWindow) { try { ifr.contentWindow.focus(); ifr.contentWindow.print(); return; } catch(e){} }
  const img = document.getElementById('docPreviewImg');
  if (img) {
    const w = window.open('', '_blank');
    if (!w) { if (typeof toast === 'function') toast('Permite ventanas emergentes para imprimir', 'err'); return; }
    w.document.write('<html><head><title>' + escHTML(_docNombreDescarga(ctx.d)) + '</title></head><body style="margin:0;text-align:center;"><img src="' + img.src + '" style="max-width:100%;" onload="window.print()"></body></html>');
    w.document.close();
  }
}

function backupLocal(tipo, datos) {
  // Deshabilitado — los datos viven exclusivamente en Supabase y R2
}

function listarBackups(tipo) {
  try {
    const indexStr = localStorage.getItem('lex_backup_idx_' + tipo);
    if (!indexStr) return [];
    const index = JSON.parse(indexStr);
    return index.map(it => {
      try {
        const datos = JSON.parse(localStorage.getItem(it.clave));
        return { clave: it.clave, timestamp: it.timestamp, fecha: datos.fecha, datos: datos.datos };
      } catch(e) { return null; }
    }).filter(x => x !== null).sort((a,b) => b.timestamp - a.timestamp);
  } catch(e) { return []; }
}

function restaurarBackup(tipo, claveBackup) {
  try {
    const item = localStorage.getItem(claveBackup);
    if (!item) return null;
    return JSON.parse(item).datos;
  } catch(e) { return null; }
}

function driveChipClick() {
  // FIX (13-sep-2026): el chip decía "⚠ Error al guardar — clic para
  // reintentar" pero el clic siempre caía en la rama de abajo y ofrecía
  // CERRAR SESIÓN, sin importar el estado — contradiciendo su propio texto.
  // Si el último guardado falló, el clic debe reintentarlo, no cerrar sesión.
  if (_syncState === 'error') {
    if (typeof toast === 'function') toast('🔄 Reintentando guardar...');
    if (typeof syncEstadoSupabase === 'function') {
      syncEstadoSupabase().catch(function(e){ if(typeof registrarError==='function') registrarError('driveChipClick.reintento', e); });
    }
    return;
  }
  if (sbSession && Date.now() < sbExpiry) {
    if (confirm('¿Cerrar sesión?\n\nLos datos locales se conservan. Solo se desconecta la sincronización en la nube.')) {
      sbSession = null; sbExpiry = 0;
      localStorage.removeItem('drive_token'); localStorage.removeItem('drive_expiry');
      actualizarAmbossBadges(false); toast('Sesión cerrada');
    }
  } else { iniciarAuth(); }
}

async function obtenerTimestampDrive(){
  // En Supabase usamos el updated_at de app_state
  if(!window.SB || !window.SB_DESPACHO_ID) return null;
  try {
    const { data } = await window.SB
      .from('app_state')
      .select('updated_at')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .single();
    return data ? new Date(data.updated_at).getTime() : null;
  } catch(e){ return null; }
}

async function verificarConflicto(){
  // En Supabase, verificamos contra updated_at de app_state.
  // updated_by nos dice quién hizo el último cambio.
  if(!window.SB || !window.SB_DESPACHO_ID || !_driveTimestampAlCargar) return false;
  try {
    const { data } = await window.SB
      .from('app_state')
      .select('updated_at, updated_by')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .single();
    if(!data || !data.updated_at) return false;
    const tsActual = new Date(data.updated_at).getTime();
    if(tsActual !== _driveTimestampAlCargar){
      // Otro usuario modificó — obtener su nombre
      let quien = 'otro usuario';
      if(data.updated_by){
        const { data: m } = await window.SB
          .from('miembros')
          .select('nombre')
          .eq('user_id', data.updated_by)
          .eq('despacho_id', window.SB_DESPACHO_ID)
          .single();
        if(m && m.nombre) quien = m.nombre;
      }
      const cuando = new Date(data.updated_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
      return { quien, cuando };
    }
    return false;
  } catch(e){ return false; }
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

function rcEnviarWA(tipoActa){
  var etiquetas={nacimiento:'Acta de nacimiento',matrimonio:'Acta de matrimonio',divorcio:'Acta de divorcio'};
  var nombre=etiquetas[tipoActa]||'Acta';
  var msg=encodeURIComponent(nombre+' + CURP');
  window.open('https://wa.me/'+RC_WA_NUM+'?text='+msg,'_blank');
  toast('💬 Abriendo WhatsApp: '+nombre,'ok');
}

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

function rec_iniciarDriveAuth() {
  // Usar el flujo de auth del LEX (sidebar) en lugar del del index
  if (typeof iniciarAuth === 'function') {
    iniciarAuth();
  } else if (_origIniciarDriveAuth) {
    _origIniciarDriveAuth();
  }
}

function _checkDriveAntesDe(accion) {
  if (!sbSession || Date.now() >= sbExpiry) {
    // Mostrar modal del LEX (panel flotante)
    var overlay = document.getElementById('drive-required-overlay');
    if (overlay) {
      overlay.classList.add('show');
      if (typeof _pendingActionAfterDrive !== 'undefined') _pendingActionAfterDrive = accion||null;
    } else {
      // Fallback: toast + scroll al sidebar
      if (typeof toast === 'function') toast('Inicia sesión en Supabase primero ☁️', 'err');
      var chip = document.getElementById('driveChip');
      if (chip) chip.scrollIntoView({behavior:'smooth'});
    }
    return false;
  }
  return true;
}

function mostrarModalDriveDesconectado() {
  var el = document.getElementById('modal-drive-desconectado');
  if (el) el.classList.add('show');
}

function cerrarModalDriveDesconectado() {
  var el = document.getElementById('modal-drive-desconectado');
  if (el) el.classList.remove('show');
}

// ── Estado de Cuenta (formato claro, 3 bloques) ──────────────────────────
// A petición expresa (oct-2026): el formato anterior (tabla de 9 columnas con
// Cargo / Adeudo anterior / Abono / Saldo restante) resultaba confuso para
// empleados y clientes. Ahora el documento responde tres preguntas, en orden:
//   1. COSTO DEL TRÁMITE  (una sola línea con el total; desglose chico solo
//      si hubo más de un cargo, p. ej. un Servicio Complementario)
//   2. CUÁNTO HA PAGADO   (una línea por pago: fecha · recibo · importe)
//   3. CUÁNTO DEBE        (una sola leyenda: "TRÁMITE CONCLUIDO Y PAGADO" / "ADEUDO: $X")
// Usa exactamente los mismos datos que ya calcula _calcularEstadoCuenta()
// (datos.filas / datos.totales) — solo cambia la presentación.
function _ecFechaLarga(iso){
  var s = String(iso||'').slice(0,10);
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return s || '—';
  var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return parseInt(m[3],10) + ' de ' + meses[parseInt(m[2],10)-1] + ' de ' + m[1];
}

function _ecFolioSinLetra(datos){
  var s = String(datos.folioStr || datos.folio || '');
  return s.replace(/[A-Za-z]$/, '');
}

// Convierte las filas del estado de cuenta en dos listas simples:
// cargos (lo que cuesta) y pagos (lo que ha pagado).
function _ecListas(datos){
  var cargos = [], pagos = [];
  (datos.filas || []).forEach(function(f){
    if(!f) return;
    var letra = String(f.folioStr||'').slice(-1).toUpperCase();
    if((parseFloat(f.cargo)||0) > 0.005){
      cargos.push({
        concepto: String(f.concepto||'').trim() || 'Costo del trámite',
        monto: parseFloat(f.cargo)||0,
        esOriginal: letra === 'A',
        fecha: f.fecha, recibo: f.folioStr, cancelado: !!f.cancelado
      });
    }
    if((parseFloat(f.abono)||0) > 0.005){
      pagos.push({ fecha: f.fecha, recibo: f.folioStr, monto: parseFloat(f.abono)||0, cancelado: !!f.cancelado });
    }
  });
  return { cargos: cargos, pagos: pagos };
}

// Estado final del folio → una sola leyenda (sin recuadro), a petición expresa:
//   pagado  → "TRÁMITE CONCLUIDO Y PAGADO"
//   adeuda  → "ADEUDO: $X"
function _ecEstado(datos){
  var t = datos.totales || {};
  var fmt = function(v){ return typeof fmtMXN==='function' ? fmtMXN(parseFloat(v||0)) : parseFloat(v||0).toFixed(2); };
  if(t.cancelado){
    var tipo = t.cancelacionTipo || '';
    var monto = parseFloat(t.cancelacionMonto||0);
    var extra = '';
    if(monto > 0.005 && tipo !== 'sin_movimiento'){
      extra = (tipo === 'ingreso' ? 'Honorarios por cancelación: $' : 'Reintegro al cliente: $') + fmt(monto);
    }
    return { clave:'cancelado', texto:'TRÁMITE CANCELADO', extra:extra, rgb:[150,28,28] };
  }
  var debe = parseFloat(t.adeudo||0);
  if(debe > 0.005){
    return { clave:'debe', texto:'ADEUDO: $' + fmt(debe), extra:'', rgb:[168,40,30] };
  }
  if(datos.abierto){
    return { clave:'abierto', texto:'SIN ADEUDO POR AHORA · TRÁMITE EN CURSO',
             extra:'Sin costo total pactado: pueden agregarse cargos conforme avance el trámite.', rgb:[26,110,58] };
  }
  return { clave:'pagado', texto:'TRÁMITE CONCLUIDO Y PAGADO',
           extra: datos.placa ? ('Placas: ' + String(datos.placa).toUpperCase()) : '', rgb:[26,110,58] };
}

function generarPDFEstadoCuenta(datos){
  datos = datos || window._estadoCuentaDatos;
  if(!datos){ if(typeof toast==='function') toast('No hay datos de estado de cuenta cargados','err'); return; }
  var jsPDFctor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
  var doc = new jsPDFctor({ orientation:'portrait', unit:'mm', format:'letter' });
  var W = doc.internal.pageSize.getWidth();
  var H = doc.internal.pageSize.getHeight();
  var mL = 20, mR = W - 20;
  var fmt = function(v){ return typeof fmtMXN==='function' ? fmtMXN(parseFloat(v||0)) : parseFloat(v||0).toFixed(2); };
  var ahora = new Date();
  var folioTxt = _ecFolioSinLetra(datos);
  var listas = _ecListas(datos);
  var estado = _ecEstado(datos);
  var t = datos.totales || {};
  // Paleta sobria tipo estado de cuenta bancario
  var NAVY = [34,28,16], ORO = [176,138,52], ORO_CLARO = [226,206,150], TINTA = [28,24,18],
      GRIS = [118,110,96], GRIS_CLARO = [222,216,204], FONDO = [248,245,238], VERDE = [26,110,58];
  var y = 0;
  var limiteY = H - 28;

  function color(c){ doc.setTextColor(c[0],c[1],c[2]); }
  function linea(x1,y1,x2,y2,c,w){ doc.setDrawColor(c[0],c[1],c[2]); doc.setLineWidth(w); doc.line(x1,y1,x2,y2); }
  // jsPDF no considera charSpace al alinear a la derecha/centro: se calcula a mano.
  function espaciado(txt, x, yy, align, cs){
    txt = String(txt);
    var w = doc.getTextWidth(txt) + cs * Math.max(0, txt.length - 1);
    var x0 = align === 'right' ? x - w : (align === 'center' ? x - w/2 : x);
    doc.text(txt, x0, yy, {charSpace: cs});
  }
  function etiqueta(txt, x, yy, align){
    doc.setFont('helvetica','normal'); doc.setFontSize(6.8); color(GRIS);
    espaciado(String(txt).toUpperCase(), x, yy, align||'left', 0.35);
  }
  function pie(){
    var yp = H - 18;
    linea(mL, yp, mR, yp, ORO, 0.4);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); color(GRIS);
    doc.text('Documento informativo. Resume los recibos oficiales del folio ' + folioTxt + ' y no los sustituye.', mL, yp + 5);
    doc.text('LEX-MÉXICO · Despacho Jurídico · Calle Miguel Hidalgo esq. México No. 200, Local B, Col. Centro, Santiago Juxtlahuaca, Oaxaca · Tel. 953 128 7511', mL, yp + 9);
  }
  function encabezadoSeccion(titulo, monto, fechaTxt){
    linea(mL + 0.4, y + 1, mL + 0.4, y + 8.5, ORO, 0.8);
    linea(mL, y + 9, mR, y + 9, ORO_CLARO, 0.3);
    doc.setFont('helvetica','bold'); doc.setFontSize(9.5); color(NAVY);
    doc.text(titulo, mL + 5, y + 6, {charSpace:0.3});
    if(monto){ doc.setFontSize(11); color(TINTA); doc.text(monto, mR - 4, y + 6.2, {align:'right'}); }
    if(fechaTxt){
      doc.setFontSize(11); var _wM = monto ? doc.getTextWidth(monto) : 0;
      doc.setFont('helvetica','normal'); doc.setFontSize(9); color(GRIS);
      doc.text(fechaTxt, mR - 4 - _wM - 8, y + 6.2, {align:'right'});
    }
    y += 9;
  }
  function asegurarEspacio(alto){
    if(y + alto <= limiteY) return;
    pie(); doc.addPage(); y = 20;
  }

  // ── Encabezado sin rellenos (ahorro de tinta): solo texto y filetes finos ──
  doc.setFont('times','bold'); doc.setFontSize(20); color(ORO);
  doc.text('LEX-MÉXICO', mL, 18);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); color(GRIS);
  doc.text('DESPACHO JURÍDICO', mL, 24, {charSpace:1.2});
  doc.setFont('helvetica','normal'); doc.setFontSize(8); color(GRIS);
  espaciado('ESTADO DE CUENTA', mR, 13, 'right', 1);
  doc.setFont('helvetica','bold'); doc.setFontSize(18); color(NAVY);
  doc.text('Folio ' + folioTxt, mR, 22, {align:'right'});
  linea(mL, 29, mR, 29, ORO, 0.7);
  linea(mL, 30.2, mR, 30.2, ORO, 0.2);
  y = 40;

  // ── Datos del cliente (dos columnas) ──
  var colB = mL + (mR - mL) * 0.62;
  etiqueta('Cliente', mL, y);
  etiqueta('Estado de cuenta impreso el:', colB, y);
  y += 4.5;
  doc.setFont('helvetica','bold'); doc.setFontSize(10); color(TINTA);
  doc.text(String(datos.nombre||'—').toUpperCase(), mL, y);
  doc.setFont('helvetica','normal');
  var _isoLocal = ahora.getFullYear() + '-' + String(ahora.getMonth()+1).padStart(2,'0') + '-' + String(ahora.getDate()).padStart(2,'0');
  var _horaGen = String(ahora.getHours()).padStart(2,'0') + ':' + String(ahora.getMinutes()).padStart(2,'0') + ' hrs.';
  doc.text(_ecFechaLarga(_isoLocal) + ', ' + _horaGen, colB, y);
  y += 8;
  etiqueta('Trámite', mL, y);
  etiqueta('Contacto', colB, y);
  y += 4.5;
  doc.setFont('helvetica','bold'); doc.setFontSize(10); color(TINTA);
  var trLines = doc.splitTextToSize(String(datos.tramite||'—').toUpperCase(), colB - mL - 6);
  doc.text(trLines, mL, y);
  doc.setFont('helvetica','normal');
  doc.text(String(datos.contacto||'—'), colB, y);
  y += 4.5 * trLines.length + 5;
  linea(mL, y, mR, y, GRIS_CLARO, 0.3);
  y += 9;

  // ── 1. COSTO DEL TRÁMITE ──
  asegurarEspacio(20);
  // Fecha en que se firmó el recibo original (letra A) — a petición expresa.
  var _cargoOrig = listas.cargos.filter(function(c){ return c.esOriginal; })[0];
  var _filaA = (datos.filas||[]).filter(function(f){ return String(f.folioStr||'').slice(-1).toUpperCase()==='A'; })[0];
  var _fechaFirma = (_cargoOrig && _cargoOrig.fecha) || (_filaA && _filaA.fecha) || '';
  encabezadoSeccion('1. COSTO DEL TRÁMITE', '$' + fmt(t.cargo), _fechaFirma ? _ecFechaLarga(_fechaFirma) : '');
  var cargosVisibles = listas.cargos.filter(function(c){ return !c.cancelado; });
  if(cargosVisibles.length > 1){
    y += 5.5;
    cargosVisibles.forEach(function(c){
      asegurarEspacio(6);
      var et = c.esOriginal ? c.concepto : (c.concepto + '  ·  ' + _ecFechaLarga(c.fecha) + '  ·  recibo ' + c.recibo);
      doc.setFont('helvetica','normal'); doc.setFontSize(8.8); color(GRIS);
      var ls = doc.splitTextToSize(et, mR - mL - 45);
      doc.text(ls, mL + 5, y);
      doc.text('$' + fmt(c.monto), mR - 4, y, {align:'right'});
      y += 4.6 * ls.length;
    });
    y -= 1;
  }
  y += 10;

  // ── 2. CUÁNTO HA PAGADO ──
  asegurarEspacio(30);
  encabezadoSeccion('2. CUÁNTO HA PAGADO', '');
  y += 6;
  var xRec = mL + 70;
  etiqueta('Fecha de pago', mL + 5, y);
  etiqueta('Recibo', xRec, y);
  etiqueta('Importe', mR - 4, y, 'right');
  y += 2.5;
  linea(mL, y, mR, y, GRIS_CLARO, 0.3);
  y += 5.5;
  if(!listas.pagos.length){
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); color(GRIS);
    doc.text('Sin pagos registrados', mL + 5, y);
    doc.text('$0.00', mR - 4, y, {align:'right'});
    y += 3; linea(mL, y, mR, y, GRIS_CLARO, 0.2); y += 5.5;
  } else {
    listas.pagos.forEach(function(p){
      asegurarEspacio(9);
      doc.setFont('helvetica','normal'); doc.setFontSize(9.5); color(TINTA);
      doc.text(_ecFechaLarga(p.fecha), mL + 5, y);
      doc.text(String(p.recibo||''), xRec, y);
      doc.text('$' + fmt(p.monto), mR - 4, y, {align:'right'});
      y += 3; linea(mL, y, mR, y, GRIS_CLARO, 0.2); y += 5.5;
    });
  }
  // Recuadro aparte con "Total pagado" y "Resta por cubrir" — a petición
  // expresa, para distinguir los totales de la lista de pagos. Solo contorno
  // (sin relleno) para ahorrar tinta.
  var _resta = t.cancelado ? 0 : Math.max(0, parseFloat(t.adeudo||0));
  asegurarEspacio(26);
  y += 2;
  var _bxW = 95, _bxX = mR - _bxW, _bxY = y, _bxH = 20;
  doc.setDrawColor(ORO[0],ORO[1],ORO[2]); doc.setLineWidth(0.45);
  doc.roundedRect(_bxX, _bxY, _bxW, _bxH, 1.5, 1.5, 'S');
  doc.setFont('helvetica','bold'); doc.setFontSize(10); color(TINTA);
  doc.text('Total pagado', _bxX + 5, _bxY + 7.5);
  color(VERDE);
  doc.text('$' + fmt(t.abono), mR - 5, _bxY + 7.5, {align:'right'});
  linea(_bxX + 4, _bxY + 10.5, mR - 4, _bxY + 10.5, ORO_CLARO, 0.3);
  color(TINTA);
  doc.text('Resta por cubrir', _bxX + 5, _bxY + 16);
  color(_resta > 0.005 ? [168,40,30] : TINTA);
  doc.text('$' + fmt(_resta), mR - 5, _bxY + 16, {align:'right'});
  y = _bxY + _bxH + 12;

  // ── 3. CUÁNTO DEBE ── (una sola leyenda, sin recuadro)
  asegurarEspacio(34);
  encabezadoSeccion('3. CUÁNTO DEBE', '');
  y += 11;
  doc.setFont('helvetica','bold'); doc.setFontSize(14); color(estado.rgb);
  espaciado(estado.texto, W/2, y, 'center', 0.6);
  if(estado.extra){
    y += 6;
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); color(GRIS);
    doc.text(estado.extra, W/2, y, {align:'center'});
  }
  y += 6;
  linea(W/2 - 45, y, W/2 + 45, y, ORO, 0.3);

  pie();
  var total = doc.internal.getNumberOfPages();
  for(var i=1;i<=total;i++){
    doc.setPage(i);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); color(GRIS);
    doc.text('Página ' + i + ' de ' + total, mR, H - 5, {align:'right'});
  }
  doc.setTextColor(0,0,0);
  return doc;
}

function _expDigRenderArchivos() {
  var lista = document.getElementById('exp-digital-lista-archivos');
  if (!lista) return;
  var docs = _expDigDocsArray(false);
  if (!docs.length) {
    lista.innerHTML = '<span style="color:#aaa;font-style:italic;">Sin archivos adjuntados — usa "Adjuntar archivos" para agregar.</span>';
    return;
  }
  lista.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:5px;">' + docs.map(function(d, i){
    var nm = d.nombre || d || 'doc';
    var lbl = nm.length > 26 ? nm.substring(0,26) + '…' : nm;
    var st = _docEstilo(nm, d && d.tipo);
    return '<span style="font-size:11px;background:'+st.bg+';border:1px solid '+st.borde+';border-radius:4px;padding:3px 9px;color:'+st.texto+';cursor:pointer;display:inline-flex;align-items:center;gap:4px;" onclick="_expDigVerDoc(' + i + ')" title="' + escHTML(nm) + '">' + st.icono + ' ' + escHTML(lbl) + '</span>';
  }).join('') + '</div>';
}

function _docRelClave(jId, cat){ return 'lex_docsrel_' + jId + '_' + cat; }

function _juRenderDocRel(idx){
  const pills = document.getElementById('mexp-docrel-cats');
  if(!pills) return;
  const activa = window._docRelCatActiva || _DOC_REL_CATEGORIAS[0];
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  pills.innerHTML = _DOC_REL_CATEGORIAS.map(cat =>
    '<span onclick="_docRelCambiarCat('+idx+',\''+cat+'\')" style="padding:4px 10px;border-radius:14px;font-size:0.62rem;cursor:pointer;border:1px solid '+(activa===cat?'var(--gold)':'var(--border-l)')+';background:'+(activa===cat?'var(--gold-bg)':'transparent')+';color:'+(activa===cat?'var(--gold-d)':'var(--muted)')+';font-weight:'+(activa===cat?'700':'400')+';white-space:nowrap;">'+esc2(cat)+'</span>'
  ).join('');
  _docRelCargar(idx, activa);
}

function _docRelCambiarCat(idx, cat){
  window._docRelCatActiva = cat;
  _juRenderDocRel(idx);
}

function _docRelRender(cat, lista){
  const cont = document.getElementById('mexp-docrel-lista');
  if(!cont) return;
  // Si mientras tanto cambió la categoría activa, no pisar la vista actual.
  if((window._docRelCatActiva || _DOC_REL_CATEGORIAS[0]) !== cat) return;
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  if(!lista.length){
    cont.innerHTML = '<div style="padding:20px 10px;text-align:center;color:var(--muted);font-size:0.72rem;line-height:1.6;">Sin documentos en «'+esc2(cat)+'».<br>Arrastra un PDF o usa <strong>＋ Subir</strong>.</div>';
    return;
  }
  const sorted = [...lista].sort((a,b) => String(b.fechaSubida||'').localeCompare(String(a.fechaSubida||'')));
  cont.innerHTML = sorted.map(f =>
    '<div style="border:1px solid var(--border-l);border-radius:7px;padding:8px 10px;margin-bottom:6px;display:flex;align-items:center;gap:8px;">'
    +   '<div style="flex:1;min-width:0;font-size:0.72rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc2(f.nombre||f.archivo)+'</div>'
    +   '<span style="font-size:0.6rem;color:var(--muted);flex-shrink:0;">'+esc2(f.fechaSubida||'')+'</span>'
    +   '<span onclick="verAcuerdoPDF(\''+f.driveFileId+'\',\''+encodeURIComponent(f.nombre||f.archivo)+'\')" title="Ver PDF" style="cursor:pointer;flex-shrink:0;font-size:1rem;">👁</span>'
    + '</div>'
  ).join('');
}

function _docRelInputChange(idx, input){
  if(!input.files || !input.files.length) return;
  _docRelSubirFiles(idx, input.files);
  input.value = '';
}

async function _prInicializarPanel() {
  await _prCargarDesdeR2();
  _prRenderLista();
}
