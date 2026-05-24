/* ═══════════════════════════════════════════════════════════════
   LEX-MÉXICO · app.js
   Configuración global, Drive, modales propios, atajos de teclado, navegación
   Dependencias: utils.js debe cargarse primero
═══════════════════════════════════════════════════════════════ */

// ════════════════════════════════════════════════════════════════
// BLOQUE 2 — originalmente en línea 9154 de index.html
// ════════════════════════════════════════════════════════════════

// ═══ CONFIGURACIÓN DRIVE ═══
// CLIENT ID unificado con el sistema de recibos (proyecto único en Google Cloud Console)

// (Referencia eliminada: contabilidad migrada a Supabase)
// DEMO: 1yAY4BUGx6cUQWflctoeK6WVKulS3AHsZR9ksexQrIlg (archivo de prueba)
// PRODUCCIÓN: cambiar por el ID del archivo CONTABILIDAD 2026 real cuando esté listo

// ─── DIRECTORIO (directorio guardado en Supabase vía D.directorio) ─
// ─── Variables de runtime (juicios/carpetas modal) ───────────────
let jdetIdx=-1; // índice del juicio abierto en detalle
let driveFoldersCache=[]; // cache de carpetas de Drive vinculadas a juicios
let driveFolderSeleccionado=null; // {id, name} carpeta seleccionada en modal
let acuerdoPDFPendiente=null; // File object pendiente de subir

// ═══ ESTADO ═══
let D={movimientos:[],directorio:[],carpetas:[],juicios:[],pendientes:[],cierres:[],prestamos:[],saldoAcumulado:0};
let REC={folioActual:100,recibos:[]}; // Se sobrescribe con datos de Drive al conectar
let filtroC='todo',filtroDT='todos',filtroCT='todas',filtroJ='todos',filtroP='activos',filtroSeccion='todas',modo='ingreso';
let eiC=-1,eiK=-1,eiJ=-1,eiP=-1;

// ─── BLOQUEO DE CAJA ─────────────────────────────────────────────
// Guarda la fecha en que se cerró la caja. Al día siguiente se libera solo.
function cajaBloqueada() {
  const fechaCierre = localStorage.getItem('caja_cerrada_fecha');
  return fechaCierre === hoy();
}
function marcarCajaCerrada() {
  try{ localStorage.setItem('caja_cerrada_fecha', hoy()); } catch(e){ registrarError('localStorage.setItem', e); }
}
function aplicarEstadoCierre() {
  const bloqueada = cajaBloqueada();
  const saldoTotal = getSaldo();
  const acumulado = D.saldoAcumulado || 0;

  // ¿El cierre de hoy fue registrado como "sin movimientos"?
  const cierreHoy = (D.cierres || []).find(c => c && c.fecha === hoy());
  const cerradaSinMovs = bloqueada && cierreHoy && cierreHoy.sinMovimientos === true;

  // Barra inferior — reconstruir según estado
  const bar = document.querySelector('.cierre-bar');
  if (bar) {
    if (bloqueada) {
      const lineaSup = cerradaSinMovs
        ? 'Caja cerrada — Sin movimientos contables durante la jornada'
        : 'Caja cerrada — se habilita mañana';
      bar.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;flex:1;">
          <div>
            <div style="font-family:monospace;font-size:0.6rem;color:rgba(77,202,106,0.6);text-transform:uppercase;letter-spacing:0.1em;">${lineaSup}</div>
            <div style="font-family:monospace;font-size:1.5rem;font-weight:700;color:#4dca6a;">$${fmt(saldoTotal)}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          
        </div>`;
    } else {
      bar.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;flex:1;">
          <div>
            <div class="cierre-info">${acumulado > 0 ? 'Saldo en caja (incluye días anteriores)' : 'Saldo actual en caja'}</div>
            <div class="cierre-monto" id="cierreMonto">$${fmt(saldoTotal)}</div>
            ${acumulado > 0 ? `<div style="font-family:monospace;font-size:0.58rem;color:rgba(77,202,106,0.55);margin-top:2px;">Días anteriores sin retirar: $${fmt(acumulado)}</div>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          
          <button class="btn btn-success" onclick="cerrarCaja()">🔒 Cerrar Caja</button>
        </div>`;
    }
  }

  // ── Selectores de todos los controles que registran ingresos o egresos ──
  const selectoresBloqueables = [
    // Nuevo recibo y captura rápida
    '[onclick="ir(\'nuevo-recibo\')"]',
    '[onclick="abrirLibre()"]',
    // Botones de ingreso / egreso en captura rápida (modal libre)
    '#libreBtn-ingreso',
    '#libreBtn-egreso',
    '#libreBtn-registrar',
    '#libreBtn-carrito',
    // Otros botones de agregar movimiento manual en contabilidad
    '[onclick="agregarIngreso()"]',
    '[onclick="agregarEgreso()"]',
    // Servicios que cobran a caja (Tenencia, CSF, Copias, Escaneo, Registro Civil)
    '[onclick="abrirPanelTenencia()"]',
    '[onclick="abrirPanelCSF()"]',
    '[onclick="abrirCopias()"]',
    '[onclick="abrirEscaneo()"]',
    '[onclick="abrirRegistroCivil()"]',
  ];

  selectoresBloqueables.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.disabled = bloqueada;
      el.style.opacity = bloqueada ? '0.35' : '';
      el.style.pointerEvents = bloqueada ? 'none' : '';
      if (bloqueada) {
        el.title = '🔒 Caja cerrada — se habilita mañana';
      } else {
        el.removeAttribute('title');
      }
    });
  });

  // Inputs de monto en formularios de ingreso/egreso manual
  ['#monto-ingreso','#monto-egreso','#input-ingreso','#input-egreso',
   '#concepto-ingreso','#concepto-egreso'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) {
      el.readOnly = bloqueada;
      el.style.opacity = bloqueada ? '0.45' : '';
      el.style.pointerEvents = bloqueada ? 'none' : '';
    }
  });

  // Overlay visual sobre el panel de ingresos/egresos manuales si existe
  const panelMov = document.getElementById('panel-movimientos-manuales') ||
                   document.getElementById('tab-contabilidad-form');
  if (panelMov) {
    panelMov.style.position = 'relative';
    let overlay = panelMov.querySelector('.caja-cerrada-overlay');
    if (bloqueada && !overlay) {
      overlay = document.createElement('div');
      overlay.className = 'caja-cerrada-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;background:rgba(20,15,5,0.38);' +
        'z-index:10;display:flex;align-items:center;justify-content:center;border-radius:8px;' +
        'backdrop-filter:blur(1px);cursor:not-allowed;';
      overlay.innerHTML = '<span style="font-family:\'JetBrains Mono\',monospace;font-size:0.78rem;' +
        'color:#f0c060;font-weight:700;letter-spacing:0.08em;text-shadow:0 1px 4px #000;">🔒 CAJA CERRADA</span>';
      panelMov.appendChild(overlay);
    } else if (!bloqueada && overlay) {
      overlay.remove();
    }
  }
}

// ═══ DATOS PRECARGADOS ═══
// DIR0 — Semilla inicial del directorio
// Solo se usa la PRIMERA VEZ para crear directorio.json en Drive
// Después, Drive es la fuente de verdad — NO modificar este array
const DIR0=[{"nombre": "Aide Pizarro Guzmán", "tipo": "Clienta", "tel": "953-173-0312", "tel2": "", "desc": "", "pob": "San Sebastián Tecomaxtl, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Alfonso Hernandez Santiago", "tipo": "Cliente", "tel": "953-110-7031", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Alfredo Trejo Ramirez y cop.", "tipo": "Cliente", "tel": "953-321-5719", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Alma Maldonado Villaverde", "tipo": "Licenciada", "tel": "951-192-2835", "tel2": "", "desc": "Sobrina Sra. Maria Alejandrina Belem Tlaco", "pob": "Oaxaca de Juárez, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Alpiniano Santiago Medina Rendon", "tipo": "Cliente", "tel": "953-213-2900", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Ana Rocio Rodriguez Ramirez", "tipo": "Clienta", "tel": "953-157-7473", "tel2": "", "desc": "Hija Sr. Dionicio", "pob": "La Escopeta, San Martín Peras", "email": "", "rfc": "", "obs": ""}, {"nombre": "Andres Isaias Lita Palma", "tipo": "Cliente", "tel": "953-174-7758", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Andres Nicolas Ventura", "tipo": "Cliente", "tel": "953-276-3857", "tel2": "953-196-9673", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Andres Rodriguez Lopez", "tipo": "Cliente", "tel": "953-276-3857", "tel2": "", "desc": "", "pob": "San Martín Peras, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Angel Gustavo Rodriguez Ramirez", "tipo": "Cliente", "tel": "953-157-7473", "tel2": "", "desc": "Hijo Sr. Dionicio", "pob": "La Escopeta, San Martín Peras", "email": "", "rfc": "", "obs": ""}, {"nombre": "Angel Reyes Salgado", "tipo": "Cliente", "tel": "953-119-2467", "tel2": "", "desc": "Compradora Sr. Raúl", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Angeles Macias", "tipo": "Asistente", "tel": "951-100-6740", "tel2": "", "desc": "Asistente Lic. Hugo | Notaría 75", "pob": "Oaxaca de Juárez, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Angelina Flora Galicia Barcenas", "tipo": "Clienta", "tel": "+1 (760) 643-8992", "tel2": "", "desc": "", "pob": "Santa Rosa Caxtlahuaca", "email": "", "rfc": "", "obs": ""}, {"nombre": "Antonino Cano Mendoza", "tipo": "Cliente", "tel": "953-556-7778", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Apolinario Lopez Cruz", "tipo": "Cliente", "tel": "953-124-7474", "tel2": "", "desc": "", "pob": "Yucunicoco, Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Azucena Lopez", "tipo": "Clienta", "tel": "+1 (848) 245-4957", "tel2": "", "desc": "Hija del Sr. Cirilo Guadalupe", "pob": "Santa Rosa Caxtlahuaca", "email": "", "rfc": "", "obs": ""}, {"nombre": "Beatriz Maribel Chavez Bolaños", "tipo": "Clienta", "tel": "953-229-2853", "tel2": "", "desc": "Hija del Sr. Venancio Tlacotepec", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Belen Gabina Reyes Salas", "tipo": "Clienta", "tel": "953-210-7721", "tel2": "", "desc": "", "pob": "Guadalupe Nucate", "email": "", "rfc": "", "obs": ""}, {"nombre": "Bernarda Antonia", "tipo": "Clienta", "tel": "+1 (760) 481-5746", "tel2": "", "desc": "Hija Sr. Saul Tlacotepec", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Blanca Edith Lopez Maldonado", "tipo": "Clienta", "tel": "953-124-2924", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Chiní Vendedor col. Revolución", "tipo": "Cliente", "tel": "953-116-9131", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Ciro Aparicio Martinez", "tipo": "Cliente", "tel": "+1 (760) 458-3527", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Clara Montiel Milan", "tipo": "Clienta", "tel": "953-212-1266", "tel2": "", "desc": "", "pob": "San Sebastián Tecomaxtl, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Cristina Bazante Martínez", "tipo": "Clienta", "tel": "953-211-0051", "tel2": "", "desc": "", "pob": "Santa Catarina Noltepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "David Lopez Santiago", "tipo": "Cliente", "tel": "+1 (912) 592-0248", "tel2": "", "desc": "Hermano del Sr. Artemio taxista", "pob": "Mesón", "email": "", "rfc": "", "obs": ""}, {"nombre": "Dionicio Rodriguez Pastrana", "tipo": "Cliente", "tel": "953-157-7473", "tel2": "", "desc": "", "pob": "La Escopeta, San Martín Peras", "email": "", "rfc": "", "obs": ""}, {"nombre": "Edith Gracida", "tipo": "Cliente", "tel": "953-115-8306", "tel2": "", "desc": "Familia de la Vendedora del Sr. Celedonio", "pob": "San Sebastián Tecomaxtl, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Eduardo Agustin López Maldonado", "tipo": "Cliente", "tel": "953-114-6436", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Eleuteria Juana Pabuceno Conde", "tipo": "Clienta", "tel": "953-172-7905", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Eliel Cuñado Sr. Irving", "tipo": "Cliente", "tel": "953-116-7172", "tel2": "238-133-7777", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Emilio Rosario Lopez Lopez", "tipo": "Gestor", "tel": "953-109-3160", "tel2": "", "desc": "", "pob": "Santa Rosa Caxtlahuaca", "email": "", "rfc": "", "obs": ""}, {"nombre": "Epifanio Zacarias Mendoza Salazar", "tipo": "Cliente", "tel": "933-117-9377", "tel2": "", "desc": "", "pob": "Tabasco", "email": "", "rfc": "", "obs": ""}, {"nombre": "Espiridión Martinez Carrera", "tipo": "Cliente", "tel": "953-177-7063", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Fidel Leoncio Reyes Salas", "tipo": "Cliente", "tel": "+1 (616) 166-3295", "tel2": "", "desc": "", "pob": "Guadalupe Nucate", "email": "", "rfc": "", "obs": ""}, {"nombre": "Francisca Lopez", "tipo": "Clienta", "tel": "953-124-2974", "tel2": "", "desc": "Hija del Sr. Roberto Lopez Guerrero", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Francisco Campos Zuritas", "tipo": "Cliente", "tel": "953-107-0150", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Francisco de Jesus Bautista", "tipo": "Cliente", "tel": "+1 (702) 579-5695", "tel2": "", "desc": "Cuñado Sra. Jovita Chavez", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Francisco Lopez Rodriguez", "tipo": "Cliente", "tel": "953-276-3857", "tel2": "", "desc": "Hijo Sr. Andres", "pob": "La Escopeta, San Martín Peras", "email": "", "rfc": "", "obs": ""}, {"nombre": "Froylan Rios", "tipo": "Gestor", "tel": "951-226-2485", "tel2": "", "desc": "Notaría 81", "pob": "Oaxaca de Juárez, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Gabriel Morales Carrasco", "tipo": "Cliente", "tel": "953-175-2669", "tel2": "", "desc": "", "pob": "Yosondaya, San Miguel Tlaco.", "email": "", "rfc": "", "obs": ""}, {"nombre": "German Montesinos Coronel", "tipo": "Cliente", "tel": "953-114-7902", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Gregorio Solano Garcia", "tipo": "Cliente", "tel": "953-189-9342", "tel2": "", "desc": "", "pob": "San Sebastián Tecomaxtl, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Guadalupe Chavez", "tipo": "Clienta", "tel": "953-115-9296", "tel2": "", "desc": "Esposa Sr. Edgar", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Guadalupe Margarita Martinez Lopez", "tipo": "Clienta", "tel": "+1 (503) 800-7259", "tel2": "", "desc": "", "pob": "Santa Rosa Caxtlahuaca", "email": "", "rfc": "", "obs": ""}, {"nombre": "Guillermina Velasco Aguilera", "tipo": "Clienta", "tel": "221-416-1690", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Heladio Mariano Luegas Aguilar", "tipo": "Licenciado", "tel": "953-125-9244", "tel2": "", "desc": "Alcalde Santiago Juxtlahuaca", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Hugo Alberto Garcia", "tipo": "Gestor", "tel": "951-162-7875", "tel2": "", "desc": "Notaría 75", "pob": "Oaxaca de Juárez, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Iris Romero Cruz", "tipo": "Clienta", "tel": "953-111-5200", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Isabel Zurita Ortiz", "tipo": "Clienta", "tel": "953-194-2502", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Ismael Olivo Moreno Ocampo", "tipo": "Cliente", "tel": "+1 (209) 900-3297", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Javier Federico Lopez", "tipo": "Cliente", "tel": "953-153-9903", "tel2": "", "desc": "", "pob": "Santa Rosa Caxtlahuaca", "email": "", "rfc": "", "obs": ""}, {"nombre": "Jesus Cerero Galicia", "tipo": "Cliente", "tel": "953-109-7060", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Jorge", "tipo": "Secretario", "tel": "951-130-1443", "tel2": "", "desc": "Secretario Notaria 75", "pob": "Oaxaca de Juárez, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Jose Amandi Cervantes Ortiz", "tipo": "Cliente", "tel": "951-905-0750", "tel2": "", "desc": "", "pob": "San Sebastián Tecomaxtl, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Jose Gabriel López Maldonado", "tipo": "Cliente", "tel": "953-118-9978", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Jose Manuel Reyes Salas", "tipo": "Cliente", "tel": "566-597-5563", "tel2": "+1 (909) 202-7999", "desc": "NUEVO NÚMERO", "pob": "Guadalupe Nucate", "email": "", "rfc": "", "obs": ""}, {"nombre": "Jovita Chavez", "tipo": "Clienta", "tel": "+1 (442) 249-3363", "tel2": "", "desc": "Fusión", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Juan Carlos López Maldonado", "tipo": "Cliente", "tel": "953-115-4296", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Juan de Jesus Chávez", "tipo": "Cliente", "tel": "+1 (442) 249-3363", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Juan Salvador Camacho", "tipo": "Cliente", "tel": "953-187-2784", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Luis Hernandez Ramirez", "tipo": "Cliente", "tel": "+1 (838) 251-8056", "tel2": "", "desc": "Hijo Sra. Gudelia", "pob": "San Sebastián Tecomaxtl, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Luis Perez Suarez", "tipo": "Licenciado", "tel": "953-117-2788", "tel2": "", "desc": "Vendedor Sr. Roberto López Guerrero", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Luis Sanchez Bautista", "tipo": "Cliente", "tel": "+1 (805) 332-1389", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Magali Ortiz Hernandez", "tipo": "Contadora", "tel": "951-185-7659", "tel2": "", "desc": "Contadora de la Notaria 81", "pob": "Oaxaca de Juárez, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Manuel", "tipo": "Licenciado", "tel": "951-118-4335", "tel2": "", "desc": "Familiar de Celerino Angon", "pob": "Oaxaca de Juárez, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Manuel Alejandro Urrutia", "tipo": "Licenciado", "tel": "951-164-8814", "tel2": "", "desc": "Oficial del Registro Civil Santiago Juxtlahuaca", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Manuel Vidal Martinez García", "tipo": "Cliente", "tel": "953-157-9306", "tel2": "953-176-3508", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Marcelino Garcia Basurto", "tipo": "Cliente", "tel": "953-139-8912", "tel2": "953-134-6981", "desc": "", "pob": "La Escopeta, San Martín Peras", "email": "", "rfc": "", "obs": ""}, {"nombre": "Marcelino Rios Guzmán", "tipo": "Licenciado", "tel": "951-252-2986", "tel2": "", "desc": "Oficial del Registro Civil San Juan Mixtepec", "pob": "Oaxaca de Juárez, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Marcos Fernando Camarillo Salazar", "tipo": "Cliente", "tel": "552-132-5078", "tel2": "", "desc": "", "pob": "Ciudad de México", "email": "", "rfc": "", "obs": ""}, {"nombre": "Maria Candelaria Carrasco Cuevas", "tipo": "Clienta", "tel": "953-171-2148", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Maria del Rosario Tapia", "tipo": "Clienta", "tel": "953-116-6946", "tel2": "", "desc": "Compradora Sr. Raúl", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Maribel Ortiz", "tipo": "Clienta", "tel": "953-278-2185", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Mario Antonio Dominguez Cariño", "tipo": "No nominado", "tel": "953-114-6786", "tel2": "", "desc": "Vendedor Sr. Dionicio", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Mayra", "tipo": "Secretaria", "tel": "953-149-2800", "tel2": "", "desc": "Secretaria Sindico Tecomaxtlahuaca", "pob": "San Sebastián Tecomaxtl, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Miguel Moreno Ocampo", "tipo": "Licenciado", "tel": "553-667-9096", "tel2": "", "desc": "Familiar del Sr. Eladio Mario Tlaco", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Miguel Reyes Salas", "tipo": "Cliente", "tel": "+1 (616) 119-7649", "tel2": "", "desc": "", "pob": "Guadalupe Nucate", "email": "", "rfc": "", "obs": ""}, {"nombre": "Noe Vásquez Salazar", "tipo": "Cliente", "tel": "553-708-5177", "tel2": "", "desc": "", "pob": "Ciudad de México", "email": "", "rfc": "", "obs": ""}, {"nombre": "Obdulia Anselma de Jesus Chávez", "tipo": "Clienta", "tel": "+1 (442) 249-3363", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Ofelia Clementina", "tipo": "Dueña local", "tel": "953-116-8763", "tel2": "", "desc": "Dueña local", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Pablo (Juan Rafael)", "tipo": "Cliente", "tel": "953-100-4602", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Pedro Alberto Guzman Vasquez", "tipo": "Cliente", "tel": "953-229-1459", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Pedro Edgar Martínez León", "tipo": "Cliente", "tel": "953-123-3467", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Profesor Romualdo Tlaco", "tipo": "Cliente", "tel": "953-321-5719", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Profesora Marisol Evangelista Merino", "tipo": "Clienta", "tel": "953-116-2254", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Rebeca Hernandez Vasquez", "tipo": "Clienta", "tel": "+1 (408) 364-5850", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Rosa Yuridia Vasquez Mejia", "tipo": "Clienta", "tel": "953-186-4661", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Rosario Karina Morales Hernandez", "tipo": "Actuaria", "tel": "951-202-1608", "tel2": "", "desc": "Actuaria Juzgado", "pob": "Oaxaca de Juárez, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Sarey Rocio Martínez Díaz", "tipo": "Clienta", "tel": "953-175-5519", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Sebastian Epifanio Cholula Salazar", "tipo": "Cliente", "tel": "953-214-7955", "tel2": "", "desc": "", "pob": "San Sebastián Tecomaxtl, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Sello Oax", "tipo": "Serigrafía", "tel": "951-136-7817", "tel2": "", "desc": "Serigrafía", "pob": "Oaxaca de Juárez, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Serafín Santiago Sanchez", "tipo": "Cliente", "tel": "953-122-8577", "tel2": "953-139-0139", "desc": "", "pob": "Santa Rosa Caxtlahuaca", "email": "", "rfc": "", "obs": ""}, {"nombre": "Sergio Bautista Santos", "tipo": "Cliente", "tel": "953-177-4331", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Sheridam Misraim López Vasquez", "tipo": "Cliente", "tel": "222-201-1778", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Sofia Cruz Bautista", "tipo": "Clienta", "tel": "+1 (714) 878-0616", "tel2": "", "desc": "Sobrina de la Sra. Jovita", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Tania", "tipo": "Secretaria", "tel": "953-278-2896", "tel2": "", "desc": "Secretaria Aux, Tlaco", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Tomasa Sandoval Cabrera", "tipo": "Clienta", "tel": "953-125-4802", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Tomas Santiago Medina Rendon", "tipo": "Cliente", "tel": "953-213-2900", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Valentina Martínez Cuñado", "tipo": "Clienta", "tel": "953-172-9052", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Venancio Chavez Gutierrez", "tipo": "Cliente", "tel": "953-229-2853", "tel2": "", "desc": "", "pob": "San Miguel Tlacotepec, Oax", "email": "", "rfc": "", "obs": ""}, {"nombre": "Violeta Belen Cruz", "tipo": "Clienta", "tel": "953-116-4728", "tel2": "", "desc": "", "pob": "Santiago Juxtlahuaca, Oax", "email": "", "rfc": "", "obs": ""}];
// CARP0 — Semilla inicial de carpetas desde CARPETAS_INTERNAS.xlsm
// Solo se usa la PRIMERA VEZ para crear carpetas_internas.json en Drive
// Después, Drive es la fuente de verdad — NO modificar este array
const CARP0=[];
const JUI0=[
  {cliente:'Tomas Raúl Ramos Chora',tipo:'Juicio Ordinario Civil',expediente:'77/2022',juzgado:'Juzgado Mixto Juxtlahuaca',fechaIngreso:'2022-08-22',audiencia:'',estatus:'urgente',movimiento:'Se presentó apelación',tel:'953-540-8944',obs:'A la espera de la apelación'},
  {cliente:'Sebastiana Victorina Garcia Colores',tipo:'Juicio Sucesorio Intestamentario',expediente:'56/2023',juzgado:'Juzgado Mixto Juxtlahuaca',fechaIngreso:'2023-06-02',audiencia:'',estatus:'proceso',movimiento:'Presentar escrito',tel:'953-189-9342',obs:'Presentar los otros hijos de don Gregorio'},
  {cliente:'Jose Gabriel López Maldonado',tipo:'Juicio Sucesorio Intestamentario',expediente:'119/2023',juzgado:'Juzgado Mixto Juxtlahuaca',fechaIngreso:'2023-08-18',audiencia:'',estatus:'proceso',movimiento:'Se apersonaron los hermanos',tel:'953-126-8669',obs:'Apersonamiento hijos Don Gabriel'},
  {cliente:'Yaneth Cruz Luciano y Francisco Campo',tipo:'Divorcio Voluntario',expediente:'23/2024',juzgado:'Juzgado Mixto Juxtlahuaca',fechaIngreso:'2024-04-29',audiencia:'',estatus:'estable',movimiento:'Exhorto enviado al Registro Civil',tel:'953-107-0150',obs:'Falta devolución de exhorto'},
  {cliente:'Angelina Flora Galicia Barcena',tipo:'Juicio Sucesorio Intestamentario',expediente:'24197',juzgado:'Notaría N°16, Minatitlán, Ver.',fechaIngreso:'2024-08-28',audiencia:'',estatus:'estable',movimiento:'Reconocimiento de Albacea',tel:'760-643-8992',obs:'Presentar juicio reivindicatorio — Notaría 16 Minatitlán'},
  {cliente:'Miguel Chavez Chavez',tipo:'Controversia de Orden Familiar',expediente:'102/2024',juzgado:'Juzgado Mixto Juxtlahuaca',fechaIngreso:'2024-10-08',audiencia:'',estatus:'estable',movimiento:'Propuesta de convenio',tel:'',obs:'Falleció el padre'},
  {cliente:'Sheila Jocelyn Lozano Mora',tipo:'Divorcio Incausado',expediente:'121/2024',juzgado:'Juzgado Mixto Juxtlahuaca',fechaIngreso:'2024-10-14',audiencia:'',estatus:'estable',movimiento:'Pedir aprobación propuesta de convenio',tel:'953-112-3933',obs:'Presentar escrito al juzgado'},
  {cliente:'Cristina Bazante Martinez',tipo:'Divorcio Incausado',expediente:'010/2025',juzgado:'Juzgado Mixto Juxtlahuaca',fechaIngreso:'2025-02-04',audiencia:'',estatus:'urgente',movimiento:'Audiencia de pruebas y alegatos',tel:'953-211-0051',obs:'Valoración psicológica — checar próxima fecha'},
  {cliente:'Esperanza Elena Ortiz Vega',tipo:'Jurisdicción Voluntaria',expediente:'67/2025',juzgado:'Juzgado Mixto Juxtlahuaca',fechaIngreso:'2025-06-16',audiencia:'',estatus:'inicio',movimiento:'Inicio',tel:'',obs:'Pasar por copias certificadas'},
  {cliente:'Maria Evangelista Luengas',tipo:'Juicio Sucesorio Intestamentario',expediente:'111/2025',juzgado:'Juzgado Mixto Juxtlahuaca',fechaIngreso:'2025-09-09',audiencia:'2025-12-15',estatus:'estable',movimiento:'Información Testimonial',tel:'953-111-0059',obs:'En la audiencia presentar a testigos'},
  {cliente:'Samuel Martinez Arroyo',tipo:'Divorcio Incausado',expediente:'520',juzgado:'Juzgado Mixto Juxtlahuaca',fechaIngreso:'2026-01-13',audiencia:'',estatus:'proceso',movimiento:'Tramite en curso — folio 520',tel:'209-888-7216',obs:'Juicio y trámite de placas activos'},
];
// PEND0 vacío — los pendientes se cargan exclusivamente desde pendientes.json en Drive.
// Al conectar Drive por primera vez se crea el archivo automáticamente.
const PEND0=[];
const SRVS={
  tenencias:[
    {nom:'Tenencia EDOMEX',p:40,cat:'tenencia',ico:'📄'},{nom:'Tenencia OAXACA',p:40,cat:'tenencia',ico:'📄'},
    {nom:'Tenencia CDMX',p:40,cat:'tenencia',ico:'📄'},{nom:'Tenencia MICHOACÁN',p:40,cat:'tenencia',ico:'📄'},
    {nom:'Tenencia TLAXCALA',p:40,cat:'tenencia',ico:'📄'},{nom:'Tenencia DURANGO',p:50,cat:'tenencia',ico:'📄'},
    {nom:'Tenencia VERACRUZ',p:50,cat:'tenencia',ico:'📄'},{nom:'Copia simple',p:2,cat:'copia',ico:'📑'},
    {nom:'Impresión doc.',p:50,cat:'copia',ico:'🖨'},
  ],
  actas:[
    {nom:'Acta Nac. OAX',p:240,cat:'acta',ico:'📋'},{nom:'Acta + CURP',p:280,cat:'acta',ico:'📋'},
    {nom:'Acta+CURP+Copia',p:320,cat:'acta',ico:'📋'},{nom:'Acta otros estados',p:280,cat:'acta',ico:'📋'},
    {nom:'CURP simple',p:40,cat:'curp',ico:'🆔'},{nom:'CURP + Copia',p:48,cat:'curp',ico:'🆔'},
    {nom:'RFC genérico',p:50,cat:'curp',ico:'🆔'},{nom:'Const.Sit.Fiscal',p:300,cat:'gobierno',ico:'📜'},
    {nom:'Escaneo docs.',p:150,cat:'copia',ico:'📷'},
  ],
  juridico:[
    {nom:'Asesoría',p:300,cat:'asesoria',ico:'⚖️'},{nom:'Cotización',p:100,cat:'asesoria',ico:'💰'},
    {nom:'Carta Responsiva',p:300,cat:'honorario',ico:'📄'},{nom:'Investigación veh.',p:550,cat:'placa',ico:'🔍'},
    {nom:'Cita Pasaporte',p:300,cat:'gobierno',ico:'🛂'},
  ],
  egresos:[
    {nom:'Pago actas sistema',p:0,cat:'gobierno',ico:'💻',e:1},{nom:'Pago tenencia',p:0,cat:'gobierno',ico:'🏛',e:1},
    {nom:'Traslado dominio',p:905,cat:'catastro',ico:'🏠',e:1},{nom:'Renta despacho',p:6500,cat:'renta',ico:'🏢',e:1},
    {nom:'Sueldo Antonieta',p:3000,cat:'sueldo',ico:'👤',e:1},{nom:'Compra insumos',p:0,cat:'insumo',ico:'📦',e:1},
    {nom:'Paquetería Tazuyuti',p:150,cat:'insumo',ico:'📬',e:1},{nom:'Al Lic. (entrega)',p:0,cat:'otro',ico:'➡️',e:1},
  ]
};

// ═══ UTILS ═══
// Nota: $() ya está definido al inicio del archivo con caché de DOM.
const fmt=n=>Number(n||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});

// ═══ MEJORA 2: PARSEO SEGURO DE NÚMEROS ═══
// toNumero(valor, default) — convierte texto a número con validación.
// Si el valor no es un número válido, devuelve el default.
// Acepta strings con comas como separador de miles ("1,234.56" → 1234.56).
// Si esperas decimales (precios, totales) usa toNumero(v, 0).
// Si esperas entero (cantidades), usa toEntero(v, 1).
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
const _hoyReal=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const _horaReal=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
// hoy() y hora() respetan el modo captura retroactiva si está activo
const hoy=()=>{
  if(window._capturaMesActivo){
    // Usar fecha manual si fue editada por el usuario, si no usar 1er día del mes
    return window._capturaFechaManual || (window._capturaMesActivo.anio+'-'+window._capturaMesActivo.mesNum+'-01');
  }
  return _hoyReal();
};
const hora=()=>{
  if(window._capturaMesActivo){
    return window._capturaHoraManual || _horaReal();
  }
  return _horaReal();
};
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const empNombre=()=>localStorage.getItem('empleado_nombre')||'Usuario';
const empEmail=()=>localStorage.getItem('empleado_email')||'';

function toast(msg,t='ok'){
  const el=$('toast');el.className='toast '+t;el.textContent=msg;el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),3200);
}

// ═══ MEJORA: BOTÓN ACTUALIZAR (recarga forzada con caché limpio) ═══
// Recarga la página descartando el caché del navegador. Equivale a Ctrl+Shift+R.
// Si hay cambios sin sincronizar, advierte primero.
async function recargarPaginaForzado() {
  const btn = document.querySelector('.btn-recargar');
  
  // Modal "Sincronización en curso" eliminado a petición del usuario.
  // Los datos están protegidos en el respaldo local (localStorage), por lo que
  // recargar mientras hay una subida en curso no causa pérdida — la subida se
  // reintenta automáticamente en la próxima oportunidad.
  
  // Animación visual del botón
  if (btn) btn.classList.add('spinning');
  
  // Pequeña pausa para que el usuario vea la animación
  setTimeout(() => {
    // location.reload(true) es la forma estándar de forzar recarga sin caché.
    // Aunque el segundo argumento está deprecated en algunos navegadores modernos,
    // sigue funcionando. Como respaldo, agregamos un parámetro de query con timestamp.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_r', Date.now().toString());
      window.location.href = url.toString();
    } catch(e) {
      // Fallback si la URL es file:// (URL constructor puede fallar)
      window.location.reload(true);
    }
  }, 250);
}

// ═══ MEDIDOR DE CONECTIVIDAD CON DRIVE (estilo batería) ═══
// Calcula un porcentaje (0-100) basado en 5 verificaciones:
// - Internet (20%)        : navigator.onLine
// - Sesión activa (20%)   : token de Drive válido y no expirado
// - Archivo principal (20%): folioFileId existe (control de recibos)
// - Sincronización (20%)  : última sincronización exitosa < 5 min
// - Respaldo local (20%)  : hay respaldos locales recientes
function calcularConectividadDrive() {
  const checks = {
    conexion: { nombre: 'Internet', estado: 'fail' },
    token: { nombre: 'Sesión activa', estado: 'fail' },
    archivo: { nombre: 'Archivo principal', estado: 'fail' },
    sync: { nombre: 'Sincronización', estado: 'fail' },
    backup: { nombre: 'Respaldo local', estado: 'fail' }
  };
  
  let pct = 0;
  
  // 1. Internet (20%)
  if (navigator.onLine) {
    checks.conexion.estado = 'ok';
    pct += 20;
  }
  
  // 2. Sesión activa (token de Drive vigente) (20%)
  if (typeof sbSession !== 'undefined' && sbSession && Date.now() < sbExpiry) {
    checks.token.estado = 'ok';
    pct += 20;
  } else if (typeof sbSession !== 'undefined' && sbSession) {
    // Token existe pero expiró
    checks.token.estado = 'warn';
    pct += 8;
  }
  
  // 3. Archivo principal (folioFileId vinculado) (20%)
  if (typeof folioFileId !== 'undefined' && folioFileId) {
    checks.archivo.estado = 'ok';
    pct += 20;
  }
  
  // 4. Sincronización (20%) - estable: solo penaliza errores reales
  // (antes la barra "parpadeaba" porque el tiempo desde el último guardado
  //  hacía caer el porcentaje cada 5/30 min aunque todo estuviera bien)
  if (typeof _syncState !== 'undefined') {
    if (_syncState === 'error') {
      checks.sync.estado = 'fail';
    } else {
      checks.sync.estado = 'ok';
      pct += 20;
    }
  } else {
    checks.sync.estado = 'ok';
    pct += 20;
  }
  
  // 5. Respaldo local (20%)
  try {
    if (typeof listarBackups === 'function') {
      const backupsD = listarBackups('D');
      const backupsApp = listarBackups('appData');
      if (backupsD.length > 0 || backupsApp.length > 0) {
        // Respaldos rotativos disponibles (lo mejor)
        checks.backup.estado = 'ok';
        pct += 20;
      } else {
        // Aún no hay backups en Supabase
        checks.backup.estado = 'warn';
        pct += 12;
      }
    } else {
      // Si la función no existe, marcar como pendiente
      checks.backup.estado = 'warn';
      pct += 5;
    }
  } catch(e){ registrarError('catch vacio', e); }
  
  return { pct: Math.round(pct), checks };
}

// Bandera: la primera vez que se calcula, mostrar barra azul ("cargando")
// hasta que termine la primera verificación real.
let _medidorYaInicializado = false;

function actualizarMedidorDrive() {
  // Barra integrada al card de Servicios
  const fill = document.getElementById('drive-meter-slim-fill');
  const slim = document.getElementById('drive-meter-slim');
  if (!fill && !slim) return;
  
  const { pct, checks } = calcularConectividadDrive();
  
  if (fill) {
    // En la primera carga: mostrar pulso azul al 100% mientras se verifica realmente
    if (!_medidorYaInicializado) {
      fill.style.width = '100%';
      // Sin clase de color = se queda con el azul por defecto del CSS
      fill.classList.remove('bajo','medio','alto','completo');
      _medidorYaInicializado = true;
      // Después de 2.5s aplicar el porcentaje real
      setTimeout(() => {
        const { pct: pct2 } = calcularConectividadDrive();
        fill.style.width = pct2 + '%';
        fill.classList.remove('bajo','medio','alto','completo');
        if (pct2 >= 100) fill.classList.add('completo');
        else if (pct2 >= 70) fill.classList.add('alto');
        else if (pct2 >= 35) fill.classList.add('medio');
        else if (pct2 > 0) fill.classList.add('bajo');
      }, 2500);
    } else {
      fill.style.width = pct + '%';
      fill.classList.remove('bajo','medio','alto','completo');
      if (pct >= 100) fill.classList.add('completo');
      else if (pct >= 70) fill.classList.add('alto');
      else if (pct >= 35) fill.classList.add('medio');
      else if (pct > 0) fill.classList.add('bajo');
      // Si pct=0 sin clase: queda azul (sin conectividad inicializando)
    }
  }
  
  // Tooltip dinámico con el porcentaje y los componentes
  if (slim) {
    let estado;
    if (!_medidorYaInicializado) estado = '⏳ Verificando conectividad...';
    else if (pct >= 100) estado = '✓ Conectividad óptima';
    else if (pct >= 70) estado = '✓ Conectividad buena';
    else if (pct >= 35) estado = '⚠ Conectividad parcial';
    else if (pct > 0) estado = '⚠ Conectividad baja';
    else estado = '✕ Sin conectividad';
    
    const detalles = Object.entries(checks).map(([key, c]) => {
      const ico = c.estado === 'ok' ? '✓' : c.estado === 'warn' ? '⚠' : '✕';
      return ico + ' ' + c.nombre;
    }).join('\n');
    
    slim.title = 'Conectividad: ' + pct + '% — ' + estado + '\n\n' + detalles;
  }
}

// Animar un número de un valor a otro suavemente
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

// Actualizar el medidor cada 15 segundos para reflejar estado en vivo
setInterval(actualizarMedidorDrive, 15000);
// Primera actualización al cargar la página (después de 1.5s para dar tiempo a que cargue todo)
setTimeout(actualizarMedidorDrive, 1500);

// Inicializar el primer respaldo al cargar la página si no existe ninguno todavía.
// Esto hace que el medidor llegue al 100% sin tener que esperar a que el usuario
// haga un cambio que dispare el guardado normal.
setTimeout(function() {
  try {
    if (typeof D !== 'undefined' && typeof backupLocal === 'function') {
      const existentes = listarBackups('D');
      if (existentes.length === 0) {
        // Forzar el primer backup ignorando el límite de tiempo
        if (typeof _lastBackupTime === 'object') {
          _lastBackupTime['D'] = 0;  // Resetear para permitir que se cree
        }
        backupLocal('D', D);
        // Y también de appData si existe
        if (typeof appData !== 'undefined' && appData) {
          if (typeof _lastBackupTime === 'object') {
            _lastBackupTime['appData'] = 0;
          }
          backupLocal('appData', { folioActual: appData.folioActual, recibos: appData.recibos || [] });
        }
        // Refrescar el medidor para reflejar el nuevo estado
        if (typeof actualizarMedidorDrive === 'function') {
          setTimeout(actualizarMedidorDrive, 200);
        }
      }
    }
  } catch(e) { console.warn('inicializar backup:', e); }
}, 3000);

function cerrar(id){$(id).classList.remove('show');}

// ═══ MEJORA: MODALES PROPIOS (reemplazo de confirm/prompt nativos) ═══
// Uso: const ok = await confirmarBonito({titulo, mensaje, btnSi, btnNo, peligro});
// Devuelve Promise<boolean>. Funciona como drop-in replacement de confirm() pero con UX mucho mejor.
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
      ov.classList.remove('show');
      setTimeout(() => { try { ov.remove(); } catch(e){ registrarError('catch vacio', e); } }, 200);
      resolve(resultado);
    };
    
    ov.querySelector('.cb-btn-si').addEventListener('click', () => cerrarModal(true));
    ov.querySelector('.cb-btn-no').addEventListener('click', () => cerrarModal(false));
    ov.addEventListener('click', e => { if (e.target === ov) cerrarModal(false); });
    
    // Esc para cancelar, Enter para aceptar
    const escListener = e => {
      if (e.key === 'Escape') { e.preventDefault(); cerrarModal(false); document.removeEventListener('keydown', escListener); }
      else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); cerrarModal(true); document.removeEventListener('keydown', escListener); }
    };
    document.addEventListener('keydown', escListener);
    
    // Foco al botón principal
    setTimeout(() => ov.querySelector('.cb-btn-si').focus(), 50);
  });
}

// pedirTexto({titulo, mensaje, valorInicial, placeholder, validar}) → Promise<string|null>
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
      if (e.key === 'Escape') { e.preventDefault(); cerrarModal(null); document.removeEventListener('keydown', escListener); }
      else if (e.key === 'Enter' && e.target === inp) { e.preventDefault(); intentarAceptar(); }
    };
    document.addEventListener('keydown', escListener);
    
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
  });
}

// Helper de escape (puede ya existir, pero por si acaso)
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ═══ MEJORA 5: ATAJOS DE TECLADO GLOBALES ═══
// Los atajos solo se activan cuando el foco NO está en un input/textarea/select.
// Esto evita interferir con la escritura del usuario.
const ATAJOS = [
  { tecla: '1', alt: true, accion: () => ir('caja'), descripcion: 'Ir a Caja' },
  { tecla: '2', alt: true, accion: () => ir('nuevo-recibo'), descripcion: 'Nuevo Recibo' },
  { tecla: '3', alt: true, accion: () => ir('recibos'), descripcion: 'Historial Recibos' },
  { tecla: '4', alt: true, accion: () => ir('contabilidad'), descripcion: 'Contabilidad' },
  { tecla: '5', alt: true, accion: () => ir('directorio'), descripcion: 'Directorio' },
  { tecla: '6', alt: true, accion: () => ir('carpetas'), descripcion: 'Carpetas' },
  { tecla: '7', alt: true, accion: () => ir('juicios'), descripcion: 'Juicios' },
  { tecla: '8', alt: true, accion: () => ir('pendientes'), descripcion: 'Pendientes' },
  { tecla: 'r', ctrl: true, alt: true, accion: () => ir('nuevo-recibo'), descripcion: 'Crear Recibo' },
  { tecla: 'q', ctrl: true, alt: true, accion: () => { if (typeof abrirLibre === 'function') abrirLibre(); }, descripcion: 'Captura Rápida' },
  { tecla: 'b', ctrl: true, alt: true, accion: () => { 
    const inp = document.getElementById('global-search-inp'); 
    if (inp) inp.focus(); 
  }, descripcion: 'Buscar' },
  { tecla: '?', shift: true, accion: () => mostrarAtajosAyuda(), descripcion: 'Mostrar esta ayuda' },
];

function manejarAtajos(e) {
  // No activar atajos si el usuario está escribiendo en un input
  const target = e.target;
  if (target && (
    target.tagName === 'INPUT' || 
    target.tagName === 'TEXTAREA' || 
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )) {
    // Excepción: Esc cierra modales/dropdowns aunque el foco esté en un input
    if (e.key === 'Escape') {
      cerrarModalesAbiertos();
    }
    return;
  }
  
  // Esc global: cerrar modales abiertos
  if (e.key === 'Escape') {
    cerrarModalesAbiertos();
    return;
  }
  
  // Buscar atajo coincidente
  for (const atajo of ATAJOS) {
    if (e.key.toLowerCase() !== atajo.tecla.toLowerCase()) continue;
    if (atajo.ctrl && !e.ctrlKey && !e.metaKey) continue;
    if (atajo.alt && !e.altKey) continue;
    if (atajo.shift && !e.shiftKey) continue;
    if (!atajo.ctrl && (e.ctrlKey || e.metaKey)) continue;
    if (!atajo.alt && e.altKey) continue;
    
    e.preventDefault();
    e.stopPropagation();
    try {
      atajo.accion();
    } catch(err) {
      console.warn('Error en atajo:', err);
    }
    return;
  }
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

// Activar atajos globales
document.addEventListener('keydown', manejarAtajos);

// ═══ NAVEGACIÓN ═══
const TITULOS={sesiones:'👁 Monitor de Sesiones',caja:'🏠 Principal','registro-civil':'📋 Impresión Registro Civil',contabilidad:'📊 Contabilidad',recibos:'🧾 Recibos Oficiales','nuevo-recibo':'✍️ Nuevo Recibo','configuracion':'⚙️ Configuración',directorio:'👥 Directorio',carpetas:'🗂️ Control de Carpetas',juicios:'⚖️ Control de Juicios',pendientes:'📌 Pendientes','finanzas-internas':'💰 Finanzas Internas',escrituras:'📄 Control de Escrituras'};
function ir(p){
  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-sub-item').forEach(x=>x.classList.remove('active'));
  $('panel-'+p).classList.add('active');
  // Marcar en body el panel activo para CSS condicional
  document.body.className = document.body.className.replace(/\bpanel-[\w-]+/g,'').trim();
  document.body.classList.add('panel-'+p);
  document.querySelector(`.nav-item[onclick="ir('${p}')"]`)?.classList.add('active');
  document.querySelector(`.nav-sub-item[onclick="ir('${p}')"]`)?.classList.add('active');
  // También marcar items con data-panel (para los que tienen onclick compuesto)
  document.querySelectorAll(`.nav-item[data-panel="${p}"]`).forEach(el => el.classList.add('active'));
  if(p==='recibos'||p==='finanzas-internas'){
    document.querySelector(`.nav-item[onclick="ir('contabilidad')"]`)?.classList.add('active');
  }
  $('topTitle').textContent=TITULOS[p]||p;
  if(p==='contabilidad')renderContab();
  if(p==='recibos')renderRec();
  if(p==='finanzas-internas'){initFI();FI.prestamos=D.prestamos;renderFI();fiCambiarTab(fiTabActual||'caja');}
  if(p==='directorio'){renderDir();}
  if(p==='carpetas')renderCarp();
  if(p==='juicios'){renderJuicios();$('juicio-detalle').classList.remove('visible');$('juicios-lista-view').style.display='';}
  if(p==='pendientes')renderPend();
  if(p==='caja')renderCaja();
  if(p==='registro-civil')rcAbrirSubpanel('home');
  if(p==='escrituras'){ if(!Array.isArray(D.escrituras))D.escrituras=[]; escRender(); }
  if(p==='configuracion'){ setTimeout(ocrCargarKeyEnCfg, 100); }
  if(p==='nuevo-recibo'){
    // Sincronizar token de Drive con el sistema de recibos al navegar al panel
    if(typeof actualizarFolioDisplay === 'function') actualizarFolioDisplay();
    if(typeof appData !== 'undefined' && typeof sbSession !== 'undefined' && sbSession
       && (!appData.recibos || !appData.recibos.length)
       && typeof cargarDatosIniciales === 'function') {
      cargarDatosIniciales();
    }
    // Asegurar que haya al menos 1 fila de cliente y 1 concepto
    const wrap = $('clientes-wrapper');
    if (wrap && !wrap.querySelector('.cliente-row')) {
      if (typeof agregarCliente === 'function') agregarCliente();
      else if (typeof idxAgregarCliente === 'function') idxAgregarCliente();
    }
    const tbody = $('conceptos-tbody');
    if (tbody && !tbody.querySelector('tr')) {
      if (typeof agregarConcepto === 'function') agregarConcepto();
      else if (typeof idxAgregarConcepto === 'function') idxAgregarConcepto();
    }
    // Regenerar QR si es necesario
    if (typeof generarQRPreview === 'function') generarQRPreview();
  }
  if(p==='configuracion'){setTimeout(renderConfig,50);}
}

// ═══ RECIBOS — SISTEMA EXTERNO (iframe) ═══
function recargarReciboFrame() {
  var iframe = document.getElementById('recibo-iframe');
  if (iframe) {
    var src = iframe.src;
    iframe.src = 'about:blank';
    setTimeout(function(){ iframe.src = src; }, 100);
    if (typeof toast === 'function') toast('Sistema de recibos recargado');
  }
}

// Detectar si el iframe se carga correctamente; si no, mostrar fallback
window.addEventListener('load', function() {
  try { localStorage.removeItem('lex-supabase-auth'); } catch(e){ registrarError('catch vacio', e); }
  setTimeout(function() {
    var iframe = document.getElementById('recibo-iframe');
    var fallback = document.getElementById('recibo-iframe-fallback');
    if (!iframe || !fallback) return;
    try {
      // Si X-Frame-Options bloquea, contentDocument lanza error o queda vacío
      // No podemos acceder al contenido por CORS, pero si no carga nada visible se nota
      iframe.addEventListener('error', function(){ fallback.style.display='block'; });
    } catch(e){ registrarError('catch vacio', e); }
  }, 3000);
});

// ═══ MODO ═══
function setModo(m){
  modo=m;
}

// ═══ SERVICIOS 1-CLIC ═══
function renderSrvs(){
  const mk=(grid,lista)=>{
    $(grid).innerHTML=lista.map(s=>`<button class="srv${s.e?' egr-btn':''}" onclick='clickSrv(${JSON.stringify(s)})'>
      <span class="sico">${s.ico}</span>
      <span class="snom">${s.nom}</span>
      <span class="sprecio">${s.p>0?'$'+s.p.toLocaleString('es-MX'):'Custom'}</span>
    </button>`).join('');
  };

}
function clickSrv(s){
  if(cajaBloqueada()){toast('🔒 Caja cerrada — se habilita mañana','err');return;}
  if(s.p>0){
    elegirResponsable(function(resp){
      const mov={id:'M-'+Date.now(),folioCaja:generarFolioMovCaja(),fecha:hoy(),hora:hora(),descripcion:s.nom,monto:s.p,
        tipo:s.e?'egreso':'ingreso',cat:s.cat,fuente:'caja',responsable:resp};
      _registrarMovimiento(mov);save();renderCaja();setTimeout(()=>syncEstadoSupabaseDebounced(),100);
      toast(`${s.e?'▼':'▲'} ${s.nom} — $${fmt(s.p)}`,s.e?'err':'ok');
    });
  } else {
    abrirLibre(s);
  }
}