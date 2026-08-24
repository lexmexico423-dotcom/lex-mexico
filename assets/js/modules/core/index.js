/* LEX-MÉXICO · Módulo core
 * Funciones extraídas sin modificar su contenido.
 */

function $(id) {
  let el = _domCache.get(id);
  if (el && el.isConnected) return el;
  el = document.getElementById(id);
  if (el) _domCache.set(id, el);
  return el;
}

function $invalidate(id) { _domCache.delete(id); }

function debounce(fn, ms = 200) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function fmtFecha(iso) {
  if (!iso || typeof iso !== 'string') return iso || '—';
  var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return m[3] + '/' + m[2] + '/' + m[1];
}

function fmtMXN(num) {
  const n = parseFloat(num) || 0;
  return n.toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function numeroALetras(num){
  const n = Math.abs(parseFloat(num)||0);
  const entero = Math.floor(n);
  const cents = Math.round((n - entero)*100);
  const unidades=['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE',
    'DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE'];
  const decenas=['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  const centenas=['','CIEN','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS',
    'SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
  function grupo(n){
    let s='';
    const c=Math.floor(n/100), d=Math.floor((n%100)/10), u=n%10;
    if(c>0){ s+=c===1&&(n%100)===0?'CIEN':centenas[c]; if(n%100>0) s+=' '; }
    if((d*10+u)>0){
      if(d*10+u<20){ s+=unidades[d*10+u]; }
      else{
        s+=decenas[d];
        if(u>0) s+=' Y '+unidades[u];
      }
    }
    return s;
  }
  function miles(n){
    if(n===0) return 'CERO';
    let s='';
    const mill=Math.floor(n/1000000);
    const mil=Math.floor((n%1000000)/1000);
    const resto=n%1000;
    if(mill>0){ s+=(mill===1?'UN MILLÓN':grupo(mill)+' MILLONES')+' '; }
    if(mil>0){ s+=(mil===1?'MIL':grupo(mil)+' MIL')+' '; }
    if(resto>0){ s+=grupo(resto); }
    return s.trim();
  }
  let resultado = miles(entero)+' PESOS';
  resultado += ' '+String(cents).padStart(2,'0')+'/100 M.N.';
  return resultado;
}

function setModoCosto(modo) {
  var inp = document.getElementById('modo-costo-pactado');
  if (inp) inp.value = modo;
  var btnP = document.getElementById('btn-costo-pactado');
  var btnA = document.getElementById('btn-sin-costo-pactado');
  if (btnP) { btnP.style.borderColor = modo==='pactado' ? '#c8952a' : ''; btnP.style.background = modo==='pactado' ? '#fff5e0' : ''; btnP.style.color = modo==='pactado' ? '#7a4010' : ''; }
  if (btnA) { btnA.style.borderColor = modo==='abierto' ? '#1a5fa8' : ''; btnA.style.background = modo==='abierto' ? '#e6f1fb' : ''; btnA.style.color = modo==='abierto' ? '#0c3a7a' : ''; }
}

function togglePoderSection() {
  const body  = document.getElementById('poder-body');
  const arrow = document.getElementById('poder-arrow');
  if (!body) return;
  const abierto = body.style.display !== 'none';
  body.style.display  = abierto ? 'none' : '';
  if (arrow) arrow.textContent = abierto ? '▸' : '▾';
}

function toggleCategoria(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector('span');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  arrow.textContent = open ? '▸' : '▾';
}

function setTipoDoc(tipo) {
  document.getElementById('btn-doc-copia').classList.toggle('active', tipo === 'copia');
  document.getElementById('btn-doc-escaneo').classList.toggle('active', tipo === 'escaneo');
  document.getElementById('tipo_doc').value = tipo;
}

function _lexSplashOcultar(){
  var s = document.getElementById('lex-splash');
  if(!s) return;
  s.style.opacity = '0';
  setTimeout(function(){ if(s && s.parentNode) s.parentNode.removeChild(s); }, 380);
}

function parsePrecio(val) {
  // Remove currency symbol, spaces, and commas → get float
  return parseFloat((val||'').replace(/[$\s,]/g,'')) || 0;
}

function _guiaAplicarPan(){
  if(_guiaPanLayerEl) _guiaPanLayerEl.style.transform = 'translate(' + _guiaPanX + 'px,' + _guiaPanY + 'px)';
}

function _guiaAplicarZoom(){
  if(_guiaImgWrapEl) _guiaImgWrapEl.style.transform = 'scale(' + _guiaZoomScale + ')';
}

function _guiaMouseDown(e){
  if(!_guiaViewportEl) return;
  e.preventDefault();
  _guiaArrastrando = true;
  _guiaStartX = e.clientX; _guiaStartY = e.clientY;
  _guiaPanStartX = _guiaPanX; _guiaPanStartY = _guiaPanY;
  _guiaViewportEl.style.cursor = 'grabbing';
}

function _guiaMouseMove(e){
  if(!_guiaArrastrando) return;
  _guiaPanX = _guiaPanStartX + (e.clientX - _guiaStartX);
  _guiaPanY = _guiaPanStartY + (e.clientY - _guiaStartY);
  _guiaAplicarPan();
}

function _guiaMouseUp(){
  if(_guiaArrastrando){ _guiaArrastrando = false; if(_guiaViewportEl) _guiaViewportEl.style.cursor = 'grab'; }
}

function _guiaWheel(e){
  e.preventDefault();
  var delta = e.deltaY < 0 ? 0.15 : -0.15;
  _guiaZoomScale = Math.min(4, Math.max(_guiaMinScale, _guiaZoomScale + delta));
  _guiaAplicarZoom();
}

function _guiaCalcularMinScale(){
  if(!_guiaViewportEl || !_guiaImgWrapEl) return;
  var img = _guiaImgWrapEl.querySelector('img');
  if(!img || !img.naturalWidth) return;
  var vpW = _guiaViewportEl.clientWidth - 32;
  var vpH = _guiaViewportEl.clientHeight - 32;
  // ancho renderizado actual (con max-width:100% ya aplicado, sin el transform de zoom)
  var renderW = img.clientWidth || vpW;
  var renderH = img.clientHeight || (renderW * (img.naturalHeight / img.naturalWidth));
  if(renderW <= 0 || renderH <= 0) return;
  var minScale = Math.min(1, vpW / renderW, vpH / renderH);
  if(!isFinite(minScale) || minScale <= 0) minScale = 1;
  _guiaMinScale = minScale;
  if(_guiaZoomScale < _guiaMinScale){
    _guiaZoomScale = _guiaMinScale;
    _guiaAplicarZoom();
  }
}

function formatPrecio(input) {
  const raw = input.value.replace(/[$\s,]/g, '');
  // Allow digits and a single dot
  const clean = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  if (clean === '' || clean === '.') { input.value = clean; calcTotales(); return; }
  const parts = clean.split('.');
  const intPart = parseInt(parts[0]||'0', 10);
  const decPart = parts.length > 1 ? '.' + parts[1].slice(0,2) : '';
  input.value = intPart.toLocaleString('es-MX') + decPart;
  calcTotales();
  // Validar excedente SOLO cuando el usuario edita el campo anticipo
  if(input.id === 'anticipo') validarAnticipo();
}

function _quitarAcentosQR(str){
  return String(str||'').normalize('NFD').replace(/[̀-ͯ]/g,'');
}

function qrToDataURL(texto){
  return new Promise(resolve=>{
    const div=document.createElement('div');
    div.style.position='absolute'; div.style.left='-9999px'; document.body.appendChild(div);
    new QRCode(div,{text:_quitarAcentosQR(texto),width:130,height:130,colorDark:'#1a1008',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
    setTimeout(()=>{
      const img=div.querySelector('img')||div.querySelector('canvas');
      const url=img?(img.src||img.toDataURL()):'';
      document.body.removeChild(div); resolve(url);
    },350);
  });
}

function setStatus(t,msg,cls){
  document.getElementById('status-text').textContent=msg;
  document.getElementById('status-dot').className='dot '+(cls||'');
}

function getLogoDataURL(){
  return new Promise(resolve => {
    const imgEl = document.querySelector('.header-logo img');
    if(!imgEl){ resolve({ url:'', w:1, h:1 }); return; }
    const nW = imgEl.naturalWidth  || imgEl.width  || 200;
    const nH = imgEl.naturalHeight || imgEl.height || 200;
    const canvas = document.createElement('canvas');
    canvas.width  = nW;
    canvas.height = nH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, nW, nH);
    resolve({ url: canvas.toDataURL('image/jpeg', 0.92), w: nW, h: nH });
  });
}

function dibujarMarcaAgua(doc, texto, color){
  const pageW = 215.9, pageH = 279.4;
  const cx = pageW / 2;
  const cy = pageH * 0.62; // ≈ 173 mm — tercio inferior-medio, lejos del encabezado
  const angleDeg = Math.atan2(pageH, pageW) * 180 / Math.PI; // ≈ 52.3°
  const paginaOriginal = doc.internal.getCurrentPageInfo
    ? doc.internal.getCurrentPageInfo().pageNumber : 1;
  const totalPaginas = doc.internal.getNumberOfPages();
  for(let pg = 1; pg <= totalPaginas; pg++){
    doc.setPage(pg);
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({opacity: 0.11}));
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont('helvetica','bold');
    doc.setFontSize(82);
    doc.text(texto, cx, cy, {angle: angleDeg, align:'center', baseline:'middle'});
    doc.restoreGraphicsState();
  }
  doc.setPage(paginaOriginal);
}

function _parseFHTexto(str) {
  if (!str) return null;
  const s = String(str).trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/); // DD/MM/YYYY [HH:MM]
  if (m) return { fecha: m[3] + '-' + m[2] + '-' + m[1], hora: m[4] != null ? (String(m[4]).padStart(2, '0') + ':' + m[5]) : '' };
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/); // YYYY-MM-DD [HH:MM]
  if (m) return { fecha: m[1] + '-' + m[2] + '-' + m[3], hora: m[4] != null ? (String(m[4]).padStart(2, '0') + ':' + m[5]) : '' };
  return null;
}

function _fmtFHDesdeTexto(str) {
  const p = _parseFHTexto(str);
  if (!p) return str || '';
  return _fmtFHNueva(p.fecha, p.hora);
}

function escHTML(str){
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pintarCostosExtra(arr){
  const tbody = document.getElementById('costos-extra-tbody');
  tbody.innerHTML = ''; costoExtraCount = 0;
  // Todos los costos extra ya guardados se consideran impresos -> locked
  (arr||[]).forEach(ce => agregarCostoExtra(Object.assign({}, ce, {locked: true})));
}

function quitarCostoExtra(id){
  const r = document.getElementById('costo-extra-row-'+id);
  if(r){ r.remove(); recalcularResumenActualizacion(); }
}

function _ppParsearFechaHoraExistente(str){
  if(!str) return null;
  var s = String(str);
  var m = s.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
  if(m) return { fecha: m[1]+'-'+m[2]+'-'+m[3], hora: (m[4].length<2?'0'+m[4]:m[4])+':'+m[5] };
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if(m) return { fecha: m[3]+'-'+(m[2].length<2?'0'+m[2]:m[2])+'-'+(m[1].length<2?'0'+m[1]:m[1]), hora: (m[4].length<2?'0'+m[4]:m[4])+':'+m[5] };
  return null;
}

function fechaLocalISO(d){
  const x = d || new Date();
  const y = x.getFullYear();
  const m = String(x.getMonth()+1).padStart(2,'0');
  const dd = String(x.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+dd;
}

function ahoraCDMX(){
  // Siempre usa la hora real del equipo (Date.now()), zona CDMX via Intl
  return new Date(Date.now());
}

function partesHoraCDMX(d){
  const x = d || ahoraCDMX();
  const fmt = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
  });
  const parts = fmt.formatToParts(x).reduce((o,p)=>{ o[p.type]=p.value; return o; },{});
  return {
    iso: parts.year+'-'+parts.month+'-'+parts.day,
    hora: parts.hour+':'+parts.minute,
    fechaHora: parts.day+'/'+parts.month+'/'+parts.year+' '+parts.hour+':'+parts.minute+' hrs.',
    timestamp: x.getTime()
  };
}

function fechaCDMX_ISO(){ return partesHoraCDMX().iso; }

function horaCDMX_HHMM(){ return partesHoraCDMX().hora; }

function fechaHoraCDMX_Str(){ return partesHoraCDMX().fechaHora; }

function setHoraBadge(estado, texto){
  const badge = document.getElementById('hora-badge');
  const icon  = document.getElementById('hora-icon');
  const label = document.getElementById('hora-label');
  if(!badge) return;
  badge.classList.remove('ok','warn','err','loading');
  badge.classList.add(estado);
  if(estado==='ok')        icon.textContent = '🖥';
  else if(estado==='warn') icon.textContent = '⚠';
  else if(estado==='err')  icon.textContent = '✕';
  else                     icon.textContent = '⏳';
  label.textContent = texto;
}

function fichaRetroEditar(){
  abrirEditorFechaRetro();
}

function calcularIniciales(nombreCompleto){
  if(!nombreCompleto) return '';
  const conectores = new Set(['de','del','la','las','los','y','el']);
  const titulos    = new Set(['lic','licenciado','licenciada','mtro','mtra','maestro','maestra',
                              'dr','dra','doctor','doctora','ing','ingeniero','ingeniera',
                              'arq','arquitecto','arquitecta','c','sr','sra','srta']);
  const palabras = nombreCompleto.trim().split(/\s+/).filter(w => {
    const lw = w.toLowerCase().replace(/[.,;:]/g,'');
    return w.length > 0 && !conectores.has(lw) && !titulos.has(lw);
  });
  if(!palabras.length) return '';
  return palabras.map(p => p.charAt(0).toUpperCase()).join('.') + '.';
}

function calcularInicialesEnVivo(){
  const nombre = $('auth-nombre-completo').value;
  const display = document.getElementById('auth-iniciales-display');
  const iniciales = calcularIniciales(nombre);
  display.textContent = iniciales || '—';
}

function cerrarModalAutorizacion(){
  document.getElementById('modal-autorizacion').classList.remove('show');
  if(_autorizacionPromiseResolver){
    const r = _autorizacionPromiseResolver;
    _autorizacionPromiseResolver = null;
    r(null); // cancelado
  }
}

function cerrarModalVehicular(){
  document.getElementById('modal-vehicular').classList.remove('show');
  document.getElementById('vehicular-descripcion').value = '';
}

function cerrarModalValidacion(){ document.getElementById('modal-validacion').classList.remove('show'); _guardarForzado=false; }

function respSeleccionar(idx) {
  // Actualizar estilos visuales al seleccionar
  const lista = window._respLista || [];
  lista.forEach((_, i) => {
    const lbl = document.getElementById('resp-opt-'+i);
    if (!lbl) return;
    if (i === idx) {
      lbl.style.borderColor = 'rgba(200,149,42,0.6)';
      lbl.style.background  = 'rgba(200,149,42,0.1)';
      lbl.querySelector('input').checked = true;
    } else {
      lbl.style.borderColor = 'rgba(200,149,42,0.2)';
      lbl.style.background  = 'rgba(200,149,42,0.03)';
    }
  });
}

function respConfirmar() {
  const radio = document.querySelector('input[name="resp-radio"]:checked');
  const nombre = radio ? radio.value : empNombre();
  document.getElementById('resp-selector-ov')?.remove();
  if (typeof window._respCallback === 'function') {
    window._respCallback(nombre);
    window._respCallback = null;
    window._respLista    = null;
  }
}

function renderHistorial(){
  filtrarHistorial();
}

function showModal(titulo,msg){
  document.getElementById('modal-title').textContent=titulo;
  document.getElementById('modal-msg').innerHTML=msg;
  document.getElementById('modal').classList.add('show');
}

function cerrarModal(){ document.getElementById('modal').classList.remove('show'); }

function togglePanelesBusqueda(){
  _panelesBusquedaAbiertos = !_panelesBusquedaAbiertos;
  _pbcAbierto = _panelesBusquedaAbiertos;
  _pfcAbierto = _panelesBusquedaAbiertos;
  const cuerpo = document.getElementById('paneles-busqueda-cuerpo');
  const arrow  = document.getElementById('toggle-paneles-arrow');
  const btn    = document.getElementById('btn-toggle-paneles');
  if(cuerpo) cuerpo.style.display = _panelesBusquedaAbiertos ? 'block' : 'none';
  if(arrow)  arrow.style.transform = _panelesBusquedaAbiertos ? 'rotate(90deg)' : 'rotate(0deg)';
  if(btn){
    btn.style.borderColor   = _panelesBusquedaAbiertos ? '#1a5a28' : '#2a7a3a';
    btn.style.background    = _panelesBusquedaAbiertos ? 'rgba(42,122,58,0.10)' : 'none';
  }
  /* Sincronizar clase en body para que CSS oculte el formulario */
  if(_panelesBusquedaAbiertos){
    document.body.classList.add('paneles-busqueda-abiertos');
  } else {
    document.body.classList.remove('paneles-busqueda-abiertos');
  }
  if(typeof syncFormVisibility==='function') syncFormVisibility();
  if(_panelesBusquedaAbiertos) setTimeout(()=>{ const inp=$('folio_anterior'); if(inp) inp.focus(); }, 80);
}

function togglePanelBusqueda(){ togglePanelesBusqueda(); }

function limpiarPBC(){
  $('pbc-input').value='';
  document.getElementById('pbc-clear').style.display='none';
  document.getElementById('pbc-resultados').innerHTML='';
  document.getElementById('pbc-count').textContent='';
  $('pbc-input').focus();
}

function toNumero(valor, defecto) {
  if (defecto === undefined) defecto = 0;
  if (valor === null || valor === undefined || valor === '') return defecto;
  if (typeof valor === 'number') return isFinite(valor) ? valor : defecto;
  // Limpiar string: quitar comas (separador de miles), espacios, signo $
  var limpio = String(valor).replace(/[\s,$]/g, '').trim();
  if (limpio === '') return defecto;
  var n = parseFloat(limpio);
  return (isNaN(n) || !isFinite(n)) ? defecto : n;
}

function toEntero(valor, defecto) {
  if (defecto === undefined) defecto = 0;
  var n = toNumero(valor, defecto);
  return Math.trunc(n);
}

function _capturaRetroApagar(motivo){
  if(!window._capturaMesActivo) return;
  window._capturaMesActivo   = null;
  window._capturaFechaManual = null;
  window._capturaHoraManual  = null;
  window._capturaMesActivadoTs = null;
  window._capturaRetroAvisado  = false;
  const _b = document.getElementById('captura-mes-banner');
  if(_b) _b.style.display = 'none';
  console.warn('[CapturaRetro] Modo retroactivo apagado automáticamente:', motivo);
  if(typeof toast==='function') toast('📅 Modo captura retroactiva desactivado — los registros vuelven a llevar la fecha de hoy','ok');
}

function _capturaRetroVigente(){
  const m = window._capturaMesActivo;
  if(!m) return null;
  const banner = document.getElementById('captura-mes-banner');
  if(!banner || banner.style.display === 'none' || !banner.isConnected){
    _capturaRetroApagar('el banner de captura ya no está visible');
    return null;
  }
  // Sin marca de tiempo se considera CADUCADO (nunca "vigente para siempre"):
  // toda activación legítima sella _capturaMesActivadoTs, así que un modo sin
  // sello es un residuo de sesión y debe apagarse, no heredarse.
  const ts = window._capturaMesActivadoTs || 0;
  if(!ts || (Date.now() - ts) > CAPTURA_RETRO_VIGENCIA_MS){
    _capturaRetroApagar(ts ? 'caducó por inactividad (más de 2 h)' : 'modo sin sello de activación (residuo de sesión)');
    return null;
  }
  return m;
}

function _docEstilo(nombre, tipo){ return _DOC_ESTILOS[_docFamilia(nombre, tipo)]; }

function _minutosDeHHMM(hhmm){
  const p = String(hhmm||'0:0').split(':');
  return (parseInt(p[0],10)||0)*60 + (parseInt(p[1],10)||0);
}

function _minutosAhora(){
  const d = _ahoraVerificado();
  return d.getHours()*60 + d.getMinutes();
}

function _teClaveHoy(){
  return (typeof hoy === 'function') ? hoy() : new Date().toISOString().slice(0,10);
}

function _teEstaAbierto(email){
  const t = _teObtener(email);
  if(!t) return false;
  if(t.tipo === 'indefinido_permanente' || t.tipo === 'indefinido_hoy') return true;
  if(t.tipo === 'hora') return _minutosAhora() < _minutosDeHHMM(t.hasta);
  return false;
}

function _teDescribir(t){
  if(!t) return null;
  if(t.tipo === 'hora') return 'Abierto hoy hasta las '+t.hasta+' hrs'+(t.otorgadoPor?' (otorgado por '+t.otorgadoPor+')':'');
  if(t.tipo === 'indefinido_hoy') return 'Abierto hasta las 11:59 pm de hoy (mañana vuelve el horario normal)';
  if(t.tipo === 'indefinido_permanente') return 'Abierto permanente (hasta que lo apagues)';
  return null;
}

function _saludoPorHora(){
  const h = _ahoraVerificado().getHours();
  if(h < 12) return 'Buenos días';
  if(h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function _lexCortinaQuitar(){
  if(typeof _lexSplashOcultar === 'function') _lexSplashOcultar();
  if(window._lexLoginCortina && window._lexLoginCortina.parentNode){
    window._lexLoginCortina.parentNode.removeChild(window._lexLoginCortina);
  }
  window._lexLoginCortina = null;
}

function _horarioGateMostrar(estado, nombre){
  const ov = document.getElementById('modal-horario-gate');
  if(!ov) return;
  // FIX (candado real a media sesión): el fondo transparente/sin blur de
  // este overlay asume que ya está la cortina oscura del login detrás. Si
  // se dispara con el dashboard ya abierto (empleada que siguió trabajando
  // tras las 5:30 con la sesión ya iniciada), no hay cortina — se oscurece
  // el fondo aquí mismo para que el bloqueo también se vea, no solo funcione.
  if(!window._lexLoginCortina){
    ov.style.background = 'rgba(0,0,0,0.6)';
    ov.style.backdropFilter = 'blur(4px)';
    ov.style.webkitBackdropFilter = 'blur(4px)';
  }
  const elIcono     = document.getElementById('hg-icono');
  const elTitulo    = document.getElementById('hg-titulo');
  const elCuerpo    = document.getElementById('hg-cuerpo');
  const elCountdown = document.getElementById('hg-countdown');
  const elBtn       = document.getElementById('hg-btn');
  elCountdown.style.display = 'none';
  elBtn.style.display = 'block';
  if(estado === 'domingo'){
    elIcono.textContent  = '📅';
    elTitulo.textContent = 'Día no laborable';
    elCuerpo.innerHTML =
      '<div style="font-weight:700;margin-bottom:10px;">¡'+_saludoPorHora()+', '+escHTML(nombre)+'!</div>'+
      'Hoy domingo el despacho no labora.<br>'+
      'El sistema permanece cerrado y la captura de movimientos estará disponible nuevamente el siguiente día hábil.';
    elBtn.textContent = 'Cerrar sesión';
    elBtn.onclick = function(){
      // Mismo guardrail que "Horario concluido": se pregunta ANTES de tocar
      // el candado — si cancela, se queda bloqueado tal cual.
      if(typeof cerrarSesionUsuario==='function') cerrarSesionUsuario();
    };
  } else if(estado === 'antes'){
    elIcono.textContent  = '🌅';
    elTitulo.textContent = 'Bienvenida';
    elCuerpo.innerHTML =
      '<div style="font-weight:700;margin-bottom:10px;">¡Buenos días, '+escHTML(nombre)+'!</div>'+
      'Aún no inicia el horario de captura.<br>'+
      '🕣 El sistema se habilita a las 7:00 a. m.<br>'+
      'Puedes esperar aquí — se desbloqueará automáticamente en cuanto sea la hora.<br>'+
      '¡Que tengas un excelente día!';
    elBtn.style.display = 'none';
    elCountdown.style.display = 'block';
    _horarioGateCountdownIniciar();
  } else if(estado === 'manana'){
    elIcono.textContent  = '🌅';
    elTitulo.textContent = 'Bienvenida';
    elCuerpo.innerHTML =
      '<div style="font-weight:700;margin-bottom:10px;">¡Buenos días, '+escHTML(nombre)+'!</div>'+
      'Horario de captura vigente:<br>'+
      '🕣 8:30 a. m. - 5:30 p. m.<br>'+
      'Recuerde registrar oportunamente sus movimientos durante la jornada para mantener la información actualizada.<br>'+
      '¡Excelente jornada de trabajo!';
    elBtn.textContent = 'Entendido';
    elBtn.onclick = _horarioGateCerrar;
  } else if(estado === 'tarde'){
    elIcono.textContent  = '☀️';
    elTitulo.textContent = 'Bienvenida';
    elCuerpo.innerHTML =
      '<div style="font-weight:700;margin-bottom:10px;">¡Buenas tardes, '+escHTML(nombre)+'!</div>'+
      'Bienvenido(a) nuevamente al sistema.<br>'+
      'Verifique que los movimientos realizados durante el día se encuentren registrados correctamente antes del cierre de operaciones.';
    elBtn.textContent = 'Entendido';
    elBtn.onclick = _horarioGateCerrar;
  } else {
    elIcono.textContent  = '🌙';
    elTitulo.textContent = 'Horario concluido';
    // A partir de las 7:00 p. m. el saludo cambia a "Buenas noches" (antes de
    // eso, entre 5:30 y 7:00 p. m., se mantiene "Buenas tardes").
    const _saludoCierre = (new Date().getHours() >= 19) ? 'Buenas noches' : 'Buenas tardes';
    elCuerpo.innerHTML =
      '<div style="font-weight:700;margin-bottom:10px;">¡'+_saludoCierre+', '+escHTML(nombre)+'!</div>'+
      'El horario de captura ha concluido.<br>'+
      'El sistema permanece cerrado desde las 5:30 p. m. y la captura de movimientos estará disponible nuevamente en el siguiente horario de operación.';
    elBtn.textContent = 'Cerrar sesión';
    elBtn.onclick = function(){
      // GUARDRAIL: antes se ocultaba el candado (ov.classList.remove) ANTES
      // de preguntar la confirmación de cerrarSesionUsuario() — si el usuario
      // le daba "Cancelar", el candado ya se había quitado y el sistema
      // quedaba desbloqueado sin querer. Ahora se pregunta PRIMERO; si
      // cancela, no se toca el modal y el sistema sigue bloqueado. Si
      // confirma, cerrarSesionUsuario() recarga la página sola (no hace
      // falta ocultar nada aquí: la recarga limpia todo).
      if(typeof cerrarSesionUsuario==='function') cerrarSesionUsuario();
    };
  }
  ov.classList.add('show');
}

function _horarioGateCountdownIniciar(){
  if(_hgCountdownTimer){ clearInterval(_hgCountdownTimer); _hgCountdownTimer = null; }
  const elCountdown = document.getElementById('hg-countdown');
  function tick(){
    const faltan = _minutosDeHHMM(HORARIO_APERTURA_SISTEMA) - _minutosAhora();
    if(faltan <= 0){
      clearInterval(_hgCountdownTimer); _hgCountdownTimer = null;
      _horarioGateCerrar();
      if(typeof toast==='function') toast('🌅 El sistema ya está habilitado — ¡buen inicio de jornada!');
      try{ registrarConexionDiaria(); }catch(e){}
      return;
    }
    if(!elCountdown) return;
    const h = Math.floor(faltan/60), m = faltan % 60;
    elCountdown.textContent = '⏳ Faltan ' + (h>0?h+'h ':'') + m + ' min';
  }
  tick();
  _hgCountdownTimer = setInterval(tick, 15000);
}

function _formatoFaltaTiempo(mins){
  if(mins <= 0) return 'unos momentos';
  if(mins < 60) return mins + ' minuto' + (mins===1?'':'s');
  const h = Math.floor(mins/60), m = mins % 60;
  let txt = h + ' hora' + (h===1?'':'s');
  if(m > 0) txt += ' ' + m + ' min';
  return txt;
}

function _avisoProgramadoMostrar(av){
  const ov = document.getElementById('modal-aviso-programado');
  if(!ov) return;
  const elBorde  = document.getElementById('ap-borde');
  const elTitulo = document.getElementById('ap-titulo');
  const elCuerpo = document.getElementById('ap-cuerpo');
  if(elBorde)  elBorde.style.background = av.color;
  if(elTitulo) elTitulo.textContent = av.titulo;
  if(elCuerpo) elCuerpo.textContent = (typeof av.cuerpo === 'function') ? av.cuerpo() : av.cuerpo;
  ov.classList.add('show');
}

function toast(msg,t='ok'){
  const el=$('toast');el.className='toast '+t;el.textContent=msg;el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),3200);
}

function animarNumero(el, desde, hasta, duracion) {
  const inicio = Date.now();
  const tick = () => {
    const transcurrido = Date.now() - inicio;
    const progreso = Math.min(transcurrido / duracion, 1);
    // Easing cuadrático
    const eased = 1 - Math.pow(1 - progreso, 3);
    const valor = Math.round(desde + (hasta - desde) * eased);
    el.textContent = valor;
    if (progreso < 1) requestAnimationFrame(tick);
    else el.textContent = hasta;
  };
  requestAnimationFrame(tick);
}

function cerrar(id){$(id).classList.remove('show');}

function confirmarBonito(opts) {
  return new Promise(resolve => {
    const o = Object.assign({
      titulo: '¿Estás seguro?',
      mensaje: '',
      btnSi: 'Aceptar',
      btnNo: 'Cancelar',
      peligro: false
    }, opts || {});
    const ov = document.createElement('div');
    ov.className = 'modal-ov show';
    ov.style.zIndex = '99999';
    ov.innerHTML =
      '<div class="modal cb-modal" role="dialog" aria-modal="true">' +
      '  <div class="cb-header ' + (o.peligro ? 'cb-peligro' : '') + '">' +
      '    <h3>' + (o.peligro ? '⚠️ ' : '') + escapeHtml(o.titulo) + '</h3>' +
      '  </div>' +
      '  <div class="cb-body">' + (o.mensaje ? '<p>' + escapeHtml(o.mensaje).replace(/\n/g,'<br>') + '</p>' : '') + '</div>' +
      '  <div class="cb-footer">' +
      '    <button class="btn btn-ghost cb-btn-no" type="button">' + escapeHtml(o.btnNo) + '</button>' +
      '    <button class="btn ' + (o.peligro ? 'btn-danger' : 'btn-primary') + ' cb-btn-si" type="button">' + escapeHtml(o.btnSi) + '</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(ov);
    const cerrarModal = (resultado) => {
      document.removeEventListener('keydown', escListener);
      ov.classList.remove('show');
      setTimeout(() => { try { ov.remove(); } catch(e){ registrarError('catch vacio', e); } }, 200);
      resolve(resultado);
    };
    ov.querySelector('.cb-btn-si').addEventListener('click', () => cerrarModal(true));
    ov.querySelector('.cb-btn-no').addEventListener('click', () => cerrarModal(false));
    ov.addEventListener('click', e => { if (e.target === ov) cerrarModal(false); });
    // Esc para cancelar, Enter para aceptar
    const escListener = e => {
      if (e.key === 'Escape') { e.preventDefault(); cerrarModal(false); }
      else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); cerrarModal(true); }
    };
    document.addEventListener('keydown', escListener);
    // Foco al botón principal
    setTimeout(() => ov.querySelector('.cb-btn-si').focus(), 50);
  });
}

function pedirTexto(opts) {
  return new Promise(resolve => {
    const o = Object.assign({
      titulo: 'Ingresa un valor',
      mensaje: '',
      valorInicial: '',
      placeholder: '',
      btnSi: 'Aceptar',
      btnNo: 'Cancelar',
      validar: null  // función opcional (valor) => string error o null
    }, opts || {});
    const ov = document.createElement('div');
    ov.className = 'modal-ov show';
    ov.style.zIndex = '99999';
    ov.innerHTML =
      '<div class="modal cb-modal" role="dialog" aria-modal="true">' +
      '  <div class="cb-header"><h3>' + escapeHtml(o.titulo) + '</h3></div>' +
      '  <div class="cb-body">' + (o.mensaje ? '<p>' + escapeHtml(o.mensaje) + '</p>' : '') +
      '    <input type="text" class="cb-input" placeholder="' + escapeHtml(o.placeholder) + '" value="' + escapeHtml(o.valorInicial) + '">' +
      '    <div class="cb-error" style="display:none;"></div>' +
      '  </div>' +
      '  <div class="cb-footer">' +
      '    <button class="btn btn-ghost cb-btn-no" type="button">' + escapeHtml(o.btnNo) + '</button>' +
      '    <button class="btn btn-primary cb-btn-si" type="button">' + escapeHtml(o.btnSi) + '</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(ov);
    const inp = ov.querySelector('.cb-input');
    const errEl = ov.querySelector('.cb-error');
    const cerrarModal = (resultado) => {
      document.removeEventListener('keydown', escListener);
      ov.classList.remove('show');
      setTimeout(() => { try { ov.remove(); } catch(e){ registrarError('catch vacio', e); } }, 200);
      resolve(resultado);
    };
    const intentarAceptar = () => {
      const valor = inp.value;
      if (o.validar) {
        const err = o.validar(valor);
        if (err) {
          errEl.textContent = err;
          errEl.style.display = 'block';
          inp.focus();
          return;
        }
      }
      cerrarModal(valor);
    };
    ov.querySelector('.cb-btn-si').addEventListener('click', intentarAceptar);
    ov.querySelector('.cb-btn-no').addEventListener('click', () => cerrarModal(null));
    ov.addEventListener('click', e => { if (e.target === ov) cerrarModal(null); });
    const escListener = e => {
      if (e.key === 'Escape') { e.preventDefault(); cerrarModal(null); }
      else if (e.key === 'Enter' && e.target === inp) { e.preventDefault(); intentarAceptar(); }
    };
    document.addEventListener('keydown', escListener);
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
  });
}

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function cerrarModalesAbiertos() {
  // Cerrar todos los modales con clase .show
  document.querySelectorAll('.modal-ov.show, .modal-overlay.show').forEach(m => {
    m.classList.remove('show');
  });
  // Cerrar dropdown de búsqueda global si está abierto
  const gsRes = document.getElementById('global-search-results');
  if (gsRes) gsRes.classList.remove('show');
}

function mostrarAtajosAyuda() {
  // Generar listado de atajos para mostrar en un modal simple
  const listaHTML = ATAJOS.map(a => {
    const teclas = [];
    if (a.ctrl) teclas.push('Ctrl');
    if (a.alt) teclas.push('Alt');
    if (a.shift) teclas.push('Shift');
    teclas.push(a.tecla.toUpperCase());
    const comboKbd = teclas.map(t => '<kbd style="padding:2px 6px;background:#1a1208;border:1px solid rgba(200,149,42,0.3);border-radius:3px;font-family:JetBrains Mono,monospace;font-size:0.7rem;color:var(--gold-l);">' + t + '</kbd>').join(' + ');
    return '<tr><td style="padding:6px 12px;">' + comboKbd + '</td><td style="padding:6px 12px;color:var(--ink);">' + a.descripcion + '</td></tr>';
  }).join('');
  // Crear modal flotante temporal
  let modal = document.getElementById('modal-atajos');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-atajos';
    modal.className = 'modal-ov';
    modal.innerHTML = 
      '<div class="modal" style="max-width:520px;background:var(--surface);max-height:92vh;display:flex;flex-direction:column;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid var(--border-l);">' +
      '<h3 style="margin:0;font-family:Fraunces,serif;font-size:1.05rem;color:var(--gold-d);">⌨ Atajos de teclado</h3>' +
      '<button onclick="cerrar(\'modal-atajos\')" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--muted);">✕</button>' +
      '</div>' +
      '<div style="padding:6px 0 14px;max-height:60vh;overflow-y:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:0.78rem;">' + listaHTML + '</table>' +
      '<div style="padding:14px 20px 0;font-size:0.7rem;color:var(--muted);font-style:italic;line-height:1.6;">Tip: los atajos no se activan mientras escribes en un campo. <kbd style="padding:1px 5px;background:#1a1208;border:1px solid rgba(200,149,42,0.3);border-radius:3px;font-family:JetBrains Mono,monospace;font-size:0.65rem;color:var(--gold-l);">Esc</kbd> cierra modales.</div>' +
      '</div></div>';
    document.body.appendChild(modal);
  }
  modal.classList.add('show');
}

function setModo(m){
  modo=m;
}

function renderSrvs(){
  const mk=(grid,lista)=>{
    $(grid).innerHTML=lista.map(s=>`<button class="srv${s.e?' egr-btn':''}" onclick='clickSrv(${JSON.stringify(s)})'>
      <span class="sico">${s.ico}</span>
      <span class="snom">${s.nom}</span>
      <span class="sprecio">${s.p>0?'$'+s.p.toLocaleString('es-MX'):'Custom'}</span>
    </button>`).join('');
  };
}

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

function getMovHoy(fechaOverride) {
  const h = fechaOverride || hoy();
  return getAllMovs().filter(m => m.fecha === h);
}

function _monRecalcularTodo(){
  const resultado = document.getElementById('mon-recon-resultado');
  if(!resultado) return;
  resultado.innerHTML = '<div style="text-align:center;padding:16px;color:#7a6840;">⏳ Recalculando…</div>';
  // FIX: todo el cálculo era síncrono y corría en el mismo instante que se
  // pintaba "Recalculando…", así que el navegador nunca llegaba a mostrar ese
  // mensaje y el resultado (si no cambiaba) parecía que el botón no había
  // hecho nada. Se fuerza una pequeña pausa real y se agrega la hora exacta
  // de la verificación para que cada clic muestre evidencia visible de que sí
  // se ejecutó.
  setTimeout(function(){
  try{
    const cortes = (D.cierres||[])
      .filter(function(c){ return c && c.esCorte === true && c.fecha; })
      .sort(function(a,b){ return (a.fecha+'T'+(a.hora||'00:00')).localeCompare(b.fecha+'T'+(b.hora||'00:00')); });
    const horaChk = new Date().toLocaleTimeString('es-MX');
    if(!cortes.length){
      resultado.innerHTML = '<div style="text-align:center;padding:16px;color:#7a6840;">No hay cortes de caja formales (esCorte) todavía para verificar.</div>';
      return;
    }
    if(typeof getSaldoHasta !== 'function'){
      resultado.innerHTML = '<div style="text-align:center;padding:16px;color:#c0161a;">No se encontró la función getSaldoHasta — no se puede recalcular.</div>';
      return;
    }
    const TOL = 1; // tolerancia de $1 por redondeo
    const problemas = [];
    cortes.forEach(function(c){
      const esperado = getSaldoHasta(c.fecha, c.hora);
      const registrado = parseFloat(c.saldoEntregado != null ? c.saldoEntregado : c.saldo) || 0;
      const dif = registrado - esperado;
      if(Math.abs(dif) > TOL){
        problemas.push({fecha:c.fecha, hora:c.hora, esperado:esperado, registrado:registrado, dif:dif});
      }
    });
    if(!problemas.length){
      resultado.innerHTML = '<div style="text-align:center;padding:22px;background:#eef8f0;border:2px solid #4dca6a;border-radius:10px;">'
        + '<div style="font-size:2rem;">✅</div>'
        + '<div style="font-weight:700;color:#1a7a3a;font-size:1rem;margin-top:6px;">Todo cuadra</div>'
        + '<div style="font-size:0.75rem;color:#3a7a4a;margin-top:4px;">Los '+cortes.length+' corte(s) de caja registrados coinciden con la suma real de los movimientos — nada se infló ni se eliminó sin dejar rastro.</div>'
        + '<div style="font-size:0.62rem;color:#5a8a6a;margin-top:8px;">Verificado a las '+esc(horaChk)+'</div>'
        + '</div>';
    } else {
      let html = '<div style="padding:16px;background:#fff0f0;border:2px solid #c0161a;border-radius:10px;">'
        + '<div style="font-weight:700;color:#c0161a;font-size:0.95rem;margin-bottom:8px;">⚠️ '+problemas.length+' discrepancia(s) encontrada(s)</div>';
      problemas.forEach(function(p){
        html += '<div style="font-size:0.76rem;color:#7a2020;padding:6px 0;border-top:1px solid rgba(192,22,26,0.15);">'
          + 'Corte del '+esc(p.fecha)+' '+esc(p.hora)+': se entregó $'+fmt(p.registrado)+', pero los movimientos de ese periodo suman $'+fmt(p.esperado)+' '
          + '— diferencia de <b>$'+fmt(Math.abs(p.dif))+'</b> ('+(p.dif>0?'de más':'de menos')+').'
          + '</div>';
      });
      html += '<div style="font-size:0.62rem;color:#a04040;margin-top:8px;">Verificado a las '+esc(horaChk)+'</div>';
      html += '</div>';
      resultado.innerHTML = html;
    }
  }catch(e){
    resultado.innerHTML = '<div style="text-align:center;padding:16px;color:#c0161a;">Error al recalcular: '+esc(e.message||String(e))+'</div>';
  }
  }, 250);
}

function _csTarjeta(icono, titulo, desc, onclickFn){
  return '<div onclick="'+onclickFn+'" style="cursor:pointer;border:1.5px solid rgba(200,149,42,0.35);'
    + 'border-radius:10px;padding:16px;background:#fff;transition:all 0.15s;" '
    + 'onmouseover="this.style.borderColor=\'#c8952a\';this.style.background=\'#fffaf0\';" '
    + 'onmouseout="this.style.borderColor=\'rgba(200,149,42,0.35)\';this.style.background=\'#fff\';">'
    + '<div style="font-size:1.6rem;margin-bottom:6px;">'+icono+'</div>'
    + '<div style="font-weight:700;color:#3a2a10;margin-bottom:4px;">'+titulo+'</div>'
    + '<div style="font-size:0.72rem;color:#7a6840;line-height:1.4;">'+desc+'</div>'
    + '</div>';
}

function _carpObsArray(c){
  let lista = [];
  if(Array.isArray(c.obsLista) && c.obsLista.length){
    lista = c.obsLista
      .map(item => (item && typeof item === 'object') ? { texto:String(item.texto||''), fecha:String(item.fecha||'') } : { texto:String(item||''), fecha:'' })
      .filter(o => o.texto.trim() !== '');
  } else if(c.obs && String(c.obs).trim()!==''){
    lista = [{ texto:String(c.obs), fecha:'' }];
  }
  if(c.descripcion && String(c.descripcion).trim()!==''){
    lista = [{ texto:String(c.descripcion), fecha:_fechaCorta(c.fechaCreacion) }, ...lista];
  }
  return lista;
}

function _carpObsHtmlEnum(c){
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  const lista = _carpObsArray(c);
  if(!lista.length) return '';
  return '<ol style="margin:0;padding-left:18px;">' + lista.map(o=>
    '<li style="margin-bottom:6px;line-height:1.5;text-align:justify;">'+esc2(o.texto)
    + (o.fecha ? ' <span style="font-family:monospace;font-size:0.6rem;color:#0e6a7c;white-space:nowrap;font-weight:600;">— 📅 '+esc2(o.fecha)+'</span>' : '')
    + '</li>'
  ).join('') + '</ol>';
}

function _dObsRender(){
  const box = document.getElementById('mCarpDetBox');
  if(!box) return;
  if(!_dObsState.length) _dObsState = [{ texto:'' }];
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  if(!_dObsEditMode){
    // Modo consulta: solo lectura, sin textareas — cero riesgo de tocar el
    // texto sin querer. Se edita solo tras pulsar "✏️ Editar notas".
    const conTexto = _dObsState.filter(o => String((o&&o.texto)||'').trim()!=='');
    box.innerHTML = conTexto.length
      ? conTexto.map((o,i) =>
          '<div style="display:flex;gap:10px;'+(i>0?'margin-top:12px;padding-top:12px;border-top:1px solid #ecdfa8;':'')+'">'
          +   '<span style="flex-shrink:0;color:#0e6a7c;font-family:monospace;font-size:0.85rem;font-weight:700;">'+(i+1)+'.</span>'
          +   '<p style="font-size:0.85rem;line-height:1.6;margin:0;color:#1a1008;text-align:justify;">'+esc2(o.texto)+'</p>'
          + '</div>'
        ).join('')
      : '<div style="color:#a08858;font-style:italic;font-size:0.85rem;">Sin observaciones registradas.</div>';
    _dObsSyncBoton();
    return;
  }
  box.innerHTML = _dObsState.map((item, i) => {
    const txt = (item && item.texto) || '';
    return '<div style="display:flex;gap:12px;align-items:flex-start;'+(i>0?'margin-top:16px;padding-top:16px;border-top:2px solid #e0d4a8;':'')+'">'
      +   '<div style="flex-shrink:0;color:#0e6a7c;font-family:monospace;font-size:0.95rem;font-weight:700;margin-top:2px;">'+(i+1)+'.</div>'
      +   '<textarea rows="1" data-dobs-i="'+i+'" oninput="_dObsActualizar('+i+',this.value);_dObsAutoGrow(this)" placeholder="'+(i===0?'Nota principal para uso interno del despacho...':'Otra observación...')+'" style="flex:1;min-width:0;border:none;outline:none;resize:none;overflow:hidden;font-family:sans-serif;font-size:0.92rem;line-height:1.6;color:#1a1008;background:transparent;text-align:justify;box-sizing:border-box;">'+esc2(txt)+'</textarea>'
      + '</div>';
  }).join('');
  // Cada textarea crece con su contenido — nunca hay que arrastrar ni
  // hacer scroll para ver el texto completo de una observación.
  box.querySelectorAll('textarea[data-dobs-i]').forEach(_dObsAutoGrow);
  _dObsSyncBoton();
}

function _dObsAutoGrow(el){
  if(!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function _dObsActualizar(i, val){
  if(!_dObsState[i]) _dObsState[i] = { texto:'' };
  _dObsState[i].texto = val;
  // Ya no hay botón "✕": cualquier nota (incluida la #1) se quita sola en
  // cuanto se borra todo su texto; si no queda ninguna, _dObsRender() deja
  // un renglón #1 en blanco listo para escribir.
  if(val.trim() === ''){
    _dObsState.splice(i,1);
    _dObsRender();
  }
}

function _dObsAgregar(){
  _dObsState.push({ texto:'' });
  _dObsRender();
  const box = document.getElementById('mCarpDetBox');
  const nuevas = box ? box.querySelectorAll('textarea') : [];
  const last = nuevas[nuevas.length-1];
  if(last) last.focus();
}

function fmtCarpNumHTML(num){
  const n = num || '—';
  const m = /^(CARP\.-\s*|ARCH-0*)(\d+)$/.exec(n);
  if(!m) return esc(n);
  const prefijo = m[1].indexOf('CARP.-')===0 ? 'CARP.- ' : 'ARCH-';
  return esc(prefijo)+'<b style="color:#000;font-weight:700;font-size:1.12em;">'+esc(m[2])+'</b>';
}

function _fechaHoyCorta(){
  const h = new Date();
  return String(h.getDate()).padStart(2,'0')+'/'+String(h.getMonth()+1).padStart(2,'0')+'/'+h.getFullYear();
}

function _fechaCorta(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d.getTime())) return '';
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
}

function _kObsRender(){
  const cont = document.getElementById('kObsLista');
  if(!cont) return;
  if(!_kObsState.length) _kObsState = [{ texto:'', fecha:'' }];
  cont.innerHTML = _kObsState.map((item, i) => {
    const puedeQuitar = i > 0;
    const txt = (item && item.texto) || '';
    const fecha = (item && item.fecha) || '';
    return '<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">'
      +   '<div style="flex-shrink:0;color:#0e6a7c;font-family:monospace;font-size:0.8rem;font-weight:700;margin-top:9px;">'+(i+1)+'.</div>'
      +   '<div style="flex:1;min-width:0;">'
      +     '<textarea rows="1" data-kobs-i="'+i+'" oninput="_kObsActualizar('+i+',this.value);_kObsAutoGrow(this)" placeholder="'+(i===0?'Nota principal para uso interno del despacho...':'Otra observación...')+'" style="width:100%;border:2px solid #d4b870;border-radius:10px;padding:8px 10px;font-family:sans-serif;font-size:0.85rem;color:#1a1008;background:#fff;outline:none;transition:border-color 0.2s;resize:none;overflow:hidden;box-sizing:border-box;text-align:justify;" onfocus="this.style.borderColor=&#39;#c8952a&#39;" onblur="this.style.borderColor=&#39;#d4b870&#39;">'+txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</textarea>'
      +     (fecha ? '<div style="font-size:0.6rem;color:#0e6a7c;margin-top:3px;font-family:monospace;font-weight:600;">📅 Registrada el '+fecha+'</div>' : '')
      +   '</div>'
      +   (puedeQuitar ? '<button type="button" onclick="_kObsQuitar('+i+')" title="Quitar esta observación" style="flex-shrink:0;margin-top:6px;width:24px;height:24px;border-radius:50%;border:1px solid #e0b0b0;background:#fdf0f0;color:#a32d2d;cursor:pointer;font-size:0.72rem;line-height:1;">✕</button>' : '<div style="width:24px;flex-shrink:0;"></div>')
      + '</div>';
  }).join('');
  // Cada textarea crece con su contenido — nunca hay que arrastrar ni
  // hacer scroll para ver el texto completo de una observación.
  cont.querySelectorAll('textarea[data-kobs-i]').forEach(_kObsAutoGrow);
}

function _kObsAutoGrow(el){
  if(!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

function _kObsAgregar(){
  _kObsState.push({ texto:'', fecha:'' });
  _kObsRender();
  const cont = document.getElementById('kObsLista');
  const nuevas = cont ? cont.querySelectorAll('textarea') : [];
  const last = nuevas[nuevas.length-1];
  if(last) last.focus();
}

function _kObsQuitar(i){
  if(i <= 0) return;
  _kObsState.splice(i,1);
  _kObsRender();
}

function _juCatalogoPlazos(){
  if(typeof D === 'undefined') return _JU_PLAZOS_BASE;
  if(!Array.isArray(D.catalogoPlazos) || !D.catalogoPlazos.length) D.catalogoPlazos = _JU_PLAZOS_BASE.slice();
  return D.catalogoPlazos;
}

function _juInhabilesExtra(){
  if(typeof D === 'undefined') return [];
  if(!Array.isArray(D.diasInhabiles)) D.diasInhabiles = [];
  return D.diasInhabiles;
}

function _juEsHabil(iso){
  if(!iso) return false;
  const d = new Date(iso + 'T12:00:00');
  if(isNaN(d)) return false;
  const dow = d.getDay();
  if(dow === 0 || dow === 6) return false;                 // domingo / sábado
  if(_JU_INHABILES_BASE.includes(iso.slice(5))) return false; // feriado fijo
  if(_juInhabilesExtra().includes(iso)) return false;      // inhábil capturado
  return true;
}

function _juISO(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function _juCalcVencimiento(fechaNotif, dias, habiles){
  const n = parseInt(dias, 10);
  if(!fechaNotif || !n || n < 1) return '';
  const d = new Date(fechaNotif + 'T12:00:00');
  if(isNaN(d)) return '';
  if(!habiles){
    d.setDate(d.getDate() + n);
    return _juISO(d);
  }
  let contados = 0, guarda = 0;
  while(contados < n && guarda < 400){
    d.setDate(d.getDate() + 1);
    guarda++;
    if(_juEsHabil(_juISO(d))) contados++;
  }
  return _juISO(d);
}

function _juEtapas(j){
  const mapa = (typeof D !== 'undefined' && D.etapasPorTipo) || {};
  const porTipo = mapa[(j && j.tipo) || ''];
  if(Array.isArray(porTipo) && porTipo.length) return porTipo;
  return _JU_ETAPAS_BASE;
}

function _juEtapaActual(j){
  const etapas = _juEtapas(j);
  const i = etapas.indexOf(j && j.etapa);
  return i >= 0 ? i : 0;
}

function _juPillEstatus(j, idx){
  const est = (j && j.estatus) || 'proceso';
  const cfg = {
    urgente:   { txt:'🔴 Urgente',    bg:'var(--rojo-l)',     col:'#8a0f12', bd:'#e8a0a0' },
    proceso:   { txt:'🟡 En Proceso', bg:'var(--amarillo-l)', col:'#7a4010', bd:'#e0c07a' },
    estable:   { txt:'🟢 Estable',    bg:'var(--verde-l)',    col:'#0a4020', bd:'#8fd6aa' },
    concluido: { txt:'⚫ Concluido',  bg:'#eee9dd',           col:'#5a5040', bd:'#d8d0bd' },
    inicio:    { txt:'🔵 Inicio',     bg:'var(--azul-l)',     col:'#123a70', bd:'#a8c2e6' }
  }[est] || { txt: est, bg:'#eee9dd', col:'#5a5040', bd:'#d8d0bd' };
  return '<span onclick="event.stopPropagation();abrirJuicioEdit(' + idx + ')"'
    + ' title="Cambiar estatus del expediente"'
    + ' style="display:inline-block;font-family:monospace;font-size:.6rem;font-weight:500;'
    + 'padding:2px 9px;border-radius:11px;white-space:nowrap;cursor:pointer;'
    + 'background:' + cfg.bg + ';color:' + cfg.col + ';border:1px solid ' + cfg.bd + ';">'
    + cfg.txt + '</span>';
}

function switchJTab(tab,el){
  document.querySelectorAll('.jdet-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.jdet-panel').forEach(p=>p.classList.remove('active'));
  if(el)el.classList.add('active');
  $('jtab-'+tab).classList.add('active');
}

function _juLlenarCatalogoPlazos(){
  const sel = document.getElementById('trPlazoCat');
  if(!sel || sel.dataset.listo === '1') return;
  const cat = _juCatalogoPlazos();
  sel.innerHTML = '<option value="">— Elegir —</option>' + cat.map((p,i) =>
    '<option value="'+i+'">' + p.nombre + (p.dias ? ' · '+p.dias+(p.habiles?' háb.':' nat.') : '') + '</option>'
  ).join('');
  sel.dataset.listo = '1';
}

function _juPlazoCatCambio(){
  const sel = document.getElementById('trPlazoCat');
  if(!sel || sel.value === '') return;
  const p = _juCatalogoPlazos()[parseInt(sel.value,10)];
  if(!p) return;
  if(p.dias){
    const dEl = document.getElementById('trDias'); if(dEl) dEl.value = p.dias;
    const hEl = document.getElementById('trHabiles'); if(hEl) hEl.value = p.habiles ? '1' : '0';
  }
  // Si la descripción está vacía se propone el nombre del plazo.
  const dsc = document.getElementById('trDesc');
  if(dsc && !dsc.value.trim() && p.nombre !== 'Personalizado') dsc.value = p.nombre;
  _juRecalcularVenc();
}

function _juRecalcularVenc(){
  const out   = document.getElementById('trCalcResultado');
  const notif = (document.getElementById('trNotif')||{}).value || '';
  const dias  = (document.getElementById('trDias')||{}).value || '';
  const hab   = ((document.getElementById('trHabiles')||{}).value || '1') === '1';
  if(!out) return;
  if(!notif || !dias){
    out.textContent = 'Elige un plazo y la fecha de notificación para calcular.';
    out.style.color = 'var(--muted)';
    return;
  }
  const venc = _juCalcVencimiento(notif, dias, hab);
  if(!venc){
    out.textContent = 'No se pudo calcular con esos datos.';
    out.style.color = 'var(--rojo)';
    return;
  }
  const fEl = document.getElementById('trFecha');
  if(fEl) fEl.value = venc;                      // se escribe en la fecha oficial
  const est = _juEstadoTermino({ fecha: venc, cumplido:false });
  out.innerHTML = '✓ Vence el <b style="color:'+est.color+'">' + venc + '</b> · ' + est.texto
    + (hab ? ' <span style="opacity:.7;">(sin contar sábados, domingos ni días inhábiles)</span>'
           : ' <span style="opacity:.7;">(días naturales)</span>');
  out.style.color = 'var(--ink)';
}

function setPF(f,el){
  // Filter locked to 'activos' — filter bar removed
  filtroP = 'activos';
  renderPend();
}

function verPendResueltos(){
  const btn = $('pendBtnResueltos');
  const btnVaciar = $('pendBtnVaciarResueltos');
  if(filtroP === 'resuelto'){
    filtroP = 'activos';
    if(btn){ btn.textContent = '✓ Resueltos'; btn.style.background='var(--surface)'; btn.style.color='var(--muted)'; }
    if(btnVaciar) btnVaciar.style.display = 'none';
  } else {
    filtroP = 'resuelto';
    if(btn){ btn.textContent = '← Activos'; btn.style.background='var(--gold-d)'; btn.style.color='#fff'; }
    if(btnVaciar) btnVaciar.style.display = '';
  }
  renderPend();
}

function _seccionDe(p){
  return p.seccion || _inferirSeccion(p.categoria);
}

function _pendDiasAbierto(p, hoyStr){
  if(!p || !p.fechaCreacion) return 0;
  const f = String(p.fechaCreacion).slice(0,10);
  const t1 = new Date(f+'T00:00:00').getTime();
  const t2 = new Date(String(hoyStr).slice(0,10)+'T00:00:00').getTime();
  if(isNaN(t1) || isNaN(t2)) return 0;
  return Math.max(0, Math.floor((t2-t1)/86400000));
}

function _pendInyectarEstiloEnvio(){
  if(_pendEstiloEnvioListo) return;
  _pendEstiloEnvioListo = true;
  const css = '@keyframes _pendEnvioTrazo{to{stroke-dashoffset:0;}}'
    + '@keyframes _pendEnvioVuelo{0%{left:4%;top:62%;transform:rotate(-6deg);}100%{left:52%;top:16%;transform:rotate(8deg);}}'
    + '@keyframes _pendEnvioTexto{0%{opacity:0;transform:translateX(-6px);}25%{opacity:1;transform:translateX(0);}82%{opacity:1;}100%{opacity:0;}}'
    + '@keyframes _pendEnvioFade{0%{opacity:1;}80%{opacity:1;}100%{opacity:0;}}'
    + '._pend-envio-overlay{position:absolute;inset:0;background:rgba(253,250,244,0.96);pointer-events:none;overflow:hidden;z-index:6;animation:_pendEnvioFade 1.9s ease forwards;}'
    + '._pend-envio-trail{position:absolute;left:5%;top:6%;width:42%;height:80%;}'
    + '._pend-envio-trail path{fill:none;stroke:#26265c;stroke-width:2.5;stroke-dasharray:7 8;stroke-dashoffset:400;stroke-linecap:round;animation:_pendEnvioTrazo 1.15s ease forwards;}'
    + '._pend-envio-avion{position:absolute;width:26px;height:26px;animation:_pendEnvioVuelo 1.15s ease forwards;}'
    + '._pend-envio-texto{position:absolute;left:56%;top:34%;font-family:serif;font-style:italic;font-weight:700;font-size:14px;color:#c8951a;opacity:0;animation:_pendEnvioTexto 1.7s ease 0.35s forwards;white-space:nowrap;}';
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

function _pendAnimarEnvio(idx, cb){
  _pendInyectarEstiloEnvio();
  const card = document.querySelector('[data-pend-idx="'+idx+'"]');
  if(!card){ if(cb) cb(); return; }
  card.style.position = 'relative';
  const overlay = document.createElement('div');
  overlay.className = '_pend-envio-overlay';
  overlay.innerHTML =
    '<svg class="_pend-envio-trail" viewBox="0 0 400 90" preserveAspectRatio="none"><path d="M10,70 Q120,10 300,35"/></svg>'
    + '<svg class="_pend-envio-avion" viewBox="0 0 24 24"><defs><linearGradient id="_pendPlaneGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffd166"/><stop offset="100%" stop-color="#f2994a"/></linearGradient></defs><path d="M2 12L22 2L14 22L11 14L2 12Z" fill="url(#_pendPlaneGrad)"/></svg>'
    + '<span class="_pend-envio-texto">Trámite enviado...</span>';
  card.appendChild(overlay);
  setTimeout(function(){ overlay.remove(); if(cb) cb(); }, 1900);
}

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

function _docZoom(dir){
  const steps = _DOC_ZOOM_STEPS;
  let i = steps.indexOf(window._docZoomLevel);
  if (i === -1) i = steps.indexOf(1);
  i = Math.max(0, Math.min(steps.length - 1, i + dir));
  window._docZoomLevel = steps[i];
  // Reset pan cuando vuelve a 100%
  if (window._docZoomLevel === 1) window._docPanOffset = { x:0, y:0 };
  _docZoomApply();
}

function _docZoomReset(){
  window._docZoomLevel  = 1;
  window._docPanOffset  = { x:0, y:0 };
  _docZoomApply();
}

function _docZoomApply(){
  const img  = document.getElementById('docPreviewImg');
  const cont = document.getElementById('docPreviewContenido');
  const z    = window._docZoomLevel;
  const { x, y } = window._docPanOffset;
  if (img) {
    img.style.transform  = 'translate('+x+'px,'+y+'px) scale('+z+')';
    img.style.maxWidth   = z > 1 ? 'none' : '100%';
    img.style.maxHeight  = z > 1 ? 'none' : '65vh';
    img.style.transition = 'transform 0.15s ease';
  }
  // Cursor: manita cuando hay zoom, normal cuando es 1:1
  if (cont) cont.style.cursor = z > 1 ? 'grab' : 'default';
  _docZoomUpdateLabel();
}

function _docZoomUpdateLabel(){
  const lbl = document.getElementById('docZoomLabel');
  if (lbl) lbl.textContent = Math.round(window._docZoomLevel * 100) + '%';
}

function _docPanInit(cont){
  let dragging = false, startX, startY, originX, originY;
  cont.addEventListener('mousedown', function(e){
    if (window._docZoomLevel <= 1) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    originX = window._docPanOffset.x; originY = window._docPanOffset.y;
    cont.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window.addEventListener('mousemove', function(e){
    if (!dragging) return;
    window._docPanOffset.x = originX + (e.clientX - startX);
    window._docPanOffset.y = originY + (e.clientY - startY);
    const img = document.getElementById('docPreviewImg');
    if (img) {
      const z = window._docZoomLevel;
      img.style.transition = 'none';
      img.style.transform  = 'translate('+window._docPanOffset.x+'px,'+window._docPanOffset.y+'px) scale('+z+')';
    }
  });
  window.addEventListener('mouseup', function(){
    if (!dragging) return;
    dragging = false;
    const cont2 = document.getElementById('docPreviewContenido');
    if (cont2) cont2.style.cursor = window._docZoomLevel > 1 ? 'grab' : 'default';
  });
  // Touch (móvil)
  let touchStart = null, touchOrigin = null;
  cont.addEventListener('touchstart', function(e){
    if (window._docZoomLevel <= 1 || e.touches.length !== 1) return;
    touchStart  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchOrigin = { x: window._docPanOffset.x, y: window._docPanOffset.y };
  }, { passive:true });
  cont.addEventListener('touchmove', function(e){
    if (!touchStart || e.touches.length !== 1) return;
    window._docPanOffset.x = touchOrigin.x + (e.touches[0].clientX - touchStart.x);
    window._docPanOffset.y = touchOrigin.y + (e.touches[0].clientY - touchStart.y);
    const img = document.getElementById('docPreviewImg');
    const z   = window._docZoomLevel;
    if (img) { img.style.transition='none'; img.style.transform='translate('+window._docPanOffset.x+'px,'+window._docPanOffset.y+'px) scale('+z+')'; }
    e.preventDefault();
  }, { passive:false });
  cont.addEventListener('touchend', function(){ touchStart = null; });
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
    // Fecha estable en la esquina superior derecha del encabezado
    // (formato: "Lunes 03 agosto 2026"). El reloj ya vive abajo a la
    // izquierda (sidebar), no se repite aquí.
    var elTopFecha=document.getElementById('topbar-fecha-txt');
    if(elTopFecha) elTopFecha.textContent = dias[d.getDay()]+' '+String(d.getDate()).padStart(2,'0')+' '+meses[d.getMonth()]+' '+d.getFullYear();
    // Sincronizar hora en panel de recibo (tiempo real)
    var elHoraRecibo=document.getElementById('hora_recibo_display');
    var elHoraHidden=$('hora_recibo');
    var elFechaHidden=$('fecha_recibo');
    var elFechaDisplay=document.getElementById('fecha_recibo_display');
    var esRetroActivo = !!window._reciboRetroactivoActivo;
    var esFrozen = document.body.classList.contains('recibo-frozen');
    var esEdicionCompleta = document.body.classList.contains('modo-edicion-completa');
    if(esRetroActivo) {
      // Modo retroactivo — hora y fecha CONGELADAS, color morado
      if(elHoraRecibo) {
        // Solo actualizar el texto si no está ya fijo (para no parpadear)
        const horaFija = elHoraHidden?.value || hh+':'+mm;
        if(elHoraRecibo.textContent !== horaFija+' hrs.') elHoraRecibo.textContent = horaFija+' hrs.';
        elHoraRecibo.style.color = '#8b5cf6';
        elHoraRecibo.style.fontWeight = '700';
      }
      if(elFechaDisplay) {
        elFechaDisplay.style.color = '#8b5cf6';
        elFechaDisplay.style.fontWeight = '700';
      }
      // NO actualizar hora hidden — se congela con el valor que el usuario eligió
    } else if(!esFrozen && !esEdicionCompleta) {
      // Modo normal — hora en tiempo real
      if(elHoraRecibo) {
        elHoraRecibo.textContent = hh+':'+mm+' hrs.';
        elHoraRecibo.style.color = '';
        elHoraRecibo.style.fontWeight = '';
      }
      if(elHoraHidden) elHoraHidden.value = hh+':'+mm;
      if(elFechaDisplay) {
        elFechaDisplay.style.color = '';
        elFechaDisplay.style.fontWeight = '';
      }
      if(elFechaHidden && !elFechaHidden.value){
        const yyyy=d.getFullYear(),mo=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');
        elFechaHidden.value=yyyy+'-'+mo+'-'+dd;
      }
      if(elFechaDisplay && !elFechaDisplay.textContent.trim()){
        const fd=new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
        elFechaDisplay.textContent=fd.charAt(0).toUpperCase()+fd.slice(1);
      }
    }
  }catch(e){ registrarError('catch vacio', e); }
}

function setBadge(ok){
  actualizarAmbossBadges(ok);
}

function lexRealtimeDesconectar() {
  if (_lexRealtimeChannel) {
    window.SB.removeChannel(_lexRealtimeChannel);
    _lexRealtimeChannel = null;
    console.log('[Realtime] Desconectado');
  }
  if (_lexPollingTimer) { clearInterval(_lexPollingTimer); _lexPollingTimer = null; }
}

function lexPollingIniciar() {
  if (_lexPollingTimer) return; // ya iniciado
  _lexPollingTimer = setInterval(_lexPollingTick, _LEX_POLLING_MS);
  console.log('[Polling] Respaldo activo cada ' + (_LEX_POLLING_MS/1000) + 's');
}

function parsePrecioR(v) {
  if (!v) return 0;
  return parseFloat(String(v).replace(/[^0-9.]/g,'')) || 0;
}

function formatPrecioR(n) {
  return '$' + Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
}

function getQRDataURL() {
  return new Promise(function(resolve) {
    var canvas = document.querySelector('#r-qr-preview canvas');
    if (canvas) { resolve(canvas.toDataURL('image/png')); return; }
    var img = document.querySelector('#r-qr-preview img');
    if (img) { resolve(img.src); return; }
    resolve(null);
  });
}

function dashActualizarIndicadores(){
  // Fecha y hora
  var ahora = new Date();
  var dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var fechaTxt = dias[ahora.getDay()] + ', ' + ahora.getDate() + ' ' + meses[ahora.getMonth()] + ' ' + ahora.getFullYear();
  var horaTxt = String(ahora.getHours()).padStart(2,'0') + ':' + String(ahora.getMinutes()).padStart(2,'0') + ':' + String(ahora.getSeconds()).padStart(2,'0');
  var elFecha = document.getElementById('dash-fecha');
  var elHora = document.getElementById('dash-hora');
  if(elFecha) elFecha.textContent = fechaTxt.toUpperCase();
  if(elHora) elHora.textContent = horaTxt;
  // Estado de Drive
  var driveOk = (typeof sbSession !== 'undefined') && sbSession && (Date.now() < sbExpiry);
  var elDrv = document.getElementById('dash-drive-status');
  var elDrvI = document.getElementById('dash-drive-info');
  if(elDrv){
    if(driveOk){
      elDrv.textContent = '🟢 Conectado';
      elDrv.style.color = '#1a7a3a';
      var minRest = Math.round((sbExpiry - Date.now()) / 60000);
      if(elDrvI) elDrvI.textContent = 'Token: ~' + minRest + ' min restantes';
    } else {
      elDrv.textContent = '🔴 Desconectado';
      elDrv.style.color = '#c0161a';
      if(elDrvI) elDrvI.textContent = 'Sin sesión activa';
    }
  }
  // Estado de Sync con Sheets
  var elSyn = document.getElementById('dash-sync-status');
  var elSynI = document.getElementById('dash-sync-info');
  if(elSyn){
  var activo = true;
    var cola = (typeof syncQueue !== 'undefined') ? syncQueue.length : 0;
    if(activo){
      elSyn.textContent = '🟢 Activo';
      elSyn.style.color = '#1a4a8a';
    } else {
      elSyn.textContent = '⏸ Pausado';
      elSyn.style.color = '#8c6518';
    }
    if(elSynI) elSynI.textContent = cola + ' en cola pendientes';
  }
  // Estado de Caja
  var elCaja = document.getElementById('dash-caja-status');
  var elCajaI = document.getElementById('dash-caja-info');
  if(elCaja){
    var bloq = (typeof cajaBloqueada === 'function') ? cajaBloqueada() : false;
    if(bloq){
      elCaja.textContent = '🔒 Cerrada';
      elCaja.style.color = '#c0161a';
      if(elCajaI) elCajaI.textContent = 'Cerrada para hoy';
    } else {
      elCaja.textContent = '🔓 Abierta';
      elCaja.style.color = '#1a7a3a';
      if(elCajaI){
        var hh = (typeof hoy === 'function') ? hoy() : '';
        var movHoy = (D.movimientos||[]).filter(function(m){return m.fecha===hh;}).length;
        elCajaI.textContent = movHoy + ' movs. hoy';
      }
    }
  }
  // Saldo de caja
  var elSaldo = document.getElementById('dash-saldo-caja');
  var elSaldoI = document.getElementById('dash-saldo-info');
  if(elSaldo){
    try {
      var saldo = (typeof getSaldo === 'function') ? getSaldo() : 0;
      var fmtSaldo = '$' + Math.abs(saldo).toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
      if(saldo < 0) fmtSaldo = '-' + fmtSaldo;
      elSaldo.textContent = fmtSaldo;
      elSaldo.style.color = saldo < 0 ? '#c0161a' : (saldo === 0 ? '#8c6518' : '#1a7a3a');
      if(elSaldoI){
        var ultCierre = (D.cierres||[]).slice(-1)[0];
        elSaldoI.textContent = ultCierre ? ('Ult. cierre: ' + ultCierre.fecha) : 'Sin cierres aún';
      }
    } catch(e){ elSaldo.textContent = '—'; }
  }
  // Info de sesión
  var elSes = document.getElementById('cfg-sesion-info');
  if(elSes){
    var em = (typeof empNombre === 'function') ? empNombre() : '';
    var correo = localStorage.getItem('user_email') || '';
    elSes.textContent = (correo || '—') + (em ? ' · ' + em : '');
  }
}

function abrirPanelBackups() {
  var panel = document.getElementById('cfg-backups-panel');
  if (!panel) return;
  panel.style.display = 'block';
  renderBackupsList();
}

function selEstadoTen(estado, btn){
  if(estado==='__otro__'){
    document.getElementById('ten-select-otro').style.display='block';
    document.querySelectorAll('#ten-estados-rapidos .estado-pill').forEach(function(b){b.classList.remove('sel');});
    btn.classList.add('sel');
    return;
  }
  document.getElementById('ten-select-otro').style.display='none';
  document.querySelectorAll('#ten-estados-rapidos .estado-pill').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  _tenEstado=estado;
  var el=document.getElementById('ten-estado-seleccionado');
  el.style.display='block';
  document.getElementById('ten-estado-txt').textContent=estado;
  calcTenTotal();
}

function selEstadoTenOtro(val){
  if(!val)return;
  _tenEstado=val;
  var el=document.getElementById('ten-estado-seleccionado');
  el.style.display='block';
  document.getElementById('ten-estado-txt').textContent=val;
  calcTenTotal();
}

function toggleTenExtra(wrapId){
  var wrap=document.getElementById(wrapId);
  var chkId=wrapId.replace('-wrap','-chk');
  var chk=document.getElementById(chkId);
  wrap.style.display=chk.checked?'flex':'none';
  calcTenTotal();
}

function adjTen(id,d){
  var el=document.getElementById(id);
  var v=parseInt(el.value||1)+d;
  if(v<1)v=1;
  el.value=v;
  calcTenTotal();
}

function calcTenTotal(){
  var precio=toNumero(document.getElementById('ten-precio').value,0);
  var cant=toEntero(document.getElementById('ten-cant').value,1);
  document.getElementById('ten-total').textContent='$'+fmt(precio*cant);
}

function abrirPanelCSF(){
  document.getElementById('csf-nombre').value='';
  document.getElementById('csf-precio').value='550';
  calcCSFTotal();
  document.getElementById('mCSF').classList.add('show');
}

function calcCSFTotal(){
  var total=parseFloat(document.getElementById('csf-precio').value)||0;
  document.getElementById('csf-total').textContent='$'+fmt(total);
}

function registrarCSFCarrito(){
  var nombre=document.getElementById('csf-nombre').value.trim();
  var precio=toNumero(document.getElementById('csf-precio').value,0);
  if(precio<=0){toast('El total debe ser mayor a $0','err');return;}
  var desc='Constancia Situación Fiscal'+(nombre?' — '+nombre:'');
  agregarAlCarrito(desc,precio,'gobierno');
  cerrar('mCSF');
  var msg=encodeURIComponent('Constancia de Situación Fiscal'+(nombre?' — '+nombre:''));
  var w=window.open('','_blank');
  if(w){w.location.href='https://wa.me/'+RC_WA_NUM+'?text='+msg;}
  toast('🛒 Carrito — '+desc);
}

function abrirLogin(){
  document.getElementById('mLogin').classList.add('show');
}

function updateCarritoBadge(){
  var total=CARRITO.reduce(function(s,i){return s+i.total;},0);
  var btn=document.getElementById('carritoFloating');
  var cnt=document.getElementById('carritoCnt');
  var tot=document.getElementById('carritoTotal');
  if(CARRITO.length>0){
    btn.classList.add('visible');
    if(cnt)cnt.textContent=CARRITO.length;
    if(tot)tot.textContent='$'+fmt(total);
  } else {
    btn.classList.remove('visible');
  }
}

function agregarAlCarrito(desc,monto,cat){
  CARRITO.push({desc:desc,total:monto,cat:cat||'otro'});
  updateCarritoBadge();
  toast('🛒 Agregado al carrito: '+desc);
}

function abrirCarrito(){
  renderCarrito();
  document.getElementById('mCarrito').classList.add('show');
}

function renderCarrito(){
  var lista=document.getElementById('carrito-lista');
  var vacio=document.getElementById('carrito-vacio');
  var totalEl=document.getElementById('carrito-total');
  if(!CARRITO.length){
    lista.innerHTML='';
    vacio.style.display='block';
    totalEl.textContent='$0.00';
    return;
  }
  vacio.style.display='none';
  var total=0;
  lista.innerHTML=CARRITO.map(function(item,i){
    total+=item.total;
    return '<div class="carrito-item">'+
      '<span class="carrito-item-nom">'+esc(item.desc)+'</span>'+
      '<span class="carrito-item-precio">$'+fmt(item.total)+'</span>'+
      '<button onclick="quitarCarritoItem('+i+')" style="width:22px;height:22px;border:1px solid var(--rojo-l);border-radius:4px;cursor:pointer;font-size:0.8rem;color:var(--rojo);background:var(--rojo-l);">✕</button>'+
    '</div>';
  }).join('');
  totalEl.textContent='$'+fmt(total);
}

function quitarCarritoItem(i){
  CARRITO.splice(i,1);
  renderCarrito();
  updateCarritoBadge();
}

function _agruparCarritoDescs(items){
  var grupos = [];
  var indice = {};
  items.forEach(function(it){
    var clave = it.desc + '|' + it.total;
    if(Object.prototype.hasOwnProperty.call(indice, clave)){
      grupos[indice[clave]].cant++;
    } else {
      indice[clave] = grupos.length;
      grupos.push({ desc: it.desc, unit: it.total, cant: 1 });
    }
  });
  return grupos.map(function(g){
    if(g.cant > 1){
      return g.cant+'× '+g.desc+' $'+fmt(g.unit)+' c/u $'+fmt(g.unit*g.cant);
    }
    return g.desc+' $'+fmt(g.unit);
  }).join(' | ');
}

function abrirCopias(){
  document.getElementById('copias-precio').value='2';
  document.getElementById('copias-cant').value='1';
  _copiaTipo='bn';
  selCopia('bn',document.getElementById('copiaBtn-bn'));
  calcCopiaTotal();
  document.getElementById('mCopias').classList.add('show');
}

function selCopia(tipo,btn){
  _copiaTipo=tipo;
  document.querySelectorAll('.copia-tipo-btn').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  var precio=tipo==='bn'?2:5;
  document.getElementById('copias-precio').value=precio;
  calcCopiaTotal();
}

function adjCopias(d){
  var el=document.getElementById('copias-cant');
  var v=parseInt(el.value||1)+d;if(v<1)v=1;el.value=v;calcCopiaTotal();
}

function calcCopiaTotal(){
  var p=parseFloat(document.getElementById('copias-precio').value)||0;
  var c=parseInt(document.getElementById('copias-cant').value)||1;
  document.getElementById('copias-total').textContent='$'+fmt(p*c);
}

function registrarCopiasCarrito(){
  var precio=toNumero(document.getElementById('copias-precio').value,0);
  var cant=toEntero(document.getElementById('copias-cant').value,1);
  var total=precio*cant;
  if(total<=0){toast('El total debe ser mayor a $0','err');return;}
  var tipoLabel=_copiaTipo==='bn'?'Blanco y negro':'Color';
  var desc=cant+'× Copia '+tipoLabel+' $'+precio+'c/u';
  agregarAlCarrito(desc,total,'copia');
  cerrar('mCopias');
}

function setEscanTam(t){
  _escanTam=t;
  var precio=t==='carta'?15:20;
  document.getElementById('escan-precio').value=precio;
  var btnC=document.getElementById('escanTam-carta');
  var btnO=document.getElementById('escanTam-oficio');
  var baseStyle='flex:1;padding:10px 6px;border-radius:var(--radius-sm);cursor:pointer;font-family:JetBrains Mono,monospace;font-size:0.7rem;font-weight:700;letter-spacing:0.05em;transition:all 0.15s;';
  if(t==='carta'){
    btnC.style.cssText=baseStyle+'border:2px solid var(--verde);background:var(--verde-l);color:var(--verde-d);';
    btnO.style.cssText=baseStyle+'border:2px solid var(--border);background:var(--surface2);color:var(--muted);';
    btnC.innerHTML='📄 CARTA';
    btnO.innerHTML='📋 OFICIO';
  } else {
    btnO.style.cssText=baseStyle+'border:2px solid var(--verde);background:var(--verde-l);color:var(--verde-d);';
    btnC.style.cssText=baseStyle+'border:2px solid var(--border);background:var(--surface2);color:var(--muted);';
    btnC.innerHTML='📄 CARTA';
    btnO.innerHTML='📋 OFICIO';
  }
  calcEscanTotal();
}

function abrirEscaneo(){
  _escanTam='carta';
  document.getElementById('escan-precio').value='15';
  document.getElementById('escan-cant').value='1';
  setEscanTam('carta');
  calcEscanTotal();
  document.getElementById('mEscaneo').classList.add('show');
}

function adjEscan(d){
  var el=document.getElementById('escan-cant');
  var v=parseInt(el.value||1)+d;if(v<1)v=1;el.value=v;calcEscanTotal();
}

function calcEscanTotal(){
  var p=parseFloat(document.getElementById('escan-precio').value)||0;
  var c=parseInt(document.getElementById('escan-cant').value)||1;
  document.getElementById('escan-total').textContent='$'+fmt(p*c);
}

function registrarEscaneoCarrito(){
  var precio=toNumero(document.getElementById('escan-precio').value,0);
  var cant=toEntero(document.getElementById('escan-cant').value,1);
  var total=precio*cant;
  if(total<=0){toast('El total debe ser mayor a $0','err');return;}
  var tamLabel=_escanTam==='carta'?'Carta':'Oficio';
  var desc=cant+'× Escaneo '+tamLabel+' $'+precio+'c/u';
  agregarAlCarrito(desc,total,'copia');
  cerrar('mEscaneo');
}

function _precioLibreFmt(clean){
  if (clean === '' || clean === '.') return clean;
  var parts = clean.split('.');
  var intPart = parseInt(parts[0]||'0', 10);
  var decPart = parts.length > 1 ? '.' + parts[1].slice(0,2) : '';
  return '$' + intPart.toLocaleString('es-MX') + decPart;
}

function setLibreModo(m){
  _libreModo=m;
}

function abrirCapturaRetro(){
  var fechaHoy = (typeof hoy === 'function' ? hoy() : new Date().toISOString().split('T')[0]);
  var horaAhora = (typeof hora === 'function' ? hora() : new Date().toTimeString().slice(0,5));
  var modalHTML = ''
    + '<div id="modalCapturaRetro" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">'
    + '<div style="background:#1a1410;border:2px solid #5a3a8a;border-radius:12px;max-width:520px;width:100%;padding:24px;color:#e8d4a8;font-family:system-ui,sans-serif;max-height:90vh;overflow-y:auto;">'
    + '<h2 style="margin:0 0 6px 0;color:#c8952a;font-family:Fraunces,serif;">📅 Captura Retroactiva</h2>'
    + '<div style="font-size:0.78rem;color:rgba(200,149,42,0.7);margin-bottom:14px;">'
    + 'Registra un movimiento con fecha/hora anterior. Útil para cobros recibidos después del cierre.'
    + '</div>'
    + '<div style="display:flex;gap:8px;margin-bottom:14px;">'
    + '<button onclick="retroSetTipo(\'ingreso\')" id="retroBtnIng" style="flex:1;padding:10px;background:#2a7a3a;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;">▲ Ingreso</button>'
    + '<button onclick="retroSetTipo(\'egreso\')" id="retroBtnEgr" style="flex:1;padding:10px;background:#3a2018;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;">▼ Egreso</button>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">'
    + '<div>'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Fecha:</label>'
    + '<input type="date" id="retroFecha" value="' + fechaHoy + '" max="' + fechaHoy + '" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:1rem;">'
    + '</div>'
    + '<div>'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Hora:</label>'
    + '<input type="time" id="retroHora" value="' + horaAhora + '" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:1rem;">'
    + '</div>'
    + '</div>'
    + '<div style="font-size:0.7rem;color:rgba(200,149,42,0.6);margin-bottom:12px;margin-top:-4px;">⚠️ No se permiten fechas futuras</div>'
    + '<div style="margin-bottom:12px;">'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Descripción:</label>'
    + '<input type="text" id="retroDesc" placeholder="Ej: Pago de Juan Pérez recibido por la noche" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:0.95rem;">'
    + '</div>'
    + '<div style="margin-bottom:12px;">'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Monto:</label>'
    + '<input type="number" id="retroMonto" placeholder="0.00" min="0" step="0.01" onfocus="this.select()" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:1rem;">'
    + '</div>'
    + '<div style="margin-bottom:14px;">'
    + '<label style="display:block;font-size:0.78rem;color:#c8952a;margin-bottom:4px;">Motivo de captura retroactiva (auditoría):</label>'
    + '<input type="text" id="retroMotivo" placeholder="Ej: Cliente llegó después del cierre" '
    + 'style="width:100%;padding:10px;background:#0a0606;border:1px solid #5a3a8a;border-radius:6px;color:#e8d4a8;font-size:0.9rem;">'
    + '</div>'
    + '<div style="background:rgba(200,149,42,0.08);border:1px solid rgba(200,149,42,0.3);padding:10px;border-radius:6px;margin-bottom:14px;font-size:0.75rem;">'
    + '<b>📝 Importante:</b> Este movimiento se registrará con la fecha/hora indicadas, '
    + 'no con la del momento actual. Quedará registro de auditoría con el usuario, '
    + 'la fecha real de captura y el motivo.'
    + '</div>'
    + '<div style="display:flex;gap:8px;">'
    + '<button onclick="document.getElementById(\'modalCapturaRetro\').remove()" style="flex:1;padding:12px;background:#444;border:none;border-radius:6px;color:#fff;cursor:pointer;">Cancelar</button>'
    + '<button onclick="confirmarCapturaRetro()" style="flex:2;padding:12px;background:#5a3a8a;border:none;border-radius:6px;color:#fff;cursor:pointer;font-weight:600;">✅ Registrar movimiento</button>'
    + '</div>'
    + '</div>'
    + '</div>';
  var div = document.createElement('div');
  div.innerHTML = modalHTML;
  document.body.appendChild(div.firstChild);
  retroSetTipo('ingreso');
}

function abrirRegistroCivil(){
  rcMostrar('home');
  document.getElementById('mRegistroCivil').classList.add('show');
}

function rcAbrirSubpanel(nombre){ rcMostrar(nombre); }

function rcActualizarVista(){
  // Hook intencionalmente vacío. Los inputs actualizan su .value por sí solos.
  // Si en el futuro se quiere agregar una vista previa, este es el lugar.
}

function rcSelTipoActa(tipo, btn){
  _actaTipo=tipo;
  document.querySelectorAll('#mRC-acta .rc-acta-tipo-btn').forEach(function(b){b.classList.remove('sel');});
  btn.classList.add('sel');
  rcCalcActaTotal();
  rcActualizarIndicadorActa();
}

function _rcBuildOtroDropdown(){
  var list=document.getElementById('acta-otro-list');
  if(!list||list.children.length>0)return;
  _OTROS_ESTADOS_ACTA.forEach(function(e){
    var d=document.createElement('div');
    d.textContent=e;
    d.style.cssText='padding:9px 14px;font-size:0.78rem;cursor:pointer;border-bottom:1px solid var(--border-l);transition:background 0.1s;';
    d.onmouseover=function(){this.style.background='var(--gold-pale)';};
    d.onmouseout=function(){this.style.background='';};
    d.onclick=function(){rcSelEstadoActaOtro(e);};
    list.appendChild(d);
  });
}

function rcToggleOtroDropdown(){
  _rcBuildOtroDropdown();
  var dd=document.getElementById('acta-otro-dropdown');
  dd.style.display=(dd.style.display==='none')?'block':'none';
}

function rcSelEstadoActa(estado, btn){
  document.getElementById('acta-otro-dropdown').style.display='none';
  // Todos los pills a gris
  document.getElementById('acta-btn-oaxaca').style.background='#bbb';
  document.getElementById('acta-btn-oaxaca').style.borderColor='#bbb';
  document.getElementById('acta-btn-otro').style.background='#bbb';
  document.getElementById('acta-btn-otro').style.borderColor='#bbb';
  // El seleccionado a verde
  btn.style.background='var(--verde)';btn.style.borderColor='var(--verde)';
  _actaEstado=estado;
  document.getElementById('acta-precio').value='240';
  rcCalcActaTotal();
  rcActualizarIndicadorActa();
}

function rcSelEstadoActaOtro(val){
  if(!val)return;
  document.getElementById('acta-otro-dropdown').style.display='none';
  // Oaxaca a gris, Otro a verde
  document.getElementById('acta-btn-oaxaca').style.background='#bbb';
  document.getElementById('acta-btn-oaxaca').style.borderColor='#bbb';
  document.getElementById('acta-btn-otro').style.background='var(--verde)';
  document.getElementById('acta-btn-otro').style.borderColor='var(--verde)';
  document.getElementById('acta-btn-otro').textContent=val+' ▾';
  _actaEstado=val;
  document.getElementById('acta-precio').value='280';
  rcCalcActaTotal();
  rcActualizarIndicadorActa();
}

function rcActualizarIndicadorActa(){
  var lbl=_actaTipoLabels[_actaTipo]||'';
  var estado=_actaEstado||'';
  var indEl=document.getElementById('acta-tipo-sel');
  var lblEl=document.getElementById('acta-tipo-label');
  if(lbl&&estado){
    lblEl.textContent=lbl+' de '+estado;
    indEl.style.display='block';
  } else if(lbl){
    lblEl.textContent=lbl;
    indEl.style.display='block';
  } else {
    indEl.style.display='none';
  }
}

function rcCalcActaTotal(){
  var p=parseFloat(document.getElementById('acta-precio').value)||0;
  var c=parseInt(document.getElementById('acta-cant').value)||1;
  document.getElementById('acta-total').textContent='$'+fmt(p*c);
}

function rcAdjActa(d){
  var el=document.getElementById('acta-cant');
  el.value=Math.max(1,(parseInt(el.value)||1)+d);
  rcCalcActaTotal();
}

function _rcActaValidar(){
  if(!_actaTipo){toast('Selecciona el tipo de acta','err');return false;}
  if(!_actaEstado){toast('Selecciona el estado','err');return false;}
  var p=parseFloat(document.getElementById('acta-precio').value)||0;
  if(p<=0){toast('El precio debe ser mayor a $0','err');return false;}
  return true;
}

function _rcActaDesc(){
  var lbl=_actaTipoLabels[_actaTipo]||_actaTipo;
  var c=parseInt(document.getElementById('acta-cant').value)||1;
  var p=parseFloat(document.getElementById('acta-precio').value)||0;
  return (c>1?c+'× ':'')+lbl+' — '+_actaEstado+(c>1?' $'+p+'c/u':'');
}

function _rcActaWA(){
  var lbl=_actaTipoLabels[_actaTipo]||_actaTipo;
  var msg=encodeURIComponent(lbl+' — '+_actaEstado);
  var w=window.open('','_blank');
  if(w){w.location.href='https://wa.me/'+RC_WA_NUM+'?text='+msg;}
}

function rcActaCarrito(){
  if(!_rcActaValidar())return;
  var p=parseFloat(document.getElementById('acta-precio').value)||0;
  var c=parseInt(document.getElementById('acta-cant').value)||1;
  var total=p*c;
  var desc=_rcActaDesc();
  agregarAlCarrito(desc,total,'acta');
  cerrar('mRegistroCivil');
  _rcActaWA();
  toast('🛒 Agregado — '+desc,'ok');
}

function escH(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function fmtMx(v){ return '$'+(+v||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2}); }

function fmtM2(v){ return (+(v||0)).toLocaleString('es-MX',{minimumFractionDigits:0}); }

function fmtFIMonto(el){ el.value=el.value.replace(/[^0-9.]/g,''); }

function _ymdAddDays(ymd, dias) {
  // ymd = "YYYY-MM-DD" — suma `dias` (puede ser negativo) y regresa "YYYY-MM-DD"
  const [y, m, d] = ymd.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.getFullYear() + '-' +
         String(fecha.getMonth() + 1).padStart(2, '0') + '-' +
         String(fecha.getDate()).padStart(2, '0');
}

function _gfLog(msg){
  var el=document.getElementById('gf-log');
  if(el){ var d=document.createElement('div'); d.textContent='• '+msg; el.appendChild(d); el.scrollTop=el.scrollHeight; }
}

function _gfBloquear(b){
  document.querySelectorAll('#gf-ov button, #gf-ov input').forEach(function(x){ x.disabled=b; });
}

function _fechaDDMMAAAA(iso){
  if(!iso) return '—';
  var p = String(iso).split('-');
  if(p.length !== 3) return iso;
  return p[2]+'/'+p[1]+'/'+p[0];
}

function _normalizarFechaBusqueda(q){
  var m = String(q||'').trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(!m) return null;
  var dd = m[1].padStart(2,'0'), mm = m[2].padStart(2,'0'), aaaa = m[3];
  return aaaa+'-'+mm+'-'+dd;
}

function _marcarMovEditadoLocal(id){
  if(!id) return;
  window._movsEditadosRecientemente = window._movsEditadosRecientemente || {};
  window._movsEditadosRecientemente[id] = Date.now();
}

function _marcarMovEliminadoLocal(id){
  if(!id) return;
  window._movsEliminadosRecientemente = window._movsEliminadosRecientemente || {};
  window._movsEliminadosRecientemente[id] = Date.now();
}

function _marcarPendEliminadoLocal(id){
  if(!id) return;
  window._pendsEliminadosRecientemente = window._pendsEliminadosRecientemente || {};
  window._pendsEliminadosRecientemente[id] = Date.now();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _abrirHistorialReal() {
  // Crear o mostrar panel historial
  var panel = document.getElementById('panel-historial-2026');
  if (!panel) {
    // Crear panel flotante
    panel = document.createElement('div');
    panel.id = 'panel-historial-2026';
    panel.className = 'modal-ov';
    panel.innerHTML = _buildHistorialHTML();
      document.body.appendChild(panel);
  document.getElementById('hist-close-btn').addEventListener('click', function(){
    document.getElementById('panel-historial-2026').classList.remove('show');
  });
  }
  panel.classList.add('show');
  // Cargar datos si no están en memoria
  if (!historialData) {
    document.getElementById('hist-lista').innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);">⏳ Cargando historial...</div>';
    cargarHistorialContabilidad().then(function(d) {
      if (d) renderHistorial2026();
      else document.getElementById('hist-lista').innerHTML = '<div style="padding:20px;text-align:center;color:#c0161a;">Error al cargar. Verifica que el archivo esté en Drive.</div>';
    });
  } else {
    renderHistorial2026();
  }
}

function _fechaCortaEC(iso){
  if(!iso) return '—';
  var m=String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return String(iso);
  var MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return m[3]+'/'+MESES[parseInt(m[2],10)-1]+'/'+m[1].slice(2);
}

function cerrarEstadoCuenta(){
  var overlay=document.getElementById('estado-cuenta-overlay');
  if(overlay) overlay.remove();
}

function _fichaExtraerIniciales(nombre){
  return (nombre||'').trim().split(/\s+/).map(function(w){ return (w[0]||'').toUpperCase(); }).join('').slice(0,4) || '—';
}

function fichaToggleCargoBtns(idx) {
  var btns = document.getElementById('fcbtns-'+idx);
  var edit = document.getElementById('fcedit-'+idx);
  var tri  = document.getElementById('fctri-'+idx);
  if (!btns) return;
  var visible = btns.style.display === 'flex';
  btns.style.display = visible ? 'none' : 'flex';
  if (tri) tri.textContent = visible ? '◀' : '▼';
  if (visible && edit) edit.style.display = 'none';
}

function fichaActivarEdicionTotal() {
  var rw  = document.getElementById('ficha-total-read-wrap');
  var ew  = document.getElementById('ficha-total-edit-wrap');
  var inp = document.getElementById('ficha-header-total-input');
  var tri = document.getElementById('ficha-total-lapiz');
  if(rw) rw.style.display = 'none';
  if(ew) ew.style.display = 'flex';
  if(tri) tri.textContent = '▾';
  if(inp) { inp.focus(); inp.select(); }
}

function fichaCancelarEdicionTotal() {
  var rw  = document.getElementById('ficha-total-read-wrap');
  var ew  = document.getElementById('ficha-total-edit-wrap');
  var inp = document.getElementById('ficha-header-total-input');
  var tri = document.getElementById('ficha-total-lapiz');
  if(rw) rw.style.display = 'flex';
  if(ew) ew.style.display = 'none';
  if(tri) tri.textContent = '▸';
  if(inp && window._fichaTotalOriginal !== undefined) inp.value = window._fichaTotalOriginal.toFixed(2);
}

function fichaToggleNotas(){
  var d=document.getElementById('fichaNotasDisplay'),i=document.getElementById('fichaNotasInput'),b=document.getElementById('fichaSaveNotas');
  i.value=d.dataset.texto||'';d.style.display='none';i.style.display='block';b.style.display='inline-block';i.focus();
}

function _juRenderDatosDuros(j, idx){
  // Ancla en el contenedor estable #mexp-header-info (NO en mexp-sub.parentNode):
  // desde que título y subtítulo comparten línea (petición 18/ago/2026), su
  // padre inmediato es la fila flex título+subtítulo, no el bloque completo del
  // encabezado — si se ancla ahí, las tarjetas de abajo saldrían a un lado en
  // vez de en su propia línea.
  const cont = document.getElementById('mexp-header-info');
  if(!cont || !j) return;
  const esc2 = (s) => (typeof esc === 'function' ? esc(s == null ? '' : s) : String(s == null ? '' : s));
  const dato = (k, v) => v
    ? '<div><div style="font-family:monospace;font-size:.5rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);">'+k+'</div>'
      + '<div style="font-size:.74rem;color:var(--ink);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;">'+esc2(v)+'</div></div>'
    : '';
  let box = document.getElementById('mexp-datos-duros');
  if(!box){
    box = document.createElement('div');
    box.id = 'mexp-datos-duros';
    cont.appendChild(box);
  }
  box.style.cssText = 'display:flex;gap:20px;flex-wrap:wrap;margin-top:7px;';
  box.innerHTML = dato('Ingreso', j.fechaIngreso) + dato('Teléfono', j.tel) + dato('Control interno', j.controlInterno);

  // La fila de tarjetas ahora es HTML estático (fila propia junto con Leyes
  // del Juicio / Eliminar expedientes — petición 18/ago/2026), así que ya
  // siempre existe; el createElement de respaldo es solo por si algún día se
  // usa este código antes de que el HTML del modal esté insertado.
  let cards = document.getElementById('mexp-datos-cards');
  if(!cards){
    cards = document.createElement('div');
    cards.id = 'mexp-datos-cards';
    box.parentNode.insertBefore(cards, box.nextSibling);
  }
  const cardStyle = 'background:var(--surface2);border:1px solid var(--border-l);border-radius:8px;padding:8px 12px;flex:1;min-width:150px;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box;';
  const label = (t) => '<div style="font-family:monospace;font-size:.5rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;">'+t+'</div>';

  // Folios de recibo — mismo lenguaje visual que el folio en Contabilidad y
  // en las tarjetas de Placas ("Trámite enviado"): número en AZUL y una
  // etiqueta de estado debajo (LIQUIDADO / PENDIENTE $monto / CANCELADO).
  const allRecibos = ((typeof appData !== 'undefined' ? appData.recibos : null) || REC.recibos || []);
  const folios = _juFoliosRecibo(j);
  const chipsHtml = folios.map(f => {
    const rec = allRecibos.find(r => r.folio === f);
    let badge;
    if (!rec) {
      badge = '<span style="font-size:.5rem;font-weight:700;padding:1px 6px;border-radius:8px;background:rgba(192,22,26,0.1);color:#c0161a;">NO ENCONTRADO</span>';
    } else if (rec.cancelado) {
      badge = '<span style="font-size:.5rem;font-weight:700;padding:1px 6px;border-radius:8px;background:rgba(192,22,26,0.1);color:#c0161a;">CANCELADO</span>';
    } else {
      const total = parseFloat(rec.total) || 0;
      const ant = parseFloat(rec.anticipo) || 0;
      const saldo = rec.saldoPendiente !== undefined ? parseFloat(rec.saldoPendiente) : Math.max(0, total - ant);
      badge = saldo > 0
        ? '<span style="font-size:.5rem;font-weight:700;padding:1px 6px;border-radius:8px;background:rgba(232,156,48,0.15);color:#9a6010;">PENDIENTE $'+fmt(saldo)+'</span>'
        : '<span style="font-size:.5rem;font-weight:700;padding:1px 6px;border-radius:8px;background:rgba(26,122,58,0.1);color:var(--verde-d);">LIQUIDADO</span>';
    }
    return '<div onclick="event.stopPropagation();abrirFichaDesdeContab('+f+')" title="Ver Ficha del Folio #'+folioFormato(f)+'" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;">'
      + '<span style="font-family:monospace;font-weight:700;font-size:.9rem;color:var(--azul);">#'+folioFormato(f)+'</span>'
      + badge
      + '</div>';
  }).join('');
  const addChip = '<span onclick="event.stopPropagation();abrirGestionReciboJuicio('+idx+')" title="Vincular otro folio" aria-label="Vincular otro folio" style="cursor:pointer;font-family:monospace;font-size:.75rem;color:var(--muted);border:1px dashed var(--border-l);width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">+</span>';

  const carpetaTxt = j.carpetaFisica ? esc2(j.carpetaFisica) : 'Sin carpeta física';

  cards.innerHTML =
      '<div style="'+cardStyle+'">'+label('Juzgado')+'<div style="font-size:.76rem;color:var(--ink);font-weight:600;">'+(esc2(j.juzgado)||'—')+'</div></div>'
    + '<div style="'+cardStyle+'">'+label('Folios de recibo')+'<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">'+(chipsHtml||'<span style="font-size:.72rem;color:var(--muted);">Sin folios</span>')+addChip+'</div></div>'
    + '<div onclick="_juEditarCarpetaFisica('+idx+')" style="'+cardStyle+'cursor:pointer;" title="Clic para vincular/editar la carpeta física">'+label('Carpeta física')+'<div style="font-size:.76rem;color:var(--ink);font-weight:600;">📁 '+carpetaTxt+'</div></div>';
}

function _juTab(k){
  window._juTabActiva = k;
  _juRenderPestanas(window._mexpIdxActual);
}

function _juSugRecalc(){
  const fEl = document.getElementById('juSugFecha');
  const dEl = document.getElementById('juSugDias');
  const hEl = document.getElementById('juSugHab');
  const vEl = document.getElementById('juSugVence');
  const out = document.getElementById('juSugCalc');
  if(!fEl || !dEl || !vEl || !out) return;
  const dias = parseInt(dEl.value, 10) || 0;
  if(!fEl.value || dias < 1){
    vEl.value = '';
    out.textContent = 'Sin plazo: se guardará solo como actuación en la línea de tiempo.';
    out.style.color = 'var(--muted)';
    return;
  }
  const hab = (hEl && hEl.value === '1');
  const venc = _juCalcVencimiento(fEl.value, dias, hab);
  vEl.value = venc;
  const est = _juEstadoTermino({ fecha: venc, cumplido:false });
  out.innerHTML = 'Vence el <b style="color:'+est.color+'">'+venc+'</b> · '+est.texto
    + (hab ? ' <span style="opacity:.7;">(sin contar sábados, domingos ni inhábiles)</span>' : ' <span style="opacity:.7;">(días naturales)</span>');
  out.style.color = 'var(--ink)';
}

function _juDescartarSugerencia(){
  window._juSugerencia = null;
  const c = document.getElementById('mexp-ia-sugerencia');
  if(c){ c.style.display = 'none'; c.innerHTML = ''; }
}

function _blobToBase64(blob){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = ()=> res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function abrirFormHistorial(){
  const f = $('mexp-hist-form');
  f.style.display = 'block';
  $('mexp-hf-fecha').value = new Date().toISOString().substring(0,10);
  $('mexp-hf-texto').value = '';
  $('mexp-hf-texto').focus();
}

function cerrarFormHistorial(){
  $('mexp-hist-form').style.display = 'none';
}

function _flujoRepararYParsear(txtOriginal){
  const extraerCandidato = (txt) => {
    const inicio = txt.indexOf('[');
    if (inicio < 0) return txt;
    let depth=0, enStr=false, esc=false, fin=-1;
    for (let i=inicio;i<txt.length;i++){
      const c=txt[i];
      if(enStr){ if(esc){esc=false;} else if(c==='\\'){esc=true;} else if(c==='"'){enStr=false;} continue; }
      if(c==='"'){enStr=true;continue;}
      if(c==='['||c==='{')depth++;
      else if(c===']'||c==='}'){depth--; if(depth===0){fin=i;break;}}
    }
    return fin>=0 ? txt.slice(inicio,fin+1) : txt.slice(inicio);
  };
  // Si una comilla no va seguida de , : } ] o fin de texto, no es un cierre
  // real de cadena — es texto del abogado citando algo — se escapa.
  const escaparComillasInternas = (txt) => {
    let out='', enStr=false, esc=false;
    for(let i=0;i<txt.length;i++){
      const c=txt[i];
      if(!enStr){ out+=c; if(c==='"')enStr=true; continue; }
      if(esc){ out+=c; esc=false; continue; }
      if(c==='\\'){ out+=c; esc=true; continue; }
      if(c==='"'){
        let j=i+1; while(j<txt.length && /\s/.test(txt[j])) j++;
        const sig=txt[j];
        const cierreReal=(sig===','||sig===':'||sig==='}'||sig===']'||sig===undefined);
        if(cierreReal){ out+=c; enStr=false; } else { out+='\\"'; }
        continue;
      }
      out+=c;
    }
    return out;
  };
  const cerrarFaltantes = (txt) => {
    let depthArr=0, depthObj=0, enStr=false, esc=false;
    for(let i=0;i<txt.length;i++){
      const c=txt[i];
      if(enStr){ if(esc){esc=false;} else if(c==='\\'){esc=true;} else if(c==='"'){enStr=false;} continue; }
      if(c==='"'){enStr=true;continue;}
      if(c==='[')depthArr++; else if(c===']')depthArr--;
      else if(c==='{')depthObj++; else if(c==='}')depthObj--;
    }
    let out=txt;
    if(enStr) out+='"';
    while(depthObj>0){ out+='}'; depthObj--; }
    while(depthArr>0){ out+=']'; depthArr--; }
    return out;
  };
  // Si la respuesta se cortó a la mitad de una etapa, rescata las etapas
  // completas anteriores en vez de perder todo el flujo.
  const recortarAlUltimoCompleto = (txt) => {
    const idx = txt.lastIndexOf('},');
    if (idx < 0) return null;
    return txt.slice(0, idx+1) + ']';
  };
  // OJO con el orden: hay que normalizar comillas tipográficas → rectas y
  // quitar comas colgantes ANTES de decidir cuáles comillas son "internas",
  // si no, las comillas recién convertidas quedan sin escapar.
  const limpiar = (txt) => txt.replace(/[“”]/g,'"').replace(/,\s*([\]}])/g,'$1');

  // txtOriginal debería ser siempre string, pero si algún proveedor de IA
  // regresa un arreglo/objeto en vez de texto plano, _cfaiComoTexto (si existe)
  // lo normaliza aquí también, como segunda red de seguridad.
  const _txtSeguro = typeof txtOriginal === 'string' ? txtOriginal
    : (typeof _cfaiComoTexto === 'function' ? _cfaiComoTexto(txtOriginal) : String(txtOriginal||''));
  const candidato = extraerCandidato(_txtSeguro.trim());
  const normalizado = limpiar(candidato);
  const escapado = escaparComillasInternas(normalizado);
  const intentos = [
    candidato,
    normalizado,
    escapado,
    limpiar(escapado),
    cerrarFaltantes(limpiar(escapado)),
  ];
  for (const intento of intentos) {
    try { const r = JSON.parse(intento); if (Array.isArray(r) && r.length) return r; } catch(e){}
  }
  const base = cerrarFaltantes(limpiar(escapado));
  const recortado = recortarAlUltimoCompleto(base);
  if (recortado) {
    try { const r = JSON.parse(recortado); if (Array.isArray(r) && r.length) return r; } catch(e){}
  }
  throw new Error('No se pudo interpretar la respuesta de la IA como JSON válido.');
}

function _escritoCopiar() {
  // Copiar el último mensaje del asistente
  const ultimo = _escritoChatHistorial.filter(m => m.role === 'assistant').pop();
  if (!ultimo) { if(typeof toast==='function') toast('Sin contenido para copiar', 'err'); return; }
  navigator.clipboard.writeText(ultimo.content).then(() => {
    if(typeof toast==='function') toast('✓ Escrito copiado al portapapeles', 'ok');
  }).catch(() => {
    if(typeof toast==='function') toast('⚠ No se pudo copiar automáticamente', 'err');
  });
}

function _prById(id) {
  return _prGetAll().find(p => p.id === id) || null;
}

function _prTotalGastos(pr) {
  return (pr.gastos || []).reduce((s, g) => {
    const v = parseFloat(g.monto);
    return s + (isNaN(v) ? 0 : v);
  }, 0);
}

function _prNuevo() {
  _prAbrirFormulario(null);
}

function _prRenderGastos(pr) {
  const el = document.getElementById('pr-gastos-lista-' + pr.id);
  const totEl = document.getElementById('pr-gastos-total-' + pr.id);
  if (!el) return;
  const gastos = pr.gastos || [];
  if (!gastos.length) {
    el.innerHTML = '<div style="font-size:0.65rem;color:var(--muted);padding:8px 0;text-align:center;">Sin gastos registrados aún</div>';
  } else {
    el.innerHTML = gastos.map((g, i) => `
      <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface2);border-radius:6px;">
        <span style="font-size:0.7rem;color:var(--ink);flex:1;">${escHTML(g.concepto||g.descripcion||'—')}</span>
        ${g.descripcion ? `<span style="font-size:0.65rem;color:var(--muted);flex:0.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHTML(g.descripcion)}</span>` : ''}
        <span style="font-size:0.65rem;color:var(--muted);font-family:'JetBrains Mono',monospace;white-space:nowrap;">${g.fecha||''}</span>
        <span style="font-size:0.75rem;font-weight:600;color:var(--ink);font-family:'JetBrains Mono',monospace;min-width:80px;text-align:right;">$${parseFloat(g.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
        <button onclick="_prEliminarGasto('${pr.id}', ${i})" style="font-size:0.8rem;background:none;border:none;cursor:pointer;color:var(--rojo);padding:2px 4px;" title="Eliminar gasto">🗑</button>
      </div>`).join('');
  }
  const total = _prTotalGastos(pr);
  if (totEl) {
    const _hon = parseFloat(pr.honorarios) || 0;
    const _deuda = total + _hon;
    totEl.innerHTML = (gastos.length || _hon > 0)
      ? (gastos.length ? `Total gastos: <strong style="color:var(--ink);">$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</strong> &nbsp;·&nbsp; ` : '')
        + `Deuda total (gastos + honorarios): <strong style="color:var(--gold-d);">$${_deuda.toLocaleString('es-MX',{minimumFractionDigits:2})}</strong>`
      : '';
  }
}

function _prEliminarGasto(prId, idx) {
  const pr = _prById(prId);
  if (!pr || !pr.gastos) return;
  pr.gastos.splice(idx, 1);
  _prGuardar();
  _prRenderGastos(pr);
}

function _prImprimirEstadoCuenta(prId) {
  const pr = _prById(prId);
  if (!pr) return;
  const totalGastos = _prTotalGastos(pr);
  const hoy = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'long', year:'numeric' });
  const gastosHtml = (pr.gastos||[]).length
    ? (pr.gastos||[]).map(g => `<tr><td style="padding:5px 8px;">${g.descripcion}</td><td style="padding:5px 8px;">${g.fecha||'—'}</td><td style="padding:5px 8px;text-align:right;">$${parseFloat(g.monto).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>`).join('')
    : '<tr><td colspan="3" style="padding:8px;text-align:center;color:#999;">Sin gastos registrados</td></tr>';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Estado de Cuenta</title>
  <style>body{font-family:serif;max-width:600px;margin:30px auto;color:#1a1008;}h1{font-size:1rem;text-align:center;letter-spacing:0.2em;text-transform:uppercase;color:#8c6518;}table{width:100%;border-collapse:collapse;font-size:0.85rem;}th{background:#f5edd0;padding:6px 8px;text-align:left;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;}tr:nth-child(even){background:#fdfaf4;}.total{text-align:right;font-weight:bold;font-size:1rem;color:#8c6518;margin-top:10px;}.note{font-size:0.7rem;color:#999;margin-top:20px;text-align:center;border-top:1px solid #e0d5b0;padding-top:10px;}</style>
  </head><body>
  <h1>LEX-MÉXICO · Despacho Jurídico</h1>
  <p style="text-align:center;font-size:0.8rem;color:#666;">Estado de cuenta preliminar — ${hoy}</p>
  <hr style="border-color:#e0d5b0;">
  <table><tr><td style="padding:4px 0;"><strong>Cliente:</strong></td><td>${escHTML(pr.nombre)}</td></tr>
  <tr><td style="padding:4px 0;"><strong>Trámite:</strong></td><td>${escHTML(pr.concepto)}</td></tr>
  <tr><td style="padding:4px 0;"><strong>Inicio:</strong></td><td>${pr.fechaInicio||'—'}</td></tr>
  ${pr.honorarios ? `<tr><td style="padding:4px 0;"><strong>Honorarios:</strong></td><td>$${parseFloat(pr.honorarios).toLocaleString('es-MX',{minimumFractionDigits:2})}</td></tr>` : ''}</table>
  <br><table><thead><tr><th>Descripción</th><th>Fecha</th><th>Monto</th></tr></thead><tbody>${gastosHtml}</tbody></table>
  <p class="total">Total gastos acumulados: $${totalGastos.toLocaleString('es-MX',{minimumFractionDigits:2})}</p>
  <p class="total">Total de la deuda: $${(totalGastos + (parseFloat(pr.honorarios)||0)).toLocaleString('es-MX',{minimumFractionDigits:2})}</p>
  <p class="note">Este documento es informativo y no constituye un recibo oficial.<br>LEX-MÉXICO · Santiago Juxtlahuaca, Oaxaca · 953 128 7511</p>
  </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
}

function cerrarModalEscrito(){
  $('modal-redactar-escrito').style.display = 'none';
}

function _agregarMensajeIA(texto, rol){
  const chat = $('mexp-ia-chat');
  if(!chat) return;
  const isUser = rol === 'user';
  const div = document.createElement('div');
  div.style.cssText = 'padding:8px 10px;border-radius:var(--radius-sm);font-size:0.74rem;line-height:1.6;' +
    (isUser ? 'background:var(--azul-l);color:var(--azul);align-self:flex-end;max-width:90%;' : 'background:var(--surface2);color:var(--ink);border:1px solid var(--border-l);');
  div.textContent = texto;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}
