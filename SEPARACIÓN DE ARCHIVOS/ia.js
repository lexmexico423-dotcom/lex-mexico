/* ═══════════════════════════════════════════════════════════════
   LEX-MÉXICO · ia.js
   Módulo de Inteligencia Artificial
   Incluye:
     · IA Predictiva de Conceptos (autocompletado, descripción)
     · Groq IA — motor principal (llama-3.3-70b-versatile)
     · Gemini — fallback automático
     · _iaLlamar() — función central con fallback
     · Asistente Global LEX — chat, contexto, bienvenida
     · Funciones _lex* — pendientes, finanzas, escritos
   Dependencias: utils.js debe cargarse primero
═══════════════════════════════════════════════════════════════ */

// ═══ IA PREDICTIVA DE CONCEPTOS — LEX-MÉXICO ═══
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

    const txt = await _iaLlamar(prompt, 120, 0.2);
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
  const tr = td.closest('tr');
  const ta = td.querySelector('textarea.concepto');
  const taDesc = tr.querySelector('textarea.descripcion');
  const dropdown = td.querySelector('.ia-dropdown');

  ta.value = concepto;
  dropdown.style.display = 'none';

  // Si el histórico ya tiene descripción para este concepto, usarla directamente
  if (desc && taDesc && !taDesc.value.trim()) {
    taDesc.value = desc;
  } else if (taDesc && !taDesc.value.trim()) {
    // Generar descripción con Groq
    _iaGenerarDescripcion(concepto, taDesc);
  }
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

    const txt = await _iaLlamar(prompt, 60, 0.2);
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
      const tr = ta.closest('tr');
      const taDesc = tr?.querySelector('textarea.descripcion');
      if (taDesc && !taDesc.value.trim()) _iaGenerarDescripcion(mejora, taDesc);
    };
  } catch(e) { /* silencioso */ }
}

// ── Blur en descripción → mejorar si hay texto, generar si está vacío ─
async function iaDescBlur(ta) {
  const texto = ta.value.trim();
  if (!texto) {
    // Campo vacío: buscar concepto en la misma fila y generar descripción
    const tr = ta.closest('tr');
    const concepto = tr?.querySelector('textarea.concepto')?.value?.trim();
    if (concepto) _iaGenerarDescripcion(concepto, ta);
    return;
  }
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

    const txt = await _iaLlamar(prompt, 80, 0.2);
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

// ── Generar descripción automática desde concepto ─────────────────────
async function _iaGenerarDescripcion(concepto, taDesc) {
  if (!concepto || !taDesc) return;

  // Primero buscar en historial (gratis, instantáneo)
  const hist = _iaHistoricoConceptos().find(h => h.concepto.toLowerCase() === concepto.toLowerCase());
  if (hist?.desc && !taDesc.value.trim()) {
    taDesc.value = hist.desc;
    return;
  }

  // Groq disponible?
  const groqKey = typeof _groqGetKey === 'function' ? _groqGetKey() : '';
  if (!groqKey || groqKey.length < 10) return;
  if ((window._geminiCooldownHasta || 0) > Date.now()) return;

  taDesc.placeholder = '✨ Generando...';
  try {
    const prompt = `Concepto de recibo legal: "${concepto}".
Escribe una descripción complementaria. Reglas ESTRICTAS: máximo 8 palabras, no repetir el concepto, lenguaje legal mexicano formal.
Responde SOLO con JSON: {"descripcion":"texto aquí"}`;

    const txt = await _iaLlamar(prompt, 80, 0.2);
    taDesc.placeholder = 'Descripción';
    const parsed = JSON.parse(txt.replace(/```json|```/g,'').trim());
    const desc = (parsed.descripcion || '').trim();
    if (desc && !taDesc.value.trim()) taDesc.value = desc;
  } catch(e) { taDesc.placeholder = 'Descripción'; }
}
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
      <div style="padding:10px 20px;border-top:1px solid rgba(139,92,246,0.1);font-family:monospace;font-size:0.5rem;color:rgba(139,92,246,0.4);text-align:center;">Generado por Gemini 2.5 Flash</div>
    </div>`;
  if (!document.getElementById('ia-pulse-style')) {
    const st = document.createElement('style');
    st.id = 'ia-pulse-style';
    st.textContent = '@keyframes ia-pulse{0%,100%{opacity:1}50%{opacity:0.4}}';
    document.head.appendChild(st);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 🚀 GROQ IA — Proveedor principal de IA (gratis, rápido)
// Modelo: llama-3.3-70b-versatile
// Fallback: Gemini si Groq falla o no tiene key
// ═══════════════════════════════════════════════════════════════════════

window._groqKeyCached = window._groqKeyCached || '';

// ── Cargar key de Groq desde Supabase ─────────────────────────────────
async function _cargarGroqKey(){
  try {
    // PASO 1: localStorage primero (instantáneo, sin necesitar sesión)
    const fromLS = localStorage.getItem('lex-groq-key') || '';
    if(fromLS.length > 10){
      window._groqKeyCached = fromLS;
      console.log('[Groq] ✅ Key cargada desde localStorage:', fromLS.substring(0,8)+'...');
      // Seguir para sincronizar con Supabase si hay sesión
    }
    // PASO 2: Supabase (requiere sesión)
    if(!window.SB) return;
    const { data: sessionData } = await window.SB.auth.getSession();
    if(!sessionData?.session) return;
    const {data, error} = await window.SB.from('configuracion').select('valor').eq('id','groq_api_key').maybeSingle();
    if(!error && data?.valor && data.valor.length > 10){
      window._groqKeyCached = data.valor.trim();
      try{ localStorage.setItem('lex-groq-key', data.valor.trim()); }catch(_){}
      console.log('[Groq] ✅ Key cargada desde Supabase:', data.valor.substring(0,8)+'...');
    } else if(!fromLS || fromLS.length <= 10){
      console.warn('[Groq] ⚠ No se encontró Groq API Key — configúrala en ⚙️ Configuración');
    }
  } catch(e){ console.warn('[Groq] Error cargando key:', e.message); }
}

function _groqGetKey(){
  return window._groqKeyCached
    || localStorage.getItem('lex-groq-key')
    || (document.getElementById('cfg-groq-key')?.value || '').trim()
    || '';
}

function _groqSaveKey(k){
  k = k.trim();
  if(!k) return;
  // 1. localStorage
  try{ localStorage.setItem('lex-groq-key', k); } catch(e){ registrarError('localStorage.setItem', e); }
  // 2. Caché global inmediato
  window._groqKeyCached = k;
  // 3. Supabase
  if(window.SB && k.length > 10){
    window.SB.from('configuracion')
      .upsert({id:'groq_api_key', valor: k, updated_at: new Date().toISOString()})
      .then(()=>{
        console.log('[Groq] ✅ Key guardada en Supabase');
        if(typeof toast === 'function') toast('🚀 Groq configurado y guardado en la nube','ok');
      })
      .catch(e=> console.warn('[Groq] Error guardando key en Supabase:', e));
  }
}

// ── Llamada principal a Groq ───────────────────────────────────────────
async function _groqLlamar(prompt, maxTokens, temperatura){
  const key = _groqGetKey();
  if(!key || key.length < 10) throw new Error('GROQ_SIN_KEY');

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens || 1024,
      temperature: temperatura || 0.3
    })
  });

  if(!resp.ok){
    const err = await resp.json().catch(()=>({}));
    const msg = err?.error?.message || 'Error ' + resp.status;
    if(resp.status === 429) throw new Error('GROQ_RATE_LIMIT: ' + msg);
    if(resp.status === 401) throw new Error('GROQ_KEY_INVALIDA: Verifica tu API Key de Groq en ⚙️ Configuración');
    throw new Error('GROQ_ERROR: ' + msg);
  }

  const data = await resp.json();
  const texto = data?.choices?.[0]?.message?.content || '';
  if(!texto) throw new Error('GROQ_SIN_RESPUESTA');
  return texto;
}

// ── Llamada con fallback automático a Gemini ──────────────────────────
// Usa Groq primero; si falla intenta Gemini
async function _iaLlamar(prompt, maxTokens, temperatura){
  // Groq es el proveedor PRINCIPAL para texto/chat
  const groqKey = _groqGetKey();
  if(groqKey && groqKey.length > 10){
    try {
      const res = await _groqLlamar(prompt, maxTokens, temperatura);
      console.log('[IA] ✅ Respuesta via Groq');
      return res;
    } catch(e){
      if(e.message.startsWith('GROQ_KEY_INVALIDA')){
        throw new Error('🔑 Key de Groq inválida. Verifica en ⚙️ Configuración > Groq.');
      }
      if(e.message.includes('GROQ_RATE_LIMIT')){
        throw new Error('⏳ Límite de Groq alcanzado. Espera un momento e intenta de nuevo.');
      }
      // Otro error de Groq — solo advertencia, intentar Gemini como respaldo
      console.warn('[IA] Groq falló (' + e.message + '), intentando Gemini como respaldo...');
    }
  }

  // Gemini como RESPALDO (solo si Groq no está configurado o tuvo error no crítico)
  const gKey = window._geminiKeyCached || localStorage.getItem('lex-gemini-key') || '';
  if(!gKey || gKey.length < 10){
    // Sin ninguna key disponible
    if(!groqKey || groqKey.length < 10){
      throw new Error('🔑 Configura Groq (gratis en console.groq.com) en ⚙️ Configuración para usar la IA.');
    }
    throw new Error('⚠ Error de Groq y sin key de Gemini como respaldo. Verifica tu key de Groq en ⚙️ Configuración.');
  }

  const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+encodeURIComponent(gKey), {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      contents:[{parts:[{text: prompt}]}],
      generationConfig:{temperature: temperatura||0.3, maxOutputTokens: maxTokens||1024}
    })
  });

  if(!resp.ok){
    const err = await resp.json().catch(()=>({}));
    const msg = err?.error?.message || '';
    if(resp.status === 402) throw new Error('💳 Créditos de Gemini agotados. Configura Groq (gratis) en ⚙️ Configuración.');
    throw new Error(msg || 'Error Gemini ' + resp.status);
  }
  const data = await resp.json();
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if(!texto) throw new Error('Gemini no devolvió contenido');
  console.log('[IA] ✅ Respuesta via Gemini (respaldo)');
  return texto;
}

// Cargar key de Groq al inicio desde localStorage (Supabase se carga en onAuthStateChange)
setTimeout(async function(){
  await _cargarGroqKey();
  const gk = _groqGetKey();
  if(gk && gk.length > 10) console.log('[IA] ✅ Groq listo (localStorage):', gk.substring(0,8)+'...');
  // El warning se omite aquí — puede no haber sesión aún. Se emite en onAuthStateChange si sigue faltando.
}, 800);

// ═══ FIN GROQ IA ═══

// ═══════════════════════════════════════════════════════════════════════
// 🤖 ASISTENTE GLOBAL LEX-MÉXICO
// Botón flotante visible en toda la app. Conoce tu caja, juicios,
// pendientes, directorio, recibos y la pantalla activa.
// ═══════════════════════════════════════════════════════════════════════

let _agHistorial  = [];     // historial de chat global
let _agAbierto    = false;  // estado del panel
let _agPanelActual = 'caja'; // panel visible actualmente

// ── Inyectar HTML del asistente en el DOM ───────────────────────────
(function _agInyectar() {
  const html = `
  <style>
    #ag-fab{
      position:fixed;bottom:24px;right:24px;z-index:8000;
      width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;
      background:linear-gradient(135deg,#7c3aed,#4f46e5);
      box-shadow:0 4px 20px rgba(124,58,237,0.5);
      display:flex;align-items:center;justify-content:center;
      font-size:1.4rem;transition:transform 0.2s,box-shadow 0.2s;
    }
    #ag-fab:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(124,58,237,0.7);}
    #ag-fab.abierto{background:linear-gradient(135deg,#4f46e5,#7c3aed);}
    #ag-panel{
      position:fixed;bottom:88px;right:24px;z-index:8000;
      width:420px;max-width:calc(100vw - 48px);
      height:580px;max-height:calc(100vh - 110px);
      background:#120f1e;border:1px solid rgba(139,92,246,0.4);
      border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.7);
      display:none;flex-direction:column;overflow:hidden;
    }
    #ag-panel.show{display:flex;animation:ag-slide-up 0.22s ease;}
    @keyframes ag-slide-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    #ag-header{
      padding:14px 16px 12px;
      background:linear-gradient(135deg,rgba(124,58,237,0.25),rgba(79,70,229,0.15));
      border-bottom:1px solid rgba(139,92,246,0.2);
      display:flex;align-items:center;gap:10px;flex-shrink:0;
    }
    #ag-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#4f46e5);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;}
    #ag-titulo{font-family:serif;font-size:0.95rem;color:#e8e0ff;flex:1;}
    #ag-subtitulo{font-family:monospace;font-size:0.52rem;color:rgba(139,92,246,0.6);margin-top:1px;}
    #ag-btn-limpiar{background:none;border:1px solid rgba(139,92,246,0.2);border-radius:6px;padding:3px 8px;cursor:pointer;font-family:monospace;font-size:0.52rem;color:rgba(139,92,246,0.5);}
    #ag-btn-limpiar:hover{border-color:rgba(139,92,246,0.5);color:#c4b5fd;}
    #ag-acciones{
      padding:10px 12px;border-bottom:1px solid rgba(139,92,246,0.12);
      display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0;
    }
    .ag-chip{
      border-radius:20px;padding:5px 11px;cursor:pointer;
      font-family:monospace;font-size:0.6rem;font-weight:700;
      transition:all 0.15s;white-space:nowrap;border:1.5px solid;
    }
    .ag-chip:hover{filter:brightness(1.2);transform:translateY(-1px);}
    .ag-chip-morado{background:rgba(124,58,237,0.2);border-color:rgba(124,58,237,0.5);color:#c4b5fd;}
    .ag-chip-rojo  {background:rgba(192,22,26,0.18);border-color:rgba(192,22,26,0.5);color:#ff9999;}
    .ag-chip-verde {background:rgba(26,122,58,0.18);border-color:rgba(26,122,58,0.5);color:#6ee7a0;}
    .ag-chip-azul  {background:rgba(26,74,138,0.2);border-color:rgba(26,74,138,0.5);color:#93c5fd;}
    .ag-chip-amber {background:rgba(180,115,20,0.2);border-color:rgba(180,115,20,0.5);color:#fbbf24;}
    .ag-chip-gold  {background:rgba(200,149,42,0.18);border-color:rgba(200,149,42,0.5);color:#e8c875;}
    #ag-msgs{
      flex:1;overflow-y:auto;padding:12px;
      display:flex;flex-direction:column;gap:8px;
    }
    .ag-msg-user{align-self:flex-end;background:#7c3aed;color:#fff;border-radius:12px 12px 3px 12px;padding:9px 13px;max-width:85%;font-size:0.82rem;line-height:1.6;white-space:pre-wrap;word-break:break-word;}
    .ag-msg-ia{align-self:flex-start;background:rgba(255,255,255,0.07);border:1px solid rgba(139,92,246,0.25);color:#f0ecff;border-radius:12px 12px 12px 3px;padding:9px 13px;max-width:90%;font-size:0.82rem;line-height:1.6;white-space:pre-wrap;word-break:break-word;}
    .ag-msg-ia.pensando{color:rgba(196,181,253,0.5);font-style:italic;animation:ag-pulse 1s ease-in-out infinite;}
    @keyframes ag-pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    .ag-copy-btn{background:none;border:1px solid rgba(139,92,246,0.2);border-radius:4px;padding:2px 7px;font-family:monospace;font-size:0.5rem;color:rgba(196,181,253,0.5);cursor:pointer;margin-top:4px;align-self:flex-start;}
    .ag-copy-btn:hover{border-color:rgba(139,92,246,0.5);color:#c4b5fd;}
    #ag-footer{
      padding:10px 12px;border-top:1px solid rgba(139,92,246,0.12);
      display:flex;gap:8px;align-items:flex-end;flex-shrink:0;
      background:rgba(0,0,0,0.2);
    }
    #ag-inp{
      flex:1;background:rgba(255,255,255,0.05);border:1.5px solid rgba(139,92,246,0.3);
      border-radius:8px;padding:8px 12px;color:#f0ecff;font-family:sans-serif;
      font-size:0.82rem;outline:none;resize:none;max-height:100px;
      transition:border-color 0.15s;
    }
    #ag-inp:focus{border-color:rgba(139,92,246,0.7);}
    #ag-inp::placeholder{color:rgba(196,181,253,0.35);}
    #ag-send{
      background:#7c3aed;color:#fff;border:none;border-radius:8px;
      padding:8px 14px;cursor:pointer;font-family:monospace;
      font-size:0.65rem;font-weight:700;flex-shrink:0;transition:all 0.15s;
    }
    #ag-send:hover{background:#6d28d9;}
    #ag-send:disabled{opacity:0.4;cursor:not-allowed;}
    #ag-panel-indicator{
      font-family:monospace;font-size:0.48rem;
      color:rgba(139,92,246,0.4);padding:0 12px 6px;flex-shrink:0;text-align:right;
    }
  
/* ═══ PANEL DE DIAGNÓSTICO ═══ */
#lex-diag-fab{
  position:fixed;bottom:80px;left:16px;z-index:99999;
  width:38px;height:38px;border-radius:50%;
  background:linear-gradient(135deg,#c0161a,#8c1010);
  border:2px solid rgba(255,100,100,0.4);
  color:#fff;font-size:1rem;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 16px rgba(192,22,26,0.5);
  transition:all 0.2s;
}
#lex-diag-fab:hover{transform:scale(1.1);}
#lex-diag-fab .lex-diag-badge{
  position:absolute;top:-4px;right:-4px;
  background:#ff4444;color:#fff;
  border-radius:10px;padding:1px 5px;
  font-size:0.5rem;font-family:monospace;font-weight:700;
  min-width:16px;text-align:center;
  display:none;
}
#lex-diag-panel{
  position:fixed;bottom:0;left:0;right:0;
  height:55vh;z-index:99998;
  background:#0a0705;
  border-top:2px solid rgba(192,22,26,0.5);
  display:none;flex-direction:column;
  font-family:monospace;
}
#lex-diag-panel.show{display:flex;}
#lex-diag-header{
  display:flex;align-items:center;gap:10px;
  padding:8px 14px;
  background:#120806;
  border-bottom:1px solid rgba(192,22,26,0.2);
  flex-shrink:0;
}
#lex-diag-header span{font-size:0.7rem;color:#ff8080;font-weight:700;letter-spacing:0.1em;}
#lex-diag-header .lex-diag-status{
  margin-left:auto;font-size:0.6rem;color:rgba(255,128,128,0.5);
}
.lex-diag-btn{
  padding:4px 12px;border-radius:6px;border:1px solid rgba(255,100,100,0.3);
  background:rgba(192,22,26,0.15);color:#ff8080;
  font-family:monospace;font-size:0.58rem;cursor:pointer;
  transition:all 0.15s;
}
.lex-diag-btn:hover{background:rgba(192,22,26,0.3);border-color:rgba(255,100,100,0.6);}
#lex-diag-filter{
  display:flex;gap:6px;padding:6px 14px;
  background:#0e0603;border-bottom:1px solid rgba(192,22,26,0.1);
  flex-shrink:0;overflow-x:auto;
}
.lex-diag-chip{
  padding:3px 10px;border-radius:12px;border:1px solid rgba(255,100,100,0.2);
  background:rgba(192,22,26,0.08);color:rgba(255,128,128,0.6);
  font-size:0.55rem;cursor:pointer;white-space:nowrap;transition:all 0.15s;
}
.lex-diag-chip.on{background:rgba(192,22,26,0.3);border-color:rgba(255,100,100,0.5);color:#ff9090;}
#lex-diag-logs{
  flex:1;overflow-y:auto;padding:8px 0;
}
.lex-diag-entry{
  display:flex;gap:8px;padding:4px 14px;
  border-bottom:1px solid rgba(255,255,255,0.03);
  font-size:0.62rem;line-height:1.5;
  transition:background 0.1s;
}
.lex-diag-entry:hover{background:rgba(255,255,255,0.03);}
.lex-diag-ts{color:rgba(255,128,80,0.45);flex-shrink:0;width:70px;}
.lex-diag-tag{flex-shrink:0;width:72px;font-weight:700;font-size:0.55rem;letter-spacing:0.05em;}
.lex-diag-msg{color:rgba(220,220,220,0.85);word-break:break-all;flex:1;}
.lex-diag-entry.err .lex-diag-tag{color:#ff5555;}
.lex-diag-entry.err .lex-diag-msg{color:#ffaaaa;}
.lex-diag-entry.warn .lex-diag-tag{color:#ffaa44;}
.lex-diag-entry.warn .lex-diag-msg{color:#ffe0aa;}
.lex-diag-entry.ok .lex-diag-tag{color:#44dd88;}
.lex-diag-entry.ok .lex-diag-msg{color:#aaffcc;}
.lex-diag-entry.info .lex-diag-tag{color:#4488ff;}
.lex-diag-entry.info .lex-diag-msg{color:#aaccff;}
.lex-diag-entry.net .lex-diag-tag{color:#aa44ff;}
.lex-diag-entry.net .lex-diag-msg{color:#ddaaff;}
</style>

  <!-- Botón flotante -->
  <button id="ag-fab" onclick="agToggle()" title="Asistente IA">🤖</button>

  <!-- Panel del asistente -->
  <div id="ag-panel">
    <div id="ag-header">
      <div id="ag-avatar">🤖</div>
      <div style="flex:1;min-width:0;">
        <div id="ag-titulo">Asistente LEX-MÉXICO</div>
        <div id="ag-subtitulo">Contexto completo del despacho · Gemini</div>
      </div>
      <button id="ag-btn-limpiar" onclick="agLimpiar()">↺ Nueva conversación</button>
    </div>

    <!-- Acciones rápidas con colores distintos por función -->
    <div id="ag-acciones">
      <span class="ag-chip ag-chip-morado" onclick="agAccion('resumen_dia')">📊 Resumen del día</span>
      <span class="ag-chip ag-chip-rojo"   onclick="agAccion('urgentes')">🔴 Urgentes</span>
      <span class="ag-chip ag-chip-verde"  onclick="agAccion('caja')">💰 Estado de caja</span>
      <span class="ag-chip ag-chip-azul"   onclick="agAccion('proximas_audiencias')">📅 Audiencias</span>
      <span class="ag-chip ag-chip-amber"  onclick="agAccion('pendientes_sem')">📌 Pendientes</span>
      <span class="ag-chip ag-chip-gold"   onclick="agAccion('consejo')">💡 Qué hacer hoy</span>
    </div>

    <!-- Mensajes -->
    <div id="ag-msgs"></div>

    <!-- Indicador de panel -->
    <div id="ag-panel-indicator">Panel activo: <span id="ag-panel-nombre">Principal</span></div>

    <!-- Input -->
    <div id="ag-footer">
      <textarea id="ag-inp" rows="1" placeholder="Pregunta lo que quieras sobre el despacho..."
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();agEnviar();}"></textarea>
      <button id="ag-send" onclick="agEnviar()">Enviar</button>
    </div>
  </div>`;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
})();

// ── Toggle abrir/cerrar ───────────────────────────────────────────────
function agToggle() {
  _agAbierto = !_agAbierto;
  const panel = document.getElementById('ag-panel');
  const fab   = document.getElementById('ag-fab');
  panel.classList.toggle('show', _agAbierto);
  fab.classList.toggle('abierto', _agAbierto);
  fab.textContent = _agAbierto ? '✕' : '🤖';
  if (_agAbierto) {
    if (!_agHistorial.length) _agMensajeBienvenida();
    setTimeout(() => document.getElementById('ag-inp')?.focus(), 150);
  }
}

// ── Construir contexto completo del sistema ───────────────────────────
function _agConstruirContexto() {
  const hoy = new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const ahora = new Date().toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });

  // Caja: movimientos de hoy
  const hoyStr = new Date().toISOString().split('T')[0];
  const movsHoy = (D.movimientos || []).filter(m => (m.fecha || '').startsWith(hoyStr));
  const entradas = movsHoy.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const salidas  = movsHoy.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const saldo    = D.saldoAcumulado || 0;

  // Juicios urgentes y con audiencia próxima
  const juiciosUrgentes = (D.juicios || []).filter(j => j.estatus === 'urgente')
    .map(j => `- ${j.cliente} (Exp. ${j.expediente || '—'}) · ${j.juzgado}`).join('\n') || 'Ninguno';

  const hoy30 = new Date(); hoy30.setDate(hoy30.getDate() + 30);
  const audienciasProximas = (D.juicios || [])
    .filter(j => j.audiencia && new Date(j.audiencia + 'T12:00:00') <= hoy30)
    .sort((a, b) => a.audiencia.localeCompare(b.audiencia))
    .slice(0, 8)
    .map(j => `- ${j.audiencia}: ${j.cliente} (${j.tipo})`)
    .join('\n') || 'Sin audiencias en los próximos 30 días';

  // Pendientes activos
  const pendientesActivos = (D.pendientes || []).filter(p => !p.resuelto);
  const pendientesUrgentes = pendientesActivos.filter(p => p.prioridad === 'urgente')
    .map(p => `- ${p.texto} (${p.resp || 'sin asignar'})`).join('\n') || 'Ninguno';
  const pendientesTotal = pendientesActivos.length;

  // Recibos con saldo pendiente
  const conSaldo = (appData.recibos || []).filter(r => !r.cancelado && r.saldoPendiente > 0);
  const totalPorCobrar = conSaldo.reduce((s, r) => s + (r.saldoPendiente || 0), 0);

  // Juicios resumen
  const juiciosTotales = (D.juicios || []).length;
  const juiciosPorEstatus = {};
  (D.juicios || []).forEach(j => { juiciosPorEstatus[j.estatus || 'otro'] = (juiciosPorEstatus[j.estatus || 'otro'] || 0) + 1; });

  // Panel activo
  const panelNombres = { caja:'Principal/Caja', contabilidad:'Contabilidad', recibos:'Historial de Recibos', juicios:'Control de Juicios', pendientes:'Pendientes', carpetas:'Control de Carpetas', directorio:'Directorio', 'nuevo-recibo':'Nuevo Recibo', 'finanzas-internas':'Finanzas Internas' };
  const panelActivo = panelNombres[_agPanelActual] || _agPanelActual;

  return `Eres el asistente inteligente de LEX-MÉXICO, un sistema de gestión para un despacho de abogados en Juxtlahuaca, Oaxaca, México.
Tienes acceso en tiempo real a toda la información del despacho. Responde de forma directa, práctica y en español.
Cuando el usuario pregunte sobre datos, usa los números exactos que tienes aquí. Sé conciso pero completo.
El abogado titular es LIC. NAHUM PELÁEZ. La empleada es LIC. ANTONIETA CHÁVEZ MONTAÑO (operadora).

FECHA Y HORA ACTUAL: ${hoy}, ${ahora} hrs
PANTALLA ACTIVA: ${panelActivo}

═══ CAJA ═══
Saldo acumulado: $${saldo.toLocaleString('es-MX', {minimumFractionDigits:2})}
Movimientos hoy: ${movsHoy.length} (Entradas: $${entradas.toLocaleString('es-MX', {minimumFractionDigits:2})} · Salidas: $${salidas.toLocaleString('es-MX', {minimumFractionDigits:2})})
Recibos con saldo pendiente: ${conSaldo.length} clientes · Total por cobrar: $${totalPorCobrar.toLocaleString('es-MX', {minimumFractionDigits:2})}

═══ JUICIOS (${juiciosTotales} total) ═══
Por estatus: ${Object.entries(juiciosPorEstatus).map(([k,v])=>`${k}: ${v}`).join(' · ')}

URGENTES:
${juiciosUrgentes}

AUDIENCIAS PRÓXIMAS (30 días):
${audienciasProximas}

═══ PENDIENTES ═══
Total activos: ${pendientesTotal}
URGENTES:
${pendientesUrgentes}

═══ DIRECTORIO ═══
Contactos registrados: ${(D.directorio || []).length}

═══ EXPEDIENTES (Control de Carpetas) ═══
Carpetas activas: ${(D.carpetas || []).filter(c => c.estatus !== 'archivado').length} de ${(D.carpetas || []).length} total`;
}

// ── Mensaje de bienvenida ─────────────────────────────────────────────
function _agMensajeBienvenida() {
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const urgentes = (D.juicios || []).filter(j => j.estatus === 'urgente').length;
  const pendUrgentes = (D.pendientes || []).filter(p => !p.resuelto && p.prioridad === 'urgente').length;

  let msg = `${saludo}. Soy tu asistente del despacho. Tengo acceso completo al sistema en tiempo real.\n\n`;
  if (urgentes > 0) msg += `⚠️ Tienes ${urgentes} juicio${urgentes > 1 ? 's' : ''} urgente${urgentes > 1 ? 's' : ''}.\n`;
  if (pendUrgentes > 0) msg += `📌 ${pendUrgentes} pendiente${pendUrgentes > 1 ? 's' : ''} urgente${pendUrgentes > 1 ? 's' : ''}.\n`;
  msg += `\n¿En qué te puedo ayudar?`;

  _agAgregarMensaje('ia', msg);
}

// ── Agregar mensaje al chat ───────────────────────────────────────────
function _agAgregarMensaje(rol, texto, id) {
  const cont = document.getElementById('ag-msgs');
  if (!cont) return null;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;';
  if (id) wrap.id = id;

  const burbuja = document.createElement('div');
  burbuja.className = rol === 'user' ? 'ag-msg-user' : 'ag-msg-ia';
  if (texto === '...') burbuja.classList.add('pensando');
  burbuja.textContent = texto;
  wrap.appendChild(burbuja);

  if (rol === 'ia' && texto !== '...') {
    const btnCopy = document.createElement('button');
    btnCopy.className = 'ag-copy-btn';
    btnCopy.textContent = '📋 Copiar';
    btnCopy.onclick = () => { navigator.clipboard.writeText(texto).catch((e)=>{ registrarError('Promise catch vacio', e); }); btnCopy.textContent = '✓'; setTimeout(() => btnCopy.textContent = '📋 Copiar', 2000); };
    wrap.appendChild(btnCopy);
  }

  cont.appendChild(wrap);
  cont.scrollTop = cont.scrollHeight;
  return wrap;
}

// ── Enviar mensaje ────────────────────────────────────────────────────
async function agEnviar() {
  const inp  = document.getElementById('ag-inp');
  const btn  = document.getElementById('ag-send');
  const texto = (inp.value || '').trim();
  if (!texto) return;

  // Verificar que haya al menos una key (Groq o Gemini)
  const _agGroqKey = typeof _groqGetKey === 'function' ? _groqGetKey() : '';
  const _agGeminiKey = window._geminiKeyCached || localStorage.getItem('lex-gemini-key') || '';
  if ((!_agGroqKey || _agGroqKey.length < 10) && (!_agGeminiKey || _agGeminiKey.length < 10)) {
    _agAgregarMensaje('ia', '⚠ Configura Groq (gratis) o Gemini en ⚙️ Configuración para usar el asistente.');
    return;
  }

  inp.value = '';
  inp.disabled = true;
  btn.disabled = true;

  _agAgregarMensaje('user', texto);
  _agHistorial.push({ role: 'user', content: texto });

  const idPensando = 'ag-pensando-' + Date.now();
  _agAgregarMensaje('ia', '...', idPensando);

  // FIX: construir prompt con contexto + historial + mensaje del usuario
  // Antes: `prompt` no estaba definido en este scope → enviaba undefined → 400 Bad Request
  const _agCtx = (typeof _iaConstruirContexto === 'function') ? _iaConstruirContexto() : _agConstruirContexto();
  const _agHistPrev = _agHistorial.slice(-11, -1)
    .map(m => (m.role === 'user' ? 'Usuario: ' : 'Asistente: ') + m.content)
    .join('\n');
  const prompt = _agCtx + (_agHistPrev ? '\n\nCONVERSACIÓN PREVIA:\n' + _agHistPrev : '') + '\n\nUSUARIO: ' + texto;

  try {
    // Usar _iaLlamar: intenta Groq primero, fallback a Gemini automáticamente
    const respuesta = await _iaLlamar(prompt, 900, 0.3);

    document.getElementById(idPensando)?.remove();
    _agAgregarMensaje('ia', respuesta.trim());
    _agHistorial.push({ role: 'assistant', content: respuesta.trim() });
    if (_agHistorial.length > 30) _agHistorial = _agHistorial.slice(-30);

  } catch(e) {
    document.getElementById(idPensando)?.remove();
    // Mensajes de error en español claro
    let msgUsuario = e.message;
    if(e.message.includes('prepayment') || e.message.includes('credits')) msgUsuario = '💳 Créditos de Gemini agotados. Recarga en aistudio.google.com o configura una key de Groq en ⚙️ Configuración.';
    else if(e.message.includes('SIN_KEY')) msgUsuario = '🔑 No hay API Key configurada. Ve a ⚙️ Configuración y agrega tu key de Groq (gratis) o Gemini.';
    else if(e.message.includes('GROQ_RATE_LIMIT')) msgUsuario = '⏳ Límite de Groq alcanzado. Espera un momento e intenta de nuevo.';
    _agAgregarMensaje('ia', '⚠ ' + msgUsuario);
  } finally {
    inp.disabled = false;
    btn.disabled = false;
    inp.focus();
  }
}

// ── Acciones rápidas del asistente global ────────────────────────────
const _agPrompts = {
  resumen_dia:       'Dame un resumen ejecutivo del día de hoy: movimientos de caja, situación de los juicios urgentes y pendientes más importantes.',
  urgentes:          'Muéstrame todo lo que es urgente ahora mismo: juicios urgentes, pendientes urgentes y cualquier plazo o audiencia que esté cerca.',
  caja:              'Analiza el estado financiero actual del despacho: saldo, movimientos de hoy, recibos pendientes de cobro y cualquier situación que requiera atención.',
  proximas_audiencias: 'Lista todas las audiencias próximas con fecha, cliente y tipo de juicio. Dime cuál es la más urgente y qué debería prepararse.',
  pendientes_sem:    'Muéstrame los pendientes activos más importantes. ¿Cuáles son prioritarios y cuáles llevan más tiempo sin resolver?',
  consejo:           '¿Qué debería hacer hoy en el despacho? Dame una lista priorizada de las acciones más importantes considerando juicios urgentes, audiencias próximas, pendientes y cobros.'
};

function agAccion(tipo) {
  const prompt = _agPrompts[tipo];
  if (!prompt) return;
  const inp = document.getElementById('ag-inp');
  if (inp) { inp.value = prompt; }
  agEnviar();
}

// ── Limpiar conversación ──────────────────────────────────────────────
function agLimpiar() {
  _agHistorial = [];
  const cont = document.getElementById('ag-msgs');
  if (cont) cont.innerHTML = '';
  _agMensajeBienvenida();
}

// ── Actualizar indicador de panel activo ─────────────────────────────
const _irOriginalAg = ir;
ir = function(p) {
  _irOriginalAg(p);
  _agPanelActual = p;
  const nombres = { caja:'Principal', contabilidad:'Contabilidad', recibos:'Recibos', juicios:'Juicios', pendientes:'Pendientes', carpetas:'Archivo', directorio:'Directorio', 'nuevo-recibo':'Nuevo Recibo', 'finanzas-internas':'Finanzas Internas' };
  const el = document.getElementById('ag-panel-nombre');
  if (el) el.textContent = nombres[p] || p;
};
// ═══ FIN ASISTENTE GLOBAL ═══