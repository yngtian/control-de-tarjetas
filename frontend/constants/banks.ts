// forma que tiene cada banco de la lista
export interface BankOption {
  // código interno del banco
  id: string;       // identificador interno, no se muestra
  // nombre del banco que ve el usuario
  nombre: string;   // nombre que sale en el selector y en la tarjeta
  // aquí se elige el color de la tarjeta de ese banco
  colorHex: string; // color de fondo de la tarjeta
}

// Color de respaldo cuando una tarjeta no trae color propio
export const COLOR_TARJETA_DEFAULT = '#1E293B';

// lista de bancos que el usuario puede elegir
export const LISTA_BANCOS: BankOption[] = [
  // Banco Estado, con tarjeta naranja
  { id: 'bancoestado', nombre: 'Banco Estado', colorHex: '#EA580C' },
  // CMR Falabella, con tarjeta verde
  { id: 'falabella', nombre: 'CMR Falabella', colorHex: '#15803D' },
  // Banco Santander, con tarjeta roja
  { id: 'santander', nombre: 'Banco Santander', colorHex: '#DC2626' },
  // MasterCard, con tarjeta gris oscuro
  { id: 'mastercard', nombre: 'MasterCard', colorHex: '#1E293B' },
  // Visa, con tarjeta azul
  { id: 'visa', nombre: 'Visa', colorHex: '#1E3A8A' },
];
