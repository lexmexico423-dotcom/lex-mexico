// Token anti-carrera: si el usuario abre otro folio antes de que termine de
// cargar (async, R2) el anterior, la respuesta tardía de ese folio anterior
// ya NO debe pisar el badge/tabla del folio que está visible ahora. Mismo
// patrón que _modoConsultaToken en activarModoConsulta.
window._fichaAbrirToken = window._fichaAbrirToken || 0;

// ═══════════════════════════════════════════════════════════════════
// ESTADO DE CUENTA — ventana flotante + PDF formal (diseño ya aprobado).
// Reutiliza la MISMA lógica de costo/abonado por versión que ya usa la
// Ficha del Folio (congelado por recibo, nunca recalculado contra el
// estado actual), pero el ADEUDO aquí es HORIZONTAL por fila (cargo -
// abono de ESA fila únicamente) — el saldo real del folio solo aparece
// en el TOTAL de la columna ADEUDO (suma vertical), tal como se acordó.
// ═══════════════════════════════════════════════════════════════════
function _fechaCortaEC(iso){
  if(!iso) return '—';
  var m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return String(iso);
  var MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return m[3]+'/'+MESES[parseInt(m[2],10)-1]+'/'+m[1].slice(2);
}
function _calcularEstadoCuenta(folioNum){
  if(typeof appData==='undefined' || !Array.isArray(appData.recibos)) return null;
  var recibo=appData.recibos.find(function(r){ return r && Number(r.folio)===Number(folioNum) && !r.esComplemento && (r.letra||'A')==='A'; });
  if(!recibo) return null;
  var todosRec=appData.recibos.filter(function(r){ return r && Number(r.folio)===Number(folioNum) && !r.esComplemento; });
  todosRec.sort(function(a,b){ return String(a.letra||'A').localeCompare(b.letra||'A'); });
  var _ceKeyFn=function(ce){ return (ce.concepto||'')+'|'+(ce.descripcion||'')+'|'+String(ce.precio||'')+'|'+(ce.fechaHora||''); };

  var filas=[], totCargo=0, totAbono=0;
  var _prevSaldoEC=0; // saldo restante encadenado versión a versión (adeudo anterior de la siguiente fila)
  todosRec.forEach(function(r){
    var rletra=r.letra||(typeof letraVersion==='function'?letraVersion(r):'A')||'A';
    var rfStr=typeof folioConLetra==='function'?folioConLetra(r.folio,r.anio_folio,rletra):r.folio+rletra;
    var esOrig=rletra==='A' && !r.esComplemento;

    var _ceRowMap={};
    (r.costosExtra||[]).forEach(function(ce){
      if(!ce) return;
      if((ce.folioLetra||'').toUpperCase()!==rletra.toUpperCase()) return;
      _ceRowMap[_ceKeyFn(ce)]=ce;
    });
    var ceRow=Object.keys(_ceRowMap).map(function(k){return _ceRowMap[k];}).filter(function(ce){
      return parseFloat(ce.precio||0)>0 || (ce.concepto||'').trim();
    });
    var ceAgregadoTotal=0, ceExactoTotal=0;
    ceRow.forEach(function(ce){
      var precio=parseFloat(ce.precio||0);
      var montoLiq=parseFloat(ce.montoLiquidado||0);
      var esExacto=!!ce.liquidadoAlMomento && montoLiq===precio && precio>0;
      ceAgregadoTotal+=precio;
      if(esExacto) ceExactoTotal+=precio;
    });

    var rc0=r.conceptos && r.conceptos[0];
    // Cuando el recibo original (letra A) tiene VARIOS conceptos, el PDF del
    // recibo ya los muestra como renglones separados con su propio costo cada
    // uno (ver "SUMA TOTAL DEL TRÁMITE"). El Estado de Cuenta antes solo
    // tomaba el PRIMER concepto para el texto y usaba la suma como cargo — el
    // resto de conceptos quedaba oculto. Aquí se detectan para desglosarlos
    // más abajo, uno por fila, igual que en el recibo.
    var _conceptosOrigEC = esOrig ? (r.conceptos||[]).filter(function(c){
      return c && ((c.concepto||'').trim() || parseFloat(c.precio||0)>0);
    }) : [];
    var costo, abonado;
    if(esOrig){
      var totalPactado=parseFloat(r.total||0);
      if(totalPactado>0){ costo=totalPactado; abonado=parseFloat(r.anticipo||0); }
      else { costo=parseFloat(r.anticipo||0); abonado=costo; }
    } else {
      costo=ceAgregadoTotal;
      var _seenPP={};
      abonado=ceExactoTotal + (r.pagosParciales||[]).filter(Boolean).filter(function(p){
        return (p.folioLetra||rletra).toUpperCase()===rletra.toUpperCase();
      }).reduce(function(s,p){
        var k=(p.fechaHora||'')+'|'+String(p.cantidad||'')+'|'+(p.folioLetra||'');
        if(_seenPP[k]) return s; _seenPP[k]=1;
        return s+(parseFloat(p.cantidad)||0);
      },0);
    }
    // Adeudo anterior (lo que traía el folio ANTES de esta transacción) y
    // saldo restante (lo que queda DESPUÉS) — encadenado versión a versión,
    // igual que ya hace la Ficha del Folio (_prevRestaFrozenSC). NO se lee
    // r.saldoPendiente aquí: ese campo resultó NO ser un snapshot histórico
    // por versión — en la práctica todas las versiones del folio terminan
    // mostrando el MISMO saldoPendiente (el actual), así que usarlo directo
    // hacía que 64A mostrara el saldo final ($20,000) en vez del suyo propio
    // ($31,000). La cadena calculada a mano (adeudoAnterior + costo - abonado)
    // es la que ya se probó correcta en la Ficha del Folio.
    var adeudoAnterior = esOrig ? 0 : _prevSaldoEC;
    var saldoRestante = Math.max(0, adeudoAnterior + costo - abonado);
    _prevSaldoEC = saldoRestante;
    var adeudo = saldoRestante; // se mantiene el nombre de campo por compatibilidad; ahora es el saldo restante encadenado, no el neto horizontal de la fila
    // "liquidado" para las ETIQUETAS (PAGO TOTAL/PARCIAL, LIQUIDACIÓN TOTAL/
    // ABONO PARCIAL) refleja si esta versión dejó el FOLIO completo en $0 —
    // antes se usaba el neto horizontal de la fila (costo-abonado), que en una
    // versión sin Servicio Complementario siempre daba $0 porque "costo" ahí
    // es 0 por diseño (no hay cargo nuevo), y por eso CUALQUIER pago parcial
    // se etiquetaba como PAGO TOTAL/LIQUIDACIÓN TOTAL (folio real 64B: saldo
    // pendiente $20,000 mostrado como liquidado a $0).
    var liquidadoFolio = saldoRestante<=0.005;
    var tipoRecibo=esOrig?'PAGO INICIAL':(ceRow.length?'SERV. COMPL.':(liquidadoFolio?'PAGO TOTAL':'PAGO PARCIAL'));

    var concepto, descripcion;
    if(esOrig){
      concepto=rc0?(rc0.concepto||'').trim():'ANTICIPO INICIAL';
      descripcion=rc0?(rc0.descripcion||'').trim():'';
    } else if(ceRow.length){
      concepto=ceRow.map(function(ce){return (ce.concepto||'Servicio complementario').trim();}).join(' · ');
      descripcion=ceRow.map(function(ce){return (ce.descripcion||'').trim();}).filter(Boolean).join(' · ');
    } else {
      concepto=liquidadoFolio?'LIQUIDACIÓN TOTAL':'ABONO PARCIAL';
      descripcion='DEL ADEUDO ANTERIOR';
    }
    var fechaRec=(rletra!=='A' && r.fechaActualizacion)?r.fechaActualizacion:(r.fecha_recibo||r.fecha||'');

    // Recibo de cancelación: el trámite quedó sin efecto — ya no es un "pago
    // total"/"abono", así que se etiqueta y describe como tal (evita mostrar
    // "PAGO TOTAL / LIQUIDACIÓN TOTAL" en una fila que en realidad anuló el cargo).
    if(r.cancelado){
      tipoRecibo='CANCELACIÓN';
      var _motivoEC=(r.motivoCancelacion||'').split(' — Autoriz')[0].trim();
      concepto='Trámite cancelado';
      descripcion=_motivoEC||'Ver recibo de cancelación';
      _prevSaldoEC = 0; // no arrastrar adeudo fantasma a una versión posterior tras cancelar
    }

    totCargo+=costo; totAbono+=abonado;
    if(esOrig && !r.cancelado && _conceptosOrigEC.length > 1){
      // Desglose: una fila por concepto (mismo total que antes, pero visible
      // cada partida). El abono/anticipo se aplica hasta la última fila del
      // desglose, y el saldo se encadena entre ellas igual que entre versiones.
      var _acumAdeudoAntEC = adeudoAnterior;
      _conceptosOrigEC.forEach(function(cOrig, ciEC){
        var _esUltimoCEC = ciEC === _conceptosOrigEC.length - 1;
        var _costoCEC = parseFloat(cOrig.precio||0);
        var _abonoCEC = _esUltimoCEC ? abonado : 0;
        var _saldoCEC = Math.max(0, _acumAdeudoAntEC + _costoCEC - _abonoCEC);
        filas.push({
          folioStr:rfStr, tipo:tipoRecibo, fecha:fechaRec,
          concepto:(cOrig.concepto||'').trim()||'ANTICIPO INICIAL',
          descripcion:(cOrig.descripcion||'').trim(),
          cargo:_costoCEC, adeudoAnterior:_acumAdeudoAntEC, abono:_abonoCEC, adeudo:_saldoCEC, cancelado:false
        });
        _acumAdeudoAntEC = _saldoCEC;
      });
    } else {
      filas.push({
        folioStr:rfStr, tipo:tipoRecibo, fecha:fechaRec, concepto:concepto, descripcion:descripcion,
        cargo:costo, adeudoAnterior:adeudoAnterior, abono:abonado, adeudo:adeudo, cancelado:!!r.cancelado
      });
    }
  });

  var c0=recibo.conceptos && recibo.conceptos[0];
  var rlActual=recibo.letra||'A';
  // Placas: se toman del ÚLTIMO recibo (versión de letra más reciente) — si el
  // trámite no es de vehículos ese campo simplemente viene vacío.
  var _ultimoRec=todosRec.length?todosRec[todosRec.length-1]:recibo;
  var _placaEC=(_ultimoRec && _ultimoRec.placa)?String(_ultimoRec.placa).trim():'';
  // Si la ÚLTIMA versión del folio quedó cancelada, el "ADEUDO" total ya no
  // representa un saldo pendiente real (el trámite se anuló) — se reemplaza
  // por el estado de cancelación + el monto de la cancelación (reintegro al
  // cliente, honorarios a favor del despacho, o sin movimiento).
  var _folioCanceladoEC = !!(_ultimoRec && _ultimoRec.cancelado);
  var _canMontoEC = _folioCanceladoEC ? parseFloat(_ultimoRec.cancelacionMonto||0) : 0;
  var _canTipoEC  = _folioCanceladoEC ? (_ultimoRec.cancelacionTipo||'') : '';
  // Sin Costo Total Pactado (Juicio/Escritura en modo "abierto"): que el saldo
  // encadenado dé $0 en un momento dado NO significa que el trámite terminó —
  // solo significa que no hay adeudo POR AHORA, porque el costo total nunca
  // se fijó de antemano. Solo se considera realmente concluido cuando el
  // usuario lo cierra explícitamente con el botón "Cerrar Juicio/Escritura"
  // (modoCosto pasa a 'cerrado'), igual que ya hace la Ficha del Folio.
  var _abiertoEC = (typeof window._abiertoSinCosto === 'function') && window._abiertoSinCosto(recibo);
  // El folio del encabezado SIEMPRE es la letra A (identificador primario del
  // folio) — nunca la letra de la última versión/liquidación.
  return {
    folio:folioNum,
    folioStr:typeof folioConLetra==='function'?folioConLetra(folioNum, recibo.anio_folio, 'A'):(folioNum+'A'),
    nombre:recibo.nombre||'',
    tramite:c0?(c0.concepto||''):'',
    contacto:(recibo.clientes&&recibo.clientes[0]?(recibo.clientes[0].movil||recibo.clientes[0].tel):'')||recibo.movil||'',
    domicilio:(recibo.clientes&&recibo.clientes[0]?recibo.clientes[0].domicilio:'')||recibo.domicilio||'',
    placa:_placaEC,
    abierto:_abiertoEC,
    filas:filas,
    totales:{
      cargo:totCargo, abono:totAbono,
      adeudo: _folioCanceladoEC ? 0 : Math.max(0,totCargo-totAbono),
      cancelado:_folioCanceladoEC, cancelacionTipo:_canTipoEC, cancelacionMonto:_canMontoEC
    }
  };
}
// ── Ventana flotante (se puede cerrar) ──
function abrirEstadoCuenta(folioParam){
  var folioNum = folioParam!=null ? Number(folioParam) : (reciboEnConsulta ? Number(reciboEnConsulta.folio) : null);
  if(folioNum==null || isNaN(folioNum)){ if(typeof toast==='function') toast('Primero consulta un folio','err'); return; }
  var datos=_calcularEstadoCuenta(folioNum);
  if(!datos){ if(typeof toast==='function') toast('No encontré datos de este folio','err'); return; }
  window._estadoCuentaDatos = datos;
  var fmt=function(v){ return typeof fmtMXN==='function'?fmtMXN(parseFloat(v||0)):parseFloat(v||0).toFixed(2); };
  var esc=function(s){ return (typeof escHTML==='function')?escHTML(s||''):(s||''); };

  var filasHtml = datos.filas.map(function(f){
    var colAdeudo = f.adeudo>0 ? '#c8701a' : '#1a7a3a';
    var _tachaEC = f.cancelado ? 'text-decoration:line-through;' : '';
    return '<tr style="border-bottom:1px solid #ecdfa8;'+(f.cancelado?'opacity:0.65;':'')+'">'
      +'<td style="padding:5px 8px;font-weight:700;color:'+(f.cancelado?'#8a1a1a':'#1a5fa8')+';font-family:monospace;">'+esc(f.folioStr)+'</td>'
      +'<td style="padding:5px 8px;'+(f.cancelado?'color:#8a1a1a;font-weight:700;':'')+'">'+esc(f.tipo)+'</td>'
      +'<td style="padding:5px 8px;font-family:monospace;">'+esc(_fechaCortaEC(f.fecha))+'</td>'
      +'<td style="padding:5px 8px;">'+esc(f.concepto)+'</td>'
      +'<td style="padding:5px 8px;">'+esc(f.descripcion)+'</td>'
      +'<td style="padding:5px 8px;text-align:right;font-family:monospace;border-left:1px solid #ecdfa8;'+_tachaEC+'">'+(f.cargo>0.005?'$'+fmt(f.cargo):'—')+'</td>'
      +'<td style="padding:5px 8px;text-align:right;font-family:monospace;color:#7a6840;border-left:1px solid #ecdfa8;'+_tachaEC+'">'+(f.adeudoAnterior>0.005?'$'+fmt(f.adeudoAnterior):'—')+'</td>'
      +'<td style="padding:5px 8px;text-align:right;font-family:monospace;color:#1a7a3a;border-left:1px solid #ecdfa8;'+_tachaEC+'">'+(f.abono>0.005?'$'+fmt(f.abono):'—')+'</td>'
      +'<td style="padding:5px 8px;text-align:right;font-family:monospace;font-weight:700;color:'+colAdeudo+';border-left:1px solid #ecdfa8;border-right:1px solid #ecdfa8;'+_tachaEC+'">'+(f.adeudo>0.005?'$'+fmt(f.adeudo):'—')+'</td>'
      +'</tr>';
  }).join('');

  var cancelado = !!datos.totales.cancelado;
  // Sin Costo Total Pactado y aún abierto: adeudo en $0 no es "concluido y
  // liquidado" (podrían venir más cargos) — se muestra como "sin adeudo por
  // el momento" en vez de dar por terminado el trámite.
  var abiertoSinCosto = !!datos.abierto;
  var sinAdeudo = !cancelado && !abiertoSinCosto && datos.totales.adeudo<=0.005;
  var sinAdeudoAbierto = !cancelado && abiertoSinCosto && datos.totales.adeudo<=0.005;
  var _canMontoModal = parseFloat(datos.totales.cancelacionMonto||0);
  var _canTipoModal = datos.totales.cancelacionTipo||'';
  var _canLabelModal = _canTipoModal==='ingreso' ? 'Honorarios por cancelación' : (_canTipoModal==='sin_movimiento' ? '' : 'Reintegro al cliente');
  var overlay=document.getElementById('estado-cuenta-overlay');
  if(overlay) overlay.remove();
  overlay=document.createElement('div');
  overlay.id='estado-cuenta-overlay';
  overlay.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(20,14,4,0.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:18px;';
  overlay.innerHTML =
    '<div style="background:#fffdf7;border:1px solid #d4b870;border-radius:10px;max-width:1440px;width:100%;max-height:94vh;display:flex;flex-direction:column;box-shadow:0 12px 50px rgba(0,0,0,0.35);font-family:\'Outfit\',sans-serif;overflow:hidden;">'
    +'<div style="background:#3a2a10;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">'
    +  '<div style="color:#e8c875;font-weight:700;font-family:\'DM Mono\',monospace;font-size:0.8rem;letter-spacing:0.06em;">📄 ESTADO DE CUENTA · Folio '+esc(datos.folioStr)+'</div>'
    +  '<div style="display:flex;gap:8px;">'
    +    '<button onclick="imprimirEstadoCuenta()" style="font-family:\'DM Mono\',monospace;font-size:0.68rem;font-weight:700;padding:6px 14px;border-radius:6px;border:1px solid #c8952a;background:#e8c875;color:#3a2a10;cursor:pointer;">🖨 Imprimir</button>'
    +    '<button onclick="cerrarEstadoCuenta()" style="font-family:\'DM Mono\',monospace;font-size:0.68rem;font-weight:700;padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.3);background:transparent;color:#e8c875;cursor:pointer;">✕ Cerrar</button>'
    +  '</div>'
    +'</div>'
    +'<div style="overflow-y:auto;flex:1;padding:18px 22px;">'
    +  '<div style="border:1px solid #d8c088;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:0.8rem;color:#3a2a10;">'
    +    '<div style="display:flex;justify-content:space-between;gap:12px;"><span><b>Cliente:</b> '+esc(datos.nombre)+'</span><span><b>Contacto:</b> '+esc(datos.contacto||'—')+'</span></div>'
    +    (datos.domicilio?'<div style="margin-top:3px;"><b>Domicilio:</b> '+esc(datos.domicilio)+'</div>':'')
    +    '<div style="margin-top:3px;"><b>Trámite:</b> '+esc(datos.tramite)+'</div>'
    +  '</div>'
    +  '<table style="width:100%;border-collapse:collapse;font-size:0.78rem;">'
    +    '<thead><tr style="background:#e8c875;color:#1a1008;font-family:\'DM Mono\',monospace;font-size:0.62rem;text-transform:uppercase;letter-spacing:0.04em;">'
    +      '<th style="padding:6px 8px;text-align:left;">Folio</th><th style="padding:6px 8px;text-align:left;">Tipo de recibo</th>'
    +      '<th style="padding:6px 8px;text-align:left;">Fecha</th><th style="padding:6px 8px;text-align:left;">Concepto</th>'
    +      '<th style="padding:6px 8px;text-align:left;">Descripción</th><th style="padding:6px 8px;text-align:right;border-left:1px solid #b8934a;">Cargo</th>'
    +      '<th style="padding:6px 8px;text-align:right;border-left:1px solid #b8934a;">Adeudo anterior</th>'
    +      '<th style="padding:6px 8px;text-align:right;border-left:1px solid #b8934a;">Abono</th><th style="padding:6px 8px;text-align:right;border-left:1px solid #b8934a;border-right:1px solid #b8934a;">Saldo restante</th>'
    +    '</tr></thead>'
    +    '<tbody>'+filasHtml+'</tbody>'
    +  '</table>'
    +  '<div style="margin:16px 0 0 auto;max-width:320px;border:1px solid #d4b870;border-radius:8px;overflow:hidden;">'
    +    '<div style="background:#2a2013;color:#e8c875;font-family:\'DM Mono\',monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;padding:6px 14px;">Resumen del folio</div>'
    +    '<div style="padding:10px 14px;font-family:\'DM Mono\',monospace;font-size:0.78rem;">'
    +      '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span style="color:#7a6840;">Total pactado</span><strong>'+(datos.totales.cargo>0.005?'$'+fmt(datos.totales.cargo):'—')+'</strong></div>'
    +      '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span style="color:#7a6840;">Abonado</span><strong style="color:#1a7a3a;">'+(datos.totales.abono>0.005?'$'+fmt(datos.totales.abono):'—')+'</strong></div>'
    +      '<div style="border-top:1px dashed #d4b870;margin:5px 0 4px;"></div>'
    +      '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:0.85rem;"><span style="color:'+(cancelado?'#8a1a1a':(sinAdeudo?'#1a7a3a':'#c8701a'))+';font-weight:700;">Saldo pendiente</span><strong style="color:'+(cancelado?'#8a1a1a':(sinAdeudo?'#1a7a3a':'#c8701a'))+';">'+(datos.totales.adeudo>0.005?'$'+fmt(datos.totales.adeudo):'—')+'</strong></div>'
    +    '</div>'
    +  '</div>'
    +  '<div style="text-align:center;margin-top:16px;font-family:\'DM Mono\',monospace;font-size:0.72rem;font-weight:700;letter-spacing:0.05em;color:'+(cancelado?'#8a1a1a':(sinAdeudo?'#1a7a3a':'#c8701a'))+';">'
    +    (cancelado ? '- - - - - - - - - - - T R Á M I T E &nbsp;C A N C E L A D O - - - - - - - - - - -'
        : sinAdeudo ? '- - - - - - - - T R Á M I T E &nbsp;C O N C L U I D O &nbsp;Y &nbsp;L I Q U I D A D O - - - - - - - -'
        : sinAdeudoAbierto ? '- - - - S I N &nbsp;A D E U D O &nbsp;P O R &nbsp;E L &nbsp;M O M E N T O &nbsp;( T R Á M I T E &nbsp;A B I E R T O ) - - - -'
                    : '- - - - - - - - - - A D E U D O &nbsp;P E N D I E N T E: &nbsp;$'+fmt(datos.totales.adeudo)+' - - - - - - - - - -')
    +  '</div>'
    +    (cancelado && _canMontoModal>0.005 && _canLabelModal ? '<div style="text-align:center;margin-top:6px;font-family:\'DM Mono\',monospace;font-size:0.7rem;font-weight:700;color:#8a1a1a;">'+esc(_canLabelModal)+': $'+fmt(_canMontoModal)+'</div>' : '')
    +    (sinAdeudoAbierto ? '<div style="text-align:center;margin-top:6px;font-family:\'DM Mono\',monospace;font-size:0.66rem;color:#7a6840;">Sin costo total pactado — el trámite se considera concluido solo al cerrarlo manualmente.</div>' : '')
    +    (sinAdeudo && datos.placa ? '<div style="text-align:center;margin-top:5px;font-family:\'DM Mono\',monospace;font-size:0.66rem;color:#7a6840;">Placas: '+esc(String(datos.placa).toUpperCase())+'</div>' : '')
    +    (sinAdeudo ? '<div style="text-align:center;margin-top:22px;pointer-events:none;user-select:none;font-family:serif;font-weight:700;font-size:2.1rem;letter-spacing:0.03em;color:rgba(60,45,15,0.08);">TRÁMITE CONCLUIDO</div>' : '')
    +    (cancelado ? '<div style="text-align:center;margin-top:22px;pointer-events:none;user-select:none;font-family:serif;font-weight:700;font-size:2.1rem;letter-spacing:0.03em;color:rgba(138,26,26,0.09);">TRÁMITE CANCELADO</div>' : '')
    +'</div>'
    +'</div>';
  document.body.appendChild(overlay);
}
function cerrarEstadoCuenta(){
  var overlay=document.getElementById('estado-cuenta-overlay');
  if(overlay) overlay.remove();
}
// ── PDF formal (monocromático, tipo carta membretada) ──
function generarPDFEstadoCuenta(datos){
  datos = datos || window._estadoCuentaDatos;
  if(!datos){ if(typeof toast==='function') toast('No hay datos de estado de cuenta cargados','err'); return; }
  var jsPDFctor = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
  var doc = new jsPDFctor({ orientation:'landscape', unit:'mm', format:'letter' });
  var W = doc.internal.pageSize.getWidth();
  var H = doc.internal.pageSize.getHeight();
  var mL = 14, mR = W-14;
  var fmt=function(v){ return typeof fmtMXN==='function'?fmtMXN(parseFloat(v||0)):parseFloat(v||0).toFixed(2); };
  var y = 16;

  // ── Paginación: antes todo el contenido se dibujaba en una sola hoja y, si
  // el desglose de conceptos hacía la tabla más alta de lo normal, el
  // recuadro "RESUMEN DEL FOLIO" y el pie de página terminaban encimados.
  // Ahora se controla cuánto cabe por hoja y se agregan hojas adicionales
  // cuando hace falta, con encabezado de tabla repetido y "Página X de Y"
  // correcto en cada una (el total de páginas no se sabe hasta el final, así
  // que ese número se rellena en una segunda pasada con doc.setPage()).
  var _limiteYEC = H - 20;
  var _paginaActualEC = 1;
  var _paginasInfoEC = [];
  function _piePaginaEC(pageNum){
    var _yPieEC = H-14;
    doc.setDrawColor(150,150,150); doc.setLineWidth(0.2);
    doc.line(mL, _yPieEC-4, mR, _yPieEC-4);
    doc.setFont('times','normal'); doc.setFontSize(7); doc.setTextColor(90,90,90);
    var _fechaGenEC=ahora.toLocaleDateString('es-MX')+', '+String(ahora.getHours()).padStart(2,'0')+':'+String(ahora.getMinutes()).padStart(2,'0')+' hrs.';
    doc.text('Generado el '+_fechaGenEC, mL, _yPieEC);
    doc.text('Este documento es de carácter informativo y no es un recibo oficial de pago.', W/2, _yPieEC, {align:'center'});
    doc.text('LEX-MÉXICO · Santiago Juxtlahuaca, Oaxaca · Tel. 953 128 7511', W/2, _yPieEC+4, {align:'center'});
    doc.setTextColor(0,0,0);
    _paginasInfoEC.push({pageNum:pageNum, yPie:_yPieEC});
  }
  var ahora=new Date(); // se necesita ya aquí porque _piePaginaEC la usa

  // Bandera de "sin adeudo" (se usa más abajo para leyenda, placas y marca de agua).
  // Un folio CANCELADO no cuenta como "concluido y liquidado" — es su propio
  // tercer estado, con su propia leyenda/marca de agua (ver más abajo).
  var _canceladoEC = !!(datos.totales && datos.totales.cancelado);
  // Sin Costo Total Pactado y aún abierto: no se muestra el sello de
  // "concluido" solo porque el saldo encadenado dé $0 en un momento dado —
  // solo se considera concluido cuando se cierra manualmente el trámite.
  var _abiertoEC = !!datos.abierto;
  var _sinAdeudoWM = !_canceladoEC && !_abiertoEC && datos.totales && datos.totales.adeudo<=0.005;

  doc.setFont('times','bold'); doc.setFontSize(16); doc.setTextColor(20,20,20);
  doc.text('LEX-MÉXICO', W/2, y, {align:'center'});
  y+=5.5;
  doc.setFont('times','normal'); doc.setFontSize(9);
  doc.text('Despacho Jurídico', W/2, y, {align:'center'});
  y+=4.5;
  doc.setFontSize(8);
  doc.text('Calle Miguel Hidalgo esq. México No. 200, Local B, Col. Centro, Santiago Juxtlahuaca, Oaxaca', W/2, y, {align:'center'});
  y+=4;
  doc.text('Tel. oficina · informes y citas: 953 128 7511', W/2, y, {align:'center'});
  y+=3.5;

  // Doble raya punteada bajo el membrete
  doc.setLineDashPattern([0.6,1], 0);
  doc.setDrawColor(60,60,60); doc.setLineWidth(0.3);
  doc.line(mL, y, mR, y);
  y+=4;
  doc.setLineDashPattern([], 0);

  // Título + folio grande
  doc.setFont('times','bold'); doc.setFontSize(12); doc.setTextColor(0,0,0);
  doc.text('ESTADO DE CUENTA', mL, y+2);
  doc.setFontSize(17);
  doc.text('Folio: '+datos.folioStr, mR, y+2, {align:'right'});
  y+=6.5;
  doc.setFont('times','normal'); doc.setFontSize(8); doc.setTextColor(60,60,60);
  var fechaEmision=ahora.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})+', '+
    String(ahora.getHours()).padStart(2,'0')+':'+String(ahora.getMinutes()).padStart(2,'0')+' hrs.';
  doc.text('Fecha de emisión: '+fechaEmision, mR, y, {align:'right'});
  y+=5;

  // Caja punteada con datos del cliente
  var boxY0=y;
  doc.setFont('times','bold'); doc.setFontSize(8.5); doc.setTextColor(0,0,0);
  doc.text('Cliente:', mL+2, y+4.5);
  doc.setFont('times','normal');
  doc.text(String(datos.nombre||'—'), mL+16, y+4.5);
  var _contactoTxtPdf = String(datos.contacto||'—');
  doc.setFont('times','normal');
  doc.text(_contactoTxtPdf, mR-2, y+4.5, {align:'right'});
  var _contactoWPdf = doc.getStringUnitWidth(_contactoTxtPdf)*8.5/doc.internal.scaleFactor;
  doc.setFont('times','bold');
  doc.text('Contacto:', mR-2-_contactoWPdf-2, y+4.5, {align:'right'});
  doc.setFont('times','bold');
  doc.text('Domicilio:', mL+2, y+9.5);
  doc.setFont('times','normal');
  doc.text(String(datos.domicilio||'—'), mL+18, y+9.5);
  doc.setFont('times','bold');
  doc.text('Trámite:', mL+2, y+14.5);
  doc.setFont('times','normal');
  doc.text(String(datos.tramite||'—'), mL+16, y+14.5);
  y+=18.5;
  doc.setLineDashPattern([0.6,1], 0);
  doc.setDrawColor(60,60,60); doc.setLineWidth(0.25);
  doc.rect(mL, boxY0, mR-mL, y-boxY0);
  doc.setLineDashPattern([], 0);
  y+=5;

  // Tabla
  var cols=[
    {t:'FOLIO', w:16, align:'left'}, {t:'TIPO DE RECIBO', w:24, align:'left'},
    {t:'FECHA', w:18, align:'left'}, {t:'CONCEPTO', w:38, align:'left'},
    {t:'DESCRIPCIÓN', w:58, align:'left'}, {t:'CARGO', w:24, align:'right'},
    {t:'ADEUDO ANT.', w:22, align:'right'},
    {t:'ABONO', w:24, align:'right'}, {t:'SALDO REST.', w:24, align:'right'}
  ];
  var tableW=cols.reduce(function(s,c){return s+c.w;},0);
  var x0=mL+(mR-mL-tableW)/2;
  var rowH=6.2; // alto mínimo de una fila de una sola línea
  var lineH=3.3; // alto por línea cuando el texto necesita envolver
  var padTop=2.3;

  // Posición X del borde izquierdo de cada columna (+ borde derecho final) —
  // se usa para dibujar las líneas verticales que encasillan CARGO/ADEUDO
  // ANT./ABONO/SALDO REST.
  var colX=[]; (function(){ var cx=x0; cols.forEach(function(c){ colX.push(cx); cx+=c.w; }); colX.push(cx); })();
  var MONEY_COLS=[5,6,7,8]; // CARGO, ADEUDO ANT., ABONO, SALDO REST.

  // Envuelve el texto completo dentro del ancho de columna (varias líneas si
  // hace falta) en vez de truncarlo con "…" — misma lógica que ya usa la
  // ventana del modal (HTML normal), donde el texto siempre se ve completo.
  function drawRow(vals, opts){
    opts=opts||{};
    doc.setFont('times', opts.bold?'bold':'normal');
    doc.setFontSize(8);
    var wrapped = cols.map(function(c,i){
      var txt=String(vals[i]==null?'':vals[i]);
      if(!txt) return [''];
      var maxW=c.w-3;
      var lines = doc.splitTextToSize(txt, maxW);
      return lines && lines.length ? lines : [''];
    });
    var nLines = wrapped.reduce(function(m,l){ return Math.max(m,l.length); }, 1);
    var rh = Math.max(rowH, padTop+2 + nLines*lineH);

    var x=x0;
    if(opts.shade){ doc.setFillColor(230,230,230); doc.rect(x0,y,tableW,rh,'F'); }
    doc.setTextColor(opts.cancelado?150:0,opts.cancelado?150:0,opts.cancelado?145:0);
    cols.forEach(function(c,i){
      var lines=wrapped[i];
      // Encabezado: nombre de cada casilla siempre centrado, sin importar
      // cómo se alinee el dato de esa columna en las filas normales.
      var align = opts.header ? 'center' : c.align;
      var tx = align==='center' ? x+c.w/2 : (align==='right' ? x+c.w-2 : x+2);
      lines.forEach(function(ln, li){
        doc.text(ln, tx, y+padTop+li*lineH+2, {align:align});
      });
      // Recibo de cancelación: tachar solo las columnas de dinero (cargo/adeudo
      // anterior/abono/saldo restante) — el trámite quedó sin efecto, el estado
      // real vive en la leyenda. Los montos siempre caben en una sola línea.
      if(opts.cancelado && MONEY_COLS.indexOf(i)>=0 && lines[0]){
        var _twEC = doc.getStringUnitWidth(lines[0])*8/doc.internal.scaleFactor;
        var _xEC = c.align==='right' ? tx-_twEC : tx;
        var _tyEC = y+padTop+2-1.1;
        doc.setDrawColor(150,150,145); doc.setLineWidth(0.3);
        doc.line(_xEC, _tyEC, _xEC+_twEC, _tyEC);
      }
      x+=c.w;
    });
    y+=rh;
    return rh;
  }
  // Mide cuánto va a ocupar una fila ANTES de dibujarla — se usa para decidir
  // si hay que saltar de página antes de empezarla (evita partir una fila a
  // la mitad y que el recuadro de resumen termine encimado con el pie).
  function _alturaFilaEC(vals){
    var nLines = 1;
    cols.forEach(function(c,i){
      var txt = String(vals[i]==null?'':vals[i]);
      if(!txt) return;
      var lines = doc.splitTextToSize(txt, c.w-3);
      nLines = Math.max(nLines, lines && lines.length ? lines.length : 1);
    });
    return Math.max(rowH, padTop+2 + nLines*lineH);
  }
  // Cierra el recuadro de la tabla en la página actual y dibuja el encabezado
  // de columnas de nuevo al iniciar la siguiente.
  function _saltoDePaginaTablaEC(){
    doc.setDrawColor(0,0,0); doc.setLineWidth(0.3);
    doc.rect(x0, _tablaTopY, tableW, y-_tablaTopY);
    doc.setDrawColor(140,140,140); doc.setLineWidth(0.2);
    MONEY_COLS.forEach(function(i){ doc.line(colX[i], _tablaTopY, colX[i], y); });
    _piePaginaEC(_paginaActualEC);
    doc.addPage();
    _paginaActualEC++;
    y = 16;
    _tablaTopY = y;
    drawRow(cols.map(function(c){return c.t;}), {shade:true, bold:true, header:true});
    doc.setDrawColor(140,140,140); doc.setLineWidth(0.2);
    doc.line(x0,y,x0+tableW,y);
  }

  var _tablaTopY = y;
  drawRow(cols.map(function(c){return c.t;}), {shade:true, bold:true, header:true});
  doc.setDrawColor(140,140,140); doc.setLineWidth(0.2);
  doc.line(x0,y,x0+tableW,y);

  datos.filas.forEach(function(f){
    var vals = [
      f.folioStr, f.tipo, _fechaCortaEC(f.fecha), f.concepto, f.descripcion,
      (f.cargo>0.005?'$'+fmt(f.cargo):'—'), (f.adeudoAnterior>0.005?'$'+fmt(f.adeudoAnterior):'—'),
      (f.abono>0.005?'$'+fmt(f.abono):'—'), (f.adeudo>0.005?'$'+fmt(f.adeudo):'—')
    ];
    if(y + _alturaFilaEC(vals) > _limiteYEC){
      _saltoDePaginaTablaEC();
    }
    drawRow(vals, {cancelado: !!f.cancelado});
    doc.setDrawColor(210,210,210); doc.setLineWidth(0.15);
    doc.line(x0,y,x0+tableW,y);
  });

  // Si lo que queda de la página no alcanza para el recuadro de resumen +
  // leyenda (~60mm), se empieza una hoja nueva en vez de encimarlo con el pie.
  if(y + 60 > _limiteYEC){
    doc.setDrawColor(0,0,0); doc.setLineWidth(0.3);
    doc.rect(x0, _tablaTopY, tableW, y-_tablaTopY);
    doc.setDrawColor(140,140,140); doc.setLineWidth(0.2);
    MONEY_COLS.forEach(function(i){ doc.line(colX[i], _tablaTopY, colX[i], y); });
    _piePaginaEC(_paginaActualEC);
    doc.addPage();
    _paginaActualEC++;
    y = 16;
    _tablaTopY = y; // ya no se vuelve a usar para dibujar tabla, solo por si acaso
  }

  var sinAdeudo=!_canceladoEC && !_abiertoEC && datos.totales.adeudo<=0.005;
  var sinAdeudoAbierto=!_canceladoEC && _abiertoEC && datos.totales.adeudo<=0.005;
  doc.setDrawColor(0,0,0); doc.setLineWidth(0.3);
  doc.rect(x0, _tablaTopY, tableW, y-_tablaTopY);
  // Líneas verticales que encasillan CARGO / ADEUDO ANT. / ABONO / SALDO REST.
  // (empiezan en el borde izquierdo de CARGO y terminan en el derecho del
  // último, que ya coincide con el borde derecho de la tabla).
  doc.setDrawColor(140,140,140); doc.setLineWidth(0.2);
  MONEY_COLS.forEach(function(i){ doc.line(colX[i], _tablaTopY, colX[i], y); });

  // ── Resumen del folio — recuadro aparte (igual que en el modal), ya NO es
  // una fila más dentro de la tabla de movimientos. ──
  y+=8;
  var _resW=72, _resX=mR-_resW, _resY0=y;
  doc.setFont('times','bold'); doc.setFontSize(7.5); doc.setTextColor(0,0,0);
  doc.setFillColor(230,230,230);
  doc.rect(_resX, y, _resW, 6, 'F');
  doc.text('RESUMEN DEL FOLIO', _resX+3, y+4);
  y+=9;
  doc.setFont('times','normal'); doc.setFontSize(8.5); doc.setTextColor(90,90,90);
  doc.text('Total pactado', _resX+3, y);
  doc.setTextColor(0,0,0);
  doc.text((datos.totales.cargo>0.005?'$'+fmt(datos.totales.cargo):'—'), _resX+_resW-3, y, {align:'right'});
  y+=5;
  doc.setTextColor(90,90,90);
  doc.text('Abonado', _resX+3, y);
  doc.setTextColor(20,110,50);
  doc.text((datos.totales.abono>0.005?'$'+fmt(datos.totales.abono):'—'), _resX+_resW-3, y, {align:'right'});
  y+=3;
  doc.setLineDashPattern([0.6,1],0);
  doc.setDrawColor(170,150,110); doc.setLineWidth(0.2);
  doc.line(_resX+3, y, _resX+_resW-3, y);
  doc.setLineDashPattern([],0);
  y+=5;
  var _colorSaldoPdf = _canceladoEC ? [140,25,25] : (sinAdeudo ? [20,110,50] : [190,110,10]);
  doc.setFont('times','bold'); doc.setFontSize(9);
  doc.setTextColor(_colorSaldoPdf[0],_colorSaldoPdf[1],_colorSaldoPdf[2]);
  doc.text('Saldo pendiente', _resX+3, y);
  doc.text((datos.totales.adeudo>0.005?'$'+fmt(datos.totales.adeudo):'—'), _resX+_resW-3, y, {align:'right'});
  doc.setTextColor(0,0,0);
  y+=4;
  doc.setDrawColor(120,110,90); doc.setLineWidth(0.3);
  doc.rect(_resX, _resY0, _resW, y-_resY0);

  y+=8;
  doc.setFont('times','bold'); doc.setFontSize(9);
  var leyenda = _canceladoEC ? 'TRÁMITE CANCELADO' : (sinAdeudo ? 'TRÁMITE CONCLUIDO Y LIQUIDADO' : (sinAdeudoAbierto ? 'SIN ADEUDO POR EL MOMENTO (TRÁMITE ABIERTO)' : ('ADEUDO PENDIENTE: $'+fmt(datos.totales.adeudo))));
  if(_canceladoEC) doc.setTextColor(140,25,25);
  var leyendaEsp = leyenda.split('').join(' ');
  // Dashes calculados según el ancho real del texto (en vez de un conteo fijo)
  // para que la línea no se desborde cuando la leyenda es más larga que "SIN ADEUDO".
  var _anchoDisp = (mR-mL) - 10;
  var _anchoTxt = doc.getStringUnitWidth(leyendaEsp)*9/doc.internal.scaleFactor;
  var _anchoUnDash = doc.getStringUnitWidth('- ')*9/doc.internal.scaleFactor;
  var _numDashes = Math.max(3, Math.floor(((_anchoDisp-_anchoTxt)/2)/_anchoUnDash));
  var dashes = new Array(_numDashes+1).join('- ');
  doc.text(dashes+leyendaEsp+' '+dashes, W/2, y, {align:'center'});
  doc.setTextColor(0,0,0);
  // Segunda línea: para cancelación, el monto real de la cancelación (reintegro
  // al cliente / honorarios / sin movimiento); para trámite concluido, las
  // placas del último recibo (solo si es de vehículos).
  if(_canceladoEC){
    var _canMontoPDF = parseFloat(datos.totales.cancelacionMonto||0);
    var _canTipoPDF  = datos.totales.cancelacionTipo||'';
    var _canLabelPDF = _canTipoPDF==='ingreso' ? 'Honorarios por cancelación' : (_canTipoPDF==='sin_movimiento' ? '' : 'Reintegro al cliente');
    if(_canMontoPDF>0.005 && _canLabelPDF){
      y+=5;
      doc.setFont('times','bold'); doc.setFontSize(8.5); doc.setTextColor(140,25,25);
      doc.text(_canLabelPDF+': $'+fmt(_canMontoPDF), W/2, y, {align:'center'});
      doc.setTextColor(0,0,0);
    }
  } else if(sinAdeudo && datos.placa){
    y+=5;
    doc.setFont('times','normal'); doc.setFontSize(8); doc.setTextColor(70,70,70);
    doc.text('Placas: '+String(datos.placa).toUpperCase(), W/2, y, {align:'center'});
    doc.setTextColor(0,0,0);
  } else if(sinAdeudoAbierto){
    y+=5;
    doc.setFont('times','normal'); doc.setFontSize(7.5); doc.setTextColor(90,90,90);
    doc.text('Sin costo total pactado — el trámite se considera concluido solo al cerrarlo manualmente.', W/2, y, {align:'center'});
    doc.setTextColor(0,0,0);
  }

  // Marca de agua horizontal, en el espacio en blanco que queda debajo de la
  // leyenda y arriba del pie de página — "TRÁMITE CONCLUIDO" si se liquidó
  // normalmente, "TRÁMITE CANCELADO" si el trámite se anuló.
  if(_sinAdeudoWM || _canceladoEC){
    var _wmTxt=_canceladoEC?'TRÁMITE CANCELADO':'TRÁMITE CONCLUIDO';
    var _wmFont=44;
    doc.setFont('times','bold');
    while(_wmFont>10){
      doc.setFontSize(_wmFont);
      var _wmW=doc.getStringUnitWidth(_wmTxt)*_wmFont/doc.internal.scaleFactor;
      if(_wmW <= (mR-mL)-16) break;
      _wmFont-=2;
    }
    if(_canceladoEC) doc.setTextColor(230,205,205); else doc.setTextColor(218,218,218);
    var _wmTop = y+6, _wmBottom = (H-18)-4;
    var _wmY = _wmBottom>_wmTop ? _wmTop+(_wmBottom-_wmTop)/2 : _wmTop;
    doc.text(_wmTxt, W/2, _wmY, {align:'center'});
    doc.setTextColor(0,0,0);
  }

  // Pie de la última página.
  _piePaginaEC(_paginaActualEC);

  // "Página X de Y" — el total de páginas no se conoce hasta este punto, así
  // que se completa ahora en cada página ya generada con doc.setPage().
  var _totalPaginasEC = doc.internal.getNumberOfPages();
  _paginasInfoEC.forEach(function(info){
    doc.setPage(info.pageNum);
    doc.setFont('times','normal'); doc.setFontSize(7); doc.setTextColor(90,90,90);
    doc.text('Página '+info.pageNum+' de '+_totalPaginasEC, mR, info.yPie, {align:'right'});
    doc.setTextColor(0,0,0);
  });
  doc.setPage(_totalPaginasEC);

  return doc;
}
function imprimirEstadoCuenta(){
  var datos = window._estadoCuentaDatos;
  if(!datos){ if(typeof toast==='function') toast('Abre primero el estado de cuenta','err'); return; }
  var doc = generarPDFEstadoCuenta(datos);
  if(!doc) return;
  var blob = doc.output('blob');
  var nombreArchivo = 'Estado de cuenta ' + datos.folioStr + '.pdf';
  if(typeof imprimirDesdeBlob === 'function') imprimirDesdeBlob(blob, nombreArchivo);
  else { var url=URL.createObjectURL(blob); window.open(url, '_blank'); }
  cerrarEstadoCuenta();
}

// Iniciales de un nombre completo, usado en la Ficha del Folio para mostrar
// "Autorizó: X.X." en cada recibo (ver _tipoReciboSC más abajo).
function _fichaExtraerIniciales(nombre){
  return (nombre||'').trim().split(/\s+/).map(function(w){ return (w[0]||'').toUpperCase(); }).join('').slice(0,4) || '—';
}

function abrirFichaFolio(){
  var recibo=reciboEnConsulta;
  if(!recibo){if(typeof toast==='function')toast('Primero consulta un folio','err');return;}
  window._fichaAbrirToken++;
  var _fichaMyToken = window._fichaAbrirToken;
  // La ficha SIEMPRE ancla en la versión A (el folio principal) sin importar
  // el modo de costo — nunca debe abrir mostrando una liquidación B/C/D sobrante.
  // (El abonado se calcula sumando TODAS las versiones más abajo, así que no se pierde nada.)
  var _verPrincipal = (appData.recibos||[]).find(function(r){
    return r && Number(r.folio)===Number(recibo.folio) && !r.esComplemento && (r.letra||'A')==='A';
  });
  if (_verPrincipal) recibo = _verPrincipal;
  var folio=recibo.folio;
  var anio=recibo.anio_folio||new Date().getFullYear();
  var rl=recibo.letra||(typeof letraVersion==='function'?letraVersion(recibo):'A')||'A';
  var fStr=typeof folioConLetra==='function'?folioConLetra(folio,anio,rl):folio+rl;
  document.getElementById('ficha-folio-num').textContent=fStr;
  document.getElementById('ficha-folio-ref').textContent=fStr;
  document.getElementById('ficha-cliente-nombre').textContent=recibo.nombre||'—';
  // VSL — registrar apertura de ficha
  try{ auditoriaRegistrar('folio','Abrió ficha: '+fStr+' — '+(recibo.nombre||'sin nombre')+' — '+(recibo.concepto||recibo.servicio||'')); }catch(e){}
  // Teléfono del primer cliente
  var tel='';
  if(recibo.clientes&&recibo.clientes[0])tel=recibo.clientes[0].movil||recibo.clientes[0].tel||'';
  else if(recibo.movil)tel=recibo.movil;
  var telEl=document.getElementById('ficha-cliente-tel');
  if(telEl&&tel){telEl.innerHTML='<span style="color:#1a7a3a;font-weight:700;">CONTACTO:</span> <span style="color:#c8701a;font-weight:700;">'+tel+'</span>';}else if(telEl){telEl.textContent='';}
  // Domicilio
  var dom='';
  if(recibo.clientes&&recibo.clientes[0])dom=recibo.clientes[0].domicilio||'';
  else if(recibo.domicilio)dom=recibo.domicilio;
  var domEl=document.getElementById('ficha-domicilio');
  if(domEl)domEl.textContent=dom?'· '+dom:'';
  var c0=recibo.conceptos&&recibo.conceptos[0];
  // Concepto en mayúsculas y azul
  document.getElementById('ficha-concepto').textContent=c0?(c0.concepto||'').toUpperCase():'—';
  // Concepto editable para Juicio o Escritura + admin — usa triángulo como toggle
  var _conceptoLapiz   = document.getElementById('ficha-concepto-lapiz');
  var _conceptoReadWrap= document.getElementById('ficha-concepto-read-wrap');
  var _conceptoEditWrap= document.getElementById('ficha-concepto-edit-wrap');
  var _conceptoInput   = document.getElementById('ficha-concepto-input');
  var _tipoConcEdit = (recibo.tipoTramite||recibo.tramites||'');
  var _esJuicioAdmin = (_tipoConcEdit === 'juicio' || _tipoConcEdit === 'escritura') &&
    !!(typeof empleadoActual === 'undefined' || !empleadoActual ||
      empleadoActual.email.toLowerCase() === (typeof ADMIN_EMAIL !== 'undefined' ? ADMIN_EMAIL.toLowerCase() : 'lexmexico423@gmail.com'));
  if (_conceptoLapiz)    { _conceptoLapiz.textContent = '▸'; _conceptoLapiz.style.display = (_esJuicioAdmin && !_bloquearAcciones) ? '' : 'none'; }
  if (_conceptoReadWrap) _conceptoReadWrap.style.display  = 'flex';
  if (_conceptoEditWrap) _conceptoEditWrap.style.display  = 'none';
  // El input usa el campo fichaDescripcionJuicio separado del concepto del recibo
  var _tituloActual = recibo._tituloFichaJuicio || (c0?(c0.concepto||''):'');
  if (_conceptoInput)    _conceptoInput.value = _tituloActual;
  document.getElementById('ficha-concepto').textContent = _tituloActual.toUpperCase();
  window._fichaConceptoOriginal = _tituloActual;


  // Badges carpeta/expediente
  var carpBadge=document.getElementById('ficha-carpeta-badge');
  var expBadge=document.getElementById('ficha-expediente-badge');
  carpBadge.style.display='none';expBadge.style.display='none';
  if(recibo.carpetaIdx!==undefined&&recibo.carpetaIdx!==null){
    var carpetas=appData.carpetas||[];
    var carp=carpetas[recibo.carpetaIdx];
    if(carp){document.getElementById('ficha-carpeta-txt').textContent=carp.nombre||('Carpeta #'+(recibo.carpetaIdx+1));carpBadge.style.display='inline-block';}
  }
  if(recibo.expedienteNum){document.getElementById('ficha-expediente-txt').textContent=recibo.expedienteNum;expBadge.style.display='inline-block';}

  // ── Usar getAllMovs() igual que contabilidad ──
  var todosMovs=typeof getAllMovs==='function'?getAllMovs():[];
  // Filtrar movimientos del mismo folio base
  var movsDelFolio=todosMovs.filter(function(m){
    return m.folio===folio||(m.id&&m.id.indexOf('R-'+folio)===0)||(m.id&&m.id.indexOf('M-REC-NEW-'+folio)===0);
  });

  var listaEl=document.getElementById('ficha-recibos-lista');
  listaEl.innerHTML='';
  var totalTramite=parseFloat(recibo.total||0);
  var totalAbonado=0;

  // Ordenar por letra
  var todosRec=(appData.recibos||[]).filter(function(r){return r.folio===folio&&!r.esComplemento;});
  todosRec.sort(function(a,b){return((a.letra||'A')).localeCompare(b.letra||'A');});

  var fmt=function(v){return typeof fmtMXN==='function'?fmtMXN(parseFloat(v||0)):parseFloat(v||0).toFixed(2);};
  var esc=function(s){return (typeof escHTML==='function')?escHTML(s||''):(s||'');};
  // Clave única para no contar dos veces el mismo costo extra si llegara duplicado
  var _ceKeyFn=function(ce){return (ce.concepto||'')+'|'+(ce.descripcion||'')+'|'+String(ce.precio||'')+'|'+(ce.fechaHora||'');};

  // Lista global de servicios complementarios (para el encabezado, punto 3)
  var _ceHeaderList=[];

  // ── Base del trámite para el SALDO CRONOLÓGICO por fila ──────────────
  // El saldo de cada versión debe medirse contra el costo del trámite que
  // existía EN ESE MOMENTO, no contra el total final. El recibo original no
  // podía prever un servicio complementario futuro: su saldo se calcula sobre
  // la base sin complementarios, y cada complementario entra al saldo recién
  // en la versión donde realmente se agregó.
  var _totalCEAll=0; var _ceSeenBase={};
  var _sumCEBase=function(arr){ (arr||[]).forEach(function(ce){ if(!ce) return; var k=_ceKeyFn(ce); if(_ceSeenBase[k]) return; _ceSeenBase[k]=1; var p=parseFloat(ce.precio||0); if(p>0) _totalCEAll+=p; }); };
  todosRec.forEach(function(r){ _sumCEBase(r.costosExtra); });
  _sumCEBase(recibo.costosExtra);
  var _tramiteBase=Math.max(0, parseFloat(recibo.total||0) - _totalCEAll);
  var _ceAcum=0;
  // Sin Costo Pactado: cada fila de la lista muestra el dato CONGELADO de ese
  // recibo (ver más abajo) — no se recalcula con cola FIFO ni con el estado
  // actual de otras versiones, para que el historial quede firme.
  var _esJuicioAbLista = window._abiertoSinCosto(recibo);
  // Adeudo pendiente heredado de la versión anterior — se va actualizando fila
  // por fila conforme el forEach avanza en orden de letra (A, B, C…).
  var _prevRestaFrozenSC = 0;

  todosRec.forEach(function(r){
    var rletra=r.letra||(typeof letraVersion==='function'?letraVersion(r):'A')||'A';
    var rfStr=typeof folioConLetra==='function'?folioConLetra(r.folio,r.anio_folio,rletra):r.folio+rletra;
    var esOrig=rletra==='A'&&!r.esComplemento;

    // ── Servicios complementarios (costosExtra) que pertenecen a ESTA versión ──
    // Antes se dibujaban como una fila aparte, totalmente desligada del recibo
    // que los originó. Ahora se fusionan dentro de la fila de su propio recibo.
    // Sin Costo Pactado: costosExtra se guarda ACUMULADO por versión (cada versión
    // trae también los complementarios de las versiones anteriores como referencia).
    // Para que la fila de CADA recibo muestre solo lo que ESA versión agregó (y no
    // repita lo que ya se mostró en filas previas), filtramos por folioLetra propia.
    var _esJuicioAbFila = true; // tabla detallada por versión aplica a todos los folios
    var _ceRowMap={};
    (r.costosExtra||[]).forEach(function(ce){
      if(!ce) return;
      if(_esJuicioAbFila && (ce.folioLetra||'').toUpperCase()!==rletra.toUpperCase()) return;
      _ceRowMap[_ceKeyFn(ce)]=ce;
    });
    // Si esta es la versión vigente (misma letra que `recibo`), unir también lo que
    // traiga `recibo.costosExtra` en memoria por si aún no se sincronizó al arreglo.
    if(rletra===rl){
      (recibo.costosExtra||[]).forEach(function(ce){
        if(!ce) return;
        if(_esJuicioAbFila && (ce.folioLetra||'').toUpperCase()!==rletra.toUpperCase()) return;
        _ceRowMap[_ceKeyFn(ce)]=ce;
      });
    }
    var ceRow=Object.keys(_ceRowMap).map(function(k){return _ceRowMap[k];}).filter(function(ce){
      return parseFloat(ce.precio||0)>0 || (ce.concepto||'').trim();
    });

    var ceExactoTotal=0, ceAgregadoTotal=0;
    ceRow.forEach(function(ce){
      var precio=parseFloat(ce.precio||0);
      var montoLiq=parseFloat(ce.montoLiquidado||0);
      var esExactoCE=!!ce.liquidadoAlMomento && montoLiq===precio && precio>0;
      ceAgregadoTotal+=precio;
      if(esExactoCE) ceExactoTotal+=precio;
      _ceHeaderList.push({rfStr:rfStr, precio:precio, concepto:(ce.concepto||ce.descripcion||'Servicio complementario').trim(), fechaHora:ce.fechaHora||''});
    });

    var rc0=r.conceptos&&r.conceptos[0];
    var esCan=!!r.cancelado;

    // ── Sin Costo Pactado: fila-tabla con los datos CONGELADOS de ESE recibo ──
    // A petición expresa: cada fila debe mostrar EXACTAMENTE lo que quedó
    // impreso en el PDF de esa transacción al momento de generarse — un dato
    // histórico que NUNCA se recalcula ni cambia, aunque un recibo posterior
    // (ej. 56C) liquide después el saldo que aquí se ve pendiente.
    // IMPORTANTE: NO se lee r.total/r.totalAbonado/r.saldoPendiente directo —
    // esos campos quedaron demostrados poco confiables (recibos viejos guardados
    // antes de una corrección pueden traerlos desfasados del PDF real). En vez de
    // eso, se reconstruye el mismo cálculo que usó el PDF de ESTA versión a partir
    // de los ingredientes crudos e inmutables que trae acumulados el propio recibo
    // (r.costosExtra / r.pagosParciales, ya con su fechaHora/folioLetra de origen):
    // esto es EXACTAMENTE lo que generarPDF calculó al imprimir esa transacción, y
    // como esos arreglos nunca incluyen cargos/abonos de versiones POSTERIORES,
    // el resultado queda igual de firme sin depender de un campo que puede corromperse.
    {
      var _costoFrozenSC, _adeudoAntFrozenSC, _totalFrozenSC, _abonadoFrozenSC;
      if (esOrig) {
        // Si el folio tiene costo total pactado, Costo/Total = el total real
        // contratado del trámite (no solo el anticipo), para que la fila
        // principal siga mostrando el total verdadero del trámite. Si es Sin
        // Costo Pactado (r.total vacío/0) se mantiene el comportamiento previo:
        // Costo = Total = Abonó = anticipo propio, sin adeudo anterior.
        var _totalPactadoRealFila = parseFloat(r.total||0);
        if (_totalPactadoRealFila > 0) {
          _costoFrozenSC = _totalPactadoRealFila;
          _adeudoAntFrozenSC = 0;
          _totalFrozenSC = _totalPactadoRealFila;
          _abonadoFrozenSC = parseFloat(r.anticipo||0);
        } else {
          _costoFrozenSC = parseFloat(r.anticipo||0);
          _adeudoAntFrozenSC = 0;
          _totalFrozenSC = _costoFrozenSC;
          _abonadoFrozenSC = _costoFrozenSC;
        }
      } else {
        // Costo = SOLO el cargo nuevo que esta versión agregó (ceAgregadoTotal
        // ya viene filtrado arriba por folioLetra===rletra, deduplicado) — NUNCA
        // los cargos de otras versiones, para que la fila quede firme con lo
        // que pasó únicamente en ESE recibo.
        _costoFrozenSC = ceAgregadoTotal;
        // Adeudo ant. = lo que quedó pendiente (Resta) de la versión inmediata
        // anterior — se arrastra en cadena, fila por fila, nunca se recalcula
        // contra el estado actual del folio.
        _adeudoAntFrozenSC = _prevRestaFrozenSC;
        _totalFrozenSC = _costoFrozenSC + _adeudoAntFrozenSC;
        // Abonó = SOLO los abonos propios de esta versión (folioLetra===rletra),
        // deduplicados. El anticipo original NUNCA cuenta aquí (pago aparte).
        // + ceExactoTotal: servicios complementarios de ESTA fila que se marcaron
        // "liquidado al momento" (pagados de contado al agregarse) — el PDF los
        // suma directo al PAGO RECIBIDO sin generar una fila de abono aparte, así
        // que la Ficha debe hacer lo mismo o la RESTA queda inflada (folio 6, fila 6C).
        var _seenPPfz = {};
        _abonadoFrozenSC = ceExactoTotal + (r.pagosParciales||[]).filter(Boolean).filter(function(p){
          return (p.folioLetra||rletra).toUpperCase()===rletra.toUpperCase();
        }).reduce(function(s,p){
          var k=(p.fechaHora||'')+'|'+String(p.cantidad||'')+'|'+(p.folioLetra||'');
          if(_seenPPfz[k]) return s; _seenPPfz[k]=1;
          return s+(parseFloat(p.cantidad)||0);
        }, 0);
      }
      var _restaFrozenSC = Math.max(0, _totalFrozenSC - _abonadoFrozenSC);
      _prevRestaFrozenSC = esCan ? 0 : _restaFrozenSC; // cancelado: no arrastrar adeudo fantasma a la siguiente fila
      var _liquidadoFrozenSC = _restaFrozenSC <= 0.005;
      var _tipoReciboSC = esCan ? 'CANCELACIÓN' : (esOrig ? 'PAGO INICIAL' : (ceRow.length ? 'SERV. COMPL.' : (_liquidadoFrozenSC ? 'PAGO TOTAL' : 'PAGO PARCIAL')));
      var _tipoColorSC  = esOrig ? '#1a5fa8' : (ceRow.length ? '#8B4500' : '#1a7a3a');
      var _motivoCanSC = esCan ? (r.motivoCancelacion||'').split(' — Autoriz')[0].trim() : '';
      var _conceptoTxtSC = esCan
        ? (_motivoCanSC ? esc(_motivoCanSC) : 'Trámite cancelado')
        : (esOrig
            ? (rc0 && rc0.concepto ? esc(String(rc0.concepto).trim()) : 'ANTICIPO INICIAL')
            : (ceRow.length
                ? ceRow.map(function(ce){return esc((ce.concepto||ce.descripcion||'Servicio complementario').trim());}).join(' · ')
                : 'ADEUDO ANTERIOR'));
      // Monto de la cancelación (reintegro al cliente / honorarios / sin movimiento)
      var _canMontoSC = esCan ? parseFloat(r.cancelacionMonto||0) : 0;
      var _canTipoSC  = esCan ? (r.cancelacionTipo||'') : '';
      var _canLabelSC = _canTipoSC==='ingreso' ? 'Honorarios' : (_canTipoSC==='sin_movimiento' ? '' : 'Reintegro');
      var _restaColorSC = esCan ? '#8a1a1a' : (_liquidadoFrozenSC ? '#1a7a3a' : '#b01010');
      var _estatusTxtSC = esCan ? '🚫 CANCELADO' : (_liquidadoFrozenSC ? 'LIQUIDADO' : 'PENDIENTE');
      var fechaRecSC=(rletra!=='A'&&r.fechaActualizacion)?r.fechaActualizacion:(r.fecha_recibo||r.fecha||'');
      var horaRecSC=(rletra!=='A')?(r.horaActualizacion||r.hora||r.hora_recibo||''):(r.hora_recibo||r.hora||'');
      var fechaTxtSC=fechaRecSC?new Date(fechaRecSC+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'}):'—';
      var fechaHoraTxtSC=fechaTxtSC+(horaRecSC?' · '+horaRecSC+' hrs.':'');

      // Acumuladores del pie de la ficha (RESUMEN DEL FOLIO) — sin tocar su lógica,
      // solo sumar el abonado congelado real de esta fila.
      totalAbonado += _abonadoFrozenSC;

      // Quién autorizó/generó ESTE recibo específico — antes solo vivía en el
      // PDF (bloque "PAGOS PARCIALES", ya eliminado de ahí a petición expresa);
      // ahora se muestra aquí mismo, dentro de la propia tarjeta del recibo.
      var _autorizoTxtSC = 'Autorizó: ' + _fichaExtraerIniciales(r.responsable||'');
      var _adeudoAntTxtSC = _adeudoAntFrozenSC > 0.005 ? '$'+fmt(_adeudoAntFrozenSC) : '—';
      // TOTAL solo se muestra cuando hay un valor real en COSTO — si esta
      // versión no agregó ningún costo/cargo nuevo (p.ej. un recibo de PAGO
      // TOTAL que solo liquida el adeudo anterior), mostrar guiones en vez de
      // repetir el adeudo anterior como si fuera un "total" nuevo.
      // TOTAL solo se muestra cuando AMBOS, Costo Y Adeudo Ant., tienen valor
      // real — si falta cualquiera de los dos (p.ej. costo sin adeudo previo,
      // como un Pago Inicial normal), se queda en guiones en vez de mostrar
      // solo el costo o solo el adeudo como si fuera un total combinado.
      var _totalTxtSC = (_costoFrozenSC > 0.005 && _adeudoAntFrozenSC > 0.005) ? '$'+fmt(_totalFrozenSC) : '—';
      // Cualquier monto en $0.00 se muestra como guión en vez del cero explícito.
      var _costoTxtSC = _costoFrozenSC > 0.005 ? '$'+fmt(_costoFrozenSC) : '—';
      var _abonadoTxtSC = _abonadoFrozenSC > 0.005 ? '$'+fmt(_abonadoFrozenSC) : '—';
      var _restaTxtSC = _restaFrozenSC > 0.005 ? '$'+fmt(_restaFrozenSC) : '—';
      var _hdrSC = function(txt, extra){ return '<div style="font-size:0.56rem;font-weight:700;color:#a08850;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e6d8b0;padding-bottom:2px;'+(extra||'')+'">'+txt+'</div>'; };
      var row=document.createElement('div');
      row.style.cssText='border-radius:6px;border:1px solid '+(esCan?'#e0a8a8':'#d8c088')+';font-size:0.78rem;background:'+(esCan?'#fff8f8':'#fffdf7')+';overflow:hidden;margin-bottom:2px;'+(esCan?'opacity:0.75;':'');
      row.innerHTML =
          '<div style="display:grid;grid-template-columns:minmax(28px,32px) minmax(88px,1.3fr) minmax(66px,0.9fr) minmax(66px,0.9fr) minmax(60px,0.75fr) minmax(110px,1.6fr) minmax(66px,0.9fr);gap:2px 6px;padding:8px 12px 9px;align-items:start;min-width:0;">'
        +   _hdrSC('Folio') + _hdrSC('Monto del Recibo') + _hdrSC('Adeudo ant.') + _hdrSC('Total') + _hdrSC('Abonó') + _hdrSC('Tipo de recibo') + _hdrSC('Resta','text-align:right;')
        +   '<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;color:'+(esCan?'#8a1a1a':'#1a5fa8')+';font-family:monospace;font-size:0.76rem;cursor:pointer;text-decoration:underline;text-underline-offset:2px;" onclick="_fichaVisorMostrarVersion('+r.folio+',\''+rletra+'\');" title="Ver PDF">'+rfStr+'</div>'
        +   '<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;color:'+(esCan?'#8a1a1a':'#1a7a3a')+';font-family:monospace;'+(esCan?'text-decoration:line-through;':'')+'" title="'+_costoTxtSC+'">'+_costoTxtSC+'</div>'
        +   '<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;color:'+(esCan?'#8a1a1a':'#8c6518')+';font-family:monospace;'+(esCan?'text-decoration:line-through;':'')+'" title="'+_adeudoAntTxtSC+'">'+_adeudoAntTxtSC+'</div>'
        +   '<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;color:'+(esCan?'#8a1a1a':'#1a1008')+';font-family:monospace;'+(esCan?'text-decoration:line-through;':'')+'" title="'+_totalTxtSC+'">'+_totalTxtSC+'</div>'
        +   '<div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;color:'+(esCan?'#8a1a1a':'#1a7a3a')+';font-family:monospace;'+(esCan?'text-decoration:line-through;':'')+'" title="'+_abonadoTxtSC+'">'+_abonadoTxtSC+'</div>'
        +   '<div style="min-width:0;overflow:hidden;">'
        +     '<div style="font-weight:700;color:'+(esCan?'#8a1a1a':_tipoColorSC)+';font-size:0.72rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_tipoReciboSC+'</div>'
        +     '<div style="font-size:0.62rem;color:#7a6840;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+fechaHoraTxtSC+'</div>'
        +     '<div style="font-size:0.66rem;font-weight:600;color:'+(esOrig?'#6b5a35':'#8B4500')+';margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+_conceptoTxtSC+'">'+_conceptoTxtSC+'</div>'
        +     '<div style="font-size:0.6rem;font-weight:700;color:#8c6518;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_autorizoTxtSC+'</div>'
        +   '</div>'
        +   '<div style="min-width:0;overflow:hidden;text-align:right;">'
        +     (esCan
              ? '<div style="font-weight:700;font-family:monospace;color:'+_restaColorSC+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-decoration:line-through;opacity:0.7;" title="Adeudo anulado por cancelación">'+_restaTxtSC+'</div>'
              : '<div style="font-weight:700;font-family:monospace;color:'+_restaColorSC+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+_restaTxtSC+'">'+_restaTxtSC+'</div>')
        +     '<div style="font-size:0.6rem;font-weight:700;letter-spacing:0.04em;color:'+_restaColorSC+';white-space:nowrap;margin-top:2px;overflow:hidden;text-overflow:ellipsis;">'+_estatusTxtSC+'</div>'
        +     (esCan && _canMontoSC>0.005 && _canLabelSC ? '<div style="font-size:0.58rem;font-weight:700;color:#8a1a1a;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_canLabelSC+': $'+fmt(_canMontoSC)+'</div>' : '')
        +   '</div>'
        + '</div>';
      listaEl.appendChild(row);
    }
  });

  // ── Calcular total base (sin complementarios exactos) y total CE para el header ──
  var _totalBase = parseFloat(recibo.total||0) || (recibo.conceptos||[]).reduce(function(s,c){return s+(parseFloat(c.precio)||0);},0);
  var _totalCE = _ceHeaderList.reduce(function(s,ce){return s+(parseFloat(ce.precio)||0);},0);
  // ⚠️ FIX: totalTramite (=recibo.total) es el costo PACTADO original — NUNCA
  // incluye los servicios complementarios agregados después (se suman aparte,
  // no se hornean dentro del total pactado). Sin este "+_totalCE", el RESUMEN
  // DEL FOLIO (TOTAL/RESTA) y "COSTO ACTUALIZADO" del encabezado ignoraban por
  // completo los complementarios, descuadrando contra la tabla de recibos y el
  // PDF real (folio 6: mostraba TOTAL $20,000/RESTA $9,000 en vez de $21,000/$10,000).
  var _totalActualizado = totalTramite + _totalCE;
  // Sin Costo Pactado: inicialmente mostrar $0.00 hasta que carguen los cargos de R2
  var _esSinCostoInicial = window._modoCostoFolio(recibo) === 'abierto';
  document.getElementById('ficha-total').textContent='$'+fmt(_esSinCostoInicial ? 0 : _totalActualizado);
  var thWrap=document.getElementById('ficha-total-header-wrap');
  // ── FIX RAÍZ: reiniciar SIEMPRE thWrap a su estado base ANTES de decidir qué
  // mostrar. Antes, cuando un folio CON servicio complementario reemplazaba
  // este bloque entero (rama de abajo), destruía el propio elemento
  // "#ficha-total-header" que vive adentro. Al ver DESPUÉS un folio SIN
  // complementario (ej. folio 1 tras haber visto el folio 6), ese id ya no
  // existía — la rama `else if(th)` no encontraba nada que actualizar y se
  // quedaba pegado el HTML del folio anterior (parecía "mezclar" folios,
  // aunque los datos en Supabase estuvieran limpios: era puramente un
  // elemento del DOM no restaurado). Reconstruir el wrap aquí, cada vez,
  // garantiza que "th" siempre exista y el bloque nunca arrastre contenido
  // de un folio distinto.
  if(thWrap){
    thWrap.innerHTML='<span style="color:#7a6840;">💵 COSTO DEL TRÁMITE <span id="ficha-total-header" style="font-weight:700;color:#7a6840;"></span></span>';
  }
  var th=document.getElementById('ficha-total-header');
  // Sin Costo Pactado: mostrar etiqueta especial en el header derecho
  var _esSinCostoHeader = window._modoCostoFolio(recibo) === 'abierto';
  if(_esSinCostoHeader && thWrap){
    thWrap.innerHTML='<span style="font-family:monospace;font-size:0.68rem;font-weight:700;color:#1a3a70;background:#e6f1fb;padding:2px 10px;border-radius:12px;border:1.5px solid #4a6ea8;letter-spacing:0.06em;">📋 SIN COSTO PACTADO</span>';
  } else if(_totalCE > 0 && thWrap){
    var ceDetalleHTML=_ceHeaderList.map(function(ce){
      var fhTxt=ce.fechaHora?(' · '+esc(ce.fechaHora)):'';
      return '<div style="font-size:0.6rem;color:#8B4500;font-weight:400;">↳ '+esc(ce.rfStr)+fhTxt+' — '+esc(ce.concepto)+' $'+fmt(ce.precio)+'</div>';
    }).join('');
    thWrap.innerHTML=
      '<div style="font-family:monospace;font-size:0.72rem;line-height:1.7;text-align:right;">'
      +'<div style="color:#7a6840;">💵 COSTO DEL TRÁMITE &nbsp;<strong style="color:#7a6840;">$'+fmt(Math.max(0,_totalActualizado-_totalCE))+'</strong></div>'
      +ceDetalleHTML
      +'<div style="color:#1a1008;font-weight:700;border-top:1px solid #d4b870;padding-top:2px;margin-top:1px;">COSTO ACTUALIZADO &nbsp;<strong>$'+fmt(_totalActualizado)+'</strong></div>'
      +'</div>';
  } else if(th){
    th.textContent='$'+fmt(_totalActualizado);
  }
  document.getElementById('ficha-abonado').textContent='$'+fmt(totalAbonado);
  // Para modo Sin Costo Total Pactado: sumar cargos internos al total
  var _esSinCostoCalc = window._modoCostoFolio(recibo) === 'abierto';
  var _totalCargosInternos = _esSinCostoCalc
    ? (recibo._cargosInternos||[]).reduce(function(s,c){ return s+(parseFloat(c.monto)||0); }, 0)
    : 0;
  // Guardar para _fichaActualizarTotalesConCargos (corre después de cargar R2)
  window._fichaAbonadoActual = totalAbonado;
  window._fichaCEActual = _totalCEAll;
  // Sin Costo Total Pactado: RESTA = adeudo real (misma fuente que el PDF y los
  // botones Pago Parcial/Total: window._adeudoServicioComplementario), y TOTAL =
  // ABONADO + RESTA para que ambos campos sean coherentes entre sí (antes TOTAL
  // solo sumaba complementarios y podía verse menor que ABONADO, que sí incluye
  // honorarios/pago inicial sin relación con el adeudo).
  var _adeudoRealSCFicha = (_esSinCostoCalc && typeof window._adeudoServicioComplementario==='function')
    ? window._adeudoServicioComplementario(recibo).total : 0;
  var _totalConCargos = _esSinCostoCalc
    ? (totalAbonado + _totalCargosInternos + _adeudoRealSCFicha)
    : (_totalActualizado + _totalCargosInternos);
  var _restaFinal = _esSinCostoCalc
    ? (_totalCargosInternos + _adeudoRealSCFicha)
    : Math.max(0, _totalConCargos - totalAbonado);
  // Si la ÚLTIMA versión del folio quedó cancelada, "Resta" ya no representa
  // un saldo pendiente real — el trámite se anuló, así que ese cargo nunca se
  // termina de cobrar. En vez de mostrar un adeudo fantasma, se muestra el
  // estado de la cancelación (y el reintegro/honorario resuelto, si lo hubo).
  var _ultimaVersionFolio = todosRec.length ? todosRec[todosRec.length-1] : recibo;
  var _folioCanceladoFicha = !!_ultimaVersionFolio.cancelado;
  var _fpEl = document.getElementById('ficha-pendiente');
  var _fpLbl = document.getElementById('ficha-pendiente-label');
  if(_folioCanceladoFicha){
    var _canMontoFicha = parseFloat(_ultimaVersionFolio.cancelacionMonto||0);
    var _canTipoFicha  = _ultimaVersionFolio.cancelacionTipo||'';
    var _canLabelFicha = _canTipoFicha==='ingreso' ? 'Honorarios' : (_canTipoFicha==='sin_movimiento' ? '' : 'Reintegro');
    if(_fpLbl) _fpLbl.textContent='Estado';
    if(_fpEl){
      _fpEl.style.color='#8a1a1a';
      _fpEl.innerHTML = '🚫 CANCELADO'+(_canMontoFicha>0.005 && _canLabelFicha ? '<div style="font-size:0.58rem;font-weight:700;color:#8a1a1a;margin-top:2px;">'+_canLabelFicha+': $'+fmt(_canMontoFicha)+'</div>' : '');
    }
  } else {
    if(_fpLbl) _fpLbl.textContent='Resta';
    if(_fpEl){ _fpEl.style.color='#a32d2d'; _fpEl.textContent='$'+fmt(_restaFinal); }
  }
  // Actualizar saldoPendiente en memoria para que Pago Parcial tome el valor correcto.
  // OJO: en modo Sin Costo Pactado, NO escribir aquí si el juicio sigue abierto —
  // esto es lo que hacía que folios sin cerrar formalmente (botón "Cerrar Juicio")
  // se mostraran como "✅ LIQUIDADO" en listas/badges de todo el resto de la app
  // en cuanto lo abonado alcanzaba (o superaba) los cargos internos registrados.
  // FIX RAÍZ: escribir sobre la versión MÁS RECIENTE del folio, no sobre `recibo`
  // (que aquí siempre es la versión A, congelada) — ver nota completa más abajo
  // en _fichaActualizarTotalesConCargos, mismo problema.
  if (_esSinCostoCalc) {
    recibo._restaSinCostoDisplay = _restaFinal;
    if (recibo.modoCosto === 'cerrado') {
      var _folioVivoA = Number(recibo.folio);
      var _versionesVivoA = (typeof appData !== 'undefined' && appData.recibos ? appData.recibos : [])
        .filter(function(x){ return x && Number(x.folio) === _folioVivoA && !x.esComplemento; });
      var _reciboVivoA = recibo;
      if (_versionesVivoA.length) {
        _versionesVivoA.sort(function(a, b){
          var la = (a.letra || 'A').toUpperCase(), lb = (b.letra || 'A').toUpperCase();
          return la < lb ? -1 : la > lb ? 1 : 0;
        });
        _reciboVivoA = _versionesVivoA[_versionesVivoA.length - 1];
      }
      _reciboVivoA.saldoPendiente = _restaFinal;
    }
  }

  // Notas
  var notasKey='ficha-notas-'+folio+'-'+anio;
  var nd=document.getElementById('fichaNotasDisplay');
  // Cargar desde localStorage primero (inmediato)
  var ns=localStorage.getItem(notasKey)||'';
  nd.textContent=ns||'✎ Escribe aquí notas del expediente — volumen, instrumento, fecha de firma, ubicación, etc.';
  nd.style.fontStyle=ns?'normal':'italic';nd.style.color=ns?'#1a1008':'#7a6840';
  nd.dataset.texto=ns;
  // Intentar cargar desde R2 (puede tener versión más reciente)
  if(window.descargarR2 && window.SB_DESPACHO_ID) {
    var _notaPath = window.SB_DESPACHO_ID+'/notas_folio/'+anio+'/'+folio+'.txt';
    window.descargarR2(_notaPath, 'expedientes', true).then(function(blob) {
      if(!blob) return;
      return blob.text();
    }).then(function(txt) {
      if(!txt) return;
      var nd3=document.getElementById('fichaNotasDisplay');
      if(!nd3) return;
      localStorage.setItem(notasKey, txt);
      nd3.textContent=txt;
      nd3.style.fontStyle='normal';
      nd3.style.color='#1a1008';
      nd3.dataset.texto=txt;
    }).catch(function(){});
  }
  window._fichaRef={folio:folio,anio:anio,notasKey:notasKey};
  // Sin Costo Pactado (modo abierto): nunca se considera liquidado por saldo $0
  var _esModoAbierto = window._abiertoSinCosto(recibo);
  window._fichaLiquidado = _esModoAbierto ? false : (parseFloat(recibo.saldoPendiente||0)<=0);
  // Modo solo lectura si está liquidado
  // En modo Sin Costo Total Pactado, nunca se considera liquidado por saldo $0
  // Solo se liquida con el botón "Cerrar Juicio" (modoCosto = 'cerrado')
  var _esSinCostoPactado = window._abiertoSinCosto(recibo);
  var liquidado = _esSinCostoPactado ? (recibo.modoCosto === 'cerrado') : parseFloat(recibo.saldoPendiente||0)<=0;
  // Notas — deshabilitar clic si liquidado
  var nd2=document.getElementById('fichaNotasDisplay');
  if(liquidado){
    nd2.onclick=null;
    nd2.style.cursor='default';
    nd2.style.opacity='0.7';
    nd2.title='Solo lectura — trámite liquidado';
  } else {
    nd2.onclick=fichaToggleNotas;
    nd2.style.cursor='pointer';
    nd2.style.opacity='1';
    nd2.title='';
  }
  // Botones de acción: ocultar/deshabilitar si liquidado o cancelado
  var _reciboCancelado = !!(recibo && recibo.cancelado);
  var _bloquearAcciones = liquidado || _reciboCancelado;
  // Condición: Juicio o Escritura + Sin Costo Pactado
  var _esJuicioSinCosto = window._abiertoSinCosto(recibo);
  var btnPP=document.getElementById('ficha-btn-pago-parcial');
  var btnPT=document.getElementById('ficha-btn-pago-total');
  if(btnPP) btnPP.style.display=_bloquearAcciones?'none':'';
  if(btnPT) btnPT.style.display=_bloquearAcciones?'none':'';
  // Servicio Complementario: ocultar si bloqueado O si es Juicio Sin Costo Pactado
  var _botonesBloquear = [
    'ficha-btn-vincular'
  ];
  _botonesBloquear.forEach(function(id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.style.display = _bloquearAcciones ? 'none' : '';
  });
  var _btnServComp = document.getElementById('ficha-btn-serv-comp');
  if (_btnServComp) _btnServComp.style.display = _bloquearAcciones ? 'none' : '';
  // Botones exclusivos Juicio Sin Costo Pactado
  var _btnCerrarJuicio = document.getElementById('ficha-btn-cerrar-juicio');
  if (_btnCerrarJuicio) {
    _btnCerrarJuicio.style.display = (_esJuicioSinCosto && !_bloquearAcciones) ? 'flex' : 'none';
    if (_esJuicioSinCosto) {
      var _lblCerrar = window._abLbl(recibo);
      _btnCerrarJuicio.innerHTML = '<span style="font-size:15px;line-height:1;">'+_lblCerrar.ico+'</span>Cerrar '+_lblCerrar.nom;
    }
  }
  // ── Cancelación: marca de agua + banda motivo/concepto ──
  var cancelado = _reciboCancelado;
  var watermark = document.getElementById('ficha-watermark-cancelado');
  var banda = document.getElementById('ficha-banda-cancelacion');
  var elMotivo = document.getElementById('ficha-cancelacion-motivo');
  var elConcepto = document.getElementById('ficha-cancelacion-concepto');
  var elConceptoWrap = document.getElementById('ficha-cancelacion-concepto-wrap');
  if(watermark) watermark.style.display = cancelado ? 'block' : 'none';
  var watermarkLiq = document.getElementById('ficha-watermark-liquidado');
  if(watermarkLiq) watermarkLiq.style.display = (liquidado && !cancelado) ? 'block' : 'none';
  if(banda) banda.style.display = cancelado ? 'block' : 'none';
  if(cancelado && elMotivo){
    elMotivo.textContent = recibo.motivoCancelacion || 'Sin motivo especificado';
  }
  if(cancelado && elConcepto){
    var concepto = recibo.cancelacionConceptoInterno || '';
    if(concepto && elConceptoWrap){
      elConceptoWrap.style.display = 'block';
      elConcepto.textContent = concepto;
    } else if(elConceptoWrap){
      elConceptoWrap.style.display = 'none';
    }
  }

  // Liquidado/Cancelado: deshabilitar Servicio Complementario y Vincular Arch.
  var btnSC  = document.getElementById('ficha-btn-serv-comp');
  var btnVinc= document.getElementById('ficha-btn-vincular');
  var btnExp = document.getElementById('ficha-btn-exp-digital');
  var _bloquear = _bloquearAcciones;
  var _motivoBloqueo = cancelado ? 'folio cancelado' : 'folio liquidado';
  if(_bloquear){
    if(btnSC){   btnSC.disabled=true;   btnSC.style.opacity='0.38'; btnSC.style.cursor='not-allowed'; btnSC.title='No disponible — '+_motivoBloqueo; btnSC.onmouseover=null; btnSC.onmouseout=null; }
    if(btnVinc){ btnVinc.disabled=true; btnVinc.style.opacity='0.38'; btnVinc.style.cursor='not-allowed'; btnVinc.title='No disponible — '+_motivoBloqueo; btnVinc.onmouseover=null; btnVinc.onmouseout=null; }
  } else {
    if(btnSC){   btnSC.disabled=false;  btnSC.style.opacity='1'; btnSC.style.cursor='pointer'; btnSC.title=''; btnSC.onmouseover=function(){ this.style.background='#fde8cc'; }; btnSC.onmouseout=function(){ this.style.background='#fff0e0'; }; }
    if(btnVinc){ btnVinc.disabled=false; btnVinc.style.opacity='1'; btnVinc.style.cursor='pointer'; btnVinc.title=''; btnVinc.onmouseover=function(){ this.style.background='#fde8a0'; }; btnVinc.onmouseout=function(){ this.style.background='#fff8e0'; }; }
  }
  // Exp. Digital: vehicular → abre expediente digital; no vehicular → vincula archivo
  if(btnExp){
    btnExp.disabled=false; btnExp.style.opacity='1'; btnExp.style.cursor='pointer';
    var _esVehicular = !!(recibo && (recibo.placa || recibo.clase || recibo.marca));
    if(_esVehicular){
      btnExp.onclick = function(){ window._fichaAbiertaAntes = true; cerrarFichaFolio(); setTimeout(function(){ abrirExpDigitalVehiculo(reciboEnConsulta); }, 200); };
      btnExp.title = 'Ver / gestionar expediente digital vehicular';
    } else {
      btnExp.onclick = function(){ window._fichaAbiertaAntes = true; cerrarFichaFolio(); setTimeout(abrirVincularArchivo, 200); };
      btnExp.title = 'Vincular archivo digital';
    }
  }
  // Badge modo lectura
  var badgeLiq=document.getElementById('ficha-badge-liquidado');
  if(badgeLiq){
    if(cancelado){
      badgeLiq.textContent='🚫 CANCELADO · Solo lectura';
      badgeLiq.style.color='#8a1a1a'; badgeLiq.style.background='#ffe0e0'; badgeLiq.style.borderColor='#c04040';
      badgeLiq.style.display='inline-block';
    } else {
      badgeLiq.textContent='✅ LIQUIDADO · Solo lectura';
      badgeLiq.style.color='#0f5228'; badgeLiq.style.background='#d4f5e0'; badgeLiq.style.borderColor='#2a9a50';
      badgeLiq.style.display=liquidado?'inline-block':'none';
    }
  }

  // Actualizar display del botón retro según estado actual
  if(typeof fichaRetroActualizarDisplay === 'function') fichaRetroActualizarDisplay();

  // Badge tipo de trámite
  var _badgeTipo = document.getElementById('ficha-badge-tipo-tramite');
  var _headerTipoTotal = document.getElementById('ficha-header-tipo-total');
  var _headerTipoLabel = document.getElementById('ficha-header-tipo-label');
  var _headerTotalDisplay = document.getElementById('ficha-header-total-display');
  var _headerTotalEdit = document.getElementById('ficha-header-total-edit');
  var _headerTotalInput = document.getElementById('ficha-header-total-input');
  if (_badgeTipo) {
    var _tipoLabels = {
      'normal':    'Trámite Normal',
      'vehicular': 'Trámite Vehicular',
      'escritura': 'Trámite de Escrituras',
      'juicio':    'Trámite de Juicio'
    };
    var _tipoRaw = recibo.tipoTramite || recibo.tramites || '';
    var _tipoLabel = _tipoLabels[_tipoRaw] || (_tipoRaw ? _tipoRaw : '');
    var _esEscJuicFicha = (_tipoRaw === 'escritura' || _tipoRaw === 'juicio');
    var _esAdminFicha = !!(typeof empleadoActual === 'undefined' || !empleadoActual ||
      empleadoActual.email.toLowerCase() === (typeof ADMIN_EMAIL !== 'undefined' ? ADMIN_EMAIL.toLowerCase() : 'lexmexico423@gmail.com'));
    var _totalFicha = parseFloat(recibo.total || 0);
    var _fmtTotal = '$' + _totalFicha.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
    if (_esEscJuicFicha) {
      if (_badgeTipo) _badgeTipo.style.display = 'none';
      if (_headerTipoTotal) { _headerTipoTotal.style.display = 'flex'; }
      if (_headerTipoLabel) _headerTipoLabel.textContent = _tipoLabel.toUpperCase();
      // Sin Costo Pactado: mostrar cargos acumulados en lugar del total base
      var _esSinCostoBadge = window._abiertoSinCosto(recibo);
      if (_esSinCostoBadge) {
        var _cargosAcumBadge = (recibo._cargosInternos||[]).reduce(function(s,c){ return s+(parseFloat(c.monto)||0); }, 0);
        if (_headerTotalDisplay) _headerTotalDisplay.textContent = '$' + _cargosAcumBadge.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
      } else {
        if (_headerTotalDisplay) _headerTotalDisplay.textContent = _fmtTotal;
      }
      // Mostrar lápiz solo si es admin, no está liquidado/cancelado y NO es sin costo pactado
      var _lapizTotal = document.getElementById('ficha-total-lapiz');
      var _readWrapTotal = document.getElementById('ficha-total-read-wrap');
      var _editWrapTotal = document.getElementById('ficha-total-edit-wrap');
      if (_lapizTotal)    _lapizTotal.style.display    = (_esAdminFicha && !_bloquearAcciones && !_esSinCostoBadge) ? '' : 'none';
      if (_readWrapTotal) _readWrapTotal.style.display  = 'flex';
      if (_editWrapTotal) _editWrapTotal.style.display  = 'none';
      if (_headerTotalInput) _headerTotalInput.value = _totalFicha.toFixed(2);
      window._fichaTotalOriginal = _totalFicha;
    } else {
      // Mostrar badge normal
      if (_headerTipoTotal) _headerTipoTotal.style.display = 'none';
      if (_tipoLabel) {
        _badgeTipo.textContent = _tipoLabel;
        _badgeTipo.style.display = 'inline-block';
      } else {
        _badgeTipo.style.display = 'none';
      }
    }
  }
  // Guardar referencia al recibo actual en la ficha
  window._fichaReciboActual = recibo;

  // Sección "Cargos por Honorarios" retirada (era de una función anterior):
  // ahora los honorarios se manejan vía Servicio Complementario. Siempre oculta.
  var _cargosWrap = document.getElementById('ficha-cargos-wrap');
  if (_cargosWrap) _cargosWrap.style.display = 'none';
  // Pago Total: solo ocultar si está bloqueado (liquidado/cancelado)
  var _btnPagoTotal = document.getElementById('ficha-btn-pago-total');
  if (_btnPagoTotal) _btnPagoTotal.style.display = _bloquearAcciones ? 'none' : '';
  // Triángulos siempre cerrados al abrir
  var _tri = document.getElementById('ficha-concepto-lapiz');
  if (_tri) _tri.textContent = '▸';
  var _triTotal = document.getElementById('ficha-total-lapiz');
  if (_triTotal) _triTotal.textContent = '▸';
  // Renderizar cargos internos — cargar desde R2 si es posible
  var _cargosLista = document.getElementById('ficha-cargos-lista');
  if (_cargosLista) {
    _cargosLista.innerHTML = '<div style="font-size:0.72rem;color:#7a6840;font-style:italic;padding:4px 0;">Cargando...</div>';
    _cargoR2Cargar(folio, anio).then(function(cargos) {
      // Si mientras cargaba se abrió otro folio, esta respuesta ya es vieja —
      // ignorarla para no pisar el badge/tabla del folio que ahora está visible.
      if (_fichaMyToken !== window._fichaAbrirToken) return;
      if (cargos && cargos.length > 0) recibo._cargosInternos = cargos;
      var _cargos = recibo._cargosInternos || [];
      _cargosLista.innerHTML = '';
      if (_cargos.length === 0) {
        _cargosLista.innerHTML = '<div style="font-size:0.72rem;color:#7a6840;font-style:italic;padding:4px 0;">Sin cargos registrados</div>';
      } else {
        _cargos.forEach(function(c, i) {
          _cargosLista.appendChild(_fichaCargoRow(c, i, recibo, folio, anio));
        });
      }
      _fichaActualizarTotalesConCargos(recibo);
    });
  }

  document.getElementById('modal-ficha-folio').style.display='block';
  // Ya no es un modal flotante — es una sección más de la página de consulta,
  // así que el body debe poder seguir haciendo scroll normal.
}

// ── Señal discreta de sync a otros clientes ─────────────────────────────
function _fichaEnviarSenalSync(tipo, folio) {
  try {
    // Usar el canal Realtime existente del sistema
    if (typeof lexRealtimeBroadcast === 'function') {
      lexRealtimeBroadcast();
    }
    // También forzar sincronización para que los datos lleguen
    if (typeof syncEstadoSupabase === 'function') {
      setTimeout(function(){ syncEstadoSupabase().catch(function(){}); }, 500);
    }
    console.info('[Ficha] Señal sync enviada:', tipo, 'folio:', folio);
  } catch(e) { console.warn('[Ficha] Error señal sync:', e); }
}
function _fichaEsAdmin() {
  return !!(typeof empleadoActual === 'undefined' || !empleadoActual ||
    empleadoActual.email.toLowerCase() === (typeof ADMIN_EMAIL !== 'undefined' ? ADMIN_EMAIL.toLowerCase() : 'lexmexico423@gmail.com'));
}
// ── Actualizar totales en header y footer al agregar/eliminar cargo ───────
function _fichaActualizarTotalesConCargos(recibo) {
  var fmt = function(v){ return parseFloat(v||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var totalBase = parseFloat(recibo.total||0);
  var totalCargos = (recibo._cargosInternos||[]).reduce(function(s,c){ return s+(parseFloat(c.monto)||0); }, 0);
  // Header badge (TRÁMITE DE JUICIO · TOTAL)
  var _rcActual = window._fichaReciboActual || recibo;
  var _esSinCostoBadge2 = window._abiertoSinCosto(_rcActual);
  // Sin Costo Total Pactado (Opción 1): TOTAL consolidado = honorarios (cargos)
  // + servicios complementarios (costosExtra de todas las versiones del folio).
  // El abonado agregado y el total de complementarios los deja la ficha principal
  // en window._fichaAbonadoActual / window._fichaCEActual (con respaldo local).
  // ⚠️ FIX: este total de complementarios se calcula SIEMPRE (no solo en Sin Costo
  // Pactado) — un folio con costo pactado (normal/vehicular/juicio cerrado) que
  // recibe un Servicio Complementario también debe sumarlo al TOTAL/RESTA de este
  // resumen, igual que ya se corrigió en el render principal de la ficha. Sin esto,
  // este bloque (que corre DESPUÉS y sobrescribe TOTAL/RESTA) volvía a ignorar el
  // complementario aunque el render principal ya lo mostrara bien (folio 6).
  var totalComplementarios = 0;
  if (typeof window._fichaCEActual === 'number') {
    totalComplementarios = window._fichaCEActual;
  } else {
    var _folCE = Number(recibo.folio); var _seenCE = {};
    (appData.recibos||[]).filter(function(r){ return r && Number(r.folio)===_folCE && !r.esComplemento; }).forEach(function(r){
      (r.costosExtra||[]).forEach(function(ce){
        if(!ce) return;
        var k=(ce.concepto||'')+'|'+(ce.descripcion||'')+'|'+String(ce.precio||'')+'|'+(ce.fechaHora||'');
        if(_seenCE[k]) return; _seenCE[k]=1;
        totalComplementarios += (parseFloat(ce.precio)||0);
      });
    });
  }
  var totalConCargos = _esSinCostoBadge2 ? (totalBase + totalCargos) : (totalBase + totalCargos + totalComplementarios);
  // Usar el abonado real ya calculado por la ficha principal (window._fichaAbonadoActual),
  // que se basa en los movimientos de contabilidad reales. La reconstruccion anterior
  // (anticipo + pagosParciales) no contemplaba liquidaciones totales que cubren
  // complementarios/costos extra sin dejar una fila explicita en pagosParciales,
  // y podia inflar el saldo pendiente de recibos ya liquidados.
  var totalAbonado = (typeof window._fichaAbonadoActual === 'number')
    ? window._fichaAbonadoActual
    : (parseFloat(recibo.anticipo||0) + (recibo.pagosParciales||[]).reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0));
  var resta = Math.max(0, totalConCargos - totalAbonado);
  var abonadoConsolidado = totalAbonado;
  if (_esSinCostoBadge2 && typeof window._fichaAbonadoActual === 'number') abonadoConsolidado = window._fichaAbonadoActual;
  // RESTA real: misma fuente de verdad que el PDF y los botones Pago Parcial/Total
  // (window._adeudoServicioComplementario) — NO comparar totalComplementarios contra
  // abonadoConsolidado, porque abonadoConsolidado incluye honorarios/pago inicial que
  // no tienen relación con el adeudo de complementarios (esa comparación de bases
  // distintas es lo que hacía ver TOTAL/ABONADO incoherentes, ej. TOTAL $10,000 vs
  // ABONADO $17,000 aun con RESTA $0.00 correcto por casualidad del Math.max(0,...)).
  var _adeudoRealSC2 = (typeof window._adeudoServicioComplementario==='function')
    ? window._adeudoServicioComplementario(_rcActual).total : 0;
  var _restaFinal2 = _esSinCostoBadge2 ? (totalCargos + _adeudoRealSC2) : resta;
  // TOTAL consolidado y coherente: todo el dinero que ya pasó por el folio
  // (abonadoConsolidado) más lo que aún se debe (adeudo real). Así TOTAL siempre
  // coincide con ABONADO cuando no hay nada pendiente, en vez de mostrar solo el
  // total de complementarios contra un abonado de base distinta.
  var _totalSinCosto = _esSinCostoBadge2 ? (abonadoConsolidado + _restaFinal2) : (totalCargos + totalComplementarios);
  var hd = document.getElementById('ficha-header-total-display');
  if (hd) hd.textContent = '$' + fmt(_esSinCostoBadge2 ? _totalSinCosto : totalConCargos);
  var ft = document.getElementById('ficha-total');
  if (ft) ft.textContent = '$' + fmt(_esSinCostoBadge2 ? _totalSinCosto : totalConCargos);
  // Footer resta
  var fp = document.getElementById('ficha-pendiente');
  if (fp) fp.textContent = '$' + fmt(_restaFinal2);
  // Ícono de billetes (COSTO DEL TRÁMITE) — ocultar si sin costo pactado
  var thWrap2 = document.getElementById('ficha-total-header-wrap');
  var th = document.getElementById('ficha-total-header');
  if (_esSinCostoBadge2) {
    if (thWrap2) thWrap2.innerHTML = '<span style="font-family:monospace;font-size:0.68rem;font-weight:700;color:#1a3a70;background:#e6f1fb;padding:2px 10px;border-radius:12px;border:1.5px solid #4a6ea8;letter-spacing:0.06em;">📋 SIN COSTO PACTADO</span>';
  } else {
    if (th) th.textContent = '$' + fmt(totalConCargos);
  }
  // ── FIX RAÍZ (folio 4 y otros 44 más — reportado en Contabilidad/Ficha) ──
  // `recibo` aquí SIEMPRE es la versión A (abrirFichaFolio la ancla así para
  // mostrar la ficha, sin importar cuántas actualizaciones B/C/D... tenga el
  // folio). El saldo pendiente "vivo" del folio, en cambio, le pertenece a la
  // versión MÁS RECIENTE (la última letra) — escribirlo directo sobre `recibo`
  // corrompía el dato histórico y congelado de la versión A con el saldo FINAL
  // del folio completo. Efecto real observado: un recibo A que solo tuvo un
  // anticipo (ej. $1,000 de $10,500, resta $9,500 pendiente) terminaba con
  // saldoPendiente=$0 en cuanto el folio se liquidaba en una letra posterior
  // (B, C…) — por eso su PDF, al regenerarse, mostraba "PAGADO/LIQUIDADO" con
  // RESTA $0.00 en vez del estado real que tuvo esa primera impresión.
  // Se resuelve escribiendo sobre la versión más reciente del folio (que si
  // solo existe la A, es la misma A de siempre — sin cambio de comportamiento
  // para folios de una sola versión).
  var _folioVivo44 = Number(recibo.folio);
  var _versionesVivo44 = (typeof appData !== 'undefined' && appData.recibos ? appData.recibos : [])
    .filter(function(x){ return x && Number(x.folio) === _folioVivo44 && !x.esComplemento; });
  var _reciboVivo44 = recibo;
  if (_versionesVivo44.length) {
    _versionesVivo44.sort(function(a, b){
      var la = (a.letra || 'A').toUpperCase(), lb = (b.letra || 'A').toUpperCase();
      return la < lb ? -1 : la > lb ? 1 : 0;
    });
    _reciboVivo44 = _versionesVivo44[_versionesVivo44.length - 1];
  }
  // Sin Costo Pactado abierto: no sobrescribir saldoPendiente (ver nota arriba,
  // misma razón que en el render principal de la ficha) — solo sincronizar el
  // campo real una vez que el juicio se cerró formalmente.
  if (_esSinCostoBadge2) {
    recibo._restaSinCostoDisplay = _restaFinal2;
    if (recibo.modoCosto === 'cerrado') _reciboVivo44.saldoPendiente = _restaFinal2;
  } else {
    _reciboVivo44.saldoPendiente = _restaFinal2;
  }
}
// ── Re-render de la lista de cargos DESDE MEMORIA (sin recargar R2 — evita carrera) ──
function _fichaRenderCargosLista(recibo, folio, anio) {
  var lista = document.getElementById('ficha-cargos-lista');
  if (!lista) return;
  var cargos = recibo._cargosInternos || [];
  lista.innerHTML = '';
  if (!cargos.length) {
    lista.innerHTML = '<div style="font-size:0.72rem;color:#7a6840;font-style:italic;padding:4px 0;">Sin cargos registrados</div>';
  } else {
    cargos.forEach(function(c, i) { lista.appendChild(_fichaCargoRow(c, i, recibo, folio, anio)); });
  }
  _fichaActualizarTotalesConCargos(recibo);
}
// ── Render fila de cargo con editar/eliminar solo admin ───────────────────
function _fichaCargoRow(c, idx, recibo, folio, anio) {
  var fmt = function(v){ return parseFloat(v||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var esAdmin = _fichaEsAdmin();
  var row = document.createElement('div');
  row.id = 'fcrow-'+idx;
  row.style.cssText = 'border:0.5px solid #85B7EB;border-radius:4px;background:#f0f7ff;margin-bottom:4px;overflow:hidden;';

  var adminBtns = esAdmin && !window._fichaLiquidado
    ? '<span id="fcbtns-'+idx+'" style="display:none;gap:3px;align-items:center;flex-shrink:0;">'
      +'<button onclick="fichaEditarCargo('+idx+')" title="Editar" style="background:none;border:none;cursor:pointer;font-size:13px;padding:0 2px;">✏️</button>'
      +'<button onclick="fichaEliminarCargo('+idx+')" title="Eliminar" style="background:none;border:none;cursor:pointer;color:#a32d2d;font-size:14px;padding:0 2px;">✕</button>'
      +'</span>'
      +'<button onclick="fichaToggleCargoBtns('+idx+')" style="background:none;border:none;cursor:pointer;color:#aaa;font-size:11px;padding:0 3px;transition:color 0.15s;flex-shrink:0;" id="fctri-'+idx+'" onmouseover="this.style.color=\'#4a6ea8\'" onmouseout="this.style.color=\'#aaa\'">◀</button>'
    : '';

  row.innerHTML = '<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;font-size:0.72rem;">'
    +'<div style="flex:1;">'
    +'<span style="color:#0C447C;font-weight:500;">' + escHTML(c.concepto||'') + '</span>'
    + (c.descripcion ? '<span style="color:#7a6840;margin-left:6px;font-size:0.68rem;">' + escHTML(c.descripcion) + '</span>' : '')
    + '<span style="color:#7a6840;margin-left:8px;font-size:0.65rem;">' + (c.fecha||'') + '</span>'
    +'</div>'
    +'<span style="color:#0C447C;font-family:\'DM Mono\',monospace;font-weight:700;white-space:nowrap;flex-shrink:0;">$' + fmt(c.monto) + '</span>'
    + adminBtns
    +'</div>'
    // Form edición inline (oculto)
    +(esAdmin && !window._fichaLiquidado
      ? '<div id="fcedit-'+idx+'" style="display:none;padding:8px 10px;border-top:0.5px solid #85B7EB;background:#e6f7ff;">'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'
        +'<input id="fcedit-concepto-'+idx+'" type="text" value="'+escHTML(c.concepto||'')+'" placeholder="Concepto" style="flex:2;min-width:100px;font-size:0.76rem;padding:4px 7px;border:1px solid #85B7EB;border-radius:4px;background:#fff;">'
        +'<input id="fcedit-desc-'+idx+'" type="text" value="'+escHTML(c.descripcion||'')+'" placeholder="Descripción" style="flex:2;min-width:80px;font-size:0.76rem;padding:4px 7px;border:1px solid #85B7EB;border-radius:4px;background:#fff;">'
        +'<input id="fcedit-monto-'+idx+'" type="number" value="'+parseFloat(c.monto||0)+'" style="width:80px;font-size:0.76rem;padding:4px 7px;border:1px solid #85B7EB;border-radius:4px;background:#fff;text-align:right;">'
        +'<button onclick="fichaGuardarEdicionCargo('+idx+')" style="padding:4px 10px;border-radius:4px;border:1px solid #185FA5;background:#B5D4F4;color:#042C53;font-size:0.72rem;font-weight:700;cursor:pointer;">✓</button>'
        +'<button onclick="fichaToggleCargoBtns('+idx+')" style="padding:4px 10px;border-radius:4px;border:1px solid #d4b870;background:#f5f0e0;color:#7a6840;font-size:0.72rem;cursor:pointer;">✕</button>'
        +'</div></div>'
      : '');
  return row;
}

function fichaToggleCargoBtns(idx) {
  var btns = document.getElementById('fcbtns-'+idx);
  var edit = document.getElementById('fcedit-'+idx);
  var tri  = document.getElementById('fctri-'+idx);
  if (!btns) return;
  var visible = btns.style.display === 'flex';
  btns.style.display = visible ? 'none' : 'flex';
  if (tri) tri.textContent = visible ? '◀' : '▼';
  if (visible && edit) edit.style.display = 'none';
}

function fichaEditarCargo(idx) {
  if (!_fichaEsAdmin()) return;
  var edit = document.getElementById('fcedit-'+idx);
  if (edit) edit.style.display = edit.style.display === 'none' ? 'block' : 'none';
}

function fichaGuardarEdicionCargo(idx) {
  if (!_fichaEsAdmin()) return;
  var recibo = window._fichaReciboActual;
  if (!recibo || !Array.isArray(recibo._cargosInternos)) return;
  var c = recibo._cargosInternos[idx];
  if (!c) return;
  var nuevoConcepto = (document.getElementById('fcedit-concepto-'+idx)||{}).value || '';
  var nuevoDesc     = (document.getElementById('fcedit-desc-'+idx)||{}).value || '';
  var nuevoMonto    = parseFloat((document.getElementById('fcedit-monto-'+idx)||{}).value) || 0;
  if (!nuevoConcepto.trim()) { if(typeof toast==='function') toast('El concepto no puede estar vacío','err'); return; }
  if (nuevoMonto <= 0) { if(typeof toast==='function') toast('El monto debe ser mayor a $0','err'); return; }
  if (!confirm('¿Guardar cambios en este cargo?')) return;
  c.concepto    = nuevoConcepto.toUpperCase().trim();
  c.descripcion = nuevoDesc;
  c.monto       = nuevoMonto;
  var folio = recibo.folio;
  var anio  = recibo.anio_folio || new Date().getFullYear();
  // Re-render inmediato desde memoria (autoritativo) + recálculo de saldo
  _fichaRenderCargosLista(recibo, folio, anio);
  if(typeof toast==='function') toast('Guardando cambio...', 'loading');
  // Persistir en R2 (await), Supabase (recibo completo vía save) y local (dentro de R2Guardar)
  Promise.resolve(_cargoR2Guardar(folio, anio, recibo._cargosInternos))
    .catch(function(e){ console.warn('[Cargo] R2 editar:', e); })
    .then(function(){
      try { if(typeof save==='function') save(); } catch(e) {}
      _fichaEnviarSenalSync('cargo-editado', folio);
      if(typeof toast==='function') toast('✅ Cargo actualizado y sincronizado', 'ok');
    });
}
// ── Eliminar cargo (solo admin) ───────────────────────────────────────────
function fichaEliminarCargo(idx) {
  if (!_fichaEsAdmin()) return;
  var recibo = window._fichaReciboActual;
  if (!recibo || !Array.isArray(recibo._cargosInternos)) return;
  var c = recibo._cargosInternos[idx];
  if (!c) return;
  if (!confirm('¿Eliminar cargo "' + c.concepto + '" por $' + parseFloat(c.monto||0).toFixed(2) + '?')) return;
  recibo._cargosInternos.splice(idx, 1);
  var folio = recibo.folio;
  var anio  = recibo.anio_folio || new Date().getFullYear();
  // Re-render inmediato desde memoria (autoritativo) + recálculo de saldo
  _fichaRenderCargosLista(recibo, folio, anio);
  if(typeof toast==='function') toast('Eliminando...', 'loading');
  // Persistir borrado en R2 (await), Supabase (recibo completo vía save) y local
  Promise.resolve(_cargoR2Guardar(folio, anio, recibo._cargosInternos))
    .catch(function(e){ console.warn('[Cargo] R2 eliminar:', e); })
    .then(function(){
      try { if(typeof save==='function') save(); } catch(e) {}
      _fichaEnviarSenalSync('cargo-eliminado', folio);
      if(typeof toast==='function') toast('✅ Cargo eliminado y sincronizado', 'ok');
    });
}
// ── Eliminar gasto extraoficial (solo admin) ──────────────────────────────
// ── FIN HELPERS FICHA ─────────────────────────────────────────────────────
function fichaActivarEdicionTotal() {
  var rw  = document.getElementById('ficha-total-read-wrap');
  var ew  = document.getElementById('ficha-total-edit-wrap');
  var inp = document.getElementById('ficha-header-total-input');
  var tri = document.getElementById('ficha-total-lapiz');
  if(rw) rw.style.display = 'none';
  if(ew) ew.style.display = 'flex';
  if(tri) tri.textContent = '▾';
  if(inp) { inp.focus(); inp.select(); }
}
function fichaCancelarEdicionTotal() {
  var rw  = document.getElementById('ficha-total-read-wrap');
  var ew  = document.getElementById('ficha-total-edit-wrap');
  var inp = document.getElementById('ficha-header-total-input');
  var tri = document.getElementById('ficha-total-lapiz');
  if(rw) rw.style.display = 'flex';
  if(ew) ew.style.display = 'none';
  if(tri) tri.textContent = '▸';
  if(inp && window._fichaTotalOriginal !== undefined) inp.value = window._fichaTotalOriginal.toFixed(2);
}
// ── Toggle edición CONCEPTO ──
function fichaActivarEdicionConcepto() {
  var rw  = document.getElementById('ficha-concepto-read-wrap');
  var ew  = document.getElementById('ficha-concepto-edit-wrap');
  var inp = document.getElementById('ficha-concepto-input');
  var tri = document.getElementById('ficha-concepto-lapiz');
  if(rw) rw.style.display = 'none';
  if(ew) ew.style.display = 'flex';
  if(tri) tri.textContent = '▾';
  if(inp) { inp.focus(); inp.select(); }
}
function fichaCancelarEdicionConcepto() {
  var rw  = document.getElementById('ficha-concepto-read-wrap');
  var ew  = document.getElementById('ficha-concepto-edit-wrap');
  var inp = document.getElementById('ficha-concepto-input');
  var tri = document.getElementById('ficha-concepto-lapiz');
  if(rw) rw.style.display = 'flex';
  if(ew) ew.style.display = 'none';
  if(tri) tri.textContent = '▸';
  if(inp && window._fichaConceptoOriginal !== undefined) inp.value = window._fichaConceptoOriginal;
}
// Guarda el concepto editado en Juicio
function fichaAgregarCargo() {
  var form = document.getElementById('fichaFormCargo');
  if (form) {
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    // Inicializar fecha con hoy
    var fechaInp = document.getElementById('fichaCargoFecha');
    if (fechaInp && !fechaInp.value) {
      fechaInp.value = typeof fechaCDMX_ISO === 'function' ? fechaCDMX_ISO() : new Date().toISOString().slice(0,10);
    }
    var inp = document.getElementById('fichaCargoConcepto');
    if (inp) inp.focus();
  }
}

function fichaGuardarCargo() {
  var recibo = window._fichaReciboActual;
  if (!recibo) return;
  var concepto    = (document.getElementById('fichaCargoConcepto')||{}).value || '';
  var descripcion = (document.getElementById('fichaCargoDescripcion')||{}).value || '';
  var fecha       = (document.getElementById('fichaCargoFecha')||{}).value || (typeof fechaCDMX_ISO==='function' ? fechaCDMX_ISO() : new Date().toISOString().slice(0,10));
  var monto       = parseFloat((document.getElementById('fichaCargoMonto')||{}).value) || 0;
  if (!concepto.trim()) { if(typeof toast==='function') toast('Ingresa el concepto del cargo','err'); return; }
  if (monto <= 0) { if(typeof toast==='function') toast('El monto debe ser mayor a $0','err'); return; }
  if (!confirm('¿Agregar cargo de $' + monto.toLocaleString('es-MX',{minimumFractionDigits:2}) + ' por "' + concepto + '"?')) return;
  // Agregar al array de cargos internos del recibo
  if (!Array.isArray(recibo._cargosInternos)) recibo._cargosInternos = [];
  var nuevoCargo = {
    id: 'C-' + Date.now(),
    concepto: concepto.toUpperCase(),
    descripcion: descripcion,
    monto: monto,
    fecha: fecha
  };
  recibo._cargosInternos.push(nuevoCargo);
  var folio = recibo.folio;
  var anio  = recibo.anio_folio || new Date().getFullYear();
  // Re-render inmediato desde memoria (recalcula saldo = total + cargos − abonado)
  _fichaRenderCargosLista(recibo, folio, anio);
  // Limpiar campos
  document.getElementById('fichaFormCargo').style.display = 'none';
  document.getElementById('fichaCargoConcepto').value = '';
  document.getElementById('fichaCargoDescripcion').value = '';
  document.getElementById('fichaCargoMonto').value = '';
  document.getElementById('fichaCargoFecha').value = '';
  if(typeof toast==='function') toast('Guardando cargo...', 'loading');
  // Persistir: R2 (await) → Supabase (recibo completo vía save) → backup → señal sync
  Promise.resolve(_cargoR2Guardar(folio, anio, recibo._cargosInternos))
    .catch(function(e){ console.warn('[Cargo] R2 agregar:', e); })
    .then(function(){
      try { if(typeof save==='function') save(); } catch(e) { console.warn('[Cargo] Supabase:', e); }
      if (typeof generarBackupDiario === 'function') { try { generarBackupDiario(); } catch(e) {} }
      _fichaEnviarSenalSync('cargo-agregado', folio);
      if(typeof toast==='function') toast('✅ Cargo agregado y sincronizado: $' + monto.toLocaleString('es-MX',{minimumFractionDigits:2}), 'ok');
    });
}

// ── Cargos internos R2 (lex-expedientes) ─────────────────────────────────
function _cargoR2Path(folio, anio) {
  const did = window.SB_DESPACHO_ID || 'local';
  return `${did}/cargos_honorarios/${anio}/${folio}.json`;
}
async function _cargoR2Cargar(folio, anio) {
  if (window.descargarR2 && window.SB_DESPACHO_ID) {
    try {
      const blob = await window.descargarR2(_cargoR2Path(folio, anio), 'expedientes', true);
      if (blob) {
        const txt = await blob.text();
        const data = JSON.parse(txt);
        try { localStorage.setItem('ficha-cargos-'+folio+'-'+anio, txt); } catch(e){}
        return data;
      }
    } catch(e) { console.warn('[CargoR2] Carga R2 falló, usando localStorage:', e); }
  }
  try { return JSON.parse(localStorage.getItem('ficha-cargos-'+folio+'-'+anio) || '[]'); } catch(e) { return []; }
}
async function _cargoR2Guardar(folio, anio, cargos) {
  const json = JSON.stringify(cargos);
  try { localStorage.setItem('ficha-cargos-'+folio+'-'+anio, json); } catch(e){}
  if (window.subirR2 && window.SB_DESPACHO_ID) {
    try {
      const blob = new Blob([json], {type:'application/json'});
      const file = new File([blob], folio+'.json', {type:'application/json'});
      const ok = await window.subirR2(file, _cargoR2Path(folio, anio), 'expedientes');
      if (!ok) console.warn('[CargoR2] No se pudo guardar en R2');
      else console.info('[CargoR2] Guardado en lex-expedientes:', _cargoR2Path(folio, anio));
    } catch(e) { console.warn('[CargoR2] Error guardando en R2:', e); }
  }
}
// ── FIN CARGOS R2 ─────────────────────────────────────────────────────────

async function fichaCerrarJuicio() {
  var recibo = window._fichaReciboActual || reciboEnConsulta;
  if (!recibo) return;
  // Textos por categoría (Juicio/Escritura conservan exactamente su texto original;
  // Trámite Normal y Vehicular usan la misma lógica respetando su propia categoría).
  var _cierreMap = {
    escritura: { nom:'escritura',          art:'esta', ico:'📜', cerrado:'Escritura cerrada' },
    juicio:    { nom:'juicio',             art:'este', ico:'⚖️', cerrado:'Juicio cerrado' },
    normal:    { nom:'trámite',            art:'este', ico:'📄', cerrado:'Trámite cerrado' },
    vehicular: { nom:'trámite vehicular',  art:'este', ico:'🚗', cerrado:'Trámite vehicular cerrado' }
  };
  var _c = _cierreMap[recibo.tipoTramite] || _cierreMap.juicio;
  if (!confirm('¿Estás seguro de cerrar definitivamente '+_c.art+' '+_c.nom+'?\nEsta acción liquidará el folio y no podrá reabrirse.')) return;
  // Marcar como cerrado y liquidar. `recibo` aquí suele ser la versión A
  // (window._fichaReciboActual la ancla así) — el cierre real del trámite le
  // pertenece a la versión MÁS RECIENTE del folio, así que modoCosto/liquidado
  // se marcan en A (metadato del folio completo) pero saldoPendiente=0 se
  // escribe sobre la última versión, para no corromper el histórico congelado
  // de A si el folio tuvo actualizaciones (mismo fix que en _fichaActualizarTotalesConCargos).
  recibo.modoCosto = 'cerrado';
  var _folioVivoCJ = Number(recibo.folio);
  var _versionesVivoCJ = (typeof appData !== 'undefined' && appData.recibos ? appData.recibos : [])
    .filter(function(x){ return x && Number(x.folio) === _folioVivoCJ && !x.esComplemento; });
  var _reciboVivoCJ = recibo;
  if (_versionesVivoCJ.length) {
    _versionesVivoCJ.sort(function(a, b){
      var la = (a.letra || 'A').toUpperCase(), lb = (b.letra || 'A').toUpperCase();
      return la < lb ? -1 : la > lb ? 1 : 0;
    });
    _reciboVivoCJ = _versionesVivoCJ[_versionesVivoCJ.length - 1];
  }
  _reciboVivoCJ.saldoPendiente = 0;
  _reciboVivoCJ.saldoNuevo = 0;
  _reciboVivoCJ.liquidado = true;
  recibo.liquidado = true;
  try {
    if(typeof save==='function') save();
    if(typeof _eliminarPendientePorFolio==='function') _eliminarPendientePorFolio(recibo.folio);
    if(typeof toast==='function') toast(_c.ico+' '+_c.cerrado+' y folio liquidado', 'ok');
  } catch(e) { console.warn('Error cerrando trámite:', e); }
  cerrarFichaFolio();
  setTimeout(function(){
    if(typeof ejecutarLiquidacionTotal==='function') ejecutarLiquidacionTotal();
  }, 300);
}

function fichaGuardarConcepto() {
  var recibo = window._fichaReciboActual;
  if (!recibo) return;
  var input = document.getElementById('ficha-concepto-input');
  if (!input) return;
  var nuevoTitulo = input.value.trim().toUpperCase();
  if (!nuevoTitulo) { if(typeof toast==='function') toast('El título no puede estar vacío','err'); return; }
  if (!confirm('¿Estás seguro de cambiar el título a:\n"' + nuevoTitulo + '"?')) return;
  // Solo guarda en el campo de título de la ficha, SIN tocar el concepto del recibo
  recibo._tituloFichaJuicio = nuevoTitulo;
  // Actualizar display
  var disp = document.getElementById('ficha-concepto');
  if (disp) disp.textContent = nuevoTitulo;
  window._fichaConceptoOriginal = nuevoTitulo;
  // Volver al modo lectura con triángulo
  fichaCancelarEdicionConcepto();
  try {
    if (typeof save === 'function') save();
    if (typeof toast === 'function') toast('✅ Título actualizado', 'ok');
  } catch(e) { console.warn('Error guardando título:', e); }
}

// Guarda el total editado en Supabase y recalcula
async function fichaGuardarTotalEditable() {
  var recibo = window._fichaReciboActual;
  if (!recibo) return;
  var input = document.getElementById('ficha-header-total-input') || document.getElementById('ficha-total-input');
  if (!input) return;
  var nuevoTotal = parseFloat(input.value) || 0;
  if (nuevoTotal < 0) { if(typeof toast==='function') toast('El total no puede ser negativo','err'); return; }
  if (!confirm('¿Estás seguro de cambiar el total a $' + nuevoTotal.toLocaleString('es-MX',{minimumFractionDigits:2}) + '?')) return;
  recibo.total = nuevoTotal;
  // Mismo criterio que _fichaActualizarTotalesConCargos: preferir el abonado real
  // (window._fichaAbonadoActual, basado en movimientos de contabilidad) sobre la
  // reconstruccion anticipo+pagosParciales, que no contempla liquidaciones totales.
  var abonado = (typeof window._fichaAbonadoActual === 'number')
    ? window._fichaAbonadoActual
    : (parseFloat(recibo.anticipo || 0) + (recibo.pagosParciales||[]).reduce(function(s,p){return s+(parseFloat(p.cantidad)||0);},0));
  recibo.saldoPendiente = Math.max(0, nuevoTotal - abonado);
  try {
    if (typeof save === 'function') save();
    if (typeof toast === 'function') toast('✅ Total actualizado: $' + nuevoTotal.toLocaleString('es-MX', {minimumFractionDigits:2}), 'ok');
  } catch(e) { console.warn('Error guardando total:', e); }
  setTimeout(function(){ if(typeof abrirFichaFolio==='function') abrirFichaFolio(); }, 400);
}

// Genera e imprime el Estado de Cuenta de un folio
function fichaImprimirEstadoCuenta() {
  var recibo = window._fichaReciboActual || reciboEnConsulta;
  if (!recibo) { if(typeof toast==='function') toast('No hay folio seleccionado','err'); return; }
  var folio = Number(recibo.folio);
  var anio  = recibo.anio_folio || new Date().getFullYear();
  var fmt   = function(v){ return '$'+parseFloat(v||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var _num  = function(v){ var n=parseFloat(v); return isNaN(n)?0:n; };
  var _esc  = function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var fmtFecha = function(iso){ if(!iso) return '—'; var p=String(iso).substring(0,10).split('-'); if(p.length<3) return iso; var mi=parseInt(p[1],10)-1; return parseInt(p[2],10)+' de '+(meses[mi]||'')+' de '+p[0]; };
  var _fl = function(letra){ return (typeof folioConLetra==='function') ? folioConLetra(folio, anio, letra||'A') : (String(folio)+(letra||'A')); };

  // ── Versiones (NO complemento) del folio, ordenadas A,B,C... ──
  var versiones = (appData.recibos||[]).filter(function(r){ return r && Number(r.folio)===folio && !r.esComplemento; });
  versiones.sort(function(a,b){ return String(a.letra||'A').charCodeAt(0)-String(b.letra||'A').charCodeAt(0); });
  var primera = versiones[0] || recibo;
  var ultima  = versiones[versiones.length-1] || recibo;
  var nombre  = ultima.nombre || (recibo.clientes&&recibo.clientes[0]&&recibo.clientes[0].nombre) || recibo.nombre || '—';
  var concepto= (ultima.conceptos&&ultima.conceptos[0]&&ultima.conceptos[0].concepto) || ultima.concepto || ultima.servicio || '—';
  var _esAbierto = window._modoCostoFolio(ultima)==='abierto' || window._modoCostoFolio(recibo)==='abierto';
  var _cancelado = versiones.some(function(v){ return v.cancelado; });

  // ── Movimientos REALES de contabilidad para este folio (fuente de verdad) ──
  var movs = (typeof D!=='undefined' && Array.isArray(D.movimientos)) ? D.movimientos.filter(function(m){
    return m && !m.borrado && m.fuente==='recibo' && Number(m.folio)===folio;
  }) : [];
  var movHon    = movs.filter(function(m){ var e=(m.estatus||''); return e!=='Complementario' && e!=='Cancelación'; });
  var movComp   = movs.filter(function(m){ return (m.estatus||'')==='Complementario'; });
  var movCancel = movs.filter(function(m){ return (m.estatus||'')==='Cancelación'; });

  // ── Complementarios EXACTOS (independientes — NO afectan el saldo del trámite) ──
  var compExactos = (ultima.costosExtra||[]).filter(function(c){ return c && c.liquidadoAlMomento && _num(c.montoLiquidado)===_num(c.precio) && _num(c.precio)>0; });
  var totalCompExact   = compExactos.reduce(function(s,c){ return s+_num(c.montoLiquidado); },0);
  var regCompExact     = movComp.reduce(function(s,m){ return s+_num(m.monto); },0);

  // ── Costo del trámite (HONORARIOS) — usa el total del recibo ORIGINAL
  // (letra A), no el del último ("ultima"). El campo "total" del último
  // recibo no siempre es el pactado completo: en un Pago Total/Liquidación
  // se reescribe para representar el ADEUDO ANTERIOR que se está liquidando
  // a $0 (folio 42B real: total=$850, el adeudo que traía, no el pactado
  // original de $1,850), y en Costo Pactado con Servicio Complementario
  // acumula también lo ya liquidado (folio 6C: total=$21,000). La versión A
  // nunca cambia de significado ni lleva Servicio Complementario (ese solo
  // se agrega desde B+), así que es la única fuente confiable para el costo
  // real del trámite — no hace falta restar totalCompExact porque A nunca lo incluyó.
  var costoTramite = _esAbierto
    ? (ultima._cargosInternos||recibo._cargosInternos||[]).reduce(function(s,c){ return s+_num(c.monto); },0)
    : _num(primera.total);

  // ── EVENTOS del libro de honorarios (CARGO/ABONO cronológico desde contabilidad) ──
  var eventos = [];
  if (_esAbierto) {
    // Sin costo pactado: cada cargo interno es un CARGO con su propia fecha
    (ultima._cargosInternos||recibo._cargosInternos||[]).forEach(function(c){
      eventos.push({ fecha:(c.fecha||'').substring(0,10), hora:'', fl:_fl(ultima.letra), concepto:(c.concepto||'Cargo')+(c.descripcion?' · '+c.descripcion:''), cargo:_num(c.monto), abono:0, tag:'Cargo', ord:0 });
    });
  } else {
    // Cargo desglosado por versión: base en A + incrementos (complementarios folados) en cada versión.
    // La suma de cargos = ultima.total (reconcilia exacto). Los complementarios EXACTOS no entran aquí.
    var prevTotal = 0;
    versiones.forEach(function(v, idx){
      var letraV = v.letra||'A';
      var totalV = _num(v.total);
      var delta  = totalV - prevTotal;
      prevTotal  = totalV;
      var fechaV = ((v.esActualizacion&&v.fechaActualizacion)?v.fechaActualizacion:(v.fecha_recibo||v.fecha)||'').substring(0,10);
      var horaV  = ((v.esActualizacion&&v.horaActualizacion)?v.horaActualizacion:(v.hora||''));
      if (idx===0) {
        eventos.push({ fecha:fechaV, hora:horaV, fl:_fl(letraV), concepto:'Costo del trámite · '+concepto, cargo:totalV, abono:0, tag:'Costo', ord:0 });
      } else if (delta > 0.5) {
        var ceAdd = (v.costosExtra||[]).filter(function(c){ return c && (c.folioLetra===letraV) && !(c.liquidadoAlMomento && _num(c.montoLiquidado)===_num(c.precio)); });
        var lbl = ceAdd.length ? ceAdd.map(function(c){ return c.concepto||'Cargo adicional'; }).join(' · ') : 'Cargo adicional';
        eventos.push({ fecha:fechaV, hora:horaV, fl:_fl(letraV), concepto:lbl, cargo:delta, abono:0, tag:'Cargo', ord:0 });
      } else if (delta < -0.5) {
        eventos.push({ fecha:fechaV, hora:horaV, fl:_fl(letraV), concepto:'Ajuste de costo · '+concepto, cargo:0, abono:-delta, tag:'Ajuste', ord:0 });
      }
    });
  }
  // Abonos = movimientos de honorarios reales (anticipo, parciales, liquidación, complementario folado)
  movHon.forEach(function(m){
    var letra = (m.letra||'A');
    var tag   = (m.estatus||'').trim() || (String(m.cat||'').split('·')[0].trim()) || 'Abono';
    if (m.tipo==='egreso') {
      eventos.push({ fecha:(m.fecha||'').substring(0,10), hora:(m.hora||''), fl:_fl(letra), concepto:'Devolución · '+concepto, cargo:_num(m.monto), abono:0, tag:'Devolución', ord:1 });
    } else {
      eventos.push({ fecha:(m.fecha||'').substring(0,10), hora:(m.hora||''), fl:_fl(letra), concepto:concepto, cargo:0, abono:_num(m.monto), tag:tag, ord:1 });
    }
  });
  // Cancelación (rama propia del modelo)
  movCancel.forEach(function(m){
    var letra=(m.letra||'A');
    eventos.push({ fecha:(m.fecha||'').substring(0,10), hora:(m.hora||''), fl:_fl(letra), concepto:'Cancelación · '+concepto, cargo:(m.tipo==='egreso'?_num(m.monto):0), abono:(m.tipo!=='egreso'?_num(m.monto):0), tag:'Cancelación', ord:2 });
  });
  // Orden cronológico estable (apertura primero ante misma fecha/hora)
  eventos.sort(function(a,b){
    var ka=(a.fecha||'')+' '+(a.hora||''), kb=(b.fecha||'')+' '+(b.hora||'');
    if(ka!==kb) return ka<kb?-1:1;
    return a.ord-b.ord;
  });

  // ── Filas + saldo corrido ──
  var saldo=0, filas='';
  var tagColor = function(t){
    var k=(t||'').toLowerCase();
    if(k.indexOf('liquid')>=0) return '#1a7a3a';
    if(k.indexOf('parcial')>=0||k.indexOf('abono')>=0) return '#8c6518';
    if(k.indexOf('anticipo')>=0) return '#1a5fa8';
    if(k.indexOf('cancel')>=0) return '#a32d2d';
    if(k.indexOf('devol')>=0) return '#a32d2d';
    if(k.indexOf('costo')>=0||k.indexOf('cargo')>=0) return '#4a6ea8';
    return '#7a6840';
  };
  eventos.forEach(function(e){
    saldo = saldo + e.cargo - e.abono;
    var saldoShow = Math.max(0, saldo);
    filas += '<tr style="border-bottom:0.5px solid #e8d098;">'
      +'<td style="padding:6px 8px;font-family:\'DM Mono\',monospace;font-size:11px;color:#1a5fa8;font-weight:700;white-space:nowrap;">'+_esc(e.fl)+'</td>'
      +'<td style="padding:6px 8px;font-size:11px;color:#3a2a0a;white-space:nowrap;">'+fmtFecha(e.fecha)+'</td>'
      +'<td style="padding:6px 8px;font-size:11px;color:#3a2a0a;">'+_esc(String(e.concepto).toUpperCase())
        +' <span style="font-family:\'DM Mono\',monospace;font-size:8.5px;color:'+tagColor(e.tag)+';border:0.5px solid '+tagColor(e.tag)+';border-radius:8px;padding:1px 6px;white-space:nowrap;">'+_esc(e.tag)+'</span></td>'
      +'<td style="padding:6px 8px;font-size:11px;text-align:right;color:#a32d2d;font-weight:600;white-space:nowrap;">'+(e.cargo>0?fmt(e.cargo):'—')+'</td>'
      +'<td style="padding:6px 8px;font-size:11px;text-align:right;color:#1a7a3a;font-weight:600;white-space:nowrap;">'+(e.abono>0?fmt(e.abono):'—')+'</td>'
      +'<td style="padding:6px 8px;font-size:11px;text-align:right;color:'+(saldoShow>0?'#a32d2d':'#1a7a3a')+';font-weight:700;white-space:nowrap;">'+fmt(saldoShow)+'</td>'
    +'</tr>';
  });
  if(!eventos.length){
    filas = '<tr><td colspan="6" style="padding:14px 8px;text-align:center;font-size:11px;color:#7a6840;">Sin movimientos registrados para este folio.</td></tr>';
  }

  // ── Totales autoritativos (canónicos) ──
  var sumAbonosReales = movHon.reduce(function(s,m){ return s + (m.tipo==='egreso' ? -_num(m.monto) : _num(m.monto)); },0);
  var saldoCanon   = _esAbierto ? Math.max(0, costoTramite - sumAbonosReales) : Math.max(0, _num(ultima.saldoPendiente));
  var abonadoCanon = Math.max(0, costoTramite - saldoCanon);
  var saldoLibro   = Math.max(0, saldo); // saldo final reconstruido desde contabilidad
  var descuadre    = Math.abs(saldoLibro - saldoCanon) > 0.5;

  // (compExactos/totalCompExact/regCompExact ya se calcularon arriba, antes de costoTramite)
  var compFilas = compExactos.map(function(c){
    var f = c.fechaHora || c.fecha || '';
    return '<tr style="border-bottom:0.5px solid #ecdcc0;">'
      +'<td style="padding:5px 8px;font-size:10.5px;color:#3a2a0a;white-space:nowrap;">'+fmtFecha(f)+'</td>'
      +'<td style="padding:5px 8px;font-size:10.5px;color:#3a2a0a;">'+_esc(String(c.concepto||'Servicio complementario').toUpperCase())+'</td>'
      +'<td style="padding:5px 8px;font-size:10.5px;text-align:right;color:#1a7a3a;font-weight:700;white-space:nowrap;">'+fmt(c.montoLiquidado)+' <span style="font-size:8.5px;color:#1a7a3a;">✓ Liquidado</span></td>'
    +'</tr>';
  }).join('');

  var hoy = new Date();
  var fechaImpresion = hoy.getDate()+' de '+meses[hoy.getMonth()]+' de '+hoy.getFullYear();

  // ── Sección complementarios (solo si existen) ──
  var seccionComp = '';
  if(compExactos.length){
    seccionComp =
      '<div style="margin-top:18px;">'
      +'<div style="font-family:\'DM Mono\',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#a05010;margin-bottom:4px;">🧩 Servicios complementarios <span style="font-size:9px;text-transform:none;letter-spacing:0;color:#7a6840;">(cobro independiente — no afecta el saldo del trámite)</span></div>'
      +'<table style="width:100%;border-collapse:collapse;"><thead><tr>'
      +'<th style="background:#fff0e0;font-size:9px;font-family:\'DM Mono\',monospace;text-transform:uppercase;letter-spacing:0.06em;color:#a05010;padding:5px 8px;text-align:left;border-bottom:1.5px solid #e0b888;">Fecha</th>'
      +'<th style="background:#fff0e0;font-size:9px;font-family:\'DM Mono\',monospace;text-transform:uppercase;letter-spacing:0.06em;color:#a05010;padding:5px 8px;text-align:left;border-bottom:1.5px solid #e0b888;">Concepto</th>'
      +'<th style="background:#fff0e0;font-size:9px;font-family:\'DM Mono\',monospace;text-transform:uppercase;letter-spacing:0.06em;color:#a05010;padding:5px 8px;text-align:right;border-bottom:1.5px solid #e0b888;">Importe</th>'
      +'</tr></thead><tbody>'+compFilas+'</tbody></table>'
      + (Math.abs(regCompExact-totalCompExact)>0.5 ? '<div style="font-size:9px;color:#c0161a;margin-top:4px;font-family:\'DM Mono\',monospace;">⚠ Contabilidad registra '+fmt(regCompExact)+' en complementarios — verificar en panel de Saldos.</div>' : '')
      +'</div>';
  }

  // ── Caja de totales (resumen) ──
  var avisoDescuadre = descuadre
    ? '<div style="margin-top:8px;padding:7px 10px;background:#fff0f0;border:1px solid #c0161a;border-radius:6px;font-size:10px;color:#c0161a;font-family:\'DM Mono\',monospace;">⚠ El saldo reconstruido desde contabilidad ('+fmt(saldoLibro)+') no coincide con el saldo del recibo ('+fmt(saldoCanon)+'). Revise el folio en SCANSYS → Saldos.</div>'
    : '';
  var filaCompTotal = compExactos.length
    ? '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span style="color:#a05010;">Complementarios cobrados</span><strong style="color:#a05010;">'+fmt(totalCompExact)+'</strong></div>'
    : '';

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Estado de Cuenta — Folio '+folio+'</title>'
    +'<style>body{font-family:\'DM Sans\',Arial,sans-serif;margin:0;padding:24px;background:#fff;color:#1a1008;}'
    +'h1{font-size:14px;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 4px;}'
    +'h2{font-size:11px;font-weight:400;text-align:center;color:#7a6840;margin:0 0 16px;}'
    +'.info{font-size:11px;color:#3a2a0a;margin-bottom:12px;line-height:1.7;}'
    +'table{width:100%;border-collapse:collapse;margin-top:12px;}'
    +'th{background:#f5f0e0;font-size:10px;font-family:\'DM Mono\',monospace;text-transform:uppercase;letter-spacing:0.08em;color:#7a6840;padding:6px 8px;text-align:left;border-bottom:1.5px solid #d4b870;}'
    +'.tot{margin-top:18px;margin-left:auto;width:280px;border:1.5px solid #c8952a;border-radius:8px;overflow:hidden;font-family:\'DM Mono\',monospace;}'
    +'.tot .h{background:#f5ecd0;border-bottom:1px dashed #c8952a;padding:5px 12px;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5a3e10;}'
    +'.tot .b{padding:8px 12px;font-size:11px;}'
    +'.tot .b > div{margin:2px 0;}'
    +'.footer{margin-top:22px;font-size:10px;color:#7a6840;text-align:center;border-top:0.5px solid #d4b870;padding-top:10px;}'
    +'</style></head><body>'
    +'<h1>LEX-MÉXICO · Despacho Jurídico</h1>'
    +'<h2>Estado de Cuenta · Folio '+folio+' · Generado el '+fechaImpresion+'</h2>'
    +'<div class="info"><strong>Cliente:</strong> '+_esc(nombre)+'<br>'
    +'<strong>Concepto:</strong> '+_esc(String(concepto).toUpperCase())+'<br>'
    +'<strong>Costo del trámite:</strong> '+fmt(costoTramite)+(_cancelado?' &nbsp;·&nbsp; <span style="color:#a32d2d;font-weight:700;">FOLIO CANCELADO</span>':'')+'</div>'
    +'<table><thead><tr>'
    +'<th>Folio</th><th>Fecha</th><th>Concepto</th>'
    +'<th style="text-align:right">Cargo</th><th style="text-align:right">Abono</th><th style="text-align:right">Saldo</th>'
    +'</tr></thead><tbody>'+filas+'</tbody></table>'
    + seccionComp
    +'<div class="tot"><div class="h">Resumen del folio</div><div class="b">'
      +'<div style="display:flex;justify-content:space-between;padding:3px 0;"><span style="color:#7a6840;">Costo del trámite</span><strong style="color:#1a1008;">'+fmt(costoTramite)+'</strong></div>'
      +'<div style="display:flex;justify-content:space-between;padding:3px 0;"><span style="color:#7a6840;">Abonado</span><strong style="color:#1a7a3a;">'+fmt(abonadoCanon)+'</strong></div>'
      +'<div style="border-top:1px dashed #d4b870;margin:4px 0 3px;"></div>'
      +'<div style="display:flex;justify-content:space-between;padding:3px 0;"><span style="color:#a32d2d;font-weight:700;">Saldo</span><strong style="color:#a32d2d;font-size:13px;">'+fmt(saldoCanon)+'</strong></div>'
      + filaCompTotal
    +'</div></div>'
    + avisoDescuadre
    +'<div class="footer">LEX-MÉXICO · Despacho Jurídico · Santiago Juxtlahuaca, Oaxaca · Tel. 953 128 7511</div>'
    +'</body></html>';

  var w = window.open('','_blank','width=800,height=600');
  if (!w) { if(typeof toast==='function') toast('Permite ventanas emergentes para imprimir','err'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(function(){ w.print(); }, 500);
}

// ═══════════════════════════════════════════════════════
// EXPEDIENTE DIGITAL VEHICULAR
// ═══════════════════════════════════════════════════════
var _expDigState = { recibo: null, pendiente: null };

// Resuelve el pendiente de Placas vinculado a este folio SIEMPRE de forma
// fresca (por contenido: sección + folio), en vez de confiar en la
// referencia guardada en _expDigState.pendiente al abrir el modal. Esa
// referencia se volvía inválida (indexOf ya no lo encontraba, y por lo
// tanto "Adjuntar" no hacía nada) en cuanto D.pendientes se reemplazaba
// por una sincronización de fondo mientras el modal seguía abierto.
function _expDigPendienteActual() {
  var r = _expDigState.recibo;
  if (!r || typeof D === 'undefined' || !Array.isArray(D.pendientes)) return null;
  return D.pendientes.find(function(p){ return p.seccion === 'placas' && Number(p.reciboVinculadoFolio) === Number(r.folio); }) || null;
}

function _expDigRenderStatus() {
  var wrap = document.getElementById('exp-digital-status-wrap');
  if (!wrap) return;
  var r = _expDigState.recibo;
  var estatus = (r && r.expDigital) ? (r.expDigital.estatus || 'sin_vincular') : 'sin_vincular';
  // Respaldo para adjuntos ya subidos ANTES de que existiera el marcado
  // automático: si ya hay al menos un documento con driveFileId (la carpeta
  // ya existe de facto en Drive con contenido), se considera vinculado
  // aunque r.expDigital.estatus todavía no lo refleje — no debe pedir un
  // clic extra para algo que ya es cierto.
  if (estatus !== 'vinculado' && estatus !== 'enviado') {
    var _docsYa = _expDigDocsArray(false);
    if (_docsYa.some(function(d){ return d && d.driveFileId; })) estatus = 'vinculado';
  }
  var fecha = (r && r.expDigital) ? (r.expDigital.fecha || '') : '';
  var btnVer = document.getElementById('exp-digital-btn-ver');
  var btnEnv = document.getElementById('exp-digital-btn-enviar');
  if (estatus === 'vinculado' || estatus === 'enviado') {
    wrap.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;background:#d4f5e0;border:1px solid #2a9a50;color:#0a4020;border-radius:20px;padding:4px 14px;font-family:\'DM Mono\',monospace;font-size:0.72rem;font-weight:700;">✅ CARPETA VINCULADA EN DRIVE' + (fecha ? ' · ' + fecha : '') + '</span>';
    if (btnVer) btnVer.style.display = 'flex';
    // Una vez vinculado ya no hace falta repetir la acción: cualquier
    // archivo nuevo que se adjunte después cae en la MISMA carpeta ya
    // vinculada, así que el botón desaparece (no se convierte en "reenviar").
    if (btnEnv) btnEnv.style.display = 'none';
  } else {
    wrap.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;background:#fff3e0;border:1px solid #c8952a;color:#7a4010;border-radius:20px;padding:4px 14px;font-family:\'DM Mono\',monospace;font-size:0.72rem;font-weight:700;">⏳ CARPETA SIN VINCULAR EN DRIVE</span>';
    if (btnVer) btnVer.style.display = 'none';
    if (btnEnv) { btnEnv.style.display = 'flex'; btnEnv.textContent = '🔗 Vincular Carpeta en Drive'; }
  }
}

// Fuente única de documentos para este folio en el modal de Expediente
// Digital: si el pendiente de Placas sigue vivo, sus p.documentos (los
// mismos que se ven en esa tarjeta). Si el folio ya se liquidó y el
// pendiente se borró (ver sincronizarPendientesPlacas), el respaldo que
// quedó guardado en el propio recibo — así "Expediente Digital" sigue
// mostrando los adjuntos aunque el folio ya no aparezca en Pendientes.
// Con paraEscribir=true crea el arreglo si hace falta (para poder adjuntar).
function _expDigDocsArray(paraEscribir) {
  var pend = _expDigPendienteActual();
  if (pend) { if (paraEscribir && !pend.documentos) pend.documentos = []; return pend.documentos || []; }
  var r = _expDigState.recibo;
  if (r) { if (paraEscribir && !r.expDigitalDocumentosPlacas) r.expDigitalDocumentosPlacas = []; return r.expDigitalDocumentosPlacas || []; }
  return [];
}

// Renderiza "Archivos adjuntos" con la MISMA dinámica que la tarjeta de
// Pendientes de Placas: chips 📄 clicables que abren el mismo visualizador
// (_pVerDoc) — en vez de una lista aparte que había que volver a seleccionar.
function _expDigRenderArchivos() {
  var lista = document.getElementById('exp-digital-lista-archivos');
  if (!lista) return;
  var docs = _expDigDocsArray(false);
  if (!docs.length) {
    lista.innerHTML = '<span style="color:#aaa;font-style:italic;">Sin archivos adjuntados — usa "Adjuntar archivos" para agregar.</span>';
    return;
  }
  lista.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:5px;">' + docs.map(function(d, i){
    var nm = d.nombre || d || 'doc';
    var lbl = nm.length > 26 ? nm.substring(0,26) + '…' : nm;
    var st = _docEstilo(nm, d && d.tipo);
    return '<span style="font-size:11px;background:'+st.bg+';border:1px solid '+st.borde+';border-radius:4px;padding:3px 9px;color:'+st.texto+';cursor:pointer;display:inline-flex;align-items:center;gap:4px;" onclick="_expDigVerDoc(' + i + ')" title="' + escHTML(nm) + '">' + st.icono + ' ' + escHTML(lbl) + '</span>';
  }).join('') + '</div>';
}

// Abre el mismo visualizador de documentos (zoom, navegación ◀▶, descargar,
// eliminar) que se usa al hacer clic en un doc de la tarjeta de Pendientes
// de Placas — así se ve exactamente igual sin importar desde dónde se abra.
// El botón eliminar solo aparece cuando el doc vive en un pendiente vivo
// (_pVerDocRender lo oculta si pendienteIdx es undefined).
function _expDigVerDoc(i) {
  var docs = _expDigDocsArray(false);
  var d = docs[i];
  if (!d) return;
  var pend = _expDigPendienteActual();
  var pendIdx = pend ? D.pendientes.indexOf(pend) : undefined;
  _pVerDoc(d, pendIdx, i, docs);
}

// Botón "Adjuntar archivos" del modal: si el folio tiene pendiente de
// Placas vinculado, reutiliza EXACTAMENTE la misma función de subida que
// el botón "+ Adjuntar" de la tarjeta de Pendientes — el archivo queda en
// p.documentos y por lo tanto visible en ambos lados a la vez. Si ya no
// hay pendiente vinculado (folio liquidado, o nunca tuvo uno), sube igual
// a Drive/base64 pero lo guarda de forma permanente en el propio recibo.
function _expDigAdjuntarClick() {
  var pend = _expDigPendienteActual();
  if (pend) {
    var idx = D.pendientes.indexOf(pend);
    if (idx === -1) { if(typeof toast==='function') toast('No se encontró el pendiente de Placas vinculado a este folio','err'); return; }
    _placasAdjuntarDoc(idx);
    return;
  }
  _expDigAdjuntarSinPendiente();
}

// Misma mecánica de subida que _placasAdjuntarDoc (Drive con caché de
// carpetas + 1 reintento + respaldo base64, timeouts en cada llamada de
// red) pero guardando el resultado en recibo.expDigitalDocumentosPlacas en
// vez de en un pendiente — para folios ya liquidados (sin pendiente vivo)
// o que nunca tuvieron uno.
function _expDigAdjuntarSinPendiente() {
  var r = _expDigState.recibo;
  if (!r) return;
  if (window._expDigSubiendo) { toast('Ya se está subiendo un archivo, espera a que termine.','err'); return; }
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx'; inp.multiple = true;
  inp.onchange = async function(){
    if (!inp.files || !inp.files.length) return;
    window._expDigSubiendo = true;
    var btn = document.getElementById('exp-digital-btn-adjuntar');
    if (btn) { btn.textContent = '⏳ Subiendo…'; btn.style.opacity = '0.6'; btn.style.pointerEvents = 'none'; }
    var MAX_BYTES = 10 * 1024 * 1024;
    var TIPOS_VALIDOS = ['image/png','image/jpeg','image/jpg','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    var EXT_VALIDAS = ['.pdf','.jpg','.jpeg','.png','.webp','.doc','.docx'];
    function extValida(nombre){ var n=(nombre||'').toLowerCase(); return EXT_VALIDAS.some(function(e){return n.endsWith(e);}); }
    var todos = Array.from(inp.files);
    var archivos = [], rechazadosInicio = [];
    todos.forEach(function(file){
      if (file.size > MAX_BYTES) { rechazadosInicio.push(file.name + ' (>10MB)'); return; }
      if (!TIPOS_VALIDOS.includes(file.type) && !extValida(file.name)) { rechazadosInicio.push(file.name + ' (tipo no válido)'); return; }
      archivos.push(file);
    });
    if (!archivos.length) {
      toast('Ningún archivo válido: ' + rechazadosInicio.join(', '), 'err');
      window._expDigSubiendo = false;
      if (btn) { btn.textContent = '📎 Adjuntar archivos (PDF, imagen)'; btn.style.opacity = ''; btn.style.pointerEvents = ''; }
      return;
    }
    toast('Subiendo ' + archivos.length + ' archivo(s)...', 'ok');
    try {
      var token = '', carpetaCliente = '';
      var nombreCliente = (r.nombre || 'cliente').replace(/[^a-zA-Z0-9_\- ]/g,'_').substring(0,50);
      var cacheKey = 'Placas/' + nombreCliente;
      try {
        token = typeof driveGetAccessToken === 'function' ? await _sbConTimeout(driveGetAccessToken(), 10000, 'Drive token') : '';
        if (token) {
          if (window._driveFolderCache[cacheKey]) {
            carpetaCliente = window._driveFolderCache[cacheKey];
          } else {
            var DRIVE_ROOT = '1TtVVL0Jbw6BFkwLw8Wo1LZfxLN0I_ndU';
            var carpetaPlacas = window._driveFolderCache['Placas'] || await _sbConTimeout(driveObtenerOCrearCarpeta(token,'Placas',DRIVE_ROOT), 10000, 'Drive carpeta Placas');
            window._driveFolderCache['Placas'] = carpetaPlacas;
            carpetaCliente = await _sbConTimeout(driveObtenerOCrearCarpeta(token, nombreCliente, carpetaPlacas), 10000, 'Drive carpeta cliente');
            window._driveFolderCache[cacheKey] = carpetaCliente;
          }
        }
      } catch(e) { console.warn('[ExpDig adjuntar] preparación de carpeta Drive falló, respaldo base64:', e); token=''; carpetaCliente=''; }
      // Revisión de duplicados ANTES de subir (misma lógica que el adjuntar de
      // Placas): el nombre real se conserva, así que un archivo repetido se
      // detecta y se pregunta qué hacer en vez de guardar dos copias mudas.
      var plan = [], cancelados = [];
      for (var _i = 0; _i < archivos.length; _i++) {
        var _f = archivos[_i];
        var _nom = _placasNombreLimpio(_f.name);
        var _dec = { file:_f, nombre:_nom, reemplazarId:null };
        if (token && carpetaCliente) {
          var _ex = await _placasBuscarEnDrive(_nom, token, carpetaCliente);
          if (_ex) {
            var _op = await _placasPreguntarDuplicado(_nom, nombreCliente);
            if (_op === 'cancelar') { cancelados.push(_nom); continue; }
            if (_op === 'reemplazar') _dec.reemplazarId = _ex.id;
            else _dec.nombre = await _placasNombreCopiaLibre(_nom, token, carpetaCliente);
          }
        }
        plan.push(_dec);
      }
      if (!plan.length) {
        toast(cancelados.length ? 'No se subió nada — cancelaste ' + cancelados.length + ' archivo(s) duplicado(s)' : 'No hay archivos que subir', 'ok');
        return;
      }
      var resultados = await Promise.all(plan.map(async function(d){
        var file = d.file;
        if (token && carpetaCliente) {
          var res = await _placasSubirArchivoDrive(file, token, carpetaCliente, d.nombre, d.reemplazarId);
          if (res) return { file, ok:true, drive:true, driveFileId:res.id, nombreArchivo:res.nombreArchivo, reemplazo:!!d.reemplazarId };
        }
        try {
          var dataURL = await _placasLeerBase64(file);
          return { file, ok:true, drive:false, base64:dataURL, nombreArchivo:d.nombre };
        } catch(e) {
          console.error('[ExpDig adjuntar] fallo total al adjuntar ' + file.name + ':', e);
          return { file, ok:false };
        }
      }));
      var destino = _expDigDocsArray(true);
      var agregados = 0, drive = 0, base64 = 0, reemplazos = 0;
      resultados.forEach(function(res){
        if (!res.ok) return;
        if (res.drive) {
          if (res.reemplazo) {
            var _ya = destino.find(function(d){
              return d && (d.driveFileId === res.driveFileId || (d.drivePath||'').endsWith('/'+res.nombreArchivo));
            });
            if (_ya) {
              _ya.nombre = res.nombreArchivo; _ya.tipo = res.file.type;
              _ya.driveFileId = res.driveFileId;
              _ya.drivePath = 'Placas/'+nombreCliente+'/'+res.nombreArchivo;
              reemplazos++; agregados++; drive++;
              return;
            }
          }
          destino.push({ nombre:res.nombreArchivo, tipo:res.file.type, driveFileId:res.driveFileId, drivePath:'Placas/'+nombreCliente+'/'+res.nombreArchivo }); drive++;
        }
        else { destino.push({ nombre:res.nombreArchivo || res.file.name, tipo:res.file.type, base64:res.base64 }); base64++; }
        agregados++;
      });
      var fallidos = resultados.filter(function(res){ return !res.ok; }).map(function(res){ return res.file.name; });
      if (drive > 0) _marcarExpDigitalVinculado(r.folio, carpetaCliente);
      if (agregados > 0) {
        if (typeof save === 'function') save();
        if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced().catch(function(){});
      }
      var rechazados = rechazadosInicio.length + fallidos.length;
      var detalleFuente = drive && base64 ? ' (' + drive + ' Drive, ' + base64 + ' local)' : drive ? ' (Drive)' : base64 ? ' (local)' : '';
      var detalleDup = (reemplazos ? ', ' + reemplazos + ' reemplazado(s)' : '') + (cancelados.length ? ', ' + cancelados.length + ' omitido(s) por duplicado' : '');
      if (rechazados === 0) toast(agregados + ' archivo(s) adjuntado(s)' + detalleFuente + detalleDup + ' ✓', 'ok');
      else toast(agregados + ' adjuntado(s)' + detalleFuente + detalleDup + ', ' + rechazados + ' rechazado(s): ' + rechazadosInicio.concat(fallidos).join(', '), agregados > 0 ? 'ok' : 'err');
      _expDigRenderArchivos();
      _expDigRenderStatus();
    } finally {
      window._expDigSubiendo = false;
      if (btn) { btn.textContent = '📎 Adjuntar archivos (PDF, imagen)'; btn.style.opacity = ''; btn.style.pointerEvents = ''; }
    }
  };
  inp.click();
}

function abrirExpDigitalVehiculo(recibo) {
  if (!recibo) { if(typeof toast==='function') toast('Sin recibo en contexto','err'); return; }
  _expDigState.recibo = recibo;
  _expDigState.pendiente = (typeof D !== 'undefined' && Array.isArray(D.pendientes))
    ? D.pendientes.find(function(p){ return p.seccion==='placas' && Number(p.reciboVinculadoFolio)===Number(recibo.folio); }) || null
    : null;
  var infoEl = document.getElementById('exp-digital-info-veh');
  if (infoEl) {
    var partes = [];
    if (recibo.nombre) partes.push('👤 ' + recibo.nombre);
    if (recibo.clase) partes.push('🚗 ' + recibo.clase);
    if (recibo.marca) partes.push(recibo.marca);
    if (recibo.placa) partes.push('Placa: ' + recibo.placa);
    var folStr = (typeof folioConLetra==='function')
      ? folioConLetra(recibo.folio, recibo.anio_folio||new Date().getFullYear(), recibo.letra||'A')
      : (recibo.folio + (recibo.letra||'A'));
    partes.push('Folio #' + folStr);
    infoEl.textContent = partes.join('  ·  ');
  }
  _expDigRenderStatus();
  _expDigRenderArchivos();
  var prog = document.getElementById('exp-digital-progress');
  if (prog) { prog.style.display = 'none'; prog.textContent = ''; prog.style.color = '#4a6ea8'; }
  document.getElementById('modal-exp-digital-placas').style.display = 'flex';
  // Si ya hay carpeta vinculada en Drive pero no quedó ningún documento
  // registrado localmente (típicamente folios antiguos cuyo pendiente de
  // Placas se borró ANTES de que existiera el respaldo automático — los
  // archivos siguen intactos en Drive, solo se perdió la referencia local),
  // se lista el contenido real de esa carpeta y se reconstruye la lista de
  // chips a partir de ahí. Es de solo lectura hacia Drive (list), no sube
  // ni borra nada.
  _expDigIntentarReconstruirDesdeDrive();
}

// Lista los archivos que ya existen dentro de una carpeta de Drive
// (usado para reconstruir el registro local cuando se perdió).
async function _expDigListarCarpetaDrive(folderId, token) {
  var q = encodeURIComponent("'" + folderId + "' in parents and trashed = false");
  var fields = encodeURIComponent('files(id,name,mimeType)');
  var r = await fetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=' + fields + '&pageSize=200', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!r.ok) throw new Error('No se pudo listar la carpeta de Drive (' + r.status + ')');
  var data = await r.json();
  return data.files || [];
}

async function _expDigIntentarReconstruirDesdeDrive() {
  var r = _expDigState.recibo;
  if (!r) return;
  if (_expDigDocsArray(false).length) return; // ya hay algo registrado, no hace falta
  var folderId = r.expDigital && r.expDigital.driveFolderId;
  if (!folderId) return;
  var prog = document.getElementById('exp-digital-progress');
  try {
    var token = await driveGetAccessToken();
    if (!token) return;
    if (prog) { prog.style.display = 'block'; prog.style.color = '#4a6ea8'; prog.textContent = 'Buscando archivos ya guardados en Drive...'; }
    var archivos = await _sbConTimeout(_expDigListarCarpetaDrive(folderId, token), 15000, 'Listar carpeta Drive');
    if (!archivos.length) { if (prog) { prog.style.display = 'none'; prog.textContent = ''; } return; }
    var destino = _expDigDocsArray(true);
    archivos.forEach(function(f){ destino.push({ nombre: f.name, tipo: f.mimeType, driveFileId: f.id }); });
    if (typeof save === 'function') save();
    if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced();
    _expDigRenderArchivos();
    if (prog) { prog.style.display = 'none'; prog.textContent = ''; }
    if (typeof toast === 'function') toast('📂 Se encontraron ' + archivos.length + ' archivo(s) ya guardados en Drive', 'ok');
  } catch(e) {
    console.warn('[ExpDig] no se pudo reconstruir desde Drive:', e);
    if (prog) { prog.style.display = 'none'; prog.textContent = ''; }
  }
}

function cerrarExpDigital() {
  var modal = document.getElementById('modal-exp-digital-placas');
  if (modal) modal.style.display = 'none';
  // La Ficha del Folio se cerró explícitamente antes de abrir este modal
  // (ver botón "Exp. Digital" en la ficha) — hay que reabrirla al cerrar,
  // igual que ya hace cerrarContabPDF, o el usuario se queda sin la ficha.
  if (window._fichaAbiertaAntes) {
    window._fichaAbiertaAntes = false;
    setTimeout(function(){ if (reciboEnConsulta) abrirFichaFolio(); }, 400);
  }
}

// "Vincular Carpeta en Drive": ya no arma un PDF combinado — el expediente
// digital de un folio vehicular liquidado es, simplemente, la MISMA carpeta
// de Drive donde ya viven sus documentos individuales (la que usan
// _placasAdjuntarDoc/_expDigAdjuntarSinPendiente: "Placas/<cliente>"). Este
// botón solo resuelve/crea esa carpeta, la abre en Drive para confirmarla y
// guarda el vínculo en el recibo — como cualquier archivo que se adjunte
// DESPUÉS (ej. tarjeta de circulación, foto de placas) cae en esa misma
// carpeta, el vínculo sigue siendo válido sin tener que repetir esta acción.
async function _expDigVincularCarpeta() {
  var r = _expDigState.recibo;
  if (!r) return;
  var btn = document.getElementById('exp-digital-btn-enviar');
  var prog = document.getElementById('exp-digital-progress');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Vinculando...'; }
  if (prog) { prog.style.display = 'block'; prog.style.color = '#4a6ea8'; prog.textContent = 'Conectando con Google Drive...'; }
  try {
    var token = await driveGetAccessToken();
    if (!token) throw new Error('Sin acceso a Google Drive. Autoriza en el Panel Admin.');
    if (prog) prog.textContent = 'Preparando carpeta en Drive...';
    var nombreCliente = (r.nombre || 'cliente').replace(/[^a-zA-Z0-9_\- ]/g,'_').substring(0,50);
    var cacheKey = 'Placas/' + nombreCliente;
    var carpetaCliente = window._driveFolderCache[cacheKey];
    if (!carpetaCliente) {
      var DRIVE_ROOT = '1TtVVL0Jbw6BFkwLw8Wo1LZfxLN0I_ndU';
      var carpetaPlacas = window._driveFolderCache['Placas'] || await _sbConTimeout(driveObtenerOCrearCarpeta(token,'Placas',DRIVE_ROOT), 10000, 'Drive carpeta Placas');
      window._driveFolderCache['Placas'] = carpetaPlacas;
      carpetaCliente = await _sbConTimeout(driveObtenerOCrearCarpeta(token, nombreCliente, carpetaPlacas), 10000, 'Drive carpeta cliente');
      window._driveFolderCache[cacheKey] = carpetaCliente;
    }
    if (!carpetaCliente) throw new Error('No se pudo crear/encontrar la carpeta en Drive');
    var fechaHoy = new Date().toLocaleDateString('es-MX',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).split('/').reverse().join('-');
    var urlCarpeta = 'https://drive.google.com/drive/folders/' + carpetaCliente;
    if (!r.expDigital) r.expDigital = {};
    r.expDigital.estatus = 'vinculado';
    r.expDigital.driveFolderId = carpetaCliente;
    r.expDigital.driveFolderUrl = urlCarpeta;
    r.expDigital.fecha = fechaHoy;
    var pend = _expDigPendienteActual();
    if (pend) {
      pend.estatusGestion = 'vinculado';
      pend.expDigitalDriveFolderId = carpetaCliente;
      pend.expDigitalFechaEnvio = fechaHoy;
    }
    if (typeof save === 'function') save();
    if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced();
    if (prog) { prog.style.color = '#2a7a4a'; prog.textContent = '✅ Carpeta vinculada en Drive'; }
    _expDigRenderStatus();
    if(typeof toast==='function') toast('✅ Carpeta vinculada en Drive','ok');
    window.open(urlCarpeta, '_blank');
  } catch(e) {
    console.error('[ExpDig]', e);
    if (prog) { prog.style.color = '#c03030'; prog.textContent = '✗ Error: ' + e.message; }
    if(typeof toast==='function') toast('Error: ' + e.message,'err');
  }
  if (btn) { btn.disabled = false; }
  _expDigRenderStatus();
}
// Alias por compatibilidad — el HTML del modal aún puede llamarlo por el
// nombre viejo antes de refrescarse el caché del navegador.
function _expDigEnviar() { return _expDigVincularCarpeta(); }

// "Ver en Drive": si ya se guardó el link de la carpeta, lo abre directo.
// Si el estatus se detectó como "vinculado" solo por evidencia (documentos
// con driveFileId de ANTES de que existiera el marcado automático, ver
// _expDigRenderStatus), todavía no tenemos el folderUrl guardado — se
// resuelve aquí mismo (sin crear nada nuevo, la carpeta ya existe) y se
// guarda para no tener que repetir la búsqueda la próxima vez.
async function _expDigVerExpediente() {
  var r = _expDigState.recibo;
  if (!r) return;
  if (r.expDigital && r.expDigital.driveFolderUrl) {
    window.open(r.expDigital.driveFolderUrl, '_blank');
    return;
  }
  var docs = _expDigDocsArray(false);
  if (!docs.some(function(d){ return d && d.driveFileId; })) {
    if(typeof toast==='function') toast('Sin carpeta vinculada en Drive','err');
    return;
  }
  try {
    var token = await driveGetAccessToken();
    if (!token) throw new Error('Sin acceso a Google Drive. Autoriza en el Panel Admin.');
    var nombreCliente = (r.nombre || 'cliente').replace(/[^a-zA-Z0-9_\- ]/g,'_').substring(0,50);
    var cacheKey = 'Placas/' + nombreCliente;
    var carpetaCliente = window._driveFolderCache[cacheKey];
    if (!carpetaCliente) {
      var DRIVE_ROOT = '1TtVVL0Jbw6BFkwLw8Wo1LZfxLN0I_ndU';
      var carpetaPlacas = window._driveFolderCache['Placas'] || await _sbConTimeout(driveObtenerOCrearCarpeta(token,'Placas',DRIVE_ROOT), 10000, 'Drive carpeta Placas');
      window._driveFolderCache['Placas'] = carpetaPlacas;
      carpetaCliente = await _sbConTimeout(driveObtenerOCrearCarpeta(token, nombreCliente, carpetaPlacas), 10000, 'Drive carpeta cliente');
      window._driveFolderCache[cacheKey] = carpetaCliente;
    }
    if (!carpetaCliente) throw new Error('No se encontró la carpeta en Drive');
    _marcarExpDigitalVinculado(r.folio, carpetaCliente);
    if (typeof save === 'function') save();
    if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced();
    _expDigRenderStatus();
    window.open('https://drive.google.com/drive/folders/' + carpetaCliente, '_blank');
  } catch(e) {
    console.error('[ExpDig]', e);
    if(typeof toast==='function') toast('Error: ' + e.message,'err');
  }
}
// ═══════════════════════════════════════════════════════
// FIN EXPEDIENTE DIGITAL VEHICULAR
// ═══════════════════════════════════════════════════════

// ── Mostrar una versión específica (letra) del folio EN EL MISMO visor de la
// Ficha del Folio, sin cerrarla ni abrir una ventana/overlay aparte. Se usa al
// hacer clic en el número de un recibo dentro de la tabla (ej. "1A", "1B").
// window._fichaPdfDefaultSrc guarda la última versión (la que activarModoConsulta
// cargó al abrir el folio); cerrarFichaFolio() restaura esa versión por defecto.
async function _fichaVisorMostrarVersion(folio, letra){
  var iframe = document.getElementById('pdf-consulta-iframe');
  var overlay = document.getElementById('contab-pdf-overlay');
  if(!iframe || typeof abrirPreviaDesdeContab !== 'function') return;
  window._fichaVisorToken = (window._fichaVisorToken||0)+1;
  var myToken = window._fichaVisorToken;
  // Reutilizar la búsqueda/descarga de PDF YA PROBADA de abrirPreviaDesdeContab
  // (sesión → R2 → Supabase Storage → versiones_recibo, con todos sus
  // respaldos) en vez de reimplementarla — así no depende de otro camino que
  // pueda fallar en silencio. Se oculta visualmente su overlay mientras carga
  // y, al terminar, se copia el resultado al visor de la Ficha del Folio.
  var _prevOpacity = overlay ? overlay.style.opacity : '';
  var _prevPE = overlay ? overlay.style.pointerEvents : '';
  if(overlay){ overlay.style.opacity='0'; overlay.style.pointerEvents='none'; }
  try{
    await abrirPreviaDesdeContab(folio, letra);
  }catch(e){
    console.warn('[_fichaVisorMostrarVersion]', e);
  }
  if(overlay){
    overlay.style.display = 'none';
    overlay.style.opacity = _prevOpacity;
    overlay.style.pointerEvents = _prevPE;
  }
  if(myToken !== window._fichaVisorToken) return; // se abrió otra versión mientras tanto
  var embed = document.getElementById('cpdf-embed');
  var _src = embed ? embed.getAttribute('src') : '';
  if(_src){
    if(window._fichaPdfTempBlobUrl){ try{ URL.revokeObjectURL(window._fichaPdfTempBlobUrl); }catch(e){} }
    window._fichaPdfTempBlobUrl = _src.indexOf('blob:')===0 ? _src.split('#')[0] : null;
    iframe.src = _src.split('#')[0] + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH';
  } else if(typeof toast==='function'){
    toast('No se encontró el PDF de esta versión','err');
  }
}
function cerrarFichaFolio(){
  window._fichaAbrirToken = (window._fichaAbrirToken||0)+1; // invalida cargas en vuelo
  document.getElementById('modal-ficha-folio').style.display='none';
  document.body.style.overflow='';
  // Restaurar el visor de PDF a la última versión generada (comportamiento por
  // defecto) por si se dejó "apuntando" a una versión específica (1A, 1B...)
  // que se haya clickeado dentro de la tabla de recibos oficiales.
  window._fichaVisorToken = (window._fichaVisorToken||0)+1; // invalida cargas de versión en vuelo
  var _iframeFicha = document.getElementById('pdf-consulta-iframe');
  if(_iframeFicha && window._fichaPdfDefaultSrc && _iframeFicha.src !== window._fichaPdfDefaultSrc){
    if(window._fichaPdfTempBlobUrl){ try{ URL.revokeObjectURL(window._fichaPdfTempBlobUrl); }catch(e){} window._fichaPdfTempBlobUrl=null; }
    _iframeFicha.src = window._fichaPdfDefaultSrc;
  }
}

// ── Notificar a la UI abierta que un folio fue eliminado (local o por otro
// empleado vía realtime) ─────────────────────────────────────────────────
// El borrado en sí (tombstone + broadcast + limpieza de appData.recibos) ya
// existía en varios flujos, pero ninguno tocaba la Ficha del Folio ni el
// buscador de folios (chips) si estaban abiertos mostrando justo ese folio —
// por eso seguía "apareciendo" hasta refrescar manualmente. Esta función
// cierra/actualiza esas vistas puntuales; se llama después de eliminar,
// tanto en el cliente que borra como en los que reciben el broadcast.
window._notificarFolioEliminadoUI = function(folio, letra){
  try {
    var folioN = Number(folio);
    // 1. Ficha del Folio abierta con este folio → cerrar y avisar
    var modalFicha = document.getElementById('modal-ficha-folio');
    if (modalFicha && modalFicha.style.display !== 'none' && window._fichaReciboActual
        && Number(window._fichaReciboActual.folio) === folioN) {
      if (typeof cerrarFichaFolio === 'function') cerrarFichaFolio();
      if (typeof toast === 'function') toast('⚠️ El folio #' + (typeof folioFormato==='function'?folioFormato(folioN):folioN) + ' fue eliminado', 'err');
    }
    // 2. Buscador de folios (chips + resumen) mostrando este folio → refrescar
    var inputFolioAnt = document.getElementById('folio_anterior');
    if (inputFolioAnt && parseInt(inputFolioAnt.value, 10) === folioN
        && typeof cargarHistorialFolio === 'function') {
      cargarHistorialFolio();
    }
  } catch(e) { console.warn('[_notificarFolioEliminadoUI]', e); }
};

function fichaToggleNotas(){
  var d=document.getElementById('fichaNotasDisplay'),i=document.getElementById('fichaNotasInput'),b=document.getElementById('fichaSaveNotas');
  i.value=d.dataset.texto||'';d.style.display='none';i.style.display='block';b.style.display='inline-block';i.focus();
}

function fichaGuardarNotas(){
  var d=document.getElementById('fichaNotasDisplay'),i=document.getElementById('fichaNotasInput'),b=document.getElementById('fichaSaveNotas');
  var t=i.value.trim();d.dataset.texto=t;
  d.textContent=t||'✎ Escribe aquí notas del expediente — volumen, instrumento, fecha de firma, ubicación, etc.';
  d.style.fontStyle=t?'normal':'italic';d.style.color=t?'#1a1008':'#7a6840';
  d.style.display='block';i.style.display='none';b.style.display='none';
  var ref = window._fichaRef;
  if(ref) {
    // Guardar en localStorage siempre (inmediato)
    localStorage.setItem(ref.notasKey, t);
    // Guardar en R2 en segundo plano
    if(window.subirR2 && window.SB_DESPACHO_ID) {
      var notaPath = window.SB_DESPACHO_ID+'/notas_folio/'+ref.anio+'/'+ref.folio+'.txt';
      var blob = new Blob([t], {type:'text/plain'});
      var file = new File([blob], ref.folio+'.txt', {type:'text/plain'});
      window.subirR2(file, notaPath, 'expedientes').catch(function(e){ console.warn('[NotaR2]',e); });
    }
  }
}


// ── FIN NOTAS ─────────────────────────────────────────────────────────────

function fichaImprimirHistorial(){
  var nombre=document.getElementById('ficha-cliente-nombre').textContent;
  var folio=document.getElementById('ficha-folio-ref').textContent;
  var concepto=document.getElementById('ficha-concepto').textContent;
  var notas=document.getElementById('fichaNotasDisplay').dataset.texto||'';
  var total=document.getElementById('ficha-total').textContent;
  var abonado=document.getElementById('ficha-abonado').textContent;
  var pendiente=document.getElementById('ficha-pendiente').textContent;
  var fecha=new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'});
  var recibosHTML='';
  document.getElementById('ficha-recibos-lista').querySelectorAll('div[style*=grid]').forEach(function(r){
    var celdas=r.querySelectorAll('div');
    recibosHTML+='<tr><td>'+(celdas[0]?celdas[0].textContent.trim():'')+'</td><td>'+(celdas[1]?celdas[1].textContent.trim():'')+'</td><td>'+(celdas[2]?celdas[2].textContent.trim():'')+'</td><td>'+(celdas[3]?celdas[3].textContent.trim():'')+'</td></tr>';
  });
  var win=window.open('','_blank','width=800,height=900');
  if(!win){if(typeof toast==='function')toast('El navegador bloqueó la ventana de impresión — permite ventanas emergentes e intenta de nuevo','err');return;}
  win.document.write('<!DOCTYPE html><html><head><meta charset=UTF-8><title>Historial '+folio+'</title>'
    +'<style>body{font-family:monospace;padding:32px;color:#1a1008;background:#fdfaf4;font-size:12px;}h1{font-size:16px;color:#c8952a;border-bottom:2px solid #c8952a;padding-bottom:8px;margin-bottom:16px;}.header{display:grid;grid-template-columns:1fr auto;gap:10px;background:#f5f0e0;padding:12px 16px;border-radius:6px;border:1px solid #d4b870;margin-bottom:16px;}.label{font-size:9px;color:#7a6840;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px;}.val{font-size:14px;font-weight:700;}.notas{background:#fffdf5;border:1px solid #e0d4a8;border-radius:4px;padding:10px;margin-bottom:16px;font-size:11px;line-height:1.6;}.sec{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#7a6840;margin-bottom:8px;}table{width:100%;border-collapse:collapse;margin-bottom:16px;}th{font-size:9px;font-weight:700;text-transform:uppercase;color:#7a6840;padding:6px 8px;border-bottom:1px solid #d4b870;text-align:left;background:#f5f0e0;}td{padding:6px 8px;border-bottom:1px solid #ecdfa8;font-size:11px;}.tots{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;background:#f5f0e0;border:1px solid #d4b870;border-radius:6px;padding:10px 14px;}.tl{font-size:9px;color:#7a6840;text-transform:uppercase;}.tv{font-size:13px;font-weight:700;}.foot{margin-top:24px;border-top:1px solid #d4b870;padding-top:12px;font-size:10px;color:#7a6840;text-align:center;}</style></head><body>'
    +'<h1>HISTORIAL DEL FOLIO - '+folio+'</h1>'
    +'<div class=header><div><div class=label>Cliente</div><div class=val>'+nombre+'</div><div style="font-size:11px;color:#7a6840;margin-top:4px;">'+concepto+'</div></div><div style=text-align:right><div class=label>Folio</div><div class=val style=color:#1a5fa8>'+folio+'</div><div style="font-size:11px;color:#7a6840;margin-top:4px;">'+fecha+'</div></div></div>'
    +(notas?'<div class=notas><strong>Notas:</strong><br>'+notas+'</div>':'')
    +'<div class=sec>Recibos Oficiales</div><table><thead><tr><th>Folio</th><th>Concepto / Tipo</th><th>Pago</th><th>Saldo</th></tr></thead><tbody>'+recibosHTML+'</tbody></table>'
    +'<div class=tots><div><div class=tl>Total</div><div class=tv>'+total+'</div></div><div><div class=tl>Abonado</div><div class=tv style=color:#1a7a3a>'+abonado+'</div></div><div><div class=tl>Pendiente</div><div class=tv style=color:#a32d2d>'+pendiente+'</div></div></div>'
    +'<div class=foot>LEX-MEXICO Despacho Juridico - Documento interno</div>'
    +'<scr'+'ipt>window.onload=function(){window.print();window.addEventListener(\'afterprint\',function(){window.close();});};<'+'/script></body></html>');
  win.document.close();
  win.addEventListener('beforeunload',function(){
    setTimeout(function(){if(reciboEnConsulta&&document.getElementById('modal-ficha-folio'))abrirFichaFolio();},400);
  });
}

// cerrarContabPDF - regresar a ficha si fue abierto desde ella
var _origCerrarContabPDF=window.cerrarContabPDF;
document.addEventListener('DOMContentLoaded',function(){
  if(typeof cerrarContabPDF==='function'){
    var orig=cerrarContabPDF;
    cerrarContabPDF=function(){
      orig.apply(this,arguments);
      if(window._fichaAbiertaAntes){
        window._fichaAbiertaAntes=false;
        setTimeout(function(){if(reciboEnConsulta)abrirFichaFolio();},400);
      }
    };
  }
});

// La Ficha del Folio ya NO es un modal flotante que se cierra al hacer clic
// afuera — es una sección fija e integrada de la página de resultados de
// búsqueda por folio (junto con el visor de PDF). Por eso este listener de
// "clic fuera cierra" fue retirado: cerrarFichaFolio() sigue existiendo para
// los flujos internos (Pago Total, Pago Parcial, Servicio Complementario,
// Vincular Archivo) que la ocultan momentáneamente antes de abrir otra
// pantalla, y para el botón ✕ manual — pero ya no se dispara por clics
// accidentales fuera de la tarjeta.


// ═══════════════════════════════════════════════════════════════
// CONTROL DE JUICIOS — MODAL PANTALLA COMPLETA
// ═══════════════════════════════════════════════════════════════

var _mexpIdx = -1; // índice del expediente abierto en el modal


// ── Abrir modal de expediente ──────────────────────────────────
function abrirDetalle(idx){
  jdetIdx = idx;
  _mexpIdx = idx;
  const j = D.juicios[idx];
  if(!j) return;

  // Ocultar lista, mostrar modal
  $('juicios-lista-view').style.display = 'none';
  const modal = $('modal-expediente');
  modal.style.display = 'flex';
  // FIX (caso real: al salir de un expediente hacia otra categoría del menú y
  // volver a entrar, el visor de acuerdo/PDF o el resumen IA se quedaban tal
  // cual los había dejado la última vez). ir() solo oculta modal-expediente
  // completo, pero el estado interno del visor de acuerdo (#acuerdo-visor-overlay
  // y su contenido #acuerdo-resumen-modal-div) nunca se reseteaba — así que la
  // siguiente vez que se abría CUALQUIER expediente, ese sub-visor reaparecía
  // encima en vez de la ficha normal. Se cierra aquí siempre, al abrir
  // cualquier expediente, para que arranque limpio como "recién entrado".
  if(typeof cerrarVisorAcuerdo === 'function') cerrarVisorAcuerdo();

  // Header
  $('mexp-titulo').textContent = j.cliente || '—';
  const tagL = {'urgente':'🔴 Urgente','proceso':'🟡 En Proceso','estable':'🟢 Estable','concluido':'⚫ Concluido','inicio':'🔵 Inicio'}[j.estatus] || j.estatus;
  $('mexp-sub').textContent = (j.tipo||'') + (j.expediente ? ' · Exp. ' + j.expediente : '') + ' · ' + tagL;

  // Stats — Acuerdos en Drive
  initAcuerdosDrive(j.id || idx);
  const histCount = (j.historial||[]).length;
  $('mexp-stat-hist').textContent = histCount || '0';
  // FIX (caso real: al fusionar "Próx. audiencia" dentro del aviso de término,
  // #mexp-stat-aud dejó de existir en el HTML estático — ahora lo crea
  // _juRenderAvisoTermino() la primera vez que corre. Este bloque intentaba
  // escribirle el texto ANTES de que esa función se llamara más abajo, sin
  // try/catch: $('mexp-stat-aud') regresaba null y la asignación de
  // .textContent tronaba, cancelando TODO el resto de abrirDetalle()
  // (pestañas, notas, documentos, etc. nunca se ejecutaban). Se llama aquí
  // primero para garantizar que el elemento ya exista.
  try{ _juRenderAvisoTermino(j, idx); }catch(e){ console.warn('[Juicios] aviso término:', e); }
  const aud = j.audiencia || proximaAudienciaDeTerminos(j);
  const _elStatAud = document.getElementById('mexp-stat-aud');
  if(_elStatAud){
    if(aud){
      const diff = Math.ceil((new Date(aud+'T12:00:00') - new Date()) / 86400000);
      _elStatAud.textContent = diff >= 0 ? diff + 'd' : 'Vencida';
    } else {
      _elStatAud.textContent = '—';
    }
  }

  // Leyes activas
  actualizarContadorLeyes();

  // Historial
  renderHistorialModal();

  // FIX (caso real: al abrir CUALQUIER expediente aparecía "Error de Groq..."
  // en Flujo del Procedimiento sin haber pedido generarlo). _flujoInicializarBtn()
  // es quien repinta #mexp-flujo-lista con el flujo guardado del expediente
  // (o el estado vacío si no tiene). Esa llamada solo existía en una versión
  // vieja/muerta de abrirDetalle — la real nunca la hacía, así que el panel se
  // quedaba con lo último que hubiera quedado ahí (de otro expediente o de un
  // intento fallido), sin importar cuál expediente abrieras después.
  try{ if (typeof _flujoInicializarBtn === 'function') _flujoInicializarBtn(); }catch(e){ console.warn('[Juicios] flujo procedimiento:', e); }

  // ── Ficha reorganizada (Propuesta C) ──────────────────────────────────
  window._mexpIdxActual = idx;
  try{ _juRenderDatosDuros(j, idx); }catch(e){ console.warn('[Juicios] datos duros:', e); }
  try{ _juRenderEtapas(j, idx); }catch(e){ console.warn('[Juicios] etapas:', e); }
  try{ _juRenderBarraIA(j, idx); _juDescartarSugerencia(); }catch(e){ console.warn('[Juicios] barra IA:', e); }
  try{ _juRenderPestanas(idx); }catch(e){ console.warn('[Juicios] pestañas:', e); }
  try{ _juRenderNotas(idx); }catch(e){ console.warn('[Juicios] notas:', e); }
  try{ _juRenderDocRel(idx); }catch(e){ console.warn('[Juicios] documentos relacionados:', e); }

  // Limpiar chat IA
  $('mexp-ia-chat').innerHTML = '';
  $('mexp-ia-resumen').textContent = 'Presiona «Analizar expediente con IA» para obtener el resumen.';
}

// ── Barra de etapas del expediente ────────────────────────────────────────
// Ubica el juicio de un vistazo y permite avanzarlo con un clic. Se inserta
// justo debajo del encabezado del visor; si el contenedor no existe todavía,
// se crea la primera vez. No sustituye ni depende de nada previo.
function _juRenderEtapas(j, idx){
  // ELIMINADA a pedido del usuario: esta barra duplicaba el Flujo del
  // Procedimiento (panel completo, con más detalle) que ya cumple esa
  // función. Se deja la función como no-op (en vez de borrar sus llamadas
  // dispersas) para no tocar cada punto que la invoca; si el contenedor
  // llegó a existir de una versión anterior, se retira del DOM.
  const cont = document.getElementById('mexp-etapas');
  if(cont) cont.remove();
}
function _juFijarEtapa(idx, i){
  const j = D.juicios[idx];
  if(!j) return;
  const etapas = _juEtapas(j);
  const nueva = etapas[i];
  if(!nueva) return;
  if(j.etapa === nueva) return;
  j.etapa = nueva;
  j.updatedAt = Date.now();
  if(typeof saveJuicios === 'function') saveJuicios();
  _juRenderEtapas(j, idx);
  if(typeof renderJuicios === 'function') renderJuicios();
  if(typeof toast === 'function') toast('Etapa: ' + nueva);
}
// Igual que _juFijarEtapa pero para expedientes que ya tienen Flujo del
// Procedimiento generado — marca/desmarca j.flujoEtapaActual (mismo campo
// que usa el panel "Flujo del Procedimiento", para que ambas vistas del
// mismo expediente siempre coincidan en qué paso está "EN CURSO").
function _juFijarEtapaFlujo(idx, i){
  const j = D.juicios[idx];
  if(!j || !Array.isArray(j.flujoProcedimiento)) return;
  const nueva = j.flujoProcedimiento[i];
  if(!nueva) return;
  j.flujoEtapaActual = (j.flujoEtapaActual === i) ? null : i;
  j.flujoEtapaActualRazon = ''; // marca manual: sin razón de IA
  j.updatedAt = Date.now();
  if(typeof saveJuicios === 'function') saveJuicios();
  try { if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced(); } catch(e){}
  _juRenderEtapas(j, idx);
  if(typeof renderJuicios === 'function') renderJuicios();
  // Si el panel "Flujo del Procedimiento" está abierto para este mismo
  // expediente, refrescarlo también para que no se desincronice.
  try {
    if (typeof _flujoRender === 'function' && window._mexpIdxActual === idx && Array.isArray(window._flujoEtapasActual) && window._flujoEtapasActual.length) {
      _flujoRender(window._flujoEtapasActual, window._flujoLeyActual);
    }
  } catch(e){}
  if(typeof toast === 'function') toast(j.flujoEtapaActual === null ? 'Marca de etapa actual retirada' : 'Etapa: ' + (nueva.etapa || ''));
}

// ══════════════════════════════════════════════════════════════════════════
// LECTURA DE ACUERDOS CON IA  ·  Mistral OCR  →  Groq  →  confirmación
// ──────────────────────────────────────────────────────────────────────────
// Mistral convierte el acuerdo escaneado en texto; Groq lee ese texto y saca
// tipo, fecha y plazo. NADA se guarda automáticamente: la IA solo rellena una
// tarjeta que la usuaria revisa, corrige si hace falta y confirma. Un término
// mal calculado tiene consecuencias legales, así que la responsabilidad de
// aceptarlo es siempre de una persona.
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// FICHA DEL EXPEDIENTE  ·  encabezado, aviso de término y pestañas
// ──────────────────────────────────────────────────────────────────────────
// Antes las tres columnas (Acuerdos, Flujo, Análisis IA) se mostraban a la vez
// y competían por la atención. Ahora se eligen con pestañas, y lo primero que
// se ve es lo que de verdad urge: el término abierto más próximo.
// ══════════════════════════════════════════════════════════════════════════

// Aviso de términos abiertos. A petición expresa (18/ago/2026) ya no vive
// como barra hasta el fondo del expediente — se muestra en la fila de STATS,
// ocupando el espacio que antes tenían las casillas "Acuerdos en Drive /
// Historial / Leyes activas" (ver #mexp-aviso-termino-slot en el HTML). La
// casilla "Próx. audiencia" se quitó por completo (era casi siempre el mismo
// dato que ya se ve aquí). A diferencia de antes, ya NO muestra solo el más
// urgente — muestra TODOS los términos abiertos que nos corresponde cumplir
// a nosotros (hay casos con varios términos simultáneos, uno por situación).
// Los términos de la contraparte o de una autoridad (t.responsable) se
// excluyen — ver _juTerminosPropiosAbiertos / _juEsResponsableNuestro.
function _juRenderAvisoTermino(j, idx){
  const modal = document.getElementById('modal-expediente');
  if(!modal || !j) return;
  const slot = document.getElementById('mexp-aviso-termino-slot');
  if(!slot) return;
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  const lista = _juTerminosPropiosAbiertos(j);
  if(!lista.length){
    slot.innerHTML = '<div style="flex:1;min-width:0;display:flex;align-items:center;padding:10px 18px;'
      + 'font-family:monospace;font-size:.68rem;color:var(--verde-d);background:var(--verde-l);">'
      + '✓ Sin términos abiertos en este expediente.</div>';
    return;
  }
  slot.innerHTML = lista.map(function(t){
    const e = _juEstadoTermino(t);
    const urge = (e.clave === 'vencido' || e.clave === 'hoy' || e.clave === 'porvencer');
    const tid = esc2(t.id);
    return '<div style="display:flex;align-items:center;gap:14px;padding:8px 18px;border-bottom:1px solid var(--border-l);'
      + (urge ? 'background:var(--rojo-l);border-left:4px solid var(--rojo);' : 'background:var(--surface2);border-left:4px solid var(--verde);')
      + '">'
      + '<div style="font-family:monospace;font-size:1.05rem;font-weight:700;color:'+e.color+';min-width:58px;text-align:center;line-height:1.1;">'
      +   (e.dias === null ? '—' : (e.dias < 0 ? e.dias : '+' + e.dias))
      +   '<div style="font-size:.48rem;letter-spacing:.11em;color:var(--muted);text-transform:uppercase;font-weight:400;">días</div></div>'
      + '<div style="flex:1;min-width:0;">'
      +   '<div style="font-weight:700;font-size:.82rem;color:var(--ink);">'+esc2(t.descripcion || t.tipo || 'Término')+'</div>'
      +   '<div style="font-family:monospace;font-size:.6rem;color:var(--muted);">Vence '+esc2(t.fecha)+' · '+esc2(e.texto)
      +     (t.fechaNotificacion && t.dias ? ' · notificado '+esc2(t.fechaNotificacion)+' + '+t.dias+(t.habiles===false?' naturales':' hábiles') : '')
      +   '</div>'
      + '</div>'
      + '<button onclick="_juCumplirTermino('+idx+',\''+tid+'\')" style="padding:5px 12px;border-radius:6px;border:1.5px solid var(--verde);'
      +   'background:var(--verde);color:#fff;font-family:monospace;font-size:.6rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;">✓ Cumplido</button>'
      + '</div>';
  }).join('');
}
// Marca UN término específico como cumplido (identificado por su id — antes
// esta función solo sabía cumplir "el más urgente"; ahora el aviso muestra
// varios términos a la vez, cada uno con su propio botón, así que necesita
// saber exactamente cuál).
function _juCumplirTermino(idx, terminoId){
  const j = D.juicios[idx]; if(!j) return;
  const lista = _juTerminosPropiosAbiertos(j);
  const t = lista.find(function(x){ return x.id === terminoId; });
  if(!t) return;
  if(!confirm('¿Marcar como cumplido?\n\n' + (t.descripcion || t.tipo) + '\nVence: ' + t.fecha)) return;
  const hoyISO = (typeof _hoyReal === 'function') ? _hoyReal() : new Date().toISOString().slice(0,10);
  if(t._virtual){
    // Venía del campo antiguo j.audiencia: se convierte en un término real ya
    // cumplido (así queda constancia) y se libera el campo viejo.
    if(!Array.isArray(j.terminos)) j.terminos = [];
    j.terminos.push({
      id: 'TR-' + Date.now(), tipo: t.tipo || 'Audiencia',
      descripcion: t.descripcion || 'Término', fecha: t.fecha, hora: '',
      nota: 'Registrado desde la fecha que estaba en el expediente',
      cumplido: true, fechaCumplimiento: hoyISO, responsable: 'nosotros'
    });
    j.audiencia = '';
  } else {
    // t viene de _juTerminosPropiosAbiertos, que ya es un filter() sobre
    // j.terminos — no es una copia profunda, así que mutar t SÍ mutar el
    // objeto real dentro de j.terminos.
    t.cumplido = true;
    t.fechaCumplimiento = hoyISO;
  }
  j.updatedAt = Date.now();
  if(typeof saveJuicios === 'function') saveJuicios();
  _juRenderAvisoTermino(j, idx);
  if(typeof renderJuicios === 'function') renderJuicios();
  if(typeof toast === 'function') toast('✓ Término cumplido');
}
// Alias por compatibilidad — nada más lo llama ya (se sustituyó por
// _juCumplirTermino con id específico), pero se conserva por si algún botón
// viejo en caché de un cliente todavía lo referencia.
function _juCumplirTerminoUrgente(idx){
  const j = D.juicios[idx]; if(!j) return;
  const t = _juTerminoUrgente(j); if(!t) return;
  _juCumplirTermino(idx, t.id);
}

// Datos duros del expediente en el encabezado (partes, juzgado, honorarios…).
// Rediseño "Propuesta 5" (18/ago/2026): Ingreso/Teléfono/Control interno se
// quedan como texto simple; Juzgado, Folios de recibo vinculados (ahora
// pueden ser varios y cada uno es clicleable a su Ficha del Folio, con un
// botón "+" para seguir vinculando) y Carpeta física pasan a tarjetas.
function _juRenderDatosDuros(j, idx){
  // Ancla en el contenedor estable #mexp-header-info (NO en mexp-sub.parentNode):
  // desde que título y subtítulo comparten línea (petición 18/ago/2026), su
  // padre inmediato es la fila flex título+subtítulo, no el bloque completo del
  // encabezado — si se ancla ahí, las tarjetas de abajo saldrían a un lado en
  // vez de en su propia línea.
  const cont = document.getElementById('mexp-header-info');
  if(!cont || !j) return;
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  const dato = (k, v) => v
    ? '<div><div style="font-family:monospace;font-size:.5rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);">'+k+'</div>'
      + '<div style="font-size:.74rem;color:var(--ink);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;">'+esc2(v)+'</div></div>'
    : '';
  let box = document.getElementById('mexp-datos-duros');
  if(!box){
    box = document.createElement('div');
    box.id = 'mexp-datos-duros';
    cont.appendChild(box);
  }
  box.style.cssText = 'display:flex;gap:20px;flex-wrap:wrap;margin-top:7px;';
  box.innerHTML = dato('Ingreso', j.fechaIngreso) + dato('Teléfono', j.tel) + dato('Control interno', j.controlInterno);

  // La fila de tarjetas ahora es HTML estático (fila propia junto con Leyes
  // del Juicio / Eliminar expedientes — petición 18/ago/2026), así que ya
  // siempre existe; el createElement de respaldo es solo por si algún día se
  // usa este código antes de que el HTML del modal esté insertado.
  let cards = document.getElementById('mexp-datos-cards');
  if(!cards){
    cards = document.createElement('div');
    cards.id = 'mexp-datos-cards';
    box.parentNode.insertBefore(cards, box.nextSibling);
  }
  const cardStyle = 'background:var(--surface2);border:1px solid var(--border-l);border-radius:8px;padding:8px 12px;flex:1;min-width:150px;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box;';
  const label = (t) => '<div style="font-family:monospace;font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">'+t+'</div>';

  // Folios de recibo — mismo lenguaje visual que el folio en Contabilidad y
  // en las tarjetas de Placas ("Trámite enviado"): número en AZUL y una
  // etiqueta de estado debajo (LIQUIDADO / PENDIENTE $monto / CANCELADO).
  const allRecibos = ((typeof appData !== 'undefined' ? appData.recibos : null) || REC.recibos || []);
  const folios = _juFoliosRecibo(j);
  const chipsHtml = folios.map(f => {
    const rec = allRecibos.find(r => r.folio === f);
    let badge;
    if (!rec) {
      badge = '<span style="font-size:.5rem;font-weight:700;padding:1px 6px;border-radius:8px;background:rgba(192,22,26,0.1);color:#c0161a;">NO ENCONTRADO</span>';
    } else if (rec.cancelado) {
      badge = '<span style="font-size:.5rem;font-weight:700;padding:1px 6px;border-radius:8px;background:rgba(192,22,26,0.1);color:#c0161a;">CANCELADO</span>';
    } else {
      const total = parseFloat(rec.total) || 0;
      const ant = parseFloat(rec.anticipo) || 0;
      const saldo = rec.saldoPendiente !== undefined ? parseFloat(rec.saldoPendiente) : Math.max(0, total - ant);
      badge = saldo > 0
        ? '<span style="font-size:.5rem;font-weight:700;padding:1px 6px;border-radius:8px;background:rgba(232,156,48,0.15);color:#9a6010;">PENDIENTE $'+fmt(saldo)+'</span>'
        : '<span style="font-size:.5rem;font-weight:700;padding:1px 6px;border-radius:8px;background:rgba(26,122,58,0.1);color:var(--verde-d);">LIQUIDADO</span>';
    }
    return '<div onclick="event.stopPropagation();abrirFichaDesdeContab('+f+')" title="Ver Ficha del Folio #'+folioFormato(f)+'" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;">'
      + '<span style="font-family:monospace;font-weight:700;font-size:.9rem;color:var(--azul);">#'+folioFormato(f)+'</span>'
      + badge
      + '</div>';
  }).join('');
  const addChip = '<span onclick="event.stopPropagation();abrirGestionReciboJuicio('+idx+')" title="Vincular otro folio" aria-label="Vincular otro folio" style="cursor:pointer;font-family:monospace;font-size:.75rem;color:var(--muted);border:1px dashed var(--border-l);width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">+</span>';

  const carpetaTxt = j.carpetaFisica ? esc2(j.carpetaFisica) : 'Sin carpeta física';

  cards.innerHTML =
      '<div style="'+cardStyle+'">'+label('Juzgado')+'<div style="font-size:.76rem;color:var(--ink);font-weight:600;">'+(esc2(j.juzgado)||'—')+'</div></div>'
    + '<div style="'+cardStyle+'">'+label('Folios de recibo')+'<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">'+(chipsHtml||'<span style="font-size:.72rem;color:var(--muted);">Sin folios</span>')+addChip+'</div></div>'
    + '<div onclick="_juEditarCarpetaFisica('+idx+')" style="'+cardStyle+'cursor:pointer;" title="Clic para vincular/editar la carpeta física">'+label('Carpeta física')+'<div style="font-size:.76rem;color:var(--ink);font-weight:600;">📁 '+carpetaTxt+'</div></div>';
}
// Modal ligero para capturar/editar el número o referencia de la carpeta
// física del expediente (independiente de la carpeta en Drive).
function _juEditarCarpetaFisica(idx){
  const j = D.juicios[idx]; if(!j) return;
  let modal = document.getElementById('modal-carpeta-fisica');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'modal-carpeta-fisica';
    modal.className = 'modal-ov';
    modal.innerHTML = `<div class="modal" style="max-width:380px;width:92vw;">
      <div class="modal-hdr">
        <h3 style="font-size:0.9rem;">📁 Carpeta física del expediente</h3>
        <button class="modal-x" onclick="cerrar('modal-carpeta-fisica')">✕</button>
      </div>
      <div class="modal-body" style="padding:18px;">
        <div class="field">
          <label style="font-size:0.72rem;color:var(--muted);font-family:monospace;letter-spacing:0.05em;">Número o referencia de la carpeta física</label>
          <input type="text" id="cf-carpeta-input" placeholder="Ej: CARP.- 14" style="width:100%;padding:8px 12px;border:1.5px solid var(--border-l);border-radius:5px;font-size:0.85rem;background:var(--surface);color:var(--ink);box-sizing:border-box;">
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
          <button class="btn btn-ghost" onclick="cerrar('modal-carpeta-fisica')">Cancelar</button>
          <button class="btn btn-primary" onclick="_juGuardarCarpetaFisica()">Guardar</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.dataset.idx = idx;
  modal.classList.add('show');
  const inp = document.getElementById('cf-carpeta-input');
  if(inp){ inp.value = j.carpetaFisica || ''; setTimeout(()=>{ inp.focus(); inp.select(); }, 100); }
}
function _juGuardarCarpetaFisica(){
  const modal = document.getElementById('modal-carpeta-fisica');
  const idx = modal ? parseInt(modal.dataset.idx) : -1;
  const j = D.juicios[idx]; if(!j) return;
  const val = (document.getElementById('cf-carpeta-input') || {}).value || '';
  j.carpetaFisica = val.trim() || null;
  saveJuicios();
  cerrar('modal-carpeta-fisica');
  try{ _juRenderDatosDuros(j, idx); }catch(e){ console.warn('[Juicios] carpeta física:', e); }
  toast(j.carpetaFisica ? '✓ Carpeta física vinculada' : '✓ Carpeta física quitada', 'ok');
}

// Pestañas que muestran una columna a la vez (o las tres).
function _juRenderPestanas(idx){
  const cuerpo = document.getElementById('mexp-cuerpo');
  if(!cuerpo) return;
  let barra = document.getElementById('mexp-pestanas');
  if(!barra){
    barra = document.createElement('div');
    barra.id = 'mexp-pestanas';
    cuerpo.parentNode.insertBefore(barra, cuerpo);
  }
  const activa = window._juTabActiva || 'todo';
  const defs = [
    ['todo','▦ Todo'], ['0','📁 Acuerdos'], ['1','⚖ Flujo del procedimiento'], ['2','✨ Análisis IA'], ['3','📝 Notas y Recordatorios'], ['4','📌 Documentos']
  ];
  barra.style.cssText = 'display:flex;gap:9px;padding:12px 20px;background:var(--surface2);'
    + 'border-bottom:1.5px solid var(--border-l);flex-shrink:0;flex-wrap:wrap;';
  barra.innerHTML = defs.map(([k, lbl]) => {
    const on = activa===k;
    return '<button type="button" onclick="_juTab(\''+k+'\')" '
      + (on ? '' : 'onmouseover="this.style.borderColor=\'var(--gold)\';this.style.color=\'var(--gold-d)\';" onmouseout="this.style.borderColor=\'var(--border-l)\';this.style.color=\'var(--ink)\';" ')
      + 'style="padding:8px 16px;font-family:monospace;font-size:.68rem;cursor:pointer;'
      + 'border-radius:20px;border:1.5px solid '+(on?'var(--gold-d)':'var(--border-l)')+';'
      + 'background:'+(on?'linear-gradient(135deg,var(--gold),var(--gold-d))':'var(--surface)')+';'
      + 'color:'+(on?'#fff':'var(--ink)')+';'
      + 'box-shadow:'+(on?'0 3px 8px rgba(140,101,24,0.35)':'0 1px 2px rgba(0,0,0,0.04)')+';'
      + 'transition:all .15s;letter-spacing:0.02em;'+(on?'font-weight:700;':'font-weight:600;')+'">'+lbl+'</button>';
  }).join('');
  _juAplicarTab();
}
function _juTab(k){
  window._juTabActiva = k;
  _juRenderPestanas(window._mexpIdxActual);
}
function _juAplicarTab(){
  const cuerpo = document.getElementById('mexp-cuerpo');
  if(!cuerpo) return;
  const cols = Array.from(cuerpo.children).filter(c => c.nodeType === 1);
  const activa = window._juTabActiva || 'todo';
  if(activa === 'todo'){
    cuerpo.style.gridTemplateColumns = 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)';
    // "Todo" solo muestra las 3 columnas originales (Acuerdos, Flujo, Análisis
    // IA) — Notas y Recordatorios (y futuras pestañas) solo se ven al elegir
    // su propia pestaña, para no romper el grid de 3 columnas.
    cols.forEach((c, i) => { c.style.display = (i < 3) ? 'flex' : 'none'; });
  } else {
    const n = parseInt(activa, 10);
    cuerpo.style.gridTemplateColumns = 'minmax(0,1fr)';
    cols.forEach((c, i) => { c.style.display = (i === n) ? 'flex' : 'none'; });
  }
}

// ── Notas y Recordatorios del expediente ───────────────────────────────────
// No crea un almacén de datos nuevo: reutiliza D.pendientes, filtrando los
// que ya están vinculados a este juicio (p.juicioVinculadoIdx). Así una nota
// creada aquí también aparece en Pendientes, y viceversa — un solo lugar de
// verdad, como pidió la usuaria.
function _juRenderNotas(idx){
  const cont = document.getElementById('mexp-notas-lista');
  if(!cont) return;
  const notas = (D.pendientes||[]).filter(p => typeof p.juicioVinculadoIdx === 'number' && p.juicioVinculadoIdx === idx);
  if(!notas.length){
    cont.innerHTML = '<div style="padding:24px 14px;text-align:center;color:var(--muted);font-size:0.76rem;">Sin notas ni recordatorios para este expediente todavía. Usa «＋ Nueva» para agregar uno.</div>';
    return;
  }
  notas.sort((a,b)=>{
    if(!!a.resuelto !== !!b.resuelto) return a.resuelto ? 1 : -1;
    const fa = a.fechaLimite || a.fechaCreacion || '';
    const fb = b.fechaLimite || b.fechaCreacion || '';
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });
  const colPri = { urgente:'#c0161a', normal:'#c8952a', baja:'#6a8a6a' };
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  cont.innerHTML = notas.map(p => {
    const realIdx = D.pendientes.indexOf(p);
    const col = colPri[p.prioridad] || '#c8952a';
    return '<div style="display:flex;align-items:flex-start;gap:8px;padding:9px 10px;border:1px solid var(--border-l);border-left:3px solid '+col+';border-radius:6px;margin-bottom:7px;background:var(--surface);opacity:'+(p.resuelto?'0.5':'1')+';">'
      +   '<div onclick="toggleP('+realIdx+')" title="'+(p.resuelto?'Reabrir':'Marcar resuelto')+'" style="width:16px;height:16px;border-radius:50%;border:2px solid '+(p.resuelto?'#1a7a3a':col)+';background:'+(p.resuelto?'#1a7a3a':'transparent')+';display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:#fff;font-size:.58rem;margin-top:2px;">'+(p.resuelto?'✓':'')+'</div>'
      +   '<div style="flex:1;min-width:0;">'
      +     '<div style="font-size:.78rem;color:var(--ink);line-height:1.4;'+(p.resuelto?'text-decoration:line-through;':'')+'">'+esc2(p.texto||p.juiDescripcion||'(sin texto)')+'</div>'
      +     '<div style="font-size:.6rem;color:var(--muted);margin-top:3px;">'+(p.fechaLimite ? '⏰ '+esc2(p.fechaLimite)+' · ' : '')+(p.creadoPor ? '📤 '+esc2(p.creadoPor) : '')+'</div>'
      +   '</div>'
      +   '<button onclick="abrirPendiente('+realIdx+')" title="Editar" style="flex-shrink:0;background:none;border:1px solid var(--border-l);border-radius:5px;padding:3px 7px;cursor:pointer;font-size:.66rem;color:var(--muted);">✏</button>'
      + '</div>';
  }).join('');
}
// Abre el modal de Pendientes ya listo en la sección "Juicios" y vinculado a
// este expediente — evita que quien lo use tenga que buscar el expediente a
// mano con el selector.
function _juNuevaNota(idx){
  const j = D.juicios && D.juicios[idx];
  if(!j){ if(typeof toast === 'function') toast('Abre un expediente primero','err'); return; }
  abrirPendiente(-1);
  const secEl = document.getElementById('pSec');
  if(secEl){ secEl.value = 'juicios'; if(typeof pSecCambio === 'function') pSecCambio(); }
  _pJuiState.juicioIdx = idx;
  const _set = (id, v) => { const e = document.getElementById(id); if(e) e.value = v || ''; };
  _set('pJuiCliente', j.cliente);
  _set('pJuiExpediente', j.expediente);
  const tipoEl = document.getElementById('pJuiTipo');
  if(tipoEl && j.tipo) tipoEl.value = j.tipo;
  if(typeof _pJuiActualizarVinculacionUI === 'function') _pJuiActualizarVinculacionUI();
}

// ── Documentos Relacionados del expediente ──────────────────────────────────
// Subcarpetas reales en Drive por categoría, dentro de la carpeta del juicio
// (mismo folder padre que "Acuerdos", que conserva su propio panel con
// lectura IA — aquí NO se repite esa categoría para no duplicar función).
const _DOC_REL_CATEGORIAS = ['Demandas','Promociones','Notificaciones','Pruebas','Sentencias'];

function _docRelNombreCarpetaJuicio(idx){
  const j = D.juicios && D.juicios[idx];
  const jId = (j && j.id) || ('idx_' + idx);
  const nombre = (j ? (j.nombre || j.cliente || 'Juicio') + ' - Exp.' + (j.expediente || j.num || jId) : 'Juicio-' + jId).replace(/[<>:"/\\|?*]/g,'_');
  return { jId, nombre };
}
function _docRelClave(jId, cat){ return 'lex_docsrel_' + jId + '_' + cat; }

function _juRenderDocRel(idx){
  const pills = document.getElementById('mexp-docrel-cats');
  if(!pills) return;
  const activa = window._docRelCatActiva || _DOC_REL_CATEGORIAS[0];
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  pills.innerHTML = _DOC_REL_CATEGORIAS.map(cat =>
    '<span onclick="_docRelCambiarCat('+idx+',\''+cat+'\')" style="padding:4px 10px;border-radius:14px;font-size:0.62rem;cursor:pointer;border:1px solid '+(activa===cat?'var(--gold)':'var(--border-l)')+';background:'+(activa===cat?'var(--gold-bg)':'transparent')+';color:'+(activa===cat?'var(--gold-d)':'var(--muted)')+';font-weight:'+(activa===cat?'700':'400')+';white-space:nowrap;">'+esc2(cat)+'</span>'
  ).join('');
  _docRelCargar(idx, activa);
}
function _docRelCambiarCat(idx, cat){
  window._docRelCatActiva = cat;
  _juRenderDocRel(idx);
}
// Cargar caché local de inmediato, luego refrescar desde Drive (solo lee —
// no crea carpetas, para no llenar Drive de subcarpetas vacías por navegar).
async function _docRelCargar(idx, cat){
  const { jId, nombre } = _docRelNombreCarpetaJuicio(idx);
  const lsKey = _docRelClave(jId, cat);
  let local = [];
  try { local = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch(e){}
  _docRelRender(cat, local);
  (async () => {
    try {
      const token = await driveGetAccessToken();
      if(!token) return;
      const DRIVE_JUICIOS_FOLDER_ID = '1TtVVL0Jbw6BFkwLw8Wo1LZfxLN0I_ndU';
      const carpetaJuicioId = await driveBuscarCarpetaId(token, nombre, DRIVE_JUICIOS_FOLDER_ID);
      if(!carpetaJuicioId) return;
      const carpetaCatId = await driveBuscarCarpetaId(token, cat, carpetaJuicioId);
      if(!carpetaCatId) return;
      const archivos = await driveListarArchivosCarpeta(token, carpetaCatId);
      const lista = archivos.map(f => ({ id: f.id, driveFileId: f.id, nombre: (f.name||'').replace(/\.pdf$/i,''), archivo: f.name||'', fechaSubida: (f.createdTime||'').slice(0,10) }));
      try { localStorage.setItem(lsKey, JSON.stringify(lista)); } catch(e){}
      _docRelRender(cat, lista);
    } catch(e){ console.warn('[Documentos] Error al listar', cat, e.message); }
  })();
  return local;
}
function _docRelRender(cat, lista){
  const cont = document.getElementById('mexp-docrel-lista');
  if(!cont) return;
  // Si mientras tanto cambió la categoría activa, no pisar la vista actual.
  if((window._docRelCatActiva || _DOC_REL_CATEGORIAS[0]) !== cat) return;
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  if(!lista.length){
    cont.innerHTML = '<div style="padding:20px 10px;text-align:center;color:var(--muted);font-size:0.72rem;line-height:1.6;">Sin documentos en «'+esc2(cat)+'».<br>Arrastra un PDF o usa <strong>＋ Subir</strong>.</div>';
    return;
  }
  const sorted = [...lista].sort((a,b) => String(b.fechaSubida||'').localeCompare(String(a.fechaSubida||'')));
  cont.innerHTML = sorted.map(f =>
    '<div style="border:1px solid var(--border-l);border-radius:7px;padding:8px 10px;margin-bottom:6px;display:flex;align-items:center;gap:8px;">'
    +   '<div style="flex:1;min-width:0;font-size:0.72rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc2(f.nombre||f.archivo)+'</div>'
    +   '<span style="font-size:0.6rem;color:var(--muted);flex-shrink:0;">'+esc2(f.fechaSubida||'')+'</span>'
    +   '<span onclick="verAcuerdoPDF(\''+f.driveFileId+'\',\''+encodeURIComponent(f.nombre||f.archivo)+'\')" title="Ver PDF" style="cursor:pointer;flex-shrink:0;font-size:1rem;">👁</span>'
    + '</div>'
  ).join('');
}
function _docRelInputChange(idx, input){
  if(!input.files || !input.files.length) return;
  _docRelSubirFiles(idx, input.files);
  input.value = '';
}
// Sube uno o varios PDFs a la subcarpeta de la categoría activa (creándola si
// hace falta, igual que la carpeta de Acuerdos ya existente).
async function _docRelSubirFiles(idx, files){
  if(!files || !files.length) return;
  const cat = window._docRelCatActiva || _DOC_REL_CATEGORIAS[0];
  const { jId, nombre } = _docRelNombreCarpetaJuicio(idx);
  const lsKey = _docRelClave(jId, cat);
  let lista = [];
  try { lista = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch(e){}
  const proc = document.getElementById('mexp-docrel-procesando');
  if(proc) proc.style.display = 'flex';
  for(const file of Array.from(files)){
    if(file.type !== 'application/pdf'){ if(typeof toast==='function') toast('⚠ Solo se aceptan PDFs','err'); continue; }
    try{
      const b64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const token = await driveGetAccessToken();
      if(!token) throw new Error('Sin token de Drive — reconecta en Panel Admin');
      const DRIVE_JUICIOS_FOLDER_ID = '1TtVVL0Jbw6BFkwLw8Wo1LZfxLN0I_ndU';
      const carpetaJuicioId = await driveObtenerOCrearCarpeta(token, nombre, DRIVE_JUICIOS_FOLDER_ID);
      const carpetaCatId = await driveObtenerOCrearCarpeta(token, cat, carpetaJuicioId);
      const metadata = { name: file.name, parents: [carpetaCatId], mimeType: 'application/pdf' };
      const boundary = 'boundary_lex_docrel';
      const bodyArr = [`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64}\r\n--${boundary}--`];
      const uploadResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime',{
        method:'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'multipart/related; boundary='+boundary }, body: bodyArr.join('')
      });
      if(!uploadResp.ok){ const errTxt = await uploadResp.text().catch(()=>''); throw new Error('Drive HTTP ' + uploadResp.status + ' — ' + errTxt.slice(0,80)); }
      const ud = await uploadResp.json();
      lista.push({ id: ud.id, driveFileId: ud.id, nombre: file.name.replace(/\.pdf$/i,''), archivo: file.name, fechaSubida: new Date().toISOString().slice(0,10) });
    } catch(e){
      console.error('[Documentos] Error subiendo', file.name, e);
      if(typeof toast==='function') toast('❌ Error subiendo ' + file.name + ': ' + e.message, 'err');
    }
  }
  try { localStorage.setItem(lsKey, JSON.stringify(lista)); } catch(e){}
  if(proc) proc.style.display = 'none';
  _docRelRender(cat, lista);
  if(typeof toast==='function') toast('✅ Documento(s) guardado(s) en Drive · ' + cat, 'ok');
}

// Barra con el botón de lectura + zona donde aparece la sugerencia.
// El botón "📷 Subir acuerdo y leerlo" se eliminó (18/ago/2026, a petición
// del usuario) — su función (leer con OCR y proponer un término) quedó
// fusionada dentro de "＋ Subir" en el panel "Acuerdos en Drive" (columna 1):
// ese botón ya sube el archivo, así que ahora también propone el término
// sobre el mismo texto OCR (ver subirAcuerdoDriveFiles, paso 6). Esta
// función solo deja listo el contenedor donde aparece la tarjeta morada de
// revisión cuando hay un plazo que confirmar.
function _juRenderBarraIA(j, idx){
  const modal = document.getElementById('modal-expediente');
  if(!modal || !j) return;
  let bar = document.getElementById('mexp-acuerdo-ia');
  if(!bar){
    bar = document.createElement('div');
    bar.id = 'mexp-acuerdo-ia';
    const etapas = document.getElementById('mexp-etapas');
    if(etapas && etapas.nextSibling) modal.insertBefore(bar, etapas.nextSibling);
    else if(etapas) modal.appendChild(bar);
    else modal.appendChild(bar);
  }
  bar.style.cssText = '';
  bar.innerHTML = '<div id="mexp-ia-sugerencia" style="display:none;padding:10px 20px;"></div>';
}

// Pide a Groq que interprete el texto del acuerdo. Devuelve objeto o null.
async function _juExtraerDatosAcuerdo(texto){
  if(typeof _iaLlamar !== 'function') throw new Error('El motor de IA no está disponible');
  // Si Cloudflare está configurado, usamos su modelo de CONTEXTO LARGO
  // (Mistral Small 3.1, 128K tokens) para leer el acuerdo casi completo en
  // vez de recortarlo a 6,000 caracteres — más preciso cuando la orden o el
  // plazo real aparece más adelante en el documento.
  const _usarCtxLargo = !!(typeof _cfaiGetAccountId === 'function' && _cfaiGetAccountId() && _cfaiGetToken());
  const recorte = String(texto || '').slice(0, _usarCtxLargo ? 60000 : 6000);
  const catalogo = _juCatalogoPlazos().map(p => p.nombre).join(' | ');
  const prompt =
    'Eres asistente de un despacho jurídico mexicano. Te doy el texto de un acuerdo o notificación judicial.\n' +
    'Responde ÚNICAMENTE con un JSON válido, sin markdown ni explicaciones, con esta forma exacta:\n' +
    '{\n' +
    '  "tipoAcuerdo": "descripción corta de qué ordena el acuerdo",\n' +
    '  "fechaAcuerdo": "AAAA-MM-DD o vacío si no aparece",\n' +
    '  "generaTermino": true o false,\n' +
    '  "actuacionRequerida": "qué tiene que hacer el abogado, en pocas palabras",\n' +
    '  "dias": número de días del plazo o 0 si no aplica,\n' +
    '  "habiles": true si son días hábiles, false si son naturales,\n' +
    '  "resumen": "resumen del acuerdo en una o dos frases",\n' +
    '  "confianza": "alta" | "media" | "baja"\n' +
    '}\n' +
    'Si el plazo corresponde a alguno de estos, usa ese nombre en actuacionRequerida: ' + catalogo + '.\n' +
    'Si no estás seguro de un dato, déjalo vacío o en 0 y pon confianza "baja". No inventes fechas.\n\n' +
    'TEXTO DEL ACUERDO:\n' + recorte;
  let resp;
  if (_usarCtxLargo) {
    try { resp = await _cfaiLlamarContextoLargo(prompt, 700, 0.1, 'plazos'); }
    catch(e) { console.warn('[Juicios IA] Contexto largo falló, usando Groq:', e.message); resp = await _iaLlamar(prompt, 700, 0.1, 'plazos'); }
  } else {
    resp = await _iaLlamar(prompt, 700, 0.1, 'plazos');
  }
  let limpio = String(resp || '').trim()
    .replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const i = limpio.indexOf('{'), f = limpio.lastIndexOf('}');
  if(i >= 0 && f > i) limpio = limpio.slice(i, f + 1);
  try{ return JSON.parse(limpio); }
  catch(e){ console.warn('[Juicios IA] respuesta no interpretable:', resp); return null; }
}

// _juLeerAcuerdo() se eliminó (18/ago/2026) — era el handler del botón
// "📷 Subir acuerdo y leerlo", ahora fusionado dentro de "＋ Subir"
// (subirAcuerdoDriveFiles, panel Acuerdos en Drive).

// Tarjeta morada: todo editable, nada se guarda hasta confirmar.
function _juPintarSugerencia(idx, d, nombreArchivo, driveFileId){
  const cont = document.getElementById('mexp-ia-sugerencia');
  if(!cont) return;
  const esc2 = (s) => (typeof escHTML === 'function' ? escHTML(s == null ? '' : String(s)) : String(s == null ? '' : s));
  const conf = (d.confianza || 'media').toLowerCase();
  const colConf = conf === 'alta' ? '#1a7a3a' : conf === 'baja' ? '#c0161a' : '#b07010';
  const genera = d.generaTermino !== false && (parseInt(d.dias,10) > 0);
  const campo = (lbl, id, val, tipo, extra) =>
      '<div style="display:flex;flex-direction:column;gap:3px;">'
    + '<label style="font-family:monospace;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);">'+lbl+'</label>'
    + '<input id="'+id+'" type="'+(tipo||'text')+'" value="'+esc2(val)+'" '+(extra||'')
    + ' style="border:1px solid #c9aef5;border-radius:6px;padding:6px 9px;font-size:.8rem;background:#fff;color:var(--ink);"></div>';

  const driveEstado = driveFileId
    ? '<span onclick="verAcuerdoPDF(\''+driveFileId+'\',\''+encodeURIComponent(nombreArchivo||'Acuerdo.pdf')+'\')" style="cursor:pointer;font-family:monospace;font-size:.58rem;background:#e0f5f7;color:#0a5a62;border:1px solid #9dd4da;border-radius:10px;padding:2px 8px;">☁ Guardado en Drive · 👁 ver</span>'
    : '<span style="font-family:monospace;font-size:.58rem;background:#fdeaea;color:#a01515;border:1px solid #f0c0c0;border-radius:10px;padding:2px 8px;">⚠ No se guardó en Drive</span>';

  cont.style.display = 'block';
  cont.innerHTML =
      '<div style="border:2px dashed #c9aef5;background:#f1e9ff;border-radius:11px;padding:14px 16px;">'
    +   '<div style="display:flex;align-items:center;gap:8px;margin-bottom:11px;flex-wrap:wrap;">'
    +     '<span style="font-size:1.1rem;">✨</span>'
    +     '<b style="color:#5b21b6;font-size:.88rem;">Esto entendí del documento — revísalo antes de guardar</b>'
    +     '<span style="margin-left:auto;font-family:monospace;font-size:.58rem;color:'+colConf+';">seguridad '+esc2(conf)+'</span>'
    +   '</div>'
    +   '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">'
    +     '<span style="font-family:monospace;font-size:.62rem;color:var(--muted);">📄 '+esc2(nombreArchivo||'')+'</span>'
    +     driveEstado
    +   '</div>'
    +   '<div style="display:grid;grid-template-columns:2fr 1fr;gap:9px;margin-bottom:9px;">'
    +     campo('Qué ordena el acuerdo','juSugTipo', d.tipoAcuerdo || '')
    +     campo('Fecha del acuerdo','juSugFecha', d.fechaAcuerdo || '', 'date')
    +   '</div>'
    +   '<div style="display:grid;grid-template-columns:2fr .7fr .9fr 1fr;gap:9px;align-items:end;">'
    +     campo('Actuación requerida','juSugAct', d.actuacionRequerida || '')
    +     campo('Días','juSugDias', (parseInt(d.dias,10)||''), 'number', 'min="0" max="365" oninput="_juSugRecalc()"')
    +     '<div style="display:flex;flex-direction:column;gap:3px;">'
    +       '<label style="font-family:monospace;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);">Tipo de día</label>'
    +       '<select id="juSugHab" onchange="_juSugRecalc()" style="border:1px solid #c9aef5;border-radius:6px;padding:6px 9px;font-size:.8rem;background:#fff;">'
    +         '<option value="1"'+(d.habiles===false?'':' selected')+'>Hábiles</option>'
    +         '<option value="0"'+(d.habiles===false?' selected':'')+'>Naturales</option>'
    +       '</select></div>'
    +     campo('Vence el','juSugVence', '', 'date')
    +   '</div>'
    +   '<div id="juSugCalc" style="margin-top:9px;font-family:monospace;font-size:.68rem;color:var(--muted);"></div>'
    +   (d.resumen ? '<div style="margin-top:10px;font-size:.79rem;color:#3a2a10;background:#fff;border:1px solid #e0d4f5;border-radius:7px;padding:9px 11px;">'+esc2(d.resumen)+'</div>' : '')
    +   '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">'
    +     '<button onclick="_juConfirmarSugerencia('+idx+')" style="padding:7px 14px;border-radius:6px;border:1.5px solid #2baa5a;background:#2baa5a;color:#fff;font-family:monospace;font-size:.66rem;font-weight:700;cursor:pointer;">✓ Confirmar y guardar</button>'
    +     '<button onclick="_juDescartarSugerencia()" style="padding:7px 14px;border-radius:6px;border:1.5px solid var(--border-l);background:transparent;color:var(--muted);font-family:monospace;font-size:.66rem;cursor:pointer;">Descartar</button>'
    +     (genera ? '' : '<span style="font-size:.68rem;color:var(--muted);align-self:center;">Sin plazo detectado: se guardará solo la actuación.</span>')
    +   '</div>'
    + '</div>';
  _juSugRecalc();
}
function _juSugRecalc(){
  const fEl = document.getElementById('juSugFecha');
  const dEl = document.getElementById('juSugDias');
  const hEl = document.getElementById('juSugHab');
  const vEl = document.getElementById('juSugVence');
  const out = document.getElementById('juSugCalc');
  if(!fEl || !dEl || !vEl || !out) return;
  const dias = parseInt(dEl.value, 10) || 0;
  if(!fEl.value || dias < 1){
    vEl.value = '';
    out.textContent = 'Sin plazo: se guardará solo como actuación en la línea de tiempo.';
    out.style.color = 'var(--muted)';
    return;
  }
  const hab = (hEl && hEl.value === '1');
  const venc = _juCalcVencimiento(fEl.value, dias, hab);
  vEl.value = venc;
  const est = _juEstadoTermino({ fecha: venc, cumplido:false });
  out.innerHTML = 'Vence el <b style="color:'+est.color+'">'+venc+'</b> · '+est.texto
    + (hab ? ' <span style="opacity:.7;">(sin contar sábados, domingos ni inhábiles)</span>' : ' <span style="opacity:.7;">(días naturales)</span>');
  out.style.color = 'var(--ink)';
}
function _juDescartarSugerencia(){
  window._juSugerencia = null;
  const c = document.getElementById('mexp-ia-sugerencia');
  if(c){ c.style.display = 'none'; c.innerHTML = ''; }
}
// Aquí sí se escribe: crea la actuación y, si hay plazo, el término.
function _juConfirmarSugerencia(idx){
  const j = D.juicios[idx];
  if(!j){ toast('Expediente no encontrado','err'); return; }
  const v = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
  const tipoAc = (v('juSugTipo') || '').trim();
  const fechaAc = v('juSugFecha');
  const actReq  = (v('juSugAct') || '').trim();
  const dias    = parseInt(v('juSugDias'), 10) || 0;
  const hab     = v('juSugHab') === '1';
  const vence   = v('juSugVence');
  if(!tipoAc && !actReq){ toast('Escribe al menos qué ordena el acuerdo','err'); return; }

  const sug = window._juSugerencia || {};
  // 1) Actuación en la línea de tiempo — se omite si soloTermino=true: la
  // subida desde "＋ Subir" (panel Acuerdos en Drive) ya creó su propia
  // entrada de historial (agregarEntradaHistorialDesdeAcuerdo); aquí solo
  // falta el término/plazo, para no duplicar la línea del historial.
  if(!sug.soloTermino){
    if(!Array.isArray(j.historial)) j.historial = [];
    j.historial.push({
      id: 'HJ-OCR-' + Date.now(),
      fecha: fechaAc || (typeof _hoyReal === 'function' ? _hoyReal() : new Date().toISOString().slice(0,10)),
      tipo: 'acuerdo',
      texto: tipoAc || actReq,
      detalle: (sug.datos && sug.datos.resumen) || '',
      origen: 'ocr',
      archivo: sug.archivo || '',
      driveFileId: sug.driveFileId || ''
    });
  }

  // 2) Término, solo si hay plazo y fecha de vencimiento
  let creoTermino = false;
  if(vence && dias > 0){
    if(!Array.isArray(j.terminos)) j.terminos = [];
    j.terminos.push({
      id: 'TR-' + Date.now(),
      tipo: 'Término',
      descripcion: actReq || tipoAc,
      fecha: vence,
      hora: '',
      nota: 'Capturado leyendo el acuerdo con OCR',
      cumplido: false,
      fechaNotificacion: fechaAc || '',
      dias: dias,
      habiles: hab,
      origen: 'ocr'
    });
    creoTermino = true;
  }

  j.updatedAt = Date.now();
  if(typeof saveJuicios === 'function') saveJuicios();
  _juDescartarSugerencia();
  if(typeof renderHistorialModal === 'function') try{ renderHistorialModal(); }catch(e){}
  if(typeof renderTerminos === 'function') try{ renderTerminos(); }catch(e){}
  if(typeof renderJuicios === 'function') renderJuicios();
  if(typeof toast === 'function'){
    toast(creoTermino ? '✓ Actuación y término guardados — vence ' + vence : '✓ Actuación guardada','ok');
  }
}

function cerrarModalExpediente(){
  $('modal-expediente').style.display = 'none';
  $('juicios-lista-view').style.display = '';
  $('mexp-hist-form').style.display = 'none';
  if(typeof cerrarVisorAcuerdo === 'function') cerrarVisorAcuerdo();
  _mexpIdx = -1;
  jdetIdx = -1;
}

// ── Confirmar cerrar/archivar expediente con eliminación de R2 ─
async function confirmarCerrarExpediente(){
  const j = D.juicios[_mexpIdx];
  if(!j) return;
  const nombre = j.cliente || 'este expediente';
  if(!confirm('¿Cerrar y archivar el expediente de ' + nombre + '?\n\nSe eliminarán los documentos de R2 vinculados y el expediente quedará como Concluido.\n\nEsta acción no se puede deshacer.')) return;
  // Eliminar docs de R2
  const docs = j.r2Docs || [];
  for(const doc of docs){
    try{
      const path = (window.SB_DESPACHO_ID||'despacho') + '/juicios/' + (_mexpIdx) + '/' + doc.nombre;
      if(typeof window.eliminarR2 === 'function') await window.eliminarR2(path, 'juicios');
    } catch(e){ console.warn('eliminarR2 juicio:', e); }
  }
  // Eliminar resúmenes de acuerdos de R2
  const jIdCerrar = j.id || _mexpIdx;
  const lsKeyCerrar = 'lex_acuerdos_' + jIdCerrar;
  try {
    const acuerdosCerrar = JSON.parse(localStorage.getItem(lsKeyCerrar) || '[]');
    acuerdosCerrar.forEach(ac => {
      if (ac.driveFileId && typeof _r2ResumenPath === 'function')
        window.borrarR2(_r2ResumenPath(ac.driveFileId), 'expedientes').catch(()=>{});
    });
    localStorage.removeItem(lsKeyCerrar);
  } catch(e) {}
  // Marcar como concluido
  D.juicios[_mexpIdx].estatus = 'concluido';
  D.juicios[_mexpIdx].r2Docs = [];
  try{ backupLocal('D', D); } catch(e){}
  saveJuicios();
  cerrarModalExpediente();
  renderJuicios();
  if(typeof toast==='function') toast('Expediente cerrado y documentos eliminados de R2', 'ok');
}

// ── Documentos R2 ──────────────────────────────────────────────
// cargarDocsR2 — reemplazada por initAcuerdosDrive; se mantiene vacía para compatibilidad
async function cargarDocsR2(idx){ /* obsoleta — ver initAcuerdosDrive */ return;
  const j = D.juicios[idx];
  const el = $('mexp-r2-lista');
  if(!el) return;
  const docs = j.r2Docs || [];
  $('mexp-stat-docs').textContent = docs.length || '0';
  if(!docs.length){
    el.innerHTML = '';
    return;
  }
  el.innerHTML = docs.map((doc, i) => `
    <div style="border:1px solid ${_docEstilo(doc.nombre, doc.tipo).borde};border-radius:var(--radius-sm);margin-bottom:6px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:${_docEstilo(doc.nombre, doc.tipo).bg};">
        <span style="font-size:0.95rem;">${_docEstilo(doc.nombre, doc.tipo).icono}</span>
        <span style="font-size:0.72rem;font-weight:700;color:${_docEstilo(doc.nombre, doc.tipo).texto};flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHTML(doc.nombre)}</span>
        <span style="font-size:0.6rem;padding:2px 7px;border-radius:20px;background:var(--azul-l);color:var(--azul);cursor:pointer;" onclick="verDocR2(${idx},${i})">Ver</span>
        <span style="font-size:0.6rem;padding:2px 7px;border-radius:20px;background:var(--gold-bg);color:var(--gold-d);cursor:pointer;" onclick="ocrDocR2(${idx},${i})">OCR</span>
        <span style="font-size:0.7rem;color:var(--muted);cursor:pointer;padding:2px 5px;" onclick="eliminarDocR2(${idx},${i})" title="Eliminar de R2">🗑</span>
      </div>
      <div style="padding:4px 10px;font-size:0.62rem;color:var(--muted);">📅 ${doc.fecha||'—'} · ${doc.size||'—'}</div>
    </div>`).join('');
}

async function subirDocR2(input){
  const file = input.files[0];
  if(!file || _mexpIdx < 0) return;
  const j = D.juicios[_mexpIdx];
  if(!j.r2Docs) j.r2Docs = [];
  if(typeof toast==='function') toast('Subiendo ' + file.name + ' a R2...', 'ok');
  try{
    const path = (window.SB_DESPACHO_ID||'despacho') + '/juicios/' + _mexpIdx + '/' + file.name;
    const ok = typeof window.subirR2==='function' ? await window.subirR2(file, path, 'juicios') : false;
    const kb = Math.round(file.size/1024);
    const fecha = new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'});
    j.r2Docs.push({ nombre: file.name, path: path, fecha: fecha, size: kb + ' KB' });
    try{ backupLocal('D', D); } catch(e){}
    saveJuicios();
    cargarDocsR2(_mexpIdx);
    if(typeof toast==='function') toast(ok ? '✓ ' + file.name + ' guardado en R2' : '⚠ Guardado local (R2 no disponible)', ok?'ok':'err');
  } catch(e){
    console.error('subirDocR2:', e);
    if(typeof toast==='function') toast('Error al subir: ' + e.message, 'err');
  }
  input.value = '';
}

async function verDocR2(idx, docIdx){
  const j = D.juicios[idx];
  const doc = j.r2Docs[docIdx];
  if(!doc) return;
  if(typeof toast==='function') toast('Descargando ' + doc.nombre + '...', 'ok');
  try{
    const blob = typeof window.descargarR2==='function' ? await window.descargarR2(doc.path, 'juicios') : null;
    if(!blob){ toast('No se pudo descargar el archivo', 'err'); return; }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch(e){ if(typeof toast==='function') toast('Error al descargar: ' + e.message, 'err'); }
}

async function eliminarDocR2(idx, docIdx){
  const j = D.juicios[idx];
  const doc = j.r2Docs[docIdx];
  if(!confirm('¿Eliminar ' + doc.nombre + ' de R2?')) return;
  try{
    if(typeof window.eliminarR2==='function') await window.eliminarR2(doc.path, 'juicios');
  } catch(e){ console.warn('eliminarR2:', e); }
  j.r2Docs.splice(docIdx, 1);
  try{ backupLocal('D', D); } catch(e){}
  saveJuicios();
  cargarDocsR2(idx);
  if(typeof toast==='function') toast('Documento eliminado', 'ok');
}

async function ocrDocR2(idx, docIdx){
  const j = D.juicios[idx];
  const doc = j.r2Docs[docIdx];
  if(!doc){ return; }
  if(typeof toast==='function') toast('Descargando para OCR...', 'ok');
  try{
    const blob = typeof window.descargarR2==='function' ? await window.descargarR2(doc.path, 'juicios') : null;
    if(!blob){ toast('No se pudo descargar para OCR', 'err'); return; }
    // Usar Mistral si disponible
    const mistralKey = localStorage.getItem('cfg-mistral-key') || localStorage.getItem('mistralApiKey');
    if(!mistralKey){ toast('Configura la API Key de Mistral en Configuración', 'err'); return; }
    if(typeof toast==='function') toast('Analizando con Mistral OCR...', 'ok');
    const b64 = await _blobToBase64(blob);
    const resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + mistralKey },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Extrae y transcribe todo el texto de este documento legal. Identifica: partes, tipo de acto, fechas, prestaciones o montos. Responde en español.' },
          { type: 'document_url', document_url: 'data:application/pdf;base64,' + b64 }
        ]}]
      })
    });
    const data = await resp.json();
    const texto = data.choices?.[0]?.message?.content || 'Sin resultado';
    // Agregar al chat IA
    _agregarMensajeIA('📄 OCR de ' + doc.nombre + ':\n\n' + texto, 'assistant');
  } catch(e){
    console.error('ocrDocR2:', e);
    if(typeof toast==='function') toast('Error OCR: ' + e.message, 'err');
  }
}

function _blobToBase64(blob){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=> res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// ── Historial ─────────────────────────────────────────────────
function renderHistorialModal(){
  const j = D.juicios[_mexpIdx];
  if(!j) return;
  if(!Array.isArray(j.historial)) j.historial = [];
  // Asegurar id en cada entrada (necesario para guardar fecha de notificación)
  j.historial.forEach(h => { if(!h.id) h.id = 'HJ-'+Date.now()+'-'+Math.random().toString(36).slice(2,7); });
  const el = $('mexp-historial-lista');
  const hist = j.historial.slice().sort((a,b)=> b.fecha.localeCompare(a.fecha));
  $('mexp-stat-hist').textContent = hist.length || '0';
  if(!hist.length){
    el.innerHTML = '<div style="color:var(--muted);font-size:0.72rem;text-align:center;padding:20px;">Sin entradas. Agrega la primera entrada cronológica.</div>';
    return;
  }
  const tagColor = { escrito:'var(--verde-l)', acuerdo:'var(--azul-l)', requerimiento:'var(--amarillo-l)', notificacion:'var(--gold-bg)', audiencia:'rgba(139,92,246,0.1)', apelacion:'rgba(255,140,0,0.1)', nota:'var(--surface2)' };
  const tagText  = { escrito:'var(--verde-d)', acuerdo:'var(--azul)', requerimiento:'var(--amarillo)', notificacion:'var(--gold-d)', audiencia:'#7c3aed', apelacion:'#d97706', nota:'var(--muted)' };
  const tagLabel = { escrito:'✍️ Escrito', acuerdo:'⚖️ Acuerdo', requerimiento:'📋 Req.', notificacion:'📬 Notif.', audiencia:'🏛️ Audiencia', apelacion:'📤 Apelación', nota:'📌 Nota' };
  el.innerHTML = hist.map((h,i)=>{
    const tieneDetalle = !!(h.detalle || h.driveFileId);
    const hId = (h.id||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const notifVal = (h.fechaNotificacion||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    return `
    <div style="display:flex;gap:10px;margin-bottom:14px;position:relative;">
      <div style="display:flex;flex-direction:column;align-items:center;gap:0;">
        <div style="width:9px;height:9px;border-radius:50%;background:${tagText[h.tipo]||'var(--muted)'};margin-top:4px;flex-shrink:0;"></div>
        ${i < hist.length-1 ? '<div style="width:1px;flex:1;background:var(--border-l);min-height:16px;margin:3px 0;"></div>' : ''}
      </div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;flex-wrap:wrap;">
          <div style="display:inline-block;font-size:0.6rem;padding:2px 8px;border-radius:20px;background:${tagColor[h.tipo]||'var(--surface2)'};color:${tagText[h.tipo]||'var(--muted)'};">${tagLabel[h.tipo]||h.tipo}</div>
          <input type="text" value="${notifVal}" placeholder="Fecha notif." title="Fecha de notificación"
            onclick="event.stopPropagation()"
            onchange="guardarFechaNotificacion('${hId}',this.value)"
            style="font-size:0.58rem;padding:1px 7px;border:1px solid var(--border-l);border-radius:20px;background:var(--surface2);color:var(--ink);font-family:'JetBrains Mono',monospace;width:100px;min-width:0;">
        </div>
        <div onclick="${tieneDetalle ? `abrirResumenDesdeHistorial('${hId}')` : ''}" style="font-size:0.75rem;color:var(--ink);line-height:1.5;${tieneDetalle?'cursor:pointer;text-decoration:underline dotted;text-decoration-color:var(--muted);':''}">${escHTML(h.texto)}</div>
        <div style="font-size:0.62rem;color:var(--muted);margin-top:2px;">${h.fecha||'—'}</div>
      </div>
    </div>`;
  }).join('');
}

function guardarFechaNotificacion(entradaId, valor){
  const j = D.juicios[_mexpIdx];
  if(!j || !j.historial) return;
  const entry = j.historial.find(h => h.id === entradaId);
  if(!entry) return;
  entry.fechaNotificacion = valor.trim();
  try{ backupLocal('D',D); } catch(e){}
  saveJuicios();
}

async function abrirResumenDesdeHistorial(entradaId){
  const j = D.juicios[_mexpIdx];
  if(!j || !j.historial) return;
  const h = j.historial.find(e => e.id === entradaId);
  if(!h) return;
  if(h.driveFileId){
    const jId = window._jdetId || 'idx_'+_mexpIdx;
    try {
      const lista = await cargarAcuerdosDrive(jId);
      const ac = lista.find(a => a.driveFileId === h.driveFileId);
      if(ac){ verResumenAcuerdo(ac); return; }
    } catch(e){}
    // No está en la lista del panel "Acuerdos" (viejo pipeline) — por ejemplo,
    // los subidos con "📷 Subir acuerdo y leerlo". El archivo igual existe en
    // Drive con ese ID, así que se abre el PDF directo en vez de mostrar nada.
    if(typeof verAcuerdoPDF === 'function'){
      verAcuerdoPDF(h.driveFileId, encodeURIComponent(h.archivo || h.texto || 'Acuerdo.pdf'));
      return;
    }
  }
  verResumenAcuerdo({ nombre: h.texto, resumen: h.detalle||'', fechaAcuerdo: h.fecha, tipo: h.tipo });
}

function abrirFormHistorial(){
  const f = $('mexp-hist-form');
  f.style.display = 'block';
  $('mexp-hf-fecha').value = new Date().toISOString().substring(0,10);
  $('mexp-hf-texto').value = '';
  $('mexp-hf-texto').focus();
}

function cerrarFormHistorial(){
  $('mexp-hist-form').style.display = 'none';
}

function guardarEntradaHistorial(){
  const j = D.juicios[_mexpIdx];
  if(!j) return;
  const fecha = $('mexp-hf-fecha').value;
  const tipo  = $('mexp-hf-tipo').value;
  const texto = $('mexp-hf-texto').value.trim();
  if(!texto){ if(typeof toast==='function') toast('Escribe el contenido de la entrada', 'err'); return; }
  if(!j.historial) j.historial = [];
  j.historial.push({ fecha, tipo, texto });
  try{ backupLocal('D', D); } catch(e){}
  saveJuicios();
  cerrarFormHistorial();
  renderHistorialModal();
  if(typeof toast==='function') toast('Entrada guardada ✓', 'ok');
}

// ── Leyes del caso ─────────────────────────────────────────────
// Las leyes del despacho se guardan en localStorage como array de objetos {nombre, path}
// Cada juicio guarda en j.leyesActivas = [nombre, nombre, ...]

function getLeyesDespacho(){
  // D.leyes es la fuente de verdad (sincronizado en Supabase); localStorage es caché local.
  if (typeof D !== 'undefined' && Array.isArray(D.leyes) && D.leyes.length) return D.leyes;
  return JSON.parse(localStorage.getItem('lex-leyes-despacho') || '[]');
}
function setLeyesDespacho(arr){
  localStorage.setItem('lex-leyes-despacho', JSON.stringify(arr));
  if (typeof D !== 'undefined') D.leyes = arr;
  // Sincronizar a Supabase para que todos los dispositivos reciban el catálogo actualizado
  if (typeof syncEstadoSupabaseDebounced === 'function')
    setTimeout(function(){ syncEstadoSupabaseDebounced(); }, 300);
}

function actualizarContadorLeyes(){
  const j = D.juicios[_mexpIdx];
  if(!j) return;
  const activas = (j.leyesActivas||[]).length;
  const el = $('mexp-ley-count');
  const el2 = $('mexp-stat-leyes');
  if(el) el.textContent = activas;
  if(el2) el2.textContent = activas;
}

function abrirModalLeyes(){
  const modal = $('modal-leyes-caso');
  modal.style.display = 'flex';
  renderListaLeyes();
  // Refrescar catálogo desde Drive en background para mantener todos los dispositivos al día
  _leyesListarDrive().then(function(driveLista) {
    if (!driveLista || !driveLista.length) return;
    const local = getLeyesDespacho();
    driveLista.forEach(function(d) {
      const m = local.find(function(l){ return l.driveFileId === d.driveFileId; });
      if (m) d.sha256 = m.sha256 || '';
    });
    setLeyesDespacho(driveLista);
    renderListaLeyes();
  }).catch(function(){});
}

function cerrarModalLeyes(){
  $('modal-leyes-caso').style.display = 'none';
  actualizarContadorLeyes();
}

function renderListaLeyes(){
  const j = D.juicios[_mexpIdx];
  const activas = j ? (j.leyesActivas||[]) : [];
  const leyes = getLeyesDespacho();
  const el = $('modal-leyes-lista');
  if(!leyes.length){
    el.innerHTML = '<div style="color:var(--muted);font-size:0.72rem;text-align:center;padding:20px;">Sin leyes en el despacho.<br>Sube tu primer código o ley.</div>';
    $('modal-leyes-count-txt').textContent = '0 leyes activas';
    return;
  }
  el.innerHTML = leyes.map(ley => {
    const on = activas.includes(ley.nombre);
    return `<div onclick="toggleLeyActiva('${escHTML(ley.nombre)}')" style="display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid ${on?'var(--azul)':'var(--border-l)'};border-radius:var(--radius-sm);margin-bottom:6px;cursor:pointer;background:${on?'var(--azul-l)':'var(--surface)'};transition:all 0.15s;">
      <span style="font-size:0.9rem;">📚</span>
      <span style="flex:1;font-size:0.75rem;color:${on?'var(--azul)':'var(--ink)'};">${escHTML(ley.nombre)}</span>
      <span style="font-size:0.62rem;color:var(--muted);">${ley.size||''}</span>
      <div style="width:16px;height:16px;border-radius:3px;border:1px solid ${on?'var(--azul)':'var(--border-l)'};background:${on?'var(--azul)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${on?'<span style="color:#fff;font-size:0.55rem;font-weight:700;">✓</span>':''}</div>
    </div>`;
  }).join('');
  const n = activas.length;
  $('modal-leyes-count-txt').textContent = n + ' ' + (n===1?'ley activa':'leyes activas');
}

function toggleLeyActiva(nombre){
  const j = D.juicios[_mexpIdx];
  if(!j) return;
  if(!j.leyesActivas) j.leyesActivas = [];
  const idx = j.leyesActivas.indexOf(nombre);
  if(idx >= 0) j.leyesActivas.splice(idx, 1);
  else j.leyesActivas.push(nombre);
  try{ backupLocal('D', D); } catch(e){}
  saveJuicios();
  renderListaLeyes();
}

async function subirNuevaLey(input){
  const file = input.files[0];
  if(!file) return;
  if(typeof toast==='function') toast('Subiendo ' + file.name + '...', 'ok');
  const leyes = getLeyesDespacho();
  const kb = Math.round(file.size/1024);
  const entry = { nombre: file.name, size: kb + ' KB', fecha: new Date().toLocaleDateString('es-MX') };
  // Intentar subir a R2
  try{
    const path = (window.SB_DESPACHO_ID||'despacho') + '/leyes/' + file.name;
    if(typeof window.subirR2==='function') await window.subirR2(file, path, 'leyes');
    entry.path = path;
  } catch(e){ console.warn('subirNuevaLey R2:', e); }
  leyes.push(entry);
  setLeyesDespacho(leyes);
  renderListaLeyes();
  if(typeof toast==='function') toast('✓ Ley subida al despacho', 'ok');
  input.value = '';
}


// ══════════════════════════════════════════════════════════════
// GESTIÓN DE LEYES DEL DESPACHO — solo administrador
// Drive: LEX-MEXICO/Leyes-Despacho/   (carpeta fija, ID en localStorage)
// ══════════════════════════════════════════════════════════════
const LEYES_DRIVE_FOLDER_NAME = 'Leyes-Despacho';
const DRIVE_LEYES_LS_KEY = 'lex_leyes_drive_carpeta_id';
const LEYES_CACHE_LS_KEY = 'lex-leyes-despacho';

// ── Mostrar/ocultar botón según rol ──
function _leyesInicializarBtnAdmin() {
  const btn = document.getElementById('btn-cargar-leyes');
  if (!btn) return;
  btn.style.display = esAdministrador() ? 'inline-flex' : 'none';
}

// ── Obtener o crear carpeta Leyes-Despacho en Drive ──
async function _leyesObtenerCarpetaDrive() {
  const cachedId = localStorage.getItem(DRIVE_LEYES_LS_KEY);
  const token = await driveGetAccessToken();
  if (!token) throw new Error('Sin acceso a Drive');
  // Buscar carpeta raíz LEX-MEXICO
  const DRIVE_ROOT_ID = '1TtVVL0Jbw6BFkwLw8Wo1LZfxLN0I_ndU';
  // Buscar carpeta Leyes-Despacho dentro de LEX-MEXICO
  let carpetaId = cachedId;
  if (!carpetaId) {
    carpetaId = await driveBuscarCarpetaId(token, LEYES_DRIVE_FOLDER_NAME, DRIVE_ROOT_ID);
    if (!carpetaId) carpetaId = await driveObtenerOCrearCarpeta(token, LEYES_DRIVE_FOLDER_NAME, DRIVE_ROOT_ID);
    if (carpetaId) localStorage.setItem(DRIVE_LEYES_LS_KEY, carpetaId);
  }
  return { token, carpetaId };
}

// ── SHA-256 de un File ──
async function _sha256File(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── Listar PDFs de la carpeta Leyes en Drive ──
async function _leyesListarDrive() {
  try {
    const { token, carpetaId } = await _leyesObtenerCarpetaDrive();
    const archivos = await driveListarArchivosCarpeta(token, carpetaId);
    return archivos.map(f => ({
      nombre: f.name.replace(/\.pdf$/i,''),
      archivo: f.name,
      driveFileId: f.id,
      size: '',
      fecha: (f.createdTime||'').slice(0,10),
      sha256: ''
    }));
  } catch(e) { return []; }
}

// ── Abrir modal ──
async function abrirModalCargarLeyes() {
  const modal = document.getElementById('modal-cargar-leyes');
  if (!modal) return;
  modal.style.display = 'flex';
  // Mostrar caché inmediato
  _leyesRenderAdmin(getLeyesDespacho());
  // Refrescar Drive en background
  const statusEl = document.getElementById('leyes-drive-status');
  if (statusEl) statusEl.textContent = 'sincronizando con Drive…';
  const driveLista = await _leyesListarDrive();
  if (driveLista.length || !getLeyesDespacho().length) {
    // Enriquecer con sha256 local
    const local = getLeyesDespacho();
    driveLista.forEach(d => {
      const m = local.find(l => l.driveFileId === d.driveFileId);
      if (m) d.sha256 = m.sha256 || '';
    });
    setLeyesDespacho(driveLista);
    _leyesRenderAdmin(driveLista);
  }
  if (statusEl) statusEl.textContent = driveLista.length ? `${driveLista.length} en Drive ✓` : 'carpeta vacía';
}

function cerrarModalCargarLeyes() {
  const modal = document.getElementById('modal-cargar-leyes');
  if (modal) modal.style.display = 'none';
}

// ── Render lista admin ──
function _leyesRenderAdmin(leyes) {
  const el = document.getElementById('leyes-admin-lista');
  const tot = document.getElementById('leyes-total-txt');
  if (!el) return;
  if (tot) tot.textContent = leyes.length + ' ' + (leyes.length === 1 ? 'ley' : 'leyes');
  if (!leyes.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:0.72rem;text-align:center;padding:24px;">Sin leyes cargadas.<br>Arrastra un PDF para comenzar.</div>';
    return;
  }
  // Uso por juicio
  const uso = {};
  (D.juicios||[]).forEach(j => { (j.leyesActivas||[]).forEach(n => { uso[n] = (uso[n]||0) + 1; }); });

  el.innerHTML = leyes.map((ley, idx) => {
    const usoN = uso[ley.nombre] || 0;
    const usoBadge = usoN ? `<span style="font-size:0.58rem;padding:1px 6px;border-radius:10px;background:var(--azul-l);color:var(--azul);">Usado en ${usoN} juicio${usoN>1?'s':''}</span>` : '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid var(--border-l);border-radius:var(--radius-sm);margin-bottom:6px;background:var(--surface);">
      <span style="font-size:0.9rem;flex-shrink:0;">📚</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.73rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHTML(ley.nombre)}">${escHTML(ley.nombre)}</div>
        <div style="display:flex;align-items:center;gap:5px;margin-top:2px;flex-wrap:wrap;">${usoBadge}${ley.fecha ? `<span style="font-size:0.58rem;color:var(--muted);">${ley.fecha}</span>` : ''}</div>
      </div>
      <button onclick="event.stopPropagation();_leyesVerPDF('${ley.driveFileId}','${encodeURIComponent(ley.archivo||ley.nombre)}')" title="Ver PDF" style="font-size:0.9rem;background:none;border:none;cursor:pointer;color:var(--muted);padding:3px 5px;flex-shrink:0;">👁</button>
      <button onclick="event.stopPropagation();_leyesEliminar(${idx})" title="Eliminar" style="font-size:0.85rem;background:none;border:none;cursor:pointer;color:var(--rojo);padding:3px 5px;flex-shrink:0;">🗑</button>
    </div>`;
  }).join('');
}

// ── Ver PDF de una ley ──
async function _leyesVerPDF(driveFileId, encodedNombre) {
  if (!driveFileId) { if(typeof toast==='function') toast('⚠ Sin ID de Drive', 'err'); return; }
  const nombre = decodeURIComponent(encodedNombre || 'Ley.pdf');
  if(typeof toast==='function') toast('⏳ Cargando ' + nombre + '…', 'ok');
  try {
    const token = await driveGetAccessToken();
    const resp = await fetch('https://www.googleapis.com/drive/v3/files/' + driveFileId + '?alt=media', { headers:{ Authorization:'Bearer '+token } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) { // fallback si pop-up bloqueado
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch(e) { if(typeof toast==='function') toast('⚠ No se pudo abrir: ' + e.message, 'err'); }
}

// ── Eliminar ley ──
async function _leyesEliminar(idx) {
  const leyes = getLeyesDespacho();
  const ley = leyes[idx];
  if (!ley) return;
  // Verificar uso
  const uso = (D.juicios||[]).filter(j => (j.leyesActivas||[]).includes(ley.nombre)).length;
  const msg = uso
    ? `⚠ "${ley.nombre}" está activa en ${uso} juicio${uso>1?'s':''}.\n¿Eliminar de todos modos?`
    : `¿Eliminar "${ley.nombre}" de Drive y del despacho?`;
  if (!confirm(msg)) return;
  // Eliminar de Drive
  try {
    const token = await driveGetAccessToken();
    if (token && ley.driveFileId) {
      await fetch('https://www.googleapis.com/drive/v3/files/' + ley.driveFileId, { method: 'DELETE', headers:{ Authorization:'Bearer '+token } });
    }
  } catch(e) { console.warn('[leyesEliminar] Drive:', e); }
  // Eliminar de localStorage y de juicios activos
  leyes.splice(idx, 1);
  setLeyesDespacho(leyes);
  (D.juicios||[]).forEach(j => {
    if (Array.isArray(j.leyesActivas)) {
      j.leyesActivas = j.leyesActivas.filter(n => n !== ley.nombre);
    }
  });
  try { saveJuicios(); } catch(e){}
  _leyesRenderAdmin(leyes);
  if(typeof toast==='function') toast('✓ Ley eliminada', 'ok');
}

// ── Handler de archivos (drag&drop o input) ──
async function _leyesHandleFiles(files) {
  if (!files || !files.length) return;
  const progEl = document.getElementById('leyes-progreso');
  const progTxt = document.getElementById('leyes-progreso-txt');
  if (progEl) progEl.style.display = 'block';

  let leyes = getLeyesDespacho();
  let subidos = 0, duplicados = 0, errores = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.name.toLowerCase().endsWith('.pdf')) continue;
    if (progTxt) progTxt.textContent = `(${i+1}/${files.length}) Procesando ${file.name}…`;

    // SHA-256 para detectar duplicados de contenido
    let sha = '';
    try { sha = await _sha256File(file); } catch(e){}

    // Verificar duplicado por nombre o SHA
    const dupNombre = leyes.find(l => l.archivo === file.name || l.nombre === file.name.replace(/\.pdf$/i,''));
    const dupSha    = sha && leyes.find(l => l.sha256 === sha);
    if (dupNombre || dupSha) {
      if(typeof toast==='function') toast(`⚠ Duplicado: ${file.name}`, 'err');
      duplicados++;
      continue;
    }

    // Subir a Drive
    try {
      if (progTxt) progTxt.textContent = `Subiendo a Drive: ${file.name}…`;
      const { token, carpetaId } = await _leyesObtenerCarpetaDrive();
      const reader = new FileReader();
      const b64 = await new Promise((res,rej) => { reader.onload = () => res(reader.result.split(',')[1]); reader.onerror = rej; reader.readAsDataURL(file); });
      const meta = { name: file.name, parents: [carpetaId], mimeType: 'application/pdf' };
      const boundary = 'bnd_leyes_lex';
      const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64}\r\n--${boundary}--`;
      const upResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'multipart/related; boundary='+boundary }, body
      });
      if (!upResp.ok) throw new Error('Drive HTTP ' + upResp.status);
      const upData = await upResp.json();
      const entry = {
        nombre: file.name.replace(/\.pdf$/i,''),
        archivo: file.name,
        driveFileId: upData.id || '',
        size: Math.round(file.size/1024) + ' KB',
        fecha: new Date().toISOString().slice(0,10),
        sha256: sha
      };
      leyes.push(entry);
      setLeyesDespacho(leyes);
      _leyesRenderAdmin(leyes);
      // También actualizar getLeyesDespacho (ya está via setLeyesDespacho)
      subidos++;
    } catch(e) {
      console.error('[leyesSubir]', e);
      if(typeof toast==='function') toast(`⚠ Error subiendo ${file.name}: ${e.message}`, 'err');
      errores++;
    }
  }

  if (progEl) progEl.style.display = 'none';
  const msg = [];
  if (subidos)    msg.push(`✓ ${subidos} subida${subidos>1?'s':''}`);
  if (duplicados) msg.push(`${duplicados} duplicado${duplicados>1?'s':''}`);
  if (errores)    msg.push(`${errores} error${errores>1?'es':''}`);
  if (msg.length && typeof toast==='function') toast(msg.join(' · '), subidos ? 'ok' : 'err');
  const statusEl = document.getElementById('leyes-drive-status');
  if (statusEl) statusEl.textContent = `${leyes.length} en Drive ✓`;
}


// ══════════════════════════════════════════════════════════════════
// FLUJO DEL PROCEDIMIENTO — generado por IA con ley seleccionada
// ══════════════════════════════════════════════════════════════════

// Mostrar botón "Generar Flujo" solo para admin al abrir expediente
function _flujoInicializarBtn() {
  const btn = document.getElementById('btn-generar-flujo');
  if (btn) btn.style.display = esAdministrador() ? 'inline-flex' : 'none';
  // Si ya hay flujo guardado, mostrarlo; si no, estado vacío
  const j = D.juicios && D.juicios[_mexpIdx];
  const lista = document.getElementById('mexp-flujo-lista');
  if (j && j.flujoProcedimiento && j.flujoProcedimiento.length) {
    _flujoRender(j.flujoProcedimiento, j.flujoLey);
  } else if (lista) {
    const esAdmin = typeof esAdministrador === 'function' && esAdministrador();
    lista.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:0.74rem;padding:34px 16px;line-height:1.7;">⚖️ Aún no se ha generado el flujo del procedimiento.<br>' +
      (esAdmin ? 'Pulsa <strong>⚙ Generar Flujo</strong> y elige la ley que rige este juicio.' : 'El administrador puede generarlo desde aquí.') + '</div>';
  }
}

// Abrir selector de ley para generar flujo
async function abrirSelectorFlujo() {
  let leyes = getLeyesDespacho();
  // Si no hay leyes en caché, intentar Drive antes de rechazar
  if (!leyes.length) {
    try {
      const driveLista = await _leyesListarDrive();
      if (driveLista.length) { setLeyesDespacho(driveLista); leyes = driveLista; }
    } catch(e) {}
  }
  if (!leyes.length) {
    if (typeof toast === 'function') toast('⚠ Primero carga leyes en "Cargar Leyes"', 'err');
    return;
  }
  const j = D.juicios && D.juicios[_mexpIdx];
  const tipoJuicio = j ? (j.tipo || j.nombre || 'procedimiento civil') : 'procedimiento civil';

  // Crear overlay selector
  const ov = document.createElement('div');
  ov.id = 'flujo-selector-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,9,5,0.78);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border-l);border-radius:var(--radius);width:420px;max-height:80vh;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);overflow:hidden;">
      <div style="padding:16px 18px;border-bottom:1px solid var(--border-l);display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:0.88rem;font-weight:700;color:var(--ink);">⚙ Generar Flujo del Procedimiento</div>
          <div style="font-size:0.62rem;color:var(--muted);margin-top:2px;">Caso: <strong>${escHTML(tipoJuicio)}</strong></div>
        </div>
        <button onclick="document.getElementById('flujo-selector-ov').remove()" style="font-size:1rem;background:none;border:none;cursor:pointer;color:var(--muted);">✕</button>
      </div>
      <div style="padding:12px 16px;flex:1;overflow-y:auto;">
        <div style="font-size:0.65rem;color:var(--muted);margin-bottom:10px;font-weight:600;">Selecciona la ley que rige este procedimiento:</div>
        ${leyes.map((ley, i) => `
          <div onclick="_flujoGenerarConLey(${i})" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border-l);border-radius:var(--radius-sm);margin-bottom:6px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.borderColor='var(--gold)';this.style.background='var(--gold-bg)'" onmouseout="this.style.borderColor='var(--border-l)';this.style.background=''">
            <span style="font-size:1rem;">📚</span>
            <span style="flex:1;font-size:0.75rem;color:var(--ink);font-weight:500;">${escHTML(ley.nombre)}</span>
            <span style="font-size:0.6rem;color:var(--muted);">→</span>
          </div>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(ov);
}

// ── Reparador de JSON para respuestas de IA (Gemini/Groq) ──
// Causa raíz de "Unterminated string" / "Expected double-quoted property name":
// el modelo mete comillas dobles SIN escapar dentro del texto de un campo
// (ej. plazo: "20 días, según el "artículo 55""), lo que cierra la cadena
// antes de tiempo; o la respuesta se corta a medias por el límite de tokens.
// Esta función intenta varias reparaciones progresivas antes de rendirse.
function _flujoRepararYParsear(txtOriginal){
  const extraerCandidato = (txt) => {
    const inicio = txt.indexOf('[');
    if (inicio < 0) return txt;
    let depth=0, enStr=false, esc=false, fin=-1;
    for (let i=inicio;i<txt.length;i++){
      const c=txt[i];
      if(enStr){ if(esc){esc=false;} else if(c==='\\'){esc=true;} else if(c==='"'){enStr=false;} continue; }
      if(c==='"'){enStr=true;continue;}
      if(c==='['||c==='{')depth++;
      else if(c===']'||c==='}'){depth--; if(depth===0){fin=i;break;}}
    }
    return fin>=0 ? txt.slice(inicio,fin+1) : txt.slice(inicio);
  };
  // Si una comilla no va seguida de , : } ] o fin de texto, no es un cierre
  // real de cadena — es texto del abogado citando algo — se escapa.
  const escaparComillasInternas = (txt) => {
    let out='', enStr=false, esc=false;
    for(let i=0;i<txt.length;i++){
      const c=txt[i];
      if(!enStr){ out+=c; if(c==='"')enStr=true; continue; }
      if(esc){ out+=c; esc=false; continue; }
      if(c==='\\'){ out+=c; esc=true; continue; }
      if(c==='"'){
        let j=i+1; while(j<txt.length && /\s/.test(txt[j])) j++;
        const sig=txt[j];
        const cierreReal=(sig===','||sig===':'||sig==='}'||sig===']'||sig===undefined);
        if(cierreReal){ out+=c; enStr=false; } else { out+='\\"'; }
        continue;
      }
      out+=c;
    }
    return out;
  };
  const cerrarFaltantes = (txt) => {
    let depthArr=0, depthObj=0, enStr=false, esc=false;
    for(let i=0;i<txt.length;i++){
      const c=txt[i];
      if(enStr){ if(esc){esc=false;} else if(c==='\\'){esc=true;} else if(c==='"'){enStr=false;} continue; }
      if(c==='"'){enStr=true;continue;}
      if(c==='[')depthArr++; else if(c===']')depthArr--;
      else if(c==='{')depthObj++; else if(c==='}')depthObj--;
    }
    let out=txt;
    if(enStr) out+='"';
    while(depthObj>0){ out+='}'; depthObj--; }
    while(depthArr>0){ out+=']'; depthArr--; }
    return out;
  };
  // Si la respuesta se cortó a la mitad de una etapa, rescata las etapas
  // completas anteriores en vez de perder todo el flujo.
  const recortarAlUltimoCompleto = (txt) => {
    const idx = txt.lastIndexOf('},');
    if (idx < 0) return null;
    return txt.slice(0, idx+1) + ']';
  };
  // OJO con el orden: hay que normalizar comillas tipográficas → rectas y
  // quitar comas colgantes ANTES de decidir cuáles comillas son "internas",
  // si no, las comillas recién convertidas quedan sin escapar.
  const limpiar = (txt) => txt.replace(/[“”]/g,'"').replace(/,\s*([\]}])/g,'$1');

  // txtOriginal debería ser siempre string, pero si algún proveedor de IA
  // regresa un arreglo/objeto en vez de texto plano, _cfaiComoTexto (si existe)
  // lo normaliza aquí también, como segunda red de seguridad.
  const _txtSeguro = typeof txtOriginal === 'string' ? txtOriginal
    : (typeof _cfaiComoTexto === 'function' ? _cfaiComoTexto(txtOriginal) : String(txtOriginal||''));
  const candidato = extraerCandidato(_txtSeguro.trim());
  const normalizado = limpiar(candidato);
  const escapado = escaparComillasInternas(normalizado);
  const intentos = [
    candidato,
    normalizado,
    escapado,
    limpiar(escapado),
    cerrarFaltantes(limpiar(escapado)),
  ];
  for (const intento of intentos) {
    try { const r = JSON.parse(intento); if (Array.isArray(r) && r.length) return r; } catch(e){}
  }
  const base = cerrarFaltantes(limpiar(escapado));
  const recortado = recortarAlUltimoCompleto(base);
  if (recortado) {
    try { const r = JSON.parse(recortado); if (Array.isArray(r) && r.length) return r; } catch(e){}
  }
  throw new Error('No se pudo interpretar la respuesta de la IA como JSON válido.');
}
// Busca dentro del texto completo de la ley el punto donde empieza el
// capítulo/título relevante para el tipo de juicio, para no quedarnos solo
// con las primeras páginas (que suelen ser disposiciones generales) cuando
// el código es largo y hay que recortar por el límite de tokens de Groq.
function _leyLocalizarSeccion(textoCompleto, tipoJuicio) {
  const textoLower = textoCompleto.toLowerCase();
  const tipoLower = (tipoJuicio || '').toLowerCase().trim();
  if (!tipoLower) return -1;
  let idx = textoLower.indexOf(tipoLower);
  if (idx !== -1) return idx;
  // No apareció la frase completa: probar con las palabras más específicas
  // (más largas primero — suelen ser las menos genéricas, p.ej. "incausado"
  // antes que "divorcio").
  const stop = new Set(['de','del','la','el','los','las','para','por','con','juicio','juicios','procedimiento','procedimientos','recurso','recursos','asunto','civil','mercantil','familiar']);
  const palabras = tipoLower.split(/\s+/).filter(w => w.length > 3 && !stop.has(w));
  palabras.sort((a, b) => b.length - a.length);
  for (const p of palabras) {
    idx = textoLower.indexOf(p);
    if (idx !== -1) return idx;
  }
  return -1;
}
// Llama a Gemini con un límite de tokens dado; devuelve texto + motivo de cierre.
// Generar flujo con IA (Groq/Cloudflare) usando la ley elegida
async function _flujoGenerarConLey(leyIdx) {
  const ov = document.getElementById('flujo-selector-ov');
  if (ov) ov.remove();

  const leyes = getLeyesDespacho();
  const ley = leyes[leyIdx];
  if (!ley) return;

  const j = D.juicios && D.juicios[_mexpIdx];
  const tipoJuicio = j ? (j.tipo || j.nombre || 'juicio civil') : 'juicio civil';

  // Mostrar panel con loading
  const panel = document.getElementById('mexp-flujo-panel');
  const lista = document.getElementById('mexp-flujo-lista');
  if (panel) panel.style.display = 'flex';
  if (lista) lista.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:16px 4px;color:var(--muted);font-size:0.72rem;"><span style="display:inline-block;width:12px;height:12px;border:2px solid var(--gold);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;"></span>Generando flujo con "${escHTML(ley.nombre)}"…</div>`;

  // ── Estilo NotebookLM: la IA lee el TEXTO real de la ley y se ciñe a él ──
  // Antes esto lo hacía Gemini leyendo el PDF directo. Ahora: Mistral OCR (o
  // la capa de texto del PDF si ya es digital) extrae el texto, y Groq lo
  // analiza — mismo patrón ya probado en la lectura de acuerdos con IA.
  const _setLoad = (msg) => { if (lista) lista.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:16px 4px;color:var(--muted);font-size:0.72rem;"><span style="display:inline-block;width:12px;height:12px;border:2px solid var(--gold);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;"></span>${msg}</div>`; };

  // Groq (free tier) solo admite 12,000 tokens por minuto — insuficiente para
  // leyes completas. Si Cloudflare Workers AI está configurado, usamos su
  // modelo de CONTEXTO LARGO (Mistral Small 3.1, 128K tokens, sigue dentro
  // del cupo gratis diario) y podemos mandar la ley casi completa. Si no,
  // recurrimos a Groq con un recorte inteligente (busca el capítulo relevante
  // en vez de tomar solo el inicio del documento).
  const _usarContextoLargo = !!(_cfaiGetAccountId() && _cfaiGetToken());
  // Con Cloudflare (Mistral Small 3.1, 128K tokens de contexto) hay mucho
  // más margen del que se usaba (90,000 caracteres ≈ solo 22,500 tokens,
  // menos de un quinto de la capacidad real). Una ventana tan corta podía
  // cortar el capítulo del procedimiento a la mitad — sobre todo con texto
  // de PDF.js, que trae encabezados/pies de página repetidos en cada hoja y
  // por lo tanto "gasta" más caracteres por página útil que el texto limpio
  // de Mistral OCR — dejando fuera etapas finales del juicio (admisión,
  // audiencia, sentencia...) aunque sí estuvieran en el documento. Subir el
  // límite deja margen de sobra (≈87,500 tokens) para el prompt y los 6,000
  // tokens de salida, sin acercarse al límite real de 128K.
  const _LEY_LIMITE_TEXTO = _usarContextoLargo ? 350000 : 18000; // chars
  // 1) Descargar el PDF de la ley desde Drive y extraer su texto
  let leyTexto = '';
  try {
    if (ley.driveFileId) {
      _setLoad('Descargando la ley desde Drive…');
      const token = await driveGetAccessToken();
      if (!token) throw new Error('Sin token de Drive');
      const resp = await fetch('https://www.googleapis.com/drive/v3/files/' + ley.driveFileId + '?alt=media', { headers: { Authorization: 'Bearer ' + token } });
      if (!resp.ok) throw new Error('Drive HTTP ' + resp.status);
      const blob = await resp.blob();
      if (blob.size > 30 * 1024 * 1024) throw new Error('La ley pesa ' + Math.round(blob.size/1048576) + ' MB; es demasiado grande para leerla completa');
      const file = new File([blob], (ley.nombre||'ley') + '.pdf', { type: 'application/pdf' });
      _setLoad('Leyendo el texto de la ley…');
      const ocrRes = await _leyExtraerTexto(file, (msg) => _setLoad(msg));
      if (ocrRes && ocrRes.texto) {
        const textoCompleto = ocrRes.texto;
        if (textoCompleto.length <= _LEY_LIMITE_TEXTO) {
          leyTexto = textoCompleto;
        } else {
          // Documento largo: en vez de quedarnos con las primeras páginas
          // (disposiciones generales), buscamos dónde empieza el capítulo
          // que regula específicamente este tipo de juicio y recortamos
          // una ventana alrededor de ese punto.
          const idxSeccion = _leyLocalizarSeccion(textoCompleto, tipoJuicio);
          if (idxSeccion !== -1) {
            const contextoAntes = 1200; // para capturar el encabezado del capítulo/título
            const inicio = Math.max(0, idxSeccion - contextoAntes);
            const fin = Math.min(textoCompleto.length, inicio + _LEY_LIMITE_TEXTO);
            leyTexto = (inicio > 0 ? '[…texto anterior omitido…]\n\n' : '')
              + textoCompleto.slice(inicio, fin)
              + (fin < textoCompleto.length ? '\n\n[…texto posterior omitido…]' : '');
          } else {
            leyTexto = textoCompleto.slice(0, _LEY_LIMITE_TEXTO)
              + '\n\n[…texto recortado por longitud; no se localizó una sección específica de "' + tipoJuicio + '" — verifica los artículos citados…]';
          }
        }
      }
    }
  } catch(e) {
    console.warn('[Flujo] No se pudo leer el texto de la ley:', e.message);
    if (typeof toast === 'function') toast('⚠ No se pudo leer el texto de la ley (' + e.message + '). Se generará sin grounding; revísalo con cuidado.', 'err');
  }

  // 2) Prompts: con texto (grounding estricto) o sin texto (respaldo con advertencia)
  const _formato = `[
  {"etapa":"Número y nombre de la etapa","descripcion":"Qué ocurre en esta etapa","articulos":"Artículo(s) exactos que la fundamentan","plazo":"Plazo textual o 'no especificado en la ley'","documentos":"Documentos requeridos","recursos":"Recursos/medios de impugnación","riesgo":"Consecuencia de no atenderlo"}
]`;

  const _buildPromptGround = (texto) => `Eres un abogado litigante mexicano. A continuación tienes el TEXTO del documento de la ley "${ley.nombre}":
"""
${texto}
"""
Genera el FLUJO COMPLETO DEL PROCEDIMIENTO para un juicio de tipo "${tipoJuicio}", basándote EXCLUSIVAMENTE en el contenido del texto de arriba (fuente única, estilo NotebookLM).

REGLAS ESTRICTAS:
- Localiza el capítulo/título/sección que regula específicamente "${tipoJuicio}" y trabaja SOLO sobre ese apartado. NO mezcles plazos ni etapas de otros procedimientos del código.
- NO uses conocimiento externo ni de memoria. Cada plazo, artículo y regla debe provenir del texto de arriba.
- Copia los PLAZOS y NÚMEROS DE ARTÍCULO tal como aparecen en el documento. Si un dato no aparece en el texto, escribe "no especificado en la ley"; NUNCA lo inventes.
- En "articulos" cita el/los artículo(s) exactos del documento que fundamentan cada etapa.
- SÉ LO MÁS GRANULAR POSIBLE: cada acto procesal distinto (cada auto, resolución, notificación, requerimiento, prevención, vista a una autoridad, plazo o trámite regulado por su propio artículo) debe ser SU PROPIA etapa, en vez de agrupar varios actos procesales distintos bajo un título genérico. Por ejemplo, "Notificación y emplazamiento" casi siempre son DOS actos con artículos y plazos distintos — sepáralos; igual "Audiencia preliminar" puede incluir varias actuaciones (conciliación, depuración procesal, fijación de la litis) que la ley regule por separado. Si el capítulo contempla 12, 15 o más actos procesales distintos, genera 12, 15 o más etapas — no lo resumas a un puñado de fases genéricas.

Responde ÚNICAMENTE con un array JSON válido, sin markdown ni backticks. Formato:
${_formato}

Incluye TODAS las etapas/actos procesales reales del procedimiento en orden cronológico, con el nivel de detalle indicado arriba (las que correspondan según la ley).`;

  const promptSinTexto = `Eres un abogado litigante mexicano experto. Para el juicio "${tipoJuicio}" regido por "${ley.nombre}", genera el FLUJO del procedimiento en orden cronológico.
ADVERTENCIA: no tienes el texto de la ley a la vista; cita un artículo solo si estás seguro y, si dudas de un plazo, escribe "verificar en la ley" en vez de adivinar.
Responde ÚNICAMENTE con un array JSON válido, sin markdown ni backticks. Formato:
${_formato}`;

  try {
    _setLoad(leyTexto ? 'Analizando el texto de la ley y generando el flujo…' : 'Generando flujo…');

    // Se probó primero con Groq como opción PRIMARIA (recortando la ley a un
    // tamaño seguro para su límite real de 8,000 TPM) y funcionó en el
    // sentido de que ya no rechazaba la petición — pero el resultado salía
    // INCOMPLETO: openai/gpt-oss-120b es un modelo de "razonamiento" y, aun
    // con reasoning_effort:'low', gasta parte del presupuesto de salida
    // "pensando" antes de escribir el JSON; para una tarea grande (9 etapas x
    // 6 campos cada una) se quedaba sin tokens a la mitad y el flujo salía
    // truncado (ej. solo 4 de 9 etapas, sin avisar). Cloudflare (Mistral
    // Small 3.1, modelo de contexto largo) NO tiene ese "impuesto de
    // razonamiento" ni el límite de 8,000 TPM por petición, así que puede
    // leer la ley casi completa y terminar las 9 etapas sin cortarse — de
    // hecho así fue como se vio funcionar bien la primera vez. Por eso: si
    // Cloudflare está configurado, se usa como opción PRIMARIA para esta
    // tarea grande y estructurada; Groq (con un extracto chico de la ley)
    // queda como respaldo solo si Cloudflare falla o no está configurado.
    const LIMITE_SEGURO_GROQ = 4500;
    const MAX_TOKENS_FLUJO_GROQ = 6000;
    // Cloudflare no tiene el "impuesto de razonamiento" de Groq, así que
    // todo el presupuesto de salida va directo al JSON — con más texto de
    // ley visible (ver _LEY_LIMITE_TEXTO) puede identificar más etapas
    // reales, así que le damos más margen de salida para no cortarlas.
    const MAX_TOKENS_FLUJO_CFAI = 8000;
    // Gemini (cuenta de pago) no tiene el "impuesto de razonamiento" de Groq
    // ni el cupo diario limitado de Cloudflare, y su ventana de contexto
    // (1M tokens) cubre la ley completa sin recortes — por eso es el motor
    // PRIMARIO para esta tarea grande y estructurada cuando hay key
    // configurada. Si falla, se cae a Cloudflare y luego a Groq, igual que
    // antes.
    const MAX_TOKENS_FLUJO_GEMINI = 16384;
    const _geminiDisponible = !!(typeof ocrModGetKey === 'function' && ocrModGetKey());
    let txt;
    if (leyTexto && _geminiDisponible) {
      try {
        _setLoad('Analizando la ley completa con Gemini y generando el flujo…');
        txt = await _geminiGenerarTexto(_buildPromptGround(leyTexto), MAX_TOKENS_FLUJO_GEMINI, 0.1);
      } catch (eGem) {
        console.warn('[Flujo] Gemini falló (' + eGem.message + '); probando con Cloudflare/Groq...');
        if (typeof toast === 'function') toast('⚠ Gemini no respondió (' + eGem.message + ') — probando con otro motor…', 'err');
        txt = null;
      }
    }
    if (leyTexto && !txt) {
      if (_usarContextoLargo) {
        try {
          txt = await _cfaiLlamarContextoLargo(_buildPromptGround(leyTexto), MAX_TOKENS_FLUJO_CFAI, 0.1, 'procesal');
        } catch (eCf) {
          console.warn('[Flujo] Cloudflare (contexto largo) falló (' + eCf.message + '); usando Groq con un extracto de la ley...');
          // CFAI_LIMITE = se acabó el cupo GRATIS diario de Cloudflare (10,000
          // Neurons/día, se renueva a medianoche UTC). En ese caso el flujo
          // SÍ se genera, pero por Groq con un extracto mucho más chico de la
          // ley (menos detalle/menos etapas) — hay que avisarlo claro, si no
          // parece que "no cambia nada" al regenerar.
          const esLimiteDiario = /CFAI_LIMITE/.test(eCf.message || '');
          if (esLimiteDiario && typeof toast === 'function') {
            toast('⚠ Cloudflare agotó su cupo gratis de hoy — este flujo salió con Groq (menos detalle). Se renueva a medianoche UTC.', 'err');
          }
          _setLoad(esLimiteDiario ? 'Cloudflare sin cupo por hoy; usando Groq con un extracto de la ley…' : 'Cloudflare no respondió; usando Groq con un extracto de la ley…');
          const leyTextoCorto = leyTexto.length > LIMITE_SEGURO_GROQ ? leyTexto.slice(0, LIMITE_SEGURO_GROQ) + '\n\n[…texto recortado por longitud…]' : leyTexto;
          txt = await _iaLlamar(_buildPromptGround(leyTextoCorto), MAX_TOKENS_FLUJO_GROQ, 0.1, 'procesal');
        }
      } else {
        const leyTextoCorto = leyTexto.length > LIMITE_SEGURO_GROQ ? leyTexto.slice(0, LIMITE_SEGURO_GROQ) + '\n\n[…texto recortado por longitud para respetar el límite de Groq…]' : leyTexto;
        txt = await _iaLlamar(_buildPromptGround(leyTextoCorto), MAX_TOKENS_FLUJO_GROQ, 0.1, 'procesal');
      }
    } else if (!leyTexto) {
      // Sin texto de ley disponible (ni Gemini, Cloudflare o Groq tuvieron
      // nada que leer) — se genera con el conocimiento general de la IA,
      // avisando en el prompt que verifique los datos con cuidado.
      txt = await _iaLlamar(promptSinTexto, MAX_TOKENS_FLUJO_GROQ, 0.1, 'procesal');
    }
    // Si leyTexto existía y algún motor (Gemini/Cloudflare/Groq) ya escribió
    // txt más arriba, no se toca — cualquier otra combinación ya está
    // cubierta por las dos ramas anteriores.

    let etapas;
    try {
      etapas = _flujoRepararYParsear(txt);
    } catch (eParse) {
      registrarError('Flujo · leer respuesta de la IA', eParse, { muestra: String(txt==null?'':txt).slice(0, 400) });
      throw new Error('La IA no devolvió un JSON válido. Intenta de nuevo.');
    }
    if (!Array.isArray(etapas) || !etapas.length) throw new Error('La IA no devolvió etapas del procedimiento. Intenta de nuevo.');

    // Guardar en el juicio
    if (j) {
      j.flujoProcedimiento = etapas;
      j.flujoLey = ley.nombre;
      j.flujoGrounded = !!leyTexto;
      // La numeración de etapas cambia con cada regeneración — una marca de
      // "etapa actual" o un banner "🔮 ..." de una detección ANTERIOR ya no
      // corresponde a este nuevo arreglo (ej. "etapa 8" cuando ahora solo hay
      // 5). Se limpia aquí para no mostrar información obsoleta/engañosa.
      j.flujoEtapaActual = null;
      j.flujoEtapaActualRazon = '';
      try { saveJuicios(); } catch(e) {}
      // IMPORTANTE: esperar a que el guardado en Supabase quede CONFIRMADO
      // antes de declarar éxito. saveJuicios() dispara el guardado sin
      // esperarlo (fire-and-forget); si el usuario recargaba la página justo
      // después de ver "✓ Flujo generado" — antes de que el guardado
      // realmente terminara — la recarga traía de vuelta la versión vieja
      // de Supabase y el flujo recién generado se perdía sin aviso.
      _setLoad('Guardando flujo…');
      try {
        await syncEstadoSupabase();
      } catch(eGuardar) {
        console.warn('[Flujo] Error confirmando guardado en Supabase:', eGuardar.message);
        if (typeof toast === 'function') toast('⚠ El flujo se generó pero no se pudo confirmar el guardado (' + eGuardar.message + ') — no recargues la página todavía, intenta guardarlo de nuevo.', 'err');
      }
    }
    // Se guarda el texto completo (ya extraído, sin recortar) para que
    // "Profundizar con IA" en el detalle de cada etapa pueda reusarlo sin
    // tener que volver a descargar/leer el PDF de la ley.
    window._flujoLeyTextoCompleto = leyTexto || '';
    window._flujoTipoJuicioActual = tipoJuicio;
    _flujoRender(etapas, ley.nombre);
    if (typeof toast === 'function') {
      if (leyTexto && etapas.length < 5) {
        // Un procedimiento civil típico rara vez tiene menos de 5 etapas —
        // si salieron menos, lo más probable es que la respuesta de la IA se
        // haya cortado a la mitad (ver _flujoRepararYParsear). Avisar en vez
        // de dejar pasar un flujo incompleto sin explicación.
        toast('⚠ Solo se generaron ' + etapas.length + ' etapa(s) — la respuesta pudo haberse cortado. Intenta «Generar Flujo» de nuevo.', 'err');
      } else {
        toast(leyTexto ? '✓ Flujo generado leyendo el texto de ' + ley.nombre : '✓ Flujo generado (sin texto de la ley)', 'ok');
      }
    }
  } catch(e) {
    console.error('[Flujo]', e);
    if (lista) lista.innerHTML = `<div style="color:var(--rojo);font-size:0.7rem;padding:10px 4px;">⚠ Error al generar: ${escHTML(e.message)}</div>`;
    if (typeof toast === 'function') toast('⚠ Error al generar flujo: ' + e.message, 'err');
  }
}

// Renderizar el flujo en el panel — SOLO TÍTULOS clickeables
function _flujoRender(etapas, leyNombre) {
  const panel = document.getElementById('mexp-flujo-panel');
  const lista = document.getElementById('mexp-flujo-lista');
  if (!lista) return;
  if (panel) panel.style.display = 'flex';

  // Guardar referencia para el detalle
  window._flujoEtapasActual = etapas || [];
  window._flujoLeyActual = leyNombre || '';

  // Etapa actual marcada manualmente por el abogado (índice; -1 si ninguna)
  const j = D.juicios && D.juicios[_mexpIdx];
  const actual = (j && typeof j.flujoEtapaActual === 'number') ? j.flujoEtapaActual : -1;

  const detectarBtn = `<button id="flujo-detectar-btn" onclick="_flujoDetectarEtapa()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;border:1px solid var(--gold);background:var(--gold-bg);color:var(--gold-d);font-size:0.62rem;font-weight:700;cursor:pointer;font-family:'JetBrains Mono',monospace;">🔮 Detectar etapa según documentos</button>`;

  const razon = (actual >= 0 && j && j.flujoEtapaActualRazon)
    ? `<div style="font-size:0.6rem;color:var(--gold-d);background:var(--gold-bg);border:1px solid var(--border-l);border-radius:var(--radius-sm);padding:6px 9px;margin:2px 0 8px;line-height:1.45;">🔮 ${escHTML(j.flujoEtapaActualRazon)}</div>`
    : (actual < 0
      ? `<div style="font-size:0.6rem;color:var(--muted);padding:2px 0 8px;line-height:1.4;">Pulsa <strong>Detectar etapa</strong> para que la IA infiera el punto del juicio según los documentos cargados, o márcala manualmente al abrir una etapa.</div>`
      : '');

  lista.innerHTML =
    (leyNombre ? `<div style="font-size:0.58rem;color:var(--muted);padding:4px 0 4px;font-style:italic;">Ley base: ${escHTML(leyNombre)}${(j && j.flujoGrounded) ? ' · <span style="font-style:normal;color:var(--verde);font-weight:600;">📚 leído del texto de la ley</span>' : ''}</div>` : '') +
    `<div style="padding:2px 0 8px;">${detectarBtn}</div>` +
    razon +
    etapas.map((et, i) => {
      // Estado por etapa actual manual: cumplida (<actual) / en curso (=actual) / pendiente (>actual)
      const esCumplida = actual >= 0 && i < actual;
      const esActual = actual >= 0 && i === actual;

      let borde, fondo, colorNum, contenido;
      if (esActual) {
        borde = 'var(--gold)'; fondo = 'var(--gold)'; colorNum = '#fff'; contenido = (i + 1);
      } else if (esCumplida) {
        borde = 'var(--verde)'; fondo = 'var(--verde-l)'; colorNum = 'var(--verde)'; contenido = '✓';
      } else {
        borde = 'var(--border-l)'; fondo = 'var(--surface)'; colorNum = 'var(--muted)'; contenido = (i + 1);
      }

      const tituloColor = esActual ? 'var(--gold-d)' : (esCumplida ? 'var(--ink)' : 'var(--ink)');
      const filaBg = esActual ? 'var(--gold-bg)' : '';
      const badgeActual = esActual
        ? `<span style="font-size:0.52rem;font-weight:700;letter-spacing:0.08em;padding:2px 7px;border-radius:10px;background:var(--gold);color:#fff;flex-shrink:0;">● EN CURSO</span>`
        : `<span style="font-size:0.62rem;color:var(--muted);flex-shrink:0;">ver ›</span>`;

      return `<div onclick="_flujoAbrirDetalle(${i})" style="display:flex;gap:10px;margin-bottom:8px;cursor:pointer;border-radius:var(--radius-sm);padding:6px 8px;transition:background 0.12s;background:${filaBg};" onmouseover="this.style.background='var(--gold-bg)'" onmouseout="this.style.background='${filaBg}'">
        <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
          <div style="width:22px;height:22px;border-radius:50%;background:${fondo};border:2px solid ${borde};display:flex;align-items:center;justify-content:center;font-size:0.55rem;font-weight:700;color:${colorNum};${esActual?'box-shadow:0 0 0 3px var(--gold-bg);':''}">${contenido}</div>
          ${i < etapas.length - 1 ? `<div style="width:2px;flex:1;background:${esCumplida?'var(--verde)':'var(--border-l)'};min-height:14px;margin-top:3px;"></div>` : ''}
        </div>
        <div style="flex:1;min-width:0;display:flex;align-items:center;gap:6px;padding:1px 0;">
          <div style="flex:1;font-size:0.74rem;font-weight:${esActual?'800':'700'};color:${tituloColor};line-height:1.35;">${escHTML(et.etapa)}</div>
          ${badgeActual}
        </div>
      </div>`;
    }).join('');
}

// Abrir pantalla de detalle de una etapa del flujo
function _flujoAbrirDetalle(i) {
  const etapas = window._flujoEtapasActual || [];
  const et = etapas[i];
  if (!et) return;
  const leyNombre = window._flujoLeyActual || '';

  // Limpiar overlay previo
  const prev = document.getElementById('flujo-detalle-ov');
  if (prev) prev.remove();

  // Helper para cada sección (solo se muestra si hay contenido)
  function _sec(icono, titulo, contenido, colorBg, colorTxt) {
    if (!contenido) return '';
    return `<div style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:6px;font-size:0.58rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${colorTxt||'var(--gold-d)'};margin-bottom:5px;">
        <span>${icono}</span>${titulo}
      </div>
      <div style="font-size:0.82rem;line-height:1.6;color:var(--ink);background:${colorBg||'var(--surface2)'};border:1px solid var(--border-l);border-radius:var(--radius-sm);padding:9px 12px;white-space:pre-line;">${escHTML(contenido)}</div>
    </div>`;
  }

  const ov = document.createElement('div');
  ov.id = 'flujo-detalle-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,9,5,0.80);z-index:320;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };

  // ¿Es la etapa actual marcada?
  const _j = D.juicios && D.juicios[_mexpIdx];
  const _esActual = _j && _j.flujoEtapaActual === i;
  const btnEtapa = _esActual
    ? `<button onclick="_flujoMarcarEtapaActual(${i})" style="flex:1;padding:9px 14px;border-radius:var(--radius-sm);border:1px solid var(--verde);background:var(--verde-l);color:var(--verde);font-size:0.74rem;font-weight:700;cursor:pointer;">✓ Etapa actual — quitar marca</button>`
    : `<button onclick="_flujoMarcarEtapaActual(${i})" style="flex:1;padding:9px 14px;border-radius:var(--radius-sm);border:none;background:var(--gold);color:#fff;font-size:0.74rem;font-weight:700;cursor:pointer;">📍 Marcar como etapa actual</button>`;

  ov.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border-l);border-radius:var(--radius);width:560px;max-width:100%;max-height:86vh;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);overflow:hidden;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border-l);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;background:var(--gold-bg);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.55rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--gold-d);font-weight:700;margin-bottom:4px;">⚖️ Etapa del procedimiento${_esActual?' · ● EN CURSO':''}</div>
          <div style="font-size:1rem;font-weight:700;color:var(--ink);line-height:1.3;">${escHTML(et.etapa)}</div>
          ${leyNombre ? `<div style="font-size:0.6rem;color:var(--muted);margin-top:4px;font-style:italic;">Ley base: ${escHTML(leyNombre)}</div>` : ''}
        </div>
        <button onclick="document.getElementById('flujo-detalle-ov').remove()" style="font-size:1.1rem;background:none;border:none;cursor:pointer;color:var(--muted);flex-shrink:0;line-height:1;">✕</button>
      </div>
      <div style="padding:16px 20px;flex:1;overflow-y:auto;">
        <div id="flujo-profundizar-slot" style="margin-bottom:14px;"></div>
        ${_sec('📋','Descripción', et.descripcion, 'var(--surface2)', 'var(--gold-d)')}
        ${_sec('📜','Artículos que la rigen', et.articulos, '#fff8e8', '#8a5010')}
        ${_sec('⏱','Plazo / término', et.plazo, 'var(--amarillo-l)', 'var(--amarillo)')}
        ${_sec('⚡','Recursos disponibles', et.recursos, 'var(--azul-l)', 'var(--azul)')}
        ${_sec('⚠','Riesgo si no se atiende', et.riesgo, 'var(--rojo-l)', 'var(--rojo)')}
        ${_sec('📄','Documentos requeridos', et.documentos, 'var(--surface2)', 'var(--gold-d)')}
      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--border-l);display:flex;gap:8px;background:var(--surface2);">
        <button id="flujo-profundizar-btn" onclick="_flujoProfundizarEtapa(${i})" style="padding:9px 14px;border-radius:var(--radius-sm);border:1px solid var(--gold);background:var(--gold-bg);color:var(--gold-d);font-size:0.74rem;font-weight:700;cursor:pointer;white-space:nowrap;">🔎 Profundizar con IA</button>
        ${btnEtapa}
      </div>
    </div>`;
  document.body.appendChild(ov);
}

// Manda ESTA etapa sola a la IA (con el texto completo de la ley, sin recorte
// compartido entre etapas) pidiendo el máximo detalle y cita textual del
// fundamento legal. Al terminar, actualiza la etapa en pantalla y la guarda.
async function _flujoProfundizarEtapa(i){
  const etapas = window._flujoEtapasActual || [];
  const et = etapas[i];
  if(!et) return;
  const btn = document.getElementById('flujo-profundizar-btn');
  const slot = document.getElementById('flujo-profundizar-slot');
  if(btn){ btn.disabled = true; btn.style.opacity = '0.6'; btn.innerHTML = '<span style="display:inline-block;width:11px;height:11px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:-1px;margin-right:6px;"></span>Profundizando…'; }
  if(slot) slot.innerHTML = '<div style="font-size:0.62rem;color:var(--muted);padding:2px 0;">🔎 Pidiendo a la IA que profundice esta etapa con el texto de la ley…</div>';

  const leyTexto = window._flujoLeyTextoCompleto || '';
  const leyNombre = window._flujoLeyActual || '';
  const tipoJuicio = window._flujoTipoJuicioActual || '';
  // Esta llamada es SOLO para una etapa (no las 9 juntas), así que se le
  // puede dar mucho más texto de la ley que en la generación general. Pero
  // Groq tiene un límite REAL de 8,000 tokens por minuto por petición — un
  // texto de 40,000 caracteres (~10,000 tokens) NUNCA cabría ahí, sin
  // importar cuánto se recorte max_tokens. Por eso: si Cloudflare (modelo de
  // contexto largo, 128K tokens) está configurado, se usa DIRECTO con el
  // texto grande; si no, se cae a Groq con un recorte mucho más chico para
  // respetar su límite real.
  const _cfaiDisponible = !!(_cfaiGetAccountId() && _cfaiGetToken());
  const LIMITE_ETAPA = _cfaiDisponible ? 40000 : 4500;
  const leyParaEtapa = leyTexto.length > LIMITE_ETAPA ? leyTexto.slice(0, LIMITE_ETAPA) + '\n\n[…texto recortado por longitud…]' : leyTexto;

  const _buildPromptProfundizar = (leyTxt) => `Eres un abogado litigante mexicano experto. Vas a profundizar UNA sola etapa del procedimiento "${tipoJuicio}" (regido por "${leyNombre}") — dale al abogado el máximo detalle posible sobre ESTA etapa en particular.

ETAPA A PROFUNDIZAR: "${et.etapa}"

Versión general ya generada (ahora hay que ampliarla y precisarla):
- Descripción: ${et.descripcion || '—'}
- Artículos: ${et.articulos || '—'}
- Plazo: ${et.plazo || '—'}

${leyTxt ? `TEXTO DE LA LEY (fuente única — cita textualmente entre comillas el fragmento exacto cuando lo uses):\n"""\n${leyTxt}\n"""` : 'No se tiene el texto de la ley a la vista para esta etapa; usa tu conocimiento del derecho mexicano, pero marca con "verificar en la ley" cualquier dato del que no estés seguro — NUNCA inventes un artículo o plazo.'}

Genera una versión MUCHO MÁS DETALLADA Y PRECISA de esta etapa:
- descripcion: explicación completa y práctica, paso a paso, de qué ocurre en esta etapa (mínimo 4-5 oraciones, lenguaje claro para el abogado).
- articulos: cita el/los artículo(s) EXACTOS; si tienes el texto de la ley arriba, incluye además una cita textual breve (entre comillas) del fragmento relevante.
- plazo: el plazo exacto tal como aparece en la ley, señalando el artículo que lo establece.
- documentos: lista detallada de TODOS los documentos/requisitos necesarios en esta etapa.
- recursos: recursos o medios de impugnación disponibles si algo sale mal en esta etapa, con su fundamento.
- riesgo: consecuencia procesal EXACTA de no atender esta etapa a tiempo, con fundamento si existe.

Responde ÚNICAMENTE con un objeto JSON válido (NO un arreglo), sin markdown ni backticks, con exactamente estas llaves:
{"descripcion":"...","articulos":"...","plazo":"...","documentos":"...","recursos":"...","riesgo":"..."}`;

  try {
    let txt;
    if (_cfaiDisponible) {
      try {
        txt = await _cfaiLlamarContextoLargo(_buildPromptProfundizar(leyParaEtapa), 2500, 0.1, 'procesal');
      } catch (eCf) {
        console.warn('[Flujo] Cloudflare (contexto largo) falló al profundizar (' + eCf.message + '); reintentando con Groq y un texto más corto...');
        if (/CFAI_LIMITE/.test(eCf.message || '') && typeof toast === 'function') {
          toast('⚠ Cloudflare agotó su cupo gratis de hoy — esto salió con Groq (menos detalle). Se renueva a medianoche UTC.', 'err');
        }
        _setLoad && _setLoad('Cloudflare no respondió; reintentando con Groq…');
        const leyCorta = leyTexto.length > 4500 ? leyTexto.slice(0, 4500) + '\n\n[…texto recortado por longitud…]' : leyTexto;
        txt = await _iaLlamar(_buildPromptProfundizar(leyCorta), 2500, 0.1, 'procesal');
      }
    } else {
      txt = await _iaLlamar(_buildPromptProfundizar(leyParaEtapa), 2500, 0.1, 'procesal');
    }
    const limpio = (typeof _cfaiComoTexto === 'function' ? _cfaiComoTexto(txt) : String(txt||'')).replace(/```json|```/g,'').trim();
    const m = limpio.match(/\{[\s\S]*\}/);
    const obj = JSON.parse(m ? m[0] : limpio);
    if(!obj || typeof obj !== 'object') throw new Error('Formato inesperado');

    // Fusiona el detalle nuevo sobre la etapa (conserva el título original)
    Object.assign(et, {
      descripcion: obj.descripcion || et.descripcion,
      articulos:   obj.articulos   || et.articulos,
      plazo:       obj.plazo       || et.plazo,
      documentos:  obj.documentos  || et.documentos,
      recursos:    obj.recursos    || et.recursos,
      riesgo:      obj.riesgo      || et.riesgo
    });

    // Persistir en el expediente
    const j = D.juicios && D.juicios[_mexpIdx];
    if(j && Array.isArray(j.flujoProcedimiento) && j.flujoProcedimiento[i]){
      Object.assign(j.flujoProcedimiento[i], et);
      try { saveJuicios(); } catch(e){}
      try { if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced(); } catch(e){}
    }

    if(slot) slot.innerHTML = '<div style="font-size:0.62rem;color:var(--verde-d);background:var(--verde-l);border-radius:var(--radius-sm);padding:6px 9px;">✓ Etapa profundizada' + (leyParaEtapa ? ' con el texto de la ley.' : ' (sin texto de la ley a la vista).') + '</div>';
    if (typeof toast === 'function') toast('✓ Etapa profundizada', 'ok');
    // Redibuja el modal con el contenido actualizado
    _flujoAbrirDetalle(i);
  } catch(e){
    console.error('[Flujo] Profundizar etapa:', e);
    if(slot) slot.innerHTML = '<div style="font-size:0.62rem;color:var(--rojo);">⚠ No se pudo profundizar: ' + escHTML(e.message) + '</div>';
    if(btn){ btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = '🔎 Profundizar con IA'; }
  }
}

// Marcar (o quitar) la etapa actual del procedimiento — manual, persistente
function _flujoMarcarEtapaActual(i) {
  const j = D.juicios && D.juicios[_mexpIdx];
  if (!j) return;
  // Toggle: si ya era la actual, se quita la marca
  j.flujoEtapaActual = (j.flujoEtapaActual === i) ? null : i;
  j.flujoEtapaActualRazon = ''; // marca manual: sin razón de IA
  try { if (typeof saveJuicios === 'function') saveJuicios(); } catch(e) {}
  try { if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced(); } catch(e) {}
  const ov = document.getElementById('flujo-detalle-ov');
  if (ov) ov.remove();
  _flujoRender(window._flujoEtapasActual, window._flujoLeyActual);
  // La barra "ETAPA" del encabezado toma sus datos del mismo j.flujoEtapaActual
  // cuando el expediente ya tiene flujo generado — refrescarla para que no
  // se desincronice de lo que se acaba de marcar aquí.
  try { if (typeof _juRenderEtapas === 'function') _juRenderEtapas(j, _mexpIdx); } catch(e){}
  try { if (typeof renderJuicios === 'function') renderJuicios(); } catch(e){}
  if (typeof toast === 'function') {
    toast(j.flujoEtapaActual === null ? 'Marca de etapa actual retirada' : '📍 Etapa actual actualizada', 'ok');
  }
}

// Inferir la etapa actual con IA, según los documentos cargados (acuerdos + historial)
async function _flujoDetectarEtapa() {
  const j = D.juicios && D.juicios[_mexpIdx];
  const etapas = window._flujoEtapasActual || [];
  if (!j || !etapas.length) { if (typeof toast === 'function') toast('⚠ Primero genera el flujo del procedimiento', 'err'); return; }

  // Reunir documentos del expediente: acuerdos + historial
  let acuerdos = [];
  try { acuerdos = JSON.parse(localStorage.getItem('lex_acuerdos_' + (window._jdetId || '')) || '[]'); } catch(e) {}
  const docsLineas = [];
  acuerdos.filter(a => a.estado !== 'procesando' && a.estado !== 'error').forEach(a => {
    const f = a.fechaAcuerdo || a.fechaSubida || '';
    const d = (a.descripcion || a.resumen || '').replace(/\s+/g, ' ').trim();
    docsLineas.push(`- ${f ? '[' + f + '] ' : ''}${a.nombre || a.archivo || 'documento'}${d ? ': ' + d : ''}`);
  });
  if (Array.isArray(j.historial)) {
    j.historial.forEach(h => {
      if (h && h.texto) docsLineas.push(`- ${h.fecha ? '[' + h.fecha + '] ' : ''}${h.texto}${h.detalle ? ': ' + h.detalle : ''}`);
    });
  }
  if (!docsLineas.length) { if (typeof toast === 'function') toast('⚠ No hay documentos cargados para inferir la etapa', 'err'); return; }

  const btn = document.getElementById('flujo-detectar-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.innerHTML = '<span style="display:inline-block;width:11px;height:11px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:-1px;margin-right:6px;"></span>Analizando documentos…'; }

  const listaEtapas = etapas.map((e, i) => (i + 1) + '. ' + (e.etapa || '')).join('\n');
  const prompt = `Eres un abogado litigante mexicano experto. Con base en el FLUJO del procedimiento y los DOCUMENTOS ya cargados en el expediente, determina en qué ETAPA se encuentra ACTUALMENTE el juicio (la etapa correspondiente al documento procesalmente más avanzado).

FLUJO (etapas):
${listaEtapas}

DOCUMENTOS DEL EXPEDIENTE (con fecha si está disponible):
${docsLineas.join('\n')}

Responde ÚNICAMENTE en JSON válido, sin markdown ni texto extra:
{"numero": N, "razon": "explicación breve (1-2 frases) citando el documento clave que define la etapa"}
donde N es el número de la etapa actual, entre 1 y ${etapas.length}.`;

  try {
    const raw = await _iaLlamar(prompt, 600, 0.1, 'procesal');
    const clean = (raw || '').replace(/```json|```/g, '').trim();
    const m = clean.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : clean);
    let n = parseInt(parsed.numero, 10);
    if (!Number.isFinite(n)) throw new Error('La IA no devolvió un número de etapa');
    n = Math.max(1, Math.min(etapas.length, n));
    j.flujoEtapaActual = n - 1;
    j.flujoEtapaActualRazon = (parsed.razon || '').toString().slice(0, 240);
    try { if (typeof saveJuicios === 'function') saveJuicios(); } catch(e) {}
    try { if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced(); } catch(e) {}
    _flujoRender(window._flujoEtapasActual, window._flujoLeyActual);
    try { if (typeof _juRenderEtapas === 'function') _juRenderEtapas(j, _mexpIdx); } catch(e){}
    try { if (typeof renderJuicios === 'function') renderJuicios(); } catch(e){}
    if (typeof toast === 'function') toast('🔮 Etapa detectada: ' + (etapas[n - 1].etapa || ('Etapa ' + n)), 'ok');
  } catch(e) {
    console.error('[Flujo] detectar etapa:', e);
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = '🔮 Detectar etapa según documentos'; }
    if (typeof toast === 'function') toast('⚠ No se pudo detectar la etapa: ' + (e.message || ''), 'err');
  }
}

// ══════════════════════════════════════════════════════════════════
// CHAT DE REDACTAR ESCRITO — dentro del visor de acuerdos
// ══════════════════════════════════════════════════════════════════
let _escritoChatAcuerdo = null; // acuerdo activo en el chat
let _escritoChatHistorial = []; // historial de mensajes

function _acuerdoAbrirChatEscrito() {
  const overlay = document.getElementById('acuerdo-visor-overlay');
  const iframe = document.getElementById('acuerdo-visor-iframe');
  const resDiv = document.getElementById('acuerdo-resumen-modal-div');
  const nombreEl = document.getElementById('acuerdo-visor-nombre');
  if (!overlay) return;

  // Ocultar otros paneles
  if (iframe) { iframe.style.display = 'none'; try { URL.revokeObjectURL(iframe.src); } catch(e){} }
  if (resDiv) { resDiv.style.display = 'none'; }

  // Obtener acuerdo activo
  _escritoChatAcuerdo = verResumenAcuerdoModal._acActivo || null;
  _escritoChatHistorial = [];

  // Crear o reutilizar panel de chat
  let chatDiv = document.getElementById('acuerdo-chat-escrito-div');
  if (!chatDiv) {
    chatDiv = document.createElement('div');
    chatDiv.id = 'acuerdo-chat-escrito-div';
    overlay.querySelector('iframe').parentNode.appendChild(chatDiv);
  }
  chatDiv.style.cssText = 'flex:1;display:flex;flex-direction:column;background:var(--surface,#fdfaf4);overflow:hidden;';

  const j = D.juicios && D.juicios[_mexpIdx];
  const leyesActivas = j ? (j.leyesActivas || []) : [];
  const tipoJuicio = j ? (j.tipo || '') : '';
  const cliente = j ? (j.cliente || j.nombre || '') : '';
  const resumen = _escritoChatAcuerdo ? (_escritoChatAcuerdo.resumen || '') : '';

  // Sugerencia inicial
  const sugerencia = resumen
    ? `Basándome en el resumen del acuerdo, sugiero redactar un escrito de respuesta o cumplimiento.\n\n¿Quieres que lo genere ahora, o prefieres indicarme qué tipo de escrito necesitas?`
    : `No hay resumen disponible para este acuerdo. Dime qué tipo de escrito necesitas y lo redacto considerando el expediente de <strong>${escHTML(cliente)}</strong>.`;

  chatDiv.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:#2a2a2a;flex-shrink:0;border-bottom:1px solid #444;">
      <span style="color:#e0e0e0;font-size:0.75rem;flex:1;font-family:'JetBrains Mono',monospace;">✍️ Redactar Escrito — ${escHTML(_escritoChatAcuerdo ? (_escritoChatAcuerdo.nombre || '') : 'Expediente')}</span>
      <span style="font-size:0.6rem;color:#aaa;">${leyesActivas.length ? '📚 ' + leyesActivas.slice(0,2).join(', ') : 'Sin leyes activas'}</span>
    </div>
    <div id="escrito-chat-msgs" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;">
      <div style="background:var(--azul-l,#eef3ff);border:1px solid rgba(26,74,138,0.15);border-radius:8px 8px 8px 2px;padding:10px 14px;max-width:88%;font-size:0.78rem;line-height:1.65;color:var(--ink);">
        <div style="font-size:0.55rem;color:var(--azul);font-weight:700;margin-bottom:4px;letter-spacing:0.1em;">✦ GEMINI · ASISTENTE JURÍDICO</div>
        ${sugerencia}
      </div>
    </div>
    <div style="flex-shrink:0;border-top:1px solid var(--border-l,#ecdfa8);padding:10px 14px;display:flex;gap:8px;background:var(--surface2,#f7f3e8);">
      <textarea id="escrito-chat-input" rows="2" placeholder="Ej: Redacta un escrito de cumplimiento informando los atestados… o cualquier otra solicitud libre" style="flex:1;padding:8px 10px;border:1px solid var(--border-l);border-radius:var(--radius-sm);font-size:0.76rem;background:var(--surface);color:var(--ink);resize:none;font-family:sans-serif;" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_escritoEnviar();}"></textarea>
      <div style="display:flex;flex-direction:column;gap:5px;">
        <button onclick="_escritoEnviar()" style="padding:8px 14px;border-radius:var(--radius-sm);border:none;background:var(--verde,#1a7a3a);color:#fff;font-size:0.72rem;font-weight:700;cursor:pointer;">↗ Enviar</button>
        <button onclick="_escritoCopiar()" style="padding:6px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-l);background:none;color:var(--muted);font-size:0.65rem;cursor:pointer;">📋 Copiar</button>
      </div>
    </div>`;

  if (nombreEl) nombreEl.textContent = '✍️ Redactar Escrito';
  overlay.style.display = 'flex';
  chatDiv.style.display = 'flex';

  // Inicializar historial con contexto del acuerdo
  if (resumen) {
    _escritoChatHistorial.push({
      role: 'user',
      content: `Contexto del caso:\nCliente: ${cliente}\nTipo de juicio: ${tipoJuicio}\nLeyes activas: ${leyesActivas.join(', ') || 'no especificadas'}\nResumen del acuerdo:\n${resumen}`
    });
    _escritoChatHistorial.push({ role: 'assistant', content: sugerencia });
  }
}

async function _escritoEnviar() {
  const inp = document.getElementById('escrito-chat-input');
  const msgsEl = document.getElementById('escrito-chat-msgs');
  if (!inp || !msgsEl) return;
  const texto = inp.value.trim();
  if (!texto) return;
  inp.value = '';

  // Burbuja usuario
  msgsEl.innerHTML += `<div style="align-self:flex-end;background:var(--gold-bg);border:1px solid var(--border-l);border-radius:8px 8px 2px 8px;padding:9px 13px;max-width:85%;font-size:0.76rem;color:var(--ink);line-height:1.5;">${escHTML(texto)}</div>`;

  // Burbuja loading
  const loadId = 'escrito-load-' + Date.now();
  msgsEl.innerHTML += `<div id="${loadId}" style="background:var(--azul-l);border:1px solid rgba(26,74,138,0.15);border-radius:8px 8px 8px 2px;padding:10px 14px;max-width:88%;font-size:0.76rem;color:var(--muted);display:flex;align-items:center;gap:8px;"><span style="display:inline-block;width:10px;height:10px;border:2px solid var(--azul);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;"></span>Redactando…</div>`;
  msgsEl.scrollTop = msgsEl.scrollHeight;

  _escritoChatHistorial.push({ role: 'user', content: texto });

  const j = D.juicios && D.juicios[_mexpIdx];
  const leyesActivas = j ? (j.leyesActivas || []) : [];
  const cliente = j ? (j.cliente || j.nombre || 'el cliente') : 'el cliente';
  const tipoJuicio = j ? (j.tipo || 'juicio civil') : 'juicio civil';

  const systemPrompt = `Eres un abogado litigante mexicano experto con 20 años de experiencia. Redactas escritos judiciales formales, claros y conforme a derecho.
Caso actual: ${tipoJuicio} de ${cliente}.
Leyes aplicables: ${leyesActivas.join(', ') || 'Código de Procedimientos Civiles de Oaxaca'}.
Contexto del acuerdo: ${_escritoChatAcuerdo ? (_escritoChatAcuerdo.resumen || _escritoChatAcuerdo.descripcion || '') : ''}.
Cuando redactes un escrito, usa formato jurídico mexicano: encabezado con datos del juicio, proemio, cuerpo con numerales, petición y cierre formal. Si te piden algo distinto a redactar, responde como asistente jurídico.`;

  const mensajes = [
    { role: 'user', content: systemPrompt + '\n\n---\n\n' + (_escritoChatHistorial[0]?.content || texto) },
    ..._escritoChatHistorial.slice(1)
  ];

  try {
    // _iaLlamar (Groq → Cloudflare) recibe un solo prompt de texto, no una
    // conversación por turnos — se aplana el historial en un solo bloque.
    const promptCompleto = mensajes.map(m => (m.role === 'assistant' ? 'ASISTENTE: ' : 'ABOGADO: ') + m.content).join('\n\n');
    const respuesta = (await _iaLlamar(promptCompleto, 2048, 0.4, 'redaccion')).trim();
    _escritoChatHistorial.push({ role: 'assistant', content: respuesta });

    const loadEl = document.getElementById(loadId);
    if (loadEl) loadEl.outerHTML = `<div style="background:var(--azul-l,#eef3ff);border:1px solid rgba(26,74,138,0.15);border-radius:8px 8px 8px 2px;padding:10px 14px;max-width:88%;font-size:0.76rem;line-height:1.75;color:var(--ink);white-space:pre-wrap;font-family:'JetBrains Mono',monospace;"><div style="font-size:0.55rem;color:var(--azul);font-weight:700;margin-bottom:6px;letter-spacing:0.1em;">✦ IA · ESCRITO GENERADO</div>${escHTML(respuesta)}</div>`;
  } catch(e) {
    const loadEl = document.getElementById(loadId);
    if (loadEl) loadEl.outerHTML = `<div style="background:var(--rojo-l);border-radius:8px;padding:10px 14px;font-size:0.72rem;color:var(--rojo);">⚠ Error: ${e.message}</div>`;
  }
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function _escritoCopiar() {
  // Copiar el último mensaje del asistente
  const ultimo = _escritoChatHistorial.filter(m => m.role === 'assistant').pop();
  if (!ultimo) { if(typeof toast==='function') toast('Sin contenido para copiar', 'err'); return; }
  navigator.clipboard.writeText(ultimo.content).then(() => {
    if(typeof toast==='function') toast('✓ Escrito copiado al portapapeles', 'ok');
  }).catch(() => {
    if(typeof toast==='function') toast('⚠ No se pudo copiar automáticamente', 'err');
  });
}


// ── Pre-Recibo (placeholder — implementación completa pendiente) ──
// ══════════════════════════════════════════════════════════════
// PRE-RECIBO — Sistema completo
// ══════════════════════════════════════════════════════════════

function _prR2Path() {
  return (window.SB_DESPACHO_ID || 'despacho') + '/pre_recibos/data.json';
}

async function _prGuardar() {
  if (!Array.isArray(D.preRecibos)) D.preRecibos = [];
  // 1) Supabase — fuente principal
  try { save(); } catch(e) { console.warn('[PreRecibo] Supabase error:', e); }
  // 2) R2 — respaldo permanente
  try {
    if (typeof window.subirR2 === 'function' && window.SB_DESPACHO_ID) {
      const json = JSON.stringify(D.preRecibos);
      const blob = new Blob([json], { type: 'application/json' });
      const file = new File([blob], 'data.json', { type: 'application/json' });
      await window.subirR2(file, _prR2Path(), 'expedientes');
    }
  } catch(e) { console.warn('[PreRecibo] R2 error:', e); }
}

async function _prCargarDesdeR2() {
  // Restaurar pre-recibos desde R2 si D.preRecibos está vacío
  if ((Array.isArray(D.preRecibos) && D.preRecibos.length > 0)) return;
  try {
    if (typeof window.descargarR2 === 'function' && window.SB_DESPACHO_ID) {
      const blob = await window.descargarR2(_prR2Path(), 'expedientes', true);
      if (blob && blob.size > 2) {
        const txt = await blob.text();
        const data = JSON.parse(txt);
        if (Array.isArray(data) && data.length > 0) {
          D.preRecibos = data;
          console.log('[PreRecibo] Restaurados desde R2:', data.length);
        }
      }
    }
  } catch(e) { /* Sin datos en R2 aún — normal */ }
}

function _prGetAll() {
  if (!Array.isArray(D.preRecibos)) D.preRecibos = [];
  return D.preRecibos;
}

function _prById(id) {
  return _prGetAll().find(p => p.id === id) || null;
}

function _prEstadoColor(pr) {
  const dias = Math.floor((Date.now() - new Date(pr.fechaInicio).getTime()) / 86400000);
  if (pr.estado === 'listo') return { color: '#1a7a3a', bg: '#e8f5ec', label: 'Listo para cobrar' };
  if (dias >= 15) return { color: '#c0161a', bg: '#fff0f0', label: dias + ' días sin anticipo' };
  if (dias >= 7)  return { color: '#9a6010', bg: '#fff8e8', label: dias + ' días sin anticipo' };
  return { color: '#1a4a8a', bg: '#eef3ff', label: dias === 0 ? 'Hoy' : dias + (dias===1?' día':' días') };
}

function _prTotalGastos(pr) {
  return (pr.gastos || []).reduce((s, g) => {
    const v = parseFloat(g.monto);
    return s + (isNaN(v) ? 0 : v);
  }, 0);
}

// ── Abrir panel principal Pre-Recibo ──
async function abrirPreRecibo() {
  ir('pre-recibo');
}

// Inicializar panel cuando ir() lo activa
async function _prInicializarPanel() {
  await _prCargarDesdeR2();
  _prRenderLista();
}

// Nuevo pre-recibo desde botón del panel
function _prNuevo() {
  _prAbrirFormulario(null);
}


// ── Volver a lista y restaurar botón ──
function _prVolverLista() {
  const btn = document.getElementById('pr-btn-generar');
  if (btn) btn.textContent = '＋ Generar Pre-Recibo';
  _prRenderLista();
}

// ── Renderizar lista de pre-recibos ──
function _prRenderLista() {
  // Restaurar texto del botón
  const btn = document.getElementById('pr-btn-generar');
  if (btn) btn.textContent = '＋ Generar Pre-Recibo';
  const el = document.getElementById('pr-panel-contenido');
  const badge = document.getElementById('pr-badge-count');
  if (!el) return;
  const lista = _prGetAll().filter(p => !p.convertido);
  if (badge) badge.textContent = lista.length + (lista.length === 1 ? ' pendiente' : ' pendientes');

  if (!lista.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:0.78rem;line-height:1.8;">Sin pre-recibos activos.<br>Usa <strong>＋ Generar Pre-Recibo</strong> para comenzar.</div>';
    return;
  }

  // Ordenar: listos primero, luego por antigüedad desc
  const ordenados = [...lista].sort((a, b) => {
    if (a.estado === 'listo' && b.estado !== 'listo') return -1;
    if (b.estado === 'listo' && a.estado !== 'listo') return 1;
    return new Date(b.fechaInicio) - new Date(a.fechaInicio);
  });

  el.innerHTML = ordenados.map(pr => {
    const est = _prEstadoColor(pr);
    const totalGastos = _prTotalGastos(pr);
    const iniciales = (pr.nombre || '?').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    const nGastos = (pr.gastos || []).length;
    const estadoLabel = pr.estado === 'proceso' ? 'En proceso' : pr.estado === 'listo' ? 'Listo' : 'Iniciado';
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border-l);border-radius:8px;margin-bottom:8px;cursor:pointer;transition:border-color 0.15s;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border-l)'" onclick="_prAbrirFormulario('${pr.id}')">
      <div style="width:36px;height:36px;border-radius:50%;background:${est.bg};display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:${est.color};flex-shrink:0;">${iniciales}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.8rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHTML(pr.nombre)}</div>
        <div style="font-size:0.65rem;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHTML(pr.concepto || '—')}</div>
        <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
          <span style="font-size:0.58rem;padding:1px 7px;border-radius:10px;background:${est.bg};color:${est.color};">${est.label}</span>
          <span style="font-size:0.58rem;padding:1px 7px;border-radius:10px;background:var(--surface2);color:var(--muted);">${nGastos} ${nGastos===1?'gasto':'gastos'}</span>
          ${pr.estado ? `<span style="font-size:0.58rem;padding:1px 7px;border-radius:10px;background:rgba(26,74,138,0.08);color:var(--azul);">${estadoLabel}</span>` : ''}
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:0.78rem;font-weight:700;color:var(--gold-d);font-family:'JetBrains Mono',monospace;">$${(totalGastos + (parseFloat(pr.honorarios)||0)).toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
        <div style="font-size:0.55rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;">Deuda total</div>
        ${totalGastos > 0 ? `<div style="font-size:0.6rem;color:var(--muted);">Gastos $${totalGastos.toLocaleString('es-MX',{minimumFractionDigits:2})}</div>` : ''}
        ${pr.honorarios ? `<div style="font-size:0.6rem;color:var(--muted);">Hon. $${parseFloat(pr.honorarios).toLocaleString('es-MX',{minimumFractionDigits:2})}</div>` : ''}
      </div>
      <button onclick="event.stopPropagation();_prConvertirARecibo('${pr.id}')" style="padding:6px 12px;border-radius:5px;border:1.5px solid #2a7a3a;background:none;color:#4dca6a;font-size:0.62rem;font-family:'JetBrains Mono',monospace;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;white-space:nowrap;font-weight:700;" title="Convertir a recibo oficial">Cobrar</button>
    </div>`;
  }).join('');
}

// ── Abrir formulario de pre-recibo (nuevo o editar) ──
function _prAbrirFormulario(id) {
  const esNuevo = !id;
  // Cambiar texto del botón header
  const _btnGen = document.getElementById('pr-btn-generar');
  if (_btnGen) _btnGen.textContent = '＋ Generar Otro Pre-Recibo';
  const pr = esNuevo ? {
    id: 'PR-' + Date.now(),
    nombre: '', telefono: '', concepto: '', honorarios: '',
    fechaInicio: new Date().toISOString().slice(0,10),
    estado: 'iniciado', notas: '', gastos: [], juicioId: null
  } : _prById(id);
  if (!pr) return;

  const wrap = document.getElementById('pr-panel-contenido');
  if (!wrap) return;

  // Juicios disponibles para vincular
  const juiciosOpts = (D.juicios || []).map((j, i) =>
    `<option value="${i}" ${pr.juicioId == i ? 'selected' : ''}>${escHTML(j.cliente || j.nombre || 'Juicio ' + (i+1))}</option>`
  ).join('');

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
      <button onclick="_prVolverLista()" style="font-size:0.68rem;padding:4px 10px;border:1px solid var(--border-l);border-radius:5px;background:none;color:var(--muted);cursor:pointer;">← Volver</button>
      <span style="font-size:0.8rem;font-weight:700;color:var(--ink);">${esNuevo ? 'Nuevo Pre-Recibo' : 'Editar Pre-Recibo'}</span>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div>
        <label style="font-size:0.6rem;color:var(--muted);display:block;margin-bottom:3px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.08em;">Nombre del cliente *</label>
        <input id="pr-f-nombre" type="text" value="${escHTML(pr.nombre)}" placeholder="Nombre completo" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.76rem;background:var(--surface2);color:var(--ink);">
      </div>
      <div>
        <label style="font-size:0.6rem;color:var(--muted);display:block;margin-bottom:3px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.08em;">Teléfono</label>
        <input id="pr-f-tel" type="text" value="${escHTML(pr.telefono)}" placeholder="000-000-0000" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.76rem;background:var(--surface2);color:var(--ink);">
      </div>
    </div>
    <div style="margin-bottom:10px;">
      <label style="font-size:0.6rem;color:var(--muted);display:block;margin-bottom:3px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.08em;">Concepto del trámite *</label>
      <input id="pr-f-concepto" type="text" value="${escHTML(pr.concepto)}" placeholder="Descripción del servicio" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.76rem;background:var(--surface2);color:var(--ink);">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
      <div>
        <label style="font-size:0.6rem;color:var(--muted);display:block;margin-bottom:3px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.08em;">Honorarios estimados</label>
        <input id="pr-f-honorarios" type="number" value="${pr.honorarios||''}" placeholder="$0.00" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.76rem;background:var(--surface2);color:var(--ink);">
      </div>
      <div>
        <label style="font-size:0.6rem;color:var(--muted);display:block;margin-bottom:3px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.08em;">Estado</label>
        <select id="pr-f-estado" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.76rem;background:var(--surface2);color:var(--ink);">
          <option value="iniciado" ${pr.estado==='iniciado'?'selected':''}>Iniciado</option>
          <option value="proceso" ${pr.estado==='proceso'?'selected':''}>En proceso</option>
          <option value="listo" ${pr.estado==='listo'?'selected':''}>Listo para cobrar</option>
        </select>
      </div>
      <div>
        <label style="font-size:0.6rem;color:var(--muted);display:block;margin-bottom:3px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.08em;">Vincular a juicio</label>
        <select id="pr-f-juicio" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.76rem;background:var(--surface2);color:var(--ink);">
          <option value="">— Sin juicio —</option>
          ${juiciosOpts}
        </select>
      </div>
    </div>
    <div style="margin-bottom:12px;">
      <label style="font-size:0.6rem;color:var(--muted);display:block;margin-bottom:3px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.08em;">Notas internas (no aparecen en el recibo)</label>
      <textarea id="pr-f-notas" rows="5" placeholder="Observaciones, pendientes, seguimientos..." style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.72rem;background:var(--surface2);color:var(--ink);resize:none;font-family:sans-serif;">${escHTML(pr.notas||'')}</textarea>
    </div>

    <!-- GASTOS -->
    <div style="border:1px solid var(--border-l);border-radius:8px;padding:12px 14px;margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:0.65rem;font-weight:700;color:var(--muted);font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:0.1em;">Gastos registrados</span>
        <button onclick="_prAgregarGastoUI('${pr.id}')" style="font-size:0.62rem;padding:4px 10px;border:1px solid var(--border-l);border-radius:5px;background:none;color:var(--muted);cursor:pointer;font-family:'JetBrains Mono',monospace;">＋ Agregar gasto</button>
      </div>
      <div id="pr-gastos-lista-${pr.id}" style="display:flex;flex-direction:column;gap:6px;"></div>
      <div id="pr-gastos-total-${pr.id}" style="text-align:right;margin-top:8px;font-size:0.72rem;color:var(--muted);font-family:'JetBrains Mono',monospace;"></div>
    </div>

    <div style="display:flex;gap:8px;align-items:center;">
      <button onclick="_prGuardarFormulario('${pr.id}', ${esNuevo})" style="flex:1;padding:9px;border-radius:6px;border:1.5px solid var(--gold);background:rgba(200,149,42,0.08);color:var(--gold-d);font-size:0.72rem;font-weight:700;cursor:pointer;font-family:'JetBrains Mono',monospace;letter-spacing:0.08em;text-transform:uppercase;">💾 Guardar</button>
      <button onclick="_prImprimirEstadoCuenta('${pr.id}')" style="flex:1;padding:9px;border-radius:6px;border:1px solid var(--border-l);background:none;color:var(--muted);font-size:0.72rem;cursor:pointer;font-family:'JetBrains Mono',monospace;letter-spacing:0.08em;text-transform:uppercase;">🖨 Estado de cuenta</button>
      <button onclick="_prConvertirARecibo('${pr.id}')" style="flex:1;padding:9px;border-radius:6px;border:1.5px solid #2a7a3a;background:none;color:#4dca6a;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:'JetBrains Mono',monospace;letter-spacing:0.08em;text-transform:uppercase;">✓ Convertir a Recibo</button>
      ${!esNuevo ? `<button onclick="_prEliminar('${pr.id}')" style="padding:9px 12px;border-radius:6px;border:1px solid rgba(192,22,26,0.3);background:none;color:var(--rojo);font-size:0.72rem;cursor:pointer;" title="Eliminar pre-recibo">🗑</button>` : ''}
    </div>`;

  // Renderizar gastos existentes
  _prRenderGastos(pr);
}

// ── Renderizar lista de gastos en el formulario ──
function _prRenderGastos(pr) {
  const el = document.getElementById('pr-gastos-lista-' + pr.id);
  const totEl = document.getElementById('pr-gastos-total-' + pr.id);
  if (!el) return;
  const gastos = pr.gastos || [];
  if (!gastos.length) {
    el.innerHTML = '<div style="font-size:0.65rem;color:var(--muted);padding:8px 0;text-align:center;">Sin gastos registrados aún</div>';
  } else {
    el.innerHTML = gastos.map((g, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface2);border-radius:6px;">
        <span style="font-size:0.7rem;color:var(--ink);flex:1;">${escHTML(g.concepto||g.descripcion||'—')}</span>
        ${g.descripcion ? `<span style="font-size:0.65rem;color:var(--muted);flex:0.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHTML(g.descripcion)}</span>` : ''}
        <span style="font-size:0.65rem;color:var(--muted);font-family:'JetBrains Mono',monospace;white-space:nowrap;">${g.fecha||''}</span>
        <span style="font-size:0.75rem;font-weight:600;color:var(--ink);font-family:'JetBrains Mono',monospace;min-width:80px;text-align:right;">$${parseFloat(g.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
        <button onclick="_prEliminarGasto('${pr.id}', ${i})" style="font-size:0.8rem;background:none;border:none;cursor:pointer;color:var(--rojo);padding:2px 4px;" title="Eliminar gasto">🗑</button>
      </div>`).join('');
  }
  const total = _prTotalGastos(pr);
  if (totEl) {
    const _hon = parseFloat(pr.honorarios) || 0;
    const _deuda = total + _hon;
    totEl.innerHTML = (gastos.length || _hon > 0)
      ? (gastos.length ? `Total gastos: <strong style="color:var(--ink);">$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</strong> &nbsp;·&nbsp; ` : '')
        + `Deuda total (gastos + honorarios): <strong style="color:var(--gold-d);">$${_deuda.toLocaleString('es-MX',{minimumFractionDigits:2})}</strong>`
      : '';
  }
}

// ── Agregar gasto inline ──
function _prAgregarGastoUI(prId) {
  const el = document.getElementById('pr-gastos-lista-' + prId);
  if (!el) return;
  // Crear fila de entrada
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(200,149,42,0.06);border:1px dashed var(--gold);border-radius:6px;';
  row.innerHTML = `
    <input id="pr-ng-concepto" type="text" placeholder="Concepto" style="flex:1;padding:5px 8px;border:1px solid var(--border-l);border-radius:4px;font-size:0.7rem;background:var(--surface);color:var(--ink);">
    <input id="pr-ng-desc" type="text" placeholder="Descripción (opcional)" style="flex:1.5;padding:5px 8px;border:1px solid var(--border-l);border-radius:4px;font-size:0.7rem;background:var(--surface);color:var(--ink);">
    <input id="pr-ng-fecha" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:120px;padding:5px 8px;border:1px solid var(--border-l);border-radius:4px;font-size:0.7rem;background:var(--surface);color:var(--ink);">
    <input id="pr-ng-monto" type="number" placeholder="$0.00" onfocus="this.select()" style="width:90px;padding:5px 8px;border:1px solid var(--border-l);border-radius:4px;font-size:0.7rem;background:var(--surface);color:var(--ink);">
    <button onclick="_prConfirmarGasto('${prId}')" style="padding:5px 10px;border-radius:4px;border:1px solid #2a7a3a;background:none;color:#4dca6a;font-size:0.7rem;cursor:pointer;font-weight:700;">✓</button>
    <button onclick="this.parentNode.remove()" style="padding:5px 8px;border-radius:4px;border:1px solid var(--border-l);background:none;color:var(--muted);font-size:0.7rem;cursor:pointer;">✕</button>`;
  el.appendChild(row);
  document.getElementById('pr-ng-desc').focus();
}

function _prConfirmarGasto(prId) {
  const concepto = (document.getElementById('pr-ng-concepto') || {}).value || '';
  const desc     = (document.getElementById('pr-ng-desc')     || {}).value || '';
  const fecha    = (document.getElementById('pr-ng-fecha')    || {}).value || '';
  const monto    = parseFloat((document.getElementById('pr-ng-monto') || {}).value) || 0;
  if (!concepto.trim() || monto <= 0) { if(typeof toast==='function') toast('⚠ Ingresa concepto y monto', 'err'); return; }
  let pr = _prById(prId);
  if (!pr) {
    if (!Array.isArray(D.preRecibos)) D.preRecibos = [];
    pr = { id: prId, nombre: '', telefono: '', concepto: '', honorarios: 0,
           estado: 'iniciado', notas: '', juicioId: null,
           fechaInicio: new Date().toISOString().slice(0,10),
           gastos: [], convertido: false };
    D.preRecibos.push(pr);
  }
  if (!Array.isArray(pr.gastos)) pr.gastos = [];
  pr.gastos.push({ concepto: concepto.trim(), descripcion: desc.trim(), fecha, monto });
  _prGuardar();
  _prRenderGastos(pr);
  if(typeof toast==='function') toast('✓ Gasto agregado', 'ok');
}

function _prEliminarGasto(prId, idx) {
  const pr = _prById(prId);
  if (!pr || !pr.gastos) return;
  pr.gastos.splice(idx, 1);
  _prGuardar();
  _prRenderGastos(pr);
}

// ── Guardar formulario ──
function _prGuardarFormulario(prId, esNuevo) {
  // esNuevo puede llegar como string 'true'/'false' desde onclick HTML
  const _esNuevo = esNuevo === true || esNuevo === 'true';
  const nombre    = (document.getElementById('pr-f-nombre')    || {}).value || '';
  const telefono  = (document.getElementById('pr-f-tel')       || {}).value || '';
  const concepto  = (document.getElementById('pr-f-concepto')  || {}).value || '';
  const honorarios= (document.getElementById('pr-f-honorarios')|| {}).value || '';
  const estado    = (document.getElementById('pr-f-estado')    || {}).value || 'iniciado';
  const notas     = (document.getElementById('pr-f-notas')     || {}).value || '';
  const juicioIdx = (document.getElementById('pr-f-juicio')    || {}).value;

  if (!nombre.trim()) { if(typeof toast==='function') toast('⚠ El nombre es obligatorio', 'err'); return; }
  if (!concepto.trim()) { if(typeof toast==='function') toast('⚠ El concepto es obligatorio', 'err'); return; }

  if (!Array.isArray(D.preRecibos)) D.preRecibos = [];

  // Buscar si ya existe (puede existir si se guardaron gastos antes)
  const existente = _prById(prId);

  if (_esNuevo && !existente) {
    // Crear nuevo
    const nuevo = {
      id: prId,
      nombre: nombre.trim(), telefono: telefono.trim(),
      concepto: concepto.trim(), honorarios: parseFloat(honorarios) || 0,
      estado, notas: notas.trim(),
      juicioId: juicioIdx !== '' ? parseInt(juicioIdx) : null,
      fechaInicio: new Date().toISOString().slice(0,10),
      gastos: [], convertido: false
    };
    D.preRecibos.push(nuevo);
  } else if (existente) {
    // Actualizar existente (edición o nuevo con gastos ya agregados)
    existente.nombre     = nombre.trim();
    existente.telefono   = telefono.trim();
    existente.concepto   = concepto.trim();
    existente.honorarios = parseFloat(honorarios) || 0;
    existente.estado     = estado;
    existente.notas      = notas.trim();
    existente.juicioId   = juicioIdx !== '' ? parseInt(juicioIdx) : null;
  } else {
    // Fallback: crear con los datos aunque sea "edición" sin encontrar el ID
    const nuevo = {
      id: prId,
      nombre: nombre.trim(), telefono: telefono.trim(),
      concepto: concepto.trim(), honorarios: parseFloat(honorarios) || 0,
      estado, notas: notas.trim(),
      juicioId: juicioIdx !== '' ? parseInt(juicioIdx) : null,
      fechaInicio: new Date().toISOString().slice(0,10),
      gastos: [], convertido: false
    };
    D.preRecibos.push(nuevo);
  }
  _prGuardar();
  if(typeof toast==='function') toast('✓ Pre-Recibo guardado', 'ok');
  _prRenderLista();
}

// ── Eliminar pre-recibo ──
function _prEliminar(prId) {
  if (!confirm('¿Eliminar este pre-recibo? Esta acción no se puede deshacer.')) return;
  D.preRecibos = (D.preRecibos || []).filter(p => p.id !== prId);
  _prGuardar();
  if(typeof toast==='function') toast('Pre-Recibo eliminado', 'ok');
  _prRenderLista();
}

// ── Convertir a recibo oficial ──
function _prConvertirARecibo(prId) {
  const pr = _prById(prId);
  if (!pr) return;
  // Ir al panel de nuevo recibo (ir() limpia el formulario al entrar)
  if (typeof ir === 'function') ir('nuevo-recibo');
  // Esperar a que el panel de nuevo recibo esté listo y pre-llenar con selectores reales
  setTimeout(() => {
    try {
      // Vincular DESPUÉS de limpiarFormCompleto (que resetea este global).
      // El pre-recibo se marcará convertido SOLO cuando se genere el recibo
      // con el botón Imprimir/Generar — si el usuario se regresa sin generar,
      // el pre-recibo permanece intacto en la lista.
      window._prDatosParaRecibo = pr;
      // Nombre del cliente — primer input en #clientes-wrapper
      const elNombre = document.querySelector('#clientes-wrapper .cliente-row [id^="nombre_"]');
      if (elNombre) {
        elNombre.value = pr.nombre.toUpperCase();
        elNombre.dispatchEvent(new Event('input'));
      }
      // Teléfono móvil — primer movil_ en clientes-wrapper
      const elMovil = document.querySelector('#clientes-wrapper .cliente-row [id^="movil_"]');
      if (elMovil && pr.telefono) { elMovil.value = pr.telefono; }
      // ── Conceptos: UNA FILA por honorarios + UNA FILA por cada gasto ──
      const tbodyC = document.getElementById('conceptos-tbody');
      if (tbodyC) {
        tbodyC.innerHTML = '';
        if (typeof conceptoCount !== 'undefined') conceptoCount = 0;
        const filas = [];
        if (parseFloat(pr.honorarios) > 0) {
          filas.push({ concepto: pr.concepto || 'Honorarios', descripcion: 'Honorarios', precio: parseFloat(pr.honorarios) });
        }
        (pr.gastos || []).forEach(g => {
          filas.push({
            concepto: g.concepto || g.descripcion || 'Gasto',
            descripcion: (g.descripcion || '') + (g.fecha ? (g.descripcion ? ' · ' : '') + g.fecha : ''),
            precio: parseFloat(g.monto) || 0
          });
        });
        if (!filas.length) filas.push({ concepto: pr.concepto || '', descripcion: '', precio: 0 });
        filas.forEach(f => {
          if (typeof agregarConcepto === 'function') agregarConcepto();
          const tr = tbodyC.lastElementChild;
          if (!tr) return;
          const taC = tr.querySelector('textarea.concepto');    if (taC) taC.value = f.concepto;
          const taD = tr.querySelector('textarea.descripcion'); if (taD) taD.value = f.descripcion;
          const inP = tr.querySelector('input.precio');
          if (inP) {
            inP.value = f.precio > 0 ? String(f.precio) : '';
            if (typeof formatPrecio === 'function') try { formatPrecio(inP); } catch(e){}
          }
        });
        if (typeof calcTotales === 'function') calcTotales();
      }
      if(typeof toast==='function') toast('✓ Datos pre-llenados — verifica y genera el recibo', 'ok');
    } catch(e) { console.warn('[PreRecibo] Error pre-llenando:', e); }
  }, 700);
}

// ── Imprimir estado de cuenta ──
function _prImprimirEstadoCuenta(prId) {
  const pr = _prById(prId);
  if (!pr) return;
  const totalGastos = _prTotalGastos(pr);
  const hoy = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
  const gastosHtml = (pr.gastos||[]).length
    ? (pr.gastos||[]).map(g => `<tr><td style="padding:5px 8px;">${g.descripcion}</td><td style="padding:5px 8px;">${g.fecha||'—'}</td><td style="padding:5px 8px;text-align:right;">$${parseFloat(g.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>`).join('')
    : '<tr><td colspan="3" style="padding:8px;text-align:center;color:#999;">Sin gastos registrados</td></tr>';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Estado de Cuenta</title>
  <style>body{font-family:serif;max-width:600px;margin:30px auto;color:#1a1008;}h1{font-size:1rem;text-align:center;letter-spacing:0.2em;text-transform:uppercase;color:#8c6518;}table{width:100%;border-collapse:collapse;font-size:0.85rem;}th{background:#f5edd0;padding:6px 8px;text-align:left;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;}tr:nth-child(even){background:#fdfaf4;}.total{text-align:right;font-weight:bold;font-size:1rem;color:#8c6518;margin-top:10px;}.note{font-size:0.7rem;color:#999;margin-top:20px;text-align:center;border-top:1px solid #e0d5b0;padding-top:10px;}</style>
  </head><body>
  <h1>LEX-MÉXICO · Despacho Jurídico</h1>
  <p style="text-align:center;font-size:0.8rem;color:#666;">Estado de cuenta preliminar — ${hoy}</p>
  <hr style="border-color:#e0d5b0;">
  <table><tr><td style="padding:4px 0;"><strong>Cliente:</strong></td><td>${escHTML(pr.nombre)}</td></tr>
  <tr><td style="padding:4px 0;"><strong>Trámite:</strong></td><td>${escHTML(pr.concepto)}</td></tr>
  <tr><td style="padding:4px 0;"><strong>Inicio:</strong></td><td>${pr.fechaInicio||'—'}</td></tr>
  ${pr.honorarios ? `<tr><td style="padding:4px 0;"><strong>Honorarios:</strong></td><td>$${parseFloat(pr.honorarios).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>` : ''}</table>
  <br><table><thead><tr><th>Descripción</th><th>Fecha</th><th>Monto</th></tr></thead><tbody>${gastosHtml}</tbody></table>
  <p class="total">Total gastos acumulados: $${totalGastos.toLocaleString('es-MX',{minimumFractionDigits:2})}</p>
  <p class="total">Total de la deuda: $${(totalGastos + (parseFloat(pr.honorarios)||0)).toLocaleString('es-MX',{minimumFractionDigits:2})}</p>
  <p class="note">Este documento es informativo y no constituye un recibo oficial.<br>LEX-MÉXICO · Santiago Juxtlahuaca, Oaxaca · 953 128 7511</p>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
}

// ── Redactar escrito ──────────────────────────────────────────
function abrirModalEscrito(){
  const j = D.juicios[_mexpIdx];
  const activas = j ? (j.leyesActivas||[]) : [];
  const chips = $('escrito-leyes-chips');
  if(activas.length){
    chips.innerHTML = activas.map(n=>`<span style="font-size:0.65rem;padding:3px 9px;border-radius:20px;background:var(--azul-l);color:var(--azul);border:1px solid rgba(26,74,138,0.2);">${escHTML(n.length>24?n.substring(0,24)+'…':n)}</span>`).join('');
  } else {
    chips.innerHTML = '<span style="font-size:0.68rem;color:var(--muted);font-style:italic;">Sin leyes seleccionadas — ve a «Leyes del caso» primero</span>';
  }
  $('escrito-instrucciones').value = '';
  $('modal-redactar-escrito').style.display = 'flex';
}

function cerrarModalEscrito(){
  $('modal-redactar-escrito').style.display = 'none';
}

async function generarEscritorIA(){
  const j = D.juicios[_mexpIdx];
  if(!j){ cerrarModalEscrito(); return; }
  const tipo  = $('escrito-tipo-sel').value;
  const tipos = { demanda:'escrito de demanda inicial', contestacion:'contestación de demanda', apelacion:'recurso de apelación', amparo:'amparo indirecto', pruebas:'escrito de ofrecimiento de pruebas', alegatos:'alegatos', promocion:'promoción general' };
  const leyes = (j.leyesActivas||[]).join(', ') || 'sin leyes específicas';
  const inst  = $('escrito-instrucciones').value.trim();
  const prompt = 'Redacta un ' + (tipos[tipo]||tipo) + ' para el expediente de ' + (j.cliente||'el cliente') +
    ', ' + (j.tipo||'') + ', Exp. ' + (j.expediente||'s/n') + ', ' + (j.juzgado||'') +
    '. Leyes aplicables: ' + leyes + '.' + (inst ? ' Instrucciones adicionales: ' + inst : '') +
    ' Usa formato jurídico mexicano formal y cita el artículo exacto de las leyes activas al fundamentar cada punto.';
  cerrarModalEscrito();
  _agregarMensajeIA('Redacta: ' + (tipos[tipo]||tipo), 'user');
  await _llamarGeminiIAConLeyes(j, prompt);
}

// ── Grounding: leer el texto real de las leyes activas del caso ────────
// Antes estas funciones solo mandaban a la IA el NOMBRE de las leyes
// ("Leyes activas: X, Y, Z"), nunca su contenido — por eso las respuestas
// (fundamentos, artículos, plazos) salían de conocimiento general de la IA,
// no de las leyes realmente cargadas para el caso. Ahora se descarga y lee
// (OCR) el PDF de cada ley activa y se manda su texto como fuente única y
// obligatoria, igual que ya se hacía en "Generar Flujo con ley".
window._analisisIACache = window._analisisIACache || {};
async function _obtenerTextoLeyesActivas(j, onProgreso){
  const nombres = (j && j.leyesActivas) || [];
  if (!nombres.length) return '';
  const leyesKey = nombres.slice().sort().join('|');
  const cacheKey = (j.id || j.expediente || _mexpIdx) + '::' + leyesKey;
  const cache = window._analisisIACache[cacheKey];
  if (cache && (Date.now() - cache.ts) < 30 * 60 * 1000) return cache.texto; // 30 min

  const cfaiOk = !!(_cfaiGetAccountId() && _cfaiGetToken());
  // Con Cloudflare (contexto largo, 128K tokens) se puede dar bastante texto
  // por ley; sin él, Groq tiene un límite REAL de 8,000 tokens por petición
  // (ver _groqLlamar) y solo alcanza un extracto muy chico repartido entre
  // las leyes activas.
  const limitePorLey = cfaiOk ? 26000 : Math.max(800, Math.floor(3000 / nombres.length));
  const todasLeyes = getLeyesDespacho();
  let texto = '';
  for (const nombre of nombres) {
    const ley = todasLeyes.find(l => l.nombre === nombre);
    if (!ley || !ley.driveFileId) continue;
    try {
      if (onProgreso) onProgreso('📖 Leyendo «' + nombre + '»…');
      const token = await driveGetAccessToken();
      if (!token) continue;
      const resp = await fetch('https://www.googleapis.com/drive/v3/files/' + ley.driveFileId + '?alt=media', { headers: { Authorization: 'Bearer ' + token } });
      if (!resp.ok) continue;
      const blob = await resp.blob();
      if (blob.size > 30 * 1024 * 1024) continue;
      const file = new File([blob], nombre + '.pdf', { type: 'application/pdf' });
      const ocrRes = await _leyExtraerTexto(file, onProgreso || (()=>{}));
      if (ocrRes && ocrRes.texto) {
        const t = ocrRes.texto.length > limitePorLey ? ocrRes.texto.slice(0, limitePorLey) + '\n[…texto recortado por longitud…]' : ocrRes.texto;
        texto += '\n\n=== TEXTO DE LA LEY: ' + nombre + ' ===\n' + t;
      }
    } catch(e){ console.warn('[IA] No se pudo leer la ley "' + nombre + '":', e.message); }
  }
  if (texto) window._analisisIACache[cacheKey] = { texto, ts: Date.now() };
  return texto;
}

// Llama a la IA anteponiendo el texto de las leyes activas como fuente única
// y obligatoria. Si el texto es grande y Cloudflare (contexto largo) está
// configurado, se usa directo — Groq no podría con textos así de grandes.
async function _iaLlamarGrounded(promptBase, textoLeyes, maxTokens, temperatura, perfil){
  if (!textoLeyes) return _iaLlamar(promptBase, maxTokens, temperatura, perfil);
  const promptFinal = promptBase +
    '\n\nFUNDAMENTO LEGAL — TEXTO DE LAS LEYES ACTIVAS DEL CASO (fuente única y obligatoria para citar artículos, plazos y datos exactos; usa comillas al citar; si un dato no aparece en este texto dilo explícitamente — NUNCA lo inventes):' +
    textoLeyes;
  const cfaiOk = !!(_cfaiGetAccountId() && _cfaiGetToken());
  if (cfaiOk) {
    try { return await _cfaiLlamarContextoLargo(promptFinal, maxTokens, temperatura, perfil); }
    catch(e){
      console.warn('[IA] Cloudflare (contexto largo) falló (' + e.message + '); intentando con Groq...');
      if (/CFAI_LIMITE/.test(e.message || '') && typeof toast === 'function') {
        toast('⚠ Cloudflare agotó su cupo gratis de hoy — esta respuesta salió con Groq (menos detalle). Se renueva a medianoche UTC.', 'err');
      }
    }
  }
  return _iaLlamar(promptFinal, maxTokens, temperatura, perfil);
}

// Igual que _llamarGeminiIA pero primero lee las leyes activas del caso y
// las manda como fundamento — usado por el chat de "ANÁLISIS IA".
async function _llamarGeminiIAConLeyes(j, prompt){
  const loadingEl = _agregarMensajeIA('📖 Leyendo las leyes del caso...', 'assistant');
  try{
    const textoLeyes = await _obtenerTextoLeyesActivas(j, (msg) => { if (loadingEl) loadingEl.textContent = msg; });
    if (loadingEl) loadingEl.textContent = '⏳ Analizando...';
    const texto = (await _iaLlamarGrounded(prompt, textoLeyes, 2048, 0.3, 'consulta')).trim() || 'Sin respuesta.';
    if (loadingEl) loadingEl.textContent = texto;
    return texto;
  } catch(e){
    if (loadingEl) loadingEl.textContent = 'Error: ' + e.message;
    return '';
  }
}

// ── IA — Análisis de expediente ─────────────────────────────────
async function analizarExpedienteIA(){
  const j = D.juicios[_mexpIdx];
  if(!j) return;
  const hist = (j.historial||[]).map(h=>`[${h.fecha} - ${h.tipo}]: ${h.texto}`).join('\n') || 'Sin historial';
  const leyes = (j.leyesActivas||[]).join(', ') || 'Sin leyes específicas';
  const prompt = 'Analiza este expediente jurídico y proporciona un resumen ejecutivo:\n' +
    'Cliente: ' + (j.cliente||'—') + '\nTipo: ' + (j.tipo||'—') + '\nExpediente: ' + (j.expediente||'—') +
    '\nJuzgado: ' + (j.juzgado||'—') + '\nEstatus: ' + (j.estatus||'—') + '\nAudiencia: ' + (j.audiencia||'—') +
    '\nLeyes activas: ' + leyes + '\nHistorial:\n' + hist +
    '\n\nIncluye: resumen ejecutivo, estado procesal actual, riesgos, próximos pasos recomendados. Fundamenta cada punto citando el artículo exacto de las leyes activas del caso. Responde en español.';
  $('mexp-ia-resumen').textContent = '⏳ Analizando...';
  const textoLeyes = await _obtenerTextoLeyesActivas(j, (msg) => { $('mexp-ia-resumen').textContent = msg; });
  $('mexp-ia-resumen').textContent = '⏳ Analizando...';
  const resultado = await _iaLlamarGrounded(prompt, textoLeyes, 2048, 0.3, 'consulta');
  $('mexp-ia-resumen').textContent = resultado || 'No se obtuvo respuesta.';
}

function preguntaRapidaIA(tipo){
  const j = D.juicios[_mexpIdx];
  if(!j){ if(typeof toast==='function') toast('Abre un expediente primero', 'err'); return; }
  const prompts = {
    argumentos: 'Para el caso de ' + (j.cliente||'el cliente') + ' (' + (j.tipo||'') + '), ¿cuáles son los argumentos jurídicos más sólidos? Leyes activas: ' + (j.leyesActivas||[]).join(', ') + '. Fundamenta cada argumento citando el artículo exacto de las leyes activas del caso.',
    riesgos: 'Analiza los riesgos procesales del expediente de ' + (j.cliente||'el cliente') + '. Estatus: ' + (j.estatus||'—') + '. Historial: ' + (j.historial||[]).map(h=>h.texto).join('; ') + '. Fundamenta cada riesgo citando el artículo exacto de las leyes activas del caso.',
    'resumen-cliente': 'Redacta un resumen en lenguaje sencillo (no técnico) del estado actual del caso de ' + (j.cliente||'el cliente') + ' para presentar al cliente. Tipo: ' + (j.tipo||'—') + '. Estatus: ' + (j.estatus||'—')
  };
  const labels = { argumentos:'Argumentos clave', riesgos:'Análisis de riesgos', 'resumen-cliente':'Resumen para cliente' };
  _agregarMensajeIA(labels[tipo]||tipo, 'user');
  _llamarGeminiIAConLeyes(j, prompts[tipo]||tipo);
}

async function enviarPreguntaIA(){
  const input = $('mexp-ia-input');
  const texto = input.value.trim();
  if(!texto) return;
  input.value = '';
  const j = D.juicios[_mexpIdx];
  const contexto = j ? 'Contexto del expediente: ' + (j.cliente||'') + ', ' + (j.tipo||'') + ', Exp. ' + (j.expediente||'') + '. ' : '';
  _agregarMensajeIA(texto, 'user');
  if (j) {
    await _llamarGeminiIAConLeyes(j, contexto + texto + ' Fundamenta tu respuesta citando el artículo exacto de las leyes activas del caso cuando aplique.');
  } else {
    await _llamarGeminiIA(contexto + texto);
  }
}

function _agregarMensajeIA(texto, rol){
  const chat = $('mexp-ia-chat');
  if(!chat) return;
  const isUser = rol === 'user';
  const div = document.createElement('div');
  div.style.cssText = 'padding:8px 10px;border-radius:var(--radius-sm);font-size:0.74rem;line-height:1.6;' +
    (isUser ? 'background:var(--azul-l);color:var(--azul);align-self:flex-end;max-width:90%;' : 'background:var(--surface2);color:var(--ink);border:1px solid var(--border-l);');
  div.textContent = texto;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

async function _llamarGeminiIA(prompt){
  const loadingEl = _agregarMensajeIA('⏳ Analizando...', 'assistant');
  try{
    const texto = (await _iaLlamar(prompt, 2048, 0.3, 'consulta')).trim() || 'Sin respuesta.';
    if(loadingEl) loadingEl.textContent = texto;
    return texto;
  } catch(e){
    if(loadingEl) loadingEl.textContent = 'Error: ' + e.message;
    return '';
  }
}

async function _llamarGeminiIADirecto(prompt){
  try{
    return (await _iaLlamar(prompt, 2048, 0.3, 'consulta')).trim() || 'Sin respuesta.';
  } catch(e){ return 'Error: ' + e.message; }
}

// ── R2 eliminar helper (si no existe) ─────────────────────────
if(typeof window.eliminarR2 === 'undefined'){
  window.eliminarR2 = async function(path, bucket){
    try{
      const res = await fetch(R2_WORKER + '/r2/delete?bucket=' + encodeURIComponent(bucket||'juicios'), {
        method: 'DELETE',
        headers: { 'X-Auth-Token': await _r2AuthToken() },
        body: JSON.stringify({ path })
      });
      return res.ok;
    } catch(e){ console.error('eliminarR2:', e); return false; }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SCANSYS v2 — powered by window.LEX_ERRORS
// Monitor de errores en tiempo real, robusto, sin lógica redundante con LEX_ERRORS
// ══════════════════════════════════════════════════════════════════════════════
(function(){

  /* ── Asegurar que LEX_ERRORS existe ──────────────────────────────────── */
  if(!Array.isArray(window.LEX_ERRORS)) window.LEX_ERRORS = [];

  /* ── Estado del monitor (el panel viejo se eliminó — solo queda el
     intervalo del monitor periódico de abajo) ─────────────────────────── */
  const SS = window._scansys = {
    _interval: null
  };

  /* ── Interceptar console.warn y console.error → LEX_ERRORS ──────────── */
  // Capturar nativos ANTES de cualquier reemplazo
  const _NAT = {
    error: console.error.bind(console),
    warn:  console.warn.bind(console)
  };
  window.__ssOrigConsole = _NAT;

  function _interceptar(){
    // Idempotente: antes se llamaba solo desde scansysInit(), pero ahora también
    // se instala de inmediato al cargar, así que hay que evitar envolver la
    // consola dos veces (se duplicarían todas las entradas).
    if(window.__ssInterceptado) return;
    window.__ssInterceptado = true;
    ['error','warn'].forEach(function(nivel){
      console[nivel] = function(){
        _NAT[nivel].apply(console, arguments);
        const txt = Array.from(arguments).map(function(a){
          if(a instanceof Error) return a.message;
          try{ return typeof a==='object'&&a?JSON.stringify(a).slice(0,400):String(a); }catch(e){ return '[no serializable]'; }
        }).join(' ');
        // Determinar stack
        let stack = null;
        for(let i=0;i<arguments.length;i++){
          if(arguments[i] instanceof Error && arguments[i].stack){ stack=arguments[i].stack; break; }
        }
        _lexPush(nivel==='error'?'error':'warn', 'console.'+nivel, txt, stack);
      };
    });
    window.addEventListener('error', function(ev){
      _lexPush('error','window.error',
        ev.message + ' — ' + (ev.filename||'').split('/').pop() + ':' + ev.lineno,
        ev.error ? ev.error.stack : null,
        { linea: ev.lineno, col: ev.colno, archivo: ev.filename }
      );
    });
    window.addEventListener('unhandledrejection', function(ev){
      const r = ev.reason;
      _lexPush('error','Promise.rejection',
        r instanceof Error ? r.message : String(r),
        r instanceof Error ? r.stack   : null
      );
    });
  }

  /* ── Push a LEX_ERRORS con dedup por mensaje+módulo en ventana de 2s ── */
  function _lexPush(nivel, modulo, mensaje, stack, extra){
    const ahora = Date.now();
    // Dedup: ignorar si el mismo módulo+mensaje llegó hace menos de 2s
    const ultimo = window.LEX_ERRORS[window.LEX_ERRORS.length - 1];
    if(ultimo && ultimo.modulo===modulo && ultimo.mensaje===mensaje && (ahora-new Date(ultimo.fecha).getTime())<2000) return;

    const entry = {
      fecha:   new Date().toISOString(),
      nivel:   nivel,           // 'error' | 'warn' | 'info'
      modulo:  String(modulo||'').slice(0,120),
      mensaje: String(mensaje||'').slice(0,800),
      stack:   stack ? String(stack).split('\n').slice(0,8).join('\n') : null,
      extra:   extra || null,
      // Snapshot del sistema en el momento del error
      snap: {
        recibos:   typeof appData!=='undefined'&&Array.isArray(appData.recibos) ? appData.recibos.length : null,
        movs:      typeof D!=='undefined'&&Array.isArray(D.movimientos) ? D.movimientos.length : null,
        supabase:  !!(window.SB && window.SB_DESPACHO_ID),
        usuario:   typeof empleadoActual!=='undefined'&&empleadoActual ? (empleadoActual.nombre||empleadoActual.email||'') : null,
        caja:      typeof cajaCerrada!=='undefined' ? cajaCerrada : null,
        panel:     (function(){ try{ return document.querySelector('.panel.active')?.id||null; }catch(e){ return null; } })()
      }
    };

    window.LEX_ERRORS.push(entry);
    if(window.LEX_ERRORS.length > 500) window.LEX_ERRORS.shift();

    // Actualizar badge sidebar
    _actualizarBadge();
  }
  // Exponer para que registrarError() también lo use
  window._lexPush = _lexPush;

  /* ── Parche sobre registrarError() para que también alimente LEX_ERRORS ─ */
  // registrarError ya existe en el código principal — lo envolvemos
  const _registrarErrorOrig = window.registrarError;
  window.registrarError = function(modulo, error, extra){
    if(typeof _registrarErrorOrig === 'function') _registrarErrorOrig(modulo, error, extra);
    const msg = error instanceof Error ? error.message : String(error||'');
    const stk = error instanceof Error ? error.stack   : null;
    _lexPush('error', modulo, msg, stk, extra||{});
  };

  /* ── Badge en sidebar ────────────────────────────────────────────────── */
  function _actualizarBadge(){
    const b = document.getElementById('scansys-badge');
    if(!b) return;
    const n = window.LEX_ERRORS.filter(function(e){ return e.nivel==='error'; }).length;
    if(n>0){ b.style.display='inline-flex'; b.textContent=n>99?'99+':n; }
    else { b.style.display='none'; }
  }

  /* ── CHECADOR: clasificación robusta (sirve tanto para entradas nuevas, que
     ya traen entradaMinutos, como para entradas viejas guardadas antes de este
     fix, que solo traen el texto "inicio" tipo "12:09 a.m.") ──────────────── */
  function _checadorParseHora(str){
    const m = /^(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i.exec(String(str||'').trim());
    if(!m) return null;
    let h = parseInt(m[1],10);
    const min = parseInt(m[2],10);
    if(m[3].toLowerCase()==='a'){ if(h===12) h=0; } else { if(h!==12) h+=12; }
    return h*60+min;
  }
  function _checadorClasificar(e){
    // Domingo no es día laboral: si hay una conexión (casi siempre porque se
    // le habilitó tiempo extra a la empleada para que revise pendientes de
    // la semana, no para "trabajar" el turno completo), SÍ se muestra en el
    // Checador, pero nunca cuenta como tardanza — un domingo no tiene "hora
    // de entrada oficial" contra la cual medir retraso.
    if(typeof e.dia === 'string' && e.dia.toLowerCase().startsWith('domingo')){
      return { estado:'domingo', minutosTarde:0 };
    }
    const mins = (typeof e.entradaMinutos === 'number') ? e.entradaMinutos : _checadorParseHora(e.inicio);
    if(mins == null) return { estado: e.estado||'—', minutosTarde: e.minutosTarde||0 };
    const inicio   = _minutosDeHHMM(HORARIO_CAPTURA_INICIO);
    const apertura = _minutosDeHHMM(HORARIO_APERTURA_SISTEMA);
    const fin      = _minutosDeHHMM(HORARIO_CAPTURA_FIN);
    if(mins < apertura || mins > fin) return { estado:'fuera_horario', minutosTarde:0 };
    const minutosTarde = Math.max(0, mins - inicio);
    const estado = mins > (inicio + TOLERANCIA_TARDANZA_MIN) ? 'tarde' : 'puntual';
    return { estado: estado, minutosTarde: estado==='tarde' ? minutosTarde : 0 };
  }
  function _checadorBadge(cl){
    if(cl.estado === 'tarde') return '<span style="background:rgba(192,22,26,0.1);color:#c0161a;padding:2px 8px;border-radius:4px;font-size:0.62rem;font-weight:700;">TARDE · '+cl.minutosTarde+' min</span>';
    if(cl.estado === 'puntual') return '<span style="background:rgba(26,122,58,0.1);color:#1a7a3a;padding:2px 8px;border-radius:4px;font-size:0.62rem;font-weight:700;">PUNTUAL</span>';
    if(cl.estado === 'domingo') return '<span title="Conexión en domingo (no es día laboral) — no cuenta como tardanza" style="background:rgba(26,74,138,0.1);color:#1a4a8a;padding:2px 8px;border-radius:4px;font-size:0.62rem;font-weight:700;">DOMINGO</span>';
    if(cl.estado === 'fuera_horario') return '<span title="Conexión fuera del horario 7:00 a. m.–5:30 p. m. — probablemente el administrador dando mantenimiento" style="background:rgba(120,120,120,0.12);color:#6a6250;padding:2px 8px;border-radius:4px;font-size:0.62rem;font-weight:700;">⚙ FUERA DE HORARIO</span>';
    return '<span style="color:#9a8050;font-size:0.62rem;">—</span>';
  }

  /* ── CHECADOR: tabla del día + resumen mensual de puntualidad ──────────── */
  async function _renderChecador(){
    const panel = document.getElementById('ss-body-checador');
    if(!panel) return;
    panel.innerHTML = '<div style="color:#7a6840;font-family:monospace;font-size:0.7rem;">Cargando checador...</div>';
    let log = [];
    try{ if(typeof cargarLogDiario==='function') log = await cargarLogDiario(); }catch(e){ log = []; }
    const ahora = new Date();
    const diaKeyHoy = ahora.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', weekday:'long', year:'numeric', month:'2-digit', day:'2-digit' });
    // Las conexiones fuera del horario 8:30–5:30 (mantenimiento del administrador)
    // no se muestran: no son asistencia real y solo confunden el Checador.
    const hoyEntries = log.filter(function(e){ return e.dia === diaKeyHoy && _checadorClasificar(e).estado !== 'fuera_horario'; });
    const mesActual  = ahora.getMonth();
    const anioActual = ahora.getFullYear();
    const resumenPorEmail = {};
    log.forEach(function(e){
      if(!e.ts) return;
      const d = new Date(e.ts);
      if(d.getMonth() !== mesActual || d.getFullYear() !== anioActual) return;
      const cl = _checadorClasificar(e);
      // Las conexiones fuera del horario 8:30–5:30 no son asistencia real
      // (mantenimiento del administrador): no se cuentan ni aparecen aquí.
      if(cl.estado === 'fuera_horario') return;
      if(!resumenPorEmail[e.email]) resumenPorEmail[e.email] = { nombre:e.nombre, dias:0, tardanzas:0, minutosTotal:0 };
      resumenPorEmail[e.email].dias++;
      if(cl.estado === 'tarde'){
        resumenPorEmail[e.email].tardanzas++;
        resumenPorEmail[e.email].minutosTotal += cl.minutosTarde;
      }
    });
    const filasHoy = hoyEntries.length ? hoyEntries.map(function(e){
      const cl = _checadorClasificar(e);
      return '<tr style="border-bottom:1px solid #ecdfa8;">'
        +'<td style="padding:8px 10px;">'+escHTML(e.nombre||e.email)+'</td>'
        +'<td style="padding:8px 10px;font-family:monospace;">'+escHTML(e.inicio||'—')+'</td>'
        +'<td style="padding:8px 10px;">'+_checadorBadge(cl)+'</td>'
        +'<td style="padding:8px 10px;font-family:monospace;color:#7a6840;">'+escHTML(e.cierre||'—')+'</td>'
        +'</tr>';
    }).join('') : '<tr><td colspan="4" style="padding:16px;text-align:center;color:#9a8050;">Sin conexiones registradas hoy</td></tr>';
    const filasResumen = Object.keys(resumenPorEmail).length ? Object.keys(resumenPorEmail).map(function(email){
      const r = resumenPorEmail[email];
      return '<tr style="border-bottom:1px solid #ecdfa8;">'
        +'<td style="padding:8px 10px;">'+escHTML(r.nombre||email)+'</td>'
        +'<td style="padding:8px 10px;text-align:center;">'+r.dias+'</td>'
        +'<td style="padding:8px 10px;text-align:center;color:'+(r.tardanzas>0?'#c0161a':'#1a7a3a')+';font-weight:700;">'+r.tardanzas+'</td>'
        +'<td style="padding:8px 10px;text-align:center;font-family:monospace;">'+(r.tardanzas>0?Math.round(r.minutosTotal/r.tardanzas):0)+' min prom.</td>'
        +'</tr>';
    }).join('') : '<tr><td colspan="4" style="padding:16px;text-align:center;color:#9a8050;">Sin datos este mes</td></tr>';
    // FIX: "RESUMEN DEL MES" solo mostraba UNA fila agregada por empleado
    // (total de días, tardanzas y promedio), sin ver el detalle de cada día
    // — a diferencia de Contabilidad, que sí muestra un renglón por fecha.
    // Se agrega abajo una bitácora día por día del mes (una fila por cada
    // registro de conexión), ordenada del más reciente al más antiguo, igual
    // que una tabla de movimientos mensual.
    const _diasMes = log.filter(function(e){
      if(!e.ts) return false;
      const d = new Date(e.ts);
      if(d.getMonth() !== mesActual || d.getFullYear() !== anioActual) return false;
      return _checadorClasificar(e).estado !== 'fuera_horario';
    }).sort(function(a,b){ return (b.ts||0) - (a.ts||0); });
    const filasDiasMes = _diasMes.length ? _diasMes.map(function(e){
      const cl = _checadorClasificar(e);
      const fechaCorta = (function(){
        try {
          const d = new Date(e.ts);
          return d.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', weekday:'short', day:'2-digit', month:'short' }).toUpperCase().replace('.', '');
        } catch(err){ return e.dia || '—'; }
      })();
      return '<tr style="border-bottom:1px solid #ecdfa8;">'
        +'<td style="padding:8px 10px;font-family:monospace;font-weight:700;color:#8c6518;white-space:nowrap;">'+escHTML(fechaCorta)+'</td>'
        +'<td style="padding:8px 10px;">'+escHTML(e.nombre||e.email)+'</td>'
        +'<td style="padding:8px 10px;font-family:monospace;">'+escHTML(e.inicio||'—')+'</td>'
        +'<td style="padding:8px 10px;">'+_checadorBadge(cl)+'</td>'
        +'<td style="padding:8px 10px;font-family:monospace;color:#7a6840;">'+escHTML(e.cierre||'—')+'</td>'
        +'</tr>';
    }).join('') : '<tr><td colspan="5" style="padding:16px;text-align:center;color:#9a8050;">Sin conexiones registradas este mes</td></tr>';
    const _diaNombre = ahora.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', weekday:'long' }).toUpperCase();
    const _diaNum    = ahora.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', day:'2-digit' });
    const _mesNombre = ahora.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', month:'long' });
    const _anioNum   = ahora.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', year:'numeric' });
    const _fechaEncabezado = '"'+_diaNombre+'" '+_diaNum+' de '+_mesNombre+' de '+_anioNum;
    panel.innerHTML =
      '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px;">'
      +'<span style="font-family:monospace;font-weight:800;letter-spacing:0.06em;color:#3a2c10;font-size:0.8rem;">🕐 CHECADOR — HOY</span>'
      +'<span style="font-family:monospace;font-weight:700;color:#8c6518;font-size:0.72rem;">'+escHTML(_fechaEncabezado)+'</span>'
      +'</div>'
      +'<div style="font-size:0.62rem;color:#9a8050;margin-bottom:10px;">Horario laboral: 8:30 a. m. – 5:30 p. m. (el sistema se habilita desde las 7:00 a. m. por si llegan temprano). Las conexiones fuera de la ventana 7:00 a. m.–5:30 p. m. se consideran mantenimiento del administrador y no se registran.</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:0.76rem;margin-bottom:26px;">'
      +'<thead><tr style="background:rgba(26,122,58,0.07);"><th style="padding:8px 10px;text-align:left;color:#1a7a3a;font-size:0.62rem;text-transform:uppercase;">Empleado</th><th style="padding:8px 10px;text-align:left;color:#1a7a3a;font-size:0.62rem;text-transform:uppercase;">Entrada</th><th style="padding:8px 10px;text-align:left;color:#1a7a3a;font-size:0.62rem;text-transform:uppercase;">Estado</th><th style="padding:8px 10px;text-align:left;color:#1a7a3a;font-size:0.62rem;text-transform:uppercase;">Última conexión</th></tr></thead>'
      +'<tbody>'+filasHoy+'</tbody></table>'
      +'<div style="font-family:monospace;font-weight:800;letter-spacing:0.06em;color:#3a2c10;font-size:0.8rem;margin-bottom:10px;">📅 RESUMEN DEL MES</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:0.76rem;margin-bottom:22px;">'
      +'<thead><tr style="background:rgba(200,149,42,0.07);"><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Empleado</th><th style="padding:8px 10px;text-align:center;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Días conectado</th><th style="padding:8px 10px;text-align:center;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Tardanzas</th><th style="padding:8px 10px;text-align:center;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Prom. retraso</th></tr></thead>'
      +'<tbody>'+filasResumen+'</tbody></table>'
      +'<div style="font-family:monospace;font-weight:800;letter-spacing:0.06em;color:#3a2c10;font-size:0.8rem;margin-bottom:10px;">🗓️ BITÁCORA DEL MES — DÍA POR DÍA</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:0.76rem;">'
      +'<thead><tr style="background:rgba(200,149,42,0.07);"><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Fecha</th><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Empleado</th><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Entrada</th><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Estado</th><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Última conexión</th></tr></thead>'
      +'<tbody>'+filasDiasMes+'</tbody></table>';
  }
  window._renderChecador = _renderChecador;


  /* ── Monitor periódico: vigilar D.movimientos y sincronización ────────── */
  let _lastMovCount = null;
  function _monitorLoop(){
    if(SS._interval) clearInterval(SS._interval);
    SS._interval = setInterval(function(){
      // Vigilar caída en D.movimientos
      const cnt = (typeof D!=='undefined'&&Array.isArray(D.movimientos)) ? D.movimientos.length : null;
      if(_lastMovCount !== null && cnt !== null && cnt < _lastMovCount){
        const perdidos = _lastMovCount - cnt;
        const intencionales = window._adminDeletedMovs || 0;
        window._adminDeletedMovs = 0;
        if(intencionales < perdidos){
          _lexPush('error','monitor.movimientos',
            'D.movimientos cayó '+_lastMovCount+' → '+cnt+' ('+perdidos+' eliminado(s) sin acción de admin)',
            null,{ antes: _lastMovCount, despues: cnt }
          );
        }
      }
      _lastMovCount = cnt;
      _actualizarBadge();
    }, 30000);
    // Primera revisión rápida
    setTimeout(function(){ _lastMovCount=(typeof D!=='undefined'&&Array.isArray(D.movimientos))?D.movimientos.length:null; }, 2000);
  }

  /* ── Inicialización ──────────────────────────────────────────────────── */
  function esAdmin(){
    return typeof empleadoActual!=='undefined' && empleadoActual &&
           typeof ADMIN_EMAIL!=='undefined' &&
           empleadoActual.email.toLowerCase()===ADMIN_EMAIL.toLowerCase();
  }

  window.scansysInit = function(){
    if(!esAdmin()) return;
    const nav = document.getElementById('nav-scansys');
    if(nav) nav.style.display = 'block';
    _interceptar();
    _monitorLoop();
    _lexPush('info','scansys','SCANSYS v2 activado — monitor LEX_ERRORS activo');
  };

  // ── CAPTURA DE ERRORES: SIEMPRE ACTIVA ────────────────────────────────────
  // Antes la captura (console.error/warn, errores de JS y promesas rechazadas)
  // solo se instalaba dentro de scansysInit(), es decir: únicamente para el
  // administrador y 2 segundos DESPUÉS de cargar la página. Todo lo que fallara
  // antes de ese momento, o mientras trabajaba un empleado, no quedaba
  // registrado en ninguna parte — por eso "Errores del Sistema" podía verse en
  // cero aunque algo hubiera fallado. Ahora se instala de inmediato y para
  // cualquier usuario; el panel sigue siendo solo para el administrador.
  _interceptar();

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ if(esAdmin()) scansysInit(); }, 2000); });
  } else {
    setTimeout(function(){ if(esAdmin()) scansysInit(); }, 2000);
  }

})();
// ══════════════════════════════════════════════════════════════════════════════
