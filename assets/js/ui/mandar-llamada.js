// ── Oct-2026 · 📞 MANDAR LLAMADA desde Pendientes y Escrituras ──────────
// Solo el ADMINISTRADOR ve el icono. Al pulsarlo se abre un cuadro para
// elegir a quién llamar, para cuándo y la indicación de qué hablar con el
// cliente; al enviar se crea una tarea en "Tareas para hoy" para la empleada.
(function(){
  'use strict';
  if (window.lexBtnLlamada) return;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function esAdmin(){ try { return typeof _pendEsAdminGlobal === 'function' && _pendEsAdminGlobal(); } catch(e){ return false; } }
  function norm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function hoyStr(off){
    var d = new Date(); d.setDate(d.getDate() + (off || 0));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function fCorta(iso){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? (+m[3]) + '-' + MESES[+m[2] - 1] : ''; }
  function quien(){
    try { if (typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.nombre) return empleadoActual.nombre; } catch(e){}
    return (typeof NOMBRE_TITULAR !== 'undefined') ? NOMBRE_TITULAR : '';
  }
  function lista(k){ try { return (typeof D !== 'undefined' && D && Array.isArray(D[k])) ? D[k] : []; } catch(e){ return []; } }
  function tareas(){ try { if (!Array.isArray(D.tareasHoy)) D.tareasHoy = []; return D.tareasHoy; } catch(e){ return []; } }

  // ── Origen (pendiente, escritura, juicio, cita o folio) ────────────────────────────────────
  function buscarOrigen(tipo, id){
    if (tipo === 'pend') return lista('pendientes').filter(function(p){ return p && String(p.id) === String(id); })[0] || null;
    if (tipo === 'esc')  return lista('escrituras').filter(function(e){ return e && String(e.id) === String(id); })[0] || null;
    if (tipo === 'jui')  return lista('juicios').filter(function(j){ return j && String(j.id) === String(id); })[0] || null;
    if (tipo === 'cita') return lista('citas').filter(function(c){ return c && String(c.id) === String(id); })[0] || null;
    if (tipo === 'folio') {
      // Versión más reciente (letra mayor) del folio
      var recs = []; try { recs = (typeof appData !== 'undefined' && appData && Array.isArray(appData.recibos)) ? appData.recibos : []; } catch(e){}
      var ult = null;
      recs.forEach(function(r){
        if (!r || r.esComplemento || String(r.folio) !== String(id)) return;
        if (!ult || String(r.letra || 'A').toUpperCase() > String(ult.letra || 'A').toUpperCase()) ult = r;
      });
      return ult;
    }
    return null;
  }
  function nombreDe(p){ return typeof p === 'string' ? p : ((p && p.nombre) || ''); }
  function foliosRecibo(o){
    var fs = [];
    [o.reciboVinculadoFolio, o.folioRecibo].forEach(function(f){ if (f != null && f !== '') fs.push(String(f).replace(/[^0-9]/g, '')); });
    (Array.isArray(o.foliosRecibo) ? o.foliosRecibo : []).forEach(function(f){ fs.push(String(f && f.folio != null ? f.folio : f).replace(/[^0-9]/g, '')); });
    return fs.filter(Boolean);
  }
  // Teléfono: 1) del recibo vinculado (misma persona), 2) del directorio
  function telDe(nombre, o){
    var n = norm(nombre); if (!n) return '';
    var recs = []; try { recs = (typeof appData !== 'undefined' && appData && Array.isArray(appData.recibos)) ? appData.recibos : []; } catch(e){}
    var fs = foliosRecibo(o);
    for (var i = recs.length - 1; i >= 0; i--) {
      var r = recs[i]; if (!r || fs.indexOf(String(r.folio)) < 0) continue;
      var cs = Array.isArray(r.clientes) ? r.clientes : [];
      for (var j = 0; j < cs.length; j++) if (cs[j] && norm(cs[j].nombre) === n && (cs[j].movil || cs[j].tel)) return String(cs[j].movil || cs[j].tel).trim();
    }
    // Cualquier recibo donde aparezca la misma persona (el más reciente)
    for (var i2 = recs.length - 1; i2 >= 0; i2--) {
      var r2 = recs[i2]; if (!r2) continue;
      var cs2 = Array.isArray(r2.clientes) ? r2.clientes : [];
      for (var j2 = 0; j2 < cs2.length; j2++) if (cs2[j2] && norm(cs2[j2].nombre) === n && (cs2[j2].movil || cs2[j2].tel)) return String(cs2[j2].movil || cs2[j2].tel).trim();
    }
    var dir = lista('directorio');
    // 1º nombre exacto; 2º nombre con UNA letra distinta (ej. VELVERDE / VALVERDE)
    for (var pasada = 0; pasada < 2; pasada++) {
      for (var k = 0; k < dir.length; k++) {
        var d = dir[k]; if (!d) continue;
        var dn = norm(d.nombre);
        if (pasada === 0 ? dn !== n : !(n.length >= 10 && casiIgual(dn, n))) continue;
        var t = d.tel || d.telefono || d.tel2; if (t) return String(t).trim();
      }
    }
    return '';
  }
  function casiIgual(a, b){
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, dif = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++dif > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
    }
    return dif + (a.length - i) + (b.length - j) <= 1;
  }
  function personasDe(tipo, o){
    var ns = [];
    if (tipo === 'pend') { ns = [o.persona, o.juiCliente]; }
    else if (tipo === 'jui' || tipo === 'cita') { ns = [o.cliente]; }
    else if (tipo === 'folio') {
      // Personas del recibo, con su propio teléfono
      var vf = {}, outF = [];
      (Array.isArray(o.clientes) ? o.clientes : []).concat(o.nombre ? [{ nombre: o.nombre }] : []).forEach(function(c){
        var nm = String((c && c.nombre) || '').trim(), k = norm(nm); if (!k || vf[k]) return; vf[k] = 1;
        var t = String((c && (c.movil || c.tel)) || '').trim();
        outF.push({ nombre: nm, tel: t || telDe(nm, o) });
      });
      return outF;
    }
    else { ns = (o.compradores || []).map(nombreDe).concat((o.vendedores || []).map(nombreDe)); }
    var vistos = {}, out = [];
    ns.forEach(function(nm, i){
      nm = String(nm || '').trim(); var k = norm(nm); if (!k || vistos[k]) return; vistos[k] = 1;
      // En juicios el teléfono del cliente viene en el propio expediente
      var propio = (tipo === 'jui' && i === 0 && o.tel) ? String(o.tel).trim() : '';
      out.push({ nombre: nm, tel: propio || telDe(nm, o) });
    });
    return out;
  }
  function etiquetaOrigen(tipo, o){
    if (tipo === 'esc') {
      var n = String(o.num || '').replace(/^carp\.?-?\s*/i, '').trim();
      return 'ESCRITURA' + (n ? ' ' + n : '');
    }
    if (tipo === 'cita') {
      var h = String(o.hora || '').slice(0, 5);
      return 'CITA' + (o.fecha ? ' ' + fCorta(o.fecha).toUpperCase() : '') + (h ? ' ' + h : '') + (o.titulo ? ' · ' + String(o.titulo).trim().toUpperCase() : '');
    }
    if (tipo === 'folio') {
      var con = (Array.isArray(o.conceptos) && o.conceptos[0] && o.conceptos[0].concepto) || o.tramites || '';
      return 'FOLIO ' + o.folio + String(o.letra || 'A').toUpperCase() + (con ? ' · ' + String(con).trim().toUpperCase() : '');
    }
    if (tipo === 'jui') return 'JUICIO' + (o.expediente ? ' ' + String(o.expediente).trim() : '') + (o.tipo ? ' · ' + String(o.tipo).trim().toUpperCase() : '');
    var sec = { placas:'PLACAS', juicios:'JUICIO', escrituras:'ESCRITURA', registro:'REGISTRO CIVIL' }[o.seccion] || 'PENDIENTE';
    var num = o.reciboVinculadoFolio ? 'FOLIO ' + o.reciboVinculadoFolio : '';
    return sec + (num ? ' · ' + num : '');
  }
  function llamadaPendiente(tipo, id){
    return tareas().filter(function(t){ return t && t.tipo === 'llamada-cliente' && t.estado !== 'resuelta' && t.origen && t.origen.tipo === tipo && String(t.origen.id) === String(id); })[0] || null;
  }

  // ── Botón (lo pintan Pendientes y Escrituras) ─────────────────────────
  window.lexBtnLlamada = function(tipo, id, extraCss, etiqueta){
    if (!esAdmin() || id == null || id === '') return '';
    var ya = llamadaPendiente(tipo, id);
    var tit = ya ? 'Ya hay una llamada en Tareas de hoy' + (ya.fechaProgramada ? ' (' + fCorta(ya.fechaProgramada) + ')' : '') : 'Mandar llamada a Tareas de hoy';
    var st = ya ? 'background:#fdf0dc;border:1px solid #c8951a;color:#9a5a10;' : 'background:transparent;border:1px solid #c8951a;color:#9a6e18;';
    return '<button type="button" class="lex-btn-llamada" data-t="' + esc(tipo) + '" data-id="' + esc(String(id)) + '" data-et="' + esc(etiqueta || '') + '" data-css="' + esc(extraCss || '') + '" onclick="event.stopPropagation();lexAbrirLlamada(this.getAttribute(\'data-t\'),this.getAttribute(\'data-id\'),this.getAttribute(\'data-et\'))" title="' + esc(tit) + '" aria-label="' + esc(tit) + '" style="position:relative;display:inline-flex;align-items:center;justify-content:center;' + st + 'border-radius:5px;padding:3px 7px;cursor:pointer;font-size:10.5px;line-height:1;' + (extraCss || '') + '">📞'
      + (ya ? '<span style="position:absolute;top:-6px;right:-6px;background:#9a6e18;color:#fff;border-radius:50%;width:13px;height:13px;font-size:8px;display:flex;align-items:center;justify-content:center;">✓</span>' : '')
      + '</button>';
  };

  var FRASES = ['Pedir documentos: ', 'Avisarle que su trámite ya está listo para entregar.', 'Agendar cita para ', 'Citarlo para firma el día '];

  // ── Cuadro de indicaciones ────────────────────────────────────────────
  window.lexAbrirLlamada = function(tipo, id, etiqueta){
    if (!esAdmin()) return;
    var o = buscarOrigen(tipo, id);
    if (!o) { if (typeof toast === 'function') toast('No se encontró el registro', 'err'); return; }
    var ya = llamadaPendiente(tipo, id);
    if (ya && !confirm('Ya hay una llamada pendiente en Tareas de hoy para este asunto:\n\n"' + (ya.titulo || '') + '"\n\n¿Quieres mandar otra?')) return;
    var personas = personasDe(tipo, o);
    if (!personas.length) personas = [{ nombre: '', tel: '' }];
    var origenTxt = String(etiqueta || '').trim() || etiquetaOrigen(tipo, o);
    var telOpcional = (tipo === 'cita');
    var resumen = tipo === 'cita' ? String(o.lugar || '').trim() : tipo === 'folio' ? String(o.nombre || '').trim() : tipo === 'esc' ? String(o.tipo || o.tramite || '').trim() : tipo === 'jui' ? String(o.juzgado || '').trim() : String(o.texto || '').trim();
    var viejo = document.getElementById('lex-llam-ov'); if (viejo) viejo.remove();
    var ov = document.createElement('div');
    ov.id = 'lex-llam-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.55);display:flex;align-items:center;justify-content:center;padding:16px;';
    var ch = 'border:1px solid #c8951a;border-radius:14px;padding:4px 11px;font-size:0.72rem;color:#7a5410;background:#fff;cursor:pointer;';
    ov.innerHTML =
      '<div role="dialog" aria-modal="true" style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:500px;max-height:92vh;overflow-y:auto;box-shadow:0 18px 50px rgba(0,0,0,0.45);font-family:Helvetica,Arial,sans-serif;color:#2a1c08;">'
      + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-size:0.74rem;letter-spacing:0.1em;font-family:\'DM Mono\',monospace;display:flex;justify-content:space-between;align-items:center;"><span>📞 MANDAR LLAMADA A TAREAS DE HOY</span><span id="lex-llam-x" style="cursor:pointer;font-size:1rem;" title="Cerrar">✕</span></div>'
      + '<div style="padding:14px 16px;font-size:0.8rem;line-height:1.5;">'
      +   '<div style="color:#7a5410;font-size:0.72rem;font-weight:700;letter-spacing:0.04em;">' + esc(origenTxt) + '</div>'
      +   (resumen ? '<div style="font-size:0.74rem;color:#5a4a2a;margin-top:2px;">' + esc(resumen.length > 140 ? resumen.slice(0, 140) + '…' : resumen) + '</div>' : '')
      +   '<div style="margin-top:10px;font-weight:700;">¿A quién llamar?</div>'
      +   '<select id="lex-llam-persona" style="width:100%;padding:7px 8px;border:1px solid #d8c08a;border-radius:6px;background:#fff;font-size:0.8rem;">'
      +     personas.map(function(p, i){ return '<option value="' + i + '">' + esc(p.nombre || '(sin nombre)') + (p.tel ? ' · ' + esc(p.tel) : ' · sin teléfono') + '</option>'; }).join('')
      +   '</select>'
      +   '<div style="display:flex;gap:8px;margin-top:6px;">'
      +     '<input id="lex-llam-nombre" placeholder="Nombre" style="flex:1.4;min-width:0;padding:7px 8px;border:1px solid #d8c08a;border-radius:6px;background:#fff;font-size:0.8rem;">'
      +     '<input id="lex-llam-tel" placeholder="Teléfono" inputmode="tel" style="flex:1;min-width:0;padding:7px 8px;border:1px solid #d8c08a;border-radius:6px;background:#fff;font-size:0.8rem;">'
      +   '</div>'
      +   '<div style="font-size:0.68rem;color:#7a5410;margin-top:2px;">' + (telOpcional ? 'Si no aparece el teléfono, déjalo vacío: la secretaria lo buscará por su cuenta.' : 'El teléfono se toma del recibo o del directorio; se puede corregir.') + '</div>'
      +   '<div style="margin-top:10px;font-weight:700;">¿Para cuándo?</div>'
      +   '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'
      +     '<button type="button" class="lex-llam-cuando" data-c="hoy" style="' + ch + '">Hoy</button>'
      +     '<button type="button" class="lex-llam-cuando" data-c="manana" style="' + ch + '">Mañana</button>'
      +     '<button type="button" class="lex-llam-cuando" data-c="otra" style="' + ch + '">📅 Otra fecha</button>'
      +     '<input type="date" id="lex-llam-fecha" style="display:none;padding:4px 6px;border:1px solid #d8c08a;border-radius:6px;font-size:0.78rem;">'
      +   '</div>'
      +   '<div style="margin-top:10px;font-weight:700;">Indicación — qué tiene que hablar con el cliente</div>'
      +   '<textarea id="lex-llam-ind" rows="4" placeholder="Ej. Avisarle que falta la constancia de soltería de la vendedora para ingresar a Catastro." style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #c8951a;border-radius:6px;background:#fff;font-size:0.8rem;font-family:inherit;resize:vertical;"></textarea>'
      +   '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;">'
      +     ['+ Pedir documentos', '+ Ya está listo', '+ Agendar cita', '+ Firma'].map(function(t, i){ return '<button type="button" class="lex-llam-frase" data-i="' + i + '" style="' + ch + 'font-size:0.68rem;padding:3px 9px;">' + t + '</button>'; }).join('')
      +   '</div>'
      +   '<div id="lex-llam-err" style="color:#a32d2d;font-size:0.74rem;min-height:1em;margin-top:6px;"></div>'
      +   '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">'
      +     '<button type="button" id="lex-llam-cancel" style="background:#fff;border:1px solid #c8951a;color:#9a6e18;border-radius:6px;padding:7px 14px;font-size:0.74rem;cursor:pointer;">Cancelar</button>'
      +     '<button type="button" id="lex-llam-ok" style="background:#9a6e18;border:none;color:#fff;border-radius:6px;padding:7px 16px;font-size:0.74rem;letter-spacing:0.05em;font-weight:700;cursor:pointer;">ENVIAR A TAREAS</button>'
      +   '</div>'
      + '</div></div>';
    document.body.appendChild(ov);

    var $ = function(s){ return ov.querySelector(s); };
    var sel = $('#lex-llam-persona'), inN = $('#lex-llam-nombre'), inT = $('#lex-llam-tel'), inF = $('#lex-llam-fecha'), ta = $('#lex-llam-ind'), err = $('#lex-llam-err');
    var iniPersona = 0; for (var q = 0; q < personas.length; q++) if (personas[q].tel) { iniPersona = q; break; }
    sel.value = String(iniPersona);
    function ponPersona(){ var p = personas[+sel.value] || {}; inN.value = p.nombre || ''; inT.value = p.tel || ''; }
    sel.onchange = ponPersona; ponPersona();
    var cuando = 'hoy';
    function pintaCuando(){
      ov.querySelectorAll('.lex-llam-cuando').forEach(function(b){
        var on = b.getAttribute('data-c') === cuando;
        b.style.background = on ? '#9a6e18' : '#fff'; b.style.color = on ? '#fff' : '#7a5410'; b.style.borderColor = on ? '#9a6e18' : '#c8951a';
      });
      inF.style.display = cuando === 'otra' ? 'inline-block' : 'none';
    }
    ov.querySelectorAll('.lex-llam-cuando').forEach(function(b){ b.onclick = function(){ cuando = b.getAttribute('data-c'); err.textContent = ''; pintaCuando(); if (cuando === 'otra') { inF.min = hoyStr(1); try { inF.focus(); } catch(e){} } }; });
    pintaCuando();
    ov.querySelectorAll('.lex-llam-frase').forEach(function(b){ b.onclick = function(){
      var f = FRASES[+b.getAttribute('data-i')] || '';
      ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + f;
      err.textContent = ''; ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch(e){}
    }; });
    [inN, inT, ta, inF].forEach(function(el){ el.addEventListener('input', function(){ err.textContent = ''; }); });
    function cerrar(){ ov.remove(); }
    $('#lex-llam-x').onclick = cerrar; $('#lex-llam-cancel').onclick = cerrar;
    ov.onclick = function(ev){ if (ev.target === ov) cerrar(); };

    $('#lex-llam-ok').onclick = function(){
      var nombre = inN.value.trim(), tel = inT.value.trim(), ind = ta.value.trim();
      if (!nombre) { err.textContent = 'Escribe el nombre de la persona a la que se va a llamar.'; inN.focus(); return; }
      if (!tel && !telOpcional) { err.textContent = 'Falta el teléfono. Escríbelo para poder mandar la llamada.'; inT.focus(); return; }
      if (!ind) { err.textContent = 'Escribe la indicación de qué tiene que hablar con el cliente.'; ta.focus(); return; }
      var fecha = cuando === 'hoy' ? '' : cuando === 'manana' ? hoyStr(1) : inF.value;
      if (cuando === 'otra' && (!fecha || fecha <= hoyStr(0))) { err.textContent = 'Elige una fecha a partir de mañana.'; inF.focus(); return; }
      var ahora = new Date().toISOString();
      var t = {
        id: 'TH-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        tipo: 'llamada-cliente',
        titulo: '📞 LLAMAR A ' + nombre.toUpperCase() + ' (' + origenTxt + ')',
        texto: (tel ? 'Tel. ' + tel : 'Tel.: buscarlo (no está registrado)') + '\nIndicación: ' + ind + '\nEnviada por ' + quien(),
        estado: 'pendiente', fechaProgramada: fecha || '',
        creadoPor: quien(), fechaCreacion: ahora, fechaResolucion: '', fechaMod: ahora,
        origen: { tipo: tipo, id: String(id), etiqueta: origenTxt, nombre: nombre, tel: tel }
      };
      tareas().unshift(t);
      try { if (typeof save === 'function') save(); } catch(e){}
      try { if (typeof renderTareasHoyLista === 'function') renderTareasHoyLista(); } catch(e){}
      try { if (typeof renderTareasHoyCount === 'function') renderTareasHoyCount(); } catch(e){}
      try { if (tipo === 'pend' && typeof renderPend === 'function') renderPend(); } catch(e){}
      try { if (tipo === 'esc' && typeof escRender === 'function') escRender(); } catch(e){}
      try { if (tipo === 'jui' && typeof renderJuicios === 'function') renderJuicios(); } catch(e){}
      try { if (tipo === 'cita' && typeof renderCitas === 'function') renderCitas(); } catch(e){}
      // Repintar el icono donde esté (ej. Ficha del folio) para que muestre la ✓
      try {
        document.querySelectorAll('.lex-btn-llamada').forEach(function(b){
          if (b.getAttribute('data-t') !== tipo || b.getAttribute('data-id') !== String(id)) return;
          var tmp = document.createElement('div');
          tmp.innerHTML = window.lexBtnLlamada(tipo, id, b.getAttribute('data-css') || '', b.getAttribute('data-et') || '');
          if (tmp.firstChild) b.replaceWith(tmp.firstChild);
        });
      } catch(e){}
      cerrar();
      if (typeof toast === 'function') toast('📞 Llamada enviada a "Tareas para hoy"' + (fecha ? ' para el ' + fCorta(fecha) : '') + ': ' + nombre, 'ok');
    };
    setTimeout(function(){ try { ta.focus(); } catch(e){} }, 30);
  };

  window._llamadaPersonas = function(tipo, id){ var o = buscarOrigen(tipo, id); return o ? personasDe(tipo, o) : null; };
})();
