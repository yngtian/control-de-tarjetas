/**
 * Rutas de la app. Coinciden con los nombres de archivo dentro de app/
 * (expo-router usa el nombre del archivo como ruta, mayúsculas incluidas).
 *
 * Centralizarlas evita errores de tipeo y permite renombrar una pantalla
 * cambiando un solo lugar.
 */
export const RUTAS = {
  inicio: '/',
  tarjetas: '/Tarjetas',
  registrarTarjeta: '/RegistrarTarjeta',
  registrarTransaccion: '/RegistrarTransaccion',
  suscripciones: '/Suscripciones',
  registrarSuscripcion: '/RegistrarSuscripcion',
  proyecciones: '/Proyecciones',
  // Ruta dinámica: app/detalle-tarjeta/[id].tsx
  detalleTarjeta: (id: string) => `/detalle-tarjeta/${id}` as const,
  // Rutas dinámicas: app/editar-tarjeta/[id].tsx y app/editar-compra/[id].tsx
  editarTarjeta: (id: string) => `/editar-tarjeta/${id}` as const,
  editarCompra: (id: string) => `/editar-compra/${id}` as const,
  // Ruta dinámica: app/detalle-suscripcion/[id].tsx
  detalleSuscripcion: (id: string) => `/detalle-suscripcion/${id}` as const,
  // Ruta dinámica: app/compartir-tarjeta/[id].tsx
  compartirTarjeta: (id: string) => `/compartir-tarjeta/${id}` as const,
} as const;
