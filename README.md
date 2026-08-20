# LEX-MÉXICO · Sistema Integral

Versión modular preparada para publicación como sitio estático en GitHub Pages.

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
- `legacy/index.original.html`: copia intacta del archivo recibido.
- `ARCHITECTURE.md`: mapa de responsabilidades y orden de carga.
- `SECURITY.md`: revisión imprescindible antes de publicar datos reales.

## Aviso de seguridad

Antes de usar un repositorio público, revisa los datos precargados en el sistema. La aplicación contiene información operativa y un directorio con nombres y teléfonos. Para un sistema real se recomienda un repositorio privado y políticas RLS estrictas en Supabase.

Las claves privadas de servicios de IA no deben escribirse en estos archivos ni publicarse en GitHub. Deben permanecer detrás de Cloudflare Workers, Supabase Edge Functions u otro servicio de servidor.

## Configuración existente

La versión modular conserva las integraciones y el comportamiento del archivo original. La clave pública `anon` de Supabase continúa en el cliente, como requiere Supabase; su acceso debe estar limitado mediante RLS.
