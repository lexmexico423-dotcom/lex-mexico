// ── Oct-2026 · ESCRITURAS: "Lista de trabajo" + tarjeta simplificada ───────
// A petición del Lic. Nahúm (las tarjetas con la línea de 5 bolitas eran
// confusas para los empleados). Vista nueva por defecto:
//  · Una línea por escritura: Cliente · Está en (paso N de 5) · Qué sigue ·
//    Tiempo en el paso (semáforo) · 📞 / abrir. Lo más atrasado arriba.
//  · Al tocar una línea se despliega la TARJETA SIMPLIFICADA (en palabras:
//    dónde está, qué sigue, barra de pasos con nombre, folios, botones).
//  · Botón "Vista anterior (tarjetas)" para volver a la vista de siempre.
// Solo cambia CÓMO SE VE: no toca datos, pasos ni guardados. Usa los mismos
// filtros (Todos / En Proceso / …) y el mismo buscador.
(function(){
  'use strict';
  if (window._lexEscListaV1) return;
  window._lexEscListaV1 = true;

  var CLAVE = 'lex-esc-vista';
  function vista(){ try { return localStorage.getItem(CLAVE) || 'lista'; } catch(e){ return 'lista'; } }
  function ponerVista(v){ try { localStorage.setItem(CLAVE, v); } catch(e){} }
  function E(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function nom(p){ return typeof p === 'string' ? p : ((p && p.nombre) || ''); }
  // Constantes del módulo de Escrituras (declaradas con const/let en receipt-restoration.js)
  function g(n, def){
    try {
      switch (n) {
        case 'ESC_PASOS': return typeof ESC_PASOS !== 'undefined' ? ESC_PASOS : def;
        case 'ESC_DIAS_REQUIERE_ATENCION': return typeof ESC_DIAS_REQUIERE_ATENCION !== 'undefined' ? ESC_DIAS_REQUIERE_ATENCION : def;
        case 'ESC_DIAS_REQUIERE_ATENCION_REQUERIMIENTOS': return typeof ESC_DIAS_REQUIERE_ATENCION_REQUERIMIENTOS !== 'undefined' ? ESC_DIAS_REQUIERE_ATENCION_REQUERIMIENTOS : def;
        case 'ESC_DIAS_REQUIERE_ATENCION_ESPERA': return typeof ESC_DIAS_REQUIERE_ATENCION_ESPERA !== 'undefined' ? ESC_DIAS_REQUIERE_ATENCION_ESPERA : def;
        case 'ESC_TIPOS_TRAMITE_CATASTRO': return typeof ESC_TIPOS_TRAMITE_CATASTRO !== 'undefined' ? ESC_TIPOS_TRAMITE_CATASTRO : def;
        case 'ESC_TIPOS_MOVIMIENTO': return typeof ESC_TIPOS_MOVIMIENTO !== 'undefined' ? ESC_TIPOS_MOVIMIENTO : def;
        case '_escFiltro': return typeof _escFiltro !== 'undefined' ? _escFiltro : def;
      }
    } catch(e){}
    return def;
  }
  var abiertas = {}; // id de escritura → tarjeta desplegada

  // ── Datos de cada escritura, en palabras ─────────────────────────────
  function datos(e){
    var PASOS = g('ESC_PASOS', ['FIRMA NOTARIAL','CATASTRO','TRASLADO MPL','ISR','IFREO']);
    var pasos = Array.isArray(e.pasos) && e.pasos.length ? e.pasos : [{},{},{},{},{}];
    var comp = 0; for (var i = 0; i < 5; i++) { if (pasos[i] && pasos[i].estado === 'completado') comp++; else break; }
    var completados = pasos.filter(function(p){ return p && p.estado === 'completado'; }).length;
    var activo = completados < 5 ? completados : -1;
    var pAct = activo >= 0 ? (pasos[activo] || {}) : null;
    // Oct-2026: línea de 6 bolitas — entre ISR y Registro va la ESCRITURA DE
    // LA NOTARÍA (dato: pasos[4].escrituraRecibida). Se arma una lista virtual.
    var V = window.lexEscVirtual;
    if (V && pasos.length >= 5) {
      PASOS = ['FIRMA NOTARIAL','CATASTRO','TRASLADO MPL','ISR','ESCRITURA NOTARÍA','IFREO'];
      var p4 = pasos[4] || {};
      pasos = [0, 1, 2, 3, 4, 5].map(function(k){ var st = V.estado(e, k); return k < 4 ? pasos[k] : Object.assign({}, p4, { estado: st }); });
      activo = activo === -1 ? -1 : V.activo(e);
      pAct = activo >= 0 ? pasos[activo] : null;
    }
    var dias = e.pasoActivoFecha ? Math.floor((Date.now() - new Date(e.pasoActivoFecha).getTime()) / 86400000) : null;
    if (dias !== null && (isNaN(dias) || dias < 0)) dias = null;
    var umbral = e.pasoActivoRequerimientos ? g('ESC_DIAS_REQUIERE_ATENCION_REQUERIMIENTOS', 8) : (e.pasoActivoEnEspera ? g('ESC_DIAS_REQUIERE_ATENCION_ESPERA', 15) : g('ESC_DIAS_REQUIERE_ATENCION', 30));
    var enCurso = e.estado === 'proceso' || !e.estado;   // sin estatus = recién creada, también cuenta
    var atencion = enCurso && activo >= 0 && dias !== null && dias >= umbral;
    // Oct-2026: también se marca vencida cuando el PLAZO INTERMEDIO del paso
    // (10 días, p.ej. presentar a Catastro tras la firma) ya pasó.
    var vencidoInter = 0;
    try { if (enCurso && pAct && typeof _escDiasRetrasoIntermedio === 'function') vencidoInter = _escDiasRetrasoIntermedio(pAct) || 0; } catch(_){}
    if (vencidoInter > 0) atencion = true;
    var acto = '';
    try { var t = (g('ESC_TIPOS_TRAMITE_CATASTRO', {})[e.tipoMovimiento] || []).find(function(x){ return x[0] === e.tipoTramiteCatastro; }); if (t) acto = String(t[1]); } catch(_){}
    if (!acto) { try { acto = g('ESC_TIPOS_MOVIMIENTO', {})[e.tipoMovimiento] || ''; } catch(_){} }
    var compradores = (e.compradores || []).map(nom).filter(Boolean);
    var vendedores = (e.vendedores || []).map(nom).filter(Boolean);
    // "Está en"
    var estaEn, estaSub = '';
    if (e.estado === 'listo') { estaEn = '✅ Listo para entregar'; }
    else if (e.estado === 'archivado') { estaEn = '🗄 Concluida y entregada'; }
    else if (e.estado === 'cancelado') { estaEn = '✕ Cancelada'; }
    else if (e.estado === 'noprocedio') { estaEn = '⛔ No procedió'; }
    else if (activo === -1) { estaEn = '✓ Todos los pasos terminados'; }
    else {
      estaEn = (activo + 1) + ' · ' + PASOS[activo];
      estaSub = (pAct && pAct.estado === 'activo') ? 'en trámite' : 'por iniciar';
      if (e.estado === 'espera') estaSub = 'en espera';
    }
    // "Qué sigue"
    var sigue = '';
    if (e.estado === 'proceso' || !e.estado || e.estado === 'espera') {
      if (activo === -1) sigue = e.notaFinal ? String(e.notaFinal) : 'Pasar a "Listo para entregar"';
      else if (pAct && pAct.notas) sigue = String(pAct.notas);
      else sigue = (pAct && pAct.estado === 'activo' ? 'Dar seguimiento a ' : 'Iniciar ') + (({'FIRMA NOTARIAL':'la firma notarial','CATASTRO':'Catastro','TRASLADO MPL':'Traslado MPL','ISR':'ISR','ESCRITURA NOTARÍA':'la entrega de la escritura por la notaría','IFREO':'IFREO'})[PASOS[activo]] || PASOS[activo].toLowerCase());
    } else if (e.estado === 'listo') sigue = 'Avisar al cliente y entregar la escritura';
    var fechaFirma = e.fechaFirma ? (function(){ try { return new Date(e.fechaFirma + 'T12:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' }); } catch(_){ return e.fechaFirma; } })() : (e.fechaFirmaTexto || '');
    return { pasos: pasos, PASOS: PASOS, activo: activo, dias: dias, umbral: umbral, atencion: atencion, vencidoInter: vencidoInter, acto: acto,
      compradores: compradores, vendedores: vendedores, estaEn: estaEn, estaSub: estaSub, sigue: sigue, fechaFirma: fechaFirma };
  }
  // Oct-2026: cada paso con su propio color (etiqueta), para distinguir el
  // avance de un vistazo: Firma gris · Catastro ámbar · Traslado morado ·
  // ISR azul · IFREO verde agua · Listo verde.
  // IFREO en azul petróleo (antes verde agua: se confundía con el verde de los pasos ya hechos)
  var COLOR_PASO = ['#5f5e5a', '#b06a10', '#534ab7', '#185fa5', '#0e7490'];
  var COLOR_PASO6 = ['#5f5e5a', '#b06a10', '#534ab7', '#185fa5', '#993556', '#0e7490'];   // con la bolita de la notaría
  function colorEstaEn(e, d){
    if (e.estado === 'listo' || d.activo === -1) return '#1a7a3a';
    if (e.estado === 'archivado') return '#7a6840';
    if (e.estado === 'cancelado') return '#6b6b6b';
    if (e.estado === 'noprocedio') return '#7a2020';
    return (d.PASOS.length === 6 ? COLOR_PASO6 : COLOR_PASO)[d.activo] || '#5f5e5a';
  }
  function chipEstaEn(e, d, grande){
    return '<span style="display:inline-block;background:' + colorEstaEn(e, d) + ';color:#fff;font-size:' + (grande ? '0.8rem' : '0.7rem') + ';font-weight:700;letter-spacing:0.02em;border-radius:12px;padding:' + (grande ? '2px 11px' : '3px 10px') + ';white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;">' + E(d.estaEn) + '</span>';
  }
  function semaforo(d, e){
    if (d.dias === null || !(e.estado === 'proceso' || !e.estado || e.estado === 'espera') || d.activo === -1) return '<span style="color:#9a8a6a;font-size:0.7rem;">—</span>';
    var col = d.dias >= d.umbral ? ['#fcebeb','#a32d2d'] : d.dias >= d.umbral / 2 ? ['#fdf0dc','#8a4a10'] : ['#eaf3de','#3b6d11'];
    return '<span title="Días en este paso (se marca en rojo a los ' + d.umbral + ')" style="display:inline-block;font-size:0.7rem;font-weight:700;border-radius:10px;padding:2px 9px;background:' + col[0] + ';color:' + col[1] + ';white-space:nowrap;">' + (d.dias >= d.umbral ? '⚠ ' : '') + d.dias + ' día' + (d.dias === 1 ? '' : 's') + '</span>';
  }
  // "compra a" / "recibe en donación de" / "con" según el acto
  // "ELSA LUCILA SANTIBAÑEZ" → "Elsa Lucila Santibañez" (partículas en minúscula)
  var PARTICULAS = { de:1, del:1, la:1, las:1, los:1, y:1, e:1, vda:1, 'vda.':1 };
  // Acentos de nombres y apellidos comunes que suelen capturarse sin acento
  // (solo para MOSTRAR; el dato guardado no cambia). Si la palabra ya trae
  // acento o no está en la lista, se deja como se capturó.
  var ACENTOS = {};
  ('gonzález hernández martínez pérez lópez sánchez ramírez rodríguez chávez gómez díaz jiménez álvarez juárez vázquez '
  + 'velázquez domínguez fernández gutiérrez márquez benítez méndez núñez suárez ibáñez yáñez narváez peláez sáenz '
  + 'santibáñez montaño rendón garcía guzmán román león simón rincón calderón colón obregón muñiz solís ríos avilés '
  + 'maría josé jesús ramón martín andrés inés raúl ángel ángela ángeles héctor víctor mónica verónica lucía sofía rocío '
  + 'concepción asunción adrián julián fabián sebastián cristóbal nicolás tomás matías elías efraín joaquín germán '
  + 'agustín valentín máximo fermín darío rubén noé isaías zacarías ezequías zoé dámaso tobías baltazar óscar '
  + 'hipólita hipólito eulalia natalia patricia régulo félix abigaíl apolinar porfirio teófilo crisóstomo eusebio '
  + 'nazario cipriano anastasio acevedo cervantes ambrocia bermúdez echeverría ordóñez córdova córdoba').split(' ').forEach(function(w){
    if (!w) return; var sin = w.normalize('NFD').replace(/\u0301/g, '').normalize('NFC'); // quita solo el acento (conserva la ñ)
    if (sin !== w) ACENTOS[sin] = w;
  });
  function nombrePropio(t){
    return String(t || '').trim().toLocaleLowerCase('es-MX').split(/\s+/).map(function(w, i){
      if (!w) return w;
      if (i > 0 && PARTICULAS[w]) return w;
      var k = w.normalize('NFD').replace(/\u0301/g, '').normalize('NFC');
      if (k === w && ACENTOS[k]) w = ACENTOS[k];
      return w.charAt(0).toLocaleUpperCase('es-MX') + w.slice(1);
    }).join(' ');
  }
  function verboRel(d){
    var a = String(d.acto || '').toUpperCase();
    return /COMPRAVENTA|COMPRA/.test(a) ? 'compra a' : /DONACI/.test(a) ? 'recibe en donación de' : /ADJUDICA|HERENCIA|SUCESI/.test(a) ? 'recibe de' : 'con';
  }
  function relacion(d){
    if (!d.vendedores.length) return '';
    return verboRel(d) + ' ' + d.vendedores.join(', ');
  }
  // Oct-2026: colores — la otra parte en AZUL; el acto en etiqueta de color
  // según el tipo; solo los NÚMEROS (instrumento, volumen, firma, carpeta) en verde.
  var VERDE = '#1a7a3a';
  function colorActo(a){
    a = String(a || '').toUpperCase();
    if (/COMPRAVENTA|COMPRA/.test(a)) return ['#e6f1fb', '#0c447c'];
    if (/DONACI/.test(a)) return ['#eeedfe', '#3c3489'];
    if (/ADJUDICA|HERENCIA|SUCESI|TESTAMENT/.test(a)) return ['#e1f5ee', '#085041'];
    return ['#f1efe8', '#444441'];
  }
  function num(v){ return '<b style="font-weight:700;color:' + VERDE + ';font-family:monospace;">' + E(v) + '</b>'; }
  // N° de trámite por CONTEO (igual que el antiguo "ESCRITURA 98"): se
  // numeran las escrituras EN CURSO (En proceso + Listo p/Entregar + recién
  // creadas sin estatus) por fecha de firma — la más antigua es la 1 y la más
  // reciente el número más alto. Se calcula sobre TODAS las escrituras (no
  // solo las filtradas) para que el número no cambie al buscar o filtrar.
  // Oct-2026: fecha de firma "efectiva" para ordenar — fechaFirma (AAAA-MM-DD);
  // si solo se capturó como texto ("2019", "9 jul 2026") se interpreta; si no hay
  // fecha de firma (recién creada desde el recibo) se usa la fecha de alta.
  var MES_N = { ene:1, feb:2, mar:3, abr:4, may:5, jun:6, jul:7, ago:8, sep:9, set:9, oct:10, nov:11, dic:12 };
  function fechaOrden(x){
    if (!x) return '0000-00-00';
    var f = String(x.fechaFirma || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(f)) return f.slice(0, 10);
    var t = String(x.fechaFirmaTexto || f || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var m = /(\d{1,2})\s*(?:de\s*)?([a-z]{3})[a-z]*\.?\s*(?:de\s*|del\s*)?(\d{4})/.exec(t);
    if (m && MES_N[m[2]]) return m[3] + '-' + String(MES_N[m[2]]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    m = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(t);
    if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    m = /(\d{4})/.exec(t);
    if (m) return m[1] + '-12-31';
    var alta = String(x.fechaCreacion || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(alta)) return alta;
    return '0000-00-00';
  }
  function mapaNumeros(){
    var act = (D.escrituras || []).filter(function(x){ return x && (!x.estado || x.estado === 'proceso' || x.estado === 'listo'); })
      .slice().sort(function(a, b){ return fechaOrden(b).localeCompare(fechaOrden(a)); });
    var m = new Map(), tot = act.length;
    act.forEach(function(x, i){ m.set(x, tot - i); });
    return { mapa: m, total: tot };
  }
  function datosSecundarios(e, d){
    var partes = [];
    if (d.acto) { var ca = colorActo(d.acto); partes.push('<span style="display:inline-block;font-size:0.62rem;font-weight:700;letter-spacing:0.03em;border-radius:10px;padding:0 7px;background:' + ca[0] + ';color:' + ca[1] + ';">' + E(String(d.acto).toUpperCase()) + '</span>'); }
    if (e.instrumento) partes.push('Instr. ' + num(e.instrumento));
    if (e.volumen) partes.push('Vol. ' + num(e.volumen));
    if (d.fechaFirma) partes.push('Firma ' + num(d.fechaFirma));
    if (e.num) { var cn = String(e.num).trim(); partes.push(/^carp/i.test(cn) ? 'CARP.- ' + num(cn.replace(/^carp\.?-?\s*/i, '')) : 'CARP.- ' + num(cn)); }
    return partes.join(' · ');
  }

  // ── Tarjeta simplificada (opción A) ──────────────────────────────────
  function tarjeta(e, idx, d){
    var barra = d.PASOS.map(function(n, i){
      var p = d.pasos[i] || {};
      var hecho = p.estado === 'completado', aqui = i === d.activo;
      var col = hecho ? '#1a7a3a' : aqui ? '#2a1c08' : '#b4a88a';
      return '<div style="flex:1;min-width:0;text-align:center;">'
        + '<div style="height:6px;border-radius:3px;background:' + (hecho ? '#1a7a3a' : aqui ? '#c8951a' : '#eadfbf') + ';"></div>'
        + '<div style="font-size:0.62rem;margin-top:3px;color:' + col + ';font-weight:' + (aqui ? '700' : '400') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (hecho ? '✓ ' : aqui ? '● ' : '') + E(({'FIRMA NOTARIAL':'Firma notarial','CATASTRO':'Catastro','TRASLADO MPL':'Traslado MPL','ISR':'ISR','ESCRITURA NOTARÍA':'Notaría','IFREO':'IFREO'})[n] || n) + '</div></div>';
    }).join('<div style="width:4px;"></div>');
    var folios = '';
    try { if (typeof _escFoliosHtml === 'function') { var fh = _escFoliosHtml(e, 'escAbrirRecibo', ' · '); if (fh) folios = '<span style="font-size:0.72rem;color:#1a4a8a;">🧾 Recibo: ' + fh + '</span>'; } } catch(_){}
    return '<div style="background:#fffdf6;border-top:1px dashed #d8c08a;padding:12px 16px 14px 16px;">'
      + '<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;">'
      + '<span style="font-size:0.82rem;">Está en: ' + chipEstaEn(e, d, true)
      + (d.activo >= 0 && /^\d/.test(d.estaEn) ? ' <span style="font-size:0.7rem;color:#7a6a4a;">(paso ' + (d.activo + 1) + ' de ' + d.PASOS.length + (d.estaSub ? ', ' + E(d.estaSub) : '') + ')</span>' : '') + '</span>'
      + (d.dias !== null && d.activo >= 0 ? '<span style="font-size:0.74rem;color:#5a4a2a;">Lleva ' + semaforo(d, e) + ' en este paso</span>' : '')
      + '</div>'
      + (d.sigue ? '<div style="margin-top:8px;font-size:0.84rem;color:' + (d.atencion ? '#a32d2d' : '#8a3a10') + ';">👉 Qué sigue: <b style="font-weight:600;">' + E(d.sigue) + '</b></div>' : '')
      + '<div style="display:flex;align-items:flex-start;margin-top:10px;">' + barra + '</div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:10px;">'
      // Oct-2026: observación inicial del trámite (la misma del expediente:
      // e.bitacora[0].texto), discreta y en máximo 2 líneas; completa al pasar el mouse.
      + (function(){
          var obs = String((Array.isArray(e.bitacora) && e.bitacora[0] && e.bitacora[0].texto) || '').trim();
          if (!obs) return '<div style="flex:1;"></div>';
          return '<div title="' + E(obs) + '" style="display:flex;gap:8px;align-items:flex-start;flex:1;min-width:0;">'
            + '<span style="font-size:0.95rem;line-height:1;">📄</span>'
            + '<div style="font-size:0.72rem;line-height:1.4;color:#8a7a5a;font-style:italic;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + E(obs) + '</div></div>';
        })()
      + '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">'
      // Oct-2026: número de carpeta junto al teléfono (si tiene)
      + (String(e.num || '').trim() ? '<span title="Número de carpeta" style="display:inline-flex;align-items:center;gap:5px;background:#fff8e6;border:1px solid #c8951a;color:#6a4a10;border-radius:6px;padding:5px 10px;font-size:0.72rem;font-weight:700;font-family:monospace;white-space:nowrap;">📁 ' + E(/^carp/i.test(String(e.num).trim()) ? String(e.num).trim() : 'CARP.- ' + String(e.num).trim()) + '</span>' : '')
      + ((typeof lexBtnLlamada === 'function' && e.estado !== 'cancelado') ? lexBtnLlamada('esc', e.id, 'padding:5px 9px;', 'ESCRITURA ' + (d.acto ? '· ' + String(d.acto).toUpperCase() : '')) : '')
      + '<button type="button" onclick="event.stopPropagation();escAbrirDetalle(' + idx + ')" style="background:#9a6e18;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:0.72rem;font-weight:700;cursor:pointer;">Abrir expediente completo ›</button>'
      + '</div></div></div>';
  }

  // ── Clasificación (oct-2026, opción 3: tarjetas con número grande) ────
  //  · TODOS (café)                 → En proceso (o sin estatus) + Listo p/entregar
  //  · EN PROCESO (verde)           → En proceso o sin estatus
  //  · LISTO PARA ENTREGAR (verde brillante)
  //  · CONCLUIDOS Y ENTREGADOS (azul) → Archivado
  //  · CANCELADO (rojo)             → Cancelado + No procedió
  //  · EN PAUSA (gris)              → En espera
  // "Todos" NO incluye concluidos, cancelados ni en pausa.
  var CLASIF = [
    { k:'todos',      lbl:'Todos',                   c:'#7a4a1c', t:'#7a4a1c' },
    { k:'proceso',    lbl:'En proceso',              c:'#2e7d32', t:'#2e7d32' },
    { k:'listo',      lbl:'Listo para entregar',     c:'#22c55e', t:'#15803d' },
    { k:'concluidos', lbl:'Concluidos y entregados', c:'#185fa5', t:'#185fa5' },
    { k:'cancelado',  lbl:'Cancelado',               c:'#c81e1e', t:'#c81e1e' },
    { k:'pausa',      lbl:'En pausa',                c:'#6b6b6b', t:'#5f5e5a' }
  ];
  var _cat = 'todos';
  function grupoDe(e){
    var st = e && e.estado;
    if (!st || st === 'proceso') return 'proceso';
    if (st === 'listo') return 'listo';
    if (st === 'archivado') return 'concluidos';
    if (st === 'cancelado' || st === 'noprocedio') return 'cancelado';
    if (st === 'espera') return 'pausa';
    return 'proceso';
  }
  function cabe(e, cat){ var gr = grupoDe(e); return cat === 'todos' ? (gr === 'proceso' || gr === 'listo') : gr === cat; }
  window.lexEscClasif = function(cat){ _cat = cat; window.escRender(); };
  function pintarClasificacion(){
    var t = document.getElementById('escF-todos');
    var barra = document.getElementById('lex-esc-clasif') || (t && t.parentNode);
    if (!barra) return;
    barra.id = 'lex-esc-clasif';
    var cuenta = {}; CLASIF.forEach(function(c){ cuenta[c.k] = 0; });
    // Con búsqueda activa, cada tarjeta cuenta solo lo que coincide
    var F = filtrosBusqueda(), TM = g('ESC_TIPOS_MOVIMIENTO', {}), busc = hayBusqueda(F);
    (D.escrituras || []).forEach(function(e){ if (!e) return; if (busc && !pasaBusqueda(e, F, TM)) return; CLASIF.forEach(function(c){ if (cabe(e, c.k)) cuenta[c.k]++; }); });
    window._lexEscCuentaClasif = cuenta;
    barra.style.cssText = 'display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;padding:10px 16px 14px;';
    barra.innerHTML = CLASIF.map(function(c){
      var on = c.k === _cat;
      return '<button type="button" onclick="lexEscClasif(\'' + c.k + '\')" title="Ver: ' + c.lbl + '" style="text-align:left;cursor:pointer;background:#fdfaf4;border:none;border-top:5px solid ' + c.c + ';border-radius:8px;padding:9px 12px 8px;'
        + (on ? 'box-shadow:0 0 0 3px ' + c.c + ',0 6px 16px rgba(0,0,0,0.35);transform:translateY(-1px);' : 'box-shadow:0 1px 3px rgba(0,0,0,0.25);') + 'transition:all 0.15s;">'
        + '<div style="font-family:monospace;font-size:0.62rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:' + c.t + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + c.lbl + '</div>'
        + '<div style="font-family:monospace;font-size:1.6rem;font-weight:900;color:' + c.t + ';line-height:1.15;">' + cuenta[c.k] + '</div></button>';
    }).join('');
  }

  // ── Oct-2026 · Búsqueda por INSTRUMENTO / VOLUMEN / FECHA DE FIRMA ────
  // Tres campos delante del buscador. Se combinan entre sí y con el texto.
  // Instrumento y volumen: número exacto, con o sin coma (12848 = 12,848).
  // Fecha: día (13/09/2024), mes (09/2024) o año (2024).
  function dig(s){ return String(s || '').replace(/\D/g, ''); }
  // Sin acentos ni mayúsculas: "jose" encuentra "José", "nino" encuentra "Niño"
  function sinAc(s){ return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function insVol(e){
    var vi = (typeof _escSplitVolInstr === 'function') ? _escSplitVolInstr(e.volInstr) : { instrumento:'', volumen:'' };
    return { ins: String(e.instrumento || vi.instrumento || '').trim(), vol: String(e.volumen || vi.volumen || '').trim() };
  }
  function notKey(n){ var m = /(\d+)/.exec(String(n || '')); return m ? m[1] : ''; }
  function fechaPartes(x){
    var f = String(x.fechaFirma || '').trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f))) return { y: m[1], m: +m[2], d: +m[3] };
    var t = String(x.fechaFirmaTexto || f || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if ((m = /(\d{1,2})\s*(?:de\s*)?([a-z]{3})[a-z]*\.?\s*(?:de\s*|del\s*)?(\d{4})/.exec(t)) && MES_N[m[2]]) return { y: m[3], m: MES_N[m[2]], d: +m[1] };
    if ((m = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(t))) return { y: m[3], m: +m[2], d: +m[1] };
    if ((m = /([a-z]{3})[a-z]*\.?\s*(?:de\s*|del\s*)?(\d{4})/.exec(t)) && MES_N[m[1]]) return { y: m[2], m: MES_N[m[1]], d: 0 };
    if ((m = /(\d{4})/.exec(t))) return { y: m[1], m: 0, d: 0 };
    return null;
  }
  function leerFechaBuscada(q){
    q = String(q || '').trim(); if (!q) return null;
    var p = q.split(/[\/\-.\s]+/).filter(Boolean);
    var y4 = function(s){ return s.length === 2 ? '20' + s : s; };
    if (p.length === 1) return /^\d{4}$/.test(p[0]) ? { y: p[0], m: 0, d: 0 } : { malo: true };
    if (p.length === 2) return { y: y4(p[1]), m: +p[0], d: 0 };
    if (p[0].length === 4) return { y: p[0], m: +p[1], d: +p[2] };
    return { y: y4(p[2]), m: +p[1], d: +p[0] };
  }
  function filtrosBusqueda(){
    var v = function(id){ return String((document.getElementById(id) || {}).value || '').trim(); };
    return { q: sinAc(v('escQ')), ins: dig(v('escQInstr')), vol: dig(v('escQVol')), fecha: leerFechaBuscada(v('escQFecha')) };
  }
  function pasaBusqueda(e, F, TM){
    if (F.ins || F.vol) {
      var iv = insVol(e);
      if (F.ins && dig(iv.ins) !== F.ins) return false;
      if (F.vol && dig(iv.vol) !== F.vol) return false;
    }
    if (F.fecha) {
      if (F.fecha.malo) return false;
      var p = fechaPartes(e);
      if (!p || p.y !== F.fecha.y) return false;
      if (F.fecha.m && p.m !== F.fecha.m) return false;
      if (F.fecha.d && p.d !== F.fecha.d) return false;
    }
    if (F.q) {
      var iv2 = insVol(e);
      var txt = [e.num || '', (e.compradores || []).map(nom).join(' '), (e.vendedores || []).map(nom).join(' '), e.tipo || '', TM[e.tipoMovimiento] || '', e.notaria || '', e.descripcion || '', iv2.ins, iv2.vol, e.volInstr || '', e.predio || '', e.ubicacion || '', e.tramite || '', (e.notaRevision && e.notaRevision.texto) || '', (Array.isArray(e.bitacora) && e.bitacora[0] && e.bitacora[0].texto) || ''].join(' ');
      txt = sinAc(txt);
      if (txt.indexOf(F.q) < 0) {
        // Números escritos con o sin coma (12848 ↔ 12,848)
        var qd = dig(F.q);
        if (!(qd && qd.length >= 3 && /^[\d,.\s\/]+$/.test(F.q) && (dig(iv2.ins) === qd || dig(iv2.vol) === qd))) return false;
      }
    }
    return true;
  }
  function filtrar(){
    var F = filtrosBusqueda();
    var TM = g('ESC_TIPOS_MOVIMIENTO', {});
    return (D.escrituras || []).filter(function(e){
      if (!e) return false;
      if (!cabe(e, _cat)) return false;
      return pasaBusqueda(e, F, TM);
    });
  }
  function hayBusqueda(F){ return !!(F.q || F.ins || F.vol || F.fecha); }

  // ── Instrumentos REPETIDOS (misma notaría) ───────────────────────────
  // VIGENTE = la que no está cancelada; CANCELADA = número reutilizado.
  // Dos vigentes con el mismo instrumento y notaría → posible duplicado.
  function esCancelada(e){ return e && (e.estado === 'cancelado' || e.estado === 'noprocedio'); }
  function mismaNotaria(a, b){ var x = notKey(a.notaria), y = notKey(b.notaria); return !x || !y || x === y; }
  function hermanasInstr(e, lista){
    var k = dig(insVol(e).ins); if (!k) return [];
    return (lista || D.escrituras || []).filter(function(o){ return o && o !== e && o.id !== e.id && dig(insVol(o).ins) === k && mismaNotaria(o, e); });
  }
  window._lexEscHermanasInstr = hermanasInstr;
  window._lexEscInsVol = insVol;
  function marcaRepetido(e){
    var h = hermanasInstr(e); if (!h.length) return null;
    var n = h.length + 1;
    var tip = 'Este instrumento aparece ' + n + ' veces: ' + h.map(function(o){ return ((o.compradores || [])[0] ? nom(o.compradores[0]) : 'sin comprador') + (esCancelada(o) ? ' (cancelada)' : ''); }).join(', ');
    var chipRep = '<span title="' + E(tip) + '" style="' + CH + 'background:#3a2a10;color:#f3d48a;">⇄ Instr. repetido (' + n + ')</span>';
    var badge;
    if (esCancelada(e)) badge = '<span title="' + E(tip) + '" style="' + CH + 'background:#fcebeb;color:#791f1f;border:1px solid #a32d2d;">✕ CANCELADA · número reutilizado</span>';
    else if (h.some(function(o){ return !esCancelada(o); })) badge = '<span title="' + E(tip) + '" style="' + CH + 'background:#fcebeb;color:#a32d2d;border:1px solid #a32d2d;">⚠ POSIBLE DUPLICADO</span>';
    else badge = '<span title="' + E(tip) + '" style="' + CH + 'background:#e3f1dc;color:#27500a;border:1px solid #3b6d11;">✔ VIGENTE</span>';
    return { chips: badge + chipRep, tachar: esCancelada(e) };
  }

  // ── Campos de búsqueda delante del buscador ──────────────────────────
  function asegurarCampos(){
    var q = document.getElementById('escQ');
    if (!q || document.getElementById('escQInstr')) return;
    var mk = function(id, lbl, ph, w){
      var d = document.createElement('div');
      d.style.cssText = 'position:relative;flex:0 0 ' + w + 'px;min-width:0;';
      d.innerHTML = '<span style="position:absolute;top:-15px;left:3px;font-size:9.5px;font-weight:700;letter-spacing:0.1em;color:#c9a96a;font-family:monospace;white-space:nowrap;">' + lbl + '</span>'
        + '<input class="search-inp lex-esc-campo" type="search" id="' + id + '" placeholder="' + ph + '" autocomplete="off" style="width:100%;box-sizing:border-box;padding:9px 10px;font-family:monospace;">';
      d.querySelector('input').addEventListener('input', function(){ window.escRender(); });
      return d;
    };
    var fr = document.createDocumentFragment();
    fr.appendChild(mk('escQInstr', 'INSTRUMENTO', '', 118));
    fr.appendChild(mk('escQVol', 'VOLUMEN', '', 86));
    fr.appendChild(mk('escQFecha', 'FECHA DE FIRMA', 'dd/mm/aaaa', 138));
    var _qBox = (q.closest && q.closest('.lex-bx-wrap')) || q;   // la casilla puede estar dentro del envoltorio de la ✕
    _qBox.parentNode.insertBefore(fr, _qBox);
    q.placeholder = '🔍 Cliente, acto, notaría, predio…';
    q.style.minWidth = '200px';
    var row = (q.closest && q.closest('.search-row')) || q.parentNode; if (row && !row._lexPad) { row._lexPad = true; row.style.marginTop = '18px'; }
    var st = document.createElement('style');
    st.textContent = '.lex-esc-campo.lex-on{border:2px solid #2e7d32 !important;background:#eef7e9 !important;}';
    document.head.appendChild(st);
  }
  // ── Oct-2026 · FRANJA FIJA AL BAJAR ──────────────────────────────────
  // Buscadores + tarjetas de clasificación juntos en una franja que se queda
  // pegada debajo de la barra superior mientras se recorre la lista.
  function fondoPagina(){
    var n = document.getElementById('panel-escrituras');
    while (n && n !== document.documentElement) {
      try { var b = getComputedStyle(n).backgroundColor; if (b && b !== 'transparent' && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(b)) return b; } catch(_){}
      n = n.parentElement;
    }
    return '#120c06';
  }
  function topeFranja(){
    var f = document.getElementById('lex-esc-franja'); if (!f) return;
    var tb = document.querySelector('.topbar'), h = 0;
    try { if (tb && getComputedStyle(tb).position === 'sticky' || (tb && getComputedStyle(tb).position === 'fixed')) h = tb.getBoundingClientRect().height; } catch(_){}
    f.style.top = Math.round(h) + 'px';
  }
  function asegurarFranja(){
    var q = document.getElementById('escQ'); if (!q) return;
    var fila = q.closest ? q.closest('.search-row') : q.parentNode;
    var barra = document.getElementById('lex-esc-clasif');
    if (!fila) return;
    var f = document.getElementById('lex-esc-franja');
    if (!f) {
      f = document.createElement('div'); f.id = 'lex-esc-franja';
      fila.parentNode.insertBefore(f, fila);
      f.appendChild(fila);
      window.addEventListener('resize', topeFranja);
      window.addEventListener('scroll', function(){ var ff = document.getElementById('lex-esc-franja'); if (!ff) return; var pegada = ff.getBoundingClientRect().top <= (parseFloat(ff.style.top) || 0) + 1 && window.scrollY > 0; ff.style.boxShadow = pegada ? '0 8px 14px -6px rgba(0,0,0,0.65)' : 'none'; ff.style.borderBottom = pegada ? '1px solid rgba(200,149,42,0.35)' : '1px solid transparent'; }, { passive: true });
    }
    if (barra && barra.parentNode !== f) f.appendChild(barra);
    f.style.cssText = 'position:sticky;z-index:40;background:' + fondoPagina() + ';margin:0 -28px;padding:2px 28px 2px;border-bottom:1px solid transparent;transition:box-shadow 0.15s;' + 'top:' + (f.style.top || '0px') + ';';
    topeFranja();
  }
  function marcarCampos(){
    ['escQInstr', 'escQVol', 'escQFecha', 'escQ'].forEach(function(id){
      var i = document.getElementById(id); if (!i) return;
      var on = !!String(i.value || '').trim();
      if (id === 'escQ') { i.style.borderColor = on ? '#2e7d32' : ''; return; }
      i.classList.toggle('lex-on', on);
    });
  }
  window.lexEscLimpiarBusqueda = function(){
    ['escQInstr', 'escQVol', 'escQFecha', 'escQ'].forEach(function(id){ var i = document.getElementById(id); if (i) i.value = ''; });
    window.escRender();
  };
  // ── Tarjetas estilo Pendientes de Placas (oct-2026) ───────────────────
  // Misma forma y tamaño que las fichas de Placas: franja de color a la
  // izquierda, N° de trámite, 👤 cliente en grande, el trámite en negritas,
  // chips con los datos, y a la derecha FOLIO + estado del paso + 📞.
  // Sin desplegables ni documentos adjuntos. Ordenadas por N° (en orden).
  // Clic en la tarjeta → expediente completo.
  var NOMBRE_PASO = {'FIRMA NOTARIAL':'Firma notarial','CATASTRO':'Catastro','TRASLADO MPL':'Traslado MPL','ISR':'ISR','ESCRITURA NOTARÍA':'Escritura de la notaría','IFREO':'IFREO'};
  var CH = 'font-size:11.5px;border-radius:4px;padding:2px 8px;font-family:monospace;white-space:nowrap;font-weight:700;';
  function esAutomatico(e, d){
    if (!d.sigue) return true;
    var pAct = d.activo >= 0 ? (d.pasos[d.activo] || {}) : null;
    return !(pAct && pAct.notas) && !(d.activo === -1 && e.notaFinal) && e.estado !== 'listo';
  }
  function miniBarra(e, d){
    var listo = e.estado === 'listo' || e.estado === 'archivado' || d.activo === -1, colAct = colorEstaEn(e, d);
    return '<div title="Avance: paso ' + (listo ? d.PASOS.length : d.activo + 1) + ' de ' + d.PASOS.length + '" style="display:flex;gap:2px;width:195px;">' + d.PASOS.map(function(n, i){
      var p = d.pasos[i] || {}, hecho = listo || p.estado === 'completado', aqui = !listo && i === d.activo;
      // Paso actual: rayado en su color si ya está en trámite; solo el contorno
      // si todavía está en el intermedio (esperando iniciar). Hechos: verde.
      var est = hecho ? 'background:#1a7a3a;'
        : aqui ? (p.estado === 'activo' ? 'background:repeating-linear-gradient(-45deg,' + colAct + ' 0 4px,' + colAct + '88 4px 8px);' : 'background:#fff;box-shadow:inset 0 0 0 1.5px ' + colAct + ';')
        : 'background:#e5dcc4;';
      return '<span title="' + (i + 1) + ' · ' + E(NOMBRE_PASO[n] || n) + (hecho ? ' ✓ hecho' : aqui ? (p.estado === 'activo' ? ' — en trámite' : ' — esperando iniciar') : ' — pendiente') + '" style="flex:1;height:7px;border-radius:3px;' + est + '"></span>';
    }).join('') + '</div>';
  }
  // "Qué sigue" en una COLUMNA FIJA (todas las tarjetas alinean igual), sin
  // recuadros. Solo se muestra lo que importa: lo escrito a mano y lo urgente.
  // Los avisos automáticos ("Iniciar la firma notarial"…) ya no se muestran:
  // el botón del paso dice lo mismo.
  function avisoColumna(e, d){
    var col = colorEstaEn(e, d), auto = esAutomatico(e, d);
    var oscuro = { '#5f5e5a':'#444441', '#b06a10':'#7a4206', '#534ab7':'#3c3489', '#185fa5':'#0c447c', '#0e7490':'#155e75', '#1a7a3a':'#27500a' }[col] || '#444441';
    var txt = '';
    if (d.atencion) txt = '<span style="color:#a32d2d;font-weight:700;"><span class="lex-esc-parpadeo">⚠</span> ' + E(d.sigue || ('Lleva ' + d.dias + ' días en este paso')) + '</span>';
    else if (!auto && d.sigue) txt = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + col + ';margin-right:7px;vertical-align:1px;"></span><span style="color:' + oscuro + ';font-weight:600;">' + E(d.sigue) + '</span>';
    return '<div title="' + E(d.sigue || '') + '" style="width:300px;flex-shrink:0;align-self:center;padding:8px 14px;font-size:12.5px;line-height:1.4;border-left:1px dashed ' + (txt ? '#e3d3a8' : 'transparent') + ';">'
      + (txt ? '<div style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">' + txt + '</div>' : '') + '</div>';
  }
  function botonEstado(e, d, pegado){
    // Intermedio (esperando iniciar el paso): botón solo con contorno, igual que su barrita
    var esperando = d.activo >= 0 && /^\d/.test(d.estaEn) && ((d.pasos[d.activo] || {}).estado !== 'activo') && !d.atencion;
    var col = colorEstaEn(e, d), txt;
    if (/^\d/.test(d.estaEn)) txt = (d.activo + 1) + ' · ' + String(d.PASOS[d.activo]).toUpperCase();
    else txt = String(d.estaEn).replace(/^[^A-Za-zÁÉÍÓÚÑ0-9]+/, '').toUpperCase();
    var dias = (d.dias !== null && d.activo >= 0 && (e.estado === 'proceso' || !e.estado || e.estado === 'espera')) ? ' · ' + d.dias + 'd' : '';
    var borde = d.atencion ? '#c81e1e' : col;
    return '<span title="' + E(d.estaEn + (d.estaSub ? ' (' + d.estaSub + ')' : '') + (dias ? ' — ' + d.dias + ' días en este paso' : '')) + '" style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;font-family:monospace;letter-spacing:0.03em;padding:6px 10px;width:195px;justify-content:center;box-sizing:border-box;border-radius:' + (pegado ? '0 7px 7px 0' : '7px') + ';border:1.5px solid ' + borde + ';' + (esperando ? 'background:#fff;color:' + col + ';' : 'background:' + col + ';color:#fff;') + 'white-space:nowrap;"' + (d.atencion ? ' class="lex-esc-vencida"' : '') + '>' + (d.atencion ? '<span class="lex-esc-parpadeo">⚠</span> ' : '') + E(txt) + E(dias) + '</span>';
  }
  function pintarLista(){
    var cont = document.getElementById('esc-lista'); if (!cont) return;
    var NUM = mapaNumeros();
    var lst = filtrar().map(function(e){ return { e: e, d: datos(e), n: NUM.mapa.get(e) || 0 }; });
    // En orden: N° de trámite de mayor a menor (la más reciente arriba); las que
    // no tienen número (concluidas, canceladas…) al final, por fecha de firma.
    // Por fecha de firma: la más reciente arriba, la más antigua hasta abajo
    lst.sort(function(a, b){
      var c = fechaOrden(b.e).localeCompare(fechaOrden(a.e));
      return c !== 0 ? c : (b.n - a.n);
    });
    var cnt = document.getElementById('escCountNum'); if (cnt) cnt.textContent = lst.length;
    var F = filtrosBusqueda(), busc = hayBusqueda(F);
    // Con búsqueda: avisar si también hay coincidencias en otras clasificaciones
    var tambien = '';
    if (busc) {
      var cu0 = window._lexEscCuentaClasif || {};
      var enTodos = _cat === 'todos';
      var otros0 = CLASIF.filter(function(c){ return c.k !== 'todos' && c.k !== _cat && cu0[c.k] && !(enTodos && (c.k === 'proceso' || c.k === 'listo')); });
      if (otros0.length) tambien = '<span style="margin-left:10px;color:#c8b68a;">' + (lst.length ? 'También en:' : 'Sí hay en:') + '</span>' + otros0.map(function(c){ return '<button type="button" onclick="lexEscClasif(\'' + c.k + '\')" style="background:#fdfaf4;border:none;border-top:3px solid ' + c.c + ';border-radius:6px;padding:3px 10px;margin-left:6px;cursor:pointer;color:' + c.t + ';font-weight:700;font-size:0.7rem;">' + c.lbl + ' (' + cu0[c.k] + ') ›</button>'; }).join('');
    }
    var barraBusq = busc ? '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:0 2px 8px;font-size:0.78rem;color:#f3d48a;">'
      + '<span>🔎 Búsqueda: <b style="font-family:monospace;color:#7ddc8a;">' + lst.length + (lst.length === 1 ? ' escritura' : ' escrituras') + '</b>'
      + [F.ins ? 'Instr. ' + F.ins : '', F.vol ? 'Vol. ' + F.vol : '', F.fecha ? 'Firma ' + E((document.getElementById('escQFecha') || {}).value || '') : '', F.q ? '“' + E(F.q) + '”' : ''].filter(Boolean).map(function(t){ return ' <span style="border:1px solid #c8952a;border-radius:10px;padding:1px 8px;margin-left:4px;font-size:0.7rem;">' + t + '</span>'; }).join('')
      + tambien + '</span><button type="button" onclick="lexEscLimpiarBusqueda()" style="background:transparent;border:1px solid #c8952a;color:#e8c46a;border-radius:6px;padding:4px 12px;font-size:0.72rem;cursor:pointer;">✕ Limpiar búsqueda</button></div>' : '';
    if (!lst.length) {
      cont.innerHTML = barraBusq + '<div style="padding:24px;text-align:center;color:var(--muted);font-size:0.8rem;">' + (busc ? (tambien ? 'En este filtro no hay; vea arriba dónde sí está.' : 'No hay ninguna escritura con esos datos.') : 'Sin escrituras en este filtro.') + '</div>';
      return;
    }
    var nAt = lst.filter(function(x){ return x.d.atencion; }).length;
    var resumen = barraBusq + '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 2px 8px;font-size:0.72rem;color:#c8b68a;">'
      + '<span>' + (nAt ? '<b style="color:#f08a8a;">⚠ ' + nAt + (nAt === 1 ? ' requiere' : ' requieren') + ' atención</b> (franja roja)' : '') + '</span>'
      + '<span>Trámites en curso: <b style="color:#e8c875;font-family:monospace;font-size:0.85rem;">' + NUM.total + '</b></span></div>';
    var cards = lst.map(function(x){
      var e = x.e, d = x.d, n = x.n, idx = D.escrituras.indexOf(e);
      var apagada = e.estado === 'cancelado' || e.estado === 'archivado' || e.estado === 'noprocedio';
      var franja = d.atencion ? '#c81e1e' : apagada ? '#9a9a9a' : (e.estado === 'listo' || d.activo === -1) ? '#1a7a3a' : e.estado === 'espera' ? '#8a7a5a' : '#2e7d32';
      var colNom = apagada ? '#7a7a72' : '#2e7d32';
      var nomC = (d.compradores[0] || 'Sin comprador').toUpperCase();
      var rel = relacion(d);
      var acto = d.acto ? String(d.acto).toUpperCase() : 'ESCRITURA';
      var desc = String(e.descripcion || '').trim();
      var obs = String((Array.isArray(e.bitacora) && e.bitacora[0] && e.bitacora[0].texto) || '').trim();
      var chips = [];
      // Instrumento y volumen por separado; si solo existe "Vol./Instr." junto (Excel), se separa
      var _vi = (typeof _escSplitVolInstr === 'function') ? _escSplitVolInstr(e.volInstr) : { instrumento:'', volumen:'' };
      var _ins = e.instrumento || _vi.instrumento, _vol = e.volumen || _vi.volumen;
      var rep = null; try { rep = marcaRepetido(e); } catch(_r){}
      if (rep) chips.push(rep.chips);
      if (_ins) chips.push('<span style="' + CH + 'background:#faeeda;color:#633806;font-weight:700;' + (F.ins && dig(_ins) === F.ins ? 'box-shadow:0 0 0 2px #2e7d32;' : '') + '">Instr. ' + E(_ins) + '</span>');
      if (_vol) chips.push('<span style="' + CH + 'background:#f1efe8;color:#444441;' + (F.vol && dig(_vol) === F.vol ? 'box-shadow:0 0 0 2px #2e7d32;' : '') + '">Vol. ' + E(_vol) + '</span>');
      if (d.fechaFirma) chips.push('<span style="' + CH + 'background:rgba(26,122,58,0.08);color:#27500a;">✍ Firma ' + E(d.fechaFirma) + '</span>');
      if (String(e.num || '').trim()) { var cn = String(e.num).trim(); chips.push('<span style="' + CH + 'background:rgba(200,149,42,0.12);color:#8c6518;font-weight:700;">🗂 CARP.- ' + E(cn.replace(/^carp\.?-?\s*/i, '')) + '</span>'); }
      if (e.notaria) chips.push('<span style="' + CH + 'background:rgba(0,0,0,0.05);color:#6a5a3a;font-weight:400;">🔏 ' + E(String(e.notaria).length > 34 ? String(e.notaria).slice(0, 34) + '…' : e.notaria) + '</span>');
      var fh = ''; try { if (typeof _escFoliosHtml === 'function') fh = _escFoliosHtml(e, 'escAbrirRecibo', ' · '); } catch(_){}
      return '<div class="lex-esc-card" data-idx="' + idx + '" title="Clic para abrir el expediente completo" style="position:relative;display:flex;align-items:stretch;background:var(--surface,#fdfaf4);border:1.5px solid var(--border-l,#d4b870);border-radius:8px;margin-bottom:8px;cursor:pointer;' + (apagada ? 'opacity:0.65;' : '') + 'transition:box-shadow 0.15s,border-color 0.15s;">'
        + '<div style="width:5px;background:' + franja + ';flex-shrink:0;border-radius:8px 0 0 8px;"></div>'
        + '<div style="flex:1;min-width:0;padding:10px 6px 10px 12px;">'
        +   '<div style="display:flex;align-items:center;gap:10px;margin-bottom:3px;">'
        +     '<div title="N° de trámite en curso (de la más antigua a la más reciente)" style="display:flex;flex-direction:column;align-items:center;line-height:1.05;flex-shrink:0;min-width:30px;"><span style="color:#a8987a;font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Trámite</span><span style="color:' + (n ? '#1a1008' : '#c8bb98') + ';font-family:\'JetBrains Mono\',monospace;font-size:15px;font-weight:900;">' + (n || '—') + '</span>' + (d.atencion ? '<span class="lex-esc-parpadeo" title="Plazo vencido" style="margin-top:3px;background:#c81e1e;color:#fff;font-size:7.5px;font-weight:800;letter-spacing:0.05em;border-radius:3px;padding:1px 4px;">VENCIDO</span>' : '') + '</div>'
        // Oct-2026: en UN solo renglón → 👤 CLIENTE (negro) · ACTO (verde) · — compra a Vendedor (azul)
        +     '<div style="min-width:0;line-height:1.35;">'
        +       '<span style="font-size:13.5px;font-weight:700;color:' + (apagada ? '#6a6a62' : '#1a1008') + ';font-family:\'Outfit\',sans-serif;letter-spacing:0.02em;text-transform:uppercase;' + (rep && rep.tachar ? 'text-decoration:line-through;text-decoration-color:#a32d2d;' : '') + '">👤 ' + E(nomC) + (d.compradores.length > 1 ? ' <span style="font-size:11px;color:#9a8a6a;">+' + (d.compradores.length - 1) + '</span>' : '') + '</span>'
        +       ' <span style="font-size:12.5px;font-weight:700;color:' + colNom + ';margin-left:6px;">' + E(acto) + '</span>'
        +       (rel ? ' <span style="font-size:12px;color:#9a8a6a;">— ' + E(verboRel(d)) + '</span> <span style="font-size:13px;font-weight:500;color:#185fa5;">' + E(d.vendedores.map(nombrePropio).join(', ')) + '</span>' : '')
        +     '</div>'
        +   '</div>'
        +   (String(e.ubicacion || '').trim() ? '<div title="Ubicación del predio" style="font-size:12.5px;color:#27500a;line-height:1.4;margin:2px 0 0 40px;">📍 ' + E(String(e.ubicacion).trim()) + '</div>' : '')
        +   (desc ? '<div style="font-size:12.5px;color:#5a4a30;line-height:1.4;margin:2px 0 0 40px;">' + E(desc) + '</div>' : '')
        +   '<div style="height:6px;"></div>'
        +   (chips.length ? '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + chips.join('') + '</div>' : '')
        +   (e.notaRevision && e.notaRevision.texto ? '<div title="Nota de revisión (no es la observación inicial)" style="font-size:12px;color:#633806;margin-top:7px;padding:5px 9px;background:#fdf3dc;border-left:3px solid #ba7517;border-radius:0 4px 4px 0;line-height:1.45;">🔎 ' + E(e.notaRevision.texto) + '</div>' : '')
        +   (obs ? '<div style="font-size:12px;color:#1a1008;margin-top:7px;padding:5px 9px;background:rgba(200,149,42,0.08);border-radius:4px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;" title="' + E(obs) + '">' + E(obs) + '</div>' : '')
        + '</div>'
        + avisoColumna(e, d)
        + '<div class="lex-esc-acc" style="display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;padding:10px 10px 10px 4px;flex-shrink:0;gap:6px;width:215px;box-sizing:border-box;">'
        +   '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">'
        +     (fh ? '<div title="Folio del recibo — clic para abrirlo" style="display:flex;flex-direction:column;align-items:center;padding:2px 6px;"><span style="font-size:8px;font-weight:700;color:#8c6518;letter-spacing:0.12em;">FOLIO</span><span style="font-size:1.2rem;font-weight:800;color:#1a4a8a;line-height:1.15;font-family:monospace;">' + fh + '</span></div>' : '')
        +     botonEstado(e, d, false)
        +     miniBarra(e, d)
        +   '</div>'
        +   '<div style="display:flex;gap:4px;">' + ((typeof lexBtnLlamada === 'function' && e.estado !== 'cancelado') ? lexBtnLlamada('esc', e.id, '', 'ESCRITURA' + (d.acto ? ' · ' + String(d.acto).toUpperCase() : '')) : '') + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
    cont.innerHTML = resumen + cards + '<style>.lex-esc-card:hover{border-color:#c8951a !important;box-shadow:0 2px 10px rgba(200,149,42,0.18);}'
      + '@keyframes lexEscParp{0%,100%{opacity:1}50%{opacity:.25}}@keyframes lexEscPulso{0%,100%{box-shadow:0 0 0 0 rgba(200,30,30,0.55)}50%{box-shadow:0 0 0 6px rgba(200,30,30,0)}}'
      + '.lex-esc-parpadeo{animation:lexEscParp 1.1s ease-in-out infinite;display:inline-block}.lex-esc-vencida{animation:lexEscPulso 1.6s ease-out infinite}'
      + '@media (prefers-reduced-motion:reduce){.lex-esc-parpadeo,.lex-esc-vencida{animation:none}}</style>';
    cont.querySelectorAll('.lex-esc-card').forEach(function(f){
      f.onclick = function(){ var i = parseInt(f.getAttribute('data-idx'), 10); if (typeof escAbrirDetalle === 'function' && i >= 0) escAbrirDetalle(i); };
      var acc = f.querySelector('.lex-esc-acc'); if (acc) acc.addEventListener('click', function(ev){ if (ev.target.closest && (ev.target.closest('button') || ev.target.closest('span[onclick]'))) ev.stopPropagation(); });
    });
  }

  // ── Selector de vista ────────────────────────────────────────────────
  function pintarSelector(){
    var cont = document.getElementById('esc-lista'); if (!cont || !cont.parentNode) return;
    var sel = document.getElementById('lex-esc-vista-sel');
    if (!sel) {
      sel = document.createElement('div'); sel.id = 'lex-esc-vista-sel';
      sel.style.cssText = 'display:flex;justify-content:flex-end;gap:6px;padding:0 12px;margin:2px 0 4px;';
      cont.parentNode.insertBefore(sel, cont);
    }
    var v = vista();
    var b = function(val, txt){ var on = v === val; return '<button type="button" data-v="' + val + '" style="font-size:0.68rem;border-radius:14px;padding:4px 12px;cursor:pointer;border:1px solid ' + (on ? '#9a6e18' : '#5a4a2a') + ';background:' + (on ? '#9a6e18' : 'transparent') + ';color:' + (on ? '#fff' : '#c8b68a') + ';">' + txt + '</button>'; };
    sel.innerHTML = b('lista', '☰ Lista de trabajo') + b('tarjetas', '▦ Vista anterior (tarjetas)');
    sel.querySelectorAll('button').forEach(function(x){ x.onclick = function(){ ponerVista(x.getAttribute('data-v')); window.escRender(); }; });
  }

  var original = window.escRender;
  if (typeof original !== 'function') return;
  window.escRender = function(){
    // Oct-2026: se quitó la "Vista anterior (tarjetas)" a petición del Lic.
    // Nahúm — siempre se usa la Lista de trabajo.
    try { var _sv = document.getElementById('lex-esc-vista-sel'); if (_sv) _sv.remove(); } catch(e){}
    try { asegurarCampos(); marcarCampos(); } catch(errB) { console.warn('[Escrituras búsqueda]', errB); }
    if (typeof D === 'undefined' || !Array.isArray(D.escrituras)) return original.apply(this, arguments);
    try { pintarClasificacion(); } catch(errC) { console.warn('[Escrituras clasificación]', errC); }
    try { asegurarFranja(); } catch(errF) { console.warn('[Escrituras franja]', errF); }
    try { pintarLista(); }
    catch(err) { console.warn('[Escrituras lista] se usa la vista anterior:', err); return original.apply(this, arguments); }
  };
  window._lexEscDatos = datos;

  // ── Aviso de instrumento repetido al GUARDAR (nueva o editada) ────────
  //  · Solo existe en una CANCELADA → aviso amarillo, se guarda normal.
  //  · Ya está VIGENTE (misma notaría) → aviso rojo: Abrir la existente /
  //    Guardar de todos modos / Volver al formulario.
  // Solo revisa cuando el instrumento es nuevo o cambió (no molesta al editar
  // otros datos de una escritura que ya lo tenía).
  function avisoRepetido(vig, ins, alGuardar){
    var prev = document.getElementById('lex-esc-dup'); if (prev) prev.remove();
    var o = vig[0], nomO = (o.compradores || [])[0] ? nom(o.compradores[0]) : 'sin comprador';
    var iv = insVol(o);
    var w = document.createElement('div'); w.id = 'lex-esc-dup';
    w.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100000;display:flex;align-items:center;justify-content:center;';
    w.innerHTML = '<div style="background:#fdf8ee;border-radius:12px;border-top:6px solid #a32d2d;max-width:520px;width:92%;padding:20px 22px;font-family:Outfit,sans-serif;color:#2a1a08;box-shadow:0 12px 40px rgba(0,0,0,0.45);">'
      + '<div style="font-size:1.05rem;font-weight:800;color:#a32d2d;margin-bottom:8px;">⛔ Instrumento ya registrado</div>'
      + '<div style="font-size:0.9rem;line-height:1.5;">El instrumento <b style="font-family:monospace;">' + E(ins) + '</b>' + (o.notaria ? ' de <b>' + E(o.notaria) + '</b>' : '') + ' ya está <b style="color:#27500a;">VIGENTE</b> en:</div>'
      + '<div style="margin:10px 0 14px;padding:10px 12px;background:#fff;border:1px solid #e3d3a8;border-left:5px solid #2e7d32;border-radius:6px;font-size:0.88rem;"><b style="text-transform:uppercase;">👤 ' + E(nomO) + '</b><div style="font-family:monospace;font-size:0.78rem;color:#1a7a3a;margin-top:3px;">' + (iv.vol ? 'Vol. ' + E(iv.vol) + ' · ' : '') + 'Instr. ' + E(iv.ins) + (o.fechaFirma ? ' · Firma ' + E(o.fechaFirma) : '') + '</div>' + (vig.length > 1 ? '<div style="font-size:0.75rem;color:#7a6a4a;margin-top:3px;">y ' + (vig.length - 1) + ' más</div>' : '') + '</div>'
      + '<div style="font-size:0.85rem;margin-bottom:14px;">¿Es la misma escritura?</div>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">'
      + '<button type="button" data-a="volver" style="background:transparent;border:1px solid #9a8a6a;color:#5a4a2a;border-radius:6px;padding:8px 14px;cursor:pointer;font-weight:600;">Volver al formulario</button>'
      + '<button type="button" data-a="abrir" style="background:#2e7d32;border:none;color:#fff;border-radius:6px;padding:8px 14px;cursor:pointer;font-weight:700;">Abrir la existente</button>'
      + '<button type="button" data-a="guardar" style="background:#a32d2d;border:none;color:#fff;border-radius:6px;padding:8px 14px;cursor:pointer;font-weight:700;">Guardar de todos modos</button>'
      + '</div></div>';
    document.body.appendChild(w);
    w.querySelectorAll('button').forEach(function(b){
      b.onclick = function(){
        var a = b.getAttribute('data-a'); w.remove();
        if (a === 'guardar') alGuardar();
        else if (a === 'abrir') {
          try { if (typeof cerrar === 'function') cerrar('mEscritura'); } catch(_){}
          var i = D.escrituras.indexOf(o);
          if (i >= 0 && typeof escAbrirDetalle === 'function') setTimeout(function(){ escAbrirDetalle(i); }, 50);
        }
      };
    });
  }
  function envolverGuardar(){
    var og = window.escGuardar;
    if (typeof og !== 'function' || og._lexDup) return;
    var env = function(){
      var self = this, args = arguments;
      try {
        var ins = String((document.getElementById('eInstrumento') || {}).value || '').trim();
        var k = dig(ins);
        var idx = (typeof _escIdx === 'number') ? _escIdx : -1;
        var actual = idx >= 0 ? D.escrituras[idx] : null;
        var cambio = !actual || dig(insVol(actual).ins) !== k;
        if (k && cambio && !window._lexEscDupOk) {
          var fake = { id: actual ? actual.id : '__nueva__', instrumento: ins, notaria: String((document.getElementById('eNotaria') || {}).value || '').trim() };
          var h = hermanasInstr(fake).filter(function(o){ return o !== actual; });
          var vig = h.filter(function(o){ return !esCancelada(o); });
          if (vig.length) {
            avisoRepetido(vig, ins, function(){ window._lexEscDupOk = true; try { og.apply(self, args); } finally { window._lexEscDupOk = false; } });
            return;
          }
          if (h.length) {
            var c0 = h[0], n0 = (c0.compradores || [])[0] ? nom(c0.compradores[0]) : 'sin comprador';
            setTimeout(function(){
              var a = document.createElement('div');
              a.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100000;max-width:560px;width:90%;background:#fdf3dc;color:#633806;border:1.5px solid #ba7517;border-left:6px solid #ba7517;border-radius:8px;padding:12px 16px;font-size:0.86rem;line-height:1.45;box-shadow:0 8px 24px rgba(0,0,0,0.35);';
              a.innerHTML = '⚠ El instrumento <b style="font-family:monospace;">' + E(ins) + '</b> ya se usó en una escritura <b>CANCELADA</b> (' + E(n0) + '). Se guardó y quedará marcada como “instrumento reutilizado”.';
              document.body.appendChild(a);
              setTimeout(function(){ a.remove(); }, 7000);
            }, 600);
          }
        }
      } catch(errD) { console.warn('[Escrituras instr. repetido]', errD); }
      return og.apply(self, args);
    };
    env._lexDup = true;
    window.escGuardar = env;
  }
  envolverGuardar();
})();
