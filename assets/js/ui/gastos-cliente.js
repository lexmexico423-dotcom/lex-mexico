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
  // Los 'Saldos de años anteriores' (tipo:'anterior') viven en la misma lista pero se manejan aparte (saldos-anteriores.js)
  function activos(){ return lista().filter(function(a){ return a && !a.eliminado && a.tipo !== 'anterior'; }); }
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
  function reembolsables(a){ return (a.conceptos||[]).filter(function(c){ return !esIncluido(c) && c.tipoGasto !== 'adelanto' && c.tipoGasto !== 'complementario'; }); }
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
    if (!v) { info.textContent = 'Sin folio: queda solo en Reembolsos.'; info.style.color = 'var(--muted)'; return; }
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
    if (!resp) { if (typeof toast === 'function') toast('Cancelado — no se registró la salida', 'err'); return false; }   // Nov-2026
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
  // Nov-2026 · Anti-duplicado: antes de cobrar se revisa (1) lo que ya llegó a
  // esta computadora y (2) el servidor, por si en otra computadora ya se cobró
  // el mismo concepto mientras esta pantalla seguía abierta.
  function horaDe(iso){ try { var d = new Date(iso); return d.toLocaleDateString('es-MX') + ' a las ' + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }); } catch(_){ return ''; } }
  function revisarCobrado(adeudo, ids){
    if (!adeudo) return null;
    var c = (adeudo.conceptos || []).filter(function(x){ return x && ids.indexOf(x.id) >= 0 && x.cobrado; })[0];
    if (!c) return null;
    return 'Ya lo cobró ' + (c.cobradoPor || 'otra persona') + (c.cobradoFecha ? ' el ' + horaDe(c.cobradoFecha) : '') + ' (' + c.descripcion + ' — ' + $m(c.monto) + ').';
  }
  async function yaCobradoPorOtro(a, cs, soloLocal){
    var ids = cs.map(function(c){ return c.id; });
    // 1) Copia local (puede haber llegado por sincronización mientras estaba abierto)
    var loc = lista().filter(function(x){ return x && x.id === a.id; })[0];
    var m1 = revisarCobrado(loc, ids); if (m1) return m1;
    var tomb = {}; try { (D.movimientos_eliminados || []).forEach(function(t){ if (t && t.id) tomb[t.id] = 1; }); } catch(_){}
    var mv = (D.movimientos || []).filter(function(m){ return m && !tomb[m.id] && m.adeudoId === a.id && m.tipo === 'ingreso' && (m.adeudoConceptoIds || []).some(function(id){ return ids.indexOf(id) >= 0; }); })[0];
    if (mv) return 'Ya se registró en Caja: ' + (mv.folioCaja || '') + ' · ' + (mv.hora || '') + ' · ' + (mv.responsable || 'sin nombre') + ' — ' + $m(mv.monto) + '.';
    if (soloLocal) return null;
    // 2) Servidor (máx. 6 s; si no contesta, se sigue con la confirmación normal)
    try {
      if (!window.SB || !window.SB_DESPACHO_ID) return null;
      var r = await Promise.race([
        window.SB.from('app_state').select('adeudos:data->adeudosSinRecibo').eq('despacho_id', window.SB_DESPACHO_ID).maybeSingle(),
        new Promise(function(_, rj){ setTimeout(function(){ rj(new Error('timeout')); }, 6000); })
      ]);
      var srv = r && r.data && Array.isArray(r.data.adeudos) ? r.data.adeudos.filter(function(x){ return x && x.id === a.id; })[0] : null;
      var m2 = revisarCobrado(srv, ids);
      if (m2 && loc) {
        // Traer a esta computadora lo que ya está en el servidor
        (srv.conceptos || []).forEach(function(sc){ var lc = (loc.conceptos || []).filter(function(x){ return x.id === sc.id; })[0]; if (lc && sc.cobrado) { lc.cobrado = true; lc.cobradoFecha = sc.cobradoFecha; lc.cobradoPor = sc.cobradoPor; if (sc.movIngresoId) lc.movIngresoId = sc.movIngresoId; } });
        if (srv.estado === 'cobrado') { loc.estado = 'cobrado'; loc.fechaResolucion = srv.fechaResolucion || loc.fechaResolucion; loc.cobradoPor = srv.cobradoPor || loc.cobradoPor; }
        loc.fechaMod = srv.fechaMod || loc.fechaMod;
      }
      return m2;
    } catch(_){ return null; }
  }
  window.marcarAdeudoCobrado = function(id){ window.lexCobrarAdeudo(id); };
  window.lexCobrarAdeudo = function(id){
    var a = lista().filter(function(x){ return x && x.id === id; })[0]; if (!a) return;
    var pend = pendientes(a);
    if (!pend.length) { if (typeof toast === 'function') toast('Este adeudo no tiene conceptos pendientes'); return; }
    var viejo = document.getElementById('lex-cobrar-ov'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-cobrar-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Helvetica,Arial,sans-serif;';
    ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#2a1c08;">'
      + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-size:0.74rem;letter-spacing:0.1em;font-family:monospace;display:flex;justify-content:space-between;"><span>💰 YA PAGÓ · REGISTRAR EL PAGO DE ' + E(String(a.cliente||'').toUpperCase()) + '</span><span id="lex-cob-x" style="cursor:pointer;">✕</span></div>'
      + '<div style="padding:14px 16px;font-size:0.8rem;">'
      + (a.folioVinculado != null ? '<div style="color:#1a5fa8;font-size:0.74rem;margin-bottom:6px;">📂 Ligado al folio ' + E(a.folioVinculado) + '</div>' : '')
      + '<div style="color:#7a5410;font-size:0.74rem;margin-bottom:4px;">¿Qué está pagando hoy?</div>'
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
      // Nov-2026 (caso real 11-nov, folio F-NV2026-31): "Cancelar" en ¿Quién registra?
      // registraba el cobro SIN nombre. Ahora Cancelar = no se registra nada.
      if (!resp) { ov.style.display = 'flex'; q('#lex-cob-err').textContent = 'Cobro cancelado — no se registró nada.'; return; }
      // ¿Ya lo cobró alguien más en otra computadora?
      var dup = await yaCobradoPorOtro(a, cs);
      if (dup) { cerrarOv(); await preguntar('Este adeudo ya se cobró', dup + '\n\nNo se registró un segundo cobro.', 'Entendido', 'Cerrar'); refrescarTodo(); return; }
      // Confirmación final
      var okCob = await preguntar('¿Está seguro de este COBRO?',
        String(a.cliente||'').toUpperCase() + '\n\n' + cs.map(function(c){ return '• ' + c.descripcion + ' — ' + $m(c.monto); }).join('\n')
        + '\n\nTotal: ' + $m(total) + '\nResponsable: ' + resp + '\n\nSe registrará como INGRESO en Caja.', 'Sí, cobrar', 'Cancelar');
      if (!okCob) { ov.style.display = 'flex'; q('#lex-cob-err').textContent = 'Cobro cancelado — no se registró nada.'; return; }
      dup = await yaCobradoPorOtro(a, cs, true);   // revisión final (solo local, instantánea)
      if (dup) { cerrarOv(); await preguntar('Este adeudo ya se cobró', dup + '\n\nNo se registró un segundo cobro.', 'Entendido', 'Cerrar'); refrescarTodo(); return; }
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
      var dupF = await yaCobradoPorOtro(a, cs);
      if (dupF) { cerrarOv(); await preguntar('Este adeudo ya se cobró', dupF, 'Entendido', 'Cerrar'); refrescarTodo(); return; }
      var ok = await preguntar('Marcar como cobrado', '¿Confirmas que ' + String(a.cliente||'').toUpperCase() + ' ya pagó ' + $m(cs.reduce(function(s,c){ return s + c.monto; }, 0)) + ' por otro medio?\n\nNo se registrará dinero en Caja.', 'Sí, ya pagó', 'Cancelar');
      if (!ok) { ov.style.display = 'flex'; return; }
      marcar(cs, null, usuario());
      cerrarOv();
      if (typeof toast === 'function') toast('✅ Marcado como cobrado (sin movimiento de caja)');
    };
  };

  // ════════════════════════════════════════════════════════════════════
  // Nov-2026 · REEMBOLSOS AL DESPACHO (a petición del Lic.)
  // Aquí solo van reembolsos: dinero que puso el despacho por un cliente.
  //  · Al anotarlo, el dinero salió de la CAJA (Caja Rápida precargada como
  //    salida) o de OTRO LADO (no toca la caja).
  //  · Al pagar el cliente, el dinero entra SIEMPRE por Caja Rápida precargada.
  // ════════════════════════════════════════════════════════════════════
  var RB = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Helvetica,Arial,sans-serif;';
  var OPC = 'display:block;width:100%;text-align:left;background:#fff;border:1.5px solid #d4b870;border-radius:10px;padding:11px 14px;margin-bottom:8px;font-size:0.9rem;color:#2a1c08;cursor:pointer;';
  var INP = 'width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #c8952a;border-radius:8px;font-size:0.9rem;background:#fff;color:#2a1c08;margin-bottom:10px;';
  function ventana(titulo){
    var v = document.getElementById('lex-rb-ov'); if (v) v.remove();
    var ov = document.createElement('div'); ov.id = 'lex-rb-ov'; ov.style.cssText = RB;
    ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:520px;max-height:92vh;overflow-y:auto;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#2a1c08;">'
      + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-size:0.76rem;letter-spacing:0.08em;font-family:monospace;display:flex;justify-content:space-between;"><span>' + E(titulo) + '</span><span id="lex-rb-x" style="cursor:pointer;">✕</span></div>'
      + '<div id="lex-rb-body" style="padding:16px 18px;"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#lex-rb-x').onclick = function(){ ov.remove(); };
    ov.onclick = function(ev){ if (ev.target === ov) ov.remove(); };
    return ov;
  }
  function preg(t){ return '<div style="font-weight:700;font-size:0.98rem;margin:4px 0 10px;">' + t + '</div>'; }
  function opcion(id, t, sub){ return '<button type="button" id="' + id + '" style="' + OPC + '"><b>' + t + '</b>' + (sub ? '<div style="font-size:0.76rem;color:#7a6440;margin-top:2px;">' + sub + '</div>' : '') + '</button>'; }
  function errBox(){ return '<div id="lex-rb-err" style="color:#a32d2d;font-size:0.78rem;min-height:1em;margin-bottom:6px;"></div>'; }
  function actualizarMov(mov, cambios){
    try {
      Object.assign(mov, cambios);
      var real = (D.movimientos || []).filter(function(m){ return m && m.id === mov.id; })[0];
      if (real && real !== mov) Object.assign(real, cambios);
    } catch(_){}
  }
  function hayCaja(){ return typeof window.lexCajaRapidaPrecargada === 'function'; }

  // ── ＋ Nuevo reembolso (Nov-2026 · versión final acordada con el Lic.) ──
  // Paso 1: cliente + ¿tiene folio?   Paso 2: qué se pagó, cuánto se cobra,
  // (con folio) cómo lo registramos, y de dónde salió el dinero.
  var ELE = 'border:1.5px solid #3B6D11;background:#EAF3DE;border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px;';
  var GRP = 'font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:#8c6518;margin:8px 0 4px;';
  function etq(txt, bg, col){ return ' <span style="font-size:0.66rem;background:' + bg + ';color:' + col + ';border-radius:10px;padding:1px 8px;white-space:nowrap;vertical-align:1px;">' + txt + '</span>'; }
  function nombresConocidos(){
    var s = {};
    try { (D.directorio || []).forEach(function(d){ if (d && d.nombre) s[String(d.nombre).toUpperCase().trim()] = 1; }); } catch(_){}
    try { var u = ultimasVersiones(); Object.keys(u).forEach(function(k){ var n = u[k].nombre || ((u[k].clientes||[])[0]||{}).nombre; if (n) s[String(n).toUpperCase().trim()] = 1; }); } catch(_){}
    try { activos().forEach(function(a){ if (a.cliente) s[String(a.cliente).toUpperCase().trim()] = 1; }); } catch(_){}
    return Object.keys(s).sort();
  }
  window.lexNuevoReembolso = function(opts){
    opts = opts || {};
    var S = { cli: String(opts.cliente || '').toUpperCase().trim(), tiene: opts.folio != null ? true : null, folio: opts.folio != null ? String(opts.folio) : '', desdeFicha: opts.folio != null,
              que: '', mon: '', modo: null, dinero: null, deCaja: '' };
    var ov = ventana('＋ NUEVO REEMBOLSO AL DESPACHO');
    var b = ov.querySelector('#lex-rb-body');
    var $ = function(id){ return ov.querySelector('#' + id); };
    function folioInfo(){ var r = S.folio ? ultimasVersiones()[String(parseInt(S.folio, 10))] : null; return r ? { r: r, i: infoFolio(r) } : null; }
    // ── PASO 1 ──
    function paso1(){
      ov.querySelector('span').textContent = '＋ NUEVO REEMBOLSO AL DESPACHO';
      var fi = folioInfo();
      var h = '<div style="font-size:0.7rem;color:#8c6518;letter-spacing:0.08em;margin-bottom:4px;">PASO 1 DE 2</div>'
        + preg('Nombre del cliente') + '<input id="rb-cli" style="' + INP + 'margin-bottom:4px;" placeholder="Escribe el nombre…" autocomplete="off" value="' + E(S.cli) + '"><div id="rb-sug"></div>'
        + preg('¿Tiene folio este trámite?')
        + '<div style="display:flex;gap:8px;margin-bottom:8px;"><button type="button" id="rb-si" style="' + OPC + 'flex:1;margin:0;' + (S.tiene === true ? 'border-color:#3B6D11;background:#EAF3DE;' : '') + '"><b>Sí, tiene folio</b></button>'
        + '<button type="button" id="rb-no" style="' + OPC + 'flex:1;margin:0;' + (S.tiene === false ? 'border-color:#3B6D11;background:#EAF3DE;' : '') + '"><b>No tiene folio</b></button></div>';
      if (S.tiene === true) {
        h += preg('Número de folio') + '<input id="rb-fol" type="number" min="1" style="' + INP + '" placeholder="Ej. 122" value="' + E(S.folio) + '">';
        if (S.folio && fi) h += '<div style="background:#EAF3DE;color:#27500A;border-radius:8px;padding:9px 12px;font-size:0.84rem;margin-bottom:8px;line-height:1.5;">✓ <b>Folio ' + E(fi.i.folio) + '</b> · ' + E(fi.i.nombre) + (fi.i.concepto ? ' · ' + E(fi.i.concepto) : '') + '<br>Saldo de su recibo: <b>' + $m(fi.i.saldo) + '</b>'
          + (S.cli && S.cli !== String(fi.i.nombre).toUpperCase().trim() ? '<br><span style="color:#854F0B;">⚠ El folio está a nombre de ' + E(fi.i.nombre) + '. Se usará ese nombre.</span>' : '') + '</div>';
        else if (S.folio) h += '<div style="background:#FCEBEB;color:#791F1F;border-radius:8px;padding:9px 12px;font-size:0.84rem;margin-bottom:8px;">No existe el folio ' + E(S.folio) + '.</div>';
      }
      if (S.tiene === false) h += '<div style="background:#E6F1FB;color:#0C447C;border-radius:8px;padding:9px 12px;font-size:0.84rem;margin-bottom:8px;">Quedará en <b>Reembolsos al despacho</b>, sin folio.</div>';
      h += errBox() + '<div style="text-align:right;margin-top:6px;"><button type="button" id="rb-p1" style="background:#8c6518;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:0.88rem;font-weight:700;cursor:pointer;">Continuar →</button></div>';
      b.innerHTML = h;
      var ci = $('rb-cli');
      ci.oninput = function(){
        S.cli = String(ci.value || '').toUpperCase(); var q = N(ci.value), sg = $('rb-sug');
        var m = q.length > 1 ? nombresConocidos().filter(function(x){ return N(x).indexOf(q) >= 0; }).slice(0, 6) : [];
        sg.innerHTML = m.length ? '<div style="background:#fff;border:1px solid #e3d3a8;border-radius:8px;margin-bottom:8px;overflow:hidden;">' + m.map(function(x){ return '<div data-n="' + E(x) + '" style="padding:7px 12px;font-size:0.84rem;cursor:pointer;border-bottom:1px solid #f1e6cc;">' + E(x) + '</div>'; }).join('') + '</div>' : '';
        sg.querySelectorAll('[data-n]').forEach(function(d){ d.onclick = function(){
          S.cli = d.getAttribute('data-n');
          var fs = foliosDeCliente(S.cli).filter(function(f){ return f.estado !== 'cancelado'; });
          if (fs.length === 1) { S.tiene = true; S.folio = String(fs[0].folio); }
          paso1();
        }; });
      };
      $('rb-si').onclick = function(){ S.tiene = true; paso1(); var f = $('rb-fol'); if (f) f.focus(); };
      $('rb-no').onclick = function(){ S.tiene = false; S.folio = ''; paso1(); };
      var fo = $('rb-fol'); if (fo) { fo.onchange = fo.onblur = function(){ S.folio = String(fo.value || '').trim(); paso1(); }; fo.onkeydown = function(ev){ if (ev.key === 'Enter') { ev.preventDefault(); S.folio = String(fo.value || '').trim(); paso1(); } }; }
      $('rb-p1').onclick = function(){
        var e = $('lex-rb-err');
        if (S.tiene === true && $('rb-fol')) S.folio = String($('rb-fol').value || '').trim();
        if (String(S.cli).trim().length < 2) { e.textContent = 'Escribe el nombre del cliente.'; return; }
        if (S.tiene === null) { e.textContent = 'Indica si el trámite tiene folio.'; return; }
        if (S.tiene === true) { var f2 = folioInfo(); if (!f2) { e.textContent = 'Escribe un número de folio que exista.'; return; } S.cli = String(f2.i.nombre || S.cli).toUpperCase().trim(); }
        paso2();
      };
      setTimeout(function(){ if (!S.cli && ci) ci.focus(); }, 30);
    }
    // ── PASO 2 ──
    var MODOS = [
      { v: 'adelanto', g: 'Dentro de lo pactado', t: '⏩ El pago lo hizo el despacho para avanzar el trámite', e: etq('se descuenta del saldo', '#E6F1FB', '#0C447C'),
        s: 'Este pago está <b>dentro de lo pactado</b>. Lo pagamos nosotros para no detener el trámite; cuando el cliente lo pague, <b>se descuenta de su saldo</b>.' },
      { v: 'tercero', g: 'Fuera de lo pactado', t: '💵 Gasto fuera de lo pactado que el cliente nos debe reembolsar', e: etq('reembolso · Caja Rápida', '#FAEEDA', '#633806'),
        s: 'Cualquier gasto que cubrió el despacho y <b>no estaba en lo pactado</b>: traslados, viáticos, honorarios de diligencias, pagos a terceros, requisitos faltantes, copias, derechos… <b>El cliente nos lo debe reembolsar.</b> Se cobra por Caja Rápida, sin recibo.' },
      { v: 'complementario', g: '', t: '➕ Servicio complementario', e: etq('genera recibo', '#EAF3DE', '#27500A'),
        s: 'Es un <b>servicio extra</b> fuera de lo pactado. Se le cobra al cliente aparte y se genera su <b>recibo de servicio complementario</b>.' } ];
    function dineroOps(){ var m = r2(S.mon); return [
      { v: 'total', t: '1. Retirar la totalidad del dinero de la caja', s: 'Se retira de caja todo' + (m > 0 ? ': ' + $m(m) : '') },
      { v: 'parte', t: '2. Retirar una parte del dinero de la caja', s: 'Se retira de caja solo una parte; lo demás es gestión del despacho' },
      { v: 'lic', t: '3. El Lic. puso la totalidad del dinero', s: 'No se toca la caja' } ]; }
    function bloque(lista, sel, clave){
      if (sel) { var o = lista.filter(function(x){ return x.v === sel; })[0];
        return '<div style="' + ELE + '"><div><b>' + o.t + '</b>' + (o.e || '') + '<div style="font-size:0.76rem;color:#27500A;margin-top:2px;">' + o.s + '</div></div><button type="button" data-cambiar="' + clave + '" style="background:none;border:1px solid #3B6D11;color:#27500A;border-radius:7px;padding:4px 10px;font-size:0.76rem;cursor:pointer;white-space:nowrap;">Cambiar</button></div>'; }
      var g = '', out = '';
      lista.forEach(function(o){ if (o.g && o.g !== g) { g = o.g; out += '<div style="' + GRP + '">' + o.g + '</div>'; }
        out += '<button type="button" data-' + clave + '="' + o.v + '" style="' + OPC + '"><b>' + o.t + '</b>' + (o.e || '') + '<div style="font-size:0.76rem;color:#5a4a2a;margin-top:2px;line-height:1.4;">' + o.s + '</div></button>'; });
      return out;
    }
    function resumen(){
      var m = r2(S.mon), c = r2(S.deCaja), quien = String(S.cli).split(' ')[0] || 'El cliente';
      if (!(m > 0) || !S.dinero) return '';
      var txt = S.dinero === 'total' ? 'Se retira de caja <b>' + $m(m) + '</b> · ' + E(quien) + ' nos regresará <b>' + $m(m) + '</b>'
        : S.dinero === 'lic' ? 'No se toca la caja · ' + E(quien) + ' nos regresará <b>' + $m(m) + '</b>'
        : (!(c > 0) ? 'Escribe cuánto se retiró de la caja.' : c > m + 0.005 ? '<span style="color:#a32d2d;">No puede ser mayor a lo que se le cobrará (' + $m(m) + ').</span>'
          : 'Se retira de caja <b>' + $m(c) + '</b> · ' + E(quien) + ' nos regresará <b>' + $m(m) + '</b>' + (c < m - 0.005 ? ' · Diferencia (gestión): <b>' + $m(r2(m - c)) + '</b>' : ''));
      if (S.modo === 'complementario') txt += '<br>Después se abre <b>＋ Servicio complementario</b> del folio ' + E(S.folio) + ' para generar su recibo.';
      return '<div style="background:#FAEEDA;color:#633806;border-radius:8px;padding:9px 12px;font-size:0.82rem;margin-top:6px;line-height:1.5;">' + txt + '</div>';
    }
    function paso2(){
      var conFolio = S.tiene === true;
      ov.querySelector('span').textContent = conFolio ? '＋ REEMBOLSO DEL FOLIO ' + S.folio : '＋ NUEVO REEMBOLSO AL DESPACHO';
      var h = '<div style="font-size:0.7rem;color:#8c6518;letter-spacing:0.08em;margin-bottom:4px;">' + (S.desdeFicha ? '' : 'PASO 2 DE 2 · ') + E(S.cli) + (conFolio ? ' · FOLIO ' + E(S.folio) : ' · SIN FOLIO') + '</div>'
        + preg('¿Qué se pagó?') + '<input id="rb-que" style="' + INP + '" placeholder="Ej. Pago de catastro, ISR, constancia…" autocomplete="off" value="' + E(S.que) + '">'
        + preg('¿Cuánto se le va a cobrar al cliente?') + '<input id="rb-mon" type="number" step="0.01" min="0" style="' + INP + '" placeholder="$0.00" value="' + E(S.mon) + '">';
      if (conFolio) h += preg('Este reembolso o adeudo, ¿cómo lo registramos?') + bloque(MODOS, S.modo, 'modo');
      h += preg('¿Cómo registramos de dónde salió el dinero?') + bloque(dineroOps(), S.dinero, 'dinero');
      if (S.dinero === 'parte') h += preg('¿Qué cantidad retiramos de la caja?') + '<input id="rb-caja-mon" type="number" step="0.01" min="0" style="' + INP + '" placeholder="$0.00" value="' + E(S.deCaja) + '">';
      h += '<div id="rb-res">' + resumen() + '</div>' + errBox()
        + '<div style="display:flex;justify-content:space-between;gap:10px;margin-top:8px;">'
        + (S.desdeFicha ? '<span></span>' : '<button type="button" id="rb-atras" style="background:#fff;border:1.5px solid #c8952a;color:#8c6518;border-radius:8px;padding:9px 16px;font-size:0.84rem;cursor:pointer;">← Regresar</button>')
        + '<button type="button" id="rb-fin" style="background:#8c6518;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:0.88rem;font-weight:700;cursor:pointer;">' + (S.dinero === 'lic' ? (S.modo === 'complementario' ? 'Continuar al recibo' : 'Guardar') : 'Continuar a Caja Rápida') + '</button></div>';
      b.innerHTML = h;
      var guardaCampos = function(){ S.que = String(($('rb-que')||{}).value || ''); S.mon = String(($('rb-mon')||{}).value || ''); if ($('rb-caja-mon')) S.deCaja = String($('rb-caja-mon').value || ''); };
      ['rb-que','rb-mon','rb-caja-mon'].forEach(function(id){ var i = $(id); if (i) i.oninput = function(){ guardaCampos(); $('rb-res').innerHTML = resumen(); }; });
      b.querySelectorAll('[data-modo]').forEach(function(x){ x.onclick = function(){ guardaCampos(); S.modo = x.getAttribute('data-modo'); paso2(); }; });
      b.querySelectorAll('[data-dinero]').forEach(function(x){ x.onclick = function(){ guardaCampos(); S.dinero = x.getAttribute('data-dinero'); if (S.dinero === 'parte' && !S.deCaja) S.deCaja = S.mon; paso2(); if (S.dinero === 'parte') setTimeout(function(){ var i = $('rb-caja-mon'); if (i) { i.focus(); i.select(); } }, 20); }; });
      b.querySelectorAll('[data-cambiar]').forEach(function(x){ x.onclick = function(){ guardaCampos(); var k = x.getAttribute('data-cambiar'); if (k === 'modo') S.modo = null; else { S.dinero = null; } paso2(); }; });
      var at = $('rb-atras'); if (at) at.onclick = function(){ guardaCampos(); paso1(); };
      $('rb-fin').onclick = function(){ guardaCampos(); terminar(); };
      if (!S.que) setTimeout(function(){ var i = $('rb-que'); if (i) i.focus(); }, 30);
    }
    function terminar(){
      var e = $('lex-rb-err'), conFolio = S.tiene === true;
      var d = { cli: String(S.cli).toUpperCase().trim(), que: String(S.que).trim().toUpperCase(), mon: r2(S.mon), modo: conFolio ? S.modo : 'tercero', folio: conFolio ? S.folio : null };
      if (!d.que) { e.textContent = 'Escribe qué se pagó.'; return; }
      if (!(d.mon > 0)) { e.textContent = 'Escribe cuánto se le va a cobrar al cliente.'; return; }
      if (conFolio && !S.modo) { e.textContent = 'Elige cómo lo registramos.'; return; }
      if (!S.dinero) { e.textContent = 'Elige de dónde salió el dinero.'; return; }
      var deCaja = S.dinero === 'total' ? d.mon : S.dinero === 'parte' ? r2(S.deCaja) : 0;
      if (S.dinero === 'parte') { if (!(deCaja > 0)) { e.textContent = 'Escribe qué cantidad se retiró de la caja.'; return; } if (deCaja > d.mon + 0.005) { e.textContent = 'Lo que se retira de caja no puede ser mayor a lo que se le cobrará (' + $m(d.mon) + ').'; return; } }
      ov.remove();
      var fin = function(mov){ var a = registrarReembolso(d, mov); if (d.modo === 'complementario') abrirServicioComplementario(d, a); };
      if (deCaja > 0) {
        if (!hayCaja()) { if (typeof toast === 'function') toast('No se pudo abrir Caja Rápida', 'err'); return; }
        var etqModo = d.modo === 'adelanto' ? 'adelanto dentro de lo pactado' : d.modo === 'complementario' ? 'servicio complementario' : 'reembolso';
        window.lexCajaRapidaPrecargada({ tipo: 'egreso', desc: 'Pagado por cuenta de ' + d.cli + ' · ' + d.que + (d.folio ? ' (folio ' + d.folio + ')' : '') + ' — ' + etqModo, monto: deCaja,
          aviso: '💵 Se retira de caja ' + $m(deCaja) + ' pagados por cuenta de ' + d.cli + (d.folio ? ' (folio ' + d.folio + ')' : '') + (deCaja < d.mon - 0.005 ? '. Se le cobrará ' + $m(d.mon) + ' (incluye ' + $m(r2(d.mon - deCaja)) + ' de gestión)' : '') + '. Revisa y presiona Registrar.',
          extra: { tipoReembolso: 'salida' },
          onRegistrado: function(mov){ var a = fin(mov); } });
      } else fin(null);
    }
    if (S.desdeFicha && S.cli) paso2(); else paso1();
  };
  // Crea el registro según el modo elegido
  function registrarReembolso(d, movEgreso){
    var ahora = new Date().toISOString();
    var tipo = d.modo === 'adelanto' ? 'adelanto' : d.modo === 'complementario' ? 'complementario' : 'reembolso';
    var c = { id: 'C-' + Date.now() + '-0', fecha: hoyL(), monto: d.mon, descripcion: d.que, tipoGasto: tipo, pagadoDespacho: true, origenDinero: movEgreso ? 'caja' : 'lic' };
    if (movEgreso) { c.movEgresoId = movEgreso.id; c.egresoFecha = movEgreso.fecha; c.egresoPor = movEgreso.responsable || usuario(); c.montoCaja = r2(movEgreso.monto); if (c.montoCaja < d.mon - 0.005) c.honorariosGestion = r2(d.mon - c.montoCaja); }
    var a = { id: 'AR-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), cliente: d.cli, conceptos: [c], estado: 'pendiente',
      creadoPor: usuario(), fechaCreacion: ahora, fechaResolucion: '', fechaMod: ahora };
    if (d.folio) a.folioVinculado = isNaN(Number(d.folio)) ? d.folio : Number(d.folio);
    if (tipo === 'complementario') { a.estado = 'pendiente-recibo'; }
    lista().unshift(a);
    if (movEgreso) actualizarMov(movEgreso, { adeudoId: a.id, adeudoConceptoIds: [c.id] });
    guardar(); refrescarTodo();
    if (typeof toast === 'function') toast(tipo === 'adelanto' ? '✅ Anotado: el despacho adelantó ' + $m(d.mon) + ' de ' + d.que + ' (folio ' + d.folio + ')'
      : tipo === 'complementario' ? '✅ Ahora genera el recibo de servicio complementario' : '✅ Reembolso anotado: ' + d.cli + ' nos debe ' + $m(d.mon));
    return a;
  }

  // ════════════════════════════════════════════════════════════════════
  // Nov-2026 · ADELANTOS DENTRO DE LO PACTADO y SERVICIO COMPLEMENTARIO
  // ════════════════════════════════════════════════════════════════════
  function esAdelanto(c){ return !!(c && c.tipoGasto === 'adelanto'); }
  function esComplementario(c){ return !!(c && c.tipoGasto === 'complementario'); }
  function adelantosPend(a){ return (a.conceptos || []).filter(function(c){ return esAdelanto(c) && !c.cobrado; }); }
  function totalAdelantoPend(a){ return r2(adelantosPend(a).reduce(function(s, c){ return s + (parseFloat(c.monto) || 0); }, 0)); }
  window._lexAdelantosDeFolio = function(folio){ return gastosDeFolio(folio).filter(function(a){ return adelantosPend(a).length; }); };
  function abrirFolioEnConsulta(folio, luego){
    try { if (typeof ir === 'function') ir('nuevo-recibo'); } catch(_){}
    setTimeout(function(){
      var inp = document.getElementById('folio_anterior');
      if (inp) inp.value = String(folio);
      try { if (typeof cargarHistorialFolio === 'function') cargarHistorialFolio(); } catch(e){ console.warn('[Reembolsos] abrir folio', e); }
      setTimeout(function(){
        if (!(typeof reciboEnConsulta !== 'undefined' && reciboEnConsulta && String(reciboEnConsulta.folio) === String(folio))) { if (typeof toast === 'function') toast('No se pudo abrir el folio ' + folio, 'err'); return; }
        try { luego(); } catch(e){ console.warn('[Reembolsos]', e); }
      }, 700);
    }, 250);
  }
  // Precargas para los formularios de recibo existentes
  function envolverFormularios(){
    if (typeof window.agregarCostoExtra === 'function' && !window.agregarCostoExtra._lexRb) {
      var oCE = window.agregarCostoExtra;
      var eCE = function(data){
        var p = window._lexPrecargaCE;
        if (p && !data) { window._lexPrecargaCE = null; data = { concepto: p.concepto, descripcion: p.descripcion || '', precio: (typeof fmtMXN === 'function' ? fmtMXN(p.precio) : String(p.precio)) }; }
        return oCE.call(this, data);
      };
      eCE._lexRb = true; window.agregarCostoExtra = eCE; try { agregarCostoExtra = eCE; } catch(_){}
    }
    if (typeof window.agregarPagoParcial === 'function' && !window.agregarPagoParcial._lexRb) {
      var oPP = window.agregarPagoParcial;
      var ePP = function(data){
        var p = window._lexPrecargaPP;
        if (p && data && data.concepto === 'Abono parcial' && !data.cantidad) {
          window._lexPrecargaPP = null; var r;
          p.forEach(function(x){ r = oPP.call(this, { concepto: x.concepto, descripcion: x.descripcion || '', cantidad: (typeof fmtMXN === 'function' ? fmtMXN(x.cantidad) : String(x.cantidad)), locked: false }); }, this);
          return r;
        }
        return oPP.apply(this, arguments);
      };
      ePP._lexRb = true; window.agregarPagoParcial = ePP; try { agregarPagoParcial = ePP; } catch(_){}
    }
  }
  setInterval(envolverFormularios, 3000); setTimeout(envolverFormularios, 1500);
  function letraDe(folio){ var r = ultimasVersiones()[String(folio)]; return r ? String(r.letra || 'A').toUpperCase() : ''; }

  // ── Servicio complementario: abrir el folio con el renglón ya lleno ──
  function abrirServicioComplementario(d, a){
    envolverFormularios();
    window._lexScEnCurso = { folio: String(d.folio), adeudoId: a.id, letraAntes: letraDe(d.folio), concepto: d.que, desde: Date.now() };
    abrirFolioEnConsulta(d.folio, function(){
      window._lexPrecargaCE = { concepto: d.que, precio: d.mon };
      if (typeof ejecutarServicioComplementario === 'function') ejecutarServicioComplementario();
    });
  }
  window.lexGenerarComplementario = function(adeudoId){
    var a = lista().filter(function(x){ return x && x.id === adeudoId; })[0]; if (!a) return;
    var c = (a.conceptos || [])[0] || {};
    abrirServicioComplementario({ folio: a.folioVinculado, que: c.descripcion, mon: c.monto }, a);
  };

  // ── Adelanto: "Reembolsar" → recibo B (pago parcial) con renglones claros ──
  window.lexReembolsarAdelanto = function(folio){
    var ads = window._lexAdelantosDeFolio(folio); if (!ads.length) { if (typeof toast === 'function') toast('No hay pagos adelantados pendientes en este folio'); return; }
    var conceptos = []; ads.forEach(function(a){ adelantosPend(a).forEach(function(c){ conceptos.push({ a: a, c: c }); }); });
    var total = r2(conceptos.reduce(function(s, x){ return s + (parseFloat(x.c.monto) || 0); }, 0));
    var desc = conceptos.map(function(x){ return String(x.c.descripcion || '').toLowerCase(); }).join(' y ');
    var info = infoFolio(ultimasVersiones()[String(folio)]);
    var ov = ventana('REEMBOLSAR PAGO ADELANTADO · FOLIO ' + folio);
    var b = ov.querySelector('#lex-rb-body');
    b.innerHTML = '<div style="font-size:0.9rem;margin-bottom:10px;">El despacho adelantó <b>' + $m(total) + '</b> de <b>' + E(desc) + '</b>.<div style="font-size:0.8rem;color:#5a4a2a;margin-top:2px;">Saldo de su recibo: ' + $m(info ? info.saldo : 0) + '</div></div>'
      + preg('¿Cuánto trae el cliente?')
      + opcion('ra-exacto', 'Exactamente lo adelantado — ' + $m(total), 'Recibo con un renglón: «Pago parcial por concepto de ' + E(desc) + '»')
      + opcion('ra-otra', 'Otra cantidad', 'Primero se cubre lo adelantado; si sobra, va como abono a su cuenta')
      + '<div id="ra-box" style="display:none;"><input id="ra-mon" type="number" step="0.01" min="0" style="' + INP + '" placeholder="¿Cuánto trae? $"><div id="ra-res" style="font-size:0.82rem;color:#5a4a2a;margin-bottom:8px;"></div>'
      + '<button type="button" id="ra-ok" style="background:#3B6D11;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:0.85rem;font-weight:700;cursor:pointer;">Continuar al recibo</button></div>' + errBox();
    var $ = function(id){ return ov.querySelector('#' + id); };
    function partes(m){ var cub = Math.min(m, total), resto = r2(m - cub); return { cub: r2(cub), resto: resto }; }
    function ir2(m){
      if (info && m > info.saldo + 0.005) { $('lex-rb-err').textContent = 'No puede ser mayor al saldo de su recibo (' + $m(info.saldo) + ').'; return; }
      var p = partes(m); ov.remove(); envolverFormularios();
      var filas = [{ concepto: 'Pago parcial por concepto de ' + desc, cantidad: p.cub }];
      if (p.resto > 0.005) filas.push({ concepto: 'Abono a cuenta', cantidad: p.resto });
      window._lexAdelantoEnCurso = { folio: String(folio), letraAntes: letraDe(folio), prefijo: 'Pago parcial por concepto de ', desde: Date.now() };
      abrirFolioEnConsulta(folio, function(){
        window._lexPrecargaPP = filas;
        if (typeof ejecutarPagoParcial === 'function') ejecutarPagoParcial();
      });
    }
    $('ra-exacto').onclick = function(){ ir2(total); };
    $('ra-otra').onclick = function(){ $('ra-box').style.display = 'block'; setTimeout(function(){ $('ra-mon').focus(); }, 20); };
    $('ra-mon').oninput = function(){ var m = r2($('ra-mon').value); if (!(m > 0)) { $('ra-res').textContent = ''; return; } var p = partes(m);
      $('ra-res').innerHTML = 'Cubre lo adelantado: <b>' + $m(p.cub) + '</b>' + (p.resto > 0.005 ? ' · Abono a su cuenta: <b>' + $m(p.resto) + '</b>' : (p.cub < total - 0.005 ? ' · Quedará pendiente del adelanto: <b>' + $m(r2(total - p.cub)) + '</b>' : '')); };
    $('ra-ok').onclick = function(){ var m = r2($('ra-mon').value); if (!(m > 0)) { $('lex-rb-err').textContent = 'Escribe cuánto trae.'; return; } ir2(m); };
  };

  // Nov-2026 · Si se cobra con "Pago parcial" o "Pago total" de siempre en un folio
  // con pagos adelantados pendientes, se pregunta si ese pago los cubre.
  function preguntarAdelanto(folio, tipo){
    return new Promise(function(res){
      var ads = window._lexAdelantosDeFolio(folio);
      var conceptos = []; ads.forEach(function(a){ adelantosPend(a).forEach(function(c){ conceptos.push(c); }); });
      var total = r2(conceptos.reduce(function(s, c){ return s + (parseFloat(c.monto) || 0); }, 0));
      var desc = conceptos.map(function(c){ return String(c.descripcion || '').toLowerCase(); }).join(' y ');
      var ov = ventana('PAGO ADELANTADO PENDIENTE · FOLIO ' + folio);
      var b = ov.querySelector('#lex-rb-body');
      b.innerHTML = '<div style="font-size:0.92rem;line-height:1.5;margin-bottom:12px;">Este folio tiene <b>' + $m(total) + '</b> de <b>' + E(desc) + '</b> que adelantó el despacho.</div>'
        + preg(tipo === 'total' ? '¿Este pago total incluye cubrir ese adelanto?' : '¿Este pago es para cubrirlo?')
        + opcion('pa-si', 'Sí, cubrir ' + E(desc) + ' (' + $m(total) + ')', tipo === 'total' ? 'Al liquidar, el adelanto queda recuperado' : 'El recibo dirá «Pago parcial por concepto de ' + E(desc) + '»')
        + opcion('pa-no', 'No, es otro abono', 'El adelanto sigue pendiente');
      ov.querySelector('#lex-rb-x').onclick = function(){ ov.remove(); res(null); };
      ov.onclick = function(ev){ if (ev.target === ov) { ov.remove(); res(null); } };
      ov.querySelector('#pa-si').onclick = function(){ ov.remove(); res('si'); };
      ov.querySelector('#pa-no').onclick = function(){ ov.remove(); res('no'); };
    });
  }
  function envolverCobrosFolio(){
    if (typeof window.ejecutarPagoParcial === 'function' && !window.ejecutarPagoParcial._lexAd) {
      var oP = window.ejecutarPagoParcial;
      var eP = async function(){
        try {
          var r = (typeof reciboEnConsulta !== 'undefined') ? reciboEnConsulta : null;
          if (r && !window._lexPrecargaPP && window._lexAdelantosDeFolio(r.folio).length) {
            var resp = await preguntarAdelanto(r.folio, 'parcial');
            if (resp === null) return;
            if (resp === 'si') { window.lexReembolsarAdelanto(r.folio); return; }
          }
        } catch(e){ console.warn('[Reembolsos] pago parcial', e); }
        return oP.apply(this, arguments);
      };
      eP._lexAd = true; window.ejecutarPagoParcial = eP; try { ejecutarPagoParcial = eP; } catch(_){}
    }
    if (typeof window.ejecutarLiquidacionTotal === 'function' && !window.ejecutarLiquidacionTotal._lexAd) {
      var oT = window.ejecutarLiquidacionTotal;
      var eT = async function(){
        try {
          var r = (typeof reciboEnConsulta !== 'undefined') ? reciboEnConsulta : null;
          if (r && window._lexAdelantosDeFolio(r.folio).length) {
            var resp = await preguntarAdelanto(r.folio, 'total');
            if (resp === null) return;
            if (resp === 'si') window._lexAdelantoEnCurso = { folio: String(r.folio), letraAntes: letraDe(r.folio), liquidacion: true, desde: Date.now() };
          }
        } catch(e){ console.warn('[Reembolsos] pago total', e); }
        return oT.apply(this, arguments);
      };
      eT._lexAd = true; window.ejecutarLiquidacionTotal = eT; try { ejecutarLiquidacionTotal = eT; } catch(_){}
    }
  }
  setInterval(envolverCobrosFolio, 3000); setTimeout(envolverCobrosFolio, 1500);

  // ── Vigilante: cuando se genera el recibo (B, C…) se marcan las cosas ──
  function revisarRecibosNuevos(){
    try {
      var sc = window._lexScEnCurso;
      if (sc) {
        if (Date.now() - sc.desde > 3 * 3600000) window._lexScEnCurso = null;
        else { var r = ultimasVersiones()[sc.folio]; var l = r ? String(r.letra || 'A').toUpperCase() : '';
          if (r && l > sc.letraAntes) {
            var a = lista().filter(function(x){ return x && x.id === sc.adeudoId; })[0];
            var hay = (r.costosExtra || []).some(function(ce){ return N(ce.concepto) === N(sc.concepto); });
            if (a && hay) { var ahora = new Date().toISOString(); a.estado = 'cobrado'; a.fechaResolucion = ahora; a.fechaMod = ahora; a.reciboComplementario = sc.folio + l;
              (a.conceptos || []).forEach(function(c){ c.enRecibo = sc.folio + l; }); guardar(); refrescarTodo(); }
            window._lexScEnCurso = null;
          } }
      }
      var ad = window._lexAdelantoEnCurso;
      if (ad) {
        if (Date.now() - ad.desde > 3 * 3600000) window._lexAdelantoEnCurso = null;
        else { var r2v = ultimasVersiones()[ad.folio]; var l2 = r2v ? String(r2v.letra || 'A').toUpperCase() : '';
          if (r2v && l2 > ad.letraAntes && ad.liquidacion) {
            if ((parseFloat(r2v.saldoPendiente) || 0) <= 0.005) { var tot = r2(window._lexAdelantosDeFolio(ad.folio).reduce(function(s, a){ return s + totalAdelantoPend(a); }, 0)); if (tot > 0) aplicarAdelanto(ad.folio, tot, ad.folio + l2); }
            window._lexAdelantoEnCurso = null;
          } else if (r2v && l2 > ad.letraAntes) {
            var pagado = r2((r2v.pagosParciales || []).filter(function(p){ return String(p.concepto || '').indexOf(ad.prefijo) === 0 && (!p.folioLetra || String(p.folioLetra).toUpperCase() === l2); })
              .reduce(function(s, p){ return s + (parseFloat(String(p.cantidad).replace(/[^0-9.\-]/g, '')) || 0); }, 0));
            if (pagado > 0) aplicarAdelanto(ad.folio, pagado, ad.folio + l2);
            window._lexAdelantoEnCurso = null;
          } }
      }
    } catch(e){ console.warn('[Reembolsos] vigilante', e); }
  }
  setInterval(revisarRecibosNuevos, 2000);
  function aplicarAdelanto(folio, monto, recibo){
    var ahora = new Date().toISOString(), resto = r2(monto);
    window._lexAdelantosDeFolio(folio).forEach(function(a){
      adelantosPend(a).forEach(function(c){
        if (resto <= 0.005) return;
        var mc = r2(c.monto);
        if (resto + 0.005 >= mc) { c.cobrado = true; c.cobradoFecha = ahora; c.cobradoPor = usuario(); c.enRecibo = recibo; resto = r2(resto - mc); }
        else { a.conceptos.push({ id: 'C-' + Date.now() + '-p' + Math.random().toString(36).slice(2, 5), fecha: c.fecha, monto: resto, descripcion: c.descripcion + ' (pago parcial)', tipoGasto: 'adelanto', cobrado: true, cobradoFecha: ahora, cobradoPor: usuario(), enRecibo: recibo, parteDe: c.id });
          c.monto = r2(mc - resto); resto = 0; }
      });
      if (!adelantosPend(a).length && !pendientes(a).length) { a.estado = 'cobrado'; a.fechaResolucion = ahora; }
      a.fechaMod = ahora;
    });
    guardar(); refrescarTodo();
    if (typeof toast === 'function') toast('✅ Pago adelantado del despacho recuperado en el recibo ' + recibo);
  }

  // ── ✓ Ya nos pagó ───────────────────────────────────────────────────
  window.lexCobrarAdeudo = async function(id){
    var a = lista().filter(function(x){ return x && x.id === id; })[0]; if (!a) return;
    if (a.estado === 'pendiente-recibo') { window.lexGenerarComplementario(a.id); return; }
    if (adelantosPend(a).length && !pendientes(a).length) { window.lexReembolsarAdelanto(a.folioVinculado); return; }
    var pend = pendientes(a), total = totalPendiente(a);
    if (!pend.length || !(total > 0)) { if (typeof toast === 'function') toast('Este reembolso ya está pagado'); refrescarTodo(); return; }
    var dup = await yaCobradoPorOtro(a, pend);
    if (dup) { await preguntar('Este reembolso ya se cobró', dup + '\n\nNo se registró un segundo cobro.', 'Entendido', 'Cerrar'); refrescarTodo(); return; }
    var nombre = String(a.cliente || '').toUpperCase();
    var ov = ventana('✓ YA NOS PAGÓ · ' + nombre);
    var b = ov.querySelector('#lex-rb-body');
    b.innerHTML = '<div style="font-size:0.92rem;margin-bottom:12px;">' + E(nombre) + ' nos debe <b style="color:#791F1F;">' + $m(total) + '</b><div style="font-size:0.8rem;color:#5a4a2a;margin-top:2px;">' + pend.map(function(c){ return E(c.descripcion); }).join(' · ') + '</div></div>'
      + preg('¿Cuánto nos pagó?')
      + opcion('rb-todo', 'Todo — ' + $m(total), 'El reembolso queda pagado')
      + opcion('rb-parte', 'Solo una parte', 'Escribe cuánto dejó; lo demás sigue pendiente')
      + '<div id="rb-parte-box" style="display:none;"><input id="rb-parte-mon" type="number" step="0.01" min="0" style="' + INP + '" placeholder="¿Cuánto dejó? $"><button type="button" id="rb-parte-ok" style="background:#3B6D11;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:0.85rem;font-weight:700;cursor:pointer;">Continuar</button></div>'
      + errBox()
      + '<div style="font-size:0.76rem;color:#7a6440;margin-top:6px;">El dinero entra a la caja por Caja Rápida.</div>';
    var $ = function(s){ return ov.querySelector('#' + s); };
    function abrirCaja(monto){
      if (!hayCaja()) { $('lex-rb-err').textContent = 'No se pudo abrir Caja Rápida.'; return; }
      ov.remove();
      var parcial = monto < total - 0.005;
      window.lexCajaRapidaPrecargada({ tipo: 'ingreso',
        desc: 'Reembolso de ' + nombre + ' · ' + pend.map(function(c){ return c.descripcion; }).join(' | ') + (a.folioVinculado != null ? ' (folio ' + a.folioVinculado + ')' : '') + (parcial ? ' (abono)' : '') + ' — adeudo',
        monto: monto,
        aviso: '✓ Reembolso: ' + nombre + ' nos paga ' + $m(monto) + (parcial ? ' de ' + $m(total) : '') + '. Revisa y presiona Registrar.',
        extra: { adeudoId: a.id, adeudoConceptoIds: pend.map(function(c){ return c.id; }), honorariosGestion: parcial ? 0 : r2(pend.reduce(function(t, c){ return t + (parseFloat(c.honorariosGestion) || 0); }, 0)) },
        onRegistrado: function(mov, resp){ aplicarPago(a.id, monto, mov, resp); } });
    }
    $('rb-todo').onclick = function(){ abrirCaja(total); };
    $('rb-parte').onclick = function(){ $('rb-parte-box').style.display = 'block'; setTimeout(function(){ $('rb-parte-mon').focus(); }, 20); };
    $('rb-parte-ok').onclick = function(){
      var m = r2($('rb-parte-mon').value);
      if (!(m > 0)) { $('lex-rb-err').textContent = 'Escribe cuánto dejó.'; return; }
      if (m > total + 0.005) { $('lex-rb-err').textContent = 'No puede ser más de lo que debe (' + $m(total) + ').'; return; }
      abrirCaja(m);
    };
  };
  // Marca como pagado lo que alcance el monto; si un concepto queda a medias se parte en dos.
  function aplicarPago(id, monto, mov, resp){
    var a = lista().filter(function(x){ return x && x.id === id; })[0]; if (!a) return;
    var ahora = new Date().toISOString(), resto = r2(monto), cobrados = [];
    pendientes(a).forEach(function(c){
      if (resto <= 0.005) return;
      var mc = r2(c.monto);
      if (resto + 0.005 >= mc) { c.cobrado = true; c.cobradoFecha = ahora; c.cobradoPor = resp || usuario(); c.movIngresoId = mov.id; resto = r2(resto - mc); cobrados.push(c.id); }
      else {
        var pagado = { id: 'C-' + Date.now() + '-p' + Math.random().toString(36).slice(2, 5), fecha: c.fecha, monto: resto, descripcion: c.descripcion + ' (abono)', tipoGasto: c.tipoGasto || 'reembolso',
          cobrado: true, cobradoFecha: ahora, cobradoPor: resp || usuario(), movIngresoId: mov.id, parteDe: c.id };
        c.monto = r2(mc - resto); a.conceptos.push(pagado); cobrados.push(pagado.id); resto = 0;
      }
    });
    actualizarMov(mov, { adeudoConceptoIds: cobrados });
    if (!pendientes(a).length) { a.estado = 'cobrado'; a.fechaResolucion = ahora; a.cobradoPor = resp || usuario(); }
    a.fechaMod = ahora;
    guardar(); refrescarTodo();
    try { if (a.folioVinculado != null && typeof window.lexRepintarFichaFolio === 'function') window.lexRepintarFichaFolio(a.folioVinculado); } catch(_){}
    if (typeof toast === 'function') toast(a.estado === 'cobrado' ? '✅ Reembolso pagado completo' : '✅ Abono registrado — aún debe ' + $m(totalPendiente(a)));
  }

  // ── ✏️ Corregir reembolso (Nov-2026 · mismo estilo de preguntas) ──────
  window.lexCorregirReembolso = function(id){
    var a = lista().filter(function(x){ return x && x.id === id; })[0]; if (!a) return;
    var cs = (a.conceptos || []).filter(function(c){ return !c.parteDe; });
    var conFolio = a.folioVinculado != null && a.folioVinculado !== '';
    var tipoActual = (cs[0] && cs[0].tipoGasto) || 'reembolso';
    var MAP = { adelanto: 'adelanto', reembolso: 'tercero', complementario: 'complementario', incluido: 'incluido' };
    var S = { modo: MAP[tipoActual] || 'tercero' };
    var yaCobrado = (a.conceptos || []).some(function(c){ return c.cobrado; }) || a.estado === 'cobrado';
    var scHecho = tipoActual === 'complementario' && a.estado === 'cobrado';
    var info = conFolio ? infoFolio(ultimasVersiones()[String(a.folioVinculado)]) : null;
    var ov = ventana('✏️ CORREGIR REEMBOLSO' + (conFolio ? ' · FOLIO ' + a.folioVinculado : ''));
    var b = ov.querySelector('#lex-rb-body');
    var $ = function(s){ return ov.querySelector('#' + s); };
    var MODOS = [
      { v: 'adelanto', t: '⏩ El pago lo hizo el despacho para avanzar el trámite', s: 'Dentro de lo pactado · se descuenta de su saldo cuando lo pague' },
      { v: 'tercero', t: '💵 Gasto fuera de lo pactado que el cliente nos debe reembolsar', s: 'Traslados, viáticos, honorarios de diligencias, pagos a terceros, requisitos, copias, derechos… · se cobra por Caja Rápida, sin recibo' },
      { v: 'complementario', t: '➕ Servicio complementario', s: 'Fuera de lo pactado · se genera su recibo de servicio complementario' } ];
    if (tipoActual === 'incluido') MODOS.push({ v: 'incluido', t: '✓ Incluido en lo pactado (no se cobra)', s: 'Registro anterior: el despacho lo absorbió' });
    function resumen(){
      var tot = r2(cs.reduce(function(s, c){ return s + (parseFloat(c.monto) || 0); }, 0));
      var caja = r2(cs.reduce(function(s, c){ return s + (parseFloat(c.montoCaja) || 0); }, 0));
      var gest = r2(cs.reduce(function(s, c){ return s + (parseFloat(c.honorariosGestion) || 0); }, 0));
      var mov = cs.map(function(c){ return c.movEgresoId ? (D.movimientos || []).filter(function(m){ return m && m.id === c.movEgresoId; })[0] : null; }).filter(Boolean)[0];
      var estado = a.estado === 'cobrado' ? '<span style="color:#27500A;">✓ Ya pagado</span>' : a.estado === 'pendiente-recibo' ? '<span style="color:#a32d2d;">Falta generar su recibo de servicio complementario</span>'
        : (yaCobrado ? '<span style="color:#854F0B;">Pagado en parte · debe ' + $m(totalPendiente(a) + totalAdelantoPend(a)) + '</span>' : '<span style="color:#a32d2d;">Pendiente de cobro</span>');
      return '<div style="background:#fff;border:1px solid #e3d3a8;border-radius:10px;padding:10px 12px;font-size:0.84rem;line-height:1.6;margin-bottom:6px;">'
        + '<b>' + E(a.cliente) + '</b>' + (conFolio ? ' · Folio ' + E(a.folioVinculado) + (info ? ' (saldo ' + $m(info.saldo) + ')' : '') : ' · sin folio') + '<br>'
        + 'Se le cobra <b style="color:#791F1F;">' + $m(tot) + '</b>'
        + (caja > 0 ? ' · Salió de caja <b>' + $m(caja) + '</b>' + (mov ? ' (' + E(mov.folioCaja || '') + ', ' + E(fC(mov.fecha)) + ')' : '') : (cs.some(function(c){ return c.origenDinero === 'lic' || c.origenDinero === 'otro'; }) ? ' · Lo puso el Lic. (no salió de caja)' : ''))
        + (gest > 0 ? ' · Gestión <b>' + $m(gest) + '</b>' : '') + '<br>' + estado + '</div>';
    }
    function pinta(){
      var h = resumen();
      cs.forEach(function(c, i){
        var bloqueado = !!c.cobrado;
        h += preg(cs.length > 1 ? 'Concepto ' + (i + 1) + ' · ¿Qué se pagó?' : '¿Qué se pagó?')
          + '<input id="cr-que-' + i + '" style="' + INP + '" value="' + E(c.descripcion || '') + '">'
          + preg('¿Cuánto se le va a cobrar al cliente?')
          + (bloqueado ? '<div style="' + INP + 'background:#f5efe0;color:#7a6440;">🔒 ' + $m(c.monto) + ' — ya está pagado, no se puede cambiar</div>'
                       : '<input id="cr-mon-' + i + '" type="number" step="0.01" min="0" style="' + INP + '" value="' + E(c.monto) + '">');
      });
      if (conFolio) {
        h += preg('Este reembolso o adeudo, ¿cómo lo registramos?');
        if (scHecho || yaCobrado) {
          var o0 = MODOS.filter(function(x){ return x.v === S.modo; })[0] || MODOS[1];
          h += '<div style="' + ELE + 'background:#f5efe0;border-color:#d4b870;"><div><b>' + o0.t + '</b><div style="font-size:0.76rem;color:#7a6440;">🔒 ' + (scHecho ? 'Ya se generó su recibo de servicio complementario' : 'Ya tiene pagos registrados') + '; no se puede cambiar</div></div></div>';
        } else h += bloqueSel(MODOS, S.modo);
      }
      h += preg('¿De dónde salió el dinero?');
      var cajaTxt = cs.filter(function(c){ return c.movEgresoId; }).map(function(c){ var m = (D.movimientos || []).filter(function(x){ return x && x.id === c.movEgresoId; })[0]; return $m(c.montoCaja || (m && m.monto) || 0) + (m ? ' (' + E(m.folioCaja || '') + ')' : ''); }).join(', ');
      h += '<div style="' + INP + 'background:#f5efe0;color:#7a6440;line-height:1.45;">🔒 ' + (cajaTxt ? 'Ya registrado: salida de caja ' + cajaTxt + '. Si está mal, se corrige en Caja.' : 'Lo puso el Lic. o salió de otro lado: no se tocó la caja.') + '</div>'
        + errBox()
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap;">'
        + '<button type="button" id="cr-quitar" style="background:#fff;border:1.5px solid #e0a0a0;color:#a32d2d;border-radius:8px;padding:9px 14px;font-size:0.84rem;cursor:pointer;">🗑 Quitar reembolso</button>'
        + '<span><button type="button" id="cr-cancel" style="background:#fff;border:1.5px solid #c8952a;color:#8c6518;border-radius:8px;padding:9px 14px;font-size:0.84rem;cursor:pointer;margin-right:6px;">Cancelar</button>'
        + '<button type="button" id="cr-ok" style="background:#8c6518;color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:0.86rem;font-weight:700;cursor:pointer;">💾 Guardar cambios</button></span></div>';
      b.innerHTML = h;
      b.querySelectorAll('[data-modo]').forEach(function(x){ x.onclick = function(){ guardaCampos(); S.modo = x.getAttribute('data-modo'); pinta(); }; });
      b.querySelectorAll('[data-cambiar]').forEach(function(x){ x.onclick = function(){ guardaCampos(); S.modo = null; pinta(); }; });
      $('cr-cancel').onclick = function(){ ov.remove(); };
      $('cr-ok').onclick = guardarCambios;
      $('cr-quitar').onclick = quitar;
    }
    var tmp = {};
    function guardaCampos(){ cs.forEach(function(c, i){ var q = $('cr-que-' + i), m = $('cr-mon-' + i); if (q) tmp['q' + i] = q.value; if (m) tmp['m' + i] = m.value; }); }
    function bloqueSel(lst, sel){
      if (sel) { var o = lst.filter(function(x){ return x.v === sel; })[0];
        return '<div style="' + ELE + '"><div><b>' + o.t + '</b><div style="font-size:0.76rem;color:#27500A;margin-top:2px;">' + o.s + '</div></div><button type="button" data-cambiar="modo" style="background:none;border:1px solid #3B6D11;color:#27500A;border-radius:7px;padding:4px 10px;font-size:0.76rem;cursor:pointer;white-space:nowrap;">Cambiar</button></div>'; }
      return lst.map(function(o){ return '<button type="button" data-modo="' + o.v + '" style="' + OPC + '"><b>' + o.t + '</b><div style="font-size:0.76rem;color:#5a4a2a;margin-top:2px;">' + o.s + '</div></button>'; }).join('');
    }
    async function guardarCambios(){
      var e = $('lex-rb-err'); guardaCampos();
      if (conFolio && !S.modo) { e.textContent = 'Elige cómo lo registramos.'; return; }
      for (var i = 0; i < cs.length; i++) {
        var q = String(($('cr-que-' + i) || {}).value || '').trim(); if (!q) { e.textContent = 'Escribe qué se pagó.'; return; }
        var mi = $('cr-mon-' + i); if (mi) { var mv = r2(mi.value); if (!(mv > 0)) { e.textContent = 'Escribe cuánto se le cobrará.'; return; }
          if (cs[i].montoCaja && mv < r2(cs[i].montoCaja) - 0.005) { e.textContent = 'No puede ser menor a lo que salió de caja (' + $m(cs[i].montoCaja) + ').'; return; } }
      }
      var ahora = new Date().toISOString(), aSC = false;
      var nuevoTipo = !conFolio ? 'reembolso' : (S.modo === 'adelanto' ? 'adelanto' : S.modo === 'complementario' ? 'complementario' : S.modo === 'incluido' ? 'incluido' : 'reembolso');
      cs.forEach(function(c, i){
        c.descripcion = String($('cr-que-' + i).value || '').trim().toUpperCase();
        var mi = $('cr-mon-' + i); if (mi && !c.cobrado) { c.monto = r2(mi.value); if (c.montoCaja) { var g = r2(c.monto - c.montoCaja); if (g > 0.005) c.honorariosGestion = g; else delete c.honorariosGestion; } }
        if (!scHecho && !yaCobrado && c.tipoGasto !== nuevoTipo) { c.tipoGasto = nuevoTipo; if (nuevoTipo === 'complementario') aSC = true; }
      });
      if (!scHecho && !yaCobrado) {
        if (nuevoTipo === 'complementario') a.estado = 'pendiente-recibo';
        else if (nuevoTipo === 'incluido') { a.estado = 'cobrado'; a.fechaResolucion = ahora; }
        else if (a.estado === 'pendiente-recibo' || a.estado === 'cobrado') { a.estado = 'pendiente'; a.fechaResolucion = ''; }
      }
      a.fechaMod = ahora;
      ov.remove(); guardar(); refrescarTodo();
      if (typeof toast === 'function') toast('✓ Reembolso corregido');
      if (aSC) { var c0 = cs[0]; abrirServicioComplementario({ folio: a.folioVinculado, que: c0.descripcion, mon: c0.monto }, a); }
    }
    async function quitar(){
      if ((a.conceptos || []).some(function(c){ return c.cobrado && c.movIngresoId; }) || scHecho) { $('lex-rb-err').textContent = 'No se puede quitar: ya tiene pagos o recibo generado.'; return; }
      var conCaja = cs.filter(function(c){ return c.movEgresoId; });
      var msg = '¿Quitar el reembolso de ' + a.cliente + ' por ' + $m(cs.reduce(function(s, c){ return s + (parseFloat(c.monto) || 0); }, 0)) + '?'
        + (conCaja.length ? '\n\nOJO: la salida de caja ya registrada NO se borra. Si también fue un error, corrígela en Caja.' : '');
      if (!(await preguntar('Quitar reembolso', msg, 'Sí, quitar', 'Cancelar'))) return;
      a.eliminado = true; a.eliminadoPor = usuario(); a.fechaMod = new Date().toISOString();
      ov.remove(); guardar(); refrescarTodo();
      if (typeof toast === 'function') toast('🗑 Reembolso quitado');
    }
    pinta();
  };
  // Cualquier "Editar" de un registro existente abre la ventana nueva
  (function(){
    var orig = window.abrirEditarAdeudo;
    if (typeof orig === 'function' && !orig._lexRb) {
      var w2 = function(id){ var a = id ? lista().filter(function(x){ return x && x.id === id; })[0] : null; if (a && a.tipo !== 'anterior') return window.lexCorregirReembolso(id); return orig.apply(this, arguments); };
      w2._lexRb = true; window.abrirEditarAdeudo = w2;
    }
  })();

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
  // ── Tarjeta de adeudo pendiente (Nov-2026, opción A: se lee como frase) ──
  function haceDias(iso){
    try { var d = new Date(iso); if (isNaN(d)) return ''; var h = new Date(); h.setHours(0,0,0,0); var d0 = new Date(d); d0.setHours(0,0,0,0);
      var n = Math.round((h - d0) / 86400000); return n <= 0 ? 'hoy' : (n === 1 ? 'ayer' : 'hace ' + n + ' días'); } catch(_){ return ''; }
  }
  function fechaLarga(iso){ try { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('es-MX', { day:'numeric', month:'long' }); } catch(_){ return ''; } }
  function tarjetaPendiente(a){
    // Nov-2026: una línea por reembolso — cliente, qué, hace cuánto, de dónde salió, monto y "Ya nos pagó"
    var pendientesC = pendientes(a);
    var pendT = totalPendiente(a);
    var esAdel = !pendientesC.length && adelantosPend(a).length, esSC = a.estado === 'pendiente-recibo';
    if (esAdel || esSC) {
      var cs0 = esAdel ? adelantosPend(a) : (a.conceptos || []);
      var mon0 = esAdel ? totalAdelantoPend(a) : r2(cs0.reduce(function(t, c){ return t + (parseFloat(c.monto) || 0); }, 0));
      return '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#fdfaf4;border:1px solid #e3d3a8;border-radius:10px;padding:12px 16px;margin-bottom:8px;color:#2a1a06;">'
        + '<div style="flex:1;min-width:220px;"><div style="font-weight:700;font-size:0.95rem;">' + E(a.cliente || '') + ' <span style="font-size:0.72rem;background:#e6f1fb;color:#185fa5;border-radius:10px;padding:1px 8px;">Folio ' + E(a.folioVinculado) + '</span></div>'
        + '<div style="font-size:0.78rem;color:#7a6440;margin-top:2px;">' + cs0.map(function(c){ return E(c.descripcion); }).join(' · ') + ' · ' + E(haceDias(a.fechaCreacion)) + ' '
        + (esAdel ? '<span style="font-size:0.7rem;background:#E6F1FB;color:#0C447C;border-radius:10px;padding:1px 8px;">Dentro de lo pactado · se descuenta del saldo</span>' : '<span style="font-size:0.7rem;background:#FCEBEB;color:#791F1F;border-radius:10px;padding:1px 8px;">⚠ Falta generar su recibo de servicio complementario</span>') + '</div></div>'
        + '<div style="font-family:monospace;font-weight:700;font-size:1.05rem;color:#791F1F;min-width:100px;text-align:right;">' + $m(mon0) + '</div>'
        + (esAdel ? '<button type="button" onclick="lexReembolsarAdelanto(' + JSON.stringify(a.folioVinculado).replace(/"/g, '&quot;') + ')" style="background:#3B6D11;border:none;color:#fff;border-radius:8px;padding:8px 14px;font-size:0.84rem;font-weight:700;cursor:pointer;white-space:nowrap;">Reembolsar en su folio</button>'
                  : '<button type="button" onclick="lexGenerarComplementario(\'' + a.id + '\')" style="background:#8c6518;border:none;color:#fff;border-radius:8px;padding:8px 14px;font-size:0.84rem;font-weight:700;cursor:pointer;white-space:nowrap;">Generar recibo</button>')
        + '</div>';
    }
    var que = pendientesC.map(function(c){ return E(c.descripcion || '(sin descripción)'); }).join(' · ');
    var origen = (a.conceptos || []).some(function(c){ return c.movEgresoId; })
      ? '<span style="font-size:0.7rem;background:#FAEEDA;color:#633806;border-radius:10px;padding:1px 8px;white-space:nowrap;">Salió de caja</span>'
      : '<span style="font-size:0.7rem;background:#E6F1FB;color:#0C447C;border-radius:10px;padding:1px 8px;white-space:nowrap;">Salió de otro lado</span>';
    var abonado = r2(totalReembolso(a) - pendT);
    var extra = abonado > 0.005 ? ' · ya abonó ' + $m(abonado) : '';
    return '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#fdfaf4;border:1px solid #e3d3a8;border-radius:10px;padding:12px 16px;margin-bottom:8px;color:#2a1a06;">'
      + '<div style="flex:1;min-width:220px;"><div style="font-weight:700;font-size:0.95rem;">' + E(a.cliente || '(sin nombre)') + '</div>'
      + '<div style="font-size:0.78rem;color:#7a6440;margin-top:2px;">' + que + ' · ' + E(haceDias(a.fechaCreacion)) + extra + ' ' + origen + '</div></div>'
      + '<div style="font-family:monospace;font-weight:700;font-size:1.05rem;color:#791F1F;min-width:100px;text-align:right;">' + $m(pendT) + '</div>'
      + '<button type="button" onclick="lexCorregirReembolso(\'' + a.id + '\')" title="Corregir" style="background:#fff;border:1px solid #d4b870;color:#8c6518;border-radius:8px;padding:7px 10px;font-size:0.8rem;cursor:pointer;">✏️</button>'
      + '<button type="button" onclick="lexCobrarAdeudo(\'' + a.id + '\')" style="background:#3B6D11;border:none;color:#fff;border-radius:8px;padding:8px 14px;font-size:0.84rem;font-weight:700;cursor:pointer;white-space:nowrap;">✓ Ya nos pagó</button>'
      + '</div>';
  }
  try { if (typeof TITULOS !== 'undefined') TITULOS['adeudos-sin-recibo'] = '💳 Reembolsos al despacho'; } catch(_){}
  window.renderAdeudosLista = function(){
    var cont = document.getElementById('adeudosLista'); if (!cont) return;
    var q = N((document.getElementById('adeudosBuscar')||{}).value || '');
    var todos = activos();
    var verCob = (typeof _adeudosVerCobrados !== 'undefined') && _adeudosVerCobrados;
    var porCobrar = function(a){ return a.estado !== 'cobrado' && (totalPendiente(a) > 0.005 || totalAdelantoPend(a) > 0.005 || a.estado === 'pendiente-recibo'); };
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
      cont.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:0.82rem;">' + (q ? 'Ningún adeudo coincide con la búsqueda.' : (verCob ? 'No hay adeudos cobrados todavía.' : 'Nadie nos debe reembolsos. ✓')) + '</div>';
      return;
    }
    var totalLista = lst.reduce(function(s,a){ return s + (verCob ? totalReembolso(a) : (a.estado === 'pendiente-recibo' ? 0 : totalPendiente(a) + totalAdelantoPend(a))); }, 0);
    var resumen = '<div style="display:flex;justify-content:flex-end;align-items:baseline;gap:8px;margin:0 2px 10px;font-size:0.74rem;color:var(--muted);">'
      + (verCob ? 'Total ya pagado en esta lista:' : 'Total que nos deben:')
      + ' <strong style="font-family:monospace;font-size:0.95rem;color:' + ACOL + ';">' + $m(totalLista) + '</strong></div>';
    // Nov-2026 (opción A, a petición): explicación arriba para que se entienda la pantalla
    var ayuda = verCob ? '' : '<div style="color:#c9b17a;font-size:0.82rem;margin:0 2px 10px;">Dinero que el despacho puso por un cliente y que el cliente nos debe regresar.</div>';
    cont.innerHTML = ayuda + resumen + lst.map(function(a){
      var soloIncl = !reembolsables(a).length;
      var cobrado = !porCobrar(a);
      if (!cobrado) return tarjetaPendiente(a);
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
    var adelantos = [], scPend = [];
    ads.forEach(function(a){ (a.conceptos||[]).forEach(function(c){
      if (esAdelanto(c)) { if (!c.cobrado) adelantos.push({ a: a, c: c }); return; }
      if (esComplementario(c)) { if (a.estado === 'pendiente-recibo') scPend.push({ a: a, c: c }); return; }
      (esIncluido(c) ? incluidos : filas).push({ a: a, c: c }); }); });
    if (!filas.length && !incluidos.length && !sueltos.length && !adelantos.length && !scPend.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
    incluidos.sort(function(x,y){ return String(x.c.fecha||'').localeCompare(String(y.c.fecha||'')); });
    filas.sort(function(x,y){ return String(x.c.fecha||'').localeCompare(String(y.c.fecha||'')); });
    var pend = r2(ads.reduce(function(s,a){ return s + totalPendiente(a); }, 0));
    // Saldo de la versión MÁS RECIENTE del folio (la ficha puede recibir cualquier letra)
    var infoU = infoFolio(ultimasVersiones()[String(recibo.folio)] || recibo);
    var saldo = infoU ? infoU.saldo : (parseFloat(recibo.saldoPendiente) || 0);
    var conSaldo = !!(infoU && infoU.estado === 'saldo');
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
      + '<span style="font-size:0.6rem;font-family:\'DM Mono\',monospace;font-weight:700;color:#8a4a10;text-transform:uppercase;letter-spacing:0.1em;">💵 Reembolsos al despacho <span style="text-transform:none;letter-spacing:0;font-weight:400;color:#7a6840;">(fuera de lo pactado)</span></span>'
      + '<button type="button" onclick="lexNuevoGastoFolio(' + Number(recibo.folio) + ')" style="font-size:0.66rem;border:1px solid #c8781a;background:#fff;color:#c8781a;border-radius:5px;padding:3px 9px;cursor:pointer;">＋ Agregar reembolso</button></div>';
    if (adelantos.length) {
      var tAd = r2(adelantos.reduce(function(s, f){ return s + (parseFloat(f.c.monto) || 0); }, 0));
      html += '<div style="background:#FAEEDA;border:1px solid #f0d49a;border-radius:8px;padding:9px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">'
        + '<div><b style="color:#633806;font-size:0.8rem;">⏩ Pagos que adelantó el despacho (dentro de lo pactado)</b><div style="font-size:0.74rem;color:#633806;">' + adelantos.map(function(f){ return E(f.c.descripcion) + ' · ' + $m(f.c.monto) + ' · ' + E(fC(f.c.fecha)) + (f.c.origenDinero === 'caja' ? ' (de caja)' : ' (lo puso el Lic.)'); }).join('<br>') + '</div></div>'
        + '<button type="button" onclick="lexReembolsarAdelanto(' + Number(recibo.folio) + ')" style="font-size:0.74rem;border:none;background:#3B6D11;color:#fff;border-radius:6px;padding:6px 12px;cursor:pointer;font-weight:700;">Reembolsar ' + $m(tAd) + '</button></div>';
    }
    if (scPend.length) {
      html += scPend.map(function(f){ return '<div style="background:#FCEBEB;border:1px solid #f0b4b4;border-radius:8px;padding:8px 12px;margin-bottom:8px;font-size:0.76rem;color:#791F1F;display:flex;justify-content:space-between;align-items:center;gap:10px;">'
        + '<span>⚠ Falta generar el recibo de servicio complementario: <b>' + E(f.c.descripcion) + ' ' + $m(f.c.monto) + '</b></span>'
        + '<button type="button" onclick="lexGenerarComplementario(\'' + f.a.id + '\')" style="font-size:0.72rem;border:none;background:#8c6518;color:#fff;border-radius:6px;padding:5px 10px;cursor:pointer;">Generar recibo</button></div>'; }).join('');
    }
    if (filas.length) {
      html += '<div style="background:#fff;border:1px solid #ecd9b5;border-radius:6px;overflow:hidden;">' + filas.map(function(f){
        var cob = conceptoCobrado(f.a, f.c);
        return '<div style="display:grid;grid-template-columns:62px 1fr 150px 92px;gap:6px;padding:5px 10px;border-bottom:1px solid #f1e6cc;font-size:0.74rem;align-items:center;' + (cob ? 'color:#8a7a5a;' : '') + '">'
          + '<span>' + E(fC(f.c.fecha)) + '</span>'
          + '<span>' + (cob ? '<s>' : '') + E(f.c.descripcion) + (cob ? '</s>' : '') + (f.c.movEgresoId ? ' <span style="font-size:0.62rem;background:#fdf0dc;color:#8a4a10;border-radius:4px;padding:0 5px;">lo pagó el despacho' + (f.c.honorariosGestion ? ' · salió de caja ' + $m(f.c.montoCaja) + ' + ' + $m(f.c.honorariosGestion) + ' de gestión' : '') + '</span>' : '') + '</span>'
          + '<span style="font-size:0.66rem;color:' + (cob ? '#3b6d11' : '#a32d2d') + ';">' + (cob ? '✓ cobrado ' + E(fC(f.c.cobradoFecha)) : 'pendiente') + '</span>'
          + '<span style="text-align:right;font-family:monospace;">' + $m(f.c.monto) + '</span></div>';
      }).join('') + '</div>';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:0.74rem;">'
        + '<span>Reembolsos pendientes: <b style="font-family:monospace;color:#a32d2d;">' + $m(pend) + '</b>'
        + (pend > 0.005 && conSaldo ? ' &nbsp;·&nbsp; Total para liquidar (saldo ' + $m(saldo) + ' + reembolsos): <b style="font-family:monospace;">' + $m(r2(saldo + pend)) + '</b>' : '') + '</span>'
        + (pend > 0.005 ? '<button type="button" onclick="lexCobrarGastosFolio(' + Number(recibo.folio) + ')" style="font-size:0.7rem;border:none;background:#c8781a;color:#fff;border-radius:5px;padding:5px 11px;cursor:pointer;font-weight:700;">💰 Cobrar reembolso</button>' : '')
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
      html += '<div style="margin-top:8px;background:#fdf0dc;border:1px solid #e8c58a;border-radius:6px;padding:7px 10px;font-size:0.74rem;color:#6a3a08;">⚠ Este cliente también debe <b>' + $m(ts) + '</b> en reembolsos sin folio. '
        + '<button type="button" onclick="lexLigarAdeudosAFolio(' + Number(recibo.folio) + ')" style="font-size:0.68rem;border:1px solid #c8781a;background:#fff;color:#c8781a;border-radius:5px;padding:2px 8px;cursor:pointer;margin-left:4px;">Ligarlos a este folio</button></div>';
    }
    box.innerHTML = html;
    box.style.display = 'block';
  };
  window.lexNuevoGastoFolio = function(folio){
    var r = ultimasVersiones()[String(folio)];
    var nombre = r ? (r.nombre || ((r.clientes||[])[0]||{}).nombre || '') : '';
    // Nov-2026: mismas preguntas que "Nuevo reembolso", ya ligado al folio
    if (typeof window.lexNuevoReembolso === 'function') { window.lexNuevoReembolso({ cliente: String(nombre).trim(), folio: folio }); return; }
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
            if (g.total > 0.005) det.push('• ' + $m(g.total) + ' en reembolsos ligados a este folio (' + g.adeudos.map(function(a){ return pendientes(a).map(function(c){ return c.descripcion; }).join(', '); }).join(', ') + ')');
            if (tSueltos > 0.005) det.push('• ' + $m(tSueltos) + ' en reembolsos sin folio');
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
    d.innerHTML = '⚠ Este cliente debe <b>' + $m(info.total) + '</b> en reembolsos al despacho'
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
