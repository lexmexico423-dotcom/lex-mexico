// ── Oct-2026 · BUSCADOR GENERAL "HASTA EL ÚLTIMO RINCÓN" ─────────────────────
// Reemplaza la búsqueda del buscador de arriba (global-search-inp):
//  · Sin importar acentos ni mayúsculas ("pelaez" = "PELÁEZ", "pena" = "PEÑA").
//  · Varias palabras: deben aparecer todas, en cualquier orden.
//  · Busca en TODO: recibos, directorio, carpetas, escrituras (compradores,
//    vendedores, notaría, instrumento…), juicios, pendientes/placas, recibos
//    anteriores, adeudos sin recibo, cotizaciones, citas, gestiones,
//    contabilidad (cobros y movimientos) y tareas.
//  · Resultados agrupados por sección con su número de coincidencias; al tocar
//    uno se abre esa ficha; "Ver los N…" abre la sección ya filtrada.
//  · El modo IA ("?" al inicio) sigue funcionando igual.
(function(){
  'use strict';
  if (window._lexBuscadorGlobal) return;
  window._lexBuscadorGlobal = true;

  var MAX_POR_GRUPO = 6;
  // Campos que NO se revisan (quién capturó, archivos, ids, ligas…) para que
  // "nahum" no saque todo lo que capturó el licenciado.
  var EXCLUIR = /^(id|creadoPor|responsable|cobradoPor|generadoPor|usuario|por|eliminadoPor|entregaConfirmadaPor|enDespachoPor|enDespachoMarcadoPor|enviadoPor|resp|historialCambios|historial|historialRespaldos|historialPasos|flujoLey|flujoEstados|flujoGrounded|leyesActivas|telHistorial|driveFolderId|driveFileId|archivo|archivoR2|expDigital|expDigitalDocumentosPlacas|sha256|fechasImpresion|_.*)$/;

  function sinAc(s){ return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function textoDe(obj, prof){
    prof = prof || 0;
    if (obj == null || prof > 5) return '';
    var t = typeof obj;
    if (t === 'string' || t === 'number') return String(obj);
    if (t !== 'object') return '';
    var out = [];
    if (Array.isArray(obj)) { for (var i = 0; i < obj.length; i++) out.push(textoDe(obj[i], prof + 1)); }
    else { for (var k in obj) { if (!Object.prototype.hasOwnProperty.call(obj, k) || EXCLUIR.test(k)) continue; out.push(textoDe(obj[k], prof + 1)); } }
    return out.join(' ');
  }
  function coincide(obj, palabras){
    if (!obj) return false;
    var txt = sinAc(textoDe(obj));
    for (var i = 0; i < palabras.length; i++) if (txt.indexOf(palabras[i]) < 0) return false;
    return true;
  }
  function e(s){ return (typeof esc === 'function') ? esc(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function $m(n){ try { return (typeof fmt === 'function') ? fmt(n) : Number(n || 0).toFixed(2); } catch(_){ return String(n); } }
  function fFecha(f){ try { return (typeof fmtFecha === 'function' && f) ? fmtFecha(f) : (f || ''); } catch(_){ return f || ''; } }
  function arr(a){ return Array.isArray(a) ? a : []; }
  function D_(){ return (typeof D !== 'undefined' && D) ? D : {}; }

  function irSeccion(panel, inputId, q, despues){
    try { if (typeof ir === 'function') ir(panel); } catch(_){}
    setTimeout(function(){
      if (inputId) {
        var i = document.getElementById(inputId);
        if (i) { i.value = q; ['input', 'keyup', 'change'].forEach(function(t){ try { i.dispatchEvent(new Event(t, { bubbles: true })); } catch(_){} }); }
      }
      if (despues) { try { despues(); } catch(err){ console.warn('[buscador]', err); } }
    }, 180);
  }
  function nombresPersonas(lista){ return arr(lista).map(function(p){ return (p && typeof p === 'object') ? (p.nombre || '') : String(p || ''); }).filter(Boolean).join(', '); }

  // ── Fuentes de búsqueda ───────────────────────────────────────────────────
  function fuentes(){
    var d = D_();
    var F = [];
    // Recibos (una por folio, la versión más reciente)
    F.push({ clave:'recibo', titulo:'🧾 Recibos', icono:'🧾', panel:'recibos', input:'recFiltroQ',
      lista: function(){
        var todos = arr(typeof appData !== 'undefined' && appData ? appData.recibos : []).concat(arr(typeof REC !== 'undefined' && REC ? REC.recibos : []));
        var mapa = {};
        todos.forEach(function(r){ if (r && r.folio != null) { var k = String(r.folio); var prev = mapa[k]; if (!prev || String(r.letra || 'A') >= String(prev.letra || 'A')) mapa[k] = r; } });
        return Object.keys(mapa).map(function(k){ return mapa[k]; }).sort(function(a, b){ return (Number(b.folio) || 0) - (Number(a.folio) || 0); });
      },
      item: function(r){
        var saldo = Number(r.saldoPendiente || 0);
        var fol = r.folio; try { if (typeof folioConLetra === 'function') fol = folioConLetra(r.folio, r.anio_folio, r.letra || 'A'); } catch(_){}
        return { titulo: r.nombre || '—', sub: '#' + fol + ' · ' + fFecha(r.fecha),
          badge: r.cancelado ? { txt:'Cancelado', color:'#f08a8a', bg:'rgba(192,22,26,0.15)' } : (saldo > 0 ? { txt:'$' + $m(saldo) + ' pendiente', color:'#e8c875', bg:'rgba(200,149,42,0.15)' } : { txt:'Liquidado', color:'#4dca6a', bg:'rgba(40,180,80,0.12)' }),
          accion: function(){ if (typeof abrirPreviaDesdeContab === 'function') abrirPreviaDesdeContab(r.folio); } };
      } });
    // Directorio
    F.push({ clave:'directorio', titulo:'👤 Directorio', icono:'👤', panel:'directorio', input:'dirQ',
      lista: function(){ return arr(d.directorio); },
      item: function(x){ var idx = arr(d.directorio).indexOf(x);
        return { titulo: x.nombre || '—', sub: [x.tipo, x.tel, x.pob].filter(Boolean).join(' · '),
          accion: function(){ irSeccion('directorio', null, '', function(){ if (typeof _abrirPerfilContacto === 'function') _abrirPerfilContacto(idx); }); } }; } });
    // Carpetas
    F.push({ clave:'carpeta', titulo:'📁 Carpetas', icono:'📁', panel:'carpetas', input:'carpQ',
      lista: function(){ return arr(d.carpetas).filter(function(c){ return c && !c.vacio; }); },
      item: function(c){ var idx = arr(d.carpetas).indexOf(c);
        var sub = [c.escTipo, c.juicioDesc, c.docDesc].filter(Boolean)[0] || c.tipoTramite || '';
        return { titulo: c.cliente || '—', sub: 'Carpeta ' + String(c.num || '').replace(/^CARP\.-\s*/i, '') + (sub ? ' · ' + sub : ''),
          badge: c.estatus ? { txt:c.estatus, color:'rgba(232,200,117,0.85)', bg:'rgba(200,149,42,0.12)' } : null,
          accion: function(){ irSeccion('carpetas', null, '', function(){ if (typeof abrirDetallesCarpeta === 'function') abrirDetallesCarpeta(idx); else if (typeof abrirCarpeta === 'function') abrirCarpeta(idx); }); } }; } });
    // Escrituras
    F.push({ clave:'escritura', titulo:'📜 Escrituras', icono:'📜', panel:'escrituras', input:'escQ',
      lista: function(){ var elim = arr(d.escriturasEliminadas); return arr(d.escrituras).filter(function(x){ return x && elim.indexOf(x.id) < 0; }); },
      item: function(x){ var idx = arr(d.escrituras).indexOf(x);
        var comp = nombresPersonas(x.compradores), vend = nombresPersonas(x.vendedores);
        var datos = [x.instrumento ? 'Instr. ' + x.instrumento : '', x.volumen ? 'Vol. ' + x.volumen : '', x.notaria ? 'Notaría ' + x.notaria : ''].filter(Boolean).join(' · ');
        return { titulo: comp || vend || x.tramite || '—', sub: (vend && comp ? 'Vende: ' + vend + (datos ? ' · ' : '') : '') + datos,
          badge: x.estado ? { txt:x.estado, color:'#a0c0ff', bg:'rgba(100,150,255,0.12)' } : null,
          accion: function(){ irSeccion('escrituras', null, '', function(){ if (typeof escAbrirDetalle === 'function') escAbrirDetalle(idx); }); } }; } });
    // Juicios
    F.push({ clave:'juicio', titulo:'⚖️ Juicios', icono:'⚖️', panel:'juicios', input:'juicioQ',
      lista: function(){ return arr(d.juicios); },
      item: function(j){ var idx = arr(d.juicios).indexOf(j);
        return { titulo: j.cliente || j.nombre || '—', sub: [j.tipo, j.expediente ? 'Exp. ' + j.expediente : '', j.juzgado].filter(Boolean).join(' · '),
          badge: j.estatus ? { txt:j.estatus, color:'#a0c0ff', bg:'rgba(100,150,255,0.12)' } : null,
          accion: function(){ irSeccion('juicios', null, '', function(){ if (typeof abrirDetalle === 'function') abrirDetalle(idx); }); } }; } });
    // Pendientes / Placas
    F.push({ clave:'pendiente', titulo:'📌 Pendientes / Placas', icono:'📌', panel:'pendientes', input:'pendQ',
      lista: function(){ return arr(d.pendientes); },
      item: function(p){ var idx = arr(d.pendientes).indexOf(p);
        return { titulo: (p.persona || '').trim() || p.texto || '—', sub: [p.persona ? p.texto : '', p.categoria].filter(Boolean).join(' · '),
          badge: p.resuelto ? { txt:'Resuelto', color:'#4dca6a', bg:'rgba(40,180,80,0.12)' } : { txt:'Activo', color:'#e8c875', bg:'rgba(200,149,42,0.12)' },
          accion: function(){ if (typeof abrirPendiente === 'function') abrirPendiente(idx); } }; } });
    // Recibos anteriores (folios de papel)
    F.push({ clave:'anterior', titulo:'📂 Recibos anteriores', icono:'📂', panel:'recibos-anteriores', input:'raQ',
      lista: function(){ return arr(d.adeudosSinRecibo).filter(function(a){ return a && a.tipo === 'anterior' && !a.eliminado; }); },
      item: function(a){
        return { titulo: a.cliente || '—', sub: [a.folioPapel ? 'Folio papel ' + a.folioPapel : '', a.anio, a.concepto || a.tipoTramite].filter(Boolean).join(' · '),
          badge: a.estado ? { txt:a.estado, color:'#e8c875', bg:'rgba(200,149,42,0.12)' } : null,
          accion: function(){ if (typeof window.lexFichaSaldoAnterior === 'function') window.lexFichaSaldoAnterior(a.id); else irSeccion('recibos-anteriores', 'raQ', a.cliente || ''); } }; } });
    // Adeudos sin recibo
    F.push({ clave:'adeudo', titulo:'💳 Adeudos sin recibo', icono:'💳', panel:'adeudos-sin-recibo', input:'adeudosBuscar',
      lista: function(){ return arr(d.adeudosSinRecibo).filter(function(a){ return a && a.tipo !== 'anterior' && !a.eliminado; }); },
      item: function(a){
        var total = 0; arr(a.conceptos).forEach(function(c){ total += Number(c && c.monto || 0); });
        return { titulo: a.cliente || '—', sub: arr(a.conceptos).map(function(c){ return c && c.descripcion; }).filter(Boolean).slice(0, 2).join(' · ') + (total ? ' · $' + $m(total) : ''),
          badge: a.estado ? { txt:a.estado, color:'#e8c875', bg:'rgba(200,149,42,0.12)' } : null,
          accion: function(){ irSeccion('adeudos-sin-recibo', 'adeudosBuscar', a.cliente || ''); } }; } });
    // Cotizaciones
    F.push({ clave:'cotizacion', titulo:'📝 Cotizaciones', icono:'📝', panel:'pre-recibo', input:null,
      lista: function(){ return arr(d.preRecibos).filter(function(p){ return p && !p.eliminado; }); },
      item: function(p){
        return { titulo: p.nombre || '—', sub: [p.concepto, p.tipo, p.fechaInicio].filter(Boolean).join(' · '),
          badge: p.convertido ? { txt:'Ya es recibo', color:'#4dca6a', bg:'rgba(40,180,80,0.12)' } : null,
          accion: function(){ irSeccion('pre-recibo', null, '', function(){ if (typeof window._prAbrirFormulario === 'function') window._prAbrirFormulario(p.id); }); } }; } });
    // Citas
    F.push({ clave:'cita', titulo:'📅 Citas', icono:'📅', panel:'citas', input:'citasQ',
      lista: function(){ return arr(d.citas); },
      item: function(c){
        return { titulo: c.titulo || c.cliente || c.nombre || '—', sub: [c.cliente && c.titulo ? c.cliente : '', fFecha(c.fecha), c.hora, c.lugar].filter(Boolean).join(' · '),
          accion: function(){ irSeccion('citas', 'citasQ', c.cliente || c.titulo || ''); } }; } });
    // Gestiones
    F.push({ clave:'gestion', titulo:'🗂 Gestiones', icono:'🗂', panel:'gestiones', input:'gest-buscar',
      lista: function(){ return arr(d.gestiones); },
      item: function(g){
        return { titulo: g.cliente || g.nombre || g.titulo || '—', sub: [g.tramite, g.tipo, g.estatus].filter(Boolean).join(' · '),
          accion: function(){ irSeccion('gestiones', 'gest-buscar', g.cliente || g.nombre || ''); } }; } });
    // Contabilidad (cobros y movimientos de caja) — los más recientes primero
    F.push({ clave:'movimiento', titulo:'💵 Contabilidad', icono:'💵', panel:'contabilidad', input:'cBuscar',
      lista: function(){
        return arr(d.movimientos).slice().sort(function(a, b){ return String((b && b.fecha) || '').concat((b && b.hora) || '').localeCompare(String((a && a.fecha) || '').concat((a && a.hora) || '')); });
      },
      item: function(m){
        var ing = m.tipo !== 'egreso';
        return { titulo: m.descripcion || m.nombre || '—', sub: [m.folioCaja, m.folio ? 'Folio ' + m.folio + (m.letra || '') : '', fFecha(m.fecha), m.hora].filter(Boolean).join(' · '),
          badge: { txt:(ing ? '▲ $' : '▼ $') + $m(m.monto), color: ing ? '#4dca6a' : '#f08a8a', bg: ing ? 'rgba(40,180,80,0.12)' : 'rgba(192,22,26,0.12)' },
          accion: null }; } });
    // Tareas
    F.push({ clave:'tarea', titulo:'✅ Tareas', icono:'✅', panel:'tareas-hoy', input:'tareasBuscar',
      lista: function(){ var elim = arr(d.tareasHoyEliminadas); return arr(d.tareasHoy).filter(function(t){ return t && elim.indexOf(t.id) < 0; }); },
      item: function(t){
        return { titulo: t.titulo || t.texto || '—', sub: [t.fechaProgramada ? fFecha(t.fechaProgramada) : '', t.estado].filter(Boolean).join(' · '),
          accion: function(){ irSeccion('tareas-hoy', 'tareasBuscar', t.titulo || ''); } }; } });
    return F;
  }

  // ── Búsqueda y pintado ───────────────────────────────────────────────────
  var _timer = null;
  window._lexGsAcc = [];
  function buscar(q){
    var res = document.getElementById('global-search-results');
    if (!res) return;
    var palabras = sinAc(q).split(/\s+/).filter(Boolean);
    var acc = [];
    var grupos = [];
    fuentes().forEach(function(f){
      var lista = []; try { lista = f.lista() || []; } catch(err){ console.warn('[buscador] ' + f.clave, err); }
      var hallados = lista.filter(function(x){ try { return coincide(x, palabras); } catch(_){ return false; } });
      if (!hallados.length) return;
      grupos.push({ f: f, hallados: hallados });
    });
    var total = grupos.reduce(function(s, g){ return s + g.hallados.length; }, 0);
    if (!total) {
      res.innerHTML = '<div class="gs-empty">Sin resultados para "' + e(q) + '"</div>';
      res.classList.add('show');
      return;
    }
    var html = '<div style="padding:8px 14px 4px;font-family:monospace;font-size:0.58rem;color:rgba(232,200,117,0.75);letter-spacing:0.06em;">'
      + total + ' resultado' + (total === 1 ? '' : 's') + ' en ' + grupos.length + ' secci' + (grupos.length === 1 ? 'ón' : 'ones') + '</div>';
    grupos.forEach(function(g, gi){
      var f = g.f;
      if (gi > 0) html += '<hr class="gs-divider">';
      html += '<div class="gs-section"><div class="gs-section-title" style="display:flex;justify-content:space-between;">'
        + '<span>' + e(f.titulo) + '</span><span style="background:rgba(200,149,42,0.18);color:#e8c875;border-radius:9px;padding:0 7px;letter-spacing:0;">' + g.hallados.length + '</span></div>';
      g.hallados.slice(0, MAX_POR_GRUPO).forEach(function(x){
        var it; try { it = f.item(x); } catch(err){ return; }
        if (!it.accion) { it.accion = (function(f2){ return function(){ irSeccion(f2.panel, f2.input, q); }; })(f); }
        var i = acc.length; acc.push(it.accion);
        var badge = it.badge ? '<span class="gs-item-badge" style="color:' + it.badge.color + ';background:' + it.badge.bg + ';">' + e(it.badge.txt) + '</span>' : '';
        html += '<div class="gs-item" onclick="lexGsIr(' + i + ')"><div class="gs-item-icon">' + f.icono + '</div>'
          + '<div class="gs-item-main"><div class="gs-item-title">' + e(it.titulo) + '</div><div class="gs-item-sub">' + e(it.sub || '') + '</div></div>' + badge + '</div>';
      });
      if (g.hallados.length > MAX_POR_GRUPO) {
        var i2 = acc.length;
        acc.push((function(f2){ return function(){ irSeccion(f2.panel, f2.input, q); }; })(f));
        html += '<div class="gs-item" onclick="lexGsIr(' + i2 + ')" style="justify-content:flex-end;"><span style="font-family:monospace;font-size:0.62rem;color:#e8c875;">Ver los ' + g.hallados.length + ' en ' + e(f.titulo.replace(/^\S+\s/, '')) + ' →</span></div>';
      }
      html += '</div>';
    });
    window._lexGsAcc = acc;
    res.innerHTML = html;
    res.classList.add('show');
  }
  window.lexGsIr = function(i){
    var a = window._lexGsAcc[i];
    try { if (typeof globalSearchCerrar === 'function') globalSearchCerrar(); } catch(_){}
    if (typeof a === 'function') { try { a(); } catch(err){ console.warn('[buscador]', err); } }
  };
  window.lexBuscarTodo = buscar;   // para pruebas

  function instalar(){
    var previo = window.globalSearch;   // incluye el modo IA ("?")
    var nuevo = function(q){
      q = String(q || '').trim();
      if (q.charAt(0) === '?') { if (typeof previo === 'function') return previo(q); return; }
      try { var ic = document.getElementById('global-search-icon'); if (ic) ic.textContent = '🔍'; } catch(_){}
      var res = document.getElementById('global-search-results');
      clearTimeout(_timer);
      if (q.length < 2) { if (res) { res.classList.remove('show'); res.innerHTML = ''; } return; }
      _timer = setTimeout(function(){ buscar(q); }, 200);
    };
    nuevo._lexTodo = true;
    window.globalSearch = nuevo;
    try { globalSearch = nuevo; } catch(_){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', instalar); else instalar();
})();
