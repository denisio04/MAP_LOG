import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useStore } from '../store/useStore';
import { colors } from '../theme/colors';
import BrutalistButton from './BrutalistButton';

/**
 * COMPONENTE: BrutalistModal
 * Un modal personalizado que reemplaza los "Alert" nativos para mantener la estética.
 * 
 * PROPS:
 * - visible: Booleano para mostrar/ocultar.
 * - onClose: Función que se ejecuta al cerrar.
 * - title: Título en negrita y mayúsculas.
 * - message: Texto descriptivo opcional.
 * - actions: Lista de objetos { title, onPress, primary } para los botones inferiores.
 * - scrollable: Si es true, permite hacer scroll en el contenido interno.
 */
export default function BrutalistModal({
  visible,
  onClose,
  title,
  message,
  children,
  actions = [], // Ejemplo: [{ title: 'OK', onPress: () => {}, primary: true }]
  scrollable = false,
  forceColumn = false // Nueva prop para forzar botones en vertical
}) {
  // Obtenemos el tema actual del almacén global
  const theme = useStore((state) => state.theme);
  const currentColors = colors[theme] || colors.light;

  // Si scrollable es true, usamos ScrollView, si no, un View normal
  const BodyComponent = scrollable ? ScrollView : View;

  const isColumn = actions.length > 2 || forceColumn;

  return (
    <Modal
      visible={visible}
      transparent={true} // Para que se vea el fondo oscuro detrás
      animationType="none" // Estilo brutalista: sin animaciones suaves
      onRequestClose={onClose}
      statusBarTranslucent={true} // Permite que el fondo cubra también la barra de estado (Android)
    >
      <View style={styles.overlay}>
        <View style={[
          styles.content,
          {
            backgroundColor: currentColors.background,
            borderColor: currentColors.border
          }
        ]}>
          {/* Título del modal */}
          {title && (
            <Text style={[styles.title, { color: currentColors.text }]}>
              {title.toUpperCase()}
            </Text>
          )}

          {/* Cuerpo del modal (mensaje o contenido personalizado) */}
          <BodyComponent style={scrollable ? styles.scrollBody : styles.body}>
            {message && (
              <Text style={[styles.message, { color: currentColors.text }]}>
                {message}
              </Text>
            )}
            {children}
          </BodyComponent>

          {/* Botones de acción */}
          <View style={[
            styles.actions,
            // Si hay más de 2 botones o se fuerza vertical, los ponemos uno encima de otro
            { flexDirection: isColumn ? 'column' : 'row' }
          ]}>
            {actions.map((action, index) => (
              <BrutalistButton
                key={index}
                title={action.title}
                onPress={() => {
                  action.onPress();
                  // Por defecto, pulsar un botón cierra el modal, a menos que se diga lo contrario
                  if (action.autoClose !== false) onClose();
                }}
                primary={action.primary}
                style={[
                  // Si estamos en fila (<= 2 botones y no forzado), usamos flex: 1 para repartir el ancho
                  !isColumn && styles.actionButtonFlex,
                  // Ajustes de margen según la disposición (fila o columna)
                  !isColumn && index > 0 && { marginLeft: 10 },
                  isColumn && index > 0 && { marginTop: 10 }
                ]}
                // Si es un solo botón o están en columna, ocupan todo el ancho
                fullWidth={isColumn || actions.length === 1}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)', // Fondo oscuro semitransparente
    justifyContent: 'center',
  },
  content: {
    borderWidth: 1, // Borde muy grueso característico
    padding: 20,
    elevation: 20, // Sombra para Android
    margin: 20, // Espaciado desde los bordes de la pantalla
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 15,
    letterSpacing: 1,
  },
  body: {
    marginBottom: 20,
  },
  scrollBody: {
    maxHeight: 300, // Altura máxima antes de permitir scroll
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  actions: {
    justifyContent: 'space-between',
  },
  actionButtonFlex: {
    flex: 1,
  }
});

