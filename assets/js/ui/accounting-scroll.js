function _csScrollContabTop(){
  try{ window.scrollTo({top:0, left:0, behavior:'smooth'}); }catch(e){ window.scrollTo(0,0); }
}
function _csScrollContabBottom(){
  try{
    const cd = document.getElementById('contab-dias');
    if(cd && cd.lastElementChild){ cd.lastElementChild.scrollIntoView({behavior:'smooth', block:'end'}); }
    else window.scrollTo({top:document.body.scrollHeight, behavior:'smooth'});
  }catch(e){ window.scrollTo({top:document.body.scrollHeight}); }
}
(function(){
  function _csToggleFlechas(){
    const a = document.getElementById('cs-scroll-arrows');
    if(!a) return;
    a.style.display = document.body.classList.contains('panel-contabilidad') ? 'flex' : 'none';
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _csToggleFlechas);
  } else {
    _csToggleFlechas();
  }
  new MutationObserver(_csToggleFlechas).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
