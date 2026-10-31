// trae los íconos que se usan en la pantalla
import { Ionicons } from '@expo/vector-icons';
// trae la función para moverse entre pantallas
import { useRouter } from 'expo-router';
// trae React y las funciones para recordar datos y reaccionar a cambios
import React, { useEffect, useState } from 'react';
// trae las piezas básicas: ruedita de carga, lista con scroll, texto, botón y caja
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
// trae el espacio que ocupa la parte de arriba del teléfono (hora, batería)
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// trae la conexión con el servidor
import { api } from '../api/cliente';
// trae la forma de los datos de la proyección
import type { MesProyectado, Proyeccion } from '../api/tipos';
// trae la barra de título de arriba con botón para volver
import EncabezadoPantalla from '../components/EncabezadoPantalla';
// trae el menú de abajo para cambiar de pantalla
import BottomNavigation from '../components/MenuNavegacion';
// trae el color que se usa si la tarjeta no tiene uno
import { COLOR_TARJETA_DEFAULT } from '../constants/banks';
// trae las funciones que escriben el nombre del mes
import { nombreMesConAnio, nombreMesDeClave } from '../constants/fechas';
// trae la función que escribe montos como "$12.345"
import { formatearCLP } from '../constants/formato';
// trae las direcciones de las pantallas de la app
import { RUTAS } from '../constants/rutas';
// trae los datos generales de la app (tarjetas, compras, suscripciones)
import { useApp } from '../context/AppContext';

// Cuántos meses se pueden proyectar
const HORIZONTES = [3, 6, 12];

// Alto máximo de una barra del gráfico (la del mes más caro)
const ALTO_BARRA = 140;

// datos que necesita el gráfico de barras
interface GraficoProps {
  // la lista de meses a dibujar
  meses: MesProyectado[];
  // el número del mes que está elegido
  seleccionado: number;
  // qué hacer cuando el usuario toca un mes
  onSeleccionar: (indice: number) => void;
}

/** Barras por mes: cuotas abajo (verde) y suscripciones arriba (morado). */
function GraficoMeses({ meses, seleccionado, onSeleccionar }: GraficoProps) {
  // Escala respecto al mes más caro (mínimo 1 para no dividir por cero)
  const maximo = Math.max(...meses.map((m) => m.total), 1);
  // Las barras con monto se ven aunque sean muy chicas
  const alto = (monto: number) => (monto > 0 ? Math.max((monto / maximo) * ALTO_BARRA, 3) : 0);

  // muestra el gráfico en la pantalla
  return (
    // caja blanca con esquinas muy redondeadas, borde gris y sombra suave
    <View className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm mb-6">
      {/* fila donde van las barras, pegadas abajo */}
      <View className="flex-row items-end" style={{ height: ALTO_BARRA }}>
        {/* dibuja una barra por cada mes */}
        {meses.map((m, i) => {
          // dice si este mes es el que está elegido
          const activo = i === seleccionado;
          // devuelve la barra de este mes
          return (
            // botón que ocupa la columna del mes
            <TouchableOpacity
              // identifica cada barra con su mes
              key={m.clave}
              // al tocar la barra, elige ese mes
              onPress={() => onSeleccionar(i)}
              // se pone un poco transparente al tocarla
              activeOpacity={0.7}
              // columna alta; si no está elegida se ve más clarita
              className={`flex-1 h-full justify-end items-center ${activo ? '' : 'opacity-40'}`}
            >
              {/* barra angosta con la punta de arriba redondeada */}
              <View className="w-[60%] max-w-[28px] rounded-t-md overflow-hidden">
                {/* parte morada de la barra: las suscripciones */}
                <View className="bg-indigo-400" style={{ height: alto(m.suscripciones) }} />
                {/* parte verde de la barra: las cuotas */}
                <View className="bg-color-action" style={{ height: alto(m.cuotas) }} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Línea base y nombres de los meses */}
      <View className="h-px bg-slate-200" />
      {/* fila con los nombres cortos de los meses */}
      <View className="flex-row mt-2">
        {/* escribe un nombre por cada mes */}
        {meses.map((m, i) => (
          // botón con el nombre del mes; al tocarlo elige ese mes
          <TouchableOpacity key={m.clave} onPress={() => onSeleccionar(i)} className="flex-1 items-center">
            {/* texto chiquito con el nombre del mes */}
            <Text
              // el mes elegido va en negro y negrita, los demás en gris
              className={`text-[10px] ${
                i === seleccionado ? 'text-slate-900 font-inter-bold' : 'text-slate-400 font-inter-medium'
              }`}
            >
              {/* las tres primeras letras del mes, ej: "Ene" */}
              {nombreMesDeClave(m.clave).slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leyenda */}
      <View className="flex-row gap-4 mt-4">
        {/* grupo del cuadrito verde con su nombre */}
        <View className="flex-row items-center gap-1.5">
          {/* cuadrito verde que representa las cuotas */}
          <View className="w-2.5 h-2.5 rounded-sm bg-color-action" />
          {/* texto gris que dice "Cuotas" */}
          <Text className="text-slate-500 text-xs font-inter-medium">Cuotas</Text>
        </View>
        {/* grupo del cuadrito morado con su nombre */}
        <View className="flex-row items-center gap-1.5">
          {/* cuadrito morado que representa las suscripciones */}
          <View className="w-2.5 h-2.5 rounded-sm bg-indigo-400" />
          {/* texto gris que dice "Suscripciones" */}
          <Text className="text-slate-500 text-xs font-inter-medium">Suscripciones</Text>
        </View>
      </View>
    </View>
  );
}

// datos que necesita la parte de abajo de la pantalla
interface ContenidoProps {
  // los cálculos de lo que se pagará los próximos meses
  proyeccion: Proyeccion;
  tarjetasPagadas: number; // Tarjetas con el mes actual ya pagado
}

/** Resumen, gráfico y detalle del mes elegido. */
function ContenidoProyeccion({ proyeccion, tarjetasPagadas }: ContenidoProps) {
  // saca la lista de meses y el mes de la última cuota
  const { meses, ultimoMesConCuotas } = proyeccion;
  // recuerda qué mes eligió el usuario (parte con el primero)
  const [seleccionado, setSeleccionado] = useState(0);
  // Al achicar el horizonte el mes elegido puede quedar fuera
  const indice = Math.min(seleccionado, meses.length - 1);
  // los datos del mes elegido
  const mes = meses[indice];
  // suma lo que se pagará en todos los meses mostrados
  const totalHorizonte = meses.reduce((acc, m) => acc + m.total, 0);

  // muestra el resumen, el gráfico y el detalle
  return (
    // agrupa todo sin agregar una caja extra
    <>
      {/* Resumen del horizonte */}
      <View className="w-full p-6 relative bg-color-menu rounded-3xl overflow-hidden shadow-lg mb-5">
        {/* círculo blanco casi transparente de adorno en la esquina */}
        <View className="w-40 h-40 -right-10 -top-10 absolute bg-white/5 rounded-full" />

        {/* grupo con el título y el monto total */}
        <View className="gap-1 z-10">
          {/* texto gris claro con el título del total */}
          <Text className="text-color-inactive text-sm font-inter-regular tracking-tight">
            {/* dice cuántos meses se están sumando */}
            Total a pagar en {meses.length} meses
          </Text>
          {/* texto blanco muy grande con el monto total */}
          <Text className="text-white text-4xl font-inter-bold tracking-tight">
            {/* el total escrito en pesos */}
            {formatearCLP(totalHorizonte)}
          </Text>
        </View>

        {/* fila de etiquetas pequeñas debajo del total */}
        <View className="flex-row flex-wrap gap-2 mt-3 z-10">
          {/* etiqueta redondeada con borde blanco suave */}
          <View className="px-4 py-1.5 rounded-full border border-white/10">
            {/* texto gris claro pequeño */}
            <Text className="text-slate-300 text-xs font-inter-medium">
              {/* cuánto se paga en promedio cada mes */}
              {formatearCLP(Math.round(totalHorizonte / meses.length))} promedio al mes
            </Text>
          </View>
          {/* otra etiqueta redondeada con borde blanco suave */}
          <View className="px-4 py-1.5 rounded-full border border-white/10">
            {/* texto gris claro pequeño */}
            <Text className="text-slate-300 text-xs font-inter-medium">
              {/* si hay cuotas, dice en qué mes termina la última */}
              {ultimoMesConCuotas
                ? `Última cuota en ${nombreMesConAnio(ultimoMesConCuotas)}`
                // si no hay cuotas, lo avisa
                : 'Sin compras en cuotas'}
            </Text>
          </View>
        </View>
      </View>

      {/* el gráfico de barras con un mes elegido */}
      <GraficoMeses meses={meses} seleccionado={indice} onSeleccionar={setSeleccionado} />

      {/* Detalle del mes elegido */}
      <View className="flex-row items-baseline justify-between mb-1">
        {/* texto negro en negrita con el nombre del mes */}
        <Text className="text-slate-900 text-base font-inter-bold">
          {/* dice "Este mes" o el nombre del mes elegido */}
          {indice === 0 ? 'Este mes' : nombreMesConAnio(mes.clave)}
        </Text>
        {/* el total de ese mes, grande y en negrita */}
        <Text className="text-slate-900 text-lg font-inter-bold">{formatearCLP(mes.total)}</Text>
      </View>
      {/* texto gris pequeño con el desglose: cuotas, suscripciones y deuda restante */}
      <Text className="text-slate-400 text-xs font-inter-regular mb-4">
        Cuotas {formatearCLP(mes.cuotas)} · Suscripciones {formatearCLP(mes.suscripciones)} · Deuda
        restante {formatearCLP(mes.deudaRestante)}
      </Text>

      {/* En el mes actual solo cuenta lo que falta pagar */}
      {/* si es este mes y hay tarjetas pagadas, muestra un aviso verde claro con borde */}
      {indice === 0 && tarjetasPagadas > 0 && (
        <View className="flex-row items-center p-3 mb-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
          {/* ícono verde de visto bueno */}
          <Ionicons name="checkmark-circle-outline" size={18} color="#047857" />
          {/* texto verde oscuro pequeño del aviso */}
          <Text className="flex-1 ml-2 text-emerald-800 text-xs font-inter-regular">
            {/* si es una sola tarjeta lo dice en singular */}
            {tarjetasPagadas === 1
              ? '1 tarjeta ya está pagada este mes y no suma aquí.'
              // si son varias, dice cuántas
              : `${tarjetasPagadas} tarjetas ya están pagadas este mes y no suman aquí.`}
          </Text>
        </View>
      )}

      {/* si el mes no tiene cobros, muestra una caja con borde punteado y un aviso */}
      {mes.tarjetas.length === 0 ? (
        <View className="p-6 rounded-2xl border border-dashed border-slate-300 items-center justify-center">
          {/* texto gris centrado del aviso */}
          <Text className="text-slate-400 text-sm font-inter-medium text-center">
            No hay cobros proyectados para este mes.
          </Text>
        </View>
      ) : (
        // si hay cobros, muestra una caja por cada tarjeta
        mes.tarjetas.map((t) => (
          // caja blanca con esquinas redondeadas, borde gris y sombra suave
          <View key={t.tarjetaId} className="p-4 mb-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
            {/* Tarjeta y su total del mes */}
            <View className="flex-row items-center mb-2">
              {/* puntito redondo con el color de la tarjeta */}
              <View
                // círculo chico con espacio a la derecha
                className="w-3 h-3 rounded-full mr-2"
                // usa el color de la tarjeta, o uno por defecto
                style={{ backgroundColor: t.colorHex || COLOR_TARJETA_DEFAULT }}
              />
              {/* nombre del banco en negrita, en una sola línea */}
              <Text className="flex-1 text-slate-900 text-sm font-inter-bold" numberOfLines={1}>
                {/* el nombre del banco de la tarjeta */}
                {t.banco}
              </Text>
              {/* lo que se paga de esta tarjeta ese mes */}
              <Text className="text-slate-900 text-sm font-inter-bold">{formatearCLP(t.total)}</Text>
            </View>

            {/* Cobros de esa tarjeta */}
            {t.cobros.map((c) => (
              // fila de un cobro con una línea gris finita arriba
              <View key={c.id} className="flex-row items-center justify-between py-2 border-t border-slate-50">
                {/* lado izquierdo con el nombre y el detalle */}
                <View className="flex-1 pr-3">
                  {/* nombre del cobro en gris oscuro, en una sola línea */}
                  <Text className="text-slate-700 text-sm font-inter-medium" numberOfLines={1}>
                    {/* el nombre de la compra o suscripción */}
                    {c.nombre}
                  </Text>
                  {/* texto gris chiquito con el detalle del cobro */}
                  <Text className="text-slate-400 text-[11px] font-inter-regular">
                    {/* si es suscripción lo dice; si no, muestra el detalle de la cuota */}
                    {c.tipo === 'suscripcion' ? `Suscripción · ${c.detalle}` : c.detalle}
                    {/* si es la última cuota, lo dice en verde */}
                    {c.ultimaCuota && <Text className="text-emerald-600 font-inter-medium"> · Última cuota</Text>}
                          {/* si tiene meses sin pagar, lo avisa en rojo */}
                          {c.atrasado && <Text className="text-red-600 font-inter-medium"> · Incluye meses atrasados</Text>}
                  </Text>
                </View>
                {/* el monto del cobro a la derecha */}
                <Text className="text-slate-700 text-sm font-inter-medium">{formatearCLP(c.monto)}</Text>
              </View>
            ))}
          </View>
        ))
      )}
    </>
  );
}

// la pantalla de Proyecciones: cuánto se pagará los próximos meses
export default function ProyeccionesScreen() {
  // mide el espacio de arriba del teléfono para no tapar la hora
  const insets = useSafeAreaInsets();
  // sirve para ir a otras pantallas
  const router = useRouter();
  // trae las tarjetas, compras y suscripciones del usuario
  const { tarjetas, transacciones, suscripciones } = useApp();

  // cuántos meses se muestran (parte con 6)
  const [horizonte, setHorizonte] = useState(6);
  // guarda los cálculos que manda el servidor (al inicio no hay nada)
  const [proyeccion, setProyeccion] = useState<Proyeccion | null>(null);
  // recuerda si hubo un error al traer los datos
  const [errorCarga, setErrorCarga] = useState(false);
  const [intento, setIntento] = useState(0); // Sube con "Reintentar" para volver a pedirla

  // La proyección la calcula el backend. Se pide de nuevo al cambiar el horizonte
  // o cuando cambian los datos (ej: al pagar un mes o registrar una compra).
  useEffect(() => {
    let vigente = true; // Ignora respuestas que llegan tarde si ya se pidió otra
    // usa la conexión con el servidor
    api
      // pide los cálculos para la cantidad de meses elegida
      .proyecciones(horizonte)
      // cuando llega la respuesta
      .then((p) => {
        // si ya se pidió otra cosa, ignora esta respuesta
        if (!vigente) return;
        // guarda los cálculos para mostrarlos
        setProyeccion(p);
        // borra el error si había uno
        setErrorCarga(false);
      })
      // si algo falló al pedir los datos
      .catch(() => {
        // marca que hubo error, para mostrar el botón de reintentar
        if (vigente) setErrorCarga(true);
      });
    // al salir o al volver a pedir, la respuesta vieja ya no sirve
    return () => {
      // marca la respuesta anterior como vieja
      vigente = false;
    };
  // se vuelve a pedir cuando cambia alguno de estos datos
  }, [horizonte, tarjetas, transacciones, suscripciones, intento]);

  // cuenta cuántas tarjetas ya están pagadas este mes
  const tarjetasPagadas = tarjetas.filter((t) => t.pagadaEsteMes).length;

  // muestra la pantalla
  return (
    // caja que ocupa toda la pantalla con el fondo de la app
    <View className="flex-1 bg-bg-color" style={{ paddingTop: insets.top }}>
      {/* título "Proyecciones" arriba con botón para volver al inicio */}
      <EncabezadoPantalla titulo="Proyecciones" onVolver={() => router.replace(RUTAS.inicio)} />

      {/* zona que se puede deslizar hacia abajo, con márgenes a los lados */}
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* si no hay tarjetas, muestra una caja con borde punteado y un aviso */}
        {tarjetas.length === 0 ? (
          // Sin tarjetas no hay nada que proyectar
          <View className="p-6 mt-4 rounded-2xl border border-dashed border-slate-300 items-center">
            {/* ícono gris de gráfico que sube */}
            <Ionicons name="trending-up-outline" size={32} color="#94A3B8" />
            {/* texto gris centrado que explica qué hacer */}
            <Text className="text-slate-500 text-sm font-inter-medium text-center mt-3 mb-4">
              Agrega una tarjeta y registra tus compras para ver cuánto pagarás los próximos meses.
            </Text>
            {/* botón verde para agregar una tarjeta */}
            <TouchableOpacity
              // al tocarlo, abre la pantalla para registrar una tarjeta
              onPress={() => router.push(RUTAS.registrarTarjeta)}
              // botón verde con esquinas redondeadas
              className="px-5 py-2.5 bg-color-action rounded-xl"
            >
              {/* texto blanco en negrita del botón */}
              <Text className="text-white font-inter-bold">Agregar tarjeta</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // si hay tarjetas, agrupa el selector y los resultados
          <>
            {/* Selector de horizonte */}
            <View className="flex-row p-1 bg-slate-100 rounded-2xl mb-5">
              {/* un botón por cada opción: 3, 6 o 12 meses */}
              {HORIZONTES.map((h) => (
                // botón de una opción de meses
                <TouchableOpacity
                  // identifica cada botón con su número de meses
                  key={h}
                  // al tocarlo, cambia la cantidad de meses a mostrar
                  onPress={() => setHorizonte(h)}
                  // el elegido se ve blanco con sombra; los demás grises
                  className={`flex-1 py-2 rounded-xl items-center ${horizonte === h ? 'bg-white shadow-sm' : 'bg-slate-100 shadow-none'}`}
                >
                  {/* texto del botón */}
                  <Text
                    // el elegido en negro y negrita, los demás en gris
                    className={`text-sm ${
                      horizonte === h ? 'text-slate-900 font-inter-bold' : 'text-slate-500 font-inter-medium'
                    }`}
                  >
                    {/* dice la cantidad, ej: "6 meses" */}
                    {h} meses
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* si llegaron los datos los muestra; si hubo error, avisa; si no, muestra la ruedita de carga */}
            {proyeccion ? (
              <ContenidoProyeccion proyeccion={proyeccion} tarjetasPagadas={tarjetasPagadas} />
            ) : errorCarga ? (
              // caja con borde punteado que avisa del error
              <View className="p-6 rounded-2xl border border-dashed border-slate-300 items-center">
                {/* texto gris centrado del error */}
                <Text className="text-slate-500 text-sm font-inter-medium text-center mb-4">
                  No se pudieron cargar las proyecciones.
                </Text>
                {/* botón verde para volver a intentar traer los datos */}
                <TouchableOpacity onPress={() => setIntento((n) => n + 1)} className="px-5 py-2.5 bg-color-action rounded-xl">
                  {/* texto blanco en negrita que dice "Reintentar" */}
                  <Text className="text-white font-inter-bold">Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // ruedita verde que gira mientras se cargan los datos
              <ActivityIndicator className="mt-10" size="large" color="#10B981" />
            )}
          </>
        )}

        {/* espacio vacío al final para que no quede pegado abajo */}
        <View className="h-6" />
      </ScrollView>

      {/* menú de abajo para cambiar de pantalla */}
      <BottomNavigation />
    </View>
  );
}
