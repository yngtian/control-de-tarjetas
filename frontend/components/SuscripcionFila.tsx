// trae los iconos (basurero y flecha)
import { Ionicons } from '@expo/vector-icons';
// trae la herramienta para cambiar de pantalla
import { useRouter } from 'expo-router';
// trae React para poder armar la pantalla
import React from 'react';
// trae las piezas para textos, botones y cajas
import { Text, TouchableOpacity, View } from 'react-native';
// trae la función que escribe montos en pesos chilenos
import { formatearCLP } from '../constants/formato';
// trae las direcciones de cada pantalla
import { RUTAS } from '../constants/rutas';
// trae el tipo de dato de una suscripción
import { SuscripcionItem } from '../context/AppContext';

// lista de colores para los cuadraditos de las suscripciones
const PALETA = ['#E50914', '#1DB954', '#113CCF', '#7C3AED', '#EA580C', '#0891B2', '#DB2777', '#15803D'];

// Mismo nombre -> mismo color, siempre
export const colorSuscripcion = (nombre: string) => {
  // número que se arma a partir de las letras del nombre
  let h = 0;
  // recorre cada letra y va calculando qué color le toca
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) % PALETA.length;
  // devuelve el color que le tocó
  return PALETA[h];
};

// datos que recibe cada fila de suscripción
interface Props {
  // la suscripción a mostrar
  item: SuscripcionItem;
  // si se muestra cuándo se cobra
  mostrarCobro?: boolean;          // Vista de Suscripciones: muestra "Cobra 15 de Noviembre · En 5 días"
  // si se esconde el nombre del banco
  ocultarTarjeta?: boolean;        // Detalle de tarjeta: ya se sabe cuál es, no se repite el banco
  // qué hacer al tocar el basurero (opcional)
  onEliminar?: (s: SuscripcionItem) => void;
}

/** Línea de texto bajo el nombre; cambia según dónde se muestre la fila. */
// arma el texto gris que va debajo del nombre
function textoSecundario({ item, mostrarCobro, ocultarTarjeta }: Required<Pick<Props, 'item' | 'mostrarCobro' | 'ocultarTarjeta'>>) {
  // el plan de la suscripción, o "Mensual" si no tiene
  const plan = item.plan || 'Mensual';
  // Meses anteriores sin pagar: lo importante es cuánto se debe, no la próxima fecha
  const atraso = `${item.mesesPorPagar} meses por pagar (${formatearCLP(item.montoPorPagar)})`;

  // si debe más de un mes, muestra lo que debe
  if (item.mesesPorPagar > 1 && (mostrarCobro || ocultarTarjeta)) {
    // solo el atraso, o el plan junto al atraso
    return mostrarCobro ? atraso : `${plan} · ${atraso}`;
  }
  // en la vista de Suscripciones muestra cuándo se cobra
  if (mostrarCobro) {
    // si ya se pagó este mes, lo dice
    return item.pagadaEsteMes
      // texto cuando está al día
      ? `Al día este mes · Cobra ${item.proximoCobro}`
      // texto con la fecha y cuántos días faltan
      : `Cobra ${item.proximoCobro} · ${item.textoRestante}`;
  }
  // en el detalle de tarjeta muestra el plan y la fecha de cobro
  if (ocultarTarjeta) return `${plan} · Cobra ${item.proximoCobro}`;
  // en el inicio muestra el plan y el banco
  return `${plan} · ${item.tarjetaBanco}`; // Home
}

// fila con una suscripción (inicial, nombre, precio)
export default function SuscripcionFila({
  // la suscripción a mostrar
  item,
  // por defecto no muestra la fecha de cobro
  mostrarCobro = false,
  // por defecto sí muestra el banco
  ocultarTarjeta = false,
  // qué hacer al tocar el basurero
  onEliminar,
}: Props) {
  // trae la herramienta para cambiar de pantalla
  const router = useRouter();

  // devuelve lo que se ve en pantalla
  return (
    // Al tocar la fila se abre el detalle de la suscripción
    <TouchableOpacity
      // al tocarla, abre el detalle de esta suscripción
      onPress={() => router.push(RUTAS.detalleSuscripcion(item.id))}
      // se aclara un poco al tocarla
      activeOpacity={0.85}
      // fila blanca redondeada con borde suave y sombra
      className="p-4 bg-white rounded-2xl border border-slate-100 flex-row items-center shadow-sm mb-3"
    >
      {/* Avatar con inicial */}
      <View
        // cuadradito redondeado donde va la letra
        className="w-11 h-11 rounded-xl items-center justify-center mr-3"
        // se pinta con el color que le toca según el nombre
        style={{ backgroundColor: colorSuscripcion(item.nombre) }}
      >
        {/* letra blanca en negrita */}
        <Text className="text-white text-base font-inter-bold">
          {/* muestra la primera letra del nombre en mayúscula */}
          {item.nombre.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Nombre y texto secundario */}
      <View className="flex-1 pr-2">
        {/* nombre en negrita, en una sola línea */}
        <Text className="text-slate-900 text-base font-inter-bold" numberOfLines={1}>
          {/* muestra el nombre de la suscripción */}
          {item.nombre}
        </Text>
        {/* Hasta 2 líneas: cuándo se cobra es lo importante, no se debe cortar */}
        <Text className="text-slate-400 text-xs font-inter-regular" numberOfLines={2}>
          {/* muestra el texto gris de abajo del nombre */}
          {textoSecundario({ item, mostrarCobro, ocultarTarjeta })}
        </Text>
        {/* Tarjeta asociada (vista de Suscripciones): bajo el cobro, así no le quita ancho */}
        {mostrarCobro && (
          <View className="flex-row items-center mt-1">
            {/* puntito con el color de la tarjeta */}
            <View className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: item.tarjetaColor }} />
            {/* nombre del banco en chico y gris */}
            <Text className="flex-1 text-slate-400 text-[10px] font-inter-regular" numberOfLines={1}>
              {/* muestra el banco de la tarjeta */}
              {item.tarjetaBanco}
            </Text>
          </View>
        )}
      </View>

      {/* Precio */}
      {/* muestra el precio en pesos y en negrita */}
      <Text className="text-slate-900 text-base font-inter-bold">{formatearCLP(item.monto)}</Text>

      {/* En la lista de Suscripciones: eliminar; en las demás, la flecha que indica que se abre */}
      {onEliminar ? (
        <TouchableOpacity onPress={() => onEliminar(item)} className="ml-3 p-1" activeOpacity={0.6}>
          {/* icono del basurero gris */}
          <Ionicons name="trash-outline" size={18} color="#94A3B8" />
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 6 }} />
      )}
    </TouchableOpacity>
  );
}
