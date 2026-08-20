# Arquitectura de LEX-MÉXICO

Esta versión conserva el comportamiento y el orden de carga del sistema original, pero organiza sus recursos por responsabilidad.

## Interfaz

- `assets/css/core/application.css`: diseño general, navegación, paneles y componentes compartidos.
- `assets/css/components/`: ventanas, arranque, IA y visor de documentos.
- `assets/css/modules/`: recibos, carpetas y vehículos.
- `assets/css/admin/`: presentación de herramientas administrativas.
- `assets/js/ui/`: comportamiento exclusivamente visual y navegación.

## Núcleo

- `assets/js/config/public-config.js`: valores públicos necesarios para conectar el navegador.
- `assets/js/core/error-guard.js`: captura defensiva de fallos.
- `assets/js/diagnostics/network-console.js`: diagnóstico de red y proveedores.
- `assets/js/integrations/`: autenticación emergente y limpieza de sesiones.

## Aplicación

- `assets/js/app/receipts-and-supabase.js`: recibos, estado principal y persistencia.
- `assets/js/app/operations-and-accounting.js`: operaciones, caja y contabilidad.
- `assets/js/app/folio-query-and-statements.js`: consulta de folios y estados de cuenta.

## Administración

- `assets/js/admin/receipt-restoration.js`: restauración de recibos.
- `assets/js/admin/scansys-engine.js`: diagnóstico de folios.
- `assets/js/admin/accounting-restoration.js`: reconstrucción contable.
- `assets/js/admin/cash-cut-management.js`: administración de cortes.

## Compatibilidad

Los archivos se cargan como scripts clásicos y en el mismo orden que el documento original. Esto es intencional: el sistema heredado utiliza funciones y variables globales compartidas. Convertirlos directamente a módulos ES rompería los manejadores HTML y la inicialización existente.

El archivo `legacy/index.original.html` es una copia verificable del original y no participa en la ejecución.
