# Seguridad antes de publicar

## Repositorio

Usa un repositorio privado mientras existan nombres, teléfonos u otros datos operativos precargados. GitHub Pages publica los archivos del sitio para cualquier visitante que conozca la dirección.

## Supabase

- Mantén activadas las políticas RLS en todas las tablas y buckets.
- Autoriza por usuario y por despacho; no confíes únicamente en filtros del navegador.
- La clave `anon` puede estar en el cliente, pero nunca una clave `service_role`.

## Proveedores de IA

No publiques claves privadas de Groq, Gemini, Mistral o Anthropic. Las llamadas deben pasar por Cloudflare Workers, Supabase Edge Functions u otro intermediario de servidor.

## Datos locales

El almacenamiento del navegador es accesible para JavaScript ejecutado en la página. Evita conservar allí secretos permanentes o documentos confidenciales sin protección adicional.

