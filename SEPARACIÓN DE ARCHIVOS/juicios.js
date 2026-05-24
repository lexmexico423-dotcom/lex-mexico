/* ═══════════════════════════════════════════════════════════════
   LEX-MÉXICO · juicios.js
   Módulo Historial Cronológico — Sala de Juicio
   Incluye:
     · HJ_TIPOS — tipos de entradas del historial
     · hjAbrirNueva, hjCerrarForm — formulario de entradas
     · hjGuardar — guardar entrada + detectar términos con IA
     · hjRenderLista — renderizar historial cronológico
     · hjResumenIA — resumen IA del proceso completo
     · hjRenderTerminos — panel de términos/vencimientos
     · Chat IA del historial (contexto del expediente)
     · Sobrescritura de abrirDetalle para pantalla completa
   Dependencias: utils.js, ia.js deben cargarse primero
═══════════════════════════════════════════════════════════════ */

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

  // Detección automática de términos desactivada para ahorrar créditos
  // Para reactivar: descomentar la línea de setTimeout + _hjDetectarTerminos
  _ocrMostrarModalNotificacion(texto);
}

// ── Detectar términos automáticamente con IA ─────────────────────────
async function _hjDetectarTerminos(entrada, j) {
  // Solo buscar en acuerdos, requerimientos y audiencias
  if (!['acuerdo','requerimiento','audiencia','notificacion'].includes(entrada.tipo)) return;

  // FIX: verificar key y respetar cooldown antes de llamar
  // Verificar que haya key de Groq o Gemini disponible
  const _keyTerm = (typeof _groqGetKey==='function' ? _groqGetKey() : '') || window._geminiKeyCached || localStorage.getItem('lex-gemini-key') || '';
  if (!_keyTerm || _keyTerm.length < 10) return;
  if ((window._geminiCooldownHasta || 0) > Date.now()) return;

  try {
    const prompt = `Eres asistente legal mexicano. Analiza este texto de un expediente judicial y detecta si menciona algún plazo, término, audiencia o fecha importante que el abogado deba registrar.

TEXTO:
"${entrada.texto}"

Si encuentras uno o más plazos o fechas, responde con JSON:
{"terminos":[{"tipo":"Audiencia|Contestación|Requerimiento|Escrito|Término|Pruebas|Apelación|Otro","descripcion":"descripción breve","fecha":"YYYY-MM-DD o null si no hay fecha exacta"}]}

Si NO hay ningún plazo o término, responde: {"terminos":[]}

Responde SOLO con el JSON, sin texto adicional.`;

    // Usar _iaLlamar: Groq primero, fallback Gemini
    const txt = (await _iaLlamar(prompt, 200, 0.3)).trim();
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

// ── Acciones sugeridas: Gemini + Groq en paralelo ───────────────────
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

  // ── Usar _iaLlamar: Groq primero, fallback Gemini ──
  (async () => {
    try {
      const txt = await _iaLlamar(promptAcciones, 600, 0.2);
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
    '<span style="font-family:monospace;font-size:0.6rem;font-weight:700;color:rgba(110,231,160,0.9);letter-spacing:0.12em;text-transform:uppercase;">✦ IA — Groq / Gemini</span>',
    '</div><div id="ia-panel-gemini" style="padding:16px;font-size:0.88rem;color:#c8f0d8;line-height:1.8;min-height:200px;"><span style="color:rgba(110,231,160,0.35);font-style:italic;">Analizando...</span></div></div>',

    '</div>',
    '<div style="padding:10px 24px;border-top:1px solid rgba(200,149,42,0.1);font-family:monospace;font-size:0.48rem;color:rgba(122,104,64,0.35);text-align:right;flex-shrink:0;">Gemini 2.5 Flash</div>'
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
      const txt = await _iaLlamar(promptAcciones, 1200, 0.3);
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
    (mensaje||'El token de Drive venció o no tiene permisos.'),
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
  return _agConstruirContexto();
}

// ── Sobrescribir abrirDetalle para renderizar la nueva pantalla ───────
const _abrirDetalleOriginal = abrirDetalle;
abrirDetalle = function(idx) {
  jdetIdx = idx;
  const j = D.juicios[idx];
  if (!j) return;

  document.getElementById('juicios-lista-view').style.display = 'none';
  const det = document.getElementById('juicio-detalle');
  det.classList.add('visible');

  // Header
  document.getElementById('jdet-nombre').textContent = j.cliente || '—';
  document.getElementById('jdet-tipo').textContent = (j.tipo || '') + (j.expediente ? ' · Exp. ' + j.expediente : '');

  const tagC = {'urgente':'tag-r','proceso':'tag-a','estable':'tag-v','concluido':'tag-m','inicio':'tag-b'}[j.estatus] || 'tag-m';
  const tagL = {'urgente':'🔴 Urgente','proceso':'🟡 En Proceso','estable':'🟢 Estable','concluido':'⚫ Concluido','inicio':'🔵 Inicio'}[j.estatus] || j.estatus;
  const eTag = document.getElementById('jdet-estatus-tag');
  eTag.className = 'tag ' + tagC; eTag.textContent = tagL;

  const expBadge = document.getElementById('jdet-exp-badge');
  if (expBadge) expBadge.textContent = j.expediente ? 'Exp. ' + j.expediente : '';

  const folioBadge = document.getElementById('jdet-folio-badge');
  if (folioBadge) { folioBadge.style.display = j.folioRecibo ? '' : 'none'; if (j.folioRecibo) folioBadge.textContent = '🧾 Folio #' + folioFormato(j.folioRecibo); }

  const driveLabel = document.getElementById('jdet-drive-label');
  const driveBadge = document.getElementById('jdet-drive-badge');
  if (j.driveFolderId) {
    if (driveLabel) driveLabel.textContent = '📂 ' + (j.driveFolderName || 'Drive');
    if (driveBadge) driveBadge.onclick = () => window.open('https://drive.google.com/drive/folders/' + j.driveFolderId, '_blank');
  } else {
    if (driveLabel) driveLabel.textContent = 'Vincular Drive';
    if (driveBadge) driveBadge.onclick = () => abrirVinculacionDrive();
  }

  // Renderizar historial y términos
  hjRenderLista();
  hjRenderTerminos();

  // Resetear chat IA si cambiamos de juicio
  if (_iaJuicioIdx !== idx) {
    _iaHistorial = [];
    _iaJuicioIdx = idx;
    const chatCont = document.getElementById('ia-chat-msgs');
    if (chatCont) {
      chatCont.innerHTML = '';
      // Mensaje de bienvenida contextual
      const bienvenida = document.createElement('div');
      bienvenida.style.cssText = 'background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);border-radius:10px;padding:10px 12px;font-size:0.78rem;color:#e8e0ff;line-height:1.6;';
      const histLen = (j.historial || []).length;
      bienvenida.textContent = `Hola. Tengo acceso al historial completo de ${j.cliente || 'este expediente'}${histLen ? ` (${histLen} entrada${histLen > 1 ? 's' : ''})` : ' (sin entradas aún)'}. Usa los botones de arriba o pregunta lo que necesites.`;
      chatCont.appendChild(bienvenida);
    }
  }
};
// ═══ FIN HISTORIAL CRONOLÓGICO ═══