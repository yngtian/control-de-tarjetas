/**
 * Formato de dinero chileno: 10000 -> "$10.000".
 * Se usa para el texto `monto` de cada tarjeta (la app tiene su propia copia para mostrar montos).
 */
export const formatearCLP = (n: number): string => `$${n.toLocaleString('es-CL')}`;
