// trae React y el tipo para recibir piezas de pantalla adentro
import React, { ReactNode } from 'react';
// trae la pieza de caja
import { View } from 'react-native';
// sirve para saber cuánto espacio ocupan la muesca y la barra del celular
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// trae la barra de arriba con la flecha y el título
import EncabezadoPantalla from './EncabezadoPantalla';

// datos que recibe el marco de formulario
interface Props {
  // título de la pantalla
  titulo: string;
  // qué hacer al tocar la flecha de volver
  onVolver: () => void;
  // el contenido del formulario
  children: ReactNode;
}

/**
 * Marco común de las pantallas de formulario y detalle:
 * fondo oscuro en los bordes seguros (notch / barra inferior), hoja blanca y encabezado.
 */
// marco que envuelve las pantallas de formulario
export default function PantallaFormulario({ titulo, onVolver, children }: Props) {
  // mide el espacio de la muesca y la barra del celular
  const insets = useSafeAreaInsets();

  // devuelve lo que se ve en pantalla
  return (
    // fondo oscuro que cubre toda la pantalla
    <View
      // ocupa todo y se pinta del color oscuro del menú
      className="flex-1 bg-color-menu"
      // deja libre el espacio de la muesca y la barra de abajo
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* hoja blanca donde va el formulario */}
      <View className="flex-1 bg-white">
        {/* barra de arriba con la flecha y el título */}
        <EncabezadoPantalla titulo={titulo} onVolver={onVolver} variante="formulario" />
        {/* muestra el contenido del formulario */}
        {children}
      </View>
    </View>
  );
}
