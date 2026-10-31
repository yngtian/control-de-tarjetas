/* ============================================================
   Nombres de meses para mostrar en pantalla.
   Los cálculos de fechas (vencimientos, cortes, cuotas) los hace el backend.
   ============================================================ */

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Nombre del mes de una clave: "2026-11" -> "Noviembre". */
export function nombreMesDeClave(clave: string): string {
  return MESES[parseInt(clave.split('-')[1], 10) - 1];
}

/** Nombre del mes con año: "2027-02" -> "Febrero 2027". */
export function nombreMesConAnio(clave: string): string {
  return `${nombreMesDeClave(clave)} ${clave.split('-')[0]}`;
}
