/* LEX-MÉXICO · Módulo contabilidad
 * Funciones extraídas sin modificar su contenido.
 */

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
        // ⚠️ FIX (mismo caso que en la actualización/abono — folio 115B): "datos"
        // trae fecha_recibo/hora_recibo copiados del recibo QUE SE CANCELA (la
        // versión anterior), no la fecha/hora real de ESTA cancelación. Se
        // sobreescriben aquí explícitamente con "ahora"/"horaAhora".
        fecha: ahora,
        fecha_recibo: ahora,
        hora: horaAhora,
        hora_recibo: horaAhora,
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

function delMov(id){
  const mov = (D.movimientos||[]).find(function(m){ return m && m.id === id; });
  if(!mov){ toast('Movimiento no encontrado','err'); return; }
  if(esPeriodoCerrado(mov.fecha, mov.hora || '00:00')){
    toast(_msgPeriodoCerrado(), 'err'); return;
  }
  // Verificar si el recibo vinculado existe
  const tieneRecibo = mov.fuente === 'recibo' && mov.folio != null
    ? (appData.recibos||[]).some(function(r){ return r && r.folio == mov.folio; })
    : true;
  const esHuerfano = mov.fuente === 'recibo' && !tieneRecibo;
  const _desc = (mov.descripcion||'').substring(0,60);
  const _monto = (mov.tipo==='ingreso'?'+':'−') + '$' + fmt(mov.monto);
  const _msg = esHuerfano
    ? '⚠️ Este movimiento no tiene recibo vinculado.\n\n' + _desc + '\n' + _monto + '\n\n¿Eliminar movimiento huérfano?'
    : '¿Eliminar este movimiento de contabilidad?\n\n' + _desc + '\n' + _monto + '\n\n⚠️ No se puede deshacer.';
  pedirAutorizacion().then(function(auth){
    if(auth === null) return;
    if(!confirm(_msg)) return;
    _filtrarMovsAuditado(function(m){ return m && m.id !== id; }, 'delMov', { autorizo: auth || '' });
    if(typeof save === 'function') save();
    if(typeof renderCaja   === 'function') renderCaja();
    if(typeof renderContab === 'function') renderContab();
    syncEstadoSupabase().catch(function(e){ syncEstadoSupabaseDebounced().catch(function(){}); });
    toast('✅ Movimiento eliminado','ok');
  });
}

function _movimientosDeCaja() {
  return (D.movimientos || []).filter(m => m && !m.borrado && m.fuente !== 'corte');
}

function _foliosYaEnCaja(movsCaja) {
  const s = new Set();
  movsCaja.forEach(m => {
    // Solo excluir el sintético si el movimiento de caja tiene monto real > 0
    // Un recibo sin anticipo (monto=0) NO debe marcarse como "ya en caja"
    // porque si se excluye desaparece de contabilidad dejando huérfanos a sus sub-folios
    if (m.fuente === 'recibo' && (parseFloat(m.monto) || 0) > 0) {
      if (m.folio != null) s.add(Number(m.folio));
      const match = (m.id || '').match(/(?:NEW|COMP|REC|LIQ|RECR)-(\d+)/);
      if (match) s.add(Number(match[1]));
    }
  });
  return s;
}

function _reciboAMovSintetico(r) {
  const anticipo     = parseFloat(r.anticipo || 0);
  const totalAbonado = parseFloat(r.totalAbonado || 0);
  const totalRec     = parseFloat(r.total || 0);
  // BUG FIX: monto = SOLO el anticipo inicial del recibo (lo cobrado al momento de emitirlo).
  // NO usar totalAbonado como fallback — los abonos posteriores tienen sus propios
  // movimientos reales en D.movimientos y suprimen este sintético vía _foliosYaEnCaja.
  // Usar totalAbonado aquí inflaba el monto del sintético e inventaba un "Anticipo"/$X
  // para recibos emitidos sin anticipo ($0) que luego recibieron abonos.
  const monto = anticipo > 0 ? anticipo : 0;
  // Usar parseFloat + <= 0 para evitar fallo cuando saldoPendiente viene como string "0"
  const _esJuicioAbChip = window._abiertoSinCosto(r);
  const liq   = !_esJuicioAbChip && parseFloat(r.saldoPendiente || 0) <= 0 && totalRec > 0 && (anticipo > 0 || totalAbonado > 0);
  // "Sin Anticipo": recibo con total>0 pero anticipo=0 al momento de emitirlo
  const sinAnticipo = anticipo === 0 && totalRec > 0 && !liq;
  const fechaRec = (r.fecha && /^\d{4}-\d{2}-\d{2}/.test(r.fecha))
    ? r.fecha.substring(0, 10) : (r.fecha || '—');
  const _letraR = r.letra || (typeof letraVersion === 'function' ? letraVersion(r) : 'A') || 'A';
  const _folioStr = typeof folioConLetra === 'function'
    ? folioConLetra(r.folio, r.anio_folio, _letraR)
    : String(r.folio).padStart(4,'0') + _letraR;
  const _estatus = liq ? 'Liquidado' : (anticipo > 0 ? 'Anticipo' : (sinAnticipo ? 'Sin Anticipo' : 'Pendiente'));
  // ── Detectar folio con MÁS DE UNA versión real cuando ninguna tiene
  // movimiento propio en D.movimientos (por eso llegamos a fabricar este
  // sintético). "r" aquí es la versión con la letra MÁS ALTA (ver
  // _recibosMap). El monto de este sintético usa r.anticipo, que por
  // diseño de adminGuardarEdicionRecibo se CONGELA con el valor ORIGINAL
  // del folio A para toda versión secundaria — mientras que la letra y la
  // fecha SÍ son las de "r" (la más reciente). Cuando hay 2+ versiones
  // reales, esa combinación mezcla el monto de un evento (A) con la
  // letra/fecha de otro (B, C…) y puede leerse como un dato confiable sin
  // serlo (caso real: folio 76 mostrando "76B" con el anticipo de 76A).
  // Se marca la fila para que esto NUNCA vuelva a pasar desapercibido.
  const _arr1v = (typeof REC !== 'undefined' ? REC.recibos : []) || [];
  const _arr2v = (typeof appData !== 'undefined' ? appData.recibos : []) || [];
  const _letrasFolio = new Set();
  [..._arr1v, ..._arr2v].forEach(x => {
    if (x && !x.esComplemento && Number(x.folio) === Number(r.folio)) {
      _letrasFolio.add(x.letra || (typeof letraVersion === 'function' ? letraVersion(x) : 'A') || 'A');
    }
  });
  const _esAproximado = _letrasFolio.size > 1;
  const _descBase = (function(){
      const conc = r.conceptos && r.conceptos[0] ? r.conceptos[0].concepto || '' : '';
      const desc = r.conceptos && r.conceptos[0] ? r.conceptos[0].descripcion || '' : '';
      return conc + (desc ? ' — ' + desc : '');
    })();
  return {
    id:    'R-' + r.folio, folio: r.folio, nombre: r.nombre || '',
    fecha: fechaRec, hora: r.hora || r.hora_recibo || '00:00',
    descripcion: _esAproximado ? ('⚠ VERIFICAR — ' + _descBase) : _descBase,
    monto, total: totalRec,
    saldoPendiente: r.saldoPendiente || 0,
    tipo: 'ingreso',
    estatus: _estatus,
    cat: _estatus + ' · #' + _folioStr,
    fuente: 'recibo',
    letra: _letraR,
    responsable: r.generadoPor || r.responsable || '—',
    _aproximado: _esAproximado
  };
}

function confirmarCambioContable(opciones) {
  // opciones: { titulo, descripcion, esError, mensajeError, onAplicar, onCancelar }
  return new Promise(function(resolve) {
    var id = '__modal_cambio_contable';
    var prev = document.getElementById(id);
    if (prev) prev.remove();
    var esError = !!opciones.esError;
    var errorHtml = esError
      ? '<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:10px 14px;margin:10px 0 4px;font-size:0.88rem;color:#7c5800;">'
        + '<strong>⚠ Error detectado:</strong> ' + (opciones.mensajeError || opciones.descripcion)
        + '<br><span style="font-size:0.82rem;color:#555;margin-top:4px;display:block;">Puedes resolverlo aquí mismo o pedirle ayuda a Claude para solucionarlo.</span>'
        + '</div>'
      : '';
    var overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:10px;padding:28px 30px;max-width:480px;width:92%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.28);font-family:inherit;">'
      + '<h3 style="margin:0 0 10px;font-size:1.05rem;color:#2c3e50;flex-shrink:0;">📋 ' + escHTML(opciones.titulo || 'Confirmación de cambio contable') + '</h3>'
      + '<div style="overflow-y:auto;flex:1;margin-bottom:4px;padding-right:4px;">'
      + '<p style="margin:0 0 8px;font-size:0.92rem;color:#444;line-height:1.5;">' + escHTML(opciones.descripcion||'') + '</p>'
      + errorHtml
      + '</div>'
      + '<div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end;flex-shrink:0;">'
      + '<button id="__cc_cancelar" style="padding:8px 18px;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;cursor:pointer;font-size:0.9rem;">Cancelar / Revisar manualmente</button>'
      + '<button id="__cc_aplicar" style="padding:8px 18px;border:none;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer;font-size:0.9rem;font-weight:600;">Aplicar cambio</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#__cc_aplicar').addEventListener('click', function() {
      overlay.remove();
      if (typeof opciones.onAplicar === 'function') opciones.onAplicar();
      resolve(true);
    });
    overlay.querySelector('#__cc_cancelar').addEventListener('click', function() {
      overlay.remove();
      if (typeof opciones.onCancelar === 'function') opciones.onCancelar();
      resolve(false);
    });
  });
}

function _corregirMovimientosSinAnticipo() {
  var movs    = (typeof D !== 'undefined' && D.movimientos) ? D.movimientos : [];
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var errores = [];
  movs.forEach(function(m) {
    if (m.fuente !== 'recibo' || !(m.monto > 0)) return;
    // No tocar registros de períodos cerrados por corte de caja
    if (typeof esPeriodoCerrado === 'function' && esPeriodoCerrado(m.fecha, m.hora || '00:00')) return;

    var letraMov = (m.letra || 'A').toUpperCase();

    var recOrig = recibos.find(function(r) {
      return r.folio === m.folio && !r.esComplemento && (r.letra || 'A').toUpperCase() === letraMov;
    });
    if (!recOrig) return;
    // Si el recibo correspondiente sí tiene anticipo registrado, el movimiento es correcto
    if (parseFloat(recOrig.anticipo || 0) !== 0) return;

    // ── LÓGICA CLAVE: Flujo "Sin Anticipo → Abono posterior" ──────────────────
    // Escenario válido (NO es error):
    //   El cliente no dejó anticipo al inicio → se generó 55A con anticipo=$0.
    //   Después vino a pagar → se generó 55B (abono) con el monto pagado.
    //   El movimiento 55B queda registrado con letra='B' y monto>0, lo cual es CORRECTO.
    //   Pero si el movimiento quedó sin letra (letra='A' por defecto) y hay recibos B/C/D
    //   del mismo folio que SÍ tienen anticipo o totalAbonado>0 (los pagos reales),
    //   entonces ese movimiento "A" con monto>0 es un registro histórico incorrecto
    //   SOLO si NO existe ya un movimiento separado para la letra B que cubre ese pago.
    //
    // Regla: si existe al menos un recibo hermano (misma folio, letra > 'A') con
    //        anticipo>0 o totalAbonado>0, significa que el pago real ya está
    //        capturado en ese recibo B/C/D y su propio movimiento. El movimiento
    //        del recibo A con monto>0 SÍ es incorrecto y debe corregirse a $0.
    //        PERO: si el movimiento ya tiene letra B/C/D asignada y su recibo tiene
    //        anticipo>0, ya fue descartado arriba (parseFloat !== 0). Solo llegamos
    //        aquí cuando el movimiento tiene letra='A' (o sin letra) y hay abonos posteriores.
    //
    // Excepción: si existe un movimiento SEPARADO con letra>A para este mismo folio
    //            (el abono B ya tiene su propio movimiento registrado), entonces el
    //            movimiento A con monto>0 es claramente un duplicado/error y SÍ debe
    //            corregirse a $0.
    //            Si NO existe movimiento separado para letra>A, el movimiento A puede
    //            ser el único registro del pago (abono guardado en el mov A por error
    //            de versión sin letra). En ese caso NO corregir para no borrar el ingreso.

    // ¿Existen recibos hermanos (abonos) del mismo folio con letra > 'A'?
    var tieneReciboAbonoConLetra = recibos.some(function(r) {
      return r.folio === m.folio && !r.esComplemento &&
             (r.letra || 'A').toUpperCase() > 'A' &&
             (parseFloat(r.anticipo || 0) > 0 || parseFloat(r.totalAbonado || 0) > 0);
    });

    if (tieneReciboAbonoConLetra) {
      // El pago ya está en el recibo B/C/D. ¿Tiene ese recibo su propio movimiento en caja?
      var tieneMovAbono = movs.some(function(mv) {
        return mv.fuente === 'recibo' && mv.folio === m.folio &&
               (mv.letra || 'A').toUpperCase() > 'A' && mv.monto > 0 && mv !== m;
      });
      if (tieneMovAbono) {
        // El abono B ya tiene su propio movimiento → el movimiento A con monto>0 es duplicado/error → corregir
        errores.push({ mov: m, rec: recOrig });
      }
      // Si NO tiene movimiento separado B → el mov A es el único registro del pago → NO tocar
      return;
    }

    // El recibo A tiene anticipo=0 y no existen abonos B/C/D con pago → movimiento con monto>0 es un error real
    errores.push({ mov: m, rec: recOrig });
  });
  return errores;
}

function getAllMovs() {
  const movsCaja  = _movimientosDeCaja();
  const excluidos = _foliosExcluidos();
  const yaEnCaja  = _foliosYaEnCaja(movsCaja);
  // ── FIX duplicados $0 ────────────────────────────────────────────────
  // Al generar un recibo "Sin Anticipo" / "Pendiente" ya se registra un
  // movimiento REAL de caja con monto $0. _foliosYaEnCaja solo descarta
  // sintéticos cuando el mov de caja tiene monto > 0, por lo que esos
  // folios aparecían DUPLICADOS (mov real $0 + sintético $0).
  // Aquí marcamos los folios que ya tienen mov real de caja con $0 para
  // descartar únicamente su sintético de $0 (si después hay abono, el
  // sintético con monto > 0 sigue mostrándose con normalidad).
  const yaEnCajaCero = new Set();
  movsCaja.forEach(m => {
    if (m.fuente === 'recibo' && (parseFloat(m.monto) || 0) === 0 && m.folio != null)
      yaEnCajaCero.add(Number(m.folio));
  });
  const sinteticos = Object.values(_recibosMap())
    .filter(r => !excluidos.has(String(r.folio)) && !yaEnCaja.has(Number(r.folio)))
    .map(_reciboAMovSintetico)
    .filter(m => m.monto > 0 || m.estatus === 'Pendiente' || m.estatus === 'Sin Anticipo')
    .filter(m => !((parseFloat(m.monto) || 0) === 0 && yaEnCajaCero.has(Number(m.folio))));
  return _ordenarMovs([...movsCaja, ...sinteticos]);
}

function contabBuscarDebounce() {
  clearTimeout(_contabDebounce);
  _contabDebounce = setTimeout(renderContab, 160);
}

function contabLimpiarFiltros() {
  const inpB = document.getElementById('cBuscar');
  const selA = document.getElementById('cFiltroAnio');
  const selM = document.getElementById('cFiltroMes');
  if (inpB) inpB.value = '';
  if (selM) selM.value = '';
  if (selA) {
    // Volver al año actual
    const anioActual = new Date().getFullYear().toString();
    for (let i = 0; i < selA.options.length; i++) {
      if (selA.options[i].value === anioActual || selA.options[i].value === '') {
        selA.selectedIndex = i; break;
      }
    }
  }
  filtroC = 'todo';
  document.querySelectorAll('#panel-contabilidad .fbtn').forEach(b => b.classList.remove('active'));
  const btnTodo = document.querySelector('#panel-contabilidad .fbtn[onclick*="todo"]');
  if (btnTodo) btnTodo.classList.add('active');
  renderContab();
}

function generarFolioMovCaja(fechaMov) {
  // fechaMov: permite asignar el folio al mes correcto en capturas retroactivas
  const clave   = _folioMY(fechaMov || hoy());
  const prefijo = 'F-' + clave + '-';
  const delMesAnio = (D.movimientos || [])
    .filter(m => m.fuente !== 'recibo' && m.fuente !== 'corte' && !m.borrado
                 && m.folioCaja && m.folioCaja.startsWith(prefijo));
  const siguiente = delMesAnio.length + 1;
  D._folioMovCajaCounter = siguiente;
  D._folioMovCajaMax     = siguiente;
  return prefijo + siguiente;   // sin ceros al frente, crece sin límite
}

function _reordenarFoliosCaja() {
  try {
    // Los movimientos de recibos no deben tener folioCaja
    (D.movimientos || []).filter(m => m.fuente === 'recibo' && !m.borrado)
      .forEach(m => { m.folioCaja = ''; });
    // Solo movimientos de caja activos
    const movsCaja = (D.movimientos || [])
      .filter(m => m.fuente !== 'recibo' && m.fuente !== 'corte' && !m.borrado);
    // Orden cronológico estricto
    movsCaja.sort((a, b) =>
      ((a.fecha || '') + 'T' + (a.hora || '00:00'))
        .localeCompare((b.fecha || '') + 'T' + (b.hora || '00:00'))
    );
    // Consecutivo reiniciado por MES-AÑO, sin ceros al frente
    const contador = {};
    movsCaja.forEach(m => {
      const clave = _folioMY(m.fecha || hoy());
      if (!contador[clave]) contador[clave] = 0;
      contador[clave]++;
      m.folioCaja = 'F-' + clave + '-' + contador[clave];
    });
    D._folioMovCajaCounter = movsCaja.length;
    D._folioMovCajaMax     = movsCaja.length;
  } catch(e) { console.warn('[reordenarFolios]', e); }
}

function setFiltroC(f, el) {
  filtroC = f;
  document.querySelectorAll('#panel-contabilidad .fbtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderContab();
}

function _renderContabFlotante(movs, q){
  let ov = document.getElementById('contab-busqueda-flotante');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'contab-busqueda-flotante';
    ov.style.cssText = 'display:none;position:fixed;top:80px;left:50%;transform:translateX(-50%);'
      + 'width:min(920px,94vw);max-height:76vh;background:#fdfaf4;border:2px solid #c8952a;'
      + 'border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,0.55);z-index:9500;overflow:hidden;'
      + 'flex-direction:column;font-family:inherit;';
    ov.innerHTML =
      '<div style="background:linear-gradient(135deg,#2a1f08,#1a1208);padding:14px 18px;'
        + 'display:flex;align-items:center;gap:10px;flex-shrink:0;">'
      +   '<span style="font-size:1.2rem;">🔍</span>'
      +   '<div style="flex:1;">'
      +     '<div style="font-family:serif;font-size:1rem;color:#e8c875;">Resultados de búsqueda</div>'
      +     '<div id="cbf-subtitulo" style="font-size:0.62rem;color:rgba(200,149,42,0.65);font-family:monospace;letter-spacing:0.06em;"></div>'
      +   '</div>'
      +   '<button onclick="_cerrarContabFlotante()" style="background:none;border:none;color:rgba(200,149,42,0.65);font-size:1.3rem;cursor:pointer;line-height:1;">✕</button>'
      + '</div>'
      + '<div id="cbf-lista" style="overflow-y:auto;flex:1;"></div>';
    document.body.appendChild(ov);
  }
  if(!q){ ov.style.display='none'; return; }
  ov.style.display='flex';
  const lista = document.getElementById('cbf-lista');
  const sub   = document.getElementById('cbf-subtitulo');
  if(sub) sub.textContent = movs.length + ' resultado' + (movs.length!==1?'s':'') + ' para "' + q + '"';
  if(!lista) return;
  if(!movs.length){
    lista.innerHTML = '<div style="padding:34px 20px;text-align:center;color:#9a8050;font-size:0.85rem;">Sin resultados para "'+esc(q)+'".</div>';
    return;
  }
  const ordenados = movs.slice().sort((a,b)=>((a.fecha||'')+'T'+(a.hora||'00:00')).localeCompare((b.fecha||'')+'T'+(b.hora||'00:00')));
  lista.innerHTML = ordenados.map(function(m){
    let folioTxt;
    if(m.fuente==='recibo'){
      const n = m.folio!=null ? m.folio : parseInt((m.id||'').replace('R-',''));
      const letra = m.letra || 'A';
      const str = (typeof folioConLetra==='function') ? folioConLetra(n, null, letra) : (n+letra);
      folioTxt = '<span onclick="_cerrarContabFlotante();abrirFichaDesdeContab('+n+')" '
        + 'style="cursor:pointer;text-decoration:underline;text-underline-offset:2px;color:#1a4a8a;font-weight:700;" '
        + 'title="Ver Ficha del Folio #'+esc(str)+'">#'+esc(str)+'</span>';
    } else {
      folioTxt = '<span style="color:#8c6518;font-weight:700;">'+esc(m.folioCaja||'—')+'</span>';
    }
    const montoHtml = m.monto>0
      ? '<b style="color:'+(m.tipo==='ingreso'?'#1a7a3a':'#c0161a')+';">'+(m.tipo==='ingreso'?'+':'-')+'$'+fmt(m.monto)+'</b>'
      : '<span style="color:#9a8050;">$0</span>';
    const descCompleta = m.descripcion || m.nombre || '—';
    const desc = esc(descCompleta.length>90 ? descCompleta.slice(0,90)+'…' : descCompleta);
    return '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;'
      + 'border-bottom:1px solid rgba(200,149,42,0.15);font-size:0.78rem;">'
      +   '<div style="width:150px;flex-shrink:0;font-family:monospace;color:#7a6840;font-size:0.68rem;">'+esc(m.fecha||'—')+' · '+esc(m.hora||'—')+'</div>'
      +   '<div style="width:70px;flex-shrink:0;">'+folioTxt+'</div>'
      +   '<div style="width:160px;flex-shrink:0;font-weight:600;">'+esc(m.fuente==='recibo'?(m.nombre||'—'):'')+'</div>'
      +   '<div style="flex:1;color:#5a4a2a;" title="'+esc(descCompleta)+'">'+desc+'</div>'
      +   '<div style="width:110px;flex-shrink:0;text-align:right;">'+montoHtml+'</div>'
      + '</div>';
  }).join('');
}

function _cerrarContabFlotante(){
  const inp = document.getElementById('cBuscar');
  if(inp) inp.value = '';
  const ov = document.getElementById('contab-busqueda-flotante');
  if(ov) ov.style.display='none';
  renderContab();
}

function abrirContabScanner(){
  let ov = document.getElementById('overlay-contab-scanner');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'overlay-contab-scanner';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9600;'
      + 'align-items:center;justify-content:center;font-family:inherit;';
    ov.innerHTML =
      '<div style="background:#fdfaf4;border:2px solid #c8952a;border-radius:12px;width:96%;max-width:980px;'
      + 'max-height:90vh;box-shadow:0 24px 60px rgba(0,0,0,0.6);overflow:hidden;display:flex;flex-direction:column;">'
      + '<div style="background:linear-gradient(135deg,#2a1f08,#1a1208);padding:16px 20px;display:flex;align-items:center;gap:10px;flex-shrink:0;">'
      +   '<span style="font-size:1.4rem;">🔎</span>'
      +   '<div style="flex:1;">'
      +     '<div style="font-family:serif;font-size:1.05rem;color:#e8c875;">Scanner de Contabilidad</div>'
      +     '<div id="cs-subtitulo" style="font-size:0.62rem;color:rgba(200,149,42,0.65);font-family:monospace;letter-spacing:0.08em;">HERRAMIENTAS RÁPIDAS</div>'
      +   '</div>'
      +   '<button onclick="cerrarContabScanner()" style="background:none;border:none;color:rgba(200,149,42,0.65);font-size:1.4rem;cursor:pointer;line-height:1;">✕</button>'
      + '</div>'
      + '<div id="cs-body" style="padding:20px;overflow-y:auto;flex:1;"></div>'
      + '</div>';
    document.body.appendChild(ov);
  }
  ov.style.display = 'flex';
  _csHome();
}

function cerrarContabScanner(){
  const ov = document.getElementById('overlay-contab-scanner');
  if(ov) ov.style.display = 'none';
}

function abrirContabMonitor(){
  let ov = document.getElementById('overlay-contab-monitor');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'overlay-contab-monitor';
    ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9600;'
      + 'align-items:center;justify-content:center;font-family:inherit;';
    ov.innerHTML =
      '<div style="background:#fdfaf4;border:2px solid #8c3a3a;border-radius:12px;width:97%;max-width:1180px;'
      + 'max-height:92vh;box-shadow:0 24px 60px rgba(0,0,0,0.6);overflow:hidden;display:flex;flex-direction:column;">'
      + '<div style="background:linear-gradient(135deg,#2a0808,#1a0808);padding:16px 20px;display:flex;align-items:center;gap:10px;flex-shrink:0;">'
      +   '<span style="font-size:1.4rem;">🛡️</span>'
      +   '<div style="flex:1;">'
      +     '<div style="font-family:serif;font-size:1.05rem;color:#e8a8a8;">Monitor de Contabilidad</div>'
      +     '<div style="font-size:0.62rem;color:rgba(232,168,168,0.65);font-family:monospace;letter-spacing:0.08em;">CERTEZA DE QUE NADA SE INFLA NI SE ELIMINA SIN RASTRO</div>'
      +   '</div>'
      +   '<button onclick="cerrarContabMonitor()" style="background:none;border:none;color:rgba(232,168,168,0.65);font-size:1.4rem;cursor:pointer;line-height:1;">✕</button>'
      + '</div>'
      + '<div style="display:flex;background:#f5e8e8;border-bottom:1px solid #e0c0c0;flex-shrink:0;">'
      +   '<div class="mon-tab" data-t="bitacora" style="padding:11px 20px;cursor:pointer;font-size:12.5px;font-weight:600;color:#7a4040;border-bottom:2.5px solid transparent;">📜 Bitácora Real</div>'
      +   '<div class="mon-tab" data-t="errores" style="padding:11px 20px;cursor:pointer;font-size:12.5px;font-weight:600;color:#7a4040;border-bottom:2.5px solid transparent;">⚠️ Errores del Sistema</div>'
      +   '<div class="mon-tab" data-t="reconciliacion" style="padding:11px 20px;cursor:pointer;font-size:12.5px;font-weight:600;color:#7a4040;border-bottom:2.5px solid transparent;">🔄 Reconciliación Mensual</div>'
      + '</div>'
      + '<div id="mon-body" style="padding:20px;overflow-y:auto;flex:1;"></div>'
      + '</div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('.mon-tab').forEach(function(t){
      t.onclick = function(){
        _monTabActual = t.getAttribute('data-t');
        _monPintarTabs();
        _monRender();
      };
    });
  }
  ov.style.display = 'flex';
  _monPintarTabs();
  _monRender();
}

function _monPintarTabs(){
  const ov = document.getElementById('overlay-contab-monitor');
  if(!ov) return;
  ov.querySelectorAll('.mon-tab').forEach(function(x){
    const on = x.getAttribute('data-t') === _monTabActual;
    x.style.borderBottomColor = on ? '#c04040' : 'transparent';
    x.style.background = on ? '#fdfaf4' : '';
    x.style.color = on ? '#3a1010' : '#7a4040';
  });
}

function cerrarContabMonitor(){
  const ov = document.getElementById('overlay-contab-monitor');
  if(ov) ov.style.display = 'none';
}

function _monRender(){
  if(_monTabActual === 'bitacora') _monRenderBitacora();
  else if(_monTabActual === 'errores') _monRenderErrores();
  else _monRenderReconciliacion();
}

function _monRenderErrores(){
  const body = document.getElementById('mon-body');
  if(!body) return;
  const keywords = ['recibo','contab','mov','sync','placas','caja','folio'];
  const errs = (window.LEX_ERRORS||[]).filter(function(e){
    const m = (e.modulo||'').toLowerCase();
    return keywords.some(function(k){ return m.indexOf(k) >= 0; });
  }).slice().reverse().slice(0,80);
  if(!errs.length){
    body.innerHTML = '<div style="text-align:center;padding:40px;color:#1a7a3a;">✓ Sin errores o alteraciones registradas relacionadas a Contabilidad en esta sesión.</div>';
    return;
  }
  let html = '<div style="font-size:0.68rem;color:#7a4040;margin-bottom:12px;">Errores y alteraciones del sistema relacionados a Contabilidad — solo de esta sesión del navegador.</div>';
  errs.forEach(function(e){
    const color = e.nivel === 'error' ? '#c0161a' : (e.nivel === 'warn' ? '#a8730c' : '#7a6840');
    html += '<div style="border-bottom:1px solid #f0e8e0;padding:8px 4px;font-size:0.72rem;">'
      + '<span style="color:'+color+';font-weight:700;">['+esc(e.nivel||'')+']</span> '
      + '<span style="color:#7a6840;">'+esc(e.modulo||'')+'</span> — '
      + esc(e.mensaje||'') + ' <span style="color:#999;font-size:0.62rem;">('+new Date(e.fecha).toLocaleString('es-MX')+')</span>'
      + '</div>';
  });
  body.innerHTML = html;
}

function contabToggleMes(id) {
  const el    = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
  // Guardar estado manual en sesión
  window._contabMesesAbiertos[id] = !open;
}

function contabToggleAnio(id) {
  const el    = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
  // Guardar estado manual en sesión
  window._contabAniosAbiertos[id] = !open;
}

function renderCarp(){
  const q=($('carpQ')?.value||'').toLowerCase();
  // "Archivado" y "Cancelado" tienen cada uno su propia tarjeta/filtro,
  // separados de "Concluidas" (antes CANCELADO se contaba dentro de
  // Concluidas aunque la tabla mostrara una etiqueta distinta — confundía
  // porque el número no cuadraba).
  const EST_CONCLUIDO=['CONCLUIDO','CONCLUIDO Y ENTREGADA','CONCLUIDO Y ENTREGADO','CONCLUIDO Y ENTRAGADO'];
  const EST_ARCHIVADO=['ARCHIVADO'];
  const EST_CANCELADO=['CANCELADO'];
  // Mejora 5: actualizar contadores arriba (siempre con TODAS las carpetas, sin filtro)
  const todas = D.carpetas || [];
  let cntActiva = 0, cntConcluida = 0, cntArchivada = 0, cntCancelada = 0;
  todas.forEach(c => {
    const est = (c.estatus||'').toUpperCase().trim();
    const esConcluida = EST_CONCLUIDO.some(x => est.startsWith(x));
    const esArchivada = !esConcluida && EST_ARCHIVADO.some(x => est.startsWith(x));
    const esCancelada = !esConcluida && !esArchivada && EST_CANCELADO.some(x => est.startsWith(x));
    if (esConcluida) {
      cntConcluida++;
    } else if (esArchivada) {
      cntArchivada++;
    } else if (esCancelada) {
      cntCancelada++;
    } else {
      cntActiva++;
    }
  });
  const setStat = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setStat('carpStTot', todas.length);
  setStat('carpStAct', cntActiva);
  setStat('carpStCon', cntConcluida);
  setStat('carpStArch', cntArchivada);
  setStat('carpStCanc', cntCancelada);
  let l=D.carpetas.filter(c=>{
    const est=(c.estatus||'').toUpperCase().trim();
    const esConcluida=EST_CONCLUIDO.some(x=>est.startsWith(x));
    const esArchivada=!esConcluida&&EST_ARCHIVADO.some(x=>est.startsWith(x));
    const esCancelada=!esConcluida&&!esArchivada&&EST_CANCELADO.some(x=>est.startsWith(x));
    if(filtroCT==='activa')return !esConcluida&&!esArchivada&&!esCancelada;
    if(filtroCT==='entregada')return esConcluida;
    if(filtroCT==='archivada')return esArchivada;
    if(filtroCT==='cancelada')return esCancelada;
    return true;
  }).filter(c=>!q||_carpTextoBusqueda(c).includes(q));
  const el=$('listaCarp');
  if(!l.length){el.innerHTML='<div style="color:var(--muted);padding:24px;font-size:0.76rem;">Sin carpetas en este filtro.</div>';return;}
  function estatusCell(est){
    const e=(est||'').toUpperCase();
    // Paleta login: dorado/ámbar base, verde para concluido, rojo para cancelado
    let bg='rgba(200,149,42,0.12)',col='#8c6518',border='rgba(200,149,42,0.45)';
    if(e.includes('ARCHIVADO')){bg='rgba(200,149,42,0.08)';col='#7a6030';border='rgba(200,149,42,0.3)';}
    else if(e.includes('CONCLUIDO')||e.includes('ENTREGAD')){bg='rgba(26,122,58,0.1)';col='#0f5228';border='rgba(26,122,58,0.35)';}
    else if(e.includes('CANCELADO')){bg='rgba(192,22,26,0.1)';col='#8a1010';border='rgba(192,22,26,0.3)';}
    else if(e.includes('TRÁMITE')||e.includes('TRAMITE')||e.includes('PROCESO')||e==='ACTIVO'){bg='rgba(26,74,138,0.1)';col='#1a3a7a';border='rgba(26,74,138,0.3)';}
    return `<span style="display:inline-block;padding:3px 11px;border-radius:20px;font-family:monospace;font-size:0.6rem;font-weight:700;background:${bg};color:${col};border:1.5px solid ${border};letter-spacing:0.05em;white-space:nowrap;text-transform:uppercase;">${esc(est||'—')}</span>`;
  }
  const thStyle=`padding:11px 13px;text-align:left;font-family:monospace;font-size:0.58rem;font-weight:700;color:#8c6518;letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap;border-bottom:2px solid #d4b870;background:linear-gradient(135deg,#fdf8ee,#f5edcc);`;
  el.innerHTML=`
    <style>
      .carp-tr { transition: background 0.22s, box-shadow 0.22s; }
      .carp-tr:hover { background: #FBF5E2 !important; box-shadow: 0 0 0 1.5px #C8AA60; }
      .carp-tr:hover td:first-child { border-radius: 6px 0 0 6px; }
      .carp-tr:hover td:last-child  { border-radius: 0 6px 6px 0; }
      .carp-tr:hover .carp-num-badge { border-color: #C8AA60; }
      .carp-action-btn { background:none;border:1.5px solid rgba(200,149,42,0.3);color:#b07820;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:0.8rem;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s;margin:0 1px; }
      .carp-action-btn:hover { background:rgba(200,149,42,0.15);border-color:#c8952a;transform:translateY(-1px);box-shadow:0 2px 8px rgba(200,149,42,0.2); }
    </style>
    <div style="overflow-x:auto;border:2px solid #d4b870;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(200,149,42,0.12);">
    <table style="width:100%;border-collapse:collapse;font-family:sans-serif;">
      <thead>
        <tr>
          <th style="${thStyle}white-space:nowrap;padding-left:16px;">EXP.</th>
          <th style="${thStyle}">NOMBRE</th>
          <th style="${thStyle}white-space:nowrap;">TIPO DE TRÁMITE</th>
          <th style="${thStyle}text-align:center;">ESTATUS</th>
          <th style="${thStyle}text-align:center;padding-right:14px;"></th>
        </tr>
      </thead>
      <tbody>
        ${l.map((c,rowI)=>{
          const idx=D.carpetas.indexOf(c);
          const tipoLabel={juicio:'JUICIO',escritura:'ESCRITURA',registro_civil:'REG. CIVIL',documentos:'DOCUMENTOS'}[c.tipoTramite]||(c.tipoTramite?c.tipoTramite.toUpperCase():'—');
          let subTipo='';
          if(c.tipoTramite==='juicio'&&c.juicioDesc) subTipo=c.juicioDesc;
          else if(c.tipoTramite==='escritura'&&c.escTipo) subTipo=c.escTipo;
          else if(c.tipoTramite==='registro_civil'&&c.regCivilTipo) subTipo={registro_extemporaneo:'Reg. Extemporáneo',rectificacion_nombre:'Rectif. Nombre',aclaracion_nombre:'Aclar. Nombre'}[c.regCivilTipo]||c.regCivilTipo;
          else if(c.tipoTramite==='documentos'&&c.docDesc) subTipo=c.docDesc;
          const tipoTexto=subTipo?tipoLabel+' — '+subTipo:tipoLabel;
          const rowBg=rowI%2===0?'#fdfaf4':'#faf5e8';
          const tdStyle=`padding:10px 13px;font-size:0.76rem;color:#2a1a06;border-bottom:1px solid rgba(212,184,112,0.25);vertical-align:middle;`;
          return `<tr class="carp-tr" onclick="abrirDetallesCarpeta(${idx})" style="background:${rowBg};cursor:pointer;">
            <td style="${tdStyle}padding-left:16px;">
              <span class="carp-num-badge" style="border:1.5px solid #d4b870;padding:3px 10px;font-family:monospace;font-size:0.68rem;font-weight:700;color:#8c6518;white-space:nowrap;border-radius:6px;background:#fdfaf4;transition:all 0.15s;display:inline-block;">${fmtCarpNumHTML(c.num)}</span>
            </td>
            <td style="${tdStyle}font-weight:600;white-space:nowrap;color:#1a0f02;">${esc(c.cliente||'—')}</td>
            <td style="${tdStyle}font-family:monospace;font-size:0.67rem;color:#6a4a10;white-space:nowrap;">${esc(tipoTexto)}</td>
            <td style="${tdStyle}text-align:center;">${estatusCell(c.estatus)}</td>
            <td style="${tdStyle}text-align:center;white-space:nowrap;padding-right:14px;" onclick="event.stopPropagation()">
              <button onclick="abrirDetallesCarpeta(${idx})" title="Detalles: qué contiene esta carpeta" class="carp-action-btn" style="width:auto;padding:0 10px;font-size:0.62rem;font-family:monospace;font-weight:700;letter-spacing:0.02em;">📋 Detalles</button>
              <button onclick="abrirCarpeta(${idx})" title="Editar" class="carp-action-btn">✏️</button>
              <button onclick="abrirMenuCarpeta(event,${idx})" title="Más opciones" class="carp-action-btn">☰</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>`;
}

function _juTerminosAbiertos(j){
  if(!j) return [];
  const lista = (j.terminos || []).filter(t => t && !t.cumplido && t.fecha).slice();
  const aud = j.audiencia;
  if(aud && !lista.some(t => t.fecha === aud)){
    lista.push({
      id: '_aud_' + aud,
      tipo: 'Audiencia',
      descripcion: j.movimiento || 'Audiencia / término señalado',
      fecha: aud,
      cumplido: false,
      _virtual: true
    });
  }
  lista.sort((a,b) => String(a.fecha).localeCompare(String(b.fecha)));
  return lista;
}

async function eliminarPend(){
  if(eiP<0)return;
  const p=D.pendientes[eiP];
  // Blindaje: un pendiente de Placas vinculado a un recibo nunca se borra a
  // mano — solo desaparece solo cuando sincronizarPendientesPlacas() detecta
  // que el recibo se liquidó o se canceló.
  if(p && (p.seccion === 'placas' || p.reciboVinculadoFolio)){
    toast('Este pendiente se sincroniza con el recibo — no se puede eliminar a mano.');
    return;
  }
  // Igual que al eliminar un movimiento de contabilidad o cancelar un trámite:
  // pedir autorización (nombre del empleado que la autoriza) antes de la
  // confirmación final, ya que borrar un pendiente no se puede deshacer.
  const auth = await pedirAutorizacion();
  if(auth === null) return;
  const ok = await confirmarBonito({
    titulo: 'Eliminar pendiente',
    mensaje: '"'+p.texto+'"\n\nEsta acción no se puede deshacer.',
    btnSi: 'Sí, eliminar',
    btnNo: 'Cancelar',
    peligro: true
  });
  if(!ok) return;
  _marcarPendEliminadoLocal(p.id);
  D.pendientes.splice(eiP,1);
  cerrar('mPendiente');save();renderPend();badges();syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
  toast('Pendiente eliminado — autorizó '+auth.nombre);
}

function _registrarMovimiento(mov) {
  if (!mov || !mov.id) return false;
  if (!Array.isArray(D.movimientos)) D.movimientos = [];
  // ── CANDADO ANTI-FECHA-RETROACTIVA-INVOLUNTARIA ──────────────────────────
  // Última red de seguridad del bug del 08-ago-2026 (ver _capturaRetroVigente):
  // si un movimiento va a quedar guardado con una fecha distinta a la de HOY,
  // se avisa explícitamente ANTES de escribirlo. Solo pregunta la primera vez
  // de cada sesión de captura retroactiva (para no estorbar cuando la captura
  // masiva de un mes pasado sí es intencional) y siempre deja rastro en consola.
  try {
    const _hoyRealMov = (typeof _hoyReal === 'function') ? _hoyReal() : new Date().toISOString().slice(0,10);
    if (mov.fecha && mov.fecha !== _hoyRealMov && !mov.retroactivo && !mov.esRestaurado && !mov._autoRecuperado) {
      console.warn('[FechaRetro] Movimiento con fecha distinta a hoy:', mov.fecha, 'vs', _hoyRealMov, mov.id);
      if (!window._capturaRetroAvisado) {
        window._capturaRetroAvisado = true;
        const _seguir = confirm(
          '⚠ ATENCIÓN — FECHA RETROACTIVA\n\n' +
          'Este movimiento se va a guardar con fecha ' + mov.fecha + ',\n' +
          'NO con la fecha de hoy (' + _hoyRealMov + ').\n\n' +
          'Monto: $' + (parseFloat(mov.monto)||0).toLocaleString('es-MX') + '\n' +
          'Concepto: ' + String(mov.descripcion || '').slice(0,80) + '\n\n' +
          '¿Es correcto? Si NO lo es, cancela y sal del modo de captura\n' +
          'retroactiva (botón "✕ Salir" de la barra azul de arriba).'
        );
        if (!_seguir) {
          if (typeof _capturaRetroApagar === 'function') _capturaRetroApagar('el usuario canceló un movimiento con fecha retroactiva');
          if (typeof toast === 'function') toast('Movimiento cancelado — modo retroactivo desactivado','err');
          return false;
        }
      }
    }
  } catch(e) { console.warn('[FechaRetro] guard', e); }
  // 1. Deduplicacion por ID exacto
  if (D.movimientos.some(m => m.id === mov.id)) {
    console.warn("[Dedup] Movimiento ya existe por ID:", mov.id);
    return false;
  }
  // 2. Deduplicacion por folio+letra+fecha+hora+monto+estatus (solo recibos)
  // Evita duplicados por doble-click, reconexion Drive, reimprimir, etc.
  // IMPORTANTE: incluye hora para no bloquear recibos retro del mismo folio/fecha/monto
  // pero distinta hora (ej: 26-071 original a las 12:03 vs 26-071A retro a las 17:44)
  if (mov.fuente === "recibo" && mov.folio != null) {
    const existe = D.movimientos.some(m =>
      !m.borrado &&
      m.fuente === "recibo" &&
      m.folio == mov.folio &&
      (m.letra || 'A') === (mov.letra || 'A') && /* ⚠️ CRÍTICO — NO QUITAR: distingue movimientos A/B del mismo folio */
      m.fecha === mov.fecha &&
      (m.hora || '').slice(0,5) === (mov.hora || '').slice(0,5) && /* incluir hora evita falsos positivos en retro */
      parseFloat(m.monto) === parseFloat(mov.monto) &&
      (m.estatus || "") === (mov.estatus || "")
    );
    if (existe) {
      console.warn("[Dedup] Recibo duplicado ignorado — folio:", mov.folio, "monto:", mov.monto);
      return false;
    }
  }
  D.movimientos.push(mov);
  _auditoriaRegistrar('creado', mov);
  if(typeof _pendMovGuardar === 'function') _pendMovGuardar(mov);
  // Protege el movimiento recién creado (caja/retiro/manual) contra el mismo
  // parpadeo que ya se resolvía para ediciones y borrados: si un pull de
  // Supabase (polling cada 30s, cambio de pestaña, broadcast Realtime) llega
  // ANTES de que la subida debounced (syncEstadoSupabaseDebounced, 800ms)
  // confirme este movimiento en el servidor, sincronizarFolio() ya sabe
  // conservarlo — reutiliza la misma ventana de gracia de 15s que usan
  // _marcarMovEditadoLocal/_marcarMovEliminadoLocal, sin tocar esa lógica.
  // Los movimientos de recibo no lo necesitan: ya tienen su propia fusión.
  if (mov.fuente !== 'recibo' && typeof _marcarMovEditadoLocal === 'function') {
    _marcarMovEditadoLocal(mov.id);
  }
  return true;
}

async function sync(){
  // En Supabase, "sincronizar" significa releer el estado completo
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  try {
    await sincronizarFolio();
    try { if(typeof window._pendMovsRecuperar === 'function') window._pendMovsRecuperar(); } catch(_ePend){}
    if(typeof renderCaja==='function') renderCaja();
    if(typeof renderRec==='function') renderRec();
    if(typeof renderContab==='function') renderContab();
    if(typeof badges==='function') badges();
    toast('Sincronización completa ✓');
    setTimeout(()=>{ if(typeof migrarConceptoCostosExtra==='function') migrarConceptoCostosExtra(); }, 200);
    setTimeout(()=>{ if(typeof migrarMovimientosRecibos==='function') migrarMovimientosRecibos(); }, 600);
  } catch(e){
    console.warn('sync:', e);
  }
}

function _calcularRecibosFaltantes(opts){
  opts = opts || {};
  var soloFolio = (opts.soloFolio != null && opts.soloFolio !== '') ? Number(opts.soloFolio) : null;
  if(typeof D === 'undefined' || !Array.isArray(D.movimientos)) return [];
  if(!appData || !Array.isArray(appData.recibos) || !appData.recibos.length) return [];
  var excluidos = new Set((D.recibosExcluidosCaja||[]).map(String));
  var TOL = 0.5; // tolerancia en pesos para ruido de punto flotante
  var _num = function(v){ var n = parseFloat(v); return isNaN(n) ? 0 : n; };
  var _esExacto = function(c){ return !!(c && c.liquidadoAlMomento) && _num(c.montoLiquidado) === _num(c.precio); };
  var _rid = function(){ return Date.now() + '-' + Math.random().toString(36).slice(2,6); };
  var _fl = function(folio, anio, letra){
    return (typeof folioConLetra === 'function') ? folioConLetra(folio, anio, letra) : (String(folio) + (letra||'A'));
  };
  // Agrupar recibos (no-complemento) por folio
  var porFolio = {};
  appData.recibos.forEach(function(r){
    if(!r || r.esComplemento) return;
    var f = Number(r.folio);
    if(!f || isNaN(f)) return;
    if(soloFolio != null && f !== soloFolio) return;
    if(excluidos.has(String(f))) return;
    (porFolio[f] = porFolio[f] || []).push(r);
  });
  // Agrupar movimientos de recibo ya registrados por folio
  var movPorFolio = {};
  D.movimientos.forEach(function(m){
    if(!m || m.borrado || m.fuente !== 'recibo' || m.folio == null) return;
    var f = Number(m.folio);
    (movPorFolio[f] = movPorFolio[f] || []).push(m);
  });
  var plan = [];
  Object.keys(porFolio).forEach(function(fk){
    var folio = Number(fk);
    var versiones = porFolio[folio].slice().sort(function(a,b){
      return String(a.letra||'A').charCodeAt(0) - String(b.letra||'A').charCodeAt(0);
    });
    var ultima = versiones[versiones.length - 1];
    var primera = versiones[0];
    var movs   = movPorFolio[folio] || [];
    var resp   = ultima.responsable || (typeof empNombre === 'function' ? empNombre() : '');

    // ── Rama CANCELACIÓN (independiente del modelo de brecha) ──
    var cancelada = versiones.filter(function(v){ return v.cancelado; }).pop();
    if(cancelada){
      if(cancelada.cancelacionTipo === 'sin_movimiento') return;
      if(movs.some(function(m){ return (m.estatus||'') === 'Cancelación'; })) return;

      // Respetar tombstones: si el admin eliminó intencionalmente movimientos de
      // este folio+letra de cancelación, NO regenerarlos aunque haya brecha detectada.
      var _letraC2 = (cancelada.letra || 'A').toUpperCase();
      var _tombsLoc = Array.isArray(D.movimientos_eliminados) ? D.movimientos_eliminados : [];
      var _hayTombCancel = _tombsLoc.some(function(t){
        return String(t.folio) === String(folio) && (t.letra||'A').toUpperCase() === _letraC2;
      });
      if(_hayTombCancel) return;

      var montoC = _num(cancelada.cancelacionMonto) > 0 ? _num(cancelada.cancelacionMonto) : _num(cancelada.anticipo);
      if(montoC <= TOL) return;
      var letraC    = cancelada.letra || 'A';
      var folioStrC = _fl(folio, cancelada.anio_folio, letraC);
      // FIX: mostrar CONCEPTO — DESCRIPCIÓN del recibo cancelado en vez de solo
      // repetir folio/nombre (misma regla aplicada al guardado normal).
      var _txtC = _conceptoTxtDeRecibo(cancelada);
      plan.push({
        id:'M-RECUP-'+folio+'-'+letraC+'-X-'+_rid(), folioCaja:'',
        fecha:(cancelada.fechaActualizacion || cancelada.fecha || '').substring(0,10),
        hora:(cancelada.horaActualizacion || cancelada.hora || '00:00'),
        descripcion: _txtC || ('Recuperado · Cancelación Recibo #'+folioStrC+' · '+(cancelada.nombre||'')),
        nombre:cancelada.nombre||'', folio:folio, letra:letraC, monto:montoC,
        tipo:(cancelada.cancelacionTipo === 'egreso' ? 'egreso' : 'ingreso'),
        cat:'Cancelación · #'+folioStrC, estatus:'Cancelación', fuente:'recibo',
        responsable:cancelada.responsable||resp, _autoRecuperado:true
      });
      return;
    }

    var letraU    = ultima.letra || 'A';
    var folioStrU = _fl(folio, ultima.anio_folio, letraU);
    var fechaU = ((ultima.esActualizacion && ultima.fechaActualizacion) ? ultima.fechaActualizacion : (ultima.fecha||'')).substring(0,10);
    var horaU  = ((ultima.esActualizacion && ultima.horaActualizacion)  ? ultima.horaActualizacion  : (ultima.hora||'00:00'));
    var nombre = ultima.nombre || '';

    // GRACIA 60s: mientras el guard estuvo activo en los ultimos 60s, saltar todos los folios.
    // Evita que _protegerMovimientosRecibo() vea una brecha falsa durante el intervalo
    // entre que el recibo B entra a appData.recibos y su movimiento llega a D.movimientos.
    var _tsGuard = window._registrandoReciboTS || 0;
    if(Date.now() - _tsGuard < 60000) return;

    // ── Respetar tombstones de movimientos y de recibos eliminados ──
    // Si el admin eliminó el recibo de esta letra (adminEliminarRecibo) o el movimiento
    // (reconciliarAplicar/modal), NO regenerar el movimiento aunque haya brecha.
    var _tombsMov = Array.isArray(D.movimientos_eliminados) ? D.movimientos_eliminados : [];
    var _tombsRec = Array.isArray(appData.folios_eliminados) ? appData.folios_eliminados : [];
    var _hayTombLetra = _tombsMov.some(function(t){
      return String(t.folio) === String(folio) && (t.letra||'A').toUpperCase() === letraU.toUpperCase();
    }) || _tombsRec.some(function(t){
      return String(t.folio) === String(folio) && (t.letra||'A').toUpperCase() === letraU.toUpperCase();
    });
    if(_hayTombLetra) return;

    // ── Sub-libro COMPLEMENTARIOS EXACTOS ──
    var espComp = (ultima.costosExtra||[]).filter(_esExacto)
                    .reduce(function(s,c){ return s + _num(c.montoLiquidado); }, 0);
    var regComp = movs.filter(function(m){ return (m.estatus||'') === 'Complementario'; })
                      .reduce(function(s,m){ return s + _num(m.monto); }, 0);
    var gapComp = espComp - regComp;

    // ── Sub-libro HONORARIOS ──
    // Usa el total del recibo ORIGINAL (letra A), no el del último ("ultima").
    // El campo "total" del último recibo no siempre es el pactado completo:
    // en un Pago Total/Liquidación se reescribe para representar el ADEUDO
    // ANTERIOR que se está liquidando a $0 (folio 42B real: total=$850, el
    // adeudo que traía, no el pactado original de $1,850) — usar "ultima"
    // ahí habría subestimado espHon y podía enmascarar una brecha real. La
    // versión A nunca cambia de significado ni lleva Servicio Complementario
    // (ese solo se agrega desde B+), así que es la única fuente confiable.
    var totalU = _num(primera.total);
    var saldoU = _num(ultima.saldoPendiente);
    var espHon = totalU > 0 ? (totalU - saldoU) : _num(ultima.anticipo);
    if(espHon < 0) espHon = 0;
    var regHon = movs.filter(function(m){ return (m.estatus||'') !== 'Complementario'; })
                     .reduce(function(s,m){ return s + _num(m.monto); }, 0);
    var gapHon = espHon - regHon;
    if(gapHon > TOL){
      var estatusHon;
      if(saldoU <= 0)                              estatusHon = 'Liquidado';
      else if(regHon <= TOL && letraU === 'A')     estatusHon = (espHon > 0 ? 'Anticipo' : 'Sin Anticipo');
      else                                         estatusHon = 'Abono parcial';
      var _txtH = _conceptoTxtDeRecibo(ultima);
      plan.push({
        id:'M-RECUP-'+folio+'-'+letraU+'-H-'+_rid(), folioCaja:'',
        fecha:fechaU, hora:horaU,
        descripcion: _txtH || ('Recuperado · Recibo #'+folioStrU+' · '+nombre),
        nombre:nombre, folio:folio, letra:letraU, monto:gapHon, tipo:'ingreso',
        cat:estatusHon+' · #'+folioStrU, estatus:estatusHon, fuente:'recibo',
        responsable:resp, _autoRecuperado:true
      });
    }
    if(gapComp > TOL){
      var _txtComp = _conceptoTxtDeRecibo(ultima);
      plan.push({
        id:'M-RECUP-'+folio+'-'+letraU+'-C-'+_rid(), folioCaja:'',
        fecha:fechaU, hora:horaU,
        descripcion: _txtComp || ('Recuperado · Complementario Recibo #'+folioStrU+' · '+nombre),
        nombre:nombre, folio:folio, letra:letraU, monto:gapComp, tipo:'ingreso',
        cat:'Complementario · #'+folioStrU, estatus:'Complementario', fuente:'recibo',
        responsable:resp, _autoRecuperado:true
      });
    }
  });
  return plan;
}

async function reconciliarAplicar(ids, opts){
  opts = opts || {};
  if(typeof D==='undefined' || !Array.isArray(D.movimientos)){ console.error('[reconciliar] D.movimientos no disponible'); return; }
  if(!Array.isArray(ids) || !ids.length){ console.error('[reconciliar] Pasa un arreglo de ids. Ej: reconciliarAplicar(["M-REC-86"])'); return; }
  var encontrados = D.movimientos.filter(function(m){ return m && ids.indexOf(m.id) >= 0; });
  var faltantes   = ids.filter(function(id){ return !D.movimientos.some(function(m){ return m && m.id===id; }); });
  console.log('%c── RECONCILIAR · '+(opts.confirmar?'EJECUCIÓN':'SIMULACIÓN (no borra)')+' ──','color:#c8952a;font-weight:bold');
  if(encontrados.length) console.table(encontrados.map(function(m){ return {id:m.id, folio:String(m.folio)+(m.letra||''), monto:parseFloat(m.monto)||0, estatus:m.estatus, desc:(m.descripcion||'').slice(0,40)}; }));
  if(faltantes.length) console.warn('[reconciliar] IDs no encontrados (ya eliminados o mal escritos):', faltantes);
  if(!encontrados.length){ console.warn('[reconciliar] Nada que eliminar.'); return; }
  if(!opts.confirmar){
    console.log('%cSimulación. Para ejecutar de verdad: reconciliarAplicar(ids, {confirmar:true})','color:#666');
    return { simulado: encontrados.map(function(m){ return m.id; }) };
  }
  var idsSet = {}; encontrados.forEach(function(m){ idsSet[m.id]=true; });
  var totalMonto = encontrados.reduce(function(s,m){ return s+(parseFloat(m.monto)||0); }, 0);
  // ── GUARDRAIL PERMANENTE (caso real: folio 76) ──────────────────────────────
  // Detecta si esta eliminación dejaría algún folio SIN NINGÚN movimiento real
  // de contabilidad, cuando su recibo sí registra un cobro (anticipo/abono/total).
  // Esto es EXACTAMENTE lo que pasó con el folio 76: se borró el único
  // movimiento real que quedaba y nadie lo notó hasta que un dato sintético
  // (aproximado, con letra/fecha equivocadas) apareció en su lugar. Este
  // chequeo corre SIEMPRE — incluso cuando el llamador pasa sinConfirm:true
  // (botones de la UI que ya muestran su propio confirm genérico) — porque
  // ese confirm genérico no informa de este riesgo específico.
  var foliosTocados = {};
  encontrados.forEach(function(m){ if(m.folio!=null) foliosTocados[m.folio]=true; });
  var foliosEnRiesgo = Object.keys(foliosTocados).filter(function(fk){
    var f = Number(fk);
    var quedanReales = D.movimientos.some(function(m){
      return m && !idsSet[m.id] && !m.borrado && Number(m.folio)===f && m.fuente==='recibo' && (parseFloat(m.monto)||0) > 0;
    });
    if(quedanReales) return false;
    var recibosDelFolio = (typeof appData!=='undefined' && Array.isArray(appData.recibos))
      ? appData.recibos.filter(function(r){ return r && !r.esComplemento && Number(r.folio)===f; }) : [];
    return recibosDelFolio.some(function(r){
      return (parseFloat(r.anticipo)||0) > 0 || (parseFloat(r.totalAbonado)||0) > 0 || (parseFloat(r.total)||0) > 0;
    });
  });
  if(foliosEnRiesgo.length){
    var _msgRiesgo = '⚠⚠ ATENCIÓN — esta eliminación dejaría el/los folio(s) '+foliosEnRiesgo.join(', ')+
      ' SIN NINGÚN movimiento real en Contabilidad, aunque su recibo sí registra un cobro. '+
      'Verás ahí un dato aproximado y NO confiable hasta que se corrija a mano.\n\n'+
      'Si de verdad quieres continuar, escribe ELIMINAR (en mayúsculas) y presiona aceptar:';
    var _resp = (typeof prompt === 'function') ? prompt(_msgRiesgo) : null;
    if(_resp !== 'ELIMINAR'){
      console.log('[reconciliar] Cancelado — no se escribió ELIMINAR (folio(s) en riesgo: '+foliosEnRiesgo.join(', ')+').');
      if(typeof toast==='function') toast('Cancelado — folio(s) '+foliosEnRiesgo.join(', ')+' se quedarían sin contabilidad real','warn');
      return;
    }
  } else if(!opts.sinConfirm && typeof confirm==='function' && !confirm('Eliminar '+encontrados.length+' movimiento(s) por $'+Number(totalMonto||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})+' de contabilidad.\n\nSe guarda respaldo y tombstone (no vuelven al sincronizar, pero puedes restaurarlos con reconciliarDeshacerUltimo()). ¿Continuar?')){ console.log('[reconciliar] Cancelado por el usuario.'); return; }
  if(!Array.isArray(window._reconcBackup)) window._reconcBackup = [];
  encontrados.forEach(function(m){ window._reconcBackup.push(Object.assign({_borradoTs:Date.now()}, m)); });
  console.log('🗄️ Respaldo guardado en window._reconcBackup ('+window._reconcBackup.length+' movimiento(s) en total).');
  if(!Array.isArray(D.movimientos_eliminados)) D.movimientos_eliminados = [];
  encontrados.forEach(function(m){
    if(!D.movimientos_eliminados.some(function(t){ return t.id===m.id; }))
      D.movimientos_eliminados.push(Object.assign({}, m, { id:m.id, folio:m.folio, letra:m.letra||'A', monto:m.monto, ts:Date.now(), _snapshotCompleto:true }));
  });
  // Notificar al monitor de SCANSYS que esta eliminacion es intencional (accion de admin)
  // para que NO genere error "D.movimientos cayo X sin accion de admin"
  window._adminDeletedMovs = (window._adminDeletedMovs||0) + encontrados.length;
  _filtrarMovsAuditado(function(m){ return !(m && idsSet[m.id]); }, 'reconciliarAplicar');
  try {
    if(typeof syncEstadoSupabase==='function'){ if(typeof _ultimoSyncPropio!=='undefined') _ultimoSyncPropio=Date.now(); await syncEstadoSupabase(); }
  } catch(e){ console.warn('[reconciliar] sync', e); }
  ['renderContab','renderCaja','renderHistorial','badges'].forEach(function(fn){ if(typeof window[fn]==='function'){ try{ window[fn](); }catch(e){} } });
  // Refrescar SCANSYS PRO si está abierto — para que actualice el badge y la lista de problemas
  setTimeout(function(){
    if(typeof window._scRefrescar==='function') window._scRefrescar();
    if(typeof window.scansysRenderActivo==='function') window.scansysRenderActivo();
    // Actualizar badge de folios con problema
    var sxN = document.getElementById('sxpro-n');
    if(sxN && typeof foliosConProblema==='function'){
      var probs = foliosConProblema();
      sxN.textContent = probs.length + ' folio(s) con problema';
    }
  }, 600);
  console.log('%c✅ '+encontrados.length+' movimiento(s) eliminado(s) con tombstone y sincronizado(s).','color:#1a7a3a;font-weight:bold');
  if(typeof toast==='function') toast('✅ '+encontrados.length+' movimiento(s) reconciliado(s)','ok');
  // Registrar en LEX_ERRORS como INFO (no error) para que el admin vea el historial
  if(typeof _lexPush==='function'){
    var _idsElim = encontrados.map(function(m){ return (m.folio||'?')+(m.letra||'A')+' $'+(parseFloat(m.monto)||0).toLocaleString('es-MX',{minimumFractionDigits:2}); }).join(', ');
    _lexPush('info','admin.reconciliar', encontrados.length+' movimiento(s) eliminado(s) intencionalmente por admin: '+_idsElim, null, {ids: encontrados.map(function(m){return m.id;})});
  }
  return { eliminados: encontrados.map(function(m){ return m.id; }) };
}

async function reconciliarDeshacerUltimo(opts){
  opts = opts || {};
  var n = opts.n || 1;
  if(typeof D==='undefined' || !Array.isArray(D.movimientos_eliminados) || !D.movimientos_eliminados.length){
    console.warn('[reconciliar] No hay eliminaciones registradas para deshacer.');
    return;
  }
  var candidatos = D.movimientos_eliminados.filter(function(t){ return t && t._snapshotCompleto; })
    .sort(function(a,b){ return (b.ts||0)-(a.ts||0); })
    .slice(0, n);
  if(!candidatos.length){
    console.warn('[reconciliar] Las eliminaciones más recientes no tienen respaldo completo (de antes de este fix). No se puede restaurar automáticamente — se necesita acceso directo a Supabase.');
    return;
  }
  console.log('%c── RESTAURAR ELIMINACIÓN(ES) ──','color:#c8952a;font-weight:bold');
  console.table(candidatos.map(function(t){ return {id:t.id, folio:String(t.folio)+(t.letra||''), monto:parseFloat(t.monto)||0, eliminado:new Date(t.ts).toLocaleString('es-MX')}; }));
  if(!opts.sinConfirm && typeof confirm==='function' && !confirm('¿Restaurar '+candidatos.length+' movimiento(s) eliminado(s)? Se re-insertarán en Contabilidad tal como estaban antes de borrarse.')){
    console.log('[reconciliar] Cancelado por el usuario.'); return;
  }
  if(!Array.isArray(D.movimientos)) D.movimientos = [];
  var idsRestaurados = {};
  candidatos.forEach(function(t){
    idsRestaurados[t.id] = true;
    var yaExiste = D.movimientos.some(function(m){ return m && m.id === t.id; });
    if(!yaExiste){
      var copia = Object.assign({}, t);
      delete copia.ts; delete copia._snapshotCompleto;
      D.movimientos.push(copia);
      _auditoriaRegistrar('restaurado', copia, {origen:'reconciliarDeshacerUltimo'});
    }
  });
  D.movimientos_eliminados = D.movimientos_eliminados.filter(function(t){ return !idsRestaurados[t.id]; });
  try {
    if(typeof syncEstadoSupabase==='function'){ if(typeof _ultimoSyncPropio!=='undefined') _ultimoSyncPropio=Date.now(); await syncEstadoSupabase(); }
  } catch(e){ console.warn('[reconciliar] sync', e); }
  ['renderContab','renderCaja','renderHistorial','badges'].forEach(function(fn){ if(typeof window[fn]==='function'){ try{ window[fn](); }catch(e){} } });
  console.log('%c✅ '+candidatos.length+' movimiento(s) restaurado(s).','color:#1a7a3a;font-weight:bold');
  if(typeof toast==='function') toast('✅ '+candidatos.length+' movimiento(s) restaurado(s)','ok');
  if(typeof _lexPush==='function'){
    _lexPush('info','admin.reconciliar.deshacer', candidatos.length+' movimiento(s) restaurado(s) por admin: '+candidatos.map(function(t){return t.id;}).join(', '), null, {ids: candidatos.map(function(t){return t.id;})});
  }
  return { restaurados: candidatos.map(function(t){ return t.id; }) };
}

async function syncEstadoSupabase(_intentoConcurrencia){
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  // Prevenir llamadas concurrentes — si ya hay una en curso, usar debounce
  if(_syncEnCurso) {
    clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(()=>{ syncEstadoSupabase().catch((e)=>{ registrarError('Promise catch vacio', e); }); }, 500);
    return;
  }
  _syncEnCurso = true;
  syncStart();
  // ── Protección: restaurar movimientos de recibo perdidos antes de persistir ──
  _protegerMovimientosRecibo();
  try {
    // Limpiar movimientos sintéticos antes de persistir
    // + excluir movimientos con tombstone (eliminados de forma duradera por reconciliación)
    const _movTombLocal = new Set((Array.isArray(D.movimientos_eliminados) ? D.movimientos_eliminados : []).map(function(t){ return t && t.id; }));
    const movsLimpios = (D.movimientos||[]).filter(m => m && m.id && !/^R-\d+$/.test(m.id) && !_movTombLocal.has(m.id));
    // Filtrar pendientes de placas liquidados antes de subir a Supabase
    const _pendientesSinLiquidados = (D.pendientes || []).filter(function(p){
      if(p.seccion !== 'placas' || !p.reciboVinculadoFolio) return true;
      var _versSave = (appData.recibos||[]).filter(function(r){ return Number(r.folio) === Number(p.reciboVinculadoFolio); });
      var saldo = _versSave.reduce(function(m,r){
        var s=parseFloat(r.saldoPendiente); if(!isNaN(s)) return Math.min(m,s);
        var sn=parseFloat(r.saldoNuevo);   if(!isNaN(sn)) return Math.min(m,sn);
        if(r.liquidado===true) return Math.min(m,0);
        return m;
      }, Infinity);
      return _versSave.length > 0 && !_versSave.some(function(r){return r.cancelado;}) && (saldo > 0);
    });
    const estado = {
      movimientos:           movsLimpios,
      movimientos_eliminados: (Array.isArray(D.movimientos_eliminados) ? D.movimientos_eliminados : []),
      directorio:            D.directorio            || [],
      carpetas:              D.carpetas              || [],
      juicios:               D.juicios               || [],
      gestiones:             D.gestiones             || [],
      pendientes:            _pendientesSinLiquidados,
      citas:                 D.citas                 || [],
      cierres:               D.cierres               || [],
      prestamos:             D.prestamos             || [],
      saldoAcumulado:        D.saldoAcumulado        || 0,
      escrituras:            D.escrituras            || [],
      recibosExcluidosCaja:  D.recibosExcluidosCaja  || [],
      cortesDeshabilitados:  D.cortesDeshabilitados  || [],
      preRecibos:            D.preRecibos            || [],
      leyes:                 D.leyes                 || [],
      captura_meses:         capturaMesCargar() || D.captura_meses || {},
      retro_global:          window._retroGlobalActivo !== undefined
                             ? { activo: !!window._retroGlobalActivo }
                             : (D.retro_global || null),
      tiempoExtra:           D.tiempoExtra           || {},
      _juiciosModTs:         D._juiciosModTs         || 0
    };
    // ── Sellar recibos activos contra tombstones remotos obsoletos ──────────────
    // Recibos sin _revivedTs son vulnerables a tombstones históricos de SB.
    // Darles _revivedTs = ahora los protege contra tombstones obsoletos.
    // EXCEPCIÓN: no sellar recibos que ya tienen tombstone local (admin los eliminó).
    var _ahoraSync = Date.now();
    (appData.recibos||[]).forEach(function(r){
      if(!r || r._revivedTs) return;
      var tieneLocTombSync = (appData.folios_eliminados||[]).some(function(t){
        return String(t.folio)===String(r.folio) && (t.letra||'A')===(r.letra||'A');
      });
      if(!tieneLocTombSync) r._revivedTs = _ahoraSync;
    });
    // ── Protección multi-usuario: leer tombstones de SB antes de escribir ──────
    // Si este browser aún no tiene los tombstones del admin (ej: empleada que no ha
    // sincronizado), su save() sobreescribiría folios_eliminados con [] y restauraría
    // los folios eliminados. Igual que actualizarArchivoControl(), se fusionan los
    // tombstones de SB antes de construir el objeto que se va a subir.
    // ── Control de concurrencia optimista (fix corrupción 28/jul, incidente #2) ──
    // syncEstadoSupabase() sobreescribe TODA la columna recibos/data en un solo
    // UPDATE. Si dos sesiones (ej. el usuario y su empleada) leen el mismo estado
    // y ambas escriben casi al mismo tiempo, la segunda escritura pisaba
    // silenciosamente lo que la primera acababa de guardar (perdiendo datos reales,
    // no solo duplicándolos). rev es un contador que la BD incrementa sola en cada
    // UPDATE (trigger app_state_bump_rev). Aquí se lee la rev actual ANTES de
    // fusionar/escribir, y el UPDATE de abajo solo se aplica si esa rev sigue
    // siendo la misma al momento de escribir — si alguien más ya escribió en medio,
    // el UPDATE afecta 0 filas y se reintenta desde cero (releer+fusionar+escribir)
    // en vez de sobrescribir a ciegas.
    let _revPreSync = null;
    try {
      const { data: _sbPreSync } = await _sbConTimeout(window.SB
        .from('app_state').select('recibos, data, rev')
        .eq('despacho_id', window.SB_DESPACHO_ID).maybeSingle(), 10000, 'pre-lectura estado');
      _revPreSync = (_sbPreSync && typeof _sbPreSync.rev === 'number') ? _sbPreSync.rev : null;
      const _sbTombsPreSync = (_sbPreSync && _sbPreSync.recibos && _sbPreSync.recibos.folios_eliminados) || [];
      const _sbRecibosPreSync = (_sbPreSync && _sbPreSync.recibos && Array.isArray(_sbPreSync.recibos.recibos)) ? _sbPreSync.recibos.recibos : [];
      // Fusionar tombstones
      if (_sbTombsPreSync.length > 0) {
        if (!Array.isArray(appData.folios_eliminados)) appData.folios_eliminados = [];
        _sbTombsPreSync.forEach(function(t){
          if(!appData.folios_eliminados.some(function(x){
            return String(x.folio)===String(t.folio) && x.letra===t.letra;
          })) appData.folios_eliminados.push(t);
        });
        // Restauraciones explícitas ganan sobre tombstones recién fusionados
        (appData.recibos||[]).forEach(function(r){
          if(!r.esRestaurado) return;
          appData.folios_eliminados = appData.folios_eliminados.filter(function(t){
            return !(String(t.folio)===String(r.folio) && t.letra===(r.letra||'A'));
          });
        });
        // Supersesión por timestamp: purgar tombstones superados por recibos revividos
        if (typeof _purgarTombstonesSuperados === 'function') {
          appData.folios_eliminados = _purgarTombstonesSuperados(appData.folios_eliminados, appData.recibos);
        }
        // En rescate (actualizarArchivoControl() falló), _folioGuardandose sigue activo.
        // Proteger el folio en curso para que el tombstone de SB no lo elimine aquí.
        if (window._folioGuardandose != null) {
          appData.folios_eliminados = (appData.folios_eliminados||[]).filter(function(t){
            return !(String(t.folio)===String(window._folioGuardandose) && t.letra===(window._letraGuardandose||'A'));
          });
        }
      }
      // Fusionar recibos de SB con los locales: conservar recibos que solo están en un lado
      if (_sbRecibosPreSync.length > 0) {
        const _mapaLocal = {};
        (appData.recibos||[]).forEach(function(r){ if(r) _mapaLocal[r.folio+'|'+(r.letra||'A')] = r; });
        const _mapaSB = {};
        _sbRecibosPreSync.forEach(function(r){ if(r) _mapaSB[r.folio+'|'+(r.letra||'A')] = r; });
        const _claves = new Set([...Object.keys(_mapaSB), ...Object.keys(_mapaLocal)]);
        // BUG RAÍZ (Gestor de Folios): si el Gestor de Folios acaba de renumerar/
        // eliminar un folio, la clave vieja (ej. "74|A") desaparece de local a
        // propósito, pero SB (leído arriba, antes de escribir la renumeración)
        // todavía la tiene. Sin este chequeo, la línea de abajo la trae de vuelta
        // asumiendo que "solo existe en un lado" — resucitando el folio que se
        // acababa de liberar. window._gfClavesVacadasTemporal marca esas claves
        // para que NO se resuciten aquí.
        const _clavesVaciadas = (typeof window !== 'undefined' && window._gfClavesVacadasTemporal) || null;
        const _merged = [];
        _claves.forEach(function(k){
          if(!_mapaLocal[k] && _clavesVaciadas && _clavesVaciadas.has(k)) return; // vaciado a propósito — no resucitar
          // Local gana sobre SB (tiene datos más frescos como pdfBase64, costosExtra, etc.)
          _merged.push(_mapaLocal[k] || _mapaSB[k]);
        });
        appData.recibos = _merged;
      }
      // Aplicar tombstones al resultado fusionado (con supersesión: los recibos
      // revividos después de la eliminación NO se filtran)
      appData.recibos = (appData.recibos||[]).filter(function(r){
        return !( appData.folios_eliminados||[]).some(function(t){
          return typeof _tombstoneAplicaA === 'function'
            ? _tombstoneAplicaA(t, r)
            : (String(t.folio)===String(r.folio) && t.letra===(r.letra||'A'));
        });
      });
      // ── Fusionar MOVIMIENTOS de recibo de SB con los locales ──────────────────
      // Cierra la fuga en la fuente: un movimiento de recibo creado en un cliente
      // (ej. liquidación 3B) ya NO se pierde si otro cliente sube un data.movimientos
      // más viejo. Unión por id SOLO para fuente 'recibo', respetando folios excluidos
      // y recibos vivos (tombstones), con dedup lógico final. Los movimientos NO-recibo
      // (caja/retiro/manual) conservan su semántica local (último que escribe gana),
      // para no romper sus borrados, que no tienen recibo de respaldo.
      try {
        const _sbMovs = (_sbPreSync && _sbPreSync.data && Array.isArray(_sbPreSync.data.movimientos)) ? _sbPreSync.data.movimientos : [];
        // ── Tombstones de movimientos: unión de los de SB y los locales ───────────
        // Igual que folios_eliminados pero para movimientos. Garantiza que un
        // movimiento eliminado por reconciliación NO regrese desde otro dispositivo.
        const _sbMovTombs = (_sbPreSync && _sbPreSync.data && Array.isArray(_sbPreSync.data.movimientos_eliminados)) ? _sbPreSync.data.movimientos_eliminados : [];
        if(!Array.isArray(D.movimientos_eliminados)) D.movimientos_eliminados = [];
        _sbMovTombs.forEach(function(t){
          if(t && t.id && !D.movimientos_eliminados.some(function(x){ return x.id === t.id; }))
            D.movimientos_eliminados.push(t);
        });
        const _movTombSet = new Set(D.movimientos_eliminados.map(function(t){ return t && t.id; }));
        if (_sbMovs.length > 0) {
          const _exclMov = new Set((D.recibosExcluidosCaja||[]).map(String));
          // Folios vivos tras aplicar tombstones (cualquier letra cuenta como folio vivo)
          const _foliosVivos = new Set((appData.recibos||[]).map(function(r){ return String(r.folio); }));
          const _esReciboVivo = function(m){
            if(!m || m.fuente !== 'recibo' || m.folio == null) return false;
            if(_exclMov.has(String(m.folio))) return false;      // folio excluido de caja
            if(!_foliosVivos.has(String(m.folio))) return false; // folio borrado (tombstone)
            return true;
          };
          const _logKey = function(m){
            return String(m.folio)+'|'+(m.letra||'A')+'|'+(m.fecha||'')+'|'+((m.hora||'').slice(0,5))+'|'+(parseFloat(m.monto)||0)+'|'+(m.estatus||'');
          };
          const _movsRecLocal = movsLimpios.filter(function(m){ return m && m.fuente === 'recibo'; });
          const _movsNoRec     = movsLimpios.filter(function(m){ return !m || m.fuente !== 'recibo'; });
          // ── Recuperar MOVIMIENTOS NO-recibo (caja/retiro/manual) que solo existen en SB ──
          // FIX (caso real: folio 1006, empleada registró 3 movimientos, el Monitor
          // confirmó "creado" en la bitácora de auditoría, pero solo 2 aparecían en
          // Movimientos de Hoy/Contabilidad). Causa raíz: este bloque solo recuperaba
          // movimientos de RECIBO huérfanos en Supabase; los de caja/manual usaban
          // "último que escribe gana" sin fusión — si la sesión que creó el movimiento
          // lo subía a Supabase con éxito, pero justo después OTRA sesión (con
          // D.movimientos desactualizado, sin ese movimiento nuevo) hacía su propio
          // push, el segundo push sobrescribía el array completo y lo borraba, aunque
          // ya estuviera auditado como "creado". Se aplica la misma receta que ya
          // funciona para recibos: cualquier movimiento no-recibo que exista en el
          // Supabase recién leído (_sbMovs) pero no en la memoria local, se recupera,
          // salvo que tenga lápida (tombstone) o se haya borrado/editado en ESTA
          // sesión hace menos de 15s (misma ventana de gracia que ya usa
          // sincronizarFolio() al bajar datos).
          const _VENTANA_RECUP_NOREC_MS = 15000;
          const _delsRecientesLocal = window._movsEliminadosRecientemente || {};
          Object.keys(_delsRecientesLocal).forEach(function(id){
            if(Date.now() - _delsRecientesLocal[id] > _VENTANA_RECUP_NOREC_MS) delete _delsRecientesLocal[id];
          });
          const _localNoRecIds = new Set(_movsNoRec.filter(function(m){ return m && m.id; }).map(function(m){ return m.id; }));
          const _recuperadosNoRecSB = [];
          _sbMovs.forEach(function(m){
            if(!m || m.fuente === 'recibo' || !m.id) return;
            if(_movTombSet.has(m.id)) return;            // lápida permanente — no resucitar
            if(_localNoRecIds.has(m.id)) return;          // ya está local (local gana)
            if(_delsRecientesLocal[m.id]) return;         // borrado en esta sesión hace <15s
            _recuperadosNoRecSB.push(m);
          });
          if(_recuperadosNoRecSB.length){
            _movsNoRec.push.apply(_movsNoRec, _recuperadosNoRecSB);
            _recuperadosNoRecSB.forEach(function(m){
              if(!D.movimientos.some(function(x){ return x && x.id === m.id; })) D.movimientos.push(m);
            });
            console.warn('[SB] 🔁 Movimientos NO-recibo recuperados de SB en el merge (fix folio 1006): ' +
              _recuperadosNoRecSB.length + ' — ' + _recuperadosNoRecSB.map(function(m){ return (m.descripcion||m.id)+' $'+m.monto; }).join(', '));
          }
          const _localIds  = new Set(_movsRecLocal.map(function(m){ return m.id; }));
          const _localKeys = new Set(_movsRecLocal.map(_logKey));
          // Movimientos de recibo que SOLO existen en SB y siguen vivos → recuperarlos
          const _recuperadosSB = [];
          _sbMovs.forEach(function(m){
            if(!m || m.fuente !== 'recibo' || !m.id) return;
            if(/^R-\d+$/.test(m.id)) return;          // sintético, no persistente
            if(_movTombSet.has(m.id)) return;         // tombstone: eliminado de forma duradera
            if(_localIds.has(m.id)) return;           // ya está local (local gana)
            if(!_esReciboVivo(m)) return;             // excluido o folio borrado
            if(_localKeys.has(_logKey(m))) return;    // duplicado lógico → no traer
            _localKeys.add(_logKey(m));
            _recuperadosSB.push(m);
          });
          // Conjunto a persistir: no-recibo (local) + recibo local vivo NO tombstoneado + recuperados de SB
          const _movsRecVivos = _movsRecLocal.filter(function(m){ return _esReciboVivo(m) && !_movTombSet.has(m.id); });
          // ⚠️ FIX (26-ago-2026 — 188 movimientos duplicados en TODA la contabilidad,
          // reaparecidos tras limpiarlos en la base de datos): esta función confiaba en
          // que D.movimientos ya llegara sin duplicados. Si la memoria de ESTA pestaña
          // ya traía duplicados (por la corrupción original, una fusión previa, u otra
          // pestaña vieja abierta), cada sync los volvía a subir tal cual y PISABA la
          // limpieza hecha directamente en Supabase — de ahí "desapareció un momento y
          // volvió a duplicarse". Ahora se deduplica (por id, y si no hay id por clave
          // folio+letra+fecha+hora+monto+estatus) justo antes de subir, sin importar
          // qué tan sucia venga la memoria local.
          const _dedupVistoIds  = new Set();
          const _dedupVistoKeys = new Set();
          const _movsRecVivosDedup = _movsRecVivos.filter(function(m){
            if(!m) return false;
            if(m.id){
              if(_dedupVistoIds.has(m.id)) return false;
              _dedupVistoIds.add(m.id);
            }
            const k = _logKey(m);
            if(_dedupVistoKeys.has(k)) return false;
            _dedupVistoKeys.add(k);
            return true;
          });
          if(_movsRecVivosDedup.length < _movsRecVivos.length){
            console.warn('[SB] ⚠ Duplicados detectados en memoria local antes de subir — se excluyeron ' +
              (_movsRecVivos.length - _movsRecVivosDedup.length) + ' movimiento(s) de recibo duplicado(s).');
          }
          estado.movimientos = _movsNoRec.concat(_movsRecVivosDedup, _recuperadosSB);
          // ⚠️ FIX (caso real: folio 88A tras editar): este bloque solo limpiaba
          // duplicados/tombstoneados en "estado.movimientos" (lo que se SUBE a
          // Supabase), pero nunca los quitaba de D.movimientos (la memoria local
          // que usan ScanSys/Contabilidad/Caja para renderizar YA). Resultado: el
          // servidor quedaba correcto de inmediato, pero en pantalla se seguía
          // viendo el duplicado hasta que algo más (ej. el polling de respaldo)
          // recargaba todo desde SB — de ahí el "aparece duplicado y luego se
          // arregla solo". Ahora se aplica el mismo filtro también en memoria,
          // incluyendo los duplicados lógicos detectados arriba.
          const _idsDuplicadosLocal = new Set(
            _movsRecVivos.filter(function(m){ return _movsRecVivosDedup.indexOf(m) === -1; })
                         .map(function(m){ return m && m.id; }).filter(Boolean)
          );
          D.movimientos = D.movimientos.filter(function(m){
            if(!m || !m.id) return true;
            if(m.fuente !== 'recibo') return true; // no tocar caja/retiro/manual
            if(_movTombSet.has(m.id)) return false; // tombstoneado — quitar ya
            if(!_esReciboVivo(m)) return false;     // folio excluido/borrado
            if(_idsDuplicadosLocal.has(m.id)) return false; // duplicado lógico detectado antes de subir
            return true;
          });
          // Reflejar SOLO lo recuperado en memoria local (no perder sintéticos ni no-recibo)
          if(_recuperadosSB.length){
            _recuperadosSB.forEach(function(m){ D.movimientos.push(m); });
            console.warn('[SB] 🔁 Movimientos de recibo recuperados de SB en el merge: ' +
              _recuperadosSB.length + ' — ' + _recuperadosSB.map(function(m){ return m.folio+(m.letra||'')+' $'+m.monto; }).join(', '));
          }
        }
      } catch(_eMovMerge){ console.warn('[SB] merge movimientos:', _eMovMerge); }
    } catch(_ePreSync){ /* fallo silencioso — se usarán datos locales */ }
    const recibos = {
      folioActual:       (typeof REC !== 'undefined' && REC.folioActual) ? REC.folioActual : (appData.folioActual || 100),
      anioFolioActual:   (appData.anioFolioActual || new Date().getFullYear()),
      folios_eliminados: appData.folios_eliminados || [],
      recibos:           (appData.recibos || []).filter(function(r){ return !(appData.folios_eliminados||[]).some(function(t){ return typeof _tombstoneAplicaA === 'function' ? _tombstoneAplicaA(t, r) : (String(t.folio)===String(r.folio) && t.letra===(r.letra||'A')); }); }).map(function(r){ var c=Object.assign({},r); delete c.pdfBase64; return c; })
    };
    // Ids que van dentro de ESTA subida — para limpiar del respaldo local
    // (ver "RESPALDO LOCAL DE MOVIMIENTOS" en receipt-restoration.js) solo lo
    // que de verdad quedó confirmado ahora, sin tocar algo agregado a
    // D.movimientos mientras esta subida ya estaba en curso.
    const _idsSubidosEstaVez = (estado.movimientos||[]).map(function(m){ return m && m.id; }).filter(Boolean);
    let _updBySy = null;
    try { _updBySy = (await Promise.race([window.SB.auth.getUser(), new Promise((_,rj)=>setTimeout(()=>rj(new Error('getUser timeout')),4000))])).data?.user?.id || null; } catch(_egu){}
    // ── Escritura condicionada a rev (optimistic concurrency) ──────────────────
    // Si _revPreSync se pudo leer, el UPDATE solo aplica si la fila SIGUE en esa
    // misma rev. Si otra sesión ya escribió en medio (rev cambió), el trigger de
    // BD ya subió la rev real y este .eq('rev', _revPreSync) no matchea ninguna
    // fila → 0 filas afectadas → detectamos el choque y reintentamos desde cero
    // en vez de sobrescribir ciegamente lo que la otra sesión acaba de guardar.
    let _updQuery = window.SB.from('app_state').update({
      data:         estado,
      recibos:      recibos,
      folio_actual: recibos.folioActual,
      updated_by:   _updBySy
    }).eq('despacho_id', window.SB_DESPACHO_ID);
    if (_revPreSync !== null) _updQuery = _updQuery.eq('rev', _revPreSync);
    const { data: _updRows, error } = await _sbConTimeout(_updQuery.select('rev'), 30000, 'subida de estado');
    if(error){
      throw new Error('syncEstadoSupabase: '+error.message);
    }
    if (_revPreSync !== null && (!_updRows || _updRows.length === 0)) {
      _syncEnCurso = false;
      const _intento = (typeof _intentoConcurrencia === 'number') ? _intentoConcurrencia : 0;
      if (_intento < 5) {
        // FIX: esto NO es un error real — es la protección de concurrencia
        // funcionando exactamente como debe (detecta que otra sesión guardó
        // primero y reintenta solo). Se usa console.log (no console.warn)
        // para que no se cuente ni aparezca en "Errores del Sistema": ese
        // conteo debe reflejar problemas reales, no reintentos normales.
        console.log('[SB] 🔁 Choque de concurrencia (rev '+_revPreSync+' ya no vigente) — otra sesión guardó al mismo tiempo. Reintentando ('+(_intento+1)+'/5)...');
        syncEnd(false, 'Sincronizando (detectado guardado simultáneo, reintentando)…');
        await new Promise(function(res){ setTimeout(res, 300 + Math.random()*500); });
        return syncEstadoSupabase(_intento + 1);
      } else {
        console.error('[SB] ❌ Choque de concurrencia persistente tras 5 intentos — se aborta este guardado para no pisar datos de otra sesión.');
        syncEnd(false, 'No se pudo guardar: otra sesión sigue guardando al mismo tiempo. Reintenta en unos segundos.');
        return;
      }
    }
    _driveTimestampAlCargar = Date.now();
    _ultimoSyncPropio = Date.now();
    _syncEnCurso = false;
    syncEnd(true);
    try { if(typeof _pendMovsLimpiar === 'function') _pendMovsLimpiar(_idsSubidosEstaVez); } catch(_ePend){}
    lexRealtimeBroadcast();
    // Re-renderizar UI propia después de guardar exitosamente
    try { if(typeof renderCaja       ==='function') renderCaja();       } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof renderContab     ==='function') renderContab();     } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof renderHistorial  ==='function') renderHistorial();  } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof renderPend       ==='function') renderPend();       } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof renderVencimientos==='function') renderVencimientos(); } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof hjRenderTerminos ==='function') hjRenderTerminos(); } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof hjRenderLista    ==='function') hjRenderLista();    } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof badges           ==='function') badges();           } catch(e){ registrarError('catch vacio', e); }
  } catch(e){
    console.warn('[SB] syncEstadoSupabase:', e);
    _syncEnCurso = false;
    syncEnd(false, e.message || 'Error al sincronizar');
  }
}

function _realtimeSincronizar() {
  // Si hay sync propio en curso o fue reciente — esperar
  if (_syncEnCurso) {
    setTimeout(_realtimeSincronizar, 2000);
    return;
  }
  if ((Date.now() - (_ultimoSyncPropio||0)) < 30000) {
    console.log('[Realtime] Ignorando sincronizarFolio — sync propio muy reciente (< 30s)');
    // Solo re-renderizar con datos en memoria, sin bajar de Supabase
    if (typeof renderCaja    === 'function') renderCaja();
    if (typeof renderContab  === 'function') renderContab();
    if (typeof badges        === 'function') badges();
    return;
  }
  console.log('[Realtime] Sincronizando desde otro usuario — confiando 100% en Supabase...');
  sincronizarFolio(true).then(function() {
    if (typeof renderHistorial   === 'function') renderHistorial();
    if (typeof renderCaja        === 'function') renderCaja();
    if (typeof renderContab      === 'function') renderContab();
    if (typeof badges            === 'function') badges();
    if (typeof hjRenderTerminos  === 'function') try { hjRenderTerminos(); } catch(e){ registrarError('catch vacio', e); }
    if (typeof hjRenderLista     === 'function') try { hjRenderLista(); } catch(e){ registrarError('catch vacio', e); }
    if (typeof renderVencimientos=== 'function') safeExec('renderVencimientos', () => renderVencimientos());
  }).catch(function(e){ registrarError('Promise catch vacio', e); });
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
    'eliminarRecDuplicados': '🔁 Eliminar Recibos Duplicados',
    'repararFolios': '🔢 Reparar Numeración de Folios',
    'corte': '🔒 Corte de Caja',
    'restaurarFlujoContable': '🔍 Analizar Folio por Folio',
    'limpiarDupContab': '🗂 Duplicados Contabilidad'
  };
  return nombres[accion] || accion;
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

function formatearFechaContabilidad(fechaISO){
  const dias  = ["DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO"];
  const meses = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
  const f = new Date(fechaISO + "T12:00:00");
  return `${dias[f.getDay()]} ${String(f.getDate()).padStart(2,"0")} ${meses[f.getMonth()]} ${f.getFullYear()}`;
}

async function cerrarCajaAutomatico(fechaObjetivo) {
  // fechaObjetivo es la fecha (YYYY-MM-DD, hora CDMX) que el SERVIDOR detectó
  // como pendiente de cierre — ver columna app_state.caja_auto_cierre_fecha.
  // Antes esta función siempre usaba hoy() sin importar qué día había
  // quedado pendiente: si un viernes/domingo nadie tenía el sistema abierto
  // a las 5:30 p.m., el aviso se quedaba esperando, y en cuanto alguien
  // abría el sistema — aunque fuera lunes en la mañana — se cerraba la caja
  // de ESE día (el que se acababa de abrir) en vez del día realmente
  // atrasado. Ahora se cierra el día correcto, y "hoy" solo se bloquea si de
  // verdad es el día que corresponde cerrar.
  const fechaCierre = fechaObjetivo || hoy();
  const esHoy = fechaCierre === hoy();
  if (esHoy && cajaBloqueada()) return;
  // Defensa extra: si ya existe un cierre para esa fecha (otro cliente se
  // adelantó, o se cerró manualmente mientras tanto), no duplicar — solo
  // limpiar la bandera pendiente.
  if ((D.cierres || []).some(c => c && c.fecha === fechaCierre)) {
    try {
      if (window.SB && window.SB_DESPACHO_ID) {
        await window.SB.from('app_state')
          .update({ caja_auto_cierre_pendiente: false, caja_auto_cierre_fecha: null })
          .eq('despacho_id', window.SB_DESPACHO_ID);
      }
    } catch(e) { registrarError('cerrarCajaAutomatico: limpiar bandera (ya existía)', e); }
    return;
  }
  const m = getMovHoy(fechaCierre);
  if (!m.length) {
    const cierreSM = {
      fecha: fechaCierre, hora: hora(),
      ingresos: 0, egresos: 0, saldo: 0,
      movimientos: 0,
      sinMovimientos: true,
      automatico: true,
      leyenda: 'Sin movimientos contables durante la jornada'
    };
    if (!D.cierres) D.cierres = [];
    D.cierres.unshift(cierreSM);
    if (!D.saldoAcumulado) D.saldoAcumulado = 0;
  } else {
    const ing  = m.filter(x => x.tipo === 'ingreso').reduce((s,x) => s + x.monto, 0);
    const egr  = m.filter(x => x.tipo === 'egreso').reduce((s,x)  => s + x.monto, 0);
    const saldo = ing - egr;
    const cierre = { fecha: fechaCierre, hora: hora(), ingresos: ing, egresos: egr, saldo, movimientos: m.length, automatico: true };
    D.cierres.unshift(cierre);
    if (!D.saldoAcumulado) D.saldoAcumulado = 0;
    D.saldoAcumulado += saldo;
  }
  // Solo se bloquea la caja de HOY si la fecha pendiente de verdad es hoy —
  // si se está poniendo al corriente un día atrasado, hoy se queda libre.
  if (esHoy) marcarCajaCerrada();
  save();
  aplicarEstadoCierre();
  toast(esHoy
    ? '🔒 Caja cerrada automáticamente — horario laboral concluido (5:30 p.m.)'
    : '📅 Se registró el cierre pendiente del ' + fechaCierre + ' (nadie tuvo el sistema abierto esa tarde) — hoy sigue disponible con normalidad.');
  syncEstadoSupabaseDebounced();
  // Avisar a Supabase que ya se atendió — limpia la bandera para no repetirlo.
  try {
    if (window.SB && window.SB_DESPACHO_ID) {
      await window.SB.from('app_state')
        .update({ caja_auto_cierre_pendiente: false, caja_auto_cierre_fecha: null })
        .eq('despacho_id', window.SB_DESPACHO_ID);
    }
  } catch(e) { registrarError('cerrarCajaAutomatico: limpiar bandera', e); }
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

async function sincronizarTodoAhora() {
  if (!tokenOk()) { toast('Conecta tu sesión primero', 'err'); return; }
  syncErrorCount = 0;
  if (!syncQueue.length) { toast('No hay pendientes ✓'); return; }
  toast(`Sincronizando ${syncQueue.length} movimientos...`);
  const lista = [...syncQueue]; syncQueue = [];
  for (const mov of lista) { await syncMovimientoASheets(mov); await new Promise(r => setTimeout(r, 500)); }
  toast('Sincronización completa ✓');
}

function abrirFichaDesdeContab(numFolio){
  if(typeof ir==='function') ir('nuevo-recibo');
  document.body.classList.add('modo-consulta');
  if(typeof abrirFolioPBC==='function') abrirFolioPBC(numFolio, false);
}

async function abrirPreviaDesdeContab(numFolio, letra){
  const overlay = document.getElementById('contab-pdf-overlay');
  const embed   = document.getElementById('cpdf-embed');
  const loading = document.getElementById('cpdf-loading');
  const msg     = document.getElementById('cpdf-msg');
  const folioEl = document.getElementById('cpdf-folio');
  const nombreEl= document.getElementById('cpdf-nombre');
  const estadoEl= document.getElementById('cpdf-estado');
  if(!overlay || !embed || !loading) { console.warn('[contabPDF] Overlay no encontrado en DOM'); return; }
  // Buscar la versión exacta (letra A, B, C…) combinando ambas fuentes
  const _arr1 = (typeof appData!=='undefined' && appData.recibos) ? appData.recibos : [];
  const _arr2 = (typeof REC!=='undefined' && REC.recibos) ? REC.recibos : [];
  const recibos = _arr1.length ? _arr1 : _arr2; // para uso posterior en fuente de datos
  // appData.recibos es la fuente autoritativa (se limpia correctamente al eliminar
  // un folio) — sus entradas deben ganar sobre REC.recibos si ambas traen el mismo
  // folio+letra. Antes REC.recibos ganaba por ir después en el spread, lo que podía
  // mostrar/reutilizar una copia vieja de REC.recibos que ya no existía en appData
  // (REC no siempre se re-sincroniza en todos los flujos de creación/edición).
  const _todosRecibosRaw = [...new Map(
    [..._arr2, ..._arr1]
      .filter(x => x && x.folio != null)
      .map(x => [x.folio + '|' + (x.letra || letraVersion(x) || 'A'), x])
  ).values()];
  // Respetar tombstones: un folio eliminado no debe poder verse/regenerarse aquí
  // aunque quede una copia rezagada en REC.recibos — misma regla que usa el resto
  // del sistema (_tombstoneAplicaA respeta _revivedTs si el folio fue recreado
  // legítimamente después de haberse eliminado).
  const _tombsPrevCPDF = (typeof appData!=='undefined' && Array.isArray(appData.folios_eliminados)) ? appData.folios_eliminados : [];
  const _todosRecibos = _todosRecibosRaw.filter(function(x){
    var _tApl = _tombsPrevCPDF.some(function(t){ return typeof _tombstoneAplicaA==='function' && _tombstoneAplicaA(t, x); });
    return !_tApl;
  });
  const letraBuscar = letra || 'A';
  // Buscar primero la version exacta (letra B, C, etc.)
  // Si no existe como recibo, usar A como base de datos para regenerar PDF
  let r = _todosRecibos.find(x=>
    (x.folio===numFolio||x.folio===parseInt(numFolio)) &&
    (x.letra || letraVersion(x) || 'A') === letraBuscar
  );
  if(!r && letraBuscar !== 'A'){
    r = _todosRecibos.find(x=>
      (x.folio===numFolio||x.folio===parseInt(numFolio)) &&
      !x.esComplemento &&
      (x.letra || letraVersion(x) || 'A') === 'A'
    );
    if(r) r = Object.assign({}, r, { letra: letraBuscar, pdfBase64: null, archivoR2: null, archivo: null });
  }
  if(!r){ toast('Recibo #'+folioFormato(numFolio)+' no encontrado','err'); return; }
  // Mostrar overlay con estado de carga
  overlay.style.display='flex';
  loading.style.display='flex';
  embed.setAttribute('src','');
  folioEl.textContent = 'FOLIO #'+folioConLetra(r.folio, r.anio_folio, r.letra||letraVersion(r)||'A');
  nombreEl.textContent = r.nombre||'—';
  const saldo = r.saldoPendiente||0;
  estadoEl.innerHTML = saldo>0
    ? '<span style="background:rgba(200,149,42,0.15);color:#e8c875;border:1px solid rgba(200,149,42,0.3);border-radius:4px;padding:2px 8px;font-family:JetBrains Mono,monospace;font-size:0.6rem;">PENDIENTE $'+fmt(saldo)+'</span>'
    : '<span style="background:rgba(40,180,80,0.15);color:#4dca6a;border:1px solid rgba(40,180,80,0.3);border-radius:4px;padding:2px 8px;font-family:JetBrains Mono,monospace;font-size:0.6rem;">&#10003; LIQUIDADO</span>';
  try{
    if(!r.clientes && !r.nombre){ if(msg) msg.textContent='Sin datos suficientes para generar el PDF'; if(loading) loading.style.display='none'; return; }
    // ── 1. PDF original en sesión — solo si es un PDF base64 válido ──
    if(r.pdfBase64 && r.pdfBase64.startsWith('data:application/pdf')){
      embed.setAttribute('src', r.pdfBase64);
      loading.style.display='none';
      return;
    }
    // ── 2. Jalar PDF directo de R2 — fuente de verdad ──
    if(window.SB_DESPACHO_ID && typeof window.descargarR2 === 'function'){
      try{
        if(msg) msg.textContent='Cargando PDF desde R2...';
        const _letraR2  = (r.letra || letraVersion(r) || 'A').toUpperCase();
        const _folioStr = folioFormato ? folioFormato(r.folio, r.anio_folio) : String(r.folio).padStart(3,'0');

        // Helper: descarga y valida que el blob sea un PDF real (%PDF)
        const _bajarPdfR2 = async function(path){
          if(!path) return null;
          const b = await window.descargarR2(path, 'recibos', true);
          if(!b || b.size < 100) return null;
          if(!(b.type.includes('pdf') || b.type === 'application/octet-stream' || b.type === '')) return null;
          const a = await b.slice(0,4).arrayBuffer();
          return String.fromCharCode(...new Uint8Array(a)) === '%PDF' ? b : null;
        };

        // Intento 1: ruta directa guardada en el recibo
        let _r2Blob = null;
        const _r2PathDirecto = r.archivoR2Raiz
          ? r.archivoR2Raiz
          : (r.archivoR2 || r.archivo)
            ? window.SB_DESPACHO_ID + '/recibos/' + (r.archivoR2 || r.archivo)
            : null;
        if(_r2PathDirecto) _r2Blob = await _bajarPdfR2(_r2PathDirecto);

        // Intento 2: la ruta directa falló o no existe — buscar listando el bucket.
        // Los PDFs pueden estar bajo {despacho}/recibos/ o en la RAÍZ del bucket,
        // y con tres formatos de nombre: "26-083A.pdf", "Recibo_26-083A_NOMBRE.pdf"
        // o el formato antiguo "Recibo_0083_NOMBRE.pdf".
        if (!_r2Blob && typeof window.listarR2 === 'function') {
          if(msg) msg.textContent='Buscando PDF en R2...';
          const _folioEsc = _folioStr.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
          // Regex formato nuevo: 26-083 + letra (A opcional).
          // IMPORTANTE: el terminador exige frontera NO alfanumérica (lookahead),
          // así "4A?" no puede matchear "4B.pdf"/"4C.pdf" — antes el terminador
          // "[^0-9]" aceptaba CUALQUIER letra ahí, así que buscar la letra A
          // (ausente) encontraba por error el archivo de la letra B u otra.
          const _letraParteRe = _letraR2 === 'A' ? 'A?' : _letraR2;
          const _reNuevo = new RegExp('(^|[^0-9])' + _folioEsc + _letraParteRe + '(?=[^A-Za-z0-9]|$)', 'i');
          // Regex formato antiguo (solo versión A): Recibo_0083_
          const _pad4 = String(parseInt(r.folio)||0).padStart(4,'0');
          const _reViejo = _letraR2 === 'A' ? new RegExp('Recibo_0*' + (parseInt(r.folio)||0) + '_', 'i') : null;
          const _buscarEnLista = function(objs){
            if(!objs || !objs.length) return null;
            let m = objs.find(o => _reNuevo.test((o.key || o.name || '').split('/').pop()));
            if(!m && _reViejo) m = objs.find(o => _reViejo.test((o.key || o.name || '').split('/').pop()));
            return m ? (m.key || m.name || null) : null;
          };
          // 2a) Prefijo del despacho
          let _key = _buscarEnLista(await window.listarR2(window.SB_DESPACHO_ID + '/recibos/', 'recibos'));
          // 2b) Raíz del bucket (archivos históricos sin prefijo)
          if(!_key) _key = _buscarEnLista(await window.listarR2('', 'recibos'));
          if (_key) {
            _r2Blob = await _bajarPdfR2(_key);
            // Reparar la ruta guardada para futuros accesos directos.
            // Si el archivo está en la raíz, guardar marca especial con la ruta completa.
            if (_r2Blob) {
              if (_key.startsWith(window.SB_DESPACHO_ID + '/recibos/')) {
                r.archivoR2 = _key.split('/').pop();
                r.archivo   = r.archivoR2;
              } else {
                r.archivoR2Raiz = _key; // ruta completa en raíz
              }
            }
          }
        }

        if(_r2Blob){
          const _r2Url = URL.createObjectURL(_r2Blob);
          embed.setAttribute('src', _r2Url + '#toolbar=0&navpanes=0');
          loading.style.display='none';
          const _r2Rd = new FileReader();
          _r2Rd.onload = () => { if(!r.pdfBase64) r.pdfBase64 = _r2Rd.result; };
          _r2Rd.readAsDataURL(_r2Blob);
          return;
        }
      }catch(_eR2){ console.warn('[contabPDF] R2:', _eR2); }
    }
    // ── 3. Intentar Supabase Storage por nombre de archivo ──
    if(window.SB && window.SB_DESPACHO_ID && r.archivo){
      try{
        if(msg) msg.textContent='Cargando PDF desde servidor...';
        const _sbPath = window.SB_DESPACHO_ID + '/recibos/' + r.archivo;
        const { data: _sd, error: _se } = await window.SB.storage
          .from(STORAGE_BUCKET).createSignedUrl(_sbPath, 120);
        if(!_se && _sd && _sd.signedUrl){
          const _res = await fetch(_sd.signedUrl);
          if(_res.ok){
            const _blob = await _res.blob();
            // Verificar los primeros bytes: todo PDF empieza con %PDF
            const _arrSB = await _blob.slice(0,4).arrayBuffer();
            const _hdrSB = String.fromCharCode(...new Uint8Array(_arrSB));
            if(_hdrSB === '%PDF'){
              const _url  = URL.createObjectURL(_blob);
              embed.setAttribute('src', _url + '#toolbar=0&navpanes=0');
              loading.style.display='none';
              const _rd = new FileReader();
              _rd.onload = () => { if(!r.pdfBase64) r.pdfBase64 = _rd.result; };
              _rd.readAsDataURL(_blob);
              return;
            }
          }
        }
      }catch(_eSB){ console.warn('[contabPDF] Storage:', _eSB); }
    }
    // ── 3b. Recuperar pdfBase64 desde versiones_recibo en Supabase ──
    if(window.SB && window.SB_DESPACHO_ID){
      try{
        if(msg) msg.textContent = 'Recuperando PDF…';
        const _letraRec = (r.letra || (typeof letraVersion==='function' ? letraVersion(r) : 'A') || 'A').toUpperCase();
        const _anioRec  = r.anio_folio || new Date().getFullYear();
        let _vr = null;
        const { data: _vd1 } = await window.SB
          .from('versiones_recibo')
          .select('datos_completos, pdf_storage_path, letra')
          .eq('despacho_id', window.SB_DESPACHO_ID)
          .eq('folio_base', r.folio)
          .eq('anio_folio', _anioRec)
          .eq('letra', _letraRec)
          .limit(1);
        _vr = (_vd1 && _vd1.length) ? _vd1[0] : null;
        // NOTA: antes había un fallback aquí que, si no existía la fila exacta
        // de esta letra, tomaba CUALQUIER OTRA letra disponible (la más alta,
        // ej. C) y la trataba como si fuera la solicitada — incluso volviendo a
        // subirla a R2 bajo el nombre de la letra pedida (ej. subía el PDF de
        // 4C como "4A.pdf", corrompiéndolo). Se eliminó: si no hay fila exacta,
        // debe caer al paso 4 (regeneración automática con datos reales) en vez
        // de mostrar/guardar el PDF de otra versión con la etiqueta equivocada.
        if(_vr && _vr.datos_completos && _vr.datos_completos.pdfBase64){
          const _b64 = _vr.datos_completos.pdfBase64;
          const _b64d = _b64.includes(',') ? _b64.split(',')[1] : _b64;
          const _bin = atob(_b64d);
          const _buf = new Uint8Array(_bin.length);
          for(let i=0;i<_bin.length;i++) _buf[i]=_bin.charCodeAt(i);
          const _blob = new Blob([_buf],{type:'application/pdf'});
          const _url  = URL.createObjectURL(_blob);
          embed.setAttribute('src', _url + '#toolbar=0&navpanes=0');
          loading.style.display = 'none';
          r.pdfBase64 = _b64;
          // Re-subir a R2 en segundo plano
          const _r2path = _vr.pdf_storage_path
            || (window.SB_DESPACHO_ID + '/recibos/' + (r.archivoR2 || r.archivo || (String(r.folio).padStart(4,'0') + (_vr.letra||'A') + '.pdf')));
          const _f = new File([_blob], _r2path.split('/').pop(), {type:'application/pdf'});
          window.subirR2(_f, _r2path, 'recibos')
            .then(function(ok){ if(ok) console.info('[contabPDF] PDF re-subido a R2:', _r2path); })
            .catch(function(e){ console.warn('[contabPDF] No se pudo re-subir a R2:', e); });
          return;
        }
      }catch(_eVR){ console.warn('[contabPDF] versiones_recibo:', _eVR); }
    }
    // ── 4. PDF no encontrado — regenerarlo automáticamente con la fecha/hora original ──
    // Para B/C/D: pre-rellenar desde la letra inmediatamente anterior.
    // Para A: usar los datos del propio recibo.
    const _letraActual = (r.letra || letraVersion(r) || 'A').toUpperCase();
    const _letraCode   = _letraActual.charCodeAt(0);
    const _letraPrevia = _letraCode > 65 ? String.fromCharCode(_letraCode - 1) : null;
    const _fuente = _letraPrevia
      ? (_todosRecibos.find(x =>
          (x.folio === r.folio || x.folio === parseInt(r.folio)) &&
      
          (x.letra || letraVersion(x) || 'A').toUpperCase() === _letraPrevia
        ) || r)
      : r;
    // Generación silenciosa: usa r.fecha_recibo/r.hora_recibo (los mismos valores
    // que el formulario pre-rellenaba). Si falla, cae al formulario manual.
    window._cpdfPendienteRecibo  = r;
    window._cpdfPendienteFuente  = _fuente;
    window._cpdfPendienteEmbed   = embed;
    window._cpdfPendienteLoading = loading;
    if(msg) msg.textContent = 'Generando recibo…';
    try{
      await cpdfConfirmarGenerar();
      // Si la generación dejó el loading visible, algo falló → mostrar formulario
      if(loading && loading.style.display !== 'none'){
        _cpdfMostrarFormGenerar(r, _fuente, embed, loading);
      }
    }catch(_eGen){
      console.warn('[contabPDF] auto-generación falló, mostrando formulario:', _eGen);
      _cpdfMostrarFormGenerar(r, _fuente, embed, loading);
    }
  }catch(e){
    msg.textContent='Error: '+e.message;
    console.error('contabPDF:',e);
  }
}

function cerrarContabPDF(){
  if(window._fichaAbiertaAntes){
    window._fichaAbiertaAntes=false;
    setTimeout(function(){if(reciboEnConsulta)abrirFichaFolio();},400);
  }
  const overlay=document.getElementById('contab-pdf-overlay');
  overlay.style.display='none';
  document.getElementById('cpdf-embed').setAttribute('src','');
}

function _gfBackup(etiqueta){
  try{
    var snap={ ts:Date.now(), etiqueta:etiqueta,
      recibos:(appData.recibos||[]),
      movimientos:(typeof D!=='undefined' && D.movimientos)?D.movimientos:[],
      folioActual:appData.folioActual };
    localStorage.setItem('lex_gf_backup_'+etiqueta+'_'+Date.now(), JSON.stringify(snap));
  }catch(e){ console.warn('[gestorFolios] backup', e); }
}

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
    // ⚠️ CRÍTICO: usar m.letra (guardado en el movimiento) para distinguir A de B.
    // NO buscar en appData.recibos porque .find() sin filtro de letra siempre devuelve
    // el registro A (que ahora es el primero tras el fix unshift→push), haciendo que
    // tanto el anticipo (6/ene) como la liquidación (19/ene) muestren la misma letra.
    var letra = m.letra || 'A';
    // Inyectar letra en m.cat (e.g. "#26-001" → "#26-001A") para registros ya guardados
    var displayCat = (m.cat||'').replace(/(#\d{2}-\d{3,})(?![A-Z\d])/g, '$1' + letra);
    var folioDisplay = m.folio ? ' · Folio ' + folioConLetra(m.folio, m.anio_folio, letra) : '';
    return [
      '<div style="display:flex;align-items:center;padding:7px 16px;border-bottom:1px solid rgba(200,149,42,0.06);gap:10px;">',
      '<div style="min-width:82px;font-size:0.65rem;color:var(--muted);">'+fmtFecha(m.fecha)+'</div>',
      '<div style="flex:1;min-width:0;">',
      '<div style="font-size:0.74rem;color:var(--gold-l);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHTML(m.descripcion||'')+'</div>',
      '<div style="font-size:0.62rem;color:var(--muted);">'+displayCat+folioDisplay+'</div>',
      '</div>',
      '<div style="font-size:0.76rem;font-weight:700;color:'+color+';flex-shrink:0;">',
      signo+'$'+m.monto.toLocaleString('es-MX'),
      '</div>',
      '</div>',
    ].join('');
  }).join('');
}

async function _fichaVisorMostrarVersion(folio, letra){
  var iframe = document.getElementById('pdf-consulta-iframe');
  var overlay = document.getElementById('contab-pdf-overlay');
  if(!iframe || typeof abrirPreviaDesdeContab !== 'function') return;
  window._fichaVisorToken = (window._fichaVisorToken||0)+1;
  var myToken = window._fichaVisorToken;
  // Reutilizar la búsqueda/descarga de PDF YA PROBADA de abrirPreviaDesdeContab
  // (sesión → R2 → Supabase Storage → versiones_recibo, con todos sus
  // respaldos) en vez de reimplementarla — así no depende de otro camino que
  // pueda fallar en silencio. Se oculta visualmente su overlay mientras carga
  // y, al terminar, se copia el resultado al visor de la Ficha del Folio.
  var _prevOpacity = overlay ? overlay.style.opacity : '';
  var _prevPE = overlay ? overlay.style.pointerEvents : '';
  if(overlay){ overlay.style.opacity='0'; overlay.style.pointerEvents='none'; }
  try{
    await abrirPreviaDesdeContab(folio, letra);
  }catch(e){
    console.warn('[_fichaVisorMostrarVersion]', e);
  }
  if(overlay){
    overlay.style.display = 'none';
    overlay.style.opacity = _prevOpacity;
    overlay.style.pointerEvents = _prevPE;
  }
  if(myToken !== window._fichaVisorToken) return; // se abrió otra versión mientras tanto
  var embed = document.getElementById('cpdf-embed');
  var _src = embed ? embed.getAttribute('src') : '';
  if(_src){
    if(window._fichaPdfTempBlobUrl){ try{ URL.revokeObjectURL(window._fichaPdfTempBlobUrl); }catch(e){} }
    window._fichaPdfTempBlobUrl = _src.indexOf('blob:')===0 ? _src.split('#')[0] : null;
    iframe.src = _src.split('#')[0] + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH';
  } else if(typeof toast==='function'){
    toast('No se encontró el PDF de esta versión','err');
  }
}
