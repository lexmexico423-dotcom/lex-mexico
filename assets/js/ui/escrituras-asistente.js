// ── Oct-2026 · ASISTENTE "▶ SIGUIENTE ETAPA" DE ESCRITURAS ───────────────
// Automatiza el avance del trámite con preguntas, respetando los puntos
// intermedios (fase "esperando" del siguiente paso) y sus plazos:
//
//   1 Firma notarial ─ captura instrumento, volumen y fecha de firma
//     ↓ intermedio (10 días): reunir requisitos e ingresar a Catastro
//   2 Catastro (en la oficina, hasta 60 días): cédula + avalúo
//     ↓ intermedio (10 días): el CLIENTE paga su traslado de dominio  → 📞 tarea
//   3 Traslado de dominio municipal: pagado + comprobante entregado
//     ↓ intermedio (10 días): enviar al notario para el ISR           → tarea
//   4 ISR con el notario (10 días): generado (+ pago del cliente si aplica)
//     ↓ intermedio (10 días): SOLICITAR a la notaría la escritura y que
//       la ENTREGUE (oct-2026)                                         → tarea
//     ↓ intermedio (10 días): ingresar al Registro Público            → tarea
//   5 Registro Público / IFREO (en la oficina, hasta 30 días): inscripción +
//     escritura física en el despacho → LISTO PARA ENTREGAR           → 📞 tarea
//
// Cada "No" queda como Llamado a la Acción ("Falta: …"). Al abrirse cada
// intermedio se crea la tarea en Tareas de hoy y un recordatorio a la mitad
// del plazo. Al vencer, se ven la alerta roja y el parpadeo que ya existen.
// Usa el mismo modelo de datos de siempre (e.pasos[i].estado / fechaAutoInicio)
// más p.plazoDias, así el botón "Editar" y el modal de paso siguen funcionando.
(function(){
  'use strict';
  if (window._lexEscAsistente) return;
  window._lexEscAsistente = true;

  var DIAS_INTER = 10;
  var DIAS_OFICINA = [10, 60, 10, 10, 30];          // fase "en trámite" de cada paso
  var NOMBRE = ['Firma notarial', 'Catastro', 'Traslado de dominio municipal', 'ISR con el notario', 'Registro Público (IFREO)'];
  try {
    if (typeof ESC_NOTAS_ACTIVO !== 'undefined') {
      ESC_NOTAS_ACTIVO[1] = 'Ya se ingresó a Catastro: puede tardar hasta 2 meses en salir la cédula y el avalúo';
      ESC_NOTAS_ACTIVO[4] = 'Ya se ingresó al Registro Público: puede tardar hasta 1 mes en salir la inscripción';
    }
    if (typeof ESC_NOTAS_AUTO_INTERMEDIO !== 'undefined') ESC_NOTAS_AUTO_INTERMEDIO[4] = 'Concluyó el ISR: solicita a la notaría la entrega de la escritura (10 días)';
  } catch(e){}

  function E(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function usuario(){ try { if (typeof empleadoActual !== 'undefined' && empleadoActual) return empleadoActual.nombre || empleadoActual.email || ''; } catch(e){} return ''; }
  function toastS(m, t){ try { if (typeof toast === 'function') toast(m, t); } catch(e){} }
  function hoyISO(off){ var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fechaTxt(){ return new Date().toLocaleString('es-MX', { timeZone:'America/Mexico_City', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  function fLarga(ms){ try { return new Date(ms).toLocaleDateString('es-MX', { day:'numeric', month:'long' }); } catch(e){ return ''; } }
  function nom(p){ return typeof p === 'string' ? p : ((p && p.nombre) || ''); }
  var MES_N = { ene:1, feb:2, mar:3, abr:4, may:5, jun:6, jul:7, ago:8, sep:9, set:9, oct:10, nov:11, dic:12 };
  // Fecha de firma en formato AAAA-MM-DD (para el campo de fecha); '' si solo hay año o nada
  function fechaISO(e){
    var f = String(e.fechaFirma || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(f)) return f.slice(0, 10);
    var t = String(e.fechaFirmaTexto || f || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var m = /(\d{1,2})\s*(?:de\s*)?([a-z]{3})[a-z]*\.?\s*(?:de\s*|del\s*)?(\d{4})/.exec(t);
    if (m && MES_N[m[2]]) return m[3] + '-' + String(MES_N[m[2]]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    m = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(t);
    if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    return '';
  }

  // Plazo de cada fase para escrituras capturadas antes (sin plazoDias)
  function normalizar(e){
    if (!e || !Array.isArray(e.pasos)) return;
    e.pasos.forEach(function(p, i){ if (p && p.fechaAutoInicio && !p.plazoDias) p.plazoDias = p.estado === 'activo' ? DIAS_OFICINA[i] : DIAS_INTER; });
  }
  function pasosDe(e){
    if (!Array.isArray(e.pasos)) e.pasos = [];
    for (var i = 0; i < 5; i++) if (!e.pasos[i]) e.pasos[i] = { estado:'pendiente', notas:'', fecha:'' };
    return e.pasos;
  }
  // Oct-2026: entre el ISR y el Registro Público hay un paso más: solicitar a
  // la notaría la escritura y que la entregue. Vive dentro del intermedio del
  // paso 5 (pasos[4].escrituraRecibida = true cuando la notaría ya la entregó).
  function esperaNotaria(e){ var p = pasosDe(e)[4]; return activoDe(e) === 4 && p.estado !== 'activo' && p.estado !== 'completado' && !p.escrituraRecibida; }
  function activoDe(e){ var ps = pasosDe(e), c = 0; for (var i = 0; i < 5; i++) { if (ps[i].estado === 'completado') c++; else break; } return c < 5 ? c : -1; }

  // ── LÍNEA DE 6 BOLITAS (oct-2026) ─────────────────────────────────────
  // 1 Firma · 2 Catastro · 3 Traslado · 4 ISR · 5 ESCRITURA NOTARÍA · 6 Registro.
  // Los datos siguen siendo los 5 pasos de siempre (e.pasos[0..4]); la bolita
  // 5 se guarda en e.pasos[4].escrituraRecibida (la notaría ya la entregó).
  var V_NOMBRE = ['Firma notarial', 'Catastro', 'Traslado de dominio municipal', 'ISR con el notario', 'Escritura de la notaría', 'Registro Público (IFREO)'];
  var V_CORTO = ['FIRMA', 'CATASTRO', 'TRASLADO', 'ISR', 'NOTARÍA', 'REGISTRO'];
  var V_COL = ['#5f5e5a', '#b06a10', '#534ab7', '#185fa5', '#993556', '#0e7490'];
  function notariaHecha(e){ var p = pasosDe(e)[4]; return !!p.escrituraRecibida || p.estado === 'activo' || p.estado === 'completado' || e.estado === 'listo' || e.estado === 'archivado'; }
  function vActivo(e){ var a = activoDe(e); if (a < 4) return a; return notariaHecha(e) ? 5 : 4; }
  function vEstado(e, k){
    var ps = pasosDe(e);
    if (k < 4) return ps[k].estado;
    if (k === 4) return notariaHecha(e) ? 'completado' : 'pendiente';
    return ps[4].estado === 'completado' ? 'completado' : ps[4].estado === 'activo' ? 'activo' : 'pendiente';
  }
  function vFase(e){ var va = vActivo(e); if (va < 0) return null; if (va === 0) return 'firma'; if (va === 4) return 'intermedio'; return vEstado(e, va) === 'activo' ? 'oficina' : 'intermedio'; }
  function vFecha(e, k){
    var ps = pasosDe(e);
    if (k < 4) return ps[k].fecha;
    if (k === 4) { var f = ps[4].escrituraRecibidaFecha; if (f) { try { return new Date(f).toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric' }); } catch(_){} } return ''; }
    return ps[4].estado === 'completado' ? ps[4].fecha : '';
  }
  function marcarNotaria(e){
    var p4 = pasosDe(e)[4];
    if (p4.estado !== 'pendiente' || !p4.fechaAutoInicio) { abrirIntermedio(e, 4); p4 = pasosDe(e)[4]; }
    resolverTareas(e, 4, 'intermedio');
    p4.escrituraRecibida = true; p4.escrituraRecibidaFecha = new Date().toISOString();
    p4.fechaAutoInicio = new Date().toISOString(); p4.plazoDias = DIAS_INTER; p4.fecha = fechaTxt();
    p4.notas = 'La notaría entregó la escritura: tienes ' + DIAS_INTER + ' días para ingresarla al Registro Público';
    historial(e, '5. Escritura de la notaría: entregada → inicia el plazo de ' + DIAS_INTER + ' días para ingresarla al Registro Público');
  }
  window.lexEscVirtual = { activo: vActivo, estado: vEstado, NOMBRE: V_NOMBRE, CORTO: V_CORTO, COL: V_COL };

  // ── Qué se pregunta en cada punto ─────────────────────────────────────
  // q: k (clave), t (texto), falta (texto del Llamado a la Acción si es "No"),
  //    cliente (si el "No" depende del cliente → tarea 📞), neutral (sí y no valen),
  //    si (mostrar solo cuando otra respuesta es "si")
  function config(i, fase, e){
    var muni = String(e.ubicacion || '').trim();
    if (i === 0) return {
      titulo: 'Paso 1 · Firma ante notario', plazo: null,
      preguntas: [{ k:'firmo', t:'¿Ya se firmó ante el notario?', falta:'Falta la firma ante notario' }],
      datos: [{ k:'instrumento', t:'Instrumento', campo:'instrumento' }, { k:'volumen', t:'Volumen', campo:'volumen' }, { k:'fechaFirma', t:'Fecha de firma', campo:'fechaFirma', tipo:'date' }],
      siguiente: 'Pasar a: reunir requisitos de Catastro', accion: function(){ completar(e, 0); abrirIntermedio(e, 1); }
    };
    if (i === 1 && fase === 'intermedio') return {
      titulo: 'Intermedio · Reunir requisitos e ingresar a Catastro', plazo: DIAS_INTER,
      preguntas: [
        { k:'req', t:'¿Ya se tienen todos los requisitos para Catastro?', falta:'Faltan requisitos para Catastro', cliente:true, llamar:'para pedirle los requisitos de Catastro' },
        { k:'ingreso', t:'¿Ya se ingresó el trámite a Catastro?', falta:'Falta ingresar el trámite a Catastro' }],
      siguiente: 'Ya está en Catastro (hasta 2 meses)', accion: function(){ iniciarOficina(e, 1); }
    };
    if (i === 1) return {
      titulo: 'Paso 2 · En Catastro', plazo: DIAS_OFICINA[1],
      preguntas: [
        { k:'cedula', t:'¿Ya salió la cédula catastral?', falta:'Falta que salga la cédula catastral' },
        { k:'avaluo', t:'¿Ya salió el avalúo?', falta:'Falta que salga el avalúo' }],
      siguiente: 'Catastro listo → llamar al cliente para su traslado', accion: function(){
        completar(e, 1); abrirIntermedio(e, 2);
        tareaLlamada(e, 'traslado', 'para que vaya a pagar su TRASLADO DE DOMINIO' + (muni ? ' en ' + muni : ' en su municipio') + ' y traiga el comprobante. Tiene ' + DIAS_INTER + ' días.');
        recordatorio(e, 'traslado-mitad', 'Seguimiento: ¿ya pagó el traslado de dominio?', Math.floor(DIAS_INTER / 2));
      }
    };
    if (i === 2) return {
      titulo: 'Intermedio · El cliente paga su traslado de dominio' + (muni ? ' (' + muni + ')' : ''), plazo: DIAS_INTER,
      preguntas: [
        { k:'pago', t:'¿El cliente ya pagó el traslado de dominio en su municipio?', falta:'El cliente no ha pagado el traslado de dominio', cliente:true, llamar:'para que pague su traslado de dominio' + (muni ? ' en ' + muni : '') },
        { k:'comp', t:'¿Ya entregó el comprobante de pago en el despacho?', falta:'Falta el comprobante del traslado de dominio', cliente:true, llamar:'para que traiga el comprobante del traslado de dominio' }],
      siguiente: 'Traslado listo → enviar al notario para el ISR', accion: function(){
        completar(e, 2); abrirIntermedio(e, 3);
        tareaInterna(e, 'isr-enviar', 'Llevar el expediente al notario para que genere el ISR', hoyISO(0));
      }
    };
    if (i === 3 && fase === 'intermedio') return {
      titulo: 'Intermedio · Enviar al notario para el ISR', plazo: DIAS_INTER,
      preguntas: [{ k:'entregado', t:'¿Ya se entregó el expediente al notario para el ISR?', falta:'Falta entregar el expediente al notario para el ISR' }],
      siguiente: 'Ya está con el notario', accion: function(){ iniciarOficina(e, 3); }
    };
    if (i === 3) return {
      titulo: 'Paso 4 · ISR con el notario', plazo: DIAS_OFICINA[3],
      preguntas: [
        { k:'generado', t:'¿El notario ya generó el ISR?', falta:'Falta que el notario genere el ISR' },
        { k:'cargo', t:'¿Hay pago de ISR a cargo del cliente?', neutral:true },
        { k:'pagado', t:'¿El cliente ya pagó su ISR?', si:'cargo', falta:'El cliente no ha pagado su ISR', cliente:true, llamar:'para que pague su ISR' }],
      siguiente: 'ISR listo → solicitar la escritura a la notaría', accion: function(){
        completar(e, 3); abrirIntermedio(e, 4);
        tareaInterna(e, 'notaria-escritura', 'Solicitar a la notaría la entrega de la escritura', hoyISO(0));
      }
    };
    if (i === 4 && fase === 'intermedio' && !pasosDe(e)[4].escrituraRecibida) return {
      titulo: 'Paso 5 · Escritura de la notaría (solicitarla y recibirla)', plazo: DIAS_INTER,
      preguntas: [
        { k:'solicitada', t:'¿Ya se solicitó a la notaría la entrega de la escritura?', falta:'Falta solicitar a la notaría la entrega de la escritura' },
        { k:'entregada', t:'¿La notaría ya entregó la escritura?', falta:'La notaría no ha entregado la escritura' }],
      siguiente: 'Escritura recibida → ingresar al Registro Público', accion: function(){
        marcarNotaria(e);
        tareaInterna(e, 'registro', 'Ingresar la escritura al Registro Público (IFREO)', hoyISO(0));
      }
    };
    if (i === 4 && fase === 'intermedio') return {
      titulo: 'Intermedio · Ingresar al Registro Público', plazo: DIAS_INTER,
      preguntas: [{ k:'ingreso', t:'¿Ya se ingresó la escritura al Registro Público (IFREO)?', falta:'Falta ingresar la escritura al Registro Público' }],
      siguiente: 'Ya está en el Registro Público (hasta 1 mes)', accion: function(){ iniciarOficina(e, 4); }
    };
    if (i === 4) return {
      titulo: 'Paso 6 · En el Registro Público (IFREO)', plazo: DIAS_OFICINA[4],
      preguntas: [
        { k:'inscripcion', t:'¿Ya salió la inscripción del Registro Público?', falta:'Falta que salga la inscripción del Registro Público' },
        { k:'fisica', t:'¿La escritura física ya está en el despacho?', falta:'Falta recoger la escritura física' }],
      siguiente: '🎉 Terminar → Listo para entregar', accion: function(){
        completar(e, 4);
        e.estado = 'listo';
        tareaLlamada(e, 'entrega', 'para avisarle que su ESCRITURA YA ESTÁ LISTA y pase a recogerla.');
      }
    };
    return null;
  }

  // ── Movimientos del trámite ───────────────────────────────────────────
  var _sinHistorial = false;   // al revertir no se deja rastro en el historial (a petición)
  function historial(e, txt){ if (_sinHistorial) return; if (!Array.isArray(e.historialPasos)) e.historialPasos = []; e.historialPasos.push({ fecha: new Date().toISOString(), por: usuario(), texto: txt }); }
  function completar(e, i){
    var ps = pasosDe(e);
    ps[i] = { estado:'completado', notas:'', fecha: fechaTxt() };
    historial(e, (i + 1) + '. ' + NOMBRE[i] + ' completado');
  }
  function abrirIntermedio(e, j){
    var ps = pasosDe(e);
    ps[j] = { estado:'pendiente', notas: (typeof ESC_NOTAS_AUTO_INTERMEDIO !== 'undefined' && ESC_NOTAS_AUTO_INTERMEDIO[j]) || '', fecha: fechaTxt(), fechaAutoInicio: new Date().toISOString(), plazoDias: DIAS_INTER, intermedioSuperado: false };
    historial(e, 'Inicia el intermedio hacia ' + (j + 1) + '. ' + NOMBRE[j] + ' (plazo ' + DIAS_INTER + ' días)');
  }
  function iniciarOficina(e, j){
    var ps = pasosDe(e);
    ps[j] = { estado:'activo', notas: (typeof ESC_NOTAS_ACTIVO !== 'undefined' && ESC_NOTAS_ACTIVO[j]) || '', fecha: fechaTxt(), fechaAutoInicio: new Date().toISOString(), plazoDias: DIAS_OFICINA[j], intermedioSuperado: false };
    historial(e, (j + 1) + '. ' + NOMBRE[j] + ' en trámite (plazo ' + DIAS_OFICINA[j] + ' días)');
  }

  // ── Tareas de hoy ─────────────────────────────────────────────────────
  function tareas(){ try { if (!Array.isArray(D.tareasHoy)) D.tareasHoy = []; return D.tareasHoy; } catch(e){ return []; } }
  function yaExiste(e, motivo){ return tareas().some(function(t){ return t && t.estado !== 'resuelta' && t.escId === String(e.id) && t.escMotivo === motivo; }); }
  function etiqueta(e){ var n = String(e.num || '').replace(/^carp\.?-?\s*/i, '').trim(); return 'ESCRITURA' + (n ? ' ' + n : ''); }
  function cliente(e){
    var nombre = nom((e.compradores || [])[0]) || 'EL CLIENTE', tel = '';
    try { var ps = typeof window._llamadaPersonas === 'function' ? window._llamadaPersonas('esc', e.id) : null; if (ps && ps[0]) { nombre = ps[0].nombre || nombre; tel = ps[0].tel || ''; } } catch(_){}
    return { nombre: nombre, tel: tel };
  }
  function tareaLlamada(e, motivo, indicacion, fecha){
    if (yaExiste(e, motivo)) return;
    var c = cliente(e), ahora = new Date().toISOString(), et = etiqueta(e);
    tareas().unshift({
      id: 'TH-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), tipo: 'llamada-cliente',
      titulo: '📞 LLAMAR A ' + String(c.nombre).toUpperCase() + ' (' + et + ')',
      texto: (c.tel ? 'Tel. ' + c.tel : 'Tel.: buscarlo (no está registrado)') + '\nIndicación: Llamar ' + indicacion + '\nCreada automáticamente al avanzar la escritura (' + usuario() + ')',
      estado: 'pendiente', fechaProgramada: fecha || '', creadoPor: usuario(), fechaCreacion: ahora, fechaResolucion: '', fechaMod: ahora,
      origen: { tipo:'esc', id: String(e.id), etiqueta: et, nombre: c.nombre, tel: c.tel }, escId: String(e.id), escMotivo: motivo
    });
  }
  function tareaInterna(e, motivo, titulo, fecha){
    if (yaExiste(e, motivo)) return;
    var c = cliente(e), ahora = new Date().toISOString();
    tareas().unshift({ id: 'TH-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), titulo: '📄 ' + titulo + ' — ' + String(c.nombre).toUpperCase() + ' (' + etiqueta(e) + ')',
      texto: 'Creada automáticamente al avanzar la escritura (' + usuario() + ')', estado: 'pendiente', fechaProgramada: fecha || '',
      creadoPor: usuario(), fechaCreacion: ahora, fechaResolucion: '', fechaMod: ahora, escId: String(e.id), escMotivo: motivo });
  }
  function recordatorio(e, motivo, titulo, enDias){ tareaInterna(e, motivo, titulo, hoyISO(enDias)); }
  // Al cumplirse una etapa, sus tareas automáticas pendientes se dan por resueltas
  var RESUELVE = { '2':['traslado','traslado-mitad'], '3-intermedio':['isr-enviar'], '4-intermedio':['notaria-escritura','registro'] };
  function resolverTareas(e, i, fase){
    var lista = (RESUELVE[i + '-' + fase] || RESUELVE[String(i)] || []), ahora = new Date().toISOString(), n = 0;
    tareas().forEach(function(t){
      if (!t || t.estado === 'resuelta' || t.escId !== String(e.id)) return;
      var m = String(t.escMotivo || '');
      if (lista.indexOf(m) >= 0 || m.indexOf('falta-' + i + '-') === 0) { t.estado = 'resuelta'; t.fechaResolucion = ahora; t.fechaMod = ahora; t.resueltaPor = 'Automático (' + usuario() + ')'; n++; }
    });
    return n;
  }

  // ── Plazo de la fase actual ───────────────────────────────────────────
  function infoPlazo(e, i){
    var p = pasosDe(e)[i] || {};
    if (!p.fechaAutoInicio) return null;
    var dias = parseInt(p.plazoDias, 10) || (p.estado === 'activo' ? DIAS_OFICINA[i] : DIAS_INTER);
    var vence = new Date(p.fechaAutoInicio).getTime() + dias * 86400000;
    var resta = Math.ceil((vence - Date.now()) / 86400000);
    return { dias: dias, vence: vence, resta: resta };
  }

  // ── Ventana del asistente ─────────────────────────────────────────────
  window.lexEscSiguienteEtapa = function(idx){
    try {
      var abierta = document.getElementById('mEscritura');
      if (abierta && abierta.classList.contains('show') && window._lexEscIdAbierta) { resyncIdx(); if (typeof _escIdx !== 'undefined' && _escIdx >= 0) idx = _escIdx; }
    } catch(_){}
    var e = D.escrituras && D.escrituras[idx]; if (!e) return;
    var _idE = e.id;
    normalizar(e);
    var i = activoDe(e);
    if (i === -1) {
      if (e.estado !== 'listo') { e.estado = 'listo'; e.fechaMod = new Date().toISOString(); tareaLlamada(e, 'entrega', 'para avisarle que su ESCRITURA YA ESTÁ LISTA y pase a recogerla.'); refrescar(e, idx); toastS('✅ Pasó a Listo para entregar'); }
      return;
    }
    var p = pasosDe(e)[i];
    var fase = (i === 0) ? 'firma' : (p.estado === 'activo' ? 'oficina' : 'intermedio');
    var cfg = config(i, fase, e); if (!cfg) return;
    var resp = {}, datos = {};
    (cfg.datos || []).forEach(function(d){ datos[d.k] = e[d.campo] || ''; });
    // Oct-2026: tomar lo que YA tiene la escritura aunque esté capturado de
    // otra forma — "Vol./Instr." junto (ej. 245/16262, importado de Excel) o
    // la fecha de firma escrita como texto.
    if (cfg.datos && cfg.datos.length) {
      try {
        var vi = (typeof _escSplitVolInstr === 'function') ? _escSplitVolInstr(e.volInstr) : { volumen:'', instrumento:'' };
        if (!datos.instrumento) datos.instrumento = vi.instrumento || '';
        if (!datos.volumen) datos.volumen = vi.volumen || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datos.fechaFirma || ''))) datos.fechaFirma = fechaISO(e);
      } catch(_){}
      // Si ya están los tres datos, la firma ya ocurrió: se marca "Sí" de entrada
      if (datos.instrumento && datos.volumen && datos.fechaFirma) resp.firmo = 'si';
    }
    var viejo = document.getElementById('lex-esc-asis'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-esc-asis';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Helvetica,Arial,sans-serif;';
    document.body.appendChild(ov);
    var COL = ['#5f5e5a', '#b06a10', '#534ab7', '#185fa5', '#0e7490'];
    function visibles(){ return cfg.preguntas.filter(function(q){ return !q.si || resp[q.si] === 'si'; }); }
    function faltan(){ return visibles().filter(function(q){ return !q.neutral && resp[q.k] === 'no'; }); }
    function completo(){
      var okQ = visibles().every(function(q){ return q.neutral ? !!resp[q.k] : resp[q.k] === 'si'; });
      var okD = (cfg.datos || []).every(function(d){ return String(datos[d.k] || '').trim(); });
      return okQ && okD;
    }
    function pintar(){
      var cli = cliente(e), pl = cfg.plazo ? infoPlazo(e, i) : null;
      var vi = vActivo(e), barra = ''; for (var b = 0; b < 6; b++) {
        var hecho = vEstado(e, b) === 'completado', aqui = b === vi;
        barra += '<span title="' + E(V_NOMBRE[b]) + '" style="width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;' + (hecho ? 'background:#1a7a3a;color:#fff;' : aqui ? 'background:' + V_COL[b] + ';color:#fff;' : 'border:2px solid #d3c6a6;color:#a89c80;') + '">' + (hecho ? '✓' : (b + 1)) + '</span>' + (b < 5 ? '<span style="flex:1;height:3px;background:' + (hecho ? '#1a7a3a' : '#e5dcc4') + ';"></span>' : '');
      }
      var plazoHtml = '';
      if (pl) {
        var venc = pl.resta < 0, cerca = !venc && pl.resta <= Math.ceil(pl.dias / 3);
        var c1 = venc ? '#a32d2d' : cerca ? '#b06a10' : '#1a7a3a', bg = venc ? '#fcebeb' : cerca ? '#fff8e8' : '#eaf3de';
        plazoHtml = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;background:' + bg + ';border:1.5px solid ' + c1 + ';border-radius:8px;padding:8px 12px;margin-bottom:12px;">'
          + '<div><div style="font-family:monospace;font-size:10px;color:' + c1 + ';letter-spacing:0.08em;font-weight:700;">PLAZO DE ' + pl.dias + ' DÍAS</div><div style="font-weight:700;font-size:13px;">' + (venc ? 'Venció el ' + fLarga(pl.vence) : 'Vence el ' + fLarga(pl.vence)) + '</div></div>'
          + '<div style="text-align:center;"><div style="font-family:monospace;font-size:24px;font-weight:900;color:' + c1 + ';line-height:1;">' + Math.abs(pl.resta) + '</div><div style="font-family:monospace;font-size:9px;color:' + c1 + ';font-weight:700;">' + (venc ? 'DÍAS VENCIDO' : 'DÍAS RESTANTES') + '</div></div></div>';
      }
      var qs = visibles().map(function(q){
        var v = resp[q.k];
        var btn = function(val, txt, colOn){ var on = v === val; return '<button type="button" data-q="' + q.k + '" data-v="' + val + '" style="font-size:12px;font-weight:700;padding:5px 12px;border-radius:6px;cursor:pointer;border:1px solid ' + (on ? colOn : '#c9c2b2') + ';background:' + (on ? colOn : '#f6f3ec') + ';color:' + (on ? '#fff' : '#5f5e5a') + ';">' + txt + '</button>'; };
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid ' + (v === 'no' && !q.neutral ? '#efb3b3' : '#eadfbf') + ';border-radius:8px;background:#fff;margin-bottom:6px;"><span style="font-size:13px;">' + E(q.t) + '</span><span style="display:flex;gap:5px;flex-shrink:0;">'
          + btn('si', 'Sí', q.neutral ? '#185fa5' : '#1a7a3a') + btn('no', 'No', q.neutral ? '#185fa5' : '#c81e1e') + '</span></div>';
      }).join('');
      var ds = (cfg.datos || []).map(function(d){
        return '<div><div style="font-family:monospace;font-size:10px;color:#8a7f6a;letter-spacing:0.06em;margin-bottom:3px;">' + E(d.t).toUpperCase() + ' *</div><input data-d="' + d.k + '" type="' + (d.tipo || 'text') + '" value="' + E(datos[d.k]) + '" style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #d8c08a;border-radius:6px;font-size:13px;"></div>';
      }).join('');
      var fl = faltan();
      // Oct-2026: con algún "No" aparece aquí mismo el botón para ACEPTAR y
      // guardar el Llamado a la Acción (la escritura se queda en esta etapa).
      var avisoFalta = fl.length ? '<div style="background:#fcebeb;border:1px solid #efb3b3;color:#a32d2d;border-radius:8px;padding:10px 12px;margin:4px 0 8px;font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;">'
        + '<div>⚠ ' + fl.map(function(q){ return E(q.falta); }).join(' · ') + '.<br>Se guardará como <b>Llamado a la Acción</b>' + (fl.some(function(q){ return q.cliente; }) ? ' y se creará una tarea en <b>Tareas de hoy</b> para llamar al cliente (📞)' : '') + '.</div>'
        + '<button type="button" id="asis-aceptar-lla" style="flex-shrink:0;background:#a32d2d;color:#fff;border:none;border-radius:7px;padding:9px 14px;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap;">📌 Aceptar Llamado a la Acción</button>'
        + '</div>' : '';
      var ok = completo();
      ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fdfaf3;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:640px;max-height:94vh;overflow-y:auto;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#1a1008;">'
        + '<div style="position:sticky;top:0;background:#1a1008;color:#e8c875;padding:10px 16px;font-family:monospace;font-size:12px;letter-spacing:0.1em;display:flex;justify-content:space-between;"><span>▶ SIGUIENTE ETAPA · ' + E(String(cli.nombre).toUpperCase()) + '</span><span id="asis-x" style="cursor:pointer;" title="Cerrar sin guardar">✕</span></div>'
        + '<div style="padding:14px 16px;">'
        + '<div style="display:flex;align-items:center;gap:5px;margin-bottom:10px;">' + barra + '</div>'
        + '<div style="font-family:monospace;font-size:11px;color:' + V_COL[vi] + ';letter-spacing:0.08em;font-weight:800;margin-bottom:8px;">' + E(cfg.titulo).toUpperCase() + '</div>'
        + plazoHtml
        + (ds ? '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">' + ds + '</div>' : '')
        + '<div style="font-family:monospace;font-size:10px;color:#8a7f6a;letter-spacing:0.08em;margin-bottom:6px;">RESPONDA PARA AVANZAR</div>' + qs + avisoFalta
        + '<textarea id="asis-nota" rows="2" placeholder="Nota adicional (opcional)" style="width:100%;box-sizing:border-box;border:1px solid #d8c08a;border-radius:6px;padding:7px 9px;font-size:12.5px;font-family:inherit;resize:vertical;margin-top:4px;">' + E(ov._nota || '') + '</textarea>'
        + '<div style="display:flex;gap:8px;margin-top:10px;">'
        + '<button type="button" id="asis-guardar" style="' + (fl.length ? 'display:none;' : '') + 'flex:1;border:1px solid #c8951a;background:#fff;color:#9a6e18;border-radius:7px;padding:10px;font-weight:700;font-size:12px;cursor:pointer;">💾 Guardar avance (sigue aquí)</button>'
        + '<button type="button" id="asis-avanzar" ' + (ok ? '' : 'disabled') + ' style="flex:1.3;border:none;border-radius:7px;padding:10px;font-weight:800;font-size:12px;' + (ok ? 'background:#1a7a3a;color:#fff;cursor:pointer;' : 'background:#e5dcc4;color:#8a7f6a;cursor:not-allowed;') + '">▶ ' + E(cfg.siguiente) + '</button>'
        + '</div><div style="font-size:11px;color:#8a7f6a;margin-top:6px;text-align:center;">' + (ok ? 'Todo listo para avanzar.' : 'El botón para avanzar se habilita cuando todo está en "Sí"' + ((cfg.datos || []).length ? ' y los datos están capturados' : '') + '.') + '</div>'
        + '</div></div>';
      ov.querySelector('#asis-x').onclick = function(){ ov.remove(); };
      ov.querySelectorAll('[data-q]').forEach(function(b){ b.onclick = function(){ ov._nota = ov.querySelector('#asis-nota').value; resp[b.getAttribute('data-q')] = b.getAttribute('data-v'); pintar(); }; });
      ov.querySelectorAll('[data-d]').forEach(function(inp){ inp.oninput = function(){ datos[inp.getAttribute('data-d')] = inp.value; var okAhora = completo(), bA = ov.querySelector('#asis-avanzar'); bA.disabled = !okAhora; bA.style.background = okAhora ? '#1a7a3a' : '#e5dcc4'; bA.style.color = okAhora ? '#fff' : '#8a7f6a'; bA.style.cursor = okAhora ? 'pointer' : 'not-allowed'; }; });
      ov.querySelector('#asis-guardar').onclick = function(){ guardar(false); };
      var bLla = ov.querySelector('#asis-aceptar-lla'); if (bLla) bLla.onclick = function(){ guardar(false); };
      ov.querySelector('#asis-avanzar').onclick = function(){ if (completo()) guardar(true); };
    }
    function guardar(avanzar){
      var nota = (ov.querySelector('#asis-nota') || {}).value || '';
      // Por si la sincronización reemplazó el objeto mientras se contestaba
      try { var eNow = (D.escrituras || []).filter(function(x){ return x && x.id === _idE; })[0]; if (eNow && eNow !== e) { e = eNow; cfg = config(i, fase, e); idx = D.escrituras.indexOf(e); } } catch(_){}
      (cfg.datos || []).forEach(function(d){ var v = String(datos[d.k] || '').trim(); if (v) e[d.campo] = v; });
      if (avanzar) {
        resolverTareas(e, i, fase);
        cfg.accion();
        if (nota.trim()) historial(e, 'Nota: ' + nota.trim());
      } else {
        var fl = faltan(), ps = pasosDe(e);
        var txt = fl.map(function(q){ return q.falta; }).join(' · ');
        if (nota.trim()) txt = (txt ? txt + ' · ' : '') + nota.trim();
        if (txt) ps[i].notas = txt;
        ps[i].fecha = fechaTxt();
        fl.filter(function(q){ return q.cliente; }).forEach(function(q){ tareaLlamada(e, 'falta-' + i + '-' + q.k, q.llamar || ('por: ' + q.falta)); });
        historial(e, 'Avance registrado en ' + cfg.titulo + (txt ? ' — ' + txt : ''));
      }
      e.fechaMod = new Date().toISOString();
      e.pasoActivoFecha = new Date().toISOString();
      e.pasoActivoRequerimientos = false; e.pasoActivoEnEspera = false;
      ov.remove();
      refrescar(e, idx);
      toastS(avanzar ? '✅ Listo: ' + cfg.siguiente.replace(/^🎉\s*/, '') : (faltan().length ? '📌 Llamado a la Acción guardado' : '💾 Avance guardado'));
    }
    pintar();
  };

  function refrescar(e, idx){
    try { if (typeof escSyncYRefrescar === 'function') escSyncYRefrescar(); else if (typeof save === 'function') save(); } catch(_){}
    try { if (typeof renderTareasHoyLista === 'function') renderTareasHoyLista(); if (typeof renderTareasHoyCount === 'function') renderTareasHoyCount(); } catch(_){}
    try {
      if (typeof _escIdx !== 'undefined' && _escIdx === idx) {
        if (typeof escActualizarTimeline === 'function') escActualizarTimeline(e.pasos);
        if (typeof escActualizarTimelineDetalle === 'function') escActualizarTimelineDetalle(e.pasos);
        if (typeof escRenderNotasEtapa === 'function') escRenderNotasEtapa(e);
        if (typeof escAbrirDetalle === 'function' && e.estado === 'listo') escAbrirDetalle(idx);
      }
    } catch(_){}
  }

  // ── Botón en la ficha (debajo del progreso / Llamado a la Acción) ─────
  function botonHtml(e, idx){
    var i = activoDe(e);
    var txt, sub = '';
    if (i === -1) { txt = 'Pasar a Listo para entregar'; }
    else {
      var p = pasosDe(e)[i], fase = (i === 0) ? 'firma' : (p.estado === 'activo' ? 'oficina' : 'intermedio');
      var cfg = config(i, fase, e); txt = 'SIGUIENTE ETAPA';
      sub = cfg ? cfg.titulo : '';
      var pl = cfg && cfg.plazo ? infoPlazo(e, i) : null;
      if (pl) sub += ' · ' + (pl.resta < 0 ? '<b style="color:#ffd0d0;">vencido hace ' + (-pl.resta) + ' día(s)</b>' : 'faltan ' + pl.resta + ' día(s)');
    }
    return '<button type="button" onclick="lexEscSiguienteEtapa(' + idx + ')" style="display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;margin:0 0 14px;background:linear-gradient(135deg,#a8781e,#7a5410);border:none;border-radius:10px;padding:12px 16px;color:#fff;cursor:pointer;text-align:left;box-shadow:0 4px 12px rgba(122,84,16,0.3);">'
      + '<span style="font-size:1.4rem;">▶</span><span style="flex:1;"><span style="display:block;font-family:monospace;font-size:0.82rem;font-weight:900;letter-spacing:0.1em;">' + txt + '</span>'
      + (sub ? '<span style="display:block;font-size:0.74rem;opacity:0.92;margin-top:2px;">' + sub + '</span>' : '') + '</span><span style="font-size:1.1rem;">›</span></button>';
  }
  (function engancharFicha(){
    var orig = window.escRenderNotasEtapa;
    if (typeof orig !== 'function' || orig._lexAsis) return;
    var env = function(e){
      try { normalizar(e); } catch(_){}
      var r = orig.apply(this, arguments);
      try {
        var cont = document.getElementById('esc-notas-etapa');
        var idx = (D.escrituras || []).indexOf(e);
        // (Oct-2026: la barra dorada se quitó; el único botón "▶ Avanzar" va debajo de la línea del proceso)
      } catch(err){ console.warn('[Asistente escrituras]', err); }
      try { var bl = document.getElementById('esc-btn-avanzar-d'); if (bl) bl.remove(); ['esc-btn-editar-pasos', 'esc-btn-editar-pasos-d'].forEach(function(id){ var x = document.getElementById(id); if (x) x.style.display = 'none'; }); } catch(_){}
      try { pintarProgreso(); } catch(_){}
      return r;
    };
    env._lexAsis = true;
    window.escRenderNotasEtapa = env;
  })();
  // ── Botón "▶ Avanzar" junto a "Editar" en la línea del proceso, y los
  // botones que antes abrían el modal del paso (círculo resaltado, "Atender
  // ahora", "Ya inicié / Ya completé") ahora abren el asistente.
  function botonLinea(){
    // El botón "Editar / Cerrar edición" ya no hace falta: la línea siempre se puede editar
    ['esc-btn-editar-pasos', 'esc-btn-editar-pasos-d'].forEach(function(id){ var x = document.getElementById(id); if (x) x.style.display = 'none'; });
    var ed = document.getElementById('esc-btn-editar-pasos-d'); if (!ed) return;
    var idx = (typeof _escIdx !== 'undefined') ? _escIdx : -1;
    var e = idx >= 0 && D.escrituras ? D.escrituras[idx] : null;
    var b = document.getElementById('esc-btn-avanzar-d');
    var mostrar = e && (e.estado === 'proceso' || !e.estado);
    if (!mostrar) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'esc-btn-avanzar-d';
      b.title = 'Avanzar el trámite a la siguiente etapa (con preguntas)';
      b.style.cssText = 'font-family:monospace;font-size:0.66rem;font-weight:800;letter-spacing:0.06em;padding:4px 12px;border-radius:14px;border:1.5px solid #1a7a3a;background:#1a7a3a;color:#fff;cursor:pointer;margin-right:6px;';
      b.textContent = '▶ AVANZAR';
      ed.parentNode.insertBefore(b, ed);
    }
    b.onclick = function(){ window.lexEscSiguienteEtapa(idx); };
  }
  (function engancharBotones(){
    var origAR = window.escAccionRapidaPaso;
    if (typeof origAR === 'function' && !origAR._lexAsis) {
      var envAR = function(){ if (typeof _escIdx !== 'undefined' && _escIdx >= 0) return window.lexEscSiguienteEtapa(_escIdx); return origAR.apply(this, arguments); };
      envAR._lexAsis = true; window.escAccionRapidaPaso = envAR;
    }
    var origCP = window.escClickPaso;
    if (typeof origCP === 'function' && !origCP._lexAsis) {
      var envCP = function(pasoIdx){
        try {
          var modoEd = (typeof _escModoEditarPasos !== 'undefined') && _escModoEditarPasos;
          if (!modoEd && typeof _escIdx !== 'undefined' && _escIdx >= 0) {
            var e = D.escrituras[_escIdx];
            if (e && (e.estado === 'proceso' || !e.estado) && activoDe(e) === pasoIdx) return window.lexEscSiguienteEtapa(_escIdx);
          }
        } catch(_){}
        return origCP.apply(this, arguments);
      };
      envCP._lexAsis = true; window.escClickPaso = envCP;
    }
  })();

  // ── Oct-2026 FIX: la ficha abierta se sigue por su ID, no por su posición ──
  // La sincronización en vivo reordena/reemplaza D.escrituras; _escIdx (la
  // posición) quedaba apuntando a otra escritura o a una copia vieja y los
  // cambios se perdían ("hay que darle varias veces"). Antes de cada acción de
  // la ficha se vuelve a ubicar la escritura abierta por su id.
  function resyncIdx(){
    try {
      var id = window._lexEscIdAbierta; if (!id || typeof _escIdx === 'undefined') return;
      var lista = D.escrituras || [];
      for (var k = 0; k < lista.length; k++) if (lista[k] && String(lista[k].id) === id) { if (_escIdx !== k) _escIdx = k; return; }
    } catch(_){}
  }
  window._lexEscResync = resyncIdx;

  // ── Oct-2026 · UBICACIÓN DEL PREDIO, editable directo en la ficha ─────
  // Debajo de Comprador / Vendedor. Es EL MISMO dato que "Ubicación del predio"
  // del formulario de edición (e.ubicacion): lo que se escribe en uno aparece
  // en el otro al instante.
  // Guarda solo al salir de la casilla, con Enter, o 1 s después de dejar de escribir.
  function ubicHtml(e){
    var v = String(e.ubicacion || '');
    return '<div id="lex-esc-ubic" data-id="' + E(e.id || '') + '" style="margin:-4px 0 16px;border:1.5px solid rgba(26,122,58,0.35);border-radius:14px;background:#f3f9ee;padding:10px 14px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
      + '<span style="font-family:monospace;font-size:0.6rem;letter-spacing:0.08em;color:#27500a;font-weight:700;">📍 UBICACIÓN DEL PREDIO</span>'
      + '<span id="lex-esc-ubic-st" style="font-size:0.68rem;color:#7a8a6a;"></span></div>'
      + '<input id="lex-esc-ubic-inp" type="text" autocomplete="off" value="' + E(v) + '" placeholder="Escriba dónde está el predio (paraje, barrio, colindancia…)" '
      + 'style="width:100%;box-sizing:border-box;border:1px solid #b9d4a5;border-radius:8px;background:#fff;padding:9px 12px;font-size:0.92rem;color:#1a1008;outline:none;">'
      + '</div>';
  }
  function ubicGuardar(inp, forzar){
    var box = document.getElementById('lex-esc-ubic'); if (!box || !inp) return;
    var id = box.getAttribute('data-id'), e = (D.escrituras || []).filter(function(x){ return x && String(x.id) === id; })[0];
    var st = document.getElementById('lex-esc-ubic-st');
    if (!e) { if (st) st.textContent = 'No se encontró la escritura'; return; }
    var nuevo = String(inp.value || '').trim();
    if (nuevo === String(e.ubicacion || '').trim()) { if (forzar && st) st.textContent = ''; return; }
    var antes = String(e.ubicacion || '').trim();
    e.ubicacion = nuevo;
    var fu = document.getElementById('eUbicacion'); if (fu && fu.value !== nuevo) fu.value = nuevo;
    e.fechaMod = new Date().toISOString();
    historial(e, 'Ubicación del predio: ' + (antes ? '"' + antes + '" → ' : '') + (nuevo ? '"' + nuevo + '"' : '(borrada)'));
    try { if (typeof escSyncYRefrescar === 'function') escSyncYRefrescar(); else if (typeof save === 'function') save(); } catch(_){}
    if (st) { st.textContent = '✓ Guardado'; st.style.color = '#1a7a3a'; setTimeout(function(){ if (st.textContent === '✓ Guardado') st.textContent = ''; }, 2500); }
  }
  function ubicPintar(e){
    var top = document.getElementById('esc-detalle-header-top'); if (!top || !e) return;
    var previo = window._lexUbicPendiente; window._lexUbicPendiente = null;
    var viejo = document.getElementById('lex-esc-ubic'); if (viejo) viejo.remove();
    var vr = document.getElementById('lex-esc-revision'); if (vr) vr.remove();
    top.insertAdjacentHTML('beforeend', ubicHtml(e) + revisionHtml(e));
    var inp = document.getElementById('lex-esc-ubic-inp'); if (!inp) return;
    // Si se estaba escribiendo y la ficha se repintó (sincronización), no se pierde lo escrito
    if (previo && previo.id === String(e.id)) { inp.value = previo.valor; if (previo.foco) { inp.focus(); try { inp.setSelectionRange(previo.valor.length, previo.valor.length); } catch(_){} } }
    // Oct-2026: ya NO se guarda solo. Al cambiar algo aparece "💾 Guardar"
    // junto a Imprimir; si se intenta cerrar sin guardar, se avisa.
    inp.addEventListener('input', function(){ var fu = document.getElementById('eUbicacion'); if (fu) fu.value = inp.value; marcarUbic(); });
    inp.addEventListener('keydown', function(ev){ if (ev.key === 'Enter') { ev.preventDefault(); window.lexEscGuardarFicha(); } });
    marcarUbic();
  }
  function escDeUbic(){
    var box = document.getElementById('lex-esc-ubic'); if (!box) return null;
    return (D.escrituras || []).filter(function(x){ return x && String(x.id) === box.getAttribute('data-id'); })[0] || null;
  }
  function ubicPendiente(){
    var inp = document.getElementById('lex-esc-ubic-inp'), e = escDeUbic();
    var modal = document.getElementById('mEscritura');
    if (!inp || !e || (modal && !modal.classList.contains('show'))) return false;
    return String(inp.value || '').trim() !== String(e.ubicacion || '').trim();
  }
  window.lexEscUbicPendiente = ubicPendiente;
  function marcarUbic(){
    var pend = ubicPendiente(), st = document.getElementById('lex-esc-ubic-st');
    if (st) { st.textContent = pend ? '⚠ Cambios sin guardar' : ''; st.style.color = '#a32d2d'; st.style.fontWeight = pend ? '700' : '400'; }
    var ftr = document.getElementById('esc-ftr-detalle'), b = document.getElementById('lex-esc-btn-guardar');
    if (ftr && !b) {
      b = document.createElement('button'); b.id = 'lex-esc-btn-guardar'; b.type = 'button'; b.className = 'btn';
      b.textContent = '💾 Guardar';
      b.style.cssText = 'display:none;background:#1a7a3a;color:#fff;border:1px solid #1a7a3a;font-weight:800;';
      b.onclick = function(){ window.lexEscGuardarFicha(); };
      var imp = Array.prototype.filter.call(ftr.querySelectorAll('button'), function(x){ return /Imprimir/i.test(x.textContent); })[0];
      if (imp && imp.nextSibling) ftr.insertBefore(b, imp.nextSibling); else ftr.appendChild(b);
    }
    if (b) b.style.display = pend ? '' : 'none';
  }
  // 💾 Guardar de la ficha: guarda y regresa a la lista de escrituras
  window.lexEscGuardarFicha = function(){
    var inp = document.getElementById('lex-esc-ubic-inp');
    if (inp && ubicPendiente()) ubicGuardar(inp, true);
    marcarUbic();
    if (typeof cerrarOriginal === 'function') cerrarOriginal('mEscritura');
    toastS('✓ Cambios guardados');
  };
  // ── Aviso al salir con cambios sin guardar (reutilizable) ─────────────
  // lexDialogoCambios({ cambios:['Ubicación del predio'], accion:'cerrar', onGuardar, onSalir })
  window.lexDialogoCambios = function(o){
    var v = document.getElementById('lex-dlg-cambios'); if (v) v.remove();
    var ov = document.createElement('div'); ov.id = 'lex-dlg-cambios';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100100;background:rgba(26,16,8,0.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Helvetica,Arial,sans-serif;';
    var acc = o.accion || 'salir';
    ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fdfaf3;border:2px solid #ba7517;border-radius:12px;width:100%;max-width:440px;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#1a1008;overflow:hidden;">'
      + '<div style="background:#fdf3dc;border-bottom:1px solid #ecd9ae;padding:12px 16px;font-weight:800;color:#854f0b;font-size:15px;">⚠ Hay cambios sin guardar</div>'
      + '<div style="padding:14px 16px;font-size:13.5px;line-height:1.5;">Se va a <b>' + E(acc) + ' sin guardar</b> los cambios en:'
      + '<ul style="margin:8px 0 4px 18px;padding:0;">' + (o.cambios || []).map(function(c){ return '<li><b>' + E(c) + '</b></li>'; }).join('') + '</ul>'
      + '<div style="color:#7a6a4a;font-size:12.5px;">Si no los guarda, se perderán.</div>'
      + '<div style="display:flex;flex-direction:column;gap:7px;margin-top:14px;">'
      + (o.sinGuardar ? '' : '<button type="button" data-a="g" style="border:none;background:#1a7a3a;color:#fff;border-radius:8px;padding:10px;font-weight:800;cursor:pointer;">💾 Guardar y ' + E(acc) + '</button>')
      + '<button type="button" data-a="s" style="border:1.5px solid #a32d2d;background:#fff;color:#a32d2d;border-radius:8px;padding:9px;font-weight:700;cursor:pointer;">' + E(acc.charAt(0).toUpperCase() + acc.slice(1)) + ' sin guardar</button>'
      + '<button type="button" data-a="r" style="border:1px solid #c8b68a;background:#fff;color:#5a4a2a;border-radius:8px;padding:9px;font-weight:600;cursor:pointer;">← Regresar' + (o.sinGuardar ? ' (para guardar)' : '') + '</button>'
      + '</div></div></div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('button').forEach(function(b){ b.onclick = function(){ var a = b.getAttribute('data-a'); ov.remove(); if (a === 'g' && o.onGuardar) o.onGuardar(); else if (a === 's' && o.onSalir) o.onSalir(); }; });
  };
  var cerrarOriginal = null;
  // Formulario Editar / Nueva escritura: se toma una "foto" de los campos al
  // abrirlo y se compara al salir.
  function fotoForm(){
    var body = document.getElementById('modal-body-form'); if (!body) return '';
    return Array.prototype.map.call(body.querySelectorAll('input, select, textarea'), function(x){
      if (x.type === 'file' || x.id === 'lex-obs-ini-ta') return '';
      return (x.id || x.className || x.name || '') + '=' + ((x.type === 'checkbox' || x.type === 'radio') ? (x.checked ? '1' : '0') : String(x.value || ''));
    }).join('|');
  }
  var _fotoForm = null, _formTocado = false;
  // Solo cuenta si la persona escribió/eligió algo (no los llenados automáticos del sistema)
  var _marcaForm = function(ev){ if (ev.isTrusted && ev.target && ev.target.closest && ev.target.closest('#modal-body-form')) _formTocado = true; };
  document.addEventListener('input', _marcaForm, true); document.addEventListener('change', _marcaForm, true);
  function formVisible(){
    var m = document.getElementById('mEscritura'), f = document.getElementById('esc-ftr-form');
    return !!(m && m.classList.contains('show') && f && f.style.display !== 'none' && getComputedStyle(f).display !== 'none');
  }
  function formPendiente(){ return _formTocado && _fotoForm !== null && formVisible() && fotoForm() !== _fotoForm; }
  window.lexEscFormPendiente = formPendiente;
  window.lexEscFotoForm = function(){ _fotoForm = fotoForm(); _formTocado = false; };
  ['escMostrarFormulario', 'escAbrirNueva'].forEach(function(n){
    var o = window[n]; if (typeof o !== 'function' || o._lexFoto) return;
    var w = function(){ var r = o.apply(this, arguments); _fotoForm = null; _formTocado = false; setTimeout(function(){ _fotoForm = fotoForm(); _formTocado = false; }, 60); return r; };
    for (var k in o) { try { w[k] = o[k]; } catch(_){} }
    w._lexFoto = true; window[n] = w;
  });
  function cambiosFicha(){
    var c = [];
    try { if (formPendiente()) c.push('Datos de la escritura (formulario de edición)'); } catch(_){}
    try { if (ubicPendiente()) c.push('Ubicación del predio'); } catch(_){}
    try { if (typeof window.lexEscObsHayCambios === 'function' && window.lexEscObsHayCambios()) c.push('Observaciones iniciales'); } catch(_){}
    return c;
  }
  function guardarFichaSinCerrar(){
    var inp = document.getElementById('lex-esc-ubic-inp');
    if (inp && ubicPendiente()) ubicGuardar(inp, true);
    try { if (typeof window.lexEscObsGuardarYa === 'function') window.lexEscObsGuardarYa(); } catch(_){}
  }
  function descartarFicha(){
    var inp = document.getElementById('lex-esc-ubic-inp'), e = escDeUbic();
    if (inp && e) { inp.value = e.ubicacion || ''; var fu = document.getElementById('eUbicacion'); if (fu) fu.value = inp.value; }
    try { if (typeof window.lexEscObsDescartar === 'function') window.lexEscObsDescartar(); } catch(_){}
    marcarUbic();
  }
  (function engancharSalidas(){
    var oc = window.cerrar;
    if (typeof oc === 'function' && !oc._lexFicha) {
      cerrarOriginal = function(){ return oc.apply(window, arguments); };
      var wc = function(id){
        if (id === 'mEscritura' && !window._lexGuardandoEsc && (typeof window.lexEsCierreUsuario !== 'function' || window.lexEsCierreUsuario())) {
          var c = cambiosFicha();
          if (c.length) { window.lexDialogoCambios({ cambios: c, accion: 'cerrar',
            onGuardar: function(){
              if (formPendiente()) { try { if (typeof window.lexEscObsGuardarYa === 'function') window.lexEscObsGuardarYa(); } catch(_){} window.escGuardar(); return; }   // valida y cierra solo
              guardarFichaSinCerrar(); oc('mEscritura'); toastS('✓ Cambios guardados');
            },
            onSalir: function(){ descartarFicha(); _fotoForm = null; oc('mEscritura'); } }); return; }
        }
        return oc.apply(this, arguments);
      };
      for (var k in oc) { try { wc[k] = oc[k]; } catch(_){} }
      wc._lexFicha = true; window.cerrar = wc;
    } else cerrarOriginal = oc;
    var oa = window.escAbrirDetalle;
    if (typeof oa === 'function' && !oa._lexFicha) {
      var wa = function(idx){
        var self = this, args = arguments, eN = D.escrituras && D.escrituras[idx], eA = escDeUbic();
        var c = cambiosFicha();
        var evA = window.event, porUsuario = !!(evA && evA.isTrusted);
        if (c.length && porUsuario && eA && (!eN || String(eN.id) !== String(eA.id))) {
          window.lexDialogoCambios({ cambios: c, accion: 'abrir otra escritura', onGuardar: function(){ guardarFichaSinCerrar(); oa.apply(self, args); }, onSalir: function(){ descartarFicha(); oa.apply(self, args); } });
          return;
        }
        return oa.apply(this, arguments);
      };
      for (var k2 in oa) { try { wa[k2] = oa[k2]; } catch(_){} }
      wa._lexFicha = true; window.escAbrirDetalle = wa;
    }
    // La tecla Esc cierra todas las ventanas de golpe: si la escritura tiene
    // cambios sin guardar, se pasa por el mismo aviso.
    var om = window.cerrarModalesAbiertos;
    if (typeof om === 'function' && !om._lexFicha) {
      var wm = function(){
        var m = document.getElementById('mEscritura');
        if (m && m.classList.contains('show') && cambiosFicha().length) {
          if (document.getElementById('lex-dlg-cambios')) return;
          window.cerrar('mEscritura'); return;
        }
        return om.apply(this, arguments);
      };
      wm._lexFicha = true; window.cerrarModalesAbiertos = wm;
    }
    // El GUARDAR general del formulario ya guarda la ubicación (misma casilla)
    window.addEventListener('beforeunload', function(ev){ if (cambiosFicha().length) { ev.preventDefault(); ev.returnValue = ''; } });
  })();
  // ── Oct-2026 · OBSERVACIONES INICIALES = NOTA PERMANENTE (bloqueada) ───
  // Bloqueada (🔒). "✎ Editar" → se abre la casilla y aparecen "💾 Guardar" y
  // "Cancelar". Si se intenta salir (cerrar la ventana, abrir otra escritura,
  // GUARDAR general) con cambios sin guardar, se pregunta qué hacer.
  // El estado de edición sobrevive a los repintados de la sincronización.
  (function bloquearObservaciones(){
    var orig = window.escRenderBitacora;
    if (typeof orig !== 'function' || orig._lexBloq) return;
    var ED = null;   // { id, original, valor } mientras se edita
    function escActual(){ resyncIdx(); var i = (typeof _escIdx !== 'undefined') ? _escIdx : -1; return i >= 0 ? D.escrituras[i] : null; }
    function textoDe(e){ return (e && Array.isArray(e.bitacora) && e.bitacora[0] && e.bitacora[0].texto) || ''; }
    var BTN = 'flex-shrink:0;border-radius:8px;padding:7px 14px;font-size:0.74rem;font-weight:800;cursor:pointer;white-space:nowrap;';
    function htmlBloq(texto){
      return '<div id="lex-obs-ini" style="display:flex;gap:12px;align-items:flex-start;">'
        + '<div style="flex:1;min-width:0;background:#f7f9fc;border:1px dashed #8a9bb5;border-radius:8px;padding:9px 12px;font-size:0.86rem;line-height:1.5;color:#1e2a3e;white-space:pre-wrap;">'
        + (texto ? '🔒 ' + E(texto) : '<span style="color:#8a94a8;font-style:italic;">🔒 Sin observación inicial.</span>') + '</div>'
        + '<button type="button" onclick="lexEscEditarObsIni()" title="Editar la nota permanente" style="' + BTN + 'background:#fff;border:1.5px solid #44546e;color:#2c3a52;">✎ Editar</button></div>';
    }
    function htmlEdit(valor){
      return '<div id="lex-obs-ini" data-editando="1" style="display:flex;gap:12px;align-items:flex-start;">'
        + '<textarea id="lex-obs-ini-ta" rows="3" style="flex:1;min-width:0;box-sizing:border-box;background:#fff;border:2px solid #44546e;border-radius:8px;padding:9px 12px;font-size:0.86rem;line-height:1.5;color:#1e2a3e;font-family:inherit;resize:vertical;outline:none;">' + E(valor) + '</textarea>'
        + '<div style="display:flex;flex-direction:column;gap:6px;">'
        + '<button type="button" onclick="lexEscObsGuardar()" style="' + BTN + 'background:#1a7a3a;border:1.5px solid #1a7a3a;color:#fff;">💾 Guardar</button>'
        + '<button type="button" onclick="lexEscObsCancelar()" style="' + BTN + 'background:#fff;border:1.5px solid #8a9bb5;color:#44546e;">Cancelar</button></div></div>'
        + '<div id="lex-obs-ini-aviso" style="font-size:0.7rem;color:#5a6680;margin-top:6px;">✎ Editando la nota permanente. Presione <b>💾 Guardar</b> para conservar los cambios.</div>';
    }
    function pintar(){
      var cont = document.getElementById('esc-bitacora-lista-edit'); if (!cont) return;
      var e = escActual();
      if (ED && e && String(e.id) === ED.id) {
        cont.innerHTML = htmlEdit(ED.valor);
        var ta = document.getElementById('lex-obs-ini-ta');
        if (ta) ta.addEventListener('input', function(){ if (ED) ED.valor = ta.value; var av = document.getElementById('lex-obs-ini-aviso'); if (av) { av.innerHTML = '⚠ <b>Cambios sin guardar.</b> Presione 💾 Guardar o Cancelar.'; av.style.color = '#a32d2d'; } });
        return ta;
      }
      cont.innerHTML = htmlBloq(textoDe(e));
      return null;
    }
    var w = function(lista, editable){
      if (!editable) return orig.apply(this, arguments);
      var e = null; try { e = escActual(); } catch(_){}
      if (ED && e && String(e.id) === ED.id) return htmlEdit(ED.valor);
      return htmlBloq((lista && lista[0] && lista[0].texto) || '');
    };
    for (var k in orig) { try { w[k] = orig[k]; } catch(_){} }
    w._lexBloq = true; w._orig = orig;
    window.escRenderBitacora = w;
    // Después de que el sistema pinte la casilla, enganchar el textarea si se está editando
    var oDet = window.escAbrirDetalle;
    if (typeof oDet === 'function' && !oDet._lexObs) {
      var wd = function(idx){ try { var eN = D.escrituras && D.escrituras[idx]; if (ED && eN && String(eN.id) !== ED.id && !document.getElementById('lex-esc-ubic')) resolverPendiente('Va a abrir otra escritura.'); } catch(_){} var r = oDet.apply(this, arguments); try { if (ED) { var t = pintar(); if (t) t.focus(); } } catch(_){} return r; };
      for (var k2 in oDet) { try { wd[k2] = oDet[k2]; } catch(_){} }
      wd._lexObs = true; window.escAbrirDetalle = wd;
    }

    function hayCambios(){ return !!(ED && String(ED.valor).trim() !== String(ED.original).trim()); }
    function guardarYa(){
      if (!ED) return;
      var e = (D.escrituras || []).filter(function(x){ return x && String(x.id) === ED.id; })[0];
      var valor = String(ED.valor || ''), id = ED.id;
      ED = null;
      if (!e) return;
      var i = D.escrituras.indexOf(e);
      if (typeof _escIdx !== 'undefined' && i >= 0) _escIdx = i;
      if (typeof escEditarObservacion === 'function') escEditarObservacion(0, valor);   // guarda y repinta (bloqueada)
      else pintar();
    }
    function descartar(){ ED = null; pintar(); }
    // Pregunta al salir con cambios. Devuelve true si se puede continuar.
    function resolverPendiente(motivo){
      if (!ED) return true;
      if (!hayCambios()) { ED = null; return true; }
      if (confirm('Tiene cambios SIN GUARDAR en "Observaciones iniciales".\n\n' + (motivo || '') + '\n\nAceptar = GUARDAR los cambios\nCancelar = DESCARTARLOS (se perderán)')) guardarYa();
      else ED = null;
      return true;
    }
    window.lexEscObsPendiente = resolverPendiente;

    window.lexEscEditarObsIni = function(){
      var e = escActual(); if (!e) return;
      ED = { id: String(e.id), original: textoDe(e), valor: textoDe(e) };
      var ta = pintar();
      if (ta) { ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch(_){} }
    };
    window.lexEscObsGuardar = function(){
      if (!ED) return;
      var ta = document.getElementById('lex-obs-ini-ta'); if (ta) ED.valor = ta.value;
      if (!hayCambios()) { descartar(); toastS('Sin cambios'); return; }
      guardarYa();
    };
    window.lexEscObsCancelar = function(){
      if (!ED) return;
      var ta = document.getElementById('lex-obs-ini-ta'); if (ta) ED.valor = ta.value;
      if (hayCambios() && !confirm('¿Descartar los cambios de "Observaciones iniciales"?\n\nLo que escribió se perderá.')) return;
      descartar();
    };
    // Salidas: cerrar la ventana, abrir otra escritura o nueva, GUARDAR general
    function envolver(nombre, motivo, pre){
      var o = window[nombre]; if (typeof o !== 'function' || o['_lexObsP']) return;
      var f = function(){ var a = arguments; try { if (!pre || pre.apply(this, a)) resolverPendiente(motivo); } catch(_){} return o.apply(this, a); };
      for (var k3 in o) { try { f[k3] = o[k3]; } catch(_){} }
      f['_lexObsP'] = true; window[nombre] = f;
    }
    window.lexEscObsHayCambios = hayCambios; window.lexEscObsGuardarYa = guardarYa; window.lexEscObsDescartar = descartar;
    envolver('escAbrirNueva', 'Va a abrir una escritura nueva.');
    // GUARDAR general: lo escrito en la nota permanente se guarda junto, sin preguntar
    (function(){ var o = window.escGuardar; if (typeof o !== 'function' || o['_lexObsP']) return; var f = function(){ try { if (ED && hayCambios()) guardarYa(); else ED = null; } catch(_){} return o.apply(this, arguments); }; for (var k3 in o) { try { f[k3] = o[k3]; } catch(_){} } f['_lexObsP'] = true; window.escGuardar = f; })();
    window.addEventListener('beforeunload', function(ev){ if (hayCambios()) { ev.preventDefault(); ev.returnValue = ''; } });
  })();

  // ── Nota de REVISIÓN (no es la observación inicial) ───────────────────
  // e.notaRevision = { texto, fecha, origen } — avisos de cotejo (PDF, libreta…).
  // Se ve aparte, en ámbar, con botón "✓ Ya lo revisé" que la quita.
  function revisionHtml(e){
    var n = e && e.notaRevision; if (!n || !n.texto) return '';
    return '<div id="lex-esc-revision" style="margin:-6px 0 16px;border:1.5px solid #ba7517;border-left:6px solid #ba7517;border-radius:12px;background:#fdf3dc;padding:9px 14px;display:flex;gap:12px;align-items:center;">'
      + '<div style="flex:1;min-width:0;"><div style="font-family:monospace;font-size:0.58rem;letter-spacing:0.08em;color:#854f0b;font-weight:800;margin-bottom:2px;">🔎 NOTA DE REVISIÓN' + (n.origen ? ' · ' + E(String(n.origen).toUpperCase()) : '') + '</div>'
      + '<div style="font-size:0.84rem;color:#633806;line-height:1.45;">' + E(n.texto) + '</div></div>'
      + '<button type="button" onclick="lexEscRevisionHecha()" style="flex-shrink:0;background:#1a7a3a;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:0.72rem;font-weight:800;cursor:pointer;">✓ Ya lo revisé</button></div>';
  }
  window.lexEscRevisionHecha = function(){
    resyncIdx();
    var idx = (typeof _escIdx !== 'undefined') ? _escIdx : -1, e = idx >= 0 ? D.escrituras[idx] : null; if (!e || !e.notaRevision) return;
    if (!confirm('¿Quitar la nota de revisión?\n\n"' + e.notaRevision.texto + '"')) return;
    historial(e, 'Nota de revisión atendida: ' + e.notaRevision.texto);
    delete e.notaRevision; e.fechaMod = new Date().toISOString();
    try { if (typeof escSyncYRefrescar === 'function') escSyncYRefrescar(); } catch(_){}
    var b = document.getElementById('lex-esc-revision'); if (b) b.remove();
    toastS('✓ Nota de revisión quitada');
  };

  (function engancharUbicacion(){
    var o = window.escMostrarDetalle;
    if (typeof o !== 'function' || o._lexUbic) return;
    var w = function(e){
      try {
        var inp = document.getElementById('lex-esc-ubic-inp'), box = document.getElementById('lex-esc-ubic');
        if (inp && box && String(inp.value) !== String((((D.escrituras || []).filter(function(x){ return x && String(x.id) === box.getAttribute('data-id'); })[0]) || {}).ubicacion || ''))
          window._lexUbicPendiente = { id: box.getAttribute('data-id'), valor: String(inp.value), foco: document.activeElement === inp };
      } catch(_){}
      var r = o.apply(this, arguments);
      try { ubicPintar(e); } catch(err){ console.warn('[Ubicación del predio]', err); }
      return r;
    };
    for (var k in o) { try { w[k] = o[k]; } catch(_){} }
    w._lexUbic = true; window.escMostrarDetalle = w;
    // Lo que se escribe en la casilla del formulario se refleja en la de la ficha
    document.addEventListener('input', function(ev){
      var t = ev.target; if (!t || t.id !== 'eUbicacion') return;
      var inp = document.getElementById('lex-esc-ubic-inp'); if (inp && inp.value !== t.value) inp.value = t.value;
    }, true);
  })();

  (function engancharFichaPorId(){
    var oa = window.escAbrirDetalle;
    if (typeof oa === 'function' && !oa._lexId) {
      var ea = function(idx){ var e = D.escrituras && D.escrituras[idx]; window._lexEscIdAbierta = e && e.id ? String(e.id) : null; return oa.apply(this, arguments); };
      ea._lexId = true; window.escAbrirDetalle = ea;
    }
    // La ficha que se pinta es la que manda: fija el id y la posición
    var om = window.escMostrarDetalle;
    if (typeof om === 'function' && !om._lexId) {
      var em = function(e){ try { if (e && e.id) { window._lexEscIdAbierta = String(e.id); var k = (D.escrituras || []).indexOf(e); if (k >= 0 && typeof _escIdx !== 'undefined') _escIdx = k; else resyncIdx(); } } catch(_){} return om.apply(this, arguments); };
      em._lexId = true; window.escMostrarDetalle = em;
    }
    ['escActualizarTimelineDetalle','escActualizarTimeline','escConfirmarEntrega','escGuardarPaso','escAbrirPaso','escClickPaso','escAccionAtencion','escSuperarTramo','escAgregarNotaFinal','escGuardar','escEliminar','escCancelar','escModoEditar','escToggleMenuAtencion'].forEach(function(n){
      var o = window[n];
      if (typeof o !== 'function' || o._lexId) return;
      var w2 = function(){ resyncIdx(); return o.apply(this, arguments); };
      for (var k in o) { try { w2[k] = o[k]; } catch(_){} }
      w2._lexId = true; window[n] = w2;
    });
    var on = window.escAbrirNueva;
    if (typeof on === 'function' && !on._lexId) { var en = function(){ window._lexEscIdAbierta = null; return on.apply(this, arguments); }; en._lexId = true; window.escAbrirNueva = en; }
  })();

  (function engancharLista(){
    var orig = window.escRender;
    if (typeof orig !== 'function' || orig._lexAsisN) return;
    var env = function(){ try { (D.escrituras || []).forEach(normalizar); } catch(_){} return orig.apply(this, arguments); };
    for (var k in orig) { try { env[k] = orig[k]; } catch(_){} }
    env._lexAsisN = true;
    window.escRender = env;
  })();
  // ══════════════════════════════════════════════════════════════════════
  // LÍNEA DEL PROCESO (oct-2026, opción A): personita que camina según los
  // días del plazo + globo con mensaje claro ("Lleva 6 días sin cumplir…") y
  // UN solo botón "▶ Avanzar: …". Reemplaza la línea vieja de la ficha (se
  // oculta) y la barra dorada. Tocar un círculo:
  //   · ya hecho o el actual → corregirlo a mano (ventana de siempre)
  //   · uno ADELANTE → "Avanzar hasta aquí", preguntando si ya se superaron
  //     las etapas de en medio.
  // ══════════════════════════════════════════════════════════════════════
  var CORTO = ['FIRMA', 'CATASTRO', 'TRASLADO', 'ISR', 'REGISTRO'];
  var COLP = ['#5f5e5a', '#b06a10', '#534ab7', '#185fa5', '#0e7490'];
  function diasDesde(iso){ var t = new Date(iso || '').getTime(); return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 86400000)); }
  function pl(n){ return n + (n === 1 ? ' día' : ' días'); }
  function mensajeFase(e, i, fase){
    var muni = String(e.ubicacion || '').trim();
    if (i === 0) return 'esperando la firma ante notario';
    if (fase === 'intermedio') return ({ 1: 'sin cumplir los requisitos para ingresar el trámite a <b>Catastro</b>',
      2: 'sin que el cliente pague su <b>traslado de dominio</b>' + (muni ? ' en ' + E(muni) : ''),
      3: 'sin entregar el expediente al <b>notario para el ISR</b>',
      4: 'esperando que la <b>notaría entregue la escritura</b>',
      5: 'sin ingresar la escritura al <b>Registro Público</b>' })[i];
    return ({ 1: 'en <b>Catastro</b> esperando la cédula y el avalúo', 2: 'esperando el pago del <b>traslado de dominio</b>',
      3: 'esperando que el <b>notario genere el ISR</b>', 5: 'en el <b>Registro Público</b> esperando la inscripción' })[i];
  }
  function svgPersona(col){ return '<svg width="22" height="30" viewBox="0 0 22 30" aria-hidden="true" style="display:block;"><circle cx="12" cy="7" r="3.2" fill="' + col + '"/><path d="M11 11 L9 18 L5 21 M10 15 L15 17 M9 18 L12 23 L11 28 M9 18 L6 28" stroke="' + col + '" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>'; }

  function pintarProgreso(){
    var track = document.getElementById('esc-progreso-track-d'); if (!track) return;
    var viejo = track.parentNode; if (!viejo) return;
    var idx = (typeof _escIdx !== 'undefined') ? _escIdx : -1;
    var e = idx >= 0 && D.escrituras ? D.escrituras[idx] : null;
    var hint = document.getElementById('esc-detalle-hint');
    var box = document.getElementById('lex-esc-prog');
    if (!e) { if (box) box.remove(); viejo.style.display = ''; if (hint) hint.style.display = ''; return; }
    normalizar(e);
    viejo.style.display = 'none';
    if (!box) { box = document.createElement('div'); box.id = 'lex-esc-prog'; viejo.parentNode.insertBefore(box, viejo.nextSibling); }
    var ps = pasosDe(e), a = activoDe(e), va = vActivo(e), enCurso = (e.estado === 'proceso' || !e.estado);
    if (hint) hint.style.display = (a === -1) ? '' : 'none';   // "Escritura completada…" sí se deja
    // Dónde está la personita (índices de la línea de 6 bolitas)
    var fase = vFase(e);
    var info = null, NV = 6, UL = NV - 1;
    if (va >= 0 && enCurso) {
      var p = ps[va < 4 ? va : 4], dias, plazo = null, pct = 0.5, seg, enCirculo = false;
      if (fase === 'firma') { dias = diasDesde(p.fechaAutoInicio || e.fechaCreacion || e.pasoActivoFecha); enCirculo = true; seg = 0; }
      else {
        dias = diasDesde(p.fechaAutoInicio || e.pasoActivoFecha);
        plazo = parseInt(p.plazoDias, 10) || (fase === 'oficina' ? DIAS_OFICINA[va < 4 ? va : 4] : DIAS_INTER);
        pct = Math.min(1, dias / plazo);
        if (fase === 'intermedio') seg = va - 1;           // tramo que LLEGA a la bolita
        else if (va < UL) seg = va;                        // tramo que SALE de la bolita (en la oficina)
        else { seg = UL; enCirculo = true; }
      }
      var resta = plazo != null ? plazo - dias : null;
      var col = resta == null ? '#5f5e5a' : resta < 0 ? '#c81e1e' : resta <= Math.ceil(plazo / 3) ? '#b06a10' : '#1a7a3a';
      var bg = resta == null ? '#f6f3ec' : resta < 0 ? '#fcebeb' : resta <= Math.ceil(plazo / 3) ? '#fff8e8' : '#eaf3de';
      var cola = resta == null ? '' : resta < 0 ? ' <b style="color:#c81e1e;">El plazo de ' + pl(plazo) + ' venció hace ' + pl(-resta) + '.</b>'
        : resta === 0 ? ' <b style="color:#b06a10;">¡Hoy vence el plazo!</b>'
        : ' <b style="color:' + col + ';">' + (resta <= Math.ceil(plazo / 3) ? '¡Faltan ' + pl(resta) + '!' : 'Faltan ' + pl(resta) + '.') + '</b>';
      info = { seg: seg, pct: pct, enCirculo: enCirculo, col: col, bg: bg,
        txt: (resta != null && resta < 0 ? '⚠ ' : '') + '<b>Lleva ' + pl(dias) + '</b> ' + mensajeFase(e, va, fase) + '.' + cola };
    }
    // Globo: se ubica sobre TODA la línea (no se sale de la ventana en los extremos)
    function burbuja(){
      if (!info) return '';
      var o = info.enCirculo ? info.seg / UL : (info.seg + info.pct) / UL;
      return '<div style="position:absolute;top:4px;left:calc(40px + (100% - 80px) * ' + o.toFixed(3) + ');transform:translateX(-' + Math.round(o * 100) + '%);z-index:3;pointer-events:none;">'
        + '<div style="background:' + info.bg + ';border:1.5px solid ' + info.col + ';border-radius:9px;padding:7px 13px;width:340px;max-width:70vw;font-size:13px;line-height:1.4;color:#3a2a12;box-shadow:0 2px 8px rgba(0,0,0,0.08);">' + info.txt + '</div></div>';
    }
    // Personita: en su punto exacto de la línea
    function persona(leftPct){ return '<div style="position:absolute;left:' + leftPct + '%;bottom:4px;transform:translateX(-50%);pointer-events:none;z-index:2;">' + svgPersona(info.col) + '</div>'; }
    var html = '<div style="position:relative;display:flex;align-items:flex-start;padding:' + (info ? '104px' : '6px') + ' 6px 0;">' + burbuja();
    var cerrada = e.estado === 'listo' || e.estado === 'archivado';
    for (var k = 0; k < NV; k++) {
      var st = vEstado(e, k), hecho = st === 'completado' || cerrada, aqui = k === va && enCurso;
      var futuro = !hecho && k > va && va >= 0;
      var fRaw = vFecha(e, k), fechaH = hecho && fRaw ? String(fRaw).split(',')[0].split(' ')[0] : '';
      var circ = hecho ? 'background:#1a7a3a;color:#fff;border:2px solid #1a7a3a;'
        : aqui ? 'background:#fff;color:' + (info ? info.col : V_COL[k]) + ';border:3px solid ' + (info ? info.col : V_COL[k]) + ';box-shadow:0 0 0 4px ' + (info ? info.bg : '#fff8e8') + ';'
        : 'background:#f1ede4;color:#b4a88a;border:2px solid #ddd3bd;';
      html += '<div style="width:64px;flex-shrink:0;text-align:center;position:relative;">'
        + (info && info.enCirculo && info.seg === k ? '<div style="position:absolute;left:0;right:0;top:-4px;height:0;">' + persona(50) + '</div>' : '')
        + '<div role="button" tabindex="0" onclick="lexEscTocarCirculo(' + k + ')" title="' + (futuro ? 'Avanzar hasta ' + V_NOMBRE[k] : 'Corregir ' + V_NOMBRE[k]) + '" style="width:34px;height:34px;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;cursor:pointer;' + circ + '">' + (hecho ? '✓' : (k + 1)) + '</div>'
        + '<div style="font-family:monospace;font-size:10px;margin-top:5px;line-height:1.3;color:' + (hecho ? '#1a7a3a' : aqui ? (info ? info.col : '#7a4206') : '#a89c80') + ';font-weight:' + (aqui ? '800' : '600') + ';">' + V_CORTO[k] + (fechaH ? '<br><span style="font-weight:400;">' + E(fechaH) + '</span>' : '') + '</div></div>';
      if (k < UL) {
        var tramoHecho = (vEstado(e, k) === 'completado' && (vEstado(e, k + 1) === 'completado' || (k + 1 === va && fase === 'oficina'))) || cerrada;
        var esSeg = info && !info.enCirculo && info.seg === k;
        html += '<div style="flex:1;position:relative;height:4px;margin-top:15px;background:' + (tramoHecho ? '#1a7a3a' : '#e5dcc4') + ';border-radius:2px;">'
          + (esSeg ? '<div style="position:absolute;left:0;top:0;height:4px;width:' + Math.round(info.pct * 100) + '%;background:' + info.col + ';border-radius:2px;"></div>' + '<div style="position:absolute;left:0;right:0;top:-2px;height:0;">' + persona(Math.round(info.pct * 100)) + '</div>' : '')
          + '</div>';
      }
    }
    html += '</div>';
    if (va >= 0 && enCurso) {
      var ETQ = { 'firma-0':'Registrar la firma ante notario', 'intermedio-1':'Reunir requisitos e ingresar a Catastro', 'oficina-1':'¿Ya salió la cédula y el avalúo?',
        'intermedio-2':'¿Ya pagó el cliente su traslado de dominio?', 'oficina-2':'¿Ya pagó el cliente su traslado de dominio?', 'intermedio-3':'Entregar el expediente al notario para el ISR',
        'oficina-3':'¿Ya generó el notario el ISR?', 'intermedio-4':'¿Ya entregó la notaría la escritura?', 'intermedio-5':'Ingresar la escritura al Registro Público', 'oficina-5':'¿Ya salió la inscripción del Registro?' };
      html += '<div style="text-align:center;margin-top:14px;"><button type="button" onclick="lexEscSiguienteEtapa(' + idx + ')" style="background:#1a7a3a;color:#fff;border:none;border-radius:9px;padding:11px 22px;font-weight:800;font-size:0.85rem;cursor:pointer;box-shadow:0 3px 10px rgba(26,122,58,0.3);">▶ Avanzar: ' + E(ETQ[fase + '-' + va] || 'siguiente etapa') + '</button></div>'
        + '<div style="text-align:center;font-size:0.68rem;color:#8a7f6a;margin-top:6px;">Verde = hecho · La personita = dónde va · Gris = falta · Toca un círculo para corregirlo o para adelantar</div>';
    }
    // Oct-2026 · ESTATUS GUIADO al terminar: el sistema pregunta lo que sigue
    //  · todas las etapas listas y sigue "En proceso" → ¿Ya está lista para entregar?
    //  · "Listo para entregar"                          → ¿Ya se entregó?
    //  · "Concluida y entregada"                        → a quién y cuándo
    var guia = '';
    var todoHecho = a === -1, estado = e.estado || 'proceso';
    var btnEnt = document.getElementById('esc-btn-confirmar-entrega');
    if (todoHecho && (estado === 'proceso' || estado === 'espera')) {
      guia = '<div style="margin-top:16px;border:2px solid #22c55e;border-radius:12px;background:#f0fbf3;padding:14px 16px;text-align:center;">'
        + '<div style="font-size:1rem;font-weight:800;color:#15803d;">🎉 Se completaron todas las etapas</div>'
        + '<div style="font-size:0.88rem;color:#27500a;margin:4px 0 12px;">¿La escritura ya está <b>lista para entregar</b> al cliente?</div>'
        + '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">'
        + '<button type="button" onclick="lexEscMarcarLista(' + idx + ')" style="background:#15803d;color:#fff;border:none;border-radius:9px;padding:10px 20px;font-weight:800;font-size:0.85rem;cursor:pointer;">✔ Sí, está lista para entregar</button>'
        + '<button type="button" onclick="this.closest(\'div[style*=f0fbf3]\').querySelector(\'.lex-todavia\').style.display=\'block\'" style="background:#fff;color:#5a4a2a;border:1px solid #c8b68a;border-radius:9px;padding:10px 18px;font-weight:700;font-size:0.82rem;cursor:pointer;">Todavía no</button>'
        + '</div><div class="lex-todavia" style="display:none;font-size:0.78rem;color:#7a6a4a;margin-top:10px;">Se queda <b>En proceso</b>. Si falta algo, toque la bolita de esa etapa para regresarla.</div></div>';
      if (btnEnt) btnEnt.style.display = 'none';
      if (hint) hint.style.display = 'none';
    } else if (estado === 'listo') {
      guia = '<div style="margin-top:16px;border:2px solid #185fa5;border-radius:12px;background:#eef5fd;padding:14px 16px;text-align:center;">'
        + '<div style="font-size:1rem;font-weight:800;color:#0c447c;">📦 Lista para entregar</div>'
        + '<div style="font-size:0.88rem;color:#0c447c;margin:4px 0 12px;">¿El cliente <b>ya recogió</b> su escritura?</div>'
        + '<button type="button" onclick="escConfirmarEntrega()" style="background:#185fa5;color:#fff;border:none;border-radius:9px;padding:10px 20px;font-weight:800;font-size:0.85rem;cursor:pointer;">✔ Sí, se entregó — confirmar entrega</button></div>';
      if (btnEnt) btnEnt.style.display = 'none';
      if (hint) hint.style.display = 'none';
    } else if (estado === 'archivado') {
      var fEnt = e.entregaConfirmadaFecha ? new Date(e.entregaConfirmadaFecha).toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' }) : '';
      guia = '<div style="margin-top:16px;border:1.5px solid #9fb6cf;border-radius:12px;background:#f6f8fb;padding:12px 16px;text-align:center;font-size:0.88rem;color:#2c3a52;">'
        + '✅ <b>Concluida y entregada</b>' + (e.entregaRecibioPor ? ' · la recibió <b>' + E(e.entregaRecibioPor) + '</b>' : '') + (fEnt ? ' · ' + E(fEnt) : '') + '</div>';
      if (btnEnt) btnEnt.style.display = 'none';
      if (hint) hint.style.display = 'none';
    }
    html += guia;
    box.innerHTML = html;
  }
  // "Sí, está lista para entregar": estatus → Listo para entregar + tarea de llamar al cliente
  window.lexEscMarcarLista = function(idx){
    resyncIdx();
    var i = (typeof _escIdx !== 'undefined' && _escIdx >= 0) ? _escIdx : idx;
    var e = D.escrituras && D.escrituras[i]; if (!e) return;
    e.estado = 'listo';
    e.fechaMod = new Date().toISOString();
    historial(e, 'Estatus: Listo para entregar (todas las etapas completas)');
    tareaLlamada(e, 'entrega', 'para avisarle que su ESCRITURA YA ESTÁ LISTA y pase a recogerla.');
    try { if (typeof escSetEstado === 'function') escSetEstado('listo'); } catch(_){}
    refrescar(e, i);
    try { if (typeof escMostrarDetalle === 'function') escMostrarDetalle(e); } catch(_){}
    toastS('📦 Lista para entregar — se creó la tarea para avisar al cliente');
  };
  window.lexEscPintarProgreso = pintarProgreso;

  // Tocar un círculo (índice de la línea de 6): corregir (hecho/actual) o adelantar (futuro)
  window.lexEscTocarCirculo = function(k){
    resyncIdx();
    var idx = (typeof _escIdx !== 'undefined') ? _escIdx : -1, e = idx >= 0 ? D.escrituras[idx] : null; if (!e) return;
    var va = vActivo(e), enCurso = (e.estado === 'proceso' || !e.estado);
    // Oct-2026: REVERTIR — bolita ya hecha (o escritura concluida/lista por
    // error) → preguntar y regresar hasta esa etapa, con estatus En proceso.
    var cerrada = e.estado === 'listo' || e.estado === 'archivado';
    var anulada = e.estado === 'cancelado' || e.estado === 'noprocedio';
    if (!anulada && (cerrada || (vEstado(e, k) === 'completado' && !(enCurso && k === va)))) return revertirHasta(idx, k);
    if (va >= 0 && k > va && enCurso) return saltarHasta(idx, k);
    if (k < 4) { if (typeof escAbrirPaso === 'function') escAbrirPaso(k); return; }
    if (k === 5) { if (typeof escAbrirPaso === 'function') escAbrirPaso(4); return; }
    // Bolita 5 · Escritura de la notaría
    if (va === 4 && enCurso) return window.lexEscSiguienteEtapa(idx);
    var p4 = pasosDe(e)[4];
    if (p4.estado === 'pendiente' && p4.escrituraRecibida) {
      var w0 = document.getElementById('lex-esc-salto'); if (w0) w0.remove();
      var ov = document.createElement('div'); ov.id = 'lex-esc-salto';
      ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Helvetica,Arial,sans-serif;';
      ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fdfaf3;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:460px;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#1a1008;overflow:hidden;">'
        + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-family:monospace;font-size:12px;letter-spacing:0.1em;">✎ CORREGIR · ESCRITURA DE LA NOTARÍA</div>'
        + '<div style="padding:14px 16px;font-size:13px;line-height:1.5;">Está marcado que la notaría <b>ya entregó la escritura</b>' + (p4.escrituraRecibidaFecha ? ' (' + E(new Date(p4.escrituraRecibidaFecha).toLocaleDateString('es-MX')) + ')' : '') + '.<br>¿Desea regresarla a <b>pendiente</b>?'
        + '<div style="display:flex;gap:8px;margin-top:14px;"><button type="button" id="cn-no" style="flex:1;border:1px solid #c8951a;background:#fff;color:#9a6e18;border-radius:7px;padding:10px;font-weight:700;cursor:pointer;">Dejar como está</button>'
        + '<button type="button" id="cn-si" style="flex:1;border:none;background:#a32d2d;color:#fff;border-radius:7px;padding:10px;font-weight:800;cursor:pointer;">Regresar a pendiente</button></div></div></div>';
      document.body.appendChild(ov);
      ov.querySelector('#cn-no').onclick = function(){ ov.remove(); };
      ov.querySelector('#cn-si').onclick = function(){
        p4.escrituraRecibida = false; p4.escrituraRecibidaFecha = ''; p4.fechaAutoInicio = new Date().toISOString(); p4.plazoDias = DIAS_INTER; p4.fecha = fechaTxt();
        p4.notas = 'Pendiente: solicitar a la notaría la entrega de la escritura';
        historial(e, 'Corrección: la notaría aún no entrega la escritura');
        var ahoraC = new Date().toISOString();
        tareas().forEach(function(t){ if (t && t.estado !== 'resuelta' && t.escId === String(e.id) && t.escMotivo === 'registro') { t.estado = 'resuelta'; t.fechaResolucion = ahoraC; t.fechaMod = ahoraC; t.resueltaPor = 'Automático (corrección)'; } });
        tareaInterna(e, 'notaria-escritura', 'Solicitar a la notaría la entrega de la escritura', hoyISO(0));
        e.fechaMod = new Date().toISOString(); ov.remove(); refrescar(e, idx); toastS('✎ Escritura de la notaría: regresó a pendiente');
      };
      return;
    }
    toastS('Para corregir esta etapa, corrija primero el Registro Público (bolita 6).');
  };
  function tareasAlEntrar(e, j){
    var muni = String(e.ubicacion || '').trim();
    if (j === 2) { tareaLlamada(e, 'traslado', 'para que vaya a pagar su TRASLADO DE DOMINIO' + (muni ? ' en ' + muni : ' en su municipio') + ' y traiga el comprobante. Tiene ' + DIAS_INTER + ' días.'); recordatorio(e, 'traslado-mitad', 'Seguimiento: ¿ya pagó el traslado de dominio?', Math.floor(DIAS_INTER / 2)); }
    if (j === 3) tareaInterna(e, 'isr-enviar', 'Llevar el expediente al notario para que genere el ISR', hoyISO(0));
    if (j === 4) tareaInterna(e, 'notaria-escritura', 'Solicitar a la notaría la entrega de la escritura', hoyISO(0));
  }
  // ── REVERTIR hasta la bolita j (0-5) ─────────────────────────────────
  // Deshace j y todas las de después; la escritura vuelve a "En proceso".
  var MOTIVOS_DESDE = { 1: ['traslado','traslado-mitad','isr-enviar','notaria-escritura','registro','entrega'], 2: ['traslado','traslado-mitad','isr-enviar','notaria-escritura','registro','entrega'],
    3: ['isr-enviar','notaria-escritura','registro','entrega'], 4: ['notaria-escritura','registro','entrega'], 5: ['registro','entrega'], 0: ['traslado','traslado-mitad','isr-enviar','notaria-escritura','registro','entrega'] };
  function revertirHasta(idx, j){
    var e = D.escrituras[idx]; if (!e) return;
    var va = vActivo(e), cerrada = e.estado === 'listo' || e.estado === 'archivado';
    var hasta = cerrada || va < 0 ? 5 : va;
    var deshacer = []; for (var k = j; k <= hasta; k++) if (vEstado(e, k) === 'completado' || cerrada || k === va) deshacer.push(k);
    var EST = { proceso:'En proceso', listo:'Listo para entregar', archivado:'Concluida y entregada', espera:'En pausa' };
    var opciones = j === 0 ? [['esperando','Por firmar (pendiente)']]
      : j === 4 ? [['esperando','La notaría aún NO entrega la escritura (empieza su plazo de ' + DIAS_INTER + ' días)']]
      : [['esperando','Por iniciar (empieza su plazo de ' + DIAS_INTER + ' días)'], ['activo','Ya está en trámite' + (j === 1 ? ' en Catastro' : j === 5 ? ' en el Registro' : '')]];
    var viejo = document.getElementById('lex-esc-salto'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-esc-salto';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Helvetica,Arial,sans-serif;';
    ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fdfaf3;border:1.5px solid #a32d2d;border-radius:12px;width:100%;max-width:520px;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#1a1008;overflow:hidden;">'
      + '<div style="background:#a32d2d;color:#fff;padding:10px 16px;font-family:monospace;font-size:12px;letter-spacing:0.1em;display:flex;justify-content:space-between;"><span>⏪ REVERTIR HASTA ' + E(V_NOMBRE[j]).toUpperCase() + '</span><span id="rv-x" style="cursor:pointer;">✕</span></div>'
      + '<div style="padding:14px 16px;font-size:13px;line-height:1.5;">'
      + (cerrada ? '<div style="background:#fcebeb;border:1px solid #efb3b3;color:#791f1f;border-radius:8px;padding:8px 10px;margin-bottom:10px;">Esta escritura está como <b>' + E(EST[e.estado] || e.estado) + '</b>. Al revertir, su estatus cambiará en automático a <b>En proceso</b>.</div>' : '')
      + '<div style="margin-bottom:6px;">Se van a <b>deshacer</b> estas etapas:</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;">' + deshacer.map(function(k){ return '<span style="background:#fff;border:1px solid #efb3b3;color:#a32d2d;border-radius:12px;padding:2px 10px;font-size:12px;font-weight:700;">' + (k + 1) + ' · ' + E(V_NOMBRE[k]) + '</span>'; }).join('') + '</div>'
      + '<div style="font-family:monospace;font-size:10px;color:#8a7f6a;letter-spacing:0.08em;margin-bottom:4px;">¿CÓMO ESTÁ ' + E(V_NOMBRE[j]).toUpperCase() + '?</div>'
      + opciones.map(function(o, n){ return '<label style="display:flex;align-items:center;gap:8px;padding:4px 2px;cursor:pointer;"><input type="radio" name="rv-est" value="' + o[0] + '"' + (n === 0 ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('')
      + '<label style="display:flex;align-items:center;gap:10px;margin-top:12px;padding:8px 10px;border:1.5px solid #a32d2d;border-radius:8px;background:#fff;cursor:pointer;font-weight:700;color:#a32d2d;"><input type="checkbox" id="rv-seguro" style="width:18px;height:18px;"> Sí, estoy seguro de revertir</label>'
      + '<div id="rv-err" style="color:#a32d2d;font-size:12px;min-height:16px;margin-top:6px;"></div>'
      + '<div style="display:flex;gap:8px;margin-top:4px;"><button type="button" id="rv-no" style="flex:1;border:1px solid #c8951a;background:#fff;color:#9a6e18;border-radius:7px;padding:10px;font-weight:700;font-size:12px;cursor:pointer;">Cancelar</button>'
      + '<button type="button" id="rv-si" style="flex:1.4;border:none;background:#a32d2d;color:#fff;border-radius:7px;padding:10px;font-weight:800;font-size:12px;cursor:pointer;">⏪ Revertir hasta ' + E(V_CORTO[j]) + '</button></div>'
      + (j !== 4 ? '<div style="font-size:11px;color:#8a7f6a;margin-top:8px;text-align:center;">¿Solo quiere corregir la nota o la fecha de esta etapa? Use <a href="#" id="rv-manual" style="color:#9a6e18;">corregir a mano</a>.</div>' : '')
      + '</div></div>';
    document.body.appendChild(ov);
    var q = function(s){ return ov.querySelector(s); };
    q('#rv-x').onclick = q('#rv-no').onclick = function(){ ov.remove(); };
    if (q('#rv-manual')) q('#rv-manual').onclick = function(ev){ ev.preventDefault(); ov.remove(); if (typeof escAbrirPaso === 'function') escAbrirPaso(j === 5 ? 4 : j); };
    q('#rv-si').onclick = function(){
      if (!q('#rv-seguro').checked) { q('#rv-err').textContent = 'Marque "Sí, estoy seguro de revertir" para continuar.'; return; }
      if (!confirm('¿Está seguro de revertir hasta ' + V_NOMBRE[j] + '?\n\nSe deshacen ' + deshacer.length + ' etapa(s) y el estatus quedará EN PROCESO.')) return;
      var est = (ov.querySelector('input[name="rv-est"]:checked') || {}).value || 'esperando';
      var eNow = (D.escrituras || []).filter(function(x){ return x && x.id === e.id; })[0] || e;
      var ps = pasosDe(eNow), estadoAntes = eNow.estado, desdeTxt = cerrada ? (EST[estadoAntes] || estadoAntes) : V_NOMBRE[va];
      var real = j < 4 ? j : 4;
      _sinHistorial = true;
      try {
      for (var r = real; r < 5; r++) ps[r] = { estado:'pendiente', notas:'', fecha:'' };
      if (j === 0) { ps[0] = { estado:'pendiente', notas:'', fecha:'', fechaAutoInicio: new Date().toISOString() }; }
      else if (j < 4) { if (est === 'activo') iniciarOficina(eNow, j); else abrirIntermedio(eNow, j); }
      else if (j === 4) { abrirIntermedio(eNow, 4); }
      else { if (est === 'activo') iniciarOficina(eNow, 4); else { abrirIntermedio(eNow, 4); marcarNotaria(eNow); } }
      eNow.estado = 'proceso';
      // Las tareas automáticas de las etapas deshechas ya no aplican
      var ahora = new Date().toISOString(), lista = MOTIVOS_DESDE[j] || [];
      tareas().forEach(function(t){
        if (!t || t.estado === 'resuelta' || t.escId !== String(eNow.id)) return;
        var m = String(t.escMotivo || ''), num = parseInt((/^falta-(\d)-/.exec(m) || [])[1], 10);
        if (lista.indexOf(m) >= 0 || (!isNaN(num) && num >= real)) { t.estado = 'resuelta'; t.fechaResolucion = ahora; t.fechaMod = ahora; t.resueltaPor = 'Automático: se revirtió la escritura (' + usuario() + ')'; }
      });
      // Tareas de la etapa a la que se regresa (si está por iniciar)
      if (est === 'esperando' && j >= 2 && j <= 4) tareasAlEntrar(eNow, j);
      if (est === 'esperando' && j === 5) tareaInterna(eNow, 'registro', 'Ingresar la escritura al Registro Público (IFREO)', hoyISO(0));
      } finally { _sinHistorial = false; }
      eNow.fechaMod = ahora; eNow.pasoActivoFecha = ahora;
      eNow.pasoActivoRequerimientos = false; eNow.pasoActivoEnEspera = false;
      ov.remove();
      var i2 = D.escrituras.indexOf(eNow);
      refrescar(eNow, i2);
      try { if (typeof escSetEstado === 'function') escSetEstado('proceso'); } catch(_){}
      try { if (typeof escAbrirDetalle === 'function' && i2 >= 0) escAbrirDetalle(i2); } catch(_){}
      toastS('⏪ Revertido hasta ' + V_NOMBRE[j] + ' · Estatus: En proceso');
    };
  }
  window.lexEscRevertirHasta = revertirHasta;
  // Avanzar hasta la bolita j (0-5) confirmando las etapas de en medio
  function saltarHasta(idx, j){
    var e = D.escrituras[idx], va = vActivo(e);
    var viejo = document.getElementById('lex-esc-salto'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-esc-salto';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Helvetica,Arial,sans-serif;';
    var etapas = []; for (var k = va; k < j; k++) etapas.push(k);
    var DESC = [' (firma ante notario)', ' (cédula y avalúo listos)', ' (el cliente ya pagó y entregó comprobante)', ' (ISR generado y pagado)', ' (la notaría ya entregó la escritura)', ''];
    var opciones = j === 4
      ? [['esperando','Por solicitar a la notaría (empieza su plazo de ' + DIAS_INTER + ' días)'], ['hecho','La notaría ya la entregó']]
      : [['esperando','Por iniciar (empieza su plazo de ' + DIAS_INTER + ' días)'], ['activo','Ya está en trámite' + (j === 1 ? ' en Catastro (plazo 60 días)' : j === 5 ? ' en el Registro (plazo 30 días)' : '')], ['hecho','Ya también está terminada']];
    var html = '<div role="dialog" aria-modal="true" style="background:#fdfaf3;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:520px;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#1a1008;overflow:hidden;">'
      + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-family:monospace;font-size:12px;letter-spacing:0.1em;display:flex;justify-content:space-between;"><span>⏩ AVANZAR HASTA ' + E(V_NOMBRE[j]).toUpperCase() + '</span><span id="salto-x" style="cursor:pointer;">✕</span></div>'
      + '<div style="padding:14px 16px;">'
      + '<div style="font-size:13px;margin-bottom:10px;">Para avanzar hasta <b>' + E(V_NOMBRE[j]) + '</b>, confirme que ya se superaron estas etapas:</div>'
      + etapas.map(function(k){ return '<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #eadfbf;border-radius:8px;background:#fff;margin-bottom:6px;cursor:pointer;font-size:13px;"><input type="checkbox" class="salto-chk" data-k="' + k + '" style="width:18px;height:18px;"><span><b>' + (k + 1) + ' · ' + E(V_NOMBRE[k]) + '</b> ya se superó' + DESC[k] + '</span></label>'; }).join('')
      + '<div style="font-family:monospace;font-size:10px;color:#8a7f6a;letter-spacing:0.08em;margin:12px 0 6px;">¿CÓMO ESTÁ ' + E(V_NOMBRE[j]).toUpperCase() + '?</div>'
      + opciones.map(function(o, n){ return '<label style="display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 2px;cursor:pointer;"><input type="radio" name="salto-est" value="' + o[0] + '"' + (n === 0 ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('')
      + '<div id="salto-err" style="color:#a32d2d;font-size:12px;min-height:16px;margin-top:6px;"></div>'
      + '<div style="display:flex;gap:8px;margin-top:6px;"><button type="button" id="salto-no" style="flex:1;border:1px solid #c8951a;background:#fff;color:#9a6e18;border-radius:7px;padding:10px;font-weight:700;font-size:12px;cursor:pointer;">Cancelar</button>'
      + '<button type="button" id="salto-si" style="flex:1.4;border:none;background:#1a7a3a;color:#fff;border-radius:7px;padding:10px;font-weight:800;font-size:12px;cursor:pointer;">⏩ Avanzar hasta ' + E(V_CORTO[j]) + '</button></div>'
      + (j !== 4 ? '<div style="font-size:11px;color:#8a7f6a;margin-top:8px;text-align:center;">Para corregir a mano esta etapa sin avanzar, use <a href="#" id="salto-manual" style="color:#9a6e18;">corregir a mano</a>.</div>' : '')
      + '</div></div>';
    ov.innerHTML = html; document.body.appendChild(ov);
    var q = function(s){ return ov.querySelector(s); };
    q('#salto-x').onclick = q('#salto-no').onclick = function(){ ov.remove(); };
    if (q('#salto-manual')) q('#salto-manual').onclick = function(ev){ ev.preventDefault(); ov.remove(); if (typeof escAbrirPaso === 'function') escAbrirPaso(j === 5 ? 4 : j); };
    q('#salto-si').onclick = function(){
      var faltan = [].slice.call(ov.querySelectorAll('.salto-chk')).filter(function(c){ return !c.checked; });
      if (faltan.length) { q('#salto-err').textContent = 'Marque todas las etapas: solo se puede avanzar si ya se superaron.'; return; }
      var est = (ov.querySelector('input[name="salto-est"]:checked') || {}).value || 'esperando';
      var eNow = (D.escrituras || []).filter(function(x){ return x && x.id === e.id; })[0] || e;
      etapas.forEach(function(k){
        if (k === 4) { marcarNotaria(eNow); return; }
        var a0 = activoDe(eNow);
        resolverTareas(eNow, k, k === a0 ? (a0 === 0 ? 'firma' : (pasosDe(eNow)[k].estado === 'activo' ? 'oficina' : 'intermedio')) : 'intermedio');
        completar(eNow, k);
      });
      if (j < 4) {
        if (est === 'esperando') { abrirIntermedio(eNow, j); tareasAlEntrar(eNow, j); }
        else if (est === 'activo') iniciarOficina(eNow, j);
        else { completar(eNow, j); abrirIntermedio(eNow, j + 1); tareasAlEntrar(eNow, j + 1); }
      } else if (j === 4) {
        abrirIntermedio(eNow, 4);
        if (est === 'hecho') { marcarNotaria(eNow); tareaInterna(eNow, 'registro', 'Ingresar la escritura al Registro Público (IFREO)', hoyISO(0)); }
        else tareasAlEntrar(eNow, 4);
      } else {
        if (est === 'esperando') { if (!pasosDe(eNow)[4].escrituraRecibida) marcarNotaria(eNow); tareaInterna(eNow, 'registro', 'Ingresar la escritura al Registro Público (IFREO)', hoyISO(0)); }
        else if (est === 'activo') { resolverTareas(eNow, 4, 'intermedio'); iniciarOficina(eNow, 4); }
        else { resolverTareas(eNow, 4, 'intermedio'); completar(eNow, 4); eNow.estado = 'listo'; tareaLlamada(eNow, 'entrega', 'para avisarle que su ESCRITURA YA ESTÁ LISTA y pase a recogerla.'); }
      }
      historial(eNow, 'Avance directo hasta ' + V_NOMBRE[j] + (etapas.length ? ' (se confirmaron ' + etapas.map(function(k){ return V_NOMBRE[k]; }).join(', ') + ')' : ''));
      eNow.fechaMod = new Date().toISOString(); eNow.pasoActivoFecha = new Date().toISOString();
      eNow.pasoActivoRequerimientos = false; eNow.pasoActivoEnEspera = false;
      ov.remove();
      refrescar(eNow, D.escrituras.indexOf(eNow));
      toastS('⏩ Avanzó hasta ' + V_NOMBRE[j]);
    };
  }
  (function engancharProgreso(){
    var o = window.escActualizarTimelineDetalle;
    if (typeof o !== 'function' || o._lexProg) return;
    var w3 = function(){ var r = o.apply(this, arguments); try { pintarProgreso(); } catch(err){ console.warn('[Progreso escrituras]', err); } return r; };
    w3._lexProg = true; window.escActualizarTimelineDetalle = w3;
  })();

  // ── Oct-2026 · Confirmar al GUARDAR con estatus Concluido o Cancelado ──
  (function confirmarEstatusFinal(){
    var o = window.escGuardar; if (typeof o !== 'function' || o._lexEstFin) return;
    var NOM = { archivado:'CONCLUIDO Y ENTREGADO', cancelado:'CANCELADO', noprocedio:'CANCELADO (no procedió)' };
    var w = function(){
      try {
        var nuevo = String((document.getElementById('eEstado') || {}).value || '');
        var idx = (typeof _escIdx !== 'undefined') ? _escIdx : -1, e = idx >= 0 ? D.escrituras[idx] : null;
        var antes = e ? String(e.estado || 'proceso') : '';
        if (NOM[nuevo] && nuevo !== antes) {
          var quien = e ? ((e.compradores || [])[0] ? (typeof e.compradores[0] === 'string' ? e.compradores[0] : e.compradores[0].nombre) : '') : '';
          if (!confirm('¿Seguro que quiere guardar esta escritura como ' + NOM[nuevo] + '?\n\n' + (quien ? 'Cliente: ' + quien + '\n' : '')
            + 'Saldrá de "En proceso" y ya no aparecerá en la lista de trabajo.\n\nAceptar = guardar · Cancelar = regresar')) return;
        }
      } catch(err){ console.warn('[Confirmar estatus]', err); }
      // Mientras GUARDAR trabaja, su propio cierre de la ventana no debe preguntar
      window._lexGuardandoEsc = true;
      try { return o.apply(this, arguments); }
      finally {
        window._lexGuardandoEsc = false;
        var m = document.getElementById('mEscritura');
        if (m && !m.classList.contains('show') && typeof window.lexEscFotoForm === 'function') window.lexEscFotoForm();
      }
    };
    for (var k in o) { try { w[k] = o[k]; } catch(_){} }
    w._lexEstFin = true; window.escGuardar = w;
  })();

  window._lexEscAsisConfig = config;
})();
