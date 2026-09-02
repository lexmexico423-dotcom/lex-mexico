/* LEX-MÉXICO · Módulo expedientes
 * Funciones extraídas sin modificar su contenido.
 */

function _actualizarSeccionModoCosto(tipo, letra) {
  var sec = document.getElementById('seccion-modo-costo');
  if (!sec) return;
  var esSerieA = (!letra || letra === 'A');
  var esTipo   = (tipo === 'escritura' || tipo === 'juicio');
  sec.style.display = (esTipo && esSerieA) ? '' : 'none';
}

function _actualizarVisibilidadPoder(tipo, letra) {
  const seccionPoder = document.getElementById('seccion-poder');
  if (!seccionPoder) return;
  const esTipoConPoder = (tipo === 'escritura' || tipo === 'juicio');
  const esLetraA = (!letra || letra === 'A');
  if (esTipoConPoder && !esLetraA) {
    seccionPoder.style.display = 'none';
  } else {
    seccionPoder.style.display = '';
  }
}

function actualizarDriveBadge(ok){ // Ahora gestiona estado Supabase
  actualizarAmbossBadges(ok);
}

function respCancelar() {
  document.getElementById('resp-selector-ov')?.remove();
  // Si hay un callback pendiente, llamarlo con null para que el flujo pueda abortar
  if (typeof window._respCallback === 'function') {
    window._respCallback(null);
  }
  window._respCallback = null;
  window._respLista    = null;
}

function setFiltroHistorial(filtro){
  historialFiltroActivo = filtro;
  ['todos','pendiente','pagado','cancelado'].forEach(f=>{
    document.getElementById('filtro-'+f).classList.toggle('activo', f===filtro);
  });
  filtrarHistorial();
}

function _r2ResumenPath(driveFileId) {
  const dep = window.SB_DESPACHO_ID || 'despacho';
  return dep + '/acuerdos/' + driveFileId + '/resumen.json';
}

async function _r2CargarResumen(driveFileId) {
  try {
    const blob = await window.descargarR2(_r2ResumenPath(driveFileId), 'expedientes', true);
    if (!blob) return null;
    const txt = await blob.text();
    const data = JSON.parse(txt);
    // Devuelve objeto completo: { resumen, ocrTexto }
    return { resumen: data.resumen || null, ocrTexto: data.ocrTexto || null };
  } catch(e) { return null; }
}

function _acuerdosClave(juicioId) {
  return 'acuerdos_drive_' + juicioId;
}

async function driveBuscarCarpetaId(token, nombre, parentId) {
  const q = "mimeType='application/vnd.google-apps.folder' and name='" + nombre.replace(/'/g,"\\'") + "' and trashed=false" + (parentId ? " and '"+parentId+"' in parents" : '');
  try {
    const r = await fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id)&pageSize=1', {headers:{Authorization:'Bearer '+token}});
    if (!r.ok) return null;
    const d = await r.json();
    return (d.files && d.files.length) ? d.files[0].id : null;
  } catch(e) { return null; }
}

async function driveListarArchivosCarpeta(token, carpetaId) {
  const q = "'"+carpetaId+"' in parents and mimeType='application/pdf' and trashed=false";
  try {
    const r = await fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id,name,description,createdTime)&orderBy=name+desc&pageSize=200', {headers:{Authorization:'Bearer '+token}});
    if (!r.ok) return [];
    const d = await r.json();
    return d.files || [];
  } catch(e) { return []; }
}

function _parsearArchivoAcuerdoDrive(f) {
  const stem = (f.name || '').replace(/\.pdf$/i,'');
  let fechaAcuerdo = '', nombreCorto = stem;
  // Formato nuevo: DD-MM-AAAA NOMBRE (ej: "15-01-2025 AUTO ADMISORIO")
  const mN = stem.match(/^(\d{2})-(\d{2})-(\d{4})\s+(.+)$/);
  if (mN) { fechaAcuerdo = mN[3]+'-'+mN[2]+'-'+mN[1]; nombreCorto = mN[4]; }
  else {
    // Formato anterior: DD-MES-AA NOMBRE (ej: "15-ENE-25 AUTO ADMISORIO")
    const meses = {ENE:'01',FEB:'02',MAR:'03',ABR:'04',MAY:'05',JUN:'06',JUL:'07',AGO:'08',SEP:'09',OCT:'10',NOV:'11',DIC:'12'};
    const mV = stem.match(/^(\d{2})-([A-Z]{3})-(\d{2})\s+(.+)$/);
    if (mV) { fechaAcuerdo = '20'+mV[3]+'-'+(meses[mV[2]]||'01')+'-'+mV[1]; nombreCorto = mV[4]; }
  }
  const desc = f.description || '';
  return {
    id: f.id, driveFileId: f.id,
    archivo: f.name || '', nombre: nombreCorto || stem,
    descripcion: desc,
    tipo: 'otro', estado: 'listo',
    fechaAcuerdo, fechaSubida: (f.createdTime||'').slice(0,10),
    resumen: '', sha256: ''  // resumen siempre vacío al parsear; se restaura del caché local
  };
}

async function cargarAcuerdosDrive(juicioId, nombreCarpetaJuicio) {
  if (!juicioId) return [];
  const lsKey = 'lex_acuerdos_' + juicioId;
  // 1) Cargar caché local de inmediato (renderiza sin esperar a Drive)
  let local = [];
  try { local = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch(e){}
  if (local.length) renderAcuerdosDrive(local);

  // 2) Refrescar desde Drive en segundo plano si hay carpeta
  if (nombreCarpetaJuicio) {
    (async () => {
      try {
        const token = await driveGetAccessToken();
        if (!token) return;
        const DRIVE_JUICIOS_FOLDER_ID = '1TtVVL0Jbw6BFkwLw8Wo1LZfxLN0I_ndU';
        const carpetaJuicioId = await driveBuscarCarpetaId(token, nombreCarpetaJuicio, DRIVE_JUICIOS_FOLDER_ID);
        if (!carpetaJuicioId) return;
        const carpetaAcuerdosId = await driveBuscarCarpetaId(token, 'Acuerdos', carpetaJuicioId);
        if (!carpetaAcuerdosId) return;
        const archivos = await driveListarArchivosCarpeta(token, carpetaAcuerdosId);
        if (!archivos.length) return;
        const lista = archivos.map(_parsearArchivoAcuerdoDrive);
        // Enriquecer con metadata local (sha256, tipo, resumen, fechaNotificacion)
        try {
          const localActual = JSON.parse(localStorage.getItem(lsKey) || '[]');
          lista.forEach(ac => {
            const m = localActual.find(l => l.driveFileId === ac.driveFileId);
            if (m) {
              ac.sha256 = m.sha256 || '';
              ac.tipo   = m.tipo   || ac.tipo;
              ac.fechaNotificacion = m.fechaNotificacion || '';
              // Resumen local siempre tiene prioridad
              if (m.resumen) ac.resumen = m.resumen;
            }
          });
        } catch(e){}
        try { localStorage.setItem(lsKey, JSON.stringify(lista)); } catch(e){}
        renderAcuerdosDrive(lista);
        // Restaurar resúmenes desde R2 para acuerdos que no tienen en localStorage
        lista.forEach(async ac => {
          if (!ac.resumen && ac.driveFileId) {
            const r2d = await _r2CargarResumen(ac.driveFileId);
            if (r2d && r2d.resumen) {
              ac.resumen = r2d.resumen;
              try {
                const ls2 = JSON.parse(localStorage.getItem(lsKey) || '[]');
                const i2 = ls2.findIndex(a => a.driveFileId === ac.driveFileId);
                if (i2 >= 0) { ls2[i2].resumen = r2d.resumen; localStorage.setItem(lsKey, JSON.stringify(ls2)); }
              } catch(e) {}
            }
          }
        });
      } catch(e){ console.warn('[Acuerdos] Error al refrescar desde Drive:', e.message); }
    })();
  }
  return local;
}

async function _acuerdosListarDriveFresco(juicioId, nombreCarpetaJuicio) {
  const lsKey = 'lex_acuerdos_' + juicioId;
  let local = [];
  try { local = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch(e){}
  if (!nombreCarpetaJuicio) return local;
  try {
    const token = await driveGetAccessToken();
    if (!token) return local;
    const DRIVE_JUICIOS_FOLDER_ID = '1TtVVL0Jbw6BFkwLw8Wo1LZfxLN0I_ndU';
    const carpetaJuicioId = await driveBuscarCarpetaId(token, nombreCarpetaJuicio, DRIVE_JUICIOS_FOLDER_ID);
    if (!carpetaJuicioId) return local;
    const carpetaAcuerdosId = await driveBuscarCarpetaId(token, 'Acuerdos', carpetaJuicioId);
    if (!carpetaAcuerdosId) return local;
    const archivos = await driveListarArchivosCarpeta(token, carpetaAcuerdosId);
    if (!archivos.length) return local;
    const lista = archivos.map(_parsearArchivoAcuerdoDrive);
    lista.forEach(ac => {
      const m = local.find(l => l.driveFileId === ac.driveFileId);
      if (m) {
        ac.sha256 = m.sha256 || '';
        ac.tipo = m.tipo || ac.tipo;
        ac.fechaNotificacion = m.fechaNotificacion || '';
        if (m.resumen) ac.resumen = m.resumen;
      }
    });
    try { localStorage.setItem(lsKey, JSON.stringify(lista)); } catch(e){}
    return lista;
  } catch(e) { console.warn('[Acuerdos] No se pudo refrescar desde Drive:', e.message); return local; }
}

async function guardarAcuerdosDrive(juicioId, lista) {
  if (!juicioId) return;
  try { localStorage.setItem('lex_acuerdos_'+juicioId, JSON.stringify(lista)); } catch(e){}
}

function renderAcuerdosDrive(lista) {
  const cont = document.getElementById('mexp-r2-lista');
  if (!cont) return;
  // Actualizar KPI
  const kpi = document.getElementById('mexp-stat-docs');
  if (kpi) kpi.textContent = lista.filter(a => a.estado !== 'procesando').length;

  if (!lista.length) {
    cont.innerHTML = '<div style="padding:20px 10px;text-align:center;color:var(--muted);font-size:0.72rem;line-height:1.6;">Sin acuerdos subidos.<br>Arrastra un PDF o usa <strong>＋ Subir</strong>.</div>';
    return;
  }
  // Ordenar: más reciente arriba, sin fecha al final
  const sorted = [...lista].sort((a,b) => {
    const fa = a.fechaAcuerdo || a.fechaSubida || '';
    const fb = b.fechaAcuerdo || b.fechaSubida || '';
    if (!fa && !fb) return 0;
    if (!fa) return 1;
    if (!fb) return -1;
    return fb.localeCompare(fa);
  });

  // Helper: formatear fecha a "15/MAY/26"
  function _fmtFechaBadge(iso) {
    if (!iso) return '';
    var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3]+'/'+m[2]+'/'+m[1] : iso;
  }

  cont.innerHTML = '';
  sorted.forEach(ac => {
    const tipo = ACUERDO_TIPOS[ac.tipo] || ACUERDO_TIPOS.otro;
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--border-l);border-radius:7px;padding:8px 10px;margin-bottom:6px;cursor:pointer;transition:background 0.12s;position:relative;';
    card.onmouseover = () => card.style.background = 'var(--surface2)';
    card.onmouseleave = () => card.style.background = '';

    const badgeEstado = ac.estado === 'procesando'
      ? `<span style="font-size:0.6rem;padding:2px 7px;border-radius:4px;background:#FAEEDA;color:#633806;display:inline-flex;align-items:center;gap:4px;"><span style="display:inline-block;width:8px;height:8px;border:1.5px solid #BA7517;border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;"></span>IA procesando</span>`
      : ac.estado === 'error_drive'
      ? `<span style="font-size:0.6rem;padding:2px 7px;border-radius:4px;background:#FCEBEB;color:#A32D2D;">⚠ Sin Drive</span>`
      : `<span style="font-size:0.6rem;padding:2px 7px;border-radius:4px;background:#EAF3DE;color:#27500A;">Listo</span>`;
    const badgeTipo = `<span style="font-size:0.6rem;padding:2px 7px;border-radius:4px;background:${tipo.bg};color:${tipo.color};font-weight:600;">${tipo.label}</span>`;

    // Fecha del acuerdo en formato "15/MAY/26" para el nombre
    const fechaAcuerdoBadge = _fmtFechaBadge(ac.fechaAcuerdo);
    const nombreConFecha = fechaAcuerdoBadge
      ? `<span style="color:var(--gold-d);font-family:'JetBrains Mono',monospace;font-size:0.68rem;font-weight:700;margin-right:5px;">${fechaAcuerdoBadge}</span>${escHTML(ac.nombre || ac.archivo)}`
      : escHTML(ac.nombre || ac.archivo);

    // Descripción — 4 líneas completas (respeta saltos de línea de la IA)
    const _descRow = ac.descripcion
      ? `<div style="font-size:0.62rem;color:var(--muted);margin-top:3px;line-height:1.5;white-space:pre-line;word-break:break-word;">${escHTML(ac.descripcion)}</div>`
      : '';

    // Badge de notificación: si ya tiene fecha muestra "NOTIFICACIÓN 15/MAY/26", si no muestra "+ Notificación" clickeable
    const notifFmt = ac.fechaNotificacion ? _fmtFechaBadge(ac.fechaNotificacion) : '';
    const notifBadgeId = 'notif-badge-' + ac.id;
    const notifInputId = 'notif-input-' + ac.id;
    const notifBadge = notifFmt
      ? `<span id="${notifBadgeId}" onclick="event.stopPropagation();_editarNotifAcuerdo('${ac.id}')" title="Editar fecha de notificación" style="font-size:0.6rem;padding:2px 8px;border-radius:4px;background:#ddeeff;color:#1a4a8a;font-weight:700;cursor:pointer;font-family:'JetBrains Mono',monospace;">🔔 NOTIFICACIÓN ${notifFmt}</span>`
      : `<span id="${notifBadgeId}" onclick="event.stopPropagation();_editarNotifAcuerdo('${ac.id}')" title="Registrar fecha de notificación" style="font-size:0.6rem;padding:2px 8px;border-radius:4px;border:1px dashed #aac4e0;color:#4a7aaa;cursor:pointer;background:transparent;">+ Notificación</span>`;

    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:6px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.72rem;font-weight:600;color:var(--ink);line-height:1.35;">${nombreConFecha}</div>
          ${_descRow}
        </div>
        <span onclick="event.stopPropagation();verAcuerdoPDF('${ac.driveFileId}','${encodeURIComponent(ac.nombre||ac.archivo)}')" title="Ver PDF original" style="font-size:1.1rem;cursor:pointer;color:var(--muted);flex-shrink:0;padding-top:1px;">👁</span>
        <span onclick="event.stopPropagation();eliminarAcuerdoDrive('${ac.id}')" title="Eliminar acuerdo" style="font-size:1rem;cursor:pointer;color:var(--muted);flex-shrink:0;padding-top:1px;">🗑</span>
      </div>
      <div style="display:flex;align-items:center;gap:5px;margin-top:6px;flex-wrap:wrap;">
        ${badgeTipo}
        ${badgeEstado}
        ${notifBadge}
      </div>`;

    card.onclick = () => verResumenAcuerdoModal(ac);
    cont.appendChild(card);
  });
}

function _editarNotifAcuerdo(acuerdoId) {
  const jId = window._jdetId;
  if (!jId) return;
  const lsKey = 'lex_acuerdos_' + jId;
  let lista = [];
  try { lista = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch(e){}
  const ac = lista.find(a => a.id == acuerdoId);
  if (!ac) return;

  const badgeEl = document.getElementById('notif-badge-' + acuerdoId);
  if (!badgeEl) return;

  // Crear input temporal
  const inp = document.createElement('input');
  inp.type = 'date';
  inp.value = ac.fechaNotificacion || '';
  inp.style.cssText = 'font-size:0.65rem;padding:2px 6px;border-radius:4px;border:1px solid var(--azul);font-family:monospace;color:var(--ink);outline:none;max-width:130px;';
  badgeEl.replaceWith(inp);
  inp.focus();

  const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  function _fmtLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return String(d.getDate()).padStart(2,'0') + '/' + meses[d.getMonth()] + '/' + String(d.getFullYear()).slice(2);
  }

  function guardar() {
    const val = inp.value;
    ac.fechaNotificacion = val || '';
    try { localStorage.setItem(lsKey, JSON.stringify(lista)); } catch(e){}
    // Re-renderizar para reflejar el cambio
    renderAcuerdosDrive(lista);
  }
  inp.onchange = guardar;
  inp.onblur = guardar;
  inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = ac.fechaNotificacion || ''; inp.blur(); } };
}

async function eliminarAcuerdoDrive(acuerdoId) {
  const jId = window._jdetId;
  if (!jId) return;
  const lsKey = 'lex_acuerdos_' + jId;
  let lista = [];
  try { lista = JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch(e){}
  const ac = lista.find(a => a.id == acuerdoId);
  if (!ac) return;
  const ok = await confirmarBonito({
    titulo: 'Eliminar acuerdo',
    mensaje: '¿Eliminar «' + (ac.nombre || ac.archivo || 'este acuerdo') + '»?\n\nSe borrará también el PDF en Drive. Esta acción no se puede deshacer.',
    btnSi: 'Sí, eliminar',
    btnNo: 'Cancelar',
    peligro: true
  });
  if (!ok) return;
  if (ac.driveFileId) {
    try {
      const token = await driveGetAccessToken();
      if (token) {
        await fetch('https://www.googleapis.com/drive/v3/files/' + ac.driveFileId, {
          method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
        });
      }
    } catch(e) { console.warn('[Acuerdos] No se pudo eliminar de Drive:', e); }
  }
  lista = lista.filter(a => a.id != acuerdoId);
  try { localStorage.setItem(lsKey, JSON.stringify(lista)); } catch(e){}
  renderAcuerdosDrive(lista);
  if (typeof toast === 'function') toast('🗑 Acuerdo eliminado', 'ok');
}

function _acuerdosAgruparDuplicados(lista) {
  const grupos = {};
  (lista || []).forEach(ac => {
    if (!ac || ac.estado === 'procesando' || ac.estado === 'error') return;
    const clave = ac.sha256 ? 'sha:' + ac.sha256 : ((ac.archivo || '').trim() ? 'nombre:' + ac.archivo.trim().toLowerCase() : '');
    if (!clave) return;
    (grupos[clave] = grupos[clave] || []).push(ac);
  });
  return Object.values(grupos)
    .filter(g => g.length > 1)
    .map(g => [...g].sort((a,b) => (b.fechaSubida||'').localeCompare(a.fechaSubida||'')));
}

async function subirAcuerdoDrive(input) {
  if (!input.files || !input.files.length) return;
  await subirAcuerdoDriveFiles(input.files);
  input.value = '';
}

async function subirAcuerdoDriveFiles(files) {
  // _jdetId se establece en initAcuerdosDrive con el ID del juicio activo
  const jId = window._jdetId || (_mexpIdx >= 0 ? 'idx_' + _mexpIdx : null);
  if (!jId) { if(typeof toast==='function') toast('⚠ Abre un expediente primero','err'); return; }
  const proc = document.getElementById('acuerdo-procesando');
  const procTxt = document.getElementById('acuerdo-procesando-txt');

  // Nombre de la carpeta del juicio en Drive — se calcula una sola vez aquí
  // (antes solo se calculaba más abajo, al momento de subir) para poder
  // refrescar la lista DESDE Drive (no solo el caché local) antes de
  // comparar duplicados por SHA-256.
  const juicioActivoUpload = D.juicios && D.juicios[typeof jdetIdx !== 'undefined' ? jdetIdx : _mexpIdx];
  const nombreCarpetaJuicioUpload = (juicioActivoUpload ? (juicioActivoUpload.nombre || juicioActivoUpload.cliente || 'Juicio') + ' - Exp.' + (juicioActivoUpload.expediente || juicioActivoUpload.num || jId) : 'Juicio-' + jId).replace(/[<>:"/\\|?*]/g,'_');
  if (procTxt) procTxt.textContent = 'Verificando duplicados…';
  if (proc) proc.style.display = 'flex';
  let lista = await _acuerdosListarDriveFresco(jId, nombreCarpetaJuicioUpload);
  if (proc) proc.style.display = 'none';

  for (const file of Array.from(files)) {
    if (file.type !== 'application/pdf') { if(typeof toast==='function') toast('⚠ Solo se aceptan PDFs','err'); continue; }

    // Placeholder mientras procesa
    const tmpId = 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const tmpAc = { id: tmpId, archivo: file.name, nombre: file.name, estado: 'procesando', tipo: 'otro', fechaSubida: new Date().toISOString().slice(0,10), driveFileId: '', fechaAcuerdo: '', resumen: '' };
    lista.push(tmpAc);
    renderAcuerdosDrive(lista);

    if (proc) { proc.style.display = 'flex'; }
    if (procTxt) procTxt.textContent = 'Leyendo PDF con IA…';

    try {
      // 1) Leer PDF como base64
      const b64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result.split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      // 1a) Verificar duplicado por SHA-256 del contenido (más confiable) y,
      // como respaldo, por nombre de archivo original — los que vienen
      // recién listados de Drive (no del caché local) pueden no tener
      // sha256 todavía, así que el hash solo no basta para detectarlos.
      let fileSha256 = '';
      try {
        const arrBuf = await file.arrayBuffer();
        const hashBuf = await crypto.subtle.digest('SHA-256', arrBuf);
        fileSha256 = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
        const nombreNorm = (file.name || '').trim().toLowerCase();
        const yaExiste = lista.some(a =>
          a.id !== tmpId && a.estado !== 'error' && (
            (a.sha256 && a.sha256 === fileSha256) ||
            (nombreNorm && (a.archivo || '').trim().toLowerCase() === nombreNorm)
          )
        );
        if (yaExiste) {
          lista = lista.filter(a => a.id !== tmpId);
          renderAcuerdosDrive(lista);
          if (typeof toast === 'function') toast('⚠ Este archivo ya existe en los acuerdos de este expediente', 'err');
          continue;
        }
      } catch(e) { console.warn('[Acuerdos] No se pudo calcular SHA-256:', e); }

      // 1b) Extraer texto con Mistral OCR (mejora calidad del análisis Gemini)
      let textoOCR = '';
      if (procTxt) procTxt.textContent = 'Extrayendo texto con Mistral OCR…';
      try {
        if (typeof _ocrExtraerTexto === 'function') {
          const ocrRes = await _ocrExtraerTexto(file, (msg) => { if (procTxt) procTxt.textContent = msg; });
          textoOCR = (ocrRes && ocrRes.texto) ? ocrRes.texto.slice(0, 14000) : '';
        }
      } catch(e) { console.warn('[Acuerdos] OCR falló, usará PDF base64:', e.message); }

      // 2) Analizar con GROQ para extraer nombre, tipo, fecha y descripción (4 líneas)
      //    Groq es texto-solo: requiere el texto de Mistral OCR. Si no hubo OCR,
      //    se usa Gemini con el PDF como respaldo (Groq no lee PDFs/imágenes).
      let nombreIA = file.name.replace(/\.pdf$/i,'');
      let nombreCortoIA = '';
      let tipoIA = 'acuerdo';
      let fechaIA = new Date().toISOString().slice(0,10);
      let resumenIA = '';
      let descripcionIA = '';

      const _promptAcuerdo = `Eres un abogado litigante mexicano. Del siguiente texto de un acuerdo o documento judicial mexicano, extrae:
(a) la fecha del acuerdo en formato DD-MM-AAAA,
(b) un nombre de archivo corto y descriptivo en MAYUSCULAS sin acentos ni caracteres especiales (max 40 chars),
(c) una descripción clara en español de EXACTAMENTE 4 líneas (aprox. 4 frases breves) que resuman qué resuelve u ordena el documento, plazos relevantes y a quién afecta. Sé concreto y útil.
(d) el tipo: uno de auto|sentencia|notificacion|acuerdo|requerimiento|otro.
Responde ÚNICAMENTE con un JSON válido, sin markdown ni texto extra:
{"fecha":"DD-MM-AAAA","nombre":"NOMBRE ARCHIVO","descripcion":"línea 1\\nlínea 2\\nlínea 3\\nlínea 4","tipo":"tipo"}`;

      function _aplicarAnalisisAcuerdo(rawTxt) {
        const cleanTxt = (rawTxt || '').replace(/```json|```/g,'').trim();
        const m = cleanTxt.match(/\{[\s\S]*\}/);
        const jsonStr = m ? m[0] : cleanTxt;
        const parsed = JSON.parse(jsonStr);
        if (parsed.nombre) nombreCortoIA = parsed.nombre.toUpperCase().replace(/[^A-Z0-9\s\-\.]/g,'').trim().slice(0,40);
        if (parsed.descripcion) { descripcionIA = String(parsed.descripcion).trim().slice(0,500); resumenIA = descripcionIA; }
        if (parsed.tipo && ACUERDO_TIPOS[parsed.tipo]) tipoIA = parsed.tipo;
        if (parsed.fecha) {
          if (/^\d{2}-\d{2}-\d{4}$/.test(parsed.fecha)) {
            const [dd,mm,aaaa] = parsed.fecha.split('-'); fechaIA = aaaa+'-'+mm+'-'+dd;
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha)) { fechaIA = parsed.fecha; }
        }
      }

      if (textoOCR) {
        // Si Cloudflare está configurado, usamos su modelo de CONTEXTO LARGO
        // (Mistral Small 3.1, 128K tokens) para analizar el acuerdo completo
        // con más precisión — Groq (12,000 TPM gratis) obliga a recortar el
        // texto y eso puede hacer que se le escapen datos reales al resumen.
        const _usarContextoLargoAc = !!(_cfaiGetAccountId() && _cfaiGetToken());
        if (procTxt) procTxt.textContent = _usarContextoLargoAc ? 'Analizando acuerdo (modelo de contexto largo)…' : 'Groq analizando acuerdo…';
        try {
          let rawTxt;
          if (_usarContextoLargoAc) {
            try {
              rawTxt = await _cfaiLlamarContextoLargo(textoOCR.slice(0, 90000) + '\n\n---\n' + _promptAcuerdo, 700, 0.2, 'analisis_acuerdo');
            } catch(eCtxLargo) {
              console.warn('[Acuerdos] Contexto largo falló, usando Groq:', eCtxLargo.message);
              rawTxt = await _iaLlamar(textoOCR.slice(0, 18000) + '\n\n---\n' + _promptAcuerdo, 700, 0.2, 'analisis_acuerdo');
            }
          } else {
            rawTxt = await _iaLlamar(textoOCR.slice(0, 18000) + '\n\n---\n' + _promptAcuerdo, 700, 0.2, 'analisis_acuerdo');
          }
          _aplicarAnalisisAcuerdo(rawTxt);
        } catch(e) { console.warn('[Acuerdos] Error Groq/IA:', e.message); }
      } else {
        // Sin texto OCR: ni Mistral OCR, ni PDF.js, ni Tesseract lograron leer
        // el PDF (documento muy difícil). Último recurso: Cloudflare Workers AI
        // con visión, leyendo la primera página como imagen.
        if (_cfaiGetAccountId() && _cfaiGetToken()) {
          if (procTxt) procTxt.textContent = 'Cloudflare Workers AI analizando documento (último recurso)…';
          try {
            const imgB64 = await _pdfPrimeraPaginaB64(file);
            const txt = await _cfaiVision(imgB64, _promptAcuerdo, 900, 'analisis_acuerdo');
            try { _aplicarAnalisisAcuerdo(txt); } catch(e) { console.warn('[Acuerdos] JSON Cloudflare inválido:', txt); }
          } catch(e) { console.warn('[Acuerdos] Error Cloudflare Workers AI (respaldo):', e.message); }
        } else {
          console.warn('[Acuerdos] Sin texto OCR y sin Cloudflare Workers AI configurado — no se pudo analizar.');
        }
      }

      // Nombre del archivo en Drive: DD-MM-AAAA NOMBRE.pdf; la tarjeta muestra solo NOMBRE
      const [_anioAc, _mesAc, _diaAc] = fechaIA.split('-');
      const _sufijoAc = (nombreCortoIA || nombreIA.replace(/[^A-Z0-9\s\-]/gi,'').trim().slice(0,40)).toUpperCase().replace(/[<>:"/\\|?*]/g,'').trim();
      const nombreMostrar = _sufijoAc || nombreIA;

      // 3) Subir a Drive
      if (procTxt) procTxt.textContent = 'Guardando en Drive…';
      let driveFileId = '';
      // nombreCarpetaJuicio ya se calculó al inicio de la función (nombreCarpetaJuicioUpload)
      const nombreArchivoDrive = (_diaAc||'00')+'-'+(_mesAc||'01')+'-'+(_anioAc||new Date().getFullYear())+' '+_sufijoAc.replace(/\s+/g,'_')+'.pdf';

      try {
        const token = await driveGetAccessToken();
        if (!token) throw new Error('Sin token de Drive — reconecta en Panel Admin');
        const DRIVE_JUICIOS_FOLDER_ID = '1TtVVL0Jbw6BFkwLw8Wo1LZfxLN0I_ndU';
        const carpetaAcuerdosId = await driveObtenerOCrearCarpeta(token, 'Acuerdos', await driveObtenerOCrearCarpeta(token, nombreCarpetaJuicioUpload, DRIVE_JUICIOS_FOLDER_ID));
        const metadata = { name: nombreArchivoDrive, parents: [carpetaAcuerdosId], mimeType: 'application/pdf', description: descripcionIA };
        const boundary = 'boundary_lex_acuerdos';
        const bodyArr = [`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64}\r\n--${boundary}--`];
        const uploadResp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{
          method:'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'multipart/related; boundary='+boundary }, body: bodyArr.join('')
        });
        if (uploadResp.ok) {
          const ud = await uploadResp.json();
          driveFileId = ud.id || '';
        } else {
          const errTxt = await uploadResp.text().catch(()=>'');
          throw new Error('Drive HTTP ' + uploadResp.status + ' — ' + errTxt.slice(0,80));
        }
      } catch(e) {
        console.error('[Acuerdos] Error subiendo a Drive:', e.message);
        if(typeof toast==='function') toast('⚠ No se pudo subir a Drive: ' + e.message, 'err');
      }

      // 4) Guardar textoOCR en R2 para reutilizar en Resumen IA sin re-descargar PDF
      if (driveFileId && textoOCR) {
        try {
          const ocrData = JSON.stringify({ ocrTexto: textoOCR, ts: Date.now() });
          const ocrBlob = new Blob([ocrData], { type: 'application/json' });
          const ocrFile = new File([ocrBlob], 'resumen.json', { type: 'application/json' });
          await window.subirR2(ocrFile, _r2ResumenPath(driveFileId), 'expedientes');
        } catch(e) { console.warn('[Acuerdos] No se pudo guardar OCR en R2:', e); }
      }

      // 5) Actualizar lista: reemplazar placeholder
      const idx = lista.findIndex(a => a.id === tmpId);
      const acFinal = { id: tmpId, archivo: file.name, nombre: nombreMostrar, nombreLargo: nombreIA, descripcion: descripcionIA, tipo: tipoIA, estado: driveFileId ? 'listo' : 'error_drive', fechaSubida: new Date().toISOString().slice(0,10), fechaAcuerdo: fechaIA, resumen: resumenIA, driveFileId, sha256: fileSha256 };
      if (idx >= 0) lista[idx] = acFinal; else lista.push(acFinal);

      // 5) Agregar al historial cronológico automáticamente
      await agregarEntradaHistorialDesdeAcuerdo(jId, acFinal);

      // 6) Proponer término (plazo) — función que antes vivía en el botón
      // aparte "📷 Subir acuerdo y leerlo" (eliminado), ahora integrada aquí:
      // el archivo ya quedó en Drive y en el historial arriba; si el mismo
      // texto OCR trae un plazo real, se muestra la tarjeta morada de
      // revisión para que el usuario la confirme o la descarte. soloTermino
      // evita que _juConfirmarSugerencia duplique la entrada de historial
      // (esta función ya la creó en el paso 5).
      if (textoOCR && typeof _juExtraerDatosAcuerdo === 'function') {
        try {
          const datosTermino = await _juExtraerDatosAcuerdo(textoOCR);
          const generaTermino = datosTermino && datosTermino.generaTermino !== false && (parseInt(datosTermino.dias,10) > 0);
          if (datosTermino && generaTermino) {
            const idxJuicioTermino = typeof _mexpIdx !== 'undefined' && _mexpIdx >= 0 ? _mexpIdx :
              (typeof jdetIdx !== 'undefined' && jdetIdx >= 0 ? jdetIdx : -1);
            if (idxJuicioTermino >= 0) {
              window._juSugerencia = { idx: idxJuicioTermino, datos: datosTermino, texto: textoOCR, archivo: file.name, driveFileId, soloTermino: true };
              if (typeof _juPintarSugerencia === 'function') _juPintarSugerencia(idxJuicioTermino, datosTermino, file.name, driveFileId);
            }
          }
        } catch(eTermino) { console.warn('[Acuerdos] No se pudo proponer término:', eTermino); }
      }

    } catch(e) {
      console.error('[Acuerdos] Error procesando:', e);
      const idx = lista.findIndex(a => a.id === tmpId);
      if (idx >= 0) { lista[idx].estado = 'error'; lista[idx].nombre = 'Error: ' + file.name; }
      if(typeof toast==='function') toast('❌ Error procesando ' + file.name,'err');
    }

    await guardarAcuerdosDrive(jId, lista);
    renderAcuerdosDrive(lista);
  }

  if (proc) proc.style.display = 'none';
  if(typeof toast==='function') toast('✅ Acuerdo(s) procesado(s) y guardados en Drive','ok');
}

async function driveObtenerOCrearCarpeta(token, nombre, parentId) {
  const q = "mimeType='application/vnd.google-apps.folder' and name='" + nombre.replace(/'/g,"\\'") + "' and trashed=false" + (parentId ? " and '" + parentId + "' in parents" : '');
  const buscaResp = await fetch('https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id,name)&pageSize=1', { headers:{ Authorization:'Bearer '+token } });
  if (buscaResp.ok) {
    const buscaData = await buscaResp.json();
    if (buscaData.files && buscaData.files.length) return buscaData.files[0].id;
  }
  // No existe: crear
  const meta = { name: nombre, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) meta.parents = [parentId];
  const crearResp = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', { method:'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify(meta) });
  if (crearResp.ok) { const d = await crearResp.json(); return d.id; }
  throw new Error('No se pudo crear carpeta: ' + nombre);
}

async function agregarEntradaHistorialDesdeAcuerdo(juicioId, ac) {
  // Agregar al historial local del juicio (campo historial en D.juicios)
  // No requiere tabla extra en Supabase
  try {
    const idxJuicio = typeof _mexpIdx !== 'undefined' && _mexpIdx >= 0 ? _mexpIdx :
      (typeof jdetIdx !== 'undefined' && jdetIdx >= 0 ? jdetIdx : -1);
    if (idxJuicio >= 0 && D && D.juicios && D.juicios[idxJuicio]) {
      const j = D.juicios[idxJuicio];
      if (!Array.isArray(j.historial)) j.historial = [];
      // Evitar duplicados por nombre del acuerdo
      const yaTiene = j.historial.some(function(h){ return h.texto === ac.nombre; });
      if (!yaTiene) {
        j.historial.push({
          id: 'HJ-ACU-' + Date.now(),
          fecha: ac.fechaAcuerdo || new Date().toISOString().slice(0,10),
          tipo: 'acuerdo',
          texto: ac.nombre,
          detalle: ac.resumen || '',
          driveFileId: ac.driveFileId || '',
          r2path: ac.r2path || ''
        });
        // Refrescar panel historial
        if (typeof renderHistorialModal === 'function') renderHistorialModal();
        const histCount = j.historial.length;
        const el = document.getElementById('mexp-stat-hist');
        if (el) el.textContent = histCount || '0';
        // Persistir
        if (typeof saveJuicios === 'function') saveJuicios();
        if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced();
      }
    }
  } catch(e) { console.warn('[Acuerdos] Error en historial local:', e); }
}

async function verAcuerdoPDF(driveFileId, encodedNombre) {
  const nombre = decodeURIComponent(encodedNombre || 'Acuerdo.pdf');
  if (!driveFileId || driveFileId === 'undefined' || driveFileId === '') {
    if(typeof toast==='function') toast('⚠ Este acuerdo no tiene archivo en Drive', 'err'); return;
  }
  const overlay = document.getElementById('acuerdo-visor-overlay');
  const iframe  = document.getElementById('acuerdo-visor-iframe');
  const nombreEl = document.getElementById('acuerdo-visor-nombre');
  // Ocultar panel de resumen si está visible
  const resDiv = document.getElementById('acuerdo-resumen-modal-div');
  if (resDiv) { resDiv.style.display = 'none'; resDiv.innerHTML = ''; }
  if (iframe) iframe.style.display = '';
  if (nombreEl) nombreEl.textContent = '⏳ Cargando ' + nombre + '…';
  if (overlay) overlay.style.display = 'flex';
  let blob = null;
  try {
    const token = await driveGetAccessToken();
    if (token) {
      const resp = await fetch('https://www.googleapis.com/drive/v3/files/' + driveFileId + '?alt=media', { headers:{ Authorization:'Bearer '+token } });
      if (resp.ok) blob = await resp.blob();
    }
  } catch(e) { console.warn('[verAcuerdoPDF] Drive falló:', e.message); }
  if (!blob) {
    if (overlay) overlay.style.display = 'none';
    if(typeof toast==='function') toast('⚠ PDF no disponible — verifica conexión con Drive en Panel Admin', 'err'); return;
  }
  const url = URL.createObjectURL(blob);
  if (nombreEl) nombreEl.textContent = nombre;
  if (iframe) iframe.src = url;
}

function cerrarVisorAcuerdo() {
  const overlay = document.getElementById('acuerdo-visor-overlay');
  const iframe  = document.getElementById('acuerdo-visor-iframe');
  const resDiv  = document.getElementById('acuerdo-resumen-modal-div');
  if (overlay) overlay.style.display = 'none';
  if (iframe) { try { URL.revokeObjectURL(iframe.src); } catch(e){} iframe.src = 'about:blank'; iframe.style.display = ''; }
  if (resDiv) { resDiv.style.display = 'none'; resDiv.innerHTML = ''; }
  verResumenAcuerdoModal._pdfBtn = null;
  verResumenAcuerdoModal._acActivo = null;
  const chatDiv = document.getElementById('acuerdo-chat-escrito-div');
  if (chatDiv) { chatDiv.style.display = 'none'; chatDiv.innerHTML = ''; }
  _escritoChatHistorial = [];
}

function verResumenAcuerdoModal(ac) {
  const overlay = document.getElementById('acuerdo-visor-overlay');
  const iframe  = document.getElementById('acuerdo-visor-iframe');
  const nombreEl = document.getElementById('acuerdo-visor-nombre');
  if (!overlay) { verResumenAcuerdo(ac); return; }

  const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  function _fmtFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T12:00:00');
    return String(d.getDate()).padStart(2,'0') + '/' + meses[d.getMonth()] + '/' + String(d.getFullYear()).slice(2);
  }
  const tipo = ACUERDO_TIPOS[ac.tipo] || ACUERDO_TIPOS.otro;
  const fechaAcuerdo = _fmtFecha(ac.fechaAcuerdo);
  const fechaNotif = ac.fechaNotificacion ? _fmtFecha(ac.fechaNotificacion) : null;
  const notifBadge = fechaNotif
    ? `<span style="font-size:0.6rem;padding:2px 8px;border-radius:4px;background:#ddeeff;color:#1a4a8a;font-weight:700;font-family:'JetBrains Mono',monospace;">🔔 NOTIFICACIÓN ${fechaNotif}</span>`
    : '';

  // Ocultar iframe, mostrar div
  iframe.style.display = 'none';
  let resDiv = document.getElementById('acuerdo-resumen-modal-div');
  if (!resDiv) {
    resDiv = document.createElement('div');
    resDiv.id = 'acuerdo-resumen-modal-div';
    iframe.parentNode.appendChild(resDiv);
  }
  resDiv.style.cssText = 'flex:1;overflow-y:auto;background:var(--surface,#fdfaf4);color:var(--ink,#1a1008);display:flex;flex-direction:column;';

  function _renderContenido(resumen, cargando) {
    const resumenHtml = cargando
      ? `<div style="display:flex;align-items:center;gap:10px;color:var(--muted);font-size:0.8rem;padding:20px 0;"><span style="display:inline-block;width:14px;height:14px;border:2px solid var(--gold);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0;"></span>Generando resumen con IA…</div>`
      : resumen
        ? (() => {
            // Partir el texto en secciones por encabezado **TÍTULO**
            // Cada sección se renderiza con estilo propio
            const partes = resumen.split(/\n(?=\*\*[A-ZÁÉÍÓÚÑ\s]+\*\*)/);
            return partes.map(parte => {
              // Detectar si la sección es de recomendaciones
              const esCliente  = /\*\*RECOMENDACIONES PARA EL CLIENTE\*\*/i.test(parte);
              const esAbogado  = /\*\*RECOMENDACIONES PARA EL ABOGADO\*\*/i.test(parte);
              const bgColor    = esCliente  ? 'background:#f0f7ff;border-left:3px solid #1a4a8a;padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:4px;'
                               : esAbogado  ? 'background:#fff8ee;border-left:3px solid #c8952a;padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:4px;'
                               : '';
              const html = parte
                // **TÍTULO** → negro, mayúsculas, espaciado superior
                .replace(/\*\*([^*]+)\*\*/g, (_, t) => `<strong style="color:#1a1008;text-transform:uppercase;font-size:0.78rem;letter-spacing:0.05em;display:block;margin-bottom:6px;margin-top:2px;">${t}</strong>`)
                // * ítem → viñeta
                .replace(/^\*\s+/gm, '• ')
                // saltos
                .replace(/\n/g,'<br>');
              return bgColor ? `<div style="${bgColor}">${html}</div>` : `<div style="margin-bottom:4px;">${html}</div>`;
            }).join('<br>');
          })()
        : `<em style="color:var(--muted);font-size:0.78rem;">Sin resumen disponible. Presiona <strong>Resumen IA</strong> para generarlo.</em>`;

    resDiv.innerHTML = `
      <div style="display:flex;flex:1;">
        <!-- COL IZQUIERDA: metadata -->
        <div style="flex:1;padding:22px 28px;overflow-y:auto;">
          <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="font-size:0.6rem;padding:2px 8px;border-radius:4px;background:${tipo.bg};color:${tipo.color};font-weight:700;">${tipo.label}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:var(--gold-d,#8c6518);font-weight:700;">${fechaAcuerdo}</span>
            ${notifBadge}
          </div>
          <div style="font-size:1rem;font-weight:700;color:var(--ink);line-height:1.35;margin-bottom:6px;">${escHTML(ac.nombre||ac.archivo)}</div>
          ${ac.descripcion ? `<div style="font-size:0.73rem;color:var(--muted,#7a6840);line-height:1.55;margin-bottom:10px;">${escHTML(ac.descripcion)}</div>` : ''}
          <hr style="border:none;border-top:1px solid var(--border-l,#ecdfa8);margin:14px 0;">
          <div style="font-family:monospace;font-size:0.52rem;letter-spacing:0.15em;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">✦ Resumen IA</div>
          <div id="acuerdo-resumen-texto" style="font-size:0.82rem;line-height:1.8;color:var(--ink);">${resumenHtml}</div>
        </div>
        <!-- SEPARADOR -->
        <div style="width:1px;background:var(--border-l,#ecdfa8);flex-shrink:0;"></div>
        <!-- COL DERECHA: botones acción -->
        <div style="width:160px;flex-shrink:0;padding:16px 12px;display:flex;flex-direction:column;gap:10px;background:var(--surface2,#f7f3e8);">
          <button onclick="event.stopPropagation();_acuerdoModalVerPDF()" style="padding:8px 10px;border-radius:6px;border:1px solid var(--azul,#1a4a8a);background:var(--azul-l,#eef3ff);color:var(--azul);font-size:0.68rem;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:5px;">👁 Ver PDF</button>
          <button onclick="event.stopPropagation();_acuerdoModalRegenerarResumen()" id="btn-regenerar-resumen" style="padding:8px 10px;border-radius:6px;border:1px solid var(--gold,#c8952a);background:var(--gold-bg,rgba(200,149,42,0.08));color:var(--gold-d,#8c6518);font-size:0.68rem;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:5px;">✨ Resumen IA</button>
          <hr style="border:none;border-top:1px solid var(--border-l,#ecdfa8);margin:4px 0;">
          <button onclick="event.stopPropagation();_acuerdoAbrirChatEscrito()" style="padding:8px 10px;border-radius:6px;border:1px solid var(--verde,#1a7a3a);background:var(--verde-l,#e8f5ec);color:var(--verde,#1a7a3a);font-size:0.68rem;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:5px;text-align:center;line-height:1.3;">✍️ Redactar<br>Escrito</button>
        </div>
      </div>`;
  }

  _renderContenido(ac.resumen, false);

  // Si no hay resumen en caché local, intentar cargarlo desde R2 en background
  if (!ac.resumen && ac.driveFileId) {
    (async () => {
      const r2data = await _r2CargarResumen(ac.driveFileId);
      if (r2data && r2data.resumen) {
        ac.resumen = r2data.resumen;
        // Actualizar localStorage
        const jId = window._jdetId;
        if (jId) {
          try {
            const lsKey = 'lex_acuerdos_' + jId;
            const lista = JSON.parse(localStorage.getItem(lsKey) || '[]');
            const idx = lista.findIndex(a => a.driveFileId === ac.driveFileId);
            if (idx >= 0) { lista[idx].resumen = r2data.resumen; localStorage.setItem(lsKey, JSON.stringify(lista)); }
          } catch(e) {}
        }
        _renderContenido(r2data.resumen, false);
      }
    })();
  }

  // Botón Ver PDF
  window._acuerdoModalVerPDF = () => {
    resDiv.style.display = 'none';
    iframe.style.display = '';
    verAcuerdoPDF(ac.driveFileId, encodeURIComponent(ac.nombre||ac.archivo));
  };

  // Botón Resumen IA — regenera desde Drive con Gemini
  window._acuerdoModalRegenerarResumen = async () => {
    const btn = document.getElementById('btn-regenerar-resumen');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando…'; }
    _renderContenido('', true);

    try {
      // Intentar usar ocrTexto de R2 (más barato, sin descargar PDF)
      let ocrTexto = '';
      if (ac.driveFileId) {
        try {
          const r2data = await _r2CargarResumen(ac.driveFileId);
          if (r2data && r2data.ocrTexto) ocrTexto = r2data.ocrTexto;
        } catch(e) {}
      }
      // Si no hay OCR guardado → descargar PDF de Drive y extraer su texto
      // (antes esto se mandaba tal cual a Gemini; ahora se extrae el texto
      // con el mismo pipeline de OCR — Mistral / PDF.js / Tesseract — y se
      // analiza con Groq, igual que el resto del sistema).
      if (!ocrTexto) {
        const token = await driveGetAccessToken();
        if (!token) throw new Error('Sin token Drive');
        const pdfResp = await fetch('https://www.googleapis.com/drive/v3/files/' + ac.driveFileId + '?alt=media', { headers:{ Authorization:'Bearer '+token } });
        if (!pdfResp.ok) throw new Error('No se pudo descargar el PDF');
        const pdfBlob = await pdfResp.blob();
        const pdfFile = new File([pdfBlob], (ac.nombre||ac.archivo||'acuerdo')+'.pdf', { type:'application/pdf' });
        const ocrRes = await _ocrExtraerTexto(pdfFile, ()=>{});
        if (ocrRes && ocrRes.texto) ocrTexto = ocrRes.texto;
      }
      if (!ocrTexto) throw new Error('No se pudo leer el texto del documento (Mistral OCR, PDF.js y Tesseract fallaron)');

      // Obtener leyes activas del juicio actual
      let leyesActivasStr = 'No se han seleccionado leyes específicas para este caso.';
      try {
        const juicioActual = D && D.juicios && D.juicios[typeof jdetIdx !== 'undefined' ? jdetIdx : _mexpIdx];
        const leyesActivas = (juicioActual && juicioActual.leyesActivas) ? juicioActual.leyesActivas : [];
        if (leyesActivas.length) leyesActivasStr = leyesActivas.join(', ');
      } catch(e) {}

      // Prompt de resumen extendido con recomendaciones
      const prompt = `Eres un abogado litigante mexicano experto con 20 años de experiencia en derecho civil y familiar. Analiza este acuerdo judicial con rigor técnico y genera el siguiente informe estructurado. Responde ÚNICAMENTE con el texto, sin JSON, sin bloques de código, sin comentarios adicionales.

LEYES APLICABLES AL CASO: ${leyesActivasStr}

---

**RESUMEN EJECUTIVO**
Redacta un análisis profundo de 10 a 12 líneas (mínimo 4 párrafos) que cubra: el contexto completo del caso, los antecedentes relevantes que motivaron el acuerdo, qué resolvió específicamente el juez y con qué fundamento, cómo impacta esta resolución en el estado procesal actual, qué obligaciones genera para cada parte, y cuál es la perspectiva inmediata del caso tras este acuerdo.

**PUNTOS CLAVE**
Lista los elementos más importantes: partes involucradas, resolución del juez, plazos otorgados, diligencias ordenadas, y cualquier fecha de audiencia o citatorio.

**RECOMENDACIONES PARA EL CLIENTE**
Redacta 4 a 6 recomendaciones prácticas, en lenguaje claro y sin tecnicismos, dirigidas directamente al cliente. Deben responder a: ¿Qué debe hacer? ¿Qué no debe hacer? ¿Qué riesgos enfrenta? ¿Cuáles son los plazos que debe atender? Considera las leyes aplicables al caso.

**RECOMENDACIONES PARA EL ABOGADO**
Redacta 4 a 6 recomendaciones técnicas y estratégicas dirigidas al abogado litigante. Incluye: argumentos jurídicos a fortalecer, diligencias a gestionar de inmediato, riesgos procesales a anticipar, y oportunidades tácticas conforme a las leyes aplicables al caso (${leyesActivasStr}).`;

      const nuevoResumen = (await _iaLlamar(ocrTexto.slice(0, 18000) + '\n\n---\n' + prompt, 3000, 0.3, 'resumen_estrategico')).trim();
      if (!nuevoResumen) throw new Error('La IA no devolvió texto');

      // Persistir: localStorage (caché rápido) + R2 (permanente)
      ac.resumen = nuevoResumen;
      const jId = window._jdetId;
      if (jId) {
        const lsKey = 'lex_acuerdos_' + jId;
        try {
          const lista = JSON.parse(localStorage.getItem(lsKey) || '[]');
          const idx = lista.findIndex(a => a.driveFileId === ac.driveFileId || a.id == ac.id);
          if (idx >= 0) { lista[idx].resumen = nuevoResumen; }
          else { lista.push({ ...ac, resumen: nuevoResumen }); }
          localStorage.setItem(lsKey, JSON.stringify(lista));
        } catch(e) {}
      }
      // Guardar en R2 de forma permanente (no depende del navegador)
      if (ac.driveFileId) _r2GuardarResumen(ac.driveFileId, nuevoResumen);

      _renderContenido(nuevoResumen, false);
      if(typeof toast==='function') toast('✓ Resumen generado', 'ok');

    } catch(e) {
      console.error('[ResumenIA]', e);
      if(typeof toast==='function') toast('⚠ Error al generar resumen: ' + e.message, 'err');
      _renderContenido(ac.resumen, false);
    }
  };

  // Actualizar header del overlay
  if (nombreEl) nombreEl.textContent = ac.nombre || ac.archivo;
  overlay.style.display = 'flex';
  resDiv.style.display = 'flex';
  // Guardar referencia al acuerdo para el chat de escritos
  verResumenAcuerdoModal._acActivo = ac;
}

function verResumenAcuerdo(ac) {
  const subtitulo = ac.nombreLargo && ac.nombreLargo !== ac.nombre
    ? `<div style="font-size:0.65rem;color:var(--muted);margin-bottom:5px;">${escHTML(ac.nombreLargo)}</div>` : '';
  const panelIA = document.getElementById('mexp-ia-resultado');
  if (panelIA) {
    panelIA.innerHTML = `<div style="font-size:0.72rem;font-weight:600;color:var(--ink);margin-bottom:2px;display:flex;align-items:center;gap:6px;">&#128196; ${escHTML(ac.nombre||'')}</div>${subtitulo}<div style="font-size:0.7rem;color:var(--ink-l);line-height:1.65;">${ac.resumen || '<em style="color:var(--muted);">Sin resumen disponible.</em>'}</div><div style="margin-top:8px;font-size:0.6rem;color:var(--muted);">Fecha del acuerdo: ${ac.fechaAcuerdo || '—'}</div>`;
    panelIA.style.display = 'block';
  }
  const iaRes = document.getElementById('mexp-ia-result');
  if (iaRes) {
    iaRes.innerHTML = `<div style="font-size:0.72rem;font-weight:600;color:var(--ink);margin-bottom:2px;">&#128196; ${escHTML(ac.nombre||'')}</div>${subtitulo}<div style="font-size:0.7rem;color:var(--ink-l);line-height:1.65;">${ac.resumen || '<em style="color:var(--muted);">Sin resumen. Vuelve a subir el acuerdo para regenerarlo.</em>'}</div><div style="margin-top:8px;font-size:0.6rem;color:var(--muted);">Fecha: ${ac.fechaAcuerdo || '—'} &nbsp;|&nbsp; Tipo: ${(ACUERDO_TIPOS[ac.tipo]||{}).label||ac.tipo||'—'}</div>`;
    iaRes.style.display = 'block';
  }
}

async function initAcuerdosDrive(juicioId) {
  // Usar siempre un ID estable: preferir Supabase id, fallback a índice numérico
  const jId = (typeof juicioId === 'string' || (typeof juicioId === 'number' && juicioId > 0)) ? juicioId : (_mexpIdx >= 0 ? 'idx_' + _mexpIdx : 'idx_0');
  window._jdetId = jId;
  // Calcular nombre de carpeta (igual que en upload) para buscar en Drive sin crear
  const _juicioActivo = D && D.juicios && D.juicios[typeof jdetIdx !== 'undefined' ? jdetIdx : _mexpIdx];
  const _nombreCarpeta = (_juicioActivo ? (_juicioActivo.nombre || _juicioActivo.cliente || 'Juicio') + ' - Exp.' + (_juicioActivo.expediente || _juicioActivo.num || jId) : 'Juicio-' + jId).replace(/[<>:"/\\|?*]/g,'_');
  const lista = await cargarAcuerdosDrive(jId, _nombreCarpeta);
  renderAcuerdosDrive(lista);
  // Inicializar botones admin y flujo guardado
  if (typeof _flujoInicializarBtn === 'function') _flujoInicializarBtn();
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

function setCarpF(f,el){filtroCT=f;document.querySelectorAll('#panel-carpetas .stats-grid .stat').forEach(b=>b.classList.remove('active'));if(el)el.classList.add('active');renderCarp();}

function abrirDetallesCarpeta(idx){
  const c = D.carpetas[idx];
  if(!c) return;
  let modal = document.getElementById('mCarpDetalles');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'modal-ov';
    modal.id = 'mCarpDetalles';
    modal.innerHTML = `<div class="modal wide" style="max-width:640px;width:94vw;max-height:88vh;overflow-y:auto;box-sizing:border-box;margin:auto;background:linear-gradient(135deg,#fdfaf4 0%,#f5edd8 100%);border-radius:16px;border:2px solid #d4b870;">
      <div class="modal-hdr" style="background:linear-gradient(135deg,#fdfaf4,#f7f3e8);border-bottom:2px solid #d4b870;border-radius:14px 14px 0 0;">
        <h3 id="mCarpDetTitulo" style="color:#4a2f08;font-weight:700;font-family:monospace;font-size:0.85rem;letter-spacing:0.1em;text-transform:uppercase;">EXPEDIENTE</h3>
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="mCarpDetBtnEditar" style="display:flex;align-items:center;gap:5px;background:#fdf6e3;border:1.5px solid #d4b870;border-radius:8px;padding:6px 14px;cursor:pointer;font-family:monospace;font-size:0.68rem;font-weight:700;color:#8c6518;">✏️ Editar expediente</button>
          <button class="modal-x" style="color:#8c6518;" onclick="cerrar('mCarpDetalles')">✕</button>
        </div>
      </div>
      <!-- Encabezado con la identificación del expediente, a dos columnas -->
      <div id="mCarpDetEncabezado" style="border-bottom:1.5px solid #ecdfa8;"></div>
      <div class="modal-body" style="padding:20px 24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <label style="display:block;font-family:monospace;font-size:0.6rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8c6518;">Observaciones / Notas internas</label>
          <button id="mCarpDetBtnAgregar" type="button" style="display:flex;align-items:center;gap:4px;padding:4px 12px;border-radius:14px;border:1px solid #d4b870;background:#fdf6e3;color:#8c6518;font-size:0.65rem;font-weight:700;cursor:pointer;font-family:monospace;">✏️ Editar notas</button>
        </div>
        <div id="mCarpDetBox" style="width:100%;min-height:220px;border:2px solid #d4b870;border-radius:10px;padding:16px 18px;font-family:sans-serif;font-size:0.92rem;line-height:1.7;color:#1a1008;background:#fdf8e8;box-sizing:border-box;"></div>
      </div>
      <div style="padding:14px 24px 20px;border-top:1.5px solid #ecdfa8;background:linear-gradient(135deg,#fdfaf4,#f7f0dc);border-radius:0 0 14px 14px;display:flex;justify-content:flex-end;gap:10px;">
        <button onclick="cerrar('mCarpDetalles')" style="background:none;border:1.5px solid #d4b870;border-radius:10px;padding:10px 22px;cursor:pointer;font-family:monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:#8c6518;font-weight:700;">Cancelar</button>
        <button id="mCarpDetBtnGuardar" style="background:linear-gradient(135deg,#8c6518,#c8952a,#e8c060);border:none;border-radius:10px;padding:10px 28px;cursor:pointer;font-family:monospace;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#fff;font-weight:700;">💾 Guardar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  // Mostrar el modal ANTES de calcular el alto automático de los textarea de
  // Observaciones: mientras el modal tiene display:none, scrollHeight da 0 y
  // el auto-grow colapsaba cada textarea a 0px, dejando el texto (y hasta el
  // placeholder) invisible aunque sí estuviera cargado correctamente.
  modal.classList.add('show');
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  document.getElementById('mCarpDetTitulo').innerHTML = 'EXPEDIENTE · <span style="font-size:1.15em;">'+(esc2(c.num)||'—')+'</span>';
  document.getElementById('mCarpDetBtnEditar').onclick = function(){
    const idxLive = D.carpetas.indexOf(c);
    cerrar('mCarpDetalles');
    abrirCarpeta(idxLive >= 0 ? idxLive : idx);
  };
  // ── Encabezado a dos columnas: izquierda = identificación (número,
  // estatus, fecha); derecha = cliente y trámite (tipo + subtipo fundidos
  // en una sola línea, ya no repetidos en dos campos separados). Un solo
  // badge de estatus (antes se repetía con "Estado del Archivo", campo
  // legado que ya cubre lo mismo).
  (function(){
    const enc = document.getElementById('mCarpDetEncabezado');
    if(!enc) return;
    const chip2 = (label, bg, col, border) =>
      '<span style="display:inline-block;padding:3px 10px;border-radius:3px;font-family:monospace;font-size:0.64rem;font-weight:700;background:'+bg+';color:'+col+';border:1.5px solid '+border+';letter-spacing:0.04em;">'+esc2(label)+'</span>';
    const estatusChip = (() => {
      const e = (c.estatus||'').toUpperCase();
      if(!c.estatus) return '';
      if(e.includes('ARCHIVADO')) return chip2(c.estatus,'#f5f0e8','#5a4a20','#b89840');
      if(e.includes('CONCLUIDO')||e.includes('ENTREGAD')) return chip2(c.estatus,'#eaf4ed','#0d5c2a','#3aaa6a');
      if(e.includes('CANCELADO')) return chip2(c.estatus,'#fdf0f0','#8a1010','#e06060');
      return chip2(c.estatus,'#eef3ff','#1a3a8a','#6090d0');
    })();
    const TIPO_TRAMITE_LABEL = { juicio:'⚖️ Juicio', escritura:'📜 Escritura', registro_civil:'📋 Registro Civil', documentos:'📄 Documentos' };
    const tipoLbl = TIPO_TRAMITE_LABEL[c.tipoTramite] || c.tipoTramite || '—';
    // Subtipo/descripción según el tipo de trámite guardado
    let subtipo = '';
    if(c.tipoTramite === 'juicio' && c.juicioDesc) subtipo = c.juicioDesc;
    else if(c.tipoTramite === 'escritura'){
      const partes = [];
      if(c.escTipo) partes.push(c.escTipo);
      if(c.escNotario) partes.push('Notario: '+c.escNotario);
      if(c.escVolumen || c.escInstrumento) partes.push('V'+(c.escVolumen||'—')+' · I'+(c.escInstrumento||'—'));
      subtipo = partes.join(' · ');
    } else if(c.tipoTramite === 'registro_civil' && c.regCivilTipo) subtipo = {registro_extemporaneo:'Registro Extemporáneo',rectificacion_nombre:'Rectificación de Nombre',aclaracion_nombre:'Aclaración de Nombre'}[c.regCivilTipo]||c.regCivilTipo;
    else if(c.tipoTramite === 'documentos' && c.docDesc) subtipo = c.docDesc;
    const etq = (label) => '<div style="font-size:0.58rem;color:#9a8050;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;font-family:monospace;">'+label+'</div>';
    enc.innerHTML =
        '<div style="display:grid;grid-template-columns:150px minmax(0,1fr);">'
      +   '<div style="padding:18px 16px;border-right:1.5px solid #ecdfa8;">'
      +     etq('Estatus')
      +     (estatusChip ? '<div>'+estatusChip+'</div>' : '<div style="color:#c0b090;font-size:0.8rem;">—</div>')
      +     (c.ingreso ? ('<div style="margin-top:14px;">'+etq('Ingreso')+'<div style="font-size:0.85rem;color:#1a1008;font-weight:600;">📅 '+esc2(c.ingreso)+'</div></div>') : '')
      +     (c.celebEscritura ? ('<div style="margin-top:14px;">'+etq('Celebración')+'<div style="font-size:0.85rem;color:#1a1008;font-weight:600;">📅 '+esc2(c.celebEscritura)+'</div></div>') : '')
      +   '</div>'
      +   '<div style="padding:18px 20px;">'
      +     etq('Nombre / Cliente')
      +     '<div style="font-size:0.95rem;font-weight:600;color:#1a1008;margin-bottom:12px;">'+(esc2(c.cliente)||'—')+'</div>'
      +     etq('Trámite')
      +     '<div style="font-size:0.85rem;color:#1a3a7a;font-weight:600;line-height:1.5;">'+esc2(tipoLbl)+(subtipo ? ' <span style="color:#1a1008;font-weight:400;font-style:italic;">· '+esc2(subtipo)+'</span>' : '')+'</div>'
      +   '</div>'
      + '</div>';
  })();
  // ── Cuadro blanco: numeración de Observaciones/Notas internas. Por
  // defecto se abre en modo CONSULTA (solo lectura) — para editar hay que
  // pulsar el botón junto a la etiqueta, que entonces cambia a modo edición
  // con los renglones numerados y el "＋" para agregar más.
  _dObsState = _carpObsArray(c).map(o => ({ texto: o.texto }));
  if(!_dObsState.length) _dObsState = [{ texto:'' }];
  _dObsEditMode = false;
  _dObsRender();
  document.getElementById('mCarpDetBtnAgregar').onclick = function(){
    if(!_dObsEditMode){ _dObsEditMode = true; _dObsRender(); }
    else { _dObsAgregar(); }
  };
  document.getElementById('mCarpDetBtnGuardar').onclick = async function(){
    const btn = this;
    if(btn.disabled) return; // evita doble clic mientras guarda
    const original = btn.innerHTML;
    // Buscar por número de carpeta (permanente) en vez de por referencia
    // de objeto: si en el fondo llegó una sincronización con Supabase
    // mientras el modal estaba abierto, D.carpetas puede haberse
    // reconstruido con objetos nuevos y "c" ya no sería el mismo — eso
    // hacía que Guardar no encontrara nada y no pasara nada, sin aviso.
    const idxPrevio = D.carpetas.findIndex(x => x.num === c.num);
    if(idxPrevio < 0){
      if(typeof toast === 'function') toast('⚠ No se encontró la carpeta — vuelve a intentar', 'err');
      return;
    }
    // Guardrail contra pérdida de datos: si esta ficha guardaría las
    // Observaciones vacías pero la carpeta YA tenía texto real ahí, se pide
    // confirmación explícita antes de sobrescribir en silencio.
    const _obsNuevoVacio = !_dObsState.some(o => String((o&&o.texto)||'').trim()!=='');
    const _obsViejo = D.carpetas[idxPrevio] || {};
    const _teniaObsReal =
      (Array.isArray(_obsViejo.obsLista) && _obsViejo.obsLista.some(o => String((o&&typeof o==='object')?o.texto:o||'').trim()!=='')) ||
      (_obsViejo.obs && String(_obsViejo.obs).trim()!=='') ||
      (_obsViejo.descripcion && String(_obsViejo.descripcion).trim()!=='');
    if(_obsNuevoVacio && _teniaObsReal){
      const ok = await confirmarBonito({
        titulo: 'Observaciones vacías',
        mensaje: 'Esta carpeta ya tenía texto en Observaciones/Notas internas y así se guardaría vacío.\n\n¿Seguro que quieres borrar ese contenido?',
        btnSi: 'Sí, guardar vacío',
        btnNo: 'Cancelar',
        peligro: true
      });
      if(!ok) return;
    }
    btn.disabled = true;
    btn.style.opacity = '0.75';
    btn.style.cursor = 'wait';
    btn.innerHTML = '<span style="display:inline-block;width:11px;height:11px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;margin-right:7px;vertical-align:-1px;"></span>Guardando…';
    // Pequeño respiro para que el spinner se pinte antes de trabajar —
    // si no, en equipos lentos el clic parece no hacer nada.
    setTimeout(() => {
      // Re-ubicar otra vez por si algo cambió durante la confirmación.
      const idxLive = D.carpetas.findIndex(x => x.num === c.num);
      if(idxLive < 0){
        btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; btn.innerHTML = original;
        if(typeof toast === 'function') toast('⚠ No se encontró la carpeta — vuelve a intentar', 'err');
        return;
      }
      const nuevaLista = _dObsState
        .map(o => String((o&&o.texto)||'').trim())
        .filter(t => t !== '')
        .map(t => ({ texto:t, fecha:_fechaHoyCorta() }));
      D.carpetas[idxLive].obsLista = nuevaLista;
      D.carpetas[idxLive].obs = nuevaLista.map(o=>o.texto).join('\n\n');
      // Ya fusionada dentro de obsLista (nota #1) — se limpia para que no se
      // vuelva a duplicar la próxima vez que se abra esta carpeta.
      D.carpetas[idxLive].descripcion = '';
      D.carpetas[idxLive].fechaModificacion = new Date().toISOString();
      try { renderCarp(); } catch(e){ console.warn('[abrirDetallesCarpeta] renderCarp:', e); }
      try { save(); } catch(e){ console.warn('[abrirDetallesCarpeta] save:', e); }
      try { saveCarpetas(); } catch(e){ console.warn('[abrirDetallesCarpeta] saveCarpetas:', e); }
      try { toast('📋 Observaciones guardadas ✓'); } catch(e){}
      btn.innerHTML = '✓ Guardado';
      btn.style.cursor = '';
      // Ya no se cierra la ficha al guardar — se queda abierta y regresa
      // sola al modo consulta con el texto recién guardado.
      _dObsState = nuevaLista.length ? nuevaLista.map(o => ({ texto:o.texto })) : [{ texto:'' }];
      _dObsEditMode = false;
      _dObsRender();
      setTimeout(() => {
        btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = original;
      }, 900);
    }, 30);
  };
}

function imprimirCarpeta(idx){
  const c=D.carpetas[idx];
  if(!c){ if(typeof toast==='function') toast('Carpeta no encontrada','err'); return; }
  abrirDetallesCarpeta(idx);
  setTimeout(()=>{ window.print(); }, 300);
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
    {ico:'👁',lbl:'Ver detalle',fn:`abrirDetallesCarpeta(${idx})`},
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

function _kObsActualizar(i, val){
  // La fecha NO se fija aquí (mientras se escribe) — se registra sola hasta
  // que la nota realmente se guarda (sube al sistema), en guardarCarpeta().
  if(!_kObsState[i]) _kObsState[i] = { texto:'', fecha:'' };
  _kObsState[i].texto = val;
}

async function eliminarCarpeta(){
  if(eiK<0)return;
  // Re-ubicar por número permanente antes de borrar — mismo motivo que en
  // guardarCarpeta(): eiK puede haber quedado apuntando a otra carpeta si
  // D.carpetas se reconstruyó en segundo plano mientras el modal estaba abierto.
  const idxLive = eiKNum!=null ? D.carpetas.findIndex(x=>x.num===eiKNum) : -1;
  if(idxLive<0){
    toast('⚠ No se encontró la carpeta a eliminar — vuelve a abrirla e inténtalo de nuevo','err');
    return;
  }
  const c=D.carpetas[idxLive];
  const ok = await confirmarBonito({
    titulo: 'Eliminar carpeta',
    mensaje: '¿Eliminar carpeta '+c.num+' — '+c.cliente+'?\n\nEsta acción no se puede deshacer.',
    btnSi: 'Sí, eliminar',
    btnNo: 'Cancelar',
    peligro: true
  });
  if(!ok) return;
  D.carpetas.splice(idxLive,1);
  save();saveCarpetas();renderCarp();cerrar('mCarpeta');toast('Carpeta eliminada — sincronizando...');
}

function setJF(f,el){filtroJ=f;document.querySelectorAll('#panel-juicios .fbtn').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderJuicios();}

function _juEstadoTermino(t){
  if(!t || !t.fecha) return { clave:'sin', dias:null, texto:'Sin fecha', color:'#8a7a5e' };
  if(t.cumplido)     return { clave:'cumplido', dias:null, texto:'Cumplido', color:'#8a7a5e' };
  const hoyISO = (typeof _hoyReal === 'function') ? _hoyReal() : new Date().toISOString().slice(0,10);
  const a = new Date(hoyISO + 'T12:00:00'), b = new Date(t.fecha + 'T12:00:00');
  const dias = Math.round((b - a) / 86400000);
  if(dias < 0)  return { clave:'vencido',  dias, texto:'Venció hace '+Math.abs(dias)+' d', color:'#c0161a' };
  if(dias === 0)return { clave:'hoy',      dias, texto:'Vence HOY',                        color:'#c0161a' };
  if(dias <= 3) return { clave:'porvencer',dias, texto:'En '+dias+' d',                    color:'#b07010' };
  if(dias <= 7) return { clave:'proximo',  dias, texto:'En '+dias+' d',                    color:'#b07010' };
  return          { clave:'entiempo', dias, texto:'En '+dias+' d',                         color:'#1a7a3a' };
}

function _juTerminoUrgente(j){
  const abiertos = _juTerminosPropiosAbiertos(j);
  return abiertos.length ? abiertos[0] : null;
}

function _juRenderListaTabla(lista, el){
  if(!el) return;
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  const _mes = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const fCorta = (iso) => {
    if(!iso) return '—';
    const p = String(iso).split('-');
    if(p.length !== 3) return iso;
    return parseInt(p[2],10) + '-' + (_mes[parseInt(p[1],10)-1] || p[1]);
  };

  // Tira de indicadores (Términos vencidos / Vencen en 3 días / Audiencias
  // 7 días / Expedientes activos) eliminada a petición del usuario
  // (18/ago/2026) — la tabla de abajo ya cubre lo mismo con detalle.
  let html = '';

  if(!lista.length){
    el.innerHTML = html + '<div style="color:var(--muted);padding:24px;font-size:0.76rem;text-align:center;">Sin expedientes en este filtro.</div>';
    return;
  }

  // ── Orden: primero lo que más urge (vencido arriba), luego sin término ──
  const conOrden = lista.map(j => {
    const t = _juTerminoUrgente(j);
    const e = t ? _juEstadoTermino(t) : null;
    return { j, t, e, orden: (e && e.dias !== null) ? e.dias : 99999 };
  }).sort((a,b) => a.orden - b.orden);

  html += '<div style="border:1.5px solid var(--border-l);border-radius:10px;overflow:hidden;background:var(--surface);">'
    + '<table style="width:100%;border-collapse:collapse;font-size:.79rem;">'
    + '<thead><tr>'
    + ['','Cliente / Asunto','Expediente','Etapa','Próxima actuación','Vence','Estatus','']
        .map((h,i) => '<th style="background:var(--surface2);font-family:monospace;font-size:.56rem;letter-spacing:.11em;'
          + 'text-transform:uppercase;color:var(--gold-d);text-align:left;padding:9px 10px;'
          + 'border-bottom:1.5px solid var(--border-l);font-weight:500;'
          + (i===0?'width:22px;':'') + (i===7?'width:78px;':'') + '">'+h+'</th>').join('')
    + '</tr></thead><tbody>';

  conOrden.forEach(({ j, t, e }) => {
    const idx = D.juicios.indexOf(j);
    const col = e ? e.color : '#8a7a5e';
    // La columna Etapa toma primero el Flujo del Procedimiento (más preciso,
    // generado por IA con base en la ley y los documentos del expediente) —
    // solo si nadie marcó ahí la etapa actual se usa la lista genérica de 6
    // pasos (Demanda/Emplazamiento/.../Sentencia) que se marca a mano.
    let etapaTxt;
    if(Array.isArray(j.flujoProcedimiento) && j.flujoProcedimiento.length
       && typeof j.flujoEtapaActual === 'number' && j.flujoEtapaActual >= 0
       && j.flujoProcedimiento[j.flujoEtapaActual] && j.flujoProcedimiento[j.flujoEtapaActual].etapa){
      etapaTxt = (j.flujoEtapaActual + 1) + '. ' + j.flujoProcedimiento[j.flujoEtapaActual].etapa;
    } else {
      const etapas = _juEtapas(j);
      etapaTxt = j.etapa || etapas[0] || '—';
    }
    const nAcuerdos = (j.acuerdos || []).length + (j.historial || []).filter(h => h && h.tipo === 'acuerdo').length;

    html += '<tr onclick="abrirDetalle('+idx+')" style="cursor:pointer;border-bottom:1px solid var(--border-l);"'
      + ' onmouseover="this.style.background=\'var(--gold-bg)\'" onmouseout="this.style.background=\'\'">'
      // semáforo
      + '<td style="padding:9px 10px;"><span style="width:9px;height:9px;border-radius:50%;display:inline-block;background:'+col+';"></span></td>'
      // cliente / asunto
      + '<td style="padding:9px 10px;"><div style="font-weight:700;color:var(--ink);">'+esc2(j.cliente||'—')+'</div>'
        + '<div style="font-family:monospace;font-size:.66rem;color:var(--muted);">'+esc2(j.tipo||'')+'</div></td>'
      // expediente / juzgado
      + '<td style="padding:9px 10px;"><div style="font-family:monospace;font-size:.72rem;">'+esc2(j.expediente||'—')+'</div>'
        + '<div style="font-family:monospace;font-size:.6rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:170px;">'+esc2(j.juzgado||'')+'</div></td>'
      // etapa
      + '<td style="padding:9px 10px;"><span style="font-family:monospace;font-size:.6rem;background:var(--gold-bg);color:var(--gold-d);'
        + 'border:1px solid var(--border-l);border-radius:10px;padding:2px 8px;white-space:nowrap;">'+esc2(etapaTxt)+'</span></td>'
      // próxima actuación
      + '<td style="padding:9px 10px;">'+(t ? esc2(t.descripcion || t.tipo || '—')
          : '<span style="color:var(--muted);font-style:italic;">Sin término abierto</span>')+'</td>'
      // vence
      + '<td style="padding:9px 10px;font-family:monospace;font-size:.72rem;color:'+col+';font-weight:600;white-space:nowrap;">'
        + (t ? fCorta(t.fecha) + '<div style="font-size:.6rem;font-weight:400;">'+esc2(e.texto)+'</div>' : '—') + '</td>'
      // estatus (clic para cambiarlo en la misma ventana de captura)
      + '<td style="padding:9px 10px;">' + _juPillEstatus(j, idx) + '</td>'
      // acciones + señales
      + '<td style="padding:9px 10px;white-space:nowrap;">'
        + '<button onclick="event.stopPropagation();abrirJuicioEdit('+idx+')" title="Editar expediente / cambiar estatus"'
        +   ' style="background:none;border:1px solid var(--border-l);border-radius:5px;cursor:pointer;'
        +   'color:var(--muted);font-size:.75rem;padding:3px 7px;margin-right:5px;"'
        +   ' onmouseover="this.style.borderColor=\'var(--gold)\';this.style.color=\'var(--gold-d)\'"'
        +   ' onmouseout="this.style.borderColor=\'var(--border-l)\';this.style.color=\'var(--muted)\'">✏</button>'
        + '<span style="font-size:.62rem;color:var(--muted);" title="'
        +   (j.folioRecibo?'Recibo vinculado. ':'') + (j.driveFolderId?'Carpeta en Drive. ':'') + nAcuerdos + ' acuerdos">'
        +   (j.folioRecibo?'🧾':'') + (j.driveFolderId?'📁':'') + (nAcuerdos?'<span style="font-family:monospace;">'+nAcuerdos+'</span>':'')
        + '</span>'
        + '</td>'
      + '</tr>';
  });

  html += '</tbody></table></div>'
    + '<div style="text-align:center;padding:10px 0 2px;font-family:monospace;font-size:.62rem;color:var(--muted);">'
    + 'Clic en cualquier renglón para abrir el expediente</div>';
  el.innerHTML = html;
}

function proximaAudienciaDeTerminos(j){
  if(!j.terminos||!j.terminos.length)return null;
  const hoy2=hoy();
  const futuros=j.terminos.filter(t=>!t.cumplido&&t.fecha>=hoy2).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  return futuros.length?futuros[0].fecha:null;
}

function cerrarDetalle(){
  cerrarModalExpediente();
  cerrarVisorPDF();
}

function _mJuVincularCarpeta(){
  if(eiJ<0||!D.juicios[eiJ]){ toast('Guarda el expediente primero','err'); return; }
  jdetIdx=eiJ;
  cerrar('mJuicio');
  abrirVinculacionDrive();
}

function abrirJuicio(idx){
  // Compatibilidad: si se llama sin idx desde la lista (nuevo), o con idx (editar)
  if(idx===undefined)idx=-1;
  abrirJuicioEdit(idx);
}

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

async function resumirUltimoAcuerdoIA(){
  const j=D.juicios[jdetIdx];
  if(!j||!(j.acuerdos||[]).length){toast('No hay acuerdos','err');return;}
  const ultimo=j.acuerdos.slice().sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
  if(!ultimo.descripcion){toast('El acuerdo no tiene descripción','err');return;}
  const btn=$('btn-resumir-ia');
  btn.disabled=true;btn.textContent='⏳ Procesando...';
  try{
    if(typeof _iaLlamar!=='function') throw new Error('Conector de IA no disponible');
    const prompt=`Resume en máximo 3 oraciones claras y concisas el siguiente acuerdo judicial. Destaca qué resolvió el juez, qué acción requiere el abogado y si existe algún plazo. Responde únicamente con el resumen.\n\nAcuerdo (${ultimo.tipo} — ${ultimo.fecha}):\n${ultimo.descripcion}`;
    const resumen=(await _iaLlamar(prompt,500,0.2,'consulta')||'').trim();
    if(!resumen){toast('No se pudo generar resumen','err');return;}
    ultimo.resumenIA=resumen;
    saveJuicios();
    renderAcuerdos();
    toast('Resumen generado ✓','ok');
  }catch(e){toast('Error al conectar con IA','err');console.warn(e);}
  btn.disabled=false;btn.textContent='✨ Resumir con IA';
}

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
        <div class="termino-fecha">${t.fecha}${t.hora?' · '+t.hora:''}${
          t.fechaNotificacion && t.dias
            ? `<span style="color:var(--muted);font-weight:400;"> · notificado ${t.fechaNotificacion} + ${t.dias} ${t.habiles===false?'naturales':'hábiles'}</span>`
            : ''
        }</div>
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
    t.responsable = ($('trResponsable')||{}).value || 'nosotros';
    // Datos del cálculo (para poder recalcular después y dejar constancia
    // de POR QUÉ vence ese día, no solo cuándo)
    t.fechaNotificacion = ($('trNotif')||{}).value || '';
    t.dias    = parseInt(($('trDias')||{}).value, 10) || null;
    t.habiles = ((($('trHabiles')||{}).value) || '1') === '1';
    t.updatedAt = Date.now(); // marca de tiempo para resolver conflictos
    j.updatedAt = Date.now(); // también marcar el juicio padre
    saveJuicios();cerrar('mNuevoTermino');toast('✏ Término actualizado');renderTerminos();renderJuicios();
  } else {
    // Modo nuevo
    j.terminos.push({
      id:'TR-'+Date.now(), tipo, descripcion:desc, fecha,
      hora:$('trHora').value, nota:$('trNota').value.trim(), cumplido:false,
      responsable: ($('trResponsable')||{}).value || 'nosotros',
      // Rastro del cálculo: deja asentado de dónde salió la fecha
      fechaNotificacion: ($('trNotif')||{}).value || '',
      dias:    parseInt(($('trDias')||{}).value, 10) || null,
      habiles: ((($('trHabiles')||{}).value) || '1') === '1'
    });
    if(tipo==='Audiencia'&&!j.audiencia){
      const prox=proximaAudienciaDeTerminos(j);
      if(prox)j.audiencia=prox;
    }
    j.updatedAt = Date.now();
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
  j.updatedAt = Date.now();
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

async function vaciarResueltosDefinitivo(){
  const resueltos = (D.pendientes||[]).filter(p=>p && p.resuelto);
  if(!resueltos.length){ toast('No hay pendientes resueltos que borrar.'); return; }
  const auth = await pedirAutorizacion();
  if(auth === null) return;
  const ok = await confirmarBonito({
    titulo: 'Vaciar Resueltos',
    mensaje: 'Se borrarán para siempre '+resueltos.length+' pendiente(s) resuelto(s), sin esperar los 35 días.\n\nEsta acción no se puede deshacer.',
    btnSi: 'Sí, borrar todo', btnNo: 'Cancelar', peligro: true
  });
  if(!ok) return;
  resueltos.forEach(function(p){ _marcarPendEliminadoLocal(p.id); });
  const idsBorrar = new Set(resueltos.map(function(p){ return p.id; }));
  D.pendientes = (D.pendientes||[]).filter(function(p){ return !(p && idsBorrar.has(p.id)); });
  filtroP = 'activos';
  const btn = $('pendBtnResueltos'); const btnVaciar = $('pendBtnVaciarResueltos');
  if(btn){ btn.textContent = '✓ Resueltos'; btn.style.background='var(--surface)'; btn.style.color='var(--muted)'; }
  if(btnVaciar) btnVaciar.style.display = 'none';
  save();renderPend();badges();syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
  toast('🗑 '+resueltos.length+' resuelto(s) borrado(s) para siempre — autorizó '+auth.nombre);
}

function _inferirSeccion(categoria){
  if(!categoria) return 'otros';
  const c=String(categoria).toLowerCase();
  if(c==='placas'||c.includes('placa')||c.includes('tenencia')) return 'placas';
  if(c==='escritura'||c.includes('escritura')) return 'escrituras';
  if(c==='juicio'||c.includes('juicio')||c.includes('amparo')) return 'juicios';
  return 'otros';
}

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
  // Mostrar botones de estado solo en sección Placas
  const estadoBtns = document.getElementById('placas-estado-btns');
  if (estadoBtns) estadoBtns.style.display = (sec === 'placas') ? 'flex' : 'none';
  // Los pendientes de Placas ya NO se crean a mano — se generan solos al
  // registrar un recibo de trámite vehicular (sincronizarPendientesPlacas) y
  // desaparecen solos al liquidarse o cancelarse. Se oculta "+ Nuevo" aquí.
  const btnNuevo = document.getElementById('pendBtnNuevo');
  if (btnNuevo) btnNuevo.style.display = (sec === 'placas') ? 'none' : '';
  // "Resueltos" (y su botón de vaciar) es propio de Pendientes generales —
  // Placas se identifica por folio de recibo, no aplica el concepto de
  // "resuelto" manual, así que se ocultan en esa sección.
  const btnResueltos = document.getElementById('pendBtnResueltos');
  if (btnResueltos) btnResueltos.style.display = (sec === 'placas') ? 'none' : '';
  if (sec === 'placas') {
    const btnVaciar = document.getElementById('pendBtnVaciarResueltos');
    if (btnVaciar) btnVaciar.style.display = 'none';
    if (filtroP === 'resuelto') filtroP = 'activos';
  }
  // Caja grande con el total de pendientes de la sección activa. Antes solo
  // se mostraba en Placas ("N PENDIENTES"); a Pendientes generales le
  // faltaba el mismo total — ahora se muestra en ambas.
  const countBox = document.getElementById('pendPlacasCountBox');
  if (countBox) countBox.style.display = 'flex';
  renderPend();
}

function _pendEstadoPorClave(key){
  return _PEND_ESTADOS[key] || _PEND_ESTADOS.pendiente;
}

function _pendEstadoPorEdad(dias){
  if(dias >= 90) return _PEND_ESTADOS.abandonado;
  if(dias >= 60) return _PEND_ESTADOS.critico;
  if(dias >= 30) return _PEND_ESTADOS.urgente;
  return _PEND_ESTADOS.pendiente;
}

function _pendEstatus(idx, btn){
  const p = D.pendientes[idx];
  if(!p) return;
  // Eliminar menú previo si existe
  const prev = document.getElementById('_pend-estatus-menu');
  if(prev){ prev.remove(); if(prev._idx===idx) return; }
  const menu = document.createElement('div');
  menu.id = '_pend-estatus-menu';
  menu._idx = idx;
  menu.style.cssText = 'position:fixed;z-index:9999;background:#fdfaf4;border:1.5px solid #d4b870;border-radius:9px;padding:8px;display:flex;flex-direction:column;gap:5px;box-shadow:0 6px 20px rgba(0,0,0,0.18);width:200px;';
  const encabezado = document.createElement('div');
  encabezado.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 0 3px;';
  const titulo = document.createElement('span');
  titulo.textContent = 'ESTATUS DE LA TARJETA';
  titulo.style.cssText = 'font-size:9px;font-weight:800;color:var(--muted);letter-spacing:0.08em;';
  const btnCerrar = document.createElement('span');
  btnCerrar.textContent = '✕';
  btnCerrar.title = 'Cerrar';
  btnCerrar.style.cssText = 'cursor:pointer;font-size:11px;font-weight:800;color:var(--muted);line-height:1;padding:2px 4px;border-radius:4px;';
  btnCerrar.onmouseover = ()=>{ btnCerrar.style.color = 'var(--rojo,#c0161a)'; };
  btnCerrar.onmouseout  = ()=>{ btnCerrar.style.color = 'var(--muted)'; };
  btnCerrar.onclick = ()=>{ menu.remove(); document.removeEventListener('click', close); };
  encabezado.appendChild(titulo);
  encabezado.appendChild(btnCerrar);
  menu.appendChild(encabezado);
  ['pendiente','urgente','critico','abandonado'].forEach(function(key){
    const o = _pendEstadoPorClave(key);
    const activo = p.estadoManual === key;
    const s = document.createElement('span');
    s.innerHTML = '<span style="display:flex;align-items:center;gap:7px;">' + o.icon + ' ' + o.label + '</span>'
      + '<span style="font-size:8.5px;font-weight:600;opacity:0.75;letter-spacing:0.03em;">' + o.rango + '</span>';
    s.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:7px;font-size:10.5px;padding:6px 10px;border-radius:7px;cursor:pointer;font-weight:800;font-family:monospace;background:${o.bg};color:${o.fg};border:1.5px solid ${activo?o.fg:o.border};`;
    s.onclick = ()=>{ p.estadoManual=key; save(); syncEstadoSupabaseDebounced().catch(()=>{}); renderPend(); menu.remove(); toast('Estatus fijado a '+o.label); };
    menu.appendChild(s);
  });
  const auto = document.createElement('span');
  auto.textContent = '🔄 Automático (por antigüedad)';
  auto.style.cssText = 'font-size:9.5px;padding:6px 10px;border-radius:7px;cursor:pointer;font-weight:700;font-family:monospace;background:transparent;border:1.5px dashed var(--border-l,#d4b870);color:var(--muted);text-align:center;margin-top:2px;';
  auto.onclick = ()=>{ delete p.estadoManual; save(); syncEstadoSupabaseDebounced().catch(()=>{}); renderPend(); menu.remove(); toast('Estatus vuelve a calcularse por antigüedad'); };
  menu.appendChild(auto);
  document.body.appendChild(menu);
  const r = btn.getBoundingClientRect();
  menu.style.top  = (r.bottom+6)+'px';
  menu.style.right = (window.innerWidth-r.right)+'px';
  const close = (e)=>{ if(!menu.contains(e.target)&&e.target!==btn){ menu.remove(); document.removeEventListener('click',close); } };
  setTimeout(()=>document.addEventListener('click',close),50);
}

function _placasVerDocFromCard(pendIdx, docIdx){
  const docs = (D.pendientes[pendIdx]||{}).documentos;
  const d = docs?.[docIdx];
  if(d) _pVerDoc(d, pendIdx, docIdx, docs);
}

function _placasResolverPend(pendId, idxOrig){
  if(typeof D === 'undefined' || !Array.isArray(D.pendientes)) return null;
  if(pendId){
    const porId = D.pendientes.find(function(x){ return x && x.id === pendId; });
    if(porId) return porId;
  }
  return D.pendientes[idxOrig] || null;
}

function _pendPurgarResueltosViejos(){
  const lista = D.pendientes || [];
  const hoyMs = Date.parse(hoy() + 'T12:00:00');
  const _VENTANA_RETENCION_DIAS = 10;
  const aBorrar = lista.filter(function(p){
    if(!p || !p.resuelto || !p.fechaResuelto) return false;
    const fMs = Date.parse(p.fechaResuelto + 'T12:00:00');
    if(isNaN(fMs)) return false;
    const dias = Math.floor((hoyMs - fMs) / 86400000);
    return dias > _VENTANA_RETENCION_DIAS;
  });
  if(!aBorrar.length) return;
  aBorrar.forEach(function(p){ _marcarPendEliminadoLocal(p.id); });
  const idsBorrar = new Set(aBorrar.map(function(p){ return p.id; }));
  D.pendientes = lista.filter(function(p){ return !(p && idsBorrar.has(p.id)); });
  console.warn('[Pendientes] 🗑 Purgados '+aBorrar.length+' resuelto(s) con más de '+_VENTANA_RETENCION_DIAS+' días');
  save();
}

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
          ${p.seccion==='placas'?filaHtml('📋','Estatus gestión', p.estatusGestion==='vinculado'||p.estatusGestion==='enviado' ? '✅ CARPETA VINCULADA EN DRIVE'+(p.expDigitalFechaEnvio?' ('+p.expDigitalFechaEnvio+')':'') : '⏳ CARPETA SIN VINCULAR EN DRIVE'):''}
        </div>
      </div>
      <!-- Footer -->
      <div style="padding:12px 20px 16px;border-top:1.5px solid #ecdfa8;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
        <button onclick="document.getElementById('_det-pend-ov').remove()" style="background:none;border:1.5px solid #d4b870;border-radius:8px;padding:8px 18px;cursor:pointer;font-family:monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:#8c6518;font-weight:700;" onmouseover="this.style.background='rgba(200,149,42,0.08)'" onmouseout="this.style.background='none'">Cerrar</button>
        ${p.expDigitalDriveFolderId?`<button onclick="window.open('https://drive.google.com/drive/folders/${p.expDigitalDriveFolderId}','_blank')" style="background:#e8f5ec;border:1.5px solid #2a7a4a;border-radius:8px;padding:8px 18px;cursor:pointer;font-family:monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:#0a4020;font-weight:700;" onmouseover="this.style.background='#c8f0d8'" onmouseout="this.style.background='#e8f5ec'">👁 Ver Carpeta en Drive</button>`:''}
        <button onclick="document.getElementById('_det-pend-ov').remove();abrirPendiente(${idx})" style="background:linear-gradient(135deg,#8c6518,#c8952a);border:none;border-radius:8px;padding:8px 20px;cursor:pointer;font-family:monospace;font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:#fff;font-weight:700;" onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">✏ Editar</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function _construirPendienteBase(prevP, especifico){
  return Object.assign({
    prioridad: (prevP && prevP.prioridad) || 'normal',
    resp: (prevP && prevP.resp) || 'Antonieta',
    obs: (prevP && prevP.obs) || '',
    fechaLimite: (prevP && prevP.fechaLimite) || '',
    carpeta: (prevP && prevP.carpeta) || '',
    resuelto: prevP ? !!prevP.resuelto : false,
    fechaCreacion: (prevP && prevP.fechaCreacion) || hoy(),
    fechaResolucion: (prevP && prevP.fechaResolucion) || '',
    // Quién subió el pendiente — se captura automáticamente al crearlo y
    // NUNCA se modifica en ediciones posteriores (a diferencia de "resp",
    // que es el responsable/asignado y sí se puede cambiar a mano).
    creadoPor: (prevP && prevP.creadoPor) || (empleadoActual ? empleadoActual.nombre : NOMBRE_TITULAR)
  }, especifico, {
    // Marca de tiempo de la última modificación — usada por el merge de
    // sincronizarFolio() para no dejar que un pull con la copia vieja de
    // Supabase pise un cambio local reciente (mismo patrón que carpetas/
    // escrituras/citas). Se pisa SIEMPRE, en cada guardado.
    fechaMod: new Date().toISOString()
  });
}

function _persistirPendiente(p, msg){
  if (eiP >= 0) D.pendientes[eiP] = p;
  else D.pendientes.unshift(p);
  cerrar('mPendiente');
  save(); syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); }); renderPend(); badges();
  toast((msg||'Pendiente guardado ✓') + ' — sincronizando...');
}

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

async function pPlacasAdjuntar(event){
  const files = event.target.files;
  if (!files || !files.length) return;
  const MAX_BYTES = 10 * 1024 * 1024;
  let agregados = 0, rechazados = 0;
  let pendientes = files.length;
  const nombre = document.getElementById('pPlacasNombre')?.value.trim() || 'sin_nombre';
  const nombreSafe = nombre.replace(/[^a-zA-Z0-9 _\-]/g,'_').substring(0,50);
  toast('Subiendo '+pendientes+' archivo(s) a Drive...','ok');
  // Obtener token y carpeta Drive una sola vez para todos los archivos
  let driveToken = '', carpetaClienteId = '';
  try {
    driveToken = typeof driveGetAccessToken==='function' ? await driveGetAccessToken() : '';
    if (driveToken) {
      const DRIVE_ROOT   = '1TtVVL0Jbw6BFkwLw8Wo1LZfxLN0I_ndU';
      const carpetaPlacas  = await driveObtenerOCrearCarpeta(driveToken, 'Placas', DRIVE_ROOT);
      carpetaClienteId     = await driveObtenerOCrearCarpeta(driveToken, nombreSafe, carpetaPlacas);
    }
  } catch(e) { console.warn('[Drive pPlacas] preparación:', e); }
  for (const file of Array.from(files)) {
    if (file.size > MAX_BYTES) { rechazados++; pendientes--; if(pendientes===0)_pPlacasMostrarResultadoSubida(agregados,rechazados); continue; }
    const tiposValidos = ['image/png','image/jpeg','image/jpg','application/pdf'];
    if (!tiposValidos.includes(file.type)) { rechazados++; pendientes--; if(pendientes===0)_pPlacasMostrarResultadoSubida(agregados,rechazados); continue; }
    if (driveToken && carpetaClienteId) {
      try {
        const nombreArchivo = Date.now()+'_'+file.name.replace(/[^a-zA-Z0-9._\-]/g,'_');
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({name:nombreArchivo,parents:[carpetaClienteId]})],{type:'application/json'}));
        form.append('file', file);
        const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',{
          method:'POST', headers:{Authorization:'Bearer '+driveToken}, body:form
        });
        if (resp.ok) {
          const data = await resp.json();
          _pPlacasState.documentos.push({nombre:file.name,tipo:file.type,tamano:file.size,fechaSubida:hoy(),driveFileId:data.id,drivePath:'Placas/'+nombreSafe+'/'+nombreArchivo});
          agregados++;
        } else { rechazados++; }
      } catch(e) { console.warn('[Drive pPlacas] subida:', e); rechazados++; }
    } else {
      // Fallback base64
      await new Promise(res => {
        const reader = new FileReader();
        reader.onload = (e) => {
          _pPlacasState.documentos.push({nombre:file.name,tipo:file.type,tamano:file.size,fechaSubida:hoy(),dataURL:e.target.result});
          agregados++;
          res();
        };
        reader.onerror = () => { rechazados++; res(); };
        reader.readAsDataURL(file);
      });
    }
    pendientes--;
    _pPlacasRenderDocs();
    if (pendientes===0) _pPlacasMostrarResultadoSubida(agregados,rechazados);
  }
  event.target.value = '';
}

function pPlacasEliminarDoc(i){
  const d = _pPlacasState.documentos[i];
  if (!d) return;
  if (!confirm('¿Quitar el archivo "'+d.nombre+'" de este pendiente?')) return;
  _pPlacasState.documentos.splice(i,1);
  _pPlacasRenderDocs();
  // Borrar de Drive si tiene driveFileId
  if (d.driveFileId) {
    driveGetAccessToken().then(function(token){
      if (!token) return;
      fetch('https://www.googleapis.com/drive/v3/files/'+d.driveFileId,{
        method:'DELETE', headers:{Authorization:'Bearer '+token}
      }).catch(function(e){ console.warn('[Drive placas] borrar doc:',e); });
    }).catch(function(){});
  }
  // Borrar de R2 si era un doc antiguo con r2path
  if (d.r2path && typeof borrarR2==='function') borrarR2(d.r2path, d.bucket || 'placas').catch(function(){});
}

function pEscEliminarDoc(i){
  const d = _pEscState.documentos[i];
  if (!d) return;
  if (!confirm('¿Quitar el archivo "'+d.nombre+'" de este pendiente?')) return;
  _pEscState.documentos.splice(i,1);
  _pEscRenderDocs();
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
    cont.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:0.78rem;">No hay expedientes registrados todavía. Crea uno desde Juicios.</div>';
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

function _irAJuicio(idx){
  if (typeof idx !== 'number' || idx < 0) return;
  ir('juicios');
  setTimeout(() => {
    if (typeof abrirDetalle === 'function') abrirDetalle(idx);
  }, 300);
}

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

function _pVerDoc(d, pendienteIdx, docIdx, lista){
  if (!d) return;
  // Resolver lista de docs según contexto
  let docList = lista || null;
  if (!docList && pendienteIdx !== undefined) {
    const p = (typeof D !== 'undefined' && D.pendientes) ? D.pendientes[pendienteIdx] : null;
    if (p && p.documentos && p.documentos.length > 1) docList = p.documentos;
  }
  window._docPreviewCtx = { d, pendienteIdx, docIdx, lista: docList };
  window._docZoomLevel  = 1;
  window._docPanOffset  = { x:0, y:0 };
  _pVerDocRender();
  document.getElementById('mDocPreview').classList.add('show');
}

async function _pVerDocEliminar(){
  const ctx = window._docPreviewCtx;
  if (!ctx || ctx.pendienteIdx === undefined) return;
  if (!confirm('¿Eliminar este archivo? Esta acción no se puede deshacer.')) return;
  const d = ctx.d;
  // Igual que al adjuntar: se relocaliza el pendiente por id, porque el borrado
  // en Drive tarda y una sincronización de fondo puede reemplazar D.pendientes.
  let p = D.pendientes[ctx.pendienteIdx];
  const _pendIdDel = p && p.id ? p.id : null;
  if (!p || !p.documentos) return;
  if (typeof _placasProgreso === 'function') _placasProgreso('🗑 Eliminando archivo…');
  try {
    // Borrar de Drive si tiene driveFileId
    if (d.driveFileId) {
      try {
        const token = await driveGetAccessToken();
        if (token) {
          const _pDel = fetch('https://www.googleapis.com/drive/v3/files/'+d.driveFileId,{method:'DELETE',headers:{Authorization:'Bearer '+token}});
          await (typeof _sbConTimeout === 'function' ? _sbConTimeout(_pDel, 15000, 'Drive eliminar') : _pDel);
        }
      } catch(e){ console.warn('[Drive placas] eliminar desde visor:', e); }
    }
    // Borrar de R2 si era doc antiguo
    if (d.r2path && typeof window.borrarR2 === 'function') {
      if (typeof _placasProgreso === 'function') _placasProgreso('🗑 Eliminando respaldo…');
      await window.borrarR2(d.r2path, d.bucket || 'placas').catch(e => console.warn('R2 borrar:', e));
    }
    if (typeof _placasResolverPend === 'function') {
      const _pFresco = _placasResolverPend(_pendIdDel, ctx.pendienteIdx);
      if (_pFresco && _pFresco.documentos) p = _pFresco;
    }
    if (typeof _placasProgreso === 'function') _placasProgreso('💾 Guardando…');
    p.documentos.splice(ctx.docIdx, 1);
    save(); renderPend();
    cerrar('mDocPreview');
    toast('Archivo eliminado', 'ok');
  } catch(errDel) {
    console.error('[Placas] error al eliminar documento:', errDel);
    if(typeof registrarError === 'function') registrarError('Placas · eliminar documento', errDel,
      { archivo: (d && d.nombre) || '', driveFileId: (d && d.driveFileId) || '' });
    toast('❌ Error al eliminar: ' + ((errDel && errDel.message) || errDel), 'err');
  } finally {
    if (typeof _placasProgreso === 'function') _placasProgreso(null);
  }
}

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

// ── Tarjeta "Pendientes de hoy" en Principal ──────────────────────────────
// Muestra los pendientes sueltos (sección "Otros" — recordatorios como
// "llamar a fulano", "recoger paquetería", "pagar la renta") que están sin
// resolver y o bien no tienen fecha límite (recordatorio abierto, se muestra
// hasta que se resuelva) o su fecha límite ya llegó/pasó. Mismo patrón visual
// que la tarjeta de Vencimientos próximos (venc-card-wrap).
function renderPendientesHoyCard(){
  if (typeof D === 'undefined' || !Array.isArray(D.pendientes)) return;
  const card    = document.getElementById('pendhoy-card-wrap');
  const grupos  = document.getElementById('pendhoy-grupos');
  const resumen = document.getElementById('pendhoy-resumen');
  if (!card || !grupos) return;
  const hoyStr = (typeof fechaCDMX_ISO === 'function') ? fechaCDMX_ISO() : new Date().toISOString().slice(0,10);
  const items = D.pendientes
    .filter(p => p && !p.resuelto && p.seccion === 'otros' && (!p.fechaLimite || p.fechaLimite <= hoyStr))
    .map(p => ({
      texto:       p.texto || p.obs || '(sin descripción)',
      persona:     p.persona || '',
      resp:        p.resp || 'Antonieta',
      fechaLimite: p.fechaLimite || '',
      vencido:     !!(p.fechaLimite && p.fechaLimite < hoyStr)
    }))
    .sort((a, b) => {
      const rank = x => x.vencido ? 0 : x.fechaLimite ? 1 : 2; // atrasados, luego hoy, luego sin fecha
      const r = rank(a) - rank(b);
      return r !== 0 ? r : (a.fechaLimite||'').localeCompare(b.fechaLimite||'');
    });
  if (!items.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  const vencidos = items.filter(x => x.vencido);
  if (resumen) {
    resumen.textContent = vencidos.length
      ? vencidos.length + ' atrasado' + (vencidos.length > 1 ? 's' : '')
      : items.length + ' pendiente' + (items.length > 1 ? 's' : '');
    resumen.style.color = vencidos.length ? 'var(--rojo,#c0161a)' : 'var(--amarillo,#9a6010)';
  }
  grupos.innerHTML = items.map(x => {
    const badgeTxt = x.vencido ? 'Atrasado' : (x.fechaLimite === hoyStr ? 'HOY' : 'Sin fecha');
    const color = x.vencido ? '#c0161a' : (x.fechaLimite === hoyStr ? '#9a6010' : 'var(--muted)');
    return '<div onclick="ir(\'pendientes\')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(200,149,42,0.07);">'
      + '<span style="font-family:monospace;font-size:0.62rem;font-weight:700;color:'+color+';background:rgba(192,22,26,0.08);border-radius:5px;padding:1px 6px;flex-shrink:0;">'+badgeTxt+'</span>'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:0.75rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(x.texto)+'</div>'
      + '<div style="font-size:0.6rem;color:var(--muted);">'+(x.persona ? esc(x.persona)+' · ' : '')+'Responsable: '+esc(x.resp)+'</div>'
      + '</div></div>';
  }).join('');
}

function badges(){
  const uj=D.juicios.filter(j=>j.estatus==='urgente').length;
  const up=D.pendientes.filter(p=>!p.resuelto&&p.prioridad==='urgente').length;
  const bj=$('badgeJ'),bp=$('badgeP');
  bj.textContent=uj||'';bj.style.display=uj?'':'none';
  bp.textContent=up||'';bp.style.display=up?'':'none';
  const ue=(D.escrituras||[]).filter(e=>e.estado==='urgente').length;
  const be=$('badgeEscrituras');
  if(be){be.textContent=ue||'';be.style.display=ue?'':'none';}
  const hoy2=(typeof fechaCDMX_ISO==='function')?fechaCDMX_ISO():new Date().toISOString().slice(0,10);
  const uc=(D.citas||[]).filter(c=>c.fecha>=hoy2).length;
  const bc=$('badgeCitas');
  if(bc){bc.textContent=uc||'';bc.style.display=uc?'':'none';}
  safeExec('renderPendientesHoyCard', () => renderPendientesHoyCard());
}

async function guardarTodo() {
  // 1. localStorage primero (siempre rápido y nunca falla)
  try { backupLocal('D', D); } catch(e){ console.warn('backup D:', e); }
  // 2. Drive en paralelo (los dos archivos son independientes)
  if(!sbSession || Date.now() >= sbExpiry) return;
  const promesas = [];
  promesas.push(syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); }));
  await Promise.all(promesas);
}

function saveCarpetas(){
  // Guardar solo el array de carpetas en el archivo dedicado en Drive
  syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
}

function sugerirNumeroCarpeta() {
  const carpetas = D.carpetas || [];
  const numeros = carpetas
    .map(c => parseInt((c.num||'').replace('CARP.-','').replace('ARCH-','')) || 0)
    .filter(n => n > 0);
  if(!numeros.length) return 1;
  return Math.max(...numeros) + 1;
}

function _marcarJuicioEliminadoLocal(id){
  if(!id) return;
  window._juiciosEliminadosRecientemente = window._juiciosEliminadosRecientemente || {};
  window._juiciosEliminadosRecientemente[id] = Date.now();
}

function _marcarCitaEliminadaLocal(id){
  if(!id) return;
  window._citasEliminadasRecientemente = window._citasEliminadasRecientemente || {};
  window._citasEliminadasRecientemente[id] = Date.now();
}

function _expDigVerDoc(i) {
  var docs = _expDigDocsArray(false);
  var d = docs[i];
  if (!d) return;
  var pend = _expDigPendienteActual();
  var pendIdx = pend ? D.pendientes.indexOf(pend) : undefined;
  _pVerDoc(d, pendIdx, i, docs);
}

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

function _expDigEnviar() { return _expDigVincularCarpeta(); }

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

function _juCumplirTerminoUrgente(idx){
  const j = D.juicios[idx]; if(!j) return;
  const t = _juTerminoUrgente(j); if(!t) return;
  _juCumplirTermino(idx, t.id);
}

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
    const mistralKey = typeof _mistralGetKey === 'function' ? _mistralGetKey() : '';
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

function cerrarModalCargarLeyes() {
  const modal = document.getElementById('modal-cargar-leyes');
  if (modal) modal.style.display = 'none';
}

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
      // Antes esto era "disparar y olvidar" (syncEstadoSupabaseDebounced sin
      // esperar su resultado): si el usuario recargaba la página justo después
      // de ver el aviso de éxito, podía ganar la carrera el fetch de estado
      // viejo desde Supabase y el flujo recién generado se perdía sin aviso.
      // Ahora se espera la confirmación real antes de reportar éxito.
      _setLoad('Guardando flujo…');
      try {
        if (typeof syncEstadoSupabase === 'function') {
          await syncEstadoSupabase();
        } else if (typeof syncEstadoSupabaseDebounced === 'function') {
          await syncEstadoSupabaseDebounced();
        }
      } catch (eGuardar) {
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

async function _iaLlamarGrounded(promptBase, textoLeyes, maxTokens, temperatura, perfil){
  if (!textoLeyes) return _iaLlamar(promptBase, maxTokens, temperatura, perfil);
  const promptFinal = promptBase +
    '\n\nFUNDAMENTO LEGAL — TEXTO DE LAS LEYES ACTIVAS DEL CASO (fuente única y obligatoria para citar artículos, plazos y datos exactos; usa comillas al citar; si un dato no aparece en este texto dilo explícitamente — NUNCA lo inventes):' +
    textoLeyes;
  // ⚠️ CAMBIO (31-ago-2026): Gemini primero — sin límite de tokens por minuto
  // ni "impuesto de razonamiento", y con ventana de contexto de 1M tokens
  // cubre leyes largas completas sin recortes (mejor que el "contexto largo"
  // de Cloudflare, que aquí se probaba primero antes de este cambio).
  const geminiKeyGr = typeof ocrModGetKey === 'function' ? ocrModGetKey() : '';
  if (geminiKeyGr && geminiKeyGr.length > 10) {
    try { return await _geminiGenerarTexto(promptFinal, maxTokens, temperatura, perfil); }
    catch(e){ console.warn('[IA] Gemini (grounded) falló (' + e.message + '); intentando con Cloudflare...'); }
  }
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
