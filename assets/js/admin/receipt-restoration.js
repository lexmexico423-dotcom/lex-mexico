// ═══ RESTAURAR RECIBO ════════════════════════════════════════════════════════
// Flujo:
//   Paso 1 — ingresa folio → busca automáticamente en appData + backups locales
//   Paso 2 — si no encontrado: botón "Buscar PDF" (Supabase Storage /recibos/)
//             o "Buscar en Backups" (Supabase Storage /backups/ — snapshots JSON)
//             o subir PDF manualmente como último recurso
//   Confirmar → inserta en appData y sincroniza con Supabase
let _rgenFolio = 0;
let _rgenLetra = 'A';
let _rgenRec   = null;
function abrirRestaurarRecibo(){
  _rgenFolio = 0; _rgenLetra = 'A'; _rgenRec = null;
  const _folioElOpen = document.getElementById('rgen-folio');
  const _letraElOpen = document.getElementById('rgen-letra');
  // Asegurar que los inputs estén desbloqueados al abrir
  if(_folioElOpen){ _folioElOpen.value=''; _folioElOpen.readOnly=false; _folioElOpen.style.opacity=''; _folioElOpen.style.cursor=''; }
  if(_letraElOpen){ _letraElOpen.value='A'; _letraElOpen.disabled=false; _letraElOpen.style.opacity=''; }
  document.getElementById('rgen-paso1-msg').textContent = '';
  document.getElementById('rgen-err').textContent = '';
  document.getElementById('rgen-paso2').style.display = 'none';
  document.getElementById('rgen-paso1').style.display = 'block';
  document.getElementById('overlay-restaurar-recibo').style.display = 'flex';
  setTimeout(()=>document.getElementById('rgen-folio').focus(), 100);
}
function cerrarRestaurarRecibo(){
  document.getElementById('overlay-restaurar-recibo').style.display = 'none';
  _rgenFolio = 0; _rgenLetra = 'A'; _rgenRec = null;
  // ── Desbloquear inputs al cerrar ──
  const _fi = document.getElementById('rgen-folio');
  const _li = document.getElementById('rgen-letra');
  if(_fi){ _fi.readOnly=false; _fi.style.opacity=''; _fi.style.cursor=''; }
  if(_li){ _li.disabled=false; _li.style.opacity=''; }
}
function rgenCapturar(){
  // Abrir formulario vacío con el folio buscado — sin necesidad de PDF
  if(!_rgenFolio){ return; }
  const err = document.getElementById('rgen-err');
  if(err) err.textContent = '';
  const fs = typeof folioConLetra==='function' ? folioConLetra(_rgenFolio, null, _rgenLetra) : folioFormato(_rgenFolio);
  // Verificar que el folio no exista ya
  if(typeof appData!=='undefined' && Array.isArray(appData.recibos)){
    if(appData.recibos.some(r => r.folio===_rgenFolio && (r.letra||(typeof letraVersion==='function'?letraVersion(r):'A')||'A')===_rgenLetra)){
      if(err) err.textContent = '⚠ El folio #'+fs+' ya existe. Bórralo primero.';
      return;
    }
  }
  // Guardar datos de restauración con recibo vacío
  window._restauracionFolio = _rgenFolio;
  window._restauracionLetra = _rgenLetra;
  window._restauracionRec   = { folio: _rgenFolio, letra: _rgenLetra };
  window._restauracionFecha = '';
  // Recibo vacío para cargar en formulario
  const recCarga = {
    folio: _rgenFolio, letra: _rgenLetra,
    clientes: [{ nombre:'', movil:'', tel:'', domicilio:'' }],
    fecha_recibo: '', hora_recibo: '',
    tipoTramite: 'normal', tipo_doc: 'copia',
    copias: [], conceptos: [], anticipo: '0',
    responsable: '', tramites: '',
    clase:'', marca:'', tipo_veh:'', serie:'', motor:'',
    anio:'', puertas:'', color_veh:'', transmision:'',
    cilindros:'', placa:'', ultima_tenencia:'', origen:'', combustible:''
  };
  cerrarRestaurarRecibo();
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto();
  if(typeof ir==='function') ir('nuevo-recibo');
  setTimeout(()=>{
    if(typeof cargarReciboEnFormulario==='function') cargarReciboEnFormulario(recCarga);
    document.body.classList.remove('recibo-frozen','modo-actualizacion','modo-edicion-completa');
    document.body.classList.add('modo-restauracion');
    // ── Forzar visibilidad del formulario: si quedó 'modo-consulta' o el panel de
    //    búsqueda abierto de una acción previa, syncFormVisibility() habrá fijado
    //    #recibo-body con display:none !important inline, que ninguna regla CSS de
    //    modo-restauracion puede revertir. Limpiar ese estado residual aquí. ──
    document.body.classList.remove('modo-consulta','paneles-busqueda-abiertos');
    if(typeof _panelesBusquedaAbiertos !== 'undefined') _panelesBusquedaAbiertos = false;
    var _rbForce = document.getElementById('recibo-body');
    if(_rbForce) _rbForce.style.removeProperty('display');
    if(typeof syncFormVisibility === 'function') syncFormVisibility();
    const el = id => document.getElementById(id);    if(el('restauracion-folio-label')) el('restauracion-folio-label').textContent = '#'+fs;
    if(el('restauracion-fecha-label')) el('restauracion-fecha-label').textContent = '(edítala abajo)';
    if(el('btn-guardar-restauracion')) el('btn-guardar-restauracion').textContent = '🔄 Restaurar Recibo #'+fs;
    ['actions-normal','actions-consulta','actions-actualizacion','actions-post-print','actions-edicion-completa']
      .forEach(id=>{ const e=el(id); if(e) e.style.display='none'; });
    if(el('actions-restauracion')) el('actions-restauracion').style.display='flex';
    ['frozen-banner','consulta-banner','edicion-completa-banner']
      .forEach(id=>{ const e=el(id); if(e) e.style.display='none'; });
    if(el('restauracion-banner')) el('restauracion-banner').style.display='flex';
    document.querySelectorAll('#panel-nuevo-recibo input,#panel-nuevo-recibo select,#panel-nuevo-recibo textarea')
      .forEach(e=>{ e.disabled=false; e.style.pointerEvents=''; e.style.opacity=''; });
    // ── Inyectar fecha/hora retroactiva en el formulario ──
    const _rfecha = window._restauracionFecha || '';
    const _rhora  = window._restauracionRec?.hora_recibo || window._restauracionRec?.hora || '';
    if(_rfecha){
      const _fhEl = document.getElementById('fecha_recibo');
      const _fhDisp = document.getElementById('fecha_recibo_display');
      if(_fhEl){ _fhEl.value = _rfecha; }
      if(_fhDisp){
        try{
          const _fd = new Date(_rfecha+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
          _fhDisp.textContent = _fd.charAt(0).toUpperCase()+_fd.slice(1);
        }catch(e){ _fhDisp.textContent = _rfecha; }
      }
    }
    if(_rhora){
      const _horaEl = document.getElementById('hora_recibo');
      const _horaDisp = document.getElementById('hora_recibo_display');
      if(_horaEl) _horaEl.value = _rhora;
      if(_horaDisp) _horaDisp.textContent = _rhora + ' hrs.';
    }
    // ── Activar modo retroactivo para que la fecha sea editable ──
    window._reciboRetroactivoActivo = true;
    const _dispFechaR = document.getElementById('fecha_recibo_display');
    if(_dispFechaR){ _dispFechaR.style.borderBottom='2px dashed #5a3a8a'; _dispFechaR.style.color='#8b5cf6'; _dispFechaR.style.fontWeight='700'; _dispFechaR.title='Click para cambiar la fecha'; }
    const _dispHoraR = document.getElementById('hora_recibo_display');
    if(_dispHoraR){ _dispHoraR.style.color='#8b5cf6'; _dispHoraR.style.fontWeight='700'; }
    if(typeof setStatus==='function') setStatus('ok','Modo restauración — Folio #'+fs+' · Captura los datos · Click en la fecha para cambiarla','ok');
  }, 650);
}
function rgenVolverPaso1(){
  _rgenRec = null;
  // ── Desbloquear input de folio para que pueda editarse de nuevo ──
  const _folioInputUnlock = document.getElementById('rgen-folio');
  const _letraInputUnlock = document.getElementById('rgen-letra');
  if(_folioInputUnlock){ _folioInputUnlock.readOnly=false; _folioInputUnlock.style.opacity=''; _folioInputUnlock.style.cursor=''; }
  if(_letraInputUnlock){ _letraInputUnlock.disabled=false; _letraInputUnlock.style.opacity=''; }
  document.getElementById('rgen-paso2').style.display = 'none';
  document.getElementById('rgen-paso1').style.display = 'block';
  document.getElementById('rgen-paso1-msg').textContent = '';
}
// ── PASO 1: buscar folio ─────────────────────────────────────────────────────
function rgenBuscarFolio(){
  const msg = document.getElementById('rgen-paso1-msg');
  const folioVal = parseInt(document.getElementById('rgen-folio').value) || 0;
  const letraVal = (document.getElementById('rgen-letra')?.value || 'A').toUpperCase();
  if(!folioVal || folioVal < 1){
    msg.style.color = '#c0161a';
    msg.textContent = '⚠ Ingresa un número de folio válido.';
    return;
  }
  const fs = folioConLetra(folioVal, null, letraVal);
  if(typeof appData !== 'undefined' && Array.isArray(appData.recibos)){
    if(appData.recibos.some(r => r.folio === folioVal && (r.letra||(typeof letraVersion==='function'?letraVersion(r):'A')||'A') === letraVal)){
      msg.style.color = '#c0161a';
      msg.textContent = '⚠ El folio #'+fs+' ya está activo en el sistema.';
      return;
    }
  }
  _rgenFolio = folioVal;
  _rgenLetra = letraVal;
  // ── Bloquear input de folio para que no cambie accidentalmente en paso 2 ──
  const _folioInputLock = document.getElementById('rgen-folio');
  const _letraInputLock = document.getElementById('rgen-letra');
  if(_folioInputLock){ _folioInputLock.readOnly=true; _folioInputLock.style.opacity='0.7'; _folioInputLock.style.cursor='not-allowed'; }
  if(_letraInputLock){ _letraInputLock.disabled=true; _letraInputLock.style.opacity='0.7'; }
  // Buscar en respaldos locales (localStorage)
  const encontrado = _rgenBuscarEnRespaldos(folioVal, letraVal);
  document.getElementById('rgen-paso1').style.display = 'none';
  document.getElementById('rgen-paso2').style.display = 'block';
  document.getElementById('rgen-archivo-status').style.display = 'none';
  document.getElementById('rgen-preview').style.display = 'none';
  document.getElementById('rgen-err').textContent = '';
  _rgenDesactivarBtn();
  const banner = document.getElementById('rgen-resultado-banner');
  if(encontrado){
    _rgenRec = encontrado;
    banner.style.cssText = 'padding:12px 14px;border-radius:8px;margin-bottom:14px;font-size:0.78rem;font-weight:600;background:#e8f5ec;border:1.5px solid #1a7a3a;color:#0f5228;';
    banner.innerHTML = '✅ <strong>Folio #'+fs+' encontrado en respaldos locales.</strong><br>'
      +'<span style="font-weight:400;">Datos pre-cargados. Confirma para restaurar o busca el PDF en Supabase.</span>';
    _rgenMostrarPreview(encontrado);
    _rgenActivarBtn(fs);
  } else {
    banner.style.cssText = 'padding:12px 14px;border-radius:8px;margin-bottom:14px;font-size:0.78rem;font-weight:600;background:#fff8e8;border:1.5px solid #c8952a;color:#8c6518;';
    banner.innerHTML = '🔍 <strong>Folio #'+fs+' no encontrado localmente.</strong><br>'
      +'<span style="font-weight:400;">Busca el PDF en Supabase o en los backups diarios.</span>';
  }
}
// ── Busca en respaldos localStorage ─────────────────────────────────────────
function _rgenBuscarEnRespaldos(folioVal, letraVal){
  const letraBuscar = letraVal || 'A';
  if(typeof appData !== 'undefined'){
    if(Array.isArray(appData.recibos)){
      const r = appData.recibos.find(x => x.folio === folioVal && (x.letra||(typeof letraVersion==='function'?letraVersion(x):'A')||'A') === letraBuscar);
      if(r) return r;
    }
    if(appData.historialVersiones){
      const snaps = appData.historialVersiones[folioVal] || [];
      if(snaps.length) return snaps[snaps.length-1];
    }
  }
  try{
    const idx = JSON.parse(localStorage.getItem('lex_backup_idx_appData')||'[]');
    for(const it of [...idx].sort((a,b)=>b.timestamp-a.timestamp)){
      try{
        const obj = JSON.parse(localStorage.getItem(it.clave)||'null');
        const lista = obj?.datos?.recibos;
        if(Array.isArray(lista)){
          const r = lista.find(x => x.folio === folioVal && (x.letra||(typeof letraVersion==='function'?letraVersion(x):'A')||'A') === letraBuscar);
          if(r) return r;
        }
      }catch(e){ registrarError('catch vacio', e); }
    }
  }catch(e){ registrarError('catch vacio', e); }
  return null;
}
// ── BUSCAR EN SUPABASE: PDF o backups diarios ────────────────────────────────
let _rgenCandidatos = [];
let _rgenCandIdx    = 0;
let _rgenCandTipo   = '';
async function rgenAutoCargar(tipo){
  if(!_rgenFolio) return;
  const fs = folioFormato(_rgenFolio);
  const st = document.getElementById('rgen-archivo-status');
  st.style.display = 'block';
  st.style.cssText += ';display:block;padding:10px 12px;border-radius:7px;background:#f0f7ff;border:1.5px solid #b0c8f0;font-size:0.74rem;color:#1a4a8a;margin-bottom:14px;';
  st.textContent = '⏳ Buscando en Supabase…';
  rgenCandCerrar();
  document.getElementById('rgen-preview').style.display = 'none';
  _rgenDesactivarBtn();
  if(!window.SB || !window.SB_DESPACHO_ID){
    st.style.background='#fff8e8'; st.style.borderColor='#c8952a'; st.style.color='#8c6518';
    st.textContent = '⚠ Sin sesión activa. Conecta tu cuenta primero.';
    return;
  }
  try {
    if(tipo === 'pdf'){
      // Buscar en {despacho_id}/recibos/
      const prefix = window.SB_DESPACHO_ID + '/recibos';
      const { data: lista, error: errList } = await window.SB.storage.from(STORAGE_BUCKET).list(prefix, { limit: 1000 });
      if(errList) throw errList;
      const archivos = (lista||[]).filter(f => {
        if(!f.name || !f.name.toLowerCase().endsWith('.pdf')) return false;
        return f.name.includes('_'+fs+'_') || f.name.includes('_'+fs+'.') ||
               new RegExp('0*'+_rgenFolio+'[_\.]').test(f.name);
      });
      if(archivos.length === 0){
        st.style.background='#fff8e8'; st.style.borderColor='#c8952a'; st.style.color='#8c6518';
        st.textContent = '⚠ No se encontró PDF del folio #'+fs+' en Supabase. Prueba subir el archivo manualmente.';
        return;
      }
      st.textContent = '⏳ Descargando '+archivos.length+' PDF(s)…';
      const candidatos = [];
      for(const f of archivos){
        try {
          const path = prefix+'/'+f.name;
          const { data: blob, error: errDl } = await window.SB.storage.from(STORAGE_BUCKET).download(path);
          if(errDl || !blob) continue;
          const buf = await blob.arrayBuffer();
          const b64Raw = btoa(new Uint8Array(buf).reduce((s,b)=>s+String.fromCharCode(b),''));
          const dataUri = 'data:application/pdf;base64,'+b64Raw;
          let datos = null;
          if(typeof pdfjsLib !== 'undefined'){
            try{
              const pdf = await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
              let txt = '';
              for(let i=1;i<=pdf.numPages;i++){
                const pg = await pdf.getPage(i);
                const tc = await pg.getTextContent();
                txt += tc.items.map(it=>it.str).join(' ')+'\n';
              }
              datos = _rgenParsearPDF(txt);
            }catch(ePdf){}
          }
          const recibo = datos ? Object.assign({},datos,{pdfBase64:dataUri,archivo:f.name})
                                : {folio:_rgenFolio,pdfBase64:dataUri,archivo:f.name};
          candidatos.push({tipo:'pdf',nombre:f.name,recibo,dataUri});
        }catch(eDl){}
      }
      if(candidatos.length === 0){
        st.style.background='#fff0f0'; st.style.borderColor='#c0161a'; st.style.color='#c0161a';
        st.textContent = '❌ Se encontraron archivos pero falló la descarga.';
        return;
      }
      st.style.display='none';
      rgenCandAbrir('pdf', candidatos);
    } else {
      // tipo === 'backup': buscar en {despacho_id}/backups/ los snapshots JSON del app_state
      const prefix = window.SB_DESPACHO_ID + '/backups';
      const { data: lista, error: errList } = await window.SB.storage.from(STORAGE_BUCKET).list(prefix, { limit: 200 });
      if(errList) throw errList;
      const archivos = (lista||[]).filter(f => f.name && f.name.endsWith('.json'))
        .sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));
      if(archivos.length === 0){
        st.style.background='#fff8e8'; st.style.borderColor='#c8952a'; st.style.color='#8c6518';
        st.textContent = '⚠ No hay backups en Supabase. Prueba subir el PDF manualmente.';
        return;
      }
      st.textContent = '⏳ Revisando '+archivos.length+' backup(s)…';
      const candidatos = [];
      for(const f of archivos){
        try{
          const path = prefix+'/'+f.name;
          const { data: blob, error: errDl } = await window.SB.storage.from(STORAGE_BUCKET).download(path);
          if(errDl || !blob) continue;
          const txt = await blob.text();
          const obj = JSON.parse(txt);
          // Los backups tienen la estructura del app_state: {data:{...}, recibos:{recibos:[...]}}
          const lista2 = Array.isArray(obj?.recibos?.recibos) ? obj.recibos.recibos
            : (Array.isArray(obj?.recibos) ? obj.recibos
            : (Array.isArray(obj?.datos?.recibos) ? obj.datos.recibos : null));
          if(lista2){
            const rec = lista2.find(x => x && x.folio === _rgenFolio);
            if(rec){
              const fecha = f.created_at ? f.created_at.substring(0,10) : '';
              candidatos.push({tipo:'backup',nombre:'Backup '+fecha+' ('+f.name+')',recibo:rec});
            }
          }
        }catch(eFile){}
      }
      if(candidatos.length === 0){
        st.style.background='#fff8e8'; st.style.borderColor='#c8952a'; st.style.color='#8c6518';
        st.textContent = '⚠ Folio #'+fs+' no encontrado en ningún backup de Supabase.';
        return;
      }
      st.style.display='none';
      rgenCandAbrir('backup', candidatos);
    }
  }catch(e){
    console.warn('rgenAutoCargar:', e);
    st.style.background='#fff0f0'; st.style.borderColor='#c0161a'; st.style.color='#c0161a';
    st.textContent = '❌ Error: '+(e.message||e);
  }
}
function rgenCandAbrir(tipo, candidatos){
  _rgenCandTipo   = tipo;
  _rgenCandidatos = candidatos;
  _rgenCandIdx    = 0;
  document.getElementById('rgen-candidatos-box').style.display = 'block';
  rgenCandRender();
}
function rgenCandRender(){
  const total = _rgenCandidatos.length;
  if(total === 0){ rgenCandCerrar(); return; }
  if(_rgenCandIdx < 0) _rgenCandIdx = 0;
  if(_rgenCandIdx >= total) _rgenCandIdx = total-1;
  const c = _rgenCandidatos[_rgenCandIdx];
  document.getElementById('rgen-cand-nombre').textContent = c.nombre;
  document.getElementById('rgen-cand-pos').textContent = (_rgenCandIdx+1)+' de '+total;
  document.getElementById('rgen-cand-prev').style.opacity = total>1 ? '1':'0.3';
  document.getElementById('rgen-cand-next').style.opacity = total>1 ? '1':'0.3';
  const btnElim = document.getElementById('rgen-cand-eliminar');
  if(btnElim) btnElim.style.display = (c.tipo==='pdf' && total>1)?'inline-block':'none';
  const iframe  = document.getElementById('rgen-cand-iframe');
  const jsonBox = document.getElementById('rgen-cand-jsondata');
  if(c.tipo === 'pdf'){
    jsonBox.style.display = 'none';
    iframe.style.display = 'block';
    iframe.setAttribute('src', c.dataUri);
  } else {
    iframe.style.display = 'none';
    iframe.removeAttribute('src');
    jsonBox.style.display = 'block';
    const r = c.recibo;
    const fs = folioFormato(_rgenFolio);
    const nombre   = r.nombre||((r.clientes||[])[0]?.nombre)||'—';
    const fecha    = r.fecha_recibo||r.fecha||'—';
    const totalR   = typeof r.total!=='undefined' ? '$'+Number(r.total).toFixed(2) : '—';
    const anticipoR= r.anticipo ? '$'+Number(r.anticipo).toFixed(2) : '$0.00';
    const resp     = r.responsable||r.generadoPor||'—';
    const concepto = r.tramites||((r.conceptos||[])[0]?.concepto)||'—';
    jsonBox.innerHTML =
      '<div style="font-weight:700;font-size:0.86rem;color:#0f5228;margin-bottom:8px;">Folio #'+fs+'</div>'+
      '<div><strong>Cliente:</strong> '+escHTML(nombre)+'</div>'+
      '<div><strong>Fecha:</strong> '+fecha+'</div>'+
      '<div><strong>Trámite:</strong> '+escHTML(concepto)+'</div>'+
      '<div><strong>Total:</strong> '+totalR+'  ·  <strong>Anticipo:</strong> '+anticipoR+'</div>'+
      '<div><strong>Responsable:</strong> '+escHTML(resp)+'</div>'+
      (r.notas?'<div style="margin-top:6px;font-size:0.7rem;color:#666;"><em>'+String(r.notas).substring(0,150)+'</em></div>':'');
  }
}
function rgenCandNav(delta){
  if(_rgenCandidatos.length <= 1) return;
  _rgenCandIdx = (_rgenCandIdx+delta+_rgenCandidatos.length) % _rgenCandidatos.length;
  rgenCandRender();
}
function rgenCandUsar(){
  if(!_rgenCandidatos.length) return;
  const c = _rgenCandidatos[_rgenCandIdx];
  const fs = folioFormato(_rgenFolio);
  if(c.tipo === 'pdf'){
    const prev = _rgenRec || {};
    _rgenRec = Object.assign({},prev,{pdfBase64:c.recibo.pdfBase64,archivo:c.recibo.archivo,...c.recibo});
  } else {
    _rgenRec = Object.assign({},c.recibo);
  }
  const st = document.getElementById('rgen-archivo-status');
  st.style.display='block';
  st.style.background='#e8f5ec'; st.style.borderColor='#1a7a3a'; st.style.color='#0f5228';
  st.textContent = '✅ Seleccionado: "'+c.nombre+'"';
  _rgenMostrarPreview(_rgenRec);
  _rgenActivarBtn(fs);
  rgenCandCerrar();
}
async function rgenCandEliminar(){
  if(_rgenCandidatos.length < 2) return;
  const c = _rgenCandidatos[_rgenCandIdx];
  if(c.tipo !== 'pdf') return; // solo se eliminan PDFs de Storage
  if(!confirm('⚠ ¿Eliminar permanentemente "'+c.nombre+'" de Supabase Storage? Esta acción no se puede deshacer.')) return;
  if(!window.SB || !window.SB_DESPACHO_ID){ alert('⚠ Sin sesión Supabase.'); return; }
  try{
    const path = window.SB_DESPACHO_ID+'/recibos/'+c.nombre;
    const { error } = await window.SB.storage.from(STORAGE_BUCKET).remove([path]);
    if(error) throw error;
    _rgenCandidatos.splice(_rgenCandIdx,1);
    if(_rgenCandIdx >= _rgenCandidatos.length) _rgenCandIdx = _rgenCandidatos.length-1;
    if(_rgenCandidatos.length===0){ rgenCandCerrar(); } else { rgenCandRender(); }
  }catch(e){ alert('❌ Error al eliminar: '+(e.message||e)); }
}
function rgenCandCerrar(){
  document.getElementById('rgen-candidatos-box').style.display='none';
  const iframe = document.getElementById('rgen-cand-iframe');
  iframe.removeAttribute('src'); iframe.style.display='none';
  document.getElementById('rgen-cand-jsondata').style.display='none';
  _rgenCandidatos=[]; _rgenCandIdx=0;
}
// ── Subir PDF manualmente (fallback) ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// LECTOR DE PDF NATIVO — sin librería externa
// ───────────────────────────────────────────────────────────────────────────────
// Los PDFs generados por jsPDF comprimen sus streams de contenido con
// DEFLATE (filtro /FlateDecode). El texto no está en texto plano en el binario
// — está en los streams comprimidos. Este módulo:
//   1. Parsea la estructura del PDF (objetos indirectos, xref, streams)
//   2. Descomprime cada stream con DecompressionStream (API nativa del navegador)
//   3. Extrae strings de texto de los bloques BT/ET (operadores Tj, TJ, ')
//   4. Decodifica strings PDF (octal \ddd, hex <xx>, diferencias de encoding)
// ═══════════════════════════════════════════════════════════════════════════════
async function _pdfLeerTexto(arrayBuffer) {
  // ── 1. Slicing rápido del binario ─────────────────────────────────────────
  const bytes = new Uint8Array(arrayBuffer);
  // Convertir a latin-1 string para poder usar indexOf/substring
  // Solo usamos esta representación para localizar offsets; el contenido
  // de los streams lo manejamos como Uint8Array para descomprimir.
  const CHUNK = 32768;
  let raw = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    raw += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  // ── 2. Localizar y descomprimir todos los streams ─────────────────────────
  // Un stream PDF tiene la forma: << /Filter /FlateDecode ... >> stream\r\n...bytes...\r\nendstream
  const textoTotal = [];
  const streamRx = /<<([^>]{0,800}?)>>\s*stream\r?\n/g;
  let m;
  while ((m = streamRx.exec(raw)) !== null) {
    const dict   = m[1];
    const start  = m.index + m[0].length;
    // Longitud del stream
    const lenM = dict.match(/\/Length\s+(\d+)/);
    if (!lenM) continue;
    const streamLen = parseInt(lenM[1]);
    if (!streamLen || streamLen > 4000000) continue; // ignorar streams vacíos o enormes
    // Solo nos interesan streams de contenido de página (FlateDecode) o sin filtro
    const hasFlate  = /\/FlateDecode|\/Fl\b/.test(dict);
    const hasFilter = /\/Filter/.test(dict);
    // Ignorar streams de imagen, fuente, o metadatos
    if (/\/Subtype\s*\/Image|\/Type\s*\/XObject/.test(dict)) continue;
    const streamBytes = bytes.slice(start, start + streamLen);
    let texto = '';
    if (hasFlate) {
      try {
        texto = await _pdfDescomprimir(streamBytes);
      } catch (e) {
        continue; // stream corrupto o no es de texto
      }
    } else if (!hasFilter) {
      // Sin filtro — texto plano
      texto = String.fromCharCode.apply(null, streamBytes);
    } else {
      continue; // otro filtro (JPX, JBIG2, etc.) — ignorar
    }
    // Solo procesar si parece un stream de contenido de página (tiene BT o Tj)
    if (/\bBT\b/.test(texto) || /\bTj\b/.test(texto) || /\bTJ\b/.test(texto)) {
      textoTotal.push(texto);
    }
  }
  if (!textoTotal.length) return '';
  // ── 3. Extraer texto de operadores PDF ────────────────────────────────────
  return _pdfExtraerOperadores(textoTotal.join('\n'));
}
// ── Descomprime bytes DEFLATE usando DecompressionStream (nativa del navegador) ──
async function _pdfDescomprimir(compressedBytes) {
  // jsPDF usa zlib (DEFLATE con cabecera zlib de 2 bytes: 0x78 0x9C / 0x78 0xDA / 0x78 0x01)
  // DecompressionStream('deflate') espera raw DEFLATE.
  // DecompressionStream('deflate-raw') espera raw DEFLATE sin cabecera.
  // Detectar si hay cabecera zlib (CMF byte 0x78 = deflate con window 15)
  const hasZlibHeader = compressedBytes.length >= 2 &&
    compressedBytes[0] === 0x78 &&
    (compressedBytes[1] === 0x9C || compressedBytes[1] === 0xDA ||
     compressedBytes[1] === 0x01 || compressedBytes[1] === 0x5E);
  const format = hasZlibHeader ? 'deflate' : 'deflate-raw';
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(compressedBytes);
  writer.close();
  const chunks = [];
  let totalLen = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }
  // Reunir chunks en un solo Uint8Array y decodificar como latin-1
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  // Decodificar como Latin-1 (PDF usa Latin-1 por defecto para el contenido)
  let str = '';
  const CHUNK = 32768;
  for (let i = 0; i < result.length; i += CHUNK) {
    str += String.fromCharCode.apply(null, result.subarray(i, Math.min(i + CHUNK, result.length)));
  }
  return str;
}
// ── Extrae texto de los operadores PDF en streams ya descomprimidos ────────────
// Operadores relevantes:
//   (texto) Tj          — mostrar string
//   [(texto)(texto)] TJ — mostrar array de strings con ajustes de kern
//   (texto) '           — nueva línea + mostrar string
//   Tf                  — seleccionar fuente (ignorar contenido, capturar nombre)
function _pdfExtraerOperadores(content) {
  const tokens = [];
  // Tokenizar el stream PDF
  // Tokens: strings literales (...), strings hex <...>, números, nombres /xxx, operadores
  const tokenRx = /\((?:[^\\()]|\\.)*\)|<[0-9a-fA-F\s]*>|\[(?:[^\]])*\]|[-+]?\d+\.?\d*|\/[^\s\/\[\]<>()]+|[A-Za-z'"][A-Za-z_*"']*/g;
  let tm;
  while ((tm = tokenRx.exec(content)) !== null) {
    tokens.push(tm[0]);
  }
  const lines = [];
  let currentLine = '';
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    // Operador Tj: el token anterior es la string
    if (tok === 'Tj' || tok === "'") {
      const prev = tokens[i - 1] || '';
      const s = _pdfDecodeString(prev);
      if (s) currentLine += s;
      if (tok === "'") { lines.push(currentLine); currentLine = ''; }
      i++; continue;
    }
    // Operador TJ: el token anterior es un array [...] con strings y números
    if (tok === 'TJ') {
      const arrTok = tokens[i - 1] || '';
      if (arrTok.startsWith('[')) {
        // Extraer strings del array (números son ajustes de kern, negativos grandes = espacio)
        const arrContent = arrTok.slice(1, -1);
        const arrRx = /\((?:[^\\()]|\\.)*\)|<[0-9a-fA-F\s]*>|([-+]?\d+\.?\d*)/g;
        let am;
        while ((am = arrRx.exec(arrContent)) !== null) {
          if (am[1]) {
            // Número: kern negativo grande = separación de palabras
            if (parseFloat(am[1]) < -100) currentLine += ' ';
          } else {
            currentLine += _pdfDecodeString(am[0]);
          }
        }
      }
      i++; continue;
    }
    // ET (End Text) — fin de bloque de texto
    if (tok === 'ET') {
      if (currentLine.trim()) lines.push(currentLine.trim());
      currentLine = '';
      i++; continue;
    }
    // Td, TD, T*, Tm — nueva línea en el bloque de texto
    if (tok === 'Td' || tok === 'TD' || tok === 'T*' || tok === 'Tm') {
      if (currentLine.trim()) { lines.push(currentLine.trim()); currentLine = ''; }
      i++; continue;
    }
    i++;
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines.filter(Boolean).join('\n');
}
// ── Decodifica un token string PDF a texto legible ────────────────────────────
// Formatos: (texto con \n \t \ooo escapes) o <68657820737472696e67>
function _pdfDecodeString(tok) {
  if (!tok) return '';
  // String hexadecimal: <4865 6c6c 6f>
  if (tok.startsWith('<') && tok.endsWith('>')) {
    const hex = tok.slice(1, -1).replace(/\s/g, '');
    let s = '';
    for (let i = 0; i < hex.length; i += 2) {
      s += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return _pdfLatin1ToUtf8(s);
  }
  // String literal: (texto)
  if (tok.startsWith('(') && tok.endsWith(')')) {
    let s = tok.slice(1, -1);
    // Decodificar escapes PDF
    s = s.replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    s = s.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
    s = s.replace(/\\([()\\])/g, '$1');
    return _pdfLatin1ToUtf8(s);
  }
  return '';
}
// ── Convierte Latin-1 / Win-1252 a caracteres legibles ───────────────────────
// jsPDF embebe texto con encoding Win-1252/Latin-1. Los caracteres >= 0x80
// son caracteres especiales (ñ, á, é, etc.) en esa codificación.
function _pdfLatin1ToUtf8(s) {
  // Tabla de Win-1252 para bytes 0x80-0x9F (que Latin-1 no define)
  const win1252 = {
    0x80:'\u20AC',0x82:'\u201A',0x83:'\u0192',0x84:'\u201E',0x85:'\u2026',
    0x86:'\u2020',0x87:'\u2021',0x88:'\u02C6',0x89:'\u2030',0x8A:'\u0160',
    0x8B:'\u2039',0x8C:'\u0152',0x8E:'\u017D',0x91:'\u2018',0x92:'\u2019',
    0x93:'\u201C',0x94:'\u201D',0x95:'\u2022',0x96:'\u2013',0x97:'\u2014',
    0x98:'\u02DC',0x99:'\u2122',0x9A:'\u0161',0x9B:'\u203A',0x9C:'\u0153',
    0x9E:'\u017E',0x9F:'\u0178'
  };
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) { out += s[i]; }
    else if (win1252[c]) { out += win1252[c]; }
    else if (c >= 0xA0) { out += String.fromCharCode(c); } // Latin-1 directo
  }
  return out;
}
// ── Entry point: leer PDF y llamar al parser ─────────────────────────────────
async function rgenDesdeArchivo(input, tipo) {
  if (tipo !== 'pdf') return;
  const st = document.getElementById('rgen-archivo-status');
  st.style.display = 'block';
  st.style.background = '#f0f7ff'; st.style.borderColor = '#b0c8f0'; st.style.color = '#1a4a8a';
  st.textContent = '⏳ Leyendo y descomprimiendo PDF…';
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const buf  = await file.arrayBuffer();
  // Guardar base64 del PDF original
  const b64Raw = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''));
  const b64    = 'data:application/pdf;base64,' + b64Raw;
  if (!_rgenRec) _rgenRec = { folio: _rgenFolio };
  _rgenRec.pdfBase64 = b64;
  _rgenRec.archivo   = file.name || '';
  try {
    st.textContent = '⏳ Extrayendo texto del PDF…';
    const txt = await _pdfLeerTexto(buf);
    console.log('[LEX-PDF] Texto extraído (' + txt.length + ' chars):\n', txt.substring(0, 1000));
    if (txt.length > 20) {
      const datos = _rgenParsearPDF(txt);
      if (datos && (datos.nombre || datos.total || datos.fecha)) {
        datos.pdfBase64 = b64;
        datos.archivo   = file.name;
        _rgenRec = datos;
        const campos = [
          datos.nombre   ? '✓ Cliente'    : '— Cliente',
          datos.fecha    ? '✓ Fecha'      : '— Fecha',
          datos.total    ? '✓ Total'      : '— Total',
          datos.clase    ? '✓ Vehículo'   : '',
          datos.concepto || datos.tramites ? '✓ Concepto' : ''
        ].filter(Boolean).join(' · ');
        st.style.background  = '#e8f5ec';
        st.style.borderColor = '#1a7a3a';
        st.style.color       = '#0f5228';
        st.textContent = '✅ PDF leído — ' + campos;
        _rgenMostrarPreview(datos);
      } else {
        // Texto extraído pero el parser no encontró campos esperados
        _rgenRec.textoExtraido = txt;
        st.style.background  = '#fff8e8';
        st.style.borderColor = '#c8952a';
        st.style.color       = '#8c6518';
        st.textContent = '⚠ PDF leído pero no reconocido — completa los datos manualmente en el formulario.';
        _rgenMostrarPreview(_rgenRec);
      }
    } else {
      // PDF escaneado (imagen) — sin texto extraíble
      st.style.background  = '#fff8e8';
      st.style.borderColor = '#c8952a';
      st.style.color       = '#8c6518';
      st.textContent = '⚠ PDF escaneado (imagen) — no contiene texto digital. Completa los datos manualmente.';
      _rgenMostrarPreview(_rgenRec);
    }
  } catch (e) {
    console.error('[LEX-PDF] Error:', e);
    st.style.background  = '#fff0f0';
    st.style.borderColor = '#c0161a';
    st.style.color       = '#8a0a0a';
    st.textContent = '⚠ Error al leer el PDF: ' + (e.message || e) + ' — puedes continuar completando los datos manualmente.';
    _rgenMostrarPreview(_rgenRec);
  }
  _rgenActivarBtn(String(_rgenFolio).padStart(4, '0'));
}
function _rgenParsearPDF(txt) {
  // ── Parser semántico especializado para recibos LEX-MÉXICO ────────────────
  // El texto llega ya limpio de _pdfExtraerOperadores, una línea por elemento
  // visual del PDF. Las etiquetas y valores están en líneas separadas o en
  // la misma línea separados por espacio.
  const lineas = txt.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  const full   = lineas.join(' ');
  console.log('[LEX-PARSER] Líneas:', lineas.length, '| Full sample:', full.substring(0, 400));
  const pm = s => parseFloat((s || '').replace(/[$,\s]/g, '')) || 0;
  // ── HELPERS ───────────────────────────────────────────────────────────────
  // valTras(etiqueta): busca el valor en la línea siguiente a la etiqueta
  // o en la misma línea después de la etiqueta
  function valTras(rx, limRx) {
    for (let i = 0; i < lineas.length; i++) {
      if (rx.test(lineas[i])) {
        // Mismo token: "NOMBRE ARTEMIO LOPEZ"
        const inline = lineas[i].replace(rx, '').trim();
        if (inline && (!limRx || !limRx.test(inline))) return inline;
        // Línea siguiente
        if (i + 1 < lineas.length) {
          const next = lineas[i + 1].trim();
          if (next && (!limRx || !limRx.test(next))) return next;
        }
      }
    }
    // Fallback: buscar en texto continuo
    const mFull = full.match(new RegExp(rx.source + '\\s+([^\\s].{2,80}?)(?=\\s{2,}|' + (limRx ? limRx.source : '$') + ')', 'i'));
    return mFull ? mFull[1].trim() : '';
  }
  // ── NOMBRE ────────────────────────────────────────────────────────────────
  const ETIQ = /^(M[OÓ]VIL|TEL|DOMICILIO|DATOS|CLASE|MARCA|SERIE|MOTOR|A[ÑN]O|PUERTAS|COLOR|TRANSMIS|CILINDROS|PLACA|ORIGEN|COMBUSTIBLE|CONCEPTO|DESCRIPCI|PRECIO|TOTAL|ANTICIPO|LIQUIDADO|SALDO|FOLIO|RECIBO|LEX|DESPACHO|CALLE|TEL\.|POR MEDIO|FIRMA|RESPONSABLE|CLIENTE|FECHA|HORA)/i;
  let nombre = valTras(/^NOMBRE\s*$/i, ETIQ)
    || valTras(/NOMBRE/i, ETIQ);
  // Filtrar si quedó una etiqueta
  if (nombre && ETIQ.test(nombre)) nombre = '';
  // Estrategia de fallback: buscar apellido-apellido-nombre en mayúsculas tras NOMBRE
  if (!nombre) {
    const m = full.match(/NOMBRE\s+((?:[A-ZÁÉÍÓÚÜÑ]{2,}\s+){1,4}[A-ZÁÉÍÓÚÜÑ]{2,})/);
    if (m) nombre = m[1].trim();
  }
  // ── MÓVIL ─────────────────────────────────────────────────────────────────
  let movil = valTras(/^M[OÓ]VIL\s*$/i) || valTras(/M[OÓ]VIL/i);
  if (movil) movil = movil.replace(/[^\d\-\+\.\(\)\s]/g, '').trim().substring(0, 16);
  // ── DOMICILIO ─────────────────────────────────────────────────────────────
  let domicilio = valTras(/^DOMICILIO\s*$/i, /^(POR MEDIO|M[OÓ]VIL|TEL|DATOS DEL VEH)/i)
    || '';
  // ── FECHA Y HORA ──────────────────────────────────────────────────────────
  let fecha = '', hora = '';
  const mFecha = full.match(/(\d{1,2})\s+de\s+([a-záéíóúüñ]+)\s+de\s+(\d{4})\s+(\d{1,2}:\d{2})\s*hrs?/i);
  if (mFecha) {
    const MESES = { enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',
                    julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12' };
    const mes = MESES[mFecha[2].toLowerCase()] || '01';
    fecha = mFecha[3] + '-' + mes + '-' + String(mFecha[1]).padStart(2, '0');
    hora  = mFecha[4];
  }
  if (!fecha) { const mf = full.match(/(\d{4}-\d{2}-\d{2})/); if (mf) fecha = mf[1]; }
  // ── TOTALES ───────────────────────────────────────────────────────────────
  // Estrategia 1: etiquetas exactas seguidas de monto
  const rxM = '\\$?([\\d,]+\\.\\d{2})';
  const mTT = full.match(new RegExp('TOTAL\\s+DEL\\s+TR[A\xC1]MITE\\s+' + rxM, 'i'))
           || full.match(new RegExp('TOTAL\\s+TR[A\xC1]MITE\\s+'         + rxM, 'i'));
  const mTA = full.match(new RegExp('TOTAL\\s+ABONADO\\s+'               + rxM, 'i'));
  const mLQ = full.match(new RegExp('LIQUIDADO\\s+'                      + rxM, 'i'));
  const mSP = full.match(new RegExp('SALDO\\s+PENDIENTE\\s+'             + rxM, 'i'));
  let total   = mTT ? pm(mTT[1]) : 0;
  let abonado = mTA ? pm(mTA[1]) : 0;
  let resta   = mSP ? pm(mSP[1]) : (mLQ ? pm(mLQ[1]) : Math.max(0, total - abonado));
  // Estrategia 2: si no hay etiquetas, recoger todos los montos del PDF
  // y usar el mayor como total (típico en recibos donde solo hay PRECIO)
  if (!total) {
    const montos = [];
    const mxM = /\$\s*([\d,]+\.\d{2})/g;
    let mmx;
    while ((mmx = mxM.exec(full)) !== null) {
      const v = pm(mmx[1]);
      if (v > 0) montos.push(v);
    }
    if (montos.length) {
      // Ordenar desc — el mayor es el total, el último del bloque de totales puede ser el saldo
      montos.sort((a, b) => b - a);
      total = montos[0];
      // Si hay un monto igual al total entre los últimos → saldo 0 (liquidado)
      // Si hay un monto = total * n → anticipo parcial
    }
  }
  // ── CONCEPTO + PRECIO ─────────────────────────────────────────────────────
  // jsPDF genera una tabla con cabecera CONCEPTO / DESCRIPCION / PRECIO
  // seguida por las filas de conceptos
  let concepto = '', descripcion = '', precioConc = 0;
  // Buscar el índice de la línea "CONCEPTO" en las líneas
  let idxConc = -1;
  for (let i = 0; i < lineas.length; i++) {
    if (/^CONCEPTO\s*$/i.test(lineas[i])) { idxConc = i; break; }
  }
  if (idxConc >= 0) {
    // Después de CONCEPTO vienen: DESCRIPCION, PRECIO (encabezados)
    // luego las filas de datos
    let j = idxConc + 1;
    // Saltar encabezados DESCRIPCION y PRECIO
    while (j < lineas.length && /^(DESCRIPCI[OÓ]N|PRECIO)\s*$/i.test(lineas[j])) j++;
    // La siguiente línea es el concepto
    if (j < lineas.length && lineas[j] && !ETIQ.test(lineas[j])) {
      concepto = lineas[j]; j++;
    }
    // La siguiente línea es la descripción
    if (j < lineas.length && lineas[j] && !ETIQ.test(lineas[j]) && !/^\$/.test(lineas[j])) {
      descripcion = lineas[j]; j++;
    }
    // La siguiente línea es el precio
    if (j < lineas.length) {
      const mPr = lineas[j].match(/\$?([\d,]+\.\d{2})/);
      if (mPr) precioConc = pm(mPr[1]);
    }
  }
  // Fallback concepto en texto continuo
  if (!concepto) {
    const mConc = full.match(/CONCEPTO\s+DESCRIPCI[OÓ]N\s+PRECIO\s+([A-Za-záéíóúüñÁÉÍÓÚÜÑ][^\$\n]{3,80}?)\s+([^\$\n]{3,80}?)\s+\$?([\d,]+\.\d{2})/i);
    if (mConc) {
      concepto    = mConc[1].trim();
      descripcion = mConc[2].trim();
      precioConc  = pm(mConc[3]);
    }
  }
  if (!precioConc && total) precioConc = total;
  if (!total && precioConc) total = precioConc;
  // ── RESPONSABLE ───────────────────────────────────────────────────────────
  let resp = '';
  // En LEX aparece "LIC NOMBRE APELLIDO" o "LIC. NOMBRE" antes de "Responsable"
  const mR1 = full.match(/LIC\.?\s+([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s]{3,50}?)(?=\s+(?:Responsable|Santiago|Oaxaca|CALLE|TEL\.))/i);
  if (mR1) resp = ('LIC ' + mR1[1].trim()).toUpperCase();
  if (!resp) {
    const mR2 = full.match(/Responsable\s*(?:del\s*Tr[aá]mite)?\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑa-záéíóúüñ\s\.]{5,60})/i);
    if (mR2) resp = mR2[1].trim().toUpperCase();
  }
  // ── VEHÍCULO ──────────────────────────────────────────────────────────────
  const vehCampo = (etiq, rx) => {
    const v = valTras(new RegExp('^' + etiq + '\\s*$', 'i'));
    if (v && rx && !rx.test(v)) return v.trim();
    if (v && !rx) return v.trim();
    // Inline en full
    const mI = full.match(new RegExp(etiq + '\\s+([^\\s].{1,30}?)(?=\\s{2,}|' + (rx ? rx.source : '$') + ')', 'i'));
    return mI ? mI[1].trim() : '';
  };
  const clase       = vehCampo('CLASE',        /^(MARCA|SERIE|MOTOR|A[ÑN]O)/i);
  const marca       = vehCampo('MARCA',         /^(SERIE|MOTOR|A[ÑN]O)/i);
  const serie       = (() => { const m = full.match(/SERIE\s*[\/]?\s*VIN\s+([A-Z0-9]{5,25})/i); return m ? m[1] : ''; })();
  const motor       = (() => { const m = full.match(/NO\.?\s*MOTOR\s+([A-Z0-9]{4,20})/i);         return m ? m[1] : ''; })();
  const color_veh   = vehCampo('COLOR',         /^(TRANSMIS|CILINDROS|PLACA|ORIGEN)/i);
  const transmision = (() => { const m = full.match(/TRANSMISI[OÓ]N\s+(Autom[aá]tica|Est[aá]ndar|Manual|Estándar)/i); return m ? m[1] : ''; })();
  const cilindros   = (() => { const m = full.match(/CILINDROS\s+(\d+|OTRO|N\/A)/i);               return m ? m[1] : ''; })();
  const placa       = (() => { const m = full.match(/PLACAS\s+ACTUALES\s+([A-Z0-9\-]{4,15})/i);   return m ? m[1] : ''; })();
  const origen      = (() => { const m = full.match(/ORIGEN\s+(Nacional|Extranjero[^\s]*)/i);       return m ? m[1] : ''; })();
  const combustible = (() => { const m = full.match(/COMBUSTIBLE\s+(Gasolina|Diesel|El[eé]ctrico|H[ií]brido|Gas)/i); return m ? m[1] : ''; })();
  const puertas     = (() => { const m = full.match(/PUERTAS\s+(\d)/i);                            return m ? m[1] : ''; })();
  const anio        = (() => { const m = full.match(/A[ÑN]O\s+(\d{4})/i);                         return m ? m[1] : ''; })();
  const ultTen      = (() => { const m = full.match(/[ÚU]LTIMA\s+TENENCIA\s+(\d{4}|—)/i);         return m ? (m[1]==='—'?'':m[1]) : ''; })();
  // ── DOCUMENTOS ───────────────────────────────────────────────────────────
  // Extraer lista de documentos marcados en el recibo
  const DOCS_CONOCIDOS = ['INE','Pasaporte','CURP','RFC','Acta de Nacimiento',
    'Acta de Matrimonio','Acta de Divorcio','Matrícula Consular','Tarjeta de Circulación',
    'Factura Original','Carta Factura Original','Copia de la Factura','Refactura','Refactura Aduanal',
    'Factura Original o Carta Factura','Contrato de Compraventa (Vehículo)',
    'Carta de No Adeudo','Recibo de Luz','Recibo de Agua','Constancia de Situación Fiscal'];
  const copias = DOCS_CONOCIDOS.filter(d => full.includes(d));
  // ── GUARDIA FINAL ─────────────────────────────────────────────────────────
  if (!nombre && !total && !fecha) return null;
  return {
    folio         : _rgenFolio,
    nombre, movil, domicilio,
    fecha, fecha_recibo: fecha,
    hora,  hora_recibo:  hora,
    total,
    anticipo      : abonado,
    totalAbonado  : abonado,
    saldoPendiente: resta,
    saldoNuevo    : resta,
    responsable   : resp,
    tramites      : descripcion || concepto,
    conceptos     : (concepto || descripcion) ? [{
      concepto    : concepto    || descripcion,
      descripcion : descripcion || concepto,
      cantidad    : 1,
      precio      : precioConc  || total
    }] : [],
    clientes      : [{ nombre, movil, tel: '', domicilio }],
    copias,
    tipoTramite   : clase ? 'vehicular' : 'normal',
    clase, marca, serie, motor,
    anio, puertas, color_veh, transmision, cilindros, placa, origen, combustible,
    ultima_tenencia: ultTen,
    pagosParciales : abonado > 0 ? [{ cantidad: abonado, fecha, nota: 'Anticipo registrado en recibo original' }] : []
  };
}
function _rgenMostrarPreview(r){
  const p  = document.getElementById('rgen-preview');
  const fs = folioFormato(_rgenFolio);
  const nombre = r.nombre||((r.clientes||[])[0]?.nombre)||'—';
  const fecha  = r.fecha_recibo||r.fecha||'—';
  const total  = r.total ? '$'+Number(r.total).toFixed(2) : '⚠ no detectado';
  const veh    = r.clase ? ' · '+r.clase+(r.marca?' '+r.marca:'') : '';
  p.innerHTML = '<strong>Folio #'+fs+'</strong> — '+escHTML(nombre)
    +'<br>📅 '+fecha+'  💰 Total: '+total+veh
    +'<br><span style="font-size:0.65rem;opacity:0.7;">Al confirmar se abrirá el formulario completo para revisar todos los datos.</span>';
  p.style.display='block';
}
// ── CONFIRMAR: cerrar modal y abrir formulario de Nuevo Recibo ───────────────
function rgenConfirmar(){
  const err=document.getElementById('rgen-err');
  err.textContent='';
  const fs=typeof folioConLetra==='function'?folioConLetra(_rgenFolio,null,_rgenLetra):folioFormato(_rgenFolio);
  if(!_rgenFolio||!_rgenRec){ err.textContent='⚠ Sin datos para restaurar.'; return; }
  if(typeof appData==='undefined'||!Array.isArray(appData.recibos)){ err.textContent='❌ Sistema no listo.'; return; }
  if(appData.recibos.some(r=>r.folio===_rgenFolio&&(r.letra||(typeof letraVersion==='function'?letraVersion(r):'A')||'A')===_rgenLetra)){ err.textContent='⚠ El folio #'+fs+' ya existe. Bórralo primero.'; return; }
  // Guardar datos de restauración globalmente
  window._restauracionFolio = _rgenFolio;
  window._restauracionLetra = _rgenLetra;
  window._restauracionRec   = _rgenRec;
  window._restauracionFecha = _rgenRec.fecha_recibo || _rgenRec.fecha || '';
  // Construir objeto compatible con cargarReciboEnFormulario
  const R = _rgenRec;
  const recCarga = {
    folio          : _rgenFolio,
    letra          : _rgenLetra,
    nombre         : R.nombre || ((R.clientes||[])[0]?.nombre) || '',
    clientes       : R.clientes || [{ nombre:R.nombre||'', movil:R.movil||'', tel:'', domicilio:R.domicilio||'' }],
    fecha_recibo   : R.fecha_recibo || R.fecha || '',
    hora_recibo    : R.hora_recibo  || R.hora  || '',
    tipoTramite    : R.tipoTramite  || (R.clase ? 'vehicular' : 'normal'),
    tipo_doc       : R.tipo_doc || 'copia',
    copias         : R.copias  || [],
    conceptos      : R.conceptos && R.conceptos.length ? R.conceptos
                     : (R.tramites ? [{ concepto:R.tramites, descripcion:R.tramites, cantidad:1, precio:Number(R.total)||0 }] : []),
    anticipo       : String(Number(R.anticipo)||0),
    responsable    : R.responsable || R.generadoPor || '',
    nombre_cliente_firma: R.nombre || ((R.clientes||[])[0]?.nombre) || '',
    tramites       : R.tramites || '',
    clase:R.clase||'', marca:R.marca||'', tipo_veh:R.tipo_veh||'', serie:R.serie||'', motor:R.motor||'',
    personas_veh:R.personas_veh||'',
    anio:R.anio||'', puertas:R.puertas||'', color_veh:R.color_veh||'',
    transmision:R.transmision||'', cilindros:R.cilindros||'', placa:R.placa||'', placaEstado:R.placaEstado||'',
    ultima_tenencia:R.ultima_tenencia||'', origen:R.origen||'', combustible:R.combustible||''
  };
  cerrarRestaurarRecibo();
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto();
  if(typeof ir==='function') ir('nuevo-recibo');
  setTimeout(()=>{
    if(typeof cargarReciboEnFormulario==='function') cargarReciboEnFormulario(recCarga);
    // A petición expresa: el texto de conformidad debe responder a la fecha
    // real del recibo que se está restaurando, no quedarse en la de HOY.
    if(typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
    document.body.classList.remove('recibo-frozen','modo-actualizacion','modo-edicion-completa');
    document.body.classList.add('modo-restauracion');
    // ── Forzar visibilidad del formulario: si quedó 'modo-consulta' o el panel de
    //    búsqueda abierto de una acción previa, syncFormVisibility() habrá fijado
    //    #recibo-body con display:none !important inline, que ninguna regla CSS de
    //    modo-restauracion puede revertir. Limpiar ese estado residual aquí. ──
    document.body.classList.remove('modo-consulta','paneles-busqueda-abiertos');
    if(typeof _panelesBusquedaAbiertos !== 'undefined') _panelesBusquedaAbiertos = false;
    var _rbForce = document.getElementById('recibo-body');
    if(_rbForce) _rbForce.style.removeProperty('display');
    if(typeof syncFormVisibility === 'function') syncFormVisibility();
    const _rLetra2 = window._restauracionLetra || 'A';
    const fs2=typeof folioConLetra==='function'?folioConLetra(window._restauracionFolio,null,_rLetra2):folioFormato(window._restauracionFolio);
    const el=id=>document.getElementById(id);
    if(el('restauracion-folio-label')) el('restauracion-folio-label').textContent='#'+fs2;
    if(el('restauracion-fecha-label')) el('restauracion-fecha-label').textContent=window._restauracionFecha||'(edítala abajo)';
    if(el('btn-guardar-restauracion')) el('btn-guardar-restauracion').textContent='🔄 Restaurar Recibo #'+fs2;
    ['actions-normal','actions-consulta','actions-actualizacion','actions-post-print','actions-edicion-completa']
      .forEach(id=>{ const e=el(id); if(e) e.style.display='none'; });
    if(el('actions-restauracion')) el('actions-restauracion').style.display='flex';
    ['frozen-banner','consulta-banner','edicion-completa-banner']
      .forEach(id=>{ const e=el(id); if(e) e.style.display='none'; });
    if(el('restauracion-banner')) el('restauracion-banner').style.display='flex';
    // Descongelar completamente
    document.querySelectorAll('#panel-nuevo-recibo input,#panel-nuevo-recibo select,#panel-nuevo-recibo textarea')
      .forEach(e=>{ e.disabled=false; e.style.pointerEvents=''; e.style.opacity=''; });
    // ── Inyectar fecha/hora retroactiva en el formulario ──
    const _rfecha = window._restauracionFecha || '';
    const _rhora  = window._restauracionRec?.hora_recibo || window._restauracionRec?.hora || '';
    if(_rfecha){
      const _fhEl = document.getElementById('fecha_recibo');
      const _fhDisp = document.getElementById('fecha_recibo_display');
      if(_fhEl){ _fhEl.value = _rfecha; }
      if(_fhDisp){
        try{
          const _fd = new Date(_rfecha+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
          _fhDisp.textContent = _fd.charAt(0).toUpperCase()+_fd.slice(1);
        }catch(e){ _fhDisp.textContent = _rfecha; }
      }
    }
    if(_rhora){
      const _horaEl = document.getElementById('hora_recibo');
      const _horaDisp = document.getElementById('hora_recibo_display');
      if(_horaEl) _horaEl.value = _rhora;
      if(_horaDisp) _horaDisp.textContent = _rhora + ' hrs.';
    }
    // ── Activar modo retroactivo para que la fecha sea editable ──
    window._reciboRetroactivoActivo = true;
    const _dispFechaR = document.getElementById('fecha_recibo_display');
    if(_dispFechaR){ _dispFechaR.style.borderBottom='2px dashed #5a3a8a'; _dispFechaR.style.color='#8b5cf6'; _dispFechaR.style.fontWeight='700'; _dispFechaR.title='Click para cambiar la fecha'; }
    const _dispHoraR = document.getElementById('hora_recibo_display');
    if(_dispHoraR){ _dispHoraR.style.color='#8b5cf6'; _dispHoraR.style.fontWeight='700'; }
    if(typeof setStatus==='function') setStatus('ok','Modo restauración — Folio #'+fs2+' · Completa y presiona Restaurar · Click en la fecha para cambiarla','ok');
  }, 650);
}
function cancelarRestauracion(){
  document.body.classList.remove('modo-restauracion');
  window._restauracionFolio=null; window._restauracionLetra=null; window._restauracionRec=null; window._restauracionFecha=null;
  window._reciboRetroactivoActivo = false;
  window._reciboRetroactivoFechaPersonalizada = null;
  window._reciboRetroactivoHoraPersonalizada = null;
  const el=id=>document.getElementById(id);
  if(el('actions-restauracion')) el('actions-restauracion').style.display='none';
  if(el('restauracion-banner'))  el('restauracion-banner').style.display='none';
  if(el('actions-normal'))       el('actions-normal').style.display='flex';
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto();
  if(typeof setStatus==='function') setStatus('ok','Restauración cancelada','ok');
}
function guardarRestauracionConVerificacion(){
  // Verificar sesión ANTES de intentar restaurar — muestra aviso claro si expiró
  // Nota: sbExpiry>0 garantiza que la sesión fue establecida correctamente;
  //       sbExpiry===0 es el valor inicial (nunca hubo login), no "expirado".
  const _expiry = (typeof sbExpiry!=='undefined' && sbExpiry > 0) ? sbExpiry : Infinity;
  if(typeof sbSession==='undefined'||!sbSession||Date.now()>=_expiry){
    if(typeof toast==='function') toast('⚠ Sesión expirada — inicia sesión para poder restaurar el recibo', 'err');
    const btn=document.getElementById('btn-guardar-restauracion');
    if(btn){ btn.textContent='⚠ Sin sesión'; btn.style.background='var(--rojo)'; setTimeout(()=>{ btn.style.background=''; const fs=typeof folioConLetra==='function'&&window._restauracionFolio?folioConLetra(window._restauracionFolio,null,window._restauracionLetra||'A'):window._restauracionFolio||''; btn.textContent='🔄 Restaurar Recibo'+(fs?(' #'+fs):''); }, 2500); }
    mostrarDriveOverlay('guardarRestauracion');
    return;
  }
  guardarRestauracion().catch(function(e){ console.error('[guardarRestauracion]', e); if(typeof toast==='function') toast('❌ Error al restaurar: '+(e.message||e), 'err'); });
}
async function guardarRestauracion(){
  window._activarRegistrandoRecibo();
  // FIX (caso real: "le doy clic a Restaurar Recibo y no responde"): este
  // "return" temprano dependía SOLO de un alert() nativo del navegador para
  // avisar del error. Los navegadores pueden suprimir alert()/confirm()
  // repetidos en la misma página (la opción "Evitar que este sitio muestre
  // más mensajes") — si eso ya pasó en la sesión, el clic literalmente no
  // muestra NADA, dando la sensación de que el botón no hace nada. Se agrega
  // toast()/setStatus() (UI propia de la app, nunca suprimible por el
  // navegador) ANTES del alert(), para que el motivo del bloqueo siempre sea
  // visible aunque el alert() no se muestre.
  if(!window._restauracionFolio){
    window._desactivarRegistrandoRecibo();
    if(typeof toast==='function') toast('❌ Sin folio de restauración activo — cierra y vuelve a abrir "Restaurar Recibo"', 'err');
    if(typeof setStatus==='function') setStatus('err','Sin folio de restauración activo','err');
    alert('Error: sin folio de restauración activo.');
    return;
  }
  // Misma corrección: sbExpiry===0 no significa expirado, significa no inicializado
  const _expiry2 = (typeof sbExpiry!=='undefined' && sbExpiry > 0) ? sbExpiry : Infinity;
  if(!sbSession||Date.now()>=_expiry2){
    window._desactivarRegistrandoRecibo();
    if(typeof toast==='function') toast('⚠ Sesión expirada — inicia sesión nuevamente para restaurar', 'err');
    mostrarDriveOverlay('guardarRestauracion');
    return;
  }
  const folio    = window._restauracionFolio;
  const letra    = window._restauracionLetra || 'A';
  const fs       = typeof folioConLetra==='function'?folioConLetra(folio,null,letra):folioFormato(folio);
  // Prioridad: editor retroactivo → input del formulario → _restauracionFecha → fecha actual
  const _inputFecha = document.getElementById('fecha_recibo');
  const _inputHora  = document.getElementById('hora_recibo');
  const fechaOrig = window._reciboRetroactivoFechaPersonalizada
                 || (_inputFecha?.value?.trim())
                 || window._restauracionFecha
                 || fechaCDMX_ISO();
  const horaOrig  = window._reciboRetroactivoHoraPersonalizada
                 || (_inputHora?.value?.trim())
                 || window._restauracionRec?.hora_recibo
                 || window._restauracionRec?.hora
                 || horaCDMX_HHMM();
  if(typeof appData!=='undefined'&&Array.isArray(appData.recibos)&&appData.recibos.some(r=>r.folio===folio&&(r.letra||(typeof letraVersion==='function'?letraVersion(r):'A')||'A')===letra)){
    window._desactivarRegistrandoRecibo();
    // Mismo FIX de arriba: toast()/setStatus() visibles siempre, no solo alert().
    // Si el folio "ya existe" según la copia LOCAL en memoria pero en realidad ya
    // se borró en Supabase (por ejemplo, otra sesión lo eliminó, o se corrigió
    // directo en la base de datos), esta copia local queda desactualizada y
    // bloquea la restauración sin razón real — de ahí la sugerencia de refrescar.
    if(typeof toast==='function') toast('⚠ El folio #'+fs+' ya existe — bórralo primero, o refresca la página si crees que ya no debería existir', 'err');
    if(typeof setStatus==='function') setStatus('err','Folio #'+fs+' ya existe','err');
    alert('⚠ El folio #'+fs+' ya existe. Bórralo primero.\n\nSi crees que esto es un error (por ejemplo, ya lo borraste desde otra sesión o directo en la base de datos), refresca la página para actualizar la copia local antes de reintentar.');
    return;
  }
  const clientes  = typeof getClientes  ==='function' ? getClientes()  : [];
  const conceptos = typeof getConceptos ==='function' ? getConceptos() : [];
  if(!clientes.length||!clientes[0].nombre){
    if(typeof toast==='function') toast('⚠ Ingresa el nombre del cliente antes de restaurar','err');
    if(typeof setStatus==='function') setStatus('err','Ingresa el nombre del cliente','err');
    const _primerNombreEl = document.querySelector('#clientes-wrapper .cliente-row input[type="text"]');
    if(_primerNombreEl){
      _primerNombreEl.focus();
      _primerNombreEl.style.outline='2px solid var(--rojo)';
      _primerNombreEl.style.boxShadow='0 0 0 3px rgba(180,30,30,0.25)';
      setTimeout(()=>{ _primerNombreEl.style.outline=''; _primerNombreEl.style.boxShadow=''; },2500);
    }
    window._desactivarRegistrandoRecibo(); return;
  }
  const anticipo       = parsePrecio($('anticipo').value);
  const total          = conceptos.reduce((s,c)=>s+(parseFloat(c.precio)||0),0);
  const saldoPendiente = Math.max(0,total-anticipo);
  const primerNombre   = (clientes[0].nombre||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\./g,'');
  clientes[0].nombre   = primerNombre;
  // Modal de placas para trámites vehiculares.
  // FIX: antes solo distinguía vehicular/normal — si el usuario seleccionaba
  // "⚖️ Trámite de Juicio" o "📜 Trámite de Escrituras" en el restaurador, igual
  // se guardaba como 'normal', y el PDF perdía el texto legal específico de
  // juicio/escritura y ganaba de más la sección "DOCUMENTOS QUE DEJA EL INTERESADO".
  const _tramiteBtnActivoRest = document.querySelector('.tramite-btn.active')?.id || '';
  const _tipoTramiteRest = _tramiteBtnActivoRest==='btn-tramite-vehicular' ? 'vehicular'
                          : _tramiteBtnActivoRest==='btn-tramite-escritura' ? 'escritura'
                          : _tramiteBtnActivoRest==='btn-tramite-juicio'    ? 'juicio'
                          : 'normal';
  let _placasRest = { placas: null, estado: null };
  if(_tipoTramiteRest === 'vehicular'){
    const _resultadoPlacas = await pedirDatosPlacas();
    if(_resultadoPlacas === null){
      window._desactivarRegistrandoRecibo();
      if(typeof setStatus==='function') setStatus('ok','Restauración cancelada','ok');
      return;
    }
    _placasRest = { placas: _resultadoPlacas.placas, estado: _resultadoPlacas.estado };
  }
  const btn=document.getElementById('btn-guardar-restauracion');
  if(btn){btn.disabled=true;btn.textContent='⏳ Restaurando…';}
  if(typeof setStatus==='function') setStatus('loading','Restaurando recibo #'+fs+'...','loading');
  try{
    // Usar fecha/hora originales
    $('fecha_recibo').value=fechaOrig; $('hora_recibo').value=horaOrig;
    try{document.getElementById('hora_recibo_display').textContent=horaOrig+' hrs.';}catch(e){ registrarError('catch vacio', e); }
    try{
      const fd=new Date(fechaOrig+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
      document.getElementById('fecha_recibo_display').textContent=fd.charAt(0).toUpperCase()+fd.slice(1);
    }catch(e){ registrarError('catch vacio', e); }
    const datos={
      folio, clientes,
      tramites    : $('tramites')?.value||'',
      clase       : $('clase')?.value||'',       marca:$('marca')?.value||'',
      tipo_veh    : $('tipo_veh')?.value||'',
      serie       : $('serie')?.value||'',       motor:$('motor')?.value||'',
      personas_veh: $('personas_veh')?.value||'',
      anio        : $('anio')?.value||'',        puertas:$('puertas')?.value||'',
      color_veh   : $('color_veh')?.value||'',   transmision:$('transmision')?.value||'',
      cilindros   : $('cilindros')?.value||'',   placa:$('placa')?.value||'',
      ultima_tenencia:$('ultima_tenencia')?.value||'',
      origen      : $('origen')?.value||'',      combustible:$('combustible')?.value||'',
      copias      : typeof getDocumentosSeleccionados==='function'?getDocumentosSeleccionados():'[]',
      tipoTramite : _tipoTramiteRest,
      // Preserva "Sin Costo Total Pactado" al restaurar un Juicio/Escritura — antes
      // este campo ni siquiera se guardaba, así que un folio restaurado siempre
      // perdía la modalidad de cobro.
      modoCosto   : (document.getElementById('modo-costo-pactado')||{}).value || '',
      fecha_recibo:fechaOrig, hora_recibo:horaOrig,
      anticipo    : String(anticipo),
      responsable : $('responsable')?.value||'',
      nombre_cliente_firma:$('nombre_cliente_firma')?.value||primerNombre,
      conceptos,
      timestamp   : fechaOrig+'T'+horaOrig+':00',
      folioAnterior:null, historialPagosRef:[],
      totalGeneral:total, totalAbonado:anticipo, saldoNuevo:saldoPendiente,
      placasEntregadas:_placasRest.placas||null, estadoPlacas:_placasRest.estado||null,
      descripcionVehicular:''
    };
    const qrTexto  ='LEX-MEXICO|Folio:'+fs+'|'+primerNombre+'|'+fechaOrig+' '+horaOrig;
    const qrDataURL= typeof qrToDataURL==='function'?await qrToDataURL(qrTexto).catch(()=>null):null;
    const doc      = await generarPDF(datos, folio, qrDataURL);
    const pdfBase64= doc.output('datauristring');
    // ── Abrir la ventana de impresión igual que el flujo normal de generación ──
    try {
      const _blobRest = new Blob([doc.output('arraybuffer')], {type:'application/pdf'});
      if (typeof lastPdfBlob !== 'undefined') lastPdfBlob = _blobRest;
      if (typeof imprimirBlob === 'function') imprimirBlob(_blobRest);
    } catch(eImpRest){ console.warn('[RESTAURAR] impresión:', eImpRest); }
    const nombreArchivo=fs+'.pdf'; // nombre corto canónico
    if(typeof subirPDFaDrive==='function') try{ subirPDFaDrive(doc.output('blob'),nombreArchivo); }catch(e){ registrarError('catch vacio', e); }
    // guardarEnDirectorio puede fallar si save() no retorna promesa — envolver en try
    if(typeof guardarEnDirectorio==='function') try{ await guardarEnDirectorio(datos); }catch(e){ console.warn('[RESTAURAR] directorio:',e); }
    // Limpiar el input de archivo para evitar que onchange se dispare de nuevo
    try{ const inp=document.getElementById('rgen-file-pdf'); if(inp) inp.value=''; }catch(e){ registrarError('catch vacio', e); }
    const copiasParsed=(()=>{try{const p=JSON.parse(datos.copias||'{}');return p.docs||[];}catch(e){return [];}})();
    const rec={
      folio, letra, nombre:primerNombre, fecha:fechaOrig, hora:horaOrig,
      fecha_recibo:fechaOrig, hora_recibo:horaOrig,
      archivo:nombreArchivo, pdfBase64, saldoPendiente,
      anticipo:String(anticipo), totalAbonado:anticipo, saldoNuevo:saldoPendiente,
      conceptos, total, generadoPor:datos.responsable||'RESTAURADO',
      responsable:datos.responsable||'RESTAURADO', clientes,
      tipoTramite:datos.tipoTramite, tramites:datos.tramites, modoCosto:datos.modoCosto||'',
      tipo_doc:$('tipo_doc')?.value||'copia', copias:copiasParsed,
      clase:datos.clase, marca:datos.marca, tipo_veh:datos.tipo_veh, serie:datos.serie, motor:datos.motor,
      personas_veh:datos.personas_veh,
      anio:datos.anio, puertas:datos.puertas, color_veh:datos.color_veh,
      transmision:datos.transmision, cilindros:datos.cilindros, placa:datos.placa, placaEstado:datos.placaEstado||'',
      ultima_tenencia:datos.ultima_tenencia, origen:datos.origen, combustible:datos.combustible,
      pagosParciales:[],
      esRestaurado:true, fechaRestauracion:new Date().toISOString(),
      placasEntregadas:_placasRest.placas||null,
      estadoPlacas:_placasRest.estado||null,
      notas:'⚠ Restaurado el '+new Date().toLocaleDateString('es-MX')+' — PDF regenerado'
    };
    // Revivir sobre tombstone: el folio restaurado fue eliminado antes; sin esta
    // marca, el merge de sincronización lo filtraría y "desaparecería solo".
    if (typeof _revivirSiTombstone === 'function') _revivirSiTombstone(rec);
    // Insertar en posición correcta considerando folio Y letra (A < B < C...)
    const _letraOrd = l => (l||'A').charCodeAt(0);
    const idx = appData.recibos.findIndex(r =>
      r.folio < folio ||
      (r.folio === folio && _letraOrd(r.letra||'A') < _letraOrd(letra))
    );
    if(idx>=0) appData.recibos.splice(idx,0,rec); else appData.recibos.push(rec);
    if(letra==='A' && appData.folioActual<=folio){ appData.folioActual=folio+1; if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay(); }
    if(typeof REC!=='undefined'){REC.recibos=appData.recibos;REC.folioActual=appData.folioActual;}
    if(typeof actualizarArchivoControl==='function') try{await actualizarArchivoControl();}catch(e){ registrarError('catch vacio', e); }
    // ── CONTABILIDAD con fecha original ───────────────────────────────────
    if(typeof D!=='undefined'&&Array.isArray(D.movimientos)&&total>0){
      // monto = SOLO lo que realmente se cobró. Sin anticipo → $0 con estatus
      // "Sin Anticipo" (igual que el flujo normal de generación). Registrar el
      // total cuando no hubo pago inflaba la caja como si el cliente hubiera abonado.
      const montoCaja=anticipo>0?anticipo:0;
      const esLiq=saldoPendiente<=0&&anticipo>0;
      const esSinAnticipo=montoCaja===0&&total>0;
      const tipoMov=esLiq?'Liquidado':(esSinAnticipo?'Sin Anticipo':'Anticipo');
      const conc1=(conceptos[0]?.concepto||'');
      const desc1=(conceptos[0]?.descripcion||'');
      const txtConcRest = conc1 ? (conc1 + (desc1 ? ' — ' + desc1 : '')) : '';
      if(typeof _registrarMovimiento==='function') _registrarMovimiento({
        id:'M-REST-'+folio+letra+'-'+Date.now(), folioCaja:'',
        fecha:fechaOrig, hora:horaOrig,
        descripcion: txtConcRest || fs,
        nombre:primerNombre, folio, letra, monto:montoCaja,
        tipo:'ingreso', cat:tipoMov+' · #'+fs, estatus:tipoMov,
        fuente:'recibo', esRestaurado:true, responsable:datos.responsable||'RESTAURADO'
      });
      try{ if(typeof syncEstadoSupabaseDebounced==='function') syncEstadoSupabaseDebounced(); }catch(e){ registrarError('catch vacio', e); }
    }
    // ── PENDIENTE DE PLACAS automático si es trámite vehicular ──────────────
    if(typeof D!=='undefined' && Array.isArray(D.pendientes) && datos.tipoTramite==='vehicular'){
      try {
        const idPend = 'PEND-REC-' + folio;
        if(!D.pendientes.some(p => p.id === idPend)){
          const conc0 = (conceptos[0]?.concepto||'').toLowerCase();
          let tipoVeh = 'alta';
          if(conc0.includes('reemplac'))                                    tipoVeh = 'reemplacamiento';
          else if(conc0.includes('baja'))                                   tipoVeh = 'baja';
          else if(conc0.includes('cambio')||conc0.includes('propiet'))      tipoVeh = 'cambio_propietario';
          else if(conc0.includes('tarjeta')||conc0.includes('circulac'))    tipoVeh = 'tarjeta_circulacion';
          const tipoLbl = {'alta':'Alta de placas','baja':'Baja de placas','cambio_propietario':'Cambio de propietario','tarjeta_circulacion':'Tarjeta de circulación','reemplacamiento':'Reemplacamiento'}[tipoVeh]||'Trámite vehicular';
          const desc0 = conceptos[0]?.descripcion||'';
          const concDesc = [conceptos[0]?.concepto, desc0].filter(Boolean).join(' — ');
          D.pendientes.unshift({
            id: idPend,
            texto: concDesc || (tipoLbl+' — '+primerNombre+(rec.placa?' ('+rec.placa+')':'')),
            persona: primerNombre,
            categoria:'Placas', seccion:'placas', prioridad:'normal',
            resp: datos.responsable||'',
            obs:'', fechaLimite:'', carpeta:'',
            resuelto:false,
            fechaCreacion: typeof hoy==='function'?hoy():new Date().toISOString().split('T')[0],
            fechaResolucion:'',
            placasEstado: rec.origen||'',
            placasNumero: rec.placa||'',
            tipoVehicular: tipoVeh,
            descripcionPlacas: concDesc||tipoLbl,
            reciboVinculadoFolio: folio,
            vehMarca: rec.marca||'', vehClase: rec.clase||'',
            marca: rec.marca||'', clase: rec.clase||'',
            documentos:[]
          });
          console.log('[Auto-pendiente REST] Creado pendiente de placas para recibo #'+fs);
          // Si el recibo ya está liquidado, eliminar el pendiente inmediatamente
          if(saldoPendiente <= 0 && typeof _eliminarPendientePorFolio === 'function'){
            _eliminarPendientePorFolio(folio);
          }
        }
      } catch(ePend){ console.warn('[Auto-pendiente REST]', ePend); }
    }
    if(typeof renderHistorial==='function') try{renderHistorial();}catch(e){ registrarError('catch vacio', e); }
    if(typeof renderCaja==='function')      safeExec('renderCaja', () => renderCaja());
    try{ if(typeof syncEstadoSupabaseDebounced==='function') syncEstadoSupabaseDebounced(); }catch(e){ registrarError('catch vacio', e); }
    // Salir del modo restauración y limpiar flags retroactivos
    document.body.classList.remove('modo-restauracion');
    window._restauracionFolio=null; window._restauracionRec=null; window._restauracionFecha=null;
    window._reciboRetroactivoActivo = false;
    window._reciboRetroactivoFechaPersonalizada = null;
    window._reciboRetroactivoHoraPersonalizada = null;
    document.getElementById('restauracion-banner').style.display='none';
    document.getElementById('actions-restauracion').style.display='none';
    document.getElementById('actions-normal').style.display='flex';
    if(typeof toast==='function') toast('✅ Recibo #'+fs+' restaurado');
    if(typeof setStatus==='function') setStatus('ok','Recibo #'+fs+' restaurado — PDF regenerado','ok');
    if(_placasRest.placas && typeof mostrarPlacasEnPantalla==='function')
      mostrarPlacasEnPantalla(_placasRest.placas, _placasRest.estado);
    alert('✅ Recibo #'+fs+' restaurado.\n\n📋 '+primerNombre+'\n📅 '+fechaOrig
      +(letra!=='A'?' · Serie '+letra:'')+'\n💰 $'+total.toFixed(2)+' | Abonado: $'+anticipo.toFixed(2)+' | Saldo: $'+saldoPendiente.toFixed(2)
      +'\n\nAparece en Contabilidad con fecha '+fechaOrig+'.');
    window._desactivarRegistrandoRecibo();
    if(typeof limpiarFormCompleto==='function') limpiarFormCompleto();
    if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
  }catch(e){
    window._desactivarRegistrandoRecibo();
    console.error('[RESTAURAR]',e);
    if(typeof setStatus==='function') setStatus('err','Error: '+(e.message||e),'err');
    if(btn){btn.disabled=false;btn.textContent='🔄 Restaurar Recibo #'+fs;}
    alert('❌ Error al restaurar: '+(e.message||e));
  }
}
function _rgenActivarBtn(fs){
  const btn=document.getElementById('rgen-btn-confirmar');
  btn.disabled=false; btn.style.background='linear-gradient(135deg,#1a7a3a,#0f5228)';
  btn.style.cursor='pointer'; btn.textContent='✅ Restaurar Recibo #'+fs;
}
function _rgenDesactivarBtn(){
  const btn=document.getElementById('rgen-btn-confirmar');
  btn.disabled=true; btn.style.background='#aaa'; btn.style.cursor='not-allowed';
  btn.textContent='✅ Restaurar Recibo';
}
function verificarFolioRestaurar(){ /* ya no se usa */ }
function ejecutarRestaurarRecibo(){ rgenConfirmar(); }
// ═══ RECIBO RETROACTIVO ═══════════════════════════════════════════
// Permite generar un recibo formal con fecha pasada.
// El recibo lleva marca de auditoría indicando que fue retroactivo.
// Toggle del modo retroactivo en el panel Nuevo Recibo
function toggleReciboRetroactivo(){
  window._reciboRetroactivoActivo = !window._reciboRetroactivoActivo;
  var btn = document.getElementById('btn-toggle-retro');
  var display = document.getElementById('fecha_recibo_display');
  if(window._reciboRetroactivoActivo){
    // Activar modo retroactivo
    btn.style.background = '#5a3a8a';
    btn.style.color = '#fff';
    btn.style.borderColor = '#5a3a8a';
    btn.textContent = '⏰ RETRO ACTIVO';
    if(display){
      display.style.borderBottom = '2px dashed #5a3a8a';
      display.style.color = '#8b5cf6';
      display.style.fontWeight = '700';
    }
    // Congelar hora display inmediatamente con color morado
    var hDisplay = document.getElementById('hora_recibo_display');
    var hHidden  = document.getElementById('hora_recibo');
    if(hDisplay) {
      hDisplay.style.color      = '#8b5cf6';
      hDisplay.style.fontWeight = '700';
    }
    if(typeof toast === 'function') toast('Modo Retroactivo: click en la fecha para cambiarla', 'ok');
    // Abrir editor inmediatamente
    setTimeout(abrirEditorFechaRetro, 200);
  } else {
    // Desactivar — volver a hoy
    btn.style.background = 'none';
    btn.style.color = 'var(--muted)';
    btn.style.borderColor = 'rgba(200,149,42,0.3)';
    btn.textContent = '⏰ RETRO';
    if(display){
      display.style.borderBottom = 'none';
      display.style.color = 'var(--gold-dark)';
      display.style.fontWeight = '';
    }
    // Restaurar color hora display
    var hDisplay = document.getElementById('hora_recibo_display');
    if(hDisplay) {
      hDisplay.style.color      = '';
      hDisplay.style.fontWeight = '';
    }
    // Resetear fecha a hoy
    var fHidden = document.getElementById('fecha_recibo');
    if(fHidden) fHidden.value = '';
    var hHidden = document.getElementById('hora_recibo');
    if(hHidden) hHidden.value = '';
    // Limpiar marcadores
    window._reciboRetroactivoFechaPersonalizada = null;
    window._reciboRetroactivoHoraPersonalizada = null;
    window._reciboRetroactivoMotivo = null;
    if(display) display.textContent = '';
    if(typeof toast === 'function') toast('Modo Retroactivo desactivado', 'ok');
  }
}
// Abrir editor de fecha y hora retroactiva
function abrirEditorFechaRetro(){
  // Prioridad: (1) globales retro ya activos, (2) campos del DOM, (3) hora actual del sistema
  var fechaActual = window._reciboRetroactivoFechaPersonalizada
    || (document.getElementById('fecha_recibo')||{value:''}).value
    || (typeof hoy==='function'?hoy():new Date().toISOString().split('T')[0]);
  var _horaRaw = window._reciboRetroactivoHoraPersonalizada
    || (document.getElementById('hora_recibo')||{value:''}).value
    || (typeof horaCDMX_HHMM==='function'?horaCDMX_HHMM():(typeof hora==='function'?hora():new Date().toTimeString().slice(0,5)));
  // Normalizar a HH:mm (el input[type=time] requiere dos dígitos en la hora)
  var horaActual = (function(h){
    if(!h) return '00:00';
    var p = h.split(':');
    return (p[0]||'0').padStart(2,'0') + ':' + (p[1]||'00').padStart(2,'0');
  })(_horaRaw);
  var fechaHoy = (typeof hoy==='function' ? hoy() : new Date().toISOString().split('T')[0]);
  var modalHTML = ''
    + '<div id="modalReciboRetro" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">'
    + '<div style="background:#1a1410;border:2px solid #5a3a8a;border-radius:12px;max-width:480px;width:100%;padding:24px;color:#e8d4a8;font-family:system-ui,sans-serif;max-height:90vh;overflow-y:auto;">'
    + '<h2 style="margin:0 0 6px 0;color:#c8952a;font-family:Fraunces,serif;">⏰ Recibo Retroactivo</h2>'
    + '<div style="font-size:0.78rem;color:rgba(200,149,42,0.7);margin-bottom:14px;line-height:1.5;">'
    + 'Este recibo se generará con la fecha y hora que indiques, no con la del momento actual. '
    + 'Quedará marca de auditoría con el usuario y motivo.'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">'
    + '<div>'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Fecha del recibo:</label>'
    + '<input type="date" id="rretFecha" value="' + fechaActual + '" max="' + fechaHoy + '" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:1rem;">'
    + '</div>'
    + '<div>'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Hora del recibo:</label>'
    + '<input type="time" id="rretHora" value="' + horaActual + '" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:1rem;">'
    + '</div>'
    + '</div>'
    + '<div style="font-size:0.7rem;color:rgba(200,149,42,0.6);margin-bottom:12px;">⚠️ No se permiten fechas futuras</div>'
    + '<div style="margin-bottom:14px;">'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Motivo (auditoría):</label>'
    + '<input type="text" id="rretMotivo" placeholder="Ej: Cliente pagó la semana pasada, recibo emitido hoy" '
    + 'value="' + (window._reciboRetroactivoMotivo||'') + '" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:0.9rem;">'
    + '</div>'
    + '<div style="background:rgba(200,149,42,0.08);border:1px solid rgba(200,149,42,0.3);padding:10px;border-radius:6px;margin-bottom:14px;font-size:0.72rem;line-height:1.4;">'
    + '<b>📝 Importante:</b> El recibo PDF se generará con la fecha que indiques. '
    + 'En la base de datos quedará registro completo: usuario que lo capturó, '
    + 'fecha real de captura, fecha del recibo y motivo.'
    + '</div>'
    + '<div style="display:flex;gap:8px;">'
    + '<button onclick="document.getElementById(\'modalReciboRetro\').remove()" style="flex:1;padding:12px;background:#444;border:none;border-radius:6px;color:#fff;cursor:pointer;">Cancelar</button>'
    + '<button onclick="confirmarFechaRetro()" style="flex:2;padding:12px;background:#5a3a8a;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;">✅ Aplicar fecha</button>'
    + '</div>'
    + '</div>'
    + '</div>';
  var div = document.createElement('div');
  div.innerHTML = modalHTML;
  document.body.appendChild(div.firstChild);
}
function confirmarFechaRetro(){
  var fecha = document.getElementById('rretFecha').value;
  var hr = document.getElementById('rretHora').value;
  var motivo = document.getElementById('rretMotivo').value.trim();
  var fechaHoy = (typeof hoy==='function' ? hoy() : new Date().toISOString().split('T')[0]);
  if(!fecha){ alert('Debes elegir una fecha.'); return; }
  if(fecha > fechaHoy){
    alert('No se permiten fechas futuras.');
    return;
  }
  if(!hr){ alert('Debes elegir una hora.'); return; }
  // Guardar en globales
  window._reciboRetroactivoFechaPersonalizada = fecha;
  window._reciboRetroactivoHoraPersonalizada = hr;
  window._reciboRetroactivoMotivo = motivo || '(sin motivo)';
  window._reciboRetroactivoActivo = true;  // ← CRÍTICO: marcar como activo
  // Aplicar al formulario
  var fHidden = document.getElementById('fecha_recibo');
  var hHidden = document.getElementById('hora_recibo');
  if(fHidden) fHidden.value = fecha;
  if(hHidden) hHidden.value = hr;
  // Actualizar display visual
  var display = document.getElementById('fecha_recibo_display');
  if(display){
    try {
      var [y,m,d] = fecha.split('-').map(Number);
      var fd = new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(y,m-1,d));
      display.textContent = fd.charAt(0).toUpperCase()+fd.slice(1) + ' (RETRO)';
    } catch(e){ display.textContent = fecha + ' (RETRO)'; }
  }
  var hDisplay = document.getElementById('hora_recibo_display');
  if(hDisplay) {
    hDisplay.textContent = hr + ' hrs.';
    hDisplay.style.color      = '#8b5cf6';
    hDisplay.style.fontWeight = '700';
  }
  document.getElementById('modalReciboRetro').remove();
  // Sincronizar fecha/hora retro con las filas de pago "sincronizadas" (ver
  // agregarPagoParcial → pp-fecha-sincronizada) y con el texto de conformidad —
  // ambos deben responder siempre a esta fecha/hora maestra del encabezado.
  if(typeof _sincronizarFechaHoraMaestraPagos === 'function') _sincronizarFechaHoraMaestraPagos();
  if(typeof toast === 'function') toast('✅ Fecha retroactiva aplicada: ' + fecha, 'ok');
  // Sincronizar fecha/hora retro con filas de SERVICIOS COMPLEMENTARIOS NO bloqueadas
  document.querySelectorAll('#costos-extra-tbody tr').forEach(function(tr){
    if(tr.dataset.locked === '1') return;
    var fechaHoraNueva = fecha + ' ' + hr + ' hrs.';
    tr.dataset.fechaHora = fechaHoraNueva;
    var celdaFechaHora = tr.querySelectorAll('td')[3];
    if(celdaFechaHora && !celdaFechaHora.querySelector('input[type="date"]')){
      celdaFechaHora.style.color = '#8b5cf6';
      celdaFechaHora.style.fontWeight = '700';
      celdaFechaHora.textContent = fechaHoraNueva;
    }
  });
  // Si el modal de cancelación está visible, actualizar su display de retro
  if(typeof fichaRetroActualizarDisplay === 'function') fichaRetroActualizarDisplay();
}
// Hook al guardado de recibo: si modo retro está activo, agregar auditoría
// Esto se aprovecha de que guardarReciboInterno usa fecha_recibo.value cuando está seteado.
// Aquí solo agregamos la marca de auditoría al recibo después de que se guarda.
if(typeof guardarReciboInterno === 'function' && !window._guardarReciboInternoOriginal){
  window._guardarReciboInternoOriginal = guardarReciboInterno;
  window.guardarReciboInterno = async function(){
    var esRetro = !!window._reciboRetroactivoActivo;
    var fechaPers = window._reciboRetroactivoFechaPersonalizada;
    var horaPers = window._reciboRetroactivoHoraPersonalizada;
    var motivoPers = window._reciboRetroactivoMotivo;
    // Blindaje de período: en modo retroactivo verificar que la fecha no esté en período cerrado
    if(esRetro && fechaPers && typeof esPeriodoCerrado === 'function' && esPeriodoCerrado(fechaPers, horaPers || '00:00')){
      if(typeof toast === 'function') toast(typeof _msgPeriodoCerrado === 'function' ? _msgPeriodoCerrado() : '🔒 Período cerrado por corte de caja', 'err');
      return;
    }
    // CRÍTICO: cuando es retro, la función original sobreescribe fecha con hoy() en líneas 14151
    // Necesitamos interceptar esto. Forzamos que mantenga el valor actual.
    if(esRetro && fechaPers){
      // Pre-blindar los campos para que la función original no los pise
      var fEl = document.getElementById('fecha_recibo');
      var hEl = document.getElementById('hora_recibo');
      // Marcamos el body como "frozen" temporalmente para evitar el reset
      document.body.classList.add('recibo-frozen');
      if(fEl) fEl.value = fechaPers;
      if(hEl) hEl.value = horaPers;
    }
    var resultado;
    try {
      resultado = await window._guardarReciboInternoOriginal.apply(this, arguments);
    } finally {
      // SIEMPRE remover recibo-frozen aunque haya error, para no dejar el botón inhabilitado
      if(esRetro) document.body.classList.remove('recibo-frozen');
    }
    if(esRetro){
      // (ya removido en finally — esta línea es por compatibilidad)
      document.body.classList.remove('recibo-frozen');
      // Agregar auditoría al recibo recién creado
      try {
        var ultimoRec = (REC.recibos||[])[0];
        if(ultimoRec){
          // Forzar fecha correcta (por si la original la pisó)
          ultimoRec.fecha = fechaPers;
          ultimoRec.fecha_recibo = fechaPers;
          ultimoRec.hora = horaPers;
          ultimoRec.hora_recibo = horaPers;
          ultimoRec.esRetroactivo = true;
          if(!ultimoRec.historialCambios) ultimoRec.historialCambios = [];
          ultimoRec.historialCambios.push({
            tipo: 'recibo_retroactivo',
            fechaCreacion: new Date().toISOString(),
            usuario: (typeof empNombre==='function' ? empNombre() : 'Admin'),
            fechaRealCaptura: (typeof hoy==='function' ? hoy() : ''),
            horaRealCaptura: (typeof hora==='function' ? hora() : ''),
            fechaRecibo: fechaPers,
            horaRecibo: horaPers,
            motivo: motivoPers
          });
          // Sincronizar también con appData
          if(typeof appData !== 'undefined' && appData.recibos){
            var idxApp = appData.recibos.findIndex(function(r){ return r.folio === ultimoRec.folio; });
            if(idxApp >= 0) appData.recibos[idxApp] = ultimoRec;
          }
          if(typeof save === 'function') save();
          if(typeof actualizarArchivoControl === 'function') actualizarArchivoControl().catch(function(e){console.warn(e);});
        }
      } catch(e){ console.warn('Auditoría retro:', e); }
      // Resetear modo retro automáticamente tras guardado
      window._reciboRetroactivoActivo = false;
      window._reciboRetroactivoFechaPersonalizada = null;
      window._reciboRetroactivoHoraPersonalizada = null;
      window._reciboRetroactivoMotivo = null;
      var btn = document.getElementById('btn-toggle-retro');
      if(btn){
        btn.style.background = 'none';
        btn.style.color = 'var(--muted)';
        btn.style.borderColor = 'rgba(200,149,42,0.3)';
        btn.textContent = '⏰ RETRO';
      }
      var display = document.getElementById('fecha_recibo_display');
      if(display){
        display.style.borderBottom = 'none';
        display.style.color = 'var(--gold-dark)';
      }
    }
    return resultado;
  };
}
// ═══ FIN RECIBO RETROACTIVO ═══
// ╔══════════════════════════════════════════════════════════════════╗
// ║  MEJORAS DE RESILIENCIA — A · B · C · D                        ║
// ╠══════════════════════════════════════════════════════════════════╣
// ║  A. Auto-renovación silenciosa del token                        ║
// ║  B. Alerta de localStorage lleno (< 10% libre)                  ║
// ║  C. Cola de guardados pendientes offline                        ║
// ║  D. Guardado de emergencia al cerrar pestaña (beforeunload)     ║
// ╚══════════════════════════════════════════════════════════════════╝
// ─── A. AUTO-RENOVACIÓN SILENCIOSA DEL TOKEN ────────────────────────────────
// El token OAuth implícito dura 3600 s. Este watcher lo renueva 5 minutos
// antes de que expire abriendo un popup silencioso (prompt:'none') para que
// el navegador renueve sin que el usuario tenga que hacer nada.
// Si el popup falla (bloqueador de pop-ups, sesión expirada, etc.) avisa con
// un toast para que el usuario conecte manualmente.
/* ─── DESACTIVADO POST-MIGRACIÓN A SUPABASE ─────────────────────────────────
   Este bloque era para renovación de tokens OAuth (ya no aplica, Supabase gestiona su propia sesión):
   Supabase maneja su propia sesión vía SB.auth (onAuthStateChange) y
   refresca tokens automáticamente. Se conserva comentado por historial.
(function iniciarAutoRenovacionToken_DEPRECATED() {
  // Lógica original de popup OAuth Google eliminada tras migración.
  // Supabase Auth SDK ya gestiona renovación de sesión automáticamente.
})();
─────────────────────────────────────────────────────────────────────────── */
// ─── B. ALERTA DE LOCALSTORAGE LLENO (< 10 % LIBRE) ────────────────────────
// localStorage típico = 5-10 MB. Calculamos el espacio usado iterando las claves
// y estimamos el total permitido. Si queda menos del 10 %, mostramos un toast
// de advertencia (máx. 1 vez por sesión para no spamear).
(function iniciarMonitorLocalStorage() {
  // Deshabilitado — localStorage eliminado definitivamente; los datos viven en Supabase y R2
})();
// ─── C. COLA DE GUARDADOS PENDIENTES OFFLINE ────────────────────────────────
// Si syncEstadoSupabase falla por red, los cambios se encolan.
// Cuando se restablece la conexión O se renueva el token, la cola se drena
// automáticamente (máx. 1 intento activo a la vez, con retroceso exponencial).
(function iniciarColaOffline() {
  // Cola en memoria (no localStorage) — se reinicia al recargar la página
  const MAX_ITEMS   = 20;
  let   _cola       = [];
  let   _drenando   = false;
  let   _reintento  = 0;
  window._encolarGuardadoPendiente = function(tipo, payload) {
    const idx = _cola.findIndex(i => i.tipo === tipo);
    const item = { tipo, payload, ts: Date.now() };
    if (idx >= 0) { _cola[idx] = item; }
    else { _cola.push(item); while (_cola.length > MAX_ITEMS) _cola.shift(); }
    if (typeof setSyncState === 'function') setSyncState('pending');
    console.log('[Queue] Guardado encolado (Supabase):', tipo, '— cola:', _cola.length);
  };
  window._drenaQueue = async function() {
    if (_drenando) return;
    if (!sbSession || Date.now() >= sbExpiry) return;
    if (!navigator.onLine) return;
    if (!_cola.length) return;
    _drenando = true;
    console.log('[Queue] Drenando cola —', _cola.length, 'ítems pendientes...');
    for (const item of [..._cola]) {
      try {
        if (item.tipo === 'syncEstado') await syncEstadoSupabase();
        if (item.tipo === 'actualizarArchivoControl' && typeof actualizarArchivoControl === 'function')
          await actualizarArchivoControl();
      } catch(e) {
        console.warn('[Queue] Error drenando ítem:', item.tipo, e);
        _drenando = false;
        const delay = Math.min(Math.pow(2, _reintento) * 15000, 8 * 60 * 1000);
        _reintento++;
        setTimeout(_drenaQueue, delay);
        return;
      }
    }
    _cola = [];
    _reintento = 0;
    _drenando  = false;
    console.log('[Queue] ✓ Cola drenada exitosamente');
    toast('☁ Cambios pendientes sincronizados con Supabase ✓', 'ok');
    if (typeof setSyncState === 'function') setSyncState('idle');
  };
  window.addEventListener('online', function() { setTimeout(_drenaQueue, 3000); });
  setInterval(function() { if (sbSession && Date.now() < sbExpiry && navigator.onLine) _drenaQueue(); }, 30 * 1000);
})();
// ─── D. GUARDADO DE EMERGENCIA AL CERRAR PESTAÑA (beforeunload) ─────────────
// El evento beforeunload es muy restrictivo en navegadores modernos:
// no permite operaciones asíncronas largas. Usamos sendBeacon (no bloqueante)
// para enviar el estado a la API de Supabase. Si falta el token también se
// almacena el estado en localStorage como respaldo de último recurso.
(function iniciarGuardadoEmergencia() {
  let _hayPendientes = false;
  // Marcar que hay cambios sin confirmar (se llama desde guardarTodo)
  window._marcarCambiosPendientes = function() { _hayPendientes = true; };
  window._marcarGuardadoOk       = function() { _hayPendientes = false; };
  // Interceptar syncEstadoSupabase para seguimiento de estado
  const _origSyncEmerg = window.syncEstadoSupabase;
  if (typeof _origSyncEmerg === 'function') {
    window.syncEstadoSupabase = async function() {
      try {
        const res = await _origSyncEmerg.apply(this, arguments);
        window._marcarGuardadoOk();
        return res;
      } catch(e) {
        window._marcarCambiosPendientes();
        throw e;
      }
    };
  }
  window.addEventListener('beforeunload', function(e) {
    // localStorage eliminado — datos viven exclusivamente en Supabase y R2
    // ── 2. Intentar enviar a Supabase con keepalive si hay sesión válida ───
    if (!_hayPendientes) return; // nada pendiente — no interrumpir
    if (!window.SB || !window.SB_DESPACHO_ID) return;
    try {
      // Limpiar movimientos sintéticos antes de persistir
      const movsLimpios = (D.movimientos||[]).filter(m => m && m.id && !/^R-\d+$/.test(m.id));
      const estado = {
        movimientos:    movsLimpios,
        directorio:     D.directorio    || [],
        carpetas:       D.carpetas      || [],
        juicios:        D.juicios       || [],
        pendientes:     D.pendientes    || [],
        citas:          D.citas         || [],
        prestamos:      D.prestamos     || [],
        saldoAcumulado: D.saldoAcumulado || 0
      };
      const recibos = {
        folioActual: (typeof REC !== 'undefined' && REC.folioActual) ? REC.folioActual : (appData.folioActual || 100),
        recibos:     appData.recibos || []
      };
      // Obtener el access token actual de Supabase desde localStorage
      const sessionKey = 'lex-supabase-auth';
      let accessToken = '';
      try {
        const ses = JSON.parse(localStorage.getItem(sessionKey)||'{}');
        accessToken = ses.access_token || (ses.currentSession && ses.currentSession.access_token) || '';
      } catch(e){ registrarError('catch vacio', e); }
      if(!accessToken) return;
      const url = SUPABASE_URL + '/rest/v1/app_state?despacho_id=eq.' + window.SB_DESPACHO_ID;
      fetch(url, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          data: estado,
          recibos: recibos,
          folio_actual: recibos.folioActual
        }),
        keepalive: true
      });
      console.log('[Emergency] Guardado de emergencia enviado a Supabase');
    } catch(err) {
      console.warn('[Emergency] Error en guardado de emergencia:', err);
    }
    // NO llamar e.preventDefault() ni asignar e.returnValue
  });
  // Marcar como pendiente cada vez que se modifica D (intercepciones ligeras)
  const _origSave = window.save;
  if (typeof _origSave === 'function') {
    window.save = function() {
      window._marcarCambiosPendientes();
      return _origSave.apply(this, arguments);
    };
  }
})();
// ═══ AUDITORÍA DEL SISTEMA ═══
const AUDITORIA_KEY = 'lex_auditoria';
const AUDITORIA_MAX = 500; // máximo de eventos a conservar
function auditoriaRegistrar(tipo, detalle) {
  try {
    const usuario = empleadoActual ? empleadoActual.nombre : (NOMBRE_TITULAR || '—');
    const fecha = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const evento = { ts: Date.now(), fecha, usuario, tipo, detalle };
    let log = [];
    try { log = JSON.parse(localStorage.getItem(AUDITORIA_KEY) || '[]'); } catch(e){ registrarError('catch vacio', e); }
    log.unshift(evento);
    if (log.length > AUDITORIA_MAX) log = log.slice(0, AUDITORIA_MAX);
    try{ localStorage.setItem(AUDITORIA_KEY, JSON.stringify(log)); } catch(e){ registrarError('localStorage.setItem', e); }
} catch(e) { console.warn('[Auditoría] Error registrando:', e); }
}
// Interceptar acciones clave para registrar en auditoría
(function interceptarAuditoria() {
  // Login
  const _origObtener = window.obtenerDespachoActivo;
  if (typeof _origObtener === 'function') {
    window.obtenerDespachoActivo = async function() {
      const res = await _origObtener.apply(this, arguments);
      const email = empleadoActual ? empleadoActual.email : '—';
      auditoriaRegistrar('login', 'Inicio de sesión — ' + email);
      setTimeout(lexRealtimeConectar, 1500);
      return res;
    };
  }
})();
function adminAbrirAuditoria() {
  document.querySelectorAll('#adminModal .admin-panel').forEach(z => { z.style.display = ''; z.classList.remove('show'); });
  const zona = document.getElementById('adminAuditoriaZone');
  if (zona) zona.classList.add('show');
  document.getElementById('auditoria-buscar').value = '';
  document.getElementById('auditoria-tipo').value = '';
  auditoriaFiltrar();
}
function adminVolverDesdeAuditoria() {
  document.querySelectorAll('#adminModal .admin-panel').forEach(z => { z.style.display = ''; z.classList.remove('show'); });
  adminMostrarPanel();
}
function auditoriaFiltrar() {
  const q    = (document.getElementById('auditoria-buscar')?.value || '').toLowerCase().trim();
  const tipo = (document.getElementById('auditoria-tipo')?.value || '');
  let log = [];
  try { log = JSON.parse(localStorage.getItem(AUDITORIA_KEY) || '[]'); } catch(e){ registrarError('catch vacio', e); }
  const iconos = { impresion:'🖨', abono:'💰', cancelacion:'🚫', liquidacion:'✅', edicion:'✏️', login:'🔑', complemento:'📎' };
  const colores = { impresion:'rgba(200,149,42,0.15)', abono:'rgba(26,122,58,0.15)', cancelacion:'rgba(192,22,26,0.15)', liquidacion:'rgba(26,122,58,0.2)', edicion:'rgba(90,58,138,0.15)', login:'rgba(26,74,138,0.15)', complemento:'rgba(200,149,42,0.1)' };
  const filtrados = log.filter(e => {
    if (tipo && e.tipo !== tipo) return false;
    if (q && !(e.usuario||'').toLowerCase().includes(q) && !(e.detalle||'').toLowerCase().includes(q) && !(e.tipo||'').toLowerCase().includes(q)) return false;
    return true;
  });
  const lista = document.getElementById('auditoria-lista');
  const count = document.getElementById('auditoria-count');
  if (!lista) return;
  if (!filtrados.length) {
    lista.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(200,149,42,0.4);font-family:JetBrains Mono,monospace;font-size:0.72rem;">Sin registros</div>';
    if (count) count.textContent = '';
    return;
  }
  lista.innerHTML = filtrados.map(e => {
    const ico = iconos[e.tipo] || '📋';
    const bg  = colores[e.tipo] || 'rgba(200,149,42,0.07)';
    return '<div style="background:' + bg + ';border:1px solid rgba(200,149,42,0.12);border-radius:8px;padding:9px 12px;margin-bottom:6px;">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">'
      + '<span style="font-size:0.85rem;">' + ico + '</span>'
      + '<span style="font-family:JetBrains Mono,monospace;font-size:0.6rem;color:rgba(200,149,42,0.5);">' + escHTML(e.fecha||'—') + '</span>'
      + '<span style="margin-left:auto;font-family:JetBrains Mono,monospace;font-size:0.58rem;color:var(--gold-l);background:rgba(200,149,42,0.12);border-radius:4px;padding:1px 7px;">' + escHTML(e.usuario||'—') + '</span>'
      + '</div>'
      + '<div style="font-size:0.76rem;color:rgba(253,250,244,0.8);font-family:Outfit,sans-serif;">' + escHTML(e.detalle||'—') + '</div>'
      + '</div>';
  }).join('');
  if (count) count.textContent = filtrados.length + ' de ' + log.length + ' registros';
}
function auditoriaExportar() {
  try {
    let log = JSON.parse(localStorage.getItem(AUDITORIA_KEY) || '[]');
    if (!log.length) { toast('No hay registros de auditoría', 'err'); return; }
    const csv = ['Fecha,Usuario,Tipo,Detalle']
      .concat(log.map(e => [e.fecha, e.usuario, e.tipo, '"' + (e.detalle||'').replace(/"/g,"'") + '"'].join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'auditoria_lexmexico.csv'; a.click();
    URL.revokeObjectURL(url);
    toast('✓ Auditoría exportada', 'ok');
  } catch(e) { toast('Error al exportar', 'err'); }
}
// ═══ FIN AUDITORÍA ═══

// ══════════════════════════════════════════════════════════════
// VSL — Vigilancia de Sesiones y Log + Google Drive
// ══════════════════════════════════════════════════════════════
const VSL_DRIVE_FOLDER_NAME = 'VSL_LEX';
const VSL_AUTOSAVE_KEY = 'vsl_ultimo_guardado_drive'; // timestamp del último guardado exitoso

(function _vslInit() {
  function _vslCheckVisible() {
    const btn = document.getElementById('nav-vsl');
    if (!btn) return;
    const esAdmin = typeof empleadoActual !== 'undefined' && empleadoActual &&
                    typeof ADMIN_EMAIL !== 'undefined' &&
                    empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    btn.style.display = esAdmin ? '' : 'none';
  }
  document.addEventListener('DOMContentLoaded', () => { setTimeout(_vslCheckVisible, 3000); });

  // Auto-guardado en Drive todos los días a las 14:00 (hora Oaxaca)
  function _vslProgramarGuardado() {
    const ahora = new Date();
    const oaxaca = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    const target = new Date(oaxaca);
    target.setHours(14, 0, 0, 0);
    if (oaxaca >= target) target.setDate(target.getDate() + 1); // ya pasó → mañana
    const msRestantes = target - oaxaca;
    console.log(`[VSL] Próximo guardado automático en ${Math.round(msRestantes/60000)} min`);
    setTimeout(async () => {
      try {
        const esAdmin = typeof empleadoActual !== 'undefined' && empleadoActual &&
                        typeof ADMIN_EMAIL !== 'undefined' &&
                        empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        if (esAdmin) {
          console.log('[VSL] Auto-guardado 14:00 iniciado...');
          await _vslGuardarDriveInterno(false);
        }
      } catch(e) { console.warn('[VSL] Error en auto-guardado:', e.message); }
      _vslProgramarGuardado(); // reprogramar para el día siguiente
    }, msRestantes);
  }
  _vslProgramarGuardado();
  const _irOrig = window.ir;
  if (typeof _irOrig === 'function') {
    window.ir = function(panel) {
      try {
        const nombres = {
          caja:'Principal', contabilidad:'Contabilidad', carpetas:'Carpetas',
          juicios:'Juicios', pendientes:'Pendientes', escrituras:'Escrituras',
          recibos:'Recibos Oficiales', directorio:'Directorio', configuracion:'Configuración',
          'nuevo-recibo':'Nuevo Recibo', gestiones:'Recibos en Gestión',
          'registro-civil':'Registro Civil', sesiones:'Monitor de Sesiones'
        };
        auditoriaRegistrar('navegacion', 'Abrió módulo: ' + (nombres[panel] || panel));
      } catch(e) {}
      _vslCheckVisible();
      return _irOrig.apply(this, arguments);
    };
  }
})();

function vslAbrir() {
  const esAdmin = typeof empleadoActual !== 'undefined' && empleadoActual &&
                  typeof ADMIN_EMAIL !== 'undefined' &&
                  empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  if (!esAdmin) return;
  // Limpiar entradas del localStorage con más de 7 días
  try {
    const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let log = JSON.parse(localStorage.getItem(AUDITORIA_KEY) || '[]');
    const antes = log.length;
    log = log.filter(e => !e.ts || e.ts >= limite);
    if (log.length < antes) {
      localStorage.setItem(AUDITORIA_KEY, JSON.stringify(log));
      console.log('[VSL] Entradas antiguas eliminadas del log local:', antes - log.length);
    }
  } catch(e) {}
  try {
    const log = JSON.parse(localStorage.getItem(AUDITORIA_KEY) || '[]');
    const usuarios = [...new Set(log.map(e => e.usuario).filter(Boolean))].sort();
    const sel = document.getElementById('vsl-usuario');
    if (sel) {
      sel.innerHTML = '<option value="">— Todos los usuarios —</option>' +
        usuarios.map(u => `<option value="${u}">${u}</option>`).join('');
    }
  } catch(e) {}
  document.getElementById('vsl-overlay').style.display = 'block';
  vslFiltrar();
}

function vslCerrar() {
  document.getElementById('vsl-overlay').style.display = 'none';
}

function vslFiltrar() {
  const q    = (document.getElementById('vsl-buscar')?.value || '').toLowerCase().trim();
  const tipo = (document.getElementById('vsl-tipo')?.value || '');
  const usr  = (document.getElementById('vsl-usuario')?.value || '');
  let log = [];
  try { log = JSON.parse(localStorage.getItem(AUDITORIA_KEY) || '[]'); } catch(e) {}

  const iconos  = { impresion:'🖨', abono:'💰', cancelacion:'🚫', liquidacion:'✅', edicion:'✏️', login:'🔑', complemento:'📎', navegacion:'🧭', folio:'📂' };
  const colores = { impresion:'rgba(200,149,42,0.13)', abono:'rgba(26,122,58,0.13)', cancelacion:'rgba(192,22,26,0.13)', liquidacion:'rgba(26,122,58,0.18)', edicion:'rgba(90,58,138,0.13)', login:'rgba(26,74,138,0.13)', complemento:'rgba(200,149,42,0.08)', navegacion:'rgba(200,149,42,0.06)', folio:'rgba(26,100,138,0.13)' };

  const filtrados = log.filter(e => {
    if (tipo && e.tipo !== tipo) return false;
    if (usr  && e.usuario !== usr) return false;
    if (q && !(e.usuario||'').toLowerCase().includes(q) && !(e.detalle||'').toLowerCase().includes(q) && !(e.tipo||'').toLowerCase().includes(q)) return false;
    return true;
  });

  const lista = document.getElementById('vsl-lista');
  const count = document.getElementById('vsl-count');
  if (!lista) return;

  if (!filtrados.length) {
    lista.innerHTML = '<div style="padding:24px;text-align:center;color:rgba(200,149,42,0.35);font-family:\'DM Mono\',monospace;font-size:0.72rem;">Sin registros para este filtro</div>';
    if (count) count.textContent = '';
    return;
  }

  lista.innerHTML = filtrados.map(e => {
    const ico = iconos[e.tipo]  || '📋';
    const bg  = colores[e.tipo] || 'rgba(200,149,42,0.06)';
    return `<div style="background:${bg};border:1px solid rgba(200,149,42,0.12);border-radius:8px;padding:9px 13px;margin-bottom:5px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
        <span style="font-size:0.85rem;">${ico}</span>
        <span style="font-family:'DM Mono',monospace;font-size:0.58rem;color:rgba(200,149,42,0.45);">${escHTML(e.fecha||'—')}</span>
        <span style="margin-left:auto;font-family:'DM Mono',monospace;font-size:0.58rem;color:#f0d080;background:rgba(200,149,42,0.12);border-radius:4px;padding:1px 8px;">${escHTML(e.usuario||'—')}</span>
        <span style="font-family:'DM Mono',monospace;font-size:0.56rem;color:rgba(200,149,42,0.4);background:rgba(0,0,0,0.2);border-radius:4px;padding:1px 6px;">${escHTML(e.tipo||'')}</span>
      </div>
      <div style="font-size:0.75rem;color:rgba(253,250,244,0.82);font-family:Outfit,sans-serif;">${escHTML(e.detalle||'—')}</div>
    </div>`;
  }).join('');

  if (count) count.textContent = filtrados.length + ' de ' + log.length + ' registros';
}

function vslLimpiar() {
  if (!confirm('¿Limpiar todo el log de vigilancia? Esta acción no se puede deshacer.')) return;
  try { localStorage.removeItem(AUDITORIA_KEY); } catch(e) {}
  vslFiltrar();
  if (typeof toast === 'function') toast('Log VSL limpiado', 'ok');
}

function vslExportar() {
  try {
    const log = JSON.parse(localStorage.getItem(AUDITORIA_KEY) || '[]');
    if (!log.length) { if (typeof toast === 'function') toast('No hay registros', 'err'); return; }
    const csv = _vslGenerarCSV(log);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'vsl_lexmexico.csv'; a.click();
    URL.revokeObjectURL(url);
    if (typeof toast === 'function') toast('✓ Log exportado', 'ok');
  } catch(e) { if (typeof toast === 'function') toast('Error al exportar', 'err'); }
}

function _vslGenerarCSV(log) {
  const bom = '\uFEFF'; // para que Excel lo abra con acentos correctos
  return bom + ['Fecha,Usuario,Tipo,Detalle']
    .concat(log.map(e => [
      '"'+(e.fecha||'').replace(/"/g,"'")+'"',
      '"'+(e.usuario||'').replace(/"/g,"'")+'"',
      '"'+(e.tipo||'').replace(/"/g,"'")+'"',
      '"'+(e.detalle||'').replace(/"/g,"'")+'"'
    ].join(',')))
    .join('\n');
}

function _vslSetDriveStatus(msg, color) {
  const el = document.getElementById('vsl-drive-status');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = 'block';
  el.style.color = color || '#8ab8f8';
  el.textContent = msg;
}

async function vslGuardarDrive() {
  await _vslGuardarDriveInterno(true); // true = mostrar feedback visual
}

async function _vslGuardarDriveInterno(conFeedback) {
  const btn = conFeedback ? document.getElementById('vsl-btn-drive') : null;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
  if (conFeedback) _vslSetDriveStatus('Conectando con Google Drive...', '#8ab8f8');
  try {
    const token = await driveGetAccessToken();
    if (!token) {
      if (conFeedback) _vslSetDriveStatus('⚠ Sin acceso a Drive. Autoriza en el Panel Admin.', '#e09060');
      if (btn) { btn.disabled = false; btn.textContent = '📁 Guardar en Drive'; }
      return;
    }
    let folderId = await _vslBuscarOCrearCarpeta(token, VSL_DRIVE_FOLDER_NAME, 'root');
    if (!folderId) throw new Error('No se pudo crear la carpeta VSL_LEX');
    const log = JSON.parse(localStorage.getItem(AUDITORIA_KEY) || '[]');
    if (!log.length) {
      if (conFeedback) _vslSetDriveStatus('ℹ No hay registros que guardar.', '#d4b870');
      if (btn) { btn.disabled = false; btn.textContent = '📁 Guardar en Drive'; }
      return;
    }
    const csv = _vslGenerarCSV(log);
    const hoy = new Date().toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', year:'numeric', month:'2-digit', day:'2-digit' }).split('/').reverse().join('-');
    const fileName = `vsl_log_${hoy}.csv`;
    if (conFeedback) _vslSetDriveStatus('Buscando archivo existente...', '#8ab8f8');
    const existId = await _vslBuscarArchivo(token, fileName, folderId);
    if (conFeedback) _vslSetDriveStatus('Subiendo log a Drive...', '#8ab8f8');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    let ok = existId ? await _vslActualizarArchivo(token, existId, blob)
                     : await _vslCrearArchivo(token, fileName, folderId, blob);
    if (ok) {
      // Registrar timestamp del último guardado exitoso
      try { localStorage.setItem(VSL_AUTOSAVE_KEY, String(Date.now())); } catch(e) {}
      const eliminados = await _vslLimpiarAntiguos(token, folderId);
      const msgExtra = eliminados > 0 ? ` · ${eliminados} archivo(s) antiguos eliminados` : '';
      if (conFeedback) {
        _vslSetDriveStatus(`✓ Guardado en Drive: VSL_LEX/${fileName} (${log.length} registros)${msgExtra}`, '#70c090');
        if (typeof toast === 'function') toast('✓ Log VSL guardado en Drive', 'ok');
      }
      console.log(`[VSL] Guardado exitoso: ${fileName} (${log.length} registros)${msgExtra}`);
    } else {
      throw new Error('Fallo al subir el archivo');
    }
  } catch(e) {
    console.error('[VSL Drive]', e);
    if (conFeedback) {
      _vslSetDriveStatus('✗ Error: ' + e.message, '#e06060');
      if (typeof toast === 'function') toast('Error al guardar en Drive', 'err');
    }
  }
  if (btn) { btn.disabled = false; btn.textContent = '📁 Guardar en Drive'; }
}

async function _vslBuscarOCrearCarpeta(token, nombre, parentId) {
  // Buscar
  const q = `name='${nombre}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const r = await fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id)&pageSize=1', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const d = await r.json();
  if (d.files && d.files.length) return d.files[0].id;
  // Crear
  const cr = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] })
  });
  const cd = await cr.json();
  return cd.id || null;
}

async function _vslBuscarArchivo(token, nombre, parentId) {
  const q = `name='${nombre}' and '${parentId}' in parents and trashed=false`;
  const r = await fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id)&pageSize=1', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const d = await r.json();
  return (d.files && d.files.length) ? d.files[0].id : null;
}

async function _vslCrearArchivo(token, nombre, parentId, blob) {
  const meta = JSON.stringify({ name: nombre, parents: [parentId] });
  const form = new FormData();
  form.append('metadata', new Blob([meta], { type: 'application/json' }));
  form.append('file', blob);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form
  });
  const d = await r.json();
  return !!d.id;
}

async function _vslActualizarArchivo(token, fileId, blob) {
  const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'text/csv' }, body: blob
  });
  const d = await r.json();
  return !!d.id;
}

// Elimina archivos vsl_log_*.csv en VSL_LEX con más de 7 días
async function _vslLimpiarAntiguos(token, folderId) {
  try {
    const q = `name contains 'vsl_log_' and '${folderId}' in parents and trashed=false`;
    const r = await fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id,name,createdTime)&pageSize=100', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const d = await r.json();
    if (!d.files || !d.files.length) return 0;
    const limite = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 días en ms
    let eliminados = 0;
    for (const f of d.files) {
      const ts = new Date(f.createdTime).getTime();
      if (ts < limite) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
          method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
        });
        eliminados++;
        console.log('[VSL] Eliminado archivo antiguo:', f.name);
      }
    }
    return eliminados;
  } catch(e) {
    console.warn('[VSL] Error en limpieza automática:', e.message);
    return 0;
  }
}
// ═══ FIN VSL ═══

// Autocompletado mientras escribes + mejora de redacción + descripción automática
// Concepto: máx 5 palabras · Descripción: máx 8 palabras
// CSS del dropdown
(function _iaConceptoCSS() {
  const st = document.createElement('style');
  st.textContent = `
    .ia-dropdown {
      position:absolute;top:100%;left:0;right:0;z-index:9990;
      background:#fdfaf4;border:1.5px solid #d4b870;border-radius:8px;
      box-shadow:0 8px 28px rgba(0,0,0,0.15);overflow:hidden;margin-top:2px;
    }
    .ia-drop-item {
      padding:8px 12px;cursor:pointer;font-family:sans-serif;font-size:0.82rem;
      color:#1a1008;border-bottom:1px solid rgba(200,149,42,0.1);
      display:flex;align-items:center;gap:8px;transition:background 0.12s;
    }
    .ia-drop-item:last-child{border-bottom:none;}
    .ia-drop-item:hover,.ia-drop-item.selected{background:rgba(200,149,42,0.1);}
    .ia-drop-item .ia-drop-icon{font-size:0.7rem;opacity:0.5;flex-shrink:0;}
    .ia-drop-item .ia-drop-texto{flex:1;}
    .ia-drop-item .ia-drop-badge{font-family:monospace;font-size:0.52rem;
      background:rgba(139,92,246,0.1);color:#7c3aed;border-radius:10px;padding:1px 6px;flex-shrink:0;}
    .ia-mejora-chip {
      display:inline-flex;align-items:center;gap:5px;margin-top:3px;
      background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.25);
      border-radius:12px;padding:3px 9px;cursor:pointer;font-size:0.72rem;
      font-family:monospace;color:#7c3aed;transition:all 0.15s;
    }
    .ia-mejora-chip:hover{background:rgba(139,92,246,0.18);}
  `;
  document.head.appendChild(st);
})();
// ── Extraer conceptos históricos de recibos pasados ──────────────────
function _iaHistoricoConceptos() {
  const freq = {};
  (appData.recibos || []).forEach(r => {
    (r.conceptos || []).forEach(c => {
      const key = (c.concepto || '').trim().toUpperCase();
      if (!key) return;
      if (!freq[key]) freq[key] = { concepto: (c.concepto||'').trim(), desc: (c.descripcion||'').trim(), veces: 0 };
      freq[key].veces++;
      if (c.descripcion) freq[key].desc = c.descripcion.trim();
    });
  });
  return Object.values(freq).sort((a, b) => b.veces - a.veces);
}
// ── Timers por textarea ───────────────────────────────────────────────
const _iaTimers = new WeakMap();
// ── Input en campo concepto → mostrar dropdown ────────────────────────
function iaConceptoInput(ta) {
  const q = ta.value.trim();
  const dropdown = ta.parentElement.querySelector('.ia-dropdown');
  if (q.length < 2) { dropdown.style.display = 'none'; return; }
  clearTimeout(_iaTimers.get(ta));
  _iaTimers.set(ta, setTimeout(() => _iaConceptoBuscar(ta, q, dropdown), 350));
}
async function _iaConceptoBuscar(ta, q, dropdown) {
  // 1. Sugerencias del histórico (instantáneas, sin API)
  const historico = _iaHistoricoConceptos()
    .filter(c => c.concepto.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 3);
  _iaDropdownRender(dropdown, ta, historico, true);
  // 2. Sugerencias de Groq (async) — solo si hay key disponible
  const groqKey = typeof _groqGetKey === 'function' ? _groqGetKey() : '';
  if (!groqKey || groqKey.length < 10) {
    if (historico.length) _iaDropdownRender(dropdown, ta, historico, false);
    return;
  }
  if ((window._geminiCooldownHasta || 0) > Date.now()) {
    if (historico.length) _iaDropdownRender(dropdown, ta, historico, false);
    return;
  }
  try {
    const histCtx = _iaHistoricoConceptos().slice(0, 15).map(c => c.concepto).join(', ');
    const prompt = `Eres asistente de un despacho legal mexicano. El usuario escribe "${q}" en el campo concepto de un recibo.
Genera exactamente 3 sugerencias de concepto. Reglas ESTRICTAS:
- Máximo 5 palabras cada una
- Lenguaje legal mexicano formal
- Variadas entre sí
- Basadas en el contexto: "${q}"
- El despacho ya ha usado: ${histCtx || 'sin historial'}
Responde SOLO con JSON: {"sugerencias":["concepto 1","concepto 2","concepto 3"]}`;
    const txt = await _iaLlamar(prompt, 400, 0.2, 'administrativo');
    const parsed = JSON.parse(txt.replace(/```json|```/g,'').trim());
    const sugsIA = (parsed.sugerencias || []).slice(0, 3)
      .map(s => ({ concepto: s.trim(), desc: '', veces: 0, esIA: true }));
    const yaEnHistorico = new Set(historico.map(h => h.concepto.toLowerCase()));
    const nuevas = sugsIA.filter(s => !yaEnHistorico.has(s.concepto.toLowerCase()));
    const todas = [...historico, ...nuevas].slice(0, 5);
    _iaDropdownRender(dropdown, ta, todas, false);
  } catch(e) {
    if (historico.length) _iaDropdownRender(dropdown, ta, historico, false);
  }
}
function _iaDropdownRender(dropdown, ta, items, cargando) {
  if (!items.length && !cargando) { dropdown.style.display = 'none'; return; }
  let html = items.map((item, i) =>
    `<div class="ia-drop-item" data-idx="${i}"
      onmousedown="event.preventDefault();iaSeleccionarConcepto(this,'${escHTML(item.concepto)}','${escHTML(item.desc || '')}')">
      <span class="ia-drop-icon">${item.veces > 0 ? '🕐' : '✨'}</span>
      <span class="ia-drop-texto">${escHTML(item.concepto)}</span>
      ${item.veces > 0 ? `<span class="ia-drop-badge">${item.veces}x</span>` : '<span class="ia-drop-badge">IA</span>'}
    </div>`
  ).join('');
  if (cargando) html += `<div class="ia-drop-item" style="opacity:0.4;cursor:default;font-size:0.72rem;">✨ Buscando más...</div>`;
  dropdown.innerHTML = html;
  dropdown.style.display = 'block';
}
// ── Seleccionar sugerencia del dropdown ───────────────────────────────
function iaSeleccionarConcepto(el, concepto, desc) {
  const td = el.closest('td');
  const ta = td.querySelector('textarea.concepto');
  const dropdown = td.querySelector('.ia-dropdown');
  ta.value = concepto;
  dropdown.style.display = 'none';
  // A petición expresa: NUNCA tocar Descripción al aceptar una sugerencia de
  // Concepto. Antes, si Descripción estaba vacía, se rellenaba sola (con el
  // texto histórico de OTRO folio, o con una generada por IA) sin que el
  // usuario lo pidiera. El usuario debe poder escribir lo que quiera ahí, o
  // dejarla en blanco a propósito, sin que el sistema la sobreescriba.
  if (typeof autoCalcTotal === 'function') autoCalcTotal();
  if (typeof calcularTotales === 'function') calcularTotales();
}
// ── Keydown para navegar dropdown con teclado ─────────────────────────
function iaSugerenciaKeydown(e, ta) {
  const dropdown = ta.parentElement.querySelector('.ia-dropdown');
  if (dropdown.style.display === 'none') return;
  const items = dropdown.querySelectorAll('.ia-drop-item[data-idx]');
  const sel = dropdown.querySelector('.ia-drop-item.selected');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!sel) { items[0]?.classList.add('selected'); }
    else { sel.classList.remove('selected'); (sel.nextElementSibling || items[0])?.classList.add('selected'); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!sel) { items[items.length-1]?.classList.add('selected'); }
    else { sel.classList.remove('selected'); (sel.previousElementSibling || items[items.length-1])?.classList.add('selected'); }
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    const activeSel = dropdown.querySelector('.ia-drop-item.selected');
    if (activeSel) {
      e.preventDefault();
      activeSel.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    } else {
      dropdown.style.display = 'none';
    }
  } else if (e.key === 'Escape') {
    dropdown.style.display = 'none';
  }
}
// ── Blur en concepto → mejorar redacción si es texto libre ───────────
async function iaConceptoBlur(ta) {
  const dropdown = ta.parentElement.querySelector('.ia-dropdown');
  setTimeout(() => { dropdown.style.display = 'none'; }, 200);
  const texto = ta.value.trim();
  if (!texto || texto.split(' ').length > 6) return;
  // Si ya es del histórico, está bien — no mejorar
  const historico = _iaHistoricoConceptos();
  if (historico.some(h => h.concepto.toLowerCase() === texto.toLowerCase())) return;
  // Groq disponible?
  const groqKey = typeof _groqGetKey === 'function' ? _groqGetKey() : '';
  if (!groqKey || groqKey.length < 10) return;
  if ((window._geminiCooldownHasta || 0) > Date.now()) return;
  try {
    const prompt = `El usuario escribió este concepto de recibo legal: "${texto}"
Sugiere UNA versión mejor redactada. Reglas: máximo 5 palabras, formal, legal mexicano.
Responde SOLO con JSON: {"mejora":"concepto mejorado"}`;
    const txt = await _iaLlamar(prompt, 300, 0.2, 'administrativo');
    const parsed = JSON.parse(txt.replace(/```json|```/g,'').trim());
    const mejora = (parsed.mejora || '').trim();
    if (!mejora || mejora.toLowerCase() === texto.toLowerCase()) return;
    const td = ta.parentElement;
    let chip = td.querySelector('.ia-mejora-chip');
    if (!chip) { chip = document.createElement('div'); td.appendChild(chip); }
    chip.className = 'ia-mejora-chip';
    chip.innerHTML = `✨ <span>${escHTML(mejora)}</span> <span style="opacity:0.5;font-size:0.6rem;">← Aceptar</span>`;
    chip.onclick = () => {
      ta.value = mejora;
      chip.remove();
      // A petición expresa: ya no se autorellena Descripción aquí tampoco —
      // solo se mejora el texto de Concepto que ya escribió el usuario.
    };
  } catch(e) { /* silencioso */ }
}
// ── Blur en descripción → mejorar SOLO si el usuario ya escribió algo ─
async function iaDescBlur(ta) {
  const texto = ta.value.trim();
  // A petición expresa: si el usuario deja Descripción en blanco, se queda en
  // blanco. Antes, un campo vacío disparaba un autorellenado (histórico de
  // OTRO folio o generado por IA) sin que nadie lo pidiera — ahora el campo
  // solo cambia si el propio usuario escribe algo en él.
  if (!texto) return;
  // Campo con texto: Groq sugiere versión más concisa
  const groqKey = typeof _groqGetKey === 'function' ? _groqGetKey() : '';
  if (!groqKey || groqKey.length < 10) return;
  if ((window._geminiCooldownHasta || 0) > Date.now()) return;
  try {
    const tr = ta.closest('tr');
    const concepto = tr?.querySelector('textarea.concepto')?.value?.trim() || '';
    const prompt = `Concepto del recibo: "${concepto}". Descripción escrita por el usuario: "${texto}".
Reescribe la descripción de forma más clara y profesional. Reglas: máximo 8 palabras, complementa el concepto sin repetirlo, lenguaje legal mexicano.
Responde SOLO con JSON: {"descripcion":"texto mejorado"}`;
    const txt = await _iaLlamar(prompt, 300, 0.2, 'administrativo');
    const parsed = JSON.parse(txt.replace(/```json|```/g,'').trim());
    const mejora = (parsed.descripcion || '').trim();
    if (!mejora || mejora.toLowerCase() === texto.toLowerCase()) return;
    const td = ta.parentElement;
    let chip = td.querySelector('.ia-mejora-chip');
    if (!chip) { chip = document.createElement('div'); td.appendChild(chip); }
    chip.className = 'ia-mejora-chip';
    chip.innerHTML = `✨ <span>${escHTML(mejora)}</span> <span style="opacity:0.5;font-size:0.6rem;">← Aceptar</span>`;
    chip.onclick = () => { ta.value = mejora; chip.remove(); };
  } catch(e) { /* silencioso */ }
}
// NOTA: _iaGenerarDescripcion() (autorellenaba Descripción con texto
// histórico de otro folio o generado por IA) se quitó a petición expresa —
// ver iaSeleccionarConcepto, iaConceptoBlur e iaDescBlur arriba. Descripción
// ahora solo cambia si el usuario mismo escribe algo ahí.
// ═══ FIN IA PREDICTIVA DE CONCEPTOS ═══
// ── MODAL GENÉRICO PARA RESPUESTAS IA ────────────────────────────────
function _iaMostrarModal(titulo, contenidoHTML) {
  let ov = document.getElementById('ia-modal-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ia-modal-ov';
    ov.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(12,9,5,0.75);z-index:9999;align-items:center;justify-content:center;padding:20px;';
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <div style="background:var(--surface);border:1.5px solid rgba(139,92,246,0.35);border-radius:12px;width:100%;max-width:580px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,0.5);">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(139,92,246,0.15);display:flex;align-items:center;gap:10px;">
        <span style="font-family:serif;font-size:1rem;color:var(--ink);flex:1;">${titulo}</span>
        <button onclick="document.getElementById('ia-modal-ov').remove()" style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:6px;padding:5px 12px;cursor:pointer;font-family:monospace;font-size:0.6rem;color:#7c3aed;">✕ Cerrar</button>
      </div>
      <div style="padding:20px;overflow-y:auto;flex:1;">${contenidoHTML}</div>
      <div style="padding:10px 20px;border-top:1px solid rgba(139,92,246,0.1);font-family:monospace;font-size:0.5rem;color:rgba(139,92,246,0.4);text-align:center;">Generado por IA · Groq</div>
    </div>`;
  if (!document.getElementById('ia-pulse-style')) {
    const st = document.createElement('style');
    st.id = 'ia-pulse-style';
    st.textContent = '@keyframes ia-pulse{0%,100%{opacity:1}50%{opacity:0.4}}';
    document.head.appendChild(st);
  }
}
// ═══════════════════════════════════════════════════════════════════════
// ⚖️ PERFILES DE ABOGADO — "system prompt" jurídico especializado por tarea
// Cada función de IA del sistema usa un perfil distinto (no uno genérico
// para todo) para que la IA razone con el enfoque correcto de esa tarea
// específica: un perfil que detecta plazos no es el mismo que redacta un
// escrito o el que resume un expediente para el cliente. Se inyecta como
// mensaje role:"system" antes del prompt de cada llamada.
// ═══════════════════════════════════════════════════════════════════════
const _PERFILES_ABOGADO = {
  general: 'Eres un abogado litigante mexicano con más de 20 años de experiencia en derecho civil, familiar, mercantil, penal y procesal, asistiendo a un despacho jurídico real. Nunca inventas artículos, plazos, fechas, montos ni nombres: si un dato no aparece explícitamente en lo que se te da, dices "no consta" en vez de adivinar. Usas terminología jurídica mexicana correcta. Eres directo y eficiente. Cuando se te pide un formato exacto (JSON, viñetas, campos), lo respetas al pie de la letra sin texto fuera de ese formato.',

  procesal: 'Eres un abogado procesalista mexicano experto en derecho procedimental (civil, familiar, mercantil y penal), especializado en desglosar códigos y leyes en flujos de procedimiento paso a paso. Tu trabajo es leer el TEXTO REAL de una ley y extraer las etapas exactas del procedimiento que corresponde, citando artículo por artículo tal como aparecen en el documento — jamás de memoria ni por conocimiento general. Si un plazo o artículo no está en el texto que se te dio, escribes "no especificado en la ley"; nunca lo completas con lo que "normalmente" dice la ley. Localizas el capítulo o título específico del tipo de juicio solicitado y no mezclas etapas de otros procedimientos del mismo código.',

  plazos: 'Eres un abogado litigante mexicano especializado en el control de términos y plazos procesales. Lees notificaciones, acuerdos y autos judiciales para detectar: qué ordena el juzgado, qué debe hacer el abogado, y en cuántos días (hábiles o naturales) vence el plazo. Eres extremadamente conservador: si la fecha, el plazo o la actuación no están claramente indicados en el texto, marcas confianza "baja" y dejas el dato vacío o en 0 en vez de inventarlo — un plazo mal calculado puede causar que el despacho pierda un derecho procesal, así que la precisión importa más que completar todos los campos.',

  analisis_acuerdo: 'Eres un abogado litigante mexicano especializado en clasificar y resumir resoluciones judiciales (acuerdos, autos, sentencias, notificaciones, requerimientos). De cada documento extraes: qué tipo de resolución es, la fecha, qué ordena o resuelve el juez, los plazos relevantes y a quién afecta. Tu resumen debe ser útil para que el abogado sepa de un vistazo qué debe hacer, sin tecnicismos innecesarios pero sin perder precisión jurídica. Nunca atribuyes al documento algo que no dice.',

  analisis_documento: 'Eres un analista jurídico mexicano especializado en expedientes judiciales extensos (demandas, sentencias, actuaciones). Tu trabajo es leer el documento completo y producir un informe estructurado: título del acuerdo, expediente, juzgado, partes involucradas, fechas clave, montos (pensión, compensación, etc.), resumen ejecutivo, puntos importantes, plazos y observaciones urgentes para el abogado. Eres exhaustivo — prefieres incluir de más que omitir un dato relevante — pero cada dato que reportas debe estar en el texto; si algo no consta, lo dices explícitamente en vez de rellenarlo.',

  resumen_estrategico: 'Eres un abogado litigante mexicano con 20 años de experiencia que asesora tanto al despacho como al cliente. Analizas acuerdos judiciales con rigor técnico y generas un informe con: resumen ejecutivo del caso, puntos clave, recomendaciones prácticas para el cliente (sin tecnicismos) y recomendaciones estratégicas para el abogado (argumentos, diligencias, riesgos procesales). Consideras las leyes aplicables al caso cuando se te indican. Vas al grano y priorizas utilidad práctica sobre relleno.',

  acciones: 'Eres un abogado litigante mexicano experto en estrategia procesal. A partir del resumen o estado de un expediente, generas una lista corta y concreta de ACCIONES INMEDIATAS que el abogado debe realizar — cada una específica, accionable y con plazo si existe. No repites el resumen, no das contexto de más: solo la lista de acciones, priorizadas por urgencia.',

  redaccion: 'Eres un abogado litigante mexicano experto en redacción de escritos judiciales (promociones, contestaciones, recursos, oficios). Escribes con la estructura, formalidad y terminología que exige la práctica forense mexicana. Cuando el usuario te pide generar o modificar un escrito, produces texto listo para revisión del abogado, técnicamente correcto y bien fundamentado, citando artículos solo cuando tienes certeza de ellos.',

  consulta: 'Eres un abogado litigante mexicano experto que responde preguntas puntuales de otro abogado sobre un expediente o situación jurídica. Respondes con precisión técnica, mencionando riesgos y alternativas cuando aplique, y evitando afirmaciones categóricas cuando la respuesta depende de hechos que no conoces — en ese caso, señalas qué información falta.',

  administrativo: 'Eres el asistente administrativo de un despacho jurídico mexicano, especializado en redactar de forma formal y precisa los conceptos y descripciones de recibos y cobros legales. Usas lenguaje legal mexicano correcto pero breve — el usuario necesita frases cortas y profesionales, no párrafos.'
};
function _perfilPrompt(perfil){ return _PERFILES_ABOGADO[perfil] || _PERFILES_ABOGADO.general; }
// ═══════════════════════════════════════════════════════════════════════
// 🚀 GROQ IA — Proveedor principal de IA (gratis, rápido)
// Modelo: openai/gpt-oss-120b (antes llama-3.3-70b-versatile, dado de baja
// por Groq el 16/ago/2026 — ver console.groq.com/docs/deprecations)
// Fallback: Gemini si Groq falla o no tiene key
// ═══════════════════════════════════════════════════════════════════════
// En esta copia segura, las llaves privadas de IA solo viven durante la
// sesión de la pestaña. No se leen ni se escriben en localStorage/Supabase.
function _secretSessionGet(key){
  try { return sessionStorage.getItem(key) || ''; } catch(_) { return ''; }
}
function _secretSessionSet(key, value){
  try { sessionStorage.setItem(key, value); return true; } catch(_) { return false; }
}
function _secretSessionRemove(key){
  try { sessionStorage.removeItem(key); } catch(_) {}
}

window._groqKeyCached = window._groqKeyCached || '';
// ── Cargar key de Groq solo desde la sesión actual ────────────────────
async function _cargarGroqKey(){
  const fromSession = _secretSessionGet('lex-groq-key');
  if(fromSession.length > 10) window._groqKeyCached = fromSession;
}
function _groqGetKey(){
  return window._groqKeyCached
    || _secretSessionGet('lex-groq-key')
    || (document.getElementById('cfg-groq-key')?.value || '').trim()
    || '';
}
function _groqSaveKey(k){
  k = k.trim();
  if(!k) return;
  _secretSessionSet('lex-groq-key', k);
  window._groqKeyCached = k;
  if(typeof toast === 'function') toast('🚀 Groq activo durante esta sesión','ok');
}
// ── Llamada principal a Groq ───────────────────────────────────────────
async function _groqLlamar(prompt, maxTokens, temperatura, perfil){
  const key = _groqGetKey();
  if(!key || key.length < 10) throw new Error('GROQ_SIN_KEY');
  const systemContent = _perfilPrompt(perfil);
  // Groq (plan gratis) limita a 8,000 tokens por MINUTO por petición, y ese
  // límite cuenta el texto de ENTRADA + el max_tokens de SALIDA que se pide
  // (aunque no se use todo). El valor de 12,000 que se asumía antes en otras
  // partes del código era una suposición equivocada — el real es 8,000
  // (confirmado por el error de Groq: "Limit 8000, Requested 9499..."). Aquí
  // se calcula el tamaño real de la petición y, si no cabe, se reduce
  // max_tokens automáticamente; si ni así cabe (el texto de entrada por sí
  // solo ya es demasiado grande), se lanza un error específico para que quien
  // llamó pueda usar el modelo de contexto largo de Cloudflare en su lugar.
  const TPM_MARGEN_SEGURO = 7400; // colchón bajo el límite real de 8,000
  const estTokensEntrada = Math.ceil(((systemContent||'').length + (prompt||'').length) / 4) + 30;
  let maxTokensFinal = maxTokens || 1024;
  if (estTokensEntrada + maxTokensFinal > TPM_MARGEN_SEGURO) {
    maxTokensFinal = TPM_MARGEN_SEGURO - estTokensEntrada;
    if (maxTokensFinal < 500) {
      throw new Error('GROQ_TEXTO_DEMASIADO_LARGO: el texto (~' + estTokensEntrada + ' tokens) no cabe en el límite de Groq; usa el modelo de contexto largo de Cloudflare.');
    }
    console.warn('[Groq] Petición grande: max_tokens recortado de ' + (maxTokens||1024) + ' a ' + maxTokensFinal + ' para respetar el límite de 8,000 TPM.');
  }
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key
    },
    body: JSON.stringify({
      // Groq dio de baja 'llama-3.3-70b-versatile' el 16/ago/2026 (ver
      // console.groq.com/docs/deprecations). Reemplazo oficial recomendado
      // por Groq: 'openai/gpt-oss-120b'.
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'system', content: systemContent }, { role: 'user', content: prompt }],
      max_tokens: maxTokensFinal,
      temperature: temperatura || 0.3,
      // gpt-oss-120b es un modelo de "razonamiento": antes de responder gasta
      // tokens pensando en un campo aparte (message.reasoning), tokens que
      // salen del mismo max_tokens. Con presupuestos chicos (llamadas cortas
      // tipo clasificación/JSON breve) el razonamiento se comía todo el
      // presupuesto y no quedaba nada para la respuesta → "GROQ_SIN_RESPUESTA".
      // 'low' reduce ese gasto interno para dejarle espacio a la respuesta real.
      reasoning_effort: 'low'
    })
  });
  if(!resp.ok){
    const err = await resp.json().catch(()=>({}));
    const msg = err?.error?.message || 'Error ' + resp.status;
    if(resp.status === 429 && /reduce your message size|too large|request too large/i.test(msg)) throw new Error('GROQ_TEXTO_DEMASIADO_LARGO: ' + msg);
    if(resp.status === 429) throw new Error('GROQ_RATE_LIMIT: ' + msg);
    if(resp.status === 401) throw new Error('GROQ_KEY_INVALIDA: Verifica tu API Key de Groq en ⚙️ Configuración');
    throw new Error('GROQ_ERROR: ' + msg);
  }
  const data = await resp.json();
  const texto = data?.choices?.[0]?.message?.content || '';
  if(!texto) throw new Error('GROQ_SIN_RESPUESTA');
  return texto;
}
// ═══════════════════════════════════════════════════════════════════════
// ☁️ CLOUDFLARE WORKERS AI — Respaldo de Groq + lector de documentos/imágenes
// Reemplaza a Gemini en todo el sistema. Verificado con la documentación
// oficial de Cloudflare (developers.cloudflare.com/workers-ai/platform/pricing):
// 10,000 "Neurons" gratis CADA DÍA (se renuevan solas, no es un saldo que se
// agota), sin tarjeta para el plan Free — si se acaba el cupo del día, las
// peticiones simplemente fallan hasta el día siguiente; NUNCA cobra solo.
// Requiere Account ID + API Token (se generan gratis en dash.cloudflare.com).
// ═══════════════════════════════════════════════════════════════════════
window._cfaiAccountCached = window._cfaiAccountCached || '';
window._cfaiTokenCached   = window._cfaiTokenCached   || '';
async function _cargarCfaiCreds(){
  const accountId = _secretSessionGet('lex-cfai-account');
  const token = _secretSessionGet('lex-cfai-token');
  if(accountId) window._cfaiAccountCached = accountId;
  if(token.length > 10) window._cfaiTokenCached = token;
}
function _cfaiGetAccountId(){
  return window._cfaiAccountCached || _secretSessionGet('lex-cfai-account') || (document.getElementById('cfg-cfai-account')?.value||'').trim() || '';
}
function _cfaiGetToken(){
  return window._cfaiTokenCached || _secretSessionGet('lex-cfai-token') || (document.getElementById('cfg-cfai-token')?.value||'').trim() || '';
}
function _cfaiSaveCreds(accountId, token){
  accountId = (accountId||'').trim(); token = (token||'').trim();
  if(!accountId || !token) return;
  _secretSessionSet('lex-cfai-account', accountId);
  _secretSessionSet('lex-cfai-token', token);
  window._cfaiAccountCached = accountId; window._cfaiTokenCached = token;
  if(typeof toast==='function') toast('☁️ Cloudflare Workers AI activo durante esta sesión','ok');
}
// ── UI de configuración (panel Configuración del Sistema) ──────────────
function cfaiGuardarKey(){
  const acc = (document.getElementById('cfg-cfai-account')?.value || '').trim();
  const tok = (document.getElementById('cfg-cfai-token')?.value || '').trim();
  const st  = document.getElementById('cfg-cfai-st');
  if(!acc || !tok){ if(st){ st.textContent = '⚠ Completa Account ID y API Token'; st.style.color = 'var(--rojo)'; } return; }
  _cfaiSaveCreds(acc, tok);
  if(st){ st.textContent = '✅ Guardado correctamente'; st.style.color = 'var(--verde)'; }
}
// Cloudflare a veces regresa el campo de texto (result.response /
// result.description) como string plano, pero algunos modelos con function
// calling pueden regresarlo como arreglo de partes ([{text:"..."}]) u objeto.
// Esta función normaliza cualquiera de esas formas a un string plano, para
// que nunca se rompa un .trim()/.slice() más adelante esperando texto.
function _cfaiComoTexto(v){
  if(typeof v === 'string') return v;
  if(Array.isArray(v)) return v.map(p => (typeof p === 'string' ? p : (p?.text || p?.content || ''))).join('');
  if(v && typeof v === 'object') return v.text || v.content || '';
  return v == null ? '' : String(v);
}
async function cfaiTestKey(){
  const acc = (document.getElementById('cfg-cfai-account')?.value || '').trim() || _cfaiGetAccountId();
  const tok = (document.getElementById('cfg-cfai-token')?.value || '').trim() || _cfaiGetToken();
  const st  = document.getElementById('cfg-cfai-st');
  if(!acc || !tok){ if(st){ st.textContent = '⚠ Completa Account ID y API Token'; st.style.color = 'var(--rojo)'; } return; }
  if(st){ st.textContent = '🔄 Probando conexión con Cloudflare Workers AI...'; st.style.color = 'var(--muted)'; }
  try {
    const resp = await fetch(R2_WORKER + '/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': await _r2AuthToken() },
      body: JSON.stringify({
        accountId: acc, token: tok, model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        input: { messages: [{ role:'user', content:'Responde: OK' }], max_tokens: 5 }
      })
    });
    if(resp.ok){
      if(st){ st.textContent = '✅ Cloudflare Workers AI conectado correctamente'; st.style.color = 'var(--verde)'; }
      if(typeof toast==='function') toast('✅ Cloudflare Workers AI listo','ok');
    } else {
      const e = await resp.json().catch(()=>({}));
      const msg = e?.error || ('Error '+resp.status);
      if(st){ st.textContent = '❌ ' + msg; st.style.color = 'var(--rojo)'; }
    }
  } catch(e) {
    if(st){ st.textContent = '❌ ' + e.message; st.style.color = 'var(--rojo)'; }
  }
}
// El modelo de visión (lector de imágenes/PDFs escaneados sin texto, usado
// como último recurso cuando Mistral OCR y Tesseract no pudieron leer un
// documento) exige aceptar UNA vez la licencia de Meta antes de poder usarlo
// — si no, cada llamada falla con "CFAI_KEY_INVALIDA: ... Model Agreement...".
// Cloudflare documenta esto como una petición especial con prompt:"agree".
async function cfaiAceptarLicenciaVision(){
  const acc = (document.getElementById('cfg-cfai-account')?.value || '').trim() || _cfaiGetAccountId();
  const tok = (document.getElementById('cfg-cfai-token')?.value || '').trim() || _cfaiGetToken();
  const st  = document.getElementById('cfg-cfai-st');
  if(!acc || !tok){ if(st){ st.textContent = '⚠ Completa y guarda Account ID y API Token primero'; st.style.color = 'var(--rojo)'; } return; }
  if(st){ st.textContent = '🔄 Activando el lector de imágenes (aceptando licencia de Meta)...'; st.style.color = 'var(--muted)'; }
  try {
    const resp = await fetch(R2_WORKER + '/ai/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': await _r2AuthToken() },
      body: JSON.stringify({
        accountId: acc, token: tok, model: '@cf/meta/llama-3.2-11b-vision-instruct',
        input: { prompt: 'agree' }
      })
    });
    const data = await resp.json().catch(()=>({}));
    if(resp.ok && data?.success !== false){
      if(st){ st.textContent = '✅ Lector de imágenes activado — ya puede usarse como último recurso de OCR'; st.style.color = 'var(--verde)'; }
      if(typeof toast==='function') toast('✅ Lector de imágenes de Cloudflare activado', 'ok');
    } else {
      const msg = data?.error || data?.errors?.[0]?.message || ('Error ' + resp.status);
      if(st){ st.textContent = '❌ ' + msg; st.style.color = 'var(--rojo)'; }
    }
  } catch(e) {
    if(st){ st.textContent = '❌ ' + e.message; st.style.color = 'var(--rojo)'; }
  }
}
// ── Texto: respaldo de Groq (modelo Llama 3.3 70B alojado en Cloudflare) ──
async function _cfaiLlamar(prompt, maxTokens, temperatura, perfil){
  const acc = _cfaiGetAccountId(), tok = _cfaiGetToken();
  if(!acc || !tok) throw new Error('CFAI_SIN_KEY');
  const modelo = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const resp = await fetch(R2_WORKER + '/ai/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': await _r2AuthToken() },
    body: JSON.stringify({
      accountId: acc, token: tok, model: modelo,
      input: { messages: [{ role:'system', content: _perfilPrompt(perfil) }, { role:'user', content: prompt }], max_tokens: maxTokens||1024, temperature: temperatura||0.3 }
    })
  });
  if(!resp.ok){
    const err = await resp.json().catch(()=>({}));
    const msg = err?.error || ('HTTP '+resp.status);
    if(resp.status === 401 || resp.status === 403) throw new Error('CFAI_KEY_INVALIDA: ' + msg);
    if(resp.status === 429) throw new Error('CFAI_LIMITE: Se agotó el cupo gratis de hoy (10,000 Neurons) — se renueva a medianoche UTC.');
    throw new Error('CFAI_ERROR: ' + msg);
  }
  const data = await resp.json();
  const texto = _cfaiComoTexto(data?.result?.response);
  if(!texto) throw new Error('CFAI_SIN_RESPUESTA');
  return texto;
}
// ── Texto: CONTEXTO LARGO (documentos extensos, p.ej. leer una ley completa) ──
// Mistral Small 3.1 24B — 128K tokens de contexto, dentro del cupo gratis
// diario de Cloudflare (10,000 Neurons/día, no requiere plan de pago; a
// diferencia de kimi-k2.6/k2.7-code y glm-5.2 que sí lo requieren).
// Verificado en developers.cloudflare.com/workers-ai/platform/pricing/
async function _cfaiLlamarContextoLargo(prompt, maxTokens, temperatura, perfil){
  const acc = _cfaiGetAccountId(), tok = _cfaiGetToken();
  if(!acc || !tok) throw new Error('CFAI_SIN_KEY');
  const modelo = '@cf/mistralai/mistral-small-3.1-24b-instruct';
  const resp = await fetch(R2_WORKER + '/ai/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': await _r2AuthToken() },
    body: JSON.stringify({
      accountId: acc, token: tok, model: modelo,
      input: { messages: [{ role:'system', content: _perfilPrompt(perfil) }, { role:'user', content: prompt }], max_tokens: maxTokens||4096, temperature: temperatura||0.3 }
    })
  });
  if(!resp.ok){
    const err = await resp.json().catch(()=>({}));
    const msg = err?.error || ('HTTP '+resp.status);
    if(resp.status === 401 || resp.status === 403) throw new Error('CFAI_KEY_INVALIDA: ' + msg);
    if(resp.status === 429) throw new Error('CFAI_LIMITE: Se agotó el cupo gratis de hoy (10,000 Neurons) — se renueva a medianoche UTC.');
    throw new Error('CFAI_ERROR: ' + msg);
  }
  const data = await resp.json();
  const texto = _cfaiComoTexto(data?.result?.response);
  if(!texto) throw new Error('CFAI_SIN_RESPUESTA');
  return texto;
}
// ── Visión: lee imágenes/documentos (reemplaza a Gemini Vision) ──────────
// imagenB64: base64 SIN el prefijo "data:...;base64,"
async function _cfaiVision(imagenB64, prompt, maxTokens, perfil){
  const acc = _cfaiGetAccountId(), tok = _cfaiGetToken();
  if(!acc || !tok) throw new Error('CFAI_SIN_KEY');
  const modelo = '@cf/meta/llama-3.2-11b-vision-instruct';
  // La API de Cloudflare para este modelo espera el arreglo de bytes de la
  // imagen (no una URL). Convertimos el base64 a un array de enteros.
  const binStr = atob(imagenB64);
  const bytes = new Array(binStr.length);
  for(let i=0;i<binStr.length;i++) bytes[i] = binStr.charCodeAt(i);
  // Este modelo no acepta un mensaje "system" separado (solo image + prompt),
  // así que anteponemos el perfil de abogado directo al prompt.
  const promptConPerfil = _perfilPrompt(perfil) + '\n\n' + prompt;
  const resp = await fetch(R2_WORKER + '/ai/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': await _r2AuthToken() },
    body: JSON.stringify({
      accountId: acc, token: tok, model: modelo,
      input: { image: bytes, prompt: promptConPerfil, max_tokens: maxTokens||1536 }
    })
  });
  if(!resp.ok){
    const err = await resp.json().catch(()=>({}));
    const msg = err?.error || ('HTTP '+resp.status);
    if(resp.status === 401 || resp.status === 403) throw new Error('CFAI_KEY_INVALIDA: ' + msg);
    if(resp.status === 429) throw new Error('CFAI_LIMITE: Se agotó el cupo gratis de hoy (10,000 Neurons) — se renueva a medianoche UTC.');
    throw new Error('CFAI_ERROR: ' + msg);
  }
  const data = await resp.json();
  const texto = _cfaiComoTexto(data?.result?.description || data?.result?.response);
  if(!texto) throw new Error('CFAI_SIN_RESPUESTA');
  return texto;
}
// ── Llamada con fallback automático: Groq → Cloudflare Workers AI ────────
// (Antes caía a Gemini, que resultó ser "gratis" solo hasta agotar créditos
// y luego exigía tarjeta. Cloudflare no puede cobrar sin que tú actives el
// plan de pago manualmente — ver nota arriba.)
async function _iaLlamar(prompt, maxTokens, temperatura, perfil){
  // Groq es el proveedor PRINCIPAL para texto/chat
  const groqKey = _groqGetKey();
  if(groqKey && groqKey.length > 10){
    try {
      const res = await _groqLlamar(prompt, maxTokens, temperatura, perfil);
      console.log('[IA] ✅ Respuesta via Groq');
      return res;
    } catch(e){
      if(e.message.startsWith('GROQ_KEY_INVALIDA')){
        throw new Error('🔑 Key de Groq inválida. Verifica en ⚙️ Configuración > Groq.');
      }
      if(e.message.includes('GROQ_RATE_LIMIT')){
        throw new Error('⏳ Límite de Groq alcanzado. Espera un momento e intenta de nuevo.');
      }
      // Otro error de Groq — solo advertencia, intentar Cloudflare como respaldo
      console.warn('[IA] Groq falló (' + e.message + '), intentando Cloudflare Workers AI como respaldo...');
    }
  }
  // Cloudflare Workers AI como RESPALDO (solo si Groq no está configurado o tuvo error no crítico)
  const cfAcc = _cfaiGetAccountId(), cfTok = _cfaiGetToken();
  if(!cfAcc || !cfTok){
    if(!groqKey || groqKey.length < 10){
      throw new Error('🔑 Configura Groq (gratis en console.groq.com) en ⚙️ Configuración para usar la IA.');
    }
    throw new Error('⚠ Error de Groq y sin Cloudflare Workers AI configurado como respaldo. Verifica ⚙️ Configuración.');
  }
  try {
    const res = await _cfaiLlamar(prompt, maxTokens, temperatura, perfil);
    console.log('[IA] ✅ Respuesta via Cloudflare Workers AI (respaldo)');
    return res;
  } catch(e){
    if(e.message.startsWith('CFAI_KEY_INVALIDA')) throw new Error('🔑 Credenciales de Cloudflare inválidas. Verifica en ⚙️ Configuración.');
    if(e.message.startsWith('CFAI_LIMITE')) throw new Error(e.message.replace('CFAI_LIMITE: ',''));
    throw new Error('⚠ Error de Groq y de Cloudflare (respaldo). ' + e.message);
  }
}
// Cargar key de Groq al inicio desde localStorage (Supabase se carga en onAuthStateChange)
setTimeout(async function(){
  await _cargarGroqKey();
  const gk = _groqGetKey();
  if(gk && gk.length > 10) console.log('[IA] ✅ Groq listo (localStorage):', gk.substring(0,8)+'...');
  // El warning se omite aquí — puede no haber sesión aún. Se emite en onAuthStateChange si sigue faltando.
}, 800);
// Cargar credenciales de Cloudflare Workers AI al inicio (mismo patrón que Groq)
setTimeout(async function(){
  await _cargarCfaiCreds();
  if(_cfaiGetAccountId() && _cfaiGetToken()) console.log('[IA] ✅ Cloudflare Workers AI listo (respaldo)');
}, 850);
// ═══ FIN GROQ IA ═══

// ═══════════════════════════════════════════════════════════════════════
// 📜 HISTORIAL CRONOLÓGICO — SALA DE JUICIO
// Reemplaza tabs de Acuerdos + Términos + IA por pantalla completa
// ═══════════════════════════════════════════════════════════════════════
const HJ_TIPOS = {
  escrito:       { ico: '✍️', label: 'Escrito presentado',  color: '#1a4a8a' },
  acuerdo:       { ico: '⚖️', label: 'Acuerdo judicial',    color: '#8c6518' },
  requerimiento: { ico: '📋', label: 'Requerimiento',        color: '#c0161a' },
  notificacion:  { ico: '📬', label: 'Notificación',         color: '#1a7a3a' },
  diligencia:    { ico: '🔧', label: 'Diligencia / Gestión', color: '#7c3aed' },
  audiencia:     { ico: '🏛️', label: 'Audiencia',           color: '#9a6010' },
  apelacion:     { ico: '📤', label: 'Apelación / Recurso',  color: '#c0161a' },
  nota:          { ico: '📌', label: 'Nota interna',         color: '#7a6840' }
};
// ── Abrir / cerrar formulario nueva entrada ──────────────────────────
function hjAbrirNueva() {
  const form = document.getElementById('hj-form');
  if (!form) return;
  form.style.display = 'block';
  // Fecha de hoy por defecto
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('hj-fecha').value = hoy;
  document.getElementById('hj-texto').value = '';
  document.getElementById('hj-tipo').value = 'escrito';
  document.getElementById('hj-texto').focus();
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function hjCerrarForm() {
  const form = document.getElementById('hj-form');
  if (form) form.style.display = 'none';
}
// ── Guardar nueva entrada + detectar términos con IA ─────────────────
async function hjGuardar() {
  const fecha = document.getElementById('hj-fecha').value;
  const tipo  = document.getElementById('hj-tipo').value;
  const texto = document.getElementById('hj-texto').value.trim();
  if (!fecha || !texto) { toast('Fecha y contenido son obligatorios', 'err'); return; }
  const j = D.juicios[jdetIdx];
  if (!j) return;
  if (!j.historial) j.historial = [];
  const entrada = {
    id:     'HJ-' + Date.now(),
    fecha,
    tipo,
    texto,
    ts:     Date.now()
  };
  j.historial.unshift(entrada);
  // Actualizar último movimiento del juicio
  const t = HJ_TIPOS[tipo] || HJ_TIPOS.nota;
  j.movimiento = `[${t.ico} ${t.label} · ${fecha}] ${texto.substring(0, 80)}${texto.length > 80 ? '…' : ''}`;
  try { backupLocal('D', D); } catch(e){ registrarError('catch vacio', e); }
  saveJuicios();
  hjCerrarForm();
  hjRenderLista();
  hjRenderTerminos();
  toast('Entrada guardada ✓', 'ok');
  // Detección automática de términos — reactivada. Antes usaba Gemini (riesgo
  // de facturación); ahora corre con Groq (gratis) o Cloudflare Workers AI
  // (respaldo, también sin costo salvo modelos de pago explícitamente
  // excluidos), así que ya no hace falta mantenerla apagada.
  setTimeout(() => { try { _hjDetectarTerminos(entrada, j); } catch(e){ console.warn('[Historial] Detección de términos:', e); } }, 400);
  _ocrMostrarModalNotificacion(texto);
}
// ── Detectar términos automáticamente con IA ─────────────────────────
async function _hjDetectarTerminos(entrada, j) {
  // Solo buscar en acuerdos, requerimientos y audiencias
  if (!['acuerdo','requerimiento','audiencia','notificacion'].includes(entrada.tipo)) return;
  // Verificar que haya algún motor de IA configurado (Groq o Cloudflare
  // Workers AI) — ya no depende de Gemini.
  const _groqOk = (typeof _groqGetKey==='function' ? _groqGetKey() : '').length > 10;
  const _cfaiOk = (typeof _cfaiGetAccountId==='function' && typeof _cfaiGetToken==='function') ? !!(_cfaiGetAccountId() && _cfaiGetToken()) : false;
  if (!_groqOk && !_cfaiOk) return;
  try {
    const prompt = `Eres asistente legal mexicano. Analiza este texto de un expediente judicial y detecta si menciona algún plazo, término, audiencia o fecha importante que el abogado deba registrar.
TEXTO:
"${entrada.texto}"
Si encuentras uno o más plazos o fechas, responde con JSON:
{"terminos":[{"tipo":"Audiencia|Contestación|Requerimiento|Escrito|Término|Pruebas|Apelación|Otro","descripcion":"descripción breve","fecha":"YYYY-MM-DD o null si no hay fecha exacta"}]}
Si NO hay ningún plazo o término, responde: {"terminos":[]}
Responde SOLO con el JSON, sin texto adicional.`;
    // Usar _iaLlamar: Groq primero, fallback Cloudflare Workers AI
    const txt = (await _iaLlamar(prompt, 500, 0.3, 'plazos')).trim();
    const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());
    const terminos = (parsed.terminos || []).filter(t => t.descripcion);
    if (!terminos.length) return;
    // Mostrar modal de confirmación para cada término detectado
    _hjMostrarConfirmacionTerminos(terminos, j);
  } catch(e) { /* silencioso */ }
}
// ── Modal confirmar términos detectados ──────────────────────────────
function _hjMostrarConfirmacionTerminos(terminos, j) {
  let ov = document.getElementById('hj-terminos-modal');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'hj-terminos-modal';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,9,5,0.8);z-index:9990;display:flex;align-items:center;justify-content:center;padding:20px;';
    document.body.appendChild(ov);
  }
  const items = terminos.map((t, i) => `
    <div style="background:rgba(200,149,42,0.05);border:1px solid rgba(200,149,42,0.2);border-radius:8px;padding:12px 14px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <select id="hj-tc-tipo-${i}" style="border:1px solid var(--border-l);border-radius:5px;padding:4px 8px;font-family:sans-serif;font-size:0.78rem;background:var(--surface);color:var(--ink);">
          ${['Audiencia','Contestación','Requerimiento','Escrito','Término','Pruebas','Apelación','Otro'].map(op => `<option${op===t.tipo?' selected':''}>${op}</option>`).join('')}
        </select>
        <input type="date" id="hj-tc-fecha-${i}" value="${t.fecha || ''}"
          style="border:1px solid var(--border-l);border-radius:5px;padding:4px 8px;font-family:monospace;font-size:0.75rem;background:var(--surface);color:var(--ink);">
      </div>
      <input type="text" id="hj-tc-desc-${i}" value="${esc(t.descripcion)}"
        style="width:100%;border:1px solid var(--border-l);border-radius:5px;padding:6px 10px;font-family:sans-serif;font-size:0.82rem;background:var(--surface);color:var(--ink);box-sizing:border-box;">
    </div>`).join('');
  ov.innerHTML = `
    <div style="background:var(--surface);border:1.5px solid var(--gold);border-radius:12px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border-l);display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.2rem;">✨</span>
        <span style="font-family:serif;font-size:0.95rem;color:var(--ink);">La IA detectó ${terminos.length} término${terminos.length>1?'s':''}</span>
      </div>
      <div style="padding:16px 18px;">
        <p style="font-size:0.78rem;color:var(--muted);margin-bottom:12px;">Revisa y ajusta si es necesario, luego confirma para registrarlos:</p>
        ${items}
      </div>
      <div style="padding:12px 18px;border-top:1px solid var(--border-l);display:flex;gap:8px;justify-content:flex-end;">
        <button onclick="document.getElementById('hj-terminos-modal').remove()"
          style="background:none;border:1.5px solid var(--border-l);border-radius:6px;padding:8px 18px;cursor:pointer;font-family:monospace;font-size:0.62rem;color:var(--muted);">
          Ignorar
        </button>
        <button onclick="_hjConfirmarTerminos(${terminos.length})"
          style="background:var(--gold-d);color:#fff;border:none;border-radius:6px;padding:8px 18px;cursor:pointer;font-family:monospace;font-size:0.62rem;font-weight:700;">
          ✓ Registrar términos
        </button>
      </div>
    </div>`;
}
function _hjConfirmarTerminos(count) {
  const j = D.juicios[jdetIdx];
  if (!j) return;
  if (!j.terminos) j.terminos = [];
  const nuevos = [];
  for (let i = 0; i < count; i++) {
    const tipo  = document.getElementById('hj-tc-tipo-' + i)?.value || 'Otro';
    const fecha = document.getElementById('hj-tc-fecha-' + i)?.value || '';
    const desc  = document.getElementById('hj-tc-desc-' + i)?.value?.trim() || '';
    if (!desc) continue;
    nuevos.push({ tipo, descripcion: desc, fecha });
  }
  // Usar la entrada más reciente del historial como origen
  const ultimaEntrada = (j.historial||[]).slice().sort((a,b)=>(b.ts||0)-(a.ts||0))[0];
  const origenId    = ultimaEntrada?.id    || ('manual-'+Date.now());
  const origenFecha = ultimaEntrada?.fechaResolucion || ultimaEntrada?.fecha || new Date().toISOString().split('T')[0];
  hjActualizarTerminosDesdeEntrada(nuevos, origenId, origenFecha);
  document.getElementById('hj-terminos-modal')?.remove();
  toast('✓ Términos registrados', 'ok');
}
// ── Agregar término manual ────────────────────────────────────────────
function hjAbrirTerminoManual() {
  // Reutilizar modal existente de nuevo término
  if (typeof abrirNuevoTermino === 'function') abrirNuevoTermino();
}
// ── Renderizar historial ─────────────────────────────────────────────
function hjRenderLista() {
  const j = D.juicios[jdetIdx];
  if (!j) return;
  const cont = document.getElementById('hj-lista');
  if (!cont) return;
  // Migrar acuerdos viejos al historial si existen
  if (!j.historial) {
    j.historial = [];
    if (j.acuerdos && j.acuerdos.length) {
      j.acuerdos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(a => {
        j.historial.push({
          id:    'HJ-MIG-' + a.id,
          fecha: a.fecha,
          tipo:  'acuerdo',
          texto: (a.descripcion || '') + (a.resumenIA ? '\n\n[Resumen IA] ' + a.resumenIA : ''),
          ts:    new Date(a.fecha + 'T12:00:00').getTime()
        });
      });
      j.historial.reverse();
    }
  }
  if (!j.historial.length) {
    cont.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:0.82rem;">
      <div style="font-size:2rem;margin-bottom:12px;">📜</div>
      Sin entradas aún. Agrega la primera entrada del expediente.<br>
      <span style="font-size:0.72rem;opacity:0.6;">Pega escritos presentados, resúmenes de NotebookLM, acuerdos, gestiones...</span>
    </div>`;
    return;
  }
  // ── Ordenar por fecha real del acuerdo ──
  const ordenado = [...j.historial].sort((a, b) => {
    const fa = a.fechaResolucion || a.fecha || '0000-00-00';
    const fb = b.fechaResolucion || b.fecha || '0000-00-00';
    if (fb !== fa) return fb.localeCompare(fa);
    return (b.ts || 0) - (a.ts || 0);
  });
  const hoy = new Date().toISOString().split('T')[0];
  cont.innerHTML = ordenado.map((e, i) => {
    const t = HJ_TIPOS[e.tipo] || HJ_TIPOS.nota;
    const esFuturo = (e.fechaResolucion || e.fecha) > hoy;
    // Fecha de la resolución
    const fechaResol = e.fechaResolucion || e.fecha;
    const fechaResolObj = new Date(fechaResol + 'T12:00:00');
    const fechaResolStr = fechaResolObj.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }).toUpperCase();
    // Extraer título del resumen
    const tituloMatch = e.texto.match(/📌\s*T[IÍ]TULO DEL ACUERDO:\s*(.+)/i);
    const tituloDisplay = tituloMatch
      ? tituloMatch[1].trim().toUpperCase()
      : t.label.toUpperCase();
    // Fecha de notificación
    const notifStr = e.fechaNotificacion
      ? '🔔 NOTIF. ' + new Date(e.fechaNotificacion + 'T12:00:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase()
      : '';
    const entradaId = 'hj-entry-' + e.id.replace(/[^a-z0-9]/gi,'');
    return `
    <div style="background:${t.bg||'#1a1208'};border:1.5px solid ${t.color};border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:16px;margin-bottom:8px;">
      <!-- Flecha -->
      <span id="${entradaId}-arrow" onclick="hjToggleEntrada('${entradaId}')"
        style="font-size:15px;color:${t.color};flex-shrink:0;cursor:pointer;transition:transform 0.2s;user-select:none;">▶</span>
      <!-- Datos en línea -->
      <div onclick="hjToggleEntrada('${entradaId}')"
        style="display:flex;align-items:center;gap:16px;flex:1;min-width:0;flex-wrap:wrap;cursor:pointer;user-select:none;">
        <span style="font-family:monospace;font-size:15px;font-weight:700;color:${t.color};white-space:nowrap;flex-shrink:0;">${fechaResolStr}</span>
        <span style="font-size:15px;font-weight:700;color:#fdfaf4;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(tituloDisplay)}">${esc(tituloDisplay)}</span>
        ${notifStr
          ? `<span style="font-family:monospace;font-size:15px;font-weight:700;background:rgba(26,74,138,0.15);border:1.5px solid rgba(26,74,138,0.5);border-radius:8px;padding:4px 12px;color:#1a4a8a;white-space:nowrap;flex-shrink:0;">${notifStr}</span>`
          : `<span style="font-family:monospace;font-size:13px;color:rgba(122,104,64,0.45);white-space:nowrap;flex-shrink:0;font-style:italic;">Sin notificación</span>`
        }
      </div>
      <!-- Editar -->
      <button onclick="event.stopPropagation();hjEditarEntrada('${e.id}')"
        style="background:none;border:none;cursor:pointer;color:rgba(200,149,42,0.55);font-size:14px;flex-shrink:0;padding:4px 6px;" title="Editar entrada">✏️</button>
      <!-- Eliminar -->
      <button onclick="event.stopPropagation();hjEliminar('${e.id}')"
        style="background:none;border:none;cursor:pointer;color:rgba(192,22,26,0.45);font-size:15px;flex-shrink:0;" title="Eliminar entrada">🗑️</button>
    </div>
    <!-- Cuerpo colapsado -->
    <div id="${entradaId}" style="display:none;margin-top:-4px;margin-bottom:8px;">
      <div style="background:var(--surface);border:1px solid var(--border-l);border-radius:0 0 10px 10px;padding:14px 16px;font-size:0.83rem;line-height:1.7;color:var(--ink);white-space:pre-wrap;word-break:break-word;">${esc(e.texto)}</div>
    </div>`;
  }).join('');
}
// ── Acciones sugeridas: Groq (con respaldo Cloudflare) ───────────────
async function hjLanzarAccionesSugeridas(resumen, nombreDoc) {
  const bloque   = document.getElementById('hj-acciones-bloque');
  const docLabel = document.getElementById('hj-acciones-doc');
  const divGem   = document.getElementById('hj-acciones-gemini');
  if (!bloque || !divGem) return;
  // Bloque siempre visible; abrir cuerpo y actualizar doc label
  const cuerpoAcc = document.getElementById('hj-acciones-cuerpo');
  const arrowAcc  = document.getElementById('hj-acciones-arrow');
  if (cuerpoAcc) { cuerpoAcc.style.display = 'block'; }
  if (arrowAcc)  { arrowAcc.style.transform = 'rotate(90deg)'; }
  if (docLabel) docLabel.textContent = nombreDoc || '';
  // Resetear contenido (sustituye análisis anterior)
  divGem.innerHTML  = '<span style="color:rgba(110,231,160,0.35);font-style:italic;">Consultando IA (Groq)...</span>';
  // Scroll suave hacia el bloque
  setTimeout(()=>{ bloque.scrollIntoView({ behavior:'smooth', block:'nearest' }); }, 200);
  const promptAcciones = `Eres un abogado litigante mexicano experto.
Analiza el siguiente resumen de un acuerdo judicial y genera una lista concisa de ACCIONES INMEDIATAS que el abogado debe realizar.
RESUMEN:
${resumen.substring(0, 2000)}
Responde ÚNICAMENTE con una lista de viñetas (•) de máximo 6 acciones. Cada acción debe ser específica, con plazo si existe. Sin introducción ni cierre. Solo las acciones.`;
  // ── Usar _iaLlamar: Groq primero, fallback Cloudflare Workers AI ──
  (async () => {
    try {
      const txt = await _iaLlamar(promptAcciones, 600, 0.2, 'acciones');
      if (!txt) throw new Error('Sin respuesta');
      divGem.innerHTML = txt.split('\n').filter(l=>l.trim()).map(l =>
        `<div style="display:flex;gap:6px;margin-bottom:5px;"><span style="color:rgba(110,231,160,0.6);flex-shrink:0;">•</span><span>${esc(l.replace(/^[•\-\*]\s*/,'').trim())}</span></div>`
      ).join('');
    } catch(e) {
      divGem.innerHTML = `<span style="color:rgba(192,22,26,0.6);font-size:0.72rem;">⚠ ${esc(e.message)}</span>`;
    }
  })();
}
// ── Toggle colapso del bloque Acciones Sugeridas ───────────────────
function hjToggleAcciones() {
  const cuerpo = document.getElementById('hj-acciones-cuerpo');
  const arrow  = document.getElementById('hj-acciones-arrow');
  if (!cuerpo) return;
  const abierto = cuerpo.style.display !== 'none';
  cuerpo.style.display = abierto ? 'none' : 'block';
  if (arrow) arrow.style.transform = abierto ? '' : 'rotate(90deg)';
}
// ── Toggle colapso de entrada ────────────────────────────────────────
function hjToggleEntrada(id) {
  const body  = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!body) return;
  const abierto = body.style.display !== 'none';
  body.style.display  = abierto ? 'none' : 'block';
  if (arrow) arrow.style.transform = abierto ? '' : 'rotate(90deg)';
}
// ── Modal: fecha de notificación post-OCR ───────────────────────────
function _ocrMostrarModalNotificacion(textoResumen) {
  // Extraer fecha de resolución del resumen para pre-rellenar
  const fechaMatch = textoResumen.match(/📅\s*FECHA EN QUE SE DICT[OÓ]:\s*([\d\/\-]+(?:\s+de\s+\w+\s+de\s+\d{4})?)/i);
  let fechaIso = '';
  if (fechaMatch) {
    // Intentar convertir a yyyy-mm-dd
    const raw = fechaMatch[1].trim();
    const partes = raw.match(/(\d{1,2})[\s\/\-](\d{1,2})[\s\/\-](\d{4})/);
    if (partes) fechaIso = `${partes[3]}-${partes[2].padStart(2,'0')}-${partes[1].padStart(2,'0')}`;
  }
  let ov = document.getElementById('hj-notif-modal');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'hj-notif-modal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,9,5,0.82);z-index:9995;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML = `
    <div style="background:var(--surface);border:2px solid var(--gold);border-radius:14px;width:100%;max-width:400px;box-shadow:0 24px 70px rgba(0,0,0,0.6);">
      <!-- Header -->
      <div style="padding:14px 18px;border-bottom:1px solid var(--border-l);display:flex;align-items:center;gap:10px;">
        <span style="font-size:1.4rem;">🔔</span>
        <div>
          <div style="font-family:serif;font-size:0.95rem;color:var(--ink);font-weight:600;">Fecha de Notificación</div>
          <div style="font-size:0.65rem;color:var(--muted);margin-top:1px;">¿En qué fecha fue notificado este acuerdo?</div>
        </div>
      </div>
      <!-- Body -->
      <div style="padding:20px 18px;">
        <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);display:block;margin-bottom:8px;">Fecha de notificación</label>
        <input type="date" id="hj-notif-fecha" value="${fechaIso}"
          style="width:100%;font-family:monospace;font-size:1.1rem;font-weight:700;color:var(--rojo);background:rgba(192,22,26,0.05);border:2px solid rgba(192,22,26,0.35);border-radius:8px;padding:10px 14px;box-sizing:border-box;outline:none;">
        <p style="font-size:0.68rem;color:var(--muted);margin-top:10px;line-height:1.5;">Esta fecha quedará registrada de forma destacada en el historial del expediente. Puedes omitirla si no aplica.</p>
      </div>
      <!-- Botones -->
      <div style="padding:12px 18px;border-top:1px solid var(--border-l);display:flex;gap:10px;justify-content:flex-end;">
        <button onclick="document.getElementById('hj-notif-modal').remove()"
          style="background:none;border:1.5px solid var(--border-l);border-radius:8px;padding:9px 20px;cursor:pointer;font-family:monospace;font-size:0.65rem;color:var(--muted);transition:all 0.15s;"
          onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border-l)'">
          Omitir
        </button>
        <button onclick="_ocrGuardarFechaNotif()"
          style="background:linear-gradient(135deg,var(--rojo),#a01015);color:#fff;border:none;border-radius:8px;padding:9px 22px;cursor:pointer;font-family:monospace;font-size:0.65rem;font-weight:700;letter-spacing:0.05em;box-shadow:0 4px 14px rgba(192,22,26,0.3);">
          🔔 Guardar fecha
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  setTimeout(()=>{ const inp = document.getElementById('hj-notif-fecha'); if(inp) inp.focus(); }, 100);
}
function _ocrGuardarFechaNotif() {
  const fecha = document.getElementById('hj-notif-fecha')?.value;
  if (!fecha) { document.getElementById('hj-notif-modal')?.remove(); return; }
  // Guardar en la entrada más reciente del historial del juicio activo
  const j = D.juicios && D.juicios[jdetIdx];
  if (j && j.historial && j.historial.length) {
    j.historial[0].fechaNotificacion = fecha;
    try { saveJuicios(); } catch(e){ registrarError('catch vacio', e); }
    hjRenderLista();
    toast('🔔 Fecha de notificación registrada', 'ok');
  }
  document.getElementById('hj-notif-modal')?.remove();
}
// ── Eliminar entrada del historial ───────────────────────────────────
async function hjEliminar(id) {
  const j = D.juicios[jdetIdx];
  if (!j || !j.historial) return;
  const ok = await confirmarBonito({ titulo: 'Eliminar entrada', mensaje: '¿Eliminar esta entrada del historial?', btnSi: 'Sí, eliminar', btnNo: 'Cancelar', peligro: true });
  if (!ok) return;
  j.historial = j.historial.filter(e => e.id !== id);
  if (j.terminos) j.terminos = j.terminos.filter(t => t.origenId !== id);
  saveJuicios();
  hjRenderLista();
  hjRenderTerminos();
  toast('Entrada eliminada');
}
// ── Renderizar términos en panel derecho ─────────────────────────────
// ═══════════════════════════════════════════════════════════════
// FUNCIONES NUEVAS — LEX MÉXICO
// ═══════════════════════════════════════════════════════════════
// ── hjTipoChange: mostrar/ocultar campo texto libre ──────────────
function hjTipoChange() {
  const sel = document.getElementById('hj-tipo');
  const inp = document.getElementById('hj-tipo-libre');
  if (!inp) return;
  if (sel && sel.value === 'libre') { inp.style.display='block'; inp.focus(); }
  else { inp.style.display='none'; if(inp) inp.value=''; }
}
// ── hjToggleNotif: mostrar/ocultar fecha de notificación ─────────
function hjToggleNotif() {
  const wrap = document.getElementById('hj-notif-wrap');
  const btn  = document.getElementById('btn-add-notif');
  if (!wrap) return;
  const visible = wrap.style.display !== 'none';
  wrap.style.display = visible ? 'none' : 'block';
  if (btn) btn.textContent = visible ? '+ Agregar notificación' : '− Quitar notificación';
}
// ── hjEditarEntrada: modal para editar una entrada del historial ──
function hjEditarEntrada(id) {
  const j = D.juicios[jdetIdx];
  if (!j || !j.historial) return;
  const e = j.historial.find(x => x.id === id);
  if (!e) return;
  const tituloMatch = (e.texto||'').match(/📌\s*T[IÍ]TULO DEL ACUERDO:\s*(.+)/i);
  const tituloActual = tituloMatch ? tituloMatch[1].trim() : '';
  const overlay = document.createElement('div');
  overlay.id = 'hj-edit-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = [
    '<div style="background:#1a1208;border:1.5px solid rgba(200,149,42,0.4);border-radius:12px;width:100%;max-width:560px;overflow:hidden;">',
    '<div style="padding:14px 18px;background:rgba(200,149,42,0.08);border-bottom:1px solid rgba(200,149,42,0.15);display:flex;align-items:center;gap:10px;">',
    '<span style="font-size:1rem;">✏️</span>',
    '<span style="font-family:Fraunces,serif;font-size:0.95rem;color:var(--gold-l);flex:1;">Editar entrada</span>',
    '<button id="hje-close" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:1.1rem;padding:2px 6px;">✕</button>',
    '</div>',
    '<div style="padding:16px 18px;display:flex;flex-direction:column;gap:12px;">',
    '<div>',
    '<label style="font-family:monospace;font-size:0.55rem;text-transform:uppercase;color:var(--muted);letter-spacing:0.1em;display:block;margin-bottom:5px;">Nombre / Título del documento</label>',
    '<input id="hje-titulo" type="text" placeholder="Ej: SENTENCIA DEFINITIVA..." style="width:100%;border:1.5px solid rgba(200,149,42,0.3);border-radius:7px;padding:8px 12px;font-family:Outfit,sans-serif;font-size:0.85rem;background:#110d06;color:#fdfaf4;outline:none;">',
    '</div>',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">',
    '<div><label style="font-family:monospace;font-size:0.55rem;text-transform:uppercase;color:var(--muted);letter-spacing:0.1em;display:block;margin-bottom:5px;">Fecha de la resolución</label>',
    '<input id="hje-fecha" type="date" style="width:100%;border:1.5px solid rgba(200,149,42,0.3);border-radius:7px;padding:8px 10px;font-family:monospace;font-size:0.8rem;background:#110d06;color:#fdfaf4;outline:none;"></div>',
    '<div><label style="font-family:monospace;font-size:0.55rem;text-transform:uppercase;color:var(--muted);letter-spacing:0.1em;display:block;margin-bottom:5px;">Fecha de notificación</label>',
    '<input id="hje-notif" type="date" style="width:100%;border:1.5px solid rgba(200,149,42,0.3);border-radius:7px;padding:8px 10px;font-family:monospace;font-size:0.8rem;background:#110d06;color:#fdfaf4;outline:none;"></div>',
    '</div>',
    '<div><label style="font-family:monospace;font-size:0.55rem;text-transform:uppercase;color:var(--muted);letter-spacing:0.1em;display:block;margin-bottom:5px;">Contenido</label>',
    '<textarea id="hje-texto" rows="8" style="width:100%;border:1.5px solid rgba(200,149,42,0.3);border-radius:7px;padding:8px 12px;font-family:Outfit,sans-serif;font-size:0.82rem;background:#110d06;color:#fdfaf4;outline:none;resize:vertical;line-height:1.6;"></textarea></div>',
    '<div style="display:flex;gap:8px;justify-content:flex-end;">',
    '<button id="hje-cancel" style="padding:8px 16px;border-radius:7px;border:1px solid rgba(200,149,42,0.25);background:none;color:var(--muted);cursor:pointer;font-size:0.82rem;">Cancelar</button>',
    '<button id="hje-save" style="padding:8px 18px;border-radius:7px;border:none;background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#fff;cursor:pointer;font-size:0.85rem;font-weight:600;">💾 Guardar</button>',
    '</div></div></div>'
  ].join('');
  document.body.appendChild(overlay);
  document.getElementById('hje-titulo').value = tituloActual;
  document.getElementById('hje-fecha').value  = e.fechaResolucion||e.fecha||'';
  document.getElementById('hje-notif').value  = e.fechaNotificacion||'';
  document.getElementById('hje-texto').value  = e.texto||'';
  document.getElementById('hje-close').onclick  = function(){ overlay.remove(); };
  document.getElementById('hje-cancel').onclick = function(){ overlay.remove(); };
  document.getElementById('hje-save').onclick   = function(){ hjGuardarEdicion(id, overlay); };
  overlay.addEventListener('click', function(ev){ if(ev.target===overlay) overlay.remove(); });
}
function hjGuardarEdicion(id, overlay) {
  const j = D.juicios[jdetIdx];
  if (!j || !j.historial) return;
  const e = j.historial.find(x => x.id === id);
  if (!e) return;
  const nuevoTitulo = (document.getElementById('hje-titulo')?.value||'').trim();
  const nuevaFecha  = document.getElementById('hje-fecha')?.value||'';
  const nuevaNotif  = document.getElementById('hje-notif')?.value||'';
  let   nuevoTexto  = document.getElementById('hje-texto')?.value||'';
  if (nuevoTitulo) {
    if (/📌\s*T[IÍ]TULO DEL ACUERDO:/i.test(nuevoTexto)) {
      nuevoTexto = nuevoTexto.replace(/📌\s*T[IÍ]TULO DEL ACUERDO:.+/i, '📌 TÍTULO DEL ACUERDO: '+nuevoTitulo);
    } else {
      nuevoTexto = '📌 TÍTULO DEL ACUERDO: '+nuevoTitulo+'\n'+nuevoTexto;
    }
  }
  if (nuevaFecha) { e.fechaResolucion = nuevaFecha; e.fecha = nuevaFecha; }
  e.fechaNotificacion = nuevaNotif;
  e.texto = nuevoTexto;
  saveJuicios();
  hjRenderLista();
  hjRenderTerminos();
  if (overlay) overlay.remove();
  if(typeof toast==='function') toast('✅ Entrada actualizada','ok');
}
// ── hjAbrirAccionesPanel: panel grande Acciones IA ────────────────
function hjAbrirAccionesPanel() {
  const j = D.juicios[jdetIdx];
  if (!j) return;
  const ultimaEntrada = (j.historial||[]).slice().sort((a,b)=>(b.ts||0)-(a.ts||0))[0];
  const resumen = ultimaEntrada?.texto || ('Expediente: '+(j.expediente||'')+' Cliente: '+(j.cliente||'')+' Tipo: '+(j.tipo||''));
  let panel = document.getElementById('ia-acciones-panel');
  if (panel) panel.remove();
  panel = document.createElement('div');
  panel.id = 'ia-acciones-panel';
  panel.style.cssText = 'position:fixed;top:0;right:0;bottom:0;width:calc(100vw - var(--sidebar-w,240px));background:#0c0905;z-index:500;display:flex;flex-direction:column;border-left:1px solid rgba(200,149,42,0.15);overflow:hidden;';
  panel.innerHTML = [
    '<div style="padding:16px 24px;background:rgba(45,186,88,0.06);border-bottom:1px solid rgba(45,186,88,0.2);display:flex;align-items:center;gap:12px;flex-shrink:0;">',
    '<span style="font-size:1.1rem;">⚡</span>',
    '<span style="font-family:Fraunces,serif;font-size:1.05rem;color:#6ee7a0;flex:1;">Acciones Sugeridas por IA</span>',
    '<span id="ia-panel-cliente" style="font-family:monospace;font-size:0.6rem;color:rgba(110,231,160,0.5);"></span>',
    '<button id="ia-panel-close" style="background:none;border:1px solid rgba(200,149,42,0.2);border-radius:8px;padding:4px 12px;cursor:pointer;color:var(--muted);font-size:0.75rem;">✕ Cerrar</button>',
    '</div>',
    '<div style="flex:1;overflow-y:auto;padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">',
    '<div style="background:#0a1a0f;border:1.5px solid rgba(45,186,88,0.25);border-radius:10px;overflow:hidden;">',
    '<div style="padding:10px 16px;background:rgba(45,186,88,0.1);border-bottom:1px solid rgba(45,186,88,0.15);">',
    '<span style="font-family:monospace;font-size:0.6rem;font-weight:700;color:rgba(110,231,160,0.9);letter-spacing:0.12em;text-transform:uppercase;">✦ IA — Groq</span>',
    '</div><div id="ia-panel-gemini" style="padding:16px;font-size:0.88rem;color:#c8f0d8;line-height:1.8;min-height:200px;"><span style="color:rgba(110,231,160,0.35);font-style:italic;">Analizando...</span></div></div>',
    '</div>',
    '<div style="padding:10px 24px;border-top:1px solid rgba(200,149,42,0.1);font-family:monospace;font-size:0.48rem;color:rgba(122,104,64,0.35);text-align:right;flex-shrink:0;">Groq · Llama 3.3 70B</div>'
  ].join('');
  document.body.appendChild(panel);
  document.getElementById('ia-panel-close').onclick = function(){ panel.remove(); };
  const lbl = document.getElementById('ia-panel-cliente');
  if (lbl) lbl.textContent = (j.cliente||'')+(j.expediente?' · Exp. '+j.expediente:'');
  const promptAcciones = 'Eres un abogado litigante mexicano experto.\nAnaliza el siguiente expediente y genera una lista de ACCIONES INMEDIATAS que el abogado debe realizar.\n\n'+resumen.substring(0,3000)+'\n\nResponde UNICAMENTE con viñetas (•) de máximo 8 acciones específicas con plazo si existe. Sin introducción.';
  const divGem  = document.getElementById('ia-panel-gemini');
  (async()=>{
    try{
      if(divGem) divGem.innerHTML='<span style="color:rgba(110,231,160,0.35);font-style:italic;">Consultando Groq...</span>';
      const txt = await _iaLlamar(promptAcciones, 1200, 0.3, 'acciones');
      if(divGem)divGem.innerHTML=txt.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>l.startsWith('•')?'<div style="margin-bottom:10px;padding-left:14px;position:relative;"><span style="position:absolute;left:0;color:#6ee7a0;">•</span>'+l.slice(1).trim()+'</div>':'<div style="margin-bottom:6px;">'+l+'</div>').join('');
    }catch(err){if(divGem)divGem.innerHTML='<span style="color:rgba(192,22,26,0.6);">'+esc(err.message)+'</span>';}
  })();
}
// ── ocrAnalizarTextoPlano: analiza texto pegado con IA ────────────
// Usa Groq primero (gratis, rápido), Gemini como fallback.
// Chunking automático para textos muy largos (Opción C).
async function ocrAnalizarTextoPlano(){
  const ta = document.getElementById('hj-texto');
  if(!ta) return;
  const textoOriginal = ta.value.trim();
  if(!textoOriginal){ if(typeof toast==='function') toast('⚠ Pega el texto del documento antes de analizar','err'); return; }
  const btn     = document.getElementById('btn-analizar-texto');
  const prog    = document.getElementById('ocr-texto-prog');
  const progMsg = document.getElementById('ocr-texto-prog-msg');
  if(btn)  btn.disabled = true;
  if(prog) prog.style.display = 'flex';
  if(progMsg) progMsg.textContent = 'Iniciando análisis...';
  const j   = (typeof D!=='undefined') && D && D.juicios && D.juicios[jdetIdx];
  const ctx = j ? ('Juicio: '+(j.tipo||'')+' · Exp. '+(j.expediente||'')+' · Cliente: '+(j.cliente||j.nombre||'')) : '';
  const extra = (typeof ocrGetExtra==='function') ? ocrGetExtra() : '';
  try {
    const resumen = await _ocrAnalizarTexto(textoOriginal, ctx, extra, (msg) => {
      if(progMsg) progMsg.textContent = msg;
    });
    if(!resumen) throw new Error('La IA no devolvió contenido.');
    ta.value = resumen.trim();
    ta.style.borderColor = 'var(--gold)';
    setTimeout(()=>{ ta.style.borderColor='var(--border-l)'; }, 2500);
    ta.dispatchEvent(new Event('input'));
    const rt = resumen.toLowerCase();
    const tipoSel = document.getElementById('hj-tipo');
    if(tipoSel){
      if(rt.includes('sentencia')||rt.includes('acuerdo')) tipoSel.value='acuerdo';
      else if(rt.includes('requerimiento')) tipoSel.value='requerimiento';
      else if(rt.includes('audiencia')) tipoSel.value='audiencia';
      else if(rt.includes('notificaci')) tipoSel.value='notificacion';
    }
    const fmatch = resumen.match(/FECHA DE RESOLUCION:\s*(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[,\s]*(20\d{2})/i);
    if(fmatch){const meses={enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};const fechaInp=document.getElementById('hj-fecha');if(fechaInp&&!fechaInp.value)fechaInp.value=fmatch[3]+'-'+(meses[fmatch[2].toLowerCase()]||'01')+'-'+fmatch[1].padStart(2,'0');}
    if(typeof toast==='function') toast('✅ Análisis IA completado','ok');
    ta.scrollIntoView({behavior:'smooth',block:'nearest'});
    ta.focus();
  } catch(err){
    if(typeof toast==='function') toast('❌ '+err.message,'err');
  } finally {
    if(btn) btn.disabled=false;
    if(prog) prog.style.display='none';
  }
}
// ── driveShowReconnect: banner de reconexión Drive ────────────────
function driveShowReconnect(mensaje) {
  document.getElementById('drive-reconnect-banner')?.remove();
  const banner = document.createElement('div');
  banner.id = 'drive-reconnect-banner';
  banner.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a0c06;border:1.5px solid rgba(192,22,26,0.5);border-radius:10px;padding:14px 20px;z-index:9999;max-width:480px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.6);';
  banner.innerHTML = [
    '<div style="font-size:0.78rem;color:#f0c0c0;margin-bottom:10px;line-height:1.5;">',
    '<strong style="color:#e87070;">⚠ Drive desconectado</strong><br>',
    escHTML(mensaje||'El token de Drive venció o no tiene permisos.'),
    '</div>',
    '<button id="drb-connect" style="background:linear-gradient(135deg,#c8952a,#8c6518);color:#fff;border:none;border-radius:8px;padding:9px 22px;font-size:0.85rem;font-weight:600;cursor:pointer;margin-right:8px;">⚡ Reconectar Drive</button>',
    '<button id="drb-dismiss" style="background:none;border:1px solid rgba(200,149,42,0.3);color:rgba(200,149,42,0.6);border-radius:8px;padding:9px 14px;font-size:0.82rem;cursor:pointer;">Cerrar</button>'
  ].join('');
  document.body.appendChild(banner);
  document.getElementById('drb-connect').onclick = function(){ driveIniciarOAuth(); banner.remove(); };
  document.getElementById('drb-dismiss').onclick = function(){ banner.remove(); };
  setTimeout(function(){ if(banner.parentNode) banner.remove(); }, 20000);
}
function hjRenderTerminos() {
  const j = D.juicios[jdetIdx];
  const cont = document.getElementById('hj-terminos');
  if (!cont || !j) return;
  // ── Auto-eliminar términos cuya fecha ya pasó (diff < 0) ──
  if (j.terminos && j.terminos.length) {
    const hoyISO = new Date().toISOString().split('T')[0];
    const antes = j.terminos.length;
    j.terminos = j.terminos.filter(t => {
      if (t.cumplido) return true;           // cumplidos: mantener
      if (!t.fecha)   return true;           // sin fecha: mantener
      return t.fecha >= hoyISO;              // solo si la fecha es hoy o futura
    });
    if (j.terminos.length !== antes) {
      saveJuicios();                         // persistir solo si hubo cambios
    }
  }
  const terminos = (j.terminos || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  // Si no hay términos o todos están cumplidos → vaciar contenido
  if (!terminos.length) { cont.innerHTML = ''; return; }
  const todosCumplidos = terminos.every(t => t.cumplido);
  if (todosCumplidos)   { cont.innerHTML = ''; return; }
  // Mostrar solo los pendientes (no cumplidos, fecha >= hoy ya garantizado arriba)
  const pendientes = terminos.filter(t => !t.cumplido);
  cont.innerHTML = pendientes.map((t) => {
    const diff = t.fecha ? Math.ceil((new Date(t.fecha + 'T12:00:00') - new Date()) / 86400000) : null;
    let color = '#888', bg = 'rgba(200,149,42,0.05)', label = '—';
    if (diff !== null) {
      if (diff < 0)      { color = '#c0161a'; bg = 'rgba(192,22,26,0.08)'; label = 'Venció '+Math.abs(diff)+'d'; }
      else if (diff <= 3){ color = '#c0161a'; bg = 'rgba(192,22,26,0.08)'; label = '⚠ '+diff+'d'; }
      else if (diff <= 7){ color = '#9a6010'; bg = 'rgba(154,96,16,0.08)'; label = diff+'d'; }
      else               { color = '#1a7a3a'; bg = 'rgba(26,122,58,0.08)'; label = diff+'d'; }
    }
    const tipoIco = {'Audiencia':'🏛️','Contestación':'✍️','Requerimiento':'📋','Escrito':'📝','Término':'⏰','Pruebas':'🔍','Apelación':'📤','Otro':'📌'}[t.tipo] || '📌';
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(200,149,42,0.07);">'
      + '<span style="font-size:0.85rem;flex-shrink:0;">'+tipoIco+'</span>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:0.75rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(t.descripcion)+'</div>'
      + '<div style="font-family:monospace;font-size:0.58rem;color:var(--muted);">'+(t.fecha||'—')+'</div>'
      + '</div>'
      + '<span style="font-family:monospace;font-size:0.58rem;font-weight:700;color:'+color+';background:'+bg+';border-radius:8px;padding:2px 6px;flex-shrink:0;">'+label+'</span>'
      + '<button onclick="hjEditarTerminoInline(\''+t.id+'\')" title="Editar"'
      + ' style="background:none;border:1px solid rgba(200,149,42,0.25);border-radius:5px;width:22px;height:22px;cursor:pointer;font-size:0.65rem;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:rgba(200,149,42,0.6);" onmouseover="this.style.borderColor=\'var(--gold)\';this.style.color=\'var(--gold)\'" onmouseout="this.style.borderColor=\'rgba(200,149,42,0.25)\';this.style.color=\'rgba(200,149,42,0.6)\'">✏</button>'
      + '<button onclick="hjToggleTermino(\''+t.id+'\')" title="Marcar cumplido"'
      + ' style="background:rgba(200,149,42,0.08);border:1px solid rgba(200,149,42,0.2);border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:0.65rem;flex-shrink:0;display:flex;align-items:center;justify-content:center;">○</button>'
      + '</div>';
  }).join('');
}
// ── Actualizar términos cuando llega una entrada nueva (más reciente gana) ──
function hjActualizarTerminosDesdeEntrada(nuevosTerminos, entradaId, entradaFecha) {
  const j = D.juicios[jdetIdx];
  if (!j) return;
  if (!j.terminos) j.terminos = [];
  nuevosTerminos.forEach(nt => {
    if (!nt.descripcion) return;
    // Buscar si ya existe un término con la misma descripción
    const existe = j.terminos.find(t =>
      t.descripcion && t.descripcion.toLowerCase().trim() === nt.descripcion.toLowerCase().trim()
    );
    if (existe) {
      // Solo actualizar si la entrada nueva es más reciente Y el término ya venció
      // Si el término todavía es vigente (fecha >= hoy), lo respetamos tal como está
      const fechaExistente = existe.origenFecha || '0000-00-00';
      const hoyCheck = new Date().toISOString().split('T')[0];
      const terminoVigente = existe.fecha && existe.fecha >= hoyCheck;
      if (!terminoVigente && (entradaFecha || '0000-00-00') >= fechaExistente) {
        existe.fecha       = nt.fecha || existe.fecha;
        existe.tipo        = nt.tipo  || existe.tipo;
        existe.origenId    = entradaId;
        existe.origenFecha = entradaFecha;
        existe.cumplido    = false;
      }
    } else {
      // Agregar nuevo
      j.terminos.push({
        id:          'TR-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
        tipo:        nt.tipo || 'Otro',
        descripcion: nt.descripcion,
        fecha:       nt.fecha || null,
        cumplido:    false,
        origenId:    entradaId,
        origenFecha: entradaFecha
      });
    }
  });
  saveJuicios();
  hjRenderTerminos();
}
function hjToggleTermino(id) {
  const j = D.juicios[jdetIdx];
  if (!j || !j.terminos) return;
  const t = j.terminos.find(x => x.id === id);
  if (t) { t.cumplido = !t.cumplido; saveJuicios(); hjRenderTerminos(); }
}
function hjEditarTerminoInline(id) {
  const j = D.juicios[jdetIdx];
  if (!j || !j.terminos) return;
  const t = j.terminos.find(x => x.id === id);
  if (!t) return;
  // Reutilizar modal de términos del panel principal
  _terminoEditIdx = j.terminos.indexOf(t);
  // Apuntar jdetIdx al mismo juicio para que guardarTermino lo encuentre
  if(typeof $==='function'){
    const sel = $('trTipo'); if(sel) sel.value = t.tipo||'Audiencia';
    const desc = $('trDesc'); if(desc) desc.value = t.descripcion||'';
    const fecha = $('trFecha'); if(fecha) fecha.value = t.fecha||'';
    const hora = $('trHora'); if(hora) hora.value = t.hora||'';
    const nota = $('trNota'); if(nota) nota.value = t.nota||'';
    const hdr = document.querySelector('#mNuevoTermino .modal-hdr h3');
    if(hdr) hdr.textContent = '✏ Editar Término / Audiencia';
    const btn = document.querySelector('#mNuevoTermino .btn-primary');
    if(btn) btn.textContent = '💾 Actualizar';
    const modal = $('mNuevoTermino');
    if(modal) modal.classList.add('show');
  }
}
// ── Variables de estado del chat IA del historial ────────────────────
// FIX: declarar explícitamente para evitar ReferenceError al llamar abrirDetalle
let _iaHistorial   = [];   // historial de mensajes del chat IA del expediente
let _iaJuicioIdx   = -1;   // índice del último expediente cargado en el chat
let _iaLeyesTexto  = [];   // leyes cargadas para contexto IA
// ── Construir contexto del historial para la IA ──────────────────────
function _hjConstruirContextoIA() {
  const j = D.juicios[jdetIdx];
  if (!j) return '';
  const historial = (j.historial || []).slice(0, 20)
    .map(e => {
      const t = HJ_TIPOS[e.tipo] || HJ_TIPOS.nota;
      return `[${e.fecha}] ${t.ico} ${t.label}:\n${e.texto}`;
    }).join('\n\n---\n\n');
  const terminos = (j.terminos || []).filter(t => !t.cumplido)
    .map(t => `• ${t.tipo} — ${t.fecha || 'sin fecha'}: ${t.descripcion}`)
    .join('\n') || 'Ninguno';
  const leyes = _iaLeyesTexto.length
    ? '\n\nLEYES CARGADAS:\n' + _iaLeyesTexto.map(l => `=== ${l.nombre} ===\n${l.texto.slice(0, 2500)}`).join('\n\n')
    : '';
  return `Eres asistente legal mexicano integrado en LEX-MÉXICO. Estás analizando el siguiente expediente.
Responde en español, de forma directa y práctica. Cuando redactes escritos usa formato legal mexicano.
EXPEDIENTE:
Cliente: ${j.cliente || '—'}
Tipo: ${j.tipo || '—'}
Número: ${j.expediente || '—'}
Juzgado: ${j.juzgado || '—'}
Estatus: ${j.estatus || '—'}
Ingreso: ${j.fechaIngreso || '—'}
TÉRMINOS PENDIENTES:
${terminos}
HISTORIAL CRONOLÓGICO (más reciente primero):
${historial || 'Sin entradas aún.'}${leyes}`;
}
// ── Acciones rápidas IA del historial ────────────────────────────────
const _hjIaPrompts = {
  situacion: 'Basándote en el historial completo, dame un resumen ejecutivo de la situación actual del caso: etapa procesal, lo que se ha hecho y la situación a hoy.',
  que_sigue: '¿Cuál es el siguiente paso procesal concreto que debo tomar en este caso? Dame instrucciones específicas.',
  riesgos:   'Analiza el historial y dime qué riesgos procesales hay, qué plazos están por vencer y qué podría salir mal.',
  redactar:  'Basándote en el historial y la última entrada, redacta el siguiente escrito procesal en formato legal mexicano con proemio, hechos, derecho y puntos petitorios.',
  cliente:   'Redacta un mensaje claro y profesional para informar al cliente sobre el estado actual de su caso sin revelar estrategia legal.'
};
function hjIaAccion(tipo) {
  const prompt = _hjIaPrompts[tipo];
  if (!prompt) return;
  // FIX: iaEnviar no existe en este scope; usar agEnviar que sí está definida
  const inp = document.getElementById('ia-inp') || document.getElementById('ag-inp');
  if (inp) inp.value = prompt;
  if (typeof agEnviar === 'function') agEnviar();
}
function hjIaLimpiar() {
  _iaHistorial = [];
  _iaJuicioIdx = -1;
  const cont = document.getElementById('ia-chat-msgs');
  if (cont) cont.innerHTML = '';
}
// ── _iaConstruirContexto: usa contexto de juicio o contexto general ──
function _iaConstruirContexto() {
  if (typeof jdetIdx !== 'undefined' && jdetIdx >= 0 && D.juicios[jdetIdx]) return _hjConstruirContextoIA();
  return '';
}
// ── abrirDetalle (LEGACY — ya NO es la versión activa, ver nota arriba
//    en _abrirDetalleLegacyV1_NoUsar) — esta reasignaba el global
//    "abrirDetalle" en tiempo de ejecución, pisando la declaración de más
//    abajo (~línea 66237, la vigente con pestañas/notas/documentos/aviso de
//    término). Se renombra para que deje de competir por ese nombre. ───────
function _abrirDetalleLegacyV2_NoUsar(idx) {
  jdetIdx = idx;
  _mexpIdx = idx;
  const j = D.juicios[idx];
  if (!j) return;

  // Ocultar lista, mostrar visor
  document.getElementById('juicios-lista-view').style.display = 'none';
  const modal = document.getElementById('modal-expediente');
  if (!modal) return;
  modal.style.display = 'flex';

  // Header
  $('mexp-titulo').textContent = j.cliente || '—';
  const tagL = {'urgente':'🔴 Urgente','proceso':'🟡 En Proceso','estable':'🟢 Estable','concluido':'⚫ Concluido','inicio':'🔵 Inicio'}[j.estatus] || j.estatus;
  $('mexp-sub').textContent = (j.tipo||'') + (j.expediente ? ' · Exp. ' + j.expediente : '') + ' · ' + tagL;

  // Stats — Acuerdos en Drive (reemplaza R2)
  initAcuerdosDrive(j.id || idx);
  const histCount = (j.historial||[]).length;
  $('mexp-stat-hist').textContent = histCount || '0';
  const aud = j.audiencia || (typeof proximaAudienciaDeTerminos === 'function' ? proximaAudienciaDeTerminos(j) : null);
  if (aud) {
    const diff = Math.ceil((new Date(aud+'T12:00:00') - new Date()) / 86400000);
    $('mexp-stat-aud').textContent = diff >= 0 ? diff + 'd' : 'Vencida';
  } else {
    $('mexp-stat-aud').textContent = '—';
  }

  // Leyes y historial
  if (typeof actualizarContadorLeyes === 'function') actualizarContadorLeyes();
  if (typeof renderHistorialModal === 'function') renderHistorialModal();
  if (typeof _flujoInicializarBtn === 'function') _flujoInicializarBtn();

  // Resetear chat IA si cambiamos de juicio
  if (_iaJuicioIdx !== idx) {
    _iaHistorial = [];
    _iaJuicioIdx = idx;
    const chatCont = document.getElementById('mexp-ia-chat');
    if (chatCont) chatCont.innerHTML = '';
    const resumenEl = document.getElementById('mexp-ia-resumen');
    if (resumenEl) resumenEl.textContent = 'Presiona «Analizar expediente con IA» para obtener el resumen.';
  }
};
// ═══ FIN HISTORIAL CRONOLÓGICO ═══
// ═══ MONITOR DE SESIONES ═══
const SESIONES_KEY       = 'lex_sesiones_log';
// SESIONES_MAX declarada al inicio del script principal
const HISTORIAL_MAX      = 5;     // máx. entradas visibles en el historial del panel
const CONEXION_DIARIA_KEY = 'lex_conexion_diaria'; // registro diario inmutable
// ── REGISTRO DIARIO DE CONEXIONES (inmutable por día) ──────────────────────
// Guarda la primera conexión del día y actualiza la última hora.
// Solo aplica a empleados (no al admin).
async function registrarConexionDiaria() {
  if (!empleadoActual) return null;
  // No registrar al administrador
  if (empleadoActual.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return null;
  // FIX: no actualizar "última conexión" si el candado de horario está
  // realmente puesto (sin tiempo extra activo) — esta función también la
  // dispara el heartbeat de presencia cada 2 min/15s (sesionesHeartbeat),
  // que sigue corriendo aunque la pantalla ya esté tapada por el aviso de
  // "Horario concluido"/"Día no laborable". Sin este freno, el Checador
  // mostraba horas de salida de varias horas después del cierre real
  // (la pestaña seguía abierta sin que la empleada pudiera trabajar).
  if (typeof _horarioEstado === 'function') {
    const _estadoConexion = _horarioEstado();
    if (_estadoConexion === 'cerrado' || _estadoConexion === 'domingo') return null;
  }
  const email   = empleadoActual.email.toLowerCase();
  const nombre  = empleadoActual.nombre || email;
  const ahora   = new Date();
  // Clave de día en zona horaria México
  const diaKey  = ahora.toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City',
    weekday:'long', year:'numeric', month:'2-digit', day:'2-digit' });
  const horaStr = ahora.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City',
    hour:'2-digit', minute:'2-digit', hour12:true });
  // Cargar log diario desde Supabase
  let logDiario = [];
  try {
    if (window.SB && window.SB_DESPACHO_ID) {
      const { data } = await window.SB.from('app_state')
        .select('conexion_diaria')
        .eq('despacho_id', window.SB_DESPACHO_ID)
        .single();
      if (data && data.conexion_diaria) logDiario = data.conexion_diaria;
    }
  } catch(e){ registrarError('catch vacio', e); }
  // Respaldo local
  if (!logDiario.length) {
    try { logDiario = JSON.parse(localStorage.getItem(CONEXION_DIARIA_KEY) || '[]'); } catch(e){ registrarError('catch vacio', e); }
  }
  // Buscar entrada del mismo empleado para este día
  const entradaIdx = logDiario.findIndex(e => e.email === email && e.dia === diaKey);
  let resultadoPuntualidad = null;
  if (entradaIdx === -1) {
    // Primera conexión del día → insertar al inicio (inmutable, no se borra)
    // Checador de puntualidad: la ventana VÁLIDA de conexión empieza en
    // HORARIO_APERTURA_SISTEMA (7:00, permanente — a veces llegan temprano y
    // el sistema ya los deja entrar) hasta HORARIO_CAPTURA_FIN (5:30 p. m.).
    // Fuera de esa ventana casi siempre es el administrador entrando con esa
    // cuenta para dar mantenimiento, no una llegada real — se marca
    // 'fuera_horario' para que el Checador no ensucie el promedio de retrasos.
    // La tardanza, en cambio, SIEMPRE se mide contra HORARIO_CAPTURA_INICIO
    // (8:30, el horario oficial) — llegar entre 7:00 y 8:30 cuenta puntual.
    const esDomingo    = diaKey.toLowerCase().startsWith('domingo');
    const minsLlegada  = _minutosAhora();
    const minsInicio   = _minutosDeHHMM(HORARIO_CAPTURA_INICIO);
    const minsApertura = _minutosDeHHMM(HORARIO_APERTURA_SISTEMA);
    const minsFin      = _minutosDeHHMM(HORARIO_CAPTURA_FIN);
    let estadoPunt, minutosTarde;
    if (esDomingo) {
      // Domingo no es día laboral — si de todos modos hay conexión (casi
      // siempre porque se habilitó tiempo extra para revisar pendientes de
      // la semana), SÍ se registra, pero nunca cuenta como tardanza.
      estadoPunt = 'domingo';
      minutosTarde = 0;
    } else if (minsLlegada < minsApertura || minsLlegada > minsFin) {
      estadoPunt = 'fuera_horario';
      minutosTarde = 0;
    } else {
      minutosTarde = Math.max(0, minsLlegada - minsInicio);
      estadoPunt   = minsLlegada > (minsInicio + TOLERANCIA_TARDANZA_MIN) ? 'tarde' : 'puntual';
      if (estadoPunt !== 'tarde') minutosTarde = 0;
    }
    resultadoPuntualidad = { estado: estadoPunt, minutosTarde };
    if (estadoPunt === 'fuera_horario') {
      // Conexión fuera del horario 7:00 a. m.–5:30 p. m. (probablemente
      // mantenimiento del administrador): no se guarda registro para no
      // confundir el Checador.
      return resultadoPuntualidad;
    }
    logDiario.unshift({ email, nombre, dia: diaKey, inicio: horaStr, cierre: horaStr, ts: Date.now(), entradaMinutos: minsLlegada, estado: estadoPunt, minutosTarde });
  } else {
    // Ya existe → solo actualizar la hora de cierre (última conexión)
    logDiario[entradaIdx].cierre = horaStr;
    logDiario[entradaIdx].ts    = Date.now();
  }
  // Persistir (máx 500 entradas)
  if (logDiario.length > 500) logDiario = logDiario.slice(0, 500);
  try{ localStorage.setItem(CONEXION_DIARIA_KEY, JSON.stringify(logDiario)); } catch(e){ registrarError('localStorage.setItem', e); }
try {
    if (window.SB && window.SB_DESPACHO_ID) {
      await window.SB.from('app_state')
        .update({ conexion_diaria: logDiario })
        .eq('despacho_id', window.SB_DESPACHO_ID);
    }
  } catch(e) { console.warn('[ConexionDiaria] Error sync:', e); }
  return resultadoPuntualidad;
}
// Carga el log diario (desde Supabase con fallback a localStorage)
async function cargarLogDiario() {
  let log = [];
  try {
    if (window.SB && window.SB_DESPACHO_ID) {
      const { data } = await window.SB.from('app_state')
        .select('conexion_diaria')
        .eq('despacho_id', window.SB_DESPACHO_ID)
        .single();
      if (data && data.conexion_diaria) log = data.conexion_diaria;
    }
  } catch(e){ registrarError('catch vacio', e); }
  if (!log.length) {
    try { log = JSON.parse(localStorage.getItem(CONEXION_DIARIA_KEY) || '[]'); } catch(e){ registrarError('catch vacio', e); }
  }
  return log;
}
// ── Lista fija de empleados (email → nombre) — orden del objeto ──────────
// Se usa el objeto EMPLEADOS ya definido arriba para mostrarlos siempre.
// ── Estado de pings forzados en curso ──────────────────────────────────────
const _pingEnCurso = {};   // email → true mientras espera respuesta
// Registrar sesión al login (guarda IP pública, hora, usuario)
async function sesionesRegistrarLogin() {
  try {
    const usuario = empleadoActual ? empleadoActual.nombre : '—';
    const email   = empleadoActual ? empleadoActual.email  : '—';
    const fecha   = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
    const ts = Date.now();
    // Obtener IP pública via API gratuita
    let ip = '—'; let ciudad = '—'; let isp = '—';
    try {
      const r = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const d = await r.json();
        ip     = d.ip      || '—';
        ciudad = (d.city ? d.city + ', ' + (d.region||'') : '—');
        isp    = d.org     || '—';
      }
    } catch(e) { ip = 'Sin acceso'; }
    const entrada = { ts, fecha, usuario, email, ip, ciudad, isp };
    // Guardar en Supabase — REEMPLAZAR entrada existente del mismo usuario
    if (window.SB && window.SB_DESPACHO_ID) {
      try {
        const { data: existing } = await window.SB.from('app_state')
          .select('sesiones_log')
          .eq('despacho_id', window.SB_DESPACHO_ID)
          .single();
        let logRemoto = (existing && existing.sesiones_log) ? existing.sesiones_log : [];
        logRemoto = logRemoto.filter(e => e.email !== email);
        logRemoto.unshift(entrada);
        if (logRemoto.length > SESIONES_MAX) logRemoto = logRemoto.slice(0, SESIONES_MAX);
        await window.SB.from('app_state')
          .update({ sesiones_log: logRemoto })
          .eq('despacho_id', window.SB_DESPACHO_ID);
      } catch(eSB) { console.warn('[Sesiones] Error sincronizando:', eSB); }
    }
    // También guardar en localStorage como respaldo
    let log = [];
    try { log = JSON.parse(localStorage.getItem(SESIONES_KEY) || '[]'); } catch(e){ registrarError('catch vacio', e); }
    log = log.filter(e => e.email !== email);
    log.unshift(entrada);
    if (log.length > SESIONES_MAX) log = log.slice(0, SESIONES_MAX);
    try{ localStorage.setItem(SESIONES_KEY, JSON.stringify(log)); } catch(e){ registrarError('localStorage.setItem', e); }
// ── Registrar conexión diaria (primera del día + última hora) ──
    await registrarConexionDiaria();
  } catch(e) { console.warn('[Sesiones]', e); }
}
function abrirPanelSesiones() {
  ir('sesiones');
  sesionesRefrescar();
}
async function sesionesRefrescar() {
  const elFijos     = document.getElementById('sesiones-empleados-fijos');
  const elHistorial = document.getElementById('sesiones-historial');
  const elDiaria    = document.getElementById('sesiones-tabla-diaria');
  if (!elFijos || !elHistorial) return;
  elFijos.innerHTML     = '<div style="color:#7a6030;font-size:0.75rem;font-family:monospace;padding:8px 0;">Cargando...</div>';
  elHistorial.innerHTML = '';
  if (elDiaria) elDiaria.innerHTML = '<div style="color:#7a6030;font-size:0.75rem;font-family:monospace;padding:8px 0;">Cargando registros diarios...</div>';
  if (empleadoActual && window.SB && window.SB_DESPACHO_ID) {
    await sesionesRegistrarLogin();
  } else {
    await sesionesHeartbeat();
  }
  let log = [];
  try {
    if (window.SB && window.SB_DESPACHO_ID) {
      const { data } = await window.SB.from('app_state')
        .select('sesiones_log')
        .eq('despacho_id', window.SB_DESPACHO_ID)
        .single();
      if (data && data.sesiones_log) log = data.sesiones_log;
    }
  } catch(e){ registrarError('catch vacio', e); }
  if (!log.length) {
    try { log = JSON.parse(localStorage.getItem(SESIONES_KEY) || '[]'); } catch(e){ registrarError('catch vacio', e); }
  }
  const ahora = Date.now();
  const ultimasPorEmail = {};
  log.forEach(s => { if (!ultimasPorEmail[s.email]) ultimasPorEmail[s.email] = s; });
  // ── SECCIÓN 1: Tarjetas de empleados ─────────────────────────────────
  const htmlFijos = Object.entries(EMPLEADOS).map(([emailEmp, nombreEmp]) => {
    const s          = ultimasPorEmail[emailEmp.toLowerCase()] || ultimasPorEmail[emailEmp] || null;
    const activo     = s ? (ahora - s.ts) < 10 * 60 * 1000 : false;
    const minutosAt  = s ? Math.floor((ahora - s.ts) / 60000) : null;
    const tiempoTxt  = !s ? 'Sin conexión registrada'
      : minutosAt < 1    ? 'Ahora mismo'
      : minutosAt < 60   ? 'hace ' + minutosAt + ' min'
      : minutosAt < 1440 ? 'hace ' + Math.floor(minutosAt/60) + 'h'
      : 'hace ' + Math.floor(minutosAt/1440) + ' días';
    const dotColor   = activo ? '#1a7a3a' : (s ? '#999' : '#bbb');
    const dotShadow  = activo ? '0 0 7px rgba(26,122,58,0.6)' : 'none';
    const estadoTxt  = activo ? '● Activa · ' + tiempoTxt : (s ? '○ Inactiva · ' + tiempoTxt : '○ ' + tiempoTxt);
    const estadoColor= activo ? '#1a7a3a' : '#7a6030';
    const borderColor= activo ? '#1a7a3a' : '#d4b870';
    const esAdminEmp = emailEmp.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const detalles = s
      ? `<div style="font-family:monospace;font-size:0.68rem;color:#3a2a10;line-height:2.1;border-top:1px solid rgba(212,184,112,0.4);padding-top:8px;margin-top:10px;">
          📅 Último acceso: <strong style="color:#1a1008;">${s.fecha}</strong><br>
          🌐 IP pública: <strong style="color:#1a1008;">${s.ip}</strong><br>
          📍 Ubicación: <strong style="color:#1a1008;">${s.ciudad}</strong><br>
          🏢 Proveedor: <strong style="color:#1a1008;">${s.isp}</strong>
        </div>`
      : '<div style="font-family:monospace;font-size:0.65rem;color:#9a8050;border-top:1px solid rgba(212,184,112,0.3);padding-top:8px;margin-top:10px;">Este empleado aún no ha iniciado sesión.</div>';
    const safeEmail  = emailEmp.replace(/[@.]/g,'_');
    const btnPingId  = 'ping-btn-'  + safeEmail;
    const btnHistId  = 'hist-btn-'  + safeEmail;
    const panelHistId= 'hist-panel-'+ safeEmail;
    const btnHistorial = esAdminEmp ? '' : `
      <button id="${btnHistId}"
        onclick="toggleHistorialEmpleado('${emailEmp}','${panelHistId}','${btnHistId}')"
        style="background:rgba(26,74,138,0.09);border:1px solid rgba(26,74,138,0.3);border-radius:6px;padding:4px 10px;cursor:pointer;font-family:monospace;font-size:0.58rem;color:rgba(26,74,138,0.9);white-space:nowrap;transition:all 0.18s;margin-right:4px;"
        onmouseover="this.style.background='rgba(26,74,138,0.2)'"
        onmouseout="this.style.background='rgba(26,74,138,0.09)'">📋 Historial</button>`;
    const panelHistorial = esAdminEmp ? '' : `
      <div id="${panelHistId}" style="display:none;margin-top:10px;border-top:1px solid rgba(212,184,112,0.3);padding-top:10px;">
        <div style="font-family:monospace;font-size:0.6rem;color:#7a6030;font-style:italic;padding:4px 0;">Cargando historial...</div>
      </div>`;
    return `
      <div style="background:#f7f3e8;border:1.5px solid ${borderColor};border-radius:10px;padding:14px 16px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="width:11px;height:11px;border-radius:50%;flex-shrink:0;background:${dotColor};box-shadow:${dotShadow};"></span>
          <span style="font-family:monospace;font-size:0.92rem;font-weight:700;color:#1a1008;letter-spacing:0.04em;flex:1;">${nombreEmp}</span>
          <span style="font-family:monospace;font-size:0.6rem;font-weight:600;color:${estadoColor};margin-right:6px;">${estadoTxt}</span>
          ${btnHistorial}
          <button id="${btnPingId}"
            onclick="sesionesEnviarPing('${emailEmp}','${nombreEmp}')"
            title="Forzar actualización de estado"
            style="background:rgba(200,149,42,0.09);border:1px solid rgba(200,149,42,0.3);border-radius:6px;padding:4px 10px;cursor:pointer;font-family:monospace;font-size:0.58rem;color:rgba(200,149,42,0.9);white-space:nowrap;transition:all 0.18s;"
            onmouseover="this.style.background='rgba(200,149,42,0.2)'"
            onmouseout="this.style.background='rgba(200,149,42,0.09)'">📡 Forzar ping</button>
        </div>
        ${detalles}
        ${panelHistorial}
      </div>`;
  }).join('');
  elFijos.innerHTML = htmlFijos || '<div style="color:#7a6030;font-size:0.75rem;font-family:monospace;padding:8px 0;">No hay empleados configurados.</div>';
  // ── SECCIÓN 2: Historial rápido (máx. 5) ─────────────────────────────
  const histSlice = log.slice(0, HISTORIAL_MAX);
  if (!histSlice.length) {
    elHistorial.innerHTML = '<div style="color:#7a6030;font-size:0.72rem;font-family:monospace;padding:8px 0;">Sin accesos registrados aún.</div>';
  } else {
    elHistorial.innerHTML = '<div style="border:1px solid rgba(212,184,112,0.3);border-radius:8px;overflow:hidden;">'
      + histSlice.map((s, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;
          ${i < histSlice.length-1 ? 'border-bottom:1px solid rgba(212,184,112,0.2);' : ''}
          font-family:monospace;font-size:0.65rem;background:${i%2===0?'#fdfaf4':'#f7f3e8'};">
          <span style="font-size:0.7rem;">${i===0?'🔵':'⚪'}</span>
          <span style="color:#7a6030;min-width:138px;flex-shrink:0;">${s.fecha}</span>
          <span style="color:#1a1008;flex:1;font-weight:700;">${s.usuario}</span>
          <span style="color:#5a4a20;">${s.ip}</span>
        </div>`).join('')
      + '</div>';
  }
  // ── SECCIÓN 3: Tabla diaria de conexiones ─────────────────────────────
  if (elDiaria) {
    const logDiario    = await cargarLogDiario();
    const logEmpleados = logDiario.filter(e => e.email !== ADMIN_EMAIL.toLowerCase());
    if (!logEmpleados.length) {
      elDiaria.innerHTML = '<div style="color:#7a6030;font-size:0.72rem;font-family:monospace;padding:8px 0;">Sin registros diarios aún — aparecerán al conectarse los empleados.</div>';
    } else {
      const diasUnicos = [...new Set(logEmpleados.map(e => e.dia))];
      elDiaria.innerHTML = diasUnicos.map(dia => {
        const regs = logEmpleados.filter(e => e.dia === dia);
        return `
          <div style="margin-bottom:14px;">
            <div style="font-family:monospace;font-size:0.58rem;color:rgba(200,149,42,0.85);letter-spacing:0.12em;text-transform:uppercase;padding:6px 12px;background:rgba(200,149,42,0.08);border:1px solid rgba(200,149,42,0.22);border-radius:6px 6px 0 0;border-bottom:none;">📅 ${dia}</div>
            <div style="border:1px solid rgba(212,184,112,0.35);border-radius:0 0 8px 8px;overflow:hidden;">
              <div style="display:grid;grid-template-columns:1fr 110px 110px;padding:5px 12px;background:rgba(200,149,42,0.06);border-bottom:1px solid rgba(212,184,112,0.25);">
                <span style="font-family:monospace;font-size:0.55rem;color:#9a7040;text-transform:uppercase;letter-spacing:0.1em;">Empleado</span>
                <span style="font-family:monospace;font-size:0.55rem;color:#1a7a3a;text-transform:uppercase;letter-spacing:0.1em;text-align:center;">⬆ Inicio</span>
                <span style="font-family:monospace;font-size:0.55rem;color:#c0161a;text-transform:uppercase;letter-spacing:0.1em;text-align:center;">⬇ Cierre</span>
              </div>
              ${regs.map((r, i) => `
                <div style="display:grid;grid-template-columns:1fr 110px 110px;align-items:center;padding:8px 12px;
                  ${i < regs.length-1 ? 'border-bottom:1px solid rgba(212,184,112,0.15);' : ''}
                  background:${i%2===0?'#fdfaf4':'#f7f3e8'};">
                  <span style="font-family:monospace;font-size:0.72rem;font-weight:700;color:#1a1008;">${escHTML(r.nombre||'')}</span>
                  <span style="font-family:monospace;font-size:0.72rem;color:#1a7a3a;text-align:center;font-weight:600;">${escHTML(r.inicio||'')}</span>
                  <span style="font-family:monospace;font-size:0.72rem;color:#c0161a;text-align:center;font-weight:600;">${escHTML(r.cierre||'')}</span>
                </div>`).join('')}
            </div>
          </div>`;
      }).join('');
    }
  }
}
// ── Ping forzado: escribe sesiones_ping_forzado en Supabase para que el
//    empleado objetivo lo detecte en el próximo ciclo de heartbeat (≤15s) ──
async function sesionesEnviarPing(emailObjetivo, nombreObjetivo) {
  const btnId = 'ping-btn-' + emailObjetivo.replace(/[@.]/g,'_');
  const btn   = document.getElementById(btnId);
  if (!btn || _pingEnCurso[emailObjetivo]) return;
  _pingEnCurso[emailObjetivo] = true;
  btn.textContent    = '⏳ Esperando...';
  btn.style.color    = 'rgba(200,149,42,0.6)';
  btn.style.cursor   = 'default';
  try {
    if (window.SB && window.SB_DESPACHO_ID) {
      // Escribir el ping con el email del objetivo para que solo ese usuario responda
      await window.SB.from('app_state')
        .update({ sesiones_ping: Date.now(), sesiones_ping_target: emailObjetivo.toLowerCase() })
        .eq('despacho_id', window.SB_DESPACHO_ID);
      toast('📡 Ping enviado a ' + nombreObjetivo + ' — esperando respuesta (≤15s)…', 'ok');
    } else {
      toast('⚠ Sin conexión a Supabase — no se pudo enviar el ping', 'err');
      _resetPingBtn(btn, emailObjetivo);
      return;
    }
    // Esperar hasta 20 segundos y luego refrescar para mostrar el resultado
    setTimeout(async () => {
      await sesionesRefrescar();
      _resetPingBtn(btn, emailObjetivo);
      toast('Monitor actualizado — revisa el estado de ' + nombreObjetivo, 'ok');
    }, 20000);
    // También actualizar a los 8s para ver si ya respondió antes
    setTimeout(async () => {
      if (_pingEnCurso[emailObjetivo]) await sesionesRefrescar();
    }, 8000);
  } catch(e) {
    toast('Error al enviar ping: ' + e.message, 'err');
    _resetPingBtn(btn, emailObjetivo);
  }
}
function _resetPingBtn(btn, email) {
  delete _pingEnCurso[email];
  if (!btn) return;
  btn.textContent  = '📡 Forzar ping';
  btn.style.color  = 'rgba(200,149,42,0.9)';
  btn.style.cursor = 'pointer';
}
// ── Despliega/oculta el historial diario de un empleado en su tarjeta ──
async function toggleHistorialEmpleado(email, panelId, btnId) {
  const panel = document.getElementById(panelId);
  const btn   = document.getElementById(btnId);
  if (!panel) return;
  const abierto = panel.style.display !== 'none';
  panel.style.display = abierto ? 'none' : 'block';
  if (btn) btn.textContent = abierto ? '📋 Historial' : '📋 Cerrar';
  if (!abierto) {
    panel.innerHTML = '<div style="font-family:monospace;font-size:0.6rem;color:#7a6030;font-style:italic;padding:4px 0;">Cargando...</div>';
    const logDiario = await cargarLogDiario();
    const registros = logDiario.filter(e => e.email === email.toLowerCase());
    if (!registros.length) {
      panel.innerHTML = '<div style="font-family:monospace;font-size:0.65rem;color:#9a8050;padding:6px 0;">Sin conexiones registradas aún.</div>';
      return;
    }
    panel.innerHTML = `
      <div style="border:1px solid rgba(212,184,112,0.3);border-radius:8px;overflow:hidden;margin-top:4px;">
        <div style="display:grid;grid-template-columns:1fr 100px 100px;padding:5px 10px;background:rgba(200,149,42,0.07);border-bottom:1px solid rgba(212,184,112,0.2);">
          <span style="font-family:monospace;font-size:0.54rem;color:#9a7040;text-transform:uppercase;letter-spacing:0.1em;">Fecha</span>
          <span style="font-family:monospace;font-size:0.54rem;color:#1a7a3a;text-transform:uppercase;letter-spacing:0.1em;text-align:center;">Inicio</span>
          <span style="font-family:monospace;font-size:0.54rem;color:#c0161a;text-transform:uppercase;letter-spacing:0.1em;text-align:center;">Cierre</span>
        </div>
        ${registros.map((r, i) => `
          <div style="display:grid;grid-template-columns:1fr 100px 100px;align-items:center;padding:7px 10px;
            ${i < registros.length-1 ? 'border-bottom:1px solid rgba(212,184,112,0.12);' : ''}
            background:${i%2===0?'#fdfaf4':'#f7f3e8'};">
            <span style="font-family:monospace;font-size:0.65rem;color:#3a2a10;">${r.dia}</span>
            <span style="font-family:monospace;font-size:0.68rem;color:#1a7a3a;text-align:center;font-weight:600;">${r.inicio}</span>
            <span style="font-family:monospace;font-size:0.68rem;color:#c0161a;text-align:center;font-weight:600;">${r.cierre}</span>
          </div>`).join('')}
      </div>`;
  }
}
// ── Heartbeat: actualiza el timestamp cada 3 min; responde pings forzados ──
async function sesionesHeartbeat() {
  if (!empleadoActual || !window.SB || !window.SB_DESPACHO_ID) return;
  try {
    const { data: existing } = await window.SB.from('app_state')
      .select('sesiones_log, sesiones_ping, sesiones_ping_target')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .single();
    let logRemoto = (existing && existing.sesiones_log) ? existing.sesiones_log : [];
    const email = empleadoActual.email.toLowerCase();
    const ahora = Date.now();
    const pingTs     = existing && existing.sesiones_ping        ? existing.sesiones_ping        : 0;
    const pingTarget = existing && existing.sesiones_ping_target ? existing.sesiones_ping_target : null;
    const pingReciente = (ahora - pingTs) < 30000;
    // El ping aplica a este usuario si no hay target específico (reset global) o si es para mí
    const pingParaMi = pingReciente && (!pingTarget || pingTarget === email);
    const tengoEntrada = logRemoto.some(e => e.email.toLowerCase() === email);
    // Ping forzado dirigido a mí: siempre re-registrar
    if (pingReciente && pingTarget === email) {
      await sesionesRegistrarLogin();
      return;
    }
    // Ping global (sin target): re-registrar siempre para confirmar presencia
    if (pingParaMi && !pingTarget) {
      await sesionesRegistrarLogin();
      return;
    }
    if (!tengoEntrada) {
      await sesionesRegistrarLogin();
      return;
    }
    const fechaStr = new Date().toLocaleString('es-MX',{
      timeZone:'America/Mexico_City',
      day:'2-digit',month:'2-digit',year:'numeric',
      hour:'2-digit',minute:'2-digit',second:'2-digit'
    });
    const entradaExistente = logRemoto.find(e => e.email.toLowerCase() === email);
    if (entradaExistente) {
      entradaExistente.ts    = ahora;
      entradaExistente.fecha = fechaStr;
      logRemoto = logRemoto.filter(e => e.email.toLowerCase() !== email);
      logRemoto.unshift(entradaExistente);
    } else {
      await sesionesRegistrarLogin();
      return;
    }
    await window.SB.from('app_state')
      .update({ sesiones_log: logRemoto })
      .eq('despacho_id', window.SB_DESPACHO_ID);
    // Actualizar hora de cierre en el registro diario
    await registrarConexionDiaria();
  } catch(e) { console.warn('[Heartbeat]', e); }
}
// Heartbeat principal cada 2 minutos (antes: 3 min)
setInterval(sesionesHeartbeat, 2 * 60 * 1000);
// Heartbeat rápido cada 15 segundos — detecta pings y actualiza timestamp propio
let _ultimoPingRespondido = 0; // evita responder el mismo ping dos veces
setInterval(async () => {
  if (!empleadoActual || !window.SB || !window.SB_DESPACHO_ID) return;
  try {
    const { data } = await window.SB.from('app_state')
      .select('sesiones_ping, sesiones_ping_target, sesiones_log')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .single();
    if (!data) return;
    const pingTs     = data.sesiones_ping        || 0;
    const pingTarget = data.sesiones_ping_target || null;
    const ahora      = Date.now();
    const email      = empleadoActual.email.toLowerCase();
    const pingReciente = (ahora - pingTs) < 30000;
    // Aplica si: ping reciente Y (sin target = global, o target soy yo)
    const pingParaMi   = pingReciente && (!pingTarget || pingTarget === email);
    // Siempre responder si el ping es para mí (ya tenga o no entrada previa)
    if (pingParaMi && pingTs !== _ultimoPingRespondido) {
      _ultimoPingRespondido = pingTs;
      await sesionesRegistrarLogin();
      return;
    }
    // Actualizar timestamp propio aunque no haya ping (mantiene presencia viva)
    const miEntrada = (data.sesiones_log||[]).find(e => e.email.toLowerCase() === email);
    if (miEntrada) {
      const minutosUltimo = (ahora - (miEntrada.ts || 0)) / 60000;
      // Refrescar si el timestamp tiene más de 2 minutos (antes del heartbeat de 3 min)
      if (minutosUltimo > 2) {
        await sesionesHeartbeat();
      }
    }
  } catch(e){ registrarError('catch vacio', e); }
}, 15000);
setTimeout(sesionesHeartbeat, 3000);
// ── Limpiar solo el historial de sesiones (sin tocar datos del despacho) ──
async function sesionesResetHistorial() {
  if (!confirm('¿Limpiar el historial de accesos?\n\nSolo se borrarán los registros de conexiones anteriores. Los datos del despacho no se afectan.')) return;
  try {
    localStorage.removeItem(SESIONES_KEY);
    if (window.SB && window.SB_DESPACHO_ID) {
      await window.SB.from('app_state')
        .update({ sesiones_log: [], sesiones_ping: Date.now(), sesiones_ping_target: null })
        .eq('despacho_id', window.SB_DESPACHO_ID);
    }
    await sesionesRegistrarLogin();
    toast('Historial limpiado — buscando usuarios activos...', 'ok');
    setTimeout(async () => {
      await sesionesRefrescar();
      toast('Monitor actualizado ✓', 'ok');
    }, 4000);
    sesionesRefrescar();
  } catch(e) {
    toast('Error al limpiar: ' + e.message, 'err');
  }
}
// ═══ FIN MONITOR DE SESIONES ═══
// ═══ HISTORIAL DE PAGOS PARA COMPROBANTE DE ABONO ═══════════════════════
function obtenerHistorialPagosAbono(folioRef){
  // Devuelve array de pagos anteriores del recibo original
  const recibos = (typeof appData!=='undefined' ? appData.recibos : []) || [];
  // Buscar todos los comprobantes de abono que referencian al folio original
  const abonos = recibos
    .filter(r => r.folioAnterior === folioRef)
    .sort((a,b)=>{
      const fa = a.fecha_recibo||a.fecha||'';
      const fb = b.fecha_recibo||b.fecha||'';
      return fa.localeCompare(fb);
    });
  return abonos.map(a=>({
    folio: a.folio,
    fecha: a.fecha_recibo||a.fecha||'',
    pago: parseFloat(a.anticipo)||0,
    tipo: 'Abono'
  }));
}
// ═══ FIN HISTORIAL PAGOS ════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// MÓDULO ESCRITURAS — LEX-MÉXICO
// Control de escrituras con línea del tiempo de 5 pasos y chat IA
// ═══════════════════════════════════════════════════════════════════════
const ESC_PASOS = ['FIRMA NOTARIAL','CATASTRO','TRASLADO MPL','ISR','IFREO'];
let _escFiltro = 'todos';
let _escIdx    = -1;      // índice de escritura en edición
let _escPasoIdx= -1;      // índice de paso abierto
let _escIaHist = [];      // historial chat IA del paso
// ── Inicializar D.escrituras si no existe ────────────────────────────
if(typeof D!=='undefined' && !Array.isArray(D.escrituras)) D.escrituras = [];
// ── Sync y refresco automático ────────────────────────────────────────
function escSyncYRefrescar(){
  save();
  try{
    if(typeof syncEstadoSupabaseDebounced==='function'){
      const r = syncEstadoSupabaseDebounced();
      if(r && typeof r.catch==='function') r.catch((e)=>{ registrarError('Promise catch vacio', e); });
    }
  }catch(e){ registrarError('catch vacio', e); }
  escRender();
  if(typeof badges==='function') badges();
}
function escBuscarCarpeta(q){
  const cont = document.getElementById('eNumSug');
  if(!cont) return;
  window._escNumSugKeepOpen = false;
  const carpetas = (typeof D!=='undefined' && D.carpetas) ? D.carpetas : [];
  const ql = (q||'').toLowerCase().trim();
  const filtradas = ql
    ? carpetas.filter(c=>(c.num||'').toLowerCase().includes(ql)||(c.cliente||'').toLowerCase().includes(ql))
    : carpetas.slice(0,10);
  cont.style.display='block';
  let html = '';
  if(filtradas.length){
    html += filtradas.slice(0,8).map(c=>`
      <div onclick="escSeleccionarCarpeta('${escHTML((c.num||'').replace(/'/g,"\\'"))}','${escHTML((c.cliente||'').replace(/'/g,"\\'"))}')"
        style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0ead8;font-family:sans-serif;"
        onmouseover="this.style.background='#f5f0e8'" onmouseout="this.style.background=''">
        <span style="font-family:monospace;font-weight:700;color:#1a4a8a;font-size:0.78rem;">${escHTML(c.num||'')}</span>
        <span style="font-size:0.78rem;color:#1a1008;margin-left:8px;">${escHTML(c.cliente||'')}</span>
      </div>`).join('');
  } else {
    html += `<div style="padding:10px 12px;font-size:0.74rem;color:#8a7a5a;font-style:italic;font-family:sans-serif;">Sin carpetas que coincidan.</div>`;
  }
  html += `<div onclick="escAbrirCrearCarpetaDesdeEscritura('${escHTML((q||'').replace(/'/g,"\\'"))}')"
      style="padding:9px 12px;cursor:pointer;background:#fdf8ee;border-top:1.5px solid #d4b870;font-family:monospace;font-size:0.72rem;font-weight:700;color:#8c6518;">
      ＋ Crear carpeta nueva${q?': '+escHTML(q):''}
    </div>`;
  cont.innerHTML = html;
}
function escSeleccionarCarpeta(num, cliente){
  const inp = document.getElementById('eNum');
  const sug = document.getElementById('eNumSug');
  window._escNumSugKeepOpen = false;
  if(inp) inp.value = num;
  if(sug) sug.style.display='none';
  // Si no hay compradores aún, sugerir el cliente de la carpeta
  const lista = document.getElementById('eCompradores-list');
  if(lista && !lista.children.length && cliente){
    escAgregarPersona('comprador', {nombre: cliente});
  }
  if(typeof toast==='function') toast('📂 Vinculado con carpeta '+num);
}
// ── Crear una carpeta desde el modal de Escritura, sin salir del flujo ──
// Resuelve el caso de un empleado que quiere iniciar el trámite de escritura
// antes de que exista la carpeta: el número de escritura SIEMPRE debe ser el
// número de una carpeta real de Carpetas (se valida en escGuardar).
// En vez de un mini-formulario aparte, se abre el MISMO modal "Nueva Carpeta"
// que usa Carpetas (por encima del modal de Escritura), prellenado
// con el nombre que ya se había escrito. Al guardarla ahí, guardarCarpeta()
// detecta la bandera _crearCarpetaOrigenEscritura y vincula automáticamente
// el número recién creado de vuelta al campo de la escritura.
function escAbrirCrearCarpetaDesdeEscritura(clienteSugerido){
  const sug = document.getElementById('eNumSug');
  if(sug) sug.style.display='none';
  window._escNumSugKeepOpen = false;
  const q = (clienteSugerido||'').trim();
  const nombreSugerido = /^\d+$/.test(q) ? '' : q; // si tecleó un número, no lo uses como nombre
  abrirCarpeta(-1); // esto resetea _crearCarpetaOrigenEscritura a false — se activa después
  window._crearCarpetaOrigenEscritura = true;
  const cli = document.getElementById('kCliente');
  if(cli) cli.value = nombreSugerido;
  const tipo = document.getElementById('kTipoTramite');
  if(tipo){ tipo.value = 'escritura'; if(typeof kActualizarSubtipo==='function') kActualizarSubtipo(); }
}
// ── Alternar entre formulario y vista detalle ─────────────────────────
function escMostrarDetalle(e){
  const el_form   = document.getElementById('modal-body-form');
  const el_ftr_f  = document.getElementById('esc-ftr-form');
  const el_det    = document.getElementById('esc-vista-detalle');
  const el_ftr_d  = document.getElementById('esc-ftr-detalle');
  const el_titulo = document.getElementById('mEscTitulo');
  const el_header = document.getElementById('esc-detalle-header');
  if(!el_det){ console.error('No se encontró esc-vista-detalle'); return; }
  if(el_form)  el_form.style.display  = 'none';
  if(el_ftr_f) el_ftr_f.style.display = 'none';
  el_det.style.display                 = 'block';
  if(el_ftr_d) el_ftr_d.style.display = 'flex';
  if(el_titulo) el_titulo.textContent  = e.num||'Escritura';
  const cfg={
    urgente:{col:'#c0161a',bg:'rgba(192,22,26,0.08)',lbl:'🔴 Urgente'},
    proceso:{col:'#9a6010',bg:'rgba(200,149,42,0.08)',lbl:'🟡 En Proceso'},
    listo:  {col:'#1a7a3a',bg:'rgba(26,122,58,0.08)', lbl:'🟢 Listo p/Entregar'},
    espera: {col:'#7a6840',bg:'rgba(0,0,0,0.04)',      lbl:'⬜ En Espera'}
  };
  const st = cfg[e.estado||'proceso']||cfg.proceso;
  const fila = (lbl,val) => val ? `<div style="margin-bottom:8px;">
    <div style="font-family:monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin-bottom:2px;">${lbl}</div>
    <div style="font-size:0.83rem;color:var(--ink);line-height:1.5;">${val}</div>
  </div>` : '';
  const renderPersonas = (lista) => (lista||[]).map(p=>{
    const obj = typeof p==='string' ? {nombre:p} : p;
    let html = `<div style="padding:6px 10px;background:rgba(0,0,0,0.03);border-radius:6px;margin-bottom:4px;">
      <span style="font-weight:600;">${esc(obj.nombre||'—')}</span>`;
    if(obj.civil)    html += ` <span style="font-size:0.7rem;color:var(--muted);">(${esc(obj.civil)})</span>`;
    if(obj.conducto) html += `<div style="font-size:0.72rem;color:#7a6840;margin-top:2px;">↳ Por conducto de: <strong>${esc(obj.conducto)}</strong></div>`;
    return html + '</div>';
  }).join('');
  const fechaFmt = e.fechaFirma
    ? new Date(e.fechaFirma+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})
    : '—';
  if(el_header) el_header.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:14px;">
      <div style="flex:1;min-width:0;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
          ${fila('Tipo de Escritura', esc(e.tipo||'—'))}
          ${fila('Notaría No.', esc(e.notaria||'—'))}
          ${fila('Instrumento / Volumen', [e.instrumento,e.volumen].filter(Boolean).map(esc).join(' / ')||'—')}
          ${fila('Fecha de Firma', fechaFmt)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:10px;">
          <div>
            <div style="font-family:monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">🛒 Compradores / Donatarios</div>
            ${renderPersonas(e.compradores)||'<span style="font-size:0.75rem;color:var(--muted);">—</span>'}
          </div>
          <div>
            <div style="font-family:monospace;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">📤 Vendedores / Donantes</div>
            ${renderPersonas(e.vendedores)||'<span style="font-size:0.75rem;color:var(--muted);">—</span>'}
          </div>
        </div>
        ${e.descripcion?`<div style="font-size:0.78rem;color:#7a6840;background:rgba(200,149,42,0.06);border-left:3px solid var(--gold);padding:8px 10px;border-radius:0 6px 6px 0;line-height:1.5;">${esc(e.descripcion)}</div>`:''}
      </div>
      <span style="font-size:0.65rem;font-weight:700;color:${st.col};background:${st.bg};padding:4px 12px;border-radius:12px;white-space:nowrap;flex-shrink:0;border:1px solid ${st.col}44;">${st.lbl}</span>
    </div>`;
  escActualizarTimelineDetalle(e.pasos||[]);
}
function escActualizarTimelineDetalle(pasos){
  const arr = Array(5).fill(null).map((_,i)=>pasos[i]||{estado:'pendiente',notas:'',fecha:''});
  const completados = arr.filter(p=>p.estado==='completado').length;
  const pasoActivo  = completados < 5 ? completados : -1;
  for(let i=0;i<5;i++){
    const circ = document.getElementById('esc-d-circ-'+i);
    if(!circ) continue;
    const esComp  = arr[i].estado==='completado';
    const esActiv = i===pasoActivo;
    if(esComp){
      circ.textContent='✓'; circ.style.cssText+='background:#d0cdc8;border-color:#b0ada8;color:#fff;cursor:default;box-shadow:none;transform:scale(1);';
    } else if(esActiv){
      circ.textContent=i+1; circ.style.cssText+='background:#1a7a3a;border-color:#1a7a3a;color:#fff;cursor:pointer;box-shadow:0 0 0 4px rgba(26,122,58,0.2);transform:scale(1.08);';
    } else {
      circ.textContent=i+1; circ.style.cssText+='background:#f5f0e8;border-color:#d0c8b8;color:#ccc;cursor:default;box-shadow:none;transform:scale(1);';
    }
  }
  const barra = document.getElementById('esc-progreso-barra-d');
  if(barra) barra.style.width=Math.round(completados/5*100)+'%';
  const hint = document.getElementById('esc-detalle-hint');
  if(hint){
    hint.textContent = pasoActivo===-1
      ? '✅ Escritura completada en todos los pasos'
      : 'Paso activo: '+ESC_PASOS[pasoActivo]+' — toca el círculo verde para registrar el estatus';
    hint.style.color = pasoActivo===-1?'#1a7a3a':'var(--muted)';
  }
}
function escMostrarFormulario(){
  document.getElementById('modal-body-form').style.display='block';
  document.getElementById('esc-ftr-form').style.display='flex';
  document.getElementById('esc-vista-detalle').style.display='none';
  document.getElementById('esc-ftr-detalle').style.display='none';
}
function escModoEditar(){
  escMostrarFormulario();
  document.getElementById('mEscTitulo').textContent='Editar Escritura';
}
// ── Navegar al panel ─────────────────────────────────────────────────
function escRender(){
  if(typeof D==='undefined'||!Array.isArray(D.escrituras)){
    document.getElementById('esc-lista').innerHTML='<div style="padding:24px;text-align:center;color:var(--muted);">Sin escrituras registradas.</div>';
    return;
  }
  const q=(document.getElementById('escQ')?.value||'').toLowerCase();
  let lista = D.escrituras.filter(e=>{
    if(_escFiltro!=='todos' && e.estado!==_escFiltro) return false;
    if(q){
      const _gn=p=>typeof p==='string'?p:(p?.nombre||'');
      const txt=[e.num||'',(e.compradores||[]).map(_gn).join(' '),(e.vendedores||[]).map(_gn).join(' '),e.tipo||'',e.notaria||'',e.descripcion||''].join(' ').toLowerCase();
      return txt.includes(q);
    }
    return true;
  });
  const cont = document.getElementById('esc-lista');
  if(!lista.length){
    cont.innerHTML='<div style="padding:24px;text-align:center;color:var(--muted);font-size:0.8rem;">Sin escrituras en este filtro.</div>';
    return;
  }
  const estadoConfig={
    urgente:  {col:'#c0161a',bg:'rgba(192,22,26,0.08)',dot:'#c0161a',lbl:'🔴 Urgente'},
    proceso:  {col:'#9a6010',bg:'rgba(200,149,42,0.08)',dot:'#c8952a',lbl:'🟡 En Proceso'},
    listo:    {col:'#1a7a3a',bg:'rgba(26,122,58,0.08)',dot:'#1a7a3a',lbl:'🟢 Listo p/Entregar'},
    espera:   {col:'#7a6840',bg:'rgba(0,0,0,0.04)',dot:'#aaa',lbl:'⬜ En Espera'},
  };
  cont.innerHTML = lista.map(e=>{
    const idx = D.escrituras.indexOf(e);
    const cfg = estadoConfig[e.estado||'proceso']||estadoConfig.proceso;
    const pasos = e.pasos||Array(5).fill({estado:'pendiente',notas:'',fecha:''});
    const completados = pasos.filter(p=>p.estado==='completado').length;
    const pct = Math.round(completados/5*100);
    const getNombre = p => typeof p==='string' ? p : (p.nombre||'');
    const getLabel  = p => {
      const n = getNombre(p);
      const c = typeof p==='object' && p.civil ? ` (${p.civil})` : '';
      return n+c;
    };
    const comp = (e.compradores||[]).map(getLabel).join(', ')||'Sin comprador';
    const vend = (e.vendedores||[]).length ? (e.vendedores||[]).map(getLabel).join(', ') : '';
    // Mini línea del tiempo con estado correcto
    const pasoActivo = completados < 5 ? completados : -1;
    const miniTimeline = pasos.map((p,i)=>{
      const esComp  = p&&p.estado==='completado';
      const esActiv = i===pasoActivo;
      const col = esComp?'#b0ada8':esActiv?'#1a7a3a':'#d0c8b8';
      const bg  = esComp?'#d0cdc8':esActiv?'#1a7a3a':'#fff';
      const txt = esComp?'✓':(i+1);
      const fc  = esComp||esActiv?'#fff':'#bbb';
      return `<div style="width:26px;height:26px;border-radius:50%;border:2.5px solid ${col};background:${bg};display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;color:${fc};flex-shrink:0;" title="${ESC_PASOS[i]}">${txt}</div>`;
    }).join('<div style="flex:1;height:2px;background:#e0ddd5;margin-top:12px;"></div>');
    return `<div onclick="escAbrirDetalle(${idx})" style="background:var(--surface);border:1.5px solid var(--border-l);border-left:4px solid ${cfg.col};border-radius:10px;padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:box-shadow 0.15s,transform 0.15s;" onmouseover="this.style.boxShadow='0 4px 18px rgba(0,0,0,0.1)';this.style.transform='translateY(-1px)'" onmouseout="this.style.boxShadow='';this.style.transform=''">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;">
        <div style="min-width:0;">
          <div style="font-family:monospace;font-size:0.65rem;color:var(--muted);margin-bottom:2px;">${esc(e.num||'—')} · ${esc(e.tipo||'Escritura')} · Not. ${esc(e.notaria||'—')}</div>
          <div style="font-size:0.9rem;font-weight:700;color:var(--ink);">${esc(comp)}</div>
          ${vend?`<div style="font-size:0.75rem;color:var(--muted);margin-top:2px;">↔ ${esc(vend)}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
          <span style="font-size:0.65rem;font-weight:700;color:${cfg.col};background:${cfg.bg};padding:3px 10px;border-radius:12px;">${cfg.lbl}</span>
          <span style="font-family:monospace;font-size:0.62rem;color:var(--muted);">${pct}% completado</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;">${miniTimeline}</div>
      ${e.descripcion?`<div style="font-size:0.72rem;color:var(--muted);margin-top:8px;line-height:1.4;">${esc(e.descripcion.substring(0,120))}${e.descripcion.length>120?'…':''}</div>`:''}
    </div>`;
  }).join('');
}
function escSetFiltro(f,el){
  _escFiltro=f;
  document.querySelectorAll('#panel-escrituras .fbtn').forEach(b=>b.style.fontWeight='500');
  if(el) el.style.fontWeight='900';
  escRender();
}
// ── Abrir nueva escritura ─────────────────────────────────────────────
function escAbrirNueva(){
  _escIdx=-1;
  _escLimpiarForm();
  // La escritura ya no tiene numeración propia: su número SIEMPRE debe ser
  // el de una carpeta real de Carpetas (se valida en escGuardar).
  // Se deja vacío para que el usuario busque/seleccione una carpeta existente
  // o la cree al vuelo con "＋ Crear carpeta nueva".
  const inp=document.getElementById('eNum');
  if(inp){ inp.value=''; inp.readOnly=false; }
  document.getElementById('mEscTitulo').textContent='Nueva Escritura';
  escMostrarFormulario();
  escSetEstado('proceso');
  $('mEscritura').classList.add('show');
}
function escAbrirDetalle(idx){
  try{
    _escIdx = idx;
    const e = D.escrituras[idx];
    if(!e){ toast('Escritura no encontrada','err'); return; }
    // Precargar form (por si edita después)
    _escLimpiarForm();
    document.getElementById('eNum').value         = e.num||'';
    document.getElementById('eNotaria').value     = e.notaria||'';
    document.getElementById('eInstrumento').value = e.instrumento||'';
    document.getElementById('eVolumen').value     = e.volumen||'';
    document.getElementById('eFechaFirma').value  = e.fechaFirma||'';
    document.getElementById('eTipo').value        = e.tipo||'';
    document.getElementById('eDescripcion').value = e.descripcion||'';
    (e.compradores||[]).forEach(p=>escAgregarPersona('comprador', typeof p==='string'?{nombre:p}:p));
    (e.vendedores||[]).forEach(p=>escAgregarPersona('vendedor',   typeof p==='string'?{nombre:p}:p));
    escSetEstado(e.estado||'proceso');
    // Reflejar el avance real de pasos en el widget del formulario (antes se
    // quedaba siempre en el estado inicial porque _escLimpiarForm() lo reinicia
    // y nunca se volvía a sincronizar con los pasos guardados de la escritura).
    escActualizarTimeline(e.pasos||[]);
    // Mostrar vista detalle
    escMostrarDetalle(e);
    $('mEscritura').classList.add('show');
  } catch(err){
    console.error('[escAbrirDetalle]', err);
    toast('Error al abrir: '+err.message,'err');
  }
}
function _escLimpiarForm(){
  ['eNum','eNotaria','eInstrumento','eVolumen','eFechaFirma','eDescripcion'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('eTipo').value='';
  document.getElementById('eCompradores-list').innerHTML='';
  document.getElementById('eVendedores-list').innerHTML='';
  escActualizarTimeline([]);
}
function escSetEstado(estado, btn){
  document.getElementById('eEstado').value=estado;
  document.querySelectorAll('.esc-estado-btn').forEach(b=>{
    b.style.opacity=b.dataset.estado===estado?'1':'0.45';
    b.style.transform=b.dataset.estado===estado?'scale(1.04)':'scale(1)';
  });
}
function escAgregarPersona(tipo, datos={}){
  const listId  = tipo==='comprador' ? 'eCompradores-list' : 'eVendedores-list';
  const cont    = document.getElementById(listId);
  const color   = tipo==='comprador' ? '#3b82f6' : '#c8952a';
  const colorBg = tipo==='comprador' ? '#eef3ff' : '#fff8e8';
  const etiq    = tipo==='comprador' ? 'Compró por conducto de:' : 'Vendió por apoderado legal:';
  const plh     = tipo==='comprador' ? 'Nombre del representante' : 'Nombre del apoderado legal';
  const hayConducTo = !!(datos.conducto);
  const div = document.createElement('div');
  div.className = 'esc-persona-row';
  div.style.cssText = `background:${colorBg};border:1.5px solid ${color}44;border-radius:8px;padding:8px 10px;margin-bottom:6px;`;
  div.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
      <input type="text" class="esc-nombre" value="${escHTML(datos.nombre||'')}"
        placeholder="Nombre completo"
        style="flex:1;min-width:0;font-family:sans-serif;font-size:0.83rem;font-weight:600;">
      <select class="esc-civil"
        style="font-size:0.72rem;background:#fff;border:1px solid #d4b870;border-radius:5px;padding:4px 6px;font-family:sans-serif;color:var(--ink);width:130px;flex-shrink:0;">
        <option value="">Estado Civil</option>
        <option ${datos.civil==='Soltero/a'   ?'selected':''}>Soltero/a</option>
        <option ${datos.civil==='Casado/a'     ?'selected':''}>Casado/a</option>
        <option ${datos.civil==='Divorciado/a' ?'selected':''}>Divorciado/a</option>
        <option ${datos.civil==='Viudo/a'      ?'selected':''}>Viudo/a</option>
        <option ${datos.civil==='Unión Libre'  ?'selected':''}>Unión Libre</option>
      </select>
      <button type="button" onclick="this.closest('.esc-persona-row').remove()"
        style="background:none;border:1px solid rgba(192,22,26,0.3);color:#c0161a;border-radius:5px;padding:3px 8px;cursor:pointer;font-size:0.7rem;font-family:sans-serif;flex-shrink:0;">
        ✕ Quitar
      </button>
    </div>
    <label style="font-size:0.65rem;color:#7a6840;font-family:monospace;letter-spacing:0.04em;text-transform:uppercase;display:flex;align-items:center;gap:5px;cursor:pointer;user-select:none;">
      <input type="checkbox" class="esc-conducto-chk" style="accent-color:${color};"
        ${hayConducTo?'checked':''}
        onchange="this.closest('.esc-persona-row').querySelector('.esc-conducto-row').style.display=this.checked?'flex':'none';">
      ${etiq}
    </label>
    <div class="esc-conducto-row" style="display:${hayConducTo?'flex':'none'};gap:5px;align-items:center;margin-top:4px;">
      <input type="text" class="esc-conducto-nom" value="${escHTML(datos.conducto||'')}"
        placeholder="${plh}"
        style="flex:1;min-width:0;font-family:sans-serif;font-size:0.78rem;">
      <button type="button"
        onclick="const r=this.closest('.esc-persona-row');r.querySelector('.esc-conducto-chk').checked=false;r.querySelector('.esc-conducto-nom').value='';r.querySelector('.esc-conducto-row').style.display='none';"
        style="background:none;border:none;cursor:pointer;color:#c0161a;font-size:0.8rem;flex-shrink:0;">✕</button>
    </div>`;
  cont.appendChild(div);
}
function escGuardar(){
  try {
    const leerPersonas = (listId) => Array.from(document.querySelectorAll('#'+listId+' .esc-persona-row')).map(div=>({
      nombre:   div.querySelector('.esc-nombre')?.value.trim()||'',
      civil:    div.querySelector('.esc-civil')?.value||'',
      conducto: div.querySelector('.esc-conducto-chk')?.checked ? (div.querySelector('.esc-conducto-nom')?.value.trim()||'') : ''
    })).filter(p=>p.nombre);
    const compradores = leerPersonas('eCompradores-list');
    if(!compradores.length){ toast('Agrega al menos un comprador o donatario','err'); return; }
    const num = (document.getElementById('eNum')?.value||'').trim();
    if(!num){ toast('Selecciona o crea una carpeta para vincular la escritura','err'); return; }
    // El número de escritura ya no se autogenera de forma independiente:
    // debe corresponder siempre a una carpeta real de Carpetas
    // (elegida de la lista o creada al vuelo con "＋ Crear carpeta nueva").
    // Sin esta validación, un valor tecleado a mano quedaría "firme" aunque
    // no existiera ninguna carpeta con ese número.
    // Excepción: si se está editando una escritura ya guardada y el número
    // no cambió, no se bloquea el guardado aunque la carpeta ya no exista
    // (p. ej. si se borró después) — así no se pierde la posibilidad de
    // editar el resto de los datos de esa escritura.
    const numOriginal = _escIdx>=0 ? (D.escrituras[_escIdx]?.num||'') : '';
    const numSinCambios = _escIdx>=0 && num===numOriginal;
    const carpetaVinculada = (D.carpetas||[]).find(c=>c.num===num);
    if(!carpetaVinculada && !numSinCambios){
      toast('⚠ Ese número no corresponde a ninguna carpeta existente. Selecciónala de la lista o créala con "＋ Crear carpeta nueva".','err');
      const el=document.getElementById('eNum'); if(el){ el.style.borderColor='var(--rojo,#c0161a)'; el.focus(); }
      return;
    }
    const pasos = _escIdx>=0
      ? (D.escrituras[_escIdx].pasos || Array(5).fill(null).map(()=>({estado:'pendiente',notas:'',fecha:''})))
      : Array(5).fill(null).map(()=>({estado:'pendiente',notas:'',fecha:''}));
    const e = {
      num,
      notaria:     (document.getElementById('eNotaria')?.value||'').trim(),
      instrumento: (document.getElementById('eInstrumento')?.value||'').trim(),
      volumen:     (document.getElementById('eVolumen')?.value||'').trim(),
      fechaFirma:  document.getElementById('eFechaFirma')?.value||'',
      tipo:        document.getElementById('eTipo')?.value||'',
      estado:      document.getElementById('eEstado')?.value||'proceso',
      compradores,
      vendedores:  leerPersonas('eVendedores-list'),
      descripcion: (document.getElementById('eDescripcion')?.value||'').trim(),
      pasos,
      fechaMod:    new Date().toISOString()
    };
    if(!Array.isArray(D.escrituras)) D.escrituras = [];
    if(_escIdx>=0) D.escrituras[_escIdx] = e;
    else { D.escrituras.unshift(e); _escIdx = 0; }
    escSyncYRefrescar();
    cerrar('mEscritura');
    toast('✅ Escritura '+e.num+' guardada');
  } catch(err) {
    console.error('[escGuardar]', err);
    toast('Error al guardar: '+err.message,'err');
  }
}
async function escEliminar(){
  if(_escIdx<0)return;
  const e=D.escrituras[_escIdx];
  const _c0=(e.compradores||[])[0];
  const _c0nom=typeof _c0==='string'?_c0:(_c0?.nombre||'Sin nombre');
  if(!confirm('¿Eliminar escritura '+e.num+' — '+_c0nom+'?\n\nNo se puede deshacer.'))return;
  D.escrituras.splice(_escIdx,1);
  escSyncYRefrescar();
  cerrar('mEscritura');
  toast('Escritura eliminada');
}
// ── Línea del tiempo ──────────────────────────────────────────────────
function escActualizarTimeline(pasos){
  // Determinar el índice del paso activo (primer pendiente después de los completados)
  const arr = Array(5).fill(null).map((_,i)=> pasos[i]||{estado:'pendiente',notas:'',fecha:''});
  const completados = arr.filter(p=>p.estado==='completado').length;
  const pasoActivo  = completados < 5 ? completados : -1; // -1 = todos completos
  ESC_PASOS.forEach((nombre,i)=>{
    const circ = document.getElementById('esc-circulo-'+i);
    if(!circ) return;
    const p = arr[i];
    const esCompletado = p.estado==='completado';
    const esActivo     = i === pasoActivo;
    const esBloqueado  = !esCompletado && !esActivo;
    if(esCompletado){
      // Gris con paloma — bloqueado
      circ.textContent='✓';
      circ.style.background='#d0cdc8';
      circ.style.borderColor='#b0ada8';
      circ.style.color='#fff';
      circ.style.cursor='default';
      circ.style.boxShadow='none';
      circ.style.transform='scale(1)';
    } else if(esActivo){
      // Verde brillante — clickeable
      circ.textContent=i+1;
      circ.style.background='#1a7a3a';
      circ.style.borderColor='#1a7a3a';
      circ.style.color='#fff';
      circ.style.cursor='pointer';
      circ.style.boxShadow='0 0 0 4px rgba(26,122,58,0.2)';
      circ.style.transform='scale(1.08)';
    } else {
      // Gris claro — bloqueado
      circ.textContent=i+1;
      circ.style.background='#f5f0e8';
      circ.style.borderColor='#d0c8b8';
      circ.style.color='#ccc';
      circ.style.cursor='default';
      circ.style.boxShadow='none';
      circ.style.transform='scale(1)';
    }
  });
  // Barra de progreso
  const barra = document.getElementById('esc-progreso-barra');
  if(barra) barra.style.width = Math.round(completados/5*100)+'%';
  // Hint
  const hint = document.getElementById('esc-paso-hint');
  if(hint){
    if(pasoActivo === -1){
      hint.textContent='✅ Todos los pasos completados — escritura concluida';
      hint.style.color='#1a7a3a';
    } else if(_escIdx >= 0){
      hint.textContent='Paso activo: '+ESC_PASOS[pasoActivo]+' — haz clic en el círculo verde para registrar el estatus';
      hint.style.color='var(--muted)';
    } else {
      hint.textContent='Guarda la escritura para activar el primer paso';
      hint.style.color='var(--muted)';
    }
  }
}
function escClickPaso(pasoIdx){
  // Verificar que hay una escritura activa
  if(_escIdx < 0 || !D.escrituras || !D.escrituras[_escIdx]){
    toast('Abre la escritura primero','err'); return;
  }
  const e   = D.escrituras[_escIdx];
  const arr = Array(5).fill(null).map((_,i)=>(e.pasos||[])[i]||{estado:'pendiente',notas:'',fecha:''});
  const completados = arr.filter(p=>p.estado==='completado').length;
  const pasoActivo  = completados < 5 ? completados : -1;
  // Solo el paso activo es clickeable
  if(pasoIdx !== pasoActivo){
    if(pasoIdx < pasoActivo) toast('Este paso ya está completado','err');
    return;
  }
  escAbrirPaso(pasoIdx);
}
function escAbrirPaso(pasoIdx){
  if(_escIdx<0){toast('Guarda la escritura primero','err');return;}
  _escPasoIdx=pasoIdx;
  _escIaHist=[];
  const e=D.escrituras[_escIdx];
  const p=(e.pasos||[])[pasoIdx]||{estado:'pendiente',notas:'',fecha:''};
  document.getElementById('mEscPasoTitulo').textContent='Paso '+(pasoIdx+1)+' — '+ESC_PASOS[pasoIdx];
  document.getElementById('paso-notas').value=p.notas||'';
  document.getElementById('paso-estado-hidden').value=p.estado||'pendiente';
  document.getElementById('paso-fecha-upd').textContent=p.fecha?'Última actualización: '+fmtFecha(p.fecha):'Sin actualizaciones aún';
  // Resaltar botón de estado activo
  ['pendiente','activo','completado'].forEach(s=>{
    const btn=document.getElementById('paso-btn-'+s);
    if(btn) btn.style.opacity=p.estado===s?'1':'0.4';
  });
  // Limpiar chat IA
  document.getElementById('esc-ia-msgs').innerHTML=`<div style="color:var(--muted);font-size:0.72rem;font-style:italic;">Hola. Tengo acceso al estado completo de esta escritura. Pregúntame sobre este paso o el trámite en general.</div>`;
  document.getElementById('esc-ia-inp').value='';
  $('mEscPaso').classList.add('show');
}
function escPasoSetEstado(estado){
  document.getElementById('paso-estado-hidden').value=estado;
  ['pendiente','activo','completado'].forEach(s=>{
    const btn=document.getElementById('paso-btn-'+s);
    if(btn) btn.style.opacity=estado===s?'1':'0.4';
  });
}
function escGuardarPaso(){
  try{
    if(_escPasoIdx<0){ toast('Error: no hay paso seleccionado','err'); return; }
    if(_escIdx<0){ toast('Error: no hay escritura seleccionada','err'); return; }
    if(!Array.isArray(D.escrituras)||!D.escrituras[_escIdx]){
      toast('Error: escritura no encontrada','err'); return;
    }
    const e = D.escrituras[_escIdx];
    if(!e.pasos) e.pasos = Array(5).fill(null).map(()=>({estado:'pendiente',notas:'',fecha:''}));
    const hiddenEl = document.getElementById('paso-estado-hidden');
    const notasEl  = document.getElementById('paso-notas');
    if(!hiddenEl){ toast('Error: elemento no encontrado','err'); return; }
    const estadoNuevo = hiddenEl.value || 'pendiente';
    const notas       = notasEl ? notasEl.value.trim() : '';
    const fecha       = new Date().toLocaleString('es-MX',{
      timeZone:'America/Mexico_City',
      day:'2-digit',month:'2-digit',year:'numeric',
      hour:'2-digit',minute:'2-digit'
    });
    e.pasos[_escPasoIdx] = { estado:estadoNuevo, notas, fecha };
    // Actualizar fechaMod también aquí: si no se marca el avance de paso como
    // cambio reciente, el merge anti-condición-de-carrera de sincronizarFolio()
    // no sabría que esta versión local es más nueva que la del servidor.
    e.fechaMod = new Date().toISOString();
    escActualizarTimeline(e.pasos);
    escActualizarTimelineDetalle(e.pasos);
    escSyncYRefrescar();
    cerrar('mEscPaso');
    if(estadoNuevo==='completado' && _escPasoIdx < 4){
      toast('✅ '+ESC_PASOS[_escPasoIdx]+' completado → Siguiente: '+ESC_PASOS[_escPasoIdx+1]);
    } else if(estadoNuevo==='completado' && _escPasoIdx===4){
      toast('🎉 ¡Escritura completada en todos los pasos!');
    } else {
      toast('Paso guardado ✓');
    }
  }catch(err){
    console.error('[escGuardarPaso]', err);
    toast('Error al guardar paso: '+err.message,'err');
  }
}
// ── Chat IA del paso ──────────────────────────────────────────────────
async function escIaEnviar(){
  const inp=document.getElementById('esc-ia-inp');
  const msgs=document.getElementById('esc-ia-msgs');
  const texto=(inp.value||'').trim();
  if(!texto)return;
  inp.value='';
  // Burbuja usuario
  msgs.innerHTML+=`<div style="text-align:right;"><span style="background:var(--gold);color:#1a1008;padding:6px 10px;border-radius:10px 10px 2px 10px;display:inline-block;font-size:0.78rem;max-width:85%;">${esc(texto)}</span></div>`;
  msgs.scrollTop=msgs.scrollHeight;
  _escIaHist.push({role:'user',content:texto});
  // Burbuja pensando
  const thinkId='think-'+Date.now();
  msgs.innerHTML+=`<div id="${thinkId}" style="text-align:left;"><span style="background:#e8e0f0;color:#5a1a6a;padding:6px 10px;border-radius:10px 10px 10px 2px;display:inline-block;font-size:0.78rem;">✦ Pensando...</span></div>`;
  msgs.scrollTop=msgs.scrollHeight;
  // Construir contexto del trámite
  const e=_escIdx>=0?D.escrituras[_escIdx]:{};
  const pasoActual=(_escPasoIdx>=0&&e.pasos)?e.pasos[_escPasoIdx]:{};
  const contexto=`Eres un asistente legal mexicano experto en trámites de escrituración en Oaxaca, México.
Tienes acceso al siguiente expediente de escritura:
EXPEDIENTE: ${e.num||'—'}
TIPO: ${e.tipo||'—'}
NOTARÍA: ${e.notaria||'—'} | INSTRUMENTO: ${e.instrumento||'—'} | VOLUMEN: ${e.volumen||'—'}
COMPRADORES: ${(e.compradores||[]).join(', ')||'—'}
VENDEDORES: ${(e.vendedores||[]).join(', ')||'—'}
DESCRIPCIÓN GENERAL: ${e.descripcion||'—'}
PASO ACTUAL: ${ESC_PASOS[_escPasoIdx]||'—'}
ESTADO DEL PASO: ${pasoActual.estado||'pendiente'}
NOTAS DEL PASO: ${pasoActual.notas||'Sin notas'}
ÚLTIMA ACTUALIZACIÓN: ${pasoActual.fecha||'—'}
PROGRESO GENERAL:
${ESC_PASOS.map((n,i)=>{const p=(e.pasos||[])[i]||{};return `${i+1}. ${n}: ${p.estado||'pendiente'}${p.notas?' — '+p.notas.substring(0,80):''}`}).join('\n')}
Responde en español, de forma concisa y práctica. Orienta sobre el proceso notarial y registral en Oaxaca.`;
  try{
    // Usar _iaLlamar: Groq primero, fallback Cloudflare Workers AI
    const respuesta = (await _iaLlamar(contexto, 600, 0.3, 'consulta')).trim();
    const el=document.getElementById(thinkId);if(el)el.remove();
    msgs.innerHTML+=`<div style="text-align:left;"><span style="background:#e8e0f0;color:#3a0a5a;padding:6px 10px;border-radius:10px 10px 10px 2px;display:inline-block;font-size:0.78rem;max-width:90%;line-height:1.5;">${esc(respuesta)}</span></div>`;
    _escIaHist.push({role:'assistant',content:respuesta});
  }catch(err){
    const el=document.getElementById(thinkId);if(el)el.remove();
    msgs.innerHTML+=`<div style="color:#c0161a;font-size:0.72rem;padding:4px;">Error al conectar con IA: ${err.message}</div>`;
  }
  msgs.scrollTop=msgs.scrollHeight;
}
// ── Sincronizar D.escrituras con Supabase ─────────────────────────────
const _origSyncEsc=window.syncEstadoSupabase;
// Se guarda dentro del objeto D que ya se sincroniza automáticamente
// ── Inicializar al cargar ─────────────────────────────────────────────
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{if(typeof D!=='undefined'&&!Array.isArray(D.escrituras))D.escrituras=[];});
} else {
  if(typeof D!=='undefined'&&!Array.isArray(D.escrituras))D.escrituras=[];
}
// ═══ FIN MÓDULO ESCRITURAS ══════════════════════════════════════════════
// ═══ MODO RETROACTIVO GLOBAL (ADMIN) ════════════════════════════════════
function adminToggleRetroGlobal(){
  // Leer estado actual desde variable global (seteada por aplicarRetroGlobal)
  var nuevoActivo = !window._retroGlobalActivo;
  // Actualizar UI e internos INMEDIATAMENTE (sin esperar Supabase)
  window._retroGlobalActivo = nuevoActivo;
  aplicarRetroGlobal(nuevoActivo);
  adminRenderCardRetroGlobal(nuevoActivo);
  toast(nuevoActivo ? '⏰ Modo Retroactivo habilitado para todos' : '○ Modo Retroactivo deshabilitado', 'ok');
  // Guardar en Supabase y broadcast en segundo plano
  if(window.SB && window.SB_DESPACHO_ID){
    window.SB.from('app_state')
      .select('data').eq('despacho_id', window.SB_DESPACHO_ID).single()
      .then(function(res){
        var d = (res.data && res.data.data) ? res.data.data : {};
        d.retro_global = {
          activo:      nuevoActivo,
          activadoPor: typeof empNombre === 'function' ? empNombre() : 'Admin',
          fecha:       typeof hoy  === 'function' ? hoy()  : new Date().toISOString().split('T')[0],
          hora:        typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5)
        };
        return window.SB.from('app_state')
          .update({ data: d }).eq('despacho_id', window.SB_DESPACHO_ID);
      })
      .then(function(){
        if(window._lexRealtimeChannel && window._lexRealtimeChannel.state === 'joined'){
          window._lexRealtimeChannel.send({
            type: 'broadcast',
            event: 'retro_global_actualizado',
            payload: { activo: nuevoActivo, ts: Date.now() }
          }).catch(function(e){ console.warn('[RetroGlobal] broadcast:', e); });
        }
      })
      .catch(function(e){ console.warn('[RetroGlobal] Supabase save:', e); });
  }
}
function adminRenderCardRetroGlobal(activo){
  const label = document.getElementById('retro-global-label');
  const chk   = document.getElementById('retro-global-chk');
  if(activo){
    if(label){ label.textContent='ACTIVO'; label.style.color='#8b5cf6'; }
    if(chk)   chk.checked = true;
  } else {
    if(label){ label.textContent='INACTIVO'; label.style.color='rgba(139,92,246,0.5)'; }
    if(chk)   chk.checked = false;
  }
}
function aplicarRetroGlobal(activo){
  var btn = document.getElementById('btn-toggle-retro');
  if(activo){
    // Mostrar el botón
    if(btn) btn.style.display = '';
  } else {
    // Ocultar el botón y desactivar el modo retro
    if(btn) btn.style.display = 'none';
    window._reciboRetroactivoActivo = false;
    window._reciboRetroactivoFechaPersonalizada = null;
    window._reciboRetroactivoHoraPersonalizada  = null;
    window._reciboRetroactivoMotivo = null;
    if(btn){ btn.style.background='none'; btn.style.color='var(--muted)'; btn.style.borderColor='rgba(200,149,42,0.3)'; btn.textContent='⏰ RETRO'; }
    var disp = document.getElementById('fecha_recibo_display');
    if(disp){ disp.style.borderBottom='none'; disp.style.color='var(--gold-dark)'; disp.style.fontWeight=''; }
    var hDisp = document.getElementById('hora_recibo_display');
    if(hDisp){ hDisp.style.color=''; hDisp.style.fontWeight=''; }
  }
}
async function retroGlobalCargarSupabase(){
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  try {
    const { data } = await window.SB.from('app_state')
      .select('data').eq('despacho_id', window.SB_DESPACHO_ID).single();
    const d = (data && data.data) ? data.data : {};
    const activo = !!(d.retro_global && d.retro_global.activo);
    window._retroGlobalActivo = activo;
    aplicarRetroGlobal(activo);
    adminRenderCardRetroGlobal(activo);
  } catch(e){ console.warn('[RetroGlobal] Error al cargar:', e); }
}
// ═══ TABLERO CAPTURA RETROACTIVA ════════════════════════════════════════
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
// CAPTURA_KEY declarada al inicio del script principal
function capturaMesCargar(){
  return (typeof D !== 'undefined' && D.captura_meses) ? D.captura_meses : {};
}
function capturaMesGuardarLocal(cfg){
  // Deshabilitado — config vive en D.captura_meses sincronizado con Supabase
  if (typeof D !== 'undefined') D.captura_meses = cfg;
}
function adminAbrirCapturaMes(){
  // Ocultar panel principal, mostrar zona
  document.getElementById('adminPanelZone').classList.remove('show');
  const zona = document.getElementById('adminCapturaMesZone');
  if(zona) zona.classList.add('show');
  capturaMesRender();
}
function capturaMesRender(){
  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth(); // 0-11
  document.getElementById('captura-anio-label').textContent = anio;
  const cfg  = capturaMesCargar();
  const grid = document.getElementById('captura-mes-grid');
  if(!grid) return;
  // Calcular totales reales desde appData
  const recibos = (typeof appData!=='undefined' ? appData.recibos : []) || [];
  let totalRecibos=0, totalMonto=0;
  const mesesMostrar = [];
  // Mostrar solo meses hasta el mes actual
  for(let m=0; m<=mesActual; m++) mesesMostrar.push(m);
  grid.innerHTML = mesesMostrar.map(m => {
    const key       = anio+'-'+(m+1);
    const estado    = cfg[key] || { completo:false, secretaria:false };
    const mesNom    = MESES_ES[m];
    const mesNum    = String(m+1).padStart(2,'0');
    const mesStr    = anio+'-'+mesNum;
    // Contar recibos de ese mes
    const recMes = recibos.filter(r=>{
      const f = r.fecha_recibo||r.fecha||'';
      return f.startsWith(mesStr);
    });
    const montoMes = recMes.reduce((s,r)=>s+(parseFloat(r.total)||0),0);
    totalRecibos += recMes.length;
    totalMonto   += montoMes;
    // Barra de progreso visual (máx referencia 30 recibos/mes)
    const pct = Math.min(100, Math.round((recMes.length/30)*100));
    const colorEstado = estado.completo ? '#4dca6a' : (recMes.length>0 ? '#c8952a' : 'rgba(160,192,255,0.3)');
    const etiqueta    = estado.completo ? '✅ Completo' : (recMes.length>0 ? '🟡 En proceso' : '⬜ Pendiente');
    return `<div style="background:rgba(26,74,138,0.08);border:1.5px solid rgba(26,74,138,0.2);border-radius:10px;padding:12px 14px;" id="captura-row-${key}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="font-family:sans-serif;font-weight:700;color:#c8e0ff;font-size:0.88rem;min-width:90px;">${mesNom}</div>
        <div style="flex:1;background:rgba(26,74,138,0.15);border-radius:4px;height:6px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${colorEstado};border-radius:4px;transition:width 0.3s;"></div>
        </div>
        <div style="font-family:monospace;font-size:0.62rem;color:rgba(160,192,255,0.7);min-width:70px;text-align:right;">
          ${recMes.length} recibos
        </div>
        <div style="font-family:monospace;font-size:0.62rem;color:#4dca6a;min-width:80px;text-align:right;">
          $${montoMes.toLocaleString('es-MX',{minimumFractionDigits:2})}
        </div>
        <span style="font-size:0.7rem;min-width:80px;text-align:center;color:${colorEstado};">${etiqueta}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <!-- Toggle Completo -->
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-family:monospace;font-size:0.65rem;color:rgba(160,192,255,0.7);">
          <input type="checkbox" data-key="${key}" data-campo="completo" ${estado.completo?'checked':''} 
            onchange="capturaMesToggle(this)"
            style="accent-color:#4dca6a;width:14px;height:14px;cursor:pointer;">
          ✅ Marcar como completo
        </label>
        <!-- Botón agregar registro — siempre visible, incluso si está completo -->
        <button onclick="cerrarAdminModal();adminAbrirMesCaptura(${m})"
          style="background:${estado.completo?'rgba(26,74,38,0.25)':'rgba(26,74,138,0.2)'};border:1.5px solid ${estado.completo?'rgba(43,186,88,0.4)':'rgba(26,74,138,0.45)'};color:${estado.completo?'#8de8a0':'#c8e0ff'};border-radius:6px;padding:4px 10px;cursor:pointer;font-family:monospace;font-size:0.6rem;letter-spacing:0.06em;font-weight:600;">
          ${estado.completo?'➕ Agregar registro':'▶ Entrar a capturar'}
        </button>
        <!-- Toggle Secretaria -->
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-family:monospace;font-size:0.65rem;color:rgba(160,192,255,0.7);margin-left:auto;">
          <input type="checkbox" data-key="${key}" data-campo="secretaria" ${estado.secretaria?'checked':''} 
            onchange="capturaMesToggle(this)"
            style="accent-color:#c8952a;width:14px;height:14px;cursor:pointer;">
          👩‍💼 Habilitar para Secretaria
        </label>
      </div>
    </div>`;
  }).join('');
  // Actualizar totales
  const elRec = document.getElementById('captura-total-recibos');
  const elMon = document.getElementById('captura-total-monto');
  if(elRec) elRec.textContent = totalRecibos;
  if(elMon) elMon.textContent = '$'+totalMonto.toLocaleString('es-MX',{minimumFractionDigits:2});
}
function capturaMesToggle(cb){
  const key   = cb.dataset.key;
  const campo = cb.dataset.campo;
  const cfg   = capturaMesCargar();
  if(!cfg[key]) cfg[key] = { completo:false, secretaria:false };
  cfg[key][campo] = cb.checked;
  capturaMesGuardarLocal(cfg);
  // Sincronizar con objeto D en memoria para evitar sobreescritura en guardado automático
  if(typeof D !== 'undefined' && D) D.captura_meses = cfg;
  // Sincronizar con Supabase inmediatamente para no perder cambios
  if(window.SB && window.SB_DESPACHO_ID){
    window.SB.from('app_state').select('data').eq('despacho_id', window.SB_DESPACHO_ID).single()
      .then(({data:actual})=>{
        const dataActual = (actual && actual.data) ? actual.data : {};
        dataActual.captura_meses = cfg;
        return window.SB.from('app_state').update({data: dataActual}).eq('despacho_id', window.SB_DESPACHO_ID);
      }).catch(e=>console.warn('[CapturaMes] Error sync:', e));
  }
  // Actualizar barra lateral en tiempo real
  renderBarraSecretariaCaptura();
}
async function guardarCapturaMes(){
  const cfg = capturaMesCargar();
  if(window.SB && window.SB_DESPACHO_ID){
    try{
      // Leer data actual para no sobreescribir otros campos
      const { data: actual } = await window.SB.from('app_state')
        .select('data').eq('despacho_id', window.SB_DESPACHO_ID).single();
      const dataActual = (actual && actual.data) ? actual.data : {};
      dataActual.captura_meses = cfg;
      await window.SB.from('app_state')
        .update({ data: dataActual })
        .eq('despacho_id', window.SB_DESPACHO_ID);
      if(typeof toast==='function') toast('💾 Configuración guardada');
      // Notificar a otros dispositivos (secretaria) vía Realtime
      if(_lexRealtimeChannel && _lexRealtimeChannel.state === 'joined'){
        _lexRealtimeChannel.send({
          type: 'broadcast',
          event: 'captura_meses_actualizada',
          payload: { cfg: cfg, ts: Date.now() }
        }).catch(function(e){ registrarError('Promise catch vacio', e); });
      }
    }catch(e){
      if(typeof toast==='function') toast('⚠ Guardado local — sin conexión','err');
    }
  } else {
    if(typeof toast==='function') toast('💾 Configuración guardada');
  }
  renderBarraSecretariaCaptura();
  // Cerrar panel admin automáticamente
  if(typeof cerrarAdminModal==='function') cerrarAdminModal();
}
// Cargar config desde Supabase al iniciar
async function capturaMesCargarSupabase(){
  if(!window.SB || !window.SB_DESPACHO_ID) return;
  try{
    const { data } = await window.SB.from('app_state')
      .select('data')
      .eq('despacho_id', window.SB_DESPACHO_ID)
      .single();
    const cfg_sb = data && data.data && data.data.captura_meses;
    if(cfg_sb && Object.keys(cfg_sb).length > 0){
      if(typeof D !== 'undefined' && D) D.captura_meses = cfg_sb;
      console.log('[CapturaMes] Config cargada:', Object.keys(cfg_sb).length, 'meses');
    }
  }catch(e){ console.warn('[CapturaMes] Error:', e); }
  if(typeof renderBarraSecretariaCaptura==='function') renderBarraSecretariaCaptura();
}
// Renderizar barra lateral de captura (Admin ve todos sus meses; Secretaria solo los habilitados)
function renderBarraSecretariaCaptura(){
  const cfg = capturaMesCargar();
  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth();
  const barra = document.getElementById('barra-secretaria');
  const btns  = document.getElementById('barra-secretaria-btns');
  if(!barra || !btns) return;
  // Solo mostrar la barra si hay meses habilitados para secretaria y no completos
  // El admin accede desde la rueda dentada ⚙️ — no necesita esta barra
  const mesesSecretaria = [];
  for(let m=0; m<=mesActual; m++){
    const key = anio+'-'+(m+1);
    const estado = cfg[key] || { completo:false, secretaria:false };
    if(estado.secretaria && !estado.completo){
      mesesSecretaria.push({ mes:m, key, nombre:MESES_ES[m] });
    }
  }
  if(mesesSecretaria.length === 0){
    barra.style.display = 'none';
    btns.innerHTML = '';
    return;
  }
  // Mostrar botones de meses habilitados
  btns.innerHTML = mesesSecretaria.map(({mes,nombre})=>
    `<button onclick="secretariaAbrirMes(${mes})"
      style="background:rgba(26,74,138,0.15);border:1.5px solid rgba(26,74,138,0.35);color:#c8e0ff;border-radius:8px;padding:6px 10px;cursor:pointer;font-family:sans-serif;font-size:0.72rem;font-weight:600;text-align:left;width:100%;display:flex;align-items:center;gap:5px;"
      onmouseover="this.style.opacity='0.8'"
      onmouseout="this.style.opacity='1'">
      <span>📅</span><span>${nombre}</span>
    </button>`
  ).join('');
  barra.style.display = 'block';
}
// Admin abre un mes directamente (sin necesitar habilitar para secretaria)
function adminAbrirMesCaptura(mes){
  const anio  = new Date().getFullYear();
  const mesNom = MESES_ES[mes];
  const mesNum = String(mes+1).padStart(2,'0');
  const fechaRef = anio+'-'+mesNum+'-01';
  // Verificar si está marcado como completo y advertir (pero dejar pasar)
  const cfg = capturaMesCargar();
  const key = anio+'-'+(mes+1);
  const estado = cfg[key] || {};
  const advertencia = estado.completo
    ? ' · ⚠ Este mes está marcado como completo — puedes seguir capturando'
    : '';
  if(typeof toast==='function') toast('📅 Admin — Capturando '+mesNom+' '+anio+advertencia);
  if(typeof setStatus==='function') setStatus('ok','Capturando '+mesNom+' '+anio+' — registros con fecha de este mes','ok');
  window._capturaMesActivo = { mes, anio, mesNum, mesNom, fechaRef, esAdmin:true };
  window._capturaMesActivadoTs = Date.now();
  window._capturaRetroAvisado  = false;
  let banner = document.getElementById('captura-mes-banner');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'captura-mes-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9000;background:linear-gradient(135deg,#1a3a7a,#0f2050);color:#c8e0ff;padding:10px 18px;font-family:JetBrains Mono,monospace;font-size:0.68rem;letter-spacing:0.08em;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid rgba(59,130,246,0.4);';
    document.body.appendChild(banner);
  }
  banner.innerHTML = `<span>🔧 ADMIN · CAPTURA RETROACTIVA — <strong>${mesNom.toUpperCase()} ${anio}</strong>${advertencia ? ' · ⚠ Marcado completo' : ''}</span>
    <div style="display:flex;gap:8px;align-items:center;">
      <button onclick="adminMarcarMesCompletoBanner(${mes})" style="background:rgba(26,90,42,0.3);border:1px solid rgba(43,186,88,0.4);color:#8de8a0;border-radius:4px;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:0.62rem;">✅ Marcar completo</button>
      <button onclick="abrirModalCorteRetro()" style="background:rgba(200,149,42,0.2);border:1px solid rgba(200,149,42,0.5);color:#f0d080;border-radius:4px;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:0.62rem;font-weight:700;">🔒 Corte de Caja</button>
      <button onclick="secretariaCerrarMes()" style="background:rgba(192,22,26,0.2);border:1px solid rgba(192,22,26,0.4);color:#ffaaaa;border-radius:4px;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:0.65rem;">✕ Salir</button>
    </div>`;
  banner.style.display = 'flex';
}
// Marcar mes como completo directamente desde el banner del admin
function adminMarcarMesCompletoBanner(mes){
  const anio = new Date().getFullYear();
  const key = anio+'-'+(mes+1);
  const cfg = capturaMesCargar();
  if(!cfg[key]) cfg[key] = { completo:false, secretaria:false };
  const yaCompleto = cfg[key].completo;
  cfg[key].completo = !yaCompleto;
  capturaMesGuardarLocal(cfg);
  renderBarraSecretariaCaptura();
  const label = yaCompleto ? 'Mes reabierto — captura activa' : 'Mes marcado como ✅ Completo';
  if(typeof toast==='function') toast(label);
  // Re-dibujar el banner
  adminAbrirMesCaptura(mes);
}
// Función que abre el modo de captura del mes para la secretaria
function secretariaAbrirMes(mes){
  const anio  = new Date().getFullYear();
  const mesNom = MESES_ES[mes];
  const mesNum = String(mes+1).padStart(2,'0');
  const fechaRef = anio+'-'+mesNum+'-01';
  if(typeof toast==='function') toast('📅 Modo captura: '+mesNom+' '+anio+' — usa fechas de este mes');
  if(typeof setStatus==='function') setStatus('ok','Capturando '+mesNom+' '+anio+' — todos los recibos y movimientos deben llevar fecha de este mes','ok');
  window._capturaMesActivo = { mes, anio, mesNum, mesNom, fechaRef };
  window._capturaMesActivadoTs = Date.now();
  window._capturaRetroAvisado  = false;
  let banner = document.getElementById('captura-mes-banner');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'captura-mes-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9000;background:linear-gradient(135deg,#1a3a7a,#0f2050);color:#c8e0ff;padding:10px 18px;font-family:JetBrains Mono,monospace;font-size:0.68rem;letter-spacing:0.08em;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid rgba(59,130,246,0.4);';
    document.body.appendChild(banner);
  }
  banner.innerHTML = `<span>📅 CAPTURA RETROACTIVA — <strong>${mesNom.toUpperCase()} ${anio}</strong> · Registra recibos, movimientos y cortes de este mes</span>
    <div style="display:flex;gap:8px;align-items:center;">
      <button onclick="abrirModalCorteRetro()" style="background:rgba(200,149,42,0.2);border:1px solid rgba(200,149,42,0.5);color:#f0d080;border-radius:4px;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:0.62rem;font-weight:700;">🔒 Corte de Caja</button>
      <button onclick="secretariaCerrarMes()" style="background:rgba(192,22,26,0.2);border:1px solid rgba(192,22,26,0.4);color:#ffaaaa;border-radius:4px;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:0.65rem;">✕ Salir</button>
    </div>`;
  banner.style.display = 'flex';
}
// ═══ CORTE DE CAJA RETROACTIVO ═══════════════════════════════════════
// Calcula el saldo disponible en caja HASTA una fecha+hora dada
// Respeta el último corte de caja anterior a esa fecha
function getSaldoHasta(fechaLimite, horaLimite) {
  const tsLimite = fechaLimite + 'T' + (horaLimite || '23:59') + ':00';
  // Último corte ANTERIOR a la fecha límite
  const ultimoCorte = ((D.cierres || [])
    .filter(c => c.fecha && c.esCorte === true)
    .filter(c => (c.fecha + 'T' + (c.hora || '00:00') + ':00') < tsLimite)
    .sort((a, b) => (b.fecha + 'T' + (b.hora || '00:00'))
      .localeCompare(a.fecha + 'T' + (a.hora || '00:00'))))[0] || null;
  const tsCorte = ultimoCorte
    ? ultimoCorte.fecha + 'T' + (ultimoCorte.hora || '00:00') + ':00' : null;
  function enRango(m) {
    const ts = (m.fecha || '') + 'T' + (m.hora || '00:00') + ':00';
    if (ts > tsLimite) return false;          // después de la fecha límite
    if (tsCorte && ts <= tsCorte) return false; // antes o en el último corte
    return true;
  }
  const movsCaja = _movimientosDeCaja().filter(enRango);
  const excluidos = _foliosExcluidos();
  const yaEnCaja  = _foliosYaEnCaja(movsCaja);
  const sinteticos = Object.values(_recibosMap())
    .filter(r => !r.cancelado && !excluidos.has(String(r.folio)) && !yaEnCaja.has(Number(r.folio)))
    .filter(r => enRango({ fecha: r.fecha, hora: r.hora || r.hora_recibo || '00:00' }))
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
function abrirModalCorteRetro() {
  const hoyStr = new Date().toISOString().split('T')[0];
  const respNombre = typeof empNombre === 'function' ? empNombre() : (adminSesionUsuario || '');
  const ov = document.createElement('div');
  ov.id = 'modal-corte-retro';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML = `
    <div style="background:#1a1410;border:2px solid rgba(200,149,42,0.5);border-radius:12px;max-width:440px;width:100%;padding:24px;color:#e8d4a8;">
      <h3 style="margin:0 0 4px;color:#c8952a;font-family:serif;font-size:1.1rem;">⏰ Corte de Caja Retroactivo</h3>
      <p style="font-size:0.7rem;color:rgba(200,149,42,0.55);margin-bottom:18px;line-height:1.5;">
        Elige la fecha y hora del corte. El total disponible se calcula automáticamente desde el último corte registrado hasta esa fecha.
      </p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.6);display:block;margin-bottom:4px;">📅 Fecha del corte</label>
            <input type="date" id="corte-retro-fecha" value="${hoyStr}" max="${hoyStr}"
              oninput="corteRetroActualizarSaldo()"
              style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.3);border-radius:7px;padding:8px 10px;color:#fdfaf4;font-family:monospace;font-size:0.82rem;outline:none;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.6);display:block;margin-bottom:4px;">⏰ Hora del corte</label>
            <input type="time" id="corte-retro-hora" value="18:00"
              oninput="corteRetroActualizarSaldo()"
              style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.3);border-radius:7px;padding:8px 10px;color:#fdfaf4;font-family:monospace;font-size:0.82rem;outline:none;box-sizing:border-box;">
          </div>
        </div>
        <!-- Total calculado automáticamente — solo lectura -->
        <div>
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.6);display:block;margin-bottom:4px;">💰 Total disponible en caja hasta esa fecha</label>
          <div id="corte-retro-total-wrap" style="background:#0d0a05;border:2px solid rgba(200,149,42,0.4);border-radius:7px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-family:monospace;font-size:0.6rem;color:rgba(200,149,42,0.5);text-transform:uppercase;letter-spacing:0.1em;">A entregar</span>
            <span id="corte-retro-monto-display" style="font-family:monospace;font-size:1.15rem;font-weight:700;color:#4dca6a;">$0.00</span>
          </div>
          <div id="corte-retro-detalle" style="font-size:0.58rem;color:rgba(200,149,42,0.4);margin-top:4px;font-family:monospace;line-height:1.5;"></div>
        </div>
        <div>
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.6);display:block;margin-bottom:4px;">👤 Responsable</label>
          <input type="text" id="corte-retro-resp" value="${respNombre.toUpperCase()}"
            oninput="var _p=this.selectionStart;this.value=this.value.toUpperCase();this.setSelectionRange(_p,_p);"
            style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.3);border-radius:7px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:0.82rem;outline:none;box-sizing:border-box;">
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button id="btn-cancel-corte-retro" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(200,149,42,0.2);background:none;color:rgba(200,149,42,0.5);cursor:pointer;font-size:0.85rem;">Cancelar</button>
        <button onclick="registrarCorteRetro()" id="btn-confirmar-corte-retro"
          style="flex:2;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#c8952a,#8c6518);color:#fff;font-weight:700;cursor:pointer;font-size:0.88rem;">
          🔒 Registrar Corte
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
  document.getElementById('btn-cancel-corte-retro').onclick = function(){ ov.remove(); };
  // Calcular saldo inicial
  corteRetroActualizarSaldo();
}
function corteRetroActualizarSaldo() {
  const fecha = document.getElementById('corte-retro-fecha')?.value;
  const hora  = document.getElementById('corte-retro-hora')?.value || '18:00';
  const display = document.getElementById('corte-retro-monto-display');
  const detalle = document.getElementById('corte-retro-detalle');
  const btnConf = document.getElementById('btn-confirmar-corte-retro');
  const wrap    = document.getElementById('corte-retro-total-wrap');
  if (!fecha || !display) return;
  const saldo = getSaldoHasta(fecha, hora);
  // Buscar referencia al último corte anterior para el detalle
  const tsLimite = fecha + 'T' + hora + ':00';
  const ultimoCorte = ((D.cierres || [])
    .filter(c => c.fecha && c.esCorte === true)
    .filter(c => (c.fecha + 'T' + (c.hora || '00:00') + ':00') < tsLimite)
    .sort((a, b) => (b.fecha + 'T' + (b.hora || '00:00')).localeCompare(a.fecha + 'T' + (a.hora || '00:00'))))[0] || null;
  const fmtVal = typeof fmt === 'function' ? fmt : function(n){ return n.toLocaleString('es-MX',{minimumFractionDigits:2}); };
  display.textContent = '$' + fmtVal(Math.max(0, saldo));
  display.style.color = saldo > 0 ? '#4dca6a' : saldo < 0 ? '#ff4444' : 'rgba(200,149,42,0.5)';
  if (wrap) wrap.style.borderColor = saldo > 0 ? 'rgba(77,202,106,0.4)' : saldo < 0 ? 'rgba(192,22,26,0.4)' : 'rgba(200,149,42,0.4)';
  if (detalle) {
    if (ultimoCorte) {
      detalle.textContent = '↳ Desde último corte: ' + ultimoCorte.fecha + ' ' + (ultimoCorte.hora || '') + ' · hasta: ' + fecha + ' ' + hora;
    } else {
      detalle.textContent = '↳ Sin cortes previos — suma todos los movimientos hasta ' + fecha + ' ' + hora;
    }
  }
  if (btnConf) {
    btnConf.disabled = saldo <= 0;
    btnConf.style.opacity = saldo <= 0 ? '0.4' : '1';
    btnConf.style.cursor  = saldo <= 0 ? 'not-allowed' : 'pointer';
    btnConf.title = saldo <= 0 ? 'No hay saldo disponible en esa fecha' : '';
  }
}
function registrarCorteRetro() {
  const fecha = document.getElementById('corte-retro-fecha')?.value;
  const horaV = document.getElementById('corte-retro-hora')?.value || '18:00';
  const resp  = (document.getElementById('corte-retro-resp')?.value || (typeof empNombre==='function'?empNombre():'')).trim();
  if (!fecha) { if(typeof toast==='function') toast('Selecciona una fecha','err'); return; }
  // Calcular monto automáticamente — no editable
  const monto = Math.max(0, getSaldoHasta(fecha, horaV));
  if (monto <= 0) { if(typeof toast==='function') toast('No hay saldo disponible hasta esa fecha','err'); return; }
  // Registrar movimiento de egreso tipo corte
  const movCorte = {
    id:          'CORTE-' + Date.now(),
    fecha:       fecha,
    hora:        horaV,
    descripcion: 'CORTE DE CAJA — $' + (typeof fmt==='function'?fmt(monto):monto.toFixed(2)) + ' entregados',
    monto:       monto,
    tipo:        'egreso',
    cat:         'corte',
    fuente:      'corte',
    responsable: resp,
    esCorte:     true,
    retroactivo: true
  };
  if (!_registrarMovimiento(movCorte)) {
    if(typeof toast==='function') toast('⚠ Ya existe un corte con ese ID','err');
    return;
  }
  // Registrar en D.cierres
  if (!D.cierres) D.cierres = [];
  D.cierres.unshift({
    fecha:          fecha,
    hora:           horaV,
    saldoEntregado: monto,
    responsable:    resp,
    esCorte:        true,
    retroactivo:    true
  });
  // Resetear saldo acumulado a 0
  D.saldoAcumulado = 0;
  document.getElementById('modal-corte-retro')?.remove();
  _ultimoSyncPropio = Date.now();
  syncEstadoSupabase().catch((e)=>{ registrarError('Promise catch vacio', e); });
  if(typeof renderCaja   ==='function') renderCaja();
  if(typeof renderContab ==='function') renderContab();
  if(typeof badges       ==='function') badges();
  if(typeof toast==='function')
    toast('🔒 Corte registrado — '+fecha+' · $'+(typeof fmt==='function'?fmt(monto):monto.toFixed(2))+' entregados', 'ok');
}
// ═══ FIN CORTE DE CAJA RETROACTIVO ═══════════════════════════════════
// ══════════════════════════════════════════════════════════════════════
// MÓDULO RECIBOS EN GESTIÓN
// ══════════════════════════════════════════════════════════════════════
// ── Estado global del módulo ──────────────────────────────────────────
let _gestIdActivo = null;
let _gestFiltroActivo = 'todos';
// ── Utilidades internas ───────────────────────────────────────────────
function _gestHoy(){ return typeof hoy==='function'?hoy():new Date().toISOString().split('T')[0]; }
function _gestHora(){ return typeof hora==='function'?hora():new Date().toTimeString().slice(0,5); }
function _gestUser(){ return typeof empNombre==='function'?empNombre():(adminSesionUsuario||'Usuario'); }
function _gestFmt(n){ return typeof fmt==='function'?fmt(n):Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function _gestFecha(iso){
  if(!iso) return '—';
  const [y,m,d]=iso.split('-');
  const meses=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return (d||'?')+' '+meses[(parseInt(m)||1)-1]+' '+(y||'');
}
// ── Inicialización de D.gestiones ─────────────────────────────────────
function _gestInit(){
  if(!Array.isArray(D.gestiones)) D.gestiones=[];
}
// ── Calcular saldos de una gestión ────────────────────────────────────
function gestCalcular(g){
  const movs = g.movimientos||[];
  let costoBase=0, gastosExtra=0, serviciosExtra=0, descuentos=0, ajustes=0, abonos=0;
  movs.forEach(m=>{
    const monto=parseFloat(m.monto)||0;
    if(m.tipo==='COSTO BASE'||m.tipo==='COSTO TOTAL') costoBase+=monto;
    else if(m.tipo==='GASTO EXTRA') gastosExtra+=monto;
    else if(m.tipo==='SERVICIO EXTRA') serviciosExtra+=monto;
    else if(m.tipo==='DESCUENTO')  descuentos+=monto;
    else if(m.tipo==='AJUSTE')     ajustes+=monto;
    else if(m.tipo==='ABONO')      abonos+=monto;
  });
  // También sumar abonos de recibos oficiales
  (g.recibosOficiales||[]).forEach(r=>{ abonos+=parseFloat(r.monto)||0; });
  const totalCargos = costoBase + gastosExtra + serviciosExtra - descuentos + ajustes;
  const saldo = Math.max(0, totalCargos - abonos);
  return { costoBase, gastosExtra, serviciosExtra, descuentos, ajustes, abonos,
           totalCargos, saldo, pct: totalCargos>0?Math.min(100,Math.round(abonos/totalCargos*100)):0 };
}
// ── Badge HTML ────────────────────────────────────────────────────────
function _gestBadge(estatus){
  const map={
    'proceso':'gb-proceso',
    'parcial':'gb-parcial',
    'al-corriente':'gb-liquidado',
    'archivado':'gb-archivado',
    'cancelado':'gb-cancelado'
  };
  const label={'proceso':'🟡 En proceso','parcial':'🟠 Pago parcial','al-corriente':'🟢 Al corriente',
                'archivado':'🔵 Archivado','cancelado':'🔴 Cancelado'};
  const cls=map[estatus]||'gb-proceso';
  return `<span class="gest-badge ${cls}">${label[estatus]||estatus}</span>`;
}
// ── Actualizar estatus automáticamente ────────────────────────────────
function _gestActualizarEstatus(g){
  const c=gestCalcular(g);
  if(g.estatus==='cancelado'||g.estatus==='archivado') return;
  if(c.saldo===0 && c.totalCargos>0) g.estatus='al-corriente';
  else if(c.abonos>0 && c.saldo>0) g.estatus='parcial';
  else g.estatus='proceso';
}
// ── Render sidebar lista ───────────────────────────────────────────────
function gestRender(){
  _gestInit();
  // Actualizar badge nav
  const activas=(D.gestiones||[]).filter(g=>g.estatus!=='archivado'&&g.estatus!=='cancelado').length;
  const badgeEl=document.getElementById('badgeGestiones');
  if(badgeEl){ badgeEl.textContent=activas||''; badgeEl.style.display=activas?'':'none'; }
  // Mostrar vista lista por defecto
  gestVolverLista();
}
function gestVolverLista(){
  _gestIdActivo=null;
  const vLista=document.getElementById('gest-vista-lista');
  const vDetalle=document.getElementById('gest-vista-detalle');
  if(vLista) vLista.style.display='';
  if(vDetalle) vDetalle.style.display='none';
  gestFiltrar();
}
function gestFiltrar(){
  _gestInit();
  const q=(document.getElementById('gest-buscar')?.value||'').toLowerCase();
  const filtro=_gestFiltroActivo;
  const lista=document.getElementById('gest-lista');
  if(!lista) return;
  let items=(D.gestiones||[]).filter(g=>{
    if(filtro!=='todos'&&g.estatus!==filtro) return false;
    if(q&&!(g.cliente||'').toLowerCase().includes(q)&&!(g.tramite||'').toLowerCase().includes(q)) return false;
    return true;
  });
  const contador=document.getElementById('gest-contador');
  if(contador) contador.textContent='Mostrando '+items.length+' de '+(D.gestiones||[]).length+' clientes';
  if(!items.length){
    lista.innerHTML='<div style="padding:40px;font-family:monospace;font-size:0.72rem;color:rgba(200,149,42,0.3);text-align:center;">Sin gestiones registradas</div>';
    return;
  }
  lista.innerHTML=items.map(g=>{
    const c=gestCalcular(g);
    const saldoCls=c.saldo>0?'gest-card-saldo-neg':'gest-card-saldo-ok';
    const saldoTxt=c.saldo>0?'-$'+_gestFmt(c.saldo):'✓ Al corriente';
    const initials=(g.cliente||'?').trim().split(' ').filter(Boolean).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
    const avCls={'proceso':'av-proceso','parcial':'av-parcial','al-corriente':'av-corriente','archivado':'av-archivado','cancelado':'av-cancelado'}[g.estatus]||'av-proceso';
    const barCls=c.pct>=100?'gest-card-bar-fill completo':'gest-card-bar-fill';
    return `<div class="gest-card" onclick="gestMostrarDetalle('${g.id}')">
      <div class="gest-card-avatar ${avCls}">${initials}</div>
      <div class="gest-card-body">
        <div class="gest-card-nombre">${escHTML(g.cliente||'—')}</div>
        <div class="gest-card-tramite">${escHTML(g.tramite||'—')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          ${_gestBadge(g.estatus)}
          <span class="${saldoCls}">${saldoTxt}</span>
        </div>
        <div class="gest-card-bar"><div class="${barCls}" style="width:${c.pct}%;"></div></div>
      </div>
    </div>`;
  }).join('');
}
function gestSetFiltro(f, btn){
  _gestFiltroActivo=f;
  document.querySelectorAll('.gest-fbtn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  gestFiltrar();
}
function gestSetFiltroSelect(f){
  _gestFiltroActivo=f;
  gestFiltrar();
}
// ── Mostrar detalle de gestión ─────────────────────────────────────────
function gestMostrarDetalle(id){
  _gestInit();
  _gestIdActivo=id;
  const g=(D.gestiones||[]).find(x=>x.id===id);
  if(!g) return;
  _gestActualizarEstatus(g);
  // Cambiar a vista detalle
  const vLista=document.getElementById('gest-vista-lista');
  const vDetalle=document.getElementById('gest-vista-detalle');
  if(vLista) vLista.style.display='none';
  if(vDetalle) vDetalle.style.display='flex';
  const det=document.getElementById('gest-detalle');
  if(det) det.style.display='flex';
  // Header crema
  const _initials=(g.cliente||'?').trim().split(' ').filter(Boolean).map(function(p){return p[0]||'';}).slice(0,2).join('').toUpperCase();
  const _avEl=document.getElementById('gest-det-avatar');
  if(_avEl){ _avEl.textContent=_initials; }
  document.getElementById('gest-det-nombre').textContent=g.cliente||'—';
  const _tramSub=document.getElementById('gest-det-tramite-sub');
  if(_tramSub) _tramSub.textContent=g.tramite||'—';
  document.getElementById('gest-det-fecha').textContent=_gestFecha(g.fechaApertura);
  document.getElementById('gest-det-badge').innerHTML=_gestBadge(g.estatus);
  // Botones condicionales
  document.getElementById('gest-btn-recibo').style.display=(g.estatus==='cancelado'||g.estatus==='archivado')?'none':'';
  document.getElementById('gest-btn-archivar').style.display=(g.estatus==='cancelado'||g.estatus==='archivado')?'none':'';
  const c=gestCalcular(g);
  // Stats
  document.getElementById('gest-stat-total').textContent='$'+_gestFmt(c.totalCargos);
  document.getElementById('gest-stat-desglose').textContent='Base $'+_gestFmt(c.costoBase)+' + Extra $'+_gestFmt(c.gastosExtra+c.serviciosExtra);
  document.getElementById('gest-stat-pagado').textContent='$'+_gestFmt(c.abonos);
  document.getElementById('gest-stat-saldo').textContent='$'+_gestFmt(c.saldo);
  document.getElementById('gest-stat-gastos').textContent='$'+_gestFmt(c.gastosExtra+c.serviciosExtra);
  const limEl=document.getElementById('gest-stat-limite');
  if(g.limiteGastos>0){
    const pctG=Math.round((c.gastosExtra+c.serviciosExtra)/g.limiteGastos*100);
    limEl.textContent='Límite: $'+_gestFmt(g.limiteGastos)+' ('+pctG+'%)';
    limEl.style.color=pctG>=100?'#ff6060':pctG>=80?'#f08030':'rgba(200,149,42,0.4)';
  } else limEl.textContent='Sin límite definido';
  // Progreso
  document.getElementById('gest-pct').textContent=c.pct+'%';
  document.getElementById('gest-progress-fill').style.width=c.pct+'%';
  // Alertas
  const alertBox=document.getElementById('gest-alertas');
  let alertas='';
  if(c.saldo>0 && c.totalCargos>0 && c.pct<30) alertas+='<div class="gest-alert danger">⚠ Adeudo elevado — menos del 30% pagado</div>';
  if(g.limiteGastos>0 && (c.gastosExtra+c.serviciosExtra)>=g.limiteGastos) alertas+='<div class="gest-alert danger">🚨 Límite de gastos superado</div>';
  else if(g.limiteGastos>0 && (c.gastosExtra+c.serviciosExtra)>=g.limiteGastos*0.8) alertas+='<div class="gest-alert warn">⚠ Gastos al 80% del límite autorizado</div>';
  alertBox.innerHTML=alertas;
  // Tabla movimientos
  _gestRenderMovs(g);
  // Historial recibos
  _gestRenderHistorial(g);
  // Refrescar sidebar activo
  gestFiltrar();
}
// ── Render tabla de movimientos ────────────────────────────────────────
function _gestRenderMovs(g){
  const tbody=document.getElementById('gest-movs-body');
  const movs=g.movimientos||[];
  if(!movs.length){
    tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:16px;color:rgba(200,149,42,0.3);font-family:monospace;font-size:0.7rem;">Sin movimientos registrados</td></tr>';
  } else {
    const colores={'COSTO BASE':'#80a8ff','COSTO TOTAL':'#80a8ff','GASTO EXTRA':'#ff8060','SERVICIO EXTRA':'#f0c060',
                   'ABONO':'#4dca6a','DESCUENTO':'#a0e080','AJUSTE':'#c0a0ff'};
    tbody.innerHTML=movs.map((m,i)=>{
      const esAbono=m.tipo==='ABONO'||m.tipo==='DESCUENTO';
      const cargo=esAbono?'':'$'+_gestFmt(m.monto);
      const abono=esAbono?'$'+_gestFmt(m.monto):'';
      const color=colores[m.tipo]||'rgba(200,149,42,0.5)';
      return `<tr>
        <td style="white-space:nowrap;font-family:monospace;font-size:0.7rem;">${_gestFecha(m.fecha)}</td>
        <td><span style="font-family:monospace;font-size:0.6rem;color:${color};font-weight:700;">${escHTML(m.tipo||'')}</span></td>
        <td>${escHTML(m.concepto||'—')}</td>
        <td style="text-align:right;" class="cargo">${cargo}</td>
        <td style="text-align:right;" class="abono">${abono}</td>
        <td style="font-size:0.65rem;color:var(--muted);">${m.usuario||'—'}</td>
        <td style="font-size:0.65rem;color:var(--muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${m.obs||''}">${m.obs||'—'}</td>
        <td><button onclick="gestEliminarMov('${g.id}',${i})" style="background:none;border:none;color:rgba(192,22,26,0.5);cursor:pointer;font-size:0.7rem;padding:2px 6px;" title="Eliminar">✕</button></td>
      </tr>`;
    }).join('');
  }
  // Totales
  const c=gestCalcular(g);
  document.getElementById('gest-tt-cargos').textContent='$'+_gestFmt(c.totalCargos);
  document.getElementById('gest-tt-abonos').textContent='$'+_gestFmt(c.abonos);
  document.getElementById('gest-tt-pagado').textContent='$'+_gestFmt(c.abonos);
  document.getElementById('gest-tt-saldo').textContent='$'+_gestFmt(c.saldo);
}
// ── Render historial de recibos oficiales ──────────────────────────────
function _gestRenderHistorial(g){
  const body=document.getElementById('gest-historial-body');
  const recs=g.recibosOficiales||[];
  if(!recs.length){
    body.innerHTML='<div style="padding:12px 10px;font-family:monospace;font-size:0.65rem;color:rgba(200,149,42,0.3);">Sin recibos oficiales emitidos</div>';
    return;
  }
  body.innerHTML=recs.map(r=>{
    const tipoColor={'anticipo':'#e8c875','parcial':'#f08030','liquidacion':'#4dca6a'}[r.tipo]||'rgba(200,149,42,0.5)';
    const _rLetra = r.letra || (typeof letraVersion==='function'?letraVersion(r):'A') || 'A';
    return `<div class="gest-rec-row">
      <span style="font-family:monospace;font-size:0.68rem;">${_gestFecha(r.fecha)}</span>
      <span class="gest-rec-folio" onclick="abrirPreviaDesdeContab(${r.folio},'${_rLetra}')">#${typeof folioConLetra==='function'?folioConLetra(r.folio, r.anio_folio, _rLetra):r.folio}</span>
      <span style="font-size:0.72rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHTML(r.concepto||'—')}</span>
      <span style="text-align:right;font-family:monospace;font-size:0.78rem;font-weight:700;color:#4dca6a;">$${_gestFmt(r.monto)}</span>
      <span style="font-size:0.65rem;font-weight:700;color:${tipoColor};">${(r.tipo||'').toUpperCase()}</span>
      <span style="display:flex;gap:6px;">
        <button onclick="abrirPreviaDesdeContab(${r.folio},'${_rLetra}')" style="background:rgba(100,140,255,0.1);border:1px solid rgba(100,140,255,0.3);border-radius:4px;color:#80a8ff;font-size:0.6rem;padding:3px 8px;cursor:pointer;">Ver PDF</button>
      </span>
    </div>`;
  }).join('');
}
// ── Agregar movimiento ─────────────────────────────────────────────────
function gestAgregarMovimiento(){
  _gestInit();
  if(!_gestIdActivo){ if(typeof toast==='function') toast('Selecciona una gestión','err'); return; }
  const g=(D.gestiones||[]).find(x=>x.id===_gestIdActivo);
  if(!g) return;
  const tipo=document.getElementById('gest-add-tipo').value;
  const concepto=(document.getElementById('gest-add-concepto').value||'').trim();
  const monto=parseFloat(document.getElementById('gest-add-monto').value)||0;
  const obs=(document.getElementById('gest-add-obs').value||'').trim();
  if(!concepto){ if(typeof toast==='function') toast('Ingresa el concepto','err'); return; }
  if(monto<=0){ if(typeof toast==='function') toast('El monto debe ser mayor a 0','err'); return; }
  if(!g.movimientos) g.movimientos=[];
  g.movimientos.push({
    id:'GMOV-'+Date.now(),
    fecha:_gestHoy(), hora:_gestHora(),
    tipo, concepto, monto, obs,
    usuario:_gestUser(),
    fechaCreacion:_gestHoy()
  });
  _gestActualizarEstatus(g);
  // Limpiar inputs
  document.getElementById('gest-add-concepto').value='';
  document.getElementById('gest-add-monto').value='';
  document.getElementById('gest-add-obs').value='';
  _gestGuardarYRefrescar(g);
  if(typeof toast==='function') toast('✅ Movimiento agregado','ok');
}
function gestEliminarMov(gid, idx){
  if(!confirm('¿Eliminar este movimiento?')) return;
  _gestInit();
  const g=(D.gestiones||[]).find(x=>x.id===gid);
  if(!g||!g.movimientos) return;
  g.movimientos.splice(idx,1);
  _gestActualizarEstatus(g);
  _gestGuardarYRefrescar(g);
  if(typeof toast==='function') toast('Movimiento eliminado');
}
// ── Guardar y refrescar ───────────────────────────────────────────────
function _gestGuardarYRefrescar(g){
  // Marca de tiempo — necesaria para que el merge de sincronizarFolio() no
  // pise esta edición con una copia vieja de Supabase si un pull llega antes
  // de que este guardado se confirme (mismo fix que carpetas/escrituras/
  // citas/pendientes/juicios/directorio).
  if(g) g.fechaMod = new Date().toISOString();
  if(typeof save==='function') save();
  if(typeof syncEstadoSupabaseDebounced==='function') syncEstadoSupabaseDebounced();
  gestMostrarDetalle(g.id);
  gestFiltrar();
}
// ── Archivar gestión ──────────────────────────────────────────────────
function gestArchivar(){
  _gestInit();
  const g=(D.gestiones||[]).find(x=>x.id===_gestIdActivo);
  if(!g) return;
  if(!confirm('¿Confirmas que todos los procesos de este asunto han concluido?\n\nLa gestión se archivará y dejará de aparecer en el panel activo, pero quedará en el historial.')) return;
  g.estatus='archivado';
  g.fechaArchivado=_gestHoy();
  _gestIdActivo=null;
  _gestGuardarYRefrescar(g);
  gestVolverLista();
  if(typeof toast==='function') toast('📦 Gestión archivada','ok');
}
function gestGuardarCambios(){
  _gestInit();
  const g=(D.gestiones||[]).find(x=>x.id===_gestIdActivo);
  if(!g) return;
  _gestActualizarEstatus(g);
  g.fechaMod = new Date().toISOString();
  if(typeof save==='function') save();
  if(typeof syncEstadoSupabaseDebounced==='function') syncEstadoSupabaseDebounced();
  gestFiltrar();
  if(typeof toast==='function') toast('✅ Cambios guardados','ok');
}
function gestEstadoCuenta(){
  if(typeof toast==='function') toast('Función próximamente disponible','ok');
}
function gestCancelarModal(){
  if(!_gestIdActivo) return;
  if(!confirm('¿Cancelar esta gestión? Se marcará como cancelada y quedará en historial.')) return;
  _gestInit();
  const g=(D.gestiones||[]).find(x=>x.id===_gestIdActivo);
  if(!g) return;
  g.estatus='cancelado';
  g.fechaCancelado=_gestHoy();
  _gestGuardarYRefrescar(g);
  gestMostrarDetalle(g.id);
  if(typeof toast==='function') toast('Gestión cancelada');
}
// ══════════════════════════════════════════════════════════════════════
// MODAL NUEVA GESTIÓN
// ══════════════════════════════════════════════════════════════════════
function gestNuevaModal(){
  const hoyStr=new Date().toISOString().split('T')[0];
  const ov=document.createElement('div');
  ov.id='modal-gest-nueva';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML=`
    <div style="background:#1a1410;border:2px solid rgba(200,149,42,0.4);border-radius:12px;max-width:520px;width:100%;padding:24px;color:#e8d4a8;max-height:90vh;overflow-y:auto;">
      <h3 style="margin:0 0 4px;color:#c8952a;font-family:serif;font-size:1.1rem;">📋 Nueva Gestión</h3>
      <p style="font-size:0.65rem;color:rgba(200,149,42,0.4);margin-bottom:18px;font-family:monospace;">Completa los datos del cliente y elige el modo de cobro.</p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Nombre del cliente *</label>
          <input id="gn-cliente" type="text" oninput="var _p=this.selectionStart;this.value=this.value.toUpperCase();this.setSelectionRange(_p,_p);"
            style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:0.85rem;outline:none;box-sizing:border-box;" placeholder="NOMBRE COMPLETO DEL CLIENTE">
        </div>
        <div>
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Tipo de trámite / asunto *</label>
          <input id="gn-tramite" type="text" oninput="var _p=this.selectionStart;this.value=this.value.toUpperCase();this.setSelectionRange(_p,_p);"
            style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:0.85rem;outline:none;box-sizing:border-box;" placeholder="EJ. JUICIO MERCANTIL, REEMPLACAMIENTO, ESCRITURAS...">
        </div>
        <div>
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Fecha de apertura</label>
          <input id="gn-fecha" type="date" value="${hoyStr}"
            style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:0.82rem;outline:none;box-sizing:border-box;">
        </div>
        <!-- MODO DE COBRO -->
        <div>
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Modo de cobro *</label>
          <div style="display:flex;flex-direction:column;gap:7px;">
            <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:8px;cursor:pointer;border:1.5px solid rgba(200,149,42,0.15);background:rgba(200,149,42,0.04);transition:all 0.15s;" id="gn-modo-fijo-lbl" onclick="gnSelModo('fijo')">
              <div style="width:16px;height:16px;border-radius:50%;border:2px solid rgba(200,149,42,0.4);flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;" id="gn-radio-fijo"></div>
              <div>
                <div style="font-size:0.78rem;font-weight:700;color:#e8c875;">💰 Costo total fijo</div>
                <div style="font-size:0.65rem;color:rgba(200,149,42,0.5);margin-top:2px;">Se pacta un monto total desde el inicio. Ej: $15,000 por el juicio completo.</div>
              </div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:8px;cursor:pointer;border:1.5px solid rgba(200,149,42,0.15);background:rgba(200,149,42,0.04);transition:all 0.15s;" id="gn-modo-variable-lbl" onclick="gnSelModo('variable')">
              <div style="width:16px;height:16px;border-radius:50%;border:2px solid rgba(200,149,42,0.4);flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;" id="gn-radio-variable"></div>
              <div>
                <div style="font-size:0.78rem;font-weight:700;color:#e8c875;">📊 Costo variable</div>
                <div style="font-size:0.65rem;color:rgba(200,149,42,0.5);margin-top:2px;">Sin monto pactado. Los gastos se registran conforme ocurren y el total se construye solo.</div>
              </div>
            </label>
            <label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:8px;cursor:pointer;border:1.5px solid rgba(200,149,42,0.15);background:rgba(200,149,42,0.04);transition:all 0.15s;" id="gn-modo-anticipado-lbl" onclick="gnSelModo('anticipado')">
              <div style="width:16px;height:16px;border-radius:50%;border:2px solid rgba(200,149,42,0.4);flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;" id="gn-radio-anticipado"></div>
              <div>
                <div style="font-size:0.78rem;font-weight:700;color:#e8c875;">💵 Anticipo + variable</div>
                <div style="font-size:0.65rem;color:rgba(200,149,42,0.5);margin-top:2px;">El cliente da un anticipo inicial y el resto se acumula según gastos reales.</div>
              </div>
            </label>
          </div>
        </div>
        <!-- CAMPO CONDICIONAL según modo -->
        <div id="gn-campo-monto" style="display:none;">
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;" id="gn-campo-monto-label">Costo total pactado ($) *</label>
          <input id="gn-monto" type="number" min="0" step="0.01" placeholder="0.00" onfocus="this.select()"
            style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:0.85rem;outline:none;box-sizing:border-box;">
          <div id="gn-campo-monto-hint" style="font-size:0.6rem;color:rgba(200,149,42,0.35);margin-top:3px;font-family:monospace;"></div>
        </div>
        <div>
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Observaciones</label>
          <textarea id="gn-obs" rows="2"
            style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:sans-serif;font-size:0.82rem;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button id="gn-cancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(200,149,42,0.2);background:none;color:rgba(200,149,42,0.5);cursor:pointer;font-size:0.85rem;">Cancelar</button>
        <button onclick="gestGuardarNueva()" style="flex:2;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#c8952a,#8c6518);color:#fff;font-weight:700;cursor:pointer;font-size:0.88rem;">✅ Crear Gestión</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov) ov.remove();});
  document.getElementById('gn-cancel').onclick=()=>ov.remove();
  // Seleccionar modo fijo por defecto
  gnSelModo('fijo');
}
function gnSelModo(modo){
  window._gnModoActivo=modo;
  // Estilos de los botones
  ['fijo','variable','anticipado'].forEach(function(m){
    const lbl=document.getElementById('gn-modo-'+m+'-lbl');
    const radio=document.getElementById('gn-radio-'+m);
    if(!lbl||!radio) return;
    if(m===modo){
      lbl.style.borderColor='rgba(200,149,42,0.6)';
      lbl.style.background='rgba(200,149,42,0.1)';
      radio.style.background='#c8952a';
      radio.style.borderColor='#c8952a';
      radio.innerHTML='<div style="width:7px;height:7px;border-radius:50%;background:#1a0e00;"></div>';
    } else {
      lbl.style.borderColor='rgba(200,149,42,0.15)';
      lbl.style.background='rgba(200,149,42,0.04)';
      radio.style.background='none';
      radio.style.borderColor='rgba(200,149,42,0.4)';
      radio.innerHTML='';
    }
  });
  // Mostrar/ocultar campo monto
  const campoMonto=document.getElementById('gn-campo-monto');
  const label=document.getElementById('gn-campo-monto-label');
  const hint=document.getElementById('gn-campo-monto-hint');
  if(modo==='variable'){
    campoMonto.style.display='none';
  } else {
    campoMonto.style.display='';
    if(modo==='fijo'){
      label.textContent='Costo total pactado ($) *';
      hint.textContent='Este monto se registrará como el costo total acordado con el cliente.';
    } else {
      label.textContent='Anticipo inicial recibido ($)';
      hint.textContent='Monto que el cliente entrega al inicio. Se registrará como abono y el resto se acumula según gastos.';
    }
  }
}
function gestGuardarNueva(){
  const cliente=(document.getElementById('gn-cliente')?.value||'').trim();
  const tramite=(document.getElementById('gn-tramite')?.value||'').trim();
  const fecha=document.getElementById('gn-fecha')?.value||_gestHoy();
  const obs=(document.getElementById('gn-obs')?.value||'').trim();
  const modo=window._gnModoActivo||'fijo';
  const monto=parseFloat(document.getElementById('gn-monto')?.value)||0;
  if(!cliente){ if(typeof toast==='function') toast('Ingresa el nombre del cliente','err'); return; }
  if(!tramite){ if(typeof toast==='function') toast('Ingresa el tipo de trámite','err'); return; }
  if(modo==='fijo' && monto<=0){ if(typeof toast==='function') toast('Ingresa el costo total pactado','err'); return; }
  _gestInit();
  const id='GEST-'+Date.now();
  const g={
    id, cliente, tramite, fechaApertura:fecha,
    modoCobro:modo, obs, estatus:'proceso',
    movimientos:[], recibosOficiales:[],
    creadoPor:_gestUser(), fechaCreacion:_gestHoy()
  };
  // Registrar movimiento inicial según el modo
  const ts=Date.now();
  if(modo==='fijo' && monto>0){
    g.movimientos.push({
      id:'GMOV-'+ts, fecha, hora:_gestHora(),
      tipo:'COSTO TOTAL', concepto:'Costo total pactado — '+tramite,
      monto, obs:'Costo total acordado con el cliente',
      usuario:_gestUser(), fechaCreacion:_gestHoy()
    });
  } else if(modo==='anticipado' && monto>0){
    g.movimientos.push({
      id:'GMOV-'+ts, fecha, hora:_gestHora(),
      tipo:'ABONO', concepto:'Anticipo inicial — '+tramite,
      monto, obs:'Anticipo inicial recibido al abrir la gestión',
      usuario:_gestUser(), fechaCreacion:_gestHoy()
    });
  }
  // Para modo variable no se registra nada inicial
  D.gestiones.unshift(g);
  document.getElementById('modal-gest-nueva')?.remove();
  if(typeof save==='function') save();
  if(typeof syncEstadoSupabaseDebounced==='function') syncEstadoSupabaseDebounced();
  gestFiltrar();
  const activas2=(D.gestiones||[]).filter(function(g){ return g.estatus!=='archivado'&&g.estatus!=='cancelado'; }).length;
  const badgeEl2=document.getElementById('badgeGestiones');
  if(badgeEl2){ badgeEl2.textContent=activas2||''; badgeEl2.style.display=activas2?'':'none'; }
  gestMostrarDetalle(id);
  if(typeof toast==='function') toast('✅ Gestión creada: '+cliente,'ok');
}
// ══════════════════════════════════════════════════════════════════════
// MODAL EDITAR GESTIÓN
// ══════════════════════════════════════════════════════════════════════
function gestEditarModal(){
  _gestInit();
  const g=(D.gestiones||[]).find(x=>x.id===_gestIdActivo);
  if(!g) return;
  const ov=document.createElement('div');
  ov.id='modal-gest-editar';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML=`
    <div style="background:#1a1410;border:2px solid rgba(200,149,42,0.4);border-radius:12px;max-width:500px;width:100%;padding:24px;color:#e8d4a8;max-height:90vh;overflow-y:auto;">
      <h3 style="margin:0 0 18px;color:#c8952a;font-family:serif;font-size:1.1rem;">✏️ Editar Gestión</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div><label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Nombre del cliente</label>
          <input id="ge-cliente" type="text" value="${escHTML(g.cliente||'')}" oninput="var _p=this.selectionStart;this.value=this.value.toUpperCase();this.setSelectionRange(_p,_p);" style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:0.85rem;outline:none;box-sizing:border-box;"></div>
        <div><label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Tipo de trámite</label>
          <input id="ge-tramite" type="text" value="${g.tramite||''}" oninput="var _p=this.selectionStart;this.value=this.value.toUpperCase();this.setSelectionRange(_p,_p);" style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:0.85rem;outline:none;box-sizing:border-box;"></div>
        <div><label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Límite de gastos ($)</label>
          <input id="ge-limite" type="number" value="${g.limiteGastos||''}" min="0" step="0.01" style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:0.85rem;outline:none;box-sizing:border-box;"></div>
        <div><label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Observaciones</label>
          <textarea id="ge-obs" rows="2" style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:sans-serif;font-size:0.82rem;outline:none;resize:vertical;box-sizing:border-box;">${g.obs||''}</textarea></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button id="ge-cancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(200,149,42,0.2);background:none;color:rgba(200,149,42,0.5);cursor:pointer;font-size:0.85rem;">Cancelar</button>
        <button onclick="gestGuardarEdicion()" style="flex:2;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#c8952a,#8c6518);color:#fff;font-weight:700;cursor:pointer;font-size:0.88rem;">💾 Guardar cambios</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov) ov.remove();});
  document.getElementById('ge-cancel').onclick=()=>ov.remove();
}
function gestGuardarEdicion(){
  _gestInit();
  const g=(D.gestiones||[]).find(x=>x.id===_gestIdActivo);
  if(!g) return;
  g.cliente=(document.getElementById('ge-cliente')?.value||'').trim()||g.cliente;
  g.tramite=(document.getElementById('ge-tramite')?.value||'').trim()||g.tramite;
  g.limiteGastos=parseFloat(document.getElementById('ge-limite')?.value)||0;
  g.obs=(document.getElementById('ge-obs')?.value||'').trim();
  document.getElementById('modal-gest-editar')?.remove();
  _gestGuardarYRefrescar(g);
  if(typeof toast==='function') toast('✅ Gestión actualizada','ok');
}
// ══════════════════════════════════════════════════════════════════════
// BLOQUE 4: GENERAR RECIBO OFICIAL DESDE GESTIÓN
// ══════════════════════════════════════════════════════════════════════
function gestGenerarReciboModal(){
  _gestInit();
  const g=(D.gestiones||[]).find(x=>x.id===_gestIdActivo);
  if(!g) return;
  const c=gestCalcular(g);
  if(c.saldo<=0){ if(typeof toast==='function') toast('No hay saldo pendiente','err'); return; }
  const ov=document.createElement('div');
  ov.id='modal-gest-recibo';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML=`
    <div style="background:#1a1410;border:2px solid rgba(40,180,80,0.4);border-radius:12px;max-width:480px;width:100%;padding:24px;color:#e8d4a8;max-height:90vh;overflow-y:auto;">
      <h3 style="margin:0 0 6px;color:#4dca6a;font-family:serif;font-size:1.1rem;">📄 Generar Recibo Oficial</h3>
      <p style="font-size:0.7rem;color:rgba(200,149,42,0.5);margin-bottom:18px;line-height:1.5;">
        Cliente: <strong style="color:var(--gold-l);">${escHTML(g.cliente||'')}</strong><br>
        Saldo pendiente: <strong style="color:#ff6060;">$${_gestFmt(c.saldo)}</strong>
      </p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Monto a cobrar *</label>
          <input id="gr-monto" type="number" min="0.01" step="0.01" max="${c.saldo}" value="${c.saldo.toFixed(2)}" style="width:100%;background:#110d06;border:1.5px solid rgba(40,180,80,0.3);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:1rem;font-weight:700;outline:none;box-sizing:border-box;">
          <div style="font-size:0.6rem;color:rgba(200,149,42,0.4);margin-top:3px;font-family:monospace;">Máximo: $${_gestFmt(c.saldo)}</div>
        </div>
        <div>
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Concepto del recibo *</label>
          <input id="gr-concepto" type="text" value="${g.tramite||''}" oninput="var _p=this.selectionStart;this.value=this.value.toUpperCase();this.setSelectionRange(_p,_p);" style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:0.85rem;outline:none;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Tipo de pago *</label>
          <select id="gr-tipo" style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:0.85rem;outline:none;box-sizing:border-box;">
            <option value="anticipo">Anticipo</option>
            <option value="parcial">Pago parcial</option>
            <option value="liquidacion" ${c.saldo<=c.totalCargos?'selected':''}>Liquidación</option>
          </select>
        </div>
        <div>
          <label style="font-family:monospace;font-size:0.58rem;text-transform:uppercase;color:rgba(200,149,42,0.5);display:block;margin-bottom:4px;">Descripción adicional (opcional)</label>
          <input id="gr-desc" type="text" placeholder="Descripción para el PDF..." style="width:100%;background:#110d06;border:1.5px solid rgba(200,149,42,0.25);border-radius:6px;padding:8px 12px;color:#fdfaf4;font-family:monospace;font-size:0.82rem;outline:none;box-sizing:border-box;">
        </div>
      </div>
      <div id="gr-status" style="margin-top:12px;font-family:monospace;font-size:0.7rem;color:rgba(200,149,42,0.5);min-height:20px;"></div>
      <div style="display:flex;gap:10px;margin-top:16px;">
        <button id="gr-cancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid rgba(200,149,42,0.2);background:none;color:rgba(200,149,42,0.5);cursor:pointer;font-size:0.85rem;">Cancelar</button>
        <button id="gr-confirm" onclick="gestConfirmarRecibo('${g.id}')" style="flex:2;padding:10px;border-radius:8px;border:none;background:linear-gradient(135deg,#1a7a3a,#0f4a22);color:#fff;font-weight:700;cursor:pointer;font-size:0.88rem;">📄 Generar y registrar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov) ov.remove();});
  document.getElementById('gr-cancel').onclick=()=>ov.remove();
}
async function gestConfirmarRecibo(gid){
  _gestInit();
  const g=(D.gestiones||[]).find(x=>x.id===gid);
  if(!g) return;
  const monto=parseFloat(document.getElementById('gr-monto')?.value)||0;
  const concepto=(document.getElementById('gr-concepto')?.value||'').trim();
  const tipo=document.getElementById('gr-tipo')?.value||'parcial';
  const desc=(document.getElementById('gr-desc')?.value||'').trim();
  const statusEl=document.getElementById('gr-status');
  const btnConf=document.getElementById('gr-confirm');
  if(monto<=0){ if(typeof toast==='function') toast('El monto debe ser mayor a 0','err'); return; }
  if(!concepto){ if(typeof toast==='function') toast('Ingresa el concepto','err'); return; }
  const c=gestCalcular(g);
  if(monto>c.saldo+0.01){ if(typeof toast==='function') toast('El monto supera el saldo pendiente','err'); return; }
  if(btnConf) btnConf.disabled=true;
  if(statusEl) statusEl.textContent='⏳ Generando recibo oficial...';
  try {
    // Reservar folio atómico — misma ruta que guardarRecibo() para evitar colisiones
    const folio = await reservarFolioEnDrive();
    // Construir datos del recibo
    const fechaHoy=_gestHoy();
    const horaAhora=_gestHora();
    const descripcionCompleta=concepto+(desc?' — '+desc:'');
    const datosRec={
      folio, fecha:fechaHoy, fecha_recibo:fechaHoy,
      hora:horaAhora, hora_recibo:horaAhora,
      nombre:g.cliente,
      clientes:[{nombre:g.cliente,movil:'',tel:'',domicilio:''}],
      conceptos:[{concepto, descripcion:descripcionCompleta, precio:monto}],
      total:monto, anticipo:monto, saldo:0,
      saldoPendiente:0, totalAbonado:monto,
      generadoPor:_gestUser(), responsable:_gestUser(),
      nombre_cliente_firma:g.cliente,
      obs:'Generado desde Gestión: '+g.tramite,
      tipoTramite:'normal', copias:[], costosExtra:[],
      pagosParciales:[], cancelado:false, complementos:[]
    };
    if(statusEl) statusEl.textContent='⏳ Generando PDF...';
    // Generar PDF — usar SIEMPRE generarPDF (plantilla oficial LEX-MÉXICO)
    const qrTxt='LEX-MEXICO|Folio:'+folioFormato(folio)+'|'+g.cliente+'|'+fechaHoy+' '+horaAhora;
    const qrURL=typeof qrToDataURL==='function'?await qrToDataURL(qrTxt):null;
    const _docGest=await generarPDF(datosRec,folio,qrURL);
    const pdfBlob=_docGest.output('blob');
    datosRec.pdfBase64=_docGest.output('datauristring');
    if(statusEl) statusEl.textContent='⏳ Subiendo a Storage...';
    // Subir PDF
    const nombrePDF=(typeof folioConLetra==='function' ? folioConLetra(folio, (typeof appData!=='undefined'?appData.anioFolioActual:null)||new Date().getFullYear(), 'A') : folioFormato(folio))+'.pdf'; // nombre corto canónico
    datosRec.archivo=nombrePDF;
    await subirPDFaDrive(pdfBlob,nombrePDF);
    // Guardar en appData.recibos
    if(!appData.recibos) appData.recibos=[];
    if (typeof _revivirSiTombstone === 'function') _revivirSiTombstone(datosRec);
    appData.recibos.unshift(datosRec);
    if(typeof REC!=='undefined'){ if(!REC.recibos) REC.recibos=[]; REC.recibos.unshift(datosRec); }
    // Registrar en contabilidad
    const movCont={
      id:'M-REC-NEW-'+folio+'-'+Date.now(),
      folioCaja:typeof generarFolioMovCaja==='function'?generarFolioMovCaja():'',
      fecha:fechaHoy, hora:horaAhora,
      descripcion:(tipo==='liquidacion'?'Liquidación':'Pago '+tipo)+' — Gestión: '+g.tramite+' · '+g.cliente,
      nombre:g.cliente, folio,
      monto, tipo:'ingreso',
      cat:(tipo==='liquidacion'?'Liquidado':'Anticipo')+' · #'+folioFormato(folio),
      estatus:tipo==='liquidacion'?'Liquidado':'Anticipo',
      fuente:'recibo', responsable:_gestUser()
    };
    _registrarMovimiento(movCont);
    // Registrar en la gestión
    if(!g.recibosOficiales) g.recibosOficiales=[];
    g.recibosOficiales.push({
      folio, fecha:fechaHoy, hora:horaAhora,
      monto, concepto:descripcionCompleta, tipo,
      usuario:_gestUser(), archivo:nombrePDF
    });
    // Agregar como abono interno también
    if(!g.movimientos) g.movimientos=[];
    g.movimientos.push({
      id:'GMOV-REC-'+folio,
      fecha:fechaHoy, hora:horaAhora,
      tipo:'ABONO', concepto:'Recibo oficial #'+folioFormato(folio)+' — '+concepto,
      monto, obs:'Recibo oficial generado',
      usuario:_gestUser(), folioRecibo:folio
    });
    _gestActualizarEstatus(g);
    // Guardar todo
    if(typeof save==='function') save();
    if(typeof syncEstadoSupabase==='function') syncEstadoSupabase().catch(()=>{});
    if(typeof renderContab==='function') renderContab();
    if(typeof renderCaja==='function') renderCaja();
    document.getElementById('modal-gest-recibo')?.remove();
    _gestGuardarYRefrescar(g);
    if(typeof toast==='function') toast('✅ Recibo #'+folioFormato(folio)+' generado y registrado','ok');
  } catch(e){
    console.error('[Gestión] Error generando recibo:',e);
    if(statusEl) statusEl.textContent='❌ Error: '+e.message;
    if(btnConf) btnConf.disabled=false;
    if(typeof toast==='function') toast('❌ '+e.message,'err');
  }
}
// ══════════════════════════════════════════════════════════════════════
// VINCULACIÓN DE RECIBO OFICIAL CON GESTIÓN ACTIVA
// ══════════════════════════════════════════════════════════════════════
function _gestVincularModal(datosRecibo, folio){
  if(!Array.isArray(D.gestiones)||!D.gestiones.length) return;
  const nombreCliente=(datosRecibo.nombre||'').toUpperCase().trim();
  const monto=parseFloat(datosRecibo.anticipo||datosRecibo.total||0);
  const esLiq=(datosRecibo.saldo||0)<=0;
  const tipoPago=esLiq?'liquidacion':'parcial';
  // Buscar gestiones activas (excluir archivadas y canceladas)
  const activas=(D.gestiones||[]).filter(function(g){
    return g.estatus!=='archivado'&&g.estatus!=='cancelado';
  });
  if(!activas.length) return;
  // Coincidencias automáticas por nombre
  function _sim(a,b){
    a=a.toUpperCase().replace(/[^A-Z]/g,'');
    b=b.toUpperCase().replace(/[^A-Z]/g,'');
    if(!a||!b) return 0;
    if(a===b) return 1;
    if(a.includes(b)||b.includes(a)) return 0.85;
    // Palabras en común
    const wa=a.split('');const wb=b.split('');
    let com=0; wa.forEach(function(c){if(wb.includes(c))com++;});
    return com/Math.max(wa.length,wb.length);
  }
  const coincidencias=activas.filter(function(g){
    return _sim(g.cliente||'',nombreCliente)>=0.6;
  });
  const ov=document.createElement('div');
  ov.id='modal-gest-vincular';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
  function _renderLista(gestiones, titulo, esManual){
    const filas=gestiones.map(function(g){
      const c=gestCalcular(g);
      return '<div onclick="_gestConfirmarVinculo(\"'+g.id+'\",'+folio+','+monto+',\"'+tipoPago+'\")" '+
        'style="padding:10px 14px;border-radius:7px;border:1px solid rgba(200,149,42,0.2);background:rgba(200,149,42,0.05);cursor:pointer;margin-bottom:7px;transition:all 0.15s;" '+
        'onmouseover="this.style.borderColor=\'rgba(200,149,42,0.6)\';this.style.background=\'rgba(200,149,42,0.12)\'" '+
        'onmouseout="this.style.borderColor=\'rgba(200,149,42,0.2)\';this.style.background=\'rgba(200,149,42,0.05)\'">' +
        '<div style="font-size:0.82rem;font-weight:700;color:#e8d4a8;">'+g.cliente+'</div>' +
        '<div style="font-size:0.65rem;color:rgba(200,149,42,0.6);font-family:monospace;margin-top:2px;">'+g.tramite+'</div>' +
        '<div style="display:flex;justify-content:space-between;margin-top:5px;">' +
        '<span style="font-size:0.6rem;color:rgba(200,149,42,0.4);font-family:monospace;">Apertura: '+(g.fechaApertura||'—')+'</span>' +
        '<span style="font-size:0.65rem;font-family:monospace;color:#ff6060;font-weight:700;">Saldo: $'+_gestFmt(c.saldo)+'</span>' +
        '</div></div>';
    }).join('');
    const buscador=esManual?'':
      '<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(200,149,42,0.1);">'+
      '<div style="font-size:0.6rem;font-family:monospace;color:rgba(200,149,42,0.4);margin-bottom:5px;">¿No aparece? Busca manualmente:</div>'+
      '<div style="position:relative;">'+
      '<input id="gest-vinc-buscar" type="text" placeholder="Buscar por nombre o trámite..." oninput="_gestVincularBuscar(this.value)" '+
      'style="width:100%;background:#110d06;border:1px solid rgba(200,149,42,0.2);border-radius:6px;padding:7px 10px;color:#e8d4a8;font-family:monospace;font-size:0.75rem;outline:none;box-sizing:border-box;">'+
      '</div>'+
      '<div id="gest-vinc-resultados" style="margin-top:6px;"></div>'+
      '</div>';
    return '<div style="background:#1a1410;border:2px solid rgba(200,149,42,0.4);border-radius:12px;max-width:460px;width:100%;padding:22px;color:#e8d4a8;max-height:85vh;overflow-y:auto;">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">'+
      '<h3 style="margin:0;color:#c8952a;font-family:serif;font-size:1rem;">🔗 Vincular con gestión</h3>'+
      '<button onclick="document.getElementById(\'modal-gest-vincular\')?.remove()" '+
      'style="background:none;border:none;color:rgba(200,149,42,0.4);cursor:pointer;font-size:1.1rem;padding:2px 6px;">✕</button>'+
      '</div>'+
      '<p style="font-size:0.65rem;color:rgba(200,149,42,0.45);margin-bottom:14px;font-family:monospace;">'+
      'Recibo <strong style="color:#c8952a;">#'+folioFormato(folio)+'</strong> · '+
      '<strong style="color:#4dca6a;">$'+_gestFmt(monto)+'</strong> · '+datosRecibo.nombre+
      '</p>'+
      '<div style="font-family:monospace;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(200,149,42,0.4);margin-bottom:8px;">'+titulo+'</div>'+
      filas+buscador+
      '<button onclick="document.getElementById(\'modal-gest-vincular\')?.remove()" '+
      'style="width:100%;margin-top:14px;padding:9px;border-radius:7px;border:1px solid rgba(200,149,42,0.2);background:none;color:rgba(200,149,42,0.45);cursor:pointer;font-size:0.8rem;font-family:monospace;">'+
      'Omitir — este recibo no pertenece a ninguna gestión</button>'+
      '</div>';
  }
  if(coincidencias.length){
    ov.innerHTML=_renderLista(coincidencias,'Gestiones activas encontradas para este cliente:',false);
  } else {
    ov.innerHTML=_renderLista([],'No se encontraron coincidencias automáticas',false);
  }
  document.body.appendChild(ov);
  ov.addEventListener('click',function(e){ if(e.target===ov) ov.remove(); });
  // Limpiar lista si no hay coincidencias
  if(!coincidencias.length){
    const lista=ov.querySelector('[style*="margin-bottom:7px"]');
  }
}
function _gestVincularBuscar(q){
  const res=document.getElementById('gest-vinc-resultados');
  if(!res) return;
  q=(q||'').trim().toUpperCase();
  if(q.length<2){ res.innerHTML=''; return; }
  const activas=(D.gestiones||[]).filter(function(g){
    return g.estatus!=='archivado'&&g.estatus!=='cancelado'&&
      ((g.cliente||'').toUpperCase().includes(q)||(g.tramite||'').toUpperCase().includes(q));
  });
  if(!activas.length){
    res.innerHTML='<div style="font-size:0.65rem;color:rgba(200,149,42,0.3);font-family:monospace;padding:6px 0;">Sin resultados</div>';
    return;
  }
  res.innerHTML=activas.map(function(g){
    const c=gestCalcular(g);
    // Obtener folio y monto del recibo en curso desde el modal padre
    const folioV=parseInt(res.closest('[id="modal-gest-vincular"]')?.querySelector('strong')?.textContent?.replace(/[^0-9]/g,'')||'0');
    return '<div onclick="_gestConfirmarVinculoBusq(\"'+g.id+'\")" '+
      'style="padding:8px 12px;border-radius:6px;border:1px solid rgba(200,149,42,0.2);background:rgba(200,149,42,0.05);cursor:pointer;margin-bottom:5px;" '+
      'onmouseover="this.style.background=\'rgba(200,149,42,0.12)\'" '+
      'onmouseout="this.style.background=\'rgba(200,149,42,0.05)\'">' +
      '<div style="font-size:0.78rem;font-weight:700;color:#e8d4a8;">'+escHTML(g.cliente||'')+'</div>'+
      '<div style="font-size:0.62rem;color:rgba(200,149,42,0.55);font-family:monospace;">'+escHTML(g.tramite||'')+'</div>'+
      '<div style="font-size:0.62rem;font-family:monospace;color:#ff6060;margin-top:3px;">Saldo: $'+_gestFmt(c.saldo)+'</div>'+
      '</div>';
  }).join('');
}
// Guardamos referencia para el buscador manual
let _gestVincFolioTemp=null, _gestVincMontoTemp=null, _gestVincTipoTemp=null;
function _gestConfirmarVinculo(gid, folio, monto, tipo){
  _gestVincFolioTemp=folio; _gestVincMontoTemp=monto; _gestVincTipoTemp=tipo;
  _gestAplicarVinculo(gid, folio, monto, tipo);
}
function _gestConfirmarVinculoBusq(gid){
  // Recuperar folio/monto del modal
  const modal=document.getElementById('modal-gest-vincular');
  if(!modal) return;
  const txt=modal.querySelector('p strong:first-child')?.textContent||'';
  const folio=parseInt(txt.replace(/[^0-9]/g,''))||0;
  const monto=_gestVincMontoTemp||0;
  const tipo=_gestVincTipoTemp||'parcial';
  _gestAplicarVinculo(gid, folio, monto, tipo);
}
function _gestAplicarVinculo(gid, folio, monto, tipo){
  if(!Array.isArray(D.gestiones)) return;
  const g=D.gestiones.find(function(x){ return x.id===gid; });
  if(!g) return;
  if(!g.movimientos) g.movimientos=[];
  if(!g.recibosOficiales) g.recibosOficiales=[];
  const fechaHoy=_gestHoy();
  const horaAhora=_gestHora();
  const folioStr=typeof folioFormato==='function'?folioFormato(folio):folio;
  // Agregar abono en movimientos internos
  g.movimientos.push({
    id:'GMOV-VINC-'+folio,
    fecha:fechaHoy, hora:horaAhora,
    tipo:'ABONO',
    concepto:'Recibo oficial #'+folioStr+' vinculado',
    monto:monto,
    obs:'Pago registrado desde recibo oficial',
    usuario:_gestUser(), folioRecibo:folio
  });
  // Agregar en historial de recibos oficiales
  g.recibosOficiales.push({
    folio:folio, fecha:fechaHoy, hora:horaAhora,
    monto:monto, concepto:'Recibo oficial vinculado',
    tipo:tipo, usuario:_gestUser()
  });
  _gestActualizarEstatus(g);
  if(typeof save==='function') save();
  if(typeof syncEstadoSupabaseDebounced==='function') syncEstadoSupabaseDebounced();
  document.getElementById('modal-gest-vincular')?.remove();
  if(typeof toast==='function') toast('🔗 Recibo #'+folioStr+' vinculado a gestión de '+g.cliente,'ok');
  // Si el detalle está abierto, refrescar
  if(_gestIdActivo===gid && typeof gestMostrarDetalle==='function') gestMostrarDetalle(gid);
}
// ══ FIN VINCULACIÓN ════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════
// REPARACIÓN DE FOLIOS DUPLICADOS
// ══════════════════════════════════════════════════════════════════════
// SINCRONIZACIÓN AUTOMÁTICA DE PENDIENTES DE PLACAS
// Recorre todos los recibos vehiculares sin liquidar y crea el pendiente
// de placas si no existe todavía. Cubre dos casos no atendidos por el
// flujo normal:
//   1. Recibos anteriores a la función auto-pendiente (no tienen ninguno)
//   2. Recibos creados por guardarReciboInterno() — ese flujo nunca creó
//      pendientes porque usa vehiculo:{} en lugar de tipoTramite:'vehicular'
// ══════════════════════════════════════════════════════════════════════
function sincronizarPendientesPlacas() {
  if (!appData || !Array.isArray(appData.recibos)) return;
  if (typeof D === 'undefined' || !Array.isArray(D.pendientes)) return;

  // ── PASO 1: limpiar pendientes de placas cuyo recibo ya está liquidado ──
  // Esto corrige pendientes históricos que quedaron huérfanos antes del fix
  var _lb = JSON.parse(localStorage.getItem('lex-placas-liquidados') || '[]');
  var _eliminados = 0;
  D.pendientes = D.pendientes.filter(function(p) {
    if (p.seccion !== 'placas' || !p.reciboVinculadoFolio) return true;
    // Buscar el recibo vinculado
    var _versSync = appData.recibos.filter(function(r) {
      return Number(r.folio) === Number(p.reciboVinculadoFolio);
    });
    var _saldoMinSync = _versSync.reduce(function(m,r){
      // Evaluar saldoPendiente Y saldoNuevo juntos: la A puede tener saldoPendiente
      // original (5000) y la B tener saldoNuevo=0 — sin retorno anticipado al primero.
      var minR = Infinity;
      var s  = parseFloat(r.saldoPendiente); if(!isNaN(s))  minR = Math.min(minR, s);
      var sn = parseFloat(r.saldoNuevo);     if(!isNaN(sn)) minR = Math.min(minR, sn);
      if(r.liquidado===true) minR = 0;
      return Math.min(m, minR);
    }, Infinity);
    // Si el recibo ya no tiene saldo (en cualquier versión) o fue cancelado → eliminar pendiente
    if (_versSync.length === 0 || _versSync.some(function(r){return r.cancelado;}) || !(_saldoMinSync > 0)) {
      var fStr = String(p.reciboVinculadoFolio);
      if (_lb.indexOf(fStr) < 0) _lb.push(fStr);
      // Antes de perder el pendiente, respaldar sus documentos adjuntos en el
      // propio recibo (todas sus versiones) — si no, "Expediente Digital"
      // se quedaba vacío para siempre en cuanto el folio se liquidaba: los
      // archivos seguían en Drive, pero se perdía la única referencia
      // (driveFileId/nombre) que apuntaba a ellos.
      if (p.documentos && p.documentos.length) {
        _versSync.forEach(function(rv){ rv.expDigitalDocumentosPlacas = p.documentos; });
      }
      _eliminados++;
      return false; // quitar del array
    }
    return true;
  });
  if (_eliminados > 0) {
    localStorage.setItem('lex-placas-liquidados', JSON.stringify(_lb));
    if (typeof save === 'function') save();
    if (typeof renderPend === 'function') renderPend();
    if (typeof badges === 'function') badges();
    console.log('[LEX] sincronizarPendientesPlacas: ' + _eliminados + ' pendiente(s) huérfano(s) eliminado(s).');
  }

  const _tipoLbl = {
    alta: 'Alta de placas', baja: 'Baja de placas',
    cambio_propietario: 'Cambio de propietario',
    tarjeta_circulacion: 'Tarjeta de circulación',
    reemplacamiento: 'Reemplacamiento'
  };
  let creados = 0;
  appData.recibos.forEach(function(r) {
    if (!r || r.cancelado || r.esComplemento) return;
    // Detectar recibo vehicular por tipoTramite (flujo principal) o por objeto vehiculo (sub-panel)
    const esVehicular = r.tipoTramite === 'vehicular' ||
                        (r.vehiculo && typeof r.vehiculo === 'object' && r.vehiculo !== null);
    if (!esVehicular) return;
    // Verificar saldo mínimo entre TODAS las versiones del folio (A, B, C, D)
    // La letra A nunca actualiza su saldo en el flujo _imprimirActualizacionReal,
    // por lo que checar solo r.saldoPendiente recrearía pendientes ya liquidados.
    var _versPaso2 = appData.recibos.filter(function(v){ return Number(v.folio) === Number(r.folio); });
    // Si cualquier versión del folio está cancelada → no crear pendiente de placas
    if (_versPaso2.some(function(v){ return v.cancelado; })) return;
    var _saldoMinPaso2 = _versPaso2.reduce(function(m,v){
      // Mismo criterio que PASO 1: mínimo entre saldoPendiente Y saldoNuevo
      // La letra A conserva su saldo ORIGINAL (inmutabilidad); B/C/D tienen el saldo actualizado.
      var minV = Infinity;
      var s  = parseFloat(v.saldoPendiente); if(!isNaN(s))  minV = Math.min(minV, s);
      var sn = parseFloat(v.saldoNuevo);     if(!isNaN(sn)) minV = Math.min(minV, sn);
      if(v.liquidado===true) minV = 0;
      return Math.min(m, minV);
    }, Infinity);
    if (!(_saldoMinPaso2 > 0)) return;
    const folio = r.folio;
    const idPend = 'PEND-REC-' + folio;
    // Si ya existe un pendiente para este folio: reactivarlo si está resuelto
    // (el recibo aún tiene saldo, no debería considerarse resuelto)
    const _pendExist = D.pendientes.find(function(p) {
      return p.id === idPend || Number(p.reciboVinculadoFolio) === Number(folio);
    });
    if (_pendExist) {
      if (_pendExist.resuelto) {
        _pendExist.resuelto = false;
        _pendExist.fechaResolucion = '';
        creados++;
      }
      return;
    }
    // No recrear si ya fue liquidado/eliminado (lista negra en localStorage)
    const _listaNegraPlacas = JSON.parse(localStorage.getItem('lex-placas-liquidados') || '[]');
    if (_listaNegraPlacas.indexOf(String(folio)) >= 0) return;
    // Detectar tipo de trámite vehicular desde el primer concepto
    const conc0 = ((r.conceptos && r.conceptos[0]) ? (r.conceptos[0].concepto || '') : '').toLowerCase();
    let tipoVeh = 'alta';
    if (conc0.includes('reemplac'))                                     tipoVeh = 'reemplacamiento';
    else if (conc0.includes('baja'))                                    tipoVeh = 'baja';
    else if (conc0.includes('cambio') || conc0.includes('propiet'))     tipoVeh = 'cambio_propietario';
    else if (conc0.includes('tarjeta') || conc0.includes('circulac'))   tipoVeh = 'tarjeta_circulacion';
    const tipoLbl = _tipoLbl[tipoVeh] || 'Trámite vehicular';
    const nombre  = (r.nombre || (r.clientes && r.clientes[0] && r.clientes[0].nombre) || 'Sin nombre').toUpperCase();
    const placa   = r.placa   || (r.vehiculo && r.vehiculo.placa)  || '';
    const origen  = r.origen  || (r.vehiculo && r.vehiculo.estado) || '';
    const marca   = r.marca   || (r.vehiculo && r.vehiculo.marca)  || '';
    const clase   = r.clase   || (r.vehiculo && r.vehiculo.clase)  || '';
    D.pendientes.unshift({
      id: idPend,
      texto: tipoLbl + ' — ' + nombre + (placa ? ' (' + placa + ')' : ''),
      persona: nombre,
      categoria: 'Placas',
      seccion: 'placas',
      prioridad: 'normal',
      resp: r.responsable || r.generadoPor || '',
      obs: '', fechaLimite: '', carpeta: '',
      resuelto: false,
      fechaCreacion: r.fecha || (typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0]),
      fechaResolucion: '',
      placasEstado: origen,
      placasNumero: placa,
      tipoVehicular: tipoVeh,
      descripcionPlacas: tipoLbl,
      reciboVinculadoFolio: folio,
      vehMarca: marca, vehClase: clase,
      marca: marca,   clase: clase,
      documentos: []
    });
    creados++;
    console.log('[LEX] Pendiente de placas creado automáticamente para recibo #' + folio);
  });
  if (creados > 0) {
    if (typeof save === 'function') save();
    if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced();
    if (typeof renderPend === 'function') renderPend();
    if (typeof badges === 'function') badges();
    console.log('[LEX] sincronizarPendientesPlacas: ' + creados + ' pendiente(s) creado(s).');
  }
}
// Se ejecuta una vez al cargar — detecta y corrige folios duplicados
// usando la hora como criterio (el más temprano conserva el folio)
// ══════════════════════════════════════════════════════════════════════
function repararFoliosDuplicados() {
  if(!appData || !Array.isArray(appData.recibos)) return;
  // ── Limpiar recibosExcluidosCaja de entradas inválidas ────────────────────
  // La versión anterior de esta función agregaba folios a recibosExcluidosCaja
  // aunque el recibo original siguiera existiendo. Eso impedía que aparecieran
  // en contabilidad. Aquí se corrigen esas entradas históricas.
  if(typeof D !== 'undefined' && Array.isArray(D.recibosExcluidosCaja) && D.recibosExcluidosCaja.length) {
    const foliosVivos = new Set(
      (appData.recibos||[])
        .filter(function(r){ return r && !r.cancelado && r.folio != null; })
        .map(function(r){ return String(r.folio); })
    );
    const antesExc = D.recibosExcluidosCaja.length;
    D.recibosExcluidosCaja = D.recibosExcluidosCaja.filter(function(f){ return !foliosVivos.has(String(f)); });
    if(D.recibosExcluidosCaja.length < antesExc){
      const recuperados = antesExc - D.recibosExcluidosCaja.length;
      console.log('[LEX] recibosExcluidosCaja: recuperados ' + recuperados + ' folio(s) que tenían recibos válidos');
      if(typeof save === 'function') save();
    }
  }
  // ── Deduplicar movimientos de recibo (solo copias exactas) ────────────────
  // Solo elimina duplicados con el mismo id o con el mismo folio+letra+fecha+monto+estatus.
  // NUNCA borra el único movimiento legítimo de un folio, aunque su recibo asociado
  // sea duplicado — el recibo y el movimiento se crearon UNA sola vez; el duplicado
  // llega por re-sincronización de Supabase Realtime, no por doble escritura.
  if(typeof D !== 'undefined' && Array.isArray(D.movimientos)) {
    const _idsMovVistos  = new Set();
    const _keysMovVistos = new Set();
    _filtrarMovsAuditado(function(m) {
      if(!m) return false;
      if(m.fuente !== 'recibo') return true;
      if(m.id && _idsMovVistos.has(m.id)) return false;
      if(m.id) _idsMovVistos.add(m.id);
      const key = String(m.folio) + '|' + (m.letra||'A') + '|' + (m.fecha||'') + '|' + String(m.monto||0) + '|' + (m.estatus||'');
      if(_keysMovVistos.has(key)) return false;
      _keysMovVistos.add(key);
      return true;
    }, 'repararFoliosDuplicados');
  }
  const recibos = appData.recibos;
  // Agrupar por folio+letra — duplicados son SOLO los registros con AMBOS iguales.
  // ⚠️ CRÍTICO: agrupar solo por folio eliminaba versiones B/C legítimas cuando un
  // registro sin r.letra (datos anteriores) coincidía con otro vía letraVersion().
  // La letra EFECTIVA usa r.letra y, si falta (datos legados), letraVersion(r):
  // así un B legado sin campo letra NO colisiona con el A del mismo folio.
  const _letraEfectiva = function(r){
    return r.letra || (typeof letraVersion === 'function' ? letraVersion(r) : 'A') || 'A';
  };
  const porFolioLetra = {};
  recibos.forEach(function(r, idx) {
    const f = Number(r.folio);
    if(!f || isNaN(f)) return; // ignorar registros sin folio válido
    const l = _letraEfectiva(r);
    const k = f + '|' + l;
    if(!porFolioLetra[k]) porFolioLetra[k] = [];
    porFolioLetra[k].push({ r: r, idx: idx });
  });
  let indicesAEliminar = [];
  Object.keys(porFolioLetra).forEach(function(k) {
    const grupo = porFolioLetra[k];
    if(grupo.length <= 1) return; // versión única de este folio+letra → no es duplicado
    // Ordenar por fecha+hora ascendente — el primero (más temprano) es el original
    grupo.sort(function(a, b) {
      const tsA = (a.r.fecha||'') + 'T' + (a.r.hora||'00:00');
      const tsB = (b.r.fecha||'') + 'T' + (b.r.hora||'00:00');
      return tsA.localeCompare(tsB);
    });
    // Conservar el primero, marcar los demás para eliminar
    for(let i = 1; i < grupo.length; i++) {
      indicesAEliminar.push(grupo[i].idx);
      console.warn('[LEX] Recibo duplicado eliminado: folio #' + grupo[i].r.folio +
        ' · letra ' + (grupo[i].r.letra || 'A') +
        ' · ' + (grupo[i].r.nombre||'') +
        ' · ' + (grupo[i].r.fecha||'') + ' ' + (grupo[i].r.hora||''));
    }
  });
  if(indicesAEliminar.length > 0) {
    // Determinar qué folios quedan sin ninguna versión tras la eliminación
    // (solo esos deben agregarse a recibosExcluidosCaja)
    const idxAEliminarSet = new Set(indicesAEliminar);
    const foliosQueQuedan = new Set(
      recibos.filter(function(_, i){ return !idxAEliminarSet.has(i); })
             .map(function(r){ return Number(r.folio); })
    );
    // Eliminar en orden inverso para no alterar índices
    indicesAEliminar.sort(function(a,b){ return b - a; });
    indicesAEliminar.forEach(function(idx) {
      const r = recibos[idx];
      if(!r) return;
      const letra = _letraEfectiva(r);
      // ── CANDADO ANTI-HUÉRFANOS ──────────────────────────────────────────
      // Nunca eliminar el ÚLTIMO registro 'A' de un folio con sub-folios B/C/D
      // vivos: dejaría huérfanos a los hijos (caso 72B).
      if(letra === 'A') {
        const quedaOtroA = recibos.some(function(_r, i) {
          return i !== idx && _r && Number(_r.folio) === Number(r.folio) &&
                 !_r.esComplemento && _letraEfectiva(_r) === 'A';
        });
        const tieneHijos = recibos.some(function(_r, i) {
          return i !== idx && _r && Number(_r.folio) === Number(r.folio) &&
                 !_r.esComplemento && _letraEfectiva(_r) > 'A';
        });
        if(!quedaOtroA && tieneHijos) {
          console.warn('[LEX] Protegido: no se elimina ' + r.folio + 'A — tiene sub-folios que quedarían huérfanos');
          return;
        }
      }
      // Agregar a recibosExcluidosCaja solo si el folio queda sin ninguna versión;
      // si quedan otras versiones (A o B) el folio debe seguir visible en caja.
      if(typeof D !== 'undefined' && !foliosQueQuedan.has(Number(r.folio))) {
        if(!Array.isArray(D.recibosExcluidosCaja)) D.recibosExcluidosCaja = [];
        var fs = String(r.folio);
        if(!D.recibosExcluidosCaja.map(String).includes(fs)) {
          D.recibosExcluidosCaja.push(fs);
        }
      }
      recibos.splice(idx, 1);
      if (typeof _purgarPagosParcialesDeVersion === 'function') _purgarPagosParcialesDeVersion(r.folio, letra, r);
    });
    // Actualizar REC.recibos también
    if(typeof REC !== 'undefined') REC.recibos = appData.recibos;
    // Asegurar que folioActual sea mayor que todos los existentes
    const maxExistente = appData.recibos.length > 0
      ? Math.max.apply(null, appData.recibos.map(function(r){ return Number(r.folio)||0; }))
      : 0;
    if(!appData.folioActual || appData.folioActual <= maxExistente) {
      appData.folioActual = maxExistente + 1;
      if(typeof REC !== 'undefined') REC.folioActual = appData.folioActual;
    }
    if(typeof save === 'function') save();
    if(typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced();
    if(typeof toast === 'function') toast('🔧 ' + indicesAEliminar.length + ' recibo(s) duplicado(s) eliminado(s)', 'ok');
    console.log('[LEX] Reparación de folios completada: ' + indicesAEliminar.length + ' duplicado(s) eliminado(s).');
  }
  // Después de limpiar duplicados, reparar folios huérfanos (B/C sin A padre)
  repararFoliosHuerfanos();
}
// Detecta registros B/C/D cuyo número de folio no tiene versión A correspondiente.
// Ocurre cuando la versión anterior de repararFoliosDuplicados renumeraba en vez de eliminar:
// 26-001B se guardaba como 26-013B. Esta función lo devuelve a 26-001B buscando el A
// por nombre + fecha (campos que B hereda de A vía Object.assign).
function repararFoliosHuerfanos() {
  if(!appData || !Array.isArray(appData.recibos)) return;
  var recibos = appData.recibos;
  var foliosConA = new Set(
    recibos
      .filter(function(r){ return r && !r.esComplemento && (r.letra||'A')==='A'; })
      .map(function(r){ return Number(r.folio); })
  );
  var huerfanos = recibos.filter(function(r){
    if(!r || r.esComplemento || r.cancelado) return false;
    if((r.letra||'A')==='A') return false;
    if(r._sinPadreVerificado) return false; // ya verificado: no tiene A, no reintentar
    return !foliosConA.has(Number(r.folio));
  });
  if(!huerfanos.length) return;
  var aRecords = recibos.filter(function(r){
    return r && !r.esComplemento && !r.cancelado && (r.letra||'A')==='A';
  });
  var reparados = 0;
  var marcadosSinPadre = 0;
  huerfanos.forEach(function(orphan){
    var folioViejo   = Number(orphan.folio);
    var letraOrphan  = orphan.letra || 'A';
    var nombreOrphan = (orphan.nombre||'').trim();
    var fechaOrphan  = (orphan.fecha || orphan.fecha_recibo || '').substring(0,10);
    // B hereda nombre y fecha de A — buscar A con coincidencia exacta
    var candidatos = aRecords.filter(function(a){
      return (a.nombre||'').trim() === nombreOrphan &&
             (a.fecha || a.fecha_recibo || '').substring(0,10) === fechaOrphan;
    });
    if(candidatos.length !== 1){
      if(candidatos.length === 0){
        // Huérfano real: su A no existe en absoluto. El registro B está completo
        // (hereda los datos del A), así que se conserva tal cual y se marca para
        // no reintentar la reparación ni repetir el warning en cada carga.
        orphan._sinPadreVerificado = true;
        marcadosSinPadre++;
        console.warn('[RepararHuerfanos] ' + folioViejo + letraOrphan +
          ' (' + nombreOrphan + ', ' + fechaOrphan + '): sin padre A — marcado como verificado, no se reintentará');
      } else {
        console.warn('[RepararHuerfanos] Sin coincidencia única para ' + folioViejo + letraOrphan +
          ' (' + nombreOrphan + ', ' + fechaOrphan + '): ' + candidatos.length + ' candidatos');
      }
      return;
    }
    var padreA     = candidatos[0];
    var folioNuevo = Number(padreA.folio);
    if(folioNuevo === folioViejo) return;
    // No reparar si el destino ya tiene esa letra (evita colisiones)
    var yaExiste = recibos.some(function(r){
      return !r.esComplemento && Number(r.folio)===folioNuevo && (r.letra||'A')===letraOrphan;
    });
    if(yaExiste){
      console.warn('[RepararHuerfanos] Ya existe ' + folioNuevo + letraOrphan + ', se omite ' + folioViejo + letraOrphan);
      return;
    }
    // Aplicar corrección
    orphan.folio = folioNuevo;
    if(!orphan.anio_folio && padreA.anio_folio) orphan.anio_folio = padreA.anio_folio;
    // Actualizar nombres de archivo PDF (corto para Supabase, descriptivo para R2)
    if(typeof folioConLetra === 'function'){
      var vStr = folioConLetra(folioViejo, null, letraOrphan);
      var nStr = folioConLetra(folioNuevo, orphan.anio_folio || null, letraOrphan);
      if(orphan.archivo)   orphan.archivo   = orphan.archivo.replace(vStr, nStr);
      if(orphan.archivoR2) orphan.archivoR2 = orphan.archivoR2.replace(vStr, nStr);
    }
    // Actualizar movimientos de caja
    if(typeof D !== 'undefined' && Array.isArray(D.movimientos)){
      D.movimientos.forEach(function(m){
        if(!m || m.fuente !== 'recibo') return;
        if(Number(m.folio) === folioViejo && (m.letra||'A') === letraOrphan){
          var vStr = typeof folioConLetra === 'function' ? folioConLetra(folioViejo, null, letraOrphan) : String(folioViejo)+letraOrphan;
          var nStr = typeof folioConLetra === 'function' ? folioConLetra(folioNuevo, orphan.anio_folio||null, letraOrphan) : String(folioNuevo)+letraOrphan;
          m.folio = folioNuevo;
          if(m.cat)        m.cat        = m.cat.replace(vStr, nStr);
          if(m.descripcion) m.descripcion = m.descripcion.replace(vStr, nStr);
        }
      });
    }
    // Sincronizar REC.recibos
    if(typeof REC !== 'undefined' && Array.isArray(REC.recibos)){
      REC.recibos.forEach(function(r){
        if(r && Number(r.folio) === folioViejo && (r.letra||'A') === letraOrphan) r.folio = folioNuevo;
      });
    }
    reparados++;
    console.log('[RepararHuerfanos] ' + folioConLetra(folioViejo, null, letraOrphan) +
      ' → ' + folioConLetra(folioNuevo, orphan.anio_folio||null, letraOrphan) +
      ' (' + nombreOrphan + ')');
  });
  if(reparados > 0 || marcadosSinPadre > 0){
    if(typeof save === 'function') save();
    if(typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced();
  }
  if(reparados > 0){
    if(typeof renderContab === 'function') renderContab();
    if(typeof toast === 'function') toast('🔧 ' + reparados + ' folio(s) reasignados al padre correcto', 'ok');
  }
}
// ── Recuperar movimientos de recibo borrados por versiones anteriores del sistema ──
// Crea un movimiento por cada recibo que tenga anticipo > 0 y no tenga movimiento en D.movimientos.
// Se llama manualmente desde consola o desde un botón de administración.
// Reconstruye los movimientos de recibo faltantes usando el modelo de brecha de
// monto (honorarios + complementarios exactos + cancelación). Uso:
//   recuperarMovimientosFaltantes()            → todos los folios, aplica
//   recuperarMovimientosFaltantes(3)           → solo folio 3, aplica
//   recuperarMovimientosFaltantes(3, true)     → solo folio 3, SIMULACIÓN (no escribe)
//   recuperarMovimientosFaltantes(null, true)  → todos, SIMULACIÓN (no escribe)
function recuperarMovimientosFaltantes(soloFolio, simular) {
  if(!appData || !Array.isArray(appData.recibos)) { console.warn('[Recuperar] appData.recibos no disponible'); return; }
  if(typeof D === 'undefined' || !Array.isArray(D.movimientos)) { console.warn('[Recuperar] D.movimientos no disponible'); return; }

  const plan = _calcularRecibosFaltantes({ soloFolio: soloFolio });

  // ── MODO SIMULACIÓN: reporta en consola sin escribir nada ──
  if(simular){
    console.log('%c[SIMULACIÓN] recuperarMovimientosFaltantes' + (soloFolio!=null ? ' — folio ' + soloFolio : ' — todos'),
                'font-weight:bold;color:#c8952a');
    if(!plan.length){
      console.log('  → Nada que recuperar (los libros ya están completos).');
    } else {
      plan.forEach(function(m){
        console.log('  → Crearía: folio ' + m.folio + (m.letra||'') + ' · ' + m.estatus +
                    ' · ' + m.tipo + ' · $' + m.monto + ' · ' + m.fecha + ' ' + m.hora);
      });
      console.log('Para aplicar de verdad: recuperarMovimientosFaltantes(' + (soloFolio!=null ? soloFolio : '') + ')');
    }
    return plan;
  }

  // ── MODO REAL: inserta la brecha y persiste ──
  if(!plan.length){
    if(typeof toast === 'function') toast('ℹ️ No hay movimientos faltantes', 'info');
    console.log('[LEX] No se encontraron movimientos faltantes');
    return [];
  }
  const recuperados = [];
  plan.forEach(function(m){
    D.movimientos.push(m);
    _auditoriaRegistrar('creado', m, {origen:'recuperarMovimientosFaltantes (auto)'});
    recuperados.push(m.folio + (m.letra||'') + ' ' + m.estatus + ' $' + m.monto);
  });
  if(typeof save === 'function') save();
  if(typeof renderContab === 'function') renderContab();
  console.log('[LEX] Movimientos recuperados:', recuperados.join(', '));
  if(typeof toast === 'function') toast('✅ ' + recuperados.length + ' movimiento(s) recuperado(s): ' + recuperados.join(', '), 'ok');
  return recuperados;
}
// ══ FIN MÓDULO RECIBOS EN GESTIÓN ══════════════════════════════════════
function secretariaCerrarMes(){
  window._capturaMesActivo = null;
  window._capturaFechaManual = null;
  window._capturaHoraManual  = null;
  window._capturaMesActivadoTs = null;
  window._capturaRetroAvisado  = false;
  const banner = document.getElementById('captura-mes-banner');
  if(banner) banner.style.display = 'none';
  if(typeof setStatus==='function') setStatus('ok','Captura del mes finalizada','ok');
}
// Agregar a adminVolverPanel
const _origAdminVolverPanel = window.adminVolverPanel;
window.adminVolverPanel = function(){
  const zona = document.getElementById('adminCapturaMesZone');
  if(zona) zona.classList.remove('show');
  // FIX (bug 08-ago-2026): salir del panel de admin también apaga la captura
  // retroactiva. Antes solo la apagaba el botón "✕ Salir" del banner, así que
  // volver al panel dejaba el modo prendido y TODO lo que se registrara después
  // quedaba con fecha pasada sin que nadie lo notara.
  if(typeof _capturaRetroApagar === 'function') _capturaRetroApagar('se salió del panel de captura de mes');
  if(typeof _origAdminVolverPanel==='function') _origAdminVolverPanel();
};
// Inicializar al cargar — esperar más para que SB_DESPACHO_ID esté listo
setTimeout(()=>{
  capturaMesCargarSupabase();
  renderBarraSecretariaCaptura();
}, 4000);
// Segundo intento a los 8s por si el primero fue antes de que SB_DESPACHO_ID estuviera listo
setTimeout(()=>{
  if(window.SB && window.SB_DESPACHO_ID){
    capturaMesCargarSupabase();
  }
}, 8000);
// ═══ FIN TABLERO CAPTURA RETROACTIVA ═══════════════════════════════════
// ═══ BORRADO TOTAL ═══════════════════════════════════════════════════════
async function adminBorradoTotal(){
  if(!confirm('☢️ BORRADO TOTAL\n\nEsto eliminará PERMANENTEMENTE:\n• Todos los recibos\n• Toda la contabilidad y movimientos\n• Todos los cierres de caja\n• Todas las carpetas\n\nEl directorio de clientes se conserva.\n\n⚠️ Esta acción NO se puede deshacer.\n\n¿Estás seguro?')) return;
  const confirmText = prompt('Para confirmar escribe exactamente:\n\nBORRAR TODO');
  if(confirmText !== 'BORRAR TODO'){
    if(typeof toast==='function') toast('Borrado cancelado — texto incorrecto','err');
    return;
  }
  if(typeof toast==='function') toast('⏳ Ejecutando borrado total...','loading');
  if(typeof setStatus==='function') setStatus('loading','Borrando todos los datos...','loading');
  try{
    // Conservar directorio
    const directorioActual = (typeof D!=='undefined' && D.directorio) ? [...D.directorio] : [];
    // Resetear D en memoria
    if(typeof D!=='undefined'){
      D.movimientos=[]; D.carpetas=[]; D.juicios=[];
      D.pendientes=[]; D.cierres=[]; D.prestamos=[];
      D.saldoAcumulado=0; D.directorio=directorioActual;
    }
    // Resetear recibos
    appData.recibos=[]; appData.folioActual=1; appData.historialPagos={};
    if(typeof REC!=='undefined'){ REC.recibos=[]; REC.folioActual=1; }
    // Guardar en Supabase
    if(window.SB && window.SB_DESPACHO_ID){
      const { error } = await window.SB.from('app_state')
        .update({
          data:{ movimientos:[], directorio:directorioActual, carpetas:[], juicios:[],
                 pendientes:[], cierres:[], prestamos:[], saldoAcumulado:0, leyes:[] },
          recibos:{ folioActual:1, recibos:[] },
          folio_actual:1,
          sesiones_log:[]
        })
        .eq('despacho_id', window.SB_DESPACHO_ID);
      if(error) throw new Error(error.message);
    }
    try{ localStorage.removeItem('lex_sesiones_log'); }catch(e){ registrarError('catch vacio', e); }
    // Actualizar UI
    if(typeof renderHistorial==='function') renderHistorial();
    if(typeof renderCaja==='function') renderCaja();
    if(typeof renderCarp==='function') renderCarp();
    if(typeof renderDir==='function') renderDir();
    if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
    if(typeof badges==='function') badges();
    cerrarAdminModal();
    if(typeof setStatus==='function') setStatus('ok','Borrado total completado — Sistema listo desde folio 1-26','ok');
    if(typeof toast==='function') toast('✅ Sistema limpio — Folio inicial: 1-26');
    alert('✅ Borrado total completado.\n\nSistema listo para capturar desde el folio 1-26.\nEl directorio de clientes se conservó.');
  }catch(e){
    console.error('[BorradoTotal]',e);
    if(typeof setStatus==='function') setStatus('err','Error en borrado: '+(e.message||e),'err');
    if(typeof toast==='function') toast('❌ Error: '+(e.message||e),'err');
  }
}
// ═══ FIN BORRADO TOTAL ═══
// ─── CONTROL CENTRALIZADO DE VISIBILIDAD DEL FORMULARIO ──────────────────────
// El formulario (recibo-body) debe estar OCULTO siempre que:
//   a) el panel de búsqueda esté abierto, O
//   b) el sistema esté en modo-consulta
// Se llama desde togglePanelesBusqueda, salirModoConsulta, cargarHistorialFolio
// y cualquier otro punto que cambie estos estados.
function syncFormVisibility(){
  const rb = document.getElementById('recibo-body');
  if(!rb) return;
  const enConsulta     = document.body.classList.contains('modo-consulta');
  const panelAbierto   = _panelesBusquedaAbiertos === true;
  const enActualizacion = document.body.classList.contains('modo-actualizacion');
  if(enActualizacion){
    // En modo actualización el formulario siempre debe estar visible
    rb.style.setProperty('display','block','important');
  } else if(enConsulta || panelAbierto){
    rb.style.setProperty('display','none','important');
  } else {
    rb.style.removeProperty('display');
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// ═══ FIN MEJORAS DE RESILIENCIA ═══
// ════════════════════════════════════════════════════════════════
//  OCR GEMINI — INTEGRADO EN CONTROL DE JUICIOS
//  Motor: gemini-2.5-flash (gratis: 1500 análisis/día)
//  Flujo: archivo → base64 → Gemini API → texto → hj-texto
// ════════════════════════════════════════════════════════════════
// Obtener API key de Gemini (guardada en localStorage)
// Cargar key guardada en el campo de config al abrir el panel
// ── Guardar/cargar todos los campos de config OCR ──────────────────────
function ocrSaveDriveToken(v){ try{ localStorage.setItem('lex-ocr-drive-token', (v||'').trim()); } catch(e){ registrarError('localStorage.setItem', e); }
}
function ocrGetDriveToken(){ return localStorage.getItem('lex-ocr-drive-token')||''; }
function ocrSaveFolder(v){ try{ localStorage.setItem('lex-ocr-folder', (v||'').trim()); } catch(e){ registrarError('localStorage.setItem', e); }
}
function ocrGetFolder(){ return localStorage.getItem('lex-ocr-folder')||''; }
function ocrSaveProf(v){ try{ localStorage.setItem('lex-ocr-prof', v||'detallado'); } catch(e){ registrarError('localStorage.setItem', e); }
}
function ocrGetProf(){ return localStorage.getItem('lex-ocr-prof')||'detallado'; }
function ocrSaveExtra(v){ try{ localStorage.setItem('lex-ocr-extra', v||''); } catch(e){ registrarError('localStorage.setItem', e); }
}
function ocrGetExtra(){ return localStorage.getItem('lex-ocr-extra')||''; }
function ocrGuardarTodo(){
  // Redirige al modal inline (Panel de Control fue removido)
  ocrGuardarConfigInline();
}
function ocrLimpiarTodo(){
  if(!confirm('¿Limpiar toda la configuración de OCR?')) return;
  _secretSessionRemove('lex-gemini-key');
  window._geminiKeyCached = '';
  ['lex-ocr-drive-token','lex-ocr-folder','lex-ocr-prof','lex-ocr-extra']
    .forEach(k=>localStorage.removeItem(k));
  // Limpiar también campos del modal inline
  ['ocr-cfg-key-inline','ocr-cfg-drive-inline','ocr-cfg-extra-inline']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const prof = document.getElementById('ocr-cfg-prof-inline');
  if(prof) prof.value = 'detallado';
  toast('🗑️ Configuración OCR eliminada','ok');
}
function ocrCargarKeyEnCfg(){
  const setVal = (id, val) => { const el=document.getElementById(id); if(el && val) el.value=val; };
  setVal('ocr-cfg-key-inline',   ocrGetKey());
  // Cargar key de Groq en el campo de configuración
  const groqInp = document.getElementById('cfg-groq-key');
  if(groqInp) groqInp.value = _groqGetKey();
  const mistralInp = document.getElementById('cfg-mistral-key');
  if(mistralInp) mistralInp.value = _mistralGetKey();
  const geminiInp = document.getElementById('cfg-gemini-key');
  if(geminiInp) geminiInp.value = (typeof ocrModGetKey==='function' ? ocrModGetKey() : '') || window._geminiKeyCached || _secretSessionGet('lex-gemini-key') || '';
  const cfaiAccInp = document.getElementById('cfg-cfai-account');
  if(cfaiAccInp) cfaiAccInp.value = _cfaiGetAccountId();
  const cfaiTokInp = document.getElementById('cfg-cfai-token');
  if(cfaiTokInp) cfaiTokInp.value = _cfaiGetToken();
  setVal('ocr-cfg-drive-inline', ocrGetDriveToken());
  setVal('ocr-cfg-extra-inline', ocrGetExtra());
  const prof = document.getElementById('ocr-cfg-prof-inline');
  if(prof) prof.value = ocrGetProf();
}
async function ocrTestDrive(){
  const token = (document.getElementById('cfg-ocr-drive-token')?.value||document.getElementById('ocr-cfg-drive-inline')?.value||'').trim()
    || ocrGetDriveToken()
    || localStorage.getItem('drive_token') || '';
  const st = document.getElementById('cfg-ocr-drive-test-st');
  if(!token){ if(st){st.textContent='⚠ No hay token de Drive';st.style.color='var(--rojo)';} return; }
  if(st){st.textContent='🔄 Probando...';st.style.color='var(--muted)';}
  try{
    const resp = await fetch('https://www.googleapis.com/drive/v3/about?fields=user',{
      headers:{Authorization:'Bearer '+token}
    });
    if(resp.ok){
      const d = await resp.json();
      if(st){st.textContent='✓ Conectado: '+(d.user?.emailAddress||'OK');st.style.color='var(--verde)';}
    } else {
      if(st){st.textContent=resp.status===401?'❌ Token expirado':'❌ Error '+resp.status;st.style.color='var(--rojo)';}
    }
  }catch(e){
    if(st){st.textContent='❌ '+e.message;st.style.color='var(--rojo)';}
  }
}
// Llamar cuando se va al panel de configuración
const _origIr_ocr = typeof ir === 'function' ? ir : null;
// ── Funciones UI de configuración de Groq ─────────────────────────────
async function groqTestKey(){
  const inp = document.getElementById('cfg-groq-key');
  const st  = document.getElementById('cfg-groq-st');
  const key = (inp?.value || '').trim() || _groqGetKey();
  if(!key){ if(st) { st.textContent = '⚠ Ingresa una API Key de Groq'; st.style.color = 'var(--rojo)'; } return; }
  if(st){ st.textContent = '🔄 Probando conexión con Groq...'; st.style.color = 'var(--muted)'; }
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model:'openai/gpt-oss-120b', messages:[{role:'user',content:'Responde: OK'}], max_tokens:5 })
    });
    if(resp.ok){
      if(st){ st.textContent = '✅ Groq conectado correctamente — key válida'; st.style.color = 'var(--verde)'; }
      if(typeof toast==='function') toast('✅ Groq listo','ok');
    } else {
      const e = await resp.json().catch(()=>({}));
      if(st){ st.textContent = '❌ ' + (e?.error?.message || 'Error '+resp.status); st.style.color = 'var(--rojo)'; }
    }
  } catch(e) {
    if(st){ st.textContent = '❌ ' + e.message; st.style.color = 'var(--rojo)'; }
  }
}
function groqGuardarKey(){
  const inp = document.getElementById('cfg-groq-key');
  const st  = document.getElementById('cfg-groq-st');
  const key = (inp?.value || '').trim();
  if(!key || key.length < 10){ if(st){ st.textContent = '⚠ Ingresa una key válida'; st.style.color = 'var(--rojo)'; } return; }
  _groqSaveKey(key);
  if(st){ st.textContent = '✅ Activa durante esta sesión'; st.style.color = 'var(--verde)'; }
  if(typeof toast==='function') toast('🚀 Groq configurado como IA principal','ok');
}
// ── Rotación automática de API Keys de Gemini ──────────────────────
let _geminiKeyIdx = 0;
// Key cargada por _cargarYCachearKey() definida en ocrModGetKey
function ocrGetKey(){
  return _secretSessionGet('lex-gemini-key');
}
function ocrRotarKey(){
  console.log('[Gemini] Límite alcanzado — reintentando');
  return _secretSessionGet('lex-gemini-key');
}
function ocrSaveKey(k){
  const keyTrim = (k||'').trim();
  if(!keyTrim) return;
  _secretSessionSet('lex-gemini-key', keyTrim);
  window._geminiKeyCached = keyTrim;
  if(typeof toast==='function') toast('🔑 Gemini activo durante esta sesión','ok');
}
// Convertir archivo a base64
function ocrToB64(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onloadend=()=>res(r.result.split(',')[1]);
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}
// Obtener mime type válido para Gemini
function ocrMime(file){
  const t=file.type||'';
  if(t==='application/pdf') return 'application/pdf';
  if(t==='image/jpeg'||t==='image/png'||t==='image/webp'||t==='image/heic') return t;
  if(t.startsWith('image/')) return 'image/jpeg';
  const ext=(file.name||'').split('.').pop().toLowerCase();
  const m={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc:'application/msword',
    xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls:'application/vnd.ms-excel'};
  return m[ext]||'image/jpeg';
}
// Leer el archivo seleccionado y analizarlo con IA
async function ocrLeerArchivo(input){
  const file = input.files && input.files[0];
  if(!file) return;
  document.getElementById('ocr-cfg-banner').classList.remove('show');
  // Mostrar progreso
  const prog = document.getElementById('ocr-progress');
  const progTxt = document.getElementById('ocr-progress-txt');
  prog.classList.add('show');
  progTxt.textContent = 'Leyendo archivo...';
  // Obtener contexto del juicio activo para un prompt más preciso
  const j = D.juicios && D.juicios[jdetIdx];
  const ctxJuicio = j ? `Juicio: ${j.tipo||''} — Expediente: ${j.expediente||j.num||''} — Cliente: ${j.nombre||j.cliente||''}` : '';
  try {
    progTxt.textContent = 'Convirtiendo a base64...';
    const b64  = await ocrToB64(file);
    const mime = ocrMime(file);
    // ── INTENTO 1: Extracción local con PDF.js / Tesseract ──
    const extraccionL = await _ocrExtraerTexto(file, (msg) => { progTxt.textContent = msg; });
    const extra = ocrGetExtra();
    if (extraccionL && extraccionL.texto.length > 100) {
      // ✅ Texto extraído localmente → Opción C (directo o por secciones según tamaño)
      const rawL = await _ocrAnalizarTexto(extraccionL.texto, ctxJuicio, extra, (msg) => { progTxt.textContent = msg; });
      const el = document.getElementById('ocr-progress');
      if(el) el.classList.remove('show');
      if(typeof hjUsarResumenOCR === 'function') hjUsarResumenOCR(rawL);
      else {
        const ta = document.getElementById('hj-texto');
        if(ta){ ta.value = rawL; if(typeof toast==='function') toast('✅ Análisis completado (sin API de visión)','ok'); }
      }
      return;
    }
    // ── INTENTO 2 (respaldo): Cloudflare Workers AI Vision ──
    progTxt.textContent = 'Cloudflare Workers AI: preparando OCR y análisis legal...';
    // Instrucciones adicionales opcionales del despacho
    const prompt = `ACTÚA COMO UN ANALISTA JURÍDICO ESPECIALIZADO EN ACUERDOS JUDICIALES EN MÉXICO.
${ctxJuicio ? '\nCONTEXTO DEL EXPEDIENTE: '+ctxJuicio : ''}
Analiza el documento adjunto (puede ser un PDF escaneado, fotografía o imagen de un acuerdo judicial).
Aplica OCR completo para leer TODO el contenido sin omitir nada.
INSTRUCCIONES:
- Analiza TODO el documento sin omitir nada.
- Explica qué ocurrió en el acuerdo y qué ordenó el juez.
- Menciona TODAS las fechas, plazos, montos y obligaciones.
- Extrae datos de familia (hijos, pensión, compensación) si aplica.
- Usa lenguaje jurídico simple y entendible.
- No inventes información. Si un dato no consta, escribe "No consta en el documento".
Redacta el resumen en español con el siguiente formato EXACTO:
📌 TÍTULO DEL ACUERDO: [tipo de resolución — acuerdo, auto, sentencia, notificación, requerimiento, etc.]
📋 EXPEDIENTE: [número — si no consta: "No consta en el documento"]
🏛️ JUZGADO / TRIBUNAL: [nombre completo — si no consta: "No consta en el documento"]
⚖️ TIPO DE JUICIO: [tipo — si no consta: "No consta en el documento"]
📅 FECHA DE RESOLUCIÓN: [fecha — si no consta: "No consta en el documento"]
📅 FECHA EJECUTORIA: [fecha en que causó ejecutoria — si no consta: "No consta en el documento"]
👤 ACTOR: [nombre completo — si no consta: "No consta en el documento"]
👤 DEMANDADO: [nombre completo — si no consta: "No consta en el documento"]
👨‍👩‍👧 HIJOS / MENORES: [nombres y edades — si no aplica: "No aplica"]
💰 PENSIÓN ALIMENTICIA: [monto mensual — si no aplica: "No aplica"]
💵 COMPENSACIÓN O PAGO ÚNICO: [monto — si no aplica: "No aplica"]
📅 FECHA LÍMITE DE PAGOS: [fecha — si no aplica: "No aplica"]
👨 JUZGADOR/A: [nombre y cargo — si no consta: "No consta en el documento"]
RESUMEN EJECUTIVO:
[3 a 5 párrafos completos explicando qué ocurrió, qué se resolvió y qué ordenó el juez]
PUNTOS IMPORTANTES:
• [punto 1 — lo más relevante]
• [punto 2]
• [incluye TODOS los puntos necesarios, sin omitir nada]
⏰ PLAZOS Y FECHAS CLAVE:
[lista detallada de todos los plazos y fechas con su descripción, o "No constan plazos en el documento"]
⚠️ OBSERVACIONES PARA EL ABOGADO:
[acciones concretas que el abogado debe atender urgentemente]
${extra ? '\nINSTRUCCIONES ADICIONALES DEL DESPACHO:\n'+extra : ''}
Tono estrictamente profesional. NO truncar ni resumir en exceso. Incluye absolutamente toda la información relevante.`;
    if(!_cfaiGetAccountId() || !_cfaiGetToken()){
      throw new Error('No se pudo leer el texto localmente y no hay Cloudflare Workers AI configurado (⚙️ Configuración) para el último recurso.');
    }
    progTxt.textContent = 'Cloudflare Workers AI: realizando OCR y análisis legal...';
    // El modelo de visión necesita una IMAGEN — si el archivo es PDF, se
    // convierte su primera página a PNG; si ya es imagen, se usa tal cual.
    const imgB64 = mime === 'application/pdf' ? await _pdfPrimeraPaginaB64(file) : b64;
    const texto = await _cfaiVision(imgB64, prompt, 2048, 'analisis_documento');
    if(!texto) throw new Error('La IA no devolvió texto. El documento puede ser ilegible.');
    progTxt.textContent = '¡Listo! Resumen generado.';
    setTimeout(()=>prog.classList.remove('show'), 2000);
    // Insertar el resumen en el textarea del historial
    const ta = document.getElementById('hj-texto');
    if(ta){
      ta.value = texto.trim();
      ta.style.borderColor='var(--gold)';
      setTimeout(()=>{ ta.style.borderColor='var(--border-l)'; }, 2500);
      ta.dispatchEvent(new Event('input'));
    }
    // Auto-detectar tipo y fecha si el formulario está abierto
    _ocrAutoDetectarTipo(texto);
    toast('📎 OCR completado — revisa el texto generado', 'ok');
    // ── Modal fecha de notificación ──────────────────────────────────
    _ocrMostrarModalNotificacion(texto);
    // ── Acciones sugeridas: esperar 5s para no saturar el límite ────
  } catch(err){
    prog.classList.remove('show');
    toast(err.message, 'err');
    registrarError('OCR · ocrLeerArchivo', err);
  }
  // Limpiar el input para permitir cargar otro archivo
  input.value='';
}
// Intenta detectar automáticamente el tipo de entrada según el texto OCR
function _ocrAutoDetectarTipo(texto){
  const t = texto.toLowerCase();
  const tipoSel = document.getElementById('hj-tipo');
  if(!tipoSel) return;
  if(t.includes('acuerdo')) tipoSel.value='acuerdo';
  else if(t.includes('requerimiento')) tipoSel.value='requerimiento';
  else if(t.includes('audiencia')) tipoSel.value='audiencia';
  else if(t.includes('notificaci')) tipoSel.value='notificacion';
  else if(t.includes('sentencia')||t.includes('resolutivo')) tipoSel.value='acuerdo';
  else if(t.includes('apelaci')||t.includes('recurso')) tipoSel.value='apelacion';
  // Intentar auto-detectar la fecha
  const fechaMatch = texto.match(/\b(\d{1,2})[\s\/\-](?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[\s\/\-,\s]*(20\d{2})/i);
  if(fechaMatch){
    const meses={enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
    const dia=fechaMatch[1].padStart(2,'0');
    const mes=meses[fechaMatch[2].toLowerCase()]||'01';
    const anio=fechaMatch[3];
    const fechaInp=document.getElementById('hj-fecha');
    if(fechaInp && !fechaInp.value) fechaInp.value=`${anio}-${mes}-${dia}`;
  }
}
// ═══ MÓDULO EXPEDIENTES (CARP.- N) ════════════════════════════════════════
// Gestiona la creación y vinculación de expedientes con recibos originales.
// El número es automático (CARP.- 1, CARP.- 2...) y se guarda en el recibo.
let _expedienteFolioActual = null; // folio del recibo al que se vinculará
function abrirModalExpediente(folio, expSugerido, nombreCliente){
  _expedienteFolioActual = folio;
  const overlay = document.getElementById('modal-crear-expediente');
  if(!overlay) return;
  document.getElementById('exp-modal-folio').textContent  = 'Folio #' + folioFormato(folio);
  document.getElementById('exp-modal-cliente').textContent = nombreCliente || '—';
  document.getElementById('exp-modal-input').value = expSugerido || '';
  overlay.style.display = 'flex';
  setTimeout(()=>{ const inp = document.getElementById('exp-modal-input'); if(inp) inp.focus(); }, 200);
}
function cerrarModalCrearExp(){
  const overlay = document.getElementById('modal-crear-expediente');
  if(overlay) overlay.style.display = 'none';
  _expedienteFolioActual = null;
}
async function confirmarCrearExpediente(){
  const numRaw = (document.getElementById('exp-modal-input').value || '').trim().toUpperCase();
  if(!numRaw){ if(typeof toast==='function') toast('Escribe un número de expediente','err'); return; }
  // Forzar formato CARP.- N
  let numFinal = numRaw;
  if(!numFinal.startsWith('CARP.-')){
    const soloNum = parseInt(numFinal.replace(/\D/g,'')) || 1;
    numFinal = 'CARP.- ' + soloNum;
  }
  // Verificar que no esté duplicado
  const duplicado = (appData.recibos||[]).find(r => r.expedienteNum && r.expedienteNum.toUpperCase() === numFinal);
  if(duplicado && duplicado.folio !== _expedienteFolioActual){
    if(typeof toast==='function') toast('⚠ El expediente '+numFinal+' ya existe en el Folio #'+folioFormato(duplicado.folio),'err');
    return;
  }
  // Vincular en appData
  const idx = (appData.recibos||[]).findIndex(r => r.folio === _expedienteFolioActual && !r.esComplemento);
  if(idx < 0){
    if(typeof toast==='function') toast('No se encontró el recibo para vincular','err');
    cerrarModalCrearExp();
    return;
  }
  appData.recibos[idx].expedienteNum = numFinal;
  const reciboVinculado = appData.recibos[idx];
  // Guardar en Drive/Supabase
  try{
    if(typeof actualizarArchivoControl === 'function') await actualizarArchivoControl();
    if(typeof toast==='function') toast('📁 Expediente '+numFinal+' vinculado al Folio #'+folioFormato(_expedienteFolioActual));
  } catch(e){
    console.error('[Expediente] Error al guardar:', e);
    if(typeof toast==='function') toast('Expediente vinculado (sin confirmar en Drive)','warn');
  }
  const folioVinculado = _expedienteFolioActual;
  cerrarModalCrearExp();
  // ── Preguntar si desea abrir Juicios para completar el expediente ──
  if(typeof abrirJuicioEdit === 'function'){
    // Pre-llenar datos disponibles del recibo
    const nombreCliente = reciboVinculado.nombre || '';
    const fechaHoy = reciboVinculado.fecha || (typeof fechaCDMX_ISO === 'function' ? fechaCDMX_ISO() : new Date().toISOString().split('T')[0]);
    // Navegar a la sección de juicios y abrir el modal con datos pre-llenados
    if(typeof ir === 'function') ir('juicios');
    setTimeout(()=>{
      // Abrir modal nuevo expediente con datos pre-llenados
      abrirJuicioEdit(-1);
      // Pre-llenar campos disponibles
      if($('jCli'))  $('jCli').value  = nombreCliente;
      if($('jExp'))  $('jExp').value  = numFinal;       // Número de expediente CARP.- N
      if($('jFIng')) $('jFIng').value = fechaHoy;
      if($('jCtrlInt')) $('jCtrlInt').value = 'Folio Recibo: ' + folioFormato(folioVinculado);
      // Resaltar campo expediente para que sea obvio
      if($('jExp')){
        $('jExp').style.borderColor = '#7a2a8a';
        $('jExp').style.background  = '#fdf8ff';
        setTimeout(()=>{
          if($('jExp')){ $('jExp').style.borderColor=''; $('jExp').style.background=''; }
        }, 3000);
      }
      if(typeof toast==='function') toast('✏️ Completa los datos del expediente '+numFinal);
    }, 350);
  }
  // Actualizar UI
  if(typeof renderHistorial==='function') renderHistorial();
}
// Cerrar modal de creación al hacer clic fuera
document.addEventListener('click', function(e){
  const overlay = document.getElementById('modal-crear-expediente');
  if(overlay && e.target === overlay) cerrarModalCrearExp();
});
// Abrir modal de expediente desde la consulta de un folio ya existente
function abrirModalExpedienteDesdeConsulta(folio){
  const expNums = (appData.recibos||[])
    .map(r => r.expedienteNum)
    .filter(Boolean)
    .map(n => parseInt((n||'').replace('CARP.-','').replace('ARCH-','')) || 0);
  const siguienteExp = (expNums.length > 0 ? Math.max(...expNums) : 0) + 1;
  const expSugerido = 'CARP.- ' + siguienteExp;
  const recibo = (appData.recibos||[]).find(r => r.folio === folio);
  const nombre = recibo ? (recibo.nombre || '—') : '—';
  abrirModalExpediente(folio, expSugerido, nombre);
}
// ═══ FIN MÓDULO EXPEDIENTES ══════════════════════════════════════════════

// ═══ MÓDULO PANEL DE ESTADOS (PLACAS) ════════════════════════════════════
// Botones Oaxaca / Edo.Méx. / CDMX / Michoacán junto a + Nuevo en Placas.
// Cada estado tiene pestañas de supuesto; cada supuesto tiene 3 bloques:
//   1) Instrucciones / Aviso (solo admin, editable)
//   2) Ejemplo PDF (visor)
//   3) Descarga de recursos

const _MPE_CONFIG = {
  oax:  { label:'Oaxaca',    supuestos:['Nacional','Legalizado'], subTabs:['Alta','Cambio de propietario','Renovación de tarjeta','Baja'] },
  mex:  { label:'Edo. Méx.', supuestos:['Nacional','Legalizado'], subTabs:['Alta','Cambio de propietario','Reemplacamiento','Baja'] },
  cdmx: { label:'CDMX',      supuestos:['Nacional'],              subTabs:['Alta','Cambio de propietario','Renovación de tarjeta','Baja'] },
  mich: { label:'Michoacán', supuestos:['Nacional','Legalizado','Sin pedimento'], subTabs:['Alta','Cambio de propietario','Baja'] }
};

// Estado activo del modal
let _mpeEstado = null;
let _mpeSupuesto = 0;
let _mpeSubTab = 0;

// ── Storage R2 para el panel de estados (placas) ─────────────────────────
// Ruta base: {despacho_id}/placas/{estado}/{supuesto}/{subtab}/{tipo}
// Tipos: inst.pdf, ejemplo.pdf, rec_0.pdf, rec_1.pdf ... meta.json (nombres)

function _mpePath(estado, supSlug, subSlug, tipo) {
  const did = window.SB_DESPACHO_ID || 'local';
  return `${did}/placas/${estado}/${supSlug}/${subSlug}/${tipo}`;
}

// ── Caché en memoria para evitar descargas repetidas ────────────────────
const _mpeCache = {};

async function _mpeR2Subir(estado, supSlug, subSlug, tipo, file) {
  if (!window.subirR2 || !window.SB_DESPACHO_ID) {
    // Fallback localStorage
    return new Promise(res => {
      const reader = new FileReader();
      reader.onload = e => {
        try { localStorage.setItem(`mpe_${estado}_${supSlug}_${subSlug}_${tipo}`, e.target.result);
              localStorage.setItem(`mpe_${estado}_${supSlug}_${subSlug}_${tipo}_name`, file.name); } catch(err){}
        _mpeCache[`${estado}_${supSlug}_${subSlug}_${tipo}`] = e.target.result;
        res(true);
      };
      reader.readAsDataURL(file);
    });
  }
  const path = _mpePath(estado, supSlug, subSlug, tipo);
  const ok = await window.subirR2(file, path, 'placas');
  if (ok) {
    // Guardar nombre en meta
    await _mpeR2SubirMeta(estado, supSlug, subSlug, tipo, file.name);
    // Actualizar caché con dataURL
    const reader = new FileReader();
    reader.onload = e => { _mpeCache[`${estado}_${supSlug}_${subSlug}_${tipo}`] = e.target.result; };
    reader.readAsDataURL(file);
  }
  return ok;
}

async function _mpeR2Descargar(estado, supSlug, subSlug, tipo) {
  const cacheKey = `${estado}_${supSlug}_${subSlug}_${tipo}`;
  if (_mpeCache[cacheKey]) return _mpeCache[cacheKey];

  if (!window.descargarR2 || !window.SB_DESPACHO_ID) {
    // Fallback localStorage
    return localStorage.getItem(`mpe_${estado}_${supSlug}_${subSlug}_${tipo}`) || null;
  }
  const path = _mpePath(estado, supSlug, subSlug, tipo);
  try {
    const blob = await window.descargarR2(path, 'placas');
    if (!blob) return null;
    return new Promise(res => {
      const reader = new FileReader();
      reader.onload = e => { _mpeCache[cacheKey] = e.target.result; res(e.target.result); };
      reader.readAsDataURL(blob);
    });
  } catch(e) { return null; }
}

async function _mpeR2Quitar(estado, supSlug, subSlug, tipo) {
  delete _mpeCache[`${estado}_${supSlug}_${subSlug}_${tipo}`];
  try { localStorage.removeItem(`mpe_${estado}_${supSlug}_${subSlug}_${tipo}`);
        localStorage.removeItem(`mpe_${estado}_${supSlug}_${subSlug}_${tipo}_name`); } catch(e){}
  if (!window.borrarR2 || !window.SB_DESPACHO_ID) return;
  const path = _mpePath(estado, supSlug, subSlug, tipo);
  await window.borrarR2(path, 'placas').catch(()=>{});
  await _mpeR2SubirMeta(estado, supSlug, subSlug, tipo, null);
}

async function _mpeR2NombreArchivo(estado, supSlug, subSlug, tipo) {
  if (!window.SB_DESPACHO_ID)
    return localStorage.getItem(`mpe_${estado}_${supSlug}_${subSlug}_${tipo}_name`) || '';
  const metaKey = `${estado}_${supSlug}_${subSlug}_meta`;
  let meta = _mpeCache[metaKey];
  if (!meta) {
    const path = _mpePath(estado, supSlug, subSlug, 'meta.json');
    try {
      const blob = await window.descargarR2(path, 'placas');
      if (blob) { const txt = await blob.text(); meta = JSON.parse(txt); _mpeCache[metaKey] = meta; }
    } catch(e) {}
  }
  return (meta && meta[tipo]) || '';
}

async function _mpeR2SubirMeta(estado, supSlug, subSlug, tipo, nombre) {
  const metaKey = `${estado}_${supSlug}_${subSlug}_meta`;
  let meta = _mpeCache[metaKey] || {};
  if (nombre === null) delete meta[tipo]; else meta[tipo] = nombre;
  _mpeCache[metaKey] = meta;
  if (!window.subirR2 || !window.SB_DESPACHO_ID) return;
  const path = _mpePath(estado, supSlug, subSlug, 'meta.json');
  const blob = new Blob([JSON.stringify(meta)], {type:'application/json'});
  const file = new File([blob], 'meta.json', {type:'application/json'});
  await window.subirR2(file, path, 'placas').catch(()=>{});
}

// ── Lista de recursos (meta.json almacena también la lista) ──────────────
async function _mpeR2GetRecLista(estado, supSlug, subSlug) {
  const metaKey = `${estado}_${supSlug}_${subSlug}_meta`;
  let meta = _mpeCache[metaKey];
  if (!meta) {
    if (window.descargarR2 && window.SB_DESPACHO_ID) {
      const path = _mpePath(estado, supSlug, subSlug, 'meta.json');
      try {
        const blob = await window.descargarR2(path, 'placas');
        if (blob) { const txt = await blob.text(); meta = JSON.parse(txt); _mpeCache[metaKey] = meta; }
      } catch(e) {}
    }
  }
  if (meta && meta._recLista) return meta._recLista;
  // Defaults
  return _mpeDefaultRecursos(estado, supSlug);
}

async function _mpeR2SetRecLista(estado, supSlug, subSlug, arr) {
  const metaKey = `${estado}_${supSlug}_${subSlug}_meta`;
  let meta = _mpeCache[metaKey] || {};
  meta._recLista = arr;
  _mpeCache[metaKey] = meta;
  if (!window.subirR2 || !window.SB_DESPACHO_ID) {
    try { localStorage.setItem(`mpe_reclist_${estado}_${supSlug}_${subSlug}`, JSON.stringify(arr)); } catch(e){}
    return;
  }
  const path = _mpePath(estado, supSlug, subSlug, 'meta.json');
  const blob = new Blob([JSON.stringify(meta)], {type:'application/json'});
  const file = new File([blob], 'meta.json', {type:'application/json'});
  await window.subirR2(file, path, 'placas').catch(()=>{});
}

function _mpeDefaultRecursos(estado, supSlug) {
  const base = {
    oax:  { nacional:['Portada expediente Oaxaca','Checklist de documentos','Formato de separador'],
             legalizado:['Portada expediente Oaxaca (Legalizado)','Checklist legalizado'] },
    mex:  { nacional:['Portada expediente Edo. Méx.','Checklist de documentos'],
             legalizado:['Portada expediente Edo. Méx. (Legalizado)'] },
    cdmx: { nacional:['Portada expediente CDMX','Checklist de documentos'] },
    mich: { nacional:['Portada expediente Michoacán','Checklist de documentos'],
             legalizado:['Portada expediente Michoacán (Legalizado)'],
             sin_pedimento:['Portada expediente Michoacán (Sin pedimento)','Checklist sin pedimento'] }
  };
  return (base[estado] && base[estado][supSlug]) || [];
}

// ── Funciones obsoletas mantenidas como alias (no-op) ────────────────────
function _mpeKey(estado, sup) { return `mpe_inst_${estado}_${sup}`; }
function _mpeGetInst(estado, sup) { return ''; }
function _mpeSetInst(estado, sup, val) {}

function _mpeBloque(titulo, iconColor, iconChar, contenido) {
  return `<div style="border:1px solid #e8e0d0;border-radius:10px;overflow:hidden;background:#fff;">
    <div style="background:#fdf8f0;padding:9px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e8e0d0;">
      <span style="font-size:14px;">${iconChar}</span>
      <span style="font-size:0.65rem;font-weight:700;color:#8a7a5a;text-transform:uppercase;letter-spacing:0.07em;">${titulo}</span>
    </div>
    <div style="padding:12px 14px;background:#fff;">${contenido}</div>
  </div>`;
}

// Sesión local del panel de estados.
// FIX: antes exigía volver a escribir correo y contraseña para activar
// "Modo administrador" aunque el usuario YA hubiera iniciado sesión en el
// sistema como el administrador (misma cuenta, ya validada por Supabase Auth
// al entrar) — era pedir el login por partida doble. Ahora se reconoce
// automáticamente: si la sesión global activa es la del administrador
// (ADMIN_EMAIL), el modo administrador de este panel se activa solo, sin
// pedir contraseña otra vez. _mpeAdminOff solo sirve para que el propio
// admin, si quiere, vea el panel temporalmente en modo lectura (como lo
// vería un empleado) sin cerrar su sesión real del sistema.
let _mpeAdminActivo = false;
let _mpeAdminOff = false;

function _mpeCheckAdmin() {
  const emailActual = (typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.email)
    ? empleadoActual.email.toLowerCase() : '';
  const esAdminEmail = (typeof ADMIN_EMAIL !== 'undefined') && emailActual === ADMIN_EMAIL.toLowerCase();
  if (!esAdminEmail) return false;
  return !_mpeAdminOff;
}

function _mpeRenderBody(estado, supIdx) {
  const cfg = _MPE_CONFIG[estado];
  if (!cfg) return;
  const sup = cfg.supuestos[supIdx];
  const supSlug = sup.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
  const isAdmin = _mpeCheckAdmin();

  // ── Sub-pestañas (Alta, Cambio de propietario, etc.) ────────────────────
  const subTabs = cfg.subTabs || [];
  const subIdx  = Math.min(_mpeSubTab, subTabs.length - 1);
  const subSlug = subTabs[subIdx] ? subTabs[subIdx].toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : 'general';

  const subTabsHTML = subTabs.length > 0 ? `
    <div style="display:flex;gap:7px;flex-wrap:wrap;padding:12px 14px;">
      ${subTabs.map((st, si) => `<button onclick="_mpeCambiarSubTab(${si})"
        style="border:2px solid ${si===subIdx?'#c8951a':'#d8ceb8'};border-radius:20px;padding:5px 15px;font-size:0.72rem;font-weight:${si===subIdx?'700':'500'};color:${si===subIdx?'#fff':'#8a7a5a'};background:${si===subIdx?'#c8951a':'transparent'};cursor:pointer;transition:all .15s;letter-spacing:0.02em;">${st}</button>`
      ).join('')}
    </div>` : '';

  // ── Leer SOLO de caché (síncrono — sin await) ───────────────────────────
  const instTipo    = 'inst.pdf';
  const instCacheKey = `${estado}_${supSlug}_${subSlug}_${instTipo}`;
  const instPdfData  = _mpeCache[instCacheKey] ||
    (() => { try { return localStorage.getItem(`mpe_${estado}_${supSlug}_${subSlug}_${instTipo}`) || null; } catch(e){ return null; } })();
  const metaKey      = `${estado}_${supSlug}_${subSlug}_meta`;
  const metaCache    = _mpeCache[metaKey] || {};
  const instPdfName  = metaKey && metaCache[instTipo] ? metaCache[instTipo] :
    (() => { try { return localStorage.getItem(`mpe_${estado}_${supSlug}_${subSlug}_${instTipo}_name`) || ''; } catch(e){ return ''; } })();
  const instHasFile  = !!(instPdfData || instPdfName);
  let instContenido;
  if (isAdmin) {
    instContenido = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:160px;background:#f5f2eb;border:1px solid #d8ceb0;border-radius:8px;padding:9px 13px;overflow:hidden;">
        <span style="font-size:18px;">📄</span>
        <span style="font-size:0.73rem;color:#5a4a2a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${instPdfName || 'Sin PDF adjunto'}</span>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;">
        ${instHasFile ? `<button onclick="_mpePDFVisorData('${estado}','${supSlug}','${subSlug}','${instTipo}','${instPdfName||'Instrucciones'}')" style="border:2px solid #c8951a;border-radius:8px;padding:6px 14px;font-size:0.72rem;font-weight:700;color:#7a4a00;background:#fef3d8;cursor:pointer;">👁 Ver PDF</button>` : ''}
        <label style="border:2px solid ${instHasFile?'#888':'#c8951a'};border-radius:8px;padding:6px 13px;font-size:0.72rem;font-weight:700;color:${instHasFile?'#666':'#7a4a00'};background:${instHasFile?'#f5f5f5':'#fef3d8'};cursor:pointer;white-space:nowrap;">
          📎 ${instHasFile ? 'Cambiar PDF' : 'Adjuntar PDF'}
          <input type="file" accept=".pdf" style="display:none;" onchange="_mpeSubirArchivo('${estado}','${supSlug}','${subSlug}','${instTipo}',this)">
        </label>
        ${instHasFile ? `<button onclick="_mpeQuitarArchivo('${estado}','${supSlug}','${subSlug}','${instTipo}')" style="border:2px solid #e24b4a;border-radius:8px;padding:6px 9px;font-size:0.72rem;color:#a33;background:#fff8f8;cursor:pointer;">✕</button>` : ''}
      </div>
    </div>`;
  } else {
    instContenido = instHasFile
      ? `<button onclick="_mpePDFVisorData('${estado}','${supSlug}','${subSlug}','${instTipo}','${instPdfName||'Instrucciones'}')"
           style="border:2px solid #c8951a;border-radius:8px;padding:8px 20px;font-size:0.78rem;font-weight:700;color:#7a4a00;background:#fef3d8;cursor:pointer;display:flex;align-items:center;gap:8px;">
           <span style="font-size:18px;">📄</span> Ver instrucciones / aviso
         </button>`
      : `<div style="font-size:0.72rem;color:#a09070;font-style:italic;padding:4px 0;">Sin instrucciones disponibles aún.</div>`;
  }
  const b1 = _mpeBloque('Instrucciones / Aviso', '#c8951a', '📝', instContenido);

  // ── Bloque 2: Ejemplo de Expediente Digital (PDF) ─── caché síncrona ──
  const pdfTipo = 'ejemplo.pdf';
  const pdfCacheKey = `${estado}_${supSlug}_${subSlug}_${pdfTipo}`;
  const pdfData = _mpeCache[pdfCacheKey] ||
    (() => { try { return localStorage.getItem(`mpe_${estado}_${supSlug}_${subSlug}_${pdfTipo}`) || null; } catch(e){ return null; } })();
  const pdfName = metaCache[pdfTipo] ||
    (() => { try { return localStorage.getItem(`mpe_${estado}_${supSlug}_${subSlug}_${pdfTipo}_name`) || ''; } catch(e){ return ''; } })();
  const pdfHasFile = !!(pdfData || pdfName);
  let pdfContenido;
  if (isAdmin) {
    pdfContenido = `<div style="background:#f5f2eb;border:1px dashed #c8b890;border-radius:8px;padding:16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:160px;overflow:hidden;">
        <span style="font-size:28px;">📋</span>
        <span style="font-size:0.72rem;color:#8a7a5a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pdfName || 'Sin PDF adjunto'}</span>
      </div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;">
        ${pdfHasFile ? `<button onclick="_mpePDFVisorData('${estado}','${supSlug}','${subSlug}','${pdfTipo}','${pdfName||'Expediente'}')" style="border:2px solid #c8951a;border-radius:8px;padding:6px 14px;font-size:0.72rem;font-weight:700;color:#7a4a00;background:#fef3d8;cursor:pointer;">👁 Ver PDF</button>` : ''}
        <label style="border:2px solid ${pdfHasFile?'#888':'#c8951a'};border-radius:8px;padding:6px 13px;font-size:0.72rem;font-weight:700;color:${pdfHasFile?'#666':'#7a4a00'};background:${pdfHasFile?'#f5f5f5':'#fef3d8'};cursor:pointer;white-space:nowrap;">
          📎 ${pdfHasFile ? 'Cambiar PDF' : 'Adjuntar PDF'}
          <input type="file" accept=".pdf" style="display:none;" onchange="_mpeSubirArchivo('${estado}','${supSlug}','${subSlug}','${pdfTipo}',this)">
        </label>
        ${pdfHasFile ? `<button onclick="_mpeQuitarArchivo('${estado}','${supSlug}','${subSlug}','${pdfTipo}')" style="border:2px solid #e24b4a;border-radius:8px;padding:6px 9px;font-size:0.72rem;color:#a33;background:#fff8f8;cursor:pointer;">✕</button>` : ''}
      </div>
    </div>`;
  } else {
    pdfContenido = pdfHasFile
      ? `<div style="background:#f5f2eb;border:1px dashed #c8b890;border-radius:8px;padding:20px;display:flex;flex-direction:column;align-items:center;gap:10px;">
           <span style="font-size:36px;">📋</span>
           <span style="font-size:0.72rem;color:#8a7a5a;">${pdfName || 'expediente.pdf'}</span>
           <button onclick="_mpePDFVisorData('${estado}','${supSlug}','${subSlug}','${pdfTipo}','${pdfName||'Expediente'}')" style="border:2px solid #c8951a;border-radius:8px;padding:7px 20px;font-size:0.73rem;font-weight:700;color:#7a4a00;background:#fef3d8;cursor:pointer;">👁 Ver PDF</button>
         </div>`
      : `<div style="background:#f5f2eb;border:1px dashed #c8b890;border-radius:8px;padding:20px;display:flex;flex-direction:column;align-items:center;gap:8px;">
           <span style="font-size:36px;">📋</span>
           <span style="font-size:0.7rem;color:#b0a080;font-style:italic;">PDF no disponible aún</span>
         </div>`;
  }
  const b2 = _mpeBloque('Ejemplo de Expediente Digital', '#e24b4a', '📄', pdfContenido);

  // ── Bloque 3: Descarga de recursos ─── caché síncrona ──────────────────
  const recLista = (() => {
    if (metaCache._recLista) return metaCache._recLista;
    try {
      const raw = localStorage.getItem(`mpe_reclist_${estado}_${supSlug}_${subSlug}`);
      if (raw) return JSON.parse(raw);
    } catch(e){}
    return _mpeDefaultRecursos(estado, supSlug);
  })();
  let listaHTML = recLista.map((r, ri) => {
    const recTipo      = `rec_${ri}.pdf`;
    // El nombre real del archivo subido (con extensión) está en el meta del slot
    const archivoReal  = metaCache[recTipo] || '';
    const extReal      = archivoReal.split('.').pop().toLowerCase();
    const hasFile      = !!archivoReal;
    const isWord       = hasFile && ['doc','docx'].includes(extReal);
    const isPdf        = hasFile && extReal === 'pdf';
    const puedeVer     = isWord || isPdf;
    const fileIcon     = isWord ? '📝' : '📄';
    if (isAdmin) {
      const botonesAccion = puedeVer
        ? `<button onclick="_mpeRecVerDoc('${estado}','${supSlug}','${subSlug}','${recTipo}',this)" style="border:1px solid #c8951a;border-radius:6px;padding:4px 9px;font-size:0.68rem;color:#7a4a00;background:#fef3d8;cursor:pointer;" title="Ver archivo">👁</button>
           <button onclick="_mpeRecForzarDescarga('${estado}','${supSlug}','${subSlug}','${recTipo}','${(archivoReal||r).replace(/'/g,"\\'")}',this)" style="border:1px solid #b8a878;border-radius:6px;padding:4px 9px;font-size:0.68rem;color:#5a4010;background:#fdf8f0;cursor:pointer;" title="Descargar">⬇</button>`
        : `<button onclick="_mpeRecForzarDescarga('${estado}','${supSlug}','${subSlug}','${recTipo}','${(archivoReal||r).replace(/'/g,"\\'")}',this)" style="border:1px solid #b8a878;border-radius:6px;padding:4px 9px;font-size:0.68rem;color:#5a4010;background:#fdf8f0;cursor:pointer;" title="Descargar">⬇</button>`;
      return `<div style="display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid #ede8dc;">
        <input value="${r.replace(/"/g,'&quot;')}" onchange="_mpeRenombrarRec('${estado}','${supSlug}','${subSlug}',${ri},this.value)"
          style="flex:1;border:1px solid #d8ceb0;border-radius:5px;padding:4px 8px;font-size:0.75rem;color:#3a2a0a;background:#fffef8;min-width:0;">
        <label style="border:1px solid #c8951a;border-radius:6px;padding:4px 9px;font-size:0.68rem;color:#7a4a00;background:#fef3d8;cursor:pointer;white-space:nowrap;">
          📎 Adjuntar
          <input type="file" style="display:none;" onchange="_mpeSubirArchivo('${estado}','${supSlug}','${subSlug}','${recTipo}',this)">
        </label>
        ${botonesAccion}
        <button onclick="_mpeEliminarRec('${estado}','${supSlug}','${subSlug}',${ri})"
          style="border:1px solid #e24b4a;border-radius:6px;padding:4px 8px;font-size:0.68rem;color:#a33;background:#fff8f8;cursor:pointer;">✕</button>
      </div>`;
    } else {
      const botonesAccion = puedeVer
        ? `<div style="display:flex;gap:5px;flex-shrink:0;">
             <button onclick="_mpeRecVerDoc('${estado}','${supSlug}','${subSlug}','${recTipo}',this)"
               style="border:1px solid #c8951a;border-radius:7px;padding:5px 12px;font-size:0.7rem;color:#7a4a00;background:#fef3d8;cursor:pointer;font-weight:600;">👁 Ver</button>
             <button onclick="_mpeRecForzarDescarga('${estado}','${supSlug}','${subSlug}','${recTipo}','${(archivoReal||r).replace(/'/g,"\\'")}',this)"
               style="border:1px solid #b8a878;border-radius:7px;padding:5px 10px;font-size:0.7rem;color:#5a4010;background:#fdf8f0;cursor:pointer;font-weight:600;" title="Descargar">⬇</button>
           </div>`
        : `<button onclick="_mpeRecForzarDescarga('${estado}','${supSlug}','${subSlug}','${recTipo}','${(archivoReal||r).replace(/'/g,"\\'")}',this)"
             style="border:1px solid #b8a878;border-radius:7px;padding:5px 14px;font-size:0.7rem;color:#5a4010;background:#fdf8f0;cursor:pointer;font-weight:600;">⬇ Descargar</button>`;
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #ede8dc;gap:8px;">
        <span style="font-size:0.75rem;color:#3a3020;display:flex;align-items:center;gap:7px;flex:1;min-width:0;">${fileIcon} ${r}</span>
        ${botonesAccion}
      </div>`;
    }
  }).join('');
  if (isAdmin) {
    listaHTML += `<div style="padding-top:10px;">
      <button onclick="_mpeAgregarRecR2('${estado}','${supSlug}','${subSlug}')"
        style="border:1px dashed #c8951a;border-radius:7px;padding:6px 14px;font-size:0.72rem;color:#7a4a00;background:#fef3d8;cursor:pointer;width:100%;">＋ Agregar archivo</button>
    </div>`;
  }
  const b3 = _mpeBloque('Descarga de Recursos', '#1d9e75', '📥', `<div>${listaHTML}</div>`);

  // ── Banner admin ────────────────────────────────────────────────────────
  // Solo el admin ve el botón de ingresar
  const _emailActual = (typeof empleadoActual !== 'undefined' && empleadoActual && empleadoActual.email)
    ? empleadoActual.email.toLowerCase() : '';
  const _esAdminEmail = (typeof ADMIN_EMAIL !== 'undefined') && _emailActual === ADMIN_EMAIL.toLowerCase();

  const loginBanner = !isAdmin ? (
    _esAdminEmail ? `
    <div style="background:#fdf8f0;border:1px solid #e8d8b0;border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">🔒</span>
        <span style="font-size:0.75rem;color:#7a5a1a;font-weight:600;">Viendo en modo lectura</span>
        <span style="font-size:0.7rem;color:#a09070;">— ya iniciaste sesión como administrador</span>
      </div>
      <button onclick="_mpeReactivarAdmin()" style="background:#c8951a;border:none;border-radius:7px;color:#fff;font-size:0.72rem;font-weight:700;padding:6px 16px;cursor:pointer;">🔑 Activar modo administrador</button>
    </div>` : ''
  ) : `
    <div style="background:#f0faf4;border:1px solid #b8e0c8;border-radius:10px;padding:9px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
      <span style="font-size:0.72rem;color:#2a7a4a;font-weight:600;">✅ Modo administrador activo</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <button id="mpe-btn-guardar" onclick="_mpeGuardarCambios()" style="background:#2a7a4a;border:none;border-radius:7px;color:#fff;font-size:0.72rem;font-weight:700;padding:6px 16px;cursor:pointer;">💾 Guardar cambios</button>
        <button onclick="_mpeCerrarAdminConAviso()" style="background:transparent;border:1px solid #b8e0c8;border-radius:6px;color:#2a7a4a;font-size:0.68rem;padding:5px 12px;cursor:pointer;">Ver en modo lectura</button>
      </div>
    </div>`;

  const bodyEl = document.getElementById('mpe-body');
  bodyEl.innerHTML = '';
  // Insertar sub-pestañas DENTRO del body antes de los bloques
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  wrapper.innerHTML = loginBanner + (subTabs.length > 1 ? `<div style="background:#fafaf6;border:1px solid #e8e0d0;border-radius:10px;overflow:hidden;">${subTabsHTML.replace(/^\s*<div[^>]*>|<\/div>\s*$/g,'')}</div>` : '') + b1 + b2 + b3;
  bodyEl.appendChild(wrapper);
}

// _mpeGetRecursosConUrls sustituida por _mpeGetRecLista

function _mpeRenderTabs(estado, supActivo) {
  const cfg = _MPE_CONFIG[estado];
  const cont = document.getElementById('mpe-supuesto-tabs');
  cont.innerHTML = cfg.supuestos.map((s, i) =>
    `<button onclick="_mpeCambiarSup('${estado}',${i})" style="border:2px solid ${i===supActivo?'#c8951a':'rgba(200,149,42,0.35)'};border-radius:20px;padding:5px 15px;font-size:0.68rem;font-weight:700;letter-spacing:0.03em;color:${i===supActivo?'#fff':'rgba(200,149,42,0.8)'};background:${i===supActivo?'#c8951a':'transparent'};cursor:pointer;transition:all .15s;">${s}</button>`
  ).join('');
}

function _mpeCambiarSup(estado, idx) {
  _mpeSupuesto = idx;
  _mpeSubTab   = 0;
  _mpeRenderTabs(estado, idx);
  _mpeRenderBody(estado, idx);          // render inmediato con caché
  _mpePrefetchR2(estado, idx, 0);       // cargar R2 en fondo
}

function _mpeCambiarSubTab(idx) {
  _mpeSubTab = idx;
  _mpeRenderBody(_mpeEstado, _mpeSupuesto);   // render inmediato
  _mpePrefetchR2(_mpeEstado, _mpeSupuesto, idx); // cargar R2 en fondo
}

// Prefetch: descarga meta.json + PDFs de R2 en segundo plano y re-renderiza si hay novedades
async function _mpePrefetchR2(estado, supIdx, subIdx) {
  if (!window.descargarR2 || !window.SB_DESPACHO_ID) return;
  const cfg = _MPE_CONFIG[estado];
  if (!cfg) return;
  const sup     = cfg.supuestos[supIdx];
  const supSlug = sup.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
  const subTabs = cfg.subTabs || [];
  const subSlug = (subTabs[Math.min(subIdx, subTabs.length-1)] || '')
    .toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') || 'general';
  const metaKey = `${estado}_${supSlug}_${subSlug}_meta`;

  // 1. Cargar meta.json si no está en caché
  if (!_mpeCache[metaKey]) {
    try {
      const path = _mpePath(estado, supSlug, subSlug, 'meta.json');
      const blob = await window.descargarR2(path, 'placas');
      if (blob) {
        const txt  = await blob.text();
        _mpeCache[metaKey] = JSON.parse(txt);
        // Re-renderizar solo si el panel sigue en la misma vista
        if (_mpeEstado===estado && _mpeSupuesto===supIdx && _mpeSubTab===subIdx) {
          _mpeRenderBody(estado, supIdx);
        }
      }
    } catch(e) {}
  }
}

// Recursos: renombrar, eliminar, agregar
async function _mpeRenombrarRec(estado, supSlug, subSlug, idx, nuevoNombre) {
  const lista = await _mpeR2GetRecLista(estado, supSlug, subSlug);
  lista[idx] = nuevoNombre;
  await _mpeR2SetRecLista(estado, supSlug, subSlug, lista);
}
async function _mpeEliminarRec(estado, supSlug, subSlug, idx) {
  if (!confirm('¿Eliminar este archivo de la lista?')) return;
  const lista = await _mpeR2GetRecLista(estado, supSlug, subSlug);
  await _mpeR2Quitar(estado, supSlug, subSlug, `rec_${idx}.pdf`);
  lista.splice(idx, 1);
  await _mpeR2SetRecLista(estado, supSlug, subSlug, lista);
  await _mpeRenderBody(_mpeEstado, _mpeSupuesto);
}

// PDF helpers con key directa
function _mpePDFSubirKey(key, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try { localStorage.setItem(key, e.target.result); } catch(err) {
      alert('Archivo demasiado grande. Usa un PDF optimizado.'); return;
    }
    _mpeRenderBody(_mpeEstado, _mpeSupuesto);
  };
  reader.readAsDataURL(file);
}
function _mpePDFVer(key) {
  const dataUrl = (() => { try { return localStorage.getItem(key); } catch(e){ return null; } })();
  if (!dataUrl) { alert('No hay PDF adjunto.'); return; }
  const win = window.open();
  if (win) win.document.write('<iframe src="' + dataUrl + '" style="width:100%;height:100vh;border:none;"></iframe>');
}
function _mpeQuitarKey(key) {
  if (!confirm('¿Quitar el archivo adjunto?')) return;
  try { localStorage.removeItem(key); } catch(e){}
  _mpeRenderBody(_mpeEstado, _mpeSupuesto);
}
function _mpeRecSubirKey(key, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try { localStorage.setItem(key, e.target.result); } catch(err) {
      alert('Archivo demasiado grande.'); return;
    }
    _mpeRenderBody(_mpeEstado, _mpeSupuesto);
  };
  reader.readAsDataURL(file);
}
function _mpeRecDescargar(keyOrUrl, nombre) {
  const dataUrl = (() => { try { return localStorage.getItem(keyOrUrl) || keyOrUrl; } catch(e){ return keyOrUrl; } })();
  if (!dataUrl || dataUrl === keyOrUrl) { alert('No hay archivo adjunto aún.'); return; }
  const a = document.createElement('a'); a.href = dataUrl; a.download = nombre; a.click();
}

function abrirPanelEstado(estado, btn) {
  _mpeEstado = estado;
  _mpeSupuesto = 0;
  const cfg = _MPE_CONFIG[estado];
  document.getElementById('mpe-title').textContent = '📍 ' + cfg.label;
  _mpeRenderTabs(estado, 0);
  _mpeRenderBody(estado, 0);        // render inmediato con caché
  _mpePrefetchR2(estado, 0, 0);     // cargar R2 en fondo
  const modal = document.getElementById('modal-panel-estado');
  modal.style.display = 'flex';
  // Resaltar botón activo (brillo sobre su propio color)
  document.querySelectorAll('.pnl-estado-btn').forEach(b => { b.style.filter = 'none'; b.style.boxShadow = 'none'; });
  if (btn) { btn.style.filter = 'brightness(1.35)'; btn.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.25)'; }
}

function cerrarPanelEstado() {
  document.getElementById('modal-panel-estado').style.display = 'none';
  document.querySelectorAll('.pnl-estado-btn').forEach(b => { b.style.filter = 'none'; b.style.boxShadow = 'none'; });
}

function _mpeGuardarInst(estado, sup, val) {
  _mpeSetInst(estado, sup, val);
}

// helpers PDF/rec reemplazados por versiones con key directa

// ── PDF: subir, visor flotante, quitar — usando R2 ──────────────────────────
async function _mpeSubirArchivo(estado, supSlug, subSlug, tipo, input) {
  _mpeMarcarCambio();
  const file = input.files[0]; if (!file) return;
  const btnLabel = input.parentElement;
  if (btnLabel) { btnLabel.textContent = '⏳ Subiendo...'; btnLabel.style.pointerEvents = 'none'; }
  // Leer archivo como dataURL y guardar en caché inmediatamente
  const dataUrl = await new Promise(res => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.readAsDataURL(file);
  });
  // Guardar en caché y localStorage al instante
  const cacheKey = `${estado}_${supSlug}_${subSlug}_${tipo}`;
  _mpeCache[cacheKey] = dataUrl;
  try { localStorage.setItem(`mpe_${estado}_${supSlug}_${subSlug}_${tipo}`, dataUrl);
        localStorage.setItem(`mpe_${estado}_${supSlug}_${subSlug}_${tipo}_name`, file.name); } catch(e){}
  // Actualizar meta cache con nombre
  const metaKey = `${estado}_${supSlug}_${subSlug}_meta`;
  const meta = _mpeCache[metaKey] || {};
  meta[tipo] = file.name;
  _mpeCache[metaKey] = meta;
  try { localStorage.setItem(`mpe_reclist_${estado}_${supSlug}_${subSlug}`, JSON.stringify(meta._recLista || [])); } catch(e){}
  // Re-renderizar inmediatamente con los datos en caché
  _mpeRenderBody(_mpeEstado, _mpeSupuesto);
  // Subir a R2 en segundo plano
  _mpeR2Subir(estado, supSlug, subSlug, tipo, file).then(ok => {
    if (!ok) { console.warn('[mpe] No se pudo subir a R2, quedó en caché local'); }
  }).catch(e => console.warn('[mpe] R2 upload error:', e));
}

async function _mpePDFVisorData(estado, supSlug, subSlug, tipo, titulo) {
  // Mostrar overlay inmediato con spinner mientras carga
  const existing = document.getElementById('mpe-pdf-visor-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'mpe-pdf-visor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:19999;background:rgba(0,0,0,0.82);display:flex;flex-direction:column;';
  overlay.innerHTML = `
    <div style="background:#1a1a0e;padding:10px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(200,149,42,0.3);">
      <span style="font-size:16px;">📄</span>
      <span style="font-size:0.85rem;font-weight:700;color:#f0d890;flex:1;">${titulo || 'Documento'}</span>
      <span id="mpe-visor-dl"></span>
      <button onclick="document.getElementById('mpe-pdf-visor-overlay').remove()"
        style="background:#c0392b;border:none;border-radius:6px;color:#fff;font-size:0.8rem;font-weight:700;padding:5px 14px;cursor:pointer;">✕ Cerrar</button>
    </div>
    <div id="mpe-visor-content" style="flex:1;display:flex;align-items:center;justify-content:center;background:#333;">
      <span style="color:#aaa;font-size:0.9rem;">⏳ Cargando PDF...</span>
    </div>`;
  document.body.appendChild(overlay);

  const dataUrl = await _mpeR2Descargar(estado, supSlug, subSlug, tipo);
  if (!dataUrl) {
    document.getElementById('mpe-visor-content').innerHTML = '<span style="color:#f88;font-size:0.9rem;">No se pudo cargar el PDF.</span>';
    return;
  }
  // Convertir dataURL → Blob URL para que los navegadores modernos puedan renderizarlo
  try {
    const byteStr = atob(dataUrl.split(',')[1]);
    const ab = new ArrayBuffer(byteStr.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
    const blob = new Blob([ab], {type: 'application/pdf'});
    const blobUrl = URL.createObjectURL(blob);
    const contentEl = document.getElementById('mpe-visor-content');
    if (contentEl) contentEl.innerHTML =
      `<iframe src="${blobUrl}" style="width:100%;height:100%;border:none;background:#fff;" type="application/pdf"></iframe>`;
    const dlEl = document.getElementById('mpe-visor-dl');
    if (dlEl) dlEl.innerHTML =
      `<a href="${blobUrl}" download="${titulo||'documento'}.pdf" style="border:1px solid #c8951a;border-radius:6px;padding:5px 14px;font-size:0.72rem;font-weight:700;color:#f0d890;text-decoration:none;background:rgba(200,149,42,0.15);">⬇ Descargar</a>`;
    // Limpiar blob URL al cerrar el overlay
    const overlayEl = document.getElementById('mpe-pdf-visor-overlay');
    if (overlayEl) overlayEl._blobUrl = blobUrl;
  } catch(e) {
    console.error('[PDFVisor]', e);
    document.getElementById('mpe-visor-content').innerHTML = '<span style="color:#f88;font-size:0.9rem;">Error al renderizar el PDF.</span>';
  }
}

async function _mpeQuitarArchivo(estado, supSlug, subSlug, tipo) {
  if (!confirm('¿Quitar el archivo adjunto?')) return;
  await _mpeR2Quitar(estado, supSlug, subSlug, tipo);
  await _mpeRenderBody(_mpeEstado, _mpeSupuesto);
}

async function _mpeRecDescargarR2(estado, supSlug, subSlug, tipo, nombre, btnEl, btnTextoReset) {
  const cacheKey = `${estado}_${supSlug}_${subSlug}_${tipo}`;
  let dataUrl = _mpeCache[cacheKey] ||
    (() => { try { return localStorage.getItem(`mpe_${estado}_${supSlug}_${subSlug}_${tipo}`) || null; } catch(e){ return null; } })();
  if (!dataUrl) {
    const textoOrig = btnEl ? btnEl.textContent : '';
    if (btnEl) { btnEl.textContent = '⏳'; btnEl.disabled = true; }
    dataUrl = await _mpeR2Descargar(estado, supSlug, subSlug, tipo);
    if (btnEl) { btnEl.textContent = btnTextoReset || textoOrig || '⬇'; btnEl.disabled = false; }
    if (!dataUrl) { alert('No hay archivo adjunto aún.'); return; }
  }
  const ext = nombre.split('.').pop().toLowerCase();
  if (['doc','docx'].includes(ext)) {
    _mpeWordVisor(dataUrl, nombre);
    return;
  }
  const a = document.createElement('a'); a.href = dataUrl; a.download = nombre; a.click();
}

async function _mpeRecForzarDescarga(estado, supSlug, subSlug, tipo, nombre, btnEl) {
  const cacheKey = `${estado}_${supSlug}_${subSlug}_${tipo}`;
  let dataUrl = _mpeCache[cacheKey] ||
    (() => { try { return localStorage.getItem(`mpe_${estado}_${supSlug}_${subSlug}_${tipo}`) || null; } catch(e){ return null; } })();
  if (!dataUrl) {
    const textoOrig = btnEl ? btnEl.textContent : '⬇';
    if (btnEl) { btnEl.textContent = '⏳'; btnEl.disabled = true; }
    dataUrl = await _mpeR2Descargar(estado, supSlug, subSlug, tipo);
    if (btnEl) { btnEl.textContent = textoOrig; btnEl.disabled = false; }
    if (!dataUrl) { alert('No hay archivo adjunto aún.'); return; }
  }
  const a = document.createElement('a'); a.href = dataUrl; a.download = nombre; a.click();
}

async function _mpeRecVerDoc(estado, supSlug, subSlug, tipo, btnEl) {
  // Leer nombre real del archivo desde meta (tiene la extensión correcta)
  const metaKey = `${estado}_${supSlug}_${subSlug}_meta`;
  const meta = _mpeCache[metaKey] || {};
  const nombreArchivo = meta[tipo] || tipo;
  const ext = nombreArchivo.split('.').pop().toLowerCase();

  if (['doc','docx'].includes(ext)) {
    // Word: necesita dataUrl para mammoth.js
    const cacheKey = `${estado}_${supSlug}_${subSlug}_${tipo}`;
    let dataUrl = _mpeCache[cacheKey] ||
      (() => { try { return localStorage.getItem(`mpe_${estado}_${supSlug}_${subSlug}_${tipo}`) || null; } catch(e){ return null; } })();
    if (!dataUrl) {
      const textoOrig = btnEl ? btnEl.textContent : '👁 Ver';
      if (btnEl) { btnEl.textContent = '⏳'; btnEl.disabled = true; }
      dataUrl = await _mpeR2Descargar(estado, supSlug, subSlug, tipo);
      if (btnEl) { btnEl.textContent = textoOrig; btnEl.disabled = false; }
      if (!dataUrl) { alert('No hay archivo adjunto aún.'); return; }
    }
    await _mpeWordVisor(dataUrl, nombreArchivo);
  } else {
    // PDF: _mpePDFVisorData maneja la carga desde caché o R2
    if (btnEl) { btnEl.textContent = '⏳'; btnEl.disabled = true; }
    await _mpePDFVisorData(estado, supSlug, subSlug, tipo, nombreArchivo);
    if (btnEl) { btnEl.textContent = '👁 Ver'; btnEl.disabled = false; }
  }
}

async function _mpeAgregarRecR2(estado, supSlug, subSlug) {
  const lista = await _mpeR2GetRecLista(estado, supSlug, subSlug);
  lista.push('Nuevo archivo');
  await _mpeR2SetRecLista(estado, supSlug, subSlug, lista);
  _mpeRenderBody(_mpeEstado, _mpeSupuesto); // síncrono ahora
}

// ── Guardar cambios (feedback visual) ──────────────────────────────────────
function _mpeGuardarCambios() {
  _mpeCambiosPendientes = false;
  const btn = document.getElementById('mpe-btn-guardar');
  if (!btn) return;
  btn.textContent = '✅ ¡Guardado!';
  btn.style.background = '#1a5a34';
  setTimeout(() => {
    btn.textContent = '💾 Guardar cambios';
    btn.style.background = '#2a7a4a';
  }, 2000);
  // Los datos ya están en localStorage en tiempo real;
  // aquí se puede agregar sync a Supabase en el futuro.
}

// ── Login admin del panel — mismo diseño que Panel de Administrador ─────────
function _mpeAbrirLogin() {
  const existing = document.getElementById('mpe-login-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'mpe-login-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10100;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#1a1510;border:1px solid rgba(200,149,42,0.25);border-radius:14px;width:min(480px,94vw);box-shadow:0 12px 48px rgba(0,0,0,0.7);overflow:hidden;">

      <!-- HEADER igual al admin modal -->
      <div style="border-bottom:1px solid rgba(200,149,42,0.15);padding:16px 22px;display:flex;align-items:center;gap:14px;">
        <div style="width:36px;height:36px;background:rgba(200,149,42,0.15);border:1px solid rgba(200,149,42,0.3);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;">⚙️</div>
        <div style="flex:1;">
          <div style="font-family:serif;font-size:0.95rem;font-weight:700;color:rgba(200,149,42,0.9);">Panel de Administrador</div>
          <div style="font-family:monospace;font-size:0.55rem;color:rgba(200,149,42,0.4);letter-spacing:0.1em;margin-top:2px;">LEX·MÉXICO · ACCESO RESTRINGIDO</div>
        </div>
        <button onclick="document.getElementById('mpe-login-overlay').remove()"
          style="background:rgba(200,149,42,0.08);border:1px solid rgba(200,149,42,0.2);border-radius:8px;padding:7px 14px;cursor:pointer;font-family:monospace;font-size:0.65rem;color:rgba(200,149,42,0.6);letter-spacing:0.08em;">✕ CERRAR</button>
      </div>

      <!-- BODY -->
      <div style="padding:28px 28px 24px;">
        <div style="text-align:center;margin-bottom:22px;">
          <div style="font-size:2.2rem;margin-bottom:8px;">🔐</div>
          <div style="font-family:serif;font-size:0.92rem;color:rgba(200,149,42,0.85);">Ingresa tus credenciales</div>
          <div style="font-family:monospace;font-size:0.58rem;color:rgba(200,149,42,0.4);margin-top:3px;">Solo usuarios autorizados</div>
        </div>

        <!-- Error -->
        <div id="mpe-login-err" style="display:none;background:rgba(192,22,26,0.12);border:1px solid rgba(192,22,26,0.3);color:#e88;padding:8px 12px;border-radius:6px;font-size:0.74rem;margin-bottom:12px;text-align:center;font-family:monospace;"></div>

        <!-- Correo -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-family:monospace;font-size:0.6rem;color:rgba(200,149,42,0.55);letter-spacing:0.1em;margin-bottom:7px;">CORREO ELECTRÓNICO</label>
          <input id="mpe-login-email" type="email" placeholder="tu@correo.com" autocomplete="email"
            style="width:100%;background:rgba(200,149,42,0.04);border:1px solid rgba(200,149,42,0.35);border-radius:8px;padding:11px 14px;font-size:0.85rem;color:rgba(200,149,42,0.9);outline:none;box-sizing:border-box;"
            onfocus="this.style.borderColor='rgba(200,149,42,0.8)'" onblur="this.style.borderColor='rgba(200,149,42,0.35)'">
        </div>

        <!-- Contraseña -->
        <div style="margin-bottom:18px;">
          <label style="display:block;font-family:monospace;font-size:0.6rem;color:rgba(200,149,42,0.55);letter-spacing:0.1em;margin-bottom:7px;">CONTRASEÑA</label>
          <div style="position:relative;">
            <input id="mpe-login-pass" type="password" placeholder="••••••••••••" autocomplete="current-password"
              style="width:100%;background:rgba(200,149,42,0.04);border:1px solid rgba(200,149,42,0.35);border-radius:8px;padding:11px 42px 11px 14px;font-size:0.85rem;color:rgba(200,149,42,0.9);outline:none;box-sizing:border-box;"
              onfocus="this.style.borderColor='rgba(200,149,42,0.8)'" onblur="this.style.borderColor='rgba(200,149,42,0.35)'"
              onkeydown="if(event.key==='Enter')_mpeDoLogin()">
            <button type="button" onclick="_mpePanelTogglePass()"
              style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:transparent;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;">
              <svg id="mpe-eye-open" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="rgba(200,149,42,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg id="mpe-eye-off" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="rgba(200,149,42,0.55)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:none;">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
          <label style="display:flex;align-items:center;gap:7px;margin-top:8px;cursor:pointer;user-select:none;">
            <input type="checkbox" onchange="_mpePanelTogglePass()"
              style="accent-color:var(--gold,#c8951a);width:14px;height:14px;cursor:pointer;">
            <span style="font-family:monospace;font-size:0.6rem;color:rgba(200,149,42,0.5);letter-spacing:0.05em;">VER CONTRASEÑA</span>
          </label>
        </div>

        <!-- Botones -->
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button onclick="document.getElementById('mpe-login-overlay').remove()"
            style="background:transparent;border:1px solid rgba(200,149,42,0.2);border-radius:8px;padding:9px 20px;font-family:monospace;font-size:0.7rem;color:rgba(200,149,42,0.5);cursor:pointer;letter-spacing:0.06em;">CANCELAR</button>
          <button onclick="_mpeDoLogin()"
            style="background:var(--gold-d,#b8820e);border:none;border-radius:8px;padding:9px 24px;font-family:monospace;font-size:0.72rem;font-weight:700;color:#fff;cursor:pointer;letter-spacing:0.08em;display:flex;align-items:center;gap:8px;">
            🔓 ACCEDER
          </button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => { const el = document.getElementById('mpe-login-email'); if(el) el.focus(); }, 80);
}

function _mpePanelTogglePass() {
  const inp = document.getElementById('mpe-login-pass');
  const eyeOpen = document.getElementById('mpe-eye-open');
  const eyeOff  = document.getElementById('mpe-eye-off');
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  if (eyeOpen) eyeOpen.style.display = show ? 'none' : '';
  if (eyeOff)  eyeOff.style.display  = show ? ''     : 'none';
}

async function _mpeDoLogin() {
  const email = (document.getElementById('mpe-login-email').value || '').trim();
  const pass  = (document.getElementById('mpe-login-pass').value  || '').trim();
  const errEl = document.getElementById('mpe-login-err');
  if (!email || !pass) { errEl.textContent = 'Completa correo y contraseña.'; errEl.style.display = 'block'; return; }

  // Verificar si es el admin del sistema
  if (typeof ADMIN_EMAIL !== 'undefined' && email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    errEl.textContent = 'Esta cuenta no tiene permisos de administrador.';
    errEl.style.display = 'block';
    return;
  }

  // Intentar login con Supabase
  if (typeof sb !== 'undefined' && sb && sb.auth) {
    errEl.textContent = 'Verificando...'; errEl.style.display = 'block';
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error || !data.user) {
        errEl.textContent = 'Correo o contraseña incorrectos.'; errEl.style.display = 'block';
        return;
      }
      _mpeAdminActivo = true;
      _mpeAdminOff = false;
      try { sessionStorage.removeItem('mpe_admin_off'); } catch(e){} // Limpiar bloqueo
      document.getElementById('mpe-login-overlay').remove();
      _mpeRenderTabs(_mpeEstado, _mpeSupuesto);
      _mpeRenderBody(_mpeEstado, _mpeSupuesto);
      return;
    } catch(e) {
      errEl.textContent = 'Error de conexión. Intenta de nuevo.'; errEl.style.display = 'block';
      return;
    }
  }
  // Fallback sin Supabase (solo verifica email admin)
  _mpeAdminActivo = true;
  _mpeAdminOff = false;
  try { sessionStorage.removeItem('mpe_admin_off'); } catch(e){}
  document.getElementById('mpe-login-overlay').remove();
  _mpeRenderTabs(_mpeEstado, _mpeSupuesto);
  _mpeRenderBody(_mpeEstado, _mpeSupuesto);
}

// Rastrear si hay cambios sin guardar en el panel
let _mpeCambiosPendientes = false;

function _mpeMarcarCambio() { _mpeCambiosPendientes = true; }

function _mpeCerrarAdminConAviso() {
  if (_mpeCambiosPendientes) {
    const resp = confirm('Tienes cambios sin guardar.\n\n¿Guardar antes de cerrar sesión?');
    if (resp) {
      _mpeGuardarCambios();
      // Pequeña pausa para que se vea el feedback visual antes de cerrar
      setTimeout(_mpeCerrarAdmin, 1800);
      return;
    }
    // No guardó — confirmar que se perderá la info
    const confirmar = confirm('Los cambios NO guardados se perderán. ¿Continuar de todas formas?');
    if (!confirmar) return;
  }
  _mpeCerrarAdmin();
}

function _mpeCerrarAdmin() {
  _mpeAdminActivo = false;
  _mpeAdminOff = true;
  _mpeCambiosPendientes = false;
  try { sessionStorage.setItem('mpe_admin_off', '1'); } catch(e){} // Persistir para refresco
  const visor = document.getElementById('mpe-pdf-visor-overlay');
  if (visor) visor.remove();
  if (_mpeEstado !== null) {
    _mpeRenderTabs(_mpeEstado, _mpeSupuesto);
    _mpeRenderBody(_mpeEstado, _mpeSupuesto);
  }
}

// Reactiva el modo administrador para quien YA inició sesión como el
// administrador del sistema — sin volver a pedir contraseña, porque esa
// validación ya la hizo Supabase Auth al entrar a la aplicación.
function _mpeReactivarAdmin() {
  _mpeAdminActivo = true;
  _mpeAdminOff = false;
  try { sessionStorage.removeItem('mpe_admin_off'); } catch(e){}
  if (_mpeEstado !== null) {
    _mpeRenderTabs(_mpeEstado, _mpeSupuesto);
    _mpeRenderBody(_mpeEstado, _mpeSupuesto);
  }
}

// Cerrar modal al hacer clic en el fondo oscuro
document.getElementById('modal-panel-estado').addEventListener('click', function(e) {
  if (e.target === this) cerrarPanelEstado();
});
// ── Visor de Word (.doc/.docx) con mammoth.js ───────────────────────────────
async function _mpeWordVisor(dataUrl, nombre) {
  const existing = document.getElementById('mpe-word-visor-overlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'mpe-word-visor-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:19999;background:rgba(0,0,0,0.82);display:flex;flex-direction:column;';
  overlay.innerHTML = `
    <div style="background:#1a1a0e;padding:10px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(200,149,42,0.3);">
      <span style="font-size:16px;">📄</span>
      <span style="font-size:0.85rem;font-weight:700;color:#f0d890;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nombre}</span>
      <a href="${dataUrl}" download="${nombre}" style="border:1px solid #c8951a;border-radius:6px;padding:5px 14px;font-size:0.72rem;font-weight:700;color:#f0d890;text-decoration:none;background:rgba(200,149,42,0.15);">⬇ Descargar</a>
      <button onclick="document.getElementById('mpe-word-visor-overlay').remove()" style="background:#c0392b;border:none;border-radius:6px;color:#fff;font-size:0.8rem;font-weight:700;padding:5px 14px;cursor:pointer;">✕ Cerrar</button>
    </div>
    <div id="mpe-word-content" style="flex:1;overflow-y:auto;background:#fff;padding:32px 48px;font-family:Georgia,serif;font-size:1rem;line-height:1.7;color:#1a1008;">
      <p style="color:#aaa;text-align:center;margin-top:40px;">⏳ Cargando documento...</p>
    </div>`;
  document.body.appendChild(overlay);
  try {
    if (typeof mammoth === 'undefined') {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
    const el = document.getElementById('mpe-word-content');
    if (el) el.innerHTML = result.value || '<p style="color:#aaa;text-align:center;">El documento está vacío.</p>';
  } catch(e) {
    console.error('[WordVisor]', e);
    const el = document.getElementById('mpe-word-content');
    if (el) el.innerHTML = '<p style="color:#c00;text-align:center;">No se pudo visualizar. Usa el botón Descargar.</p>';
  }
}
// ═══ FIN MÓDULO PANEL DE ESTADOS ═════════════════════════════════════════

// ── FIX: Garantizar que "Agregar concepto" siempre funcione ─────────────────
// Si el body tiene recibo-frozen por algún estado residual, el botón queda
// con pointer-events:none. Este fix lo restaura en DOM-ready y periódicamente.
(function fixBtnAgregarConcepto() {
  function reparar() {
    const btn = document.getElementById('btn-agregar-concepto');
    if (!btn) return;
    // Si NO estamos en modo-actualizacion, el botón siempre debe ser clickeable
    if (!document.body.classList.contains('modo-actualizacion')) {
      btn.style.setProperty('pointer-events', 'auto', 'important');
      btn.style.setProperty('opacity', '1', 'important');
      btn.style.setProperty('cursor', 'pointer', 'important');
    }
  }
  // Al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reparar);
  } else {
    reparar();
  }
  // Cada vez que cambia el body classList (MutationObserver)
  const obs = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      if (m.attributeName === 'class') reparar();
    });
  });
  obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
// ════════════════════════════════════════════════════════════════════════
//  OCR MODULE — INTEGRADO EN NUEVA ENTRADA DEL HISTORIAL
//  Prefijo "ocrMod" para evitar colisiones con funciones existentes
//  Motor: Gemini 1.5 Flash — Gratis 1500 análisis/día
// ════════════════════════════════════════════════════════════════════════
// ─── Estado del módulo ────────────────────────────────────────────────
let ocrModArchivos  = [];
let ocrModDriveSel  = [];
let ocrModTipoS     = 'Civil';
let ocrModTipoD     = 'Civil';
let ocrModResultado = null;
// ─── API Key y config ─────────────────────────────────────────────────
// Cache global de la API Key
window._geminiKeyCached = window._geminiKeyCached || '';
// Cargar key desde el almacenamiento temporal de esta pestaña
async function _cargarYCachearKey(){
  const fromSession = _secretSessionGet('lex-gemini-key');
  if(fromSession.length > 10) window._geminiKeyCached = fromSession;
}
function ocrModGetKey(){
  // 1. Memoria global
  if(window._geminiKeyCached && window._geminiKeyCached.length > 10) return window._geminiKeyCached;
  // 2. Campo visible en pantalla
  const fromInput = (document.getElementById('ocr-cfg-key-inline')?.value||'').trim();
  if(fromInput && fromInput.length > 10){ window._geminiKeyCached = fromInput; return fromInput; }
  // 3. Sesión temporal como último recurso
  const fromSession = _secretSessionGet('lex-gemini-key');
  if(fromSession.length > 10){ window._geminiKeyCached = fromSession; return fromSession; }
  return '';
}
// FIX: reintentar la carga de la key hasta que haya sesión activa
// El problema era que se ejecutaba antes de autenticar → query regresaba vacía
// NOTA: Gemini fue eliminado del sistema (reemplazado por Groq + Cloudflare
// Workers AI). Esta función se deja definida por si algún residuo la
// referencia, pero YA NO se auto-ejecuta al cargar la página — antes hacía
// hasta 10 reintentos y terminaba avisando en consola que faltaba una key
// de Gemini que ya no hace falta en ningún lado.
function _intentarCargarKey(intento){
  if(window._geminiKeyCached && window._geminiKeyCached.length > 10) return;
  const fromSession = _secretSessionGet('lex-gemini-key');
  if(fromSession.length > 10){ window._geminiKeyCached = fromSession; return; }
}
function ocrModGetDriveToken(){
  return window._ocrDriveTokenCached
    || localStorage.getItem('lex-drive-token')
    || localStorage.getItem('lex-ocr-drive-token')
    || localStorage.getItem('drive_token')
    || localStorage.getItem('ocr-drive-token')
    || (()=>{ try{ const c=JSON.parse(localStorage.getItem('lex-ocr-cfg')||'{}'); return c.dtoken||''; }catch(e){return '';} })()
    || '';
}
// ─── Cargar toda la config OCR desde Supabase ──────────────────────────────
async function _cargarConfigOCRDesdeSupabase(){
  if(!window.SB) return;
  try{
    const { data: sd } = await window.SB.auth.getSession();
    if(!sd?.session) return;
    const ids = ['drive_token','ocr_prof','ocr_extra'];
    const { data, error } = await window.SB.from('configuracion').select('id,valor').in('id', ids);
    if(error || !data) return;
    data.forEach(row => {
      if(!row.valor) return;
      const v = row.valor.trim();
      switch(row.id){
        case 'drive_token':
          if(v.length > 10){
            window._ocrDriveTokenCached = v;
            try{ localStorage.setItem('lex-drive-token', v); }catch(_){}
            try{ localStorage.setItem('lex-ocr-drive-token', v); }catch(_){}
            console.log('[Config] ✅ Drive token cargado desde Supabase');
          }
          break;
        case 'ocr_prof':
          try{ localStorage.setItem('lex-ocr-prof', v); }catch(_){}
          break;
        case 'ocr_extra':
          try{ localStorage.setItem('lex-ocr-extra', v); }catch(_){}
          break;
      }
    });
  }catch(e){ console.warn('[Config] Error cargando config OCR desde Supabase:', e.message); }
}
// Ejecutar al iniciar (con reintentos hasta que haya sesión)
(function _intentarCargarConfigOCR(intento){
  if(intento > 10) return;
  setTimeout(async function(){
    if(!window.SB){ _intentarCargarConfigOCR(intento + 1); return; }
    try{
      const { data } = await window.SB.auth.getSession();
      if(!data?.session){ _intentarCargarConfigOCR(intento + 1); return; }
      await _cargarConfigOCRDesdeSupabase();
    }catch(e){ _intentarCargarConfigOCR(intento + 1); }
  }, intento === 1 ? 2000 : 2500 * intento);
})(1);
function ocrModGetFolder(){
  return localStorage.getItem('lex-ocr-folder')
    || (()=>{ try{ return JSON.parse(localStorage.getItem('lex-ocr-cfg')||'{}').folder||''; }catch(e){return '';} })()
    || '1jgwqgCv0OAD9NBDimlY6L-9bfCktqyz0';
}
function ocrModGetProf(){
  return localStorage.getItem('lex-ocr-prof')
    || localStorage.getItem('lex-ocr-cfg') && (() => { try { return JSON.parse(localStorage.getItem('lex-ocr-cfg')).prof || 'detallado'; } catch(e){ return 'detallado'; } })()
    || 'detallado';
}
function ocrModGetExtra(){
  return localStorage.getItem('lex-ocr-extra')
    || localStorage.getItem('lex-ocr-cfg') && (() => { try { return JSON.parse(localStorage.getItem('lex-ocr-cfg')).extra || ''; } catch(e){ return ''; } })()
    || '';
}
// ─── Tabs del módulo OCR ──────────────────────────────────────────────
function ocrModTab(tab, el){
  // Mostrar botón de conectar Drive si no hay refresh token
  if(tab === 'drive'){
    const hasRefresh = !!localStorage.getItem('lex-drive-refresh-token');
    const hasManual  = !!ocrModGetDriveToken();
    const connectBtn = document.getElementById('ocr-drive-connect-btn');
    if(connectBtn) connectBtn.style.display = (!hasRefresh && !hasManual) ? 'block' : 'none';
  }
  // Cargar refresh token de Supabase si no está en localStorage
  if(tab === 'drive' && !localStorage.getItem('lex-drive-refresh-token') && window.SB){
    window.SB.from('configuracion').select('valor').eq('id','drive_refresh_token').single()
      .then(({data,error}) => {
        if(!error && data && data.valor){
          try{ localStorage.setItem('lex-drive-refresh-token', data.valor); } catch(e){ registrarError('localStorage.setItem', e); }
ocrModActualizarDrive();
        }
      }).catch((e)=>{ registrarError('Promise catch vacio', e); });
  }
  // Actualizar estilo de los botones
  const btnSubir = document.getElementById('ocr-btn-subir');
  const btnDrive = document.getElementById('ocr-btn-drive');
  if(btnSubir && btnDrive){
    const activeStyle  = 'border:1.5px solid var(--gold);background:rgba(200,149,42,0.15);color:var(--gold-l);';
    const inactiveStyle= 'border:1.5px solid rgba(200,149,42,0.25);background:rgba(200,149,42,0.05);color:rgba(200,149,42,0.6);';
    btnSubir.style.cssText = btnSubir.style.cssText.replace(/border:[^;]+;|background:[^;]+;|color:[^;]+;/g,'') + (tab==='subir'?activeStyle:inactiveStyle);
    btnDrive.style.cssText = btnDrive.style.cssText.replace(/border:[^;]+;|background:[^;]+;|color:[^;]+;/g,'') + (tab==='drive'?activeStyle:inactiveStyle);
    // Forma más limpia: setear directamente
    if(tab==='subir'){
      btnSubir.style.border='1.5px solid var(--gold)';btnSubir.style.background='rgba(200,149,42,0.15)';btnSubir.style.color='var(--gold-l)';
      btnDrive.style.border='1.5px solid rgba(200,149,42,0.25)';btnDrive.style.background='rgba(200,149,42,0.05)';btnDrive.style.color='rgba(200,149,42,0.6)';
    } else {
      btnDrive.style.border='1.5px solid var(--gold)';btnDrive.style.background='rgba(200,149,42,0.15)';btnDrive.style.color='var(--gold-l)';
      btnSubir.style.border='1.5px solid rgba(200,149,42,0.25)';btnSubir.style.background='rgba(200,149,42,0.05)';btnSubir.style.color='rgba(200,149,42,0.6)';
    }
  }
  document.getElementById('ocr-tab-subir').classList.toggle('hidden', tab !== 'subir');
  document.getElementById('ocr-tab-drive').classList.toggle('hidden', tab !== 'drive');
  document.getElementById('ocr-result').style.display = 'none';
  if(tab === 'drive') ocrModActualizarDrive();
}
// ─── Estado Drive ────────────────────────────────────────────────────
async function ocrModActualizarDrive(){
  const el  = document.getElementById('ocr-dst');
  const txt = document.getElementById('ocr-dst-txt');
  if(!el) return;
  let refresh = localStorage.getItem('lex-drive-refresh-token');
  // Si no hay en localStorage, buscar en Supabase
  if(!refresh && window.SB){
    try{
      const {data, error} = await window.SB.from('configuracion').select('valor').eq('id','drive_refresh_token').single();
      if(!error && data && data.valor){
        refresh = data.valor;
        try{ localStorage.setItem('lex-drive-refresh-token', refresh); } catch(e){ registrarError('localStorage.setItem', e); }
}
    }catch(e){ registrarError('catch vacio', e); }
  }
  const manual  = ocrModGetDriveToken();
  if(refresh){
    el.className = 'ocr-drive-st on';
    txt.textContent = '✅ Drive conectado permanentemente · Carpeta JUICIOS lista';
  } else if(manual){
    el.className = 'ocr-drive-st on';
    txt.innerHTML = '🔑 Token manual activo · <span style="cursor:pointer;text-decoration:underline;color:var(--gold-d);" onclick="driveIniciarOAuth()">Conectar permanente ⚡</span>';
  } else {
    el.className = 'ocr-drive-st off';
    txt.innerHTML = 'Sin conexión · <button onclick="driveIniciarOAuth()" style="background:linear-gradient(135deg,var(--gold),var(--gold-d));color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:0.68rem;font-weight:600;cursor:pointer;margin-left:6px;">⚡ Conectar Drive</button>';
  }
}
// ─── Drag & Drop ─────────────────────────────────────────────────────
function ocrDov(e){ e.preventDefault(); document.getElementById('ocr-uz').classList.add('drag-over'); }
function ocrDlv(){ document.getElementById('ocr-uz').classList.remove('drag-over'); }
function ocrDdr(e){ e.preventDefault(); ocrDlv(); ocrFilesIn(e.dataTransfer.files); }
// ─── Archivos locales ─────────────────────────────────────────────────
function ocrFilesIn(files){
  [...files].forEach(f => {
    if(!ocrModArchivos.find(a => a.name===f.name && a.size===f.size)) ocrModArchivos.push(f);
  });
  ocrRenderPrevs();
}
function ocrRenderPrevs(){
  const g = document.getElementById('ocr-pg');
  if(!g) return;
  g.innerHTML = '';
  ocrModArchivos.forEach((f, i) => {
    const d = document.createElement('div');
    d.className = 'ocr-prev-item';
    const ext3 = (f.name||'').split('.').pop().toLowerCase();
    if(f.type.startsWith('image/')){
      d.innerHTML = '<img src="'+URL.createObjectURL(f)+'" alt="'+f.name+'">';
    } else if(['docx','doc'].includes(ext3)){
      d.innerHTML = '<div class="ocr-prev-pdf">📝</div>';
    } else if(['xlsx','xls'].includes(ext3)){
      d.innerHTML = '<div class="ocr-prev-pdf">📊</div>';
    } else {
      d.innerHTML = '<div class="ocr-prev-pdf">📄</div>';
    }
    d.innerHTML += '<div class="ocr-prev-name">'+f.name+'</div>'
      +'<button class="ocr-prev-rm" onclick="ocrQuitarFile('+i+')">✕</button>';
    g.appendChild(d);
  });
}
function ocrQuitarFile(i){ ocrModArchivos.splice(i,1); ocrRenderPrevs(); }
// ─── Chips ────────────────────────────────────────────────────────────
function ocrSelChip(el, tipo, containerId){
  document.querySelectorAll('#'+containerId+' .ocr-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  if(containerId === 'ocr-chips-s') ocrModTipoS = tipo;
  else ocrModTipoD = tipo;
}
// ─── Conversión a base64 ──────────────────────────────────────────────
// ─── Mime type válido para Gemini ─────────────────────────────────────
function ocrGetMime(fileOrBlob){
  const t = fileOrBlob.type || '';
  if(t === 'application/pdf') return 'application/pdf';
  if(['image/jpeg','image/png','image/webp','image/heic'].includes(t)) return t;
  if(t.startsWith('image/')) return 'image/jpeg';
  const ext = (fileOrBlob.name || '').split('.').pop().toLowerCase();
  const map = {pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic'};
  return map[ext] || 'image/jpeg';
}
// ─── Progreso ─────────────────────────────────────────────────────────
function ocrSetProg(wrapId, show, label, stepId){
  const w = document.getElementById(wrapId);
  if(!w) return;
  if(show){ w.classList.add('show'); } else { w.classList.remove('show'); }
  const lbl = document.getElementById(wrapId === 'ocr-pw-s' ? 'ocr-pl-s' : 'ocr-pl-d');
  if(lbl && label) lbl.textContent = label;
  if(stepId){ const s = document.getElementById(stepId); if(s) s.classList.add('act'); }
}
function ocrDoneStep(id){
  if(!id) return;
  const el = document.getElementById(id);
  if(el){ el.classList.remove('act'); el.classList.add('done'); }
}
function ocrResetProg(wrapId){
  const w = document.getElementById(wrapId);
  if(!w) return;
  w.classList.remove('show');
  w.querySelectorAll('.ocr-step').forEach(s => s.classList.remove('act','done'));
}
// ─── Prompt legal ─────────────────────────────────────────────────────
function ocrBuildPrompt(tipo){
  const extra = ocrModGetExtra();
  const j = D && D.juicios && D.juicios[jdetIdx];
  const ctx = j ? ('Juicio: '+(j.tipo||'')+' · Exp. '+(j.expediente||'')+' · Cliente: '+(j.cliente||j.nombre||'')) : '';
  return 'ACTUA COMO UN ANALISTA JURIDICO ESPECIALIZADO EN ACUERDOS JUDICIALES EN MEXICO.'
    + (ctx ? '\nCONTEXTO DEL EXPEDIENTE: '+ctx : '')
    + '\n\nAnaliza el documento adjunto (PDF, imagen o acuerdo escaneado).'
    + '\nAplica OCR completo para leer TODO el contenido.'
    + '\n\nINSTRUCCIONES:'
    + '\n- Explica que ocurrio en el acuerdo.'
    + '\n- Indica que ordeno el juez.'
    + '\n- Menciona fechas y plazos importantes.'
    + '\n- Usa lenguaje juridico simple y entendible.'
    + '\n- El resumen debe ser COMPLETO Y DETALLADO, no corto.'
    + '\n- No inventes informacion. Si un dato no consta escribe: No consta en el documento'
    + '\n\nExtrae los siguientes campos:'
    + '\n- Numero de expediente'
    + '\n- Juzgado o tribunal completo'
    + '\n- Fecha de resolucion'
    + '\n- Fecha en que causo ejecutoria'
    + '\n- Tipo de juicio'
    + '\n- Parte actora (nombre completo)'
    + '\n- Parte demandada (nombre completo)'
    + '\n- Hijos o menores (si aplica)'
    + '\n- Pension alimenticia mensual (si aplica)'
    + '\n- Compensacion o pago unico (si aplica)'
    + '\n- Fecha limite de pagos importantes'
    + '\n- Nombre y cargo del juzgador/a'
    + '\n\nFormato EXACTO de respuesta en espanol:'
    + '\n\n📌 TITULO DEL ACUERDO: [tipo de resolucion]'
    + '\n📋 EXPEDIENTE: [numero]'
    + '\n🏛 JUZGADO / TRIBUNAL: [nombre completo]'
    + '\n⚖ TIPO DE JUICIO: [tipo]'
    + '\n📅 FECHA DE RESOLUCION: [fecha]'
    + '\n📅 FECHA EJECUTORIA: [fecha o No consta]'
    + '\n👤 ACTOR: [nombre]'
    + '\n👤 DEMANDADO: [nombre]'
    + '\n👨 JUZGADOR/A: [nombre y cargo]'
    + '\n\nRESUMEN EJECUTIVO:'
    + '\n[3 a 5 parrafos completos — que ocurrio, que se resolvio, que ordeno el juez]'
    + '\n\nPUNTOS IMPORTANTES:'
    + '\n- [punto 1 — lo mas relevante]'
    + '\n- [punto 2]'
    + '\n- [incluye TODOS los puntos necesarios]'
    + '\n\nPLAZOS Y FECHAS CLAVE:'
    + '\n[lista detallada, o: No constan plazos]'
    + '\n\nOBSERVACIONES PARA EL ABOGADO:'
    + '\n[acciones concretas que el abogado debe atender]'
    + (extra ? '\n\nINSTRUCCIONES ADICIONALES DEL DESPACHO:\n'+extra : '')
    + '\n\nTono estrictamente profesional. NO truncar ni resumir en exceso.';
}
// ─── Llamar a Gemini API ──────────────────────────────────────────────
// FIX: flag para evitar llamadas concurrentes a Gemini que generan 429 en cascada
let _geminiEnCurso = false;
let _geminiCooldownHasta = 0;
// ══════════════════════════════════════════════════════════════════════
// MISTRAL OCR — extracción de texto especializada
// API gratuita: console.mistral.ai → API Keys
// Soporta PDFs e imágenes directamente, devuelve markdown estructurado
// Mucho más simple que PDF.js + Tesseract, misma calidad o mejor
// ══════════════════════════════════════════════════════════════════════
window._mistralKeyCached = window._mistralKeyCached || '';
function _mistralGetKey(){
  return window._mistralKeyCached
    || _secretSessionGet('lex-mistral-key')
    || (document.getElementById('cfg-mistral-key')?.value || '').trim()
    || '';
}
function geminiGuardarKey(){
  const inp = document.getElementById('cfg-gemini-key');
  const st  = document.getElementById('cfg-gemini-st');
  const k   = (inp?.value || '').trim();
  if(!k){ if(st){ st.textContent='⚠ Ingresa una API Key'; st.style.color='var(--rojo)'; } return; }
  window._geminiKeyCached = k;
  _secretSessionSet('lex-gemini-key', k);
  if(st){ st.textContent='✅ Activa durante esta sesión'; st.style.color='var(--verde)'; }
  if(typeof toast==='function') toast('🔑 Gemini activo durante esta sesión','ok');
}
async function geminiTestKey(){
  const inp = document.getElementById('cfg-gemini-key');
  const st  = document.getElementById('cfg-gemini-st');
  const k   = (inp?.value || '').trim() || window._geminiKeyCached || _secretSessionGet('lex-gemini-key') || '';
  if(!k){ if(st){ st.textContent='⚠ Ingresa una API Key'; st.style.color='var(--rojo)'; } return; }
  if(st){ st.textContent='🔄 Probando...'; st.style.color='var(--muted)'; }
  try{
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + k, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents:[{ parts:[{ text:'Responde solo "OK".' }] }] }),
      signal: AbortSignal.timeout(15000)
    });
    if(resp.ok){
      if(st){ st.textContent='✅ Key válida'; st.style.color='var(--verde)'; }
    } else {
      const err = await resp.json().catch(()=>({}));
      const msg = err?.error?.message || ('HTTP ' + resp.status);
      if(st){ st.textContent='❌ ' + msg; st.style.color='var(--rojo)'; }
    }
  }catch(e){
    if(st){ st.textContent='❌ ' + e.message; st.style.color='var(--rojo)'; }
  }
}
function mistralGuardarKey(){
  const inp = document.getElementById('cfg-mistral-key');
  const st  = document.getElementById('cfg-mistral-st');
  const k   = (inp?.value || '').trim();
  if(!k){ if(st){ st.textContent='⚠ Ingresa una API Key'; st.style.color='var(--rojo)'; } return; }
  _mistralSaveKey(k);
  if(st){ st.textContent='✅ Activa durante esta sesión'; st.style.color='var(--verde)'; }
}
function _mistralSaveKey(k){
  k = k.trim();
  if(!k) return;
  _secretSessionSet('lex-mistral-key', k);
  window._mistralKeyCached = k;
  if(typeof toast==='function') toast('📄 Mistral OCR activo durante esta sesión','ok');
}
async function _cargarMistralKey(){
  const fromSession = _secretSessionGet('lex-mistral-key');
  if(fromSession.length > 10) window._mistralKeyCached = fromSession;
}
async function mistralTestKey(){
  const inp = document.getElementById('cfg-mistral-key');
  const st  = document.getElementById('cfg-mistral-st');
  const k   = (inp?.value || '').trim() || _mistralGetKey();
  if(!k){ if(st){ st.textContent='⚠ Ingresa una API Key'; st.style.color='var(--rojo)'; } return; }
  if(st){ st.textContent='🔄 Probando...'; st.style.color='var(--muted)'; }
  try{
    const resp = await fetch('https://api.mistral.ai/v1/models', {
      headers: { Authorization: 'Bearer ' + k }
    });
    if(resp.ok){
      _mistralSaveKey(k);
      if(st){ st.textContent='✓ Conexión exitosa — activa en esta sesión'; st.style.color='var(--verde)'; }
    } else {
      const e = await resp.json().catch(()=>({}));
      if(st){ st.textContent='❌ '+(e?.message||'Error '+resp.status); st.style.color='var(--rojo)'; }
    }
  }catch(e){
    if(st){ st.textContent='❌ '+e.message; st.style.color='var(--rojo)'; }
  }
}
// ── Llamada principal a Mistral OCR ──────────────────────────────────
// file: File | Blob con el documento
// Devuelve { texto, metodo:'mistral' } o null si no hay key
// ESTRATEGIA: subir primero a Files API de Mistral y usar signed_url
// (más confiable que base64 inline — evita truncado silencioso en PDFs grandes)
async function _mistralOCR(file, onProgreso){
  const key = _mistralGetKey();
  if(!key || key.length < 10) return null;
  // Si Mistral ya rechazó una subida por falta de saldo (HTTP 402 — cupo de
  // prueba agotado, requiere agregar método de pago en su cuenta), reintentar
  // en CADA documento solo hace perder tiempo (cada intento espera la
  // respuesta o el timeout antes de caer a PDF.js/Tesseract). Se recuerda por
  // 15 minutos y se salta Mistral directo mientras tanto.
  if (window._mistralSuspendidoHasta && Date.now() < window._mistralSuspendidoHasta) {
    return null;
  }
  const mime  = ocrMime(file);
  const isPDF = mime === 'application/pdf';
  onProgreso && onProgreso('📤 Subiendo archivo a Mistral...');
  try{
    // ── PASO 1: Subir a Files API ────────────────────────────────────
    const formData = new FormData();
    // Asegurar nombre de archivo con extensión correcta
    const filename = file.name || (isPDF ? 'documento.pdf' : 'imagen.jpg');
    formData.append('file', new File([file], filename, { type: mime }));
    formData.append('purpose', 'ocr');
    // Sin timeout, un archivo grande (ej. una ley de varios MB) o una
    // conexión lenta podía dejar el fetch colgado indefinidamente — el
    // usuario se quedaba viendo "Subiendo archivo a Mistral..." para
    // siempre. Con AbortSignal.timeout, si tarda demasiado se corta y el
    // resto de la cadena de _ocrExtraerTexto (PDF.js, Tesseract) sigue
    // intentando en vez de quedarse trabado.
    const uploadResp = await fetch('https://api.mistral.ai/v1/files', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key },
      body: formData,
      signal: AbortSignal.timeout(90000)
    });
    if(!uploadResp.ok){
      const err = await uploadResp.json().catch(()=>({}));
      console.warn('[Mistral OCR] Error subiendo archivo:', uploadResp.status, err?.message||'');
      if(uploadResp.status === 402){
        // Sin crédito en Mistral (cupo de prueba agotado) — evitar seguir
        // intentando en cada documento durante los próximos 15 min.
        window._mistralSuspendidoHasta = Date.now() + 15*60*1000;
        console.warn('[Mistral OCR] Cuenta sin crédito (402) — se salta Mistral por 15 min y se usa PDF.js/Tesseract directo.');
        return null;
      }
      // Fallback a base64 inline para archivos pequeños (<4MB)
      if(file.size < 4 * 1024 * 1024){
        return await _mistralOCRBase64Fallback(file, key, mime, isPDF, onProgreso);
      }
      return null;
    }
    const uploadData = await uploadResp.json();
    const fileId = uploadData.id;
    if(!fileId){ console.warn('[Mistral OCR] No se obtuvo file_id'); return null; }
    // ── PASO 2: Obtener signed URL del archivo ───────────────────────
    onProgreso && onProgreso('🔗 Obteniendo URL del documento...');
    const urlResp = await fetch(`https://api.mistral.ai/v1/files/${fileId}/url?expiry=1`, {
      headers: { Authorization: 'Bearer ' + key },
      signal: AbortSignal.timeout(15000)
    });
    let documentRef;
    if(urlResp.ok){
      const urlData = await urlResp.json();
      const signedUrl = urlData.url || urlData.signed_url || '';
      if(signedUrl){
        documentRef = isPDF
          ? { type: 'document_url', document_url: signedUrl }
          : { type: 'image_url',    image_url:    signedUrl };
      }
    }
    // Si no hay URL firmada, usar document_url con referencia de archivo
    if(!documentRef){
      documentRef = isPDF
        ? { type: 'document_url', document_url: `https://api.mistral.ai/v1/files/${fileId}/content` }
        : { type: 'image_url',    image_url:    `https://api.mistral.ai/v1/files/${fileId}/content` };
    }
    // ── PASO 3: Llamar a OCR con la URL ─────────────────────────────
    onProgreso && onProgreso('📄 Mistral OCR procesando el documento completo...');
    const ocrResp = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: 'mistral-ocr-latest',
        document: documentRef
      }),
      signal: AbortSignal.timeout(150000) // documentos largos (leyes de muchas páginas) tardan
    });
    // Limpiar el archivo de Mistral Files API (async, no bloqueante)
    fetch(`https://api.mistral.ai/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + key }
    }).catch(()=>{});
    if(!ocrResp.ok){
      const err = await ocrResp.json().catch(()=>({}));
      console.warn('[Mistral OCR] HTTP', ocrResp.status, err?.message||'');
      return null;
    }
    const data  = await ocrResp.json();
    const pages = data.pages || [];
    const texto = pages.map(p => p.markdown || '').join('\n\n').trim();
    if(texto.length > 50){
      console.log(`[Mistral OCR] ✅ ${pages.length} páginas, ${texto.length} chars extraídos`);
      onProgreso && onProgreso(`✅ ${pages.length} páginas procesadas`);
      return { texto, metodo: 'mistral' };
    }
    return null;
  }catch(e){
    console.warn('[Mistral OCR] Error:', e.message);
    // Último recurso: base64 inline para archivos pequeños
    if(file.size < 4 * 1024 * 1024){
      return await _mistralOCRBase64Fallback(file, key, mime, isPDF, onProgreso);
    }
    return null;
  }
}
// Fallback: base64 inline para archivos pequeños (comportamiento anterior)
async function _mistralOCRBase64Fallback(file, key, mime, isPDF, onProgreso){
  try{
    onProgreso && onProgreso('📄 Mistral OCR (modo directo)...');
    const b64  = await ocrToB64(file);
    const body = {
      model: 'mistral-ocr-latest',
      document: isPDF
        ? { type: 'document_url', document_url: `data:application/pdf;base64,${b64}` }
        : { type: 'image_url',    image_url:    `data:${mime};base64,${b64}` }
    };
    const resp = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(150000)
    });
    if(!resp.ok){
      if(resp.status === 402){
        window._mistralSuspendidoHasta = Date.now() + 15*60*1000;
        console.warn('[Mistral OCR fallback] Cuenta sin crédito (402) — se salta Mistral por 15 min.');
      }
      return null;
    }
    const data  = await resp.json();
    const texto = (data.pages || []).map(p => p.markdown || '').join('\n\n').trim();
    if(texto.length > 50){
      console.log('[Mistral OCR fallback] ✅', texto.length, 'chars');
      return { texto, metodo: 'mistral' };
    }
    return null;
  }catch(e){ console.warn('[Mistral OCR fallback]', e.message); return null; }
}
// ══════════════════════════════════════════════════════════════════════
// GEMINI OCR — lector de documentos (PDF/imágenes), cuenta de PAGO
// Reactivado a solicitud del despacho. En esta copia segura la key solo se
// conserva durante la sesión de la pestaña. IMPORTANTE: usar solo con key
// de nivel de PAGO
// (console de Google con facturación activa) — el nivel gratuito permite a
// Google usar el contenido enviado para entrenar modelos, lo cual no es
// aceptable para documentos confidenciales de clientes.
// ══════════════════════════════════════════════════════════════════════
async function _geminiOCR(file, onProgreso){
  const key = typeof ocrModGetKey === 'function' ? ocrModGetKey() : '';
  if(!key || key.length < 10) return null;
  try{
    onProgreso && onProgreso('📄 Leyendo documento con Gemini...');
    const mime = ocrMime(file);
    const b64  = await ocrToB64(file);
    const body = {
      contents: [{
        parts: [
          { inlineData: { mimeType: mime, data: b64 } },
          { text: 'Extrae y transcribe TODO el texto de este documento tal cual aparece, sin resumir, sin traducir y sin omitir nada. Si es un documento legal/judicial, conserva números de expediente, fechas, nombres y artículos citados exactamente como aparecen. Devuelve únicamente el texto transcrito, sin comentarios adicionales.' }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 32768 }
    };
    const resp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90000)
      }
    );
    if(!resp.ok){
      const err = await resp.json().catch(()=>({}));
      console.warn('[Gemini OCR] Error:', resp.status, err?.error?.message||'');
      return null;
    }
    const data  = await resp.json();
    const texto = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '').join('\n').trim();
    if(texto.length > 50){
      console.log('[Gemini OCR] ✅', texto.length, 'chars');
      return { texto, metodo: 'gemini' };
    }
    return null;
  }catch(e){ console.warn('[Gemini OCR]', e.message); return null; }
}
// ── Gemini — generación de texto/JSON (no OCR) ──────────────────────────
// Usado para tareas grandes y estructuradas (ej. Generar Flujo con ley
// completa) donde Groq se queda sin presupuesto de tokens y Cloudflare
// tiene un cupo diario limitado. Requiere key de pago ya guardada.
// Lanza (throw) en vez de devolver null para que el llamador pueda decidir
// si hace fallback a otro motor.
async function _geminiGenerarTexto(prompt, maxTokens, temperatura){
  const key = typeof ocrModGetKey === 'function' ? ocrModGetKey() : '';
  if(!key || key.length < 10) throw new Error('GEMINI_SIN_KEY: no hay API Key de Gemini configurada');
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: (temperatura==null ? 0.3 : temperatura), maxOutputTokens: maxTokens || 8192 }
  };
  const resp = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000)
    }
  );
  if(!resp.ok){
    const err = await resp.json().catch(()=>({}));
    throw new Error('GEMINI_ERROR: ' + (err?.error?.message || ('HTTP '+resp.status)));
  }
  const data = await resp.json();
  const cand = data.candidates && data.candidates[0];
  if(cand && cand.finishReason === 'MAX_TOKENS'){
    console.warn('[Gemini] Respuesta cortada por MAX_TOKENS — considera subir maxOutputTokens.');
  }
  const texto = ((cand && cand.content && cand.content.parts) || []).map(function(p){ return p.text || ''; }).join('\n').trim();
  if(!texto) throw new Error('GEMINI_SIN_RESPUESTA: la IA no devolvió texto');
  return texto;
}
// ══════════════════════════════════════════════════════════════════════
// EXTRACTOR LOCAL DE TEXTO — PDF.js + Tesseract.js
// Extrae texto ANTES de llamar a cualquier IA.
// - PDFs con texto: PDF.js (instantáneo, sin API)
// - Imágenes / PDFs escaneados: Tesseract.js (OCR local en browser)
// ══════════════════════════════════════════════════════════════════════
// Configurar worker de PDF.js cuando esté disponible
function _ocrConfigurarPDFjs() {
  if (typeof pdfjsLib !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
}
// ── Convierte la primera página de un PDF a imagen PNG (base64) ─────────
// Necesario porque los modelos de visión de Cloudflare Workers AI reciben
// bytes de IMAGEN, no un PDF completo como sí aceptaba Gemini directamente.
async function _pdfPrimeraPaginaB64(file){
  _ocrConfigurarPDFjs();
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js no disponible');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pg  = await pdf.getPage(1);
  const vp  = pg.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  canvas.width = vp.width; canvas.height = vp.height;
  await pg.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1];
}
// ── Extractor principal ───────────────────────────────────────────────
// Cadena de extracción:
//   1. Gemini OCR (si hay key de pago) — máxima calidad, PDF/imágenes directo
//   2. Mistral OCR (si hay key y crédito) — respaldo
//   3. PDF.js (PDFs con texto) — gratis, instantáneo
//   4. Tesseract.js (imágenes/PDFs escaneados) — gratis, local
// Devuelve { texto, metodo } o null
async function _ocrExtraerTexto(file, onProgreso) {
  // CAPA 0: Archivos Office (.docx/.xlsx/.doc/.xls) — extracción local (mammoth/xlsx)
  const resOffice = await _ocrExtraerOffice(file, onProgreso);
  if (resOffice) return resOffice;
  // CAPA 1: Gemini OCR (cuenta de pago — mejor calidad, lee PDF/imágenes directo)
  const resGemini = await _geminiOCR(file, onProgreso);
  if (resGemini) return resGemini;
  // CAPA 2: Mistral OCR (respaldo, si tiene key y crédito)
  const resMistral = await _mistralOCR(file, onProgreso);
  if (resMistral) return resMistral;
  const mime = ocrMime(file);
  const isPDF = mime === 'application/pdf';
  if (isPDF) {
    // INTENTO 1: PDF con capa de texto (más rápido, sin IA)
    try {
      onProgreso && onProgreso('📄 Leyendo PDF...');
      _ocrConfigurarPDFjs();
      if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js no disponible');
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
      let texto = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        onProgreso && onProgreso(`📄 Leyendo página ${i}/${pdf.numPages}...`);
        const pg  = await pdf.getPage(i);
        const tc  = await pg.getTextContent();
        texto += tc.items.map(it => it.str).join(' ') + '\n';
      }
      const textoLimpio = texto.trim();
      // Si tiene suficiente texto, usarlo directamente
      if (textoLimpio.length > 100) {
        return { texto: textoLimpio, metodo: 'pdf-texto' };
      }
      // PDF escaneado (poco o nada de texto) → caer a Tesseract
    } catch(e) {
      console.warn('[OCR-Local] PDF.js falló:', e.message);
    }
  }
  // INTENTO 2: OCR con Tesseract.js (imágenes o PDFs escaneados)
  try {
    if (typeof Tesseract === 'undefined') throw new Error('Tesseract.js no disponible');
    onProgreso && onProgreso('🔍 OCR local en progreso...');
    let imageBlob = file;
    // Si es PDF escaneado, convertir primera página a imagen con PDF.js + canvas
    if (isPDF) {
      try {
        _ocrConfigurarPDFjs();
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        const pg  = await pdf.getPage(1);
        const vp  = pg.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width  = vp.width;
        canvas.height = vp.height;
        await pg.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        imageBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      } catch(e) {
        console.warn('[OCR-Local] Conversión PDF→imagen falló:', e.message);
        return null; // No se pudo convertir, usar Gemini Vision
      }
    }
    const { data } = await Tesseract.recognize(imageBlob, 'spa', {
      logger: m => {
        if (m.status === 'recognizing text' && onProgreso) {
          onProgreso(`🔍 OCR: ${Math.round((m.progress || 0) * 100)}%`);
        }
      }
    });
    const textoLimpio = (data.text || '').trim();
    if (textoLimpio.length > 50) {
      return { texto: textoLimpio, metodo: 'tesseract' };
    }
  } catch(e) {
    console.warn('[OCR-Local] Tesseract falló:', e.message);
  }
  return null; // No se pudo extraer texto — usar Gemini Vision como último recurso
}

// ── Extractor ESPECÍFICO para leyes/códigos (Generar Flujo, grounding de
// ANÁLISIS IA) ──────────────────────────────────────────────────────────
// _ocrExtraerTexto() prueba Mistral OCR PRIMERO porque muchos de los
// documentos que lee (acuerdos, actas, recibos escaneados) son escaneos sin
// capa de texto — ahí Mistral es necesario. Pero las leyes/códigos que se
// cargan aquí son casi siempre PDFs oficiales de gobierno CON texto digital
// real, y mandarlos por Mistral primero implica 1-3 idas y vueltas de red
// (subir el archivo, pedir URL firmada, procesar OCR) que pueden tardar
// bastante con un documento grande — esto era precisamente el paso donde el
// usuario reportó que "se tardó muchísimo". Antes de que se agregara la
// lectura de leyes con Mistral, este mismo tipo de documento se leía solo
// con PDF.js (instantáneo, sin red) — por eso se sentía mucho más rápido.
// Aquí se restaura ese camino: PDF.js PRIMERO, y solo si el PDF resulta ser
// un escaneo (poco o nada de texto extraíble) se cae a la cadena completa
// de _ocrExtraerTexto (Mistral, Tesseract...).
async function _leyExtraerTexto(file, onProgreso) {
  const mime = ocrMime(file);
  if (mime === 'application/pdf') {
    try {
      onProgreso && onProgreso('📄 Leyendo el PDF de la ley…');
      _ocrConfigurarPDFjs();
      if (typeof pdfjsLib !== 'undefined') {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
        let texto = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          onProgreso && onProgreso(`📄 Leyendo página ${i}/${pdf.numPages}…`);
          const pg = await pdf.getPage(i);
          const tc = await pg.getTextContent();
          texto += tc.items.map(it => it.str).join(' ') + '\n';
        }
        const textoLimpio = texto.trim();
        // Un código/ley real trae miles de caracteres; se pide más margen
        // que el umbral genérico (100) para no aceptar como bueno el texto
        // suelto de una portada casi vacía.
        if (textoLimpio.length > 500) {
          return { texto: textoLimpio, metodo: 'pdf-texto' };
        }
      }
    } catch (e) {
      console.warn('[Ley] PDF.js falló, se intentará con OCR:', e.message);
    }
  }
  // Escaneo o formato no-PDF: usar la cadena completa (Mistral, Tesseract...)
  onProgreso && onProgreso('📄 El documento no trae texto digital — usando OCR…');
  return _ocrExtraerTexto(file, onProgreso);
}

// ── Construir prompt de texto para _iaLlamar ─────────────────────────
// ── Límites de contexto ────────────────────────────────────────────────
const _OCR_LIMITE_DIRECTO  = 16000;  // chars — un solo llamado a Groq (Groq free: 12,000 TPM)
const _OCR_CHUNK_SIZE      = 16000;  // chars por bloque en modo chunked
// Prompt para analizar UNA sección/bloque del documento
function _ocrPromptSeccion(texto, ctxJuicio, numSec, totalSec) {
  return `ACTÚA COMO UN ANALISTA JURÍDICO ESPECIALIZADO EN ACUERDOS JUDICIALES EN MÉXICO.
${ctxJuicio ? 'CONTEXTO DEL EXPEDIENTE: ' + ctxJuicio + '\n' : ''}
Estás analizando la SECCIÓN ${numSec} de ${totalSec} de un documento judicial extenso.
Extrae y lista TODOS los datos relevantes de esta sección sin omitir nada:
- Número de expediente, juzgado, fechas, partes, tipo de juicio
- Todo lo que el juez ordenó o resolvió
- Todos los plazos y fechas mencionados
- Cualquier dato que el abogado deba conocer
No hagas resumen final todavía. Solo extrae los datos clave en formato de lista clara.
TEXTO DE LA SECCIÓN ${numSec}/${totalSec}:
---
${texto}
---
Responde en español. Sé exhaustivo — es mejor incluir de más que omitir datos importantes.`;
}
// Prompt de síntesis final a partir de los resúmenes de cada sección
function _ocrPromptSintesis(resumenesSecciones, ctxJuicio, extra) {
  return `ACTÚA COMO UN ANALISTA JURÍDICO ESPECIALIZADO EN ACUERDOS JUDICIALES EN MÉXICO.
${ctxJuicio ? 'CONTEXTO DEL EXPEDIENTE: ' + ctxJuicio + '\n' : ''}
A continuación tienes el análisis de TODAS las secciones de un documento judicial extenso.
Sintetiza toda la información en un resumen final completo y coherente.
${resumenesSecciones.map((r,i) => `=== SECCIÓN ${i+1} ===\n${r}`).join('\n\n').slice(0, 16000)}
Redacta el resumen final en español con el siguiente formato EXACTO:
📌 TÍTULO DEL ACUERDO: [tipo de resolución — acuerdo, auto, sentencia, notificación, requerimiento, etc.]
📋 EXPEDIENTE: [número — si no consta: "No consta en el documento"]
🏛️ JUZGADO / TRIBUNAL: [nombre completo — si no consta: "No consta en el documento"]
⚖️ TIPO DE JUICIO: [tipo — si no consta: "No consta en el documento"]
📅 FECHA DE RESOLUCIÓN: [fecha — si no consta: "No consta en el documento"]
📅 FECHA EJECUTORIA: [fecha en que causó ejecutoria — si no consta: "No consta en el documento"]
👤 ACTOR: [nombre completo — si no consta: "No consta en el documento"]
👤 DEMANDADO: [nombre completo — si no consta: "No consta en el documento"]
👨‍👩‍👧 HIJOS / MENORES: [nombres y edades — si no aplica: "No aplica"]
💰 PENSIÓN ALIMENTICIA: [monto mensual — si no aplica: "No aplica"]
💵 COMPENSACIÓN O PAGO ÚNICO: [monto — si no aplica: "No aplica"]
📅 FECHA LÍMITE DE PAGOS: [fecha — si no aplica: "No aplica"]
👨 JUZGADOR/A: [nombre y cargo — si no consta: "No consta en el documento"]
RESUMEN EJECUTIVO:
[3 a 5 párrafos completos explicando qué ocurrió, qué se resolvió y qué ordenó el juez]
PUNTOS IMPORTANTES:
• [punto 1 — lo más relevante]
• [punto 2]
• [incluye TODOS los puntos necesarios, sin omitir nada]
⏰ PLAZOS Y FECHAS CLAVE:
[lista detallada de todos los plazos y fechas con su descripción, o "No constan plazos en el documento"]
⚠️ OBSERVACIONES PARA EL ABOGADO:
[acciones concretas que el abogado debe atender urgentemente]
${extra ? '\nINSTRUCCIONES ADICIONALES DEL DESPACHO:\n' + extra : ''}
Tono estrictamente profesional. NO truncar ni resumir en exceso. Incluye absolutamente toda la información relevante.`;
}
// Prompt unificado para documentos que caben en un solo llamado
function _ocrBuildPromptTexto(textoExtraido, ctxJuicio, extra) {
  return `ACTÚA COMO UN ANALISTA JURÍDICO ESPECIALIZADO EN ACUERDOS JUDICIALES EN MÉXICO.
${ctxJuicio ? 'CONTEXTO DEL EXPEDIENTE: ' + ctxJuicio + '\n' : ''}
El siguiente texto fue extraído COMPLETO del documento judicial mediante OCR:
---
${textoExtraido}
---
INSTRUCCIONES:
- Analiza TODO el documento sin omitir nada.
- Explica qué ocurrió en el acuerdo y qué ordenó el juez.
- Menciona TODAS las fechas, plazos, montos y obligaciones.
- Extrae datos de familia (hijos, pensión, compensación) si aplica.
- Usa lenguaje jurídico simple y entendible.
- No inventes información. Si un dato no consta, escribe "No consta en el documento".
Redacta el resumen en español con el siguiente formato EXACTO:
📌 TÍTULO DEL ACUERDO: [tipo de resolución — acuerdo, auto, sentencia, notificación, requerimiento, etc.]
📋 EXPEDIENTE: [número — si no consta: "No consta en el documento"]
🏛️ JUZGADO / TRIBUNAL: [nombre completo — si no consta: "No consta en el documento"]
⚖️ TIPO DE JUICIO: [tipo — si no consta: "No consta en el documento"]
📅 FECHA DE RESOLUCIÓN: [fecha — si no consta: "No consta en el documento"]
📅 FECHA EJECUTORIA: [fecha en que causó ejecutoria — si no consta: "No consta en el documento"]
👤 ACTOR: [nombre completo — si no consta: "No consta en el documento"]
👤 DEMANDADO: [nombre completo — si no consta: "No consta en el documento"]
👨‍👩‍👧 HIJOS / MENORES: [nombres y edades — si no aplica: "No aplica"]
💰 PENSIÓN ALIMENTICIA: [monto mensual — si no aplica: "No aplica"]
💵 COMPENSACIÓN O PAGO ÚNICO: [monto — si no aplica: "No aplica"]
📅 FECHA LÍMITE DE PAGOS: [fecha — si no aplica: "No aplica"]
👨 JUZGADOR/A: [nombre y cargo — si no consta: "No consta en el documento"]
RESUMEN EJECUTIVO:
[3 a 5 párrafos completos explicando qué ocurrió, qué se resolvió y qué ordenó el juez]
PUNTOS IMPORTANTES:
• [punto 1 — lo más relevante]
• [punto 2]
• [incluye TODOS los puntos necesarios, sin omitir nada]
⏰ PLAZOS Y FECHAS CLAVE:
[lista detallada de todos los plazos y fechas con su descripción, o "No constan plazos en el documento"]
⚠️ OBSERVACIONES PARA EL ABOGADO:
[acciones concretas que el abogado debe atender urgentemente]
${extra ? '\nINSTRUCCIONES ADICIONALES DEL DESPACHO:\n' + extra : ''}
Tono estrictamente profesional. NO truncar ni resumir en exceso. Incluye absolutamente toda la información relevante.`;
}
// ── Función central Opción C ───────────────────────────────────────────
// Si el texto cabe en _OCR_LIMITE_DIRECTO → un solo llamado (rápido)
// Si es más grande → análisis por secciones + síntesis final (completo)
async function _ocrAnalizarTexto(texto, ctxJuicio, extra, onProgreso) {
  if (texto.length <= _OCR_LIMITE_DIRECTO) {
    // ── RUTA A: documento normal → un solo llamado ──────────────────
    onProgreso && onProgreso('🧠 Analizando documento con IA...');
    const prompt = _ocrBuildPromptTexto(texto, ctxJuicio, extra);
    return await _iaLlamar(prompt, 3500, 0.1, 'analisis_documento');
  }
  // ── RUTA B: documento grande → análisis por secciones ──────────────
  const chunks = [];
  for (let i = 0; i < texto.length; i += _OCR_CHUNK_SIZE) {
    chunks.push(texto.slice(i, i + _OCR_CHUNK_SIZE));
  }
  const total = chunks.length;
  onProgreso && onProgreso(`📄 Documento extenso — analizando ${total} secciones...`);
  const resumenesSecciones = [];
  for (let i = 0; i < chunks.length; i++) {
    onProgreso && onProgreso(`🧠 Analizando sección ${i+1} de ${total}...`);
    const promptSec = _ocrPromptSeccion(chunks[i], ctxJuicio, i+1, total);
    const resumenSec = await _iaLlamar(promptSec, 1800, 0.1, 'analisis_documento');
    resumenesSecciones.push(resumenSec);
  }
  onProgreso && onProgreso(`✍️ Sintetizando ${total} secciones en resumen final...`);
  const promptFinal = _ocrPromptSintesis(resumenesSecciones, ctxJuicio, extra);
  return await _iaLlamar(promptFinal, 3500, 0.1, 'analisis_documento');
}
// Convierte un archivo (base64 + mime) a base64 de IMAGEN, listo para el
// modelo de visión de Cloudflare — si ya es imagen se usa tal cual; si es
// PDF, se renderiza su primera página a PNG.
async function _b64AImagenB64(b64, mime){
  if (mime && mime.startsWith('image/')) return b64;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const file = new File([bytes], 'documento', { type: mime || 'application/pdf' });
  return await _pdfPrimeraPaginaB64(file);
}
// Último recurso de OCR/análisis cuando Mistral OCR, PDF.js y Tesseract ya
// fallaron — antes lo hacía Gemini leyendo el PDF/imagen directo; ahora usa
// el modelo de visión de Cloudflare Workers AI (mismo cupo gratis de siempre).
async function ocrLlamarVisionIA(partes, prompt){
  if(!_cfaiGetAccountId() || !_cfaiGetToken()) throw new Error('SIN_KEY');
  // FIX: validar que partes no tenga b64 vacío antes de enviar
  const partesValidas = partes.filter(p => p && p.b64 && p.b64.length > 10 && p.mime);
  if(partes.length > 0 && partesValidas.length === 0){
    throw new Error('Los archivos seleccionados no pudieron leerse correctamente. Intenta de nuevo.');
  }
  const MAX_ARCHIVOS = 3; // límite razonable para no agotar el cupo gratis diario de un jalón
  const usados = partesValidas.slice(0, MAX_ARCHIVOS);
  const resultados = [];
  for (let i = 0; i < usados.length; i++){
    try {
      const imgB64 = await _b64AImagenB64(usados[i].b64, usados[i].mime);
      const texto = await _cfaiVision(imgB64, prompt, 2048, 'analisis_documento');
      resultados.push(usados.length > 1 ? `── Archivo ${i+1} ──\n${texto}` : texto);
    } catch(e){
      registrarError('OCR · visión Cloudflare', e, { archivo: i+1 });
      resultados.push(usados.length > 1 ? `── Archivo ${i+1}: no se pudo leer (${e.message}) ──` : '');
    }
  }
  const texto = resultados.join('\n\n').trim();
  if(!texto) throw new Error('La IA no devolvió contenido. El documento puede ser ilegible.');
  return texto;
}
// ─── Parsear JSON de Gemini ───────────────────────────────────────────
function ocrParsearJSON(raw){
  let txt = raw.trim();
  // Quitar bloques de código markdown
  txt = txt.replace(/^```json\s*/im,'').replace(/^```\s*/im,'').replace(/```\s*$/m,'');
  txt = txt.trim();
  // Extraer solo el JSON entre { }
  const first = txt.indexOf('{');
  const last  = txt.lastIndexOf('}');
  if(first !== -1 && last > first){
    txt = txt.slice(first, last+1);
  }
  // Intentar parsear
  try {
    return JSON.parse(txt);
  } catch(e1) {
    // Intentar reparar JSON con comillas rotas
    const fixed = txt
      .replace(/([\w\s]+):/g, (m, k) => {
        if(k.trim().startsWith('"')) return m;
        return '"'+k.trim()+'":';
      });
    return JSON.parse(fixed);
  }
}
function ocrFallback(raw, tipo){
  return { resumenEjecutivo: raw, numeroExpediente:'N/A', tribunal:'N/A', tipoJuicio:tipo,
    estadoProceso:'Ver resumen', actor:{nombre:'Ver resumen',representante:'N/A'},
    demandado:{nombre:'Ver resumen',representante:'N/A'}, hechosRelevantes:[], textOCR:'' };
}
// Parsear respuesta de texto libre de Gemini
function ocrTextoAResultado(raw, tipo){
  const txt = raw || '';
  const get = (pat) => {
    const m = txt.match(pat);
    return m ? m[1].trim() : 'N/A';
  };
  // Extraer campos del formato estructurado
  const expediente     = get(/📋 EXPEDIENTE:\s*(.+)/);
  const tribunal       = get(/🏛️ TRIBUNAL:\s*(.+)/);
  const juzgadoCity    = get(/📍 JUZGADO:\s*(.+)/);
  const juzgadoParts   = juzgadoCity.split('—');
  const juzgado        = (juzgadoParts[0]||'').trim();
  const ciudad         = (juzgadoParts[1]||'').trim();
  const materia        = get(/⚖️ MATERIA:\s*(.+)/);
  const actor          = get(/👤 ACTOR:\s*(.+)/);
  const demandado      = get(/👤 DEMANDADO:\s*(.+)/);
  const estado         = get(/📊 ESTADO:\s*(.+)/);
  const ultimaAct      = get(/📅 ÚLTIMA ACTUACIÓN:\s*(.+)/);
  const proxAud        = get(/📅 PRÓXIMA AUDIENCIA:\s*(.+)/);
  const montos         = get(/💰 MONTOS:\s*(.+)/);
  // Extraer resumen (texto entre RESUMEN: y PUNTOS CLAVE:)
  const resumenMatch = txt.match(/RESUMEN:\n([\s\S]*?)(?=PUNTOS CLAVE:|$)/);
  let resumen = resumenMatch ? resumenMatch[1].trim() : txt;
  // Limpiar texto introductorio que Gemini agrega antes del contenido
  resumen = resumen
    .replace(/^Aquí tienes el análisis[^\n]*\n*/i, '')
    .replace(/^A continuación[^\n]*\n*/i, '')
    .replace(/^Con base en[^\n]*\n*/i, '')
    .replace(/^El documento[^\n]*\n*/i, '')
    .trim();
  // Extraer puntos clave como hechos relevantes
  const puntosMatch = txt.match(/PUNTOS CLAVE:\n([\s\S]*?)$/);
  const hechosRaw = puntosMatch ? puntosMatch[1].trim() : '';
  const hechos = hechosRaw.split('\n')
    .filter(l => l.trim())
    .map(l => {
      const dateMatch = l.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2} de \w+ de \d{4})/i);
      return { fecha: dateMatch ? dateMatch[0] : '—', hecho: l.replace(/^[•\-\*]\s*/, '').trim() };
    });
  return {
    numeroExpediente: expediente,
    tribunal:         tribunal,
    juzgado:          juzgado,
    ciudad:           ciudad,
    tipoJuicio:       tipo,
    materia:          materia,
    estadoProceso:    estado,
    ultimaActuacion:  ultimaAct,
    proximaAudiencia: proxAud,
    montos:           montos,
    actor:            { nombre: actor,     representante: 'N/A' },
    demandado:        { nombre: demandado, representante: 'N/A' },
    prestaciones:     [],
    resumenEjecutivo: resumen || txt,
    hechosRelevantes: hechos,
    textOCR:          ''
  };
}
// ══════════════════════════════════════════════════════════════════════
// EXTRACTOR OFFICE — Word / Excel, 100% local
// Devuelve { texto, metodo:'office-local' } o null
// ══════════════════════════════════════════════════════════════════════
// Extrae el texto de archivos de Office DIRECTAMENTE en el navegador — sin
// IA, sin API, sin costo — leyendo el XML interno del archivo (.docx/.xlsx)
// con las mismas librerías que ya usa el visor de Word (mammoth.js) y su
// equivalente para Excel (SheetJS). Antes esto se lo mandábamos completo a
// Gemini para que lo "leyera"; ahora se extrae el texto real de forma exacta
// y gratuita, y ese texto pasa por el mismo Groq de siempre para analizarlo.
async function _cargarScriptCDN(url, globalCheck){
  if (typeof window[globalCheck] !== 'undefined') return;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + url));
    document.head.appendChild(s);
  });
}
async function _ocrExtraerOffice(file, onProgreso) {
  const ext = (file.name || '').split('.').pop().toLowerCase();
  if (!['docx','doc','xlsx','xls'].includes(ext)) return null;
  try {
    const buf = await file.arrayBuffer();
    if (ext === 'docx') {
      onProgreso && onProgreso('📂 Leyendo Word (.docx)...');
      await _cargarScriptCDN('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', 'mammoth');
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      const texto = (result && result.value || '').trim();
      if (texto.length > 20) {
        onProgreso && onProgreso('✅ Contenido Word extraído');
        return { texto, metodo: 'office-local' };
      }
      return null;
    }
    if (ext === 'xlsx' || ext === 'xls') {
      onProgreso && onProgreso('📂 Leyendo Excel...');
      await _cargarScriptCDN('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
      const wb = XLSX.read(buf, { type: 'array' });
      const partes = wb.SheetNames.map(nombre => {
        const hoja = wb.Sheets[nombre];
        const csv = XLSX.utils.sheet_to_csv(hoja);
        return `── Hoja: ${nombre} ──\n${csv}`;
      });
      const texto = partes.join('\n\n').trim();
      if (texto.length > 5) {
        onProgreso && onProgreso('✅ Contenido Excel extraído');
        return { texto, metodo: 'office-local' };
      }
      return null;
    }
    // .doc (formato binario antiguo) — mammoth solo soporta .docx (OOXML).
    // No hay forma gratuita confiable de leerlo en el navegador.
    console.warn('[OCR-Office] Formato .doc antiguo no soportado — conviértelo a .docx');
    return null;
  } catch(e) {
    console.warn('[OCR-Office] Error:', e.message);
    return null;
  }
}
// ─── ANALIZAR SUBIDOS ────────────────────────────────────────────────
async function ocrAnalizarSubidos(){
  if(ocrModArchivos.length === 0){ if(typeof toast==='function') toast('⚠ Sube al menos un archivo','err'); return; }
  document.getElementById('ocr-no-key')?.classList.remove('show');
  document.getElementById('ocr-result').style.display = 'none';
  ocrResetProg('ocr-pw-s');
  try {
    ocrSetProg('ocr-pw-s', true, 'Leyendo archivos...', 'ocr-s1');
    // ── INTENTO 1: Extracción local con PDF.js / Tesseract.js (sin API) ──
    const j = D.juicios && D.juicios[jdetIdx];
    const ctxJuicio = j ? `Juicio: ${j.tipo||''} — Expediente: ${j.expediente||j.num||''} — Cliente: ${j.nombre||j.cliente||''}` : '';
    const extra = ocrGetExtra();
    // Intentar extraer texto del primer archivo (el principal)
    const archivoP = ocrModArchivos[0];
    const extraccion = await _ocrExtraerTexto(archivoP, (msg) => {
      ocrSetProg('ocr-pw-s', true, msg, 'ocr-s1');
    });
    ocrDoneStep('ocr-s1');
    if (extraccion && extraccion.texto.length > 100) {
      // ✅ Texto extraído localmente — Opción C (directo o por secciones según tamaño)
      const metodoLabel = extraccion.metodo === 'pdf-texto' ? 'PDF.js (sin API)' : extraccion.metodo === 'mistral' ? 'Mistral OCR' : extraccion.metodo === 'office-local' ? 'Office (local, sin IA)' : 'Tesseract OCR';
      ocrSetProg('ocr-pw-s', true, `Texto extraído [${metodoLabel}]`, 'ocr-s2');
      ocrDoneStep('ocr-s2');
      ocrSetProg('ocr-pw-s', true, 'IA: análisis legal...', 'ocr-s3');
      const raw = await _ocrAnalizarTexto(extraccion.texto, ctxJuicio, extra, (msg) => {
        ocrSetProg('ocr-pw-s', true, msg, 'ocr-s3');
      });
      ocrDoneStep('ocr-s3');
      ocrSetProg('ocr-pw-s', true, 'Generando resumen...', 'ocr-s4');
      let resultado;
      try { resultado = ocrParsearJSON(raw); }
      catch(e){ resultado = ocrTextoAResultado(raw, ocrModTipoS); }
      // Guardar texto OCR en el resultado
      resultado.textOCR = extraccion.texto.substring(0, 3000);
      ocrDoneStep('ocr-s4');
      ocrModResultado = resultado;
      ocrMostrarResultado(resultado, ocrModArchivos.map(f=>f.name).join(', '));
      return; // Terminado sin gastar tokens de visión
    }
    // ── INTENTO 2 (respaldo): Cloudflare Vision — solo si la extracción local falló ──
    ocrSetProg('ocr-pw-s', true, 'Preparando para Cloudflare Workers AI...', 'ocr-s1');
    const partes = [];
    for(const f of ocrModArchivos){
      partes.push({ b64: await ocrToB64(f), mime: ocrGetMime(f) });
    }
    ocrDoneStep('ocr-s1');
    ocrSetProg('ocr-pw-s', true, 'Enviando a Cloudflare Workers AI...', 'ocr-s2');
    ocrDoneStep('ocr-s2');
    ocrSetProg('ocr-pw-s', true, 'Cloudflare: OCR + análisis legal...', 'ocr-s3');
    const raw = await ocrLlamarVisionIA(partes, ocrBuildPrompt(ocrModTipoS));
    ocrDoneStep('ocr-s3');
    ocrSetProg('ocr-pw-s', true, 'Generando resumen...', 'ocr-s4');
    let resultado;
    try { resultado = ocrParsearJSON(raw); }
    catch(e){ resultado = ocrTextoAResultado(raw, ocrModTipoS); }
    ocrDoneStep('ocr-s4');
    ocrModResultado = resultado;
    ocrMostrarResultado(resultado, ocrModArchivos.map(f=>f.name).join(', '));
  } catch(err){
    ocrResetProg('ocr-pw-s');
    if(err.message === 'SIN_KEY'){
      document.getElementById('ocr-no-key').classList.add('show');
    } else {
      if(typeof toast==='function') toast('❌ '+err.message, 'err');
    }
    console.error('[OCR-Subir]', err);
  }
}
// ─── GOOGLE DRIVE ────────────────────────────────────────────────────
// Carpeta fija de todos los juicios en Google Drive — ÚNICA fuente
const OCR_JUICIOS_FOLDER_ID = '1jgwqgCv0OAD9NBDimlY6L-9bfCktqyz0';
// ── OAuth2 para Drive con Refresh Token automático ────────────────
const DRIVE_CLIENT_ID     = '331190113413-cc7vvh3uujh06rnsmta20vlkidpt38i3.apps.googleusercontent.com';
const DRIVE_REDIRECT_URI  = window.LEX_PUBLIC_CONFIG.googleOAuthRedirectUri;
// El Client Secret de Google YA NO vive aquí — se movió al Worker de Cloudflare
// (endpoints /drive/refresh y /drive/exchange) para que nunca viaje al navegador.
// Obtener Access Token válido — renueva automáticamente si expiró
async function driveGetAccessToken(){
  // Siempre intentar renovar primero si el token guardado tiene más de 50 min
  const saved    = localStorage.getItem('lex-drive-token') || '';
  const savedAt  = parseInt(localStorage.getItem('lex-drive-token-saved-at') || '0');
  const age      = Date.now() - savedAt;
  const MAX_AGE  = 50 * 60 * 1000; // 50 minutos
  if(saved && age < MAX_AGE) return saved; // Token reciente, usarlo directo
  // Obtener Refresh Token: siempre desde Supabase (fuente de verdad)
  let refresh = '';
  if(window.SB){
    try{
      const {data, error} = await window.SB.from('configuracion').select('valor').eq('id','drive_refresh_token').single();
      if(!error && data && data.valor){
        refresh = data.valor;
        try{ localStorage.setItem('lex-drive-refresh-token', refresh); } catch(e){ registrarError('localStorage.setItem', e); }
console.log('[Drive] Refresh token cargado desde Supabase');
      }
    }catch(e){ console.warn('[Drive] No se pudo cargar refresh token de Supabase:', e.message); }
  }
  // Fallback a localStorage si Supabase no responde
  if(!refresh) refresh = localStorage.getItem('lex-drive-refresh-token') || '';
  if(!refresh) return saved || '';
  try{
    // El intercambio con Google ahora lo hace el Worker — el Client Secret
    // de Google ya no vive en el navegador, solo en Cloudflare (env secret).
    const resp = await fetch(R2_WORKER+'/drive/refresh', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Auth-Token': await _r2AuthToken()},
      body: JSON.stringify({
        client_id:     DRIVE_CLIENT_ID,
        refresh_token: refresh
      })
    });
    const data = await resp.json().catch(()=>({}));
    if(resp.ok && data.access_token && !data.error){
      try{ localStorage.setItem('lex-drive-token',          data.access_token); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('lex-drive-token-saved-at', String(Date.now())); } catch(e){ registrarError('localStorage.setItem', e); }
// Sincronizar con token de OCR para que ambos componentes lo encuentren
        try{ localStorage.setItem('lex-ocr-drive-token',      data.access_token); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('drive_token',               data.access_token); } catch(e){ registrarError('localStorage.setItem', e); }
console.log('[Drive] ✅ Token renovado');
        window._driveNecesitaReconexion = false;
        return data.access_token;
    }
    // El Worker respondió pero Google rechazó el refresh_token (vencido o
    // revocado — normalmente porque la app de Google sigue en modo "Testing"
    // y esos tokens caducan solos a los 7 días). Esto NO se arregla solo con
    // reintentos: hay que reconectar Drive a mano. Avisamos de inmediato en
    // vez de dejar que cada documento falle uno por uno con un error críptico.
    const motivo = (data && (data.error_description || data.error)) || ('Error ' + resp.status);
    console.warn('[Drive] Refresh rechazado:', motivo);
    _driveMarcarDesconectado(motivo);
  }catch(e){
    console.warn('[Drive] Error de red renovando:', e.message);
  }
  // Fallback: token guardado aunque sea viejo (solo ayuda si el problema fue
  // de red pasajero; si el refresh_token ya venció, este token también
  // fallará, pero para entonces el aviso de reconexión ya se mostró arriba).
  return saved || localStorage.getItem('lex-ocr-drive-token') || localStorage.getItem('drive_token') || '';
}
// Aviso de "Drive desconectado": se dispara la PRIMERA vez que un refresh de
// token es rechazado por Google (no en fallas de red pasajeras) y solo lo ve
// un administrador, ya que solo un admin puede reconectar desde Panel de
// Control. Evita que el problema se descubra hasta que alguien intente abrir
// un documento y solo vea "Error al cargar desde Drive" en la consola.
window._driveNecesitaReconexion = false;
window._driveAvisoMostrado = false;
function _driveMarcarDesconectado(motivo){
  window._driveNecesitaReconexion = true;
  if(window._driveAvisoMostrado) return;
  window._driveAvisoMostrado = true;
  const esAdmin = typeof _pendEsAdminGlobal === 'function' && _pendEsAdminGlobal();
  if(esAdmin && typeof driveShowReconnect === 'function'){
    driveShowReconnect('El acceso a Google Drive venció y debe reconectarse manualmente desde Panel de Control. (Motivo: ' + motivo + ')');
  }
}
// Verificación proactiva de Drive: solo para el admin, cada 5 minutos —
// así el aviso de reconexión aparece con la sola sesión abierta, sin
// esperar a que alguien intente abrir un documento y se tope con el error
// críptico de la consola. driveGetAccessToken() ya es barata de llamar
// seguido (usa el token en caché si tiene menos de 50 min) y ya no muestra
// el aviso más de una vez por sesión, así que no hay riesgo de spam.
function _driveVerificacionProactiva(){
  if(typeof _pendEsAdminGlobal === 'function' && _pendEsAdminGlobal() && typeof driveGetAccessToken === 'function'){
    driveGetAccessToken().catch(function(e){ console.warn('[Drive] Verificación proactiva:', e.message); });
  }
}
setTimeout(_driveVerificacionProactiva, 8000);
setInterval(_driveVerificacionProactiva, 5*60*1000);
// Sincroniza a Supabase el refresh token de Drive que haya quedado pendiente
// (guardado localmente tras reconectar, pero sin sesión activa en ese momento
// para escribirlo en la nube). Se llama justo tras reconectar Drive Y también
// en cada inicio de sesión exitoso — así no importa cuánto tarde el usuario en
// volver a entrar, el token nuevo siempre se termina guardando en Supabase.
function _driveSyncRefreshPendiente(){
  try{
    const pendiente = localStorage.getItem('lex-drive-refresh-pendiente-sync');
    if(!pendiente || !window.SB) return;
    window.SB.from('configuracion').upsert({id:'drive_refresh_token', valor: pendiente, updated_at: new Date().toISOString()})
      .then(()=>{
        console.log('[Drive] ✅ Refresh token guardado en Supabase (sync pendiente)');
        localStorage.removeItem('lex-drive-refresh-pendiente-sync');
      })
      .catch(e=>console.warn('[Drive] Error guardando en Supabase:', e));
  } catch(e){ console.warn('[Drive] _driveSyncRefreshPendiente:', e); }
}
// Guardar Refresh Token (se llama una vez al completar el flujo OAuth)
function driveSaveRefreshToken(refreshToken, accessToken, expiresIn){
  if(refreshToken) try{ localStorage.setItem('lex-drive-refresh-token', refreshToken); } catch(e){ registrarError('localStorage.setItem', e); }
if(accessToken){
    try{ localStorage.setItem('lex-drive-access-token', accessToken); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('lex-drive-token-expiry', String(Date.now() + (expiresIn||3600)*1000)); } catch(e){ registrarError('localStorage.setItem', e); }
}
}
// Iniciar flujo OAuth para obtener Refresh Token
// Redirige a Google, al volver captura el código y lo intercambia
function driveIniciarOAuth(){
  const params = new URLSearchParams({
    client_id:     DRIVE_CLIENT_ID,
    redirect_uri:  DRIVE_REDIRECT_URI,
    response_type: 'code',
    scope:         'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events',
    access_type:   'offline',
    prompt:        'consent',
    state:         'lexdrive'
  });
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
  // NUEVO: se abre en una ventana emergente en vez de navegar la pestaña
  // principal a Google y de regreso. Antes, ese viaje de ida y vuelta (con
  // recarga completa de página) podía hacer que algunos navegadores (Brave,
  // Safari con ITP) perdieran la sesión/localStorage justo antes de guardar
  // el token nuevo — la app se cerraba y el token nunca quedaba guardado.
  // Con la ventanita, la pestaña principal JAMÁS se mueve de lugar, así que
  // su sesión nunca se pierde. El pequeño script al inicio del <head> es el
  // que detecta que esa ventanita es la de este flujo y manda el código de
  // regreso aquí por postMessage.
  const popup = window.open(url, 'lex-drive-oauth', 'width=520,height=680');
  if(!popup || popup.closed){
    // Si el navegador bloqueó la ventana emergente, respaldo: el método
    // anterior de redirección de página completa.
    try{ localStorage.setItem('lex-drive-oauth-pending', '1'); } catch(e){ registrarError('localStorage.setItem', e); }
    window.location.href = url;
    return;
  }
  window._driveOAuthPopup = popup;
  if(typeof toast==='function') toast('Completa el permiso en la ventana que se abrió…','ok');
}
window.addEventListener('message', function(ev){
  if(ev.origin !== window.location.origin) return;
  if(!ev.data || ev.data.tipo !== 'lex-drive-oauth-code') return;
  if(window._driveOAuthPopup){ try{ window._driveOAuthPopup.close(); }catch(e){} }
  _driveCompletarExchange(ev.data.code);
});
// Procesar código OAuth al regresar de Google — ruta de RESPALDO para cuando
// el navegador bloqueó la ventana emergente y se usó redirección de página
// completa (ver driveIniciarOAuth). Con la ventana emergente, este código ya
// casi no se usa, pero se conserva por si acaso.
async function driveProcessOAuthCallback(){
  const url    = new URL(window.location.href);
  const code   = url.searchParams.get('code');
  const state  = url.searchParams.get('state');
  const pending = localStorage.getItem('lex-drive-oauth-pending') || (state === 'lexdrive');
  if(!code || !pending) return;
  localStorage.removeItem('lex-drive-oauth-pending');
  // Limpiar la URL
  window.history.replaceState({}, '', window.location.pathname);
  _driveCompletarExchange(code);
}
// Intercambia el código de Google por los tokens (vía el Worker) y guarda el
// refresh token — usado tanto por la ruta de ventana emergente (normal) como
// por la de respaldo de redirección de página completa.
async function _driveCompletarExchange(code){
  try{
    // El intercambio con Google ahora lo hace el Worker — el Client Secret
    // de Google ya no vive en el navegador, solo en Cloudflare (env secret).
    const resp = await fetch(R2_WORKER+'/drive/exchange', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Auth-Token': await _r2AuthToken()},
      body: JSON.stringify({
        client_id:    DRIVE_CLIENT_ID,
        code:         code,
        redirect_uri: DRIVE_REDIRECT_URI
      })
    });
    const data = await resp.json();
    if(data.refresh_token){
      driveSaveRefreshToken(data.refresh_token, data.access_token, data.expires_in);
      // Guardar refresh token en Supabase. Con la ventana emergente la sesión
      // de la pestaña principal ya está garantizada (nunca se movió de
      // lugar), así que esto debería guardarse de inmediato — pero se deja
      // también marcado como "pendiente" por si la escritura a Supabase
      // falla por algún motivo pasajero; _driveSyncRefreshPendiente() lo
      // reintenta en el siguiente inicio de sesión.
      try{ localStorage.setItem('lex-drive-refresh-pendiente-sync', data.refresh_token); } catch(e){ registrarError('localStorage.setItem', e); }
      _driveSyncRefreshPendiente();
      // Sincronizar access token para componente OCR
      try{ localStorage.setItem('lex-ocr-drive-token', data.access_token); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('drive_token', data.access_token); } catch(e){ registrarError('localStorage.setItem', e); }
if(typeof toast==='function') toast('✅ Drive conectado permanentemente — ya no necesitas tokens manuales','ok');
      window._driveNecesitaReconexion = false;
      window._driveAvisoMostrado = false;
      // Actualizar estado del módulo OCR
      setTimeout(ocrModActualizarDrive, 500);
    } else {
      console.error('[Drive OAuth] Respuesta completa de Google:', JSON.stringify(data));
      const msgErr = data.error_description || data.error || 'Sin refresh_token';
      if(typeof toast==='function') toast('⚠ Google: ' + msgErr + ' — intenta reconectar','err');
    }
  }catch(e){
    console.error('[Drive OAuth]', e);
    if(typeof toast==='function') toast('❌ Error al conectar Drive: '+e.message,'err');
  }
}
// ─── GOOGLE CALENDAR ─────────────────────────────────────────────────
// Reutiliza el mismo token (y refresh automático) que Drive, ya que
// driveIniciarOAuth() pide también el scope calendar.events.
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
// Construye el cuerpo del evento a partir de una "cita" del módulo de Citas
function _calendarEventoBody(cita){
  // cita.fecha: 'YYYY-MM-DD', cita.hora: 'HH:MM' (24h), cita.duracionMin opcional (default 60)
  const tz = 'America/Mexico_City';
  const inicio = (cita.fecha||'') + 'T' + (cita.hora||'09:00') + ':00';
  const dur = cita.duracionMin || 60;
  // Sumar los minutos con un objeto Date (en vez de aritmética manual de horas)
  // para manejar bien el desbordamiento: antes, una cita de 23:30 + 60min de
  // duración generaba "24:30" (hora inválida, formato ISO roto) y la creación
  // del evento en Calendar fallaba en silencio. Así también corre el día si
  // hace falta.
  const pad = n => String(n).padStart(2,'0');
  const inicioDate = new Date(inicio);
  const finDate = isNaN(inicioDate.getTime()) ? new Date() : new Date(inicioDate.getTime() + dur*60000);
  const fin = finDate.getFullYear()+'-'+pad(finDate.getMonth()+1)+'-'+pad(finDate.getDate())+'T'+pad(finDate.getHours())+':'+pad(finDate.getMinutes())+':00';
  return {
    summary: cita.titulo || 'Cita',
    location: cita.lugar || cita.direccion || '',
    description: cita.notas || '',
    start: { dateTime: inicio, timeZone: tz },
    end:   { dateTime: fin,    timeZone: tz }
  };
}
// Crear un evento — devuelve {id, htmlLink} o null si falla
async function calendarCrearEvento(cita){
  try{
    const token = await driveGetAccessToken();
    if(!token){ if(typeof toast==='function') toast('⚠ Conecta Drive/Calendar primero','err'); return null; }
    const resp = await fetch(CALENDAR_API_BASE, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(_calendarEventoBody(cita))
    });
    const data = await resp.json();
    if(!resp.ok){ console.error('[Calendar] crear', data); if(typeof toast==='function') toast('⚠ Error al crear evento en Calendar','err'); return null; }
    return { id: data.id, htmlLink: data.htmlLink };
  }catch(e){ console.error('[Calendar] crear', e); return null; }
}
// Actualizar un evento existente por su eventId
async function calendarActualizarEvento(eventId, cita){
  try{
    const token = await driveGetAccessToken();
    if(!token || !eventId) return null;
    const resp = await fetch(CALENDAR_API_BASE + '/' + eventId, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(_calendarEventoBody(cita))
    });
    const data = await resp.json();
    if(!resp.ok){ console.error('[Calendar] actualizar', data); return null; }
    return { id: data.id, htmlLink: data.htmlLink };
  }catch(e){ console.error('[Calendar] actualizar', e); return null; }
}
// Eliminar un evento por su eventId
async function calendarEliminarEvento(eventId){
  try{
    const token = await driveGetAccessToken();
    if(!token || !eventId) return false;
    const resp = await fetch(CALENDAR_API_BASE + '/' + eventId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    return resp.ok || resp.status === 410; // 410 = ya estaba eliminado
  }catch(e){ console.error('[Calendar] eliminar', e); return false; }
}
// ─── MODAL: AGENDAR CITA ─────────────────────────────────────────────
// ── Renderizar panel de Citas ────────────────────────────────
function renderCitas(){
  const contenedor      = document.getElementById('citas-lista');
  const contenedorModal = document.getElementById('modal-citas-lista');
  if(!contenedor && !contenedorModal) return;
  if(!Array.isArray(D.citas)) D.citas = [];
  const hoy = (typeof fechaCDMX_ISO==='function')?fechaCDMX_ISO():new Date().toISOString().slice(0,10);
  // Leer query de cualquiera de los dos inputs (panel o modal)
  const q = ((document.getElementById('citasQ')?.value||'') || (document.getElementById('modal-citasQ')?.value||'')).toLowerCase().trim();
  // FIX: solo deben verse las citas próximas (hoy o después) — las pasadas
  // las borra automáticamente citasLimpiarPasadas(), pero mientras eso corre
  // no deben quedar visibles en la lista. Las citas sin fecha se mantienen
  // visibles (aún no se ha definido cuándo son).
  let lista = D.citas.filter(c => !c.fecha || c.fecha >= hoy).sort((a,b)=>(a.fecha||'') < (b.fecha||'') ? -1 : 1);
  if(q) lista = lista.filter(c =>
    (c.titulo||'').toLowerCase().includes(q) ||
    (c.cliente||'').toLowerCase().includes(q) ||
    (c.lugar||'').toLowerCase().includes(q) ||
    (c.notas||'').toLowerCase().includes(q)
  );

  // Badge en nav
  const badge = document.getElementById('badgeCitas');
  if(badge){ const prox = D.citas.filter(c=>c.fecha>=hoy).length; badge.textContent=prox||''; badge.style.display=prox?'':'none'; }

  function _set(el, html){ if(el) el.innerHTML = html; }

  if(!lista.length){
    const vacio = `<div style="text-align:center;padding:60px 20px;color:var(--muted);font-size:0.85rem;">
      <div style="font-size:2.5rem;margin-bottom:12px;">📅</div>
      <div style="font-weight:600;margin-bottom:6px;">${q?'Sin resultados':'No hay citas próximas agendadas'}</div>
      <div style="font-size:0.75rem;opacity:0.7;">${q?'Intenta con otra búsqueda':'Haz clic en «Nueva Cita» para agendar'}</div>
    </div>`;
    _set(contenedor, vacio); _set(contenedorModal, vacio);
    return;
  }

  const DIAS_SEM = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
  const MESES_AB = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  // Convierte "HH:MM" (24h, como se guarda) a "hh:mm a.m./p.m." para el chip.
  function _horaAmPm(hora){
    const partes = String(hora||'').split(':');
    let h = parseInt(partes[0],10);
    const m = partes[1] || '00';
    if(isNaN(h)) return hora;
    const sufijo = h >= 12 ? 'P.M.' : 'A.M.';
    h = h % 12; if(h === 0) h = 12;
    return String(h).padStart(2,'0')+':'+m+' '+sufijo;
  }

  // Agrupar por fecha (la lista ya viene ordenada) para poner un encabezado
  // de sección por día: HOY, MARTES, MIÉRCOLES, JUEVES, etc.
  const grupos = [];
  lista.forEach(c=>{
    const key = c.fecha || '__sinfecha__';
    let g = grupos[grupos.length-1];
    if(!g || g.key !== key){ g = { key, fecha:c.fecha, items:[] }; grupos.push(g); }
    g.items.push(c);
  });

  const html = grupos.map(g=>{
    const esHoy = g.fecha === hoy;
    // Tema por grupo: SOLO el día vigente (HOY) se pinta de verde. Las
    // fechas próximas van sin relleno de color en la tarjeta — se distinguen
    // por el borde. El encabezado de sección usa colores más claros/vivos
    // (no los "-d" oscuros) porque va sobre fondo negro y debe verse bien.
    const tema = esHoy
      ? { border:'rgba(26,122,58,0.35)', bg:'var(--verde-l)', chipBg:'rgba(26,122,58,0.14)', color:'var(--verde-d)', headerColor:'#2fbf6f' }
      : { border:'rgba(26,74,138,0.30)', bg:'var(--surface)',  chipBg:'rgba(26,74,138,0.12)', color:'var(--azul)',   headerColor:'#4d9dff' };

    let tituloGrupo;
    if(!g.fecha) tituloGrupo = 'SIN FECHA';
    else if(esHoy) tituloGrupo = 'HOY';
    else {
      const dObj = new Date(g.fecha+'T00:00:00');
      tituloGrupo = DIAS_SEM[dObj.getDay()] + ' · ' + g.fecha.slice(8,10) + ' ' + MESES_AB[dObj.getMonth()];
    }
    const header = `<div style="display:flex;align-items:center;gap:8px;margin:${grupos[0]===g?'0':'6px'} 0 2px;">
      <span style="font-size:0.72rem;font-weight:800;letter-spacing:0.08em;color:${tema.headerColor};">${tituloGrupo}</span>
      <span style="flex:1;height:1px;background:${tema.border};"></span>
    </div>`;

    const tarjetas = g.items.map(c=>{
      // Acciones rápidas con su descripción — esquina superior derecha de la
      // ficha, en la misma línea que el título para no agregar altura extra.
      const calLink = c.eventoCalendarLink
        ? `<a href="${escHTML(c.eventoCalendarLink)}" target="_blank" style="background:rgba(26,74,138,0.07);color:var(--azul);border:1px solid rgba(26,74,138,0.2);border-radius:14px;padding:3px 10px;font-size:0.65rem;font-family:monospace;text-decoration:none;white-space:nowrap;" title="Ver en Google Calendar">📆 Calendar</a>`
        : `<button onclick="citaSyncCalendar('${escHTML(c.id)}')" style="background:rgba(26,74,138,0.07);color:var(--azul);border:1px solid rgba(26,74,138,0.2);border-radius:14px;padding:3px 10px;font-size:0.65rem;font-family:monospace;cursor:pointer;white-space:nowrap;" title="Agregar a Google Calendar">📆 Sync Calendar</button>`;
      const comoLlegarBtn = c.lugar?`<button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent('${escHTML(c.lugar).replace(/'/g,"\\'")}'),'_blank')" style="background:var(--azul-l);color:var(--azul);border:1px solid rgba(26,74,138,0.2);border-radius:14px;padding:3px 10px;font-size:0.65rem;font-family:monospace;cursor:pointer;white-space:nowrap;">📍 Cómo llegar</button>`:'';
      const editarBtn = `<button onclick="agendarCitaAbrir('${escHTML(c.id)}')" style="background:rgba(200,149,42,0.1);color:var(--gold-d);border:1px solid rgba(200,149,42,0.3);border-radius:14px;padding:3px 10px;font-size:0.65rem;font-family:monospace;cursor:pointer;white-space:nowrap;">✏️ Editar</button>`;

      // Chip de fecha/hora — separado, grande y de un solo vistazo (esquina
      // izquierda, como los folios), con el día de la semana en mayúsculas.
      let chip = `<div style="flex-shrink:0;width:74px;background:${tema.chipBg};border:1px solid ${tema.border};border-radius:9px;padding:8px 4px 9px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;">
          <div style="font-size:8px;">📅</div>
          <div style="font-size:0.6rem;color:var(--muted);">Sin fecha</div>
        </div>`;
      if(c.fecha){
        const dObj = new Date(c.fecha+'T00:00:00');
        const diaSem = DIAS_SEM[dObj.getDay()] || '';
        const diaNum = c.fecha.slice(8,10);
        const mesAb  = MESES_AB[dObj.getMonth()] || '';
        chip = `<div style="flex-shrink:0;width:74px;background:${tema.chipBg};border:1px solid ${tema.border};border-radius:9px;padding:7px 4px 8px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:0.58rem;font-weight:800;letter-spacing:0.04em;color:${tema.color};">${diaSem}</div>
          <div style="font-size:1.55rem;font-weight:800;color:${tema.color};line-height:1.15;">${diaNum}</div>
          <div style="font-size:0.62rem;font-weight:700;letter-spacing:0.05em;color:${tema.color};">${mesAb}</div>
          ${c.hora?`<div style="margin-top:5px;padding-top:5px;border-top:1px solid ${tema.border};font-size:0.72rem;font-weight:900;color:${tema.color};font-family:monospace;white-space:nowrap;">${_horaAmPm(c.hora)}</div>`:''}
        </div>`;
      }

      const eliminarBtn = `<button onclick="citaEliminar('${escHTML(c.id)}')" style="flex-shrink:0;background:var(--rojo-l);color:var(--rojo);border:1px solid rgba(192,22,26,0.2);border-radius:14px;padding:3px 10px;font-size:0.65rem;font-family:monospace;cursor:pointer;">🗑 Eliminar</button>`;

      return `<div style="background:${tema.bg};border:1.5px solid ${tema.border};border-radius:10px;padding:12px 16px;display:flex;gap:14px;">
        ${chip}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div style="font-weight:700;font-size:0.95rem;color:var(--ink);">${escHTML(c.titulo||'Sin título')}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">${calLink}${comoLlegarBtn}${editarBtn}</div>
          </div>
          ${c.cliente?`<div style="display:flex;align-items:center;gap:6px;font-size:0.82rem;color:var(--ink);font-weight:600;">👤 ${escHTML(c.cliente)}</div>`:''}
          ${c.lugar?`<div style="font-size:0.78rem;color:var(--muted);">📍 ${escHTML(c.lugar)}</div>`:''}
          <div style="display:flex;align-items:center;gap:10px;">
            ${c.notas?`<div style="flex:1;font-size:0.75rem;color:var(--muted);background:rgba(0,0,0,0.03);padding:6px 10px;border-radius:6px;line-height:1.5;">${escHTML(c.notas)}</div>`:`<div style="flex:1;"></div>`}
            ${eliminarBtn}
          </div>
        </div>
      </div>`;
    }).join('');

    return header + `<div style="display:flex;flex-direction:column;gap:10px;">` + tarjetas + `</div>`;
  }).join('');
  _set(contenedor, html); _set(contenedorModal, html);
}

// ── Auto-limpieza: eliminar citas pasadas de D.citas, Google Calendar y R2 ─
async function citasLimpiarPasadas(){
  try {
    if(!Array.isArray(D.citas) || !D.citas.length) return;
    // Usar la fecha/hora en hora de México (no UTC): entre las 18:00 y
    // medianoche hora de CDMX, new Date().toISOString() ya cae en "mañana"
    // en UTC, lo que hacía que citas de HOY por la tarde/noche se marcaran
    // como "pasadas" antes de tiempo.
    const hoy = (typeof fechaCDMX_ISO==='function') ? fechaCDMX_ISO() : new Date().toISOString().slice(0,10); // 'YYYY-MM-DD'
    const horaAhora = (typeof horaCDMX_HHMM==='function') ? horaCDMX_HHMM() : new Date().toTimeString().slice(0,5);
    const ahoraMs = new Date(hoy+'T'+horaAhora+':00').getTime();
    const MARGEN_MS = 60*60*1000; // 1 hora de margen: la cita sigue visible 1h después de su hora
    // FIX: antes solo se comparaba la FECHA, así que una cita de hoy a las
    // 11:00 seguía "próxima" toda la tarde aunque la hora ya hubiera pasado.
    // Ahora se compara fecha+hora exacta (con 1h de margen tras cumplirse,
    // para que no desaparezca al instante) y se elimina hasta entonces.
    const pasadas = D.citas.filter(function(c){
      const t = new Date((c.fecha||hoy)+'T'+(c.hora||'23:59')+':00').getTime();
      return !isNaN(t) && (ahoraMs - t) > MARGEN_MS;
    });
    if(!pasadas.length) return;

    // 1. Intentar borrar cada una de Google Calendar (en paralelo, sin bloquear)
    pasadas.forEach(function(c){
      if(c.eventoCalendarId){
        calendarEliminarEvento(c.eventoCalendarId).catch(function(){});
      }
    });

    // 2. Quitar del array local
    const pasadasIds = new Set(pasadas.map(function(c){ return c.id; }));
    pasadas.forEach(function(c){ _marcarCitaEliminadaLocal(c.id); });
    D.citas = D.citas.filter(function(c){ return !pasadasIds.has(c.id); });
    save();
    if(document.getElementById('panel-citas')?.classList.contains('active')) renderCitas();

    // FIX: antes esta función solo guardaba en R2 y en memoria local, pero
    // NUNCA empujaba el borrado a Supabase (app_state.data.citas) — así que
    // la copia en el servidor seguía teniendo la cita vencida para siempre.
    // Cualquier pull posterior (polling de 30s, Realtime, otra computadora
    // del despacho, o el propio renderCitas() al entrar al panel) la
    // resucitaba en D.citas con la copia vieja del servidor. Ahora se
    // confirma la baja en Supabase de inmediato (no debounced) para que dos
    // computadoras conectadas al mismo despacho converjan sin resucitar la
    // cita ya vencida.
    if(typeof syncEstadoSupabase === 'function'){
      try { await syncEstadoSupabase(); }
      catch(e){ console.warn('[Citas] no se pudo confirmar borrado en Supabase:', e); }
    } else if(typeof syncEstadoSupabaseDebounced === 'function'){
      syncEstadoSupabaseDebounced().catch(function(){});
    }

    // 3. Actualizar el JSON en R2
    await citasGuardarR2();

    console.info('[Citas] Auto-limpieza: '+pasadas.length+' cita(s) pasada(s) eliminada(s)');
    if(pasadas.length) toast('🗑 '+pasadas.length+' cita(s) pasada(s) eliminada(s) automáticamente');
  } catch(e){ console.warn('[Citas] Error en auto-limpieza:', e); }
}

// ── R2: Guardar todas las citas como JSON en lex-expedientes ──────────────
async function citasGuardarR2(){
  try {
    if(!window.subirR2 || !window.SB_DESPACHO_ID) return;
    const json = JSON.stringify({ citas: D.citas||[], actualizadoEn: new Date().toISOString() });
    const blob = new Blob([json],{type:'application/json'});
    const file = new File([blob],'citas.json',{type:'application/json'});
    const path = window.SB_DESPACHO_ID+'/citas/citas.json';
    const ok   = await window.subirR2(file, path, 'expedientes');
    if(ok) console.info('[Citas R2] citas.json guardado en lex-expedientes');
    else   console.warn('[Citas R2] No se pudo guardar citas.json en R2');
  } catch(e){ console.warn('[Citas R2] Error al guardar:', e); }
}

// ── R2: Cargar citas desde lex-expedientes al iniciar ─────────────────────
async function citasCargarR2(){
  try {
    if(!window.descargarR2 || !window.SB_DESPACHO_ID) return;
    const path = window.SB_DESPACHO_ID+'/citas/citas.json';
    const blob = await window.descargarR2(path,'expedientes',true);
    if(!blob) return; // primer uso: aún no existe
    const txt  = await blob.text();
    const data = JSON.parse(txt);
    if(!Array.isArray(data.citas) || !data.citas.length) return;
    // Fusionar: conservar locales y agregar las que sólo están en R2
    if(!Array.isArray(D.citas)) D.citas = [];
    const idsLocales = new Set(D.citas.map(function(c){ return c.id; }));
    var nuevas = 0;
    data.citas.forEach(function(c){
      if(c && c.id && !idsLocales.has(c.id)){ D.citas.push(c); nuevas++; }
    });
    if(nuevas > 0){
      save();
      if(document.getElementById('panel-citas')?.classList.contains('active')) renderCitas();
      console.info('[Citas R2] '+nuevas+' cita(s) recuperada(s) desde lex-expedientes');
    }
  } catch(e){ console.warn('[Citas R2] Error al cargar:', e); }
}

function citaEliminar(id){
  if(!confirm('¿Eliminar esta cita?')) return;
  if(!Array.isArray(D.citas)) return;
  const cita = D.citas.find(c=>c.id===id);
  // Borrar también el evento vinculado en Google Calendar, si existe — antes
  // solo se quitaba de D.citas y el evento quedaba huérfano para siempre.
  if(cita && cita.eventoCalendarId){
    calendarEliminarEvento(cita.eventoCalendarId).catch(()=>{});
  }
  D.citas = D.citas.filter(c=>c.id!==id);
  _marcarCitaEliminadaLocal(id);
  save(); syncEstadoSupabaseDebounced().catch(()=>{});
  citasGuardarR2();
  renderCitas();
  toast('Cita eliminada');
}
async function citaSyncCalendar(id){
  const cita = (D.citas||[]).find(c=>c.id===id);
  if(!cita) return;
  toast('📆 Sincronizando con Google Calendar...');
  const ev = await calendarCrearEvento(cita);
  if(ev){
    cita.eventoCalendarId   = ev.id;
    cita.eventoCalendarLink = ev.htmlLink;
    save(); syncEstadoSupabaseDebounced().catch(()=>{});
    renderCitas();
    toast('✅ Cita agregada a Google Calendar','ok');
  }
}

function citaToggleForm(){
  const body = document.getElementById('mCitaFormBody');
  const arrow = document.getElementById('mCitaFormArrow');
  if(!body) return;
  const visible = body.style.display !== 'none';
  body.style.display = visible ? 'none' : '';
  if(arrow) arrow.style.transform = visible ? 'rotate(180deg)' : '';
}

// Si se pasa un id de cita existente, abre el formulario en modo edición
// (prellenado con sus datos); sin argumento, abre para agendar una nueva.
let _citaEditId = null;
function agendarCitaAbrir(id){
  if(!Array.isArray(D.citas)) D.citas = [];
  const cita = id ? D.citas.find(c=>c.id===id) : null;
  _citaEditId = cita ? id : null;
  const tit=document.getElementById('citaTitulo');   if(tit) tit.value = cita?.titulo||'';
  const cli=document.getElementById('citaCliente');  if(cli) cli.value = cita?.cliente||'';
  const lug=document.getElementById('citaLugar');    if(lug) lug.value = cita?.lugar||'';
  const not=document.getElementById('citaNotas');    if(not) not.value = cita?.notas||'';
  const f=document.getElementById('citaFecha'); if(f) f.value = cita?.fecha||'';
  const h=document.getElementById('citaHora');  if(h) h.value = cita?.hora||'09:00';
  const st=document.getElementById('citaCalendarStatus'); if(st){ st.style.display='none'; st.textContent=''; }
  const label = document.getElementById('mCitaFormLabel');
  if(label) label.textContent = cita ? '✏️ Editar cita' : '➕ Nueva cita';
  const btn = document.getElementById('mCitaGuardarBtn');
  if(btn) btn.textContent = cita ? '💾 Guardar cambios' : '💾 Guardar y agendar';
  const modal = document.getElementById('mAgendarCita');
  if(modal) modal.classList.add('show');
  // Asegurar que el formulario esté visible al abrir
  const fb = document.getElementById('mCitaFormBody');
  const fa = document.getElementById('mCitaFormArrow');
  if(fb){ fb.style.display=''; } if(fa){ fa.style.transform=''; }
  renderCitas();
}
// Abre Google Maps con la ruta hacia el lugar de la cita (sin necesidad de API key)
function agendarCitaComoLlegar(){
  const lugar = document.getElementById('citaLugar')?.value.trim() || '';
  if(!lugar){ toast('Escribe primero el lugar/dirección de la cita','err'); return; }
  const url = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(lugar);
  window.open(url, '_blank');
}
// Guarda la cita en D.citas, sincroniza y crea el evento en Google Calendar
async function agendarCitaGuardar(){
  const titulo = document.getElementById('citaTitulo')?.value.trim() || '';
  const fecha  = document.getElementById('citaFecha')?.value || '';
  const hora   = document.getElementById('citaHora')?.value || '';
  const cliente= document.getElementById('citaCliente')?.value.trim() || '';
  const lugar  = document.getElementById('citaLugar')?.value.trim() || '';
  const notas  = document.getElementById('citaNotas')?.value.trim() || '';
  if(!titulo){ toast('El asunto/título es obligatorio','err'); return; }
  if(!fecha){ toast('La fecha es obligatoria','err'); return; }
  if(!hora){ toast('La hora es obligatoria','err'); return; }
  if(!Array.isArray(D.citas)) D.citas = [];

  const editando = !!(_citaEditId && D.citas.some(c=>c.id===_citaEditId));
  let cita;
  if(editando){
    cita = D.citas.find(c=>c.id===_citaEditId);
    Object.assign(cita, { titulo, cliente, fecha, hora, lugar, notas, actualizadaEn: new Date().toISOString() });
  } else {
    cita = {
      id: 'CITA-'+Date.now(),
      titulo, cliente, fecha, hora, lugar, notas,
      creadaEn: new Date().toISOString(),
      actualizadaEn: new Date().toISOString(),
      eventoCalendarId: null, eventoCalendarLink: null
    };
    D.citas.unshift(cita);
  }
  _citaEditId = null;
  // Guardar local/Supabase de inmediato — no depender de Calendar para persistir
  save(); syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
  citasGuardarR2(); // ← persistir en lex-expedientes/R2
  cerrar('mAgendarCita');
  toast(editando ? '📅 Cita actualizada — sincronizando con Google Calendar...' : '📅 Cita guardada — agendando en Google Calendar...');
  if(document.getElementById('panel-citas')?.classList.contains('active')) renderCitas();
  // Crear el evento en Calendar si es nuevo, o actualizar el ya vinculado si
  // se está editando una cita que ya tenía uno (no bloquea el guardado).
  const ev = cita.eventoCalendarId
    ? await calendarActualizarEvento(cita.eventoCalendarId, cita)
    : await calendarCrearEvento(cita);
  if(ev){
    cita.eventoCalendarId   = ev.id;
    cita.eventoCalendarLink = ev.htmlLink;
    cita.actualizadaEn      = new Date().toISOString();
    save(); syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
    toast(editando ? '✅ Cambios sincronizados con Google Calendar' : '✅ Cita agendada y agregada a Google Calendar');
  } else {
    toast('⚠ Cita guardada, pero no se pudo sincronizar con Google Calendar — conecta Drive/Calendar en ⚙️','err');
  }
}

window.addEventListener('load', ()=>{
  // Esperar 3s para que Supabase cargue antes de procesar el callback
  setTimeout(driveProcessOAuthCallback, 3000);
  // Cargar citas desde R2 (lex-expedientes) después de que Supabase/auth esté listo
  setTimeout(function(){
    citasCargarR2().catch(()=>{}).then(function(){
      // Después de cargar, limpiar las pasadas
      setTimeout(function(){ citasLimpiarPasadas().catch(()=>{}); }, 2000);
    });
  }, 5000);
  // FIX: antes la limpieza de citas pasadas solo corría UNA VEZ al cargar la
  // página, así que si la app se dejaba abierta (sin recargar) una cita de
  // hoy en la mañana nunca se borraba sola aunque ya hubiera pasado su hora
  // + margen. Ahora se repite cada 10 minutos mientras la app siga abierta.
  setInterval(function(){ citasLimpiarPasadas().catch(()=>{}); }, 10*60*1000);
  // Limpiar access token si tiene más de 50 minutos
  const savedAt = parseInt(localStorage.getItem('lex-drive-token-saved-at')||'0');
  if(Date.now() - savedAt > 50*60*1000){
    localStorage.removeItem('lex-drive-token');
    localStorage.removeItem('lex-drive-token-saved-at');
  }
});
function ocrGetCarpetaActiva(){
  return OCR_JUICIOS_FOLDER_ID;
}
async function ocrListarDrive(){
  await ocrFetchDrive('', OCR_JUICIOS_FOLDER_ID, null);
}
async function ocrBuscarDrive(){
  const q = document.getElementById('ocr-ds-inp').value.trim();
  await ocrFetchDrive(q, OCR_JUICIOS_FOLDER_ID, null);
}
async function ocrFetchDrive(query, folderId, tokenManual){
  const dl = document.getElementById('ocr-dl');
  dl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:0.78rem;">🔄 Buscando en carpeta de juicios...</div>';
  try {
    // Usar token automático (refresh) o el manual como fallback
    const token = await driveGetAccessToken() || tokenManual;
    if(!token) throw new Error('Sin token de Drive — haz clic en "Conectar Drive" en ⚙️');
    const carpeta = folderId || OCR_JUICIOS_FOLDER_ID;
    let q, url;
    if(query){
      // Búsqueda: PDFs e imágenes que coincidan con el nombre
      q = "(mimeType='application/pdf' or mimeType contains 'image/' or mimeType='application/vnd.google-apps.folder') and trashed=false and '"+carpeta+"' in parents and name contains '"+query.replace(/'/g,"\'")+"'";
    } else {
      // Sin búsqueda: mostrar subcarpetas de juicios + PDFs directos
      q = "trashed=false and '"+carpeta+"' in parents";
    }
    url = 'https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)
      +'&fields=files(id,name,mimeType,modifiedTime)&pageSize=50&orderBy=name'
      +'&includeItemsFromAllDrives=true&supportsAllDrives=true&corpora=allDrives';
    const resp = await fetch(url, { headers:{ Authorization:'Bearer '+token } });
    if(resp.status === 401){
      // Limpiar token expirado
      localStorage.removeItem('lex-drive-token');
      localStorage.removeItem('lex-ocr-drive-token');
      throw new Error('Token expirado — haz clic en ⚙️ y pega un token nuevo de developers.google.com/oauthplayground');
    }
    if(resp.status === 403){
      const e403 = await resp.json().catch(()=>({}));
      throw new Error('Sin permisos — verifica que la cuenta de Drive tenga acceso a la carpeta. Detalle: '+(e403?.error?.message||'403'));
    }
    if(resp.status === 404){
      const e404 = await resp.json().catch(()=>({}));
      const msg404 = e404?.error?.message || '404';
      // Intentar sin filtro de carpeta como diagnóstico
      const urlDiag = 'https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent("trashed=false and mimeType='application/vnd.google-apps.folder'")
        +'&fields=files(id,name)&pageSize=5&includeItemsFromAllDrives=true&supportsAllDrives=true';
      const diagResp = await fetch(urlDiag, {headers:{Authorization:'Bearer '+token}});
      if(diagResp.ok){
        const diagData = await diagResp.json();
        const nombres = (diagData.files||[]).map(f=>f.name).join(', ');
        throw new Error('Carpeta no encontrada. Tu cuenta puede ver: ['+nombres+']. Verifica que tengas acceso a la carpeta JUICIOS.');
      }
      throw new Error('Carpeta no encontrada (404): '+msg404+'. Verifica que fcolex0@gmail.com tenga acceso a la carpeta JUICIOS.');
    }
    if(!resp.ok){
      const eGen = await resp.json().catch(()=>({}));
      throw new Error('Error Drive '+resp.status+': '+(eGen?.error?.message||''));
    }
    const data = await resp.json();
    ocrRenderDrive(data.files || [], carpeta);
    ocrModActualizarDrive();
  } catch(err){
    dl.innerHTML = '<div style="padding:14px 16px;background:rgba(192,22,26,0.06);border:1px solid rgba(192,22,26,0.2);border-radius:8px;color:var(--rojo);font-size:0.75rem;line-height:1.6;">'
      +'<strong>❌ Error al conectar con Drive</strong><br>'+err.message
      +'<br><br><span style="color:var(--muted);font-size:0.68rem;">Solución: haz clic en ⚙️ → genera un nuevo token en developers.google.com/oauthplayground con la cuenta que tiene acceso a la carpeta JUICIOS</span>'
      +'</div>';
  }
}
// Navegar a una subcarpeta (al hacer clic en una carpeta de juicio)
async function ocrEntrarCarpeta(folderId, encodedFolderName){
  const folderName = decodeURIComponent(encodedFolderName);
  const token = ocrModGetDriveToken();
  if(!token) return;
  // Actualizar breadcrumb
  const dst = document.getElementById('ocr-dst-txt');
  if(dst) dst.textContent = '📂 '+folderName;
  await ocrFetchDrive('', folderId, token);
  // Agregar botón volver
  const dl = document.getElementById('ocr-dl');
  if(dl){
    const volver = document.createElement('div');
    volver.style.cssText = 'padding:8px 11px;border-bottom:1px solid var(--border-l);font-size:0.75rem;cursor:pointer;color:var(--azul);display:flex;align-items:center;gap:6px;';
    volver.innerHTML = '← Volver a JUICIOS';
    volver.onclick = () => ocrListarDrive();
    dl.insertBefore(volver, dl.firstChild);
  }
}
function ocrRenderDrive(files, parentFolder){
  const dl = document.getElementById('ocr-dl');
  if(!files.length){
    dl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--muted);font-size:0.78rem;">No se encontraron archivos en esta carpeta</div>';
    return;
  }
  const carpetas = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  const archivos = files.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
  dl.innerHTML = '';
  // Carpetas navegables
  carpetas.forEach(f => {
    const fecha = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('es-MX') : '';
    const safeId   = encodeURIComponent(f.id||'');
    const safeName = encodeURIComponent(f.name||'');
    const div = document.createElement('div');
    div.className = 'ocr-di';
    div.style.background = 'rgba(200,149,42,0.04)';
    div.innerHTML = '<span style="font-size:1rem;flex-shrink:0;">📁</span>'
      +'<div style="flex:1;min-width:0;"><div class="ocr-di-name" style="font-weight:600;">'+f.name+'</div>'
      +'<div class="ocr-di-meta">'+fecha+' · clic para abrir</div></div>'
      +'<span style="font-size:0.7rem;color:var(--muted);">›</span>';
    div.onclick = () => ocrEntrarCarpeta(f.id, safeName);
    dl.appendChild(div);
  });
  // Archivos seleccionables
  archivos.forEach(f => {
    const ico   = f.mimeType === 'application/pdf' ? '📄' : '🖼️';
    const fecha = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('es-MX') : '';
    const isSel = ocrModDriveSel.find(s => s.id === f.id) ? 'sel' : '';
    const div = document.createElement('div');
    div.className = 'ocr-di'+(isSel?' sel':'');
    div.id = 'ocr-di-'+f.id;
    div.innerHTML = '<span style="font-size:1rem;flex-shrink:0;">'+ico+'</span>'
      +'<div style="flex:1;min-width:0;"><div class="ocr-di-name">'+f.name+'</div>'
      +'<div class="ocr-di-meta">'+fecha+'</div></div>'
      +'<div class="ocr-di-chk">'+(isSel?'✓':'')+'</div>';
    div.onclick = () => ocrToggleDI(f.id, encodeURIComponent(f.name||''), f.mimeType, div);
    dl.appendChild(div);
  });
}
function ocrToggleDI(id, encodedName, mime, el){
  const name = decodeURIComponent(encodedName);
  const idx = ocrModDriveSel.findIndex(f => f.id === id);
  if(idx >= 0){
    ocrModDriveSel.splice(idx,1);
    el.classList.remove('sel');
    el.querySelector('.ocr-di-chk').textContent = '';
  } else {
    ocrModDriveSel.push({ id, name, mime });
    el.classList.add('sel');
    el.querySelector('.ocr-di-chk').textContent = '✓';
  }
  document.getElementById('ocr-sel-n').textContent = ocrModDriveSel.length;
}
// ─── ANALIZAR DESDE DRIVE ─────────────────────────────────────────────
async function ocrAnalizarDrive(){
  if(!ocrModDriveSel.length){ if(typeof toast==='function') toast('⚠ Selecciona al menos un archivo','err'); return; }
  // Key obtenida directamente en ocrLlamarGemini desde Supabase
  document.getElementById('ocr-no-key')?.classList.remove('show');
  const token = ocrModGetDriveToken();
  if(!token){ if(typeof toast==='function') toast('⚠ Configura el token de Drive en ⚙️ Configuración','err'); return; }
  document.getElementById('ocr-no-key').classList.remove('show');
  document.getElementById('ocr-result').style.display = 'none';
  ocrResetProg('ocr-pw-d');
  try {
    ocrSetProg('ocr-pw-d', true, 'Descargando de Drive...', 'ocr-d1');
    const partes = [];
    for(const f of ocrModDriveSel){
      const resp = await fetch('https://www.googleapis.com/drive/v3/files/'+f.id+'?alt=media',
        { headers:{ Authorization:'Bearer '+token } });
      if(resp.status===401) throw new Error('Token de Drive expirado. Genera uno nuevo en ⚙️ Configuración');
      if(!resp.ok) throw new Error('No se pudo descargar "'+f.name+'": HTTP '+resp.status);
      const blob = await resp.blob();
      partes.push({ b64: await ocrToB64(blob), mime: ocrGetMime({ type: blob.type||f.mime, name: f.name }) });
    }
    ocrDoneStep('ocr-d1');
    // ── INTENTO 1: Extracción local ──
    const jD = D.juicios && D.juicios[jdetIdx];
    const ctxJuicioD = jD ? `Juicio: ${jD.tipo||''} — Expediente: ${jD.expediente||jD.num||''} — Cliente: ${jD.nombre||jD.cliente||''}` : '';
    const extraD = ocrGetExtra();
    // Convertir primer archivo de partes a File para el extractor local
    let extraccionD = null;
    if (partes.length > 0) {
      try {
        const p0 = partes[0];
        const byteStr = atob(p0.b64);
        const byteArr = new Uint8Array(byteStr.length);
        for(let i=0;i<byteStr.length;i++) byteArr[i]=byteStr.charCodeAt(i);
        const blobD = new Blob([byteArr], {type: p0.mime});
        const fileD = new File([blobD], ocrModDriveSel[0]?.name || 'archivo', {type: p0.mime});
        extraccionD = await _ocrExtraerTexto(fileD, (msg) => {
          ocrSetProg('ocr-pw-d', true, msg, 'ocr-d2');
        });
      } catch(eExt){ console.warn('[OCR-Drive] Extracción local falló:', eExt.message); }
    }
    if (extraccionD && extraccionD.texto.length > 100) {
      // ✅ Texto extraído localmente — Opción C
      const metodoLabelD = extraccionD.metodo === 'pdf-texto' ? 'PDF.js' : extraccionD.metodo === 'mistral' ? 'Mistral OCR' : 'Tesseract';
      ocrSetProg('ocr-pw-d', true, `Texto extraído [${metodoLabelD}]`, 'ocr-d2');
      ocrDoneStep('ocr-d2');
      ocrSetProg('ocr-pw-d', true, 'IA: análisis legal...', 'ocr-d3');
      const rawD = await _ocrAnalizarTexto(extraccionD.texto, ctxJuicioD, extraD, (msg) => {
        ocrSetProg('ocr-pw-d', true, msg, 'ocr-d3');
      });
      ocrDoneStep('ocr-d3');
      ocrSetProg('ocr-pw-d', true, 'Generando resumen...', 'ocr-d4');
      let resultadoD;
      try { resultadoD = ocrParsearJSON(rawD); }
      catch(e){ resultadoD = ocrTextoAResultado(rawD, ocrModTipoD); }
      resultadoD.textOCR = extraccionD.texto.substring(0, 3000);
      ocrDoneStep('ocr-d4');
      ocrModResultado = resultadoD;
      ocrMostrarResultado(resultadoD, ocrModDriveSel.map(f=>f.name).join(', '));
      return;
    }
    // ── INTENTO 2 (respaldo): Cloudflare Vision ──
    ocrSetProg('ocr-pw-d', true, 'Enviando a Cloudflare Workers AI...', 'ocr-d2');
    ocrDoneStep('ocr-d2');
    ocrSetProg('ocr-pw-d', true, 'Cloudflare: OCR + análisis...', 'ocr-d3');
    const raw = await ocrLlamarVisionIA(partes, ocrBuildPrompt(ocrModTipoD));
    ocrDoneStep('ocr-d3');
    ocrSetProg('ocr-pw-d', true, 'Generando resumen...', 'ocr-d4');
    let resultado;
    try { resultado = ocrParsearJSON(raw); }
    catch(e){ resultado = ocrTextoAResultado(raw, ocrModTipoD); }
    ocrDoneStep('ocr-d4');
    ocrModResultado = resultado;
    ocrMostrarResultado(resultado, ocrModDriveSel.map(f=>f.name).join(', '));
  } catch(err){
    ocrResetProg('ocr-pw-d');
    if(err.message === 'SIN_KEY'){
      document.getElementById('ocr-no-key').classList.add('show');
    } else {
      if(typeof toast==='function') toast('❌ '+err.message, 'err');
    }
    const _ocrDriveMsg = err?.message || err?.toString() || 'Error desconocido';
    console.error('[OCR-Drive]', _ocrDriveMsg, err);
    registrarError('OCR-Drive', err);
  }
}
// ─── MOSTRAR RESULTADO ────────────────────────────────────────────────
function ocrMostrarResultado(d, fuente){
  const rw = document.getElementById('ocr-result');
  if(!rw) return;
  rw.style.display = 'block';
  // Datos del juicio
  const campos = [
    {l:'N° Expediente',v:d.numeroExpediente},{l:'Tribunal',v:d.tribunal},
    {l:'Juzgado',v:d.juzgado},{l:'Ciudad',v:d.ciudad},
    {l:'Tipo/Materia',v:[d.tipoJuicio,d.materia&&d.materia!=='N/A'?d.materia:''].filter(Boolean).join(' · ')},
    {l:'Estado',v:d.estadoProceso},{l:'Inicio',v:d.fechaInicio},
    {l:'Última actuación',v:d.ultimaActuacion},{l:'Próxima audiencia',v:d.proximaAudiencia},
    {l:'Montos',v:d.montos}
  ];
  document.getElementById('ocr-r-datos').innerHTML = campos
    .filter(c => c.v && c.v !== 'N/A' && c.v.trim())
    .map(c => '<div class="ocr-campo"><div class="ocr-campo-lbl">'+c.l+'</div><div class="ocr-campo-val">'+c.v+'</div></div>')
    .join('');
  // Partes
  const aOk = d.actor?.nombre && d.actor.nombre !== 'N/A';
  const dOk = d.demandado?.nombre && d.demandado.nombre !== 'N/A';
  if(aOk || dOk){
    document.getElementById('ocr-r-partes').innerHTML =
      '<div class="ocr-parte actor"><div class="ocr-parte-lbl">Actor / Quejoso</div><div class="ocr-parte-nom">'+escHTML(d.actor?.nombre||'N/A')+'</div></div>'
      +'<div class="ocr-parte demandado"><div class="ocr-parte-lbl">Demandado / Autoridad</div><div class="ocr-parte-nom">'+escHTML(d.demandado?.nombre||'N/A')+'</div></div>';
    document.getElementById('ocr-r-partes-sec').style.display = 'block';
  } else {
    document.getElementById('ocr-r-partes-sec').style.display = 'none';
  }
  // Resumen
  const texto = d.resumenEjecutivo || 'No disponible';
  document.getElementById('ocr-r-resumen').innerHTML =
    texto.split('\n\n').filter(p=>p.trim()).map(p=>'<p>'+p+'</p>').join('');
  // Timeline
  const hechos = Array.isArray(d.hechosRelevantes) ? d.hechosRelevantes : [];
  document.getElementById('ocr-r-tl').innerHTML = hechos.length > 0
    ? hechos.map(h=>'<li><div class="ocr-tl-dot"></div><div class="ocr-tl-date">'+(h.fecha||'—')+'</div><div class="ocr-tl-txt">'+h.hecho+'</div></li>').join('')
    : '<li><div class="ocr-tl-dot"></div><div class="ocr-tl-txt" style="color:var(--muted);">No se detectaron fechas específicas</div></li>';
  // OCR text
  document.getElementById('ocr-r-ocr').textContent = d.textOCR || '(no disponible)';
  // Scroll al resultado
  rw.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
// ─── USAR RESUMEN EN ENTRADA ──────────────────────────────────────────
// El botón principal: toma el resumen de Gemini y lo inserta en el textarea
// del historial para guardarlo como entrada cronológica
function ocrUsarResumen(){
  if(!ocrModResultado) return;
  const d = ocrModResultado;
  const ta = document.getElementById('hj-texto');
  if(!ta) return;
  // Construir texto formateado para el historial
  let texto = '';
  if(d.resumenEjecutivo && d.resumenEjecutivo !== 'N/A'){
    texto = d.resumenEjecutivo;
  }
  // Agregar datos clave al inicio si están disponibles
  const datos = [];
  if(d.numeroExpediente && d.numeroExpediente !== 'N/A') datos.push('Exp. '+d.numeroExpediente);
  if(d.ultimaActuacion  && d.ultimaActuacion  !== 'N/A') datos.push('Fecha: '+d.ultimaActuacion);
  if(d.proximaAudiencia && d.proximaAudiencia !== 'N/A') datos.push('Próx. audiencia: '+d.proximaAudiencia);
  if(d.montos && d.montos !== 'N/A') datos.push('Montos: '+d.montos);
  if(datos.length) texto = '['+datos.join(' · ')+']\n\n'+texto;
  ta.value = texto.trim();
  ta.style.borderColor = 'var(--gold)';
  setTimeout(() => { ta.style.borderColor = 'var(--border-l)'; }, 2500);
  ta.dispatchEvent(new Event('input'));
  // Auto-detectar tipo de entrada
  const t = texto.toLowerCase();
  const tipoSel = document.getElementById('hj-tipo');
  if(tipoSel){
    if(t.includes('acuerdo'))         tipoSel.value = 'acuerdo';
    else if(t.includes('requerimiento')) tipoSel.value = 'requerimiento';
    else if(t.includes('audiencia'))  tipoSel.value = 'audiencia';
    else if(t.includes('notificaci')) tipoSel.value = 'notificacion';
    else if(t.includes('apelaci')||t.includes('recurso')) tipoSel.value = 'apelacion';
    else if(t.includes('sentencia'))  tipoSel.value = 'acuerdo';
  }
  // Auto-detectar fecha
  const fechaMatch = texto.match(/\b(\d{1,2})[\s\/\-](?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)[\s\/\-,\s]*(20\d{2})/i);
  if(fechaMatch){
    const meses = {enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',
                   julio:'07',agosto:'08',septiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};
    const dia = fechaMatch[1].padStart(2,'0');
    const mes = meses[fechaMatch[2].toLowerCase()] || '01';
    const anio = fechaMatch[3];
    const fechaInp = document.getElementById('hj-fecha');
    if(fechaInp && !fechaInp.value) fechaInp.value = anio+'-'+mes+'-'+dia;
  }
  if(typeof toast==='function') toast('✅ Resumen cargado en la entrada — revisa y guarda','ok');
  // Scroll al textarea
  ta.scrollIntoView({ behavior:'smooth', block:'nearest' });
  ta.focus();
}
// ─── NUEVO ANÁLISIS ───────────────────────────────────────────────────
function ocrNuevoAnalisis(){
  ocrModArchivos = [];
  ocrModDriveSel = [];
  ocrRenderPrevs();
  const selN = document.getElementById('ocr-sel-n');
  if(selN) selN.textContent = '0';
  document.getElementById('ocr-result').style.display = 'none';
  ocrResetProg('ocr-pw-s');
  ocrResetProg('ocr-pw-d');
  document.getElementById('ocr-no-key').classList.remove('show');
  ocrModResultado = null;
}
// Inicializar estado Drive cuando se abre el formulario
const _hjAbrirNueva_orig = typeof hjAbrirNueva === 'function' ? hjAbrirNueva : null;
if(_hjAbrirNueva_orig){
  window.hjAbrirNueva = function(){
    _hjAbrirNueva_orig();
    ocrNuevoAnalisis();
    ocrModActualizarDrive();
  };
}
// ─── CONFIG OCR INLINE (botón ⚙️ dentro del formulario de nueva entrada) ───
function ocrAbrirConfig(){
  const modal = document.getElementById('ocr-cfg-modal');
  if(!modal) return;
  // Cargar valores guardados
  const keyInp    = document.getElementById('ocr-cfg-key-inline');
  const driveInp  = document.getElementById('ocr-cfg-drive-inline');
  const profInp   = document.getElementById('ocr-cfg-prof-inline');
  const extInp    = document.getElementById('ocr-cfg-extra-inline');
  if(keyInp)   keyInp.value   = ocrModGetKey();
  if(driveInp) driveInp.value = ocrModGetDriveToken();
  if(profInp)  profInp.value  = ocrModGetProf();
  if(extInp)   extInp.value   = ocrModGetExtra();
  modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
  if(modal.style.display !== 'none') ocrModActualizarDrive();
}
function ocrCerrarConfig(){
  const modal = document.getElementById('ocr-cfg-modal');
  if(modal) modal.style.display = 'none';
}
function ocrGuardarConfigInline(){
  const key   = (document.getElementById('ocr-cfg-key-inline')?.value||'').trim();
  const token = (document.getElementById('ocr-cfg-drive-inline')?.value||'').trim();
  const prof  = document.getElementById('ocr-cfg-prof-inline')?.value||'detallado';
  const extra = document.getElementById('ocr-cfg-extra-inline')?.value||'';
  // 1. La llave de IA solo se conserva durante la sesión actual
  if(key) _secretSessionSet('lex-gemini-key', key);
  if(token){
    try{ localStorage.setItem('lex-drive-token',       token); } catch(e){ registrarError('localStorage.setItem', e); }
    try{ localStorage.setItem('lex-ocr-drive-token',   token); } catch(e){ registrarError('localStorage.setItem', e); }
  }
  try{ localStorage.setItem('lex-ocr-prof',  prof); } catch(e){ registrarError('localStorage.setItem', e); }
  try{ localStorage.setItem('lex-ocr-extra', extra); } catch(e){ registrarError('localStorage.setItem', e); }
  // 2. Guardar en caché global inmediato
  if(key)   window._geminiKeyCached  = key;
  if(token) window._ocrDriveTokenCached = token;
  // 3. Guardar únicamente la configuración no secreta en Supabase
  if(window.SB){
    const ts = new Date().toISOString();
    const ops = [];
    if(token && token.length > 10) ops.push({id:'drive_token',       valor: token, updated_at: ts});
    if(prof)                        ops.push({id:'ocr_prof',          valor: prof,  updated_at: ts});
    if(extra)                       ops.push({id:'ocr_extra',         valor: extra, updated_at: ts});
    if(ops.length > 0){
      window.SB.from('configuracion')
        .upsert(ops)
        .then(({error})=>{
          if(error){ console.warn('[OCR-Config] Error guardando en Supabase:', error.message); }
          else { console.log('[OCR-Config] ✅ Configuración guardada en Supabase'); }
        })
        .catch(e=> console.warn('[OCR-Config] Error Supabase:', e.message));
    }
  }
  if(typeof toast==='function') toast('✓ OCR configurado; la llave de IA solo dura esta sesión','ok');
  ocrCerrarConfig();
  document.getElementById('ocr-no-key').classList.remove('show');
}
// ─── GESTIÓN DE ACCESOS — lista de usuarios del despacho + habilitar/deshabilitar
// + cambiar contraseña, todo en un solo panel. La Service Role Key de Supabase ya
// NO se maneja aquí ni en el navegador — vive únicamente como secreto dentro del
// worker de Cloudflare (mismo que sube los PDF a R2); el navegador solo llama a
// /admin/usuarios* con el mismo X-Auth-Token que ya se usaba para R2. Las
// contraseñas NUNCA se leen ni se muestran — Supabase no las expone (quedan
// cifradas) — solo se pueden ASIGNAR nuevas.
window._gaUsuarios = [];
async function cargarGestionAccesos(){
  const st  = document.getElementById('ga-status');
  const setSt = (msg,color)=>{ if(st){ st.textContent=msg; st.style.color=color||'var(--rojo)'; } };
  if(!window.SB_DESPACHO_ID){ setSt('⚠ No se encontró el despacho activo'); return; }
  setSt('🔄 Cargando usuarios...','var(--muted)');
  try{
    const resp = await fetch(R2_WORKER+'/admin/usuarios?despacho_id='+encodeURIComponent(window.SB_DESPACHO_ID), {
      headers: { 'X-Auth-Token': await _r2AuthToken() }
    });
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok){ setSt('❌ '+(data.error||resp.status)); return; }
    window._gaUsuarios = data.usuarios || [];
    if(!window._gaUsuarios.length){ setSt('No hay usuarios registrados en este despacho'); return; }
    _renderGestionAccesos();
    const tw = document.getElementById('ga-tabla-wrap'); if(tw) tw.style.display = 'block';
    setSt('✓ '+window._gaUsuarios.length+' usuario(s) cargado(s)','var(--verde)');
  } catch(e){
    setSt('❌ '+e.message);
    console.error('[cargarGestionAccesos]', e);
  }
}
function _renderGestionAccesos(){
  const tbody = document.getElementById('ga-tbody');
  if(!tbody) return;
  tbody.innerHTML = window._gaUsuarios.map(function(u,i){
    const badge = u.habilitado===null
      ? '<span style="color:var(--muted);">—</span>'
      : (u.habilitado
          ? '<span style="color:#1a7a3a;font-weight:700;">✓ Habilitado</span>'
          : '<span style="color:#c0161a;font-weight:700;">🚫 Deshabilitado</span>');
    const _esAdminRow = String(u.rol||'').toLowerCase()==='admin';
    const _teFila = (!_esAdminRow && typeof _teObtener==='function') ? _teObtener(u.email) : null;
    const _teFilaDesc = (typeof _teDescribir==='function') ? _teDescribir(_teFila) : null;
    const teEstadoHtml = _teFilaDesc
      ? '<div style="margin-top:3px;font-size:0.68rem;color:#8a5a10;">⏱ '+escHTML(_teFilaDesc)+'</div>'
      : '';
    return '<tr style="border-bottom:1px solid var(--border-l);">'
      +'<td style="padding:8px 10px;">'+escHTML(u.email)+'</td>'
      +'<td style="padding:8px 10px;">'+escHTML(u.nombre)+'</td>'
      +'<td style="padding:8px 10px;text-transform:capitalize;">'+escHTML(u.rol)+'</td>'
      +'<td style="padding:8px 10px;">'+badge+teEstadoHtml+'</td>'
      +'<td style="padding:8px 10px;white-space:nowrap;">'
        +(_esAdminRow
          ? '<span title="Los administradores no se pueden deshabilitar" style="margin-right:6px;padding:5px 10px;border-radius:6px;border:1px solid var(--border-l);color:var(--muted);font-size:0.72rem;display:inline-block;">🛡 Protegido</span>'
          : '<button onclick="_gaToggleHabilitado('+i+')" style="margin-right:6px;padding:5px 10px;border-radius:6px;border:1px solid '+(u.habilitado?'#c0161a':'#1a7a3a')+';background:none;color:'+(u.habilitado?'#c0161a':'#1a7a3a')+';font-size:0.72rem;cursor:pointer;">'+(u.habilitado?'🔒 Deshabilitar':'🔓 Habilitar')+'</button>')
        +'<button onclick="_gaTogglePassRow('+i+')" style="margin-right:6px;padding:5px 10px;border-radius:6px;border:1px solid var(--azul);background:none;color:var(--azul);font-size:0.72rem;cursor:pointer;">🔑 Cambiar contraseña</button>'
        +(_esAdminRow ? '' : '<button onclick="_gaToggleTiempoExtraRow('+i+')" style="padding:5px 10px;border-radius:6px;border:1px solid #a8621a;background:none;color:#a8621a;font-size:0.72rem;cursor:pointer;">⏱ Tiempo extra</button>')
      +'</td>'
    +'</tr>'
    +'<tr id="ga-passrow-'+i+'" style="display:none;background:#f8fafd;">'
      +'<td colspan="5" style="padding:10px;">'
        +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
          +'<input type="password" id="ga-newpass-'+i+'" placeholder="Nueva contraseña (mín. 6)" style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.8rem;box-sizing:border-box;">'
          +'<input type="password" id="ga-confpass-'+i+'" placeholder="Confirmar" style="flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--border-l);border-radius:6px;font-size:0.8rem;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\'){ event.preventDefault(); _gaGuardarPassword('+i+'); }">'
          +'<button onclick="_gaGuardarPassword('+i+')" style="padding:7px 14px;border-radius:6px;background:var(--azul);color:#fff;border:none;font-size:0.78rem;cursor:pointer;">Guardar</button>'
          +'<span id="ga-passmsg-'+i+'" style="font-size:0.72rem;"></span>'
        +'</div>'
      +'</td>'
    +'</tr>'
    +(_esAdminRow ? '' :
      '<tr id="ga-terow-'+i+'" style="display:none;background:#fff8ec;">'
        +'<td colspan="5" style="padding:10px;">'
          +'<div id="ga-tebtns-'+i+'" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
            +'<span style="font-size:0.72rem;color:var(--muted);">Abrir hoy hasta:</span>'
            +'<input type="time" id="ga-tehora-'+i+'" style="padding:6px 8px;border:1px solid var(--border-l);border-radius:6px;font-size:0.78rem;">'
            +'<button onclick="_gaAplicarTiempoExtraHora('+i+')" style="padding:6px 12px;border-radius:6px;background:#a8621a;color:#fff;border:none;font-size:0.72rem;cursor:pointer;">Aplicar hora</button>'
            +'<button onclick="_gaAplicarTiempoExtraIndefinido('+i+',false)" style="padding:6px 12px;border-radius:6px;border:1px solid #a8621a;background:none;color:#a8621a;font-size:0.72rem;cursor:pointer;">Abierto hasta las 11:59 pm</button>'
            +'<button onclick="_gaAplicarTiempoExtraIndefinido('+i+',true)" style="padding:6px 12px;border-radius:6px;border:1px solid #a8621a;background:none;color:#a8621a;font-size:0.72rem;cursor:pointer;">Abierto permanente</button>'
            +(_teFila ? '<button onclick="_gaQuitarTiempoExtra('+i+')" style="padding:6px 12px;border-radius:6px;border:1px solid #c0161a;background:none;color:#c0161a;font-size:0.72rem;cursor:pointer;">✕ Quitar tiempo extra</button>' : '')
            +'<span id="ga-temsg-'+i+'" style="font-size:0.72rem;display:inline-flex;align-items:center;gap:6px;"></span>'
          +'</div>'
        +'</td>'
      +'</tr>');
  }).join('');
}
function _gaTogglePassRow(i){
  const row = document.getElementById('ga-passrow-'+i);
  if(row) row.style.display = (row.style.display==='none' || !row.style.display) ? 'table-row' : 'none';
}
function _gaToggleTiempoExtraRow(i){
  const row = document.getElementById('ga-terow-'+i);
  if(row) row.style.display = (row.style.display==='none' || !row.style.display) ? 'table-row' : 'none';
}
function _gaAplicarTiempoExtraHora(i){
  const u = window._gaUsuarios[i];
  if(!u || !u.email) return;
  const inp = document.getElementById('ga-tehora-'+i);
  const val = inp ? inp.value : '';
  if(!val){ if(typeof toast==='function') toast('⚠ Elige una hora primero','err'); return; }
  _teEjecutar(i, u.email, { tipo:'hora', hasta: val });
}
function _gaAplicarTiempoExtraIndefinido(i, permanente){
  const u = window._gaUsuarios[i];
  if(!u || !u.email) return;
  _teEjecutar(i, u.email, { tipo: permanente ? 'indefinido_permanente' : 'indefinido_hoy' });
}
function _gaQuitarTiempoExtra(i){
  const u = window._gaUsuarios[i];
  if(!u || !u.email) return;
  if(!confirm('¿Quitar el tiempo extra de '+u.email+'? Si ya pasó su horario normal, el sistema se le cerrará de inmediato.')) return;
  _teEjecutar(i, u.email, null); // null = quitar
}
// ── Persistencia + tiempo real del tiempo extra ─────────────────────────
// Mientras se guarda de verdad en Supabase se muestra la misma ruedita
// giratoria (.ocr-spin) que ya se usa en otros botones lentos del sistema,
// con los botones de la fila deshabilitados para evitar doble clic — nada
// de responder "en silencio" en segundo plano. Al terminar (bien o mal) se
// vuelve a pintar la fila con el resultado real y un toast de confirmación.
async function _teEjecutar(i, email, opts){
  const key   = String(email).toLowerCase();
  const btns  = document.getElementById('ga-tebtns-'+i);
  const msgEl = document.getElementById('ga-temsg-'+i);
  if(btns){
    const _elems = btns.querySelectorAll('button, input');
    for(let b = 0; b < _elems.length; b++) _elems[b].disabled = true;
  }
  if(msgEl) msgEl.innerHTML = '<span class="ocr-spin"></span> Guardando...';
  let entry = null;
  if(opts){
    entry = {
      tipo: opts.tipo,
      fecha: _teClaveHoy(),
      otorgadoPor: (typeof empNombre==='function') ? empNombre() : 'Admin',
      otorgadoTs: Date.now()
    };
    if(opts.tipo === 'hora') entry.hasta = opts.hasta;
  }
  if(typeof D !== 'undefined'){
    if(!D.tiempoExtra) D.tiempoExtra = {};
    if(entry) D.tiempoExtra[key] = entry; else delete D.tiempoExtra[key];
  }
  try{
    _ultimoSyncPropio = Date.now();
    if(typeof syncEstadoSupabase === 'function') await syncEstadoSupabase();
    _teBroadcast(key, entry);
    if(typeof toast==='function') toast(entry ? '⏱ Tiempo extra otorgado a '+email : '⏱ Tiempo extra retirado de '+email, 'ok');
  }catch(e){
    console.warn('[TiempoExtra]', e);
    if(typeof toast==='function') toast('❌ No se pudo guardar el tiempo extra: '+e.message, 'err');
  }finally{
    _renderGestionAccesos();
  }
}
function _teBroadcast(key, entry){
  if(!(window._lexRealtimeChannel && window._lexRealtimeChannel.state === 'joined')) return;
  window._lexRealtimeChannel.send({
    type: 'broadcast',
    event: 'tiempo_extra_actualizado',
    payload: { email: key, entry: entry, ts: Date.now() }
  }).catch(function(e){ console.warn('[TiempoExtra] broadcast:', e); });
}
async function _gaToggleHabilitado(i){
  const u = window._gaUsuarios[i];
  if(!u){ return; }
  if(String(u.rol||'').toLowerCase()==='admin'){ if(typeof toast==='function') toast('🛡 Los administradores no se pueden deshabilitar','err'); return; }
  if(u.habilitado === null){ if(typeof toast==='function') toast('⚠ Este usuario no se encontró en Auth','err'); return; }
  const nuevoHabilitado = !u.habilitado;
  const confirmMsg = nuevoHabilitado
    ? '¿Habilitar el acceso de '+u.email+'?'
    : '¿Deshabilitar el acceso de '+u.email+'? No podrá iniciar sesión hasta que lo vuelvas a habilitar.';
  if(!confirm(confirmMsg)) return;
  try{
    const resp = await fetch(R2_WORKER+'/admin/usuarios/toggle', {
      method:'POST',
      headers:{ 'X-Auth-Token': await _r2AuthToken(), 'Content-Type':'application/json' },
      body: JSON.stringify({ despacho_id: window.SB_DESPACHO_ID, user_id: u.userId, habilitar: nuevoHabilitado })
    });
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok || data.error){
      if(typeof toast==='function') toast('❌ Error: '+(data.error||resp.status),'err');
      return;
    }
    u.habilitado = nuevoHabilitado;
    _renderGestionAccesos();
    if(typeof toast==='function') toast(nuevoHabilitado ? '🔓 Acceso habilitado' : '🔒 Acceso deshabilitado','ok');
  } catch(e){
    console.error('[_gaToggleHabilitado]', e);
    if(typeof toast==='function') toast('❌ '+e.message,'err');
  }
}
async function _gaGuardarPassword(i){
  const u = window._gaUsuarios[i];
  const newPass  = (document.getElementById('ga-newpass-'+i)?.value||'').trim();
  const confPass = (document.getElementById('ga-confpass-'+i)?.value||'').trim();
  const msgEl = document.getElementById('ga-passmsg-'+i);
  const setMsg = (t,c)=>{ if(msgEl){ msgEl.textContent=t; msgEl.style.color=c||'var(--rojo)'; } };
  if(!u){ return; }
  if(!newPass || !confPass){ setMsg('⚠ Completa ambos campos'); return; }
  if(newPass.length < 6){ setMsg('⚠ Mínimo 6 caracteres'); return; }
  if(newPass !== confPass){ setMsg('⚠ No coinciden'); return; }
  setMsg('🔄 Guardando...','var(--muted)');
  try{
    const resp = await fetch(R2_WORKER+'/admin/usuarios/password', {
      method:'POST',
      headers:{ 'X-Auth-Token': await _r2AuthToken(), 'Content-Type':'application/json' },
      body: JSON.stringify({ despacho_id: window.SB_DESPACHO_ID, user_id: u.userId, password: newPass })
    });
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok || data.error){
      setMsg('❌ '+(data.error||resp.status));
      return;
    }
    document.getElementById('ga-newpass-'+i).value='';
    document.getElementById('ga-confpass-'+i).value='';
    if(typeof toast==='function') toast('🔐 Contraseña de '+u.email+' actualizada','ok');
    // Se muestra UNA vez aquí (recién asignada, aún visible en pantalla) con botón
    // de copiar, para que se pueda pegar directo en un mensaje a la empleada.
    // No se guarda en ningún lado — se pierde al cerrar esta fila o recargar.
    if(msgEl){
      msgEl.innerHTML = '<span style="color:var(--verde);">✓ Actualizada:</span> '
        + '<code id="ga-passval-'+i+'" style="background:#eef3fb;padding:2px 6px;border-radius:4px;font-family:monospace;">'+escHTML(newPass)+'</code> '
        + '<button type="button" onclick="_gaCopiarClave(\''+i+'\', this)" style="margin-left:4px;padding:2px 8px;border-radius:5px;border:1px solid var(--azul);background:#fff;color:var(--azul);font-size:0.68rem;cursor:pointer;">📋 Copiar</button>';
    }
  } catch(e){
    setMsg('❌ '+e.message);
    console.error('[_gaGuardarPassword]', e);
  }
}
function _gaCopiarClave(i, btnEl){
  const el = document.getElementById('ga-passval-'+i);
  if(!el) return;
  const valor = el.textContent;
  const _feedback = function(ok){
    if(!btnEl) return;
    const original = '📋 Copiar';
    btnEl.textContent = ok ? '✓ Copiado' : '❌ No se pudo copiar';
    setTimeout(function(){ if(btnEl) btnEl.textContent = original; }, 1500);
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(valor).then(function(){ _feedback(true); }).catch(function(){ _feedback(false); });
  } else {
    try {
      const ta = document.createElement('textarea');
      ta.value = valor; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      _feedback(true);
    } catch(e){ _feedback(false); }
  }
}
// ─── CAMBIAR CONTRASEÑA ─────────────────────────────────────────────────────
// ─── Contador de folios ───────────────────────────────────────────────────────
function cfgPrevisualizarFolio(val){
  const n = parseInt(val);
  const prev = document.getElementById('cfg-folio-preview');
  if(!prev) return;
  if(!n || n < 1){ prev.textContent = ''; return; }
  const anio = String((appData?.anioFolioActual || new Date().getFullYear())).slice(-2);
  prev.textContent = 'Próximo folio: ' + anio + '-' + String(n).padStart(3,'0') + 'A';
}
function cfgMostrarFolioActual(){
  const el = document.getElementById('cfg-folio-actual-info');
  if(!el) return;
  const actual = appData?.folioActual || 1;
  const ultimo = actual - 1;
  const anio   = String((appData?.anioFolioActual || new Date().getFullYear())).slice(-2);
  const ultimoStr = ultimo > 0 ? anio+'-'+String(ultimo).padStart(3,'0') : '—';
  const proximoStr = anio+'-'+String(actual).padStart(3,'0');
  el.innerHTML = 'Último generado: <strong>'+ultimoStr+'</strong> &nbsp;·&nbsp; Próximo: <strong>'+proximoStr+'</strong>';
  const inp = document.getElementById('cfg-nuevo-folio');
  if(inp && !inp.value) inp.placeholder = String(actual);
}
async function resetearContadorFolios(valor){
  const n = parseInt(valor);
  if(!n || n < 1){ if(typeof toast==='function') toast('Ingresa un número válido (mínimo 1)','err'); return; }
  const anio = String((appData?.anioFolioActual || new Date().getFullYear())).slice(-2);
  const folioStr = anio+'-'+String(n).padStart(3,'0')+'A';
  if(!confirm('¿Actualizar el contador de folios?\n\nEl próximo recibo generado será el '+folioStr+'.\n\nLos recibos ya existentes no se modifican.')){ return; }
  appData.folioActual = n;
  if(typeof REC !== 'undefined' && REC) REC.folioActual = n;
  // Marcar antes de guardar para que el postgres_changes propio sea ignorado
  _ultimoSyncPropio = Date.now();
  try {
    if(typeof actualizarArchivoControl === 'function') await actualizarArchivoControl();
    if(typeof toast === 'function') toast('Contador actualizado — próximo folio: '+folioStr,'ok');
    cfgMostrarFolioActual();
    const prev = document.getElementById('cfg-folio-preview');
    if(prev) prev.textContent = '';
    const inp = document.getElementById('cfg-nuevo-folio');
    if(inp) inp.value = '';
  } catch(e){
    if(typeof toast==='function') toast('Error al guardar: '+e.message,'err');
  }
}
// ─── Renumeración de folios ───────────────────────────────────────────────────
function cfgToggleRenum(){
  const body  = document.getElementById('cfg-renum-body');
  const arrow = document.getElementById('cfg-renum-arrow');
  if(!body) return;
  const abierto = body.style.display !== 'none';
  body.style.display  = abierto ? 'none' : 'block';
  if(arrow) arrow.style.transform = abierto ? '' : 'rotate(90deg)';
}
function cfgRenumCargar(){
  const anioActual = appData?.anioFolioActual || new Date().getFullYear();
  const todos = (appData.recibos || [])
    .filter(r => r.anio_folio === anioActual || (!r.anio_folio && r.folio > 0))
    .sort((a, b) => a.folio - b.folio);
  const lista = document.getElementById('cfg-renum-lista');
  const st    = document.getElementById('cfg-renum-status');
  if(!lista) return;
  if(!todos.length){
    lista.innerHTML = '<div style="padding:20px;text-align:center;font-size:0.76rem;color:var(--muted);">Sin recibos del año '+anioActual+'.</div>';
    return;
  }
  if(st) st.textContent = todos.length + ' recibos';
  lista.innerHTML = todos.map((r, i) => {
    const estado = r.cancelado ? 'Anulado' : (r.saldoPendiente > 0 ? 'Pendiente' : 'Liquidado');
    const colorEst = r.cancelado ? '#c0160a' : (r.saldoPendiente > 0 ? '#b07a00' : '#1a7a3a');
    const bg = i % 2 === 0 ? '#ffffff' : '#f5f8ff';
    return `<div style="display:grid;grid-template-columns:90px 90px 1fr 80px 70px;gap:4px;padding:5px 8px;background:${bg};align-items:center;border-bottom:1px solid #dde6f5;">
      <div style="font-family:'DM Mono',monospace;font-size:0.72rem;color:var(--ink);font-weight:600;">${folioFormato(r.folio, r.anio_folio)}${r.letra||'A'}${r.esComplemento?'<span style="color:#999;font-size:0.6rem;"> comp</span>':''}</div>
      <div><input type="number" min="1" step="1"
        id="renum-inp-${i}" data-idx="${i}" data-oldfolio="${r.folio}"
        value="${r.folio}"
        style="width:70px;padding:3px 6px;border:1.5px solid #b8ccf0;border-radius:4px;font-family:'DM Mono',monospace;font-size:0.76rem;color:var(--azul);font-weight:700;outline:none;"
        onfocus="this.style.borderColor='var(--azul)'" onblur="this.style.borderColor='#b8ccf0'"></div>
      <div style="font-size:0.72rem;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHTML(r.nombre||'')}">${escHTML((r.nombre||'—').split(' ').slice(0,3).join(' '))}</div>
      <div style="font-family:'DM Mono',monospace;font-size:0.68rem;color:var(--muted);">${escHTML(r.fecha_recibo||r.fecha||'—')}</div>
      <div style="font-size:0.68rem;font-weight:600;color:${colorEst};">${estado}</div>
    </div>`;
  }).join('');
  // guardar lista en variable para acceso posterior
  window._cfgRenumTodos = todos;
}
function cfgRenumAuto(){
  const todos = window._cfgRenumTodos;
  if(!todos || !todos.length){ if(typeof toast==='function') toast('Carga la lista primero','err'); return; }
  todos.forEach((r, i) => {
    const inp = document.getElementById('renum-inp-'+i);
    if(inp) inp.value = i + 1;
  });
  const st = document.getElementById('cfg-renum-status');
  if(st) st.textContent = todos.length+' recibos · listo para aplicar';
}
async function cfgRenumAplicar(){
  const todos = window._cfgRenumTodos;
  if(!todos || !todos.length){ if(typeof toast==='function') toast('Carga la lista primero','err'); return; }
  const anioActual = appData?.anioFolioActual || new Date().getFullYear();
  const anio2 = String(anioActual).slice(-2);
  // Leer valores de los inputs y construir mapa
  const mapa = new Map(); // oldFolio → newFolio
  const nuevosVistos = new Set();
  let hayError = false;
  todos.forEach((r, i) => {
    const inp = document.getElementById('renum-inp-'+i);
    const nF  = inp ? parseInt(inp.value) : NaN;
    if(!nF || nF < 1){ hayError = true; if(inp) inp.style.borderColor='#c0160a'; return; }
    if(inp) inp.style.borderColor = '#b8ccf0';
    if(nuevosVistos.has(nF)){
      hayError = true;
      if(typeof toast==='function') toast('Folio duplicado: '+nF+' — corrige antes de aplicar','err');
      if(inp) inp.style.borderColor='#c0160a';
    }
    nuevosVistos.add(nF);
    mapa.set(r.folio, nF);
  });
  if(hayError){ if(typeof toast==='function') toast('Corrige los errores marcados en rojo','err'); return; }
  const maxNuevo = Math.max(...nuevosVistos);
  const siguiente = maxNuevo + 1;
  const proximoStr = anio2+'-'+String(siguiente).padStart(3,'0')+'A';
  const resumen = todos.slice(0,6).map(r =>
    '  '+folioFormato(r.folio, r.anio_folio)+(r.letra||'A')+' → '+anio2+'-'+String(mapa.get(r.folio)).padStart(3,'0')+(r.letra||'A')
  ).join('\n')+(todos.length > 6 ? '\n  ...' : '');
  if(!confirm('Aplicar renumeración a '+todos.length+' recibos:\n\n'+resumen+'\n\nPróximo folio: '+proximoStr+'\n\n¿Confirmar?')) return;
  try {
    await _aplicarMapaRenumeracion(mapa, anioActual, siguiente);
    cfgRenumCargar(); // refrescar lista con nuevos folios
    if(typeof showModal==='function')
      showModal('Renumeración completada', todos.length+' recibos renumerados.\nPróximo folio: '+proximoStr+'.');
  } catch(e){
    if(typeof toast==='function') toast('Error: '+e.message,'err');
    console.error('[renumerar]', e);
  }
}
async function _aplicarMapaRenumeracion(mapa, anioActual, siguiente){
  // 1 — Recibos
  (appData.recibos || []).forEach(r => {
    const nF = mapa.get(r.folio);
    if(nF !== undefined){
      r.folio   = nF;
      r.archivo = folioConLetra(nF, anioActual, r.letra||'A') + '.pdf';
      // Actualizar también el nombre descriptivo de R2
      if(typeof _nombreArchivoR2 === 'function'){
        r.archivoR2 = _nombreArchivoR2(folioConLetra(nF, anioActual, r.letra||'A'), r.nombre||'');
      }
    }
    if(r.folioAnterior != null && mapa.has(r.folioAnterior)) r.folioAnterior = mapa.get(r.folioAnterior);
    if(r.folioRef      != null && mapa.has(r.folioRef))      r.folioRef      = mapa.get(r.folioRef);
  });
  // 2 — Pendientes
  (D.pendientes || []).forEach(p => {
    if(p.reciboVinculadoFolio != null && mapa.has(p.reciboVinculadoFolio)){
      const nF = mapa.get(p.reciboVinculadoFolio);
      p.reciboVinculadoFolio = nF;
      if(p.id && p.id.startsWith('PEND-REC-')) p.id = 'PEND-REC-'+nF;
    }
  });
  // 3 — Movimientos contables
  (D.movimientos || []).forEach(m => {
    if(m.folio != null && mapa.has(m.folio)){
      const oldF = m.folio;
      const newF = mapa.get(oldF);
      m.folio = newF;
      if(m.id === 'M-REC-' + oldF) m.id = 'M-REC-' + newF;
      const oldStr = folioFormato(oldF, anioActual);
      const newStr = folioFormato(newF, anioActual);
      if(m.cat)        m.cat        = m.cat.replace('#'+oldStr, '#'+newStr);
      if(m.descripcion) m.descripcion = m.descripcion.replace('Recibo #'+oldStr, 'Recibo #'+newStr);
    }
  });
  // 4 — Gestiones
  (D.gestiones || []).forEach(g => {
    (g.recibosOficiales || []).forEach(r => {
      if(r.folio != null && mapa.has(r.folio)){
        const nF = mapa.get(r.folio);
        r.folio   = nF;
        r.archivo = folioConLetra(nF, anioActual, 'A') + '.pdf';
      }
    });
    (g.movimientos || []).forEach(m => {
      if(m.folioRecibo != null && mapa.has(m.folioRecibo)) m.folioRecibo = mapa.get(m.folioRecibo);
    });
  });
  // 5 — Historial de pagos
  if(appData.historialPagos){
    const nuevoHP = {};
    Object.entries(appData.historialPagos).forEach(([k, v]) => {
      const oldF = parseInt(k);
      const newF = mapa.has(oldF) ? mapa.get(oldF) : oldF;
      nuevoHP[newF] = (v||[]).map(p => ({...p, folio: p.folio != null && mapa.has(p.folio) ? mapa.get(p.folio) : p.folio}));
    });
    appData.historialPagos = nuevoHP;
  }
  // 6 — Historial de versiones
  if(appData.historialVersiones){
    const nuevoHV = {};
    Object.entries(appData.historialVersiones).forEach(([k, v]) => {
      const oldF = parseInt(k);
      nuevoHV[mapa.has(oldF) ? mapa.get(oldF) : oldF] = v;
    });
    appData.historialVersiones = nuevoHV;
  }
  // 7 — folioActual
  appData.folioActual = siguiente;
  if(typeof REC !== 'undefined' && REC) REC.folioActual = siguiente;
  // 8 — Persistir
  if(typeof save==='function') save();
  await actualizarArchivoControl();
  if(typeof renderHistorial==='function') renderHistorial();
  if(typeof renderPend==='function') renderPend();
  if(typeof badges==='function') badges();
  cfgMostrarFolioActual();
}
// ─── Guardar token de Drive directo desde el modal ⚙️ ────────────────────────
function ocrGuardarTokenDrive(){
  const inp = document.getElementById('ocr-cfg-drive-inline-v2');
  const token = (inp?.value||'').trim();
  if(!token){ if(typeof toast==='function') toast('⚠ Pega el token primero','err'); return; }
  // Guardar en TODAS las claves posibles para garantizar que se use
  try{ localStorage.setItem('lex-drive-token',       token); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('lex-ocr-drive-token',   token); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('drive_token',            token); } catch(e){ registrarError('localStorage.setItem', e); }
if(typeof toast==='function') toast('✅ Token de Drive guardado — haz clic en Ver todo','ok');
  ocrModActualizarDrive();
  // Cerrar config y abrir tab drive
  ocrCerrarConfig();
  setTimeout(()=>{
    const btnDrive = document.getElementById('ocr-btn-drive');
    if(btnDrive) ocrModTab('drive', btnDrive);
  }, 300);
}
