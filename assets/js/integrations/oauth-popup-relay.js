// ── Relevo de OAuth de Drive/Calendar en ventana emergente ─────────────────
// Si esta carga de la página es la ventanita emergente que abrimos para
// conectar Google Drive (ver driveIniciarOAuth), en cuanto Google la
// redirige de regreso aquí con ?code=...&state=lexdrive, en vez de arrancar
// TODA la aplicación en esa ventanita, se manda el código a la pestaña
// principal (que nunca se movió de lugar, así que su sesión nunca se pierde)
// y esta ventanita se cierra sola. Esto evita el problema de que algunos
// navegadores (Brave, Safari) pierdan la sesión/localStorage durante el
// viaje de ida y vuelta a Google con una redirección de página completa.
(function(){
  try{
    var qs = new URLSearchParams(window.location.search);
    if(window.opener && qs.get('state') === 'lexdrive' && qs.get('code')){
      window.opener.postMessage({ tipo:'lex-drive-oauth-code', code: qs.get('code') }, window.location.origin);
      document.write('Conectando Drive… puedes cerrar esta ventana.');
      window.close();
    }
  }catch(e){}
})();
