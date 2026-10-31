import { Ionicons } from '@expo/vector-icons';
import { NavigationBar } from 'expo-navigation-bar';
// useLocalSearchParams lee los parametros de la ruta, en este caso el id
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import PantallaFormulario from '../../components/PantallaFormulario';
import SuscripcionFila from '../../components/SuscripcionFila';
import CardItem from '../../components/TarjetaGrande';
import { avisar, avisarSinConexion, confirmar } from '../../constants/alertas';
import { nombreMesDeClave } from '../../constants/fechas';
import { formatearCLP, nombresCompartidos } from '../../constants/formato';
import { RUTAS } from '../../constants/rutas';
import { useApp } from '../../context/AppContext';
import { useSesion } from '../../context/SesionContext';

export default function DetalleTarjetaScreen() {
  // saca el id que viene en la ruta, ej: /detalle-tarjeta/1727630000000
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tarjetas, transacciones, suscripciones, pagarMesTarjeta, dejarDeCompartir, mesActual } = useApp();
  const { usuario } = useSesion();

  const tarjeta = tarjetas.find((t) => t.id === id);
  // se queda solo con las compras de esta tarjeta
  const txTarjeta = transacciones.filter((tx) => tx.tarjetaId === id);

  // Solo las suscripciones con algo por pagar: al pagar el mes desaparecen y vuelven el mes siguiente
  const subsTarjeta = suscripciones.filter((s) => s.tarjetaId === id && !s.pagadaEsteMes);
  // Lo que se debe de ellas (con meses atrasados puede ser más de una mensualidad)
  const totalSubs = subsTarjeta.reduce((acc, s) => acc + s.montoPorPagar, 0);
  const subsAtrasadas = subsTarjeta.some((s) => s.mesesPorPagar > 1);

  // si no encontro la tarjeta (por ejemplo se recargo la app y se borro todo) muestra un aviso
  if (!tarjeta) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-6">
        <Text className="text-slate-600 text-base mb-4">Tarjeta no encontrada.</Text>
        {/* boton para volver a la lista */}
        <TouchableOpacity
          onPress={() => router.replace(RUTAS.tarjetas)}
          className="px-5 py-2.5 bg-color-action rounded-xl">
          <Text className="text-white font-inter-bold">Volver a Tarjetas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ¿La ven otras personas? (el dueño y aquellos con quienes la compartió)
  const compartida = tarjeta.compartidaCon.length > 0;

  /**
   * Registra el pago del mes: avanza en cada compra las cuotas que debía (más las atrasadas),
   * quita las que terminan, marca las suscripciones como pagadas y libera el cupo.
   * Solo se puede una vez por mes. En una tarjeta compartida, el pago queda registrado para todos.
   */
  const handleMarcarPagado = () => {
    // Ya se pagó este mes: evita avanzar las cuotas dos veces
    if (tarjeta.pagadaEsteMes) {
      avisar('Mes ya pagado', 'Ya registraste el pago de este mes en esta tarjeta. Podrás volver a pagar el próximo mes.');
      return;
    }

    // Nada por pagar este mes (ni cuotas ni suscripciones)
    if (tarjeta.montoNumerico === 0) {
      avisar('Al día', 'Esta tarjeta no tiene pagos pendientes este mes.');
      return;
    }

    // `montoNumerico` incluye cuotas + suscripciones pendientes de todos, atrasadas incluidas
    const montoMes = formatearCLP(tarjeta.montoNumerico);
    const atraso =
      tarjeta.mesesAtrasados > 0
        ? `Incluye ${formatearCLP(tarjeta.montoAtrasado)} de ${tarjeta.mesesAtrasados} ${
            tarjeta.mesesAtrasados === 1 ? 'mes atrasado' : 'meses atrasados'
          }. `
        : '';

    confirmar({
      titulo: 'Registrar pago del mes',
      mensaje:
        `Se registrará el pago de ${montoMes}. ` +
        (compartida ? `La tarjeta es compartida: ${nombresCompartidos(tarjeta.compartidaCon)} también la verá pagada. ` : '') +
        atraso +
        `Cada compra avanzará las cuotas pagadas (las que lleguen a su última cuota saldrán del resumen) ` +
        `y las suscripciones quedarán pagadas este mes y volverán a cobrarse el próximo. Ese monto se liberará de tu cupo disponible.`,
      textoConfirmar: 'Confirmar pago',
      onConfirmar: async () => {
        const { resultado } = await pagarMesTarjeta(tarjeta.id);
        if (resultado === 'ok') avisar('Pago registrado', `Pagaste ${montoMes}. Tu cupo disponible aumentó.`);
        else if (resultado === 'sin_conexion') avisarSinConexion();
      },
    });
  };

  /** Una tarjeta que compartieron conmigo: dejar de verla (lo registrado en ella se queda). */
  const handleDejarDeVer = () => {
    confirmar({
      titulo: 'Dejar de ver esta tarjeta',
      mensaje:
        `${tarjeta.banco} es de ${tarjeta.duenoNombre}. Dejarás de verla, pero lo que registraste en ella se queda en su estado de cuenta.`,
      textoConfirmar: 'Dejar de verla',
      destructivo: true,
      onConfirmar: async () => {
        if (!usuario) return;
        const { resultado } = await dejarDeCompartir(tarjeta.id, usuario.uid);
        if (resultado === 'ok') return router.replace(RUTAS.tarjetas);
        if (resultado === 'sin_conexion') return avisarSinConexion();
        avisar('Error', 'No se pudo dejar de ver la tarjeta.');
      },
    });
  };

  return (
    <PantallaFormulario titulo="Detalle Tarjeta" onVolver={() => router.back()}>
      {/* Barra de navegación de Android oscura con botones claros (en iOS y web no hace nada) */}
      <NavigationBar style="dark" />
      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {/* Tarjeta superior con datos dinámicos */}
        <CardItem item={tarjeta} />

        {/* Meses anteriores sin pagar: se acumulan en el total */}
        {tarjeta.mesesAtrasados > 0 && (
          <View className="flex-row p-4 mb-4 bg-red-50 border border-red-100 rounded-2xl">
            <View className="w-9 h-9 rounded-xl bg-red-100 items-center justify-center mr-3">
              <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            </View>
            <View className="flex-1">
              <Text className="text-red-900 text-xs font-inter-bold mb-0.5">
                {tarjeta.mesesAtrasados} {tarjeta.mesesAtrasados === 1 ? 'mes' : 'meses'} sin pagar
              </Text>
              <Text className="text-red-900 text-xs font-inter-regular">
                El total incluye <Text className="font-inter-bold">{formatearCLP(tarjeta.montoAtrasado)}</Text> atrasados.
                Al registrar el pago se cubre todo lo acumulado.
              </Text>
            </View>
          </View>
        )}

        {/* Tarjeta compartida: todos ven las mismas compras, el mismo cupo y el mismo pago */}
        {compartida && (
          <View className="flex-row p-4 mb-4 bg-blue-50 border border-blue-100 rounded-2xl">
            <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center mr-3">
              <Ionicons name="people-outline" size={18} color="#1D4ED8" />
            </View>
            <View className="flex-1">
              <Text className="text-blue-900 text-xs font-inter-bold mb-0.5">
                Cuenta compartida con {nombresCompartidos(tarjeta.compartidaCon)}
              </Text>
              <Text className="text-blue-900 text-xs font-inter-regular">
                {tarjeta.propia ? 'Es tuya. ' : `Es de ${tarjeta.duenoNombre}. `}
                Los gastos que registre cualquiera aparecen para todos, y el cupo disponible (
                <Text className="font-inter-bold">{formatearCLP(tarjeta.cupoDisponible)}</Text>) es el mismo.
              </Text>
            </View>
          </View>
        )}

        {/* Cargos y Compras en Cuotas */}
        <View className="mt-2 mb-6">
          <Text className="text-slate-900 text-base font-inter-bold mb-3">
            Cargos y Compras en Cuotas
          </Text>

          {txTarjeta.length === 0 ? (
            <View className="p-4 rounded-2xl border border-dashed border-slate-200 items-center justify-center">
              <Text className="text-slate-400 text-xs">Sin pagos pendientes para este mes</Text>
            </View>
          ) : (
            txTarjeta.map((tx) => (
              // Al tocar una compra se abre para editarla o eliminarla
              <TouchableOpacity
                key={tx.id}
                onPress={() =>
                  tx.editable
                    ? router.push(RUTAS.editarCompra(tx.id))
                    : avisar('Compra de otra persona', `Solo ${tx.autor} o el dueño de la tarjeta pueden editarla.`)
                }
                activeOpacity={0.85}
                className="p-4 bg-white rounded-2xl border border-slate-100 flex-row justify-between items-center shadow-sm mb-3"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-slate-900 text-base font-inter-bold">{tx.motivo}</Text>
                  {/* En una tarjeta compartida: quién la registró */}
                  {tx.autor && (
                    <Text className="text-blue-600 text-[11px] font-inter-medium">Registrada por {tx.autor}</Text>
                  )}
                  <Text className="text-slate-400 text-xs font-inter-medium">
                    {tx.cuotasPorPagar > 1
                      ? `Cuotas ${tx.cuotaActual} a ${tx.cuotaActual + tx.cuotasPorPagar - 1}`
                      : `Cuota ${tx.cuotaActual}`}{' '}
                    de {tx.totalCuotas} (Total: {formatearCLP(tx.montoTotal)})
                  </Text>
                  {/* Cuotas de meses anteriores que no se pagaron */}
                  {tx.cuotasAtrasadas > 0 && (
                    <Text className="text-red-600 text-[11px] font-inter-medium mt-0.5">
                      {tx.cuotasAtrasadas} {tx.cuotasAtrasadas === 1 ? 'cuota atrasada' : 'cuotas atrasadas'} desde{' '}
                      {nombreMesDeClave(tx.mesCobro)}
                    </Text>
                  )}
                  {/* La cuota no se cobra este mes: compra hecha después del corte, o mes ya pagado */}
                  {tx.mesCobro > mesActual && (
                    <Text className="text-amber-600 text-[11px] font-inter-medium mt-0.5">
                      {tx.mesInicio > mesActual ? 'Se cobra desde' : 'Se cobra en'} {nombreMesDeClave(tx.mesCobro)}
                    </Text>
                  )}
                </View>
                {/* Lo que se debe de esta compra; si todavía no se cobra, la cuota que viene.
                    La última cuota puede valer distinto: absorbe el redondeo */}
                <Text className="text-slate-900 text-base font-inter-bold">
                  {formatearCLP(tx.cuotasPorPagar > 0 ? tx.montoPorPagar : tx.montoCuotaActual)}
                </Text>
                {tx.editable && <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 6 }} />}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Suscripciones asociadas a esta tarjeta */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-slate-900 text-base font-inter-bold">Suscripciones</Text>
            {subsTarjeta.length > 0 && (
              <View className="flex-row items-baseline px-3 py-1.5 bg-white rounded-full border border-slate-100">
                <Text className="text-slate-900 text-xs font-inter-bold">{formatearCLP(totalSubs)}</Text>
                <Text className="text-slate-400 text-[10px] font-inter-regular">
                  {subsAtrasadas ? ' por pagar' : ' /mes'}
                </Text>
              </View>
            )}
          </View>

          {subsTarjeta.length === 0 ? (
            <View className="p-4 rounded-2xl border border-dashed border-slate-200 items-center justify-center">
              <Text className="text-slate-400 text-xs">Sin suscripciones pendientes este mes</Text>
            </View>
          ) : (
            subsTarjeta.map((s) => <SuscripcionFila key={s.id} item={s} ocultarTarjeta />)
          )}
        </View>

        {/* Botón: Registrar Pago del Mes */}
        <TouchableOpacity
          onPress={handleMarcarPagado}
          activeOpacity={0.8}
          disabled={tarjeta.pagadaEsteMes}
          className={`w-full h-12 rounded-2xl items-center justify-center mb-3 shadow-sm ${
            tarjeta.pagadaEsteMes ? 'bg-slate-300' : 'bg-color-action'
          }`}
        >
          <Text className="text-white text-base font-inter-bold">
            {tarjeta.pagadaEsteMes ? 'Mes pagado' : 'Registrar Pago del Mes'}
          </Text>
        </TouchableOpacity>

        {tarjeta.propia ? (
          <>
            {/* Compartir con otra cuenta */}
            <TouchableOpacity
              onPress={() => router.push(RUTAS.compartirTarjeta(tarjeta.id))}
              activeOpacity={0.8}
              className="w-full h-12 mb-3 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
            >
              <Ionicons name="people-outline" size={20} color="#0F172A" />
              <Text className="text-slate-900 text-base font-inter-bold">
                {compartida ? 'Compartida con ' + nombresCompartidos(tarjeta.compartidaCon) : 'Compartir tarjeta'}
              </Text>
            </TouchableOpacity>

            {/* Editar o eliminar la tarjeta */}
            <TouchableOpacity
              onPress={() => router.push(RUTAS.editarTarjeta(tarjeta.id))}
              activeOpacity={0.8}
              className="w-full h-12 mb-8 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
            >
              <Ionicons name="create-outline" size={20} color="#0F172A" />
              <Text className="text-slate-900 text-base font-inter-bold">Editar tarjeta</Text>
            </TouchableOpacity>
          </>
        ) : (
          // Tarjeta de otra persona: solo se puede dejar de ver
          <TouchableOpacity
            onPress={handleDejarDeVer}
            activeOpacity={0.8}
            className="w-full h-12 mb-8 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
          >
            <Ionicons name="eye-off-outline" size={20} color="#DC2626" />
            <Text className="text-red-600 text-base font-inter-bold">Dejar de ver esta tarjeta</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </PantallaFormulario>
  );
}
