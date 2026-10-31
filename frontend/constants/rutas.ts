/**
 * Rutas de la app. Coinciden con los nombres de archivo dentro de app/
 * (expo-router usa el nombre del archivo como ruta, mayúsculas incluidas).
 *
 * Centralizarlas evita errores de tipeo y permite renombrar una pantalla
 * cambiando un solo lugar.
 */
export const RUTAS = {
  // pantalla de inicio
  inicio: '/',
  // pantalla con la lista de tarjetas
  tarjetas: '/Tarjetas',
  // pantalla para agregar una tarjeta
  registrarTarjeta: '/RegistrarTarjeta',
  // pantalla para registrar una compra
  registrarTransaccion: '/RegistrarTransaccion',
  // pantalla con la lista de suscripciones
  suscripciones: '/Suscripciones',
  // pantalla para agregar una suscripción
  registrarSuscripcion: '/RegistrarSuscripcion',
  // pantalla con lo que se pagará en los próximos meses
  proyecciones: '/Proyecciones',
  // Ruta dinámica: app/detalle-tarjeta/[id].tsx
  detalleTarjeta: (id: string) => `/detalle-tarjeta/${id}` as const,
  // Rutas dinámicas: app/editar-tarjeta/[id].tsx y app/editar-compra/[id].tsx
  editarTarjeta: (id: string) => `/editar-tarjeta/${id}` as const,
  // pantalla para cambiar los datos de una compra
  editarCompra: (id: string) => `/editar-compra/${id}` as const,
  // Ruta dinámica: app/detalle-suscripcion/[id].tsx
  detalleSuscripcion: (id: string) => `/detalle-suscripcion/${id}` as const,
  // Ruta dinámica: app/compartir-tarjeta/[id].tsx
  compartirTarjeta: (id: string) => `/compartir-tarjeta/${id}` as const,
} as const;
