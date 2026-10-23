// ── Panel de Cobranza (oct-2026) ─────────────────────────────────────────
// Saldos pendientes por antigüedad y 7 mensajes de recordatorio escalonados.
// "Abrir en WhatsApp" abre el chat del cliente con el texto ya escrito (no
// envía nada solo: el usuario pulsa Enviar). Botón junto a "Monitor".
(function(){
  'use strict';
  var GRUPOS = [
    { id:'g180', txt:'Más de 180 días', min:181, max:1e9, fondo:'#fcebeb', color:'#a32d2d' },
    { id:'g90',  txt:'91 a 180 días',   min:91,  max:180, fondo:'#fdf0dc', color:'#9a5a10' },
    { id:'g30',  txt:'31 a 90 días',    min:31,  max:90,  fondo:'#fbf6d6', color:'#7a6a10' },
    { id:'g0',   txt:'0 a 30 días',     min:0,   max:30,  fondo:'#eaf3de', color:'#3b6d11' }
  ];
  var filtro = null, busca = '', seleccionado = null, categoria = null;
  // Oct-2026: categorías del trámite (por tipo de recibo y palabras del concepto)
  var CATEGORIAS = [
    { id:'placas',     txt:'Placas',         ico:'🚗', re:/PLACA|REPUVE|FACTURA DE ORIGEN|TARJETA DE CIRCULACION|TENENCIA|REFACTURA|VEHICUL/ },
    { id:'juicios',    txt:'Juicios',        ico:'⚖️', re:/JUICIO|DIVORCIO|PRESCRIPCION|PENSION|SUCESORIO|INTESTAMENTARIO|DILIGENCIA|DEMANDA|AMPARO|CONVENIO JUDICIAL/ },
    { id:'registro',   txt:'Registro civil', ico:'🏛️', re:/ACTA DE NACIMIENTO|ACTA DE MATRIMONIO|ACTA DE DEFUNCION|RECTIFICACION DE ACTA|REGISTRO CIVIL|CURP/ },
    { id:'escrituras', txt:'Escrituras',     ico:'📜', re:/ESCRITUR|RECTIFICACION DE MEDIDAS|COLINDANCIA|TERRENO|PREDIO|CATASTR|MEDICION|PREDIAL|IFREO/ },
    { id:'contratos',  txt:'Contratos',      ico:'📝', re:/CONTRATO|DONACION|PODER NOTARIAL|COMPRAVENTA|ARRENDAMIENTO|CESION/ },
    { id:'otros',      txt:'Otros',          ico:'📁', re:null }
  ];
  function categoriaDe(r, texto){
    var tt = String(r.tipoTramite || '').toLowerCase();
    if (tt === 'vehicular') return 'placas';
    if (tt === 'escritura') return 'escrituras';
    var t = norm(texto);
    for (var i = 0; i < CATEGORIAS.length; i++) if (CATEGORIAS[i].re && CATEGORIAS[i].re.test(t)) return CATEGORIAS[i].id;
    return 'otros';
  }

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
        personas: (Array.isArray(r.clientes) ? r.clientes : []).map(function(c){
          return { nombre: String((c && c.nombre) || '').trim(), tel: String((c && (c.movil || c.tel)) || '').trim() };
        }).filter(function(p){ return p.nombre || p.tel; }),
        concepto: String(concepto).trim(), saldo: saldo, fecha: fecha, dias: diasDesde(fecha),
        categoria: categoriaDe(r, (Array.isArray(r.conceptos) ? r.conceptos.map(function(c){ return (c && c.concepto) || ''; }).join(' ') : '') + ' ' + (r.tramites || '')),
      });
    });
    // Oct-2026: saldos de años anteriores (aún sin folio) y marca de antecedentes de papel
    try {
      if (typeof window.lexSaldosAnterioresCobranza === 'function') window.lexSaldosAnterioresCobranza().forEach(function(x){ x.dias = diasDesde(x.fecha); lista.push(x); });
      if (typeof window.lexAntecedentesDeFolio === 'function') lista.forEach(function(x){ if (!x.esAnterior) { var a = window.lexAntecedentesDeFolio(x.folio); if (a) { x.papel = a.folioPapel || ''; x.anioPapel = a.anio || ''; } } });
    } catch(e){}
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
  var FIRMA = '\n\nLEX-MÉXICO Despacho Jurídico\nCalle Miguel Hidalgo esq. México No. 200, Local B, Col. Centro, Santiago Juxtlahuaca, Oaxaca · Tel. 953 128 7511';
  var MENSAJES = [
    { et:'1 · Recordatorio amable', cuando:'Primer aviso', txt:function(n,t,f,s){ return 'Buen día, ' + n + '.\n\nLe saludamos de LEX-MÉXICO Despacho Jurídico. Le recordamos que su trámite ' + t + ' (folio ' + f + ') tiene un saldo pendiente de ' + s + '.\n\nPuede pasar a liquidarlo a nuestra oficina o comunicarse con nosotros. ¡Gracias por su preferencia!'; } },
    { et:'2 · Seguimiento', cuando:'Unos 7 días después', txt:function(n,t,f,s){ return 'Buen día, ' + n + '.\n\nLe escribimos para dar seguimiento a nuestro mensaje anterior. Su trámite ' + t + ' (folio ' + f + ') mantiene un saldo pendiente de ' + s + '.\n\nSi ya realizó el pago, le pedimos de favor nos envíe su comprobante para actualizar su expediente. Quedamos atentos.'; } },
    { et:'3 · Fecha de pago', cuando:'Unos 15 días después', txt:function(n,t,f,s){ return 'Buen día, ' + n + '.\n\nNo hemos recibido respuesta sobre el saldo de ' + s + ' de su trámite ' + t + ' (folio ' + f + ').\n\n¿Nos podría indicar en qué fecha le es posible realizar el pago? Con gusto registramos la fecha que nos indique.'; } },
    { et:'4 · Convenio de pago', cuando:'Unos 30 días después', txt:function(n,t,f,s){ return 'Buen día, ' + n + '.\n\nEntendemos que pueden surgir imprevistos. Si se le dificulta cubrir en una sola exhibición el saldo de ' + s + ' de su trámite ' + t + ' (folio ' + f + '), le ofrecemos un convenio de pagos parciales.\n\nResponda este mensaje o visítenos para acordarlo.'; } },
    { et:'5 · Aviso formal', cuando:'Unos 45 días después', txt:function(n,t,f,s){ return n + ':\n\nPor medio del presente le comunicamos formalmente que su trámite ' + t + ' (folio ' + f + ') presenta un adeudo de ' + s + ', sin que a la fecha hayamos recibido el pago ni una propuesta de convenio.\n\nLe solicitamos regularizar su situación a la brevedad.'; } },
    { et:'6 · Pausa del trámite', cuando:'Unos 60 días después', txt:function(n,t,f,s){ return n + ':\n\nLe informamos que, al persistir el adeudo de ' + s + ' de su trámite ' + t + ' (folio ' + f + '), las gestiones pendientes quedarán en pausa hasta que se regularice el pago.\n\nPara reanudarlo, comuníquese con nosotros o acuda a nuestra oficina.'; } },
    { et:'7 · Aviso final', cuando:'Último mensaje', txt:function(n,t,f,s){ return n + ':\n\nAVISO FINAL. Su trámite ' + t + ' (folio ' + f + ') mantiene un adeudo de ' + s + '. Le concedemos un plazo de 5 días hábiles a partir de este mensaje para liquidarlo o formalizar un convenio de pago.\n\nDe no recibir respuesta, el despacho procederá conforme a derecho para la recuperación del adeudo.'; } }
  ];
  var numMensaje = 0;
  function mensaje(x, i){
    var m = MENSAJES[(typeof i === 'number') ? i : numMensaje] || MENSAJES[0];
    var fTxt = x.esAnterior ? (x.folioPapel ? 'de papel ' + x.folioPapel : 'de ' + (x.anio || 'años anteriores')) : String(x.folio);
    return m.txt(titulo(x.nombre), '«' + nombreTramite(x.concepto) + '»', fTxt, dinero(x.saldo)) + FIRMA;
  }

  // ── Teléfono → número internacional para WhatsApp ──
  // México (+52) por defecto; Estados Unidos (+1) si la lada no existe en México.
  // El usuario puede cambiar el país con un clic si la detección se equivoca.
  var paisElegido = {}, personaElegida = {};
  function soloDigitos(t){ return String(t || '').replace(/\D/g, ''); }
  function paisDetectado(tel){
    var d = soloDigitos(tel);
    if (d.length === 12 && d.indexOf('52') === 0) return 'MX';
    if (d.length === 13 && d.indexOf('521') === 0) return 'MX';
    if (d.length === 11 && d.charAt(0) === '1') return 'US';
    if (d.length !== 10) return 'MX';
    if (/^(55|56|33|81)/.test(d)) return 'MX';
    if (d.charAt(0) === '5') return 'US';
    if (/^(20|21|30|40|60|70|80|90)/.test(d) || /^(220|310|910|911|912)/.test(d)) return 'US';
    return 'MX';
  }
  function numeroWhats(tel, pais){
    var d = soloDigitos(tel);
    if (d.length === 13 && d.indexOf('521') === 0) d = '52' + d.slice(3);
    if (d.length === 12 && d.indexOf('52') === 0) return d;
    if (d.length === 11 && d.charAt(0) === '1') return d;
    if (d.length !== 10) return '';
    return (pais === 'US' ? '1' : '52') + d;
  }
  function esCelular(){ return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''); }
  function abrirWhatsApp(numero, texto){
    var t = encodeURIComponent(texto || '');
    var url = esCelular()
      ? 'https://wa.me/' + numero + '?text=' + t
      : 'https://web.whatsapp.com/send?phone=' + numero + '&text=' + t;
    window.open(url, '_blank', 'noopener');
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
    var todosSinCat = datosCobranza();
    // Botones de categoría (solo las que tienen folios con saldo)
    var catsBox = ov.querySelector('#cob-cats');
    if (catsBox) {
      var chip = function(id, ico, txt, rs){
        var on = categoria === id;
        return '<button type="button" class="cob-cat" data-c="' + (id || '') + '" style="border:1px solid ' + (on ? '#9a6e18' : '#d9c38a') + ';background:' + (on ? '#1a1008' : '#fff') + ';color:' + (on ? '#e8c875' : '#5a4a30') + ';border-radius:20px;padding:5px 12px;font-size:0.74rem;cursor:pointer;white-space:nowrap;">'
          + ico + ' ' + txt + ' <b>' + rs.length + '</b></button>';
      };
      catsBox.innerHTML = chip(null, '📋', 'Todas', todosSinCat) + CATEGORIAS.map(function(c){
        var rs = todosSinCat.filter(function(x){ return x.categoria === c.id; });
        return rs.length ? chip(c.id, c.ico, c.txt, rs) : '';
      }).join('') + (function(){ var rs = todosSinCat.filter(function(x){ return x.esAnterior; }); return rs.length ? chip('anteriores', '🗂', 'Recibos anteriores', rs) : ''; })();
      catsBox.querySelectorAll('.cob-cat').forEach(function(b){
        b.onclick = function(){ var c = b.getAttribute('data-c') || null; categoria = (categoria === c ? null : c); render(); };
      });
    }
    var todos = categoria ? todosSinCat.filter(function(x){ return categoria === 'anteriores' ? x.esAnterior : x.categoria === categoria; }) : todosSinCat;
    var total = todosSinCat.reduce(function(s, x){ return s + x.saldo; }, 0);
    ov.querySelector('#cob-total').textContent = todosSinCat.length + ' folios con saldo pendiente';
    // Oct-2026: se quitaron los recuadros de antigüedad (a petición); los días siguen en cada folio
    filtro = null;
    var q = norm(busca);
    var lista = todos.filter(function(x){
      if (filtro !== null && !(x.dias >= GRUPOS[filtro].min && x.dias <= GRUPOS[filtro].max)) return false;
      if (q && norm(x.nombre + ' ' + x.folio + ' ' + x.concepto + ' ' + x.tel + ' ' + x.personas.map(function(p){ return p.nombre + ' ' + p.tel; }).join(' ')).indexOf(q) < 0) return false;
      return true;
    });
    ov.querySelector('#cob-lista').innerHTML = lista.length ? lista.map(function(x){
      var g = grupoDe(x.dias), sel = seleccionado === String(x.folio);
      var esAdm = esAdmin();
      var dest = destinoLlamada(x);
      var eb = esAdm ? estadoBoton(x, dest) : null;
      var nBit = bitacoraDe(x.folio).length;
      var ep = (x.categoria === 'placas') ? estadoPlacas(x.folio) : null;
      // Oct-2026: gastos extra (lo que pagó el despacho por el cliente) ligados al folio
      var gx = (typeof window.lexGastosFolio === 'function') ? window.lexGastosFolio(x.folio) : null;
      if (gx && !(gx.total > 0.005)) gx = null;
      return '<div class="cob-row" data-f="' + esc(x.folio) + '" style="display:grid;grid-template-columns:52px minmax(0,1fr) 110px 78px ' + '34px ' + (esAdm ? '118px ' : '') + '132px;gap:10px;align-items:center;padding:8px 10px;background:' + (sel ? '#fff8e4' : '#fff') + ';border:1px solid ' + (sel ? '#c8951a' : '#eadfbf') + ';border-radius:7px;margin-bottom:6px;font-size:0.8rem;">'
        + (x.esAnterior
            ? '<span class="cob-folio" data-sa="' + esc(x.saId) + '" title="Recibo anterior · abrir su ficha" style="color:#5f5e5a;font-weight:700;cursor:pointer;line-height:1.1;font-size:0.72rem;"><span style="display:block;font-size:0.58rem;letter-spacing:0.04em;">AÑO ' + esc(x.anio || '—') + '</span>📄 ' + esc(x.folioPapel || 'S/N') + '</span>'
            : '<span class="cob-folio" data-f="' + esc(x.folio) + '" title="Abrir la ficha del folio ' + esc(x.folio) + '" style="color:#1a4a8a;font-weight:700;cursor:pointer;text-decoration:underline;text-underline-offset:3px;">#' + esc(x.folio) + esc(x.letra) + '</span>')
        + '<div style="min-width:0;"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(x.nombre || '(sin nombre)') + '</div>'
        + '<div style="font-size:0.7rem;color:#7a6a4a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(oracion(x.concepto)) + ' · ' + (x.tel ? esc(x.tel) : '<span style="color:#a32d2d;">sin teléfono</span>') + (x.personas.length > 1 ? ' · <b style="color:#1a4a8a;">👥 ' + x.personas.length + ' personas</b>' : '') + '</div>'
        + (ep ? '<div style="margin-top:3px;"><span style="display:inline-block;font-size:0.66rem;font-weight:600;border-radius:10px;padding:1px 8px;background:' + ep.fondo + ';color:' + ep.color + ';" title="' + esc(ep.tip || '') + '">' + esc(ep.txt) + '</span></div>' : '')
        + (x.esAnterior ? '<div style="margin-top:3px;"><span style="display:inline-block;font-size:0.66rem;font-weight:600;border-radius:10px;padding:1px 8px;background:#f1efe8;color:#5f5e5a;">🗂 Recibo anterior' + (x.anio ? ' · ' + esc(x.anio) : '') + '</span> <button type="button" class="cob-sa-cobrar" data-sa="' + esc(x.saId) + '" style="font-size:0.64rem;font-weight:700;border:none;background:#c8781a;color:#fff;border-radius:10px;padding:2px 9px;cursor:pointer;">💰 Cobrar</button></div>' : '')
        + (x.papel ? '<div style="margin-top:3px;"><span title="Trámite iniciado antes del sistema" style="display:inline-block;font-size:0.66rem;font-weight:600;border-radius:10px;padding:1px 8px;background:#f1efe8;color:#5f5e5a;">📄 papel ' + esc(x.papel) + (x.anioPapel ? ' · ' + esc(x.anioPapel) : '') + '</span></div>' : '')
        + (gx ? '<div style="margin-top:3px;"><span title="Gastos extra que pagó el despacho por el cliente (fuera de lo pactado). Se cobran aparte." style="display:inline-block;font-size:0.66rem;font-weight:600;border-radius:10px;padding:1px 8px;background:#fdf0dc;color:#8a4a10;">💸 + gastos ' + dinero(gx.total) + '</span></div>' : '')
        + '</div>'
        + '<span style="text-align:right;font-weight:700;color:#a32d2d;">' + dinero(x.saldo) + '</span>'
        + '<span style="font-size:0.68rem;padding:3px 6px;border-radius:10px;text-align:center;background:' + g.fondo + ';color:' + g.color + ';">' + x.dias + ' días</span>'
        + '<button type="button" class="cob-bit" data-f="' + esc(x.folio) + '" title="Bitácora de cobranza del folio ' + esc(x.folio) + (nBit ? ' (' + nBit + ' movimientos)' : ' (sin movimientos)') + '" style="position:relative;background:#fff;border:1px solid #d9c38a;border-radius:6px;padding:5px 0;font-size:0.8rem;cursor:pointer;color:' + (nBit ? '#7a4a00' : '#c4b48a') + ';">🕑' + (nBit ? '<span style="position:absolute;top:-6px;right:-6px;background:#9a6e18;color:#fff;border-radius:9px;font-size:0.55rem;padding:1px 4px;line-height:1.2;">' + nBit + '</span>' : '') + '</button>'
        + (esAdm
            ? '<button type="button" class="cob-llamar" data-f="' + esc(x.folio) + '" ' + (eb.activo ? '' : 'disabled ') + 'title="' + esc(eb.tip) + '" style="background:' + eb.fondo + ';color:' + eb.color + ';border:' + eb.borde + ';border-radius:6px;padding:6px 4px;font-size:0.66rem;line-height:1.15;cursor:' + (eb.activo ? 'pointer' : 'not-allowed') + ';">' + esc(eb.txt) + '</button>'
            : '')
        + '<button type="button" class="cob-gen" data-f="' + esc(x.folio) + '" style="background:#1a1008;color:#e8c875;border:1px solid #c8951a;border-radius:6px;padding:6px 8px;font-size:0.68rem;letter-spacing:0.04em;cursor:pointer;">✉ Generar mensaje</button>'
        + '</div>';
    }).join('') : '<div style="text-align:center;color:#7a6a4a;padding:30px;font-size:0.82rem;">No hay folios con saldo en este filtro.</div>';
    // Clic en el folio → cierra Cobranza y abre la Ficha del Folio (misma ruta que Contabilidad)
    ov.querySelectorAll('.cob-sa-cobrar').forEach(function(b){ b.onclick = function(){ if (typeof lexCobrarSaldoAnterior === 'function') lexCobrarSaldoAnterior(b.getAttribute('data-sa')); }; });
    ov.querySelectorAll('.cob-folio').forEach(function(el){
      el.onclick = function(){
        if (el.getAttribute('data-sa')) { if (typeof lexFichaSaldoAnterior === 'function') lexFichaSaldoAnterior(el.getAttribute('data-sa')); return; }
        var n = parseInt(el.getAttribute('data-f'), 10);
        if (!n) return;
        window.cerrarCobranza();
        if (typeof abrirFichaDesdeContab === 'function') abrirFichaDesdeContab(n);
      };
    });
    // Si el cliente del mensaje ya no está en la lista filtrada, se limpia el mensaje
    if (seleccionado && !lista.some(function(x){ return String(x.folio) === seleccionado; })) seleccionado = null;
    ov.querySelectorAll('.cob-llamar').forEach(function(b){
      b.onclick = function(){
        var x = todos.filter(function(y){ return String(y.folio) === b.getAttribute('data-f'); })[0];
        if (!x) return;
        var e = estadoBoton(x, destinoLlamada(x));
        if (!e.activo) return;
        if (e.id === 'verificar' && !window.confirm('Este cliente dijo que ya pagó.\n\n¿Ya revisaste que su pago no esté registrado?\n\nAceptar = crear la tarea para llamarle de nuevo.')) return;
        crearTareaLlamada(x);
      };
    });
    ov.querySelectorAll('.cob-bit').forEach(function(b){
      b.onclick = function(){
        var x = todos.filter(function(y){ return String(y.folio) === b.getAttribute('data-f'); })[0];
        if (x) verBitacora(x);
      };
    });
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
      box.innerHTML = '<div style="color:#7a6a4a;font-size:0.8rem;text-align:center;padding:26px 10px;line-height:1.6;">Pulsa <b>✉ Generar mensaje</b> en un cliente.<br>Aquí aparecerá el mensaje listo para enviar por WhatsApp.</div>';
      return;
    }
    // Oct-2026: si el recibo tiene 2+ personas, se elige a quién va el mensaje
    var personas = x.personas.length ? x.personas : [{ nombre: x.nombre, tel: x.tel }];
    var idxP = Math.min(personaElegida[x.folio] || 0, personas.length - 1);
    var dest = { folio: x.folio, letra: x.letra, concepto: x.concepto, saldo: x.saldo, nombre: personas[idxP].nombre || x.nombre, tel: personas[idxP].tel };
    var claveP = x.folio + '|' + idxP;
    var pais = paisElegido[claveP] || paisDetectado(dest.tel);
    var numero = numeroWhats(dest.tel, pais);
    var bandera = function(p, txt){
      var on = pais === p;
      return '<button type="button" class="cob-pais" data-p="' + p + '" title="Cambiar país del teléfono" style="border:1px solid ' + (on ? '#2e7d32' : '#d9c38a') + ';background:' + (on ? '#e9f7ee' : '#fff') + ';color:' + (on ? '#1b5e20' : '#7a6a4a') + ';border-radius:5px;padding:2px 6px;font-size:0.66rem;cursor:pointer;">' + txt + '</button>';
    };
    var M = MENSAJES[numMensaje];
    box.innerHTML =
      '<div style="font-size:0.68rem;color:#9a6e18;letter-spacing:0.08em;font-family:\'DM Mono\',monospace;margin-bottom:6px;">MENSAJE PARA ' + esc(dest.nombre) + '</div>'
      + (personas.length > 1
          ? '<div style="background:#eef4fb;border:1px solid #b5d4f4;border-radius:7px;padding:7px 8px;margin-bottom:8px;">'
            + '<div style="font-size:0.66rem;color:#1a4a8a;margin-bottom:5px;">👥 Este recibo tiene ' + personas.length + ' personas · ¿a quién se lo envías?</div>'
            + '<div style="display:flex;flex-direction:column;gap:4px;">'
            + personas.map(function(p, i){
                var on = i === idxP;
                return '<button type="button" class="cob-persona" data-i="' + i + '" style="text-align:left;border:1px solid ' + (on ? '#1a4a8a' : '#d0dcea') + ';background:' + (on ? '#1a4a8a' : '#fff') + ';color:' + (on ? '#fff' : '#1a2a3a') + ';border-radius:6px;padding:5px 8px;font-size:0.74rem;cursor:pointer;display:flex;justify-content:space-between;gap:8px;">'
                  + '<span style="font-weight:600;">' + (on ? '● ' : '○ ') + esc(p.nombre || '(sin nombre)') + '</span>'
                  + '<span style="opacity:.85;">' + (p.tel ? esc(p.tel) : 'sin teléfono') + '</span></button>';
              }).join('')
            + '</div></div>'
          : '')
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;font-size:0.78rem;">'
      +   '<span>📱 ' + (dest.tel ? '<b>' + esc(dest.tel) + '</b>' : '<span style="color:#a32d2d;">Sin teléfono registrado</span>') + '</span>'
      +   (dest.tel ? bandera('MX', '🇲🇽 +52') + bandera('US', '🇺🇸 +1') : '')
      + '</div>'
      + '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;">'
      +   MENSAJES.map(function(m, i){
            var on = i === numMensaje;
            return '<button type="button" class="cob-num" data-i="' + i + '" title="' + esc(m.et) + '" style="min-width:30px;border:1px solid #c8951a;background:' + (on ? '#1a1008' : '#fff') + ';color:' + (on ? '#e8c875' : '#7a4a00') + ';border-radius:6px;padding:4px 8px;font-size:0.74rem;font-weight:700;cursor:pointer;">' + (i + 1) + '</button>';
          }).join('')
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;gap:8px;font-size:0.7rem;margin-bottom:6px;"><b style="color:#2a1c08;">' + esc(M.et) + '</b><span style="color:#7a6a4a;">Sugerido: ' + esc(M.cuando) + '</span></div>'
      + '<textarea id="cob-texto" rows="10" style="width:100%;box-sizing:border-box;border:1px solid #d9c38a;border-radius:7px;padding:10px;font-size:0.82rem;line-height:1.5;color:#2a1c08;background:#fffef8;resize:vertical;font-family:Helvetica,Arial,sans-serif;"></textarea>'
      + '<div style="font-size:0.66rem;color:#7a6a4a;margin:4px 0 8px;">Puedes editar el texto antes de enviarlo.</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
      +   '<button type="button" id="cob-whats" ' + (numero ? '' : 'disabled ') + 'title="' + (numero ? 'Abre WhatsApp con el mensaje ya escrito; solo pulsa Enviar' : 'Teléfono no válido para WhatsApp') + '" style="background:' + (numero ? '#25a244' : '#c9c9c9') + ';color:#fff;border:none;border-radius:7px;padding:10px;font-size:0.8rem;font-weight:600;cursor:' + (numero ? 'pointer' : 'not-allowed') + ';">💬 Abrir en WhatsApp</button>'
      +   '<button type="button" id="cob-copiar" style="background:#fff;color:#2e7d32;border:1.5px solid #2e7d32;border-radius:7px;padding:10px;font-size:0.8rem;font-weight:600;cursor:pointer;">📋 Copiar mensaje</button>'
      + '</div>'
      + (dest.tel && !numero ? '<div style="font-size:0.68rem;color:#a32d2d;margin-top:6px;">El teléfono registrado no tiene 10 dígitos; corrígelo en el recibo para poder abrir WhatsApp.</div>' : '');
    var ta = box.querySelector('#cob-texto'); ta.value = mensaje(dest);
    box.querySelector('#cob-copiar').onclick = function(){ copiar(ta.value, this); };
    var bw = box.querySelector('#cob-whats'); if (bw && numero) bw.onclick = function(){ abrirWhatsApp(numero, ta.value); };
    box.querySelectorAll('.cob-num').forEach(function(b){ b.onclick = function(){ numMensaje = +b.getAttribute('data-i'); pintarMensaje(); }; });
    box.querySelectorAll('.cob-pais').forEach(function(b){ b.onclick = function(){ paisElegido[claveP] = b.getAttribute('data-p'); pintarMensaje(); }; });
    box.querySelectorAll('.cob-persona').forEach(function(b){ b.onclick = function(){ personaElegida[x.folio] = +b.getAttribute('data-i'); pintarMensaje(); }; });
  }

  // ════════════════════════════════════════════════════════════════════
  // Oct-2026 · 📞 LLAMAR (solo administrador) → "Tareas para hoy"
  // Crea una tarea con guion de llamada para la secretaria. Al resolverla
  // se anota el resultado (promesa de pago con fecha, no contestó, número
  // equivocado, dice que ya pagó). La promesa crea una tarea programada para
  // ese día, que se resuelve sola si el cliente paga.
  // ════════════════════════════════════════════════════════════════════
  function esAdmin(){ try { return typeof _pendEsAdminGlobal === 'function' && _pendEsAdminGlobal(); } catch(e){ return false; } }
  function hoyStr(off){
    var d = new Date(); d.setDate(d.getDate() + (off || 0));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var MESES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var DIAS_L = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  function fLarga(iso){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); if (!m) return ''; var d = new Date(+m[1], +m[2] - 1, +m[3]); return DIAS_L[d.getDay()] + ' ' + (+m[3]) + ' de ' + MESES_L[+m[2] - 1]; }
  // Oct-2026: títulos/textos de promesas con la FECHA explícita (antes decía
  // "HOY" y confundía mientras la tarea esperaba en Programadas)
  // El título cambia solo según el día: antes → "PROMESA DE PAGO · 3-NOV";
  // ese día → "HOY SE COMPROMETIÓ A PAGAR"; después → "PROMESA VENCIDA".
  function momentoPromesa(fecha){ var h = hoyStr(0); return fecha > h ? 'antes' : (fecha === h ? 'hoy' : 'vencida'); }
  function tituloPromesa(c, fecha, esAbono){
    var mo = momentoPromesa(fecha), folio = ' · FOLIO ' + c.folio + (c.letra || '') + ' — ' + String(c.nombre).toUpperCase();
    if (mo === 'hoy') return (esAbono ? '💵 HOY SE COMPROMETIÓ A ABONAR' : '💰 HOY SE COMPROMETIÓ A PAGAR') + folio;
    if (mo === 'vencida') return '⚠ ' + (esAbono ? 'PROMESA DE ABONO VENCIDA · ' : 'PROMESA DE PAGO VENCIDA · ') + fCorta(fecha).toUpperCase() + folio;
    return (esAbono ? '💵 PROMESA DE ABONO · ' : '💰 PROMESA DE PAGO · ') + fCorta(fecha).toUpperCase() + folio;
  }
  function textoPromesa(c, fecha, esAbono, llamada, nota){
    var mo = momentoPromesa(fecha), acc = esAbono ? 'abonar' : 'liquidar';
    var frase = mo === 'hoy' ? 'Se comprometió a venir a ' + acc + ' HOY, ' + fLarga(fecha)
      : mo === 'vencida' ? 'Se comprometió a venir a ' + acc + ' el ' + fLarga(fecha) + ' y no ha venido'
      : 'Se comprometió a venir a ' + acc + ' el ' + fLarga(fecha);
    var cierre = mo === 'hoy' ? 'Si no viene antes de cerrar, llamarle.' : mo === 'vencida' ? 'Llamarle para preguntar qué pasó y pedir nueva fecha.' : 'Si ese día no viene antes de cerrar, llamarle.';
    return frase + (llamada ? ' (llamada del ' + fCorta(llamada) + ')' : '') + '. ' + (esAbono ? 'Saldo total: ' : 'Saldo: ') + dinero(c.saldo) + ' · Tel. ' + c.tel + '.' + (nota ? '\nNota: ' + nota : '') + '\n' + cierre;
  }
  function fCorta(iso){
    var t = String(iso || '');
    // Fecha con hora (ISO en UTC): se usa el día LOCAL de México, no el de UTC
    // (antes una llamada pedida a las 23:56 del 18-oct aparecía como 19-oct)
    if (/T\d{2}:\d{2}/.test(t)) { var d = new Date(t); if (!isNaN(d)) return d.getDate() + '-' + MESES[d.getMonth()]; }
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); return m ? (+m[3]) + '-' + MESES[+m[2] - 1] : '';
  }
  function quien(){
    try { if (typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.nombre) return empleadoActual.nombre; } catch(e){}
    return (typeof NOMBRE_TITULAR !== 'undefined') ? NOMBRE_TITULAR : '';
  }
  function tareas(){ try { if (typeof D !== 'undefined' && D) { if (!Array.isArray(D.tareasHoy)) D.tareasHoy = []; return D.tareasHoy; } } catch(e){} return []; }
  function guardarTareas(){
    try { if (typeof save === 'function') save(); } catch(e){}
    try { if (typeof renderTareasHoyLista === 'function') renderTareasHoyLista(); } catch(e){}
    try { if (typeof renderTareasHoyCount === 'function') renderTareasHoyCount(); } catch(e){}
  }
  function nuevoId(){ return 'TH-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7); }
  // Persona a la que se llama: la elegida en el mensaje, o la primera con teléfono
  function destinoLlamada(x){
    var ps = (x.personas && x.personas.length) ? x.personas : [{ nombre: x.nombre, tel: x.tel }];
    var i = personaElegida[x.folio];
    if (typeof i === 'number' && ps[i] && ps[i].tel) return ps[i];
    for (var k = 0; k < ps.length; k++) if (ps[k].tel) return ps[k];
    return ps[0] || { nombre: x.nombre, tel: '' };
  }
  function textoLlamada(c, intento){
    return 'Tel. ' + c.tel + (intento > 1 ? ' · Intento ' + intento : '') + '\n'
      + 'Guion: "Buen día, le llamamos de LEX-MÉXICO Despacho Jurídico. Le recordamos que su trámite «' + c.tramite + '» tiene un saldo de ' + dinero(c.saldo) + '. ¿En qué fecha podría pasar a liquidarlo?"\n'
      + 'Al marcarla resuelta, anota la fecha que prometió.';
  }
  function tareaLlamada(c, fecha, intento){
    var ahora = new Date().toISOString();
    return {
      id: nuevoId(), tipo: 'cobranza-llamada',
      titulo: '📞 LLAMAR A ' + String(c.nombre).toUpperCase() + ' (FOLIO ' + c.folio + c.letra + ')',
      texto: textoLlamada(c, intento || 1), estado: 'pendiente', fechaProgramada: fecha || '',
      creadoPor: quien(), fechaCreacion: ahora, fechaResolucion: '', fechaMod: ahora,
      cobranza: Object.assign({}, c, { intento: intento || 1 })
    };
  }
  function crearTareaLlamada(x){
    if (!esAdmin()) return;
    var p = destinoLlamada(x);
    if (!p.tel) { if (typeof toast === 'function') toast('Este cliente no tiene teléfono registrado', 'err'); return; }
    var ya = tareas().some(function(t){ return t && t.tipo === 'cobranza-llamada' && t.estado !== 'resuelta' && t.cobranza && String(t.cobranza.folio) === String(x.folio); });
    if (ya) { if (typeof toast === 'function') toast('📞 Ya hay una tarea pendiente para llamar a este cliente (folio ' + x.folio + ')', 'err'); return; }
    var c = { folio: x.folio, letra: x.letra, nombre: p.nombre || x.nombre, tel: p.tel, saldo: x.saldo, tramite: nombreTramite(x.concepto) };
    var tNueva = tareaLlamada(c, '', 1);
    tareas().unshift(tNueva);
    anotar(c.folio, 'llamada', 'Se ordenó llamar a ' + c.nombre + ' (' + c.tel + ')', { tareaId: tNueva.id });
    guardarTareas();
    if (typeof toast === 'function') toast('📞 Tarea creada en "Tareas para hoy": llamar a ' + c.nombre, 'ok');
    render();
  }
  // Etiqueta de la última gestión del folio (se muestra en la lista)
  function etiquetaLlamadas(x){
    var ts = tareas().filter(function(t){ return t && t.cobranza && String(t.cobranza.folio) === String(x.folio) && /^cobranza-/.test(t.tipo || ''); });
    if (!ts.length) return null;
    var hoy = hoyStr(0);
    var prom = ts.filter(function(t){ return t.tipo === 'cobranza-promesa' && t.estado !== 'resuelta'; })
                 .sort(function(a, b){ return String(b.fechaProgramada).localeCompare(String(a.fechaProgramada)); })[0];
    if (prom) return prom.fechaProgramada < hoy
      ? { txt: '⚠ Promesa vencida ' + fCorta(prom.fechaProgramada), fondo: '#fcebeb', color: '#a32d2d' }
      : { txt: '📅 Prometió pagar ' + fCorta(prom.fechaProgramada), fondo: '#eaf3de', color: '#3b6d11' };
    var pend = ts.filter(function(t){ return t.tipo === 'cobranza-llamada' && t.estado !== 'resuelta'; })[0];
    var ult = ts.filter(function(t){ return t.resultado; }).sort(function(a, b){ return String(b.fechaResolucion).localeCompare(String(a.fechaResolucion)); })[0];
    if (pend) {
      var txt = '📞 Llamada pendiente' + (pend.fechaProgramada && pend.fechaProgramada > hoy ? ' ' + fCorta(pend.fechaProgramada) : '');
      if (ult && ult.resultado && ult.resultado.tipo === 'no-contesto') txt = '📞 No contestó ' + fCorta(ult.fechaResolucion) + ' · se reintenta' + (pend.fechaProgramada ? ' ' + fCorta(pend.fechaProgramada) : '');
      return { txt: txt, fondo: '#fdf0dc', color: '#9a5a10' };
    }
    if (ult) {
      var r = ult.resultado;
      if (r.tipo === 'no-contesto') return { txt: '📞 No contestó ' + fCorta(ult.fechaResolucion), fondo: '#f1efe8', color: '#5f5e5a' };
      if (r.tipo === 'numero') return { txt: '☎ Número equivocado ' + fCorta(ult.fechaResolucion), fondo: '#f1efe8', color: '#5f5e5a' };
      if (r.tipo === 'ya-pago') return { txt: '💬 Dice que ya pagó ' + fCorta(ult.fechaResolucion), fondo: '#e6f1fb', color: '#185fa5' };
      if (r.tipo === 'pago') return { txt: '✅ Abonó ' + fCorta(ult.fechaResolucion), fondo: '#eaf3de', color: '#3b6d11' };
      if (r.tipo === 'promesa') return { txt: '📅 Prometió pagar ' + fCorta(r.fecha), fondo: '#eaf3de', color: '#3b6d11' };
    }
    return null;
  }
  // Oct-2026 · Estado del trámite de placas (mismo dato que el avioncito de Pendientes)
  function estadoPlacas(folio){
    var ps = [];
    try { if (typeof D !== 'undefined' && D && Array.isArray(D.pendientes)) ps = D.pendientes; } catch(e){}
    var p = ps.filter(function(q){ return q && q.seccion === 'placas' && String(q.reciboVinculadoFolio) === String(folio) && !q.resuelto; })[0];
    if (!p) return null;
    if (p.enDespacho) return { txt: '✅ Listo para entregar' + (p.enDespachoFecha ? ' · ' + fCorta(p.enDespachoFecha) : ''), fondo: '#e3f3e6', color: '#1b6e2e', tip: p.enDespachoPor ? 'Recibió: ' + p.enDespachoPor : '' };
    if (p.enviado) return { txt: '🛫 Enviado' + (p.enviadoFecha ? ' · ' + fCorta(p.enviadoFecha) : ''), fondo: '#fdeedc', color: '#b0560a', tip: p.enviadoPor ? 'Envió: ' + p.enviadoPor : '' };
    return { txt: '✈ Por enviar', fondo: '#e6f1fb', color: '#0c447c', tip: '' };
  }
  // Saldo actual del folio (versión más reciente, sin cancelados)
  function saldoActual(folio){
    var d = datosCobranza().filter(function(y){ return String(y.folio) === String(folio); })[0];
    if (d) return { saldo: d.saldo, letra: d.letra };
    // Oct-2026: saldo de años anteriores (clave P…): si ya se convirtió en folio, usar ese folio
    if (/^P/.test(String(folio)) && typeof window.lexSaldoAnteriorPorClave === 'function') {
      var sa = window.lexSaldoAnteriorPorClave(String(folio));
      if (sa) return sa.folioConvertido != null ? saldoActual(sa.folioConvertido) : { saldo: sa.debe, letra: '' };
    }
    var recs = (typeof appData !== 'undefined' && appData && Array.isArray(appData.recibos)) ? appData.recibos : [];
    var vs = recs.filter(function(r){ return r && String(r.folio) === String(folio) && !r.esComplemento; });
    if (!vs.length || vs.some(function(r){ return r.cancelado; })) return null;
    var u = vs.sort(function(a, b){ return String(a.letra || 'A') < String(b.letra || 'A') ? 1 : -1; })[0];
    return { saldo: 0, letra: String(u.letra || 'A').toUpperCase() };
  }
  // Si el cliente ya pagó (bajó su saldo), las tareas de llamada/promesa se resuelven solas
  function revisarPagos(){
    var cambio = false, ahora = new Date().toISOString();
    tareas().forEach(function(t){
      if (!t || t.estado === 'resuelta' || !t.cobranza || !/^cobranza-(llamada|promesa)$/.test(t.tipo || '')) return;
      var s = saldoActual(t.cobranza.folio);
      if (!s || !(s.saldo < (Number(t.cobranza.saldo) || 0) - 0.005)) return;
      var abono = (Number(t.cobranza.saldo) || 0) - s.saldo;
      t.estado = 'resuelta'; t.fechaResolucion = ahora; t.fechaMod = ahora;
      t.resultado = { tipo: 'pago', automatico: true, recibo: t.cobranza.folio + s.letra, abono: abono, saldo: s.saldo };
      if (!bitacoraDe(t.cobranza.folio).some(function(b){ return b.tipo === 'pago' && b.tareaId === t.id; }))
        anotar(t.cobranza.folio, 'pago', 'Pagó ' + dinero(abono) + ' (recibo ' + t.cobranza.folio + s.letra + ')' + (s.saldo > 0.005 ? ' · saldo restante ' + dinero(s.saldo) : ' · folio liquidado'), { tareaId: t.id, por: 'Sistema' });
      t.titulo = (s.saldo > 0.005 ? '✅ ABONÓ · FOLIO ' : '✅ PAGÓ · FOLIO ') + t.cobranza.folio + ' — ' + String(t.cobranza.nombre).toUpperCase();
      t.texto = 'Resuelta automáticamente: se registró el recibo ' + t.cobranza.folio + s.letra + ' por ' + dinero(abono) + (s.saldo > 0.005 ? ' (saldo restante ' + dinero(s.saldo) + ').' : ' (folio liquidado).');
      cambio = true;
    });
    if (cambio) guardarTareas();
    return cambio;
  }
  window._cobranzaRevisarPagos = revisarPagos;
  window._cobranzaCorregirTextos = function(){ return corregirTextosHoy(); };
  function corregirTextosHoy(){
    var cambio = false, MESNUM = {};
    MESES.forEach(function(m, i){ MESNUM[m] = i; });
    tareas().forEach(function(t){
      if (!t || t.tipo !== 'cobranza-promesa' || t.estado === 'resuelta' || !t.cobranza || !t.fechaProgramada) return;
      var tit = String(t.titulo || '');
      // Solo títulos generados por el sistema (no se tocan los que alguien reescribió a mano)
      if (!/^(💰 HOY SE COMPROMETIÓ A PAGAR|💵 HOY SE COMPROMETIÓ A ABONAR|💰 PROMESA DE PAGO|💵 PROMESA DE ABONO|⚠ PROMESA DE (PAGO|ABONO) VENCIDA)/.test(tit)) return;
      var esAb = t.subtipo === 'abono';
      var nuevo = tituloPromesa(t.cobranza, t.fechaProgramada, esAb);
      if (nuevo === tit) return;
      var txt = String(t.texto || '');
      var llam = t.llamadaFecha || '';
      if (!llam) { var m = /llamada del (\d{1,2})-([a-z]{3})\)/.exec(txt); if (m && MESNUM[m[2]] != null) { var y = new Date().getFullYear(); llam = y + '-' + String(MESNUM[m[2]] + 1).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0'); } }
      var notaM = /\nNota: ([^\n]*)/.exec(txt);
      t.titulo = nuevo;
      t.texto = textoPromesa(t.cobranza, t.fechaProgramada, esAb, llam, t.nota || (notaM ? notaM[1] : ''));
      t.fechaMod = new Date().toISOString();
      cambio = true;
    });
    if (cambio) guardarTareas();
  }
  setTimeout(function(){ try { corregirTextosHoy(); } catch(e){} }, 12000);
  setInterval(function(){ try { corregirTextosHoy(); } catch(e){} }, 120000);
  setInterval(function(){ try { revisarPagos(); } catch(e){} }, 120000);
  setTimeout(function(){ try { revisarPagos(); } catch(e){} }, 15000);

  // Ventana "Resultado de la llamada" al marcar resuelta una tarea de llamada
  function dialogoResultado(t){
    var c = t.cobranza || {};
    var viejo = document.getElementById('cob-res-ov'); if (viejo) viejo.remove();
    var ov = document.createElement('div');
    ov.id = 'cob-res-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147482000;background:rgba(26,16,8,0.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Helvetica,Arial,sans-serif;';
    var opc = function(v, txt, extra){
      return '<label style="display:flex;align-items:center;gap:8px;border:1px solid #d9c38a;background:#fff;border-radius:7px;padding:8px 10px;margin-bottom:6px;font-size:0.82rem;cursor:pointer;color:#2a1c08;">'
        + '<input type="radio" name="cob-res" value="' + v + '"' + (v === 'promesa' ? ' checked' : '') + '> ' + txt + (extra || '') + '</label>';
    };
    ov.innerHTML = '<div style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:460px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,0.45);">'
      + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-size:0.72rem;letter-spacing:0.1em;font-family:monospace;">📞 RESULTADO DE LA LLAMADA · FOLIO ' + esc(c.folio) + esc(c.letra || '') + '</div>'
      + '<div style="padding:14px 16px;">'
      + '<div style="font-weight:600;font-size:0.86rem;margin-bottom:10px;color:#2a1c08;">' + esc(c.nombre) + ' · ' + esc(c.tel) + '</div>'
      + opc('promesa', 'Prometió liquidar todo el', ' <input type="date" id="cob-res-fecha" min="' + hoyStr(0) + '" value="' + hoyStr(1) + '" style="margin-left:4px;border:1px solid #c8951a;border-radius:5px;padding:2px 6px;font-size:0.8rem;">')
      + opc('abono', 'Prometió abonar el', ' <input type="date" id="cob-res-fecha-ab" min="' + hoyStr(0) + '" value="' + hoyStr(1) + '" style="margin-left:4px;border:1px solid #c8951a;border-radius:5px;padding:2px 6px;font-size:0.8rem;">')
      + opc('no-contesto', 'No contestó', ' <span style="font-size:0.7rem;color:#7a6a4a;">(se crea otra tarea para mañana)</span>')
      + opc('numero', 'Número equivocado o sin servicio')
      + opc('ya-pago', 'Ya pagó / dice que ya pagó')
      + '<textarea id="cob-res-nota" rows="2" placeholder="Nota opcional (ej. pagará la mitad el viernes)" style="width:100%;box-sizing:border-box;border:1px solid #d9c38a;border-radius:7px;padding:8px 10px;font-size:0.8rem;margin-top:4px;resize:vertical;"></textarea>'
      + '<div id="cob-res-err" style="display:none;color:#a32d2d;font-size:0.74rem;margin-top:6px;"></div>'
      + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">'
      +   '<button type="button" id="cob-res-cancel" style="background:#fff;border:1px solid #c8951a;color:#7a4a00;border-radius:6px;padding:7px 14px;font-size:0.74rem;cursor:pointer;">Cancelar</button>'
      +   '<button type="button" id="cob-res-ok" style="background:#9a6e18;color:#fff;border:none;border-radius:6px;padding:7px 16px;font-size:0.74rem;letter-spacing:0.05em;cursor:pointer;">GUARDAR Y RESOLVER</button>'
      + '</div></div></div>';
    document.body.appendChild(ov);
    var fechaInp = ov.querySelector('#cob-res-fecha');
    fechaInp.addEventListener('focus', function(){ ov.querySelector('input[value="promesa"]').checked = true; });
    var fechaAb = ov.querySelector('#cob-res-fecha-ab');
    fechaAb.addEventListener('focus', function(){ ov.querySelector('input[value="abono"]').checked = true; });
    ov.querySelector('#cob-res-cancel').onclick = function(){ ov.remove(); };
    ov.querySelector('#cob-res-ok').onclick = function(){
      var sel = ov.querySelector('input[name="cob-res"]:checked');
      var tipo = sel ? sel.value : '';
      var nota = ov.querySelector('#cob-res-nota').value.trim();
      var err = ov.querySelector('#cob-res-err');
      if (!tipo) { err.textContent = 'Elige qué pasó en la llamada.'; err.style.display = 'block'; return; }
      var fecha = tipo === 'abono' ? fechaAb.value : fechaInp.value;
      var monto = 0; // Oct-2026 (a petición): el abono prometido ya no lleva monto
      if ((tipo === 'promesa' || tipo === 'abono') && (!fecha || fecha < hoyStr(0))) { err.textContent = 'Elige la fecha que prometió (hoy o después).'; err.style.display = 'block'; return; }
      var ahora = new Date().toISOString();
      t.estado = 'resuelta'; t.fechaResolucion = ahora; t.fechaMod = ahora;
      var conFecha = (tipo === 'promesa' || tipo === 'abono');
      t.resultado = { tipo: tipo, fecha: conFecha ? fecha : '', monto: monto || 0, nota: nota, por: quien() };
      var etq = { promesa: 'Prometió liquidar todo el ' + fCorta(fecha), abono: 'Prometió abonar ' + (monto ? dinero(monto) + ' ' : '') + 'el ' + fCorta(fecha), 'no-contesto': 'No contestó', numero: 'Número equivocado o sin servicio', 'ya-pago': 'Dice que ya pagó' }[tipo];
      t.texto = (t.texto || '') + '\nResultado: ' + etq + (nota ? ' · Nota: ' + nota : '');
      anotar(c.folio, tipo === 'abono' ? 'abono-promesa' : tipo, etq + (nota ? ' · "' + nota + '"' : ''), { fechaPromesa: conFecha ? fecha : '', monto: monto || 0, tel: c.tel, tareaId: t.id });
      if (tipo === 'promesa') {
        tareas().unshift({
          id: nuevoId(), tipo: 'cobranza-promesa',
          titulo: tituloPromesa(c, fecha, false),
          texto: textoPromesa(c, fecha, false, hoyStr(0), nota), llamadaFecha: hoyStr(0), nota: nota,
          estado: 'pendiente', fechaProgramada: fecha, creadoPor: quien(), fechaCreacion: ahora, fechaResolucion: '', fechaMod: ahora,
          cobranza: Object.assign({}, c)
        });
      } else if (tipo === 'abono') {
        tareas().unshift({
          id: nuevoId(), tipo: 'cobranza-promesa', subtipo: 'abono',
          titulo: tituloPromesa(c, fecha, true),
          texto: textoPromesa(c, fecha, true, hoyStr(0), nota), llamadaFecha: hoyStr(0), nota: nota,
          estado: 'pendiente', fechaProgramada: fecha, creadoPor: quien(), fechaCreacion: ahora, fechaResolucion: '', fechaMod: ahora,
          cobranza: Object.assign({}, c, { montoPrometido: monto || 0 })
        });
      } else if (tipo === 'no-contesto') {
        tareas().unshift(tareaLlamada(c, hoyStr(1), (Number(c.intento) || 1) + 1));
        anotar(c.folio, 'reintento', 'Se programó otra llamada para el ' + fCorta(hoyStr(1)) + ' (intento ' + ((Number(c.intento) || 1) + 1) + ')', {});
      }
      ov.remove();
      guardarTareas();
      if (typeof toast === 'function') toast(tipo === 'promesa' ? '📅 Promesa de pago programada para el ' + fCorta(fecha) : tipo === 'abono' ? '💵 Promesa de abono programada para el ' + fCorta(fecha) : tipo === 'no-contesto' ? '📞 Se programó otra llamada para mañana' : '✅ Resultado guardado', 'ok');
      var ovC = document.getElementById('overlay-cobranza'); if (ovC && ovC.style.display !== 'none') render();
    };
  }
  // ── Bitácora permanente de cobranza (D.cobranzaBitacora) ──────────────
  // Las tareas resueltas se borran solas a los 2 días; la bitácora no.
  function bitacora(){ try { if (typeof D !== 'undefined' && D) { if (!Array.isArray(D.cobranzaBitacora)) D.cobranzaBitacora = []; return D.cobranzaBitacora; } } catch(e){} return []; }
  function bitacoraDe(folio){ return bitacora().filter(function(b){ return b && String(b.folio) === String(folio); }).sort(function(a, b){ return String(a.fecha).localeCompare(String(b.fecha)); }); }
  function anotar(folio, tipo, texto, extra){
    var ahora = new Date().toISOString();
    bitacora().push(Object.assign({ id: 'CB-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), folio: folio, tipo: tipo, texto: texto, por: quien(), fecha: ahora, fechaMod: ahora }, extra || {}));
  }
  // ── Estado del botón 📞 según tareas actuales + bitácora ───────────────
  function estadoBoton(x, dest){
    var B = function(id, txt, activo, fondo, color, borde, tip){ return { id: id, txt: txt, activo: activo, fondo: fondo, color: color, borde: borde, tip: tip }; };
    var normal = B('llamar', '📞 Llamar', true, '#fff', '#1a4a8a', '1px solid #1a4a8a', 'Crear tarea para que la secretaria llame a ' + (dest.nombre || x.nombre));
    if (!dest.tel) return B('sin-tel', '📞 Llamar', false, '#fff', '#aaa', '1px solid #ccc', 'Sin teléfono registrado');
    var hoy = hoyStr(0);
    var ts = tareas().filter(function(t){ return t && t.estado !== 'resuelta' && t.cobranza && String(t.cobranza.folio) === String(x.folio); });
    var ll = ts.filter(function(t){ return t.tipo === 'cobranza-llamada'; })[0];
    if (ll && (!ll.fechaProgramada || ll.fechaProgramada <= hoy))
      return B('en-tareas', '📋 En tareas', false, '#fdf0dc', '#9a5a10', '1px solid #e8c48a', 'Ya está en Tareas para hoy desde el ' + fCorta(ll.fechaCreacion) + '; falta que la secretaria anote el resultado.');
    if (ll) return B('programada', '📅 Programada ' + fCorta(ll.fechaProgramada), false, '#e6f1fb', '#185fa5', '1px solid #b5d4f4', 'Se volverá a llamar el ' + fCorta(ll.fechaProgramada) + ' (intento ' + ((ll.cobranza && ll.cobranza.intento) || 2) + ').');
    var pr = ts.filter(function(t){ return t.tipo === 'cobranza-promesa'; }).sort(function(a, b){ return String(b.fechaProgramada).localeCompare(String(a.fechaProgramada)); })[0];
    if (pr) return pr.fechaProgramada >= hoy
      ? (pr.subtipo === 'abono'
          ? B('promesa', '💵 Abono ' + fCorta(pr.fechaProgramada), false, '#eaf3de', '#3b6d11', '1px solid #c0dd97', 'Se comprometió a abonar' + (pr.cobranza && pr.cobranza.montoPrometido ? ' ' + dinero(pr.cobranza.montoPrometido) : '') + ' el ' + fCorta(pr.fechaProgramada) + '.')
          : B('promesa', '📅 Promesa ' + fCorta(pr.fechaProgramada), false, '#eaf3de', '#3b6d11', '1px solid #c0dd97', 'Se comprometió a liquidar el ' + fCorta(pr.fechaProgramada) + '.'))
      : B('vencida', '📞 Llamar de nuevo', true, '#fff', '#a32d2d', '1.5px solid #a32d2d', 'Venció su promesa de pago del ' + fCorta(pr.fechaProgramada) + ' y no ha pagado.');
    // Sin tareas en curso: se usa la última anotación de la bitácora
    var bs = bitacoraDe(x.folio).filter(function(b){ return /^(promesa|abono-promesa|numero|ya-pago|pago|eliminada-promesa)$/.test(b.tipo); });
    var u = bs[bs.length - 1];
    if (!u || u.tipo === 'pago') return normal;
    if (u.tipo === 'promesa' || u.tipo === 'abono-promesa' || u.tipo === 'eliminada-promesa') {
      var fp = u.fechaPromesa || '';
      if (fp && fp >= hoy) return B('promesa', '📅 Promesa ' + fCorta(fp) + ' (sin recordatorio)', false, '#eaf3de', '#3b6d11', '1px solid #c0dd97', 'Prometió pagar el ' + fCorta(fp) + '. Su tarea de recordatorio fue eliminada.');
      if (fp) return B('vencida', '📞 Llamar de nuevo', true, '#fff', '#a32d2d', '1.5px solid #a32d2d', 'Venció su promesa de pago del ' + fCorta(fp) + ' y no ha pagado.');
      return normal;
    }
    if (u.tipo === 'numero') return (soloDigitos(u.tel) && soloDigitos(u.tel) === soloDigitos(dest.tel))
      ? B('revisar-numero', '☎ Revisar número', false, '#f1efe8', '#5f5e5a', '1px solid #d3d1c7', 'El número ' + dest.tel + ' estaba equivocado o sin servicio. Corrige el teléfono en el recibo para poder llamar.')
      : normal;
    if (u.tipo === 'ya-pago') return B('verificar', '💬 Verificar pago', true, '#fff', '#185fa5', '1px solid #185fa5', 'Dijo que ya pagó (' + fCorta(u.fecha) + '). Revisa antes de volver a llamar.');
    return normal;
  }
  // ── Ver bitácora de un folio ──
  function verBitacora(x){
    var bs = bitacoraDe(x.folio).slice().reverse();
    var viejo = document.getElementById('cob-bit-ov'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'cob-bit-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147482000;background:rgba(26,16,8,0.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Helvetica,Arial,sans-serif;';
    var ico = { llamada: '📞', promesa: '📅', 'abono-promesa': '💵', 'no-contesto': '📵', reintento: '🔁', numero: '☎', 'ya-pago': '💬', pago: '✅', eliminada: '🗑', 'eliminada-promesa': '🗑' };
    var hora = function(iso){ var d = new Date(iso); return isNaN(d) ? '' : fCorta(iso) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    ov.innerHTML = '<div style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:560px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,0.45);">'
      + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-size:0.72rem;letter-spacing:0.1em;font-family:monospace;display:flex;justify-content:space-between;align-items:center;"><span>🕑 BITÁCORA DE COBRANZA · FOLIO ' + esc(x.folio) + esc(x.letra) + '</span><button type="button" id="cob-bit-x" style="background:none;border:none;color:#e8c875;font-size:1.1rem;cursor:pointer;">✕</button></div>'
      + '<div style="padding:10px 16px 4px;font-weight:600;font-size:0.84rem;color:#2a1c08;">' + esc(x.nombre) + '</div>'
      + '<div style="padding:4px 16px 14px;overflow-y:auto;">'
      + (bs.length ? bs.map(function(b){
          return '<div style="display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid #eadfbf;border-radius:7px;padding:7px 10px;margin-bottom:6px;font-size:0.78rem;color:#2a1c08;">'
            + '<span style="font-size:1rem;line-height:1.2;">' + (ico[b.tipo] || '•') + '</span>'
            + '<div style="flex:1;min-width:0;"><div>' + esc(String(b.texto || '').replace(/^Llamada pedida a /, 'Se ordenó llamar a ')) + '</div><div style="font-size:0.66rem;color:#9a6e18;margin-top:2px;">' + esc(hora(b.fecha)) + ' · ' + esc(b.por || '') + '</div></div></div>';
        }).join('') : '<div style="text-align:center;color:#7a6a4a;padding:24px;font-size:0.8rem;">Todavía no hay movimientos de cobranza en este folio.</div>')
      + '</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#cob-bit-x').onclick = function(){ ov.remove(); };
    ov.onclick = function(ev){ if (ev.target === ov) ov.remove(); };
  }
  // ── Eliminar una tarea de cobranza: aviso y registro en la bitácora ──
  (function engancharEliminar(){
    if (typeof window.eliminarTareaHoy !== 'function' || window.eliminarTareaHoy._cob) return;
    var orig = window.eliminarTareaHoy;
    var envuelta = function(){
      var id = null; try { id = _tareaEdId; } catch(e){}
      var t = id ? tareas().filter(function(x){ return x && x.id === id; })[0] : null;
      if (!t || !t.cobranza || !/^cobranza-/.test(t.tipo || '')) return orig.apply(this, arguments);
      var c = t.cobranza;
      if (!window.confirm('Esta tarea es de cobranza (folio ' + c.folio + (c.letra || '') + ' — ' + c.nombre + ').\n\nSi la eliminas, quedará anotado en la bitácora del folio.\n\n¿Continuar?')) return;
      var esProm = t.tipo === 'cobranza-promesa';
      anotar(c.folio, esProm ? 'eliminada-promesa' : 'eliminada',
        (esProm ? 'Se eliminó el recordatorio de la promesa de pago del ' + fCorta(t.fechaProgramada) : 'Se eliminó la tarea de llamada') + (t.estado === 'resuelta' ? ' (ya resuelta)' : ''),
        esProm ? { fechaPromesa: t.fechaProgramada } : {});
      if (typeof _lexLapidaTareas === 'function') _lexLapidaTareas([t.id]);
      if (typeof D !== 'undefined' && D) D.tareasHoy = tareas().filter(function(x){ return x && x.id !== t.id; });
      try { if (typeof cerrar === 'function') cerrar('mTareaEditar'); } catch(e){}
      guardarTareas();
      if (typeof toast === 'function') toast('🗑 Tarea eliminada — quedó anotado en la bitácora del folio ' + c.folio, 'ok');
    };
    envuelta._cob = true;
    window.eliminarTareaHoy = envuelta;
  })();
  window._cobranzaBitacora = bitacoraDe;
  window._cobranzaEstadoBoton = function(folio){ var x = datosCobranza().filter(function(y){ return String(y.folio) === String(folio); })[0]; return x ? estadoBoton(x, destinoLlamada(x)) : null; };

  // Las tareas de llamada piden el resultado; el resto se resuelve como siempre
  (function engancharTareas(){
    if (typeof window.marcarTareaResuelta !== 'function' || window.marcarTareaResuelta._cob) return;
    var orig = window.marcarTareaResuelta;
    var envuelta = function(id){
      var t = tareas().filter(function(x){ return x && x.id === id; })[0];
      if (t && t.tipo === 'cobranza-llamada' && t.estado !== 'resuelta') { dialogoResultado(t); return; }
      // Oct-2026 (a petición expresa): las demás tareas piden confirmación
      if (t && t.estado !== 'resuelta' && !window.confirm('¿Marcar como resuelta esta tarea?\n\n"' + String(t.titulo || '').replace(/\*/g, '') + '"')) return;
      return orig.apply(this, arguments);
    };
    envuelta._cob = true;
    window.marcarTareaResuelta = envuelta;
  })();

  window.abrirCobranza = function(){
    var ov = document.getElementById('overlay-cobranza');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'overlay-cobranza';
      ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:9600;align-items:center;justify-content:center;font-family:Helvetica,Arial,sans-serif;';
      ov.innerHTML =
        '<div style="background:#fbf6ea;border:2px solid #c8951a;border-radius:12px;width:98%;max-width:1400px;max-height:95vh;box-shadow:0 24px 60px rgba(0,0,0,0.6);overflow:hidden;display:flex;flex-direction:column;color:#2a1c08;">'
        + '<div style="background:#1a1008;padding:14px 20px;display:flex;align-items:center;gap:10px;flex-shrink:0;">'
        +   '<span style="font-size:1.3rem;">💰</span>'
        +   '<div style="flex:1;"><div style="font-family:serif;font-size:1.05rem;color:#e8c875;">Cobranza · saldos pendientes</div>'
        +   '<div style="font-size:0.62rem;color:rgba(232,200,117,0.65);font-family:monospace;letter-spacing:0.08em;"><span id="cob-total"></span></div></div>'
        +   '<button type="button" onclick="cerrarCobranza()" style="background:none;border:none;color:rgba(232,200,117,0.7);font-size:1.4rem;cursor:pointer;line-height:1;" aria-label="Cerrar">✕</button>'
        + '</div>'
        + '<div style="padding:14px 18px 0;flex-shrink:0;">'
        +   '<div id="cob-cats" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;"></div>'
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
    try { revisarPagos(); } catch(e){}
    try { corregirTextosHoy(); } catch(e){}
    render();
  };
  window.cerrarCobranza = function(){
    var ov = document.getElementById('overlay-cobranza');
    if (ov) ov.style.display = 'none';
  };
  // Para pruebas
  window._cobranzaDatos = datosCobranza;
  // Oct-2026: repintar el panel si está abierto (sincronización en vivo)
  window._cobranzaRefrescar = function(){ var o = document.getElementById('overlay-cobranza'); if (o && o.style.display !== 'none') render(); };
  window._cobranzaMensaje = mensaje;
  window._cobranzaPais = paisDetectado;
  window._cobranzaCategoria = categoriaDe;
  window._cobranzaNumero = numeroWhats;
})();
