// https://docs.expo.dev/guides/using-eslint/
// trae la función para armar la configuración del revisor de código
const { defineConfig } = require('eslint/config');
// reglas de eslint que recomienda expo
const expoConfig = require('eslint-config-expo/flat');

// configuración del revisor que busca errores en el código
module.exports = defineConfig([
  // usa las reglas de Expo
  expoConfig,
  // ajustes propios de este proyecto
  {
    // no revisa la carpeta dist, que es la app ya compilada
    ignores: ['dist/*'],
  },
]);
