# LEX-MÉXICO · Versión Modular Segura

Esta es una copia independiente preparada para GitHub Pages. No contiene el
HTML original, el directorio precargado ni los expedientes de demostración con
datos personales.

## Publicación

1. Crea un repositorio en GitHub.
2. Sube **el contenido de esta carpeta** a la rama `main`.
3. En GitHub abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Elige la rama `main`, la carpeta `/ (root)` y guarda.

## Estructura

- `index.html`: entrada de la aplicación.
- `assets/css/`: estilos organizados por núcleo, componentes, módulos y administración.
- `assets/js/`: comportamiento organizado por aplicación, interfaz, integraciones y administración.
- `ARCHITECTURE.md`: mapa de responsabilidades y orden de carga.
- `SECURITY.md`: revisión imprescindible antes de publicar datos reales.
- `MODULES.md`: distribución de los motores por área funcional.
- `MODULE-MANIFEST.json`: inventario de las funciones trasladadas.

## Cambios de seguridad incluidos

- Se retiraron las semillas `DIR0` y `JUI0` con información personal.
- Se retiró la carpeta `legacy/` de la copia publicable.
- Se eliminó el token fijo de respaldo de Cloudflare/R2.
- Los JWT ya no viajan en parámetros de la URL; se envían en encabezados.
- Las llaves de Groq, Gemini, Mistral y Cloudflare AI solo se conservan en la
  sesión de la pestaña; no se guardan en `localStorage` ni en Supabase.
- R2 y las operaciones administrativas usan la sesión válida de Supabase.
- El resumen de acuerdos usa el conector general de IA y no una llamada incompleta a Anthropic.
- Se corrigieron los botones para agregar clientes y conceptos en el recibo.
- La dirección OAuth de Google quedó centralizada en `assets/js/config/public-config.js`.

## Paso obligatorio del servidor

Antes de publicar, rota el antiguo token de R2 y elimina su aceptación en el
Worker de Cloudflare. Esta carpeta ya no lo usa, pero retirar el texto del
frontend no revoca un token que el servidor todavía acepte.

Las claves compartidas de IA deben permanecer detrás del Worker. El modo
directo incluido es transitorio: requiere capturar una clave personal al abrir
una nueva sesión y nunca debe usar la clave maestra del despacho.

## Configuración existente

La clave pública `anon` de Supabase continúa en el cliente, como requiere una
aplicación web estática. Su alcance debe estar limitado mediante RLS por usuario
y por `despacho_id`.
