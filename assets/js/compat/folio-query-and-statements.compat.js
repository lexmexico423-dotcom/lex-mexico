// Token anti-carrera: si el usuario abre otro folio antes de que termine de
// cargar (async, R2) el anterior, la respuesta tardía de ese folio anterior
// ya NO debe pisar el badge/tabla del folio que está visible ahora. Mismo
// patrón que _modoConsultaToken en activarModoConsulta.
window._fichaAbrirToken = window._fichaAbrirToken || 0;

// ═══════════════════════════════════════════════════════════════════
// ESTADO DE CUENTA — ventana flotante + PDF formal (diseño ya aprobado).
// Reutiliza la MISMA lógica de costo/abonado por versión que ya usa la
// Ficha del Folio (congelado por recibo, nunca recalculado contra el
// estado actual), pero el ADEUDO aquí es HORIZONTAL por fila (cargo -
// abono de ESA fila únicamente) — el saldo real del folio solo aparece
// en el TOTAL de la columna ADEUDO (suma vertical), tal como se acordó.
// ═══════════════════════════════════════════════════════════════════
/* Movido a modules/core/index.js: _fechaCortaEC */
/* Movido a modules/recibos/index.js: _calcularEstadoCuenta */
// ── Ventana flotante (se puede cerrar) ──
/* Movido a modules/recibos/index.js: abrirEstadoCuenta */
/* Movido a modules/core/index.js: cerrarEstadoCuenta */
// ── PDF formal (monocromático, tipo carta membretada) ──
/* Movido a modules/documentos/index.js: generarPDFEstadoCuenta */
/* Movido a modules/recibos/index.js: imprimirEstadoCuenta */

// Iniciales de un nombre completo, usado en la Ficha del Folio para mostrar
// "Autorizó: X.X." en cada recibo (ver _tipoReciboSC más abajo).
/* Movido a modules/core/index.js: _fichaExtraerIniciales */

/* Movido a modules/recibos/index.js: abrirFichaFolio */

// ── Señal discreta de sync a otros clientes ─────────────────────────────
/* Movido a modules/recibos/index.js: _fichaEnviarSenalSync */
/* Movido a modules/administracion/index.js: _fichaEsAdmin */
// ── Actualizar totales en header y footer al agregar/eliminar cargo ───────
/* Movido a modules/recibos/index.js: _fichaActualizarTotalesConCargos */
// ── Re-render de la lista de cargos DESDE MEMORIA (sin recargar R2 — evita carrera) ──
/* Movido a modules/recibos/index.js: _fichaRenderCargosLista */
// ── Render fila de cargo con editar/eliminar solo admin ───────────────────
/* Movido a modules/administracion/index.js: _fichaCargoRow */

/* Movido a modules/core/index.js: fichaToggleCargoBtns */

/* Movido a modules/administracion/index.js: fichaEditarCargo */

/* Movido a modules/administracion/index.js: fichaGuardarEdicionCargo */
// ── Eliminar cargo (solo admin) ───────────────────────────────────────────
/* Movido a modules/administracion/index.js: fichaEliminarCargo */
// ── Eliminar gasto extraoficial (solo admin) ──────────────────────────────
// ── FIN HELPERS FICHA ─────────────────────────────────────────────────────
/* Movido a modules/core/index.js: fichaActivarEdicionTotal */
/* Movido a modules/core/index.js: fichaCancelarEdicionTotal */
// ── Toggle edición CONCEPTO ──
/* Movido a modules/recibos/index.js: fichaActivarEdicionConcepto */
/* Movido a modules/recibos/index.js: fichaCancelarEdicionConcepto */
// Guarda el concepto editado en Juicio
/* Movido a modules/recibos/index.js: fichaAgregarCargo */

/* Movido a modules/recibos/index.js: fichaGuardarCargo */

// ── Cargos internos R2 (lex-expedientes) ─────────────────────────────────
/* Movido a modules/recibos/index.js: _cargoR2Path */
/* Movido a modules/recibos/index.js: _cargoR2Cargar */
/* Movido a modules/recibos/index.js: _cargoR2Guardar */
// ── FIN CARGOS R2 ─────────────────────────────────────────────────────────

/* Movido a modules/caja/index.js: fichaCerrarJuicio */

/* Movido a modules/recibos/index.js: fichaGuardarConcepto */

// Guarda el total editado en Supabase y recalcula
/* Movido a modules/recibos/index.js: fichaGuardarTotalEditable */

// Genera e imprime el Estado de Cuenta de un folio
/* Movido a modules/recibos/index.js: fichaImprimirEstadoCuenta */

// ═══════════════════════════════════════════════════════
// EXPEDIENTE DIGITAL VEHICULAR
// ═══════════════════════════════════════════════════════
var _expDigState = { recibo: null, pendiente: null };

// Resuelve el pendiente de Placas vinculado a este folio SIEMPRE de forma
// fresca (por contenido: sección + folio), en vez de confiar en la
// referencia guardada en _expDigState.pendiente al abrir el modal. Esa
// referencia se volvía inválida (indexOf ya no lo encontraba, y por lo
// tanto "Adjuntar" no hacía nada) en cuanto D.pendientes se reemplazaba
// por una sincronización de fondo mientras el modal seguía abierto.
/* Movido a modules/recibos/index.js: _expDigPendienteActual */

/* Movido a modules/recibos/index.js: _expDigRenderStatus */

// Fuente única de documentos para este folio en el modal de Expediente
// Digital: si el pendiente de Placas sigue vivo, sus p.documentos (los
// mismos que se ven en esa tarjeta). Si el folio ya se liquidó y el
// pendiente se borró (ver sincronizarPendientesPlacas), el respaldo que
// quedó guardado en el propio recibo — así "Expediente Digital" sigue
// mostrando los adjuntos aunque el folio ya no aparezca en Pendientes.
// Con paraEscribir=true crea el arreglo si hace falta (para poder adjuntar).
/* Movido a modules/recibos/index.js: _expDigDocsArray */

// Renderiza "Archivos adjuntos" con la MISMA dinámica que la tarjeta de
// Pendientes de Placas: chips 📄 clicables que abren el mismo visualizador
// (_pVerDoc) — en vez de una lista aparte que había que volver a seleccionar.
/* Movido a modules/documentos/index.js: _expDigRenderArchivos */

// Abre el mismo visualizador de documentos (zoom, navegación ◀▶, descargar,
// eliminar) que se usa al hacer clic en un doc de la tarjeta de Pendientes
// de Placas — así se ve exactamente igual sin importar desde dónde se abra.
// El botón eliminar solo aparece cuando el doc vive en un pendiente vivo
// (_pVerDocRender lo oculta si pendienteIdx es undefined).
/* Movido a modules/expedientes/index.js: _expDigVerDoc */

// Botón "Adjuntar archivos" del modal: si el folio tiene pendiente de
// Placas vinculado, reutiliza EXACTAMENTE la misma función de subida que
// el botón "+ Adjuntar" de la tarjeta de Pendientes — el archivo queda en
// p.documentos y por lo tanto visible en ambos lados a la vez. Si ya no
// hay pendiente vinculado (folio liquidado, o nunca tuvo uno), sube igual
// a Drive/base64 pero lo guarda de forma permanente en el propio recibo.
/* Movido a modules/recibos/index.js: _expDigAdjuntarClick */

// Misma mecánica de subida que _placasAdjuntarDoc (Drive con caché de
// carpetas + 1 reintento + respaldo base64, timeouts en cada llamada de
// red) pero guardando el resultado en recibo.expDigitalDocumentosPlacas en
// vez de en un pendiente — para folios ya liquidados (sin pendiente vivo)
// o que nunca tuvieron uno.
/* Movido a modules/recibos/index.js: _expDigAdjuntarSinPendiente */

/* Movido a modules/recibos/index.js: abrirExpDigitalVehiculo */

// Lista los archivos que ya existen dentro de una carpeta de Drive
// (usado para reconstruir el registro local cuando se perdió).
/* Movido a modules/expedientes/index.js: _expDigListarCarpetaDrive */

/* Movido a modules/recibos/index.js: _expDigIntentarReconstruirDesdeDrive */

/* Movido a modules/administracion/index.js: cerrarExpDigital */

// "Vincular Carpeta en Drive": ya no arma un PDF combinado — el expediente
// digital de un folio vehicular liquidado es, simplemente, la MISMA carpeta
// de Drive donde ya viven sus documentos individuales (la que usan
// _placasAdjuntarDoc/_expDigAdjuntarSinPendiente: "Placas/<cliente>"). Este
// botón solo resuelve/crea esa carpeta, la abre en Drive para confirmarla y
// guarda el vínculo en el recibo — como cualquier archivo que se adjunte
// DESPUÉS (ej. tarjeta de circulación, foto de placas) cae en esa misma
// carpeta, el vínculo sigue siendo válido sin tener que repetir esta acción.
/* Movido a modules/recibos/index.js: _expDigVincularCarpeta */
// Alias por compatibilidad — el HTML del modal aún puede llamarlo por el
// nombre viejo antes de refrescarse el caché del navegador.
/* Movido a modules/expedientes/index.js: _expDigEnviar */

// "Ver en Drive": si ya se guardó el link de la carpeta, lo abre directo.
// Si el estatus se detectó como "vinculado" solo por evidencia (documentos
// con driveFileId de ANTES de que existiera el marcado automático, ver
// _expDigRenderStatus), todavía no tenemos el folderUrl guardado — se
// resuelve aquí mismo (sin crear nada nuevo, la carpeta ya existe) y se
// guarda para no tener que repetir la búsqueda la próxima vez.
/* Movido a modules/recibos/index.js: _expDigVerExpediente */
// ═══════════════════════════════════════════════════════
// FIN EXPEDIENTE DIGITAL VEHICULAR
// ═══════════════════════════════════════════════════════

// ── Mostrar una versión específica (letra) del folio EN EL MISMO visor de la
// Ficha del Folio, sin cerrarla ni abrir una ventana/overlay aparte. Se usa al
// hacer clic en el número de un recibo dentro de la tabla (ej. "1A", "1B").
// window._fichaPdfDefaultSrc guarda la última versión (la que activarModoConsulta
// cargó al abrir el folio); cerrarFichaFolio() restaura esa versión por defecto.
/* Movido a modules/contabilidad/index.js: _fichaVisorMostrarVersion */
/* Movido a modules/recibos/index.js: cerrarFichaFolio */

// ── Notificar a la UI abierta que un folio fue eliminado (local o por otro
// empleado vía realtime) ─────────────────────────────────────────────────
// El borrado en sí (tombstone + broadcast + limpieza de appData.recibos) ya
// existía en varios flujos, pero ninguno tocaba la Ficha del Folio ni el
// buscador de folios (chips) si estaban abiertos mostrando justo ese folio —
// por eso seguía "apareciendo" hasta refrescar manualmente. Esta función
// cierra/actualiza esas vistas puntuales; se llama después de eliminar,
// tanto en el cliente que borra como en los que reciben el broadcast.
window._notificarFolioEliminadoUI = function(folio, letra){
  try {
    var folioN = Number(folio);
    // 1. Ficha del Folio abierta con este folio → cerrar y avisar
    var modalFicha = document.getElementById('modal-ficha-folio');
    if (modalFicha && modalFicha.style.display !== 'none' && window._fichaReciboActual
        && Number(window._fichaReciboActual.folio) === folioN) {
      if (typeof cerrarFichaFolio === 'function') cerrarFichaFolio();
      if (typeof toast === 'function') toast('⚠️ El folio #' + (typeof folioFormato==='function'?folioFormato(folioN):folioN) + ' fue eliminado', 'err');
    }
    // 2. Buscador de folios (chips + resumen) mostrando este folio → refrescar
    var inputFolioAnt = document.getElementById('folio_anterior');
    if (inputFolioAnt && parseInt(inputFolioAnt.value, 10) === folioN
        && typeof cargarHistorialFolio === 'function') {
      cargarHistorialFolio();
    }
  } catch(e) { console.warn('[_notificarFolioEliminadoUI]', e); }
};

/* Movido a modules/core/index.js: fichaToggleNotas */

/* Movido a modules/expedientes/index.js: fichaGuardarNotas */


// ── FIN NOTAS ─────────────────────────────────────────────────────────────

/* Movido a modules/clientes/index.js: fichaImprimirHistorial */

// cerrarContabPDF - regresar a ficha si fue abierto desde ella
var _origCerrarContabPDF=window.cerrarContabPDF;
document.addEventListener('DOMContentLoaded',function(){
  if(typeof cerrarContabPDF==='function'){
    var orig=cerrarContabPDF;
    cerrarContabPDF=function(){
      orig.apply(this,arguments);
      if(window._fichaAbiertaAntes){
        window._fichaAbiertaAntes=false;
        setTimeout(function(){if(reciboEnConsulta)abrirFichaFolio();},400);
      }
    };
  }
});

// La Ficha del Folio ya NO es un modal flotante que se cierra al hacer clic
// afuera — es una sección fija e integrada de la página de resultados de
// búsqueda por folio (junto con el visor de PDF). Por eso este listener de
// "clic fuera cierra" fue retirado: cerrarFichaFolio() sigue existiendo para
// los flujos internos (Pago Total, Pago Parcial, Servicio Complementario,
// Vincular Archivo) que la ocultan momentáneamente antes de abrir otra
// pantalla, y para el botón ✕ manual — pero ya no se dispara por clics
// accidentales fuera de la tarjeta.


// ═══════════════════════════════════════════════════════════════
// CONTROL DE JUICIOS — MODAL PANTALLA COMPLETA
// ═══════════════════════════════════════════════════════════════

var _mexpIdx = -1; // índice del expediente abierto en el modal


// ── Abrir modal de expediente ──────────────────────────────────
/* Movido a modules/expedientes/index.js: abrirDetalle */

// ── Barra de etapas del expediente ────────────────────────────────────────
// Ubica el juicio de un vistazo y permite avanzarlo con un clic. Se inserta
// justo debajo del encabezado del visor; si el contenedor no existe todavía,
// se crea la primera vez. No sustituye ni depende de nada previo.
/* Movido a modules/administracion/index.js: _juRenderEtapas */
/* Movido a modules/expedientes/index.js: _juFijarEtapa */
// Igual que _juFijarEtapa pero para expedientes que ya tienen Flujo del
// Procedimiento generado — marca/desmarca j.flujoEtapaActual (mismo campo
// que usa el panel "Flujo del Procedimiento", para que ambas vistas del
// mismo expediente siempre coincidan en qué paso está "EN CURSO").
/* Movido a modules/expedientes/index.js: _juFijarEtapaFlujo */

// ══════════════════════════════════════════════════════════════════════════
// LECTURA DE ACUERDOS CON IA  ·  Mistral OCR  →  Groq  →  confirmación
// ──────────────────────────────────────────────────────────────────────────
// Mistral convierte el acuerdo escaneado en texto; Groq lee ese texto y saca
// tipo, fecha y plazo. NADA se guarda automáticamente: la IA solo rellena una
// tarjeta que la usuaria revisa, corrige si hace falta y confirma. Un término
// mal calculado tiene consecuencias legales, así que la responsabilidad de
// aceptarlo es siempre de una persona.
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// FICHA DEL EXPEDIENTE  ·  encabezado, aviso de término y pestañas
// ──────────────────────────────────────────────────────────────────────────
// Antes las tres columnas (Acuerdos, Flujo, Análisis IA) se mostraban a la vez
// y competían por la atención. Ahora se eligen con pestañas, y lo primero que
// se ve es lo que de verdad urge: el término abierto más próximo.
// ══════════════════════════════════════════════════════════════════════════

// Aviso de términos abiertos. A petición expresa (18/ago/2026) ya no vive
// como barra hasta el fondo del expediente — se muestra en la fila de STATS,
// ocupando el espacio que antes tenían las casillas "Acuerdos en Drive /
// Historial / Leyes activas" (ver #mexp-aviso-termino-slot en el HTML). La
// casilla "Próx. audiencia" se quitó por completo (era casi siempre el mismo
// dato que ya se ve aquí). A diferencia de antes, ya NO muestra solo el más
// urgente — muestra TODOS los términos abiertos que nos corresponde cumplir
// a nosotros (hay casos con varios términos simultáneos, uno por situación).
// Los términos de la contraparte o de una autoridad (t.responsable) se
// excluyen — ver _juTerminosPropiosAbiertos / _juEsResponsableNuestro.
/* Movido a modules/expedientes/index.js: _juRenderAvisoTermino */
// Marca UN término específico como cumplido (identificado por su id — antes
// esta función solo sabía cumplir "el más urgente"; ahora el aviso muestra
// varios términos a la vez, cada uno con su propio botón, así que necesita
// saber exactamente cuál).
/* Movido a modules/expedientes/index.js: _juCumplirTermino */
// Alias por compatibilidad — nada más lo llama ya (se sustituyó por
// _juCumplirTermino con id específico), pero se conserva por si algún botón
// viejo en caché de un cliente todavía lo referencia.
/* Movido a modules/expedientes/index.js: _juCumplirTerminoUrgente */

// Datos duros del expediente en el encabezado (partes, juzgado, honorarios…).
// Rediseño "Propuesta 5" (18/ago/2026): Ingreso/Teléfono/Control interno se
// quedan como texto simple; Juzgado, Folios de recibo vinculados (ahora
// pueden ser varios y cada uno es clicleable a su Ficha del Folio, con un
// botón "+" para seguir vinculando) y Carpeta física pasan a tarjetas.
/* Movido a modules/core/index.js: _juRenderDatosDuros */
// Modal ligero para capturar/editar el número o referencia de la carpeta
// física del expediente (independiente de la carpeta en Drive).
/* Movido a modules/expedientes/index.js: _juEditarCarpetaFisica */
/* Movido a modules/expedientes/index.js: _juGuardarCarpetaFisica */

// Pestañas que muestran una columna a la vez (o las tres).
/* Movido a modules/expedientes/index.js: _juRenderPestanas */
/* Movido a modules/core/index.js: _juTab */
/* Movido a modules/expedientes/index.js: _juAplicarTab */

// ── Notas y Recordatorios del expediente ───────────────────────────────────
// No crea un almacén de datos nuevo: reutiliza D.pendientes, filtrando los
// que ya están vinculados a este juicio (p.juicioVinculadoIdx). Así una nota
// creada aquí también aparece en Pendientes, y viceversa — un solo lugar de
// verdad, como pidió la usuaria.
/* Movido a modules/expedientes/index.js: _juRenderNotas */
// Abre el modal de Pendientes ya listo en la sección "Juicios" y vinculado a
// este expediente — evita que quien lo use tenga que buscar el expediente a
// mano con el selector.
/* Movido a modules/clientes/index.js: _juNuevaNota */

// ── Documentos Relacionados del expediente ──────────────────────────────────
// Subcarpetas reales en Drive por categoría, dentro de la carpeta del juicio
// (mismo folder padre que "Acuerdos", que conserva su propio panel con
// lectura IA — aquí NO se repite esa categoría para no duplicar función).
const _DOC_REL_CATEGORIAS = ['Demandas','Promociones','Notificaciones','Pruebas','Sentencias'];

/* Movido a modules/clientes/index.js: _docRelNombreCarpetaJuicio */
/* Movido a modules/documentos/index.js: _docRelClave */

/* Movido a modules/documentos/index.js: _juRenderDocRel */
/* Movido a modules/documentos/index.js: _docRelCambiarCat */
// Cargar caché local de inmediato, luego refrescar desde Drive (solo lee —
// no crea carpetas, para no llenar Drive de subcarpetas vacías por navegar).
/* Movido a modules/expedientes/index.js: _docRelCargar */
/* Movido a modules/documentos/index.js: _docRelRender */
/* Movido a modules/documentos/index.js: _docRelInputChange */
// Sube uno o varios PDFs a la subcarpeta de la categoría activa (creándola si
// hace falta, igual que la carpeta de Acuerdos ya existente).
/* Movido a modules/expedientes/index.js: _docRelSubirFiles */

// Barra con el botón de lectura + zona donde aparece la sugerencia.
// El botón "📷 Subir acuerdo y leerlo" se eliminó (18/ago/2026, a petición
// del usuario) — su función (leer con OCR y proponer un término) quedó
// fusionada dentro de "＋ Subir" en el panel "Acuerdos en Drive" (columna 1):
// ese botón ya sube el archivo, así que ahora también propone el término
// sobre el mismo texto OCR (ver subirAcuerdoDriveFiles, paso 6). Esta
// función solo deja listo el contenedor donde aparece la tarjeta morada de
// revisión cuando hay un plazo que confirmar.
/* Movido a modules/expedientes/index.js: _juRenderBarraIA */

// Pide a Groq que interprete el texto del acuerdo. Devuelve objeto o null.
/* Movido a modules/administracion/index.js: _juExtraerDatosAcuerdo */

// _juLeerAcuerdo() se eliminó (18/ago/2026) — era el handler del botón
// "📷 Subir acuerdo y leerlo", ahora fusionado dentro de "＋ Subir"
// (subirAcuerdoDriveFiles, panel Acuerdos en Drive).

// Tarjeta morada: todo editable, nada se guarda hasta confirmar.
/* Movido a modules/expedientes/index.js: _juPintarSugerencia */
/* Movido a modules/core/index.js: _juSugRecalc */
/* Movido a modules/core/index.js: _juDescartarSugerencia */
// Aquí sí se escribe: crea la actuación y, si hay plazo, el término.
/* Movido a modules/expedientes/index.js: _juConfirmarSugerencia */

/* Movido a modules/expedientes/index.js: cerrarModalExpediente */

// ── Confirmar cerrar/archivar expediente con eliminación de R2 ─
/* Movido a modules/clientes/index.js: confirmarCerrarExpediente */

// ── Documentos R2 ──────────────────────────────────────────────
// cargarDocsR2 — reemplazada por initAcuerdosDrive; se mantiene vacía para compatibilidad
/* Movido a modules/expedientes/index.js: cargarDocsR2 */

/* Movido a modules/expedientes/index.js: subirDocR2 */

/* Movido a modules/expedientes/index.js: verDocR2 */

/* Movido a modules/expedientes/index.js: eliminarDocR2 */

/* Movido a modules/expedientes/index.js: ocrDocR2 */

/* Movido a modules/core/index.js: _blobToBase64 */

// ── Historial ─────────────────────────────────────────────────
/* Movido a modules/expedientes/index.js: renderHistorialModal */

/* Movido a modules/expedientes/index.js: guardarFechaNotificacion */

/* Movido a modules/expedientes/index.js: abrirResumenDesdeHistorial */

/* Movido a modules/core/index.js: abrirFormHistorial */

/* Movido a modules/core/index.js: cerrarFormHistorial */

/* Movido a modules/expedientes/index.js: guardarEntradaHistorial */

// ── Leyes del caso ─────────────────────────────────────────────
// Las leyes del despacho se guardan en localStorage como array de objetos {nombre, path}
// Cada juicio guarda en j.leyesActivas = [nombre, nombre, ...]

/* Movido a modules/expedientes/index.js: getLeyesDespacho */
/* Movido a modules/expedientes/index.js: setLeyesDespacho */

/* Movido a modules/expedientes/index.js: actualizarContadorLeyes */

/* Movido a modules/expedientes/index.js: abrirModalLeyes */

/* Movido a modules/expedientes/index.js: cerrarModalLeyes */

/* Movido a modules/expedientes/index.js: renderListaLeyes */

/* Movido a modules/expedientes/index.js: toggleLeyActiva */

/* Movido a modules/expedientes/index.js: subirNuevaLey */


// ══════════════════════════════════════════════════════════════
// GESTIÓN DE LEYES DEL DESPACHO — solo administrador
// Drive: LEX-MEXICO/Leyes-Despacho/   (carpeta fija, ID en localStorage)
// ══════════════════════════════════════════════════════════════
const LEYES_DRIVE_FOLDER_NAME = 'Leyes-Despacho';
const DRIVE_LEYES_LS_KEY = 'lex_leyes_drive_carpeta_id';
const LEYES_CACHE_LS_KEY = 'lex-leyes-despacho';

// ── Mostrar/ocultar botón según rol ──
/* Movido a modules/administracion/index.js: _leyesInicializarBtnAdmin */

// ── Obtener o crear carpeta Leyes-Despacho en Drive ──
/* Movido a modules/expedientes/index.js: _leyesObtenerCarpetaDrive */

// ── SHA-256 de un File ──
/* Movido a modules/integraciones/index.js: _sha256File */

// ── Listar PDFs de la carpeta Leyes en Drive ──
/* Movido a modules/expedientes/index.js: _leyesListarDrive */

// ── Abrir modal ──
/* Movido a modules/administracion/index.js: abrirModalCargarLeyes */

/* Movido a modules/expedientes/index.js: cerrarModalCargarLeyes */

// ── Render lista admin ──
/* Movido a modules/administracion/index.js: _leyesRenderAdmin */

// ── Ver PDF de una ley ──
/* Movido a modules/expedientes/index.js: _leyesVerPDF */

// ── Eliminar ley ──
/* Movido a modules/expedientes/index.js: _leyesEliminar */

// ── Handler de archivos (drag&drop o input) ──
/* Movido a modules/expedientes/index.js: _leyesHandleFiles */


// ══════════════════════════════════════════════════════════════════
// FLUJO DEL PROCEDIMIENTO — generado por IA con ley seleccionada
// ══════════════════════════════════════════════════════════════════

// Mostrar botón "Generar Flujo" solo para admin al abrir expediente
/* Movido a modules/administracion/index.js: _flujoInicializarBtn */

// Abrir selector de ley para generar flujo
/* Movido a modules/expedientes/index.js: abrirSelectorFlujo */

// ── Reparador de JSON para respuestas de IA (Gemini/Groq) ──
// Causa raíz de "Unterminated string" / "Expected double-quoted property name":
// el modelo mete comillas dobles SIN escapar dentro del texto de un campo
// (ej. plazo: "20 días, según el "artículo 55""), lo que cierra la cadena
// antes de tiempo; o la respuesta se corta a medias por el límite de tokens.
// Esta función intenta varias reparaciones progresivas antes de rendirse.
/* Movido a modules/core/index.js: _flujoRepararYParsear */
// Busca dentro del texto completo de la ley el punto donde empieza el
// capítulo/título relevante para el tipo de juicio, para no quedarnos solo
// con las primeras páginas (que suelen ser disposiciones generales) cuando
// el código es largo y hay que recortar por el límite de tokens de Groq.
/* Movido a modules/expedientes/index.js: _leyLocalizarSeccion */
// Llama a Gemini con un límite de tokens dado; devuelve texto + motivo de cierre.
// Generar flujo con IA (Groq/Cloudflare) usando la ley elegida
/* Movido a modules/expedientes/index.js: _flujoGenerarConLey */

// Renderizar el flujo en el panel — SOLO TÍTULOS clickeables
/* Movido a modules/expedientes/index.js: _flujoRender */

// Abrir pantalla de detalle de una etapa del flujo
/* Movido a modules/expedientes/index.js: _flujoAbrirDetalle */

// Manda ESTA etapa sola a la IA (con el texto completo de la ley, sin recorte
// compartido entre etapas) pidiendo el máximo detalle y cita textual del
// fundamento legal. Al terminar, actualiza la etapa en pantalla y la guarda.
/* Movido a modules/integraciones/index.js: _flujoProfundizarEtapa */

// Marcar (o quitar) la etapa actual del procedimiento — manual, persistente
/* Movido a modules/expedientes/index.js: _flujoMarcarEtapaActual */

// Inferir la etapa actual con IA, según los documentos cargados (acuerdos + historial)
/* Movido a modules/expedientes/index.js: _flujoDetectarEtapa */

// ══════════════════════════════════════════════════════════════════
// CHAT DE REDACTAR ESCRITO — dentro del visor de acuerdos
// ══════════════════════════════════════════════════════════════════
let _escritoChatAcuerdo = null; // acuerdo activo en el chat
let _escritoChatHistorial = []; // historial de mensajes

/* Movido a modules/expedientes/index.js: _acuerdoAbrirChatEscrito */

/* Movido a modules/administracion/index.js: _escritoEnviar */

/* Movido a modules/core/index.js: _escritoCopiar */


// ── Pre-Recibo (placeholder — implementación completa pendiente) ──
// ══════════════════════════════════════════════════════════════
// PRE-RECIBO — Sistema completo
// ══════════════════════════════════════════════════════════════

/* Movido a modules/recibos/index.js: _prR2Path */

/* Movido a modules/recibos/index.js: _prGuardar */

/* Movido a modules/recibos/index.js: _prCargarDesdeR2 */

/* Movido a modules/recibos/index.js: _prGetAll */

/* Movido a modules/core/index.js: _prById */

/* Movido a modules/recibos/index.js: _prEstadoColor */

/* Movido a modules/core/index.js: _prTotalGastos */

// ── Abrir panel principal Pre-Recibo ──
/* Movido a modules/recibos/index.js: abrirPreRecibo */

// Inicializar panel cuando ir() lo activa
/* Movido a modules/documentos/index.js: _prInicializarPanel */

// Nuevo pre-recibo desde botón del panel
/* Movido a modules/core/index.js: _prNuevo */


// ── Volver a lista y restaurar botón ──
/* Movido a modules/recibos/index.js: _prVolverLista */

// ── Renderizar lista de pre-recibos ──
/* Movido a modules/recibos/index.js: _prRenderLista */

// ── Abrir formulario de pre-recibo (nuevo o editar) ──
/* Movido a modules/directorio/index.js: _prAbrirFormulario */

// ── Renderizar lista de gastos en el formulario ──
/* Movido a modules/core/index.js: _prRenderGastos */

// ── Agregar gasto inline ──
/* Movido a modules/recibos/index.js: _prAgregarGastoUI */

/* Movido a modules/recibos/index.js: _prConfirmarGasto */

/* Movido a modules/core/index.js: _prEliminarGasto */

// ── Guardar formulario ──
/* Movido a modules/directorio/index.js: _prGuardarFormulario */

// ── Eliminar pre-recibo ──
/* Movido a modules/recibos/index.js: _prEliminar */

// ── Convertir a recibo oficial ──
/* Movido a modules/recibos/index.js: _prConvertirARecibo */

// ── Imprimir estado de cuenta ──
/* Movido a modules/core/index.js: _prImprimirEstadoCuenta */

// ── Redactar escrito ──────────────────────────────────────────
/* Movido a modules/expedientes/index.js: abrirModalEscrito */

/* Movido a modules/core/index.js: cerrarModalEscrito */

/* Movido a modules/expedientes/index.js: generarEscritorIA */

// ── Grounding: leer el texto real de las leyes activas del caso ────────
// Antes estas funciones solo mandaban a la IA el NOMBRE de las leyes
// ("Leyes activas: X, Y, Z"), nunca su contenido — por eso las respuestas
// (fundamentos, artículos, plazos) salían de conocimiento general de la IA,
// no de las leyes realmente cargadas para el caso. Ahora se descarga y lee
// (OCR) el PDF de cada ley activa y se manda su texto como fuente única y
// obligatoria, igual que ya se hacía en "Generar Flujo con ley".
window._analisisIACache = window._analisisIACache || {};
/* Movido a modules/expedientes/index.js: _obtenerTextoLeyesActivas */

// Llama a la IA anteponiendo el texto de las leyes activas como fuente única
// y obligatoria. Si el texto es grande y Cloudflare (contexto largo) está
// configurado, se usa directo — Groq no podría con textos así de grandes.
/* Movido a modules/expedientes/index.js: _iaLlamarGrounded */

// Igual que _llamarGeminiIA pero primero lee las leyes activas del caso y
// las manda como fundamento — usado por el chat de "ANÁLISIS IA".
/* Movido a modules/expedientes/index.js: _llamarGeminiIAConLeyes */

// ── IA — Análisis de expediente ─────────────────────────────────
/* Movido a modules/clientes/index.js: analizarExpedienteIA */

/* Movido a modules/clientes/index.js: preguntaRapidaIA */

/* Movido a modules/clientes/index.js: enviarPreguntaIA */

/* Movido a modules/core/index.js: _agregarMensajeIA */

/* Movido a modules/integraciones/index.js: _llamarGeminiIA */

/* Movido a modules/integraciones/index.js: _llamarGeminiIADirecto */

// ── R2 eliminar helper (si no existe) ─────────────────────────
if(typeof window.eliminarR2 === 'undefined'){
  window.eliminarR2 = async function(path, bucket){
    try{
      const res = await fetch(R2_WORKER + '/r2/delete?bucket=' + encodeURIComponent(bucket||'juicios'), {
        method: 'DELETE',
        headers: { 'X-Auth-Token': await _r2AuthToken() },
        body: JSON.stringify({ path })
      });
      return res.ok;
    } catch(e){ console.error('eliminarR2:', e); return false; }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SCANSYS v2 — powered by window.LEX_ERRORS
// Monitor de errores en tiempo real, robusto, sin lógica redundante con LEX_ERRORS
// ══════════════════════════════════════════════════════════════════════════════
(function(){

  /* ── Asegurar que LEX_ERRORS existe ──────────────────────────────────── */
  if(!Array.isArray(window.LEX_ERRORS)) window.LEX_ERRORS = [];

  /* ── Estado del monitor (el panel viejo se eliminó — solo queda el
     intervalo del monitor periódico de abajo) ─────────────────────────── */
  const SS = window._scansys = {
    _interval: null
  };

  /* ── Interceptar console.warn y console.error → LEX_ERRORS ──────────── */
  // Capturar nativos ANTES de cualquier reemplazo
  const _NAT = {
    error: console.error.bind(console),
    warn:  console.warn.bind(console)
  };
  window.__ssOrigConsole = _NAT;

  function _interceptar(){
    // Idempotente: antes se llamaba solo desde scansysInit(), pero ahora también
    // se instala de inmediato al cargar, así que hay que evitar envolver la
    // consola dos veces (se duplicarían todas las entradas).
    if(window.__ssInterceptado) return;
    window.__ssInterceptado = true;
    ['error','warn'].forEach(function(nivel){
      console[nivel] = function(){
        _NAT[nivel].apply(console, arguments);
        const txt = Array.from(arguments).map(function(a){
          if(a instanceof Error) return a.message;
          try{ return typeof a==='object'&&a?JSON.stringify(a).slice(0,400):String(a); }catch(e){ return '[no serializable]'; }
        }).join(' ');
        // Determinar stack
        let stack = null;
        for(let i=0;i<arguments.length;i++){
          if(arguments[i] instanceof Error && arguments[i].stack){ stack=arguments[i].stack; break; }
        }
        _lexPush(nivel==='error'?'error':'warn', 'console.'+nivel, txt, stack);
      };
    });
    window.addEventListener('error', function(ev){
      _lexPush('error','window.error',
        ev.message + ' — ' + (ev.filename||'').split('/').pop() + ':' + ev.lineno,
        ev.error ? ev.error.stack : null,
        { linea: ev.lineno, col: ev.colno, archivo: ev.filename }
      );
    });
    window.addEventListener('unhandledrejection', function(ev){
      const r = ev.reason;
      _lexPush('error','Promise.rejection',
        r instanceof Error ? r.message : String(r),
        r instanceof Error ? r.stack   : null
      );
    });
  }

  /* ── Push a LEX_ERRORS con dedup por mensaje+módulo en ventana de 2s ── */
  function _lexPush(nivel, modulo, mensaje, stack, extra){
    const ahora = Date.now();
    // Dedup: ignorar si el mismo módulo+mensaje llegó hace menos de 2s
    const ultimo = window.LEX_ERRORS[window.LEX_ERRORS.length - 1];
    if(ultimo && ultimo.modulo===modulo && ultimo.mensaje===mensaje && (ahora-new Date(ultimo.fecha).getTime())<2000) return;

    const entry = {
      fecha:   new Date().toISOString(),
      nivel:   nivel,           // 'error' | 'warn' | 'info'
      modulo:  String(modulo||'').slice(0,120),
      mensaje: String(mensaje||'').slice(0,800),
      stack:   stack ? String(stack).split('\n').slice(0,8).join('\n') : null,
      extra:   extra || null,
      // Snapshot del sistema en el momento del error
      snap: {
        recibos:   typeof appData!=='undefined'&&Array.isArray(appData.recibos) ? appData.recibos.length : null,
        movs:      typeof D!=='undefined'&&Array.isArray(D.movimientos) ? D.movimientos.length : null,
        supabase:  !!(window.SB && window.SB_DESPACHO_ID),
        usuario:   typeof empleadoActual!=='undefined'&&empleadoActual ? (empleadoActual.nombre||empleadoActual.email||'') : null,
        caja:      typeof cajaCerrada!=='undefined' ? cajaCerrada : null,
        panel:     (function(){ try{ return document.querySelector('.panel.active')?.id||null; }catch(e){ return null; } })()
      }
    };

    window.LEX_ERRORS.push(entry);
    if(window.LEX_ERRORS.length > 500) window.LEX_ERRORS.shift();

    // Actualizar badge sidebar
    _actualizarBadge();
  }
  // Exponer para que registrarError() también lo use
  window._lexPush = _lexPush;

  /* ── Parche sobre registrarError() para que también alimente LEX_ERRORS ─ */
  // registrarError ya existe en el código principal — lo envolvemos
  const _registrarErrorOrig = window.registrarError;
  window.registrarError = function(modulo, error, extra){
    if(typeof _registrarErrorOrig === 'function') _registrarErrorOrig(modulo, error, extra);
    const msg = error instanceof Error ? error.message : String(error||'');
    const stk = error instanceof Error ? error.stack   : null;
    _lexPush('error', modulo, msg, stk, extra||{});
  };

  /* ── Badge en sidebar ────────────────────────────────────────────────── */
  function _actualizarBadge(){
    const b = document.getElementById('scansys-badge');
    if(!b) return;
    const n = window.LEX_ERRORS.filter(function(e){ return e.nivel==='error'; }).length;
    if(n>0){ b.style.display='inline-flex'; b.textContent=n>99?'99+':n; }
    else { b.style.display='none'; }
  }

  /* ── CHECADOR: clasificación robusta (sirve tanto para entradas nuevas, que
     ya traen entradaMinutos, como para entradas viejas guardadas antes de este
     fix, que solo traen el texto "inicio" tipo "12:09 a.m.") ──────────────── */
  function _checadorParseHora(str){
    const m = /^(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i.exec(String(str||'').trim());
    if(!m) return null;
    let h = parseInt(m[1],10);
    const min = parseInt(m[2],10);
    if(m[3].toLowerCase()==='a'){ if(h===12) h=0; } else { if(h!==12) h+=12; }
    return h*60+min;
  }
  function _checadorClasificar(e){
    // Domingo no es día laboral: si hay una conexión (casi siempre porque se
    // le habilitó tiempo extra a la empleada para que revise pendientes de
    // la semana, no para "trabajar" el turno completo), SÍ se muestra en el
    // Checador, pero nunca cuenta como tardanza — un domingo no tiene "hora
    // de entrada oficial" contra la cual medir retraso.
    if(typeof e.dia === 'string' && e.dia.toLowerCase().startsWith('domingo')){
      return { estado:'domingo', minutosTarde:0 };
    }
    const mins = (typeof e.entradaMinutos === 'number') ? e.entradaMinutos : _checadorParseHora(e.inicio);
    if(mins == null) return { estado: e.estado||'—', minutosTarde: e.minutosTarde||0 };
    const inicio   = _minutosDeHHMM(HORARIO_CAPTURA_INICIO);
    const apertura = _minutosDeHHMM(HORARIO_APERTURA_SISTEMA);
    const fin      = _minutosDeHHMM(HORARIO_CAPTURA_FIN);
    if(mins < apertura || mins > fin) return { estado:'fuera_horario', minutosTarde:0 };
    const minutosTarde = Math.max(0, mins - inicio);
    const estado = mins > (inicio + TOLERANCIA_TARDANZA_MIN) ? 'tarde' : 'puntual';
    return { estado: estado, minutosTarde: estado==='tarde' ? minutosTarde : 0 };
  }
  function _checadorBadge(cl){
    if(cl.estado === 'tarde') return '<span style="background:rgba(192,22,26,0.1);color:#c0161a;padding:2px 8px;border-radius:4px;font-size:0.62rem;font-weight:700;">TARDE · '+cl.minutosTarde+' min</span>';
    if(cl.estado === 'puntual') return '<span style="background:rgba(26,122,58,0.1);color:#1a7a3a;padding:2px 8px;border-radius:4px;font-size:0.62rem;font-weight:700;">PUNTUAL</span>';
    if(cl.estado === 'domingo') return '<span title="Conexión en domingo (no es día laboral) — no cuenta como tardanza" style="background:rgba(26,74,138,0.1);color:#1a4a8a;padding:2px 8px;border-radius:4px;font-size:0.62rem;font-weight:700;">DOMINGO</span>';
    if(cl.estado === 'fuera_horario') return '<span title="Conexión fuera del horario 7:00 a. m.–5:30 p. m. — probablemente el administrador dando mantenimiento" style="background:rgba(120,120,120,0.12);color:#6a6250;padding:2px 8px;border-radius:4px;font-size:0.62rem;font-weight:700;">⚙ FUERA DE HORARIO</span>';
    return '<span style="color:#9a8050;font-size:0.62rem;">—</span>';
  }

  /* ── CHECADOR: tabla del día + resumen mensual de puntualidad ──────────── */
  async function _renderChecador(){
    const panel = document.getElementById('ss-body-checador');
    if(!panel) return;
    panel.innerHTML = '<div style="color:#7a6840;font-family:monospace;font-size:0.7rem;">Cargando checador...</div>';
    let log = [];
    try{ if(typeof cargarLogDiario==='function') log = await cargarLogDiario(); }catch(e){ log = []; }
    const ahora = new Date();
    const diaKeyHoy = ahora.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', weekday:'long', year:'numeric', month:'2-digit', day:'2-digit' });
    // Las conexiones fuera del horario 8:30–5:30 (mantenimiento del administrador)
    // no se muestran: no son asistencia real y solo confunden el Checador.
    const hoyEntries = log.filter(function(e){ return e.dia === diaKeyHoy && _checadorClasificar(e).estado !== 'fuera_horario'; });
    const mesActual  = ahora.getMonth();
    const anioActual = ahora.getFullYear();
    const resumenPorEmail = {};
    log.forEach(function(e){
      if(!e.ts) return;
      const d = new Date(e.ts);
      if(d.getMonth() !== mesActual || d.getFullYear() !== anioActual) return;
      const cl = _checadorClasificar(e);
      // Las conexiones fuera del horario 8:30–5:30 no son asistencia real
      // (mantenimiento del administrador): no se cuentan ni aparecen aquí.
      if(cl.estado === 'fuera_horario') return;
      if(!resumenPorEmail[e.email]) resumenPorEmail[e.email] = { nombre:e.nombre, dias:0, tardanzas:0, minutosTotal:0 };
      resumenPorEmail[e.email].dias++;
      if(cl.estado === 'tarde'){
        resumenPorEmail[e.email].tardanzas++;
        resumenPorEmail[e.email].minutosTotal += cl.minutosTarde;
      }
    });
    const filasHoy = hoyEntries.length ? hoyEntries.map(function(e){
      const cl = _checadorClasificar(e);
      return '<tr style="border-bottom:1px solid #ecdfa8;">'
        +'<td style="padding:8px 10px;">'+escHTML(e.nombre||e.email)+'</td>'
        +'<td style="padding:8px 10px;font-family:monospace;">'+escHTML(e.inicio||'—')+'</td>'
        +'<td style="padding:8px 10px;">'+_checadorBadge(cl)+'</td>'
        +'<td style="padding:8px 10px;font-family:monospace;color:#7a6840;">'+escHTML(e.cierre||'—')+'</td>'
        +'</tr>';
    }).join('') : '<tr><td colspan="4" style="padding:16px;text-align:center;color:#9a8050;">Sin conexiones registradas hoy</td></tr>';
    const filasResumen = Object.keys(resumenPorEmail).length ? Object.keys(resumenPorEmail).map(function(email){
      const r = resumenPorEmail[email];
      return '<tr style="border-bottom:1px solid #ecdfa8;">'
        +'<td style="padding:8px 10px;">'+escHTML(r.nombre||email)+'</td>'
        +'<td style="padding:8px 10px;text-align:center;">'+r.dias+'</td>'
        +'<td style="padding:8px 10px;text-align:center;color:'+(r.tardanzas>0?'#c0161a':'#1a7a3a')+';font-weight:700;">'+r.tardanzas+'</td>'
        +'<td style="padding:8px 10px;text-align:center;font-family:monospace;">'+(r.tardanzas>0?Math.round(r.minutosTotal/r.tardanzas):0)+' min prom.</td>'
        +'</tr>';
    }).join('') : '<tr><td colspan="4" style="padding:16px;text-align:center;color:#9a8050;">Sin datos este mes</td></tr>';
    // FIX: "RESUMEN DEL MES" solo mostraba UNA fila agregada por empleado
    // (total de días, tardanzas y promedio), sin ver el detalle de cada día
    // — a diferencia de Contabilidad, que sí muestra un renglón por fecha.
    // Se agrega abajo una bitácora día por día del mes (una fila por cada
    // registro de conexión), ordenada del más reciente al más antiguo, igual
    // que una tabla de movimientos mensual.
    const _diasMes = log.filter(function(e){
      if(!e.ts) return false;
      const d = new Date(e.ts);
      if(d.getMonth() !== mesActual || d.getFullYear() !== anioActual) return false;
      return _checadorClasificar(e).estado !== 'fuera_horario';
    }).sort(function(a,b){ return (b.ts||0) - (a.ts||0); });
    const filasDiasMes = _diasMes.length ? _diasMes.map(function(e){
      const cl = _checadorClasificar(e);
      const fechaCorta = (function(){
        try {
          const d = new Date(e.ts);
          return d.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', weekday:'short', day:'2-digit', month:'short' }).toUpperCase().replace('.', '');
        } catch(err){ return e.dia || '—'; }
      })();
      return '<tr style="border-bottom:1px solid #ecdfa8;">'
        +'<td style="padding:8px 10px;font-family:monospace;font-weight:700;color:#8c6518;white-space:nowrap;">'+escHTML(fechaCorta)+'</td>'
        +'<td style="padding:8px 10px;">'+escHTML(e.nombre||e.email)+'</td>'
        +'<td style="padding:8px 10px;font-family:monospace;">'+escHTML(e.inicio||'—')+'</td>'
        +'<td style="padding:8px 10px;">'+_checadorBadge(cl)+'</td>'
        +'<td style="padding:8px 10px;font-family:monospace;color:#7a6840;">'+escHTML(e.cierre||'—')+'</td>'
        +'</tr>';
    }).join('') : '<tr><td colspan="5" style="padding:16px;text-align:center;color:#9a8050;">Sin conexiones registradas este mes</td></tr>';
    const _diaNombre = ahora.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', weekday:'long' }).toUpperCase();
    const _diaNum    = ahora.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', day:'2-digit' });
    const _mesNombre = ahora.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', month:'long' });
    const _anioNum   = ahora.toLocaleDateString('es-MX', { timeZone:'America/Mexico_City', year:'numeric' });
    const _fechaEncabezado = '"'+_diaNombre+'" '+_diaNum+' de '+_mesNombre+' de '+_anioNum;
    panel.innerHTML =
      '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px;">'
      +'<span style="font-family:monospace;font-weight:800;letter-spacing:0.06em;color:#3a2c10;font-size:0.8rem;">🕐 CHECADOR — HOY</span>'
      +'<span style="font-family:monospace;font-weight:700;color:#8c6518;font-size:0.72rem;">'+escHTML(_fechaEncabezado)+'</span>'
      +'</div>'
      +'<div style="font-size:0.62rem;color:#9a8050;margin-bottom:10px;">Horario laboral: 8:30 a. m. – 5:30 p. m. (el sistema se habilita desde las 7:00 a. m. por si llegan temprano). Las conexiones fuera de la ventana 7:00 a. m.–5:30 p. m. se consideran mantenimiento del administrador y no se registran.</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:0.76rem;margin-bottom:26px;">'
      +'<thead><tr style="background:rgba(26,122,58,0.07);"><th style="padding:8px 10px;text-align:left;color:#1a7a3a;font-size:0.62rem;text-transform:uppercase;">Empleado</th><th style="padding:8px 10px;text-align:left;color:#1a7a3a;font-size:0.62rem;text-transform:uppercase;">Entrada</th><th style="padding:8px 10px;text-align:left;color:#1a7a3a;font-size:0.62rem;text-transform:uppercase;">Estado</th><th style="padding:8px 10px;text-align:left;color:#1a7a3a;font-size:0.62rem;text-transform:uppercase;">Última conexión</th></tr></thead>'
      +'<tbody>'+filasHoy+'</tbody></table>'
      +'<div style="font-family:monospace;font-weight:800;letter-spacing:0.06em;color:#3a2c10;font-size:0.8rem;margin-bottom:10px;">📅 RESUMEN DEL MES</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:0.76rem;margin-bottom:22px;">'
      +'<thead><tr style="background:rgba(200,149,42,0.07);"><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Empleado</th><th style="padding:8px 10px;text-align:center;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Días conectado</th><th style="padding:8px 10px;text-align:center;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Tardanzas</th><th style="padding:8px 10px;text-align:center;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Prom. retraso</th></tr></thead>'
      +'<tbody>'+filasResumen+'</tbody></table>'
      +'<div style="font-family:monospace;font-weight:800;letter-spacing:0.06em;color:#3a2c10;font-size:0.8rem;margin-bottom:10px;">🗓️ BITÁCORA DEL MES — DÍA POR DÍA</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:0.76rem;">'
      +'<thead><tr style="background:rgba(200,149,42,0.07);"><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Fecha</th><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Empleado</th><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Entrada</th><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Estado</th><th style="padding:8px 10px;text-align:left;color:#8c6518;font-size:0.62rem;text-transform:uppercase;">Última conexión</th></tr></thead>'
      +'<tbody>'+filasDiasMes+'</tbody></table>';
  }
  window._renderChecador = _renderChecador;


  /* ── Monitor periódico: vigilar D.movimientos y sincronización ────────── */
  let _lastMovCount = null;
  function _monitorLoop(){
    if(SS._interval) clearInterval(SS._interval);
    SS._interval = setInterval(function(){
      // Vigilar caída en D.movimientos
      const cnt = (typeof D!=='undefined'&&Array.isArray(D.movimientos)) ? D.movimientos.length : null;
      if(_lastMovCount !== null && cnt !== null && cnt < _lastMovCount){
        const perdidos = _lastMovCount - cnt;
        const intencionales = window._adminDeletedMovs || 0;
        window._adminDeletedMovs = 0;
        if(intencionales < perdidos){
          _lexPush('error','monitor.movimientos',
            'D.movimientos cayó '+_lastMovCount+' → '+cnt+' ('+perdidos+' eliminado(s) sin acción de admin)',
            null,{ antes: _lastMovCount, despues: cnt }
          );
        }
      }
      _lastMovCount = cnt;
      _actualizarBadge();
    }, 30000);
    // Primera revisión rápida
    setTimeout(function(){ _lastMovCount=(typeof D!=='undefined'&&Array.isArray(D.movimientos))?D.movimientos.length:null; }, 2000);
  }

  /* ── Inicialización ──────────────────────────────────────────────────── */
  function esAdmin(){
    return typeof empleadoActual!=='undefined' && empleadoActual &&
           typeof ADMIN_EMAIL!=='undefined' &&
           empleadoActual.email.toLowerCase()===ADMIN_EMAIL.toLowerCase();
  }

  window.scansysInit = function(){
    if(!esAdmin()) return;
    const nav = document.getElementById('nav-scansys');
    if(nav) nav.style.display = 'block';
    _interceptar();
    _monitorLoop();
    _lexPush('info','scansys','SCANSYS v2 activado — monitor LEX_ERRORS activo');
  };

  // ── CAPTURA DE ERRORES: SIEMPRE ACTIVA ────────────────────────────────────
  // Antes la captura (console.error/warn, errores de JS y promesas rechazadas)
  // solo se instalaba dentro de scansysInit(), es decir: únicamente para el
  // administrador y 2 segundos DESPUÉS de cargar la página. Todo lo que fallara
  // antes de ese momento, o mientras trabajaba un empleado, no quedaba
  // registrado en ninguna parte — por eso "Errores del Sistema" podía verse en
  // cero aunque algo hubiera fallado. Ahora se instala de inmediato y para
  // cualquier usuario; el panel sigue siendo solo para el administrador.
  _interceptar();

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ if(esAdmin()) scansysInit(); }, 2000); });
  } else {
    setTimeout(function(){ if(esAdmin()) scansysInit(); }, 2000);
  }

})();
// ══════════════════════════════════════════════════════════════════════════════
