/* LEX-MÉXICO · Módulo integraciones
 * Funciones extraídas sin modificar su contenido.
 */

async function initSupabase(){
  if(window.SB) return window.SB;
  // El SDK se carga como script global desde el <head> (window.supabase)
  // Esto evita el "Failed to fetch dynamically imported module" en navegadores
  // con bloqueadores activos (Brave Shields, uBlock, etc.)
  if(typeof window.supabase === 'undefined' || !window.supabase.createClient){
    // Intento de carga de respaldo si el script principal falló
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar el SDK de Supabase desde unpkg ni jsdelivr. Desactiva bloqueadores y recarga.'));
      document.head.appendChild(s);
    });
  }
  window.SB = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: window.localStorage,
      storageKey: 'lex-supabase-auth'
    }
  });
  // Escuchar cambios de sesión
  window.SB.auth.onAuthStateChange((event, session) => {
    console.log('[SB] Auth event:', event);
    if(event === 'SIGNED_IN' || event === 'INITIAL_SESSION'){
      // FIX: cargar la key de Gemini en cuanto la sesión esté autenticada
      // Antes solo se cargaba con setTimeout(1s) → la sesión podía no estar lista → warning falso
      if(session){
        // FIX 2: restaurar sbSession y sbExpiry al recargar la página (INITIAL_SESSION)
        if(!sbSession || Date.now() >= sbExpiry){
          sbSession = 'supabase-active-' + session.user.id;
          sbExpiry  = session.expires_at ? session.expires_at * 1000 : Date.now() + 1000*60*60*12;
          window._miUserId = session.user.id;
          try {
            var _em = localStorage.getItem('empleado_email');
            var _en = localStorage.getItem('empleado_nombre');
            if(_em && typeof empleadoActual !== 'undefined'){
              empleadoActual = { email: _em, nombre: _en || _em.split('@')[0] };
            }
          } catch(e){}
          if(event === 'INITIAL_SESSION'){
            obtenerDespachoActivo().then(function(did){
              if(did){
                if(typeof actualizarAmbossBadges === 'function') actualizarAmbossBadges(true);
                if(typeof setStatus === 'function') setStatus('ok','Sistema conectado','ok');
                if(typeof sincronizarFolio === 'function') sincronizarFolio();
                if(typeof lexRealtimeConectar === 'function') setTimeout(lexRealtimeConectar, 1000);
              }
            });
          }
        }
        // Cargar key de Groq desde Supabase al hacer login
        setTimeout(_cargarGroqKey, 400);
        // Cargar key de Mistral OCR al hacer login
        setTimeout(_cargarMistralKey, 500);
        // Cargar credenciales de Cloudflare Workers AI (respaldo de Groq / lector de documentos)
        setTimeout(_cargarCfaiCreds, 550);
        // Re-disparar si los IIFE ya agotaron reintentos antes del login
        // ⚠️ FIX: ya no se advierte si no hay key personal de Groq — desde que
        // Groq pasa por el Worker (secreto GROQ_API_KEY del lado del servidor,
        // ver /ai/groq), no tener una key personal en esta pestaña es el
        // estado NORMAL para todos, no un error. La key personal en
        // ⚙️ Configuración queda solo como respaldo manual opcional.
        setTimeout(function(){
          if(!window._groqKeyCached || window._groqKeyCached.length <= 10){
            _cargarGroqKey();
          }
        }, 1000);
      }
    }
    if(event === 'SIGNED_OUT'){
      sbSession = null; sbExpiry = 0;
      window.SB_DESPACHO_ID = null;
      window._geminiKeyCached = ''; // limpiar cache Gemini al cerrar sesión
      window._groqKeyCached = '';    // limpiar cache Groq al cerrar sesión
      window._mistralKeyCached = ''; // limpiar cache Mistral al cerrar sesión
      window._cfaiAccountCached = ''; window._cfaiTokenCached = ''; // limpiar cache Cloudflare al cerrar sesión
      try { localStorage.removeItem('drive_token'); localStorage.removeItem('drive_expiry'); } catch(e){ registrarError('catch vacio', e); }
      mostrarLoginSupabase();
    }
  });
  return window.SB;
}

async function obtenerDespachoActivo(){
  const sb = await initSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if(!user) return null;
  // Buscar despachos en los que sea miembro
  const { data: mems, error } = await sb.from('miembros').select('despacho_id, rol, nombre').eq('user_id', user.id).limit(1);
  if(error){ console.error('[SB] obtenerDespachoActivo:', error); return null; }
  if(mems && mems.length > 0){
    window.SB_DESPACHO_ID = mems[0].despacho_id;
    window.SB_ROL_ACTUAL  = mems[0].rol || 'empleado';
    console.log('[SB] Despacho activo:', window.SB_DESPACHO_ID, '— Rol:', window.SB_ROL_ACTUAL);
    // Cargar config de captura retroactiva ahora que SB_DESPACHO_ID está listo
    setTimeout(function(){
      if(typeof capturaMesCargarSupabase==='function') capturaMesCargarSupabase();
      if(typeof retroGlobalCargarSupabase==='function') retroGlobalCargarSupabase();
    }, 500);
    return window.SB_DESPACHO_ID;
  }
  // ── PROTECCIÓN: Si el usuario no es admin, NO crear despacho nuevo ──────
  // Un empleado sin membresía significa que el admin aún no lo registró.
  // Crear un despacho vacío a su nombre sería un error silencioso grave.
  const esAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  if(!esAdmin){
    console.error('[SB] Usuario sin membresía asignada:', user.email);
    // Cerrar sesión y mostrar mensaje claro
    await sb.auth.signOut();
    sbSession = null; sbExpiry = 0;
    empleadoActual = null;
    mostrarLoginSupabase();
    // Mostrar error descriptivo en el modal de login
    setTimeout(() => {
      const eErr = document.getElementById('sb-err');
      if(eErr){
        eErr.textContent = '⚠ Tu cuenta no tiene acceso al despacho. Pide al administrador que te registre en el sistema.';
        eErr.style.display = 'block';
      }
    }, 400);
    return null;
  }
  // Solo para el admin: crear despacho inicial si no existe (cuenta nueva)
  console.log('[SB] Admin sin despacho — creando despacho inicial...');
  const { data: d } = await sb.from('despachos').insert({ nombre: 'Despacho de '+user.email, owner_id: user.id }).select().single();
  if(!d) return null;
  await sb.from('miembros').insert({ despacho_id: d.id, user_id: user.id, rol: 'admin', nombre: user.email.split('@')[0] });
  await sb.from('app_state').insert({
    despacho_id: d.id,
    data: {movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],cierres:[],prestamos:[],cuentasPorCobrar:[],saldoAcumulado:0,leyes:[]},
    recibos: {folioActual:1, recibos:[]}
  });
  window.SB_DESPACHO_ID = d.id;
  window.SB_ROL_ACTUAL  = 'admin';
  return d.id;
}

function tokenOk(){
  return !!(window.SB && window.SB_DESPACHO_ID);
}

function mostrarLoginSupabase(){
  // Ocultar splash antes de mostrar login
  _lexSplashOcultar();
  // Cierra otros modales
  document.querySelectorAll('.modal-overlay.show, .modal.show').forEach(m => m.classList.remove('show'));
  let modal = document.getElementById('sb-login-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'sb-login-modal';
    modal.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:Outfit,sans-serif;background-color:#0b0a08;background-repeat:no-repeat,repeat;background-size:cover,130px 130px;';
    modal.style.backgroundImage = 'radial-gradient(ellipse at center, rgba(255,255,255,0.03), rgba(0,0,0,0) 62%), ' + (typeof _lexFondoTexturaSVG === 'function' ? _lexFondoTexturaSVG(0.48) : 'none');
    modal.innerHTML = `
      <div style="background:#fdfaf4;border-radius:22px;padding:28px 32px 28px;width:420px;max-width:93vw;box-shadow:0 40px 100px rgba(0,0,0,0.55);">
        <!-- LOGO -->
        <div style="margin-bottom:16px;">
          <img src="data:image/png;base64,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" alt="LEX MÉXICO Despacho Jurídico" style="width:100%;max-width:360px;display:block;">
        </div>
        <!-- TÍTULO -->
        <h2 id="sb-title" style="font-family:sans-serif;font-size:1.45rem;font-weight:700;color:#1a1008;margin:0 0 14px;">Iniciar sesión</h2>
        <p id="sb-sub" style="display:none;"></p>
        <!-- CAMPO CORREO -->
        <label style="display:block;font-family:sans-serif;font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8c6518;margin-bottom:5px;">Correo</label>
        <input id="sb-email" type="email" autocomplete="email" placeholder="ejemplo@correo.com"
          style="width:100%;padding:11px 16px;border:2px solid #d4b870;border-radius:12px;font-family:sans-serif;font-size:0.92rem;color:#1a1008;background:#fff;box-sizing:border-box;margin-bottom:12px;outline:none;transition:border-color 0.2s;"
          onfocus="this.style.borderColor='#c8952a'" onblur="this.style.borderColor='#d4b870'">
        <!-- CAMPO CONTRASEÑA -->
        <label style="display:block;font-family:sans-serif;font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8c6518;margin-bottom:5px;">Contraseña</label>
        <div style="position:relative;margin-bottom:8px;">
          <input id="sb-pwd" type="password" autocomplete="current-password" placeholder="••••••••••••"
            style="width:100%;padding:11px 48px 11px 16px;border:2px solid #d4b870;border-radius:12px;font-family:sans-serif;font-size:0.92rem;color:#1a1008;background:#fff;box-sizing:border-box;outline:none;transition:border-color 0.2s;"
            onfocus="this.style.borderColor='#c8952a'" onblur="this.style.borderColor='#d4b870'">
          <!-- Ojo SVG -->
          <button type="button" id="sb-ojo"
            onclick="(function(){const i=document.getElementById('sb-pwd'),c=document.getElementById('sb-pwd-check');i.type=i.type==='password'?'text':'password';c.checked=i.type==='text';})()"
            style="position:absolute;right:14px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:0;color:#7a6840;display:flex;align-items:center;">
            <svg id="sb-ojo-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </button>
        </div>
        <!-- CHECKBOX MOSTRAR CONTRASEÑA -->
        <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-family:monospace;font-size:0.72rem;color:#7a6840;user-select:none;margin-bottom:16px;">
          <input type="checkbox" id="sb-pwd-check"
            onchange="document.getElementById('sb-pwd').type=this.checked?'text':'password';"
            style="width:16px;height:16px;accent-color:#c8952a;cursor:pointer;border-radius:3px;">
          Mostrar contraseña
        </label>
        <!-- MENSAJE ERROR / OK -->
        <div id="sb-err" style="display:none;background:#fff0f0;color:#c0161a;border:1px solid rgba(192,22,26,0.2);border-radius:8px;padding:9px 13px;font-size:0.8rem;margin-bottom:10px;"></div>
        <div id="sb-ok"  style="display:none;background:#e8f5ec;color:#0f5228;border:1px solid rgba(26,122,58,0.3);border-radius:8px;padding:9px 13px;font-size:0.8rem;margin-bottom:10px;"></div>
        <!-- BOTÓN ENTRAR -->
        <button id="sb-go"
          style="width:100%;padding:13px;border:none;border-radius:12px;background:linear-gradient(135deg,#a07020,#c8952a,#e8c060);color:#fff;font-family:sans-serif;font-size:1rem;font-weight:700;cursor:pointer;letter-spacing:0.04em;transition:opacity 0.18s;box-shadow:0 4px 18px rgba(200,149,42,0.35);"
          onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Ingresar</button>
      </div>
    `;
    document.body.appendChild(modal);
    let modoSB = 'login';
    const eEmail = ()=>document.getElementById('sb-email');
    const ePwd   = ()=>document.getElementById('sb-pwd');
    const eErr   = ()=>document.getElementById('sb-err');
    const eOk    = ()=>document.getElementById('sb-ok');
    document.getElementById('sb-go').onclick = async () => {
      const email = eEmail().value.trim();
      const password = ePwd().value;
      eErr().style.display = 'none'; eOk().style.display = 'none';
      if(!email || password.length < 6){
        eErr().textContent = 'Correo y contraseña (mín 6 caracteres) requeridos';
        eErr().style.display = 'block'; return;
      }
      const btn = document.getElementById('sb-go');
      btn.disabled = true; btn.textContent = '...';
      try {
        const sb = await initSupabase();
        let res;
        if(false && modoSB === 'signup'){
          res = await sb.auth.signUp({ email, password });
          if(res.error) throw res.error;
          if(!res.data.session){
            eOk().textContent = '✓ Cuenta creada. Revisa tu correo o desactiva "Confirm email" en Supabase para entrar directo.';
            eOk().style.display = 'block';
            btn.disabled = false; btn.textContent = 'Entrar';
            modoSB = 'login';
            document.getElementById('sb-title').textContent = 'Iniciar sesión';
            return;
          }
        } else {
          res = await sb.auth.signInWithPassword({ email, password });
          if(res.error) throw res.error;
        }
        // Login exitoso
        sbSession  = 'supabase-active-' + res.data.user.id;
        sbExpiry = Date.now() + 1000*60*60*12;
        window._miUserId = res.data.user.id; // guardar para distinguir cambios propios
        // Cargar config de captura retroactiva después del login
        setTimeout(function(){ capturaMesCargarSupabase(); if(typeof retroGlobalCargarSupabase==='function') retroGlobalCargarSupabase(); }, 2000);
        empleadoActual = {
          email: res.data.user.email,
          nombre: EMPLEADOS[res.data.user.email.toLowerCase()] || res.data.user.email.split('@')[0]
        };
        try{ if(typeof _driveSyncRefreshPendiente==='function') _driveSyncRefreshPendiente(); } catch(e){}
        // SEGURIDAD: el "Modo administrador" del panel de Placas (_mpeAdminActivo)
        // es una variable en memoria que antes NO se reseteaba al cambiar de
        // usuario dentro de la misma pestaña — si el admin lo activaba y luego
        // otra persona iniciaba sesión con su propia cuenta sin recargar la
        // página, heredaba el modo administrador sin haber puesto su contraseña.
        // Se fuerza a "apagado" en cada login nuevo, sin importar quién entre.
        try{
          if(typeof _mpeAdminActivo !== 'undefined') _mpeAdminActivo = false;
          if(typeof _mpeAdminOff !== 'undefined') _mpeAdminOff = false;
          sessionStorage.removeItem('mpe_admin_off');
        } catch(e){}
        try{ localStorage.setItem('empleado_email', empleadoActual.email); } catch(e){ registrarError('localStorage.setItem', e); }
try{ localStorage.setItem('empleado_nombre', empleadoActual.nombre); } catch(e){ registrarError('localStorage.setItem', e); }
// Bloquea "Responsable del Trámite" al nombre de quien inició sesión (o lo
// convierte en selector si es admin) — antes esta función existía pero nunca
// se llamaba, dejando el campo libre para cualquiera.
try{ if(typeof detectarEmpleado==='function') await detectarEmpleado(); } catch(e){ console.warn('[detectarEmpleado]', e); }
const _despachoOk = await obtenerDespachoActivo();
        // Si obtenerDespachoActivo devuelve null, el empleado no tiene membresía asignada.
        // La función ya cerró la sesión y mostrará el error — detener el flujo aquí.
        if(!_despachoOk){ btn.disabled = false; btn.textContent = 'Entrar'; return; }
        // No se quita el modal de login todavía — se deja puesto como "cortina"
        // (con su mismo fondo negro texturizado) para que el sistema NUNCA se
        // vea de fondo, ni siquiera borroso detrás del aviso de horario. Solo
        // se oculta la tarjeta beige del formulario; el fondo se queda. La
        // retira _lexCortinaQuitar() SOLO cuando el usuario queda realmente
        // autorizado a entrar (admin de inmediato; empleado hasta que cierre
        // el aviso de mañana/tarde o termine la cuenta regresiva). Si el
        // horario está "cerrado", la cortina se queda puesta indefinidamente
        // — la única salida es cerrar sesión (recarga la página sola).
        var _sbCard = modal.firstElementChild;
        if(_sbCard) _sbCard.style.display = 'none';
        window._lexLoginCortina = modal;
        setTimeout(function(){ // red de seguridad — igual que el splash
          // Si para entonces ya está mostrado el aviso de horario (candado
          // legítimo, puede durar horas a propósito), NO se toca la cortina.
          var gate = document.getElementById('modal-horario-gate');
          if(gate && gate.classList.contains('show')) return;
          if(window._lexLoginCortina && window._lexLoginCortina.parentNode){
            window._lexLoginCortina.parentNode.removeChild(window._lexLoginCortina);
            window._lexLoginCortina = null;
          }
        }, 12000);
        actualizarAmbossBadges(true);
        setStatus('loading','Cargando datos del despacho...','loading');
        await sincronizarFolio();
        try { if(typeof window._pendMovsRecuperar === 'function') window._pendMovsRecuperar(); } catch(_ePend){}
        setStatus('ok','Sistema conectado — ' + empleadoActual.nombre,'ok');
        const _btnCS = document.getElementById('btn-cerrar-sesion'); if(_btnCS) _btnCS.style.display = 'block';
        auditoriaRegistrar('login', 'Inicio de sesión — ' + empleadoActual.email);
        // Conectar Realtime para sincronización entre usuarios
        setTimeout(lexRealtimeConectar, 1500);
        // Registrar sesión en monitor
        setTimeout(sesionesRegistrarLogin, 2000);
        // Activar SCANSYS si es administrador
        if(typeof scansysInit==='function' && empleadoActual.email.toLowerCase()===(typeof ADMIN_EMAIL!=='undefined'?ADMIN_EMAIL.toLowerCase():'')) setTimeout(scansysInit, 2500);
        // Horario de captura: bienvenida/espera/cierre + avisos programados
        setTimeout(function(){ if(typeof horarioGateLogin==='function') horarioGateLogin(); }, 700);
      } catch(e) {
        let msg = e.message || String(e);
        if(/invalid login credentials/i.test(msg)) msg = 'Correo o contraseña incorrectos';
        else if(/user already registered/i.test(msg)) msg = 'Ya existe una cuenta con ese correo';
        else if(/email not confirmed/i.test(msg)) msg = 'Confirma tu correo o desactiva la confirmación en Supabase';
        eErr().textContent = msg;
        eErr().style.display = 'block';
        btn.disabled = false;
        btn.textContent = modoSB==='login' ? 'Entrar' : 'Crear cuenta';
      }
    };
    // Enter para enviar
    [eEmail(), ePwd()].forEach(el => {
      el.addEventListener('keypress', e => {
        if(e.key === 'Enter') document.getElementById('sb-go').click();
      });
    });
    setTimeout(()=> eEmail().focus(), 100);
  } else {
    modal.style.display = 'flex';
  }
}

function syncStart() {
  _syncCounter++;
  _syncCounterChangedAt = Date.now();
  if (_syncCounter > 0) setSyncState('syncing');
}

function syncEnd(exito, errorMsg) {
  _syncCounter = Math.max(0, _syncCounter - 1);
  _syncCounterChangedAt = Date.now();
  if (_syncCounter === 0) {
    setSyncState(exito ? 'idle' : 'error', errorMsg);
  }
}

function _sbConTimeout(promesa, ms, etiqueta) {
  return Promise.race([
    promesa,
    new Promise(function(_, rej) {
      setTimeout(function(){ rej(new Error((etiqueta||'Supabase') + ': tiempo de espera agotado (' + Math.round(ms/1000) + 's)')); }, ms);
    })
  ]);
}

function _syncWatchdog() {
  if (_syncCounter > 0) {
    const inactividad = Date.now() - _syncCounterChangedAt;
    if (inactividad > 45000) {
      console.warn('[syncWatchdog] Contador atascado en', _syncCounter,
        'por', Math.round(inactividad/1000), 'segundos — reseteando');
      _syncCounter = 0;
      _syncCounterChangedAt = Date.now();
      // Resetear tambien _syncEnCurso para desbloquear futuros syncs
      if(typeof _syncEnCurso !== 'undefined') _syncEnCurso = false;
      setSyncState('error', 'Última sincronización no confirmada — vuelve a guardar');
    }
  }
}

function actualizarEstadoConexion() {
  const chip = document.getElementById('connChip');
  if (!chip) return;
  const online = navigator.onLine;
  if (online) {
    chip.style.display = 'none';
    if (_conexionPerdidaTime !== null) {
      // Volvió la conexión — notificar
      const segundos = Math.round((Date.now() - _conexionPerdidaTime) / 1000);
      const tiempoTxt = segundos < 60 ? segundos + 's' : Math.round(segundos/60) + 'min';
      toast('🌐 Conexión restablecida (estuvo offline ' + tiempoTxt + ')', 'ok');
      _conexionPerdidaTime = null;
      // Intentar resincronizar con Supabase
      try {
        if (sbSession && Date.now() < sbExpiry) {
          // Re-disparar guardado para mandar lo que esté en localStorage a Supabase
          syncEstadoSupabaseDebounced().catch((e)=>{ registrarError('Promise catch vacio', e); });
        }
      } catch(e){ console.warn('reconectar:', e); }
    }
  } else {
    chip.style.display = 'flex';
    if (_conexionPerdidaTime === null) {
      _conexionPerdidaTime = Date.now();
      toast('⚠ Sin conexión a internet — los cambios se guardan localmente', 'err');
      // Marcar el indicador como pendiente
      if (typeof setSyncState === 'function') setSyncState('pending');
    }
  }
  // Actualizar medidor cuando cambia conectividad
  if (typeof actualizarMedidorDrive === 'function') {
    setTimeout(actualizarMedidorDrive, 100);
  }
}

function _ppSyncFechaRetro(el){
  const tr = el.closest('tr');
  if(!tr) return;
  const f = (tr.querySelector('.pp-fecha-retro')||{}).value || '';
  const h = (tr.querySelector('.pp-hora-retro')||{}).value  || '';
  if(f && h) tr.dataset.fechaHora = f + ' ' + h;
}

function forzarSincronizacionHora(){
  sincronizarHoraCDMX();
}

function _dObsSyncBoton(){
  const btn = document.getElementById('mCarpDetBtnAgregar');
  if(!btn) return;
  if(_dObsEditMode){ btn.innerHTML = '＋ Agregar nota'; btn.title = 'Agregar otra observación'; }
  else { btn.innerHTML = '✏️ Editar notas'; btn.title = 'Editar observaciones'; }
}

function _groqGsClick(i) {
  const item = (window._groqAcciones || [])[i];
  if (item && item.accion) {
    globalSearchCerrar();
    document.getElementById('global-search-icon').textContent = '🔍';
    item.accion();
  }
}

function save(){
  _ultimoSyncPropio = Date.now();
  syncEstadoSupabase().catch(function(e){ console.warn('[save]', e); });
}

function iniciarAuth(){
  // Versión Supabase: redirige al modal de login
  if(sbSession && Date.now() < sbExpiry){
    toast('Sesión activa ✓');
    actualizarAmbossBadges(true);
    return;
  }
  mostrarLoginSupabase();
}

function syncEstadoSupabaseDebounced(){
  // Siempre retorna una Promise resuelta para que .catch((e)=>{ registrarError('Promise catch vacio', e); }) no explote
  if(_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
  _syncDebounceTimer = setTimeout(() => {
    syncEstadoSupabase().catch((e)=>{ registrarError('Promise catch vacio', e); });
  }, 800);
  return Promise.resolve();
}

async function forzarBackup(){
  if(!window.SB || !window.SB_DESPACHO_ID){ toast('Conecta tu sesión primero','err'); return; }
  toast('Creando backup...');
  _backupDiarioHecho = false;
  await hacerBackupDiario();
  const hoyStr = (typeof hoy === 'function') ? hoy() : new Date().toISOString().slice(0,10);
  toast('✅ Backup creado en Supabase: lexmexico_backup_'+hoyStr+'.json');
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

async function vaciarCarrito(){
  const ok = await confirmarBonito({
    titulo: 'Vaciar carrito',
    mensaje: '¿Quitar todos los items del carrito?',
    btnSi: 'Sí, vaciar',
    btnNo: 'Cancelar'
  });
  if(!ok) return;
  CARRITO=[];
  renderCarrito();
  updateCarritoBadge();
}

function toggleSyncSheetsUI() {
  // Sync siempre activo (Supabase)
  syncErrorCount = 0; syncQueue = [];
  const el = document.getElementById('sync-estado');
  if (el) el.textContent = '🟢 Activo';
  toast('🟢 Sync ACTIVO');
}

function actualizarSyncUI() {
  const elCnt = document.getElementById('sync-cola-count');
  if (elCnt) elCnt.textContent = syncQueue.length;
  const elEstado = document.getElementById('sync-estado');
  if (elEstado) elEstado.textContent = '🟢 Activo';
}

async function _gfActualizarVersionesSB(pares, logFn){
  if(!(window.SB && window.SB_DESPACHO_ID)) return;
  for(var i=0;i<pares.length;i++){
    var viejo=pares[i][0], nuevo=pares[i][1];
    try{
      // FIX: esta llamada no tenía timeout, a diferencia de TODAS las demás
      // llamadas a Supabase en el resto de la app (que usan _sbConTimeout).
      // Si una sola petición se quedaba sin responder (ej. red inestable,
      // worker caído), el await se congelaba para siempre y el Gestor de
      // Folios se quedaba atorado sin error visible ni forma de continuar —
      // "empieza pero nunca llega a los resultados". Ahora, tras 8s sin
      // respuesta, se rechaza con error controlado, se registra y el loop
      // sigue con el siguiente par en vez de trabarse.
      await _sbConTimeout(window.SB.from('versiones_recibo').update({folio_base:nuevo})
        .eq('despacho_id', window.SB_DESPACHO_ID).eq('folio_base', viejo), 8000, 'Gestor de Folios: versión '+viejo+'→'+nuevo);
    }catch(e){
      console.warn('[gestorFolios] versiones '+viejo+'→'+nuevo, e);
      if(logFn) logFn('⚠ versiones_recibo '+viejo+'→'+nuevo+': '+(e&&e.message?e.message:e));
    }
  }
}

async function _sha256File(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function _flujoProfundizarEtapa(i){
  const etapas = window._flujoEtapasActual || [];
  const et = etapas[i];
  if(!et) return;
  const btn = document.getElementById('flujo-profundizar-btn');
  const slot = document.getElementById('flujo-profundizar-slot');
  if(btn){ btn.disabled = true; btn.style.opacity = '0.6'; btn.innerHTML = '<span style="display:inline-block;width:11px;height:11px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:-1px;margin-right:6px;"></span>Profundizando…'; }
  if(slot) slot.innerHTML = '<div style="font-size:0.62rem;color:var(--muted);padding:2px 0;">🔎 Pidiendo a la IA que profundice esta etapa con el texto de la ley…</div>';

  const leyTexto = window._flujoLeyTextoCompleto || '';
  const leyNombre = window._flujoLeyActual || '';
  const tipoJuicio = window._flujoTipoJuicioActual || '';
  // Esta llamada es SOLO para una etapa (no las 9 juntas), así que se le
  // puede dar mucho más texto de la ley que en la generación general. Pero
  // Groq tiene un límite REAL de 8,000 tokens por minuto por petición — un
  // texto de 40,000 caracteres (~10,000 tokens) NUNCA cabría ahí, sin
  // importar cuánto se recorte max_tokens. Por eso: si Cloudflare (modelo de
  // contexto largo, 128K tokens) está configurado, se usa DIRECTO con el
  // texto grande; si no, se cae a Groq con un recorte mucho más chico para
  // respetar su límite real.
  const _cfaiDisponible = !!(_cfaiGetAccountId() && _cfaiGetToken());
  const LIMITE_ETAPA = _cfaiDisponible ? 40000 : 4500;
  const leyParaEtapa = leyTexto.length > LIMITE_ETAPA ? leyTexto.slice(0, LIMITE_ETAPA) + '\n\n[…texto recortado por longitud…]' : leyTexto;

  const _buildPromptProfundizar = (leyTxt) => `Eres un abogado litigante mexicano experto. Vas a profundizar UNA sola etapa del procedimiento "${tipoJuicio}" (regido por "${leyNombre}") — dale al abogado el máximo detalle posible sobre ESTA etapa en particular.

ETAPA A PROFUNDIZAR: "${et.etapa}"

Versión general ya generada (ahora hay que ampliarla y precisarla):
- Descripción: ${et.descripcion || '—'}
- Artículos: ${et.articulos || '—'}
- Plazo: ${et.plazo || '—'}

${leyTxt ? `TEXTO DE LA LEY (fuente única — cita textualmente entre comillas el fragmento exacto cuando lo uses):\n"""\n${leyTxt}\n"""` : 'No se tiene el texto de la ley a la vista para esta etapa; usa tu conocimiento del derecho mexicano, pero marca con "verificar en la ley" cualquier dato del que no estés seguro — NUNCA inventes un artículo o plazo.'}

Genera una versión MUCHO MÁS DETALLADA Y PRECISA de esta etapa:
- descripcion: explicación completa y práctica, paso a paso, de qué ocurre en esta etapa (mínimo 4-5 oraciones, lenguaje claro para el abogado).
- articulos: cita el/los artículo(s) EXACTOS; si tienes el texto de la ley arriba, incluye además una cita textual breve (entre comillas) del fragmento relevante.
- plazo: el plazo exacto tal como aparece en la ley, señalando el artículo que lo establece.
- documentos: lista detallada de TODOS los documentos/requisitos necesarios en esta etapa.
- recursos: recursos o medios de impugnación disponibles si algo sale mal en esta etapa, con su fundamento.
- riesgo: consecuencia procesal EXACTA de no atender esta etapa a tiempo, con fundamento si existe.

Responde ÚNICAMENTE con un objeto JSON válido (NO un arreglo), sin markdown ni backticks, con exactamente estas llaves:
{"descripcion":"...","articulos":"...","plazo":"...","documentos":"...","recursos":"...","riesgo":"..."}`;

  try {
    let txt;
    if (_cfaiDisponible) {
      try {
        txt = await _cfaiLlamarContextoLargo(_buildPromptProfundizar(leyParaEtapa), 2500, 0.1, 'procesal');
      } catch (eCf) {
        console.warn('[Flujo] Cloudflare (contexto largo) falló al profundizar (' + eCf.message + '); reintentando con Groq y un texto más corto...');
        if (/CFAI_LIMITE/.test(eCf.message || '') && typeof toast === 'function') {
          toast('⚠ Cloudflare agotó su cupo gratis de hoy — esto salió con Groq (menos detalle). Se renueva a medianoche UTC.', 'err');
        }
        _setLoad && _setLoad('Cloudflare no respondió; reintentando con Groq…');
        const leyCorta = leyTexto.length > 4500 ? leyTexto.slice(0, 4500) + '\n\n[…texto recortado por longitud…]' : leyTexto;
        txt = await _iaLlamar(_buildPromptProfundizar(leyCorta), 2500, 0.1, 'procesal');
      }
    } else {
      txt = await _iaLlamar(_buildPromptProfundizar(leyParaEtapa), 2500, 0.1, 'procesal');
    }
    const limpio = (typeof _cfaiComoTexto === 'function' ? _cfaiComoTexto(txt) : String(txt||'')).replace(/```json|```/g,'').trim();
    const m = limpio.match(/\{[\s\S]*\}/);
    const obj = JSON.parse(m ? m[0] : limpio);
    if(!obj || typeof obj !== 'object') throw new Error('Formato inesperado');

    // Fusiona el detalle nuevo sobre la etapa (conserva el título original)
    Object.assign(et, {
      descripcion: obj.descripcion || et.descripcion,
      articulos:   obj.articulos   || et.articulos,
      plazo:       obj.plazo       || et.plazo,
      documentos:  obj.documentos  || et.documentos,
      recursos:    obj.recursos    || et.recursos,
      riesgo:      obj.riesgo      || et.riesgo
    });

    // Persistir en el expediente
    const j = D.juicios && D.juicios[_mexpIdx];
    if(j && Array.isArray(j.flujoProcedimiento) && j.flujoProcedimiento[i]){
      Object.assign(j.flujoProcedimiento[i], et);
      try { saveJuicios(); } catch(e){}
      try { if (typeof syncEstadoSupabaseDebounced === 'function') syncEstadoSupabaseDebounced(); } catch(e){}
    }

    if(slot) slot.innerHTML = '<div style="font-size:0.62rem;color:var(--verde-d);background:var(--verde-l);border-radius:var(--radius-sm);padding:6px 9px;">✓ Etapa profundizada' + (leyParaEtapa ? ' con el texto de la ley.' : ' (sin texto de la ley a la vista).') + '</div>';
    if (typeof toast === 'function') toast('✓ Etapa profundizada', 'ok');
    // Redibuja el modal con el contenido actualizado
    _flujoAbrirDetalle(i);
  } catch(e){
    console.error('[Flujo] Profundizar etapa:', e);
    if(slot) slot.innerHTML = '<div style="font-size:0.62rem;color:var(--rojo);">⚠ No se pudo profundizar: ' + escHTML(e.message) + '</div>';
    if(btn){ btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = '🔎 Profundizar con IA'; }
  }
}

async function _llamarGeminiIA(prompt){
  const loadingEl = _agregarMensajeIA('⏳ Analizando...', 'assistant');
  try{
    const texto = (await _iaLlamar(prompt, 2048, 0.3, 'consulta')).trim() || 'Sin respuesta.';
    if(loadingEl) loadingEl.textContent = texto;
    return texto;
  } catch(e){
    if(loadingEl) loadingEl.textContent = 'Error: ' + e.message;
    return '';
  }
}

async function _llamarGeminiIADirecto(prompt){
  try{
    return (await _iaLlamar(prompt, 2048, 0.3, 'consulta')).trim() || 'Sin respuesta.';
  } catch(e){ return 'Error: ' + e.message; }
}
