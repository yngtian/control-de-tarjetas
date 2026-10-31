import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { formatearCLP } from '../constants/formato';
import { RUTAS } from '../constants/rutas';
import { SuscripcionItem } from '../context/AppContext';

const PALETA = ['#E50914', '#1DB954', '#113CCF', '#7C3AED', '#EA580C', '#0891B2', '#DB2777', '#15803D'];

// Mismo nombre -> mismo color, siempre
export const colorSuscripcion = (nombre: string) => {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) % PALETA.length;
  return PALETA[h];
};

interface Props {
  item: SuscripcionItem;
  mostrarCobro?: boolean;          // Vista de Suscripciones: muestra "Cobra 15 de Noviembre · En 5 días"
  ocultarTarjeta?: boolean;        // Detalle de tarjeta: ya se sabe cuál es, no se repite el banco
  onEliminar?: (s: SuscripcionItem) => void;
}

/** Línea de texto bajo el nombre; cambia según dónde se muestre la fila. */
function textoSecundario({ item, mostrarCobro, ocultarTarjeta }: Required<Pick<Props, 'item' | 'mostrarCobro' | 'ocultarTarjeta'>>) {
  const plan = item.plan || 'Mensual';
  // Meses anteriores sin pagar: lo importante es cuánto se debe, no la próxima fecha
  const atraso = `${item.mesesPorPagar} meses por pagar (${formatearCLP(item.montoPorPagar)})`;

  if (item.mesesPorPagar > 1 && (mostrarCobro || ocultarTarjeta)) {
    return mostrarCobro ? atraso : `${plan} · ${atraso}`;
  }
  if (mostrarCobro) {
    return item.pagadaEsteMes
      ? `Al día este mes · Cobra ${item.proximoCobro}`
      : `Cobra ${item.proximoCobro} · ${item.textoRestante}`;
  }
  if (ocultarTarjeta) return `${plan} · Cobra ${item.proximoCobro}`;
  return `${plan} · ${item.tarjetaBanco}`; // Home
}

export default function SuscripcionFila({
  item,
  mostrarCobro = false,
  ocultarTarjeta = false,
  onEliminar,
}: Props) {
  const router = useRouter();

  return (
    // Al tocar la fila se abre el detalle de la suscripción
    <TouchableOpacity
      onPress={() => router.push(RUTAS.detalleSuscripcion(item.id))}
      activeOpacity={0.85}
      className="p-4 bg-white rounded-2xl border border-slate-100 flex-row items-center shadow-sm mb-3"
    >
      {/* Avatar con inicial */}
      <View
        className="w-11 h-11 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: colorSuscripcion(item.nombre) }}
      >
        <Text className="text-white text-base font-inter-bold">
          {item.nombre.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Nombre y texto secundario */}
      <View className="flex-1 pr-2">
        <Text className="text-slate-900 text-base font-inter-bold" numberOfLines={1}>
          {item.nombre}
        </Text>
        {/* Hasta 2 líneas: cuándo se cobra es lo importante, no se debe cortar */}
        <Text className="text-slate-400 text-xs font-inter-regular" numberOfLines={2}>
          {textoSecundario({ item, mostrarCobro, ocultarTarjeta })}
        </Text>
        {/* Tarjeta asociada (vista de Suscripciones): bajo el cobro, así no le quita ancho */}
        {mostrarCobro && (
          <View className="flex-row items-center mt-1">
            <View className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: item.tarjetaColor }} />
            <Text className="flex-1 text-slate-400 text-[10px] font-inter-regular" numberOfLines={1}>
              {item.tarjetaBanco}
            </Text>
          </View>
        )}
      </View>

      {/* Precio */}
      <Text className="text-slate-900 text-base font-inter-bold">{formatearCLP(item.monto)}</Text>

      {/* En la lista de Suscripciones: eliminar; en las demás, la flecha que indica que se abre */}
      {onEliminar ? (
        <TouchableOpacity onPress={() => onEliminar(item)} className="ml-3 p-1" activeOpacity={0.6}>
          <Ionicons name="trash-outline" size={18} color="#94A3B8" />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 6 }} />
      )}
    </TouchableOpacity>
  );
}
