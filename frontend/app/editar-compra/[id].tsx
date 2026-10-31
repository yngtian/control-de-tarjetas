import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { CampoFormulario, estiloInput } from '../../components/CampoFormulario';
import PantallaFormulario from '../../components/PantallaFormulario';
import { avisar, avisarSinConexion, confirmar } from '../../constants/alertas';
import { formatearCLP, formatearMiles, soloDigitos } from '../../constants/formato';
import { LIMITES } from '../../constants/limites';
import { TarjetaItem, TransaccionItem, useApp } from '../../context/AppContext';
import type { CambiosTransaccion } from '../../api/tipos';

export default function EditarCompraScreen() {
  // saca el id que viene en la ruta, ej: /editar-compra/1727630000000
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { transacciones, tarjetas } = useApp();
  const compra = transacciones.find((tx) => tx.id === id);
  const tarjeta = tarjetas.find((t) => t.id === compra?.tarjetaId);

  // si no encontro la compra (por ejemplo se acaba de eliminar o terminó de pagarse)
  if (!compra || !tarjeta) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-6">
        <Text className="text-slate-600 text-base mb-4">Compra no encontrada.</Text>
        <TouchableOpacity onPress={() => router.back()} className="px-5 py-2.5 bg-color-action rounded-xl">
          <Text className="text-white font-inter-bold">Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <FormularioEdicion compra={compra} tarjeta={tarjeta} />;
}

/** El formulario parte con los datos actuales de la compra (por eso va aparte: se crea con ella ya cargada). */
function FormularioEdicion({ compra, tarjeta }: { compra: TransaccionItem; tarjeta: TarjetaItem }) {
  const router = useRouter();
  const { editarTransaccion, eliminarTransaccion } = useApp();

  const [motivo, setMotivo] = useState(compra.motivo);
  const [monto, setMonto] = useState(String(compra.montoTotal)); // Solo dígitos; se muestra con puntos de miles
  const [cuotas, setCuotas] = useState(String(compra.totalCuotas));
  const [guardando, setGuardando] = useState(false);

  // Con alguna cuota ya pagada, cambiar monto o cuotas descuadraría lo pagado: solo el motivo
  const cuotasPagadas = compra.cuotaActual - 1;
  const soloMotivo = cuotasPagadas > 0;
  // Lo que todavía ocupa del cupo (se libera al eliminarla)
  const saldo = compra.montoTotal - compra.cuotaMensual * cuotasPagadas;

  const handleGuardar = async () => {
    if (guardando) return;

    // === VALIDACIONES (las mismas que al registrarla) ===
    if (!motivo.trim()) return avisar('Campo requerido', 'Por favor ingresa un motivo para la compra.');
    const montoNumerico = parseInt(monto, 10);
    if (isNaN(montoNumerico) || montoNumerico <= 0) {
      return avisar('Monto inválido', 'Por favor ingresa un monto mayor a cero.');
    }
    const numCuotas = parseInt(cuotas, 10);
    if (isNaN(numCuotas) || numCuotas < 1 || numCuotas > LIMITES.cuotasMax) {
      return avisar('Cuotas inválidas', `Ingresa entre 1 y ${LIMITES.cuotasMax} cuotas.`);
    }

    // === GUARDADO: solo lo que cambió ===
    const cambios: CambiosTransaccion = {};
    if (motivo.trim() !== compra.motivo) cambios.motivo = motivo.trim();
    if (montoNumerico !== compra.montoTotal) cambios.monto = montoNumerico;
    if (numCuotas !== compra.totalCuotas) cambios.cuotas = numCuotas;
    if (Object.keys(cambios).length === 0) return router.back();

    setGuardando(true);
    const { resultado, mensaje } = await editarTransaccion(compra.id, cambios);
    setGuardando(false);

    if (resultado === 'sin_conexion') return avisarSinConexion();
    if (resultado === 'sin_cupo') {
      return avisar(
        'Cupo insuficiente',
        `El monto (${formatearCLP(montoNumerico)}) supera el cupo disponible de ${tarjeta.banco} (${formatearCLP(tarjeta.cupoDisponible + compra.montoTotal)}).`
      );
    }
    if (resultado === 'cuotas_pagadas') {
      return avisar('No se puede cambiar', 'Esta compra ya tiene cuotas pagadas: solo puedes cambiar el motivo.');
    }
    if (resultado !== 'ok') return avisar('Error', mensaje ?? 'No se pudo guardar la compra.');
    router.back();
  };

  const handleEliminar = () => {
    confirmar({
      titulo: 'Eliminar compra',
      mensaje:
        `¿Quieres eliminar "${compra.motivo}"? Dejará de cobrarse y se liberarán ${formatearCLP(saldo)} de cupo. ` +
        'Esto no se puede deshacer.',
      textoConfirmar: 'Eliminar',
      destructivo: true,
      onConfirmar: async () => {
        const { resultado } = await eliminarTransaccion(compra.id);
        if (resultado === 'ok') return router.back();
        if (resultado === 'sin_conexion') return avisarSinConexion();
        avisar('Error', 'No se pudo eliminar la compra.');
      },
    });
  };

  return (
    <PantallaFormulario titulo="Editar Transacción" onVolver={() => router.back()}>
      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        {/* Tarjeta (no se cambia) */}
        <CampoFormulario etiqueta="Tarjeta">
          <View className="w-full h-12 px-4 bg-slate-50 border border-slate-300 rounded-xl flex-row items-center opacity-60">
            <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tarjeta.colorHex }} />
            <Text className="text-slate-900 text-sm font-inter-medium">{tarjeta.banco}</Text>
          </View>
        </CampoFormulario>

        {/* Motivo */}
        <CampoFormulario etiqueta="Motivo">
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            maxLength={LIMITES.motivoMax}
            placeholder="Ejemplo: Compra ropa Ripley"
            placeholderTextColor="#94A3B8"
            className={estiloInput()}
          />
        </CampoFormulario>

        {/* Monto */}
        <CampoFormulario etiqueta="Monto">
          <TextInput
            value={formatearMiles(monto)}
            onChangeText={(txt) => setMonto(soloDigitos(txt).slice(0, LIMITES.digitosMonto))}
            editable={!soloMotivo}
            keyboardType="numeric"
            placeholder="$30.000"
            placeholderTextColor="#94A3B8"
            className={`${estiloInput()} ${soloMotivo ? 'opacity-60' : ''}`}
          />
        </CampoFormulario>

        {/* Cantidad de cuotas */}
        <CampoFormulario etiqueta="Cantidad de cuotas" className={soloMotivo ? 'mb-5' : 'mb-8'}>
          <TextInput
            value={cuotas}
            onChangeText={(txt) => setCuotas(soloDigitos(txt))}
            editable={!soloMotivo}
            keyboardType="numeric"
            maxLength={2}
            placeholder={`Ingresar cantidad de cuotas (1 a ${LIMITES.cuotasMax})`}
            placeholderTextColor="#94A3B8"
            className={`${estiloInput()} ${soloMotivo ? 'opacity-60' : ''}`}
          />
        </CampoFormulario>

        {/* Por qué no se puede cambiar el monto */}
        {soloMotivo && (
          <View className="mb-8 flex-row items-center p-4 bg-blue-50 border border-blue-100 rounded-2xl">
            <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center mr-3">
              <Ionicons name="information-circle-outline" size={18} color="#1D4ED8" />
            </View>
            <Text className="flex-1 text-blue-900 text-xs font-inter-regular">
              Ya pagaste {cuotasPagadas} {cuotasPagadas === 1 ? 'cuota' : 'cuotas'}: solo puedes cambiar el motivo. Si
              el monto está mal, elimina la compra y regístrala de nuevo.
            </Text>
          </View>
        )}

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
          <Text className="text-red-600 text-base font-inter-bold">Eliminar compra</Text>
        </TouchableOpacity>
      </ScrollView>
    </PantallaFormulario>
  );
}
