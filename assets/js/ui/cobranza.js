// ── Panel de Cobranza (oct-2026) ─────────────────────────────────────────
// Saldos pendientes por antigüedad y generador del texto de recordatorio.
// NO abre enlaces ni envía nada: solo arma el mensaje para copiarlo y
// pegarlo en WhatsApp (o donde se quiera). Botón junto a "Monitor".
(function(){
  'use strict';
  var GRUPOS = [
    { id:'g180', txt:'Más de 180 días', min:181, max:1e9, fondo:'#fcebeb', color:'#a32d2d' },
    { id:'g90',  txt:'91 a 180 días',   min:91,  max:180, fondo:'#fdf0dc', color:'#9a5a10' },
    { id:'g30',  txt:'31 a 90 días',    min:31,  max:90,  fondo:'#fbf6d6', color:'#7a6a10' },
    { id:'g0',   txt:'0 a 30 días',     min:0,   max:30,  fondo:'#eaf3de', color:'#3b6d11' }
  ];
  var filtro = null, busca = '', seleccionado = null;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function dinero(n){ return '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
  function oracion(s){ s = String(s || '').trim().toLowerCase(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  function titulo(s){ return String(s || '').trim().toLowerCase().replace(/(^|\s)(\S)/g, function(m, a, b){ return a + b.toUpperCase(); }); }
  function norm(s){ return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function hoyLocal(){ var d = new Date(); d.setHours(0,0,0,0); return d; }
  function diasDesde(fecha){
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha || ''));
    if (!m) return 0;
    var f = new Date(+m[1], +m[2] - 1, +m[3]);
    return Math.max(0, Math.round((hoyLocal() - f) / 86400000));
  }

  // Folios con saldo: versión más reciente (A, B, C…) de cada folio, sin cancelados
  function datosCobranza(){
    var recibos = (typeof appData !== 'undefined' && appData && Array.isArray(appData.recibos)) ? appData.recibos : [];
    var ult = {};
    recibos.forEach(function(r){
      if (!r || r.folio == null || r.esComplemento) return;
      var k = String(r.folio), l = String(r.letra || 'A').toUpperCase();
      if (!ult[k] || l > String(ult[k].letra || 'A').toUpperCase()) ult[k] = r;
    });
    var lista = [];
    Object.keys(ult).forEach(function(k){
      var r = ult[k];
      if (r.cancelado) return;
      var saldo = Number(r.saldoPendiente) || 0;
      if (saldo <= 0.005) return;
      var c0 = (Array.isArray(r.clientes) && r.clientes[0]) || {};
      var concepto = (Array.isArray(r.conceptos) && r.conceptos[0] && r.conceptos[0].concepto) || r.tramites || 'su trámite';
      var fecha = r.fechaActualizacion || r.fecha_recibo || r.fecha || '';
      lista.push({
        folio: r.folio, letra: String(r.letra || 'A').toUpperCase(),
        nombre: String(r.nombre || c0.nombre || '').trim(),
        tel: String(c0.movil || c0.tel || '').trim(),
        concepto: String(concepto).trim(), saldo: saldo, fecha: fecha, dias: diasDesde(fecha)
      });
    });
    lista.sort(function(a, b){ return b.dias - a.dias; });
    return lista;
  }
  function grupoDe(d){ for (var i = 0; i < GRUPOS.length; i++) if (d >= GRUPOS[i].min && d <= GRUPOS[i].max) return GRUPOS[i]; return GRUPOS[3]; }

  // Nombre del trámite tal como está en el recibo, sin repetir "Trámite de…"
  function nombreTramite(c){
    var t = String(c || '').trim().replace(/\s+/g, ' ');
    var sin = t.replace(/^tr[aá]mite\s+(de\s+|del\s+)?/i, '').trim();
    return (sin || t).toUpperCase();
  }
  function mensaje(x){
    return 'Buen día, ' + titulo(x.nombre) + '.\n\n'
      + 'Le saludamos de LEX-MÉXICO Despacho Jurídico. Le recordamos que su trámite «'
      + nombreTramite(x.concepto) + '» (folio ' + x.folio + ') tiene un saldo pendiente de ' + dinero(x.saldo) + '.\n\n'
      + 'Puede pasar a liquidarlo a nuestra oficina en Calle Miguel Hidalgo esq. México No. 200, Local B, Col. Centro, Santiago Juxtlahuaca, Oaxaca, o comunicarse al 953 128 7511.\n\n'
      + '¡Gracias por su preferencia!';
  }

  function copiar(texto, boton){
    function hecho(ok){
      if (!boton) return;
      var orig = boton.getAttribute('data-txt') || boton.textContent;
      boton.setAttribute('data-txt', orig);
      boton.textContent = ok ? '✓ Copiado' : 'Selecciona y copia';
      setTimeout(function(){ boton.textContent = orig; }, 1600);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function(){ hecho(true); }, function(){ hecho(respaldo()); });
        return;
      }
    } catch(e){}
    hecho(respaldo());
    function respaldo(){
      try {
        var ta = document.createElement('textarea'); ta.value = texto;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy'); ta.remove(); return ok;
      } catch(e){ return false; }
    }
  }

  function render(){
    var ov = document.getElementById('overlay-cobranza'); if (!ov) return;
    var todos = datosCobranza();
    var total = todos.reduce(function(s, x){ return s + x.saldo; }, 0);
    ov.querySelector('#cob-total').textContent = dinero(total) + ' · ' + todos.length + ' folios';
    ov.querySelector('#cob-cards').innerHTML = GRUPOS.map(function(g, i){
      var rs = todos.filter(function(x){ return x.dias >= g.min && x.dias <= g.max; });
      var on = filtro === i;
      return '<div class="cob-card" data-i="' + i + '" style="cursor:pointer;background:#fff;border:' + (on ? '2px solid #9a6e18' : '1px solid #e2d3a8') + ';border-top:3px solid ' + g.color + ';border-radius:8px;padding:9px 11px;">'
        + '<div style="font-size:0.68rem;color:#7a6a4a;">' + g.txt + '</div>'
        + '<div style="font-size:1.05rem;font-weight:700;color:' + g.color + ';">' + dinero(rs.reduce(function(s, x){ return s + x.saldo; }, 0)) + '</div>'
        + '<div style="font-size:0.66rem;color:#7a6a4a;">' + rs.length + ' folios' + (on ? ' · filtrando' : '') + '</div></div>';
    }).join('');
    ov.querySelectorAll('.cob-card').forEach(function(c){
      c.onclick = function(){ var i = +c.getAttribute('data-i'); filtro = (filtro === i ? null : i); render(); };
    });
    var q = norm(busca);
    var lista = todos.filter(function(x){
      if (filtro !== null && !(x.dias >= GRUPOS[filtro].min && x.dias <= GRUPOS[filtro].max)) return false;
      if (q && norm(x.nombre + ' ' + x.folio + ' ' + x.concepto + ' ' + x.tel).indexOf(q) < 0) return false;
      return true;
    });
    ov.querySelector('#cob-lista').innerHTML = lista.length ? lista.map(function(x){
      var g = grupoDe(x.dias), sel = seleccionado === String(x.folio);
      return '<div class="cob-row" data-f="' + esc(x.folio) + '" style="display:grid;grid-template-columns:52px minmax(0,1fr) 110px 78px 132px;gap:10px;align-items:center;padding:8px 10px;background:' + (sel ? '#fff8e4' : '#fff') + ';border:1px solid ' + (sel ? '#c8951a' : '#eadfbf') + ';border-radius:7px;margin-bottom:6px;font-size:0.8rem;">'
        + '<span style="color:#9a6e18;font-weight:700;">#' + esc(x.folio) + esc(x.letra) + '</span>'
        + '<div style="min-width:0;"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(x.nombre || '(sin nombre)') + '</div>'
        + '<div style="font-size:0.7rem;color:#7a6a4a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(oracion(x.concepto)) + ' · ' + (x.tel ? esc(x.tel) : '<span style="color:#a32d2d;">sin teléfono</span>') + '</div></div>'
        + '<span style="text-align:right;font-weight:700;color:#a32d2d;">' + dinero(x.saldo) + '</span>'
        + '<span style="font-size:0.68rem;padding:3px 6px;border-radius:10px;text-align:center;background:' + g.fondo + ';color:' + g.color + ';">' + x.dias + ' días</span>'
        + '<button type="button" class="cob-gen" data-f="' + esc(x.folio) + '" style="background:#1a1008;color:#e8c875;border:1px solid #c8951a;border-radius:6px;padding:6px 8px;font-size:0.68rem;letter-spacing:0.04em;cursor:pointer;">✉ Generar mensaje</button>'
        + '</div>';
    }).join('') : '<div style="text-align:center;color:#7a6a4a;padding:30px;font-size:0.82rem;">No hay folios con saldo en este filtro.</div>';
    ov.querySelectorAll('.cob-gen').forEach(function(b){
      b.onclick = function(){ seleccionado = b.getAttribute('data-f'); render(); pintarMensaje(todos); };
    });
    pintarMensaje(todos);
  }

  function pintarMensaje(todos){
    var ov = document.getElementById('overlay-cobranza'); if (!ov) return;
    var box = ov.querySelector('#cob-msg');
    var x = (todos || datosCobranza()).filter(function(y){ return String(y.folio) === seleccionado; })[0];
    if (!x) {
      box.innerHTML = '<div style="color:#7a6a4a;font-size:0.8rem;text-align:center;padding:26px 10px;line-height:1.6;">Pulsa <b>✉ Generar mensaje</b> en un cliente.<br>Aquí aparecerá el texto listo para copiar y pegar en WhatsApp.</div>';
      return;
    }
    box.innerHTML =
      '<div style="font-size:0.68rem;color:#9a6e18;letter-spacing:0.08em;font-family:\'DM Mono\',monospace;margin-bottom:6px;">MENSAJE PARA ' + esc(x.nombre) + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:0.78rem;">'
      +   '<span>📱 ' + (x.tel ? '<b>' + esc(x.tel) + '</b>' : '<span style="color:#a32d2d;">Sin teléfono registrado</span>') + '</span>'
      +   (x.tel ? '<button type="button" id="cob-cop-tel" style="background:#fff;border:1px solid #c8951a;color:#7a4a00;border-radius:5px;padding:3px 8px;font-size:0.68rem;cursor:pointer;">Copiar número</button>' : '')
      + '</div>'
      + '<textarea id="cob-texto" rows="9" style="width:100%;box-sizing:border-box;border:1px solid #d9c38a;border-radius:7px;padding:10px;font-size:0.82rem;line-height:1.5;color:#2a1c08;background:#fffef8;resize:vertical;font-family:Helvetica,Arial,sans-serif;"></textarea>'
      + '<div style="font-size:0.66rem;color:#7a6a4a;margin:4px 0 8px;">Puedes editar el texto antes de copiarlo.</div>'
      + '<button type="button" id="cob-copiar" style="width:100%;background:#2e7d32;color:#fff;border:none;border-radius:7px;padding:10px;font-size:0.8rem;font-weight:600;cursor:pointer;letter-spacing:0.04em;">📋 Copiar mensaje</button>';
    var ta = box.querySelector('#cob-texto'); ta.value = mensaje(x);
    box.querySelector('#cob-copiar').onclick = function(){ copiar(ta.value, this); };
    var bt = box.querySelector('#cob-cop-tel'); if (bt) bt.onclick = function(){ copiar(x.tel, this); };
  }

  window.abrirCobranza = function(){
    var ov = document.getElementById('overlay-cobranza');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'overlay-cobranza';
      ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:9600;align-items:center;justify-content:center;font-family:Helvetica,Arial,sans-serif;';
      ov.innerHTML =
        '<div style="background:#fbf6ea;border:2px solid #c8951a;border-radius:12px;width:97%;max-width:1180px;max-height:92vh;box-shadow:0 24px 60px rgba(0,0,0,0.6);overflow:hidden;display:flex;flex-direction:column;color:#2a1c08;">'
        + '<div style="background:#1a1008;padding:14px 20px;display:flex;align-items:center;gap:10px;flex-shrink:0;">'
        +   '<span style="font-size:1.3rem;">💰</span>'
        +   '<div style="flex:1;"><div style="font-family:serif;font-size:1.05rem;color:#e8c875;">Cobranza · saldos pendientes</div>'
        +   '<div style="font-size:0.62rem;color:rgba(232,200,117,0.65);font-family:monospace;letter-spacing:0.08em;">TOTAL POR COBRAR: <span id="cob-total"></span></div></div>'
        +   '<button type="button" onclick="cerrarCobranza()" style="background:none;border:none;color:rgba(232,200,117,0.7);font-size:1.4rem;cursor:pointer;line-height:1;" aria-label="Cerrar">✕</button>'
        + '</div>'
        + '<div style="padding:14px 18px 0;flex-shrink:0;">'
        +   '<div id="cob-cards" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;"></div>'
        +   '<input id="cob-busca" type="text" placeholder="🔍 Buscar por nombre, folio, trámite o teléfono" style="width:100%;box-sizing:border-box;margin:10px 0;border:1px solid #d9c38a;border-radius:20px;padding:8px 14px;font-size:0.8rem;background:#fff;">'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:minmax(0,1.65fr) minmax(0,1fr);gap:14px;padding:0 18px 16px;flex:1;min-height:0;">'
        +   '<div id="cob-lista" style="overflow-y:auto;min-height:0;padding-right:4px;"></div>'
        +   '<div id="cob-msg" style="background:#fff;border:1px solid #e2d3a8;border-radius:10px;padding:12px;overflow-y:auto;align-self:start;"></div>'
        + '</div>'
        + '</div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function(ev){ if (ev.target === ov) window.cerrarCobranza(); });
      ov.querySelector('#cob-busca').addEventListener('input', function(){ busca = this.value; render(); });
    }
    ov.style.display = 'flex';
    render();
  };
  window.cerrarCobranza = function(){
    var ov = document.getElementById('overlay-cobranza');
    if (ov) ov.style.display = 'none';
  };
  // Para pruebas
  window._cobranzaDatos = datosCobranza;
  window._cobranzaMensaje = mensaje;
})();
