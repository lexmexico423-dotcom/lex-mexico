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
  // CAPTURA / EDICIÓN  (Oct-2026 v2: mismo orden que "Generar recibo")
  //  · Datos del cliente (uno o varios: nombre, móvil, tel. casa, domicilio)
  //  · Tipo de trámite (normal / vehicular / escrituras / juicio)
  //  · Conceptos y precios  → su suma es el COSTO PACTADO
  //  · Pagos que ya dio, cada uno con SU folio de papel (no entran a caja)
  //  · TOTAL DE ADEUDO bloqueado = costo − pagos (nadie lo escribe a mano)
  // Así, al cobrar, TODO pasa tal cual al formulario de Generar recibo.
  // Los registros capturados con la versión anterior se convierten al abrirlos.
  // ════════════════════════════════════════════════════════════════════
  var TIPOS_T = [['normal','📄 Trámite normal'],['vehicular','🚗 Trámite vehicular'],['escritura','📜 Trámite de escrituras'],['juicio','⚖️ Trámite de juicio']];
  function tipoDe(sa){
    if (sa && sa.tipoTramite) return sa.tipoTramite;
    var c = sa && sa.categoria;
    return c === 'escrituras' ? 'escritura' : c === 'juicios' ? 'juicio' : c === 'placas' ? 'vehicular' : 'normal';
  }
  function catDeTipo(t, anterior){
    if (t === 'escritura') return 'escrituras';
    if (t === 'juicio') return 'juicios';
    if (t === 'vehicular') return 'placas';
    return (anterior && ['registro','contratos','otros'].indexOf(anterior) >= 0) ? anterior : 'otros';
  }
  function clientesDe(sa){
    if (sa && Array.isArray(sa.clientes) && sa.clientes.length) return sa.clientes;
    return [{ nombre: (sa && sa.cliente) || '', movil: (sa && sa.tel) || '', telCasa: '', domicilio: '' }];
  }
  function conceptosDe(sa){
    if (sa && Array.isArray(sa.conceptos) && sa.conceptos.length) return sa.conceptos;
    if (!sa) return [{ concepto: '', descripcion: '', precio: '' }];
    var costo = (sa.costo != null && sa.costo !== '') ? r2(sa.costo) : r2(r2(sa.debeManual) + pagadoAntes(sa));
    return [{ concepto: String(sa.concepto || '').toUpperCase(), descripcion: '', precio: costo }];
  }
  function pagosDe(sa){
    return ((sa && sa.pagosAnteriores) || []).map(function(p){ return Object.assign({}, p, { folioPapel: p.folioPapel != null ? p.folioPapel : (sa.formato === 2 ? '' : (sa.folioPapel || '')) }); });
  }
  function foliosDe(sa){
    var vistos = {}, out = [];
    var add = function(txt){ String(txt || '').split(/[,;\/]+/).forEach(function(f){ f = f.trim(); if (f && !vistos[f]) { vistos[f] = 1; out.push(f); } }); };
    pagosDe(sa).forEach(function(p){ add(p.folioPapel); });
    if (!out.length && sa && sa.folioPapel) add(sa.folioPapel);
    return out;
  }
  function listaY(arr){ return arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1]; }
  window._lexSAFolios = foliosDe;

  var EST_IN = 'width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #d8c08a;border-radius:6px;background:#fff;font-size:0.8rem;color:#2a1c08;';
  var EST_LB = 'font-size:0.6rem;color:#7a5410;letter-spacing:0.08em;margin:0 0 3px;font-family:monospace;text-transform:uppercase;';
  var EST_SEC = 'font-size:0.62rem;color:#7a5410;letter-spacing:0.1em;margin:14px 0 6px;font-family:monospace;text-transform:uppercase;border-bottom:1px solid #e3d3a8;padding-bottom:3px;';
  var EST_ADD = 'background:none;border:1px dashed #c8951a;color:#9a6e18;border-radius:6px;padding:5px 12px;font-size:0.68rem;cursor:pointer;font-family:monospace;letter-spacing:0.06em;';
  function filaCliente(c, i){
    return '<div class="sa-cli" style="background:#faf3e2;border:1px solid #e3d3a8;border-radius:8px;padding:8px 10px;margin-bottom:6px;position:relative;">'
      + (i > 0 ? '<button type="button" class="sa-cli-x" title="Quitar cliente" style="position:absolute;top:4px;right:6px;background:none;border:none;color:#a32d2d;cursor:pointer;font-size:0.95rem;">✕</button>' : '')
      + '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;">'
      + '<div><div style="' + EST_LB + '">Nombre completo' + (i === 0 ? ' *' : '') + '</div><input class="sa-c-nom" value="' + E(c.nombre || '') + '" placeholder="NOMBRE DEL CLIENTE" style="' + EST_IN + 'text-transform:uppercase;"></div>'
      + '<div><div style="' + EST_LB + '">Móvil</div><input class="sa-c-mov" value="' + E(c.movil || '') + '" placeholder="000-000-0000" maxlength="12" style="' + EST_IN + '"></div>'
      + '<div><div style="' + EST_LB + '">Tel. casa</div><input class="sa-c-tel" value="' + E(c.telCasa || '') + '" placeholder="000-000-0000" maxlength="12" style="' + EST_IN + '"></div>'
      + '</div><div style="margin-top:6px;display:flex;gap:12px;align-items:flex-end;"><div style="flex:1;"><div style="' + EST_LB + '">Domicilio</div><input class="sa-c-dom" value="' + E(c.domicilio || '') + '" placeholder="Calle, número, colonia, municipio…" style="' + EST_IN + '"></div>'
      + '<label class="sa-c-firma-lbl" style="display:flex;align-items:center;gap:6px;font-size:0.72rem;font-family:monospace;color:#7a5410;white-space:nowrap;cursor:pointer;user-select:none;padding-bottom:8px;"><span>¿Va a firmar?</span><input type="checkbox" class="sa-c-firma" ' + ((c.firma != null ? c.firma : i === 0) ? 'checked' : '') + ' style="width:16px;height:16px;margin:0;cursor:pointer;"></label></div></div>';
  }
  function filaConcepto(c){
    return '<div class="sa-con" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) 130px 26px;gap:6px;margin-bottom:5px;">'
      + '<input class="sa-k-con" value="' + E(c.concepto || '') + '" placeholder="Concepto" style="' + EST_IN + 'text-transform:uppercase;">'
      + '<input class="sa-k-des" value="' + E(c.descripcion || '') + '" placeholder="Descripción" style="' + EST_IN + '">'
      + '<input class="sa-k-pre" value="' + (r2(c.precio) ? $m(c.precio) : '') + '" placeholder="$0.00" inputmode="decimal" style="' + EST_IN + 'text-align:right;font-family:monospace;">'
      + '<button type="button" class="sa-x" title="Quitar" style="background:none;border:none;color:#a32d2d;cursor:pointer;font-size:1rem;">✕</button></div>';
  }
  function filaPago(p){
    return '<div class="sa-pago" data-id="' + E(p.id || '') + '" style="display:grid;grid-template-columns:140px minmax(0,1fr) 120px 130px 26px;gap:6px;margin-bottom:5px;">'
      + '<input type="date" class="sa-p-fecha" value="' + E(String(p.fecha || '').slice(0, 10)) + '" style="' + EST_IN + 'padding:6px;">'
      + '<input class="sa-p-conc" value="' + E(p.concepto || '') + '" placeholder="Anticipo, abono…" style="' + EST_IN + '">'
      + '<input class="sa-p-folio" value="' + E(p.folioPapel || '') + '" placeholder="Ej. 0417" style="' + EST_IN + 'font-family:monospace;">'
      + '<input class="sa-p-monto" value="' + (r2(p.monto) ? $m(p.monto) : '') + '" placeholder="$0.00" inputmode="decimal" style="' + EST_IN + 'text-align:right;font-family:monospace;">'
      + '<button type="button" class="sa-x" title="Quitar" style="background:none;border:none;color:#a32d2d;cursor:pointer;font-size:1rem;">✕</button></div>';
  }
  window.lexNuevoSaldoAnterior = function(){ abrirForm(null); };
  window.lexAbrirSaldoAnterior = function(id){ var sa = porId(id); if (sa) abrirForm(sa); };
  function abrirForm(sa){
    var viejo = document.getElementById('lex-sa-ov'); if (viejo) viejo.remove();
    var ov = document.createElement('div'); ov.id = 'lex-sa-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(26,16,8,0.6);display:flex;align-items:center;justify-content:center;padding:14px;font-family:Helvetica,Arial,sans-serif;';
    var convertido = sa && sa.estado === 'convertido';
    var tipo = sa ? tipoDe(sa) : 'normal';
    var sis = sa ? pagadoSistema(sa) : 0;
    var btnTipo = function(t){ var on = t[0] === tipo; return '<button type="button" class="sa-tipo" data-t="' + t[0] + '" style="padding:8px 12px;border-radius:7px;cursor:pointer;font-family:monospace;font-size:0.68rem;letter-spacing:0.06em;text-transform:uppercase;font-weight:700;' + (on ? 'background:#fff4dd;border:2px solid #b8862b;color:#7a5410;' : 'background:#eee;border:1px solid #c9c2b2;color:#666;') + '">' + t[1] + '</button>'; };
    var lin = function(lbl, valHtml, extra){ return '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;' + (extra || '') + '"><span style="' + EST_LB + 'margin:0;">' + lbl + '</span>' + valHtml + '</div>'; };
    ov.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:980px;max-height:94vh;overflow-y:auto;box-shadow:0 18px 50px rgba(0,0,0,0.45);color:#2a1c08;">'
      + '<div style="position:sticky;top:0;z-index:2;background:#1a1008;color:#e8c875;padding:10px 16px;font-size:0.76rem;letter-spacing:0.1em;font-family:monospace;display:flex;justify-content:space-between;"><span>🗂 ' + (sa ? 'RECIBO ANTERIOR' : 'NUEVO RECIBO ANTERIOR') + '</span><span id="sa-x" title="Cerrar sin guardar" style="cursor:pointer;">✕</span></div>'
      + '<div style="padding:4px 16px 14px;">'
      + (convertido ? '<div style="background:#eaf3de;border:1px solid #9fc58a;color:#27500a;border-radius:6px;padding:7px 10px;font-size:0.76rem;margin-top:10px;">✓ Ya tiene folio en el sistema: <b>' + E(sa.folioConvertido) + 'A</b>. Los siguientes pagos se hacen desde ese folio (Pago parcial / Pago total).</div>' : '')
      + '<div style="' + EST_SEC + '">Datos del cliente</div>'
      + '<div id="sa-clientes">' + clientesDe(sa).map(filaCliente).join('') + '</div>'
      + '<button type="button" id="sa-add-cli" style="' + EST_ADD + '">＋ AGREGAR CLIENTE</button>'
      + '<div style="' + EST_SEC + '">Tipo de trámite</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;"><div id="sa-tipos" style="display:flex;gap:6px;flex-wrap:wrap;flex:1;">' + TIPOS_T.map(btnTipo).join('') + '</div>'
      + '<div style="width:130px;"><div style="' + EST_LB + '">Año del trámite</div><input id="sa-anio" value="' + E(sa ? (sa.anio || '') : String(new Date().getFullYear() - 1)) + '" inputmode="numeric" maxlength="4" style="' + EST_IN + '"></div></div>'
      + '<div style="' + EST_SEC + '">Conceptos y precios (lo que se pactó)</div>'
      + '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) 130px 26px;gap:6px;"><span style="' + EST_LB + '">Concepto</span><span style="' + EST_LB + '">Descripción</span><span style="' + EST_LB + 'text-align:right;">Precio</span><span></span></div>'
      + '<div id="sa-conceptos">' + conceptosDe(sa).map(filaConcepto).join('') + '</div>'
      + '<button type="button" id="sa-add-con" style="' + EST_ADD + '">＋ AGREGAR CONCEPTO</button>'
      + '<div style="' + EST_SEC + '">Pagos que ya dio · recibos de papel (no entran a caja)</div>'
      + '<div style="display:grid;grid-template-columns:140px minmax(0,1fr) 120px 130px 26px;gap:6px;"><span style="' + EST_LB + '">Fecha</span><span style="' + EST_LB + '">Concepto</span><span style="' + EST_LB + '">Folio de papel</span><span style="' + EST_LB + 'text-align:right;">Monto</span><span></span></div>'
      + '<div id="sa-pagos">' + pagosDe(sa).map(filaPago).join('') + '</div>'
      + '<button type="button" id="sa-add" style="' + EST_ADD + '">＋ AGREGAR PAGO ANTERIOR</button>'
      + ((sa && (sa.pagosSistema || []).length) ? '<div style="' + EST_SEC + '">Pagos ya registrados en el sistema</div>' + sa.pagosSistema.map(function(p){ return '<div style="font-size:0.76rem;padding:3px 0;">' + E(fL(p.fecha)) + ' · ' + E(p.concepto || 'Abono') + ' · <b>' + $m(p.monto) + '</b> <span style="font-size:0.66rem;background:#e6f1fb;color:#185fa5;border-radius:8px;padding:0 6px;">' + E(p.comprobante || 'Caja') + '</span></div>'; }).join('') : '')
      + '<div style="display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px;margin-top:14px;align-items:start;">'
      +   '<div><div style="' + EST_LB + '">Nota</div><input id="sa-nota" value="' + E(sa ? (sa.nota || '') : '') + '" placeholder="Agrega una nota para uso interno, no se imprime" style="' + EST_IN + '"></div>'
      +   '<div style="background:#faf3e2;border:1px solid #e1d6bb;border-radius:8px;padding:10px 12px;font-size:0.8rem;">'
      +     lin('Costo pactado', '<span id="sa-t-costo" style="font-family:monospace;"></span>')
      +     lin('Pagado en papel', '<span id="sa-t-papel" style="font-family:monospace;color:#a32d2d;"></span>')
      +     (sis ? lin('Cobrado en el sistema', '<span style="font-family:monospace;color:#a32d2d;">− ' + $m(sis) + '</span>') : '')
      +     '<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #b8862b;margin-top:5px;padding-top:6px;"><span style="' + EST_LB + 'margin:0;color:#2a1c08;font-weight:700;">Total de adeudo 🔒</span>'
      +     '<input id="sa-total" readonly tabindex="-1" title="Se calcula solo: costo pactado − pagos" style="width:130px;text-align:right;font-family:monospace;font-size:1rem;font-weight:800;color:#a32d2d;background:#efe8d6;border:1px solid #c8b88a;border-radius:6px;padding:5px 8px;cursor:not-allowed;"></div>'
      +   '</div>'
      + '</div>'
      + '<div id="sa-err" style="color:#a32d2d;font-size:0.76rem;min-height:1em;margin-top:8px;"></div>'
      + '<div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px;">'
      + (sa ? '<button type="button" id="sa-del" style="background:#fff;border:1px solid #c04040;color:#a32d2d;border-radius:6px;padding:7px 12px;font-size:0.72rem;cursor:pointer;">🗑 Eliminar</button>' : '<span></span>')
      + '<div style="display:flex;gap:8px;">'
      + '<button type="button" id="sa-cancel" style="background:#fff;border:1px solid #c8951a;color:#9a6e18;border-radius:6px;padding:7px 14px;font-size:0.74rem;cursor:pointer;">Cancelar</button>'
      + (sa && !convertido && debe(sa) > 0.005 ? '<button type="button" id="sa-cobrar" style="background:#c8781a;border:none;color:#fff;border-radius:6px;padding:7px 14px;font-size:0.74rem;font-weight:700;cursor:pointer;">💰 Cobrar</button>' : '')
      + '<button type="button" id="sa-ok" style="background:#9a6e18;border:none;color:#fff;border-radius:6px;padding:7px 16px;font-size:0.74rem;font-weight:700;cursor:pointer;">💾 GUARDAR</button>'
      + '</div></div></div></div>';
    document.body.appendChild(ov);
    var q = function(s){ return ov.querySelector(s); };
    var tipoSel = tipo;
    function fmtDinero(inp){ var v = String(inp.value || '').trim(); if (!v) return; inp.value = $m(r2(v)); }
    function leerClientes(){
      var out = [];
      ov.querySelectorAll('.sa-cli').forEach(function(r){
        var c = { nombre: r.querySelector('.sa-c-nom').value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '').replace(/\s+/g, ' ').trim(), movil: r.querySelector('.sa-c-mov').value.trim(), telCasa: r.querySelector('.sa-c-tel').value.trim(), domicilio: r.querySelector('.sa-c-dom').value.trim(), firma: !!(r.querySelector('.sa-c-firma') || {}).checked };
        if (c.nombre || c.movil || c.telCasa || c.domicilio) out.push(c);
      });
      if (out.length === 1) out[0].firma = true; // un solo cliente: él firma
      return out;
    }
    function leerConceptos(){
      var out = [];
      ov.querySelectorAll('.sa-con').forEach(function(r){
        var c = r.querySelector('.sa-k-con').value.trim().toUpperCase(), d = r.querySelector('.sa-k-des').value.trim(), pTxt = r.querySelector('.sa-k-pre').value.trim(), p = r2(pTxt);
        if (!c && !d && !pTxt) return;
        out.push({ concepto: c, descripcion: d, precio: p, _sinTexto: !c && !d });
      });
      return out;
    }
    function leerPagos(){
      var out = [];
      ov.querySelectorAll('.sa-pago').forEach(function(row){
        var f = row.querySelector('.sa-p-fecha').value, c = row.querySelector('.sa-p-conc').value.trim(), fo = row.querySelector('.sa-p-folio').value.trim(), m = r2(row.querySelector('.sa-p-monto').value);
        if (!f && !c && !fo && !m) return;
        out.push({ id: row.getAttribute('data-id') || ('PA-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)), fecha: f, concepto: c || 'Abono', folioPapel: fo, monto: m });
      });
      return out;
    }
    function recalcular(){
      var costo = r2(leerConceptos().reduce(function(s, c){ return s + r2(c.precio); }, 0));
      var pag = suma(leerPagos());
      q('#sa-t-costo').textContent = $m(costo);
      q('#sa-t-papel').textContent = '− ' + $m(pag);
      q('#sa-total').value = $m(Math.max(0, r2(costo - pag - sis)));
    }
    function enlazar(){
      ov.querySelectorAll('.sa-x').forEach(function(b){ b.onclick = function(){ var fila = b.parentNode, cont = fila.parentNode; fila.remove(); if (cont.id === 'sa-conceptos' && !cont.children.length) { var t = document.createElement('div'); t.innerHTML = filaConcepto({}); cont.appendChild(t.firstChild); enlazar(); } recalcular(); }; });
      ov.querySelectorAll('.sa-cli-x').forEach(function(b){ b.onclick = function(){ b.parentNode.remove(); visFirmas(); }; });
      ov.querySelectorAll('.sa-k-pre, .sa-p-monto').forEach(function(i){ i.oninput = recalcular; i.onblur = function(){ fmtDinero(i); recalcular(); }; i.onfocus = function(){ try { i.select(); } catch(e){} }; });
      ov.querySelectorAll('.sa-c-mov, .sa-c-tel').forEach(function(i){ i.oninput = function(){ try { if (typeof formatTelefono === 'function') formatTelefono(i); } catch(e){} }; });
      // Nombre: igual que en Generar recibo → MAYÚSCULAS, sin acentos y sin puntos
      ov.querySelectorAll('.sa-c-nom').forEach(function(i){ i.oninput = function(){ var p = i.selectionStart, antes = i.value.length; i.value = i.value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, ''); p -= (antes - i.value.length); try { i.setSelectionRange(p, p); } catch(e){} }; });
      ov.querySelectorAll('.sa-k-con').forEach(function(i){ i.oninput = function(){ var p = i.selectionStart; i.value = i.value.toUpperCase(); try { i.setSelectionRange(p, p); } catch(e){} }; });
    }
    function visFirmas(){
      var filas = ov.querySelectorAll('.sa-cli'), varios = filas.length > 1;
      filas.forEach(function(r, i){
        var l = r.querySelector('.sa-c-firma-lbl'); if (l) l.style.display = varios ? 'flex' : 'none';
        if (!varios) { var c = r.querySelector('.sa-c-firma'); if (c) c.checked = true; }
      });
    }
    function agregar(cont, html){ var t = document.createElement('div'); t.innerHTML = html; q(cont).appendChild(t.firstChild); enlazar(); var f = q(cont).lastElementChild.querySelector('input'); if (f) f.focus(); }
    q('#sa-add').onclick = function(){ agregar('#sa-pagos', filaPago({})); };
    q('#sa-add-con').onclick = function(){ agregar('#sa-conceptos', filaConcepto({})); };
    q('#sa-add-cli').onclick = function(){ agregar('#sa-clientes', filaCliente({ firma: false }, q('#sa-clientes').children.length || 1)); visFirmas(); };
    ov.querySelectorAll('.sa-tipo').forEach(function(b){ b.onclick = function(){
      tipoSel = b.getAttribute('data-t');
      ov.querySelectorAll('.sa-tipo').forEach(function(x){ var on = x === b; x.style.background = on ? '#fff4dd' : '#eee'; x.style.border = on ? '2px solid #b8862b' : '1px solid #c9c2b2'; x.style.color = on ? '#7a5410' : '#666'; });
    }; });
    enlazar(); recalcular(); visFirmas();
    // Oct-2026: si se escribió algo, avisar antes de cerrar sin guardar
    var _saSucio = false;
    var _saMarca = function(ev){ if (ev.isTrusted) _saSucio = true; };
    ov.addEventListener('input', _saMarca, true); ov.addEventListener('change', _saMarca, true);
    // Cierre normal (después de GUARDAR, Eliminar, etc.): sin preguntar.
    function cerrarOv(){ ov.remove(); }
    // Solo la ✕ y "Cancelar" preguntan, y solo si se escribió algo.
    function cerrarConAviso(){
      if (_saSucio && typeof window.lexDialogoCambios === 'function') {
        window.lexDialogoCambios({ cambios: [sa ? 'Recibo anterior' : 'Nuevo recibo anterior'], accion: 'cerrar', sinGuardar: true, onSalir: function(){ ov.remove(); } });
        return;
      }
      ov.remove();
    }
    q('#sa-x').onclick = cerrarConAviso; q('#sa-cancel').onclick = cerrarConAviso;
    function leerYValidar(){
      var err = q('#sa-err'); err.textContent = '';
      var clientes = leerClientes();
      if (!clientes.length || !clientes[0].nombre) { err.textContent = 'Escribe el nombre del cliente.'; return null; }
      if (clientes.some(function(c){ return !c.nombre; })) { err.textContent = 'A un cliente le falta el nombre (o quítalo con ✕).'; return null; }
      if (!clientes.some(function(c){ return c.firma; })) { err.textContent = 'Marca quién va a firmar (casilla "¿Va a firmar?").'; return null; }
      var conceptos = leerConceptos();
      if (!conceptos.length) { err.textContent = 'Agrega al menos un concepto con su precio.'; return null; }
      if (conceptos.some(function(c){ return c._sinTexto; })) { err.textContent = 'Hay un precio sin concepto. Escribe el concepto o quita el renglón.'; return null; }
      if (conceptos.some(function(c){ return !(c.precio > 0); })) { err.textContent = 'Cada concepto debe tener un precio mayor a $0.'; return null; }
      conceptos = conceptos.map(function(c){ return { concepto: c.concepto || 'HONORARIOS', descripcion: c.descripcion, precio: c.precio }; });
      var pagos = leerPagos();
      if (pagos.some(function(p){ return !(p.monto > 0); })) { err.textContent = 'Cada pago anterior debe tener monto mayor a $0.'; return null; }
      var costo = r2(conceptos.reduce(function(s, c){ return s + c.precio; }, 0));
      if (r2(costo - suma(pagos) - sis) < -0.005) { err.textContent = 'Los pagos (' + $m(suma(pagos) + sis) + ') suman más que el costo pactado (' + $m(costo) + ').'; return null; }
      var folios = foliosDe({ pagosAnteriores: pagos, formato: 2 });
      var c0 = conceptos[0];
      return {
        formato: 2, clientes: clientes, cliente: clientes[0].nombre, tel: clientes[0].movil || clientes[0].telCasa || '',
        tipoTramite: tipoSel, categoria: catDeTipo(tipoSel, sa && sa.categoria), anio: q('#sa-anio').value.trim(),
        conceptos: conceptos, costo: costo, debeManual: null,
        concepto: (c0.descripcion || c0.concepto) + (conceptos.length > 1 ? ' (+' + (conceptos.length - 1) + ')' : ''),
        pagosAnteriores: pagos, folioPapel: folios.join(', '), nota: q('#sa-nota').value.trim()
      };
    }
    // ¿Ya existe un recibo anterior del mismo cliente o con el mismo folio de papel?
    function posibleDuplicado(v2){
      var nombres = v2.clientes.map(function(c){ return N(c.nombre); }).filter(Boolean);
      var folios = foliosDe({ pagosAnteriores: v2.pagosAnteriores, formato: 2 }).map(N);
      return todos().filter(function(a){
        if (sa && a.id === sa.id) return false;
        var nomA = clientesDe(a).map(function(c){ return N(c.nombre); });
        var folA = foliosDe(a).map(N);
        return nomA.some(function(n){ return nombres.indexOf(n) >= 0; }) || folA.some(function(f){ return folios.indexOf(f) >= 0; });
      })[0] || null;
    }
    async function guardarForm(despues){
      var v2 = leerYValidar(); if (!v2) return;
      var dup = posibleDuplicado(v2);
      if (dup) {
        var fs = foliosDe(dup);
        ov.style.display = 'none';
        var otro = await preguntar('¿Es el mismo trámite?', String(dup.cliente).toUpperCase() + ' ya tiene un recibo anterior' + (fs.length ? ' (folios de papel ' + listaY(fs) + ')' : '') + ': ' + (dup.concepto || '') + '.\n\nSi es el mismo trámite, revisa el que ya existe y agrégale ahí los pagos, para no registrarlo dos veces.', 'Es otro trámite, guardar', 'Revisar el que ya existe');
        if (!otro) { cerrarOv(); window.lexFichaSaldoAnterior(dup.id); return; }
        ov.style.display = 'flex';
      }
      var ahora = new Date().toISOString(), idGuardado;
      if (sa) { Object.assign(sa, v2); sa.fechaMod = ahora; if (!sa.clave) sa.clave = nuevaClave(foliosDe(sa)[0]); idGuardado = sa.id; }
      else {
        idGuardado = 'SA-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        lista().unshift(Object.assign({ id: idGuardado, tipo: 'anterior', estado: 'pendiente',
          clave: nuevaClave(foliosDe(v2)[0]), pagosSistema: [], creadoPor: usuario(), fechaCreacion: ahora, fechaMod: ahora }, v2));
      }
      cerrarOv(); guardar(); toastS('✅ Recibo anterior guardado');
      if (despues) despues(idGuardado);
      else setTimeout(function(){ try { window.lexFichaSaldoAnterior(idGuardado); } catch(e){} }, 50);
    }
    q('#sa-ok').onclick = function(){ guardarForm(); };
    if (q('#sa-cobrar')) q('#sa-cobrar').onclick = function(){ guardarForm(function(id){ window.lexCobrarSaldoAnterior(id); }); };
    if (q('#sa-del')) q('#sa-del').onclick = async function(){
      var ok = await preguntar('Eliminar saldo', '¿Eliminar el saldo de años anteriores de ' + String(sa.cliente).toUpperCase() + '?' + ((sa.pagosSistema || []).length ? '\n\nLos cobros que ya entraron a Caja NO se borran de Caja.' : ''), 'Sí, eliminar', 'Cancelar');
      if (!ok) return;
      sa.eliminado = true; sa.eliminadoPor = usuario(); sa.fechaMod = new Date().toISOString();
      cerrarOv(); guardar(); toastS('🗑 Saldo eliminado');
    };
    if (!sa) setTimeout(function(){ var n = q('.sa-c-nom'); if (n) n.focus(); }, 30);
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
  // Lleva al formulario de Generar Recibo, ya llenado con TODO lo capturado:
  // clientes (nombre, móvil, tel. casa, domicilio), tipo de trámite, cada
  // concepto con su precio y, al final, el renglón "PAGADO ANTERIORMENTE" en
  // negativo (recibos de papel + cobros previos en caja). Así el total del
  // recibo = lo que debe, el anticipo = lo que paga hoy, y a Caja solo entra
  // el dinero de hoy (los pagos de papel no se vuelven a contar).
  function maxFolioActual(){
    var mx = 0; try { (appData.recibos || []).forEach(function(r){ var f = parseInt(r && r.folio, 10); if (f > mx) mx = f; }); } catch(e){}
    return mx;
  }
  function textoPagadoAntes(sa){
    var fs = foliosDe(sa), n = (sa.pagosAnteriores || []).length, sis = pagadoSistema(sa);
    var partes = ['Saldo de trámite iniciado en ' + (sa.anio || 'años anteriores')];
    if (fs.length) partes.push((fs.length > 1 ? 'Recibos de papel N° ' : 'Recibo de papel N° ') + listaY(fs));
    if (n) partes.push(n + (n === 1 ? ' pago' : ' pagos') + ' por ' + $m(pagadoAntes(sa)));
    if (sis > 0) partes.push('más ' + $m(sis) + ' cobrados en caja');
    return partes.join(' · ');
  }
  function prellenarRecibo(sa, totalDebe, montoHoy){
    var p0 = { id: sa.id, total: totalDebe, monto: montoHoy, ts: Date.now(), folioMax: maxFolioActual() };
    window._lexSAParaRecibo = p0;
    if (typeof ir === 'function') ir('nuevo-recibo');
    setTimeout(function(){
      try {
        window._lexSAParaRecibo = p0;
        var setV = function(el, v){ if (!el || v == null || v === '') return; el.value = v; try { el.dispatchEvent(new Event('input')); } catch(e){} };
        // 1) Clientes
        clientesDe(sa).forEach(function(c, i){
          if (i > 0 && typeof agregarCliente === 'function') agregarCliente();
          var filas = document.querySelectorAll('#clientes-wrapper .cliente-row'), fila = filas[i] || filas[filas.length - 1];
          if (!fila) return;
          setV(fila.querySelector('[id^="nombre_"]'), String(c.nombre || '').toUpperCase());
          setV(fila.querySelector('[id^="movil_"]'), c.movil);
          setV(fila.querySelector('[id^="tel_"]'), c.telCasa);
          setV(fila.querySelector('[id^="domicilio_"]'), c.domicilio);
          var chk = fila.querySelector('[id^="firmante_"]');
          if (chk) chk.checked = (c.firma != null) ? !!c.firma : i === 0;
        });
        try { if (typeof sincronizarFirmantesClientes === 'function') sincronizarFirmantesClientes(); } catch(e){}
        // 2) Tipo de trámite (mismos botones)
        try { if (typeof setTipoTramite === 'function') setTipoTramite(tipoDe(sa)); } catch(e){}
        // Hubo un costo pactado: en escrituras/juicio se marca "Con costo pactado"
        try { var tt = tipoDe(sa); if ((tt === 'escritura' || tt === 'juicio') && typeof setModoCosto === 'function') setModoCosto('pactado'); } catch(e){}
        // 3) Conceptos + renglón de lo ya pagado
        var tb = document.getElementById('conceptos-tbody');
        if (tb) {
          tb.innerHTML = '';
          try { if (typeof conceptoCount !== 'undefined') conceptoCount = 0; } catch(e){}
          var poner = function(f, bloqueado){
            if (typeof agregarConcepto === 'function') agregarConcepto();
            var tr = tb.lastElementChild; if (!tr) return;
            var taC = tr.querySelector('textarea.concepto'), taD = tr.querySelector('textarea.descripcion'), inP = tr.querySelector('input.precio');
            if (taC) taC.value = String(f.concepto || '').toUpperCase();
            if (taD) taD.value = f.descripcion || '';
            if (inP) inP.value = (f.precio < 0 ? '-' : '') + (typeof fmtMXN === 'function' ? fmtMXN(Math.abs(f.precio)) : String(Math.abs(f.precio)));
            if (bloqueado) {
              tr.setAttribute('data-lex-antecedente', '1');
              [taC, taD, inP].forEach(function(x){ if (x) { x.readOnly = true; x.style.background = '#f3ece0'; x.style.color = '#a32d2d'; x.title = 'Lo que ya pagó antes (recibos de papel). No se modifica aquí.'; } });
              var del = tr.querySelector('.del-concept'); if (del) del.style.visibility = 'hidden';
            }
            try { tr.querySelectorAll('.concepto-ta').forEach(function(ta){ if (typeof _autoGrowConceptoTA === 'function') _autoGrowConceptoTA(ta); }); } catch(e){}
          };
          conceptosDe(sa).forEach(function(c){ poner({ concepto: c.concepto, descripcion: c.descripcion, precio: r2(c.precio) }, false); });
          var yaPagado = r2(pagadoAntes(sa) + pagadoSistema(sa));
          var costoTotal = r2(conceptosDe(sa).reduce(function(s, c){ return s + r2(c.precio); }, 0));
          // Si por algo el costo no cuadra con lo que debe, el renglón negativo lo ajusta
          var ajuste = r2(costoTotal - totalDebe);
          if (ajuste > 0.005) poner({ concepto: 'PAGADO ANTERIORMENTE', descripcion: textoPagadoAntes(sa), precio: -ajuste }, true);
          else if (yaPagado <= 0.005) { var d1 = tb.querySelector('textarea.descripcion'); if (d1 && d1.value.indexOf('Saldo de trámite') < 0) d1.value = (d1.value ? d1.value + ' · ' : '') + textoPagadoAntes(sa); }
          try { if (typeof calcTotales === 'function') calcTotales(); } catch(e){}
        }
        // 4) Anticipo = lo que paga hoy
        var elA = document.getElementById('anticipo');
        if (elA) { elA.value = typeof fmtMXN === 'function' ? fmtMXN(montoHoy) : String(montoHoy); try { elA.dispatchEvent(new Event('input')); } catch(e){} try { if (typeof calcTotales === 'function') calcTotales(); } catch(e){} }
        toastS('✓ Recibo pre-llenado con el recibo anterior — revisa y pulsa Imprimir', 'ok');
      } catch(e){ console.warn('[SaldosAnteriores] pre-llenado:', e); }
    }, 700);
  }

  // ── Ligar el saldo con el recibo que se acaba de generar ─────────────
  // 1) Si se abrió desde "Cobrar": el primer folio A NUEVO del mismo cliente.
  // 2) Si no: folio A del mismo cliente cuyo concepto trae "Saldo de trámite
  //    iniciado en …" y alguno de sus folios de papel.
  window.lexVincularSaldosAnteriores = function(){
    var recs = []; try { recs = (typeof appData !== 'undefined' && appData && Array.isArray(appData.recibos)) ? appData.recibos : []; } catch(e){}
    var ligados = {}; todos().forEach(function(a){ if (a.folioConvertido != null) ligados[String(a.folioConvertido)] = 1; });
    var cambio = false;
    todos().filter(function(a){ return a.estado !== 'convertido'; }).forEach(function(sa){
      var p = window._lexSAParaRecibo && window._lexSAParaRecibo.id === sa.id ? window._lexSAParaRecibo : null;
      var nomsSA = clientesDe(sa).map(function(c){ return N(c.nombre); });
      var fs = foliosDe(sa).map(N);
      var cand = recs.filter(function(r){
        if (!r || r.cancelado || r.esComplemento || String(r.letra || 'A').toUpperCase() !== 'A' || ligados[String(r.folio)]) return false;
        var nombres = [r.nombre].concat((r.clientes || []).map(function(c){ return c && c.nombre; })).map(N);
        if (!nombres.some(function(x){ return nomsSA.indexOf(x) >= 0; })) return false;
        if (p && p.folioMax != null && parseInt(r.folio, 10) > p.folioMax) return true;
        var txt = N((r.conceptos || []).map(function(c){ return (c && (c.concepto || '')) + ' ' + (c && (c.descripcion || '')); }).join(' '));
        if (txt.indexOf('SALDO DE TRAMITE INICIADO EN') < 0) return false;
        if (fs.length && !fs.some(function(f){ return txt.indexOf(f) >= 0; })) return false;
        return true;
      }).sort(function(a, b){ return (b.folio || 0) - (a.folio || 0); })[0];
      if (!cand) return;
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
        personas: clientesDe(sa).map(function(c){ return { nombre: String(c.nombre || '').trim(), tel: String(c.movil || c.telCasa || '').trim() }; }),
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
      + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><span><b>📄 ANTECEDENTES (antes del sistema)</b>' + (foliosDe(sa).length ? ' · Papel <b>N° ' + E(listaY(foliosDe(sa))) + '</b>' : '') + (sa.anio ? ' · ' + E(sa.anio) : '') + (sa.costo != null && sa.costo !== '' ? ' · Costo pactado ' + $m(sa.costo) : '') + '</span>'
      + '<button type="button" onclick="lexAbrirSaldoAnterior(\'' + E(sa.id) + '\')" style="font-size:0.66rem;border:1px solid #b4b2a9;background:#fff;color:#444441;border-radius:5px;padding:2px 8px;cursor:pointer;">Ver / editar</button></div>'
      + (pa.length ? '<div style="margin-top:4px;font-size:0.72rem;">' + pagosDe(sa).map(function(p){ return E(fL(p.fecha)) + ' ' + E(p.concepto || 'Abono') + (p.folioPapel ? ' (papel ' + E(p.folioPapel) + ')' : '') + ' ' + $m(p.monto); }).join(' · ') + ' → <b>Pagado antes: ' + $m(pagadoAntes(sa)) + '</b></div>' : '')
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
    var a = pagosDe(sa).map(function(p){ return { fecha: p.fecha, concepto: p.concepto || 'Abono', comprobante: p.folioPapel ? 'papel ' + p.folioPapel : 'papel', monto: r2(p.monto), papel: true }; });
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
      + '<div style="font-size:0.6rem;color:#9a8a6a;letter-spacing:0.08em;font-family:monospace;">' + (clientesDe(sa).length > 1 ? 'CLIENTES' : 'CLIENTE') + ' · ' + E((TIPOS_T.filter(function(t){ return t[0] === tipoDe(sa); })[0] || ['', ''])[1]) + '</div>'
      + clientesDe(sa).map(function(c){ var tels = [c.movil, c.telCasa].filter(Boolean).join(' / ');
          return '<div style="margin-top:3px;"><div style="font-size:0.95rem;font-weight:700;">' + E(String(c.nombre || '').toUpperCase()) + '</div>'
            + '<div style="font-size:0.72rem;color:#7a6840;">' + (tels ? '📞 ' + E(tels) : 'Sin teléfono') + (c.domicilio ? ' · 🏠 ' + E(c.domicilio) : '') + '</div></div>'; }).join('')
      + '<div style="font-size:0.74rem;color:#7a6840;margin-top:3px;">' + (sa.anio ? 'Trámite iniciado en ' + E(sa.anio) : '') + (foliosDe(sa).length ? ' · 📄 papel N° ' + E(listaY(foliosDe(sa))) : '') + '</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:0.76rem;margin-top:8px;table-layout:fixed;"><colgroup><col style="width:34%"><col><col style="width:110px"></colgroup>'
      +   conceptosDe(sa).map(function(c){ return '<tr style="border-top:1px solid #eadfbf;"><td style="padding:4px 6px;font-weight:700;color:#1a5fa8;">' + E(String(c.concepto || '').toUpperCase()) + '</td><td style="padding:4px 6px;color:#5a4a30;">' + E(c.descripcion || '') + '</td><td style="padding:4px 6px;text-align:right;font-family:monospace;">' + $m(c.precio) + '</td></tr>'; }).join('')
      + '</table>'
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
    var y2 = y;
    clientesDe(sa).forEach(function(c, i){
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 16, 8);
      doc.text(String(c.nombre || '').toUpperCase(), M, y2);
      var det = [[c.movil, c.telCasa].filter(Boolean).join(' / '), c.domicilio].filter(Boolean).join(' · ');
      if (det) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 74, 48); var ld = doc.splitTextToSize(det, W - 2 * M); doc.text(ld, M, y2 + 4.5); y2 += 4.5 + ld.length * 3.8; }
      else y2 += 3;
      y2 += 2;
    });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 74, 48);
    var fs = foliosDe(sa);
    doc.text((fs.length ? (fs.length > 1 ? 'Recibos de papel N° ' : 'Recibo de papel N° ') + listaY(fs) : 'Sin folio de papel') + (sa.anio ? ' · Trámite iniciado en ' + sa.anio : ''), M, y2 + 1);
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
    // Un renglón por concepto pactado (como en el recibo) y lo ya pagado en papel
    var renglon = function(txt, imp, color){
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor.apply(doc, color || [26, 16, 8]);
      var ls = doc.splitTextToSize(txt, W - 70); doc.text(ls, 16, y); doc.text(imp, W - 16, y, { align: 'right' });
      y += ls.length * 3.8 + 2.2;
    };
    conceptosDe(sa).forEach(function(c){ renglon(String(c.concepto || '').toUpperCase() + (c.descripcion ? ' — ' + c.descripcion : ''), $m(c.precio)); });
    if ((sa.pagosAnteriores || []).length) { var fsP = foliosDe(sa); renglon('Pagado anteriormente (' + sa.pagosAnteriores.length + (sa.pagosAnteriores.length === 1 ? ' pago' : ' pagos') + ')' + (fsP.length ? ' — recibo(s) de papel N° ' + listaY(fsP) : ''), '- ' + $m(pagadoAntes(sa)), [163, 45, 45]); }
    if ((sa.pagosSistema || []).length) y = filaTabla(doc, y, cols, ['Pagos ya registrados en el sistema (' + sa.pagosSistema.length + ')', '- ' + $m(pagadoSistema(sa))]);
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
  // Oct-2026: se abre como PÁGINA completa (panel), igual que Pendientes
  window.lexListaRecibosAnteriores = function(){ if (typeof ir === 'function') ir('recibos-anteriores'); };
  window.lexRAToggle = function(){ _verPagadosRA = !_verPagadosRA; pintarListaRA(); };
  function pintarListaRA(){
    var cont = document.getElementById('ra-panel-lista');
    window.lexBadgeRecibosAnteriores();
    if (!cont) return;
    var q = N((document.getElementById('raQ') || {}).value || '');
    var pend = pendientesRA();
    var base = _verPagadosRA ? todos().filter(function(a){ return pend.indexOf(a) < 0; }) : pend;
    var lst = base.filter(function(a){ return !q || N([a.cliente, a.folioPapel, foliosDe(a).join(' '), clientesDe(a).map(function(c){ return c.nombre + ' ' + (c.movil || '') + ' ' + (c.telCasa || ''); }).join(' '), a.concepto, a.anio, a.tel, a.folioConvertido].join(' ')).indexOf(q) >= 0; })
      .sort(function(a, b){ return String(ultimaFecha(a)).localeCompare(String(ultimaFecha(b))); });
    var bt = document.getElementById('raBtnPagados'); if (bt) bt.textContent = _verPagadosRA ? '← Pendientes' : '✓ Con folio / pagados';
    var cn = document.getElementById('raCountNum'); if (cn) cn.textContent = pend.length;
    var rs = document.getElementById('ra-resumen');
    if (rs) rs.innerHTML = _verPagadosRA ? 'Recibos anteriores que ya tienen folio real o están pagados.' : 'Deben en total: <b style="color:#a32d2d;font-family:monospace;font-size:0.95rem;">' + $m(pend.reduce(function(t, a){ return t + debe(a); }, 0)) + '</b>';
    if (!lst.length) { cont.innerHTML = '<div style="text-align:center;color:var(--muted,#7a6a4a);padding:40px 20px;font-size:0.82rem;line-height:1.8;">' + (q ? 'Ninguno coincide con la búsqueda.' : (_verPagadosRA ? 'Todavía no hay recibos anteriores con folio o pagados.' : 'No hay recibos anteriores pendientes.<br>Usa <b>＋ Nuevo recibo anterior</b> para registrar un trámite de años anteriores que todavía tenga saldo.')) + '</div>'; return; }
    cont.innerHTML = lst.map(function(a){
      var d = debe(a), conv = a.estado === 'convertido', col = conv ? '#1a7a3a' : (d > 0.005 ? '#8c6518' : '#1a7a3a');
      return '<div class="ra-fila" data-id="' + E(a.id) + '" style="position:relative;display:flex;align-items:stretch;background:var(--surface,#fdfaf4);border:1.5px solid var(--border-l,#d4b870);border-radius:8px;margin-bottom:8px;overflow:hidden;">'
        + '<div style="width:5px;background:' + col + ';flex-shrink:0;"></div>'
        + '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 14px;min-width:78px;border-right:1px dashed rgba(0,0,0,0.08);line-height:1.15;">'
        +   '<span style="font-size:0.56rem;font-weight:700;letter-spacing:0.06em;color:#a8987a;">AÑO</span><span style="font-family:monospace;font-weight:900;font-size:1.05rem;color:#5f5e5a;">' + E(a.anio || '—') + '</span>'
        +   '<span style="margin-top:4px;font-size:0.7rem;font-weight:700;color:#8a4a10;background:#fdf0dc;border-radius:8px;padding:1px 7px;white-space:nowrap;" title="' + E(foliosDe(a).join(', ')) + '">📄 ' + E(foliosDe(a).length > 1 ? foliosDe(a)[0] + ' +' + (foliosDe(a).length - 1) : (foliosDe(a)[0] || 'S/N')) + '</span></div>'
        + '<div style="flex:1;min-width:0;padding:10px 12px;cursor:pointer;" class="ra-abrir" title="Abrir ficha">'
        +   '<div style="font-size:13.5px;font-weight:600;color:' + (conv ? '#1a7a3a' : '#2e7d32') + ';text-transform:uppercase;letter-spacing:0.025em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">👤 ' + E(a.cliente || '') + '</div>'
        +   '<div style="font-size:12.5px;font-weight:600;color:var(--ink,#1a1008);margin-top:2px;">' + E(a.concepto || '') + '</div>'
        +   '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;align-items:center;font-size:0.66rem;">'
        +     '<span style="background:#f1efe8;color:#5f5e5a;border-radius:3px;padding:2px 7px;">🗂 Recibo anterior</span>'
        +     (a.tel ? '<span style="background:rgba(0,0,0,0.04);color:#5a4a30;border-radius:3px;padding:2px 7px;">📞 ' + E(a.tel) + '</span>' : '<span style="color:#a32d2d;">sin teléfono</span>')
        +     '<span style="background:rgba(0,0,0,0.04);color:#5a4a30;border-radius:3px;padding:2px 7px;">Último pago ' + E(fL(ultimaFecha(a))) + '</span>'
        +     ((a.pagosAnteriores || []).length ? '<span style="background:rgba(0,0,0,0.04);color:#5a4a30;border-radius:3px;padding:2px 7px;">' + a.pagosAnteriores.length + ' pago(s) de papel</span>' : '')
        +   '</div>'
        +   (a.nota ? '<div style="font-size:10px;color:#7a4a10;font-style:italic;margin-top:5px;padding:4px 8px;background:rgba(200,149,42,0.07);border-radius:4px;">' + E(a.nota) + '</div>' : '')
        +   (a.creadoPor ? '<div style="font-size:8.5px;color:#9a8a6a;margin-top:5px;padding-top:4px;border-top:1px dashed rgba(0,0,0,0.08);">📤 Capturado por: <strong style="color:#6a5a3a;">' + E(a.creadoPor) + '</strong>' + (a.fechaCreacion ? ' · ' + E(String(a.fechaCreacion).slice(0, 10)) : '') + '</div>' : '')
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;padding:10px 12px;gap:6px;flex-shrink:0;">'
        +   '<div style="text-align:right;line-height:1.1;"><div style="font-family:monospace;font-size:0.55rem;letter-spacing:0.1em;color:#8c6518;font-weight:700;">' + (conv ? 'FOLIO' : 'DEBE') + '</div>'
        +   '<div style="font-size:1.05rem;font-weight:800;color:' + (conv ? '#1a4a8a' : (d > 0.005 ? '#a32d2d' : '#1a7a3a')) + ';">' + (conv ? E(a.folioConvertido) + 'A' : (d > 0.005 ? $m(d) : '✓ Pagado')) + '</div></div>'
        +   '<div style="display:flex;gap:5px;align-items:center;">'
        +     ((typeof lexBtnLlamada === 'function') ? lexBtnLlamada('ra', a.id, 'padding:4px 9px;') : '')
        +     (!conv && d > 0.005 ? '<button type="button" class="ra-cobrar" style="background:#c8781a;color:#fff;border:none;border-radius:5px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;">💰 Cobrar</button>' : '')
        +     '<button type="button" class="ra-ficha" style="background:#e6f1fb;color:#1a3a70;border:1px solid #b5d4f4;border-radius:5px;padding:4px 10px;font-size:10px;font-weight:700;cursor:pointer;">📋 Ficha</button>'
        +   '</div></div></div>';
    }).join('');
    cont.querySelectorAll('.ra-fila').forEach(function(f){
      var id = f.getAttribute('data-id');
      f.querySelector('.ra-abrir').onclick = function(){ window.lexFichaSaldoAnterior(id); };
      f.querySelector('.ra-ficha').onclick = function(){ window.lexFichaSaldoAnterior(id); };
      var c = f.querySelector('.ra-cobrar'); if (c) c.onclick = function(){ window.lexCobrarSaldoAnterior(id); };
    });
  }
  // Pintar al entrar a la página
  (function(){
    var orig = window.ir;
    if (typeof orig !== 'function' || orig._lexRA) return;
    var env = function(p){ var r = orig.apply(this, arguments); if (p === 'recibos-anteriores') { try { window.lexVincularSaldosAnteriores(); } catch(e){} pintarListaRA(); } return r; };
    env._lexRA = true; window.ir = env;
  })();
  window._lexRAPintar = pintarListaRA;
  setTimeout(window.lexBadgeRecibosAnteriores, 4000);
  setInterval(function(){ try { window.lexBadgeRecibosAnteriores(); } catch(e){} }, 30000);
  window._lexSAPdfEstado = pdfEstadoCuenta;
})();
