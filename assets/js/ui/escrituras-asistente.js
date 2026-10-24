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
  } catch(e){}

  function E(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function usuario(){ try { if (typeof empleadoActual !== 'undefined' && empleadoActual) return empleadoActual.nombre || empleadoActual.email || ''; } catch(e){} return ''; }
  function toastS(m, t){ try { if (typeof toast === 'function') toast(m, t); } catch(e){} }
  function hoyISO(off){ var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fechaTxt(){ return new Date().toLocaleString('es-MX', { timeZone:'America/Mexico_City', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
  function fLarga(ms){ try { return new Date(ms).toLocaleDateString('es-MX', { day:'numeric', month:'long' }); } catch(e){ return ''; } }
  function nom(p){ return typeof p === 'string' ? p : ((p && p.nombre) || ''); }

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
  function activoDe(e){ var ps = pasosDe(e), c = 0; for (var i = 0; i < 5; i++) { if (ps[i].estado === 'completado') c++; else break; } return c < 5 ? c : -1; }

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
      siguiente: 'ISR listo → ingresar al Registro Público', accion: function(){
        completar(e, 3); abrirIntermedio(e, 4);
        tareaInterna(e, 'registro', 'Ingresar la escritura al Registro Público (IFREO)', hoyISO(0));
      }
    };
    if (i === 4 && fase === 'intermedio') return {
      titulo: 'Intermedio · Ingresar al Registro Público', plazo: DIAS_INTER,
      preguntas: [{ k:'ingreso', t:'¿Ya se ingresó la escritura al Registro Público (IFREO)?', falta:'Falta ingresar la escritura al Registro Público' }],
      siguiente: 'Ya está en el Registro Público (hasta 1 mes)', accion: function(){ iniciarOficina(e, 4); }
    };
    if (i === 4) return {
      titulo: 'Paso 5 · En el Registro Público (IFREO)', plazo: DIAS_OFICINA[4],
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
  function historial(e, txt){ if (!Array.isArray(e.historialPasos)) e.historialPasos = []; e.historialPasos.push({ fecha: new Date().toISOString(), por: usuario(), texto: txt }); }
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
  var RESUELVE = { '2':['traslado','traslado-mitad'], '3-intermedio':['isr-enviar'], '4-intermedio':['registro'] };
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
    var e = D.escrituras && D.escrituras[idx]; if (!e) return;
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
    var viejo = document.getElementById('lex-esc-asis'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-esc-asis';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Helvetica,Arial,sans-serif;';
    document.body.appendChild(ov);
    var COL = ['#5f5e5a', '#b06a10', '#534ab7', '#185fa5', '#0f6e56'];
    function visibles(){ return cfg.preguntas.filter(function(q){ return !q.si || resp[q.si] === 'si'; }); }
    function faltan(){ return visibles().filter(function(q){ return !q.neutral && resp[q.k] === 'no'; }); }
    function completo(){
      var okQ = visibles().every(function(q){ return q.neutral ? !!resp[q.k] : resp[q.k] === 'si'; });
      var okD = (cfg.datos || []).every(function(d){ return String(datos[d.k] || '').trim(); });
      return okQ && okD;
    }
    function pintar(){
      var cli = cliente(e), pl = cfg.plazo ? infoPlazo(e, i) : null;
      var barra = ''; for (var b = 0; b < 5; b++) {
        var st = pasosDe(e)[b].estado, hecho = st === 'completado', aqui = b === i;
        barra += '<span style="width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;' + (hecho ? 'background:#1a7a3a;color:#fff;' : aqui ? 'background:' + COL[b] + ';color:#fff;' : 'border:2px solid #d3c6a6;color:#a89c80;') + '">' + (hecho ? '✓' : (b + 1)) + '</span>' + (b < 4 ? '<span style="flex:1;height:3px;background:' + (hecho ? '#1a7a3a' : '#e5dcc4') + ';"></span>' : '');
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
      var avisoFalta = fl.length ? '<div style="background:#fcebeb;border:1px solid #efb3b3;color:#a32d2d;border-radius:8px;padding:8px 10px;margin:4px 0 8px;font-size:12px;">⚠ ' + fl.map(function(q){ return E(q.falta); }).join(' · ') + '.<br>Se guardará como <b>Llamado a la Acción</b>' + (fl.some(function(q){ return q.cliente; }) ? ' y se creará una tarea en <b>Tareas de hoy</b> para llamar al cliente (📞)' : '') + '.</div>' : '';
      var ok = completo();
      ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fdfaf3;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:640px;max-height:94vh;overflow-y:auto;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#1a1008;">'
        + '<div style="position:sticky;top:0;background:#1a1008;color:#e8c875;padding:10px 16px;font-family:monospace;font-size:12px;letter-spacing:0.1em;display:flex;justify-content:space-between;"><span>▶ SIGUIENTE ETAPA · ' + E(String(cli.nombre).toUpperCase()) + '</span><span id="asis-x" style="cursor:pointer;" title="Cerrar sin guardar">✕</span></div>'
        + '<div style="padding:14px 16px;">'
        + '<div style="display:flex;align-items:center;gap:5px;margin-bottom:10px;">' + barra + '</div>'
        + '<div style="font-family:monospace;font-size:11px;color:' + COL[i] + ';letter-spacing:0.08em;font-weight:800;margin-bottom:8px;">' + E(cfg.titulo).toUpperCase() + '</div>'
        + plazoHtml
        + (ds ? '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">' + ds + '</div>' : '')
        + '<div style="font-family:monospace;font-size:10px;color:#8a7f6a;letter-spacing:0.08em;margin-bottom:6px;">RESPONDA PARA AVANZAR</div>' + qs + avisoFalta
        + '<textarea id="asis-nota" rows="2" placeholder="Nota adicional (opcional)" style="width:100%;box-sizing:border-box;border:1px solid #d8c08a;border-radius:6px;padding:7px 9px;font-size:12.5px;font-family:inherit;resize:vertical;margin-top:4px;">' + E(ov._nota || '') + '</textarea>'
        + '<div style="display:flex;gap:8px;margin-top:10px;">'
        + '<button type="button" id="asis-guardar" style="flex:1;border:1px solid #c8951a;background:#fff;color:#9a6e18;border-radius:7px;padding:10px;font-weight:700;font-size:12px;cursor:pointer;">💾 Guardar avance (sigue aquí)</button>'
        + '<button type="button" id="asis-avanzar" ' + (ok ? '' : 'disabled') + ' style="flex:1.3;border:none;border-radius:7px;padding:10px;font-weight:800;font-size:12px;' + (ok ? 'background:#1a7a3a;color:#fff;cursor:pointer;' : 'background:#e5dcc4;color:#8a7f6a;cursor:not-allowed;') + '">▶ ' + E(cfg.siguiente) + '</button>'
        + '</div><div style="font-size:11px;color:#8a7f6a;margin-top:6px;text-align:center;">' + (ok ? 'Todo listo para avanzar.' : 'El botón para avanzar se habilita cuando todo está en "Sí"' + ((cfg.datos || []).length ? ' y los datos están capturados' : '') + '.') + '</div>'
        + '</div></div>';
      ov.querySelector('#asis-x').onclick = function(){ ov.remove(); };
      ov.querySelectorAll('[data-q]').forEach(function(b){ b.onclick = function(){ ov._nota = ov.querySelector('#asis-nota').value; resp[b.getAttribute('data-q')] = b.getAttribute('data-v'); pintar(); }; });
      ov.querySelectorAll('[data-d]').forEach(function(inp){ inp.oninput = function(){ datos[inp.getAttribute('data-d')] = inp.value; var okAhora = completo(), bA = ov.querySelector('#asis-avanzar'); bA.disabled = !okAhora; bA.style.background = okAhora ? '#1a7a3a' : '#e5dcc4'; bA.style.color = okAhora ? '#fff' : '#8a7f6a'; bA.style.cursor = okAhora ? 'pointer' : 'not-allowed'; }; });
      ov.querySelector('#asis-guardar').onclick = function(){ guardar(false); };
      ov.querySelector('#asis-avanzar').onclick = function(){ if (completo()) guardar(true); };
    }
    function guardar(avanzar){
      var nota = (ov.querySelector('#asis-nota') || {}).value || '';
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
      toastS(avanzar ? '✅ Listo: ' + cfg.siguiente.replace(/^🎉\s*/, '') : '💾 Avance guardado');
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
        if (cont && idx >= 0 && (e.estado === 'proceso' || !e.estado)) cont.insertAdjacentHTML('afterbegin', botonHtml(e, idx));
      } catch(err){ console.warn('[Asistente escrituras]', err); }
      return r;
    };
    env._lexAsis = true;
    window.escRenderNotasEtapa = env;
  })();
  (function engancharLista(){
    var orig = window.escRender;
    if (typeof orig !== 'function' || orig._lexAsisN) return;
    var env = function(){ try { (D.escrituras || []).forEach(normalizar); } catch(_){} return orig.apply(this, arguments); };
    for (var k in orig) { try { env[k] = orig[k]; } catch(_){} }
    env._lexAsisN = true;
    window.escRender = env;
  })();
  window._lexEscAsisConfig = config;
})();
