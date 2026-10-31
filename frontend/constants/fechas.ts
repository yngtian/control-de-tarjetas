/* ============================================================
   Nombres de meses para mostrar en pantalla.
   Los cálculos de fechas (vencimientos, cortes, cuotas) los hace el backend.
   ============================================================ */

// lista con los nombres de los 12 meses
export const MESES = [
  // meses de la primera mitad del año
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  // meses de la segunda mitad del año
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Nombre del mes de una clave: "2026-11" -> "Noviembre". */
export function nombreMesDeClave(clave: string): string {
  // toma el número del mes y busca su nombre en la lista
  return MESES[parseInt(clave.split('-')[1], 10) - 1];
}

/** Nombre del mes con año: "2027-02" -> "Febrero 2027". */
export function nombreMesConAnio(clave: string): string {
  // junta el nombre del mes con el año
  return `${nombreMesDeClave(clave)} ${clave.split('-')[0]}`;
}
