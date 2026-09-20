// Config de Metro del banco de pruebas.
//
// unstable_enablePackageExports es OBLIGATORIO: mathsteps-experimental-fork@0.9.12
// publica exports condicionales y su build CJS esta roto
// ("exports is not defined in ES module scope"). Sin esta bandera, Metro resuelve
// la condicion 'require' y la app revienta al importar el paquete.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['import', 'require', 'react-native', 'default'];

module.exports = config;
