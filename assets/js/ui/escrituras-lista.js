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
    var dias = e.pasoActivoFecha ? Math.floor((Date.now() - new Date(e.pasoActivoFecha).getTime()) / 86400000) : null;
    if (dias !== null && (isNaN(dias) || dias < 0)) dias = null;
    var umbral = e.pasoActivoRequerimientos ? g('ESC_DIAS_REQUIERE_ATENCION_REQUERIMIENTOS', 8) : (e.pasoActivoEnEspera ? g('ESC_DIAS_REQUIERE_ATENCION_ESPERA', 15) : g('ESC_DIAS_REQUIERE_ATENCION', 30));
    var atencion = e.estado === 'proceso' && activo >= 0 && dias !== null && dias >= umbral;
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
      else sigue = (pAct && pAct.estado === 'activo' ? 'Dar seguimiento a ' : 'Iniciar ') + (({'FIRMA NOTARIAL':'la firma notarial','CATASTRO':'Catastro','TRASLADO MPL':'Traslado MPL','ISR':'ISR','IFREO':'IFREO'})[PASOS[activo]] || PASOS[activo].toLowerCase());
    } else if (e.estado === 'listo') sigue = 'Avisar al cliente y entregar la escritura';
    var fechaFirma = e.fechaFirma ? (function(){ try { return new Date(e.fechaFirma + 'T12:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' }); } catch(_){ return e.fechaFirma; } })() : (e.fechaFirmaTexto || '');
    return { pasos: pasos, PASOS: PASOS, activo: activo, dias: dias, umbral: umbral, atencion: atencion, acto: acto,
      compradores: compradores, vendedores: vendedores, estaEn: estaEn, estaSub: estaSub, sigue: sigue, fechaFirma: fechaFirma };
  }
  // Oct-2026: cada paso con su propio color (etiqueta), para distinguir el
  // avance de un vistazo: Firma gris · Catastro ámbar · Traslado morado ·
  // ISR azul · IFREO verde agua · Listo verde.
  var COLOR_PASO = ['#5f5e5a', '#b06a10', '#534ab7', '#185fa5', '#0f6e56'];
  function colorEstaEn(e, d){
    if (e.estado === 'listo' || d.activo === -1) return '#1a7a3a';
    if (e.estado === 'archivado') return '#7a6840';
    if (e.estado === 'cancelado') return '#6b6b6b';
    if (e.estado === 'noprocedio') return '#7a2020';
    return COLOR_PASO[d.activo] || '#5f5e5a';
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
  function mapaNumeros(){
    var act = (D.escrituras || []).filter(function(x){ return x && (!x.estado || x.estado === 'proceso' || x.estado === 'listo'); })
      .slice().sort(function(a, b){ return String(b.fechaFirma || '9999-99-99').localeCompare(String(a.fechaFirma || '9999-99-99')); });
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
        + '<div style="font-size:0.62rem;margin-top:3px;color:' + col + ';font-weight:' + (aqui ? '700' : '400') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (hecho ? '✓ ' : aqui ? '● ' : '') + E(({'FIRMA NOTARIAL':'Firma notarial','CATASTRO':'Catastro','TRASLADO MPL':'Traslado MPL','ISR':'ISR','IFREO':'IFREO'})[n] || n) + '</div></div>';
    }).join('<div style="width:4px;"></div>');
    var folios = '';
    try { if (typeof _escFoliosHtml === 'function') { var fh = _escFoliosHtml(e, 'escAbrirRecibo', ' · '); if (fh) folios = '<span style="font-size:0.72rem;color:#1a4a8a;">🧾 Recibo: ' + fh + '</span>'; } } catch(_){}
    return '<div style="background:#fffdf6;border-top:1px dashed #d8c08a;padding:12px 16px 14px 16px;">'
      + '<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;">'
      + '<span style="font-size:0.82rem;">Está en: ' + chipEstaEn(e, d, true)
      + (d.activo >= 0 && /^\d/.test(d.estaEn) ? ' <span style="font-size:0.7rem;color:#7a6a4a;">(paso ' + (d.activo + 1) + ' de 5' + (d.estaSub ? ', ' + E(d.estaSub) : '') + ')</span>' : '') + '</span>'
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

  // ── Lista de trabajo (opción B) ──────────────────────────────────────
  function filtrar(){
    var filtro = g('_escFiltro', 'todos');
    var q = String((document.getElementById('escQ') || {}).value || '').toLowerCase();
    var TM = g('ESC_TIPOS_MOVIMIENTO', {});
    return (D.escrituras || []).filter(function(e){
      if (!e) return false;
      if (filtro === 'todos') { if (e.estado === 'espera' || e.estado === 'archivado' || e.estado === 'cancelado' || e.estado === 'noprocedio') return false; }
      else if (filtro === 'archivado') { if (e.estado !== 'archivado' && e.estado !== 'cancelado') return false; }
      else if (e.estado !== filtro) return false;
      if (q) {
        var txt = [e.num || '', (e.compradores || []).map(nom).join(' '), (e.vendedores || []).map(nom).join(' '), e.tipo || '', TM[e.tipoMovimiento] || '', e.notaria || '', e.descripcion || '', e.instrumento || ''].join(' ').toLowerCase();
        return txt.indexOf(q) >= 0;
      }
      return true;
    });
  }
  // ── Tarjetas estilo Pendientes de Placas (oct-2026) ───────────────────
  // Misma forma y tamaño que las fichas de Placas: franja de color a la
  // izquierda, N° de trámite, 👤 cliente en grande, el trámite en negritas,
  // chips con los datos, y a la derecha FOLIO + estado del paso + 📞.
  // Sin desplegables ni documentos adjuntos. Ordenadas por N° (en orden).
  // Clic en la tarjeta → expediente completo.
  var NOMBRE_PASO = {'FIRMA NOTARIAL':'Firma notarial','CATASTRO':'Catastro','TRASLADO MPL':'Traslado MPL','ISR':'ISR','IFREO':'IFREO'};
  var CH = 'font-size:11.5px;border-radius:4px;padding:2px 8px;font-family:monospace;white-space:nowrap;font-weight:700;';
  function esAutomatico(e, d){
    if (!d.sigue) return true;
    var pAct = d.activo >= 0 ? (d.pasos[d.activo] || {}) : null;
    return !(pAct && pAct.notas) && !(d.activo === -1 && e.notaFinal) && e.estado !== 'listo';
  }
  function miniBarra(e, d){
    var listo = e.estado === 'listo' || e.estado === 'archivado' || d.activo === -1, colAct = colorEstaEn(e, d);
    return '<div title="Avance: paso ' + (listo ? 5 : d.activo + 1) + ' de 5" style="display:flex;gap:2px;width:195px;">' + d.PASOS.map(function(n, i){
      var p = d.pasos[i] || {}, hecho = listo || p.estado === 'completado', aqui = !listo && i === d.activo;
      return '<span title="' + (i + 1) + ' · ' + E(NOMBRE_PASO[n] || n) + '" style="flex:1;height:5px;border-radius:3px;background:' + (hecho ? '#1a7a3a' : aqui ? colAct : '#e5dcc4') + ';"></span>';
    }).join('') + '</div>';
  }
  // "Qué sigue" en una COLUMNA FIJA (todas las tarjetas alinean igual), sin
  // recuadros. Solo se muestra lo que importa: lo escrito a mano y lo urgente.
  // Los avisos automáticos ("Iniciar la firma notarial"…) ya no se muestran:
  // el botón del paso dice lo mismo.
  function avisoColumna(e, d){
    var col = colorEstaEn(e, d), auto = esAutomatico(e, d);
    var oscuro = { '#5f5e5a':'#444441', '#b06a10':'#7a4206', '#534ab7':'#3c3489', '#185fa5':'#0c447c', '#0f6e56':'#085041', '#1a7a3a':'#27500a' }[col] || '#444441';
    var txt = '';
    if (d.atencion) txt = '<span style="color:#a32d2d;font-weight:700;">⚠ ' + E(d.sigue || ('Lleva ' + d.dias + ' días en este paso')) + '</span>';
    else if (!auto && d.sigue) txt = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + col + ';margin-right:7px;vertical-align:1px;"></span><span style="color:' + oscuro + ';font-weight:600;">' + E(d.sigue) + '</span>';
    return '<div title="' + E(d.sigue || '') + '" style="width:300px;flex-shrink:0;align-self:center;padding:8px 14px;font-size:12.5px;line-height:1.4;border-left:1px dashed ' + (txt ? '#e3d3a8' : 'transparent') + ';">'
      + (txt ? '<div style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">' + txt + '</div>' : '') + '</div>';
  }
  function botonEstado(e, d, pegado){
    var col = colorEstaEn(e, d), txt;
    if (/^\d/.test(d.estaEn)) txt = (d.activo + 1) + ' · ' + String(d.PASOS[d.activo]).toUpperCase();
    else txt = String(d.estaEn).replace(/^[^A-Za-zÁÉÍÓÚÑ0-9]+/, '').toUpperCase();
    var dias = (d.dias !== null && d.activo >= 0 && (e.estado === 'proceso' || !e.estado || e.estado === 'espera')) ? ' · ' + d.dias + 'd' : '';
    var borde = d.atencion ? '#c81e1e' : col;
    return '<span title="' + E(d.estaEn + (d.estaSub ? ' (' + d.estaSub + ')' : '') + (dias ? ' — ' + d.dias + ' días en este paso' : '')) + '" style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;font-family:monospace;letter-spacing:0.03em;padding:6px 10px;width:195px;justify-content:center;box-sizing:border-box;border-radius:' + (pegado ? '0 7px 7px 0' : '7px') + ';border:1.5px solid ' + borde + ';background:' + col + ';color:#fff;white-space:nowrap;">' + (d.atencion ? '⚠ ' : '') + E(txt) + E(dias) + '</span>';
  }
  function pintarLista(){
    var cont = document.getElementById('esc-lista'); if (!cont) return;
    var NUM = mapaNumeros();
    var lst = filtrar().map(function(e){ return { e: e, d: datos(e), n: NUM.mapa.get(e) || 0 }; });
    // En orden: N° de trámite de mayor a menor (la más reciente arriba); las que
    // no tienen número (concluidas, canceladas…) al final, por fecha de firma.
    lst.sort(function(a, b){
      if (a.n !== b.n) return b.n - a.n;
      return String(b.e.fechaFirma || '0').localeCompare(String(a.e.fechaFirma || '0'));
    });
    var cnt = document.getElementById('escCountNum'); if (cnt) cnt.textContent = lst.length;
    if (!lst.length) { cont.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:0.8rem;">Sin escrituras en este filtro.</div>'; return; }
    var nAt = lst.filter(function(x){ return x.d.atencion; }).length;
    var resumen = '<div style="display:flex;justify-content:space-between;align-items:center;padding:0 2px 8px;font-size:0.72rem;color:#c8b68a;">'
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
      if (e.instrumento) chips.push('<span style="' + CH + 'background:#faeeda;color:#633806;font-weight:700;">Instr. ' + E(e.instrumento) + '</span>');
      if (e.volumen) chips.push('<span style="' + CH + 'background:#f1efe8;color:#444441;">Vol. ' + E(e.volumen) + '</span>');
      if (d.fechaFirma) chips.push('<span style="' + CH + 'background:rgba(26,122,58,0.08);color:#27500a;">✍ Firma ' + E(d.fechaFirma) + '</span>');
      if (String(e.num || '').trim()) { var cn = String(e.num).trim(); chips.push('<span style="' + CH + 'background:rgba(200,149,42,0.12);color:#8c6518;font-weight:700;">🗂 CARP.- ' + E(cn.replace(/^carp\.?-?\s*/i, '')) + '</span>'); }
      if (e.notaria) chips.push('<span style="' + CH + 'background:rgba(0,0,0,0.05);color:#6a5a3a;font-weight:400;">🔏 ' + E(String(e.notaria).length > 34 ? String(e.notaria).slice(0, 34) + '…' : e.notaria) + '</span>');
      var fh = ''; try { if (typeof _escFoliosHtml === 'function') fh = _escFoliosHtml(e, 'escAbrirRecibo', ' · '); } catch(_){}
      return '<div class="lex-esc-card" data-idx="' + idx + '" title="Clic para abrir el expediente completo" style="position:relative;display:flex;align-items:stretch;background:var(--surface,#fdfaf4);border:1.5px solid var(--border-l,#d4b870);border-radius:8px;margin-bottom:8px;cursor:pointer;' + (apagada ? 'opacity:0.65;' : '') + 'transition:box-shadow 0.15s,border-color 0.15s;">'
        + '<div style="width:5px;background:' + franja + ';flex-shrink:0;border-radius:8px 0 0 8px;"></div>'
        + '<div style="flex:1;min-width:0;padding:10px 6px 10px 12px;">'
        +   '<div style="display:flex;align-items:center;gap:10px;margin-bottom:3px;">'
        +     '<div title="N° de trámite en curso (de la más antigua a la más reciente)" style="display:flex;flex-direction:column;align-items:center;line-height:1.05;flex-shrink:0;min-width:30px;"><span style="color:#a8987a;font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Trámite</span><span style="color:' + (n ? '#1a1008' : '#c8bb98') + ';font-family:\'JetBrains Mono\',monospace;font-size:15px;font-weight:900;">' + (n || '—') + '</span></div>'
        // Oct-2026: en UN solo renglón → 👤 CLIENTE (negro) · ACTO (verde) · — compra a Vendedor (azul)
        +     '<div style="min-width:0;line-height:1.35;">'
        +       '<span style="font-size:15px;font-weight:700;color:' + (apagada ? '#6a6a62' : '#1a1008') + ';font-family:\'Outfit\',sans-serif;letter-spacing:0.02em;text-transform:uppercase;">👤 ' + E(nomC) + (d.compradores.length > 1 ? ' <span style="font-size:11px;color:#9a8a6a;">+' + (d.compradores.length - 1) + '</span>' : '') + '</span>'
        +       ' <span style="font-size:13.5px;font-weight:700;color:' + colNom + ';margin-left:6px;">' + E(acto) + '</span>'
        +       (rel ? ' <span style="font-size:13px;color:#9a8a6a;">— ' + E(verboRel(d)) + '</span> <span style="font-size:13.5px;font-weight:500;color:#185fa5;">' + E(d.vendedores.map(nombrePropio).join(', ')) + '</span>' : '')
        +     '</div>'
        +   '</div>'
        +   (desc ? '<div style="font-size:12.5px;color:#5a4a30;line-height:1.4;margin:2px 0 0 40px;">' + E(desc) + '</div>' : '')
        +   '<div style="height:6px;"></div>'
        +   (chips.length ? '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + chips.join('') + '</div>' : '')
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
    cont.innerHTML = resumen + cards + '<style>.lex-esc-card:hover{border-color:#c8951a !important;box-shadow:0 2px 10px rgba(200,149,42,0.18);}</style>';
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
    if (typeof D === 'undefined' || !Array.isArray(D.escrituras)) return original.apply(this, arguments);
    try { pintarLista(); }
    catch(err) { console.warn('[Escrituras lista] se usa la vista anterior:', err); return original.apply(this, arguments); }
  };
  window._lexEscDatos = datos;
})();
