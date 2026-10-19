// ── Avisos con el estilo LEX-MÉXICO (oct-2026) ──────────────────────────
// Reemplaza la ventanita gris del navegador (alert) por un aviso con el
// estilo dorado del sistema. Si llegan varios avisos seguidos se muestran
// uno tras otro. Las confirmaciones (confirm) NO se tocan.
// Para un caso que necesite el aviso nativo (p. ej. justo antes de recargar
// la página) se usa window._alertNativo(msg).
(function(){
  'use strict';
  if (window._alertNativo) return;
  var nativo = window.alert ? window.alert.bind(window) : function(){};
  window._alertNativo = nativo;
  var cola = [], abierto = false;

  function cerrar(ov, btn){
    try { document.removeEventListener('keydown', ov._tecla, true); } catch(e){}
    ov.remove();
    abierto = false;
    if (ov._foco && ov._foco.focus) { try { ov._foco.focus(); } catch(e){} }
    siguiente();
  }
  function siguiente(){
    if (abierto || !cola.length) return;
    if (!document.body) { setTimeout(siguiente, 50); return; }
    abierto = true;
    var msg = cola.shift();
    var ov = document.createElement('div');
    ov.className = 'lex-aviso-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(26,16,8,0.55);display:flex;align-items:center;justify-content:center;padding:16px;';
    ov.innerHTML =
      '<div role="alertdialog" aria-modal="true" style="background:#fbf6ea;border:1.5px solid #c8951a;border-radius:12px;width:100%;max-width:420px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,0.45);font-family:Helvetica,Arial,sans-serif;">'
      + '<div style="background:#1a1008;color:#e8c875;padding:10px 16px;font-size:0.72rem;letter-spacing:0.1em;font-family:\'DM Mono\',monospace;">ⓘ LEX-MÉXICO · AVISO</div>'
      + '<div class="lex-aviso-txt" style="padding:16px;font-size:0.86rem;color:#2a1c08;line-height:1.55;white-space:pre-wrap;word-break:break-word;max-height:60vh;overflow-y:auto;"></div>'
      + '<div style="padding:0 16px 16px;text-align:right;"><button type="button" class="lex-aviso-ok" style="background:#9a6e18;color:#fff;border:none;border-radius:6px;padding:8px 22px;font-size:0.74rem;letter-spacing:0.06em;cursor:pointer;font-family:\'DM Mono\',monospace;">ENTENDIDO</button></div>'
      + '</div>';
    ov.querySelector('.lex-aviso-txt').textContent = String(msg == null ? '' : msg);
    ov._foco = document.activeElement;
    var btn = ov.querySelector('.lex-aviso-ok');
    btn.onclick = function(){ cerrar(ov, btn); };
    ov.onclick = function(ev){ if (ev.target === ov) cerrar(ov, btn); };
    ov._tecla = function(ev){
      if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cerrar(ov, btn); }
    };
    document.addEventListener('keydown', ov._tecla, true);
    document.body.appendChild(ov);
    try { btn.focus(); } catch(e){}
  }
  window.lexAviso = function(msg){ cola.push(msg); siguiente(); };
  window.alert = function(msg){ window.lexAviso(msg); };
})();
