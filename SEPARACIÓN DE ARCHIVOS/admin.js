/* ═══════════════════════════════════════════════════════════════
   LEX-MÉXICO · admin.js
   Panel administrador, edición completa de recibos, placas
   Dependencias: utils.js debe cargarse primero
═══════════════════════════════════════════════════════════════ */

// ═══ PANEL ADMINISTRADOR ════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
const ADMIN_USERS = [
  { usuario: 'lexmexico423@gmail.com', pass: '1234**', nombre: 'LIC. NAHUM PELÁEZ' }
];
let adminSesionActiva = false;
let adminSesionUsuario = '';
let adminSesionHora = '';

function abrirAdminModal() {
  const btn = document.getElementById('adminGearBtn');
  if(!btn) return;
  // Garantizar que el botón siempre sea clickeable
  btn.style.pointerEvents = 'auto';
  btn.style.opacity = '1';
  // Limpiar animación previa y forzar reflow para reiniciarla limpia
  btn.classList.remove('spinning');
  void btn.offsetWidth;
  btn.classList.add('spinning');
  setTimeout(() => btn.classList.remove('spinning'), 520);

  // Reset zonas
  document.getElementById('adminAuthZone').style.display = 'block';
  document.getElementById('adminPanelZone').classList.remove('show');
  document.getElementById('adminBorrarEspecZone').classList.remove('show');
  var gz2 = document.getElementById('adminGestionRecibosZone');
  if (gz2) gz2.classList.remove('show');
  var gz3 = document.getElementById('adminEditarCobrosZone');
  if (gz3) gz3.classList.remove('show');
  var gz4 = document.getElementById('adminEditarMovDesdeEditarZone');
  if (gz4) gz4.classList.remove('show');
  document.getElementById('adminError').style.display = 'none';
  document.getElementById('adminUser').value = '';
  document.getElementById('adminPass').value = '';
  // Restablecer visibilidad de contraseña
  const passInput = document.getElementById('adminPass');
  const chk = document.getElementById('chkVerPass');
  const eyeOpen = document.getElementById('iconEyeOpen');
  const eyeOff  = document.getElementById('iconEyeOff');
  if (passInput) passInput.type = 'password';
  if (chk) chk.checked = false;
  if (eyeOpen) eyeOpen.style.display = '';
  if (eyeOff)  eyeOff.style.display  = 'none';

  // Si ya hay sesión activa, ir directo al panel
  if (adminSesionActiva) {
    adminMostrarPanel();
  }

  document.getElementById('adminModalOv').classList.add('show');
  setTimeout(() => {
    if (!adminSesionActiva) document.getElementById('adminUser').focus();
  }, 150);
}

function cerrarAdminModal() {
  // Limpiar animación de la rueda dentada por si quedó girando
  var gearBtn = document.getElementById('adminGearBtn');
  if(gearBtn) gearBtn.classList.remove('spinning');
  // Ocultar el overlay
  document.getElementById('adminModalOv').classList.remove('show');
  // Limpiar TODAS las zonas para que la próxima apertura inicie limpia
  // Sin esto, una zona secundaria abierta bloquea la UI al re-abrir
  var zonas = [
    'adminBorrarEspecZone',
    'adminGestionRecibosZone',
    'adminEditarCobrosZone',
    'adminEditarMovDesdeEditarZone',
    'adminHistoricosZone'
  ];
  zonas.forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.classList.remove('show');
  });
  // Restaurar panel principal visible para próxima apertura
  // (solo si ya hay sesión activa — si no, se muestra el login)
  if(adminSesionActiva){
    var pz = document.getElementById('adminPanelZone');
    if(pz) pz.classList.add('show');
  } else {
    var pz2 = document.getElementById('adminPanelZone');
    if(pz2) pz2.classList.remove('show');
  }
}
const cerrarAdmin = cerrarAdminModal;

// ── ELIMINAR RECIBO POR FOLIO (desde tarjeta rueda dentada) ──────────────────
function adminDelFolioBtnClick(){
  var input = document.getElementById('adminDelFolioInput');
  var folio = parseInt((input||{}).value) || 0;
  if(!folio || folio < 1){
    if(typeof toast === 'function') toast('⚠ Escribe un número de folio válido', 'err');
    if(input) input.focus();
    return;
  }
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var idx = recibos.findIndex(function(r){ return r && r.folio === folio; });
  if(idx < 0){
    if(typeof toast === 'function') toast('❌ Folio #' + folioFormato(folio) + ' no encontrado', 'err');
    return;
  }
  // Limpiar input y cerrar modal antes de abrir el confirm nativo
  if(input) input.value = '';
  cerrarAdminModal();
  // Pequeño delay para que el modal se cierre antes del alert
  setTimeout(function(){
    _abrirModalEliminarRecibo(folio);
  }, 150);
}

// Abrir preview de recibo desde la tabla de Contabilidad — overlay flotante
async function abrirPreviaDesdeContab(numFolio){
  const overlay = document.getElementById('contab-pdf-overlay');
  const embed   = document.getElementById('cpdf-embed');
  const loading = document.getElementById('cpdf-loading');
  const msg     = document.getElementById('cpdf-msg');
  const folioEl = document.getElementById('cpdf-folio');
  const nombreEl= document.getElementById('cpdf-nombre');
  const estadoEl= document.getElementById('cpdf-estado');

  // Buscar el recibo
  const recibos = (typeof appData!=='undefined'&&appData.recibos)?appData.recibos:(REC.recibos||[]);
  const r = recibos.find(x=>x.folio===numFolio||x.folio===parseInt(numFolio));
  if(!r){ toast('Recibo #'+folioFormato(numFolio)+' no encontrado','err'); return; }

  // Mostrar overlay con estado de carga
  overlay.style.display='flex';
  loading.style.display='flex';
  embed.setAttribute('src','');
  folioEl.textContent = 'FOLIO #'+folioFormato(r.folio, r.anio_folio);
  nombreEl.textContent = r.nombre||'—';
  const saldo = r.saldoPendiente||0;
  estadoEl.innerHTML = saldo>0
    ? '<span style="background:rgba(200,149,42,0.15);color:#e8c875;border:1px solid rgba(200,149,42,0.3);border-radius:4px;padding:2px 8px;font-family:JetBrains Mono,monospace;font-size:0.6rem;">PENDIENTE $'+fmt(saldo)+'</span>'
    : '<span style="background:rgba(40,180,80,0.15);color:#4dca6a;border:1px solid rgba(40,180,80,0.3);border-radius:4px;padding:2px 8px;font-family:JetBrains Mono,monospace;font-size:0.6rem;">&#10003; LIQUIDADO</span>';

  // SIEMPRE regenerar desde los datos actuales en memoria
  // Igual que rec_regenerarPDFDesdeRecibo: recalcular saldos desde pagosParciales
  msg.textContent='Generando PDF actualizado...';
  try{
    if(!r.clientes && !r.nombre){ msg.textContent='Sin datos suficientes para generar el PDF'; loading.style.display='none'; return; }

    // ── Validar y corregir saldos en memoria (igual que en área de Recibos) ──
    (function _validarSaldos(rec){
      const totalReal    = parseFloat(rec.total) || 0;
      const pagos        = rec.pagosParciales || [];
      const sumaPagos    = pagos.reduce((s,p) => s + (parseFloat(p.cantidad)||0), 0);
      const totalAbonadoReal = Math.min(sumaPagos, totalReal);
      const saldoReal        = Math.max(0, totalReal - totalAbonadoReal);
      if(rec.totalAbonado !== totalAbonadoReal) rec.totalAbonado = totalAbonadoReal;
      if(rec.saldoNuevo   !== saldoReal)        rec.saldoNuevo   = saldoReal;
      if(rec.saldoPendiente !== saldoReal)      rec.saldoPendiente = saldoReal;
    })(r);
    // ─────────────────────────────────────────────────────────────────────────

    const datos = {
      folio: r.folio,
      clientes: r.clientes||[{nombre:r.nombre||'',movil:'',tel:'',domicilio:''}],
      conceptos: r.conceptos||[], tipoTramite: r.tipoTramite||'normal',
      fecha_recibo: r.fecha_recibo||r.fecha, hora_recibo: r.hora_recibo||r.hora,
      anticipo: r.anticipo||'0', responsable: r.responsable||'',
      nombre_cliente_firma: r.nombre_cliente_firma||r.nombre||'',
      tramites: r.tramites||'', clase:r.clase||'', marca:r.marca||'',
      serie:r.serie||'', motor:r.motor||'', anio:r.anio||'', puertas:r.puertas||'',
      color_veh:r.color_veh||'', transmision:r.transmision||'',
      cilindros:r.cilindros||'', placa:r.placa||'',
      ultima_tenencia:r.ultima_tenencia||'', origen:r.origen||'', combustible:r.combustible||'',
      copias:r.copias||[], costosExtra:r.costosExtra||[],
      pagosParciales:r.pagosParciales||[], fechasImpresion:r.fechasImpresion||[],
      totalGeneral: r.total||0,
      totalAbonado: r.totalAbonado,
      saldoNuevo:   r.saldoNuevo
    };

    const qrTexto='LEX-MEXICO|Folio:'+folioFormato(r.folio, r.anio_folio)+'|'+(r.nombre||'')+'|'+(datos.fecha_recibo||'')+' '+(datos.hora_recibo||'');
    const qrDataURL=await qrToDataURL(qrTexto);
    const doc=await generarPDF(datos,r.folio,qrDataURL);
    const pdfUri=doc.output('datauristring');
    r.pdfBase64=pdfUri;
    embed.setAttribute('src',pdfUri);
    loading.style.display='none';
  }catch(e){
    msg.textContent='Error: '+e.message;
    console.error('contabPDF:',e);
  }
}

function cerrarContabPDF(){
  const overlay=document.getElementById('contab-pdf-overlay');
  overlay.style.display='none';
  document.getElementById('cpdf-embed').setAttribute('src','');
}

function adminLogin() {
  const u = (document.getElementById('adminUser').value || '').trim();
  const p = (document.getElementById('adminPass').value || '').trim();
  const errEl = document.getElementById('adminError');

  const match = ADMIN_USERS.find(a => a.usuario.toLowerCase() === u.toLowerCase() && a.pass === p);
  if (!match) {
    errEl.style.display = 'block';
    document.getElementById('adminPass').value = '';
    document.getElementById('adminPass').focus();
    return;
  }

  errEl.style.display = 'none';
  adminSesionActiva = true;
  adminSesionUsuario = match.nombre || match.usuario;
  const now = new Date();
  adminSesionHora = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  adminMostrarPanel();

  // ── HOOK DASHBOARD: ejecutar acción pendiente si vino del Panel de Control ──
  if(window._dashAccionPendiente){
    var accionPend = window._dashAccionPendiente;
    window._dashAccionPendiente = null;
    setTimeout(function(){
      if(typeof dashEjecutarAccion === 'function'){
        dashEjecutarAccion(accionPend);
      }
    }, 300);
  }
}

function adminMostrarPanel() {
  document.getElementById('adminAuthZone').style.display = 'none';
  document.getElementById('adminBorrarEspecZone').classList.remove('show');
  var _gz = document.getElementById('adminGestionRecibosZone'); if(_gz) _gz.classList.remove('show');
  var _gz2 = document.getElementById('adminEditarCobrosZone'); if(_gz2) _gz2.classList.remove('show');
  var _gz3 = document.getElementById('adminEditarMovDesdeEditarZone'); if(_gz3) _gz3.classList.remove('show');
  document.getElementById('adminPanelZone').classList.add('show');
  document.getElementById('adminSessionUser').textContent = adminSesionUsuario;
  document.getElementById('adminSessionTime').textContent = 'desde ' + adminSesionHora;

  try {
    // Estado de caja — btnDesbloquearCaja no existe como button (es un div), verificar null
    const cajaEl = document.getElementById('cajaEstadoBadge');
    const btnDesbloquear = document.getElementById('btnDesbloquearCaja');
    if (cajaBloqueada()) {
      if(cajaEl){ cajaEl.textContent = '\uD83D\uDD12 Caja cerrada hoy'; cajaEl.style.color = '#e85555'; }
      if(btnDesbloquear){ btnDesbloquear.disabled = false; btnDesbloquear.textContent = '\uD83D\uDD13 Desbloquear'; }
    } else {
      if(cajaEl){ cajaEl.textContent = '\u2705 Caja abierta'; cajaEl.style.color = '#4dca6a'; }
      if(btnDesbloquear){ btnDesbloquear.disabled = true; btnDesbloquear.textContent = '\u2713 Ya abierta'; }
    }

    // Conteo movimientos hoy
    const movHoy = (D.movimientos || []).filter(m => m.fecha === hoy());
    var elMovHoy = document.getElementById('adminMovHoyCnt');
    if(elMovHoy) elMovHoy.textContent = movHoy.length;
    const elRec2 = document.getElementById('adminRecCnt');
    if (elRec2 && typeof appData !== 'undefined') elRec2.textContent = (appData.recibos||[]).length;

    // Estado del ultimo backup
    const backupEl = document.getElementById('adminBackupStatus');
    if(backupEl){
      const ultimo = localStorage.getItem(BACKUP_KEY);
      backupEl.textContent = ultimo ? 'Ultimo backup: ' + ultimo : 'Sin backup registrado';
    }

    // Saldo actual en caja — btnAdminCorte no existe como button (es un div), verificar null
    const saldoEl = document.getElementById('adminSaldoCajaInfo');
    const btnCorte = document.getElementById('btnAdminCorte');
    if(saldoEl){
      const saldoActual = getSaldo();
      if(saldoActual > 0){
        saldoEl.textContent = 'Saldo actual: $' + fmt(saldoActual);
        if(btnCorte) btnCorte.disabled = false;
      } else {
        saldoEl.textContent = 'Sin saldo en caja';
        if(btnCorte){ btnCorte.disabled = true; btnCorte.style.opacity = '0.4'; }
      }
    }
  } catch(e) {
    console.warn('[adminMostrarPanel] Error al actualizar indicadores:', e);
  }
}

async function adminVerificarConflicto(){
  toast('Verificando sincronización...');
  const conflicto = await verificarConflicto();
  if(!conflicto){
    toast('✅ Sin conflictos — tu versión está sincronizada');
  } else {
    const msg = `⚠️ VERSIÓN DESACTUALIZADA\n\n${conflicto.quien} modificó los datos a las ${conflicto.cuando}.\n\n¿Cargar la versión más reciente de Drive?`;
    if(confirm(msg)){
      cerrarAdminModal();
      await sync();
      toast('✅ Versión más reciente cargada');
    }
  }
}

function adminCorteDeCaja(){
  const saldo = getSaldo();
  if(saldo <= 0){ toast('No hay saldo en caja para hacer corte', 'err'); return; }

  const confirmMsg = [
    '💰 CORTE DE CAJA',
    '',
    '  TOTAL A ENTREGAR: $' + fmt(saldo),
    '',
    'Autorizado por: ' + adminSesionUsuario,
    '',
    'La caja seguirá abierta para seguir operando.',
    '¿Confirmas el corte?'
  ].join('\n');

  if(!confirm(confirmMsg)) return;

  // Registrar el corte como movimiento de caja y en D.cierres
  const fechaCorte = hoy();
  const horaCorte  = hora();

  // Movimiento de egreso que represente la salida del dinero
  const movCorte = {
    id:          'CORTE-' + Date.now(),
    fecha:       fechaCorte,
    hora:        horaCorte,
    descripcion: 'CORTE DE CAJA — $' + fmt(saldo) + ' entregados',
    monto:       saldo,
    tipo:        'egreso',
    cat:         'corte',
    fuente:      'corte',
    responsable: adminSesionUsuario || empNombre(),
    esCorte:     true
  };
  _registrarMovimiento(movCorte);

  // Registrar en D.cierres para que aparezca en contabilidad
  if(!D.cierres) D.cierres = [];
  D.cierres.unshift({
    fecha:           fechaCorte,
    hora:            horaCorte,
    saldoEntregado:  saldo,
    responsable:     adminSesionUsuario || empNombre(),
    esCorte:         true
  });

  // Resetear saldo acumulado a 0
  D.saldoAcumulado = 0;

  // La caja NO se bloquea — sigue abierta para seguir operando
  save();
  syncEstadoSupabaseDebounced();
  cerrarAdminModal();
  if(typeof renderCaja    === 'function') renderCaja();
  if(typeof renderContab  === 'function') renderContab();
  toast('✅ Corte de caja registrado — $' + fmt(saldo) + ' entregados. La caja sigue abierta.');
}

function adminDiagnosticoSaldo(){
  console.group('=== DIAGNÓSTICO SALDO ===');
  console.log('D.cierres:', JSON.stringify(D.cierres));
  const cortes = (D.cierres||[]).filter(c=>c.esCorte===true);
  console.log('Cortes (esCorte:true):', JSON.stringify(cortes));
  const cierresSinCorte = (D.cierres||[]).filter(c=>!c.esCorte);
  console.log('Cierres normales (sin esCorte):', JSON.stringify(cierresSinCorte));
  const ultimoCorte = cortes.sort((a,b)=>((b.fecha||'')+'T'+(b.hora||'')).localeCompare((a.fecha||'')+'T'+(a.hora||'')))[0];
  console.log('Último corte:', ultimoCorte);
  const tsCorte = ultimoCorte ? (ultimoCorte.fecha+'T'+(ultimoCorte.hora||'00:00')+':00') : null;
  console.log('tsCorte usado para filtrar:', tsCorte);
  const movsFiltrados = (D.movimientos||[]).filter(m=>{
    if(!m.fecha) return false;
    if(!tsCorte) return true;
    const tsMov = m.fecha+'T'+(m.hora||'00:00')+':00';
    return tsMov > tsCorte;
  });
  console.log('Movimientos después del corte:', movsFiltrados.length);
  movsFiltrados.forEach(m=>console.log(`  ${m.fecha} ${m.hora} | ${m.tipo} | $${m.monto} | ${m.descripcion?.substring(0,40)}`));
  const ing = movsFiltrados.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
  const egr = movsFiltrados.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
  console.log('INGRESOS:', ing, '| EGRESOS:', egr, '| SALDO:', ing-egr);
  console.groupEnd();
  alert('Diagnóstico en consola (F12). Saldo calculado: $'+(ing-egr).toFixed(2)+'\nCortes encontrados: '+cortes.length+'\nÚltimo corte: '+(ultimoCorte?ultimoCorte.fecha+' '+ultimoCorte.hora:'ninguno')+'\nMovimientos post-corte: '+movsFiltrados.length);
}
function adminRepararFoliosCaja(){
  // Contar movimientos de caja activos antes
  const movsCajaAntes = (D.movimientos||[]).filter(m=>m.fuente!=='recibo' && m.fuente!=='corte' && !m.borrado);

  // Diagnóstico previo: detectar huecos y desorden
  const foliosAntes = movsCajaAntes.map(m=>m.folioCaja||'—').sort();
  const mesesAntes = {};
  movsCajaAntes.forEach(m=>{
    const my = _folioMY(m.fecha||hoy());
    if(!mesesAntes[my]) mesesAntes[my] = 0;
    mesesAntes[my]++;
  });

  let resumenMeses = '';
  Object.keys(mesesAntes).sort().forEach(my=>{
    resumenMeses += '\n  ' + my + ': ' + mesesAntes[my] + ' movimiento(s)';
  });

  const msg = '🔢 REPARAR NUMERACIÓN DE FOLIOS DE CAJA\n\n'
    + 'Esta operación reasignará los folios F-MY de todos los movimientos de caja '
    + 'de forma ordenada y sin huecos, reiniciando el consecutivo cada mes.\n\n'
    + 'Movimientos a renumerar: ' + movsCajaAntes.length + '\n'
    + 'Meses detectados:' + (resumenMeses || ' ninguno') + '\n\n'
    + '⚠ Los folios de RECIBOS no se tocan.\n\n'
    + '¿Proceder con la reparación?';

  if(!confirm(msg)) return;

  // Ejecutar reordenamiento
  _reordenarFoliosCaja();
  save();

  // Sincronizar con Supabase
  var promesas = [];
  promesas.push(syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); }));
  if(typeof actualizarArchivoControl === 'function')
    promesas.push(actualizarArchivoControl().catch(e=>console.warn(e)));

  Promise.all(promesas).then(function(){
    if(typeof renderCaja === 'function') renderCaja();
    if(typeof renderContab === 'function') renderContab();
    // Mostrar resultado
    const movsCajaDespues = (D.movimientos||[]).filter(m=>m.fuente!=='recibo' && m.fuente!=='corte' && !m.borrado);
    let resumenFinal = '';
    const mesesFinal = {};
    movsCajaDespues.forEach(m=>{
      const my = _folioMY(m.fecha||hoy());
      if(!mesesFinal[my]) mesesFinal[my] = [];
      mesesFinal[my].push(m.folioCaja);
    });
    Object.keys(mesesFinal).sort().forEach(my=>{
      const folios = mesesFinal[my];
      const min = folios[0];
      const max = folios[folios.length-1];
      resumenFinal += '\n  ' + my + ': ' + folios.length + ' mov. → ' + min + ' … ' + max;
    });
    alert('✅ Numeración reparada correctamente.\n\nFolios por mes:' + resumenFinal + '\n\nContabilidad y Principal actualizados.');
    toast('✅ Folios de caja reparados y sincronizados');
  }).catch(function(e){
    toast('⚠ Reparación local OK, error al sincronizar: '+e.message,'err');
    if(typeof renderCaja === 'function') renderCaja();
    if(typeof renderContab === 'function') renderContab();
  });
}

function cerrarSesionUsuario() {
  if (!confirm('¿Confirmas cerrar tu sesión?')) return;
  try {
    if (window.SB) window.SB.auth.signOut().catch((e)=>{ registrarError('Promise catch vacio', e); });
  } catch(e){ registrarError('catch vacio', e); }
  sbSession = null; sbExpiry = 0;
  empleadoActual = null;
  localStorage.removeItem('empleado_email');
  localStorage.removeItem('empleado_nombre');
  lexRealtimeDesconectar();
  const btn = document.getElementById('btn-cerrar-sesion');
  if (btn) btn.style.display = 'none';
  // Recargar para volver al login
  setTimeout(() => location.reload(), 300);
}

function adminLogout() {
  adminSesionActiva = false;
  adminSesionUsuario = '';
  adminSesionHora = '';
  cerrarAdminModal();
  toast('Sesión de administrador cerrada');
}

function adminDesbloquearCaja() {
  if (!cajaBloqueada()) { toast('La caja ya está abierta', 'ok'); return; }
  if (!confirm('¿Confirmas el desbloqueo de la caja?\nEsto permitirá registrar nuevos movimientos aunque ya fue cerrada hoy.')) return;
  localStorage.removeItem('caja_cerrada_fecha');
  aplicarEstadoCierre();
  renderCaja();
  toast('🔓 Caja desbloqueada correctamente');
  // Actualizar el badge en el panel
  const cajaEl = document.getElementById('cajaEstadoBadge');
  const btnDesbloquear = document.getElementById('btnDesbloquearCaja');
  if (cajaEl) { cajaEl.textContent = '✅ Caja abierta'; cajaEl.style.color = '#4dca6a'; }
  if (btnDesbloquear) { btnDesbloquear.disabled = true; btnDesbloquear.textContent = '✓ Ya abierta'; }
}

function adminBorrarCobrosHoy() {
  const movHoy = (D.movimientos || []).filter(m => m.fecha === hoy() && !m.borrado);
  if (!movHoy.length) { toast('No hay movimientos de hoy para eliminar', 'err'); return; }
  if (!confirm(`¿Borrar los ${movHoy.length} movimientos del día de hoy (${hoy()})?\n\nLos días anteriores NO se afectan.\nEsta acción no se puede deshacer.`)) return;

  // ── SOFT-DELETE CON TOMBSTONES ─────────────────────────────────────
  // Marcar como borrado en lugar de eliminar (soft-delete para Supabase sync).
  // hace una fusión bidireccional y los movimientos REAPARECEN porque Drive
  // aún los tenía sin la lápida.
  const fechaBorrado = new Date().toISOString();
  const borradoPor = (typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.email)
    ? empleadoActual.email : 'admin';
  const idsABorrar = new Set(movHoy.map(m => m.id));
  const cnt = movHoy.length;

  D.movimientos.forEach(m => {
    if (idsABorrar.has(m.id)) {
      m.borrado = true;
      m.fechaBorrado = fechaBorrado;
      m.borradoPor = borradoPor;
    }
  });
  guardarTodo()
    .then(() => {
      // 1. Quitar tombstones definitivamente
      D.movimientos = D.movimientos.filter(m => !idsABorrar.has(m.id));
      // 2. Reordenar folios ya sin los borrados y persistir
      _reordenarFoliosCaja();
          if (typeof renderCaja === 'function') renderCaja();
      if (typeof renderContab === 'function') renderContab();
      const el2 = document.getElementById('adminMovHoyCnt');
      if (el2) el2.textContent = '0';
      toast(`🗑 ${cnt} movimientos de hoy eliminados`);
    })
    .catch(e => { console.warn('borrar cobros hoy:', e); toast('Error al eliminar en Drive','err'); });
}

// ══════════════════════════════════════════════════════════════════
// EDITAR COBROS / EGRESOS — Zona nueva (botón 11)
// ══════════════════════════════════════════════════════════════════
var _adminEditarTipoFiltro = 'todos';

function adminAbrirEditarCobros() {
  document.getElementById('adminPanelZone').classList.remove('show');
  var z = document.getElementById('adminEditarCobrosZone');
  if(z) z.classList.add('show');
  _adminEditarTipoFiltro = 'todos';
  var inp = document.getElementById('adminBuscarMovEditar');
  if(inp) inp.value = '';
  adminActualizarBotonesFiltro('todos');
  adminRenderMovsEditar('', 'todos');
}

function adminVolverEditarCobros() {
  var z1 = document.getElementById('adminEditarMovDesdeEditarZone');
  if(z1) z1.classList.remove('show');
  var z2 = document.getElementById('adminEditarCobrosZone');
  if(z2) z2.classList.add('show');
  var q = (document.getElementById('adminBuscarMovEditar')||{}).value || '';
  adminRenderMovsEditar(q, _adminEditarTipoFiltro);
}

function adminFiltroTipo(tipo) {
  _adminEditarTipoFiltro = tipo;
  adminActualizarBotonesFiltro(tipo);
  var q = (document.getElementById('adminBuscarMovEditar')||{}).value || '';
  adminRenderMovsEditar(q, tipo);
}

function adminActualizarBotonesFiltro(tipo) {
  var ids = {todos:'filtroTodosBtn',ingreso:'filtroIngresosBtn',egreso:'filtroEgresosBtn'};
  var activos = {
    todos:   {bg:'rgba(160,100,255,0.25)',bord:'rgba(160,100,255,0.5)',col:'#d4b0ff'},
    ingreso: {bg:'rgba(43,170,90,0.25)',bord:'rgba(43,170,90,0.5)',col:'#4dca6a'},
    egreso:  {bg:'rgba(192,22,26,0.25)',bord:'rgba(192,22,26,0.5)',col:'#e85555'}
  };
  var apagados = {
    todos:   {bg:'rgba(0,0,0,0.1)',bord:'rgba(160,100,255,0.15)',col:'rgba(212,176,255,0.35)'},
    ingreso: {bg:'rgba(43,170,90,0.05)',bord:'rgba(43,170,90,0.15)',col:'rgba(77,202,106,0.35)'},
    egreso:  {bg:'rgba(192,22,26,0.05)',bord:'rgba(192,22,26,0.15)',col:'rgba(232,85,85,0.35)'}
  };
  ['todos','ingreso','egreso'].forEach(function(t){
    var btn = document.getElementById(ids[t]);
    if(!btn) return;
    var s = (t===tipo) ? activos[t] : apagados[t];
    btn.style.background = s.bg;
    btn.style.borderColor = s.bord;
    btn.style.color = s.col;
  });
}

function adminFiltrarMovsEditar() {
  var q = (document.getElementById('adminBuscarMovEditar')||{}).value || '';
  adminRenderMovsEditar(q, _adminEditarTipoFiltro);
}

function adminRenderMovsEditar(q, tipo) {
  var listEl = document.getElementById('adminMovListEditar');
  if(!listEl) return;
  var todos = _ordenarMovs(D.movimientos || []);
  var filtrados = todos.filter(function(m){
    if(tipo && tipo !== 'todos' && m.tipo !== tipo) return false;
    if(q){
      var ql = q.toLowerCase();
      return (m.descripcion||'').toLowerCase().includes(ql) ||
             (m.fecha||'').includes(ql) ||
             (m.cat||'').toLowerCase().includes(ql);
    }
    return true;
  });

  if(!filtrados.length){
    listEl.innerHTML = '<div style="text-align:center;padding:20px;font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;color:rgba(212,176,255,0.4);">Sin movimientos encontrados</div>';
    return;
  }

  listEl.innerHTML = filtrados.slice(0,60).map(function(m){
    var esIngreso = m.tipo === 'ingreso';
    var color = esIngreso ? '#4dca6a' : '#e85555';
    var signo = esIngreso ? '+' : '-';
    var monto = typeof m.monto === 'number' ? m.monto.toFixed(2) : (m.monto || '0.00');
    var esRecibo = m.fuente === 'recibo';
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid rgba(160,100,255,0.12);border-radius:7px;margin-bottom:6px;background:rgba(160,100,255,0.03);transition:background 0.15s;" onmouseover="this.style.background=\'rgba(160,100,255,0.08)\'" onmouseout="this.style.background=\'rgba(160,100,255,0.03)\'">'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-family:\'Outfit\',sans-serif;font-size:0.78rem;color:var(--gold-l);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(m.descripcion||'—')+'</div>'
      +'<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.55rem;color:rgba(200,149,42,0.4);margin-top:2px;">'+(m.fecha||'—')+' '+(m.hora||'')+' · '+(m.cat||'—')+(esRecibo?' · 🧾 Recibo':'')+'</div>'
      +'</div>'
      +'<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.78rem;font-weight:700;color:'+color+';flex-shrink:0;">'+signo+'$'+monto+'</div>'
      +(!esRecibo?'<button onclick="adminAbrirEditarMovDesdeEditar(\''+m.id+'\')" style="background:rgba(160,100,255,0.15);border:1px solid rgba(160,100,255,0.4);border-radius:5px;padding:5px 10px;cursor:pointer;font-family:\'JetBrains Mono\',monospace;font-size:0.6rem;color:#d4b0ff;font-weight:700;flex-shrink:0;" onmouseover="this.style.background=\'rgba(160,100,255,0.3)\'" onmouseout="this.style.background=\'rgba(160,100,255,0.15)\'">✏️ Editar</button>':'<span style="font-size:0.55rem;color:rgba(200,149,42,0.3);font-family:\'JetBrains Mono\',monospace;flex-shrink:0;">🧾 Recibo</span>')
      +'</div>';
  }).join('');
}

function adminAbrirEditarMovDesdeEditar(id) {
  var mov = (D.movimientos || []).find(function(m){ return m.id === id; });
  if(!mov){ if(typeof toast==='function') toast('Movimiento no encontrado','err'); return; }

  document.getElementById('adminEdit2MovId').value    = id;
  document.getElementById('adminEdit2MovDesc').value  = mov.descripcion || '';
  document.getElementById('adminEdit2MovFecha').value = mov.fecha || (typeof hoy==='function'?hoy():'');
  document.getElementById('adminEdit2MovHora').value  = mov.hora || (typeof hora==='function'?hora():'');
  document.getElementById('adminEdit2MovMonto').value = mov.monto || 0;
  document.getElementById('adminEdit2MovTipo').value  = mov.tipo || 'ingreso';
  document.getElementById('adminEdit2MovCat').value   = mov.cat || 'otro';
  document.getElementById('adminEdit2MovResp').value  = ((mov.responsable || (typeof empNombre==='function'?empNombre():''))).toUpperCase();

  var z1 = document.getElementById('adminEditarCobrosZone');
  if(z1) z1.classList.remove('show');
  var z2 = document.getElementById('adminEditarMovDesdeEditarZone');
  if(z2) z2.classList.add('show');
}

function adminGuardarEdicion2Mov() {
  var id = document.getElementById('adminEdit2MovId').value;
  var idx = (D.movimientos || []).findIndex(function(m){ return m.id === id; });
  if(idx < 0){ if(typeof toast==='function') toast('Movimiento no encontrado','err'); return; }

  var monto = parseFloat(document.getElementById('adminEdit2MovMonto').value);
  if(isNaN(monto) || monto < 0){ if(typeof toast==='function') toast('Monto inválido','err'); return; }

  var m = D.movimientos[idx];
  m.descripcion = document.getElementById('adminEdit2MovDesc').value.trim() || m.descripcion;
  m.fecha       = document.getElementById('adminEdit2MovFecha').value || m.fecha;
  m.hora        = document.getElementById('adminEdit2MovHora').value || m.hora;
  m.monto       = monto;
  m.tipo        = document.getElementById('adminEdit2MovTipo').value;
  m.cat         = document.getElementById('adminEdit2MovCat').value;
  m.responsable = document.getElementById('adminEdit2MovResp').value.trim() || m.responsable;

  // Borrar historial de cambios previos del movimiento (registro limpio)
  m.historialCambios = [];
  // Registrar solo esta edición como referencia de auditoría
  m.historialCambios.push({
    tipo:'edicion_admin',
    fecha: typeof hoy==='function'?hoy():'',
    hora: typeof hora==='function'?hora():'',
    usuario: adminSesionUsuario||'Admin'
  });

  // ── Guardar en TODOS los lugares donde se refleja el movimiento ──────────
  // 1. localStorage + Drive principal (D.movimientos vive aquí)
  try { if(typeof backupLocal==='function') backupLocal('D', D); } catch(e){ registrarError('catch vacio', e); }

  // 2. Re-renderizar caja y contabilidad inmediatamente (UI consistente)
  if(typeof renderCaja==='function') renderCaja();
  if(typeof renderContab==='function') renderContab();

  // Indicador visual: botón en estado "guardando"
  var btnGuardar = document.querySelector('#adminEditarMovDesdeEditarZone button[onclick="adminGuardarEdicion2Mov()"]');
  if(btnGuardar){
    btnGuardar.disabled = true;
    btnGuardar.textContent = '⏳ Guardando…';
  }

  // 3. Sincronizar con Supabase y con archivo de control
  var promesas = [];
  promesas.push(syncEstadoSupabaseDebounced().catch(function(e){ console.warn('guardado Supabase:', e); }));
  if(typeof actualizarArchivoControl==='function')
    promesas.push(actualizarArchivoControl().catch(function(e){ console.warn('guardado archivo control:', e); }));

  Promise.all(promesas).then(function(){
    if(typeof toast==='function') toast('✅ Movimiento guardado y sincronizado en todos los registros','ok');
    if(btnGuardar){ btnGuardar.disabled=false; btnGuardar.textContent='💾 Guardar Cambios'; }
    if(typeof window._marcarGuardadoOk==='function') window._marcarGuardadoOk();
    adminVolverEditarCobros();
  }).catch(function(){
    // Incluso si Drive falla, el cambio ya está en localStorage — encolar para reintentar
    if(typeof window._encolarGuardadoPendiente==='function'){
      window._encolarGuardadoPendiente('syncEstado', null);
    }
    if(typeof toast==='function') toast('⚠️ Guardado local OK · se sincronizará cuando haya conexión','warn');
    if(btnGuardar){ btnGuardar.disabled=false; btnGuardar.textContent='💾 Guardar Cambios'; }
    adminVolverEditarCobros();
  });
}
// ══ FIN EDITAR COBROS / EGRESOS ══

function adminAbrirBorrarEspecifico() {
  document.getElementById('adminPanelZone').classList.remove('show');
  document.getElementById('adminBorrarEspecZone').classList.add('show');
  document.getElementById('adminBuscarMov').value = '';
  adminRenderMovimientos('');
}

function adminVolverPanel() {
  ['adminBorrarEspecZone','adminEditarCobrosZone','adminEditarMovDesdeEditarZone','adminHistoricosZone','adminCapturaMesZone'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.classList.remove('show');
  });
  adminMostrarPanel();
}

function adminFiltrarMovimientos() {
  const q = document.getElementById('adminBuscarMov').value;
  adminRenderMovimientos(q);
}

function adminRenderMovimientos(q) {
  const listEl = document.getElementById('adminMovList');
  if (!listEl) return;
  // Excluir movimientos con tombstone — son lápidas pendientes de sync, no deben verse
  const todos = _ordenarMovs((D.movimientos || []).filter(m => !m.borrado));
  const filtrados = q
    ? todos.filter(m =>
        (m.descripcion||'').toLowerCase().includes(q.toLowerCase()) ||
        (m.fecha||'').includes(q) ||
        (m.cat||'').toLowerCase().includes(q.toLowerCase())
      )
    : todos;

  if (!filtrados.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;color:rgba(200,149,42,0.4);">Sin movimientos encontrados</div>';
    return;
  }

  listEl.innerHTML = filtrados.slice(0, 50).map(m => {
    const esIngreso = m.tipo === 'ingreso';
    const color = esIngreso ? '#4dca6a' : '#e85555';
    const signo = esIngreso ? '+' : '-';
    const monto = typeof m.monto === 'number' ? m.monto.toFixed(2) : (m.monto || '0.00');
    const esRecibo = m.fuente === 'recibo';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid rgba(200,149,42,0.12);border-radius:7px;margin-bottom:6px;background:rgba(200,149,42,0.03);transition:background 0.15s;" onmouseover="this.style.background='rgba(200,149,42,0.07)'" onmouseout="this.style.background='rgba(200,149,42,0.03)'">
        <div style="flex:1;min-width:0;">
          <div style="font-family:sans-serif;font-size:0.78rem;color:var(--gold-l);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(m.descripcion||'—')}</div>
          <div style="font-family:monospace;font-size:0.55rem;color:rgba(200,149,42,0.4);margin-top:2px;">${m.fecha||'—'} ${m.hora||''} · ${m.cat||'—'}${esRecibo?' · 🧾 Recibo':''}</div>
        </div>
        <div style="font-family:monospace;font-size:0.78rem;font-weight:700;color:${color};flex-shrink:0;">${signo}$${monto}</div>
        ${!esRecibo?`<button onclick="adminEditarMovEspec('${m.id}')" style="background:rgba(200,149,42,0.1);border:1px solid rgba(200,149,42,0.3);border-radius:5px;padding:4px 9px;cursor:pointer;font-family:monospace;font-size:0.58rem;color:var(--gold-l);font-weight:700;flex-shrink:0;transition:all 0.15s;" onmouseover="this.style.background='rgba(200,149,42,0.22)'" onmouseout="this.style.background='rgba(200,149,42,0.1)'">✏️</button>`:''}
        <button onclick="adminBorrarMovEspec('${m.id}')" style="background:rgba(192,22,26,0.12);border:1px solid rgba(192,22,26,0.3);border-radius:5px;padding:4px 9px;cursor:pointer;font-family:monospace;font-size:0.58rem;color:#e85555;font-weight:700;flex-shrink:0;transition:all 0.15s;" onmouseover="this.style.background='rgba(192,22,26,0.25)'" onmouseout="this.style.background='rgba(192,22,26,0.12)'">✕</button>
      </div>`;
  }).join('');
}

function adminBorrarMovEspec(id) {
  const mov = (D.movimientos || []).find(m => m.id === id);
  if (!mov) { toast('Movimiento no encontrado', 'err'); return; }
  const esRecibo = mov.fuente === 'recibo';
  const aviso = esRecibo ? '\n⚠ Este movimiento es de un recibo — solo se borra el cobro, no el PDF.' : '';
  const user = prompt('Usuario administrador:');
  if (!user) return;
  const pass = prompt('Contraseña:');
  if (!pass) return;
  const match = Array.isArray(ADMIN_USERS)
    ? ADMIN_USERS.find(a => a.usuario.toLowerCase() === (user||'').toLowerCase() && a.pass === pass)
    : (ADMIN_USERS[user] === pass ? true : null);
  if (!match) { toast('✗ Credenciales incorrectas', 'err'); return; }
  if (!confirm(`¿Borrar este movimiento?\n\n"${mov.descripcion||'—'}"\nFecha: ${mov.fecha||'—'} | $${mov.monto}${aviso}\n\nEsta acción no se puede deshacer.`)) return;

  // Marcar como tombstone SIN sacarlo del array (la fusión bidireccional necesita ver la lápida)
  const idxMov = D.movimientos.findIndex(m => m.id === id);
  if(idxMov < 0){ toast('Movimiento no encontrado', 'err'); return; }
  D.movimientos[idxMov].borrado = true;
  D.movimientos[idxMov].fechaBorrado = new Date().toISOString();
  D.movimientos[idxMov].borradoPor = (typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.email)
    ? empleadoActual.email
    : (match && match.usuario ? match.usuario : (user || 'admin'));

  guardarTodo()
    .then(function(){
      // 1. Quitar el tombstone del array definitivamente
      D.movimientos = D.movimientos.filter(m => m.id !== id);

      // ── PARCHE ANTI-DUPLICADO ─────────────────────────────────────────────────
      // Si el movimiento borrado era de un RECIBO (fuente:'recibo'), el recibo padre
      // sigue existiendo con anticipo>0. Sin este parche, getMovHoy() y getSaldo()
      // lo reintroducen como movimiento sintético R-{folio} causando el duplicado.
      // Solución: agregar el folio a D.recibosExcluidosCaja para que las funciones
      // de cálculo lo ignoren permanentemente.
      if (esRecibo && mov.folio != null) {
        if (!Array.isArray(D.recibosExcluidosCaja)) D.recibosExcluidosCaja = [];
        if (!D.recibosExcluidosCaja.includes(mov.folio)) {
          D.recibosExcluidosCaja.push(mov.folio);
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      // 2. Reordenar folios YA SIN el movimiento borrado y persistir
      _reordenarFoliosCaja();
    
      // 3. Sincronizar Drive con la exclusión guardada
      syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });

      // 4. Actualizar TODAS las vistas
      if(typeof renderCaja === 'function') renderCaja();
      if(typeof renderContab === 'function') renderContab();

      const q2 = (document.getElementById('adminBuscarMov')||{}).value || '';
      if(typeof adminRenderMovimientos === 'function') adminRenderMovimientos(q2);

      const movHoy2 = (D.movimientos || []).filter(m => m.fecha === hoy() && !m.borrado);
      const cntEl2 = document.getElementById('adminMovHoyCnt');
      if (cntEl2) cntEl2.textContent = movHoy2.length;

      toast('Movimiento eliminado ✓');
    })
    .catch(function(e){ console.warn('borrar mov espec:', e); toast('Error al eliminar en Drive','err'); });
}

function adminEditarMovEspec(id) {
  const mov = (D.movimientos || []).find(m => m.id === id);
  if (!mov) { toast('Movimiento no encontrado', 'err'); return; }
  // Verificar credenciales de administrador
  const user = prompt('Usuario administrador:');
  if (!user) return;
  const pass = prompt('Contraseña:');
  if (!pass) return;
  const match = Array.isArray(ADMIN_USERS)
    ? ADMIN_USERS.find(a => a.usuario === user && a.pass === pass)
    : (ADMIN_USERS[user] === pass ? true : null);
  if (!match) { toast('✗ Credenciales incorrectas', 'err'); return; }

  // Rellenar modal
  document.getElementById('adminEditMovId').value    = id;
  document.getElementById('adminEditMovDesc').value  = mov.descripcion || '';
  document.getElementById('adminEditMovFecha').value = mov.fecha || hoy();
  document.getElementById('adminEditMovHora').value  = mov.hora || hora();
  document.getElementById('adminEditMovMonto').value = mov.monto || 0;
  document.getElementById('adminEditMovTipo').value  = mov.tipo || 'ingreso';
  document.getElementById('adminEditMovCat').value   = mov.cat || 'otro';
  document.getElementById('adminEditMovResp').value  = (mov.responsable || empNombre()).toUpperCase();

  // Mostrar modal
  document.getElementById('adminBorrarEspecZone').classList.remove('show');
  document.getElementById('adminEditarMovZone').classList.add('show');
}

function adminVolverBorrar() {
  document.getElementById('adminEditarMovZone').classList.remove('show');
  document.getElementById('adminBorrarEspecZone').classList.add('show');
}

async function adminGuardarEdicionMov() {
  const id = document.getElementById('adminEditMovId').value;
  const idx = (D.movimientos || []).findIndex(m => m.id === id);
  if (idx < 0) { toast('Movimiento no encontrado', 'err'); return; }

  const monto = parseFloat(document.getElementById('adminEditMovMonto').value);
  if (isNaN(monto) || monto < 0) { toast('Monto inválido', 'err'); return; }

  const m = D.movimientos[idx];
  m.descripcion  = document.getElementById('adminEditMovDesc').value.trim() || m.descripcion;
  m.fecha        = document.getElementById('adminEditMovFecha').value || m.fecha;
  m.hora         = document.getElementById('adminEditMovHora').value || m.hora;
  m.monto        = monto;
  m.tipo         = document.getElementById('adminEditMovTipo').value;
  m.cat          = document.getElementById('adminEditMovCat').value;
  m.responsable  = document.getElementById('adminEditMovResp').value.trim() || m.responsable;

  save();
  renderCaja();
  renderContab();
  adminVolverBorrar();
  adminRenderMovimientos((document.getElementById('adminBuscarMov')||{}).value || '');

  // ── Sincronizar con Drive para que todos los dispositivos vean el cambio ──
  try {
    if (!sbSession || Date.now() >= sbExpiry) {
      if (typeof mostrarDriveOverlay === 'function') mostrarDriveOverlay('adminGuardarEdicionMov');
      toast('⚠️ Sesión de Drive expirada — reconecta y guarda de nuevo', 'err');
      return;
    }
    toast('⏳ Sincronizando con Drive…');
    await actualizarArchivoControl();
    toast('✅ Movimiento actualizado y sincronizado en Drive');
  } catch(e) {
    console.error('adminGuardarEdicionMov Drive sync error:', e);
    toast('⚠️ Local OK, pero falló Drive: ' + e.message, 'err');
  }
}

// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// MOVIMIENTOS HISTÓRICOS — Solo captura RETROACTIVA
// ══════════════════════════════════════════════════════════════════
function adminAbrirHistoricos() {
  document.getElementById('adminPanelZone').classList.remove('show');
  document.getElementById('adminHistoricosZone').classList.add('show');
  // Solo se conserva la captura RETROACTIVA — se inicializa directamente
  if(typeof adminRetroInicializar === 'function') adminRetroInicializar();
}
function adminVolverDesdeHistoricos() {
  document.getElementById('adminHistoricosZone').classList.remove('show');
  adminMostrarPanel();
}
// Stub no-op para compatibilidad con código antiguo que pueda seguir llamándola
function adminHistTab(tab) {
  if(tab === 'retro' && typeof adminRetroInicializar === 'function') adminRetroInicializar();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══ CAPTURA RETROACTIVA — integrada en Movs. Históricos (rueda dentada) ═══
function adminRetroInicializar(){
  var fechaHoy = (typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0]);
  var horaAhora = (typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5));
  var fEl = document.getElementById('rFecha');
  var hEl = document.getElementById('rHora');
  if(fEl && !fEl.value){ fEl.value = fechaHoy; fEl.max = fechaHoy; }
  if(fEl){ fEl.max = fechaHoy; }
  if(hEl && !hEl.value){ hEl.value = horaAhora; }
  window._adminRetroTipo = window._adminRetroTipo || 'ingreso';
  adminRetroSetTipo(window._adminRetroTipo);
}

function adminRetroSetTipo(tipo){
  var btnIng = document.getElementById('adminRetroBtnIng');
  var btnEgr = document.getElementById('adminRetroBtnEgr');
  window._adminRetroTipo = tipo;
  if(btnIng && btnEgr){
    if(tipo === 'ingreso'){
      btnIng.style.background = '#2a9a4a'; btnIng.style.color = '#fff';
      btnEgr.style.background = '#2a1208'; btnEgr.style.color = 'rgba(255,255,255,0.4)';
    } else {
      btnIng.style.background = '#1a4a2a'; btnIng.style.color = 'rgba(255,255,255,0.4)';
      btnEgr.style.background = '#c0161a'; btnEgr.style.color = '#fff';
    }
  }
}

function adminConfirmarRetro(){
  var fechaHoy = (typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0]);
  var fecha  = (document.getElementById('rFecha')  || {}).value || '';
  var hr     = (document.getElementById('rHora')   || {}).value || '';
  var desc   = ((document.getElementById('rDesc')  || {}).value || '').trim();
  var monto  = parseFloat((document.getElementById('rMonto') || {}).value) || 0;
  var motivo = ((document.getElementById('rMotivo')|| {}).value || '').trim();
  var tipo   = window._adminRetroTipo || 'ingreso';

  if(!fecha){ if(typeof toast==='function') toast('Elige una fecha','err'); else alert('Elige una fecha.'); return; }
  if(fecha > fechaHoy){ if(typeof toast==='function') toast('No se permiten fechas futuras','err'); else alert('No se permiten fechas futuras.'); return; }
  if(!hr){ if(typeof toast==='function') toast('Elige una hora','err'); else alert('Elige una hora.'); return; }
  if(!desc){ if(typeof toast==='function') toast('Escribe una descripción','err'); else alert('Escribe una descripción.'); return; }
  if(monto <= 0){ if(typeof toast==='function') toast('El monto debe ser mayor a cero','err'); else alert('El monto debe ser mayor a cero.'); return; }
  if(!motivo){
    if(!confirm('¿Capturar sin motivo? Para auditoría es recomendable escribir el motivo.')) return;
    motivo = '(sin motivo registrado)';
  }

  var icono = tipo === 'ingreso' ? '▲' : '▼';
  var resumen = icono + ' ' + tipo.toUpperCase() + ': $' + monto.toLocaleString('es-MX',{minimumFractionDigits:2}) + '\n'
    + 'Fecha: ' + fecha + ' ' + hr + '\n'
    + 'Desc: ' + desc + '\n\n¿Confirmar registro retroactivo?';
  if(!confirm(resumen)) return;

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
    responsable: (typeof empNombre === 'function' ? empNombre() : (typeof adminSesionUsuario !== 'undefined' ? adminSesionUsuario : 'Admin')),
    retroactivo: true,
    auditoria: {
      capturadoEn: new Date().toISOString(),
      fechaRealCaptura: fechaHoy,
      horaRealCaptura: (typeof hora === 'function' ? hora() : ''),
      usuario: (typeof empNombre === 'function' ? empNombre() : (typeof adminSesionUsuario !== 'undefined' ? adminSesionUsuario : 'Admin')),
      motivo: motivo
    }
  };

  _registrarMovimiento(mov);
  if(typeof save === 'function') save();
  if(typeof renderCaja === 'function') renderCaja();
  if(typeof renderContab === 'function') renderContab();
  setTimeout(()=>syncEstadoSupabaseDebounced(),100);

  // Limpiar formulario
  document.getElementById('rDesc').value = '';
  document.getElementById('rMonto').value = '';
  document.getElementById('rMotivo').value = '';
  window._adminRetroTipo = 'ingreso';
  adminRetroSetTipo('ingreso');

  if(typeof toast === 'function'){
    toast('✅ Movimiento retroactivo registrado: ' + fecha + ' ' + hr, 'ok');
  } else {
    alert('✅ Registrado: ' + fecha + ' ' + hr + ' — $' + monto);
  }
}
// ═══ FIN CAPTURA RETROACTIVA INTEGRADA ═══

// Cerrar modal al click fuera
document.getElementById('adminModalOv').addEventListener('click', function(e){
  if (e.target === this) cerrarAdminModal();
});

function adminTogglePass() {
  const input   = document.getElementById('adminPass');
  const chk     = document.getElementById('chkVerPass');
  const eyeOpen = document.getElementById('iconEyeOpen');
  const eyeOff  = document.getElementById('iconEyeOff');

  // Sincronizar: si se llamó desde el botón del ojo, también actualizar el checkbox
  const mostrar = input.type === 'password';
  input.type = mostrar ? 'text' : 'password';
  if (chk) chk.checked = mostrar;
  if (eyeOpen) eyeOpen.style.display = mostrar ? 'none' : '';
  if (eyeOff)  eyeOff.style.display  = mostrar ? ''     : 'none';
  input.focus();
}

// ── PUENTE DRIVE: iniciarDriveAuth() del recibo → iniciarAuth() del LEX ──
// El botón del sidebar (driveChipClick → iniciarAuth) es el único punto de entrada.
// Cuando el recibo llama iniciarDriveAuth(), redirigimos al LEX.
var _origIniciarDriveAuth = typeof iniciarDriveAuth === 'function' ? iniciarDriveAuth : null;
function rec_iniciarDriveAuth() {
  // Usar el flujo de auth del LEX (sidebar) en lugar del del index
  if (typeof iniciarAuth === 'function') {
    iniciarAuth();
  } else if (_origIniciarDriveAuth) {
    _origIniciarDriveAuth();
  }
}

// Sincronizar el badge del recibo con el estado del LEX
function _sincronizarDriveBadgeRecibo(conectado, nombre) {
  // Badge del recibo (drive-dot + drive-label dentro del panel-nuevo-recibo)
  var dot   = document.querySelector('#panel-nuevo-recibo .drive-dot, .drive-dot');
  var label = document.getElementById('driveLabel');
  if (dot) dot.className = 'drive-dot' + (conectado ? ' on' : ' err');
  if (label) label.textContent = conectado ? ('☁️ ' + (nombre||'Supabase ✓')) : 'Conectar Supabase';
  // También actualizar el badge principal del index si existe
  var badge = document.getElementById('drive-badge');
  if (badge) {
    var bdot = badge.querySelector('.drive-dot');
    var blbl = badge.querySelector('#drive-label, span:last-child');
    if (bdot) bdot.className = 'drive-dot' + (conectado ? ' connected' : ' error');
    if (blbl) blbl.textContent = conectado ? ('☁️ ' + (nombre||'Supabase ✓')) : 'Conectar Supabase';
  }
}

// AVISO: cuando se intenta movimiento sin Drive → modal del LEX
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

// ── Modal Drive desconectado para el LEX ──────────────────────────
function mostrarModalDriveDesconectado() {
  var el = document.getElementById('modal-drive-desconectado');
  if (el) el.classList.add('show');
}
function cerrarModalDriveDesconectado() {
  var el = document.getElementById('modal-drive-desconectado');
  if (el) el.classList.remove('show');
}

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

// ══════════════════════════════════════════════════════════════════
// ADMIN — GESTIÓN DE RECIBOS
// ══════════════════════════════════════════════════════════════════

function adminAbrirGestionRecibos() {
  document.getElementById('adminPanelZone').classList.remove('show');
  document.getElementById('adminGestionRecibosZone').classList.add('show');
  document.getElementById('adminBuscarRecibo').value = '';
  adminRenderRecibos('');
}

function adminFiltrarRecibos() {
  var q = document.getElementById('adminBuscarRecibo').value;
  adminRenderRecibos(q);
}

function adminRenderRecibos(q) {
  var lista = document.getElementById('adminReciboList');
  if (!lista) return;
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var qn = (q||'').toLowerCase().trim();
  var filtrados = recibos.filter(function(r) {
    if (!qn) return true;
    var folio = folioFormato(r.folio||0);
    var nombre = (r.nombre||'').toLowerCase();
    var fecha = (r.fecha||'').toLowerCase();
    return folio.includes(qn) || nombre.includes(qn) || fecha.includes(qn);
  });
  var cntEl = document.getElementById('adminRecCnt');
  if (cntEl) cntEl.textContent = recibos.length;
  if (!filtrados.length) {
    lista.innerHTML = '<div style="padding:16px;text-align:center;color:rgba(200,149,42,0.4);font-size:0.74rem;">Sin resultados</div>';
    return;
  }
  lista.innerHTML = filtrados.slice(0,30).map(function(r) {
    var idx = recibos.indexOf(r);
    var folio = '#' + folioFormato(r.folio||0);
    var estado = r.cancelado ? '🚫 Cancelado' : (r.saldoPendiente > 0 ? '⚠️ Pendiente' : '✅ Liquidado');
    var colorEst = r.cancelado ? '#888' : (r.saldoPendiente > 0 ? '#c8952a' : '#2a9a4a');
    return [
      '<div style="display:flex;align-items:center;justify-content:space-between;',
      'padding:8px 10px;border-bottom:1px solid rgba(200,149,42,0.1);gap:6px;">',
      '<div style="min-width:0;flex:1;">',
      '<div style="font-size:0.7rem;color:var(--gold-l);font-weight:700;letter-spacing:0.06em;">' + folio + '</div>',
      '<div style="font-size:0.72rem;color:rgba(200,149,42,0.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">' + (r.nombre||'—') + '</div>',
      '<div style="font-size:0.62rem;color:rgba(200,149,42,0.4);">' + (r.fecha||'') + ' &middot; <span style="color:' + colorEst + '">' + estado + '</span></div>',
      '</div>',
      '<div style="display:flex;gap:5px;flex-shrink:0;">',
      '<button onclick="adminAbrirEditarRecibo(' + idx + ')" ',
      'style="background:#1a4a8a;border:none;border-radius:4px;color:#fff;',
      'padding:5px 9px;cursor:pointer;font-size:0.65rem;white-space:nowrap;">',
      '✏️ Editar</button>',
      '<button onclick="adminAbrirCambiarFecha(' + idx + ')" ',
      'style="background:#5a3a8a;border:none;border-radius:4px;color:#fff;',
      'padding:5px 9px;cursor:pointer;font-size:0.65rem;white-space:nowrap;">',
      '📅 Fecha</button>',
      '<button onclick="adminEliminarRecibo(' + idx + ')" ',
      'style="background:#c0161a;border:none;border-radius:4px;color:#fff;',
      'padding:5px 9px;cursor:pointer;font-size:0.65rem;white-space:nowrap;">',
      '🗑 Eliminar</button>',
      (r.tipoTramite === 'vehicular' ? [
        '<button onclick="adminCrearPendientePlacas(' + idx + ')" ',
        'style="background:#1a6a3a;border:none;border-radius:4px;color:#fff;',
        'padding:5px 9px;cursor:pointer;font-size:0.65rem;white-space:nowrap;">',
        '🚗 Pendiente</button>'
      ].join('') : ''),
      '</div>',
      '</div>'
    ].join('');
  }).join('');
}

// ═════════════════════════════════════════════════════════════════
// MODAL #modal-eliminar-recibo — handlers para sus botones
// ─────────────────────────────────────────────────────────────────
// El modal está en el HTML pero ningún flujo actual lo invoca; estas
// funciones existen para evitar ReferenceError si el modal se llegara
// a disparar por algún camino legacy. Validan contra ADMIN_USERS y
// delegan en adminEliminarRecibo() que es el flujo real de borrado.
//
// Si quieres usar el modal explícitamente, llama:
//   _abrirModalEliminarRecibo(folioNumero)
// y los handlers harán el resto.
// ─────────────────────────────────────────────────────────────────

var _delRecFolioObjetivo = null;

function _abrirModalEliminarRecibo(folio){
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var idx = recibos.findIndex(function(r){ return r && r.folio === folio; });
  if(idx < 0){
    if(typeof toast === 'function') toast('Recibo #' + folioFormato(folio) + ' no encontrado','err');
    return;
  }
  var r = recibos[idx];
  _delRecFolioObjetivo = folio;
  var info = document.getElementById('del-rec-info');
  if(info){
    info.textContent = 'Folio #' + folioFormato(r.folio, r.anio_folio) +
                       ' · ' + (r.nombre || 'Sin nombre') +
                       (r.fecha ? ' · ' + r.fecha : '');
  }
  var u = document.getElementById('del-rec-user'); if(u) u.value = '';
  var p = document.getElementById('del-rec-pass'); if(p) p.value = '';
  var e = document.getElementById('del-rec-err'); if(e) e.textContent = '';
  var modal = document.getElementById('modal-eliminar-recibo');
  if(modal) modal.classList.add('show');
  setTimeout(function(){ if(u) u.focus(); }, 100);
}

function cerrarModalEliminarRecibo(){
  var modal = document.getElementById('modal-eliminar-recibo');
  if(modal) modal.classList.remove('show');
  _delRecFolioObjetivo = null;
  var u = document.getElementById('del-rec-user'); if(u) u.value = '';
  var p = document.getElementById('del-rec-pass'); if(p) p.value = '';
  var e = document.getElementById('del-rec-err'); if(e) e.textContent = '';
}

function confirmarEliminarRecibo(){
  var errEl = document.getElementById('del-rec-err');
  function showErr(msg){
    if(errEl) errEl.textContent = msg;
    else if(typeof toast === 'function') toast(msg, 'err');
  }

  // 1. Validar que haya recibo objetivo
  if(_delRecFolioObjetivo == null){
    showErr('No hay recibo seleccionado para eliminar. Cierra este modal.');
    return;
  }

  // 2. Validar credenciales contra ADMIN_USERS
  var u = (document.getElementById('del-rec-user') || {}).value || '';
  var p = (document.getElementById('del-rec-pass') || {}).value || '';
  u = u.trim();
  p = p.trim();
  if(!u || !p){ showErr('Ingresa usuario y contraseña.'); return; }

  if(typeof ADMIN_USERS === 'undefined' || !Array.isArray(ADMIN_USERS)){
    showErr('Sistema admin no disponible.'); return;
  }
  var match = ADMIN_USERS.find(function(a){ return a.usuario === u && a.pass === p; });
  if(!match){ showErr('Usuario o contraseña incorrectos.'); return; }

  // 3. Encontrar el índice del recibo y delegar a adminEliminarRecibo
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var idx = recibos.findIndex(function(r){ return r && r.folio === _delRecFolioObjetivo; });
  if(idx < 0){ showErr('El recibo ya no existe.'); return; }

  var folioCerrar = _delRecFolioObjetivo;
  cerrarModalEliminarRecibo();

  if(typeof adminEliminarRecibo === 'function'){
    adminEliminarRecibo(idx);
  } else {
    if(typeof toast === 'function') toast('Función de eliminación no disponible', 'err');
    console.error('[del-rec] adminEliminarRecibo no está definida');
  }
}

// ── Crear pendiente de placas manualmente desde un recibo existente ──
function adminCrearPendientePlacas(idx) {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) return;
  var folioStr = folioFormato(r.folio||0, r.anio_folio);

  if (r.tipoTramite !== 'vehicular') {
    if(typeof toast==='function') toast('Solo aplica para trámites vehiculares','err');
    return;
  }

  var idPend = 'PEND-REC-' + r.folio;
  var yaExiste = (D.pendientes||[]).some(function(p){ return p.id === idPend; });
  if (yaExiste) {
    if(typeof toast==='function') toast('Ya existe un pendiente para el folio #'+folioStr,'err');
    return;
  }

  var concepto0 = (r.conceptos && r.conceptos[0]) ? (r.conceptos[0].concepto||'') : '';
  var desc0     = (r.conceptos && r.conceptos[0]) ? (r.conceptos[0].descripcion||'') : '';
  var concDesc  = [concepto0, desc0].filter(Boolean).join(' — ');
  var tipoVeh = 'alta';
  var c0lower = concepto0.toLowerCase();
  if (c0lower.includes('reemplac'))                                tipoVeh = 'reemplacamiento';
  else if (c0lower.includes('baja'))                              tipoVeh = 'baja';
  else if (c0lower.includes('cambio')||c0lower.includes('propiet')) tipoVeh = 'cambio_propietario';
  else if (c0lower.includes('tarjeta')||c0lower.includes('circulac')) tipoVeh = 'tarjeta_circulacion';

  var tipoLbl = {
    'alta':'Alta de placas','baja':'Baja de placas',
    'cambio_propietario':'Cambio de propietario',
    'tarjeta_circulacion':'Tarjeta de circulación',
    'reemplacamiento':'Reemplacamiento'
  }[tipoVeh] || 'Trámite vehicular';

  var textoPend = concDesc || (tipoLbl + ' — ' + (r.nombre||'') + (r.placa ? ' ('+r.placa+')' : ''));

  var nuevoPend = {
    id: idPend,
    texto: textoPend,
    persona: r.nombre || '',
    categoria: 'Placas',
    seccion: 'placas',
    prioridad: 'normal',
    resp: r.responsable || (typeof empNombre==='function' ? empNombre() : ''),
    obs: '',
    fechaLimite: '',
    carpeta: '',
    resuelto: false,
    fechaCreacion: r.fecha_recibo || r.fecha || (typeof hoy==='function' ? hoy() : ''),
    fechaResolucion: '',
    placasEstado: r.origen || '',
    placasNumero: r.placa || '',
    tipoVehicular: tipoVeh,
    descripcionPlacas: textoPend,
    reciboVinculadoFolio: r.folio,
    vehMarca: r.marca || '',
    vehClase: r.clase || '',
    marca: r.marca || '',
    clase: r.clase || '',
    documentos: []
  };

  if (!Array.isArray(D.pendientes)) D.pendientes = [];
  D.pendientes.unshift(nuevoPend);

  _ultimoSyncPropio = Date.now();
  syncEstadoSupabase().catch(function(e){ registrarError('Promise catch vacio', e); });
  if(typeof renderPend==='function') renderPend();
  if(typeof badges==='function') badges();
  if(typeof toast==='function') toast('✅ Pendiente de placas creado para folio #'+folioStr, 'ok');
}

// También accesible desde consola
window.lexCrearPendientePlacas = adminCrearPendientePlacas;
async function adminEliminarRecibo(idx) {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) return;
  var folioStr = folioFormato(r.folio||0, r.anio_folio);
  var nombre = r.nombre || 'Sin nombre';

  if (!confirm('☢️ ELIMINAR RECIBO #' + folioStr + '\n\nCliente: ' + nombre + '\nFecha: ' + (r.fecha||'') + '\n\nSe eliminará de:\n• Recibos\n• Contabilidad y movimientos\n• Historial de pagos\n• PDF en Supabase Storage\n• Backups de localStorage\n\n⚠️ Esta acción NO se puede deshacer.')) return;

  // 1. Eliminar recibo del array
  recibos.splice(idx, 1);

  // 2. Restaurar folio si es el más reciente
  if ((typeof appData !== 'undefined') && (r.folio >= (appData.folioActual - 1))) {
    appData.folioActual = r.folio;
    if (typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
  }

  // 3. Eliminar TODOS los movimientos vinculados (por folio, por ID, por cualquier referencia)
  if (typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
    var folioNum = r.folio;
    D.movimientos = D.movimientos.filter(function(m) {
      if (!m) return false;
      var porFolioFuente = (m.fuente === 'recibo' && m.folio == folioNum);
      var porId = (m.id||'').includes('REC-'+folioNum) ||
                  (m.id||'').includes('M-REC-'+folioNum) ||
                  (m.id||'').includes('recibo-'+folioNum) ||
                  (m.id||'').includes('rec-'+folioNum) ||
                  (m.id||'').includes('-'+folioNum+'-');
      var porDescripcion = (m.descripcion||'').includes('#'+folioStr);
      return !(porFolioFuente || porId || porDescripcion);
    });
    if (!Array.isArray(D.recibosExcluidosCaja)) D.recibosExcluidosCaja = [];
    if (!D.recibosExcluidosCaja.includes(r.folio)) D.recibosExcluidosCaja.push(r.folio);
  }

  // 4. Eliminar historial de pagos del folio
  if (typeof appData !== 'undefined' && appData.historialPagos) {
    delete appData.historialPagos[r.folio];
  }

  // 5. Eliminar snapshots/versiones del recibo
  if (typeof D !== 'undefined' && Array.isArray(D.snapshotsRecibos)) {
    D.snapshotsRecibos = D.snapshotsRecibos.filter(function(s){ return s.folio !== r.folio; });
  }

  // 6. Sincronizar con REC — crítico: _recibosMap() lee de REC.recibos también
  if (typeof REC !== 'undefined') {
    REC.recibos = recibos.filter(function(rec){ return rec && rec.folio !== r.folio; });
    if (typeof appData !== 'undefined') REC.folioActual = appData.folioActual;
  }
  // Agregar a exclusiones para que _recibosMap() no genere movimiento sintético
  if (typeof D !== 'undefined') {
    if (!Array.isArray(D.recibosExcluidosCaja)) D.recibosExcluidosCaja = [];
    var _fs = String(r.folio);
    if (!D.recibosExcluidosCaja.map(String).includes(_fs)) D.recibosExcluidosCaja.push(_fs);
  }

  // 7. Eliminar PDF de Supabase Storage
  if (r.archivo && typeof borrarPDFdeDrive === 'function') {
    try { await borrarPDFdeDrive(r.archivo); } catch(e) { console.warn('PDF storage:', e); }
  }
  // También intentar por nombre construido
  try {
    var nombrePDF = 'Recibo_' + folioStr + '_' + (r.nombre||'').replace(/[^a-zA-Z0-9]/g,'_').substring(0,30) + '.pdf';
    await borrarPDFdeDrive(nombrePDF);
  } catch(e){ registrarError('catch vacio', e); }

  // 8. Limpiar backups de localStorage que contengan este recibo
  try {
    ['D','appData'].forEach(function(tipo) {
      var idxStr = localStorage.getItem('lex_backup_idx_' + tipo);
      if (!idxStr) return;
      var idxArr = JSON.parse(idxStr);
      idxArr.forEach(function(item) {
        try {
          var bk = JSON.parse(localStorage.getItem(item.clave)||'null');
          if (!bk || !bk.datos) return;
          // Limpiar recibos del backup
          if (Array.isArray(bk.datos.recibos)) {
            bk.datos.recibos = bk.datos.recibos.filter(function(rec){ return rec && rec.folio !== r.folio; });
          }
          // Limpiar movimientos del backup
          if (Array.isArray(bk.datos.movimientos)) {
            bk.datos.movimientos = bk.datos.movimientos.filter(function(m){
              return m && !(m.fuente==='recibo' && m.folio==r.folio);
            });
          }
          try{ localStorage.setItem(item.clave, JSON.stringify(bk)); } catch(e){ registrarError('localStorage.setItem', e); }
} catch(e2) {}
      });
    });
    console.log('[adminEliminarRecibo] Backups de localStorage limpiados');
  } catch(eLs) { console.warn('localStorage cleanup:', eLs); }

  // 9. Subir a Supabase — sync inmediato
  _ultimoSyncPropio = Date.now();
  try {
    await actualizarArchivoControl();
    await syncEstadoSupabase();
  } catch(e) { console.warn('sync eliminar:', e); }

  // 10. Refrescar UI
  var q = (document.getElementById('adminBuscarRecibo')||{}).value||'';
  adminRenderRecibos(q);
  if (typeof renderRec       === 'function') renderRec();
  if (typeof renderHistorial === 'function') renderHistorial();
  if (typeof renderCaja      === 'function') renderCaja();
  if (typeof renderContab    === 'function') renderContab();
  if (typeof badges          === 'function') badges();

  if (typeof toast === 'function') toast('✅ Recibo #' + folioStr + ' eliminado de todos lados — recibos, contabilidad, PDF y backups.', 'ok');
}

// ── CAMBIAR FECHA DE RECIBO v2 (con checkboxes individuales por movimiento) ──
function adminAbrirCambiarFecha(idx) {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) return;
  var folio = folioFormato(r.folio||0);
  var fechaActual = r.fecha || r.fecha_recibo || '';
  var horaActual = r.hora || r.hora_recibo || '';

  // Buscar movimientos vinculados a este recibo (cada uno con su propio ID)
  var movsVinculados = (D.movimientos||[]).filter(function(m){
    return m.folio === r.folio && (m.fuente === 'recibo' || (m.id||'').includes(String(r.folio)));
  });

  // Guardar globalmente para usar en confirmar
  window._cfRecIdx = idx;
  window._cfMovsVinculados = movsVinculados;

  var movsListHTML = '';
  if(movsVinculados.length){
    movsListHTML = ''
      + '<div style="background:rgba(90,58,138,0.15);border:1px solid #5a3a8a;padding:12px;border-radius:6px;margin-bottom:14px;">'
      + '<div style="font-size:0.82rem;color:#c8952a;font-weight:600;margin-bottom:8px;">'
      + '📎 Este recibo tiene ' + movsVinculados.length + ' movimiento(s) de caja vinculado(s):'
      + '</div>'
      + '<div style="font-size:0.72rem;color:rgba(232,212,168,0.8);margin-bottom:10px;line-height:1.4;">'
      + '⚠️ Cada movimiento es un evento contable independiente con su propia fecha real. '
      + 'Por defecto NO se mueven con el recibo. Marca solo los que también deban cambiar de fecha:'
      + '</div>';

    movsVinculados.forEach(function(m, i){
      var icono = m.tipo === 'ingreso' ? '🟢▲' : '🔴▼';
      var monto = (m.monto||0).toLocaleString();
      var desc = (m.descripcion||'').slice(0,55);
      var cat = m.cat || '';
      movsListHTML += ''
        + '<label style="display:flex;align-items:flex-start;gap:8px;padding:8px;background:rgba(0,0,0,0.3);border-radius:4px;margin-bottom:6px;cursor:pointer;">'
        + '<input type="checkbox" id="cfMov_' + i + '" data-mov-id="' + m.id + '" style="margin-top:3px;cursor:pointer;width:18px;height:18px;">'
        + '<div style="flex:1;font-size:0.74rem;line-height:1.4;">'
        + '<div><b>' + icono + ' $' + monto + '</b> · ' + cat + '</div>'
        + '<div style="color:rgba(200,149,42,0.7);">📅 ' + m.fecha + ' ' + (m.hora||'') + '</div>'
        + '<div style="color:rgba(232,212,168,0.6);font-size:0.7rem;">' + desc + '</div>'
        + '</div>'
        + '</label>';
    });

    movsListHTML += ''
      + '<div style="display:flex;gap:6px;margin-top:8px;">'
      + '<button onclick="adminCFMarcarTodos(true)" style="flex:1;padding:6px;background:#3a2a5a;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:0.72rem;">☑ Marcar todos</button>'
      + '<button onclick="adminCFMarcarTodos(false)" style="flex:1;padding:6px;background:#3a2a5a;border:none;border-radius:4px;color:#fff;cursor:pointer;font-size:0.72rem;">☐ Desmarcar todos</button>'
      + '</div>'
      + '</div>';
  }

  var modalHTML = ''
    + '<div id="modalCambiarFecha" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">'
    + '<div style="background:#1a1410;border:2px solid #5a3a8a;border-radius:12px;max-width:520px;width:100%;padding:24px;color:#e8d4a8;font-family:system-ui,sans-serif;max-height:90vh;overflow-y:auto;">'
    + '<h2 style="margin:0 0 12px 0;color:#c8952a;font-family:Fraunces,serif;">📅 Cambiar fecha — Recibo #' + folio + '</h2>'
    + '<div style="background:rgba(200,149,42,0.1);padding:10px;border-radius:6px;margin-bottom:14px;font-size:0.85rem;">'
    + '<b>Cliente:</b> ' + (r.nombre||'—') + '<br>'
    + '<b>Fecha actual del recibo:</b> ' + fechaActual + ' ' + horaActual
    + '</div>'

    + '<div style="margin-bottom:12px;">'
    + '<label style="display:block;font-size:0.8rem;color:#c8952a;margin-bottom:6px;font-weight:600;">Modo de cambio:</label>'
    + '<div style="display:flex;gap:8px;">'
    + '<button onclick="adminCFSetModo(\'simple\')" id="cfModoSimple" style="flex:1;padding:8px;background:#5a3a8a;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:0.78rem;">📆 Solo fecha (mantiene hora)</button>'
    + '<button onclick="adminCFSetModo(\'completo\')" id="cfModoCompleto" style="flex:1;padding:8px;background:#3a2a5a;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:0.78rem;">🕐 Fecha y hora</button>'
    + '</div>'
    + '</div>'

    + '<div style="margin-bottom:12px;">'
    + '<label style="display:block;font-size:0.8rem;color:#c8952a;margin-bottom:4px;">Nueva fecha del recibo:</label>'
    + '<input type="date" id="cfNuevaFecha" value="' + fechaActual + '" max="' + (typeof hoy==='function' ? hoy() : '') + '" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:1rem;">'
    + '<div style="font-size:0.7rem;color:rgba(200,149,42,0.6);margin-top:4px;">⚠️ No se permiten fechas futuras (solo retroactivas)</div>'
    + '</div>'

    + '<div id="cfHoraWrap" style="margin-bottom:12px;display:none;">'
    + '<label style="display:block;font-size:0.8rem;color:#c8952a;margin-bottom:4px;">Nueva hora del recibo:</label>'
    + '<input type="time" id="cfNuevaHora" value="' + horaActual + '" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:1rem;">'
    + '</div>'

    + movsListHTML

    + '<div style="margin-bottom:14px;">'
    + '<label style="display:block;font-size:0.8rem;color:#c8952a;margin-bottom:4px;">Motivo del cambio (auditoría):</label>'
    + '<input type="text" id="cfMotivo" placeholder="Ej: Recibo se generó en otra fecha por error" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:0.9rem;">'
    + '</div>'

    + '<div style="display:flex;gap:8px;">'
    + '<button onclick="document.getElementById(\'modalCambiarFecha\').remove()" style="flex:1;padding:12px;background:#444;border:none;border-radius:6px;color:#fff;cursor:pointer;">Cancelar</button>'
    + '<button onclick="adminConfirmarCambioFecha()" style="flex:2;padding:12px;background:#5a3a8a;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;">✅ Aplicar cambio</button>'
    + '</div>'

    + '</div>'
    + '</div>';

  var div = document.createElement('div');
  div.innerHTML = modalHTML;
  document.body.appendChild(div.firstChild);
  adminCFSetModo('simple');
}

function adminCFSetModo(modo){
  var simple = document.getElementById('cfModoSimple');
  var completo = document.getElementById('cfModoCompleto');
  var wrap = document.getElementById('cfHoraWrap');
  if(modo==='simple'){
    simple.style.background='#5a3a8a'; completo.style.background='#3a2a5a';
    wrap.style.display='none';
  } else {
    simple.style.background='#3a2a5a'; completo.style.background='#5a3a8a';
    wrap.style.display='block';
  }
  window._cfModo = modo;
}

function adminCFMarcarTodos(marcar){
  (window._cfMovsVinculados||[]).forEach(function(m, i){
    var cb = document.getElementById('cfMov_' + i);
    if(cb) cb.checked = marcar;
  });
}

function adminConfirmarCambioFecha(){
  var idx = window._cfRecIdx;
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) return;

  var nuevaFecha = document.getElementById('cfNuevaFecha').value;
  var nuevaHora = (window._cfModo === 'completo') ? document.getElementById('cfNuevaHora').value : (r.hora || r.hora_recibo || '');
  var motivo = document.getElementById('cfMotivo').value.trim();

  if(!nuevaFecha){ alert('Debes elegir una fecha.'); return; }
  if(nuevaFecha > (typeof hoy==='function' ? hoy() : '9999-12-31')){
    alert('No se permiten fechas futuras. Solo puedes mover a fechas pasadas o de hoy.');
    return;
  }
  if(!motivo){
    if(!confirm('¿Aplicar cambio sin motivo registrado? Es recomendable escribir el motivo para auditoría.')) return;
    motivo = '(sin motivo)';
  }

  var folio = folioFormato(r.folio||0);
  var fechaVieja = r.fecha || r.fecha_recibo || '';
  var horaVieja = r.hora || r.hora_recibo || '';

  // Identificar qué movimientos están marcados para mover
  var movsAMover = [];
  (window._cfMovsVinculados||[]).forEach(function(m, i){
    var cb = document.getElementById('cfMov_' + i);
    if(cb && cb.checked){
      movsAMover.push(m);
    }
  });

  if(fechaVieja === nuevaFecha && horaVieja === nuevaHora && movsAMover.length === 0){
    alert('La fecha y hora son las mismas y no se marcó ningún movimiento. No hay cambio que aplicar.');
    return;
  }

  // Construir resumen de confirmación
  var resumen = '¿Confirmar cambio?\n\n';
  resumen += 'Recibo #' + folio + ':\n';
  resumen += '  De: ' + fechaVieja + ' ' + horaVieja + '\n';
  resumen += '  A:  ' + nuevaFecha + ' ' + nuevaHora + '\n\n';
  if(movsAMover.length){
    resumen += 'Movimientos que también se moverán a esta fecha:\n';
    movsAMover.forEach(function(m){
      resumen += '  • ' + (m.descripcion||'').slice(0,40) + ' ($' + (m.monto||0).toLocaleString() + ')\n';
    });
  } else {
    resumen += 'Ningún movimiento de caja se moverá (todos quedan en su fecha original).';
  }

  if(!confirm(resumen)) return;

  // 1. Actualizar el recibo
  r.fecha = nuevaFecha;
  if(r.fecha_recibo !== undefined) r.fecha_recibo = nuevaFecha;
  if(window._cfModo === 'completo'){
    r.hora = nuevaHora;
    if(r.hora_recibo !== undefined) r.hora_recibo = nuevaHora;
  }

  // 2. Auditoría del recibo
  if(!r.historialCambios) r.historialCambios = [];
  r.historialCambios.push({
    tipo: 'cambio_fecha',
    fechaCambio: new Date().toISOString(),
    usuario: (typeof empNombre==='function' ? empNombre() : 'Admin'),
    fechaAnterior: fechaVieja,
    horaAnterior: horaVieja,
    fechaNueva: nuevaFecha,
    horaNueva: nuevaHora,
    motivo: motivo,
    modo: window._cfModo,
    movsMovidos: movsAMover.map(function(m){ return m.id; })
  });

  // 3. Actualizar SOLO los movimientos marcados
  var movsActualizados = 0;
  movsAMover.forEach(function(m){
    if(!m.historialCambios) m.historialCambios = [];
    m.historialCambios.push({
      tipo: 'cambio_fecha_por_recibo',
      fechaCambio: new Date().toISOString(),
      usuario: (typeof empNombre==='function' ? empNombre() : 'Admin'),
      fechaAnterior: m.fecha,
      horaAnterior: m.hora,
      fechaNueva: nuevaFecha,
      horaNueva: window._cfModo === 'completo' ? nuevaHora : m.hora,
      motivo: 'Movido junto con recibo #' + folio + ': ' + motivo
    });
    m.fecha = nuevaFecha;
    if(window._cfModo === 'completo') m.hora = nuevaHora;
    movsActualizados++;
  });

  // 4. Sincronizar appData ↔ REC
  if (typeof REC !== 'undefined') {
    REC.recibos = recibos;
  }

  // 5. Guardar
  if (typeof save === 'function') save();
  if (typeof actualizarArchivoControl === 'function') {
    actualizarArchivoControl().catch(function(e){ console.warn(e); });
  }
  if (movsActualizados > 0) { syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); }); }

  // 6. Refrescar UI
  document.getElementById('modalCambiarFecha').remove();
  adminRenderRecibos(document.getElementById('adminBuscarRecibo').value||'');
  if (typeof renderRec === 'function') renderRec();
  if (typeof renderCaja === 'function') renderCaja();
  if (typeof renderContab === 'function') renderContab();
  if (typeof renderHistorial === 'function') renderHistorial();

  if (typeof toast === 'function') {
    var msg = '✅ Recibo #' + folio + ' movido a ' + nuevaFecha;
    if(movsActualizados > 0) msg += ' (+' + movsActualizados + ' mov)';
    toast(msg, 'ok');
  } else {
    alert('Cambio aplicado.\nRecibo #' + folio + ' ahora en ' + nuevaFecha + '.\nMovimientos movidos: ' + movsActualizados);
  }
}

// ── EDITAR RECIBO ────────────────────────────────────────────────
function adminAbrirEditarRecibo(idx) {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) return;
  // Llenar campos
  document.getElementById('adminEditIdx').value = idx;
  document.getElementById('adminEditFolioLabel').textContent = '#' + folioFormato(r.folio||0);
  document.getElementById('adminEditNombre').value = r.nombre || '';
  document.getElementById('adminEditFecha').value = r.fecha || r.fecha_recibo || '';
  document.getElementById('adminEditHora').value = r.hora || r.hora_recibo || '';
  // Total: sumar conceptos si no hay campo total
  var total = 0;
  if (r.conceptos && r.conceptos.length) {
    r.conceptos.forEach(function(c){ total += parseFloat(c.precio||0) * parseFloat(c.cantidad||1); });
    if (r.costosExtra) r.costosExtra.forEach(function(ce){ total += parseFloat(ce.monto||0); });
  }
  document.getElementById('adminEditTotal').value = total || '';
  document.getElementById('adminEditAnticipo').value = r.anticipo || '';
  document.getElementById('adminEditTramites').value = r.tramites || '';
  document.getElementById('adminEditResponsable').value = (r.responsable || r.generadoPor || 'LIC ANTONIETA CHAVEZ MONTAR').toUpperCase();
  adminEditRecalcSaldo();
  // Mostrar zona de edición
  document.getElementById('adminGestionRecibosZone').classList.remove('show');
  document.getElementById('adminEditarReciboZone').classList.add('show');
}

function adminEditRecalcSaldo() {
  var total = parseFloat(document.getElementById('adminEditTotal').value) || 0;
  var anticipo = parseFloat(document.getElementById('adminEditAnticipo').value) || 0;
  var saldo = Math.max(0, total - anticipo);
  var el = document.getElementById('adminEditSaldoVal');
  var wrap = document.getElementById('adminEditSaldoWrap');
  if (el) el.textContent = '$' + saldo.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
  if (wrap) wrap.style.borderColor = saldo > 0 ? 'rgba(192,22,26,0.3)' : 'rgba(26,122,58,0.3)';
  if (wrap) wrap.style.background = saldo > 0 ? 'rgba(192,22,26,0.08)' : 'rgba(26,122,58,0.07)';
  var lbl = wrap ? wrap.querySelector('span:first-child') : null;
  if (lbl) { lbl.textContent = saldo > 0 ? 'SALDO PENDIENTE' : '✅ LIQUIDADO'; lbl.style.color = saldo > 0 ? 'rgba(192,22,26,0.7)' : 'rgba(26,122,58,0.7)'; }
  if (el) el.style.color = saldo > 0 ? '#c0161a' : '#1a9a4a';
}

// ═══ EDICIÓN COMPLETA DE RECIBO (abre formulario desbloqueado) ═══════════════

let _reciboEnEdicionCompleta = null; // índice en appData.recibos del recibo que se está editando

function adminAbrirEdicionCompleta() {
  var idx = parseInt(document.getElementById('adminEditIdx').value);
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) { if (typeof toast === 'function') toast('Error: recibo no encontrado', 'err'); return; }

  // Cerrar el modal de administrador
  if (typeof cerrarAdminModal === 'function') cerrarAdminModal();

  // Guardar referencia al recibo que se va a editar (por folio, más seguro que por índice)
  _reciboEnEdicionCompleta = r.folio;

  // Función interna que carga el formulario
  function _cargarFormEdicion() {
    // 1. Quitar TODAS las clases de modo
    ['modo-actualizacion','recibo-frozen','desde-liquidacion','actualizacion-impresa',
     'modo-consulta','folio-liquidado','folio-cancelado','modo-edicion-completa',
     'paneles-busqueda-abiertos']
      .forEach(function(cl){ document.body.classList.remove(cl); });

    // 2. Cerrar panel de búsqueda
    _panelesBusquedaAbiertos = false;
    var cuerpo = document.getElementById('paneles-busqueda-cuerpo');
    if (cuerpo) cuerpo.setAttribute('style','display:none;padding:0 20px 14px;');

    // 3. Mostrar recibo-body explícitamente
    var rb = document.getElementById('recibo-body');
    if (rb) { rb.style.cssText = ''; rb.style.removeProperty('display'); }

    // 4. Navegar al panel de recibos
    if (typeof mostrarPanel === 'function') mostrarPanel('nuevo-recibo');
    else {
      document.querySelectorAll('.panel').forEach(function(p){ p.style.display='none'; });
      var pnl = document.getElementById('panel-nuevo-recibo');
      if (pnl) pnl.style.display = '';
    }

    // 5. Cargar datos en el formulario
    if (typeof cargarReciboEnFormulario === 'function') cargarReciboEnFormulario(r);

    // 6. Fijar folio
    var fd = document.getElementById('folio-display');
    if (fd) fd.textContent = folioFormato(r.folio, r.anio_folio);

    // 7. Activar modo edición completa DESPUÉS de cargar
    document.body.classList.add('modo-edicion-completa');

    // 8. Actualizar banner
    var lbl = document.getElementById('edicion-folio-label');
    if (lbl) lbl.textContent = '#' + folioFormato(r.folio, r.anio_folio);

    // 9. Ocultar botón guardar normal
    var btnG = document.getElementById('btn-guardar');
    if (btnG) btnG.style.display = 'none';

    if (typeof toast === 'function')
      toast('✏️ Edición completa · Folio #' + folioFormato(r.folio, r.anio_folio) + ' · Edita y guarda');
  }

  // Ejecutar con pequeño delay para que el DOM del modal se cierre primero
  setTimeout(_cargarFormEdicion, 300);
}

function cancelarEdicionCompleta() {
  if (!confirm('¿Cancelar la edición? Los cambios no se guardarán.')) return;
  _reciboEnEdicionCompleta = null;
  ['modo-edicion-completa'].forEach(function(c){ document.body.classList.remove(c); });
  var btnG = document.getElementById('btn-guardar');
  if (btnG) btnG.style.display = '';
  if (typeof limpiarFormCompleto === 'function') limpiarFormCompleto();
  if (typeof toast === 'function') toast('Edición cancelada');
}

async function guardarEdicionCompleta() {
  if (_reciboEnEdicionCompleta === null) {
    if (typeof toast === 'function') toast('Error: no hay recibo en edición', 'err'); return;
  }
  if (!sbSession || Date.now() >= sbExpiry) {
    if (typeof mostrarDriveOverlay === 'function') mostrarDriveOverlay('guardarEdicionCompleta');
    return;
  }

  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var idx = recibos.findIndex(function(r){ return r.folio === _reciboEnEdicionCompleta; });
  if (idx < 0) { if (typeof toast === 'function') toast('Error: recibo no encontrado en memoria', 'err'); return; }
  var r = recibos[idx];

  // Recoger datos del formulario igual que guardarRecibo() pero SIN reservar nuevo folio
  var clientes = typeof getClientes === 'function' ? getClientes() : [];
  if (!clientes.length || !clientes[0].nombre) {
    if (typeof setStatus === 'function') setStatus('err','Ingresa el nombre del cliente','err'); return;
  }
  var conceptos  = typeof getConceptos === 'function' ? getConceptos() : [];
  var anticipo   = typeof parsePrecio  === 'function' ? parsePrecio(document.getElementById('anticipo').value) : 0;
  var total      = conceptos.reduce(function(s,c){ return s + (parseFloat(c.precio)||0); }, 0);
  var saldo      = Math.max(0, total - anticipo);
  var primerNombre = clientes[0].nombre;

  var camposSimples = ['tramites','clase','marca','serie','motor','anio','puertas',
    'color_veh','transmision','cilindros','placa','ultima_tenencia','origen','combustible'];
  var datosVeh = {};
  camposSimples.forEach(function(fid){
    var el = document.getElementById(fid);
    if (el) datosVeh[fid] = el.value;
  });

  var tipoTramite = (document.getElementById('tipo-tramite-select') || {}).value || r.tipoTramite || '';
  var tipo_doc    = (document.getElementById('tipo_doc') || {}).value || r.tipo_doc || 'copia';
  var responsable = (document.getElementById('responsable') || {}).value || r.responsable || '';
  var fechaRecibo = (document.getElementById('fecha_recibo') || {}).value || r.fecha_recibo || '';
  var horaRecibo  = (document.getElementById('hora_recibo')  || {}).value || r.hora_recibo  || '';
  var nombreFirma = (document.getElementById('nombre_cliente_firma') || {}).value || primerNombre;

  // Copias/documentos
  var copiasParsed = [];
  try {
    var datos = typeof getDatosFormulario === 'function' ? getDatosFormulario() : {};
    copiasParsed = typeof datos.copias === 'string' ? JSON.parse(datos.copias||'{}').docs||[] : (datos.copias||[]);
  } catch(e){ registrarError('catch vacio', e); }

  // Guardar snapshot ANTES de mutar
  if (typeof _guardarSnapshotRecibo === 'function')
    _guardarSnapshotRecibo(r, 'Antes de edición completa');

  // Actualizar el objeto del recibo — el folio NO cambia
  r.nombre               = primerNombre;
  r.clientes             = clientes;
  r.conceptos            = conceptos;
  r.total                = total;
  r.anticipo             = String(anticipo);
  r.saldoPendiente       = saldo;
  r.fecha                = fechaRecibo;
  r.fecha_recibo         = fechaRecibo;
  r.hora                 = horaRecibo;
  r.hora_recibo          = horaRecibo;
  r.tipoTramite          = tipoTramite;
  r.tipo_doc             = tipo_doc;
  r.copias               = copiasParsed;
  r.responsable          = responsable;
  r.generadoPor          = responsable;
  r.nombre_cliente_firma = nombreFirma;
  Object.assign(r, datosVeh);
  r.pdfBase64            = null; // forzar regeneración

  // Actualizar arrays en memoria
  if (typeof REC !== 'undefined') { REC.recibos = recibos; }
  if (typeof appData !== 'undefined') appData.recibos = recibos;

  var folioStr = folioFormato(r.folio, r.anio_folio);
  var btn = document.getElementById('btn-guardar-edicion-completa');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

  if (typeof setStatus === 'function') setStatus('loading','Guardando edición del Folio #'+folioStr+'…','loading');

  try {
    // Generar nuevo PDF con los datos editados
    var nombreArchivo = 'Recibo_' + folioStr + '_' + primerNombre.replace(/[^a-zA-Z0-9]/g,'_').substring(0,30) + '.pdf';

    // Usar jsPDF igual que guardarRecibo para regenerar el PDF
    var pdfBase64 = null;
    if (typeof generarPDFRecibo === 'function') {
      pdfBase64 = await generarPDFRecibo(r);
    } else if (typeof window.jspdf !== 'undefined' || typeof jspdf !== 'undefined') {
      // Intentar generar con el formulario actual (igual que guardarRecibo)
      // Si no hay función dedicada, marcar como pendiente de regeneración
      pdfBase64 = null;
    }

    if (pdfBase64) {
      r.pdfBase64  = pdfBase64;
      r.archivo    = nombreArchivo;
    }

    // Guardar JSON en Drive
    await actualizarArchivoControl();

    // Borrar PDF viejo de Drive para forzar subida del nuevo
    if (r.archivo && typeof borrarPDFdeDrive === 'function') {
      try { await borrarPDFdeDrive(r.archivo); } catch(e){ registrarError('catch vacio', e); }
    }

    // Si tenemos pdfBase64, subir a Drive
    if (pdfBase64 && typeof subirPDFaDrive === 'function') {
      try { await subirPDFaDrive(nombreArchivo, pdfBase64); } catch(e){ registrarError('catch vacio', e); }
    }

    if (typeof save === 'function') save();

    // ── Actualizar movimiento en contabilidad si existe, o crearlo ──
    if (typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
      const idMov = 'M-REC-' + r.folio;
      const idxMov = D.movimientos.findIndex(function(m){ return m.id === idMov || m.folio === r.folio; });
      const conceptos2 = r.conceptos || [];
      const c0 = conceptos2[0];
      const conc = c0 ? (c0.concepto||'') : '';
      const desc = c0 ? (c0.descripcion||'') : '';
      const txtConc = conc + (desc ? ' — ' + desc : '');
      const movDesc = 'Recibo #' + folioStr + ' · ' + primerNombre + (txtConc ? ' · ' + txtConc : '');
      if (idxMov >= 0) {
        // Actualizar movimiento existente
        D.movimientos[idxMov].nombre      = primerNombre;
        D.movimientos[idxMov].descripcion = movDesc;
        D.movimientos[idxMov].fecha       = fechaRecibo;
        D.movimientos[idxMov].monto       = anticipo || total;
        D.movimientos[idxMov].responsable = responsable;
      } else if (anticipo > 0 || total > 0) {
        // Crear movimiento si no existía
        D.movimientos.unshift({
          id:          idMov,
          folioCaja:   '',
          fecha:       fechaRecibo,
          hora:        horaRecibo,
          descripcion: movDesc,
          nombre:      primerNombre,
          folio:       r.folio,
          monto:       anticipo || total,
          tipo:        'ingreso',
          cat:         'Anticipo · #' + folioStr,
          estatus:     anticipo < total ? 'Anticipo' : 'Liquidado',
          fuente:      'recibo',
          responsable: responsable
        });
      }
    }

    // ── Sincronizar a Supabase y notificar a otros usuarios ──
    try { await syncEstadoSupabase(); } catch(e) { console.warn('sync error:', e); }

    if (typeof renderHistorial === 'function') renderHistorial();
    if (typeof renderRec === 'function') renderRec();
    if (typeof renderCaja === 'function') renderCaja();
    if (typeof renderContab === 'function') renderContab();
    if (typeof badges === 'function') badges();

    if (typeof toast === 'function')
      toast('✅ Recibo #' + folioStr + ' editado y guardado en Drive. El PDF se regenerará al consultarlo.');
    if (typeof setStatus === 'function')
      setStatus('ok','Recibo #'+folioStr+' actualizado correctamente','ok');

    // Salir del modo edición
    _reciboEnEdicionCompleta = null;
    ['modo-edicion-completa'].forEach(function(c){ document.body.classList.remove(c); });
    var btnG = document.getElementById('btn-guardar');
    if (btnG) btnG.style.display = '';
    if (typeof limpiarFormCompleto === 'function') limpiarFormCompleto();

  } catch(e) {
    console.error('guardarEdicionCompleta error:', e);
    if (typeof toast === 'function') toast('❌ Error al guardar: ' + e.message, 'err');
    if (typeof setStatus === 'function') setStatus('err','Error al guardar edición','err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar Edición y Regenerar PDF'; }
  }
}

function adminVolverGestion() {
  document.getElementById('adminEditarReciboZone').classList.remove('show');
  document.getElementById('adminGestionRecibosZone').classList.add('show');
}

async function adminGuardarEdicionRecibo() {
  var idx = parseInt(document.getElementById('adminEditIdx').value);
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) { if (typeof toast === 'function') toast('Error: recibo no encontrado','err'); return; }

  var nuevoNombre   = document.getElementById('adminEditNombre').value.trim();
  var nuevaFecha    = document.getElementById('adminEditFecha').value.trim();
  var nuevaHora     = document.getElementById('adminEditHora').value.trim();
  var nuevoAnticipo = parseFloat(document.getElementById('adminEditAnticipo').value) || 0;
  var nuevoTotal    = parseFloat(document.getElementById('adminEditTotal').value) || 0;
  var nuevoTramites = document.getElementById('adminEditTramites').value.trim();
  var nuevoResp     = document.getElementById('adminEditResponsable').value;

  if (!nuevoNombre) { if (typeof toast === 'function') toast('El nombre no puede estar vacío','err'); return; }

  var btnGuardar = document.querySelector('#adminEditarReciboZone button[onclick="adminGuardarEdicionRecibo()"]');
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = '⏳ Guardando...'; }

  // Aplicar cambios al objeto
  r.nombre               = nuevoNombre;
  r.fecha                = nuevaFecha;
  r.fecha_recibo         = nuevaFecha;
  r.hora                 = nuevaHora;
  r.hora_recibo          = nuevaHora;
  r.anticipo             = String(nuevoAnticipo);
  r.tramites             = nuevoTramites;
  r.responsable          = nuevoResp;
  r.generadoPor          = nuevoResp;
  r.total                = nuevoTotal;
  r.saldoPendiente       = Math.max(0, nuevoTotal - nuevoAnticipo);
  if (r.clientes && r.clientes.length > 0) r.clientes[0].nombre = nuevoNombre;
  r.nombre_cliente_firma = nuevoNombre;
  r.pdfBase64            = null; // invalidar cache local

  // Sincronizar arrays en memoria
  if (typeof REC !== 'undefined') { REC.recibos = recibos; REC.folioActual = appData.folioActual; }
  if (typeof appData !== 'undefined') appData.recibos = recibos;

  toast('Guardando en Supabase…');

  try {
    // 1. Guardar JSON actualizado en Drive — BLOQUEANTE
    await actualizarArchivoControl();

    // 2. Borrar PDF de Drive para que se regenere fresco al consultar
    var nombrePDF = r.archivo || ('Recibo_' + folioFormato(r.folio, r.anio_folio) + '_' + (r.nombre||'').replace(/[^a-zA-Z0-9]/g,'_').substring(0,30) + '.pdf');
    await borrarPDFdeDrive(nombrePDF);

    // 3. Refrescar vistas
    if (typeof renderRec === 'function') renderRec();
    if (typeof renderHistorial === 'function') renderHistorial();
    if (typeof renderContab === 'function') renderContab();
    if (typeof renderCaja === 'function') renderCaja();
    if (typeof save === 'function') save();

    var folio = folioFormato(r.folio||0);
    toast('✅ Recibo #' + folio + ' actualizado. El PDF se regenerará al consultarlo.');
    adminVolverGestion();
    adminRenderRecibos(document.getElementById('adminBuscarRecibo').value||'');

  } catch(e) {
    console.error('adminGuardarEdicionRecibo error:', e);
    toast('❌ Error al guardar: ' + e.message, 'err');
  } finally {
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = '💾 Guardar Cambios'; }
  }
}

// Borrar PDF de Storage por nombre — para forzar regeneración desde JSON al consultar
async function borrarPDFdeDrive(nombreArchivo) {
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  try {
    const path = window.SB_DESPACHO_ID + '/recibos/' + nombreArchivo;
    await window.SB.storage.from(STORAGE_BUCKET).remove([path]);
  } catch(e) { console.warn('borrarPDF:', e); }
}
// Movimientos en ceros (dinero retirado) — solo consulta
// ══════════════════════════════════════════════════════════════════

const HISTORIAL_FILE = 'contabilidad_historial_2026.json';
let historialFileId = HISTORIAL_FILE;
let historialData = null;

async function cargarHistorialContabilidad() {
  // Versión Supabase: descargar el JSON desde el bucket si existe
  if(!window.SB || !window.SB_DESPACHO_ID) return null;
  try {
    const path = window.SB_DESPACHO_ID + '/historial/' + HISTORIAL_FILE;
    const { data: blob, error } = await window.SB.storage.from(STORAGE_BUCKET).download(path);
    if(error || !blob){
      if(typeof toast === 'function') toast('Archivo historial_2026.json no encontrado','err');
      return null;
    }
    const text = await blob.text();
    historialData = JSON.parse(text);
    return historialData;
  } catch(e) {
    console.error('Error cargando historial:', e);
    if(typeof toast === 'function') toast('Error al cargar historial','err');
    return null;
  }
}

function _buildHistorialHTML() {
  var h = '';
  h += '<div class="modal" style="max-width:700px;width:95vw;max-height:85vh;display:flex;flex-direction:column;">';
  h += '<div class="modal-hdr" style="flex-shrink:0;">';
  h += '<h3 style="font-size:1rem;">📊 Historial Contabilidad 2026</h3>';
  h += '<button class="modal-x" id="hist-close-btn">✕</button>';
  h += '</div>';
  h += '<div id="hist-resumen" style="padding:10px 16px;background:rgba(200,149,42,0.06);border-bottom:1px solid var(--border-l);font-size:0.73rem;flex-shrink:0;"></div>';
  h += '<div style="padding:8px 16px;border-bottom:1px solid var(--border-l);flex-shrink:0;display:flex;gap:8px;align-items:center;">';
  h += '<input type="text" id="hist-buscar" placeholder="🔍 Buscar..." oninput="renderHistorial2026()" style="flex:1;background:rgba(200,149,42,0.05);border:1px solid var(--border-l);border-radius:4px;padding:6px 10px;color:var(--gold-l);font-size:0.74rem;">';
  h += '<select id="hist-tipo" onchange="renderHistorial2026()" style="background:var(--surface);border:1px solid var(--border-l);border-radius:4px;padding:6px;color:var(--gold-l);font-size:0.73rem;">';
  h += '<option value="">Todos</option><option value="ingreso">Ingresos</option><option value="egreso">Egresos</option>';
  h += '</select>';
  h += '<select id="hist-mes" onchange="renderHistorial2026()" style="background:var(--surface);border:1px solid var(--border-l);border-radius:4px;padding:6px;color:var(--gold-l);font-size:0.73rem;">';
  h += '<option value="">Todos los meses</option>';
  h += '<option value="2026-01">Enero</option><option value="2026-02">Febrero</option>';
  h += '<option value="2026-03">Marzo</option><option value="2026-04">Abril</option>';
  h += '<option value="2026-05">Mayo</option>';
  h += '</select></div>';
  h += '<div id="hist-lista" style="overflow-y:auto;flex:1;padding:8px 0;"></div>';
  h += '<div style="padding:10px 16px;border-top:1px solid var(--border-l);text-align:center;font-size:0.65rem;color:var(--muted);flex-shrink:0;">';
  h += '⚠ Saldo en ceros — dinero ya retirado · Solo consulta histórica';
  h += '</div></div>';
  return h;
}

function abrirHistorialContabilidad() {
  // Verificar sesión Supabase
  if (!sbSession || Date.now() >= sbExpiry) {
    mostrarModalDriveDesconectado();
    return;
  }
  // ── CONTRASEÑA ──────────────────────────────────────────────────
  pedirClaveHistorial(function() { _abrirHistorialReal(); });
}

function pedirClaveHistorial(onOk) {
  // Verificar sesión actual — solo el titular puede ver el historial
  var emailActual = empleadoActual ? empleadoActual.email : null;
  var esEmpleado  = emailActual && EMPLEADOS[emailActual];

  if (esEmpleado) {
    // Es un empleado registrado (no el titular) — acceso denegado
    var nombre = EMPLEADOS[emailActual] || emailActual;
    var ov = document.getElementById('hist-denegado-ov');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'hist-denegado-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
      document.body.appendChild(ov);
    }
    ov.innerHTML = `
      <div style="background:var(--surface,#fdfaf4);border-radius:12px;padding:32px 28px;min-width:300px;max-width:340px;text-align:center;">
        <div style="font-size:2rem;margin-bottom:8px;">🚫</div>
        <div style="font-family:serif;font-size:1rem;font-weight:700;color:#c0161a;margin-bottom:6px;">Acceso Denegado</div>
        <div style="font-size:0.76rem;color:var(--muted,#888);margin-bottom:6px;">Sesión activa: <strong style="color:var(--ink,#1a1209);">${nombre}</strong></div>
        <div style="font-size:0.73rem;color:var(--muted,#888);margin-bottom:20px;">El historial de contabilidad es exclusivo del titular del despacho.</div>
        <button onclick="document.getElementById('hist-denegado-ov').style.display='none'"
          style="padding:8px 24px;border:1px solid var(--border-l,#d4b87a);border-radius:6px;background:transparent;color:var(--muted,#888);cursor:pointer;font-size:0.8rem;">Cerrar</button>
      </div>`;
    ov.style.display = 'flex';
    return;
  }

  // Es el titular (cualquier cuenta no listada en EMPLEADOS) — acceso directo
  onOk();
}

function _abrirHistorialReal() {
  // Crear o mostrar panel historial
  var panel = document.getElementById('panel-historial-2026');
  if (!panel) {
    // Crear panel flotante
    panel = document.createElement('div');
    panel.id = 'panel-historial-2026';
    panel.className = 'modal-ov';
    panel.innerHTML = _buildHistorialHTML();
      document.body.appendChild(panel);
  document.getElementById('hist-close-btn').addEventListener('click', function(){
    document.getElementById('panel-historial-2026').classList.remove('show');
  });
  }

  panel.classList.add('show');

  // Cargar datos si no están en memoria
  if (!historialData) {
    document.getElementById('hist-lista').innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);">⏳ Cargando historial...</div>';
    cargarHistorialContabilidad().then(function(d) {
      if (d) renderHistorial2026();
      else document.getElementById('hist-lista').innerHTML = '<div style="padding:20px;text-align:center;color:#c0161a;">Error al cargar. Verifica que el archivo esté en Drive.</div>';
    });
  } else {
    renderHistorial2026();
  }
}

function renderHistorial2026() {
  if (!historialData || !historialData.movimientos) return;
  var movs = historialData.movimientos;
  var buscar = (document.getElementById('hist-buscar')||{}).value || '';
  var tipo   = (document.getElementById('hist-tipo')||{}).value || '';
  var mes    = (document.getElementById('hist-mes')||{}).value || '';
  var qn = buscar.toLowerCase().trim();

  var filtrados = movs.filter(function(m) {
    if (tipo && m.tipo !== tipo) return false;
    if (mes && !m.fecha.startsWith(mes)) return false;
    if (qn && !(m.descripcion||'').toLowerCase().includes(qn)
           && !(m.cat||'').toLowerCase().includes(qn)
           && !(m.folio||'').toLowerCase().includes(qn)) return false;
    return true;
  });

  var totalI = filtrados.filter(function(m){return m.tipo==='ingreso';}).reduce(function(a,m){return a+m.monto;},0);
  var totalE = filtrados.filter(function(m){return m.tipo==='egreso';}).reduce(function(a,m){return a+m.monto;},0);

  var res = document.getElementById('hist-resumen');
  if (res) res.innerHTML = [
    '<span style="color:#2a9a4a;font-weight:700;">▲ $'+totalI.toLocaleString('es-MX')+'</span>',
    '&nbsp;&nbsp;',
    '<span style="color:#c0161a;font-weight:700;">▼ $'+totalE.toLocaleString('es-MX')+'</span>',
    '&nbsp;&nbsp;',
    '<span style="color:var(--gold-l);">Utilidad: $'+(totalI-totalE).toLocaleString('es-MX')+'</span>',
    '&nbsp;&nbsp;|&nbsp;&nbsp;',
    '<span style="color:var(--muted);">'+filtrados.length+' de '+movs.length+' movs</span>',
    '&nbsp;&nbsp;',
    '<span style="background:rgba(200,149,42,0.15);padding:2px 8px;border-radius:3px;font-size:0.65rem;color:var(--gold-d);">SALDO CAJA: $0</span>',
  ].join('');

  var lista = document.getElementById('hist-lista');
  if (!filtrados.length) {
    lista.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:0.74rem;">Sin resultados</div>';
    return;
  }

  lista.innerHTML = filtrados.map(function(m) {
    var esI = m.tipo === 'ingreso';
    var color = esI ? '#2a9a4a' : '#c0161a';
    var signo = esI ? '+' : '-';
    return [
      '<div style="display:flex;align-items:center;padding:7px 16px;border-bottom:1px solid rgba(200,149,42,0.06);gap:10px;">',
      '<div style="min-width:82px;font-size:0.65rem;color:var(--muted);">'+m.fecha+'</div>',
      '<div style="flex:1;min-width:0;">',
      '<div style="font-size:0.74rem;color:var(--gold-l);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+m.descripcion+'</div>',
      '<div style="font-size:0.62rem;color:var(--muted);">'+m.cat+(m.folio?' · Folio '+m.folio:'')+'</div>',
      '</div>',
      '<div style="font-size:0.76rem;font-weight:700;color:'+color+';flex-shrink:0;">',
      signo+'$'+m.monto.toLocaleString('es-MX'),
      '</div>',
      '</div>',
    ].join('');
  }).join('');
}

// ─── VISTA PREVIA RECIBO ────────────────────────────────────────
function verVistaPrevia(idx) {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : (REC.recibos || []);
  var r = recibos[idx];
  if (!r) return;
  if (r.pdfBase64) {
    var modal = document.getElementById('modal-vista-previa-recibo');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-vista-previa-recibo';
      modal.className = 'modal-ov';
      var h = '<div class="modal" style="max-width:900px;width:96vw;max-height:92vh;display:flex;flex-direction:column;">';
      h += '<div class="modal-hdr" style="flex-shrink:0;">';
      h += '<h3 id="vp-titulo" style="font-size:0.9rem;"></h3>';
      h += '<button class="modal-x" onclick="document.getElementById(\"modal-vista-previa-recibo\").classList.remove(\"show\")">&#10005;</button>';
      h += '</div>';
      h += '<iframe id="vp-iframe" style="flex:1;border:none;min-height:70vh;" src=""></iframe>';
      h += '</div>';
      modal.innerHTML = h;
      document.body.appendChild(modal);
    }
    var folio = '#' + folioFormato(r.folio||0);
    document.getElementById('vp-titulo').textContent = 'Recibo ' + folio + ' — ' + (r.nombre||'');
    document.getElementById('vp-iframe').src = r.pdfBase64;
    modal.classList.add('show');
  } else {
    if (typeof reDescargar === 'function') reDescargar(idx);
    else if (typeof toast === 'function') toast('Sin PDF guardado para este recibo','err');
  }
}

function buscarReciboFolio(folio) {
  var num = parseInt(String(folio).trim(), 10);
  if (isNaN(num)) return;
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : (REC.recibos || []);
  var idx = recibos.findIndex(function(r){ return r.folio === num; });
  if (idx < 0) { if (typeof toast === 'function') toast('Folio no encontrado','err'); return; }
  verVistaPrevia(idx);
}

function sincronizarFolioConREC() {
  if (typeof REC === 'undefined') return;
  if (REC.folioActual && REC.folioActual > (appData.folioActual || 100)) appData.folioActual = REC.folioActual;
  if (REC.recibos && REC.recibos.length > 0) {
    var fds = new Set(REC.recibos.map(function(r){return r.folio;}));
    var soloL = (appData.recibos||[]).filter(function(r){return !fds.has(r.folio);});
    appData.recibos = soloL.concat(REC.recibos);
  }
  if (typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
  if (typeof renderHistorial === 'function') renderHistorial();
}

// ─── VINCULAR RECIBO CON CARPETA / JUICIO ──────────────────────
var _recibo_vincular_idx = null;
function abrirVincularRecibo(idx) {
  _recibo_vincular_idx = idx;
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) return;
  var modal = document.getElementById('modal-vincular-recibo');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-vincular-recibo';
    modal.className = 'modal-ov';
    var mh = '<div class="modal" style="max-width:500px;width:95vw;max-height:92vh;display:flex;flex-direction:column;">';
    mh += '<div class="modal-hdr">';
    mh += '<h3 style="font-size:0.9rem;">&#128194; Vincular con Carpeta / Juicio</h3>';
    mh += '<button class="modal-x" onclick="document.getElementById(\"modal-vincular-recibo\").classList.remove(\"show\")">&#10005;</button>';
    mh += '</div><div class="modal-body" style="padding:16px;">';
    mh += '<div id="vinc-rec-info" style="font-size:0.72rem;color:var(--muted);margin-bottom:14px;background:var(--surface2);padding:8px 10px;border-radius:4px;"></div>';
    mh += '<div class="field" style="margin-bottom:12px;"><label style="font-size:0.72rem;color:var(--muted);">&#128193; Carpeta de Archivo</label>';
    mh += '<select id="vinc-carpeta" style="width:100%;background:var(--surface);border:1px solid var(--border-l);border-radius:4px;padding:8px;color:var(--gold-l);font-size:0.74rem;"><option value="">&#8212; Sin carpeta &#8212;</option></select></div>';
    mh += '<div class="field" style="margin-bottom:12px;"><label style="font-size:0.72rem;color:var(--muted);">&#9878; Expediente de Juicio</label>';
    mh += '<select id="vinc-juicio" style="width:100%;background:var(--surface);border:1px solid var(--border-l);border-radius:4px;padding:8px;color:var(--gold-l);font-size:0.74rem;"><option value="">&#8212; Sin juicio &#8212;</option></select></div>';
    mh += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">';
    mh += '<button class="btn btn-ghost" onclick="document.getElementById(\"modal-vincular-recibo\").classList.remove(\"show\")">Cancelar</button>';
    mh += '<button class="btn" onclick="confirmarVincularRecibo()" style="background:var(--gold-d);color:#fff;border:none;">&#128190; Vincular</button>';
    mh += '</div></div></div>';
    modal.innerHTML = mh;
    document.body.appendChild(modal);
  }
  document.getElementById('vinc-rec-info').textContent = '#' + folioFormato(r.folio||0) + ' — ' + (r.nombre||'') + ' · ' + (r.fecha||'');
  var selCarp = document.getElementById('vinc-carpeta');
  selCarp.innerHTML = '<option value="">&#8212; Sin carpeta &#8212;</option>';
  if (typeof D !== 'undefined' && D.carpetas && D.carpetas.length) {
    D.carpetas.forEach(function(c, ci) {
      var opt = document.createElement('option');
      opt.value = ci;
      opt.textContent = (c.nombre || c.titulo || 'Carpeta ' + (ci+1));
      if (r.carpetaIdx === ci) opt.selected = true;
      selCarp.appendChild(opt);
    });
  }
  var selJuicio = document.getElementById('vinc-juicio');
  selJuicio.innerHTML = '<option value="">&#8212; Sin juicio &#8212;</option>';
  if (typeof D !== 'undefined' && D.juicios && D.juicios.length) {
    D.juicios.forEach(function(j, ji) {
      var opt = document.createElement('option');
      opt.value = ji;
      opt.textContent = (j.nombre || j.titulo || j.expediente || 'Juicio ' + (ji+1));
      if (r.juicioIdx === ji) opt.selected = true;
      selJuicio.appendChild(opt);
    });
  }
  modal.classList.add('show');
}

function confirmarVincularRecibo() {
  if (_recibo_vincular_idx === null) return;
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[_recibo_vincular_idx];
  if (!r) return;
  var carpVal = document.getElementById('vinc-carpeta').value;
  var juicioVal = document.getElementById('vinc-juicio').value;
  if (carpVal !== '') r.carpetaIdx = parseInt(carpVal); else delete r.carpetaIdx;
  if (juicioVal !== '') r.juicioIdx = parseInt(juicioVal); else delete r.juicioIdx;
  if (typeof actualizarArchivoControl === 'function') actualizarArchivoControl().catch(function(e){console.warn(e);});
  if (typeof save === 'function') save();
  if (typeof renderHistorial === 'function') renderHistorial();
  document.getElementById('modal-vincular-recibo').classList.remove('show');
  if (typeof toast === 'function') toast('Recibo vinculado &#10003;');
}