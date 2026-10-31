// trae los iconos que se usan en la pantalla
import { Ionicons } from '@expo/vector-icons';
// trae las funciones para leer la ruta y moverse entre pantallas
import { useLocalSearchParams, useRouter } from 'expo-router';
// trae React y la funcion para que la pantalla recuerde datos
import React, { useState } from 'react';
// trae las piezas basicas: lista deslizable, texto, campo para escribir, boton y caja
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

// trae la caja con titulo de cada campo y el estilo de los campos
import { CampoFormulario, estiloInput } from '../../components/CampoFormulario';
// trae el marco comun de las pantallas de formulario
import PantallaFormulario from '../../components/PantallaFormulario';
// trae las funciones para mostrar avisos y preguntas
import { avisar, avisarSinConexion, confirmar } from '../../constants/alertas';
// trae funciones para escribir montos con puntos y dejar solo numeros
import { formatearCLP, formatearMiles, soloDigitos } from '../../constants/formato';
// trae los largos y cantidades maximas permitidas
import { LIMITES } from '../../constants/limites';
// trae los tipos de tarjeta y compra, y los datos guardados de la app
import { TarjetaItem, TransaccionItem, useApp } from '../../context/AppContext';
// trae el tipo que dice que cambios se pueden mandar de una compra
import type { CambiosTransaccion } from '../../api/tipos';

// pantalla para cambiar los datos de una compra
export default function EditarCompraScreen() {
  // saca el id que viene en la ruta, ej: /editar-compra/1727630000000
  const { id } = useLocalSearchParams<{ id: string }>();
  // sirve para ir a otras pantallas
  const router = useRouter();
  // saca las compras y las tarjetas guardadas
  const { transacciones, tarjetas } = useApp();
  // busca la compra que tiene ese id
  const compra = transacciones.find((tx) => tx.id === id);
  // busca la tarjeta donde se hizo esa compra
  const tarjeta = tarjetas.find((t) => t.id === compra?.tarjetaId);

  // si no encontro la compra (por ejemplo se acaba de eliminar o terminó de pagarse)
  if (!compra || !tarjeta) {
    // muestra una pantalla simple con un aviso
    return (
      // caja blanca que ocupa todo, con el contenido al centro
      <View className="flex-1 bg-white items-center justify-center p-6">
        {/* texto gris que dice que no se encontro */}
        <Text className="text-slate-600 text-base mb-4">Compra no encontrada.</Text>
        {/* boton con color principal que vuelve atras */}
        <TouchableOpacity onPress={() => router.back()} className="px-5 py-2.5 bg-color-action rounded-xl">
          {/* texto blanco en negrita del boton */}
          <Text className="text-white font-inter-bold">Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // si la encontro, muestra el formulario con sus datos
  return <FormularioEdicion compra={compra} tarjeta={tarjeta} />;
}

/** El formulario parte con los datos actuales de la compra (por eso va aparte: se crea con ella ya cargada). */
function FormularioEdicion({ compra, tarjeta }: { compra: TransaccionItem; tarjeta: TarjetaItem }) {
  // sirve para ir a otras pantallas
  const router = useRouter();
  // saca las funciones para cambiar y borrar compras
  const { editarTransaccion, eliminarTransaccion } = useApp();

  // guarda el motivo, parte con el que ya tenia la compra
  const [motivo, setMotivo] = useState(compra.motivo);
  // guarda el monto, parte con el que ya tenia la compra
  const [monto, setMonto] = useState(String(compra.montoTotal)); // Solo dígitos; se muestra con puntos de miles
  // guarda las cuotas, parte con las que ya tenia la compra
  const [cuotas, setCuotas] = useState(String(compra.totalCuotas));
  // evita guardar dos veces mientras espera al servidor
  const [guardando, setGuardando] = useState(false);

  // Con alguna cuota ya pagada, cambiar monto o cuotas descuadraría lo pagado: solo el motivo
  // cuenta cuantas cuotas ya se pagaron
  const cuotasPagadas = compra.cuotaActual - 1;
  // si ya pago alguna, solo se deja cambiar el motivo
  const soloMotivo = cuotasPagadas > 0;
  // Lo que todavía ocupa del cupo (se libera al eliminarla)
  const saldo = compra.montoTotal - compra.cuotaMensual * cuotasPagadas;

  // se ejecuta al tocar "Guardar Cambios"
  const handleGuardar = async () => {
    // si ya se esta guardando, no hace nada
    if (guardando) return;

    // === VALIDACIONES (las mismas que al registrarla) ===
    // si el motivo esta vacio, avisa y no guarda
    if (!motivo.trim()) return avisar('Campo requerido', 'Por favor ingresa un motivo para la compra.');
    // pasa el monto escrito a numero
    const montoNumerico = parseInt(monto, 10);
    // si el monto no es numero o es cero o menos
    if (isNaN(montoNumerico) || montoNumerico <= 0) {
      // avisa que el monto no sirve
      return avisar('Monto inválido', 'Por favor ingresa un monto mayor a cero.');
    }
    // pasa las cuotas escritas a numero
    const numCuotas = parseInt(cuotas, 10);
    // si las cuotas no son numero o estan fuera del rango permitido
    if (isNaN(numCuotas) || numCuotas < 1 || numCuotas > LIMITES.cuotasMax) {
      // avisa cuantas cuotas se pueden poner
      return avisar('Cuotas inválidas', `Ingresa entre 1 y ${LIMITES.cuotasMax} cuotas.`);
    }

    // === GUARDADO: solo lo que cambió ===
    // lista vacia donde se anotan los cambios
    const cambios: CambiosTransaccion = {};
    // si cambio el motivo, lo anota
    if (motivo.trim() !== compra.motivo) cambios.motivo = motivo.trim();
    // si cambio el monto, lo anota
    if (montoNumerico !== compra.montoTotal) cambios.monto = montoNumerico;
    // si cambiaron las cuotas, las anota
    if (numCuotas !== compra.totalCuotas) cambios.cuotas = numCuotas;
    // si no cambio nada, solo vuelve atras
    if (Object.keys(cambios).length === 0) return router.back();

    // marca que empezo a guardar
    setGuardando(true);
    // manda los cambios al servidor
    const { resultado, mensaje } = await editarTransaccion(compra.id, cambios);
    // marca que termino de guardar
    setGuardando(false);

    // si no hay internet, avisa
    if (resultado === 'sin_conexion') return avisarSinConexion();
    // si el nuevo monto no cabe en el cupo
    if (resultado === 'sin_cupo') {
      // avisa que no alcanza el cupo
      return avisar(
        // titulo del aviso
        'Cupo insuficiente',
        // texto con el monto y el cupo que hay (contando esta compra)
        `El monto (${formatearCLP(montoNumerico)}) supera el cupo disponible de ${tarjeta.banco} (${formatearCLP(tarjeta.cupoDisponible + compra.montoTotal)}).`
      );
    }
    // si ya tiene cuotas pagadas y quiso cambiar monto o cuotas
    if (resultado === 'cuotas_pagadas') {
      // avisa que solo puede cambiar el motivo
      return avisar('No se puede cambiar', 'Esta compra ya tiene cuotas pagadas: solo puedes cambiar el motivo.');
    }
    // si hubo otro error, avisa el motivo
    if (resultado !== 'ok') return avisar('Error', mensaje ?? 'No se pudo guardar la compra.');
    // si todo salio bien, vuelve atras
    router.back();
  };

  // se ejecuta al tocar "Eliminar compra"
  const handleEliminar = () => {
    // pregunta si de verdad quiere borrarla
    confirmar({
      // titulo del aviso
      titulo: 'Eliminar compra',
      // texto del aviso con el motivo y el cupo que se libera
      mensaje:
        `¿Quieres eliminar "${compra.motivo}"? Dejará de cobrarse y se liberarán ${formatearCLP(saldo)} de cupo. ` +
        'Esto no se puede deshacer.',
      // texto del boton para aceptar
      textoConfirmar: 'Eliminar',
      // pinta el boton de rojo porque borra algo
      destructivo: true,
      // si acepta, se borra la compra
      onConfirmar: async () => {
        // pide al servidor borrar la compra
        const { resultado } = await eliminarTransaccion(compra.id);
        // si se borro bien, vuelve atras
        if (resultado === 'ok') return router.back();
        // si no hay internet, avisa
        if (resultado === 'sin_conexion') return avisarSinConexion();
        // si hubo otro problema, avisa con un error
        avisar('Error', 'No se pudo eliminar la compra.');
      },
    });
  };

  // lo que se ve en la pantalla
  return (
    // marco de formulario con titulo y flecha para volver atras
    <PantallaFormulario titulo="Editar Transacción" onVolver={() => router.back()}>
      {/* zona deslizable con espacio a los lados y arriba */}
      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        {/* Tarjeta (no se cambia) */}
        <CampoFormulario etiqueta="Tarjeta">
          {/* caja gris clara y medio transparente, se ve bloqueada */}
          <View className="w-full h-12 px-4 bg-slate-50 border border-slate-300 rounded-xl flex-row items-center opacity-60">
            {/* circulito pintado con el color de la tarjeta */}
            <View className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tarjeta.colorHex }} />
            {/* nombre del banco de la tarjeta */}
            <Text className="text-slate-900 text-sm font-inter-medium">{tarjeta.banco}</Text>
          </View>
        </CampoFormulario>

        {/* Motivo */}
        <CampoFormulario etiqueta="Motivo">
          {/* caja para escribir el motivo */}
          <TextInput
            // muestra el motivo guardado
            value={motivo}
            // guarda lo que el usuario va escribiendo
            onChangeText={setMotivo}
            // no deja escribir mas letras que el maximo
            maxLength={LIMITES.motivoMax}
            // texto de ejemplo cuando esta vacio
            placeholder="Ejemplo: Compra ropa Ripley"
            // color gris del texto de ejemplo
            placeholderTextColor="#94A3B8"
            // aplica el estilo comun de los campos
            className={estiloInput()}
          />
        </CampoFormulario>

        {/* Monto */}
        <CampoFormulario etiqueta="Monto">
          {/* caja para escribir el monto */}
          <TextInput
            // muestra el monto con puntos de miles
            value={formatearMiles(monto)}
            // guarda solo los numeros, con un largo maximo
            onChangeText={(txt) => setMonto(soloDigitos(txt).slice(0, LIMITES.digitosMonto))}
            // se bloquea si ya hay cuotas pagadas
            editable={!soloMotivo}
            // abre el teclado de numeros
            keyboardType="numeric"
            // texto de ejemplo cuando esta vacio
            placeholder="$30.000"
            // color gris del texto de ejemplo
            placeholderTextColor="#94A3B8"
            // estilo comun; medio transparente si esta bloqueado
            className={`${estiloInput()} ${soloMotivo ? 'opacity-60' : ''}`}
          />
        </CampoFormulario>

        {/* Cantidad de cuotas */}
        {/* menos espacio abajo si se muestra el aviso azul */}
        <CampoFormulario etiqueta="Cantidad de cuotas" className={soloMotivo ? 'mb-5' : 'mb-8'}>
          {/* caja para escribir las cuotas */}
          <TextInput
            // muestra las cuotas guardadas
            value={cuotas}
            // guarda solo los numeros que escribe
            onChangeText={(txt) => setCuotas(soloDigitos(txt))}
            // se bloquea si ya hay cuotas pagadas
            editable={!soloMotivo}
            // abre el teclado de numeros
            keyboardType="numeric"
            // deja escribir maximo 2 numeros
            maxLength={2}
            // texto de ejemplo con el rango de cuotas permitido
            placeholder={`Ingresar cantidad de cuotas (1 a ${LIMITES.cuotasMax})`}
            // color gris del texto de ejemplo
            placeholderTextColor="#94A3B8"
            // estilo comun; medio transparente si esta bloqueado
            className={`${estiloInput()} ${soloMotivo ? 'opacity-60' : ''}`}
          />
        </CampoFormulario>

        {/* Por qué no se puede cambiar el monto */}
        {/* si ya hay cuotas pagadas, muestra una caja azul clara con el motivo */}
        {soloMotivo && (
          <View className="mb-8 flex-row items-center p-4 bg-blue-50 border border-blue-100 rounded-2xl">
            {/* cuadrito azul para el icono */}
            <View className="w-9 h-9 rounded-xl bg-blue-100 items-center justify-center mr-3">
              {/* icono azul de informacion */}
              <Ionicons name="information-circle-outline" size={18} color="#1D4ED8" />
            </View>
            {/* texto azul oscuro que explica por que no se puede cambiar */}
            <Text className="flex-1 text-blue-900 text-xs font-inter-regular">
              Ya pagaste {cuotasPagadas} {cuotasPagadas === 1 ? 'cuota' : 'cuotas'}: solo puedes cambiar el motivo. Si
              el monto está mal, elimina la compra y regístrala de nuevo.
            </Text>
          </View>
        )}

        {/* Botón Guardar */}
        <TouchableOpacity
          // al tocarlo intenta guardar los cambios
          onPress={handleGuardar}
          // se bloquea mientras se esta guardando
          disabled={guardando}
          // boton ancho con color principal, esquinas redondeadas y sombra
          className="w-full h-12 bg-color-action rounded-2xl items-center justify-center mb-3 shadow-md"
          // se aclara un poco al tocarlo
          activeOpacity={0.8}
        >
          {/* texto blanco en negrita del boton */}
          <Text className="text-white text-base font-inter-bold">Guardar Cambios</Text>
        </TouchableOpacity>

        {/* Botón Eliminar */}
        <TouchableOpacity
          // al tocarlo pregunta si quiere borrar la compra
          onPress={handleEliminar}
          // se aclara un poco al tocarlo
          activeOpacity={0.8}
          // boton ancho blanco con borde gris y esquinas redondeadas
          className="w-full h-12 mb-8 rounded-2xl items-center justify-center flex-row gap-2 bg-white border border-slate-300"
        >
          {/* icono rojo de basurero */}
          <Ionicons name="trash-outline" size={20} color="#DC2626" />
          {/* texto rojo en negrita del boton */}
          <Text className="text-red-600 text-base font-inter-bold">Eliminar compra</Text>
        </TouchableOpacity>
      </ScrollView>
    </PantallaFormulario>
  );
}
