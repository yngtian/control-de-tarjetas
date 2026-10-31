import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import PantallaFormulario from '../../components/PantallaFormulario';
import { colorSuscripcion } from '../../components/SuscripcionFila';
import { avisarSinConexion, confirmar } from '../../constants/alertas';
import { nombreMesConAnio } from '../../constants/fechas';
import { formatearCLP } from '../../constants/formato';
import { RUTAS } from '../../constants/rutas';
import { SuscripcionItem, useApp } from '../../context/AppContext';

/** Una fila "etiqueta · valor" de la ficha. */
function Fila({ etiqueta, children, ultima = false }: { etiqueta: string; children: ReactNode; ultima?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between py-3 ${ultima ? '' : 'border-b border-slate-100'}`}>
      <Text className="text-slate-400 text-sm font-inter-medium">{etiqueta}</Text>
      <View className="flex-1 items-end pl-4">{children}</View>
    </View>
  );
}

/** Cómo va el pago: al día, por pagar este mes o con meses atrasados. */
function estadoDePago(s: SuscripcionItem) {
  if (s.mesesPorPagar === 0) {
    return { texto: 'Al día', detalle: `Próximo cobro el ${s.proximoCobro}`, fondo: 'bg-emerald-50', color: 'text-emerald-700' };
  }
  if (s.mesesPorPagar === 1) {
    return {
      texto: 'Por pagar este mes',
      detalle: `${formatearCLP(s.montoPorPagar)} · ${s.textoRestante.toLowerCase()}`,
      fondo: 'bg-amber-50',
      color: 'text-amber-700',
    };
  }
  return {
    texto: `${s.mesesPorPagar} meses por pagar`,
    detalle: `${formatearCLP(s.montoPorPagar)} acumulados`,
    fondo: 'bg-red-50',
    color: 'text-red-700',
  };
}

export default function DetalleSuscripcionScreen() {
  // saca el id que viene en la ruta, ej: /detalle-suscripcion/1727630000000
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { suscripciones, tarjetas, eliminarSuscripcion } = useApp();
  const suscripcion = suscripciones.find((s) => s.id === id);

  // si no la encontro (por ejemplo se acaba de eliminar) muestra un aviso
  if (!suscripcion) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-6">
        <Text className="text-slate-600 text-base mb-4">Suscripción no encontrada.</Text>
        <TouchableOpacity
          onPress={() => router.replace(RUTAS.suscripciones)}
          className="px-5 py-2.5 bg-color-action rounded-xl">
          <Text className="text-white font-inter-bold">Volver a Suscripciones</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s = suscripcion;
  const estado = estadoDePago(s);
  const tarjeta = tarjetas.find((t) => t.id === s.tarjetaId);

  const confirmarEliminar = () => {
    confirmar({
      titulo: 'Eliminar suscripción',
      mensaje: `¿Quieres eliminar ${s.nombre}? Dejará de sumarse a tu gasto mensual.`,
      textoConfirmar: 'Eliminar',
      destructivo: true,
      onConfirmar: async () => {
        const { resultado } = await eliminarSuscripcion(s.id);
        if (resultado === 'sin_conexion') return avisarSinConexion();
        router.back();
      },
    });
  };

  return (
    <PantallaFormulario titulo="Detalle Suscripción" onVolver={() => router.back()}>
      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {/* Resumen: servicio, plan y precio */}
        <View className="w-full p-6 relative bg-color-menu rounded-3xl overflow-hidden shadow-lg mb-5">
          <View className="w-40 h-40 -right-10 -top-10 absolute bg-white/5 rounded-full" />

          <View className="flex-row items-center z-10">
            <View
              className="w-12 h-12 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: colorSuscripcion(s.nombre) }}
            >
              <Text className="text-white text-lg font-inter-bold">{s.nombre.charAt(0).toUpperCase()}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-lg font-inter-bold" numberOfLines={1}>{s.nombre}</Text>
              <Text className="text-color-inactive text-sm font-inter-regular" numberOfLines={1}>
                {s.plan || 'Plan mensual'}
              </Text>
            </View>
          </View>

          <View className="flex-row items-baseline mt-5 z-10">
            <Text className="text-white text-4xl font-inter-bold tracking-tight">{formatearCLP(s.monto)}</Text>
            <Text className="text-color-inactive text-sm font-inter-regular"> /mes</Text>
          </View>

          <View className="flex-row flex-wrap gap-2 mt-3 z-10">
            <View className="px-4 py-1.5 rounded-full border border-white/10">
              <Text className="text-slate-300 text-xs font-inter-medium">{formatearCLP(s.monto * 12)} al año</Text>
            </View>
            <View className="px-4 py-1.5 rounded-full border border-white/10">
              <Text className="text-slate-300 text-xs font-inter-medium">Se cobra el día {s.diaCobro}</Text>
            </View>
          </View>
        </View>

        {/* Estado del pago */}
        <View className={`flex-row items-center p-4 mb-5 rounded-2xl ${estado.fondo}`}>
          <Ionicons
            name={s.mesesPorPagar === 0 ? 'checkmark-circle-outline' : 'time-outline'}
            size={22}
            color={s.mesesPorPagar === 0 ? '#047857' : s.mesesPorPagar === 1 ? '#B45309' : '#B91C1C'}
          />
          <View className="flex-1 ml-3">
            <Text className={`text-sm font-inter-bold ${estado.color}`}>{estado.texto}</Text>
            <Text className={`text-xs font-inter-regular ${estado.color}`}>{estado.detalle}</Text>
          </View>
        </View>

        {/* Ficha */}
        <View className="px-4 bg-white rounded-2xl border border-slate-100 shadow-sm mb-5">
          <Fila etiqueta="Próximo cobro">
            <Text className="text-slate-900 text-sm font-inter-bold">{s.proximoCobro}</Text>
            <Text className="text-slate-400 text-xs font-inter-regular">{s.textoRestante}</Text>
          </Fila>
          <Fila etiqueta="Tarjeta">
            <View className="flex-row items-center">
              <View className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: s.tarjetaColor }} />
              <Text className="text-slate-900 text-sm font-inter-bold" numberOfLines={1}>{s.tarjetaBanco}</Text>
            </View>
          </Fila>
          {s.autor && (
            <Fila etiqueta="Agregada por">
              <Text className="text-slate-900 text-sm font-inter-bold">{s.autor}</Text>
            </Fila>
          )}
          <Fila etiqueta="Activa desde">
            <Text className="text-slate-900 text-sm font-inter-bold">
              {s.mesInicio ? nombreMesConAnio(s.mesInicio) : 'Sin registro'}
            </Text>
          </Fila>
          <Fila etiqueta="Gasto anual" ultima>
            <Text className="text-slate-900 text-sm font-inter-bold">{formatearCLP(s.monto * 12)}</Text>
          </Fila>
        </View>

        {/* Cómo se paga: junto con la tarjeta */}
        <Text className="text-slate-400 text-xs font-inter-regular mb-3">
          La suscripción se paga junto con {s.tarjetaBanco}, al registrar el pago del mes de esa tarjeta.
        </Text>

        {tarjeta && (
          <TouchableOpacity
            onPress={() => router.push(RUTAS.detalleTarjeta(tarjeta.id))}
            activeOpacity={0.8}
            className="w-full h-12 mb-3 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
          >
            <Ionicons name="card-outline" size={20} color="#0F172A" />
            <Text className="text-slate-900 text-base font-inter-bold">Ver tarjeta</Text>
          </TouchableOpacity>
        )}

        {s.editable && (
        <TouchableOpacity
          onPress={confirmarEliminar}
          activeOpacity={0.8}
          className="w-full h-12 mb-8 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
        >
          <Ionicons name="trash-outline" size={20} color="#DC2626" />
          <Text className="text-red-600 text-base font-inter-bold">Eliminar suscripción</Text>
        </TouchableOpacity>
        )}
      </ScrollView>
    </PantallaFormulario>
  );
}
