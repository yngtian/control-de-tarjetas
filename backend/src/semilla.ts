/* ============================================================
   Datos de ejemplo:  npm run semilla

   Deja dos cuentas listas para probar la app, también la tarjeta compartida entre ellas:
   - "demo" (contraseña "123"): la cuenta principal de ejemplo.
   - "camila" (contraseña "123"): otra persona, con quien demo comparte su Banco Estado.
   Reemplaza las tarjetas, compras, suscripciones y tarjetas compartidas de esas dos
   cuentas. No toca ninguna otra cuenta.
   Las fechas se calculan desde el mes actual, así se ve igual cualquier día que se corra:

   Cuenta demo
   - Banco Estado: compartida con Camila; hay compras de las dos. Al día hasta el mes pasado.
   - CMR Falabella: ya pagada este mes.
   - Visa Platinum: una compra que se cobra recién el mes siguiente.
   - Banco Santander: 2 meses sin pagar (muestra la acumulación de atrasos).
   Cuenta camila
   - Su propia Visa, más la Banco Estado que demo compartió con ella.
   ============================================================ */

import { crearBaseDeDatos } from './db';
import { calcularCuotaBase } from './logica/cuotas';
import { claveMes, sumarMeses } from './logica/fechas';
import type { SuscripcionBase, TarjetaBase, TransaccionBase } from './modelos';
import { asegurarCuenta, asegurarCuentaDemo } from './rutasAuth';

try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usa el archivo local como base de datos
}

const bd = await crearBaseDeDatos();
if (!(await asegurarCuentaDemo(bd))) {
  console.error('La cuenta demo está desactivada (CUENTA_DEMO=no): no hay dónde cargar los datos.');
  process.exit(1);
}
const demo = await asegurarCuenta(bd, { email: 'demo', password: '123', nombre: 'Demo' });
const camila = await asegurarCuenta(bd, { email: 'camila', password: '123', nombre: 'Camila' });

// Mes relativo al actual: mes(-1) = el mes pasado
const actual = claveMes();
const mes = (desplazamiento: number) => sumarMeses(actual, desplazamiento);

// Los id empiezan con un número creciente: la app muestra primero el más alto (el "más nuevo")
let contador = Date.now();
const nuevoId = () => `${contador++}-ejemplo`;

/** Lo que se carga en cada cuenta. */
function cuentaVacia() {
  return {
    tarjetas: [] as TarjetaBase[],
    compras: [] as TransaccionBase[],
    suscripciones: [] as SuscripcionBase[],
  };
}
const datosDemo = cuentaVacia();
const datosCamila = cuentaVacia();
type Cuenta = ReturnType<typeof cuentaVacia>;

function tarjeta(cuenta: Cuenta, datos: Omit<TarjetaBase, 'id'>): string {
  const id = nuevoId();
  cuenta.tarjetas.push({ id, ...datos });
  return id;
}

/**
 * Compra de `monto` en `cuotas`, cuya cuota 1 se cobró en `mesInicio` y que va en `cuotaActual`.
 * Se guarda en la cuenta del dueño de la tarjeta, aunque la haya registrado `autor`.
 */
function compra(
  cuenta: Cuenta, autor: string, tarjetaId: string,
  motivo: string, monto: number, cuotas: number, mesInicio: string, cuotaActual: number
) {
  cuenta.compras.push({
    id: nuevoId(),
    tarjetaId,
    motivo,
    montoTotal: monto,
    cuotaMensual: calcularCuotaBase(monto, cuotas),
    cuotaActual,
    totalCuotas: cuotas,
    mesInicio,
    autorUid: autor,
  });
}

function suscripcion(
  cuenta: Cuenta, autor: string, tarjetaId: string,
  nombre: string, plan: string, monto: number, mesInicio: string, ultimoMesPagado: string
) {
  cuenta.suscripciones.push({ id: nuevoId(), tarjetaId, nombre, plan, monto, mesInicio, ultimoMesPagado, autorUid: autor });
}

/* ---------- Cuenta demo ---------- */

// Santander: pagó hasta hace 3 meses, así que debe 2 meses atrasados + el actual
const santander = tarjeta(datosDemo, {
  emisor: 'santander', nombre: 'Banco Santander', alias: 'Banco Santander', banco: 'Banco Santander',
  diaVencimiento: 15, colorHex: '#DC2626', cupoTotal: 600000, ultimoMesPagado: mes(-3),
});
// 6 cuotas desde hace 4 meses; pagó las 2 primeras
compra(datosDemo, demo, santander, 'Bicicleta Oxford', 359990, 6, mes(-4), 3);
suscripcion(datosDemo, demo, santander, 'Disney+', 'Plan Estándar', 8990, mes(-5), mes(-3));

// Visa: al día hasta el mes pasado; lo del supermercado se cobra este mes y los pasajes el próximo
const visa = tarjeta(datosDemo, {
  emisor: 'visa', nombre: 'Visa Platinum', alias: 'Visa Platinum', banco: 'Visa Platinum',
  diaVencimiento: 25, colorHex: '#1E3A8A', cupoTotal: 2000000, ultimoMesPagado: mes(-1),
});
compra(datosDemo, demo, visa, 'Pasajes Santiago - Puerto Montt', 240000, 3, mes(1), 1);
compra(datosDemo, demo, visa, 'Supermercado Líder', 118450, 1, actual, 1);
suscripcion(datosDemo, demo, visa, 'ChatGPT', 'Plan Plus', 20000, mes(-3), mes(-1));

// Falabella: ya pagó este mes (el refrigerador avanzó a la cuota 4)
const falabella = tarjeta(datosDemo, {
  emisor: 'falabella', nombre: 'CMR Falabella', alias: 'CMR Falabella', banco: 'CMR Falabella',
  diaVencimiento: 20, colorHex: '#15803D', cupoTotal: 800000, ultimoMesPagado: actual,
});
compra(datosDemo, demo, falabella, 'Refrigerador Samsung', 649990, 6, mes(-2), 4);
suscripcion(datosDemo, demo, falabella, 'Spotify', 'Premium Individual', 6990, mes(-6), actual);

// Banco Estado: compartida con Camila. Sus compras se guardan en la cuenta de demo (la dueña),
// pero Camila también registró algunas
const bancoEstado = tarjeta(datosDemo, {
  emisor: 'bancoestado', nombre: 'Banco Estado', alias: 'Banco Estado', banco: 'Banco Estado',
  diaVencimiento: 31, colorHex: '#EA580C', cupoTotal: 1500000, ultimoMesPagado: mes(-1),
  miembros: { [camila]: true },
});
// 12 cuotas desde hace 3 meses: pagó 3, este mes toca la 4
compra(datosDemo, demo, bancoEstado, 'Notebook Lenovo', 899990, 12, mes(-3), 4);
compra(datosDemo, camila, bancoEstado, 'Zapatillas Nike', 89990, 3, mes(-1), 2);
suscripcion(datosDemo, demo, bancoEstado, 'Netflix', 'Plan Estándar', 10990, mes(-6), mes(-1));
suscripcion(datosDemo, camila, bancoEstado, 'YouTube Premium', 'Individual', 5990, mes(-2), mes(-1));

/* ---------- Cuenta camila ---------- */

const visaCamila = tarjeta(datosCamila, {
  emisor: 'visa', nombre: 'Visa Camila', alias: 'Visa Camila', banco: 'Visa Camila',
  diaVencimiento: 10, colorHex: '#1E3A8A', cupoTotal: 900000, ultimoMesPagado: mes(-1),
});
compra(datosCamila, camila, visaCamila, 'Curso de inglés', 300000, 6, mes(-1), 2);
suscripcion(datosCamila, camila, visaCamila, 'iCloud', '50 GB', 990, mes(-4), mes(-1));

/* ---------- Guardar ---------- */

// Firebase guarda colecciones como { id: elemento }
const porId = <T extends { id: string }>(lista: T[]) => Object.fromEntries(lista.map((x) => [x.id, x]));
const guardarCuenta = (uid: string, datos: Cuenta) => ({
  [`usuarios/${uid}/tarjetas`]: porId(datos.tarjetas),
  [`usuarios/${uid}/transacciones`]: porId(datos.compras),
  [`usuarios/${uid}/suscripciones`]: porId(datos.suscripciones),
});
await bd.actualizar({
  ...guardarCuenta(demo, datosDemo),
  ...guardarCuenta(camila, datosCamila),
  [`usuarios/${demo}/compartidasConmigo`]: null,
  // Camila ve la Banco Estado de demo
  [`usuarios/${camila}/compartidasConmigo`]: { [bancoEstado]: { dueno: demo } },
});

console.log(`Datos de ejemplo cargados (${bd.descripcion}):`);
console.log(`  demo:   ${datosDemo.tarjetas.length} tarjetas, ${datosDemo.compras.length} compras, ${datosDemo.suscripciones.length} suscripciones.`);
console.log(`  camila: ${datosCamila.tarjetas.length} tarjeta propia + la Banco Estado que demo compartió con ella.`);
console.log('  Ingresa con correo "demo" o "camila" y contraseña "123".');
