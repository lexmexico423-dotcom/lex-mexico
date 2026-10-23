// ── Oct-2026 · SALDOS DE AÑOS ANTERIORES ─────────────────────────────────
// Clientes que contrataron ANTES del sistema (2024, 2025…) y todavía deben.
// No se crean recibos "sin anticipo" (confundían las revisiones automáticas)
// ni se mete nada hacia atrás en caja. En su lugar:
//  · Registro aparte (en D.adeudosSinRecibo con tipo:'anterior', que ya se
//    sincroniza y fusiona entre computadoras): cliente, trámite, año, FOLIO DE
//    PAPEL, costo pactado, historial de pagos anteriores y lo que DEBE hoy.
//  · Aparece en Cobranza (categoría "🗂 Años anteriores") con su seguimiento.
//  · Al PRIMER pago dentro del sistema se genera su folio real (135A) por lo
//    que debía y con el pago de hoy como anticipo (dinero real); los abonos
//    siguientes son el flujo normal (135B, 135C…). Los antecedentes de papel
//    se muestran en la Ficha del folio y en el concepto del recibo.
//  · También se puede cobrar en Caja sin recibo (ingreso, fuente 'caja').
(function(){
  'use strict';
  if (window._lexSaldosAnterioresV1) return;
  window._lexSaldosAnterioresV1 = true;

  var CATS = [['escrituras','📜 Escrituras'],['juicios','⚖️ Juicios'],['placas','🚗 Placas'],['registro','🏛️ Registro civil'],['contratos','📝 Contratos'],['otros','📁 Otros']];
  var MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function E(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function N(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
  function r2(n){ return Math.round((parseFloat(String(n == null ? '' : n).replace(/[^0-9.\-]/g, '')) || 0) * 100) / 100; }
  function $m(n){ return '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fL(iso){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? (+m[3]) + '-' + MES[+m[2] - 1] + '-' + m[1] : String(iso || ''); }
  function hoyISO(){ try { if (typeof fechaCDMX_ISO === 'function') return fechaCDMX_ISO(); } catch(e){} var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function usuario(){ try { if (typeof empleadoActual !== 'undefined' && empleadoActual) return empleadoActual.nombre || empleadoActual.email || ''; } catch(e){} return ''; }
  function lista(){ try { if (!Array.isArray(D.adeudosSinRecibo)) D.adeudosSinRecibo = []; return D.adeudosSinRecibo; } catch(e){ return []; } }
  function todos(){ return lista().filter(function(a){ return a && a.tipo === 'anterior' && !a.eliminado; }); }
  function porId(id){ return todos().filter(function(a){ return a.id === id; })[0] || null; }
  function guardar(){
    try { if (typeof save === 'function') save(); } catch(e){}
    try { if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced().catch(function(){}); } catch(e){}
    refrescar();
  }
  function refrescar(){
    try { if (typeof window._cobranzaRefrescar === 'function') window._cobranzaRefrescar(); } catch(e){}
    try { if (typeof reciboEnConsulta !== 'undefined' && reciboEnConsulta) window.lexPintarAntecedentesFicha(reciboEnConsulta); } catch(e){}
    try { if (typeof window._lexRAPintar === 'function') window._lexRAPintar(); } catch(e){}
  }
  function preguntar(t, m, si, no){ return (typeof confirmarBonito === 'function') ? confirmarBonito({ titulo: t, mensaje: m, btnSi: si || 'Sí', btnNo: no || 'Cancelar' }) : Promise.resolve(confirm(m)); }
  function toastS(m, t){ try { if (typeof toast === 'function') toast(m, t); } catch(e){} }

  // ── Cuentas ──────────────────────────────────────────────────────────
  function suma(arr){ return r2((arr || []).reduce(function(s, p){ return s + (parseFloat(p && p.monto) || 0); }, 0)); }
  function pagadoAntes(sa){ return suma(sa.pagosAnteriores); }
  function pagadoSistema(sa){ return suma(sa.pagosSistema); }
  function debe(sa){
    var base = (sa.costo != null && sa.costo !== '') ? r2(sa.costo) - pagadoAntes(sa) : r2(sa.debeManual);
    return Math.max(0, r2(base - pagadoSistema(sa)));
  }
  function ultimaFecha(sa){
    var fs = [].concat(sa.pagosAnteriores || [], sa.pagosSistema || []).map(function(p){ return String(p && p.fecha || ''); }).filter(Boolean).sort();
    return fs.length ? fs[fs.length - 1] : (sa.anio ? String(sa.anio) + '-12-31' : String(sa.fechaCreacion || '').slice(0, 10));
  }
  function nuevaClave(folioPapel){
    var base = 'P' + (String(folioPapel || '').replace(/[^0-9A-Za-z]/g, '') || 'SN');
    var usadas = {}; todos().forEach(function(a){ if (a.clave) usadas[a.clave] = 1; });
    if (!usadas[base]) return base;
    for (var i = 2; i < 999; i++) if (!usadas[base + '-' + i]) return base + '-' + i;
    return base + '-' + Date.now();
  }
  function textoAntecedentes(sa, montoHoy){
    var partes = ['Saldo de trámite iniciado en ' + (sa.anio || 'años anteriores')];
    if (sa.folioPapel) partes.push('Folio de papel N° ' + sa.folioPapel);
    if (sa.costo != null && sa.costo !== '') partes.push('Costo pactado ' + $m(sa.costo));
    var ant = pagadoAntes(sa) + pagadoSistema(sa);
    if (ant > 0) partes.push('Pagado antes ' + $m(ant));
    if (montoHoy != null) partes.push('Abono de hoy ' + $m(montoHoy));
    return partes.join(' · ');
  }

  // ════════════════════════════════════════════════════════════════════
  // CAPTURA / EDICIÓN
  // ════════════════════════════════════════════════════════════════════
  function campo(id, label, val, extra){ return '<div style="min-width:0;"><div style="font-size:0.62rem;color:#7a5410;letter-spacing:0.06em;margin:8px 0 3px;font-family:monospace;">' + label + '</div><input id="' + id + '" value="' + E(val == null ? '' : val) + '" ' + (extra || '') + ' style="width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #d8c08a;border-radius:6px;background:#fff;font-size:0.8rem;"></div>'; }
  function filaPago(p){
    return '<div class="sa-pago" data-id="' + E(p.id || '') + '" style="display:grid;grid-template-columns:150px minmax(0,1fr) 130px 28px;gap:6px;margin-bottom:5px;">'
      + '<input type="date" class="sa-p-fecha" value="' + E(String(p.fecha || '').slice(0, 10)) + '" style="padding:6px;border:1px solid #d8c08a;border-radius:6px;font-size:0.78rem;">'
      + '<input class="sa-p-conc" value="' + E(p.concepto || '') + '" placeholder="Anticipo, abono…" style="padding:6px 8px;border:1px solid #d8c08a;border-radius:6px;font-size:0.78rem;">'
      + '<input class="sa-p-monto" type="number" step="0.01" min="0" value="' + E(p.monto != null ? p.monto : '') + '" placeholder="Monto" style="padding:6px 8px;border:1px solid #d8c08a;border-radius:6px;font-size:0.78rem;">'
      + '<button type="button" class="sa-p-x" title="Quitar" style="background:none;border:none;color:#a32d2d;cursor:pointer;font-size:1rem;">✕</button></div>';
  }
  window.lexNuevoSaldoAnterior = function(){ abrirForm(null); };
  window.lexAbrirSaldoAnterior = function(id){ var sa = porId(id); if (sa) abrirForm(sa); };
  function abrirForm(sa){
    var v = sa || { cliente: '', tel: '', concepto: '', categoria: 'escrituras', anio: String(new Date().getFullYear() - 1), folioPapel: '', costo: '', pagosAnteriores: [], debeManual: '', nota: '' };
    var viejo = document.getElementById('lex-sa-ov'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-sa-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Helvetica,Arial,sans-serif;';
    var convertido = sa && sa.estado === 'convertido';
    ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:820px;max-height:94vh;overflow-y:auto;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#2a1c08;">'
      + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-size:0.76rem;letter-spacing:0.1em;font-family:monospace;display:flex;justify-content:space-between;"><span>🗂 ' + (sa ? 'RECIBO ANTERIOR' : 'NUEVO RECIBO ANTERIOR') + '</span><span id="sa-x" style="cursor:pointer;">✕</span></div>'
      + '<div style="padding:12px 16px;">'
      + (convertido ? '<div style="background:#eaf3de;border:1px solid #9fc58a;color:#27500a;border-radius:6px;padding:7px 10px;font-size:0.76rem;margin-bottom:6px;">✓ Ya tiene folio en el sistema: <b>' + E(sa.folioConvertido) + 'A</b>. Los siguientes pagos se hacen desde ese folio (Pago parcial / Pago total).</div>' : '')
      + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;">' + campo('sa-cliente', 'CLIENTE *', v.cliente) + campo('sa-tel', 'TELÉFONO', v.tel) + '</div>'
      + '<div style="display:grid;grid-template-columns:2fr 1fr 0.7fr;gap:10px;">' + campo('sa-concepto', 'TRÁMITE / CONCEPTO *', v.concepto, 'placeholder="Escritura de compraventa, terreno en…"')
      + '<div><div style="font-size:0.62rem;color:#7a5410;letter-spacing:0.06em;margin:8px 0 3px;font-family:monospace;">CATEGORÍA</div><select id="sa-cat" style="width:100%;padding:7px;border:1px solid #d8c08a;border-radius:6px;font-size:0.8rem;">' + CATS.map(function(c){ return '<option value="' + c[0] + '"' + (v.categoria === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('') + '</select></div>'
      + campo('sa-anio', 'AÑO DEL TRÁMITE', v.anio, 'inputmode="numeric" maxlength="4"') + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">' + campo('sa-papel', 'FOLIO DE PAPEL (el que tiene el cliente)', v.folioPapel, 'placeholder="Ej. 0417"') + campo('sa-costo', 'COSTO PACTADO (opcional)', v.costo, 'type="number" step="0.01" min="0"') + campo('sa-debe', 'DEBE HOY *', sa ? debe(sa) : v.debeManual, 'type="number" step="0.01" min="0"') + '</div>'
      + '<div id="sa-debe-nota" style="font-size:0.68rem;color:#7a6a4a;margin-top:3px;"></div>'
      + '<div style="font-size:0.62rem;color:#7a5410;letter-spacing:0.06em;margin:12px 0 4px;font-family:monospace;">HISTORIAL DE PAGOS ANTERIORES (de antes del sistema — no entran a caja)</div>'
      + '<div id="sa-pagos">' + (v.pagosAnteriores || []).map(filaPago).join('') + '</div>'
      + '<button type="button" id="sa-add" style="background:none;border:1px dashed #c8951a;color:#9a6e18;border-radius:6px;padding:5px 12px;font-size:0.72rem;cursor:pointer;">＋ Agregar pago anterior</button>'
      + ((sa && (sa.pagosSistema || []).length) ? '<div style="font-size:0.62rem;color:#7a5410;letter-spacing:0.06em;margin:12px 0 4px;font-family:monospace;">PAGOS YA EN EL SISTEMA</div>' + sa.pagosSistema.map(function(p){ return '<div style="font-size:0.76rem;padding:3px 0;">' + E(fL(p.fecha)) + ' · ' + E(p.concepto || 'Abono') + ' · <b>' + $m(p.monto) + '</b> <span style="font-size:0.66rem;background:#e6f1fb;color:#185fa5;border-radius:8px;padding:0 6px;">' + E(p.comprobante || 'Caja') + '</span></div>'; }).join('') : '')
      + campo('sa-nota', 'NOTA', v.nota, 'placeholder="Agrega una nota para uso interno, no se imprime"')
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:8px 10px;background:#fff;border:1px solid #e3d3a8;border-radius:8px;font-size:0.8rem;"><span id="sa-resumen"></span></div>'
      + '<div id="sa-err" style="color:#a32d2d;font-size:0.74rem;min-height:1em;margin-top:6px;"></div>'
      + '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px;">'
      + (sa ? '<button type="button" id="sa-del" style="background:#fff;border:1px solid #c04040;color:#a32d2d;border-radius:6px;padding:7px 12px;font-size:0.72rem;cursor:pointer;">🗑 Eliminar</button>' : '<span></span>')
      + '<div style="display:flex;gap:8px;">'
      + '<button type="button" id="sa-cancel" style="background:#fff;border:1px solid #c8951a;color:#9a6e18;border-radius:6px;padding:7px 14px;font-size:0.74rem;cursor:pointer;">Cancelar</button>'
      + (sa && !convertido && debe(sa) > 0.005 ? '<button type="button" id="sa-cobrar" style="background:#c8781a;border:none;color:#fff;border-radius:6px;padding:7px 14px;font-size:0.74rem;font-weight:700;cursor:pointer;">💰 Cobrar</button>' : '')
      + '<button type="button" id="sa-ok" style="background:#9a6e18;border:none;color:#fff;border-radius:6px;padding:7px 16px;font-size:0.74rem;font-weight:700;cursor:pointer;">💾 GUARDAR</button>'
      + '</div></div></div></div>';
    document.body.appendChild(ov);
    var q = function(s){ return ov.querySelector(s); };
    function leerPagos(){
      var out = [];
      ov.querySelectorAll('.sa-pago').forEach(function(row){
        var f = row.querySelector('.sa-p-fecha').value, c = row.querySelector('.sa-p-conc').value.trim(), m = r2(row.querySelector('.sa-p-monto').value);
        if (!f && !c && !m) return;
        out.push({ id: row.getAttribute('data-id') || ('PA-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)), fecha: f, concepto: c || 'Abono', monto: m });
      });
      return out;
    }
    function recalcular(){
      var costo = q('#sa-costo').value.trim(), pag = suma(leerPagos()), sis = sa ? pagadoSistema(sa) : 0, inDebe = q('#sa-debe');
      if (costo !== '') {
        var d = Math.max(0, r2(r2(costo) - pag - sis));
        inDebe.value = d; inDebe.readOnly = true; inDebe.style.background = '#f5f0e4';
        q('#sa-debe-nota').textContent = 'Se calcula solo: costo pactado − pagos anteriores' + (sis ? ' − pagos en el sistema' : '') + '.';
      } else { inDebe.readOnly = false; inDebe.style.background = '#fff'; q('#sa-debe-nota').textContent = 'Sin costo pactado: escribe cuánto debe hoy.'; }
      q('#sa-resumen').innerHTML = (costo !== '' ? 'Costo ' + $m(costo) + ' · ' : '') + 'Pagado antes ' + $m(pag) + (sis ? ' · En el sistema ' + $m(sis) : '') + ' · <b style="color:#a32d2d;">Debe ' + $m(r2(inDebe.value)) + '</b>';
    }
    function enlazar(){
      ov.querySelectorAll('.sa-p-x').forEach(function(b){ b.onclick = function(){ b.parentNode.remove(); recalcular(); }; });
      ov.querySelectorAll('.sa-pago input').forEach(function(i){ i.oninput = recalcular; });
    }
    q('#sa-add').onclick = function(){ var t = document.createElement('div'); t.innerHTML = filaPago({ fecha: '', concepto: '', monto: '' }); q('#sa-pagos').appendChild(t.firstChild); enlazar(); };
    q('#sa-costo').oninput = recalcular; q('#sa-debe').oninput = recalcular;
    enlazar(); recalcular();
    function cerrarOv(){ ov.remove(); }
    q('#sa-x').onclick = cerrarOv; q('#sa-cancel').onclick = cerrarOv;
    function leerYValidar(){
      var err = q('#sa-err'); err.textContent = '';
      var cliente = q('#sa-cliente').value.trim(), concepto = q('#sa-concepto').value.trim();
      if (!cliente) { err.textContent = 'Escribe el nombre del cliente.'; return null; }
      if (!concepto) { err.textContent = 'Escribe el trámite o concepto.'; return null; }
      var pagos = leerPagos();
      if (pagos.some(function(p){ return !(p.monto > 0); })) { err.textContent = 'Cada pago anterior debe tener monto mayor a $0.'; return null; }
      var costo = q('#sa-costo').value.trim();
      var d = r2(q('#sa-debe').value);
      if (costo === '' && !(d > 0) && !(sa && sa.estado === 'convertido')) { err.textContent = 'Escribe cuánto debe hoy (o el costo pactado).'; return null; }
      if (costo !== '' && r2(costo) - suma(pagos) < -0.005) { err.textContent = 'Los pagos anteriores suman más que el costo pactado.'; return null; }
      return { cliente: cliente, tel: q('#sa-tel').value.trim(), concepto: concepto, categoria: q('#sa-cat').value, anio: q('#sa-anio').value.trim(),
        folioPapel: q('#sa-papel').value.trim(), costo: costo === '' ? null : r2(costo), debeManual: costo === '' ? d + (sa ? pagadoSistema(sa) : 0) : null,
        pagosAnteriores: pagos, nota: q('#sa-nota').value.trim() };
    }
    q('#sa-ok').onclick = function(){
      var v2 = leerYValidar(); if (!v2) return;
      var ahora = new Date().toISOString();
      var idGuardado;
      if (sa) { Object.assign(sa, v2); sa.fechaMod = ahora; if (!sa.clave) sa.clave = nuevaClave(sa.folioPapel); idGuardado = sa.id; }
      else {
        idGuardado = 'SA-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        lista().unshift(Object.assign({ id: idGuardado, tipo: 'anterior', estado: 'pendiente',
          clave: nuevaClave(v2.folioPapel), pagosSistema: [], creadoPor: usuario(), fechaCreacion: ahora, fechaMod: ahora }, v2));
      }
      cerrarOv(); guardar(); toastS('✅ Recibo anterior guardado');
      // Oct-2026: al guardar se abre su Ficha del saldo
      setTimeout(function(){ try { window.lexFichaSaldoAnterior(idGuardado); } catch(e){} }, 50);
    };
    if (q('#sa-cobrar')) q('#sa-cobrar').onclick = function(){ var v2 = leerYValidar(); if (!v2) return; Object.assign(sa, v2); sa.fechaMod = new Date().toISOString(); guardar(); cerrarOv(); window.lexCobrarSaldoAnterior(sa.id); };
    if (q('#sa-del')) q('#sa-del').onclick = async function(){
      var ok = await preguntar('Eliminar saldo', '¿Eliminar el saldo de años anteriores de ' + String(sa.cliente).toUpperCase() + '?' + ((sa.pagosSistema || []).length ? '\n\nLos cobros que ya entraron a Caja NO se borran de Caja.' : ''), 'Sí, eliminar', 'Cancelar');
      if (!ok) return;
      sa.eliminado = true; sa.eliminadoPor = usuario(); sa.fechaMod = new Date().toISOString();
      cerrarOv(); guardar(); toastS('🗑 Saldo eliminado');
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // COBRAR (primer pago → folio real, o Caja sin recibo)
  // ════════════════════════════════════════════════════════════════════
  window.lexCobrarSaldoAnterior = function(id){
    var sa = porId(id); if (!sa) return;
    if (sa.estado === 'convertido') { toastS('Este saldo ya tiene folio ' + sa.folioConvertido + ': cóbralo desde ese folio'); return; }
    var d = debe(sa);
    if (!(d > 0.005)) { toastS('Este saldo ya está pagado'); return; }
    var viejo = document.getElementById('lex-sa-cob'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-sa-cob';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Helvetica,Arial,sans-serif;';
    ov.innerHTML = '<div style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:540px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#2a1c08;">'
      + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-size:0.74rem;letter-spacing:0.1em;font-family:monospace;display:flex;justify-content:space-between;"><span>💰 COBRAR RECIBO ANTERIOR · ' + E(String(sa.cliente).toUpperCase()) + '</span><span id="sac-x" style="cursor:pointer;">✕</span></div>'
      + '<div style="padding:12px 16px;font-size:0.8rem;">'
      + '<div style="color:#5a4a2a;font-size:0.74rem;">' + E(sa.concepto) + (sa.folioPapel ? ' · 📄 papel ' + E(sa.folioPapel) : '') + (sa.anio ? ' · ' + E(sa.anio) : '') + '</div>'
      + '<div style="margin-top:8px;">Debe: <b style="color:#a32d2d;">' + $m(d) + '</b> · ¿Cuánto paga hoy? <input id="sac-monto" type="number" step="0.01" min="0" max="' + d + '" value="' + d + '" style="width:130px;padding:6px 8px;border:1px solid #c8951a;border-radius:6px;font-size:0.82rem;"></div>'
      + '<div id="sac-err" style="color:#a32d2d;font-size:0.74rem;min-height:1em;margin-top:6px;"></div>'
      + '<button type="button" id="sac-recibo" style="display:block;width:100%;text-align:left;border:2px solid #9a6e18;background:#fff8e6;border-radius:8px;padding:9px 12px;cursor:pointer;color:#2a1c08;font-size:0.8rem;"><b>🧾 Hacer recibo normal por lo que paga</b> <span style="background:#9a6e18;color:#fff;font-size:0.62rem;padding:1px 7px;border-radius:9px;">recomendado</span><div style="font-size:0.72rem;color:#5a4a2a;margin-top:2px;">Abre Generar Recibo ya llenado: total = lo que debe, anticipo = lo que paga hoy. Al imprimir queda su folio (A) y los siguientes abonos serán B, C…</div></button>'
      + '<button type="button" id="sac-caja" style="display:block;width:100%;text-align:left;margin-top:6px;border:1px solid #d8c08a;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;color:#2a1c08;font-size:0.8rem;"><b>⚡ Cobro en Caja sin recibo</b><div style="font-size:0.72rem;color:#5a4a2a;margin-top:2px;">Entra como ingreso de Caja (igual que Caja Rápida) y baja lo que debe.</div></button>'
      + '</div></div>';
    document.body.appendChild(ov);
    var q = function(s){ return ov.querySelector(s); };
    q('#sac-x').onclick = function(){ ov.remove(); };
    function monto(){
      var m = r2(q('#sac-monto').value), err = q('#sac-err'); err.textContent = '';
      if (!(m > 0)) { err.textContent = 'Escribe cuánto paga hoy.'; return null; }
      if (m > d + 0.005) { err.textContent = 'No puede pagar más de lo que debe (' + $m(d) + ').'; return null; }
      return m;
    }
    q('#sac-recibo').onclick = function(){ var m = monto(); if (m == null) return; ov.remove(); prellenarRecibo(sa, d, m); };
    q('#sac-caja').onclick = async function(){
      var m = monto(); if (m == null) return;
      try { if (typeof cajaBloqueada === 'function' && cajaBloqueada()) { q('#sac-err').textContent = 'La caja de hoy ya está cerrada.'; return; } } catch(e){}
      ov.style.display = 'none';
      var resp = await new Promise(function(res){ try { if (typeof elegirResponsable === 'function') { elegirResponsable(function(r){ res(r); }); return; } } catch(e){} res(usuario()); });
      if (!resp) { ov.style.display = 'flex'; return; }
      var mov = { id: 'M-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), folioCaja: (typeof generarFolioMovCaja === 'function' ? generarFolioMovCaja() : ''),
        fecha: (typeof hoy === 'function' ? hoy() : hoyISO()), hora: (typeof hora === 'function' ? hora() : ''),
        descripcion: 'Abono a recibo anterior · ' + String(sa.cliente).toUpperCase() + ' · ' + sa.concepto + (sa.folioPapel ? ' (folio de papel ' + sa.folioPapel + ')' : ''),
        monto: m, tipo: 'ingreso', cat: 'otro', fuente: 'caja', responsable: resp, saldoAnteriorId: sa.id };
      var ok = false;
      try { ok = (typeof _registrarMovimiento === 'function') ? _registrarMovimiento(mov) !== false : (D.movimientos.push(mov), true); } catch(e){ ok = false; }
      if (!ok) { ov.style.display = 'flex'; q('#sac-err').textContent = 'No se registró el cobro en caja.'; return; }
      if (!Array.isArray(sa.pagosSistema)) sa.pagosSistema = [];
      sa.pagosSistema.push({ id: mov.id, fecha: mov.fecha, concepto: 'Abono en Caja', monto: m, movId: mov.id, comprobante: 'Caja', por: resp });
      if (debe(sa) <= 0.005) sa.estado = 'liquidado';
      sa.fechaMod = new Date().toISOString();
      try { if (typeof renderCaja === 'function') renderCaja(); } catch(e){}
      ov.remove(); guardar();
      toastS('▲ Abono registrado en Caja — ' + $m(m) + (debe(sa) > 0.005 ? ' · debe ' + $m(debe(sa)) : ' · saldo liquidado'));
    };
  }
  // Lleva al formulario de Generar Recibo, ya llenado (mismo método que "Convertir Pre-Recibo")
  function prellenarRecibo(sa, totalDebe, montoHoy){
    window._lexSAParaRecibo = { id: sa.id, total: totalDebe, monto: montoHoy, ts: Date.now() };
    if (typeof ir === 'function') ir('nuevo-recibo');
    setTimeout(function(){
      try {
        window._lexSAParaRecibo = { id: sa.id, total: totalDebe, monto: montoHoy, ts: Date.now() };
        var elN = document.querySelector('#clientes-wrapper .cliente-row [id^="nombre_"]');
        if (elN) { elN.value = String(sa.cliente).toUpperCase(); elN.dispatchEvent(new Event('input')); }
        var elM = document.querySelector('#clientes-wrapper .cliente-row [id^="movil_"]');
        if (elM && sa.tel) { elM.value = sa.tel; elM.dispatchEvent(new Event('input')); }
        var tb = document.getElementById('conceptos-tbody');
        if (tb) {
          tb.innerHTML = '';
          try { if (typeof conceptoCount !== 'undefined') conceptoCount = 0; } catch(e){}
          if (typeof agregarConcepto === 'function') agregarConcepto();
          var tr = tb.lastElementChild;
          if (tr) {
            var taC = tr.querySelector('textarea.concepto'); if (taC) taC.value = String(sa.concepto).toUpperCase();
            var taD = tr.querySelector('textarea.descripcion'); if (taD) taD.value = textoAntecedentes(sa, null);
            var inP = tr.querySelector('input.precio'); if (inP) { inP.value = String(totalDebe); try { if (typeof formatPrecio === 'function') formatPrecio(inP); } catch(e){} }
          }
          try { if (typeof calcTotales === 'function') calcTotales(); } catch(e){}
        }
        var elA = document.getElementById('anticipo');
        if (elA) { elA.value = String(montoHoy); try { elA.dispatchEvent(new Event('input')); } catch(e){} try { if (typeof calcTotales === 'function') calcTotales(); } catch(e){} }
        toastS('✓ Recibo pre-llenado con el recibo anterior — revisa y pulsa Imprimir', 'ok');
      } catch(e){ console.warn('[SaldosAnteriores] pre-llenado:', e); }
    }, 700);
  }

  // ── Ligar el saldo con el recibo que se acaba de generar ─────────────
  // Se busca el folio (letra A) del mismo cliente cuyo concepto trae el texto
  // "Saldo de trámite iniciado en …" y que no esté ligado a otro saldo.
  window.lexVincularSaldosAnteriores = function(){
    var recs = []; try { recs = (typeof appData !== 'undefined' && appData && Array.isArray(appData.recibos)) ? appData.recibos : []; } catch(e){}
    var ligados = {}; todos().forEach(function(a){ if (a.folioConvertido != null) ligados[String(a.folioConvertido)] = 1; });
    var cambio = false;
    todos().filter(function(a){ return a.estado !== 'convertido'; }).forEach(function(sa){
      var cand = recs.filter(function(r){
        if (!r || r.cancelado || r.esComplemento || String(r.letra || 'A').toUpperCase() !== 'A' || ligados[String(r.folio)]) return false;
        var nombres = [r.nombre].concat((r.clientes || []).map(function(c){ return c && c.nombre; }));
        if (!nombres.some(function(x){ return N(x) === N(sa.cliente); })) return false;
        var txt = N((r.conceptos || []).map(function(c){ return (c && (c.concepto || '')) + ' ' + (c && (c.descripcion || '')); }).join(' '));
        if (txt.indexOf('SALDO DE TRAMITE INICIADO EN') < 0) return false;
        if (sa.folioPapel && txt.indexOf(N(sa.folioPapel)) < 0) return false;
        return true;
      }).sort(function(a, b){ return (b.folio || 0) - (a.folio || 0); })[0];
      if (!cand) return;
      var p = window._lexSAParaRecibo && window._lexSAParaRecibo.id === sa.id ? window._lexSAParaRecibo : null;
      var montoA = parseFloat(String(cand.anticipo || '0').replace(/[^0-9.]/g, '')) || (p ? p.monto : 0);
      sa.estado = 'convertido'; sa.folioConvertido = cand.folio; sa.fechaConversion = new Date().toISOString();
      if (!Array.isArray(sa.pagosSistema)) sa.pagosSistema = [];
      if (montoA > 0) sa.pagosSistema.push({ id: 'REC-' + cand.folio + 'A', fecha: String(cand.fecha_recibo || hoyISO()).slice(0, 10), concepto: 'Primer pago en el sistema', monto: montoA, comprobante: 'Folio ' + cand.folio + 'A' });
      sa.fechaMod = new Date().toISOString();
      ligados[String(cand.folio)] = 1; cambio = true;
      if (p) window._lexSAParaRecibo = null;
    });
    if (cambio) guardar();
    return cambio;
  };
  // Después de generar un recibo, intentar ligar
  (function engancharGuardar(){
    var orig = window.guardarRecibo;
    if (typeof orig !== 'function' || orig._lexSA) return;
    var env = async function(){
      var r = await orig.apply(this, arguments);
      try { setTimeout(window.lexVincularSaldosAnteriores, 1500); setTimeout(window.lexVincularSaldosAnteriores, 6000); } catch(e){}
      return r;
    };
    env._lexSA = true;
    window.guardarRecibo = env;
  })();

  // ════════════════════════════════════════════════════════════════════
  // COBRANZA y FICHA
  // ════════════════════════════════════════════════════════════════════
  // Partidas para el panel de Cobranza (solo las que aún no tienen folio)
  window.lexSaldosAnterioresCobranza = function(){
    // ligar (si ya se generó su recibo) fuera del repintado, para no repintar en cadena
    setTimeout(function(){ try { window.lexVincularSaldosAnteriores(); } catch(e){} }, 0);
    return todos().filter(function(sa){ return sa.estado !== 'convertido' && debe(sa) > 0.005; }).map(function(sa){
      if (!sa.clave) sa.clave = nuevaClave(sa.folioPapel);
      return { folio: sa.clave, letra: '', esAnterior: true, saId: sa.id, anio: sa.anio || '', folioPapel: sa.folioPapel || '',
        nombre: String(sa.cliente || '').trim(), tel: String(sa.tel || '').trim(),
        personas: [{ nombre: String(sa.cliente || '').trim(), tel: String(sa.tel || '').trim() }],
        concepto: String(sa.concepto || 'su trámite'), saldo: debe(sa), fecha: ultimaFecha(sa), categoria: sa.categoria || 'otros' };
    });
  };
  // Antecedentes de un folio ya convertido (para Ficha y Cobranza)
  window.lexAntecedentesDeFolio = function(folio){
    return todos().filter(function(a){ return a.folioConvertido != null && String(a.folioConvertido) === String(folio); })[0] || null;
  };
  // Clave de Cobranza (P0417) → saldo actual, también si ya se convirtió en folio
  window.lexSaldoAnteriorPorClave = function(clave){
    var sa = todos().filter(function(a){ return a.clave === clave; })[0];
    if (!sa) return null;
    return { sa: sa, debe: debe(sa), folioConvertido: sa.estado === 'convertido' ? sa.folioConvertido : null };
  };
  window.lexPintarAntecedentesFicha = function(recibo){
    var box = document.getElementById('ficha-antecedentes'); if (!box) return;
    var sa = recibo && recibo.folio != null ? window.lexAntecedentesDeFolio(recibo.folio) : null;
    if (!sa) { box.innerHTML = ''; box.style.display = 'none'; return; }
    var pa = sa.pagosAnteriores || [];
    box.innerHTML = '<div style="background:#f1efe8;border:1px solid #d3d1c7;border-radius:8px;padding:8px 12px;font-size:0.76rem;color:#444441;">'
      + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><span><b>📄 ANTECEDENTES (antes del sistema)</b>' + (sa.folioPapel ? ' · Folio de papel <b>N° ' + E(sa.folioPapel) + '</b>' : '') + (sa.anio ? ' · ' + E(sa.anio) : '') + (sa.costo != null && sa.costo !== '' ? ' · Costo pactado ' + $m(sa.costo) : '') + '</span>'
      + '<button type="button" onclick="lexAbrirSaldoAnterior(\'' + E(sa.id) + '\')" style="font-size:0.66rem;border:1px solid #b4b2a9;background:#fff;color:#444441;border-radius:5px;padding:2px 8px;cursor:pointer;">Ver / editar</button></div>'
      + (pa.length ? '<div style="margin-top:4px;font-size:0.72rem;">' + pa.map(function(p){ return E(fL(p.fecha)) + ' ' + E(p.concepto || 'Abono') + ' ' + $m(p.monto); }).join(' · ') + ' → <b>Pagado antes: ' + $m(pagadoAntes(sa)) + '</b></div>' : '')
      + (sa.nota ? '<div style="margin-top:3px;font-size:0.7rem;font-style:italic;">' + E(sa.nota) + '</div>' : '')
      + '<div style="font-size:0.66rem;color:#7a7a72;margin-top:3px;">Solo informativo: ese dinero se recibió en su momento y no entra a caja.</div></div>';
    box.style.display = 'block';
  };
  window._lexSADebe = debe;

  // ════════════════════════════════════════════════════════════════════
  // FICHA DEL SALDO (sin folio) + PDF de VISTA PREVIA + ESTADO DE CUENTA
  // Nada de esto toca Caja, Contabilidad ni la numeración de folios.
  // ════════════════════════════════════════════════════════════════════
  var MESES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function fLarga(iso){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? (+m[3]) + ' de ' + MESES_L[+m[2] - 1] + ' de ' + m[1] : ''; }
  function todosLosPagos(sa){
    var a = (sa.pagosAnteriores || []).map(function(p){ return { fecha: p.fecha, concepto: p.concepto || 'Abono', comprobante: sa.folioPapel ? 'papel ' + sa.folioPapel : 'papel', monto: r2(p.monto), papel: true }; });
    var b = (sa.pagosSistema || []).map(function(p){ return { fecha: p.fecha, concepto: p.concepto || 'Abono', comprobante: p.comprobante || 'Caja', monto: r2(p.monto), papel: false }; });
    return a.concat(b).sort(function(x, y){ return String(x.fecha || '').localeCompare(String(y.fecha || '')); });
  }
  function totalPagado(sa){ return r2(pagadoAntes(sa) + pagadoSistema(sa)); }
  function costoDe(sa){ return (sa.costo != null && sa.costo !== '') ? r2(sa.costo) : r2(debe(sa) + totalPagado(sa)); }

  window.lexFichaSaldoAnterior = function(id){
    var sa = porId(id); if (!sa) return;
    if (sa.estado === 'convertido' && sa.folioConvertido != null) {
      try { if (typeof window.cerrarCobranza === 'function') window.cerrarCobranza(); } catch(e){}
      if (typeof abrirFichaDesdeContab === 'function') { abrirFichaDesdeContab(Number(sa.folioConvertido)); return; }
    }
    var viejo = document.getElementById('lex-sa-ficha'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-sa-ficha';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99990;background:rgba(26,16,8,0.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Helvetica,Arial,sans-serif;';
    var pagos = todosLosPagos(sa), d = debe(sa), pag = totalPagado(sa), costo = costoDe(sa);
    var btn = function(id2, txt, est){ return '<button type="button" id="' + id2 + '" style="width:100%;border-radius:7px;padding:9px 8px;font-size:0.72rem;font-weight:700;letter-spacing:0.04em;cursor:pointer;font-family:monospace;' + est + '">' + txt + '</button>'; };
    ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:960px;max-height:94vh;overflow-y:auto;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#2a1c08;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #e3d3a8;flex-wrap:wrap;">'
      + '<div style="font-size:0.72rem;letter-spacing:0.08em;color:#7a5410;font-family:monospace;">📋 FICHA DEL RECIBO ANTERIOR <span style="background:#f1efe8;color:#5f5e5a;border-radius:10px;padding:2px 9px;margin-left:6px;">🗂 RECIBO ANTERIOR · SIN FOLIO</span></div>'
      + '<div style="display:flex;gap:8px;align-items:center;">' + (sa.folioPapel ? '<span style="font-size:0.72rem;background:#fdf0dc;color:#8a4a10;border-radius:10px;padding:2px 9px;">📄 papel N° ' + E(sa.folioPapel) + (sa.anio ? ' · ' + E(sa.anio) : '') + '</span>' : '')
      + '<span id="saf-x" style="cursor:pointer;font-size:1.1rem;color:#7a5410;">✕</span></div></div>'
      + '<div style="display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:14px;padding:12px 16px;">'
      + '<div style="min-width:0;">'
      + '<div style="background:#fff;border:1px solid #eadfbf;border-radius:8px;padding:9px 12px;">'
      + '<div style="font-size:0.6rem;color:#9a8a6a;letter-spacing:0.08em;font-family:monospace;">CLIENTE</div>'
      + '<div style="font-size:0.95rem;font-weight:700;">' + E(String(sa.cliente || '').toUpperCase()) + '</div>'
      + '<div style="font-size:0.78rem;color:#1a5fa8;font-weight:700;text-transform:uppercase;">' + E(sa.concepto) + '</div>'
      + '<div style="font-size:0.74rem;color:#7a6840;">' + (sa.tel ? 'Tel. ' + E(sa.tel) : 'Sin teléfono') + (sa.anio ? ' · Trámite iniciado en ' + E(sa.anio) : '') + '</div>'
      + (sa.nota ? '<div style="font-size:0.72rem;color:#8a7a5a;font-style:italic;margin-top:4px;">📝 ' + E(sa.nota) + ' <span style="font-size:0.62rem;">(uso interno)</span></div>' : '')
      + '</div>'
      + '<div style="font-size:0.6rem;color:#7a5410;letter-spacing:0.08em;margin:12px 0 4px;font-family:monospace;">PAGOS DEL TRÁMITE</div>'
      + (pagos.length ? '<table style="width:100%;border-collapse:collapse;font-size:0.76rem;background:#fff;table-layout:fixed;"><colgroup><col style="width:105px"><col><col style="width:130px"><col style="width:100px"></colgroup>'
        + '<tr style="background:#f5ecd6;color:#7a5410;font-size:0.66rem;"><th style="text-align:left;padding:5px 8px;">Fecha</th><th style="text-align:left;padding:5px 8px;">Concepto</th><th style="text-align:left;padding:5px 8px;">Comprobante</th><th style="text-align:right;padding:5px 8px;">Monto</th></tr>'
        + pagos.map(function(p){ return '<tr style="border-top:1px solid #eadfbf;' + (p.papel ? '' : 'background:#f3f9ee;') + '"><td style="padding:5px 8px;">' + E(fL(p.fecha)) + '</td><td style="padding:5px 8px;">' + E(p.concepto) + '</td><td style="padding:5px 8px;">' + (p.papel ? '📄 ' : '🧾 ') + E(p.comprobante) + '</td><td style="padding:5px 8px;text-align:right;font-family:monospace;">' + $m(p.monto) + '</td></tr>'; }).join('')
        + '</table>' : '<div style="font-size:0.76rem;color:#7a6a4a;padding:8px;background:#fff;border:1px solid #eadfbf;border-radius:6px;">Sin pagos registrados todavía.</div>')
      + '</div>'
      + '<div style="background:#fffdf7;border:1.5px solid #c8952a;border-radius:8px;padding:10px;font-size:0.8rem;display:flex;flex-direction:column;gap:7px;align-self:start;font-family:monospace;">'
      + '<div style="font-size:0.6rem;letter-spacing:0.1em;color:#7a5410;">RESUMEN</div>'
      + '<div style="display:flex;justify-content:space-between;"><span>COSTO</span><b>' + $m(costo) + '</b></div>'
      + '<div style="display:flex;justify-content:space-between;"><span>PAGADO</span><b style="color:#1a7a3a;">' + $m(pag) + '</b></div>'
      + '<div style="display:flex;justify-content:space-between;border-top:1px dashed #c8952a;padding-top:5px;"><span style="color:#a32d2d;">RESTA</span><b style="color:#a32d2d;font-size:0.95rem;">' + $m(d) + '</b></div>'
      + btn('saf-prev', '👁 VISTA PREVIA PDF', 'border:1.5px solid #4a6ea8;color:#1a3a70;background:#e6f1fb;')
      + btn('saf-edo', '📊 ESTADO DE CUENTA', 'border:1.5px solid #2a7a4a;color:#0f5228;background:#e8f5ec;')
      + (d > 0.005 ? btn('saf-cob', '💰 COBRAR', 'border:none;color:#fff;background:#c8781a;') : '<div style="text-align:center;color:#1a7a3a;font-weight:700;">✓ PAGADO</div>')
      + btn('saf-edit', '✏ EDITAR', 'border:1px solid #c8951a;color:#9a6e18;background:#fff;')
      + '</div></div></div>';
    document.body.appendChild(ov);
    var q = function(s){ return ov.querySelector(s); };
    q('#saf-x').onclick = function(){ ov.remove(); };
    ov.onclick = function(ev){ if (ev.target === ov) ov.remove(); };
    q('#saf-prev').onclick = function(){ verPDF(pdfVistaPrevia(sa), 'Vista previa · ' + sa.cliente); };
    q('#saf-edo').onclick = function(){ verPDF(pdfEstadoCuenta(sa), 'Estado de cuenta · ' + sa.cliente); };
    if (q('#saf-cob')) q('#saf-cob').onclick = function(){ ov.remove(); window.lexCobrarSaldoAnterior(sa.id); };
    q('#saf-edit').onclick = function(){ ov.remove(); window.lexAbrirSaldoAnterior(sa.id); };
  };

  // ── PDFs (jsPDF ya está cargado en el sistema) ───────────────────────
  function nuevoDoc(){
    var J = window.jspdf && window.jspdf.jsPDF; if (!J) throw new Error('jsPDF no disponible');
    return new J({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  }
  function encabezado(doc, titulo, fechaTxt){
    var W = doc.internal.pageSize.getWidth(), M = 14, y = 14;
    doc.setDrawColor(200, 149, 42); doc.setLineWidth(0.6); doc.roundedRect(M, y, W - 2 * M, 30, 2, 2);
    try {
      if (typeof LOGO_SRC !== 'undefined' && LOGO_SRC) {
        var pr = doc.getImageProperties(LOGO_SRC), h = 22, w = h * (pr.width / pr.height);
        if (w > 34) { w = 34; h = w * (pr.height / pr.width); }
        doc.addImage(LOGO_SRC, 'JPEG', M + 4, y + (30 - h) / 2, w, h);
      }
    } catch(e){}
    doc.setFont('times', 'bold'); doc.setFontSize(14); doc.setTextColor(140, 101, 24);
    doc.text('LEX-MÉXICO · DESPACHO JURÍDICO', W / 2, y + 9, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 74, 48);
    doc.text(doc.splitTextToSize('CALLE MIGUEL HIDALGO ESQ. MÉXICO NO. 200, LOCAL B, COL. CENTRO · SANTIAGO JUXTLAHUACA, OAXACA · Tel. 953 128 7511', W - 2 * M - 90), W / 2, y + 14, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 16, 8);
    doc.text(titulo, W / 2, y + 26, { align: 'center' });
    // Casilla de número de recibo: SIN FOLIO
    doc.setDrawColor(200, 149, 42); doc.rect(W - M - 34, y + 5, 30, 14);
    doc.setFontSize(6.5); doc.setTextColor(122, 84, 16); doc.text('NO. RECIBO', W - M - 19, y + 9, { align: 'center' });
    doc.setFont('courier', 'bold'); doc.setFontSize(12); doc.setTextColor(150, 150, 150); doc.text('— — —', W - M - 19, y + 16, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60, 50, 30);
    doc.text('Fecha: ' + fechaTxt, M, y + 37);
    return y + 42;
  }
  function marcaAgua(doc, txt){
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    try { if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.13 })); } catch(e){}
    doc.setFont('times', 'bold'); doc.setFontSize(38); doc.setTextColor(192, 22, 26);
    var tw = doc.getTextWidth(txt), ang = 28 * Math.PI / 180;
    doc.text(txt, W / 2 - (tw / 2) * Math.cos(ang), H * 0.42 + (tw / 2) * Math.sin(ang), { angle: 28 });
    try { if (doc.GState) doc.setGState(new doc.GState({ opacity: 1 })); } catch(e){}
  }
  function bloqueCliente(doc, sa, y){
    var W = doc.internal.pageSize.getWidth(), M = 14;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 16, 8);
    doc.text(String(sa.cliente || '').toUpperCase(), M, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 95, 168);
    var lin = doc.splitTextToSize(String(sa.concepto || '').toUpperCase(), W - 2 * M); doc.text(lin, M, y + 5);
    var y2 = y + 5 + lin.length * 4;
    doc.setTextColor(90, 74, 48); doc.setFontSize(8.5);
    doc.text((sa.folioPapel ? 'Folio de papel N° ' + sa.folioPapel : 'Sin folio de papel') + (sa.anio ? ' · Trámite iniciado en ' + sa.anio : '') + (sa.tel ? ' · Tel. ' + sa.tel : ''), M, y2 + 1);
    return y2 + 7;
  }
  function filaTabla(doc, y, cols, vals, opts){
    opts = opts || {};
    if (opts.fondo) { doc.setFillColor.apply(doc, opts.fondo); doc.rect(14, y - 4, doc.internal.pageSize.getWidth() - 28, 6, 'F'); }
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(opts.size || 8.5);
    doc.setTextColor.apply(doc, opts.color || [26, 16, 8]);
    vals.forEach(function(v, i){ var c = cols[i]; doc.text(String(v), c.x, y, c.right ? { align: 'right' } : undefined); });
    return y + 6;
  }
  function pdfVistaPrevia(sa){
    var doc = nuevoDoc(), W = doc.internal.pageSize.getWidth();
    var ult = todosLosPagos(sa).map(function(p){ return p.fecha; }).filter(Boolean).pop() || '';
    var y = encabezado(doc, 'VISTA PREVIA — RECIBO ANTERIOR', ult ? fLarga(ult) + ' (último pago registrado)' : 'sin pagos registrados');
    y = bloqueCliente(doc, sa, y + 2);
    var cols = [{ x: 16 }, { x: W - 16, right: true }];
    y = filaTabla(doc, y + 2, cols, ['CONCEPTO', 'IMPORTE'], { bold: true, fondo: [245, 236, 214], color: [122, 84, 16], size: 8 });
    y = filaTabla(doc, y, cols, ['Costo pactado del trámite', $m(costoDe(sa))]);
    if ((sa.pagosAnteriores || []).length) y = filaTabla(doc, y, cols, ['Pagos anteriores (' + sa.pagosAnteriores.length + ')' + (sa.folioPapel ? ' — papel ' + sa.folioPapel : ''), '- ' + $m(pagadoAntes(sa))]);
    if ((sa.pagosSistema || []).length) y = filaTabla(doc, y, cols, ['Abonos registrados en caja (' + sa.pagosSistema.length + ')', '- ' + $m(pagadoSistema(sa))]);
    doc.setDrawColor(200, 149, 42); doc.line(14, y - 3, W - 14, y - 3);
    y = filaTabla(doc, y + 1, cols, ['SALDO PENDIENTE', $m(debe(sa))], { bold: true, color: [163, 45, 45], size: 10 });
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(122, 106, 74);
    doc.text(doc.splitTextToSize('Documento informativo sin validez de recibo. El recibo oficial se emitirá con folio al registrar el siguiente pago. No representa un movimiento de caja.', W - 28), 14, y + 6);
    marcaAgua(doc, 'VISTA PREVIA · SIN FOLIO');
    return doc;
  }
  function pdfEstadoCuenta(sa){
    var doc = nuevoDoc(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var y = encabezado(doc, 'ESTADO DE CUENTA — RECIBO ANTERIOR', fLarga(hoyISO()));
    y = bloqueCliente(doc, sa, y + 2);
    var cols = [{ x: 16 }, { x: 44 }, { x: 110 }, { x: W - 46, right: true }, { x: W - 16, right: true }];
    y = filaTabla(doc, y + 2, cols, ['FECHA', 'CONCEPTO', 'COMPROBANTE', 'ABONO', 'SALDO'], { bold: true, fondo: [245, 236, 214], color: [122, 84, 16], size: 8 });
    var saldo = costoDe(sa);
    y = filaTabla(doc, y, cols, ['', 'Costo pactado del trámite', '', '', $m(saldo)], { bold: true });
    todosLosPagos(sa).forEach(function(p){
      if (y > H - 30) { doc.addPage(); y = 20; }
      saldo = r2(saldo - p.monto);
      y = filaTabla(doc, y, cols, [fL(p.fecha), String(p.concepto).slice(0, 34), (p.papel ? 'Papel ' : '') + String(p.comprobante).replace(/^papel\s*/, ''), $m(p.monto), $m(saldo)]);
    });
    doc.setDrawColor(200, 149, 42); doc.line(14, y - 3, W - 14, y - 3);
    y = filaTabla(doc, y + 1, [{ x: 16 }, { x: W - 16, right: true }], ['SALDO PENDIENTE AL ' + fL(hoyISO()).toUpperCase(), $m(debe(sa))], { bold: true, color: [163, 45, 45], size: 10 });
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(122, 106, 74);
    doc.text(doc.splitTextToSize('Documento informativo. Los pagos marcados como "Papel" se recibieron antes del sistema con el recibo de papel indicado. No sustituye los recibos oficiales.', W - 28), 14, y + 6);
    marcaAgua(doc, 'INFORMATIVO · SIN FOLIO');
    return doc;
  }
  function verPDF(doc, titulo){
    var url; try { url = URL.createObjectURL(doc.output('blob')); } catch(e){ toastS('No se pudo generar el PDF', 'err'); return; }
    var viejo = document.getElementById('lex-sa-pdf'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-sa-pdf';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(10,7,3,0.82);display:flex;flex-direction:column;padding:14px;gap:8px;font-family:Helvetica,Arial,sans-serif;';
    ov.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;color:#e8c875;font-size:0.8rem;"><span>📄 ' + E(titulo) + ' <span style="color:#c8b68a;font-size:0.7rem;">(no es recibo oficial · no registra nada en caja)</span></span>'
      + '<span style="display:flex;gap:8px;"><button type="button" id="sap-print" style="background:#9a6e18;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;">🖨 Imprimir</button><button type="button" id="sap-x" style="background:#fff;color:#7a5410;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;">✕ Cerrar</button></span></div>'
      + '<iframe id="sap-frame" src="' + url + '" style="flex:1;width:100%;border:none;border-radius:6px;background:#fff;"></iframe>';
    document.body.appendChild(ov);
    ov.querySelector('#sap-x').onclick = function(){ ov.remove(); try { URL.revokeObjectURL(url); } catch(e){} };
    ov.querySelector('#sap-print').onclick = function(){ try { ov.querySelector('#sap-frame').contentWindow.print(); } catch(e){ window.open(url, '_blank'); } };
  }
  window._lexSAPdfVistaPrevia = pdfVistaPrevia;

  // ════════════════════════════════════════════════════════════════════
  // MENÚ "🗂 Recibos Anteriores": lista de todos + contador de pendientes
  // ════════════════════════════════════════════════════════════════════
  var _verPagadosRA = false;
  function pendientesRA(){ return todos().filter(function(a){ return a.estado !== 'convertido' && debe(a) > 0.005; }); }
  window.lexBadgeRecibosAnteriores = function(){
    var b = document.getElementById('badgeRecibosAnteriores'); if (!b) return;
    var n = pendientesRA().length;
    b.textContent = n; b.style.display = n ? '' : 'none';
  };
  window.lexListaRecibosAnteriores = function(){
    try { window.lexVincularSaldosAnteriores(); } catch(e){}
    var ov = document.getElementById('lex-ra-lista');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'lex-ra-lista';
      ov.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(10,7,3,0.75);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Helvetica,Arial,sans-serif;';
      ov.innerHTML = '<div style="background:#fbf6ea;border:2px solid #c8951a;border-radius:12px;width:98%;max-width:1100px;max-height:94vh;display:flex;flex-direction:column;overflow:hidden;color:#2a1c08;">'
        + '<div style="background:#1a1008;padding:12px 18px;display:flex;align-items:center;gap:10px;"><span style="font-size:1.2rem;">🗂</span><div style="flex:1;"><div style="font-family:serif;font-size:1.05rem;color:#e8c875;">Recibos anteriores</div><div id="ra-sub" style="font-size:0.62rem;color:rgba(232,200,117,0.65);font-family:monospace;letter-spacing:0.06em;"></div></div>'
        + '<button type="button" id="ra-x" style="background:none;border:none;color:rgba(232,200,117,0.75);font-size:1.3rem;cursor:pointer;">✕</button></div>'
        + '<div style="display:flex;gap:8px;align-items:center;padding:12px 18px 6px;flex-wrap:wrap;">'
        + '<input id="ra-busca" type="text" placeholder="🔍 Buscar por cliente, folio de papel, trámite o año" style="flex:1;min-width:220px;border:1px solid #d9c38a;border-radius:20px;padding:8px 14px;font-size:0.8rem;background:#fff;">'
        + '<button type="button" id="ra-pagados" style="border:1px solid #c8951a;background:#fff;color:#9a6e18;border-radius:20px;padding:7px 14px;font-size:0.74rem;cursor:pointer;"></button>'
        + '<button type="button" id="ra-nuevo" style="border:none;background:#9a6e18;color:#fff;border-radius:20px;padding:8px 16px;font-size:0.76rem;font-weight:700;cursor:pointer;">＋ Nuevo recibo anterior</button></div>'
        + '<div id="ra-lista" style="overflow-y:auto;padding:4px 18px 16px;min-height:120px;"></div></div>';
      document.body.appendChild(ov);
      ov.querySelector('#ra-x').onclick = function(){ ov.style.display = 'none'; };
      ov.addEventListener('click', function(ev){ if (ev.target === ov) ov.style.display = 'none'; });
      ov.querySelector('#ra-busca').addEventListener('input', pintarListaRA);
      ov.querySelector('#ra-nuevo').onclick = function(){ window.lexNuevoSaldoAnterior(); };
      ov.querySelector('#ra-pagados').onclick = function(){ _verPagadosRA = !_verPagadosRA; pintarListaRA(); };
    }
    ov.style.display = 'flex';
    pintarListaRA();
  };
  function pintarListaRA(){
    var ov = document.getElementById('lex-ra-lista'); if (!ov || ov.style.display === 'none') { window.lexBadgeRecibosAnteriores(); return; }
    var q = N((ov.querySelector('#ra-busca') || {}).value || '');
    var pend = pendientesRA();
    var base = _verPagadosRA ? todos().filter(function(a){ return pend.indexOf(a) < 0; }) : pend;
    var lst = base.filter(function(a){ return !q || N([a.cliente, a.folioPapel, a.concepto, a.anio, a.tel, a.folioConvertido].join(' ')).indexOf(q) >= 0; })
      .sort(function(a, b){ return String(ultimaFecha(a)).localeCompare(String(ultimaFecha(b))); });
    ov.querySelector('#ra-pagados').textContent = _verPagadosRA ? '← Pendientes' : '✓ Con folio / pagados';
    ov.querySelector('#ra-sub').textContent = pend.length + ' pendiente' + (pend.length === 1 ? '' : 's') + ' · debe en total ' + $m(pend.reduce(function(s, a){ return s + debe(a); }, 0));
    var cont = ov.querySelector('#ra-lista');
    if (!lst.length) { cont.innerHTML = '<div style="text-align:center;color:#7a6a4a;padding:30px;font-size:0.82rem;">' + (q ? 'Ninguno coincide con la búsqueda.' : (_verPagadosRA ? 'Todavía no hay recibos anteriores con folio o pagados.' : 'No hay recibos anteriores pendientes. Usa <b>＋ Nuevo recibo anterior</b>.')) + '</div>'; window.lexBadgeRecibosAnteriores(); return; }
    cont.innerHTML = lst.map(function(a){
      var d = debe(a), conv = a.estado === 'convertido';
      return '<div class="ra-fila" data-id="' + E(a.id) + '" style="display:grid;grid-template-columns:70px minmax(0,1fr) 120px 110px;gap:12px;align-items:center;background:#fff;border:1px solid #eadfbf;border-left:4px solid ' + (conv ? '#1a7a3a' : '#7a6840') + ';padding:9px 12px;margin-top:6px;cursor:pointer;" title="Abrir ficha">'
        + '<div style="text-align:center;line-height:1.1;color:#5f5e5a;"><div style="font-size:0.58rem;letter-spacing:0.05em;font-family:monospace;">AÑO ' + E(a.anio || '—') + '</div><div style="font-weight:700;font-size:0.8rem;">📄 ' + E(a.folioPapel || 'S/N') + '</div></div>'
        + '<div style="min-width:0;"><div style="font-weight:700;font-size:0.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + E(String(a.cliente || '').toUpperCase()) + '</div><div style="font-size:0.72rem;color:#7a6a4a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + E(a.concepto || '') + (a.tel ? ' · ' + E(a.tel) : '') + '</div></div>'
        + '<div style="text-align:right;"><div style="font-size:0.6rem;color:#9a8a6a;font-family:monospace;">' + (conv ? 'FOLIO' : 'DEBE') + '</div><div style="font-weight:700;color:' + (conv ? '#1a4a8a' : (d > 0.005 ? '#a32d2d' : '#1a7a3a')) + ';">' + (conv ? E(a.folioConvertido) + 'A' : (d > 0.005 ? $m(d) : '✓ Pagado')) + '</div></div>'
        + '<div style="font-size:0.68rem;color:#7a6a4a;text-align:right;">Último pago<br><b style="color:#2a1c08;">' + E(fL(ultimaFecha(a))) + '</b></div></div>';
    }).join('');
    cont.querySelectorAll('.ra-fila').forEach(function(f){ f.onclick = function(){ window.lexFichaSaldoAnterior(f.getAttribute('data-id')); }; });
    window.lexBadgeRecibosAnteriores();
  }
  window._lexRAPintar = pintarListaRA;
  setTimeout(window.lexBadgeRecibosAnteriores, 4000);
  setInterval(function(){ try { window.lexBadgeRecibosAnteriores(); } catch(e){} }, 30000);
  window._lexSAPdfEstado = pdfEstadoCuenta;
})();
