/* ═══════════════════════════════════════════════════════════════
   LEX-MÉXICO · directorio.js
   Directorio de contactos, panel juicios, carpetas, sincronización Supabase
   Dependencias: utils.js debe cargarse primero
═══════════════════════════════════════════════════════════════ */

// ═══ MEJORA 4: FILTROS Y EXPORTACIÓN DE RECIBOS ═══
function aplicarFiltrosRecibos(lista) {
  const q = (document.getElementById('recFiltroQ')?.value || '').toLowerCase().trim();
  const desde = document.getElementById('recFiltroDesde')?.value || '';
  const hasta = document.getElementById('recFiltroHasta')?.value || '';
  const estado = document.getElementById('recFiltroEstado')?.value || 'todos';
  
  return lista.filter(x => {
    // Filtro por estado
    if (estado === 'liquidado') {
      if (x.cancelado || (x.saldoPendiente || 0) > 0) return false;
    } else if (estado === 'pendiente') {
      if (x.cancelado || !((x.saldoPendiente || 0) > 0)) return false;
    } else if (estado === 'cancelado') {
      if (!x.cancelado) return false;
    }
    
    // Filtro por rango de fechas (formato YYYY-MM-DD)
    if (desde || hasta) {
      const fechaRec = x.fecha || x.fecha_recibo || '';
      // Normalizar fecha del recibo a YYYY-MM-DD
      let fechaNorm = '';
      if (/^\d{4}-\d{2}-\d{2}/.test(fechaRec)) {
        fechaNorm = fechaRec.substring(0, 10);
      } else if (/^\d{2}\/\d{2}\/\d{4}/.test(fechaRec)) {
        const partes = fechaRec.substring(0, 10).split('/');
        fechaNorm = partes[2] + '-' + partes[1] + '-' + partes[0];
      }
      if (fechaNorm) {
        if (desde && fechaNorm < desde) return false;
        if (hasta && fechaNorm > hasta) return false;
      }
    }
    
    // Filtro de búsqueda por texto
    if (q) {
      const folioStr = String(x.folio || '');
      const nombre = (x.nombre || '').toLowerCase();
      const responsable = (x.responsable || '').toLowerCase();
      // Conceptos: buscar en descripciones
      const conceptosTxt = ((x.conceptos || []).map(c => 
        (c.concepto || '') + ' ' + (c.descripcion || '')
      ).join(' ')).toLowerCase();
      const tramites = (x.tramites || '').toLowerCase();
      const placa = (x.placa || '').toLowerCase();
      
      if (!folioStr.includes(q) && 
          !nombre.includes(q) && 
          !responsable.includes(q) &&
          !conceptosTxt.includes(q) &&
          !tramites.includes(q) &&
          !placa.includes(q)) {
        return false;
      }
    }
    
    return true;
  });
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
  }).sort((a,b) => b.folio - a.folio);
  
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

// ═══ DIRECTORIO ═══
function setDirF(f,el){filtroDT=f;document.querySelectorAll('#panel-directorio .fbtn').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderDir();}

// Mejora 2: actualizar el datalist global de clientes para autocompletado
// Se llama cada vez que el directorio cambia (renderDir, sincronización, etc.)
function actualizarDatalistClientes() {
  const dl = document.getElementById('datalist-clientes');
  if (!dl) return;
  const todos = D.directorio || [];
  // Obtener nombres únicos, ordenados alfabéticamente
  const nombresSet = new Set();
  todos.forEach(c => {
    if (c.nombre && c.nombre.trim()) nombresSet.add(c.nombre.trim());
  });
  const nombres = Array.from(nombresSet).sort((a,b) => a.localeCompare(b,'es'));
  // Generar HTML
  dl.innerHTML = nombres.map(n => '<option value="'+esc(n)+'">').join('');
}

function renderDir(){
  const todos = D.directorio || [];
  const setStat = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setStat('dirStTot', todos.length);
  setStat('dirStCli', todos.filter(c=>(c.tipo||'').toLowerCase().includes('cliente')).length);
  setStat('dirStGes', todos.filter(c=>(c.tipo||'').toLowerCase().includes('gestor')).length);
  setStat('dirStLic', todos.filter(c=>(c.tipo||'').toLowerCase().includes('licenciado')).length);
  actualizarDatalistClientes();

  const q=($('dirQ')?.value||'').toLowerCase();
  let l=D.directorio.filter(c=>{
    if(filtroDT!=='todos'&&!c.tipo?.toLowerCase().includes(filtroDT)) return false;
    if(q){
      const tels=[(c.tel||''),(c.tel2||'')].join(' ');
      return (c.nombre||'').toLowerCase().includes(q)
        || tels.includes(q)
        || (c.desc||'').toLowerCase().includes(q)
        || (c.pob||'').toLowerCase().includes(q);
    }
    return true;
  });

  const g=$('dirGrid');
  if(!l.length){
    g.innerHTML='<div style="color:var(--muted);padding:20px;font-size:0.76rem;">Sin resultados.</div>';
    return;
  }

  // Ordenar alfabéticamente
  l = [...l].sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||'','es'));

  // Agrupar por letra inicial
  const grupos = {};
  l.forEach(c => {
    const letra = (c.nombre||'?')[0].toUpperCase();
    if(!grupos[letra]) grupos[letra] = [];
    grupos[letra].push(c);
  });

  const tipoColor = t => {
    const tl = (t||'').toLowerCase();
    if(tl.includes('cliente'))    return '#2a9a4a';
    if(tl.includes('licenciado')) return '#1a4a8a';
    if(tl.includes('gestor'))     return '#c8952a';
    if(tl.includes('secretar'))   return '#7a3a8a';
    return '#7a6840';
  };

  g.innerHTML = Object.keys(grupos).sort().map(letra => {
    const filas = grupos[letra].map(c => {
      const idx = D.directorio.indexOf(c);
      const tels = [c.tel, c.tel2].filter(Boolean).join('  ·  ');
      const relacion = c.desc || c.pob || '';
      const color = tipoColor(c.tipo);
      return `<div style="display:flex;align-items:center;gap:0;padding:7px 12px;border-bottom:1px solid rgba(200,149,42,0.07);transition:background 0.12s;" onmouseover="this.style.background='rgba(200,149,42,0.05)'" onmouseout="this.style.background=''">
        <!-- Nombre -->
        <div style="flex:2;min-width:0;font-family:sans-serif;font-size:0.88rem;font-weight:600;color:var(--gold-l);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.nombre)}</div>
        <!-- Tipo/Relación -->
        <div style="flex:2;min-width:0;font-size:0.72rem;color:#7a6840;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8px;">
          <span style="display:inline-block;background:${color}22;color:${color};border-radius:4px;padding:1px 7px;font-size:0.62rem;font-weight:600;margin-right:5px;">${esc(c.tipo||'—')}</span>${relacion?esc(relacion):''}
        </div>
        <!-- Teléfonos -->
        <div style="flex:2;min-width:0;font-family:monospace;font-size:0.72rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tels?'📞 '+tels:'—'}</div>
        <!-- Botón editar -->
        <button onclick="event.stopPropagation();_abrirFormContacto(${idx})" title="Editar" style="background:none;border:1px solid rgba(200,149,42,0.2);border-radius:6px;padding:3px 8px;cursor:pointer;color:var(--muted);font-size:0.75rem;margin-left:8px;transition:all 0.15s;flex-shrink:0;" onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold-d)'" onmouseout="this.style.borderColor='rgba(200,149,42,0.2)';this.style.color='var(--muted)'">✏️</button>
      </div>`;
    }).join('');

    return `<!-- Bloque ${letra} -->
    <div style="display:flex;align-items:center;gap:8px;padding:10px 12px 4px;background:rgba(200,149,42,0.06);border-top:1.5px solid rgba(200,149,42,0.15);margin-top:4px;">
      <span style="font-family:serif;font-size:1.1rem;font-weight:700;color:var(--gold);min-width:20px;">${letra}</span>
      <span style="font-family:monospace;font-size:0.55rem;color:var(--muted);">${grupos[letra].length} contacto${grupos[letra].length>1?'s':''}</span>
    </div>
    ${filas}`;
  }).join('');
}
function abrirContacto(idx){
  // Nuevo contacto → ir directo al formulario
  if(idx === undefined || idx < 0){
    _abrirFormContacto(-1);
    return;
  }
  // Contacto existente → mostrar perfil con historial
  _abrirPerfilContacto(idx);
}

let _perfilIdxActual = -1;

function _abrirPerfilContacto(idx){
  _perfilIdxActual = idx;
  const c = D.directorio[idx] || {};
  const initials = (c.nombre||'?').split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('');
  $('perfilAvatar').textContent = initials;
  $('perfilNombre').textContent = c.nombre || '—';
  $('perfilMeta').innerHTML = [
    c.tipo ? `<span class="tag ${c.tipo.toLowerCase().includes('cliente')?'tag-v':c.tipo.toLowerCase().includes('licenciado')?'tag-b':'tag-m'}" style="font-size:0.58rem;">${esc(c.tipo)}</span>` : '',
    c.tel  ? `📞 ${esc(c.tel)}` : '',
    c.pob  ? `📍 ${esc(c.pob)}` : '',
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  // Llenar las 3 pestañas
  _perfilRenderRecibos(c);
  _perfilRenderPendientes(c);
  _perfilRenderJuicios(c);

  // Activar pestaña recibos por defecto
  perfilTab('recibos', document.querySelector('#mPerfilContacto .perfil-tab'));
  $('mPerfilContacto').classList.add('show');
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
          <div class="perfil-row-title">#${folioFormato(r.folio, r.anio_folio)} — ${esc(concepto)}</div>
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

function _perfilRenderPendientes(c){
  const nombre = (c.nombre||'').toLowerCase().split(' ')[0];
  const pendientes = (D.pendientes||[])
    .filter(p=> nombre.length>2 && (p.nombre||'').toLowerCase().includes(nombre))
    .sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));

  if(!pendientes.length){
    $('perfilTabPendientes').innerHTML = `<div class="perfil-empty">📭 Sin pendientes registrados</div>`;
    return;
  }
  $('perfilTabPendientes').innerHTML = pendientes.map(p=>{
    const badge = p.completado
      ? `<span class="perfil-row-badge" style="color:#4dca6a;background:rgba(40,180,80,0.1);">✓ Listo</span>`
      : `<span class="perfil-row-badge" style="color:#e8c875;background:rgba(200,149,42,0.12);">Activo</span>`;
    return `<div class="perfil-row" onclick="cerrar('mPerfilContacto');ir('pendientes')">
      <div class="perfil-row-icon">📌</div>
      <div class="perfil-row-main">
        <div class="perfil-row-title">${esc(p.nombre||'—')}</div>
        <div class="perfil-row-sub">${esc(p.desc||'')}${p.resp?' · '+esc(p.resp):''}</div>
      </div>
      ${badge}
    </div>`;
  }).join('');
}

function _perfilRenderJuicios(c){
  const nombre = (c.nombre||'').toLowerCase().split(' ')[0];
  const juicios = (D.juicios||[])
    .filter(j=> nombre.length>2 && (j.nombre||'').toLowerCase().includes(nombre))
    .sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));

  if(!juicios.length){
    $('perfilTabJuicios').innerHTML = `<div class="perfil-empty">📭 Sin juicios registrados</div>`;
    return;
  }
  $('perfilTabJuicios').innerHTML = juicios.map(j=>{
    const badge = j.estatus
      ? `<span class="perfil-row-badge" style="color:#a0c0ff;background:rgba(100,150,255,0.12);">${esc(j.estatus)}</span>`
      : '';
    return `<div class="perfil-row" onclick="cerrar('mPerfilContacto');ir('juicios')">
      <div class="perfil-row-icon">⚖️</div>
      <div class="perfil-row-main">
        <div class="perfil-row-title">${esc(j.nombre||'—')}</div>
        <div class="perfil-row-sub">${j.expediente?'Exp. '+esc(j.expediente)+' · ':''}${esc(j.juzgado||'')}</div>
      </div>
      ${badge}
    </div>`;
  }).join('');
}

function perfilTab(tab, el){
  document.querySelectorAll('#mPerfilContacto .perfil-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#mPerfilContacto .perfil-tab-body').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
  $('perfilTab'+tab.charAt(0).toUpperCase()+tab.slice(1))?.classList.add('active');
}

function perfilEditar(){
  cerrar('mPerfilContacto');
  _abrirFormContacto(_perfilIdxActual);
}

function _abrirFormContacto(idx){
  eiC=idx>=0?idx:-1;const c=idx>=0?D.directorio[idx]:{};
  $('cN').value=c.nombre||'';
  $('cT').value=c.tel||'';
  $('cT2').value=c.tel2||'';
  // Si el tipo no está en las opciones, agregarlo dinámicamente
  const sel=$('cTipo');
  const tipoVal=c.tipo||'Cliente';
  if(tipoVal && ![...sel.options].some(o=>o.value===tipoVal)){
    const opt=document.createElement('option');
    opt.value=tipoVal; opt.textContent=tipoVal; sel.appendChild(opt);
  }
  sel.value=tipoVal;
  $('cP').value=c.pob||'';
  $('cEmail').value=c.email||'';
  $('cRFC').value=c.rfc||'';
  $('cDesc').value=c.desc||'';
  $('cO').value=c.obs||'';
  $('mCTitulo').textContent=idx>=0?'Editar Contacto':'Nuevo Contacto';
  const btnEl=$('btnEliminarContacto');
  if(btnEl) btnEl.style.display=idx>=0?'inline-flex':'none';
  const hist=$('cTelHistorial');
  const histLista=$('cTelHistorialLista');
  const anteriores=(c.telHistorial||[]).filter(h=>h.tel&&h.tel!==c.tel);
  if(anteriores.length&&hist&&histLista){
    hist.style.display='block';
    histLista.innerHTML=anteriores.map(h=>`<span style="display:inline-block;background:#f0ead8;padding:2px 8px;border-radius:10px;margin:2px;font-family:monospace;">📞 ${esc(h.tel)}${h.desde&&h.desde!=='anterior'?' <span style="opacity:0.5;font-size:0.85em;">'+h.desde+'</span>':''}</span>`).join('');
  } else if(hist){ hist.style.display='none'; }
  $('mContacto').classList.add('show');
}

function guardarContacto(){
  try {
  const nombre=$('cN').value.trim();
  if(!nombre){toast('El nombre es obligatorio','err');return;}
  const tel=$('cT').value.trim();
  const tel2=$('cT2').value.trim();
  if(eiC>=0){
    // Editar existente — preservar historial de teléfonos
    const c=D.directorio[eiC];
    const telAnterior=(c.tel||'').trim();
    if(!c.telHistorial) c.telHistorial=telAnterior?[{tel:telAnterior,desde:'anterior'}]:[];
    if(tel&&tel!==telAnterior){
      const yaEsta=c.telHistorial.some(h=>h.tel===tel);
      if(!yaEsta) c.telHistorial.push({tel:tel,desde:hoy()});
    }
    if(tel2&&tel2!==tel){
      const yaEsta2=c.telHistorial.some(h=>h.tel===tel2);
      if(!yaEsta2) c.telHistorial.push({tel:tel2,desde:hoy()});
    }
    c.nombre=nombre; c.tel=tel; c.tel2=tel2;
    c.tipo=$('cTipo').value; c.pob=$('cP').value.trim();
    c.email=$('cEmail').value.trim(); c.rfc=$('cRFC').value.trim().toUpperCase();
    c.desc=$('cDesc').value.trim(); c.obs=$('cO').value.trim();
  } else {
    // Nuevo contacto
    const historial=[];
    if(tel) historial.push({tel,desde:hoy()});
    if(tel2&&tel2!==tel) historial.push({tel:tel2,desde:hoy()});
    D.directorio.unshift({
      nombre, tel, tel2,
      tipo:$('cTipo').value, pob:$('cP').value.trim(),
      email:$('cEmail').value.trim(), rfc:$('cRFC').value.trim().toUpperCase(),
      desc:$('cDesc').value.trim(), obs:$('cO').value.trim(),
      telHistorial:historial
    });
  }
  save();renderDir();cerrar('mContacto');toast('Contacto guardado ✓','ok');syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
  } catch(e){ console.error('[guardarContacto]', e); toast('Error al guardar: '+e.message,'err'); }
}

async function eliminarContacto(){
  if(eiC<0)return;
  const c=D.directorio[eiC];
  const ok = await confirmarBonito({
    titulo: 'Eliminar contacto',
    mensaje: '¿Eliminar a '+c.nombre+' del directorio?\n\nEsta acción no se puede deshacer.',
    btnSi: 'Sí, eliminar',
    btnNo: 'Cancelar',
    peligro: true
  });
  if(!ok) return;
  const rowSheets = c._rowSheets;
  D.directorio.splice(eiC,1);
  save();renderDir();cerrar('mContacto');toast('Contacto eliminado','ok');syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
}

// ═══ CARPETAS ═══
function setCarpF(f,el){filtroCT=f;document.querySelectorAll('#panel-carpetas .fbtn').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderCarp();}
function verDetalleCarpeta(idx){
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
    return `<span style="display:inline-block;padding:3px 12px;border-radius:3px;font-family:monospace;font-size:0.7rem;font-weight:700;background:${bg};color:${col};border:1.5px solid ${border};letter-spacing:0.04em;">${label}</span>`;
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
        <div style="font-family:monospace;font-size:1.5rem;font-weight:700;color:#1a1a1a;border:2px solid #1a1a1a;padding:4px 14px;display:inline-block;letter-spacing:0.05em;">${esc(c.num||'—')}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:0.6rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px;">Estatus</div>
        ${estatusStyle(c.estatus)}
        ${c.estadoArchivo?`<div style="margin-top:6px;">${chip({ACTIVO:'✅ Activo',ARCHIVADO:'📦 Archivado',CANCELADO:'❌ Cancelado'}[c.estadoArchivo]||c.estadoArchivo,'#f0ead8','#7a6840','#c4b078')}</div>`:''}
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
        <div style="font-size:0.85rem;color:#333;font-style:italic;">${esc(subtipoTexto)}</div></div>`:''}
      ${c.descripcion?`<div style="grid-column:1/-1;"><div style="font-size:0.58rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">Descripción / Asunto</div>
        <div style="font-size:0.85rem;color:#333;line-height:1.5;">${esc(c.descripcion)}</div></div>`:''}
      ${c.obs?`<div style="grid-column:1/-1;background:#fffde8;border-left:3px solid #c8952a;padding:8px 12px;border-radius:0 4px 4px 0;"><div style="font-size:0.58rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">Observaciones</div>
        <div style="font-size:0.82rem;color:#5a4a10;line-height:1.5;">${esc(c.obs)}</div></div>`:''}
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

function renderCarp(){
  const q=($('carpQ')?.value||'').toLowerCase();
  const EST_CONCLUIDO=['CONCLUIDO','CONCLUIDO Y ENTREGADA','CONCLUIDO Y ENTREGADO','CONCLUIDO Y ENTRAGADO','CANCELADO','ARCHIVADO'];
  const EST_ACTIVO=['EN TRÁMITE','EN TRAMITE','EN JUCIO','EN JUICIO','EN CATASTRO','PARA FIRMA','PARA TRÁMITE','LISTO PARA ENTREGARSE','INV. Y AVALUO','ACTIVO- EN PROCESO','REVISAR Y SOLUCIONARLO','PEDIR ESCRITURA'];

  // Mejora 5: actualizar contadores arriba (siempre con TODAS las carpetas, sin filtro)
  const todas = D.carpetas || [];
  const ahora = Date.now();
  const TREINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;
  let cntActiva = 0, cntConcluida = 0, cntInactiva = 0;
  todas.forEach(c => {
    const est = (c.estatus||'').toUpperCase().trim();
    const esConcluida = EST_CONCLUIDO.some(x => est.startsWith(x));
    if (esConcluida) {
      cntConcluida++;
    } else {
      cntActiva++;
      // Verificar inactividad: si tiene fecha de última actividad y supera 30 días
      const fechaUlt = c.ultimaActualizacion || c.fechaModificacion || c.fechaCreacion;
      if (fechaUlt) {
        const ts = new Date(fechaUlt).getTime();
        if (!isNaN(ts) && (ahora - ts) > TREINTA_DIAS_MS) cntInactiva++;
      }
    }
  });
  const setStat = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setStat('carpStTot', todas.length);
  setStat('carpStAct', cntActiva);
  setStat('carpStCon', cntConcluida);
  setStat('carpStInact', cntInactiva);

  let l=D.carpetas.filter(c=>{
    const est=(c.estatus||'').toUpperCase().trim();
    if(filtroCT==='activa')return EST_ACTIVO.some(x=>est.startsWith(x))||(!EST_CONCLUIDO.some(x=>est.startsWith(x))&&est!=='');
    if(filtroCT==='entregada')return EST_CONCLUIDO.some(x=>est.startsWith(x));
    return true;
  }).filter(c=>!q||(c.cliente||'').toLowerCase().includes(q)||(c.num||'').toLowerCase().includes(q)||(c.descripcion||'').toLowerCase().includes(q)||(c.estatus||'').toLowerCase().includes(q));
  const el=$('listaCarp');
  if(!l.length){el.innerHTML='<div style="color:var(--muted);padding:24px;font-size:0.76rem;">Sin carpetas en este filtro.</div>';return;}

  function estatusCell(est){
    const e=(est||'').toUpperCase();
    // Paleta login: dorado/ámbar base, verde para concluido, rojo para cancelado
    let bg='rgba(200,149,42,0.12)',col='#8c6518',border='rgba(200,149,42,0.45)';
    if(e.includes('ARCHIVADO')){bg='rgba(200,149,42,0.08)';col='#7a6030';border='rgba(200,149,42,0.3)';}
    else if(e.includes('CONCLUIDO')||e.includes('ENTREGAD')){bg='rgba(26,122,58,0.1)';col='#0f5228';border='rgba(26,122,58,0.35)';}
    else if(e.includes('CANCELADO')){bg='rgba(192,22,26,0.1)';col='#8a1010';border='rgba(192,22,26,0.3)';}
    else if(e.includes('TRÁMITE')||e.includes('TRAMITE')||e.includes('PROCESO')){bg='rgba(26,74,138,0.1)';col='#1a3a7a';border='rgba(26,74,138,0.3)';}
    return `<span style="display:inline-block;padding:3px 11px;border-radius:20px;font-family:monospace;font-size:0.6rem;font-weight:700;background:${bg};color:${col};border:1.5px solid ${border};letter-spacing:0.05em;white-space:nowrap;text-transform:uppercase;">${esc(est||'—')}</span>`;
  }

  const thStyle=`padding:11px 13px;text-align:left;font-family:monospace;font-size:0.58rem;font-weight:700;color:#8c6518;letter-spacing:0.14em;text-transform:uppercase;white-space:nowrap;border-bottom:2px solid #d4b870;background:linear-gradient(135deg,#fdf8ee,#f5edcc);`;

  el.innerHTML=`
    <style>
      .carp-tr { transition: background 0.15s, box-shadow 0.15s; }
      .carp-tr:hover { background: linear-gradient(90deg,rgba(212,184,112,0.22) 0%,rgba(253,248,238,0.95) 100%) !important; box-shadow: inset 4px 0 0 #c8952a; }
      .carp-tr:hover .carp-num-badge { border-color: #c8952a; color: #6a4a10; background: #fef3d0; }
      .carp-action-btn { background:none;border:1.5px solid rgba(200,149,42,0.3);color:#b07820;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:0.8rem;display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s;margin:0 1px; }
      .carp-action-btn:hover { background:rgba(200,149,42,0.15);border-color:#c8952a;transform:translateY(-1px);box-shadow:0 2px 8px rgba(200,149,42,0.2); }
    </style>
    <div style="overflow-x:auto;border:2px solid #d4b870;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(200,149,42,0.12);">
    <table style="width:100%;border-collapse:collapse;font-family:sans-serif;">
      <thead>
        <tr>
          <th style="${thStyle}white-space:nowrap;padding-left:16px;">EXP.</th>
          <th style="${thStyle}">NOMBRE</th>
          <th style="${thStyle}white-space:nowrap;">TIPO DE TRÁMITE</th>
          <th style="${thStyle}">DESCRIPCIÓN</th>
          <th style="${thStyle}text-align:center;">ESTATUS</th>
          <th style="${thStyle}text-align:center;padding-right:14px;"></th>
        </tr>
      </thead>
      <tbody>
        ${l.map((c,rowI)=>{
          const idx=D.carpetas.indexOf(c);
          const tipoLabel={juicio:'JUICIO',escritura:'ESCRITURA',registro_civil:'REG. CIVIL',documentos:'DOCUMENTOS'}[c.tipoTramite]||(c.tipoTramite?c.tipoTramite.toUpperCase():'—');
          let subTipo='';
          if(c.tipoTramite==='juicio'&&c.juicioDesc) subTipo=c.juicioDesc;
          else if(c.tipoTramite==='escritura'&&c.escTipo) subTipo=c.escTipo;
          else if(c.tipoTramite==='registro_civil'&&c.regCivilTipo) subTipo={registro_extemporaneo:'Reg. Extemporáneo',rectificacion_nombre:'Rectif. Nombre',aclaracion_nombre:'Aclar. Nombre'}[c.regCivilTipo]||c.regCivilTipo;
          else if(c.tipoTramite==='documentos'&&c.docDesc) subTipo=c.docDesc;
          const tipoTexto=subTipo?tipoLabel+' — '+subTipo:tipoLabel;
          const descTexto=c.descripcion||'—';
          const rowBg=rowI%2===0?'#fdfaf4':'#faf5e8';
          const tdStyle=`padding:10px 13px;font-size:0.76rem;color:#2a1a06;border-bottom:1px solid rgba(212,184,112,0.25);vertical-align:middle;`;
          return `<tr class="carp-tr" onclick="verDetalleCarpeta(${idx})" style="background:${rowBg};cursor:pointer;">
            <td style="${tdStyle}padding-left:16px;">
              <span class="carp-num-badge" style="border:1.5px solid #d4b870;padding:3px 10px;font-family:monospace;font-size:0.68rem;font-weight:700;color:#8c6518;white-space:nowrap;border-radius:6px;background:#fdfaf4;transition:all 0.15s;display:inline-block;">${esc(c.num||'—')}</span>
            </td>
            <td style="${tdStyle}font-weight:600;white-space:nowrap;color:#1a0f02;">${esc(c.cliente||'—')}</td>
            <td style="${tdStyle}font-family:monospace;font-size:0.67rem;color:#6a4a10;white-space:nowrap;">${esc(tipoTexto)}</td>
            <td style="${tdStyle}color:#5a4a30;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(descTexto)}</td>
            <td style="${tdStyle}text-align:center;">${estatusCell(c.estatus)}</td>
            <td style="${tdStyle}text-align:center;white-space:nowrap;padding-right:14px;" onclick="event.stopPropagation()">
              <button onclick="verDetalleCarpeta(${idx})" title="Ver detalle" class="carp-action-btn">👁</button>
              <button onclick="abrirCarpeta(${idx})" title="Editar" class="carp-action-btn">✏️</button>
              <button onclick="abrirMenuCarpeta(event,${idx})" title="Más opciones" class="carp-action-btn">☰</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>`;
}
function abrirMenuCarpeta(event,idx){
  event.stopPropagation();
  // Eliminar menú previo
  const prev=document.getElementById('_carpMenu');
  if(prev){prev.remove();if(prev._idx===idx)return;}
  const c=D.carpetas[idx];if(!c)return;
  const menu=document.createElement('div');
  menu._idx=idx;
  menu.id='_carpMenu';
  menu.style.cssText='position:fixed;z-index:9999;background:#fdfaf4;border:1.5px solid #d4b870;border-radius:10px;box-shadow:0 8px 32px rgba(140,101,24,0.18);min-width:180px;overflow:hidden;font-family:\'Outfit\',sans-serif;';
  const items=[
    {ico:'👁',lbl:'Ver detalle',fn:`verDetalleCarpeta(${idx})`},
    {ico:'✏️',lbl:'Editar carpeta',fn:`abrirCarpeta(${idx})`},
    {ico:'🖨️',lbl:'Imprimir expediente',fn:`imprimirCarpeta(${idx})`},
    {sep:true},
    {ico:'🗑️',lbl:'Eliminar',fn:`abrirCarpeta(${idx});setTimeout(()=>document.getElementById('kBtnElim')&&document.getElementById('kBtnElim').click(),200)`,danger:true},
  ];
  menu.innerHTML=items.map(it=>it.sep?`<div style="height:1px;background:#ecdfa8;margin:2px 0;"></div>`:
    `<button onclick="${it.fn};document.getElementById('_carpMenu')&&document.getElementById('_carpMenu').remove();" style="width:100%;background:none;border:none;padding:9px 14px;text-align:left;cursor:pointer;font-family:sans-serif;font-size:0.8rem;color:${it.danger?'#c0161a':'#1a1008'};display:flex;align-items:center;gap:9px;transition:background 0.12s;" onmouseover="this.style.background='rgba(200,149,42,0.1)'" onmouseout="this.style.background='none'">
      <span style="font-size:0.85rem;">${it.ico}</span>${it.lbl}</button>`).join('');
  document.body.appendChild(menu);
  // Posicionar
  const rect=event.target.getBoundingClientRect();
  let left=rect.right-menu.offsetWidth;
  let top=rect.bottom+4;
  if(left<8)left=8;
  if(top+200>window.innerHeight)top=rect.top-200;
  menu.style.left=left+'px';menu.style.top=top+'px';
  setTimeout(()=>document.addEventListener('click',function h(){menu.remove();document.removeEventListener('click',h);},{once:true}),10);
}
function kActualizarSubtipo(){
  const t=$('kTipoTramite').value;
  ['juicio','escritura','registro_civil','documentos'].forEach(x=>{
    const el=document.getElementById('kSub-'+x);
    if(el) el.style.display=(x===t)?'block':'none';
  });
}
function abrirCarpeta(idx){
  eiK=idx>=0?idx:-1;const c=idx>=0?D.carpetas[idx]:{};
  // Mejora: si es carpeta nueva, sugerir el siguiente número
  if (idx < 0 || idx === undefined) {
    const sugerencia = sugerirNumeroCarpeta();
    $('kNum').value = sugerencia ? String(sugerencia) : '';
  } else {
    // Al editar, mostrar solo el número sin ARCH-
    const numLimpio = (c.num||'').replace('ARCH-','').replace(/^0+/,'') || '';
    $('kNum').value = numLimpio;
  }
  $('kCliente').value=c.cliente||'';
  $('kEstatus').value=c.estatus||'';
  $('kDescripcion').value=c.descripcion||'';
  // Para nueva carpeta, prellenar con fecha actual formateada (DD/MM/AAAA)
  if(idx<0 || idx===undefined){
    const hoy=new Date();
    const dd=String(hoy.getDate()).padStart(2,'0');
    const mm=String(hoy.getMonth()+1).padStart(2,'0');
    const aaaa=hoy.getFullYear();
    $('kIngreso').value=dd+'/'+mm+'/'+aaaa;
  } else {
    // Si la fecha almacenada tiene formato ISO, convertirla a DD/MM/AAAA
    let ingVal=c.ingreso||'';
    if(ingVal && /^\d{4}-\d{2}-\d{2}/.test(ingVal)){
      const parts=ingVal.substring(0,10).split('-');
      ingVal=parts[2]+'/'+parts[1]+'/'+parts[0];
    }
    $('kIngreso').value=ingVal;
  }
  $('kCelebEscritura').value=c.celebEscritura||'';
  $('kObs').value=c.obs||'';
  $('kReciboOficial').value=c.reciboOficial||'';
  $('kEstadoArchivo').value=c.estadoArchivo||'';
  $('kPrioridad').value=c.prioridad||'';
  $('kTotalPactado').value=c.totalPactado||'';
  // Tipo de trámite
  $('kTipoTramite').value=c.tipoTramite||'';
  kActualizarSubtipo();
  // Subtipos
  $('kJuicioDesc').value=c.juicioDesc||'';
  $('kEscNotario').value=c.escNotario||'';
  $('kEscVolumen').value=c.escVolumen||'';
  $('kEscInstrumento').value=c.escInstrumento||'';
  $('kEscTipo').value=c.escTipo||'';
  $('kRegCivilTipo').value=c.regCivilTipo||'';
  $('kDocDesc').value=c.docDesc||'';
  actualizarColorEstado();
  actualizarColorPrioridad();
  $('mKTitulo').textContent=idx>=0?'Editar Carpeta':'Nueva Carpeta';
  $('kNum').readOnly=(idx>=0);
  $('kNum').style.opacity=(idx>=0)?'0.6':'1';
  $('kNumInfo').style.display=(idx>=0)?'block':'none';
  $('kBtnElim').style.display=(idx>=0)?'flex':'none';
  $('mCarpeta').classList.add('show');
}
function guardarCarpeta(){
  const numRaw=$('kNum').value.trim();
  const cliente=$('kCliente').value.trim();

  if(!numRaw){
    toast('El número de carpeta es obligatorio','err');
    const el=$('kNum'); if(el){el.style.borderColor='var(--rojo)';el.scrollIntoView({behavior:'smooth',block:'center'});el.focus();}
    return;
  }
  if(!cliente){
    toast('El cliente es obligatorio','err');
    const el=$('kCliente'); if(el){el.style.borderColor='var(--rojo)';el.scrollIntoView({behavior:'smooth',block:'center'});el.focus();}
    return;
  }

  // Formato ARCH-00001
  const numFormateado = 'ARCH-' + String(parseInt(numRaw)||1).padStart(5,'0');

  if(eiK<0){
    const existe=D.carpetas.find(x=>x.num===numFormateado);
    if(existe){toast('⚠ Ya existe la carpeta '+numFormateado,'err');return;}
  }
  const tipoTramite=$('kTipoTramite').value;
  const c={
    num: eiK>=0?D.carpetas[eiK].num:numFormateado,
    cliente, descripcion:$('kDescripcion').value.trim(),
    estatus:$('kEstatus').value.trim(), ingreso:$('kIngreso').value.trim(),
    celebEscritura:($('kCelebEscritura')||{value:''}).value.trim(), obs:$('kObs').value.trim(),
    reciboOficial:($('kReciboOficial')||{value:''}).value.trim(), estadoArchivo:$('kEstadoArchivo').value,
    prioridad:$('kPrioridad').value,
    totalPactado: parseFloat($('kTotalPactado').value)||0,
    tipoTramite,
    fechaModificacion: new Date().toISOString(),
    juicioDesc: tipoTramite==='juicio'?$('kJuicioDesc').value.trim():'',
    escNotario: tipoTramite==='escritura'?$('kEscNotario').value.trim():'',
    escVolumen: tipoTramite==='escritura'?$('kEscVolumen').value.trim():'',
    escInstrumento: tipoTramite==='escritura'?$('kEscInstrumento').value.trim():'',
    escTipo: tipoTramite==='escritura'?$('kEscTipo').value.trim():'',
    regCivilTipo: tipoTramite==='registro_civil'?$('kRegCivilTipo').value:'',
    docDesc: tipoTramite==='documentos'?$('kDocDesc').value.trim():''
  };

  try {
    if(eiK>=0) D.carpetas[eiK]=c; else D.carpetas.unshift(c);
  } catch(e) {
    console.error('[guardarCarpeta] Error al modificar D.carpetas:', e);
    toast('Error al guardar carpeta: '+e.message,'err');
    return;
  }

  // 1. Cerrar modal inmediatamente — respuesta visual instantánea
  try { cerrar('mCarpeta'); } catch(e){ console.warn('[guardarCarpeta] cerrar:', e); }

  // 2. Re-renderizar la lista al instante
  try { renderCarp(); } catch(e){ console.warn('[guardarCarpeta] renderCarp:', e); }

  // 3. Actualizar badges si existen
  try { if(typeof badges==='function') badges(); } catch(e){ registrarError('catch vacio', e); }

  // 4. Toast de confirmación
  try { toast('Carpeta '+c.num+' guardada ✓'); } catch(e){ registrarError('catch vacio', e); }

  // 5. Persistir en Supabase de forma asíncrona (no bloquea la UI)
  try {
    save();
  } catch(e){ console.warn('[guardarCarpeta] save:', e); }
  try {
    saveCarpetas();
  } catch(e){ console.warn('[guardarCarpeta] saveCarpetas:', e); }
}
async function eliminarCarpeta(){
  if(eiK<0)return;
  const c=D.carpetas[eiK];
  const ok = await confirmarBonito({
    titulo: 'Eliminar carpeta',
    mensaje: '¿Eliminar carpeta '+c.num+' — '+c.cliente+'?\n\nEsta acción no se puede deshacer.',
    btnSi: 'Sí, eliminar',
    btnNo: 'Cancelar',
    peligro: true
  });
  if(!ok) return;
  D.carpetas.splice(eiK,1);
  save();saveCarpetas();renderCarp();cerrar('mCarpeta');toast('Carpeta eliminada — sincronizando...');
}

// ─── Colores de Estado y Prioridad ──────────────────────────────────────────
function actualizarColorEstado(){
  const v=($('kEstadoArchivo')||{}).value||'';
  const bar=$('kEstadoColor'); if(!bar)return;
  const col={ACTIVO:'#1a7a3a',ARCHIVADO:'#7a6840',CANCELADO:'#c0161a'}[v]||'#e0ddd5';
  bar.style.background=col;
  const sel=$('kEstadoArchivo'); if(sel){sel.style.borderColor=col==='#e0ddd5'?'var(--border-l)':col;}
}
function actualizarColorPrioridad(){
  const v=($('kPrioridad')||{}).value||'';
  const bar=$('kPrioridadColor'); if(!bar)return;
  const col={URGENTE:'#c0161a',BUEN_TIEMPO:'#1a7a3a',REZAGADO:'#c8952a'}[v]||'#e0ddd5';
  bar.style.background=col;
  const sel=$('kPrioridad'); if(sel){sel.style.borderColor=col==='#e0ddd5'?'var(--border-l)':col;}
}

// ═══ JUICIOS ═══
function setJF(f,el){filtroJ=f;document.querySelectorAll('#panel-juicios .fbtn').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderJuicios();}

// ══════════════════════════════════════════════════════════════════
// RESUMEN FINANCIERO — helper reutilizable para Juicios y Pendientes
// ══════════════════════════════════════════════════════════════════
function _finResumen(nombreCliente, folioRecibo){
  const allRecibos = ((typeof appData!=='undefined' ? appData.recibos : null) || REC.recibos || []);

  // ── ARREGLO: solo vincular por folio explícito ──
  // El matching por nombre era peligroso: encontraba recibos de OTRAS personas
  // que casualmente comparten el primer nombre. Ahora solo se muestra el recibo
  // si el juicio tiene folioRecibo asignado expresamente por el usuario.
  // Las cantidades se actualizan automáticamente al leer desde appData.recibos
  // (que es la fuente viva, sincronizada con Drive).
  if (!folioRecibo) return '';
  
  const folioNum = parseInt(folioRecibo);
  if (isNaN(folioNum)) return '';
  
  const rec = allRecibos.find(r => r.folio === folioNum);
  if (!rec) {
    // Recibo vinculado pero ya no existe en el sistema (posiblemente eliminado)
    return `<div style="margin-top:7px;padding:5px 8px;background:rgba(192,22,26,0.06);border:1px solid rgba(192,22,26,0.18);border-radius:5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="font-family:monospace;font-size:0.58rem;color:#c0161a;">⚠ Recibo #${folioFormato(folioNum)} no encontrado</span>
    </div>`;
  }
  
  const recVinc = [rec];
  const totalCobrado  = recVinc.reduce((s,r)=>s+(parseFloat(r.anticipo)||0),0);
  const totalPendiente= recVinc.reduce((s,r)=>s+(parseFloat(r.saldoPendiente)||0),0);
  const liquidados    = recVinc.filter(r=>!(parseFloat(r.saldoPendiente)||0)).length;

  const estadoTxt   = totalPendiente > 0
    ? `<span style="color:#c0161a;font-weight:700;">$${fmt(totalPendiente)} pendiente</span>`
    : `<span style="color:var(--verde-d);font-weight:700;">✅ Liquidado</span>`;

  return `<div style="margin-top:7px;padding:5px 8px;background:rgba(26,122,58,0.04);border:1px solid rgba(26,122,58,0.12);border-radius:5px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
    <span style="font-family:monospace;font-size:0.58rem;color:var(--verde-d);">💰 $${fmt(totalCobrado)} cobrado</span>
    ${estadoTxt}
    <span style="font-family:monospace;font-size:0.58rem;color:var(--muted);">📄 1 recibo${liquidados===1?' · liquidado':''}</span>
    <span onclick="event.stopPropagation();abrirPreviaDesdeContab(${rec.folio})" style="font-family:monospace;font-size:0.56rem;color:var(--azul);cursor:pointer;text-decoration:underline;text-underline-offset:2px;">Ver recibo #${folioFormato(rec.folio, rec.anio_folio)}</span>
  </div>`;
}

function _verRecibosCliente(nombre){
  // Navegar a Contabilidad con el nombre pre-filtrado
  ir('contabilidad');
  setTimeout(()=>{
    const el = document.getElementById('cBuscar');
    if(el){ el.value = nombre; renderContab(); }
  }, 150);
}

// ═══ GESTIÓN DE RECIBO VINCULADO A UN JUICIO ═══
// Permite vincular, cambiar o desvincular el recibo de un juicio.
// Resuelve los 2 problemas reales:
//   1. Vincular el recibo correcto cuando hay coincidencias de nombre falsas
//   2. Las cantidades se leen dinámicamente desde appData.recibos, así que
//      cualquier actualización del recibo se refleja al instante en el juicio
let _juicioVincRecIdx = -1;
let _juicioVincBusqueda = '';

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
        <h3 style="font-size:0.95rem;">🔗 Vincular Recibo al Juicio</h3>
        <button class="modal-x" onclick="cerrar('modal-juicio-recibo')">✕</button>
      </div>
      <div class="modal-body" style="padding:18px;">
        <div id="jvr-juicio-info" style="background:var(--surface2);padding:10px 14px;border-radius:6px;margin-bottom:14px;border-left:3px solid var(--gold);font-size:0.78rem;"></div>
        
        <div id="jvr-actual-wrap" style="display:none;margin-bottom:14px;padding:10px 14px;background:rgba(26,122,58,0.06);border:1px solid rgba(26,122,58,0.2);border-radius:6px;">
          <div style="font-family:monospace;font-size:0.6rem;color:var(--verde-d);letter-spacing:0.1em;margin-bottom:6px;">RECIBO ACTUALMENTE VINCULADO</div>
          <div id="jvr-actual-info" style="font-size:0.82rem;color:var(--ink);"></div>
          <button onclick="desvincularReciboDeJuicio()" style="margin-top:8px;background:rgba(192,22,26,0.1);border:1px solid rgba(192,22,26,0.3);color:#c0161a;border-radius:4px;padding:5px 12px;font-size:0.7rem;font-family:monospace;cursor:pointer;font-weight:700;">✕ Desvincular este recibo</button>
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
  
  // Mostrar recibo actual si está vinculado
  const actualWrap = document.getElementById('jvr-actual-wrap');
  const actualInfo = document.getElementById('jvr-actual-info');
  if (j.folioRecibo && actualWrap && actualInfo) {
    const recibos = (typeof appData !== 'undefined' ? appData.recibos : null) || [];
    const recActual = recibos.find(r => r.folio === parseInt(j.folioRecibo));
    if (recActual) {
      const total = parseFloat(recActual.total) || 0;
      const ant = parseFloat(recActual.anticipo) || 0;
      const saldo = recActual.saldoPendiente !== undefined ? parseFloat(recActual.saldoPendiente) : Math.max(0, total - ant);
      const estadoTxt = recActual.cancelado ? '❌ Cancelado' : (saldo > 0 ? '⚠ Pendiente $' + fmt(saldo) : '✅ Liquidado');
      actualInfo.innerHTML = '<strong>Folio #' + folioFormato(recActual.folio) + '</strong> — ' + esc(recActual.nombre || '—') + 
        '<br><span style="font-size:0.72rem;color:var(--muted);">$' + fmt(total) + ' total · $' + fmt(ant) + ' cobrado · ' + estadoTxt + '</span>';
      actualWrap.style.display = '';
    } else {
      actualInfo.innerHTML = '<span style="color:#c0161a;">⚠ Folio #' + folioFormato(j.folioRecibo) + ' no se encontró en el sistema</span>';
      actualWrap.style.display = '';
    }
  } else if (actualWrap) {
    actualWrap.style.display = 'none';
  }
  
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
    filtrados = recibos.slice().sort((a,b) => (b.folio||0) - (a.folio||0)).slice(0, 30);
  } else {
    filtrados = recibos.filter(r => {
      const folioStr = String(r.folio || '');
      const nombre = (r.nombre || '').toLowerCase();
      // Buscar por folio EXACTO o por nombre que contiene la búsqueda
      return folioStr === q || folioStr === folioFormato(parseInt(q)||0) || 
             nombre.includes(q);
    }).sort((a,b) => (b.folio||0) - (a.folio||0)).slice(0, 50);
  }
  
  if (!filtrados.length) {
    lista.innerHTML = '<div style="padding:18px;text-align:center;color:var(--muted);font-size:0.78rem;">No se encontraron recibos con esa búsqueda.</div>';
    return;
  }
  
  // Folio actualmente vinculado para marcar como tal
  const j = D.juicios[_juicioVincRecIdx];
  const folioActual = j ? parseInt(j.folioRecibo) : null;
  
  lista.innerHTML = filtrados.map(r => {
    const total = parseFloat(r.total) || 0;
    const ant = parseFloat(r.anticipo) || 0;
    const saldo = r.saldoPendiente !== undefined ? parseFloat(r.saldoPendiente) : Math.max(0, total - ant);
    const folioStr = folioFormato(r.folio, r.anio_folio);
    const esActual = r.folio === folioActual;
    
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
  const folioPrev = j.folioRecibo;
  
  if (folioPrev && parseInt(folioPrev) === folio) {
    // Ya está vinculado a ese mismo recibo
    cerrar('modal-juicio-recibo');
    return;
  }
  
  // Si ya tenía otro vinculado, confirmar el cambio
  if (folioPrev) {
    const ok = await confirmarBonito({
      titulo: 'Cambiar recibo vinculado',
      mensaje: 'Este juicio está vinculado al recibo #' + folioFormato(folioPrev) + '.\n\n¿Cambiar al recibo #' + folioFormato(folio) + '?',
      btnSi: 'Sí, cambiar',
      btnNo: 'Cancelar'
    });
    if (!ok) return;
  }
  
  j.folioRecibo = folio;
  saveJuicios();
  cerrar('modal-juicio-recibo');
  renderJuicios();
  toast('✓ Recibo #' + folioFormato(folio) + ' vinculado al juicio', 'ok');
}

async function desvincularReciboDeJuicio() {
  if (_juicioVincRecIdx < 0 || !D.juicios[_juicioVincRecIdx]) return;
  const j = D.juicios[_juicioVincRecIdx];
  if (!j.folioRecibo) return;
  
  const ok = await confirmarBonito({
    titulo: 'Desvincular recibo',
    mensaje: '¿Quitar la vinculación con el recibo #' + folioFormato(j.folioRecibo) + '?\n\nEl recibo NO se elimina, solo se desconecta del juicio.',
    btnSi: 'Sí, desvincular',
    btnNo: 'Cancelar'
  });
  if (!ok) return;
  
  delete j.folioRecibo;
  saveJuicios();
  cerrar('modal-juicio-recibo');
  renderJuicios();
  toast('✓ Recibo desvinculado del juicio', 'ok');
}

function renderJuicios(){
  const q=($('juicioQ')?.value||'').toLowerCase();
  let l=D.juicios.filter(j=>{
    if(filtroJ!=='todos'&&j.estatus!==filtroJ)return false;
    if(q)return(j.cliente||'').toLowerCase().includes(q)||(j.expediente||'').toLowerCase().includes(q)||(j.tipo||'').toLowerCase().includes(q);
    return true;
  });
  const el=$('listaJuicios');
  if(!l.length){el.innerHTML='<div style="color:var(--muted);padding:24px;font-size:0.76rem;">Sin expedientes en este filtro.</div>';return;}
  const hoyD=new Date();
  el.innerHTML=l.map(j=>{
    const idx=D.juicios.indexOf(j);
    const tagC={'urgente':'tag-r','proceso':'tag-a','estable':'tag-v','concluido':'tag-m','inicio':'tag-b'}[j.estatus]||'tag-m';
    const tagL={'urgente':'🔴 Urgente','proceso':'🟡 En Proceso','estable':'🟢 Estable','concluido':'⚫ Concluido','inicio':'🔵 Inicio'}[j.estatus]||j.estatus;
    let alerta='';
    // Check próxima audiencia
    const audFecha=j.audiencia||proximaAudienciaDeTerminos(j);
    if(audFecha){
      const diff=Math.ceil((new Date(audFecha+'T12:00:00')-hoyD)/86400000);
      if(diff>=0&&diff<=30)alerta=`<div class="audiencia-alerta">⚠ Audiencia/Término en ${diff} día${diff===1?'':'s'} — ${audFecha}</div>`;
      else if(diff<0)alerta=`<div class="audiencia-alerta">🚨 Término vencido: ${audFecha}</div>`;
    }
    const folioTag=j.folioRecibo?`<span style="font-family:monospace;font-size:0.58rem;color:var(--gold-d);background:var(--gold-bg);border:1px solid var(--border-l);border-radius:10px;padding:1px 8px;">🧾 #${folioFormato(j.folioRecibo)}</span>`:'';
    const driveTag=j.driveFolderId?`<span style="font-size:0.58rem;color:var(--azul);background:var(--azul-l);border:1px solid rgba(26,74,138,0.15);border-radius:10px;padding:1px 8px;font-family:monospace;">📁 Drive</span>`:'';
    const acuerdosCount=(j.acuerdos||[]).length;
    const acuerdosTag=acuerdosCount?`<span style="font-size:0.58rem;color:var(--muted);background:var(--surface2);border:1px solid var(--border-l);border-radius:10px;padding:1px 8px;font-family:monospace;">📄 ${acuerdosCount} acuerdo${acuerdosCount===1?'':'s'}</span>`:'';
    const terminosVivos=(j.terminos||[]).filter(t=>!t.cumplido);
    const terminosTag=terminosVivos.length?`<span style="font-size:0.58rem;color:var(--amarillo);background:var(--amarillo-l);border:1px solid rgba(154,96,16,0.15);border-radius:10px;padding:1px 8px;font-family:monospace;">⏱ ${terminosVivos.length} término${terminosVivos.length===1?'':'s'}</span>`:'';
    return `<div class="juicio ${j.estatus}" onclick="abrirDetalle(${idx})">
      <div class="juicio-top">
        <div><div class="juicio-nombre">${esc(j.cliente)}</div><div class="juicio-tipo">${esc(j.tipo)}</div></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span class="tag ${tagC}">${tagL}</span>
          <span class="mono" style="font-size:0.62rem;color:var(--muted)">${esc(j.expediente)}</span>
        </div>
      </div>
      <div class="juicio-info">
        <div class="jdato"><strong>Juzgado:</strong> ${esc(j.juzgado)}</div>
        <div class="jdato"><strong>Ingreso:</strong> ${j.fechaIngreso||'—'}</div>
        ${j.tel?`<div class="jdato"><strong>Tel:</strong> ${esc(j.tel)}</div>`:''}
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px;align-items:center;">
        ${folioTag}${driveTag}${acuerdosTag}${terminosTag}
        <button class="juicio-btn-vincular" onclick="event.stopPropagation();abrirGestionReciboJuicio(${idx})" title="${j.folioRecibo?'Cambiar / Desvincular recibo':'Vincular un recibo'}">
          ${j.folioRecibo?'✏️ Cambiar recibo':'🔗 Vincular recibo'}
        </button>
      </div>
      ${_finResumen(j.cliente, j.folioRecibo)}
      ${j.movimiento?`<div style="font-size:0.72rem;color:var(--gold-d);margin-top:6px;font-style:italic;">→ ${esc(j.movimiento)}</div>`:''}
      ${alerta}
    </div>`;
  }).join('');
}

function proximaAudienciaDeTerminos(j){
  if(!j.terminos||!j.terminos.length)return null;
  const hoy2=hoy();
  const futuros=j.terminos.filter(t=>!t.cumplido&&t.fecha>=hoy2).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  return futuros.length?futuros[0].fecha:null;
}

// ─── Detalle de Juicio ────────────────────────────────────────────
function abrirDetalle(idx){
  jdetIdx=idx;
  const j=D.juicios[idx];
  $('juicios-lista-view').style.display='none';
  const det=$('juicio-detalle');
  det.classList.add('visible');
  // Header
  $('jdet-nombre').textContent=j.cliente||'—';
  $('jdet-tipo').textContent=(j.tipo||'')+(j.expediente?' · Exp. '+j.expediente:'');
  // Estatus tag
  const tagC={'urgente':'tag-r','proceso':'tag-a','estable':'tag-v','concluido':'tag-m','inicio':'tag-b'}[j.estatus]||'tag-m';
  const tagL={'urgente':'🔴 Urgente','proceso':'🟡 En Proceso','estable':'🟢 Estable','concluido':'⚫ Concluido','inicio':'🔵 Inicio'}[j.estatus]||j.estatus;
  $('jdet-estatus-tag').className='tag '+tagC;
  $('jdet-estatus-tag').textContent=tagL;
  $('jdet-exp-badge').textContent=j.expediente?'Exp. '+j.expediente:'';
  // Folio
  if(j.folioRecibo){
    $('jdet-folio-badge').style.display='';
    $('jdet-folio-badge').textContent='🧾 Folio #'+folioFormato(j.folioRecibo);
  } else {
    $('jdet-folio-badge').style.display='none';
  }
  // Drive badge
  if(j.driveFolderId){
    $('jdet-drive-label').textContent='📂 '+j.driveFolderName;
    $('jdet-drive-badge').title='Abrir carpeta en Drive';
    $('jdet-drive-badge').onclick=()=>{
      // Solo abrir Drive si el ID es un ID real de Google Drive (empieza con 1 y tiene ~33 chars)
      const fid = j.driveFolderId || '';
      const esIdReal = fid.length > 25 && !fid.startsWith('juicio-');
      if(esIdReal){
        window.open('https://drive.google.com/drive/folders/'+fid,'_blank');
      } else {
        abrirVinculacionDrive();
      }
    };
  } else {
    $('jdet-drive-label').textContent='Vincular juicio';
    $('jdet-drive-badge').onclick=()=>abrirVinculacionDrive();
  }
  // Tab datos
  $('jd-expediente').textContent = j.expediente || '— Sin asignar —';
  // Control interno: si existe, mostrar; si no, mostrar botón para asignar
  const ciEl = $('jd-control-interno');
  if (ciEl) {
    if (j.controlInterno) {
      ciEl.innerHTML = '<span style="font-weight:700;color:var(--ink);">' + esc(j.controlInterno) + '</span>' +
        '<button onclick="editarControlInterno()" title="Editar" style="background:rgba(200,149,42,0.1);border:1px solid rgba(200,149,42,0.25);color:var(--gold-d);border-radius:3px;padding:2px 8px;font-size:0.58rem;cursor:pointer;font-family:\'JetBrains Mono\',monospace;font-weight:600;">✏️</button>';
    } else {
      ciEl.innerHTML = '<button onclick="editarControlInterno()" style="background:rgba(26,74,138,0.08);border:1px dashed rgba(26,74,138,0.3);color:var(--azul);border-radius:4px;padding:4px 10px;font-size:0.65rem;cursor:pointer;font-family:\'JetBrains Mono\',monospace;font-weight:600;letter-spacing:0.05em;">+ Asignar control interno</button>';
    }
  }
  $('jd-juzgado').textContent=j.juzgado||'—';
  $('jd-ingreso').textContent=j.fechaIngreso||'—';
  $('jd-audiencia').textContent=j.audiencia||proximaAudienciaDeTerminos(j)||'Sin audiencia programada';
  $('jd-tel').textContent=j.tel||'—';
  $('jd-movimiento').textContent=j.movimiento||'Sin movimientos registrados';
  $('jd-obs').textContent=j.obs||'';
  // Carpeta Drive: mostrar enlace clickeable o botón para vincular
  const driveEl = $('jd-drive-carpeta');
  if (driveEl) {
    if (j.driveFolderId) {
      const url = 'https://drive.google.com/drive/folders/' + j.driveFolderId;
      driveEl.innerHTML = '<a href="' + url + '" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:rgba(26,74,138,0.08);border:1px solid rgba(26,74,138,0.25);color:var(--azul);border-radius:4px;padding:6px 12px;text-decoration:none;font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;font-weight:600;transition:all 0.15s;">📁 Abrir carpeta en Drive ↗</a>' +
        '<button onclick="abrirVinculacionDrive()" title="Cambiar carpeta vinculada" style="margin-left:6px;background:none;border:1px solid var(--border-l);color:var(--muted);border-radius:3px;padding:4px 8px;font-size:0.58rem;cursor:pointer;font-family:\'JetBrains Mono\',monospace;">✏️</button>' +
        '<button onclick="desvincularCarpetaDrive()" title="Desvincular carpeta" style="margin-left:4px;background:none;border:1px solid var(--rojo-l);color:var(--rojo);border-radius:3px;padding:4px 8px;font-size:0.58rem;cursor:pointer;font-family:\'JetBrains Mono\',monospace;">✕</button>';
    } else {
      driveEl.innerHTML = '<button onclick="abrirVinculacionDrive()" style="background:rgba(26,74,138,0.08);border:1px dashed rgba(26,74,138,0.3);color:var(--azul);border-radius:4px;padding:6px 12px;font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;cursor:pointer;font-weight:600;letter-spacing:0.05em;">📁 Vincular carpeta de Drive</button>';
    }
  }
  renderFolioReciboDetalle(j);
  // Ir a tab datos
  switchJTab('datos',document.querySelector('.jdet-tab'));
  renderAcuerdos();
  renderTerminos();
}

function cerrarDetalle(){
  jdetIdx=-1;
  $('juicio-detalle').classList.remove('visible');
  $('juicios-lista-view').style.display='';
  cerrarVisorPDF();
}

function confirmarEliminarJuicio(idx){
  const j = D.juicios[idx];
  if(!j) return;
  const nombre = j.cliente || j.nombre || 'este expediente';
  const exp = j.expediente || j.num || '';
  const msg = '¿Eliminar el juicio de ' + nombre + (exp ? ' (Exp. '+exp+')' : '') + '?\n\nEsta acción no se puede deshacer.';
  if(!confirm(msg)) return;
  D.juicios.splice(idx, 1);
  try { backupLocal('D', D); } catch(e){ registrarError('catch vacio', e); }
  saveJuicios();
  cerrarDetalle();
  renderJuicios();
  badges();
  toast('Juicio eliminado', 'ok');
}

function switchJTab(tab,el){
  document.querySelectorAll('.jdet-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.jdet-panel').forEach(p=>p.classList.remove('active'));
  if(el)el.classList.add('active');
  $('jtab-'+tab).classList.add('active');
}

function abrirJuicioEdit(idx){
  const j=idx>=0?D.juicios[idx]:{};
  $('jCli').value=j.cliente||''; const jTipoEl=$('jTipo'); if(jTipoEl){ jTipoEl.value=j.tipo||''; if(!jTipoEl.value && j.tipo) jTipoEl.setAttribute('value',j.tipo||''); }
  $('jExp').value=j.expediente||'';$('jJuz').value=j.juzgado||'Juzgado Mixto Juxtlahuaca';
  $('jFIng').value=j.fechaIngreso||'';$('jAud').value=j.audiencia||'';
  $('jEst').value=j.estatus||'proceso';$('jTel').value=j.tel||'';
  $('jMov').value=j.movimiento||'';$('jObs').value=j.obs||'';
  // Control interno (campo nuevo)
  if($('jCtrlInt')) $('jCtrlInt').value = j.controlInterno || '';
  $('mJTitulo').textContent=idx>=0?'Editar Expediente':'Nuevo Expediente';
  eiJ=idx;
  $('mJuicio').classList.add('show');
}

function abrirJuicio(idx){
  // Compatibilidad: si se llama sin idx desde la lista (nuevo), o con idx (editar)
  if(idx===undefined)idx=-1;
  abrirJuicioEdit(idx);
}

function guardarJuicio(){
  try {
    const j = D.juicios[eiJ] || {};
    const ctrlInt = ($('jCtrlInt') ? $('jCtrlInt').value.trim() : '');
    const upd = {
      cliente:    $('jCli').value.trim(),
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

// ─── Acuerdos ─────────────────────────────────────────────────────
function renderAcuerdos(){
  const j=D.juicios[jdetIdx];
  if(!j)return;
  const acuerdos=(j.acuerdos||[]).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const el=$('lista-acuerdos');
  const ultiEl=$('jdet-ultimo-acuerdo');
  if(!acuerdos.length){
    el.innerHTML='<div style="color:var(--muted);padding:24px;font-size:0.76rem;text-align:center;">Sin acuerdos registrados.<br>Agrega el primer acuerdo del juzgado.</div>';
    ultiEl.style.display='none';return;
  }
  // Mostrar último acuerdo destacado
  const ultimo=acuerdos[0];
  ultiEl.style.display='';
  $('jdet-ultimo-body').innerHTML=`
    <div style="display:flex;gap:12px;align-items:flex-start;">
      <span class="acuerdo-tipo-tag" style="background:var(--gold-bg);color:var(--gold-d);">${esc(ultimo.tipo)}</span>
      <span style="font-family:monospace;font-size:0.65rem;color:var(--muted);">${ultimo.fecha}</span>
    </div>
    <div style="font-size:0.85rem;margin-top:8px;line-height:1.6;color:var(--ink);">${esc(ultimo.descripcion)}</div>
    ${ultimo.resumenIA?`<div class="acuerdo-resumen"><span class="acuerdo-resumen-label">✨ Resumen IA</span>${esc(ultimo.resumenIA)}</div>`:''}
    ${ultimo.driveFileId?`<a class="acuerdo-pdf-btn" onclick="verPDFAcuerdo('${ultimo.driveFileId}','${esc(ultimo.driveFileName||'acuerdo.pdf')}')">📄 Ver PDF</a>`:''}
  `;
  // Lista completa
  el.innerHTML=acuerdos.map((a,i)=>{
    const d=new Date(a.fecha+'T12:00:00');
    const dia=String(d.getDate()).padStart(2,'0');
    const mes=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()];
    const yr=d.getFullYear();
    const tipoColors={'Acuerdo':'background:var(--azul-l);color:var(--azul);','Sentencia':'background:#f3e8ff;color:#7c3aed;','Notificación':'background:var(--amarillo-l);color:var(--amarillo);','Requerimiento':'background:var(--rojo-l);color:var(--rojo);','Exhorto':'background:var(--verde-l);color:var(--verde-d);'}[a.tipo]||'background:var(--surface2);color:var(--muted);';
    return `<div class="acuerdo-item">
      <div class="acuerdo-fecha-col">
        <div class="acuerdo-fecha-dia">${dia}</div>
        <div class="acuerdo-fecha-mes">${mes}</div>
        <div class="acuerdo-fecha-yr">${yr}</div>
      </div>
      <div class="acuerdo-body">
        <span class="acuerdo-tipo-tag" style="${tipoColors}">${esc(a.tipo)}</span>
        <div class="acuerdo-desc">${esc(a.descripcion)}</div>
        ${a.resumenIA?`<div class="acuerdo-resumen"><span class="acuerdo-resumen-label">✨ Resumen IA</span>${esc(a.resumenIA)}</div>`:''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
          ${a.driveFileId?`<a class="acuerdo-pdf-btn" onclick="verPDFAcuerdo('${a.driveFileId}','${esc(a.driveFileName||'acuerdo.pdf')}')">📄 Ver PDF</a>`:''}
          <a class="acuerdo-pdf-btn" style="background:var(--rojo-l);color:var(--rojo);border-color:rgba(192,22,26,0.2);" onclick="eliminarAcuerdo(${i})">🗑</a>
        </div>
      </div>
    </div>`;
  }).join('');
}

function abrirNuevoAcuerdo(){
  $('acFecha').value=hoy();
  $('acTipo').value='Acuerdo';
  $('acDesc').value='';
  $('acPDF').value='';
  $('acPDF-nombre').textContent='Sin archivo';
  $('acPDF-info').style.display='none';
  acuerdoPDFPendiente=null;
  const j=D.juicios[jdetIdx];
  $('acDriveFolderWarn').style.display=(j&&j.driveFolderId)?'none':'';
  $('mNuevoAcuerdo').classList.add('show');
}

function previewAcuerdoPDF(input){
  const f=input.files[0];
  if(!f)return;
  acuerdoPDFPendiente=f;
  $('acPDF-nombre').textContent=f.name;
  $('acPDF-info').style.display='';
}

async function guardarAcuerdo(){
  const fecha=$('acFecha').value;
  const desc=$('acDesc').value.trim();
  if(!fecha||!desc){toast('Fecha y descripción son obligatorios','err');return;}
  const j=D.juicios[jdetIdx];
  if(!j.acuerdos)j.acuerdos=[];
  const acuerdo={
    id:'AC-'+Date.now(),
    fecha,tipo:$('acTipo').value,
    descripcion:desc,
    driveFileId:null,driveFileName:null,resumenIA:null
  };
  // Subir PDF si hay y hay carpeta vinculada
  if(acuerdoPDFPendiente&&j.driveFolderId&&sbSession&&Date.now()<sbExpiry){
    toast('Subiendo PDF a Drive...');
    $('btn-guardar-acuerdo').disabled=true;
    try{
      const r=await subirPDFaJuicio(acuerdoPDFPendiente,j.driveFolderId);
      if(r){acuerdo.driveFileId=r.id;acuerdo.driveFileName=acuerdoPDFPendiente.name;}
    }catch(e){console.warn('PDF upload:',e);}
    $('btn-guardar-acuerdo').disabled=false;
  }
  j.acuerdos.unshift(acuerdo);
  // Actualizar último movimiento
  j.movimiento=`[${acuerdo.tipo} ${fecha}] ${desc.substring(0,80)}${desc.length>80?'…':''}`;
  saveJuicios();
  cerrar('mNuevoAcuerdo');
  toast('Acuerdo guardado ✓');
  acuerdoPDFPendiente=null;
  abrirDetalle(jdetIdx);
}

async function eliminarAcuerdo(idxAc){
  const j=D.juicios[jdetIdx];
  if(!j||!j.acuerdos)return;
  // idxAc es posición en lista sorted DESC, necesitamos encontrar el real
  const acuerdosSorted=(j.acuerdos||[]).slice().sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const acToDelete=acuerdosSorted[idxAc];
  if(!acToDelete)return;
  const ok = await confirmarBonito({
    titulo: 'Eliminar acuerdo',
    mensaje: '¿Eliminar este acuerdo del expediente?\n\nNota: el PDF en Drive no se eliminará.',
    btnSi: 'Sí, eliminar',
    btnNo: 'Cancelar',
    peligro: true
  });
  if(!ok) return;
  j.acuerdos=j.acuerdos.filter(a=>a.id!==acToDelete.id);
  saveJuicios();
  renderAcuerdos();
  toast('Acuerdo eliminado');
}

async function verPDFAcuerdo(fileId, nombre){
  if(!window.SB || !window.SB_DESPACHO_ID){ toast('Sin sesión activa','err'); return; }
  toast('Cargando PDF...');
  try {
    // En Supabase fileId puede ser una ruta completa (despacho_id/juicios/...) o solo el nombre
    let path = fileId;
    if(!path.includes('/')){
      path = window.SB_DESPACHO_ID + '/juicios/' + path;
    }
    const { data: blob, error } = await window.SB.storage.from(STORAGE_BUCKET).download(path);
    if(error || !blob){ toast('No se pudo cargar el PDF','err'); console.warn(error); return; }
    const url = URL.createObjectURL(blob);
    $('visor-pdf-nombre').textContent = nombre;
    $('visor-pdf-iframe').src = url;
    $('visor-pdf-wrap').style.display = '';
    $('visor-pdf-wrap').scrollIntoView({behavior:'smooth'});
  } catch(e){
    toast('Error al cargar PDF','err');
    console.warn(e);
  }
}

function cerrarVisorPDF(){
  const w=$('visor-pdf-wrap');
  if(w){w.style.display='none';$('visor-pdf-iframe').src='';}
}

async function resumirUltimoAcuerdoIA(){
  const j=D.juicios[jdetIdx];
  if(!j||!(j.acuerdos||[]).length){toast('No hay acuerdos','err');return;}
  const ultimo=j.acuerdos.slice().sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
  if(!ultimo.descripcion){toast('El acuerdo no tiene descripción','err');return;}
  const btn=$('btn-resumir-ia');
  btn.disabled=true;btn.textContent='⏳ Procesando...';
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',max_tokens:500,
        messages:[{role:'user',content:`Eres asistente legal mexicano. Resume en máximo 3 oraciones claras y concisas el siguiente acuerdo judicial, destacando: qué resolvió el juez, qué acción se requiere del abogado (si aplica), y si hay plazo. Responde solo el resumen, sin encabezados.\n\nAcuerdo (${ultimo.tipo} — ${ultimo.fecha}):\n${ultimo.descripcion}`}]
      })
    });
    const d=await r.json();
    const resumen=d.content?.[0]?.text||'';
    if(!resumen){toast('No se pudo generar resumen','err');return;}
    ultimo.resumenIA=resumen;
    saveJuicios();
    renderAcuerdos();
    toast('Resumen generado ✓','ok');
  }catch(e){toast('Error al conectar con IA','err');console.warn(e);}
  btn.disabled=false;btn.textContent='✨ Resumir con IA';
}

// ─── Términos ─────────────────────────────────────────────────────
function renderTerminos(){
  const j=D.juicios[jdetIdx];
  if(!j)return;
  const terminos=(j.terminos||[]).slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const el=$('lista-terminos');
  if(!el)return;
  if(!terminos.length){
    el.innerHTML='<div style="color:var(--muted);padding:24px;font-size:0.76rem;text-align:center;">Sin términos registrados.<br>Agrega audiencias, requerimientos o contestaciones pendientes.</div>';
    return;
  }
  const hoyStr=hoy();
  el.innerHTML=terminos.map((t,i)=>{
    const diff=Math.ceil((new Date(t.fecha+'T12:00:00')-new Date())/86400000);
    let semaforoClass='semaforo-gris';
    let diasLabel='Cumplido';
    let diasStyle='background:#f0ead8;color:var(--muted);';
    if(!t.cumplido){
      if(diff<0){semaforoClass='semaforo-rojo';diasLabel=`Venció hace ${Math.abs(diff)}d`;diasStyle='background:var(--rojo-l);color:var(--rojo);';}
      else if(diff<=3){semaforoClass='semaforo-rojo';diasLabel=`⚠ ${diff}d restantes`;diasStyle='background:var(--rojo-l);color:var(--rojo);font-weight:700;';}
      else if(diff<=7){semaforoClass='semaforo-amarillo';diasLabel=`${diff}d restantes`;diasStyle='background:var(--amarillo-l);color:var(--amarillo);';}
      else{semaforoClass='semaforo-verde';diasLabel=`${diff}d restantes`;diasStyle='background:var(--verde-l);color:var(--verde-d);';}
    }
    const tipoIco={'Audiencia':'⚖️','Requerimiento':'📋','Contestación':'✍️','Escrito':'📝','Término':'⏰','Pruebas':'🔍','Apelación':'📤','Otro':'📌'}[t.tipo]||'📌';
    return `<div class="termino-row" style="${t.cumplido?'opacity:0.5;':''}">
      <div class="termino-semaforo ${semaforoClass}"></div>
      <div class="termino-info">
        <div class="termino-tipo">${tipoIco} ${t.tipo}</div>
        <div class="termino-desc">${esc(t.descripcion)}</div>
        <div class="termino-fecha">${t.fecha}${t.hora?' · '+t.hora:''}</div>
        ${t.nota?`<div style="font-size:0.68rem;color:var(--muted);margin-top:3px;font-style:italic;">${esc(t.nota)}</div>`:''}
      </div>
      <div class="termino-dias" style="${diasStyle}">${diasLabel}</div>
      <button class="termino-check-btn ${t.cumplido?'cumplido':''}" onclick="toggleTermino(${i})" title="${t.cumplido?'Marcar pendiente':'Marcar cumplido'}">
        ${t.cumplido?'✓':''}
      </button>
      <button onclick="editarTermino(${i})" style="background:none;border:1px solid var(--border-l);border-radius:5px;cursor:pointer;color:var(--muted);font-size:0.78rem;padding:3px 6px;transition:all 0.15s;" onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold)'" onmouseout="this.style.borderColor='var(--border-l)';this.style.color='var(--muted)'" title="Editar">✏</button>
      <button onclick="eliminarTermino(${i})" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:0.8rem;padding:4px;" title="Eliminar">🗑</button>
    </div>`;
  }).join('');
}

let _terminoEditIdx = null;

function abrirNuevoTermino(){
  _terminoEditIdx = null;
  $('trTipo').value='Audiencia';$('trDesc').value='';$('trFecha').value='';$('trHora').value='';$('trNota').value='';
  const hdr = document.querySelector('#mNuevoTermino .modal-hdr h3');
  if(hdr) hdr.textContent = '⏱ Agregar Término / Audiencia';
  const btn = document.querySelector('#mNuevoTermino .btn-primary');
  if(btn) btn.textContent = '💾 Guardar';
  $('mNuevoTermino').classList.add('show');
}

function editarTermino(i){
  const j=D.juicios[jdetIdx];if(!j||!j.terminos)return;
  const sorted=j.terminos.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const t=sorted[i];if(!t)return;
  _terminoEditIdx = j.terminos.findIndex(x=>x.id===t.id);
  $('trTipo').value  = t.tipo||'Audiencia';
  $('trDesc').value  = t.descripcion||'';
  $('trFecha').value = t.fecha||'';
  $('trHora').value  = t.hora||'';
  $('trNota').value  = t.nota||'';
  const hdr = document.querySelector('#mNuevoTermino .modal-hdr h3');
  if(hdr) hdr.textContent = '✏ Editar Término / Audiencia';
  const btn = document.querySelector('#mNuevoTermino .btn-primary');
  if(btn) btn.textContent = '💾 Actualizar';
  $('mNuevoTermino').classList.add('show');
}

function guardarTermino(){
  const tipo=$('trTipo').value,desc=$('trDesc').value.trim(),fecha=$('trFecha').value;
  if(!tipo||!desc||!fecha){toast('Tipo, descripción y fecha son obligatorios','err');return;}
  const j=D.juicios[jdetIdx];if(!j)return;
  if(!j.terminos)j.terminos=[];
  if(_terminoEditIdx !== null && _terminoEditIdx >= 0 && j.terminos[_terminoEditIdx]){
    // Modo edición — actualizar registro existente
    const t = j.terminos[_terminoEditIdx];
    t.tipo = tipo; t.descripcion = desc; t.fecha = fecha;
    t.hora = $('trHora').value; t.nota = $('trNota').value.trim();
    t.updatedAt = Date.now(); // marca de tiempo para resolver conflictos
    j.updatedAt = Date.now(); // también marcar el juicio padre
    saveJuicios();cerrar('mNuevoTermino');toast('✏ Término actualizado');renderTerminos();renderJuicios();
  } else {
    // Modo nuevo
    j.terminos.push({id:'TR-'+Date.now(),tipo,descripcion:desc,fecha,hora:$('trHora').value,nota:$('trNota').value.trim(),cumplido:false});
    if(tipo==='Audiencia'&&!j.audiencia){
      const prox=proximaAudienciaDeTerminos(j);
      if(prox)j.audiencia=prox;
    }
    saveJuicios();cerrar('mNuevoTermino');toast('Término agregado ✓');renderTerminos();renderJuicios();
  }
  _terminoEditIdx = null;
  if(typeof hjRenderTerminos==='function') try{hjRenderTerminos();}catch(e){ registrarError('catch vacio', e); }
  if(typeof renderVencimientos==='function') safeExec('renderVencimientos', () => renderVencimientos());
}

function toggleTermino(i){
  const j=D.juicios[jdetIdx];if(!j||!j.terminos)return;
  const sorted=j.terminos.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const t=sorted[i];if(!t)return;
  const real=j.terminos.find(x=>x.id===t.id);if(!real)return;
  real.cumplido=!real.cumplido;
  saveJuicios();renderTerminos();
  if(typeof hjRenderTerminos==='function') try{hjRenderTerminos();}catch(e){ registrarError('catch vacio', e); }
  if(typeof renderVencimientos==='function') safeExec('renderVencimientos', () => renderVencimientos());
}

async function eliminarTermino(i){
  const j=D.juicios[jdetIdx];if(!j||!j.terminos)return;
  const sorted=j.terminos.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const t=sorted[i];if(!t)return;
  const ok = await confirmarBonito({
    titulo: 'Eliminar término',
    mensaje: '¿Eliminar este término del expediente?',
    btnSi: 'Sí, eliminar',
    btnNo: 'Cancelar',
    peligro: true
  });
  if(!ok) return;
  j.terminos=j.terminos.filter(x=>x.id!==t.id);
  saveJuicios();renderTerminos();
  if(typeof hjRenderTerminos==='function') try{hjRenderTerminos();}catch(e){ registrarError('catch vacio', e); }
  if(typeof renderVencimientos==='function') safeExec('renderVencimientos', () => renderVencimientos());
}

// ─── Vincular Carpeta Drive ───────────────────────────────────────
async function abrirVinculacionDrive(){
  $('mVincularDrive').classList.add('show');
  driveFolderSeleccionado=null;
  $('btn-vincular-drive').disabled=true;
  $('drive-folder-selected').style.display='none';
  $('driveFolderQ').value='';
  $('drive-folder-list').innerHTML='<div style="text-align:center;padding:24px;color:var(--muted);font-size:0.76rem;">🔄 Cargando carpetas de Drive...</div>';
  await cargarCarpetasDrive();
  renderCarpetasDriveModal();
}

// ═══ EDITAR CONTROL INTERNO DEL EXPEDIENTE ═══
// Identificador único del despacho para localizar físicamente la carpeta del juicio.
async function editarControlInterno() {
  if (jdetIdx < 0 || !D.juicios[jdetIdx]) return;
  const j = D.juicios[jdetIdx];
  const valorActual = j.controlInterno || '';
  
  const nuevo = await pedirTexto({
    titulo: 'Control Interno del Despacho',
    mensaje: 'Identificador único usado en el archivo físico del despacho.\nEjemplo: J-2024-001, EXP-102, CARPETA-58A',
    valorInicial: valorActual,
    placeholder: 'Ej: J-2024-001',
    btnSi: valorActual ? 'Actualizar' : 'Asignar',
    btnNo: 'Cancelar',
    validar: (v) => {
      if (!v.trim() && valorActual) {
        // Permitir borrar (devolver vacío para eliminar)
        return null;
      }
      if (v.trim().length > 50) {
        return 'Demasiado largo. Máximo 50 caracteres.';
      }
      return null;
    }
  });
  
  // null = canceló; cualquier otra cosa (incluso vacío) = aceptó
  if (nuevo === null) return;
  
  const valorLimpio = nuevo.trim();
  if (valorLimpio === '') {
    delete j.controlInterno;
    toast('Control interno eliminado', 'ok');
  } else {
    j.controlInterno = valorLimpio;
    toast('✓ Control interno actualizado', 'ok');
  }
  
  saveJuicios();
  // Refrescar la vista del detalle
  abrirDetalle(jdetIdx);
}

// ═══ DESVINCULAR CARPETA DRIVE DEL JUICIO ═══
async function desvincularCarpetaDrive() {
  if (jdetIdx < 0 || !D.juicios[jdetIdx]) return;
  const j = D.juicios[jdetIdx];
  if (!j.driveFolderId) return;
  
  const ok = await confirmarBonito({
    titulo: 'Desvincular carpeta de Drive',
    mensaje: 'Se quitará la conexión con la carpeta de Drive vinculada a este juicio.\n\n⚠ La carpeta NO se elimina de Drive — solo se desconecta.',
    btnSi: 'Sí, desvincular',
    btnNo: 'Cancelar'
  });
  if (!ok) return;
  
  delete j.driveFolderId;
  delete j.driveFolderName;
  saveJuicios();
  toast('✓ Carpeta Drive desvinculada del juicio', 'ok');
  abrirDetalle(jdetIdx);
}

async function cargarCarpetasDrive(){
  // Cargar carpetas reales de Google Drive desde la carpeta JUICIOS
  try {
    const token = await driveGetAccessToken();
    if(!token){
      // Sin token — usar lista de juicios como fallback
      driveFoldersCache = (D.juicios || []).map(j => ({
        id: '', // Sin ID real de Drive
        name: j.expediente ? (j.expediente + ' — ' + (j.cliente||'')) : (j.cliente || 'Juicio')
      }));
      return;
    }
    // Buscar subcarpetas dentro de la carpeta JUICIOS
    const q = "mimeType='application/vnd.google-apps.folder' and trashed=false and '1jgwqgCv0OAD9NBDimlY6L-9bfCktqyz0' in parents";
    const url = 'https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)
      +'&fields=files(id,name)&pageSize=50&orderBy=name'
      +'&includeItemsFromAllDrives=true&supportsAllDrives=true';
    const resp = await fetch(url, { headers:{ Authorization:'Bearer '+token } });
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const data = await resp.json();
    driveFoldersCache = (data.files || []).map(f => ({ id: f.id, name: f.name }));
    console.log('[Drive] Carpetas cargadas:', driveFoldersCache.length);
  } catch(e){
    console.warn('cargarCarpetasDrive:', e);
    // Fallback: lista vacía — no mostrar IDs falsos
    driveFoldersCache = [];
  }
}

// ─── Subir PDF al juicio (Supabase Storage) ──────────────────────
async function subirPDFaJuicio(file, folderId){
  if(!window.SB || !window.SB_DESPACHO_ID) return null;
  try {
    // folderId es el id virtual del juicio. Guardamos bajo despacho_id/juicios/{folderId}/...
    const safe = (file.name||'doc.pdf').replace(/[^a-zA-Z0-9._-]/g,'_');
    const path = window.SB_DESPACHO_ID + '/juicios/' + (folderId||'general') + '/' + Date.now() + '_' + safe;
    const { error } = await window.SB.storage.from(STORAGE_BUCKET).upload(path, file, {
      contentType: 'application/pdf',
      upsert: false
    });
    if(error){ console.warn('subirPDFaJuicio:', error); return null; }
    toast('PDF subido ✓','ok');
    return { id: path, name: safe };
  } catch(e){
    console.warn('subirPDFaJuicio:', e);
    return null;
  }
}

function renderCarpetasDriveModal(filtro=''){
  const lista=filtro?driveFoldersCache.filter(f=>f.name.toLowerCase().includes(filtro.toLowerCase())):driveFoldersCache;
  const el=$('drive-folder-list');
  if(!lista.length){
    el.innerHTML='<div style="text-align:center;padding:20px;font-size:0.78rem;line-height:1.7;">'
      +'<div style="color:var(--rojo);font-weight:600;margin-bottom:8px;">⚠ No se pudieron cargar las carpetas de Drive</div>'
      +'<div style="color:var(--muted);">El token de Drive puede haber expirado.<br>'
      +'Cierra este modal, abre "Nueva entrada" → ⚙️ → pega un token nuevo → guarda.<br>'
      +'Luego vuelve a intentar vincular.</div>'
      +'</div>';
    return;
  }
  el.innerHTML=lista.map(f=>{
    const sel=driveFolderSeleccionado&&driveFolderSeleccionado.id===f.id;
    return `<div class="drive-folder-item ${sel?'selected':''}" onclick="seleccionarCarpetaDrive('${f.id}','${f.name.replace(/'/g,"\\'")}')">
      <span style="font-size:1.1rem;">📁</span>
      <span style="font-size:0.82rem;font-weight:600;">${esc(f.name)}</span>
    </div>`;
  }).join('');
}

function filtrarCarpetasDrive(){
  renderCarpetasDriveModal($('driveFolderQ').value);
}

function seleccionarCarpetaDrive(id,name){
  driveFolderSeleccionado={id,name};
  $('btn-vincular-drive').disabled=false;
  $('drive-folder-selected').style.display='';
  $('drive-folder-selected-name').textContent=name;
  renderCarpetasDriveModal($('driveFolderQ').value);
}

function confirmarVinculacionDrive(){
  if(!driveFolderSeleccionado)return;
  const j=D.juicios[jdetIdx];if(!j)return;
  j.driveFolderId=driveFolderSeleccionado.id;
  j.driveFolderName=driveFolderSeleccionado.name;
  saveJuicios();
  cerrar('mVincularDrive');
  toast('Carpeta Drive vinculada ✓','ok');
  abrirDetalle(jdetIdx);
}

// ─── Vincular Folio de Recibo ─────────────────────────────────────
function abrirVinculacionFolio(){
  renderFoliosVinculacion('');
  $('folioQ').value='';
  $('mVincularFolio').classList.add('show');
}

function filtrarFoliosVinculacion(){
  renderFoliosVinculacion($('folioQ').value);
}

function renderFoliosVinculacion(q=''){
  const recibos=(REC.recibos||[]);
  const filtrados=q?recibos.filter(r=>(r.nombre||'').toLowerCase().includes(q.toLowerCase())||String(r.folio).includes(q)):recibos;
  const el=$('folio-list');
  if(!filtrados.length){el.innerHTML='<div style="padding:16px;color:var(--muted);font-size:0.76rem;text-align:center;">Sin recibos encontrados.</div>';return;}
  el.innerHTML=filtrados.slice(0,30).map(r=>{
    const saldo=r.saldoPendiente!=null?r.saldoPendiente:Math.max(0,(r.total||0)-(r.anticipo||0));
    return `<div class="drive-folder-item" onclick="vincularFolioRecibo(${r.folio})">
      <span style="font-family:monospace;font-size:0.75rem;font-weight:700;color:var(--gold-d);">#${folioFormato(r.folio, r.anio_folio)}</span>
      <div style="flex:1;">
        <div style="font-size:0.82rem;font-weight:600;">${esc(r.nombre||'—')}</div>
        <div style="font-family:monospace;font-size:0.6rem;color:var(--muted);">${r.fecha||''}${r.total?' · $'+fmt(r.total):''} ${saldo>0?'· <span style="color:var(--amarillo);">$'+fmt(saldo)+' pendiente</span>':'· <span style="color:var(--verde);">Liquidado</span>'}</div>
      </div>
    </div>`;
  }).join('');
}

function vincularFolioRecibo(folio){
  const j=D.juicios[jdetIdx];if(!j)return;
  j.folioRecibo=folio;
  saveJuicios();
  cerrar('mVincularFolio');
  toast('Folio vinculado ✓','ok');
  abrirDetalle(jdetIdx);
}

function renderFolioReciboDetalle(j){
  const el=$('jd-folio-recibo-detalle');
  if(!j.folioRecibo){el.innerHTML='<div style="color:var(--muted);font-size:0.76rem;">Sin recibo vinculado.</div>';return;}
  const rec=(REC.recibos||[]).find(r=>r.folio===j.folioRecibo);
  if(!rec){el.innerHTML=`<div style="font-family:monospace;font-size:0.75rem;color:var(--gold-d);">Folio #${folioFormato(j.folioRecibo)} — (recibo no encontrado en sistema)</div>`;return;}
  const saldo=rec.saldoPendiente!=null?rec.saldoPendiente:Math.max(0,(rec.total||0)-(rec.anticipo||0));
  el.innerHTML=`<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;">
    <div style="font-family:monospace;font-size:1.2rem;font-weight:700;color:var(--gold-d);">#${folioFormato(rec.folio, rec.anio_folio)}</div>
    <div>
      <div style="font-weight:600;font-size:0.85rem;">${esc(rec.nombre||'')}</div>
      <div style="font-family:monospace;font-size:0.65rem;color:var(--muted);">${rec.fecha||''}</div>
    </div>
    <div style="margin-left:auto;text-align:right;">
      <div style="font-family:monospace;font-size:0.9rem;font-weight:700;color:var(--verde);">$${fmt(rec.total||0)}</div>
      <span class="tag ${saldo>0?'tag-a':'tag-v'}" style="font-size:0.55rem;">${saldo>0?'$'+fmt(saldo)+' pendiente':'Liquidado'}</span>
    </div>
  </div>`;
}

// ════════════════════════════════════════════════════════════════
// VINCULAR RECIBO CON CONTROL DE ARCHIVO — Solo interno, no imprime
// ════════════════════════════════════════════════════════════════
let _carpetaVinculadaActual = null;

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

function mVAFiltrar() {
  const q = (document.getElementById('mVA-buscar')?.value || '').toLowerCase().trim();
  const lista = document.getElementById('mVA-lista');
  if (!lista) return;

  // Sin query → mostrar mensaje invitando a buscar
  if(!q){
    lista.innerHTML = '<div style="padding:28px;text-align:center;color:var(--muted);font-size:0.75rem;line-height:1.8;">🔍 Escribe el número, nombre o trámite<br>para buscar una carpeta</div>';
    return;
  }

  const carpetas = D.carpetas || [];
  const filtradas = carpetas.filter(c =>
    String(c.num||'').includes(q) ||
    (c.cliente||'').toLowerCase().includes(q) ||
    (c.descripcion||'').toLowerCase().includes(q)
  ).slice(0, 20);
  if (!filtradas.length) {
    lista.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:0.75rem;">Sin carpetas encontradas para <strong>"'+esc(q)+'"</strong></div>';
    return;
  }
  const raw = parseInt($('folio-display')?.textContent||'0')||0;
  const folioDisplay = folioFormato(raw);
  lista.innerHTML = filtradas.map(c => {
    const estadoColor = {ACTIVO:'var(--verde)',ARCHIVADO:'var(--muted)',CANCELADO:'var(--rojo)'}[c.estadoArchivo]||'var(--muted)';
    const estadoIcon  = {ACTIVO:'✅',ARCHIVADO:'📦',CANCELADO:'❌'}[c.estadoArchivo]||'📂';
    const priIcon     = {URGENTE:'🔴',BUEN_TIEMPO:'🟢',REZAGADO:'🟡'}[c.prioridad]||'';
    const saldoInfo   = _getInfoPagoCarpeta(c);
    const yaVinculada = String(c.reciboOficial||'').replace('#','').trim() === folioDisplay;
    const bColor = yaVinculada ? 'var(--verde)' : 'var(--border-l)';
    const bBg    = yaVinculada ? 'var(--verde-l)' : 'var(--surface)';
    return '<div onclick="seleccionarCarpetaArchivo(\''+c.num+'\')"'
      +' style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1.5px solid '+bColor+';border-radius:7px;margin-bottom:6px;cursor:pointer;background:'+bBg+';transition:all 0.15s;"'
      +' onmouseover="this.style.borderColor=\'var(--gold)\';this.style.background=\'var(--gold-pale)\'"'
      +' onmouseout="this.style.borderColor=\''+bColor+'\';this.style.background=\''+bBg+'\'">'
      +'<div style="font-family:\'JetBrains Mono\',monospace;font-size:1.3rem;font-weight:800;color:var(--gold-d);min-width:44px;text-align:center;">#'+c.num+'</div>'
      +'<div style="flex:1;min-width:0;">'
      +'<div style="font-weight:600;font-size:0.84rem;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(c.cliente||'—')+'</div>'
      +'<div style="font-size:0.67rem;color:var(--muted);margin-top:2px;">'+esc(c.descripcion||'')+' '+priIcon+'</div>'
      +'<div style="font-size:0.63rem;margin-top:3px;color:'+estadoColor+';font-family:\'JetBrains Mono\',monospace;">'+estadoIcon+' '+(c.estadoArchivo||'Sin estado')+' · '+saldoInfo+'</div>'
      +'</div>'
      +(yaVinculada?'<span style="font-size:0.58rem;font-family:\'JetBrains Mono\',monospace;color:var(--verde-d);font-weight:700;flex-shrink:0;">✓ VINCULADA</span>':'')
      +'</div>';
  }).join('');
}

function _getInfoPagoCarpeta(c) {
  const recibos = (typeof appData!=='undefined'?appData.recibos:REC.recibos)||[];
  const folioStr = String(c.reciboOficial||'').replace('#','').trim();
  let rec = null;
  if (folioStr) rec = recibos.find(r=>r.folio===parseInt(folioStr));
  if (!rec) rec = recibos.find(r=>String(r.carpeta||'')===String(c.num));
  if (!rec) return 'Sin recibo vinculado';
  const saldo = rec.saldoPendiente!=null?rec.saldoPendiente:Math.max(0,(rec.total||0)-parseFloat(rec.anticipo||0));
  if (rec.cancelado) return '🚫 Cancelado';
  if (saldo<=0) return '✅ Liquidado';
  return '⚠ Saldo: $'+fmt(saldo);
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
  cerrar('mVincularArchivo');
  toast('🗂️ Recibo vinculado a Carpeta #'+numCarpeta+' — '+c.cliente,'ok');
}

function desvincularArchivo() {
  if (!_carpetaVinculadaActual) return;
  const c = D.carpetas.find(x=>x.num===_carpetaVinculadaActual.num);
  if (c) { c.reciboOficial=''; save(); saveCarpetas(); }
  _carpetaVinculadaActual=null;
  _actualizarBadgeArchivoVinculado(null);
  cerrar('mVincularArchivo');
  toast('Vinculación eliminada');
}

function _actualizarBadgeArchivoVinculado(c) {
  const badge=document.getElementById('badge-archivo-vinculado');
  const btn=document.getElementById('btn-vincular-archivo');
  if(!badge||!btn)return;
  if(c){
    badge.style.display='block';
    btn.style.borderColor='#1a7a3a'; btn.style.color='#1a7a3a';
    btn.title='Carpeta #'+c.num+' — '+c.cliente+' (vinculada)';
  }else{
    badge.style.display='none';
    btn.style.borderColor='#1a4a8a'; btn.style.color='#1a4a8a';
    btn.title='Vincular con Control de Carpetas (solo interno)';
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
  // Marcar timestamp ANTES de subir para que postgres_changes lo ignore
  _ultimoSyncPropio = Date.now();
  syncEstadoSupabase().catch(function(e){ console.warn('[saveJuicios]', e); });
}

// ═══ PENDIENTES ═══
function setPF(f,el){
  // Filter locked to 'activos' — filter bar removed
  filtroP = 'activos';
  renderPend();
}

// ── Inferir sección a partir de categoría legacy (para pendientes sin seccion explícita)
function _inferirSeccion(categoria){
  if(!categoria) return 'otros';
  const c=String(categoria).toLowerCase();
  if(c==='placas'||c.includes('placa')||c.includes('tenencia')) return 'placas';
  if(c==='escritura'||c.includes('escritura')) return 'escrituras';
  if(c==='juicio'||c.includes('juicio')||c.includes('amparo')) return 'juicios';
  return 'otros';
}

// ── Resolver la sección efectiva de un pendiente (con fallback)
function _seccionDe(p){
  return p.seccion || _inferirSeccion(p.categoria);
}

// ── Cambiar de sección (panel principal)
function setPSec(sec, el){
  filtroSeccion = sec;
  document.querySelectorAll('#panel-pendientes .pend-sec-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('#pend-todas-btn').forEach(b=>b.classList.remove('active'));
  if (sec === 'todas') {
    const btn = document.getElementById('pend-todas-btn');
    if (btn) btn.classList.add('active');
  } else {
    const btn = document.querySelector('#panel-pendientes .pend-sec-btn[data-sec="'+sec+'"]');
    if (btn) btn.classList.add('active');
  }
  renderPend();
}

function renderPend(){
  const q=($('pendQ')?.value||'').toLowerCase();
  const hoy2=hoy();

  // ── Contadores por sección (sobre pendientes ACTIVOS, para badges visuales)
  const cntSec = { placas:0, escrituras:0, juicios:0, otros:0 };
  (D.pendientes||[]).filter(p=>!p.resuelto).forEach(p=>{
    const s = _seccionDe(p);
    if (cntSec[s] !== undefined) cntSec[s]++;
  });
  const setTxt=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent = v+' activo'+(v===1?'':'s'); };
  setTxt('pend-cnt-placas',     cntSec.placas);
  setTxt('pend-cnt-escrituras', cntSec.escrituras);
  setTxt('pend-cnt-juicios',    cntSec.juicios);
  setTxt('pend-cnt-otros',      cntSec.otros);
  setTxt('pend-cnt-todas', cntSec.placas + cntSec.escrituras + cntSec.juicios + cntSec.otros);

  // ── Aplicar filtro de sección
  const baseList = (D.pendientes||[]).filter(p=>{
    if (filtroSeccion === 'todas') return true;
    // 'manual' = todo excepto placas (pendientes agregados manualmente: juicios, escrituras, otros)
    if (filtroSeccion === 'manual') return _seccionDe(p) !== 'placas';
    return _seccionDe(p) === filtroSeccion;
  });

  // Stats (respetan la sección activa)
  const total=baseList.filter(p=>!p.resuelto).length;
  const urgentes=baseList.filter(p=>!p.resuelto&&p.prioridad==='urgente').length;
  const vencidos=baseList.filter(p=>!p.resuelto&&p.fechaLimite&&p.fechaLimite<hoy2).length;
  const resueltos=baseList.filter(p=>p.resuelto).length;
  // Stats row removed — always show activos only
  // Filtro de prioridad/estado
  let l=baseList.filter(p=>{
    if(filtroP==='activos')return!p.resuelto;
    if(filtroP==='resuelto')return p.resuelto;
    if(filtroP==='urgente')return!p.resuelto&&p.prioridad==='urgente';
    if(filtroP==='medio')return!p.resuelto&&p.prioridad==='medio';
    if(filtroP==='normal')return!p.resuelto&&p.prioridad==='normal';
    if(filtroP==='vencidos')return!p.resuelto&&p.fechaLimite&&p.fechaLimite<hoy2;
    return true;
  }).filter(p=>!q||(p.texto||'').toLowerCase().includes(q)||(p.obs||'').toLowerCase().includes(q)||(p.carpeta||'').includes(q));
  const el=$('listaPend');
  if(!l.length){
    const msgSec = filtroSeccion!=='todas' ? ' en la sección "'+filtroSeccion.charAt(0).toUpperCase()+filtroSeccion.slice(1)+'"' : '';
    el.innerHTML='<div style="color:var(--muted);padding:32px;text-align:center;font-size:0.76rem;">✓ Sin pendientes en este filtro'+msgSec+'</div>';
    return;
  }
  const priColor={'urgente':'#c0161a','medio':'#b07010','normal':'#1a7a3a'};
  const priBg={'urgente':'rgba(192,22,26,0.08)','medio':'rgba(176,112,16,0.09)','normal':'rgba(26,122,58,0.08)'};
  const priDot={'urgente':'#c0161a','medio':'#d4900a','normal':'#1a9a4a'};
  el.innerHTML=l.map(p=>{
    const idx=D.pendientes.indexOf(p);
    const priLabel={'urgente':'Urgente','medio':'Medio','normal':'Normal'}[p.prioridad]||p.prioridad;
    const col=priColor[p.prioridad]||'var(--muted)';
    const bg=priBg[p.prioridad]||'transparent';
    const dot=priDot[p.prioridad]||'#888';
    let fechaHtml='';
    if(p.fechaLimite){
      let vencida=p.fechaLimite<hoy2, hoyF=p.fechaLimite===hoy2;
      let fclr=vencida?'#c0161a':hoyF?'#b07010':'var(--muted)';
      let ficon=vencida?'⚠':'📅'; let flbl=vencida?('Vencido '+p.fechaLimite):hoyF?'Hoy':p.fechaLimite;
      fechaHtml=`<span style="font-size:0.65rem;color:${fclr};font-family:monospace;">${ficon} ${flbl}</span>`;
    }
    const altaHtml=p.fechaCreacion?`<span style="font-size:0.63rem;color:var(--muted);font-family:monospace;">Alta: ${p.fechaCreacion}</span>`:'';
    const carpHtml=p.carpeta?`<span style="font-size:0.63rem;background:rgba(200,149,42,0.1);color:var(--gold-d);border-radius:3px;padding:1px 5px;">🗂 #${esc(p.carpeta)}</span>`:'';
    const catHtml=p.categoria?`<span style="font-size:0.63rem;background:rgba(100,100,200,0.08);color:#446;border-radius:3px;padding:1px 5px;">${esc(p.categoria)}</span>`:'';
    // Sección — solo se muestra el chip cuando estamos en vista "todas" (en otras vistas la sección ya es la del filtro)
    const _secInfo = { placas:{ico:'🚗',lbl:'Placas',c:'#1a4a8a',bg:'rgba(26,74,138,0.1)'}, escrituras:{ico:'📄',lbl:'Escrituras',c:'#7a4a00',bg:'rgba(122,74,0,0.08)'}, juicios:{ico:'⚖️',lbl:'Juicios',c:'#5a1a6a',bg:'rgba(90,26,106,0.1)'}, otros:{ico:'🗂',lbl:'Otros',c:'#555',bg:'rgba(0,0,0,0.05)'} };
    const _secAct = _seccionDe(p);
    const secHtml = (filtroSeccion === 'todas' && _secInfo[_secAct]) ? `<span style="font-size:0.63rem;background:${_secInfo[_secAct].bg};color:${_secInfo[_secAct].c};border-radius:3px;padding:1px 6px;font-weight:700;">${_secInfo[_secAct].ico} ${_secInfo[_secAct].lbl}</span>` : '';

    // ── INFO ESPECÍFICA DE PLACAS ─────────────────────────────────
    let placasInfoHtml = '';
    if (_secAct === 'placas') {
      const _tipoLbl = {
        'alta':               'Alta',
        'baja':               'Baja',
        'cambio_propietario': 'Cambio prop.',
        'tarjeta_circulacion':'Tarjeta circ.',
        'reemplacamiento':    'Reemplacamiento'
      };
      const chips = [];
      if (_tipoLbl[p.tipoVehicular]) chips.push(`<span style="font-size:9.5px;background:rgba(26,74,138,0.1);color:#0c447c;border-radius:3px;padding:1px 6px;font-family:monospace;font-weight:700;">🚗 ${_tipoLbl[p.tipoVehicular]}</span>`);
      if (p.placasEstado)     chips.push(`<span style="font-size:9.5px;background:#f1efe8;color:#444441;border-radius:3px;padding:1px 6px;font-family:monospace;">📍 ${esc(p.placasEstado)}</span>`);
      if (p.placasNumero)     chips.push(`<span style="font-size:9.5px;background:#faeeda;color:#633806;border-radius:3px;padding:1px 6px;font-family:monospace;font-weight:700;"># ${esc(p.placasNumero)}</span>`);
      if (p.reciboVinculadoFolio) chips.push(`<span style="font-size:9.5px;background:rgba(26,122,58,0.08);color:#27500a;border-radius:3px;padding:1px 6px;font-family:monospace;cursor:pointer;" onclick="event.stopPropagation();_irAReciboVinculado('${esc(String(p.reciboVinculadoFolio))}')" title="Abrir recibo">🧾 #${esc(folioFormato(p.reciboVinculadoFolio))}</span>`);
      if (p.vehMarca||p.vehClase) chips.push(`<span style="font-size:9.5px;background:#f1efe8;color:#444441;border-radius:3px;padding:1px 6px;font-family:monospace;">${esc(((p.vehMarca||'')+' '+(p.vehClase||'')).trim())}</span>`);
      const docsArr = p.documentos||[];
      const docsHtml = docsArr.map(d=>{
        const nm=d.nombre||d||'doc'; const lbl=nm.length>18?nm.substring(0,18)+'…':nm;
        return `<span style="font-size:9.5px;background:#f7f0dc;border:1px solid #d4b870;border-radius:4px;padding:2px 7px;color:#633806;cursor:pointer;display:inline-flex;align-items:center;gap:3px;" onclick="event.stopPropagation();abrirPendiente(${idx})" title="${esc(nm)}">📄 ${esc(lbl)}</span>`;
      }).join('');
      const adjuntarBtn = `<span style="font-size:9.5px;border:1px dashed #c8952a;border-radius:4px;padding:2px 7px;color:#8c6518;cursor:pointer;display:inline-flex;align-items:center;gap:3px;" onclick="event.stopPropagation();_placasAdjuntarDoc(${idx})">+ Adjuntar</span>`;
      placasInfoHtml = `<div style="margin-top:6px;">${chips.length?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px;">${chips.join('')}</div>`:''}<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;align-items:center;"><span style="font-size:9px;font-family:monospace;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8c6518;margin-right:2px;">Docs:</span>${docsHtml}${adjuntarBtn}</div></div>`;
    }

    // ── INFO ESPECÍFICA DE ESCRITURAS ─────────────────────────────
    let escInfoHtml = '';
    if (_secAct === 'escrituras' && (p.escComprador || p.escEtapa || (p.escDocumentos||[]).length)) {
      const _etapaLbl = {
        'firma_libro_notario':       { ico:'📝', txt:'Firma libro Notario' },
        'tramite_catastro':          { ico:'🏛', txt:'Trámite catastro'   },
        'pago_traslado_municipal':   { ico:'💰', txt:'Pago traslado mun.' },
        'pago_isr':                  { ico:'📋', txt:'Pago ISR'           },
        'registro_publico_propiedad':{ ico:'🏠', txt:'Registro propiedad' },
        'en_notaria':                { ico:'🔏', txt:'En Notaría'         },
        'esperando_cedula':          { ico:'📄', txt:'Esperando cédula'   },
        'listo_para_entregar':       { ico:'✅', txt:'Listo para entregar' }
      };
      const e = _etapaLbl[p.escEtapa];
      const etapaChip = e ? `<span style="font-size:0.63rem;background:rgba(122,74,0,0.12);color:#7a4a00;border-radius:3px;padding:2px 7px;font-weight:700;">${e.ico} ${e.txt}</span>` : '';
      const compradorChip = p.escComprador ? `<span style="font-size:0.63rem;background:rgba(122,74,0,0.06);color:#7a4a00;border-radius:3px;padding:2px 6px;">🛒 ${esc(p.escComprador)}</span>` : '';
      const vendedorChip  = p.escVendedor ? `<span style="font-size:0.63rem;background:rgba(122,74,0,0.06);color:#7a4a00;border-radius:3px;padding:2px 6px;">📤 ${esc(p.escVendedor)}</span>` : '';
      const archivoChip = p.escArchivoFisico ? `<span style="font-size:0.63rem;background:rgba(0,0,0,0.05);color:var(--ink);border-radius:3px;padding:2px 6px;font-family:monospace;">📁 ${esc(p.escArchivoFisico)}</span>` : '';
      const folioChip = p.escFolio ? `<span style="font-size:0.63rem;background:rgba(200,149,42,0.13);color:#8c6518;border-radius:3px;padding:2px 6px;font-family:monospace;font-weight:700;">🔖 ${esc(p.escFolio)}</span>` : '';
      const volInsChip = (p.escVolumen || p.escInstrumento) ? `<span style="font-size:0.63rem;background:rgba(0,0,0,0.05);color:var(--ink);border-radius:3px;padding:2px 6px;font-family:monospace;">📚 V${esc(p.escVolumen||'—')} · I${esc(p.escInstrumento||'—')}</span>` : '';
      const notariaChip = p.escNotaria ? `<span style="font-size:0.63rem;background:rgba(0,0,0,0.04);color:var(--muted);border-radius:3px;padding:2px 6px;">🔏 ${esc(p.escNotaria.length>30 ? p.escNotaria.substring(0,30)+'…' : p.escNotaria)}</span>` : '';
      const docsChip = (p.escDocumentos||[]).length ? `<span style="font-size:0.63rem;background:rgba(122,74,0,0.08);color:#7a4a00;border-radius:3px;padding:2px 6px;cursor:pointer;" onclick="event.stopPropagation();abrirPendiente(${idx})" title="Ver documentos">📎 ${(p.escDocumentos||[]).length} archivo${(p.escDocumentos||[]).length===1?'':'s'}</span>` : '';
      // Financiero
      const costo = parseFloat(p.escCosto)||0;
      const cobrado = parseFloat(p.escCobrado)||0;
      const resto = costo > 0 ? (costo - cobrado) : null;
      let finRow = '';
      if (costo > 0) {
        const restoColor = resto <= 0 ? '#1a7a3a' : '#c0161a';
        const restoTxt = resto <= 0 ? '✅ LIQUIDADO' : `$${resto.toFixed(2)}`;
        finRow = `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;align-items:center;">
          <span style="font-size:0.63rem;background:rgba(26,122,58,0.08);color:#1a7a3a;border-radius:3px;padding:2px 7px;">💵 Total: $${costo.toFixed(2)}</span>
          <span style="font-size:0.63rem;background:rgba(26,122,58,0.06);color:#1a7a3a;border-radius:3px;padding:2px 6px;">✅ Cobrado: $${cobrado.toFixed(2)}</span>
          <span style="font-size:0.63rem;background:rgba(192,22,26,0.07);color:${restoColor};border-radius:3px;padding:2px 6px;font-weight:700;">⏳ Resta: ${restoTxt}</span>
          ${p.escServiciosComp ? `<span style="font-size:0.63rem;background:rgba(0,0,0,0.04);color:var(--muted);border-radius:3px;padding:2px 6px;">🔧 ${esc(p.escServiciosComp)}</span>` : ''}
        </div>`;
      }
      const descripcionLine = p.escDescripcion ? `<div style="font-size:0.74rem;color:var(--ink);margin-top:5px;line-height:1.45;">${esc(p.escDescripcion)}</div>` : '';
      const siguientePasoLine = p.escSiguientePaso ? `<div style="font-size:0.73rem;margin-top:6px;padding:6px 9px;background:rgba(200,149,42,0.08);border-left:3px solid var(--gold);border-radius:0 5px 5px 0;line-height:1.45;color:#6a4a00;"><strong style="font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;font-family:monospace;color:#8c6518;">🧭 Siguiente paso:</strong><br>${esc(p.escSiguientePaso)}</div>` : '';
      escInfoHtml = `<div style="background:rgba(122,74,0,0.04);border:1px solid rgba(122,74,0,0.12);border-radius:6px;padding:8px 10px;margin-top:7px;">
        <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">${etapaChip}${compradorChip}${vendedorChip}${archivoChip}${folioChip}${volInsChip}${notariaChip}${docsChip}</div>
        ${finRow}
        ${descripcionLine}
        ${siguientePasoLine}
      </div>`;
    }

    // ── INFO ESPECÍFICA DE JUICIOS ────────────────────────────────
    let juiInfoHtml = '';
    if (_secAct === 'juicios' && (p.juiCliente || p.juiExpediente || p.juiEtapa)) {
      const expChip = p.juiExpediente ? `<span style="font-size:0.63rem;background:rgba(90,26,106,0.12);color:#5a1a6a;border-radius:3px;padding:2px 7px;font-weight:700;font-family:monospace;">⚖️ ${esc(p.juiExpediente)}</span>` : '';
      const tipoChip = p.juiTipo ? `<span style="font-size:0.63rem;background:rgba(90,26,106,0.06);color:#5a1a6a;border-radius:3px;padding:2px 6px;">${esc(p.juiTipo)}</span>` : '';
      const etapaChip = p.juiEtapa ? `<span style="font-size:0.63rem;background:rgba(0,0,0,0.05);color:var(--ink);border-radius:3px;padding:2px 6px;">📊 ${esc(p.juiEtapa)}</span>` : '';
      const terminoChip = p.juiTermino ? `<span style="font-size:0.63rem;background:rgba(192,22,26,0.08);color:var(--rojo);border-radius:3px;padding:2px 6px;">⏰ ${esc(p.juiTermino)}</span>` : '';
      let audChip = '';
      if (p.juiAudiencia) {
        const audDate = String(p.juiAudiencia).replace('T',' ').substring(0,16);
        audChip = `<span style="font-size:0.63rem;background:rgba(176,112,16,0.08);color:#b07010;border-radius:3px;padding:2px 6px;font-family:monospace;">📅 ${esc(audDate)}</span>`;
      }
      const vincChip = (typeof p.juicioVinculadoIdx === 'number' && p.juicioVinculadoIdx >= 0) ? `<span style="font-size:0.63rem;background:rgba(26,122,58,0.08);color:var(--verde-d);border-radius:3px;padding:2px 6px;cursor:pointer;font-weight:700;" onclick="event.stopPropagation();_irAJuicio(${p.juicioVinculadoIdx})" title="Abrir en Control de Juicios">🔗 Control de Juicios</span>` : '';
      const descripcionLine = p.juiDescripcion ? `<div style="font-size:0.74rem;color:var(--ink);margin-top:4px;line-height:1.45;">${esc(p.juiDescripcion)}</div>` : '';
      juiInfoHtml = `<div style="background:rgba(90,26,106,0.04);border:1px solid rgba(90,26,106,0.12);border-radius:6px;padding:7px 10px;margin-top:7px;">
        <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">${expChip}${tipoChip}${etapaChip}${terminoChip}${audChip}${vincChip}</div>
        ${descripcionLine}
      </div>`;
    }
    return `<div style="display:flex;align-items:stretch;background:var(--surface,#fdfaf4);border:1.5px solid var(--border-l,#d4b870);border-radius:8px;margin-bottom:8px;overflow:hidden;opacity:${p.resuelto?'0.5':'1'};${p.resuelto?'filter:grayscale(0.3);':''}transition:box-shadow 0.15s,border-color 0.15s;">
      <div style="width:5px;background:${col};flex-shrink:0;"></div>
      <div style="padding:10px 5px 10px 8px;display:flex;align-items:flex-start;padding-top:12px;flex-shrink:0;">
        <div onclick="event.stopPropagation();toggleP(${idx})" title="${p.resuelto?'Reabrir':'Marcar resuelto'}" style="width:18px;height:18px;border-radius:50%;border:2px solid ${p.resuelto?'#1a7a3a':col};background:${p.resuelto?'#1a7a3a':'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:#fff;font-size:0.65rem;transition:all 0.15s;">${p.resuelto?'✓':''}</div>
      </div>
      <div style="flex:1;min-width:0;padding:10px 6px 10px 4px;">
        ${p.persona?`<div style="font-size:10px;font-weight:700;color:${col};font-family:monospace;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:2px;">👤 ${esc(p.persona)}</div>`:''}
        <div style="font-size:12.5px;font-weight:600;color:var(--ink,#1a1008);line-height:1.4;margin-bottom:5px;${p.resuelto?'text-decoration:line-through;':''}">${esc(p.texto)}</div>
        ${placasInfoHtml}
        ${escInfoHtml}
        ${juiInfoHtml}
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;align-items:center;">
          ${p.resp?`<span style="font-size:9px;background:rgba(0,0,0,0.05);border-radius:3px;padding:1px 6px;color:var(--muted);">👤 ${esc(p.resp)}</span>`:''}
          ${secHtml}${fechaHtml}${carpHtml}${catHtml}${altaHtml}
        </div>
        ${p.obs?`<div style="font-size:10px;color:#7a4a10;font-style:italic;margin-top:4px;padding:4px 8px;background:rgba(200,149,42,0.07);border-radius:4px;line-height:1.4;">${esc(p.obs)}</div>`:''}
        ${p.persona?_finResumen(p.persona, null):''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;padding:10px 10px 10px 4px;flex-shrink:0;gap:5px;">
        <div style="display:flex;align-items:center;gap:4px;background:${bg};border-radius:20px;padding:2px 8px;">
          <div style="width:6px;height:6px;border-radius:50%;background:${dot};flex-shrink:0;"></div>
          <span style="font-size:9.5px;font-weight:700;color:${col};letter-spacing:0.04em;">${priLabel}</span>
        </div>
        <div style="display:flex;gap:4px;">
          <button onclick="event.stopPropagation();_pendEstatus(${idx},this)" style="display:flex;align-items:center;gap:3px;background:transparent;border:1px solid #b5d4f4;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:9.5px;color:#1a4a8a;transition:background 0.15s;" onmouseover="this.style.background='#e6f1fb'" onmouseout="this.style.background='transparent'" title="Cambiar estatus">🔄 Estatus</button>
          <button onclick="event.stopPropagation();abrirPendiente(${idx})" style="display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid var(--border-l,#d4b870);border-radius:5px;padding:3px 7px;cursor:pointer;font-size:9.5px;color:var(--muted);transition:all 0.15s;" onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold)'" onmouseout="this.style.borderColor='var(--border-l,#d4b870)';this.style.color='var(--muted)'" title="Editar">✏</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
function _pendEstatus(idx, btn){
  const p = D.pendientes[idx];
  if(!p) return;
  // Eliminar menú previo si existe
  const prev = document.getElementById('_pend-estatus-menu');
  if(prev){ prev.remove(); if(prev._idx===idx) return; }
  const opciones = [
    {key:'en_tramite',   lbl:'En trámite',      bg:'#e6f1fb', col:'#0c447c'},
    {key:'esperando',    lbl:'Esperando docs',   bg:'#faeeda', col:'#633806'},
    {key:'pend_pago',    lbl:'Pendiente pago',   bg:'#fcebeb', col:'#791f1f'},
    {key:'entregado',    lbl:'Entregado',        bg:'#eaf3de', col:'#27500a'},
    {key:'cancelado',    lbl:'Cancelado',        bg:'#f1efe8', col:'#444441'}
  ];
  const menu = document.createElement('div');
  menu.id = '_pend-estatus-menu';
  menu._idx = idx;
  menu.style.cssText = 'position:fixed;z-index:9999;background:#fdfaf4;border:1.5px solid #d4b870;border-radius:8px;padding:6px;display:flex;flex-wrap:wrap;gap:4px;box-shadow:0 6px 20px rgba(0,0,0,0.15);max-width:260px;';
  opciones.forEach(o=>{
    const s = document.createElement('span');
    s.textContent = o.lbl;
    s.style.cssText = `font-size:9.5px;padding:3px 9px;border-radius:20px;cursor:pointer;font-weight:700;font-family:monospace;background:${o.bg};color:${o.col};border:1.5px solid ${p.estatusTramite===o.key?o.col:'transparent'};`;
    s.onclick = ()=>{ p.estatusTramite=o.key; save(); renderPend(); menu.remove(); toast('Estatus actualizado'); };
    menu.appendChild(s);
  });
  document.body.appendChild(menu);
  const r = btn.getBoundingClientRect();
  menu.style.top  = (r.bottom+6)+'px';
  menu.style.right = (window.innerWidth-r.right)+'px';
  const close = (e)=>{ if(!menu.contains(e.target)&&e.target!==btn){ menu.remove(); document.removeEventListener('click',close); } };
  setTimeout(()=>document.addEventListener('click',close),50);
}
function _placasAdjuntarDoc(idx){
  const p=D.pendientes[idx];if(!p)return;
  const inp=document.createElement('input');
  inp.type='file';inp.accept='.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';inp.multiple=true;
  inp.onchange=function(){
    if(!inp.files||!inp.files.length)return;
    if(!p.documentos)p.documentos=[];
    let pending=inp.files.length;
    Array.from(inp.files).forEach(file=>{
      const reader=new FileReader();
      reader.onloadend=function(){
        p.documentos.push({nombre:file.name,tipo:file.type,base64:reader.result});
        pending--;
        if(!pending){save();renderPend();toast('📎 Archivo'+(inp.files.length===1?'':'s')+' adjuntado'+(inp.files.length===1?'':'s'),'ok');}
      };
      reader.readAsDataURL(file);
    });
  };
  inp.click();
}
function toggleP(idx){
  const p=D.pendientes[idx];
  p.resuelto=!p.resuelto;
  if(p.resuelto)p.fechaResolucion=hoy(); else p.fechaResolucion='';
  save();renderPend();badges();syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
  toast(p.resuelto?'✅ Marcado como resuelto':'↩ Reabierto');
}

// ─── ABRIR MODAL PENDIENTE (nuevo o editar) ─────────────────────────────────
function abrirPendiente(idx){
  eiP = (idx !== undefined && idx >= 0) ? idx : -1;
  const p = eiP >= 0 ? D.pendientes[eiP] : null;
  const titulo = document.getElementById('mPendTitulo');
  const btnElim = document.getElementById('pBtnElim');
  if(titulo) titulo.textContent = p ? '✏ Editar Pendiente' : '📌 Nuevo Pendiente';
  if(btnElim) btnElim.style.display = p ? 'inline-flex' : 'none';
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
    else if(sec === 'escrituras'){
      const _s=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v||'';};
      _s('pEscComprador',p.escComprador);_s('pEscVendedor',p.escVendedor);
      _s('pEscArchivoFisico',p.escArchivoFisico);_s('pEscNotaria',p.escNotaria);
      _s('pEscVolumen',p.escVolumen);_s('pEscInstrumento',p.escInstrumento);
      _s('pEscFolio',p.escFolio);_s('pEscCosto',p.escCosto);
      _s('pEscCobrado',p.escCobrado);_s('pEscServiciosComp',p.escServiciosComp);
      _s('pEscEtapa',p.escEtapa);_s('pEscDesc',p.escDescripcion);
      _s('pEscSiguientePaso',p.escSiguientePaso);
    } else if(sec === 'juicios'){
      const _s=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v||'';};
      _s('pJuiCliente',p.juiCliente);_s('pJuiExpediente',p.juiExpediente);
      _s('pJuiEtapa',p.juiEtapa);_s('pJuiTermino',p.juiTermino);
      _s('pJuiAudiencia',p.juiAudiencia);_s('pJuiDesc',p.juiDescripcion);
    } else {
      const _s=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v||'';};
      _s('pOtrosNombre',p.persona);_s('pOtrosDesc',p.obs||p.texto);
    }
    const priEl=document.getElementById('pPri');if(priEl)priEl.value=p.prioridad||'normal';
    const reEl=document.getElementById('pRe');if(reEl)reEl.value=p.resp||'Antonieta';
    const fEl=document.getElementById('pFecha');if(fEl)fEl.value=p.fechaLimite||'';
    const cEl=document.getElementById('pCarpeta');if(cEl)cEl.value=p.carpeta||'';
  } else {
    _pPlacasLimpiar();
    ['pPri','pRe','pFecha','pCarpeta','pOtrosNombre','pOtrosDesc'].forEach(id=>{
      const e=document.getElementById(id);if(e)e.value = id==='pPri'?'normal':id==='pRe'?'Antonieta':'';
    });
  }
  const modal = document.getElementById('mPendiente');
  if(modal) modal.classList.add('show');
}

function guardarPend(){
  const sec = document.getElementById('pSec')?.value || 'otros';
  let especifico = {};
  if(sec === 'placas'){
    const d = _pPlacasRecopilar();
    if(!d.nombre){ toast('El nombre es obligatorio','err'); return; }
    if(!d.tipoVehicular){ toast('Selecciona el tipo de trámite','err'); return; }
    const _tipoTexto = {'alta':'Alta de placas','baja':'Baja de placas','cambio_propietario':'Cambio de propietario','tarjeta_circulacion':'Tarjeta de circulación','reemplacamiento':'Reemplacamiento'}[d.tipoVehicular]||'Trámite vehicular';
    especifico = {
      id: (eiP>=0 && D.pendientes[eiP]?.id) || ('P-'+Date.now()),
      texto: _tipoTexto + ' — ' + d.nombre.toUpperCase(),
      persona: d.nombre, seccion:'placas',
      tipoVehicular: d.tipoVehicular, placasEstado: d.placasEstado,
      placasNumero: d.placasNumero, descripcionPlacas: d.descripcionPlacas,
      reciboVinculadoFolio: d.reciboVinculadoFolio, documentos: d.documentos,
      prioridad: document.getElementById('pPri')?.value||'normal',
      resp: document.getElementById('pRe')?.value||'Antonieta',
      fechaLimite: document.getElementById('pFecha')?.value||'',
      carpeta: document.getElementById('pCarpeta')?.value.trim()||''
    };
  } else {
    const nombre = document.getElementById('pOtrosNombre')?.value.trim()||document.getElementById('pPersona')?.value.trim()||'';
    const desc   = document.getElementById('pOtrosDesc')?.value.trim()||document.getElementById('pTxt')?.value.trim()||'';
    if(!desc){ toast('La descripción es obligatoria','err'); return; }
    especifico = {
      id: (eiP>=0 && D.pendientes[eiP]?.id) || ('P-'+Date.now()),
      texto: desc, persona: nombre, seccion: sec,
      prioridad: document.getElementById('pPri')?.value||'normal',
      resp: document.getElementById('pRe')?.value||'Antonieta',
      fechaLimite: document.getElementById('pFecha')?.value||'',
      carpeta: document.getElementById('pCarpeta')?.value.trim()||'',
      obs: document.getElementById('pOb')?.value.trim()||''
    };
  }
  const prevP = eiP >= 0 ? D.pendientes[eiP] : null;
  const p = _construirPendienteBase(prevP, especifico);
  _persistirPendiente(p, sec==='placas'?'Pendiente de placas guardado ✓':'Pendiente guardado ✓');
}

// ─── DETALLE DE PENDIENTE (clic en la card) ─────────────────────────────────
function _verDetallePendiente(idx){
  const p = D.pendientes[idx];
  if(!p) return;
  const _tipoLbl = {
    'alta':'Alta de placas','baja':'Baja de placas',
    'cambio_propietario':'Cambio de propietario',
    'tarjeta_circulacion':'Tarjeta de circulación',
    'reemplacamiento':'Reemplacamiento'
  };
  const priColor={'urgente':'#c0161a','medio':'#b07010','normal':'#1a7a3a'};
  const priDot={'urgente':'#c0161a','medio':'#d4900a','normal':'#1a9a4a'};
  const col = priColor[p.prioridad]||'#888';
  const dot = priDot[p.prioridad]||'#888';
  const priLabel={'urgente':'🔴 Urgente','medio':'🟡 Medio','normal':'🟢 Normal'}[p.prioridad]||p.prioridad;

  const filaHtml = (ico,lbl,val) => val ? `<div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid rgba(212,184,112,0.18);align-items:flex-start;">
    <span style="font-size:0.75rem;flex-shrink:0;">${ico}</span>
    <span style="font-family:monospace;font-size:0.6rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8c6518;min-width:90px;flex-shrink:0;padding-top:2px;">${lbl}</span>
    <span style="font-size:0.78rem;color:#1a1008;line-height:1.45;white-space:pre-line;">${esc(String(val))}</span>
  </div>` : '';

  // Guardar resultado IA previo si existía
  const iaResEl = document.getElementById('ia-veh-res-'+idx);
  const iaPrev = iaResEl ? iaResEl.textContent : '';

  const html = `
  <div style="position:fixed;inset:0;background:rgba(10,8,4,0.65);z-index:8000;display:flex;align-items:center;justify-content:center;padding:16px;" id="_det-pend-ov" onclick="if(event.target===this)this.remove()">
    <div style="background:#fdfaf4;border:2px solid #d4b870;border-radius:14px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 16px 48px rgba(140,101,24,0.22);">
      <!-- Header -->
      <div style="padding:16px 20px 12px;border-bottom:1.5px solid #ecdfa8;background:linear-gradient(135deg,#fdfaf4,#f7f0dc);border-radius:12px 12px 0 0;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;position:sticky;top:0;z-index:1;">
        <div>
          <div style="font-family:monospace;font-size:0.55rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#8c6518;margin-bottom:4px;">📌 Detalle del Pendiente</div>
          <div style="font-family:serif;font-size:1.05rem;color:#1a1008;font-weight:500;line-height:1.3;">${esc(p.texto)}</div>
        </div>
        <button onclick="document.getElementById('_det-pend-ov').remove()" style="background:none;border:1.5px solid #d4b870;border-radius:8px;width:30px;height:30px;cursor:pointer;color:#8c6518;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;" onmouseover="this.style.background='rgba(200,149,42,0.1)'" onmouseout="this.style.background='none'">✕</button>
      </div>
      <!-- Body -->
      <div style="padding:16px 20px;">
        <!-- Prioridad badge -->
        <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,0.04);border-radius:20px;padding:4px 12px;margin-bottom:14px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${dot};"></div>
          <span style="font-size:0.68rem;font-weight:700;color:${col};letter-spacing:0.04em;">${priLabel}</span>
        </div>
        <!-- Datos -->
        <div style="background:#fff;border:1.5px solid rgba(212,184,112,0.4);border-radius:10px;padding:4px 14px;">
          ${filaHtml('👤','Persona',p.persona)}
          ${filaHtml('📂','Categoría',p.categoria||p.seccion)}
          ${p.tipoVehicular?filaHtml('🚗','Tipo',_tipoLbl[p.tipoVehicular]||p.tipoVehicular):''}
          ${p.placasEstado?filaHtml('🗺','Estado',p.placasEstado):''}
          ${p.placasNumero?filaHtml('🔢','Placa',p.placasNumero):''}
          ${p.reciboVinculadoFolio?filaHtml('🧾','Recibo','#'+folioFormato(p.reciboVinculadoFolio)):''}
          ${p.resp?filaHtml('👤','Responsable',p.resp):''}
          ${p.fechaCreacion?filaHtml('📅','Creado',p.fechaCreacion):''}
          ${p.fechaLimite?filaHtml('⏰','Límite',p.fechaLimite):''}
          ${p.carpeta?filaHtml('🗂','Carpeta','#'+p.carpeta):''}
          ${p.descripcionPlacas?filaHtml('📝','Descripción',p.descripcionPlacas):''}
          ${p.obs?filaHtml('💬','Notas',p.obs):''}
        </div>

      </div>
      <!-- Footer -->
      <div style="padding:12px 20px 16px;border-top:1.5px solid #ecdfa8;display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('_det-pend-ov').remove()" style="background:none;border:1.5px solid #d4b870;border-radius:8px;padding:8px 18px;cursor:pointer;font-family:monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:#8c6518;font-weight:700;" onmouseover="this.style.background='rgba(200,149,42,0.08)'" onmouseout="this.style.background='none'">Cerrar</button>
        <button onclick="document.getElementById('_det-pend-ov').remove();abrirPendiente(${idx})" style="background:linear-gradient(135deg,#8c6518,#c8952a);border:none;border-radius:8px;padding:8px 20px;cursor:pointer;font-family:monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:#fff;font-weight:700;" onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">✏ Editar</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

// Construir el objeto base preservando metadatos previos (resuelto, fechas, etc.)
function _construirPendienteBase(prevP, especifico){
  return Object.assign({
    prioridad: (prevP && prevP.prioridad) || 'normal',
    resp: (prevP && prevP.resp) || 'Antonieta',
    obs: (prevP && prevP.obs) || '',
    fechaLimite: (prevP && prevP.fechaLimite) || '',
    carpeta: (prevP && prevP.carpeta) || '',
    resuelto: prevP ? !!prevP.resuelto : false,
    fechaCreacion: (prevP && prevP.fechaCreacion) || hoy(),
    fechaResolucion: (prevP && prevP.fechaResolucion) || ''
  }, especifico);
}

// Guardar el pendiente (insertar/actualizar) y refrescar la UI
function _persistirPendiente(p, msg){
  if (eiP >= 0) D.pendientes[eiP] = p;
  else D.pendientes.unshift(p);
  cerrar('mPendiente');
  save(); syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); }); renderPend(); badges();
  toast((msg||'Pendiente guardado ✓') + ' — sincronizando...');
}
async function eliminarPend(){
  if(eiP<0)return;
  const p=D.pendientes[eiP];
  const ok = await confirmarBonito({
    titulo: 'Eliminar pendiente',
    mensaje: '"'+p.texto+'"\n\nEsta acción no se puede deshacer.',
    btnSi: 'Sí, eliminar',
    btnNo: 'Cancelar',
    peligro: true
  });
  if(!ok) return;
  D.pendientes.splice(eiP,1);
  cerrar('mPendiente');save();renderPend();badges();syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });toast('Pendiente eliminado');
}

// ═══════════════════════════════════════════════════════════════
// PENDIENTES DE PLACAS — bloque exclusivo del modal
// ═══════════════════════════════════════════════════════════════
// Estado en memoria mientras está abierto el modal de pendiente
let _pPlacasState = {
  tipo: '',                  // 'alta'|'baja'|'cambio_propietario'|'reemplacamiento'
  reciboFolio: '',           // folio de recibo vehicular vinculado
  documentos: []             // [{nombre, tipo, dataURL, fechaSubida, tamano}]
};

// Mostrar/ocultar bloques de sección — solo se muestra el bloque activo.
// Los campos genéricos (Tarea, Persona, Prioridad, Responsable, Fecha,
// Carpeta, Subcategoría, Observaciones) están siempre ocultos cuando hay
// un bloque especializado activo (todas las secciones tienen uno).
function pSecCambio(){
  const sec = document.getElementById('pSec')?.value || 'otros';
  const bloques = {
    'placas':     'pPlacasBloque',
    'escrituras': 'pEscBloque',
    'juicios':    'pJuiBloque',
    'otros':      'pOtrosBloque'
  };
  // Ocultar todos los bloques especializados
  Object.values(bloques).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Mostrar el de la sección activa
  const activo = document.getElementById(bloques[sec]);
  if (activo) activo.style.display = 'block';
  // Siempre ocultar genéricos y observaciones (todas las secciones tienen su propio bloque)
  const genericos = document.getElementById('pCamposGenericos');
  const obs = document.getElementById('pObsField');
  if (genericos) genericos.style.display = 'none';
  if (obs) obs.style.display = 'none';
  // Ajustar ancho del modal según sección
  const mi = document.getElementById('mPendienteInner');
  if (mi) mi.style.maxWidth = (sec === 'escrituras') ? '600px' : '480px';
}

// Cargar datos de placas desde un pendiente existente (al abrir modal en modo edición)
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

// Limpiar bloque placas (al crear nuevo)
function _pPlacasLimpiar(){
  _pPlacasState = { tipo:'', reciboFolio:'', documentos:[] };
  const ids = ['pPlacasNombre','pPlacasEstado','pPlacasNumero','pPlacasDesc','pPlacasReciboFolio'];
  ids.forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.querySelectorAll('#pPlacasTipoBtns .placas-tipo-btn').forEach(b => b.classList.remove('active'));
  _pPlacasActualizarInfoRecibo();
  _pPlacasRenderDocs();
}

// Recopilar datos del bloque placas al guardar
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

// Selector de tipo de trámite vehicular
function setPlacasTipo(tipo){
  _pPlacasState.tipo = tipo;
  document.querySelectorAll('#pPlacasTipoBtns .placas-tipo-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.tipo === tipo);
  });
}

// ── Vinculación con recibo vehicular ─────────────────────────────
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

  // Ordenar por folio descendente (más recientes arriba)
  filtrados.sort((a,b)=>(parseInt(b.folio)||0) - (parseInt(a.folio)||0));

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

function vincularReciboVehicular(folio){
  _pPlacasState.reciboFolio = folio;
  document.getElementById('pPlacasReciboFolio').value = '#'+folioFormato(folio);
  cerrar('mSelRecVeh');
  // Auto-llenar campos con datos del recibo
  const r = ((typeof appData !== 'undefined' ? appData : (typeof REC !== 'undefined' ? REC : {recibos:[]})).recibos || [])
    .find(x => String(x.folio) === String(folio));
  if (r) {
    // Auto-rellenar nombre del cliente del recibo si el campo está vacío
    const pNombre = document.getElementById('pPlacasNombre');
    if (pNombre && !pNombre.value.trim() && r.nombre) pNombre.value = r.nombre;
    // Auto-rellenar placa si está disponible y vacía
    const pNum = document.getElementById('pPlacasNumero');
    const placa = r.placa || r.placasEntregadas;
    if (pNum && !pNum.value.trim() && placa) pNum.value = placa;
    // Auto-rellenar estado si está disponible y vacío
    const pEst = document.getElementById('pPlacasEstado');
    if (pEst && !pEst.value && r.estadoPlacas) {
      // Verificar que sea una opción válida
      const opciones = Array.from(pEst.options).map(o => o.value);
      if (opciones.includes(r.estadoPlacas)) pEst.value = r.estadoPlacas;
    }
  }
  _pPlacasActualizarInfoRecibo();
  toast('Recibo vinculado ✓');
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

// ── Adjuntar documentos escaneados ───────────────────────────────
function pPlacasAdjuntar(event){
  const files = event.target.files;
  if (!files || !files.length) return;
  const MAX_BYTES = 5 * 1024 * 1024;  // 5 MB por archivo
  let agregados = 0, rechazados = 0;
  let pendientes = files.length;

  Array.from(files).forEach(file => {
    if (file.size > MAX_BYTES) {
      rechazados++;
      pendientes--;
      if (pendientes === 0) _pPlacasMostrarResultadoSubida(agregados, rechazados);
      return;
    }
    // Validar tipo
    const tiposValidos = ['image/png','image/jpeg','image/jpg','application/pdf'];
    if (!tiposValidos.includes(file.type)) {
      rechazados++;
      pendientes--;
      if (pendientes === 0) _pPlacasMostrarResultadoSubida(agregados, rechazados);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      _pPlacasState.documentos.push({
        nombre: file.name,
        tipo: file.type,
        tamano: file.size,
        fechaSubida: hoy(),
        dataURL: e.target.result
      });
      agregados++;
      pendientes--;
      _pPlacasRenderDocs();
      if (pendientes === 0) _pPlacasMostrarResultadoSubida(agregados, rechazados);
    };
    reader.onerror = () => {
      rechazados++;
      pendientes--;
      if (pendientes === 0) _pPlacasMostrarResultadoSubida(agregados, rechazados);
    };
    reader.readAsDataURL(file);
  });

  // Limpiar input para permitir re-subir el mismo archivo si el usuario lo borra y vuelve
  event.target.value = '';
}

function _pPlacasMostrarResultadoSubida(agregados, rechazados){
  if (rechazados > 0 && agregados > 0) {
    toast('✓ '+agregados+' adjuntado(s) · '+rechazados+' rechazado(s) (formato/tamaño)', 'err');
  } else if (rechazados > 0) {
    toast('⚠ Archivos rechazados: solo PDF/JPG/PNG hasta 5 MB', 'err');
  } else if (agregados > 0) {
    toast('✓ '+agregados+' archivo(s) adjuntado(s)');
  }
}

function _pPlacasFormatearTamano(bytes){
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}

function _pPlacasRenderDocs(){
  const cont = document.getElementById('pPlacasFilesList');
  const cnt  = document.getElementById('pPlacasFilesCount');
  if (!cont || !cnt) return;
  const docs = _pPlacasState.documentos;
  if (!docs.length) {
    cont.innerHTML = '';
    cnt.textContent = 'Ninguno adjunto';
    return;
  }
  cnt.textContent = docs.length + ' archivo(s) adjunto(s)';
  cont.innerHTML = docs.map((d, i) => {
    const ico = d.tipo === 'application/pdf' ? '📄' : '🖼';
    return '<div class="placas-doc-chip">' +
      '<span class="placas-doc-chip-ico">'+ico+'</span>' +
      '<div class="placas-doc-chip-info">' +
        '<div class="placas-doc-chip-nombre">'+esc(d.nombre)+'</div>' +
        '<div class="placas-doc-chip-meta">'+_pPlacasFormatearTamano(d.tamano||0)+' · '+esc(d.fechaSubida||'')+'</div>' +
      '</div>' +
      '<div class="placas-doc-chip-acciones">' +
        '<button type="button" class="placas-doc-chip-btn" onclick="pPlacasVerDoc('+i+')" title="Ver">👁</button>' +
        '<button type="button" class="placas-doc-chip-btn danger" onclick="pPlacasEliminarDoc('+i+')" title="Quitar">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function pPlacasVerDoc(i){
  const d = _pPlacasState.documentos[i];
  if (!d) return;
  const titulo = document.getElementById('docPreviewTitulo');
  const cont   = document.getElementById('docPreviewContenido');
  if (titulo) titulo.textContent = (d.tipo === 'application/pdf' ? '📄 ' : '🖼 ') + d.nombre;
  if (cont) {
    if (d.tipo === 'application/pdf') {
      cont.innerHTML = '<embed src="'+d.dataURL+'" type="application/pdf" style="width:100%;height:60vh;border:none;background:#fff;">';
    } else {
      cont.innerHTML = '<img src="'+d.dataURL+'" style="max-width:100%;max-height:65vh;border-radius:4px;background:#fff;" alt="'+esc(d.nombre)+'">';
    }
  }
  document.getElementById('mDocPreview').classList.add('show');
}

function pPlacasEliminarDoc(i){
  const d = _pPlacasState.documentos[i];
  if (!d) return;
  if (!confirm('¿Quitar el archivo "'+d.nombre+'" de este pendiente?')) return;
  _pPlacasState.documentos.splice(i,1);
  _pPlacasRenderDocs();
}

// Abrir el recibo vinculado en su panel (modo consulta)
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

// ═══════════════════════════════════════════════════════════════
// PENDIENTES DE ESCRITURAS — bloque exclusivo del modal
// ═══════════════════════════════════════════════════════════════
let _pEscState = { documentos: [] };

function _pEscCargar(p){
  _pEscState.documentos = Array.isArray(p && p.escDocumentos) ? p.escDocumentos.slice() : [];
  const _set = (id, val) => { const e = document.getElementById(id); if (e) e.value = val || ''; };
  _set('pEscComprador',     p && p.escComprador);
  _set('pEscVendedor',      p && p.escVendedor);
  _set('pEscArchivoFisico', p && p.escArchivoFisico);
  _set('pEscNotaria',       p && p.escNotaria);
  _set('pEscVolumen',       p && p.escVolumen);
  _set('pEscInstrumento',   p && p.escInstrumento);
  _set('pEscFolio',         p && p.escFolio);
  _set('pEscCosto',         p && p.escCosto);
  _set('pEscCobrado',       p && p.escCobrado);
  _set('pEscServiciosComp', p && p.escServiciosComp);
  _set('pEscSiguientePaso', p && p.escSiguientePaso);
  _set('pEscEtapa',         p && p.escEtapa);
  _set('pEscDesc',          p && p.escDescripcion);
  pEscActualizarResto();
  _pEscRenderDocs();
}

function _pEscLimpiar(){
  _pEscState = { documentos: [] };
  ['pEscComprador','pEscVendedor','pEscArchivoFisico','pEscNotaria','pEscVolumen','pEscInstrumento','pEscFolio','pEscCosto','pEscCobrado','pEscServiciosComp','pEscSiguientePaso','pEscEtapa','pEscDesc'].forEach(id=>{
    const e = document.getElementById(id); if (e) e.value = '';
  });
  const rEl = document.getElementById('pEscResto'); if(rEl) rEl.value = '';
  _pEscRenderDocs();
}

function _pEscRecopilar(){
  const costo   = parseFloat(document.getElementById('pEscCosto')?.value)||0;
  const cobrado = parseFloat(document.getElementById('pEscCobrado')?.value)||0;
  const resto   = costo - cobrado;
  return {
    escComprador:     document.getElementById('pEscComprador')?.value.trim() || '',
    escVendedor:      document.getElementById('pEscVendedor')?.value.trim() || '',
    escArchivoFisico: document.getElementById('pEscArchivoFisico')?.value.trim() || '',
    escNotaria:       document.getElementById('pEscNotaria')?.value.trim() || '',
    escVolumen:       document.getElementById('pEscVolumen')?.value.trim() || '',
    escInstrumento:   document.getElementById('pEscInstrumento')?.value.trim() || '',
    escFolio:         document.getElementById('pEscFolio')?.value.trim() || '',
    escCosto:         costo || '',
    escCobrado:       cobrado || '',
    escResto:         (costo > 0) ? resto : '',
    escServiciosComp: document.getElementById('pEscServiciosComp')?.value.trim() || '',
    escSiguientePaso: document.getElementById('pEscSiguientePaso')?.value.trim() || '',
    escEtapa:         document.getElementById('pEscEtapa')?.value || '',
    escDescripcion:   document.getElementById('pEscDesc')?.value.trim() || '',
    escDocumentos:    _pEscState.documentos.slice()
  };
}

// Calcula automáticamente el resto por cobrar
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

// Adjuntar archivos a Escritura — reusa la misma lógica de validación que Placas
function pEscAdjuntar(event){
  _pAdjuntarArchivos(event, _pEscState.documentos, _pEscRenderDocs);
}

function _pEscRenderDocs(){
  const cont = document.getElementById('pEscFilesList');
  const cnt  = document.getElementById('pEscFilesCount');
  if (!cont || !cnt) return;
  const docs = _pEscState.documentos;
  if (!docs.length) {
    cont.innerHTML = '';
    cnt.textContent = 'Ninguno adjunto';
    return;
  }
  cnt.textContent = docs.length + ' archivo(s) adjunto(s)';
  cont.innerHTML = docs.map((d, i) => {
    const ico = d.tipo === 'application/pdf' ? '📄' : '🖼';
    return '<div class="placas-doc-chip">' +
      '<span class="placas-doc-chip-ico">'+ico+'</span>' +
      '<div class="placas-doc-chip-info">' +
        '<div class="placas-doc-chip-nombre">'+esc(d.nombre)+'</div>' +
        '<div class="placas-doc-chip-meta">'+_pPlacasFormatearTamano(d.tamano||0)+' · '+esc(d.fechaSubida||'')+'</div>' +
      '</div>' +
      '<div class="placas-doc-chip-acciones">' +
        '<button type="button" class="placas-doc-chip-btn" onclick="pEscVerDoc('+i+')" title="Ver">👁</button>' +
        '<button type="button" class="placas-doc-chip-btn danger" onclick="pEscEliminarDoc('+i+')" title="Quitar">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function pEscVerDoc(i){ _pVerDoc(_pEscState.documentos[i]); }
function pEscEliminarDoc(i){
  const d = _pEscState.documentos[i];
  if (!d) return;
  if (!confirm('¿Quitar el archivo "'+d.nombre+'" de este pendiente?')) return;
  _pEscState.documentos.splice(i,1);
  _pEscRenderDocs();
}

// Autocompletado nombre comprador (busca clientes en cualquier recibo)
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
      <span style="font-family:monospace;font-size:0.6rem;color:#7a4a00;margin-left:8px;">Folio #${folioFormato(r.folio, r.anio_folio)}</span>
    </div>`;
  }).join('');
  sug.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════════
// PENDIENTES DE JUICIOS — bloque exclusivo del modal
// ═══════════════════════════════════════════════════════════════
let _pJuiState = { juicioIdx: -1 }; // índice del juicio en D.juicios al que se vincula

function _pJuiCargar(p){
  _pJuiState.juicioIdx = (p && typeof p.juicioVinculadoIdx === 'number') ? p.juicioVinculadoIdx : -1;
  const _set = (id, val) => { const e = document.getElementById(id); if (e) e.value = val || ''; };
  _set('pJuiCliente',    p && p.juiCliente);
  _set('pJuiExpediente', p && p.juiExpediente);
  const tipoEl = document.getElementById('pJuiTipo');
  if (tipoEl) tipoEl.value = (p && p.juiTipo) || 'Juicio Ordinario Civil';
  _set('pJuiEtapa',     p && p.juiEtapa);
  _set('pJuiTermino',   p && p.juiTermino);
  _set('pJuiAudiencia', p && p.juiAudiencia);
  _set('pJuiDesc',      p && p.juiDescripcion);
  _pJuiActualizarVinculacionUI();
}

function _pJuiLimpiar(){
  _pJuiState = { juicioIdx: -1 };
  ['pJuiCliente','pJuiExpediente','pJuiEtapa','pJuiTermino','pJuiAudiencia','pJuiDesc','pJuiExpedienteVinc'].forEach(id=>{
    const e = document.getElementById(id); if (e) e.value = '';
  });
  const tipoEl = document.getElementById('pJuiTipo');
  if (tipoEl) tipoEl.value = 'Juicio Ordinario Civil';
  _pJuiActualizarVinculacionUI();
}

function _pJuiRecopilar(){
  return {
    juicioVinculadoIdx: _pJuiState.juicioIdx,
    juiCliente:     document.getElementById('pJuiCliente')?.value.trim() || '',
    juiExpediente:  document.getElementById('pJuiExpediente')?.value.trim() || '',
    juiTipo:        document.getElementById('pJuiTipo')?.value || '',
    juiEtapa:       document.getElementById('pJuiEtapa')?.value.trim() || '',
    juiTermino:     document.getElementById('pJuiTermino')?.value.trim() || '',
    juiAudiencia:   document.getElementById('pJuiAudiencia')?.value || '',
    juiDescripcion: document.getElementById('pJuiDesc')?.value.trim() || ''
  };
}

function abrirSelectorJuicio(){
  document.getElementById('mSelJuicio').classList.add('show');
  document.getElementById('sjQ').value = '';
  renderSelectorJuicio();
}

function renderSelectorJuicio(){
  const q = (document.getElementById('sjQ')?.value || '').toLowerCase().trim();
  const cont = document.getElementById('sjLista');
  if (!cont) return;
  const juicios = D.juicios || [];
  if (!juicios.length) {
    cont.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:0.78rem;">No hay expedientes registrados todavía. Crea uno desde Control de Juicios.</div>';
    return;
  }
  const filtrados = juicios.filter(j => {
    if (!q) return true;
    return (j.cliente||'').toLowerCase().includes(q) ||
           (j.expediente||'').toLowerCase().includes(q) ||
           (j.tipo||'').toLowerCase().includes(q);
  });
  if (!filtrados.length) {
    cont.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:0.78rem;">Sin coincidencias.</div>';
    return;
  }
  cont.innerHTML = filtrados.map(j => {
    const idx = juicios.indexOf(j);
    const expBadge = j.expediente ? '<div class="srv-item-folio" style="background:rgba(90,26,106,0.1);color:#5a1a6a;">'+esc(j.expediente)+'</div>' : '';
    return '<div class="srv-item" onclick="vincularJuicio('+idx+')">' +
      expBadge +
      '<div class="srv-item-info">' +
        '<div class="srv-item-nombre">'+esc(j.cliente||'(Sin cliente)')+'</div>' +
        '<div class="srv-item-meta">' +
          (j.tipo ? esc(j.tipo) : '') +
          (j.juzgado ? ' · '+esc(j.juzgado) : '') +
          (j.estatus ? ' · ['+esc(j.estatus)+']' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function vincularJuicio(idx){
  _pJuiState.juicioIdx = idx;
  const j = D.juicios[idx];
  if (!j) return;
  // Auto-rellenar campos
  document.getElementById('pJuiCliente').value    = j.cliente || '';
  document.getElementById('pJuiExpediente').value = j.expediente || '';
  if (j.tipo) {
    const sel = document.getElementById('pJuiTipo');
    const opciones = Array.from(sel.options).map(o => o.value);
    if (opciones.includes(j.tipo)) sel.value = j.tipo;
    else sel.value = 'Otro';
  }
  if (j.audiencia && !document.getElementById('pJuiAudiencia').value) {
    document.getElementById('pJuiAudiencia').value = j.audiencia;
  }
  cerrar('mSelJuicio');
  _pJuiActualizarVinculacionUI();
  toast('Expediente vinculado ✓');
}

function pJuiDesvincular(){
  _pJuiState.juicioIdx = -1;
  _pJuiActualizarVinculacionUI();
}

function _pJuiActualizarVinculacionUI(){
  const inp  = document.getElementById('pJuiExpedienteVinc');
  const info = document.getElementById('pJuiInfo');
  const desv = document.getElementById('pJuiDesvincularBtn');
  if (!inp || !info || !desv) return;
  if (_pJuiState.juicioIdx < 0 || !D.juicios || !D.juicios[_pJuiState.juicioIdx]) {
    inp.value = '';
    info.style.display = 'none';
    desv.style.display = 'none';
    return;
  }
  const j = D.juicios[_pJuiState.juicioIdx];
  inp.value = (j.expediente||'') + ' — ' + (j.cliente||'');
  info.style.display = 'block';
  info.innerHTML = '<strong>'+esc(j.cliente||'(Sin cliente)')+'</strong>' +
    (j.tipo ? ' · '+esc(j.tipo) : '') +
    (j.juzgado ? ' · '+esc(j.juzgado) : '');
  desv.style.display = '';
}

// Navegar al detalle del juicio en Control de Juicios
function _irAJuicio(idx){
  if (typeof idx !== 'number' || idx < 0) return;
  ir('juicios');
  setTimeout(() => {
    if (typeof abrirDetalle === 'function') abrirDetalle(idx);
  }, 300);
}

// ═══════════════════════════════════════════════════════════════
// PENDIENTES DE OTROS — bloque exclusivo del modal
// ═══════════════════════════════════════════════════════════════
function _pOtrosCargar(p){
  const eN = document.getElementById('pOtrosNombre');
  const eD = document.getElementById('pOtrosDesc');
  if (eN) eN.value = (p && p.persona) || '';
  if (eD) eD.value = (p && (p.descripcionOtros || p.texto)) || '';
}

function _pOtrosLimpiar(){
  const eN = document.getElementById('pOtrosNombre');
  const eD = document.getElementById('pOtrosDesc');
  if (eN) eN.value = '';
  if (eD) eD.value = '';
}

function _pOtrosRecopilar(){
  return {
    nombre:     document.getElementById('pOtrosNombre')?.value.trim() || '',
    descripcion:document.getElementById('pOtrosDesc')?.value.trim() || ''
  };
}

// ═══════════════════════════════════════════════════════════════
// HELPERS COMPARTIDOS para adjuntar/ver documentos
// ═══════════════════════════════════════════════════════════════
function _pAdjuntarArchivos(event, lista, renderFn){
  const files = event.target.files;
  if (!files || !files.length) return;
  const MAX_BYTES = 5 * 1024 * 1024;
  let agregados = 0, rechazados = 0;
  let pendientes = files.length;

  Array.from(files).forEach(file => {
    if (file.size > MAX_BYTES) {
      rechazados++; pendientes--;
      if (pendientes === 0) _pPlacasMostrarResultadoSubida(agregados, rechazados);
      return;
    }
    const tiposValidos = ['image/png','image/jpeg','image/jpg','application/pdf'];
    if (!tiposValidos.includes(file.type)) {
      rechazados++; pendientes--;
      if (pendientes === 0) _pPlacasMostrarResultadoSubida(agregados, rechazados);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      lista.push({
        nombre: file.name, tipo: file.type, tamano: file.size,
        fechaSubida: hoy(), dataURL: e.target.result
      });
      agregados++; pendientes--;
      if (renderFn) renderFn();
      if (pendientes === 0) _pPlacasMostrarResultadoSubida(agregados, rechazados);
    };
    reader.onerror = () => {
      rechazados++; pendientes--;
      if (pendientes === 0) _pPlacasMostrarResultadoSubida(agregados, rechazados);
    };
    reader.readAsDataURL(file);
  });
  event.target.value = '';
}

function _pVerDoc(d){
  if (!d) return;
  const titulo = document.getElementById('docPreviewTitulo');
  const cont   = document.getElementById('docPreviewContenido');
  if (titulo) titulo.textContent = (d.tipo === 'application/pdf' ? '📄 ' : '🖼 ') + d.nombre;
  if (cont) {
    if (d.tipo === 'application/pdf') {
      cont.innerHTML = '<embed src="'+d.dataURL+'" type="application/pdf" style="width:100%;height:60vh;border:none;background:#fff;">';
    } else {
      cont.innerHTML = '<img src="'+d.dataURL+'" style="max-width:100%;max-height:65vh;border-radius:4px;background:#fff;" alt="'+esc(d.nombre)+'">';
    }
  }
  document.getElementById('mDocPreview').classList.add('show');
}

// ═══ PENDIENTE — autocompletado de nombre con folios ═══
function pPersonaInput(){
  const q=($('pPersona').value||'').trim().toLowerCase();
  const sug=document.getElementById('pPersonaSug');
  if(!sug) return;
  if(q.length < 2){ sug.style.display='none'; return; }
  // Buscar en recibos originales (no complementos)
  const src = (typeof appData!=='undefined'?appData:REC).recibos || [];
  // Agrupar por nombre: tomar el recibo más reciente por cliente
  const visto={};
  src.filter(r=>!r.esComplemento && r.nombre && r.nombre.toLowerCase().includes(q))
     .sort((a,b)=>b.folio-a.folio)
     .forEach(r=>{ if(!visto[r.nombre.toLowerCase()]) visto[r.nombre.toLowerCase()]=r; });
  const matches=Object.values(visto).slice(0,6);
  if(!matches.length){ sug.style.display='none'; return; }
  sug.innerHTML=matches.map(r=>`
    <div onclick="pSeleccionarPersona(${r.folio}, '${(r.nombre||'').replace(/'/g,"\\'")}', '${(r.tramites||r.conceptos&&r.conceptos[0]&&r.conceptos[0].descripcion||'').replace(/'/g,"\\'").substring(0,40)}')"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-l);font-size:0.8rem;transition:background 0.1s;"
      onmouseover="this.style.background='var(--gold-pale)'" onmouseout="this.style.background=''">
      <span style="font-weight:600;color:var(--ink);">${r.nombre}</span>
      <span style="font-family:monospace;font-size:0.6rem;color:var(--gold-d);margin-left:8px;">Folio #${folioFormato(r.folio, r.anio_folio)}</span>
      <div style="font-size:0.65rem;color:var(--muted);margin-top:2px;">${r.fecha||''} · ${(r.tramites||'')}</div>
    </div>`).join('');
  sug.style.display='block';
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
    info.textContent='#'+folioFormato(folio)+' · '+nombre+(r&&r.fecha?' · '+r.fecha:'');
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

// ══════════════════════════════════════════════════════════════════
// AUTOCOMPLETADO DE NOMBRE EN BLOQUE PLACAS
// Busca clientes en recibos vehiculares y al seleccionar uno auto-vincula el recibo.
// ══════════════════════════════════════════════════════════════════
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
      <span style="font-family:monospace;font-size:0.6rem;color:#1a4a8a;margin-left:8px;">Folio #${folioFormato(r.folio, r.anio_folio)}</span>
      <div style="font-size:0.65rem;color:var(--muted);margin-top:2px;">${esc(r.fecha||'')}${placa ? ' · 🔢 '+esc(placa) : ''}</div>
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

// ══════════════════════════════════════════════════════════════════
// BÚSQUEDA GLOBAL
// ══════════════════════════════════════════════════════════════════
let _gsTimer=null;
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
        sub: '#'+folioFormato(r.folio, r.anio_folio)+' · '+r.fecha+' · $'+fmt(r.anticipo||0),
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

function _gsClick(gi,idx){
  // Calcular índice real en _gsAcciones
  let total=0;
  const grupos={};
  (window._gsAcciones||[]).forEach(r=>{if(!grupos[r.tipo])grupos[r.tipo]=[];grupos[r.tipo].push(r);});
  const tiposEnOrden=Object.keys(grupos);
  const item=grupos[tiposEnOrden[gi]]?.[idx];
  if(item&&item.accion){
    globalSearchCerrar();
    item.accion();
  }
}

function globalSearchCerrar(){
  document.getElementById('global-search-results').classList.remove('show');
  document.getElementById('global-search-inp').value='';
}

function globalSearchKey(e){
  if(e.key==='Escape') globalSearchCerrar();
}

// Cerrar al hacer clic fuera
document.addEventListener('click',function(e){
  if(!document.getElementById('global-search-wrap').contains(e.target)){
    document.getElementById('global-search-results').classList.remove('show');
  }
});

// ══════════════════════════════════════════════════════════════════════
// BÚSQUEDA EN LENGUAJE NATURAL CON IA (Groq)
// Se activa escribiendo "?" al inicio del buscador global
// Ej: "? clientes con saldo pendiente", "? juicios urgentes"
// ══════════════════════════════════════════════════════════════════════
let _groqSearchTimer = null;

// Envolver globalSearch original para interceptar el modo "?"
const _globalSearchOriginal = globalSearch;
globalSearch = function(q) {
  q = (q || '').trim();
  if (q.startsWith('?') && q.length > 2) {
    document.getElementById('global-search-icon').textContent = '✨';
    clearTimeout(_groqSearchTimer);
    _groqSearchTimer = setTimeout(() => groqBuscarIA(q.slice(1).trim()), 600);
    return;
  }
  document.getElementById('global-search-icon').textContent = '🔍';
  _globalSearchOriginal(q);
};

async function groqBuscarIA(pregunta) {
  const res = document.getElementById('global-search-results');
  res.innerHTML = '<div class="gs-empty" style="color:rgba(139,92,246,0.7);">✨ Buscando con IA...</div>';
  res.classList.add('show');

  // Snapshot de datos del sistema (resumido para no exceder tokens)
  const snapshot = {
    recibos: (appData.recibos || []).map(r => ({
      folio: r.folio, nombre: r.nombre, fecha: r.fecha,
      total: r.total, saldoPendiente: r.saldoPendiente || 0,
      responsable: r.responsable || '', cancelado: r.cancelado || false
    })).slice(0, 80),
    juicios: (D.juicios || []).map(j => ({
      cliente: j.cliente, tipo: j.tipo, expediente: j.expediente,
      estatus: j.estatus, audiencia: j.audiencia, movimiento: j.movimiento
    })),
    pendientes: (D.pendientes || []).map(p => ({
      texto: p.texto, responsable: p.resp, prioridad: p.prioridad,
      resuelto: p.resuelto, fecha: p.fecha
    })),
    directorio: (D.directorio || []).map(d => ({
      nombre: d.nombre, tipo: d.tipo, tel: d.tel
    }))
  };

  const systemPrompt = `Eres un asistente de búsqueda para un despacho legal mexicano.
Recibirás datos del sistema (recibos, juicios, pendientes, directorio) y una pregunta en lenguaje natural.
Responde SOLO con un JSON válido con esta estructura exacta (sin markdown ni texto extra):
{
  "resultados": [
    { "tipo": "recibo|juicio|pendiente|directorio", "indice": 0, "titulo": "...", "razon": "..." }
  ],
  "explicacion": "Una frase breve explicando qué encontraste"
}
El campo "indice" es la posición en el array correspondiente (0-based).
Devuelve máximo 6 resultados relevantes. Si no hay resultados, devuelve array vacío.`;

  const userPrompt = `PREGUNTA: "${pregunta}"\n\nDATOS DEL SISTEMA:\n${JSON.stringify(snapshot)}`;

  try {
    // Usar _iaLlamar (Groq primero, Gemini como respaldo)
    const respuesta = await _iaLlamar(systemPrompt + '\n\n' + userPrompt, 800, 0.2);

    let parsed;
    try {
      parsed = JSON.parse(respuesta.replace(/```json|```/g, '').trim());
    } catch(e) {
      throw new Error('La IA devolvió un formato inesperado. Intenta reformular la pregunta.');
    }

    const items = parsed.resultados || [];
    if (!items.length) {
      res.innerHTML = `<div class="gs-empty">✨ ${esc(parsed.explicacion || 'Sin resultados para esa búsqueda.')}</div>`;
      return;
    }

    // Construir acciones para cada resultado
    const acciones = items.map(item => {
      let accion = () => {};
      if (item.tipo === 'recibo' && appData.recibos[item.indice]) {
        const r = appData.recibos[item.indice];
        accion = () => abrirPreviaDesdeContab(r.folio);
      } else if (item.tipo === 'juicio' && D.juicios[item.indice]) {
        accion = () => { ir('juicios'); setTimeout(() => abrirDetalle(item.indice), 150); };
      } else if (item.tipo === 'pendiente' && D.pendientes[item.indice]) {
        accion = () => { abrirPendiente(item.indice); };
      } else if (item.tipo === 'directorio' && D.directorio[item.indice]) {
        accion = () => { ir('directorio'); setTimeout(() => _abrirPerfilContacto(item.indice), 150); };
      }
      return { ...item, accion };
    });

    const iconos = { recibo: '🧾', juicio: '⚖️', pendiente: '📌', directorio: '👤' };
    let html = `<div class="gs-section"><div class="gs-section-title" style="color:rgba(139,92,246,0.8);">✨ ${esc(parsed.explicacion || 'Resultados IA')}</div>`;
    acciones.forEach((item, i) => {
      html += `<div class="gs-item" onclick="_groqGsClick(${i})">
        <div class="gs-item-icon">${iconos[item.tipo] || '📄'}</div>
        <div class="gs-item-main">
          <div class="gs-item-title">${esc(item.titulo)}</div>
          <div class="gs-item-sub" style="color:rgba(139,92,246,0.6);">${esc(item.razon)}</div>
        </div>
      </div>`;
    });
    html += '</div>';
    res.innerHTML = html;
    window._groqAcciones = acciones;

  } catch(e) {
    res.innerHTML = `<div class="gs-empty" style="color:var(--rojo);">⚠ ${esc(e.message)}</div>`;
  }
}

function _groqGsClick(i) {
  const item = (window._groqAcciones || [])[i];
  if (item && item.accion) {
    globalSearchCerrar();
    document.getElementById('global-search-icon').textContent = '🔍';
    item.accion();
  }
}
// ═══ FIN BÚSQUEDA IA ═══

// ══════════════════════════════════════════════════════════════
// RECORDATORIO DE TÉRMINOS — pantalla principal
// ══════════════════════════════════════════════════════════════
function renderVencimientos() {
  const hoy = new Date().toISOString().split('T')[0];
  const en7  = new Date(Date.now() + 7  * 86400000).toISOString().split('T')[0];
  const en30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  // Recopilar todos los términos vigentes (no cumplidos, fecha >= hoy)
  const proximosTodos = [];
  const hoyISO2 = new Date().toISOString().split('T')[0];
  (typeof D !== 'undefined' && D.juicios || []).forEach(j => {
    (j.terminos || []).forEach(t => {
      if (t.cumplido || !t.fecha) return;
      if (t.fecha < hoyISO2) return;        // ignorar vencidos en el recordatorio
      proximosTodos.push({
        fecha:       t.fecha,
        descripcion: t.descripcion || 'Sin descripción',
        tipo:        t.tipo || 'Otro',
        juicio:      j.cliente || j.nombre || '—',
        expediente:  j.expediente || '',
        diff:        Math.ceil((new Date(t.fecha + 'T12:00:00') - new Date()) / 86400000)
      });
    });
  });

  proximosTodos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // ── Actualizar tarjeta vencimientos próximos en panel principal ──
  const card    = document.getElementById('venc-card-wrap');
  const grupos  = document.getElementById('venc-grupos');
  const resumen = document.getElementById('venc-resumen');

  // Filtrar para la tarjeta: solo próximos 30 días (no vencidos)
  const paraCard = proximosTodos.filter(t => t.diff >= 0 && t.diff <= 30);

  if (card) {
    if (!paraCard.length) {
      card.style.display = 'none';
    } else {
      card.style.display = '';
      const vencidos  = paraCard.filter(t => t.diff < 0);
      const hoy7      = paraCard.filter(t => t.diff >= 0 && t.diff <= 7);
      const resto     = paraCard.filter(t => t.diff > 7);

      if (resumen) {
        const urgentes = vencidos.length + hoy7.length;
        resumen.textContent = urgentes > 0
          ? urgentes + ' urgente' + (urgentes > 1 ? 's' : '')
          : paraCard.length + ' próximo' + (paraCard.length > 1 ? 's' : '');
        resumen.style.color = urgentes > 0 ? 'var(--rojo,#c0161a)' : 'var(--amarillo,#9a6010)';
      }

      const renderGrupo = (titulo, items, color) => {
        if (!items.length) return '';
        return '<div style="margin-bottom:12px;">'
          + '<div style="font-family:monospace;font-size:0.55rem;text-transform:uppercase;letter-spacing:0.1em;color:'+color+';margin-bottom:6px;font-weight:700;">'+titulo+'</div>'
          + items.map(t => {
              const diffTxt = t.diff < 0 ? 'Venció hace '+Math.abs(t.diff)+'d'
                : t.diff === 0 ? 'HOY'
                : 'En '+t.diff+'d';
              return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(200,149,42,0.07);">'
                + '<span style="font-family:monospace;font-size:0.62rem;font-weight:700;color:'+color+';background:rgba(192,22,26,0.08);border-radius:5px;padding:1px 6px;flex-shrink:0;">'+diffTxt+'</span>'
                + '<div style="flex:1;min-width:0;">'
                + '<div style="font-size:0.75rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+t.descripcion+'</div>'
                + '<div style="font-size:0.6rem;color:var(--muted);">'+t.juicio+(t.expediente?' · Exp. '+t.expediente:'')+'</div>'
                + '</div></div>';
            }).join('')
          + '</div>';
      };

      grupos.innerHTML = renderGrupo('Vencidos', vencidos, '#c0161a')
        + renderGrupo('Esta semana', hoy7, '#9a6010')
        + renderGrupo('Este mes', resto, '#1a7a3a');
    }
  }

}

function badges(){
  const uj=D.juicios.filter(j=>j.estatus==='urgente').length;
  const up=D.pendientes.filter(p=>!p.resuelto&&p.prioridad==='urgente').length;
  const bj=$('badgeJ'),bp=$('badgeP');
  bj.textContent=uj||'';bj.style.display=uj?'':'none';
  bp.textContent=up||'';bp.style.display=up?'':'none';
}

// ═══ RELOJ ═══
function reloj(){
  try{
    const d=new Date();
    const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const hh=String(d.getHours()).padStart(2,'0');
    const mm=String(d.getMinutes()).padStart(2,'0');
    const ss=String(d.getSeconds()).padStart(2,'0');
    const hhmmss=hh+':'+mm+':'+ss;
    const fecha=dias[d.getDay()]+' '+d.getDate()+' de '+meses[d.getMonth()]+' de '+d.getFullYear();
    var elHora=document.getElementById('sHora');
    if(elHora) elHora.textContent=hhmmss;
    var elSub=document.getElementById('topSub');
    if(elSub) elSub.textContent=fecha;
    // Sincronizar hora en panel de recibo (tiempo real)
    var elHoraRecibo=document.getElementById('hora_recibo_display');
    if(elHoraRecibo) elHoraRecibo.textContent=hh+':'+mm+' hrs.';
    var elHoraHidden=$('hora_recibo');
    if(elHoraHidden && !document.body.classList.contains('recibo-frozen')) elHoraHidden.value=hh+':'+mm;
    var elFechaHidden=$('fecha_recibo');
    var elFechaDisplay=document.getElementById('fecha_recibo_display');
    if(elFechaHidden && !document.body.classList.contains('recibo-frozen') && !elFechaHidden.value){
      const yyyy=d.getFullYear(),mo=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');
      elFechaHidden.value=yyyy+'-'+mo+'-'+dd;
    }
    if(elFechaDisplay && !elFechaDisplay.textContent.trim()){
      const fd=new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
      elFechaDisplay.textContent=fd.charAt(0).toUpperCase()+fd.slice(1);
    }

  }catch(e){ registrarError('catch vacio', e); }
}

// ═══ PERSISTENCIA ═══

// ═══ REGISTRO DEDUPLICADO DE MOVIMIENTOS ═══
// Unica puerta de entrada para insertar movimientos en D.movimientos.
// Garantiza que nunca existan dos movimientos para el mismo folio+fecha+monto+fuente.
// Devuelve true si se inserto, false si ya existia (duplicado ignorado).
function _registrarMovimiento(mov) {
  if (!mov || !mov.id) return false;
  if (!Array.isArray(D.movimientos)) D.movimientos = [];
  // 1. Deduplicacion por ID exacto
  if (D.movimientos.some(m => m.id === mov.id)) {
    console.warn("[Dedup] Movimiento ya existe por ID:", mov.id);
    return false;
  }
  // 2. Deduplicacion por folio+fecha+monto+estatus (solo recibos)
  // Evita duplicados por doble-click, reconexion Drive, reimprimir, etc.
  if (mov.fuente === "recibo" && mov.folio != null) {
    const existe = D.movimientos.some(m =>
      !m.borrado &&
      m.fuente === "recibo" &&
      m.folio == mov.folio &&
      m.fecha === mov.fecha &&
      parseFloat(m.monto) === parseFloat(mov.monto) &&
      (m.estatus || "") === (mov.estatus || "")
    );
    if (existe) {
      console.warn("[Dedup] Recibo duplicado ignorado — folio:", mov.folio, "monto:", mov.monto);
      return false;
    }
  }
  D.movimientos.push(mov);
  return true;
}
function save(){
  // Marcar timestamp ANTES de subir para que postgres_changes lo ignore
  _ultimoSyncPropio = Date.now();
  syncEstadoSupabase().catch(function(e){ console.warn('[save]', e); });
}

// Función global para excluir folio de contabilidad (accesible desde consola)
window.lexExcluirFolioContabilidad = function(folioNum) {
  if (!D.recibosExcluidosCaja) D.recibosExcluidosCaja = [];
  // Guardar como string (normalizado) para comparación consistente
  var folioStr = String(folioNum);
  if (!D.recibosExcluidosCaja.map(String).includes(folioStr)) D.recibosExcluidosCaja.push(folioStr);
  if (typeof REC !== 'undefined' && REC.recibos) {
    REC.recibos = REC.recibos.filter(function(r){ return r && r.folio != folioNum; });
  }
  if (typeof appData !== 'undefined' && appData.recibos) {
    appData.recibos = appData.recibos.filter(function(r){ return r && r.folio != folioNum; });
  }
  D.movimientos = (D.movimientos||[]).filter(function(m){
    return !(m.fuente==='recibo' && m.folio==folioNum);
  });
  _ultimoSyncPropio = Date.now();
  syncEstadoSupabase().catch(function(e){ registrarError('Promise catch vacio', e); });
  if(typeof renderContab==='function') renderContab();
  if(typeof renderCaja==='function') renderCaja();
  if(typeof renderHistorial==='function') renderHistorial();
  if(typeof badges==='function') badges();
  console.log('✅ Folio '+folioNum+' excluido de contabilidad y sincronizado');
  if(typeof toast==='function') toast('✅ Folio '+folioNum+' eliminado de contabilidad', 'ok');
};

// ═══ FUNCIÓN UNIFICADA DE GUARDADO ═══
// Guarda el estado completo en Supabase (debounced)
// 8 veces en el código causando triples llamadas redundantes y race conditions.
// Esta función orquesta el guardado en el orden correcto y devuelve una promesa
// que resuelve cuando AMBOS archivos de Drive están actualizados.
async function guardarTodo() {
  // 1. localStorage primero (siempre rápido y nunca falla)
  try { backupLocal('D', D); } catch(e){ console.warn('backup D:', e); }
  // 2. Drive en paralelo (los dos archivos son independientes)
  if(!sbSession || Date.now() >= sbExpiry) return;
  const promesas = [];
  promesas.push(syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); }));
  await Promise.all(promesas);
}

// ═══ SISTEMA DE RESPALDOS LOCALES ROTATIVOS ═══
// Mantiene los últimos N respaldos de cada tipo de dato.
// Si Drive falla o algo se corrompe, se puede restaurar el último estado conocido.
// Los respaldos se guardan en localStorage con timestamp.
const BACKUP_MAX = 5;       // últimos 5 respaldos de cada tipo
const BACKUP_MIN_INTERVAL_MS = 30000; // mínimo 30s entre respaldos del mismo tipo
const _lastBackupTime = {};

function backupLocal(tipo, datos) {
  // No hacer backup si es muy reciente (evita saturar localStorage en cambios rápidos)
  const ahora = Date.now();
  if (_lastBackupTime[tipo] && (ahora - _lastBackupTime[tipo]) < BACKUP_MIN_INTERVAL_MS) {
    return;
  }
  _lastBackupTime[tipo] = ahora;

  try {
    const claveIndex = 'lex_backup_idx_' + tipo;
    const indexStr = localStorage.getItem(claveIndex);
    let index = indexStr ? JSON.parse(indexStr) : [];
    
    // Generar clave única con timestamp
    const claveBackup = 'lex_backup_' + tipo + '_' + ahora;
    
    // Guardar el respaldo
    try{ localStorage.setItem(claveBackup, JSON.stringify({
      tipo: tipo,
      timestamp: ahora,
      fecha: new Date(ahora).toISOString(),
      datos: datos
    })); } catch(e){ registrarError('localStorage.setItem', e); }
// Actualizar índice
    index.push({ clave: claveBackup, timestamp: ahora });
    
    // Mantener solo los últimos BACKUP_MAX
    while (index.length > BACKUP_MAX) {
      const viejo = index.shift();
      try { localStorage.removeItem(viejo.clave); } catch(e){ registrarError('catch vacio', e); }
    }
    
    try{ localStorage.setItem(claveIndex, JSON.stringify(index)); } catch(e){ registrarError('localStorage.setItem', e); }
} catch(e) {
    // Si localStorage está lleno, intentar limpiar respaldos viejos
    if (e.name === 'QuotaExceededError') {
      console.warn('localStorage lleno, limpiando respaldos viejos...');
      limpiarBackupsViejos();
    }
  }
}

function listarBackups(tipo) {
  try {
    const indexStr = localStorage.getItem('lex_backup_idx_' + tipo);
    if (!indexStr) return [];
    const index = JSON.parse(indexStr);
    return index.map(it => {
      try {
        const datos = JSON.parse(localStorage.getItem(it.clave));
        return { clave: it.clave, timestamp: it.timestamp, fecha: datos.fecha, datos: datos.datos };
      } catch(e) { return null; }
    }).filter(x => x !== null).sort((a,b) => b.timestamp - a.timestamp);
  } catch(e) { return []; }
}

function restaurarBackup(tipo, claveBackup) {
  try {
    const item = localStorage.getItem(claveBackup);
    if (!item) return null;
    return JSON.parse(item).datos;
  } catch(e) { return null; }
}

function limpiarBackupsViejos() {
  ['D','appData','recibos','juicios','pendientes','carpetas','directorio'].forEach(tipo => {
    try {
      const idx = JSON.parse(localStorage.getItem('lex_backup_idx_' + tipo) || '[]');
      // Mantener solo los 2 más recientes en emergencia
      while (idx.length > 2) {
        const viejo = idx.shift();
        try { localStorage.removeItem(viejo.clave); } catch(e){ registrarError('catch vacio', e); }
      }
      try{ localStorage.setItem('lex_backup_idx_' + tipo, JSON.stringify(idx)); } catch(e){ registrarError('localStorage.setItem', e); }
} catch(e){ registrarError('catch vacio', e); }
  });
}

function backupAppData() {
  if (typeof appData !== 'undefined' && appData && appData.recibos) {
    backupLocal('appData', {
      folioActual: appData.folioActual,
      recibos: appData.recibos
    });
  }
}
function saveCarpetas(){
  // Guardar solo el array de carpetas en el archivo dedicado en Drive
  syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
}
function load(){
  // Con Supabase activo la fuente de verdad es la nube — se ignora localStorage.
  // Solo se lee localStorage si NO hay sesión (modo offline de emergencia).
  if(sbSession && Date.now() < sbExpiry){
    // Hay sesión: limpiar D para que sincronizarFolio() lo pueble desde Supabase
    D.movimientos = [];
    D.directorio  = [];
    D.carpetas    = [];
    D.juicios     = [];
    D.pendientes  = [];
    D.cierres     = [];
    D.prestamos   = [];
    D.saldoAcumulado = 0;
    console.log('[load] Sesión activa — esperando datos de Supabase');
    return;
  }
  // Sin sesión: cargar desde localStorage como fallback de emergencia
  try{
    const s = localStorage.getItem('lex_app');
    if(s){
      const d = JSON.parse(s);
      D = {...D, ...d};
      if(typeof D.saldoAcumulado !== 'number') D.saldoAcumulado = 0;
      // Migrar pendientes legacy: marca/clase → vehMarca/vehClase
      (D.pendientes||[]).forEach(p=>{ if(p.seccion==='placas'){ if(!p.vehMarca&&p.marca) p.vehMarca=p.marca; if(!p.vehClase&&p.clase) p.vehClase=p.clase; } });
      // Sin sesión activa — usando datos locales de respaldo
    }
  }catch(e){ console.warn('load:', e); }
}

// ═══ DRIVE ═══
function driveChipClick() {
  if (sbSession && Date.now() < sbExpiry) {
    if (confirm('¿Cerrar sesión?\n\nLos datos locales se conservan. Solo se desconecta la sincronización en la nube.')) {
      sbSession = null; sbExpiry = 0;
      localStorage.removeItem('drive_token'); localStorage.removeItem('drive_expiry');
      actualizarAmbossBadges(false); toast('Sesión cerrada');
    }
  } else { iniciarAuth(); }
}
function calcSaldoRecibo(){
  var total=parsePrecioR((document.getElementById('r-total')||{}).value||'');
  var anticipo=parsePrecioR((document.getElementById('r-anticipo')||{}).value||'');
  var saldo=Math.max(0,total-anticipo);
  var el=document.getElementById('r-saldo');if(el)el.value=saldo>0?'$'+fmt(saldo):'—';
}
function actualizarFolioDisplayRecibo(){
  var el=document.getElementById('r-folio-display');
  if(el)el.textContent='#'+folioFormato(REC.folioActual||1);
}
function recAgregarCliente(){rClientes.push({nombre:'',telefono:'',direccion:''});renderClientesRecibo();}
function recAgregarConcepto(){rConceptos.push({descripcion:'',cantidad:1,precio:''});renderConceptosRecibo();}
function iniciarAuth(){
  // Versión Supabase: redirige al modal de login
  if(sbSession && Date.now() < sbExpiry){
    toast('Sesión activa ✓');
    actualizarAmbossBadges(true);
    return;
  }
  mostrarLoginSupabase();
}
function setBadge(ok){
  actualizarAmbossBadges(ok);
}
async function sync(){
  // En Supabase, "sincronizar" significa releer el estado completo
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  try {
    await sincronizarFolio();
    if(typeof renderCaja==='function') renderCaja();
    if(typeof renderRec==='function') renderRec();
    if(typeof renderContab==='function') renderContab();
    if(typeof badges==='function') badges();
    if(typeof actualizarStatsFI==='function') actualizarStatsFI();
    toast('Sincronización completa ✓');
    setTimeout(()=>{ if(typeof migrarConceptoCostosExtra==='function') migrarConceptoCostosExtra(); }, 200);
    setTimeout(()=>{ if(typeof migrarMovimientosRecibos==='function') migrarMovimientosRecibos(); }, 600);
    if(typeof FI !== 'undefined' && Array.isArray(D.prestamos)) FI.prestamos = D.prestamos;
  } catch(e){
    console.warn('sync:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SINCRONIZACIÓN UNIFICADA CON SUPABASE
// ═══════════════════════════════════════════════════════════════════
// Reemplaza todas las funciones save*Drive con una sola sincronización
// del estado completo (D + REC + folioActual) al app_state de Supabase.
let _syncDebounceTimer = null;
async function syncEstadoSupabase(){
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  // Prevenir llamadas concurrentes — si ya hay una en curso, usar debounce
  if(_syncEnCurso) {
    clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(()=>{ syncEstadoSupabase().catch((e)=>{ registrarError('Promise catch vacio', e); }); }, 500);
    return;
  }
  _syncEnCurso = true;
  syncStart();
  try {
    // Limpiar movimientos sintéticos antes de persistir
    const movsLimpios = (D.movimientos||[]).filter(m => m && m.id && !/^R-\d+$/.test(m.id));

    const estado = {
      movimientos:           movsLimpios,
      directorio:            D.directorio            || [],
      carpetas:              D.carpetas              || [],
      juicios:               D.juicios               || [],
      pendientes:            D.pendientes            || [],
      cierres:               D.cierres               || [],
      prestamos:             D.prestamos             || [],
      saldoAcumulado:        D.saldoAcumulado        || 0,
      escrituras:            D.escrituras            || [],
      recibosExcluidosCaja:  D.recibosExcluidosCaja  || [],
      captura_meses:         capturaMesCargar() || D.captura_meses || {}
    };

    const recibos = {
      folioActual: (typeof REC !== 'undefined' && REC.folioActual) ? REC.folioActual : (appData.folioActual || 100),
      recibos:     appData.recibos || []
    };

    const user = (await window.SB.auth.getUser()).data.user;
    const { error } = await window.SB
      .from('app_state')
      .update({
        data:         estado,
        recibos:      recibos,
        folio_actual: recibos.folioActual,
        updated_by:   user ? user.id : null
      })
      .eq('despacho_id', window.SB_DESPACHO_ID);

    if(error){
      throw new Error('syncEstadoSupabase: '+error.message);
    }
    _driveTimestampAlCargar = Date.now();
    _ultimoSyncPropio = Date.now();
    _syncEnCurso = false;
    syncEnd(true);
    lexRealtimeBroadcast();
    // Re-renderizar UI propia después de guardar exitosamente
    try { if(typeof renderCaja       ==='function') renderCaja();       } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof renderContab     ==='function') renderContab();     } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof renderHistorial  ==='function') renderHistorial();  } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof renderPend       ==='function') renderPend();       } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof renderVencimientos==='function') renderVencimientos(); } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof hjRenderTerminos ==='function') hjRenderTerminos(); } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof hjRenderLista    ==='function') hjRenderLista();    } catch(e){ registrarError('catch vacio', e); }
    try { if(typeof badges           ==='function') badges();           } catch(e){ registrarError('catch vacio', e); }
  } catch(e){
    console.warn('[SB] syncEstadoSupabase:', e);
    _syncEnCurso = false;
    syncEnd(false, e.message || 'Error al sincronizar');
  }
}

// Debounce: si hay varias llamadas en menos de 800ms, solo se ejecuta una
function syncEstadoSupabaseDebounced(){
  // Siempre retorna una Promise resuelta para que .catch((e)=>{ registrarError('Promise catch vacio', e); }) no explote
  if(_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(() => {
    syncEstadoSupabase().catch((e)=>{ registrarError('Promise catch vacio', e); });
  }, 800);
  return Promise.resolve();
}

// ─── Funciones save*Drive: ahora todas redirigen a la sync global ──────

// ═══ REALTIME — SINCRONIZACIÓN EN TIEMPO REAL ENTRE USUARIOS ═══
// Cuando cualquier usuario guarda, emite una señal en el canal "lex-sync".
// Todos los demás la reciben y descargan el estado fresco de Supabase.

let _lexRealtimeChannel = null;
let _ultimoSyncPropio = 0; // timestamp del último sync que nosotros iniciamos
let _syncEnCurso = false;  // previene llamadas concurrentes a syncEstadoSupabase
let _lexRealtimeUltimaRecarga = 0;
const _LEX_REALTIME_COOLDOWN = 800; // reducido a 800ms para sincronización casi instantánea

function lexRealtimeConectar() {
  if (!window.SB || !window.SB_DESPACHO_ID) return;
  if (_lexRealtimeChannel) return; // ya conectado

  const canal = 'lex-sync-' + window.SB_DESPACHO_ID;

  _lexRealtimeChannel = window.SB.channel(canal, {
    config: { broadcast: { self: false } } // no recibir los propios mensajes
  });

  _lexRealtimeChannel
    // ── BROADCAST: otro usuario guardó (self:false = nunca somos nosotros) ──
    .on('broadcast', { event: 'estado_actualizado' }, function(payload) {
      const ahora = Date.now();
      if (ahora - _lexRealtimeUltimaRecarga < _LEX_REALTIME_COOLDOWN) return;
      _lexRealtimeUltimaRecarga = ahora;
      const emisor = (payload.payload && payload.payload.usuario) || 'otro usuario';
      const emisorId = (payload.payload && payload.payload.userId) || null;
      // Ignorar si es nuestro propio broadcast (doble check con userId)
      if (emisorId && emisorId === window._miUserId) return;
      console.log('[Realtime] Broadcast de otro usuario:', emisor, '— sincronizando');
      // Broadcast de otro: siempre sincronizar sin ventana de tiempo
      if (_syncEnCurso) { setTimeout(_realtimeSincronizar, 2000); return; }
      sincronizarFolio().then(function() {
        if (typeof renderHistorial   === 'function') renderHistorial();
        if (typeof renderCaja        === 'function') renderCaja();
        if (typeof renderContab      === 'function') renderContab();
        if (typeof badges            === 'function') badges();
        if (typeof hjRenderTerminos  === 'function') try { hjRenderTerminos(); } catch(e){ registrarError('catch vacio', e); }
        if (typeof hjRenderLista     === 'function') try { hjRenderLista();    } catch(e){ registrarError('catch vacio', e); }
        if (typeof renderVencimientos=== 'function') safeExec('renderVencimientos', () => renderVencimientos());
        if (typeof renderPend        === 'function') safeExec('renderPend', () => renderPend());
        if (typeof renderJuicios     === 'function') safeExec('renderJuicios', () => renderJuicios());
        // Recargar config de captura retroactiva desde Supabase
        if (typeof capturaMesCargarSupabase === 'function') capturaMesCargarSupabase();
      }).catch(function(e){ registrarError('Promise catch vacio', e); });
    })
    // ── POSTGRES CHANGES: cambio en DB (llega a todos, incluyendo emisor) ──
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'app_state',
      filter: 'despacho_id=eq.' + window.SB_DESPACHO_ID
    }, function(payload) {
      const ahora = Date.now();
      if (ahora - _lexRealtimeUltimaRecarga < _LEX_REALTIME_COOLDOWN) return;
      _lexRealtimeUltimaRecarga = ahora;
      // Ignorar si fue nuestro propio cambio:
      // - updated_by coincide con nuestro ID, O
      // - updated_by es null pero guardamos hace menos de 15s (probablemente nuestro)
      const updatedBy = payload && payload.new && payload.new.updated_by;
      const ahoraRT = Date.now();
      const esMioCerto  = updatedBy && updatedBy === window._miUserId;
      const esMioProbable = !updatedBy && (ahoraRT - (_ultimoSyncPropio||0)) < 60000;
      if (esMioCerto || esMioProbable) {
        console.log('[Realtime] postgres_changes propio — ignorado');
        return;
      }
      console.log('[Realtime] postgres_changes de otro usuario — sincronizando');
      _realtimeSincronizar();
    })
    // ── Escuchar configuración retroactiva enviada por el admin ──
    .on('broadcast', { event: 'captura_meses_actualizada' }, function(payload) {
      if (!payload.payload || !payload.payload.cfg) return;
      // Ignorar si somos el admin (nosotros la enviamos)
      if (esAdministrador()) return;
      // Guardar en localStorage y re-renderizar barra
      try {
        try{ localStorage.setItem(CAPTURA_KEY, JSON.stringify(payload.payload.cfg)); } catch(e){ registrarError('localStorage.setItem', e); }
if (typeof renderBarraSecretariaCaptura === 'function') renderBarraSecretariaCaptura();
        if (typeof toast === 'function') toast('📅 Meses habilitados actualizados por el administrador', 'ok');
        console.log('[Realtime] captura_meses actualizada desde admin');
      } catch(e){ registrarError('catch vacio', e); }
    })
    .subscribe(function(status) {
      console.log('[Realtime] Estado canal:', status);
      if (status === 'SUBSCRIBED') lexPollingIniciar();
    });

  console.log('[Realtime] Conectado al canal:', canal);
}

// ── Sincronizar UI cuando llegan cambios de OTRO usuario ──────────────
function _realtimeSincronizar() {
  // Si hay sync propio en curso o fue reciente — esperar
  if (_syncEnCurso) {
    setTimeout(_realtimeSincronizar, 2000);
    return;
  }
  if ((Date.now() - (_ultimoSyncPropio||0)) < 60000) {
    console.log('[Realtime] Ignorando sincronizarFolio — sync propio reciente');
    // Solo re-renderizar con datos en memoria, sin bajar de Supabase
    if (typeof renderCaja    === 'function') renderCaja();
    if (typeof renderContab  === 'function') renderContab();
    if (typeof badges        === 'function') badges();
    return;
  }
  console.log('[Realtime] Sincronizando desde otro usuario...');
  sincronizarFolio().then(function() {
    if (typeof renderHistorial   === 'function') renderHistorial();
    if (typeof renderCaja        === 'function') renderCaja();
    if (typeof renderContab      === 'function') renderContab();
    if (typeof badges            === 'function') badges();
    if (typeof hjRenderTerminos  === 'function') try { hjRenderTerminos(); } catch(e){ registrarError('catch vacio', e); }
    if (typeof hjRenderLista     === 'function') try { hjRenderLista(); } catch(e){ registrarError('catch vacio', e); }
    if (typeof renderVencimientos=== 'function') safeExec('renderVencimientos', () => renderVencimientos());
  }).catch(function(e){ registrarError('Promise catch vacio', e); });
}

function lexRealtimeBroadcast() {
  if (!_lexRealtimeChannel) return;
  const usuario = empleadoActual ? empleadoActual.nombre : (NOMBRE_TITULAR || 'Usuario');
  _lexRealtimeChannel.send({
    type:    'broadcast',
    event:   'estado_actualizado',
    payload: { usuario: usuario, userId: window._miUserId || null, ts: Date.now() }
  }).catch(function(e){ registrarError('Promise catch vacio', e); });
}

function lexRealtimeDesconectar() {
  if (_lexRealtimeChannel) {
    window.SB.removeChannel(_lexRealtimeChannel);
    _lexRealtimeChannel = null;
    console.log('[Realtime] Desconectado');
  }
  if (_lexPollingTimer) { clearInterval(_lexPollingTimer); _lexPollingTimer = null; }
}

// ── Polling de respaldo: cada 30s sincroniza aunque no llegue broadcast ──
let _lexPollingTimer = null;
function lexPollingIniciar() {
  // Polling desactivado — causaba que sincronizarFolio sobreescribiera
  // cambios locales antes de que syncEstadoSupabase los subiera.
  // El Realtime (broadcast + postgres_changes) cubre la sincronización.
  console.log('[Polling] Desactivado — usando solo Realtime');
}
// ═══ FIN REALTIME ═══

// ══════════════════════════════════════════════════════════════════
// BACKUP DIARIO AUTOMÁTICO (ahora en Supabase Storage)
// ══════════════════════════════════════════════════════════════════
const BACKUP_KEY = 'lexmexico_ultimo_backup';

async function hacerBackupDiario(){
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  const hoyStr = (typeof hoy === 'function') ? hoy() : new Date().toISOString().slice(0,10);
  if(localStorage.getItem(BACKUP_KEY) === hoyStr) return;
  try {
    // Tomar el estado actual y subirlo como JSON al bucket de backups
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
    try{ localStorage.setItem(BACKUP_KEY, hoyStr); } catch(e){ registrarError('localStorage.setItem', e); }
console.log('✅ Backup diario creado en Supabase:', nombreBackup);
  } catch(e){ console.warn('backup diario:', e); }
}

async function forzarBackup(){
  if(!window.SB || !window.SB_DESPACHO_ID){ toast('Conecta tu sesión primero','err'); return; }
  toast('Creando backup...');
  localStorage.removeItem(BACKUP_KEY);
  await hacerBackupDiario();
  const hoyStr = (typeof hoy === 'function') ? hoy() : new Date().toISOString().slice(0,10);
  toast('✅ Backup creado en Supabase: lexmexico_backup_'+hoyStr+'.json');
}

// ══════════════════════════════════════════════════════════════════
// CONFLICTO DE EDICIÓN SIMULTÁNEA (ahora delegado a Supabase)
// ══════════════════════════════════════════════════════════════════
let _driveTimestampAlCargar = null;

async function obtenerTimestampDrive(){
  // En Supabase usamos el updated_at de app_state
  if(!window.SB || !window.SB_DESPACHO_ID) return null;
  try {
    const { data } = await window.SB
      .from('app_state')
      .select('updated_at')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .single();
    return data ? new Date(data.updated_at).getTime() : null;
  } catch(e){ return null; }
}

async function verificarConflicto(){
  // En Supabase, verificamos contra updated_at de app_state.
  // updated_by nos dice quién hizo el último cambio.
  if(!window.SB || !window.SB_DESPACHO_ID || !_driveTimestampAlCargar) return false;
  try {
    const { data } = await window.SB
      .from('app_state')
      .select('updated_at, updated_by')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .single();
    if(!data || !data.updated_at) return false;
    const tsActual = new Date(data.updated_at).getTime();
    if(tsActual !== _driveTimestampAlCargar){
      // Otro usuario modificó — obtener su nombre
      let quien = 'otro usuario';
      if(data.updated_by){
        const { data: m } = await window.SB
          .from('miembros')
          .select('nombre')
          .eq('user_id', data.updated_by)
          .eq('despacho_id', window.SB_DESPACHO_ID)
          .single();
        if(m && m.nombre) quien = m.nombre;
      }
      const cuando = new Date(data.updated_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
      return { quien, cuando };
    }
    return false;
  } catch(e){ return false; }
}

async function guardarConVerificacion(){
  // Verificar conflicto antes de cualquier guardado importante
  const conflicto = await verificarConflicto();
  if(conflicto){
    const msg = `⚠️ CONFLICTO DETECTADO\n\n${conflicto.quien} modificó los datos a las ${conflicto.cuando}.\n\n¿Qué deseas hacer?\n\n• ACEPTAR = Cargar la versión más reciente (perderás cambios locales)\n• CANCELAR = Guardar tu versión (sobrescribirá los cambios de ${conflicto.quien})`;
    if(confirm(msg)){
      // Cargar versión de Drive
      await sync();
      toast('✅ Versión más reciente cargada');
      return false; // No continuar con guardado
    }
  }
  return true; // Sin conflicto, continuar
}

// ═══ INIT ═══
window.onload=async function(){
  // ── INIT UI: selectores, fecha, formulario ───────────────────────────────
  // (código que estaba en el primer window.onload — ahora fusionado aquí)
  const sel = document.getElementById('anio');
  if(sel && sel.options.length <= 1){
    // <= 1: el HTML ya tiene el placeholder "—", solo agregar si no hay años aún
    if(sel.options.length === 0){ const op=document.createElement('option'); op.value=''; op.textContent='—'; sel.appendChild(op); }
    for(let y = new Date().getFullYear()+1; y>=1950; y--) {
      const o = document.createElement('option'); o.value=y; o.textContent=y; sel.appendChild(o);
    }
  }
  const selTen = document.getElementById('ultima_tenencia');
  if(selTen && selTen.options.length <= 1){
    // <= 1: el HTML ya tiene el placeholder "— Año —", solo agregar si no hay años aún
    if(selTen.options.length === 0){ const op=document.createElement('option'); op.value=''; op.textContent='— Año —'; selTen.appendChild(op); }
    const anioHoy = new Date().getFullYear();
    for(let y = anioHoy; y >= anioHoy - 10; y--) {
      const o = document.createElement('option'); o.value=y; o.textContent=y; selTen.appendChild(o);
    }
  }
  function aplicarFechaLocal(dt) {
    let yy, mm, dd, hh, mi, fechaISO, fechaStr;
    if(typeof horaSincOK !== 'undefined' && horaSincOK){
      const p = partesHoraCDMX();
      fechaISO = p.iso;
      const partesISO = p.iso.split('-');
      yy = partesISO[0]; mm = partesISO[1]; dd = partesISO[2];
      hh = p.hora.split(':')[0]; mi = p.hora.split(':')[1];
      fechaStr = new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(p.timestamp));
    } else {
      yy = dt.getFullYear();
      mm = String(dt.getMonth()+1).padStart(2,'0');
      dd = String(dt.getDate()).padStart(2,'0');
      hh = String(dt.getHours()).padStart(2,'0');
      mi = String(dt.getMinutes()).padStart(2,'0');
      fechaISO = yy+'-'+mm+'-'+dd;
      fechaStr = dt.toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    }
    $('fecha_recibo').value = fechaISO;
    $('hora_recibo').value  = hh+':'+mi;
    document.getElementById('fecha_recibo_display').textContent = fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1);
    document.getElementById('hora_recibo_display').textContent  = hh+':'+mi + ' hrs.';
  }
  aplicarFechaLocal(new Date());
  window._aplicarFechaLocal = aplicarFechaLocal;
  agregarCliente();
  agregarConcepto();
  actualizarFolioDisplay();
  generarQRPreview();
  renderHistorial();
  setTipoTramite('normal');
  const docsChecklist = document.getElementById('docs-checklist');
  if(docsChecklist){
    docsChecklist.addEventListener('change', function(e){
      if(e.target && e.target.type === 'checkbox') validarLimiteDocumentos(e.target);
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── INICIALIZAR SUPABASE Y VERIFICAR SESIÓN PERSISTENTE ─────────
  // load() se llama DESPUÉS de conocer si hay sesión:
  // - Con sesión: Supabase puebla D vía sincronizarFolio(), load() no se usa
  // - Sin sesión: load() carga el fallback offline desde localStorage
  try {
    await initSupabase();
    const { data: { session } } = await window.SB.auth.getSession();
    if(session && session.user){
      // Hay sesión activa — Supabase es la fuente de verdad, ignorar localStorage
      sbSession  = 'supabase-active-' + session.user.id;
      window._miUserId = session.user.id;
      sbExpiry = Date.now() + 1000*60*60*12;
      empleadoActual = {
        email:  session.user.email,
        nombre: EMPLEADOS[session.user.email.toLowerCase()] || session.user.email.split('@')[0]
      };
      try{ localStorage.setItem('empleado_email', empleadoActual.email); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('empleado_nombre', empleadoActual.nombre); } catch(e){ registrarError('localStorage.setItem', e); }
const _despachoRestaurado = await obtenerDespachoActivo();
      // Si no tiene membresía asignada, obtenerDespachoActivo ya cerró la sesión
      if(!_despachoRestaurado) return;
      actualizarAmbossBadges(true);
      await sincronizarFolio();
      // Mostrar botones según rol al restaurar sesión
      const _btnCS2 = document.getElementById('btn-cerrar-sesion'); if(_btnCS2) _btnCS2.style.display = 'block';
      const _esAdm2 = empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      setTimeout(lexRealtimeConectar, 1500);
      setTimeout(sesionesRegistrarLogin, 2000);
      console.log('[SB] Sesión restaurada para:', empleadoActual.nombre);
    } else {
      // Sin sesión — cargar datos locales como fallback offline
      sbSession = null;
      sbExpiry = 0;
      load(); // solo en modo offline
    }
  } catch(e){
    console.warn('[SB] init onload:', e);
    sbSession = null;
    sbExpiry = 0;
    load(); // error de conexión — intentar offline
  }
  renderSrvs();renderCaja();renderDir();badges();
  // PARCHE: migración hardcodeada del recibo #120 DESACTIVADA (causa pérdida de datos)
  setTimeout(()=>{ if(typeof migrarConceptoCostosExtra==='function') migrarConceptoCostosExtra(); }, 900);
  setTimeout(()=>{ if(typeof migrarMovimientosRecibos==='function') migrarMovimientosRecibos(); }, 1600);
  // Mostrar modal de login solo si no hay sesión activa
  setTimeout(()=>{
    if(!sbSession || Date.now()>=sbExpiry){
      mostrarLoginSupabase();
    }
  }, 800);
  initFI();actualizarStatsFI();
  setTimeout(mostrarAlertaFIStartup, 3500);
  verificarLogin();
  reloj();
  setInterval(reloj,1000);
  // Sync periódico a Supabase (cada 5 min)
  setInterval(()=>{
    if(!sbSession || Date.now()>=sbExpiry) return;
    const totalDatos = (D.movimientos||[]).length + (D.cierres||[]).length;
    if(totalDatos < 2){
      console.warn('[sync periódico] Saltado: D parece vacío o recién inicializado');
      return;
    }
    syncEstadoSupabaseDebounced();
  }, 5*60*1000);
  // Aplicar bloqueo si la caja ya fue cerrada hoy
  setTimeout(aplicarEstadoCierre, 200);
  // Inicializar sistema de recibos después del LEX
  if(typeof _idxInitRecibos === 'function') _idxInitRecibos();
};

// ═══ LOGO ═══
const LOGO_SRC = "data:image/jpeg;base64,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";