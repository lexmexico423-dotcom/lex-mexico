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
    return m.txt(titulo(x.nombre), '«' + nombreTramite(x.concepto) + '»', String(x.folio), dinero(x.saldo)) + FIRMA;
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
          + ico + ' ' + txt + ' <b>' + rs.length + '</b> · ' + dinero(rs.reduce(function(s, x){ return s + x.saldo; }, 0)) + '</button>';
      };
      catsBox.innerHTML = chip(null, '📋', 'Todas', todosSinCat) + CATEGORIAS.map(function(c){
        var rs = todosSinCat.filter(function(x){ return x.categoria === c.id; });
        return rs.length ? chip(c.id, c.ico, c.txt, rs) : '';
      }).join('');
      catsBox.querySelectorAll('.cob-cat').forEach(function(b){
        b.onclick = function(){ var c = b.getAttribute('data-c') || null; categoria = (categoria === c ? null : c); render(); };
      });
    }
    var todos = categoria ? todosSinCat.filter(function(x){ return x.categoria === categoria; }) : todosSinCat;
    var total = todosSinCat.reduce(function(s, x){ return s + x.saldo; }, 0);
    ov.querySelector('#cob-total').textContent = dinero(total) + ' · ' + todosSinCat.length + ' folios';
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
      if (q && norm(x.nombre + ' ' + x.folio + ' ' + x.concepto + ' ' + x.tel + ' ' + x.personas.map(function(p){ return p.nombre + ' ' + p.tel; }).join(' ')).indexOf(q) < 0) return false;
      return true;
    });
    ov.querySelector('#cob-lista').innerHTML = lista.length ? lista.map(function(x){
      var g = grupoDe(x.dias), sel = seleccionado === String(x.folio);
      return '<div class="cob-row" data-f="' + esc(x.folio) + '" style="display:grid;grid-template-columns:52px minmax(0,1fr) 110px 78px 132px;gap:10px;align-items:center;padding:8px 10px;background:' + (sel ? '#fff8e4' : '#fff') + ';border:1px solid ' + (sel ? '#c8951a' : '#eadfbf') + ';border-radius:7px;margin-bottom:6px;font-size:0.8rem;">'
        + '<span class="cob-folio" data-f="' + esc(x.folio) + '" title="Abrir la ficha del folio ' + esc(x.folio) + '" style="color:#1a4a8a;font-weight:700;cursor:pointer;text-decoration:underline;text-underline-offset:3px;">#' + esc(x.folio) + esc(x.letra) + '</span>'
        + '<div style="min-width:0;"><div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(x.nombre || '(sin nombre)') + '</div>'
        + '<div style="font-size:0.7rem;color:#7a6a4a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(oracion(x.concepto)) + ' · ' + (x.tel ? esc(x.tel) : '<span style="color:#a32d2d;">sin teléfono</span>') + (x.personas.length > 1 ? ' · <b style="color:#1a4a8a;">👥 ' + x.personas.length + ' personas</b>' : '') + '</div></div>'
        + '<span style="text-align:right;font-weight:700;color:#a32d2d;">' + dinero(x.saldo) + '</span>'
        + '<span style="font-size:0.68rem;padding:3px 6px;border-radius:10px;text-align:center;background:' + g.fondo + ';color:' + g.color + ';">' + x.dias + ' días</span>'
        + '<button type="button" class="cob-gen" data-f="' + esc(x.folio) + '" style="background:#1a1008;color:#e8c875;border:1px solid #c8951a;border-radius:6px;padding:6px 8px;font-size:0.68rem;letter-spacing:0.04em;cursor:pointer;">✉ Generar mensaje</button>'
        + '</div>';
    }).join('') : '<div style="text-align:center;color:#7a6a4a;padding:30px;font-size:0.82rem;">No hay folios con saldo en este filtro.</div>';
    // Clic en el folio → cierra Cobranza y abre la Ficha del Folio (misma ruta que Contabilidad)
    ov.querySelectorAll('.cob-folio').forEach(function(el){
      el.onclick = function(){
        var n = parseInt(el.getAttribute('data-f'), 10);
        if (!n) return;
        window.cerrarCobranza();
        if (typeof abrirFichaDesdeContab === 'function') abrirFichaDesdeContab(n);
      };
    });
    // Si el cliente del mensaje ya no está en la lista filtrada, se limpia el mensaje
    if (seleccionado && !lista.some(function(x){ return String(x.folio) === seleccionado; })) seleccionado = null;
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
        +   '<div id="cob-cats" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;"></div>'
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
  window._cobranzaPais = paisDetectado;
  window._cobranzaCategoria = categoriaDe;
  window._cobranzaNumero = numeroWhats;
})();
