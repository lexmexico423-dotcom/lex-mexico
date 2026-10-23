// ── Oct-2026 · CONTROL DE COTIZACIONES (nuevo formato, opción A) ─────────
// Antes: un solo campo de "Honorarios" + "Gastos registrados" → la hoja salía
// encasillada como honorarios aunque fueran tenencias, derechos, bajas, etc.
// Ahora cada cotización tiene:
//   tipo (placas / escrituras / juicio / sucesión / otro)
//   concepto  = "Cotización de:" (el trámite)
//   conceptos = [{ concepto, importe }]  → el total se suma solo
// Pantallas: 1) lista  2) formulario  3) cotización armada (como la hoja PDF)
// Las cotizaciones anteriores se muestran convertidas al vuelo (honorarios y
// gastos pasan a renglones) y se guardan en el formato nuevo al editarlas.
// Campos que se conservan para compatibilidad: honorarios (= total), gastos [].
(function(){
  'use strict';
  if (window._lexCotizacionesV2) return;
  window._lexCotizacionesV2 = true;

  var TIPOS = [['placas','Placas'],['escrituras','Escrituras'],['juicio','Juicio'],['sucesion','Sucesión'],['otro','Otro']];
  var MESES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var _filtroTipo = 'todas', _vista = { modo: 'lista', id: null };

  function E(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function N(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
  function r2(n){ return Math.round((parseFloat(String(n == null ? '' : n).replace(/[^0-9.\-]/g, '')) || 0) * 100) / 100; }
  function $m(n){ return '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function hoyISO(){ try { if (typeof _prHoy === 'function') return _prHoy(); } catch(e){} var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fLarga(iso){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? (+m[3]) + ' de ' + MESES_L[+m[2] - 1] + ' de ' + m[1] : ''; }
  function usuario(){ try { if (typeof empleadoActual !== 'undefined' && empleadoActual) return empleadoActual.nombre || empleadoActual.email || ''; } catch(e){} return ''; }
  function toastS(m, t){ try { if (typeof toast === 'function') toast(m, t); } catch(e){} }
  function todas(){ try { return (typeof _prGetAll === 'function') ? _prGetAll() : (D.preRecibos || []); } catch(e){ return []; } }
  function porId(id){ return todas().filter(function(p){ return p && p.id === id; })[0] || null; }
  function wrap(){ return document.getElementById('pr-panel-contenido'); }
  function tocar(pr){ if (typeof _prTocar === 'function') _prTocar(pr); else pr.fechaMod = Date.now(); }
  function guardar(){ try { if (typeof _prGuardar === 'function') _prGuardar(); else if (typeof save === 'function') save(); } catch(e){ console.warn('[Cotizaciones] guardar', e); } }

  // ── Datos ──────────────────────────────────────────────────────────────
  function tipoDe(pr){
    if (pr && pr.tipo) return pr.tipo;
    var t = N(pr && pr.concepto);
    if (/PLACA/.test(t)) return 'placas';
    if (/ESCRITUR|COMPRAVENTA|DONACION/.test(t)) return 'escrituras';
    if (/SUCESI|INTESTAM|TESTAMENT/.test(t)) return 'sucesion';
    if (/JUICIO|DIVORC|DEMANDA|AMPARO/.test(t)) return 'juicio';
    return 'otro';
  }
  // Color de cada tipo de trámite (chip, avatar y filtros)
  var COLOR_TIPO = {
    placas:     { c: '#185fa5', bg: '#e6f1fb', bd: '#85b7eb' },
    escrituras: { c: '#0f6e56', bg: '#e1f5ee', bd: '#5dcaa5' },
    juicio:     { c: '#534ab7', bg: '#eeedfe', bd: '#afa9ec' },
    sucesion:   { c: '#993c1d', bg: '#faece7', bd: '#f0997b' },
    otro:       { c: '#5f5e5a', bg: '#f1efe8', bd: '#b4b2a9' }
  };
  function colorTipo(t){ return COLOR_TIPO[t] || COLOR_TIPO.otro; }
  function chipTipo(t, extra){ var k = colorTipo(t); return 'display:inline-block;font-size:0.66rem;padding:2px 10px;border-radius:999px;border:1px solid ' + k.bd + ';background:' + k.bg + ';color:' + k.c + ';font-weight:600;' + (extra || ''); }
  function etiquetaTipo(t){ for (var i = 0; i < TIPOS.length; i++) if (TIPOS[i][0] === t) return TIPOS[i][1]; return 'Otro'; }
  // Renglones de la cotización (las de formato anterior se convierten al vuelo)
  function conceptosDe(pr){
    if (!pr) return [];
    if (Array.isArray(pr.conceptos)) return pr.conceptos.filter(function(c){ return c && (String(c.concepto || '').trim() || r2(c.importe)); });
    var filas = [];
    if (r2(pr.honorarios) > 0) filas.push({ concepto: 'Honorarios', importe: r2(pr.honorarios) });
    (pr.gastos || []).forEach(function(g){
      if (!g) return;
      var txt = String(g.concepto || 'Gasto') + (g.descripcion ? ' — ' + g.descripcion : '');
      filas.push({ concepto: txt, importe: r2(g.monto) });
    });
    return filas;
  }
  function totalDe(pr){ return r2(conceptosDe(pr).reduce(function(s, c){ return s + r2(c.importe); }, 0)); }
  function diasDe(pr){ var t = new Date(String(pr.fechaInicio || '') + 'T12:00:00').getTime(); return isNaN(t) ? 0 : Math.max(0, Math.floor((Date.now() - t) / 86400000)); }
  function semaforo(pr){
    var d = diasDe(pr);
    if (d >= 15) return { c: '#c0161a', bg: '#fff0f0', bd: '#efb3b3', txt: d + ' días sin anticipo' };
    if (d >= 7)  return { c: '#9a6010', bg: '#fff8e8', bd: '#e9c98a', txt: d + ' días sin anticipo' };
    return { c: '#6b6455', bg: '#f4f1ea', bd: '#d6d0c2', txt: d === 0 ? 'Hoy' : (d === 1 ? 'Ayer' : 'Hace ' + d + ' días') };
  }
  window._lexCotTotal = totalDe;
  window._lexCotConceptos = conceptosDe;

  // ── Estilos comunes ────────────────────────────────────────────────────
  var MONO = "font-family:'JetBrains Mono',monospace;";
  var LBL = 'font-size:0.6rem;color:var(--muted);display:block;margin-bottom:3px;' + MONO + 'text-transform:uppercase;letter-spacing:0.08em;';
  var INP = 'width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.78rem;background:var(--surface2);color:var(--ink);';
  var CHIP = 'display:inline-block;font-size:0.66rem;padding:2px 10px;border-radius:999px;border:1px solid var(--border-l);background:var(--surface);color:var(--muted);';
  var CHIP_ON = 'display:inline-block;font-size:0.66rem;padding:2px 10px;border-radius:999px;border:1px solid var(--gold);background:rgba(200,149,42,0.18);color:var(--gold-d);';
  function btn(extra){ return 'padding:8px 14px;border-radius:6px;font-size:0.68rem;font-weight:700;cursor:pointer;' + MONO + 'letter-spacing:0.08em;text-transform:uppercase;background:none;' + (extra || ''); }
  function botonHeader(){ var b = document.getElementById('pr-btn-generar'); if (b) b.textContent = '＋ Nueva Cotización'; }

  // ═══ 1) LISTA ══════════════════════════════════════════════════════════
  window._prRenderLista = function(){
    _vista = { modo: 'lista', id: null };
    botonHeader();
    var el = wrap();
    var badge = document.getElementById('pr-badge-count');
    var activas = todas().filter(function(p){ return p && !p.convertido && !p.eliminado; });
    if (badge) badge.textContent = activas.length + (activas.length === 1 ? ' pendiente' : ' pendientes');
    if (!el) return;
    if (!activas.length) {
      el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:0.78rem;line-height:1.8;">Sin cotizaciones activas.<br>Usa <strong>＋ Nueva Cotización</strong> para comenzar.</div>';
      return;
    }
    var qEl = document.getElementById('prQ'), q = qEl ? N(qEl.value) : '';
    var cuenta = { todas: activas.length };
    activas.forEach(function(p){ var t = tipoDe(p); cuenta[t] = (cuenta[t] || 0) + 1; });
    var chips = [['todas','Todas']].concat(TIPOS).map(function(t){
      var n = cuenta[t[0]] || 0;
      var on = _filtroTipo === t[0], k = colorTipo(t[0]);
      var est = t[0] === 'todas' ? (on ? CHIP_ON : CHIP) : (on ? chipTipo(t[0]) : CHIP);
      var punto = t[0] === 'todas' ? '' : '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + k.c + ';margin-right:5px;vertical-align:1px;"></span>';
      return '<span role="button" onclick="_lexCotFiltro(\'' + t[0] + '\')" style="cursor:pointer;' + est + '">' + punto + t[1] + (n ? ' ' + n : '') + '</span>';
    }).join('');
    var lista = activas.filter(function(p){
      if (_filtroTipo !== 'todas' && tipoDe(p) !== _filtroTipo) return false;
      if (q && N([p.nombre, p.concepto, p.telefono].join(' ')).indexOf(q) < 0) return false;
      return true;
    }).sort(function(a, b){ return String(a.fechaInicio || '').localeCompare(String(b.fechaInicio || '')); });
    var tarjetas = lista.map(function(pr){
      var s = semaforo(pr), n = conceptosDe(pr).length, tp = tipoDe(pr), k = colorTipo(tp);
      var ini = (pr.nombre || '?').trim().split(/\s+/).slice(0, 2).map(function(w){ return w[0] || ''; }).join('').toUpperCase() || '?';
      return '<div onclick="_prAbrirFormulario(\'' + pr.id + '\')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border-l);border-radius:8px;margin-bottom:8px;cursor:pointer;background:var(--surface);" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--border-l)\'">'
        + '<div style="width:38px;height:38px;border-radius:50%;background:' + k.bg + ';color:' + k.c + ';border:1.5px solid ' + k.bd + ';display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;flex-shrink:0;">' + E(ini) + '</div>'
        + '<div style="flex:1;min-width:0;">'
        +   '<div style="font-size:0.84rem;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + E(pr.nombre || '(sin nombre)') + '</div>'
        +   '<div style="font-size:0.74rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><span style="color:#8c4a12;font-weight:600;">' + E(pr.concepto || '—') + '</span><span style="color:var(--muted);"> · ' + n + (n === 1 ? ' concepto' : ' conceptos') + '</span></div>'
        +   '<div style="display:flex;gap:5px;margin-top:5px;flex-wrap:wrap;"><span style="' + chipTipo(tp) + '">' + etiquetaTipo(tp) + '</span>'
        +   '<span style="' + CHIP + 'color:' + s.c + ';border-color:' + s.bd + ';">' + s.txt + '</span></div>'
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0;"><div style="font-size:0.86rem;font-weight:700;color:var(--gold-d);' + MONO + '">' + $m(totalDe(pr)) + '</div><div style="font-size:0.55rem;color:var(--muted);' + MONO + 'text-transform:uppercase;letter-spacing:0.08em;">Total</div></div>'
        + '<button onclick="event.stopPropagation();_prConvertirARecibo(\'' + pr.id + '\')" title="Convertir en recibo oficial" style="' + btn('border:1.5px solid #2a7a3a;color:#2a7a3a;padding:7px 14px;') + '">Cobrar</button>'
        + '</div>';
    }).join('');
    el.innerHTML = '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:14px;">' + chips
      + '<span style="flex:1"></span><input id="prQ" type="search" placeholder="🔍 Buscar cliente…" value="' + E(qEl ? qEl.value : '') + '" oninput="_prRenderListaQ()" style="' + INP + 'width:200px;padding:5px 10px;border-radius:999px;font-size:0.72rem;"></div>'
      + (tarjetas || '<div style="text-align:center;padding:30px;color:var(--muted);font-size:0.75rem;">Ninguna cotización coincide.</div>');
  };
  window._prRenderListaQ = function(){
    var qEl = document.getElementById('prQ'), pos = qEl ? qEl.selectionStart : 0;
    window._prRenderLista();
    var n = document.getElementById('prQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch(e){} }
  };
  window._lexCotFiltro = function(t){ _filtroTipo = t; window._prRenderLista(); };
  window._prVolverLista = function(){ window._prRenderLista(); };

  // ═══ 2) FORMULARIO ═════════════════════════════════════════════════════
  function filaHtml(c, i){
    return '<div class="cot-fila" style="display:grid;grid-template-columns:22px 1fr 130px 26px;gap:6px;align-items:center;margin-bottom:6px;">'
      + '<span class="cot-num" style="font-size:0.7rem;color:var(--muted);text-align:center;">' + (i + 1) + '</span>'
      + '<input class="cot-c" type="text" value="' + E(c.concepto || '') + '" placeholder="Concepto (ej. Trámite de baja)" style="' + INP + '">'
      + '<input class="cot-i" type="text" inputmode="decimal" value="' + (r2(c.importe) ? r2(c.importe).toFixed(2) : '') + '" placeholder="0.00" oninput="_lexCotTotalVivo()" onfocus="this.select()" style="' + INP + 'text-align:right;' + MONO + '">'
      + '<button type="button" onclick="_lexCotQuitarFila(this)" title="Quitar renglón" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.9rem;">✕</button>'
      + '</div>';
  }
  function renumerar(){ document.querySelectorAll('#cot-filas .cot-num').forEach(function(s, i){ s.textContent = i + 1; }); }
  window._lexCotAgregarFila = function(){
    var cont = document.getElementById('cot-filas'); if (!cont) return;
    cont.insertAdjacentHTML('beforeend', filaHtml({}, cont.children.length));
    var ult = cont.lastElementChild.querySelector('.cot-c'); if (ult) ult.focus();
  };
  window._lexCotQuitarFila = function(b){
    var cont = document.getElementById('cot-filas'); if (!cont) return;
    var fila = b.closest('.cot-fila');
    if (cont.children.length <= 1) { fila.querySelectorAll('input').forEach(function(i){ i.value = ''; }); }
    else fila.remove();
    renumerar(); window._lexCotTotalVivo();
  };
  window._lexCotTotalVivo = function(){
    var t = 0; document.querySelectorAll('#cot-filas .cot-i').forEach(function(i){ t += r2(i.value); });
    var el = document.getElementById('cot-total'); if (el) el.textContent = $m(r2(t));
  };
  window._lexCotTipo = function(t){
    var h = document.getElementById('pr-f-tipo'); if (h) h.value = t;
    document.querySelectorAll('#cot-tipos [data-t]').forEach(function(s){ var dt = s.getAttribute('data-t'); s.setAttribute('style', 'cursor:pointer;' + (dt === t ? chipTipo(dt) : CHIP) + 'font-size:0.72rem;padding:4px 12px;'); });
  };

  function abrirEditor(id){
    var esNuevo = !id;
    var pr = esNuevo ? { id: 'PR-' + Date.now(), nombre: '', telefono: '', concepto: '', fechaInicio: hoyISO(), notas: '', tipo: '' } : porId(id);
    if (!pr) return;
    _vista = { modo: 'editar', id: pr.id };
    botonHeader();
    var el = wrap(); if (!el) return;
    var tipo = esNuevo ? '' : tipoDe(pr);
    var filas = conceptosDe(pr); if (!filas.length) filas = [{}];
    var tiposHtml = TIPOS.map(function(t){ return '<span role="button" data-t="' + t[0] + '" onclick="_lexCotTipo(\'' + t[0] + '\')" style="cursor:pointer;' + (tipo === t[0] ? chipTipo(t[0]) : CHIP) + 'font-size:0.72rem;padding:4px 12px;">' + t[1] + '</span>'; }).join('');
    el.innerHTML = ''
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">'
      +   '<button onclick="' + (esNuevo ? '_prVolverLista()' : '_prAbrirFormulario(\'' + pr.id + '\')') + '" style="font-size:0.68rem;padding:4px 10px;border:1px solid var(--border-l);border-radius:5px;background:none;color:var(--muted);cursor:pointer;">← Volver</button>'
      +   '<span style="font-size:0.84rem;font-weight:700;color:var(--ink);">' + (esNuevo ? 'Nueva cotización' : 'Editar cotización') + '</span>'
      +   '<span style="font-size:0.62rem;color:var(--muted);">· ' + E(fLarga(pr.fechaInicio)) + '</span>'
      + '</div>'
      + '<label style="' + LBL + '">Tipo de trámite *</label>'
      + '<input type="hidden" id="pr-f-tipo" value="' + E(tipo) + '">'
      + '<div id="cot-tipos" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">' + tiposHtml + '</div>'
      + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:10px;">'
      +   '<div><label style="' + LBL + '">Nombre del cliente *</label><input id="pr-f-nombre" type="text" value="' + E(pr.nombre) + '" placeholder="Nombre completo" style="' + INP + '"></div>'
      +   '<div><label style="' + LBL + '">Teléfono</label><input id="pr-f-tel" type="tel" inputmode="numeric" value="' + E(pr.telefono) + '" placeholder="000-000-0000" oninput="if(typeof formatTelefono===\'function\')formatTelefono(this)" style="' + INP + '"></div>'
      + '</div>'
      + '<label style="' + LBL + '">Cotización de *</label>'
      + '<input id="pr-f-concepto" type="text" value="' + E(pr.concepto) + '" placeholder="Ej. Trámite de placas Edo. Méx." style="' + INP + 'margin-bottom:14px;">'
      + '<div style="display:grid;grid-template-columns:22px 1fr 130px 26px;gap:6px;margin-bottom:4px;"><span style="' + LBL + 'text-align:center;">#</span><span style="' + LBL + '">Concepto</span><span style="' + LBL + 'text-align:right;">Importe</span><span></span></div>'
      + '<div id="cot-filas">' + filas.map(filaHtml).join('') + '</div>'
      + '<div style="margin:4px 0 0 28px;"><button type="button" onclick="_lexCotAgregarFila()" style="font-size:0.68rem;padding:4px 12px;border:1px dashed var(--gold);border-radius:999px;background:none;color:var(--gold-d);cursor:pointer;">＋ Agregar concepto</button></div>'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1.5px solid var(--gold);margin-top:10px;padding-top:8px;">'
      +   '<span style="' + MONO + 'font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--ink);font-weight:700;">Total</span>'
      +   '<span id="cot-total" style="' + MONO + 'font-size:1.1rem;font-weight:700;color:var(--gold-d);">$0.00</span>'
      + '</div>'
      + '<label style="' + LBL + 'margin-top:14px;">Notas internas (no aparecen en la cotización)</label>'
      + '<textarea id="pr-f-notas" rows="3" placeholder="Agrega una nota para uso interno, no se imprime" style="' + INP + 'resize:vertical;font-family:sans-serif;">' + E(pr.notas || '') + '</textarea>'
      + '<div id="cot-err" style="color:var(--rojo);font-size:0.72rem;min-height:16px;margin-top:6px;"></div>'
      + '<div style="display:flex;gap:8px;margin-top:4px;">'
      +   '<button onclick="_prGuardarFormulario(\'' + pr.id + '\',' + esNuevo + ')" style="' + btn('flex:1;border:1.5px solid var(--gold);background:rgba(200,149,42,0.12);color:var(--gold-d);padding:10px;') + '">💾 Guardar cotización</button>'
      +   '<button onclick="' + (esNuevo ? '_prVolverLista()' : '_prAbrirFormulario(\'' + pr.id + '\')') + '" style="' + btn('border:1px solid var(--border-l);color:var(--muted);') + '">Cancelar</button>'
      + '</div>';
    // Enter en el importe del último renglón → renglón nuevo
    var cont = document.getElementById('cot-filas');
    cont.addEventListener('keydown', function(e){
      if (e.key !== 'Enter') return;
      var t = e.target; if (!t || !t.classList) return;
      e.preventDefault();
      if (t.classList.contains('cot-c')) { var imp = t.closest('.cot-fila').querySelector('.cot-i'); if (imp) imp.focus(); return; }
      if (t.classList.contains('cot-i') && t.closest('.cot-fila') === cont.lastElementChild) window._lexCotAgregarFila();
    });
    window._lexCotTotalVivo();
    if (esNuevo) setTimeout(function(){ var n = document.getElementById('pr-f-nombre'); if (n) n.focus(); }, 30);
  }
  window._prNuevo = function(){ abrirEditor(null); };
  window._lexCotEditar = function(id){ abrirEditor(id); };

  window._prGuardarFormulario = function(prId, esNuevo, opts){
    opts = opts || {};
    var val = function(id){ return ((document.getElementById(id) || {}).value || ''); };
    var err = function(m, foco){
      var e = document.getElementById('cot-err'); if (e) e.textContent = '⚠ ' + m;
      toastS('⚠ ' + m, 'err');
      if (foco) { try { foco.style.borderColor = 'var(--rojo)'; foco.focus(); setTimeout(function(){ foco.style.borderColor = ''; }, 2500); } catch(x){} }
      return null;
    };
    var tipo = val('pr-f-tipo');
    var nombre = val('pr-f-nombre').trim(), tel = val('pr-f-tel').trim(), concepto = val('pr-f-concepto').trim(), notas = val('pr-f-notas').trim();
    if (!tipo) return err('Elige el tipo de trámite', document.getElementById('cot-tipos'));
    if (!nombre) return err('El nombre del cliente es obligatorio', document.getElementById('pr-f-nombre'));
    if (!concepto) return err('Escribe de qué es la cotización', document.getElementById('pr-f-concepto'));
    var filas = [], malo = null;
    document.querySelectorAll('#cot-filas .cot-fila').forEach(function(f){
      if (malo) return;
      var cI = f.querySelector('.cot-c'), iI = f.querySelector('.cot-i');
      var c = (cI.value || '').trim(), txt = (iI.value || '').trim(), imp = r2(txt);
      if (!c && !txt) return;
      if (!c) { malo = ['Falta el concepto del importe ' + $m(imp), cI]; return; }
      if (txt && (isNaN(parseFloat(txt.replace(/[^0-9.\-]/g, ''))) || imp < 0)) { malo = ['Importe no válido en «' + c + '»', iI]; return; }
      filas.push({ concepto: c, importe: imp });
    });
    if (malo) return err(malo[0], malo[1]);
    if (!filas.length) return err('Agrega al menos un concepto', document.querySelector('#cot-filas .cot-c'));

    if (!Array.isArray(D.preRecibos)) D.preRecibos = [];
    var pr = porId(prId);
    if (!pr) { pr = { id: prId, fechaInicio: hoyISO(), convertido: false, creadoPor: usuario() }; D.preRecibos.push(pr); }
    pr.formato = 2; pr.tipo = tipo;
    pr.nombre = nombre; pr.telefono = tel; pr.concepto = concepto; pr.notas = notas;
    pr.conceptos = filas;
    pr.honorarios = r2(filas.reduce(function(s, f){ return s + f.importe; }, 0)); // compatibilidad (= total)
    pr.gastos = [];                                                                 // ya van dentro de conceptos
    if (!pr.estado) pr.estado = 'iniciado';
    pr.eliminado = false;
    tocar(pr); guardar();
    if (!opts.silencioso) toastS('✓ Cotización guardada', 'ok');
    if (!opts.quedarse) verFicha(pr.id);
    return pr;
  };

  // ═══ 3) COTIZACIÓN ARMADA (se ve como la hoja) ═════════════════════════
  function verFicha(id){
    var pr = porId(id); if (!pr) { window._prRenderLista(); return; }
    _vista = { modo: 'ficha', id: id };
    botonHeader();
    var el = wrap(); if (!el) return;
    var s = semaforo(pr), filas = conceptosDe(pr), total = totalDe(pr);
    var filasHtml = filas.map(function(c){
      return '<tr><td style="padding:7px 4px;border-bottom:1px solid #ece3cd;">' + E(c.concepto) + '</td><td style="padding:7px 4px;border-bottom:1px solid #ece3cd;text-align:right;white-space:nowrap;' + MONO + '">' + $m(c.importe) + '</td></tr>';
    }).join('') || '<tr><td colspan="2" style="padding:10px;text-align:center;color:#999;">Sin conceptos — usa Editar para agregarlos</td></tr>';
    el.innerHTML = ''
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;">'
      +   '<button onclick="_prVolverLista()" style="font-size:0.68rem;padding:4px 10px;border:1px solid var(--border-l);border-radius:5px;background:none;color:var(--muted);cursor:pointer;">← Volver</button>'
      +   '<span style="' + chipTipo(tipoDe(pr)) + '">' + etiquetaTipo(tipoDe(pr)) + '</span>'
      +   '<span style="' + CHIP + 'color:' + s.c + ';border-color:' + s.bd + ';">' + s.txt + '</span>'
      +   (pr.convertido ? '<span style="' + CHIP + 'color:#2a7a3a;border-color:#2a7a3a;">✓ Ya es recibo' + (pr.folioRecibo ? ' · folio ' + E(pr.folioRecibo) : '') + '</span>' : '')
      +   '<span style="flex:1"></span>'
      +   '<button onclick="_lexCotEditar(\'' + pr.id + '\')" style="font-size:0.68rem;padding:5px 12px;border:1px solid var(--border-l);border-radius:5px;background:none;color:var(--ink);cursor:pointer;">✏ Editar</button>'
      +   '<button onclick="_prEliminar(\'' + pr.id + '\')" title="Eliminar cotización" style="font-size:0.72rem;padding:5px 10px;border:1px solid rgba(192,22,26,0.3);border-radius:5px;background:none;color:var(--rojo);cursor:pointer;">🗑</button>'
      + '</div>'
      // Hoja
      + '<div style="max-width:620px;margin:0 auto;background:#fff;color:#1a1008;border:1px solid #d9cdb0;border-radius:10px;padding:22px 26px;">'
      +   '<div style="text-align:center;font-family:Georgia,\'Times New Roman\',serif;font-size:1.35rem;color:#8c6518;">Cotización</div>'
      +   '<div style="text-align:center;font-size:0.72rem;color:#7d725c;margin-bottom:14px;">LEX-MÉXICO · Despacho jurídico · ' + E(fLarga(pr.fechaInicio)) + '</div>'
      +   '<div style="font-size:0.84rem;line-height:1.65;">'
      +     '<div><b>Cliente:</b> ' + E(pr.nombre) + '</div>'
      +     (pr.telefono ? '<div><b>Teléfono:</b> ' + E(pr.telefono) + '</div>' : '')
      +     '<div><b>Tipo de trámite:</b> <span style="color:' + colorTipo(tipoDe(pr)).c + ';font-weight:600;">' + etiquetaTipo(tipoDe(pr)) + '</span></div>'
      +     '<div><b>Cotización de:</b> <span style="color:#8c4a12;font-weight:600;">' + E(pr.concepto || '—') + '</span></div>'
      +   '</div>'
      +   '<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:0.82rem;">'
      +     '<tr><td style="padding:6px 4px;border-bottom:1.5px solid #d9cdb0;color:#8c6518;">Concepto</td><td style="padding:6px 4px;border-bottom:1.5px solid #d9cdb0;color:#8c6518;text-align:right;' + MONO + '">Importe</td></tr>'
      +     filasHtml
      +     '<tr><td style="padding:9px 4px;font-weight:700;">Total</td><td style="padding:9px 4px;text-align:right;font-weight:700;font-size:0.95rem;' + MONO + '">' + $m(total) + '</td></tr>'
      +   '</table>'
      +   '<div style="font-size:0.68rem;color:#8a7f6a;border-top:1px solid #ece3cd;padding-top:8px;margin-top:4px;">Precios sujetos a cambio por parte de las dependencias.</div>'
      + '</div>'
      // Paso previo al recibo
      + '<div style="max-width:620px;margin:14px auto 0;">'
      +   '<div style="font-size:0.7rem;color:var(--muted);text-align:center;margin-bottom:10px;">Paso previo al recibo: al convertirla, estos conceptos pasan al recibo oficial y se le asigna folio.</div>'
      +   '<div style="display:grid;grid-template-columns:1fr 1.4fr;gap:10px;">'
      +     '<button onclick="_prImprimirEstadoCuenta(\'' + pr.id + '\')" style="' + btn('border:1.5px solid var(--gold);color:var(--gold-d);padding:11px;') + '">📄 Ver PDF / Imprimir</button>'
      +     (pr.convertido ? '<div style="text-align:center;padding:11px;font-size:0.72rem;color:#2a7a3a;border:1px solid #2a7a3a;border-radius:6px;">✓ Ya se cobró' + (pr.folioRecibo ? ' — folio ' + E(pr.folioRecibo) : '') + '</div>'
                         : '<button onclick="_prConvertirARecibo(\'' + pr.id + '\')" style="' + btn('border:1.5px solid #2a7a3a;background:rgba(42,122,58,0.08);color:#2a7a3a;padding:11px;') + '">✓ Convertir a recibo</button>')
      +   '</div>'
      +   (pr.notas ? '<div style="margin-top:14px;padding:10px 12px;border:1px dashed var(--border-l);border-radius:6px;"><div style="' + LBL + '">Notas internas · no se imprimen</div><div style="font-size:0.74rem;color:var(--ink);white-space:pre-wrap;">' + E(pr.notas) + '</div></div>' : '')
      +   '<div style="font-size:0.62rem;color:var(--muted);text-align:center;margin-top:10px;">' + (pr.creadoPor ? 'Capturada por ' + E(pr.creadoPor) : '') + '</div>'
      + '</div>';
  }
  // Abrir una cotización existente = verla armada; sin id = nueva
  window._prAbrirFormulario = function(id){ if (!id) abrirEditor(null); else verFicha(id); };
  window._lexCotFicha = verFicha;

  // ═══ PDF ═══════════════════════════════════════════════════════════════
  // Las fuentes del PDF solo traen letras latinas (WinAnsi): se cambian o quitan
  // los caracteres que saldrían como basura (emojis, signo menos, etc.)
  var WIN = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  function limpio(t){
    return String(t == null ? '' : t)
      .replace(/[−‐‑]/g, '-').replace(/[   ]/g, ' ').replace(/\t/g, ' ')
      .replace(/[^\n\x20-\x7e¡-ÿ]/g, function(c){ return WIN.indexOf(c) >= 0 ? c : ''; })
      .replace(/ {2,}/g, ' ').trim();
  }
  function pdfCotizacion(pr){
    var J = window.jspdf && window.jspdf.jsPDF; if (!J) throw new Error('jsPDF no disponible');
    var doc = new J({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14, y = 14;
    var nombre = limpio(pr.nombre).toUpperCase(), BAJO = H - 22;
    try { doc.setProperties({ title: 'Cotización ' + nombre, subject: limpio(pr.concepto), creator: 'LEX-MÉXICO' }); } catch(e){}
    // Encabezado
    doc.setDrawColor(200, 149, 42); doc.setLineWidth(0.6); doc.roundedRect(M, y, W - 2 * M, 30, 2, 2);
    try {
      if (typeof LOGO_SRC !== 'undefined' && LOGO_SRC) {
        var ip = doc.getImageProperties(LOGO_SRC), h = 22, w = h * (ip.width / ip.height);
        if (w > 34) { w = 34; h = w * (ip.height / ip.width); }
        doc.addImage(LOGO_SRC, 'JPEG', M + 4, y + (30 - h) / 2, w, h);
      }
    } catch(e){}
    doc.setFont('times', 'bold'); doc.setFontSize(14); doc.setTextColor(140, 101, 24);
    doc.text('LEX-MÉXICO · DESPACHO JURÍDICO', W / 2, y + 9, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90, 74, 48);
    doc.text(doc.splitTextToSize('CALLE MIGUEL HIDALGO ESQ. MÉXICO NO. 200, LOCAL B, COL. CENTRO · SANTIAGO JUXTLAHUACA, OAXACA · Tel. 953 128 7511', W - 2 * M - 90), W / 2, y + 14, { align: 'center' });
    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(140, 101, 24);
    doc.text('COTIZACIÓN', W / 2, y + 26, { align: 'center' });
    // Casilla del folio: vacía (se asigna al cobrar)
    doc.setDrawColor(200, 149, 42); doc.setLineWidth(0.4); doc.rect(W - M - 34, y + 5, 30, 20);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(122, 84, 16); doc.text('NO. RECIBO', W - M - 19, y + 9.5, { align: 'center' });
    doc.setFont('courier', 'bold'); doc.setFontSize(12); doc.setTextColor(150, 150, 150); doc.text('— — —', W - M - 19, y + 16.5, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor(150, 130, 90); doc.text('se asigna al cobrar', W - M - 19, y + 22, { align: 'center' });
    y += 40;
    doc.setFontSize(9); doc.setTextColor(60, 50, 30);
    doc.text('Fecha: ' + fLarga(pr.fechaInicio || hoyISO()), W - M, y, { align: 'right' });
    y += 6;
    var dato = function(et, v, color){
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 16, 8); doc.text(et, M, y);
      doc.setFont('helvetica', 'normal'); if (color) doc.setTextColor.apply(doc, color);
      var lin = doc.splitTextToSize(limpio(v) || '—', W - 2 * M - 38); doc.text(lin, M + 38, y);
      y += Math.max(1, lin.length) * 5 + 1;
    };
    dato('Cliente:', nombre);
    if (pr.telefono) dato('Teléfono:', pr.telefono);
    dato('Tipo de trámite:', etiquetaTipo(tipoDe(pr)));
    dato('Cotización de:', pr.concepto, [140, 74, 18]);
    y += 4;
    var cabecera = function(cont){
      doc.setFillColor(245, 236, 214); doc.rect(M, y - 4.5, W - 2 * M, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(122, 84, 16);
      doc.text(cont ? 'CONCEPTO (continuación)' : 'CONCEPTO', M + 2, y); doc.text('IMPORTE', W - M - 2, y, { align: 'right' });
      y += 8;
    };
    var nuevaHoja = function(){ doc.addPage(); y = 22; cabecera(true); };
    cabecera(false);
    var filas = conceptosDe(pr);
    if (!filas.length) filas = [{ concepto: 'Sin conceptos capturados', importe: 0 }];
    filas.forEach(function(c){
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      var lin = doc.splitTextToSize(limpio(c.concepto) || '—', W - 2 * M - 50);
      if (y + lin.length * 5 > BAJO) nuevaHoja();
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(26, 16, 8);
      doc.text(lin, M + 2, y); doc.text($m(c.importe), W - M - 2, y, { align: 'right' });
      y += lin.length * 5 + 1.5;
      doc.setDrawColor(230, 220, 195); doc.setLineWidth(0.2); doc.line(M, y - 3, W - M, y - 3);
      y += 2;
    });
    if (y + 28 > BAJO) { doc.addPage(); y = 24; } // solo el total pasa a la hoja siguiente (sin encabezado vacío)
    doc.setDrawColor(200, 149, 42); doc.setLineWidth(0.6); doc.line(M, y - 2, W - M, y - 2);
    y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 16, 8);
    doc.text('TOTAL', M + 2, y); doc.text($m(totalDe(pr)), W - M - 2, y, { align: 'right' });
    y += 12;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(122, 106, 74);
    doc.text(doc.splitTextToSize('Precios sujetos a cambio por parte de las dependencias. Esta cotización no es un recibo: el recibo oficial con folio se emite al recibir el pago.', W - 2 * M), M, y);
    // Marca de agua y pie en TODAS las hojas
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      try { if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.08 })); } catch(e){}
      doc.setFont('times', 'bold'); doc.setFontSize(44); doc.setTextColor(140, 101, 24);
      var txt = 'COTIZACIÓN', tw = doc.getTextWidth(txt), ang = 28 * Math.PI / 180;
      doc.text(txt, W / 2 - (tw / 2) * Math.cos(ang), H * 0.5 + (tw / 2) * Math.sin(ang), { angle: 28 });
      try { if (doc.GState) doc.setGState(new doc.GState({ opacity: 1 })); } catch(e){}
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(150, 140, 120);
      doc.text('Cotización · ' + nombre.slice(0, 60), M, H - 10);
      if (n > 1) doc.text('Hoja ' + i + ' de ' + n, W - M, H - 10, { align: 'right' });
    }
    doc.setPage(n);
    return doc;
  }
  function verPDF(doc, titulo){
    var url; try { url = URL.createObjectURL(doc.output('blob')); } catch(e){ toastS('No se pudo generar el PDF', 'err'); return; }
    var viejo = document.getElementById('lex-cot-pdf'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-cot-pdf';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(10,7,3,0.82);display:flex;flex-direction:column;padding:14px;gap:8px;font-family:Helvetica,Arial,sans-serif;';
    ov.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;color:#e8c875;font-size:0.8rem;"><span>📄 ' + E(titulo) + ' <span style="color:#c8b68a;font-size:0.7rem;">(cotización · no es recibo oficial)</span></span>'
      + '<span style="display:flex;gap:8px;"><a id="cot-down" style="background:#2a7a3a;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;text-decoration:none;font-size:0.8rem;">⬇ Descargar</a><button type="button" id="cot-print" style="background:#9a6e18;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;">🖨 Imprimir</button><button type="button" id="cot-x" style="background:#fff;color:#7a5410;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;">✕ Cerrar</button></span></div>'
      + '<iframe id="cot-frame" src="' + url + '" style="flex:1;width:100%;border:none;border-radius:6px;background:#fff;"></iframe>';
    document.body.appendChild(ov);
    var dn = ov.querySelector('#cot-down'); dn.href = url; dn.download = (limpio(titulo).replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'Cotizacion') + '.pdf';
    ov.querySelector('#cot-x').onclick = function(){ ov.remove(); try { URL.revokeObjectURL(url); } catch(e){} };
    ov.querySelector('#cot-print').onclick = function(){ try { ov.querySelector('#cot-frame').contentWindow.print(); } catch(e){ window.open(url, '_blank'); } };
  }
  window._lexCotPdf = pdfCotizacion;
  window._prImprimirEstadoCuenta = function(prId){
    var pr = document.getElementById('pr-f-nombre') ? window._prGuardarFormulario(prId, true, { silencioso: true, quedarse: true }) : porId(prId);
    if (!pr) return;
    try { verPDF(pdfCotizacion(pr), 'Cotización — ' + (pr.nombre || '')); }
    catch(e){ console.warn('[Cotizaciones] PDF', e); toastS('No se pudo generar el PDF', 'err'); }
  };

  // ═══ Convertir a recibo (paso previo → recibo real) ════════════════════
  window._prConvertirARecibo = function(prId){
    var pr = document.getElementById('pr-f-nombre') ? window._prGuardarFormulario(prId, true, { silencioso: true, quedarse: true }) : porId(prId);
    if (!pr) return;
    if (pr.convertido) { toastS('Esta cotización ya se cobró' + (pr.folioRecibo ? ' (folio ' + pr.folioRecibo + ')' : ''), 'err'); return; }
    var filas = conceptosDe(pr);
    if (typeof ir === 'function') ir('nuevo-recibo');
    setTimeout(function(){
      try {
        // Se marca "convertido" SOLO al generar el recibo (ver guardarRecibo)
        window._prDatosParaRecibo = pr;
        var elNombre = document.querySelector('#clientes-wrapper .cliente-row [id^="nombre_"]');
        if (elNombre) { elNombre.value = String(pr.nombre || '').toUpperCase(); elNombre.dispatchEvent(new Event('input')); }
        var elMovil = document.querySelector('#clientes-wrapper .cliente-row [id^="movil_"]');
        if (elMovil && pr.telefono) elMovil.value = pr.telefono;
        var tbody = document.getElementById('conceptos-tbody');
        if (tbody) {
          tbody.innerHTML = '';
          if (typeof conceptoCount !== 'undefined') conceptoCount = 0;
          var lista = filas.length ? filas : [{ concepto: pr.concepto || '', importe: 0 }];
          lista.forEach(function(f){
            if (typeof agregarConcepto === 'function') agregarConcepto();
            var tr = tbody.lastElementChild; if (!tr) return;
            var taC = tr.querySelector('textarea.concepto'); if (taC) taC.value = f.concepto;
            var taD = tr.querySelector('textarea.descripcion'); if (taD) taD.value = '';
            var inP = tr.querySelector('input.precio');
            if (inP) { inP.value = r2(f.importe) > 0 ? String(r2(f.importe)) : ''; if (typeof formatPrecio === 'function') try { formatPrecio(inP); } catch(e){} }
          });
          if (typeof calcTotales === 'function') calcTotales();
        }
        toastS('✓ Cotización pasada al recibo — revisa, captura el anticipo y genera', 'ok');
      } catch(e){ console.warn('[Cotizaciones] convertir', e); }
    }, 700);
  };

  // Gastos sueltos (formato anterior): ya no se usan en pantalla
  window._prRenderGastos = function(){};
  window._prActualizarTotalesForm = function(){ if (document.getElementById('cot-total')) window._lexCotTotalVivo(); };

  // Repintar cuando llegan cambios de otra computadora (sin tocar el formulario)
  window._lexCotPintar = function(){
    var p = document.getElementById('panel-pre-recibo');
    if (!p || !p.classList.contains('active')) return;
    if (_vista.modo === 'lista') { if (document.activeElement && document.activeElement.id === 'prQ') window._prRenderListaQ(); else window._prRenderLista(); }
    else if (_vista.modo === 'ficha') verFicha(_vista.id);
  };
})();
