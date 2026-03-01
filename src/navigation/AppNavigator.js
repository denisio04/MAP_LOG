import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from '../store/useStore';
import { colors } from '../theme/colors';

import MainScreen from '../screens/MainScreen';
import CategoryDetailScreen from '../screens/CategoryDetailScreen';
import MapScreen from '../screens/MapScreen';
import SettingsScreen from '../screens/SettingsScreen';

/**
 * NAVEGACIÓN: AppNavigator
 * Aquí se definen todas las pantallas de la app y cómo se mueven entre ellas.
 */
const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const theme = useStore((state) => state.theme);
  const currentColors = colors[theme] || colors.light;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          // Estilo general de la barra superior (Header)
          headerStyle: {
            backgroundColor: currentColors.background,
          },
          headerTintColor: currentColors.text,
          headerTitleStyle: {
            fontWeight: '900',
            letterSpacing: 1,
            textTransform: 'uppercase',
          },
          headerShadowVisible: false, // Sin sombra bajo el header
          contentStyle: {
            backgroundColor: currentColors.background,
            borderTopWidth: 2,
            borderTopColor: currentColors.border,
          }
        }}
      >
        {/* Pantalla 1: Lista de Carpetas */}
        <Stack.Screen
          name="Main"
          component={MainScreen}
          options={{ title: 'CARPETAS' }}
        />
        {/* Pantalla 2: Ítems dentro de una carpeta */}
        <Stack.Screen
          name="CategoryDetail"
          component={CategoryDetailScreen}
          options={({ route }) => ({ title: route.params?.title?.toUpperCase() || 'DETALLE' })}
        />
        {/* Pantalla 3: El Mapa (Global o de una Carpeta) */}
        <Stack.Screen
          name="Map"
          component={MapScreen}
          options={{ title: 'MAPA' }}
        />
        {/* Pantalla 4: Ajustes de Tema y Ubicación */}
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'AJUSTES' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

