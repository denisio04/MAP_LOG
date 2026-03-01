import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useStore } from '../store/useStore';
import { colors } from '../theme/colors';

/**
 * COMPONENTE: Tarjeta Brutalista (BrutalistCard)
 * Contenedor con borde grueso para mostrar información de carpetas o ajustes.
 */
export default function BrutalistCard({
  title,         // Título de la tarjeta
  subtitle,      // Subtítulo (ej. "3 ÍTEMS")
  onPress,       // Si se pasa, la tarjeta entera es pulsable
  style,         // Estilos extra
  children,      // Contenido que va dentro de la tarjeta
  actionText,    // Texto para un botón de acción secundario (ej. "VER")
  onActionPress, // Función para ese botón de acción
  onDeletePress  // Función para el botón de borrar (si existe)
}) {
  const theme = useStore((state) => state.theme);
  const currentColors = colors[theme] || colors.light;

  // Si tiene onPress, se comporta como un botón (TouchableOpacity), si no, como una vista (View)
  const CardContainer = onPress ? TouchableOpacity : View;

  return (
    <CardContainer
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: currentColors.background,
          borderColor: currentColors.border,
        },
        style
      ]}
    >
      <View style={styles.header}>
        {title && (
          <Text style={[styles.title, { color: currentColors.text }]}>
            {title.toUpperCase()}
          </Text>
        )}
        {/* Botón de acción opcional (ej. "VER") */}
        {actionText && onActionPress && (
          <TouchableOpacity onPress={onActionPress} style={styles.actionBtn}>
            <Text style={[styles.actionText, { color: currentColors.text }]}>
              {actionText.toUpperCase()}
            </Text>
          </TouchableOpacity>
        )}
        {/* Botón de borrar opcional */}
        {onDeletePress && (
          <TouchableOpacity onPress={onDeletePress} style={[styles.actionBtn, { borderBottomColor: '#FF0000' }]}>
            <Text style={[styles.actionText, { color: '#FF0000' }]}>
              BORRAR
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {subtitle && (
        <Text style={[styles.subtitle, { color: currentColors.text }]}>
          {subtitle}
        </Text>
      )}

      {/* Renderiza cualquier contenido extra pasado como hijo */}
      {children && <View style={styles.children}>{children}</View>}
    </CardContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 0, // Regla estricta
    padding: 12,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    opacity: 0.8,
  },
  actionBtn: {
    borderBottomWidth: 1,
    paddingBottom: 2,
    marginLeft: 10,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
    letterSpacing: 1,
  },
  children: {
    marginTop: 16,
  }
});

