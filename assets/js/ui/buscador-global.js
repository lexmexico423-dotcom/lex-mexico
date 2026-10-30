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
  // ── Oct-2026 (opción A): ¿en qué parte de la ficha apareció lo buscado? ──
  var ETIQ = { obs:'observaciones', obsLista:'observaciones', bitacora:'observaciones', notaRevision:'nota de revisión', notaFinal:'nota final',
    descripcion:'descripción', notas:'notas', nota:'nota', texto:'texto', titulo:'título', vendedores:'vendedor', compradores:'comprador',
    nombreConyuge:'cónyuge', conducto:'por conducto de', conceptos:'conceptos', concepto:'concepto', clientes:'otros clientes', personas_veh:'personas',
    tel:'teléfono', tel2:'teléfono', pob:'población', desc:'descripción', persona:'persona', juiCliente:'cliente del juicio', predio:'predio',
    ubicacion:'ubicación', tramite:'trámite', tramites:'trámites', docDesc:'documentos', juicioDesc:'juicio', escTipo:'tipo de escritura',
    escNotario:'notaría', notaria:'notaría', instrumento:'instrumento', volumen:'volumen', escInstrumento:'instrumento', escVolumen:'volumen',
    expediente:'expediente', juzgado:'juzgado', acuerdos:'acuerdos', terminos:'términos', costosExtra:'gastos extra', pagosParciales:'abonos',
    folioPapel:'folio de papel', entregaRecibioPor:'entregada a', volInstr:'volumen/instrumento', nombre_cliente_firma:'firma', placa:'placa', serie:'serie', marca:'marca', cliente:'cliente', nombre:'nombre' };
  function dondeAparece(obj, palabras, titulo){
    var tn = sinAc(titulo);
    var faltan = palabras.filter(function(p){ return tn.indexOf(p) < 0; });
    if (!faltan.length) return null;
    var hallado = null;
    (function rec(o, clave, prof){
      if (hallado || o == null || prof > 5) return;
      var t = typeof o;
      if (t === 'string' || t === 'number') {
        var s = String(o), sn = sinAc(s);
        for (var i = 0; i < faltan.length; i++) {
          var pos = sn.indexOf(faltan[i]);
          if (pos >= 0) {
            var ini = Math.max(0, pos - 30), fin = Math.min(s.length, pos + faltan[i].length + 40);
            hallado = { campo: ETIQ[clave] || clave || 'datos', texto: (ini > 0 ? '…' : '') + s.slice(ini, fin) + (fin < s.length ? '…' : '') };
            return;
          }
        }
        return;
      }
      if (t !== 'object') return;
      if (Array.isArray(o)) { for (var j = 0; j < o.length; j++) rec(o[j], clave, prof + 1); }
      else for (var k in o) { if (!Object.prototype.hasOwnProperty.call(o, k) || EXCLUIR.test(k)) continue; rec(o[k], (k === 'texto' || k === 'nombre') && clave && ETIQ[clave] ? clave : k, prof + 1); }
    })(obj, '', 0);
    return hallado;
  }
  // Resaltar lo buscado (sin importar acentos) dentro del texto original
  function resaltar(s, palabras){
    s = String(s == null ? '' : s);
    if (!s) return '';
    var norm = '', mapa = [];
    for (var i = 0; i < s.length; i++) { var n = sinAc(s.charAt(i)); for (var j = 0; j < n.length; j++) { norm += n.charAt(j); mapa.push(i); } }
    var marca = new Array(s.length);
    palabras.forEach(function(p){
      if (!p) return;
      var desde = 0, pos;
      while ((pos = norm.indexOf(p, desde)) >= 0) { for (var k = pos; k < pos + p.length; k++) marca[mapa[k]] = true; desde = pos + p.length; }
    });
    var out = '', dentro = false;
    for (var x = 0; x < s.length; x++) {
      if (marca[x] && !dentro) { out += '<mark class="lex-gs-mk">'; dentro = true; }
      if (!marca[x] && dentro) { out += '</mark>'; dentro = false; }
      out += e(s.charAt(x));
    }
    if (dentro) out += '</mark>';
    return out;
  }
  // Colores de cada sección (etiqueta de la izquierda)
  var COLOR = {
    recibo:['#E1F5EE','#085041'], directorio:['#EEEDFE','#3C3489'], carpeta:['#FAECE7','#712B13'], escritura:['#E6F1FB','#0C447C'],
    juicio:['#FBEAF0','#72243E'], pendiente:['#FAEEDA','#633806'], anterior:['#F1EFE8','#444441'], adeudo:['#FAEEDA','#633806'],
    cotizacion:['#EEEDFE','#3C3489'], cita:['#E1F5EE','#085041'], gestion:['#F1EFE8','#444441'], movimiento:['#EAF3DE','#27500A'], tarea:['#E6F1FB','#0C447C'] };
  function tono(txt){
    var t = sinAc(txt);
    if (/liquidad|resuelt|ya es recibo|conclu|lista|entregad|cobrad|pagad|▲|^completad/.test(t)) return ['#EAF3DE','#27500A'];
    if (/cancel|no procedi|▼|vencid/.test(t)) return ['#FCEBEB','#791F1F'];
    if (/pendiente|debe|espera|activo/.test(t)) return ['#FAEEDA','#633806'];
    if (/proceso|tramite/.test(t)) return ['#E6F1FB','#0C447C'];
    return ['#F1EFE8','#444441'];
  }
  var EST_ESC = { proceso:'En proceso', listo:'Lista', archivado:'Archivado', cancelado:'Cancelado', noprocedio:'No procedió', espera:'En espera' };
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
          badge: x.estado ? { txt:EST_ESC[x.estado] || x.estado } : null,
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
        var total = 0, debe = 0; arr(a.conceptos).forEach(function(c){ var m = Number(c && c.monto || 0); total += m; if (!(c && c.cobrado)) debe += m; });
        return { titulo: a.cliente || '—', sub: arr(a.conceptos).map(function(c){ return c && c.descripcion; }).filter(Boolean).slice(0, 2).join(' · ') + (total ? ' · total $' + $m(total) : ''),
          badge: (a.estado !== 'cobrado' && debe > 0) ? { txt:'Debe $' + $m(debe) } : (a.estado ? { txt:a.estado === 'cobrado' ? 'Cobrado' : a.estado } : null),
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
    res.classList.add('lex-gs-a');
    ajustarAncho(res);
    if (!total) {
      res.innerHTML = '<div class="lex-gs-vacio">Sin resultados para «' + e(q) + '»</div>';
      res.classList.add('show');
      return;
    }
    // Encabezado: total y cuántos hay en cada sección
    var html = '<div class="lex-gs-head"><b>' + total + ' resultado' + (total === 1 ? '' : 's') + '</b> en ' + grupos.length + ' secci' + (grupos.length === 1 ? 'ón' : 'ones') + ': '
      + grupos.map(function(g){ return '<span>' + e(g.f.titulo.replace(/^\S+\s/, '')) + ' ' + g.hallados.length + '</span>'; }).join(' · ') + '</div>';
    grupos.forEach(function(g){
      var f = g.f, col = COLOR[f.clave] || ['#F1EFE8', '#444441'];
      var nombreSec = f.titulo.replace(/^\S+\s/, '');
      g.hallados.slice(0, MAX_POR_GRUPO).forEach(function(x){
        var it; try { it = f.item(x); } catch(err){ return; }
        if (!it.accion) { it.accion = (function(f2){ return function(){ irSeccion(f2.panel, f2.input, q); }; })(f); }
        var i = acc.length; acc.push(it.accion);
        var badge = '';
        if (it.badge && it.badge.txt) { var tb = tono(it.badge.txt); badge = ' <span class="lex-gs-badge" style="background:' + tb[0] + ';color:' + tb[1] + ';">' + e(it.badge.txt) + '</span>'; }
        var donde = null; try { donde = dondeAparece(x, palabras, it.titulo + ' ' + (it.sub || '')); } catch(_){}
        html += '<div class="lex-gs-row" onclick="lexGsIr(' + i + ')">'
          + '<span class="lex-gs-sec" style="background:' + col[0] + ';color:' + col[1] + ';">' + e(nombreSec) + '</span>'
          + '<div class="lex-gs-main"><div class="lex-gs-tit">' + resaltar(it.titulo, palabras) + badge + '</div>'
          + (it.sub ? '<div class="lex-gs-sub">' + resaltar(it.sub, palabras) + '</div>' : '')
          + (donde ? '<div class="lex-gs-donde">Aparece en ' + e(donde.campo) + ': «' + resaltar(donde.texto, palabras) + '»</div>' : '')
          + '</div><span class="lex-gs-abrir">Abrir ›</span></div>';
      });
      if (g.hallados.length > MAX_POR_GRUPO) {
        var i2 = acc.length;
        acc.push((function(f2){ return function(){ irSeccion(f2.panel, f2.input, q); }; })(f));
        html += '<div class="lex-gs-mas" onclick="lexGsIr(' + i2 + ')">Ver los ' + g.hallados.length + ' de ' + e(nombreSec) + ' →</div>';
      }
    });
    window._lexGsAcc = acc;
    res.innerHTML = html;
    res.classList.add('show');
  }
  // Más ancho: casi todo lo que queda a la derecha del buscador
  function ajustarAncho(res){
    try {
      var r = (res.parentElement || res).getBoundingClientRect();
      var w = Math.min(1000, Math.max(r.width, window.innerWidth - r.left - 24));
      res.style.width = w + 'px'; res.style.right = 'auto';
    } catch(_){}
  }
  var st = document.createElement('style');
  st.textContent = ''
    + '#global-search-results.lex-gs-a{background:#fdfaf4;border:1.5px solid #d4b870;box-shadow:0 14px 40px rgba(60,40,10,0.28);max-height:72vh;border-radius:12px;color:#2a1a06;}'
    + '.lex-gs-head{padding:10px 16px;font-size:0.74rem;color:#7a6440;border-bottom:1px solid #eee2c4;background:#f8f1de;position:sticky;top:0;z-index:1;}'
    + '.lex-gs-head b{color:#4a2f08;font-weight:700;}'
    + '.lex-gs-row{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid #eee2c4;cursor:pointer;transition:background .12s;}'
    + '.lex-gs-row:hover{background:#fbf2d8;}'
    + '.lex-gs-sec{flex-shrink:0;min-width:118px;text-align:center;font-size:0.7rem;font-weight:700;padding:4px 10px;border-radius:12px;white-space:nowrap;}'
    + '.lex-gs-main{flex:1;min-width:0;}'
    + '.lex-gs-tit{font-size:0.9rem;font-weight:600;color:#1a0f02;line-height:1.35;}'
    + '.lex-gs-sub{font-size:0.76rem;color:#6a5434;margin-top:2px;line-height:1.35;}'
    + '.lex-gs-donde{font-size:0.74rem;color:#8c6518;margin-top:3px;font-style:italic;}'
    + '.lex-gs-badge{display:inline-block;font-size:0.68rem;font-weight:700;padding:2px 9px;border-radius:10px;margin-left:6px;vertical-align:1px;white-space:nowrap;}'
    + '.lex-gs-abrir{flex-shrink:0;font-size:0.76rem;font-weight:700;color:#8c6518;}'
    + '.lex-gs-row:hover .lex-gs-abrir{color:#c8952a;}'
    + '.lex-gs-mas{padding:8px 16px;text-align:right;font-size:0.76rem;font-weight:700;color:#8c6518;cursor:pointer;border-bottom:1px solid #eee2c4;background:#faf5e8;}'
    + '.lex-gs-mas:hover{background:#fbf2d8;}'
    + 'mark.lex-gs-mk{background:#fae4a8;color:#1a0f02;padding:0 1px;border-radius:3px;}'
    + '.lex-gs-vacio{padding:22px 16px;text-align:center;font-size:0.82rem;color:#7a6440;}';
  (document.head || document.documentElement).appendChild(st);
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
      if (q.charAt(0) === '?') {
        try { var r0 = document.getElementById('global-search-results'); if (r0) { r0.classList.remove('lex-gs-a'); r0.style.width = ''; r0.style.right = ''; } } catch(_){}
        if (typeof previo === 'function') return previo(q); return;
      }
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
