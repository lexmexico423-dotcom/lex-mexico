/* LEX-MÉXICO · Módulo administracion
 * Funciones extraídas sin modificar su contenido.
 */

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

function pintarPagosParciales(arr){
  const tbody = document.getElementById('pagos-parciales-tbody');
  tbody.innerHTML = ''; pagoParcialCount = 0;
  // NO se inyecta fila del anticipo original — el saldo pendiente ya refleja
  // los abonos anteriores. Solo se muestran pagos nuevos desde esta sesion.
  const recibo = reciboEnActualizacion;
  (arr||[]).forEach(pp => agregarPagoParcial(Object.assign({}, pp, {locked: true})));
  recalcularResumenActualizacion();
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

function cerrarModalAnticipo(){
  document.getElementById('modal-anticipo-warn').classList.remove('show');
  // Re-enfocar el campo anticipo para que el usuario corrija
  setTimeout(()=>{ const a=$('anticipo'); if(a){a.focus();a.select();} }, 80);
}

function esAdministrador() {
  if (empleadoActual && empleadoActual.email) {
    return empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }
  return false;
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

function aplicarEstadoCierre() {
  const bloqueada = cajaBloqueada();
  // FIX (excepción para admin): el cierre de caja bloqueaba Captura Rápida,
  // Generar Recibo y los servicios (Tenencia, CSF, Copias, Escaneo, Registro
  // Civil) para TODOS por igual, sin excepción — a diferencia del candado de
  // horario, que ya excluye al admin. El admin (dueño del despacho) sí puede
  // seguir capturando aunque la caja del día ya haya cerrado; el banner de
  // abajo se mantiene igual para todos (informa que la caja cerró), solo los
  // botones dejan de deshabilitarse para el admin.
  const _esAdminAEC = (typeof esAdministrador === 'function' && esAdministrador());
  const bloqueaBotones = bloqueada && !_esAdminAEC;
  const saldoTotal = getSaldo();
  const acumulado = D.saldoAcumulado || 0;
  // ¿El cierre de hoy fue registrado como "sin movimientos"?
  const cierreHoy = (D.cierres || []).find(c => c && c.fecha === hoy());
  const cerradaSinMovs = bloqueada && cierreHoy && cierreHoy.sinMovimientos === true;
  // Barra inferior — reconstruir según estado
  const bar = document.querySelector('.cierre-bar');
  if (bar) {
    if (bloqueada) {
      const lineaSup = cerradaSinMovs
        ? 'Caja cerrada — Sin movimientos contables durante la jornada'
        : 'Caja cerrada — se habilita mañana';
      bar.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;flex:1;">
          <div>
            <div style="font-family:monospace;font-size:0.6rem;color:rgba(77,202,106,0.6);text-transform:uppercase;letter-spacing:0.1em;">${lineaSup}</div>
            <div style="font-family:monospace;font-size:1.5rem;font-weight:700;color:#4dca6a;">$${fmt(saldoTotal)}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
        </div>`;
    } else {
      bar.style.background = saldoTotal < 0 ? '#2a0a0a' : 'linear-gradient(135deg,#0a1a0e 0%,#0f2a16 100%)';
      bar.style.borderColor  = saldoTotal < 0 ? 'rgba(192,22,26,0.4)' : 'rgba(42,122,58,0.3)';
      bar.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;flex:1;">
          <div>
            <div class="cierre-info" style="color:${saldoTotal<0?'rgba(255,100,100,0.6)':'rgba(77,202,106,0.7)'}">${acumulado > 0 ? 'Saldo en caja (incluye días anteriores)' : 'Saldo actual en caja'}</div>
            <div class="cierre-monto" id="cierreMonto" style="color:${saldoTotal<0?'#ff4444':'#4dca6a'};">${saldoTotal<0?'-':''}$${fmt(Math.abs(saldoTotal))}</div>
            ${acumulado > 0 ? `<div style="font-family:monospace;font-size:0.58rem;color:rgba(77,202,106,0.55);margin-top:2px;">Días anteriores sin retirar: $${fmt(acumulado)}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${(typeof esAdministrador === 'function' && esAdministrador()) ? '<button class="btn btn-success" onclick="cerrarCaja()">🔒 Cerrar Caja</button>' : ''}
        </div>`;
    }
  }
  // ── Selectores de todos los controles que registran ingresos o egresos ──
  const selectoresBloqueables = [
    // Nuevo recibo y captura rápida
    '[onclick="ir(\'nuevo-recibo\')"]',
    '[onclick="abrirLibre()"]',
    // Botones de ingreso / egreso en captura rápida (modal libre)
    '#libreBtn-ingreso',
    '#libreBtn-egreso',
    '#libreBtn-registrar',
    '#libreBtn-carrito',
    // Otros botones de agregar movimiento manual en contabilidad
    '[onclick="agregarIngreso()"]',
    '[onclick="agregarEgreso()"]',
    // Servicios que cobran a caja (Tenencia, CSF, Copias, Escaneo, Registro Civil)
    '[onclick="abrirPanelTenencia()"]',
    '[onclick="abrirPanelCSF()"]',
    '[onclick="abrirCopias()"]',
    '[onclick="abrirEscaneo()"]',
    '[onclick="abrirRegistroCivil()"]',
  ];
  selectoresBloqueables.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.disabled = bloqueaBotones;
      el.style.opacity = bloqueaBotones ? '0.35' : '';
      el.style.pointerEvents = bloqueaBotones ? 'none' : '';
      if (bloqueaBotones) {
        el.title = '🔒 Caja cerrada — se habilita mañana';
      } else {
        el.removeAttribute('title');
      }
    });
  });
  // Inputs de monto en formularios de ingreso/egreso manual
  ['#monto-ingreso','#monto-egreso','#input-ingreso','#input-egreso',
   '#concepto-ingreso','#concepto-egreso'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) {
      el.readOnly = bloqueaBotones;
      el.style.opacity = bloqueaBotones ? '0.45' : '';
      el.style.pointerEvents = bloqueaBotones ? 'none' : '';
    }
  });
  // Overlay visual sobre el panel de ingresos/egresos manuales si existe
  const panelMov = document.getElementById('panel-movimientos-manuales') ||
                   document.getElementById('tab-contabilidad-form');
  if (panelMov) {
    panelMov.style.position = 'relative';
    let overlay = panelMov.querySelector('.caja-cerrada-overlay');
    if (bloqueaBotones && !overlay) {
      overlay = document.createElement('div');
      overlay.className = 'caja-cerrada-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;background:rgba(20,15,5,0.38);' +
        'z-index:10;display:flex;align-items:center;justify-content:center;border-radius:8px;' +
        'backdrop-filter:blur(1px);cursor:not-allowed;';
      overlay.innerHTML = '<span style="font-family:\'JetBrains Mono\',monospace;font-size:0.78rem;' +
        'color:#f0c060;font-weight:700;letter-spacing:0.08em;text-shadow:0 1px 4px #000;">🔒 CAJA CERRADA</span>';
      panelMov.appendChild(overlay);
    } else if (!bloqueaBotones && overlay) {
      overlay.remove();
    }
  }
}

function _teObtener(email){
  if(!email || typeof D === 'undefined' || !D.tiempoExtra) return null;
  const t = D.tiempoExtra[String(email).toLowerCase()];
  if(!t) return null;
  // 'hora' e 'indefinido_hoy' son válidos solo el día en que se otorgaron —
  // si ya es otro día, se consideran vencidos (se limpian solos, sin que el
  // administrador tenga que hacer nada al día siguiente).
  if((t.tipo === 'hora' || t.tipo === 'indefinido_hoy') && t.fecha !== _teClaveHoy()) return null;
  return t;
}

function _horarioEstado(){
  // Tiempo extra otorgado por el administrador: tiene prioridad sobre TODO,
  // incluido el bloqueo de domingo — si el admin autorizó, el sistema queda
  // abierto ('tarde') sin más preguntas.
  const _teEmail = (typeof empleadoActual !== 'undefined' && empleadoActual) ? empleadoActual.email : null;
  if(_teEmail && _teEstaAbierto(_teEmail)) return 'tarde';
  // Domingo: el despacho no labora — se aplica ANTES que cualquier otra
  // regla y cubre el día completo (no importa la hora). Solo bloquea a
  // empleados; horarioGateLogin() nunca llama esto para admin.
  if(_ahoraVerificado().getDay() === 0) return 'domingo';
  const mins   = _minutosAhora();
  const inicio = _minutosDeHHMM(HORARIO_APERTURA_SISTEMA);
  const fin    = _minutosDeHHMM(HORARIO_CAPTURA_FIN);
  if(mins < inicio) return 'antes';
  if(mins < 720)    return 'manana';
  if(mins < fin)    return 'tarde';
  return 'cerrado';
}

function _primerNombreEmpleado(nombreCompleto){
  const partes = String(nombreCompleto||'').trim().split(/\s+/).filter(Boolean);
  if(!partes.length) return 'Usuario';
  let idx = 0;
  if(/^(LIC|ING|DR|MTRO|C\.P|LICDA|ABOG)\.?$/i.test(partes[0])) idx = 1;
  return partes[idx] || partes[0];
}

function _horarioGateCerrar(){
  const ov = document.getElementById('modal-horario-gate');
  if(ov) ov.classList.remove('show');
  if(_hgCountdownTimer){ clearInterval(_hgCountdownTimer); _hgCountdownTimer = null; }
  // Recién AHORA el usuario queda autorizado a ver el sistema real — se
  // retira la cortina (que hasta este momento tapaba el fondo con la
  // textura oscura del login detrás del aviso).
  if(typeof _lexCortinaQuitar === 'function') _lexCortinaQuitar();
  if(window._avisoTardanzaPendiente != null){
    const mins = window._avisoTardanzaPendiente;
    window._avisoTardanzaPendiente = null;
    setTimeout(function(){ if(typeof toast==='function') toast('⏰ Registrado con '+mins+' min de retraso','err'); }, 300);
  }
}

async function horarioGateLogin(){
  try{
    if(!empleadoActual) { _lexCortinaQuitar(); return; }
    const esAdminUI = empleadoActual.email.toLowerCase() === (typeof ADMIN_EMAIL!=='undefined'?ADMIN_EMAIL.toLowerCase():'');
    if(!esAdminUI){
      const estado  = _horarioEstado();
      const nombre  = _primerNombreEmpleado(empleadoActual.nombre);
      // OJO: la cortina NO se quita aquí. Se deja puesta (el aviso de horario
      // tiene z-index más alto, así que se ve encima sin problema) para que
      // el fondo detrás del aviso sea SIEMPRE la textura oscura del login —
      // nunca el sistema real, ni borroso ni de fondo. Se retira hasta que el
      // usuario quede realmente autorizado a entrar: en _horarioGateCerrar()
      // (mañana/tarde, al cerrar el aviso, o al terminar la cuenta regresiva).
      // Para "cerrado" nunca se quita — la única salida es cerrar sesión.
      _horarioGateMostrar(estado, nombre);
      if(estado === 'manana' || estado === 'tarde'){
        try{
          const resultadoPunt = await registrarConexionDiaria();
          if(resultadoPunt && resultadoPunt.estado === 'tarde'){
            window._avisoTardanzaPendiente = resultadoPunt.minutosTarde;
          }
        }catch(e){ console.warn('[horarioGateLogin] puntualidad', e); }
      }
    } else {
      // Admin: no hay aviso de horario que mostrar, pero igual hay que
      // retirar la cortina de carga para que el panel se revele.
      _lexCortinaQuitar();
    }
    if(!window._avisoProgramadoInterval){
      window._avisoProgramadoInterval = setInterval(_avisoProgramadoChequear, 60000);
    }
    setTimeout(_avisoProgramadoChequear, esAdminUI ? 500 : 1800);
  } catch(e){
    console.warn('[horarioGateLogin]', e);
    _lexCortinaQuitar(); // red de seguridad: nunca dejar la cortina pegada si algo falla
  }
}

function _avisoProgramadoVistoHoyKey(hhmm){
  const email  = (empleadoActual && empleadoActual.email || 'anon').toLowerCase();
  const diaKey = _hoyReal();
  return 'lex_aviso_'+email+'_'+diaKey+'_'+hhmm;
}

function _avisoProgramadoChequear(){
  try{
    if(!empleadoActual) return;
    // Si el candado de horario (aviso "Horario concluido"/cuenta regresiva)
    // sigue mostrado, no se compite con él ni se apila otro modal encima —
    // eso era justo lo que oscurecía el fondo (dos overlays translúcidos uno
    // sobre otro tapaban por completo la textura dorada de la cortina). El
    // aviso programado se reintenta solo (cada 60s) y se muestra normal en
    // cuanto el candado se cierre de verdad (mañana/tarde) o nunca si el
    // horario sigue "cerrado" — ese estado ya deja claro que el sistema está
    // cerrado, este aviso sería redundante.
    const _gateSC = document.getElementById('modal-horario-gate');
    if(_gateSC && _gateSC.classList.contains('show')) return;
    // Cierre automático de caja: revisa (sin bloquear este chequeo) si el
    // servidor ya marcó que pasaron las 5:30 p.m. y hoy no se ha cerrado.
    if(typeof _chequearCierreAutomaticoCaja === 'function') _chequearCierreAutomaticoCaja();
    // FIX (caso real: empleada siguió trabajando después de las 5:30 con la
    // sesión ya abierta desde antes): el candado real (_horarioGateMostrar)
    // antes solo se evaluaba UNA VEZ, al iniciar sesión (horarioGateLogin) —
    // una sesión abierta antes de las 5:30 nunca lo volvía a ver, y el aviso
    // de las 17:30 de AVISOS_PROGRAMADOS de aquí abajo es solo informativo,
    // no bloquea nada. Ahora, en cada revisión (cada 60s), si quien tiene la
    // sesión NO es admin y el horario ya está realmente cerrado (o es
    // domingo), se aplica el candado real — el mismo modal de "Horario
    // concluido"/"Día no laborable" que ya existe, con la única salida de
    // cerrar sesión. Se revisa en cada tick (no solo una vez al día) para
    // que no haya forma de seguir trabajando con la sesión abierta.
    const _esAdminChk = empleadoActual.email && typeof ADMIN_EMAIL !== 'undefined' &&
      empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if(!_esAdminChk){
      const _estadoChk = _horarioEstado();
      if(_estadoChk === 'cerrado' || _estadoChk === 'domingo'){
        _horarioGateMostrar(_estadoChk, _primerNombreEmpleado(empleadoActual.nombre));
        return; // el candado ya quedó puesto — no compite con el aviso de abajo
      }
      // ── Tiempo extra activo: los avisos normales (4:30/5:15/5:30, keyeados
      // al cierre de las 5:30) ya no aplican — en su lugar, un único aviso
      // 5 minutos antes de que concluya el tiempo extra otorgado (solo
      // aplica al tipo 'hora'; los indefinidos no tienen cierre que avisar).
      const _teAct = _teObtener(empleadoActual.email);
      if(_teAct){
        if(_teAct.tipo === 'hora'){
          const _faltanTE = _minutosDeHHMM(_teAct.hasta) - _minutosAhora();
          if(_faltanTE <= 5 && _faltanTE > 0){
            const _teKey = 'lex_aviso_te_'+empleadoActual.email.toLowerCase()+'_'+_teAct.fecha+'_'+_teAct.hasta;
            if(!localStorage.getItem(_teKey)){
              localStorage.setItem(_teKey, '1');
              _avisoProgramadoMostrar({ color:'#c0161a', titulo:'CIERRE EN 5 MINUTOS',
                cuerpo:'El tiempo extra autorizado está por concluir. El sistema cerrará a las '+_teAct.hasta+' hrs.' });
            }
          }
        }
        return;
      }
    }
    const mins = _minutosAhora();
    let masReciente = null;
    for(let i = 0; i < AVISOS_PROGRAMADOS.length; i++){
      if(mins >= _minutosDeHHMM(AVISOS_PROGRAMADOS[i].hhmm)) masReciente = AVISOS_PROGRAMADOS[i];
    }
    if(!masReciente) return;
    const key = _avisoProgramadoVistoHoyKey(masReciente.hhmm);
    if(localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    _avisoProgramadoMostrar(masReciente);
  } catch(e){ console.warn('[avisoProgramado]', e); }
}

async function recargarPaginaForzado() {
  const btn = document.querySelector('.btn-recargar');
  // Modal "Sincronización en curso" eliminado a petición del usuario.
  // Los datos están protegidos en el respaldo local (localStorage), por lo que
  // recargar mientras hay una subida en curso no causa pérdida — la subida se
  // reintenta automáticamente en la próxima oportunidad.
  // Animación visual del botón
  if (btn) btn.classList.add('spinning');
  // Pequeña pausa para que el usuario vea la animación
  setTimeout(() => {
    // location.reload(true) es la forma estándar de forzar recarga sin caché.
    // Aunque el segundo argumento está deprecated en algunos navegadores modernos,
    // sigue funcionando. Como respaldo, agregamos un parámetro de query con timestamp.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_r', Date.now().toString());
      window.location.href = url.toString();
    } catch(e) {
      // Fallback si la URL es file:// (URL constructor puede fallar)
      window.location.reload(true);
    }
  }, 250);
}

function manejarAtajos(e) {
  // No activar atajos si el usuario está escribiendo en un input
  const target = e.target;
  if (target && (
    target.tagName === 'INPUT' || 
    target.tagName === 'TEXTAREA' || 
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )) {
    // Excepción: Esc cierra modales/dropdowns aunque el foco esté en un input
    if (e.key === 'Escape') {
      cerrarModalesAbiertos();
    }
    return;
  }
  // Esc global: cerrar modales abiertos
  if (e.key === 'Escape') {
    cerrarModalesAbiertos();
    return;
  }
  // Buscar atajo coincidente
  for (const atajo of ATAJOS) {
    if (e.key.toLowerCase() !== atajo.tecla.toLowerCase()) continue;
    if (atajo.ctrl && !e.ctrlKey && !e.metaKey) continue;
    if (atajo.alt && !e.altKey) continue;
    if (atajo.shift && !e.shiftKey) continue;
    if (!atajo.ctrl && (e.ctrlKey || e.metaKey)) continue;
    if (!atajo.alt && e.altKey) continue;
    e.preventDefault();
    e.stopPropagation();
    try {
      atajo.accion();
    } catch(err) {
      console.warn('Error en atajo:', err);
    }
    return;
  }
}

function renderCaja(){
  const movs=getMovHoy();
  const ing=movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
  const egr=movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
  const saldoTotal=getSaldo();
  const sinSesion = !tokenOk();
  $('cIng').textContent = sinSesion ? '—' : '$'+fmt(ing);
  $('cEgr').textContent = sinSesion ? '—' : '$'+fmt(egr);
  const saldoEl=$('cSaldo');
  if(saldoEl){
  if(sinSesion){
    saldoEl.textContent='Conecta sesión';
    saldoEl.style.color='var(--muted,#888)';
    saldoEl.style.fontSize='0.85rem';
  } else if(saldoTotal<0){
    saldoEl.textContent='-$'+fmt(Math.abs(saldoTotal));
    saldoEl.style.color='var(--rojo,#d94040)';
    saldoEl.style.fontSize='';
  } else {
    saldoEl.textContent='$'+fmt(saldoTotal);
    saldoEl.style.color='';
    saldoEl.style.fontSize='';
  }
  }
  $('cIngCnt').textContent=movs.filter(m=>m.tipo==='ingreso').length+' mov.';
  $('cEgrCnt').textContent=movs.filter(m=>m.tipo==='egreso').length+' mov.';
  var _cFechaEl=$('cFecha');if(_cFechaEl)_cFechaEl.textContent=new Date().toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'long'});
  var _cRec=document.getElementById('cRec');if(_cRec)_cRec.textContent=REC.recibos.filter(r=>r.fecha===hoy()).length;
  const saldoFmt=(saldoTotal<0?'-':'')+'$'+fmt(Math.abs(saldoTotal));
  // Rojo si el saldo es negativo, verde si es positivo — antes solo se actualizaba
  // el texto y el color se quedaba pegado en verde (el de la carga inicial) aunque
  // el saldo pasara a negativo.
  const _colorSaldoCaja = sinSesion ? '' : (saldoTotal<0 ? '#ff4444' : '#4dca6a');
  var cm=document.getElementById('cierreMonto');
  if(cm){ cm.textContent=sinSesion?'—':saldoFmt; if(_colorSaldoCaja) cm.style.color=_colorSaldoCaja; }
  var ts=document.getElementById('topSaldo');
  if(ts){ ts.textContent=sinSesion?'—':saldoFmt; if(_colorSaldoCaja) ts.style.color=_colorSaldoCaja; }
  // La barra inferior de caja (fondo verde/rojo) solo se recoloreaba en
  // aplicarEstadoCierre() (apertura/cierre de caja) — si el saldo cruzaba a
  // negativo por un movimiento nuevo sin pasar por esa función, el fondo se
  // quedaba verde aunque el monto ya se viera en rojo. Se sincroniza aquí
  // también, con la misma lógica de color, mientras la caja no esté cerrada.
  if(!sinSesion && typeof cajaBloqueada === 'function' && !cajaBloqueada()){
    var _barCaja = document.querySelector('.cierre-bar');
    if(_barCaja){
      _barCaja.style.background  = saldoTotal<0 ? '#2a0a0a' : 'linear-gradient(135deg,#0a1a0e 0%,#0f2a16 100%)';
      _barCaja.style.borderColor = saldoTotal<0 ? 'rgba(192,22,26,0.4)' : 'rgba(42,122,58,0.3)';
    }
  }
  safeExec('renderVencimientos', () => renderVencimientos());
  const tb=$('tbMovHoy'),vacio=$('movVacio');
  if(!movs.length){tb.innerHTML='';vacio.style.display='block';$('movCnt').textContent='0 registros';return;}
  vacio.style.display='none';$('movCnt').textContent=movs.length+' registros';
  tb.innerHTML=movs.map(m=>{
    // Descripción: para movimientos de recibo, mostrar SOLO Concepto + Descripción del
    // recibo (folio y nombre ya tienen su propia columna, no hace falta repetirlos aquí).
    // Truncado a 65 caracteres — el texto completo queda disponible al pasar el puntero
    // (atributo title, tooltip nativo del navegador).
    let descMostrar = m.descripcion || '—';
    if(m.fuente === 'recibo' && m.folio != null){
      const _rO = (typeof appData!=='undefined'?appData.recibos||[]:[]).find(r=>r.folio===m.folio&&(r.letra||'A')===(m.letra||'A'));
      const _c0 = (_rO && _rO.conceptos && _rO.conceptos[0]) ? _rO.conceptos[0] : null;
      if(_c0){
        const _conc = (_c0.concepto||'').trim();
        const _dsc  = (_c0.descripcion||'').trim();
        descMostrar = _conc + (_dsc ? ' — ' + _dsc : '');
      }
    }
    const _descCompleta = descMostrar;
    const _descCorta = _descCompleta.length > 95 ? _descCompleta.slice(0,95) + '…' : _descCompleta;
    return `<tr>
    <td class="mono" style="font-size:0.68rem;color:var(--muted);white-space:nowrap;">${m.hora||'—'}</td>
    <td style="word-break:break-word;min-width:200px;" title="${esc(_descCompleta)}">${esc(_descCorta)}</td>
    <td style="white-space:nowrap;">${(()=>{
      // Fallback defensivo igual que _badgeEstatus: si recibo con anticipo=0, mostrar Sin Anticipo
      let est = m.estatus;
      if(!est && m.fuente==='recibo' && m.folio!=null){
        const _rO=(typeof appData!=='undefined'?appData.recibos||[]:[]).find(r=>r.folio===m.folio&&!r.esComplemento&&(r.letra||'A')===(m.letra||'A'));
        est = (_rO&&parseFloat(_rO.anticipo||0)===0) ? 'Sin Anticipo' : (m.monto>0?'Anticipo':'Pendiente');
      } else if(!est){ est = m.monto>0?'Anticipo':'Pendiente'; }
      if(est){
        // Si el estatus es "Anticipo", mostrar "Ingreso" o "Egreso" según el tipo real del movimiento
        if(est==='Anticipo'){ const etiq=m.tipo==='egreso'?'Egreso':'Ingreso'; const tc=m.tipo==='egreso'?'tag-r':'tag-v'; return '<span class="tag '+tc+'" style="font-size:0.6rem;">'+etiq+'</span>'; }
        const tc=est==='Liquidado'?'tag-v':est==='Sin Anticipo'?'tag-sa':est==='Abono parcial'?'tag-a':'tag-m'; return '<span class="tag '+tc+'" style="font-size:0.6rem;">'+est+'</span>';
      }
      return '<span class="tag '+(m.tipo==='ingreso'?'tag-v':'tag-r')+'" style="font-size:0.6rem;">'+(m.cat||m.tipo)+'</span>';
    })()}</td>
    <td style="font-size:0.68rem;color:var(--muted);white-space:nowrap;">${esc(m.responsable||'—')}</td>
    <td class="monto ${m.tipo==='ingreso'?'ing':'egr'}" style="white-space:nowrap;">${m.tipo==='ingreso'?'+':'-'}$${fmt(m.monto)}</td>
  </tr>`;
  }).join('');
}

function verificarYCorregirMovimientosSinAnticipo() {
  if (!esAdministrador()) return; // Solo el administrador ve esta corrección
  var errores = _corregirMovimientosSinAnticipo();
  if (errores.length === 0) return;
  var lista = errores.map(function(e) {
    var folioStr = (typeof folioConLetra === 'function')
      ? folioConLetra(e.rec.folio, e.rec.anio, e.rec.letra)
      : ('#' + e.rec.folio + (e.rec.letra || 'A'));
    return '• Recibo <strong>' + folioStr + '</strong>: movimiento registrado por $' + Number(e.mov.monto).toLocaleString('es-MX') + ' pero anticipo = $0.';
  }).join('<br>');
  confirmarCambioContable({
    titulo: 'Corrección de movimientos Sin Anticipo',
    descripcion: 'Se detectaron ' + errores.length + ' movimiento(s) en Caja/Contabilidad con monto incorrecto para recibos emitidos sin anticipo:<br><br>' + lista + '<br><br>Estos recibos se emitieron sin anticipo (el cliente no dejó dinero al inicio). Sus pagos posteriores ya quedaron registrados correctamente en los abonos B/C. El movimiento original del recibo A debe quedar en $0.<br><br>¿Aplicar la corrección? El monto se ajustará a $0 y el estatus a "Sin Anticipo".',
    esError: true,
    mensajeError: errores.length + ' movimiento(s) tienen monto > $0 pero el recibo fue emitido sin anticipo — los pagos ya están en los abonos B/C correspondientes.',
    onAplicar: function() {
      errores.forEach(function(e) {
        e.mov.monto   = 0;
        e.mov.estatus = 'Sin Anticipo';
      });
      if (typeof save === 'function') save();
      if (typeof renderCaja === 'function') renderCaja();
      if (typeof renderContab === 'function') renderContab();
      if (typeof syncEstadoSupabaseDebounced === 'function') setTimeout(syncEstadoSupabaseDebounced, 500);
    },
    onCancelar: function() {
      console.info('[LEX] Corrección Sin Anticipo cancelada por el usuario.');
    }
  });
}

function renderContab() {
  const sinSesion = !tokenOk();
  // ── 1. Stats fijos: siempre día de hoy ────────────────────────
  const movHoy  = getMovHoy();
  const ingHoy  = movHoy.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const egrHoy  = movHoy.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const saldoCaja = getSaldo();
  const elIng  = document.getElementById('rIng');
  const elEgr  = document.getElementById('rEgr');
  const elUtil = document.getElementById('rUtil');
  if (elIng) elIng.textContent = sinSesion ? '—' : '$' + fmt(ingHoy);
  if (elEgr) elEgr.textContent = sinSesion ? '—' : '$' + fmt(egrHoy);
  if (elUtil) {
    if (sinSesion) {
      elUtil.textContent = 'Conecta sesión';
      elUtil.style.color = 'var(--muted)'; elUtil.style.fontSize = '0.85rem';
    } else {
      elUtil.textContent = (saldoCaja < 0 ? '-' : '') + '$' + fmt(Math.abs(saldoCaja));
      elUtil.style.color = saldoCaja < 0 ? 'var(--rojo)' : ''; elUtil.style.fontSize = '';
    }
  }
  const elIngCnt = document.getElementById('rIngCnt');
  const elEgrCnt = document.getElementById('rEgrCnt');
  if (elIngCnt) elIngCnt.textContent = movHoy.filter(m => m.tipo === 'ingreso').length + ' mov.';
  if (elEgrCnt) elEgrCnt.textContent = movHoy.filter(m => m.tipo === 'egreso').length + ' mov.';
  // ── 2. Poblar selector de años ───────────────────────────────
  _poblarSelectorAnios();
  // ── 3. Leer filtros activos ──────────────────────────────────
  const q        = (document.getElementById('cBuscar')?.value || '').toLowerCase().trim();
  const filtroA  = (document.getElementById('cFiltroAnio')?.value || '');
  const filtroM  = (document.getElementById('cFiltroMes')?.value  || '');
  const hayFiltro = q || filtroA || filtroM || filtroC !== 'todo';
  const btnLimpiar = document.getElementById('btnContabLimpiar');
  if (btnLimpiar) btnLimpiar.style.display = hayFiltro ? '' : 'none';
  // ── 4. Aplicar filtros ───────────────────────────────────────
  let movs = getAllMovs();
  if (filtroC === 'ing') movs = movs.filter(m => m.tipo === 'ingreso');
  else if (filtroC === 'egr') movs = movs.filter(m => m.tipo === 'egreso');
  if (filtroA) movs = movs.filter(m => m.fecha && m.fecha.startsWith(filtroA));
  if (filtroM) movs = movs.filter(m => m.fecha && m.fecha.length >= 7 && m.fecha.substring(5, 7) === filtroM);
  if (q) {
    movs = movs.filter(m =>
      (m.descripcion || '').toLowerCase().includes(q) ||
      (m.nombre     || '').toLowerCase().includes(q) ||
      (m.cat        || '').toLowerCase().includes(q) ||
      (m.folioCaja  || '').toLowerCase().includes(q) ||
      (m.folio != null && ('R-' + String(m.folio).padStart(4, '0')).toLowerCase().includes(q)) ||
      (m.folio != null && String(m.folio).padStart(4, '0').includes(q)) ||
      (m.responsable || '').toLowerCase().includes(q)
    );
  }
  // ── 5. Stat "Total del periodo" ──────────────────────────────
  const periodoIng  = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const periodoEgr  = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const periodoNeto = periodoIng - periodoEgr;
  const elPN = document.getElementById('rPeriodoNeto');
  const elPS = document.getElementById('rPeriodoSub');
  if (elPN) {
    elPN.textContent = (periodoNeto < 0 ? '-' : '') + '$' + fmt(Math.abs(periodoNeto));
    elPN.style.color = periodoNeto < 0 ? 'var(--rojo)' : periodoNeto > 0 ? 'var(--azul)' : '';
  }
  if (elPS) elPS.textContent = movs.length + ' mov. · ▲$' + fmt(periodoIng) + ' ▼$' + fmt(periodoEgr);
  // ── 6. Contenedor vacío ──────────────────────────────────────
  const contenedor = document.getElementById('contab-dias');
  const elVacio    = document.getElementById('contVacio');
  const elGT       = document.getElementById('contab-gran-total');
  if (!contenedor) return;
  // Incluir también días de cierre sin movimientos en el rango del filtro
  const cierresSinMov = (D.cierres || []).filter(c => {
    if (!c || !c.sinMovimientos || !c.fecha) return false;
    if (filtroA && !c.fecha.startsWith(filtroA)) return false;
    if (filtroM && c.fecha.substring(5, 7) !== filtroM) return false;
    return true;
  });
  if (!movs.length && !cierresSinMov.length) {
    contenedor.innerHTML = '';
    if (elGT) elGT.style.display = 'none';
    let msg = 'Sin movimientos en el periodo.';
    if (q) msg = `Sin resultados para "${esc(q)}".`;
    else if (filtroA && filtroM) msg = `Sin movimientos en ${filtroM}/${filtroA}.`;
    else if (filtroA) msg = `Sin movimientos en ${filtroA}.`;
    elVacio.textContent = msg;
    elVacio.style.display = 'block';
    return;
  }
  elVacio.style.display = 'none';
  // ── 7. Agrupar: año → mes → día ─────────────────────────────
  // Estructura: grupos[anio][mes][dia] = [movimientos]
  const arbol = {};
  function _ensureDay(f) {
    if (!f || f === '—') return;
    const anio = f.substring(0, 4);
    const mes  = f.substring(5, 7);
    const dia  = f;
    if (!arbol[anio]) arbol[anio] = {};
    if (!arbol[anio][mes]) arbol[anio][mes] = {};
    if (!arbol[anio][mes][dia]) arbol[anio][mes][dia] = [];
  }
  movs.forEach(m => { _ensureDay(m.fecha); if (m.fecha && m.fecha !== '—') arbol[m.fecha.substring(0,4)][m.fecha.substring(5,7)][m.fecha].push(m); });
  cierresSinMov.forEach(c => { _ensureDay(c.fecha); });
  // Detectar días huecos dentro del rango (solo si hay cierres registrados)
  const _diasAutoSinMov = new Set();
  const todasFechas = movs.map(m => m.fecha).filter(f => f && f !== '—');
  if (todasFechas.length) {
    const fechaMin = [...(D.cierres || []).map(c => c.fecha).filter(Boolean), ...todasFechas].sort()[0];
    const ayer = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
    try {
      const cursor = new Date(fechaMin + 'T12:00:00');
      const fin    = new Date(ayer + 'T12:00:00');
      while (cursor <= fin) {
        const f = cursor.toISOString().slice(0, 10);
        const a = f.substring(0, 4), mes = f.substring(5, 7);
        if (filtroA && a !== filtroA) { cursor.setDate(cursor.getDate()+1); continue; }
        if (filtroM && mes !== filtroM) { cursor.setDate(cursor.getDate()+1); continue; }
        if (!arbol[a] || !arbol[a][mes] || !arbol[a][mes][f]) {
          _ensureDay(f);
          _diasAutoSinMov.add(f);
        }
        cursor.setDate(cursor.getDate()+1);
      }
    } catch(e) { /* ignorar */ }
  }
  // ── 8. Helpers de formato ────────────────────────────────────
  const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MESES_CORTO  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function _fechaBonita(f) {
    try {
      const [y,m,d] = f.split('-').map(Number);
      return DIAS[new Date(y,m-1,d).getDay()].toUpperCase() + ' ' + d + ' DE ' + MESES_NOMBRE[m-1].toUpperCase() + ' ' + y;
    } catch(e) { return f; }
  }
  function _iniciales(nombre) {
    if (!nombre || nombre === '—') return '—';
    return nombre.trim().split(/\s+/).map(p => p[0]||'').join('').toUpperCase().substring(0,3);
  }
  function _badgeEstatus(m) {
    // Movimientos de Captura Rápida (caja): mostrar solo Ingreso/Egreso
    if(m.fuente === 'caja'){
      const _lbl = m.tipo === 'egreso' ? 'Egreso' : 'Ingreso';
      const _cls = m.tipo === 'egreso' ? 'tag-m' : 'tag-b';
      return `<span class="tag ${_cls}" style="font-size:0.54rem;">${_lbl}</span>`;
    }
    // Fallback defensivo: si el movimiento no tiene estatus, verificar el recibo original.
    // Si el recibo fue emitido sin anticipo (anticipo=0), usar 'Sin Anticipo' aunque monto>0
    // (esto cubre movimientos históricos creados con monto=total por error en lugar de monto=0).
    const _estFallback = (function() {
      if (m.fuente === 'recibo' && m.folio != null) {
        const _recOrig = (typeof appData !== 'undefined' ? appData.recibos || [] : [])
          .find(function(r){ return r.folio === m.folio && !r.esComplemento && (r.letra||'A') === (m.letra||'A'); });
        if (_recOrig && parseFloat(_recOrig.anticipo || 0) === 0) return 'Sin Anticipo';
      }
      return m.monto > 0 ? 'Anticipo' : 'Pendiente';
    })();
    const est = m.estatus || _estFallback;
    // Etiquetas visibles al usuario — los valores internos no cambian
    const labelMap = {
      'Liquidado':    'Pago Total',
      'Liquidación':  'Pago Total',
      'Anticipo':     'Pago Parcial',
      'Abono parcial':'Abonado',
      'Abono':        'Abonado',
      'Pendiente':    'Pendiente',
      'Sin Anticipo': 'Sin Anticipo',
      'Complementario': 'Complementario'
    };
    const label = labelMap[est] || est || m.cat || '—';
    const cls = (est === 'Liquidado' || est === 'Liquidación') ? 'tag-v' :
                est === 'Anticipo'     ? 'tag-b' :
                est === 'Sin Anticipo' ? 'tag-sa' :
                (est === 'Abono parcial' || est === 'Abono') ? 'tag-a' :
                est === 'Complementario' ? 'tag-a' :
                'tag-m';
    return `<span class="tag ${cls}" style="font-size:0.54rem;">${esc(label)}</span>`;
  }
  function _fila(m, bgBody) {
    let folioTxt, folioColor;
    if (m.fuente === 'recibo') {
      const n = m.folio != null ? m.folio : parseInt((m.id||'').replace('R-',''));
      // ⚠️ CRÍTICO: buscar siempre la versión A (original) para anio_folio — el B tiene la misma base
      const _rFol = (typeof appData !== 'undefined' ? appData.recibos||[] : []).find(function(r){ return r.folio === n && !r.esComplemento && (r.letra||'A')==='A'; }) ||
                    (typeof appData !== 'undefined' ? appData.recibos||[] : []).find(function(r){ return r.folio === n && !r.esComplemento; });
      let _letraF = m.letra || null;
      if(!_letraF && m.cat){
        const _catMatch = (m.cat||'').match(/#\d{2}-\d{3,}([A-Z])\b/);
        _letraF = _catMatch ? _catMatch[1] : null;
      }
      /* ⚠️ CRÍTICO — NO MODIFICAR: fallback seguro 'A'; si se usa _rFol.letra aquí, folio B aparece en fecha de A */
      if(!_letraF) _letraF = 'A';
      const str = folioConLetra(n, _rFol ? _rFol.anio_folio : null, _letraF);
      folioTxt  = `<span onclick="abrirFichaDesdeContab(${n})" style="cursor:pointer;text-decoration:underline;text-underline-offset:3px;color:var(--azul);" title="Ver Ficha del Folio #${str}">${str}</span>`;
      folioColor = '';
    } else {
      folioTxt  = `<span style="color:var(--gold-d);">${esc(m.folioCaja||'—')}</span>`;
      folioColor = '';
    }
    // Para recibos: Descripción = lo que YA quedó calculado y guardado en
    // m.descripcion al momento de guardar el recibo (combina CONCEPTO +
    // DESCRIPCIÓN del servicio complementario agregado en ESA versión, o
    // LIQUIDACIÓN TOTAL/ABONO PARCIAL — DEL ADEUDO ANTERIOR si fue un pago
    // puro — ver el guardado de movimientos en la función de "guardar
    // recibo"). Truncado a 65 caracteres para la celda — el texto completo
    // queda disponible al pasar el puntero (title, tooltip nativo).
    // FIX (caso real: folio 56): antes esto se sobreescribía SIEMPRE con
    // conceptos[0] del recibo — el concepto BASE del trámite, que es el
    // MISMO en las 7 versiones (A-G) de un folio — por lo que la columna
    // se veía idéntica en todas las filas sin importar lo que dijera
    // m.descripcion. Ahora se usa m.descripcion cuando existe, y solo se
    // cae a conceptos[0]/tramites para movimientos viejos/sintéticos que
    // nunca tuvieron ese campo calculado.
    let _descRec = m.descripcion || m.nombre || '—';
    const _recRefLetra = (m.fuente === 'recibo' && m.folio != null && typeof appData !== 'undefined' && appData.recibos)
      ? (appData.recibos.find(function(r){ return r.folio === m.folio && !r.esComplemento && (r.letra||'A') === (m.letra||'A'); })
        || appData.recibos.find(function(r){ return r.folio === m.folio; }))
      : null;
    if (!m.descripcion && m.fuente === 'recibo' && m.folio != null) {
      const _c0 = _recRefLetra && (_recRefLetra.conceptos || [])[0];
      if (_c0) {
        const _conc = (_c0.concepto || '').trim();
        const _dsc  = (_c0.descripcion || '').trim();
        if (_conc || _dsc) _descRec = _conc + (_dsc ? ' — ' + _dsc : '');
      } else if (_recRefLetra && _recRefLetra.tramites) {
        _descRec = _recRefLetra.tramites;
      }
    }
    const _descCompletaContab = m.fuente==='recibo' ? _descRec : (m.descripcion||'—');
    const _descCortaContab = _descCompletaContab.length > 100 ? _descCompletaContab.slice(0,100) + '…' : _descCompletaContab;
    const desc  = esc(_descCortaContab);
    const descFull = esc(_descCompletaContab);
    const montoHtml = m.monto > 0
      ? `<b style="color:${m.tipo==='ingreso'?'var(--verde)':'var(--rojo)'};">${m.tipo==='ingreso'?'+':'-'}$${fmt(m.monto)}</b>`
      : `<span style="color:var(--muted);">$0</span>`;
    const resp = _iniciales(m.responsable);
    return `<tr style="background:${m.monto===0?'#fff8e8':bgBody};">
      <td style="font-family:monospace;font-size:0.66rem;color:var(--muted);padding-left:14px;white-space:nowrap;">${esc(m.hora||'—')}</td>
      <td style="font-family:monospace;font-size:0.68rem;font-weight:700;white-space:nowrap;">${folioTxt}</td>
      <td style="font-size:0.8rem;font-weight:600;word-break:break-word;">${m.fuente==='recibo'?esc(m.nombre||'—'):''}</td>
      <td style="font-size:0.76rem;color:var(--muted);word-break:break-word;min-width:180px;" title="${descFull}">${desc}</td>
      <td style="white-space:nowrap;">${_badgeEstatus(m)}</td>
      <td><span class="tag ${m.fuente==='recibo'?'tag-b':'tag-v'}" style="font-size:0.52rem;">${m.fuente==='recibo'?'Recibo':'Caja'}</span></td>
      <td style="font-family:monospace;font-size:0.62rem;color:var(--muted);text-align:center;" title="${esc(m.responsable||'')}">${resp}</td>
      <td style="text-align:right;padding-right:14px;font-size:0.86rem;">${montoHtml}</td>
    </tr>`;
  }
  // ── 9. Render agrupado por AÑO → MES → DÍA ─────────────────
  // Orden cronológico DESCENDENTE en todos los niveles (año → mes → día → hora):
  // lo más reciente arriba, lo más antiguo abajo — el último movimiento
  // generado es el primero que se ve, sin tener que bajar a buscarlo.
  const aniosDesc = Object.keys(arbol).sort((a,b) => b.localeCompare(a));
  const anioHoy = new Date().getFullYear().toString();
  const mesHoy  = String(new Date().getMonth()+1).padStart(2,'0');
  const BG_HDR  = ['#e8c875','#d4b870'];
  const BG_BODY = ['#fdfaf4','#f7f3e8'];
  // Anchos fijos e IDÉNTICOS en todas las tablas de día — sin esto cada tabla de
  // día auto-calcula sus propias columnas según su propio contenido, y las
  // columnas quedan desalineadas entre un día y otro (se ve "movido"/desordenado).
  // Hora/Folio/Estado/Fuente/Por/Monto son valores cortos (badges, iniciales, horas) —
  // se les da solo el ancho que necesitan, y el espacio sobrante se reparte entre
  // Nombre y Descripción, que son las columnas con contenido real más largo.
  const _COLGROUP_CONTAB = `<colgroup>
    <col style="width:5%;"><col style="width:8%;"><col style="width:20%;">
    <col style="width:42%;"><col style="width:8%;"><col style="width:6%;">
    <col style="width:5%;"><col style="width:6%;">
  </colgroup>`;
  let granIngTotal = 0, granEgrTotal = 0;
  // ── PRE-CÁLCULO GLOBAL: saldo "EN CAJA" infinito ──
  // Usa TODOS los movimientos sin filtrar para que el acumulado cruce meses
  // y años sin reiniciarse. Solo se reinicia con un corte de caja (esCorte).
  // El cierre de caja (sin esCorte) NO afecta el acumulado.
  const _acumGlobal = {};
  {
    const _todosMovs = getAllMovs();
    const _fechasSet = new Set();
    _todosMovs.forEach(m => { if (m.fecha && m.fecha !== '—') _fechasSet.add(m.fecha); });
    (D.cierres || []).forEach(c => { if (c.fecha) _fechasSet.add(c.fecha); });
    const _todasFechasAsc = [..._fechasSet].sort();
    let _carry = 0;
    _todasFechasAsc.forEach(f => {
      const corteF = (D.cierres || []).find(c => c.fecha === f && c.esCorte);
      const _movsDia = _todosMovs.filter(m => m.fecha === f);
      if (corteF && corteF.hora) {
        // ── Día con corte: separar movimientos antes y después del corte por hora ──
        // 1. Sumar lo que había ANTES del corte
        const horaCorte = corteF.hora;
        const movsAntes  = _movsDia.filter(m => (m.hora || '00:00') <= horaCorte);
        const movsDespues = _movsDia.filter(m => (m.hora || '00:00') > horaCorte);
        const ingAntes = movsAntes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
        const egrAntes = movsAntes.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
        _carry += ingAntes - egrAntes;
        // 2. Resetear al hacer el corte
        _carry = 0;
        // 3. Sumar lo que hay DESPUÉS del corte (nueva caja)
        const ingDespues = movsDespues.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
        const egrDespues = movsDespues.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
        _carry += ingDespues - egrDespues;
      } else {
        // ── Día sin corte (o corte sin hora): comportamiento original ──
        if (corteF) _carry = 0;
        const ingF = _movsDia.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
        const egrF = _movsDia.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
        _carry += ingF - egrF;
        if (corteF) _carry = 0;
      }
      _acumGlobal[f] = _carry;
    });
  }
  const html = aniosDesc.map(anio => {
    const mesesDesc = Object.keys(arbol[anio]).sort((a,b) => b.localeCompare(a));
    let anioIng = 0, anioEgr = 0;
    const mesesHtml = mesesDesc.map(mes => {
      const diasDesc = Object.keys(arbol[anio][mes]).sort((a,b) => b.localeCompare(a));
      let mesIng = 0, mesEgr = 0;
      let di = 0; // alternating day row colors
      // acumPorDia viene del pre-cálculo global — cruza meses y años correctamente
      const diasAsc = [...diasDesc].sort();
      const acumPorDia = {};
      diasAsc.forEach(f => { acumPorDia[f] = _acumGlobal[f] !== undefined ? _acumGlobal[f] : 0; });
      const diasHtml = diasDesc.map(fecha => {
        // Movimientos del día en orden cronológico descendente por hora (el último
        // generado en el día aparece arriba, igual que el orden de días/meses/años).
        const ms = (arbol[anio][mes][fecha] || []).slice().sort((a, b) => (b.hora || '00:00').localeCompare(a.hora || '00:00'));
        const bgHdr  = BG_HDR[di % 2];
        const bgBody = BG_BODY[di % 2];
        di++;
        const ingDia = ms.filter(m => m.tipo==='ingreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
        const egrDia = ms.filter(m => m.tipo==='egreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
        const saldoDia = ingDia - egrDia;
        const acumDia  = acumPorDia[fecha] || 0;
        mesIng += ingDia; mesEgr += egrDia;
        const corte      = (D.cierres||[]).find(c => c.fecha===fecha && c.esCorte);
        const cierreNorm = (D.cierres||[]).find(c => c.fecha===fecha && !c.esCorte);
        const cierreSM   = (D.cierres||[]).find(c => c.fecha===fecha && c.sinMovimientos);
        const esDiaSinMov = ms.length === 0;
        let headerExtra = '';
        if (corte) {
          const mn = corte.saldoEntregado || corte.egresos || 0;
          headerExtra = ` &nbsp;<span style="background:linear-gradient(135deg,#0a1a3a,#1a2a5a);color:#e8c875;padding:2px 9px;border-radius:3px;font-size:0.58rem;letter-spacing:0.15em;border:1px solid #c8952a;font-weight:700;">🔒 CORTE${mn>0?' · $'+fmt(mn):''}</span>`;
        } else if (cierreNorm) {
          headerExtra = ' 🔒';
        }
        const encHdr = `<td colspan="8" style="padding:8px 14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;">
            <span style="font-family:monospace;font-size:0.66rem;font-weight:700;color:#1a1008;letter-spacing:0.1em;">
              📅 ${_fechaBonita(fecha)}${headerExtra}
            </span>
            <span style="font-family:monospace;font-size:0.58rem;color:#1a1008;opacity:0.55;">
              ${esDiaSinMov ? (cierreSM?'sin movimientos 🔒':'sin movimientos') : ms.length+' mov.'}
            </span>
          </div></td>`;
        if (esDiaSinMov) {
          const leyenda = 'SIN MOVIMIENTOS FINANCIEROS';
          return `<table class="tabla" style="margin-bottom:0;border-bottom:1px solid var(--border-l);">
            ${_COLGROUP_CONTAB}
            <thead><tr style="background:${bgHdr};">${encHdr}</tr></thead>
            <tbody><tr style="background:#fff8e8;opacity:0.75;">
              <td colspan="8" style="text-align:center;padding:12px 14px;font-size:0.76rem;color:var(--muted);font-style:italic;">${esc(leyenda)}</td>
            </tr></tbody></table>`;
        }
        const saldoColor = saldoDia<0?'#e85555':saldoDia===0?'#bbb':'#4dca6a';
        const saldoFmt   = (saldoDia<0?'-':'+')+'$'+fmt(Math.abs(saldoDia));
        return `<table class="tabla" style="margin-bottom:0;border-bottom:1px solid var(--border-l);">
          ${_COLGROUP_CONTAB}
          <thead>
            <tr style="background:${bgHdr};">${encHdr}</tr>
            <tr style="background:${bgBody};">
              <th style="font-size:0.5rem;padding-left:14px;">Hora</th>
              <th style="font-size:0.5rem;">Folio</th>
              <th style="font-size:0.5rem;">Nombre</th>
              <th style="font-size:0.5rem;">Descripción</th>
              <th style="font-size:0.5rem;">Estado</th>
              <th style="font-size:0.5rem;">Fuente</th>
              <th style="font-size:0.5rem;text-align:center;">Por</th>
              <th style="font-size:0.5rem;text-align:right;padding-right:14px;">Monto</th>
            </tr>
          </thead>
          <tbody>${ms.map(m => _fila(m, bgBody)).join('')}</tbody>
          <tfoot>
            <tr style="background:#3a4e22;">
              <td colspan="4" style="padding:8px 14px;">
                <span style="font-family:monospace;font-size:0.6rem;color:rgba(255,255,255,0.45);letter-spacing:0.08em;">EN CAJA&nbsp;</span>
                <span style="font-family:monospace;font-size:0.95rem;font-weight:800;color:${acumDia>=0?'#e8c875':'#e85555'};">$${fmt(acumDia)}</span>
                ${(D.cierres||[]).find(c=>c.fecha===fecha&&c.esCorte)?'&nbsp;<span style="font-family:JetBrains Mono,monospace;font-size:0.58rem;color:#e8c875;background:rgba(200,149,42,0.15);padding:2px 6px;border-radius:3px;border:1px solid rgba(200,149,42,0.3);">🔒 CORTE → $0</span>':''}
              </td>
              <td colspan="4" style="padding:8px 14px;text-align:right;">
                <span style="font-family:monospace;font-size:0.62rem;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:0.08em;">DÍA</span>
                &nbsp;&nbsp;
                <span style="font-family:monospace;font-size:0.76rem;font-weight:700;color:#4dca6a;">▲ $${fmt(ingDia)}</span>
                ${egrDia>0?`&nbsp;&nbsp;<span style="font-family:monospace;font-size:0.76rem;font-weight:700;color:#e85555;">▼ $${fmt(egrDia)}</span>`:''}
                &nbsp;&nbsp;
                <span style="font-family:monospace;font-size:0.76rem;font-weight:700;color:${saldoColor};">= ${saldoFmt}</span>
              </td>
            </tr>
          </tfoot>
        </table>`;
      }).join('');
      anioIng += mesIng; anioEgr += mesEgr;
      const mesNeto    = mesIng - mesEgr;
      const mesNetoFmt = (mesNeto<0?'-':'+')+'$'+fmt(Math.abs(mesNeto));
      const mesNetoClr = mesNeto<0?'var(--rojo)':mesNeto===0?'var(--muted)':'var(--verde-d)';
      // Mes abierto si es el mes actual del año actual (y no hay filtro de mes específico)
      const esActual   = (anio === anioHoy && mes === mesHoy);
      const mesId      = `cmes-${anio}-${mes}`;
      // Respetar estado manual de sesión; si no hay estado guardado, usar default (actual=abierto)
      const _mesEstadoSesion = window._contabMesesAbiertos && window._contabMesesAbiertos[mesId];
      const mesMostrar = (_mesEstadoSesion === true) ? true : (_mesEstadoSesion === false) ? false : esActual;
      return `<div style="border-bottom:2px solid var(--border);">
        <div onclick="contabToggleMes('${mesId}')" style="display:flex;align-items:center;justify-content:space-between;
          padding:10px 16px;cursor:pointer;background:var(--surface2);
          border-bottom:1px solid var(--border-l);user-select:none;transition:background 0.15s;"
          onmouseover="this.style.background='var(--gold-pale)'" onmouseout="this.style.background='var(--surface2)'">
          <div style="display:flex;align-items:center;gap:10px;">
            <span id="${mesId}-arrow" style="font-family:monospace;font-size:0.7rem;color:var(--gold-d);transition:transform 0.2s;display:inline-block;${mesMostrar?'transform:rotate(90deg)':''}">▶</span>
            <span style="font-family:serif;font-size:0.92rem;color:var(--ink);font-weight:500;">${MESES_NOMBRE[parseInt(mes)-1]} ${anio}</span>
            <span style="font-family:monospace;font-size:0.56rem;color:var(--muted);">${diasDesc.length} días</span>
          </div>
        </div>
        <div id="${mesId}" style="display:${mesMostrar?'block':'none'};">${diasHtml}</div>
      </div>`;
    }).join('');
    granIngTotal += anioIng; granEgrTotal += anioEgr;
    const anioNeto    = anioIng - anioEgr;
    const anioNetoFmt = (anioNeto<0?'-':'+')+'$'+fmt(Math.abs(anioNeto));
    const anioNetoClr = anioNeto<0?'var(--rojo)':anioNeto===0?'var(--muted)':'var(--azul)';
    // Año actual siempre abierto; los anteriores colapsados
    const esAnioActual = (anio === anioHoy);
    const anioId       = `canio-${anio}`;
    // Respetar estado manual de sesión para el año
    const _anioEstadoSesion = window._contabAniosAbiertos && window._contabAniosAbiertos[anioId];
    const anioMostrar = (_anioEstadoSesion === true) ? true : (_anioEstadoSesion === false) ? false : esAnioActual;
    // Si solo hay un año o está filtrado por año, no mostrar acordeón de año
    if (aniosDesc.length === 1 || filtroA) return mesesHtml;
    return `<div style="margin-bottom:4px;border:1px solid var(--border-l);border-radius:var(--radius);overflow:hidden;">
      <div onclick="contabToggleAnio('${anioId}')" style="display:flex;align-items:center;justify-content:space-between;
        padding:12px 18px;cursor:pointer;background:${esAnioActual?'var(--gold-bg)':'var(--surface)'};
        user-select:none;transition:background 0.15s;"
        onmouseover="this.style.background='var(--gold-bg)'" onmouseout="this.style.background='${esAnioActual?'var(--gold-bg)':'var(--surface)'}'">
        <div style="display:flex;align-items:center;gap:12px;">
          <span id="${anioId}-arrow" style="font-family:monospace;font-size:0.8rem;color:var(--gold);transition:transform 0.2s;display:inline-block;${anioMostrar?'transform:rotate(90deg)':''}">▶</span>
          <span style="font-family:serif;font-size:1.05rem;color:var(--ink);font-weight:500;">📆 ${anio}</span>
          <span style="font-family:monospace;font-size:0.56rem;color:var(--muted);">${mesesDesc.length} mes${mesesDesc.length!==1?'es':''}</span>
        </div>
      </div>
      <div id="${anioId}" style="display:${anioMostrar?'block':'none'};">${mesesHtml}</div>
    </div>`;
  }).join('');
  contenedor.innerHTML = html;
  // Gran total al pie
  if (elGT) {
    const gNeto = granIngTotal - granEgrTotal;
    const gClr  = gNeto<0?'var(--rojo)':gNeto===0?'var(--muted)':'var(--ink)';
    document.getElementById('gtIng').textContent  = '▲ $' + fmt(granIngTotal);
    document.getElementById('gtEgr').textContent  = '▼ $' + fmt(granEgrTotal);
    const gtN = document.getElementById('gtNeto');
    gtN.textContent  = (gNeto<0?'-':'') + '$' + fmt(Math.abs(gNeto));
    gtN.style.color  = gClr;
    elGT.style.display = movs.length ? 'flex' : 'none';
  }
  // ── Ventana flotante de resultados de búsqueda ───────────────────────────
  // A petición expresa: buscar por nombre/folio/descripción ya no debe
  // obligar a expandir mes por mes hasta encontrar el día correcto — cuando
  // hay texto en el buscador, se muestran TODOS los resultados en una lista
  // plana flotante encima de la vista normal (que sigue intacta debajo).
  _renderContabFlotante(movs, q);
}

async function _monRenderBitacora(){
  const body = document.getElementById('mon-body');
  if(!body) return;
  body.innerHTML = '<div style="text-align:center;padding:40px;color:#7a6840;">Cargando bitácora…</div>';
  try{
    if(!(window.SB && window.SB_DESPACHO_ID)){
      body.innerHTML = '<div style="text-align:center;padding:40px;color:#7a6840;">Sin conexión a Supabase.</div>';
      return;
    }
    const { data, error } = await window.SB.from('sesiones_log')
      .select('*')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .eq('modulo', 'contabilidad')
      .order('created_at', { ascending:false })
      .limit(50);
    if(error) throw error;
    const filas = data || [];
    if(!filas.length){
      body.innerHTML = '<div style="text-align:center;padding:40px;color:#7a6840;">Aún no hay movimientos registrados en la bitácora — esta función empezó a registrar a partir de hoy. Los movimientos de antes no tienen este dato.</div>';
      return;
    }
    let html = '<div style="font-size:0.68rem;color:#7a4040;margin-bottom:12px;">Últimos '+filas.length+' movimientos de Contabilidad — hora REAL del servidor, no la fecha que aparezca en el recibo si fue retroactivo.</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:0.72rem;">';
    html += '<thead><tr style="text-align:left;border-bottom:2px solid #e0c0c0;color:#7a4040;">'
      + '<th style="padding:6px 8px;">Hora Real</th><th style="padding:6px 8px;">Quién</th><th style="padding:6px 8px;">Acción</th>'
      + '<th style="padding:6px 8px;">Folio</th><th style="padding:6px 8px;">Monto</th><th style="padding:6px 8px;">Tipo</th>'
      + '<th style="padding:6px 8px;">¿Retroactivo?</th><th style="padding:6px 8px;">Descripción</th></tr></thead><tbody>';
    filas.forEach(function(f){
      const d = f.detalle || {};
      const horaReal = f.created_at ? new Date(f.created_at).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}) : '—';
      const accionColor = f.accion === 'eliminado' ? '#c0161a' : (f.accion === 'creado' ? '#1a7a3a' : (f.accion === 'restaurado' ? '#1a5a8c' : '#a0560a'));
      html += '<tr style="border-bottom:1px solid #f0e8e0;">'
        + '<td style="padding:6px 8px;white-space:nowrap;">'+esc(horaReal)+'</td>'
        + '<td style="padding:6px 8px;">'+esc(f.usuario||f.email||'—')+'</td>'
        + '<td style="padding:6px 8px;font-weight:700;color:'+accionColor+';">'+esc(f.accion||'—')+'</td>'
        + '<td style="padding:6px 8px;">'+(d.folio!=null ? esc(String(d.folio)+(d.letra||'')) : '—')+'</td>'
        + '<td style="padding:6px 8px;">$'+fmt(d.monto||0)+'</td>'
        + '<td style="padding:6px 8px;">'+esc(d.tipo||'—')+'</td>'
        + '<td style="padding:6px 8px;">'+(d.retroactivo ? '<span style="color:#c0161a;font-weight:700;">SÍ ('+esc(d.fecha_mov||'')+')</span>' : 'No')+'</td>'
        + '<td style="padding:6px 8px;color:#7a6840;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(d.descripcion||'')+'">'+esc((d.descripcion||'').slice(0,60))+'</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    body.innerHTML = html;
  }catch(e){
    body.innerHTML = '<div style="text-align:center;padding:40px;color:#c0161a;">Error al cargar la bitácora: '+esc(e.message||String(e))+'</div>';
  }
}

function _monRenderReconciliacion(){
  const body = document.getElementById('mon-body');
  if(!body) return;
  // Solo lo que de verdad pidió el usuario: un botón que suma y resta todo y
  // dice si cuadra (✓) o alerta la discrepancia. Se quitó la tabla mensual de
  // apoyo porque no mostraba datos reales/confiables.
  let html = '<button onclick="_monRecalcularTodo()" style="padding:10px 20px;border-radius:8px;border:none;background:#8c3a3a;color:#fff;font-weight:700;cursor:pointer;font-size:0.82rem;margin-bottom:14px;">🔄 Recalcular Todo</button>';
  html += '<div id="mon-recon-resultado" style="margin-bottom:20px;"></div>';
  body.innerHTML = html;
  _monRecalcularTodo();
}

function abrirCarpeta(idx){
  // Por defecto, esta apertura NO viene del flujo "crear carpeta al vuelo desde
  // Escritura" — ese flujo activa la bandera explícitamente justo después de
  // esta llamada. Resetearla aquí evita que quede "pegada" en true si el
  // usuario cancela ese flujo y luego crea/edita una carpeta normal.
  window._crearCarpetaOrigenEscritura = false;
  eiK=idx>=0?idx:-1;const c=idx>=0?D.carpetas[idx]:{};
  eiKNum=(idx>=0 && c && c.num)?c.num:null;
  // Mostrar el modal ANTES de calcular el alto automático de los textarea de
  // Observaciones (_kObsRender más abajo): con display:none, scrollHeight da
  // 0 y el auto-grow colapsaba cada textarea a 0px, dejando el texto (y el
  // placeholder) invisible aunque sí estuviera cargado correctamente.
  $('mCarpeta').classList.add('show');
  // Mejora: si es carpeta nueva, sugerir el siguiente número
  if (idx < 0 || idx === undefined) {
    const sugerencia = sugerirNumeroCarpeta();
    $('kNum').value = sugerencia ? String(sugerencia) : '';
  } else {
    // Al editar, mostrar solo el número sin el prefijo (CARP.- o, en carpetas
    // antiguas, ARCH-) y sin ceros a la izquierda
    const numLimpio = (c.num||'').replace('CARP.-','').replace('ARCH-','').trim().replace(/^0+(?=\d)/,'') || '';
    $('kNum').value = numLimpio;
  }
  $('kCliente').value=c.cliente||'';
  // Nueva carpeta: sugerir "ACTIVO" por defecto (queda como "activa" en los
  // contadores y filtros) en vez de dejarlo en blanco — antes una carpeta
  // recién creada sin estatus contaba como activa en la tarjeta de arriba
  // pero no aparecía al hacer clic en la pestaña "Activas" (inconsistencia).
  (function(){
    var _selEst = $('kEstatus');
    var _valEst = c.estatus||(idx<0||idx===undefined?'ACTIVO':'');
    _selEst.value = _valEst;
    // Salvaguarda: si el valor guardado no coincide con ninguna de las 4
    // opciones (ej. texto libre de antes de que este campo fuera un select),
    // no lo borremos en silencio — se agrega como opción temporal para que
    // se siga viendo y no se pierda si el usuario guarda sin tocarlo.
    if (_valEst && _selEst.value !== _valEst) {
      var _yaExiste = Array.prototype.some.call(_selEst.options, function(o){ return o.value===_valEst; });
      if (!_yaExiste) {
        var _optExtra = document.createElement('option');
        _optExtra.value = _valEst; _optExtra.textContent = _valEst + ' (texto libre anterior)';
        _selEst.insertBefore(_optExtra, _selEst.firstChild);
      }
      _selEst.value = _valEst;
    }
  })();
  // Para nueva carpeta, prellenar con fecha actual formateada (DD/MM/AAAA)
  if(idx<0 || idx===undefined){
    const hoy=new Date();
    const dd=String(hoy.getDate()).padStart(2,'0');
    const mm=String(hoy.getMonth()+1).padStart(2,'0');
    const aaaa=hoy.getFullYear();
    $('kIngreso').value=dd+'/'+mm+'/'+aaaa;
  } else {
    // Si la fecha almacenada tiene formato ISO, convertirla a DD/MM/AAAA
    let ingVal=c.ingreso||'';
    if(ingVal && /^\d{4}-\d{2}-\d{2}/.test(ingVal)){
      const parts=ingVal.substring(0,10).split('-');
      ingVal=parts[2]+'/'+parts[1]+'/'+parts[0];
    }
    $('kIngreso').value=ingVal;
  }
  $('kCelebEscritura').value=c.celebEscritura||'';
  // Observaciones: usar la lista guardada; si la carpeta es vieja y solo
  // tiene el texto legado en c.obs (o una lista sin fechas de una versión
  // anterior), migrarlo automáticamente conservando la fecha que se pueda
  // inferir (fecha de creación de la carpeta) o dejándola en blanco.
  let _kObsBase = [];
  if(Array.isArray(c.obsLista) && c.obsLista.length){
    _kObsBase = c.obsLista.map(item => (item && typeof item === 'object')
      ? { texto:String(item.texto||''), fecha:String(item.fecha||'') || _fechaCorta(c.fechaCreacion) }
      : { texto:String(item||''), fecha:_fechaCorta(c.fechaCreacion) });
  } else if(c.obs && String(c.obs).trim()!==''){
    _kObsBase = [{ texto:String(c.obs), fecha:_fechaCorta(c.fechaCreacion) }];
  }
  // La antigua "Descripción/Asunto" (campo suelto de una versión anterior)
  // pasa a ser la nota #1 — adelante de las demás — para que todo viva en
  // un solo lugar. En cuanto se guarde así, guardarCarpeta() limpia
  // c.descripcion para que no se duplique la próxima vez que se edite.
  if(c.descripcion && String(c.descripcion).trim()!==''){
    _kObsBase = [{ texto:String(c.descripcion), fecha:_fechaCorta(c.fechaCreacion) }, ..._kObsBase];
  }
  // Carpeta nueva o sin observaciones aún: deja una nota #1 vacía lista para
  // escribir; su fecha se registra sola hasta que se guarde de verdad
  // (guardarCarpeta), no al abrir el formulario.
  _kObsState = _kObsBase.length ? _kObsBase : [{ texto:'', fecha:'' }];
  _kObsRender();
  $('kReciboOficial').value=c.reciboOficial||'';
  // Tipo de trámite
  $('kTipoTramite').value=c.tipoTramite||'';
  kActualizarSubtipo();
  // Subtipos
  $('kJuicioDesc').value=c.juicioDesc||'';
  $('kEscNotario').value=c.escNotario||'';
  $('kEscVolumen').value=c.escVolumen||'';
  $('kEscInstrumento').value=c.escInstrumento||'';
  $('kEscTipo').value=c.escTipo||'';
  $('kRegCivilTipo').value=c.regCivilTipo||'';
  $('kDocDesc').value=c.docDesc||'';
  $('mKTitulo').textContent=idx>=0?'Editar Carpeta':'Nueva Carpeta';
  $('kNum').readOnly=(idx>=0);
  $('kNum').style.opacity=(idx>=0)?'0.6':'1';
  $('kNumInfo').style.display=(idx>=0)?'block':'none';
  $('kBtnElim').style.display=(idx>=0)?'flex':'none';
}

function _finResumen(nombreCliente, folioRecibo){
  const allRecibos = ((typeof appData!=='undefined' ? appData.recibos : null) || REC.recibos || []);
  // ── ARREGLO: solo vincular por folio explícito ──
  // El matching por nombre era peligroso: encontraba recibos de OTRAS personas
  // que casualmente comparten el primer nombre. Ahora solo se muestra el recibo
  // si el juicio tiene folioRecibo asignado expresamente por el usuario.
  // Las cantidades se actualizan automáticamente al leer desde appData.recibos
  // (que es la fuente viva, sincronizada con Drive).
  if (!folioRecibo) return '';
  const folioNum = parseInt(folioRecibo);
  if (isNaN(folioNum)) return '';
  const rec = allRecibos.find(r => r.folio === folioNum);
  if (!rec) {
    // Recibo vinculado pero ya no existe en el sistema (posiblemente eliminado)
    return `<div style="margin-top:7px;padding:5px 8px;background:rgba(192,22,26,0.06);border:1px solid rgba(192,22,26,0.18);border-radius:5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="font-family:monospace;font-size:0.58rem;color:#c0161a;">⚠ Recibo #${folioFormato(folioNum)} no encontrado</span>
    </div>`;
  }
  const recVinc = [rec];
  const totalCobrado  = recVinc.reduce((s,r)=>s+(parseFloat(r.anticipo)||0),0);
  const totalPendiente= recVinc.reduce((s,r)=>s+(parseFloat(r.saldoPendiente)||0),0);
  const liquidados    = recVinc.filter(r=>!(parseFloat(r.saldoPendiente)||0)).length;
  const estadoTxt   = totalPendiente > 0
    ? `<span style="color:#c0161a;font-weight:700;">$${fmt(totalPendiente)} pendiente</span>`
    : `<span style="color:var(--verde-d);font-weight:700;">✅ Liquidado</span>`;
  return `<div style="margin-top:7px;padding:5px 8px;background:rgba(26,122,58,0.04);border:1px solid rgba(26,122,58,0.12);border-radius:5px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span style="font-family:monospace;font-size:0.58rem;color:var(--verde-d);">💰 $${fmt(totalCobrado)} cobrado</span>
    ${estadoTxt}
    <span style="font-family:monospace;font-size:0.58rem;color:var(--muted);">📄 1 recibo${liquidados===1?' · liquidado':''}</span>
    <span onclick="event.stopPropagation();abrirPreviaDesdeContab(${rec.folio})" style="font-family:monospace;font-size:0.56rem;color:var(--azul);cursor:pointer;text-decoration:underline;text-underline-offset:2px;">Ver recibo #${folioFormato(rec.folio, rec.anio_folio)}</span>
  </div>`;
}

function _pendEsAdminGlobal(){
  return typeof empleadoActual!=='undefined' && empleadoActual
    && typeof ADMIN_EMAIL!=='undefined'
    && (empleadoActual.email||'').toLowerCase()===ADMIN_EMAIL.toLowerCase();
}

function _pendMarcarEnviado(idx){
  const p = D.pendientes[idx];
  if(!p) return;
  p.enviado = true;
  p.enviadoFecha = (typeof hoy==='function') ? hoy() : new Date().toISOString().slice(0,10);
  p.enviadoPor = (typeof empleadoActual!=='undefined' && empleadoActual) ? (empleadoActual.nombre||empleadoActual.email) : '';
  save();
  if(typeof syncEstadoSupabaseDebounced==='function') syncEstadoSupabaseDebounced().catch(()=>{});
  // Se reproduce la animación del avión de papel SOBRE la tarjeta (sin mover
  // ni recolorear nada de lo que ya había) y, al terminar, se vuelve a
  // renderizar para dejar fijo el ícono de "✈ Enviado" — ese sí se queda
  // estable para que cualquiera que abra la tarjeta vea que ya se envió.
  _pendAnimarEnvio(idx, function(){
    renderPend();
    if(typeof toast==='function') toast('✈ Marcado como enviado');
  });
}

function renderPend(){
  if(typeof _pendPurgarResueltosViejos==='function') _pendPurgarResueltosViejos();
  const q=($('pendQ')?.value||'').toLowerCase();
  const hoy2=hoy();
  const _esAdminPend = _pendEsAdminGlobal();
  // ── Contadores por sección (sobre pendientes ACTIVOS, para badges visuales)
  const cntSec = { placas:0, escrituras:0, juicios:0, otros:0 };
  (D.pendientes||[]).filter(p=>!p.resuelto).forEach(p=>{
    const s = _seccionDe(p);
    if (cntSec[s] !== undefined) cntSec[s]++;
  });
  const setTxt=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent = v+' activo'+(v===1?'':'s'); };
  setTxt('pend-cnt-placas',     cntSec.placas);
  setTxt('pend-cnt-escrituras', cntSec.escrituras);
  setTxt('pend-cnt-juicios',    cntSec.juicios);
  setTxt('pend-cnt-otros',      cntSec.otros);
  setTxt('pend-cnt-todas', cntSec.placas + cntSec.escrituras + cntSec.juicios + cntSec.otros);
  // ── Aplicar filtro de sección
  const baseList = (D.pendientes||[]).filter(p=>{
    if (filtroSeccion === 'todas') return true;
    // 'manual' = todo excepto placas (pendientes agregados manualmente: juicios, escrituras, otros)
    if (filtroSeccion === 'manual') return _seccionDe(p) !== 'placas';
    return _seccionDe(p) === filtroSeccion;
  });
  // Stats (respetan la sección activa)
  const total=baseList.filter(p=>!p.resuelto).length;
  const urgentes=baseList.filter(p=>!p.resuelto&&p.prioridad==='urgente').length;
  const vencidos=baseList.filter(p=>!p.resuelto&&p.fechaLimite&&p.fechaLimite<hoy2).length;
  const resueltos=baseList.filter(p=>p.resuelto).length;
  // FIX: el cuadro de total (antes solo visible/actualizado en la sección
  // Placas, mostrando "N PENDIENTES") ahora también se muestra y actualiza
  // en Pendientes generales — usa "total" (activos de la sección
  // actualmente seleccionada: Placas o Pendientes manuales) en vez de
  // fijarse siempre en cntSec.placas.
  const _badgePlacasTot = document.getElementById('pendPlacasTotalNum');
  if (_badgePlacasTot) _badgePlacasTot.textContent = total;
  // Stats row removed — always show activos only
  // Filtro de prioridad/estado
  let l=baseList.filter(p=>{
    if(filtroP==='activos')return!p.resuelto;
    if(filtroP==='resuelto')return p.resuelto;
    if(filtroP==='urgente')return!p.resuelto&&p.prioridad==='urgente';
    if(filtroP==='medio')return!p.resuelto&&p.prioridad==='medio';
    if(filtroP==='normal')return!p.resuelto&&p.prioridad==='normal';
    if(filtroP==='vencidos')return!p.resuelto&&p.fechaLimite&&p.fechaLimite<hoy2;
    return true;
  }).filter(p=>!q||(p.texto||'').toLowerCase().includes(q)||(p.obs||'').toLowerCase().includes(q)||(p.carpeta||'').includes(q)||(p.persona||'').toLowerCase().includes(q)||(p.placasNumero||'').toLowerCase().includes(q));
  const el=$('listaPend');
  if(!l.length){
    const msgSec = filtroSeccion!=='todas' ? ' en la sección "'+filtroSeccion.charAt(0).toUpperCase()+filtroSeccion.slice(1)+'"' : '';
    el.innerHTML='<div style="color:var(--muted);padding:32px;text-align:center;font-size:0.76rem;">✓ Sin pendientes en este filtro'+msgSec+'</div>';
    return;
  }
  const priColor={'urgente':'#c0161a','medio':'#b07010','normal':'#1a7a3a'};
  const priBg={'urgente':'rgba(192,22,26,0.08)','medio':'rgba(176,112,16,0.09)','normal':'rgba(26,122,58,0.08)'};
  const priDot={'urgente':'#c0161a','medio':'#d4900a','normal':'#1a9a4a'};
  // Numeración DINÁMICA de Activos (18/ago/2026, a petición del usuario —
  // reemplaza la "ficha fija" del 15-17/ago). Ya NO se guarda para siempre:
  // se recalcula en cada render como la posición por antigüedad entre los
  // pendientes ACTIVOS (no resueltos, sin contar Placas). Al resolver uno,
  // los demás se recorren solos y el hueco se cierra. Un pendiente nuevo, o
  // uno restablecido desde "Resueltos", usa como clave de orden su
  // fechaReactivacion (si existe) en vez de fechaCreacion, así que siempre
  // cae al final — el número más alto.
  const _pendNumMapa = (function(){
    const activos = (D.pendientes || []).filter(pp => pp && !pp.resuelto && !(pp.seccion==='placas'||pp.reciboVinculadoFolio));
    const orden = activos
      .map((pp,i)=>({pp,i,k: pp.fechaReactivacion || pp.fechaCreacion || ''}))
      .sort((a,b)=> a.k<b.k?-1:a.k>b.k?1:a.i-b.i);
    const mapa = new Map();
    orden.forEach((x,pos)=>{ mapa.set(x.pp, pos+1); });
    return mapa;
  })();
  // Orden de pantalla: en Activos, número descendente (el más reciente
  // arriba). En Resueltos ya no hay número — se ordenan por la fecha en que
  // se marcaron resueltos, más reciente primero.
  if (filtroP === 'resuelto') {
    l = l.slice().sort((a,b) => String(b.fechaResuelto||'').localeCompare(String(a.fechaResuelto||'')));
  } else {
    l = l.slice().sort((a,b) => (_pendNumMapa.get(b)||0) - (_pendNumMapa.get(a)||0));
  }
  el.innerHTML=l.map(p=>{
    const idx=D.pendientes.indexOf(p);
    // En Placas no se muestra: esas tarjetas ya se identifican por su folio
    // de recibo (folioBadgeHtml, más abajo). En Resueltos tampoco se muestra
    // ningún número.
    const _numAntig=(p.seccion==='placas'||p.reciboVinculadoFolio||p.resuelto) ? '' : (_pendNumMapa.get(p)||'');
    const priLabel={'urgente':'Urgente','medio':'Medio','normal':'Normal'}[p.prioridad]||p.prioridad;
    const col=priColor[p.prioridad]||'var(--muted)';
    const bg=priBg[p.prioridad]||'transparent';
    const dot=priDot[p.prioridad]||'#888';
    // Estatus por antigüedad — automático (_pendEstadoPorEdad) salvo que se
    // haya fijado a mano desde el botón "🔄 Estatus" (p.estadoManual), en
    // cuyo caso ese valor manda hasta que se regrese a "Automático".
    const _diasAbierto = _pendDiasAbierto(p, hoy2);
    const _edad = p.estadoManual ? _pendEstadoPorClave(p.estadoManual) : _pendEstadoPorEdad(_diasAbierto);
    const edadBadgeHtml = `<div title="${_diasAbierto} día${_diasAbierto===1?'':'s'} en pendiente${p.fechaCreacion?' (alta: '+esc(p.fechaCreacion)+')':''}${p.estadoManual?' · fijado a mano':''}" style="display:inline-flex;align-items:center;gap:6px;background:${_edad.bg};border:1px solid ${_edad.border};border-radius:7px;padding:6px 13px;">
      <span style="font-size:12px;">${_edad.icon}</span>
      <span style="font-size:11px;font-weight:800;color:${_edad.fg};letter-spacing:0.03em;font-family:monospace;">${_edad.label} · ${_diasAbierto}d</span>
    </div>`;
    // Botón "Enviar" (solo Placas): mientras NO se ha enviado, el admin ve
    // el botón azul con el avión para presionarlo. En cuanto se envía, ese
    // botón azul desaparece para siempre — lo que se queda fijo y visible
    // para todos es solo el dibujo del avión (sin fondo azul, sin botón),
    // igual que se ve al final de la animación.
    const _pendAvionMiniSvg = `<svg width="15" height="15" viewBox="0 0 24 24" style="flex-shrink:0;"><defs><linearGradient id="_pendPlaneGradEnv${idx}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffd166"/><stop offset="100%" stop-color="#f2994a"/></linearGradient></defs><path d="M2 12L22 2L14 22L11 14L2 12Z" fill="url(#_pendPlaneGradEnv${idx})"/></svg>`;
    let enviarBtnHtml = '';
    let enviadoImgHtml = '';
    let enviadoFechaHtml = '';
    if(p.seccion==='placas' || p.reciboVinculadoFolio){
      if(p.enviado){
        enviadoImgHtml = `<img src="data:image/png;base64,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" alt="Trámite enviado" title="${p.enviadoPor?'Enviado por '+esc(p.enviadoPor):'Enviado'}${p.enviadoFecha?' · '+esc(p.enviadoFecha):''}" style="height:100%;max-height:64px;width:auto;max-width:190px;object-fit:contain;display:block;">`;
        if(p.enviadoFecha){
          const _pendMesesEnv = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
          const _pendFEnv = String(p.enviadoFecha).split('-');
          if(_pendFEnv.length===3){
            enviadoFechaHtml = _pendFEnv[2]+'-'+(_pendMesesEnv[parseInt(_pendFEnv[1],10)-1]||'')+'-'+_pendFEnv[0];
          }
        }
      } else if(_esAdminPend){
        enviarBtnHtml = `<span onclick="event.stopPropagation();_pendMarcarEnviado(${idx})" title="Marcar como enviado (lo verán todos)" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:6px 13px;border-radius:20px;background:#0c447c;color:#fff;cursor:pointer;">✈ Enviar</span>`;
      }
    }
    let fechaHtml='';
    if(p.fechaLimite){
      let vencida=p.fechaLimite<hoy2, hoyF=p.fechaLimite===hoy2;
      let fclr=vencida?'#c0161a':hoyF?'#b07010':'var(--muted)';
      let ficon=vencida?'⚠':'📅'; let flbl=vencida?('Vencido '+p.fechaLimite):hoyF?'Hoy':p.fechaLimite;
      fechaHtml=`<span style="font-size:0.65rem;color:${fclr};font-family:monospace;">${ficon} ${flbl}</span>`;
    }
    const altaHtml=p.fechaCreacion?`<span style="font-size:0.63rem;color:var(--muted);font-family:monospace;">Alta: ${p.fechaCreacion}</span>`:'';
    const carpHtml=p.carpeta?`<span style="font-size:0.63rem;background:rgba(200,149,42,0.1);color:var(--gold-d);border-radius:3px;padding:1px 5px;">🗂 #${esc(p.carpeta)}</span>`:'';
    const catHtml=p.categoria?`<span style="font-size:0.63rem;background:rgba(100,100,200,0.08);color:#446;border-radius:3px;padding:1px 5px;">${esc(p.categoria)}</span>`:'';
    // ── Ficha grande y clicable del folio vinculado (solo pendientes de Placas) ──
    // Reemplaza el pill de prioridad + los botones Estatus/Consultar recibo:
    // un solo badge grande con el folio real (folio+letra) que al hacer clic
    // abre directo la ficha correspondiente.
    let folioBadgeHtml = '';
    if (p.reciboVinculadoFolio) {
      const _recVinc = (typeof appData!=='undefined' && Array.isArray(appData.recibos))
        ? appData.recibos.find(function(r){ return r && Number(r.folio)===Number(p.reciboVinculadoFolio); })
        : null;
      const _letraVinc = (_recVinc && _recVinc.letra) || 'A';
      const _strVinc = (typeof folioConLetra==='function')
        ? folioConLetra(p.reciboVinculadoFolio, _recVinc && _recVinc.anio_folio, _letraVinc)
        : (p.reciboVinculadoFolio + _letraVinc);
      folioBadgeHtml = `<div onclick="event.stopPropagation();abrirFichaDesdeContab(${p.reciboVinculadoFolio})" title="Abrir ficha del folio" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;background:transparent;padding:2px 6px;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
        <span style="font-size:8px;font-weight:700;color:#8c6518;letter-spacing:0.12em;">FOLIO</span>
        <span style="font-size:1.2rem;font-weight:800;color:#1a4a8a;line-height:1.15;font-family:monospace;">${esc(_strVinc)}</span>
      </div>`;
    }
    // Sección — solo se muestra el chip cuando estamos en vista "todas" (en otras vistas la sección ya es la del filtro)
    const _secInfo = { placas:{ico:'🚗',lbl:'Placas',c:'#1a4a8a',bg:'rgba(26,74,138,0.1)'}, escrituras:{ico:'📄',lbl:'Escrituras',c:'#7a4a00',bg:'rgba(122,74,0,0.08)'}, juicios:{ico:'⚖️',lbl:'Juicios',c:'#5a1a6a',bg:'rgba(90,26,106,0.1)'}, otros:{ico:'🗂',lbl:'Otros',c:'#555',bg:'rgba(0,0,0,0.05)'} };
    const _secAct = _seccionDe(p);
    const secHtml = (filtroSeccion === 'todas' && _secInfo[_secAct]) ? `<span style="font-size:0.63rem;background:${_secInfo[_secAct].bg};color:${_secInfo[_secAct].c};border-radius:3px;padding:1px 6px;font-weight:700;">${_secInfo[_secAct].ico} ${_secInfo[_secAct].lbl}</span>` : '';
    // ── INFO ESPECÍFICA DE PLACAS ─────────────────────────────────
    let placasInfoHtml = '';
    if (_secAct === 'placas') {
      const _tipoLbl = {
        'alta':               'Alta',
        'baja':               'Baja',
        'cambio_propietario': 'Cambio prop.',
        'tarjeta_circulacion':'Tarjeta circ.',
        'reemplacamiento':    'Reemplacamiento'
      };
      const chips = [];
      if (_tipoLbl[p.tipoVehicular]) chips.push(`<span style="font-size:9.5px;background:rgba(26,74,138,0.1);color:#0c447c;border-radius:3px;padding:1px 6px;font-family:monospace;font-weight:700;">🚗 ${_tipoLbl[p.tipoVehicular]}</span>`);
      if (p.placasEstado)     chips.push(`<span style="font-size:9.5px;background:#f1efe8;color:#444441;border-radius:3px;padding:1px 6px;font-family:monospace;">📍 ${esc(p.placasEstado)}</span>`);
      if (p.placasNumero)     chips.push(`<span style="font-size:9.5px;background:#faeeda;color:#633806;border-radius:3px;padding:1px 6px;font-family:monospace;font-weight:700;"># ${esc(p.placasNumero)}</span>`);
      if (p.reciboVinculadoFolio) chips.push(`<span style="font-size:9.5px;background:rgba(26,122,58,0.08);color:#27500a;border-radius:3px;padding:1px 6px;font-family:monospace;cursor:pointer;" onclick="event.stopPropagation();_irAReciboVinculado('${esc(String(p.reciboVinculadoFolio))}')" title="Abrir recibo">🧾 #${esc(folioFormato(p.reciboVinculadoFolio))}</span>`);
      if (p.vehMarca||p.vehClase) chips.push(`<span style="font-size:9.5px;background:#f1efe8;color:#444441;border-radius:3px;padding:1px 6px;font-family:monospace;">${esc(((p.vehMarca||'')+' '+(p.vehClase||'')).trim())}</span>`);
      // Badge estatus de carpeta vinculada en Drive (expediente digital) —
      // igual que en _expDigRenderStatus, si ya hay algún documento con
      // driveFileId (subido antes de que existiera el marcado automático),
      // se considera vinculado de facto aunque estatusGestion no lo diga.
      const docsArr = p.documentos||[];
      const _yaVinculado = p.estatusGestion === 'vinculado' || p.estatusGestion === 'enviado' || docsArr.some(d=>d&&d.driveFileId);
      if (_yaVinculado) {
        chips.push(`<span style="font-size:9.5px;background:#d4f5e0;border:1px solid #2a9a50;color:#0a4020;border-radius:10px;padding:2px 8px;font-family:monospace;font-weight:700;">✅ CARPETA VINCULADA${p.expDigitalFechaEnvio?' · '+p.expDigitalFechaEnvio:''}</span>`);
      } else {
        chips.push(`<span style="font-size:9.5px;background:#fff3e0;border:1px solid #c8952a;color:#7a4010;border-radius:10px;padding:2px 8px;font-family:monospace;font-weight:700;">⏳ SIN VINCULAR</span>`);
      }
      const docsHtml = docsArr.map((d,di)=>{
        const nm=d.nombre||d||'doc'; const lbl=nm.length>18?nm.substring(0,18)+'…':nm;
        const st=_docEstilo(nm, d && d.tipo);
        return `<span style="font-size:9.5px;background:${st.bg};border:1px solid ${st.borde};border-radius:4px;padding:2px 7px;color:${st.texto};cursor:pointer;display:inline-flex;align-items:center;gap:3px;" onclick="event.stopPropagation();_placasVerDocFromCard(${idx},${di})" title="${esc(nm)}">${st.icono} ${esc(lbl)}</span>`;
      }).join('');
      const adjuntarBtn = `<span id="placas-adj-btn-${idx}" style="font-size:11px;border:1.5px solid #a07848;border-radius:4px;padding:3px 10px;color:#fff;background:#c4955a;cursor:pointer;display:inline-flex;align-items:center;gap:3px;font-weight:600;" onclick="event.stopPropagation();_placasAdjuntarDoc(${idx})">+ Adjuntar</span>`;
      placasInfoHtml = `<div style="margin-top:6px;">${chips.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px;">${chips.join('')}</div>`:''}<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;align-items:center;"><span style="font-size:9px;font-family:monospace;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8c6518;margin-right:2px;">Docs:</span>${docsHtml}${adjuntarBtn}</div></div>`;
    }
    // ── INFO ESPECÍFICA DE ESCRITURAS ─────────────────────────────
    let escInfoHtml = '';
    if (_secAct === 'escrituras' && (p.escComprador || p.escEtapa || (p.escDocumentos||[]).length)) {
      const _etapaLbl = {
        'firma_libro_notario':       { ico:'📝', txt:'Firma libro Notario' },
        'tramite_catastro':          { ico:'🏛', txt:'Trámite catastro'   },
        'pago_traslado_municipal':   { ico:'💰', txt:'Pago traslado mun.' },
        'pago_isr':                  { ico:'📋', txt:'Pago ISR'           },
        'registro_publico_propiedad':{ ico:'🏠', txt:'Registro propiedad' },
        'en_notaria':                { ico:'🔏', txt:'En Notaría'         },
        'esperando_cedula':          { ico:'📄', txt:'Esperando cédula'   },
        'listo_para_entregar':       { ico:'✅', txt:'Listo para entregar' }
      };
      const e = _etapaLbl[p.escEtapa];
      const etapaChip = e ? `<span style="font-size:0.63rem;background:rgba(122,74,0,0.12);color:#7a4a00;border-radius:3px;padding:2px 7px;font-weight:700;">${e.ico} ${e.txt}</span>` : '';
      const compradorChip = p.escComprador ? `<span style="font-size:0.63rem;background:rgba(122,74,0,0.06);color:#7a4a00;border-radius:3px;padding:2px 6px;">🛒 ${esc(p.escComprador)}</span>` : '';
      const vendedorChip  = p.escVendedor ? `<span style="font-size:0.63rem;background:rgba(122,74,0,0.06);color:#7a4a00;border-radius:3px;padding:2px 6px;">📤 ${esc(p.escVendedor)}</span>` : '';
      const archivoChip = p.escArchivoFisico ? `<span style="font-size:0.63rem;background:rgba(0,0,0,0.05);color:var(--ink);border-radius:3px;padding:2px 6px;font-family:monospace;">📁 ${esc(p.escArchivoFisico)}</span>` : '';
      const folioChip = p.escFolio ? `<span style="font-size:0.63rem;background:rgba(200,149,42,0.13);color:#8c6518;border-radius:3px;padding:2px 6px;font-family:monospace;font-weight:700;">🔖 ${esc(p.escFolio)}</span>` : '';
      const volInsChip = (p.escVolumen || p.escInstrumento) ? `<span style="font-size:0.63rem;background:rgba(0,0,0,0.05);color:var(--ink);border-radius:3px;padding:2px 6px;font-family:monospace;">📚 V${esc(p.escVolumen||'—')} · I${esc(p.escInstrumento||'—')}</span>` : '';
      const notariaChip = p.escNotaria ? `<span style="font-size:0.63rem;background:rgba(0,0,0,0.04);color:var(--muted);border-radius:3px;padding:2px 6px;">🔏 ${esc(p.escNotaria.length>30 ? p.escNotaria.substring(0,30)+'…' : p.escNotaria)}</span>` : '';
      const docsChip = (p.escDocumentos||[]).length ? `<span style="font-size:0.63rem;background:rgba(122,74,0,0.08);color:#7a4a00;border-radius:3px;padding:2px 6px;cursor:pointer;" onclick="event.stopPropagation();abrirPendiente(${idx})" title="Ver documentos">📎 ${(p.escDocumentos||[]).length} archivo${(p.escDocumentos||[]).length===1?'':'s'}</span>` : '';
      // Financiero
      const costo = parseFloat(p.escCosto)||0;
      const cobrado = parseFloat(p.escCobrado)||0;
      const resto = costo > 0 ? (costo - cobrado) : null;
      let finRow = '';
      if (costo > 0) {
        const restoColor = resto <= 0 ? '#1a7a3a' : '#c0161a';
        const restoTxt = resto <= 0 ? '✅ LIQUIDADO' : `$${resto.toFixed(2)}`;
        finRow = `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;align-items:center;">
          <span style="font-size:0.63rem;background:rgba(26,122,58,0.08);color:#1a7a3a;border-radius:3px;padding:2px 7px;">💵 Total: $${costo.toFixed(2)}</span>
          <span style="font-size:0.63rem;background:rgba(26,122,58,0.06);color:#1a7a3a;border-radius:3px;padding:2px 6px;">✅ Cobrado: $${cobrado.toFixed(2)}</span>
          <span style="font-size:0.63rem;background:rgba(192,22,26,0.07);color:${restoColor};border-radius:3px;padding:2px 6px;font-weight:700;">⏳ Resta: ${restoTxt}</span>
          ${p.escServiciosComp ? `<span style="font-size:0.63rem;background:rgba(0,0,0,0.04);color:var(--muted);border-radius:3px;padding:2px 6px;">🔧 ${esc(p.escServiciosComp)}</span>` : ''}
        </div>`;
      }
      const descripcionLine = p.escDescripcion ? `<div style="font-size:0.74rem;color:var(--ink);margin-top:5px;line-height:1.45;">${esc(p.escDescripcion)}</div>` : '';
      const siguientePasoLine = p.escSiguientePaso ? `<div style="font-size:0.73rem;margin-top:6px;padding:6px 9px;background:rgba(200,149,42,0.08);border-left:3px solid var(--gold);border-radius:0 5px 5px 0;line-height:1.45;color:#6a4a00;"><strong style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;font-family:monospace;color:#8c6518;">🧭 Siguiente paso:</strong><br>${esc(p.escSiguientePaso)}</div>` : '';
      escInfoHtml = `<div style="background:rgba(122,74,0,0.04);border:1px solid rgba(122,74,0,0.12);border-radius:6px;padding:8px 10px;margin-top:7px;">
        <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">${etapaChip}${compradorChip}${vendedorChip}${archivoChip}${folioChip}${volInsChip}${notariaChip}${docsChip}</div>
        ${finRow}
        ${descripcionLine}
        ${siguientePasoLine}
      </div>`;
    }
    // ── INFO ESPECÍFICA DE JUICIOS ────────────────────────────────
    let juiInfoHtml = '';
    if (_secAct === 'juicios' && (p.juiCliente || p.juiExpediente || p.juiEtapa)) {
      const expChip = p.juiExpediente ? `<span style="font-size:0.63rem;background:rgba(90,26,106,0.12);color:#5a1a6a;border-radius:3px;padding:2px 7px;font-weight:700;font-family:monospace;">⚖️ ${esc(p.juiExpediente)}</span>` : '';
      const tipoChip = p.juiTipo ? `<span style="font-size:0.63rem;background:rgba(90,26,106,0.06);color:#5a1a6a;border-radius:3px;padding:2px 6px;">${esc(p.juiTipo)}</span>` : '';
      const etapaChip = p.juiEtapa ? `<span style="font-size:0.63rem;background:rgba(0,0,0,0.05);color:var(--ink);border-radius:3px;padding:2px 6px;">📊 ${esc(p.juiEtapa)}</span>` : '';
      const terminoChip = p.juiTermino ? `<span style="font-size:0.63rem;background:rgba(192,22,26,0.08);color:var(--rojo);border-radius:3px;padding:2px 6px;">⏰ ${esc(p.juiTermino)}</span>` : '';
      let audChip = '';
      if (p.juiAudiencia) {
        const audDate = String(p.juiAudiencia).replace('T',' ').substring(0,16);
        audChip = `<span style="font-size:0.63rem;background:rgba(176,112,16,0.08);color:#b07010;border-radius:3px;padding:2px 6px;font-family:monospace;">📅 ${esc(audDate)}</span>`;
      }
      const vincChip = (typeof p.juicioVinculadoIdx === 'number' && p.juicioVinculadoIdx >= 0) ? `<span style="font-size:0.63rem;background:rgba(26,122,58,0.08);color:var(--verde-d);border-radius:3px;padding:2px 6px;cursor:pointer;font-weight:700;" onclick="event.stopPropagation();_irAJuicio(${p.juicioVinculadoIdx})" title="Abrir en Juicios">🔗 Juicios</span>` : '';
      const descripcionLine = p.juiDescripcion ? `<div style="font-size:0.74rem;color:var(--ink);margin-top:4px;line-height:1.45;">${esc(p.juiDescripcion)}</div>` : '';
      juiInfoHtml = `<div style="background:rgba(90,26,106,0.04);border:1px solid rgba(90,26,106,0.12);border-radius:6px;padding:7px 10px;margin-top:7px;">
        <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">${expChip}${tipoChip}${etapaChip}${terminoChip}${audChip}${vincChip}</div>
        ${descripcionLine}
      </div>`;
    }
    return `<div data-pend-idx="${idx}" style="position:relative;display:flex;align-items:stretch;background:var(--surface,#fdfaf4);border:1.5px solid var(--border-l,#d4b870);border-radius:8px;margin-bottom:8px;overflow:visible;opacity:${p.resuelto?'0.5':'1'};${p.resuelto?'filter:grayscale(0.3);':''}transition:box-shadow 0.15s,border-color 0.15s;">
      <div style="width:5px;background:${col};flex-shrink:0;border-radius:8px 0 0 8px;"></div>
      <div style="padding:10px 5px 10px 8px;display:flex;align-items:flex-start;padding-top:12px;flex-shrink:0;">
        ${(p.seccion==='placas'||p.reciboVinculadoFolio)?'':`<div onclick="event.stopPropagation();toggleP(${idx})" title="${p.resuelto?'Reabrir':'Marcar resuelto'}" style="width:18px;height:18px;border-radius:50%;border:2px solid ${p.resuelto?'#1a7a3a':col};background:${p.resuelto?'#1a7a3a':'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:#fff;font-size:0.65rem;transition:all 0.15s;">${p.resuelto?'✓':''}</div>`}
      </div>
      <div style="flex:1;min-width:0;padding:10px 6px 10px 4px;">
        ${(_numAntig||p.persona)?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
          ${_numAntig?`<div title="N° de ficha — posición entre los pendientes activos, se recalcula solo" style="display:flex;flex-direction:column;align-items:center;line-height:1.05;flex-shrink:0;">
            <span style="color:#a8987a;font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Pendiente</span>
            <span style="color:#8c6518;font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:900;">${_numAntig}</span>
          </div>`:''}
          ${p.persona?`<div style="font-size:${(p.seccion==='placas'||p.reciboVinculadoFolio)?'14.5px':'13.5px'};font-weight:600;color:${col};font-family:'Outfit',sans-serif;letter-spacing:0.025em;text-transform:uppercase;opacity:0.92;">👤 ${esc(p.persona)}</div>`:''}
        </div>`:''}
        <div style="font-size:12.5px;font-weight:600;color:var(--ink,#1a1008);line-height:1.4;margin-bottom:5px;${p.resuelto?'text-decoration:line-through;':''}">${esc(p.texto)}</div>
        ${placasInfoHtml}
        ${escInfoHtml}
        ${juiInfoHtml}
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;align-items:center;">
          ${secHtml}${fechaHtml}${carpHtml}${catHtml}
        </div>
        ${p.obs?`<div style="font-size:10px;color:#7a4a10;font-style:italic;margin-top:4px;padding:4px 8px;background:rgba(200,149,42,0.07);border-radius:4px;line-height:1.4;">${esc(p.obs)}</div>`:''}
        ${p.creadoPor?`<div style="font-size:8.5px;color:#9a8a6a;margin-top:5px;padding-top:4px;border-top:1px dashed rgba(0,0,0,0.08);">📤 Subido por: <strong style="color:#6a5a3a;">${esc(p.creadoPor)}</strong>${p.fechaCreacion?` · ${esc(p.fechaCreacion)}`:''}</div>`:''}
        ${p.persona?_finResumen(p.persona, null):''}
      </div>
      ${enviadoImgHtml ? `<div style="display:flex;align-items:center;justify-content:center;padding:6px 8px;flex-shrink:0;align-self:stretch;"><div style="position:relative;display:inline-flex;">${enviadoImgHtml}${enviadoFechaHtml ? `<div style="position:absolute;top:74%;left:35%;font-family:monospace;font-size:0.58rem;font-weight:700;color:#8c6518;letter-spacing:0.03em;white-space:nowrap;">${enviadoFechaHtml}</div>` : ''}</div></div>` : ''}
      <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;padding:10px 10px 10px 4px;flex-shrink:0;gap:5px;">
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          ${(p.seccion==='placas'||p.reciboVinculadoFolio) ? folioBadgeHtml : ''}
          <div style="display:flex;align-items:center;gap:6px;">
            ${enviarBtnHtml}
            ${edadBadgeHtml}
          </div>
        </div>
        <div style="display:flex;gap:4px;">
          ${(p.resuelto&&!(p.seccion==='placas'||p.reciboVinculadoFolio))?`<button onclick="event.stopPropagation();toggleP(${idx})" style="display:flex;align-items:center;gap:3px;background:rgba(26,122,58,0.08);border:1px solid #1a7a3a;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:9.5px;font-weight:700;color:#1a7a3a;transition:background 0.15s;" onmouseover="this.style.background='rgba(26,122,58,0.16)'" onmouseout="this.style.background='rgba(26,122,58,0.08)'" title="Regresar a Activos">↩️ Restablecer</button>`:''}
          ${(p.seccion==='placas'||p.reciboVinculadoFolio)?'':`<button onclick="event.stopPropagation();_pendEstatus(${idx},this)" style="display:flex;align-items:center;gap:3px;background:transparent;border:1px solid #b5d4f4;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:9.5px;color:#1a4a8a;transition:background 0.15s;" onmouseover="this.style.background='#e6f1fb'" onmouseout="this.style.background='transparent'" title="Cambiar estatus">🔄 Estatus</button>
          <button onclick="event.stopPropagation();abrirPendiente(${idx})" style="display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid var(--border-l,#d4b870);border-radius:5px;padding:3px 7px;cursor:pointer;font-size:9.5px;color:var(--muted);transition:all 0.15s;" onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold)'" onmouseout="this.style.borderColor='var(--border-l,#d4b870)';this.style.color='var(--muted)'" title="Editar">✏</button>`}
        </div>
      </div>
    </div>`;
  }).join('');
  // Espejo hacia la pestaña "Notas y Recordatorios" del expediente abierto en
  // Juicios (si está abierto) — mismo dato, dos vistas.
  try{
    if(typeof _juRenderNotas === 'function' && document.getElementById('mexp-notas-lista') && window._mexpIdxActual >= 0){
      _juRenderNotas(window._mexpIdxActual);
    }
  }catch(e){}
}

function _placasAdjuntarDoc(idx){
  let p=D.pendientes[idx];if(!p)return;
  const pendId = p.id || null;
  // FIX: los fetch a Drive (token, carpeta, subida) no tenían timeout — si
  // el Worker o Google tardaban en responder, el botón se quedaba "colgado"
  // indefinidamente y el usuario terminaba dando clic varias veces
  // (apilando intentos concurrentes) sin que nada terminara. Ahora cada
  // llamada de red tiene límite de tiempo, hay 1 reintento por archivo antes
  // de rendirse, las carpetas de Drive se cachean en memoria (no se buscan
  // de nuevo en cada adjunto), los archivos se suben en paralelo, y el botón
  // muestra en vivo que está trabajando (y no se puede volver a pulsar).
  const claveSub = pendId || ('idx:'+idx);
  if(window._placasSubiendo && window._placasSubiendo[claveSub]){
    toast('Ya se está subiendo un archivo para este pendiente, espera a que termine.','err');
    return;
  }
  const inp=document.createElement('input');
  inp.type='file';inp.accept='.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';inp.multiple=true;
  // FIX CRÍTICO: el input NO estaba insertado en el documento. Un <input
  // type="file"> suelto puede ser recolectado por el navegador mientras el
  // explorador de archivos sigue abierto, y entonces su evento "change" NUNCA
  // se dispara: el usuario elige el archivo y, literalmente, no ocurre nada
  // (ni mensaje, ni subida). Insertándolo oculto en el DOM el evento siempre
  // llega; se retira al terminar.
  inp.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;';
  document.body.appendChild(inp);
  const _quitarInput = function(){ try{ inp.remove(); }catch(e){} };
  // Si el usuario cancela el explorador, "change" no se dispara — se limpia el
  // input igualmente para no dejar basura acumulada en el documento.
  window.addEventListener('focus', function _limpiar(){
    setTimeout(function(){
      if(!inp.files || !inp.files.length) _quitarInput();
      window.removeEventListener('focus', _limpiar);
    }, 800);
  });
  inp.onchange=async function(){
    if(!inp.files||!inp.files.length){ _quitarInput(); return; }
    // Reubicar el pendiente AHORA (ver comentario de _placasResolverPend).
    p = _placasResolverPend(pendId, idx) || p;
    if(!p){
      toast('No se encontró el pendiente (¿se actualizó la lista?). Vuelve a intentar.','err');
      _quitarInput(); return;
    }
    if(!p.documentos)p.documentos=[];
    if(!window._placasSubiendo) window._placasSubiendo={};
    window._placasSubiendo[claveSub]=true;
    _placasAdjBtnEstado(idx,'subiendo');
    // Tope real de Drive para este flujo. Antes eran 10 MB fijos, lo que
    // rechazaba documentos normales de trámite (un PDF escaneado pasa de 30 MB
    // sin problema). Con subida resumible sí se pueden mandar completos.
    const MAX_BYTES = 200 * 1024 * 1024;
    // Sin Drive el archivo se guarda como respaldo local dentro del estado
    // sincronizado; ahí sí hay que ser estrictos o se infla la base de datos.
    const MAX_BYTES_LOCAL = 8 * 1024 * 1024;
    const _mb = function(b){ return (b/1024/1024).toFixed(1)+' MB'; };
    const TIPOS_VALIDOS = ['image/png','image/jpeg','image/jpg','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const EXT_VALIDAS = ['.pdf','.jpg','.jpeg','.png','.webp','.doc','.docx'];
    const _extValida = function(nombre){
      const n = (nombre||'').toLowerCase();
      return EXT_VALIDAS.some(function(ext){ return n.endsWith(ext); });
    };
    const todos = Array.from(inp.files);
    // Validar tamaño/tipo ANTES de tocar la red — así los rechazos se saben
    // al instante, sin esperar a que termine ningún intento de subida.
    const archivos = [], rechazadosInicio = [];
    todos.forEach(function(file){
      if(file.size > MAX_BYTES){ rechazadosInicio.push(file.name+' ('+_mb(file.size)+', máximo 200 MB)'); return; }
      if(!TIPOS_VALIDOS.includes(file.type) && !_extValida(file.name)){ rechazadosInicio.push(file.name+' (tipo no válido)'); return; }
      archivos.push(file);
    });
    if(!archivos.length){
      toast('Ningún archivo válido: '+rechazadosInicio.join(', '), 'err');
      window._placasSubiendo[claveSub]=false; _placasAdjBtnEstado(idx,'normal');
      _quitarInput();
      return;
    }
    toast('Subiendo '+archivos.length+' archivo(s)...','ok');
    _placasProgreso('⏳ Subiendo '+archivos.length+' archivo(s)… no cierres esta ventana');
    try{
      // Resolver token y carpeta de Drive UNA sola vez para todo el lote,
      // reutilizando la carpeta del cliente si ya se resolvió antes en esta
      // sesión (caché en memoria). Cada paso con timeout de 10s.
      let token = '', carpetaCliente = '';
      const nombreCliente = (p.persona||p.nombre||'cliente').replace(/[^a-zA-Z0-9_\- ]/g,'_').substring(0,50);
      const cacheKey = 'Placas/'+nombreCliente;
      try{
        token = typeof driveGetAccessToken==='function' ? await _sbConTimeout(driveGetAccessToken(), 10000, 'Drive token') : '';
        if(token){
          if(window._driveFolderCache[cacheKey]){
            carpetaCliente = window._driveFolderCache[cacheKey];
          } else {
            const DRIVE_ROOT = '1TtVVL0Jbw6BFkwLw8Wo1LZfxLN0I_ndU';
            const carpetaPlacas = window._driveFolderCache['Placas'] ||
              await _sbConTimeout(driveObtenerOCrearCarpeta(token,'Placas',DRIVE_ROOT), 10000, 'Drive carpeta Placas');
            window._driveFolderCache['Placas'] = carpetaPlacas;
            carpetaCliente = await _sbConTimeout(driveObtenerOCrearCarpeta(token, nombreCliente, carpetaPlacas), 10000, 'Drive carpeta cliente');
            window._driveFolderCache[cacheKey] = carpetaCliente;
          }
        }
      }catch(e){
        console.warn('[Drive placas] preparación de carpeta falló o tardó demasiado, se usará respaldo base64:', e);
        if(typeof registrarError === 'function') registrarError('Placas · carpeta de Drive', e,
          { cliente:nombreCliente, paso:'obtener token / crear carpeta' });
        token=''; carpetaCliente='';
      }
      // Si Drive no está disponible se avisa EXPLÍCITAMENTE: antes el archivo
      // se guardaba solo en el respaldo local y el usuario lo daba por subido
      // a Drive ("no queda en Drive en ningún lugar").
      if(!token || !carpetaCliente){
        console.warn('[Drive placas] sin acceso a Drive — token:', !!token, 'carpeta:', !!carpetaCliente);
        if(typeof registrarError === 'function') registrarError('Placas · Drive no disponible',
          new Error('Se adjuntará solo como respaldo local: '+(!token ? 'no se obtuvo el token de Drive' : 'no se pudo resolver la carpeta del cliente')),
          { cliente:nombreCliente, token:!!token, carpeta:!!carpetaCliente });
        _placasProgreso('⚠️ Sin conexión con Drive — guardando respaldo local…');
      }

      // ── PASO 1: revisar duplicados y decidir, ANTES de subir nada ─────────
      // Se hace en secuencia (no en paralelo) porque cada duplicado abre un
      // diálogo y no tiene sentido apilar varios al mismo tiempo en pantalla.
      const plan = [];
      let cancelados = [];
      for(const file of archivos){
        const nombreLimpio = _placasNombreLimpio(file.name);
        let decision = { file, nombre: nombreLimpio, reemplazarId: null };
        if(token && carpetaCliente){
          const existente = await _placasBuscarEnDrive(nombreLimpio, token, carpetaCliente);
          if(existente){
            const op = await _placasPreguntarDuplicado(nombreLimpio, nombreCliente);
            if(op === 'cancelar'){ cancelados.push(nombreLimpio); continue; }
            if(op === 'reemplazar') decision.reemplazarId = existente.id;
            else decision.nombre = await _placasNombreCopiaLibre(nombreLimpio, token, carpetaCliente);
          }
        }
        plan.push(decision);
      }
      if(!plan.length){
        toast(cancelados.length ? 'No se subió nada — cancelaste ' + cancelados.length + ' archivo(s) duplicado(s)' : 'No hay archivos que subir', 'ok');
        return;
      }
      // ── PASO 2: subir EN PARALELO lo que quedó aprobado ───────────────────
      let _hechos = 0;
      const _totalPlan = plan.length;
      const _etiquetaLote = function(){ return _totalPlan>1 ? ' ('+_hechos+' de '+_totalPlan+' listos)' : ''; };
      const resultados = await Promise.all(plan.map(async function(d){
        const file = d.file;
        let _res = null;
        if(token && carpetaCliente){
          const _nomCorto = (d.nombre||file.name).length > 28 ? (d.nombre||file.name).slice(0,28)+'…' : (d.nombre||file.name);
          const r = await _placasSubirArchivoDrive(file, token, carpetaCliente, d.nombre, d.reemplazarId, function(pct){
            _placasProgreso('⏳ Subiendo '+_nomCorto+' — '+pct+'%'+_etiquetaLote());
          });
          if(r) _res = { file, ok:true, drive:true, driveFileId:r.id, nombreArchivo:r.nombreArchivo, reemplazo:!!d.reemplazarId };
        }
        if(!_res){
          // Respaldo base64 solo si el archivo es razonablemente chico: meter
          // decenas de MB en el estado sincronizado rompería la base de datos.
          if(file.size > MAX_BYTES_LOCAL){
            console.error('[Placas] Drive falló y el archivo es demasiado grande para respaldo local:', file.name, file.size);
            _res = { file, ok:false, motivo:'Drive no aceptó el archivo y pesa demasiado ('+_mb(file.size)+') para guardarlo localmente' };
          } else {
            try{
              const dataURL = await _placasLeerBase64(file);
              _res = { file, ok:true, drive:false, base64:dataURL, nombreArchivo:d.nombre };
            }catch(e){
              console.error('[Placas] fallo total al adjuntar '+file.name+':', e);
              _res = { file, ok:false };
            }
          }
        }
        _hechos++;
        return _res;
      }));
      _placasProgreso('💾 Guardando…');

      // Reubicar el pendiente OTRA VEZ justo antes de escribir: la subida pudo
      // durar varios segundos y una sincronización de fondo pudo reemplazar
      // D.pendientes en ese lapso (si se escribiera sobre la referencia vieja,
      // los documentos se perderían al guardar).
      const _pFresco = _placasResolverPend(pendId, idx);
      if(_pFresco && _pFresco !== p){
        if(!_pFresco.documentos) _pFresco.documentos = [];
        p = _pFresco;
      }

      let agregados=0, drive=0, base64=0, reemplazos=0;
      resultados.forEach(function(r){
        if(!r.ok) return;
        if(r.drive){
          // Si fue un REEMPLAZO, no se agrega otro renglón a la lista de
          // documentos: se actualiza el que ya estaba (mismo archivo en Drive).
          if(r.reemplazo){
            const yaEsta = (p.documentos||[]).find(function(d){
              return d && (d.driveFileId === r.driveFileId ||
                (d.drivePath||'').endsWith('/'+r.nombreArchivo));
            });
            if(yaEsta){
              yaEsta.nombre = r.nombreArchivo;
              yaEsta.tipo = r.file.type;
              yaEsta.driveFileId = r.driveFileId;
              yaEsta.drivePath = 'Placas/'+nombreCliente+'/'+r.nombreArchivo;
              reemplazos++; agregados++; drive++;
              return;
            }
          }
          // Se guarda el tamaño (bytes) para que el visor pueda mostrar el
          // porcentaje de carga sin tener que preguntárselo a Drive cada vez.
          p.documentos.push({nombre:r.nombreArchivo,tipo:r.file.type,bytes:r.file.size,driveFileId:r.driveFileId,drivePath:'Placas/'+nombreCliente+'/'+r.nombreArchivo});
          drive++;
        } else {
          p.documentos.push({nombre:r.nombreArchivo||r.file.name,tipo:r.file.type,base64:r.base64});
          base64++;
        }
        agregados++;
      });
      const fallidos = resultados.filter(function(r){ return !r.ok; }).map(function(r){
        return r.file.name + (r.motivo ? ' — ' + r.motivo : '');
      });

      if(drive>0 && p.reciboVinculadoFolio) _marcarExpDigitalVinculado(p.reciboVinculadoFolio, carpetaCliente);
      if(agregados>0){
        p.fechaMod = new Date().toISOString();
        save();renderPend();syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
      }
      const rechazados = rechazadosInicio.length + fallidos.length;
      const detalleFuente = drive && base64 ? ' ('+drive+' Drive, '+base64+' local)' : drive ? ' (Drive)' : base64 ? ' (local)' : '';
      const detalleDup = (reemplazos ? ', '+reemplazos+' reemplazado(s)' : '') + (cancelados.length ? ', '+cancelados.length+' omitido(s) por duplicado' : '');
      if(rechazados===0) toast(agregados+' archivo(s) adjuntado(s)'+detalleFuente+detalleDup+' ✓','ok');
      else toast(agregados+' adjuntado(s)'+detalleFuente+detalleDup+', '+rechazados+' rechazado(s): '+rechazadosInicio.concat(fallidos).join(', '), agregados>0?'ok':'err');
      if(base64>0 && drive===0){
        toast('⚠️ No se pudo subir a Google Drive: quedó solo el respaldo local. Revisa la conexión de Drive en Panel de Control.','err');
      }
    } catch(errAdj) {
      // FIX IMPORTANTE: este try NO tenía catch (solo finally). Cualquier error
      // aquí adentro se convertía en una promesa rechazada sin manejar: la
      // subida moría en silencio, sin mensaje y sin guardar nada — exactamente
      // el síntoma reportado. Ahora el error se ve y queda en la consola.
      console.error('[Placas] error al adjuntar:', errAdj);
      if(typeof registrarError === 'function') registrarError('Placas · adjuntar documento', errAdj,
        { pendiente: pendId || ('idx '+idx), cliente: (p && (p.persona||p.nombre)) || '' });
      toast('❌ Error al adjuntar: ' + ((errAdj && errAdj.message) || errAdj), 'err');
    } finally {
      _placasProgreso(null);
      _quitarInput();
      window._placasSubiendo[claveSub]=false;
      _placasAdjBtnEstado(idx,'normal');
      // Si el modal de Expediente Digital está abierto mostrando este mismo
      // pendiente (el adjunto se pudo haber iniciado desde ahí, ya que reusa
      // esta misma función), refrescar su lista de chips también — comparten
      // el mismo arreglo p.documentos, no hace falta recargar nada más. Se
      // compara por folio (no por referencia) porque D.pendientes puede
      // haberse reemplazado por una sincronización de fondo mientras tanto.
      if (typeof _expDigState !== 'undefined' && _expDigState.recibo && p
          && p.seccion === 'placas' && Number(p.reciboVinculadoFolio) === Number(_expDigState.recibo.folio)) {
        if (typeof _expDigRenderArchivos === 'function') _expDigRenderArchivos();
        if (typeof _expDigRenderStatus === 'function') _expDigRenderStatus();
      }
    }
  };
  inp.click();
}

function _auditoriaRegistrar(accion, mov, extra){
  try{
    if(!(window.SB && window.SB_DESPACHO_ID) || !mov) return;
    const _actor = (typeof empleadoActual !== 'undefined' && empleadoActual) ? empleadoActual : null;
    const _fechaMov = mov.fecha || '';
    const _fechaHoyReal = (typeof _hoyReal === 'function') ? _hoyReal() : new Date().toISOString().slice(0,10);
    const _esRetro = !!(_fechaMov && _fechaMov !== _fechaHoyReal);
    const detalle = Object.assign({
      folio:       mov.folio != null ? mov.folio : null,
      letra:       mov.letra || 'A',
      monto:       parseFloat(mov.monto) || 0,
      tipo:        mov.tipo || '',
      estatus:     mov.estatus || '',
      fuente:      mov.fuente || '',
      descripcion: (mov.descripcion || '').slice(0,200),
      fecha_mov:   _fechaMov,
      hora_mov:    mov.hora || '',
      retroactivo: _esRetro,
      mov_id:      mov.id || null
    }, extra || {});
    window.SB.from('sesiones_log').insert({
      despacho_id: window.SB_DESPACHO_ID,
      usuario:     _actor ? (_actor.nombre || _actor.email || '') : '',
      email:       _actor ? (_actor.email || '') : '',
      accion:      accion,
      modulo:      'contabilidad',
      detalle:     detalle
    }).then(function(){}).catch(function(e){ console.warn('[auditoria]', e); });
    // Marca de "ya auditado" para que el vigilante de más abajo no vuelva a
    // registrar el mismo movimiento (evita renglones duplicados en el MONITOR).
    try{
      if(!window._auditRecientes) window._auditRecientes = Object.create(null);
      if(mov.id) window._auditRecientes[accion + '|' + mov.id] = Date.now();
    }catch(e2){}
  }catch(e){ console.warn('[auditoria]', e); }
}

function _filtrarMovsAuditado(conservar, origen, extra){
  if(!Array.isArray(D.movimientos)) return 0;
  var _quitados = [];
  var _restantes = [];
  D.movimientos.forEach(function(m){
    if(conservar(m)) _restantes.push(m); else _quitados.push(m);
  });
  D.movimientos = _restantes;
  _quitados.forEach(function(m){
    if(m) _auditoriaRegistrar('eliminado', m, Object.assign({ origen: origen }, extra || {}));
  });
  if(_quitados.length) console.warn('[Auditoría] ' + origen + ' — ' + _quitados.length + ' movimiento(s) dados de baja');
  return _quitados.length;
}

function _protegerMovimientosRecibo() {
  // ── LEX PROTECCIÓN DESACTIVADO MANUALMENTE ──────────────────────────────────
  // Se desactivó porque genera alertas de brechas innecesarias cuando los
  // recibos son eliminados intencionalmente por el administrador.
  window._brechasContables = [];
  return;
  // ⚠️ Si hay una operación de guardado en curso, los movimientos pueden no estar
  // registrados aún — saltar para evitar fabricar duplicados (falso positivo).
  if(window._registrandoRecibo) return;
  if(typeof D === 'undefined' || !Array.isArray(D.movimientos)) return;
  if(!appData || !Array.isArray(appData.recibos) || !appData.recibos.length) return;
  var plan = _calcularRecibosFaltantes();
  // ── AUTO-PROTECTOR APAGADO · MODO REPORTE ──────────────────────────────────
  // ANTES: por cada brecha hacía D.movimientos.push(m). Cuando el movimiento
  // original ya existía con monto 0 o incompleto, esto AÑADÍA un segundo asiento
  // en vez de corregir el primero → era la fuente de los duplicados "M-RECUP-".
  // AHORA: ya NO fabrica ningún movimiento en contabilidad. Solo expone las
  // brechas detectadas en window._brechasContables para revisión manual (SCANSYS).
  // La red de seguridad ante pérdidas reales por carrera de sync NO se pierde:
  // sigue activa la recuperación desde Supabase (_recuperadosSB) más abajo en
  // syncEstadoSupabase(), que es el mecanismo correcto (usa SB como fuente de
  // verdad y deduplica por clave lógica, sin inventar montos).
  if(!plan.length) { window._brechasContables = []; return; }
  window._brechasContables = plan.map(function(m){
    return { folio:m.folio, letra:m.letra||'A', monto:m.monto, estatus:m.estatus,
             descripcion:m.descripcion, fecha:m.fecha, _detectado:Date.now() };
  });
  console.warn('[LEX PROTECCIÓN · MODO REPORTE] ' + plan.length +
    ' brecha(s) detectada(s) — NO se fabricó ningún movimiento. Pendientes de revisión: ' +
    plan.map(function(m){ return m.folio + (m.letra||'') + ' ' + m.estatus + ' $' + m.monto; }).join(', '));
  if(typeof toast === 'function')
    toast('ℹ️ ' + plan.length + ' brecha(s) contable(s) detectada(s) — revisar antes de registrar', 'warn');
}

function lexRealtimeConectar() {
  if (!window.SB || !window.SB_DESPACHO_ID) return;
  if (_lexRealtimeChannel) return; // ya conectado
  const canal = 'lex-sync-' + window.SB_DESPACHO_ID;
  _lexRealtimeChannel = window.SB.channel(canal, {
    config: { broadcast: { self: false } } // no recibir los propios mensajes
  });
  _lexRealtimeChannel
    // ── BROADCAST: otro usuario guardó (self:false = nunca somos nosotros) ──
    .on('broadcast', { event: 'estado_actualizado' }, function(payload) {
      const ahora = Date.now();
      if (ahora - _lexRealtimeUltimaRecarga < _LEX_REALTIME_COOLDOWN) return;
      _lexRealtimeUltimaRecarga = ahora;
      const emisor = (payload.payload && payload.payload.usuario) || 'otro usuario';
      const emisorId = (payload.payload && payload.payload.userId) || null;
      // Ignorar si es nuestro propio broadcast (doble check con userId)
      if (emisorId && emisorId === window._miUserId) return;
      // Si el broadcast llega muy cerca de nuestro último sync, es nuestro propio save — ignorar
      const _msSinceOwnSyncBcast = Date.now() - (_ultimoSyncPropio || 0);
      if (_msSinceOwnSyncBcast < 10000) {
        console.log('[Realtime] Broadcast ignorado — sync propio reciente (' + Math.round(_msSinceOwnSyncBcast/1000) + 's)');
        return;
      }
      console.log('[Realtime] Broadcast de otro usuario:', emisor, '— sincronizando en 3s...');
      // Delay de 3s para dar tiempo a Supabase de procesar el cambio del otro usuario
      // antes de que esta computadora descargue los datos
      setTimeout(function() {
        if (_syncEnCurso) { setTimeout(_realtimeSincronizar, 2000); return; }
        sincronizarFolio(true).then(function() {
        if (typeof renderHistorial   === 'function') renderHistorial();
        if (typeof renderCaja        === 'function') renderCaja();
        if (typeof renderContab      === 'function') renderContab();
        if (typeof badges            === 'function') badges();
        if (typeof hjRenderTerminos  === 'function') try { hjRenderTerminos(); } catch(e){ registrarError('catch vacio', e); }
        if (typeof hjRenderLista     === 'function') try { hjRenderLista();    } catch(e){ registrarError('catch vacio', e); }
        if (typeof renderVencimientos=== 'function') safeExec('renderVencimientos', () => renderVencimientos());
        if (typeof renderPend        === 'function') safeExec('renderPend', () => renderPend());
        if (typeof renderJuicios     === 'function') safeExec('renderJuicios', () => renderJuicios());
        // Recargar config de captura retroactiva desde Supabase
        if (typeof capturaMesCargarSupabase === 'function') capturaMesCargarSupabase();
        }).catch(function(e){ registrarError('Promise catch vacio', e); });
      }, 3000); // delay 3s para que Supabase procese el cambio primero
    })
    // ── POSTGRES CHANGES: cambio en DB (llega a todos, incluyendo emisor) ──
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'app_state',
      filter: 'despacho_id=eq.' + window.SB_DESPACHO_ID
    }, function(payload) {
      const ahora = Date.now();
      if (ahora - _lexRealtimeUltimaRecarga < _LEX_REALTIME_COOLDOWN) return;
      _lexRealtimeUltimaRecarga = ahora;
      // Ignorar si fue nuestro propio cambio:
      // - updated_by coincide con nuestro ID, O
      // - updated_by es null pero guardamos hace menos de 15s (probablemente nuestro)
      const updatedBy = payload && payload.new && payload.new.updated_by;
      const ahoraRT = Date.now();
      const esMioCerto  = updatedBy && updatedBy === window._miUserId;
      const esMioProbable = !updatedBy && (ahoraRT - (_ultimoSyncPropio||0)) < 600000; // 10 min — protege contra postgres_changes tardíos
      if (esMioCerto || esMioProbable) {
        console.log('[Realtime] postgres_changes propio — ignorado');
        return;
      }
      console.log('[Realtime] postgres_changes de otro usuario — sincronizando en 3s...');
      setTimeout(_realtimeSincronizar, 3000);
    })
    // ── Escuchar configuración retroactiva enviada por el admin ──
    .on('broadcast', { event: 'captura_meses_actualizada' }, function(payload) {
      if (!payload.payload || !payload.payload.cfg) return;
      // Ignorar si somos el admin (nosotros la enviamos)
      if (esAdministrador()) return;
      // Actualizar en memoria y re-renderizar barra
      try {
        if (typeof D !== 'undefined') D.captura_meses = payload.payload.cfg;
        if (typeof renderBarraSecretariaCaptura === 'function') renderBarraSecretariaCaptura();
        if (typeof toast === 'function') toast('📅 Meses habilitados actualizados por el administrador', 'ok');
        console.log('[Realtime] captura_meses actualizada desde admin');
      } catch(e){ registrarError('catch vacio', e); }
    })
    // ── Escuchar toggle de Modo Retroactivo global enviado por el admin ──
    .on('broadcast', { event: 'retro_global_actualizado' }, function(payload) {
      if (!payload.payload) return;
      try {
        const activo = !!payload.payload.activo;
        if (typeof aplicarRetroGlobal === 'function') aplicarRetroGlobal(activo);
        if (typeof adminRenderCardRetroGlobal === 'function') adminRenderCardRetroGlobal(activo);
        if (typeof toast === 'function') toast(activo ? '⏰ Modo Retroactivo activado por el administrador' : '○ Modo Retroactivo desactivado por el administrador', 'ok');
        console.log('[Realtime] retro_global:', activo);
      } catch(e){ registrarError('catch retro_global_actualizado', e); }
    })
    // ── Escuchar tiempo extra otorgado/retirado por el admin a un empleado ──
    // Efecto inmediato en la sesión ya abierta: si a mí me lo otorgan y el
    // candado de horario está puesto, se cierra solo; si me lo quitan y ya
    // debería estar cerrado, el candado se aplica al instante (sin esperar
    // el siguiente tick de 60s).
    .on('broadcast', { event: 'tiempo_extra_actualizado' }, function(payload) {
      if (!payload.payload || !payload.payload.email) return;
      try {
        const _teEmailRT = String(payload.payload.email).toLowerCase();
        const _teEntryRT = payload.payload.entry || null;
        if (typeof D !== 'undefined') {
          if (!D.tiempoExtra) D.tiempoExtra = {};
          if (_teEntryRT) D.tiempoExtra[_teEmailRT] = _teEntryRT; else delete D.tiempoExtra[_teEmailRT];
        }
        const _esMiEmailRT = typeof empleadoActual !== 'undefined' && empleadoActual &&
          (empleadoActual.email||'').toLowerCase() === _teEmailRT;
        if (_esMiEmailRT) {
          const _gateElRT = document.getElementById('modal-horario-gate');
          if (_teEntryRT && _gateElRT && _gateElRT.classList.contains('show')) {
            if (typeof _horarioGateCerrar === 'function') _horarioGateCerrar();
            if (typeof toast === 'function') toast('⏱ El administrador te otorgó tiempo extra', 'ok');
          } else if (!_teEntryRT) {
            const _estadoRT = typeof _horarioEstado === 'function' ? _horarioEstado() : null;
            if (_estadoRT === 'cerrado' || _estadoRT === 'domingo') {
              _horarioGateMostrar(_estadoRT, _primerNombreEmpleado(empleadoActual.nombre));
              if (typeof toast === 'function') toast('⏱ El administrador retiró el tiempo extra', 'err');
            }
          }
        }
        console.log('[Realtime] tiempo_extra:', _teEmailRT, _teEntryRT);
      } catch(e){ registrarError('catch tiempo_extra_actualizado', e); }
    })
    // ── Eliminación inmediata de folio en todos los clientes conectados ──────
    // El admin elimina → broadcast → empleada borra de su memoria local al instante,
    // sin esperar el ciclo de sync (que llegaría demasiado tarde y permitía que
    // la empleada re-subiera el folio eliminado antes de recibir el tombstone).
    .on('broadcast', { event: 'folio_eliminado' }, function(payload) {
      if (!payload || !payload.payload) return;
      try {
        var _folioEl = payload.payload.folio;
        var _letraEl = payload.payload.letra || 'A';
        var _tsEliminacion = Number(payload.payload.ts || Date.now());
        var _adminForce = !!payload.payload._adminForce; // El admin ordenó esto — no permitir resurrección
        // 1. Agregar tombstone local (siempre con el ts del admin, que ya lleva +10000)
        if (!Array.isArray(appData.folios_eliminados)) appData.folios_eliminados = [];
        // Reemplazar tombstone existente si el nuevo ts es mayor (el admin puede haber re-eliminado)
        appData.folios_eliminados = appData.folios_eliminados.filter(function(t){
          return !(String(t.folio)===String(_folioEl) && (t.letra||'A')===_letraEl);
        });
        appData.folios_eliminados.push({ folio: _folioEl, letra: _letraEl, ts: _tsEliminacion });
        // 2. Eliminar de recibos locales — si _adminForce, borrar SIEMPRE sin importar _revivedTs
        if (Array.isArray(appData.recibos)) {
          appData.recibos = appData.recibos.filter(function(rec){
            var coincide = String(rec.folio)===String(_folioEl) && (rec.letra||'A')===_letraEl;
            if (!coincide) return true;
            if (!_adminForce && rec._revivedTs && Number(rec._revivedTs) > _tsEliminacion) return true; // revivido posterior solo se respeta si NO es forzado por admin
            return false; // eliminar
          });
        }
        // 2b. Recalcular folioActual local
        if (typeof REC !== 'undefined') REC.recibos = appData.recibos;
        if (typeof _recalcularFolioActual === 'function') {
          appData.folioActual = _recalcularFolioActual();
          if (typeof REC !== 'undefined') REC.folioActual = appData.folioActual;
          if (typeof actualizarFolioDisplay === 'function' && !document.body.classList.contains('modo-actualizacion')) actualizarFolioDisplay();
        }
        // 3. Persistir tombstone en Supabase para que otros clientes que aún no
        //    recibieron el broadcast también respeten la eliminación al syncar.
        setTimeout(function(){
          if (typeof actualizarArchivoControl === 'function')
            actualizarArchivoControl().catch(function(e){ console.warn('[folio_eliminado] re-upload tombstone:', e); });
        }, 500);
        // 4. Refrescar UI
        if (typeof adminRenderRecibos === 'function') adminRenderRecibos((document.getElementById('adminBuscarRecibo')||{}).value||'');
        if (typeof renderRec       === 'function') renderRec();
        if (typeof renderCaja      === 'function') renderCaja();
        if (typeof renderContab    === 'function') renderContab();
        if (typeof badges          === 'function') badges();
        // Cerrar/refrescar Ficha del Folio o el buscador de folios si estaban
        // abiertos mostrando justo este folio en ESTE cliente (otro empleado lo borró).
        if (typeof window._notificarFolioEliminadoUI === 'function') window._notificarFolioEliminadoUI(_folioEl, _letraEl);
        console.log('[Realtime] folio_eliminado aplicado localmente — folio:', _folioEl, 'letra:', _letraEl, '_adminForce:', _adminForce);
      } catch(e){ console.warn('[Realtime] folio_eliminado error:', e); }
    })
    .subscribe(function(status) {
      console.log('[Realtime] Estado canal:', status);
      if (status === 'SUBSCRIBED') lexPollingIniciar();
    });
  console.log('[Realtime] Conectado al canal:', canal);
}

function lexRealtimeBroadcast() {
  if (!_lexRealtimeChannel) return;
  // Solo enviar si el canal está en estado SUBSCRIBED (evita fallback a REST y el warning de Supabase)
  if (_lexRealtimeChannel.state !== 'joined') return;
  const usuario = empleadoActual ? empleadoActual.nombre : (NOMBRE_TITULAR || 'Usuario');
  _lexRealtimeChannel.send({
    type:    'broadcast',
    event:   'estado_actualizado',
    payload: { usuario: usuario, userId: window._miUserId || null, ts: Date.now() }
  }).catch(function(e){ registrarError('Promise catch vacio', e); });
}

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
    case 'eliminarRecDuplicados':
      if(typeof adminEliminarRecibosDuplicados === 'function') adminEliminarRecibosDuplicados();
      break;
    case 'limpiarDupContab':
      if(typeof adminLimpiarDupContab === 'function') adminLimpiarDupContab();
      break;
    case 'restaurarFlujoContable':
      if(typeof adminAbrirRestaurarFlujo === 'function') adminAbrirRestaurarFlujo();
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
      _filtrarMovsAuditado(function(m){ return !idsABorrar.has(m.id); }, 'limpiarDiaActual');
      // 2. Reordenar folios ya sin los borrados y persistir
      _reordenarFoliosCaja();
          if(typeof renderCaja === 'function') renderCaja();
      if(typeof renderContab === 'function') renderContab();
      if(typeof renderConfig === 'function') renderConfig();
      toast('Movimientos de hoy eliminados ('+cnt+'). Dias anteriores intactos.');
    })
    .catch(function(e){console.warn('limpiar dia:',e);});
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

function cerrarCaja() {
  if (typeof esAdministrador === 'function' && !esAdministrador()) {
    toast('El cierre de caja ahora es automático — solo el administrador puede cerrarla manualmente.', 'err');
    return;
  }
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

function adminEliminarRecibosDuplicados() {
  var recibos = (typeof appData !== 'undefined' && Array.isArray(appData.recibos)) ? appData.recibos : [];
  // ── A. Duplicados en appData.recibos (mismo folio+LETRA+fecha+hora) ────────
  // ⚠️ CRÍTICO: la letra DEBE ser parte de la clave. El sub-folio B (pago parcial)
  // se crea con Object.assign({}, A, …) y HEREDA fecha y hora del A — sin la letra
  // en la clave, B se marcaba como "duplicado" de A y se eliminaba uno de los dos
  // (el A si el merge de Supabase había reordenado el array → B huérfano, caso 72B).
  var vistos = {};
  var duplicados = [];
  recibos.forEach(function(r, idx) {
    if (!r) return;
    var letraEf = r.letra || (typeof letraVersion === 'function' ? letraVersion(r) : 'A') || 'A';
    var clave = (r.folio || '') + '|' + letraEf + '|' + (r.fecha || '') + '|' + (r.hora || '');
    if (vistos[clave] !== undefined) {
      duplicados.push({ idx: idx, recibo: r, claveOriginal: vistos[clave] });
    } else {
      vistos[clave] = idx;
    }
  });
  // ── B. Duplicados en D.movimientos (mismo folio+letra+fecha+monto+estatus) ─
  // Esto ocurre cuando el mismo recibo generó dos entradas en la contabilidad
  // con distinto ID pero igual contenido (p.ej. 26-001A aparece dos veces).
  var movimientos = (typeof D !== 'undefined' && Array.isArray(D.movimientos)) ? D.movimientos : [];
  var vistosMov = {};
  var duplicadosMov = []; // índices en D.movimientos a eliminar
  movimientos.forEach(function(m, idx) {
    if (!m || m.borrado || m.fuente !== 'recibo') return;
    var clave = (m.folio != null ? m.folio : '') + '|' +
                (m.letra || 'A') + '|' +
                (m.fecha || '') + '|' +
                (parseFloat(m.monto) || 0) + '|' +
                (m.estatus || '');
    if (vistosMov[clave] !== undefined) {
      duplicadosMov.push({ idx: idx, mov: m });
    } else {
      vistosMov[clave] = idx;
    }
  });
  var totalProblemas = duplicados.length + duplicadosMov.length;
  if (totalProblemas === 0) {
    alert('✅ No se encontraron recibos duplicados.\n\nTodos los recibos y movimientos contables tienen datos únicos.');
    return;
  }
  // ── Construir mensaje de confirmación ──────────────────────────────────────
  var msg = '🔁 DUPLICADOS ENCONTRADOS\n\n';
  if (duplicados.length > 0) {
    msg += '📋 En lista de recibos (' + duplicados.length + '):\n';
    duplicados.forEach(function(d) {
      var r = d.recibo;
      var folioStr = r.folio ? ('#' + r.folio) : '(sin folio)';
      msg += '  • ' + folioStr + ' — ' + (r.nombre || 'Sin nombre') + '\n';
      msg += '    Fecha: ' + (r.fecha || '—') + '  Hora: ' + (r.hora || '—') + '\n';
    });
    msg += '\n';
  }
  if (duplicadosMov.length > 0) {
    msg += '📊 En contabilidad (D.movimientos) (' + duplicadosMov.length + '):\n';
    duplicadosMov.forEach(function(d) {
      var m = d.mov;
      var folioStr = m.folio != null ? ('#' + m.folio + (m.letra || 'A')) : '(sin folio)';
      msg += '  • ' + folioStr + ' — ' + (m.nombre || 'Sin nombre') + '\n';
      msg += '    Fecha: ' + (m.fecha || '—') + '  $' + (m.monto || 0) + '\n';
    });
    msg += '\n';
  }
  msg += 'Se conservará el primero registrado de cada grupo.\n';
  msg += '⚠️ Esta acción NO se puede deshacer.\n\n¿Eliminar los ' + totalProblemas + ' duplicado(s)?';
  if (!confirm(msg)) return;
  var eliminados = 0;
  // ── Eliminar duplicados en appData.recibos (orden inverso) ─────────────────
  // FIX: NO usar adminEliminarRecibo() — es async y rompe índices en loop.
  // Eliminamos directamente y agregamos a recibosExcluidosCaja para que los
  // movimientos sintéticos R-{folio} no reaparezcan al recargar la página.
  if (!Array.isArray(D.recibosExcluidosCaja)) D.recibosExcluidosCaja = [];
  var indicesRec = duplicados.map(function(d) { return d.idx; }).sort(function(a, b) { return b - a; });
  var _letraEfDe = function(r){ return r.letra || (typeof letraVersion === 'function' ? letraVersion(r) : 'A') || 'A'; };
  indicesRec.forEach(function(idx) {
    var r = recibos[idx];
    if (!r) return;
    var letra = _letraEfDe(r);
    // ── CANDADO ANTI-HUÉRFANOS ────────────────────────────────────────────
    // Nunca eliminar el ÚLTIMO registro 'A' de un folio que tiene sub-folios
    // B/C/D vivos: dejaría a los hijos huérfanos (caso 72B). Solo se permite
    // si tras la eliminación queda otro registro 'A' del mismo folio.
    if (letra === 'A') {
      var quedaOtroA = recibos.some(function(_r, i) {
        return i !== idx && _r && Number(_r.folio) === Number(r.folio) &&
               !_r.esComplemento && _letraEfDe(_r) === 'A';
      });
      var tieneHijos = recibos.some(function(_r, i) {
        return i !== idx && _r && Number(_r.folio) === Number(r.folio) &&
               !_r.esComplemento && _letraEfDe(_r) > 'A';
      });
      if (!quedaOtroA && tieneHijos) {
        console.warn('[LEX] Protegido: no se elimina ' + r.folio + 'A — tiene sub-folios B/C/D que quedarían huérfanos');
        return;
      }
    }
    // Limpiar movimientos reales de este duplicado
    if (typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
      _filtrarMovsAuditado(function(m) {
        if (!m) return false;
        return !(m.fuente === 'recibo' && m.folio == r.folio && (m.letra || 'A') === letra);
      }, 'adminEliminarRecibosDuplicados', { folio: r.folio, letra: letra });
    }
    recibos.splice(idx, 1);
    if (typeof _purgarPagosParcialesDeVersion === 'function') _purgarPagosParcialesDeVersion(r.folio, letra, r);
    // Excluir de movimientos sintéticos SOLO si el folio queda sin ninguna versión;
    // si quedan otras versiones (A o B) el folio debe seguir visible en caja.
    var quedanVersiones = recibos.some(function(_r){ return _r && Number(_r.folio) === Number(r.folio); });
    if (!quedanVersiones) {
      var fs = String(r.folio);
      if (!D.recibosExcluidosCaja.map(String).includes(fs)) {
        D.recibosExcluidosCaja.push(fs);
      }
    }
    eliminados++;
  });
  if (indicesRec.length > 0) {
    if (typeof REC !== 'undefined') REC.recibos = appData.recibos;
    if (typeof save === 'function') save();
    if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced();
  }
  // ── Eliminar movimientos duplicados en D.movimientos (orden inverso) ────────
  var indicesMov = duplicadosMov.map(function(d) { return d.idx; }).sort(function(a, b) { return b - a; });
  indicesMov.forEach(function(idx) {
    if (D.movimientos[idx]) {
      _auditoriaRegistrar('eliminado', D.movimientos[idx], {origen:'corregirDuplicados'});
      D.movimientos.splice(idx, 1);
      eliminados++;
    }
  });
  if (indicesMov.length > 0) {
    if (typeof save === 'function') save();
    if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced();
  }
  // ── Re-render ──────────────────────────────────────────────────────────────
  if (typeof renderContab === 'function') renderContab();
  if (typeof renderCaja === 'function') renderCaja();
  if (typeof adminAbrirGestionRecibos === 'function') {
    var zona = document.getElementById('adminGestRecZona');
    if (zona && zona.style.display !== 'none') adminAbrirGestionRecibos();
  }
  alert('✅ Limpieza completada.\n\n' + eliminados + ' duplicado(s) eliminado(s).\nTu sistema ahora refleja datos correctos.');
}

function adminLimpiarDupContab() {
  var movimientos = (typeof D !== 'undefined' && Array.isArray(D.movimientos)) ? D.movimientos : [];

  var grupos = {};
  movimientos.forEach(function(m, idx) {
    if (!m || m.borrado || m.fuente !== 'recibo') return;
    var letraEf = (m.letra || 'A');
    var clave = (m.folio != null ? String(m.folio) : '') + '|' + letraEf;
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push({ idx: idx, mov: m });
  });

  var gruposDup = Object.keys(grupos).filter(function(k) { return grupos[k].length > 1; });

  if (gruposDup.length === 0) {
    alert('\u2705 No se encontraron movimientos duplicados en Contabilidad.\n\nTodos los registros son \u00fanicos.');
    return;
  }

  window._ldcState = { grupos: grupos, gruposDup: gruposDup, movimientos: movimientos };

  // ── Helper: obtener y abrir el PDF de un recibo ──────────────────────
  window._ldcVerPDF = async function(folio, letra) {
    try {
      if (!window.SB || !window.SB_DESPACHO_ID) { alert('Sin conexion a Supabase.'); return; }
      var nombreArchivo = folio + (letra || 'A') + '.pdf';
      var path = window.SB_DESPACHO_ID + '/recibos/' + nombreArchivo;
      var rec = (REC && REC.recibos ? REC.recibos : []).find(function(r){ return r.folio == folio && (r.letra||'A') === (letra||'A'); });
      if (rec && (rec.archivoR2 || rec.archivo)) {
        path = window.SB_DESPACHO_ID + '/recibos/' + (rec.archivoR2 || rec.archivo);
      }
      var res = await window.SB.storage.from('lex-files').createSignedUrl(path, 300);
      if (res.error || !res.data || !res.data.signedUrl) { alert('No se pudo obtener la URL del PDF.\n' + (res.error ? res.error.message : '')); return; }
      window.open(res.data.signedUrl, '_blank');
    } catch(e) { alert('Error al abrir PDF: ' + (e.message||e)); }
  };

  // ── Helper: eliminar UN movimiento individual con tombstone permanente ─
  window._ldcEliminarUno = async function(idMov, overlayEl) {
    var movReal = D.movimientos.find(function(m){ return m && m.id === idMov; });
    if (!movReal) { alert('Movimiento no encontrado (ya eliminado?).'); return; }
    // Pedir confirmacion UNA sola vez aqui
    var desc = (movReal.descripcion || movReal.estatus || '').substring(0, 80);
    var monto = (movReal.tipo === 'egreso' ? '-' : '+') + '$' + Number(parseFloat(movReal.monto)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
    if (!confirm('Eliminar este movimiento de Contabilidad?\n\n' + desc + '\n' + monto + '\n\nEsta accion NO se puede deshacer.')) return;
    window._ldcState = null;
    if (overlayEl && overlayEl.parentNode) overlayEl.remove();
    try {
      if (typeof reconciliarAplicar !== 'function') throw new Error('reconciliarAplicar no disponible');
      // sinConfirm:true para no mostrar un segundo dialogo de confirmacion
      var res = await reconciliarAplicar([idMov], { confirmar: true, sinConfirm: true });
      if (res && res.eliminados && res.eliminados.length) {
        if (typeof renderContab === 'function') renderContab();
        if (typeof renderCaja  === 'function') renderCaja();
        setTimeout(function(){ adminLimpiarDupContab(); }, 400);
      }
    } catch(e) { alert('Error: ' + (e && e.message ? e.message : String(e))); }
  };

  // ── Construir HTML de los grupos ────────────────────────────────────
  var filas = '';
  gruposDup.forEach(function(clave, gi) {
    var grupo = grupos[clave];
    var m0 = grupo[0].mov;
    var folioStr = m0.folio != null ? (m0.folio + (m0.letra || 'A')) : '(sin folio)';
    var _montos  = grupo.map(function(g){ return parseFloat(g.mov.monto)||0; });
    var _estatus = grupo.map(function(g){ return g.mov.estatus||g.mov.cat||''; });
    var esDupExacto = _montos.every(function(v){ return v===_montos[0]; }) && _estatus.every(function(v){ return v===_estatus[0]; });
    var tipoBadge = esDupExacto
      ? '<span style="font-size:0.5rem;padding:2px 7px;border-radius:4px;background:#c8952a;color:#fff;font-weight:700;margin-left:6px;">EXACTO</span>'
      : '<span style="font-size:0.5rem;padding:2px 7px;border-radius:4px;background:#b04a00;color:#fff;font-weight:700;margin-left:6px;">MISMO FOLIO \u00b7 DIFERENTE ESTADO</span>';

    filas += '<div style="margin-bottom:20px;">';
    filas += '<div style="font-family:monospace;font-size:0.7rem;font-weight:700;color:#7a6840;margin-bottom:8px;padding:6px 10px;background:rgba(200,149,42,0.1);border-radius:6px;border-left:3px solid #c8952a;display:flex;align-items:center;flex-wrap:wrap;gap:4px;">';
    filas += '\uD83D\uDCCB Grupo ' + (gi+1) + ' \u00b7 Folio #' + folioStr + ' \u00b7 ' + grupo.length + ' entradas' + tipoBadge;
    filas += '</div>';

    grupo.forEach(function(g, oi) {
      var m = g.mov;
      var radioId = 'ldc-r-' + gi + '-' + oi;
      var desc = (m.descripcion || '\u2014');
      if (desc.length > 55) desc = desc.substring(0,55) + '\u2026';
      var bgRow = oi === 0 ? 'rgba(200,149,42,0.07)' : '#fff';
      var borderCol = oi === 0 ? 'rgba(200,149,42,0.4)' : 'rgba(200,149,42,0.18)';
      var _mFila  = parseFloat(m.monto)||0;
      var _mColor = m.tipo==='egreso'?'#c0161a':'#1a7a3a';
      var _mStr   = (m.tipo==='egreso'?'-':'+') + '$' + Number(_mFila||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
      var _eFila  = m.estatus || m.cat || '\u2014';
      var folioNum = m.folio != null ? m.folio : '';
      var letraM   = m.letra || 'A';

      filas += '<div style="display:flex;align-items:flex-start;gap:8px;padding:10px 10px 10px 10px;border:1.5px solid ' + borderCol + ';border-radius:8px;margin-bottom:6px;background:' + bgRow + ';">';
      // Radio
      filas += '<input type="radio" id="' + radioId + '" name="ldc-g-' + gi + '" value="' + g.idx + '"' + (oi===0?' checked':'') + ' style="margin-top:4px;accent-color:#c8952a;flex-shrink:0;">';
      // Info principal
      filas += '<label for="' + radioId + '" style="flex:1;cursor:pointer;">';
      filas += '<div style="font-family:monospace;font-size:0.65rem;font-weight:700;color:#1a1008;">' + (oi===0?'\u2b50 ':'') + 'ID: ' + (m.id||'sin-id') + '</div>';
      filas += '<div style="font-size:0.63rem;color:#7a6840;margin-top:3px;">';
      filas += '\uD83D\uDD50 ' + (m.hora||'\u2014') + ' hrs \u00b7 \uD83D\uDC64 ' + (m.nombre||'\u2014') + ' \u00b7 ' + desc;
      filas += '</div>';
      filas += '<div style="font-size:0.6rem;margin-top:4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">';
      filas += '<span style="font-family:monospace;font-weight:700;color:' + _mColor + ';">' + _mStr + '</span>';
      filas += '<span style="background:rgba(200,149,42,0.12);border:1px solid rgba(200,149,42,0.35);border-radius:4px;padding:1px 7px;color:#7a6840;font-size:0.58rem;font-weight:600;">' + _eFila + '</span>';
      filas += '<span style="color:#aaa;font-size:0.58rem;">Resp: ' + (m.responsable||'\u2014') + '</span>';
      filas += '</div>';
      filas += '</label>';
      // Botones acción
      filas += '<div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;">';
      filas += '<button onclick="window._ldcVerPDF(' + JSON.stringify(folioNum) + ',' + JSON.stringify(letraM) + ')" style="padding:5px 10px;border-radius:6px;border:1.5px solid rgba(26,74,138,0.4);background:rgba(26,74,138,0.08);color:#1a4a8a;font-family:monospace;font-size:0.58rem;font-weight:700;cursor:pointer;white-space:nowrap;" title="Ver PDF en nueva pestana">\uD83D\uDCC4 Ver PDF</button>';
      filas += '<button onclick="window._ldcEliminarUno(&quot;' + g.mov.id + '&quot;, document.getElementById(\'modal-ldc-contab\'))" style="padding:5px 10px;border-radius:6px;border:1.5px solid rgba(192,22,26,0.4);background:rgba(192,22,26,0.07);color:#c0161a;font-family:monospace;font-size:0.58rem;font-weight:700;cursor:pointer;white-space:nowrap;" title="Eliminar solo este movimiento">\uD83D\uDDD1 Eliminar</button>';
      filas += '</div>';
      filas += '</div>';
    });
    filas += '</div>';
  });

  // ── Crear modal (tema claro) ─────────────────────────────────────────
  var modalId = 'modal-ldc-contab';
  var old = document.getElementById(modalId);
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.id = modalId;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,16,8,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';

  var box = document.createElement('div');
  box.style.cssText = 'background:#fdfaf4;border:1.5px solid #d4b870;border-radius:16px;width:min(680px,96vw);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(26,16,8,0.2),0 0 0 1px rgba(200,149,42,0.15);';

  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'padding:18px 20px 14px;border-bottom:1px solid #ecdfa8;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#fdfaf4,#f7f3e8);border-radius:14px 14px 0 0;';
  hdr.innerHTML = '<div>' +
    '<div style="font-family:sans-serif;font-size:1rem;font-weight:700;color:#1a1008;display:flex;align-items:center;gap:8px;">\uD83D\uDDC2\uFE0F Duplicados en Contabilidad</div>' +
    '<div style="font-family:monospace;font-size:0.6rem;color:#7a6840;margin-top:4px;">Se encontraron <strong style="color:#c8952a;">' + gruposDup.length + ' grupo(s)</strong> con movimientos repetidos.<br>Elige cu\u00e1l conservar en cada grupo \u2014 el resto se eliminar\u00e1. O usa los botones para actuar individualmente.</div>' +
    '</div>';
  var btnCerrar = document.createElement('button');
  btnCerrar.textContent = '\u2715';
  btnCerrar.title = 'Cerrar';
  btnCerrar.style.cssText = 'background:none;border:none;color:#7a6840;font-size:1.2rem;cursor:pointer;padding:0 4px;line-height:1;';
  btnCerrar.onclick = function() { overlay.remove(); };
  hdr.appendChild(btnCerrar);

  // Cuerpo
  var body = document.createElement('div');
  body.style.cssText = 'overflow-y:auto;padding:16px 20px;flex:1;background:#fdfaf4;';
  body.innerHTML = filas;

  // Footer
  var ftr = document.createElement('div');
  ftr.style.cssText = 'padding:14px 20px;border-top:1px solid #ecdfa8;display:flex;gap:10px;justify-content:flex-end;background:#f7f3e8;border-radius:0 0 14px 14px;';

  var btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancelar';
  btnCancel.style.cssText = 'padding:9px 18px;border-radius:8px;border:1.5px solid rgba(200,149,42,0.4);background:transparent;color:#7a6840;font-family:monospace;font-size:0.72rem;cursor:pointer;font-weight:600;';
  btnCancel.onclick = function() { overlay.remove(); };

  var btnAplicar = document.createElement('button');
  btnAplicar.innerHTML = '\u26a1 Aplicar eliminaci\u00f3n';
  btnAplicar.style.cssText = 'padding:9px 22px;border-radius:8px;border:none;background:linear-gradient(135deg,#c8952a,#8c6518);color:#fff;font-family:monospace;font-size:0.75rem;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(200,149,42,0.3);';
  btnAplicar.onclick = function() { adminLimpiarDupContabAplicar(overlay); };

  ftr.appendChild(btnCancel);
  ftr.appendChild(btnAplicar);
  box.appendChild(hdr);
  box.appendChild(body);
  box.appendChild(ftr);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

async function adminLimpiarDupContabAplicar(overlay) {
  var state = window._ldcState;
  if (!state) { alert('Error: estado perdido. Vuelve a abrir el panel.'); return; }

  var grupos    = state.grupos;
  var gruposDup = state.gruposDup;
  var idsMovsAEliminar = []; // IDs reales del movimiento (no indices)

  gruposDup.forEach(function(clave, gi) {
    var grupo = grupos[clave];
    if (!grupo || grupo.length < 2) return;
    var radioSel = document.querySelector('input[name="ldc-g-' + gi + '"]:checked');
    var idxConservar = radioSel ? parseInt(radioSel.value) : grupo[0].idx;
    grupo.forEach(function(g) {
      if (g.idx !== idxConservar) {
        // Tomar el ID real del movimiento en D.movimientos (no el indice, que puede cambiar)
        var movReal = D.movimientos[g.idx];
        if (movReal && movReal.id) idsMovsAEliminar.push(movReal.id);
      }
    });
  });

  if (idsMovsAEliminar.length === 0) {
    alert('\u2139\uFE0F No hay cambios que aplicar.');
    return;
  }

  window._ldcState = null;
  if (overlay && overlay.parentNode) overlay.remove();

  // reconciliarAplicar registra tombstone en D.movimientos_eliminados y hace sync
  // con Supabase — los movimientos eliminados NO regresan al recargar o sincronizar.
  // La confirmación la maneja reconciliarAplicar internamente.
  try {
    if (typeof reconciliarAplicar !== 'function') throw new Error('reconciliarAplicar no disponible');
    var resultado = await reconciliarAplicar(idsMovsAEliminar, { confirmar: true, sinConfirm: true });
    if (resultado && resultado.eliminados && resultado.eliminados.length) {
      if (typeof renderContab === 'function') renderContab();
      if (typeof renderCaja  === 'function') renderCaja();
    }
  } catch(e) {
    alert('\u274c Error al eliminar: ' + (e && e.message ? e.message : String(e)));
  }
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

function _esAdminReal(){
  return !!(typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.email &&
            typeof ADMIN_EMAIL !== 'undefined' &&
            empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
}

function abrirAdminModal() {
  const btn = document.getElementById('adminGearBtn');
  // Verificación real: solo entra quien ya inició sesión en Supabase como el
  // administrador. Ya no existe ningún formulario de usuario/contraseña aquí.
  if(!_esAdminReal()){
    if(typeof toast === 'function') toast('🛡 Acceso restringido al administrador','err');
    return;
  }
  if(btn){
    // Garantizar que el botón siempre sea clickeable
    btn.style.pointerEvents = 'auto';
    btn.style.opacity = '1';
    // Limpiar animación previa y forzar reflow para reiniciarla limpia
    btn.classList.remove('spinning');
    void btn.offsetWidth;
    btn.classList.add('spinning');
    setTimeout(() => btn.classList.remove('spinning'), 520);
  }
  // Sesión de administrador confirmada por Supabase — activar directo.
  adminSesionActiva = true;
  adminSesionUsuario = empleadoActual.nombre || empleadoActual.email;
  if(!adminSesionHora){
    const now = new Date();
    adminSesionHora = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  }
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
  var gz5 = document.getElementById('adminConsultarPDFZone');
  if (gz5) gz5.classList.remove('show');
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
  document.querySelectorAll('#adminModal .admin-panel').forEach(function(z){ z.style.display = ''; z.classList.remove('show'); });
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

function adminLogin() {
  const errEl = document.getElementById('adminError');
  if (!_esAdminReal()) {
    if (errEl) errEl.style.display = 'block';
    return;
  }
  if (errEl) errEl.style.display = 'none';
  adminSesionActiva = true;
  adminSesionUsuario = empleadoActual.nombre || empleadoActual.email;
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
  // ── HOOK SIDEBAR: ir a edición completa si vino del botón del sidebar ──
  if(window._adminAccionPendiente === 'edicionCompleta'){
    window._adminAccionPendiente = null;
    setTimeout(function(){
      document.querySelectorAll('#adminModal .admin-panel').forEach(p => p.classList.remove('show'));
      const zona = document.getElementById('adminEdicionCompletaZone');
      if(zona) zona.classList.add('show');
      const inp = document.getElementById('adminEdicionBuscar');
      if(inp) inp.value = '';
      if(typeof adminEdicionFiltrar === 'function') adminEdicionFiltrar();
    }, 350);
  }
}

function adminMostrarPanel() {
  document.getElementById('adminAuthZone').style.display = 'none';
  document.querySelectorAll('#adminModal .admin-panel').forEach(function(z){ z.style.display = ''; z.classList.remove('show'); });
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
    // Contador de versiones en Supabase (carga asíncrona silenciosa)
    if(window.SB && window.SB_DESPACHO_ID){
      window.SB.from('versiones_recibo').select('folio_base',{count:'exact',head:true}).eq('despacho_id',window.SB_DESPACHO_ID)
        .then(function(res){
          var cntEl = document.getElementById('adminVersCnt');
          if(cntEl && res && res.count != null) cntEl.textContent = res.count;
        }).catch(function(){});
    }
    // Estado del ultimo backup (guardado en Supabase Storage)
    const backupEl = document.getElementById('adminBackupStatus');
    if(backupEl){
      backupEl.textContent = _backupDiarioHecho ? 'Backup realizado esta sesión' : 'Pendiente (se crea al iniciar)';
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
    if(!m || m.borrado) return false;
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
  try{
    if(typeof _mpeAdminActivo !== 'undefined') _mpeAdminActivo = false;
    if(typeof _mpeAdminOff !== 'undefined') _mpeAdminOff = false;
    sessionStorage.removeItem('mpe_admin_off');
  } catch(e){}
  localStorage.removeItem('empleado_email');
  localStorage.removeItem('empleado_nombre');
  lexRealtimeDesconectar();
  const btn = document.getElementById('btn-cerrar-sesion');
  if (btn) btn.style.display = 'none';
  // Recargar para volver al login
  setTimeout(() => location.reload(), 300);
}

async function _checkCuentaHabilitada(){
  try{
    if(!empleadoActual || !empleadoActual.email) return;
    if(!window.SB_DESPACHO_ID) return;
    const resp = await fetch(R2_WORKER+'/admin/usuarios?despacho_id='+encodeURIComponent(window.SB_DESPACHO_ID), {
      headers: { 'X-Auth-Token': await _r2AuthToken() }
    });
    if(!resp.ok) return;
    const data = await resp.json().catch(()=>({}));
    const usuarios = data.usuarios || [];
    const yo = usuarios.find(function(u){
      return u.email && empleadoActual && u.email.toLowerCase() === empleadoActual.email.toLowerCase();
    });
    if(yo && yo.habilitado === false){
      _forzarCierreSesionPorDeshabilitado();
    }
  } catch(e){ /* silencioso: un error de red no debe interrumpir al usuario */ }
}

function _forzarCierreSesionPorDeshabilitado(){
  if(_watchCuentaTimer){ clearInterval(_watchCuentaTimer); _watchCuentaTimer = null; }
  try{ if(window.SB) window.SB.auth.signOut().catch(function(){}); } catch(e){}
  sbSession = null; sbExpiry = 0;
  empleadoActual = null;
  try{
    if(typeof _mpeAdminActivo !== 'undefined') _mpeAdminActivo = false;
    if(typeof _mpeAdminOff !== 'undefined') _mpeAdminOff = false;
    sessionStorage.removeItem('mpe_admin_off');
  } catch(e){}
  localStorage.removeItem('empleado_email');
  localStorage.removeItem('empleado_nombre');
  try{ if(typeof lexRealtimeDesconectar === 'function') lexRealtimeDesconectar(); } catch(e){}
  alert('Tu acceso fue deshabilitado por el administrador. Tu sesión se cerrará ahora.');
  location.reload();
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
  _cajaCerradaHoy = false;
  aplicarEstadoCierre();
  renderCaja();
  toast('🔓 Caja desbloqueada correctamente');
  // Actualizar el badge en el panel
  const cajaEl = document.getElementById('cajaEstadoBadge');
  const btnDesbloquear = document.getElementById('btnDesbloquearCaja');
  if (cajaEl) { cajaEl.textContent = '✅ Caja abierta'; cajaEl.style.color = '#4dca6a'; }
  if (btnDesbloquear) { btnDesbloquear.disabled = true; btnDesbloquear.textContent = '✓ Ya abierta'; }
}

function adminAbrirEliminarMovimiento(){
  document.querySelectorAll('#adminModal .admin-panel').forEach(function(z){ z.classList.remove('show'); });
  var zona = document.getElementById('adminEliminarMovZone');
  if(zona) zona.classList.add('show');
  var input = document.getElementById('adminElimMovBuscar');
  if(input){ input.value = ''; setTimeout(function(){ input.focus(); }, 100); }
  var lista = document.getElementById('adminElimMovLista');
  if(lista) lista.innerHTML = '<div style="text-align:center;color:var(--muted);font-family:monospace;font-size:0.65rem;padding:20px;">Ingresa un folio o término y presiona Buscar — o deja vacío para detectar huérfanos automáticamente.</div>';
}

function adminElimMovRender(){
  var q = ((document.getElementById('adminElimMovBuscar')||{}).value||'').toLowerCase().trim();
  var lista = document.getElementById('adminElimMovLista');
  if(!lista) return;
  var todos = (D.movimientos||[]).filter(function(m){ return m && !m.borrado; });
  // Identificar huérfanos: fuente recibo pero sin recibo en appData
  function esHuerfano(m){
    return m.fuente === 'recibo' && m.folio != null &&
      !(appData.recibos||[]).some(function(r){ return r && r.folio == m.folio; });
  }
  var movs;
  if(q){
    // Con búsqueda: filtrar todos los movimientos
    movs = todos.filter(function(m){
      return (String(m.folio||'')).includes(q)
          || (m.nombre||m.descripcion||m.cat||'').toLowerCase().includes(q)
          || (m.fecha||'').includes(q);
    });
  } else {
    // Sin búsqueda: mostrar SOLO huérfanos primero
    movs = todos.filter(esHuerfano);
  }
  movs = movs.slice().sort(function(a,b){ return (b.fecha+b.hora).localeCompare(a.fecha+a.hora); }).slice(0,50);
  var status = document.getElementById('adminElimMovStatus');
  if(!movs.length){
    var msg = q ? 'Sin movimientos que coincidan' : '✅ No hay folios huérfanos en contabilidad';
    lista.innerHTML = '<div style="text-align:center;color:var(--muted);font-family:monospace;font-size:0.65rem;padding:20px;">'+msg+'</div>';
    if(status) status.textContent = '';
    return;
  }
  if(status) status.textContent = movs.length + ' movimiento(s) encontrado(s)' + (q ? '' : ' — mostrando solo huérfanos');
  // Guardar IDs en un mapa global para acceder sin comillas en onclick
  window._adminElimMovMap = {};
  lista.innerHTML = movs.map(function(m, i){
    window._adminElimMovMap['mov_'+i] = m.id;
    var huerfano = esHuerfano(m);
    var colorBg = huerfano ? 'rgba(192,22,26,0.08)' : 'rgba(255,255,255,0.03)';
    var colorBorder = huerfano ? 'rgba(192,22,26,0.35)' : 'rgba(200,149,42,0.15)';
    var etiq = huerfano ? ' <span style="background:rgba(192,22,26,0.2);color:#e85555;border-radius:3px;padding:1px 5px;font-size:0.55rem;">SIN RECIBO</span>' : '';
    var monto = (m.tipo==='ingreso'?'+':'−') + '$' + fmt(m.monto);
    var color = m.tipo==='ingreso'?'#4dca6a':'#e85555';
    var desc = esc((m.descripcion||m.nombre||m.cat||'').substring(0,70));
    return '<div style="background:'+colorBg+';border:1px solid '+colorBorder+';border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;">'
      + '<div style="flex:1;min-width:0;">'
      +   '<div style="font-family:monospace;font-size:0.68rem;color:var(--gold-l);font-weight:700;">'+esc(fmtFecha(m.fecha)||'')+' '+esc(m.hora||'')+etiq+'</div>'
      +   '<div style="font-family:monospace;font-size:0.62rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+desc+'</div>'
      + '</div>'
      + '<div style="font-family:monospace;font-size:0.72rem;font-weight:700;color:'+color+';white-space:nowrap;">'+esc(monto)+'</div>'
      + '<button data-movkey="mov_'+i+'" onclick="adminElimMovConfirmar(this.dataset.movkey)" '
      + 'style="background:rgba(192,22,26,0.15);border:1px solid rgba(192,22,26,0.4);color:#e85555;border-radius:6px;padding:5px 10px;cursor:pointer;font-family:monospace;font-size:0.62rem;white-space:nowrap;">✕ Eliminar</button>'
      + '</div>';
  }).join('');
}

async function adminElimMovConfirmar(movkey){
  var id = (window._adminElimMovMap||{})[movkey];
  if(!id){ toast('Referencia no encontrada','err'); return; }
  var mov = (D.movimientos||[]).find(function(m){ return m && m.id === id; });
  if(!mov){ toast('Movimiento no encontrado','err'); return; }
  var huerfano = mov.fuente === 'recibo' && mov.folio != null &&
    !(appData.recibos||[]).some(function(r){ return r && r.folio == mov.folio; });
  var desc = (mov.descripcion||'').substring(0,80);
  var monto = (mov.tipo==='ingreso'?'+':'-') + '$' + fmt(mov.monto);
  var msg = (huerfano ? 'Folio huerfano - sin recibo vinculado:\n\n' : 'Eliminar este movimiento?\n\n') + desc + '\n' + monto + '\n\nEsta de acuerdo?';
  if(!confirm(msg)) return;
  try {
    if(typeof reconciliarAplicar !== 'function') throw new Error('reconciliarAplicar no disponible');
    var res = await reconciliarAplicar([id], { confirmar: true, sinConfirm: true });
    if(res && res.eliminados && res.eliminados.length){
      toast('Movimiento eliminado permanentemente','ok');
      if(typeof renderCaja   === 'function') renderCaja();
      if(typeof renderContab === 'function') renderContab();
      adminElimMovRender();
    }
  } catch(e){
    toast('Error al eliminar: ' + (e && e.message ? e.message : String(e)), 'err');
  }
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
      _filtrarMovsAuditado(m => !idsABorrar.has(m.id), 'adminBorrarCobrosHoy');
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

function adminAbrirR2Recovery() {
  // Cerrar panel admin para que el modal quede limpio
  const ov = document.createElement('div');
  ov.id = 'r2-recovery-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,9,5,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border-l);border-radius:var(--radius);width:560px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow-lg);">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border-l);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div>
          <div style="font-size:0.92rem;font-weight:700;color:var(--ink);">🔗 R2 Recovery Center</div>
          <div style="font-size:0.6rem;color:var(--muted);margin-top:2px;">Recuperación de recibos desde el almacenamiento R2</div>
        </div>
        <button onclick="document.getElementById('r2-recovery-ov').remove()" style="font-size:1rem;background:none;border:none;cursor:pointer;color:var(--muted);padding:4px 8px;">✕</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1;">

        <!-- OPCIÓN 1: Vincular PDFs -->
        <div onclick="_r2RecoveryVincular()" style="display:flex;align-items:flex-start;gap:14px;padding:16px;border:1.5px solid var(--border-l);border-radius:10px;cursor:pointer;transition:all 0.15s;"
          onmouseover="this.style.borderColor='var(--gold)';this.style.background='var(--gold-bg)'"
          onmouseout="this.style.borderColor='var(--border-l)';this.style.background=''">
          <div style="font-size:1.8rem;flex-shrink:0;">🔗</div>
          <div>
            <div style="font-size:0.82rem;font-weight:700;color:var(--ink);margin-bottom:4px;">Vincular PDFs huérfanos</div>
            <div style="font-size:0.65rem;color:var(--muted);line-height:1.5;">Lista todos los PDFs en R2 y los vincula a los recibos que no tienen ruta guardada. Rápido, no modifica datos — solo actualiza la referencia al archivo.</div>
          </div>
        </div>

      </div>
    </div>`;
  document.body.appendChild(ov);
}

function _r2RecoveryVincular() {
  document.getElementById('r2-recovery-ov').remove();
  adminVincularPDFsR2();
}

async function adminVincularPDFsR2() {
  if (!window.SB_DESPACHO_ID || typeof window.listarR2 !== 'function') {
    toast('⚠ R2 no disponible', 'err'); return;
  }

  // Overlay de progreso
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,9,5,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border-l);border-radius:var(--radius);width:520px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow-lg);">
      <div style="padding:16px 18px;border-bottom:1px solid var(--border-l);display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:0.88rem;font-weight:700;color:var(--ink);">🔗 Vincular PDFs desde R2</div>
        <button id="r2vBtnCerrar" style="font-size:1rem;background:none;border:none;cursor:pointer;color:var(--muted);display:none;">✕ Cerrar</button>
      </div>
      <div id="r2v-log" style="flex:1;overflow-y:auto;padding:12px 16px;font-family:'JetBrains Mono',monospace;font-size:0.65rem;line-height:1.8;color:var(--ink);"></div>
      <div style="padding:10px 16px;border-top:1px solid var(--border-l);flex-shrink:0;">
        <div id="r2v-barra-wrap" style="background:var(--border-l);border-radius:4px;height:6px;overflow:hidden;">
          <div id="r2v-barra" style="height:100%;background:var(--gold);width:0%;transition:width 0.3s;"></div>
        </div>
        <div id="r2v-status" style="font-size:0.6rem;color:var(--muted);margin-top:4px;">Iniciando…</div>
      </div>
    </div>`;
  document.body.appendChild(ov);

  const log = document.getElementById('r2v-log');
  const barra = document.getElementById('r2v-barra');
  const status = document.getElementById('r2v-status');
  const btnCerrar = document.getElementById('r2vBtnCerrar');
  btnCerrar.onclick = () => ov.remove();

  function _log(msg, color) {
    const d = document.createElement('div');
    d.style.color = color || 'var(--ink)';
    d.textContent = msg;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  try {
    // 1) Listar TODOS los archivos en R2/recibos/
    _log('📦 Listando archivos en R2…');
    status.textContent = 'Consultando R2…';
    const prefix = window.SB_DESPACHO_ID + '/recibos/';
    const objetos = await window.listarR2(prefix, 'recibos');
    if (!objetos || !objetos.length) {
      _log('⚠ No se encontraron archivos en R2/recibos/', 'var(--rojo)');
      btnCerrar.style.display = 'block'; return;
    }
    _log(`✓ ${objetos.length} archivos encontrados en R2`, 'var(--verde)');

    // 2) Construir mapa: nombreArchivo → ruta completa en R2
    const mapaR2 = {};
    objetos.forEach(obj => {
      const ruta = obj.key || obj.name || '';
      const nombre = ruta.split('/').pop(); // ej: "26-072B.pdf"
      if (nombre) mapaR2[nombre.toLowerCase()] = ruta;
    });
    _log(`📋 Archivos indexados: ${Object.keys(mapaR2).length}`);

    // 3) Obtener todos los recibos en memoria
    const _arr1 = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
    const _arr2 = (typeof REC !== 'undefined' && REC.recibos) ? REC.recibos : [];
    const todosRecibos = [...new Map(
      [..._arr1, ..._arr2].filter(x => x && x.folio != null)
        .map(x => [x.folio + '|' + (x.letra || letraVersion(x) || 'A'), x])
    ).values()];
    _log(`📄 Recibos en memoria: ${todosRecibos.length}`);

    // 4) Para cada recibo sin archivoR2, buscar en R2 por folio+letra
    let vinculados = 0, yaVinculados = 0, noEncontrados = 0;
    const total = todosRecibos.length;

    for (let i = 0; i < todosRecibos.length; i++) {
      const r = todosRecibos[i];
      barra.style.width = Math.round((i / total) * 100) + '%';
      status.textContent = `Procesando ${i + 1} / ${total}…`;

      // Si ya tiene archivoR2 válido, saltar
      if (r.archivoR2) { yaVinculados++; continue; }

      const letra = (r.letra || letraVersion(r) || 'A').toUpperCase();
      const anio = r.anio_folio ? String(r.anio_folio).slice(2) : String(new Date().getFullYear()).slice(2);
      const folioStr = folioFormato ? folioFormato(r.folio) : String(r.folio).padStart(3,'0');

      // Patrones de nombre a buscar (varios formatos posibles)
      const patrones = [
        `${anio}-${folioStr}${letra}.pdf`,           // 26-072B.pdf
        `${folioStr}${letra}.pdf`,                    // 072B.pdf
        `f-${anio}${folioStr}${letra}.pdf`,           // f-26072B.pdf
        `recibo-${folioStr}${letra}.pdf`,             // recibo-072B.pdf
        r.archivo ? r.archivo.toLowerCase() : null,   // nombre guardado en el recibo
      ].filter(Boolean);

      let rutaEncontrada = null;
      for (const patron of patrones) {
        if (mapaR2[patron]) { rutaEncontrada = mapaR2[patron]; break; }
      }

      // También buscar por coincidencia parcial (folio+letra en cualquier parte del nombre)
      if (!rutaEncontrada) {
        const clave = folioStr + letra;
        const match = Object.keys(mapaR2).find(k => k.includes(clave.toLowerCase()));
        if (match) rutaEncontrada = mapaR2[match];
      }

      if (rutaEncontrada) {
        const nombreArchivo = rutaEncontrada.split('/').pop();
        r.archivoR2 = nombreArchivo;
        if (!r.archivo) r.archivo = nombreArchivo;
        vinculados++;
        _log(`✓ #${folioStr}${letra} → ${nombreArchivo}`, 'var(--verde)');
      } else {
        noEncontrados++;
        if (letra !== 'A') { // Solo reportar sub-folios faltantes (B,C,D…)
          _log(`  ⚠ #${folioStr}${letra} — sin PDF en R2`, 'rgba(200,149,42,0.7)');
        }
      }
    }

    barra.style.width = '100%';

    // 5) Guardar cambios en Supabase si hubo vinculaciones
    if (vinculados > 0) {
      _log(`
💾 Guardando ${vinculados} vínculos en Supabase…`, 'var(--gold-d)');
      status.textContent = 'Guardando…';
      try {
        if (typeof syncEstadoSupabase === 'function') await syncEstadoSupabase();
        else if (typeof save === 'function') save();
        _log('✓ Guardado en Supabase', 'var(--verde)');
      } catch(e) { _log('⚠ Error al guardar: ' + e.message, 'var(--rojo)'); }
    }

    // 6) Resumen final
    _log('─'.repeat(40));
    _log(`📊 RESULTADO:`, 'var(--gold-d)');
    _log(`   ✓ Vinculados ahora: ${vinculados}`, 'var(--verde)');
    _log(`   ✓ Ya tenían vínculo: ${yaVinculados}`);
    _log(`   ⚠ Sin PDF en R2: ${noEncontrados}`, noEncontrados > 0 ? 'rgba(200,149,42,0.8)' : 'var(--muted)');
    status.textContent = `Listo — ${vinculados} vinculados, ${noEncontrados} sin PDF`;
    if (vinculados > 0) toast(`✓ ${vinculados} recibos vinculados a R2`, 'ok');
    else toast('Sin cambios — todos ya estaban vinculados', 'ok');

  } catch(e) {
    _log('❌ Error: ' + e.message, 'var(--rojo)');
    console.error('[VincularR2]', e);
    status.textContent = 'Error: ' + e.message;
  }

  btnCerrar.style.display = 'block';
}

async function adminModernizarPDFs() {
  var recibos = (appData.recibos || []).filter(function(r){ return r && r.folio != null; });
  if (!recibos.length) { if(typeof toast==='function') toast('No hay recibos para actualizar', 'err'); return; }
  if (!confirm('Modernizar el diseno de los PDFs de TODOS los recibos (' + recibos.length + ')?\n\nEsto aplica:\n  - Cuadro del numero de folio mas compacto (menos alto)\n  - Cuadro de TRAMITE CANCELADO sin relleno - solo borde y letras rojas\n\nEl proceso tarda unos segundos por recibo. No cierres la app.')) return;
  var ok = 0, err = 0;
  for (var i = 0; i < recibos.length; i++) {
    var r = recibos[i];
    var letra = r.letra || 'A';
    var folioStr = typeof folioConLetra === 'function' ? folioConLetra(r.folio, r.anio_folio, letra) : r.folio + letra;
    if(typeof toast==='function') toast('Modernizando ' + (i+1) + '/' + recibos.length + ' — #' + folioStr);
    try {
      var qrTxt = 'LEX-MEXICO|Folio:' + folioStr + '|' + (r.nombre||'') + '|' + (r.fecha_recibo||r.fecha||'') + ' ' + (r.hora_recibo||r.hora||'');
      var qrURL = await qrToDataURL(qrTxt);
      var doc = await generarPDF(Object.assign({}, r, { anio_folio: r.anio_folio||2026, letra: letra }), r.folio, qrURL);
      r.pdfBase64 = doc.output('datauristring');
      try { subirPDFaDrive(doc.output('blob'), folioStr + '.pdf'); } catch(e2){}
      ok++;
    } catch(e) {
      console.warn('[modernizarPDFs] error en folio', r.folio, e);
      err++;
    }
    await new Promise(function(res){ setTimeout(res, 100); });
  }
  Object.keys(localStorage).filter(function(k){ return k.startsWith('lex_backup'); }).forEach(function(k){ localStorage.removeItem(k); });
  try { await actualizarArchivoControl(); } catch(e){}
  try { await syncEstadoSupabase(); } catch(e){}
  if(typeof toast==='function') toast('OK: ' + ok + ' PDFs modernizados' + (err ? ' · ' + err + ' errores' : ''));
}

async function adminRegenerarPDFsDocumentos() {
  var recibos = (appData.recibos || []).filter(function(r){ return r && r.folio != null; });
  if (!recibos.length) { if(typeof toast==='function') toast('No hay recibos para regenerar', 'err'); return; }
  if (!confirm('Regenerar TODOS los PDFs (' + recibos.length + ') con el formato más reciente?\n\nAplica TODO lo último: (1) ya no se imprime "PAGOS PARCIALES" — ese detalle ahora vive en la Ficha del Folio (Autorizó incluido); (2) corrige la etiqueta Copia Simple/Escaneo en "DOCUMENTOS QUE DEJA EL INTERESADO"; (3) en actualizaciones de Costo Pactado sin Servicio Complementario, la columna cambia a SALDO RESTANTE con LIQUIDACIÓN TOTAL/ADEUDO ANTERIOR; (4) corrige el saldo en $0.00 que salía mal al reimprimir/regenerar; (5) agrega la caja "PAGO REGISTRADO EN ESTE RECIBO" también en los recibos originales (letra A), mostrando el anticipo dejado en ese recibo; (6) en esa misma caja, la columna Descripción ahora solo muestra "Autorizó: [iniciales]" — ya no el texto completo con folio y fecha repetidos.\n\nEsto reemplaza el archivo PDF guardado de cada recibo por una versión nueva. El papel ya firmado no cambia, solo el PDF archivado en el sistema.\n\nEl proceso tarda unos segundos por recibo. No cierres la app.')) return;
  var ok = 0, err = 0;
  for (var i = 0; i < recibos.length; i++) {
    var r = recibos[i];
    var letra = r.letra || 'A';
    var folioStr = typeof folioConLetra === 'function' ? folioConLetra(r.folio, r.anio_folio, letra) : r.folio + letra;
    if(typeof toast==='function') toast('Regenerando ' + (i+1) + '/' + recibos.length + ' — #' + folioStr);
    try {
      var qrTxt = 'LEX-MEXICO|Folio:' + folioStr + '|' + (r.nombre||'') + '|' + (r.fecha_recibo||r.fecha||'') + ' ' + (r.hora_recibo||r.hora||'');
      var qrURL = await qrToDataURL(qrTxt);
      var doc = await generarPDF(Object.assign({}, r, { anio_folio: r.anio_folio||2026, letra: letra }), r.folio, qrURL);
      r.pdfBase64 = doc.output('datauristring');
      var r2n = (typeof _nombreArchivoR2 === 'function') ? _nombreArchivoR2(folioStr, r.nombre||'') : folioStr+'.pdf';
      try { await subirPDFaDrive(doc.output('blob'), folioStr + '.pdf', r2n); } catch(e2){}
      ok++;
    } catch(e) {
      console.warn('[regenerarPDFsDocumentos] error en folio', r.folio, e);
      err++;
    }
    await new Promise(function(res){ setTimeout(res, 100); });
  }
  Object.keys(localStorage).filter(function(k){ return k.startsWith('lex_backup'); }).forEach(function(k){ localStorage.removeItem(k); });
  try { await actualizarArchivoControl(); } catch(e){}
  try { await syncEstadoSupabase(); } catch(e){}
  if(typeof toast==='function') toast('OK: ' + ok + ' PDFs regenerados' + (err ? ' · ' + err + ' errores' : ''));
}

async function adminRegenerarPDFsVehiculares() {
  var recibos = (appData.recibos || []).filter(_vehPDFEsCandidato);
  if (!recibos.length) { if(typeof toast==='function') toast('No se encontraron recibos vehiculares', 'err'); return; }
  var muestra = recibos.slice(0,8).map(function(r){ return '#'+folioConLetra(r.folio, r.anio_folio||2026, r.letra||'A'); }).join(', ') + (recibos.length>8 ? ' +'+(recibos.length-8)+' más' : '');
  if (!confirm('Regenerar ' + recibos.length + ' PDF(s) de recibos vehiculares?\n\n' +
    'Aplica a cada uno los datos más recientes del vehículo: estado de placas con nombre completo, campo Tipo, Serie/NIV y ¿Adeuda Tenencias?\n\n' +
    'Folios: ' + muestra + '\n\n' +
    'Esto reemplaza el archivo PDF guardado de cada recibo por una versión nueva. El papel ya firmado no cambia, solo el PDF archivado en el sistema.\n\n¿Continuar?')) return;
  var ok = 0, err = 0;
  for (var i = 0; i < recibos.length; i++) {
    var r = recibos[i];
    var letra = r.letra || 'A';
    var folioStr = typeof folioConLetra === 'function' ? folioConLetra(r.folio, r.anio_folio, letra) : r.folio + letra;
    if(typeof toast==='function') toast('Regenerando ' + (i+1) + '/' + recibos.length + ' — #' + folioStr);
    try {
      var qrTxt = 'LEX-MEXICO|Folio:' + folioStr + '|' + (r.nombre||'') + '|' + (r.fecha_recibo||r.fecha||'') + ' ' + (r.hora_recibo||r.hora||'');
      var qrURL = await qrToDataURL(qrTxt);
      var doc = await generarPDF(Object.assign({}, r, { anio_folio: r.anio_folio||2026, letra: letra }), r.folio, qrURL);
      r.pdfBase64 = doc.output('datauristring');
      var r2n = (typeof _nombreArchivoR2 === 'function') ? _nombreArchivoR2(folioStr, r.nombre||'') : folioStr+'.pdf';
      try { await subirPDFaDrive(doc.output('blob'), folioStr + '.pdf', r2n); } catch(e2){}
      ok++;
    } catch(e) {
      console.warn('[regenerarPDFsVehiculares] error en folio', r.folio, e);
      err++;
    }
    await new Promise(function(res){ setTimeout(res, 100); });
  }
  Object.keys(localStorage).filter(function(k){ return k.startsWith('lex_backup'); }).forEach(function(k){ localStorage.removeItem(k); });
  try { await actualizarArchivoControl(); } catch(e){}
  try { await syncEstadoSupabase(); } catch(e){}
  if(typeof toast==='function') toast('OK: ' + ok + ' PDFs vehiculares regenerados' + (err ? ' · ' + err + ' errores' : ''));
}

async function adminCorregirLetrasMovimientos(silencioso){
  if(!Array.isArray(D.movimientos)){ if(!silencioso) toast('Sin movimientos en memoria','err'); return; }
  var corregidos = 0;
  // ── PASO 1: Corregir letras de movimientos de liquidación ──────
  D.movimientos.forEach(function(m){
    if(!m || m.fuente !== 'recibo' || m.borrado || m.folio == null) return;
    var recibosDelFolio = (appData.recibos||[]).filter(function(r){
      return r.folio === m.folio && !r.esComplemento;
    });
    if(!recibosDelFolio.length) return;
    var letraMax = recibosDelFolio.reduce(function(max, r){
      var l = (r.letra || (typeof letraVersion==='function'?letraVersion(r):'A') || 'A');
      return l > max ? l : max;
    }, 'A');
    var esLiquidacion = (m.estatus==='Liquidado'||m.estatus==='Liquidación'||(m.cat||'').includes('Liquidac'));
    // FIX (caso real: folio 56): antes se reasignaba a letraMax con solo que
    // "letraMax > letra actual", asumiendo que la liquidación SIEMPRE pertenece
    // a la última versión del folio. Eso rompe folios liquidados más de una
    // vez en su historia (ej: 56D liquidó $10,000, luego se agregó más adeudo
    // y se volvió a liquidar en 56G) — el movimiento D, correcto, se empujaba
    // a G en cada carga. Ahora solo se toca si la letra actual es HUÉRFANA
    // (no corresponde a ningún recibo real de este folio); si ya coincide con
    // una versión real existente, se deja intacta sin importar el estatus.
    var letraActual = m.letra || 'A';
    var letraEsValida = recibosDelFolio.some(function(r){
      var l = (r.letra || (typeof letraVersion==='function'?letraVersion(r):'A') || 'A');
      return l === letraActual;
    });
    if(esLiquidacion && !letraEsValida && letraMax > letraActual){
      var letraVieja = letraActual;
      var rRef = (appData.recibos||[]).find(function(r){return r.folio===m.folio&&!r.esComplemento;});
      var folioViejo = typeof folioConLetra==='function'
        ? folioConLetra(m.folio, null, letraVieja)
        : String(m.folio).padStart(4,'0')+letraVieja;
      var folioNuevo = typeof folioConLetra==='function'
        ? folioConLetra(m.folio, rRef ? rRef.anio_folio : null, letraMax)
        : String(m.folio).padStart(4,'0')+letraMax;
      m.letra       = letraMax;
      m.cat         = (m.cat||'').replace(folioViejo, folioNuevo);
      m.descripcion = (m.descripcion||'').replace(folioViejo, folioNuevo);
      console.log('[CorregirLetras] Mov '+m.id+': '+folioViejo+' → '+folioNuevo);
      corregidos++;
    }
  });
  // ── PASO 2: Corregir letras de TODOS los movimientos en contabilidad ──────
  // Agrupa por folio, compara contra los recibos reales y asigna la letra correcta.
  // Movimientos con misma fecha+hora+monto pero distintas letras ya asignadas
  // se consideran versiones distintas (A y B legítimos) y NO se tocan.
  var corregidosContab = 0;
  var _movsPorFolio = {};
  D.movimientos.forEach(function(m){
    if(!m || m.borrado || m.fuente !== 'recibo' || m.folio == null) return;
    var k = String(m.folio);
    if(!_movsPorFolio[k]) _movsPorFolio[k] = [];
    _movsPorFolio[k].push(m);
  });
  Object.keys(_movsPorFolio).forEach(function(folioStr){
    var folio = Number(folioStr);
    var movs  = _movsPorFolio[folioStr];
    // Recibos del folio ordenados por letra A < B < C
    var recs = (appData.recibos||[])
      .filter(function(r){ return r.folio === folio && !r.esComplemento; })
      .sort(function(a,b){
        var la = a.letra||'A', lb = b.letra||'A';
        return la < lb ? -1 : la > lb ? 1 : 0;
      });
    if(!recs.length) return;
    var letrasRec = recs.map(function(r){ return r.letra||'A'; });
    // ¿Ya están todos bien asignados? (cada movimiento tiene una letra única de recibo)
    var letrasTomadas = {};
    var movsSinCorrecta = [];
    movs.forEach(function(m){
      var l = m.letra || 'A';
      if(letrasRec.indexOf(l) >= 0 && !letrasTomadas[l]){
        letrasTomadas[l] = true;
      } else {
        movsSinCorrecta.push(m);
      }
    });
    if(!movsSinCorrecta.length) return; // todo OK
    // Letras aún disponibles (no ocupadas por movimientos correctos)
    var letrasDisp = letrasRec.filter(function(l){ return !letrasTomadas[l]; });
    if(!letrasDisp.length) return;
    // Ordenar los movimientos incorrectos cronológicamente para asignar letras en orden
    movsSinCorrecta.sort(function(a,b){
      var ta = (a.fecha||'')+'T'+(a.hora||'00:00');
      var tb = (b.fecha||'')+'T'+(b.hora||'00:00');
      return ta.localeCompare(tb);
    });
    movsSinCorrecta.forEach(function(m, i){
      if(i >= letrasDisp.length) return;
      var letraEsperada = letrasDisp[i];
      var letraVieja    = m.letra || 'A';
      if(letraVieja === letraEsperada) return;
      var rRef = recs.find(function(r){ return (r.letra||'A') === letraEsperada; });
      var anioFolio = rRef ? rRef.anio_folio : null;
      var folioViejo = typeof folioConLetra==='function'
        ? folioConLetra(folio, null, letraVieja)
        : String(folio).padStart(4,'0')+letraVieja;
      var folioNuevo = typeof folioConLetra==='function'
        ? folioConLetra(folio, anioFolio, letraEsperada)
        : String(folio).padStart(4,'0')+letraEsperada;
      m.letra       = letraEsperada;
      m.cat         = (m.cat||'').replace(folioViejo, folioNuevo);
      m.descripcion = (m.descripcion||'').replace(folioViejo, folioNuevo);
      corregidosContab++;
      console.log('[CorregirLetras] Contab mov '+(m.id||'?')+': '+folioViejo+' → '+folioNuevo);
    });
  });
  // ── PASO 3: Verificar y corregir paths de R2 en documentos de pendientes ──
  var r2Corregidos = 0;
  if(typeof window.subirR2 === 'function' && window.SB_DESPACHO_ID && Array.isArray(D.pendientes)){
    for(var pi = 0; pi < D.pendientes.length; pi++){
      var p = D.pendientes[pi];
      if(!p || !Array.isArray(p.documentos) || !p.documentos.length) continue;
      for(var di = 0; di < p.documentos.length; di++){
        var doc = p.documentos[di];
        if(!doc) continue;
        // Corregir bucket incorrecto (guardado en 'recibos' en lugar de 'placas')
        if(doc.r2path && doc.bucket && doc.bucket !== 'placas'){
          console.warn('[CorregirR2] doc en bucket incorrecto:', doc.bucket, doc.r2path);
          // Intentar mover: descargar de bucket viejo y resubir a 'placas'
          try {
            if(typeof window.descargarR2 === 'function'){
              var blob = await window.descargarR2(doc.r2path, doc.bucket);
              if(blob && blob.size > 0){
                var nombreCliente = (p.persona||p.nombre||'cliente').replace(/[^a-zA-Z0-9_\-]/g,'_').substring(0,40);
                var newPath = window.SB_DESPACHO_ID+'/placas/'+nombreCliente+'/'+Date.now()+'_'+doc.nombre;
                var file = new File([blob], doc.nombre, {type: doc.tipo || blob.type});
                var ok = await window.subirR2(file, newPath, 'recibos');
                if(ok){
                  // Borrar del bucket viejo
                  if(typeof window.borrarR2 === 'function'){
                    await window.borrarR2(doc.r2path, doc.bucket).catch(function(e){ console.warn('borrar viejo:', e); });
                  }
                  doc.r2path = newPath;
                  doc.bucket = 'placas';
                  r2Corregidos++;
                  console.log('[CorregirR2] Movido a placas:', newPath);
                }
              }
            }
          } catch(e){ console.warn('[CorregirR2] error moviendo doc:', e); }
        }
        // Corregir documentos con solo base64 (legacy) — registrar r2path si falta
        if(doc.base64 && !doc.r2path && typeof window.subirR2 === 'function'){
          try {
            var nombreCliente2 = (p.persona||p.nombre||'cliente').replace(/[^a-zA-Z0-9_\-]/g,'_').substring(0,40);
            var newPath2 = window.SB_DESPACHO_ID+'/placas/'+nombreCliente2+'/'+Date.now()+'_'+doc.nombre;
            var mimeType = doc.tipo || 'application/octet-stream';
            var b64data = doc.base64.includes(',') ? doc.base64.split(',')[1] : doc.base64;
            var byteChars = atob(b64data);
            var byteArr = new Uint8Array(byteChars.length);
            for(var bi=0; bi<byteChars.length; bi++) byteArr[bi] = byteChars.charCodeAt(bi);
            var blob2 = new Blob([byteArr], {type: mimeType});
            var file2 = new File([blob2], doc.nombre, {type: mimeType});
            var ok2 = await window.subirR2(file2, newPath2, 'recibos');
            if(ok2){
              doc.r2path = newPath2;
              doc.bucket = 'placas';
              delete doc.base64; // limpiar base64 del objeto para ahorrar espacio
              r2Corregidos++;
              console.log('[CorregirR2] base64→R2:', newPath2);
            }
          } catch(e){ console.warn('[CorregirR2] error subiendo base64:', e); }
        }
      }
    }
  }
  // ── PASO 4: Guardar si hubo cambios ───────────────────────────
  var totalCambios = corregidos + corregidosContab + r2Corregidos;
  if(totalCambios > 0){
    try {
      Object.keys(localStorage).filter(function(k){ return k.startsWith('lex_backup'); })
        .forEach(function(k){ localStorage.removeItem(k); });
      await syncEstadoSupabase();
    } catch(e){ console.warn('[CorregirLetras] sync error:', e); }
    if(typeof renderContab === 'function') renderContab();
    if(typeof renderPend === 'function') renderPend();
  }
  if(!silencioso){
    if(totalCambios === 0) toast('No se encontraron problemas que corregir ✓');
    else toast('✅ '+corregidos+' liq. + '+corregidosContab+' contab. + '+r2Corregidos+' R2 corregidos');
  } else if(totalCambios > 0){
    console.log('[CorregirLetras+R2] Auto-corrección: '+corregidos+' liq., '+corregidosContab+' contab., '+r2Corregidos+' R2');
  }
}

async function adminSimplificarDescripcionesRecibos(silencioso){
  if(typeof D==='undefined' || !Array.isArray(D.movimientos)){ if(!silencioso) toast('Sin movimientos en memoria','err'); return; }
  if(!silencioso && !confirm('SIMPLIFICAR DESCRIPCIONES HISTÓRICAS\n\nVa a reescribir la descripción de TODOS los movimientos de recibo ya guardados en Contabilidad, cambiando el formato viejo "Recibo #X · Nombre · Concepto" por "Concepto — Descripción" (el mismo formato que ya usan los recibos nuevos).\n\nNo toca montos, fechas ni folios, solo el texto de la descripción.\n\n¿Continuar?')) return;
  var corregidos = 0;
  D.movimientos.forEach(function(m){
    if(!m || m.borrado || m.fuente !== 'recibo' || m.folio == null) return;
    var letra = m.letra || 'A';
    var rec = (appData.recibos||[]).find(function(r){
      return r.folio === m.folio && (r.letra||(typeof letraVersion==='function'?letraVersion(r):'A')||'A') === letra;
    });
    if(!rec) return;
    var txt = typeof _conceptoTxtDeRecibo === 'function' ? _conceptoTxtDeRecibo(rec) : '';
    if(!txt || m.descripcion === txt) return;
    m.descripcion = txt;
    corregidos++;
  });
  if(corregidos > 0){
    try {
      if(typeof _ultimoSyncPropio!=='undefined') _ultimoSyncPropio = Date.now();
      if(typeof save === 'function') save();
      await syncEstadoSupabase();
    } catch(e){ console.warn('[SimplificarDesc] sync error:', e); }
    if(typeof renderCaja === 'function') renderCaja();
    if(typeof renderContab === 'function') renderContab();
    if(typeof badges === 'function') badges();
  }
  if(!silencioso) toast(corregidos > 0 ? ('✅ '+corregidos+' descripciones simplificadas') : 'No había descripciones para simplificar ✓');
  else if(corregidos > 0) console.log('[SimplificarDesc] '+corregidos+' descripciones actualizadas');
  return corregidos;
}

async function adminAgruparDescripcionesCarrito(silencioso){
  if(typeof D==='undefined' || !Array.isArray(D.movimientos)){ if(!silencioso) toast('Sin movimientos en memoria','err'); return; }
  if(!silencioso && !confirm('AGRUPAR DESCRIPCIONES DE CARRITO\n\nVa a revisar todos los movimientos de "[Carrito]" ya guardados y, donde el mismo artículo se haya agregado dos o más veces por separado (ej. "Impresión CURP $45.00 | Impresión CURP $45.00"), reescribir la descripción como "2× Impresión CURP $45.00 c/u $90.00".\n\nNo toca montos, fechas ni folios, solo el texto de la descripción.\n\n¿Continuar?')) return;
  var corregidos = 0;
  D.movimientos.forEach(function(m){
    if(!m || m.borrado || typeof m.descripcion !== 'string') return;
    if(m.descripcion.indexOf('[Carrito] ') !== 0) return;
    var resto = m.descripcion.slice('[Carrito] '.length);
    var segmentos = resto.split(' | ');
    if(segmentos.length < 2) return;
    var grupos = [];
    var indice = {};
    var parseable = true;
    segmentos.forEach(function(seg){
      var match = /^(.*)\s\$([\d,]+\.\d{2})$/.exec(seg);
      if(!match){ parseable = false; return; }
      var desc = match[1];
      var unit = parseFloat(match[2].replace(/,/g,''));
      var clave = desc + '|' + unit;
      if(Object.prototype.hasOwnProperty.call(indice, clave)){
        grupos[indice[clave]].cant++;
      } else {
        indice[clave] = grupos.length;
        grupos.push({ desc: desc, unit: unit, cant: 1 });
      }
    });
    if(!parseable) return;
    var huboRepetidos = grupos.some(function(g){ return g.cant > 1; });
    if(!huboRepetidos) return;
    var nuevoResto = grupos.map(function(g){
      if(g.cant > 1){
        return g.cant+'× '+g.desc+' $'+fmt(g.unit)+' c/u $'+fmt(g.unit*g.cant);
      }
      return g.desc+' $'+fmt(g.unit);
    }).join(' | ');
    var nuevaDescripcion = '[Carrito] '+nuevoResto;
    if(nuevaDescripcion === m.descripcion) return;
    m.descripcion = nuevaDescripcion;
    corregidos++;
  });
  if(corregidos > 0){
    try {
      if(typeof _ultimoSyncPropio!=='undefined') _ultimoSyncPropio = Date.now();
      if(typeof save === 'function') save();
      await syncEstadoSupabase();
    } catch(e){ console.warn('[AgruparCarrito] sync error:', e); }
    if(typeof renderCaja === 'function') renderCaja();
    if(typeof renderContab === 'function') renderContab();
  }
  if(!silencioso) toast(corregidos > 0 ? ('✅ '+corregidos+' descripción(es) de carrito agrupadas') : 'No había descripciones de carrito repetidas para agrupar ✓');
  else if(corregidos > 0) console.log('[AgruparCarrito] '+corregidos+' descripciones actualizadas');
  return corregidos;
}

async function adminVincularHistorialContab(){
  if(typeof D==='undefined' || !Array.isArray(D.movimientos)){ alert('Sin movimientos de contabilidad en memoria.'); return; }
  if(!confirm('VINCULAR HISTORIAL ↔ CONTABILIDAD\n\nVa a:\n• Reparar los enlaces folio/letra de los movimientos para que cuadren con su recibo (NO toca montos ni fechas).\n• Regularizar el orden del historial para que siga el mismo criterio que contabilidad (fecha del movimiento + folio).\n\n¿Continuar?')) return;
  if(typeof _ultimoSyncPropio!=='undefined') _ultimoSyncPropio=Date.now();
  // 1) Reparar enlaces (letras/folio) reutilizando la corrección existente.
  try{ await adminCorregirLetrasMovimientos(true); }catch(e){ console.warn('[vincular] corregir letras', e); }
  // 2) Auditoría de correspondencia movimiento ↔ recibo (por folio+letra).
  var recKeys = new Set();
  (appData.recibos||[]).forEach(function(r){ if(r && r.folio!=null && !r.esComplemento) recKeys.add(Number(r.folio)+'|'+(r.letra||'A')); });
  var foliosConRecibo = new Set();
  (appData.recibos||[]).forEach(function(r){ if(r && r.folio!=null) foliosConRecibo.add(Number(r.folio)); });
  var movKeys = new Set();
  var huerfanos = [];
  D.movimientos.forEach(function(m){
    if(!m || m.fuente!=='recibo' || m.borrado || m.folio==null) return;
    var k = Number(m.folio)+'|'+(m.letra||'A');
    movKeys.add(k);
    if(!foliosConRecibo.has(Number(m.folio))) huerfanos.push(folioConLetra(m.folio, null, m.letra||'A'));
  });
  var vinculados = 0; recKeys.forEach(function(k){ if(movKeys.has(k)) vinculados++; });
  var sinMovimiento = [];
  recKeys.forEach(function(k){ if(!movKeys.has(k)){ var p=k.split('|'); sinMovimiento.push(folioConLetra(Number(p[0]), 2026, p[1])); } });
  // Dedup y orden de listas
  huerfanos = Array.from(new Set(huerfanos));
  sinMovimiento = Array.from(new Set(sinMovimiento));
  // 3) Persistir reparaciones + re-render (el historial se reordena al criterio de contabilidad).
  try{ if(typeof save==='function') save(); }catch(e){ if(typeof registrarError==='function') registrarError('save (guardado)', e); }
  try{ if(typeof actualizarArchivoControl==='function') await actualizarArchivoControl(); }catch(e){ if(typeof registrarError==='function') registrarError('actualizarArchivoControl', e); }
  try{ if(typeof syncEstadoSupabase==='function') await syncEstadoSupabase(); }catch(e){ if(typeof registrarError==='function') registrarError('syncEstadoSupabase', e); }
  if(typeof renderHistorial==='function') renderHistorial();
  if(typeof renderContab==='function') renderContab();
  // 4) Reporte
  var msg = 'VINCULACIÓN TERMINADA\n\n'
    + '• Recibos vinculados a su movimiento: '+vinculados+'\n'
    + '• Historial reordenado al mismo criterio que contabilidad (fecha del movimiento + folio).\n'
    + '• Enlaces folio/letra revisados y corregidos donde hacía falta (sin tocar montos).\n\n';
  if(huerfanos.length) msg += '⚠ Movimientos huérfanos (sin recibo) — '+huerfanos.length+': '+huerfanos.slice(0,25).join(', ')+(huerfanos.length>25?' …':'')+'\n';
  if(sinMovimiento.length) msg += '⚠ Recibos sin movimiento en contabilidad — '+sinMovimiento.length+': '+sinMovimiento.slice(0,25).join(', ')+(sinMovimiento.length>25?' …':'')+'\n';
  if(!huerfanos.length && !sinMovimiento.length) msg += '✅ Todo cuadra: cada recibo tiene su movimiento y viceversa.';
  alert(msg);
}

function _autoCorregirLetrasR2(){
  if(_autoCorregirTimer) clearTimeout(_autoCorregirTimer);
  _autoCorregirTimer = setTimeout(function(){
    adminCorregirLetrasMovimientos(true).catch(function(e){ console.warn('[AutoCorregir]', e); });
  }, 8000);
}

async function adminMarcaPagadoPDFs(){
  const candidatos = (appData.recibos || []).filter(function(r){
    if (r.cancelado || r.esComplemento) return false;
    const saldo = parseFloat(r.saldoPendiente !== undefined ? r.saldoPendiente
                           : r.saldoNuevo     !== undefined ? r.saldoNuevo
                           : r.saldo          !== undefined ? r.saldo : 999);
    const tot   = parseFloat(r.total || r.totalGeneral || 0);
    return saldo <= 0 && tot > 0;
  });
  if (!candidatos.length) { toast('No hay recibos liquidados para procesar', 'err'); return; }
  if (!confirm('¿Regenerar PDFs de ' + candidatos.length + ' recibo(s) liquidados en una sola exhibición?\n\nSe añadirá la marca de agua PAGADO.\nNo cierre la app durante el proceso.')) return;
  var ok = 0, err = 0;
  for (var i = 0; i < candidatos.length; i++) {
    var r = candidatos[i];
    var letra     = r.letra || 'A';
    var folioStr  = typeof folioConLetra === 'function' ? folioConLetra(r.folio, r.anio_folio, letra) : String(r.folio) + letra;
    toast('⏳ Procesando ' + (i+1) + '/' + candidatos.length + ' — #' + folioStr);
    try {
      // Normalizar campos antes de pasar al generador
      var datosN = Object.assign({}, r, {
        totalGeneral: parseFloat(r.totalGeneral || r.total || 0),
        saldoNuevo:   parseFloat(r.saldoNuevo   !== undefined ? r.saldoNuevo   : r.saldoPendiente !== undefined ? r.saldoPendiente : r.saldo || 0),
        saldoPendiente: parseFloat(r.saldoPendiente !== undefined ? r.saldoPendiente : r.saldo || 0),
        anio_folio: r.anio_folio || 2026,
        letra: letra
      });
      var qrTxt = 'LEX-MEXICO|Folio:' + folioStr + '|' + (r.nombre||'') + '|' + (r.fecha_recibo||r.fecha||'') + ' ' + (r.hora_recibo||r.hora||'');
      var qrURL = typeof qrToDataURL === 'function' ? await qrToDataURL(qrTxt) : null;
      var nombrePDF = r.archivo || (folioStr + '.pdf'); // nombre corto canónico
      var pdfBlob;
      {
        var doc = await generarPDF(datosN, r.folio, qrURL);
        pdfBlob = doc.output('blob');
        r.pdfBase64 = doc.output('datauristring');
      }
      {
        // Cachear base64 desde el blob (ya asignado arriba vía datauristring)
        r.pdfBase64 = await new Promise(function(res){
          var reader = new FileReader();
          reader.onload = function(){ res(reader.result); };
          reader.readAsDataURL(pdfBlob);
        });
      }
      await subirPDFaDrive(pdfBlob, nombrePDF);
      ok++;
    } catch(e) {
      console.warn('[marcaPagado] error en folio', r.folio, e);
      err++;
    }
    await new Promise(function(res){ setTimeout(res, 120); });
  }
  try { await syncEstadoSupabase(); } catch(e){}
  toast('✅ ' + ok + ' PDFs con marca PAGADO' + (err ? ' · ' + err + ' errores' : ''));
}

async function adminMigrarFoliosInfinitos() {
  var _arr1 = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var _arr2 = (typeof REC !== 'undefined' && REC.recibos) ? REC.recibos : [];
  var _todos = [..._arr1, ..._arr2].filter(function(r){ return r && r.folio != null; });

  // ─── 1. Identificar folios base únicos (folio + año, ignorando letra) ───
  var baseSet = new Map(); // "folio|anio" → {oldFolio, oldAnio}
  _todos.forEach(function(r) {
    var k = String(r.folio) + '|' + (r.anio_folio || 0);
    if (!baseSet.has(k)) baseSet.set(k, { oldFolio: r.folio, oldAnio: r.anio_folio || 0 });
  });

  var bases = [...baseSet.values()].sort(function(a, b) {
    return a.oldAnio !== b.oldAnio ? a.oldAnio - b.oldAnio : a.oldFolio - b.oldFolio;
  });

  if (!bases.length) { toast('No hay recibos para migrar', 'err'); return; }

  // ─── 2. Asignar nuevos números 1, 2, 3… ──────────────────────────────────
  var mapping = new Map(); // "folio|anio" → newFolio
  bases.forEach(function(b, i) { mapping.set(String(b.oldFolio) + '|' + b.oldAnio, i + 1); });

  // ─── 3. Preview y confirmación ───────────────────────────────────────────
  var prevItems = bases.slice(0, 6).map(function(b) {
    var nF = mapping.get(String(b.oldFolio) + '|' + b.oldAnio);
    var anio2 = b.oldAnio ? String(b.oldAnio).slice(-2) : '??';
    return '#' + anio2 + '-' + String(b.oldFolio).padStart(3,'0') + 'A → #' + nF + 'A';
  });
  if (!confirm(
    'MIGRACIÓN A FOLIOS INFINITOS\n\n' +
    bases.length + ' folios únicos · ' + _todos.length + ' versiones totales\n\n' +
    'Primeros cambios:\n' + prevItems.join('\n') + (bases.length > 6 ? '\n…' : '') +
    '\n\n⚠ IRREVERSIBLE: renumera datos y regenera TODOS los PDFs.\n¿Continuar?'
  )) return;

  // ─── 4. Helper: texto → reemplaza "#26-083A" → "#83A" ───────────────────
  function _fixTxt(txt) {
    if (!txt) return txt;
    return txt.replace(/#(\d{2})-(\d{3})([A-Za-z])/g, function(m, a2, f3, l) {
      var nF = mapping.get(String(parseInt(f3)) + '|' + (2000 + parseInt(a2)));
      return nF != null ? '#' + nF + l.toUpperCase() : m;
    });
  }

  // Helper: buscar nueva asignación cuando el año no está disponible en la entidad
  function _mapFolioUnico(oldFolio) {
    if (oldFolio == null) return null;
    var cands = [...mapping.entries()].filter(function(e){ return e[0].startsWith(String(oldFolio) + '|'); });
    return cands.length === 1 ? cands[0][1] : null;
  }

  // ─── 5. Actualizar recibos ───────────────────────────────────────────────
  // Construir lista deduplica con claves ORIGINALES antes de mutar
  var seenR = new Set();
  var reciboUpdates = [];
  _todos.forEach(function(r) {
    var uid = String(r.folio) + '|' + (r.anio_folio || 0) + '|' + (r.letra || letraVersion(r) || 'A');
    if (seenR.has(uid)) return;
    seenR.add(uid);
    var k = String(r.folio) + '|' + (r.anio_folio || 0);
    var nF = mapping.get(k);
    if (nF != null) reciboUpdates.push({ r: r, oldFolio: r.folio, newFolio: nF });
  });
  reciboUpdates.forEach(function(u) {
    var r = u.r, nF = u.newFolio;
    r.folio = nF;
    var letraR = r.letra || (typeof letraVersion === 'function' ? letraVersion(r) : 'A') || 'A';
    var fl = folioConLetra(nF, null, letraR);
    r.archivo  = fl + '.pdf';
    r.archivoR2 = typeof _nombreArchivoR2 === 'function' ? _nombreArchivoR2(fl, r.nombre || '') : fl + '.pdf';
    if (r.folioRef      != null) { var x = _mapFolioUnico(r.folioRef);      if (x != null) r.folioRef      = x; }
    if (r.folioAnterior != null) { var y = _mapFolioUnico(r.folioAnterior); if (y != null) r.folioAnterior = y; }
  });

  // ─── 6. Movimientos ─────────────────────────────────────────────────────
  (D.movimientos || []).forEach(function(m) {
    if (m.folio == null) return;
    var oldF = m.folio;
    var mAnio = m.fecha ? parseInt(String(m.fecha).split('-')[0]) : 0;
    var nF = mapping.get(String(oldF) + '|' + mAnio);
    if (nF == null) nF = _mapFolioUnico(oldF);
    if (nF == null) return;
    m.folio = nF;
    if (m.id === 'M-REC-' + oldF) m.id = 'M-REC-' + nF;
    m.cat         = _fixTxt(m.cat);
    m.descripcion = _fixTxt(m.descripcion);
  });

  // ─── 7. Pendientes ──────────────────────────────────────────────────────
  (D.pendientes || []).forEach(function(p) {
    if (p.reciboVinculadoFolio == null) return;
    var nF = _mapFolioUnico(p.reciboVinculadoFolio);
    if (nF == null) return;
    p.reciboVinculadoFolio = nF;
    if (p.id && p.id.startsWith('PEND-REC-')) p.id = 'PEND-REC-' + nF;
  });

  // ─── 8. Gestiones ───────────────────────────────────────────────────────
  (D.gestiones || []).forEach(function(g) {
    (g.recibosOficiales || []).forEach(function(ro) {
      if (ro.folio == null) return;
      var nF = _mapFolioUnico(ro.folio);
      if (nF == null) return;
      ro.folio = nF;
      var fl = folioConLetra(nF, null, 'A');
      if (ro.archivo) ro.archivo = fl + '.pdf';
    });
  });

  // ─── 9. historialPagos ──────────────────────────────────────────────────
  if (appData.historialPagos) {
    var nuevoHP = {};
    Object.entries(appData.historialPagos).forEach(function(entry) {
      var oldF = parseInt(entry[0]), arr = entry[1];
      var nF = _mapFolioUnico(oldF) || oldF;
      nuevoHP[nF] = (arr || []).map(function(p) {
        if (p.folio == null) return p;
        var pNF = _mapFolioUnico(p.folio);
        return pNF != null ? Object.assign({}, p, { folio: pNF }) : p;
      });
    });
    appData.historialPagos = nuevoHP;
  }

  // ─── 10. historialVersiones ─────────────────────────────────────────────
  if (appData.historialVersiones) {
    var nuevoHV = {};
    Object.entries(appData.historialVersiones).forEach(function(entry) {
      var oldF = parseInt(entry[0]);
      var nF = _mapFolioUnico(oldF) || oldF;
      nuevoHV[nF] = entry[1];
    });
    appData.historialVersiones = nuevoHV;
  }

  // ─── 11. folioActual ─────────────────────────────────────────────────────
  var nuevoSig = bases.length + 1;
  appData.folioActual = nuevoSig;
  if (typeof REC !== 'undefined' && REC) REC.folioActual = nuevoSig;

  // ─── 12. Persistir datos primero ─────────────────────────────────────────
  if (typeof save === 'function') save();
  try { await actualizarArchivoControl(); } catch(e) { console.warn('[migrarFolios] actualizarArchivoControl:', e); }

  // ─── 13. Regenerar todos los PDFs ────────────────────────────────────────
  var todosParaPDF = (appData.recibos || []).filter(function(r){ return r && !r.cancelado; });
  var okPDF = 0, errPDF = 0;
  for (var i = 0; i < todosParaPDF.length; i++) {
    var r = todosParaPDF[i];
    var letraR = r.letra || (typeof letraVersion === 'function' ? letraVersion(r) : 'A') || 'A';
    var fl = folioConLetra(r.folio, null, letraR);
    toast('⏳ PDF ' + (i+1) + '/' + todosParaPDF.length + ' — #' + fl);
    try {
      var qrTxt = 'LEX-MEXICO|Folio:' + fl + '|' + (r.nombre||'') + '|' + (r.fecha_recibo||r.fecha||'');
      var qrURL = typeof qrToDataURL === 'function' ? await qrToDataURL(qrTxt) : null;
      var doc = await generarPDF(Object.assign({}, r, { letra: letraR }), r.folio, qrURL);
      var pdfBlob = doc.output('blob');
      r.pdfBase64 = doc.output('datauristring');
      await subirPDFaDrive(pdfBlob, fl + '.pdf', r.archivoR2);
      okPDF++;
    } catch(e) {
      console.warn('[migrarFolios] PDF folio', r.folio, e);
      errPDF++;
    }
    await new Promise(function(res){ setTimeout(res, 100); });
  }

  // ─── 14. Guardar estado final ────────────────────────────────────────────
  if (typeof save === 'function') save();
  try { await actualizarArchivoControl(); } catch(e) {}
  try { await syncEstadoSupabase(); } catch(e) {}
  if (typeof renderContab     === 'function') renderContab();
  if (typeof renderHistorial  === 'function') renderHistorial();
  if (typeof badges           === 'function') badges();
  toast('✅ Migración completa · ' + bases.length + ' folios · ' + okPDF + ' PDFs' + (errPDF ? ' · ' + errPDF + ' errores' : ''));
}

async function adminNormalizarNombresR2() {
  if (!window.SB_DESPACHO_ID || typeof window.listarR2 !== 'function') {
    toast('Sin conexion R2', 'err'); return;
  }
  const prefix = window.SB_DESPACHO_ID + '/recibos/';
  let lista = [];
  try {
    toast('⏳ Listando archivos en R2...');
    lista = await window.listarR2(prefix, 'recibos') || [];
  } catch(e) { toast('Error al listar R2: ' + (e.message||e), 'err'); return; }

  // Extrae el nombre corto canónico de cualquier variante larga.
  // Ejemplos:
  //   Recibo_14A_RUPERTO_ALEJANDRO.pdf → 14A.pdf
  //   26-083A_SAMUEL_MARTINEZ.pdf      → 26-083A.pdf
  //   90A_NOMBRE.pdf                   → 90A.pdf
  //   14A.pdf                          → (ya está bien, se ignora)
  function _nombreCorto(nombre) {
    // Quitar prefijo "Recibo_" si existe
    var n = nombre.replace(/^\.pdf$/i,'').replace(/\.pdf$/i,'');
    n = n.replace(/^Recibo_/i, '');
    // Extraer solo el token de folio+letra al inicio: ej "14A", "26-083A", "0014A"
    var m = n.match(/^(\d{2}-\d{3}[A-Za-z]|\d+[A-Za-z])/i);
    if (!m) return null; // no reconocible
    return m[1].toUpperCase() + '.pdf';
  }

  const afectar = lista.filter(function(o) {
    const nombre = (o.key || o.name || '').split('/').pop();
    const corto = _nombreCorto(nombre);
    return corto && corto !== nombre; // solo los que necesitan cambio
  });

  if (!afectar.length) { toast('✅ Todos los archivos ya tienen nombre corto canónico', 'ok'); return; }

  // Mostrar preview antes de confirmar
  const preview = afectar.slice(0,8).map(function(o){
    const v = (o.key||o.name||'').split('/').pop();
    return v + '  →  ' + _nombreCorto(v);
  }).join('\n') + (afectar.length > 8 ? '\n… y ' + (afectar.length-8) + ' más' : '');

  if (!confirm('Se encontraron ' + afectar.length + ' archivo(s) con nombre largo.\n\n' + preview + '\n\n¿Renombrar todos al formato corto? No cierre la app.')) return;

  const _arr1 = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  const _arr2 = (typeof REC !== 'undefined' && REC.recibos) ? REC.recibos : [];
  const _todos = [..._arr1, ..._arr2];

  var renombrados = 0, errores = 0;
  for (var i = 0; i < afectar.length; i++) {
    const obj = afectar[i];
    const keyViejo    = obj.key || obj.name || '';
    const nombreViejo = keyViejo.split('/').pop();
    const nombreNuevo = _nombreCorto(nombreViejo);
    if (!nombreNuevo || nombreNuevo === nombreViejo) continue;
    const keyNuevo = prefix + nombreNuevo;
    toast('⏳ (' + (i+1) + '/' + afectar.length + ') ' + nombreViejo + ' → ' + nombreNuevo);
    try {
      // Descargar original
      const blob = await window.descargarR2(keyViejo, 'recibos', true);
      if (!blob || blob.size < 100) { errores++; console.warn('[normalizarR2] blob vacío:', nombreViejo); continue; }
      // Subir con nombre corto
      const file = new File([blob], nombreNuevo, { type: 'application/pdf' });
      const ok = await window.subirR2(file, keyNuevo, 'recibos');
      if (!ok) { errores++; console.warn('[normalizarR2] Falló subida:', nombreNuevo); continue; }
      // Borrar el viejo
      await window.borrarR2(keyViejo, 'recibos').catch(function(){});

      // Actualizar referencias en memoria (archivoR2 y archivo)
      _todos.forEach(function(r) {
        if (!r) return;
        if (r.archivoR2 === nombreViejo || r.archivoR2 === keyViejo) r.archivoR2 = nombreNuevo;
        if (r.archivo   === nombreViejo) r.archivo = nombreNuevo;
      });

      // Si algún recibo aún no tiene archivoR2, intentar vincular por folio+letra
      var mf = /^(\d{2}-\d{3}|\d+)([A-Za-z])\.pdf$/i.exec(nombreNuevo);
      if (mf) {
        var numStr = mf[1], letraStr = mf[2].toUpperCase();
        _todos.forEach(function(r) {
          if (!r || r.archivoR2) return;
          var rf = typeof folioFormato === 'function' ? folioFormato(r.folio, r.anio_folio) : String(r.folio||'');
          var rn = String(r.folio||'');
          var rl = (r.letra || (typeof letraVersion==='function' ? letraVersion(r) : 'A') || 'A').toUpperCase();
          if ((rf === numStr || rn === numStr) && rl === letraStr) r.archivoR2 = nombreNuevo;
        });
      }
      renombrados++;
    } catch(e) {
      console.warn('[normalizarR2] error en', nombreViejo, e);
      errores++;
    }
    await new Promise(function(res){ setTimeout(res, 80); });
  }

  try { await actualizarArchivoControl(); } catch(e) {}
  try { await syncEstadoSupabase(); } catch(e) {}
  if (typeof renderHistorial === 'function') renderHistorial();
  toast('✅ ' + renombrados + ' renombrado(s)' + (errores ? ' · ⚠ ' + errores + ' errores' : '') + ' — nombres cortos aplicados', renombrados > 0 ? 'ok' : 'err');
}

async function adminLimpiarPDFsHuerfanos() {
  if (!window.SB_DESPACHO_ID || typeof window.listarR2 !== 'function') {
    toast('R2 no disponible', 'err'); return;
  }

  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,9,5,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border-l);border-radius:var(--radius);width:560px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow-lg);">' +
      '<div style="padding:14px 18px;border-bottom:1px solid var(--border-l);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">' +
        '<div style="font-size:0.88rem;font-weight:700;color:var(--ink);">🧹 Limpiar PDFs huérfanos en R2</div>' +
        '<button style="font-size:1rem;background:none;border:none;cursor:pointer;color:var(--muted);" onclick="this.closest(\'[data-r2ov]\').remove()">✕</button>' +
      '</div>' +
      '<div id="r2h-body" style="flex:1;overflow-y:auto;padding:14px 16px;font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;line-height:2;color:var(--ink);"></div>' +
      '<div id="r2h-footer" style="padding:10px 16px;border-top:1px solid var(--border-l);flex-shrink:0;display:flex;gap:8px;justify-content:flex-end;"></div>' +
    '</div>';
  ov.dataset.r2ov = '1';
  document.body.appendChild(ov);

  const body   = document.getElementById('r2h-body');
  const footer = document.getElementById('r2h-footer');

  function _log(html, color) {
    const d = document.createElement('div');
    if (color) d.style.color = color;
    d.innerHTML = html;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }
  function _btnCerrar() {
    footer.innerHTML = '<button onclick="this.closest(\'[data-r2ov]\').remove()" style="padding:6px 18px;border-radius:6px;border:1px solid var(--border-l);background:var(--surface);color:var(--ink);cursor:pointer;font-size:0.78rem;">Cerrar</button>';
  }

  try {
    _log('📦 Listando archivos en R2…');
    const prefix  = window.SB_DESPACHO_ID + '/recibos/';
    const objetos = await window.listarR2(prefix, 'recibos');

    if (!objetos || !objetos.length) {
      _log('⚠ No se encontraron archivos en R2/recibos/', 'var(--rojo)');
      _btnCerrar(); return;
    }
    _log('✓ <b>' + objetos.length + '</b> archivos encontrados en R2');

    // Construir set de nombres conocidos por el sistema (archivoR2 y archivo)
    const _arr1 = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
    const _arr2 = (typeof REC !== 'undefined' && REC.recibos) ? REC.recibos : [];
    const todosRecibos = Array.from(new Map(
      [..._arr1, ..._arr2].filter(function(x){ return x && x.folio != null; })
        .map(function(x){ return [x.folio + '|' + (x.letra || 'A'), x]; })
    ).values());

    const nombresVinculados = new Set();
    todosRecibos.forEach(function(r) {
      if (r.archivoR2) nombresVinculados.add(r.archivoR2.split('/').pop().toLowerCase());
      if (r.archivo)   nombresVinculados.add(r.archivo.split('/').pop().toLowerCase());
    });
    _log('📄 Recibos en sistema: <b>' + todosRecibos.length + '</b> · Referencias: <b>' + nombresVinculados.size + '</b>');

    // Clasificar cada archivo R2
    const huerfanos  = [];
    const vinculados = [];
    objetos.forEach(function(obj) {
      const key    = obj.key || obj.name || '';
      const nombre = key.split('/').pop();
      if (!nombre || !nombre.toLowerCase().endsWith('.pdf')) return;
      if (nombresVinculados.has(nombre.toLowerCase())) {
        vinculados.push(nombre);
      } else {
        huerfanos.push({ key: key, nombre: nombre, size: obj.size || 0 });
      }
    });

    _log('✅ Vinculados: <b style="color:var(--verde)">' + vinculados.length + '</b> &nbsp;·&nbsp; Huérfanos: <b style="color:var(--rojo)">' + huerfanos.length + '</b>');

    if (!huerfanos.length) {
      _log('✓ No hay PDFs huérfanos. El bucket está limpio.', 'var(--verde)');
      _btnCerrar(); return;
    }

    // Lista con checkboxes
    const sep = document.createElement('hr');
    sep.style.cssText = 'border:none;border-top:1px solid var(--border-l);margin:6px 0;';
    body.appendChild(sep);
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:0.62rem;color:rgba(240,120,100,0.9);margin-bottom:4px;';
    lbl.textContent = 'PDFs en R2 sin recibo vinculado en el sistema — selecciona los que quieres eliminar:';
    body.appendChild(lbl);

    const listDiv = document.createElement('div');
    listDiv.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-bottom:6px;';
    huerfanos.forEach(function(obj) {
      var kb = obj.size ? ' (' + (obj.size / 1024).toFixed(1) + ' KB)' : '';
      var row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;padding:3px 6px;border-radius:4px;background:rgba(192,22,26,0.06);border:1px solid rgba(192,22,26,0.15);';
      row.innerHTML = '<input type="checkbox" checked data-key="' + escHTML(obj.key||'') + '" style="accent-color:#e05555;cursor:pointer;flex-shrink:0;"><span style="flex:1;word-break:break-all;font-size:0.63rem;">' + escHTML(obj.nombre||'') + '</span><span style="color:var(--muted);flex-shrink:0;font-size:0.6rem;">' + kb + '</span>';
      listDiv.appendChild(row);
    });
    body.appendChild(listDiv);
    body.scrollTop = body.scrollHeight;

    // Botones de acción
    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancelar';
    btnCancel.style.cssText = 'padding:7px 14px;border-radius:6px;border:1px solid var(--border-l);background:var(--surface);color:var(--muted);cursor:pointer;font-size:0.78rem;';
    btnCancel.onclick = function(){ ov.remove(); };

    const btnDel = document.createElement('button');
    btnDel.textContent = 'Eliminar seleccionados';
    btnDel.style.cssText = 'padding:7px 18px;border-radius:6px;border:1.5px solid rgba(192,22,26,0.5);background:rgba(192,22,26,0.12);color:rgba(240,120,100,0.95);cursor:pointer;font-size:0.78rem;font-weight:600;';
    btnDel.onclick = async function() {
      const seleccionados = Array.from(listDiv.querySelectorAll('input[type=checkbox]:checked'))
        .map(function(cb){ return cb.dataset.key; }).filter(Boolean);
      if (!seleccionados.length) { toast('Selecciona al menos un archivo', 'err'); return; }
      if (!confirm('¿Eliminar ' + seleccionados.length + ' PDF(s) de R2 de forma PERMANENTE?\n\nEsta acción no se puede deshacer.')) return;
      btnDel.disabled = true;
      btnCancel.disabled = true;
      btnDel.textContent = '⏳ Eliminando…';
      var ok = 0, err = 0;
      for (var i = 0; i < seleccionados.length; i++) {
        try {
          var borrado = await window.borrarR2(seleccionados[i], 'recibos');
          if (borrado) { ok++; } else { err++; }
        } catch(e) { err++; console.warn('[limpiarR2]', seleccionados[i], e); }
        btnDel.textContent = '⏳ Eliminando… ' + (ok + err) + '/' + seleccionados.length;
        await new Promise(function(res){ setTimeout(res, 60); });
      }
      const sep2 = document.createElement('hr');
      sep2.style.cssText = 'border:none;border-top:1px solid var(--border-l);margin:6px 0;';
      body.appendChild(sep2);
      _log('✅ Eliminados: <b style="color:var(--verde)">' + ok + '</b>' + (err ? ' &nbsp;·&nbsp; <b style="color:var(--rojo)">Errores: ' + err + '</b>' : ''));
      toast('🧹 ' + ok + ' PDFs huérfanos eliminados' + (err ? ' · ' + err + ' errores' : ''));
      _btnCerrar();
    };

    footer.appendChild(btnCancel);
    footer.appendChild(btnDel);

  } catch(e) {
    _log('❌ Error: ' + e.message, 'var(--rojo)');
    _btnCerrar();
    console.error('[adminLimpiarPDFsHuerfanos]', e);
  }
}

function adminAbrirBorrarPorFecha() {
  document.getElementById('adminPanelZone').classList.remove('show');
  var z = document.getElementById('adminBorrarFechaZone');
  if (z) z.classList.add('show');
  // Poner fecha de hoy por defecto
  var inp = document.getElementById('adminBorrarFechaInput');
  if (inp) { inp.value = hoy(); adminBorrarFechaPreview(); }
  var st = document.getElementById('adminBorrarFechaStatus');
  if (st) st.textContent = '';
}

function adminBorrarFechaPreview() {
  var inp = document.getElementById('adminBorrarFechaInput');
  var box = document.getElementById('adminBorrarFechaPreviewBox');
  var btn = document.getElementById('adminBorrarFechaBtn');
  if (!inp || !box) return;
  var fecha = inp.value;
  if (!fecha) { box.innerHTML = ''; if (btn) btn.disabled = true; return; }
  var movsFecha = (D.movimientos || []).filter(function(m){ return m.fecha === fecha && !m.borrado; });
  var total = movsFecha.reduce(function(s, m){ return s + (m.tipo === 'ingreso' ? (m.monto||0) : -(m.monto||0)); }, 0);
  var ingresos = movsFecha.filter(function(m){ return m.tipo === 'ingreso'; }).length;
  var egresos  = movsFecha.filter(function(m){ return m.tipo === 'egreso';  }).length;
  if (!movsFecha.length) {
    box.innerHTML = '<div style="font-family:monospace;font-size:0.68rem;color:rgba(200,149,42,0.45);text-align:center;padding:12px;">No hay movimientos para esta fecha</div>';
    if (btn) btn.disabled = true;
    return;
  }
  if (btn) btn.disabled = false;
  var color = total >= 0 ? '#4dca6a' : '#e85555';
  box.innerHTML =
    '<div style="background:rgba(192,22,26,0.07);border:1px solid rgba(192,22,26,0.2);border-radius:6px;padding:10px 12px;">' +
    '<div style="font-family:monospace;font-size:0.62rem;color:rgba(255,160,160,0.7);margin-bottom:6px;">SE ELIMINARÁN:</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
    '<span style="font-family:monospace;font-size:0.75rem;color:#e8c875;font-weight:700;">' + movsFecha.length + ' movimientos</span>' +
    '<span style="font-family:monospace;font-size:0.7rem;color:#4dca6a;">' + ingresos + ' ingresos</span>' +
    '<span style="font-family:monospace;font-size:0.7rem;color:#e85555;">' + egresos + ' egresos</span>' +
    '<span style="font-family:monospace;font-size:0.7rem;color:' + color + ';">Balance: $' + Math.abs(total).toFixed(2) + '</span>' +
    '</div>' +
    '</div>';
}

async function adminBorrarMovimientosPorFecha() {
  var inp    = document.getElementById('adminBorrarFechaInput');
  var st     = document.getElementById('adminBorrarFechaStatus');
  var btn    = document.getElementById('adminBorrarFechaBtn');
  if (!inp || !inp.value) { toast('Selecciona una fecha primero', 'err'); return; }
  var fecha  = inp.value;
  var movsFecha = (D.movimientos || []).filter(function(m){ return m.fecha === fecha && !m.borrado; });
  if (!movsFecha.length) { toast('No hay movimientos en esa fecha', 'err'); return; }
  if (!confirm('¿Eliminar de forma PERMANENTE los ' + movsFecha.length + ' movimientos del ' + fecha + '?\n\nEsta acción sincroniza primero con Supabase para que no regresen. No se puede deshacer.')) return;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sincronizando con Supabase...'; }
  if (st)  { st.style.color = 'rgba(232,200,117,0.8)'; st.textContent = '⏳ Paso 1/3 — Marcando tombstones locales...'; }
  var fechaBorrado = new Date().toISOString();
  var borradoPor   = (typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.email)
                     ? empleadoActual.email : 'admin';
  var idsABorrar   = new Set(movsFecha.map(function(m){ return m.id; }));
  var cnt          = movsFecha.length;
  // PASO 1 — Marcar tombstones en el array local
  D.movimientos.forEach(function(m){
    if (idsABorrar.has(m.id)){
      m.borrado      = true;
      m.fechaBorrado = fechaBorrado;
      m.borradoPor   = borradoPor;
    }
  });
  // PASO 2 — Subir a Supabase con los tombstones incluidos (sin debounce, directo)
  if (st) st.textContent = '⏳ Paso 2/3 — Subiendo tombstones a Supabase...';
  try {
    if (window.SB && window.SB_DESPACHO_ID) {
      var movsLimpios = (D.movimientos || []).filter(function(m){ return m && m.id && !/^R-\d+$/.test(m.id); });
      var estado = {
        movimientos:          movsLimpios,
        directorio:           D.directorio           || [],
        carpetas:             D.carpetas             || [],
        juicios:              D.juicios              || [],
        pendientes:           D.pendientes           || [],
        citas:                D.citas                || [],
        prestamos:            D.prestamos            || [],
        saldoAcumulado:       D.saldoAcumulado       || 0,
        escrituras:           D.escrituras           || [],
        recibosExcluidosCaja: D.recibosExcluidosCaja || [],
        cortesDeshabilitados: D.cortesDeshabilitados || [],
        captura_meses:        capturaMesCargar()     || D.captura_meses || {},
        retro_global:         window._retroGlobalActivo !== undefined
                              ? { activo: !!window._retroGlobalActivo }
                              : (D.retro_global || null),
        tiempoExtra:          D.tiempoExtra || {}
      };
      var recibos = {
        folioActual: (typeof REC !== 'undefined' && REC.folioActual) ? REC.folioActual : (appData.folioActual || 100),
        recibos:     appData.recibos || []
      };
      var user = (await window.SB.auth.getUser()).data.user;
      var res  = await window.SB.from('app_state').update({
        data:         estado,
        recibos:      recibos,
        folio_actual: recibos.folioActual,
        updated_by:   user ? user.id : null
      }).eq('despacho_id', window.SB_DESPACHO_ID);
      if (res.error) throw new Error(res.error.message);
    }
  } catch(e) {
    // Si falla la sync revertimos los tombstones para no dejar datos corruptos
    D.movimientos.forEach(function(m){
      if (idsABorrar.has(m.id)){ delete m.borrado; delete m.fechaBorrado; delete m.borradoPor; }
    });
    if (st)  { st.style.color = '#e85555'; st.textContent = '✗ Error al sincronizar con Supabase. No se eliminó nada.'; }
    if (btn) { btn.disabled = false; btn.textContent = '🗑 ELIMINAR MOVIMIENTOS DE ESTA FECHA'; }
    toast('Error al sincronizar — no se eliminó nada. Intenta de nuevo.', 'err');
    console.warn('[borrarPorFecha] sync error:', e);
    return;
  }
  // PASO 3 — Eliminar definitivamente del array local y persistir
  if (st) st.textContent = '⏳ Paso 3/3 — Eliminando del array local...';
  _filtrarMovsAuditado(function(m){ return !idsABorrar.has(m.id); }, 'adminBorrarMovimientosPorFecha');
  try { backupLocal('D', D); } catch(e){ /* ignore */ }
  _reordenarFoliosCaja();
  if (typeof renderCaja    === 'function') renderCaja();
  if (typeof renderContab  === 'function') renderContab();
  if (typeof renderHistorial === 'function') renderHistorial();
  if (typeof badges        === 'function') badges();
  if (st)  { st.style.color = '#4dca6a'; st.textContent = '✓ ' + cnt + ' movimientos del ' + fecha + ' eliminados permanentemente.'; }
  if (btn) { btn.textContent = '✓ Eliminados correctamente'; }
  toast('🗑 ' + cnt + ' movimientos del ' + fecha + ' eliminados — Supabase actualizado ✓');
  adminBorrarFechaPreview(); // Actualizar preview (debería mostrar 0)
}

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
  var _fechaQ = _normalizarFechaBusqueda(q);
  // Por defecto (sin texto en el buscador) solo se muestran los movimientos del
  // día actual/vigente. En cuanto se escribe algo en el buscador, se amplía la
  // búsqueda a todo el historial para poder localizar movimientos de otras fechas.
  var _hoyStr = (typeof _hoyReal === 'function') ? _hoyReal() : new Date().toISOString().slice(0,10);
  var _soloHoy = !q;
  var filtrados = todos.filter(function(m){
    if(_soloHoy && m.fecha !== _hoyStr) return false;
    if(tipo && tipo !== 'todos' && m.tipo !== tipo) return false;
    if(q){
      var ql = q.toLowerCase();
      return (m.descripcion||'').toLowerCase().includes(ql) ||
             (m.fecha||'').includes(ql) ||
             (_fechaQ && (m.fecha||'').includes(_fechaQ)) ||
             (m.cat||'').toLowerCase().includes(ql);
    }
    return true;
  });
  if(!filtrados.length){
    listEl.innerHTML = '<div style="text-align:center;padding:20px;font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;color:rgba(212,176,255,0.4);">'+(_soloHoy ? 'Sin movimientos de hoy. Escribe en el buscador para ver todo el historial.' : 'Sin movimientos encontrados')+'</div>';
    return;
  }
  // FIX: _ordenarMovs() da orden descendente (más reciente primero), que es lo
  // correcto para Caja. Pero en "Editar Cobros/Egresos" se pidió el mismo orden
  // que Contabilidad: más viejo arriba, más reciente abajo. Se toman los 60 más
  // recientes (igual que antes) y se invierte solo el orden de despliegue.
  listEl.innerHTML = filtrados.slice(0,60).reverse().map(function(m){
    var esIngreso = m.tipo === 'ingreso';
    var color = esIngreso ? '#4dca6a' : '#e85555';
    var signo = esIngreso ? '+' : '-';
    var monto = typeof m.monto === 'number' ? m.monto.toFixed(2) : (m.monto || '0.00');
    var esRecibo = m.fuente === 'recibo';
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid rgba(160,100,255,0.12);border-radius:7px;margin-bottom:6px;background:rgba(160,100,255,0.03);transition:background 0.15s;" onmouseover="this.style.background=\'rgba(160,100,255,0.08)\'" onmouseout="this.style.background=\'rgba(160,100,255,0.03)\'">'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-family:\'Outfit\',sans-serif;font-size:0.78rem;color:var(--gold-l);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(m.descripcion||'—')+'</div>'
      +'<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.55rem;color:rgba(200,149,42,0.4);margin-top:2px;">'+_fechaDDMMAAAA(m.fecha)+' '+(m.hora||'')+' · '+(m.cat||'—')+(esRecibo?' · 🧾 Recibo':'')+'</div>'
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
  // Proteger esta edición de que un pull de Supabase (polling/Realtime) la
  // revierta antes de que la subida debounced de abajo termine de confirmarla.
  _marcarMovEditadoLocal(id);
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

function adminAbrirBorrarEspecifico() {
  document.getElementById('adminPanelZone').classList.remove('show');
  document.getElementById('adminBorrarEspecZone').classList.add('show');
  document.getElementById('adminBuscarMov').value = '';
  adminRenderMovimientos('');
}

function adminVolverPanel() {
  document.querySelectorAll('#adminModal .admin-panel').forEach(function(z){ z.style.display = ''; z.classList.remove('show'); });
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
  const _fechaQ2 = _normalizarFechaBusqueda(q);
  const filtrados = q
    ? todos.filter(m =>
        (m.descripcion||'').toLowerCase().includes(q.toLowerCase()) ||
        (m.fecha||'').includes(q) ||
        (_fechaQ2 && (m.fecha||'').includes(_fechaQ2)) ||
        (m.cat||'').toLowerCase().includes(q.toLowerCase())
      )
    : todos;
  if (!filtrados.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;font-family:\'JetBrains Mono\',monospace;font-size:0.65rem;color:rgba(200,149,42,0.4);">Sin movimientos encontrados</div>';
    return;
  }
  // FIX: mismo criterio que "Editar Cobros/Egresos" — orden cronológico
  // (más viejo arriba, más reciente abajo) y fecha en formato dd/mm/aaaa.
  listEl.innerHTML = filtrados.slice(0, 50).reverse().map(m => {
    const esIngreso = m.tipo === 'ingreso';
    const color = esIngreso ? '#4dca6a' : '#e85555';
    const signo = esIngreso ? '+' : '-';
    const monto = typeof m.monto === 'number' ? m.monto.toFixed(2) : (m.monto || '0.00');
    const esRecibo = m.fuente === 'recibo';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid rgba(200,149,42,0.12);border-radius:7px;margin-bottom:6px;background:rgba(200,149,42,0.03);transition:background 0.15s;" onmouseover="this.style.background='rgba(200,149,42,0.07)'" onmouseout="this.style.background='rgba(200,149,42,0.03)'">
        <div style="flex:1;min-width:0;">
          <div style="font-family:sans-serif;font-size:0.78rem;color:var(--gold-l);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(m.descripcion||'—')}</div>
          <div style="font-family:monospace;font-size:0.55rem;color:rgba(200,149,42,0.4);margin-top:2px;">${_fechaDDMMAAAA(m.fecha)} ${m.hora||''} · ${m.cat||'—'}${esRecibo?' · 🧾 Recibo':''}</div>
        </div>
        <div style="font-family:monospace;font-size:0.78rem;font-weight:700;color:${color};flex-shrink:0;">${signo}$${monto}</div>
        ${!esRecibo?`<button onclick="adminEditarMovEspec('${m.id}')" style="background:rgba(200,149,42,0.1);border:1px solid rgba(200,149,42,0.3);border-radius:5px;padding:4px 9px;cursor:pointer;font-family:monospace;font-size:0.58rem;color:var(--gold-l);font-weight:700;flex-shrink:0;transition:all 0.15s;" onmouseover="this.style.background='rgba(200,149,42,0.22)'" onmouseout="this.style.background='rgba(200,149,42,0.1)'">✏️</button>`:''}
        <button onclick="adminBorrarMovEspec('${m.id}')" title="${esRecibo?'\u2622\ufe0f Eliminar recibo COMPLETO \u2014 borra de R2, Supabase, Drive, historial y contabilidad':'Eliminar movimiento'}" style="background:rgba(192,22,26,0.12);border:1px solid rgba(192,22,26,0.3);border-radius:5px;padding:4px 9px;cursor:pointer;font-family:monospace;font-size:0.58rem;color:#e85555;font-weight:700;flex-shrink:0;transition:all 0.15s;" onmouseover="this.style.background='rgba(192,22,26,0.25)'" onmouseout="this.style.background='rgba(192,22,26,0.12)'">${esRecibo?'\u2622\ufe0f':'\u2715'}</button>
      </div>`;
  }).join('');
}

function adminBorrarMovEspec(id) {
  const mov = (D.movimientos || []).find(m => m.id === id);
  if (!mov) { toast('Movimiento no encontrado', 'err'); return; }
  const esRecibo = mov.fuente === 'recibo';

  // ── RECIBO: delegar al flujo de borrado COMPLETO ─────────────────────────
  // Si el movimiento es un recibo, lo borramos de TODOS los sistemas:
  // appData.recibos, D.movimientos, historialPagos, snapshotsRecibos,
  // R2 (Cloudflare), Supabase (versiones_recibo + app_state), Drive PDF,
  // localStorage backups y realtime broadcast a otros clientes.
  if (esRecibo && mov.folio != null) {
    // Ya no se pide usuario/contraseña por separado — esta función solo es
    // alcanzable desde dentro del Panel de Administrador, que ya verificó la
    // sesión real de Supabase al abrirse. Se revalida aquí como respaldo.
    if (!_esAdminReal()) { toast('✗ Acceso restringido al administrador', 'err'); return; }

    // Buscar el índice del recibo en appData.recibos
    const folioNum = mov.folio;
    const letraTarget = mov.letra || 'A';
    const recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
    const idxRec = recibos.findIndex(function(r){
      return r && Number(r.folio) === Number(folioNum) &&
             (r.letra || (typeof letraVersion === 'function' ? letraVersion(r) : 'A') || 'A') === letraTarget;
    });

    if (idxRec < 0) {
      // El recibo ya no existe en appData.recibos — borrar solo el movimiento huérfano
      if (!confirm('⚠️ El recibo #' + folioNum + letraTarget + ' ya no existe en el sistema.\n\n¿Eliminar solo el movimiento de contabilidad?\n\nEsta acción no se puede deshacer.')) return;
      // Borrado directo del movimiento huérfano
      _auditoriaRegistrar('eliminado', mov, {motivo:'recibo ya no existe'});
      D.movimientos = (D.movimientos || []).filter(function(m){ return m.id !== id; });
      if (!Array.isArray(D.recibosExcluidosCaja)) D.recibosExcluidosCaja = [];
      if (!D.recibosExcluidosCaja.map(String).includes(String(folioNum))) D.recibosExcluidosCaja.push(String(folioNum));
      _reordenarFoliosCaja();
      syncEstadoSupabaseDebounced().catch(function(e){ registrarError('Promise catch vacio', e); });
      if (typeof renderCaja === 'function') renderCaja();
      if (typeof renderContab === 'function') renderContab();
      adminRenderMovimientos((document.getElementById('adminBuscarMov')||{}).value || '');
      toast('Movimiento huérfano eliminado ✓');
      return;
    }

    // Delegar al flujo completo de eliminación de recibo
    // adminEliminarRecibo ya pide su propio confirm() con toda la info
    adminEliminarRecibo(idxRec);
    // Actualizar lista de movimientos tras la eliminación
    setTimeout(function(){
      adminRenderMovimientos((document.getElementById('adminBuscarMov')||{}).value || '');
    }, 600);
    return;
  }

  // ── MOVIMIENTO NORMAL (no recibo): flujo original ────────────────────────
  if (!_esAdminReal()) { toast('✗ Acceso restringido al administrador', 'err'); return; }
  if (!confirm(`¿Borrar este movimiento?\n\n"${mov.descripcion||'—'}"\nFecha: ${mov.fecha||'—'} | $${mov.monto}\n\nEsta acción no se puede deshacer.`)) return;
  // Marcar como tombstone SIN sacarlo del array (la fusión bidireccional necesita ver la lápida)
  const idxMov = D.movimientos.findIndex(m => m.id === id);
  if(idxMov < 0){ toast('Movimiento no encontrado', 'err'); return; }
  D.movimientos[idxMov].borrado = true;
  D.movimientos[idxMov].fechaBorrado = new Date().toISOString();
  D.movimientos[idxMov].borradoPor = (typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.email)
    ? empleadoActual.email
    : 'admin';
  guardarTodo()
    .then(function(){
      // 1. Quitar el tombstone del array definitivamente
      // Avisar a SCANSYS que esta reducción es intencional (no falso positivo)
      if(window._scansys) window._scansys._adminDeletedMovs = (window._scansys._adminDeletedMovs || 0) + 1;
      // Proteger este borrado de que un pull de Supabase (polling/Realtime)
      // lo reinserte antes de que la subida debounced de abajo lo confirme.
      _marcarMovEliminadoLocal(id);
      // Lápida PERMANENTE (no solo la ventana de 15s de arriba) — fix folio 1006:
      // sin esto, el merge de syncEstadoSupabase()/sincronizarFolio() que recupera
      // movimientos caja/manual "solo en Supabase" podía resucitar este borrado si
      // otra sesión escribía después de que pasara la ventana de gracia.
      if(!Array.isArray(D.movimientos_eliminados)) D.movimientos_eliminados = [];
      if(!D.movimientos_eliminados.some(function(t){ return t && t.id === id; }))
        D.movimientos_eliminados.push({ id: id, ts: Date.now() });
      _auditoriaRegistrar('eliminado', mov);
      D.movimientos = D.movimientos.filter(m => m.id !== id);
      // ── PARCHE ANTI-DUPLICADO (movimientos normales) ──────────────────────
      if (false && mov.folio != null) {
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
  // Verificar sesión real de administrador (ver nota en adminBorrarMovEspec)
  if (!_esAdminReal()) { toast('✗ Acceso restringido al administrador', 'err'); return; }
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
  // Misma protección que adminGuardarEdicion2Mov(): evita que un pull de
  // Supabase revierta esta edición antes de que se confirme en el servidor.
  _marcarMovEditadoLocal(id);
  save();
  renderCaja();
  renderContab();
  adminVolverBorrar();
  adminRenderMovimientos((document.getElementById('adminBuscarMov')||{}).value || '');
  // FIX (bug real, no solo de carrera): este bloque llamaba SOLO a
  // actualizarArchivoControl(), que únicamente sube las columnas
  // `recibos`/`folio_actual` de Supabase — JAMÁS la columna `data`, que es
  // donde vive D.movimientos. Resultado: la edición de descripción/monto/
  // fecha hecha aquí nunca llegaba a Supabase (aunque el toast decía
  // "✅ sincronizado"), y se perdía en cuanto llegaba el próximo pull
  // (polling cada 30s, login en otro dispositivo, etc.) — igual que el bug
  // ya corregido en "Editar Cobros/Egresos", pero aquí era 100% garantizado,
  // no solo una carrera ocasional. Se reemplaza por la subida correcta
  // (syncEstadoSupabase, la misma que usa adminGuardarEdicion2Mov) que sí
  // incluye D.movimientos.
  try {
    toast('⏳ Sincronizando…');
    await syncEstadoSupabase();
    toast('✅ Movimiento actualizado y sincronizado');
  } catch(e) {
    console.error('adminGuardarEdicionMov sync error:', e);
    if (typeof window._encolarGuardadoPendiente === 'function') window._encolarGuardadoPendiente('syncEstado', null);
    toast('⚠️ Guardado local OK · se sincronizará cuando haya conexión', 'warn');
  }
}

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

function adminHistTab(tab) {
  if(tab === 'retro' && typeof adminRetroInicializar === 'function') adminRetroInicializar();
}

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
  if(fecha && esPeriodoCerrado(fecha, hr || '00:00')){
    if(typeof toast === 'function') toast(_msgPeriodoCerrado(), 'err'); else alert(_msgPeriodoCerrado()); return;
  }
  var desc   = ((document.getElementById('rDesc')  || {}).value || '').trim();
  var monto  = parseFloat((document.getElementById('rMonto') || {}).value) || 0;
  var motivo = ((document.getElementById('rMotivo')|| {}).value || '').trim();
  var tipo   = window._adminRetroTipo || 'ingreso';
  if(!fecha){ if(typeof toast==='function') toast('Elige una fecha','err'); else alert('Elige una fecha.'); return; }
  if(fecha > fechaHoy){ if(typeof toast==='function') toast('No se permiten fechas futuras','err'); else alert('No se permiten fechas futuras.'); return; }
  if(!hr){ if(typeof toast==='function') toast('Elige una hora','err'); else alert('Elige una hora.'); return; }
  if(typeof _minutosDeHHMM === 'function'){
    var _retroMins = _minutosDeHHMM(hr);
    var _retroIni  = _minutosDeHHMM(HORARIO_CAPTURA_INICIO);
    var _retroFin  = _minutosDeHHMM(HORARIO_CAPTURA_FIN);
    if(_retroMins < _retroIni || _retroMins > _retroFin){
      var _msgFueraHorario = 'Esa hora ('+hr+') está fuera del horario laboral ('+HORARIO_CAPTURA_INICIO+' a '+HORARIO_CAPTURA_FIN+'). Elige una hora dentro de ese rango.';
      if(typeof toast==='function') toast(_msgFueraHorario,'err'); else alert(_msgFueraHorario);
      return;
    }
  }
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

async function adminReordenarFolios() {
  if (!sbSession || Date.now() >= sbExpiry) {
    if (typeof mostrarDriveOverlay === 'function') mostrarDriveOverlay('adminReordenarFolios');
    return;
  }
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var anio = (typeof appData !== 'undefined' && appData.anioFolioActual) || new Date().getFullYear();
  // Folios únicos presentes (cualquier letra cuenta para detectar si el slot está ocupado)
  var foliosSet = new Set(
    recibos.filter(function(r){ return r && !r.esComplemento && Number(r.folio) > 0; })
           .map(function(r){ return Number(r.folio); })
  );
  var foliosOrdenados = Array.from(foliosSet).sort(function(a,b){ return a-b; });
  if (!foliosOrdenados.length) {
    if (typeof toast === 'function') toast('No hay folios registrados', 'err');
    return;
  }
  var maxFolio = foliosOrdenados[foliosOrdenados.length - 1];
  // Huecos: números del 1 al máximo que no tienen ningún recibo
  var vacios = [];
  for (var i = 1; i <= maxFolio; i++) {
    if (!foliosSet.has(i)) vacios.push(i);
  }
  // Mapa de renumeración: oldFolio → newFolio
  var mapa = new Map();
  foliosOrdenados.forEach(function(oldF, idx) {
    var newF = idx + 1;
    if (oldF !== newF) mapa.set(oldF, newF);
  });
  var nuevoFolioActual = foliosOrdenados.length + 1;
  // Helper: info del recibo A de un folio
  function _infoFolio(folio) {
    var r = recibos.find(function(x) {
      return x && !x.esComplemento && Number(x.folio) === folio && (x.letra || 'A') === 'A';
    }) || recibos.find(function(x) {
      return x && !x.esComplemento && Number(x.folio) === folio;
    });
    return r ? { nombre: r.nombre || '—', fecha: (r.fecha || r.fecha_recibo || '—').substring(0,10) } : { nombre: '—', fecha: '—' };
  }
  function _fStr(f) {
    return typeof folioConLetra === 'function' ? folioConLetra(f, anio, 'A') : String(f).padStart(3,'0')+'A';
  }
  // Construir filas de la tabla preview (solo los que cambian)
  var cambios = foliosOrdenados.filter(function(f){ return mapa.has(f); });
  var rowsHTML = cambios.map(function(oldF) {
    var newF = mapa.get(oldF);
    var info = _infoFolio(oldF);
    return '<tr style="border-bottom:1px solid rgba(255,255,255,0.06);">' +
      '<td style="font-family:monospace;font-size:0.72rem;color:#ff9090;font-weight:700;padding:5px 8px;white-space:nowrap;">' + _fStr(oldF) + '</td>' +
      '<td style="font-size:0.7rem;color:#888;padding:0 4px;">→</td>' +
      '<td style="font-family:monospace;font-size:0.72rem;color:#90ff90;font-weight:700;padding:5px 8px;white-space:nowrap;">' + _fStr(newF) + '</td>' +
      '<td style="font-size:0.68rem;color:var(--muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px;">' + (typeof esc==='function'?esc(info.nombre):info.nombre) + '</td>' +
      '<td style="font-size:0.65rem;color:var(--muted);white-space:nowrap;padding:5px 8px;">' + info.fecha + '</td>' +
      '</tr>';
  }).join('');
  // HTML de los huecos
  var vaciosHTML = vacios.slice(0,30).map(function(f){
    return '<span style="font-family:monospace;font-size:0.65rem;color:#ff7070;background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.25);border-radius:4px;padding:2px 6px;">' + _fStr(f) + '</span>';
  }).join(' ') + (vacios.length > 30 ? '<span style="color:var(--muted);font-size:0.6rem;"> … y ' + (vacios.length-30) + ' más</span>' : '');
  var ov = document.createElement('div');
  ov.id = 'modal-reordenar-folios';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,8,5,0.88);z-index:9100;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
  ov.innerHTML =
    '<div style="background:#1a1510;border:1.5px solid rgba(160,100,220,0.5);border-radius:18px;max-width:680px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.7);">' +
      '<div style="padding:18px 22px 14px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:12px;">' +
        '<div style="font-size:1.6rem;">🔢</div>' +
        '<div>' +
          '<div style="font-family:sans-serif;font-weight:800;font-size:1rem;color:#d8b8ff;">Reordenar Folios</div>' +
          '<div style="font-family:monospace;font-size:0.6rem;color:var(--muted);margin-top:2px;">' +
            foliosOrdenados.length + ' folios registrados · ' +
            '<span style="color:#ff9090;">' + vacios.length + ' huecos</span>' +
            ' · folioActual: ' + ((typeof appData!=='undefined'&&appData.folioActual)||'?') +
            ' → <span style="color:#90ff90;">' + nuevoFolioActual + '</span>' +
          '</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'modal-reordenar-folios\').remove()" style="margin-left:auto;background:none;border:none;color:var(--muted);font-size:1.2rem;cursor:pointer;padding:4px;">✕</button>' +
      '</div>' +
      (vacios.length === 0
        ? '<div style="padding:28px 22px;text-align:center;color:#90ff90;font-family:monospace;font-size:0.78rem;">✅ Los folios ya están consecutivos — no hay huecos.</div>'
        : '<div style="padding:14px 22px 8px;">' +
            '<div style="font-family:monospace;font-size:0.6rem;color:var(--muted);margin-bottom:6px;">Huecos detectados:</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + vaciosHTML + '</div>' +
          '</div>' +
          '<div style="padding:6px 22px 10px;">' +
            '<div style="font-family:monospace;font-size:0.6rem;color:var(--muted);margin-bottom:6px;">' + cambios.length + ' folio(s) cambiarán de número:</div>' +
            '<div style="overflow-y:auto;max-height:280px;border:1px solid rgba(255,255,255,0.08);border-radius:8px;">' +
              '<table style="width:100%;border-collapse:collapse;">' +
                '<thead><tr style="background:rgba(255,255,255,0.05);font-family:monospace;font-size:0.58rem;color:var(--muted);">' +
                  '<th style="padding:5px 8px;text-align:left;">ANTES</th>' +
                  '<th></th>' +
                  '<th style="padding:5px 8px;text-align:left;">DESPUÉS</th>' +
                  '<th style="padding:5px 8px;text-align:left;">CLIENTE</th>' +
                  '<th style="padding:5px 8px;text-align:left;">FECHA</th>' +
                '</tr></thead>' +
                '<tbody>' + rowsHTML + '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +
          '<div style="padding:4px 22px 14px;">' +
            '<div style="background:rgba(255,160,0,0.08);border:1px solid rgba(255,160,0,0.25);border-radius:8px;padding:8px 12px;font-family:monospace;font-size:0.58rem;color:#ffb060;line-height:1.5;">' +
              '⚠ Esta operación es irreversible. Los PDFs en Supabase Storage <strong>no se renombran</strong> automáticamente ' +
              '(siguen accesibles por el nombre antiguo como fallback). Los PDFs en R2 se renombrarán al próximo guardado desde el modo edición.' +
            '</div>' +
          '</div>' +
          '<div style="padding:0 22px 18px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">' +
            '<button onclick="document.getElementById(\'modal-reordenar-folios\').remove()" style="padding:8px 20px;border-radius:8px;border:1.5px solid rgba(255,255,255,0.15);background:none;color:var(--muted);font-family:monospace;font-size:0.72rem;cursor:pointer;">Cancelar</button>' +
            '<button onclick="adminUsarSiguienteHueco()" style="padding:8px 22px;border-radius:8px;border:1.5px solid rgba(42,180,130,0.5);background:rgba(42,180,130,0.12);color:#90ffd8;font-family:monospace;font-size:0.72rem;font-weight:700;cursor:pointer;letter-spacing:0.05em;" title="No renumera nada — solo apunta el contador al primer número libre para que los nuevos recibos llenen los huecos">▶ Usar siguiente hueco</button>' +
            '<button id="btn-confirmar-reordenar" onclick="adminConfirmarReordenarFolios()" style="padding:8px 22px;border-radius:8px;border:none;background:linear-gradient(135deg,#7a30c0,#4a1880);color:#fff;font-family:monospace;font-size:0.72rem;font-weight:700;cursor:pointer;letter-spacing:0.05em;">🔢 Compactar todo</button>' +
          '</div>'
      ) +
    '</div>';
  // Guardar el mapa para que el confirm pueda usarlo
  window._reordenarFoliosMapa     = mapa;
  window._reordenarFoliosNuevoMax = nuevoFolioActual;
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
}

async function adminConfirmarReordenarFolios() {
  var btn = document.getElementById('btn-confirmar-reordenar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Compactando...'; }
  var mapa     = window._reordenarFoliosMapa;
  var nuevoMax = window._reordenarFoliosNuevoMax;
  var anio     = (typeof appData !== 'undefined' && appData.anioFolioActual) || new Date().getFullYear();
  if (!mapa || !mapa.size) {
    if (typeof toast === 'function') toast('Nada que compactar', 'ok');
    document.getElementById('modal-reordenar-folios')?.remove();
    return;
  }
  try {
    _ultimoSyncPropio = Date.now();
    await _aplicarMapaRenumeracion(mapa, anio, nuevoMax);
    if (typeof renderContab  === 'function') renderContab();
    if (typeof renderHistorial === 'function') renderHistorial();
    if (typeof toast === 'function') toast('✅ ' + mapa.size + ' folio(s) renumerados — sin huecos', 'ok');
  } catch(e) {
    console.error('[ReordenarFolios]', e);
    if (typeof toast === 'function') toast('Error al compactar: ' + e.message, 'err');
  }
  window._reordenarFoliosMapa     = null;
  window._reordenarFoliosNuevoMax = null;
  document.getElementById('modal-reordenar-folios')?.remove();
}

async function adminUsarSiguienteHueco() {
  // Esta función SÍ llena huecos explícitamente (acción manual del admin)
  var usados = new Set(
    ((appData && appData.recibos) ? appData.recibos : [])
      .concat((typeof REC !== 'undefined' && REC.recibos) ? REC.recibos : [])
      .filter(function(r){ return r && r.folio; })
      .map(function(r){ return Number(r.folio); })
  );
  var siguiente = 1; while(usados.has(siguiente)) siguiente++;
  var anio = (typeof appData !== 'undefined' && appData.anioFolioActual) || new Date().getFullYear();
  var folioStr = typeof folioConLetra === 'function' ? folioConLetra(siguiente, anio, 'A') : String(siguiente);
  appData.folioActual = siguiente;
  if (typeof REC !== 'undefined') REC.folioActual = siguiente;
  if (typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
  _ultimoSyncPropio = Date.now();
  try {
    await guardarFolioEnDrive(siguiente);
  } catch(e) {
    console.warn('[UsarSiguienteHueco] guardarFolioEnDrive:', e);
  }
  if (typeof toast === 'function') toast('▶ Siguiente folio: ' + folioStr + ' — los nuevos recibos llenarán los huecos', 'ok');
  document.getElementById('modal-reordenar-folios')?.remove();
}

function adminAbrirGestionRecibos() {
  document.getElementById('adminPanelZone').classList.remove('show');
  document.getElementById('adminGestionRecibosZone').classList.add('show');
  document.getElementById('adminBuscarRecibo').value = '';
  adminRenderRecibos('');
}

function adminFiltrarRecibos() {
  var q = document.getElementById('adminBuscarRecibo').value;
  // Si el usuario edita la búsqueda mientras está seleccionando para eliminar,
  // se cancela esa selección (evita borrar después algo que ya no está a la vista).
  if (typeof _adminBulkModoActivo !== 'undefined' && _adminBulkModoActivo) {
    adminBulkCancelar();
    return;
  }
  adminRenderRecibos(q);
}

function adminAbrirCorregirMovs() {
  document.getElementById('adminPanelZone').classList.remove('show');
  document.getElementById('adminCorregirMovsZone').classList.add('show');
  var inp = document.getElementById('adminCorregirBuscar');
  if (inp) inp.value = '';
  adminCorregirRender();
}

function adminCorregirRender() {
  var lista = document.getElementById('adminCorregirLista');
  if (!lista) return;
  var q = ((document.getElementById('adminCorregirBuscar') || {}).value || '').toLowerCase().trim();

  // Obtener movimientos de fuente recibo
  var movs = (typeof D !== 'undefined' && Array.isArray(D.movimientos) ? D.movimientos : [])
    .filter(function(m) { return m && m.fuente === 'recibo' && m.folio != null; });

  // Filtrar por búsqueda
  if (q) {
    movs = movs.filter(function(m) {
      return String(m.folio).includes(q) ||
             (m.nombre || '').toLowerCase().includes(q) ||
             (m.descripcion || '').toLowerCase().includes(q);
    });
  }

  // Para cada movimiento, detectar si hay problema
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var items = movs.map(function(m, i) {
    var letraM = m.letra || 'A';
    var folioM = parseInt(m.folio);
    // ¿Existe el recibo con ese folio+letra?
    var recExacto = recibos.find(function(r) {
      return parseInt(r.folio) === folioM && !r.esComplemento && (r.letra || 'A') === letraM;
    });
    // ¿Existe alguna versión del mismo folio con otra letra?
    var recOtraLetra = !recExacto && recibos.find(function(r) {
      return parseInt(r.folio) === folioM && !r.esComplemento;
    });
    var esHuerfano = !recExacto;
    var letraAlternativa = recOtraLetra ? (recOtraLetra.letra || 'A') : 'A';
    return { m: m, idxGlobal: i, folioM: folioM, letraM: letraM, esHuerfano: esHuerfano, recOtraLetra: recOtraLetra, letraAlternativa: letraAlternativa };
  }).filter(function(it) { return it.esHuerfano; });

  if (!items.length) {
    lista.innerHTML = '<div style="font-size:0.72rem;color:rgba(120,200,120,0.8);padding:18px;text-align:center;">✅ No hay movimientos con problemas' + (q ? ' para esa búsqueda' : '') + '</div>';
    return;
  }

  // Guardar índice real en D.movimientos para operaciones
  var todosMovs = (typeof D !== 'undefined' && Array.isArray(D.movimientos) ? D.movimientos : []);

  lista.innerHTML = items.map(function(it) {
    var m = it.m;
    var idxReal = todosMovs.indexOf(m);
    var folioStr = (typeof folioConLetra === 'function') ? folioConLetra(it.folioM, null, it.letraM) : it.folioM + it.letraM;
    var fecha = m.fecha || '—';
    var monto = parseFloat(m.monto) || 0;
    var montoStr = '$' + (typeof fmt === 'function' ? fmt(monto) : monto.toFixed(2));
    var desc = (m.descripcion || m.nombre || '—').substring(0, 60);

    var letrasDisponibles = ['A','B','C','D','E'].map(function(l) {
      return '<option value="' + l + '"' + (l === it.letraAlternativa ? ' selected' : '') + '>' + l + '</option>';
    }).join('');

    return '<div style="background:rgba(26,30,50,0.7);border:1px solid rgba(100,140,255,0.2);border-radius:8px;padding:10px 12px;margin-bottom:8px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">'
      + '<span style="font-family:monospace;font-weight:700;color:rgba(200,149,42,0.95);font-size:0.8rem;">#' + folioStr + '</span>'
      + '<span style="font-size:0.65rem;color:rgba(255,180,80,0.8);">⚠️ Recibo no encontrado</span>'
      + '<span style="font-size:0.62rem;color:rgba(180,180,180,0.6);margin-left:auto;">' + fecha + '</span>'
      + '</div>'
      + '<div style="font-size:0.65rem;color:rgba(200,200,200,0.7);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHTML(desc) + '">' + escHTML(desc) + '</div>'
      + '<div style="font-size:0.65rem;color:rgba(200,149,42,0.6);margin-bottom:8px;">' + montoStr + (m.estatus ? ' · ' + m.estatus : '') + '</div>'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
      + '<span style="font-size:0.6rem;color:rgba(160,192,255,0.7);">Cambiar letra a:</span>'
      + '<select id="letraSel_' + idxReal + '" style="background:rgba(26,40,80,0.9);border:1px solid rgba(100,140,255,0.3);border-radius:4px;color:#c8e0ff;font-family:monospace;font-size:0.72rem;padding:3px 6px;">' + letrasDisponibles + '</select>'
      + '<button onclick="adminCorregirCambiarLetra(' + idxReal + ')" style="background:rgba(26,74,138,0.5);border:1px solid rgba(80,130,255,0.4);border-radius:5px;padding:4px 10px;color:#c8e0ff;font-size:0.62rem;cursor:pointer;">✏️ Cambiar letra</button>'
      + '<button onclick="adminCorregirEliminarMov(' + idxReal + ')" style="background:rgba(192,22,26,0.15);border:1px solid rgba(192,22,26,0.4);border-radius:5px;padding:4px 10px;color:rgba(230,110,110,0.9);font-size:0.62rem;cursor:pointer;">🗑 Eliminar mov.</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

async function adminCorregirCambiarLetra(idxMov) {
  var m = (typeof D !== 'undefined' && Array.isArray(D.movimientos)) ? D.movimientos[idxMov] : null;
  if (!m) { if (typeof toast === 'function') toast('Movimiento no encontrado', 'err'); return; }
  var sel = document.getElementById('letraSel_' + idxMov);
  var nuevaLetra = sel ? sel.value : 'A';
  var letraVieja = m.letra || 'A';
  if (letraVieja === nuevaLetra) { if (typeof toast === 'function') toast('La letra ya es ' + nuevaLetra, 'err'); return; }
  var folioM = m.folio;
  var folioViejoStr = (typeof folioConLetra === 'function') ? folioConLetra(folioM, null, letraVieja) : folioM + letraVieja;
  var folioNuevoStr = (typeof folioConLetra === 'function') ? folioConLetra(folioM, null, nuevaLetra) : folioM + nuevaLetra;
  if (!confirm('¿Cambiar el movimiento #' + folioViejoStr + ' → #' + folioNuevoStr + '?\n\nEsto corrige la letra en contabilidad y sincroniza con Supabase.')) return;
  // Aplicar cambio
  m.letra = nuevaLetra;
  if (m.cat) m.cat = m.cat.replace(new RegExp('#\\d{2}-\\d{3,}' + letraVieja + '\\b'), '#' + folioNuevoStr);
  if (m.descripcion) m.descripcion = m.descripcion.replace(new RegExp('Recibo #\\S*' + letraVieja + '\\b', 'g'), 'Recibo #' + folioNuevoStr);
  // Sincronizar
  if (typeof toast === 'function') toast('⏳ Guardando cambio...', 'ok');
  try {
    if (typeof syncEstadoSupabase === 'function') await syncEstadoSupabase();
    if (typeof actualizarArchivoControl === 'function') await actualizarArchivoControl();
  } catch(e) { console.warn('[adminCorregirCambiarLetra]', e); }
  if (typeof renderContab === 'function') renderContab();
  if (typeof toast === 'function') toast('✅ Movimiento corregido: #' + folioViejoStr + ' → #' + folioNuevoStr, 'ok');
  adminCorregirRender();
}

async function adminCorregirEliminarMov(idxMov) {
  if (typeof D === 'undefined' || !Array.isArray(D.movimientos)) return;
  var m = D.movimientos[idxMov];
  if (!m) { if (typeof toast === 'function') toast('Movimiento no encontrado', 'err'); return; }
  var folioStr = (typeof folioConLetra === 'function') ? folioConLetra(m.folio, null, m.letra || 'A') : m.folio + (m.letra || 'A');
  var monto = parseFloat(m.monto) || 0;
  if (!confirm('¿Eliminar el movimiento huérfano #' + folioStr + ' ($' + monto.toFixed(2) + ')?\n\nEsta acción no se puede deshacer.')) return;
  _auditoriaRegistrar('eliminado', m, {origen:'adminCorregirEliminarMov'});
  D.movimientos.splice(idxMov, 1);
  if (typeof toast === 'function') toast('⏳ Eliminando movimiento...', 'ok');
  try {
    if (typeof syncEstadoSupabase === 'function') await syncEstadoSupabase();
  } catch(e) { console.warn('[adminCorregirEliminarMov]', e); }
  if (typeof renderContab === 'function') renderContab();
  if (typeof toast === 'function') toast('✅ Movimiento #' + folioStr + ' eliminado de contabilidad', 'ok');
  adminCorregirRender();
}

function adminFiltrarRecibosArr(q) {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var qn = (q||'').toLowerCase().trim();
  if (!qn) return recibos.slice();
  var esNumerico = /^\d+$/.test(qn);
  return recibos.filter(function(r) {
    if (esNumerico) return parseInt(r.folio, 10) === parseInt(qn, 10);
    var folio = folioConLetra(r.folio||0, r.anio_folio, r.letra||letraVersion(r)||'A').toLowerCase();
    var nombre = (r.nombre||'').toLowerCase();
    var fecha = (r.fecha||'').toLowerCase();
    return folio.includes(qn) || nombre.includes(qn) || fecha.includes(qn);
  });
}

function adminRenderRecibos(q) {
  var lista = document.getElementById('adminReciboList');
  if (!lista) return;
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var filtrados = adminFiltrarRecibosArr(q);
  // Ordenar por fecha de generación descendente (más reciente primero); empate → folio mayor primero
  filtrados.sort(function(a, b) {
    var fa = (a.fecha || a.fecha_recibo || '') + 'T' + (a.hora || '00:00');
    var fb = (b.fecha || b.fecha_recibo || '') + 'T' + (b.hora || '00:00');
    if (fb > fa) return 1;
    if (fb < fa) return -1;
    if (a.folio !== b.folio) return (b.folio || 0) - (a.folio || 0);
    // Mismo folio: A antes que B
    var la = (a.letra || 'A'), lb = (b.letra || 'A');
    return la < lb ? -1 : la > lb ? 1 : 0;
  });
  var cntEl = document.getElementById('adminRecCnt');
  if (cntEl) cntEl.textContent = recibos.length;
  if (!filtrados.length) {
    lista.innerHTML = '<div style="padding:16px;text-align:center;color:rgba(200,149,42,0.4);font-size:0.74rem;">Sin resultados</div>';
    if (_adminBulkModoActivo) adminBulkActualizarContador();
    return;
  }
  lista.innerHTML = filtrados.slice(0,200).map(function(r) {
    var idx = recibos.indexOf(r);
    var letra = r.letra || letraVersion(r) || 'A';
    var esSecundario = letra !== 'A';
    var folio = '#' + folioConLetra(r.folio||0, r.anio_folio, letra);
    var estado = r.cancelado ? '🚫 Cancelado' : (r.saldoPendiente > 0 ? '⚠️ Pendiente' : '✅ Liquidado');
    var colorEst = r.cancelado ? '#888' : (r.saldoPendiente > 0 ? '#c8952a' : '#2a9a4a');
    var badgeVersion = esSecundario
      ? '<span style="font-size:0.55rem;background:rgba(90,58,138,0.3);color:#c8a0ff;border-radius:3px;padding:1px 5px;margin-left:5px;font-weight:700;">VER.'+letra+'</span>'
      : '';

    // ── MODO "ELIMINAR VARIOS": fila simplificada con casilla, sin botones ──
    if (_adminBulkModoActivo) {
      var claveSel = (r.folio||0) + '|' + letra;
      var marcado = _adminBulkSeleccionados.has(claveSel);
      return [
        '<label style="display:flex;align-items:center;gap:10px;',
        'padding:8px 10px;border-bottom:1px solid rgba(200,149,42,0.1);cursor:pointer;',
        (esSecundario ? 'background:rgba(90,58,138,0.06);' : '') + (marcado ? 'background:rgba(192,22,26,0.07);' : '') + '">',
        '<input type="checkbox" ' + (marcado ? 'checked' : '') + ' onchange="adminBulkToggle(' + (r.folio||0) + ',\'' + letra + '\',this.checked)" style="width:16px;height:16px;flex-shrink:0;accent-color:#c0161a;cursor:pointer;">',
        '<div style="min-width:0;flex:1;">',
        '<div style="font-size:0.7rem;color:var(--gold-l);font-weight:700;letter-spacing:0.06em;">' + folio + badgeVersion + '</div>',
        '<div style="font-size:0.72rem;color:rgba(200,149,42,0.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;">' + escHTML(r.nombre||'—') + '</div>',
        '<div style="font-size:0.62rem;color:rgba(200,149,42,0.4);">' + (r.fecha||'') + ' &middot; <span style="color:' + colorEst + '">' + estado + '</span></div>',
        '</div>',
        '</label>'
      ].join('');
    }

    // ── MODO NORMAL: fila con los botones de siempre ──
    return [
      '<div style="display:flex;align-items:center;justify-content:space-between;',
      'padding:8px 10px;border-bottom:1px solid rgba(200,149,42,0.1);gap:6px;',
      (esSecundario ? 'background:rgba(90,58,138,0.06);' : '') + '">',
      '<div style="min-width:0;flex:1;">',
      '<div style="font-size:0.7rem;color:var(--gold-l);font-weight:700;letter-spacing:0.06em;">' + folio + badgeVersion + '</div>',
      '<div style="font-size:0.72rem;color:rgba(200,149,42,0.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">' + escHTML(r.nombre||'—') + '</div>',
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
      '<button onclick="adminEliminarReciboPorFolio(this,' + r.folio + ',\'' + (r.letra||letraVersion(r)||'A') + '\')" ',
      'style="background:#c0161a;border:none;border-radius:4px;color:#fff;',
      'padding:5px 9px;cursor:pointer;font-size:0.65rem;white-space:nowrap;">',
      '🗑 Eliminar</button>',
      (r.tipoTramite === 'vehicular' && !esSecundario ? [
        '<button onclick="adminCrearPendientePlacas(' + idx + ')" ',
        'style="background:#1a6a3a;border:none;border-radius:4px;color:#fff;',
        'padding:5px 9px;cursor:pointer;font-size:0.65rem;white-space:nowrap;">',
        '🚗 Pendiente</button>'
      ].join('') : ''),
      (esSecundario ? [
        '<button onclick="adminRevertirLetraA(' + idx + ')" ',
        'style="background:#5a3a8a;border:none;border-radius:4px;color:#fff;',
        'padding:5px 9px;cursor:pointer;font-size:0.65rem;white-space:nowrap;" ',
        'title="Revertir este recibo a VER.A (deshacer la versión secundaria)">',
        '↩ VER.A</button>'
      ].join('') : ''),
      '</div>',
      '</div>'
    ].join('');
  }).join('');
  if (_adminBulkModoActivo) adminBulkActualizarContador();
}

function adminBulkActivar() {
  var q = (document.getElementById('adminBuscarRecibo')||{}).value || '';
  var filtrados = adminFiltrarRecibosArr(q);
  if (!filtrados.length) {
    if (typeof toast === 'function') toast('No hay resultados para seleccionar', 'err');
    return;
  }
  _adminBulkModoActivo = true;
  // Por defecto TODOS los resultados visibles quedan seleccionados.
  _adminBulkSeleccionados = new Set(filtrados.map(function(r) {
    var letra = r.letra || letraVersion(r) || 'A';
    return (r.folio||0) + '|' + letra;
  }));
  var tb = document.getElementById('adminBulkToolbar'); if (tb) tb.style.display = 'flex';
  var btn = document.getElementById('adminBulkBtnActivar'); if (btn) btn.style.display = 'none';
  adminRenderRecibos(q);
}

function adminBulkToggle(folio, letra, checked) {
  var clave = folio + '|' + letra;
  if (checked) _adminBulkSeleccionados.add(clave);
  else _adminBulkSeleccionados.delete(clave);
  adminBulkActualizarContador();
}

function adminBulkActualizarContador() {
  var total = document.querySelectorAll('#adminReciboList input[type=checkbox]').length;
  var elC = document.getElementById('adminBulkContador');
  if (elC) elC.textContent = _adminBulkSeleccionados.size + ' de ' + total + ' seleccionados';
  var elB = document.getElementById('adminBulkBtnEliminar');
  if (elB) elB.textContent = '🗑️ Eliminar seleccionados (' + _adminBulkSeleccionados.size + ')';
}

function adminBulkSeleccionarTodos() {
  document.querySelectorAll('#adminReciboList input[type=checkbox]').forEach(function(cb) {
    if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
  });
}

function adminBulkDeseleccionarTodos() {
  document.querySelectorAll('#adminReciboList input[type=checkbox]').forEach(function(cb) {
    if (cb.checked) { cb.checked = false; cb.dispatchEvent(new Event('change')); }
  });
}

function adminBulkCancelar() {
  _adminBulkModoActivo = false;
  _adminBulkSeleccionados = new Set();
  var tb = document.getElementById('adminBulkToolbar'); if (tb) tb.style.display = 'none';
  var btn = document.getElementById('adminBulkBtnActivar'); if (btn) btn.style.display = '';
  adminFiltrarRecibos();
}

async function adminBulkEliminarSeleccionados() {
  if (_adminBulkSeleccionados.size === 0) {
    if (typeof toast === 'function') toast('No hay recibos seleccionados', 'err');
    return;
  }
  var pares = Array.from(_adminBulkSeleccionados).map(function(clave) {
    var p = clave.split('|');
    return { folio: parseInt(p[0],10), letra: p[1] };
  });
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var preview = pares.slice(0,8).map(function(p) {
    var rr = recibos.find(function(r) { return r.folio===p.folio && (r.letra||letraVersion(r)||'A')===p.letra; });
    var fs = (typeof folioConLetra==='function') ? folioConLetra(p.folio, rr&&rr.anio_folio, p.letra) : (p.folio+p.letra);
    return '#' + fs + (rr&&rr.nombre ? ' — ' + rr.nombre : '');
  }).join('\n');
  var extra = pares.length > 8 ? '\n… y ' + (pares.length-8) + ' más' : '';
  if (!confirm('☢️ ELIMINAR ' + pares.length + ' RECIBO(S)\n\n' + preview + extra + '\n\n⚠️ Esta acción NO se puede deshacer.')) return;

  var btnElim = document.getElementById('adminBulkBtnEliminar');
  if (btnElim) { btnElim.disabled = true; btnElim.style.opacity = '0.5'; }

  // Overlay de "espere" único para todo el lote (cada llamada individual va con
  // silent=true y no muestra/oculta el suyo, para no parpadear recibo por recibo).
  var _tieneOverlay = typeof window._mostrarGenerandoPDF === 'function' && typeof window._ocultarGenerandoPDF === 'function';
  if (_tieneOverlay) window._mostrarGenerandoPDF([], 'Eliminando ' + pares.length + ' recibo(s)…', 'Espera un momento, no cierres esta pestaña');

  var okCount = 0, failCount = 0;
  try {
    for (var i = 0; i < pares.length; i++) {
      var p = pares[i];
      var recsAhora = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
      var idx = recsAhora.findIndex(function(r) { return r && r.folio === p.folio && (r.letra||letraVersion(r)||'A') === p.letra; });
      if (idx < 0) { failCount++; continue; }
      if (_tieneOverlay) {
        var _fsTxt = (typeof folioConLetra==='function') ? folioConLetra(p.folio, recsAhora[idx]&&recsAhora[idx].anio_folio, p.letra) : (p.folio+p.letra);
        window._mostrarGenerandoPDF([], 'Eliminando ' + (i+1) + '/' + pares.length + ' — #' + _fsTxt + '…', 'Espera un momento, no cierres esta pestaña');
      }
      try {
        await adminEliminarRecibo(idx, true, true); // skipConfirm, silent
        okCount++;
      } catch(e) { console.warn('[adminBulkEliminarSeleccionados]', e); failCount++; }
    }
  } finally {
    if (_tieneOverlay) window._ocultarGenerandoPDF([]);
  }

  if (btnElim) { btnElim.disabled = false; btnElim.style.opacity = ''; }
  if (typeof toast === 'function') {
    toast('✅ ' + okCount + ' recibo(s) eliminado(s) y sincronizado(s)' + (failCount ? ' · ' + failCount + ' no encontrados' : ''), 'ok');
  }
  adminBulkCancelar();
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
  // 2. Verificar sesión real de administrador (ver nota en adminBorrarMovEspec)
  if(typeof _esAdminReal !== 'function' || !_esAdminReal()){
    showErr('Acceso restringido al administrador.'); return;
  }
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

function adminEliminarReciboPorFolio(btn, folio, letra){
  // Deshabilitar botón inmediatamente para evitar doble clic
  if(btn){ btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed'; }
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var idx = recibos.findIndex(function(r){ return r && r.folio === folio && (r.letra||letraVersion(r)||'A') === letra; });
  if(idx < 0){
    if(typeof toast === 'function') toast('❌ Recibo no encontrado', 'err');
    if(btn){ btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; }
    return;
  }
  adminEliminarRecibo(idx).finally(function(){
    // Re-habilitar solo si el recibo no fue eliminado (el usuario canceló)
    if(btn && btn.isConnected){ btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; }
  });
}

async function adminEliminarRecibo(idx, skipConfirm, silent) {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) return;
  var letra = r.letra || letraVersion(r) || 'A';
  var esPrimario = letra === 'A';
  var folioStr = folioFormato(r.folio||0, r.anio_folio);
  var folioConLetraStr = folioConLetra(r.folio||0, r.anio_folio, letra);
  var nombre = r.nombre || 'Sin nombre';
  // Detectar otras versiones del mismo folio (secundarias que sobrevivirán)
  var otrasVersiones = recibos.filter(function(rec, i) {
    return i !== idx && rec && rec.folio === r.folio;
  });
  var hayOtras = otrasVersiones.length > 0;
  var avisoVersiones = '';
  if (esPrimario && hayOtras) {
    var letrasOtras = otrasVersiones.map(function(rec){ return rec.letra || letraVersion(rec) || '?'; }).join(', ');
    avisoVersiones = '\n\n⚠️ ATENCIÓN: este folio tiene versiones secundarias (' + letrasOtras + ').\n' +
      'Al eliminar el A, esas versiones quedarán HUÉRFANAS (sin folio padre):\n' +
      'seguirán visibles en recibos y contabilidad pero sin su registro original.\n' +
      'Si lo que quieres es eliminar el trámite completo, elimina primero las versiones ' + letrasOtras + '.';
  } else if (!esPrimario) {
    avisoVersiones = '\n\n📌 Solo se elimina esta versión (' + letra + '). El folio primario y otras versiones no se afectan.';
  }
  var lineasEliminar = '• PDF en R2 (Cloudflare)\n• PDF en Supabase Storage\n• Backups de localStorage';
  if (!hayOtras) lineasEliminar = '• Contabilidad y movimientos\n• Historial de pagos\n' + lineasEliminar;
  if (!skipConfirm) {
    if (!confirm('☢️ ELIMINAR RECIBO #' + folioConLetraStr + '\n\nCliente: ' + nombre + '\nFecha: ' + (r.fecha||'') + avisoVersiones + '\n\nSe eliminará de:\n• Recibos\n' + lineasEliminar + '\n\n⚠️ Esta acción NO se puede deshacer.')) return;
    // FIX (caso real: folio 86A eliminado por error pese al confirm() de arriba)
    // — un solo OK/Cancelar es demasiado fácil de aceptar sin leer, sobre todo
    // en una lista donde el botón "Eliminar" está justo junto a "Editar"/"Fecha".
    // A petición expresa, se agrega un segundo paso: escribir el folio exacto
    // (mismo patrón ya usado en "Borrado Total", que pide escribir "BORRAR
    // TODO"). Si no coincide, se cancela sin borrar nada.
    var _confTexto = prompt('Para confirmar, escribe el folio exacto: ' + folioConLetraStr);
    if (_confTexto === null) return; // canceló
    if (_confTexto.trim().toUpperCase() !== folioConLetraStr.toUpperCase()) {
      if (typeof toast === 'function') toast('❌ No coincide — eliminación cancelada, nada se borró', 'err');
      return;
    }
  }
  // Overlay de "espere" (mismo que al generar un PDF) mientras dura el borrado real
  // en Supabase/R2 — en modo bulk (silent) lo maneja adminBulkEliminarSeleccionados
  // una sola vez para todo el lote, para no parpadear en cada recibo.
  if (!silent && typeof window._mostrarGenerandoPDF === 'function') {
    window._mostrarGenerandoPDF([], 'Eliminando recibo…', 'Espera un momento, no cierres esta pestaña');
  }
  // Bloquear inmediatamente cualquier sincronización descendente mientras dura el borrado.
  _ultimoSyncPropio = Date.now();
  // Registrar tombstone ANTES de cualquier await para que todos los clientes filtren
  // este folio+letra durante el merge, incluso si tienen el recibo en su memoria local.
  if (!Array.isArray(appData.folios_eliminados)) appData.folios_eliminados = [];
  if (!appData.folios_eliminados.some(function(t){ return String(t.folio)===String(r.folio) && t.letra===letra; }))
    // ts con +10s de margen para ganar sobre cualquier _revivedTs grabado en SB en syncs anteriores
    appData.folios_eliminados.push({ folio: r.folio, letra: letra, ts: Date.now() + 10000 });
  // Notificar a TODOS los clientes conectados para que eliminen el folio de su memoria local
  // inmediatamente, sin esperar al ciclo de sync (que podría ser muy tardío si la empleada
  // tiene el folio en memoria y lo re-sube antes de recibir el tombstone).
  try {
    if (typeof _lexRealtimeChannel !== 'undefined' && _lexRealtimeChannel && _lexRealtimeChannel.state === 'joined') {
      // ts+10000 = mismo margen que el tombstone local para ganar sobre cualquier _revivedTs en SB
      _lexRealtimeChannel.send({
        type:    'broadcast',
        event:   'folio_eliminado',
        payload: { folio: r.folio, letra: letra, ts: Date.now() + 10000, _adminForce: true }
      }).catch(function(){});
    }
  } catch(e) { console.warn('[folio_eliminado broadcast]', e); }
  // 1. Eliminar recibo del array (solo el específico por índice)
  recibos.splice(idx, 1);
  // Purgar el historial de pagos parciales de esta letra en TODAS las versiones del
  // folio, para que no reaparezca como abono fantasma en el formulario de actualización.
  _purgarPagosParcialesDeVersion(r.folio, letra, r);
  // 1b. Re-vincular REC.recibos ANTES de recalcular: si REC apunta a un array
  // distinto (ocurre tras un merge de Supabase), aún contendría el folio
  // borrado y el recálculo devolvería el número siguiente en vez de reutilizarlo.
  if (typeof REC !== 'undefined') REC.recibos = appData.recibos;
  // 2. Recalcular folioActual: máximo existente + 1 (solo reutiliza si era el último)
  if (!hayOtras && typeof appData !== 'undefined') {
    appData.folioActual = _recalcularFolioActual();
    if (typeof REC !== 'undefined') REC.folioActual = appData.folioActual;
    if (typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
  }
  // 3. Eliminar movimientos de esta letra; tombstone para que no regresen de Supabase
  if (typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
    var folioNum = r.folio;
    if (!Array.isArray(D.movimientos_eliminados)) D.movimientos_eliminados = [];
    // Identificar movimientos a eliminar ANTES de filtrar para hacer tombstone
    var movsAEliminar;
    if (hayOtras) {
      movsAEliminar = D.movimientos.filter(function(m) {
        if (!m) return false;
        return m.fuente === 'recibo' && m.folio == folioNum && (m.letra || 'A') === letra;
      });
      D.movimientos = D.movimientos.filter(function(m) {
        if (!m) return false;
        return !(m.fuente === 'recibo' && m.folio == folioNum && (m.letra || 'A') === letra);
      });
    } else {
      movsAEliminar = D.movimientos.filter(function(m) {
        if (!m) return false;
        var porFolioFuente = (m.fuente === 'recibo' && m.folio == folioNum);
        var porId = (m.id||'').includes('REC-'+folioNum) ||
                    (m.id||'').includes('M-REC-'+folioNum) ||
                    (m.id||'').includes('recibo-'+folioNum) ||
                    (m.id||'').includes('rec-'+folioNum) ||
                    (m.id||'').includes('-'+folioNum+'-');
        var porDescripcion = (m.descripcion||'').includes('#'+folioStr);
        return porFolioFuente || porId || porDescripcion;
      });
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
    // Registrar tombstone de cada movimiento eliminado para que Supabase no los restaure
    movsAEliminar.forEach(function(m) {
      if (m && m.id && !D.movimientos_eliminados.some(function(t){ return t.id === m.id; })) {
        D.movimientos_eliminados.push({ id: m.id, folio: m.folio, letra: m.letra||'A', monto: m.monto, ts: Date.now() });
      }
      // FIX (caso real: folio 110B borrado y el MONITOR no lo mostró): este era
      // el ÚNICO camino de borrado de movimientos que no dejaba rastro en la
      // Bitácora Real. adminCorregirEliminarMov sí llamaba a _auditoriaRegistrar,
      // pero al eliminar un recibo completo los movimientos se quitaban con un
      // filter() directo, sin auditar — justo el borrado más delicado de todos
      // se volvía invisible. Ahora cada movimiento retirado por esta vía queda
      // registrado en sesiones_log con su hora REAL de servidor.
      if (m && typeof _auditoriaRegistrar === 'function') {
        _auditoriaRegistrar('eliminado', m, { origen: 'adminEliminarRecibo', recibo_eliminado: folioConLetraStr });
      }
    });
    // Notificar al monitor de SCANSYS
    if (movsAEliminar.length > 0) {
      window._adminDeletedMovs = (window._adminDeletedMovs||0) + movsAEliminar.length;
    }
  }
  // 4. Eliminar historial de pagos solo si no quedan otras versiones
  if (!hayOtras && typeof appData !== 'undefined' && appData.historialPagos) {
    delete appData.historialPagos[r.folio];
  }
  // 5. Eliminar snapshots de esta versión específica (por folio + letra)
  if (typeof D !== 'undefined' && Array.isArray(D.snapshotsRecibos)) {
    D.snapshotsRecibos = D.snapshotsRecibos.filter(function(s){
      return !(s.folio === r.folio && (!s.letra || s.letra === letra));
    });
  }
  // 6. Sincronizar REC con el estado actual de appData.recibos (ya tiene el splice aplicado)
  if (typeof REC !== 'undefined') {
    REC.recibos = appData.recibos;
    if (typeof appData !== 'undefined') REC.folioActual = appData.folioActual;
  }
  // Excluir de caja solo si ya no queda ninguna versión
  if (!hayOtras && typeof D !== 'undefined') {
    if (!Array.isArray(D.recibosExcluidosCaja)) D.recibosExcluidosCaja = [];
    var _fs = String(r.folio);
    if (!D.recibosExcluidosCaja.map(String).includes(_fs)) D.recibosExcluidosCaja.push(_fs);
  }
  // ── UI INMEDIATA: refrescar antes de cualquier operación de red ──
  var _q = (document.getElementById('adminBuscarRecibo')||{}).value||'';
  adminRenderRecibos(_q);
  if (typeof renderRec       === 'function') renderRec();
  if (typeof renderHistorial === 'function') renderHistorial();
  if (typeof renderCaja      === 'function') renderCaja();
  if (typeof renderContab    === 'function') renderContab();
  if (typeof badges          === 'function') badges();
  // Cerrar/refrescar Ficha del Folio o el buscador de folios si estaban abiertos
  // mostrando justo este folio en ESTE mismo cliente que ejecuta el borrado.
  if (typeof window._notificarFolioEliminadoUI === 'function') window._notificarFolioEliminadoUI(r.folio, letra);
  // El toast de éxito ahora se muestra al final, cuando la persistencia real ya
  // terminó (ver overlay "Eliminando recibo…" de abajo) — así no se avisa "listo"
  // antes de que en verdad haya quedado guardado en Supabase.

  // FIX (caso real: folio 87B eliminado por el usuario pero seguía vivo en Supabase):
  // el borrado se sentía "instantáneo" en la UI, pero la persistencia real hacia
  // Supabase/R2 ocurría en un IIFE sin await — si la pestaña se cerraba o recargaba
  // antes de que ese bloque terminara, la eliminación NUNCA llegaba al servidor y
  // el recibo "resucitaba" al siguiente pull, aunque el tombstone local ya existiera
  // en memoria. Se arma la bandera de "cambios pendientes" YA MISMO (antes de que
  // arranque la red) para que el guardado de emergencia de beforeunload (sendBeacon)
  // pueda intervenir si el usuario cierra la pestaña durante esta ventana.
  if (typeof window._marcarCambiosPendientes === 'function') window._marcarCambiosPendientes();

  // ── OPERACIONES DE RED (antes en background sin await; ahora se espera a que
  // terminen de verdad para garantizar que la eliminación quede persistida) ──
  try {
  await (async function _eliminarBackground(){
    // 6a. Limpiar rastros de movimientos huérfanos que puedan quedar de versiones
    // anteriores del mismo folio (ej: si existían 4B y 4C antes de eliminar 4A,
    // sus movimientos deben desaparecer para que el scanner no los marque como error).
    if (typeof window.limpiarRastrosMovimientos === 'function') {
      try { await window.limpiarRastrosMovimientos(r.folio, null); } catch(e) { console.warn('[eliminar] limpiarRastros:', e); }
    }
    // 6b. Borrar de versiones_recibo en SB
    if (window.SB && window.SB_DESPACHO_ID) {
      try {
        await window.SB.from('versiones_recibo')
          .delete()
          .eq('despacho_id', window.SB_DESPACHO_ID)
          .eq('folio_base', r.folio)
          .eq('letra', letra);
      } catch(e) { console.warn('[eliminar] versiones_recibo:', e); }
    }
    // 7. Borrar PDFs de R2 y Drive en paralelo
    try {
      const _pathsBorrar = new Set();
      if (r.archivo) _pathsBorrar.add(r.archivo);
      if (r.archivoR2 && r.archivoR2 !== r.archivo) _pathsBorrar.add(r.archivoR2);
      _pathsBorrar.add(folioConLetraStr + '.pdf');
      if (typeof _nombreArchivoR2 === 'function') _pathsBorrar.add(_nombreArchivoR2(folioConLetraStr, r.nombre||''));
      await Promise.allSettled([...(_pathsBorrar)].flatMap(function(_pn){
        var ops = [];
        if (typeof window.borrarR2 === 'function' && window.SB_DESPACHO_ID)
          ops.push(window.borrarR2(window.SB_DESPACHO_ID + '/recibos/' + _pn, 'recibos').catch(function(){}));
        if (typeof borrarPDFdeDrive === 'function')
          ops.push(borrarPDFdeDrive(_pn).catch(function(){}));
        return ops;
      }));
    } catch(e){ console.warn('[eliminar] R2/Drive:', e); }
    // 8. Limpiar backups de localStorage
    try {
      ['D','appData'].forEach(function(tipo) {
        var idxStr = localStorage.getItem('lex_backup_idx_' + tipo);
        if (!idxStr) return;
        var idxArr = JSON.parse(idxStr);
        idxArr.forEach(function(item) {
          try {
            var bk = JSON.parse(localStorage.getItem(item.clave)||'null');
            if (!bk || !bk.datos) return;
            if (Array.isArray(bk.datos.recibos))
              bk.datos.recibos = bk.datos.recibos.filter(function(rec){
                return !(rec && rec.folio === r.folio && (rec.letra||letraVersion(rec)||'A') === letra);
              });
            if (!hayOtras && Array.isArray(bk.datos.movimientos))
              bk.datos.movimientos = bk.datos.movimientos.filter(function(m){
                return m && !(m.fuente==='recibo' && m.folio==r.folio);
              });
            try{ localStorage.setItem(item.clave, JSON.stringify(bk)); } catch(e){ registrarError('localStorage.setItem', e); }
          } catch(e2) {}
        });
      });
    } catch(eLs) { console.warn('localStorage cleanup:', eLs); }
    // 9. Sync a Supabase + purga directa (secuencial para consistencia)
    // FIX: estas llamadas no tenían timeout — si el request se quedaba colgado
    // (worker sin responder, red inestable), el await se congelaba indefinidamente
    // y la eliminación jamás llegaba a la purga directa de abajo (paso 9b), que es
    // la que de verdad garantiza que el recibo no "resucite". Con _sbConTimeout,
    // tras 15s sin respuesta se registra el fallo y se continúa con la purga.
    _ultimoSyncPropio = Date.now();
    try { await _sbConTimeout(actualizarArchivoControl(), 15000, 'Eliminar recibo: actualizarArchivoControl'); } catch(e){ console.warn('[eliminar] archivoControl:', e); }
    try { await _sbConTimeout(syncEstadoSupabase(), 15000, 'Eliminar recibo: syncEstadoSupabase'); } catch(e){ console.warn('[eliminar] sync:', e); }
    // 9b. Purga directa autoritativa en SB — esta es la operación crítica: si
    // solo esta falla, el recibo puede seguir vivo en Supabase aunque la UI local
    // ya lo haya dado por eliminado. Por eso se envuelve en su propio timeout y,
    // si aun así falla, se encola para reintentar cuando vuelva la conexión.
    var _purgaOk = false;
    try {
      if (window.SB && window.SB_DESPACHO_ID) {
        const { data: _sbPurgaRow } = await _sbConTimeout(
          window.SB.from('app_state').select('recibos').eq('despacho_id', window.SB_DESPACHO_ID).maybeSingle(),
          15000, 'Eliminar recibo: leer recibos SB'
        );
        if (_sbPurgaRow?.recibos) {
          var _sbPurgaDat = JSON.parse(JSON.stringify(_sbPurgaRow.recibos));
          _sbPurgaDat.recibos = (_sbPurgaDat.recibos||[]).filter(function(rec){
            return !(String(rec.folio)===String(r.folio) && (rec.letra||'A')===letra);
          });
          if (!Array.isArray(_sbPurgaDat.folios_eliminados)) _sbPurgaDat.folios_eliminados = [];
          if (!_sbPurgaDat.folios_eliminados.some(function(t){
            return String(t.folio)===String(r.folio) && t.letra===letra;
          })) _sbPurgaDat.folios_eliminados.push({ folio: r.folio, letra: letra, ts: Date.now() + 10000 });
          await _sbConTimeout(
            window.SB.from('app_state').update({ recibos: _sbPurgaDat }).eq('despacho_id', window.SB_DESPACHO_ID),
            15000, 'Eliminar recibo: purga directa SB'
          );
          console.log('[adminEliminarRecibo] Purga directa SB completada —', folioConLetraStr);
          _purgaOk = true;
        } else {
          _purgaOk = true; // no había fila que purgar — nada pendiente
        }
      }
    } catch(_ePurga){ console.warn('[adminEliminarRecibo] Purga directa SB:', _ePurga); }
    if (_purgaOk) {
      if (typeof window._marcarGuardadoOk === 'function') window._marcarGuardadoOk();
    } else {
      // La operación que de verdad garantiza que el recibo no reviva falló o se
      // quedó colgada — se deja la bandera de "pendiente" activa (para que
      // beforeunload intente el guardado de emergencia) y se encola para
      // reintentar en cuanto vuelva la conexión/token.
      if (typeof window._encolarGuardadoPendiente === 'function') window._encolarGuardadoPendiente('syncEstado', null);
      if (typeof toast === 'function') toast('⚠️ #' + folioConLetraStr + ' eliminado localmente, pero falló la confirmación con Supabase — se reintentará solo', 'warn');
      return;
    }
    if (!silent && typeof toast === 'function') toast('✅ Recibo #' + folioConLetraStr + ' eliminado y sincronizado.', 'ok');
  })();
  } finally {
    // El overlay solo lo mostró esta misma función cuando !silent — se oculta
    // aquí sin importar si el borrado terminó bien o mal, para nunca dejarlo pegado.
    if (!silent && typeof window._ocultarGenerandoPDF === 'function') window._ocultarGenerandoPDF([]);
  }
}

function adminAbrirCambiarFecha(idx) {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) return;
  var folio = folioFormato(r.folio||0);
  var fechaActual = r.fecha || r.fecha_recibo || '';
  var horaActual = r.hora || r.hora_recibo || '';
  // Buscar movimientos vinculados a este recibo (cada uno con su propio ID)
  var movsVinculados = (D.movimientos||[]).filter(function(m){
    // ⚠️ FIX: Number() en ambos lados — m.folio puede venir como STRING desde
    // Supabase/jsonb, r.folio es NUMBER; sin esto no se listaban los movimientos
    // de folios cuyo id no sigue el patrón "M-REC-{folio}" (ej. restaurados).
    return Number(m.folio) === Number(r.folio) && (m.fuente === 'recibo' || (m.id||'').includes(String(r.folio)));
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

async function adminRevertirLetraA(idx) {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) { toast('Recibo no encontrado', 'err'); return; }
  var letraActual = r.letra || (typeof letraVersion === 'function' ? letraVersion(r) : 'A') || 'A';
  if (letraActual === 'A') { toast('Este recibo ya es VER.A — no necesita revertirse', 'err'); return; }
  var folioStr = typeof folioConLetra === 'function'
    ? folioConLetra(r.folio, r.anio_folio, letraActual) : r.folio + letraActual;
  if (!confirm('¿Revertir el recibo #' + folioStr + ' (VER.' + letraActual + ') a VER.A?\n\n' +
    'Esto:\n' +
    '• Cambia la letra del recibo de ' + letraActual + ' a A\n' +
    '• Elimina la copia VER.' + letraActual + ' del historial de recibos\n' +
    '• Corrige los movimientos en contabilidad para que muestren ' + r.folio + '-001A\n' +
    '• Sincroniza con Supabase\n\n' +
    'El registro VER.A original recupera todos los datos de esta versión.\n' +
    'Esta acción no se puede deshacer.')) return;
  // 1. Buscar versión A original del mismo folio
  var idxA = recibos.findIndex(function(_r) {
    return _r.folio === r.folio && !_r.esComplemento && (_r.letra || 'A') === 'A';
  });
  if (idxA >= 0 && idxA !== idx) {
    // Copiar datos clave de la versión B/C al registro A (para que quede actualizado)
    var rA = recibos[idxA];
    // Preservar datos de pago/saldo de la versión más reciente
    rA.saldoPendiente  = r.saldoPendiente;
    rA.totalAbonado    = r.totalAbonado;
    rA.saldoNuevo      = r.saldoNuevo;
    rA.pagosParciales  = r.pagosParciales  || rA.pagosParciales;
    rA.costosExtra     = r.costosExtra     || rA.costosExtra;
    rA.fechasImpresion = r.fechasImpresion || rA.fechasImpresion;
    rA.pdfBase64       = null; // invalidar caché
    rA.archivo         = typeof folioConLetra === 'function'
      ? folioConLetra(r.folio, r.anio_folio, 'A') + '.pdf' : r.folio + 'A.pdf';
    // Eliminar la versión B del array
    appData.recibos.splice(idx, 1);
    if (typeof _purgarPagosParcialesDeVersion === 'function') _purgarPagosParcialesDeVersion(r.folio, letraActual, r);
  } else if (idxA < 0) {
    // No existe versión A separada — simplemente cambiar letra de este registro
    r.letra   = 'A';
    r.archivo = typeof folioConLetra === 'function'
      ? folioConLetra(r.folio, r.anio_folio, 'A') + '.pdf' : r.folio + 'A.pdf';
    r.pdfBase64 = null;
  }
  // 2. Corregir TODOS los movimientos de este folio en D.movimientos
  if (typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
    var folioStrA = typeof folioConLetra === 'function'
      ? folioConLetra(r.folio, r.anio_folio, 'A') : r.folio + 'A';
    D.movimientos.forEach(function(m) {
      if (String(m.folio) !== String(r.folio)) return;
      // Cambiar letra del movimiento a 'A'
      m.letra = 'A';
      // Actualizar campo cat para que muestre la letra correcta
      if (m.cat) {
        m.cat = m.cat.replace(/#\d{2}-\d{3,}[A-Z]/, '#' + folioStrA);
      }
      // Actualizar descripcion si contiene el folio antiguo
      if (m.descripcion) {
        m.descripcion = m.descripcion.replace(
          new RegExp('Recibo #' + (r.anio_folio ? String(r.anio_folio).slice(-2) : '\\d{2}') + '-\\d{3,}' + letraActual + '\\b', 'g'),
          'Recibo #' + folioStrA
        );
      }
    });
  }
  // 3. Sincronizar con Supabase — esperar confirmación antes de persistir local
  toast('⏳ Revirtiendo a VER.A y sincronizando...');
  try {
    if (window.SB && window.SB_DESPACHO_ID) {
      var movsLimpios = (D.movimientos || []).filter(function(m){ return m && m.id && !/^R-\d+$/.test(m.id); });
      var estado = {
        movimientos: movsLimpios,
        directorio:  D.directorio  || [], carpetas: D.carpetas || [],
        juicios:     D.juicios     || [], pendientes: D.pendientes || [],
        citas:       D.citas       || [],
        cierres:     D.cierres     || [], prestamos:  D.prestamos || [],
        saldoAcumulado: D.saldoAcumulado || 0,
        escrituras:  D.escrituras  || [],
        recibosExcluidosCaja: D.recibosExcluidosCaja || [],
        captura_meses: (typeof capturaMesCargar === 'function' ? capturaMesCargar() : null) || D.captura_meses || {},
        retro_global: window._retroGlobalActivo !== undefined
          ? { activo: !!window._retroGlobalActivo } : (D.retro_global || null),
        tiempoExtra: D.tiempoExtra || {}
      };
      var recibosSync = {
        folioActual: (typeof REC !== 'undefined' && REC.folioActual) ? REC.folioActual : (appData.folioActual || 100),
        recibos:     appData.recibos || []
      };
      var user = (await window.SB.auth.getUser()).data.user;
      var res  = await window.SB.from('app_state').update({
        data: estado, recibos: recibosSync,
        folio_actual: recibosSync.folioActual,
        updated_by: user ? user.id : null
      }).eq('despacho_id', window.SB_DESPACHO_ID);
      if (res.error) throw new Error(res.error.message);
    }
  } catch(e) {
    toast('⚠ Error al sincronizar con Supabase: ' + e.message, 'err');
    console.warn('[revertirLetraA] sync error:', e);
    // No revertir — los cambios locales ya se hicieron; el usuario debe reintentar
  }
  // 4. Persistir local y refrescar UI
  try { if (typeof backupLocal === 'function') backupLocal('D', D); } catch(e){}
  if (typeof save === 'function') save();
  if (typeof renderCaja === 'function') renderCaja();
  if (typeof renderContab === 'function') renderContab();
  if (typeof badges === 'function') badges();
  adminFiltrarRecibos();
  toast('✅ Recibo #' + folioStrA + ' revertido a VER.A correctamente');
}

function adminAbrirEditarRecibo(idx) {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) return;
  _lockIntentarAdquirir(r.folio).then(function(_lockRes){
  if (!_lockRes.ok) { _lockAvisoBloqueo(_lockRes, r.folio); return; }

  // A petición expresa: la edición rápida (este modal) ahora también está
  // disponible para folios secundarios (B, C, D…), no solo para el A. Antes
  // se redirigía SIEMPRE a _abrirEdicionSecundario (Edición Completa) sin dar
  // opción a una edición simple — el botón "✏️ Edición Completa (PDF)" de este
  // mismo modal sigue siendo el camino para esa edición completa si se
  // necesita.
  var _letraEdit = r.letra || (typeof letraVersion==='function' ? letraVersion(r) : 'A') || 'A';
  var _esSecundario = _letraEdit !== 'A';

  // ── Llenar campos comunes ──
  document.getElementById('adminEditIdx').value = idx;
  var _fRef = document.getElementById('adminEditFolioRef'); if(_fRef) _fRef.value = r.folio != null ? r.folio : '';
  var _lRef = document.getElementById('adminEditLetraRef'); if(_lRef) _lRef.value = _letraEdit;
  document.getElementById('adminEditFolioLabel').textContent = '#' + folioConLetra(r.folio||0, r.anio_folio, _letraEdit);
  document.getElementById('adminEditNombre').value = r.nombre || '';
  document.getElementById('adminEditFecha').value = r.fecha || r.fecha_recibo || '';
  document.getElementById('adminEditHora').value = r.hora || r.hora_recibo || '';
  document.getElementById('adminEditTramites').value = r.tramites || '';
  document.getElementById('adminEditResponsable').value = (r.responsable || r.generadoPor || 'LIC ANTONIETA CHAVEZ MONTAR').toUpperCase();
  var _tipoSel = document.getElementById('adminEditTipoTramite');
  if (_tipoSel) _tipoSel.value = r.tipoTramite || 'normal';

  var totalEl = document.getElementById('adminEditTotal');
  var anticipoEl = document.getElementById('adminEditAnticipo');
  var totalLbl = document.getElementById('adminEditTotalLabel');
  var anticipoLbl = document.getElementById('adminEditAnticipoLabel');
  var ctxDiv = document.getElementById('adminEditVersionCtx');

  if (!_esSecundario) {
    // ── FOLIO PRIMARIO (A): flujo original ──
    var total = 0;
    if (r.conceptos && r.conceptos.length) {
      r.conceptos.forEach(function(c){ total += parseFloat(c.precio||0) * parseFloat(c.cantidad||1); });
      if (r.costosExtra) r.costosExtra.forEach(function(ce){ total += parseFloat(ce.monto||0); });
    }
    if (totalEl) { totalEl.value = total || ''; totalEl.readOnly = false; totalEl.style.opacity = '1'; }
    if (anticipoEl) anticipoEl.value = r.anticipo || '';
    if (totalLbl) totalLbl.textContent = '💰 Total del Trámite';
    if (anticipoLbl) anticipoLbl.textContent = '💵 Anticipo / Abono';
    document.getElementById('adminEditPadreAnticipo').value = '';
    document.getElementById('adminEditSumaPPAntes').value = '';
    if (ctxDiv) ctxDiv.style.display = 'none';
  } else {
    // ── FOLIO SECUNDARIO (B, C, D…): el TOTAL pactado y el anticipo original
    // pertenecen SIEMPRE al folio A (frozen) — aquí solo se edita el abono
    // propio de ESTA versión, igual que ya rige en Edición Completa. ──
    var _padreB = recibos.find(function(x){
      return x.folio === r.folio && !x.esComplemento &&
             (x.letra || (typeof letraVersion==='function' ? letraVersion(x):'A') || 'A') === 'A';
    }) || r;
    var _totalFrozen = 0;
    (_padreB.conceptos||[]).forEach(function(c){ _totalFrozen += parseFloat(c.precio||0) * parseFloat(c.cantidad||1); });
    var _padreAnticipo = parseFloat(_padreB.anticipo || 0) || 0;
    var _todasPP = r.pagosParciales || [];
    var _ppAntes = _todasPP.filter(function(p){ return (p.folioLetra||'A') < _letraEdit; });
    var _ppEsta  = _todasPP.filter(function(p){ return (p.folioLetra||'A') === _letraEdit; });
    var _sumaPPAntes = _ppAntes.reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0);
    var _sumaPPEsta  = _ppEsta.reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0);
    if (totalEl) { totalEl.value = _totalFrozen || ''; totalEl.readOnly = true; totalEl.style.opacity = '0.6'; }
    if (anticipoEl) anticipoEl.value = _sumaPPEsta || '';
    if (totalLbl) totalLbl.textContent = '💰 Total del Trámite (fijo, ver. A)';
    if (anticipoLbl) anticipoLbl.textContent = '💵 Abono de esta versión';
    document.getElementById('adminEditPadreAnticipo').value = _padreAnticipo;
    document.getElementById('adminEditSumaPPAntes').value = _sumaPPAntes;
    if (ctxDiv) {
      ctxDiv.style.display = '';
      var elOrig = document.getElementById('adminEditCtxFolioOrig');
      if (elOrig) elOrig.textContent = '#' + folioConLetra(r.folio||0, r.anio_folio, 'A');
      var elAntOrig = document.getElementById('adminEditCtxAnticipoOrig');
      if (elAntOrig) elAntOrig.textContent = '$' + _padreAnticipo.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
      var elTotAb = document.getElementById('adminEditCtxTotalAbonado');
      if (elTotAb) elTotAb.textContent = '$' + (_padreAnticipo + _sumaPPAntes + _sumaPPEsta).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
      var elFechaAct = document.getElementById('adminEditCtxFechaAct');
      if (elFechaAct) elFechaAct.textContent = (r.fecha || r.fecha_recibo || '—') + ' ' + (r.hora || r.hora_recibo || '');
      var elPagos = document.getElementById('adminEditCtxPagos');
      if (elPagos) {
        elPagos.innerHTML = _ppEsta.length
          ? _ppEsta.map(function(p){ return escHTML((p.concepto||'Abono') + ': $' + (parseFloat(p.cantidad)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})); }).join('<br>')
          : '— Sin abonos propios en esta versión —';
      }
    }
  }
  adminEditRecalcSaldo();
  // Mostrar zona de edición
  document.getElementById('adminGestionRecibosZone').classList.remove('show');
  document.getElementById('adminEditarReciboZone').classList.add('show');
  }); // fin _lockIntentarAdquirir(adminAbrirEditarRecibo)
}

function adminEditRecalcSaldo() {
  var total = parseFloat(document.getElementById('adminEditTotal').value) || 0;
  var anticipoInput = parseFloat(document.getElementById('adminEditAnticipo').value) || 0;
  // Folio secundario (B, C, D…): el campo Anticipo/Abono representa solo el
  // abono de ESTA versión — el saldo real resta también el anticipo original
  // del folio A y los abonos de versiones anteriores (ver adminEditPadreAnticipo/
  // adminEditSumaPPAntes, calculados al abrir el modal en adminAbrirEditarRecibo).
  var _padreAntEl = document.getElementById('adminEditPadreAnticipo');
  var _sumaAntesEl = document.getElementById('adminEditSumaPPAntes');
  var _esSecRecalc = !!(_padreAntEl && _padreAntEl.value !== '');
  var anticipo = _esSecRecalc
    ? (parseFloat(_padreAntEl.value)||0) + (parseFloat(_sumaAntesEl.value)||0) + anticipoInput
    : anticipoInput;
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

function abrirEdicionCompletaSidebar() {
  // Si ya hay sesión activa, ir directo a la zona de edición
  if(typeof adminSesionActiva !== 'undefined' && adminSesionActiva){
    // Mostrar el modal si no está visible
    const ov = document.getElementById('adminModalOv');
    if(ov) ov.classList.add('show');
    // Ocultar todas las zonas y mostrar la de edición completa
    document.querySelectorAll('#adminModal .admin-panel').forEach(p => p.classList.remove('show'));
    const zona = document.getElementById('adminEdicionCompletaZone');
    if(zona) zona.classList.add('show');
    const inp = document.getElementById('adminEdicionBuscar');
    if(inp) inp.value = '';
    adminEdicionFiltrar();
  } else {
    // Necesita autenticarse primero; guardar acción pendiente
    window._adminAccionPendiente = 'edicionCompleta';
    if(typeof abrirAdminModal === 'function') abrirAdminModal();
  }
}

function adminAbrirEdicionCompletaZona() {
  document.querySelectorAll('#adminModal .admin-panel').forEach(p => p.classList.remove('show'));
  const zona = document.getElementById('adminEdicionCompletaZone');
  if(zona) zona.classList.add('show');
  const inp = document.getElementById('adminEdicionBuscar');
  if(inp) inp.value = '';
  adminEdicionFiltrar();
}

function adminEdicionFiltrar() {
  const q = ((document.getElementById('adminEdicionBuscar') || {}).value || '').toLowerCase();
  const lista = document.getElementById('adminEdicionLista');
  if(!lista) return;
  const recibos = ((appData || {}).recibos || []).filter(r => !r.esComplemento);
  const filtrados = q
    ? recibos.filter(r => {
        const fs = folioConLetra(r.folio, r.anio_folio, r.letra||letraVersion(r)||'A');
        return fs.includes(q) || (r.nombre || '').toLowerCase().includes(q) || (r.fecha || '').includes(q) || (r.fecha_recibo || '').includes(q);
      })
    : recibos;
  if(!filtrados.length) {
    lista.innerHTML = '<p style="color:var(--muted);font-size:0.78rem;text-align:center;padding:20px;">No se encontraron recibos.</p>';
    return;
  }
  lista.innerHTML = filtrados.slice(0, 40).map(r => {
    const fs   = folioConLetra(r.folio, r.anio_folio, r.letra||letraVersion(r)||'A');
    const saldo = parseFloat(r.saldoPendiente || 0);
    const cancelado = r.cancelado || r.estatus === 'CANCELADO';
    const saldoTag = cancelado
      ? '<span style="font-family:monospace;font-size:0.62rem;color:#c0161a;background:#ffe8e8;padding:1px 6px;border-radius:3px;">Cancelado</span>'
      : saldo > 0
        ? '<span style="font-family:monospace;font-size:0.62rem;color:#c07a10;background:#fff4e0;padding:1px 6px;border-radius:3px;">$' + saldo.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}) + '</span>'
        : '<span style="font-family:monospace;font-size:0.62rem;color:#1a7a3a;background:#e8f5e9;padding:1px 6px;border-radius:3px;">Liquidado</span>';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid rgba(200,149,42,0.15);border-radius:6px;margin-bottom:6px;background:rgba(200,149,42,0.04);">
      <div style="min-width:0;flex:1;">
        <span style="font-family:'DM Mono',monospace;font-size:0.8rem;font-weight:700;color:var(--gold-l);">#${fs}</span>
        <span style="font-size:0.74rem;color:var(--muted);margin-left:8px;">${escHTML(r.nombre||'')}</span>
        <span style="font-size:0.62rem;color:rgba(150,130,100,0.7);margin-left:6px;">${r.fecha||r.fecha_recibo||''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        ${saldoTag}
        <button onclick="adminSeleccionarParaEditar(${r.folio},'${r.letra||(typeof letraVersion==='function'?letraVersion(r):'A')||'A'}')"
          style="background:linear-gradient(135deg,#1a4a8a,#0f2f5a);border:1px solid rgba(100,160,255,0.3);border-radius:4px;color:#c8e0ff;padding:5px 12px;cursor:pointer;font-family:monospace;font-size:0.68rem;font-weight:600;white-space:nowrap;">
          ✏️ Editar
        </button>
      </div>
    </div>`;
  }).join('');
}

function adminSeleccionarParaEditar(folio, letra) {
  const letraBuscar = letra || 'A';
  const r = ((appData || {}).recibos || []).find(x =>
    x.folio === folio && !x.esComplemento &&
    (x.letra || (typeof letraVersion==='function'?letraVersion(x):'A') || 'A') === letraBuscar
  );
  if(!r){ if(typeof toast === 'function') toast('Recibo no encontrado', 'err'); return; }
  if(typeof cerrarAdminModal === 'function') cerrarAdminModal();
  editarReciboEnConsulta(r);
}

function adminAbrirEdicionCompleta() {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  // Buscar por folio+letra (exacto), respaldo por índice directo
  var _folioRef = document.getElementById('adminEditFolioRef');
  var _letraRefVal = (document.getElementById('adminEditLetraRef') || {}).value || 'A';
  var _folioVal = _folioRef ? parseInt(_folioRef.value) : NaN;
  var r = (!isNaN(_folioVal) && _folioVal !== 0)
    ? recibos.find(function(x){ return x.folio === _folioVal && (x.letra||(typeof letraVersion==='function'?letraVersion(x):'A')||'A') === _letraRefVal; })
    : null;
  if (!r) {
    var idx = parseInt(document.getElementById('adminEditIdx').value);
    r = recibos[idx];
  }
  if (!r) { if (typeof toast === 'function') toast('Error: recibo no encontrado', 'err'); return; }
  _lockIntentarAdquirir(r.folio).then(function(_lockRes){
  if (!_lockRes.ok) { _lockAvisoBloqueo(_lockRes, r.folio); return; }
  window._edicionCompletaActiva = true; // ⚠️ evita que ir() limpie el form y pise el folio
  // Cerrar el modal de administrador
  if (typeof cerrarAdminModal === 'function') cerrarAdminModal();
  // Guardar referencia al recibo que se va a editar (por folio, más seguro que por índice)
  _reciboEnEdicionCompleta = r.folio;
  // Respaldo global: ir() → limpiarFormCompleto() anula _reciboEnEdicionCompleta antes de que el form cargue
  window._reciboEdicionBackup = r.folio;
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
    // 4. Navegar al panel de recibos — ir() activa clases, CSS y dispara sync de datos
    if (typeof ir === 'function') {
      ir('nuevo-recibo');
    } else {
      document.querySelectorAll('.panel').forEach(function(p){ p.classList.remove('active'); });
      var pnl = document.getElementById('panel-nuevo-recibo');
      if (pnl) pnl.classList.add('active');
    }
    // 5. Cargar datos DESPUÉS de que ir() termine para evitar que el sync los pise
    var _folioEdicion = r.folio;
    var _letraEdicion = r.letra || (typeof letraVersion==='function'?letraVersion(r):'A') || 'A';
    var _anioBanner   = r.anio_folio;
    setTimeout(function() {
      // Recuperar referencia fresca al recibo por folio+letra (exacto)
      var _recibos2 = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
      var _r2 = _recibos2.find(function(x){ return x.folio === _folioEdicion && (x.letra||(typeof letraVersion==='function'?letraVersion(x):'A')||'A') === _letraEdicion; }) || r;
      // ⚠️ FIX CRÍTICO — misma causa raíz que en editarReciboEnConsulta() (caso
      // real: folio 84A duplicó la fila "Liquidación total" con la fecha de un
      // intento de "Liquidar Total" abandonado). cargarReciboEnFormulario()
      // SOLO limpia y repuebla #pagos-parciales-tbody/#costos-extra-tbody con
      // los datos reales del recibo cuando body YA tiene la clase
      // modo-edicion-completa — hay que agregarla ANTES de llamarla, no
      // después, o esa limpieza nunca corre y cualquier fila que haya quedado
      // de un modo anterior (mismo folio u otro) se guarda tal cual al
      // presionar "Guardar Edición y Regenerar PDF".
      document.body.classList.add('modo-edicion-completa');
      if (typeof cargarReciboEnFormulario === 'function') cargarReciboEnFormulario(_r2);
      // A petición expresa: el texto de conformidad ("Leído que fue...") debe
      // responder siempre a la fecha del encabezado — sin esto se quedaba con
      // la fecha de HOY en vez de la fecha real del recibo que se edita.
      if (typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
      // Fijar folio en display
      var fd = document.getElementById('folio-display');
      if (fd) fd.textContent = folioConLetra(_folioEdicion, _anioBanner, _letraEdicion);
      // Actualizar banner
      var lbl = document.getElementById('edicion-folio-label');
      if (lbl) lbl.textContent = '#' + folioConLetra(_folioEdicion, _anioBanner, _letraEdicion);
      // FIX: misma causa raíz que en editarReciboEnConsulta() — limpiar el
      // estilo inline que deja abrirModoActualizacion() en #actions-actualizacion
      // ("display:flex !important"), que no se quita solo con remover la clase
      // modo-actualizacion, y refrescar el mensaje de estado por si quedó el de
      // una actualización previa de otro folio.
      var _aActOffAdm = document.getElementById('actions-actualizacion');
      if (_aActOffAdm) _aActOffAdm.setAttribute('style', 'display:none !important;');
      if (typeof setStatus === 'function') setStatus('ok', 'Editando folio #' + folioConLetra(_folioEdicion, _anioBanner, _letraEdicion), 'ok');
      if (typeof _ajustarAnchoBannerEdicion === 'function') setTimeout(_ajustarAnchoBannerEdicion, 50);
      // Ocultar botón guardar normal
      var btnG = document.getElementById('btn-guardar');
      if (btnG) btnG.style.display = 'none';
      if (typeof toast === 'function')
        toast('✏️ Edición completa · Folio #' + folioConLetra(_folioEdicion, _anioBanner, _letraEdicion) + ' · Edita y guarda');
    }, 350);
  }
  // Ejecutar con pequeño delay para que el DOM del modal se cierre primero
  setTimeout(_cargarFormEdicion, 300);
  }); // fin _lockIntentarAdquirir(adminAbrirEdicionCompleta)
}

function adminVolverGestion() {
  if (typeof _lockLiberar === 'function') {
    var _fRefVolver = document.getElementById('adminEditFolioRef');
    var _folioVolver = _fRefVolver ? parseInt(_fRefVolver.value) : NaN;
    if (!isNaN(_folioVolver)) _lockLiberar(_folioVolver);
  }
  document.getElementById('adminEditarReciboZone').classList.remove('show');
  document.getElementById('adminGestionRecibosZone').classList.add('show');
}

async function adminGuardarEdicionRecibo() {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var _folioRef2 = document.getElementById('adminEditFolioRef');
  var _folioVal2 = _folioRef2 ? parseInt(_folioRef2.value) : NaN;
  var _letraRef2 = (document.getElementById('adminEditLetraRef')||{}).value || 'A';
  // ⚠️ FIX (caso real: folio 74A, cambios "no surtían efecto"): antes se
  // confiaba en el índice crudo guardado al ABRIR el modal (adminEditIdx).
  // Si entre abrir y guardar el arreglo appData.recibos se reordenaba o se
  // refrescaba (sync en segundo plano, polling de respaldo cada 30s, etc.),
  // ese índice quedaba apuntando a OTRO recibo — el guardado mutaba un
  // registro distinto y el que el usuario veía en pantalla no cambiaba nunca,
  // sin ningún error visible. Ahora se relocaliza SIEMPRE por folio+letra en
  // el momento de guardar (mismo patrón ya usado en guardarEdicionCompleta),
  // con el índice crudo solo como respaldo si por algo esa búsqueda falla.
  var idx = recibos.findIndex(function(x){
    return x.folio === _folioVal2 && !x.esComplemento &&
           (x.letra || (typeof letraVersion==='function' ? letraVersion(x):'A') || 'A') === _letraRef2;
  });
  if (idx < 0) idx = parseInt(document.getElementById('adminEditIdx').value);
  var r = recibos[idx];
  if (!r) { if (typeof toast === 'function') toast('Error: recibo no encontrado','err'); return; }
  var _letraEditGuardar = r.letra || (typeof letraVersion==='function' ? letraVersion(r):'A') || 'A';
  var _esSecGuardar = _letraEditGuardar !== 'A';
  var nuevoNombre   = document.getElementById('adminEditNombre').value.trim();
  var nuevaFecha    = document.getElementById('adminEditFecha').value.trim();
  var nuevaHora     = document.getElementById('adminEditHora').value.trim();
  var nuevoAnticipoInput = parseFloat(document.getElementById('adminEditAnticipo').value) || 0;
  var nuevoTotalInput    = parseFloat(document.getElementById('adminEditTotal').value) || 0;
  var nuevoTramites = document.getElementById('adminEditTramites').value.trim();
  var nuevoResp     = document.getElementById('adminEditResponsable').value;
  var nuevoTipoTramite = (document.getElementById('adminEditTipoTramite')||{}).value || r.tipoTramite || 'normal';
  if (!nuevoNombre) { if (typeof toast === 'function') toast('El nombre no puede estar vacío','err'); return; }
  var btnGuardar = document.querySelector('#adminEditarReciboZone button[onclick="adminGuardarEdicionRecibo()"]');
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = '⏳ Guardando...'; }
  // Aplicar cambios al objeto
  var nuevoTotal, nuevoAnticipo;
  if (!_esSecGuardar) {
    // ── Folio A: el Total y el Anticipo/Abono son los del propio registro ──
    nuevoTotal    = nuevoTotalInput;
    nuevoAnticipo = nuevoAnticipoInput;
    r.total       = nuevoTotal;
    r.anticipo    = String(nuevoAnticipo);
    if (r.conceptos && r.conceptos[0]) {
      r.conceptos[0].concepto = nuevoTramites || r.conceptos[0].concepto;
    }
  } else {
    // ── Folio secundario (B, C, D…): el TOTAL pactado y el ANTICIPO original
    // son del folio A — frozen, nunca se pisan desde aquí (mismo criterio ya
    // aplicado en Edición Completa/guardarEdicionCompleta). El campo
    // "Abono de esta versión" solo ajusta la(s) fila(s) de pagosParciales
    // que pertenecen a ESTA letra. ──
    var _padreG = recibos.find(function(x){
      return x.folio === r.folio && !x.esComplemento &&
             (x.letra || (typeof letraVersion==='function' ? letraVersion(x):'A') || 'A') === 'A';
    }) || r;
    var _totalFrozenG = 0;
    (_padreG.conceptos||[]).forEach(function(c){ _totalFrozenG += parseFloat(c.precio||0) * parseFloat(c.cantidad||1); });
    var _padreAnticipoG = parseFloat(_padreG.anticipo || 0) || 0;
    nuevoTotal = _totalFrozenG;
    r.total    = nuevoTotal;
    r.anticipo = String(_padreAnticipoG); // se relee del padre — autocorrige cualquier valor viejo/corrupto
    var _pp = (r.pagosParciales || []).slice();
    var _idxUltimaEsta = -1;
    for (var _i = _pp.length - 1; _i >= 0; _i--) {
      if ((_pp[_i].folioLetra || 'A') === _letraEditGuardar) { _idxUltimaEsta = _i; break; }
    }
    if (_idxUltimaEsta >= 0) {
      _pp[_idxUltimaEsta] = Object.assign({}, _pp[_idxUltimaEsta], { cantidad: String(nuevoAnticipoInput) });
    } else if (nuevoAnticipoInput > 0) {
      _pp.push({
        concepto: 'Abono', descripcion: 'Ajuste manual (edición rápida admin)',
        cantidad: String(nuevoAnticipoInput), folioLetra: _letraEditGuardar,
        fechaHora: (nuevaFecha||r.fecha_recibo||r.fecha||'') + ' ' + (nuevaHora||r.hora_recibo||r.hora||''),
        locked: true
      });
    }
    r.pagosParciales = _pp;
    var _sumaPPTodasG = _pp.reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0);
    // "nuevoAnticipo" aquí representa el ABONO acumulado total del folio (para
    // el cálculo de saldoPendiente/PDF) — no confundir con el abono de esta
    // versión (nuevoAnticipoInput), que es lo que sí se registra en Contabilidad.
    nuevoAnticipo = _padreAnticipoG + _sumaPPTodasG;
  }
  r.fecha                = nuevaFecha;
  r.fecha_recibo         = nuevaFecha;
  r.hora                 = nuevaHora;
  r.hora_recibo          = nuevaHora;
  r.tramites             = nuevoTramites;
  r.responsable          = nuevoResp;
  r.generadoPor          = nuevoResp;
  r.tipoTramite          = nuevoTipoTramite;
  r.saldoPendiente       = Math.max(0, nuevoTotal - nuevoAnticipo);
  r.totalAbonado         = Math.min(nuevoAnticipo, nuevoTotal);
  r.saldoNuevo           = r.saldoPendiente;
  r.nombre               = nuevoNombre;
  if (r.saldoPendiente <= 0 && typeof _eliminarPendientePorFolio === 'function')
    _eliminarPendientePorFolio(r.folio);
  if (r.clientes && r.clientes.length > 0) r.clientes[0].nombre = nuevoNombre;
  r.nombre_cliente_firma = nuevoNombre;
  r.pdfBase64            = null;
  // Sincronizar arrays en memoria
  if (typeof REC !== 'undefined') { REC.recibos = recibos; REC.folioActual = appData.folioActual; }
  if (typeof appData !== 'undefined') appData.recibos = recibos;
  toast('Guardando en Supabase…');
  try {
    // 1. Guardar JSON actualizado en Drive — BLOQUEANTE
    await actualizarArchivoControl();
    // 2. Borrar PDF de Drive para que se regenere fresco al consultar
    var nombrePDF = r.archivo || ((typeof folioConLetra==='function' ? folioConLetra(r.folio, r.anio_folio, r.letra||'A') : folioFormato(r.folio, r.anio_folio)) + '.pdf'); // nombre corto canónico
    await borrarPDFdeDrive(nombrePDF);
    // 3. Actualizar o crear movimiento en contabilidad
    if (typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
      const folioStr2 = folioFormato(r.folio, r.anio_folio);
      const conceptos2 = r.conceptos || [];
      const c0 = conceptos2[0];
      const txtConc = c0 ? ((c0.concepto||'') + (c0.descripcion ? ' — '+c0.descripcion : '')) : (r.tramites||'');
      const movDesc = txtConc || folioStr2;
      // ⚠️ CRÍTICO: distinguir por folio+letra para no confundir movimiento A con B del mismo folio
      const _letraRecibo = r.letra || (typeof letraVersion === 'function' ? letraVersion(r) : 'A') || 'A';
      const folioStrConLetra = typeof folioConLetra === 'function'
        ? folioConLetra(r.folio, r.anio_folio, _letraRecibo) : folioStr2 + _letraRecibo;
      const idMov = 'M-REC-' + r.folio;
      // Monto del MOVIMIENTO de contabilidad: en folio A es el anticipo/abono
      // completo del registro; en un secundario (B, C, D…) debe ser SOLO el
      // abono de ESTA transacción (nuevoAnticipoInput) — nuevoAnticipo ahí ya
      // es el acumulado de todo el folio (padre + todas las versiones), que
      // duplicaría el monto ya registrado en Contabilidad por versiones previas.
      const _montoMovG = _esSecGuardar ? nuevoAnticipoInput : nuevoAnticipo;
      const idxMov = D.movimientos.findIndex(function(m){
        const _mLetra = m.letra || 'A';
        return (m.id === idMov && _mLetra === _letraRecibo) ||
               (m.id === ('M-REC-NEW-' + r.folio) && _mLetra === _letraRecibo) ||
               (String(m.folio) === String(r.folio) && _mLetra === _letraRecibo);
      });
      if (idxMov >= 0) {
        // Actualizar movimiento existente — preservar letra siempre
        D.movimientos[idxMov].nombre      = r.nombre;
        D.movimientos[idxMov].descripcion = movDesc;
        D.movimientos[idxMov].fecha       = r.fecha || nuevaFecha;
        D.movimientos[idxMov].hora        = r.hora  || nuevaHora;
        D.movimientos[idxMov].monto       = _montoMovG || nuevoTotal;
        D.movimientos[idxMov].responsable = nuevoResp;
        D.movimientos[idxMov].letra       = _letraRecibo;
        D.movimientos[idxMov].estatus     = nuevoAnticipo < nuevoTotal ? 'Anticipo' : 'Liquidado';
        D.movimientos[idxMov].cat         = (nuevoAnticipo < nuevoTotal ? 'Anticipo' : 'Liquidado') + ' · #' + folioStrConLetra;
        _auditoriaRegistrar('editado', D.movimientos[idxMov], {origen:'placas/regenerarRecibo'});
      } else if (_montoMovG > 0 || nuevoTotal > 0) {
        // Crear movimiento si no existía (recibo capturado antes de esta lógica)
        D.movimientos.unshift({
          id:          idMov,
          folioCaja:   typeof generarFolioMovCaja === 'function' ? generarFolioMovCaja() : '',
          fecha:       r.fecha || nuevaFecha,
          hora:        r.hora  || nuevaHora,
          descripcion: movDesc,
          nombre:      r.nombre,
          folio:       r.folio,
          monto:       _montoMovG || nuevoTotal,
          tipo:        'ingreso',
          cat:         'Anticipo · #' + folioStrConLetra,
          estatus:     nuevoAnticipo < nuevoTotal ? 'Anticipo' : 'Liquidado',
          fuente:      'recibo',
          letra:       _letraRecibo,
          responsable: nuevoResp
        });
        _auditoriaRegistrar('creado', D.movimientos[0], {origen:'placas/regenerarRecibo'});
      }
    }
    // 4. Regenerar PDF y subirlo a Supabase Storage — siempre generarPDF (plantilla oficial LEX-MÉXICO)
    try {
      // Recalcular saldos antes de generar el PDF. ⚠️ FIX: en un folio
      // secundario (B, C, D…) r.anticipo SOLO guarda el anticipo original del
      // folio A (frozen) — total-anticipo aquí ignoraría los abonos de
      // versiones anteriores y de esta misma versión (pagosParciales), dando
      // un saldo mayor al real. Ya se calculó arriba correctamente en
      // "nuevoAnticipo"/"r.saldoPendiente" (padre + suma de pagosParciales) —
      // aquí solo se reutiliza, sin recalcular con la fórmula simple.
      const _totalN    = parseFloat(r.total) || 0;
      const _anticipoN = _esSecGuardar ? nuevoAnticipo : (parseFloat(r.anticipo) || 0);
      r.totalAbonado   = Math.min(_anticipoN, _totalN);
      r.saldoNuevo     = Math.max(0, _totalN - _anticipoN);
      r.saldoPendiente = r.saldoNuevo;
      const _qrTxt = 'LEX-MEXICO|Folio:' + folioFormato(r.folio, r.anio_folio) + '|' + r.nombre + '|' + (r.fecha_recibo||r.fecha||'') + ' ' + (r.hora_recibo||r.hora||'');
      const _qrURL = typeof qrToDataURL === 'function' ? await qrToDataURL(_qrTxt) : null;
      const _nombrePDF = (typeof folioConLetra==='function' ? folioConLetra(r.folio, r.anio_folio, r.letra||'A') : folioFormato(r.folio, r.anio_folio)) + '.pdf'; // nombre corto canónico
      var _blob = null;
      if (typeof generarPDF === 'function') {
        const _datos = {
          folio: r.folio, clientes: r.clientes||[{nombre:r.nombre||''}],
          conceptos: r.conceptos||[], tipoTramite: r.tipoTramite || nuevoTipoTramite || 'normal',
          fecha_recibo: r.fecha_recibo||r.fecha, hora_recibo: r.hora_recibo||r.hora,
          anticipo: r.anticipo||'0', responsable: r.responsable||'',
          nombre_cliente_firma: r.nombre_cliente_firma||r.nombre||'',
          tramites: r.tramites||'', clase:r.clase||'', marca:r.marca||'', tipo_veh:r.tipo_veh||'',
          serie:r.serie||'', motor:r.motor||'', personas_veh:r.personas_veh||'', anio:r.anio||'', puertas:r.puertas||'',
          color_veh:r.color_veh||'', transmision:r.transmision||'',
          cilindros:r.cilindros||'', placa:r.placa||'', placaEstado:r.placaEstado||'',
          ultima_tenencia:r.ultima_tenencia||'', origen:r.origen||'', combustible:r.combustible||'',
          copias:r.copias||[], tipo_doc:r.tipo_doc||'copia', costosExtra:r.costosExtra||[],
          pagosParciales:r.pagosParciales||[], fechasImpresion:r.fechasImpresion||[],
          totalGeneral: r.total||0, totalAbonado: r.totalAbonado, saldoNuevo: r.saldoNuevo,
          saldoPendiente: r.saldoPendiente, letra: r.letra||'A', anio_folio: r.anio_folio,
          saldoRestanteConcepto: r.saldoRestanteConcepto||'', saldoRestanteDescripcion: r.saldoRestanteDescripcion||''
        };
        const _doc = await generarPDF(_datos, r.folio, _qrURL);
        if (_doc && typeof _doc.output === 'function') _blob = _doc.output('blob');
      }
      if (_blob) {
        r.archivo = _nombrePDF;
        // Cachear pdfBase64 en sesión para que Contabilidad no tenga que ir a Storage
        const _rdAdmin = new FileReader();
        _rdAdmin.onload = () => { r.pdfBase64 = _rdAdmin.result; };
        _rdAdmin.readAsDataURL(_blob);
        // Subir a Storage (no bloqueante)
        subirPDFaDrive(_blob, _nombrePDF).catch(e => console.warn('[Admin] PDF upload:', e));
        console.log('[Admin] PDF regenerado y subido:', _nombrePDF);
      }
    } catch(_ePDF) {
      console.warn('[Admin] PDF no regenerado (se regenerará al consultar):', _ePDF.message);
    }
    // 5. Subir PDF a R2 también
    if (_blob && typeof window.subirR2 === 'function' && window.SB_DESPACHO_ID) {
      try {
        var _r2PDFPath = window.SB_DESPACHO_ID + '/recibos/' + _nombrePDF;
        await window.subirR2(_r2PDFPath, _blob, 'application/pdf', 'lex-recibos-pdf').catch(function(e){ console.warn('[Admin] R2 PDF:', e); });
      } catch(_eR2PDF){ console.warn('[Admin] R2 PDF no subido:', _eR2PDF); }
    }
    // 6. Sincronizar pre-recibos a R2
    if (typeof _prGuardar === 'function') { try { _prGuardar(); } catch(e){} }
    // 7. Refrescar vistas
    if (typeof renderRec === 'function') renderRec();
    if (typeof renderHistorial === 'function') renderHistorial();
    if (typeof renderContab === 'function') renderContab();
    if (typeof renderCaja === 'function') renderCaja();
    if (typeof save === 'function') save();
    // Sincronizar a Supabase
    if (typeof syncEstadoSupabaseDebounced === 'function') setTimeout(syncEstadoSupabaseDebounced, 200);
    var folio = folioFormato(r.folio||0);
    toast('✅ Recibo #' + folio + ' actualizado y PDF regenerado.');
    adminVolverGestion();
    adminRenderRecibos(document.getElementById('adminBuscarRecibo').value||'');
  } catch(e) {
    console.error('adminGuardarEdicionRecibo error:', e);
    toast('❌ Error al guardar: ' + e.message, 'err');
  } finally {
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = '💾 Guardar Cambios'; }
  }
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

function _fichaEsAdmin() {
  return !!(typeof empleadoActual === 'undefined' || !empleadoActual ||
    empleadoActual.email.toLowerCase() === (typeof ADMIN_EMAIL !== 'undefined' ? ADMIN_EMAIL.toLowerCase() : 'lexmexico423@gmail.com'));
}

function _fichaCargoRow(c, idx, recibo, folio, anio) {
  var fmt = function(v){ return parseFloat(v||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var esAdmin = _fichaEsAdmin();
  var row = document.createElement('div');
  row.id = 'fcrow-'+idx;
  row.style.cssText = 'border:0.5px solid #85B7EB;border-radius:4px;background:#f0f7ff;margin-bottom:4px;overflow:hidden;';

  var adminBtns = esAdmin && !window._fichaLiquidado
    ? '<span id="fcbtns-'+idx+'" style="display:none;gap:3px;align-items:center;flex-shrink:0;">'
      +'<button onclick="fichaEditarCargo('+idx+')" title="Editar" style="background:none;border:none;cursor:pointer;font-size:13px;padding:0 2px;">✏️</button>'
      +'<button onclick="fichaEliminarCargo('+idx+')" title="Eliminar" style="background:none;border:none;cursor:pointer;color:#a32d2d;font-size:14px;padding:0 2px;">✕</button>'
      +'</span>'
      +'<button onclick="fichaToggleCargoBtns('+idx+')" style="background:none;border:none;cursor:pointer;color:#aaa;font-size:11px;padding:0 3px;transition:color 0.15s;flex-shrink:0;" id="fctri-'+idx+'" onmouseover="this.style.color=\'#4a6ea8\'" onmouseout="this.style.color=\'#aaa\'">◀</button>'
    : '';

  row.innerHTML = '<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;font-size:0.72rem;">'
    +'<div style="flex:1;">'
    +'<span style="color:#0C447C;font-weight:500;">' + escHTML(c.concepto||'') + '</span>'
    + (c.descripcion ? '<span style="color:#7a6840;margin-left:6px;font-size:0.68rem;">' + escHTML(c.descripcion) + '</span>' : '')
    + '<span style="color:#7a6840;margin-left:8px;font-size:0.65rem;">' + (c.fecha||'') + '</span>'
    +'</div>'
    +'<span style="color:#0C447C;font-family:\'DM Mono\',monospace;font-weight:700;white-space:nowrap;flex-shrink:0;">$' + fmt(c.monto) + '</span>'
    + adminBtns
    +'</div>'
    // Form edición inline (oculto)
    +(esAdmin && !window._fichaLiquidado
      ? '<div id="fcedit-'+idx+'" style="display:none;padding:8px 10px;border-top:0.5px solid #85B7EB;background:#e6f7ff;">'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'
        +'<input id="fcedit-concepto-'+idx+'" type="text" value="'+escHTML(c.concepto||'')+'" placeholder="Concepto" style="flex:2;min-width:100px;font-size:0.76rem;padding:4px 7px;border:1px solid #85B7EB;border-radius:4px;background:#fff;">'
        +'<input id="fcedit-desc-'+idx+'" type="text" value="'+escHTML(c.descripcion||'')+'" placeholder="Descripción" style="flex:2;min-width:80px;font-size:0.76rem;padding:4px 7px;border:1px solid #85B7EB;border-radius:4px;background:#fff;">'
        +'<input id="fcedit-monto-'+idx+'" type="number" value="'+parseFloat(c.monto||0)+'" style="width:80px;font-size:0.76rem;padding:4px 7px;border:1px solid #85B7EB;border-radius:4px;background:#fff;text-align:right;">'
        +'<button onclick="fichaGuardarEdicionCargo('+idx+')" style="padding:4px 10px;border-radius:4px;border:1px solid #185FA5;background:#B5D4F4;color:#042C53;font-size:0.72rem;font-weight:700;cursor:pointer;">✓</button>'
        +'<button onclick="fichaToggleCargoBtns('+idx+')" style="padding:4px 10px;border-radius:4px;border:1px solid #d4b870;background:#f5f0e0;color:#7a6840;font-size:0.72rem;cursor:pointer;">✕</button>'
        +'</div></div>'
      : '');
  return row;
}

function fichaEditarCargo(idx) {
  if (!_fichaEsAdmin()) return;
  var edit = document.getElementById('fcedit-'+idx);
  if (edit) edit.style.display = edit.style.display === 'none' ? 'block' : 'none';
}

function fichaGuardarEdicionCargo(idx) {
  if (!_fichaEsAdmin()) return;
  var recibo = window._fichaReciboActual;
  if (!recibo || !Array.isArray(recibo._cargosInternos)) return;
  var c = recibo._cargosInternos[idx];
  if (!c) return;
  var nuevoConcepto = (document.getElementById('fcedit-concepto-'+idx)||{}).value || '';
  var nuevoDesc     = (document.getElementById('fcedit-desc-'+idx)||{}).value || '';
  var nuevoMonto    = parseFloat((document.getElementById('fcedit-monto-'+idx)||{}).value) || 0;
  if (!nuevoConcepto.trim()) { if(typeof toast==='function') toast('El concepto no puede estar vacío','err'); return; }
  if (nuevoMonto <= 0) { if(typeof toast==='function') toast('El monto debe ser mayor a $0','err'); return; }
  if (!confirm('¿Guardar cambios en este cargo?')) return;
  c.concepto    = nuevoConcepto.toUpperCase().trim();
  c.descripcion = nuevoDesc;
  c.monto       = nuevoMonto;
  var folio = recibo.folio;
  var anio  = recibo.anio_folio || new Date().getFullYear();
  // Re-render inmediato desde memoria (autoritativo) + recálculo de saldo
  _fichaRenderCargosLista(recibo, folio, anio);
  if(typeof toast==='function') toast('Guardando cambio...', 'loading');
  // Persistir en R2 (await), Supabase (recibo completo vía save) y local (dentro de R2Guardar)
  Promise.resolve(_cargoR2Guardar(folio, anio, recibo._cargosInternos))
    .catch(function(e){ console.warn('[Cargo] R2 editar:', e); })
    .then(function(){
      try { if(typeof save==='function') save(); } catch(e) {}
      _fichaEnviarSenalSync('cargo-editado', folio);
      if(typeof toast==='function') toast('✅ Cargo actualizado y sincronizado', 'ok');
    });
}

function fichaEliminarCargo(idx) {
  if (!_fichaEsAdmin()) return;
  var recibo = window._fichaReciboActual;
  if (!recibo || !Array.isArray(recibo._cargosInternos)) return;
  var c = recibo._cargosInternos[idx];
  if (!c) return;
  if (!confirm('¿Eliminar cargo "' + c.concepto + '" por $' + parseFloat(c.monto||0).toFixed(2) + '?')) return;
  recibo._cargosInternos.splice(idx, 1);
  var folio = recibo.folio;
  var anio  = recibo.anio_folio || new Date().getFullYear();
  // Re-render inmediato desde memoria (autoritativo) + recálculo de saldo
  _fichaRenderCargosLista(recibo, folio, anio);
  if(typeof toast==='function') toast('Eliminando...', 'loading');
  // Persistir borrado en R2 (await), Supabase (recibo completo vía save) y local
  Promise.resolve(_cargoR2Guardar(folio, anio, recibo._cargosInternos))
    .catch(function(e){ console.warn('[Cargo] R2 eliminar:', e); })
    .then(function(){
      try { if(typeof save==='function') save(); } catch(e) {}
      _fichaEnviarSenalSync('cargo-eliminado', folio);
      if(typeof toast==='function') toast('✅ Cargo eliminado y sincronizado', 'ok');
    });
}

function cerrarExpDigital() {
  var modal = document.getElementById('modal-exp-digital-placas');
  if (modal) modal.style.display = 'none';
  // La Ficha del Folio se cerró explícitamente antes de abrir este modal
  // (ver botón "Exp. Digital" en la ficha) — hay que reabrirla al cerrar,
  // igual que ya hace cerrarContabPDF, o el usuario se queda sin la ficha.
  if (window._fichaAbiertaAntes) {
    window._fichaAbiertaAntes = false;
    setTimeout(function(){ if (reciboEnConsulta) abrirFichaFolio(); }, 400);
  }
}

function _juRenderEtapas(j, idx){
  // ELIMINADA a pedido del usuario: esta barra duplicaba el Flujo del
  // Procedimiento (panel completo, con más detalle) que ya cumple esa
  // función. Se deja la función como no-op (en vez de borrar sus llamadas
  // dispersas) para no tocar cada punto que la invoca; si el contenedor
  // llegó a existir de una versión anterior, se retira del DOM.
  const cont = document.getElementById('mexp-etapas');
  if(cont) cont.remove();
}

async function _juExtraerDatosAcuerdo(texto){
  if(typeof _iaLlamar !== 'function') throw new Error('El motor de IA no está disponible');
  // Si Cloudflare está configurado, usamos su modelo de CONTEXTO LARGO
  // (Mistral Small 3.1, 128K tokens) para leer el acuerdo casi completo en
  // vez de recortarlo a 6,000 caracteres — más preciso cuando la orden o el
  // plazo real aparece más adelante en el documento.
  const _usarCtxLargo = !!(typeof _cfaiGetAccountId === 'function' && _cfaiGetAccountId() && _cfaiGetToken());
  const recorte = String(texto || '').slice(0, _usarCtxLargo ? 60000 : 6000);
  const catalogo = _juCatalogoPlazos().map(p => p.nombre).join(' | ');
  const prompt =
    'Eres asistente de un despacho jurídico mexicano. Te doy el texto de un acuerdo o notificación judicial.\n' +
    'Responde ÚNICAMENTE con un JSON válido, sin markdown ni explicaciones, con esta forma exacta:\n' +
    '{\n' +
    '  "tipoAcuerdo": "descripción corta de qué ordena el acuerdo",\n' +
    '  "fechaAcuerdo": "AAAA-MM-DD o vacío si no aparece",\n' +
    '  "generaTermino": true o false,\n' +
    '  "actuacionRequerida": "qué tiene que hacer el abogado, en pocas palabras",\n' +
    '  "dias": número de días del plazo o 0 si no aplica,\n' +
    '  "habiles": true si son días hábiles, false si son naturales,\n' +
    '  "resumen": "resumen del acuerdo en una o dos frases",\n' +
    '  "confianza": "alta" | "media" | "baja"\n' +
    '}\n' +
    'Si el plazo corresponde a alguno de estos, usa ese nombre en actuacionRequerida: ' + catalogo + '.\n' +
    'Si no estás seguro de un dato, déjalo vacío o en 0 y pon confianza "baja". No inventes fechas.\n\n' +
    'TEXTO DEL ACUERDO:\n' + recorte;
  let resp;
  if (_usarCtxLargo) {
    try { resp = await _cfaiLlamarContextoLargo(prompt, 700, 0.1, 'plazos'); }
    catch(e) { console.warn('[Juicios IA] Contexto largo falló, usando Groq:', e.message); resp = await _iaLlamar(prompt, 700, 0.1, 'plazos'); }
  } else {
    resp = await _iaLlamar(prompt, 700, 0.1, 'plazos');
  }
  let limpio = String(resp || '').trim()
    .replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = limpio.indexOf('{'), f = limpio.lastIndexOf('}');
  if(i >= 0 && f > i) limpio = limpio.slice(i, f + 1);
  try{ return JSON.parse(limpio); }
  catch(e){ console.warn('[Juicios IA] respuesta no interpretable:', resp); return null; }
}

function _leyesInicializarBtnAdmin() {
  const btn = document.getElementById('btn-cargar-leyes');
  if (!btn) return;
  btn.style.display = esAdministrador() ? 'inline-flex' : 'none';
}

async function abrirModalCargarLeyes() {
  const modal = document.getElementById('modal-cargar-leyes');
  if (!modal) return;
  modal.style.display = 'flex';
  // Mostrar caché inmediato
  _leyesRenderAdmin(getLeyesDespacho());
  // Refrescar Drive en background
  const statusEl = document.getElementById('leyes-drive-status');
  if (statusEl) statusEl.textContent = 'sincronizando con Drive…';
  const driveLista = await _leyesListarDrive();
  if (driveLista.length || !getLeyesDespacho().length) {
    // Enriquecer con sha256 local
    const local = getLeyesDespacho();
    driveLista.forEach(d => {
      const m = local.find(l => l.driveFileId === d.driveFileId);
      if (m) d.sha256 = m.sha256 || '';
    });
    setLeyesDespacho(driveLista);
    _leyesRenderAdmin(driveLista);
  }
  if (statusEl) statusEl.textContent = driveLista.length ? `${driveLista.length} en Drive ✓` : 'carpeta vacía';
}

function _leyesRenderAdmin(leyes) {
  const el = document.getElementById('leyes-admin-lista');
  const tot = document.getElementById('leyes-total-txt');
  if (!el) return;
  if (tot) tot.textContent = leyes.length + ' ' + (leyes.length === 1 ? 'ley' : 'leyes');
  if (!leyes.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:0.72rem;text-align:center;padding:24px;">Sin leyes cargadas.<br>Arrastra un PDF para comenzar.</div>';
    return;
  }
  // Uso por juicio
  const uso = {};
  (D.juicios||[]).forEach(j => { (j.leyesActivas||[]).forEach(n => { uso[n] = (uso[n]||0) + 1; }); });

  el.innerHTML = leyes.map((ley, idx) => {
    const usoN = uso[ley.nombre] || 0;
    const usoBadge = usoN ? `<span style="font-size:0.58rem;padding:1px 6px;border-radius:10px;background:var(--azul-l);color:var(--azul);">Usado en ${usoN} juicio${usoN>1?'s':''}</span>` : '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid var(--border-l);border-radius:var(--radius-sm);margin-bottom:6px;background:var(--surface);">
      <span style="font-size:0.9rem;flex-shrink:0;">📚</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.73rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHTML(ley.nombre)}">${escHTML(ley.nombre)}</div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:2px;flex-wrap:wrap;">${usoBadge}${ley.fecha ? `<span style="font-size:0.58rem;color:var(--muted);">${ley.fecha}</span>` : ''}</div>
      </div>
      <button onclick="event.stopPropagation();_leyesVerPDF('${ley.driveFileId}','${encodeURIComponent(ley.archivo||ley.nombre)}')" title="Ver PDF" style="font-size:0.9rem;background:none;border:none;cursor:pointer;color:var(--muted);padding:3px 5px;flex-shrink:0;">👁</button>
      <button onclick="event.stopPropagation();_leyesEliminar(${idx})" title="Eliminar" style="font-size:0.85rem;background:none;border:none;cursor:pointer;color:var(--rojo);padding:3px 5px;flex-shrink:0;">🗑</button>
    </div>`;
  }).join('');
}

function _flujoInicializarBtn() {
  const btn = document.getElementById('btn-generar-flujo');
  if (btn) btn.style.display = esAdministrador() ? 'inline-flex' : 'none';
  // Si ya hay flujo guardado, mostrarlo; si no, estado vacío
  const j = D.juicios && D.juicios[_mexpIdx];
  const lista = document.getElementById('mexp-flujo-lista');
  if (j && j.flujoProcedimiento && j.flujoProcedimiento.length) {
    _flujoRender(j.flujoProcedimiento, j.flujoLey);
  } else if (lista) {
    const esAdmin = typeof esAdministrador === 'function' && esAdministrador();
    lista.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:0.74rem;padding:34px 16px;line-height:1.7;">⚖️ Aún no se ha generado el flujo del procedimiento.<br>' +
      (esAdmin ? 'Pulsa <strong>⚙ Generar Flujo</strong> y elige la ley que rige este juicio.' : 'El administrador puede generarlo desde aquí.') + '</div>';
  }
}

async function _escritoEnviar() {
  const inp = document.getElementById('escrito-chat-input');
  const msgsEl = document.getElementById('escrito-chat-msgs');
  if (!inp || !msgsEl) return;
  const texto = inp.value.trim();
  if (!texto) return;
  inp.value = '';

  // Burbuja usuario
  msgsEl.innerHTML += `<div style="align-self:flex-end;background:var(--gold-bg);border:1px solid var(--border-l);border-radius:8px 8px 2px 8px;padding:9px 13px;max-width:85%;font-size:0.76rem;color:var(--ink);line-height:1.5;">${escHTML(texto)}</div>`;

  // Burbuja loading
  const loadId = 'escrito-load-' + Date.now();
  msgsEl.innerHTML += `<div id="${loadId}" style="background:var(--azul-l);border:1px solid rgba(26,74,138,0.15);border-radius:8px 8px 8px 2px;padding:10px 14px;max-width:88%;font-size:0.76rem;color:var(--muted);display:flex;align-items:center;gap:8px;"><span style="display:inline-block;width:10px;height:10px;border:2px solid var(--azul);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;"></span>Redactando…</div>`;
  msgsEl.scrollTop = msgsEl.scrollHeight;

  _escritoChatHistorial.push({ role: 'user', content: texto });

  const j = D.juicios && D.juicios[_mexpIdx];
  const leyesActivas = j ? (j.leyesActivas || []) : [];
  const cliente = j ? (j.cliente || j.nombre || 'el cliente') : 'el cliente';
  const tipoJuicio = j ? (j.tipo || 'juicio civil') : 'juicio civil';

  const systemPrompt = `Eres un abogado litigante mexicano experto con 20 años de experiencia. Redactas escritos judiciales formales, claros y conforme a derecho.
Caso actual: ${tipoJuicio} de ${cliente}.
Leyes aplicables: ${leyesActivas.join(', ') || 'Código de Procedimientos Civiles de Oaxaca'}.
Contexto del acuerdo: ${_escritoChatAcuerdo ? (_escritoChatAcuerdo.resumen || _escritoChatAcuerdo.descripcion || '') : ''}.
Cuando redactes un escrito, usa formato jurídico mexicano: encabezado con datos del juicio, proemio, cuerpo con numerales, petición y cierre formal. Si te piden algo distinto a redactar, responde como asistente jurídico.`;

  const mensajes = [
    { role: 'user', content: systemPrompt + '\n\n---\n\n' + (_escritoChatHistorial[0]?.content || texto) },
    ..._escritoChatHistorial.slice(1)
  ];

  try {
    // _iaLlamar (Groq → Cloudflare) recibe un solo prompt de texto, no una
    // conversación por turnos — se aplana el historial en un solo bloque.
    const promptCompleto = mensajes.map(m => (m.role === 'assistant' ? 'ASISTENTE: ' : 'ABOGADO: ') + m.content).join('\n\n');
    const respuesta = (await _iaLlamar(promptCompleto, 2048, 0.4, 'redaccion')).trim();
    _escritoChatHistorial.push({ role: 'assistant', content: respuesta });

    const loadEl = document.getElementById(loadId);
    if (loadEl) loadEl.outerHTML = `<div style="background:var(--azul-l,#eef3ff);border:1px solid rgba(26,74,138,0.15);border-radius:8px 8px 8px 2px;padding:10px 14px;max-width:88%;font-size:0.76rem;line-height:1.75;color:var(--ink);white-space:pre-wrap;font-family:'JetBrains Mono',monospace;"><div style="font-size:0.55rem;color:var(--azul);font-weight:700;margin-bottom:6px;letter-spacing:0.1em;">✦ IA · ESCRITO GENERADO</div>${escHTML(respuesta)}</div>`;
  } catch(e) {
    const loadEl = document.getElementById(loadId);
    if (loadEl) loadEl.outerHTML = `<div style="background:var(--rojo-l);border-radius:8px;padding:10px 14px;font-size:0.72rem;color:var(--rojo);">⚠ Error: ${e.message}</div>`;
  }
  msgsEl.scrollTop = msgsEl.scrollHeight;
}
