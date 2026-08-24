// ── Fondo con textura jurídica (balanza, martillo, libro, columna) ──
// Se genera como SVG en memoria — sin depender de ningún archivo externo —
// y se reutiliza tanto en el splash como en la ventana de login para que
// ambas pantallas luzcan con el mismo fondo negro texturizado.
function _lexFondoTexturaSVG(opacidad){
  var _op = (typeof opacidad === 'number') ? opacidad : 0.16;
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">'
    + '<g fill="none" stroke="rgba(200,149,42,' + _op + ')" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">'
    // Balanza (escala de la justicia)
    + '<line x1="40" y1="18" x2="40" y2="78"/>'
    + '<line x1="16" y1="26" x2="64" y2="26"/>'
    + '<line x1="16" y1="26" x2="8" y2="46"/>'
    + '<line x1="16" y1="26" x2="24" y2="46"/>'
    + '<path d="M8 46 a8 8 0 0 0 16 0"/>'
    + '<line x1="64" y1="26" x2="56" y2="46"/>'
    + '<line x1="64" y1="26" x2="72" y2="46"/>'
    + '<path d="M56 46 a8 8 0 0 0 16 0"/>'
    + '<line x1="26" y1="78" x2="54" y2="78"/>'
    // Martillo (mazo de juez) — basado en referencia real proporcionada por el
    // usuario: cabeza cilíndrica gruesa + cuello + mango largo, todo dentro de
    // un mismo <g> rotado para que las piezas queden perfectamente alineadas
    // (cabeza arriba-izquierda, mango bajando a la derecha) y una base separada.
    + '<g transform="translate(160 20) rotate(50)">'
    +   '<rect x="0" y="-9" width="34" height="18" rx="9"/>'
    +   '<rect x="28" y="-5" width="12" height="10" rx="2"/>'
    +   '<rect x="36" y="-5" width="54" height="10" rx="5"/>'
    + '</g>'
    + '<rect x="125" y="88" width="52" height="10" rx="3"/>'
    // Libro abierto
    + '<path d="M28 148 q16 -9 32 0 v42 q-16 -9 -32 0 z"/>'
    + '<path d="M92 148 q-16 -9 -32 0 v42 q16 -9 32 0 z"/>'
    + '<line x1="34" y1="158" x2="54" y2="154"/>'
    + '<line x1="34" y1="169" x2="54" y2="165"/>'
    + '<line x1="66" y1="154" x2="86" y2="158"/>'
    + '<line x1="66" y1="165" x2="86" y2="169"/>'
    // Columna
    + '<rect x="150" y="112" width="46" height="11"/>'
    + '<line x1="158" y1="123" x2="158" y2="182"/>'
    + '<line x1="173" y1="123" x2="173" y2="182"/>'
    + '<line x1="188" y1="123" x2="188" y2="182"/>'
    + '<rect x="148" y="182" width="50" height="11"/>'
    + '</g>'
    + '</svg>';
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
}
(function(){
  var _s = document.getElementById('lex-splash');
  if(_s){
    _s.style.backgroundColor = '#0b0a08';
    _s.style.backgroundImage = 'radial-gradient(ellipse at center, rgba(255,255,255,0.025), rgba(0,0,0,0) 62%), ' + _lexFondoTexturaSVG(0.48);
    _s.style.backgroundRepeat = 'no-repeat, repeat';
    _s.style.backgroundSize = 'cover, 130px 130px';
  }
  // A petición expresa: la misma textura también en el fondo negro base de TODO
  // el sistema (document.body — el que se asoma en los huecos entre tarjetas del
  // panel principal, franjas superior/inferior, etc.). No toca el sidebar, que ya
  // trae su propia textura de líneas diagonales establecida.
  // NOTA: se probó aplicar esta misma textura al fondo negro base del panel
  // principal (document.body), pero ahí solo se asoma en franjas angostas
  // (barra superior, huecos entre tarjetas, márgenes) y se veía mal / poco
  // claro incluso subiendo la opacidad — a petición expresa se revirtió.
  // Queda SOLO en el splash y el login (arriba).
})();
// ── RED DE SEGURIDAD AL ARRANCAR ──────────────────────────────────────────
// ANTES (bug): si la verificación de sesión tardaba más de 12s, este temporizador
// simplemente QUITABA la pantalla de carga y dejaba a la vista el sistema
// completo con todos los datos, aunque nadie hubiera iniciado sesión. Segundos
// después getSession() terminaba, no encontraba sesión y mandaba al login: de
// ahí la secuencia "cargando → se ve todo el sistema → login" que se reportó.
// Además de confuso, dejaba ver información a quien no había entrado.
//
// AHORA: la pantalla de carga NUNCA se retira sola. Si la verificación tarda,
// primero se avisa; y si de plano no responde, se muestra el LOGIN encima —
// jamás el sistema.
//
// EXCEPCIÓN (igual que antes): si ya está puesto el aviso de horario de captura
// (candado legítimo, ej. "Horario concluido"), no se toca nada — ese candado
// puede durar horas a propósito.

// A los 8 segundos: avisar que está tardando y ofrecer reintentar.
setTimeout(function(){
  var s = document.getElementById('lex-splash');
  if(!s) return; // la sesión ya se resolvió: no hay nada que avisar
  var t = document.getElementById('lex-splash-texto');
  if(t) t.textContent = 'LEX-MÉXICO · La conexión está tardando…';
  var b = document.getElementById('lex-splash-reintentar');
  if(b) b.style.display = 'inline-block';
}, 8000);

// A los 20 segundos: si la sesión sigue sin resolverse, ir al LOGIN.
setTimeout(function(){
  var gate = document.getElementById('modal-horario-gate');
  if(gate && gate.classList.contains('show')) return;
  var s = document.getElementById('lex-splash');
  if(!s) return; // ya se resolvió (sesión válida o login mostrado)
  if(typeof mostrarLoginSupabase === 'function'){
    mostrarLoginSupabase();   // esta función retira el splash y pone el login
  } else {
    // Si ni siquiera cargó el código de login, se deja la pantalla de carga
    // puesta con el aviso: preferible quedarse esperando que destapar el sistema.
    var t = document.getElementById('lex-splash-texto');
    if(t) t.textContent = 'LEX-MÉXICO · No se pudo conectar. Usa Reintentar.';
    var b = document.getElementById('lex-splash-reintentar');
    if(b) b.style.display = 'inline-block';
  }
}, 20000);
