# Seguridad de la copia publicable

## Estado de esta carpeta

- No contiene el directorio ni expedientes precargados con nombres y teléfonos.
- No contiene el respaldo `legacy/` del HTML original.
- No contiene un token fijo para R2/Cloudflare.
- Los tokens de sesión se envían mediante `X-Auth-Token`, nunca en la URL.
- Las llaves de proveedores de IA solo viven en `sessionStorage` durante la
  pestaña actual; no se leen ni se escriben en `localStorage` o Supabase.
- La clave `anon` de Supabase es pública por diseño; no es una `service_role`.

## Repositorio

GitHub Pages siempre publica los archivos del sitio. No agregues exportaciones,
PDF, respaldos, credenciales, bases de datos ni copias del sistema original a
esta carpeta. `.gitignore` incluye bloqueos preventivos para esos archivos.

## Supabase

- Mantén activadas las políticas RLS en `app_state`, `miembros`, `despachos`,
  `versiones_recibo`, `configuracion`, `sesiones_log` y Storage.
- Autoriza por `auth.uid()` y `despacho_id`; no confíes en filtros, correos o
  botones ocultos del navegador.
- La clave `anon` puede estar en el cliente, pero nunca una clave `service_role`.

## Cloudflare Worker y R2

1. Rota el antiguo token fijo que aceptaba el Worker.
2. Elimina completamente el fallback a ese token en el servidor.
3. Valida cada `X-Auth-Token` como JWT activo de Supabase.
4. Comprueba que el usuario pertenece al `despacho_id` solicitado.
5. Limita CORS al dominio definitivo de GitHub Pages y al entorno local de
   desarrollo cuando corresponda.
6. No registres JWT, tokens OAuth, nombres de documentos ni cuerpos de IA.

La copia frontend ya exige sesión. Sin estos cambios en el Worker, no se puede
considerar seguro el backend aunque el repositorio esté limpio.

## Google Drive y Calendar

La redirección está en `assets/js/config/public-config.js`. Debe coincidir
exactamente con la URI autorizada en Google Cloud. El secreto OAuth permanece
únicamente en el Worker; nunca debe agregarse al repositorio.

## Proveedores de IA

No publiques claves privadas compartidas de Groq, Gemini, Mistral, Anthropic o
Cloudflare. La solución recomendada es guardarlas como secretos del Worker y
exponer solamente rutas que validen el JWT de Supabase.

Como transición, esta copia permite capturar claves personales de IA y las
conserva únicamente durante la sesión de la pestaña. Si la instalación anterior
ya guardó secretos en `configuracion`, elimina las filas `groq_api_key`,
`gemini_api_key`, `mistral_api_key`, `cfai_account_id` y `cfai_api_token`
después de migrarlas a secretos del Worker o de confirmar que ya no se usan.

Las comprobaciones de correo y rol del frontend solo controlan la interfaz. La
autorización real debe aplicarse en RLS y en el Worker para cada operación.

## Datos locales

El almacenamiento del navegador es accesible para JavaScript ejecutado en la
página. No guardes allí contraseñas, claves maestras, documentos confidenciales
ni tokens de servicio permanentes.
