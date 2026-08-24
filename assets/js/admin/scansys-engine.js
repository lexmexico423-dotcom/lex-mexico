/* ============================================================================
 * LEX-MÉXICO · SCANSYS PRO  ·  Panel de diagnóstico forense de folios
 * ----------------------------------------------------------------------------
 * Reconstruye la VIDA de cada folio (emisión, abonos, liquidación) cruzando:
 *   - appData.recibos            (versiones vivas A/B/C…)
 *   - appData.historialVersiones (línea de tiempo: qué pasó y cuándo)
 *   - D.movimientos              (asientos contables M-REC / M-RECUP)
 * y explica EN ESPAÑOL por qué un folio se duplicó o descuadró, con la acción
 * recomendada. La eliminación usa reconciliarAplicar() (ya en el index nuevo),
 * con confirmación y respaldo. NADA se borra solo.
 *
 * USO: pega todo en la consola (F12) con sesión iniciada. Se abre el panel.
 *      Para reabrirlo luego:  LEXPANEL.abrir()
 * ==========================================================================*/
// Puente global para render() del SCANSYS PRO IIFE
// Se redefine dentro del IIFE con la función real; esta versión defensiva
// evita ReferenceError si se llama antes de que el IIFE complete.
if (typeof window._sxRender !== 'function') {
  window._sxRender = function() { console.warn('[SCANSYS] _sxRender llamada antes de inicializar'); };
}

(function () {
  'use strict';

  // ===== Helpers de datos =====
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function letra(r) { return ((r && r.letra) || 'A').toString().toUpperCase(); }
  function esExacto(c) { return c && (num(c.montoLiquidado) > 0 || c.exacto === true || c.tipo === 'exacto'); }
  function esRecup(m) { return /^M-(RECUP|PROT)-/.test((m && m.id) || ''); }
  function fmt(n) { return '$' + (num(n)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function _recibos() {
    var a = (typeof REC !== 'undefined' && REC && Array.isArray(REC.recibos)) ? REC.recibos : [];
    var b = (typeof appData !== 'undefined' && appData && Array.isArray(appData.recibos)) ? appData.recibos : [];
    var t = [].concat(a, b).filter(function (r) { return r && r.folio != null; });
    return t.filter(function (r, i) { return t.indexOf(r) === i; });
  }
  function _movs() { return (typeof D !== 'undefined' && D && Array.isArray(D.movimientos)) ? D.movimientos : []; }
  function _histVers() { return (typeof appData !== 'undefined' && appData && appData.historialVersiones) ? appData.historialVersiones : {}; }

  // ===== NÚCLEO: reconstruir la vida y el diagnóstico de un folio =====
  function reconstruirFolio(folioNum) {
    var f = String(folioNum).replace(/[^0-9]/g, '');
    if (!f) return null;

    // Versiones vivas (no complemento) ordenadas por letra
    var versiones = _recibos().filter(function (r) { return String(r.folio) === f && !r.esComplemento; })
      .sort(function (a, b) { return letra(a).localeCompare(letra(b)); });
    if (!versiones.length) return { folio: f, existe: false };

    var vigente = versiones[versiones.length - 1];
    var original = versiones[0];

    // La línea de tiempo se construye más abajo, desde los MOVIMIENTOS de
    // contabilidad (que tienen las fechas/horas reales de cada cobro).
    var timeline = [];

    // Movimientos contables del folio
    var movs = _movs().filter(function (m) { return m && !m.borrado && m.fuente === 'recibo' && String(m.folio) === f; })
      .map(function (m) {
        return { id: m.id, letra: ((m.letra || 'A') + '').toUpperCase(), monto: num(m.monto), estatus: m.estatus || '—',
                 fecha: (m.fecha || '').slice(0, 10), hora: (m.hora || ''), tipo: m.tipo || 'ingreso',
                 descripcion: m.descripcion || '', origen: esRecup(m) ? 'AUTO-PROTECTOR' : 'AL GUARDAR', _raw: m };
      });

    // Movimientos agrupados por letra (para el flujo)
    var movPorLetra = {};
    movs.forEach(function (m) { (movPorLetra[m.letra] = movPorLetra[m.letra] || []).push(m); });

    // FLUJO: por cada versión del recibo, sus datos + su contabilidad + si tiene PDF
    // La FECHA/HORA viene de los MOVIMIENTOS de contabilidad (la verdad), no del
    // objeto recibo, que en versiones B/C/D suele heredar mal la fecha del original.
    var flujo = versiones.map(function (r) {
      var lv = letra(r);
      var mvs = movPorLetra[lv] || [];
      var montoContab = mvs.reduce(function (s, m) { return s + (m.tipo === 'egreso' ? -m.monto : m.monto); }, 0);
      // fecha/hora reales: del primer movimiento de esa letra; fallback al recibo
      var movFecha = '', movHora = '';
      mvs.forEach(function (m) { if (!movFecha && m.fecha) { movFecha = m.fecha; movHora = m.hora; } });
      var ingresos = mvs.filter(function (m) { return m.tipo !== 'egreso' && m.monto > 0; });
      return {
        letra: lv,
        fecha: movFecha || (r.fecha || r.fecha_recibo || '').slice(0, 10),
        hora: movHora || (r.hora || r.hora_recibo || ''),
        fechaRecibo: (r.fecha || r.fecha_recibo || '').slice(0, 10),
        total: num(r.total),
        anticipo: num(r.anticipo),
        abonado: num(r.totalAbonado),
        saldo: num(r.saldoPendiente),
        montoContab: +montoContab.toFixed(2),
        nMovs: mvs.length,
        nIngresos: ingresos.length,
        esLiquidacion: (lv !== 'A' && num(r.saldoPendiente) <= 0),
        tienePdf: !!(r.archivo || r.archivoR2 || r.archivoR2Raiz || r.pdfBase64)
      };
    });

    // LÍNEA DE TIEMPO REAL: cada movimiento de contabilidad ordenado por fecha+hora.
    // Esta es "la verdad de contabilidad" — fechas/horas reales de cada cobro.
    timeline = movs.slice().sort(function (a, b) {
      var ka = (a.fecha || '') + ' ' + (a.hora || ''), kb = (b.fecha || '') + ' ' + (b.hora || '');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }).map(function (m) {
      var ev = (m.tipo === 'egreso' ? 'Egreso' : 'Cobro') + ' ' + f + m.letra + ' · ' + esc(m.estatus) + ' · ' + fmt(m.monto);
      return { fecha: m.fecha || '(sin fecha)', hora: m.hora || '', quien: m.origen, evento: ev,
               monto: m.monto, descripcion: m.descripcion };
    });

    // Esperado (lo realmente cobrado) — usa el total del recibo ORIGINAL
    // (letra A), no el del vigente. El campo "total" del último recibo NO
    // significa lo mismo en todos los casos: en un Pago Parcial se conserva
    // igual al anterior (sigue siendo el total pactado completo), pero en un
    // Pago Total/Liquidación se reescribe para representar el ADEUDO ANTERIOR
    // que se está liquidando a $0 (folio 42B real: total=$850, el adeudo que
    // traía, no el pactado original de $1,850). El total del recibo A nunca
    // cambia de significado — siempre es el pactado real — así que es la
    // única fuente confiable para "esperado". Los Servicios Complementarios
    // exactos (espComp) se suman aparte porque NUNCA están en el total de A
    // (solo se agregan a partir de la versión donde se cobraron).
    var totalOriginal = num(original.total), saldo = num(vigente.saldoPendiente);
    // Servicios Complementarios: se suman por su monto real cobrado (precio),
    // sin importar si quedaron marcados como "exacto/liquidado al momento" o no.
    // Esa marca solo indica CÓMO se registró el pago (en un movimiento aparte
    // vs. mezclado en el pago general), pero en ambos casos el dinero entró y
    // debe contar en el total esperado del folio (folio 10B real: precio=$1,500,
    // liquidadoAlMomento=false, pero el dinero SÍ se cobró junto con el resto).
    var espComp = (vigente.costosExtra || []).reduce(function (s, c) { return s + num(c.precio); }, 0);
    var espHon = totalOriginal > 0 ? ((totalOriginal + espComp) - saldo) : num(vigente.anticipo);
    if (espHon < 0) espHon = 0;
    var esperado = +espHon.toFixed(2);

    // CANCELACIONES — misma lógica que RFC: comparar letra por letra en valor absoluto.
    // Para un folio cancelado el movimiento de cancelación es EGRESO (negativo con signo),
    // pero el recibo dice $0 cobrado. Hay que sumar el egreso al esperado para que cuadre.
    var esFolioCancelado = versiones.some(function(v){ return !!v.cancelado; });
    if (esFolioCancelado) {
      // Recalcular esperado letra por letra igual que RFC
      esperado = 0;
      versiones.forEach(function(r) {
        var lv = letra(r);
        var mvs = movPorLetra[lv] || [];
        if (r.cancelado) {
          // Cancelación: esperado = valor absoluto de los movimientos de esa letra
          esperado += +mvs.reduce(function(s,m){ return s + m.monto; }, 0).toFixed(2);
        } else {
          var rTotal = num(r.total), rSaldo = num(r.saldoPendiente);
          var espV = rTotal > 0 ? (rTotal - rSaldo) : num(r.anticipo);
          if (espV < 0) espV = 0;
          esperado += espV;
        }
      });
      esperado = +esperado.toFixed(2);
    }

    // Observado: suma con signo para normales, valor absoluto para cancelaciones
    var observado;
    if (esFolioCancelado) {
      // Para cancelaciones: sumar el valor absoluto de todos los movimientos
      observado = +movs.reduce(function(s,m){ return s + m.monto; }, 0).toFixed(2);
    } else {
      observado = +movs.reduce(function (s, m) { return s + (m.tipo === 'egreso' ? -m.monto : m.monto); }, 0).toFixed(2);
    }
    var dif = +(observado - esperado).toFixed(2);

    // Duplicados por folio+letra
    var porLetra = {};
    movs.forEach(function (m) { (porLetra[m.letra] = porLetra[m.letra] || []).push(m); });
    var hayDup = Object.keys(porLetra).some(function (k) { return porLetra[k].length > 1; });

    // ===== DIAGNÓSTICO =====
    var diag = { estado: 'OK', titulo: '', explicacion: '', recomendacion: '', idsEliminar: [], manual: false };

    // Movimientos $0 que son residuo del bug (NO los "Sin Anticipo" de letra A, que son legítimos)
    var cerosResiduo = movs.filter(function (m) {
      if (m.monto !== 0) return false;
      var esSinAnticipoA = (m.letra === 'A' && /sin anticipo/i.test(m.estatus));
      return !esSinAnticipoA; // los $0 "Sin Anticipo" de A documentan un recibo emitido sin pago → conservar
    });
    var sumaSinResiduo = +movs.filter(function (m) { return cerosResiduo.indexOf(m) < 0; })
      .reduce(function (s, m) { return s + (m.tipo === 'egreso' ? -m.monto : m.monto); }, 0).toFixed(2);

    // Detección de "liquidación partida": una versión B/C/D de liquidación que
    // quedó registrada en VARIOS asientos, frecuentemente con uno que repite el
    // monto del anticipo original (la firma del bug que viste en 10B).
    var anticipoA = num(original.anticipo);
    var liqPartida = null;
    flujo.forEach(function (v) {
      if (v.letra !== 'A' && v.nIngresos > 1) {
        var mvsV = movPorLetra[v.letra] || [];
        var repiteAnticipo = anticipoA > 0 && mvsV.some(function (m) { return m.tipo !== 'egreso' && Math.abs(m.monto - anticipoA) <= 0.5; });
        liqPartida = { letra: v.letra, nIngresos: v.nIngresos, montoContab: v.montoContab, repiteAnticipo: repiteAnticipo, movs: mvsV };
      }
    });

    if (Math.abs(dif) <= 0.5 && !hayDup) {
      diag.estado = 'OK';
      diag.titulo = '✅ Folio sano';
      diag.explicacion = 'La contabilidad de este folio (' + fmt(observado) + ') coincide con lo que el recibo dice que se cobró (' + fmt(esperado) + '). No hay duplicados.';
    } else if (cerosResiduo.length && Math.abs(sumaSinResiduo - esperado) <= 0.5) {
      diag.estado = 'DUPLICADO';
      diag.titulo = '🔴 Duplicado por auto-protector (limpieza segura)';
      diag.explicacion = 'El recibo dice que se cobró ' + fmt(esperado) + '. Existe(n) ' + cerosResiduo.length +
        ' asiento(s) en $0 que el auto-protector dejó al fabricar el movimiento real. Al quitarlos, la cuenta cuadra exactamente.';
      diag.recomendacion = 'Eliminar ' + cerosResiduo.length + ' asiento(s) en $0. Conserva el movimiento real y los registros legítimos.';
      diag.idsEliminar = cerosResiduo.map(function (m) { return m.id; });
    } else if (dif > 0.5) {
      // Sobra: ¿una copia exacta lo explica?
      var copia = null;
      Object.keys(porLetra).forEach(function (k) {
        var lista = porLetra[k];
        if (lista.length > 1) {
          for (var i = 0; i < lista.length; i++) {
            var sinUno = movs.filter(function (x) { return x !== lista[i]; }).reduce(function (s, m) { return s + (m.tipo === 'egreso' ? -m.monto : m.monto); }, 0);
            if (Math.abs(sinUno - esperado) <= 0.5) { copia = lista[i]; break; }
          }
        }
      });
      if (copia) {
        diag.estado = 'DUPLICADO';
        diag.titulo = '🔴 Copia duplicada (limpieza segura)';
        diag.explicacion = 'El recibo dice ' + fmt(esperado) + ', pero hay ' + fmt(observado) + ' registrado. Una copia de ' + fmt(copia.monto) +
          ' (' + copia.origen + ') está de más; al quitarla la cuenta cuadra.';
        diag.recomendacion = 'Eliminar la copia ' + esc(copia.id) + ' (' + fmt(copia.monto) + ').';
        diag.idsEliminar = [copia.id];
      } else {
        diag.estado = 'SOBRA';
        diag.titulo = '⚠️ Sobra dinero — requiere tu criterio';
        diag.explicacion = 'Contabilidad tiene ' + fmt(observado) + ' pero el recibo dice que se cobró ' + fmt(esperado) +
          ' (sobran ' + fmt(Math.abs(dif)) + '). Esto puede ser: (a) un abono REAL que cobraste pero no quedó en el recibo, o (b) un duplicado con monto distinto. Revisa la línea de tiempo de arriba: si ahí ves ese pago, el problema está en el recibo, no en contabilidad.';
        diag.recomendacion = 'NO se elimina automáticamente. Compara la línea de tiempo con el expediente físico antes de decidir.';
        diag.manual = true;
      }
    } else if (dif < -0.5) {
      diag.estado = 'FALTA';
      diag.titulo = '⚠️ Falta dinero — revisar el recibo';
      diag.explicacion = 'Contabilidad tiene ' + fmt(observado) + ' pero el recibo dice que se cobró ' + fmt(esperado) +
        ' (faltan ' + fmt(Math.abs(dif)) + '). Aquí NO se borra nada: lo más probable es que el recibo no haya registrado un abono que sí entró.';
      diag.recomendacion = 'Revisar el recibo ' + f + letra(vigente) + ' y confirmar el saldo real con el expediente.';
      diag.manual = true;
    } else if (hayDup) {
      diag.estado = 'DUP_SIN_IMPACTO';
      diag.titulo = '🟡 Registro duplicado (el total cuadra)';
      diag.explicacion = 'El dinero cuadra (' + fmt(observado) + '), pero hay más de un asiento para la misma letra. Conviene dejar uno solo por claridad.';
      diag.recomendacion = 'Revisa los movimientos abajo y decide cuál conservar; suelen ser idénticos.';
      diag.manual = true;
    }

    // Sobre-escritura: si una liquidación quedó partida en varios asientos (tu caso
    // de 10B), hazlo visible aunque el total cuadre — el PDF suele mostrar UN solo
    // pago de liquidación, así que los asientos extra distorsionan la historia.
    if (liqPartida && (diag.estado === 'OK' || diag.estado === 'DUP_SIN_IMPACTO')) {
      diag.estado = 'SOBRA';
      diag.titulo = '⚠️ Liquidación partida en varios asientos — revisar con el PDF';
      diag.explicacion = 'La versión ' + f + liqPartida.letra + ' (liquidación) está registrada en ' + liqPartida.nIngresos + ' asientos que suman ' + fmt(liqPartida.montoContab) + '. ' +
        (liqPartida.repiteAnticipo
          ? 'Uno de ellos repite exactamente el monto del anticipo original (' + fmt(anticipoA) + '), lo que suele indicar que el anticipo se duplicó dentro de la liquidación. '
          : '') +
        'En el PDF, una liquidación normalmente es UN solo pago. Abre el PDF de ' + f + liqPartida.letra + ' (botón "Ver PDF" / "Leer PDF" abajo): el campo "PAGO RECIBIDO" te dice el monto real de ese pago, y con eso sabes cuántos asientos sobran.';
      diag.recomendacion = 'NO se elimina automáticamente: confirma en el PDF cuál fue el pago real de la liquidación y elimina los asientos que no correspondan.';
      diag.manual = true;
    }

    return {
      folio: f, existe: true, vigente: f + letra(vigente), original: f + letra(original),
      cliente: vigente.nombre || '—',
      total: num(vigente.total), saldo: num(vigente.saldoPendiente), abonado: num(vigente.totalAbonado),
      esperado: esperado, observado: observado, dif: dif,
      versiones: versiones, timeline: timeline, movimientos: movs, flujo: flujo, diag: diag
    };
  }

  // ===== Lista de folios con problema (para el panel) =====
  function foliosConProblema() {
    var folios = {};
    _recibos().forEach(function (r) { if (r && r.folio != null && !r.esComplemento) folios[String(r.folio)] = true; });
    var res = [];
    Object.keys(folios).forEach(function (f) {
      var d = reconstruirFolio(f);
      if (d && d.existe && d.diag.estado !== 'OK') res.push(d);
    });
    var orden = { DUPLICADO: 0, SOBRA: 1, FALTA: 1, DUP_SIN_IMPACTO: 2 };
    res.sort(function (a, b) {
      if (orden[a.diag.estado] !== orden[b.diag.estado]) return orden[a.diag.estado] - orden[b.diag.estado];
      return Math.abs(b.dif) - Math.abs(a.dif);
    });
    return res;
  }

  // Exponer la lógica para pruebas/uso programático
  window.LEXDX = { reconstruirFolio: reconstruirFolio, foliosConProblema: foliosConProblema };

  // Extrae los CAMPOS CLAVE del formato de recibo LEX-MÉXICO (la fuente de verdad):
  // COSTO DEL TRÁMITE, PAGO RECIBIDO, SALDO ANTERIOR, SALDO RESTANTE.

  // ── Parser unificado: extrae los 9 campos del PDF LEX-MÉXICO ─────────────
  // Versión A  → cuadro: TOTAL / ABONADO / RESTA
  // Versión B+ → cuadro: SALDO ANTERIOR / PAGO RECIBIDO / SALDO RESTANTE
  // Fecha/hora → encabezado: "Santiago Juxtlahuaca, Oaxaca — {fecha} {HH:MM} hrs."
  function _sxParsearPDF(texto) {
    var t     = (texto || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    var tFlat = t.replace(/[\r\n]+/g, ' ').replace(/\|/g, ' ').replace(/\s{2,}/g, ' ');

    function buscarMonto() {
      for (var i = 0; i < arguments.length; i++) {
        var re = new RegExp(
          arguments[i] + '[\\s:]*\\$?\\s*([\\d]{1,3}(?:,\\d{3})+(?:\\.\\d{2})?|\\d{4,}(?:\\.\\d{2})?|\\d+\\.\\d{2})',
          'i'
        );
        var m = re.exec(tFlat);
        if (m) return parseFloat(m[1].replace(/,/g, ''));
      }
      return null;
    }

    function buscarTexto() {
      for (var i = 0; i < arguments.length; i++) {
        var re = new RegExp(
          arguments[i] + '[\\s:]+([^\\n$\\d]{3,80}?)(?:\\s{2,}|\\n|\\$|\\d{4})',
          'i'
        );
        var m = re.exec(t);
        if (m && m[1].trim().length > 2) return m[1].trim().replace(/\s+/g, ' ');
      }
      return null;
    }

    // ── Fecha y hora del ESTE recibo ──────────────────────────────────────────
    // El encabezado imprime: "Santiago Juxtlahuaca, Oaxaca — 19 de enero de 2026 09:10 hrs."
    // Puede haber texto antes o después — capturamos la primera ocurrencia de fecha larga
    var fechaISO = null, horaVal = null;
    var MESES = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',
                 julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};

    // Buscar el encabezado principal: guión largo seguido de fecha
    var encRe = /—\s*(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})\s+(\d{1,2}:\d{2})\s*hrs?/i;
    var enc = encRe.exec(tFlat);
    if (enc) {
      fechaISO = enc[3] + '-' + (MESES[enc[2].toLowerCase()]||'01') + '-' + enc[1].padStart(2,'0');
      horaVal  = enc[4].padStart(5, '0');
    }

    // Fallback: fecha ISO directa o DD/MM/YYYY
    if (!fechaISO) {
      var fd1 = /(\d{4}-\d{2}-\d{2})/.exec(tFlat);
      var fd2 = /(\d{2})\/(\d{2})\/(\d{4})/.exec(tFlat);
      if (fd1) fechaISO = fd1[1];
      else if (fd2) fechaISO = fd2[3] + '-' + fd2[2] + '-' + fd2[1];
    }
    if (!horaVal) {
      var hm = /(\d{1,2}:\d{2})(?:\s*hrs?\.?)?/i.exec(tFlat);
      if (hm) horaVal = hm[1].padStart(5, '0');
    }

    // ── Nombre ────────────────────────────────────────────────────────────────
    var nombreVal = buscarTexto('NOMBRE', 'Cliente', 'Sr\\.', 'Sra\\.', 'C\\.');
    if (!nombreVal) {
      var dn = /DATOS DEL CLIENTE\s*\n([^\n]{5,60})/i.exec(t);
      if (dn) nombreVal = dn[1].trim();
    }
    // Fallback: primera línea en mayúsculas después de NOMBRE
    if (!nombreVal) {
      var nm2 = /NOMBRE\s+([A-Z\u00C0-\u00FF][A-Z\u00C0-\u00FF\s]{4,60})/i.exec(tFlat);
      if (nm2) nombreVal = nm2[1].trim();
    }

    // ── Concepto y descripción ────────────────────────────────────────────────
    var conceptoVal    = buscarTexto('CONCEPTO', 'Concepto del tr\u00e1mite', 'Tr\u00e1mite');
    var descripcionVal = buscarTexto('DESCRIPCI[\u00d3O]N', 'Descripcion', 'DESCRIPCI\u00d3N');

    // ── Montos — todos los campos del PDF LEX-MÉXICO ─────────────────────────
    // Versión B+: SALDO ANTERIOR / PAGO RECIBIDO / SALDO RESTANTE
    var pagoRecibido  = buscarMonto('PAGO RECIBIDO', 'PAGO RECIBIDO EN ESTE RECIBO', 'CANTIDAD RECIBIDA');
    var saldoAnterior = buscarMonto('SALDO ANTERIOR');
    var saldoRestante = buscarMonto('SALDO RESTANTE', 'SALDO PENDIENTE');

    // Versión A: TOTAL DEL TRÁMITE / TOTAL ABONADO / LIQUIDADO o RESTA
    // "TOTAL ABONADO" es el campo real del PDF (no "ABONADO:")
    //
    // NOTA (formato nuevo, sin bloque "PAGOS PARCIALES"): desde que ese bloque
    // se quitó del recibo impreso (el detalle de quién/cuándo pagó ahora vive
    // solo en la Ficha del Folio, nunca en el PDF ni en el Estado de Cuenta),
    // la etiqueta "ANTICIPO INICIAL" YA NO SE IMPRIME en los recibos nuevos —
    // solo sigue apareciendo en PDFs viejos aún no regenerados. Por eso
    // `anticipo` puede salir null en un recibo con el formato nuevo, y eso es
    // esperado, NO un error: el cuadro de totales (TOTAL:/ABONADO:/RESTA:)
    // sigue imprimiéndose igual que siempre, así que `totalAbonado` (vía la
    // etiqueta "ABONADO:", que nunca se tocó) sigue siendo una fuente
    // confiable del monto — y _sxMontoRecibo() ya cae a `totalAbonado` cuando
    // `anticipo` no aparece. Se conservan ambas búsquedas (label vieja +
    // fallback nuevo) para que un mismo folio con versiones viejas y nuevas
    // se lea correctamente sin importar qué formato tenga cada PDF archivado.
    var totalAbonado  = buscarMonto('TOTAL ABONADO', 'ABONADO:', 'TOTAL ABONADO:');
    var resta         = buscarMonto('RESTA:', 'RESTA ');
    var totalTramite  = buscarMonto('TOTAL DEL TR[A\u00c1]MITE', 'TOTAL:', 'COSTO DEL TR[A\u00c1]MITE');
    var anticipo      = buscarMonto('ANTICIPO INICIAL', 'ANTICIPO:', 'Anticipo Inicial'); // legacy: solo PDFs viejos

    // Fallback para PAGO RECIBIDO en versión B: "Liquidación total ... $7,000.00"
    // aparece en la columna ABONOS de la tabla de pagos parciales.
    // LEGACY: ese texto solo existía dentro del bloque "PAGOS PARCIALES" ya
    // eliminado del recibo impreso — en PDFs con el formato nuevo esta rama
    // nunca hará match (pagoRecibido seguirá null y _sxMontoRecibo caerá al
    // resto de la cadena de fallbacks). Se conserva solo para poder seguir
    // leyendo correctamente los PDFs viejos ya archivados en R2.
    if (!pagoRecibido || pagoRecibido <= 0) {
      var liqRe = /Liquidaci[o\u00f3]n\s+total[^\d$]*\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?)/i;
      var liqM  = liqRe.exec(tFlat);
      if (liqM) pagoRecibido = parseFloat(liqM[1].replace(/,/g, ''));
    }

    // ── RECIBO DE CANCELACIÓN: detectar monto y tipo ──────────────────────────
    var esCancelacion = /TR[\u00c1A]MITE\s+CANCELADO/i.test(tFlat) || /RECIBO\s+DE\s+CANCELACI[\u00d3O]N/i.test(tFlat);
    var montoCancel = null, tipoCancel = null;
    if (esCancelacion) {
      var egRe2 = /EGRESO\s*:\s*-?\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{4,}(?:\.\d{2})?|\d+\.\d{2})/i.exec(tFlat);
      if (egRe2) { montoCancel = parseFloat(egRe2[1].replace(/,/g,'')); tipoCancel = 'egreso'; }
      if (!montoCancel) {
        var inRe2 = /INGRESO\s*:\s*\+?\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?|\d{4,}(?:\.\d{2})?|\d+\.\d{2})/i.exec(tFlat);
        if (inRe2) { montoCancel = parseFloat(inRe2[1].replace(/,/g,'')); tipoCancel = 'ingreso'; }
      }
    }

    return {
      pagoRecibido:  pagoRecibido,   // B,C,D: pago de esta version
      totalAbonado:  totalAbonado,   // A: total cobrado hasta ahora
      anticipo:      anticipo,       // A: primer pago
      saldoAnterior: saldoAnterior,  // B,C,D: saldo antes de pagar
      saldoRestante: saldoRestante,  // B,C,D: saldo despues de pagar
      resta:         resta,          // A: saldo pendiente
      totalTramite:  totalTramite,   // costo total (NO es el monto del recibo)
      costoTramite:  totalTramite,   // alias para compatibilidad con __sxLeerPdf
      fecha:         fechaISO,
      hora:          horaVal,
      nombre:        nombreVal,
      concepto:      conceptoVal,
      descripcion:   descripcionVal,
      esCancelacion: esCancelacion,
      montoCancel:   montoCancel,
      tipoCancel:    tipoCancel
    };
  }

  // Extrae TODOS los montos numericos del PDF para comparacion aproximada.
  // Se usa cuando no se puede identificar un campo especifico (PAGO RECIBIDO, etc.)
  // y se necesita verificar si algun numero del PDF coincide con contabilidad.
  function _sxExtraerCantidades(texto) {
    var tFlat = (texto || '').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
    var resultados = [];
    var re = /\$\s*([\d]{1,3}(?:,[\d]{3})*(?:\.\d{2})?|[\d]{4,}(?:\.\d{2})?)/g;
    var m;
    while ((m = re.exec(tFlat)) !== null) {
      var val = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) resultados.push({ val: val, raw: m[0] });
    }
    return resultados;
  }

  // Monto cobrado en ESTE recibo (no el total del trámite)
  //
  // Formato nuevo (sin "PAGOS PARCIALES" impreso): `campos.anticipo` va a salir
  // null en casi todos los recibos versión A leídos con OCR, porque esa
  // etiqueta ya no se imprime — pero eso NO es un error ni una lectura
  // fallida: el siguiente fallback (`totalAbonado`, leído de la etiqueta
  // "ABONADO:" del cuadro de totales, que SIEMPRE se imprime) da exactamente
  // el mismo monto en la práctica, así que el resultado final de esta función
  // no cambia. Esta cadena de fallbacks ya soporta ambos formatos (PDFs
  // viejos con "ANTICIPO INICIAL" y PDFs nuevos sin él) sin necesitar tocar
  // nada más — se documenta aquí para que quede explícito y no se confunda
  // con una regresión la próxima vez que se revise.
  function _sxMontoRecibo(campos) {
    // Cancelaciones: monto real = EGRESO o INGRESO del cuadro de cancelacion (rojo o verde)
    if (campos.esCancelacion && campos.montoCancel != null && campos.montoCancel > 0) return campos.montoCancel;
    // B,C,D: PAGO RECIBIDO es explícito
    if (campos.pagoRecibido  != null && campos.pagoRecibido  > 0) return campos.pagoRecibido;
    // A sin historial: ANTICIPO INICIAL (legacy — solo PDFs viejos; en PDFs
    // nuevos este campo sale null y se pasa directo al fallback de abajo)
    if (campos.anticipo      != null && campos.anticipo      > 0) return campos.anticipo;
    // A con historial: calcular saldo anterior - saldo restante
    if (campos.saldoAnterior != null && campos.saldoRestante != null) {
      var diff = campos.saldoAnterior - campos.saldoRestante;
      if (diff > 0) return diff;
    }
    // Fallback A: TOTAL ABONADO / "ABONADO:" — fuente confiable en AMBOS
    // formatos (viejo y nuevo), ya que esa etiqueta del cuadro de totales
    // nunca se quitó del recibo impreso.
    if (campos.totalAbonado  != null && campos.totalAbonado  > 0) return campos.totalAbonado;
    return 0;
  }

  // Estatus correcto según lo que dice el PDF — el PDF es la verdad
  function _sxEstatusDesde(campos, letraV) {
    if (campos.saldoRestante != null && campos.saldoRestante <= 0.5) return 'Liquidado';
    if (campos.resta         != null && campos.resta         <= 0.5) return 'Liquidado';
    if (letraV === 'A') return 'Anticipo';
    return 'Abono parcial';
  }

  function _sxCrearMovDesde(folio, letraV, recibo, campos) {
    var monto   = _sxMontoRecibo(campos);
    if (monto <= 0) return null;
    var estatus = campos.esCancelacion ? 'Cancelaci\u00f3n' : _sxEstatusDesde(campos, letraV);
    var fechaHoy  = typeof hoy  === 'function' ? hoy()  : new Date().toISOString().split('T')[0];
    var horaAhora = typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5);
    var nombre = (recibo && recibo.nombre) || campos.nombre || '—';
    var conc   = campos.concepto    || '';
    var desc   = campos.descripcion || '';
    // FIX (unificación de descripciones en Contabilidad): folio y nombre ya
    // tienen su propia columna en el movimiento (folio/nombre de abajo) — no
    // hace falta repetirlos en la descripción.
    var partes = [estatus, conc, desc].filter(Boolean);
    var tipoMov = (campos.esCancelacion && campos.tipoCancel) ? campos.tipoCancel : 'ingreso';
    return {
      id:          'M-PDF-' + folio + '-' + letraV + '-' + Date.now(),
      folio:       Number(folio),
      letra:       letraV,
      monto:       monto,
      tipo:        tipoMov,
      estatus:     estatus,
      fuente:      'recibo',
      origen:      'PDF-RECONSTRUIDO',
      fecha:       campos.fecha || (recibo && recibo.fecha) || fechaHoy,
      hora:        campos.hora  || (recibo && recibo.hora)  || horaAhora,
      descripcion: partes.join(' · ') + ' [PDF-RECONSTRUIDO]',
      nombre:      nombre,
      responsable: (typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.nombre) ? empleadoActual.nombre : '—',
      folioCaja:   '',
      cat:         estatus + ' · #' + folio + letraV + (conc ? ' · ' + conc : '')
    };
  }

  // ── Motor principal: analiza todas las versiones del folio con PDF en R2 ──
  window.__sxCorregirDesdePdf = async function(folioNum, zonaSalida) {
    var folio = String(folioNum).replace(/[^0-9]/g, '');
    if (!folio) return;

    var setLog = function(html) {
      if (zonaSalida) zonaSalida.innerHTML = html;
    };

    // Validaciones de dependencias
    if (typeof window.obtenerBlobPdfReciboValidado !== 'function') {
      setLog('<div class="pvr sin-pdf"><div class="pvr-info"><div class="pvr-title" style="color:#c0161a">⚠ Sin acceso a R2</div><div class="pvr-sub">obtenerBlobPdfReciboValidado no está disponible. Inicia sesión.</div></div></div>');
      return;
    }
    if (typeof _ocrExtraerTexto !== 'function') {
      setLog('<div class="pvr sin-pdf"><div class="pvr-info"><div class="pvr-title" style="color:#c0161a">⚠ OCR no disponible</div><div class="pvr-sub">_ocrExtraerTexto no está disponible en esta sesión.</div></div></div>');
      return;
    }
    if (typeof D === 'undefined' || !Array.isArray(D.movimientos)) {
      setLog('<div class="pvr sin-pdf"><div class="pvr-info"><div class="pvr-title" style="color:#c0161a">⚠ Contabilidad no cargada</div><div class="pvr-sub">D.movimientos no está disponible. Inicia sesión.</div></div></div>');
      return;
    }

    // Obtener todas las versiones del folio (A, B, C…)
    var versiones = _recibos().filter(function(r) {
      return String(r.folio) === folio && !r.esComplemento;
    }).sort(function(a, b) { return letra(a).localeCompare(letra(b)); });

    if (!versiones.length) {
      setLog('<div class="pvr sin-pdf"><div class="pvr-info"><div class="pvr-title">Sin versiones</div><div class="pvr-sub">No se encontró el folio #' + esc(folio) + ' en los recibos.</div></div></div>');
      return;
    }

    setLog('<div style="padding:10px 12px;font-size:12px;color:#7a6840;font-family:monospace">⏳ Leyendo ' + versiones.length + ' versión(es) del folio #' + esc(folio) + ' con Mistral OCR…</div>');

    // Procesar cada versión
    var resultados = [];
    for (var i = 0; i < versiones.length; i++) {
      var r = versiones[i];
      var lv = letra(r);
      var resultado = { letra: lv, recibo: r, campos: null, blob: null, error: null, estado: 'sin-pdf', plan: null };

      setLog('<div style="padding:10px 12px;font-size:12px;color:#7a6840;font-family:monospace">⏳ Leyendo versión ' + folio + lv + ' (' + (i+1) + '/' + versiones.length + ')…</div>');

      try {
        var blob = await window.obtenerBlobPdfReciboValidado(r);
        if (!blob) {
          resultado.estado = 'sin-pdf';
          resultado.error = 'PDF no encontrado en R2';
          resultados.push(resultado);
          continue;
        }
        resultado.blob = blob;

        var ocr = await _ocrExtraerTexto(blob, null);
        if (!ocr || !ocr.texto) {
          resultado.estado = 'sin-pdf';
          resultado.error = 'No se pudo extraer texto del PDF';
          resultados.push(resultado);
          continue;
        }

        var campos = _sxParsearPDF(ocr.texto);
        resultado.campos = campos;
        resultado.metodo = ocr.metodo || 'ocr';

        // Obtener movimientos actuales de contabilidad para esta letra
        var movsActuales = _movs().filter(function(m) {
          return m && !m.borrado && m.fuente === 'recibo' &&
                 String(m.folio) === folio &&
                 (m.letra || 'A').toUpperCase() === lv &&
                 m.estatus !== 'Complementario' && m.estatus !== 'Cancelación';
        });
        var totalContab = +movsActuales.reduce(function(s,m) {
          return s + (m.tipo === 'egreso' ? -(num(m.monto)) : num(m.monto));
        }, 0).toFixed(2);

        // Misma funcion de extraccion de monto que RFC para criterio unificado
      var pagoPdf = (typeof _rfcMonto === 'function') ? _rfcMonto(campos) : _sxMontoRecibo(campos);

        // Monto cobrado en esta versión según el PDFIBIDO, calcular desde saldo anterior - saldo restante
        if (pagoPdf == null && campos.saldoAnterior != null && campos.saldoRestante != null) {
          pagoPdf = Math.max(0, campos.saldoAnterior - campos.saldoRestante);
        }

        // ⚠️ _rfcMonto() devuelve 0 tanto si el PDF dice genuinamente "$0" como
        // si simplemente no reconoció NINGÚN campo (el OCR no encontró "PAGO
        // RECIBIDO"/"SALDO ANTERIOR"/etc. en ese PDF puntual). Sin distinguir
        // ambos casos, un $0 "por no encontrar nada" se trataba como si el PDF
        // realmente dijera $0, y disparaba un falso "SOBRA en contabilidad"
        // cuando el recibo sí tenía dinero real registrado (caso real: folio
        // 63B, el OCR no leyó ese PDF y el sistema asumió "$0", cuando el
        // diagnóstico de folios — que sí usa los datos guardados del recibo —
        // ya confirmaba que los $10,000 en contabilidad eran correctos).
        // Si NO se reconoció ningún campo, no hay base para afirmar "el PDF
        // dice $0": se trata como falta de datos, igual que si fuera null.
        var _huboAlgunCampoPdf = campos && (campos.pagoRecibido != null || campos.anticipo != null ||
          campos.saldoAnterior != null || campos.saldoRestante != null || campos.totalAbonado != null);
        if (pagoPdf === 0 && !_huboAlgunCampoPdf) pagoPdf = null;

        if (pagoPdf == null) {
          resultado.estado = 'sin-datos';
          resultado.error = 'No se identificaron montos clave en el PDF (PAGO RECIBIDO / SALDO ANTERIOR / SALDO RESTANTE)';
          resultados.push(resultado);
          continue;
        }

        var dif = +(totalContab - pagoPdf).toFixed(2);
        resultado.pagoPdf = pagoPdf;
        resultado.totalContab = totalContab;
        resultado.dif = dif;
        resultado.movsActuales = movsActuales;

        if (Math.abs(dif) <= 0.5 && movsActuales.length <= 1) {
          resultado.estado = 'ok';
          resultado.plan = null;
        } else if (dif > 0.5) {
          // SOBRA: contabilidad tiene más de lo que dice el PDF
          resultado.estado = 'sobra';
          // Identificar candidatos a eliminar: preferir M-RECUP-, M-PROT-, o el de $0
          var candidatosElim = movsActuales.filter(function(m) {
            return esRecup(m) || m.monto === 0;
          });
          // Si quitando los candidatos cuadra, ese es el plan
          var sinCandidatos = movsActuales.filter(function(m) {
            return !candidatosElim.some(function(c) { return c.id === m.id; });
          });
          var totalSinCandidatos = sinCandidatos.reduce(function(s,m) {
            return s + (m.tipo === 'egreso' ? -num(m.monto) : num(m.monto));
          }, 0);
          if (Math.abs(totalSinCandidatos - pagoPdf) <= 0.5 && candidatosElim.length > 0) {
            resultado.plan = { accion: 'eliminar', ids: candidatosElim.map(function(m){ return m.id; }), montoResultante: pagoPdf };
          } else {
            // Intentar encontrar el único movimiento sobrante manualmente
            var planEncontrado = false;
            for (var j = 0; j < movsActuales.length; j++) {
              var sinEste = movsActuales.filter(function(m, idx) { return idx !== j; })
                .reduce(function(s,m) { return s + (m.tipo==='egreso'?-num(m.monto):num(m.monto)); }, 0);
              if (Math.abs(sinEste - pagoPdf) <= 0.5) {
                resultado.plan = { accion: 'eliminar', ids: [movsActuales[j].id], montoResultante: pagoPdf };
                planEncontrado = true;
                break;
              }
            }
            if (!planEncontrado) resultado.plan = null; // No se puede resolver automáticamente
          }
        } else if (dif < -0.5) {
          // FALTA: contabilidad tiene menos de lo que dice el PDF
          resultado.estado = 'falta';
          if (movsActuales.length === 0) {
            // No hay ningún movimiento: crear uno desde cero
            var movNuevo = _sxCrearMovDesde(folio, lv, r, campos);
            resultado.plan = movNuevo ? { accion: 'crear', mov: movNuevo } : null;
          } else {
            // Hay movimientos pero no alcanzan: el plan es más complejo, mostrar info
            resultado.plan = null;
          }
        } else if (Math.abs(dif) <= 0.5 && movsActuales.length > 1) {
          // Monto correcto pero partido en varios asientos: identificar cuál sobra
          resultado.estado = 'partido';
          var movsIngreso = movsActuales.filter(function(m) { return m.tipo !== 'egreso' && m.monto > 0; });
          if (movsIngreso.length > 1) {
            // Ordenar por preferencia: conservar M-REC- (real), eliminar M-RECUP-/M-PROT-
            var sobrantesPartido = movsIngreso.filter(function(m) { return esRecup(m); });
            if (sobrantesPartido.length > 0) {
              resultado.plan = { accion: 'eliminar', ids: sobrantesPartido.map(function(m){ return m.id; }), montoResultante: pagoPdf };
            }
          }
        }
      } catch(e) {
        resultado.error = e && e.message ? e.message : String(e);
        resultado.estado = 'error';
      }
      resultados.push(resultado);
    }

    // ── Renderizar resultados ──
    _sxRenderResultadosPdf(folio, resultados, zonaSalida);
  };

  // Renderizar el panel de resultados del análisis PDF
  function _sxRenderResultadosPdf(folio, resultados, zona) {
    if (!zona) return;

    var totalOk = resultados.filter(function(r){ return r.estado === 'ok'; }).length;
    var totalProblemas = resultados.length - totalOk;

    var filas = resultados.map(function(r, idx) {
      var lv = r.letra;
      var cls = r.estado === 'ok' ? 'ok' : r.estado === 'falta' ? 'falta' : r.estado === 'sobra' ? 'sobra' : r.estado === 'partido' ? 'partido' : 'sin-pdf';

      var titulo = '';
      var sub    = '';
      var accionHtml = '';

      if (r.estado === 'ok') {
        titulo = '✅ Versión ' + folio + lv + ' — cuadra perfectamente';
        sub    = 'PDF dice ' + fmt(r.pagoPdf) + ' · Contabilidad tiene ' + fmt(r.totalContab) + ' · Diferencia: $0.00';
      } else if (r.estado === 'sobra') {
        titulo = '🔴 Versión ' + folio + lv + ' — SOBRA en contabilidad';
        sub    = 'PDF dice ' + fmt(r.pagoPdf) + ' · Contabilidad tiene ' + fmt(r.totalContab) + ' · Sobran ' + fmt(Math.abs(r.dif));
        if (r.plan) {
          accionHtml = '<button class="btn-pvr-accion btn-pvr-del" data-pvr-idx="' + idx + '" data-pvr-accion="eliminar">' +
            '🗑 Eliminar ' + r.plan.ids.length + ' mov. sobrante(s) → cuadrar en ' + fmt(r.plan.montoResultante) +
            '</button><div class="pvr-progreso" id="pvr-prog-' + idx + '"></div>';
        } else {
          sub += ' · No se puede resolver automáticamente — abre el PDF y revisa manualmente.';
        }
      } else if (r.estado === 'falta') {
        titulo = '🟡 Versión ' + folio + lv + ' — FALTA movimiento en contabilidad';
        if (r.movsActuales && r.movsActuales.length === 0) {
          sub = 'PDF dice ' + fmt(r.pagoPdf) + ' · Contabilidad: sin registro · Se creará movimiento M-PDF-';
          if (r.plan) {
            accionHtml = '<button class="btn-pvr-accion btn-pvr-new" data-pvr-idx="' + idx + '" data-pvr-accion="crear">' +
              '➕ Crear movimiento de ' + fmt(r.plan.mov.monto) + ' (' + esc(r.plan.mov.estatus) + ')' +
              '</button><div class="pvr-progreso" id="pvr-prog-' + idx + '"></div>';
          }
        } else {
          sub = 'PDF dice ' + fmt(r.pagoPdf) + ' · Contabilidad tiene ' + fmt(r.totalContab) + ' · Faltan ' + fmt(Math.abs(r.dif)) + ' · Revisión manual recomendada.';
        }
      } else if (r.estado === 'partido') {
        titulo = '⚠️ Versión ' + folio + lv + ' — monto correcto pero partido en ' + (r.movsActuales ? r.movsActuales.length : '?') + ' asientos';
        sub    = 'PDF dice ' + fmt(r.pagoPdf) + ' · Contabilidad suma ' + fmt(r.totalContab) + ' en varios movimientos';
        if (r.plan) {
          accionHtml = '<button class="btn-pvr-accion btn-pvr-fix" data-pvr-idx="' + idx + '" data-pvr-accion="eliminar">' +
            '🔧 Eliminar ' + r.plan.ids.length + ' asiento(s) duplicado(s) → dejar uno de ' + fmt(r.plan.montoResultante) +
            '</button><div class="pvr-progreso" id="pvr-prog-' + idx + '"></div>';
        }
      } else if (r.estado === 'sin-pdf') {
        titulo = '📄 Versión ' + folio + lv + ' — sin PDF en R2';
        sub    = r.error || 'El PDF no se encontró o no está subido aún.';
      } else if (r.estado === 'sin-datos') {
        titulo = '🔍 Versión ' + folio + lv + ' — PDF leído pero sin campos reconocibles';
        sub    = r.error || 'El texto extraído no contiene PAGO RECIBIDO / SALDO ANTERIOR. Puede ser formato antiguo.';
      } else {
        titulo = '❌ Versión ' + folio + lv + ' — error al procesar';
        sub    = r.error || 'Error desconocido';
      }

      return '<div class="pvr ' + cls + '" id="pvr-row-' + idx + '">' +
        '<div class="pvr-info">' +
          '<div class="pvr-title">' + titulo + '</div>' +
          '<div class="pvr-sub">' + esc(sub) + '</div>' +
        '</div>' +
        (accionHtml ? '<div class="pvr-accion">' + accionHtml + '</div>' : '') +
        '</div>';
    }).join('');

    var resumenColor = totalProblemas === 0 ? '#1a7a3a' : '#c0161a';
    var resumenTexto = totalProblemas === 0
      ? '✅ Todas las versiones cuadran con sus PDFs'
      : totalProblemas + ' versión(es) con discrepancia — acciones disponibles abajo';

    zona.innerHTML =
      '<div class="pdf-verdad-panel">' +
        '<div class="pdf-verdad-hd">' +
          '<span>⚖️ Análisis PDF como fuente de verdad · Folio #' + esc(folio) + '</span>' +
          '<span style="margin-left:auto;font-size:11px;opacity:.7">' + resultados.length + ' versiones analizadas</span>' +
        '</div>' +
        '<div class="pdf-verdad-body">' +
          '<div style="padding:8px 12px;border-radius:6px;background:' + (totalProblemas===0?'#eef8f0':'#fdeeee') + ';border:1px solid ' + (totalProblemas===0?'#b8e0c0':'#f0b8b8') + ';font-size:12px;font-weight:700;color:' + resumenColor + ';margin-bottom:12px">' + esc(resumenTexto) + '</div>' +
          filas +
        '</div>' +
      '</div>';

    // Guardar resultados en window para que los botones los usen
    window._sxPdfResultados = resultados;

    // Bindear botones de acción
    zona.querySelectorAll('[data-pvr-idx]').forEach(function(btn) {
      btn.onclick = async function() {
        var idx2 = parseInt(btn.getAttribute('data-pvr-idx'));
        var accion = btn.getAttribute('data-pvr-accion');
        var res = (window._sxPdfResultados || [])[idx2];
        if (!res || !res.plan) return;
        var prog = document.getElementById('pvr-prog-' + idx2);
        var row  = document.getElementById('pvr-row-' + idx2);

        btn.disabled = true;
        btn.textContent = '⏳ Procesando…';
        if (prog) prog.textContent = 'Iniciando…';

        try {
          if (accion === 'eliminar') {
            if (prog) prog.textContent = 'Eliminando ' + res.plan.ids.length + ' movimiento(s)…';
            if (typeof reconciliarAplicar !== 'function') throw new Error('reconciliarAplicar no disponible');
            await reconciliarAplicar(res.plan.ids, { confirmar: true });
            if (row) row.className = 'pvr ok';
            if (row) row.querySelector('.pvr-title').textContent = '✅ Versión ' + folio + res.letra + ' — corregida exitosamente';
            if (row) row.querySelector('.pvr-sub').textContent = 'Se eliminaron ' + res.plan.ids.length + ' movimiento(s). Contabilidad cuadra en ' + fmt(res.plan.montoResultante) + '.';
            btn.remove();
            if (prog) { prog.textContent = ''; prog.style.color = '#1a7a3a'; prog.textContent = 'Sincronizado con Supabase.'; }
            setTimeout(function() { if (typeof render === 'function') render(); }, 800);

          } else if (accion === 'crear') {
            if (prog) prog.textContent = 'Creando movimiento desde PDF…';
            if (typeof _registrarMovimiento !== 'function') throw new Error('_registrarMovimiento no disponible');
            var ok = _registrarMovimiento(res.plan.mov);
            if (!ok) throw new Error('El movimiento ya existe o fue rechazado por deduplicación.');
            if (typeof save === 'function') save();
            if (typeof renderCaja === 'function') renderCaja();
            if (typeof renderContab === 'function') renderContab();
            if (row) row.className = 'pvr ok';
            if (row) row.querySelector('.pvr-title').textContent = '✅ Versión ' + folio + res.letra + ' — movimiento creado exitosamente';
            if (row) row.querySelector('.pvr-sub').textContent = 'Nuevo movimiento ' + esc(res.plan.mov.id) + ' · ' + fmt(res.plan.mov.monto) + ' · ' + esc(res.plan.mov.estatus) + ' · origen: PDF-RECONSTRUIDO.';
            btn.remove();
            if (prog) { prog.style.color = '#1a7a3a'; prog.textContent = 'Sincronizado con Supabase.'; }
            setTimeout(function() { if (typeof render === 'function') render(); }, 800);
          }
        } catch(e) {
          btn.disabled = false;
          btn.textContent = '❌ Error — reintentar';
          if (prog) { prog.style.color = '#c0161a'; prog.textContent = 'Error: ' + esc(e && e.message ? e.message : String(e)); }
        }
      };
    });
  }

  window.__sxLeerPdf = async function (folio, letraV, btn) {

    var r = _recibos().find(function (x) { return String(x.folio) === String(folio) && letra(x) === String(letraV).toUpperCase() && !x.esComplemento; });
    var out = document.getElementById('sx-ocr-out');
    var setOut = function (h) { if (out) { out.style.display = 'block'; out.innerHTML = h; } };
    if (!r) { setOut('<b>No se encontró la versión ' + esc(folio + letraV) + '.</b>'); return; }
    if (typeof window.obtenerBlobPdfReciboValidado !== 'function' || typeof _ocrExtraerTexto !== 'function') {
      setOut('<b style="color:#c0161a">El lector OCR no está disponible.</b> Carga el index.html nuevo (necesita _ocrExtraerTexto y el visor de PDF).'); return;
    }
    if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
    setOut('<b>📄 ' + esc(folio + letraV) + ':</b> recuperando el PDF de R2…');
    try {
      var blob = await window.obtenerBlobPdfReciboValidado(r);
      if (!blob) { setOut('<b style="color:#c0161a">No se encontró el PDF de ' + esc(folio + letraV) + ' en R2.</b> (El PDF puede no haberse subido nunca.)'); return; }
      var res = await _ocrExtraerTexto(blob, function (msg) { setOut('<b>📄 ' + esc(folio + letraV) + ':</b> ' + esc(msg)); });
      var texto = (res && res.texto) || '';
      var metodo = (res && res.metodo) || (res ? 'mistral' : '—');
      if (!texto) { setOut('<b style="color:#c0161a">No se pudo extraer texto del PDF de ' + esc(folio + letraV) + '.</b>'); return; }

      // Usar _rfcParsearPDF si esta disponible (mismo criterio que Restaurar Flujo Contable)
      // para que ambos sistemas compartan exactamente la misma logica de lectura.
      var campos = (typeof _rfcParsearPDF === 'function') ? _rfcParsearPDF(texto) : _sxParsearPDF(texto);
      var cants = _sxExtraerCantidades(texto);
      var d2 = reconstruirFolio(folio);
      var v = (d2.flujo || []).filter(function (x) { return x.letra === String(letraV).toUpperCase(); })[0];
      var contab = v ? v.montoContab : null;
      var nMovs = v ? v.nMovs : 0;
      var nIng = v ? v.nIngresos : 0;

      // El PAGO RECIBIDO del PDF es lo que ESTE recibo cobró: la verdad.
      // Misma funcion de extraccion de monto que RFC para criterio unificado
      var pagoPdf = (typeof _rfcMonto === 'function') ? _rfcMonto(campos) : _sxMontoRecibo(campos);

      // Tabla de campos clave del recibo (la verdad documental)
      var camposRows = [
        ['COSTO DEL TRÁMITE', campos.costoTramite],
        ['PAGO RECIBIDO (este recibo)', campos.pagoRecibido],
        ['SALDO ANTERIOR', campos.saldoAnterior],
        ['SALDO RESTANTE', campos.saldoRestante]
      ].filter(function (x) { return x[1] != null; }).map(function (x) {
        return '<tr><td>' + esc(x[0]) + '</td><td style="text-align:right"><b>' + fmt(x[1]) + '</b></td></tr>';
      }).join('');

      // VEREDICTO usando el PDF como arbitro
      var veredicto;

      // CANCELACIONES: comparar solo el cuadro de cancelacion (EGRESO/INGRESO) en valor absoluto.
      // Puede ser rojo (reintegro) o verde (honorarios). PAGO RECIBIDO siempre es $0, ignorarlo.
      var esCan = !!(campos && campos.esCancelacion);
      var contabCmp = (esCan && contab != null) ? Math.abs(contab) : contab;
      var tipoCan   = esCan ? (campos.tipoCancel || 'egreso') : null;

      if (esCan) {
        // Rama exclusiva para cancelaciones
        if (pagoPdf == null || pagoPdf <= 0) {
          veredicto = '<span style="color:#b06a00;font-weight:700">Sin monto en cuadro de cancelacion.</span> El PDF tiene TRAMITE CANCELADO pero no se detecto EGRESO ni INGRESO en el cuadro de cancelacion.';
        } else if (contabCmp == null) {
          veredicto = '<span style="color:#7a6840">Cancelacion sin movimiento en contabilidad para comparar.</span> Cuadro de cancelacion: ' + (tipoCan === 'egreso' ? 'EGRESO' : 'INGRESO') + ' <b>' + fmt(pagoPdf) + '</b>.';
        } else if (Math.abs(pagoPdf - contabCmp) <= 0.5) {
          veredicto = '<span style="color:#1a7a3a;font-weight:700">OK CORRECTO.</span> Cancelacion — cuadro de cancelacion del PDF dice <b>' + (tipoCan === 'egreso' ? 'EGRESO' : 'INGRESO') + ': ' + fmt(pagoPdf) + '</b> y contabilidad tiene exactamente eso (' + fmt(contab) + ').';
        } else {
          var difCan = +(contabCmp - pagoPdf).toFixed(2);
          veredicto = '<span style="color:#c0161a;font-weight:700">NO COINCIDE.</span> Cancelacion — cuadro de cancelacion del PDF dice <b>' + (tipoCan === 'egreso' ? 'EGRESO' : 'INGRESO') + ': ' + fmt(pagoPdf) + '</b>, pero contabilidad tiene <b>' + fmt(contab) + '</b> (' + (difCan > 0 ? 'sobran ' : 'faltan ') + fmt(Math.abs(difCan)) + ').';
        }
      } else if (contab == null) {
        veredicto = '<span style="color:#7a6840">Esta version no tiene movimiento en contabilidad para comparar.</span>';
      } else if (pagoPdf == null) {
        // No se encontro PAGO RECIBIDO - caer a comparacion generica
        var enPdf = cants.some(function (c) { return Math.abs(c.val - contab) <= 0.5; });
        veredicto = enPdf
          ? '<span style="color:#1a7a3a;font-weight:700">OK El monto de contabilidad (' + fmt(contab) + ') aparece en el PDF.</span> <span style="font-size:10.5px;color:#7a6840">(No se hallo el campo PAGO RECIBIDO; comparacion aproximada.)</span>'
          : '<span style="color:#c0161a;font-weight:700">NO aparece el monto de contabilidad (' + fmt(contab) + ') en el PDF.</span>';
      } else if (Math.abs(pagoPdf - contab) <= 0.5 && nIng <= 1) {
        veredicto = '<span style="color:#1a7a3a;font-weight:700">OK CORRECTO.</span> El PDF dice que este recibo cobro <b>' + fmt(pagoPdf) + '</b>, y contabilidad tiene exactamente eso en un solo asiento.';
      } else if (Math.abs(pagoPdf - contab) <= 0.5 && nIng > 1) {
        veredicto = '<span style="color:#b06a00;font-weight:700">MONTO CORRECTO PERO PARTIDO.</span> El PDF dice que este recibo cobro <b>' + fmt(pagoPdf) + '</b> en UN pago, pero contabilidad lo tiene en <b>' + nIng + ' asientos</b>. El total coincide; sobran asientos que deberian consolidarse en uno de ' + fmt(pagoPdf) + '.';
      } else {
        var difPdf = +(contab - pagoPdf).toFixed(2);
        veredicto = '<span style="color:#c0161a;font-weight:700">NO COINCIDE.</span> El PDF (documento firmado) dice que este recibo cobro <b>' + fmt(pagoPdf) + '</b>, pero contabilidad tiene <b>' + fmt(contab) + '</b> (' + (difPdf > 0 ? 'sobran ' : 'faltan ') + fmt(Math.abs(difPdf)) + '). La verdad es el PDF: contabilidad deberia decir ' + fmt(pagoPdf) + ' en esta version.';
      }

      var filasGen = cants.filter(function (c) { return c.etiqueta; }).map(function (c) {
        return '<tr><td>' + esc(c.etiqueta) + '</td><td style="text-align:right">' + fmt(c.val) + '</td></tr>';
      }).join('');

      setOut(
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<b>📄 PDF de ' + esc(folio + letraV) + ' (fuente de verdad)</b>' +
        '<span style="font-size:10px;color:#7a6840">leído con: ' + esc(metodo) + (metodo.indexOf('mistral') >= 0 ? ' (Mistral)' : ' (gratis, sin IA)') + '</span></div>' +
        '<div style="margin-bottom:10px;padding:10px;background:#fff;border-radius:7px;border:1px solid #e2d9c0">' + veredicto + '</div>' +
        (camposRows ? '<div style="font-size:10.5px;color:#c8952a;font-weight:700;margin-bottom:4px">CAMPOS DEL RECIBO (lo que dice el documento)</div><table style="width:100%;font-size:12px;margin-bottom:8px"><tbody>' + camposRows + '</tbody></table>'
          : '<div style="color:#b06a00;font-size:11.5px;margin-bottom:8px">No se hallaron los campos estándar (COSTO/PAGO RECIBIDO/SALDO). Puede ser un recibo de formato viejo. ' + (filasGen ? 'Cifras detectadas:' : '') + '</div>' + (filasGen ? '<table style="width:100%;font-size:12px;margin-bottom:8px"><tbody>' + filasGen + '</tbody></table>' : '')) +
        '<button class="pdfbtn" onclick="__sxVerPdf(' + folio + ',\'' + letraV + '\',this)">📄 Abrir PDF</button> ' +
        '<button class="pdfbtn" onclick="__sxVerTexto(this)" data-txt="' + esc(texto.slice(0, 4000)) + '">Ver texto extraído</button>'
      );
    } catch (e) {
      setOut('<b style="color:#c0161a">Error al leer el PDF:</b> ' + esc(e && e.message ? e.message : e));
    } finally {
      if (btn) { btn.textContent = '🔍 Leer PDF'; btn.disabled = false; }
    }
  };
  window.__sxVerTexto = function (btn) {
    var t = btn.getAttribute('data-txt') || '';
    var w = window.open('', '_blank');
    if (w) { w.document.write('<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;padding:20px">' + t.replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }) + '</pre>'); }
  };

  // Abrir el PDF real de una versión concreta (A, B, C…) en pestaña nueva
  window.__sxVerPdf = async function (folio, letraV, btn) {
    var r = _recibos().find(function (x) { return String(x.folio) === String(folio) && letra(x) === String(letraV).toUpperCase() && !x.esComplemento; });
    if (!r) { alert('No se encontró la versión ' + folio + letraV + ' en el sistema.'); return; }
    var r = _recibos().find(function (x) { return String(x.folio) === String(folio) && letra(x) === String(letraV).toUpperCase() && !x.esComplemento; });
    if (!r) { alert('No se encontró la versión ' + folio + letraV + ' en el sistema.'); return; }
    if (typeof window.obtenerBlobPdfReciboValidado !== 'function') { alert('El visor de PDF no está disponible (carga el index.html nuevo).'); return; }
    var txt = btn ? btn.textContent : '';
    if (btn) { btn.textContent = '⏳ Buscando…'; btn.disabled = true; }
    try {
      var blob = await window.obtenerBlobPdfReciboValidado(r);
      if (!blob) { alert('No se encontró el PDF de ' + folio + letraV + ' en R2.\n\nEsto puede significar que el PDF nunca se subió o que el nombre del archivo no coincide. Es justo lo que conviene revisar para este folio.'); return; }
      var url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    } catch (e) {
      alert('Error al recuperar el PDF: ' + (e && e.message ? e.message : e));
    } finally {
      if (btn) { btn.textContent = txt; btn.disabled = false; }
    }
  };

  // ===== Render del panel (si hay DOM) =====
  if (typeof document === 'undefined') return;

  function inyectarEstilos() {
    if (document.getElementById('sxpro-css')) return;
    var s = document.createElement('style'); s.id = 'sxpro-css';
    s.textContent =
      '#sxpro-ov{position:fixed;inset:0;z-index:999999;background:rgba(26,16,8,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;font-family:"DM Mono","JetBrains Mono",monospace}' +
      '#sxpro{width:min(1420px,98vw);height:min(94vh,960px);background:#fdfaf4;border:1.5px solid #c8952a;border-radius:14px;box-shadow:0 24px 70px rgba(26,16,8,.5);display:flex;flex-direction:column;overflow:hidden}' +
      '#sxpro .hd{display:flex;align-items:center;gap:14px;padding:14px 18px;background:#1a1008;color:#f5f0e0;border-bottom:1.5px solid #c8952a}' +
      '#sxpro .hd b{font-size:15px;letter-spacing:.04em;color:#e8c875}' +
      '#sxpro .hd .sp{flex:1}' +
      '#sxpro .pill{font-size:11px;padding:3px 10px;border-radius:20px;border:1px solid #c8952a;color:#e8c875;background:rgba(200,149,42,.12)}' +
      '#sxpro .x{cursor:pointer;font-size:20px;color:#e8c875;background:none;border:none;padding:0 4px}' +
      '#sxpro .tabs{display:flex;gap:0;background:#f5f0e0;border-bottom:1px solid #e2d9c0}' +
      '#sxpro .tab{padding:11px 20px;cursor:pointer;font-size:12.5px;font-weight:600;color:#7a6840;border-bottom:2.5px solid transparent}' +
      '#sxpro .tab.on{color:#1a1008;border-bottom-color:#c8952a;background:#fdfaf4}' +
      '#sxpro .body{flex:1;min-height:0;overflow:hidden;display:flex}' +
      '#sxpro .side{width:300px;min-height:0;border-right:1px solid #e2d9c0;overflow-y:auto;background:#faf6ec}' +
      '#sxpro .main{flex:1;min-height:0;overflow-y:auto;padding:18px 22px 60px}' +
      '#sxpro .srch{padding:12px;border-bottom:1px solid #e2d9c0}' +
      '#sxpro .srch input{width:100%;box-sizing:border-box;padding:9px 11px;border:1.5px solid #c8952a;border-radius:8px;font-family:inherit;font-size:13px;background:#fff;color:#1a1008}' +
      '#sxpro .fitem{padding:10px 13px;border-bottom:1px solid #efe8d6;cursor:pointer;font-size:12px}' +
      '#sxpro .fitem:hover{background:#f5efd8}' +
      '#sxpro .fitem.on{background:#f0e6c8;border-left:3px solid #c8952a}' +
      '#sxpro .fitem .f{font-weight:700;color:#1a1008}' +
      '#sxpro .fitem .c{color:#7a6840;font-size:10.5px;margin-top:2px}' +
      '#sxpro .badge{display:inline-block;font-size:9.5px;padding:1px 7px;border-radius:10px;font-weight:700;margin-left:4px}' +
      '#sxpro .b-DUPLICADO{background:#fde8e8;color:#c0161a}#sxpro .b-SOBRA{background:#fff0db;color:#b06a00}#sxpro .b-FALTA{background:#fff0db;color:#b06a00}#sxpro .b-DUP_SIN_IMPACTO{background:#fdf6d8;color:#8a6d00}#sxpro .b-OK{background:#e6f5ea;color:#1a7a3a}' +
      '#sxpro h3{margin:0 0 4px;font-size:18px;color:#1a1008}' +
      '#sxpro .sub{color:#7a6840;font-size:12px;margin-bottom:16px}' +
      '#sxpro .card{background:#fff;border:1px solid #e2d9c0;border-radius:10px;padding:14px 16px;margin-bottom:14px}' +
      '#sxpro .card h4{margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#c8952a}' +
      '#sxpro .kv{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:1px dashed #efe8d6}' +
      '#sxpro .kv b{color:#1a1008}' +
      '#sxpro .tl{position:relative;padding-left:18px}' +
      '#sxpro .tl .ev{position:relative;padding:6px 0 10px 0;font-size:12.5px;border-left:2px solid #e2d9c0;padding-left:14px;margin-left:2px}' +
      '#sxpro .tl .ev:before{content:"";position:absolute;left:-6px;top:9px;width:9px;height:9px;border-radius:50%;background:#c8952a}' +
      '#sxpro .tl .ev .d{color:#7a6840;font-size:10.5px}' +
      '#sxpro table{width:100%;border-collapse:collapse;font-size:12px}' +
      '#sxpro th{text-align:left;color:#7a6840;font-weight:600;padding:6px 8px;border-bottom:1.5px solid #e2d9c0;font-size:10.5px;text-transform:uppercase}' +
      '#sxpro td{padding:7px 8px;border-bottom:1px solid #efe8d6}' +
      '#sxpro tr.dup td{background:#fdeeee}' +
      '#sxpro .tag{font-size:9.5px;padding:1px 6px;border-radius:8px;font-weight:700}' +
      '#sxpro .tag.recup{background:#fde8e8;color:#c0161a}#sxpro .tag.real{background:#e6f5ea;color:#1a7a3a}#sxpro .tag.pdf-rec{background:#e8f5ec;color:#0f5228;border:1px solid #b8e0c0}' +
      '#sxpro .pdfbtn{font-family:inherit;font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:7px;border:1px solid #c8952a;background:#fff;color:#8c6518;cursor:pointer}' +
      '#sxpro .pdfbtn:hover{background:#c8952a;color:#fff}#sxpro .pdfbtn:disabled{opacity:.6;cursor:wait}' +
      '#sxpro .btn-pdf-verdad{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:9px 16px;border-radius:8px;border:none;background:#1a1008;color:#e8c875;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;letter-spacing:.02em;transition:all .2s}' +
      '#sxpro .btn-pdf-verdad:hover{background:#2a1e0a;box-shadow:0 0 0 1.5px #c8952a}' +
      '#sxpro .btn-pdf-verdad:disabled{opacity:.5;cursor:wait}' +
      '#sxpro .pdf-verdad-panel{margin-top:14px;border:1.5px solid #c8952a;border-radius:10px;overflow:hidden}' +
      '#sxpro .pdf-verdad-hd{background:#1a1008;color:#e8c875;padding:10px 14px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px}' +
      '#sxpro .pdf-verdad-body{padding:14px;background:#fdfaf4}' +
      '#sxpro .pvr{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 12px;border-radius:8px;margin-bottom:8px;gap:8px}' +
      '#sxpro .pvr.ok{background:#eef8f0;border:1px solid #b8e0c0}' +
      '#sxpro .pvr.sobra{background:#fdeeee;border:1px solid #f0b8b8}' +
      '#sxpro .pvr.falta{background:#fff8ec;border:1px solid #e8d888}' +
      '#sxpro .pvr.partido{background:#fff3e0;border:1px solid #f0c878}' +
      '#sxpro .pvr.sin-pdf{background:#f5f5f5;border:1px dashed #ccc}' +
      '#sxpro .pvr-info{flex:1;min-width:0}' +
      '#sxpro .pvr-title{font-size:12.5px;font-weight:700;margin-bottom:3px}' +
      '#sxpro .pvr-sub{font-size:11px;color:#7a6840;line-height:1.5}' +
      '#sxpro .pvr-accion{flex-shrink:0}' +
      '#sxpro .btn-pvr-accion{padding:6px 12px;border-radius:6px;border:none;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:all .15s}' +
      '#sxpro .btn-pvr-del{background:#c0161a;color:#fff}#sxpro .btn-pvr-del:hover{background:#8b0010}' +
      '#sxpro .btn-pvr-del:disabled{opacity:.5;cursor:wait}' +
      '#sxpro .btn-pvr-new{background:#1a7a3a;color:#fff}#sxpro .btn-pvr-new:hover{background:#0f5228}' +
      '#sxpro .btn-pvr-new:disabled{opacity:.5;cursor:wait}' +
      '#sxpro .btn-pvr-fix{background:#8c6518;color:#fff}#sxpro .btn-pvr-fix:hover{background:#5a4010}' +
      '#sxpro .btn-pvr-fix:disabled{opacity:.5;cursor:wait}' +
      '#sxpro .pvr-progreso{font-size:11px;color:#7a6840;font-family:monospace;margin-top:4px}' +
      '#sxpro .dx{border-radius:10px;padding:16px;margin-bottom:14px}' +
      '#sxpro .dx.DUPLICADO{background:#fdeeee;border:1px solid #f0b8b8}#sxpro .dx.SOBRA,#sxpro .dx.FALTA{background:#fff6e8;border:1px solid #f0d8a8}#sxpro .dx.DUP_SIN_IMPACTO{background:#fdf9e8;border:1px solid #e8dca0}#sxpro .dx.OK{background:#eef8f0;border:1px solid #b8e0c0}' +
      '#sxpro .dx .t{font-size:15px;font-weight:700;margin-bottom:8px;color:#1a1008}' +
      '#sxpro .dx p{margin:6px 0;font-size:13px;line-height:1.55;color:#3a2c1a}' +
      '#sxpro .act{display:inline-block;margin-top:10px;padding:9px 16px;border-radius:8px;border:none;background:#c0161a;color:#fff;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer}' +
      '#sxpro .act:hover{background:#a01015}' +
      '#sxpro .act.sim{background:#1a1008}' +
      '#sxpro .err{font-size:11.5px;border-bottom:1px solid #efe8d6;padding:9px 4px}' +
      '#sxpro .err .m{color:#c0161a;font-weight:600}#sxpro .err.warn .m{color:#a8730c}#sxpro .err .mod{color:#7a6840}#sxpro .err .st{color:#999;font-size:10px;white-space:pre-wrap;max-height:0;overflow:hidden;transition:max-height .2s}' +
      '#sxpro .err.open .st{max-height:200px;overflow:auto}' +
      '#sxpro .empty{color:#7a6840;text-align:center;padding:40px;font-size:13px}';
    document.head.appendChild(s);
  }

  var _sel = null, _tab = 'dx';

  function abrirPanel() {
    inyectarEstilos();
    var prev = document.getElementById('sxpro-ov'); if (prev) prev.remove();
    var ov = document.createElement('div'); ov.id = 'sxpro-ov';
    ov.innerHTML =
      '<div id="sxpro">' +
      '<div class="hd"><b>⚖ SCANSYS PRO</b><span class="pill" id="sxpro-n"></span>' +
      '<span class="pill" title="Versión del archivo index.html que está cargado ahora mismo">BUILD ' + (window.LEX_BUILD||'?') + '</span>' +
      '<span class="sp"></span>' +
      '<button id="sxpro-limpiar-todo" style="font-family:inherit;font-size:11px;font-weight:700;padding:4px 12px;border-radius:6px;border:1.5px solid #e8c875;background:rgba(192,22,26,0.18);color:#ffb8b8;cursor:pointer;margin-right:6px;display:none;" title="Eliminar todos los duplicados con solución segura (idsEliminar definidos)">⚡ Limpiar todos</button>' +
      '<span class="pill" id="sxpro-ne"></span><button class="x" id="sxpro-x">✕</button></div>' +
      '<div class="tabs"><div class="tab on" data-t="dx">🩺 Diagnóstico de Folios</div><div class="tab" data-t="err">⚠️ Errores del Sistema</div><div class="tab" data-t="checador">🕐 Checador</div></div>' +
      '<div class="body" id="sxpro-body"></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.getElementById('sxpro-x').onclick = function () { ov.remove(); };
    Array.prototype.forEach.call(ov.querySelectorAll('.tab'), function (t) {
      t.onclick = function () {
        Array.prototype.forEach.call(ov.querySelectorAll('.tab'), function (x) { x.classList.remove('on'); });
        t.classList.add('on'); _tab = t.getAttribute('data-t'); window._sxRender();
      };
    });
    window._sxRender();
  }

  function render() {
    var probs = foliosConProblema();
    document.getElementById('sxpro-n').textContent = probs.length + ' folio(s) con problema';
    // Igual que renderErrores(): no contar los 'info' (avisos de arranque,
    // no son errores) para que el número de aquí coincida con lo que se ve
    // al entrar a la pestaña "Errores del Sistema".
    var nerr = (window.LEX_ERRORS || []).filter(function(e){ return e.nivel !== 'info'; }).length;
    document.getElementById('sxpro-ne').textContent = nerr + ' error(es) JS';

    // Botón Limpiar Todos: visible solo si hay folios con idsEliminar definidos
    var btnLimpiarTodo = document.getElementById('sxpro-limpiar-todo');
    if (btnLimpiarTodo) {
      var foliosLimpiables = probs.filter(function (d) { return d.diag.idsEliminar && d.diag.idsEliminar.length > 0; });
      if (foliosLimpiables.length > 0) {
        btnLimpiarTodo.style.display = 'inline-block';
        btnLimpiarTodo.textContent = '⚡ Limpiar ' + foliosLimpiables.length + ' folio(s) seguros';
        btnLimpiarTodo.onclick = function () {
          var todosIds = [];
          foliosLimpiables.forEach(function (d) {
            d.diag.idsEliminar.forEach(function (id) { if (todosIds.indexOf(id) < 0) todosIds.push(id); });
          });
          var totalMonto = 0;
          if (typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
            totalMonto = D.movimientos
              .filter(function (m) { return m && todosIds.indexOf(m.id) >= 0; })
              .reduce(function (s, m) { return s + (parseFloat(m.monto) || 0); }, 0);
          }
          var body2 = document.getElementById('sxpro-body');
          var main2 = body2 ? body2.querySelector('#sxpro-main') : null;
          if (!main2) return;
          var resumen = foliosLimpiables.map(function (d) {
            return '<tr><td><b>#' + esc(d.vigente) + '</b></td><td>' + esc(d.cliente.slice(0,30)) + '</td>' +
              '<td style="color:#c0161a;font-weight:700">' + esc(d.diag.estado) + '</td>' +
              '<td style="font-family:monospace">' + d.diag.idsEliminar.length + ' mov.</td>' +
              '<td style="font-family:monospace;color:#c0161a">$' + Math.abs(d.dif).toFixed(2) + '</td></tr>';
          }).join('');
          main2.innerHTML =
            '<div style="padding:18px 22px;">' +
            '<h3 style="margin:0 0 6px;color:#c0161a">⚡ Limpieza masiva — ' + foliosLimpiables.length + ' folio(s)</h3>' +
            '<p style="font-size:12.5px;color:#3a2c1a;margin:0 0 14px">Los siguientes folios tienen duplicados que el sistema puede resolver de forma segura. <b>Total: ' + todosIds.length + ' movimiento(s) · $' + totalMonto.toFixed(2) + '</b></p>' +
            '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px"><thead><tr style="background:#f5ead8"><th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#7a6840">Folio</th><th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#7a6840">Cliente</th><th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#7a6840">Estado</th><th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#7a6840">Movs.</th><th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#7a6840">Diferencia</th></tr></thead><tbody>' + resumen + '</tbody></table>' +
            '<div style="padding:10px 14px;background:#fff8ec;border:1px solid #e8c875;border-radius:8px;font-size:12px;color:#8c6518;margin-bottom:14px">⚠ Folios con <b>SOBRA manual</b> o <b>FALTA</b> NO están incluidos — requieren revisión manual del PDF antes de tocarlos.</div>' +
            '<div style="display:flex;gap:10px;"><button id="sx-masivo-confirmar" style="flex:1;padding:11px 0;border-radius:8px;border:none;background:#c0161a;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">🗑 Confirmar limpieza de ' + todosIds.length + ' movimiento(s)</button><button id="sx-masivo-cancelar" style="padding:11px 18px;border-radius:8px;border:1.5px solid #c8952a;background:#fff;color:#8c6518;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">Cancelar</button></div>' +
            '<div id="sx-masivo-progreso" style="margin-top:12px;display:none;font-size:12.5px;color:#7a6840;font-family:monospace;"></div>' +
            '</div>';
          document.getElementById('sx-masivo-cancelar').onclick = function () { window._sxRender(); };
          document.getElementById('sx-masivo-confirmar').onclick = function () {
            var btnC = this; btnC.disabled = true; btnC.textContent = '⏳ Eliminando…';
            var prog = document.getElementById('sx-masivo-progreso');
            prog.style.display = 'block';
            if (typeof reconciliarAplicar !== 'function') {
              prog.innerHTML = '<b style="color:#c0161a">❌ reconciliarAplicar no disponible. Inicia sesión.</b>';
              btnC.disabled = false; return;
            }
            prog.textContent = 'Procesando ' + todosIds.length + ' movimiento(s)…';
            reconciliarAplicar(todosIds, { confirmar: true }).then(function (res) {
              var eliminados = res && res.eliminados ? res.eliminados.length : todosIds.length;
              var m3 = document.getElementById('sxpro-main') || main2;
              m3.innerHTML =
                '<div style="text-align:center;padding:40px 20px;">' +
                '<div style="font-size:2.5rem;margin-bottom:12px;">✅</div>' +
                '<h3 style="color:#1a7a3a;margin:0 0 8px">Limpieza completada</h3>' +
                '<p style="font-size:13px;color:#3a2c1a;margin:0 0 4px"><b>' + eliminados + ' movimiento(s)</b> eliminados en <b>' + foliosLimpiables.length + ' folio(s)</b>.</p>' +
                '<p style="font-size:12px;color:#7a6840;margin:0 0 20px">Contabilidad sincronizada con Supabase.</p>' +
                '<button onclick="window._sxRender()" style="padding:9px 22px;border-radius:8px;border:none;background:#1a7a3a;color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;">Ver estado actualizado</button>' +
                '</div>';
            }).catch(function (e) {
              prog.innerHTML = '<b style="color:#c0161a">❌ Error: ' + esc(e && e.message ? e.message : String(e)) + '</b>';
              btnC.disabled = false; btnC.textContent = '🗑 Reintentar';
            });
          };
        };
      } else {
        btnLimpiarTodo.style.display = 'none';
      }
    }

    var body = document.getElementById('sxpro-body');
    if (_tab === 'err') { body.innerHTML = renderErrores(); bindErrores(); return; }
    if (_tab === 'checador') {
      body.innerHTML = '<div id="ss-body-checador" style="padding:22px 26px;"></div>';
      if (typeof _renderChecador === 'function') _renderChecador();
      return;
    }

    // pestaña diagnóstico
    var side = probs.map(function (d) {
      return '<div class="fitem' + (_sel === d.folio ? ' on' : '') + '" data-f="' + d.folio + '">' +
        '<div class="f">#' + esc(d.vigente) + '<span class="badge b-' + d.diag.estado + '">' + d.diag.estado + '</span></div>' +
        '<div class="c">' + esc(d.cliente.slice(0, 26)) + ' · dif ' + fmt(d.dif) + '</div></div>';
    }).join('') || '<div class="empty">✅ Sin folios con problema</div>';

    body.innerHTML =
      '<div class="side"><div class="srch"><input id="sxpro-srch" placeholder="Buscar folio… ej: 86" /></div>' + side + '</div>' +
      '<div class="main" id="sxpro-main">' + (_sel ? renderFicha(_sel) : '<div class="empty">Selecciona un folio de la izquierda o búscalo arriba para ver su historia completa y diagnóstico.</div>') + '</div>';

    var inp = document.getElementById('sxpro-srch');
    inp.onkeydown = function (e) { if (e.key === 'Enter') { var v = inp.value.replace(/[^0-9]/g, ''); if (v) { _sel = v; window._sxRender(); } } };
    Array.prototype.forEach.call(body.querySelectorAll('.fitem'), function (it) {
      it.onclick = function () { _sel = it.getAttribute('data-f'); window._sxRender(); };
    });
    bindAcciones();
  }
  function renderFicha(folio) {
    var d = reconstruirFolio(folio);
    if (!d || !d.existe) return '<div class="empty">No existe el folio #' + esc(folio) + ' en el sistema.</div>';

    var tl = d.timeline.map(function (e) {
      var esRecupEv = e.quien && (e.quien.indexOf('AUTO-PROTECTOR') >= 0 || e.quien.indexOf('PDF-RECONSTRUIDO') >= 0);
      var esPdfRec  = e.quien && e.quien.indexOf('PDF-RECONSTRUIDO') >= 0;
      var dotColor  = esPdfRec ? '#1a7a3a' : esRecupEv ? '#c0161a' : '#c8952a';
      var bgColor   = esPdfRec ? 'rgba(26,122,58,.05)' : esRecupEv ? 'rgba(192,22,26,.04)' : 'transparent';
      var badge     = esPdfRec ? '<span style="font-size:9px;padding:1px 6px;border-radius:4px;background:#e6f5ea;color:#1a7a3a;font-weight:700;margin-left:6px">PDF-RECONSTRUIDO</span>'
                    : esRecupEv ? '<span style="font-size:9px;padding:1px 6px;border-radius:4px;background:#fdeeee;color:#c0161a;font-weight:700;margin-left:6px">AUTO-PROTECTOR</span>'
                    : '';
      return '<div class="ev" style="background:' + bgColor + ';border-radius:6px;padding:6px 8px 8px 14px">'
        + '<span style="position:absolute;left:-6px;top:12px;width:10px;height:10px;border-radius:50%;background:' + dotColor + ';border:2px solid #fdfaf4"></span>'
        + '<b>' + esc(e.evento) + '</b>' + badge
        + '<div class="d">📅 ' + esc(e.fecha) + (e.hora ? ' · 🕐 ' + esc(e.hora) + ' hrs' : '') +
        ' · registrado: ' + esc(e.quien) + (e.descripcion ? '<br><span style="color:#999">' + esc((e.descripcion || '').slice(0, 80)) + '</span>' : '') + '</div></div>';
    }).join('') || '<div class="d" style="color:#7a6840;font-size:12px">Este folio no tiene movimientos en contabilidad (su historia no se puede reconstruir desde aquí).</div>';

    var movRows = d.movimientos.map(function (m) {
      var dup = d.diag.idsEliminar.indexOf(m.id) >= 0;
      var esPdfRec = m.origen === 'PDF-RECONSTRUIDO' || (m.id && m.id.indexOf('M-PDF-') === 0);
      var tagCls   = m.origen === 'AUTO-PROTECTOR' ? 'recup' : esPdfRec ? 'pdf-rec' : 'real';
      var tagLabel = m.origen || (esPdfRec ? 'PDF-RECONSTRUIDO' : 'AL GUARDAR');
      return '<tr class="' + (dup ? 'dup' : '') + '">' +
        '<td><code style="font-size:10.5px">' + esc(m.id) + '</code></td>' +
        '<td>' + esc(m.letra) + '</td>' +
        '<td>' + fmt(m.monto) + '</td>' +
        '<td>' + esc(m.estatus) + '</td>' +
        '<td><span class="tag ' + tagCls + '">' + esc(tagLabel) + '</span></td>' +
        '<td>' + esc(fmtFecha(m.fecha)) + '</td></tr>';
    }).join('');

    var dg = d.diag;
    var accion = '';
    if (dg.idsEliminar.length) {
      // Caso seguro: el sistema identificó exactamente qué borrar
      accion = '<button class="act sim" data-sim=\'' + JSON.stringify(dg.idsEliminar) + '\'>👁 Ver qué se borra</button> ' +
        '<button class="act" data-del=\'' + JSON.stringify(dg.idsEliminar) + '\'>🗑 Eliminar ' + dg.idsEliminar.length + ' y cuadrar en ' + fmt(d.esperado) + '</button>';
    } else if (dg.estado === 'SOBRA' && dg.manual) {
      // SOBRA manual: detectar si hay un único candidato M-RECUP- o M-PROT- que explique la sobra
      var candidatos = d.movimientos.filter(function (m) {
        if (!m || !m.id) return false;
        var esRecup = m.id.indexOf('M-RECUP-') === 0 || m.id.indexOf('M-PROT-') === 0;
        if (!esRecup) return false;
        // ¿Quitando este movimiento el total cuadra?
        var sinEste = d.movimientos.filter(function (x) { return x !== m; })
          .reduce(function (s, x) { return s + (x.tipo === 'egreso' ? -(parseFloat(x.monto)||0) : (parseFloat(x.monto)||0)); }, 0);
        return Math.abs(sinEste - d.esperado) <= 0.5;
      });
      if (candidatos.length === 1) {
        var c = candidatos[0];
        accion = '<div style="margin-top:10px;padding:10px 12px;background:#fff0f0;border:1px solid #f0b8b8;border-radius:7px;font-size:12px;">' +
          '<b style="color:#c0161a">Candidato detectado automáticamente:</b> ' +
          '<code style="font-size:10.5px">' + esc(c.id) + '</code> · $' + fmt(parseFloat(c.monto)||0) + '<br>' +
          '<span style="color:#7a6840">Quitando este movimiento, el folio cuadra exactamente en ' + fmt(d.esperado) + '.</span><br>' +
          '<button class="act" style="margin-top:8px" data-del-directo="' + esc(c.id) + '" data-monto="' + (parseFloat(c.monto)||0).toFixed(2) + '">🗑 Eliminar candidato y cuadrar</button>' +
          '</div>';
      }
    }

    return '<h3>Folio #' + esc(d.vigente) + '</h3><div class="sub">' + esc(d.cliente) + ' · versiones: ' +
      d.versiones.map(function (r) { return esc(d.folio + letra(r)); }).join(', ') + '</div>' +

      '<div class="dx ' + dg.estado + '"><div class="t">' + esc(dg.titulo) + '</div>' +
      '<p>' + esc(dg.explicacion) + '</p>' +
      (dg.recomendacion ? '<p><b>Qué hacer:</b> ' + esc(dg.recomendacion) + '</p>' : '') +
      accion + '</div>' +

      '<div class="card"><h4>Cuadre</h4>' +
      '<div class="kv"><span>Cobrado real (según recibo)</span><b>' + fmt(d.esperado) + '</b></div>' +
      '<div class="kv"><span>Registrado en contabilidad</span><b>' + fmt(d.observado) + '</b></div>' +
      '<div class="kv"><span>Diferencia</span><b style="color:' + (Math.abs(d.dif) <= 0.5 ? '#1a7a3a' : '#c0161a') + '">' + fmt(d.dif) + '</b></div>' +
      '<div class="kv"><span>Total del recibo / abonado / saldo</span><b>' + fmt(d.total) + ' / ' + fmt(d.abonado) + ' / ' + fmt(d.saldo) + '</b></div></div>' +

      '<div class="card"><h4>Flujo completo · recibo ↔ contabilidad ↔ PDF</h4>' +
      '<p style="font-size:11.5px;color:#7a6840;margin:0 0 10px">Cada versión del folio con lo que dice el recibo, lo que registró contabilidad, y el PDF real (el documento que firmaste). Si una fila no cuadra, abre su PDF: es el árbitro.</p>' +
      '<table><thead><tr><th>Versión</th><th>Fecha · hora (contabilidad)</th><th>Total recibo</th><th>Anticipo</th><th>Abonado</th><th>Saldo</th><th>Contabilidad</th><th>PDF</th></tr></thead><tbody>' +
      d.flujo.map(function (v) {
        var desc = (v.nMovs === 0) ? false : (Math.abs(v.montoContab) > 0.5 && v.letra === 'A' && Math.abs(v.montoContab - v.anticipo) > 0.5);
        var fechaDifiere = v.fechaRecibo && v.fecha && v.fechaRecibo !== v.fecha;
        var celdaFecha = '<b>' + esc(v.fecha || '—') + '</b>' + (v.hora ? ' ' + esc(v.hora) : '') +
          (fechaDifiere ? '<br><span style="color:#b06a00;font-size:9.5px" title="El recibo guardó otra fecha">⚠ recibo dice ' + esc(v.fechaRecibo) + '</span>' : '');
        var pdfBtn = v.tienePdf
          ? '<button class="pdfbtn" onclick="__sxVerPdf(' + d.folio + ',\'' + v.letra + '\',this)">📄 Ver PDF</button> ' +
            '<button class="pdfbtn" onclick="__sxLeerPdf(' + d.folio + ',\'' + v.letra + '\',this)" title="Leer el PDF con OCR y comparar con contabilidad">🔍 Leer PDF</button>'
          : '<span style="color:#b06a00;font-size:10.5px">sin PDF</span>';
        return '<tr><td><b>' + esc(d.folio + v.letra) + '</b></td><td>' + celdaFecha + '</td>' +
          '<td>' + fmt(v.total) + '</td><td>' + fmt(v.anticipo) + '</td><td>' + fmt(v.abonado) + '</td>' +
          '<td>' + fmt(v.saldo) + '</td>' +
          '<td' + (desc || v.nIngresos > 1 ? ' style="color:#c0161a;font-weight:700"' : '') + '>' + (v.nMovs ? fmt(v.montoContab) + (v.nMovs > 1 ? ' (' + v.nMovs + ' mov)' : '') : '<span style="color:#7a6840">—</span>') + '</td>' +
          '<td>' + pdfBtn + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<div id="sx-ocr-out" style="display:none;margin-top:12px;padding:12px 14px;background:#faf6ec;border:1px solid #e2d9c0;border-radius:8px;font-size:12.5px"></div></div>' +

      '<div class="card"><h4>Movimientos en contabilidad</h4><table><thead><tr><th>ID</th><th>Letra</th><th>Monto</th><th>Estatus</th><th>Origen</th><th>Fecha</th></tr></thead><tbody>' +
      (movRows || '<tr><td colspan="6" style="color:#7a6840">Sin movimientos reales (usa el sintético).</td></tr>') + '</tbody></table></div>';
  }

  // ── Puente: botón "Corregir desde PDF" → motor __sxCorregirDesdePdf ──────────
  window.__sxIniciarCorreccionPdf = async function(folioNum, btn) {
    var zona = document.getElementById('sx-pdf-verdad-out-' + folioNum);
    if (!zona) return;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Leyendo PDFs con Mistral…'; }
    zona.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:#7a6840;font-family:monospace;background:#fdfaf4;border:1px solid #e2d9c0;border-radius:8px;">⏳ Iniciando análisis…</div>';
    try {
      await window.__sxCorregirDesdePdf(folioNum, zona);
    } catch(e) {
      zona.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:#c0161a;font-family:monospace">❌ Error: ' + esc(e && e.message ? e.message : String(e)) + '</div>';
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⚖️ Corregir desde PDF (fuente de verdad)'; }
    }
  };

    // ── Utilidad: verifica si la brecha del folio sigue activa ─────────────────
  function _sxBrechaActiva(folioNum) {
    try {
      if (typeof _calcularRecibosFaltantes !== 'function') return null; // no disponible → no bloqueamos
      var brechas = _calcularRecibosFaltantes({ soloFolio: Number(folioNum) }) || [];
      return brechas.length ? brechas : null;
    } catch (e) { return null; }
  }

  // ── Mostrar resultado de simulación en el panel (no en consola) ────────────
  function _sxMostrarSimulacion(ids) {
    var main = document.getElementById('sxpro-main'); if (!main) return;
    var zona = main.querySelector('#sx-sim-out');
    if (!zona) {
      zona = document.createElement('div');
      zona.id = 'sx-sim-out';
      zona.style.cssText = 'margin:12px 0;padding:14px 16px;background:#fff8ec;border:1.5px solid #c8952a;border-radius:10px;font-size:12.5px;';
      var dx = main.querySelector('.dx');
      if (dx) dx.parentNode.insertBefore(zona, dx.nextSibling); else main.prepend(zona);
    }
    if (typeof D === 'undefined' || !Array.isArray(D.movimientos)) {
      zona.innerHTML = '<b style="color:#c0161a">⚠ D.movimientos no disponible — inicia sesión primero.</b>';
      return;
    }
    var encontrados = D.movimientos.filter(function (m) { return m && ids.indexOf(m.id) >= 0; });
    var faltantes   = ids.filter(function (id) { return !D.movimientos.some(function (m) { return m && m.id === id; }); });
    var totalMonto  = encontrados.reduce(function (s, m) { return s + (parseFloat(m.monto) || 0); }, 0);

    var filas = encontrados.map(function (m) {
      return '<tr style="background:#fff3e0">' +
        '<td><code style="font-size:10.5px">' + esc(m.id) + '</code></td>' +
        '<td>' + esc(m.letra || '—') + '</td>' +
        '<td><b>$' + Number(parseFloat(m.monto)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}) + '</b></td>' +
        '<td>' + esc(m.estatus || '—') + '</td>' +
        '<td style="font-size:10px;color:#7a6840">' + esc(m.fecha || '—') + '</td>' +
        '</tr>';
    }).join('');

    zona.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
        '<b style="color:#8c6518">👁 Vista previa — nada borrado aún</b>' +
        '<span style="margin-left:auto;font-family:monospace;font-size:11px;color:#c0161a">' +
          encontrados.length + ' movimiento(s) · total $' + totalMonto.toFixed(2) +
        '</span>' +
      '</div>' +
      (faltantes.length ? '<p style="color:#c0161a;font-size:11px;margin:0 0 8px">⚠ IDs no encontrados (ya eliminados): ' + faltantes.join(', ') + '</p>' : '') +
      '<table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:12px">' +
        '<thead><tr style="background:#f5ead8">' +
          '<th style="padding:5px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#7a6840">ID</th>' +
          '<th style="padding:5px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#7a6840">Letra</th>' +
          '<th style="padding:5px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#7a6840">Monto</th>' +
          '<th style="padding:5px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#7a6840">Estatus</th>' +
          '<th style="padding:5px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#7a6840">Fecha</th>' +
        '</tr></thead><tbody>' + filas + '</tbody></table>' +
      '<div style="display:flex;gap:8px;">' +
        '<button id="sx-sim-confirmar" style="flex:1;padding:9px 0;border-radius:7px;border:none;background:#c0161a;color:#fff;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;">' +
          '🗑 Confirmar eliminación (' + encontrados.length + ' movimiento' + (encontrados.length!==1?'s':'') + ')' +
        '</button>' +
        '<button id="sx-sim-cancelar" style="padding:9px 16px;border-radius:7px;border:1.5px solid #c8952a;background:#fff;color:#8c6518;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;">' +
          'Cancelar' +
        '</button>' +
      '</div>';

    document.getElementById('sx-sim-cancelar').onclick = function () { zona.remove(); };
    document.getElementById('sx-sim-confirmar').onclick = function () {
      if (!encontrados.length) { zona.innerHTML = '<b style="color:#7a6840">No hay movimientos que eliminar.</b>'; return; }
      var btn = this; btn.disabled = true; btn.textContent = '⏳ Eliminando…';
      reconciliarAplicar(ids, { confirmar: true }).then(function () {
        zona.innerHTML = '<b style="color:#1a7a3a">✅ ' + encontrados.length + ' movimiento(s) eliminado(s) correctamente. Contabilidad actualizada.</b>';
        setTimeout(render, 800);
      }).catch(function (e) {
        zona.innerHTML = '<b style="color:#c0161a">❌ Error al eliminar: ' + esc(e && e.message ? e.message : String(e)) + '</b>';
      });
    };
  }

  function bindAcciones() {
    var main = document.getElementById('sxpro-main'); if (!main) return;

    // Botón SIMULAR → muestra tabla en panel (ya no va a consola)
    Array.prototype.forEach.call(main.querySelectorAll('[data-sim]'), function (b) {
      b.onclick = function () {
        if (typeof reconciliarAplicar !== 'function') {
          var z = document.getElementById('sx-sim-out') || document.createElement('div');
          z.id = 'sx-sim-out';
          z.style.cssText = 'margin:12px 0;padding:12px 14px;background:#fff0f0;border:1.5px solid #c0161a;border-radius:8px;font-size:12.5px;';
          z.innerHTML = '<b style="color:#c0161a">⚠ reconciliarAplicar() no disponible — asegúrate de tener iniciada la sesión.</b>';
          var dx = main.querySelector('.dx');
          if (dx && !document.getElementById('sx-sim-out')) dx.parentNode.insertBefore(z, dx.nextSibling);
          return;
        }
        var ids = JSON.parse(b.getAttribute('data-sim'));
        _sxMostrarSimulacion(ids);
      };
    });

    // Botón ELIMINAR → guardia anti-regeneración + confirmación en panel
    Array.prototype.forEach.call(main.querySelectorAll('[data-del]'), function (b) {
      b.onclick = function () {
        if (typeof reconciliarAplicar !== 'function') {
          var z = document.createElement('div');
          z.style.cssText = 'margin:8px 0;padding:10px 14px;background:#fff0f0;border:1.5px solid #c0161a;border-radius:8px;font-size:12px;';
          z.innerHTML = '<b style="color:#c0161a">⚠ reconciliarAplicar() no disponible. Inicia sesión e intenta de nuevo.</b>';
          b.parentNode.appendChild(z);
          return;
        }
        var ids = JSON.parse(b.getAttribute('data-del'));
        // Guardia: revisar si hay brecha activa para este folio
        var folioActual = _sel;
        var brechas = _sxBrechaActiva(folioActual);
        if (brechas && brechas.length) {
          var totalBrecha = brechas.reduce(function (s, m) { return s + (parseFloat(m.monto) || 0); }, 0);
          var z = document.getElementById('sx-sim-out') || document.createElement('div');
          z.id = 'sx-sim-out';
          z.style.cssText = 'margin:12px 0;padding:14px 16px;background:#fff0f0;border:2px solid #c0161a;border-radius:10px;font-size:12.5px;';
          z.innerHTML =
            '<b style="color:#c0161a">🔴 BLOQUEADO — brecha activa detectada</b>' +
            '<p style="margin:8px 0 4px;color:#3a2c1a">Si eliminas ahora, el sistema va a regenerar automáticamente un movimiento nuevo de $' + totalBrecha.toFixed(2) + ' antes del próximo guardado. Quedarás igual que ahora.</p>' +
            '<p style="margin:4px 0;color:#3a2c1a"><b>Qué hacer primero:</b> abre el recibo del folio #' + esc(folioActual) + ' y verifica que el campo <b>Saldo Pendiente</b> refleje el saldo real. Si ya está pagado, ponlo en $0.00 y guarda. Luego vuelve aquí y elimina.</p>' +
            '<button onclick="this.parentNode.remove()" style="margin-top:10px;padding:6px 14px;border-radius:6px;border:1.5px solid #c0161a;background:#fff;color:#c0161a;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">Entendido</button>' +
            '<button id="sx-del-forzar" style="margin-top:10px;margin-left:8px;padding:6px 14px;border-radius:6px;border:1.5px solid #7a6840;background:#fff;color:#7a6840;font-family:inherit;font-size:12px;cursor:pointer;">Eliminar de todas formas (riesgo)</button>';
          var dx = main.querySelector('.dx');
          if (!document.getElementById('sx-sim-out') && dx) dx.parentNode.insertBefore(z, dx.nextSibling);
          else if (!document.getElementById('sx-sim-out')) main.prepend(z);
          else { var ex = document.getElementById('sx-sim-out'); ex.parentNode.replaceChild(z, ex); }
          document.getElementById('sx-del-forzar').onclick = function () {
            z.remove();
            reconciliarAplicar(ids, { confirmar: true }).then(function () {
              var ok = document.createElement('div');
              ok.style.cssText = 'margin:8px 0;padding:10px 14px;background:#e6f5ea;border:1px solid #b8e0c0;border-radius:8px;font-size:12.5px;color:#1a7a3a;font-weight:700;';
              ok.textContent = '✅ Eliminado con brecha (riesgo aceptado). Verifica el recibo para evitar regeneración.';
              main.prepend(ok);
              setTimeout(render, 800);
            });
          };
          return;
        }
        // Sin brecha — mostrar simulación con confirmación
        _sxMostrarSimulacion(ids);
      };
    });

    // Botones de eliminación directa desde tabla de movimientos (SOBRA agresivo)
    Array.prototype.forEach.call(main.querySelectorAll('[data-del-directo]'), function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-del-directo');
        var monto = b.getAttribute('data-monto') || '?';
        if (!confirm('¿Eliminar el movimiento ' + id + ' ($' + monto + ') de contabilidad?\n\nSe guarda respaldo. Esta acción cuadra el folio.')) return;
        if (typeof reconciliarAplicar !== 'function') { alert('reconciliarAplicar no disponible.'); return; }
        b.disabled = true; b.textContent = '⏳';
        reconciliarAplicar([id], { confirmar: true }).then(function () {
          b.textContent = '✅ Eliminado';
          b.style.background = '#1a7a3a';
          setTimeout(render, 800);
        }).catch(function (e) {
          b.disabled = false; b.textContent = '❌ Error';
          alert('Error: ' + (e && e.message ? e.message : e));
        });
      };
    });
  }

  function renderErrores() {
    // Los mensajes 'info' (ej. "SCANSYS v2 activado") son avisos de arranque,
    // no errores ni advertencias — no pertenecen a esta lista ni deben
    // contarse en el número de arriba. 'warn' sí se muestra, pero en ámbar
    // (no rojo) para distinguir un aviso transitorio de un error real.
    var errs = (window.LEX_ERRORS || []).filter(function(e){ return e.nivel !== 'info'; }).slice().reverse();
    if (!errs.length) return '<div class="main"><div class="empty">✅ No hay errores JS registrados en esta sesión.</div></div>';
    return '<div class="main">' + errs.map(function (e, i) {
      return '<div class="err' + (e.nivel==='warn'?' warn':'') + '" data-i="' + i + '"><div><span class="m">' + esc(e.mensaje) + '</span> <span class="mod">· ' + esc(e.modulo) + ' · ' + esc((e.fecha || '').replace('T', ' ').slice(0, 19)) + '</span></div>' +
        (e.stack ? '<div class="st">' + esc(e.stack) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function bindErrores() {
    var body = document.getElementById('sxpro-body'); if (!body) return;
    Array.prototype.forEach.call(body.querySelectorAll('.err'), function (el) {
      el.onclick = function () { el.classList.toggle('open'); };
    });
  }

  window.LEXPANEL  = { abrir: abrirPanel };
  window._sxRender = function(){ if(typeof render==='function') render(); };
})();  // SCANSYS PRO — se abre desde el botón del sidebar
