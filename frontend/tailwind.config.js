/** @type {import('tailwindcss').Config} */
// configuración de los estilos de la app
module.exports = {
  // carpetas donde tailwind busca clases, si se crea otra carpeta con componentes hay que sumarla aca
  content: [
    // busca estilos en las pantallas de la carpeta app
    "./app/**/*.{js,jsx,ts,tsx}",
    // busca estilos en las piezas de la carpeta components
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  // preset de nativewind para que tailwind funcione en react native
  presets: [require("nativewind/preset")],
  // modo oscuro por clase: con "media" NativeWind lanza un error en la version web (la app no usa clases dark:)
  darkMode: "class",
  // diseño de la app: fuentes y colores
  theme: {
    // agrega fuentes y colores propios sin borrar los de siempre
    extend: {

      // fuentes propias, se usan como font-inter-regular, font-inter-medium y font-inter-bold
      fontFamily: {
        // letra normal
        'inter-regular':['Inter_400Regular', 'sans-serif'],
        // letra un poco más gruesa
        'inter-medium':['Inter_500Medium', 'sans-serif'],
        // letra en negrita
        'inter-bold':['Inter_700Bold', 'sans-serif'],
      },
      // colores propios, se usan como bg-color-action, text-color-menu, etc
      colors: {
        // aquí se cambia el color del menú
        "color-menu" : "#0F172A",      // azul casi negro del menu y fondos oscuros
        // aquí se cambia el color de los botones
        "color-action" : "#10B981",    // verde de los botones
        // aquí se cambia el color del fondo
        "bg-color" : "#F8FAFC",        // gris muy claro del fondo
        // aquí se cambia el color de los botones del menú apagados
        "color-inactive": "#94A3B8",   // gris de los botones del menu que no estan activos
        // aquí se cambia el color de las tarjetas del inicio
        "color-card-home": "#1E293B",  // gris oscuro para tarjetas

        // colores de cada banco (los mismos de constants/banks.ts) y de los formularios
        "bank-bancoestado": "#EA580C",
        // color de las tarjetas de CMR Falabella
        "bank-falabella": "#15803D",
        // color de las tarjetas de Banco Santander
        "bank-santander": "#DC2626",
        // color de las tarjetas MasterCard
        "bank-mastercard": "#1E293B",
        // color de las tarjetas Visa
        "bank-visa": "#1E3A8A",
        // color de fondo de las cajas para escribir
        "input-bg": "#F8FAFC",
        // color del borde de las cajas para escribir
        "input-border": "#CBD5E1",
      },
    },
  },
  // no se usan complementos extra
  plugins: [],
}
