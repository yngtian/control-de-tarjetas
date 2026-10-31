// trae los íconos que se usan en la pantalla
import { Ionicons } from '@expo/vector-icons';
// trae el control de la barra de botones de abajo en Android
import { NavigationBar } from 'expo-navigation-bar';
// useLocalSearchParams lee los parametros de la ruta, en este caso el id
import { useLocalSearchParams, useRouter } from 'expo-router';
// trae React para poder armar la pantalla
import React from 'react';
// trae las piezas básicas: lista con scroll, texto, botón y caja
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

// trae el marco de pantalla con título y botón para volver
import PantallaFormulario from '../../components/PantallaFormulario';
// trae la fila que muestra una suscripción
import SuscripcionFila from '../../components/SuscripcionFila';
// trae el dibujo grande de la tarjeta
import CardItem from '../../components/TarjetaGrande';
// trae las funciones para mostrar avisos y pedir confirmación
import { avisar, avisarSinConexion, confirmar } from '../../constants/alertas';
// trae la función que escribe el nombre del mes
import { nombreMesDeClave } from '../../constants/fechas';
// trae las funciones que escriben montos y nombres de personas
import { formatearCLP, nombresCompartidos } from '../../constants/formato';
// trae las direcciones de las pantallas de la app
import { RUTAS } from '../../constants/rutas';
// trae los datos generales de la app (tarjetas, compras, suscripciones)
import { useApp } from '../../context/AppContext';
// trae los datos del usuario que inició sesión
import { useSesion } from '../../context/SesionContext';

// la pantalla que muestra el detalle de una tarjeta
export default function DetalleTarjetaScreen() {
  // saca el id que viene en la ruta, ej: /detalle-tarjeta/1727630000000
  const { id } = useLocalSearchParams<{ id: string }>();
  // sirve para ir a otras pantallas
  const router = useRouter();
  // trae los datos y las acciones de pagar y dejar de compartir
  const { tarjetas, transacciones, suscripciones, pagarMesTarjeta, dejarDeCompartir, mesActual } = useApp();
  // trae el usuario que está usando la app
  const { usuario } = useSesion();

  // busca la tarjeta que tiene este id
  const tarjeta = tarjetas.find((t) => t.id === id);
  // se queda solo con las compras de esta tarjeta
  const txTarjeta = transacciones.filter((tx) => tx.tarjetaId === id);

  // Solo las suscripciones con algo por pagar: al pagar el mes desaparecen y vuelven el mes siguiente
  const subsTarjeta = suscripciones.filter((s) => s.tarjetaId === id && !s.pagadaEsteMes);
  // Lo que se debe de ellas (con meses atrasados puede ser más de una mensualidad)
  const totalSubs = subsTarjeta.reduce((acc, s) => acc + s.montoPorPagar, 0);
  // dice si alguna suscripción tiene más de un mes sin pagar
  const subsAtrasadas = subsTarjeta.some((s) => s.mesesPorPagar > 1);

  // si no encontro la tarjeta (por ejemplo se recargo la app y se borro todo) muestra un aviso
  if (!tarjeta) {
    // muestra la pantalla del aviso
    return (
      // caja blanca que ocupa toda la pantalla, con todo centrado
      <View className="flex-1 bg-white items-center justify-center p-6">
        {/* texto gris que dice que no se encontró la tarjeta */}
        <Text className="text-slate-600 text-base mb-4">Tarjeta no encontrada.</Text>
        {/* boton para volver a la lista */}
        <TouchableOpacity
          // al tocarlo, vuelve a la lista de tarjetas
          onPress={() => router.replace(RUTAS.tarjetas)}
          // botón verde con esquinas redondeadas
          className="px-5 py-2.5 bg-color-action rounded-xl">
          {/* texto blanco en negrita del botón */}
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
      // avisa que el mes ya está pagado
      avisar('Mes ya pagado', 'Ya registraste el pago de este mes en esta tarjeta. Podrás volver a pagar el próximo mes.');
      // no sigue
      return;
    }

    // Nada por pagar este mes (ni cuotas ni suscripciones)
    if (tarjeta.montoNumerico === 0) {
      // avisa que la tarjeta está al día
      avisar('Al día', 'Esta tarjeta no tiene pagos pendientes este mes.');
      // no sigue
      return;
    }

    // `montoNumerico` incluye cuotas + suscripciones pendientes de todos, atrasadas incluidas
    const montoMes = formatearCLP(tarjeta.montoNumerico);
    // arma el texto que avisa de los meses atrasados
    const atraso =
      // si hay meses sin pagar
      tarjeta.mesesAtrasados > 0
        // dice cuánto se debe de atraso y de cuántos meses
        ? `Incluye ${formatearCLP(tarjeta.montoAtrasado)} de ${tarjeta.mesesAtrasados} ${
            tarjeta.mesesAtrasados === 1 ? 'mes atrasado' : 'meses atrasados'
          }. `
        // si no hay atraso, no agrega nada
        : '';

    // muestra una ventana para confirmar el pago
    confirmar({
      // título de la ventana
      titulo: 'Registrar pago del mes',
      // mensaje que explica qué pasará al pagar
      mensaje:
        // dice cuánto se va a pagar
        `Se registrará el pago de ${montoMes}. ` +
        // si es compartida, dice quiénes la verán pagada
        (compartida ? `La tarjeta es compartida: ${nombresCompartidos(tarjeta.compartidaCon)} también la verá pagada. ` : '') +
        // agrega el aviso de atraso (si hay)
        atraso +
        // explica que las cuotas avanzan
        `Cada compra avanzará las cuotas pagadas (las que lleguen a su última cuota saldrán del resumen) ` +
        // explica qué pasa con las suscripciones y el cupo
        `y las suscripciones quedarán pagadas este mes y volverán a cobrarse el próximo. Ese monto se liberará de tu cupo disponible.`,
      // texto del botón para confirmar
      textoConfirmar: 'Confirmar pago',
      // lo que pasa al confirmar
      onConfirmar: async () => {
        // le pide al servidor registrar el pago y espera la respuesta
        const { resultado } = await pagarMesTarjeta(tarjeta.id);
        // si salió bien, avisa que se pagó
        if (resultado === 'ok') avisar('Pago registrado', `Pagaste ${montoMes}. Tu cupo disponible aumentó.`);
        // si no hay internet, lo avisa
        else if (resultado === 'sin_conexion') avisarSinConexion();
      },
    });
  };

  /** Una tarjeta que compartieron conmigo: dejar de verla (lo registrado en ella se queda). */
  const handleDejarDeVer = () => {
    // muestra una ventana para confirmar
    confirmar({
      // título de la ventana
      titulo: 'Dejar de ver esta tarjeta',
      // mensaje que explica qué pasará
      mensaje:
        // dice de quién es la tarjeta y que lo registrado se queda
        `${tarjeta.banco} es de ${tarjeta.duenoNombre}. Dejarás de verla, pero lo que registraste en ella se queda en su estado de cuenta.`,
      // texto del botón para confirmar
      textoConfirmar: 'Dejar de verla',
      // el botón se muestra en rojo porque es una acción delicada
      destructivo: true,
      // lo que pasa al confirmar
      onConfirmar: async () => {
        // si no hay usuario, no hace nada
        if (!usuario) return;
        // le pide al servidor dejar de compartir y espera la respuesta
        const { resultado } = await dejarDeCompartir(tarjeta.id, usuario.uid);
        // si salió bien, vuelve a la lista de tarjetas
        if (resultado === 'ok') return router.replace(RUTAS.tarjetas);
        // si no hay internet, lo avisa
        if (resultado === 'sin_conexion') return avisarSinConexion();
        // si falló por otra razón, muestra un error
        avisar('Error', 'No se pudo dejar de ver la tarjeta.');
      },
    });
  };

  // muestra la pantalla del detalle
  return (
    // marco de pantalla con el título "Detalle Tarjeta" y botón para volver atrás
    <PantallaFormulario titulo="Detalle Tarjeta" onVolver={() => router.back()}>
      {/* Barra de navegación de Android oscura con botones claros (en iOS y web no hace nada) */}
      <NavigationBar style="dark" />
      {/* zona que se puede deslizar, con márgenes a los lados y arriba */}
      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {/* Tarjeta superior con datos dinámicos */}
        <CardItem item={tarjeta} />

        {/* Meses anteriores sin pagar: se acumulan en el total */}
        {/* si hay meses atrasados, muestra una caja roja clarita con borde */}
        {tarjeta.mesesAtrasados > 0 && (
          <View className="flex-row p-4 mb-4 bg-red-50 border border-red-100 rounded-2xl">
            {/* cuadrito rojo claro con esquinas redondeadas para el ícono */}
            <View className="w-9 h-9 rounded-xl bg-red-100 items-center justify-center mr-3">
              {/* ícono rojo de alerta */}
              <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
            </View>
            {/* lado derecho con los textos del aviso */}
            <View className="flex-1">
              {/* texto rojo oscuro en negrita con el título del aviso */}
              <Text className="text-red-900 text-xs font-inter-bold mb-0.5">
                {/* dice cuántos meses hay sin pagar */}
                {tarjeta.mesesAtrasados} {tarjeta.mesesAtrasados === 1 ? 'mes' : 'meses'} sin pagar
              </Text>
              {/* texto rojo oscuro con cuánto se debe de atraso */}
              <Text className="text-red-900 text-xs font-inter-regular">
                El total incluye <Text className="font-inter-bold">{formatearCLP(tarjeta.montoAtrasado)}</Text> atrasados.
                Al registrar el pago se cubre todo lo acumulado.
              </Text>
            </View>
          </View>
        )}

        {/* Tarjeta compartida: todos ven las mismas compras, el mismo cupo y el mismo pago */}
        {/* si está compartida, muestra una caja azul clarita con borde */}
        {compartida && (
          <View className="flex-row p-4 mb-4 bg-blue-50 border border-blue-100 rounded-2xl">
            {/* cuadrito azul claro con esquinas redondeadas para el ícono */}
            <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center mr-3">
              {/* ícono azul de personas */}
              <Ionicons name="people-outline" size={18} color="#1D4ED8" />
            </View>
            {/* lado derecho con los textos del aviso */}
            <View className="flex-1">
              {/* texto azul oscuro en negrita */}
              <Text className="text-blue-900 text-xs font-inter-bold mb-0.5">
                {/* dice con quiénes se comparte la tarjeta */}
                Cuenta compartida con {nombresCompartidos(tarjeta.compartidaCon)}
              </Text>
              {/* texto azul oscuro que explica cómo funciona compartir */}
              <Text className="text-blue-900 text-xs font-inter-regular">
                {/* dice si la tarjeta es tuya o de quién es */}
                {tarjeta.propia ? 'Es tuya. ' : `Es de ${tarjeta.duenoNombre}. `}
                {/* explica que todos ven los gastos y el mismo cupo */}
                Los gastos que registre cualquiera aparecen para todos, y el cupo disponible (
                {/* el cupo disponible en negrita */}
                <Text className="font-inter-bold">{formatearCLP(tarjeta.cupoDisponible)}</Text>) es el mismo.
              </Text>
            </View>
          </View>
        )}

        {/* Cargos y Compras en Cuotas */}
        <View className="mt-2 mb-6">
          {/* título negro en negrita de la sección */}
          <Text className="text-slate-900 text-base font-inter-bold mb-3">
            Cargos y Compras en Cuotas
          </Text>

          {/* si no hay compras, muestra una caja con borde punteado y un aviso */}
          {txTarjeta.length === 0 ? (
            <View className="p-4 rounded-2xl border border-dashed border-slate-200 items-center justify-center">
              {/* texto gris chico del aviso */}
              <Text className="text-slate-400 text-xs">Sin pagos pendientes para este mes</Text>
            </View>
          ) : (
            // si hay compras, muestra una fila por cada una
            txTarjeta.map((tx) => (
              // Al tocar una compra se abre para editarla o eliminarla
              <TouchableOpacity
                // identifica cada fila con el id de la compra
                key={tx.id}
                // lo que pasa al tocar la compra
                onPress={() =>
                  // si se puede editar
                  tx.editable
                    // abre la pantalla para editar la compra
                    ? router.push(RUTAS.editarCompra(tx.id))
                    // si no, avisa que solo el autor o el dueño pueden editarla
                    : avisar('Compra de otra persona', `Solo ${tx.autor} o el dueño de la tarjeta pueden editarla.`)
                }
                // se pone un poco transparente al tocarla
                activeOpacity={0.85}
                // caja blanca con esquinas redondeadas, borde gris y sombra suave
                className="p-4 bg-white rounded-2xl border border-slate-100 flex-row justify-between items-center shadow-sm mb-3"
              >
                {/* lado izquierdo con los datos de la compra */}
                <View className="flex-1 pr-3">
                  {/* el motivo de la compra en negro y negrita */}
                  <Text className="text-slate-900 text-base font-inter-bold">{tx.motivo}</Text>
                  {/* En una tarjeta compartida: quién la registró */}
                  {tx.autor && (
                    <Text className="text-blue-600 text-[11px] font-inter-medium">Registrada por {tx.autor}</Text>
                  )}
                  {/* texto gris con las cuotas que toca pagar y el total */}
                  <Text className="text-slate-400 text-xs font-inter-medium">
                    {/* si se pagan varias cuotas, dice desde cuál hasta cuál */}
                    {tx.cuotasPorPagar > 1
                      ? `Cuotas ${tx.cuotaActual} a ${tx.cuotaActual + tx.cuotasPorPagar - 1}`
                      // si es una sola, dice cuál es
                      : `Cuota ${tx.cuotaActual}`}{' '}
                    {/* dice de cuántas cuotas en total y el monto total */}
                    de {tx.totalCuotas} (Total: {formatearCLP(tx.montoTotal)})
                  </Text>
                  {/* Cuotas de meses anteriores que no se pagaron */}
                  {tx.cuotasAtrasadas > 0 && (
                    <Text className="text-red-600 text-[11px] font-inter-medium mt-0.5">
                      {/* dice cuántas cuotas están atrasadas y desde qué mes */}
                      {tx.cuotasAtrasadas} {tx.cuotasAtrasadas === 1 ? 'cuota atrasada' : 'cuotas atrasadas'} desde{' '}
                      {/* el nombre del mes desde que está atrasada */}
                      {nombreMesDeClave(tx.mesCobro)}
                    </Text>
                  )}
                  {/* La cuota no se cobra este mes: compra hecha después del corte, o mes ya pagado */}
                  {tx.mesCobro > mesActual && (
                    <Text className="text-amber-600 text-[11px] font-inter-medium mt-0.5">
                      {/* dice desde qué mes o en qué mes se cobra */}
                      {tx.mesInicio > mesActual ? 'Se cobra desde' : 'Se cobra en'} {nombreMesDeClave(tx.mesCobro)}
                    </Text>
                  )}
                </View>
                {/* Lo que se debe de esta compra; si todavía no se cobra, la cuota que viene.
                    La última cuota puede valer distinto: absorbe el redondeo */}
                <Text className="text-slate-900 text-base font-inter-bold">
                  {/* el monto escrito en pesos */}
                  {formatearCLP(tx.cuotasPorPagar > 0 ? tx.montoPorPagar : tx.montoCuotaActual)}
                </Text>
                {/* si se puede editar, muestra una flechita gris a la derecha */}
                {tx.editable && <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 6 }} />}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Suscripciones asociadas a esta tarjeta */}
        <View className="mb-6">
          {/* fila con el título a la izquierda y el total a la derecha */}
          <View className="flex-row items-center justify-between mb-3">
            {/* título negro en negrita "Suscripciones" */}
            <Text className="text-slate-900 text-base font-inter-bold">Suscripciones</Text>
            {/* si hay suscripciones, muestra una etiqueta blanca redondeada con el total */}
            {subsTarjeta.length > 0 && (
              <View className="flex-row items-baseline px-3 py-1.5 bg-white rounded-full border border-slate-100">
                {/* el total de las suscripciones en negrita */}
                <Text className="text-slate-900 text-xs font-inter-bold">{formatearCLP(totalSubs)}</Text>
                {/* texto gris chiquito al lado del total */}
                <Text className="text-slate-400 text-[10px] font-inter-regular">
                  {/* dice "por pagar" si hay atraso, o "/mes" si no */}
                  {subsAtrasadas ? ' por pagar' : ' /mes'}
                </Text>
              </View>
            )}
          </View>

          {/* si no hay suscripciones, muestra una caja con borde punteado y un aviso */}
          {subsTarjeta.length === 0 ? (
            <View className="p-4 rounded-2xl border border-dashed border-slate-200 items-center justify-center">
              {/* texto gris chico del aviso */}
              <Text className="text-slate-400 text-xs">Sin suscripciones pendientes este mes</Text>
            </View>
          ) : (
            // si hay, muestra una fila por cada suscripción (sin repetir la tarjeta)
            subsTarjeta.map((s) => <SuscripcionFila key={s.id} item={s} ocultarTarjeta />)
          )}
        </View>

        {/* Botón: Registrar Pago del Mes */}
        <TouchableOpacity
          // al tocarlo, pide confirmar el pago del mes
          onPress={handleMarcarPagado}
          // se pone un poco transparente al tocarlo
          activeOpacity={0.8}
          // si ya se pagó el mes, el botón no se puede tocar
          disabled={tarjeta.pagadaEsteMes}
          // botón ancho redondeado: gris si ya se pagó, verde si no
          className={`w-full h-12 rounded-2xl items-center justify-center mb-3 shadow-sm ${
            tarjeta.pagadaEsteMes ? 'bg-slate-300' : 'bg-color-action'
          }`}
        >
          {/* texto blanco en negrita del botón */}
          <Text className="text-white text-base font-inter-bold">
            {/* dice "Mes pagado" o "Registrar Pago del Mes" */}
            {tarjeta.pagadaEsteMes ? 'Mes pagado' : 'Registrar Pago del Mes'}
          </Text>
        </TouchableOpacity>

        {/* si la tarjeta es tuya, muestra compartir y editar; si no, solo dejar de verla */}
        {tarjeta.propia ? (
          <>
            {/* Compartir con otra cuenta */}
            <TouchableOpacity
              // al tocarlo, abre la pantalla para compartir la tarjeta
              onPress={() => router.push(RUTAS.compartirTarjeta(tarjeta.id))}
              // se pone un poco transparente al tocarlo
              activeOpacity={0.8}
              // botón blanco ancho con borde gris y esquinas redondeadas
              className="w-full h-12 mb-3 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
            >
              {/* ícono oscuro de personas */}
              <Ionicons name="people-outline" size={20} color="#0F172A" />
              {/* texto negro en negrita del botón */}
              <Text className="text-slate-900 text-base font-inter-bold">
                {/* dice con quiénes está compartida, o "Compartir tarjeta" */}
                {compartida ? 'Compartida con ' + nombresCompartidos(tarjeta.compartidaCon) : 'Compartir tarjeta'}
              </Text>
            </TouchableOpacity>

            {/* Editar o eliminar la tarjeta */}
            <TouchableOpacity
              // al tocarlo, abre la pantalla para editar la tarjeta
              onPress={() => router.push(RUTAS.editarTarjeta(tarjeta.id))}
              // se pone un poco transparente al tocarlo
              activeOpacity={0.8}
              // botón blanco ancho con borde gris y esquinas redondeadas
              className="w-full h-12 mb-8 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
            >
              {/* ícono oscuro de lápiz */}
              <Ionicons name="create-outline" size={20} color="#0F172A" />
              {/* texto negro en negrita "Editar tarjeta" */}
              <Text className="text-slate-900 text-base font-inter-bold">Editar tarjeta</Text>
            </TouchableOpacity>
          </>
        ) : (
          // Tarjeta de otra persona: solo se puede dejar de ver
          <TouchableOpacity
            // al tocarlo, pide confirmar para dejar de ver la tarjeta
            onPress={handleDejarDeVer}
            // se pone un poco transparente al tocarlo
            activeOpacity={0.8}
            // botón blanco ancho con borde gris y esquinas redondeadas
            className="w-full h-12 mb-8 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
          >
            {/* ícono rojo de ojo tachado */}
            <Ionicons name="eye-off-outline" size={20} color="#DC2626" />
            {/* texto rojo en negrita del botón */}
            <Text className="text-red-600 text-base font-inter-bold">Dejar de ver esta tarjeta</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </PantallaFormulario>
  );
}
