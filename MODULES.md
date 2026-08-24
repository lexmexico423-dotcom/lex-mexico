# Módulos de LEX-MÉXICO

La aplicación se dividió gradualmente sin cambiar la lógica de sus funciones.

## Áreas

- `assets/js/modules/recibos/`: folios, pagos, anticipos, conceptos y recibos.
- `assets/js/modules/caja/`: caja, cortes, cierres, ingresos, egresos y saldos.
- `assets/js/modules/contabilidad/`: movimientos, conciliación, históricos y balances.
- `assets/js/modules/clientes/`: búsquedas, responsables y datos de clientes.
- `assets/js/modules/directorio/`: contactos, teléfonos y operaciones del directorio.
- `assets/js/modules/expedientes/`: carpetas, juicios, citas, gestiones, acuerdos y leyes.
- `assets/js/modules/documentos/`: PDF, Drive, R2, OCR, placas y archivos.
- `assets/js/modules/integraciones/`: Supabase, sincronización, OAuth y proveedores externos.
- `assets/js/modules/administracion/`: usuarios, auditoría, configuración y herramientas administrativas.
- `assets/js/modules/core/`: utilidades compartidas que todavía no pertenecen claramente a un área.

## Compatibilidad

Los archivos de `assets/js/compat/` conservan inicializaciones, datos globales y bloques que todavía dependen del orden heredado. No deben eliminarse. Esta separación es deliberadamente gradual para evitar cambios en caja, recibos o contabilidad.

`MODULE-MANIFEST.json` indica el módulo y archivo de origen de cada función trasladada.

## Resultado

Se trasladaron 1,072 funciones sin reescribir su contenido. Los scripts de cada área se cargan antes de los bloques de compatibilidad, manteniendo disponibles las funciones que el sistema espera globalmente.

## Siguiente etapa

Los módulos más grandes son `recibos` y `administracion`. En una etapa posterior pueden dividirse internamente en submódulos, acompañados de pruebas funcionales de pagos, cancelaciones, cierres y restauraciones.

