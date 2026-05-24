# CLAUDE.md — Sistema LEX México

## Qué es este proyecto

Aplicación web de gestión de despacho jurídico (LEX México). Es una **SPA monolítica de un solo archivo** (`index.html`) que corre completamente en el navegador. Maneja:

- Emisión y seguimiento de recibos con folio único
- Trámites vehiculares (altas, reemplacamientos, bajas, cambio de propietario)
- Pendientes de placas vinculados a recibos vehiculares
- Historial de clientes y directorio
- Contabilidad interna (caja, movimientos, cierres)
- Gestión de juicios, carpetas y expedientes
- Panel "En Gestión" para seguimiento de asuntos con cobro propio
- Liquidaciones parciales y totales de recibos
- Sincronización con Supabase (DB PostgreSQL + Storage para PDFs)
- Generación de PDFs (recibos, actualizaciones, liquidaciones)

**Backend:** Supabase — `app_state` (tabla única con JSON), Storage para PDFs, RPC `reservar_folio_atomico` para folios atómicos.

---

## Estructura del index.html

Archivo único de ~34,400 líneas. Sin módulos externos cargados desde carpetas separadas.

```
index.html
├── <head>           Estilos CSS inline (~3,000 líneas)
│   ├── Variables CSS (colores, tipografía)
│   ├── Componentes de layout (paneles, nav, modales)
│   └── Reglas críticas con :has() para visibilidad de paneles
│
├── <body>           HTML de la interfaz (~5,000 líneas)
│   ├── Barra de navegación lateral (nav-items)
│   ├── panel-recibo        — Formulario principal de recibos
│   ├── panel-busqueda-cliente — Búsqueda de clientes y folios
│   ├── panel-historial     — Historial de recibos
│   ├── panel-pendientes    — Pendientes (sección "placas", etc.)
│   ├── panel-gestiones     — Módulo "En Gestión"
│   ├── panel-caja          — Caja y movimientos
│   ├── panel-contab        — Contabilidad
│   ├── panel-directorio    — Directorio de clientes
│   └── Modales inline (validación, autorización, expedientes, etc.)
│
└── <script>         JS inline (~26,000 líneas)
    ├── Variables globales (appData, D, REC, tipoTramite, etc.)
    ├── Utilidades (fmt, hoy, hora, folioFormato, esc, etc.)
    ├── Supabase (init, sync, reservarFolioEnDrive, RPC)
    ├── PDF (generarPDF, generarPDFRecibo, imprimirDesdeBlob)
    ├── guardarRecibo()     — Flujo principal de guardado
    ├── imprimirActualizacion() — Liquidaciones y pagos parciales
    ├── cerrarConsulta()    — Cierre del modo consulta
    ├── limpiarFormCompleto() — Reset completo del formulario
    ├── syncFormVisibility() — Visibilidad del formulario vs paneles
    ├── togglePanelesBusqueda() — Apertura/cierre de búsqueda
    ├── Módulo gestiones    (líneas ~30745–31480)
    ├── Módulo pendientes   (renderPend, badges, etc.)
    └── regresarAlFormulario() — Botón flotante fijo (línea ~34353)
```

### Variables globales críticas

| Variable | Propósito |
|---|---|
| `appData` | Recibos, folio actual, año |
| `D` | Movimientos, directorio, pendientes, juicios, cierres |
| `REC` | Alias de appData para recibos (folioActual, recibos[]) |
| `tipoTramite` | `'normal'` o `'vehicular'` — estado del formulario actual |
| `reciboEnConsulta` | Recibo activo en modo consulta |
| `_panelesBusquedaAbiertos` | Estado del panel de búsqueda |

### CSS crítico — selector `:has()` de visibilidad

```css
/* Oculta el formulario cuando el panel de búsqueda está abierto */
#panel-busqueda-cliente:has(#paneles-busqueda-cuerpo:not([style*="display:none"])) ~ #recibo-body {
  display: none !important;
}
```

**IMPORTANTE:** Este selector usa `[style*="display:none"]` (sin espacio después de `:`).
- `element.setAttribute('style','display:none;...')` → SÍ lo detecta ✓
- `element.style.display = 'none'` → produce `"display: none;"` (con espacio) → NO lo detecta ✗

Siempre usar `setAttribute` para cerrar `paneles-busqueda-cuerpo`, nunca `.style.display`.

---

## Bugs corregidos en esta sesión (2026-05-24)

### 1. Botón "← Regresar al formulario" no funcionaba

**Archivo:** `index.html` líneas ~8943, ~2529, ~34353

**Causa raíz:** `cerrarConsulta()` solo llamaba `limpiarFormCompleto()` sin preparar el estado previo. El CSS `body.modo-consulta #paneles-busqueda-cuerpo { display: block !important }` forzaba el panel visible, pero como `limpiarFormCompleto()` usaba `.style.display = 'none'` (con espacio), el selector `:has([style*="display:none"])` no lo detectaba y `#recibo-body` quedaba oculto para siempre.

**Correcciones aplicadas:**

- `cerrarConsulta()` — Ahora remueve clases explícitamente y llama `cuerpo.setAttribute('style','display:none;padding:0 20px 14px;')` **antes** de `limpiarFormCompleto()`.
- CSS botón — Agregada regla `body.paneles-abiertos-consulta #btn-regresar-formulario { display: flex; }`.
- `regresarAlFormulario()` — Ahora también detecta y limpia la clase `paneles-abiertos-consulta`.

---

### 2. Pendiente de placas no se creaba al guardar recibo vehicular

**Archivo:** `index.html` líneas ~10770–10778, ~10820, ~10854

**Causa raíz — dos variables rotas:**

**Bug A:** `tipoTramite` es una variable global que `limpiarFormCompleto()` resetea a `'normal'`. Como la creación del pendiente ocurre dentro de un `setTimeout` que primero llama `limpiarFormCompleto()`, la condición `tipoTramite === 'vehicular'` siempre era `false`.

**Bug B:** `_saldoInicial` nunca fue declarada en ningún lugar del archivo. Era `undefined`, así `_saldoInicial > 0` siempre era `false`.

**Corrección aplicada:**
```javascript
// Capturar ANTES del setTimeout, junto con los otros valores guardados
const _tipoTramiteGuardado  = tipoTramite;
const _saldoInicialGuardado = saldoPendiente;
```
Y en el cuerpo del setTimeout:
- `tipoTramite === 'vehicular'` → `_tipoTramiteGuardado === 'vehicular'`
- `_saldoInicial > 0` → `_saldoInicialGuardado > 0`

---

### 3. Pendiente de placas no desaparecía al liquidar via comprobante de abono

**Archivo:** `index.html` líneas ~10739–10741

**Causa raíz:** El flujo de "comprobante de abono" marcaba `liquidado = true` cuando `nuevoSaldo <= 0`, pero nunca llamaba `_eliminarPendientePorFolio()`. (El flujo de `imprimirActualizacion()` sí lo llamaba correctamente.)

**Corrección aplicada:**
```javascript
if(nuevoSaldo <= 0){
  appData.recibos[idxOrig].liquidado = true;
  if(typeof _eliminarPendientePorFolio === 'function') _eliminarPendientePorFolio(folioAntNum);
}
```

---

### 4. Colisión de folios al generar recibo desde panel "En Gestión"

**Archivo:** `index.html` líneas ~31390–31426

**Causa raíz:** `gestConfirmarRecibo()` reservaba el folio de forma local (`_folioSiguienteUnico` + incremento manual en memoria + `guardarFolioEnDrive` post-hoc). Si dos usuarios generaban recibos simultáneamente —uno desde el formulario normal y otro desde Gestión— podían obtener el mismo folio.

**Corrección aplicada:** Reemplazado por el mismo mecanismo atómico del formulario principal:
```javascript
// Antes (no atómico):
const folio = _folioSiguienteUnico(REC.folioActual || appData.folioActual || 1);
REC.folioActual = folio + 1;
appData.folioActual = folio + 1;
// ...
pendingNextFolioRecibo = folio + 1;
await guardarFolioEnDrive(folio + 1);

// Ahora (atómico vía RPC PostgreSQL):
const folio = await reservarFolioEnDrive();
```

`reservarFolioEnDrive()` ejecuta `reservar_folio_atomico` en PostgreSQL (lock + increment + return en una transacción). Imposible que dos sesiones obtengan el mismo folio.

---

## Estado del flujo de pago parcial / liquidación

### Flujo normal (formulario principal → imprimirActualizacion)

1. Usuario consulta un folio con saldo pendiente
2. Hace clic en "Pago Total" → `ejecutarLiquidacionTotal()` → agrega fila de pago con el saldo
3. Hace clic en "Imprimir Actualización" → `imprimirActualizacion()`
4. Se calcula `saldoNuevo = max(0, saldoAnterior + costosExtra - abonosNuevos)`
5. Se genera PDF, se sube, se guarda en `appData.recibos`
6. Dentro de `setTimeout` post-impresión:
   - `siguienteFolio()` limpia el formulario
   - Si `saldoNuevo <= 0` → `_eliminarPendientePorFolio(recibo.folio)` ✓

### Flujo de comprobante de abono

1. Usuario referencia un folio anterior (`_folioReferencia`)
2. Genera un recibo nuevo — el anticipo se aplica al saldo del folio original
3. En `guardarRecibo()`, si `folioAntNum` existe:
   - `nuevoSaldo = max(0, total_original - total_abonado_nuevo)`
   - Si `nuevoSaldo <= 0` → `liquidado = true` + `_eliminarPendientePorFolio(folioAntNum)` ✓ (corregido hoy)

### Flujo desde panel "En Gestión"

1. Usuario hace clic en "Generar Recibo" dentro de una gestión
2. `gestConfirmarRecibo()` reserva folio atómico ✓ (corregido hoy)
3. Genera PDF, sube a Storage, registra en `appData.recibos` y contabilidad
4. Agrega entrada en `g.recibosOficiales[]` y `g.movimientos[]`
5. Llama `save()` + `syncEstadoSupabase()` para persistir

### Función _eliminarPendientePorFolio (línea ~10413)

Busca el pendiente de placas por dos criterios:
```javascript
p.id === 'PEND-REC-' + folio
// o bien:
p.reciboVinculadoFolio === folio && p.seccion === 'placas'
```
Si lo encuentra: lo elimina del array, llama `save()`, `renderPend()` y `badges()`.

---

## Carpeta SEPARACIÓN DE ARCHIVOS

Contiene una copia del código con los JS separados en archivos individuales. **No es la versión activa** — `index.html` en `Downloads` es el archivo en producción. Los archivos separados sirven como referencia para comparar implementaciones, pero no son cargados por ningún HTML.
