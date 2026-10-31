import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { CampoFormulario, estiloInput } from '../../components/CampoFormulario';
import PantallaFormulario from '../../components/PantallaFormulario';
import CardItem from '../../components/TarjetaGrande';
import { avisar, avisarSinConexion, confirmar } from '../../constants/alertas';
import { formatearCLP, formatearMiles, nombresCompartidos, soloDigitos } from '../../constants/formato';
import { LIMITES } from '../../constants/limites';
import { RUTAS } from '../../constants/rutas';
import { TarjetaItem, useApp } from '../../context/AppContext';
import type { CambiosTarjeta } from '../../api/tipos';

export default function EditarTarjetaScreen() {
  // saca el id que viene en la ruta, ej: /editar-tarjeta/1727630000000
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tarjetas, transacciones, suscripciones } = useApp();
  const tarjeta = tarjetas.find((t) => t.id === id);

  // si no encontro la tarjeta (por ejemplo se acaba de eliminar), o es de otra persona, muestra un aviso
  if (!tarjeta || !tarjeta.propia) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-6">
        <Text className="text-slate-600 text-base mb-4 text-center">
          {tarjeta ? `Solo ${tarjeta.duenoNombre ?? 'el dueño'} puede editar esta tarjeta.` : 'Tarjeta no encontrada.'}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace(RUTAS.tarjetas)}
          className="px-5 py-2.5 bg-color-action rounded-xl">
          <Text className="text-white font-inter-bold">Volver a Tarjetas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FormularioEdicion
      tarjeta={tarjeta}
      cantidadCompras={transacciones.filter((tx) => tx.tarjetaId === tarjeta.id).length}
      cantidadSuscripciones={suscripciones.filter((s) => s.tarjetaId === tarjeta.id).length}
    />
  );
}

interface FormularioProps {
  tarjeta: TarjetaItem;
  cantidadCompras: number;
  cantidadSuscripciones: number;
}

/** El formulario parte con los datos actuales de la tarjeta (por eso va aparte: se crea con ella ya cargada). */
function FormularioEdicion({ tarjeta, cantidadCompras, cantidadSuscripciones }: FormularioProps) {
  const router = useRouter();
  const { editarTarjeta, eliminarTarjeta } = useApp();

  // Visa y MasterCard se distinguen solo por su alias: es obligatorio
  const requiereAlias = tarjeta.emisor === 'visa' || tarjeta.emisor === 'mastercard';

  // Un alias igual al nombre del banco es el que se puso por defecto: se muestra vacío (opcional)
  const [alias, setAlias] = useState(requiereAlias || tarjeta.alias !== tarjeta.banco ? tarjeta.alias : '');
  const [cupo, setCupo] = useState(String(tarjeta.cupoTotal));   // Solo dígitos; se muestra con puntos de miles
  const [dia, setDia] = useState(String(tarjeta.diaVencimiento));
  const [guardando, setGuardando] = useState(false);

  const cupoNumerico = parseInt(cupo, 10) || 0;
  // Lo que ya ocupan las compras y suscripciones (de todos, si está compartida)
  const usado = tarjeta.cupoTotal - tarjeta.cupoDisponible;

  // Previsualización: la tarjeta como quedará con los cambios
  const previewItem: TarjetaItem = {
    ...tarjeta,
    banco: requiereAlias ? alias.trim() || tarjeta.banco : tarjeta.banco,
    cupoTotal: cupoNumerico,
  };

  // Día de facturación: solo números y nunca mayor a 31
  const handleCambioDia = (texto: string) => {
    const soloNumeros = soloDigitos(texto);
    if (soloNumeros === '' || parseInt(soloNumeros, 10) <= 31) setDia(soloNumeros);
  };

  const handleGuardar = async () => {
    if (guardando) return;

    // === VALIDACIONES ===
    if (requiereAlias && !alias.trim()) {
      return avisar(
        'Alias obligatorio',
        `Ingresa un nombre para identificar tu tarjeta ${tarjeta.emisor === 'visa' ? 'Visa' : 'MasterCard'}.`
      );
    }
    const diaNumero = parseInt(dia, 10);
    if (isNaN(diaNumero) || diaNumero < 1 || diaNumero > 31) {
      return avisar('Día inválido', 'Por favor ingresa un día de facturación válido entre 1 y 31.');
    }
    if (cupoNumerico <= 0) return avisar('Cupo inválido', 'Por favor ingresa un cupo total mayor a 0.');
    if (cupoNumerico < usado) {
      return avisar('Cupo insuficiente', `El cupo no puede ser menor a lo que ya está usado (${formatearCLP(usado)}).`);
    }

    // === GUARDADO: solo lo que cambió ===
    const cambios: CambiosTarjeta = {};
    const aliasOriginal = requiereAlias || tarjeta.alias !== tarjeta.banco ? tarjeta.alias : '';
    if (alias.trim() !== aliasOriginal) cambios.alias = alias.trim();
    if (cupoNumerico !== tarjeta.cupoTotal) cambios.cupoTotal = cupoNumerico;
    if (diaNumero !== tarjeta.diaVencimiento) cambios.diaVencimiento = diaNumero;
    if (Object.keys(cambios).length === 0) return router.back();

    setGuardando(true);
    const { resultado, mensaje } = await editarTarjeta(tarjeta.id, cambios);
    setGuardando(false);

    if (resultado === 'sin_conexion') return avisarSinConexion();
    if (resultado === 'sin_cupo') {
      return avisar('Cupo insuficiente', `El cupo no puede ser menor a lo que ya está usado (${formatearCLP(usado)}).`);
    }
    if (resultado !== 'ok') return avisar('Error', mensaje ?? 'No se pudo guardar la tarjeta.');
    router.back();
  };

  const handleEliminar = () => {
    // "su compra" / "sus 3 compras"
    const contar = (n: number, singular: string, plural: string) => (n === 1 ? `su ${singular}` : `sus ${n} ${plural}`);
    const detalle = [
      cantidadCompras > 0 && contar(cantidadCompras, 'compra', 'compras'),
      cantidadSuscripciones > 0 && contar(cantidadSuscripciones, 'suscripción', 'suscripciones'),
    ].filter(Boolean).join(' y ');

    confirmar({
      titulo: 'Eliminar tarjeta',
      mensaje:
        `¿Quieres eliminar ${tarjeta.banco}?` +
        (detalle ? ` También se eliminarán ${detalle}.` : '') +
        // Si está compartida, deja de verse en las otras cuentas
        (tarjeta.compartidaCon.length > 0
          ? ` ${nombresCompartidos(tarjeta.compartidaCon)} dejará de verla.`
          : '') +
        ' Esto no se puede deshacer.',
      textoConfirmar: 'Eliminar',
      destructivo: true,
      onConfirmar: async () => {
        const { resultado } = await eliminarTarjeta(tarjeta.id);
        if (resultado === 'ok') return router.replace(RUTAS.tarjetas);
        if (resultado === 'sin_conexion') return avisarSinConexion();
        avisar('Error', 'No se pudo eliminar la tarjeta.');
      },
    });
  };

  return (
    <PantallaFormulario titulo="Editar Tarjeta" onVolver={() => router.back()}>
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Previsualización en vivo */}
        <View className="pt-4 pb-4">
          <CardItem item={previewItem} />
        </View>

        {/* Nombre / alias */}
        <CampoFormulario etiqueta={`Alias de la Tarjeta ${requiereAlias ? '(Obligatorio)' : '(Opcional)'}`}>
          <TextInput
            value={alias}
            onChangeText={setAlias}
            maxLength={LIMITES.aliasMax}
            placeholder={requiereAlias ? 'Ej: Visa Platinum' : 'Ej: Tarjeta del trabajo (opcional)'}
            placeholderTextColor="#94A3B8"
            className={estiloInput(requiereAlias && !alias.trim())}
          />
        </CampoFormulario>

        {/* Cupo Total */}
        <CampoFormulario etiqueta="Cupo Total">
          <TextInput
            value={formatearMiles(cupo)}
            onChangeText={(txt) => setCupo(soloDigitos(txt).slice(0, LIMITES.digitosMonto))}
            keyboardType="numeric"
            placeholder="$300.000"
            placeholderTextColor="#94A3B8"
            className={estiloInput(cupoNumerico > 0 && cupoNumerico < usado)}
          />
          {usado > 0 && (
            <Text className="text-slate-400 text-xs font-inter-regular mt-1.5">
              Ya usado: {formatearCLP(usado)}{tarjeta.compartidaCon.length > 0 ? ' (entre todos los que la comparten)' : ''}
            </Text>
          )}
        </CampoFormulario>

        {/* Día Vencimiento */}
        <CampoFormulario etiqueta="Día de Facturación / Vencimiento" className="mb-8">
          <TextInput
            value={dia}
            onChangeText={handleCambioDia}
            keyboardType="numeric"
            maxLength={2}
            placeholder="Seleccionar día (1 - 31)"
            placeholderTextColor="#94A3B8"
            className={estiloInput()}
          />
        </CampoFormulario>

        {/* Botón Guardar */}
        <TouchableOpacity
          onPress={handleGuardar}
          disabled={guardando}
          className="w-full h-12 bg-color-action rounded-2xl items-center justify-center mb-3 shadow-md"
          activeOpacity={0.8}
        >
          <Text className="text-white text-base font-inter-bold">Guardar Cambios</Text>
        </TouchableOpacity>

        {/* Botón Eliminar */}
        <TouchableOpacity
          onPress={handleEliminar}
          activeOpacity={0.8}
          className="w-full h-12 mb-8 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
        >
          <Ionicons name="trash-outline" size={20} color="#DC2626" />
          <Text className="text-red-600 text-base font-inter-bold">Eliminar tarjeta</Text>
        </TouchableOpacity>
      </ScrollView>
    </PantallaFormulario>
  );
}
