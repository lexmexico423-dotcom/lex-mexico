/* ═══════════════════════════════════════════════════════════════
   LEX-MÉXICO · caja.js
   Render caja, contabilidad, movimientos, folios, filtros de recibos
   Dependencias: utils.js debe cargarse primero
═══════════════════════════════════════════════════════════════ */

// ═══ ORDENAMIENTO UNIFICADO DE MOVIMIENTOS ═══
// Función global que aplica el mismo criterio de ordenamiento en TODOS los paneles
// (Caja, Contabilidad, Historial, Admin de movimientos).
// Orden: descendente (más reciente arriba), con desempate inteligente.
function _ordenarMovs(movs){
  return movs.slice().sort((a,b)=>{
    // 1. Comparar fecha+hora (descendente: más reciente arriba)
    const claveA = (a.fecha||'') + (a.hora||'00:00');
    const claveB = (b.fecha||'') + (b.hora||'00:00');
    const cmp = claveB.localeCompare(claveA);
    if(cmp !== 0) return cmp;

    // 2. Si misma fecha+hora, desempate por timestamp del ID
    // Los IDs de captura tienen epoch ms (ej: M-1730000000000)
    const tsA = parseInt(((a.id||'').match(/\d{10,}/)||[0])[0]) || 0;
    const tsB = parseInt(((b.id||'').match(/\d{10,}/)||[0])[0]) || 0;
    if(tsA && tsB && tsA !== tsB) return tsB - tsA; // descendente

    // 3. Si comparten folio de recibo, liquidación va arriba del anticipo
    if(a.folio && a.folio === b.folio){
      const esLiqA = ((a.cat||'')+'').toLowerCase().includes('liquid');
      const esLiqB = ((b.cat||'')+'').toLowerCase().includes('liquid');
      if(esLiqA && !esLiqB) return -1;
      if(!esLiqA && esLiqB) return 1;
    }

    // 4. Empate total: orden estable por id (descendente)
    return (b.id||'').localeCompare(a.id||'');
  });
}

// ═══ RENDER CAJA ═══
function renderCaja(){
  const movs=getMovHoy();
  const ing=movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
  const egr=movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
  const saldoTotal=getSaldo();
  const sinSesion = !tokenOk();
  $('cIng').textContent = sinSesion ? '—' : '$'+fmt(ing);
  $('cEgr').textContent = sinSesion ? '—' : '$'+fmt(egr);
  const saldoEl=$('cSaldo');
  if(sinSesion){
    saldoEl.textContent='Conecta sesión';
    saldoEl.style.color='var(--muted,#888)';
    saldoEl.style.fontSize='0.85rem';
  } else if(saldoTotal<0){
    saldoEl.textContent='-$'+fmt(Math.abs(saldoTotal));
    saldoEl.style.color='var(--rojo,#d94040)';
    saldoEl.style.fontSize='';
  } else {
    saldoEl.textContent='$'+fmt(saldoTotal);
    saldoEl.style.color='';
    saldoEl.style.fontSize='';
  }
  $('cIngCnt').textContent=movs.filter(m=>m.tipo==='ingreso').length+' mov.';
  $('cEgrCnt').textContent=movs.filter(m=>m.tipo==='egreso').length+' mov.';
  $('cFecha').textContent=new Date().toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'long'});
  var _cRec=document.getElementById('cRec');if(_cRec)_cRec.textContent=REC.recibos.filter(r=>r.fecha===hoy()).length;
  const saldoFmt=(saldoTotal<0?'-':'')+'$'+fmt(Math.abs(saldoTotal));
  var cm=document.getElementById('cierreMonto');if(cm)cm.textContent=sinSesion?'—':saldoFmt;
  var ts=document.getElementById('topSaldo');if(ts)ts.textContent=sinSesion?'—':saldoFmt;
  safeExec('renderVencimientos', () => renderVencimientos());
  const tb=$('tbMovHoy'),vacio=$('movVacio');
  if(!movs.length){tb.innerHTML='';vacio.style.display='block';$('movCnt').textContent='0 registros';return;}
  vacio.style.display='none';$('movCnt').textContent=movs.length+' registros';
  tb.innerHTML=movs.map(m=>`<tr>
    <td class="mono" style="font-size:0.68rem;color:var(--muted)">${m.hora||'—'}</td>
    <td>${esc(m.descripcion)}</td>
    <td style="white-space:nowrap;">${(()=>{
      const est = m.estatus;
      if(est){ const tc=est==='Liquidado'?'tag-v':est==='Anticipo'?'tag-b':est==='Abono parcial'?'tag-a':'tag-m'; return '<span class="tag '+tc+'" style="font-size:0.6rem;">'+est+'</span>'; }
      return '<span class="tag '+(m.tipo==='ingreso'?'tag-v':'tag-r')+'" style="font-size:0.6rem;">'+(m.cat||m.tipo)+'</span>';
    })()}</td>
    <td style="font-size:0.68rem;color:var(--muted)">${esc(m.responsable||'—')}</td>
    <td class="monto ${m.tipo==='ingreso'?'ing':'egr'}">${m.tipo==='ingreso'?'+':'-'}$${fmt(m.monto)}</td>
  </tr>`).join('');
}
function delMov(id){
  toast('Solo el administrador puede eliminar movimientos. Usa ⚙ Configuración → Administración.','err');
}

// ═══ CONTABILIDAD ═══
// ═══════════════════════════════════════════════════════════════════
// CAPA DE DATOS — CONTABILIDAD
// Fuente única de verdad. Sin parches, sin estado duplicado.
// ═══════════════════════════════════════════════════════════════════

function _movimientosDeCaja() {
  return (D.movimientos || []).filter(m => m && !m.borrado && m.fuente !== 'corte');
}

function _recibosMap() {
  const arr1 = (typeof REC !== 'undefined' ? REC.recibos : []) || [];
  const arr2 = (typeof appData !== 'undefined' ? appData.recibos : []) || [];
  const map = {};
  [...arr1, ...arr2].forEach(r => {
    if (r && r.folio != null && !r.esComplemento) map[r.folio] = r;
  });
  return map;
}

function _foliosExcluidos() {
  const raw = Array.isArray(D.recibosExcluidosCaja) ? D.recibosExcluidosCaja : [];
  // Normalizar a string para comparación consistente (r.folio puede ser number o string)
  return new Set(raw.map(f => String(f)));
}

function _foliosYaEnCaja(movsCaja) {
  const s = new Set();
  movsCaja.forEach(m => {
    if (m.fuente === 'recibo') {
      if (m.folio != null) s.add(Number(m.folio));
      const match = (m.id || '').match(/(?:NEW|COMP|REC|LIQ|RECR)-(\d+)/);
      if (match) s.add(Number(match[1]));
    }
  });
  return s;
}

function _reciboAMovSintetico(r) {
  const anticipo     = parseFloat(r.anticipo || 0);
  const totalAbonado = parseFloat(r.totalAbonado || 0);
  const monto = totalAbonado > 0 ? totalAbonado : anticipo;
  const liq   = r.saldoPendiente === 0;
  const fechaRec = (r.fecha && /^\d{4}-\d{2}-\d{2}/.test(r.fecha))
    ? r.fecha.substring(0, 10) : (r.fecha || '—');
  return {
    id:    'R-' + r.folio, folio: r.folio, nombre: r.nombre || '',
    fecha: fechaRec, hora: r.hora || r.hora_recibo || '00:00',
    descripcion: (function(){
      const conc = r.conceptos && r.conceptos[0] ? r.conceptos[0].concepto || '' : '';
      const desc = r.conceptos && r.conceptos[0] ? r.conceptos[0].descripcion || '' : '';
      return conc + (desc ? ' — ' + desc : '');
    })(),
    monto, total: parseFloat(r.total || 0),
    saldoPendiente: r.saldoPendiente || 0,
    tipo: 'ingreso',
    estatus: liq ? 'Liquidado' : (anticipo > 0 ? 'Anticipo' : 'Pendiente'),
    cat: (liq ? 'Liquidado' : (anticipo > 0 ? 'Anticipo' : 'Pendiente'))
         + ' · #' + String(r.folio).padStart(4, '0'),
    fuente: 'recibo',
    responsable: r.generadoPor || r.responsable || '—'
  };
}

function getAllMovs() {
  const movsCaja  = _movimientosDeCaja();
  const excluidos = _foliosExcluidos();
  const yaEnCaja  = _foliosYaEnCaja(movsCaja);
  const sinteticos = Object.values(_recibosMap())
    .filter(r => !excluidos.has(String(r.folio)) && !yaEnCaja.has(Number(r.folio)))
    .map(_reciboAMovSintetico)
    .filter(m => m.monto > 0 || m.estatus === 'Pendiente');
  return _ordenarMovs([...movsCaja, ...sinteticos]);
}

function getMovHoy() {
  const h = hoy();
  return getAllMovs().filter(m => m.fecha === h);
}

function getSaldo() {
  const ultimoCorte = ((D.cierres || [])
    .filter(c => c.fecha && c.esCorte === true)
    .sort((a, b) => (b.fecha + 'T' + (b.hora || '00:00'))
      .localeCompare(a.fecha + 'T' + (a.hora || '00:00'))))[0] || null;
  const tsCorte = ultimoCorte
    ? ultimoCorte.fecha + 'T' + (ultimoCorte.hora || '00:00') + ':00' : null;
  function despuesDelCorte(m) {
    if (!tsCorte) return true;
    return ((m.fecha || '') + 'T' + (m.hora || '00:00') + ':00') > tsCorte;
  }
  const movsCaja  = _movimientosDeCaja().filter(despuesDelCorte);
  const excluidos = _foliosExcluidos();
  const yaEnCaja  = _foliosYaEnCaja(movsCaja);
  const sinteticos = Object.values(_recibosMap())
    .filter(r => !r.cancelado && !excluidos.has(String(r.folio)) && !yaEnCaja.has(Number(r.folio)))
    .filter(r => despuesDelCorte({ fecha: r.fecha, hora: r.hora || r.hora_recibo || '00:00' }))
    .filter(r => parseFloat(r.totalAbonado || 0) > 0 || parseFloat(r.anticipo || 0) > 0)
    .map(r => {
      const ab = parseFloat(r.totalAbonado || 0), an = parseFloat(r.anticipo || 0);
      return { tipo: 'ingreso', monto: ab > 0 ? ab : an };
    });
  const todos = [...movsCaja, ...sinteticos];
  const ing = todos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const egr = todos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  return ing - egr;
}

// ═══════════════════════════════════════════════════════════════════
// PANEL CONTABILIDAD — RENDER
// ═══════════════════════════════════════════════════════════════════

let _contabDebounce = null;
function contabBuscarDebounce() {
  clearTimeout(_contabDebounce);
  _contabDebounce = setTimeout(renderContab, 160);
}

function contabLimpiarFiltros() {
  const inpB = document.getElementById('cBuscar');
  const selA = document.getElementById('cFiltroAnio');
  const selM = document.getElementById('cFiltroMes');
  if (inpB) inpB.value = '';
  if (selM) selM.value = '';
  if (selA) {
    // Volver al año actual
    const anioActual = new Date().getFullYear().toString();
    for (let i = 0; i < selA.options.length; i++) {
      if (selA.options[i].value === anioActual || selA.options[i].value === '') {
        selA.selectedIndex = i; break;
      }
    }
  }
  filtroC = 'todo';
  document.querySelectorAll('#panel-contabilidad .fbtn').forEach(b => b.classList.remove('active'));
  const btnTodo = document.querySelector('#panel-contabilidad .fbtn[onclick*="todo"]');
  if (btnTodo) btnTodo.classList.add('active');
  renderContab();
}

// Poblar selector de años con los años presentes en los datos
function _poblarSelectorAnios() {
  const sel = document.getElementById('cFiltroAnio');
  if (!sel) return;
  const anios = new Set();
  getAllMovs().forEach(m => { if (m.fecha && m.fecha.length >= 4) anios.add(m.fecha.substring(0, 4)); });
  (D.cierres || []).forEach(c => { if (c.fecha && c.fecha.length >= 4) anios.add(c.fecha.substring(0, 4)); });
  const anioActual = new Date().getFullYear().toString();
  anios.add(anioActual);
  const sorted = [...anios].sort((a, b) => b.localeCompare(a));
  const prev = sel.value;
  sel.innerHTML = '<option value="">Todos los años</option>' +
    sorted.map(a => `<option value="${a}"${a === anioActual ? ' selected' : ''}>${a}</option>`).join('');
  if (prev && sorted.includes(prev)) sel.value = prev;
}

// ═══ FOLIOS DE MOVIMIENTOS DE CAJA: F-MY2026-1 ═══
// Formato: F-{MES2L}{AÑO4}-{CONSECUTIVO}
// Ejemplos:
//   F-EN2026-1   primer movimiento de enero 2026
//   F-EN2026-15  decimoquinto de enero 2026
//   F-MY2025-3   tercer movimiento de mayo 2025
//   F-MY2026-3   tercer movimiento de mayo 2026  ← distinto al de 2025
// Consecutivo sin ceros al frente, crece sin límite, reinicia cada mes-año.
// Los movimientos de recibos no usan folioCaja — su identificador es el número de recibo.

const _MESES_FOLIO = [
  'EN','FB','MR','AB','MY','JN','JL','AG','SP','OC','NV','DC'
];

function _folioMY(fecha) {
  // Devuelve clave "MY2026" (mes en letras + año) para la fecha dada
  try {
    const [y, m] = (fecha || hoy()).split('-').map(Number);
    const cod = _MESES_FOLIO[(m || 1) - 1] || 'XX';
    return cod + y;
  } catch(e) { return 'XX0000'; }
}

function generarFolioMovCaja(fechaMov) {
  // fechaMov: permite asignar el folio al mes correcto en capturas retroactivas
  const clave   = _folioMY(fechaMov || hoy());
  const prefijo = 'F-' + clave + '-';
  const delMesAnio = (D.movimientos || [])
    .filter(m => m.fuente !== 'recibo' && m.fuente !== 'corte' && !m.borrado
                 && m.folioCaja && m.folioCaja.startsWith(prefijo));
  const siguiente = delMesAnio.length + 1;
  D._folioMovCajaCounter = siguiente;
  D._folioMovCajaMax     = siguiente;
  return prefijo + siguiente;   // sin ceros al frente, crece sin límite
}

// Reasigna folios correlativos sin huecos después de borrar movimientos.
// Agrupa por MES-AÑO — cada combinación tiene su propio consecutivo desde 1.
// Úsalo desde admin → Reparar Folios.
function _reordenarFoliosCaja() {
  try {
    // Los movimientos de recibos no deben tener folioCaja
    (D.movimientos || []).filter(m => m.fuente === 'recibo' && !m.borrado)
      .forEach(m => { m.folioCaja = ''; });

    // Solo movimientos de caja activos
    const movsCaja = (D.movimientos || [])
      .filter(m => m.fuente !== 'recibo' && m.fuente !== 'corte' && !m.borrado);

    // Orden cronológico estricto
    movsCaja.sort((a, b) =>
      ((a.fecha || '') + 'T' + (a.hora || '00:00'))
        .localeCompare((b.fecha || '') + 'T' + (b.hora || '00:00'))
    );

    // Consecutivo reiniciado por MES-AÑO, sin ceros al frente
    const contador = {};
    movsCaja.forEach(m => {
      const clave = _folioMY(m.fecha || hoy());
      if (!contador[clave]) contador[clave] = 0;
      contador[clave]++;
      m.folioCaja = 'F-' + clave + '-' + contador[clave];
    });

    D._folioMovCajaCounter = movsCaja.length;
    D._folioMovCajaMax     = movsCaja.length;
  } catch(e) { console.warn('[reordenarFolios]', e); }
}

function setFiltroC(f, el) {
  filtroC = f;
  document.querySelectorAll('#panel-contabilidad .fbtn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderContab();
}

function renderContab() {
  const sinSesion = !tokenOk();

  // ── 1. Stats fijos: siempre día de hoy ────────────────────────
  const movHoy  = getMovHoy();
  const ingHoy  = movHoy.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const egrHoy  = movHoy.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const saldoCaja = getSaldo();

  const elIng  = document.getElementById('rIng');
  const elEgr  = document.getElementById('rEgr');
  const elUtil = document.getElementById('rUtil');
  if (elIng) elIng.textContent = sinSesion ? '—' : '$' + fmt(ingHoy);
  if (elEgr) elEgr.textContent = sinSesion ? '—' : '$' + fmt(egrHoy);
  if (elUtil) {
    if (sinSesion) {
      elUtil.textContent = 'Conecta sesión';
      elUtil.style.color = 'var(--muted)'; elUtil.style.fontSize = '0.85rem';
    } else {
      elUtil.textContent = (saldoCaja < 0 ? '-' : '') + '$' + fmt(Math.abs(saldoCaja));
      elUtil.style.color = saldoCaja < 0 ? 'var(--rojo)' : ''; elUtil.style.fontSize = '';
    }
  }
  const elIngCnt = document.getElementById('rIngCnt');
  const elEgrCnt = document.getElementById('rEgrCnt');
  if (elIngCnt) elIngCnt.textContent = movHoy.filter(m => m.tipo === 'ingreso').length + ' mov.';
  if (elEgrCnt) elEgrCnt.textContent = movHoy.filter(m => m.tipo === 'egreso').length + ' mov.';

  // ── 2. Poblar selector de años ───────────────────────────────
  _poblarSelectorAnios();

  // ── 3. Leer filtros activos ──────────────────────────────────
  const q        = (document.getElementById('cBuscar')?.value || '').toLowerCase().trim();
  const filtroA  = (document.getElementById('cFiltroAnio')?.value || '');
  const filtroM  = (document.getElementById('cFiltroMes')?.value  || '');
  const hayFiltro = q || filtroA || filtroM || filtroC !== 'todo';
  const btnLimpiar = document.getElementById('btnContabLimpiar');
  if (btnLimpiar) btnLimpiar.style.display = hayFiltro ? '' : 'none';

  // ── 4. Aplicar filtros ───────────────────────────────────────
  let movs = getAllMovs();

  if (filtroC === 'ing') movs = movs.filter(m => m.tipo === 'ingreso');
  else if (filtroC === 'egr') movs = movs.filter(m => m.tipo === 'egreso');

  if (filtroA) movs = movs.filter(m => m.fecha && m.fecha.startsWith(filtroA));
  if (filtroM) movs = movs.filter(m => m.fecha && m.fecha.length >= 7 && m.fecha.substring(5, 7) === filtroM);

  if (q) {
    movs = movs.filter(m =>
      (m.descripcion || '').toLowerCase().includes(q) ||
      (m.nombre     || '').toLowerCase().includes(q) ||
      (m.cat        || '').toLowerCase().includes(q) ||
      (m.folioCaja  || '').toLowerCase().includes(q) ||
      (m.folio != null && ('R-' + String(m.folio).padStart(4, '0')).toLowerCase().includes(q)) ||
      (m.folio != null && String(m.folio).padStart(4, '0').includes(q)) ||
      (m.responsable || '').toLowerCase().includes(q)
    );
  }

  // ── 5. Stat "Total del periodo" ──────────────────────────────
  const periodoIng  = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const periodoEgr  = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const periodoNeto = periodoIng - periodoEgr;
  const elPN = document.getElementById('rPeriodoNeto');
  const elPS = document.getElementById('rPeriodoSub');
  if (elPN) {
    elPN.textContent = (periodoNeto < 0 ? '-' : '') + '$' + fmt(Math.abs(periodoNeto));
    elPN.style.color = periodoNeto < 0 ? 'var(--rojo)' : periodoNeto > 0 ? 'var(--azul)' : '';
  }
  if (elPS) elPS.textContent = movs.length + ' mov. · ▲$' + fmt(periodoIng) + ' ▼$' + fmt(periodoEgr);

  // ── 6. Contenedor vacío ──────────────────────────────────────
  const contenedor = document.getElementById('contab-dias');
  const elVacio    = document.getElementById('contVacio');
  const elGT       = document.getElementById('contab-gran-total');
  if (!contenedor) return;

  // Incluir también días de cierre sin movimientos en el rango del filtro
  const cierresSinMov = (D.cierres || []).filter(c => {
    if (!c || !c.sinMovimientos || !c.fecha) return false;
    if (filtroA && !c.fecha.startsWith(filtroA)) return false;
    if (filtroM && c.fecha.substring(5, 7) !== filtroM) return false;
    return true;
  });

  if (!movs.length && !cierresSinMov.length) {
    contenedor.innerHTML = '';
    if (elGT) elGT.style.display = 'none';
    let msg = 'Sin movimientos en el periodo.';
    if (q) msg = `Sin resultados para "${esc(q)}".`;
    else if (filtroA && filtroM) msg = `Sin movimientos en ${filtroM}/${filtroA}.`;
    else if (filtroA) msg = `Sin movimientos en ${filtroA}.`;
    elVacio.textContent = msg;
    elVacio.style.display = 'block';
    return;
  }
  elVacio.style.display = 'none';

  // ── 7. Agrupar: año → mes → día ─────────────────────────────
  // Estructura: grupos[anio][mes][dia] = [movimientos]
  const arbol = {};
  function _ensureDay(f) {
    if (!f || f === '—') return;
    const anio = f.substring(0, 4);
    const mes  = f.substring(5, 7);
    const dia  = f;
    if (!arbol[anio]) arbol[anio] = {};
    if (!arbol[anio][mes]) arbol[anio][mes] = {};
    if (!arbol[anio][mes][dia]) arbol[anio][mes][dia] = [];
  }
  movs.forEach(m => { _ensureDay(m.fecha); if (m.fecha && m.fecha !== '—') arbol[m.fecha.substring(0,4)][m.fecha.substring(5,7)][m.fecha].push(m); });
  cierresSinMov.forEach(c => { _ensureDay(c.fecha); });

  // Detectar días huecos dentro del rango (solo si hay cierres registrados)
  const _diasAutoSinMov = new Set();
  const todasFechas = movs.map(m => m.fecha).filter(f => f && f !== '—');
  if (todasFechas.length) {
    const fechaMin = [...(D.cierres || []).map(c => c.fecha).filter(Boolean), ...todasFechas].sort()[0];
    const ayer = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
    try {
      const cursor = new Date(fechaMin + 'T12:00:00');
      const fin    = new Date(ayer + 'T12:00:00');
      while (cursor <= fin) {
        const f = cursor.toISOString().slice(0, 10);
        const a = f.substring(0, 4), mes = f.substring(5, 7);
        if (filtroA && a !== filtroA) { cursor.setDate(cursor.getDate()+1); continue; }
        if (filtroM && mes !== filtroM) { cursor.setDate(cursor.getDate()+1); continue; }
        if (!arbol[a] || !arbol[a][mes] || !arbol[a][mes][f]) {
          _ensureDay(f);
          _diasAutoSinMov.add(f);
        }
        cursor.setDate(cursor.getDate()+1);
      }
    } catch(e) { /* ignorar */ }
  }

  // ── 8. Helpers de formato ────────────────────────────────────
  const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MESES_CORTO  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  function _fechaBonita(f) {
    try {
      const [y,m,d] = f.split('-').map(Number);
      return DIAS[new Date(y,m-1,d).getDay()].toUpperCase() + ' ' + d + ' DE ' + MESES_NOMBRE[m-1].toUpperCase() + ' ' + y;
    } catch(e) { return f; }
  }

  function _iniciales(nombre) {
    if (!nombre || nombre === '—') return '—';
    return nombre.trim().split(/\s+/).map(p => p[0]||'').join('').toUpperCase().substring(0,3);
  }

  function _badgeEstatus(m) {
    const est = m.estatus || (m.monto === 0 ? 'Pendiente' : null);
    if (!est && !m.cat) return '<span class="tag tag-m" style="font-size:0.54rem;">—</span>';
    const cls = est === 'Liquidado' ? 'tag-v' : est === 'Anticipo' ? 'tag-b' : est === 'Abono parcial' ? 'tag-a' : 'tag-m';
    return `<span class="tag ${cls}" style="font-size:0.54rem;">${esc(est || m.cat || '—')}</span>`;
  }

  function _fila(m, bgBody) {
    let folioTxt, folioColor;
    if (m.fuente === 'recibo') {
      const n = m.folio != null ? m.folio : (m.id||'').replace('R-','');
      const str = folioFormato(n);
      folioTxt  = `<span onclick="abrirPreviaDesdeContab(${n})" style="cursor:pointer;text-decoration:underline;text-underline-offset:3px;color:var(--azul);" title="Ver recibo #${str}">${str}</span>`;
      folioColor = '';
    } else {
      folioTxt  = `<span style="color:var(--gold-d);">${esc(m.folioCaja||'—')}</span>`;
      folioColor = '';
    }
    const desc  = esc(m.fuente==='recibo' ? (m.descripcion||m.nombre||'—') : (m.descripcion||'—'));
    const montoHtml = m.monto > 0
      ? `<b style="color:${m.tipo==='ingreso'?'var(--verde)':'var(--rojo)'};">${m.tipo==='ingreso'?'+':'-'}$${fmt(m.monto)}</b>`
      : `<span style="color:var(--muted);">$0</span>`;
    const resp = _iniciales(m.responsable);
    return `<tr style="background:${m.monto===0?'#fff8e8':bgBody};">
      <td style="font-family:monospace;font-size:0.66rem;color:var(--muted);padding-left:14px;white-space:nowrap;">${esc(m.hora||'—')}</td>
      <td style="font-family:monospace;font-size:0.68rem;font-weight:700;white-space:nowrap;">${folioTxt}</td>
      <td style="font-size:0.8rem;font-weight:600;">${m.fuente==='recibo'?esc(m.nombre||'—'):''}</td>
      <td style="font-size:0.76rem;color:var(--muted);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${desc}">${desc}</td>
      <td style="white-space:nowrap;">${_badgeEstatus(m)}</td>
      <td><span class="tag ${m.fuente==='recibo'?'tag-b':'tag-v'}" style="font-size:0.52rem;">${m.fuente==='recibo'?'Recibo':'Caja'}</span></td>
      <td style="font-family:monospace;font-size:0.62rem;color:var(--muted);text-align:center;" title="${esc(m.responsable||'')}">${resp}</td>
      <td style="text-align:right;padding-right:14px;font-size:0.86rem;">${montoHtml}</td>
    </tr>`;
  }

  // ── 9. Render agrupado por AÑO → MES → DÍA ─────────────────
  const aniosDesc = Object.keys(arbol).sort((a,b) => b.localeCompare(a));
  const anioHoy = new Date().getFullYear().toString();
  const mesHoy  = String(new Date().getMonth()+1).padStart(2,'0');
  const BG_HDR  = ['#e8c875','#d4b870'];
  const BG_BODY = ['#fdfaf4','#f7f3e8'];

  let granIngTotal = 0, granEgrTotal = 0;

  const html = aniosDesc.map(anio => {
    const mesesDesc = Object.keys(arbol[anio]).sort((a,b) => b.localeCompare(a));
    let anioIng = 0, anioEgr = 0;

    const mesesHtml = mesesDesc.map(mes => {
      const diasDesc = Object.keys(arbol[anio][mes]).sort((a,b) => b.localeCompare(a));
      let mesIng = 0, mesEgr = 0;
      let di = 0; // alternating day row colors

      // Calcular acumulado corriente ascendente para este mes
      // Se resetea a 0 cuando hay un corte de caja
      const diasAsc = [...diasDesc].sort();
      let _acumMes = 0;
      const acumPorDia = {};
      diasAsc.forEach(f => {
        const msDia = arbol[anio][mes][f];
        const corteF = (D.cierres||[]).find(c => c.fecha===f && c.esCorte);
        if (corteF) _acumMes = 0; // el corte entrega el efectivo: reinicia
        const ingF = msDia.filter(m => m.tipo==='ingreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
        const egrF = msDia.filter(m => m.tipo==='egreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
        _acumMes += ingF - egrF;
        acumPorDia[f] = _acumMes;
        if (corteF) _acumMes = 0; // después del corte, el siguiente día empieza en 0
      });

      const diasHtml = diasDesc.map(fecha => {
        const ms     = arbol[anio][mes][fecha];
        const bgHdr  = BG_HDR[di % 2];
        const bgBody = BG_BODY[di % 2];
        di++;
        const ingDia = ms.filter(m => m.tipo==='ingreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
        const egrDia = ms.filter(m => m.tipo==='egreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
        const saldoDia = ingDia - egrDia;
        const acumDia  = acumPorDia[fecha] || 0;
        mesIng += ingDia; mesEgr += egrDia;

        const corte      = (D.cierres||[]).find(c => c.fecha===fecha && c.esCorte);
        const cierreNorm = (D.cierres||[]).find(c => c.fecha===fecha && !c.esCorte);
        const cierreSM   = (D.cierres||[]).find(c => c.fecha===fecha && c.sinMovimientos);
        const esDiaSinMov = ms.length === 0;

        let headerExtra = '';
        if (corte) {
          const mn = corte.saldoEntregado || corte.egresos || 0;
          headerExtra = ` &nbsp;<span style="background:linear-gradient(135deg,#0a1a3a,#1a2a5a);color:#e8c875;padding:2px 9px;border-radius:3px;font-size:0.58rem;letter-spacing:0.15em;border:1px solid #c8952a;font-weight:700;">🔒 CORTE${mn>0?' · $'+fmt(mn):''}</span>`;
        } else if (cierreNorm) {
          headerExtra = ' 🔒';
        }

        const encHdr = `<td colspan="8" style="padding:8px 14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px;">
            <span style="font-family:monospace;font-size:0.66rem;font-weight:700;color:#1a1008;letter-spacing:0.1em;">
              📅 ${_fechaBonita(fecha)}${headerExtra}
            </span>
            <span style="font-family:monospace;font-size:0.58rem;color:#1a1008;opacity:0.55;">
              ${esDiaSinMov ? (cierreSM?'sin movimientos 🔒':'sin movimientos') : ms.length+' mov.'}
            </span>
          </div></td>`;

        if (esDiaSinMov) {
          const leyenda = 'SIN MOVIMIENTOS FINANCIEROS';
          return `<table class="tabla" style="margin-bottom:0;border-bottom:1px solid var(--border-l);">
            <thead><tr style="background:${bgHdr};">${encHdr}</tr></thead>
            <tbody><tr style="background:#fff8e8;opacity:0.75;">
              <td colspan="8" style="text-align:center;padding:12px 14px;font-size:0.76rem;color:var(--muted);font-style:italic;">${esc(leyenda)}</td>
            </tr></tbody></table>`;
        }

        const saldoColor = saldoDia<0?'#e85555':saldoDia===0?'#bbb':'#4dca6a';
        const saldoFmt   = (saldoDia<0?'-':'+')+'$'+fmt(Math.abs(saldoDia));
        return `<table class="tabla" style="margin-bottom:0;border-bottom:1px solid var(--border-l);">
          <thead>
            <tr style="background:${bgHdr};">${encHdr}</tr>
            <tr style="background:${bgBody};">
              <th style="font-size:0.5rem;padding-left:14px;">Hora</th>
              <th style="font-size:0.5rem;">Folio</th>
              <th style="font-size:0.5rem;">Nombre</th>
              <th style="font-size:0.5rem;">Descripción</th>
              <th style="font-size:0.5rem;">Estado</th>
              <th style="font-size:0.5rem;">Fuente</th>
              <th style="font-size:0.5rem;text-align:center;">Por</th>
              <th style="font-size:0.5rem;text-align:right;padding-right:14px;">Monto</th>
            </tr>
          </thead>
          <tbody>${ms.map(m => _fila(m, bgBody)).join('')}</tbody>
          <tfoot>
            <tr style="background:#3a4e22;">
              <td colspan="4" style="padding:8px 14px;">
                <span style="font-family:monospace;font-size:0.6rem;color:rgba(255,255,255,0.45);letter-spacing:0.08em;">EN CAJA&nbsp;</span>
                <span style="font-family:monospace;font-size:0.95rem;font-weight:800;color:${acumDia>=0?'#e8c875':'#e85555'};">$${fmt(acumDia)}</span>
                ${(D.cierres||[]).find(c=>c.fecha===fecha&&c.esCorte)?'&nbsp;<span style="font-family:JetBrains Mono,monospace;font-size:0.58rem;color:#e8c875;background:rgba(200,149,42,0.15);padding:2px 6px;border-radius:3px;border:1px solid rgba(200,149,42,0.3);">🔒 CORTE → $0</span>':''}
              </td>
              <td colspan="4" style="padding:8px 14px;text-align:right;">
                <span style="font-family:monospace;font-size:0.62rem;font-weight:700;color:rgba(255,255,255,0.6);letter-spacing:0.08em;">DÍA</span>
                &nbsp;&nbsp;
                <span style="font-family:monospace;font-size:0.76rem;font-weight:700;color:#4dca6a;">▲ $${fmt(ingDia)}</span>
                ${egrDia>0?`&nbsp;&nbsp;<span style="font-family:monospace;font-size:0.76rem;font-weight:700;color:#e85555;">▼ $${fmt(egrDia)}</span>`:''}
                &nbsp;&nbsp;
                <span style="font-family:monospace;font-size:0.76rem;font-weight:700;color:${saldoColor};">= ${saldoFmt}</span>
              </td>
            </tr>
          </tfoot>
        </table>`;
      }).join('');

      anioIng += mesIng; anioEgr += mesEgr;
      const mesNeto    = mesIng - mesEgr;
      const mesNetoFmt = (mesNeto<0?'-':'+')+'$'+fmt(Math.abs(mesNeto));
      const mesNetoClr = mesNeto<0?'var(--rojo)':mesNeto===0?'var(--muted)':'var(--verde-d)';
      // Mes abierto si es el mes actual del año actual (y no hay filtro de mes específico)
      const esActual   = (anio === anioHoy && mes === mesHoy);
      const mesId      = `cmes-${anio}-${mes}`;

      return `<div style="border-bottom:2px solid var(--border);">
        <div onclick="contabToggleMes('${mesId}')" style="display:flex;align-items:center;justify-content:space-between;
          padding:10px 16px;cursor:pointer;background:var(--surface2);
          border-bottom:1px solid var(--border-l);user-select:none;transition:background 0.15s;"
          onmouseover="this.style.background='var(--gold-pale)'" onmouseout="this.style.background='var(--surface2)'">
          <div style="display:flex;align-items:center;gap:10px;">
            <span id="${mesId}-arrow" style="font-family:monospace;font-size:0.7rem;color:var(--gold-d);transition:transform 0.2s;display:inline-block;${esActual?'transform:rotate(90deg)':''}">▶</span>
            <span style="font-family:serif;font-size:0.92rem;color:var(--ink);font-weight:500;">${MESES_NOMBRE[parseInt(mes)-1]} ${anio}</span>
            <span style="font-family:monospace;font-size:0.56rem;color:var(--muted);">${diasDesc.length} días</span>
          </div>

        </div>
        <div id="${mesId}" style="display:${esActual?'block':'none'};">${diasHtml}</div>
      </div>`;
    }).join('');

    granIngTotal += anioIng; granEgrTotal += anioEgr;
    const anioNeto    = anioIng - anioEgr;
    const anioNetoFmt = (anioNeto<0?'-':'+')+'$'+fmt(Math.abs(anioNeto));
    const anioNetoClr = anioNeto<0?'var(--rojo)':anioNeto===0?'var(--muted)':'var(--azul)';
    // Año actual siempre abierto; los anteriores colapsados
    const esAnioActual = (anio === anioHoy);
    const anioId       = `canio-${anio}`;

    // Si solo hay un año o está filtrado por año, no mostrar acordeón de año
    if (aniosDesc.length === 1 || filtroA) return mesesHtml;

    return `<div style="margin-bottom:4px;border:1px solid var(--border-l);border-radius:var(--radius);overflow:hidden;">
      <div onclick="contabToggleAnio('${anioId}')" style="display:flex;align-items:center;justify-content:space-between;
        padding:12px 18px;cursor:pointer;background:${esAnioActual?'var(--gold-bg)':'var(--surface)'};
        user-select:none;transition:background 0.15s;"
        onmouseover="this.style.background='var(--gold-bg)'" onmouseout="this.style.background='${esAnioActual?'var(--gold-bg)':'var(--surface)'}'">
        <div style="display:flex;align-items:center;gap:12px;">
          <span id="${anioId}-arrow" style="font-family:monospace;font-size:0.8rem;color:var(--gold);transition:transform 0.2s;display:inline-block;${esAnioActual?'transform:rotate(90deg)':''}">▶</span>
          <span style="font-family:serif;font-size:1.05rem;color:var(--ink);font-weight:500;">📆 ${anio}</span>
          <span style="font-family:monospace;font-size:0.56rem;color:var(--muted);">${mesesDesc.length} mes${mesesDesc.length!==1?'es':''}</span>
        </div>

      </div>
      <div id="${anioId}" style="display:${esAnioActual?'block':'none'};">${mesesHtml}</div>
    </div>`;
  }).join('');

  contenedor.innerHTML = html;

  // Gran total al pie
  if (elGT) {
    const gNeto = granIngTotal - granEgrTotal;
    const gClr  = gNeto<0?'var(--rojo)':gNeto===0?'var(--muted)':'var(--ink)';
    document.getElementById('gtIng').textContent  = '▲ $' + fmt(granIngTotal);
    document.getElementById('gtEgr').textContent  = '▼ $' + fmt(granEgrTotal);
    const gtN = document.getElementById('gtNeto');
    gtN.textContent  = (gNeto<0?'-':'') + '$' + fmt(Math.abs(gNeto));
    gtN.style.color  = gClr;
    elGT.style.display = movs.length ? 'flex' : 'none';
  }
}

// Toggle acordeón de mes
function contabToggleMes(id) {
  const el    = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
}

// Toggle acordeón de año
function contabToggleAnio(id) {
  const el    = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
}

// ── Export CSV — respeta TODOS los filtros activos ──────────────
function exportCSV() {
  const q       = (document.getElementById('cBuscar')?.value || '').toLowerCase().trim();
  const filtroA = (document.getElementById('cFiltroAnio')?.value || '');
  const filtroM = (document.getElementById('cFiltroMes')?.value  || '');

  let movs = getAllMovs();
  if (filtroC === 'ing') movs = movs.filter(m => m.tipo === 'ingreso');
  else if (filtroC === 'egr') movs = movs.filter(m => m.tipo === 'egreso');
  if (filtroA) movs = movs.filter(m => m.fecha && m.fecha.startsWith(filtroA));
  if (filtroM) movs = movs.filter(m => m.fecha && m.fecha.substring(5,7) === filtroM);
  if (q) movs = movs.filter(m =>
    (m.descripcion||'').toLowerCase().includes(q) ||
    (m.nombre||'').toLowerCase().includes(q) ||
    (m.cat||'').toLowerCase().includes(q) ||
    (m.folioCaja||'').toLowerCase().includes(q) ||
    (m.folio!=null && folioFormato(m.folio, m.anio_folio).includes(q)) ||
    (m.responsable||'').toLowerCase().includes(q)
  );

  const DIAS_S  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const MESES_S = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function _fb(f){
    try{ const [y,m,d]=f.split('-').map(Number); return DIAS_S[new Date(y,m-1,d).getDay()].toUpperCase()+' '+d+' DE '+MESES_S[m-1].toUpperCase()+' '+y; }
    catch(e){return f;}
  }

  // Incluir cierres sin movimientos en el rango
  const cierresSM = (D.cierres||[]).filter(c => {
    if(!c||!c.sinMovimientos||!c.fecha) return false;
    if(filtroA && !c.fecha.startsWith(filtroA)) return false;
    if(filtroM && c.fecha.substring(5,7)!==filtroM) return false;
    return true;
  });

  const grupos = {};
  movs.forEach(m => { const f=m.fecha||'—'; if(!grupos[f]) grupos[f]=[]; grupos[f].push(m); });
  cierresSM.forEach(c => { if(!grupos[c.fecha]) grupos[c.fecha]=[]; });

  const fechasAsc = Object.keys(grupos).filter(f=>f!=='—').sort();
  let acum = 0;
  const dataFecha = {};
  fechasAsc.forEach(f => {
    const ms  = grupos[f];
    const ing = ms.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
    const egr = ms.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
    acum += ing - egr;
    const cierre = (D.cierres||[]).find(c=>c.fecha===f);
    dataFecha[f] = { ing, egr, saldo:ing-egr, acum, cierre };
    if(cierre && cierre.esCorte) acum = 0;
  });

  const lineas = ['\uFEFF' + 'HORA,FOLIO,NOMBRE,DESCRIPCIÓN,CATEGORÍA,FUENTE,RESPONSABLE,MONTO'];
  const periodo = (filtroA||'todos') + (filtroM?'-'+filtroM:'');
  lineas.push(`"=== LEX-MEXICO · Contabilidad · Periodo: ${periodo} ==="`);

  [...fechasAsc].reverse().forEach(f => {
    const { ing, egr, saldo, acum:acumDia, cierre } = dataFecha[f];
    const esSM = cierre && cierre.sinMovimientos;
    lineas.push('');
    lineas.push(`"📅 ${_fb(f)}${cierre&&!esSM?' 🔒':esSM?' 🔒 sin movimientos':''}"`);
    if (esSM) {
      const etiq = cierre.auto?' (auto)':'';
      lineas.push([cierre.hora||'23:59','—','""',`"${(cierre.leyenda||'Sin movimientos').replace(/"/g,"'")}${etiq}"`,'—','Cierre','—','$0.00'].join(','));
      lineas.push(['"EFECTIVO EN CAJA"','','','','','','',`"$${fmt(acumDia)}"`].join(','));
      return;
    }
    grupos[f].forEach(m => {
      const folio   = m.fuente==='recibo' ? folioFormato(m.folio||0) : (m.folioCaja||'—');
      const nombre  = m.fuente==='recibo' ? (m.nombre||'') : '';
      const desc    = m.fuente==='recibo' ? (m.descripcion||m.nombre||'') : (m.descripcion||'');
      const monto   = (m.tipo==='egreso'?'-':'+')+' $'+fmt(m.monto);
      lineas.push([
        m.hora||'—', folio,
        `"${nombre.replace(/"/g,"'")}"`,
        `"${desc.replace(/"/g,"'")}"`,
        m.cat||'—',
        m.fuente==='recibo'?'Recibo':'Caja',
        m.responsable||'—',
        monto
      ].join(','));
    });
    lineas.push(['"RESUMEN DEL DÍA"','','','','',`"▲ $${fmt(ing)}${egr>0?' | ▼ $'+fmt(egr):''}"`,'',`"${saldo>=0?'+':''} $${fmt(saldo)}"`].join(','));
    lineas.push(['"EN CAJA"','','','','','','',`"$${fmt(acumDia)}"`].join(','));
    if(cierre && cierre.esCorte) {
      lineas.push([`"🔒 CORTE ${cierre.hora||''}"`, '','','','','','',`"-$${fmt(acumDia)} → $0.00"`].join(','));
    }
  });

  // Totales finales
  const tIng = movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
  const tEgr = movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+(parseFloat(m.monto)||0),0);
  lineas.push('');
  lineas.push(['"TOTAL DEL PERIODO"','','','','',`"▲ $${fmt(tIng)} | ▼ $${fmt(tEgr)}"`, '',`"${tIng-tEgr>=0?'+':''} $${fmt(tIng-tEgr)}"`].join(','));

  const suffix = (filtroA?'_'+filtroA:'') + (filtroM?'_'+filtroM:'');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lineas.join('\n')],{type:'text/csv;charset=utf-8;'}));
  a.download = 'LEX_Contabilidad' + suffix + '_' + hoy() + '.csv';
  a.click();
  toast('CSV descargado ✓','ok');
}

// ═══ RECIBOS ═══
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
  }).sort((a,b)=>b.folio-a.folio);
  
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
      <td class="mono" style="font-weight:700;color:var(--gold-d)">#${folioFormato(x.folio, x.anio_folio)}</td>
      <td>${esc(x.nombre)}</td><td style="font-size:0.7rem">${x.fecha||'—'}</td>
      <td class="monto">$${fmt(total)}</td>
      <td class="monto ing">$${fmt(ant)}</td>
      <td class="monto ${saldo>0?'egr':''}">${saldo>0?'$'+fmt(saldo):'—'}</td>
      <td>${tag}</td>
    </tr>`;
  }).join('');
}