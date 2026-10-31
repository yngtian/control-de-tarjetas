// trae la funcion para moverse entre pantallas
import { useRouter } from 'expo-router';
// trae React y la funcion para que la pantalla recuerde datos
import React, { useState } from 'react';
// trae las piezas basicas: lista deslizable, texto, campo para escribir, boton y caja
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

// trae la caja con titulo de cada campo, su estilo y el campo para elegir
import { CampoFormulario, estiloInput, SelectorCampo } from '../components/CampoFormulario';
// trae la ventana emergente para elegir una opcion y sus filas
import ModalSeleccion, { FilaOpcion } from '../components/ModalSeleccion';
// trae el marco comun de las pantallas de formulario
import PantallaFormulario from '../components/PantallaFormulario';
// trae las funciones para mostrar avisos
import { avisar, avisarSinConexion } from '../constants/alertas';
// trae funciones para escribir montos con puntos y dejar solo numeros
import { formatearCLP, formatearMiles, soloDigitos } from '../constants/formato';
// trae los largos y cantidades maximas permitidas
import { LIMITES } from '../constants/limites';
// trae las direcciones de las pantallas de la app
import { RUTAS } from '../constants/rutas';
// trae los datos guardados de la app
import { useApp } from '../context/AppContext';
// trae la revision que pide tener al menos una tarjeta
import { useRequerirTarjetas } from '../hooks/useRequerirTarjetas';

// pantalla para anotar una compra nueva
export default function NuevaTransaccionScreen() {
  // sirve para ir a otras pantallas
  const router = useRouter();
  // las tarjetas para el selector y la funcion que guarda la compra
  const { tarjetas, registrarTransaccion } = useApp();

  // Sin tarjetas no se puede registrar una transacción: ofrece crear una
  useRequerirTarjetas('transacción', RUTAS.inicio);

  // Se guarda solo el id y la tarjeta se busca en cada render:
  // así siempre tiene el cupo actualizado (una copia guardada quedaría desfasada).
  const [tarjetaId, setTarjetaId] = useState<string>(tarjetas[0]?.id ?? '');
  // busca la tarjeta elegida; si no hay ninguna queda vacia
  const tarjetaSeleccionada = tarjetas.find((t) => t.id === tarjetaId) ?? null;

  // guarda el motivo de la compra que escribe el usuario
  const [motivo, setMotivo] = useState('');
  // guarda el monto que escribe el usuario
  const [monto, setMonto] = useState('');   // Solo dígitos; se muestra con puntos de miles
  // guarda la cantidad de cuotas, parte en 1
  const [cuotas, setCuotas] = useState('1');
  // si el modal de tarjetas esta abierto
  const [modalVisible, setModalVisible] = useState(false);
  // evita guardar dos veces mientras espera la respuesta del servidor
  const [guardando, setGuardando] = useState(false);

  // se ejecuta al tocar "Agregar Transacción"
  const handleGuardar = async () => {
    // si ya se esta guardando, no hace nada
    if (guardando) return;

    // si no hay tarjeta elegida avisa y corta
    if (!tarjetaSeleccionada) {
      // avisa que falta elegir una tarjeta
      avisar('Error', 'Selecciona una tarjeta para asignar la facturación.');
      // corta aqui y no guarda
      return;
    }

    // el motivo no puede estar vacio (trim saca los espacios)
    if (!motivo.trim()) {
      // avisa que falta el motivo
      avisar('Campo requerido', 'Por favor ingresa un motivo para la compra.');
      // corta aqui y no guarda
      return;
    }

    // pasa el monto escrito a numero
    const montoLimpio = parseInt(monto, 10);
    // si el monto no es numero o es cero o menos
    if (isNaN(montoLimpio) || montoLimpio <= 0) {
      // avisa que el monto no sirve
      avisar('Monto inválido', 'Por favor ingresa un monto mayor a cero.');
      // corta aqui y no guarda
      return;
    }

    // pasa las cuotas escritas a numero
    const numCuotas = parseInt(cuotas, 10);
    // si las cuotas no son numero o estan fuera del rango permitido
    if (isNaN(numCuotas) || numCuotas < 1 || numCuotas > LIMITES.cuotasMax) {
      // avisa cuantas cuotas se pueden poner
      avisar('Cuotas inválidas', `Ingresa entre 1 y ${LIMITES.cuotasMax} cuotas.`);
      // corta aqui y no guarda
      return;
    }

    // marca que empezo a guardar
    setGuardando(true);
    // manda la compra al servidor para guardarla
    const { resultado, mensaje } = await registrarTransaccion(
      // la tarjeta donde se carga la compra
      tarjetaSeleccionada.id,
      // el motivo sin espacios sobrantes
      motivo.trim(),
      // el monto en numero
      montoLimpio,
      // la cantidad de cuotas
      numCuotas
    );
    // marca que termino de guardar
    setGuardando(false);

    // si no hay internet, avisa
    if (resultado === 'sin_conexion') return avisarSinConexion();

    // Si el backend la rechazó, el monto supera el cupo: no mostramos "éxito"
    if (resultado === 'sin_cupo') {
      // avisa que no alcanza el cupo de la tarjeta
      avisar(
        // titulo del aviso
        'Cupo insuficiente',
        // texto con el monto y el cupo que queda
        `El monto (${formatearCLP(montoLimpio)}) supera el cupo disponible de ${tarjetaSeleccionada.banco} (${formatearCLP(tarjetaSeleccionada.cupoDisponible)}).`
      );
      return; // No navegamos: el usuario puede corregir el monto
    }
    // si hubo otro error, avisa el motivo
    if (resultado !== 'ok') return avisar('Error', mensaje ?? 'No se pudo registrar la compra.');

    // avisa que se guardo y al aceptar vuelve al inicio
    avisar('Éxito', 'Agregado correctamente', () => router.replace(RUTAS.inicio));
  };

  // lo que se ve en la pantalla
  return (
    // marco de formulario con titulo y flecha que vuelve al inicio
    <PantallaFormulario titulo="Nueva Transacción" onVolver={() => router.replace(RUTAS.inicio)}>
      {/* zona deslizable con espacio a los lados y arriba */}
      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        {/* 1. Tarjeta */}
        {/* campo con el titulo "Ingrese tarjeta" */}
        <CampoFormulario etiqueta="Ingrese tarjeta">
          {/* al tocarlo abre la lista de tarjetas */}
          <SelectorCampo onPress={() => setModalVisible(true)}>
            {/* muestra el banco elegido o un texto para elegir */}
            <Text className="text-slate-900 text-sm font-inter-medium">
              {tarjetaSeleccionada ? tarjetaSeleccionada.banco : 'Selecciona una tarjeta'}
            </Text>
          </SelectorCampo>
        </CampoFormulario>

        {/* 2. Motivo */}
        {/* campo con el titulo "Ingrese motivo" */}
        <CampoFormulario etiqueta="Ingrese motivo">
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

        {/* 3. Monto */}
        {/* campo con el titulo "Ingrese monto" */}
        <CampoFormulario etiqueta="Ingrese monto">
          {/* caja para escribir el monto */}
          <TextInput
            // muestra el monto con puntos de miles
            value={formatearMiles(monto)}
            // guarda solo los numeros, con un largo maximo
            onChangeText={(txt) => setMonto(soloDigitos(txt).slice(0, LIMITES.digitosMonto))}
            // abre el teclado de numeros
            keyboardType="numeric"
            // texto de ejemplo cuando esta vacio
            placeholder="$30.000"
            // color gris del texto de ejemplo
            placeholderTextColor="#94A3B8"
            // aplica el estilo comun de los campos
            className={estiloInput()}
          />
        </CampoFormulario>

        {/* 4. Cantidad de cuotas */}
        {/* campo de cuotas con mas espacio abajo */}
        <CampoFormulario etiqueta="Ingrese cantidad cuotas" className="mb-8">
          {/* caja para escribir las cuotas */}
          <TextInput
            // muestra las cuotas guardadas
            value={cuotas}
            // guarda solo los numeros que escribe
            onChangeText={(txt) => setCuotas(soloDigitos(txt))}
            // deja escribir maximo 2 numeros
            maxLength={2}
            // abre el teclado de numeros
            keyboardType="numeric"
            // texto de ejemplo con el rango de cuotas permitido
            placeholder={`Ingresar cantidad de cuotas (1 a ${LIMITES.cuotasMax})`}
            // color gris del texto de ejemplo
            placeholderTextColor="#94A3B8"
            // aplica el estilo comun de los campos
            className={estiloInput()}
          />
        </CampoFormulario>

        {/* Botón Agregar */}
        <TouchableOpacity
          // al tocarlo intenta guardar la compra
          onPress={handleGuardar}
          // boton ancho con color principal, esquinas redondeadas y sombra
          className="w-full h-12 bg-color-action rounded-2xl items-center justify-center mb-8 shadow-md"
          // se aclara un poco al tocarlo
          activeOpacity={0.8}
        >
          {/* texto blanco en negrita del boton */}
          <Text className="text-white text-base font-inter-bold">
            Agregar Transacción
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal Selección de Tarjetas Registradas */}
      <ModalSeleccion
        // se muestra solo si se pidio abrir
        visible={modalVisible}
        // titulo de la ventana
        titulo="Seleccionar Tarjeta"
        // al cerrarla, se esconde
        onCerrar={() => setModalVisible(false)}
      >
        {/* recorre cada tarjeta y arma una fila para elegirla */}
        {tarjetas.map((t) => (
          <FilaOpcion
            // identificador unico de cada tarjeta en la lista
            key={t.id}
            // marca la fila si es la tarjeta ya elegida
            seleccionada={tarjetaId === t.id}
            // al tocar la fila
            onPress={() => {
              // guarda esa tarjeta como la elegida
              setTarjetaId(t.id);
              // cierra la ventana
              setModalVisible(false);
            }}
          >
            {/* fila con el color y los datos de la tarjeta */}
            <View className="flex-row items-center gap-3">
              {/* circulito pintado con el color de la tarjeta */}
              <View className="w-4 h-4 rounded-full" style={{ backgroundColor: t.colorHex }} />
              {/* caja con el nombre del banco y el cupo */}
              <View>
                {/* nombre del banco en gris oscuro */}
                <Text className="text-slate-900 text-base font-inter-medium">{t.banco}</Text>
                {/* texto chico gris: dueño si es compartida y cupo disponible */}
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
