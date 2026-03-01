import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import { useStore } from './src/store/useStore';
import { colors } from './src/theme/colors';

/**
 * PUNTO DE ENTRADA: App.js
 * Es el primer archivo que se ejecuta. Configura la navegación y carga los datos guardados.
 */
export default function App() {
  // Conectamos con el almacén global
  const loadState = useStore((state) => state.loadState);
  const isLoaded = useStore((state) => state.isLoaded);
  const theme = useStore((state) => state.theme);
  const currentColors = colors[theme] || colors.light;

  // Al iniciar la app, cargamos los datos del almacenamiento local (Zustand + AsyncStorage)
  useEffect(() => {
    loadState();
  }, [loadState]);

  // Si aún no se han cargado los datos, no mostramos nada (evita parpadeos)
  if (!isLoaded) return null;

  return (
    // SafeAreaProvider nos ayuda a que la app respete el "notch" y bordes del móvil
    <SafeAreaProvider>
      <View style={[styles.container, { backgroundColor: currentColors.background }]}>
        {/* Barra de estado (la del reloj y batería) cambia según el tema */}
        <StatusBar
          style={theme === 'dark' ? 'light' : 'dark'}
          backgroundColor={currentColors.background}
        />
        {/* Cargamos el Navegador que contiene todas nuestras pantallas */}
        <AppNavigator />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, // Ocupa toda la pantalla
  },
});

