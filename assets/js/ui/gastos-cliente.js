// ── Oct-2026 · GASTOS POR CUENTA DEL CLIENTE (Adeudos sin recibo, versión 2) ──
// Caso que lo motivó: escrituras pactadas en $30,000; el despacho paga por el
// cliente traslado de dominio, ISR, gasolina… (fuera de lo pactado) y al final
// el cliente debe liquidar el folio Y esos gastos.
//
// Qué agrega (sin tocar recibos ni el cálculo de saldos de los folios):
//  · Cada concepto del adeudo lleva la casilla "💵 Lo pagó el despacho": al
//    guardar se registra la SALIDA en Caja (egreso, fecha de hoy) y queda ligada.
//  · El adeudo se puede LIGAR a un folio (trámite). Aparece en la Ficha del
//    folio y en Cobranza ("+ gastos $X").
//  · Botón "💰 Cobrar": eliges qué conceptos paga hoy y se registra la ENTRADA
//    en Caja (ingreso). También "ya pagó por fuera" (solo marca, sin caja).
//  · Avisos: al hacer Pago total / Pago parcial de un folio con gastos
//    pendientes, y al escribir en un recibo nuevo el nombre de un cliente que
//    debe algo aquí.
// Los movimientos se registran con fuente 'caja' (igual que Caja Rápida), así
// que NO interfieren con la conciliación de recibos.
// Este archivo REEMPLAZA las funciones de Adeudos de receipt-restoration.js
// (mismos nombres), por eso se carga después.
(function(){
  'use strict';
  if (window._lexGastosClienteV2) return;
  window._lexGastosClienteV2 = true;

  var ACOL = '#c8781a';
  function E(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function N(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim(); }
  function $m(n){ return '$' + (typeof fmt === 'function' ? fmt(n) : (parseFloat(n)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})); }
  function r2(n){ return Math.round((parseFloat(n)||0) * 100) / 100; }
  function hoyL(){ try { if (typeof _adeudoHoy === 'function') return _adeudoHoy(); } catch(e){} return new Date().toISOString().slice(0,10); }
  var MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function fC(iso){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||'')); if (!m && iso) { try { var l = _adeudoFechaLocal(iso); m = /^(\d{4})-(\d{2})-(\d{2})/.exec(l); } catch(e){} } return m ? (+m[3]) + '-' + MES[+m[2]-1] : ''; }
  function usuario(){ try { return _adeudoUsuario(); } catch(e){ return ''; } }
  function lista(){ try { if (!Array.isArray(D.adeudosSinRecibo)) D.adeudosSinRecibo = []; return D.adeudosSinRecibo; } catch(e){ return []; } }
  function activos(){ return lista().filter(function(a){ return a && !a.eliminado; }); }
  function guardar(){ try { _adeudoGuardarYSincronizar(); } catch(e){ try { save(); } catch(_){} } }
  function preguntar(titulo, msg, si, no){
    if (typeof confirmarBonito === 'function') return confirmarBonito({ titulo: titulo, mensaje: msg, btnSi: si || 'Sí', btnNo: no || 'Cancelar' });
    return Promise.resolve(confirm(msg));
  }
  function responsable(){
    return new Promise(function(res){
      try { if (typeof elegirResponsable === 'function') { elegirResponsable(function(r){ res(r); }); return; } } catch(e){}
      res(typeof empNombre === 'function' ? empNombre() : usuario());
    });
  }
  function cajaCerrada(){ try { return typeof cajaBloqueada === 'function' && cajaBloqueada(); } catch(e){ return false; } }
  function nuevoMovId(){ return 'M-' + Date.now() + '-' + Math.random().toString(36).slice(2,6); }
  function registrarMov(mov){
    try {
      if (typeof _registrarMovimiento === 'function') return _registrarMovimiento(mov) !== false;
      if (!Array.isArray(D.movimientos)) D.movimientos = [];
      D.movimientos.push(mov); return true;
    } catch(e){ console.warn('[Gastos] movimiento:', e); return false; }
  }
  function despuesDeCaja(){
    try { if (typeof save === 'function') save(); } catch(e){}
    try { if (typeof renderCaja === 'function') renderCaja(); } catch(e){}
    try { if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced().catch(function(){}); } catch(e){}
  }

  // ── Estado de cada concepto ──────────────────────────────────────────
  // Compatible con adeudos viejos: si el adeudo completo está "cobrado", todos
  // sus conceptos cuentan como cobrados.
  function conceptoCobrado(a, c){ return a.estado === 'cobrado' || !!(c && c.cobrado); }
  // "Incluido en lo pactado": costo que el despacho absorbe dentro del precio
  // del folio — NO se le cobra aparte al cliente (solo registra la salida).
  function esIncluido(c){ return !!(c && c.tipoGasto === 'incluido'); }
  function reembolsables(a){ return (a.conceptos||[]).filter(function(c){ return !esIncluido(c); }); }
  function pendientes(a){ return reembolsables(a).filter(function(c){ return !conceptoCobrado(a, c); }); }
  function totalReembolso(a){ return r2(reembolsables(a).reduce(function(s,c){ return s + (parseFloat(c.monto)||0); }, 0)); }
  function totalPendiente(a){ return r2(pendientes(a).reduce(function(s,c){ return s + (parseFloat(c.monto)||0); }, 0)); }
  window._adeudoTotal = function(a){ return r2((a.conceptos||[]).reduce(function(s,c){ return s + (parseFloat(c.monto)||0); }, 0)); };

  // ── Folios del cliente (para ligar) ──────────────────────────────────
  function ultimasVersiones(){
    var recs = []; try { recs = (typeof appData !== 'undefined' && appData && Array.isArray(appData.recibos)) ? appData.recibos : []; } catch(e){}
    var ult = {};
    recs.forEach(function(r){
      if (!r || r.folio == null || r.esComplemento) return;
      var k = String(r.folio), l = String(r.letra||'A').toUpperCase();
      if (!ult[k] || l > String(ult[k].letra||'A').toUpperCase()) ult[k] = r;
    });
    return ult;
  }
  function infoFolio(r){
    if (!r) return null;
    var abierto = false; try { abierto = typeof window._abiertoSinCosto === 'function' && window._abiertoSinCosto(r); } catch(e){}
    var saldo = parseFloat(r.saldoPendiente) || 0;
    var con = (Array.isArray(r.conceptos) && r.conceptos[0] && r.conceptos[0].concepto) || r.tramites || '';
    var est = r.cancelado ? 'cancelado' : (abierto && r.modoCosto !== 'cerrado') ? 'abierto' : (saldo > 0.005 ? 'saldo' : 'liquidado');
    return { folio: r.folio, letra: String(r.letra||'A').toUpperCase(), nombre: r.nombre || '', concepto: String(con), saldo: saldo, estado: est };
  }
  function foliosDeCliente(nombre){
    var n = N(nombre); if (!n) return [];
    var ult = ultimasVersiones(), out = [];
    Object.keys(ult).forEach(function(k){
      var r = ult[k];
      var nombres = [r.nombre].concat((r.clientes||[]).map(function(c){ return c && c.nombre; }));
      if (!nombres.some(function(x){ return N(x) === n; })) return;
      var i = infoFolio(r); if (i && i.estado !== 'cancelado') out.push(i);
    });
    var peso = { saldo: 0, abierto: 1, liquidado: 2 };
    out.sort(function(a,b){ return (peso[a.estado]-peso[b.estado]) || (b.folio - a.folio); });
    return out;
  }
  function etiquetaFolio(i){
    return 'Folio ' + i.folio + i.letra + ' · ' + (i.estado === 'saldo' ? 'saldo ' + $m(i.saldo) : i.estado === 'abierto' ? 'abierto (sin costo pactado)' : 'liquidado') + (i.concepto ? ' · ' + i.concepto.slice(0,40) : '');
  }

  // ── Consultas para Ficha, Cobranza y avisos ──────────────────────────
  function gastosDeFolio(folio){
    return activos().filter(function(a){ return a.folioVinculado != null && String(a.folioVinculado) === String(folio); });
  }
  function pendientesSinFolioDe(nombre){
    var n = N(nombre); if (!n) return [];
    return activos().filter(function(a){ return a.folioVinculado == null && a.estado !== 'cobrado' && N(a.cliente) === n && totalPendiente(a) > 0.005; });
  }
  window.lexGastosFolio = function(folio){
    var ads = gastosDeFolio(folio);
    var t = r2(ads.reduce(function(s,a){ return s + totalPendiente(a); }, 0));
    return { total: t, adeudos: ads };
  };
  window.lexAdeudosDeCliente = function(nombre){
    var n = N(nombre); if (!n) return { total: 0, adeudos: [] };
    var ads = activos().filter(function(a){ return N(a.cliente) === n && totalPendiente(a) > 0.005; });
    return { total: r2(ads.reduce(function(s,a){ return s + totalPendiente(a); }, 0)), adeudos: ads };
  };

  // ════════════════════════════════════════════════════════════════════
  // FORMULARIO (Nuevo / Editar adeudo)
  // ════════════════════════════════════════════════════════════════════
  function adeudoEnEdicion(){ try { return _adeudoEdId ? lista().filter(function(x){ return x && x.id === _adeudoEdId; })[0] : null; } catch(e){ return null; } }
  function filaHtml(c, a){
    var bloq = !!(c.movEgresoId || (a && conceptoCobrado(a, c)));
    var ro = bloq ? ' readonly title="Ya está registrado en caja o cobrado — no se puede cambiar"' : '';
    var st = 'padding:7px 9px;border:1px solid var(--border-l);border-radius:6px;font-size:0.78rem;' + (bloq ? 'background:#f5f0e4;color:#6a5a3a;' : '');
    var hoy = hoyL();
    var marcado = c.movEgresoId ? true : (c.pagadoDespacho != null ? !!c.pagadoDespacho : ((c.fecha || hoy).slice(0,10) === hoy));
    var incl = esIncluido(c);
    var selTipo = '<select class="ac-tipo" onchange="_lexAdeudoTipoCambio(this)"' + (bloq ? ' disabled' : '') + ' title="¿Se le cobra aparte al cliente o ya va dentro del precio pactado del folio?" style="flex:0 0 190px;padding:7px 6px;border:1px solid ' + (incl ? '#7fae7f' : '#e3b27a') + ';border-radius:6px;font-size:0.74rem;background:' + (incl ? '#eef8f0' : '#fff6ea') + ';color:' + (incl ? '#1a6a3a' : '#8a4a10') + ';">'
      + '<option value="reembolso"' + (incl ? '' : ' selected') + '>↩ Reembolso (se cobra aparte)</option>'
      + '<option value="incluido"' + (incl ? ' selected' : '') + '>✓ Incluido en lo pactado</option></select>';
    var casilla;
    if (c.movEgresoId) casilla = '<span style="color:#8a4a10;">✓ 💵 Lo pagó el despacho — salida de caja registrada' + (c.egresoFecha ? ' el ' + E(fC(c.egresoFecha)) : '') + '</span>';
    else if (a && conceptoCobrado(a, c)) casilla = '<span style="color:#3b6d11;">✓ Cobrado' + (c.cobradoFecha ? ' el ' + E(fC(c.cobradoFecha)) : '') + '</span>';
    else casilla = '<label style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;"><input type="checkbox" class="ac-pagado"' + ((marcado || incl) ? ' checked' : '') + (incl ? ' disabled' : '') + ' onchange="this.setAttribute(\'data-tocado\',\'1\')" style="width:15px;height:15px;accent-color:#c8781a;"> 💵 Lo pagó el despacho — registrar <b>salida de caja</b></label>';
    casilla += '<span class="ac-tipo-nota" style="margin-left:10px;color:' + (incl ? '#1a6a3a' : '#8a4a10') + ';">' + (incl ? '· Va dentro de lo pactado: NO se le cobra aparte al cliente' : '· Se le cobra aparte al cliente') + '</span>';
    return '<div class="adeudo-concepto-row" data-cid="' + E(c.id) + '"' + (bloq ? ' data-bloq="1"' : '') + ' style="margin-bottom:8px;">'
      + '<div style="display:flex;gap:6px;align-items:center;">'
      + '<input type="text" class="ac-desc" value="' + E(c.descripcion||'') + '" placeholder="Descripción" style="flex:1;min-width:0;' + st + '"' + ro + '>'
      + '<input type="date" class="ac-fecha" value="' + E((c.fecha||'').slice(0,10)) + '" onchange="_lexAdeudoFechaCambio(this)" style="flex:0 0 150px;' + st + '"' + ro + '>'
      + '<input type="number" class="ac-monto" value="' + (c.monto != null && c.monto !== '' ? c.monto : '') + '" placeholder="Monto" step="0.01" min="0" style="flex:0 0 120px;' + st + '"' + ro + '>'
      + selTipo
      + (bloq ? '<span style="width:28px;text-align:center;color:#c4b48a;" title="No se puede quitar: ya está en caja o cobrado">🔒</span>'
              : '<button type="button" onclick="quitarConceptoAdeudo(this)" title="Quitar concepto" style="background:none;border:none;color:var(--rojo,#b91c1c);font-size:1rem;cursor:pointer;padding:2px 6px;width:28px;">✕</button>')
      + '</div>'
      + '<div class="ac-casilla" style="margin:4px 0 0 2px;font-size:0.72rem;color:#8a4a10;">' + casilla + '</div>'
      + '</div>';
  }
  window._lexAdeudoTipoCambio = function(sel){
    var row = sel.closest('.adeudo-concepto-row'); if (!row) return;
    var incl = sel.value === 'incluido';
    sel.style.borderColor = incl ? '#7fae7f' : '#e3b27a'; sel.style.background = incl ? '#eef8f0' : '#fff6ea'; sel.style.color = incl ? '#1a6a3a' : '#8a4a10';
    var cb = row.querySelector('.ac-pagado');
    if (cb) { if (incl) { cb.checked = true; cb.disabled = true; } else { cb.disabled = false; } }
    var nota = row.querySelector('.ac-tipo-nota');
    if (nota) { nota.textContent = incl ? '· Va dentro de lo pactado: NO se le cobra aparte al cliente' : '· Se le cobra aparte al cliente'; nota.style.color = incl ? '#1a6a3a' : '#8a4a10'; }
  };
  window._lexAdeudoFechaCambio = function(inp){
    var row = inp.closest('.adeudo-concepto-row'); if (!row) return;
    var cb = row.querySelector('.ac-pagado');
    if (cb && !cb.getAttribute('data-tocado')) cb.checked = (inp.value === hoyL());
  };
  window._renderAdeudoConceptosLista = function(conceptos){
    var cont = document.getElementById('adeudoConceptosLista'); if (!cont) return;
    if (!conceptos.length) { cont.innerHTML = '<div style="font-size:0.74rem;color:var(--muted);padding:4px 0;">Sin conceptos — agrega uno.</div>'; return; }
    var a = adeudoEnEdicion();
    cont.innerHTML = conceptos.map(function(c){ return filaHtml(c, a); }).join('');
  };
  window.agregarConceptoAdeudo = function(){
    var cont = document.getElementById('adeudoConceptosLista'); if (!cont) return;
    if (!cont.querySelector('.adeudo-concepto-row')) cont.innerHTML = '';
    var id = 'C-' + Date.now() + '-' + (_adeudoConceptoSeq++);
    var tmp = document.createElement('div');
    tmp.innerHTML = filaHtml({ id: id, descripcion: '', fecha: hoyL(), monto: '' }, null);
    var row = tmp.firstChild; cont.appendChild(row);
    var d = row.querySelector('.ac-desc'); if (d) setTimeout(function(){ try { d.focus(); } catch(e){} }, 30);
  };
  window.quitarConceptoAdeudo = function(btn){
    var row = btn.closest('.adeudo-concepto-row');
    if (row && !row.getAttribute('data-bloq')) row.remove();
    var cont = document.getElementById('adeudoConceptosLista');
    if (cont && !cont.querySelector('.adeudo-concepto-row')) cont.innerHTML = '<div style="font-size:0.74rem;color:var(--muted);padding:4px 0;">Sin conceptos — agrega uno.</div>';
  };

  // Campo "Folio del trámite" + sugerencias de folios del cliente
  function pintarSugerenciasFolio(){
    var box = document.getElementById('adeudoFolioSug'); if (!box) return;
    var cl = (document.getElementById('adeudoCliente')||{}).value || '';
    var fs = foliosDeCliente(cl);
    if (!N(cl)) { box.innerHTML = ''; return; }
    box.innerHTML = fs.length
      ? '<div style="margin-top:4px;font-size:0.68rem;color:var(--muted);">Folios de este cliente:</div>' + fs.slice(0,6).map(function(i){
          return '<button type="button" class="adeudo-fsug" data-f="' + i.folio + '" style="display:block;width:100%;text-align:left;margin-top:3px;background:#fff;border:1px solid #e3d3a8;border-radius:5px;padding:4px 8px;font-size:0.72rem;cursor:pointer;color:#2a1c08;">📂 ' + E(etiquetaFolio(i)) + '</button>';
        }).join('')
      : '<div style="margin-top:4px;font-size:0.68rem;color:var(--muted);">Este cliente no tiene folios registrados con ese nombre.</div>';
    box.querySelectorAll('.adeudo-fsug').forEach(function(b){
      b.onclick = function(){ var f = document.getElementById('adeudoFolio'); if (f) f.value = b.getAttribute('data-f'); pintarFolioElegido(); };
    });
  }
  function pintarFolioElegido(){
    var f = document.getElementById('adeudoFolio'), info = document.getElementById('adeudoFolioInfo');
    if (!f || !info) return;
    var v = String(f.value||'').replace(/[^0-9]/g,'');
    if (!v) { info.textContent = 'Sin folio: queda solo en Adeudos sin recibo.'; info.style.color = 'var(--muted)'; return; }
    var r = ultimasVersiones()[v];
    if (!r) { info.textContent = '⚠ No existe el folio ' + v + '.'; info.style.color = '#a32d2d'; return; }
    var i = infoFolio(r);
    info.textContent = '✓ ' + etiquetaFolio(i) + ' · ' + (i.nombre||'');
    info.style.color = i.estado === 'cancelado' ? '#a32d2d' : '#1a5fa8';
  }
  function prepararCamposFolio(valor){
    var f = document.getElementById('adeudoFolio'); if (f) f.value = valor != null ? String(valor) : '';
    pintarFolioElegido(); pintarSugerenciasFolio();
  }
  document.addEventListener('input', function(ev){
    var t = ev.target; if (!t) return;
    if (t.id === 'adeudoFolio') pintarFolioElegido();
    if (t.id === 'adeudoCliente') { clearTimeout(window._lexAdSugT); window._lexAdSugT = setTimeout(pintarSugerenciasFolio, 350); }
  });

  window.abrirNuevoAdeudo = function(opts){
    opts = opts || {};
    _adeudoEdId = null;
    var t = document.getElementById('adeudoEditarTitulo'); if (t) t.textContent = '💰 Nuevo adeudo';
    var el = document.getElementById('adeudoBtnElim'); if (el) el.style.display = 'none';
    var cl = document.getElementById('adeudoCliente'); if (cl) cl.value = opts.cliente || '';
    window._renderAdeudoConceptosLista([]);
    window.agregarConceptoAdeudo();
    prepararCamposFolio(opts.folio != null ? opts.folio : '');
    var modal = document.getElementById('mAdeudoEditar'); if (modal) modal.classList.add('show');
  };
  window.abrirEditarAdeudo = function(id){
    var a = lista().filter(function(x){ return x && x.id === id; })[0]; if (!a) return;
    _adeudoEdId = id;
    var t = document.getElementById('adeudoEditarTitulo'); if (t) t.textContent = '✏ Editar adeudo';
    var el = document.getElementById('adeudoBtnElim'); if (el) el.style.display = 'inline-flex';
    var cl = document.getElementById('adeudoCliente'); if (cl) cl.value = a.cliente || '';
    window._renderAdeudoConceptosLista(a.conceptos || []);
    prepararCamposFolio(a.folioVinculado != null ? a.folioVinculado : '');
    var modal = document.getElementById('mAdeudoEditar'); if (modal) modal.classList.add('show');
  };

  window._leerConceptosAdeudoForm = function(){
    var fn = window._leerConceptosAdeudoForm; fn.error = '';
    var a = adeudoEnEdicion();
    var previos = {}; (a && a.conceptos || []).forEach(function(c){ if (c && c.id) previos[c.id] = c; });
    var out = [];
    document.querySelectorAll('#adeudoConceptosLista .adeudo-concepto-row').forEach(function(row){
      var cid = row.getAttribute('data-cid');
      var prev = cid ? previos[cid] : null;
      if (row.getAttribute('data-bloq') && prev) { out.push(prev); return; } // bloqueado: se conserva tal cual
      var elD = row.querySelector('.ac-desc'), elM = row.querySelector('.ac-monto'), cb = row.querySelector('.ac-pagado'), elT = row.querySelector('.ac-tipo');
      var tipoG = (elT && elT.value === 'incluido') ? 'incluido' : 'reembolso';
      var desc = elD ? elD.value.trim() : '';
      var fecha = (row.querySelector('.ac-fecha')||{}).value || '';
      var montoRaw = elM ? elM.value.trim() : '';
      var monto = r2(montoRaw);
      if (elD) elD.style.borderColor = ''; if (elM) elM.style.borderColor = '';
      if (!desc && !montoRaw) return;
      if (!desc) { if (elD) elD.style.borderColor = 'var(--rojo,#b91c1c)'; fn.error = fn.error || 'Falta la descripción de un concepto'; return; }
      if (!(monto > 0)) { if (elM) elM.style.borderColor = 'var(--rojo,#b91c1c)'; fn.error = fn.error || 'El monto de «' + desc + '» debe ser mayor a $0'; return; }
      if (!cid) cid = 'C-' + Date.now() + '-' + (_adeudoConceptoSeq++);
      out.push(Object.assign({}, prev || {}, { id: cid, descripcion: desc, fecha: fecha, monto: monto, tipoGasto: tipoG, pagadoDespacho: tipoG === 'incluido' ? true : !!(cb && cb.checked) }));
    });
    return out;
  };

  // Registra las SALIDAS de caja de los conceptos marcados "lo pagó el despacho"
  async function registrarSalidas(adeudo, conceptos){
    var porRegistrar = conceptos.filter(function(c){ return c.pagadoDespacho && !c.movEgresoId && !conceptoCobrado(adeudo, c); });
    if (!porRegistrar.length) return true;
    var total = r2(porRegistrar.reduce(function(s,c){ return s + c.monto; }, 0));
    if (cajaCerrada()) {
      await preguntar('Caja cerrada', 'La caja de hoy ya está cerrada, así que no se puede registrar la salida de ' + $m(total) + '.\n\nDesmarca la casilla "Lo pagó el despacho" para guardar el adeudo sin salida de caja, o regístralo mañana.', 'Entendido', 'Cerrar');
      return false;
    }
    var msg = 'Se registrará una SALIDA de caja (egreso) con fecha de hoy:\n\n'
      + porRegistrar.map(function(c){ return '• ' + c.descripcion + ' — ' + $m(c.monto); }).join('\n')
      + '\n\nTotal: ' + $m(total) + '\n¿Continuar?';
    var ok = await preguntar('Salida de caja', msg, 'Sí, registrar salida', 'Cancelar');
    if (!ok) return false;
    var resp = await responsable();
    var folioTxt = adeudo.folioVinculado != null ? ' (folio ' + adeudo.folioVinculado + ')' : '';
    for (var i = 0; i < porRegistrar.length; i++) {
      var c = porRegistrar[i];
      var mov = { id: nuevoMovId(), folioCaja: (typeof generarFolioMovCaja === 'function' ? generarFolioMovCaja() : ''),
        fecha: (typeof hoy === 'function' ? hoy() : hoyL()), hora: (typeof hora === 'function' ? hora() : ''),
        descripcion: 'Pagado por cuenta de ' + String(adeudo.cliente||'').toUpperCase() + ' · ' + c.descripcion + folioTxt + ' — adeudo',
        monto: c.monto, tipo: 'egreso', cat: 'otro', fuente: 'caja', responsable: resp,
        adeudoId: adeudo.id, adeudoConceptoId: c.id };
      if (!registrarMov(mov)) { if (typeof toast === 'function') toast('No se registró la salida de «' + c.descripcion + '»', 'err'); continue; }
      c.movEgresoId = mov.id; c.egresoFecha = mov.fecha; c.egresoPor = resp;
    }
    despuesDeCaja();
    return true;
  }

  window.guardarAdeudo = async function(){
    var cliente = ((document.getElementById('adeudoCliente')||{}).value || '').trim();
    if (!cliente) { if (typeof toast === 'function') toast('El nombre del cliente es obligatorio','err'); try { document.getElementById('adeudoCliente').focus(); } catch(e){} return; }
    var conceptos = window._leerConceptosAdeudoForm();
    if (window._leerConceptosAdeudoForm.error) { if (typeof toast === 'function') toast('⚠ ' + window._leerConceptosAdeudoForm.error,'err'); return; }
    if (!conceptos.length) { if (typeof toast === 'function') toast('Agrega al menos un concepto','err'); return; }
    // Folio ligado (opcional)
    var fv = String(((document.getElementById('adeudoFolio')||{}).value) || '').replace(/[^0-9]/g,'');
    if (!fv && conceptos.some(esIncluido)) { if (typeof toast === 'function') toast('⚠ Para marcar un concepto como "Incluido en lo pactado" escribe el folio del trámite.','err'); try { document.getElementById('adeudoFolio').focus(); } catch(e){} return; }
    var folio = null;
    if (fv) {
      if (!ultimasVersiones()[fv]) { if (typeof toast === 'function') toast('⚠ No existe el folio ' + fv + '. Corrígelo o déjalo vacío.','err'); return; }
      folio = parseInt(fv, 10);
    }
    var ahora = new Date().toISOString();
    var destino = null;
    if (_adeudoEdId) {
      destino = lista().filter(function(x){ return x && x.id === _adeudoEdId; })[0] || null;
      if (!destino) return;
      if (!(await registrarSalidas(destino, conceptos))) return;
      destino.cliente = cliente; destino.conceptos = conceptos; destino.folioVinculado = folio; destino.fechaMod = ahora;
      if (destino.estado !== 'cobrado' && conceptos.length && conceptos.every(function(c){ return c.cobrado; })) { destino.estado = 'cobrado'; destino.fechaResolucion = ahora; }
    } else {
      var existente = lista().filter(function(x){
        return x && !x.eliminado && x.estado !== 'cobrado' && N(x.cliente) === N(cliente) && String(x.folioVinculado == null ? '' : x.folioVinculado) === String(folio == null ? '' : folio);
      })[0];
      var unir = false;
      if (existente) {
        unir = await preguntar('Cliente con adeudo pendiente', cliente.toUpperCase() + ' ya tiene un adeudo pendiente de ' + $m(totalPendiente(existente)) + (folio != null ? ' en el folio ' + folio : '') + '.\n\n¿Agregar estos conceptos a ese mismo adeudo?', 'Sí, agregar a su adeudo', 'No, crear otro');
      }
      destino = (existente && unir) ? existente : {
        id: 'AR-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
        cliente: cliente, conceptos: [], estado: 'pendiente', folioVinculado: folio,
        creadoPor: usuario(), fechaCreacion: ahora, fechaResolucion: '', fechaMod: ahora
      };
      if (!(await registrarSalidas(destino, conceptos))) return;
      destino.conceptos = (destino.conceptos || []).concat(conceptos);
      destino.fechaMod = ahora;
      if (!(existente && unir)) lista().unshift(destino);
    }
    cerrar('mAdeudoEditar');
    guardar();
    if (typeof toast === 'function') toast('✅ Adeudo guardado — sincronizando...');
    refrescarTodo();
  };

  window.eliminarAdeudo = async function(){
    if (!_adeudoEdId) return;
    var a = lista().filter(function(x){ return x && x.id === _adeudoEdId; })[0]; if (!a) return;
    var conCaja = (a.conceptos||[]).filter(function(c){ return c.movEgresoId || c.movIngresoId; });
    var msg = '¿Eliminar definitivamente el adeudo de "' + a.cliente + '"?';
    if (conCaja.length) msg += '\n\nOJO: tiene movimientos ya registrados en Caja (' + conCaja.map(function(c){ return c.descripcion + ' ' + $m(c.monto); }).join(', ') + '). Eliminar el adeudo NO los borra de Caja; si fueron un error, corrígelos en Caja.';
    if (!(await preguntar('Eliminar adeudo', msg, 'Sí, eliminar', 'Cancelar'))) return;
    a.eliminado = true; a.eliminadoPor = usuario(); a.fechaMod = new Date().toISOString();
    cerrar('mAdeudoEditar');
    guardar();
    if (typeof toast === 'function') toast('🗑 Adeudo eliminado');
    refrescarTodo();
  };

  // ════════════════════════════════════════════════════════════════════
  // COBRAR
  // ════════════════════════════════════════════════════════════════════
  window.marcarAdeudoCobrado = function(id){ window.lexCobrarAdeudo(id); };
  window.lexCobrarAdeudo = function(id){
    var a = lista().filter(function(x){ return x && x.id === id; })[0]; if (!a) return;
    var pend = pendientes(a);
    if (!pend.length) { if (typeof toast === 'function') toast('Este adeudo no tiene conceptos pendientes'); return; }
    var viejo = document.getElementById('lex-cobrar-ov'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-cobrar-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Helvetica,Arial,sans-serif;';
    ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#2a1c08;">'
      + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-size:0.74rem;letter-spacing:0.1em;font-family:monospace;display:flex;justify-content:space-between;"><span>💰 COBRAR ADEUDO · ' + E(String(a.cliente||'').toUpperCase()) + '</span><span id="lex-cob-x" style="cursor:pointer;">✕</span></div>'
      + '<div style="padding:14px 16px;font-size:0.8rem;">'
      + (a.folioVinculado != null ? '<div style="color:#1a5fa8;font-size:0.74rem;margin-bottom:6px;">📂 Ligado al folio ' + E(a.folioVinculado) + '</div>' : '')
      + '<div style="color:#7a5410;font-size:0.74rem;margin-bottom:4px;">¿Qué conceptos paga hoy?</div>'
      + '<div style="background:#fff;border:1px solid #e3d3a8;border-radius:6px;padding:6px 10px;">'
      + pend.map(function(c){ return '<label style="display:flex;gap:8px;align-items:center;padding:3px 0;cursor:pointer;"><input type="checkbox" class="lex-cob-c" data-cid="' + E(c.id) + '" checked style="accent-color:#c8781a;"><span style="flex:1;">' + E(c.descripcion) + (c.fecha ? ' <span style="color:#8a7a5a;">· ' + E(fC(c.fecha)) + '</span>' : '') + (c.movEgresoId ? ' <span style="font-size:0.66rem;color:#8a4a10;">(lo pagó el despacho)</span>' : '') + '</span><b style="font-family:monospace;">' + $m(c.monto) + '</b></label>'; }).join('')
      + '<div style="text-align:right;border-top:1px dashed #d8c08a;margin-top:4px;padding-top:4px;">Cobrar hoy: <b id="lex-cob-tot" style="font-family:monospace;"></b></div>'
      + '</div>'
      + '<div id="lex-cob-err" style="color:#a32d2d;font-size:0.74rem;min-height:1em;margin-top:6px;"></div>'
      + '<button type="button" id="lex-cob-caja" style="display:block;width:100%;text-align:left;margin-top:4px;border:2px solid #9a6e18;background:#fff8e6;border-radius:8px;padding:9px 12px;cursor:pointer;color:#2a1c08;font-size:0.8rem;"><b>⚡ Registrar el cobro en Caja</b> <span style="background:#9a6e18;color:#fff;font-size:0.62rem;padding:1px 7px;border-radius:9px;margin-left:4px;">recomendado</span><div style="font-size:0.72rem;color:#5a4a2a;margin-top:2px;">Entra como INGRESO en Caja y Contabilidad (igual que Caja Rápida) y los conceptos se marcan cobrados.</div></button>'
      + '<button type="button" id="lex-cob-fuera" style="display:block;width:100%;text-align:left;margin-top:6px;border:1px solid #d8c08a;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;color:#2a1c08;font-size:0.8rem;"><b>✓ Ya pagó por otro medio</b><div style="font-size:0.72rem;color:#5a4a2a;margin-top:2px;">Solo marca como cobrado, SIN registrar dinero en Caja (ej. ya se registró en otro recibo).</div></button>'
      + '<div style="text-align:right;margin-top:10px;"><button type="button" id="lex-cob-cancel" style="background:#fff;border:1px solid #c8951a;color:#9a6e18;border-radius:6px;padding:7px 14px;font-size:0.74rem;cursor:pointer;">Cancelar</button></div>'
      + '</div></div>';
    document.body.appendChild(ov);
    var q = function(s){ return ov.querySelector(s); };
    function elegidos(){ var ids = []; ov.querySelectorAll('.lex-cob-c').forEach(function(cb){ if (cb.checked) ids.push(cb.getAttribute('data-cid')); }); return pend.filter(function(c){ return ids.indexOf(c.id) >= 0; }); }
    function tot(){ q('#lex-cob-tot').textContent = $m(elegidos().reduce(function(s,c){ return s + (parseFloat(c.monto)||0); }, 0)); q('#lex-cob-err').textContent = ''; }
    ov.querySelectorAll('.lex-cob-c').forEach(function(cb){ cb.onchange = tot; }); tot();
    function cerrarOv(){ ov.remove(); }
    q('#lex-cob-x').onclick = cerrarOv; q('#lex-cob-cancel').onclick = cerrarOv;
    ov.onclick = function(ev){ if (ev.target === ov) cerrarOv(); };
    function marcar(cs, mov, resp){
      var ahora = new Date().toISOString();
      cs.forEach(function(c){
        c.cobrado = true; c.cobradoFecha = ahora; c.cobradoPor = resp || usuario();
        if (mov) c.movIngresoId = mov.id; else c.cobradoSinCaja = true;
      });
      if (!pendientes(a).length) { a.estado = 'cobrado'; a.fechaResolucion = ahora; a.cobradoPor = resp || usuario(); }
      a.fechaMod = ahora;
      guardar();
      refrescarTodo();
    }
    q('#lex-cob-caja').onclick = async function(){
      var cs = elegidos(); if (!cs.length) { q('#lex-cob-err').textContent = 'Marca al menos un concepto.'; return; }
      if (cajaCerrada()) { q('#lex-cob-err').textContent = 'La caja de hoy ya está cerrada: no se puede registrar el ingreso.'; return; }
      var total = r2(cs.reduce(function(s,c){ return s + c.monto; }, 0));
      ov.style.display = 'none';
      var resp = await responsable();
      var mov = { id: nuevoMovId(), folioCaja: (typeof generarFolioMovCaja === 'function' ? generarFolioMovCaja() : ''),
        fecha: (typeof hoy === 'function' ? hoy() : hoyL()), hora: (typeof hora === 'function' ? hora() : ''),
        descripcion: 'Reembolso de ' + String(a.cliente||'').toUpperCase() + ' · ' + cs.map(function(c){ return c.descripcion + (cs.length > 1 ? ' $' + (typeof fmt === 'function' ? fmt(c.monto) : c.monto) : ''); }).join(' | ') + (a.folioVinculado != null ? ' (folio ' + a.folioVinculado + ')' : '') + ' — adeudo',
        monto: total, tipo: 'ingreso', cat: 'otro', fuente: 'caja', responsable: resp,
        adeudoId: a.id, adeudoConceptoIds: cs.map(function(c){ return c.id; }) };
      if (!registrarMov(mov)) { ov.style.display = 'flex'; q('#lex-cob-err').textContent = 'No se registró el cobro en caja.'; return; }
      despuesDeCaja();
      marcar(cs, mov, resp);
      cerrarOv();
      if (typeof toast === 'function') toast('▲ Cobro registrado en Caja — ' + $m(total));
    };
    q('#lex-cob-fuera').onclick = async function(){
      var cs = elegidos(); if (!cs.length) { q('#lex-cob-err').textContent = 'Marca al menos un concepto.'; return; }
      ov.style.display = 'none';
      var ok = await preguntar('Marcar como cobrado', '¿Confirmas que ' + String(a.cliente||'').toUpperCase() + ' ya pagó ' + $m(cs.reduce(function(s,c){ return s + c.monto; }, 0)) + ' por otro medio?\n\nNo se registrará dinero en Caja.', 'Sí, ya pagó', 'Cancelar');
      if (!ok) { ov.style.display = 'flex'; return; }
      marcar(cs, null, usuario());
      cerrarOv();
      if (typeof toast === 'function') toast('✅ Marcado como cobrado (sin movimiento de caja)');
    };
  };

  window.reabrirAdeudo = async function(id){
    var a = lista().filter(function(x){ return x && x.id === id; })[0]; if (!a) return;
    var enCaja = (a.conceptos||[]).filter(function(c){ return c.cobrado && c.movIngresoId; });
    var reabribles = (a.conceptos||[]).filter(function(c){ return !(c.cobrado && c.movIngresoId); });
    if (!reabribles.length) {
      await preguntar('No se puede reabrir', 'Todos los conceptos de este adeudo se cobraron en Caja. Si el cobro fue un error, corrígelo primero en Caja.', 'Entendido', 'Cerrar');
      return;
    }
    var msg = '¿Regresar el adeudo de ' + String(a.cliente||'').toUpperCase() + ' a pendiente?';
    if (enCaja.length) msg += '\n\nLos conceptos cobrados en Caja (' + enCaja.map(function(c){ return c.descripcion; }).join(', ') + ') se quedan como cobrados.';
    if (!(await preguntar('Reabrir adeudo', msg, 'Sí, reabrir', 'Cancelar'))) return;
    reabribles.forEach(function(c){ delete c.cobrado; delete c.cobradoFecha; delete c.cobradoPor; delete c.cobradoSinCaja; });
    a.estado = 'pendiente'; a.fechaResolucion = ''; delete a.cobradoPor;
    a.fechaMod = new Date().toISOString();
    guardar();
    if (typeof toast === 'function') toast('↩ Adeudo reabierto como pendiente');
    refrescarTodo();
  };

  // ════════════════════════════════════════════════════════════════════
  // LISTA de Adeudos sin recibo
  // ════════════════════════════════════════════════════════════════════
  window.renderAdeudosLista = function(){
    var cont = document.getElementById('adeudosLista'); if (!cont) return;
    var q = N((document.getElementById('adeudosBuscar')||{}).value || '');
    var todos = activos();
    var verCob = (typeof _adeudosVerCobrados !== 'undefined') && _adeudosVerCobrados;
    var porCobrar = function(a){ return a.estado !== 'cobrado' && totalPendiente(a) > 0.005; };
    var lst = todos.filter(function(a){ return verCob ? !porCobrar(a) : porCobrar(a); });
    if (q) lst = lst.filter(function(a){
      return N(a.cliente).indexOf(q) >= 0 || String(a.folioVinculado == null ? '' : a.folioVinculado) === q.replace(/[^0-9]/g,'') && q.replace(/[^0-9]/g,'') !== ''
        || (a.conceptos||[]).some(function(c){ return N(c.descripcion).indexOf(q) >= 0; });
    });
    var orden = todos.filter(porCobrar).slice().sort(function(a,b){ var ka=a.fechaCreacion||'', kb=b.fechaCreacion||''; return ka<kb?-1:ka>kb?1:0; });
    var mapa = new Map(); orden.forEach(function(x,i){ mapa.set(x, i+1); });
    lst = lst.slice().sort(function(a,b){
      var ka = verCob ? (a.fechaResolucion||'') : (a.fechaCreacion||''), kb = verCob ? (b.fechaResolucion||'') : (b.fechaCreacion||'');
      return kb.localeCompare(ka);
    });
    var contador = document.getElementById('adeudosContador'); if (contador) contador.textContent = lst.length;
    if (!lst.length) {
      cont.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:0.82rem;">' + (q ? 'Ningún adeudo coincide con la búsqueda.' : (verCob ? 'No hay adeudos cobrados todavía.' : 'No hay adeudos pendientes.')) + '</div>';
      return;
    }
    var totalLista = lst.reduce(function(s,a){ return s + (verCob ? totalReembolso(a) : totalPendiente(a)); }, 0);
    var resumen = '<div style="display:flex;justify-content:flex-end;align-items:baseline;gap:8px;margin:0 2px 10px;font-size:0.74rem;color:var(--muted);">'
      + (verCob ? 'Total cobrado en esta lista:' : 'Total por cobrar:')
      + ' <strong style="font-family:monospace;font-size:0.95rem;color:' + ACOL + ';">' + $m(totalLista) + '</strong></div>';
    cont.innerHTML = resumen + lst.map(function(a){
      var soloIncl = !reembolsables(a).length;
      var cobrado = !porCobrar(a);
      var num = cobrado ? '' : (mapa.get(a) || '');
      var badge = (cobrado && soloIncl)
        ? '<span title="Solo tiene costos incluidos en lo pactado: no hay nada que cobrarle aparte" style="background:#1a6a3a;color:#fff;font-size:0.62rem;font-weight:700;padding:3px 9px;border-radius:12px;white-space:nowrap;">INCLUIDO EN LO PACTADO</span>'
        : cobrado
        ? '<span style="background:' + ACOL + ';color:#fff;font-size:0.62rem;font-weight:700;padding:3px 9px;border-radius:12px;white-space:nowrap;">COBRADO</span>'
        : '<span style="background:#8c6518;color:#fff;font-size:0.62rem;font-weight:700;padding:3px 9px;border-radius:12px;white-space:nowrap;">PENDIENTE</span>';
      var circulo = (cobrado && soloIncl)
        ? '<div title="Incluido en lo pactado" style="width:20px;height:20px;border-radius:50%;background:#1a6a3a;flex-shrink:0;color:#fff;text-align:center;line-height:20px;font-size:12px;">✓</div>'
        : cobrado
        ? '<div onclick="event.stopPropagation();reabrirAdeudo(\'' + a.id + '\')" title="Reabrir" style="width:20px;height:20px;border-radius:50%;background:' + ACOL + ';flex-shrink:0;color:#fff;text-align:center;line-height:20px;font-size:12px;cursor:pointer;">✓</div>'
        : '<div onclick="event.stopPropagation();lexCobrarAdeudo(\'' + a.id + '\')" title="Cobrar" style="width:20px;height:20px;border-radius:50%;border:2px solid ' + ACOL + ';flex-shrink:0;cursor:pointer;"></div>';
      var ficha = num ? '<div title="N° de ficha — posición entre los adeudos activos, se recalcula solo" style="display:flex;flex-direction:column;align-items:center;line-height:1.05;flex-shrink:0;"><span style="color:#a8987a;font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">Adeudo</span><span style="color:' + ACOL + ';font-family:\'JetBrains Mono\',monospace;font-size:15px;font-weight:900;">' + num + '</span></div>' : '';
      var tit = cobrado ? 'text-decoration:line-through;color:var(--muted);' : 'color:' + ACOL + ';';
      var cs = a.conceptos || [];
      var csHtml = cs.map(function(c){
        var cob = conceptoCobrado(a, c) && !esIncluido(c);
        return '<div style="display:flex;justify-content:space-between;gap:10px;font-size:0.76rem;color:var(--ink);padding:2px 0;' + (cob && !cobrado ? 'opacity:0.6;' : '') + '">'
          + '<span>' + (cob && !cobrado ? '<s>' : '') + E(c.descripcion||'(sin descripción)') + (cob && !cobrado ? '</s>' : '') + (c.fecha ? ' <span style="color:var(--muted);">· ' + E(String(c.fecha).slice(0,10)) + '</span>' : '')
          + (c.movEgresoId ? ' <span title="Salida de caja registrada" style="font-size:0.64rem;background:#fdf0dc;color:#8a4a10;border-radius:4px;padding:0 5px;">💵 lo pagó el despacho</span>' : '')
          + (esIncluido(c) ? ' <span title="Va dentro del precio pactado del folio: no se le cobra aparte" style="font-size:0.64rem;background:#eef8f0;color:#1a6a3a;border-radius:4px;padding:0 5px;">✓ incluido en lo pactado</span>' : '')
          + (cob && !cobrado ? ' <span style="font-size:0.64rem;color:#3b6d11;">✓ cobrado ' + E(fC(c.cobradoFecha)) + '</span>' : '')
          + '</span><span style="white-space:nowrap;font-family:monospace;' + (esIncluido(c) ? 'color:#7a8a7a;' : '') + '">' + $m(c.monto) + '</span></div>';
      }).join('');
      var pendT = totalPendiente(a);
      var hayParcial = !cobrado && pendT < totalReembolso(a) - 0.005;
      var totHtml = (!soloIncl && (cs.length >= 2 || hayParcial))
        ? '<div style="display:flex;justify-content:space-between;gap:10px;font-size:0.78rem;font-weight:700;border-top:1px solid rgba(200,149,42,0.25);margin-top:4px;padding-top:4px;"><span>' + (cobrado ? 'TOTAL COBRADO' : 'POR COBRAR') + '</span><span style="font-family:monospace;">' + $m(cobrado ? totalReembolso(a) : pendT) + '</span></div>'
        : '';
      var folioChip = a.folioVinculado != null ? '<span style="font-size:0.62rem;background:#e6f1fb;color:#185fa5;border-radius:10px;padding:2px 8px;margin-left:8px;white-space:nowrap;">📂 Folio ' + E(a.folioVinculado) + '</span>' : '';
      var acciones = cobrado
        ? '<div style="display:flex;justify-content:space-between;align-items:center;margin-left:30px;border-top:1px solid rgba(200,149,42,0.15);padding-top:8px;margin-top:8px;">'
          + '<div style="font-size:0.62rem;color:var(--muted);">' + (soloIncl ? 'Costos del despacho dentro de lo pactado' : 'Cobrado: ' + E(_adeudoFechaLocal(a.fechaResolucion)) + (a.cobradoPor ? ' · ' + E(a.cobradoPor) : '')) + '</div>'
          + (soloIncl ? '<button onclick="abrirEditarAdeudo(\'' + a.id + '\')" style="background:#e6f1fb;color:#185fa5;font-size:0.66rem;font-weight:700;padding:4px 9px;border:none;border-radius:6px;cursor:pointer;">EDITAR</button></div>' : '')
          + (soloIncl ? '' : '<button onclick="reabrirAdeudo(\'' + a.id + '\')" style="background:none;border:1px solid var(--border-l);color:var(--muted);font-size:0.66rem;font-weight:700;padding:4px 9px;border-radius:6px;cursor:pointer;">↩ REABRIR</button></div>')
        : '<div style="display:flex;justify-content:space-between;align-items:center;margin-left:30px;border-top:1px solid rgba(200,149,42,0.15);padding-top:8px;margin-top:8px;">'
          + '<div style="font-size:0.62rem;color:var(--muted);">' + E(a.creadoPor||'') + ' · ' + E(_adeudoFechaLocal(a.fechaCreacion)) + '</div>'
          + '<div style="display:flex;gap:6px;">'
          + '<button onclick="lexCobrarAdeudo(\'' + a.id + '\')" title="Cobrar" style="background:#fff3e6;color:' + ACOL + ';font-size:0.66rem;font-weight:700;padding:4px 9px;border:none;border-radius:6px;cursor:pointer;">💰 COBRAR</button>'
          + '<button onclick="abrirEditarAdeudo(\'' + a.id + '\')" style="background:#e6f1fb;color:#185fa5;font-size:0.66rem;font-weight:700;padding:4px 9px;border:none;border-radius:6px;cursor:pointer;">EDITAR</button>'
          + '</div></div>';
      return '<div style="position:relative;display:flex;align-items:stretch;background:var(--surface,#fdfaf4);border:1px solid var(--border-l);border-radius:10px;margin-bottom:8px;overflow:hidden;' + (cobrado ? 'opacity:0.65;' : '') + '">'
        + '<div style="width:5px;background:' + ACOL + ';flex-shrink:0;"></div>'
        + '<div style="flex:1;min-width:0;padding:12px 14px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'
        + '<div style="display:flex;align-items:center;gap:10px;">' + circulo + ficha
        + '<div style="font-size:13.5px;font-weight:600;font-family:\'Outfit\',sans-serif;letter-spacing:0.025em;text-transform:uppercase;opacity:0.92;' + tit + '">👤 ' + E(a.cliente||'(sin nombre)') + '</div>' + folioChip + '</div>'
        + badge + '</div>'
        + (csHtml ? '<div style="margin:6px 0 0 30px;">' + csHtml + totHtml + '</div>' : '')
        + acciones + '</div></div>';
    }).join('');
  };

  // ════════════════════════════════════════════════════════════════════
  // FICHA DEL FOLIO: "Gastos extra por cuenta del cliente"
  // ════════════════════════════════════════════════════════════════════
  window.lexPintarGastosFicha = function(recibo){
    var box = document.getElementById('ficha-gastos-extra'); if (!box) return;
    if (!recibo || recibo.folio == null) { box.innerHTML = ''; box.style.display = 'none'; return; }
    var ads = gastosDeFolio(recibo.folio);
    var nombre = recibo.nombre || ((recibo.clientes||[])[0]||{}).nombre || '';
    var sueltos = pendientesSinFolioDe(nombre);
    var filas = [], incluidos = [];
    ads.forEach(function(a){ (a.conceptos||[]).forEach(function(c){ (esIncluido(c) ? incluidos : filas).push({ a: a, c: c }); }); });
    if (!filas.length && !incluidos.length && !sueltos.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
    incluidos.sort(function(x,y){ return String(x.c.fecha||'').localeCompare(String(y.c.fecha||'')); });
    filas.sort(function(x,y){ return String(x.c.fecha||'').localeCompare(String(y.c.fecha||'')); });
    var pend = r2(ads.reduce(function(s,a){ return s + totalPendiente(a); }, 0));
    // Saldo de la versión MÁS RECIENTE del folio (la ficha puede recibir cualquier letra)
    var infoU = infoFolio(ultimasVersiones()[String(recibo.folio)] || recibo);
    var saldo = infoU ? infoU.saldo : (parseFloat(recibo.saldoPendiente) || 0);
    var conSaldo = !!(infoU && infoU.estado === 'saldo');
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
      + '<span style="font-size:0.6rem;font-family:\'DM Mono\',monospace;font-weight:700;color:#8a4a10;text-transform:uppercase;letter-spacing:0.1em;">💸 Gastos extra por cuenta del cliente <span style="text-transform:none;letter-spacing:0;font-weight:400;color:#7a6840;">(fuera de lo pactado)</span></span>'
      + '<button type="button" onclick="lexNuevoGastoFolio(' + Number(recibo.folio) + ')" style="font-size:0.66rem;border:1px solid #c8781a;background:#fff;color:#c8781a;border-radius:5px;padding:3px 9px;cursor:pointer;">＋ Agregar gasto</button></div>';
    if (filas.length) {
      html += '<div style="background:#fff;border:1px solid #ecd9b5;border-radius:6px;overflow:hidden;">' + filas.map(function(f){
        var cob = conceptoCobrado(f.a, f.c);
        return '<div style="display:grid;grid-template-columns:62px 1fr 150px 92px;gap:6px;padding:5px 10px;border-bottom:1px solid #f1e6cc;font-size:0.74rem;align-items:center;' + (cob ? 'color:#8a7a5a;' : '') + '">'
          + '<span>' + E(fC(f.c.fecha)) + '</span>'
          + '<span>' + (cob ? '<s>' : '') + E(f.c.descripcion) + (cob ? '</s>' : '') + (f.c.movEgresoId ? ' <span style="font-size:0.62rem;background:#fdf0dc;color:#8a4a10;border-radius:4px;padding:0 5px;">lo pagó el despacho</span>' : '') + '</span>'
          + '<span style="font-size:0.66rem;color:' + (cob ? '#3b6d11' : '#a32d2d') + ';">' + (cob ? '✓ cobrado ' + E(fC(f.c.cobradoFecha)) : 'pendiente') + '</span>'
          + '<span style="text-align:right;font-family:monospace;">' + $m(f.c.monto) + '</span></div>';
      }).join('') + '</div>';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:0.74rem;">'
        + '<span>Gastos pendientes: <b style="font-family:monospace;color:#a32d2d;">' + $m(pend) + '</b>'
        + (pend > 0.005 && conSaldo ? ' &nbsp;·&nbsp; Total para liquidar (saldo ' + $m(saldo) + ' + gastos): <b style="font-family:monospace;">' + $m(r2(saldo + pend)) + '</b>' : '') + '</span>'
        + (pend > 0.005 ? '<button type="button" onclick="lexCobrarGastosFolio(' + Number(recibo.folio) + ')" style="font-size:0.7rem;border:none;background:#c8781a;color:#fff;border-radius:5px;padding:5px 11px;cursor:pointer;font-weight:700;">💰 Cobrar gastos</button>' : '')
        + '</div>';
    }
    if (incluidos.length) {
      var ti = r2(incluidos.reduce(function(s,f){ return s + (parseFloat(f.c.monto)||0); }, 0));
      html += '<div style="margin-top:10px;font-size:0.6rem;font-family:\'DM Mono\',monospace;font-weight:700;color:#1a6a3a;text-transform:uppercase;letter-spacing:0.1em;">✓ Costos incluidos en lo pactado <span style="text-transform:none;letter-spacing:0;font-weight:400;color:#5a7a5a;">(los pagó el despacho — no se cobran aparte)</span></div>'
        + '<div style="background:#fff;border:1px solid #cfe3cf;border-radius:6px;overflow:hidden;margin-top:4px;">' + incluidos.map(function(f){
          return '<div style="display:grid;grid-template-columns:62px 1fr 150px 92px;gap:6px;padding:5px 10px;border-bottom:1px solid #e3efe3;font-size:0.74rem;align-items:center;">'
            + '<span>' + E(fC(f.c.fecha)) + '</span><span>' + E(f.c.descripcion) + '</span>'
            + '<span style="font-size:0.66rem;color:#1a6a3a;">' + (f.c.movEgresoId ? 'salida de caja ' + E(fC(f.c.egresoFecha)) : 'incluido') + '</span>'
            + '<span style="text-align:right;font-family:monospace;">' + $m(f.c.monto) + '</span></div>';
        }).join('') + '</div>'
        + '<div style="font-size:0.72rem;margin-top:4px;color:#1a6a3a;">Total que absorbió el despacho dentro de lo pactado: <b style="font-family:monospace;">' + $m(ti) + '</b></div>';
    }
    if (sueltos.length) {
      var ts = r2(sueltos.reduce(function(s,a){ return s + totalPendiente(a); }, 0));
      html += '<div style="margin-top:8px;background:#fdf0dc;border:1px solid #e8c58a;border-radius:6px;padding:7px 10px;font-size:0.74rem;color:#6a3a08;">⚠ Este cliente también debe <b>' + $m(ts) + '</b> en Adeudos sin recibo sin folio. '
        + '<button type="button" onclick="lexLigarAdeudosAFolio(' + Number(recibo.folio) + ')" style="font-size:0.68rem;border:1px solid #c8781a;background:#fff;color:#c8781a;border-radius:5px;padding:2px 8px;cursor:pointer;margin-left:4px;">Ligarlos a este folio</button></div>';
    }
    box.innerHTML = html;
    box.style.display = 'block';
  };
  window.lexNuevoGastoFolio = function(folio){
    var r = ultimasVersiones()[String(folio)];
    var nombre = r ? (r.nombre || ((r.clientes||[])[0]||{}).nombre || '') : '';
    window.abrirNuevoAdeudo({ cliente: String(nombre).trim(), folio: folio });
  };
  window.lexCobrarGastosFolio = function(folio){
    var ads = gastosDeFolio(folio).filter(function(a){ return totalPendiente(a) > 0.005; });
    if (!ads.length) return;
    if (ads.length === 1) { window.lexCobrarAdeudo(ads[0].id); return; }
    // Varios adeudos ligados: se cobran uno por uno (cada uno con su detalle)
    window.lexCobrarAdeudo(ads[0].id);
    if (typeof toast === 'function') toast('Este folio tiene ' + ads.length + ' fichas de gastos: cobra esta y luego la siguiente');
  };
  window.lexLigarAdeudosAFolio = async function(folio){
    var r = ultimasVersiones()[String(folio)]; if (!r) return;
    var sueltos = pendientesSinFolioDe(r.nombre || ((r.clientes||[])[0]||{}).nombre || '');
    if (!sueltos.length) return;
    var ok = await preguntar('Ligar al folio ' + folio, 'Se ligarán ' + sueltos.length + ' adeudo(s) de ' + String(r.nombre||'').toUpperCase() + ' (' + $m(sueltos.reduce(function(s,a){ return s + totalPendiente(a); }, 0)) + ') al folio ' + folio + '.\n\n¿Continuar?', 'Sí, ligar', 'Cancelar');
    if (!ok) return;
    var ahora = new Date().toISOString();
    sueltos.forEach(function(a){ a.folioVinculado = Number(folio); a.fechaMod = ahora; });
    guardar(); refrescarTodo();
  };

  // ════════════════════════════════════════════════════════════════════
  // AVISO antes de Pago total / Pago parcial de un folio con gastos
  // ════════════════════════════════════════════════════════════════════
  function avisoTresBotones(titulo, msg, b1, b2){
    return new Promise(function(res){
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Helvetica,Arial,sans-serif;';
      ov.innerHTML = '<div style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:470px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#2a1c08;">'
        + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-size:0.74rem;letter-spacing:0.1em;font-family:monospace;">⚠ ' + E(titulo) + '</div>'
        + '<div style="padding:14px 16px;font-size:0.82rem;line-height:1.5;white-space:pre-line;">' + E(msg) + '</div>'
        + '<div style="padding:0 16px 14px;display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;">'
        + '<button type="button" data-r="cancelar" style="background:#fff;border:1px solid #c8951a;color:#9a6e18;border-radius:6px;padding:7px 12px;font-size:0.74rem;cursor:pointer;">Cancelar</button>'
        + '<button type="button" data-r="seguir" style="background:#fff;border:1px solid #9a6e18;color:#6a4a10;border-radius:6px;padding:7px 12px;font-size:0.74rem;cursor:pointer;">' + E(b2) + '</button>'
        + '<button type="button" data-r="cobrar" style="background:#c8781a;border:none;color:#fff;border-radius:6px;padding:7px 12px;font-size:0.74rem;font-weight:700;cursor:pointer;">' + E(b1) + '</button>'
        + '</div></div>';
      document.body.appendChild(ov);
      ov.querySelectorAll('button').forEach(function(b){ b.onclick = function(){ ov.remove(); res(b.getAttribute('data-r')); }; });
    });
  }
  function envolverPago(nombreFn, etiqueta){
    var orig = window[nombreFn];
    if (typeof orig !== 'function' || orig._lexGastos) return;
    var env = async function(){
      try {
        var r = (typeof reciboEnConsulta !== 'undefined') ? reciboEnConsulta : null;
        if (r && r.folio != null) {
          var g = window.lexGastosFolio(r.folio);
          var nombre = r.nombre || ((r.clientes||[])[0]||{}).nombre || '';
          var sueltos = pendientesSinFolioDe(nombre);
          var tSueltos = r2(sueltos.reduce(function(s,a){ return s + totalPendiente(a); }, 0));
          if (g.total > 0.005 || tSueltos > 0.005) {
            var det = [];
            if (g.total > 0.005) det.push('• ' + $m(g.total) + ' en gastos extra ligados a este folio (' + g.adeudos.map(function(a){ return pendientes(a).map(function(c){ return c.descripcion; }).join(', '); }).join(', ') + ')');
            if (tSueltos > 0.005) det.push('• ' + $m(tSueltos) + ' en Adeudos sin recibo sin folio');
            var resp = await avisoTresBotones(etiqueta + ' · folio ' + r.folio,
              String(nombre).toUpperCase() + ' además del saldo del folio debe:\n' + det.join('\n') + '\n\n¿Quieres cobrar esos gastos ahora?',
              '💰 Cobrar los gastos', 'Seguir solo con el folio');
            if (resp === 'cancelar') return;
            if (resp === 'cobrar') {
              var lst = g.adeudos.filter(function(a){ return totalPendiente(a) > 0.005; }).concat(sueltos);
              if (lst.length) window.lexCobrarAdeudo(lst[0].id);
              return;
            }
          }
        }
      } catch(e){ console.warn('[Gastos] aviso ' + nombreFn + ':', e); }
      return orig.apply(this, arguments);
    };
    env._lexGastos = true;
    window[nombreFn] = env;
  }
  envolverPago('ejecutarLiquidacionTotal', 'Pago total');
  envolverPago('ejecutarPagoParcial', 'Pago parcial');

  // ── Aviso al escribir el nombre en un recibo NUEVO ───────────────────
  document.addEventListener('focusout', function(ev){
    var t = ev.target;
    if (!t || !t.id || t.id.indexOf('nombre_') !== 0 || !t.closest || !t.closest('#clientes-wrapper')) return;
    var row = t.closest('.cliente-row') || t.parentNode;
    var viejo = row && row.querySelector('.lex-aviso-adeudo'); if (viejo) viejo.remove();
    var info = window.lexAdeudosDeCliente(t.value);
    if (!(info.total > 0.005)) return;
    var d = document.createElement('div');
    d.className = 'lex-aviso-adeudo';
    d.style.cssText = 'margin-top:4px;background:#fdf0dc;border:1px solid #e8c58a;border-radius:6px;padding:5px 9px;font-size:0.72rem;color:#6a3a08;';
    d.innerHTML = '⚠ Este cliente debe <b>' + $m(info.total) + '</b> en Adeudos sin recibo / gastos extra'
      + (info.adeudos.some(function(a){ return a.folioVinculado != null; }) ? ' (folio ' + info.adeudos.filter(function(a){ return a.folioVinculado != null; }).map(function(a){ return a.folioVinculado; }).join(', ') + ')' : '')
      + '. <a href="#" style="color:#c8781a;font-weight:700;">Ver</a>';
    d.querySelector('a').onclick = function(e){ e.preventDefault(); try { abrirAdeudosSinRecibo(); var b = document.getElementById('adeudosBuscar'); if (b) { b.value = t.value; window.renderAdeudosLista(); } } catch(_){} };
    (t.parentNode || row).appendChild(d);
  }, true);

  function refrescarTodo(){
    try { window.renderAdeudosLista(); } catch(e){}
    try { if (typeof reciboEnConsulta !== 'undefined' && reciboEnConsulta) window.lexPintarGastosFicha(reciboEnConsulta); } catch(e){}
    try { if (typeof window._cobranzaRefrescar === 'function') window._cobranzaRefrescar(); } catch(e){}
  }
  window._lexGastosRefrescar = refrescarTodo;
})();
