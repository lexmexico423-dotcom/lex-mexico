/* LEX-MÉXICO · Módulo directorio
 * Funciones extraídas sin modificar su contenido.
 */

async function guardarEnDirectorio(datos){
  // DESACTIVADO: el directorio ya no se llena automáticamente al generar recibos.
  // Ahora el directorio se gestiona únicamente de forma manual.
  console.log('[Directorio] Auto-fill desactivado. Usa el directorio manual.');
  return false;
}

function formatTelefono(input) {
  // Remove non-digits
  let digits = input.value.replace(/\D/g, '').slice(0, 10);
  // Format: XXX-XXX-XXXX
  let formatted = '';
  if (digits.length <= 3) {
    formatted = digits;
  } else if (digits.length <= 6) {
    formatted = digits.slice(0,3) + '-' + digits.slice(3);
  } else {
    formatted = digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
  }
  input.value = formatted;
}

function setDirF(f,el){filtroDT=f;document.querySelectorAll('#panel-directorio .fbtn').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderDir();}

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
    // Id + marca de tiempo — necesarios para el merge de sincronizarFolio()
    // (mismo fix que carpetas/escrituras/citas/pendientes/juicios). Los
    // contactos viejos sin id lo reciben aquí, en su primera edición.
    if(!c.id) c.id = 'CONT-'+Date.now();
    c.fechaMod = new Date().toISOString();
  } else {
    // Nuevo contacto
    const historial=[];
    if(tel) historial.push({tel,desde:hoy()});
    if(tel2&&tel2!==tel) historial.push({tel:tel2,desde:hoy()});
    D.directorio.unshift({
      id: 'CONT-'+Date.now(),
      fechaMod: new Date().toISOString(),
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
  _marcarContactoEliminadoLocal(c.id);
  D.directorio.splice(eiC,1);
  save();renderDir();cerrar('mContacto');toast('Contacto eliminado','ok');syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
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

function load(){
  // Supabase es la única fuente de verdad — localStorage eliminado definitivamente
  D.movimientos = [];
  D.directorio  = [];
  D.carpetas    = [];
  D.juicios     = [];
  D.pendientes  = [];
  D.cierres     = [];
  D.prestamos   = [];
  D.saldoAcumulado = 0;
  console.log('[load] Esperando datos de Supabase');
}

function recAgregarCliente(){rClientes.push({nombre:'',telefono:'',direccion:''});renderClientesRecibo();}

function initRecibo() {
  var now = new Date();
  var fEl = document.getElementById('r-fecha');
  var hEl = document.getElementById('r-hora');
  if (fEl) fEl.value = hoy();
  if (hEl) hEl.value = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  actualizarFolioDisplayRecibo();
  if (!rClientes.length) rClientes = [{nombre:'',telefono:'',direccion:''}];
  if (!rConceptos.length) rConceptos = [{descripcion:'',cantidad:1,precio:''}];
  renderClientesRecibo();
  renderConceptosRecibo();
  renderDocsRecibo();
  var selAnio = document.getElementById('v-anio');
  if (selAnio && !selAnio.options.length) {
    for (var y = new Date().getFullYear()+1; y >= 1960; y--) {
      selAnio.add(new Option(y,y));
    }
  }
  renderRecibosRecientes();
  setTimeout(generarQRRecibo, 300);
}

function nuevoReciboLimpio() {
  if (pendingNextFolioRecibo) { REC.folioActual=pendingNextFolioRecibo; pendingNextFolioRecibo=null; }
  rClientes=[{nombre:'',telefono:'',direccion:''}];
  rConceptos=[{descripcion:'',cantidad:1,precio:''}];
  lastPdfBlob=null;
  recTipoDoc='copia'; setTipoDocRecibo('copia');
  descongelarRecibo();
  actualizarFolioDisplayRecibo();
  renderClientesRecibo();
  renderConceptosRecibo();
  renderDocsRecibo();
  var obs=document.getElementById('r-obs'); if(obs) obs.value='';
  var tot=document.getElementById('r-total'); if(tot) tot.value='';
  var ant=document.getElementById('r-anticipo'); if(ant) ant.value='';
  var sal=document.getElementById('r-saldo'); if(sal) sal.value='';
  var veh=document.getElementById('r-vehiculo-activo'); if(veh) veh.checked=false;
  var vsec=document.getElementById('vehiculo-section'); if(vsec) vsec.style.display='none';
  var now=new Date();
  var fEl=document.getElementById('r-fecha'); if(fEl) fEl.value=hoy();
  var hEl=document.getElementById('r-hora'); if(hEl) hEl.value=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  generarQRRecibo();
  toast('Folio #'+folioFormato(REC.folioActual)+' listo');
}

function reiniciarSistema() {
  if (!confirm('ADVERTENCIA: Borrará TODOS los datos locales del sistema. Los datos en Supabase no se afectan. Continuar?')) return;
  if (!confirm('ULTIMA CONFIRMACION: Esta accion es irreversible. Confirmas el reinicio completo?')) return;
  D={movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],cierres:[]};
  REC={folioActual:1,recibos:[]};
  localStorage.removeItem('lex_app');
  localStorage.removeItem('drive_token');
  localStorage.removeItem('drive_expiry');
  save(); renderCaja(); renderConfig();
  toast('Sistema reiniciado. Recarga la pagina.','err');
}

function exportarDirectorioCSV(){
  const cols=['nombre','tipo','tel','tel2','desc','pob','email','rfc'];
  const headers=['Nombre Completo','Tipo/Relación','Tel. Principal','Tel. Alternativo','Descripción','Población','Correo','RFC'];
  const rows=[headers.join(','),...D.directorio.map(c=>cols.map(k=>{
    const v=(c[k]||'').replace(/"/g,'""');
    return v.includes(',')||v.includes('"')?`"${v}"`:v;
  }).join(','))];
  const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='Directorio_LEX_'+hoy()+'.csv';a.click();
  toast('Directorio exportado ✓','ok');
}

function _marcarContactoEliminadoLocal(id){
  if(!id) return;
  window._contactosEliminadosRecientemente = window._contactosEliminadosRecientemente || {};
  window._contactosEliminadosRecientemente[id] = Date.now();
}

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
