import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, View } from 'react-native';
import { useStore } from '../store/useStore';
import { colors } from '../theme/colors';

/**
 * COMPONENTE: Botón Brutalista (BrutalistButton)
 * Un botón con bordes rectos, sin redondeados, siguiendo la estética de la app.
 */
export default function BrutalistButton({
  title,       // Texto que se muestra en el botón
  onPress,     // Función que se ejecuta al pulsar
  style,       // Estilos extra para el contenedor del botón
  textStyle,   // Estilos extra para el texto
  primary = false, // Si es true, usa el color principal de la app
  fullWidth = true // Si es true, el botón ocupa todo el ancho disponible
}) {
  const theme = useStore((state) => state.theme);
  const currentColors = colors[theme] || colors.light;

  // Calculamos los colores según si es un botón "primario" o normal
  const bgColor = primary ? currentColors.primary : currentColors.background;
  const textColor = primary ? currentColors.primaryText : currentColors.text;
  const borderColor = currentColors.border;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
          width: fullWidth ? '100%' : 'auto',
        },
        style
      ]}
    >
      <View style={styles.contentContainer}>
        <Text style={[styles.text, { color: textColor }, textStyle]}>
          {title.toUpperCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 0, // Regla estricta: nada de bordes redondeados
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 2,
    // Usamos tipografía de tipo "máquina de escribir" según la plataforma
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
  }
});

