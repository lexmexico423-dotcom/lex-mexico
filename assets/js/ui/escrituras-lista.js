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
      else sigue = (pAct && pAct.estado === 'activo' ? 'Dar seguimiento a ' : 'Iniciar ') + PASOS[activo].toLowerCase();
    } else if (e.estado === 'listo') sigue = 'Avisar al cliente y entregar la escritura';
    var fechaFirma = e.fechaFirma ? (function(){ try { return new Date(e.fechaFirma + 'T12:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' }); } catch(_){ return e.fechaFirma; } })() : (e.fechaFirmaTexto || '');
    return { pasos: pasos, PASOS: PASOS, activo: activo, dias: dias, umbral: umbral, atencion: atencion, acto: acto,
      compradores: compradores, vendedores: vendedores, estaEn: estaEn, estaSub: estaSub, sigue: sigue, fechaFirma: fechaFirma };
  }
  function semaforo(d, e){
    if (d.dias === null || !(e.estado === 'proceso' || !e.estado || e.estado === 'espera') || d.activo === -1) return '<span style="color:#9a8a6a;font-size:0.7rem;">—</span>';
    var col = d.dias >= d.umbral ? ['#fcebeb','#a32d2d'] : d.dias >= d.umbral / 2 ? ['#fdf0dc','#8a4a10'] : ['#eaf3de','#3b6d11'];
    return '<span title="Días en este paso (se marca en rojo a los ' + d.umbral + ')" style="display:inline-block;font-size:0.7rem;font-weight:700;border-radius:10px;padding:2px 9px;background:' + col[0] + ';color:' + col[1] + ';white-space:nowrap;">' + (d.dias >= d.umbral ? '⚠ ' : '') + d.dias + ' día' + (d.dias === 1 ? '' : 's') + '</span>';
  }
  // "compra a" / "recibe en donación de" / "con" según el acto
  function relacion(d){
    if (!d.vendedores.length) return '';
    var a = String(d.acto || '').toUpperCase();
    var verbo = /COMPRAVENTA|COMPRA/.test(a) ? 'compra a' : /DONACI/.test(a) ? 'recibe en donación de' : /ADJUDICA|HERENCIA|SUCESI/.test(a) ? 'recibe de' : 'con';
    return verbo + ' ' + d.vendedores.join(', ');
  }
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
    if (d.acto) partes.push(E(d.acto));
    if (e.instrumento) partes.push('Instr. ' + E(e.instrumento));
    if (e.volumen) partes.push('Vol. ' + E(e.volumen));
    if (d.fechaFirma) partes.push('Firma ' + E(d.fechaFirma));
    if (e.num) partes.push(/^carp/i.test(String(e.num).trim()) ? E(e.num) : 'CARP.- ' + E(e.num));
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
      + '<span style="font-size:0.82rem;">Está en: <b style="background:#1a1008;color:#e8c875;padding:2px 10px;border-radius:12px;font-weight:600;">' + E(d.estaEn) + '</b>'
      + (d.activo >= 0 && /^\d/.test(d.estaEn) ? ' <span style="font-size:0.7rem;color:#7a6a4a;">(paso ' + (d.activo + 1) + ' de 5' + (d.estaSub ? ', ' + E(d.estaSub) : '') + ')</span>' : '') + '</span>'
      + (d.dias !== null && d.activo >= 0 ? '<span style="font-size:0.74rem;color:#5a4a2a;">Lleva ' + semaforo(d, e) + ' en este paso</span>' : '')
      + '</div>'
      + (d.sigue ? '<div style="margin-top:8px;font-size:0.84rem;color:' + (d.atencion ? '#a32d2d' : '#8a3a10') + ';">👉 Qué sigue: <b style="font-weight:600;">' + E(d.sigue) + '</b></div>' : '')
      + '<div style="display:flex;align-items:flex-start;margin-top:10px;">' + barra + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;">'
      + '<div></div>'
      + '<div style="display:flex;gap:6px;align-items:center;">'
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
  function pintarLista(){
    var cont = document.getElementById('esc-lista'); if (!cont) return;
    var lst = filtrar().map(function(e){ return { e: e, d: datos(e) }; });
    var activa = function(x){ return (x.e.estado === 'proceso' || !x.e.estado) && x.d.activo >= 0; };
    lst.sort(function(a, b){
      if (a.d.atencion !== b.d.atencion) return a.d.atencion ? -1 : 1;
      var aa = activa(a), bb = activa(b);
      if (aa !== bb) return aa ? -1 : 1;
      var da = a.d.dias === null ? -1 : a.d.dias, db = b.d.dias === null ? -1 : b.d.dias;
      if (da !== db) return db - da;
      return String(b.e.fechaFirma || '9999').localeCompare(String(a.e.fechaFirma || '9999'));
    });
    var cnt = document.getElementById('escCountNum'); if (cnt) cnt.textContent = lst.length;
    if (!lst.length) { cont.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:0.8rem;">Sin escrituras en este filtro.</div>'; return; }
    var NUM = mapaNumeros();
    var GRID = 'display:grid;grid-template-columns:46px minmax(0,2.6fr) minmax(0,1.2fr) minmax(0,2.3fr) 92px 104px;gap:10px;align-items:center;';
    var resumen = '<div style="display:flex;justify-content:flex-end;padding:0 2px 6px;font-size:0.72rem;color:#c8b68a;">Trámites en curso (En proceso + Listo p/entregar): <b style="color:#e8c875;margin-left:5px;font-family:monospace;font-size:0.85rem;">' + NUM.total + '</b></div>';
    var head = resumen + '<div style="' + GRID + 'background:#1a1008;color:#e8c875;padding:8px 14px;border-radius:8px 8px 0 0;font-size:0.64rem;letter-spacing:0.08em;font-family:monospace;">'
      + '<span style="text-align:center;">N°</span><span>CLIENTE</span><span>ESTÁ EN</span><span>QUÉ SIGUE</span><span>TIEMPO</span><span></span></div>';
    var rows = lst.map(function(x){
      var e = x.e, d = x.d, idx = D.escrituras.indexOf(e);
      var id = String(e.id || idx);
      var abierta = !!abiertas[id];
      var apagada = e.estado === 'cancelado' || e.estado === 'archivado';
      return '<div class="lex-esc-fila" data-id="' + E(id) + '" style="background:' + (abierta ? '#fff8e4' : '#fbf6ea') + ';border:1px solid ' + (d.atencion ? '#e8a0a0' : '#e3d3a8') + ';border-left:4px solid ' + (d.atencion ? '#c81e1e' : apagada ? '#9a9a9a' : '#c8951a') + ';border-radius:0;margin-top:6px;' + (apagada ? 'opacity:0.75;' : '') + '">'
        + '<div class="lex-esc-cab" style="' + GRID + 'padding:9px 14px;cursor:pointer;" title="Toca para ver el detalle">'
        + (function(){ var n = NUM.mapa.get(e); return '<div title="N° de trámite en curso (se cuenta de la más antigua a la más reciente)" style="text-align:center;line-height:1.05;"><div style="font-size:0.5rem;color:#9a8a6a;letter-spacing:0.05em;font-family:monospace;">TRÁMITE</div><div style="font-size:1.05rem;font-weight:800;color:' + (n ? '#8c6518' : '#b4a88a') + ';font-family:monospace;">' + (n || '—') + '</div></div>'; })()
        + (function(){ var rel = relacion(d); var nomC = (d.compradores[0] || 'Sin comprador').toUpperCase(); var tit = d.compradores.join(', ') + (rel ? ' ' + rel : '');
            return '<div style="min-width:0;"><div title="' + E(tit) + '" style="font-size:0.86rem;font-weight:700;color:#1a1008;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + E(nomC) + (d.compradores.length > 1 ? ' <span style="font-size:0.66rem;color:#7a6a4a;">+' + (d.compradores.length - 1) + '</span>' : '')
              + (rel ? ' <span style="font-size:0.74rem;font-weight:400;color:#7a6a4a;">' + E(rel) + '</span>' : '') + '</div>'; })()
        + '<div style="font-size:0.68rem;color:#7a6a4a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + datosSecundarios(e, d) + '</div></div>'
        + '<div style="min-width:0;"><div style="font-size:0.78rem;font-weight:700;color:#2a1c08;">' + E(d.estaEn) + '</div>' + (d.estaSub ? '<div style="font-size:0.64rem;color:#7a6a4a;">' + E(d.estaSub) + '</div>' : '') + '</div>'
        + '<div style="min-width:0;font-size:0.76rem;color:' + (d.atencion ? '#a32d2d' : '#8a3a10') + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + (d.atencion ? '⚠ ' : '') + E(d.sigue || '—') + '</div>'
        + '<div>' + semaforo(d, e) + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">'
        // Oct-2026: folio del recibo arriba a la derecha (como en Pendientes)
        + (function(){ var fh = ''; try { if (typeof _escFoliosHtml === 'function') fh = _escFoliosHtml(e, 'escAbrirRecibo', '<br>'); } catch(_){}
            return fh ? '<div title="Folio del recibo — clic para abrirlo" style="text-align:right;line-height:1.1;"><div style="font-family:serif;font-size:0.52rem;letter-spacing:0.12em;color:#8c6518;font-weight:700;">FOLIO</div><div style="font-family:serif;font-size:0.95rem;color:#1a4a8a;font-weight:800;">' + fh + '</div></div>' : ''; })()
        + '<div style="display:flex;gap:5px;align-items:center;">'
        + ((typeof lexBtnLlamada === 'function' && e.estado !== 'cancelado') ? lexBtnLlamada('esc', e.id, '', 'ESCRITURA' + (d.acto ? ' · ' + String(d.acto).toUpperCase() : '')) : '')
        + '<span style="font-size:0.9rem;color:#9a6e18;">' + (abierta ? '▴' : '▾') + '</span></div></div>'
        + '</div>'
        + (abierta ? tarjeta(e, idx, d) : '')
        + '</div>';
    }).join('');
    cont.innerHTML = head + rows;
    cont.querySelectorAll('.lex-esc-cab').forEach(function(c){
      c.onclick = function(){ var id = c.parentNode.getAttribute('data-id'); abiertas[id] = !abiertas[id]; pintarLista(); };
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
    try { pintarSelector(); } catch(e){}
    if (vista() === 'tarjetas' || typeof D === 'undefined' || !Array.isArray(D.escrituras)) return original.apply(this, arguments);
    try { pintarLista(); }
    catch(err) { console.warn('[Escrituras lista] se usa la vista anterior:', err); return original.apply(this, arguments); }
  };
  window._lexEscDatos = datos;
})();
