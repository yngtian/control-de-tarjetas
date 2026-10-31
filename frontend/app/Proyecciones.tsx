import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../api/cliente';
import type { MesProyectado, Proyeccion } from '../api/tipos';
import EncabezadoPantalla from '../components/EncabezadoPantalla';
import BottomNavigation from '../components/MenuNavegacion';
import { COLOR_TARJETA_DEFAULT } from '../constants/banks';
import { nombreMesConAnio, nombreMesDeClave } from '../constants/fechas';
import { formatearCLP } from '../constants/formato';
import { RUTAS } from '../constants/rutas';
import { useApp } from '../context/AppContext';

// Cuántos meses se pueden proyectar
const HORIZONTES = [3, 6, 12];

// Alto máximo de una barra del gráfico (la del mes más caro)
const ALTO_BARRA = 140;

interface GraficoProps {
  meses: MesProyectado[];
  seleccionado: number;
  onSeleccionar: (indice: number) => void;
}

/** Barras por mes: cuotas abajo (verde) y suscripciones arriba (morado). */
function GraficoMeses({ meses, seleccionado, onSeleccionar }: GraficoProps) {
  // Escala respecto al mes más caro (mínimo 1 para no dividir por cero)
  const maximo = Math.max(...meses.map((m) => m.total), 1);
  // Las barras con monto se ven aunque sean muy chicas
  const alto = (monto: number) => (monto > 0 ? Math.max((monto / maximo) * ALTO_BARRA, 3) : 0);

  return (
    <View className="p-4 bg-white rounded-3xl border border-slate-100 shadow-sm mb-6">
      <View className="flex-row items-end" style={{ height: ALTO_BARRA }}>
        {meses.map((m, i) => {
          const activo = i === seleccionado;
          return (
            <TouchableOpacity
              key={m.clave}
              onPress={() => onSeleccionar(i)}
              activeOpacity={0.7}
              className={`flex-1 h-full justify-end items-center ${activo ? '' : 'opacity-40'}`}
            >
              <View className="w-[60%] max-w-[28px] rounded-t-md overflow-hidden">
                <View className="bg-indigo-400" style={{ height: alto(m.suscripciones) }} />
                <View className="bg-color-action" style={{ height: alto(m.cuotas) }} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Línea base y nombres de los meses */}
      <View className="h-px bg-slate-200" />
      <View className="flex-row mt-2">
        {meses.map((m, i) => (
          <TouchableOpacity key={m.clave} onPress={() => onSeleccionar(i)} className="flex-1 items-center">
            <Text
              className={`text-[10px] ${
                i === seleccionado ? 'text-slate-900 font-inter-bold' : 'text-slate-400 font-inter-medium'
              }`}
            >
              {nombreMesDeClave(m.clave).slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leyenda */}
      <View className="flex-row gap-4 mt-4">
        <View className="flex-row items-center gap-1.5">
          <View className="w-2.5 h-2.5 rounded-sm bg-color-action" />
          <Text className="text-slate-500 text-xs font-inter-medium">Cuotas</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-2.5 h-2.5 rounded-sm bg-indigo-400" />
          <Text className="text-slate-500 text-xs font-inter-medium">Suscripciones</Text>
        </View>
      </View>
    </View>
  );
}

interface ContenidoProps {
  proyeccion: Proyeccion;
  tarjetasPagadas: number; // Tarjetas con el mes actual ya pagado
}

/** Resumen, gráfico y detalle del mes elegido. */
function ContenidoProyeccion({ proyeccion, tarjetasPagadas }: ContenidoProps) {
  const { meses, ultimoMesConCuotas } = proyeccion;
  const [seleccionado, setSeleccionado] = useState(0);
  // Al achicar el horizonte el mes elegido puede quedar fuera
  const indice = Math.min(seleccionado, meses.length - 1);
  const mes = meses[indice];
  const totalHorizonte = meses.reduce((acc, m) => acc + m.total, 0);

  return (
    <>
      {/* Resumen del horizonte */}
      <View className="w-full p-6 relative bg-color-menu rounded-3xl overflow-hidden shadow-lg mb-5">
        <View className="w-40 h-40 -right-10 -top-10 absolute bg-white/5 rounded-full" />

        <View className="gap-1 z-10">
          <Text className="text-color-inactive text-sm font-inter-regular tracking-tight">
            Total a pagar en {meses.length} meses
          </Text>
          <Text className="text-white text-4xl font-inter-bold tracking-tight">
            {formatearCLP(totalHorizonte)}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-2 mt-3 z-10">
          <View className="px-4 py-1.5 rounded-full border border-white/10">
            <Text className="text-slate-300 text-xs font-inter-medium">
              {formatearCLP(Math.round(totalHorizonte / meses.length))} promedio al mes
            </Text>
          </View>
          <View className="px-4 py-1.5 rounded-full border border-white/10">
            <Text className="text-slate-300 text-xs font-inter-medium">
              {ultimoMesConCuotas
                ? `Última cuota en ${nombreMesConAnio(ultimoMesConCuotas)}`
                : 'Sin compras en cuotas'}
            </Text>
          </View>
        </View>
      </View>

      <GraficoMeses meses={meses} seleccionado={indice} onSeleccionar={setSeleccionado} />

      {/* Detalle del mes elegido */}
      <View className="flex-row items-baseline justify-between mb-1">
        <Text className="text-slate-900 text-base font-inter-bold">
          {indice === 0 ? 'Este mes' : nombreMesConAnio(mes.clave)}
        </Text>
        <Text className="text-slate-900 text-lg font-inter-bold">{formatearCLP(mes.total)}</Text>
      </View>
      <Text className="text-slate-400 text-xs font-inter-regular mb-4">
        Cuotas {formatearCLP(mes.cuotas)} · Suscripciones {formatearCLP(mes.suscripciones)} · Deuda
        restante {formatearCLP(mes.deudaRestante)}
      </Text>

      {/* En el mes actual solo cuenta lo que falta pagar */}
      {indice === 0 && tarjetasPagadas > 0 && (
        <View className="flex-row items-center p-3 mb-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
          <Ionicons name="checkmark-circle-outline" size={18} color="#047857" />
          <Text className="flex-1 ml-2 text-emerald-800 text-xs font-inter-regular">
            {tarjetasPagadas === 1
              ? '1 tarjeta ya está pagada este mes y no suma aquí.'
              : `${tarjetasPagadas} tarjetas ya están pagadas este mes y no suman aquí.`}
          </Text>
        </View>
      )}

      {mes.tarjetas.length === 0 ? (
        <View className="p-6 rounded-2xl border border-dashed border-slate-300 items-center justify-center">
          <Text className="text-slate-400 text-sm font-inter-medium text-center">
            No hay cobros proyectados para este mes.
          </Text>
        </View>
      ) : (
        mes.tarjetas.map((t) => (
          <View key={t.tarjetaId} className="p-4 mb-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
            {/* Tarjeta y su total del mes */}
            <View className="flex-row items-center mb-2">
              <View
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: t.colorHex || COLOR_TARJETA_DEFAULT }}
              />
              <Text className="flex-1 text-slate-900 text-sm font-inter-bold" numberOfLines={1}>
                {t.banco}
              </Text>
              <Text className="text-slate-900 text-sm font-inter-bold">{formatearCLP(t.total)}</Text>
            </View>

            {/* Cobros de esa tarjeta */}
            {t.cobros.map((c) => (
              <View key={c.id} className="flex-row items-center justify-between py-2 border-t border-slate-50">
                <View className="flex-1 pr-3">
                  <Text className="text-slate-700 text-sm font-inter-medium" numberOfLines={1}>
                    {c.nombre}
                  </Text>
                  <Text className="text-slate-400 text-[11px] font-inter-regular">
                    {c.tipo === 'suscripcion' ? `Suscripción · ${c.detalle}` : c.detalle}
                    {c.ultimaCuota && <Text className="text-emerald-600 font-inter-medium"> · Última cuota</Text>}
                          {c.atrasado && <Text className="text-red-600 font-inter-medium"> · Incluye meses atrasados</Text>}
                  </Text>
                </View>
                <Text className="text-slate-700 text-sm font-inter-medium">{formatearCLP(c.monto)}</Text>
              </View>
            ))}
          </View>
        ))
      )}
    </>
  );
}

export default function ProyeccionesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tarjetas, transacciones, suscripciones } = useApp();

  const [horizonte, setHorizonte] = useState(6);
  const [proyeccion, setProyeccion] = useState<Proyeccion | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [intento, setIntento] = useState(0); // Sube con "Reintentar" para volver a pedirla

  // La proyección la calcula el backend. Se pide de nuevo al cambiar el horizonte
  // o cuando cambian los datos (ej: al pagar un mes o registrar una compra).
  useEffect(() => {
    let vigente = true; // Ignora respuestas que llegan tarde si ya se pidió otra
    api
      .proyecciones(horizonte)
      .then((p) => {
        if (!vigente) return;
        setProyeccion(p);
        setErrorCarga(false);
      })
      .catch(() => {
        if (vigente) setErrorCarga(true);
      });
    return () => {
      vigente = false;
    };
  }, [horizonte, tarjetas, transacciones, suscripciones, intento]);

  const tarjetasPagadas = tarjetas.filter((t) => t.pagadaEsteMes).length;

  return (
    <View className="flex-1 bg-bg-color" style={{ paddingTop: insets.top }}>
      <EncabezadoPantalla titulo="Proyecciones" onVolver={() => router.replace(RUTAS.inicio)} />

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {tarjetas.length === 0 ? (
          // Sin tarjetas no hay nada que proyectar
          <View className="p-6 mt-4 rounded-2xl border border-dashed border-slate-300 items-center">
            <Ionicons name="trending-up-outline" size={32} color="#94A3B8" />
            <Text className="text-slate-500 text-sm font-inter-medium text-center mt-3 mb-4">
              Agrega una tarjeta y registra tus compras para ver cuánto pagarás los próximos meses.
            </Text>
            <TouchableOpacity
              onPress={() => router.push(RUTAS.registrarTarjeta)}
              className="px-5 py-2.5 bg-color-action rounded-xl"
            >
              <Text className="text-white font-inter-bold">Agregar tarjeta</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Selector de horizonte */}
            <View className="flex-row p-1 bg-slate-100 rounded-2xl mb-5">
              {HORIZONTES.map((h) => (
                <TouchableOpacity
                  key={h}
                  onPress={() => setHorizonte(h)}
                  className={`flex-1 py-2 rounded-xl items-center ${horizonte === h ? 'bg-white shadow-sm' : 'bg-slate-100 shadow-none'}`}
                >
                  <Text
                    className={`text-sm ${
                      horizonte === h ? 'text-slate-900 font-inter-bold' : 'text-slate-500 font-inter-medium'
                    }`}
                  >
                    {h} meses
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {proyeccion ? (
              <ContenidoProyeccion proyeccion={proyeccion} tarjetasPagadas={tarjetasPagadas} />
            ) : errorCarga ? (
              <View className="p-6 rounded-2xl border border-dashed border-slate-300 items-center">
                <Text className="text-slate-500 text-sm font-inter-medium text-center mb-4">
                  No se pudieron cargar las proyecciones.
                </Text>
                <TouchableOpacity onPress={() => setIntento((n) => n + 1)} className="px-5 py-2.5 bg-color-action rounded-xl">
                  <Text className="text-white font-inter-bold">Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ActivityIndicator className="mt-10" size="large" color="#10B981" />
            )}
          </>
        )}

        <View className="h-6" />
      </ScrollView>

      <BottomNavigation />
    </View>
  );
}
