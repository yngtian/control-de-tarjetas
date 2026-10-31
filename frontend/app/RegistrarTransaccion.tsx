import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { CampoFormulario, estiloInput, SelectorCampo } from '../components/CampoFormulario';
import ModalSeleccion, { FilaOpcion } from '../components/ModalSeleccion';
import PantallaFormulario from '../components/PantallaFormulario';
import { avisar, avisarSinConexion } from '../constants/alertas';
import { formatearCLP, formatearMiles, soloDigitos } from '../constants/formato';
import { LIMITES } from '../constants/limites';
import { RUTAS } from '../constants/rutas';
import { useApp } from '../context/AppContext';
import { useRequerirTarjetas } from '../hooks/useRequerirTarjetas';

export default function NuevaTransaccionScreen() {
  const router = useRouter();
  // las tarjetas para el selector y la funcion que guarda la compra
  const { tarjetas, registrarTransaccion } = useApp();

  // Sin tarjetas no se puede registrar una transacción: ofrece crear una
  useRequerirTarjetas('transacción', RUTAS.inicio);

  // Se guarda solo el id y la tarjeta se busca en cada render:
  // así siempre tiene el cupo actualizado (una copia guardada quedaría desfasada).
  const [tarjetaId, setTarjetaId] = useState<string>(tarjetas[0]?.id ?? '');
  const tarjetaSeleccionada = tarjetas.find((t) => t.id === tarjetaId) ?? null;

  const [motivo, setMotivo] = useState('');
  const [monto, setMonto] = useState('');   // Solo dígitos; se muestra con puntos de miles
  const [cuotas, setCuotas] = useState('1');
  // si el modal de tarjetas esta abierto
  const [modalVisible, setModalVisible] = useState(false);
  // evita guardar dos veces mientras espera la respuesta del servidor
  const [guardando, setGuardando] = useState(false);

  const handleGuardar = async () => {
    if (guardando) return;

    // si no hay tarjeta elegida avisa y corta
    if (!tarjetaSeleccionada) {
      avisar('Error', 'Selecciona una tarjeta para asignar la facturación.');
      return;
    }

    // el motivo no puede estar vacio (trim saca los espacios)
    if (!motivo.trim()) {
      avisar('Campo requerido', 'Por favor ingresa un motivo para la compra.');
      return;
    }

    const montoLimpio = parseInt(monto, 10);
    if (isNaN(montoLimpio) || montoLimpio <= 0) {
      avisar('Monto inválido', 'Por favor ingresa un monto mayor a cero.');
      return;
    }

    const numCuotas = parseInt(cuotas, 10);
    if (isNaN(numCuotas) || numCuotas < 1 || numCuotas > LIMITES.cuotasMax) {
      avisar('Cuotas inválidas', `Ingresa entre 1 y ${LIMITES.cuotasMax} cuotas.`);
      return;
    }

    setGuardando(true);
    const { resultado, mensaje } = await registrarTransaccion(
      tarjetaSeleccionada.id,
      motivo.trim(),
      montoLimpio,
      numCuotas
    );
    setGuardando(false);

    if (resultado === 'sin_conexion') return avisarSinConexion();

    // Si el backend la rechazó, el monto supera el cupo: no mostramos "éxito"
    if (resultado === 'sin_cupo') {
      avisar(
        'Cupo insuficiente',
        `El monto (${formatearCLP(montoLimpio)}) supera el cupo disponible de ${tarjetaSeleccionada.banco} (${formatearCLP(tarjetaSeleccionada.cupoDisponible)}).`
      );
      return; // No navegamos: el usuario puede corregir el monto
    }
    if (resultado !== 'ok') return avisar('Error', mensaje ?? 'No se pudo registrar la compra.');

    avisar('Éxito', 'Agregado correctamente', () => router.replace(RUTAS.inicio));
  };

  return (
    <PantallaFormulario titulo="Nueva Transacción" onVolver={() => router.replace(RUTAS.inicio)}>
      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        {/* 1. Tarjeta */}
        <CampoFormulario etiqueta="Ingrese tarjeta">
          <SelectorCampo onPress={() => setModalVisible(true)}>
            <Text className="text-slate-900 text-sm font-inter-medium">
              {tarjetaSeleccionada ? tarjetaSeleccionada.banco : 'Selecciona una tarjeta'}
            </Text>
          </SelectorCampo>
        </CampoFormulario>

        {/* 2. Motivo */}
        <CampoFormulario etiqueta="Ingrese motivo">
          <TextInput
            value={motivo}
            onChangeText={setMotivo}
            maxLength={LIMITES.motivoMax}
            placeholder="Ejemplo: Compra ropa Ripley"
            placeholderTextColor="#94A3B8"
            className={estiloInput()}
          />
        </CampoFormulario>

        {/* 3. Monto */}
        <CampoFormulario etiqueta="Ingrese monto">
          <TextInput
            value={formatearMiles(monto)}
            onChangeText={(txt) => setMonto(soloDigitos(txt).slice(0, LIMITES.digitosMonto))}
            keyboardType="numeric"
            placeholder="$30.000"
            placeholderTextColor="#94A3B8"
            className={estiloInput()}
          />
        </CampoFormulario>

        {/* 4. Cantidad de cuotas */}
        <CampoFormulario etiqueta="Ingrese cantidad cuotas" className="mb-8">
          <TextInput
            value={cuotas}
            onChangeText={(txt) => setCuotas(soloDigitos(txt))}
            maxLength={2}
            keyboardType="numeric"
            placeholder={`Ingresar cantidad de cuotas (1 a ${LIMITES.cuotasMax})`}
            placeholderTextColor="#94A3B8"
            className={estiloInput()}
          />
        </CampoFormulario>

        {/* Botón Agregar */}
        <TouchableOpacity
          onPress={handleGuardar}
          className="w-full h-12 bg-color-action rounded-2xl items-center justify-center mb-8 shadow-md"
          activeOpacity={0.8}
        >
          <Text className="text-white text-base font-inter-bold">
            Agregar Transacción
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Selección de Tarjetas Registradas */}
      <ModalSeleccion
        visible={modalVisible}
        titulo="Seleccionar Tarjeta"
        onCerrar={() => setModalVisible(false)}
      >
        {tarjetas.map((t) => (
          <FilaOpcion
            key={t.id}
            seleccionada={tarjetaId === t.id}
            onPress={() => {
              setTarjetaId(t.id);
              setModalVisible(false);
            }}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-4 h-4 rounded-full" style={{ backgroundColor: t.colorHex }} />
              <View>
                <Text className="text-slate-900 text-base font-inter-medium">{t.banco}</Text>
                <Text className="text-slate-500 text-xs">
                  {t.propia ? '' : `De ${t.duenoNombre} · `}Disponible: {formatearCLP(t.cupoDisponible)}
                </Text>
              </View>
            </View>
          </FilaOpcion>
        ))}
      </ModalSeleccion>
    </PantallaFormulario>
  );
}
