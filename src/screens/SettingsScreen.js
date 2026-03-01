import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useStore } from '../store/useStore';
import { colors } from '../theme/colors';
import BrutalistButton from '../components/BrutalistButton';
import BrutalistCard from '../components/BrutalistCard';
import BrutalistModal from '../components/BrutalistModal';

/**
 * PANTALLA: Ajustes (SettingsScreen)
 * Permite cambiar el tema de la app y guardar una ubicación de casa/base.
 */
export default function SettingsScreen() {
  // Datos globales del almacén
  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);
  const defaultLocation = useStore((state) => state.defaultLocation);
  const setDefaultLocation = useStore((state) => state.setDefaultLocation);
  const categories = useStore((state) => state.categories);
  const importData = useStore((state) => state.importData);

  const currentColors = colors[theme] || colors.light;
  const insets = useSafeAreaInsets();

  // Estados locales para carga y mensajes
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  // Obtiene la posición GPS actual del móvil y la guarda como "Hogar"
  const handleSaveLocation = async () => {
    setLoadingLoc(true);
    try {
      // Pedimos permiso para usar el GPS
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setModalTitle('PERMISO DENEGADO');
        setModalMessage('No se puede acceder a la ubicación sin permisos.');
        setModalVisible(true);
        setLoadingLoc(false);
        return;
      }

      // Obtenemos la latitud y longitud actuales
      let location = await Location.getCurrentPositionAsync({});
      setDefaultLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      setModalTitle('ÉXITO');
      setModalMessage('Tu ubicación "casa" se ha guardado correctamente.');
      setModalVisible(true);
    } catch (e) {
      setModalTitle('ERROR');
      setModalMessage('Ocurrió un error al intentar obtener el GPS.');
      setModalVisible(true);
    } finally {
      setLoadingLoc(false);
    }
  };

  // Exporta todos los datos a un archivo JSON y permite compartirlo
  const handleExportData = async () => {
    try {
      const dataToExport = {
        categories,
        defaultLocation,
        exportDate: new Date().toISOString(),
        version: "1.0.0"
      };

      const fileUri = `${FileSystem.documentDirectory}MAP_LOG_BACKUP.json`;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(dataToExport, null, 2));

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'EXPORTAR COPIA DE SEGURIDAD',
          UTI: 'public.json'
        });
      } else {
        setModalTitle('ERROR');
        setModalMessage('La función de compartir no está disponible en este dispositivo.');
        setModalVisible(true);
      }
    } catch (e) {
      console.error(e);
      setModalTitle('ERROR');
      setModalMessage('Ocurrió un error al exportar los datos.');
      setModalVisible(true);
    }
  };

  // Importa datos desde un archivo JSON seleccionado por el usuario
  const handleImportData = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const importedData = JSON.parse(fileContent);

      if (importedData.categories && Array.isArray(importedData.categories)) {
        Alert.alert(
          "RESTAURAR DATOS",
          "Esto reemplazará todos tus marcadores y carpetas actuales. ¿Deseas continuar?",
          [
            { text: "CANCELAR", style: "cancel" },
            {
              text: "CONFIRMAR",
              onPress: () => {
                importData(importedData.categories, importedData.defaultLocation || null);
                setModalTitle('ÉXITO');
                setModalMessage('Datos restaurados correctamente.');
                setModalVisible(true);
              }
            }
          ]
        );
      } else {
        throw new Error("Formato de archivo inválido");
      }
    } catch (e) {
      console.error(e);
      setModalTitle('ERROR');
      setModalMessage('El archivo seleccionado no es un backup válido de MAP LOG.');
      setModalVisible(true);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: Math.max(insets.bottom, 20) }
      ]}
    >
      {/* Sección para cambiar entre modo luz y oscuro */}
      <BrutalistCard title="APARIENCIA">
        <Text style={[styles.infoText, { color: currentColors.text }]}>
          TEMA ACTUAL: {theme.toUpperCase()}
        </Text>
        <BrutalistButton
          title={`CAMBIAR A TEMA ${theme === 'light' ? 'OSCURO' : 'CLARO'}`}
          onPress={toggleTheme}
        />
      </BrutalistCard>

      {/* Sección para configurar la ubicación por defecto */}
      <BrutalistCard title="UBICACIÓN">
        {defaultLocation ? (
          <Text style={[styles.infoText, { color: currentColors.text }]}>
            GUARDADA: {defaultLocation.latitude.toFixed(4)}, {defaultLocation.longitude.toFixed(4)}
          </Text>
        ) : (
          <Text style={[styles.infoText, { color: currentColors.text, opacity: 0.5 }]}>
            NINGUNA UBICACIÓN GUARDADA EN EL TELÉFONO
          </Text>
        )}
        <BrutalistButton
          title={loadingLoc ? "CARGANDO..." : "GUARDAR UBICACIÓN ACTUAL"}
          onPress={handleSaveLocation}
          primary={true}
        />
      </BrutalistCard>

      {/* Sección para exportar e importar datos */}
      <BrutalistCard title="GESTIÓN DE DATOS">
        <Text style={[styles.infoText, { color: currentColors.text }]}>
          COPIA DE SEGURIDAD (BACKUP)
        </Text>
        <View style={styles.buttonRow}>
          <BrutalistButton
            title="EXPORTAR"
            onPress={handleExportData}
            style={{ flex: 1, marginRight: 10 }}
          />
          <BrutalistButton
            title="IMPORTAR"
            onPress={handleImportData}
            style={{ flex: 1 }}
          />
        </View>
      </BrutalistCard>

      {/* Modal único para mostrar confirmaciones o errores */}
      <BrutalistModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalTitle}
        message={modalMessage}
        actions={[{ title: 'ACEPTAR', onPress: () => setModalVisible(false), primary: true }]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 16,
    fontWeight: 'bold',
  },
  placeholderBox: {
    borderWidth: 1,
    borderStyle: 'dashed', // Estilo de borde punteado
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  }
});

