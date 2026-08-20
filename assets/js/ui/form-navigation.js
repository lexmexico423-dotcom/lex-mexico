function regresarAlFormulario(){
  if(document.body.classList.contains('modo-consulta')||document.body.classList.contains('paneles-abiertos-consulta')){
    // En modo consulta: cerrarConsulta() limpia clases, paneles y formulario
    if(typeof cerrarConsulta==='function') cerrarConsulta();
  } else {
    // Panel de búsqueda abierto: cerrar panel
    const panCuerpo = document.getElementById('paneles-busqueda-cuerpo');
    if(panCuerpo) panCuerpo.setAttribute('style','display:none;padding:0 20px 14px;');
    const pbcB = document.getElementById('pbc-body');
    const pfcB = document.getElementById('pfc-body');
    if(pbcB) pbcB.removeAttribute('style');
    if(pfcB) pfcB.removeAttribute('style');
    if(typeof _panelesBusquedaAbiertos !== 'undefined') _panelesBusquedaAbiertos = false;
    if(typeof _pbcAbierto !== 'undefined') _pbcAbierto = false;
    if(typeof _pfcAbierto !== 'undefined') _pfcAbierto = false;
    document.body.classList.remove('paneles-busqueda-abiertos','paneles-abiertos-consulta');
    const arrow = document.getElementById('toggle-paneles-arrow');
    if(arrow) arrow.style.transform = 'rotate(0deg)';
    const btn = document.getElementById('btn-toggle-paneles');
    if(btn){ btn.style.borderColor='#2a7a3a'; btn.style.background='none'; }
    // Limpiar formulario y cargar el siguiente folio disponible
    if(typeof limpiarFormCompleto==='function') limpiarFormCompleto();
    if(typeof actualizarFolioDisplay==='function') actualizarFolioDisplay();
    setTimeout(()=>{
      window.scrollTo({top:0, behavior:'smooth'});
    }, 80);
  }
}
