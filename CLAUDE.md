# CLAUDE.md — LEX México

## ⚠️ LÍNEAS CRÍTICAS — NUNCA MODIFICAR SIN AUTORIZACIÓN EXPLÍCITA

Estas líneas corrigen bugs graves que costaron múltiples sesiones de depuración.
Antes de tocar cualquiera de estas secciones, confirmar con el usuario.

---

### 1. `_fila()` — fallback de letra siempre 'A'
**Archivo:** `index.html` — función `_fila(m, bgBody)` (~línea 13188)
```javascript
/* ⚠️ CRÍTICO */
if(!_letraF) _letraF = 'A';
```
**Por qué:** Si se usa `_rFol.letra` como fallback, `_rFol` siempre devuelve la versión B/C (índice 0 del array), haciendo que el folio A aparezca con la letra de B en la fecha de creación de A.

---

### 2. `_registrarMovimiento()` — dedup incluye letra
**Archivo:** `index.html` — función `_registrarMovimiento(mov)` (~línea 17675)
```javascript
/* ⚠️ CRÍTICO */
(m.letra || 'A') === (mov.letra || 'A') &&
```
**Por qué:** Sin comparar la letra, movimientos A y B del mismo folio/fecha/monto se tratan como duplicados y uno se descarta, rompiendo la contabilidad.

---

### 3. `guardarReciboInterno()` — movimiento con letra 'A'
**Archivo:** `index.html` — función `guardarReciboInterno()` (~línea 18740)
```javascript
fuente: 'recibo',
letra: 'A', /* ⚠️ CRÍTICO */
```
**Por qué:** El sub-panel de recibos crea el movimiento sin `letra`. Cuando después se genera B, `_fila()` no encuentra letra en el movimiento y cae al fallback, que devuelve la letra de B.

---

### 4. `abrirPreviaDesdeContab()` — busca por folio Y letra
**Archivo:** `index.html` — función `abrirPreviaDesdeContab(numFolio, letra)` (~línea 21807)
```javascript
const letraBuscar = letra || 'A';
const r = recibos.find(x=>
  (x.folio===numFolio||x.folio===parseInt(numFolio)) &&
  !x.esComplemento &&
  (x.letra || letraVersion(x) || 'A') === letraBuscar
);
```
**Por qué:** Sin filtrar por letra, `find()` siempre devuelve la versión más reciente (índice 0). Clic en 26-001A abría el PDF de 26-001C.
El onclick en `_fila()` debe pasar la letra: `abrirPreviaDesdeContab(${n},'${_letraF}')`.

---

## Arquitectura general
- Archivo principal: `index.html` (monolítico, todo inline)
- Base de datos: Supabase (`app_state` — columnas `data`, `recibos`, `folio_actual`)
- PDFs: Cloudflare R2 → Supabase Storage (en ese orden de prioridad)
- Variables globales clave: `D` (caja/directorio), `REC` (recibos), `appData` (espejo de REC)
