/* LEX-MÉXICO · Módulo recibos
 * Funciones extraídas sin modificar su contenido.
 */

function agregarConcepto() {
  conceptoCount++;
  const id = 'cp' + conceptoCount;
  const tbody = document.getElementById('conceptos-tbody');
  const tr = document.createElement('tr');
  tr.id = 'concepto-row-' + id;
  tr.innerHTML =
    '<td style="position:relative;">' +
      '<textarea class="concepto concepto-ta" placeholder="Concepto" rows="1" ' +
        'oninput="iaConceptoInput(this)" ' +
        'onblur="iaConceptoBlur(this)" ' +
        'onkeydown="iaSugerenciaKeydown(event,this)"' +
      '></textarea>' +
      '<div class="ia-dropdown" style="display:none;"></div>' +
    '</td>' +
    '<td>' +
      '<textarea class="descripcion concepto-ta" placeholder="Descripción" rows="1" ' +
        'onblur="iaDescBlur(this)"' +
      '></textarea>' +
    '</td>' +
    '<td><input type="text" class="precio price-input" placeholder="0.00" inputmode="decimal" oninput="formatPrecio(this)"></td>' +
    '<td><button class="del-concept" onclick="quitarConcepto(\'' + id + '\')">✕</button></td>';
  tbody.appendChild(tr);
}

function _autoGrowConceptoTA(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, 32) + 'px';
}

function _tombstoneAplicaA(t, r) {
  if (!t || !r) return false;
  if (String(t.folio) !== String(r.folio)) return false;
  if ((t.letra || 'A') !== (r.letra || 'A')) return false;
  // Recibo revivido DESPUÉS de la eliminación → el tombstone no aplica.
  // Tombstones legados sin ts cuentan como ts=0 (cualquier revivido los supera).
  if (r._revivedTs && Number(r._revivedTs) > Number(t.ts || 0)) return false;
  return true;
}

function _revivirSiTombstone(rec) {
  try {
    if (!rec || typeof appData === 'undefined') return rec;
    // Siempre marcar el recibo con el momento de creación. Si SB tiene un
    // tombstone que aún no llegó a este dispositivo, _revivedTs protegerá
    // el recibo en la comparación _revivedTs > t.ts del pre-read de syncEstadoSupabase.
    if (!rec._revivedTs) rec._revivedTs = Date.now();
    const tombs = Array.isArray(appData.folios_eliminados) ? appData.folios_eliminados : [];
    const hayTomb = tombs.some(function(t){
      return String(t.folio) === String(rec.folio) && (t.letra || 'A') === (rec.letra || 'A');
    });
    if (hayTomb) {
      rec._revivedTs = Date.now();
      appData.folios_eliminados = tombs.filter(function(t){
        return !(String(t.folio) === String(rec.folio) && (t.letra || 'A') === (rec.letra || 'A'));
      });
      console.log('[Tombstone] Folio ' + rec.folio + (rec.letra || 'A') + ' revivido — tombstone superado (_revivedTs=' + rec._revivedTs + ')');
    }
  } catch(e) { console.warn('[_revivirSiTombstone]', e); }
  return rec;
}

function _purgarTombstonesSuperados(tombs, recibos) {
  return (tombs || []).filter(function(t){
    return !(recibos || []).some(function(r){
      return r && r._revivedTs && String(t.folio) === String(r.folio) &&
             (t.letra || 'A') === (r.letra || 'A') && Number(r._revivedTs) > Number(t.ts || 0);
    });
  });
}

async function sincronizarFolio(forzarSB){
  // Guard: si lleva más de 15s activo, el flag quedó trabado — resetear
  if(_sincronizando && (Date.now() - _sincronizandoTs) < 15000) return;
  if(!window.SB || !window.SB_DESPACHO_ID){
    console.warn('[SB] sincronizarFolio: sin sesión / despacho');
    return;
  }
  _sincronizando = true;
  _sincronizandoTs = Date.now();
  // ═══════════════════════════════════════════════════════════════════
  // FIX GENERAL — causa raíz común a varios bugs ya reportados ("edito o
  // borro algo, sale el aviso de éxito, pero al rato vuelve a su valor
  // viejo": Editar Cobros/Egresos, Borrar Cobro Específico, y
  // potencialmente cualquier otra pantalla que use
  // syncEstadoSupabaseDebounced/guardarTodo para subir un cambio puntual).
  // syncEstadoSupabaseDebounced() agenda la subida real 800ms después y
  // devuelve una promesa ya resuelta de inmediato — así que, durante esos
  // 800ms (más lo que tarde la red), Supabase todavía tiene la fila VIEJA.
  // Si en esa ventana llega un pull (polling de respaldo cada 30s, un
  // broadcast Realtime de otro dispositivo/pestaña, o incluso otro login),
  // este mismo sincronizarFolio() bajaba esos datos viejos y sobreescribía
  // la memoria local, borrando el cambio recién hecho antes de que la
  // subida debounced pudiera confirmarlo.
  // En vez de seguir marcando "protegido" cada función de edición/borrado
  // una por una, se ataca la causa raíz UNA sola vez aquí: si hay una
  // subida pendiente en el debounce, este pull la ADELANTA y ESPERA a que
  // termine ANTES de leer nada de Supabase — así el servidor SIEMPRE
  // refleja el último cambio local antes de que cualquier pull (presente o
  // futuro, de cualquier pantalla) pueda competir con él.
  if(typeof _syncDebounceTimer !== 'undefined' && _syncDebounceTimer){
    clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = null;
    try { if(typeof syncEstadoSupabase === 'function') await syncEstadoSupabase(); }
    catch(e){ console.warn('[SB] sincronizarFolio: fallo al adelantar subida pendiente antes del pull:', e); }
  }
  try {
    // Leer el estado del despacho desde la tabla app_state
    const { data, error } = await window.SB
      .from('app_state')
      .select('data, recibos, folio_actual')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .single();
    if(error){
      // Si no existe, crearlo
      if(error.code === 'PGRST116'){
        console.log('[SB] No hay estado previo — creando inicial...');
        await window.SB.from('app_state').insert({
          despacho_id: window.SB_DESPACHO_ID,
          data: {movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],cierres:[],prestamos:[],tareasHoy:[],adeudosSinRecibo:[],saldoAcumulado:0,leyes:[]},
          recibos: {folioActual:1, recibos:[]},
          folio_actual: 100
        });
        appData = { folioActual: 1, anioFolioActual: new Date().getFullYear(), recibos: [] };
      } else {
        console.error('[SB] sincronizarFolio:', error);
      }
    } else if(data){
      // Reconstruir appData — usar Supabase para recibos CON PROTECCIÓN
      const recibosData = data.recibos || {};
      const sbRecibos = recibosData.recibos || [];
      const recibosActuales = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
      // ── Tombstones: unión de folios eliminados en SB y en memoria local ────────
      // Cuando el admin elimina un folio, se registra en folios_eliminados.
      // Todos los clientes reciben esta lista al sincronizar y filtran antes de fusionar,
      // lo que evita que un browser con estado viejo re-suba folios ya eliminados.
      const _sbTombs  = recibosData.folios_eliminados || [];
      const _locTombs = (typeof appData !== 'undefined' && Array.isArray(appData.folios_eliminados)) ? appData.folios_eliminados : [];
      // Unión: ningún tombstone se pierde nunca
      const _tombstones = [..._sbTombs];
      _locTombs.forEach(function(t){
        if(!_tombstones.some(function(x){ return String(x.folio)===String(t.folio) && x.letra===t.letra; }))
          _tombstones.push(t);
      });
      function _esTombstone(r){
        // Supersesión: el tombstone NO aplica si el recibo fue revivido después
        return _tombstones.some(function(t){ return _tombstoneAplicaA(t, r); });
      }

      // ⚠️ CRÍTICO: proteger recibos igual que movimientos.
      // Si Supabase trae MENOS versiones del mismo folio que memoria → conservar memoria.
      // Esto evita que una sync tardía sobreescriba el B recién generado con solo el A.
      // Los tombstones se filtran ANTES de fusionar para que ningún cliente re-suba eliminados.
      function _mergeRecibos(sbArr, localArr) {
        // ── BLOQUEO: proteger recibos locales de tombstones remotos obsoletos ──────
        // Si un recibo está en el backup local y NO fue eliminado en esta sesión
        // (_locTombs no lo tiene), darle _revivedTs = ahora para protegerlo de
        // tombstones históricos obsoletos.
        // EXCEPCIÓN: si el tombstone en SB tiene ts > Date.now() + 5000, es un
        // tombstone de admin (_adminForce con +10000ms) — NO proteger el recibo.
        var _ahora = Date.now();
        localArr.forEach(function(r) {
          if (!r || r._revivedTs) return;
          var tieneLocTomb = _locTombs.some(function(t){
            return String(t.folio) === String(r.folio) && (t.letra||'A') === (r.letra||'A');
          });
          if (tieneLocTomb) return;
          // Tombstone de admin en SB (ts futuro = _adminForce con +10000)
          var tieneSbAdminTomb = _sbTombs.some(function(t){
            return String(t.folio) === String(r.folio) && (t.letra||'A') === (r.letra||'A')
                   && Number(t.ts||0) > _ahora + 5000;
          });
          if (tieneSbAdminTomb) return; // admin eliminó — no proteger
          r._revivedTs = _ahora;
        });
        // Filtrar tombstones de ambos lados antes de cualquier fusión
        const sbFilt    = sbArr.filter(function(r){ return !_esTombstone(r); });
        const localFilt = localArr.filter(function(r){ return !_esTombstone(r); });
        if (!localFilt.length) return sbFilt;
        if (!sbFilt.length)   return localFilt;
        // Construir mapa de versiones: folio+letra → recibo
        const mapaLocal = {};
        localFilt.forEach(function(r) {
          var k = r.folio + '|' + (r.letra || 'A');
          mapaLocal[k] = r;
        });
        const mapaSB = {};
        sbFilt.forEach(function(r) {
          var k = r.folio + '|' + (r.letra || 'A');
          mapaSB[k] = r;
        });
        // Resultado: unión de ambos, priorizando SB pero conservando versiones locales que SB no tiene
        const claves = new Set([...Object.keys(mapaSB), ...Object.keys(mapaLocal)]);
        const resultado = [];
        claves.forEach(function(k) {
          if (mapaSB[k]) {
            resultado.push(mapaSB[k]); // SB tiene esta versión → usar SB
          } else {
            resultado.push(mapaLocal[k]); // solo local la tiene → conservar
            console.warn('[merge recibos] versión solo en local conservada:', k);
          }
        });
        // Ordenar: A antes de B del mismo folio.
        // ⚠️ NO usar sort() con return 0 para folios distintos — el comparador
        // no transitivo producía orden indefinido (B antes que A), lo que hacía
        // que las limpiezas de duplicados conservaran el B y eliminaran el A.
        // Aquí se agrupa por folio preservando el orden de aparición y se
        // ordenan las letras DENTRO de cada folio de forma determinista.
        const _ordenFolios = [];
        const _porFolio = {};
        resultado.forEach(function(r) {
          var f = String(r.folio);
          if (!_porFolio[f]) { _porFolio[f] = []; _ordenFolios.push(f); }
          _porFolio[f].push(r);
        });
        const _ordenado = [];
        _ordenFolios.forEach(function(f) {
          _porFolio[f].sort(function(a, b) {
            var la = (a.letra || 'A'); var lb = (b.letra || 'A');
            return la < lb ? -1 : la > lb ? 1 : 0;
          });
          _porFolio[f].forEach(function(r) { _ordenado.push(r); });
        });
        return _ordenado;
      }
      const recibosFinales = _mergeRecibos(sbRecibos, recibosActuales);
      // Purgar tombstones superados por recibos revividos para que este cliente
      // deje de re-subirlos y todos converjan a su eliminación definitiva.
      const _tombstonesFinales = (typeof _purgarTombstonesSuperados === 'function')
        ? _purgarTombstonesSuperados(_tombstones, recibosFinales) : _tombstones;
      // folioActual viene de la columna folio_actual de Supabase (actualizada atómicamente
      // por reservar_folio_atomico), no del campo recibos que puede llegar tarde.
      // data.folio_actual es siempre el más actualizado.
      appData = {
        folioActual:      data.folio_actual || recibosData.folioActual || 1,
        anioFolioActual:  recibosData.anioFolioActual || new Date().getFullYear(),
        folios_eliminados: _tombstonesFinales,
        recibos:          recibosFinales
      };
      // Re-subir si local tiene más recibos que SB (conservación de versiones locales)
      // O si local tiene tombstones que SB no tiene (propagación de tombstones a otros clientes)
      const _sbFiltCount    = sbRecibos.filter(function(r){ return !_esTombstone(r); }).length;
      const _hayTombsNuevos = _tombstonesFinales.length > _sbTombs.length;
      const _hayTombsPurgados = _tombstonesFinales.length < _tombstones.length;
      if (recibosFinales.length > _sbFiltCount || _hayTombsNuevos || _hayTombsPurgados) {
        console.warn('[merge recibos] re-subiendo — recibos extra:', recibosFinales.length - _sbFiltCount, '| tombstones nuevos:', _tombstonesFinales.length - _sbTombs.length, '| purgados:', _tombstones.length - _tombstonesFinales.length);
        setTimeout(function(){ if(typeof actualizarArchivoControl==='function') actualizarArchivoControl().catch(function(e){ console.warn('re-upload recibos:', e); }); }, 800);
      }
      // Reconstruir D — PROTECCIÓN TOTAL CONTRA PÉRDIDA DE DATOS
      if(typeof D !== 'undefined' && data.data){
        // ══════════════════════════════════════════════════════════════
        // SUPABASE ES LA FUENTE DE VERDAD para todo, EXCEPTO movimientos
        // de recibo (fuente==='recibo'). Para esos se hace UNIÓN por id
        // con lo que ya hay en memoria local, igual que ya hace
        // syncEstadoSupabase() al subir (ver "Fusionar MOVIMIENTOS de
        // recibo de SB con los locales", ~línea 36149).
        // Por qué: sin esto, si este dispositivo acaba de crear un
        // movimiento de recibo (ej. una recuperación M-RECUP-) y ESTA
        // función se ejecuta antes de que ese movimiento termine de
        // confirmarse en Supabase, el sobreescribir con sbMovs lo borra
        // de memoria. En el siguiente ciclo el sistema vuelve a ver la
        // misma brecha y fabrica OTRO movimiento con ID distinto — la
        // causa raíz de los duplicados M-RECUP- diagnosticada por
        // SCANSYS PRO ("🔬 Diagnosticar por qué se duplicó").
        // Los movimientos que NO son de recibo (caja/retiro/manual)
        // conservan el comportamiento original (SB gana tal cual).
        // ══════════════════════════════════════════════════════════════
        const sbMovs    = data.data.movimientos || [];
        const sbJuicios = data.data.juicios     || [];
        const sbPends   = data.data.pendientes  || [];
        const _localMovsPrev = Array.isArray(D.movimientos) ? D.movimientos : [];
        const _sbMovTombsPull = data.data.movimientos_eliminados || [];
        if(!Array.isArray(D.movimientos_eliminados)) D.movimientos_eliminados = [];
        _sbMovTombsPull.forEach(function(t){
          if(t && t.id && !D.movimientos_eliminados.some(function(x){ return x.id===t.id; }))
            D.movimientos_eliminados.push(t);
        });
        const _movTombSetPull = new Set(D.movimientos_eliminados.map(function(t){ return t && t.id; }));
        const _logKeyPull = function(m){
          return String(m.folio)+'|'+(m.letra||'A')+'|'+(m.fecha||'')+'|'+((m.hora||'').slice(0,5))+'|'+(parseFloat(m.monto)||0)+'|'+(m.estatus||'');
        };
        // FIX (caso real: "Editar Cobros/Egresos" — la edición de un movimiento
        // manual/caja parecía guardarse [toast de éxito] pero al rato volvía a
        // su valor viejo). Causa raíz: la protección de abajo ("conservar
        // locales aún no confirmados en Supabase") SOLO existía para
        // movimientos fuente==='recibo' — cualquier movimiento manual/caja
        // (ingreso, egreso, corrección, etc.) tomaba SIEMPRE la versión de
        // Supabase tal cual, sin fusionar. adminGuardarEdicion2Mov() aplica el
        // cambio en memoria y AGENDA la subida a Supabase con 800ms de
        // debounce (syncEstadoSupabaseDebounced) — si en esa ventana llega un
        // pull (polling de respaldo cada 30s, o broadcast Realtime de otro
        // dispositivo/pestaña) ANTES de que la subida propia termine, este
        // sincronizarFolio() sobreescribía D.movimientos con la fila vieja de
        // Supabase, borrando la edición de la memoria — y como la subida
        // debounced lee D en el momento en que finalmente dispara (800ms
        // después), terminaba re-subiendo esa misma versión vieja,
        // "confirmando" permanentemente la pérdida del cambio.
        // Se resuelve igual que ya se hace con los movimientos de recibo:
        // cualquier movimiento editado localmente hace muy poco (ver
        // _marcarMovEditadoLocal, usado por adminGuardarEdicion2Mov y
        // adminGuardarEdicionMov) conserva su versión LOCAL en este pull
        // durante una ventana de gracia, dando tiempo de sobra a que la
        // subida debounced llegue a Supabase.
        const _VENTANA_PROTEC_EDICION_MS = 15000;
        const _editsLocalesRecientesPull = window._movsEditadosRecientemente || {};
        Object.keys(_editsLocalesRecientesPull).forEach(function(id){
          if(Date.now() - _editsLocalesRecientesPull[id] > _VENTANA_PROTEC_EDICION_MS) delete _editsLocalesRecientesPull[id];
        });
        const _localNoRecEditadosMapPull = {};
        _localMovsPrev.forEach(function(m){
          if(m && m.fuente !== 'recibo' && m.id && _editsLocalesRecientesPull[m.id]) _localNoRecEditadosMapPull[m.id] = m;
        });
        // FIX (caso real: "Borrar Cobro Específico" — se borraba un movimiento
        // manual/caja, aparecía el toast de éxito, pero volvía a aparecer en
        // la lista al rato). Misma causa raíz que la edición: adminBorrarMovEspec()
        // quita el movimiento de D.movimientos en memoria y agenda el push
        // 800ms después — si un pull llega antes, Supabase todavía tiene el
        // movimiento (el borrado aún no se le confirmó) y lo reintroducía sin
        // que nada lo impidiera. Se excluyen aquí, durante la misma ventana de
        // gracia, los ids marcados como recién borrados localmente (ver
        // _marcarMovEliminadoLocal, usado por adminBorrarMovEspec).
        const _delsLocalesRecientesPull = window._movsEliminadosRecientemente || {};
        Object.keys(_delsLocalesRecientesPull).forEach(function(id){
          if(Date.now() - _delsLocalesRecientesPull[id] > _VENTANA_PROTEC_EDICION_MS) delete _delsLocalesRecientesPull[id];
        });
        const _sbNoRecPull = sbMovs
          .filter(function(m){ return !m || m.fuente !== 'recibo'; })
          .filter(function(m){ return !(m && m.id && _delsLocalesRecientesPull[m.id]); })
          .map(function(m){ return (m && m.id && _localNoRecEditadosMapPull[m.id]) ? _localNoRecEditadosMapPull[m.id] : m; });
        Object.keys(_localNoRecEditadosMapPull).forEach(function(id){
          if(!_sbNoRecPull.some(function(m){ return m && m.id === id; })) _sbNoRecPull.push(_localNoRecEditadosMapPull[id]);
        });
        if(Object.keys(_localNoRecEditadosMapPull).length){
          console.warn('[SB] sincronizarFolio: conservando '+Object.keys(_localNoRecEditadosMapPull).length+' movimiento(s) manual(es)/caja editados localmente hace <15s (aún no confirmados en Supabase)');
        }
        if(Object.keys(_delsLocalesRecientesPull).length){
          console.warn('[SB] sincronizarFolio: excluyendo '+Object.keys(_delsLocalesRecientesPull).length+' movimiento(s) manual(es)/caja borrados localmente hace <15s (aún no confirmados en Supabase)');
        }
        const _sbRecVivosPull = sbMovs.filter(function(m){ return m && m.fuente==='recibo' && m.id && !_movTombSetPull.has(m.id); });
        const _sbRecIdsPull  = new Set(_sbRecVivosPull.map(function(m){ return m.id; }));
        const _sbRecKeysPull = new Set(_sbRecVivosPull.map(_logKeyPull));
        const _soloLocalRecPull = _localMovsPrev.filter(function(m){
          return m && m.fuente==='recibo' && m.id && !_movTombSetPull.has(m.id)
            && !_sbRecIdsPull.has(m.id) && !_sbRecKeysPull.has(_logKeyPull(m));
        });
        if(_soloLocalRecPull.length){
          console.warn('[SB] sincronizarFolio: conservando '+_soloLocalRecPull.length+' movimiento(s) de recibo locales aún no confirmados en Supabase — '+_soloLocalRecPull.map(function(m){ return m.folio+(m.letra||'')+' $'+m.monto; }).join(', '));
        }
        D.movimientos           = _sbNoRecPull.concat(_sbRecVivosPull, _soloLocalRecPull);
        D._juiciosModTs         = data.data._juiciosModTs || 0;
        // Merge juicios: mismo problema de carrera ya corregido en
        // carpetas/escrituras/citas/pendientes — D.juicios = sbJuicios (sin
        // fusión) perdía en silencio cualquier término/acuerdo/edición local
        // reciente si un pull llegaba antes de que el push se confirmara.
        // Los juicios viejos no tenían id — guardarJuicio()/saveJuicios()
        // ahora les asigna uno (y actualiza updatedAt) en su primera edición;
        // mientras tanto se usa el expediente como llave de respaldo.
        (function(){
          const _VENTANA_PROTEC_JUI_MS = 15000;
          const _delsLocalesRecientesJui = window._juiciosEliminadosRecientemente || {};
          Object.keys(_delsLocalesRecientesJui).forEach(function(id){
            if(Date.now() - _delsLocalesRecientesJui[id] > _VENTANA_PROTEC_JUI_MS) delete _delsLocalesRecientesJui[id];
          });
          const _keyJui = function(j){ return j && (j.id || (j.expediente ? 'EXP:'+j.expediente : null)); };
          const _localJuicios = Array.isArray(D.juicios) ? D.juicios : [];
          const _mapaLocalJui = {};
          _localJuicios.forEach(function(j){ const k=_keyJui(j); if(k) _mapaLocalJui[k]=j; });
          const _sbJuiKeys = new Set(sbJuicios.map(_keyJui).filter(Boolean));
          const _fusionadasJui = sbJuicios
            .filter(function(j){ const k=_keyJui(j); return !(k && _delsLocalesRecientesJui[k]); })
            .map(function(j){
              const k = _keyJui(j);
              const _loc = k ? _mapaLocalJui[k] : null;
              if (_loc) {
                const tsLoc = _loc.updatedAt || 0;
                const tsSb  = j.updatedAt || 0;
                if (tsLoc > tsSb) return _loc;
              }
              return j;
            });
          const _soloLocalesJui = _localJuicios.filter(function(j){ const k=_keyJui(j); return k ? !_sbJuiKeys.has(k) : true; });
          D.juicios = [..._fusionadasJui, ..._soloLocalesJui];
        })();
        // Merge gestiones: mismo problema — g.id siempre existe, se compara
        // fechaMod (estampado por _gestGuardarYRefrescar/gestGuardarCambios).
        (function(){
          const _sbGestiones = data.data.gestiones || [];
          const _localGestiones = Array.isArray(D.gestiones) ? D.gestiones : [];
          const _mapaLocalGest = {};
          _localGestiones.forEach(function(g){ if(g && g.id) _mapaLocalGest[g.id] = g; });
          const _sbGestIds = new Set(_sbGestiones.map(function(g){ return g.id; }));
          const _fusionadasGest = _sbGestiones.map(function(g){
            const _loc = g && g.id ? _mapaLocalGest[g.id] : null;
            if (_loc) {
              const tsLoc = Date.parse(_loc.fechaMod || 0) || 0;
              const tsSb  = Date.parse(g.fechaMod || 0) || 0;
              if (tsLoc > tsSb) return _loc;
            }
            return g;
          });
          const _soloLocalesGest = _localGestiones.filter(function(g){ return g && g.id && !_sbGestIds.has(g.id); });
          D.gestiones = [..._fusionadasGest, ..._soloLocalesGest];
        })();
        // Merge directorio: mismo problema — guardarContacto() ahora asigna
        // id+fechaMod a cada contacto (los viejos lo reciben en su primera
        // edición); mientras tanto se usa nombre+teléfono como llave de
        // respaldo. eliminarContacto() protege contra resurrección igual
        // que pendientes/juicios.
        (function(){
          const _VENTANA_PROTEC_CONT_MS = 15000;
          const _delsLocalesRecientesCont = window._contactosEliminadosRecientemente || {};
          Object.keys(_delsLocalesRecientesCont).forEach(function(id){
            if(Date.now() - _delsLocalesRecientesCont[id] > _VENTANA_PROTEC_CONT_MS) delete _delsLocalesRecientesCont[id];
          });
          const _sbDirectorio = data.data.directorio || [];
          const _keyCont = function(c){ return c && (c.id || ((c.nombre||'')+'|'+(c.tel||''))); };
          const _localDirectorio = Array.isArray(D.directorio) ? D.directorio : [];
          const _mapaLocalCont = {};
          _localDirectorio.forEach(function(c){ const k=_keyCont(c); if(k) _mapaLocalCont[k]=c; });
          const _sbContKeys = new Set(_sbDirectorio.map(_keyCont).filter(Boolean));
          const _fusionadosCont = _sbDirectorio
            .filter(function(c){ const k=_keyCont(c); return !(k && _delsLocalesRecientesCont[k]); })
            .map(function(c){
              const k = _keyCont(c);
              const _loc = k ? _mapaLocalCont[k] : null;
              if (_loc) {
                const tsLoc = Date.parse(_loc.fechaMod || 0) || 0;
                const tsSb  = Date.parse(c.fechaMod || 0) || 0;
                if (tsLoc > tsSb) return _loc;
              }
              return c;
            });
          const _soloLocalesCont = _localDirectorio.filter(function(c){ const k=_keyCont(c); return k ? !_sbContKeys.has(k) : true; });
          D.directorio = [..._fusionadosCont, ..._soloLocalesCont];
        })();
        // Merge carpetas: mismo problema que ya se corrigió en pre-recibos —
        // si una carpeta se editó/creó localmente y ese cambio aún no se
        // confirmó en Supabase, un pull que llegue en ese momento no debe
        // pisarlo con la copia vieja. Se compara fechaModificacion y gana
        // la más reciente; las carpetas que solo existen en memoria local
        // (recién creadas, aún sin subir) se conservan igual que antes.
        (function(){
          const _sbCarpetas = data.data.carpetas || [];
          const _localCarpetas = Array.isArray(D.carpetas) ? D.carpetas : [];
          const _mapaLocalCarp = {};
          _localCarpetas.forEach(function(c){ if(c && c.num) _mapaLocalCarp[c.num] = c; });
          const _sbCarpNums = new Set(_sbCarpetas.map(function(c){ return c.num; }));
          const _fusionadasCarp = _sbCarpetas.map(function(c){
            const _loc = _mapaLocalCarp[c.num];
            if (_loc) {
              const tsLoc = Date.parse(_loc.fechaModificacion || 0) || 0;
              const tsSb  = Date.parse(c.fechaModificacion || 0) || 0;
              if (tsLoc > tsSb) return _loc;
            }
            return c;
          });
          const _soloLocalesCarp = _localCarpetas.filter(function(c){ return !_sbCarpNums.has(c.num); });
          D.carpetas = [..._fusionadasCarp, ..._soloLocalesCarp];
        })();
        // Merge pendientes: mismo problema de carrera ya corregido en
        // carpetas/escrituras/citas — sobreescribir D.pendientes entero con
        // sbPends perdía en silencio cualquier cambio local reciente (ej. el
        // botón "+ Adjuntar" de Placas subía el archivo a Drive y lo agregaba
        // a p.documentos, pero si el polling de 30s hacía un pull antes de que
        // el push local se confirmara en Supabase, el documento desaparecía).
        // También protege contra "resucitar" un pendiente borrado a mano
        // (eliminarPend/toggleP) hace <15s cuyo borrado aún no se confirma
        // (ver _marcarPendEliminadoLocal).
        (function(){
          const _VENTANA_PROTEC_PEND_MS = 15000;
          const _delsLocalesRecientesPend = window._pendsEliminadosRecientemente || {};
          Object.keys(_delsLocalesRecientesPend).forEach(function(id){
            if(Date.now() - _delsLocalesRecientesPend[id] > _VENTANA_PROTEC_PEND_MS) delete _delsLocalesRecientesPend[id];
          });
          const _localPends = Array.isArray(D.pendientes) ? D.pendientes : [];
          const _mapaLocalPend = {};
          _localPends.forEach(function(p){ if(p && p.id) _mapaLocalPend[p.id] = p; });
          const _sbPendIds = new Set(sbPends.map(function(p){ return p.id; }));
          const _fusionadasPend = sbPends
            .filter(function(p){ return !(p && p.id && _delsLocalesRecientesPend[p.id]); })
            .map(function(p){
              const _loc = p && p.id ? _mapaLocalPend[p.id] : null;
              if (_loc) {
                const tsLoc = Date.parse(_loc.fechaMod || 0) || 0;
                const tsSb  = Date.parse(p.fechaMod || 0) || 0;
                if (tsLoc > tsSb) return _loc;
              }
              return p;
            });
          const _soloLocalesPend = _localPends.filter(function(p){ return p && p.id && !_sbPendIds.has(p.id); });
          D.pendientes = [..._fusionadasPend, ..._soloLocalesPend];
          // La numeración de ficha ya NO se guarda ni se reinicia aquí
          // (18/ago/2026) — pasó a ser dinámica, recalculada en cada render
          // de renderPend() según los pendientes activos del momento. Ver
          // _pendNumMapa ahí.
        })();
        // Merge citas: mismo problema ya corregido en carpetas/pre-recibos/
        // escrituras — si se agendó/eliminó una cita localmente y ese cambio
        // aún no se confirmó en Supabase, un pull que llegue en ese momento
        // no debe pisarla con la copia vieja. Se compara actualizadaEn y gana
        // la más reciente; las citas que solo existen en memoria local (recién
        // creadas, aún sin subir) se conservan igual que en carpetas.
        // FIX: además, si la cita fue BORRADA localmente (a mano con
        // citaEliminar, o automáticamente por citasLimpiarPasadas al vencer)
        // hace <15s, no se resucita aunque Supabase todavía tenga la copia
        // vieja — mismo patrón de ventana de gracia que ya protege
        // movimientos/pendientes/juicios/contactos. Sin esto, con dos
        // computadoras conectadas al mismo despacho (admin + empleada), el
        // pull de cualquiera de las dos podía "revivir" una cita recién
        // borrada antes de que el borrado terminara de confirmarse en el
        // servidor.
        (function(){
          const _VENTANA_PROTEC_CITA_MS = 15000;
          const _delsLocalesRecientesCitas = window._citasEliminadasRecientemente || {};
          Object.keys(_delsLocalesRecientesCitas).forEach(function(id){
            if(Date.now() - _delsLocalesRecientesCitas[id] > _VENTANA_PROTEC_CITA_MS) delete _delsLocalesRecientesCitas[id];
          });
          const _sbCitas = (data.data.citas || []).filter(function(c){
            return !(c && c.id && _delsLocalesRecientesCitas[c.id]);
          });
          const _localCitas = Array.isArray(D.citas) ? D.citas : [];
          const _mapaLocalCitas = {};
          _localCitas.forEach(function(c){ if(c && c.id) _mapaLocalCitas[c.id] = c; });
          const _sbCitaIds = new Set(_sbCitas.map(function(c){ return c.id; }));
          const _fusionadasCitas = _sbCitas.map(function(c){
            const _loc = _mapaLocalCitas[c.id];
            if (_loc) {
              const tsLoc = Date.parse(_loc.actualizadaEn || _loc.creadaEn || 0) || 0;
              const tsSb  = Date.parse(c.actualizadaEn || c.creadaEn || 0) || 0;
              if (tsLoc > tsSb) return _loc;
            }
            return c;
          });
          const _soloLocalesCitas = _localCitas.filter(function(c){ return !_sbCitaIds.has(c.id); });
          D.citas = [..._fusionadasCitas, ..._soloLocalesCitas];
        })();
        // Merge cierres: los cierres no se editan en línea (solo se crean o
        // se deduplican), así que no necesitan fechaMod — basta con no
        // perder un cierre creado localmente (cerrarCaja/cerrarCajaAutomatico/
        // adminCorteDeCaja) que todavía no se confirma en Supabase cuando
        // llega un pull. Se identifica por fecha+hora+tipo (mismo criterio
        // que ya usa limpiarCierresDuplicados para deduplicar).
        (function(){
          const _sbCierres = data.data.cierres || [];
          const _localCierres = Array.isArray(D.cierres) ? D.cierres : [];
          const _keyCierre = function(c){ return c && ((c.fecha||'')+'|'+(c.hora||'')+'|'+(c.automatico||c.auto?'auto':'man')); };
          const _sbCierreKeys = new Set(_sbCierres.map(_keyCierre));
          const _soloLocalesCierre = _localCierres.filter(function(c){ const k=_keyCierre(c); return k && !_sbCierreKeys.has(k); });
          D.cierres = [..._sbCierres, ..._soloLocalesCierre];
        })();
        D.prestamos             = data.data.prestamos     || [];
        D.saldoAcumulado        = data.data.saldoAcumulado || 0;
        // Merge escrituras: mismo problema ya corregido en carpetas/pre-recibos —
        // si una escritura se creó/editó/avanzó de paso localmente y ese cambio
        // aún no se confirmó en Supabase, un pull que llegue en ese momento no
        // debe pisarlo con la copia vieja. Se compara fechaMod y gana la más
        // reciente; las escrituras que solo existen en memoria local (recién
        // creadas, aún sin subir) se conservan igual que en carpetas.
        (function(){
          const _sbEscrituras = data.data.escrituras || [];
          const _localEscrituras = Array.isArray(D.escrituras) ? D.escrituras : [];
          const _mapaLocalEsc = {};
          _localEscrituras.forEach(function(e){ if(e && e.num) _mapaLocalEsc[e.num] = e; });
          const _sbEscNums = new Set(_sbEscrituras.map(function(e){ return e.num; }));
          const _fusionadasEsc = _sbEscrituras.map(function(e){
            const _loc = _mapaLocalEsc[e.num];
            if (_loc) {
              const tsLoc = Date.parse(_loc.fechaMod || 0) || 0;
              const tsSb  = Date.parse(e.fechaMod || 0) || 0;
              if (tsLoc > tsSb) return _loc;
            }
            return e;
          });
          const _soloLocalesEsc = _localEscrituras.filter(function(e){ return !_sbEscNums.has(e.num); });
          D.escrituras = [..._fusionadasEsc, ..._soloLocalesEsc];
        })();
        // Merge tareas para hoy (recordatorios libres del día — módulo aparte
        // de Pendientes) — mismo patrón que escrituras: se compara fechaMod y
        // gana la más reciente; las que solo existen en memoria local (recién
        // creadas o marcadas "resuelta" sin confirmar aún en Supabase) se
        // conservan.
        (function(){
          const _sbTareas = data.data.tareasHoy || [];
          const _localTareas = Array.isArray(D.tareasHoy) ? D.tareasHoy : [];
          const _mapaLocalTareas = {};
          _localTareas.forEach(function(t){ if(t && t.id) _mapaLocalTareas[t.id] = t; });
          const _sbTareasIds = new Set(_sbTareas.map(function(t){ return t.id; }));
          const _fusionadasTareas = _sbTareas.map(function(t){
            const _loc = t && t.id ? _mapaLocalTareas[t.id] : null;
            if (_loc) {
              const tsLoc = Date.parse(_loc.fechaMod || 0) || 0;
              const tsSb  = Date.parse(t.fechaMod || 0) || 0;
              if (tsLoc > tsSb) return _loc;
            }
            return t;
          });
          const _soloLocalesTareas = _localTareas.filter(function(t){ return t && t.id && !_sbTareasIds.has(t.id); });
          D.tareasHoy = [..._fusionadasTareas, ..._soloLocalesTareas];
        })();
        // Merge adeudos sin recibo (gastos/deudas de clientes fuera del
        // sistema de folios) — mismo patrón id + fechaMod que tareasHoy.
        (function(){
          const _sbAdeudos = data.data.adeudosSinRecibo || [];
          const _localAdeudos = Array.isArray(D.adeudosSinRecibo) ? D.adeudosSinRecibo : [];
          const _mapaLocalAdeudos = {};
          _localAdeudos.forEach(function(a){ if(a && a.id) _mapaLocalAdeudos[a.id] = a; });
          const _sbAdeudosIds = new Set(_sbAdeudos.map(function(a){ return a.id; }));
          const _fusionadasAdeudos = _sbAdeudos.map(function(a){
            const _loc = a && a.id ? _mapaLocalAdeudos[a.id] : null;
            if (_loc) {
              const tsLoc = Date.parse(_loc.fechaMod || 0) || 0;
              const tsSb  = Date.parse(a.fechaMod || 0) || 0;
              if (tsLoc > tsSb) return _loc;
            }
            return a;
          });
          const _soloLocalesAdeudos = _localAdeudos.filter(function(a){ return a && a.id && !_sbAdeudosIds.has(a.id); });
          D.adeudosSinRecibo = [..._fusionadasAdeudos, ..._soloLocalesAdeudos];
        })();
        // Estos dos son listas de folios (strings) que se agregan/quitan desde
        // varias funciones admin — se unen local+SB (en vez de sobreescribir)
        // para no perder una adición local reciente que un pull adelantado
        // todavía no ve confirmada en Supabase.
        D.recibosExcluidosCaja  = Array.from(new Set([...(data.data.recibosExcluidosCaja||[]), ...(Array.isArray(D.recibosExcluidosCaja)?D.recibosExcluidosCaja:[])].map(String)));
        D.cortesDeshabilitados  = Array.from(new Set([...(data.data.cortesDeshabilitados||[]), ...(Array.isArray(D.cortesDeshabilitados)?D.cortesDeshabilitados:[])].map(String)));
        // Merge pre-recibos: conservar los que están en memoria local y no están en Supabase
        // para evitar pérdida de pre-recibos creados entre sincronizaciones.
        // ⚠️ PROTECCIÓN: si un pre-recibo YA se marcó convertido:true en memoria local
        // (se generó su recibo con folio) pero la copia de Supabase todavía no llegó
        // a reflejar esa conversión (push aún no confirmado), NO revertirlo — si no,
        // el pre-recibo "revive" en el panel de pendientes aunque ya tenga folio real.
        const _sbPreRecibos = data.data.preRecibos || [];
        const _localPreRecibos = Array.isArray(D.preRecibos) ? D.preRecibos : [];
        const _mapaLocalPR = {};
        _localPreRecibos.forEach(function(p){ if(p && p.id) _mapaLocalPR[p.id] = p; });
        const _sbIds = new Set(_sbPreRecibos.map(p => p.id));
        const _fusionadosSB = _sbPreRecibos.map(function(p){
          const _loc = _mapaLocalPR[p.id];
          if (_loc && _loc.convertido && !p.convertido) return _loc;
          return p;
        });
        const _soloLocales = _localPreRecibos.filter(p => !_sbIds.has(p.id));
        D.preRecibos = [..._fusionadosSB, ..._soloLocales];
        // Catálogo de leyes del despacho — compartido entre todos los dispositivos
        if (Array.isArray(data.data.leyes) && data.data.leyes.length) {
          D.leyes = data.data.leyes;
          localStorage.setItem('lex-leyes-despacho', JSON.stringify(D.leyes));
        } else if (!D.leyes || !D.leyes.length) {
          // Migración: si hay leyes en localStorage pero aún no en SB, conservarlas
          const _localLeyes = JSON.parse(localStorage.getItem('lex-leyes-despacho') || '[]');
          if (_localLeyes.length) D.leyes = _localLeyes;
        }

        if(data.data.retro_global !== undefined) D.retro_global = data.data.retro_global;
        if(data.data.tiempoExtra !== undefined) D.tiempoExtra = data.data.tiempoExtra || {};
        // Migrar pendientes legacy: marca/clase → vehMarca/vehClase
        D.pendientes.forEach(p=>{ if(p.seccion==='placas'){ if(!p.vehMarca&&p.marca) p.vehMarca=p.marca; if(!p.vehClase&&p.clase) p.vehClase=p.clase; } });
        // ── LIMPIEZA INMEDIATA: eliminar pendientes de placas cuyo recibo ya está liquidado ──
        // Se corre aquí porque Supabase acaba de sobreescribir D.pendientes con los datos del servidor
        (function _limpiarPlacasLiquidadas(){
          if(!Array.isArray(appData.recibos)) return;
          var _lbSB = JSON.parse(localStorage.getItem('lex-placas-liquidados') || '[]');
          var _borrados = 0;
          D.pendientes = D.pendientes.filter(function(p){
            if(p.seccion !== 'placas' || !p.reciboVinculadoFolio) return true;
            var _versLb = appData.recibos.filter(function(r){ return Number(r.folio) === Number(p.reciboVinculadoFolio); });
            // Calcular saldo mínimo — tratar string "0", null y undefined como 0
            var saldo = _versLb.reduce(function(m,r){
              var s = (r.saldoPendiente !== undefined && r.saldoPendiente !== null) ? parseFloat(r.saldoPendiente) : NaN;
              if(!isNaN(s)) return Math.min(m, s);
              var sn = (r.saldoNuevo !== undefined && r.saldoNuevo !== null) ? parseFloat(r.saldoNuevo) : NaN;
              if(!isNaN(sn)) return Math.min(m, sn);
              if(r.liquidado === true) return Math.min(m, 0);
              // Sin dato de saldo en este recibo — asumir 0 si es versión secundaria (B,C,D)
              // para evitar que Infinity bloquee la limpieza
              var letra = r.letra || 'A';
              if(letra !== 'A') return Math.min(m, 0);
              return m;
            }, Infinity);
            // Si ningún recibo tiene saldo definido, saldo queda Infinity → no eliminar (dato faltante, no liquidado)
            // Excepto si el folio tiene al menos un recibo secundario con saldo 0 (ya manejado arriba)
            var _cancelLb = _versLb.some(function(r){ return r.cancelado; });
            if(_versLb.length === 0 || _cancelLb || !(saldo > 0)){
              var fs = String(p.reciboVinculadoFolio);
              if(_lbSB.indexOf(fs) < 0) _lbSB.push(fs);
              _borrados++;
              return false;
            }
            return true;
          });
          if(_borrados > 0){
            localStorage.setItem('lex-placas-liquidados', JSON.stringify(_lbSB));
            console.log('[LEX] Limpieza SB-load: ' + _borrados + ' pendiente(s) de placas liquidados eliminados.');
            // Persistir en Supabase para que no vuelvan en la próxima recarga
            setTimeout(function(){ if(typeof save === 'function') save(); }, 800);
          }
          // Migración: propagar saldo mínimo real al registro A para folios históricos
          // donde _imprimirActualizacionReal nunca actualizó A (bug corregido en 2026-06-04).
          // Esto evita que PASO 2 de sincronizarPendientesPlacas recree pendientes en otros dispositivos.
          var _migrados = 0;
          var _foliosVistos = {};
          appData.recibos.forEach(function(r){
            if(!r || r.esComplemento || !r.folio) return;
            var fk = String(r.folio);
            if(_foliosVistos[fk]) return;
            _foliosVistos[fk] = true;
            var _vers = appData.recibos.filter(function(v){ return Number(v.folio) === Number(r.folio); });
            if(_vers.length < 2) return; // sin versiones secundarias, no hay nada que migrar
            var _saldoMin = _vers.reduce(function(m,v){
              var s=parseFloat(v.saldoPendiente); if(!isNaN(s)) return Math.min(m,s);
              var sn=parseFloat(v.saldoNuevo);   if(!isNaN(sn)) return Math.min(m,sn);
              if(v.liquidado===true) return Math.min(m,0);
              return m;
            }, Infinity);
            if(_saldoMin === Infinity) return;
            var _idxA = appData.recibos.findIndex(function(v){
              return Number(v.folio) === Number(r.folio) && !v.esComplemento && !v.esActualizacion;
            });
            if(_idxA < 0) return;
            var _recA = appData.recibos[_idxA];
            var _saldoA = parseFloat(_recA.saldoPendiente);
            if(!isNaN(_saldoA) && _saldoA <= _saldoMin) return; // ya está correcto
            appData.recibos[_idxA] = Object.assign({}, _recA, {
              saldoPendiente: _saldoMin,
              saldoNuevo:     _saldoMin,
              liquidado:      _saldoMin <= 0 ? true : (_recA.liquidado || false)
            });
            _migrados++;
          });
          if(_migrados > 0){
            console.log('[LEX] Migración saldo-A: ' + _migrados + ' recibo(s) originales sincronizados con saldo mínimo real.');
            setTimeout(function(){ if(typeof save === 'function') save(); }, 1200);
          }
        })();
        // captura_meses: cargar desde Supabase
        const sbCapturaMeses = data.data.captura_meses || {};
        if(Object.keys(sbCapturaMeses).length > 0){
          D.captura_meses = sbCapturaMeses;
        }
      }
      // Migración: asignar anio_folio a recibos históricos que no lo tienen
      // Se asume 2026 para todos los recibos existentes sin el campo
      (appData.recibos||[]).forEach(r => {
        if(!r.anio_folio) r.anio_folio = 2026;
      });
      // Reconstruir REC
      if(typeof REC !== 'undefined'){
        REC.folioActual = appData.folioActual;
        REC.recibos     = appData.recibos;
      }
      console.log('[SB] Estado cargado:', {
        folio: appData.folioActual,
        recibos: (appData.recibos||[]).length,
        movimientos: (D?.movimientos||[]).length,
        juicios: (D?.juicios||[]).length,
        carpetas: (D?.carpetas||[]).length,
        directorio: (D?.directorio||[]).length
      });
    }
    // Refrescar UI
    // ⚠️ NO actualizar el display del folio si estamos en modo actualización (B, C, D…):
    // abrirModoActualizacion() ya puso la letra correcta y Realtime pisaría el display con el folio_actual principal.
    if(typeof actualizarFolioDisplay==='function' && !document.body.classList.contains('modo-actualizacion')){
      actualizarFolioDisplay();
    }
    if(typeof renderHistorial==='function') renderHistorial();
    if(typeof renderCaja==='function') renderCaja();
    if(typeof renderContab==='function') renderContab();
    if(typeof renderJuicios==='function') renderJuicios();
    if(typeof renderCarp==='function') renderCarp();
    if(typeof renderDirec==='function') renderDirec();
    if(typeof renderPend==='function') renderPend();
    if(typeof badges==='function') badges();
    if(typeof capturaMesCargarSupabase==='function') capturaMesCargarSupabase();
    if(typeof retroGlobalCargarSupabase==='function') retroGlobalCargarSupabase();
    // Auto-corregir letras de movimientos y paths R2 (silencioso, 8s después)
    if(typeof _autoCorregirLetrasR2 === 'function') _autoCorregirLetrasR2();
    // Verificar y corregir movimientos con monto erróneo para recibos Sin Anticipo (con modal de confirmación)
    // [DESACTIVADO a pedido del usuario] Auto-popup de "Corrección de movimientos Sin Anticipo".
    // La función verificarYCorregirMovimientosSinAnticipo SIGUE definida (puede invocarse
    // manualmente si se quisiera), pero ya NO se dispara sola al cargar, para que el modal
    // no vuelva a aparecer ni a empujar a aplicar cambios masivos sin revisión.
    // if(typeof verificarYCorregirMovimientosSinAnticipo === 'function') setTimeout(verificarYCorregirMovimientosSinAnticipo, 1500);
    // Backup diario a R2 — corre silenciosamente 3s despues de cargar datos
    setTimeout(function(){ backupAppData().catch(function(e){ console.warn('[Backup] inicio:', e); }); }, 3000);
  } catch(e){
    console.error('[SB] sincronizarFolio error:', e);
  } finally {
    _sincronizando = false;
  }
}

function _cargarDatosDesdeJSON(data){
  if(data && typeof data.folioActual === 'number'){
    appData.folioActual = data.folioActual;
    // ⚠️ CRÍTICO: ordenar para que A siempre preceda a B del mismo folio
    appData.recibos     = (data.recibos || []).slice().sort(function(a, b) {
      if (a.folio !== b.folio) return 0;
      var la = (a.letra || 'A'); var lb = (b.letra || 'A');
      return la < lb ? -1 : la > lb ? 1 : 0;
    });
  } else if(data && (data.folio_actual || data.siguiente_folio)){
    // Formato legacy — corregir y reescribir
    console.warn('⚠ Formato JSON legacy detectado — migrando...');
    appData.folioActual = data.folio_actual || data.siguiente_folio || data.folio_inicial || 1;
    appData.anioFolioActual = data.anio_folio_actual || new Date().getFullYear();
    // ⚠️ CRÍTICO: ordenar para que A siempre preceda a B del mismo folio
    appData.recibos     = (data.recibos || []).slice().sort(function(a, b) {
      if (a.folio !== b.folio) return 0;
      var la = (a.letra || 'A'); var lb = (b.letra || 'A');
      return la < lb ? -1 : la > lb ? 1 : 0;
    });
    actualizarArchivoControl(); // reescribir con formato correcto (no bloqueante)
  } else {
    // Archivo vacío o corrupto — mantener el folio en memoria sin resetear a 100
    console.warn('⚠ JSON sin datos válidos — manteniendo estado en memoria');
    if(!appData.folioActual || appData.folioActual < 1) appData.folioActual = 1;
  }
  // Tras cualquier carga/merge: el contador nunca puede quedar rebobinado.
  if(typeof _blindarContadorFolio === 'function') _blindarContadorFolio();
}

async function reservarFolioEnDrive(){
  // ═══════════════════════════════════════════════════════════════
  // RESERVA ATÓMICA DE FOLIO — vía función SQL en PostgreSQL
  // ═══════════════════════════════════════════════════════════════
  // Antes: lectura → incremento JS → escritura (race condition)
  // Ahora: UNA llamada RPC que PostgreSQL ejecuta atómicamente.
  // Es IMPOSIBLE que dos llamadas obtengan el mismo folio.
  // ═══════════════════════════════════════════════════════════════
  if(!window.SB || !window.SB_DESPACHO_ID){
    // Sin sesión: fallback local (solo para que no rompa offline)
    const f = appData.folioActual;
    appData.folioActual = f + 1;
    console.warn('⚠ Folio local usado (sin sesión Supabase):', f);
    return f;
  }
  try {
    // Llamada atómica a PostgreSQL — lock + increment + return en 1 transacción
    const { data: folio, error } = await window.SB.rpc('reservar_folio_atomico', {
      p_despacho_id: window.SB_DESPACHO_ID
    });
    if(error) throw error;
    if(folio == null) throw new Error('La función no devolvió folio');
    // Actualizar AMBOS contadores locales para que syncEstadoSupabase no revierta con el valor viejo
    appData.folioActual = folio + 1;
    if(typeof REC !== 'undefined' && REC) REC.folioActual = folio + 1;
    console.log('✓ Folio reservado (atómico):', folio, '— próximo:', folio + 1);
    return folio;
  } catch(e) {
    console.error('❌ reservarFolioEnDrive (RPC):', e);
    // Fallback local: buscar el primer folio que NO exista ya en appData.recibos
    console.warn('⚠ Usando fallback local para folio (RPC no disponible)');
    const recibosActuales = new Set((appData.recibos || []).map(r => r.folio));
    let f = Math.max(
      appData.folioActual || 1,
      // también considerar el mayor folio existente + 1
      ...([...(appData.recibos || [])].map(r => (r.folio || 0) + 1))
    );
    // Saltar cualquier folio ya usado
    while(recibosActuales.has(f)) f++;
    appData.folioActual = f + 1;
    if(typeof REC !== 'undefined' && REC) REC.folioActual = f + 1;
    console.warn('⚠ Folio fallback asignado:', f, '(próximo:', f+1, ')');
    return f;
  }
}

function _nombreArchivoR2(folioStr, nombre) {
  return folioStr + '.pdf';
}

function _nombreArchivoR2Legacy(folioStr, nombre) {
  var sanitizado = (nombre || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return folioStr + '_' + sanitizado + '.pdf';
}

async function _purgarPDFRecibo(folioStr, nombre){
  var variantes = new Set([folioStr + '.pdf']);
  if(typeof _nombreArchivoR2Legacy === 'function') variantes.add(_nombreArchivoR2Legacy(folioStr, nombre||''));
  var arr = Array.from(variantes);
  for(var i=0;i<arr.length;i++){
    var pn = arr[i];
    try{ if(typeof window.borrarR2==='function' && window.SB_DESPACHO_ID) await window.borrarR2(window.SB_DESPACHO_ID+'/recibos/'+pn, 'recibos').catch(function(){}); }catch(e){}
    try{ if(typeof borrarPDFdeDrive==='function') await borrarPDFdeDrive(pn).catch(function(){}); }catch(e){}
  }
}

async function subirPDFaDrive(pdfBlob, nombreArchivo, r2Nombre){
  // Intentar subir a R2 primero (con nombre descriptivo si se proporcionó)
  if(typeof window.subirR2 === 'function' && window.SB_DESPACHO_ID){
    try {
      const r2n  = r2Nombre || nombreArchivo;
      const path = window.SB_DESPACHO_ID + '/recibos/' + r2n;
      const file = new File([pdfBlob], r2n, {type:'application/pdf'});
      const ok = await window.subirR2(file, path, 'recibos');
      if(ok){
        console.log('✓ PDF guardado en R2:', r2n);
        return true;
      }
    } catch(e){ console.warn('R2 upload falló, intentando Supabase:', e); }
  }
  // Fallback a Supabase Storage (siempre con el nombre corto)
  if(!window.SB || !window.SB_DESPACHO_ID) return false;
  try {
    const path = window.SB_DESPACHO_ID + '/recibos/' + nombreArchivo;
    const { error } = await window.SB.storage.from(STORAGE_BUCKET).upload(path, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true
    });
    if(error){ console.error('subirPDFaDrive:', error); return false; }
    console.log('✓ PDF subido a Supabase (fallback):', nombreArchivo);
    return true;
  } catch(e){ console.error('subirPDFaDrive:', e); return false; }
}

async function driveGET(url){
  // Algunas funciones legacy invocan driveGET con URLs de Drive específicas.
  // Mapeamos la única realmente útil (leer el JSON principal) y devolvemos
  // el estado actual desde Supabase.
  if(!window.SB || !window.SB_DESPACHO_ID) return null;
  const { data, error } = await window.SB
    .from('app_state')
    .select('data, recibos, folio_actual')
    .eq('despacho_id', window.SB_DESPACHO_ID)
    .single();
  if(error){
    console.warn('[SB] driveGET compat:', error.message);
    return { folioActual: appData.folioActual || 1, anioFolioActual: appData.anioFolioActual || new Date().getFullYear(), recibos: appData.recibos || [] };
  }
  // Si la URL pide files/list, devolver lista no-vacía para compat
  if(url && url.includes('files?q=')){
    return { files: [{ id: 'supabase', name: 'lexmexico_folio_control.json', createdTime: new Date().toISOString() }] };
  }
  // Devolver el contenido del archivo de control en formato esperado
  return data.recibos || { folioActual: data.folio_actual || 100, recibos: [] };
}

function folioFormato(num, anioFolio){
  return String(Number(num));
}

function letraVersion(recibo){
  if(!recibo) return 'A';
  const n = (recibo.fechasImpresion || []).filter(f => f.etiqueta !== 'Original').length;
  return String.fromCharCode(65 + n); // 0=A, 1=B, 2=C...
}

function folioConLetra(num, anioFolio, letra){
  return String(Number(num)) + (letra || 'A');
}

function letraDeRecibo(folio) {
  const r = (typeof appData !== 'undefined' ? appData.recibos||[] : [])
    .find(function(r){ return r.folio === folio && !r.esComplemento; });
  return r ? (r.letra || letraVersion(r) || 'A') : 'A';
}

function _blindarContadorFolio(){
  try {
    const usados = Object.create(null);
    const recs = (appData && appData.recibos) || [];
    for(let i=0; i<recs.length; i++){
      const f = Number(recs[i] && recs[i].folio);
      if(Number.isFinite(f)) usados[f] = true;
    }
    let f = Number(appData.folioActual);
    if(!Number.isFinite(f) || f < 1) f = 1;
    // El contador SOLO se corrige si apunta a un folio YA OCUPADO (riesgo de
    // duplicado por reinicio anual viejo, merge stale o regresión por borrado).
    // Si apunta a un hueco LIBRE (p. ej. tras "Insertar espacio" o "Usar
    // siguiente hueco"), se respeta — los huecos son números válidos por llenar.
    if(usados[f]){
      const prev = f;
      while(usados[f]) f++;
      console.warn('[LEX] folioActual apuntaba a un folio ocupado (' + prev +
        '); corregido al primer libre: ' + f);
    }
    if(appData.folioActual !== f){
      appData.folioActual = f;
      if(typeof REC !== 'undefined' && REC) REC.folioActual = f;
    }
  } catch(e){ console.error('[_blindarContadorFolio]', e); }
}

function verificarReinicioAnual(){
  // ── MODELO DE FOLIO CONTINUO E INFINITO ──────────────────────────────
  // El número de folio NUNCA se reinicia: es una secuencia perpetua (1,2,3…).
  // Solo se actualiza el año-sello (anio_folio) para los registros; el
  // contador folioActual sigue creciendo sin importar el cambio de año.
  const anioActual = new Date().getFullYear();
  if(!appData.anioFolioActual) appData.anioFolioActual = anioActual;
  if(appData.anioFolioActual !== anioActual){
    console.log('[LEX] Nuevo año detectado — folioActual NO se reinicia (secuencia continua). Año-sello: ' + anioActual);
    appData.anioFolioActual = anioActual;
    // ⚠️ NO se toca appData.folioActual: la secuencia es infinita.
  }
  // El contador jamás debe quedar por debajo del mayor folio ya emitido.
  _blindarContadorFolio();
}

function abrirSelectorEstadoPlaca(){
  // No permitir editar el estado de las placas cuando el recibo está congelado
  // o en consulta: pago parcial, liquidación total, cancelación y consulta de folio.
  // El estado queda fijo en la opción del recibo principal.
  var _bcl = document.body.classList;
  if(_bcl.contains('recibo-frozen') || _bcl.contains('modo-actualizacion') ||
     _bcl.contains('desde-liquidacion') || _bcl.contains('modo-consulta') ||
     _bcl.contains('folio-cancelado') || _bcl.contains('folio-liquidado')) return;
  if(document.getElementById('overlay-estado-placa')) return; // evitar duplicados
  var inp = document.getElementById('placa-estado');
  var actual = inp ? (inp.value || '') : '';

  var ov = document.createElement('div');
  ov.id = 'overlay-estado-placa';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(26,16,8,0.45);display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.addEventListener('click', function(e){ if(e.target === ov) cerrarSelectorEstadoPlaca(); });

  var panel = document.createElement('div');
  panel.style.cssText = "background:#fffdf6;border:1.5px solid #d4b870;border-radius:14px;box-shadow:0 18px 50px rgba(26,16,8,0.4);width:360px;max-width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;font-family:'DM Sans',sans-serif;";

  var head = document.createElement('div');
  head.style.cssText = "padding:13px 18px;background:#1a1008;color:#f0e6d2;font-family:'DM Mono',monospace;font-size:0.78rem;letter-spacing:0.08em;text-transform:uppercase;display:flex;align-items:center;justify-content:space-between;";
  head.innerHTML = '<span>🪪 Estado de las placas</span>';
  var xb = document.createElement('span');
  xb.textContent = '✕';
  xb.style.cssText = 'cursor:pointer;opacity:0.85;font-size:0.9rem;';
  xb.onclick = cerrarSelectorEstadoPlaca;
  head.appendChild(xb);

  var lista = document.createElement('div');
  lista.style.cssText = 'overflow-y:auto;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;';

  _ESTADOS_PLACA.forEach(function(e){
    var it = document.createElement('button');
    it.type = 'button';
    var sel = (e[0] === actual);
    var esSinEsp = (e[0] === 'SIN_ESP');
    it.style.cssText = "text-align:left;border:1.5px solid " + (sel ? '#c8952a' : '#e6d8b8') +
      ";background:" + (sel ? '#fbf0d8' : (esSinEsp ? '#f3ece0' : '#fffdf6')) +
      ";border-radius:8px;padding:9px 11px;cursor:pointer;font-family:'DM Sans',sans-serif;color:#3a2a14;display:flex;flex-direction:column;gap:2px;transition:border-color 0.15s;" +
      (esSinEsp ? 'grid-column:1 / -1;' : '');
    it.innerHTML = '<span style="font-weight:600;font-size:0.8rem;">' + escapeHtml(e[2]) + '</span>' +
      '<span style="font-family:\'DM Mono\',monospace;font-size:0.6rem;color:#a9925f;letter-spacing:0.05em;">' + escapeHtml(e[1]) + '</span>';
    it.onmouseenter = function(){ if(!sel) it.style.borderColor = '#d4b870'; };
    it.onmouseleave = function(){ if(!sel) it.style.borderColor = '#e6d8b8'; };
    it.onclick = function(){ _elegirEstadoPlaca(e[0]); };
    lista.appendChild(it);
  });

  panel.appendChild(head);
  panel.appendChild(lista);
  ov.appendChild(panel);
  document.body.appendChild(ov);
  document.addEventListener('keydown', _escEstadoPlacaKey);
}

function calcTotales(){
  let total=0;
  document.querySelectorAll('.precio').forEach(p=>{ total+=parsePrecio(p.value); });
  const antipoInput = $('anticipo');
  const anticipo    = parsePrecio(antipoInput.value);
  // Solo actualizar cuadro dorado en modo recibo normal
  // En modo actualizacion lo gestiona recalcularResumenActualizacion()
  const _enModoAct = (typeof reciboEnActualizacion !== 'undefined' && reciboEnActualizacion);
  if(!_enModoAct){
    document.getElementById('total-display').textContent='$'+fmtMXN(total);
    document.getElementById('resta-display').textContent='$'+fmtMXN(total-anticipo);
  }
}

function validarAnticipo(){
  const antipoInput = $('anticipo');
  const anticipo    = parsePrecio(antipoInput.value);
  // No validar si el campo está vacío
  if(!antipoInput.value || anticipo <= 0){
    antipoInput.style.borderColor = '';
    antipoInput.style.boxShadow   = '';
    return;
  }
  // Calcular el límite correcto según contexto
  let total = 0;
  document.querySelectorAll('.precio').forEach(p=>{ total+=parsePrecio(p.value); });
  let limite = total;
  const _enModoAct = (typeof reciboEnActualizacion !== 'undefined' && reciboEnActualizacion);
  if(_enModoAct){
    // En modo actualización: límite = saldo pendiente + costos extra nuevos
    const saldoBase = parseFloat(reciboEnActualizacion.saldoPendiente) || 0;
    const sumaCE    = (typeof getCostosExtra === 'function')
      ? getCostosExtra().filter(c => c.locked !== true).reduce((s,c)=>s+(parseFloat(c.precio)||0), 0)
      : 0;
    limite = saldoBase + sumaCE;
    if(!limite) limite = total;
  }
  // Mostrar modal solo si hay excedente real (tolerancia 0.01 para decimales)
  if(limite > 0 && anticipo > limite + 0.01){
    const tipo     = _enModoAct ? 'saldo pendiente' : 'total';
    const excedente = anticipo - limite;
    document.getElementById('modal-anticipo-warn-msg').innerHTML =
      'El anticipo ingresado <strong>supera el ' + tipo + '</strong> del recibo. '
      +'Por favor verifica y corrige el monto antes de continuar.';
    document.getElementById('modal-anticipo-warn-detalle').innerHTML =
      '📥 Anticipo ingresado: <strong>$' + fmtMXN(anticipo) + '</strong><br>'
      +'📋 ' + (tipo === 'saldo pendiente' ? 'Saldo pendiente' : 'Total del recibo')
      +': <strong>$' + fmtMXN(limite) + '</strong><br>'
      +'⚠️ Excedente: <strong style="color:#c0161a;">$' + fmtMXN(excedente) + '</strong>';
    document.getElementById('modal-anticipo-warn').classList.add('show');
    antipoInput.style.borderColor = '#c0161a';
    antipoInput.style.boxShadow   = '0 0 0 2px rgba(192,22,26,0.18)';
  } else {
    document.getElementById('modal-anticipo-warn').classList.remove('show');
    antipoInput.style.borderColor = '';
    antipoInput.style.boxShadow   = '';
  }
}

function quitarConcepto(id){ const r=document.getElementById('concepto-row-'+id); if(r){r.remove();calcTotales();} }

function getConceptos(){
  const cs=document.querySelectorAll('.concepto'),ds=document.querySelectorAll('.descripcion'),ps=document.querySelectorAll('.precio');
  return Array.from(cs).map((el,i)=>({concepto:el.value,descripcion:ds[i].value,precio:String(parsePrecio(ps[i]?.value))}));
}

function limpiarFormCompleto(){
  // Helper: ejecutar un paso aislado sin que un error rompa la cadena
  const paso = (nombre, fn) => { try { fn(); } catch(e){ console.warn('[limpiarFormCompleto:'+nombre+']', e); } };
  // Resetear letra actual a A (nuevo recibo siempre es A)
  window._letraReciboActual = 'A';
  if (typeof _actualizarVisibilidadPoder === 'function') _actualizarVisibilidadPoder('', 'A');
  if (typeof _actualizarSeccionModoCosto === 'function') _actualizarSeccionModoCosto('', 'A');
  var _mcInp = document.getElementById('modo-costo-pactado'); if(_mcInp) _mcInp.value = '';
  var _btnP = document.getElementById('btn-costo-pactado'); if(_btnP){ _btnP.style.borderColor=''; _btnP.style.background=''; _btnP.style.color=''; }
  var _btnA = document.getElementById('btn-sin-costo-pactado'); if(_btnA){ _btnA.style.borderColor=''; _btnA.style.background=''; _btnA.style.color=''; }
  // Desvincular pre-recibo de origen: si el formulario se limpia (nuevo recibo,
  // navegación, etc.) el vínculo deja de aplicar — un recibo posterior ajeno
  // NO debe marcar como convertido el pre-recibo abandonado.
  paso('pre-recibo-link', ()=>{ window._prDatosParaRecibo = null; });
  // 0. Quitar TODAS las clases de modo (actualización, congelado, consulta, etc.)
  paso('clases-body', ()=>{
    ['modo-actualizacion','recibo-frozen','desde-liquidacion','actualizacion-impresa',
     'modo-consulta','folio-liquidado','folio-cancelado','modo-edicion-completa',
     'modo-restauracion',
     'paneles-busqueda-abiertos','paneles-abiertos-consulta','en-accion-pago'].forEach(c=>document.body.classList.remove(c));
    var _antReset = document.getElementById('anticipo'); if(_antReset) _antReset.readOnly = false;
    _panelesBusquedaAbiertos = false;
    _reciboEnEdicionCompleta = null;
    window._edicionCompletaActiva = false; // liberar guard al limpiar form
    // Resetear estilos inline de paneles para que togglePanelesBusqueda pueda reabrirlos
    // (pbc-body/pfc-body pueden tener display:none !important de _cerrarPanelesBusqueda)
    const _pbcRst = document.getElementById('pbc-body');
    const _pfcRst = document.getElementById('pfc-body');
    const _panRst = document.getElementById('paneles-busqueda-cuerpo');
    if(_pbcRst) _pbcRst.removeAttribute('style');
    if(_pfcRst) _pfcRst.removeAttribute('style');
    if(_panRst) _panRst.setAttribute('style','display:none; padding:0 20px 14px;');
    if(typeof syncFormVisibility==='function') syncFormVisibility();
  });
  // 0.a1 Cerrar la Ficha del Folio si estaba abierta — de lo contrario se queda
  // flotando sobre el formulario de nuevo recibo aunque ya no se esté consultando nada.
  paso('cerrar-ficha', ()=>{
    if(typeof cerrarFichaFolio==='function') cerrarFichaFolio();
  });
  // 0.b Restaurar panel de acciones al estado inicial
  paso('paneles-acciones', ()=>{
    const aNormal = document.getElementById('actions-normal');
    const aPost   = document.getElementById('actions-post-print');
    const aAct    = document.getElementById('actions-actualizacion');
    const aCons   = document.getElementById('actions-consulta');
    const aRest   = document.getElementById('actions-restauracion');
    const banner  = document.getElementById('frozen-banner');
    const bannerRest = document.getElementById('restauracion-banner');
    const btnGuardar = document.getElementById('btn-guardar');
    if(aNormal) aNormal.style.display = 'flex';
    if(aPost)   aPost.style.display   = 'none';
    if(aAct)    aAct.style.removeProperty('display'); aAct && (aAct.style.display = 'none');
    if(aCons)   aCons.style.display   = 'none';
    if(aRest)   aRest.style.display   = 'none';
    if(banner)  banner.style.display  = 'none';
    if(bannerRest) bannerRest.style.display = 'none';
    if(btnGuardar) btnGuardar.disabled = false;
    // Forzar ocultar actions-actualizacion con atributo inline (gana al CSS !important)
    const _aActForce = document.getElementById('actions-actualizacion');
    if(_aActForce) _aActForce.setAttribute('style','display:none !important;');
    // ── Banner y botones de "MODO EDICIÓN COMPLETA" ──────────────────────
    // editarReciboEnConsulta()/adminAbrirEdicionCompleta() fijan su display
    // directo en el estilo inline (banner.style.display='flex'). La regla CSS
    // que los muestra depende de la clase body.modo-edicion-completa con
    // !important, así que MIENTRAS la clase está presente esa regla gana; pero
    // en cuanto se quita la clase (como hace cancelarEdicionCompleta), deja de
    // aplicar y el navegador vuelve a usar el inline "flex" que quedó puesto
    // — el banner se queda pegado en pantalla aunque el formulario ya se
    // limpió. Hay que resetear el inline explícitamente, igual que ya se hace
    // en el flujo de "modo-restauracion" (más abajo en el archivo).
    const _edcBanner  = document.getElementById('edicion-completa-banner');
    const _edcActions = document.getElementById('actions-edicion-completa');
    if(_edcBanner)  _edcBanner.style.display  = 'none';
    if(_edcActions) _edcActions.style.display = 'none';
  });
  // 1. Limpiar clientes y conceptos dinámicos (1 fila vacía cada uno)
  paso('clientes', ()=>{
    $('clientes-wrapper').innerHTML='';
    clienteCount=0;
    agregarCliente();
  });
  paso('conceptos', ()=>{
    $('conceptos-tbody').innerHTML='';
    conceptoCount=0;
    agregarConcepto();
  });
  // 2. Limpiar todos los campos de texto / select del bloque vehicular y trámites
  paso('campos-texto', ()=>{
    ['tramites','clase','marca','tipo_veh','serie','motor','anio','puertas','color_veh',
     'transmision','cilindros','placa','ultima_tenencia','origen','combustible',
     'anticipo','folio_anterior'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.value='';
    });
  });
  // 3. Restaurar valores por defecto fijos (responsable, firma)
  paso('defaults', ()=>{
    const respField = $('responsable');
    if(respField) respField.value = empleadoActual ? empleadoActual.nombre : NOMBRE_TITULAR;
    const firmaField = $('nombre_cliente_firma');
    if(firmaField){ firmaField.value=''; delete firmaField.dataset.manualEdit; }
  });
  // 4. Salir de modo consulta (cierra iframe del PDF si estaba abierto)
  paso('salir-consulta', ()=>{ if(typeof salirModoConsulta==='function') salirModoConsulta(); });
  // 5. Ocultar bloque "Folio anterior" e historial de pagos
  paso('folio-anterior', ()=>{
    const infoBox = document.getElementById('info-folio-anterior');
    const histDiv = document.getElementById('historial-pagos-prev');
    if(infoBox){ infoBox.style.display='none'; infoBox.classList.remove('cancelado-box'); }
    if(histDiv) histDiv.style.display='none';
  });
  // 6. Limpiar checkboxes de documentos Y CERRAR todas las categorías (modo nativo virgen)
  paso('docs-checkboxes', ()=>{
    document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(c=>{
      c.checked=false; c.disabled=false;
    });
  });
  paso('docs-categorias-cerrar', ()=>{
    document.querySelectorAll('#docs-checklist .doc-category').forEach(cat=>{
      const body  = cat.querySelector('.doc-category-body');
      const arrow = cat.querySelector('.doc-category-header span');
      if(body)  body.style.display = 'none';
      if(arrow) arrow.textContent = '\u25b8'; // ▸ flecha cerrada
    });
  });
  // 7. Restablecer tipo doc y tipo trámite al estado inicial
  paso('tipo-doc-tramite', ()=>{
    if(typeof setTipoDoc==='function') setTipoDoc('copia');
    if(typeof setTipoTramite==='function') setTipoTramite('normal');
  });
  // 8. Cerrar sección vehiculo (volver a flecha plegada ▸)
  paso('cerrar-vehiculo', ()=>{
    // setTipoTramite('normal') ya oculta seccion-vehiculo, pero reforzamos:
    const secVeh = document.getElementById('seccion-vehiculo');
    if(secVeh) secVeh.style.display = 'none';
    const vBody = document.getElementById('vehicle-grid-body');
    const vArrow = document.querySelector('.section-label-toggle .veh-arrow');
    if(vBody)  vBody.style.display = 'none';
    if(vArrow) vArrow.textContent = '\u25b8'; // ▸ cerrada
  });
  // 9. Limpiar cuadro rojo de placas
  paso('placas', ()=>{ if(typeof mostrarPlacasEnPantalla==='function') mostrarPlacasEnPantalla(null, null); });
  // 10. Limpiar costos extra / pagos parciales del modo actualización
  paso('costos-extra-pagos', ()=>{
    const ceBody  = document.getElementById('costos-extra-tbody');
    const ppBody  = document.getElementById('pagos-parciales-tbody');
    const resumen = document.getElementById('resumen-pagos-parciales');
    const secCE   = document.getElementById('seccion-costos-extra');
    const secPP   = document.getElementById('seccion-pagos-parciales');
    if(ceBody) ceBody.innerHTML='';
    if(ppBody) ppBody.innerHTML='';
    if(resumen){ resumen.style.display='none'; resumen.innerHTML=''; }
    if(secCE) secCE.style.display='none';
    if(secPP) secPP.style.display='none';
    // Resetear contadores globales si existen
    if(typeof costoExtraCount !== 'undefined') costoExtraCount = 0;
    if(typeof pagoParcialCount !== 'undefined') pagoParcialCount = 0;
    // Ocultar y vaciar la sección "Saldo Restante" (ADEUDO ANTERIOR de Costo
    // Pactado) — si no se limpia aquí, la fila con el saldo del recibo
    // editado se queda visible al cancelar/limpiar el formulario.
    const secSR = document.getElementById('seccion-saldo-restante-cp');
    if(secSR) secSR.style.display='none';
    const _cptoSR = document.getElementById('sr-cp-concepto');
    const _descSR = document.getElementById('sr-cp-descripcion');
    if(_cptoSR){ _cptoSR.value=''; delete _cptoSR.dataset.manualEdit; }
    if(_descSR){ _descSR.value=''; delete _descSR.dataset.manualEdit; }
  });
  // 11. Resetear variables internas de modo actualización, consulta, abono y retroactivo
  paso('vars-internas', ()=>{
    if(typeof reciboEnActualizacion !== 'undefined') reciboEnActualizacion = null;
    if(typeof reciboEnConsulta      !== 'undefined') reciboEnConsulta      = null;
    window._autorizacionActual               = null;
    window._autorizacionCancelacion          = null;
    // Modo abono: limpiar referencia para evitar que el siguiente recibo quede como abono
    window._folioReferencia                  = null;
    window._letraAbonoRetroactivo            = null;
    window._respSeleccionado                 = null;
    // Modo retroactivo
    window._reciboRetroactivoActivo          = false;
    window._reciboRetroactivoFechaPersonalizada = null;
    window._reciboRetroactivoHoraPersonalizada  = null;
    if(typeof lastActualizacionBlob   !== 'undefined') lastActualizacionBlob   = null;
    if(typeof lastActualizacionNombre !== 'undefined') lastActualizacionNombre = null;
    if(typeof lastPdfBlob !== 'undefined') lastPdfBlob = null;
  });
  // 11b. Resetear visualmente el botón RETRO y estilos de fecha/hora
  paso('reset-retro-visual', ()=>{
    var _btnRetro = document.getElementById('btn-toggle-retro');
    if(_btnRetro){
      _btnRetro.style.background  = 'none';
      _btnRetro.style.color       = 'var(--muted)';
      _btnRetro.style.borderColor = 'rgba(200,149,42,0.3)';
      _btnRetro.textContent       = '⏰ RETRO';
    }
    var _fDisp = document.getElementById('fecha_recibo_display');
    if(_fDisp){ _fDisp.style.borderBottom=''; _fDisp.style.color=''; _fDisp.style.fontWeight=''; }
    var _hDisp = document.getElementById('hora_recibo_display');
    if(_hDisp){ _hDisp.style.color=''; _hDisp.style.fontWeight=''; }
  });
  // 12. Reiniciar fecha/hora con la hora CDMX actual (vía referencia global)
  paso('fecha-hora', ()=>{
    if(typeof window._aplicarFechaLocal === 'function'){
      window._aplicarFechaLocal(new Date());
    }
  });
  // 13. Resetear cuadro marrón Total/Anticipo/Resta a $0.00
  //     (DEBE hacerse DESPUÉS de limpiar conceptos para que calcTotales no lo sobreescriba con basura)
  paso('totales-display', ()=>{
    const totalDisp = document.getElementById('total-display');
    const restaDisp = document.getElementById('resta-display');
    const antInput  = $('anticipo');
    if(totalDisp) totalDisp.textContent = '$0.00';
    if(restaDisp) restaDisp.textContent = '$0.00';
    if(antInput)  antInput.value = '';
    // Restaurar etiqueta 'Total Restante' → 'Total' al salir del modo pago total
    const _lblReset = totalDisp ? totalDisp.previousElementSibling : null;
    if(_lblReset && _lblReset.tagName === 'LABEL') _lblReset.textContent = 'Total';
  });
  // 14. Resetear botones de actualización a su estado original (texto + onclick)
  paso('botones-actualizacion', ()=>{
    const btnCancelarAct = document.getElementById('btn-cancelar-actualizacion');
    if(btnCancelarAct){
      btnCancelarAct.innerHTML = '\u2715 Cancelar Actualizaci\u00f3n';
      btnCancelarAct.onclick = (typeof cancelarActualizacion === 'function') ? cancelarActualizacion : null;
    }
    const btnImprimirAct = document.getElementById('btn-imprimir-actualizacion');
    if(btnImprimirAct){
      btnImprimirAct.innerHTML = '\ud83d\udda8 Imprimir Actualizaci\u00f3n';
      btnImprimirAct.onclick = (typeof imprimirActualizacion === 'function') ? imprimirActualizacion : null;
    }
  });
  // 15. Recalcular totales (con la fila vacía ya creada → da $0.00), QR y folio display
  paso('recalcular', ()=>{
    if(typeof calcTotales==='function') calcTotales();
    if(typeof generarQRPreview==='function') generarQRPreview();
    if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
  });
  // 16. Estado final y mensaje
  paso('status', ()=>{
    setStatus('ok','Nuevo folio #'+folioFormato(appData.folioActual)+' listo para capturar','ok');
  });
}

function dibujarEncabezadoPDF(doc, margin, cW, folio, logoObj, letra, anioFolio){
  const GOLD  = [154,110,24];
  const GBORD = [200,160,60];
  const DARK  = [60, 45, 20];
  const MUTED = [122,104,64];
  const RED   = [192, 22, 26];
  const PAD   = 3;
  const hH    = 28;
  const hTop  = 6;
  const hBot  = hTop + hH;
  // ── COLUMNAS ──
  const logoColW   = 28;
  const folioColW  = 34;
  const centerColW = cW - logoColW - folioColW;
  const centerColX = margin + logoColW;
  const centerMidX = centerColX + centerColW / 2;
  const folioX     = margin + logoColW + centerColW;
  const folioMidX  = folioX + folioColW / 2;
  // ── RECT EXTERIOR ──
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.7);
  doc.rect(margin, hTop, cW, hH);
  // ── LOGO — proporcional usando dimensiones reales de la imagen ──
  const logoDataURL = logoObj && logoObj.url ? logoObj.url : (typeof logoObj === 'string' ? logoObj : '');
  const imgW = logoObj && logoObj.w ? logoObj.w : 1;
  const imgH = logoObj && logoObj.h ? logoObj.h : 1;
  const ratio = imgW / imgH;   // relación ancho/alto real de la imagen
  if(logoDataURL){
    try{
      // Espacio disponible dentro de la columna con padding
      const maxW = logoColW - 6;    // margen lateral
      const maxH = hH - PAD * 2;   // margen vertical
      // Calcular tamaño que quepa respetando la proporción
      let lW = maxW;
      let lH = lW / ratio;
      if(lH > maxH){ lH = maxH; lW = lH * ratio; }
      // Centrar horizontal y verticalmente en la columna
      const lX = margin + (logoColW - lW) / 2;
      const lY = hTop + (hH - lH) / 2;
      doc.addImage(logoDataURL, 'JPEG', lX, lY, lW, lH);
    }catch(e){ console.warn('Logo error:', e); }
  }
  // ── SEPARADOR VERTICAL izquierdo de columna folio ──
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.3);
  doc.line(folioX, hTop + 1, folioX, hBot - 1);
  // ── FOLIO: "NO. RECIBO" FUERA del rect, arriba — más grande ──
  // Distribuimos verticalmente: centrar el bloque folio en hH
  // Bloque = labelH(2.5) + gap(1.5) + rectH(12) + gap(1.5) + labelH(2.5) = 20mm
  const fBlkH  = 20;
  const fBlkY  = hTop + (hH - fBlkH) / 2;   // Y inicio del bloque folio
  // "NO. RECIBO" — fuera del rect del número, letra grande bold
  doc.setFontSize(7); doc.setFont('courier','bold'); doc.setTextColor(...GOLD);
  doc.text('NO. RECIBO', folioMidX, fBlkY + 2.5, {align:'center', charSpace:0.6});
  // Rectángulo del número — solo cubre el dígito, fondo crema suave
  const rY = fBlkY + 4.5;
  const rH = 9;
  const rX = folioX + 2;
  const rW = folioColW - 4;
  doc.setFillColor(250, 246, 236);
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.6);
  doc.rect(rX, rY, rW, rH, 'FD');
  // Número dentro del rect — Courier bold, rojo — formato AÑO-NÚMERO (ej. 26-001)
  const folioTexto = folioConLetra(folio, anioFolio || null, letra || 'A'); // ej. 26-001A
  // Font adaptable: 7 caracteres (26-001A) — ajuste por letra extra
  const folioFontSize = folioTexto.length <= 6 ? 14 : folioTexto.length <= 7 ? 12 : 10;
  doc.setFontSize(folioFontSize); doc.setFont('courier','bold'); doc.setTextColor(...RED);
  doc.text(folioTexto, folioMidX, rY + 6.2, {align:'center', charSpace:0.5});
  // "FOLIO OFICIAL" — fuera del rect, abajo, más grande y bold
  doc.setFontSize(7); doc.setFont('courier','bold'); doc.setTextColor(...MUTED);
  doc.text('FOLIO OFICIAL', folioMidX, rY + rH + 4, {align:'center', charSpace:0.5});
  // ── COLUMNA CENTRAL — distribuida en el espacio interior del rect ──
  // Bloque: título(4mm) + dir1(4mm) + dir2(3.5mm) + sep(2mm) + tel-label(3mm) + tel(4mm) = 20.5mm
  // Partimos desde hTop+2 (2mm de padding superior dentro del rect)
  const cPadTop = hTop + 2.5;
  // Título
  doc.setFontSize(12.5); doc.setFont('times','bold'); doc.setTextColor(...GOLD);
  doc.text('LEX-MÉXICO · DESPACHO JURÍDICO', centerMidX, cPadTop + 3.5, {align:'center'});
  // Dirección
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...DARK);
  doc.text('CALLE MIGUEL HIDALGO ESQ. MÉXICO NO. 200, LOCAL B, COL. CENTRO', centerMidX, cPadTop + 7.5, {align:'center'});
  doc.text('SANTIAGO JUXTLAHUACA, OAXACA', centerMidX, cPadTop + 11, {align:'center'});
  // Separador fino dorado
  doc.setDrawColor(...GBORD); doc.setLineWidth(0.2);
  doc.line(centerColX + 4, cPadTop + 13, centerColX + centerColW - 4, cPadTop + 13);
  // "TELÉFONO DE OFICINA — Informes y citas" en una sola línea, más grandes
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(...GOLD);
  doc.text('TEL. OFICINA · INFORMES Y CITAS:', centerMidX, cPadTop + 16.5, {align:'center'});
  // Número de teléfono — grande y destacado
  doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...GOLD);
  doc.text('953 128 7511', centerMidX, cPadTop + 21.5, {align:'center'});
  return hBot;   // Y donde termina el encabezado
}

async function generarPDF(datos,folio,qrDataURL){
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
  const margin=11,pageW=215.9,cW=pageW-margin*2;
  const logoObj = await getLogoDataURL();
  // ── ENCABEZADO ──
  const hBot = dibujarEncabezadoPDF(doc, margin, cW, folio, logoObj, datos.letra, datos.anio_folio);
  const yAfterH = hBot + 3;
  // ── RECIBO OFICIAL / RECIBO DE LIQUIDACIÓN / RECIBO DE ABONO PARCIAL / RECIBO DE SERVICIO COMPLEMENTARIO ──
  const _fps = datos.fechasImpresion || [];
  // FIX (caso real: folio 74A): el folio A NUNCA debe tratarse como
  // "actualización" (_esUpdate), sin importar cuántas entradas traiga
  // fechasImpresion (reimpresiones/ediciones directas de la letra A, como
  // editarReciboEnConsulta/adminAbrirEdicionCompleta, pueden dejar más de una
  // entrada ahí). Cuando _esUpdate se colaba en true para la letra A, el PDF
  // usaba el cuadro de totales de B+ (SALDO ANTERIOR/PAGO RECIBIDO, basado en
  // pagosParciales) en vez del propio de la letra A (TOTAL/ABONADO/RESTA,
  // basado en el anticipo — ver _esVersionA más abajo) y el anticipo editado
  // ($5,500 en vez de $5,000) no se contaba como "pago recibido", dejando el
  // cuadro de totales $500 corto y el título en "PAGO PARCIAL" en vez de
  // "PAGO INICIAL". El folio A siempre es el original — solo B, C, D… son
  // actualizaciones reales.
  const _esUpdate = _fps.length > 1 && (datos.letra||'A').toUpperCase() !== 'A';
  // ⚠️ FIX: si anticipo = total (pago completo desde el inicio), también es liquidación
  const _pagadoCompleto = parseFloat(datos.saldoPendiente) <= 0 &&
                          parseFloat(datos.totalAbonado || datos.anticipo || 0) >= parseFloat(datos.total || 0);
  const _esFinalLiq = (_esUpdate || _pagadoCompleto) && (parseFloat(datos.saldoNuevo)<=0 || parseFloat(datos.saldoPendiente)<=0);
  const _esParcial  = _esUpdate && !_esFinalLiq;
  const _esCancelacion = !!datos.cancelado && _esUpdate;
  // ── Detectar si esta actualización incluye Servicio Complementario ──
  // Condición: hay al menos un costoExtra nuevo (no locked), sin importar si además hay abonos.
  // Cubre los 3 casos: (1) solo suma al total, (2) complementario liquidado en el acto,
  // (3) complementario + abono extra al saldo principal.
  const _ceNuevos = (datos.costosExtra || []).filter(c => c.locked !== true);
  // FIX: Al reimprimir/regenerar, los costosExtra ya están todos locked.
  // Detectar si ESTE recibo (esta letra) fue originalmente un Servicio Complementario:
  // hay costosExtra locked cuyo folioLetra coincide con la letra actual (fueron agregados en esta versión).
  const _letraActual = (datos.letra || 'A').toUpperCase();
  const _ceLocked = (datos.costosExtra || []).filter(c => c.locked === true &&
    ((c.folioLetra || '').toUpperCase() === _letraActual));
  // También detectar por el campo tipoVersion si existe
  const _esCEVersion = datos.tipoVersion === 'complementario' || datos.tipoVersion === 'ce';
  const _tieneCE = _esUpdate && (_ceNuevos.length > 0 || _ceLocked.length > 0 || _esCEVersion);
  // ── SIN COSTO TOTAL PACTADO (Juicio/Escritura abierto): cada recibo (A, B, C…) es un
  // comprobante INDEPENDIENTE del pago/cargo de ese momento — no una actualización que
  // arrastra saldo/historial de versiones ya liquidadas. Se calcula aquí, antes de dibujar
  // nada, porque el título y el cuadro de totales dependen de estos mismos números.
  const _esAbiertoPDF = (datos.modoCosto === 'abierto') || ((typeof window._abiertoSinCosto==='function') && window._abiertoSinCosto(datos));
  // ── LÓGICA ÚNICA de totales para folios de Costo Pactado (normal), calculada
  // AQUÍ (antes de dibujar nada) para que tanto el nuevo bloque "SUMA TOTAL DE
  // ADEUDOS / PAGOS REALIZADOS" (más abajo, junto al Servicio Complementario)
  // como el cuadro final TOTAL/ABONADO/RESTA usen los MISMOS números — una
  // sola fuente de verdad, nunca dos cálculos separados que puedan divergir.
  // Se basa exclusivamente en folioLetra (igual que la Ficha del Folio):
  //   PAGO RECIBIDO (esta versión) = Σ pagosParciales con folioLetra = esta
  //                                   + cargos liquidados al momento en esta versión.
  //   SALDO ANTERIOR                = totalGeneral (ya incluye costosExtra
  //                                    acumulados) − anticipo − Σ pagosParciales
  //                                    de versiones ANTERIORES.
  //   SALDO RESTANTE                = SALDO ANTERIOR − PAGO RECIBIDO.
  const _todosPP_CP = datos.pagosParciales || [];
  const _misPPEsta_CP = _todosPP_CP.filter(function(p){ return p && (p.folioLetra||'A').toUpperCase() === _letraActual; });
  const _ppAntes_CP   = _todosPP_CP.filter(function(p){ return p && (p.folioLetra||'A').toUpperCase() <  _letraActual; });
  const _ceLiquidadosEsta_CP = (datos.costosExtra||[]).filter(function(c){
    return c && c.liquidadoAlMomento && (c.folioLetra||'A').toUpperCase() === _letraActual;
  });
  const _pagoCELiquidadoEsta_CP = _ceLiquidadosEsta_CP.reduce(function(s,c){ return s+(parseFloat(c.montoLiquidado)||0); }, 0);
  const _pagoEstaVersion_CP = _misPPEsta_CP.reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0) + _pagoCELiquidadoEsta_CP;
  const _totalPPAntes_CP    = _ppAntes_CP.reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0);
  const _anticipoBase_CP = parseFloat(datos.anticipo)||0;
  // FIX: varios call sites de generarPDF() (reimpresión, regeneración masiva,
  // visor de PDF, etc.) pasan el recibo guardado directo (spread de `r`) sin
  // fijar explícitamente `datos.totalGeneral` — el campo que SÍ se guarda en
  // cada recibo es `total` (ver nuevoRegistro.total = totalGeneral en
  // _imprimirActualizacionReal). Sin este fallback, _totalGeneralCP caía a 0
  // en esos casos y el "SALDO RESTANTE"/"ADEUDO ANTERIOR" del recibo salía en
  // $0.00 en vez del monto real (caso real: folio 1B mostraba $0.00 en vez
  // de $7,000.00 al reimprimir/regenerar).
  const _totalGeneralCP  = (datos.totalGeneral !== undefined) ? parseFloat(datos.totalGeneral) : (parseFloat(datos.total)||0);
  const _saldoAnteriorResumen_CP = Math.max(0, _totalGeneralCP - _anticipoBase_CP - _totalPPAntes_CP);
  const _saldoRestante_CP = Math.max(0, _saldoAnteriorResumen_CP - _pagoEstaVersion_CP);
  // Este recibo es, en concreto, un "recibo de Servicio Complementario" bajo
  // Costo Pactado (folio 6 y similares): la variante que ahora necesita el
  // mismo nivel de detalle visual que ya usa Sin Costo Total Pactado.
  const _esRecCEDetalladoCP = _tieneCE && !_esAbiertoPDF && _esUpdate;
  // Iniciales de un nombre completo (mismo criterio que se usa en el resto del PDF).
  function _inicialesDeSC(nombre){
    return (nombre||'').trim().split(/\s+/).map(function(w){ return (w[0]||'').toUpperCase(); }).join('').slice(0,4) || '—';
  }
  // Adeudo anterior real. IMPORTANTE: cada versión guardada del folio (A, B, C…)
  // acumula en su costosExtra/pagosParciales TODO el historial hasta ese punto (los
  // de versiones previas + los nuevos de esa sesión) — por eso basta con leer la
  // ÚLTIMA versión ANTERIOR a esta (nunca sumar entre varias versiones, que
  // duplicaría cada cargo tantas veces como versiones existan). "Cargos internos"
  // de la ficha NO se incluyen aquí porque se guardan por folio completo (no por
  // versión) y no se pueden atribuir de forma confiable a una letra específica.
  let _adeudoItemsSC = [];
  let _saldoAnteriorSC = 0;
  let _totalPagosParcialesPreSC = 0;
  let _totalCostosExtraPreSC = 0;
  if(_esAbiertoPDF){
    _totalPagosParcialesPreSC = (datos.pagosParciales||[]).reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0);
    _totalCostosExtraPreSC = (datos.costosExtra||[]).reduce(function(s,c){ return s+(parseFloat(c.precio)||0); }, 0);
    if(_esUpdate){
      const _folioSC = Number(datos.folio);
      const _letraActualSC = (datos.letra||'A').toUpperCase();
      const _todasVersSC = (typeof appData!=='undefined' && appData.recibos ? appData.recibos : [])
        .filter(function(x){ return x && Number(x.folio)===_folioSC && !x.esComplemento; });
      const _anterioresSC = _todasVersSC
        .filter(function(x){ return (x.letra||'A').toUpperCase() < _letraActualSC; })
        .sort(function(a,b){ return String(b.letra||'A').charCodeAt(0)-String(a.letra||'A').charCodeAt(0); });
      const _prevRecSC = _anterioresSC[0] || null;
      if(_prevRecSC){
        (_prevRecSC.costosExtra||[]).forEach(function(ce){
          if(!ce) return;
          const m = parseFloat(ce.precio)||0;
          // Atribuir el cargo a quien realmente lo generó (la versión donde se
          // originó, vía folioLetra), no siempre al responsable de la versión
          // anterior que lo trae acumulado.
          const _letraOrigenSC = (ce.folioLetra || _prevRecSC.letra || 'A').toUpperCase();
          const _origenSC = _todasVersSC.find(function(v){ return (v.letra||'A').toUpperCase()===_letraOrigenSC; }) || _prevRecSC;
          _adeudoItemsSC.push({ concepto: ce.concepto||'Servicio', fecha: ce.fechaHora||'', iniciales: _inicialesDeSC(_origenSC.responsable||''), monto: m });
        });
        // Aplicar los abonos acumulados (de esa misma versión anterior, que ya
        // incluye todos los abonos hasta ese punto) en orden cronológico (FIFO)
        // contra cada cargo, para que cada línea de "ADEUDO ANTERIOR" muestre lo
        // que REALMENTE sigue pendiente — los cargos ya cubiertos por completo
        // desaparecen del listado (no se arrastra historial ya liquidado).
        let _restanteFIFOsc = (_prevRecSC.pagosParciales||[]).reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0);
        _adeudoItemsSC = _adeudoItemsSC.map(function(it){
          const aplicado = Math.min(it.monto, _restanteFIFOsc);
          _restanteFIFOsc -= aplicado;
          return Object.assign({}, it, { monto: Math.max(0, it.monto - aplicado) });
        }).filter(function(it){ return it.monto > 0.005; });
        _saldoAnteriorSC = _adeudoItemsSC.reduce(function(s,it){ return s+it.monto; }, 0);
      }
    }
  }
  // Hay un cargo real detrás de esta transacción (adeudo previo sin liquidar, o un
  // Servicio Complementario nuevo en este mismo recibo). Si NO lo hay, es un abono
  // suelto sin relación a ningún cargo — se mantiene el comportamiento independiente
  // ya construido (Total=Abonó=lo entregado, Resta $0.00, título "RECIBO DE PAGO PARCIAL").
  const _totalConAdeudoSC = _saldoAnteriorSC + _totalCostosExtraPreSC;
  const _restaTransSC = Math.max(0, _totalConAdeudoSC - _totalPagosParcialesPreSC);
  const _hayCargoRealSC = _totalConAdeudoSC > 0;
  // ── Título unificado: solo 4 nombres posibles en todo el sistema, sin
  // importar el modo de costo (Pactado o Abierto), más el caso aparte de
  // cancelación. Antes "RECIBO OFICIAL"/"RECIBO DE LIQUIDACIÓN"/"RECIBO DE
  // ABONO PARCIAL"/"RECIBO DE SERVICIOS" eran nombres duplicados del mismo
  // caso ya cubierto por su equivalente en Sin Costo Pactado — se unificaron
  // a petición expresa para que el título dependa solo de QUÉ pasó en el
  // recibo, no de en qué modo de costo está el folio.
  // FIX (caso real: folio 56C): antes, "RECIBO DE SERVICIO COMPLEMENTARIO"
  // en modo Sin Costo Pactado SOLO aplicaba si el folio no traía ningún
  // adeudo anterior arrastrado — si ya había deuda previa, un recibo que
  // agregaba un cargo nuevo cambiaba a "PAGO PARCIAL"/"PAGO TOTAL" y nunca
  // más volvía a decir servicio complementario. A petición expresa, ahora
  // se unifica con el modo Costo Pactado: CUALQUIER recibo que agregue un
  // cargo nuevo en esta versión (_totalCostosExtraPreSC > 0) se titula
  // SERVICIO COMPLEMENTARIO, sin importar si ya había adeudo anterior.
  const _tituloSinCostoSC = (_totalCostosExtraPreSC > 0)
    ? 'RECIBO DE SERVICIO COMPLEMENTARIO'
    : (!_hayCargoRealSC
        ? 'RECIBO DE PAGO PARCIAL'
        : (_restaTransSC > 0 ? 'RECIBO DE PAGO PARCIAL' : 'RECIBO DE PAGO TOTAL'));
  const _tituloRecibo = _esCancelacion ? 'RECIBO DE CANCELACIÓN'
                      : _esAbiertoPDF  ? (_esUpdate ? _tituloSinCostoSC : 'RECIBO DE PAGO INICIAL')
                      : _esFinalLiq    ? 'RECIBO DE PAGO TOTAL'
                      : _tieneCE       ? 'RECIBO DE SERVICIO COMPLEMENTARIO'
                      : _esParcial     ? 'RECIBO DE PAGO PARCIAL'
                      :                  'RECIBO DE PAGO INICIAL';
  doc.setTextColor(154,110,24); doc.setFontSize(10); doc.setFont('times','bold');
  doc.text(_tituloRecibo, margin, yAfterH);
  // Referencia al folio original (solo en versiones B+; se omite en Sin Costo Total
  // Pactado porque cada recibo es un comprobante independiente sin historial).
  // NOTA: se quitó por instrucción expresa la leyenda "Referencia Folio Original:
  // #4A" que antes aparecía aquí en las versiones B, C, D… — ya no se imprime nada
  // en su lugar.
  // Para actualizaciones (B, C, D…): la fecha principal es la de ESTA versión
  // (última entrada de fechasImpresion). Para la versión original (A): la fecha
  // principal es datos.fecha_recibo.
  const _fpPrincipal = _esUpdate ? _fps[_fps.length - 1] : null;
  const _fechaRecISO = _esUpdate ? (_fpPrincipal.fecha || '') : (datos.fecha_recibo || '');
  const _horaRecHM   = _esUpdate ? (_fpPrincipal.hora || datos.hora_recibo || '') : (datos.hora_recibo || '');
  doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(80,65,40);
  doc.text('Santiago Juxtlahuaca, Oaxaca '+_fmtFHEncabezado(_fechaRecISO,_horaRecHM),pageW-margin,yAfterH,{align:'right'});
  // Versiones anteriores: YA NO se listan aquí como historial de fechas — esa
  // información redundaba con la etiqueta de versión y fecha que ya trae cada
  // línea de concepto/cargo/abono (ej. "[6B 20-ene-2026 1:31 pm]"). Se quitó
  // por instrucción expresa para no repetir la misma fecha dos veces.
  let yLineaFechas = yAfterH;
  doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.line(margin,yLineaFechas+1.5,pageW-margin,yLineaFechas+1.5);
  let y=yLineaFechas+4.5;
  const campo=(label,val,x,cy,w)=>{
    doc.setFontSize(5.5); doc.setTextColor(130,100,50); doc.setFont('helvetica','normal'); doc.text(label,x,cy);
    doc.setFontSize(8); doc.setTextColor(20,10,5); doc.text(val||'—',x,cy+4);
    doc.setDrawColor(210,185,120); doc.line(x,cy+5,x+w,cy+5);
  };
  // Clientes
  doc.setFillColor(248,244,232); doc.rect(margin,y-3,cW,5,'F');
  doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
  doc.text('DATOS DEL CLIENTE',margin+1,y); y+=2.5;
  datos.clientes.forEach((c,i)=>{
    if(i>0){ doc.setDrawColor(230,210,170); doc.setLineWidth(0.2); doc.line(margin,y-1,margin+cW,y-1); }
    campo('NOMBRE',c.nombre,margin,y,cW*0.55);
    campo('MÓVIL',c.movil,margin+cW*0.6,y,cW*0.18);
    campo('TEL. CASA',c.tel,margin+cW*0.82,y,cW*0.18); y+=8;
    if(c.domicilio){ campo('DOMICILIO',c.domicilio,margin,y,cW); y+=8; }
  });
  // Renderiza un párrafo (o varios separados por "\n\n") con sangría en la
  // primera línea de cada párrafo y justificado (excepto la última línea de
  // cada párrafo, como es estándar tipográfico). Calcula el ancho de wrap
  // de cada línea tomando en cuenta el punto de inicio real en x, para que
  // el texto NUNCA se salga del margen de impresión.
  function _pdfParrafoJustificado(texto, x, yStart, maxWidth, opts){
    opts = opts || {};
    var sangria = opts.sangria != null ? opts.sangria : 6;
    var lineHeight = opts.lineHeight || 3.2;
    var espacioParrafo = opts.espacioParrafo != null ? opts.espacioParrafo : lineHeight * 0.5;
    var y = yStart;
    String(texto).split('\n\n').forEach(function(parrafo, pi){
      if(pi > 0) y += espacioParrafo;
      var palabras = parrafo.replace(/\n/g,' ').split(' ').filter(function(w){ return w.length; });
      var lineas = [];
      var actual = '';
      var anchoDisp = maxWidth - sangria;
      palabras.forEach(function(palabra){
        var prueba = actual ? actual + ' ' + palabra : palabra;
        if(doc.getTextWidth(prueba) > anchoDisp && actual){
          lineas.push(actual);
          actual = palabra;
          anchoDisp = maxWidth;
        } else {
          actual = prueba;
        }
      });
      if(actual) lineas.push(actual);
      lineas.forEach(function(linea, li){
        var esPrimera = (li === 0);
        var esUltima = (li === lineas.length - 1);
        var xLinea = esPrimera ? x + sangria : x;
        var anchoLinea = esPrimera ? maxWidth - sangria : maxWidth;
        if(!esUltima && lineas.length > 1){
          // Justificación MANUAL: jsPDF re-parte cada string que recibe usando su
          // propio splitTextToSize(text, maxWidth) — como aquí ya le pasamos una
          // sola línea que cabe entera en anchoLinea, jsPDF la trata como un
          // arreglo de 1 elemento y por diseño NUNCA estira la "última" línea de
          // ese arreglo (aunque para nosotros no sea la última del párrafo). El
          // resultado es que align:'justify' no hacía nada. Por eso distribuimos
          // el espacio sobrante entre palabras nosotros mismos.
          var palabrasLinea = linea.split(' ').filter(function(w){ return w.length; });
          if(palabrasLinea.length > 1){
            var anchoTexto = 0;
            palabrasLinea.forEach(function(w){ anchoTexto += doc.getTextWidth(w); });
            var gap = (anchoLinea - anchoTexto) / (palabrasLinea.length - 1);
            var xCursor = xLinea;
            palabrasLinea.forEach(function(w, wi){
              doc.text(w, xCursor, y);
              xCursor += doc.getTextWidth(w) + (wi < palabrasLinea.length - 1 ? gap : 0);
            });
          } else {
            doc.text(linea, xLinea, y);
          }
        } else {
          doc.text(linea, xLinea, y);
        }
        y += lineHeight;
      });
    });
    return y; // y tras el/los párrafo(s), lista para continuar el layout
  }
  // Poder — texto según tipo de trámite y letra. A petición expresa: ya NO se
  // oculta en ningún caso — escritura/juicio en B/C/D (que antes no mostraban
  // nada) ahora caen al texto corto de siempre, igual que cualquier otro
  // trámite normal y que vehicular en B/C/D.
  const _tipoTramitePDF = datos.tipoTramite || datos.tramites || '';
  const _letraPDF = (datos.letra || 'A').toUpperCase();
  // Se conserva (usada más abajo para ocultar "DOCUMENTOS QUE DEJA EL
  // INTERESADO" en Escritura/Juicio — sección aparte, sin relación con el
  // texto del poder).
  const _esEscrituraOJuicio = (_tipoTramitePDF === 'escritura' || _tipoTramitePDF === 'juicio');
  {
    let _textoPoder = '';
    if (_tipoTramitePDF === 'escritura' && _letraPDF === 'A') {
      _textoPoder = 'Otorgo al Despacho Jurídico LEX-MÉXICO y a sus integrantes debidamente autorizados facultades amplias y suficientes para realizar, en mi nombre y representación, las gestiones, trámites y diligencias necesarias para la debida tramitación de mi escritura pública.\n\nManifiesto haber sido debidamente informado, que el importe señalado en el presente recibo no incluye el pago del Impuesto Sobre la Renta (ISR) ni del Impuesto de Traslación de Dominio, cuyos montos serán determinados posteriormente por la base catastral asignada.\n\nBajo protesta de decir verdad, declaro que la documentación proporcionada es auténtica, completa y veraz. En caso de detectarse inconsistencias, omisiones o requerirse documentación complementaria durante el trámite, me comprometo a subsanarlas a la brevedad. Asimismo, manifiesto contar con la solvencia económica para cubrir cualquier gasto, derecho, contribución o erogación adicional que resulte necesaria para la conclusión del trámite, deslindando al Despacho Jurídico LEX-MÉXICO de cualquier responsabilidad derivada de dichas circunstancias.';
    } else if (_tipoTramitePDF === 'juicio' && _letraPDF === 'A') {
      _textoPoder = 'Otorgo al Despacho Jurídico LEX-MÉXICO y a sus integrantes debidamente autorizados poder amplio y suficiente para representarme en el juicio o procedimiento legal correspondiente, incluyendo la realización de gestiones, promociones, recursos y diligencias necesarias para la atención, seguimiento y defensa del presente asunto.\n\nLos importes señalados en el presente recibo corresponden exclusivamente a los servicios profesionales contratados y no incluyen gastos, derechos, impuestos, certificaciones, peritajes, viáticos, honorarios de terceros ni cualquier otra erogación que pudiera generarse durante la sustanciación del procedimiento.\n\nBajo protesta de decir verdad, declaro que la información y documentación proporcionadas son auténticas, completas y veraces, comprometiéndome a entregar cualquier documento adicional que se requiera y a comparecer cuando resulte necesario. En caso de detectarse omisiones o inconsistencias en la documentación, me comprometo a subsanarlas a la brevedad, deslindando al Despacho Jurídico LEX-MÉXICO de cualquier responsabilidad atribuible a tales circunstancias.';
    } else if (_tipoTramitePDF === 'vehicular' && _letraPDF === 'A') {
      // A petición expresa: solo en el folio A de trámites vehiculares (las
      // versiones posteriores B/C/D conservan el texto corto de siempre).
      _textoPoder = 'Manifiesto bajo protesta de decir verdad que el vehículo es de procedencia lícita, no cuenta con reporte de robo o impedimento legal, y que la documentación proporcionada es auténtica, legítima y corresponde al mismo. Otorgo al responsable del trámite del Despacho Jurídico LEX-MÉXICO, poder amplio, cumplido y bastante para que, en mi nombre y representación, realice y gestione las diligencias y trámites necesarios para la debida tramitación de los servicios solicitados. Asumo toda responsabilidad por falsedad, alteración, apocrificidad, irregularidad o ilegal procedencia del vehículo o documentación proporcionada, liberando al Despacho de cualquier responsabilidad derivada de ello.';
    } else {
      _textoPoder = 'Otorgo al responsable del trámite del Despacho Jurídico LEX-MÉXICO, poder amplio, cumplido y bastante para que, en mi nombre y representación, realice y gestione las diligencias y trámites necesarios para la debida tramitación de los servicios solicitados.';
    }
    doc.setFontSize(7); doc.setTextColor(_esCancelacion?150:60,_esCancelacion?150:45,_esCancelacion?145:20); doc.setFont('helvetica','bolditalic');
    y = _pdfParrafoJustificado(_textoPoder, margin, y, cW, { sangria: 6, lineHeight: 3.2 }) + 2;
  }
  // Vehiculo — solo si es trámite vehicular
  // En recibo de cancelación, esta sección ya no aplica (el trámite quedó sin
  // efecto) — se muestra en gris con cada dato tachado, como el resto de la
  // información del trámite original, dejando claro que solo el cuadro de
  // totales de arriba refleja el estado real.
  const campoV = _esCancelacion ? (label,val,x,cy,w)=>{
    doc.setFontSize(5.5); doc.setTextColor(165,165,160); doc.setFont('helvetica','normal'); doc.text(label,x,cy);
    doc.setFontSize(8); doc.setTextColor(150,150,145); doc.text(val||'—',x,cy+4);
    const _tw = Math.min(w, doc.getStringUnitWidth(val||'—')*8/doc.internal.scaleFactor+1);
    doc.setDrawColor(150,150,145); doc.setLineWidth(0.3); doc.line(x,cy+2.4,x+_tw,cy+2.4);
    doc.setDrawColor(210,210,205); doc.line(x,cy+5,x+w,cy+5);
  } : campo;
  if(datos.tipoTramite === 'vehicular') {
  doc.setFillColor(_esCancelacion?235:248,_esCancelacion?235:244,_esCancelacion?230:232); doc.rect(margin,y-3,cW,5,'F');
  doc.setTextColor(_esCancelacion?130:154,_esCancelacion?130:110,_esCancelacion?125:24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
  doc.text('DATOS GENERALES DEL VEHICULO',margin+1,y); y+=2.5;
  // Fila 1: Clase · Marca · Tipo · Serie/VIN · No. Motor
  const c2=cW/2, c4=cW/4, c5=cW/5;
  campoV('CLASE',datos.clase,margin,y,c5-3);
  campoV('MARCA',datos.marca,margin+c5,y,c5-3);
  campoV('TIPO',datos.tipo_veh,margin+c5*2,y,c5-3);
  campoV('SERIE / VIN',datos.serie,margin+c5*3,y,c5-3);
  campoV('NO. MOTOR',datos.motor,margin+c5*4,y,c5-3); y+=8;
  // Fila 2: Año · Puertas · Color · Transmisión
  campoV('AÑO',datos.anio,margin,y,c4-3);
  campoV('PUERTAS',datos.puertas,margin+c4*0.7,y,c4*0.6-3);
  campoV('COLOR',datos.color_veh,margin+c4*1.3,y,c4-3);
  campoV('TRANSMISIÓN',datos.transmision,margin+c4*2.3,y,c4-3);
  campoV('CILINDROS',datos.cilindros,margin+c4*3.3,y,c4*0.7-3); y+=8;
  // Fila 3: Placas · Últ. Tenencia · Origen · Combustible
  // Estado de placas solo en recibo original (serie A) de tramite vehicular
  var _esSerieA = (datos.letra || 'A').toUpperCase() === 'A' && !_esUpdate;
  var _esVehicular = datos.tipoTramite === 'vehicular' || datos.tipoVeh || datos.clase_veh;
  // ── PLACAS ACTUALES: renderizado dedicado ───────────────────────────────
  // El estado va en MAYÚSCULAS y separado de la placa con un espacio
  // considerable para que no se confundan visualmente. Donde no haya
  // información (placa o estado) se deja un simple "—", igual que el resto
  // de los campos vacíos del PDF — sin frases como "SIN ESPECIFICAR".
  (function(){
    var _wCampo = c4-3, _xCampo = margin;
    var _colLabel = _esCancelacion ? [165,165,160] : [130,100,50];
    var _colVal   = _esCancelacion ? [150,150,145] : [20,10,5];
    var _colLinea = _esCancelacion ? [210,210,205] : [210,185,120];
    doc.setFontSize(5.5); doc.setTextColor(_colLabel[0],_colLabel[1],_colLabel[2]); doc.setFont('helvetica','normal');
    doc.text('PLACAS ACTUALES', _xCampo, y);
    var _placaTxt = (datos.placa||'').trim();
    var _estadoTxt = '';
    if(_esSerieA && _esVehicular){
      var _estPlaca = (datos.placaEstado||'').trim();
      _estadoTxt = (_estPlaca && _estPlaca !== 'SIN_ESP') ? _nombreCompletoEstadoPlaca(_estPlaca).toUpperCase() : '—';
    }
    doc.setTextColor(_colVal[0],_colVal[1],_colVal[2]);
    if(!_placaTxt){
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.text('—', _xCampo, y+4);
    } else {
      doc.setFontSize(8); doc.setFont('helvetica','normal');
      doc.text(_placaTxt, _xCampo, y+4);
      if(_estadoTxt){
        var _anchoPlaca = doc.getStringUnitWidth(_placaTxt)*8/doc.internal.scaleFactor;
        doc.setFontSize(_estadoTxt === '—' ? 8 : 7.2);
        doc.text(_estadoTxt, _xCampo + _anchoPlaca + 6, y+4);
      }
    }
    doc.setDrawColor(_colLinea[0],_colLinea[1],_colLinea[2]); doc.line(_xCampo, y+5, _xCampo+_wCampo, y+5);
  })();
  campoV('¿ADEUDA TENENCIAS?',datos.ultima_tenencia,margin+c4,y,c4-3);
  campoV('ORIGEN',datos.origen,margin+c4*2,y,c4-3);
  campoV('COMBUSTIBLE',datos.combustible,margin+c4*3,y,c4-3); y+=8.5;
  } // end vehicular section
  // Documentos — solo en trámites que no sean Escritura ni Juicio
  if (!_esEscrituraOJuicio) {
  doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(_esCancelacion?130:100,_esCancelacion?130:80,_esCancelacion?125:40);
  doc.text('DOCUMENTOS QUE DEJA EL INTERESADO:',margin,y); y+=3.5;
  let docsData = null;
  try {
    if(datos.copias){
      const _cop = typeof datos.copias==='string' ? JSON.parse(datos.copias) : datos.copias;
      if(_cop && _cop.docs && Array.isArray(_cop.docs)){
        docsData = _cop;
      } else if(Array.isArray(_cop) && _cop.length){
        docsData = { docs: _cop, tipodoc: '' };
      }
    }
  } catch(e){ /* copias en formato anterior */ }
  // Nunca debe quedar sin especificar si son copias, escaneos u originales —
  // por seguridad/responsabilidad legal. Primero se intenta recuperar lo que
  // REALMENTE se eligió en el formulario vía datos.tipo_doc (campo aparte, que
  // sí se guarda siempre como string plano y no se pierde al re-guardar). Solo
  // si tampoco existe eso, se asume COPIA SIMPLE — nunca originales.
  if (docsData && !docsData.tipodoc) {
    docsData.tipodoc = (datos.tipo_doc === 'escaneo') ? 'DOCUMENTOS QUE SE ESCANEARON' : 'DOCUMENTOS EN COPIA SIMPLE';
  }
  if (docsData && docsData.docs && docsData.docs.length) {
    doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(_esCancelacion?130:42,_esCancelacion?130:100,_esCancelacion?125:42);
    doc.text('• Tipo: ' + docsData.tipodoc, margin, y); y += 4;
    doc.setFont('helvetica','normal'); doc.setTextColor(_esCancelacion?145:15,_esCancelacion?145:10,_esCancelacion?140:5); doc.setFontSize(7.5);
    const colW = cW / 2 - 4;
    const docList = docsData.docs;
    const perCol = Math.ceil(docList.length / 2);
    const col1Items = docList.slice(0, perCol);
    const col2Items = docList.slice(perCol);
    const maxRows = Math.max(col1Items.length, col2Items.length);
    const lineH = 4.2;
    for (let i = 0; i < maxRows; i++) {
      if (col1Items[i]) {
        doc.setTextColor(_esCancelacion?150:30,_esCancelacion?150:110,_esCancelacion?145:30); doc.text('\u2714', margin, y);
        doc.setTextColor(_esCancelacion?145:15,_esCancelacion?145:10,_esCancelacion?140:5);
        const label1 = doc.splitTextToSize(col1Items[i], colW - 6);
        doc.text(label1[0], margin + 5, y);
        if(_esCancelacion){
          const _tw1 = doc.getStringUnitWidth(label1[0])*7.5/doc.internal.scaleFactor;
          doc.setDrawColor(150,150,145); doc.setLineWidth(0.3); doc.line(margin+5, y-1.4, margin+5+_tw1, y-1.4);
        }
      }
      if (col2Items[i]) {
        const col2X = margin + cW / 2 + 2;
        doc.setTextColor(_esCancelacion?150:30,_esCancelacion?150:110,_esCancelacion?145:30); doc.text('\u2714', col2X, y);
        doc.setTextColor(_esCancelacion?145:15,_esCancelacion?145:10,_esCancelacion?140:5);
        const label2 = doc.splitTextToSize(col2Items[i], colW - 6);
        doc.text(label2[0], col2X + 5, y);
        if(_esCancelacion){
          const _tw2 = doc.getStringUnitWidth(label2[0])*7.5/doc.internal.scaleFactor;
          doc.setDrawColor(150,150,145); doc.setLineWidth(0.3); doc.line(col2X+5, y-1.4, col2X+5+_tw2, y-1.4);
        }
      }
      y += lineH;
    }
    y += 1;
  } else if (datos.copias && !docsData) {
    doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5); doc.setFontSize(8);
    const cL=doc.splitTextToSize(datos.copias,cW); doc.text(cL,margin,y); y+=cL.length*4+1;
  } else {
    doc.setFont('helvetica','normal'); doc.setTextColor(120,100,60); doc.setFontSize(8);
    doc.text('— Ninguno —', margin, y); y+=5;
  }
  } // fin bloque documentos
  // Conceptos — altura dinámica según contenido del texto.
  // En Sin Costo Total Pactado, las versiones B+ NO repiten la tabla de conceptos
  // original (ese "COSTO DEL TRÁMITE" pertenece al recibo inicial ya liquidado, no
  // a esta transacción) — el pago de ESTA transacción ya se detalla más abajo en
  // "PAGOS PARCIALES". Mantiene el recibo como comprobante independiente.
  let total=0;
  const colConceptoW = cW*0.35;
  const colDescripW  = cW*0.42;
  // ── Actualización simple de Costo Pactado (B, C, D… sin Servicio
  // Complementario ni cancelación): la tabla de conceptos original ya no
  // repite el "COSTO DEL TRÁMITE" completo — a petición expresa, el
  // encabezado pasa a "SALDO RESTANTE" y se colapsa a UN solo renglón con
  // lo que quedaba pendiente al entrar a este recibo (_saldoAnteriorResumen_CP).
  // El texto de CONCEPTO/DESCRIPCIÓN depende de qué pasa en este recibo:
  //   - Si liquida por completo (_esFinalLiq): "LIQUIDACIÓN TOTAL" / "DEL TRÁMITE".
  //   - Si es abono parcial y el trámite original tenía varios conceptos:
  //     "ADEUDO ANTERIOR" / "DEL TRÁMITE" (no caben varias líneas originales
  //     en un solo renglón consolidado).
  //   - Si es abono parcial con un solo concepto original: se conserva tal
  //     cual el concepto/descripción de la versión A (comportamiento previo).
  const _esActualizacionSimpleCP = _esUpdate && !_esRecCEDetalladoCP && !_esCancelacion;
  // ── Servicio Complementario sobre Costo Pactado con adeudo previo real ──
  // A petición expresa: en vez de repetir el concepto original con el COSTO
  // TOTAL pactado (dato obsoleto en cuanto ya hubo abonos), se muestra
  // "ADEUDO ANTERIOR" con lo que de verdad se arrastraba ANTES de este
  // recibo — SIN contar el costo del Servicio Complementario nuevo (ese ya
  // se desglosa aparte, más abajo, en su propia sección "SERVICIO
  // COMPLEMENTARIO"). Mismo criterio/estilo que _esActualizacionSimpleCP,
  // pero solo para el caso _esRecCEDetalladoCP.
  const _totalCEAntesCP = (datos.costosExtra||[]).reduce(function(s,c){ return s+(parseFloat(c.precio)||0); }, 0);
  const _adeudoAnteriorPrevioCP = _esRecCEDetalladoCP ? Math.max(0, _saldoAnteriorResumen_CP - _totalCEAntesCP) : 0;
  const _mostrarFilaAdeudoCE_CP = _esRecCEDetalladoCP && _adeudoAnteriorPrevioCP > 0.005;
  // A petición expresa (folios B, C, D… — NUNCA el folio A): toda fila que
  // muestre el saldo que se arrastra de la versión anterior (abono simple o
  // Servicio Complementario con adeudo previo) se unifica en un solo formato:
  // título "SALDO PENDIENTE:", dos columnas (CONCEPTO / SALDO PENDIENTE), SIN
  // DESCRIPCIÓN. El CONCEPTO ya no depende de qué pasó en este recibo (antes
  // era "ADEUDO ANTERIOR"/"LIQUIDACIÓN TOTAL"/concepto original según el caso)
  // — ahora es SIEMPRE el/los concepto(s) originales del folio A, permanentes,
  // unificados en un solo renglón si el trámite original tenía varios.
  const _esFilaSaldoPendienteCP = _esActualizacionSimpleCP || _mostrarFilaAdeudoCE_CP;
  function _conceptoFolioAUnificado(){
    const _cs = (datos.conceptos||[]).filter(c=>c && (c.concepto||c.precio));
    const _nombres = _cs.map(c=>c.concepto).filter(Boolean);
    return _nombres.length ? _nombres.join('; ') : 'ADEUDO ANTERIOR';
  }
  // conMonto=true conserva el formato viejo completo (título "SALDO
  // PENDIENTE:", columna de dinero) — solo se sigue usando en Servicio
  // Complementario con adeudo previo, donde conviven dos cargos distintos y
  // hace falta ver cuál es cuál. En todo lo demás (abono simple de Costo
  // Pactado y "Sin Costo Total Pactado"), a petición expresa ya NO se repite
  // el monto aquí — ese número ya se ve abajo en el cuadro de totales — así
  // que solo queda el encabezado "CONCEPTO" y el nombre del trámite.
  function _dibujarEncabezadoSaldoPendiente(continuacion, conMonto){
    doc.setFillColor(248,244,232); doc.rect(margin,y-3,cW,5,'F');
    doc.setTextColor(154,110,24); doc.setFontSize(7); doc.setFont('helvetica','bold');
    if(conMonto){
      doc.text('SALDO PENDIENTE'+(continuacion?' (continuación):':':'),margin+1,y); y+=4;
      doc.setFontSize(6.5);
      doc.text('CONCEPTO',margin+1,y); doc.text('SALDO PENDIENTE',margin+cW,y,{align:'right'}); y+=2.5;
    } else {
      doc.setFontSize(6.5);
      doc.text('CONCEPTO'+(continuacion?' (continuación)':''),margin+1,y); y+=2.5;
    }
  }
  function _dibujarFilaSaldoPendiente(conceptoTxt, monto, conMonto){
    doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
    const anchoSP = conMonto ? cW*0.72 : cW*0.98;
    const cLinesSP = doc.splitTextToSize(conceptoTxt, anchoSP);
    const rowHSP = cLinesSP.length * 4 + 1.5;
    asegurarEspacioConceptos(rowHSP);
    // A petición expresa: CONCEPTO también justificado (sin sangría) cuando
    // ocupa varias líneas — jsPDF nunca justifica la última línea de un
    // párrafo, así que un concepto de una sola línea se queda como estaba.
    doc.text(conceptoTxt, margin, y, {maxWidth: anchoSP, align: 'justify'});
    if(conMonto) doc.text('$'+fmtMXN(monto), margin+cW, y, {align:'right'});
    doc.setDrawColor(220,195,140); doc.setLineWidth(0.3);
    // FIX (líneas "tachando" texto — caso real: folio 63A): con solo -1.2mm de
    // holgura antes del renglón siguiente, la línea caía DENTRO de la altura de
    // capital (ascent≈2.15mm a 8pt Helvetica) de la primera línea del siguiente
    // renglón. -2.8mm despeja ese ascent con margen y sigue sobrando espacio
    // respecto al propio texto de ESTE renglón (verificado con jsPDF+pdftoppm).
    doc.line(margin, y+rowHSP-2.8, margin+cW, y+rowHSP-2.8);
    y += rowHSP;
  }
  // Solo el caso de Servicio Complementario con adeudo previo conserva el
  // monto en este bloque (ver comentario arriba de _dibujarEncabezadoSaldoPendiente).
  const _conMontoSaldoPendiente = _esRecCEDetalladoCP && _mostrarFilaAdeudoCE_CP;
  // Salto de página automático para conceptos
  const yMaxConceptos = 262;
  function asegurarEspacioConceptos(altoFila){
    if(y + altoFila > yMaxConceptos){
      doc.addPage();
      y = 18;
      if(_esFilaSaldoPendienteCP || (_esAbiertoPDF && _esUpdate)){
        _dibujarEncabezadoSaldoPendiente(true, _conMontoSaldoPendiente);
      } else {
        doc.setFillColor(248,244,232); doc.rect(margin,y-3,cW,5,'F');
        doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
        doc.text('CONCEPTO (continuación)',margin+1,y);
        doc.text('DESCRIPCIÓN',margin+cW*0.38,y);
        doc.text('COSTO DEL TRÁMITE',margin+cW,y,{align:'right'}); y+=2.5;
      }
    }
  }
  if(!(_esAbiertoPDF && _esUpdate)){
    if(_esFilaSaldoPendienteCP){
      _dibujarEncabezadoSaldoPendiente(false, _conMontoSaldoPendiente);
      const _montoSP_CP = _esActualizacionSimpleCP ? _saldoAnteriorResumen_CP : _adeudoAnteriorPrevioCP;
      total += _montoSP_CP;
      _dibujarFilaSaldoPendiente(_conceptoFolioAUnificado(), _montoSP_CP, _conMontoSaldoPendiente);
    } else if(_esRecCEDetalladoCP){
      // Servicio Complementario sobre Costo Pactado SIN adeudo previo (ej.
      // primer Servicio Complementario justo tras liquidar el trámite base):
      // no hay nada que mostrar aquí — el desglose completo vive en la
      // sección "SERVICIO COMPLEMENTARIO" de abajo. No se imprime ningún
      // renglón para no mostrar un "$0.00" sin explicación.
    } else {
    // Encabezado de la tabla de conceptos (franja café con CONCEPTO /
    // DESCRIPCIÓN / COSTO DEL TRÁMITE) — se había quedado SOLO dentro de
    // asegurarEspacioConceptos() (para saltos de página), por lo que la
    // franja nunca aparecía la primera vez, antes de la primera fila. FIX
    // (caso real: folio 76A): se restaura aquí, una sola vez, antes del loop.
    if(datos.conceptos.some(c=>c.concepto||c.precio)){
      doc.setFillColor(_esCancelacion?235:248,_esCancelacion?235:244,_esCancelacion?230:232); doc.rect(margin,y-3,cW,5,'F');
      doc.setTextColor(_esCancelacion?130:154,_esCancelacion?130:110,_esCancelacion?125:24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
      doc.text('CONCEPTO',margin+1,y);
      doc.text('DESCRIPCIÓN',margin+cW*0.38,y);
      doc.text('COSTO DEL TRÁMITE',margin+cW,y,{align:'right'}); y+=2.5;
    }
    let _totalConceptosTabla = 0, _nConceptosTabla = 0;
    datos.conceptos.forEach(c=>{
      if(c.concepto||c.precio){
        const p=parseFloat(c.precio)||0; total+=p; _totalConceptosTabla+=p; _nConceptosTabla++;
        doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(_esCancelacion?150:20,_esCancelacion?150:10,_esCancelacion?145:5);
        const cLines = doc.splitTextToSize(c.concepto||'', colConceptoW);
        const _vTagC = ' ['+folioConLetra(folio, datos.anio_folio, c.folioLetra||'A')+']';
        const dLines = doc.splitTextToSize((c.descripcion||'')+_vTagC, colDescripW);
        const maxLines = Math.max(cLines.length, dLines.length, 1);
        const rowH = maxLines * 4 + 1.5;
        asegurarEspacioConceptos(rowH);
        // A petición expresa: CONCEPTO también justificado (sin sangría) cuando
        // ocupa varias líneas — igual que DESCRIPCIÓN abajo, jsPDF nunca
        // justifica la última línea, así que un concepto corto (1 línea) no cambia.
        doc.text(c.concepto||'', margin, y, {maxWidth: colConceptoW, align: 'justify'});
        // A petición expresa: DESCRIPCIÓN se justifica (ambos márgenes parejos)
        // en vez de ragged-right. Se pasa el texto completo (no el arreglo ya
        // partido dLines) con maxWidth — jsPDF usa el MISMO algoritmo de
        // partición por dentro, así que el número de líneas real coincide
        // exactamente con dLines.length (usado arriba para rowH/maxLines) —
        // verificado con casos de 0, 1 y varias líneas. La última línea de
        // cada párrafo queda alineada a la izquierda automáticamente (jsPDF
        // nunca estira la última línea), como es tipográficamente correcto.
        doc.text((c.descripcion||'')+_vTagC, margin+cW*0.38, y, {maxWidth: colDescripW, align: 'justify'});
        doc.text('$'+fmtMXN(p), margin+cW, y, {align:'right'});
        doc.setDrawColor(_esCancelacion?200:220,_esCancelacion?200:195,_esCancelacion?195:140); doc.setLineWidth(0.3);
        // FIX (líneas "tachando" texto — caso real: folio 63A, filas con 2-3
        // líneas de CONCEPTO pero 1 sola de DESCRIPCIÓN): -1.2mm de holgura no
        // alcanza a despejar el ascent (~2.15mm a 8pt) de la primera línea del
        // renglón siguiente — la línea quedaba dentro de su altura de capital.
        // -2.8mm despeja ese ascent con margen; sigue sobrando espacio respecto
        // al propio texto de este renglón (verificado con jsPDF+pdftoppm).
        doc.line(margin, y+rowH-2.8, margin+cW, y+rowH-2.8);
        // Recibo de cancelación: tachar cada línea del concepto/descripción/costo —
        // el trámite quedó sin efecto, el desglose real vive en el cuadro de totales.
        if(_esCancelacion){
          doc.setDrawColor(150,150,145); doc.setLineWidth(0.3);
          cLines.forEach(function(_ln,_i){
            const _twL = doc.getStringUnitWidth(_ln)*8/doc.internal.scaleFactor;
            doc.line(margin, y+_i*4-1.2, margin+_twL, y+_i*4-1.2);
          });
          const _twP = doc.getStringUnitWidth('$'+fmtMXN(p))*8/doc.internal.scaleFactor;
          doc.line(margin+cW-_twP, y-1.2, margin+cW, y-1.2);
        }
        y += rowH;
      }
    });
    // ── SUMA TOTAL DEL TRÁMITE (2+ conceptos, SOLO folio A) ─────────────────
    // Misma lógica que "SUMA TOTAL DE ADEUDOS" en Servicio Complementario más
    // abajo: cuando el trámite se desglosa en varias líneas (ej. folio 63A con
    // 3 conceptos: $5,000 + $30,000 + $53,000), se agrega un renglón con la
    // suma para que no haya que sumarlas a mano. Con un solo concepto no hace
    // falta (ya es el total). Se omite en cancelación — ahí el total real vive
    // en el cuadro de totales, no en esta tabla tachada. A petición expresa:
    // JAMÁS en recibos B, C, D… (solo el folio A original desglosa el pacto
    // completo en varios conceptos; las versiones posteriores solo agregan
    // servicios complementarios, que ya tienen su propia suma aparte).
    const _esLetraA_SumaTotal = (datos.letra || 'A').toUpperCase() === 'A';
    if(_nConceptosTabla > 1 && !_esCancelacion && _esLetraA_SumaTotal){
      asegurarEspacioConceptos(6);
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(154,110,24);
      doc.text('SUMA TOTAL DEL TRÁMITE', margin, y+2.5);
      doc.text('$'+fmtMXN(_totalConceptosTabla), margin+cW, y+2.5, {align:'right'});
      doc.setDrawColor(180,140,40); doc.setLineWidth(0.4);
      doc.line(margin, y+3.8, margin+cW, y+3.8);
      y += 6;
    }
    }
  } else if(_saldoAnteriorSC > 0){
    // ── SALDO PENDIENTE (Sin Costo Total Pactado) ───────────────────────────
    // A petición expresa: se unifica con el mismo formato que Costo Pactado —
    // un solo renglón "SALDO PENDIENTE:" (CONCEPTO / SALDO PENDIENTE, sin
    // DESCRIPCIÓN) en vez del desglose itemizado por cada Servicio
    // Complementario previo. El CONCEPTO es siempre el del folio A (permanente)
    // y el monto es la suma total de lo que aún no se cubre (_saldoAnteriorSC).
    _dibujarEncabezadoSaldoPendiente(false, false);
    _dibujarFilaSaldoPendiente(_conceptoFolioAUnificado(), _saldoAnteriorSC, false);
  }
  // ── HISTORIAL DE PAGOS (solo en comprobante de abono) ──
  if(datos.folioAnterior && datos.historialPagosRef){
    const recOrig = (typeof appData!=='undefined' ? appData.recibos : []).find(r=>r.folio===datos.folioAnterior);
    y += 1;
    doc.setFillColor(232,245,224); doc.rect(margin,y-3,cW,5,'F');
    doc.setTextColor(42,122,58); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text('HISTORIAL DE PAGOS',margin+1,y); y+=3;
    // Línea de encabezado
    const colW = [cW*0.25, cW*0.15, cW*0.15, cW*0.2, cW*0.25];
    doc.setFontSize(5.5); doc.setFont('helvetica','bold'); doc.setTextColor(80,80,80);
    doc.text('Tipo', margin, y);
    doc.text('Folio', margin+colW[0], y);
    doc.text('Fecha', margin+colW[0]+colW[1], y);
    doc.text('Monto', margin+cW, y, {align:'right'});
    doc.setDrawColor(180,210,180); doc.line(margin,y+1,margin+cW,y+1); y+=3.5;
    // Anticipo original del recibo referenciado
    const anticipoOrig = parseFloat(recOrig?.anticipo||0);
    const fechaOrig = recOrig?.fecha_recibo || recOrig?.fecha || datos.fecha_recibo || '';
    const fechaOrigFmt = fechaOrig ? new Date(fechaOrig+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '—';
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
    doc.text('Anticipo inicial', margin, y);
    doc.text(folioFormato(datos.folioAnterior), margin+colW[0], y);
    doc.text(fechaOrigFmt, margin+colW[0]+colW[1], y);
    doc.text('$'+fmtMXN(anticipoOrig), margin+cW, y, {align:'right'});
    doc.setDrawColor(210,230,210); doc.line(margin,y+1.5,margin+cW,y+1.5); y+=4;
    // Abonos anteriores del historial
    (datos.historialPagosRef||[]).forEach(h=>{
      const fh = h.fecha ? new Date(h.fecha+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : (h.fechaHora||'');
      doc.text('Abono', margin, y);
      doc.text(h.folio ? folioFormato(h.folio, h.anio_folio) : '—', margin+colW[0], y);
      doc.text(fh, margin+colW[0]+colW[1], y);
      doc.text('$'+fmtMXN(parseFloat(h.pago)||0), margin+cW, y, {align:'right'});
      doc.setDrawColor(210,230,210); doc.line(margin,y+1.5,margin+cW,y+1.5); y+=4;
    });
    // Este comprobante (resaltado)
    const montoEste = parseFloat(datos.anticipo)||0;
    const fechaEste = datos.fecha_recibo ? new Date(datos.fecha_recibo+'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '—';
    doc.setFillColor(42,122,58); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
    doc.rect(margin, y-2.5, cW, 6, 'F');
    doc.text('Abono ← este doc.', margin+1, y+1);
    doc.text(folioFormato(folio), margin+colW[0]+1, y+1);
    doc.text(fechaEste, margin+colW[0]+colW[1]+1, y+1);
    doc.text('$'+fmtMXN(montoEste), margin+cW-1, y+1, {align:'right'});
    doc.setTextColor(20,10,5); doc.setFont('helvetica','normal');
    y += 8;
    // Línea separadora
    doc.setDrawColor(42,122,58); doc.setLineWidth(0.5); doc.line(margin,y,margin+cW,y); y+=2;
  }
  // ── SERVICIO COMPLEMENTARIO (si hay) ──
  let totalCostosExtra = 0;
  if(datos.costosExtra && datos.costosExtra.length){
    y += 0.5;
    const yMaxContenidoCE = 262;
    function asegurarEspacioCE(altoFila){
      if(y + altoFila > yMaxContenidoCE){
        doc.addPage();
        y = 18;
        doc.setFillColor(255,240,220); doc.rect(margin,y-3,cW,5,'F');
        doc.setTextColor(160,80,16); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
        doc.text('SERVICIO COMPLEMENTARIO (continuaci\u00f3n)',margin+1,y); y+=2.5;
      }
    }
    doc.setFillColor(255,240,220); doc.rect(margin,y-3,cW,5,'F');
    doc.setTextColor(160,80,16); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text('SERVICIO COMPLEMENTARIO',margin+1,y); y+=2.5;
    datos.costosExtra.forEach(c=>{
      const p=parseFloat(c.precio)||0;
      // Todos los costos extra siempre suman al total
      totalCostosExtra+=p; total+=p;
      doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
      const cLines = doc.splitTextToSize(c.concepto||'', colConceptoW);
      const _vTagCE = '['+folioConLetra(folio, datos.anio_folio, c.folioLetra||datos.letra||'A')+(c.fechaHora?' '+_fmtFHDesdeTexto(c.fechaHora):'')+']';
      const dLines = doc.splitTextToSize((c.descripcion ? c.descripcion+' ' : '')+_vTagCE, colDescripW);
      const maxLines = Math.max(cLines.length, dLines.length, 1);
      const rowH = maxLines * 3.6 + 1.2;
      asegurarEspacioCE(rowH);
      // A petición expresa: CONCEPTO también justificado (sin sangría) cuando
      // ocupa varias líneas — un concepto de una sola línea no cambia.
      doc.text(c.concepto||'', margin, y, {maxWidth: colConceptoW, align: 'justify'});
      doc.setFontSize(7); doc.setTextColor(80,60,30);
      // A petición expresa: DESCRIPCIÓN justificada, igual que en la tabla CONCEPTO.
      doc.text((c.descripcion ? c.descripcion+' ' : '')+_vTagCE, margin+cW*0.38, y, {maxWidth: colDescripW, align: 'justify'});
      doc.setFontSize(8); doc.setTextColor(20,10,5);
      doc.text('$'+fmtMXN(p), margin+cW, y, {align:'right'});
      doc.setDrawColor(220,180,120); doc.setLineWidth(0.2);
      // FIX (líneas "tachando" texto — mismo caso que tabla CONCEPTO): -1mm de
      // holgura no despeja el ascent del CONCEPTO del renglón siguiente.
      doc.line(margin, y+rowH-2.8, margin+cW, y+rowH-2.8);
      y += rowH;
    });
    if(_saldoAnteriorSC > 0 || _esRecCEDetalladoCP){
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(160,80,16);
      doc.text('SUMA TOTAL DE ADEUDOS', margin, y+2.5);
      doc.text('(incluye costo de este recibo)', margin, y+5.3);
      doc.setFontSize(7.5);
      // En Costo Pactado, "totalGeneral" ya incluye el costo base del trámite
      // (tabla CONCEPTO) más todo costosExtra bloqueado — por eso se usa
      // _saldoAnteriorResumen_CP directamente (misma fuente de verdad que el
      // cuadro final), en vez de sumar aparte (evita doble conteo).
      const _sumaTotalAdeudosMostrar = _esRecCEDetalladoCP ? _saldoAnteriorResumen_CP : (_saldoAnteriorSC + totalCostosExtra);
      doc.text('$'+fmtMXN(_sumaTotalAdeudosMostrar), margin+cW, y+2.5, {align:'right'});
      doc.setDrawColor(200,140,60); doc.setLineWidth(0.3); doc.line(margin,y+6.5,margin+cW,y+6.5);
      y += 9.5;
    }
    // ── "PAGOS REALIZADOS" quitado a petición expresa (redundante con el
    // cuadro final TOTAL/ABONADO/RESTA, que ya muestra el abono de esta
    // transacción) — solo queda "SUMA TOTAL DE ADEUDOS" arriba.
  }
  // ── PAGO REGISTRADO EN ESTE RECIBO — ELIMINADA a petición expresa ───────
  // (para todos los recibos, letra A y posteriores B/C/D): en la práctica
  // era confusa para el cliente. Ya no se imprime nada aquí; el cuadro de
  // totales de más abajo sigue mostrando el monto abonado.
  // Se conserva SOLO el cálculo de totalPagosParciales aquí abajo, porque el
  // cuadro de totales de más abajo depende de esta suma.
  let totalPagosParciales = 0;
  (datos.pagosParciales||[]).forEach(function(p){
    totalPagosParciales += parseFloat(p.cantidad)||0;
  });
  // Totales (usa valores recalculados si vienen del modo actualización)
  const anticipo=parseFloat(datos.anticipo)||0;
  const totalGeneral = (datos.totalGeneral !== undefined) ? datos.totalGeneral : total;
  // ── FIX RAÍZ: la versión A (recibo original) NUNCA debe leer
  // saldoNuevo/saldoPendiente/totalAbonado guardados — esos campos reflejan
  // el estado VIVO/ACTUAL del folio completo, que cambia conforme se abonan
  // versiones posteriores (B, C…). La impresión de A debe mostrar SIEMPRE su
  // propio estado histórico: lo único pagado en ese momento fue el anticipo.
  // Sin este fix, cada regeneración masiva volvía a mostrar "PAGADO" en el
  // recibo original aunque solo se hubiera dado un anticipo parcial (folios
  // 1A, 4A y otros) — el parche anterior vivía en un script aparte, no aquí
  // en generarPDF(), así que la siguiente regeneración lo revertía.
  const _esVersionA = (datos.letra||'A').toUpperCase() === 'A';
  let saldoFinal, totalAbonado;
  if(_esVersionA){
    totalAbonado = anticipo;
    saldoFinal = Math.max(0, totalGeneral - anticipo);
  } else {
    // Calcular totalAbonado real:
    // totalPagosParciales solo suma el array pagosParciales (abonos).
    // El anticipo inicial se muestra por separado — sumarlo aquí para el total abonado correcto.
    const _anticipoEnTotal = anticipo;
    const totalAbonado_raw = datos.totalAbonado !== undefined ? parseFloat(datos.totalAbonado)||0 : _anticipoEnTotal;
    const abonadoCalculado = totalPagosParciales > 0
      ? totalPagosParciales + _anticipoEnTotal
      : (totalAbonado_raw > 0 ? totalAbonado_raw : _anticipoEnTotal);
    // saldoFinal: prioridad → datos.saldoNuevo → saldoPendiente guardado → cálculo desde abonado
    saldoFinal = (datos.saldoNuevo !== undefined && datos.saldoNuevo !== null)
      ? parseFloat(datos.saldoNuevo)
      : (datos.saldoPendiente !== undefined && datos.saldoPendiente !== null
          ? parseFloat(datos.saldoPendiente)
          : Math.max(0, totalGeneral - abonadoCalculado));
    // totalAbonado final — siempre coherente con saldoFinal
    totalAbonado = Math.max(0, totalGeneral - saldoFinal);
  }
  // Si el cuadro de totales (alto ~22mm) + QR + firmas (~38mm) no cabe, ir a página 2
  if(y + 62 > 262){
    doc.addPage();
    y = 18;
  }
  // ── RECIBO DE CANCELACIÓN: cuadro de totales especial ──
  // El trámite quedó sin efecto, así que TOTAL/PAGO RECIBIDO/SALDO RESTANTE
  // (o TOTAL/ABONADO/RESTA) ya no tienen sentido — quedarían en $0.00 sin
  // explicar por qué. En su lugar se muestra el cálculo real del cierre: lo
  // que se había recibido, lo que el despacho retiene por gestiones ya
  // realizadas, y lo que efectivamente se reintegra al cliente (o, si el
  // saldo fue a favor del despacho / sin movimiento, la variante correspondiente).
  const _canTipo  = datos.cancelacionTipo || '';
  const _canMonto = parseFloat(datos.cancelacionMonto||0);
  function _dibujarCajaCancelacion(yBox){
    if(qrDataURL){ try{doc.addImage(qrDataURL,'PNG',margin,yBox,18,18);}catch(e){ registrarError('catch vacio', e); } }
    doc.setFillColor(255,255,255); doc.rect(margin+cW-62,yBox,62,22,'F');
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.rect(margin+cW-62,yBox,62,22);
    doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,80,40);
    if(_canTipo==='ingreso'){
      // Cancelación con cargo a favor del despacho (honorarios): NO se arrastra
      // ningún saldo anterior — el anticipo ya se cobró y liquidó aparte. El
      // único monto en juego es el cargo que genera la propia cancelación, así
      // que CARGO DE CANCEL. y TOTAL A PAGAR son el mismo importe.
      doc.text('CARGO DE CANCEL.:',margin+cW-60,yBox+9);
      doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
      doc.text('TOTAL A PAGAR:',margin+cW-60,yBox+17);
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(139,90,43);
      doc.text('+$'+fmtMXN(_canMonto),margin+cW-1.5,yBox+9,{align:'right'});
      doc.setFontSize(12); doc.setTextColor(176,30,30);
      doc.text('$'+fmtMXN(_canMonto),margin+cW-1.5,yBox+17.5,{align:'right'});
    } else if(_canTipo==='sin_movimiento'){
      // Sin movimiento económico: el anticipo recibido se consumió íntegro en
      // gastos/gestiones ya realizadas — no hay reintegro ni cobro adicional,
      // quedan a mano. Se muestra el anticipo contra el gasto que lo absorbe
      // para que el $0.00 final se entienda (no es un dato faltante).
      doc.text('ANTICIPO RECIBIDO:',margin+cW-60,yBox+5);
      doc.text('GASTOS DEL TRÁMITE:',margin+cW-60,yBox+11);
      doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
      doc.text('SALDO:',margin+cW-60,yBox+18);
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(20,10,5);
      doc.text('$'+fmtMXN(totalAbonado),margin+cW-1.5,yBox+5,{align:'right'});
      doc.setTextColor(139,90,43);
      doc.text('-$'+fmtMXN(totalAbonado),margin+cW-1.5,yBox+11,{align:'right'});
      doc.setFontSize(11.5); doc.setTextColor(42,122,58);
      doc.text('$0.00',margin+cW-1.5,yBox+18.5,{align:'right'});
    } else {
      // egreso — el caso más común: reintegro al cliente
      const _retencion = Math.max(0, totalAbonado - _canMonto);
      doc.text('ANTICIPO RECIBIDO:',margin+cW-60,yBox+5);
      doc.text('RETENCIÓN ADMIN.:',margin+cW-60,yBox+11);
      doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
      doc.text('REINTEGRO CLIENTE:',margin+cW-60,yBox+18);
      doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(20,10,5);
      doc.text('$'+fmtMXN(totalAbonado),margin+cW-1.5,yBox+5,{align:'right'});
      doc.setTextColor(139,90,43);
      doc.text('-$'+fmtMXN(_retencion),margin+cW-1.5,yBox+11,{align:'right'});
      doc.setFontSize(11.5); doc.setTextColor(176,30,30);
      doc.text('$'+fmtMXN(_canMonto),margin+cW-1.5,yBox+18.5,{align:'right'});
    }
  }
  // ── RESUMEN DE PAGO (solo en versiones B+ que NO son Sin Costo Total Pactado:
  // liquidación o abono parcial normal, que sí arrastra saldo anterior) ──
  if(_esUpdate && !_esAbiertoPDF){
    // Los números (_saldoAnteriorResumen_CP / _pagoEstaVersion_CP /
    // _saldoRestante_CP) ya se calcularon arriba, al inicio de la función —
    // misma fuente de verdad que usa también el bloque "SUMA TOTAL DE
    // ADEUDOS / PAGOS REALIZADOS" (ver sección de Servicio Complementario).
    // Verificar espacio
    if(y + 25 > 262){ doc.addPage(); y = 18; }
    // QR + cuadro resumen al mismo nivel que versión A
    y += 0.5;
    if(_esCancelacion){
      _dibujarCajaCancelacion(y);
      y += 24;
    } else {
    if(qrDataURL){ try{doc.addImage(qrDataURL,'PNG',margin,y,18,18);}catch(e){ registrarError('catch vacio', e); } }
    // Cuadro pequeño idéntico al de versión A — solo borde, fondo blanco
    doc.setFillColor(255,255,255); doc.rect(margin+cW-62,y,62,22,'F');
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.rect(margin+cW-62,y,62,22);
    // Cuando esta versión es un recibo de Servicio Complementario (_esRecCEDetalladoCP),
    // las etiquetas del cuadro pasan a TOTAL/ABONADO/RESTA (igual que el modo Sin
    // Costo Total Pactado) para que sea consistente con el desglose de "SUMA TOTAL
    // DE ADEUDOS" y "PAGOS REALIZADOS" que ya se imprimió arriba. En un recibo de
    // abono/liquidación normal (sin cargo nuevo) se mantienen las etiquetas de
    // siempre (SALDO ANTERIOR/PAGO RECIBIDO/SALDO RESTANTE).
    const _sinDeudaPreviaPDF = (_saldoAnteriorResumen_CP || 0) <= 0;
    const _labelSaldoPrev = _esRecCEDetalladoCP
      ? 'TOTAL:'
      : (_sinDeudaPreviaPDF ? 'TOTAL:' : 'ADEUDO:');
    const _labelPagoRecibido = 'PAGO RECIBIDO:';
    const _labelSaldoRestante = 'RESTA:';
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,80,40);
    doc.text(_labelSaldoPrev,margin+cW-60,y+5);
    doc.text(_labelPagoRecibido,margin+cW-60,y+11);
    doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
    doc.text(_labelSaldoRestante,margin+cW-60,y+18);
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(20,10,5);
    doc.text('$'+fmtMXN(_saldoAnteriorResumen_CP),margin+cW-1.5,y+5,{align:'right'});
    doc.setTextColor(139,90,43);
    doc.text('$'+fmtMXN(_pagoEstaVersion_CP),margin+cW-1.5,y+11,{align:'right'});
    doc.setFontSize(11.5); doc.setTextColor(42,122,58);
    doc.text('$'+fmtMXN(_saldoRestante_CP),margin+cW-1.5,y+18.5,{align:'right'});
    y += 24;
    }
  }
  // ── SIN COSTO TOTAL PACTADO en versión B+: recibo independiente por transacción ──
  // Si HAY un cargo real (adeudo anterior sin liquidar, o un Servicio Complementario
  // nuevo en este recibo): TOTAL = adeudo anterior + cargo nuevo, ABONADO = lo pagado
  // en ESTA transacción, RESTA = lo que sigue faltando de ESE cargo específico.
  // Si NO hay ningún cargo real (abono suelto, sin relación a ningún servicio): el
  // recibo es completamente independiente — TOTAL = ABONADO = lo entregado, RESTA $0.00.
  if(_esUpdate && _esAbiertoPDF){
    const _totalCajaSC  = _hayCargoRealSC ? _totalConAdeudoSC : _totalPagosParcialesPreSC;
    const _abonoCajaSC  = _totalPagosParcialesPreSC;
    const _restaCajaSC  = _hayCargoRealSC ? _restaTransSC : 0;
    if(y + 25 > 262){ doc.addPage(); y = 18; }
    y += 0.5;
    if(_esCancelacion){
      _dibujarCajaCancelacion(y);
      y += 24;
    } else {
    if(qrDataURL){ try{doc.addImage(qrDataURL,'PNG',margin,y,18,18);}catch(e){ registrarError('catch vacio', e); } }
    doc.setFillColor(255,255,255); doc.rect(margin+cW-62,y,62,22,'F');
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.rect(margin+cW-62,y,62,22);
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,80,40);
    doc.text('TOTAL:',margin+cW-60,y+5);
    // A petición expresa: en Servicio Complementario (_tieneCE) esta etiqueta
    // dice "PAGO RECIBIDO:" (igual que el cuadro equivalente de Costo Pactado,
    // _labelPagoRecibido más arriba). Los abonos sueltos sin CE conservan "ABONADO:".
    doc.text(_tieneCE ? 'PAGO RECIBIDO:' : 'ABONADO:',margin+cW-60,y+11);
    doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
    doc.text('RESTA:',margin+cW-60,y+18);
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(20,10,5);
    doc.text('$'+fmtMXN(_totalCajaSC),margin+cW-1.5,y+5,{align:'right'});
    doc.text('$'+fmtMXN(_abonoCajaSC),margin+cW-1.5,y+11,{align:'right'});
    doc.setFontSize(11.5); doc.setTextColor(_restaCajaSC>0?154:42, _restaCajaSC>0?110:122, _restaCajaSC>0?24:58);
    doc.text('$'+fmtMXN(_restaCajaSC),margin+cW-1.5,y+18.5,{align:'right'});
    y += 24;
    }
  }
  y += 0.5;
  // QR + cuadro TOTAL/ANTICIPO/RESTA — solo versión A (primaria). A petición
  // expresa, la etiqueta de la segunda línea pasó de "ABONADO" a "ANTICIPO"
  // (solo en el folio A original — los recibos posteriores B/C/D conservan
  // sus propias etiquetas, ver los otros dos cuadros de totales arriba).
  if(!_esUpdate){
    if(qrDataURL){ try{doc.addImage(qrDataURL,'PNG',margin,y,18,18);}catch(e){ registrarError('catch vacio', e); } }
    doc.setFillColor(255,255,255); doc.rect(margin+cW-62,y,62,22,'F');
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.rect(margin+cW-62,y,62,22);
    doc.setFontSize(7.5); doc.setFont('helvetica','normal'); doc.setTextColor(100,80,40);
    doc.text('TOTAL:',margin+cW-60,y+5);
    doc.text('ANTICIPO:',margin+cW-60,y+11);
    doc.setFont('helvetica','bold'); doc.setTextColor(154,110,24);
    doc.text('RESTA:',margin+cW-60,y+18);
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(20,10,5);
    doc.text('$'+fmtMXN(totalGeneral),margin+cW-1.5,y+5,{align:'right'});
    doc.text('$'+fmtMXN(totalAbonado),margin+cW-1.5,y+11,{align:'right'});
    doc.setFontSize(11.5); doc.setTextColor(saldoFinal>0?154:42, saldoFinal>0?110:122, saldoFinal>0?24:58);
    doc.text('$'+fmtMXN(Math.max(0,saldoFinal)),margin+cW-1.5,y+18.5,{align:'right'});
    y += 24;
  }
  // Historial de pagos (si hay folio anterior)
  if(datos.folioAnterior && datos.historialPagosRef && datos.historialPagosRef.length){
    y+=2;
    doc.setFillColor(248,244,232); doc.rect(margin,y-3.5,cW,5,'F');
    doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.text('HISTORIAL DE PAGOS — Ref. Folio #'+folioFormato(datos.folioAnterior),margin+1,y); y+=4;
    const hCols=[22,28,36,30,36];
    const hHdrs=['Folio','Fecha','Tipo','Abono','Saldo resta'];
    let hx=margin;
    doc.setFontSize(6); doc.setFont('helvetica','bold'); doc.setTextColor(100,80,40);
    hHdrs.forEach((h,i)=>{ doc.text(h,hx,y); hx+=hCols[i]; }); y+=3.5;
    doc.setDrawColor(200,160,60); doc.line(margin,y-1,margin+cW,y-1);
    datos.historialPagosRef.forEach(h=>{
      hx=margin;
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(20,10,5);
      doc.text('#'+folioFormato(h.folio, h.anio_folio),hx,y); hx+=hCols[0];
      doc.text(h.fecha||'—',hx,y); hx+=hCols[1];
      doc.text(h.tipo||'',hx,y); hx+=hCols[2];
      doc.setTextColor(30,120,50);
      doc.text('$'+fmtMXN(h.pago||0),hx,y); hx+=hCols[3];
      doc.setTextColor(h.saldo>0?176:30,h.saldo>0?16:120,h.saldo>0?16:50);
      doc.text('$'+fmtMXN(h.saldo||0),hx,y);
      doc.setTextColor(20,10,5);
      doc.setDrawColor(230,210,170); doc.line(margin,y+1.5,margin+cW,y+1.5);
      y+=5;
    });
    y+=2;
  } else { y+=2; }
  // Firmas
  doc.setDrawColor(80,65,40); doc.setLineWidth(0.3);
  const fw=cW*0.38, fS=margin+28;
  // ── TEXTO DE CONFORMIDAD ──
  const _mesesPDF = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  // Fecha del texto de conformidad: en actualizaciones (B, C, D…) usa la fecha de
  // ESTA versión (misma fuente que el encabezado), no la del recibo original.
  const _fechaConf = (_esUpdate && _fpPrincipal && _fpPrincipal.fecha)
    ? _fpPrincipal.fecha
    : (datos.fecha_recibo || new Date().toISOString().slice(0,10));
  const _dConf = _fechaConf.split('-');
  const _textoConf = 'Leído que fue el presente documento y enterado de su contenido y alcance legal, lo firman por duplicado de conformidad en Santiago Juxtlahuaca, Oaxaca, a los ' + parseInt(_dConf[2],10) + ' días del mes de ' + _mesesPDF[parseInt(_dConf[1],10)-1] + ' de ' + _dConf[0] + '.';
  doc.setFontSize(7); doc.setFont('helvetica','bolditalic'); doc.setTextColor(60,45,20);
  // Estimación de líneas solo para el salto de página (el layout real usa
  // _pdfParrafoJustificado, que además respeta el margen de impresión —
  // antes se dibujaba desplazado a "margin+4" pero envuelto al ancho
  // completo "cW" sin descontar ese desplazamiento, por lo que el texto
  // se salía del área imprimible por la derecha).
  const _confLines = doc.splitTextToSize(_textoConf, cW);
  // Verificar espacio
  if(y + _confLines.length * 3.2 + 14 > 262){ doc.addPage(); y = 18; }
  y = _pdfParrafoJustificado(_textoConf, margin, y, cW, { sangria: 6, lineHeight: 3.2 }) + 5;
  doc.line(fS,y+8,fS+fw,y+8); doc.line(fS+fw+14,y+8,fS+fw*2+14,y+8);
  // ── Determinar si autorizador es la MISMA persona que el responsable ──
  let mismaPersona = false;
  if(datos.autorizacion && datos.autorizacion.nombre){
    const limpiar = (s)=>String(s||'').toUpperCase()
      .replace(/\b(LIC\.?|LICENCIADO|LICENCIADA|MTRO\.?|MTRA\.?|DR\.?|DRA\.?|ING\.?|ARQ\.?|C\.?|SR\.?|SRA\.?|SRTA\.?)\b/g,'')
      .replace(/\s+/g,' ').trim();
    mismaPersona = (limpiar(datos.responsable) === limpiar(datos.autorizacion.nombre));
  }
  // Si es la MISMA persona: poner "AUTORIZÓ" arriba del nombre del responsable
  if(mismaPersona){
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(154,110,24);
    doc.text('AUTORIZÓ', fS+fw/2, y+5, {align:'center'});
  }
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(40,30,15);
  doc.text((datos.responsable||'Responsable del Trámite').toUpperCase(),fS+fw/2,y+12,{align:'center'});
  doc.text('C. '+(datos.nombre_cliente_firma||(datos.clientes[0]?.nombre)||'Cliente'),fS+fw+14+fw/2,y+12,{align:'center'});
  doc.setFontSize(6); doc.setTextColor(120,100,60);
  doc.text('Responsable del trámite',fS+fw/2,y+15.5,{align:'center'});
  doc.text('Cliente',fS+fw+14+fw/2,y+15.5,{align:'center'});
  // ── AUTORIZADOR — solo si es DISTINTO al responsable: dibujar firma adicional debajo ──
  if(datos.autorizacion && datos.autorizacion.nombre && !mismaPersona){
    const yAuth = y + 20;
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(154,110,24);
    doc.text('AUTORIZÓ', fS+fw/2, yAuth, {align:'center'});
    // Línea de firma
    doc.setDrawColor(80,65,40); doc.setLineWidth(0.3);
    doc.line(fS, yAuth+6, fS+fw, yAuth+6);
    // Nombre del autorizador (con "Lic." y mayúsculas para consistencia con el responsable)
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(40,30,15);
    doc.text(String(datos.autorizacion.nombre).toUpperCase(), fS+fw/2, yAuth+10, {align:'center'});
    doc.setFontSize(6); doc.setTextColor(120,100,60);
    doc.text('Firma de quien autorizó la actualización', fS+fw/2, yAuth+13.5, {align:'center'});
    y += 14; // empujar el resto del contenido (placas, etc.) hacia abajo
  }
  // ── PLACAS GENERADAS — línea simple sin cuadro, pegada encima del footer ──
  if(datos.placasEntregadas){
    // Posicionar justo encima del footer (línea en 271, footer en 275)
    const placasY = 264;
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.3);
    doc.line(margin, placasY-1, margin+cW, placasY-1);
    doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(20,100,40);
    const placasLabel = 'PLACAS GENERADAS EN EL TRÁMITE:  N°: ' + String(datos.placasEntregadas) +
      (datos.estadoPlacas ? '   Estado: ' + String(datos.estadoPlacas) : '');
    doc.text(placasLabel, margin, placasY+3);
  }
  // ── NOTA DE CANCELACIÓN ──
  if(datos.cancelado){
    const fechaCan = datos.fechaCancelacion
      ? new Date(datos.fechaCancelacion).toLocaleString('es-MX',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})
      : '';
    // Motivo sin la parte de autorización (quitar desde " — Autorizó:")
    const motivoCompleto = datos.motivoCancelacion || 'Sin motivo especificado';
    const motivo = motivoCompleto.split(' — Autoriz')[0].trim();
    // Concepto de liquidación (ingreso/egreso/sin movimiento)
    const tipoCan = datos.cancelacionTipo || '';
    const montoCan = parseFloat(datos.cancelacionMonto || 0);
    const conceptoCan = tipoCan==='ingreso'
      ? 'Honorarios por cancelación'
      : tipoCan==='egreso'
      ? 'Reintegro por cancelación'
      : tipoCan==='sin_movimiento' ? 'Cancelación sin movimiento económico' : '';
    const montoCanStr = montoCan > 0
      ? (tipoCan==='egreso' ? '  EGRESO: -$' : '  INGRESO: +$') + montoCan.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')
      : (tipoCan==='sin_movimiento' ? '  Sin movimiento económico' : '');

    // Calcular altura del box según contenido real
    doc.setFontSize(6.8);
    const motivoLines = doc.splitTextToSize('Motivo: '+motivo, cW-12);
    const nLineas = motivoLines.length;
    const lineH = 4.5;
    const boxY = y + 24;
    const boxH = 7 + 5.5 + 5 + (nLineas * lineH) + (conceptoCan ? 9 : 2);

    doc.setDrawColor(180,40,40); doc.setLineWidth(0.5);
    doc.rect(margin, boxY, cW, boxH, 'D');

    // Título
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(160,20,20);
    doc.text('TRÁMITE CANCELADO', margin+4, boxY+6);

    // Fecha
    doc.setFont('helvetica','normal'); doc.setFontSize(6.8); doc.setTextColor(100,20,20);
    let _ly = boxY + 12;
    if(fechaCan){ doc.text('Fecha de cancelación: '+fechaCan, margin+4, _ly); _ly += lineH + 1; }

    // Motivo completo — todas las líneas
    motivoLines.forEach(function(ln){ doc.text(ln, margin+4, _ly); _ly += lineH; });

    // Concepto ingreso/egreso/sin movimiento — debajo del motivo con separación
    if(conceptoCan){
      _ly += 2;
      doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(80,20,20);
      // Concepto a la izquierda, monto a la derecha
      doc.text(conceptoCan, margin+4, _ly);
      if(montoCanStr.trim()) doc.text(montoCanStr.trim(), margin+cW-4, _ly, {align:'right'});
    }
  }
  // Footer — aplicar a TODAS las páginas (en caso de salto por muchos abonos)
  const totalPaginas = doc.internal.getNumberOfPages();
  for(let pg = 1; pg <= totalPaginas; pg++){
    doc.setPage(pg);
    doc.setDrawColor(200,160,60); doc.setLineWidth(0.4); doc.line(margin,271,pageW-margin,271);
    doc.setTextColor(154,110,24); doc.setFontSize(6.5); doc.setFont('helvetica','normal');
    doc.text('LEX-MÉXICO DESPACHO JURÍDICO · CALLE MIGUEL HIDALGO ESQ. MÉXICO NO. 200, LOCAL B · TEL: 953 128 7511',pageW/2,275,{align:'center'});
    if(totalPaginas > 1){
      doc.setFontSize(6); doc.setTextColor(120,100,60);
      doc.text('P\u00e1gina '+pg+' de '+totalPaginas, pageW-margin, 278, {align:'right'});
    }
  }
  doc.setPage(totalPaginas);
  // ── MARCA DE AGUA ──
  // PAGADO: cuando saldo final es 0. Reutiliza el mismo `saldoFinal` ya
  // calculado arriba (letra A = solo anticipo, nunca el saldo vivo del
  // folio completo) — una sola fuente de verdad, no una copia que se pueda
  // desincronizar.
  // FIX (caso real: folio 56C): en Sin Costo Pactado, `saldoFinal` (arriba)
  // prioriza datos.saldoNuevo/datos.saldoPendiente guardados, los mismos
  // campos que en otras partes del código ya se documentaron como poco
  // confiables (pueden quedar desincronizados del PDF real). El cuerpo del
  // recibo SÍ usa el cálculo recalculado y correcto (_restaTransSC) para
  // mostrar la RESTA — así que el sello PAGADO debe usar esa MISMA fuente,
  // no el campo guardado, para no contradecir lo que el propio PDF muestra.
  if(_esAbiertoPDF && _esUpdate){
    saldoFinal = _restaTransSC;
  }
  if(saldoFinal <= 0 && (parseFloat(datos.totalGeneral||datos.total||0)) > 0){
    dibujarMarcaAgua(doc, 'PAGADO', [30, 140, 60]);
  }
  // CANCELADO: si se pasa el flag
  if(datos.cancelado){
    dibujarMarcaAgua(doc, 'CANCELADO', [120, 120, 120]);
  }
  return doc;
}

function cargarHistorialExpediente(){
  const raw = ($('expediente_buscar')||{}).value || '';
  // Los paneles antiguos (chips + tabla de historial) fueron reemplazados por
  // la Ficha del Folio (ver cargarHistorialFolio) — se mantienen ocultos siempre.
  const infoBox = document.getElementById('info-folio-anterior');
  const histDiv  = document.getElementById('historial-pagos-prev');
  if(infoBox) infoBox.style.display='none';
  if(histDiv) histDiv.style.display='none';
  if(!raw.trim()){
    salirModoConsulta();
    return;
  }
  // Limpiar campo de folio para no tener dos búsquedas activas
  const folioInp = document.getElementById('folio_anterior');
  if(folioInp) folioInp.value='';
  // Buscar en appData.recibos el campo expedienteNum
  const q = raw.trim().toUpperCase();
  const recibo = appData.recibos.find(r => r.expedienteNum && r.expedienteNum.toUpperCase() === q && !r.esComplemento);
  if(!recibo){
    if(typeof toast==='function') toast('⚠ Expediente '+q+' no encontrado en historial.', 'err');
    reciboEnConsulta = null;
    salirModoConsulta();
    return;
  }
  // Redirigir al folio para usar el flujo existente de visualización
  if(folioInp){ folioInp.value = recibo.folio; }
  // Vaciar campo expediente para no entrar en loop
  if($('expediente_buscar')) $('expediente_buscar').value = q; // mantener visible para referencia
  cargarHistorialFolio();
}

function cargarHistorialFolioDebounce(){
  var v = parseInt((document.getElementById('folio_anterior')||{}).value||0)||0;
  clearTimeout(_cargarHistFolioTimer);
  if(!v){ cargarHistorialFolio(); return; } // limpiar inmediatamente
  _cargarHistFolioTimer = setTimeout(cargarHistorialFolio, 350);
}

function cargarHistorialFolio(){
  const val = parseInt(document.getElementById('folio_anterior').value)||null;
  // Los paneles antiguos (chips A/B/C + panel "Estado" + tabla de historial de
  // pagos) fueron reemplazados por la Ficha del Folio, que muestra la misma
  // información (y más) de forma correcta y unificada para cualquier tipo de
  // trámite. Se mantienen ocultos siempre; solo se activa Modo Consulta (recibo
  // + PDF) y se abre la Ficha del Folio encima.
  const infoBox = document.getElementById('info-folio-anterior');
  const histDiv  = document.getElementById('historial-pagos-prev');
  const chipsDiv = document.getElementById('folios-relacionados');
  if(infoBox) infoBox.style.display='none';
  if(histDiv) histDiv.style.display='none';
  if(chipsDiv) chipsDiv.style.display='none';
  // A petición expresa: al borrar todos los dígitos del campo, se debe
  // regresar a la pantalla inicial (modo captura), no quedarse mostrando la
  // última consulta. Antes esto NO cerraba la consulta porque salirModoConsulta()
  // reubicaba #folio_anterior de vuelta a su panel original y eso le quitaba
  // el foco al campo (no se podía seguir escribiendo un folio nuevo sin volver
  // a hacer clic). Ese problema de raíz ya se corrigió en _folioAnteriorSync()
  // (preserva el foco/cursor al mover el nodo entre paneles), así que ahora sí
  // es seguro volver a cerrar la consulta al vaciar el campo.
  if(!val){
    if(document.body.classList.contains('modo-consulta') && typeof salirModoConsulta==='function'){
      salirModoConsulta();
    }
    return;
  }
  // Buscar TODOS los recibos con ese número base (distintas letras: A, B, C...)
  const todosConFolio = (appData.recibos||[]).filter(r => r.folio===val && !r.esComplemento);
  // Ordenar siempre: A primero, última letra al final
  const ordenados = todosConFolio.slice().sort(function(a,b){
    const la = (a.letra||(typeof letraVersion==='function'?letraVersion(a):'A')||'A');
    const lb = (b.letra||(typeof letraVersion==='function'?letraVersion(b):'A')||'A');
    return la < lb ? -1 : la > lb ? 1 : 0;
  });
  // Usar el más reciente para activar Modo Consulta (igual que antes)
  const recibo = ordenados.length ? ordenados[ordenados.length-1] : null;
  if(!recibo){
    if(typeof toast==='function') toast('⚠ Folio #'+folioFormato(val)+' no encontrado en historial.', 'err');
    salirModoConsulta();
    return;
  }
  reciboEnConsulta = recibo;
  activarModoConsulta(recibo);
  // Abrir la Ficha del Folio encima de la consulta — pequeño delay para que el
  // formulario de consulta ya haya terminado de pintarse (mismo patrón usado en
  // el resto del código para evitar parpadeos al encadenar navegación + modal).
  setTimeout(function(){ if(typeof abrirFichaFolio==='function') abrirFichaFolio(); }, 200);
}

function salirModoConsulta(){
  _modoConsultaToken++; // cancela cualquier activarModoConsulta en vuelo
  reciboEnConsulta = null;
  if(typeof cerrarFichaFolio==='function') cerrarFichaFolio();
  document.body.classList.remove('modo-consulta');
  document.body.classList.remove('folio-liquidado');
  document.body.classList.remove('folio-cancelado');
  // Limpiar iframe y liberar blob URL
  const iframe = document.getElementById('pdf-consulta-iframe');
  if(iframe){
    if(iframe._blobUrl){ try{ URL.revokeObjectURL(iframe._blobUrl); }catch(e){} iframe._blobUrl = null; }
    iframe.src = '';
  }
  // Restaurar folio display al actual
  if(typeof appData !== 'undefined') actualizarFolioDisplay();
}

function cerrarConsulta(){
  document.body.classList.remove('modo-consulta');
  document.body.classList.remove('folio-liquidado');
  document.body.classList.remove('folio-cancelado');
  document.body.classList.remove('paneles-busqueda-abiertos');
  document.body.classList.remove('en-accion-pago');
  document.body.classList.remove('paneles-abiertos-consulta');
  _panelesBusquedaAbiertos = false;
  if(typeof _pbcAbierto !== 'undefined') _pbcAbierto = false;
  if(typeof _pfcAbierto !== 'undefined') _pfcAbierto = false;
  // CRÍTICO: body.modo-consulta fuerza paneles-busqueda-cuerpo a display:block !important.
  // .style.display='none' serializa "display: none;" (con espacio) y el selector CSS
  // [style*="display:none"] NO lo detecta. setAttribute garantiza el string exacto sin espacio.
  const cuerpo = document.getElementById('paneles-busqueda-cuerpo');
  if(cuerpo) cuerpo.setAttribute('style','display:none;padding:0 20px 14px;');
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto(); else salirModoConsulta();
  renderHistorial();
  setStatus('ok','Formulario listo — folio #'+folioFormato(appData.folioActual),'ok');
  setTimeout(()=>{
    const rb = document.getElementById('recibo-body');
    if(rb) rb.scrollIntoView({behavior:'smooth', block:'start'});
    else window.scrollTo({top:0, behavior:'smooth'});
  }, 150);
}

function _cerrarPanelesBusqueda(){
  // Añadir clase que el CSS respeta con mayor especificidad que modo-consulta
  document.body.classList.add('en-accion-pago');
  // Cerrar paneles toggle
  if(typeof _panelesBusquedaAbiertos !== 'undefined' && _panelesBusquedaAbiertos){
    if(typeof togglePanelesBusqueda === 'function') togglePanelesBusqueda();
  }
  // Forzar ocultado directo con !important via style
  const pbcBody = document.getElementById('pbc-body');
  const pfcBody = document.getElementById('pfc-body');
  const panCuerpo = document.getElementById('paneles-busqueda-cuerpo');
  if(pbcBody) pbcBody.setAttribute('style','display:none !important;');
  if(pfcBody) pfcBody.setAttribute('style','display:none !important;');
  if(panCuerpo) panCuerpo.setAttribute('style','display:none !important; padding:0 20px 14px;');
  if(typeof _panelesBusquedaAbiertos !== 'undefined') _panelesBusquedaAbiertos = false;
  if(typeof _pbcAbierto !== 'undefined') _pbcAbierto = false;
  if(typeof _pfcAbierto !== 'undefined') _pfcAbierto = false;
}

function _restaurarPanelesBusqueda(){
  // Quitar clase auxiliar después de que la acción de pago terminó
  document.body.classList.remove('en-accion-pago');
  const panCuerpo = document.getElementById('paneles-busqueda-cuerpo');
  if(panCuerpo) panCuerpo.setAttribute('style','display:none; padding:0 20px 14px;');
}

async function ejecutarServicioComplementario(){
  if(!reciboEnConsulta){ showModal('Error','No hay un recibo en consulta.'); return; }
  const recibo = reciboEnConsulta;
  // Solicitar autorización igual que pago parcial
  const auth = await pedirAutorizacion();
  if(auth === null){ setStatus('ok','Servicio complementario cancelado — autorización no proporcionada','ok'); return; }
  window._autorizacionActual = auth;
  // Marcar que venimos de servicio complementario
  window._modoServicioComplementario = true;
  // ── FIX: preservar estado retro ANTES de abrirModoActualizacion,
  //    porque limpiarFormCompleto() (llamado internamente) lo resetea a false. ──
  const _retroPreservar        = !!window._reciboRetroactivoActivo;
  const _retroFechaPreservar   = window._reciboRetroactivoFechaPersonalizada || null;
  const _retroHoraPreservar    = window._reciboRetroactivoHoraPersonalizada  || null;
  abrirModoActualizacion(recibo);
  // Restaurar estado retro (fue anulado por limpiarFormCompleto dentro de abrirModoActualizacion)
  if(_retroPreservar && _retroFechaPreservar){
    window._reciboRetroactivoActivo             = true;
    window._reciboRetroactivoFechaPersonalizada = _retroFechaPreservar;
    window._reciboRetroactivoHoraPersonalizada  = _retroHoraPreservar;
  }
  // Re-sincronizar aquí (no solo dentro de abrirModoActualizacion): el estado
  // retro se restauró recién arriba, después de que abrirModoActualizacion ya
  // hubiera sincronizado con el estado viejo (limpio) — sin esto el texto de
  // conformidad podía quedar desfasado del RETRO en este flujo específico.
  if (typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
  // Agregar automáticamente una fila editable en Servicio Complementario
  // (el estado retro ya está restaurado, por lo que agregarCostoExtra() tomará la fecha correcta)
  setTimeout(()=>{
    agregarCostoExtra();
    recalcularResumenActualizacion();
    if (typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
    // Auto-focus al campo de concepto del servicio complementario
    const inputConcepto = document.querySelector('#costos-extra-tbody tr:last-child .ce-concepto');
    if(inputConcepto){
      inputConcepto.focus();
      inputConcepto.scrollIntoView({ behavior:'smooth', block:'center' });
    }
  }, 200);
}

function cancelarAbonoNuevo(){
  window._folioReferencia = null;
  window._reciboOriginalRef = null;
  const banner = document.getElementById('abono-ref-banner');
  if(banner) banner.style.display='none';
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto();
  // Restaurar estado limpio con buscador visible
  document.body.classList.remove('modo-consulta','folio-liquidado','folio-cancelado',
    'modo-actualizacion','recibo-frozen','en-accion-pago','paneles-abiertos-consulta');
  if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
  if(typeof setStatus==='function') setStatus('ok','Folio #'+(typeof folioFormato==='function'?folioFormato(appData.folioActual):appData.folioActual)+' listo para capturar','ok');
  // Restaurar status-bar
  const _sb = document.querySelector('.status-bar');
  if(_sb) _sb.removeAttribute('style');
}

function abrirModoActualizacion(recibo){
  // Guardar respaldo ANTES de ir() porque limpiarFormCompleto (llamado por ir) anula la variable.
  // window._reciboActualizacionBackup es la fuente de verdad que nada más toca.
  window._reciboActualizacionBackup = recibo;
  // Navegar al panel — esto llama limpiarFormCompleto() internamente
  if(typeof ir === 'function') ir('nuevo-recibo');
  // Reasignar inmediatamente tras el reset de limpiarFormCompleto
  reciboEnActualizacion = recibo;
  // Salir del modo consulta (oculta el iframe del PDF) y entrar al formulario congelado
  document.body.classList.remove('modo-consulta');
  document.body.classList.remove('folio-liquidado');
  document.body.classList.remove('folio-cancelado');
  document.body.classList.remove('actualizacion-impresa');
  // Cerrar paneles forzadamente para que el formulario sea visible
  if(_panelesBusquedaAbiertos) togglePanelesBusqueda();
  // Forzar cierre directo también (por si _panelesBusquedaAbiertos no estaba sincronizado)
  const _pCuerpo = document.getElementById('paneles-busqueda-cuerpo');
  const _pbc = document.getElementById('pbc-body');
  const _pfc = document.getElementById('pfc-body');
  if(_pCuerpo) _pCuerpo.style.display = 'none';
  if(_pbc) _pbc.style.display = 'none';
  if(_pfc) _pfc.style.display = 'none';
  document.body.classList.remove('paneles-busqueda-abiertos');
  _panelesBusquedaAbiertos = false;
  const iframe = document.getElementById('pdf-consulta-iframe');
  if(iframe){
    if(iframe._blobUrl){ try{ URL.revokeObjectURL(iframe._blobUrl); }catch(e){} iframe._blobUrl = null; }
    iframe.src = '';
  }
  // Cargar todos los datos del recibo en el formulario
  cargarReciboEnFormulario(recibo);
  // Calcular la letra que se GENERARÁ al imprimir la actualización (misma lógica que _imprimirActualizacionReal)
  const _letrasUsadasAct = (appData.recibos || [])
    .filter(_r => _r.folio === recibo.folio && !_r.esComplemento)
    .map(_r => (_r.letra || 'A').toUpperCase().charCodeAt(0));
  const _letraBaseAct = (recibo.letra || 'A').toUpperCase().charCodeAt(0);
  const _maxLetraAct  = _letrasUsadasAct.length > 0 ? Math.max(..._letrasUsadasAct) : _letraBaseAct;
  const _letraProximaAct = String.fromCharCode(_maxLetraAct + 1);
  // Mostrar desde el inicio el folio con la letra que se asignará al imprimir
  document.getElementById('folio-display').textContent = folioConLetra(recibo.folio, recibo.anio_folio, _letraProximaAct);
  // Congelar el formulario (todos los campos originales bloqueados)
  document.body.classList.add('recibo-frozen');
  document.body.classList.add('modo-actualizacion');
  // Resetear campo anticipo a 0 — en modo actualización es el PAGO RECIBIDO de esta sesión
  var _antReset = $('anticipo');
  if(_antReset){ _antReset.dataset.programmatic='1'; _antReset.value=''; delete _antReset.dataset.programmatic; }
  // El inline !important supera cualquier regla de hoja de estilos con !important.
  // limpiarFormCompleto() deja display:none !important inline en actions-actualizacion;
  // hay que forzarlo a flex aquí para que los botones de actualización sean visibles.
  const _aActShow = document.getElementById('actions-actualizacion');
  if(_aActShow) _aActShow.style.setProperty('display', 'flex', 'important');
  const _aNormHide = document.getElementById('actions-normal');
  if(_aNormHide) _aNormHide.style.display = 'none';
  const _aPostHide = document.getElementById('actions-post-print');
  if(_aPostHide) _aPostHide.style.display = 'none';
  const _rbActualizacion = document.getElementById('recibo-body');
  if(_rbActualizacion) _rbActualizacion.style.setProperty('display', 'block', 'important');
  // Deshabilitar checkboxes del checklist también
  document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(cb => { cb.disabled = true; });
  // Limpiar el "Saldo Restante" (concepto/descripción editable) de cualquier
  // folio anterior — se repuebla con los valores de ESTE folio en el
  // recalcularResumenActualizacion() que dispara pintarPagosParciales() abajo.
  const _elCptoSRReset = document.getElementById('sr-cp-concepto');
  const _elDescSRReset = document.getElementById('sr-cp-descripcion');
  if(_elCptoSRReset){ _elCptoSRReset.value=''; delete _elCptoSRReset.dataset.manualEdit; }
  if(_elDescSRReset){ _elDescSRReset.value=''; delete _elDescSRReset.dataset.manualEdit; }
  // Limpiar y poblar las dos secciones nuevas con lo que ya esté guardado
  pintarCostosExtra(recibo.costosExtra || []);
  pintarPagosParciales(recibo.pagosParciales || []);
  // A petición expresa: en TODOS los formularios de actualización (Pago
  // Parcial, Pago Total, Servicio Complementario) la fecha/hora del pago y el
  // texto de conformidad deben responder siempre a la fecha/hora maestra del
  // encabezado (la que cambia con el modo RETRO) — nunca a valores propios.
  if (typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
  setStatus('ok','Modo actualización: folio #'+folioConLetra(recibo.folio, recibo.anio_folio, _letraProximaAct)+' — agrega costos extra o pagos parciales','ok');
  setTimeout(()=>{ document.getElementById('seccion-pagos-parciales').scrollIntoView({behavior:'smooth',block:'center'}); }, 200);
}

function cancelarActualizacion(){
  reciboEnActualizacion = null;
  window._reciboActualizacionBackup = null;
  window._flujoEsPagoTotal = false;
  document.body.classList.remove('modo-actualizacion','recibo-frozen','desde-liquidacion',
    'actualizacion-impresa','en-accion-pago','paneles-abiertos-consulta');
  var _antCan = document.getElementById('anticipo'); if(_antCan) _antCan.readOnly = false;
  // Restaurar status-bar y botón de búsqueda
  const _sbCan = document.querySelector('.status-bar');
  if(_sbCan) _sbCan.removeAttribute('style');
  const _btnTogCan = document.getElementById('btn-toggle-paneles');
  if(_btnTogCan) _btnTogCan.style.removeProperty('display');
  // Forzar ocultar actions-actualizacion con !important para ganar al CSS
  const _aActF = document.getElementById('actions-actualizacion');
  if(_aActF) _aActF.setAttribute('style','display:none !important;');
  document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(cb => { cb.disabled = false; });
  document.getElementById('costos-extra-tbody').innerHTML = '';
  document.getElementById('pagos-parciales-tbody').innerHTML = '';
  document.getElementById('seccion-costos-extra').style.display = 'none';
  document.getElementById('seccion-pagos-parciales').style.display = 'none';
  document.getElementById('resumen-pagos-parciales').style.display = 'none';
  const _seccionSRCancel = document.getElementById('seccion-saldo-restante-cp');
  if(_seccionSRCancel) _seccionSRCancel.style.display = 'none';
  // Resetear botones de actualización a su estado original
  const btnCancelar = document.getElementById('btn-cancelar-actualizacion');
  if(btnCancelar){
    btnCancelar.innerHTML = '✕ Cancelar Actualización';
    btnCancelar.onclick = cancelarActualizacion;
  }
  const btnImprimir = document.getElementById('btn-imprimir-actualizacion');
  if(btnImprimir){
    btnImprimir.innerHTML = '\uD83D\uDDA8 Imprimir Actualización';
    btnImprimir.onclick = imprimirActualizacion;
  }
  lastActualizacionBlob = null;
  lastActualizacionNombre = null;
  // Limpiar cuadro rojo de placas antes de limpiar el formulario
  mostrarPlacasEnPantalla(null, null);
  // Cerrar el contenedor de paneles con setAttribute para satisfacer el selector CSS
  // [style*="display:none"] que controla la visibilidad de #recibo-body.
  // NO llamamos _cerrarPanelesBusqueda() porque pone !important en pbc-body/pfc-body
  // impidiendo que togglePanelesBusqueda() los vuelva a abrir.
  const _panCuerpo = document.getElementById('paneles-busqueda-cuerpo');
  if(_panCuerpo) _panCuerpo.setAttribute('style','display:none; padding:0 20px 14px;');
  const _pbcB = document.getElementById('pbc-body');
  const _pfcB = document.getElementById('pfc-body');
  if(_pbcB) _pbcB.removeAttribute('style');
  if(_pfcB) _pfcB.removeAttribute('style');
  _panelesBusquedaAbiertos = false;
  // limpiarFormCompleto resetea acciones, banners, clases y visibilidad del formulario
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto(); else limpiarForm();
  const _sbFin = document.querySelector('.status-bar');
  if(_sbFin) _sbFin.removeAttribute('style');
  const _btnFin = document.getElementById('btn-toggle-paneles');
  if(_btnFin) _btnFin.style.removeProperty('display');
  if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
  renderHistorial();
  setStatus('ok','Listo \u2014 formulario limpio con folio #'+folioFormato(appData.folioActual),'ok');
  // Subir al inicio del formulario para que el usuario vea el recibo limpio
  setTimeout(()=>{
    const rb = document.getElementById('recibo-body');
    if(rb) rb.scrollIntoView({behavior:'smooth', block:'start'});
    else window.scrollTo({top:0, behavior:'smooth'});
  }, 150);
}

function agregarCostoExtra(data){
  costoExtraCount++;
  const id = 'ce'+costoExtraCount;
  const tbody = document.getElementById('costos-extra-tbody');
  const tr = document.createElement('tr'); tr.id = 'costo-extra-row-'+id;
  const isLocked   = !!(data && data.locked);
  const isExisting = !!(data && data.fechaHora);
  // Modo retro: solo para filas nuevas
  const _ceRetroActivo = !isLocked && !isExisting && !!window._reciboRetroactivoActivo && !!window._reciboRetroactivoFechaPersonalizada;
  const _ceRetroFecha  = _ceRetroActivo ? window._reciboRetroactivoFechaPersonalizada : null;
  const _ceRetroHora   = _ceRetroActivo ? (window._reciboRetroactivoHoraPersonalizada || horaCDMX_HHMM()) : null;
  const fechaHora = isExisting ? data.fechaHora
    : (_ceRetroActivo ? (_ceRetroFecha + ' ' + _ceRetroHora + ' hrs.') : nuevaFechaHoraStr());
  tr.dataset.fechaHora = fechaHora;
  if(isLocked) tr.dataset.locked = '1';
  // Preservar la letra de ORIGEN real del cargo (la versión donde se creó), no la
  // versión que se está guardando ahora — evita que un cargo de 56B quede
  // reetiquetado como 56C solo por venir arrastrado como fila bloqueada.
  tr.dataset.folioLetra = (data && data.folioLetra) || '';
  if(isLocked){
    // Mismo criterio que en agregarPagoParcial(): esta tabla debe mostrar solo
    // los servicios complementarios que se agregan AHORA, no el historial
    // completo del folio (ya visible en la Ficha del Folio). El renglón se
    // mantiene oculto en el DOM, no eliminado, porque getCostosExtra() sigue
    // necesitando leerlo al guardar para arrastrar el historial a la
    // siguiente versión del recibo.
    tr.classList.add('ce-row-locked');
    tr.style.display = 'none';
    tr.innerHTML =
        '<td><textarea class="ce-concepto concepto-ta ce-locked-field" rows="1" readonly>'+escHTML((data&&data.concepto)||'')+'</textarea></td>'
      + '<td><textarea class="ce-descripcion concepto-ta ce-locked-field" rows="1" readonly>'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td style="vertical-align:top"><input type="text" class="ce-precio price-input ce-locked-field" readonly value="'+escHTML(fmtMXN(parseFloat(data.precio)||0))+'"></td>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:#7a6840;">'+fechaHora+'</td>'
      + '<td></td>';
  } else {
    tr.innerHTML =
        '<td><textarea class="ce-concepto concepto-ta" rows="1" placeholder="Escribe el concepto...">'+escHTML((data&&data.concepto)||'')+'</textarea></td>'
      + '<td><textarea class="ce-descripcion concepto-ta" rows="1" placeholder="Descripci\u00f3n">'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td style="vertical-align:top">'
      +   '<input type="text" class="ce-precio price-input" placeholder="0.00" inputmode="decimal" value="'+escHTML(String((data&&data.precio)||''))+'" oninput="formatPrecio(this);recalcularResumenActualizacion()">'
      + '</td>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:#7a6840;">'+fechaHora+'</td>'
      + '<td><button class="del-concept" onclick="quitarCostoExtra(\''+id+'\')">✕</button></td>';
  }
  tbody.appendChild(tr);
  recalcularResumenActualizacion();
}

function toggleCeLiquidado(id){ /* eliminado: ya no se usa el modo liquidar-al-momento */ }

function getCostosExtra(){
  const filas = document.querySelectorAll('#costos-extra-tbody tr');
  return Array.from(filas).map(tr => {
    const liquidadoAlMomento = false;
    const montoLiquidado = 0;
    return {
      concepto:            tr.querySelector('.ce-concepto').value || '',
      descripcion:         tr.querySelector('.ce-descripcion').value || '',
      precio:              String(parsePrecio(tr.querySelector('.ce-precio').value)),
      fechaHora:           tr.dataset.fechaHora || '',
      locked:              tr.dataset.locked === '1',
      folioLetra:          tr.dataset.folioLetra || '',
      liquidadoAlMomento:  liquidadoAlMomento,
      montoLiquidado:      montoLiquidado
    };
  }).filter(c => c.concepto || parseFloat(c.precio) > 0);
}

function agregarPagoParcial(data){
  pagoParcialCount++;
  const id = 'pp'+pagoParcialCount;
  const tbody = document.getElementById('pagos-parciales-tbody');
  const tr = document.createElement('tr'); tr.id = 'pago-parcial-row-'+id;
  const isLocked   = !!(data && data.locked);
  const isExisting = !!(data && data.fechaHora);
  const fechaHora  = isExisting ? data.fechaHora : nuevaFechaHoraStr();
  const concepto   = (data && data.concepto) || 'Abon\u00f3';
  // Propagar marca de "auth inline" para que al releer no se duplique fecha
  const hasAuthInline = !!(data && data._hasAuthInline);
  // \u26a0\ufe0f FIX (editar folio secundario desde admin): adem\u00e1s del modo retro normal
  // (fila NUEVA, fecha/hora en blanco), data.fechaEditable fuerza los mismos
  // inputs de fecha/hora para una fila YA EXISTENTE \u2014 para poder corregir el
  // pago de la versi\u00f3n que se est\u00e1 editando, no solo agregar uno nuevo.
  const forzarFechaEditable = !!(data && data.fechaEditable);
  const _fechaExistenteParsed = (forzarFechaEditable && isExisting) ? _ppParsearFechaHoraExistente(data.fechaHora) : null;
  // Modo retro cl\u00e1sico: solo para filas NUEVAS (no locked, no cargadas del historial)
  const retroActivo = !isLocked && !isExisting && !!window._reciboRetroactivoActivo;
  const mostrarInputsFecha = !isLocked && (retroActivo || forzarFechaEditable);
  const retroFecha  = mostrarInputsFecha
    ? ((_fechaExistenteParsed && _fechaExistenteParsed.fecha) || (retroActivo && window._reciboRetroactivoFechaPersonalizada) || fechaCDMX_ISO())
    : fechaCDMX_ISO();
  const retroHora   = mostrarInputsFecha
    ? ((_fechaExistenteParsed && _fechaExistenteParsed.hora) || (retroActivo && window._reciboRetroactivoHoraPersonalizada) || horaCDMX_HHMM())
    : horaCDMX_HHMM();
  tr.dataset.fechaHora = mostrarInputsFecha ? (retroFecha + ' ' + retroHora) : fechaHora;
  if(isLocked) tr.dataset.locked = '1';
  if(hasAuthInline) tr.dataset.hasAuthInline = '1';
  // Preservar la letra de ORIGEN real del abono (ver misma nota en agregarCostoExtra).
  tr.dataset.folioLetra = (data && data.folioLetra) || '';
  if(isLocked){
    // Fila completamente bloqueada (anticipo original o pagos ya impresos).
    // A petición expresa: esta tabla ("PAGO REGISTRADO EN ESTE RECIBO") debe
    // mostrar SOLO el pago que se está registrando AHORA, no el historial
    // general de abonos del folio (eso ya se puede consultar en la Ficha del
    // Folio). El renglón sigue existiendo en el DOM — oculto, no eliminado —
    // porque getPagosParciales() lee estas filas al guardar y necesita seguir
    // arrastrando el historial completo hacia la siguiente versión del
    // recibo; lo único que cambia es que ya no se le muestra al usuario.
    tr.classList.add('pp-row-locked');
    tr.style.display = 'none';
    tr.innerHTML =
        '<td><textarea class="pp-concepto concepto-ta pp-concepto-fijo" rows="1" readonly>'+escHTML(concepto)+'</textarea></td>'
      + '<td><textarea class="pp-descripcion concepto-ta pp-locked-field" rows="1" readonly>'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td><input type="text" class="pp-cantidad price-input pp-locked-field" readonly value="'+escHTML(fmtMXN(parseFloat(data.cantidad)||0))+'"></td>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:#7a6840;">'+fechaHora+'</td>'
      + '<td></td>';
  } else if(mostrarInputsFecha){
    // A petici\u00f3n expresa: esta fecha/hora YA NO se edita a mano por fila \u2014
    // debe ser siempre un espejo de la fecha/hora MAESTRA del encabezado
    // ("FECHA DEL RECIBO" / "HORA DE GENERACI\u00d3N", la que responde al modo
    // RETRO). Se muestra como texto de solo lectura, y se mantiene
    // sincronizada por _sincronizarFechaHoraMaestraPagos() \u2014 llamada al
    // cargar el formulario y cada vez que se aplica una fecha retroactiva.
    var _ddmmyyyy = retroFecha.split('-').reverse().join('/');
    tr.classList.add('pp-fecha-sincronizada');
    tr.innerHTML =
        '<td><textarea class="pp-concepto concepto-ta pp-concepto-fijo" rows="1" readonly>'+escHTML(concepto)+'</textarea></td>'
      + '<td><textarea class="pp-descripcion concepto-ta" rows="1" placeholder="\u00bfPor qu\u00e9 se hizo este pago?">'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td><input type="text" class="pp-cantidad price-input" placeholder="0.00" inputmode="decimal" value="'+escHTML(String((data&&data.cantidad)||''))+'" oninput="formatPrecio(this);recalcularResumenActualizacion()"></td>'
      + '<td class="pp-fecha-master" style="font-family:\'DM Mono\',monospace;font-size:0.7rem;color:#8b5cf6;font-weight:700;" title="Sincronizada con la fecha del encabezado (RETRO)">'+escHTML(_ddmmyyyy+' '+retroHora+' hrs.')+'</td>'
      + '<td><button class="del-concept" onclick="quitarPagoParcial(\''+id+'\')">\u2715</button></td>';
  } else {
    // Fila editable normal \u2014 fecha/hora autom\u00e1tica
    tr.innerHTML =
        '<td><textarea class="pp-concepto concepto-ta pp-concepto-fijo" rows="1" readonly>'+escHTML(concepto)+'</textarea></td>'
      + '<td><textarea class="pp-descripcion concepto-ta" rows="1" placeholder="\u00bfPor qu\u00e9 se hizo este pago?">'+escHTML((data&&data.descripcion)||'')+'</textarea></td>'
      + '<td><input type="text" class="pp-cantidad price-input" placeholder="0.00" inputmode="decimal" value="'+escHTML(String((data&&data.cantidad)||''))+'" oninput="formatPrecio(this);recalcularResumenActualizacion()"></td>'
      + '<td style="font-family:\'DM Mono\',monospace;font-size:0.72rem;color:#7a6840;">'+fechaHora+'</td>'
      + '<td><button class="del-concept" onclick="quitarPagoParcial(\''+id+'\')">\u2715</button></td>';
  }
  tbody.appendChild(tr);
  recalcularResumenActualizacion();
}

function quitarPagoParcial(id){
  const r = document.getElementById('pago-parcial-row-'+id);
  if(!r) return;
  const btn = r.querySelector('.del-concept');
  if(r.dataset.oculto === '1'){
    r.dataset.oculto = '0';
    r.querySelectorAll('td:not(:last-child)').forEach(td => td.style.display = '');
    if(btn){ btn.textContent = '\u2715'; btn.title = 'Ocultar'; btn.style.color = ''; }
  } else {
    r.dataset.oculto = '1';
    r.querySelectorAll('td:not(:last-child)').forEach(td => td.style.display = 'none');
    if(btn){ btn.textContent = '+'; btn.title = 'Mostrar'; btn.style.color = 'var(--verde)'; }
  }
  recalcularResumenActualizacion();
}

function _sincronizarFechaHoraMaestraPagos(){
  // GUARDIA (caso real: folio 101 — el pago de liquidación de $7,700 quedó
  // fechado 29/jun/2026 13:41 en vez de la fecha real del cobro, 16/ago/2026,
  // porque esta función se llama en CUALQUIER actualización de recibo, no solo
  // en modo RETRO. #fecha_recibo/#hora_recibo son el encabezado "FECHA DEL
  // RECIBO", que SIEMPRE muestra la fecha ORIGINAL de creación del folio (por
  // diseño, para que A/B/C impriman el mismo encabezado) — NO la fecha de hoy.
  // Sin esta guardia, cualquier pago nuevo (Pago Total/Parcial) en un folio
  // viejo se estampaba silenciosamente con la fecha de creación del folio en
  // vez de la fecha real del cobro. Esta función solo debe actuar cuando el
  // modo retroactivo está deliberadamente activo (el usuario eligió una fecha
  // retro a propósito) — en cualquier otro caso no debe tocar las filas.
  if(!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada)) return;
  var fEl = document.getElementById('fecha_recibo');
  var hEl = document.getElementById('hora_recibo');
  var fechaMaestra = fEl ? fEl.value : '';
  var horaMaestra  = hEl ? hEl.value : '';
  if(!fechaMaestra) return;
  var ddmmyyyy = fechaMaestra.split('-').reverse().join('/');
  // FIX (caso real: Liquidación Total retroactiva registrada con la fecha de
  // HOY en Contabilidad, pese a que el recibo mostraba la fecha correcta):
  // antes esto solo sincronizaba filas YA marcadas .pp-fecha-sincronizada —
  // es decir, filas creadas DESPUÉS de activar el modo RETRO. Si el usuario
  // primero abre "Pago Total" (que agrega la fila "Liquidación total" de
  // inmediato, con la fecha/hora real de ESE momento) y RECIÉN DESPUÉS
  // activa RETRO, esa fila nunca tuvo la clase y se queda huérfana para
  // siempre con la fecha real de creación — ni esta función ni ninguna otra
  // la vuelve a tocar, aunque el encabezado del recibo sí cambie. Esa fecha
  // real (hoy) terminaba impresa en "PAGO REGISTRADO EN ESTE RECIBO" y de ahí
  // se "anclaba" también el movimiento de Contabilidad. Ahora se sincroniza
  // CUALQUIER fila no bloqueada (no solo las ya marcadas) — mismo criterio
  // que ya usa el sync de Servicio Complementario un poco más abajo en
  // confirmarFechaRetro() — así la fecha/hora maestra del encabezado es de
  // verdad la única fuente de verdad, sin importar en qué orden se activó
  // RETRO respecto a cuándo se creó la fila.
  document.querySelectorAll('#pagos-parciales-tbody tr').forEach(function(tr){
    if(tr.dataset.locked === '1') return;
    tr.classList.add('pp-fecha-sincronizada');
    tr.dataset.fechaHora = fechaMaestra + ' ' + horaMaestra;
    var celda = tr.querySelector('.pp-fecha-master');
    if(celda){
      celda.textContent = ddmmyyyy + ' ' + horaMaestra + ' hrs.';
    } else {
      // Fila que nació en modo "normal" (retro aún no estaba activo): su 4ª
      // celda es un <td> de texto plano, no la celda .pp-fecha-master de las
      // filas nacidas ya en retro — se actualiza directamente y se le da el
      // mismo estilo/título, para que quede igual y no vuelva a desincronizarse.
      var tds = tr.querySelectorAll('td');
      var celdaFecha = tds[3];
      if(celdaFecha && !celdaFecha.querySelector('input,textarea')){
        celdaFecha.classList.add('pp-fecha-master');
        celdaFecha.style.color = '#8b5cf6';
        celdaFecha.style.fontWeight = '700';
        celdaFecha.title = 'Sincronizada con la fecha del encabezado (RETRO)';
        celdaFecha.textContent = ddmmyyyy + ' ' + horaMaestra + ' hrs.';
      }
    }
  });
  if(typeof _actualizarTextoConformidad === 'function') _actualizarTextoConformidad(fechaMaestra);
}

function getPagosParciales(){
  const filas = document.querySelectorAll('#pagos-parciales-tbody tr');
  return Array.from(filas).map(tr => ({
    concepto:    tr.querySelector('.pp-concepto').value || 'Abon\u00f3',
    descripcion: tr.querySelector('.pp-descripcion').value || '',
    cantidad:    String(parsePrecio(tr.querySelector('.pp-cantidad').value)),
    fechaHora:   tr.dataset.fechaHora || '',
    locked:      tr.dataset.locked === '1',
    folioLetra:  tr.dataset.folioLetra || '',
    _hasAuthInline: tr.dataset.hasAuthInline === '1'
  })).filter(p => parseFloat(p.cantidad) > 0);
}

function actualizarHoraDisplay(){
  if(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada) return;
  var horaActual = (typeof horaCDMX_HHMM === 'function') ? horaCDMX_HHMM() : new Date().toTimeString().slice(0,5);
  var inp = document.getElementById('hora_recibo');
  var disp = document.getElementById('hora_recibo_display');
  if(inp)  inp.value = horaActual;
  if(disp) disp.textContent = horaActual + ' hrs.';
  if(typeof toast === 'function') toast('🕐 Hora actualizada: ' + horaActual + ' hrs.', 'ok');
}

function recalcularResumenActualizacion(){
  if(!reciboEnActualizacion) return;
  const totalOriginal = parseFloat(reciboEnActualizacion.total) || 0;
  // Solo costos NUEVOS (no locked) — recibo.total ya incluye los de versiones anteriores
  // Solo costos NUEVOS — exacto=precio==monto (independiente); parcial/exceso=suma a deuda
  const _costosExtraNuevos = getCostosExtra().filter(c => c.locked !== true);
  // Todos los costos extra siempre suman al total (no hay "liquidado al momento")
  const sumaCostosExtra = _costosExtraNuevos
    .reduce((s,c)=>s+(parseFloat(c.precio)||0), 0);
  const sumaAbonosImplicitos = 0;
  const sumaLiquidadosAhora = 0;
  const todosLosPagos = getPagosParciales();
  const _abonosPP = todosLosPagos
    .filter(p => p.locked !== true)
    .reduce((s,p)=>s+(parseFloat(p.cantidad)||0), 0);
  // El campo anticipo es el pago recibido en esta sesion — leerlo siempre
  const _antEl = $('anticipo');
  const _antManual = (_antEl && !_antEl.dataset.programmatic)
    ? (parsePrecio(_antEl.value)||0) : 0;
  const sumaAbonosNuevos = _abonosPP > 0 ? _abonosPP : _antManual;
  // En modo Sin Costo Total Pactado (juicio/escritura abierto) el complementario NUNCA
  // se auto-cubre: el folio no se liquida por saldo, así que el complementario debe
  // sumar como cargo real (de lo contrario la suma se anularía a $0).
  const _esAbiertoRes = (typeof window._abiertoSinCosto==='function') && window._abiertoSinCosto(reciboEnActualizacion);
  // El saldo anterior: en modo normal, reciboEnActualizacion.saldoPendiente ya refleja
  // todos los pagos previos (anticipo + abonos ya guardados). En Sin Costo Total
  // Pactado ese campo NO se mantiene actualizado — el adeudo real se calcula igual
  // que en el PDF y en los botones Pago Parcial/Total: a partir de los Servicios
  // Complementarios pendientes menos lo ya abonado. Así la vista previa que ve el
  // cajero SIEMPRE coincide con lo que el PDF va a imprimir.
  const saldoAnterior = _esAbiertoRes
    ? ((typeof window._adeudoServicioComplementario==='function') ? window._adeudoServicioComplementario(reciboEnActualizacion).total : 0)
    : (parseFloat(reciboEnActualizacion.saldoPendiente) || 0);
  const totalGeneral = totalOriginal + sumaCostosExtra;
  // PAGO TOTAL: el complementario se paga en el momento (sigue el flujo del folio).
  // NO se mete en la fila de liquidación; solo se cuenta como cubierto para que el
  // folio quede en ceros. En PAGO PARCIAL el complementario se suma a la deuda (igual que antes).
  const _esPagoTotalRes = document.body.classList.contains('desde-liquidacion') || !!reciboEnActualizacion._esPagoTotal;
  const _compCubierto = (_esPagoTotalRes && !_esAbiertoRes) ? sumaCostosExtra : 0;
  const _abonoTotalSesion = sumaAbonosNuevos + _compCubierto;
  // El nuevo saldo = saldo anterior + costos nuevos - abonos (en pago total el complementario va como cubierto)
  const nuevoSaldo = Math.max(0, saldoAnterior + sumaCostosExtra - _abonoTotalSesion);
  const totalAbonado = totalGeneral - nuevoSaldo;
  const box = document.getElementById('resumen-pagos-parciales');
  box.style.display = '';
  if (_esAbiertoRes) {
    // Modo Sin Costo Total Pactado: el recuadro encabeza con ADEUDO ANTERIOR
    // (deuda acumulada del folio), suma el servicio nuevo y todo se totaliza.
    // El cliente abona todo o una parte sin desglosar qué cubre.
    var _hayAdeudoPrev = (parseFloat(saldoAnterior)||0) > 0;
    box.innerHTML =
        '<div style="display:grid;grid-template-columns:1fr auto;gap:4px 14px;">'
      + (_hayAdeudoPrev
          ? '<span style="font-weight:700;">ADEUDO ANTERIOR:</span><span style="text-align:right;font-weight:700;">$'+fmtMXN(saldoAnterior)+'</span>'
          : '')
      + (sumaCostosExtra > 0
          ? '<span style="color:#a05010;">'+(_hayAdeudoPrev?'+ ':'')+'Servicio complementario:</span><span style="text-align:right;color:#a05010;">$'+fmtMXN(sumaCostosExtra)+'</span>'
          : '')
      + '<span style="font-weight:700;border-top:1px solid #c0dba8;padding-top:4px;">'+(_hayAdeudoPrev?'TOTAL A PAGAR:':'TOTAL:')+'</span>'
      + '<span style="text-align:right;font-weight:700;border-top:1px solid #c0dba8;padding-top:4px;">$'+fmtMXN(saldoAnterior + sumaCostosExtra)+'</span>'
      + (_abonoTotalSesion > 0
          ? '<span style="font-weight:700;color:#2a7a3a;">\u2212 Abono:</span><span style="text-align:right;font-weight:700;color:#2a7a3a;">$'+fmtMXN(_abonoTotalSesion)+'</span>'
          : '')
      + '<span style="border-top:1.5px solid #2a7a3a;padding-top:5px;font-weight:700;font-size:0.95rem;">SALDO RESTANTE (RESTA):</span>'
      + '<span style="border-top:1.5px solid #2a7a3a;padding-top:5px;text-align:right;font-weight:700;font-size:1rem;color:'+(nuevoSaldo>0?'#b01010':'#2a7a3a')+'">$'+fmtMXN(nuevoSaldo)+'</span>'
      + '</div>';
  } else {
  box.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr auto;gap:4px 14px;">'
    + '<span>Total tr\u00e1mite original:</span><span style="text-align:right">$'+fmtMXN(totalOriginal)+'</span>'
    + (sumaCostosExtra > 0
        ? '<span>+ Servicios complementarios:</span><span style="text-align:right;color:#a05010">$'+fmtMXN(sumaCostosExtra)+'</span>'
          + '<span style="font-weight:700;border-top:1px solid #c0dba8;padding-top:4px;">TOTAL ACTUALIZADO:</span>'
          + '<span style="text-align:right;font-weight:700;border-top:1px solid #c0dba8;padding-top:4px;">$'+fmtMXN(totalGeneral)+'</span>'
        : '')
    + '<span style="color:#a05010;">'+(sumaCostosExtra>0?'Saldo actualizado (resta):':'Saldo anterior (resta):')+'</span><span style="text-align:right;color:#a05010;">$'+fmtMXN(saldoAnterior+(sumaCostosExtra>0?sumaCostosExtra:0))+'</span>'
    + (_abonoTotalSesion > 0
        ? '<span style="font-weight:700;color:#2a7a3a;">\u2212 Nuevo abono:</span><span style="text-align:right;font-weight:700;color:#2a7a3a;">$'+fmtMXN(_abonoTotalSesion)+'</span>'
        : '')

    + '<span style="border-top:1.5px solid #2a7a3a;padding-top:5px;font-weight:700;font-size:0.95rem;">SALDO RESTANTE (RESTA):</span>'
    + '<span style="border-top:1.5px solid #2a7a3a;padding-top:5px;text-align:right;font-weight:700;font-size:1rem;color:'+(nuevoSaldo>0?'#b01010':'#2a7a3a')+'">$'+fmtMXN(nuevoSaldo)+'</span>'
    + '</div>';
  }
  // Sincronizar cuadro dorado derecha
  // En modo actualización el cuadro muestra SOLO esta operación:
  // Total    = saldo pendiente + costos nuevos de esta sesión (lo que se debe ahora)
  // Anticipo = abono nuevo de esta sesión (lo que se cobra ahora)
  // Resta    = lo que sigue pendiente después de esta operación
  const totalDisp = document.getElementById('total-display');
  const restaDisp = document.getElementById('resta-display');
  const antInput  = $('anticipo');
  const totalEstaOperacion = saldoAnterior + sumaCostosExtra;
  const _labelTotal = totalDisp ? totalDisp.previousElementSibling : null;
  if(_labelTotal && _labelTotal.tagName === 'LABEL'){
    // Mostrar 'Total Restante' en cualquier modo actualización (no solo pago total)
    // porque siempre muestra lo que se debe en esta sesión, no el total histórico
    _labelTotal.textContent = 'Total Restante';
  }
  if(totalDisp) totalDisp.textContent = '$'+fmtMXN(totalEstaOperacion);
  if(restaDisp) restaDisp.textContent = '$'+fmtMXN(nuevoSaldo);
  if(antInput){
    // Si un pago parcial maneja el abono, Anticipo es solo display: bloquearlo para
    // que no se escriba un valor que el cálculo ignora (causaba el cuadro contradictorio).
    antInput.readOnly = (_abonosPP > 0);
    // Solo sincronizar el campo si NO tiene foco (el usuario no está escribiendo)
    // y si el valor no fue ya capturado manualmente por el usuario
    if(document.activeElement !== antInput){
      antInput.dataset.programmatic = '1';
      antInput.value = fmtMXN(_abonoTotalSesion);
      delete antInput.dataset.programmatic;
    }
  }
  // ── SALDO RESTANTE (vista previa editable) ──────────────────────────────
  // Aplica a actualizaciones B,C,D… de Costo Total Pactado, CON o SIN
  // Servicio Complementario. Con Servicio Complementario (getCostosExtra()
  // con datos), el monto mostrado es el adeudo que se arrastraba ANTES de
  // este recibo — SIN el costo del Servicio Complementario nuevo, que ya
  // se ve por separado en su propia sección — y el texto por defecto
  // siempre es "ADEUDO ANTERIOR" (misma simplificación que usa generarPDF()
  // para este caso). Sin Servicio Complementario, se conserva la lógica
  // previa (LIQUIDACIÓN TOTAL / ADEUDO ANTERIOR / concepto original). No
  // aplica en modo Sin Costo Total Pactado (_esAbiertoRes), que tiene su
  // propia sección "SUMA TOTAL DE ADEUDOS"/"PAGOS REALIZADOS". Refleja
  // EXACTAMENTE la misma lógica que usa generarPDF(), sin tocar el
  // concepto/precio original (que sigue siendo la fuente real del total).
  // Si el usuario ya editó el texto a mano (dataset.manualEdit), no se
  // sobreescribe en los recálculos siguientes.
  const _seccionSaldoRestCP = document.getElementById('seccion-saldo-restante-cp');
  if(_seccionSaldoRestCP){
    const _hayCEEnEsteRes = getCostosExtra().length > 0;
    if(_esAbiertoRes || (_hayCEEnEsteRes && saldoAnterior <= 0.005)){
      _seccionSaldoRestCP.style.display = 'none';
    } else {
      _seccionSaldoRestCP.style.display = '';
      const elCptoSR = document.getElementById('sr-cp-concepto');
      const elValSR  = document.getElementById('sr-cp-valor');
      if(elValSR) elValSR.value = '$'+fmtMXN(saldoAnterior);
      // A petición expresa: el CONCEPTO ya no depende de qué pasó en este
      // recibo (antes variaba entre "ADEUDO ANTERIOR"/"LIQUIDACIÓN TOTAL"/el
      // concepto original según el caso) — ahora es SIEMPRE el/los concepto(s)
      // originales del folio A, permanentes, unificados en un solo renglón
      // si el trámite original tenía varios. Mismo criterio que generarPDF().
      if(elCptoSR){
        const _conceptosOrigRes = (reciboEnActualizacion.conceptos || []).filter(c => c.concepto || c.precio);
        const _nombresRes = _conceptosOrigRes.map(c => c.concepto).filter(Boolean);
        elCptoSR.value = _nombresRes.length ? _nombresRes.join('; ') : 'ADEUDO ANTERIOR';
      }
    }
  }
}

async function imprimirActualizacion(){
  // ── GUARDIA DE SESIÓN ─────────────────────────────────────────────
  if(!sbSession || Date.now() >= sbExpiry){
    window._desactivarRegistrandoRecibo();
    mostrarDriveOverlay('imprimirActualizacion');
    return;
  }
  // Validaciones rápidas antes de pedir confirmación
  // Restaurar desde respaldo si la variable fue anulada por algun reset interno
  if(!reciboEnActualizacion && window._reciboActualizacionBackup){
    reciboEnActualizacion = window._reciboActualizacionBackup;
  }
  if(!reciboEnActualizacion){ window._desactivarRegistrandoRecibo(); showModal('Error','No hay un recibo en actualizaci\u00f3n.'); return; }
  // Validar con fecha de HOY (fecha del pago nuevo), no la del recibo original.
  // El recibo puede ser anterior al corte de caja pero el abono se registra hoy.
  const _retroAct2 = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  const _fechaVal  = _retroAct2 ? window._reciboRetroactivoFechaPersonalizada : (typeof fechaCDMX_ISO==='function' ? fechaCDMX_ISO() : new Date().toISOString().slice(0,10));
  const _horaVal   = _retroAct2 ? (window._reciboRetroactivoHoraPersonalizada||'00:00') : (typeof horaCDMX_HHMM==='function' ? horaCDMX_HHMM() : '00:00');
  if(esPeriodoCerrado(_fechaVal, _horaVal)){
    toast(_msgPeriodoCerrado(), 'err'); return;
  }
  const _costosExtraTmp = getCostosExtra();
  const _pagosTmp       = getPagosParciales();
  const _abonosNuevosTmp = _pagosTmp.filter(p => p.locked !== true);
  if(!_costosExtraTmp.length && !_abonosNuevosTmp.length){
    showModal('Sin cambios','Agrega al menos un servicio complementario o un abono nuevo antes de imprimir.');
    return;
  }
  // Todas las validaciones pasaron: activar flag justo antes de confirmar.
  // Si el usuario cancela el modal de confirmacion, desactivar el flag.
  window._activarRegistrandoRecibo();
  abrirConfirmacionRecibo({
    onAceptar:  () => { _imprimirActualizacionReal(); },
    onCancelar: () => { window._desactivarRegistrandoRecibo(); }
  });
}

async function _imprimirActualizacionReal(){
  // ── GUARDIA DE SESIÓN ─────────────────────────────────────────────
  if(!sbSession || Date.now() >= sbExpiry){
    window._desactivarRegistrandoRecibo();
    mostrarDriveOverlay('imprimirActualizacion');
    return;
  }
  console.log('[ACTUALIZACION] Click en IMPRIMIR ACTUALIZACIÓN — flujo:', document.body.classList.contains('desde-liquidacion') ? 'PAGO TOTAL' : 'PAGO PARCIAL');
  // Restaurar desde respaldo si la variable fue anulada por algun reset interno
  if(!reciboEnActualizacion && window._reciboActualizacionBackup){
    reciboEnActualizacion = window._reciboActualizacionBackup;
  }
  if(!reciboEnActualizacion){ showModal('Error','No hay un recibo en actualizaci\u00f3n.'); return; }
  const recibo = reciboEnActualizacion;
  const costosExtra = getCostosExtra();
  const pagosParciales = getPagosParciales();
  // ── SÍNTESIS DE ABONO DEL CAMPO ANTICIPO ──────────────────────────
  // En el flujo de Servicio Complementario el abono se captura en el campo
  // "Anticipo" (cuadro dorado), no como fila de pago parcial. Si no hay pago
  // parcial nuevo pero el campo Anticipo trae monto, se convierte aquí en un
  // pago parcial real para que se ACUMULE en las versiones siguientes (p.ej.
  // 56C/56D), aparezca en el recibo y en el historial, y se registre en
  // contabilidad — igual que cualquier abono. La versión guarda su anticipo
  // original por separado, así que esto NO duplica el monto.
  (function(){
    var _ppNuevosSint = pagosParciales.filter(function(p){ return p.locked !== true; });
    var _antValSint = (typeof parsePrecio==='function' ? parsePrecio((($('anticipo')||{}).value)||'0') : 0) || 0;
    if(_ppNuevosSint.length === 0 && _antValSint > 0){
      pagosParciales.push({
        concepto: 'Abon\u00f3',
        descripcion: 'Abono del tr\u00e1mite',
        cantidad: String(_antValSint),
        fechaHora: (typeof nuevaFechaHoraStr==='function' ? nuevaFechaHoraStr() : ''),
        locked: false,
        _hasAuthInline: false
      });
    }
  })();
  const abonosNuevos = pagosParciales.filter(p => p.locked !== true);
  if(!costosExtra.length && !abonosNuevos.length){
    window._desactivarRegistrandoRecibo();
    showModal('Sin cambios','Agrega al menos un servicio complementario o un abono nuevo antes de imprimir.');
    return;
  }
  // Autorización capturada al iniciar el flujo. Si se perdió (flujo retomado
  // tras reconexión de sesión), pedirla ahora antes de continuar.
  let autorizacion = window._autorizacionActual || null;
  window._autorizacionActual = null;
  if(!autorizacion){
    autorizacion = await pedirAutorizacion();
    if(autorizacion === null){
      window._desactivarRegistrandoRecibo();
      setStatus('ok','Impresión cancelada — autorización no proporcionada','ok');
      return;
    }
  }
  // Modal de placas: cuando se cumplen las DOS condiciones:
  //  1. Trámite vehicular
  //  2. Pago Total (liquidación)
  // Se eliminó la condición de "día anterior": el modal ahora aparece también
  // cuando se liquida el mismo día. Si las placas aún no existen, se puede usar
  // "⏭ No hay placas aún" para omitir y capturarlas después desde Editar Recibo.
  // (esDeDiaAnterior se conserva solo para el log de diagnóstico.)
  let _placasCapturadas;
  const esVehicular     = (recibo.tipoTramite === 'vehicular');
  const esPagoTotal     = document.body.classList.contains('desde-liquidacion') || !!(recibo._esPagoTotal) || !!window._flujoEsPagoTotal;
  const _hoyStr         = typeof hoy === 'function' ? hoy() : new Date().toISOString().slice(0,10);
  const _fechaOrig      = (recibo.fecha || recibo.fecha_recibo || '').slice(0,10);
  const esDeDiaAnterior = !!(_fechaOrig && _fechaOrig < _hoyStr);
  console.log('[PLACAS] esVehicular:', esVehicular, '| esPagoTotal:', esPagoTotal, '| esDeDiaAnterior:', esDeDiaAnterior, '| fechaOrig:', _fechaOrig, '| hoy:', _hoyStr, '| _esPagoTotal en recibo:', recibo._esPagoTotal);
  if(esVehicular && esPagoTotal){
    const resultado = await pedirDatosPlacas();
    if(resultado === null){
      window._desactivarRegistrandoRecibo();
      setStatus('ok','Impresión cancelada — modal de placas cerrado','ok');
      return;
    }
    _placasCapturadas = { placas: resultado.placas, estado: resultado.estado };
  } else {
    // Pago Parcial, mismo día o no vehicular: conservar placas ya guardadas
    _placasCapturadas = { placas: recibo.placasEntregadas || null, estado: recibo.estadoPlacas || null };
  }
  window._flujoEsPagoTotal = false; // limpiar flag tras captura de placas
  // Bloquear "Imprimir Actualización"/"Cancelar" y mostrar overlay — de aquí en
  // adelante es puro trabajo async (generar PDF, subir, guardar); sin este bloqueo
  // el botón seguía disponible y permitía dar clic varias veces de más mientras
  // el sistema ya estaba procesando la primera solicitud.
  const _btnImprimirAct2 = document.getElementById('btn-imprimir-actualizacion');
  const _btnCancelarAct2 = document.getElementById('btn-cancelar-actualizacion');
  window._mostrarGenerandoPDF([_btnImprimirAct2, _btnCancelarAct2], 'Generando PDF…');
  setStatus('loading','Generando PDF actualizado...','loading');
  // Re-verificar hora con Drive en background (no bloquea)
  sincronizarHoraCDMX().catch((e)=>{ registrarError('Promise catch vacio', e); });
  const totalOriginal = parseFloat(recibo.total) || 0;
  const anticipoOriginal = parseFloat(recibo.anticipo) || 0;
  // Solo costos NUEVOS (no locked) — recibo.total ya incluye los de versiones anteriores
  // Separar complementarios: exacto(precio==monto)=independiente; parcial/exceso=suma a deuda
  const _costosNuevos = costosExtra.filter(c => c.locked !== true);
  // Todos los costos extra siempre suman al total
  const sumaCostosExtra = _costosNuevos
    .reduce((s,c)=>s+(parseFloat(c.precio)||0), 0);
  const sumaAbonosImplicitos = 0;
  // Modo Sin Costo Total Pactado (abierto): NUNCA se auto-cubre — el folio no se
  // liquida por saldo, el complementario debe sumar como cargo real.
  const _esAbiertoImp = (typeof window._abiertoSinCosto==='function') && window._abiertoSinCosto(recibo);
  // Saldo anterior: en modo normal, recibo.saldoPendiente ya incluye el anticipo
  // original y todos los abonos anteriores. En Sin Costo Total Pactado se recalcula
  // con la MISMA fuente de verdad que usan el PDF, la vista previa en pantalla y los
  // botones Pago Parcial/Total (Servicios Complementarios pendientes menos lo ya
  // abonado) — así lo que se guarda en el folio nunca se desincroniza de lo impreso.
  const _adeudoSCImp = (_esAbiertoImp && typeof window._adeudoServicioComplementario==='function')
    ? window._adeudoServicioComplementario(recibo) : null;
  const saldoAnterior = _esAbiertoImp
    ? (_adeudoSCImp ? _adeudoSCImp.total : 0)
    : (parseFloat(recibo.saldoPendiente) || 0);
  // ── GUARDRAIL (caso real: folio 12) ─────────────────────────────────────
  // El folio 12 quedó con saldoPendiente desincronizado de Contabilidad por una
  // corrupción de datos ajena a este flujo (mecanismo AUTO-PROTECTOR, ya
  // desactivado) y el recibo se imprimió con una cifra distinta a la realmente
  // cobrada, sin que nadie lo notara hasta que ScanSys lo detectó semanas
  // después. Este chequeo cruza ANTES de imprimir: si lo que el recibo CREE que
  // ya se cobró no coincide con lo que Contabilidad tiene registrado para este
  // folio, se avisa y se pide confirmación explícita antes de continuar.
  if(typeof D !== 'undefined' && Array.isArray(D.movimientos) && !_esAbiertoImp){
    const _tolGuard = 0.5;
    const _regHonGuard = D.movimientos
      .filter(m => m && !m.borrado && m.fuente === 'recibo' && Number(m.folio) === Number(recibo.folio) && (m.estatus||'') !== 'Complementario')
      .reduce((s,m) => s + (parseFloat(m.monto)||0), 0);
    const _esperadoGuard = totalOriginal - saldoAnterior; // lo que el recibo cree ya cobrado
    const _difGuard = _regHonGuard - _esperadoGuard;
    if(Math.abs(_difGuard) > _tolGuard){
      const _seguirGuard = confirm(
        '⚠ El saldo de este recibo no coincide con lo registrado en Contabilidad.\n\n' +
        'El recibo cree que ya se cobraron $' + _esperadoGuard.toFixed(2) + '.\n' +
        'Contabilidad tiene registrados $' + _regHonGuard.toFixed(2) + ' para este folio.\n' +
        'Diferencia: $' + _difGuard.toFixed(2) + '\n\n' +
        'Antes de continuar, verifica el folio en SCANSYS PRO → Diagnóstico de Folios.\n' +
        '¿Deseas continuar de todos modos?'
      );
      if(!_seguirGuard){
        window._desactivarRegistrandoRecibo();
        window._ocultarGenerandoPDF([_btnImprimirAct2, _btnCancelarAct2]);
        setStatus('ok','Impresión cancelada — revisa el folio en SCANSYS','ok');
        return;
      }
    }
  }
  const _abonosPPImp = pagosParciales
    .filter(p => p.locked !== true)
    .reduce((s,p)=>s+(parseFloat(p.cantidad)||0), 0);
  // Si no hay pagos parciales, leer el monto capturado en el campo anticipo (cuadro dorado)
  const _antValImp = parsePrecio(($('anticipo') || {}).value || '0') || 0;
  const sumaAbonosNuevos = _abonosPPImp > 0 ? _abonosPPImp : _antValImp;
  // En Sin Costo Total Pactado NO se encadena el .total guardado de la versión
  // anterior (esa fórmula es para trámites con total pactado) — se recalcula desde
  // el bruto acumulado real de servicios complementarios (deduplicado) más lo nuevo
  // de esta sesión, así el campo .total nunca se infla versión tras versión.
  const totalGeneral = _esAbiertoImp
    ? ((_adeudoSCImp ? _adeudoSCImp.bruto : 0) + sumaCostosExtra)
    : (totalOriginal + sumaCostosExtra);
  // PAGO TOTAL: el complementario se paga en el momento (cubierto), no deja saldo.
  // En PAGO PARCIAL se suma a la deuda como siempre.
  const _compCubiertoImp = (esPagoTotal && !_esAbiertoImp) ? sumaCostosExtra : 0;
  const saldoNuevo = Math.max(0, saldoAnterior + sumaCostosExtra - sumaAbonosNuevos - _compCubiertoImp);
  const totalAbonado = totalGeneral - saldoNuevo;
  const fechasImpresion = (recibo.fechasImpresion && recibo.fechasImpresion.length)
    ? recibo.fechasImpresion.slice()
    : [{ fecha: recibo.fecha || recibo.fecha_recibo || '', hora: recibo.hora || recibo.hora_recibo || '', etiqueta: 'Original' }];
  const _retroActivo = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  const _fechaActualizacion = _retroActivo ? window._reciboRetroactivoFechaPersonalizada : fechaCDMX_ISO();
  const _horaActualizacion  = _retroActivo ? (window._reciboRetroactivoHoraPersonalizada || horaCDMX_HHMM()) : horaCDMX_HHMM();
  fechasImpresion.push({
    fecha: _fechaActualizacion,
    hora:  _horaActualizacion,
    etiqueta: 'Actualizaci\u00f3n'
  });
  // Letra de esta versi\u00f3n: se toma la letra m\u00e1s alta ya existente y se avanza una posici\u00f3n.
  // Usar r.letra (campo inmutable guardado) como fuente de verdad, nunca fechasImpresion.
  // BLINDAJE 2026-07: no confiar SOLO en appData.recibos en memoria -- puede estar
  // desincronizado (pestana vieja, debounce de sync todavia sin bajar, etc.). Sin esto
  // la letra puede calcularse mal e incluso REPETIR una ya usada (caso real: folio 56,
  // se genero un movimiento etiquetado "C" cuando la letra maxima real ya era "G" y
  // debia tocar "H" -- la copia local en memoria estaba atrasada). Se cruza contra el
  // estado mas reciente de Supabase antes de decidir la siguiente letra; si la
  // verificacion falla (sin red, etc.) se sigue con la copia local como respaldo.
  const _letrasLocalPrevias = new Set((appData.recibos || [])
    .filter(_r => _r.folio === recibo.folio && !_r.esComplemento)
    .map(_r => (_r.letra || 'A').toUpperCase()));
  let _letrasSet = new Set(_letrasLocalPrevias);
  let _folioDesincronizado = false;
  try {
    if (window.SB && window.SB_DESPACHO_ID) {
      const _freshRes = await window.SB.from('app_state')
        .select('recibos').eq('despacho_id', window.SB_DESPACHO_ID).single();
      const _freshData = _freshRes && _freshRes.data;
      const _recFrescos = (_freshData && _freshData.recibos && _freshData.recibos.recibos) || [];
      _recFrescos
        .filter(_r => _r && _r.folio === recibo.folio && !_r.esComplemento)
        .forEach(_r => {
          const _lFresca = (_r.letra || 'A').toUpperCase();
          if (!_letrasLocalPrevias.has(_lFresca)) _folioDesincronizado = true;
          _letrasSet.add(_lFresca);
        });
    }
  } catch (eFresh) { console.warn('[letra fresca -- usando copia local]', eFresh); }
  // Si Supabase tiene letras de este folio que esta pantalla NO tenía cargadas, la copia
  // local está atrasada (pestaña vieja, otra sesión actualizó el folio mientras tanto).
  // Abortar en vez de seguir: no solo la letra podría calcularse mal, TODO lo demás que
  // lee `recibo` (costosExtra, pagosParciales, saldoPendiente...) también sería viejo.
  // Esto es lo que causó folio 56: un movimiento quedó etiquetado "C" en vez de "H"
  // porque la pantalla llevaba abierta desde antes de que existieran las letras C-G.
  if (_folioDesincronizado) {
    window._desactivarRegistrandoRecibo();
    window._ocultarGenerandoPDF([_btnImprimirAct2, _btnCancelarAct2]);
    showModal('Folio actualizado en otra sesión',
      'El folio #' + folioConLetra(recibo.folio, recibo.anio_folio, recibo.letra || 'A') +
      ' tiene versiones más recientes que esta pantalla no había cargado (se actualizó desde ' +
      'otra sesión, o esta pantalla lleva tiempo abierta). Para no registrar mal la letra o el ' +
      'monto, cierra esta pantalla, vuelve a abrir el folio desde cero y repite la actualización.');
    return;
  }
  const _letrasUsadas = [..._letrasSet].map(l => l.charCodeAt(0));
  // Fallback: si appData no tiene el recibo en memoria, usar recibo.letra como base
  // (evita _maxLetraCode=64 \u2192 letraActual='A' cuando deber\u00eda ser 'B' o superior)
  const _letraBaseCode = (recibo.letra || 'A').toUpperCase().charCodeAt(0);
  const _maxLetraCode = _letrasUsadas.length > 0 ? Math.max(..._letrasUsadas) : _letraBaseCode;
  const letraActual = String.fromCharCode(_maxLetraCode + 1);
  // Inyectar autorización en pagos NUEVOS (no bloqueados). Usamos guiones -fecha-
  // para no chocar con los corchetes [fechaHora] que el PDF agrega automáticamente.
  const pagosParciales_conAuth = pagosParciales.map(p => {
    if(p.locked) return p; // los ya impresos conservan su auth previa
    // En modo retro: priorizar la fecha capturada por fila (input editable);
    // si no viene (pago agregado sin retro activo), caer al retro global.
    const fechaHoraFinal = _retroActivo
      ? (p.fechaHora || _fechaActualizacion + ' ' + _horaActualizacion)
      : (p.fechaHora || '');
    const _vTagPP = ' ['+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+']';
    const authTag = _vTagPP + ' \u2014 Autoriz\u00f3: ' + autorizacion.iniciales + ' -' + fechaHoraFinal + '-';
    return Object.assign({}, p, {
      descripcion: (p.descripcion || '') + authTag,
      fechaHora: fechaHoraFinal || p.fechaHora,
      folioLetra: letraActual,
      _hasAuthInline: true
    });
  });
  // Sin Costo Total Pactado: la tabla en pantalla trae precargado (bloqueado) todo
  // lo ya guardado de la versión anterior, como referencia visual — pero el PDF de
  // ESTA transacción solo debe mostrar lo genuinamente NUEVO de esta sesión (el
  // cargo/abono que se agrega ahora). Lo anterior ya se muestra aparte en "ADEUDO
  // ANTERIOR". Sin este filtro, cada recibo repetía los cargos/abonos de todas las
  // versiones previas, inflando el total (folio 56, caso audiencia de pruebas +
  // audiencia de alegatos). Los trámites normales conservan el comportamiento previo.
  const _costosExtraParaPDF = _esAbiertoImp ? _costosNuevos : costosExtra;
  // "PAGO REGISTRADO EN ESTE RECIBO" (sección impresa) debe mostrar SOLO el
  // abono de ESTA transacción, nunca un historial acumulado — antes esto solo
  // se filtraba para Sin Costo Total Pactado; ahora aplica siempre, para todo
  // tipo de recibo (Costo Pactado, con o sin Servicio Complementario).
  const _pagosParcialesParaPDF = pagosParciales_conAuth.filter(p => !p.locked);
  // Texto de "Saldo Restante" (concepto/descripción) editado en pantalla — visible
  // tanto con como sin Servicio Complementario, siempre que NO sea Sin Costo Total
  // Pactado y haya algo que mostrar (ver recalcularResumenActualizacion). Si el
  // usuario lo dejó vacío o la sección no aplica, generarPDF() recalcula el mismo
  // default por su cuenta — esto solo sirve para respetar una edición manual.
  const _seccionSRImp = document.getElementById('seccion-saldo-restante-cp');
  const _srCptoImp = (_seccionSRImp && _seccionSRImp.style.display !== 'none') ? ($('sr-cp-concepto')||{}).value : '';
  const _srDescImp = (_seccionSRImp && _seccionSRImp.style.display !== 'none') ? ($('sr-cp-descripcion')||{}).value : '';
  const datos = {
    folio: recibo.folio,
    clientes: recibo.clientes || [{nombre:recibo.nombre,movil:'',tel:'',domicilio:''}],
    tramites: recibo.tramites || '',
    clase:recibo.clase, marca:recibo.marca, tipo_veh:recibo.tipo_veh, serie:recibo.serie,
    motor:recibo.motor, personas_veh:recibo.personas_veh, anio:recibo.anio, puertas:recibo.puertas,
    color_veh:recibo.color_veh, transmision:recibo.transmision,
    cilindros:recibo.cilindros, placa:recibo.placa, placaEstado:recibo.placaEstado||'',
    ultima_tenencia:recibo.ultima_tenencia, origen:recibo.origen, combustible:recibo.combustible,
    copias: recibo.copias || null,
    tipo_doc: recibo.tipo_doc || 'copia',
    tipoTramite: recibo.tipoTramite,
    modoCosto: recibo.modoCosto || '',
    fecha_recibo: recibo.fecha || recibo.fecha_recibo || '',
    hora_recibo:  recibo.hora || recibo.hora_recibo || '',
    anticipo: String(anticipoOriginal),
    responsable: recibo.responsable || $('responsable').value,
    nombre_cliente_firma: recibo.nombre_cliente_firma || '',
    conceptos: recibo.conceptos || [],
    costosExtra: _costosExtraParaPDF,
    pagosParciales: _pagosParcialesParaPDF,
    fechasImpresion,
    saldoAnterior,
    totalGeneral,
    totalAbonado,
    saldoNuevo,
    saldoRestanteConcepto:    _srCptoImp || '',
    saldoRestanteDescripcion: _srDescImp || '',
    placasEntregadas: _placasCapturadas.placas,
    estadoPlacas:     _placasCapturadas.estado,
    autorizacion: autorizacion,
    timestamp: ahoraCDMX().toISOString(),
    letra: letraActual,
    anio_folio: recibo.anio_folio || new Date().getFullYear()
  };
  try {
    const primerNombre = datos.clientes[0].nombre || recibo.nombre;
    const qrTexto = 'LEX-MEXICO|Folio:'+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+'|'+primerNombre+'|ACTUALIZADO|'+datos.timestamp;
    const qrDataURL = await qrToDataURL(qrTexto);
    const doc = await generarPDF(datos, recibo.folio, qrDataURL);
    const nombreArchivo = folioConLetra(recibo.folio, recibo.anio_folio, letraActual) + '.pdf';
    const _r2NombreAct  = _nombreArchivoR2(folioConLetra(recibo.folio, recibo.anio_folio, letraActual), primerNombre);
    // Subir como archivo nuevo (no sobrescribir la versión anterior)
    subirPDFaDrive(doc.output('blob'), nombreArchivo, _r2NombreAct).catch(e=>console.warn('SB upload version:',e));
    // Buscar el registro de la versión que se está actualizando (por folio + letra exacta)
    const letraOriginal = recibo.letra || letraVersion(recibo) || 'A';
    // Busqueda primaria: folio + letra exacta + no complemento
    let idx = appData.recibos.findIndex(r => r.folio === recibo.folio && !r.esComplemento && (r.letra || letraVersion(r) || 'A') === letraOriginal);
    // FALLBACK 1: misma letra sin importar esActualizacion
    if(idx < 0) idx = appData.recibos.findIndex(r => r.folio === recibo.folio && !r.esComplemento && (r.letra || 'A') === letraOriginal);
    // FALLBACK 2: cualquier registro del folio que no sea complemento (toma el mas reciente)
    if(idx < 0){
      const _candidatos = appData.recibos.map((r,i)=>({r,i})).filter(({r})=> r.folio === recibo.folio && !r.esComplemento);
      if(_candidatos.length > 0) idx = _candidatos[_candidatos.length - 1].i;
    }
    // FALLBACK 3: insertar como nuevo registro si definitivamente no existe
    if(idx < 0){
      console.warn('[LEX] findIndex fallback: recibo folio', recibo.folio, 'letra', letraOriginal, 'no encontrado en appData \u2014 insertando directamente');
      appData.recibos.push(Object.assign({}, recibo));
      idx = appData.recibos.length - 1;
    }
    if(idx >= 0){
      // ── Snapshot del registro anterior antes de crear la nueva versión ─────
      _guardarSnapshotRecibo(appData.recibos[idx], saldoNuevo<=0 ? 'Liquidación' : 'Abono parcial');
      // Crear un NUEVO registro independiente con la letra nueva (B, C, D…).
      // El registro original (A, B anterior, etc.) queda INTACTO en el historial.
      // CRÍTICO: usar pagosParciales_conAuth para que la autorización quede fija.
      const nuevoRegistro = Object.assign({}, appData.recibos[idx], {
        costosExtra:      costosExtra.map(c => Object.assign({}, c, {locked:true, folioLetra: c.folioLetra || letraActual})),
        // ⚠️ FIX: igual que costosExtra arriba — si un abono llega sin folioLetra
        // (dato viejo previo a esta corrección), se estampa aquí como respaldo.
        // Sin esto, el filtro de la Ficha del Folio (p.folioLetra||rletra) atribuye
        // el abono a TODAS las filas futuras sin letra propia, inflando el ABONÓ
        // de cada versión posterior (bug detectado en folio 6, fila 6C).
        pagosParciales:   pagosParciales_conAuth.map(p => Object.assign({}, p, {locked:true, folioLetra: p.folioLetra || letraActual})),
        copias:           appData.recibos[idx].copias,
        fechasImpresion:  fechasImpresion,
        total:            totalGeneral,
        saldoPendiente:   saldoNuevo,
        saldoNuevo:       saldoNuevo,
        totalAbonado:     totalAbonado,
        pdfBase64:        doc.output('datauristring'),
        archivo:          nombreArchivo,
        archivoR2:        _r2NombreAct,
        letra:            letraActual,
        placasEntregadas: _placasCapturadas.placas,
        estadoPlacas:     _placasCapturadas.estado,
        esActualizacion:  true,
        fechaActualizacion: _fechaActualizacion,
        horaActualizacion:  _horaActualizacion,
        // ⚠️ FIX (folio 115B y similares — "no conserva su fecha y horario
        // original, copia la referencia del folio A"): esta versión heredaba
        // fecha/hora del registro copiado (appData.recibos[idx], que puede ser
        // la A u otra versión anterior) porque no estaban en la lista de campos
        // sobreescritos abajo. fechaActualizacion/horaActualizacion arriba SÍ
        // se calculaban bien, pero fecha/hora/fecha_recibo/hora_recibo — los
        // campos que realmente se muestran en el panel de edición y en el PDF —
        // nunca se actualizaban. Ahora esta versión queda con SU propia fecha
        // y hora de generación (respeta fecha/hora retroactiva si aplica).
        fecha:            _fechaActualizacion,
        fecha_recibo:     _fechaActualizacion,
        hora:             _horaActualizacion,
        hora_recibo:      _horaActualizacion,
        // Preservar explícitamente el modo de cobro y tipo del folio en cada versión
        modoCosto: (typeof window._modoCostoFolio==='function' ? (window._modoCostoFolio(appData.recibos[idx])||appData.recibos[idx].modoCosto) : appData.recibos[idx].modoCosto) || '',
        tipoTramite: appData.recibos[idx].tipoTramite || recibo.tipoTramite || '',
        // Concepto/descripción de "Saldo Restante" que se imprimió en ESTE
        // recibo (respeta si el usuario lo editó a mano) — se guarda para que
        // una futura regeneración de este mismo PDF reproduzca el mismo texto
        // en vez de recalcular el default desde cero.
        saldoRestanteConcepto:    datos.saldoRestanteConcepto || '',
        saldoRestanteDescripcion: datos.saldoRestanteDescripcion || ''
      });
      // ⚠️ CRÍTICO: insertar B inmediatamente DESPUÉS de A usando splice(idx+1).
      // Esto garantiza que find(r => r.folio === n) sin filtro de letra siempre
      // devuelve A primero. push() + sort() fue reemplazado porque el comparador
      // con return 0 para folios distintos viola la transitividad de sort() y
      // producía que B quedara antes que A, rompiendo el display en historial y contab.
      if (typeof _revivirSiTombstone === 'function') _revivirSiTombstone(nuevoRegistro);
      appData.recibos.splice(idx + 1, 0, nuevoRegistro);
      _guardarVersionEnSupabase(nuevoRegistro, letraActual, nombreArchivo).catch(e=>console.warn('[SB versiones] actualizacion:',e));
    }
  if(!appData.historialPagos) appData.historialPagos = {};
    if(!appData.historialPagos[recibo.folio]) appData.historialPagos[recibo.folio] = [];
    const yaRegistrados = new Set(appData.historialPagos[recibo.folio].map(h=>h.fechaHora||''));
    pagosParciales.forEach(p => {
      if(p.locked) return; // El "Dejó un anticipo" no se duplica en el historial
      if(!yaRegistrados.has(p.fechaHora)){
        appData.historialPagos[recibo.folio].push({
          folio: recibo.folio,
          fecha: p.fechaHora,
          fechaHora: p.fechaHora,
          tipo: saldoNuevo<=0 ? 'LIQUIDADO' : 'PAGO PARCIAL',
          pago: parseFloat(p.cantidad)||0,
          saldoRestante: saldoNuevo
        });
      }
    });
    // ── REGISTRAR INGRESO EN CAJA/CONTABILIDAD ──────────────────────
    if(typeof D !== 'undefined' && Array.isArray(D.movimientos)){
      // Un solo ingreso por folio: en pago total incluye el complementario cubierto.
      // Usar sumaAbonosNuevos (no solo abonosNuevos): incluye el abono capturado en el
      // campo Anticipo del cuadro dorado — que es por donde el flujo de Servicio
      // Complementario captura el pago. Antes solo contaba pagos parciales, por lo que
      // el abono del complementario (campo anticipo) quedaba en $0 y NO se registraba.
      const montoNuevosAbonos = sumaAbonosNuevos + _compCubiertoImp;
      // ⚠️ BLINDAJE 2026-07: ancla la fecha/hora del movimiento al propio renglón de
      // pago (folioLetra + fechaHora) que ya quedó impreso en el PDF/pagosParciales,
      // en vez de usar "ahora" (momento de dar clic en Imprimir Actualización). Antes,
      // si el renglón se había escrito minutos u horas antes de imprimir (o si el clic
      // de guardado se demoraba/reintentaba), el movimiento podía terminar con una
      // hora — o en casos raros una letra — desalineada de lo que el propio recibo ya
      // tiene guardado como verdad (caso detectado: folio 56D, pago de $7,000 a las
      // 18:42 impreso correctamente en el PDF, pero el movimiento de Contabilidad
      // quedó con datos de otra letra). Se usa SIEMPRE el último renglón nuevo de
      // pagosParciales_conAuth (que ya trae folioLetra=letraActual, fuente de verdad),
      // con fallback al comportamiento anterior si no hay renglón (p.ej. complementario
      // pagado solo vía el campo Anticipo, sin fila de pago parcial).
      const _nuevosParaMov = pagosParciales_conAuth.filter(p => !p.locked);
      const _ultimoNuevoMov = _nuevosParaMov.length ? _nuevosParaMov[_nuevosParaMov.length - 1] : null;
      // FIX: el regex original solo reconocía "DD/MM/YYYY HH:MM" (el formato
      // que produce fechaHoraCDMX_Str() en el flujo normal). Las filas creadas
      // en modo RETRO guardan tr.dataset.fechaHora en formato ISO
      // "YYYY-MM-DD HH:MM" (viene directo del <input type="date"> del editor
      // retro) — el regex nunca hacía match ahí, así que el ancla quedaba
      // silenciosamente nula para CUALQUIER pago retroactivo. Se reconocen
      // ahora los 2 formatos, para que el ancla refleje siempre lo que
      // realmente quedó guardado en el renglón, sea cual sea su origen.
      const _fhTxt = (_ultimoNuevoMov && _ultimoNuevoMov.fechaHora) || '';
      const _fhMatchSlash = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/.exec(_fhTxt);
      const _fhMatchISO   = !_fhMatchSlash ? /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/.exec(_fhTxt) : null;
      const _fechaMovAnclada = _fhMatchSlash ? (_fhMatchSlash[3] + '-' + _fhMatchSlash[2] + '-' + _fhMatchSlash[1])
        : _fhMatchISO ? (_fhMatchISO[1] + '-' + _fhMatchISO[2] + '-' + _fhMatchISO[3])
        : null;
      const _horaMovAnclada = _fhMatchSlash ? _fhMatchSlash[4] : _fhMatchISO ? _fhMatchISO[4] : null;
      if(montoNuevosAbonos > 0){
        // Dedup: evita crear un segundo movimiento para el mismo folio+letra si esta
        // función corre dos veces para la misma versión (doble clic, reintento, etc.)
        // — mismo patrón que ya usa guardarRecibo() para sus propios movimientos.
        // ⚠️ FIX: Number() en ambos lados — m.folio puede venir como STRING desde
        // Supabase/jsonb (visto en movimientos restaurados, ej. folio 88A) mientras
        // que recibo.folio es NUMBER; la comparación estricta anterior nunca
        // detectaba el movimiento ya existente y terminaba creando un duplicado.
        const _yaExisteMovAct = D.movimientos.some(m =>
          m && m.fuente === 'recibo' && Number(m.folio) === Number(recibo.folio) && (m.letra||'A') === letraActual
        );
        if(_yaExisteMovAct){
          console.warn('[Contabilidad] Ya existe un movimiento para folio ' + folioConLetra(recibo.folio, recibo.anio_folio, letraActual) + ' — no se duplica.');
        } else {
        const tipoMov = saldoNuevo<=0 ? 'Liquidación' : 'Abono parcial';
        const mov = {
          id: 'M-REC-' + recibo.folio + '-' + Date.now(),
          folioCaja: '',
          fecha: _fechaMovAnclada || (_retroActivo ? _fechaActualizacion : (typeof hoy  === 'function' ? hoy()  : new Date().toISOString().split('T')[0])),
          hora:  _horaMovAnclada  || (_retroActivo ? _horaActualizacion  : (typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5))),
          descripcion: (function(){
            // FIX (unificación de descripciones en Contabilidad): folio y nombre
            // ya tienen su propia columna — repetirlos aquí era redundante (mismo
            // ajuste ya aplicado en guardarRecibo()). Además, si en ESTA versión
            // (B/C/D…) se agregó un servicio complementario nuevo (costoExtra sin
            // locked), se muestra ESE concepto — antes siempre se mostraba el
            // concepto original del trámite (A), aunque el abono fuera en realidad
            // por un servicio distinto agregado después.
            const ceEsta = (costosExtra||[]).filter(function(ce){ return ce && !ce.locked; });
            if(ceEsta.length){
              return tipoMov + ' · ' + ceEsta.map(function(ce){ return (ce.concepto||'') + (ce.descripcion ? ' — ' + ce.descripcion : ''); }).join(' · ');
            }
            const c0 = recibo.conceptos && recibo.conceptos[0];
            const conc = c0 ? (c0.concepto||'') : '';
            const desc = c0 ? (c0.descripcion||'') : '';
            const txt  = conc + (desc ? ' — ' + desc : '');
            return tipoMov + (txt ? ' · ' + txt : '');
          })(),
          nombre: recibo.nombre || '',
          folio: recibo.folio,
          monto: montoNuevosAbonos,
          tipo: 'ingreso',
          cat: (saldoNuevo<=0 ? 'Liquidación' : 'Abono parcial') + ' · #' + folioConLetra(recibo.folio, recibo.anio_folio, letraActual),
          estatus: saldoNuevo<=0 ? 'Liquidado' : 'Abono parcial',
          fuente: 'recibo',
          letra: letraActual,
          // El responsable del trámite queda fijo desde que se creó el folio (recibo.responsable,
          // elegido por el admin vía elegirResponsable() o heredado). Antes esto usaba empNombre()
          // (quien tiene la sesión abierta) primero, así que si el admin imprimía la actualización
          // de un trámite asignado a su empleada, el movimiento quedaba registrado con las
          // iniciales del admin en vez de las de la empleada — aunque el PDF sí salía correcto.
          responsable: recibo.responsable || $('responsable').value || (typeof empNombre === 'function' ? empNombre() : '')
        };
        _registrarMovimiento(mov);
        if(typeof save === 'function') save();
        if(typeof renderCaja === 'function') renderCaja();
        if(typeof renderContab === 'function') renderContab();
        // ⚠️ NO llamar await syncEstadoSupabase() aquí — save() ya lo dispara.
        // Una segunda llamada inmediata entra al debounce de 500ms y cuando corre
        // puede bajar D.movimientos de SB antes de que save() termine de subir,
        // borrando el movimiento recién registrado de la memoria local.
        }
      }
      // ── REGISTRAR PAGO DEL SERVICIO COMPLEMENTARIO (si hay abono nuevo) ──
      // El abono ya fue registrado como movimiento principal arriba (sumaAbonosNuevos).
      // No se necesita un movimiento adicional por complementario.
    }
    // Guard de registro: apagar SOLO tras registrar honorarios Y complementarios.
    // Si se apagaba antes (justo tras el honorario), _protegerMovimientosRecibo()
    // —que corre síncrono dentro de save()— veía el folio a medias y podía fabricar
    // un duplicado del complementario/abono parcial que aún no se registraba.
    //
    // ⚠️ FIX 2026-06: NO apagar el guard aquí todavía. El segundo save() de abajo
    // también dispara syncEstadoSupabase() → _protegerMovimientosRecibo(). Si el guard
    // ya está apagado cuando corre ese segundo save(), _protegerMovimientosRecibo() ve
    // la brecha del recibo B recién insertado en appData.recibos y crea un segundo
    // movimiento M-RECUP con monto distinto — ese es el duplicado visible en contabilidad.
    // El guard se apaga DESPUÉS del segundo save() para cubrir ambas llamadas.
    // ── ESCRITURA BLOQUEANTE en Drive antes de imprimir ──────────────
    setStatus('loading','Guardando actualización del folio #'+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+'...','loading');
    try {
      await actualizarArchivoControl();
    } catch(eCtrl) {
      console.error('❌ Error guardando actualización:', eCtrl);
      try { await actualizarArchivoControl(); } catch(e2){ console.error('❌ Segundo intento fallido:', e2); }
    }
    // ── Persistir D.movimientos DESPUÉS de que actualizarArchivoControl() terminó ──
    // Garantiza que el movimiento de Liquidación/Abono quede en SB aunque save()
    // anterior haya colisionado con _syncEnCurso y quedado en el debounce de 500ms.
    // FIX (mismo caso raíz que folio 113A en guardarRecibo()): un solo save()
    // fire-and-forget podía fallar en silencio y dejar el abono/liquidación
    // huérfano solo en memoria local. Se reintenta varias veces y, si de plano
    // no se puede, se avisa de forma visible en vez de perderse sin aviso.
    let _syncOkAct = false;
    for (let _intentoSyncAct = 1; _intentoSyncAct <= 4 && !_syncOkAct; _intentoSyncAct++) {
      try {
        await syncEstadoSupabase();
        _syncOkAct = true;
      } catch (eSyncAct) {
        console.warn('[_imprimirActualizacionReal] intento ' + _intentoSyncAct + '/4 de sincronizar falló:', eSyncAct);
        if (_intentoSyncAct < 4) await new Promise(res => setTimeout(res, 1000 * _intentoSyncAct));
      }
    }
    if (!_syncOkAct) {
      const _folioLetraActTxt = folioConLetra(recibo.folio, recibo.anio_folio, letraActual);
      toast('⚠️ La actualización del recibo #' + _folioLetraActTxt + ' NO se pudo guardar en el servidor tras varios intentos. Verifica tu conexión y vuelve a intentar, o revisa SCANSYS PRO.', 'err');
      if (typeof _lexPush === 'function') {
        try { _lexPush('error', 'recibo.sync', 'Actualización del recibo #' + _folioLetraActTxt + ' no se pudo sincronizar tras 4 intentos.', null, { folio: recibo.folio, letra: letraActual }); } catch(eLex){}
      }
    }
    // ✅ Apagar guard AQUÍ, después del segundo save(), para que _protegerMovimientosRecibo()
    // no vea la brecha del recibo B recién registrado en ninguno de los dos save() anteriores.
    window._desactivarRegistrandoRecibo();
    renderHistorial();
    setStatus(_syncOkAct ? 'ok' : 'err', _syncOkAct ? ('Folio #'+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+' actualizado e impreso \u2014 puedes seguir agregando') : ('\u26a0\ufe0f Folio #'+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+' impreso, pero no se confirmo en el servidor \u2014 revisa el aviso'), _syncOkAct ? 'ok' : 'err');
    const pdfBlob = doc.output('blob');
    lastActualizacionBlob = pdfBlob;
    lastActualizacionNombre = nombreArchivo;
    // El modal de placas ya se mostró al inicio de la función. Las placas ya están
    // en `datos` y por tanto incluidas en el PDF generado. Ahora solo abrimos la
    // ventana de impresora.
    console.log('[PLACAS] PDF generado. Abriendo ventana de impresora...');
    imprimirDesdeBlob(pdfBlob, nombreArchivo);
    // Resetear modo retro si estaba activo (evita que persista en la siguiente operación)
    if(_retroActivo){
      window._reciboRetroactivoActivo = false;
      window._reciboRetroactivoFechaPersonalizada = null;
      window._reciboRetroactivoHoraPersonalizada = null;
      window._reciboRetroactivoMotivo = null;
      var _btnRetroUpd = document.getElementById('btn-toggle-retro');
      if(_btnRetroUpd){
        _btnRetroUpd.style.background = 'none';
        _btnRetroUpd.style.color = 'var(--muted)';
        _btnRetroUpd.style.borderColor = 'rgba(200,149,42,0.3)';
        _btnRetroUpd.textContent = '⏰ RETRO';
      }
    }
    // ─── FLUJO SIMPLIFICADO: regreso automático a página principal ───
    setTimeout(() => {
      try {
        if(typeof siguienteFolio === 'function'){
          // Marcar que venimos de un pago/actualización (no de un recibo nuevo).
          // Esto evita que siguienteFolio() lea folio_actual de Supabase y lo pise
          // con el valor del siguiente folio principal, en lugar de mantener el
          // appData.folioActual local que ya es correcto.
          window._vieneDePagoActualizacion = true;
          siguienteFolio();
        } else {
          if(typeof cancelarActualizacion === 'function') cancelarActualizacion();
          if(typeof limpiarFormCompleto    === 'function') limpiarFormCompleto();
        }
        const tipoFlujo = (saldoNuevo <= 0) ? 'liquidado completamente' : 'actualizado';
        // Si se liquidó completamente, eliminar pendiente de placas vinculado
        // EXCEPTO en modo Sin Costo Total Pactado — solo se cierra con "Cerrar Juicio"
        const _esSinCostoPost = window._abiertoSinCosto(recibo);
        if (saldoNuevo <= 0 && !_esSinCostoPost) _eliminarPendientePorFolio(recibo.folio);
        const _msgFlujo = _esSinCostoPost ? 'actualizado (sin costo pactado)' : tipoFlujo;
        setStatus('ok', 'Folio #'+folioConLetra(recibo.folio, recibo.anio_folio, letraActual)+' '+_msgFlujo+' · Listo para el siguiente recibo', 'ok');
      } catch(e){
        console.error('[post-imprimir-actualizacion]', e);
      }
    }, 700);
  } catch(e){
    console.error(e);
    setStatus('err','Error al generar PDF actualizado','err');
    showModal('Error','No se pudo generar el PDF: '+e.message);
  } finally {
    window._ocultarGenerandoPDF([_btnImprimirAct2, _btnCancelarAct2]);
  }
}

function cerrarModalCancelacion(){
  document.getElementById('modal-cancelacion').classList.remove('show');
  document.getElementById('cancelacion-motivo').value='';
}

function fichaRetroToggle(){
  if(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada){
    fichaRetroDesactivar();
  } else {
    // Usar el mismo editor de fecha retro
    abrirEditorFechaRetro();
  }
}

function fichaRetroDesactivar(){
  window._reciboRetroactivoActivo = false;
  window._reciboRetroactivoFechaPersonalizada = null;
  window._reciboRetroactivoHoraPersonalizada = null;
  // Restaurar botón principal retro del formulario si existe
  var btnRetro = document.getElementById('btn-toggle-retro');
  if(btnRetro){ btnRetro.style.background='none'; btnRetro.style.color='var(--muted)'; btnRetro.style.borderColor='rgba(200,149,42,0.3)'; btnRetro.textContent='⏰ RETRO'; }
  fichaRetroActualizarDisplay();
  if(typeof toast==='function') toast('Modo retroactivo desactivado','ok');
}

function fichaRetroActualizarDisplay(){
  var btn = document.getElementById('ficha-btn-retro');
  var bar = document.getElementById('ficha-retro-bar');
  var fechaDisp = document.getElementById('ficha-retro-fecha-display');
  var activo = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  if(btn){
    btn.style.background = activo ? '#5a3a8a' : 'none';
    btn.style.color = activo ? '#fff' : '#7a6840';
    btn.style.borderColor = activo ? '#5a3a8a' : 'rgba(200,149,42,0.3)';
    btn.textContent = activo ? '⏰ RETRO ACTIVO' : '⏰ RETRO';
  }
  if(bar){ bar.style.display = activo ? 'flex' : 'none'; }
  if(fechaDisp && activo){
    fechaDisp.textContent = (window._reciboRetroactivoFechaPersonalizada||'') + ' ' + (window._reciboRetroactivoHoraPersonalizada||'');
  }
}

async function ejecutarTramiteCancelado(){
  if(!reciboEnConsulta){ showModal('Error','No hay un recibo en consulta.'); return; }
  const auth = await pedirAutorizacion();
  if(auth === null){ setStatus('ok','Cancelación anulada — autorización no proporcionada','ok'); return; }
  window._autorizacionCancelacion = auth;
  document.getElementById('cancelacion-motivo').value = '';
  document.getElementById('cancelacion-monto').value = '';
  document.getElementById('cancelacion-concepto-interno').value = '';
  document.getElementById('cancel-monto-wrap').style.display = 'none';
  window._cancelTipoSeleccionado = null;
  ['ingreso','egreso','sin'].forEach(t => {
    const el = document.getElementById('cancel-opt-'+t);
    if(el) el.style.borderColor = '#ddd';
    const radio = document.querySelector('input[name="cancel-tipo"][value="'+t+'"]');
    if(radio) radio.checked = false;
  });
  document.getElementById('modal-cancelacion').classList.add('show');
  document.getElementById('cancelacion-motivo').focus();
}

async function confirmarCancelacion(){
  const recibo = reciboEnConsulta;
  if(!recibo) return;
  if(esPeriodoCerrado(recibo.fecha || recibo.fecha_recibo, recibo.hora || recibo.hora_recibo || '00:00')){
    toast(_msgPeriodoCerrado(), 'err'); return;
  }
  const motivo = document.getElementById('cancelacion-motivo').value.trim();
  const tipoCancelacion = window._cancelTipoSeleccionado;
  const montoInput = parseFloat(document.getElementById('cancelacion-monto').value) || 0;
  if(!tipoCancelacion){
    if(typeof toast==='function') toast('⚠ Selecciona el tipo de cancelación','err');
    return;
  }
  if((tipoCancelacion==='ingreso' || tipoCancelacion==='egreso') && montoInput <= 0){
    if(typeof toast==='function') toast('⚠ Ingresa el monto','err');
    return;
  }
  document.getElementById('modal-cancelacion').classList.remove('show');
  const auth = window._autorizacionCancelacion || null;
  window._autorizacionCancelacion = null;
  // Capturar desde el DOM antes de cerrar el modal (cerrarConsulta limpia globals)
  const _conceptoInterno = (document.getElementById('cancelacion-concepto-interno')?.value || '').trim();
  const _retroCanConf = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  const _fechaCanConf = _retroCanConf ? window._reciboRetroactivoFechaPersonalizada : new Date().toISOString().slice(0,10);
  const _horaCanConf  = _retroCanConf ? (window._reciboRetroactivoHoraPersonalizada || '00:00') : new Date().toTimeString().slice(0,5);
  if(!appData.historialPagos) appData.historialPagos = {};
  if(!appData.historialPagos[recibo.folio]) appData.historialPagos[recibo.folio] = [];
  appData.historialPagos[recibo.folio].push({
    folio: recibo.folio,
    fecha: _retroCanConf ? new Date(_fechaCanConf + 'T12:00:00').toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'),
    tipo: 'CANCELADO',
    pago: 0,
    saldoRestante: recibo.saldoPendiente || 0
  });
  actualizarArchivoControl().catch(e=>console.warn('Control:',e));
  renderHistorial();
  // Capturar retro ANTES de cerrarConsulta() que limpia los globals vía limpiarFormCompleto()
  const _retroOptsCanConf = { activo: _retroCanConf, fecha: _fechaCanConf, hora: _horaCanConf };
  cerrarConsulta();
  // Los tres tipos generan folio B — sin movimiento genera folio en $0 como precedente documental
  setTimeout(async () => {
    await _lanzarFolioCancelacion(recibo, tipoCancelacion, tipoCancelacion==='sin' ? 0 : montoInput, motivo, auth, _retroOptsCanConf, _conceptoInterno);
  }, 400);
}

async function _confirmarCancelacionReal(recibo, motivo, auth){
  window._autorizacionCancelacion = null;
  const folio = folioConLetra(recibo.folio, recibo.anio_folio, recibo.letra||letraVersion(recibo)||'A');
  // Restaurar status-bar antes de operar
  const _sbCanR = document.querySelector('.status-bar');
  if(_sbCanR) _sbCanR.removeAttribute('style');
  const _retroCanReal = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  const _fechaCanReal = _retroCanReal ? window._reciboRetroactivoFechaPersonalizada : new Date().toISOString().slice(0,10);
  const _horaCanReal  = _retroCanReal ? (window._reciboRetroactivoHoraPersonalizada || '00:00') : new Date().toTimeString().slice(0,5);
  recibo.cancelado = true;
  recibo.fechaCancelacion = _retroCanReal ? (_fechaCanReal + 'T' + _horaCanReal + ':00.000') : new Date().toISOString();
  recibo.motivoCancelacion = (motivo || 'Sin motivo especificado')
    + (auth ? ' \u2014 Autoriz\u00f3: ' + auth.iniciales + ' [' + auth.fechaHora + ']' : '');
  if(!appData.historialPagos) appData.historialPagos = {};
  if(!appData.historialPagos[recibo.folio]) appData.historialPagos[recibo.folio] = [];
  appData.historialPagos[recibo.folio].push({
    folio: recibo.folio,
    fecha: _retroCanReal ? new Date(_fechaCanReal + 'T12:00:00').toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX'),
    tipo: 'CANCELADO',
    pago: 0,
    saldoRestante: recibo.saldoPendiente || 0
  });
  // Regenerar el PDF con marca de agua CANCELADO, nota y motivo
  try {
    const clientes = recibo.clientes || [{nombre: recibo.nombre, movil:'', tel:'', domicilio:''}];
    const primerNombre = clientes[0].nombre || recibo.nombre;
    const qrTexto = 'LEX-MEXICO|Folio:'+folio+'|'+primerNombre+'|CANCELADO';
    const qrDataURL = await qrToDataURL(qrTexto);
    const datosCancelado = Object.assign({}, recibo, {
      clientes, cancelado: true,
      motivoCancelacion: recibo.motivoCancelacion,
      fechaCancelacion: recibo.fechaCancelacion,
      fecha_recibo: recibo.fecha || recibo.fecha_recibo || '',
      hora_recibo:  recibo.hora  || recibo.hora_recibo  || '',
      anticipo: String(recibo.anticipo || 0),
      conceptos: recibo.conceptos || [],
      responsable: recibo.responsable || '',
      nombre_cliente_firma: recibo.nombre_cliente_firma || ''
    });
    const docCan = await generarPDF(datosCancelado, recibo.folio, qrDataURL);
    const nombreArch = (typeof folioConLetra==='function' ? folioConLetra(folio, recibo.anio_folio, recibo.letra||'A') : String(folio)) + '.pdf'; // nombre corto canónico
    recibo.pdfBase64 = docCan.output('datauristring');
    reemplazarPDFenDrive(docCan.output('blob'), nombreArch).catch(e=>console.warn('SB cancel:',e));
  } catch(e){ console.warn('PDF cancelado no regenerado:', e); }
  actualizarArchivoControl().catch(e=>console.warn('Control:',e));
  renderHistorial();
  cerrarConsulta();
  // ─── REGRESO AUTOMÁTICO A PÁGINA PRINCIPAL ────────────────────────
  setTimeout(() => {
    try {
      if(typeof siguienteFolio === 'function'){
        window._vieneDePagoActualizacion = true;
        siguienteFolio();
      } else if(typeof limpiarFormCompleto === 'function'){
        limpiarFormCompleto();
      }
      setStatus('ok', 'Recibo #'+folio+' cancelado · Listo para el siguiente recibo', 'ok');
    } catch(e){
      console.error('[post-cancelacion]', e);
    }
  }, 200);
  if(typeof toast === 'function'){
    toast('🚫 Recibo #'+folio+' cancelado');
  }
}

function descongelarFormulario() {
  document.body.classList.remove('recibo-frozen');
  document.getElementById('actions-normal').style.display = 'flex';
  document.getElementById('actions-post-print').style.display = 'none';
  document.getElementById('frozen-banner').style.display = 'none';
  lastPdfBlob = null;
  // Re-habilitar checkboxes al descongelar
  document.querySelectorAll('#docs-checklist input[type="checkbox"]').forEach(function(cb) {
    cb.disabled = false;
  });
}

function siguienteFolio() {
  // ── PASO 1: El folio ya fue incrementado en Drive al imprimir.
  // Solo limpiar pendingNextFolio por si quedó algún valor residual ──
  try {
    pendingNextFolio = null;
  } catch(e){ console.warn('[siguienteFolio:folio]', e); }
  // ── PASO 2: Si veníamos de modo actualización, desmontar primero ──
  // Esto se hace ANTES de limpiar para que limpiarFormCompleto trabaje en un DOM normalizado.
  try {
    const enActualizacion = document.body.classList.contains('modo-actualizacion')
                         || document.body.classList.contains('actualizacion-impresa')
                         || document.body.classList.contains('desde-liquidacion');
    if (enActualizacion && typeof cancelarActualizacion === 'function'){
      cancelarActualizacion();
    }
  } catch(e){ console.warn('[siguienteFolio:cancelarAct]', e); }
  // ── PASO 3: Descongelar formulario (quita banner, restaura action panels) ──
  try {
    if(typeof descongelarFormulario === 'function') descongelarFormulario();
  } catch(e){ console.warn('[siguienteFolio:descongelar]', e); }
  // ── PASO 4: LIMPIEZA TOTAL (modo nativo virgen) ──
  // limpiarFormCompleto ya tiene try/catch internos por paso, así que es idempotente y seguro.
  try {
    limpiarFormCompleto();
  } catch(e){ console.error('[siguienteFolio:limpiar]', e); }
  // ── PASO 5: Leer folio actual desde Supabase y mostrar ──
  try {
    if(typeof generarQRPreview === 'function') generarQRPreview();
    // Si venimos de un pago/actualización (Pago Total, Pago Parcial, Servicio
    // Complementario), NO leemos folio_actual de Supabase porque:
    //   1. No se consumió un folio nuevo — solo se generó una letra B/C/D.
    //   2. actualizarArchivoControl() ya subió appData.folioActual (correcto) a SB.
    //   3. La lectura asíncrona puede llegar tarde y pisar el display con el folio
    //      del SIGUIENTE recibo principal en lugar de mantenerse limpio.
    // En este caso confiamos en appData.folioActual que ya es el valor correcto.
    const _skipSBRead = !!window._vieneDePagoActualizacion;
    window._vieneDePagoActualizacion = false; // consumir la bandera siempre
    if(!_skipSBRead && window.SB && window.SB_DESPACHO_ID){
      // Leer folio_actual directo de Supabase para evitar desfases (recibo nuevo)
      window.SB.from('app_state')
        .select('folio_actual')
        .eq('despacho_id', window.SB_DESPACHO_ID)
        .single()
        .then(function(res){
          if(res.data && res.data.folio_actual){
            appData.folioActual = res.data.folio_actual;
            if(typeof REC !== 'undefined') REC.folioActual = res.data.folio_actual;
          }
          if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
          setStatus('ok', 'Folio #'+folioFormato(appData.folioActual)+' listo — formulario en blanco', 'ok');
        }).catch(function(){
          if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
          setStatus('ok', 'Folio #'+folioFormato(appData.folioActual)+' listo — formulario en blanco', 'ok');
        });
    } else {
      if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
      setStatus('ok', 'Folio #'+folioFormato(appData.folioActual)+' listo — formulario en blanco', 'ok');
    }
  } catch(e){ console.warn('[siguienteFolio:qr]', e); }
  // ── PASO 6: Regresar el scroll al inicio del formulario ──────────────────
  // FIX (caso real: "genero un recibo y al regresar la página queda a la mitad,
  // cerca del QR/Imprimir/Historial en vez de arriba en Cliente/Folio"): esta
  // función limpia todo para el SIGUIENTE recibo, pero nunca movía el scroll —
  // el usuario se quedaba viendo la parte baja de la pantalla justo donde
  // estaba cuando imprimió, dando la impresión de que el sistema no había
  // vuelto a su estado normal. Mismo patrón ya usado en salirModoConsulta().
  try {
    setTimeout(()=>{
      const rb = document.getElementById('recibo-body');
      if(rb) rb.scrollIntoView({behavior:'smooth', block:'start'});
      else window.scrollTo({top:0, behavior:'smooth'});
    }, 150);
  } catch(e){ console.warn('[siguienteFolio:scroll]', e); }
}

function reimprimirRecibo() {
  if (!lastPdfBlob) { setStatus('err','No hay recibo disponible para reimprimir','err'); return; }
  imprimirDesdeBlob(lastPdfBlob, nombreArchivo);
}

function _mostrarVisorReciboPDF(blob, nombreArchivo){
  var nombre = nombreArchivo || 'Recibo.pdf';
  var url = URL.createObjectURL(blob);
  var winIndependiente = window.open(url, '_blank');
  if (winIndependiente) {
    // Pestaña independiente abierta con éxito — no se necesita el visor
    // embebido. Se libera la URL hasta un buen rato después, dando tiempo de
    // sobra a que la pestaña termine de cargar el PDF.
    setTimeout(function(){ try{ URL.revokeObjectURL(url); }catch(e){} }, 60000);
    return;
  }
  // Pestaña bloqueada por el navegador — respaldo: visor embebido en la misma
  // página (overlay + iframe), nunca una descarga forzada sin avisar.
  // Si había un visor anterior abierto, liberar su URL antes de reemplazarlo.
  _cerrarVisorReciboPDF();
  var overlay = document.createElement('div');
  overlay.id = 'recibo-pdf-visor-overlay';
  overlay.dataset.blobUrl = url;
  overlay.style.cssText = 'position:fixed;inset:0;z-index:150000;background:rgba(20,14,4,0.85);display:flex;flex-direction:column;';
  overlay.innerHTML =
      '<div style="background:#1a1a0e;padding:10px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(200,149,42,0.3);flex-shrink:0;">'
    +   '<span style="font-size:16px;">📄</span>'
    +   '<span style="font-size:0.85rem;font-weight:700;color:#f0d890;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escHTML(nombre)+'</span>'
    +   '<button onclick="_imprimirDesdeVisorReciboPDF()" style="border:1px solid #c8951a;border-radius:6px;padding:6px 14px;font-size:0.72rem;font-weight:700;color:#f0d890;background:rgba(200,149,42,0.15);cursor:pointer;">🖨 Imprimir</button>'
    +   '<a href="'+url+'" download="'+escHTML(nombre)+'" style="border:1px solid #c8951a;border-radius:6px;padding:6px 14px;font-size:0.72rem;font-weight:700;color:#f0d890;text-decoration:none;background:rgba(200,149,42,0.15);">⬇ Guardar</a>'
    +   '<button onclick="_cerrarVisorReciboPDF()" style="background:#c0392b;border:none;border-radius:6px;color:#fff;font-size:0.8rem;font-weight:700;padding:6px 14px;cursor:pointer;">✕ Cerrar</button>'
    + '</div>'
    + '<iframe id="recibo-pdf-visor-iframe" src="'+url+'" style="flex:1;border:none;background:#525659;"></iframe>';
  document.body.appendChild(overlay);
}

function _imprimirDesdeVisorReciboPDF(){
  var f = document.getElementById('recibo-pdf-visor-iframe');
  if(f && f.contentWindow){ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ console.warn('[imprimir visor recibo]', e); } }
}

function _cerrarVisorReciboPDF(){
  var overlay = document.getElementById('recibo-pdf-visor-overlay');
  if(!overlay) return;
  var url = overlay.dataset.blobUrl;
  overlay.remove();
  if(url){ try{ URL.revokeObjectURL(url); }catch(e){} }
}

function imprimirDesdeBlob(blob, nombreArchivo) {
  _mostrarVisorReciboPDF(blob, nombreArchivo);
}

function actualizarLabelPlacas(){
  const tipo = ($('placas-tipo')||{value:'placas'}).value;
  const lbl = document.getElementById('placas-numero-label');
  const inp = $('placas-numero');
  if(tipo === 'placas'){
    if(lbl) lbl.textContent = 'Número de placas';
    if(inp){ inp.placeholder = 'Ej. ABC-123-D'; inp.maxLength = 9; }
  } else if(tipo === 'tarjeta'){
    if(lbl) lbl.textContent = 'Folio de tarjeta de circulación';
    if(inp){ inp.placeholder = 'Ej. 1234567890'; inp.maxLength = 20; }
  } else {
    if(lbl) lbl.textContent = 'Descripción';
    if(inp){ inp.placeholder = 'Ej. Permiso temporal'; inp.maxLength = 40; }
  }
}

function confirmarVehicular(){
  _descripcionVehicular = document.getElementById('vehicular-descripcion').value.trim();
  document.getElementById('modal-vehicular').classList.remove('show');
  document.getElementById('vehicular-descripcion').value = '';
  _saltarModalVehicular = true;
  guardarRecibo();
}

function guardarDeTodasFormas(){
  document.getElementById('modal-validacion').classList.remove('show');
  _guardarForzado = true;
  guardarRecibo();
}

function abrirConfirmacionRecibo(opts){
  opts = opts || {};
  _confirmacionCallback         = (typeof opts.onAceptar  === 'function') ? opts.onAceptar  : null;
  _confirmacionCallbackCancelar = (typeof opts.onCancelar === 'function') ? opts.onCancelar : null;
  document.getElementById('modal-confirmar-recibo').classList.add('show');
}

function confirmarRecibo_Aceptar(){
  document.getElementById('modal-confirmar-recibo').classList.remove('show');
  const cb = _confirmacionCallback;
  _confirmacionCallback         = null;
  _confirmacionCallbackCancelar = null;
  if(typeof cb === 'function') {
    try { cb(); } catch(e){ console.error('[confirmarRecibo_Aceptar]', e); }
  }
}

function confirmarRecibo_Cancelar(){
  document.getElementById('modal-confirmar-recibo').classList.remove('show');
  const cbCancel = _confirmacionCallbackCancelar;
  _confirmacionCallback         = null;
  _confirmacionCallbackCancelar = null;
  if(typeof cbCancel === 'function'){
    try { cbCancel(); } catch(e){ console.error('[confirmarRecibo_Cancelar]', e); }
  }
}

function _eliminarPendientePorFolio(folio) {
  if (typeof D === 'undefined' || !Array.isArray(D.pendientes)) return;
  const idPend = 'PEND-REC-' + folio;
  const idx = D.pendientes.findIndex(p => 
    p.id === idPend || 
    (Number(p.reciboVinculadoFolio) === Number(folio) && p.seccion === 'placas')
  );
  // Guardar en lista negra para que sincronizarPendientesPlacas no lo recree
  try {
    const _lb = JSON.parse(localStorage.getItem('lex-placas-liquidados') || '[]');
    if (_lb.indexOf(String(folio)) < 0) {
      _lb.push(String(folio));
      localStorage.setItem('lex-placas-liquidados', JSON.stringify(_lb));
    }
  } catch(e) {}
  if (idx >= 0) {
    D.pendientes.splice(idx, 1);
    if (typeof save === 'function') save();
    if (typeof renderPend === 'function') renderPend();
    if (typeof badges === 'function') badges();
    if (typeof syncEstadoSupabaseDebounced === 'function') 
      syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
    console.log('[Auto-pendiente] Pendiente de placas eliminado permanentemente — folio #' + folio);
  }
}

async function verHistorialVersiones(folio){
  const el = document.getElementById('modal-versiones');
  const body = document.getElementById('modal-versiones-body');
  if(!el || !body) return;
  const recibo = (appData.recibos||[]).find(r=>r.folio===folio && !r.esComplemento);
  const anioFolio = recibo?.anio_folio || new Date().getFullYear();
  const letraActual = recibo?.letra || letraVersion(recibo) || 'A';
  document.getElementById('modal-versiones-folio').textContent = 'Folio #'+folioConLetra(folio, anioFolio, letraActual);
  const emailActual = (typeof empleadoActual!=='undefined' && empleadoActual && empleadoActual.email)
    ? empleadoActual.email.toLowerCase() : '';
  const esAdmin = typeof ADMIN_EMAIL!=='undefined'
    ? emailActual === ADMIN_EMAIL.toLowerCase()
    : false;
  // Mostrar botón de edición completa (siempre visible; la función verifica el contexto)
  const footer = document.getElementById('modal-versiones-footer');
  if(footer) footer.style.display = 'flex';
  body.innerHTML = '<p style="color:var(--muted);font-size:0.8rem;text-align:center;padding:20px;">⏳ Cargando versiones...</p>';
  el.classList.add('show');
  // Empleado: solo ve la versión actual sin historial
  if(!esAdmin){
    body.innerHTML = `<div style="border:1px solid var(--gold);border-radius:6px;padding:14px;background:#fffbf0;text-align:center;">
      <div style="font-family:'DM Mono',monospace;font-size:0.85rem;font-weight:700;color:var(--gold-d);margin-bottom:6px;">Versión actual: ${folioConLetra(folio, anioFolio, letraActual)}</div>
      <div style="font-size:0.72rem;color:var(--muted);">El historial completo de versiones es visible solo para el administrador.</div>
    </div>`;
    return;
  }
  // Admin: cargar desde Supabase
  let versionesSB = [];
  if(window.SB && window.SB_DESPACHO_ID && recibo){
    try {
      const { data, error } = await window.SB.from('versiones_recibo')
        .select('*')
        .eq('despacho_id', window.SB_DESPACHO_ID)
        .eq('folio_base', folio)
        .eq('anio_folio', anioFolio)
        .order('letra', {ascending: true});
      if(!error && data) versionesSB = data;
    } catch(e){ console.warn('[versiones_recibo]', e); }
  }
  if(versionesSB.length){
    const lista = [...versionesSB].reverse(); // más reciente primero
    body.innerHTML = lista.map((v, i)=>{
      const snap = v.datos_completos || {};
      const saldo   = snap.saldoPendiente != null ? snap.saldoPendiente : '—';
      const total   = snap.total != null ? snap.total : (snap.totalGeneral || '—');
      const abonado = snap.totalAbonado != null ? snap.totalAbonado : (parseFloat(snap.anticipo)||0);
      const esUltima = (i === 0);
      const puedeRestaurar = !esUltima;
      const badgeActual = esUltima
        ? ' <span style="font-size:0.62rem;color:#2a7a3a;background:#e8f5e9;padding:2px 6px;border-radius:3px;vertical-align:middle;font-weight:600;">ACTUAL</span>'
        : '';
      return `<div style="border:1.5px solid ${esUltima?'var(--gold)':'var(--border-light)'};border-radius:6px;padding:12px 14px;margin-bottom:10px;background:${esUltima?'#fffbf0':'var(--field-bg)'};">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-family:'DM Mono',monospace;font-size:0.82rem;font-weight:700;color:var(--gold-d);">${folioConLetra(folio, anioFolio, v.letra)}${badgeActual}</span>
          <span style="font-size:0.68rem;color:var(--muted);">${v.fecha} ${v.hora} · ${v.usuario}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-family:'DM Mono',monospace;font-size:0.72rem;margin-bottom:10px;">
          <div style="background:#f5f0e8;border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.62rem;">TOTAL</span>$${typeof fmtMXN==='function'?fmtMXN(total):total}</div>
          <div style="background:#eaf4ea;border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.62rem;">ABONADO</span>$${typeof fmtMXN==='function'?fmtMXN(abonado):abonado}</div>
          <div style="background:${saldo>0?'#fff4e0':'#eafaea'};border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.62rem;">SALDO</span>$${typeof fmtMXN==='function'?fmtMXN(saldo):saldo}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${v.pdf_storage_path?`<button onclick="verPDFVersionSupabase('${v.pdf_storage_path}')"
            style="font-size:0.7rem;padding:5px 12px;border-radius:4px;border:1px solid var(--border-light);background:transparent;cursor:pointer;color:var(--ink);">📄 Ver PDF</button>`:''}
          ${puedeRestaurar?`<button onclick="restaurarVersionDesdeSupabase(${folio},'${v.letra}')"
            style="font-size:0.7rem;padding:5px 12px;border-radius:4px;border:1.5px solid #c07a10;background:#fff8ed;cursor:pointer;color:#7a4a00;font-weight:600;">↩ Restaurar esta versión</button>`:''}
        </div>
      </div>`;
    }).join('');
    return;
  }
  // Fallback: historial local (para recibos anteriores al sistema de versiones Supabase)
  const versionesLocal = (appData.historialVersiones||{})[folio] || [];
  if(!versionesLocal.length){
    body.innerHTML='<p style="color:var(--muted);font-size:0.8rem;text-align:center;padding:20px;">Sin versiones registradas para este folio.</p>';
    return;
  }
  const lista = [...versionesLocal].reverse();
  body.innerHTML = lista.map((v,i)=>{
    const snap = v.snapshot;
    const saldo   = snap.saldoPendiente!=null ? snap.saldoPendiente : '—';
    const total   = snap.total!=null ? snap.total : (snap.totalGeneral||'—');
    const abonado = snap.totalAbonado!=null ? snap.totalAbonado : (parseFloat(snap.anticipo)||0);
    return `<div style="border:1px solid var(--border-light);border-radius:6px;padding:12px 14px;margin-bottom:10px;background:var(--field-bg);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="font-family:'DM Mono',monospace;font-size:0.72rem;font-weight:700;color:var(--gold-d);">Versión ${lista.length-i}</span>
        <span style="font-size:0.7rem;color:var(--muted);">${v.fecha} ${v.hora} · ${v.quien}</span>
      </div>
      <div style="font-size:0.75rem;color:var(--ink);margin-bottom:6px;"><strong>Motivo:</strong> ${v.motivo}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-family:'DM Mono',monospace;font-size:0.72rem;">
        <div style="background:#f5f0e8;border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.65rem;">TOTAL</span>$${typeof fmtMXN==='function'?fmtMXN(total):total}</div>
        <div style="background:#eaf4ea;border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.65rem;">ABONADO</span>$${typeof fmtMXN==='function'?fmtMXN(abonado):abonado}</div>
        <div style="background:${saldo>0?'#fff4e0':'#eafaea'};border-radius:4px;padding:6px 8px;"><span style="color:var(--muted);display:block;font-size:0.65rem;">SALDO</span>$${typeof fmtMXN==='function'?fmtMXN(saldo):saldo}</div>
      </div>
      ${snap.pagosParciales&&snap.pagosParciales.length?`<div style="margin-top:8px;font-size:0.7rem;color:var(--muted);">Abonos registrados: ${snap.pagosParciales.length}</div>`:''}
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button onclick="descargarSnapshotPDF(${folio},${versionesLocal.length-1-i})"
          style="font-size:0.7rem;padding:5px 12px;border-radius:4px;border:1px solid var(--border-light);background:transparent;cursor:pointer;color:var(--ink);">
          📄 Ver PDF de esta versión
        </button>
        <button onclick="restaurarVersionRecibo(${folio},${versionesLocal.length-1-i})"
          style="font-size:0.7rem;padding:5px 12px;border-radius:4px;border:1.5px solid #c07a10;background:#fff8ed;cursor:pointer;color:#7a4a00;font-weight:600;">
          ↩ Restaurar esta versión
        </button>
      </div>
    </div>`;
  }).join('');
}

async function _cpdfMigrarSilencioso(){
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  const recibos = (typeof appData!=='undefined' ? appData.recibos||[] : []).filter(function(r){ return !r.esComplemento; });
  if(!recibos.length) return;
  // Obtener los (folio_base, letra) que ya existen para no hacer upserts innecesarios
  try {
    const { data: existentes } = await window.SB.from('versiones_recibo')
      .select('folio_base,anio_folio,letra')
      .eq('despacho_id', window.SB_DESPACHO_ID);
    const claves = new Set((existentes||[]).map(function(v){
      return v.folio_base+'_'+v.anio_folio+'_'+v.letra;
    }));
    const faltantes = recibos.filter(function(r){
      var letra  = r.letra || letraVersion(r) || 'A';
      var anio   = r.anio_folio || new Date().getFullYear();
      return !claves.has(r.folio+'_'+anio+'_'+letra);
    });
    for(var i=0; i<faltantes.length; i++){
      var r = faltantes[i];
      var letra   = r.letra || letraVersion(r) || 'A';
      var archivo = r.archivo || (folioConLetra(r.folio, r.anio_folio, letra)+'.pdf');
      await _guardarVersionEnSupabase(r, letra, archivo);
    }
  } catch(e){ console.warn('[cpdf migración silenciosa]', e); }
}

function descargarSnapshotPDF(folio, idx){
  const versiones = (appData.historialVersiones||{})[folio] || [];
  const v = versiones[idx];
  if(!v || !v.snapshot || !v.snapshot.pdfBase64){
    showModal('Sin PDF','Esta versión no tiene PDF guardado (es anterior a la implementación del historial).'); return;
  }
  const a = document.createElement('a');
  a.href = v.snapshot.pdfBase64;
  a.download = 'Recibo_'+folioFormato(folio)+'_version'+String(idx+1)+'.pdf';
  a.click();
}

function restaurarVersionRecibo(folio, idx){
  const versiones = (appData.historialVersiones||{})[folio] || [];
  const v = versiones[idx];
  if(!v){ showModal('Error','Versión no encontrada.'); return; }
  if(!confirm('¿Confirmas restaurar el Folio #'+folioFormato(folio)+' al estado del '+v.fecha+' '+v.hora+'?\n\nEsto reemplazará los datos actuales del recibo. El historial de versiones se conserva.')){return;}
  const recIdx = (appData.recibos||[]).findIndex(r=>r.folio===folio && !r.esComplemento);
  if(recIdx<0){ showModal('Error','Recibo no encontrado.'); return; }
  // Guardar snapshot del estado actual antes de restaurar
  _guardarSnapshotRecibo(appData.recibos[recIdx], 'Antes de restaurar versión '+String(idx+1));
  // Restaurar
  const campos = ['costosExtra','pagosParciales','fechasImpresion','total','saldoPendiente','pdfBase64','archivo','placasEntregadas','estadoPlacas','totalAbonado','anticipo','cancelado'];
  campos.forEach(c=>{ if(v.snapshot[c]!==undefined) appData.recibos[recIdx][c]=structuredClone(v.snapshot[c]); });
  if(typeof save==='function') save();
  if(typeof renderHistorial==='function') renderHistorial();
  if(typeof renderCaja==='function') renderCaja();
  document.getElementById('modal-versiones').classList.remove('show');
  showModal('Versión restaurada','El Folio #'+folioFormato(folio)+' fue restaurado al estado del '+v.fecha+' a las '+v.hora+'. El historial de versiones se conserva completo.');
}

async function restaurarVersionDesdeSupabase(folio, letraTarget){
  if(!window.SB || !window.SB_DESPACHO_ID){ showModal('Error','Sin conexión a Supabase.'); return; }
  const recibo = (appData.recibos||[]).find(r=>r.folio===folio && !r.esComplemento);
  const anioFolio = recibo?.anio_folio || new Date().getFullYear();
  if(!confirm('¿Restaurar el folio '+folioConLetra(folio, anioFolio, letraTarget)+'?\n\nLas versiones más recientes serán eliminadas permanentemente. Esta acción no se puede deshacer.')){ return; }
  try {
    // 1. Obtener la versión objetivo
    const { data: vTarget, error: e1 } = await window.SB.from('versiones_recibo')
      .select('*')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .eq('folio_base', folio)
      .eq('anio_folio', anioFolio)
      .eq('letra', letraTarget)
      .single();
    if(e1 || !vTarget){ showModal('Error','Versión no encontrada: '+(e1?.message||'')); return; }
    // 2. Obtener versiones posteriores a letraTarget (letras > target → las que se borran)
    const { data: vMasRecientes } = await window.SB.from('versiones_recibo')
      .select('letra, pdf_storage_path')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .eq('folio_base', folio)
      .eq('anio_folio', anioFolio)
      .gt('letra', letraTarget);
    if(vMasRecientes && vMasRecientes.length){
      for(const v of vMasRecientes){
        if(v.pdf_storage_path)
          await window.SB.storage.from(STORAGE_BUCKET).remove([v.pdf_storage_path]).catch(()=>{});
      }
      const letrasABorrar = vMasRecientes.map(v=>v.letra);
      await window.SB.from('versiones_recibo').delete()
        .eq('despacho_id', window.SB_DESPACHO_ID)
        .eq('folio_base', folio)
        .eq('anio_folio', anioFolio)
        .in('letra', letrasABorrar);
    }
    // 3. Restaurar campos del recibo en appData
    const snap = vTarget.datos_completos || {};
    const recIdx = (appData.recibos||[]).findIndex(r=>r.folio===folio && !r.esComplemento);
    if(recIdx<0){ showModal('Error','Recibo no encontrado en datos locales.'); return; }
    _guardarSnapshotRecibo(appData.recibos[recIdx], 'Antes de restaurar a '+letraTarget);
    const campos = ['costosExtra','pagosParciales','fechasImpresion','total','saldoPendiente','saldoNuevo','totalAbonado','anticipo','placasEntregadas','estadoPlacas','cancelado'];
    campos.forEach(c=>{ if(snap[c]!==undefined) appData.recibos[recIdx][c]=structuredClone(snap[c]); });
    appData.recibos[recIdx].letra  = letraTarget;
    appData.recibos[recIdx].archivo = folioConLetra(folio, anioFolio, letraTarget)+'.pdf';
    if(typeof save==='function') save();
    if(typeof actualizarArchivoControl==='function') actualizarArchivoControl().catch(()=>{});
    document.getElementById('modal-versiones').classList.remove('show');
    showModal('Versión restaurada','Folio '+folioConLetra(folio, anioFolio, letraTarget)+' restaurado correctamente.');
    if(typeof renderHistorial==='function') renderHistorial();
    if(typeof renderCaja==='function') renderCaja();
  } catch(e){ showModal('Error','Error al restaurar: '+e.message); }
}

async function reDescargar(i){
  const r=appData.recibos[i];
  if(!r) return;
  // Misma sesión: usar pdfBase64 en memoria
  if(r.pdfBase64){
    const a=document.createElement('a'); a.href=r.pdfBase64; a.download=r.archivo||'recibo.pdf'; a.click(); return;
  }
  if(!r.archivo || !window.SB_DESPACHO_ID){ setStatus('err','No hay PDF disponible para este folio','err'); return; }
  const _pathSBRD = window.SB_DESPACHO_ID + '/recibos/' + r.archivo;
  const _pathR2RD = window.SB_DESPACHO_ID + '/recibos/' + (r.archivoR2 || r.archivo);
  let _blob = null;
  // Intentar R2
  if(typeof window.descargarR2 === 'function'){
    try { const b = await window.descargarR2(_pathR2RD,'recibos'); if(b&&b.size>0) _blob=b; } catch(e){ console.warn('[reDescargar] R2:',e); }
  }
  // Intentar Supabase Storage
  if(!_blob && window.SB){
    try {
      const {data:sd,error:se}=await window.SB.storage.from(STORAGE_BUCKET).createSignedUrl(_pathSBRD,120);
      if(!se&&sd&&sd.signedUrl){ const res=await fetch(sd.signedUrl); if(res.ok) _blob=await res.blob(); }
    } catch(e){ console.warn('[reDescargar] SB:',e); }
  }
  if(_blob){
    const url=URL.createObjectURL(_blob);
    const a=document.createElement('a'); a.href=url; a.download=r.archivo||'recibo.pdf'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    const rd=new FileReader(); rd.onload=()=>{ r.pdfBase64=rd.result; }; rd.readAsDataURL(_blob);
  } else {
    setStatus('err','No se pudo descargar el PDF del folio #'+String(r.folio).padStart(4,'0'),'err');
  }
}

function togglePanelFolios(){
  // Si solo se pide abrir folios (modo-consulta), abrimos todo el panel
  if(!_panelesBusquedaAbiertos) togglePanelesBusqueda();
  setTimeout(()=>{ const f=$('folio_anterior'); if(f) f.focus(); }, 100);
}

function abrirFolioPBC(folio, esComplemento){
  if(esComplemento){
    const r=(appData.recibos||[]).find(rc=>rc.folio===folio);
    if(r&&r.folioRef){
      showModal('Folio complemento','Este es un abono del folio #'+folioFormato(r.folioRef)+'. Se abrirá el recibo original.');
      setTimeout(()=>abrirFolioPBC(r.folioRef,false),1400); return;
    }
  }
  const campo=$('folio_anterior');
  if(!campo) return;
  campo.value=folio;
  campo.scrollIntoView({behavior:'smooth',block:'center'});
  campo.focus();
  if(typeof cargarHistorialFolio==='function') cargarHistorialFolio();
}

async function _lockIntentarAdquirir(folioN){
  try{
    if(!(window.SB && window.SB_DESPACHO_ID) || folioN == null) return {ok:true};
    var { data, error } = await _sbConTimeout(window.SB.rpc('intentar_candado_folio', {
      p_despacho_id: window.SB_DESPACHO_ID,
      p_folio: Number(folioN),
      p_nombre: empNombre(),
      p_email: empEmail(),
      p_session: _lockSessionId(),
      p_minutos: 10
    }), 8000, 'candado de folio');
    if(error) throw error;
    var fila = (data && data[0]) || {ok:true};
    return fila;
  }catch(e){
    console.warn('[candadoFolio] no se pudo verificar, se permite editar:', e);
    return {ok:true};
  }
}

function _lockLiberar(folioN){
  try{
    if(!(window.SB && window.SB_DESPACHO_ID) || folioN == null) return;
    window.SB.rpc('liberar_candado_folio', {
      p_despacho_id: window.SB_DESPACHO_ID,
      p_folio: Number(folioN),
      p_session: _lockSessionId()
    }).then(function(){}).catch(function(e){ console.warn('[candadoFolio] liberar:', e); });
  }catch(e){ console.warn('[candadoFolio] liberar:', e); }
}

function _lockAvisoBloqueo(res, folioN){
  var quien = (res && res.locked_by_name) ? res.locked_by_name : 'otra persona';
  alert('🔒 El folio ' + (folioN != null ? '#' + folioN + ' ' : '') + 'está siendo editado ahora mismo por ' + quien + '.\n\nEspera un momento e inténtalo de nuevo (el candado se libera solo, incluso si esa persona cierra el navegador sin guardar).');
  if(typeof toast === 'function') toast('🔒 Folio en edición por ' + quien, 'err');
}

function ir(p){
  // Cerrar panel Pre-Recibo al navegar
  const _prOv = document.getElementById('pr-overlay');
  if (_prOv) _prOv.remove();
  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-sub-item').forEach(x=>x.classList.remove('active'));
  $('panel-'+p).classList.add('active');
  // Marcar en body el panel activo para CSS condicional
  document.body.className = document.body.className.replace(/\bpanel-[\w-]+/g,'').trim();
  document.body.classList.add('panel-'+p);
  document.querySelector(`.nav-item[onclick="ir('${p}')"]`)?.classList.add('active');
  document.querySelector(`.nav-sub-item[onclick="ir('${p}')"]`)?.classList.add('active');
  // También marcar items con data-panel (para los que tienen onclick compuesto)
  document.querySelectorAll(`.nav-item[data-panel="${p}"]`).forEach(el => el.classList.add('active'));
  if(p==='recibos'){
    document.querySelector(`.nav-item[onclick="ir('contabilidad')"]`)?.classList.add('active');
  }
  $('topTitle').textContent=TITULOS[p]||p;
  // FIX: "Modo Consulta" (activado al buscar un folio en "Consultar Folios y
  // Expedientes", dentro del panel Generar Recibo) solo tiene sentido ahí —
  // pero ir() nunca lo quitaba al navegar a OTRO panel, así que si el usuario
  // se iba a Principal (u otro panel) sin darle antes a "Cerrar Consulta", el
  // body se quedaba con la clase 'modo-consulta' pegada para siempre, y con
  // ella el encabezado (buscador global + frase) oculto — incluso mientras
  // usaba Captura Rápida o Cobros Rápidos en Principal, sin relación alguna
  // con la consulta ya abandonada. Se cierra automáticamente al salir de
  // 'nuevo-recibo' hacia cualquier otro panel.
  if(p!=='nuevo-recibo' && document.body.classList.contains('modo-consulta') && typeof salirModoConsulta==='function'){
    salirModoConsulta();
  }
  // FIX: al regresar a Principal, la búsqueda de "Buscar cliente (por recibos)"
  // debe aparecer limpia — antes se quedaba con el texto y los resultados de
  // la última búsqueda visibles.
  if(p==='caja' && typeof limpiarBuscaCaja==='function') limpiarBuscaCaja();
  if(p==='contabilidad'){
    renderContab();
    // Ya no se posiciona la vista al fondo al abrir: con el orden invertido
    // (lo más reciente arriba), lo último capturado queda visible de inmediato
    // al abrir normal, sin necesidad de scroll automático.
  }
  if(p==='recibos')renderRec();
  if(p==='directorio'){renderDir();}
  if(p==='carpetas')renderCarp();
  if(p==='juicios'){renderJuicios();$('modal-expediente').style.display='none';$('juicios-lista-view').style.display='';if(typeof cerrarVisorAcuerdo==='function')cerrarVisorAcuerdo();if(typeof _leyesInicializarBtnAdmin==='function')_leyesInicializarBtnAdmin();}
  else if(typeof cerrarVisorAcuerdo === 'function' && document.getElementById('acuerdo-visor-overlay') && document.getElementById('acuerdo-visor-overlay').style.display !== 'none'){
    // Salir de Juicios hacia OTRA categoría con el visor de acuerdo/PDF abierto:
    // cerrarlo también aquí (no solo al volver a entrar) para que quede
    // realmente cerrado desde el momento en que se abandona la sección.
    cerrarVisorAcuerdo();
  }
  if(p==='pendientes')renderPend();
  if(p==='pre-recibo'){ _prInicializarPanel().catch(()=>{}); }
  if(p==='caja')renderCaja();
  if(p==='registro-civil')rcAbrirSubpanel('home');
  if(p==='escrituras'){ if(!Array.isArray(D.escrituras))D.escrituras=[]; escRender(); }
  if(p==='gestiones'){ if(!Array.isArray(D.gestiones))D.gestiones=[]; gestRender(); }
  if(p==='citas'){ if(!Array.isArray(D.citas))D.citas=[]; citasLimpiarPasadas().catch(()=>{}); renderCitas(); }
  if(p==='recibos'||p==='contabilidad'||p==='caja'){ repararFoliosDuplicados(); sincronizarPendientesPlacas(); }
  if(p==='pendientes'){ sincronizarPendientesPlacas(); }
  if(p==='configuracion'){ setTimeout(ocrCargarKeyEnCfg, 100); setTimeout(cfgMostrarFolioActual, 120); }
  if(p==='nuevo-recibo'){
    // Resetear el formulario completamente al navegar a este panel
    // EXCEPCIÓN: si vamos en modo restauración, NO limpiar — el setTimeout de
    // rgenConfirmar/rgenCapturar cargará los datos del recibo a restaurar justo después.
    if(typeof limpiarFormCompleto==='function' && !window._restauracionFolio && !window._edicionCompletaActiva) limpiarFormCompleto();
    // Sincronizar datos con Supabase si la sesión está activa y no hay recibos cargados
    if(typeof appData !== 'undefined' && typeof sbSession !== 'undefined' && sbSession
       && (!appData.recibos || !appData.recibos.length)
       && typeof cargarDatosIniciales === 'function') {
      cargarDatosIniciales();
    }
    renderHistorial();
    if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
    if(typeof generarQRPreview === 'function') generarQRPreview();
    // Leer folio fresco de Supabase en background para asegurar que el display es correcto
    if(window.SB && window.SB_DESPACHO_ID){
      window.SB.from('app_state').select('folio_actual')
        .eq('despacho_id', window.SB_DESPACHO_ID).single()
        .then(function(res){
          if(res.data && res.data.folio_actual){
            appData.folioActual = res.data.folio_actual;
            if(typeof REC !== 'undefined') REC.folioActual = res.data.folio_actual;
            // No actualizar display si ya estamos en modo actualización (B/C/D):
            // abrirModoActualizacion() ya puso el folio correcto y este SELECT lo pisaría.
            if(typeof actualizarFolioDisplay === 'function' && !document.body.classList.contains('modo-actualizacion') && !document.body.classList.contains('modo-edicion-completa')){
              actualizarFolioDisplay();
            }
          }
        }).catch(function(){});
    }
  }
  if(p==='configuracion'){setTimeout(renderConfig,50);}
}

function recargarReciboFrame() {
  var iframe = document.getElementById('recibo-iframe');
  if (iframe) {
    var src = iframe.src;
    iframe.src = 'about:blank';
    setTimeout(function(){ iframe.src = src; }, 100);
    if (typeof toast === 'function') toast('Sistema de recibos recargado');
  }
}

function _recibosMap() {
  const arr1 = (typeof REC !== 'undefined' ? REC.recibos : []) || [];
  const arr2 = (typeof appData !== 'undefined' ? appData.recibos : []) || [];
  // Deduplicar por folio+letra antes de construir el mapa — seleccionar la versión
  // con la letra MÁS ALTA (más reciente) para cada folio numérico.
  const byKey = {};
  [...arr1, ...arr2].forEach(r => {
    if (!r || r.folio == null || r.esComplemento) return;
    const k = r.folio + '|' + (r.letra || (typeof letraVersion==='function'?letraVersion(r):'A') || 'A');
    byKey[k] = r; // misma clave → sobrescribir (evita duplicados)
  });
  const map = {};
  Object.values(byKey).forEach(r => {
    const prev = map[r.folio];
    if (!prev) { map[r.folio] = r; return; }
    // Mantener la versión con la letra más alta (más reciente)
    const la = (r.letra    || (typeof letraVersion==='function'?letraVersion(r):'A')    || 'A');
    const lb = (prev.letra || (typeof letraVersion==='function'?letraVersion(prev):'A') || 'A');
    if (la > lb) map[r.folio] = r;
  });
  return map;
}

function _folioMY(fecha) {
  // Devuelve clave "MY2026" (mes en letras + año) para la fecha dada
  try {
    const [y, m] = (fecha || hoy()).split('-').map(Number);
    const cod = _MESES_FOLIO[(m || 1) - 1] || 'XX';
    return cod + y;
  } catch(e) { return 'XX0000'; }
}

function _csAbrirFolios(tipo){
  const sub = document.getElementById('cs-subtitulo');
  if(sub) sub.textContent = _CS_TIPO_LABEL[tipo] || ('FOLIOS — '+tipo.toUpperCase());
  const body = document.getElementById('cs-body');
  if(!body) return;
  // Agrupar TODAS las versiones (A, B, C...) de un mismo folio en un solo
  // "paquete" — el estatus del paquete lo decide la ÚLTIMA versión (la más
  // reciente cronológicamente), no cada letra por separado.
  const todosDelTipo = (typeof appData!=='undefined' && Array.isArray(appData.recibos) ? appData.recibos : [])
    .filter(function(r){ return r && (r.tipoTramite||'normal') === tipo; });
  const paquetes = {};
  todosDelTipo.forEach(function(r){
    const key = String(r.folio);
    if(!paquetes[key]) paquetes[key] = [];
    paquetes[key].push(r);
  });
  const recs = Object.keys(paquetes).map(function(key){
    const versiones = paquetes[key].slice().sort(function(a,b){
      const la = (a.letra||'A'), lb = (b.letra||'A');
      if(la !== lb) return la.localeCompare(lb);
      return String(a.fecha||'').localeCompare(String(b.fecha||''));
    });
    const primera = versiones[0];
    const ultima  = versiones[versiones.length-1];
    // La etiqueta del paquete siempre usa la letra de la PRIMERA versión
    // (normalmente "A") — nunca se muestran las letras secundarias B/C/D.
    const letra = primera.letra || 'A';
    const str = (typeof folioConLetra==='function') ? folioConLetra(primera.folio, primera.anio_folio, letra) : (primera.folio+letra);
    return { r: ultima, str: str, folioNum: parseFloat(primera.folio)||0 };
  }).sort(function(a,b){ return a.folioNum - b.folioNum; });
  const cancelados = recs.filter(function(x){ return !!x.r.cancelado; });
  const enProceso  = recs.filter(function(x){ return !x.r.cancelado && (parseFloat(x.r.saldoPendiente)||0) > 0.009; });
  const liquidados = recs.filter(function(x){ return !x.r.cancelado && (parseFloat(x.r.saldoPendiente)||0) <= 0.009; });
  let html = '<button onclick="_csHome()" style="background:none;border:1.5px solid rgba(200,149,42,0.4);border-radius:20px;padding:6px 14px;font-size:0.74rem;color:#8c6518;cursor:pointer;margin-bottom:14px;">← Volver</button>';
  html += '<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">'
    + '<div style="flex:1;min-width:120px;background:#fff8e8;border:1.5px solid #e0c060;border-radius:8px;padding:10px 14px;">'
    +   '<div style="font-size:0.6rem;color:#8c6518;letter-spacing:0.05em;">EN PROCESO</div>'
    +   '<div style="font-size:1.1rem;font-weight:700;color:#8c6518;">'+enProceso.length+'</div>'
    + '</div>'
    + '<div style="flex:1;min-width:120px;background:#f0fff4;border:1.5px solid #a0d0b0;border-radius:8px;padding:10px 14px;">'
    +   '<div style="font-size:0.6rem;color:#1a7a3a;letter-spacing:0.05em;">LIQUIDADOS</div>'
    +   '<div style="font-size:1.1rem;font-weight:700;color:#1a7a3a;">'+liquidados.length+'</div>'
    + '</div>'
    + '<div style="flex:1;min-width:120px;background:#fff0f0;border:1.5px solid #e0a0a0;border-radius:8px;padding:10px 14px;">'
    +   '<div style="font-size:0.6rem;color:#a03030;letter-spacing:0.05em;">CANCELADOS</div>'
    +   '<div style="font-size:1.1rem;font-weight:700;color:#c0161a;">'+cancelados.length+'</div>'
    + '</div>'
    + '</div>';
  function _chips(lista, colorBorde, colorTxt){
    if(!lista.length) return '<div style="font-size:0.72rem;color:#9a8050;padding:6px 0;">— ninguno —</div>';
    return '<div style="display:flex;flex-wrap:wrap;gap:6px;">'
      + lista.map(function(x){
        return '<span onclick="cerrarContabScanner();abrirFichaDesdeContab('+x.r.folio+')" '
          + 'title="'+esc(x.r.nombre||(x.r.clientes&&x.r.clientes[0]&&x.r.clientes[0].nombre)||'')+'" '
          + 'style="cursor:pointer;font-family:monospace;font-weight:700;font-size:0.76rem;padding:4px 10px;border-radius:14px;border:1.5px solid '+colorBorde+';color:'+colorTxt+';background:'+colorBorde+'18;">#'+esc(x.str)+'</span>';
      }).join('')
      + '</div>';
  }
  html += '<div style="margin-bottom:16px;">'
    + '<div style="font-weight:700;color:#8c6518;font-size:0.8rem;margin-bottom:8px;">🟡 En Proceso ('+enProceso.length+')</div>'
    + _chips(enProceso, '#e0c060', '#8c6518')
    + '</div>';
  html += '<div style="margin-bottom:16px;">'
    + '<div style="font-weight:700;color:#1a7a3a;font-size:0.8rem;margin-bottom:8px;">✅ Liquidados ('+liquidados.length+')</div>'
    + _chips(liquidados, '#a0d0b0', '#1a7a3a')
    + '</div>';
  html += '<div style="margin-bottom:16px;">'
    + '<div style="font-weight:700;color:#c0161a;font-size:0.8rem;margin-bottom:8px;">🔴 Cancelados ('+cancelados.length+')</div>'
    + _chips(cancelados, '#e0a0a0', '#c0161a')
    + '</div>';
  if(!recs.length){
    html += '<div style="padding:24px;text-align:center;color:#9a8050;">No hay folios de este tipo registrados.</div>';
  }
  body.innerHTML = html;
}

function renderRec(){
  // Fusionar REC.recibos y appData.recibos sin duplicados (por folio)
  // appData.recibos es la fuente principal (cargada desde Drive vía sincronizarFolio)
  // REC.recibos puede contener datos del archivo FOLIO_ID — unir ambas
  const recArr1=(typeof REC!=='undefined'?REC.recibos:[])||[];
  const recArr2=(typeof appData!=='undefined'?appData.recibos:[])||[];
  const foliosVistos=new Set();
  const rTodos=[...recArr2,...recArr1].filter(x=>{
    if(foliosVistos.has(x.folio))return false;
    foliosVistos.add(x.folio);return true;
  }).sort((function(a,b){ var fa=(a.fecha||a.fecha_recibo||'')+'T'+(a.hora||'00:00'); var fb=(b.fecha||b.fecha_recibo||'')+'T'+(b.hora||'00:00'); if(fb!==fa) return fb.localeCompare(fa); if(a.folio!==b.folio) return (b.folio||0)-(a.folio||0); var la=(a.letra||'A'),lb=(b.letra||'A'); return la<lb?-1:la>lb?1:0; }));
  // Mejora 4: aplicar filtros
  const r = aplicarFiltrosRecibos(rTodos);
  $('rTot').textContent=rTodos.length;
  const pend=rTodos.filter(x=>!x.cancelado&&x.saldoPendiente>0);
  const liq=rTodos.filter(x=>!x.cancelado&&!(x.saldoPendiente>0));
  $('rPend').textContent=pend.length;$('rLiq').textContent=liq.length;
  const _rSaldo=$('rSaldo'); if(_rSaldo) _rSaldo.textContent='$'+fmt(pend.reduce((s,x)=>s+(x.saldoPendiente||0),0));
  // Mejora 4: mostrar info del filtro
  const info = document.getElementById('recFiltroInfo');
  if (info) {
    if (r.length === rTodos.length) {
      info.textContent = '';
    } else {
      info.textContent = 'Mostrando ' + r.length + ' de ' + rTodos.length;
    }
  }
  const tb=$('tbRecibos'),v=$('recVacio');
  if(!r.length){
    tb.innerHTML='';
    v.style.display='block';
    if (rTodos.length > 0) {
      v.textContent='Ningún recibo coincide con los filtros aplicados.';
    } else {
      v.textContent=tokenOk()?'No hay recibos registrados aún.':'Inicia sesión para ver los recibos generados.';
    }
    return;
  }
  v.style.display='none';
  tb.innerHTML=r.map(x=>{
    const total=toNumero(x.total,0),ant=toNumero(x.anticipo,0);
    const saldo=x.saldoPendiente??Math.max(0,total-ant);
    const tag=x.cancelado?'<span class="tag tag-r">Cancelado</span>':saldo>0?'<span class="tag tag-a">Pendiente</span>':'<span class="tag tag-v">Liquidado</span>';
    return `<tr>
      <td class="mono" style="font-weight:700;color:var(--gold-d)">#${folioConLetra(x.folio, x.anio_folio, x.letra||letraVersion(x)||'A')}</td>
      <td>${esc(x.nombre)}</td><td style="font-size:0.7rem">${x.fecha||'—'}</td>
      <td class="monto">$${fmt(total)}</td>
      <td class="monto ing">$${fmt(ant)}</td>
      <td class="monto ${saldo>0?'egr':''}">${saldo>0?'$'+fmt(saldo):'—'}</td>
      <td>${tag}</td>
    </tr>`;
  }).join('');
}

function filtrarRecibos() {
  // Aplicar filtros con debounce de 200ms
  if (typeof debounce === 'function') {
    if (!filtrarRecibos._debounced) {
      filtrarRecibos._debounced = debounce(() => renderRec(), 200);
    }
    filtrarRecibos._debounced();
  } else {
    renderRec();
  }
}

function limpiarFiltrosRecibos() {
  const ids = ['recFiltroQ','recFiltroDesde','recFiltroHasta'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sel = document.getElementById('recFiltroEstado');
  if (sel) sel.value = 'todos';
  renderRec();
}

function exportarRecibosCSV() {
  const recArr1 = (typeof REC !== 'undefined' ? REC.recibos : []) || [];
  const recArr2 = (typeof appData !== 'undefined' ? appData.recibos : []) || [];
  const foliosVistos = new Set();
  const rTodos = [...recArr2, ...recArr1].filter(x => {
    if (foliosVistos.has(x.folio)) return false;
    foliosVistos.add(x.folio); return true;
  }).sort((function(a,b){ var fa=(a.fecha||a.fecha_recibo||'')+'T'+(a.hora||'00:00'); var fb=(b.fecha||b.fecha_recibo||'')+'T'+(b.hora||'00:00'); if(fb!==fa) return fb.localeCompare(fa); if(a.folio!==b.folio) return (b.folio||0)-(a.folio||0); var la=(a.letra||'A'),lb=(b.letra||'A'); return la<lb?-1:la>lb?1:0; }));
  // Aplicar los mismos filtros que están activos en pantalla
  const r = aplicarFiltrosRecibos(rTodos);
  if (r.length === 0) {
    toast('No hay recibos para exportar con los filtros actuales', 'err');
    return;
  }
  const BOM = '\uFEFF';
  const headers = [
    'Folio', 'Cliente', 'Fecha', 'Hora', 'Responsable',
    'Total', 'Anticipo', 'Saldo', 'Estado',
    'Tipo trámite', 'Placa', 'Conceptos', 'Trámites'
  ];
  const escapar = (s) => {
    if (s === null || s === undefined) return '""';
    const txt = String(s).replace(/"/g, '""');
    return '"' + txt + '"';
  };
  const lineas = [headers.map(escapar).join(',')];
  r.forEach(x => {
    const total = toNumero(x.total, 0);
    const ant = toNumero(x.anticipo, 0);
    const saldo = x.saldoPendiente ?? Math.max(0, total - ant);
    const estado = x.cancelado ? 'Cancelado' : (saldo > 0 ? 'Pendiente' : 'Liquidado');
    const conceptos = (x.conceptos || []).map(c => 
      (c.concepto || '') + (c.descripcion ? ': ' + c.descripcion : '') + 
      (c.precio ? ' ($' + c.precio + ')' : '')
    ).join(' | ');
    lineas.push([
      x.folio || '',
      x.nombre || '',
      x.fecha || x.fecha_recibo || '',
      x.hora || x.hora_recibo || '',
      x.responsable || '',
      total,
      ant,
      saldo,
      estado,
      x.tipoTramite || '',
      x.placa || '',
      conceptos,
      x.tramites || ''
    ].map(escapar).join(','));
  });
  const csv = BOM + lineas.join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = 'LEX_Recibos_' + hoy() + '.csv';
  a.click();
  toast('✓ ' + r.length + ' recibos exportados a CSV', 'ok');
}

function _perfilRenderRecibos(c){
  const nombre = (c.nombre||'').toLowerCase();
  const recibos = ((typeof appData!=='undefined'?appData.recibos:[])||[])
    .concat(REC.recibos||[])
    .filter((r,i,arr)=>arr.findIndex(x=>x.folio===r.folio)===i) // dedup
    .filter(r=>(r.nombre||'').toLowerCase().includes(nombre.split(' ')[0]) && nombre.length>2)
    .sort((a,b)=>b.folio-a.folio);
  const totalCobrado = recibos.reduce((s,r)=>s+(parseFloat(r.anticipo)||0),0);
  const totalPendiente = recibos.reduce((s,r)=>s+(parseFloat(r.saldoPendiente)||0),0);
  const totalFacturado = recibos.reduce((s,r)=>s+(parseFloat(r.total)||0),0);
  let html = '';
  if(recibos.length){
    html += `<div class="perfil-resumen">
      <div class="perfil-stat"><div class="perfil-stat-val" style="color:#4dca6a;">$${fmt(totalCobrado)}</div><div class="perfil-stat-lbl">Cobrado</div></div>
      <div class="perfil-stat"><div class="perfil-stat-val" style="color:#e8c875;">$${fmt(totalPendiente)}</div><div class="perfil-stat-lbl">Pendiente</div></div>
      <div class="perfil-stat"><div class="perfil-stat-val">$${fmt(totalFacturado)}</div><div class="perfil-stat-lbl">Total facturado</div></div>
    </div>`;
    html += recibos.map(r=>{
      const saldo = parseFloat(r.saldoPendiente)||0;
      const badge = saldo>0
        ? `<span class="perfil-row-badge" style="color:#e8c875;background:rgba(200,149,42,0.12);">$${fmt(saldo)} pend.</span>`
        : `<span class="perfil-row-badge" style="color:#4dca6a;background:rgba(40,180,80,0.1);">✓ Liquidado</span>`;
      const concepto = (r.conceptos||[]).map(c=>c.concepto).join(', ') || '—';
      return `<div class="perfil-row" onclick="cerrar('mPerfilContacto');abrirPreviaDesdeContab(${r.folio})">
        <div class="perfil-row-icon">🧾</div>
        <div class="perfil-row-main">
          <div class="perfil-row-title">#${folioConLetra(r.folio, r.anio_folio, r.letra||letraVersion(r)||'A')} — ${esc(concepto)}</div>
          <div class="perfil-row-sub">${r.fecha||''} · $${fmt(r.total||0)} total · $${fmt(r.anticipo||0)} cobrado</div>
        </div>
        ${badge}
      </div>`;
    }).join('');
  } else {
    html = `<div class="perfil-empty">📭 Sin recibos registrados</div>`;
  }
  $('perfilTabRecibos').innerHTML = html;
}

function _verDetalleCarpeta_ELIMINADA_(idx){
  const c = D.carpetas[idx];
  if(!c) return;
  const allRecibos=(typeof appData!=='undefined'?appData.recibos:REC.recibos)||[];
  const folioOficial=parseInt(String(c.reciboOficial||'').replace('#','').trim())||null;
  const recVinculados=allRecibos.filter(r=>
    (r.carpetaNum && String(r.carpetaNum)===String(c.num))||(folioOficial&&r.folio===folioOficial)||
    (r._carpetaInterna&&String(r._carpetaInterna)===String(c.num))||(r.carpeta&&String(r.carpeta)===String(c.num))
  );
  const totalCobrado=recVinculados.reduce((s,r)=>s+(parseFloat(r.anticipo)||0)+(parseFloat(r.totalAbonado)||0)-parseFloat(r.anticipo||0),0)||recVinculados.reduce((s,r)=>s+parseFloat(r.total||0),0);
  const totalPactado=parseFloat(c.totalPactado)||0;
  const saldoPend=Math.max(0,totalPactado-totalCobrado);
  const pct=totalPactado>0?Math.min(100,Math.round(totalCobrado/totalPactado*100)):0;
  function chip(label,bg,col,border){
    return `<span style="display:inline-block;padding:3px 12px;border-radius:3px;font-family:monospace;font-size:0.7rem;font-weight:700;background:${bg};color:${col};border:1.5px solid ${border};letter-spacing:0.04em;">${esc(label)}</span>`;
  }
  function estatusStyle(est){
    const e=(est||'').toUpperCase();
    if(e.includes('ARCHIVADO')) return chip(est,'#f5f0e8','#5a4a20','#b89840');
    if(e.includes('CONCLUIDO')||e.includes('ENTREGAD')) return chip(est,'#eaf4ed','#0d5c2a','#3aaa6a');
    if(e.includes('CANCELADO')) return chip(est,'#fdf0f0','#8a1010','#e06060');
    return chip(est,'#eef3ff','#1a3a8a','#6090d0');
  }
  const tipoLabel={juicio:'⚖️ Juicio',escritura:'📜 Escritura',registro_civil:'📋 Registro Civil',documentos:'📄 Documentos'}[c.tipoTramite]||c.tipoTramite||'—';
  let subtipoTexto='';
  if(c.tipoTramite==='juicio'&&c.juicioDesc) subtipoTexto=c.juicioDesc;
  else if(c.tipoTramite==='escritura'&&c.escTipo) subtipoTexto=c.escTipo+(c.escNotario?' · Not. '+c.escNotario:'')+(c.escVolumen?' · Vol. '+c.escVolumen:'');
  else if(c.tipoTramite==='registro_civil'&&c.regCivilTipo) subtipoTexto={registro_extemporaneo:'Registro Extemporáneo',rectificacion_nombre:'Rectificación de Nombre',aclaracion_nombre:'Aclaración de Nombre'}[c.regCivilTipo]||c.regCivilTipo;
  else if(c.tipoTramite==='documentos'&&c.docDesc) subtipoTexto=c.docDesc;
  let recibosHtml='<div style="color:#aaa;font-size:0.72rem;font-family:\'JetBrains Mono\',monospace;padding:8px 0;">Sin recibos vinculados</div>';
  if(recVinculados.length){
    recibosHtml=`<table style="width:100%;border-collapse:collapse;font-family:monospace;font-size:0.68rem;">
      <thead><tr style="background:#f5f0e4;border-bottom:1.5px solid #d4c890;">
        <th style="padding:6px 8px;text-align:left;font-weight:700;color:#5a4a20;">Folio</th>
        <th style="padding:6px 8px;text-align:left;font-weight:700;color:#5a4a20;">Fecha</th>
        <th style="padding:6px 8px;text-align:right;font-weight:700;color:#5a4a20;">Total</th>
        <th style="padding:6px 8px;text-align:center;font-weight:700;color:#5a4a20;">Estado</th>
      </tr></thead><tbody>
      ${recVinculados.map(r=>`<tr style="border-bottom:1px solid #e8e0d0;">
        <td style="padding:5px 8px;color:#1a3a7a;">#${r.folio||'—'}</td>
        <td style="padding:5px 8px;color:#555;">${r.fecha||r.fechaEmision||'—'}</td>
        <td style="padding:5px 8px;text-align:right;color:#0d5c2a;font-weight:700;">$${fmt(r.total||r.anticipo||0)}</td>
        <td style="padding:5px 8px;text-align:center;">${r.liquidado?'<span style="color:#0d5c2a;font-weight:700;">✅ Liq.</span>':'<span style="color:#9a6010;">⏳ Pend.</span>'}</td>
      </tr>`).join('')}
      </tbody></table>`;
  }
  const finSec = totalPactado>0?`
    <div style="margin-top:10px;padding:12px 14px;background:#f8f5ec;border:1.5px solid #d4c890;border-radius:4px;">
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:8px;">
        <div><div style="font-size:0.58rem;color:#9a8050;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">Pactado</div><div style="font-size:1rem;font-weight:700;color:#1a1a1a;font-family:monospace;">$${fmt(totalPactado)}</div></div>
        <div><div style="font-size:0.58rem;color:#9a8050;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">Cobrado</div><div style="font-size:1rem;font-weight:700;color:#0d5c2a;font-family:monospace;">$${fmt(totalCobrado)}</div></div>
        ${saldoPend>0?`<div><div style="font-size:0.58rem;color:#9a8050;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;">Pendiente</div><div style="font-size:1rem;font-weight:700;color:#c0161a;font-family:monospace;">$${fmt(saldoPend)}</div></div>`:
        '<div style="align-self:center;background:#eaf4ed;border:1.5px solid #3aaa6a;color:#0d5c2a;padding:4px 14px;border-radius:3px;font-family:\'JetBrains Mono\',monospace;font-size:0.72rem;font-weight:700;">✅ LIQUIDADO</div>'}
      </div>
      <div style="height:6px;background:#e0ddd5;border-radius:4px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${pct>=100?'#2aaa6a':'#c8952a'};border-radius:4px;transition:width 0.4s;"></div></div>
      <div style="text-align:right;font-family:monospace;font-size:0.62rem;color:#9a8050;margin-top:3px;">${pct}% cobrado</div>
    </div>`:
    (recVinculados.length?`<div style="padding:8px 0;font-family:monospace;font-size:0.7rem;color:#555;">Total cobrado: <strong style="color:#0d5c2a;">$${fmt(totalCobrado)}</strong> · ${recVinculados.length} recibo${recVinculados.length>1?'s':''}</div>`:``);
  const html=`
  <div style="font-family:monospace;">
    <!-- Encabezado expediente -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
      <div>
        <div style="font-size:0.6rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:4px;">Número de Expediente</div>
        <div style="font-family:monospace;font-size:1.5rem;font-weight:700;color:#1a1a1a;border:2px solid #1a1a1a;padding:4px 14px;display:inline-block;letter-spacing:0.05em;">${fmtCarpNumHTML(c.num)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:0.6rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Estatus</div>
        ${estatusStyle(c.estatus)}
        ${c.prioridad?`<div style="margin-top:4px;">${chip({URGENTE:'🔴 Urgente',BUEN_TIEMPO:'🟢 Buen Tiempo',REZAGADO:'🟡 Rezagado'}[c.prioridad]||c.prioridad,{URGENTE:'#fff0f0',BUEN_TIEMPO:'#eaf4ed',REZAGADO:'#fff8e8'}[c.prioridad]||'#f5f0e8',{URGENTE:'#8a1010',BUEN_TIEMPO:'#0d5c2a',REZAGADO:'#7a5010'}[c.prioridad]||'#5a4a20',{URGENTE:'#d05050',BUEN_TIEMPO:'#3aaa6a',REZAGADO:'#c8952a'}[c.prioridad]||'#c4b078')}</div>`:''}
      </div>
    </div>
    <!-- Separador -->
    <div style="border-top:1.5px solid #1a1a1a;margin-bottom:16px;"></div>
    <!-- Datos principales -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;margin-bottom:16px;">
      <div><div style="font-size:0.58rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">Nombre / Cliente</div>
        <div style="font-size:0.92rem;font-weight:600;color:#1a1a1a;">${esc(c.cliente||'—')}</div></div>
      <div><div style="font-size:0.58rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">Tipo de Trámite</div>
        <div style="font-size:0.88rem;color:#1a3a7a;font-weight:600;">${esc(tipoLabel)}</div></div>
      ${subtipoTexto?`<div style="grid-column:1/-1;"><div style="font-size:0.58rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">Subtipo / Detalle del Trámite</div>
        <div style="font-size:0.85rem;color:#333;font-style:italic;text-align:justify;">${esc(subtipoTexto)}</div></div>`:''}
      ${_carpObsArray(c).length?`<div style="grid-column:1/-1;background:#fffde8;border-left:3px solid #c8952a;padding:8px 12px;border-radius:0 4px 4px 0;"><div style="font-size:0.58rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Observaciones</div>
        <div style="font-size:0.82rem;color:#5a4a10;">${_carpObsHtmlEnum(c)}</div></div>`:''}
      ${c.ingreso?`<div><div style="font-size:0.58rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">Fecha de Ingreso</div>
        <div style="font-size:0.85rem;color:#333;">📅 ${esc(c.ingreso)}</div></div>`:''}
      ${c.celebEscritura?`<div><div style="font-size:0.58rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">Fecha Celebración Escritura</div>
        <div style="font-size:0.85rem;color:#333;">📅 ${esc(c.celebEscritura)}</div></div>`:''}
      ${c.reciboOficial?`<div><div style="font-size:0.58rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">Recibo Oficial Vinculado</div>
        <div style="font-size:0.85rem;color:#8c6518;font-weight:600;">🧾 ${esc(c.reciboOficial)}</div></div>`:''}
    </div>
    <!-- Separador -->
    <div style="border-top:1px solid #d0c8b0;margin-bottom:14px;"></div>
    <!-- Información financiera -->
    <div style="margin-bottom:14px;">
      <div style="font-size:0.62rem;color:#5a4a20;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:8px;">💰 Resumen Financiero</div>
      ${finSec||'<div style="color:#aaa;font-size:0.72rem;padding:4px 0;">Sin información financiera registrada</div>'}
    </div>
    <!-- Recibos -->
    <div style="border-top:1px solid #d0c8b0;margin-bottom:14px;padding-top:14px;">
      <div style="font-size:0.62rem;color:#5a4a20;text-transform:uppercase;letter-spacing:0.12em;font-weight:700;margin-bottom:8px;">🧾 Recibos Vinculados (${recVinculados.length})</div>
      ${recibosHtml}
    </div>
  </div>`;
  let modal=document.getElementById('mDetalleCarpeta');
  if(!modal){
    modal=document.createElement('div');
    modal.className='modal-ov';
    modal.id='mDetalleCarpeta';
    modal.innerHTML=`<div class="modal wide" style="max-width:680px;width:94vw;max-height:88vh;overflow-y:auto;box-sizing:border-box;margin:auto;">
      <div class="modal-hdr" style="background:linear-gradient(135deg,#fdfaf4,#f7f3e8);border-bottom:2px solid #d4b870;">
        <h3 id="mDetCarpTitulo" style="color:#8c6518;font-family:monospace;font-size:0.85rem;letter-spacing:0.1em;text-transform:uppercase;">Expediente</h3>
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="mDetCarpEditBtn" style="background:rgba(200,149,42,0.12);border:1.5px solid #d4b870;color:#8c6518;border-radius:8px;padding:5px 14px;font-family:monospace;font-size:0.7rem;font-weight:700;cursor:pointer;letter-spacing:0.05em;transition:background 0.15s;" onmouseover="this.style.background='rgba(200,149,42,0.22)'" onmouseout="this.style.background='rgba(200,149,42,0.12)'">✏️ Editar</button>
          <button class="modal-x" style="color:#8c6518;" onclick="cerrar('mDetalleCarpeta')">✕</button>
        </div>
      </div>
      <div class="modal-body" id="mDetCarpBody" style="padding:20px 24px;background:#faf8f4;"></div>
    </div>`;
    document.body.appendChild(modal);
  }
  const _carpIdx = idx;
  document.getElementById('mDetCarpTitulo').textContent='Expediente · '+(c.num||'');
  document.getElementById('mDetCarpBody').innerHTML=html;
  document.getElementById('mDetCarpEditBtn').onclick=function(){cerrar('mDetalleCarpeta');setTimeout(()=>abrirCarpeta(_carpIdx),100);};
  modal.classList.add('show');
}

function _juFoliosRecibo(j){
  if (!j) return [];
  const arr = Array.isArray(j.foliosRecibo) ? j.foliosRecibo : (j.folioRecibo ? [j.folioRecibo] : []);
  return arr.map(f => parseInt(f)).filter(f => !isNaN(f));
}

function _juGuardarFoliosRecibo(j, arr){
  const limpio = Array.from(new Set((arr || []).map(f => parseInt(f)).filter(f => !isNaN(f))));
  j.foliosRecibo = limpio;
  j.folioRecibo  = limpio.length ? limpio[0] : null;
}

function _jvrRenderActual(j){
  const actualWrap = document.getElementById('jvr-actual-wrap');
  const actualInfo = document.getElementById('jvr-actual-info');
  const foliosVinc = _juFoliosRecibo(j);
  if (foliosVinc.length && actualWrap && actualInfo) {
    const recibos = (typeof appData !== 'undefined' ? appData.recibos : null) || [];
    actualInfo.innerHTML = foliosVinc.map((fol, i) => {
      const recActual = recibos.find(r => r.folio === fol);
      let linea;
      if (recActual) {
        const total = parseFloat(recActual.total) || 0;
        const ant = parseFloat(recActual.anticipo) || 0;
        const saldo = recActual.saldoPendiente !== undefined ? parseFloat(recActual.saldoPendiente) : Math.max(0, total - ant);
        const estadoTxt = recActual.cancelado ? '❌ Cancelado' : (saldo > 0 ? '⚠ Pendiente $' + fmt(saldo) : '✅ Liquidado');
        linea = '<strong>Folio #' + folioFormato(recActual.folio) + '</strong> — ' + esc(recActual.nombre || '—') +
          '<br><span style="font-size:0.7rem;color:var(--muted);">$' + fmt(total) + ' total · $' + fmt(ant) + ' cobrado · ' + estadoTxt + '</span>';
      } else {
        linea = '<span style="color:#c0161a;">⚠ Folio #' + folioFormato(fol) + ' no se encontró en el sistema</span>';
      }
      return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0;' + (i ? 'border-top:1px solid rgba(26,122,58,0.15);' : '') + '">' +
        '<div style="font-size:0.82rem;color:var(--ink);flex:1;">' + linea + '</div>' +
        '<button onclick="desvincularReciboDeJuicio(' + fol + ')" style="flex-shrink:0;background:rgba(192,22,26,0.1);border:1px solid rgba(192,22,26,0.3);color:#c0161a;border-radius:4px;padding:4px 9px;font-size:0.65rem;font-family:monospace;cursor:pointer;font-weight:700;">✕ Quitar</button>' +
        '</div>';
    }).join('');
    actualWrap.style.display = '';
  } else if (actualWrap) {
    actualWrap.style.display = 'none';
  }
}

function abrirGestionReciboJuicio(idx) {
  if (idx < 0 || !D.juicios[idx]) return;
  _juicioVincRecIdx = idx;
  _juicioVincBusqueda = '';
  let modal = document.getElementById('modal-juicio-recibo');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-juicio-recibo';
    modal.className = 'modal-ov';
    modal.innerHTML = `<div class="modal" style="max-width:640px;width:95vw;max-height:92vh;display:flex;flex-direction:column;">
      <div class="modal-hdr">
        <h3 style="font-size:0.95rem;">🔗 Vincular Recibos al Juicio</h3>
        <button class="modal-x" onclick="cerrar('modal-juicio-recibo')">✕</button>
      </div>
      <div class="modal-body" style="padding:18px;">
        <div id="jvr-juicio-info" style="background:var(--surface2);padding:10px 14px;border-radius:6px;margin-bottom:14px;border-left:3px solid var(--gold);font-size:0.78rem;"></div>
        <div id="jvr-actual-wrap" style="display:none;margin-bottom:14px;padding:10px 14px;background:rgba(26,122,58,0.06);border:1px solid rgba(26,122,58,0.2);border-radius:6px;">
          <div style="font-family:monospace;font-size:0.6rem;color:var(--verde-d);letter-spacing:0.1em;margin-bottom:6px;">FOLIOS VINCULADOS A ESTE EXPEDIENTE</div>
          <div id="jvr-actual-info" style="display:flex;flex-direction:column;gap:2px;"></div>
        </div>
        <div class="field" style="margin-bottom:12px;">
          <label style="font-size:0.72rem;color:var(--muted);font-family:monospace;letter-spacing:0.05em;">🔍 Buscar recibo por folio o cliente</label>
          <input type="text" id="jvr-buscar" placeholder="Ej: 0106, García, Miguel..." oninput="filtrarRecibosParaJuicio()" style="width:100%;padding:8px 12px;border:1.5px solid var(--border-l);border-radius:5px;font-size:0.85rem;background:var(--surface);color:var(--ink);box-sizing:border-box;">
        </div>
        <div style="font-family:monospace;font-size:0.62rem;color:var(--muted);margin-bottom:8px;letter-spacing:0.05em;">RESULTADOS:</div>
        <div id="jvr-lista" style="max-height:340px;overflow-y:auto;border:1px solid var(--border-l);border-radius:6px;background:var(--surface);"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
          <button class="btn btn-ghost" onclick="cerrar('modal-juicio-recibo')">Cerrar</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  modal.classList.add('show');
  const j = D.juicios[idx];
  const infoEl = document.getElementById('jvr-juicio-info');
  if (infoEl) {
    infoEl.innerHTML = '<strong>' + esc(j.cliente) + '</strong>' +
      (j.expediente ? ' · Exp. ' + esc(j.expediente) : '') +
      '<br><span style="font-size:0.72rem;color:var(--muted);">' + esc(j.tipo || '') + '</span>';
  }
  // Mostrar todos los folios actualmente vinculados (puede haber más de uno)
  _jvrRenderActual(j);
  // Pre-llenar búsqueda con primer apellido o nombre del cliente para sugerir
  const buscarEl = document.getElementById('jvr-buscar');
  if (buscarEl) {
    // Sugerir el apellido del cliente (palabra más larga)
    const palabras = (j.cliente || '').split(/\s+/).filter(p => p.length > 2);
    const sugerencia = palabras.sort((a,b) => b.length - a.length)[0] || '';
    buscarEl.value = sugerencia;
    _juicioVincBusqueda = sugerencia.toLowerCase();
    setTimeout(() => { buscarEl.focus(); buscarEl.select(); }, 100);
  }
  filtrarRecibosParaJuicio();
}

function filtrarRecibosParaJuicio() {
  const lista = document.getElementById('jvr-lista');
  if (!lista) return;
  const inp = document.getElementById('jvr-buscar');
  const q = (inp ? inp.value : '').toLowerCase().trim();
  _juicioVincBusqueda = q;
  const recibos = (typeof appData !== 'undefined' ? appData.recibos : null) || [];
  if (!recibos.length) {
    lista.innerHTML = '<div style="padding:18px;text-align:center;color:var(--muted);font-size:0.78rem;">Sin recibos en el sistema. Conecta Drive primero.</div>';
    return;
  }
  // Filtrar
  let filtrados;
  if (!q) {
    // Sin búsqueda: mostrar los 30 más recientes
    filtrados = recibos.slice().sort((function(a,b){ var fa=(a.fecha||a.fecha_recibo||'')+'T'+(a.hora||'00:00'); var fb=(b.fecha||b.fecha_recibo||'')+'T'+(b.hora||'00:00'); if(fb!==fa) return fb.localeCompare(fa); if(a.folio!==b.folio) return (b.folio||0)-(a.folio||0); var la=(a.letra||'A'),lb=(b.letra||'A'); return la<lb?-1:la>lb?1:0; })).slice(0, 30);
  } else {
    filtrados = recibos.filter(r => {
      const folioStr = String(r.folio || '');
      const nombre = (r.nombre || '').toLowerCase();
      // Buscar por folio EXACTO o por nombre que contiene la búsqueda
      return folioStr === q || folioStr === folioFormato(parseInt(q)||0) || 
             nombre.includes(q);
    }).sort((function(a,b){ var fa=(a.fecha||a.fecha_recibo||'')+'T'+(a.hora||'00:00'); var fb=(b.fecha||b.fecha_recibo||'')+'T'+(b.hora||'00:00'); if(fb!==fa) return fb.localeCompare(fa); if(a.folio!==b.folio) return (b.folio||0)-(a.folio||0); var la=(a.letra||'A'),lb=(b.letra||'A'); return la<lb?-1:la>lb?1:0; })).slice(0, 50);
  }
  if (!filtrados.length) {
    lista.innerHTML = '<div style="padding:18px;text-align:center;color:var(--muted);font-size:0.78rem;">No se encontraron recibos con esa búsqueda.</div>';
    return;
  }
  // Folios actualmente vinculados para marcarlos como tal (puede ser más de uno)
  const j = D.juicios[_juicioVincRecIdx];
  const foliosActuales = j ? _juFoliosRecibo(j) : [];
  lista.innerHTML = filtrados.map(r => {
    const total = parseFloat(r.total) || 0;
    const ant = parseFloat(r.anticipo) || 0;
    const saldo = r.saldoPendiente !== undefined ? parseFloat(r.saldoPendiente) : Math.max(0, total - ant);
    const folioStr = folioFormato(r.folio, r.anio_folio);
    const esActual = foliosActuales.includes(r.folio);
    let estadoBadge;
    if (r.cancelado) estadoBadge = '<span style="background:rgba(192,22,26,0.1);color:#c0161a;padding:1px 6px;border-radius:3px;font-size:0.55rem;font-weight:700;">CANCELADO</span>';
    else if (saldo > 0) estadoBadge = '<span style="background:rgba(232,156,48,0.1);color:#9a6010;padding:1px 6px;border-radius:3px;font-size:0.55rem;font-weight:700;">PENDIENTE $' + fmt(saldo) + '</span>';
    else estadoBadge = '<span style="background:rgba(26,122,58,0.1);color:var(--verde-d);padding:1px 6px;border-radius:3px;font-size:0.55rem;font-weight:700;">LIQUIDADO</span>';
    return '<div onclick="vincularReciboAJuicio(' + r.folio + ')" style="padding:10px 14px;border-bottom:1px solid var(--border-l);cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px;transition:background 0.12s;' + 
      (esActual ? 'background:rgba(200,149,42,0.06);' : '') + '" ' +
      'onmouseover="this.style.background=\'rgba(200,149,42,0.1)\'" ' +
      'onmouseout="this.style.background=\'' + (esActual ? 'rgba(200,149,42,0.06)' : 'transparent') + '\'">' +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.74rem;font-weight:700;color:var(--gold-d);">#' + folioStr + (esActual ? ' <span style="font-size:0.55rem;color:var(--verde-d);background:rgba(26,122,58,0.1);padding:1px 5px;border-radius:3px;">YA VINCULADO</span>' : '') + '</div>' +
      '<div style="font-size:0.78rem;color:var(--ink);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(r.nombre || '—') + '</div>' +
      '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.62rem;color:var(--muted);margin-top:2px;">' + (r.fecha || '—') + ' · $' + fmt(total) + ' total · $' + fmt(ant) + ' cobrado</div>' +
      '</div>' +
      '<div style="text-align:right;">' + estadoBadge + '</div>' +
      '</div>';
  }).join('');
}

async function vincularReciboAJuicio(folio) {
  if (_juicioVincRecIdx < 0 || !D.juicios[_juicioVincRecIdx]) return;
  const j = D.juicios[_juicioVincRecIdx];
  const actuales = _juFoliosRecibo(j);
  if (actuales.includes(folio)) {
    toast('Ese folio ya está vinculado a este expediente', 'ok');
    return;
  }
  // Ya no se "cambia" un recibo por otro — se AGREGA, para poder tener varios
  // folios vinculados al mismo expediente (ej. anticipo y liquidación con
  // folios distintos). El modal se queda abierto para seguir agregando más.
  actuales.push(folio);
  _juGuardarFoliosRecibo(j, actuales);
  saveJuicios();
  _jvrRenderActual(j);
  filtrarRecibosParaJuicio();
  renderJuicios();
  try{ if (window._mexpIdxActual === _juicioVincRecIdx) _juRenderDatosDuros(j, _juicioVincRecIdx); }catch(e){}
  toast('✓ Recibo #' + folioFormato(folio) + ' vinculado al juicio', 'ok');
}

async function desvincularReciboDeJuicio(folio) {
  if (_juicioVincRecIdx < 0 || !D.juicios[_juicioVincRecIdx]) return;
  const j = D.juicios[_juicioVincRecIdx];
  const actuales = _juFoliosRecibo(j);
  if (!actuales.includes(folio)) return;
  const ok = await confirmarBonito({
    titulo: 'Desvincular recibo',
    mensaje: '¿Quitar la vinculación con el recibo #' + folioFormato(folio) + '?\n\nEl recibo NO se elimina, solo se desconecta del juicio.',
    btnSi: 'Sí, desvincular',
    btnNo: 'Cancelar'
  });
  if (!ok) return;
  _juGuardarFoliosRecibo(j, actuales.filter(f => f !== folio));
  saveJuicios();
  _jvrRenderActual(j);
  filtrarRecibosParaJuicio();
  renderJuicios();
  try{ if (window._mexpIdxActual === _juicioVincRecIdx) _juRenderDatosDuros(j, _juicioVincRecIdx); }catch(e){}
  toast('✓ Recibo desvinculado del juicio', 'ok');
}

function _mJuActualizarVinculaciones(j, idx){
  const info=$('jVincInfo'), btnC=$('jBtnVincCarpeta'), btnR=$('jBtnVincRecibo');
  if(!info||!btnC||!btnR) return;
  if(idx<0){
    info.innerHTML='⚠ Guarda el expediente primero para poder vincular su carpeta o su recibo.';
    btnC.disabled=true; btnR.disabled=true;
    return;
  }
  btnC.disabled=false; btnR.disabled=false;
  const carpetaTxt=(j&&j.driveFolderName)?('📁 '+esc(j.driveFolderName)):'📁 Sin carpeta vinculada';
  const recTxt=(j&&j.folioRecibo)?('🔗 Folio #'+folioFormato(j.folioRecibo)):'🔗 Sin recibo vinculado';
  info.innerHTML=carpetaTxt+'  ·  '+recTxt;
}

function _mJuVincularRecibo(){
  if(eiJ<0||!D.juicios[eiJ]){ toast('Guarda el expediente primero','err'); return; }
  jdetIdx=eiJ;
  cerrar('mJuicio');
  abrirVinculacionFolio();
}

function guardarJuicio(){
  try {
    const j = D.juicios[eiJ] || {};
    const ctrlInt = ($('jCtrlInt') ? $('jCtrlInt').value.trim() : '');
    const upd = {
      // Identificador único y marca de tiempo — necesarios para que
      // sincronizarFolio() pueda fusionar por id en vez de sobreescribir
      // todo D.juicios con la copia de Supabase (mismo fix que ya se aplicó
      // a carpetas/escrituras/citas/pendientes).
      id:         j.id || ('JUI-'+Date.now()),
      updatedAt:  Date.now(),
      cliente:    $('jCli').value.trim(),
      calidadCliente: $('jCalidad') ? $('jCalidad').value : (j.calidadCliente || ''),
      tipo:       $('jTipo').value,
      expediente: $('jExp').value.trim(),
      juzgado:    $('jJuz').value.trim(),
      fechaIngreso: $('jFIng').value,
      audiencia:  $('jAud').value,
      estatus:    $('jEst').value,
      tel:        $('jTel').value.trim(),
      movimiento: $('jMov').value.trim(),
      obs:        $('jObs').value.trim(),
      // Preservar campos que no están en el formulario
      driveFolderId:   j.driveFolderId   || null,
      driveFolderName: j.driveFolderName || null,
      folioRecibo:     j.folioRecibo     || null,
      foliosRecibo:    j.foliosRecibo    || (j.folioRecibo ? [j.folioRecibo] : []),
      carpetaFisica:   j.carpetaFisica   || null,
      acuerdos:        j.acuerdos        || [],
      terminos:        j.terminos        || [],
      historial:       j.historial       || [],
      controlInterno:  ctrlInt || j.controlInterno || null,
      expedienteNum:   j.expedienteNum   || null,
    };
    if (!upd.cliente) { toast('El cliente es obligatorio', 'err'); return; }
    if (eiJ >= 0) {
      D.juicios[eiJ] = upd;
    } else {
      D.juicios.unshift(upd);
    }
    // Guardar en localStorage inmediatamente (sin esperar a Supabase)
    try { backupLocal('D', D); } catch(e){ registrarError('catch vacio', e); }
    // Sincronizar con Supabase (async, no bloquea el cierre del modal)
    saveJuicios();
    // Actualizar UI
    renderJuicios();
    badges();
    cerrar('mJuicio');
    toast('Expediente guardado ✓', 'ok');
    // Si el detalle estaba abierto, refrescarlo
    if (jdetIdx >= 0 && eiJ === jdetIdx) abrirDetalle(jdetIdx);
  } catch(e) {
    console.error('[guardarJuicio]', e);
    toast('Error al guardar: ' + e.message, 'err');
  }
}

function abrirVinculacionFolio(){
  renderFoliosVinculacion('');
  $('folioQ').value='';
  $('mVincularFolio').classList.add('show');
}

function filtrarFoliosVinculacion(){
  renderFoliosVinculacion($('folioQ').value);
}

function vincularFolioRecibo(folio){
  const j=D.juicios[jdetIdx];if(!j)return;
  j.folioRecibo=folio;
  saveJuicios();
  cerrar('mVincularFolio');
  toast('Folio vinculado ✓','ok');
  abrirDetalle(jdetIdx);
}

function abrirVincularArchivo() {
  const folioActual = $('folio-display')?.textContent;
  const folioNum = parseInt(folioActual) || null;
  const folioStr = folioNum ? folioFormato(folioNum) : null;
  const carpetaExistente = folioStr
    ? D.carpetas.find(c => String(c.reciboOficial||'').replace('#','').trim() === folioStr)
    : null;
  _carpetaVinculadaActual = carpetaExistente || null;
  const wrapActual = document.getElementById('mVA-actual');
  if (carpetaExistente) {
    wrapActual.style.display = 'block';
    document.getElementById('mVA-actual-info').textContent =
      'Carpeta #' + carpetaExistente.num + ' — ' + (carpetaExistente.cliente || '');
    document.getElementById('mVA-actual-estado').textContent = _getInfoPagoCarpeta(carpetaExistente);
  } else {
    wrapActual.style.display = 'none';
  }
  document.getElementById('mVA-buscar').value = '';
  mVAFiltrar();
  document.getElementById('mVincularArchivo').classList.add('show');
  setTimeout(()=>document.getElementById('mVA-buscar')?.focus(), 120);
}

function seleccionarCarpetaArchivo(numCarpeta) {
  const c = D.carpetas.find(x=>x.num===numCarpeta);
  if (!c) return;
  const raw = parseInt($('folio-display')?.textContent||'0')||0;
  const folioStr = folioFormato(raw);
  c.reciboOficial = folioStr;
  save(); saveCarpetas();
  if (typeof appData!=='undefined'&&appData.recibos) {
    const rec = appData.recibos.find(r=>r.folio===raw);
    if (rec) { rec._carpetaInterna=numCarpeta; save(); }
  }
  _actualizarBadgeArchivoVinculado(c);
  _carpetaVinculadaActual = c;
  cerrarVincularArchivo();
  toast('🗂️ Recibo vinculado a Carpeta #'+numCarpeta+' — '+c.cliente,'ok');
}

function desvincularArchivo() {
  if (!_carpetaVinculadaActual) return;
  const c = D.carpetas.find(x=>x.num===_carpetaVinculadaActual.num);
  if (c) { c.reciboOficial=''; save(); saveCarpetas(); }
  _carpetaVinculadaActual=null;
  _actualizarBadgeArchivoVinculado(null);
  cerrarVincularArchivo();
  toast('Vinculación eliminada');
}

function cerrarVincularArchivo() {
  cerrar('mVincularArchivo');
  if (window._fichaAbiertaAntes) {
    window._fichaAbiertaAntes = false;
    setTimeout(function(){ if (reciboEnConsulta) abrirFichaFolio(); }, 400);
  }
}

function actualizarBadgeArchivoDesdeRecibo(folioNum) {
  const c = (D.carpetas||[]).find(c=>{
    const f=String(c.reciboOficial||'').replace('#','').trim();
    return f&&parseInt(f)===folioNum;
  });
  _actualizarBadgeArchivoVinculado(c||null);
  _carpetaVinculadaActual=c||null;
}

function saveJuicios(){
  // Estampar updatedAt en el/los juicio(s) recién modificado(s) — este es el
  // único punto por el que pasan TODAS las mutaciones de juicios (formulario
  // principal vía eiJ, y términos/acuerdos/control interno/vínculo Drive vía
  // jdetIdx), así que estampar aquí cubre todos los flujos sin tener que
  // repetirlo en cada función individual. Necesario para que el merge de
  // sincronizarFolio() sepa que esta versión es más reciente que la que ya
  // tenga Supabase (mismo patrón que carpetas/escrituras/citas/pendientes).
  [eiJ, jdetIdx].forEach(function(_idx){
    if(_idx >= 0 && D.juicios[_idx]) D.juicios[_idx].updatedAt = Date.now();
  });
  // Registrar timestamp de modificación local (cubre también eliminaciones)
  // para que sincronizarFolio() no restaure datos viejos de Supabase.
  D._juiciosModTs = Date.now();
  _ultimoSyncPropio = Date.now();
  console.log('[saveJuicios] Guardando', (D.juicios||[]).length, 'juicios en Supabase...');
  syncEstadoSupabase()
    .then(function(){ console.log('[saveJuicios] ✅ Guardado exitoso — juicios:', (D.juicios||[]).length); })
    .catch(function(e){ console.error('[saveJuicios] ❌ ERROR al guardar:', e); });
}

function _marcarExpDigitalVinculado(folio, carpetaId){
  if(!folio || !carpetaId || typeof appData==='undefined' || !Array.isArray(appData.recibos)) return;
  const fecha = new Date().toLocaleDateString('es-MX',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).split('/').reverse().join('-');
  const url = 'https://drive.google.com/drive/folders/' + carpetaId;
  appData.recibos.forEach(function(rv){
    if(Number(rv.folio) === Number(folio)){
      if(!rv.expDigital) rv.expDigital = {};
      rv.expDigital.estatus = 'vinculado';
      rv.expDigital.driveFolderId = carpetaId;
      rv.expDigital.driveFolderUrl = url;
      rv.expDigital.fecha = fecha;
    }
  });
}

async function toggleP(idx){
  const p=D.pendientes[idx];
  // Blindaje: un pendiente de Placas vinculado a un recibo no se marca
  // resuelto a mano — solo desaparece solo cuando el recibo se liquida o
  // se cancela (ver sincronizarPendientesPlacas).
  if(p && (p.seccion === 'placas' || p.reciboVinculadoFolio)){
    toast('Este pendiente se sincroniza con el recibo — no se marca resuelto a mano.');
    return;
  }
  // Restablecer: si ya estaba resuelto (viendo "🗑 Resueltos"), regresa a
  // Activos. fechaReactivacion queda como su nueva clave de orden, así que
  // en la numeración dinámica cae al final (número más alto), como si fuera
  // nuevo — no vuelve a su posición histórica original.
  if(p && p.resuelto){
    const auth2 = await pedirAutorizacion();
    if(auth2 === null) return;
    p.resuelto = false;
    p.fechaResuelto = null;
    p.fechaReactivacion = new Date().toISOString();
    p.fechaMod = new Date().toISOString();
    save();renderPend();badges();syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
    toast('↩️ Restablecido — autorizó '+auth2.nombre);
    return;
  }
  // Marcar como resuelto ya NO borra de inmediato (17/ago/2026, a petición
  // del usuario): se conserva 10 días en "🗑 Resueltos" por si hace falta
  // consultarlo, y de ahí se purga solo (ver _pendPurgarResueltosViejos).
  const auth = await pedirAutorizacion();
  if(auth === null) return;
  const ok = await confirmarBonito({
    titulo: 'Marcar como resuelto',
    mensaje: '"'+p.texto+'"\n\nSe quitará de la lista de activos. Se conserva 10 días en "Resueltos" y después se borra para siempre.',
    btnSi: 'Sí, marcar resuelto', btnNo: 'Cancelar', peligro: false
  });
  if(!ok) return;
  p.resuelto = true;
  p.fechaResuelto = hoy();
  p.fechaMod = new Date().toISOString();
  save();renderPend();badges();syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
  toast('✅ Resuelto — autorizó '+auth.nombre);
}

function abrirPendiente(idx){
  eiP = (idx !== undefined && idx >= 0) ? idx : -1;
  const p = eiP >= 0 ? D.pendientes[eiP] : null;
  const titulo = document.getElementById('mPendTitulo');
  const btnElim = document.getElementById('pBtnElim');
  if(titulo) titulo.textContent = p ? '✏ Editar Pendiente' : '📌 Nuevo Pendiente';
  // Los pendientes de Placas vinculados a un recibo YA NO se pueden eliminar
  // a mano — se sincronizan solos con sincronizarPendientesPlacas(): el
  // pendiente desaparece automáticamente en cuanto el recibo se liquida
  // (saldo en $0) o se cancela. Se oculta el botón "Eliminar" en ese caso.
  const _esPlacasVinculado = !!(p && (p.seccion === 'placas' || p.reciboVinculadoFolio));
  if(btnElim) btnElim.style.display = (p && !_esPlacasVinculado) ? 'inline-flex' : 'none';
  // La opción "🚗 Placas" del selector de sección solo debe quedar disponible
  // cuando se está viendo un pendiente de placas YA EXISTENTE (vinculado a un
  // recibo) — nunca al crear uno nuevo ni al editar uno de otra sección, para
  // que nadie pueda crear a mano un pendiente de placas "huérfano" que el
  // sincronizador nunca podría resolver ni eliminar automáticamente.
  const _opcionPlacas = document.getElementById('pSecOpcionPlacas');
  if(_opcionPlacas) _opcionPlacas.disabled = !_esPlacasVinculado;
  const _avisoSyncId = 'pAvisoSyncPlacas';
  document.getElementById(_avisoSyncId)?.remove();
  if(_esPlacasVinculado){
    const _ftr = document.querySelector('#mPendienteInner .modal-ftr');
    if(_ftr && _ftr.parentNode){
      const aviso = document.createElement('div');
      aviso.id = _avisoSyncId;
      aviso.style.cssText = 'font-size:0.68rem;color:#7a6840;background:rgba(200,149,42,0.08);border:1px solid rgba(200,149,42,0.25);border-radius:6px;padding:7px 12px;margin:0 18px 10px;line-height:1.4;';
      aviso.textContent = '🔒 Este pendiente se sincroniza con el recibo — desaparecerá solo cuando se liquide o se cancele.';
      _ftr.parentNode.insertBefore(aviso, _ftr);
    }
  }
  // Cerrar overlay de detalle si estuviera abierto
  document.getElementById('_det-pend-ov')?.remove();
  // Determinar sección — priorizar campo seccion guardado
  const secEl = document.getElementById('pSec');
  let sec = 'otros';
  if(p){
    if(p.seccion && ['placas','escrituras','juicios','otros'].includes(p.seccion)) sec = p.seccion;
    else if(p.tipoVehicular || p.placasEstado || p.placasNumero || p.descripcionPlacas) sec = 'placas';
    else if(p.escComprador || p.escEtapa) sec = 'escrituras';
    else if(p.juiExpediente || p.juiEtapa) sec = 'juicios';
  }
  if(secEl){ secEl.value = sec; pSecCambio(); }
  if(p){
    if(sec === 'placas') _pPlacasCargar(p);
    else if(sec === 'escrituras') _pEscCargar(p);
    else if(sec === 'juicios') _pJuiCargar(p);
    else {
      const _s=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v||'';};
      _s('pOtrosNombre',p.persona);_s('pOtrosDesc',p.obs||p.texto);
    }
    const priEl=document.getElementById('pPri');if(priEl)priEl.value=p.prioridad||'normal';
    const reEl=document.getElementById('pRe');if(reEl)reEl.value=p.resp||'Antonieta';
    const fEl=document.getElementById('pFecha');if(fEl)fEl.value=p.fechaLimite||'';
    const cEl=document.getElementById('pCarpeta');if(cEl)cEl.value=p.carpeta||'';
  } else {
    _pPlacasLimpiar();
    _pEscCargar(null);
    _pJuiCargar(null);
    ['pPri','pRe','pFecha','pCarpeta','pOtrosNombre','pOtrosDesc'].forEach(id=>{
      const e=document.getElementById(id);if(e)e.value = id==='pPri'?'normal':id==='pRe'?'Antonieta':'';
    });
  }
  const modal = document.getElementById('mPendiente');
  if(modal) modal.classList.add('show');
}

function _pPlacasCargar(p){
  _pPlacasState.tipo         = (p && p.tipoVehicular) || '';
  _pPlacasState.reciboFolio  = (p && p.reciboVinculadoFolio) || '';
  _pPlacasState.documentos   = Array.isArray(p && p.documentos) ? p.documentos.slice() : [];
  const _set = (id, val) => { const e = document.getElementById(id); if (e) e.value = val || ''; };
  _set('pPlacasNombre', p && (p.persona || p.nombrePlacas));
  _set('pPlacasEstado', p && p.placasEstado);
  _set('pPlacasNumero', p && p.placasNumero);
  _set('pPlacasDesc',   p && p.descripcionPlacas);
  _set('pPlacasReciboFolio', _pPlacasState.reciboFolio ? '#'+folioFormato(_pPlacasState.reciboFolio) : '');
  // Reflejar tipo en botones
  document.querySelectorAll('#pPlacasTipoBtns .placas-tipo-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.tipo === _pPlacasState.tipo);
  });
  // Mostrar info del recibo vinculado si existe
  _pPlacasActualizarInfoRecibo();
  // Actualizar lista de docs adjuntos
  _pPlacasRenderDocs();
}

function _pPlacasLimpiar(){
  _pPlacasState = { tipo:'', reciboFolio:'', documentos:[] };
  const ids = ['pPlacasNombre','pPlacasEstado','pPlacasNumero','pPlacasDesc','pPlacasReciboFolio'];
  ids.forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.querySelectorAll('#pPlacasTipoBtns .placas-tipo-btn').forEach(b => b.classList.remove('active'));
  _pPlacasActualizarInfoRecibo();
  _pPlacasRenderDocs();
}

function _pPlacasRecopilar(){
  return {
    nombre:              document.getElementById('pPlacasNombre')?.value.trim() || '',
    placasEstado:        document.getElementById('pPlacasEstado')?.value.trim() || '',
    placasNumero:        document.getElementById('pPlacasNumero')?.value.trim() || '',
    tipoVehicular:       _pPlacasState.tipo || '',
    descripcionPlacas:   document.getElementById('pPlacasDesc')?.value.trim() || '',
    reciboVinculadoFolio:_pPlacasState.reciboFolio || '',
    documentos:          _pPlacasState.documentos.slice()
  };
}

function abrirSelectorReciboVehicular(){
  document.getElementById('mSelRecVeh').classList.add('show');
  document.getElementById('srvQ').value = '';
  renderSelectorReciboVehicular();
}

function renderSelectorReciboVehicular(){
  const q = (document.getElementById('srvQ')?.value || '').toLowerCase().trim();
  const cont = document.getElementById('srvLista');
  if (!cont) return;
  // Obtener todos los recibos vehiculares (no complementos, no cancelados)
  const recibos = ((typeof appData !== 'undefined' ? appData : (typeof REC !== 'undefined' ? REC : {recibos:[]})).recibos || [])
    .filter(r => r.tipoTramite === 'vehicular' && !r.esComplemento && !r.cancelado);
  if (!recibos.length) {
    cont.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:0.78rem;">No hay recibos vehiculares registrados todavía.</div>';
    return;
  }
  // Filtrar por búsqueda (nombre, folio, placa)
  const filtrados = recibos.filter(r => {
    if (!q) return true;
    const nombre = (r.nombre || '').toLowerCase();
    const folio  = String(r.folio || '');
    const placa  = (r.placa || r.placasEntregadas || '').toLowerCase();
    return nombre.includes(q) || folio.includes(q) || placa.includes(q);
  });
  if (!filtrados.length) {
    cont.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:0.78rem;">Sin coincidencias.</div>';
    return;
  }
  // Ordenar por fecha desc, folio desc, letra asc
  filtrados.sort((function(a,b){ var fa=(a.fecha||a.fecha_recibo||'')+'T'+(a.hora||'00:00'); var fb=(b.fecha||b.fecha_recibo||'')+'T'+(b.hora||'00:00'); if(fb!==fa) return fb.localeCompare(fa); if(a.folio!==b.folio) return (b.folio||0)-(a.folio||0); var la=(a.letra||'A'),lb=(b.letra||'A'); return la<lb?-1:la>lb?1:0; }));
  cont.innerHTML = filtrados.map(r => {
    const folioStr = '#' + folioFormato(r.folio||0);
    const placa = r.placa || r.placasEntregadas || '';
    const fecha = r.fecha_recibo || r.fecha || '';
    const veh = [r.marca, r.anio].filter(Boolean).join(' ');
    return '<div class="srv-item" onclick="vincularReciboVehicular(\''+esc(String(r.folio))+'\')">' +
      '<div class="srv-item-folio">'+folioStr+'</div>' +
      '<div class="srv-item-info">' +
        '<div class="srv-item-nombre">'+esc(r.nombre||'(Sin nombre)')+'</div>' +
        '<div class="srv-item-meta">' +
          (placa ? '🔢 '+esc(placa)+' · ' : '') +
          (veh ? '🚗 '+esc(veh)+' · ' : '') +
          (fecha ? '📅 '+esc(fecha) : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function pPlacasDesvincular(){
  _pPlacasState.reciboFolio = '';
  document.getElementById('pPlacasReciboFolio').value = '';
  _pPlacasActualizarInfoRecibo();
}

function _pPlacasActualizarInfoRecibo(){
  const info = document.getElementById('pPlacasReciboInfo');
  const desv = document.getElementById('pPlacasDesvincularBtn');
  if (!info || !desv) return;
  if (!_pPlacasState.reciboFolio) {
    info.style.display = 'none';
    desv.style.display = 'none';
    return;
  }
  const r = ((typeof appData !== 'undefined' ? appData : (typeof REC !== 'undefined' ? REC : {recibos:[]})).recibos || [])
    .find(x => String(x.folio) === String(_pPlacasState.reciboFolio));
  if (!r) {
    info.style.display = 'block';
    info.innerHTML = '<span style="color:var(--rojo);">⚠ No se encontró el recibo #'+esc(_pPlacasState.reciboFolio)+' (puede haber sido eliminado).</span>';
    desv.style.display = '';
    return;
  }
  const placa = r.placa || r.placasEntregadas || '';
  info.style.display = 'block';
  info.innerHTML = '<strong>'+esc(r.nombre||'(Sin nombre)')+'</strong>' +
    (placa ? ' · 🔢 '+esc(placa) : '') +
    (r.fecha_recibo || r.fecha ? ' · 📅 '+esc(r.fecha_recibo||r.fecha) : '');
  desv.style.display = '';
}

function _pPlacasAbrirR2(key, nombre, driveFileId){
  const ext = nombre.split('.').pop().toLowerCase();
  const tipo = ext==='pdf' ? 'application/pdf' : 'image/'+ext;
  // Drive primero
  if (driveFileId) {
    _pVerDoc({nombre:nombre, tipo:tipo, driveFileId:driveFileId});
    return;
  }
  // Legado R2
  if (typeof window.descargarR2 !== 'function') return;
  window.descargarR2(key, 'recibos').then(blob => {
    if (!blob) { toast('No se pudo cargar el archivo','err'); return; }
    _pVerDoc({nombre:nombre, tipo:tipo, r2path:key, bucket:'placas'});
  });
}

function _irAReciboVinculado(folio){
  if (!folio) return;
  ir('nuevo-recibo');
  setTimeout(() => {
    const inp = $('folio_anterior');
    if (inp) {
      inp.value = String(folio).replace(/^0+/,''); // normalizar a número
      if (typeof cargarHistorialFolio === 'function') cargarHistorialFolio();
    }
  }, 300);
}

function _pEscLimpiar(){
  _pEscState = { documentos: [] };
  ['pEscComprador','pEscVendedor','pEscArchivoFisico','pEscNotaria','pEscVolumen','pEscInstrumento','pEscFolio','pEscCosto','pEscCobrado','pEscServiciosComp','pEscSiguientePaso','pEscEtapa','pEscDesc'].forEach(id=>{
    const e = document.getElementById(id); if (e) e.value = '';
  });
  const rEl = document.getElementById('pEscResto'); if(rEl) rEl.value = '';
  _pEscRenderDocs();
}

function pEscActualizarResto(){
  const costo   = parseFloat(document.getElementById('pEscCosto')?.value)||0;
  const cobrado = parseFloat(document.getElementById('pEscCobrado')?.value)||0;
  const rEl = document.getElementById('pEscResto');
  if (!rEl) return;
  if (costo <= 0) { rEl.value = ''; rEl.style.color='#1a7a3a'; return; }
  const resto = costo - cobrado;
  if (resto <= 0) {
    rEl.value = '✅ LIQUIDADO';
    rEl.style.color = '#1a7a3a';
  } else {
    rEl.value = '$ ' + resto.toFixed(2);
    rEl.style.color = resto > 0 ? '#c0161a' : '#1a7a3a';
  }
}

function pEscCompradorInput(){
  const q = (document.getElementById('pEscComprador')?.value || '').trim().toLowerCase();
  const sug = document.getElementById('pEscCompradorSug');
  if (!sug) return;
  if (q.length < 2) { sug.style.display = 'none'; return; }
  const src = ((typeof appData !== 'undefined' ? appData : (typeof REC !== 'undefined' ? REC : {recibos:[]})).recibos || [])
    .filter(r => !r.esComplemento && !r.cancelado);
  const visto = {};
  src.filter(r => r.nombre && r.nombre.toLowerCase().includes(q))
     .sort((a,b) => (parseInt(b.folio)||0) - (parseInt(a.folio)||0))
     .forEach(r => { if (!visto[r.nombre.toLowerCase()]) visto[r.nombre.toLowerCase()] = r; });
  const matches = Object.values(visto).slice(0, 6);
  if (!matches.length) { sug.style.display = 'none'; return; }
  sug.innerHTML = matches.map(r => {
    return `<div onclick="document.getElementById('pEscComprador').value='${esc(r.nombre).replace(/'/g,"\\'")}';document.getElementById('pEscCompradorSug').style.display='none';"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-l);font-size:0.8rem;transition:background 0.1s;"
      onmouseover="this.style.background='var(--gold-pale)'" onmouseout="this.style.background=''">
      <span style="font-weight:600;color:var(--ink);">${esc(r.nombre)}</span>
      <span style="font-family:monospace;font-size:0.6rem;color:#7a4a00;margin-left:8px;">Folio #${folioConLetra(r.folio, r.anio_folio, r.letra||letraVersion(r)||'A')}</span>
    </div>`;
  }).join('');
  sug.style.display = 'block';
}

function pSeleccionarPersona(folio, nombre, tramite){
  $('pPersona').value=nombre;
  // Autorellenar carpeta con el folio
  $('pCarpeta').value=folioFormato(folio);
  // Mostrar badge de folio vinculado
  const wrap=document.getElementById('pFolioVinculadoWrap');
  const info=document.getElementById('pFolioVinculadoInfo');
  if(wrap && info){
    const src=(typeof appData!=='undefined'?appData:REC).recibos||[];
    const r=src.find(x=>x.folio===folio);
    info.textContent='#'+folioFormato(folio)+' · '+nombre+(r&&r.fecha?' · '+fmtFecha(r.fecha):'');
    wrap.style.display='flex';
  }
  // Ocultar sugerencias
  const sug=document.getElementById('pPersonaSug');
  if(sug) sug.style.display='none';
}

function pLimpiarFolioVinculado(){
  const wrap=document.getElementById('pFolioVinculadoWrap');
  if(wrap) wrap.style.display='none';
  $('pCarpeta').value='';
}

function pPlacasNombreInput(){
  const q = (document.getElementById('pPlacasNombre')?.value || '').trim().toLowerCase();
  const sug = document.getElementById('pPlacasNombreSug');
  if (!sug) return;
  if (q.length < 2) { sug.style.display = 'none'; return; }
  // Buscar SOLO en recibos vehiculares (no complementos, no cancelados)
  const src = ((typeof appData !== 'undefined' ? appData : (typeof REC !== 'undefined' ? REC : {recibos:[]})).recibos || [])
    .filter(r => r.tipoTramite === 'vehicular' && !r.esComplemento && !r.cancelado);
  // Agrupar por nombre — quedarse con el recibo más reciente por cliente
  const visto = {};
  src.filter(r => r.nombre && r.nombre.toLowerCase().includes(q))
     .sort((a,b) => (parseInt(b.folio)||0) - (parseInt(a.folio)||0))
     .forEach(r => { if (!visto[r.nombre.toLowerCase()]) visto[r.nombre.toLowerCase()] = r; });
  const matches = Object.values(visto).slice(0, 6);
  if (!matches.length) { sug.style.display = 'none'; return; }
  sug.innerHTML = matches.map(r => {
    const placa = r.placa || r.placasEntregadas || '';
    return `<div onclick="pPlacasSelNombre('${String(r.folio)}')"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-l);font-size:0.8rem;transition:background 0.1s;"
      onmouseover="this.style.background='var(--gold-pale)'" onmouseout="this.style.background=''">
      <span style="font-weight:600;color:var(--ink);">${esc(r.nombre)}</span>
      <span style="font-family:monospace;font-size:0.6rem;color:#1a4a8a;margin-left:8px;">Folio #${folioConLetra(r.folio, r.anio_folio, r.letra||letraVersion(r)||'A')}</span>
      <div style="font-size:0.65rem;color:var(--muted);margin-top:2px;">${esc(fmtFecha(r.fecha)||'')}${placa ? ' · 🔢 '+esc(placa) : ''}</div>
    </div>`;
  }).join('');
  sug.style.display = 'block';
}

function pPlacasSelNombre(folio){
  // Reusar la lógica de vinculación de recibo (auto-rellena nombre, placa, estado)
  vincularReciboVehicular(folio);
  // Ocultar sugerencias
  const sug = document.getElementById('pPlacasNombreSug');
  if (sug) sug.style.display = 'none';
}

function globalSearch(q){
  const res=document.getElementById('global-search-results');
  clearTimeout(_gsTimer);
  q=(q||'').trim();
  if(q.length<2){res.classList.remove('show');res.innerHTML='';return;}
  _gsTimer=setTimeout(()=>{
    const ql=q.toLowerCase();
    const resultados=[];
    // ── RECIBOS ──
    const recibos=((typeof appData!=='undefined'?appData.recibos:[])||[]).concat(REC.recibos||[]);
    const recMap={};
    recibos.forEach(r=>{if(r&&r.folio!=null)recMap[r.folio]=r;});
    Object.values(recMap).filter(r=>{
      const txt=(r.nombre||'')+(r.conceptos||[]).map(c=>c.concepto+c.descripcion).join('')+(r.folio||'');
      return txt.toLowerCase().includes(ql);
    }).slice(0,5).forEach(r=>{
      const saldo=r.saldoPendiente||0;
      resultados.push({
        tipo:'recibo', icono:'🧾',
        titulo: r.nombre||'—',
        sub: '#'+folioConLetra(r.folio, r.anio_folio, r.letra||letraVersion(r)||'A')+' · '+fmtFecha(r.fecha)+' · $'+fmt(r.anticipo||0),
        badge: saldo>0?{txt:'$'+fmt(saldo)+' pendiente',color:'#e8c875',bg:'rgba(200,149,42,0.15)'}:{txt:'Liquidado',color:'#4dca6a',bg:'rgba(40,180,80,0.12)'},
        accion:()=>{ abrirPreviaDesdeContab(r.folio); }
      });
    });
    // ── DIRECTORIO ──
    (D.directorio||[]).filter(d=>{
      return ((d.nombre||'')+(d.tel||'')+(d.tel2||'')+(d.desc||'')).toLowerCase().includes(ql);
    }).slice(0,4).forEach(d=>{
      const idx = D.directorio.indexOf(d);
      resultados.push({
        tipo:'directorio', icono:'👤',
        titulo: d.nombre||'—',
        sub: (d.tipo||'')+(d.tel?' · '+d.tel:'')+(d.pob?' · '+d.pob:''),
        badge:null,
        accion:()=>{ ir('directorio'); setTimeout(()=>{ _abrirPerfilContacto(idx); }, 150); }
      });
    });
    // ── JUICIOS ──
    (D.juicios||[]).filter(j=>{
      return ((j.nombre||'')+(j.expediente||'')+(j.juzgado||'')+(j.descripcion||'')).toLowerCase().includes(ql);
    }).slice(0,4).forEach(j=>{
      const idx = D.juicios.indexOf(j);
      resultados.push({
        tipo:'juicio', icono:'⚖️',
        titulo: j.nombre||'—',
        sub: (j.expediente?'Exp. '+j.expediente+' · ':'')+( j.juzgado||''),
        badge: j.estatus?{txt:j.estatus,color:'#a0c0ff',bg:'rgba(100,150,255,0.12)'}:null,
        accion:()=>{ ir('juicios'); setTimeout(()=>{ abrirDetalle(idx); }, 150); }
      });
    });
    // ── PENDIENTES ──
    (D.pendientes||[]).filter(p=>{
      return ((p.nombre||'')+(p.texto||'')+(p.desc||'')+(p.resp||'')).toLowerCase().includes(ql);
    }).slice(0,4).forEach(p=>{
      const idx = D.pendientes.indexOf(p);
      resultados.push({
        tipo:'pendiente', icono:'📌',
        titulo: p.texto||p.nombre||'—',
        sub: (p.persona?' · '+p.persona:'')+(p.resp?' · '+p.resp:''),
        badge: p.resuelto?{txt:'Resuelto',color:'#4dca6a',bg:'rgba(40,180,80,0.12)'}:{txt:'Activo',color:'#e8c875',bg:'rgba(200,149,42,0.12)'},
        accion:()=>{ abrirPendiente(idx); }
      });
    });
    // ── CARPETAS ──
    (D.carpetas||[]).filter(c=>{
      return ((c.num||'')+(c.cliente||'')+(c.descripcion||'')).toLowerCase().includes(ql);
    }).slice(0,3).forEach(c=>{
      const idx = D.carpetas.indexOf(c);
      resultados.push({
        tipo:'carpeta', icono:'📁',
        titulo: c.cliente||'—',
        sub: 'Carpeta #'+c.num+(c.descripcion?' · '+c.descripcion.substring(0,40):''),
        badge: c.estatus?{txt:c.estatus,color:'rgba(200,149,42,0.7)',bg:'rgba(200,149,42,0.1)'}:null,
        accion:()=>{ ir('carpetas'); setTimeout(()=>{ abrirCarpeta(idx); }, 150); }
      });
    });
    // Renderizar resultados
    if(!resultados.length){
      res.innerHTML='<div class="gs-empty">Sin resultados para "'+esc(q)+'"</div>';
      res.classList.add('show');
      return;
    }
    // Agrupar por tipo
    const grupos={recibo:'🧾 Recibos',directorio:'👤 Directorio',juicio:'⚖️ Juicios',pendiente:'📌 Pendientes',carpeta:'📁 Carpetas'};
    const porTipo={};
    resultados.forEach(r=>{if(!porTipo[r.tipo])porTipo[r.tipo]=[];porTipo[r.tipo].push(r);});
    let html='';
    Object.entries(porTipo).forEach(([tipo,items],gi)=>{
      if(gi>0) html+='<hr class="gs-divider">';
      html+=`<div class="gs-section"><div class="gs-section-title">${grupos[tipo]||tipo}</div>`;
      items.forEach((item,idx)=>{
        const badge=item.badge?`<span class="gs-item-badge" style="color:${item.badge.color};background:${item.badge.bg};">${esc(item.badge.txt)}</span>`:'';
        html+=`<div class="gs-item" onclick="_gsClick(${gi},${idx})">
          <div class="gs-item-icon">${item.icono}</div>
          <div class="gs-item-main">
            <div class="gs-item-title">${esc(item.titulo)}</div>
            <div class="gs-item-sub">${esc(item.sub)}</div>
          </div>
          ${badge}
        </div>`;
      });
      html+='</div>';
    });
    res.innerHTML=html;
    res.classList.add('show');
    // Guardar acciones para ejecutar al click
    window._gsAcciones=resultados;
  },180);
}

async function backupAppData() {
  try {
    if (!window.subirR2 || !window.SB_DESPACHO_ID) return;
    if (_backupHecho) return;
    if (!appData || !appData.recibos || appData.recibos.length === 0) return;

    var hoyKey = 'lex-backup-' + new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem(hoyKey)) { _backupHecho = true; return; } } catch(_){}

    _backupHecho = true;

    var ahora    = new Date();
    var yyyy     = ahora.getFullYear();
    var mm       = String(ahora.getMonth() + 1).padStart(2, '0');
    var dd       = String(ahora.getDate()).padStart(2, '0');
    var hhmm     = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
    var fechaStr = yyyy + '-' + mm + '-' + dd;

    var snapshot = {
      version:   2,
      fecha:     fechaStr,
      hora:      hhmm,
      despacho:  window.SB_DESPACHO_ID,
      recibos: {
        folioActual:     appData.folioActual,
        anioFolioActual: appData.anioFolioActual,
        recibos:         appData.recibos || []
      },
      data: {
        movimientos:          (D && D.movimientos)          || [],
        directorio:           (D && D.directorio)           || [],
        carpetas:             (D && D.carpetas)             || [],
        juicios:              (D && D.juicios)              || [],
        pendientes:           (D && D.pendientes)           || [],
        cierres:              (D && D.cierres)              || [],
        prestamos:            (D && D.prestamos)            || [],
        escrituras:           (D && D.escrituras)           || [],
        recibosExcluidosCaja: (D && D.recibosExcluidosCaja) || [],
        saldoAcumulado:       (D && D.saldoAcumulado)       || 0,
        cortesDeshabilitados: (D && D.cortesDeshabilitados)  || [],
        preRecibos:           (D && D.preRecibos)            || []
      }
    };

    var json       = JSON.stringify(snapshot);
    var blob       = new Blob([json], { type: 'application/json' });
    var did        = window.SB_DESPACHO_ID;
    var pathDia    = did + '/backups/' + yyyy + '/' + mm + '/' + fechaStr + '.json';
    var fileDia    = new File([blob], fechaStr + '.json', { type: 'application/json' });
    var okDia      = await window.subirR2(fileDia, pathDia, 'backups');

    var pathLatest = did + '/backups/latest.json';
    var fileLatest = new File([blob], 'latest.json', { type: 'application/json' });
    await window.subirR2(fileLatest, pathLatest, 'backups');

    if (okDia) {
      console.log('[Backup] OK snapshot en R2:', pathDia,
        '| recibos:', snapshot.recibos.recibos.length,
        '| movimientos:', snapshot.data.movimientos.length,
        '| juicios:', snapshot.data.juicios.length);
      try {
        localStorage.setItem(hoyKey, '1');
        var hace7 = new Date(ahora - 7 * 86400000).toISOString().slice(0, 10);
        Object.keys(localStorage).forEach(function(k){
          if (k.startsWith('lex-backup-') && k < 'lex-backup-' + hace7)
            localStorage.removeItem(k);
        });
      } catch(_){}
      _limpiarBackupsViejos(did, ahora).catch(function(){});
    } else {
      console.warn('[Backup] No se pudo guardar en R2');
      _backupHecho = false;
    }
  } catch(e) {
    console.warn('[Backup] Error:', e);
    _backupHecho = false;
  }
}

function actualizarFolioDisplayRecibo(){
  var el=document.getElementById('r-folio-display');
  if(el)el.textContent='#'+folioFormato(REC.folioActual||1);
}

function recAgregarConcepto(){rConceptos.push({descripcion:'',cantidad:1,precio:''});renderConceptosRecibo();}

function agregarConceptoRecibo(){
  if(reciboFrozen) return;
  recAgregarConcepto();
}

function _conceptoTxtDeRecibo(r){
  if(!r) return '';
  var ceEsta = (r.costosExtra||[]).filter(function(ce){ return ce; });
  if(ceEsta.length){
    return ceEsta.map(function(ce){ return (ce.concepto||'') + (ce.descripcion ? ' — ' + ce.descripcion : ''); }).join(' · ');
  }
  var c0 = (r.conceptos||[])[0];
  if(c0){
    var conc = (c0.concepto||'').trim(), desc = (c0.descripcion||'').trim();
    if(conc || desc) return conc + (desc ? ' — ' + desc : '');
  }
  return '';
}

function _lexPollingTick() {
  try {
    // No interferir si hay una subida o bajada ya en curso, o si nosotros
    // mismos acabamos de sincronizar hace muy poco (evita trabajo redundante).
    if (_syncEnCurso) return;
    if ((Date.now() - (_ultimoSyncPropio || 0)) < 10000) return;
    if (typeof sincronizarFolio !== 'function') return;
    sincronizarFolio(true).then(function () {
      safeExec('renderHistorial',    () => typeof renderHistorial   === 'function' && renderHistorial());
      safeExec('renderCaja',         () => typeof renderCaja        === 'function' && renderCaja());
      safeExec('renderContab',       () => typeof renderContab      === 'function' && renderContab());
      safeExec('badges',             () => typeof badges            === 'function' && badges());
      safeExec('hjRenderTerminos',   () => typeof hjRenderTerminos  === 'function' && hjRenderTerminos());
      safeExec('hjRenderLista',      () => typeof hjRenderLista     === 'function' && hjRenderLista());
      safeExec('renderVencimientos', () => typeof renderVencimientos=== 'function' && renderVencimientos());
      safeExec('renderPend',         () => typeof renderPend        === 'function' && renderPend());
      safeExec('renderJuicios',      () => typeof renderJuicios     === 'function' && renderJuicios());
      safeExec('renderCitas',        () => typeof renderCitas       === 'function' && renderCitas());
      safeExec('gestFiltrar',        () => typeof gestFiltrar       === 'function' && gestFiltrar());
      safeExec('capturaMesCargarSupabase', () => typeof capturaMesCargarSupabase === 'function' && capturaMesCargarSupabase());
    }).catch(function (e) { console.warn('[Polling] sincronizarFolio:', e); });
  } catch (e) { console.warn('[Polling] tick:', e); }
}

async function hacerBackupDiario(){
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  if(_backupDiarioHecho) return;
  _backupDiarioHecho = true;
  try {
    const hoyStr = (typeof hoy === 'function') ? hoy() : new Date().toISOString().slice(0,10);
    const { data: estado } = await window.SB
      .from('app_state')
      .select('data, recibos, folio_actual')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .single();
    if(!estado) return;
    const nombreBackup = `${window.SB_DESPACHO_ID}/backups/lexmexico_backup_${hoyStr}.json`;
    const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
    const { error } = await window.SB.storage.from(STORAGE_BUCKET).upload(nombreBackup, blob, { upsert: true });
    if(error){ console.warn('backup diario:', error); return; }
    console.log('✅ Backup diario creado en Supabase:', nombreBackup);
  } catch(e){ console.warn('backup diario:', e); }
}

function siguienteFolioRecibo() {
  if (pendingNextFolioRecibo) {
    REC.folioActual = pendingNextFolioRecibo;
    pendingNextFolioRecibo = null;
    actualizarFolioDisplayRecibo();
    descongelarRecibo();
    toast('Folio #' + folioFormato(REC.folioActual) + ' listo');
  }
}

function renderConceptosRecibo() {
  var c = document.getElementById('r-conceptos-container');
  if (!c) return;
  c.innerHTML = rConceptos.map(function(con,i) {
    return '<div style="display:grid;grid-template-columns:3fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;">' +
      '<div class="field" style="margin:0;"><label>Descripción</label>' +
      '<input type="text" value="' + esc(con.descripcion) + '" oninput="rConceptos[' + i + '].descripcion=this.value" placeholder="Servicio..." ' + (reciboFrozen?'disabled':'') + '></div>' +
      '<div class="field" style="margin:0;"><label>Cant.</label>' +
      '<input type="number" value="' + con.cantidad + '" min="1" oninput="rConceptos[' + i + '].cantidad=parseInt(this.value)||1" ' + (reciboFrozen?'disabled':'') + '></div>' +
      '<div class="field" style="margin:0;"><label>Precio</label>' +
      '<input type="text" value="' + esc(con.precio) + '" oninput="rConceptos[' + i + '].precio=this.value;autoCalcTotal()" placeholder="$0.00" ' + (reciboFrozen?'disabled':'') + '></div>' +
      '<button class="btn btn-ghost btn-sm" onclick="eliminarConcepto(' + i + ')" style="margin-bottom:2px;" ' + (reciboFrozen?'disabled':'') + '>✕</button>' +
      '</div>';
  }).join('');
}

function eliminarConcepto(i) {
  if (reciboFrozen) return;
  rConceptos.splice(i,1);
  renderConceptosRecibo();
  autoCalcTotal();
}

function autoCalcTotal() {
  var total = rConceptos.reduce(function(s,c) {
    return s + parsePrecioR(c.precio) * (parseInt(c.cantidad)||1);
  }, 0);
  var _rt = document.getElementById('r-total');
  if(_rt) { _rt.value = formatPrecioR(total); calcTotalesRecibo(); }
}

function renderDocsRecibo() {
  var c = document.getElementById('docs-container');
  if (!c) return;
  c.innerHTML = DOCS_LIST.map(function(d,i) {
    return '<label style="display:flex;align-items:center;gap:7px;font-size:0.75rem;cursor:pointer;padding:5px 8px;border:1px solid var(--border-l);border-radius:4px;transition:all 0.15s;">' +
      '<input type="checkbox" id="doc-' + i + '" ' + (reciboFrozen?'disabled':'') + '> ' + d + '</label>';
  }).join('');
}

function setTipoDocRecibo(tipo) {
  recTipoDoc = tipo;
  var btnC = document.getElementById('r-btn-doc-copia');
  var btnE = document.getElementById('r-btn-doc-escaneo');
  if (btnC) btnC.classList.toggle('active', tipo === 'copia');
  if (btnE) btnE.classList.toggle('active', tipo === 'escaneo');
}

function congelarRecibo() {
  reciboFrozen = true;
  var banner = document.getElementById('recibo-frozen-banner');
  if (banner) banner.style.display = 'block';
  var bi = document.getElementById('btn-imprimir-recibo');
  if (bi) bi.style.display = 'none';
  var br = document.getElementById('btn-reimprimir-recibo');
  if (br) br.style.display = 'block';
  var bn = document.getElementById('btn-nuevo-desde-recibo');
  if (bn) bn.style.display = 'block';
  var bs = document.getElementById('btn-sig-folio');
  if (bs) bs.style.display = 'inline-flex';
  document.querySelectorAll('#panel-nuevo-recibo input, #panel-nuevo-recibo select, #panel-nuevo-recibo textarea').forEach(function(el){el.disabled=true;});
}

function descongelarRecibo() {
  reciboFrozen = false;
  var banner = document.getElementById('recibo-frozen-banner');
  if (banner) banner.style.display = 'none';
  var bi = document.getElementById('btn-imprimir-recibo');
  if (bi) { bi.style.display='block'; bi.disabled=false; bi.textContent='🖨 Generar PDF e Imprimir'; }
  var br = document.getElementById('btn-reimprimir-recibo');
  if (br) br.style.display = 'none';
  var bn = document.getElementById('btn-nuevo-desde-recibo');
  if (bn) bn.style.display = 'none';
  var bs = document.getElementById('btn-sig-folio');
  if (bs) bs.style.display = 'none';
  document.querySelectorAll('#panel-nuevo-recibo input, #panel-nuevo-recibo select, #panel-nuevo-recibo textarea').forEach(function(el){el.disabled=false;});
}

function reimprimirReciboInterno() {
  if (!lastPdfBlob) { toast('No hay PDF para reimprimir','err'); return; }
  imprimirBlob(lastPdfBlob);
}

function imprimirBlob(blob) {
  // Mismo visor embebido que imprimirDesdeBlob() — nunca abre pestaña nueva.
  _mostrarVisorReciboPDF(blob, 'Recibo.pdf');
}

function _folioSiguienteUnico(folioBase) {
  const usados = new Set();
  (appData && appData.recibos ? appData.recibos : []).forEach(function(r){ if(r.folio) usados.add(Number(r.folio)); });
  (typeof REC !== 'undefined' && REC.recibos ? REC.recibos : []).forEach(function(r){ if(r.folio) usados.add(Number(r.folio)); });
  let f = Number(folioBase) || 1;
  while(usados.has(f)) { f++; }
  return f;
}

async function _tomarFolioSeguro() {
  // Esperar si hay otra generación en curso (máx 5 seg)
  let espera = 0;
  while(_folioEnUso && espera < 50) { await new Promise(r=>setTimeout(r,100)); espera++; }
  _folioEnUso = true;
  try {
    const folioBase = REC.folioActual || appData.folioActual || 1;
    const folio = _folioSiguienteUnico(folioBase);
    // Avanzar inmediatamente para que la siguiente llamada no tome el mismo
    REC.folioActual = folio + 1;
    appData.folioActual = folio + 1;
    return folio;
  } finally {
    _folioEnUso = false;
  }
}

async function guardarFolioEnDrive(nuevoFolio) {
  // Versión Supabase: actualizar folio_actual + recibos en app_state
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  try {
    var payload = Object.assign({}, REC, { folioActual: nuevoFolio, folioRapido: REC.folioRapido || 1 });
    await window.SB.from('app_state').update({
      recibos: payload,
      folio_actual: nuevoFolio
    }).eq('despacho_id', window.SB_DESPACHO_ID);
  } catch(e){ console.warn('guardarFolioEnDrive:', e); }
}

async function subirPDFaD(blob, nombre) {
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  try {
    const path = window.SB_DESPACHO_ID + '/recibos/' + nombre;
    const { error } = await window.SB.storage.from(STORAGE_BUCKET).upload(path, blob, {
      contentType: 'application/pdf',
      upsert: true
    });
    if(error){ console.warn('subirPDF:', error); return; }
    toast('PDF guardado ✓');
  } catch(e){ console.warn('subirPDF:', e); }
}

function exportarCopia() {
  var backup={version:'6.0',fecha:new Date().toISOString(),appData:D,reciboData:REC};
  var json=JSON.stringify(backup,null,2);
  var blob=new Blob([json],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='LEX-MEXICO-backup-'+hoy()+'.json';
  a.click(); URL.revokeObjectURL(a.href);
  toast('Copia de seguridad descargada.');
}

function importarCopia(input) {
  var file=input.files[0];
  if (!file) return;
  if (!confirm('Restaurar datos desde "'+file.name+'"? Los datos actuales seran reemplazados.')) { input.value=''; return; }
  var reader=new FileReader();
  reader.onload=function(e) {
    try {
      var backup=JSON.parse(e.target.result);
      if (!backup.appData||!backup.reciboData) { toast('Archivo invalido.','err'); return; }
      D=Object.assign({},D,backup.appData);
      REC=Object.assign({},REC,backup.reciboData);
      save(); renderCaja(); renderConfig(); renderDir(); renderJuicios(); renderPend(); badges();
      toast('Datos restaurados desde: '+file.name);
    } catch(err) { toast('Error al leer el archivo: '+err.message,'err'); }
    input.value='';
  };
  reader.readAsText(file);
}

function _abrirUrlTenencia(estado){
  var url=TENENCIA_URLS[estado]||'https://www.gob.mx/tramites/ficha/pago-de-tenencia-o-uso-vehicular/SRE2931';
  window.location.href=url; // misma pestaña — siempre funciona, sin bloqueo
}

function formatPrecioLibre(input, i){
  var raw = input.value.replace(/[$\s,]/g, '');
  var clean = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  _libreConceptos[i].precio = parseFloat(clean) || 0;
  input.value = _precioLibreFmt(clean);
  calcLibreTotal();
}

function renderConceptosLibre(){
  var lista=document.getElementById('libre-conceptos-lista');
  if(!lista)return;
  lista.innerHTML='';
  _libreConceptos.forEach(function(c,i){
    var div=document.createElement('div');
    div.style.cssText='display:grid;grid-template-columns:1fr auto;gap:8px;margin-bottom:10px;border:1.5px solid var(--border-l);border-radius:var(--radius-sm);padding:12px;background:var(--surface);position:relative;';
    div.innerHTML=
      '<div class="field" style="margin:0;">'+
        '<label style="font-family:JetBrains Mono,monospace;font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);font-weight:500;">Descripción</label>'+
        '<input type="text" placeholder="Ej: Carta responsiva, Asesoría..." value="'+esc(c.desc||'')+'" oninput="_libreConceptos['+i+'].desc=this.value;" style="width:100%;background:var(--surface);border:1.5px solid var(--border-l);border-radius:var(--radius-sm);padding:8px 11px;font-family:Outfit,sans-serif;font-size:0.82rem;color:var(--ink);outline:none;margin-top:5px;" onfocus="this.style.borderColor=\'var(--gold)\'" onblur="this.style.borderColor=\'var(--border-l)\'">'+
      '</div>'+
      (i>0?'<button onclick="eliminarConceptoLibre('+i+')" style="align-self:flex-start;margin-top:22px;width:26px;height:26px;border:1px solid var(--rojo-l);border-radius:4px;cursor:pointer;font-size:0.85rem;color:var(--rojo);background:var(--rojo-l);flex-shrink:0;">✕</button>':'<div></div>')+
      '<div class="field" style="margin:0;grid-column:1/3;">'+
        '<label style="font-family:JetBrains Mono,monospace;font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);font-weight:500;">Precio ($)</label>'+
        '<input type="text" inputmode="decimal" placeholder="0.00" value="'+(c.precio?_precioLibreFmt(String(c.precio)):'')+'" oninput="formatPrecioLibre(this,'+i+')" style="width:100%;text-align:right;background:var(--surface);border:1.5px solid var(--border-l);border-radius:var(--radius-sm);padding:8px 11px;font-family:JetBrains Mono,monospace;font-size:0.9rem;color:var(--ink);outline:none;margin-top:5px;" onfocus="this.select();this.style.borderColor=\'var(--gold)\'" onblur="this.style.borderColor=\'var(--border-l)\'">'+
      '</div>';
    lista.appendChild(div);
  });
}

function agregarConceptoLibre(){
  _libreConceptos.push({desc:'',precio:0});
  renderConceptosLibre();
}

function eliminarConceptoLibre(i){
  _libreConceptos.splice(i,1);
  renderConceptosLibre();
  calcLibreTotal();
}

function calcLibreTotal(){
  var total=_libreConceptos.reduce(function(s,c){return s+(parseFloat(c.precio)||0);},0);
  var el=document.getElementById('libre-total');
  if(el)el.textContent='$'+fmt(total);
}

function registrarLibreCarrito(){
  var validos=_libreConceptos.filter(function(c){return c.desc.trim()&&(parseFloat(c.precio)||0)>0;});
  if(!validos.length){toast('Ingresa al menos una descripción con precio','err');return;}
  var total=validos.reduce(function(s,c){return s+(parseFloat(c.precio)||0);},0);
  var desc=validos.length===1?validos[0].desc.trim():validos.map(function(c){return c.desc.trim()+' $'+fmt(c.precio);}).join(' | ');
  agregarAlCarrito(desc,total,'otro');
  cerrar('mLibre');
}

function _cpdfMostrarFormGenerar(r, fuente, embed, loading) {
  var letraActual = (r.letra || letraVersion(r) || 'A').toUpperCase();
  var letraPrevia = fuente !== r ? (fuente.letra || letraVersion(fuente) || 'A').toUpperCase() : null;
  var folioStr    = typeof folioConLetra === 'function'
    ? folioConLetra(r.folio, r.anio_folio, letraActual) : r.folio + letraActual;
  var fuenteStr   = letraPrevia && typeof folioConLetra === 'function'
    ? folioConLetra(fuente.folio, fuente.anio_folio, letraPrevia) : null;
  var nombre    = fuente.nombre || (fuente.clientes && fuente.clientes[0] ? fuente.clientes[0].nombre : '') || '—';
  var concepto0 = fuente.conceptos && fuente.conceptos[0] ? (fuente.conceptos[0].concepto||'') : (fuente.tramites||'—');
  var totalTxt  = '$' + (typeof fmt === 'function' ? fmt(parseFloat(fuente.total||0)) : parseFloat(fuente.total||0).toFixed(2));
  var antTxt    = '$' + (typeof fmt === 'function' ? fmt(parseFloat(fuente.anticipo||0)) : parseFloat(fuente.anticipo||0).toFixed(2));
  var fechaDef  = r.fecha_recibo || r.fecha || (typeof hoy === 'function' ? hoy() : new Date().toISOString().slice(0,10));
  var horaDef   = r.hora_recibo  || r.hora  || (typeof horaCDMX_HHMM === 'function' ? horaCDMX_HHMM() : '00:00');
  // Guardar referencias para cpdfConfirmarGenerar()
  window._cpdfPendienteRecibo = r;
  window._cpdfPendienteFuente = fuente;
  window._cpdfPendienteEmbed  = embed;
  window._cpdfPendienteLoading = loading;
  loading.innerHTML =
    '<div style="background:#1a1510;border:1.5px solid rgba(200,149,42,0.4);border-radius:14px;padding:22px 24px;max-width:420px;width:90%;display:flex;flex-direction:column;gap:14px;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:1.4rem;">📄</span>' +
        '<div>' +
          '<div style="font-family:monospace;font-size:0.8rem;font-weight:700;color:var(--gold-d);">Generar PDF · #' + (typeof esc === 'function' ? esc(folioStr) : folioStr) + '</div>' +
          (fuenteStr
            ? '<div style="font-family:monospace;font-size:0.58rem;color:rgba(200,149,42,0.55);margin-top:2px;">Pre-rellenado desde #' + (typeof esc === 'function' ? esc(fuenteStr) : fuenteStr) + '</div>'
            : '') +
        '</div>' +
      '</div>' +
      '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;">' +
        '<div style="font-size:0.72rem;font-weight:600;color:var(--gold-l);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (typeof esc === 'function' ? esc(nombre) : nombre) + '</div>' +
        '<div style="font-size:0.62rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (typeof esc === 'function' ? esc(concepto0) : concepto0) + '</div>' +
        '<div style="font-size:0.6rem;color:var(--muted);">Total: <strong style="color:var(--gold-l);">' + totalTxt + '</strong> · Anticipo: <strong>' + antTxt + '</strong></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
        '<div>' +
          '<label style="font-family:monospace;font-size:0.58rem;color:var(--muted);display:block;margin-bottom:3px;">FECHA</label>' +
          '<input id="cpdf-gen-fecha" type="date" value="' + fechaDef + '" style="width:100%;box-sizing:border-box;background:#0f0b06;border:1px solid rgba(200,149,42,0.4);color:var(--gold-l);border-radius:6px;padding:6px 8px;font-family:monospace;font-size:0.72rem;">' +
        '</div>' +
        '<div>' +
          '<label style="font-family:monospace;font-size:0.58rem;color:var(--muted);display:block;margin-bottom:3px;">HORA</label>' +
          '<input id="cpdf-gen-hora" type="time" value="' + horaDef + '" style="width:100%;box-sizing:border-box;background:#0f0b06;border:1px solid rgba(200,149,42,0.4);color:var(--gold-l);border-radius:6px;padding:6px 8px;font-family:monospace;font-size:0.72rem;">' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
        '<button onclick="cerrarContabPDF()" style="padding:7px 16px;border-radius:7px;border:1px solid rgba(255,255,255,0.15);background:none;color:var(--muted);font-family:monospace;font-size:0.68rem;cursor:pointer;">Cancelar</button>' +
        '<button onclick="cpdfConfirmarGenerar()" id="btn-cpdf-confirmar" style="padding:7px 18px;border-radius:7px;border:none;background:linear-gradient(135deg,#c8952a,#8a5a10);color:#fff;font-family:monospace;font-size:0.68rem;font-weight:700;cursor:pointer;">📄 Generar PDF</button>' +
      '</div>' +
    '</div>';
  loading.style.display = 'flex';
}

async function cpdfConfirmarGenerar() {
  var btn     = document.getElementById('btn-cpdf-confirmar');
  var r       = window._cpdfPendienteRecibo;
  var fuente  = window._cpdfPendienteFuente;
  var embed   = window._cpdfPendienteEmbed;
  var loading = window._cpdfPendienteLoading;
  if (!r || !fuente) return;
  // ── GUARDIA DE TOMBSTONE — nunca revivir un folio eliminado ────────────────
  // Esta función existía para regenerar el PDF de un recibo que sigue vivo, pero
  // al final reinsertaba `r` en appData.recibos y llamaba _revivirSiTombstone(r),
  // lo cual UN-ELIMINABA cualquier folio que aún tuviera tombstone pendiente — si
  // `r` venía de una copia rezagada (ej. REC.recibos desincronizado de appData),
  // un folio ya borrado podía "resucitar" con datos parciales/viejos. Se corta
  // aquí, antes de generar nada.
  try {
    var _folioTombCPDF = Number(r.folio);
    var _letraTombCPDF = r.letra || (typeof letraVersion==='function'?letraVersion(r):'A') || 'A';
    var _tombsCPDF = (typeof appData!=='undefined' && Array.isArray(appData.folios_eliminados)) ? appData.folios_eliminados : [];
    var _tombAplicaCPDF = _tombsCPDF.find(function(t){
      return typeof _tombstoneAplicaA==='function' && _tombstoneAplicaA(t, { folio: _folioTombCPDF, letra: _letraTombCPDF, _revivedTs: r._revivedTs });
    });
    if (_tombAplicaCPDF) {
      if (typeof toast === 'function') toast('⚠️ El folio #' + (typeof folioFormato==='function'?folioFormato(_folioTombCPDF):_folioTombCPDF) + _letraTombCPDF + ' fue eliminado — no se puede regenerar su PDF.', 'err');
      if (loading) loading.style.display = 'none';
      window._cpdfPendienteRecibo  = null;
      window._cpdfPendienteFuente  = null;
      window._cpdfPendienteEmbed   = null;
      window._cpdfPendienteLoading = null;
      return;
    }
  } catch(_eTombCPDF) { console.warn('[cpdfConfirmarGenerar] guardia tombstone:', _eTombCPDF); }
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando...'; }
  var fecha = (document.getElementById('cpdf-gen-fecha') || {}).value || (r.fecha_recibo || r.fecha);
  var hora  = (document.getElementById('cpdf-gen-hora')  || {}).value || (r.hora_recibo  || r.hora);
  try {
    // NO recalcular saldos — usar los que ya tiene el recibo original.
    // Esta función solo regenera el PDF visualmente, no registra ningún cobro nuevo.
    var _s = Object.assign({}, fuente);
    var t  = parseFloat(_s.total)||0;
    var _ant = parseFloat(_s.anticipo)||0;
    // saldoPendiente es confiable SOLO si fue guardado explícitamente (> 0, o liquidado con anticipo >= total)
    // Si saldoPendiente es 0 pero anticipo también es 0, es un valor por defecto vacío — calcular desde total
    var _spRaw = _s.saldoPendiente;
    var _spNum = (_spRaw !== null && _spRaw !== undefined && _spRaw !== '') ? parseFloat(_spRaw) : -1;
    var _esSaldoConfiable = _spNum > 0 || (_spNum === 0 && _ant >= t);
    _s.saldoNuevo   = _esSaldoConfiable ? _spNum : Math.max(0, t - _ant);
    // totalAbonado = lo que realmente se ha cobrado = anticipo original del recibo
    // NO calcular como (total - saldo) porque eso marca dinero no recibido como abonado
    _s.totalAbonado = _ant;
    // Sin Costo Total Pactado: total/abonado NO viven en _s.total/_s.anticipo —
    // viven en los cargos internos y en el abonado real acumulado en TODAS las
    // versiones del folio. Sin este caso especial el PDF regenerado salía con
    // $0.00/$0.00/$0.00 aunque el trámite ya tuviera pagos reales (folio 56).
    var _esSinCostoPDF = (typeof window._abiertoSinCosto === 'function') && window._abiertoSinCosto(r);
    if(_esSinCostoPDF){
      var _folioPDF = Number(r.folio);
      var _versionesPDF = (typeof appData!=='undefined' && appData.recibos ? appData.recibos : [])
        .filter(function(x){ return x && Number(x.folio)===_folioPDF && !x.esComplemento; });
      var _cargosPDF = 0, _ceAllPDF = 0, _abonadoPDF = 0, _seenCEPdf = {};
      _versionesPDF.forEach(function(v){
        _cargosPDF += (v._cargosInternos||[]).reduce(function(s,c){ return s+(parseFloat(c.monto)||0); }, 0);
        (v.costosExtra||[]).forEach(function(ce){
          if(!ce) return;
          var k=(ce.concepto||'')+'|'+(ce.descripcion||'')+'|'+String(ce.precio||'')+'|'+(ce.fechaHora||'');
          if(_seenCEPdf[k]) return; _seenCEPdf[k]=1;
          _ceAllPDF += (parseFloat(ce.precio)||0);
        });
        _abonadoPDF += parseFloat(v.anticipo||0) + (v.pagosParciales||[]).reduce(function(s,p){ return s+(parseFloat(p.cantidad)||0); }, 0);
      });
      t = _cargosPDF + _ceAllPDF;
      _s.totalAbonado = _abonadoPDF;
      _s.saldoNuevo = Math.max(0, t - _abonadoPDF);
    }
    var datos = {
      folio: r.folio,
      clientes: _s.clientes || [{nombre: _s.nombre||'', movil:'', tel:'', domicilio:''}],
      conceptos: _s.conceptos||[], tipoTramite: _s.tipoTramite||'normal',
      fecha_recibo: fecha, hora_recibo: hora,
      anticipo: _s.anticipo||'0', responsable: _s.responsable||'',
      nombre_cliente_firma: _s.nombre_cliente_firma||_s.nombre||'',
      tramites: _s.tramites||'', clase:_s.clase||'', marca:_s.marca||'', tipo_veh:_s.tipo_veh||'',
      serie:_s.serie||'', motor:_s.motor||'', personas_veh:_s.personas_veh||'', anio:_s.anio||'', puertas:_s.puertas||'',
      color_veh:_s.color_veh||'', transmision:_s.transmision||'',
      cilindros:_s.cilindros||'', placa:_s.placa||'', placaEstado:_s.placaEstado||'',
      ultima_tenencia:_s.ultima_tenencia||'', origen:_s.origen||'', combustible:_s.combustible||'',
      // Sin Costo Total Pactado: r.costosExtra/pagosParciales vienen ACUMULADOS
      // (incluyen los de versiones anteriores) — al regenerar el PDF de ESTA letra
      // filtramos a solo lo que se originó en ELLA (vía folioLetra), para no repetir
      // cargos/abonos de versiones previas (esos ya se ven en "ADEUDO ANTERIOR").
      copias:_s.copias||[],
      tipo_doc:_s.tipo_doc||r.tipo_doc||'copia',
      costosExtra: (r.costosExtra||_s.costosExtra||[]).filter(function(ce){
        return !_esSinCostoPDF || ((ce&&ce.folioLetra||'').toUpperCase() === (r.letra||letraVersion(r)||'A').toUpperCase());
      }),
      pagosParciales: (r.pagosParciales||_s.pagosParciales||[]).filter(function(p){
        return !_esSinCostoPDF || ((p&&p.folioLetra||'').toUpperCase() === (r.letra||letraVersion(r)||'A').toUpperCase());
      }),
      fechasImpresion: r.fechasImpresion||_s.fechasImpresion||[],
      totalGeneral: t, totalAbonado: _s.totalAbonado, saldoNuevo: _s.saldoNuevo,
      letra: (r.letra || letraVersion(r) || 'A')
    };
    var qrTexto = 'LEX-MEXICO|Folio:' + folioFormato(r.folio, r.anio_folio) + '|' + (_s.nombre||'') + '|' + fecha + ' ' + hora;
    var qrDataURL = await qrToDataURL(qrTexto);
    var doc = await generarPDF(datos, r.folio, qrDataURL);
    var pdfUri = doc.output('datauristring');
    if (!r.pdfBase64) r.pdfBase64 = pdfUri;
    embed.setAttribute('src', pdfUri);
    if (loading) loading.style.display = 'none';
    // ── CRÍTICO: revivir el folio si tenía tombstone ────────────────────────
    // Regenerar un recibo es un acto explícito de conservación. Si el folio tenía
    // una "lápida" (folios_eliminados), la siguiente sincronización lo borraría de
    // nuevo (se veía unos minutos y desaparecía). _revivirSiTombstone marca
    // _revivedTs y purga el tombstone para que sobreviva en READ-MERGE-WRITE.
    try {
      if (typeof appData !== 'undefined') {
        if (!Array.isArray(appData.recibos)) appData.recibos = [];
        var _yaEsta = appData.recibos.some(function(x){
          return String(x.folio) === String(r.folio) && (x.letra || 'A') === (r.letra || 'A');
        });
        if (!_yaEsta) appData.recibos.push(r);
        if (typeof _revivirSiTombstone === 'function') _revivirSiTombstone(r);
        // Persistir de inmediato para propagar la supersesión del tombstone a SB
        if (typeof actualizarArchivoControl === 'function') {
          actualizarArchivoControl().catch(function(e){ console.warn('[regen revive] save:', e); });
        }
      }
    } catch(_eRev){ console.warn('[regen revive]', _eRev); }
    // Limpiar estado pendiente
    window._cpdfPendienteRecibo  = null;
    window._cpdfPendienteFuente  = null;
    window._cpdfPendienteEmbed   = null;
    window._cpdfPendienteLoading = null;
  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '📄 Generar PDF'; }
    if (typeof toast === 'function') toast('Error al generar: ' + e.message, 'err');
    console.error('[cpdfConfirmarGenerar]', e);
  }
}

function _vehPDFEsCandidato(r){
  if(!r || r.folio == null || r.esComplemento) return false;
  return r.tipoTramite === 'vehicular' || !!r.clase;
}

function _gfRecibosVivos(){
  return (appData.recibos||[]).filter(function(r){ return r && r.folio!=null && !r.esComplemento; });
}

function _gfMaxFolio(){
  var max=0;
  _gfRecibosVivos().forEach(function(r){ var f=Number(r.folio); if(Number.isFinite(f)&&f>max) max=f; });
  return max;
}

function _gfFolioExiste(n){
  return (appData.recibos||[]).some(function(r){ return r && Number(r.folio)===Number(n); });
}

function _gfRecibosEnRango(desde, hasta){
  return (appData.recibos||[]).filter(function(r){
    var f=Number(r.folio); return Number.isFinite(f) && f>=desde && f<=hasta;
  });
}

function _gfDistintosFolios(lista){
  var s=new Set(); lista.forEach(function(r){ s.add(Number(r.folio)); }); return s.size;
}

async function _gfRegenerarPDFs(recibosAfectados, logFn){
  for(var i=0;i<recibosAfectados.length;i++){
    var r=recibosAfectados[i];
    var letra=r.letra||'A';
    var fStr=folioConLetra(r.folio, r.anio_folio||2026, letra);
    if(logFn) logFn('Regenerando '+(i+1)+'/'+recibosAfectados.length+' — #'+fStr);
    try{
      var qrTxt='LEX-MEXICO|Folio:'+fStr+'|'+(r.nombre||'')+'|'+(r.fecha_recibo||r.fecha||'')+' '+(r.hora_recibo||r.hora||'');
      var qrURL=await qrToDataURL(qrTxt);
      var doc=await generarPDF(Object.assign({}, r, {anio_folio:r.anio_folio||2026, letra:letra}), r.folio, qrURL);
      r.pdfBase64=doc.output('datauristring');
      var r2n=(typeof _nombreArchivoR2==='function')?_nombreArchivoR2(fStr, r.nombre||''):fStr+'.pdf';
      // FIX: subirPDFaDrive() usa fetch()/Supabase Storage sin timeout propio.
      // Si la subida se cuelga (worker sin responder), el for-loop entero se
      // congelaba en este await sin avisar — mismo bug que _gfActualizarVersionesSB.
      // Con _sbConTimeout, tras 15s sin respuesta se registra el fallo y se
      // sigue con el siguiente recibo en vez de trabar todo el proceso.
      await _sbConTimeout(subirPDFaDrive(doc.output('blob'), fStr+'.pdf', r2n), 15000, 'Gestor de Folios: subir PDF #'+fStr);
    }catch(e){
      console.warn('[gestorFolios] regen folio', r.folio, e);
      if(logFn) logFn('⚠ No se pudo regenerar/subir #'+fStr+': '+(e&&e.message?e.message:e));
    }
    await new Promise(function(res){ setTimeout(res, 80); });
  }
}

async function _gfBorrarPDFsViejos(items, preservar, logFn){
  preservar = preservar || new Set();
  var _borrarConTimeout = function(p, etiqueta){
    return _sbConTimeout(Promise.resolve(p).catch(function(){ return null; }), 10000, etiqueta)
      .catch(function(e){ if(logFn) logFn('⚠ '+etiqueta+': '+(e&&e.message?e.message:e)); });
  };
  for(var i=0;i<items.length;i++){
    var it=items[i];
    var fStr=folioConLetra(it.folio, 2026, it.letra||'A');
    var corto = fStr+'.pdf';
    // La variante descriptiva legacy se borra SIEMPRE (nunca colisiona con un nombre nuevo).
    if(typeof _nombreArchivoR2Legacy==='function'){
      var leg=_nombreArchivoR2Legacy(fStr, it.nombre||'');
      if(typeof window.borrarR2==='function' && window.SB_DESPACHO_ID)
        await _borrarConTimeout(window.borrarR2(window.SB_DESPACHO_ID+'/recibos/'+leg, 'recibos'), 'Gestor de Folios: borrar '+leg);
      if(typeof borrarPDFdeDrive==='function')
        await _borrarConTimeout(borrarPDFdeDrive(leg), 'Gestor de Folios: borrar (legacy) '+leg);
    }
    // El nombre corto se borra SOLO si NO se reutiliza como nombre nuevo de otro
    // recibo desplazado (al recorrer ±1, el nombre viejo de uno = nombre nuevo de otro).
    if(!preservar.has(corto)){
      if(typeof window.borrarR2==='function' && window.SB_DESPACHO_ID)
        await _borrarConTimeout(window.borrarR2(window.SB_DESPACHO_ID+'/recibos/'+corto, 'recibos'), 'Gestor de Folios: borrar '+corto);
      if(typeof borrarPDFdeDrive==='function')
        await _borrarConTimeout(borrarPDFdeDrive(corto), 'Gestor de Folios: borrar '+corto);
    }
  }
}

function _gfNombresNuevos(recibos){
  var s=new Set();
  (recibos||[]).forEach(function(r){ s.add(folioConLetra(r.folio, r.anio_folio||2026, r.letra||'A')+'.pdf'); });
  return s;
}

function _gfMarcarVaciados(viejos){
  if(!Array.isArray(appData.folios_eliminados)) appData.folios_eliminados = [];
  (viejos||[]).forEach(function(v){
    var folioV = Number(v.folio), letraV = v.letra||'A';
    window._gfClavesVacadasTemporal.add(folioV+'|'+letraV);
    var yaExiste = appData.folios_eliminados.some(function(t){
      return Number(t.folio)===folioV && (t.letra||'A')===letraV;
    });
    if(!yaExiste) appData.folios_eliminados.push({folio:folioV, letra:letraV, ts:Date.now()+10000});
  });
}

function _gfLimpiarTombstonesRenumerados(afectados){
  if(!afectados || !afectados.length) return;
  // Defensivo: refrescar _revivedTs de cada recibo ya renumerado a su NUEVO
  // folio+letra, para que gane sobre cualquier tombstone viejo que aplique a
  // esa clave (propio de este mismo folio o heredado de un borrado anterior
  // sin relación) en el pre-read de syncEstadoSupabase de CUALQUIER sesión.
  afectados.forEach(function(r){ if(r) r._revivedTs = Date.now(); });
  if(!Array.isArray(appData.folios_eliminados) || !appData.folios_eliminados.length) return;
  var vivos = new Set(afectados.map(function(r){ return Number(r.folio)+'|'+(r.letra||'A'); }));
  appData.folios_eliminados = appData.folios_eliminados.filter(function(t){
    return !vivos.has(Number(t.folio)+'|'+(t.letra||'A'));
  });
}

function _gfVerificarLibre(folioN, logFn){
  var sigueOcupado = _gfFolioExiste(folioN);
  if(sigueOcupado){
    var msg = '⚠ El folio '+folioN+' reportó la operación como completada, pero SIGUE OCUPADO. '
      + 'Puede deberse a una sincronización con Supabase que llegó tarde. '
      + 'Espera unos segundos, refresca la página y vuelve a intentar "Restaurar Recibo". '
      + 'Si persiste, avisa antes de seguir usando el Gestor de Folios.';
    if(logFn) logFn(msg);
    alert(msg);
    return false;
  }
  return true;
}

async function _gfFijarContador(n){
  appData.folioActual=n;
  if(typeof REC!=='undefined') REC.folioActual=n;
  if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
  try{ if(typeof guardarFolioEnDrive==='function') await guardarFolioEnDrive(n); }
  catch(e){ console.warn('[gestorFolios] guardarFolioEnDrive', e); }
}

async function _gfInsertarEjecutar(folioN, logFn){
  folioN=Number(folioN);
  var max=_gfMaxFolio();
  if(!Number.isInteger(folioN)||folioN<1){ alert('Folio inválido.'); return false; }
  if(folioN>max){ alert('El folio '+folioN+' está por encima del último (#'+max+'). No hay folios que recorrer: captúralo directamente como nuevo.'); return false; }
  if(!_gfFolioExiste(folioN)){ alert('El folio '+folioN+' ya está libre (no existe). No hace falta hacer espacio.'); return false; }
  if(typeof _ultimoSyncPropio!=='undefined') _ultimoSyncPropio=Date.now();
  _gfBackup('insertar_'+folioN);
  var afectados=_gfRecibosEnRango(folioN, max);
  var viejos=afectados.map(function(r){ return {folio:Number(r.folio), letra:(r.letra||'A'), nombre:(r.nombre||'')}; });
  _gfMarcarVaciados(viejos);
  var mapa=new Map();
  for(var f=max; f>=folioN; f--) mapa.set(f, f+1);
  if(logFn) logFn('Renumerando '+mapa.size+' folio(s) hacia arriba…');
  await _aplicarMapaRenumeracion(mapa, 2026, folioN);
  _gfLimpiarTombstonesRenumerados(afectados);
  await _gfRegenerarPDFs(afectados, logFn);
  if(logFn) logFn('Borrando PDFs viejos…');
  await _gfBorrarPDFsViejos(viejos, _gfNombresNuevos(afectados), logFn);
  if(logFn) logFn('Actualizando Supabase…');
  await _gfActualizarVersionesSB(Array.from(mapa.entries()).sort(function(a,b){ return b[0]-a[0]; }), logFn);
  await _gfFijarContador(folioN);
  try{ await actualizarArchivoControl(); }catch(e){}
  try{ await syncEstadoSupabase(); }catch(e){}
  if(typeof renderHistorial==='function') renderHistorial();
  if(typeof renderContab==='function') renderContab();
  var _quedoLibre = _gfVerificarLibre(folioN, logFn);
  if(!_quedoLibre) return false;
  if(logFn) logFn('Listo. Folio '+folioN+' libre.');
  if(typeof toast==='function') toast('✅ Hueco creado en folio '+folioN+' — el siguiente recibo lo ocupará.');
  return true;
}

async function _gfEliminarEjecutar(folioN, cerrarHueco, logFn){
  folioN=Number(folioN);
  var max=_gfMaxFolio();
  if(!Number.isInteger(folioN)||folioN<1){ alert('Folio inválido.'); return false; }
  var delRecs=(appData.recibos||[]).filter(function(r){ return Number(r.folio)===folioN; });
  if(!delRecs.length){ alert('No existe el folio '+folioN+'.'); return false; }
  if(typeof _ultimoSyncPropio!=='undefined') _ultimoSyncPropio=Date.now();
  _gfBackup('eliminar_'+folioN);
  // Tombstones + broadcast por cada versión, para que no reaparezca en el merge.
  if(!Array.isArray(appData.folios_eliminados)) appData.folios_eliminados=[];
  delRecs.forEach(function(r){
    var letra=r.letra||'A';
    if(!appData.folios_eliminados.some(function(t){ return String(t.folio)===String(folioN)&&t.letra===letra; }))
      appData.folios_eliminados.push({folio:folioN, letra:letra, ts:Date.now()+10000});
    try{
      if(typeof _lexRealtimeChannel!=='undefined' && _lexRealtimeChannel && _lexRealtimeChannel.state==='joined')
        _lexRealtimeChannel.send({type:'broadcast', event:'folio_eliminado', payload:{folio:folioN, letra:letra, ts:Date.now()+10000, _adminForce:true}}).catch(function(){});
    }catch(e){}
  });
  var pdfsDel=delRecs.map(function(r){ return {folio:folioN, letra:(r.letra||'A'), nombre:(r.nombre||'')}; });
  // Quitar de memoria (recibo, movimientos, historial de pagos, snapshots, pendientes).
  appData.recibos=(appData.recibos||[]).filter(function(r){ return Number(r.folio)!==folioN; });
  if(typeof REC!=='undefined') REC.recibos=appData.recibos;
  if(typeof D!=='undefined' && Array.isArray(D.movimientos))
    _filtrarMovsAuditado(function(m){ return !(m && m.fuente==='recibo' && Number(m.folio)===folioN); },
      '_gfEliminarEjecutar (Gestor de Folios)', { folio: folioN });
  if(appData.historialPagos) delete appData.historialPagos[folioN];
  if(typeof D!=='undefined' && Array.isArray(D.snapshotsRecibos))
    D.snapshotsRecibos=D.snapshotsRecibos.filter(function(s){ return Number(s.folio)!==folioN; });
  if(typeof D!=='undefined' && Array.isArray(D.pendientes))
    D.pendientes=D.pendientes.filter(function(p){ return !(p && Number(p.reciboVinculadoFolio)===folioN); });
  // Supabase: borrar versiones del folio. FIX: sin timeout, esta llamada
  // podía colgarse igual que las otras — se protege con _sbConTimeout.
  try{ if(window.SB && window.SB_DESPACHO_ID) await _sbConTimeout(window.SB.from('versiones_recibo').delete().eq('despacho_id', window.SB_DESPACHO_ID).eq('folio_base', folioN), 8000, 'Gestor de Folios: borrar versiones #'+folioN); }
  catch(e){ console.warn('[gestorFolios] del versiones', e); if(logFn) logFn('⚠ borrar versiones_recibo: '+(e&&e.message?e.message:e)); }
  if(logFn) logFn('Borrando PDF del folio '+folioN+'…');
  await _gfBorrarPDFsViejos(pdfsDel, null, logFn);

  if(cerrarHueco){
    var afectados=_gfRecibosEnRango(folioN+1, max);
    var viejos=afectados.map(function(r){ return {folio:Number(r.folio), letra:(r.letra||'A'), nombre:(r.nombre||'')}; });
    _gfMarcarVaciados(viejos);
    var mapa=new Map();
    for(var f=folioN+1; f<=max; f++) mapa.set(f, f-1);
    if(logFn) logFn('Cerrando hueco: renumerando '+mapa.size+' folio(s) hacia abajo…');
    await _aplicarMapaRenumeracion(mapa, 2026, max);
    _gfLimpiarTombstonesRenumerados(afectados);
    await _gfRegenerarPDFs(afectados, logFn);
    if(logFn) logFn('Borrando PDFs viejos…');
    await _gfBorrarPDFsViejos(viejos, _gfNombresNuevos(afectados), logFn);
    if(logFn) logFn('Actualizando Supabase…');
    await _gfActualizarVersionesSB(Array.from(mapa.entries()).sort(function(a,b){ return a[0]-b[0]; }), logFn);
    await _gfFijarContador(max);
  } else {
    if(typeof save==='function') save();
    await _gfFijarContador((typeof _recalcularFolioActual==='function')?_recalcularFolioActual():(_gfMaxFolio()+1));
  }
  try{ await actualizarArchivoControl(); }catch(e){}
  try{ await syncEstadoSupabase(); }catch(e){}
  if(typeof renderHistorial==='function') renderHistorial();
  if(typeof renderContab==='function') renderContab();
  if(typeof renderCaja==='function') renderCaja();
  if(typeof adminRenderRecibos==='function') adminRenderRecibos((document.getElementById('adminBuscarRecibo')||{}).value||'');
  // FIX: cuando cerrarHueco=true, folioN queda OCUPADO A PROPÓSITO por el
  // recibo que era folioN+1 (ya renumerado) — comprobar "folioN sigue vacío"
  // aquí siempre daba una falsa alarma. Lo correcto en ese caso es verificar
  // que el folio MÁXIMO viejo (el que se vació al recorrer todo hacia abajo)
  // ya no exista. Sin cerrarHueco, folioN sí debe quedar vacío (check original).
  var _quedoBorrado = cerrarHueco ? !_gfFolioExiste(max) : !_gfFolioExiste(folioN);
  if(!_quedoBorrado){
    var _msgDel = cerrarHueco
      ? '⚠ Se esperaba que el folio '+max+' quedara libre tras cerrar el hueco, pero sigue existiendo. Puede deberse a una sincronización con Supabase que llegó tarde. Refresca la página y verifica antes de seguir.'
      : '⚠ El folio '+folioN+' reportó la eliminación como completada, pero SIGUE EXISTIENDO. Puede deberse a una sincronización con Supabase que llegó tarde. Refresca la página y verifica antes de seguir.';
    if(logFn) logFn(_msgDel);
    alert(_msgDel);
  }
  if(typeof badges==='function') badges();
  // Cerrar/refrescar Ficha del Folio o el buscador de folios si estaban abiertos
  // mostrando justo este folio en ESTE mismo cliente.
  if(typeof window._notificarFolioEliminadoUI === 'function') window._notificarFolioEliminadoUI(folioN, null);
  if(logFn) logFn('Listo.');
  if(typeof toast==='function') toast('✅ Folio '+folioN+' eliminado'+(cerrarHueco?' y hueco cerrado.':' (hueco dejado).'));
  return true;
}

function abrirGestorFolios(){
  try{ var ex=document.getElementById('gf-ov'); if(ex) ex.remove(); }catch(e){}
  var max=_gfMaxFolio();
  var ov=document.createElement('div');
  ov.id='gf-ov';
  ov.style.cssText='position:fixed;inset:0;background:rgba(12,9,5,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML=''
    +'<div style="background:var(--surface);border:1px solid var(--border-l);border-radius:var(--radius);width:560px;max-width:96vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow-lg);">'
    +  '<div style="padding:16px 20px;border-bottom:1px solid var(--border-l);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">'
    +    '<div><div style="font-size:0.92rem;font-weight:700;color:var(--ink);">🔢 Gestor de Folios</div>'
    +    '<div style="font-size:0.6rem;color:var(--muted);margin-top:2px;">Insertar espacio · Eliminar recibo — último folio: #'+max+'</div></div>'
    +    '<button onclick="document.getElementById(\'gf-ov\').remove()" style="font-size:1rem;background:none;border:none;cursor:pointer;color:var(--muted);padding:4px 8px;">✕</button>'
    +  '</div>'
    +  '<div style="padding:18px 20px;display:flex;flex-direction:column;gap:16px;overflow-y:auto;flex:1;">'
    +    '<div style="border:1.5px solid rgba(77,202,106,0.35);border-radius:10px;padding:14px;">'
    +      '<div style="font-size:0.8rem;font-weight:700;color:var(--ink);margin-bottom:4px;">➕ Insertar espacio</div>'
    +      '<div style="font-size:0.64rem;color:var(--muted);line-height:1.5;margin-bottom:10px;">Libera un folio recorriendo ese número y los siguientes una posición hacia arriba (+1). Solo cambia el número impreso del PDF; los datos del recibo quedan intactos. El folio liberado lo ocupará el siguiente recibo que captures.</div>'
    +      '<div style="display:flex;gap:8px;align-items:center;">'
    +        '<input id="gf-ins-folio" type="number" min="1" placeholder="Folio a liberar (ej. 19)" style="flex:1;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.78rem;background:var(--surface2);color:var(--ink);font-family:monospace;">'
    +        '<button onclick="_gfUIInsertar()" style="padding:8px 14px;border-radius:6px;border:none;background:#2e7d46;color:#fff;font-size:0.74rem;font-weight:700;cursor:pointer;white-space:nowrap;">Insertar</button>'
    +      '</div>'
    +    '</div>'
    +    '<div style="border:1.5px solid rgba(192,22,26,0.35);border-radius:10px;padding:14px;">'
    +      '<div style="font-size:0.8rem;font-weight:700;color:var(--ink);margin-bottom:4px;">🗑 Eliminar recibo</div>'
    +      '<div style="font-size:0.64rem;color:var(--muted);line-height:1.5;margin-bottom:10px;">Borra el recibo completo (recibo, sus movimientos de contabilidad y su PDF). Elige si cerrar el hueco —los folios siguientes bajan uno— o dejarlo.</div>'
    +      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">'
    +        '<input id="gf-del-folio" type="number" min="1" placeholder="Folio a eliminar" style="flex:1;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.78rem;background:var(--surface2);color:var(--ink);font-family:monospace;">'
    +      '</div>'
    +      '<div style="display:flex;gap:8px;">'
    +        '<button onclick="_gfUIEliminar(true)" style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid rgba(192,22,26,0.5);background:rgba(192,22,26,0.12);color:#e85555;font-size:0.72rem;font-weight:700;cursor:pointer;">Eliminar y cerrar hueco</button>'
    +        '<button onclick="_gfUIEliminar(false)" style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid var(--border-l);background:var(--surface2);color:var(--ink);font-size:0.72rem;font-weight:700;cursor:pointer;">Eliminar y dejar hueco</button>'
    +      '</div>'
    +    '</div>'
    +    '<div style="border:1.5px solid rgba(26,74,138,0.35);border-radius:10px;padding:14px;">'    +      '<div style="font-size:0.8rem;font-weight:700;color:var(--ink);margin-bottom:4px;">🔧 Cerrar hueco vacío</div>'    +      '<div style="font-size:0.64rem;color:var(--muted);line-height:1.5;margin-bottom:10px;">Cierra un hueco en la numeración que no tiene recibo (folio vacío). Los folios superiores bajan uno para que la secuencia quede consecutiva.</div>'    +      '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">'    +        '<input id="gf-gap-folio" type="number" min="1" placeholder="Folio del hueco (ej. 43)" style="flex:1;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.78rem;background:var(--surface2);color:var(--ink);font-family:monospace;">'    +      '</div>'    +      '<div style="display:flex;gap:8px;">'    +        '<button onclick="_gfUICerrarHuecoVacio()" style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid rgba(26,74,138,0.5);background:rgba(26,74,138,0.12);color:#4a7fd4;font-size:0.72rem;font-weight:700;cursor:pointer;">🔧 Cerrar hueco vacío</button>'    +      '</div>'    +    '</div>'    +    '<div id="gf-log" style="font-family:monospace;font-size:0.62rem;color:var(--muted);line-height:1.8;max-height:120px;overflow-y:auto;"></div>'
    +  '</div>'
    +'</div>';
  document.body.appendChild(ov);
}

async function _gfUIInsertar(){
  var n=Number((document.getElementById('gf-ins-folio')||{}).value);
  var max=_gfMaxFolio();
  if(!Number.isInteger(n)||n<1){ alert('Escribe un folio válido.'); return; }
  var afectados=_gfRecibosEnRango(n, max);
  var cuenta=_gfDistintosFolios(afectados);
  if(_gfFolioExiste(n) && n<=max){
    if(!confirm('INSERTAR ESPACIO EN FOLIO '+n+'\n\n'
      +'Se recorrerán '+cuenta+' folio(s) hacia arriba (+1):\n'
      +'   '+n+' → '+(n+1)+'   …   '+max+' → '+(max+1)+'\n\n'
      +'• Quedará LIBRE el folio '+n+' (el siguiente recibo lo ocupará).\n'
      +'• Se regeneran los PDF con su folio nuevo y se borran los viejos.\n'
      +'• Los datos de cada recibo NO cambian, solo el número.\n\n'
      +'⚠ Hazlo cuando nadie más esté capturando. ¿Continuar?')) return;
  }
  _gfBloquear(true);
  try{ await _gfInsertarEjecutar(n, _gfLog); }
  catch(e){ console.error(e); alert('Error: '+(e&&e.message?e.message:e)); }
  _gfBloquear(false);
}

async function _gfUIEliminar(cerrar){
  var n=Number((document.getElementById('gf-del-folio')||{}).value);
  var max=_gfMaxFolio();
  if(!Number.isInteger(n)||n<1){ alert('Escribe un folio válido.'); return; }
  var delRecs=(appData.recibos||[]).filter(function(r){ return Number(r.folio)===n; });
  if(!delRecs.length){ alert('No existe el folio '+n+'.'); return; }
  var versiones=delRecs.map(function(r){ return (r.letra||'A'); }).join(', ');
  var nombre=(delRecs[0].nombre||'(sin nombre)');
  var msg='ELIMINAR FOLIO '+n+'   ('+nombre+')\n\n'
    +'Versiones: '+versiones+'\n'
    +'Se borrará: recibo, sus movimientos de contabilidad y su PDF.\n\n';
  if(cerrar) msg+='CERRAR HUECO: los folios > '+n+' bajarán uno ('+(n+1)+'→'+n+'   …   '+max+'→'+(max-1)+').\nSe regeneran sus PDF (solo cambia el número).\n\n';
  else msg+='DEJAR HUECO: quedará un vacío en el folio '+n+'.\n\n';
  msg+='⚠ Acción con respaldo, pero hazla cuando nadie más esté capturando. ¿Continuar?';
  if(!confirm(msg)) return;
  _gfBloquear(true);
  try{ await _gfEliminarEjecutar(n, cerrar, _gfLog); }
  catch(e){ console.error(e); alert('Error: '+(e&&e.message?e.message:e)); }
  _gfBloquear(false);
}

async function _gfUICerrarHuecoVacio(){
  var n=Number((document.getElementById('gf-gap-folio')||{}).value);
  var max=_gfMaxFolio();
  if(!Number.isInteger(n)||n<1){ alert('Escribe un folio válido.'); return; }
  if(n>max){ alert('El folio '+n+' está por encima del último folio (#'+max+'). No hay nada que cerrar.'); return; }
  var tieneRecibo=(appData.recibos||[]).some(function(r){ return Number(r.folio)===n; });
  if(tieneRecibo){ alert('El folio '+n+' tiene un recibo. Usa "Eliminar y cerrar hueco" en su lugar.'); return; }
  var afectados=_gfRecibosEnRango(n+1, max);
  var cuenta=afectados.length;
  if(!confirm('CERRAR HUECO VACÍO EN FOLIO '+n+'\n\n'
    +'No hay recibo en el folio '+n+' — es un hueco vacío.\n'
    +'Se renumerarán '+cuenta+' folio(s) hacia abajo (-1):\n'
    +'   '+(n+1)+'\u2192'+n+'   …   '+max+'\u2192'+(max-1)+'\n\n'
    +'Se regeneran sus PDF (solo cambia el número impreso).\n'
    +'\u26a0 Hazlo cuando nadie más esté capturando. ¿Continuar?')) return;
  _gfBloquear(true);
  try{
    var viejos=afectados.map(function(r){ return {folio:Number(r.folio), letra:(r.letra||'A'), nombre:(r.nombre||'')}; });
    _gfMarcarVaciados(viejos);
    var mapa=new Map();
    for(var f=n+1; f<=max; f++) mapa.set(f, f-1);
    _gfLog('Cerrando hueco vacío '+n+': renumerando '+mapa.size+' folio(s)…');
    await _aplicarMapaRenumeracion(mapa, 2026, max);
    await _gfRegenerarPDFs(afectados, _gfLog);
    _gfLog('Borrando PDFs viejos…');
    await _gfBorrarPDFsViejos(viejos, _gfNombresNuevos(afectados), _gfLog);
    _gfLog('Actualizando Supabase…');
    await _gfActualizarVersionesSB(Array.from(mapa.entries()).sort(function(a,b){ return a[0]-b[0]; }), _gfLog);
    await _gfFijarContador(max);
    try{ await actualizarArchivoControl(); }catch(e){}
    try{ await syncEstadoSupabase(); }catch(e){}
    if(typeof renderHistorial==='function') renderHistorial();
    if(typeof renderContab==='function') renderContab();
    if(typeof renderCaja==='function') renderCaja();
    // FIX: al cerrar el hueco, el folio N queda OCUPADO A PROPOSITO por el
    // recibo que era N+1 (ya renumerado) -- comprobar "N sigue vacio" aqui
    // siempre daba una falsa alarma (el hueco se cierra justamente llenandolo).
    // Lo correcto es verificar que el folio MAXIMO viejo (el que quedo vacio
    // al recorrer todo hacia abajo) ya no exista.
    var _huecoOk = !(appData.recibos||[]).some(function(r){ return Number(r.folio)===max; });
    if(!_huecoOk){
      var _msgHueco='\u26a0 Se esperaba que el folio '+max+' quedara libre tras cerrar el hueco, pero sigue existiendo. Puede deberse a una sincronización con Supabase que llegó tarde. Refresca la página y verifica antes de seguir.';
      _gfLog(_msgHueco); alert(_msgHueco);
    }
    _gfLog('Listo.');
    if(typeof toast==='function') toast('\u2705 Hueco vacío en folio '+n+' cerrado. '+mapa.size+' folio(s) renumerados.','ok');
  } catch(e){ console.error(e); alert('Error: '+(e&&e.message?e.message:e)); }
  _gfBloquear(false);
}

function _sincronizarDriveBadgeRecibo(conectado, nombre) {
  // Badge del recibo (drive-dot + drive-label dentro del panel-nuevo-recibo)
  var dot   = document.querySelector('#panel-nuevo-recibo .drive-dot, .drive-dot');
  var label = document.getElementById('driveLabel');
  if (dot) dot.className = 'drive-dot' + (conectado ? ' on' : ' err');
  if (label) label.textContent = conectado ? ('☁️ ' + (nombre||'Supabase ✓')) : 'Conectar Supabase';
  // También actualizar el badge principal del index si existe
  var badge = document.getElementById('drive-badge');
  if (badge) {
    var bdot = badge.querySelector('.drive-dot');
    var blbl = badge.querySelector('#drive-label, span:last-child');
    if (bdot) bdot.className = 'drive-dot' + (conectado ? ' connected' : ' error');
    if (blbl) blbl.textContent = conectado ? ('☁️ ' + (nombre||'Supabase ✓')) : 'Conectar Supabase';
  }
}

function _abrirModalEliminarRecibo(folio){
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var idx = recibos.findIndex(function(r){ return r && r.folio === folio; });
  if(idx < 0){
    if(typeof toast === 'function') toast('Recibo #' + folioFormato(folio) + ' no encontrado','err');
    return;
  }
  var r = recibos[idx];
  _delRecFolioObjetivo = folio;
  var info = document.getElementById('del-rec-info');
  if(info){
    info.textContent = 'Folio #' + folioConLetra(r.folio, r.anio_folio, r.letra||letraVersion(r)||'A') +
                       ' · ' + (r.nombre || 'Sin nombre') +
                       (r.fecha ? ' · ' + fmtFecha(r.fecha) : '');
  }
  var u = document.getElementById('del-rec-user'); if(u) u.value = '';
  var p = document.getElementById('del-rec-pass'); if(p) p.value = '';
  var e = document.getElementById('del-rec-err'); if(e) e.textContent = '';
  var modal = document.getElementById('modal-eliminar-recibo');
  if(modal) modal.classList.add('show');
  setTimeout(function(){ if(u) u.focus(); }, 100);
}

function cerrarModalEliminarRecibo(){
  var modal = document.getElementById('modal-eliminar-recibo');
  if(modal) modal.classList.remove('show');
  _delRecFolioObjetivo = null;
  var u = document.getElementById('del-rec-user'); if(u) u.value = '';
  var p = document.getElementById('del-rec-pass'); if(p) p.value = '';
  var e = document.getElementById('del-rec-err'); if(e) e.textContent = '';
}

function _purgarPagosParcialesDeVersion(folio, letra, recEliminado) {
  try {
    var L = (letra || 'A');
    var recs = (typeof appData !== 'undefined' && Array.isArray(appData.recibos)) ? appData.recibos : [];
    var versFolio = recs.filter(function(r){ return r && String(r.folio) === String(folio) && !r.esComplemento; });
    var key = function(x){
      if (!x) return '';
      var monto = (x.precio != null) ? x.precio : (x.cantidad != null ? x.cantidad : '');
      return (x.concepto||'') + '|' + (x.descripcion||'') + '|' + String(monto) + '|' + (x.fechaHora||'');
    };
    // Entradas que YA existen en una versión superviviente con letra MENOR a la eliminada
    // son heredadas legítimas y NO se tocan. Las que solo estaban en la versión eliminada
    // (los servicios complementarios/abonos que nacieron ahí) se purgan de todas las versiones.
    var heredadasCE = {}, heredadasPP = {};
    versFolio.forEach(function(r){
      if (String(r.letra||'A').charCodeAt(0) >= String(L).charCodeAt(0)) return;
      (r.costosExtra||[]).forEach(function(c){ heredadasCE[key(c)] = 1; });
      (r.pagosParciales||[]).forEach(function(p){ heredadasPP[key(p)] = 1; });
    });
    var purgarCE = {}, purgarPP = {};
    if (recEliminado) {
      (recEliminado.costosExtra||[]).forEach(function(c){ var k=key(c); if(!heredadasCE[k]) purgarCE[k]=1; });
      (recEliminado.pagosParciales||[]).forEach(function(p){ var k=key(p); if(!heredadasPP[k]) purgarPP[k]=1; });
    }
    // Los pagos parciales además llevan "[folioLetra]" en su descripción (respaldo por tag).
    var reTag = new RegExp('\\[0*' + String(folio) + L + '(\\]|\\s)');
    var _num = function(x){ var n = parseFloat(x); return isFinite(n) ? n : 0; };
    versFolio.forEach(function(r){
      // ── FIX (caso real: folio 110, abono de prueba de $1.00) ───────────────
      // Antes esta función solo QUITABA los renglones heredados de la versión
      // eliminada, pero dejaba intactos `saldoPendiente` y `total`, que ya
      // habían sido recalculados contando ese abono/cargo. Resultado: el recibo
      // quedaba descuadrado para siempre (110A: total $84,272 − anticipo
      // $20,904 = $63,368, pero saldoPendiente se quedó en $63,367) y SCANSYS
      // lo reportaba como "falta $1.00" sin que existiera ningún dinero real
      // perdido. Ahora se revierte exactamente el monto purgado:
      //   · pago parcial eliminado  → ese dinero ya NO está pagado → saldo += P
      //   · costo extra eliminado   → ese cargo ya NO existe → total −= C y saldo −= C
      var _ppQuitado = 0, _ceQuitado = 0;
      if (Array.isArray(r.costosExtra)) {
        r.costosExtra = r.costosExtra.filter(function(c){
          var fuera = purgarCE[key(c)] || reTag.test(String(c.descripcion||''));
          if (fuera) _ceQuitado += _num(c.precio);
          return !fuera;
        });
      }
      if (Array.isArray(r.pagosParciales)) {
        r.pagosParciales = r.pagosParciales.filter(function(p){
          var fuera = purgarPP[key(p)] || reTag.test(String(p.descripcion||''));
          if (fuera) _ppQuitado += _num(p.cantidad);
          return !fuera;
        });
      }
      if (_ceQuitado > 0.005) {
        r.total = Math.max(0, _num(r.total) - _ceQuitado);
        if (r.totalGeneral != null) r.totalGeneral = Math.max(0, _num(r.totalGeneral) - _ceQuitado);
      }
      var _delta = _ppQuitado - _ceQuitado;
      if (Math.abs(_delta) > 0.005) {
        r.saldoPendiente = Math.max(0, _num(r.saldoPendiente) + _delta);
        console.warn('[purgarHistorialVersion] Folio ' + folio + (r.letra||'A') +
          ': saldo reajustado ' + (_delta > 0 ? '+' : '') + _delta.toFixed(2) +
          ' (pagos revertidos $' + _ppQuitado.toFixed(2) + ', cargos revertidos $' + _ceQuitado.toFixed(2) + ')');
      }
    });
  } catch(e){ console.warn('[purgarHistorialVersion]', e); }
}

function _abrirEdicionSecundario(r, recibos) {
  _lockIntentarAdquirir(r.folio).then(function(_lockRes){
  if (!_lockRes.ok) { _lockAvisoBloqueo(_lockRes, r.folio); return; }
  var letra = r.letra || (typeof letraVersion==='function' ? letraVersion(r) : 'A') || 'A';
  // Calcular letra del padre directo: A→B, B→C, etc.
  var letraPadre = String.fromCharCode(letra.toUpperCase().charCodeAt(0) - 1);
  if (letraPadre < 'A') letraPadre = 'A';

  // Buscar el padre directo
  var padre = recibos.find(function(x){
    return x.folio === r.folio && !x.esComplemento &&
           (x.letra || (typeof letraVersion==='function' ? letraVersion(x) : 'A') || 'A') === letraPadre;
  });
  if (!padre) {
    // Si no hay padre directo, buscar el folio A como fallback
    padre = recibos.find(function(x){
      return x.folio === r.folio && !x.esComplemento &&
             (x.letra || (typeof letraVersion==='function' ? letraVersion(x) : 'A') || 'A') === 'A';
    });
  }

  var tipo = _inferirTipoFolioSecundario(r);
  var folioStr = typeof folioConLetra==='function' ? folioConLetra(r.folio, r.anio_folio, letra) : (r.folio + letra);
  var tipoLabel = tipo === 'liquidacion' ? 'PAGO TOTAL' : tipo === 'pago_parcial' ? 'PAGO PARCIAL' : tipo === 'servicio_complementario' ? 'SERV. COMPLEMENTARIO' : 'SECUNDARIO';

  // Confirmar con el administrador
  if (!confirm(
    '✏️ EDITAR FOLIO SECUNDARIO #' + folioStr + '\n\n' +
    'Tipo detectado: ' + tipoLabel + '\n' +
    'Padre directo: #' + (padre ? (typeof folioConLetra==='function' ? folioConLetra(padre.folio, padre.anio_folio, letraPadre) : padre.folio + letraPadre) : 'no encontrado') + '\n\n' +
    'El formulario se abrirá recalculado desde el folio padre.\n' +
    'Los campos se comportarán igual que al crear este tipo de folio.\n\n' +
    '¿Continuar?'
  )) return;

  // Cerrar modal admin
  if (typeof cerrarAdminModal === 'function') cerrarAdminModal();

  // Guardar estado de edición del secundario
  window._edicionSecundarioActiva = {
    folio: r.folio,
    letra: letra,
    tipo: tipo,
    padreLetra: letraPadre,
    padre: padre || null
  };

  // Usar la función de edición completa existente, que carga el recibo por folio+letra
  window._edicionCompletaActiva = true;
  _reciboEnEdicionCompleta = r.folio;
  window._reciboEdicionBackup = r.folio;

  function _cargarSecundario() {
    // Limpiar clases de modo
    ['modo-actualizacion','recibo-frozen','desde-liquidacion','actualizacion-impresa',
     'modo-consulta','folio-liquidado','folio-cancelado','modo-edicion-completa',
     'paneles-busqueda-abiertos']
      .forEach(function(cl){ document.body.classList.remove(cl); });

    _panelesBusquedaAbiertos = false;
    var cuerpo = document.getElementById('paneles-busqueda-cuerpo');
    if (cuerpo) cuerpo.setAttribute('style','display:none;padding:0 20px 14px;');
    var rb = document.getElementById('recibo-body');
    if (rb) { rb.style.cssText = ''; rb.style.removeProperty('display'); }

    if (typeof ir === 'function') ir('nuevo-recibo');

    setTimeout(function() {
      // Recuperar recibo secundario fresco
      var _recibos2 = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
      var _r2 = _recibos2.find(function(x){
        return x.folio === r.folio && !x.esComplemento &&
               (x.letra || (typeof letraVersion==='function' ? letraVersion(x) : 'A') || 'A') === letra;
      }) || r;

      // Recuperar padre fresco
      var _padre2 = _recibos2.find(function(x){
        return x.folio === r.folio && !x.esComplemento &&
               (x.letra || (typeof letraVersion==='function' ? letraVersion(x) : 'A') || 'A') === letraPadre;
      }) || padre;

      // Construir objeto recalculado: base del padre + datos propios del secundario
      var recalculado = Object.assign({}, _r2);

      // Siempre copiar del padre: conceptos originales (base del trámite), vehículo, cliente
      if (_padre2) {
        recalculado.conceptos     = JSON.parse(JSON.stringify(_padre2.conceptos || []));
        recalculado.tramites      = _padre2.tramites || _r2.tramites;
        recalculado.tipoTramite   = _padre2.tipoTramite || _r2.tipoTramite;
        recalculado.total         = _padre2.total || _r2.total;
        // Preservar datos propios del secundario
        recalculado.costosExtra   = JSON.parse(JSON.stringify(_r2.costosExtra || []));
        recalculado.pagosParciales = JSON.parse(JSON.stringify(_r2.pagosParciales || []));
        recalculado.anticipo      = _r2.anticipo;
        recalculado.saldoPendiente = _r2.saldoPendiente;
        recalculado.totalAbonado  = _r2.totalAbonado;
      }

      // ── Activar clases de modo ANTES de cargar el formulario ──────────────
      // cargarReciboEnFormulario() solo vuelca costosExtra/pagosParciales en
      // sus tablas cuando body.modo-edicion-completa YA está presente (ver
      // el bloque "En modo edición completa" dentro de esa función). Antes
      // estas clases se activaban DESPUÉS de llamar a cargarReciboEnFormulario,
      // así que esa condición era falsa en el momento de cargar y la tabla
      // "PAGO REGISTRADO EN ESTE RECIBO" (y Servicio Complementario) quedaban
      // vacías — de ahí que el saldo tampoco cuadrara. Se activa aquí primero.
      document.body.classList.add('modo-edicion-completa');
      // ── Objeto para el cálculo del resumen en pantalla (recalcularResumenActualizacion) ──
      // "ADEUDO ANTERIOR" / "Saldo anterior (resta)" deben reflejar lo que se
      // debía ANTES de que ESTA versión (_r2) aplicara su propio pago — es
      // decir, el saldoPendiente del PADRE directo (74A, 74B…), NO el de _r2
      // mismo (que ya es el saldo DESPUÉS del pago: normalmente $0 si liquidó,
      // por eso el resumen siempre mostraba $0.00 al editar un secundario).
      var _reciboParaResumen = Object.assign({}, _r2, {
        saldoPendiente: _padre2 ? _padre2.saldoPendiente : _r2.saldoPendiente
      });
      if (tipo === 'liquidacion') {
        // Modo pago total: congela conceptos, habilita pagos parciales, marca como liquidación
        document.body.classList.add('recibo-frozen','modo-actualizacion','desde-liquidacion');
        reciboEnActualizacion = _reciboParaResumen;
        window._reciboActualizacionBackup = _reciboParaResumen;
        window._flujoEsPagoTotal = true;
        _r2._esPagoTotal = true;
      } else if (tipo === 'pago_parcial') {
        // Modo pago parcial: congela conceptos, habilita pagos parciales
        document.body.classList.add('recibo-frozen','modo-actualizacion');
        reciboEnActualizacion = _reciboParaResumen;
        window._reciboActualizacionBackup = _reciboParaResumen;
        window._flujoEsPagoTotal = false;
      } else if (tipo === 'servicio_complementario') {
        // Modo servicio complementario: congela conceptos, habilita costos extra
        document.body.classList.add('recibo-frozen','modo-actualizacion');
        window._modoServicioComplementario = true;
        reciboEnActualizacion = _reciboParaResumen;
        window._reciboActualizacionBackup = _reciboParaResumen;
        window._flujoEsPagoTotal = false;
      }

      // ── Fecha/hora PROPIA de esta versión (B, C, D…) ───────────────────────
      // recalculado.fecha_recibo/hora_recibo (heredados de _r2 vía Object.assign)
      // NO son confiables para versiones B+: ese campo puede traer el valor
      // heredado de la versión anterior, o venir vacío (y entonces el formulario
      // recién limpiado por ir('nuevo-recibo') deja la fecha de HOY por defecto).
      // El dato real de "cuándo se emitió/actualizó ESTA versión" vive en la
      // última entrada de fechasImpresion, o en fechaActualizacion/horaActualizacion.
      (function _fijarFechaPropiaVersion(){
        var _fpsEdit = _r2.fechasImpresion || [];
        var _ultimaFP = _fpsEdit.length ? _fpsEdit[_fpsEdit.length - 1] : null;
        var _fechaPropiaB = (_ultimaFP && _ultimaFP.fecha) || _r2.fechaActualizacion || _r2.fecha || _r2.fecha_recibo || '';
        var _horaPropiaB  = (_ultimaFP && _ultimaFP.hora)  || _r2.horaActualizacion  || _r2.hora  || _r2.hora_recibo  || '';
        if (_fechaPropiaB) recalculado.fecha_recibo = _fechaPropiaB;
        if (_horaPropiaB)  recalculado.hora_recibo  = _horaPropiaB;
      })();

      // Cargar en formulario
      if (typeof cargarReciboEnFormulario === 'function') cargarReciboEnFormulario(recalculado);

      // ── Volver editable la fila de "Pago Registrado" de ESTA versión ──────
      // cargarReciboEnFormulario() carga todo pagosParciales como bloqueado/
      // histórico (igual que en Ficha del Folio). Aquí SÍ estamos editando
      // directamente esta versión desde el admin, así que su propia fila de
      // pago (concepto, descripción, monto y fecha/hora) debe quedar editable
      // — no solo el resto del formulario. Las filas que pertenezcan a OTRA
      // versión (folioLetra distinto) se dejan bloqueadas como siempre.
      (function _volverEditablePagoVersionActual(){
        var _tbodyPP = document.getElementById('pagos-parciales-tbody');
        if (!_tbodyPP) return;
        var _filas = Array.from(_tbodyPP.querySelectorAll('tr')).map(function(tr){
          // La descripción guardada trae internamente la etiqueta de folio y
          // autorización que agrega _imprimirActualizacionReal() al imprimir
          // (ej. "del trámite [74B] — Autorizó: A.C.M.* -24/07/2026 20:33-"),
          // incluyendo una fecha/hora embebida en TEXTO que puede quedar
          // desincronizada de la fecha/hora real de la fila (el dato
          // autoritativo vive en tr.dataset.fechaHora, no en este texto).
          // Mostrar/editar esa cadena cruda confundía al admin y arrastraba
          // una fecha vieja. Se limpia a solo "Autorizó: X" — igual que ya
          // se simplificó en el PDF impreso.
          var _descRaw = (tr.querySelector('.pp-descripcion') || {}).value || '';
          var _mAutorizoEdit = /Autoriz[oó]:\s*([^\-]+?)\s*-/i.exec(_descRaw);
          var _descLimpia = _mAutorizoEdit ? ('Autorizó: ' + _mAutorizoEdit[1].trim()) : _descRaw;
          return {
            concepto:    (tr.querySelector('.pp-concepto')    || {}).value || '',
            descripcion: _descLimpia,
            cantidad:    String((typeof parsePrecio === 'function' ? parsePrecio((tr.querySelector('.pp-cantidad')||{}).value) : parseFloat((tr.querySelector('.pp-cantidad')||{}).value)) || 0),
            fechaHora:   tr.dataset.fechaHora || '',
            folioLetra:  tr.dataset.folioLetra || ''
          };
        });
        _tbodyPP.innerHTML = '';
        if (typeof pagoParcialCount !== 'undefined') pagoParcialCount = 0;
        _filas.forEach(function(fd){
          var _esDeEstaVersion = !fd.folioLetra || fd.folioLetra === letra;
          agregarPagoParcial({
            concepto: fd.concepto, descripcion: fd.descripcion, cantidad: fd.cantidad,
            fechaHora: fd.fechaHora, folioLetra: fd.folioLetra,
            locked: !_esDeEstaVersion,
            fechaEditable: _esDeEstaVersion
          });
        });
        // La fila de esta versión queda con fecha/hora "sincronizada" (texto,
        // no editable) — se alinea de inmediato con la fecha/hora maestra del
        // encabezado (ya fijada arriba por _fijarFechaPropiaVersion) y con el
        // texto de conformidad, para que las tres partes coincidan desde que
        // se abre el formulario de edición.
        if (typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
      })();

      // Fijar folio+letra en el display
      var fd = document.getElementById('folio-display');
      if (fd) fd.textContent = folioConLetra(r.folio, r.anio_folio, letra);

      // Actualizar banner de edición
      var lbl = document.getElementById('edicion-folio-label');
      if (lbl) lbl.textContent = 'EDITANDO #' + folioStr + ' [' + tipoLabel + ']';
      var banner = document.getElementById('edicion-completa-banner');
      if (banner) banner.style.display = 'flex';
      if (typeof _ajustarAnchoBannerEdicion === 'function') setTimeout(_ajustarAnchoBannerEdicion, 50);
      var btnGE = document.getElementById('btn-guardar-edicion-completa');
      if (btnGE) btnGE.style.display = '';

      if (typeof syncFormVisibility === 'function') syncFormVisibility();
      if (typeof calcTotales === 'function') calcTotales();
      if (typeof recalcularResumenActualizacion === 'function') recalcularResumenActualizacion();

      if (typeof toast === 'function')
        toast('✏️ Editando #' + folioStr + ' · ' + tipoLabel + ' · Recalculado desde padre ' + letraPadre, 'ok');
    }, 350);
  }

  setTimeout(_cargarSecundario, 300);
  }); // fin _lockIntentarAdquirir(_abrirEdicionSecundario)
}

function _ajustarAnchoBannerEdicion(){
  var banner = document.getElementById('edicion-completa-banner');
  var cuerpo = document.getElementById('recibo-body');
  if(!banner || !cuerpo) return;
  var w = cuerpo.getBoundingClientRect().width;
  if(w > 0) banner.style.width = w + 'px';
}

function editarReciboEnConsulta(rParam) {
  const r = rParam || reciboEnConsulta;
  if (!r) { if (typeof toast === 'function') toast('No hay recibo en consulta', 'err'); return; }
  _lockIntentarAdquirir(r.folio).then(function(_lockRes){
  if (!_lockRes.ok) { _lockAvisoBloqueo(_lockRes, r.folio); return; }
  window._edicionCompletaActiva = true; // ⚠️ evita que ir() limpie el form y pise el folio
  // FIX: la Ficha del Folio es un modal aparte (no un .panel), así que ir()
  // no la oculta — al editar un folio desde el panel de administrador se
  // quedaba abierta de fondo debajo del formulario. Se cierra explícitamente.
  if (typeof cerrarFichaFolio === 'function') cerrarFichaFolio();
  document.getElementById('modal-versiones').classList.remove('show');
  _reciboEnEdicionCompleta  = r.folio;
  window._reciboEdicionBackup = r.folio;
  function _cargar() {
    ['modo-actualizacion','recibo-frozen','desde-liquidacion','actualizacion-impresa',
     'modo-consulta','folio-liquidado','folio-cancelado','modo-edicion-completa',
     'paneles-busqueda-abiertos']
      .forEach(cl => document.body.classList.remove(cl));
    _panelesBusquedaAbiertos = false;
    var cuerpo = document.getElementById('paneles-busqueda-cuerpo');
    if (cuerpo) cuerpo.setAttribute('style','display:none;padding:0 20px 14px;');
    var rb = document.getElementById('recibo-body');
    if (rb) { rb.style.cssText = ''; rb.style.removeProperty('display'); }
    if (typeof ir === 'function') ir('nuevo-recibo');
    const _folioEdicion = r.folio;
    const _letraEdicion = r.letra || (typeof letraVersion==='function'?letraVersion(r):'A') || 'A';
    const _anioFolio    = r.anio_folio;
    setTimeout(function() {
      var _r2 = ((appData||{}).recibos||[]).find(x => x.folio === _folioEdicion && (x.letra||(typeof letraVersion==='function'?letraVersion(x):'A')||'A') === _letraEdicion) || r;
      // ⚠️ FIX CRÍTICO (caso real: folio 84A — se duplicaba la fila "Liquidación
      // total" en PAGO REGISTRADO EN ESTE RECIBO con la fecha de un intento
      // anterior abandonado). Causa raíz: cargarReciboEnFormulario() SOLO
      // limpia y repuebla #pagos-parciales-tbody/#costos-extra-tbody con los
      // datos REALES del recibo cuando body YA tiene la clase
      // modo-edicion-completa (ver ese bloque, ~línea 24827). Antes esa clase
      // se agregaba DESPUÉS de llamar cargarReciboEnFormulario() — así que esa
      // limpieza nunca corría en la primera entrada a Edición Completa, y
      // cualquier fila que hubiera quedado en esas tablas de un modo anterior
      // (ej. "Liquidar Total" abandonado a medias) se quedaba ahí. Al guardar
      // ("Guardar Edición y Regenerar PDF"), getPagosParciales()/getCostosExtra()
      // leen esas tablas tal cual y ESO se guardaba permanentemente en el
      // recibo — contaminándolo con datos de otro folio/intento. Se agrega la
      // clase ANTES de cargarReciboEnFormulario() para que esa limpieza sí
      // corra siempre, con los datos correctos de este recibo específico.
      document.body.classList.add('modo-edicion-completa');
      if (typeof cargarReciboEnFormulario === 'function') cargarReciboEnFormulario(_r2);
      // A petición expresa: el texto de conformidad ("Leído que fue...") debe
      // responder siempre a la fecha del encabezado (#fecha_recibo, recién
      // fijada arriba por cargarReciboEnFormulario) — sin esto se quedaba con
      // la fecha de HOY en vez de la fecha real del recibo que se edita.
      if (typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
      var fd = document.getElementById('folio-display');
      if (fd) fd.textContent = folioConLetra(_folioEdicion, _anioFolio, _letraEdicion);
      var lbl = document.getElementById('edicion-folio-label');
      if (lbl) lbl.textContent = 'EDITANDO FOLIO #' + folioConLetra(_folioEdicion, _anioFolio, _letraEdicion);
      var banner = document.getElementById('edicion-completa-banner');
      if (banner) banner.style.display = 'flex';
      // FIX (caso real: folio 84A — al editar un folio justo después de haber
      // estado en "modo actualización" de OTRO folio (ej. 84B), se quedaban
      // pegados en pantalla los botones "Cancelar Actualización"/"Imprimir
      // Actualización" y el mensaje de estado de esa actualización, encima de
      // los propios de Edición Completa. Causa: abrirModoActualizacion() fija
      // #actions-actualizacion con estilo INLINE "display:flex !important",
      // que sobrevive aunque aquí arriba ya se quitó la clase modo-actualizacion
      // del body (la regla CSS de esa clase deja de aplicar, pero el inline
      // puesto por JS no se toca solo con quitar la clase). Y el texto de
      // estado ("Modo actualización: folio #...") tampoco se sobreescribía.
      var _aActOff = document.getElementById('actions-actualizacion');
      if (_aActOff) _aActOff.setAttribute('style', 'display:none !important;');
      if (typeof setStatus === 'function') setStatus('ok', 'Editando folio #' + folioConLetra(_folioEdicion, _anioFolio, _letraEdicion), 'ok');
      if (typeof _ajustarAnchoBannerEdicion === 'function') setTimeout(_ajustarAnchoBannerEdicion, 50);
      var btnGE = document.getElementById('btn-guardar-edicion-completa');
      if (btnGE) btnGE.style.display = '';
      if (typeof syncFormVisibility === 'function') syncFormVisibility();
      if (typeof calcTotales === 'function') calcTotales();
    }, 300);
  }
  setTimeout(_cargar, 100);
  }); // fin _lockIntentarAdquirir(editarReciboEnConsulta)
}

function cancelarEdicionCompleta() {
  window._edicionCompletaActiva = false; // liberar guard
  if (!confirm('¿Cancelar la edición? Los cambios no se guardarán.')) return;
  if (typeof _lockLiberar === 'function') _lockLiberar(_reciboEnEdicionCompleta);
  _reciboEnEdicionCompleta = null;
  window._reciboEdicionBackup = null;
  // Limpiar estado de edición de folio secundario
  window._edicionSecundarioActiva = null;
  window._flujoEsPagoTotal = false;
  window._modoServicioComplementario = false;
  ['modo-edicion-completa','modo-actualizacion','recibo-frozen','desde-liquidacion'].forEach(function(c){ document.body.classList.remove(c); });
  var btnG = document.getElementById('btn-guardar');
  if (btnG) btnG.style.display = '';
  if (typeof limpiarFormCompleto === 'function') limpiarFormCompleto();
  if (typeof toast === 'function') toast('Edición cancelada');
}

async function guardarEdicionCompleta() {
  // _activarRegistrandoRecibo se activa tras pasar todas las validaciones
  if (_reciboEnEdicionCompleta === null && window._reciboEdicionBackup != null) {
    _reciboEnEdicionCompleta = window._reciboEdicionBackup;
  }

  if (_reciboEnEdicionCompleta === null) {
    window._desactivarRegistrandoRecibo(); if (typeof toast === 'function') toast('Error: no hay recibo en edición', 'err'); return;
  }
  var _folioParaLiberarCandado = _reciboEnEdicionCompleta; // capturado antes de que se ponga null al guardar

  if (!sbSession || Date.now() >= sbExpiry) {
    window._desactivarRegistrandoRecibo(); if (typeof mostrarDriveOverlay === 'function') mostrarDriveOverlay('guardarEdicionCompleta'); return;
  }
  // ─── Leer folio y letra desde los inputs de edición ─────────────
  const folioInputEl  = document.getElementById('folio-edit-input');
  const letraSelectEl = document.getElementById('folio-letra-select');
  const folioOriginal = _reciboEnEdicionCompleta;
  // ⚠️ FIX: el folio siempre es fijo al editar desde admin — nunca debe cambiar
  const folioFinal    = folioOriginal;
  const folioChanged  = false;
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  // ⚠️ FIX: si editamos un secundario (B, C, D...) buscar por folio+letra para no pisar la versión A
  var _letraSecBuscar = (window._edicionSecundarioActiva && window._edicionSecundarioActiva.letra) || null;
  var idx = _letraSecBuscar
    ? recibos.findIndex(function(r){
        return r.folio === folioOriginal && !r.esComplemento &&
               (r.letra || (typeof letraVersion==='function' ? letraVersion(r) : 'A') || 'A') === _letraSecBuscar;
      })
    : recibos.findIndex(function(r){ return r.folio === folioOriginal; });
  if (idx < 0) { window._desactivarRegistrandoRecibo(); if (typeof toast === 'function') toast('Error: recibo no encontrado en memoria', 'err'); return; }
  var r = recibos[idx];
  const letraOriginal = r.letra || 'A'; // capturar antes de cualquier mutación
  var letraRecibo = (letraSelectEl && letraSelectEl.value) ? letraSelectEl.value : (r.letra || 'A');
  // ─── Recoger datos del formulario ───────────────────────────────
  var clientes = typeof getClientes === 'function' ? getClientes() : [];

  if (!clientes.length || !clientes[0].nombre) {
    window._desactivarRegistrandoRecibo(); if (typeof setStatus === 'function') setStatus('err','Ingresa el nombre del cliente','err'); return;
  }
  var conceptos      = typeof getConceptos      === 'function' ? getConceptos()      : [];
  var costosExtra    = typeof getCostosExtra    === 'function' ? getCostosExtra()    : [];
  var pagosParciales = typeof getPagosParciales === 'function' ? getPagosParciales() : [];
  var _anticipoInputVal = typeof parsePrecio === 'function' ? parsePrecio(document.getElementById('anticipo').value) : 0;
  var total      = conceptos.reduce(function(s,c){ return s + (parseFloat(c.precio)||0); }, 0);
  var anticipo, saldo;
  if (letraRecibo !== 'A') {
    // ⚠️ FIX (caso real: folio 74B): al editar un SECUNDARIO (B, C, D…), el
    // campo #anticipo del formulario es solo un ESPEJO del abono de ESTA
    // versión (ver recalcularResumenActualizacion/_sincronizarFechaHoraMaestraPagos)
    // — NUNCA representa el anticipo original del folio. Guardarlo tal cual en
    // r.anticipo pisaba el anticipo real (folio A) con el abono de esta
    // versión ($5,500 real quedaba en $5,000), y generarPDF() usa r.anticipo
    // como "anticipo original" para calcular SALDO ANTERIOR/SALDO RESTANTE —
    // el PDF salía descuadrado en $500 aunque el formulario en pantalla se
    // veía correcto (ese sí usa el saldo del padre, ver _abrirEdicionSecundario).
    // El anticipo real y permanente del folio se relee siempre del folio A.
    var _padreEdit = recibos.find(function(x){
      return x.folio === folioOriginal && !x.esComplemento &&
             (x.letra || (typeof letraVersion==='function' ? letraVersion(x):'A') || 'A') === 'A';
    });
    anticipo = _padreEdit ? (parseFloat(_padreEdit.anticipo)||0) : (parseFloat(r.anticipo)||0);
    var _sumaPPEdit = pagosParciales.reduce(function(s,p){ return s + (parseFloat(p.cantidad)||0); }, 0);
    saldo = Math.max(0, total - anticipo - _sumaPPEdit);
  } else {
    anticipo = _anticipoInputVal;
    saldo = Math.max(0, total - anticipo);
  }
  var primerNombre = clientes[0].nombre;
  var camposSimples = ['tramites','clase','marca','tipo_veh','serie','motor','personas_veh','anio','puertas',
    'color_veh','transmision','cilindros','placa','ultima_tenencia','origen','combustible'];
  var datosVeh = {};
  camposSimples.forEach(function(fid){
    var el = document.getElementById(fid);
    if (el) datosVeh[fid] = el.value;
  });
  // ⚠️ FIX: antes se forzaba #placa-estado a '' justo aquí, borrando siempre el
  // estado de la placa seleccionado al guardar una Edición Completa. Ahora se
  // lee el valor real (cargado previamente por cargarReciboEnFormulario) sin tocarlo.
  datosVeh.placaEstado = (document.getElementById('placa-estado') || {value:''}).value || '';
  var tipoTramiteVal = (typeof tipoTramite !== 'undefined' ? tipoTramite : null) ||
                       (document.getElementById('tipo-tramite-select') || {}).value ||
                       r.tipoTramite || 'normal';
  var tipo_doc    = (document.getElementById('tipo_doc') || {}).value || r.tipo_doc || 'copia';
  var responsable = (document.getElementById('responsable') || {}).value || r.responsable || '';
  // ⚠️ FIX: priorizar la fecha/hora RETROACTIVA (window._reciboRetroactivoFechaPersonalizada)
  // sobre el input #fecha_recibo. El input debería quedar sincronizado por
  // confirmarFechaRetro(), pero si algo lo revierte a "hoy" entre que se confirma
  // la fecha retro y se guarda, esto asegura que la retroactiva gane de todos modos.
  var _retroActivoEdit = !!(window._reciboRetroactivoActivo && window._reciboRetroactivoFechaPersonalizada);
  var fechaRecibo = _retroActivoEdit
    ? window._reciboRetroactivoFechaPersonalizada
    : ((document.getElementById('fecha_recibo') || {}).value || r.fecha_recibo || '');
  var horaRecibo  = _retroActivoEdit
    ? (window._reciboRetroactivoHoraPersonalizada || (document.getElementById('hora_recibo') || {}).value || r.hora_recibo || '')
    : ((document.getElementById('hora_recibo')  || {}).value || r.hora_recibo  || '');
  var nombreFirma = (document.getElementById('nombre_cliente_firma') || {}).value || primerNombre;
  var copias      = typeof getDocumentosSeleccionados === 'function' ? getDocumentosSeleccionados() : '';
  var descripVeh  = tipoTramiteVal === 'vehicular' ? (_descripcionVehicular || r.descripcionVehicular || '') : '';
  var anioFolio   = r.anio_folio || (typeof appData !== 'undefined' ? (appData.anioFolioActual || new Date().getFullYear()) : new Date().getFullYear());
  // letraRecibo ya se calculó arriba (se necesita antes, para el cálculo de anticipo/saldo).
  // ⚠️ FIX: generarPDF() decide si un recibo "es actualización" (_esUpdate) mirando
  // datos.fechasImpresion.length>1 — como esta función nunca lo llenaba, TODO recibo
  // secundario (B, C, D…) editado aquí se imprimía como si fuera el original (letra A):
  // se perdía el desglose de ADEUDO ANTERIOR/versión, y la fecha del encabezado del
  // recibo (que en actualizaciones se lee de fechasImpresion, no de fecha_recibo)
  // no reflejaba la fecha retroactiva. Se reconstruye igual que el flujo normal de
  // actualización, pero REEMPLAZANDO la última entrada (esta misma versión) en vez
  // de agregar una nueva — esto es una edición de la versión existente, no un abono nuevo.
  var fechasImpresionEdit = (r.fechasImpresion && r.fechasImpresion.length)
    ? r.fechasImpresion.slice()
    : (letraRecibo !== 'A' ? [{ fecha: r.fecha || r.fecha_recibo || '', hora: r.hora || r.hora_recibo || '', etiqueta: 'Original' }] : []);
  if (letraRecibo !== 'A') {
    var _etiquetaVersionEdit = (fechasImpresionEdit.length && fechasImpresionEdit[fechasImpresionEdit.length-1].etiqueta) || 'Actualización';
    var _entradaVersionEdit = { fecha: fechaRecibo, hora: horaRecibo, etiqueta: _etiquetaVersionEdit };
    if (fechasImpresionEdit.length) fechasImpresionEdit[fechasImpresionEdit.length - 1] = _entradaVersionEdit;
    else fechasImpresionEdit.push(_entradaVersionEdit);
  }
  // ─── Validar que el folio nuevo no exista ya ────────────────────
  if (folioChanged) {
    const yaExiste = recibos.some(function(x){ return x.folio === folioFinal; });

    if (yaExiste) {
      window._desactivarRegistrandoRecibo();
      if (typeof toast === 'function') toast('❌ El folio ' + folioFinal + ' ya existe. Elige otro número.', 'err');
      return;
    }
  }
  var btn = document.getElementById('btn-guardar-edicion-completa');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }
  window._mostrarGenerandoPDF([], 'Generando PDF…'); // los botones ya se deshabilitan arriba
  window._activarRegistrandoRecibo(); // ✅ aquí sí: todas las validaciones pasaron

  try {
    // ─── Si el folio cambió: renombrar en todas las estructuras ───
    if (folioChanged) {
      const mapa = new Map([[folioOriginal, folioFinal]]);
      await _aplicarMapaRenumeracion(mapa, anioFolio, appData.folioActual);
      // Renombrar en versiones_recibo de Supabase
      if (window.SB && window.SB_DESPACHO_ID) {
        window.SB.from('versiones_recibo')
          .update({ folio_base: folioFinal })
          .eq('despacho_id', window.SB_DESPACHO_ID)
          .eq('folio_base', folioOriginal)
          .then(({error}) => { if(error) console.warn('[versiones_recibo rename]', error); });
      }
      // Re-encontrar el recibo con el nuevo folio
      idx = appData.recibos.findIndex(function(x){ return x.folio === folioFinal; });
      if (idx < 0) { if (typeof toast === 'function') toast('Error interno: recibo no encontrado tras renombrar', 'err'); return; }
      r = appData.recibos[idx];
      _reciboEnEdicionCompleta = folioFinal;
    }
    // ─── Snapshot ANTES de mutar ────────────────────────────────────
    if (typeof _guardarSnapshotRecibo === 'function')
      _guardarSnapshotRecibo(r, 'Antes de edición completa');
    // ─── Actualizar el objeto del recibo ────────────────────────────
    const copiasParsed = (()=>{ try{ return JSON.parse(copias||'{}').docs||[]; }catch(e){ return []; } })();
    r.nombre               = primerNombre;
    r.clientes             = clientes;
    r.conceptos            = conceptos;
    r.costosExtra          = costosExtra;
    r.pagosParciales       = pagosParciales;
    r.total                = total;
    r.anticipo             = String(anticipo);
    r.saldoPendiente       = saldo;
    if (saldo <= 0 && typeof _eliminarPendientePorFolio === 'function')
      _eliminarPendientePorFolio(r.folio);
    r.fecha                = fechaRecibo;
    r.fecha_recibo         = fechaRecibo;
    r.hora                 = horaRecibo;
    r.hora_recibo          = horaRecibo;
    if (letraRecibo !== 'A') r.fechasImpresion = fechasImpresionEdit;
    r.tipoTramite          = tipoTramiteVal;
    r.tipo_doc             = tipo_doc;
    r.modoCosto            = (document.getElementById('modo-costo-pactado')||{}).value || r.modoCosto || '';
    r.copias               = copiasParsed;
    r.responsable          = responsable;
    r.generadoPor          = responsable;
    r.nombre_cliente_firma = nombreFirma;
    r.letra                = letraRecibo;
    r.descripcionVehicular = descripVeh;
    Object.assign(r, datosVeh);
    r.pdfBase64            = null;
    if (typeof REC !== 'undefined') REC.recibos = appData.recibos;
    // ─── Generar PDF con generarPDF() igual que guardarRecibo ───────
    const anioFolioN = r.anio_folio || anioFolio;
    const datos = {
      folio: r.folio,
      clientes,
      tramites: datosVeh.tramites||'', clase: datosVeh.clase||'',
      marca: datosVeh.marca||'', tipo_veh: datosVeh.tipo_veh||'', serie: datosVeh.serie||'', motor: datosVeh.motor||'',
      personas_veh: datosVeh.personas_veh||'',
      anio: datosVeh.anio||'', puertas: datosVeh.puertas||'', color_veh: datosVeh.color_veh||'',
      transmision: datosVeh.transmision||'', cilindros: datosVeh.cilindros||'',
      placa: datosVeh.placa||'', placaEstado: datosVeh.placaEstado||'', ultima_tenencia: datosVeh.ultima_tenencia||'',
      origen: datosVeh.origen||'', combustible: datosVeh.combustible||'',
      copias,
      tipoTramite: tipoTramiteVal,
      modoCosto: r.modoCosto || '',
      fecha_recibo: fechaRecibo,
      hora_recibo: horaRecibo,
      anticipo: String(anticipo),
      responsable,
      nombre_cliente_firma: nombreFirma,
      conceptos,
      costosExtra,
      pagosParciales,
      fechasImpresion: fechasImpresionEdit,
      timestamp: (typeof ahoraCDMX === 'function' ? ahoraCDMX() : new Date()).toISOString(),
      folioAnterior: r.folioAnterior || null,
      historialPagosRef: r.historialPagosRef || [],
      totalGeneral: total,
      totalAbonado: anticipo,
      saldoNuevo: saldo,
      descripcionVehicular: descripVeh,
      letra: letraRecibo,
      anio_folio: anioFolioN
    };
    const qrTexto  = 'LEX-MEXICO|Folio:' + folioConLetra(r.folio, anioFolioN, letraRecibo) + '|' + primerNombre + '|' + fechaRecibo + ' ' + horaRecibo;
    const qrDataURL = typeof qrToDataURL === 'function' ? await qrToDataURL(qrTexto) : null;
    const doc = await generarPDF(datos, r.folio, qrDataURL);
    const nombreArchivo = folioConLetra(r.folio, anioFolioN, letraRecibo) + '.pdf';
    r.pdfBase64 = doc.output('datauristring');
    r.archivo   = nombreArchivo;
    r.archivoR2 = nombreArchivo; // referencia canónica corta
    // ─── Subir PDF a Storage ────────────────────────────────────────
    // Purga TODAS las variantes viejas (corta + descriptiva legacy) en R2 y Drive
    // antes de subir la versión nueva → un solo archivo por recibo.
    if (typeof _purgarPDFRecibo === 'function') {
      try { await _purgarPDFRecibo(nombreArchivo.replace(/\.pdf$/i,''), primerNombre); } catch(e){ registrarError('catch vacio', e); }
    } else if (typeof borrarPDFdeDrive === 'function') {
      try { await borrarPDFdeDrive(nombreArchivo); } catch(e){ registrarError('catch vacio', e); }
    }
    if (typeof subirPDFaDrive === 'function') {
      subirPDFaDrive(doc.output('blob'), nombreArchivo).catch(e => console.warn('SB upload edicion:', e));
    }
    // ─── Guardar versión en Supabase ────────────────────────────────
    // Si la letra cambió (mismo folio), renombrar la fila existente antes de upsert
    if(letraRecibo !== letraOriginal && !folioChanged && window.SB && window.SB_DESPACHO_ID) {
      window.SB.from('versiones_recibo')
        .update({ letra: letraRecibo })
        .eq('despacho_id', window.SB_DESPACHO_ID)
        .eq('folio_base', r.folio)
        .eq('anio_folio', r.anio_folio || anioFolio)
        .eq('letra', letraOriginal)
        .then(({error}) => { if(error) console.warn('[versiones_recibo letra]', error); });
    }
    if (typeof _guardarVersionEnSupabase === 'function') {
      _guardarVersionEnSupabase(r, letraRecibo, nombreArchivo).catch(e => console.warn('[versiones] edicion:', e));
    }
    // ─── Actualizar movimiento en contabilidad ANTES de persistir ────
    // ⚠️ IMPORTANTE: debe hacerse ANTES de save() para que _protegerMovimientosRecibo()
    // no detecte el movimiento como "perdido" y lo rescate innecesariamente.
    if (typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
      const folioStr2 = folioConLetra(r.folio, anioFolioN, letraRecibo);
      // Buscar por ID con letra (exacto) o sin letra (versión A legacy) o por folio+letra
      const idMovConLetra = letraRecibo !== 'A' ? 'M-REC-' + r.folio + '-' + letraRecibo : null;
      const idMovSinLetra = 'M-REC-' + r.folio;
      const idMovViejo    = 'M-REC-' + folioOriginal;
      const idxMov = D.movimientos.findIndex(function(m){
        return m.id === idMovConLetra
            || m.id === idMovSinLetra
            || m.id === idMovViejo
            // ⚠️ FIX (caso real: folio 88A con movimiento "M-REST-88A-…"): folio se
            // compara con Number() en ambos lados porque en los movimientos guardados
            // en Supabase/jsonb suele venir como STRING ("88") mientras que r.folio es
            // NUMBER — la comparación estricta anterior nunca encontraba movimientos
            // con id fuera del patrón "M-REC-{folio}" (ej. restaurados "M-REST-…"),
            // así que la edición nunca actualizaba su fecha/monto/estatus en Contabilidad.
            || (m.fuente === 'recibo' && Number(m.folio) === Number(r.folio) && (m.letra||'A') === letraRecibo);
      });
      const c0      = (r.conceptos || [])[0];
      const txtConc = c0 ? ((c0.concepto||'') + (c0.descripcion ? ' — ' + c0.descripcion : '')) : '';
      const movDesc = txtConc || folioStr2;
      const estatus = anticipo < total ? 'Anticipo' : 'Liquidado';
      if (idxMov >= 0) {
        D.movimientos[idxMov].id          = idMovSinLetra;
        D.movimientos[idxMov].folio       = r.folio;
        D.movimientos[idxMov].letra       = letraRecibo;
        D.movimientos[idxMov].nombre      = primerNombre;
        D.movimientos[idxMov].descripcion = movDesc;
        D.movimientos[idxMov].fecha       = fechaRecibo;
        D.movimientos[idxMov].hora        = horaRecibo;
        D.movimientos[idxMov].monto       = anticipo || total;
        D.movimientos[idxMov].responsable = responsable;
        D.movimientos[idxMov].cat         = estatus + ' · #' + folioStr2;
        D.movimientos[idxMov].estatus     = estatus;
      }
    }
    window._desactivarRegistrandoRecibo(); // movimiento registrado — protección puede correr
    // ─── Persistir JSON ─────────────────────────────────────────────
    if (typeof save === 'function') save();
    await actualizarArchivoControl();
    // ─── Sincronizar a Supabase ─────────────────────────────────────
    try { await syncEstadoSupabase(); } catch(e) { console.warn('sync error:', e); }
    if (typeof renderHistorial === 'function') renderHistorial();
    if (typeof renderRec === 'function') renderRec();
    if (typeof renderCaja === 'function') renderCaja();
    if (typeof renderContab === 'function') renderContab();
    if (typeof badges === 'function') badges();
    const folioStrFinal = folioConLetra(r.folio, anioFolioN, letraRecibo);
    if (typeof toast === 'function')
      toast('✅ Recibo #' + folioStrFinal + ' editado y PDF regenerado.');
    if (typeof setStatus === 'function')
      setStatus('ok','Recibo #' + folioStrFinal + ' actualizado correctamente','ok');
    // ─── Salir del modo edición ─────────────────────────────────────
    _reciboEnEdicionCompleta = null;
    window._reciboEdicionBackup = null;
    window._edicionCompletaActiva = false; // liberar guard
    // Limpiar estado de edición de folio secundario
    window._edicionSecundarioActiva = null;
    window._flujoEsPagoTotal = false;
    window._modoServicioComplementario = false;
    document.body.classList.remove('modo-edicion-completa','modo-actualizacion','recibo-frozen','desde-liquidacion');
    var btnG = document.getElementById('btn-guardar');
    if (btnG) btnG.style.display = '';
    if (typeof limpiarFormCompleto === 'function') limpiarFormCompleto();
  } catch(e) {
    console.error('guardarEdicionCompleta error:', e);
    if (typeof toast === 'function') toast('❌ Error al guardar: ' + e.message, 'err');
    if (typeof setStatus === 'function') setStatus('err','Error al guardar edición','err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar Edición y Regenerar PDF'; }
    window._ocultarGenerandoPDF([]);
    if (typeof _lockLiberar === 'function') _lockLiberar(_folioParaLiberarCandado);
  }
}

async function borrarPDFdeDrive(nombreArchivo) {
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  try {
    const path = window.SB_DESPACHO_ID + '/recibos/' + nombreArchivo;
    await window.SB.storage.from(STORAGE_BUCKET).remove([path]);
  } catch(e) { console.warn('borrarPDF:', e); }
}

async function verVistaPrevia(idx) {
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : (REC.recibos || []);
  var r = recibos[idx];
  if (!r) return;
  // Crear/reutilizar modal
  var modal = document.getElementById('modal-vista-previa-recibo');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-vista-previa-recibo';
    modal.className = 'modal-ov';
    var h = '<div class="modal" style="max-width:900px;width:96vw;max-height:92vh;display:flex;flex-direction:column;">';
    h += '<div class="modal-hdr" style="flex-shrink:0;">';
    h += '<h3 id="vp-titulo" style="font-size:0.9rem;"></h3>';
    h += '<button class="modal-x" onclick="document.getElementById(\"modal-vista-previa-recibo\").classList.remove(\"show\")">&#10005;</button>';
    h += '</div>';
    h += '<iframe id="vp-iframe" style="flex:1;border:none;min-height:70vh;" src=""></iframe>';
    h += '</div>';
    modal.innerHTML = h;
    document.body.appendChild(modal);
  }
  var folio = '#' + folioConLetra(r.folio||0, r.anio_folio, r.letra||letraVersion(r)||'A');
  document.getElementById('vp-titulo').textContent = 'Recibo ' + folio + ' — ' + (r.nombre||'');
  modal.classList.add('show');
  var iframe = document.getElementById('vp-iframe');
  function _mostrarEnIframe(src){
    if(iframe._blobUrl){ try{ URL.revokeObjectURL(iframe._blobUrl); }catch(e){} iframe._blobUrl=null; }
    if(src.startsWith('data:')){
      const b64=src.split(',')[1], bin=atob(b64), arr=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
      const bUrl=URL.createObjectURL(new Blob([arr],{type:'application/pdf'}));
      iframe._blobUrl=bUrl; iframe.src=bUrl+'#toolbar=0&navpanes=0&scrollbar=0&view=FitH';
    } else { iframe.src=src; }
  }
  if(r.pdfBase64){ _mostrarEnIframe(r.pdfBase64); return; }
  if(!r.archivo || !window.SB_DESPACHO_ID){ setStatus('err','Sin PDF para este folio','err'); return; }
  const _pathSBVP = window.SB_DESPACHO_ID + '/recibos/' + r.archivo;
  const _pathR2VP = window.SB_DESPACHO_ID + '/recibos/' + (r.archivoR2 || r.archivo);
  let _blob = null;
  if(typeof window.descargarR2 === 'function'){
    try { const b=await window.descargarR2(_pathR2VP,'recibos'); if(b&&b.size>0) _blob=b; } catch(e){ console.warn('[verVistaPrevia] R2:',e); }
  }
  if(!_blob && window.SB){
    try {
      const {data:sd,error:se}=await window.SB.storage.from(STORAGE_BUCKET).createSignedUrl(_pathSBVP,120);
      if(!se&&sd&&sd.signedUrl){ const res=await fetch(sd.signedUrl); if(res.ok) _blob=await res.blob(); }
    } catch(e){ console.warn('[verVistaPrevia] SB:',e); }
  }
  if(_blob){
    const bUrl=URL.createObjectURL(_blob);
    if(iframe._blobUrl){ try{ URL.revokeObjectURL(iframe._blobUrl); }catch(e){} } iframe._blobUrl=bUrl;
    iframe.src=bUrl+'#toolbar=0&navpanes=0&scrollbar=0&view=FitH';
    const rd=new FileReader(); rd.onload=()=>{ r.pdfBase64=rd.result; }; rd.readAsDataURL(_blob);
  } else {
    setStatus('err','No se pudo cargar el PDF del folio '+folio,'err');
  }
}

function buscarReciboFolio(folio) {
  var num = parseInt(String(folio).trim(), 10);
  if (isNaN(num)) return;
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : (REC.recibos || []);
  var idx = recibos.findIndex(function(r){ return r.folio === num; });
  if (idx < 0) { if (typeof toast === 'function') toast('Folio no encontrado','err'); return; }
  verVistaPrevia(idx);
}

function sincronizarFolioConREC() {
  if (typeof REC === 'undefined') return;
  if (REC.folioActual && REC.folioActual > (appData.folioActual || 100)) appData.folioActual = REC.folioActual;
  if (REC.recibos && REC.recibos.length > 0) {
    // Clave compuesta folio|letra para que B/C/D en appData sobrevivan si REC solo tiene A
    var fds = new Set(REC.recibos.map(function(r){
      var l = r.letra||(typeof letraVersion==='function'?letraVersion(r):'A')||'A';
      return r.folio+'|'+l;
    }));
    var soloL = (appData.recibos||[]).filter(function(r){
      var l = r.letra||(typeof letraVersion==='function'?letraVersion(r):'A')||'A';
      return !fds.has(r.folio+'|'+l);
    });
    appData.recibos = soloL.concat(REC.recibos);
  }
  if (typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
  if (typeof renderHistorial === 'function') renderHistorial();
}

function abrirVincularRecibo(idx) {
  _recibo_vincular_idx = idx;
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[idx];
  if (!r) return;
  var modal = document.getElementById('modal-vincular-recibo');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-vincular-recibo';
    modal.className = 'modal-ov';
    var mh = '<div class="modal" style="max-width:500px;width:95vw;max-height:92vh;display:flex;flex-direction:column;">';
    mh += '<div class="modal-hdr">';
    mh += '<h3 style="font-size:0.9rem;">&#128194; Vincular con Carpeta / Juicio</h3>';
    mh += '<button class="modal-x" onclick="document.getElementById(\"modal-vincular-recibo\").classList.remove(\"show\")">&#10005;</button>';
    mh += '</div><div class="modal-body" style="padding:16px;">';
    mh += '<div id="vinc-rec-info" style="font-size:0.72rem;color:var(--muted);margin-bottom:14px;background:var(--surface2);padding:8px 10px;border-radius:4px;"></div>';
    mh += '<div class="field" style="margin-bottom:12px;"><label style="font-size:0.72rem;color:var(--muted);">&#128193; Carpeta de Archivo</label>';
    mh += '<select id="vinc-carpeta" style="width:100%;background:var(--surface);border:1px solid var(--border-l);border-radius:4px;padding:8px;color:var(--gold-l);font-size:0.74rem;"><option value="">&#8212; Sin carpeta &#8212;</option></select></div>';
    mh += '<div class="field" style="margin-bottom:12px;"><label style="font-size:0.72rem;color:var(--muted);">&#9878; Expediente de Juicio</label>';
    mh += '<select id="vinc-juicio" style="width:100%;background:var(--surface);border:1px solid var(--border-l);border-radius:4px;padding:8px;color:var(--gold-l);font-size:0.74rem;"><option value="">&#8212; Sin juicio &#8212;</option></select></div>';
    mh += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">';
    mh += '<button class="btn btn-ghost" onclick="document.getElementById(\"modal-vincular-recibo\").classList.remove(\"show\")">Cancelar</button>';
    mh += '<button class="btn" onclick="confirmarVincularRecibo()" style="background:var(--gold-d);color:#fff;border:none;">&#128190; Vincular</button>';
    mh += '</div></div></div>';
    modal.innerHTML = mh;
    document.body.appendChild(modal);
  }
  document.getElementById('vinc-rec-info').textContent = '#' + folioConLetra(r.folio||0, r.anio_folio, r.letra||letraVersion(r)||'A') + ' — ' + (r.nombre||'') + ' · ' + (r.fecha||'');
  var selCarp = document.getElementById('vinc-carpeta');
  selCarp.innerHTML = '<option value="">&#8212; Sin carpeta &#8212;</option>';
  if (typeof D !== 'undefined' && D.carpetas && D.carpetas.length) {
    D.carpetas.forEach(function(c, ci) {
      var opt = document.createElement('option');
      opt.value = ci;
      opt.textContent = (c.nombre || c.titulo || 'Carpeta ' + (ci+1));
      if (r.carpetaIdx === ci) opt.selected = true;
      selCarp.appendChild(opt);
    });
  }
  var selJuicio = document.getElementById('vinc-juicio');
  selJuicio.innerHTML = '<option value="">&#8212; Sin juicio &#8212;</option>';
  if (typeof D !== 'undefined' && D.juicios && D.juicios.length) {
    D.juicios.forEach(function(j, ji) {
      var opt = document.createElement('option');
      opt.value = ji;
      opt.textContent = (j.nombre || j.titulo || j.expediente || 'Juicio ' + (ji+1));
      if (r.juicioIdx === ji) opt.selected = true;
      selJuicio.appendChild(opt);
    });
  }
  modal.classList.add('show');
}

function confirmarVincularRecibo() {
  if (_recibo_vincular_idx === null) return;
  var recibos = (typeof appData !== 'undefined' && appData.recibos) ? appData.recibos : [];
  var r = recibos[_recibo_vincular_idx];
  if (!r) return;
  var carpVal = document.getElementById('vinc-carpeta').value;
  var juicioVal = document.getElementById('vinc-juicio').value;
  if (carpVal !== '') r.carpetaIdx = parseInt(carpVal); else delete r.carpetaIdx;
  if (juicioVal !== '') r.juicioIdx = parseInt(juicioVal); else delete r.juicioIdx;
  if (typeof actualizarArchivoControl === 'function') actualizarArchivoControl().catch(function(e){console.warn(e);});
  if (typeof save === 'function') save();
  if (typeof renderHistorial === 'function') renderHistorial();
  document.getElementById('modal-vincular-recibo').classList.remove('show');
  if (typeof toast === 'function') toast('Recibo vinculado &#10003;');
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

function _expDigDocsArray(paraEscribir) {
  var pend = _expDigPendienteActual();
  if (pend) { if (paraEscribir && !pend.documentos) pend.documentos = []; return pend.documentos || []; }
  var r = _expDigState.recibo;
  if (r) { if (paraEscribir && !r.expDigitalDocumentosPlacas) r.expDigitalDocumentosPlacas = []; return r.expDigitalDocumentosPlacas || []; }
  return [];
}

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

function _prEstadoColor(pr) {
  const dias = Math.floor((Date.now() - new Date(pr.fechaInicio).getTime()) / 86400000);
  if (pr.estado === 'listo') return { color: '#1a7a3a', bg: '#e8f5ec', label: 'Listo para cobrar' };
  if (dias >= 15) return { color: '#c0161a', bg: '#fff0f0', label: dias + ' días sin anticipo' };
  if (dias >= 7)  return { color: '#9a6010', bg: '#fff8e8', label: dias + ' días sin anticipo' };
  return { color: '#1a4a8a', bg: '#eef3ff', label: dias === 0 ? 'Hoy' : dias + (dias===1?' día':' días') };
}

async function abrirPreRecibo() {
  ir('pre-recibo');
}

function _prVolverLista() {
  const btn = document.getElementById('pr-btn-generar');
  if (btn) btn.textContent = '＋ Generar Pre-Recibo';
  _prRenderLista();
}

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

function _prEliminar(prId) {
  if (!confirm('¿Eliminar este pre-recibo? Esta acción no se puede deshacer.')) return;
  D.preRecibos = (D.preRecibos || []).filter(p => p.id !== prId);
  _prGuardar();
  if(typeof toast==='function') toast('Pre-Recibo eliminado', 'ok');
  _prRenderLista();
}

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
