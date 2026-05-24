/* ═══════════════════════════════════════════════════════════════
   LEX-MÉXICO · restaurar.js
   Restaurar recibo, modo retroactivo, auditoría del sistema
   Dependencias: utils.js debe cargarse primero
═══════════════════════════════════════════════════════════════ */

// ═══ RESTAURAR RECIBO ════════════════════════════════════════════════════════
// Flujo:
//   Paso 1 — ingresa folio → busca automáticamente en appData + backups locales
//   Paso 2 — si no encontrado: botón "Buscar PDF" (Supabase Storage /recibos/)
//             o "Buscar en Backups" (Supabase Storage /backups/ — snapshots JSON)
//             o subir PDF manualmente como último recurso
//   Confirmar → inserta en appData y sincroniza con Supabase

let _rgenFolio = 0;
let _rgenRec   = null;

function abrirRestaurarRecibo(){
  _rgenFolio = 0; _rgenRec = null;
  document.getElementById('rgen-folio').value = '';
  document.getElementById('rgen-paso1-msg').textContent = '';
  document.getElementById('rgen-err').textContent = '';
  document.getElementById('rgen-paso2').style.display = 'none';
  document.getElementById('rgen-paso1').style.display = 'block';
  document.getElementById('overlay-restaurar-recibo').style.display = 'flex';
  setTimeout(()=>document.getElementById('rgen-folio').focus(), 100);
}
function cerrarRestaurarRecibo(){
  document.getElementById('overlay-restaurar-recibo').style.display = 'none';
  _rgenFolio = 0; _rgenRec = null;
}
function rgenVolverPaso1(){
  _rgenRec = null;
  document.getElementById('rgen-paso2').style.display = 'none';
  document.getElementById('rgen-paso1').style.display = 'block';
  document.getElementById('rgen-paso1-msg').textContent = '';
}

// ── PASO 1: buscar folio ─────────────────────────────────────────────────────
function rgenBuscarFolio(){
  const msg = document.getElementById('rgen-paso1-msg');
  const folioVal = parseInt(document.getElementById('rgen-folio').value) || 0;
  if(!folioVal || folioVal < 1){
    msg.style.color = '#c0161a';
    msg.textContent = '⚠ Ingresa un número de folio válido.';
    return;
  }
  const fs = folioFormato(folioVal);

  if(typeof appData !== 'undefined' && Array.isArray(appData.recibos)){
    if(appData.recibos.some(r => r.folio === folioVal)){
      msg.style.color = '#c0161a';
      msg.textContent = '⚠ El folio #'+fs+' ya está activo en el sistema.';
      return;
    }
  }

  _rgenFolio = folioVal;

  // Buscar en respaldos locales (localStorage)
  const encontrado = _rgenBuscarEnRespaldos(folioVal);

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
function _rgenBuscarEnRespaldos(folioVal){
  if(typeof appData !== 'undefined'){
    if(Array.isArray(appData.recibos)){
      const r = appData.recibos.find(x => x.folio === folioVal);
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
          const r = lista.find(x => x.folio === folioVal);
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
      '<div><strong>Cliente:</strong> '+nombre+'</div>'+
      '<div><strong>Fecha:</strong> '+fecha+'</div>'+
      '<div><strong>Trámite:</strong> '+concepto+'</div>'+
      '<div><strong>Total:</strong> '+totalR+'  ·  <strong>Anticipo:</strong> '+anticipoR+'</div>'+
      '<div><strong>Responsable:</strong> '+resp+'</div>'+
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
  p.innerHTML = '<strong>Folio #'+fs+'</strong> — '+nombre
    +'<br>📅 '+fecha+'  💰 Total: '+total+veh
    +'<br><span style="font-size:0.65rem;opacity:0.7;">Al confirmar se abrirá el formulario completo para revisar todos los datos.</span>';
  p.style.display='block';
}

// ── CONFIRMAR: cerrar modal y abrir formulario de Nuevo Recibo ───────────────
function rgenConfirmar(){
  const err=document.getElementById('rgen-err');
  err.textContent='';
  const fs=folioFormato(_rgenFolio);
  if(!_rgenFolio||!_rgenRec){ err.textContent='⚠ Sin datos para restaurar.'; return; }
  if(typeof appData==='undefined'||!Array.isArray(appData.recibos)){ err.textContent='❌ Sistema no listo.'; return; }
  if(appData.recibos.some(r=>r.folio===_rgenFolio)){ err.textContent='⚠ El folio #'+fs+' ya existe. Bórralo primero.'; return; }

  // Guardar datos de restauración globalmente
  window._restauracionFolio = _rgenFolio;
  window._restauracionRec   = _rgenRec;
  window._restauracionFecha = _rgenRec.fecha_recibo || _rgenRec.fecha || '';

  // Construir objeto compatible con cargarReciboEnFormulario
  const R = _rgenRec;
  const recCarga = {
    folio          : _rgenFolio,
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
    clase:R.clase||'', marca:R.marca||'', serie:R.serie||'', motor:R.motor||'',
    anio:R.anio||'', puertas:R.puertas||'', color_veh:R.color_veh||'',
    transmision:R.transmision||'', cilindros:R.cilindros||'', placa:R.placa||'',
    ultima_tenencia:R.ultima_tenencia||'', origen:R.origen||'', combustible:R.combustible||''
  };

  cerrarRestaurarRecibo();
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto();
  if(typeof ir==='function') ir('nuevo-recibo');

  setTimeout(()=>{
    if(typeof cargarReciboEnFormulario==='function') cargarReciboEnFormulario(recCarga);

    document.body.classList.remove('recibo-frozen','modo-actualizacion','modo-edicion-completa');
    document.body.classList.add('modo-restauracion');

    const fs2=folioFormato(_rgenFolio);
    const el=id=>document.getElementById(id);
    if(el('restauracion-folio-label')) el('restauracion-folio-label').textContent='#'+fs2;
    if(el('restauracion-fecha-label')) el('restauracion-fecha-label').textContent=window._restauracionFecha||'(edítala abajo)';
    if(el('btn-guardar-restauracion')) el('btn-guardar-restauracion').textContent='🔄 Restaurar Recibo #'+fs2;

    ['actions-normal','actions-consulta','actions-actualizacion','actions-post-print','actions-edicion-completa']
      .forEach(id=>{ const e=el(id); if(e) e.style.display='none'; });
    if(el('actions-restauracion')) el('actions-restauracion').style.display='flex';
    ['frozen-banner','consulta-banner','edicion-completa-banner']
      .forEach(id=>{ const e=el(id); if(e) e.style.display='none'; });

    // Descongelar completamente
    document.querySelectorAll('#panel-nuevo-recibo input,#panel-nuevo-recibo select,#panel-nuevo-recibo textarea')
      .forEach(e=>{ e.disabled=false; e.style.pointerEvents=''; e.style.opacity=''; });

    if(typeof setStatus==='function') setStatus('ok','Modo restauración — Folio #'+fs2+' · Completa y presiona Restaurar','ok');
  }, 80);
}

function cancelarRestauracion(){
  document.body.classList.remove('modo-restauracion');
  window._restauracionFolio=null; window._restauracionRec=null; window._restauracionFecha=null;
  const el=id=>document.getElementById(id);
  if(el('actions-restauracion')) el('actions-restauracion').style.display='none';
  if(el('restauracion-banner'))  el('restauracion-banner').style.display='none';
  if(el('actions-normal'))       el('actions-normal').style.display='flex';
  if(typeof limpiarFormCompleto==='function') limpiarFormCompleto();
  if(typeof setStatus==='function') setStatus('ok','Restauración cancelada','ok');
}

async function guardarRestauracion(){
  if(!window._restauracionFolio){ alert('Error: sin folio de restauración activo.'); return; }
  if(!sbSession||Date.now()>=sbExpiry){ mostrarDriveOverlay('guardarRestauracion'); return; }

  const folio    = window._restauracionFolio;
  const fs       = folioFormato(folio);
  const fechaOrig= window._restauracionFecha || fechaCDMX_ISO();
  const horaOrig = window._restauracionRec?.hora_recibo || window._restauracionRec?.hora || horaCDMX_HHMM();

  if(typeof appData!=='undefined'&&Array.isArray(appData.recibos)&&appData.recibos.some(r=>r.folio===folio)){
    alert('⚠ El folio #'+fs+' ya existe. Bórralo primero.'); return;
  }

  const clientes  = typeof getClientes  ==='function' ? getClientes()  : [];
  const conceptos = typeof getConceptos ==='function' ? getConceptos() : [];
  if(!clientes.length||!clientes[0].nombre){ setStatus('err','Ingresa el nombre del cliente','err'); return; }

  const anticipo       = parsePrecio($('anticipo').value);
  const total          = conceptos.reduce((s,c)=>s+(parseFloat(c.precio)||0),0);
  const saldoPendiente = Math.max(0,total-anticipo);
  const primerNombre   = clientes[0].nombre;

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
      serie       : $('serie')?.value||'',       motor:$('motor')?.value||'',
      anio        : $('anio')?.value||'',        puertas:$('puertas')?.value||'',
      color_veh   : $('color_veh')?.value||'',   transmision:$('transmision')?.value||'',
      cilindros   : $('cilindros')?.value||'',   placa:$('placa')?.value||'',
      ultima_tenencia:$('ultima_tenencia')?.value||'',
      origen      : $('origen')?.value||'',      combustible:$('combustible')?.value||'',
      copias      : typeof getDocumentosSeleccionados==='function'?getDocumentosSeleccionados():'[]',
      tipoTramite : document.querySelector('.tramite-btn.active')?.id==='btn-tramite-vehicular'?'vehicular':'normal',
      fecha_recibo:fechaOrig, hora_recibo:horaOrig,
      anticipo    : String(anticipo),
      responsable : $('responsable')?.value||'',
      nombre_cliente_firma:$('nombre_cliente_firma')?.value||primerNombre,
      conceptos,
      timestamp   : fechaOrig+'T'+horaOrig+':00',
      folioAnterior:null, historialPagosRef:[],
      totalGeneral:total, totalAbonado:anticipo, saldoNuevo:saldoPendiente,
      descripcionVehicular:''
    };

    const qrTexto  ='LEX-MEXICO|Folio:'+fs+'|'+primerNombre+'|'+fechaOrig+' '+horaOrig;
    const qrDataURL= typeof qrToDataURL==='function'?await qrToDataURL(qrTexto).catch(()=>null):null;
    const doc      = await generarPDF(datos, folio, qrDataURL);
    const pdfBase64= doc.output('datauristring');
    const nombreArchivo='Recibo_'+fs+'_'+primerNombre.replace(/\s+/g,'_')+'.pdf';

    if(typeof subirPDFaDrive==='function') try{ subirPDFaDrive(doc.output('blob'),nombreArchivo); }catch(e){ registrarError('catch vacio', e); }
    // guardarEnDirectorio puede fallar si save() no retorna promesa — envolver en try
    if(typeof guardarEnDirectorio==='function') try{ await guardarEnDirectorio(datos); }catch(e){ console.warn('[RESTAURAR] directorio:',e); }

    // Limpiar el input de archivo para evitar que onchange se dispare de nuevo
    try{ const inp=document.getElementById('rgen-file-pdf'); if(inp) inp.value=''; }catch(e){ registrarError('catch vacio', e); }

    const copiasParsed=(()=>{try{const p=JSON.parse(datos.copias||'{}');return p.docs||[];}catch(e){return [];}})();
    const rec={
      folio, nombre:primerNombre, fecha:fechaOrig, hora:horaOrig,
      fecha_recibo:fechaOrig, hora_recibo:horaOrig,
      archivo:nombreArchivo, pdfBase64, saldoPendiente,
      anticipo:String(anticipo), totalAbonado:anticipo, saldoNuevo:saldoPendiente,
      conceptos, total, generadoPor:datos.responsable||'RESTAURADO',
      responsable:datos.responsable||'RESTAURADO', clientes,
      tipoTramite:datos.tipoTramite, tramites:datos.tramites,
      tipo_doc:$('tipo_doc')?.value||'copia', copias:copiasParsed,
      clase:datos.clase, marca:datos.marca, serie:datos.serie, motor:datos.motor,
      anio:datos.anio, puertas:datos.puertas, color_veh:datos.color_veh,
      transmision:datos.transmision, cilindros:datos.cilindros, placa:datos.placa,
      ultima_tenencia:datos.ultima_tenencia, origen:datos.origen, combustible:datos.combustible,
      pagosParciales:anticipo>0?[{cantidad:anticipo,fecha:fechaOrig,nota:'Anticipo del recibo original'}]:[],
      esRestaurado:true, fechaRestauracion:new Date().toISOString(),
      notas:'⚠ Restaurado el '+new Date().toLocaleDateString('es-MX')+' — PDF regenerado'
    };

    const idx=appData.recibos.findIndex(r=>r.folio<folio);
    if(idx>=0) appData.recibos.splice(idx,0,rec); else appData.recibos.push(rec);

    if(appData.folioActual<=folio){ appData.folioActual=folio+1; if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay(); }
    if(typeof REC!=='undefined'){REC.recibos=appData.recibos;REC.folioActual=appData.folioActual;}
    if(typeof actualizarArchivoControl==='function') try{await actualizarArchivoControl();}catch(e){ registrarError('catch vacio', e); }

    // ── CONTABILIDAD con fecha original ───────────────────────────────────
    if(typeof D!=='undefined'&&Array.isArray(D.movimientos)&&total>0){
      const montoCaja=anticipo>0?anticipo:total;
      const esLiq=saldoPendiente<=0;
      const tipoMov=esLiq?'Liquidado':'Anticipo';
      const conc1=(conceptos[0]?.concepto||'');
      if(typeof _registrarMovimiento==='function') _registrarMovimiento({
        id:'M-REST-'+folio+'-'+Date.now(), folioCaja:'',
        fecha:fechaOrig, hora:horaOrig,
        descripcion:tipoMov+' — Recibo #'+fs+' · '+primerNombre+(conc1?' · '+conc1:''),
        nombre:primerNombre, folio, monto:montoCaja,
        tipo:'ingreso', cat:tipoMov+' · #'+fs, estatus:tipoMov,
        fuente:'recibo', esRestaurado:true, responsable:datos.responsable||'RESTAURADO'
      });
      try{ if(typeof syncEstadoSupabaseDebounced==='function') syncEstadoSupabaseDebounced(); }catch(e){ registrarError('catch vacio', e); }
    }

    if(typeof renderHistorial==='function') try{renderHistorial();}catch(e){ registrarError('catch vacio', e); }
    if(typeof renderCaja==='function')      safeExec('renderCaja', () => renderCaja());
    try{ if(typeof syncEstadoSupabaseDebounced==='function') syncEstadoSupabaseDebounced(); }catch(e){ registrarError('catch vacio', e); }

    // Salir del modo restauración
    document.body.classList.remove('modo-restauracion');
    window._restauracionFolio=null; window._restauracionRec=null; window._restauracionFecha=null;
    document.getElementById('restauracion-banner').style.display='none';
    document.getElementById('actions-restauracion').style.display='none';
    document.getElementById('actions-normal').style.display='flex';

    if(typeof toast==='function') toast('✅ Recibo #'+fs+' restaurado');
    if(typeof setStatus==='function') setStatus('ok','Recibo #'+fs+' restaurado — PDF regenerado','ok');
    try{ if(typeof verReciboDesdeHistorial==='function') verReciboDesdeHistorial(rec); }catch(e){ registrarError('catch vacio', e); }

    alert('✅ Recibo #'+fs+' restaurado.\n\n📋 '+primerNombre+'\n📅 '+fechaOrig
      +'\n💰 $'+total.toFixed(2)+' | Abonado: $'+anticipo.toFixed(2)+' | Saldo: $'+saldoPendiente.toFixed(2)
      +'\n\nAparece en Contabilidad con fecha '+fechaOrig+'.');

  }catch(e){
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
      display.style.color = '#5a3a8a';
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
  var fechaActual = (document.getElementById('fecha_recibo')||{value:''}).value || (typeof hoy==='function'?hoy():new Date().toISOString().split('T')[0]);
  var horaActual = (document.getElementById('hora_recibo')||{value:''}).value || (typeof hora==='function'?hora():'12:00');
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
  if(hDisplay) hDisplay.textContent = hr + ' hrs.';

  document.getElementById('modalReciboRetro').remove();
  if(typeof toast === 'function') toast('✅ Fecha retroactiva aplicada: ' + fecha, 'ok');
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
  const CHECK_INT_MS      = 2 * 60 * 1000; // revisar cada 2 minutos
  const UMBRAL_LIBRE_PCT  = 10;             // alertar bajo este % libre
  let   _alertaMostrada   = false;

  function estimarUsoLocalStorage() {
    try {
      let bytesUsados = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key) || '';
        // Cada char UTF-16 ≈ 2 bytes (worst-case); key también ocupa espacio
        bytesUsados += (key.length + val.length) * 2;
      }
      return bytesUsados;
    } catch(e) { return 0; }
  }

  function verificarEspacioLocalStorage() {
    if (_alertaMostrada) return; // No repetir en la misma sesión
    try {
      const usado = estimarUsoLocalStorage();

      // Estimar espacio libre con UNA sola escritura de prueba de tamaño fijo.
      // Evitamos el loop de escritura masiva que causaba Out of Memory.
      const KEY_PRUEBA = '__lex_storage_probe__';
      const PRUEBA_BYTES = 500 * 1024; // 500 KB — umbral conservador
      let hayEspacioSuficiente = true;
      try {
        try{ localStorage.setItem(KEY_PRUEBA, 'x'.repeat(PRUEBA_BYTES / 2)); } catch(e){ registrarError('localStorage.setItem', e); }
localStorage.removeItem(KEY_PRUEBA);
      } catch(quotaErr) {
        hayEspacioSuficiente = false;
        try { localStorage.removeItem(KEY_PRUEBA); } catch(e){ registrarError('catch vacio', e); }
      }

      if (!hayEspacioSuficiente) {
        _alertaMostrada = true;
        const usadoKB = Math.round(usado / 1024);
        console.warn('[Storage] ⚠ LocalStorage casi lleno — ~' + usadoKB + ' KB usados');
        toast(
          '⚠ Almacenamiento local casi lleno (~' + usadoKB + ' KB) — los guardados pueden fallar. Exporta o limpia datos.',
          'err'
        );
        try { limpiarBackupsViejos(); } catch(e){ registrarError('catch vacio', e); }
      }
    } catch(e) { console.warn('[Storage] Error estimando espacio:', e); }
  }

  setInterval(verificarEspacioLocalStorage, CHECK_INT_MS);
  setTimeout(verificarEspacioLocalStorage, 30000); // primera revisión a los 30 s
})();

// ─── C. COLA DE GUARDADOS PENDIENTES OFFLINE ────────────────────────────────
// Si syncEstadoSupabase falla por red, los cambios se encolan.
// Cuando se restablece la conexión O se renueva el token, la cola se drena
// automáticamente (máx. 1 intento activo a la vez, con retroceso exponencial).

(function iniciarColaOffline() {
  const COLA_KEY    = 'lex_pending_queue';
  const MAX_ITEMS   = 20;   // no acumular más de 20 snapshots
  let   _drenando   = false;
  let   _reintento  = 0;

  // ── Encolar un snapshot para guardar después ──────────────────────────────
  window._encolarGuardadoPendiente = function(tipo, payload) {
    try {
      const cola = JSON.parse(localStorage.getItem(COLA_KEY) || '[]');
      // Deduplicar: si ya hay un ítem del mismo tipo, reemplazarlo (solo el más reciente importa)
      const idx = cola.findIndex(i => i.tipo === tipo);
      const item = { tipo, payload, ts: Date.now() };
      if (idx >= 0) {
        cola[idx] = item; // actualizar en lugar de agregar
      } else {
        cola.push(item);
        // Si la cola crece demasiado, descartar los más viejos
        while (cola.length > MAX_ITEMS) cola.shift();
      }
      try{ localStorage.setItem(COLA_KEY, JSON.stringify(cola)); } catch(e){ registrarError('localStorage.setItem', e); }
if (typeof setSyncState === 'function') setSyncState('pending');
      console.log('[Queue] Guardado encolado (Supabase):', tipo, '— cola:', cola.length);
    } catch(e) { console.warn('[Queue] Error encolando:', e); }
  };

  // ── Drenar la cola ────────────────────────────────────────────────────────
  window._drenaQueue = async function() {
    if (_drenando) return;
    if (!sbSession || Date.now() >= sbExpiry) return;
    if (!navigator.onLine) return;

    let cola;
    try { cola = JSON.parse(localStorage.getItem(COLA_KEY) || '[]'); } catch(e) { return; }
    if (!cola.length) return;

    _drenando = true;
    console.log('[Queue] Drenando cola —', cola.length, 'ítems pendientes...');

    for (const item of cola) {
      try {
        if (item.tipo === 'syncEstado') await syncEstadoSupabase();
        if (item.tipo === 'actualizarArchivoControl' && typeof actualizarArchivoControl === 'function')
          await actualizarArchivoControl();
      } catch(e) {
        console.warn('[Queue] Error drenando ítem:', item.tipo, e);
        _drenando = false;
        // Retroceso exponencial (máx 8 min)
        const delay = Math.min(Math.pow(2, _reintento) * 15000, 8 * 60 * 1000);
        _reintento++;
        setTimeout(_drenaQueue, delay);
        return;
      }
    }

    // Éxito — vaciar la cola
    try { localStorage.removeItem(COLA_KEY); } catch(e){ registrarError('catch vacio', e); }
    _reintento = 0;
    _drenando  = false;
    console.log('[Queue] ✓ Cola drenada exitosamente');
    toast('☁ Cambios pendientes sincronizados con Supabase ✓', 'ok');
    if (typeof setSyncState === 'function') setSyncState('idle');
  };

  // ── Drenar cuando vuelve la conexión ─────────────────────────────────────
  window.addEventListener('online', function() {
    setTimeout(_drenaQueue, 3000); // esperar 3s a que la red se estabilice
  });

  // ── Drenar cuando se renueva el token (polling cada 30 s) ─────────────────
  setInterval(function() {
    if (sbSession && Date.now() < sbExpiry && navigator.onLine) {
      _drenaQueue();
    }
  }, 30 * 1000);

  // ── Intentar drenar al cargar (por si había ítems de una sesión anterior) ─
  setTimeout(_drenaQueue, 5000);
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
    // ── 1. Respaldo de emergencia offline (solo si no hay sesión activa) ──────
    // Con Supabase activo los datos están en la nube — este write es solo
    // para recuperación en caso de pérdida total de conexión.
    if(!window.SB || !window.SB_DESPACHO_ID){
      try {
        try{ localStorage.setItem('lex_app',          JSON.stringify(D)); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('lex_emergency_ts', String(Date.now())); } catch(e){ registrarError('localStorage.setItem', e); }
} catch(err){ registrarError('catch vacio', err); }
    }

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
        cierres:        D.cierres       || [],
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
  // Mostrar zona
  document.querySelectorAll('#adminModal .admin-panel').forEach(z => z.style.display = 'none');
  const zona = document.getElementById('adminAuditoriaZone');
  if (zona) { zona.style.display = 'block'; zona.classList.add('show'); }
  document.getElementById('auditoria-buscar').value = '';
  document.getElementById('auditoria-tipo').value = '';
  auditoriaFiltrar();
}

function adminVolverDesdeAuditoria() {
  document.querySelectorAll('#adminModal .admin-panel').forEach(z => { z.style.display = 'none'; z.classList.remove('show'); });
  const panel = document.getElementById('adminPanelZone');
  if (panel) { panel.style.display = 'block'; panel.classList.add('show'); }
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
      + '<span style="font-family:JetBrains Mono,monospace;font-size:0.6rem;color:rgba(200,149,42,0.5);">' + (e.fecha||'—') + '</span>'
      + '<span style="margin-left:auto;font-family:JetBrains Mono,monospace;font-size:0.58rem;color:var(--gold-l);background:rgba(200,149,42,0.12);border-radius:4px;padding:1px 7px;">' + (e.usuario||'—') + '</span>'
      + '</div>'
      + '<div style="font-size:0.76rem;color:rgba(253,250,244,0.8);font-family:Outfit,sans-serif;">' + (e.detalle||'—') + '</div>'
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