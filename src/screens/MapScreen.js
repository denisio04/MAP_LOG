import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TextInput, TouchableOpacity, Linking, Share, Image, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store/useStore';
import { colors } from '../theme/colors';
import BrutalistModal from '../components/BrutalistModal';
import BrutalistButton from '../components/BrutalistButton';

/**
 * PANTALLA: Mapa (MapScreen) - VERSIÓN OPENSTREETMAP (WebView)
 * 
 * NOTA: Se migró de react-native-maps a WebView + Leaflet para evitar 
 * la necesidad de Google Maps API Keys que requieren tarjeta de crédito.
 */
export default function MapScreen({ route }) {
  const { items: initialItems, title, categoryId } = route.params || {};
  const webViewRef = useRef(null);

  const theme = useStore((state) => state.theme);
  const categories = useStore((state) => state.categories);
  const deleteItem = useStore((state) => state.deleteItem);
  const addItemToCategory = useStore((state) => state.addItemToCategory);
  const defaultLocation = useStore((state) => state.defaultLocation);

  const currentColors = colors[theme] || colors.light;
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState(initialItems || []);
  const [locationPermission, setLocationPermission] = useState(null);
  const [isLoaderVisible, setIsLoaderVisible] = useState(true);

  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);
  const [isNewCategoryModalVisible, setIsNewCategoryModalVisible] = useState(false);

  const [errorHeader, setErrorHeader] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteDesc, setNewNoteDesc] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [lastCoordinate, setLastCoordinate] = useState(null);
  const [tempCategoryId, setTempCategoryId] = useState(categoryId || null);
  const [newNoteImage, setNewNoteImage] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    })();
  }, []);

  // Generar HTML del Mapa (Leaflet + OpenStreetMap)
  const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; background: ${currentColors.background}; }
          #map { height: 100vh; width: 100vw; border: none; }
          .leaflet-container { background: ${currentColors.background} !important; }
          .leaflet-tile-pane { filter: ${theme === 'dark' ? 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)' : 'none'}; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${defaultLocation?.latitude || 0}, ${defaultLocation?.longitude || 0}], 13);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

          const markers = {};

          function updateMarkers(newItems) {
            // Limpiar marcadores viejos
            Object.values(markers).forEach(m => map.removeLayer(m));
            
            newItems.forEach(item => {
              const marker = L.marker([item.latitude, item.longitude]).addTo(map);
              marker.on('click', () => {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', item }));
              });
              markers[item.id] = marker;
            });

            if (newItems.length > 0) {
              const group = new L.featureGroup(Object.values(markers));
              map.fitBounds(group.getBounds().pad(0.1));
            }
          }

          map.on('contextmenu', (e) => {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapLongPress', coordinate: e.latlng }));
          });

          window.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'syncMarkers') {
              updateMarkers(data.items);
            }
          });

          // Avisar que el mapa está listo
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
        </script>
      </body>
    </html>
  `;

  const onMessage = (event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'ready') {
      setIsLoaderVisible(false);
      webViewRef.current.postMessage(JSON.stringify({ type: 'syncMarkers', items }));
    } else if (data.type === 'markerPress') {
      handleMarkerPress(data.item);
    } else if (data.type === 'mapLongPress') {
      handleMapLongPress(data.coordinate);
    }
  };

  const handleMapLongPress = (coordinate) => {
    const coords = { latitude: coordinate.lat, longitude: coordinate.lng };
    setLastCoordinate(coords);
    if (!categoryId) {
      setIsCategoryModalVisible(true);
    } else {
      setTempCategoryId(categoryId);
      prepareNoteModal(false);
    }
  };

  const handleMarkerPress = (item) => {
    const dateStr = item.createdAt
      ? `\nFECHA: ${new Date(item.createdAt).toLocaleDateString()} - ${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '';
    setSelectedItem({ ...item, dateDisplay: dateStr });
    setIsOptionsModalVisible(true);
  };

  const confirmDeleteMarker = () => {
    const item = selectedItem;
    const category = categories.find(cat => cat.items.some(i => i.id === item.id));
    if (category) {
      deleteItem(category.id, item.id);
      const updatedItems = items.filter(i => i.id !== item.id);
      setItems(updatedItems);
      webViewRef.current.postMessage(JSON.stringify({ type: 'syncMarkers', items: updatedItems }));
    }
    setIsOptionsModalVisible(false);
  };

  const startEditMarker = () => {
    const item = selectedItem;
    const category = categories.find(cat => cat.items.some(i => i.id === item.id));
    setEditingItemId(item.id);
    setTempCategoryId(category?.id || null);
    setIsEditing(true);
    setNewNoteTitle(item.title);
    setNewNoteDesc(item.description || '');
    setNewNoteImage(item.imageUri || null);
    setLastCoordinate({ latitude: item.latitude, longitude: item.longitude });
    setIsOptionsModalVisible(false);
    setIsNoteModalVisible(true);
  };

  const handleOpenGPS = () => {
    if (!selectedItem) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${selectedItem.latitude},${selectedItem.longitude}`;
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    setIsOptionsModalVisible(false);
  };

  const handleShareItem = async () => {
    if (!selectedItem) return;
    try {
      const message = `📍 ${selectedItem.title.toUpperCase()}\n\n${selectedItem.description || ''}\n\nUbicación: https://www.google.com/maps/search/?api=1&query=${selectedItem.latitude},${selectedItem.longitude}`;
      await Share.share({ message });
      setIsOptionsModalVisible(false);
    } catch (error) {
      console.error(error.message);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      setNewNoteImage(result.assets[0].uri);
    }
  };

  const prepareNoteModal = (editing) => {
    setIsEditing(editing);
    if (!editing) {
      setEditingItemId(null);
      setNewNoteTitle('');
      setNewNoteDesc('');
      setNewNoteImage(null);
    }
    setIsNoteModalVisible(true);
  };

  const handleSaveNote = () => {
    if (!newNoteTitle.trim()) {
      setErrorHeader("ERROR");
      setErrorMessage("EL TÍTULO ES REQUERIDO");
      setIsErrorModalVisible(true);
      return;
    }
    const targetCategoryId = tempCategoryId;
    if (!targetCategoryId) {
      setErrorHeader("ERROR");
      setErrorMessage("NO SE PUDO DETERMINAR LA CATEGORÍA.");
      setIsErrorModalVisible(true);
      return;
    }

    let updatedItems = [];
    if (isEditing) {
      const updatedData = {
        title: newNoteTitle.trim(),
        description: newNoteDesc.trim(),
        imageUri: newNoteImage
      };
      useStore.getState().updateItem(targetCategoryId, editingItemId, updatedData);
      updatedItems = items.map(item => item.id === editingItemId ? { ...item, ...updatedData } : item);
    } else {
      const newId = `item_${Date.now()}`;
      const newItem = {
        id: newId,
        title: newNoteTitle.trim(),
        description: newNoteDesc.trim(),
        latitude: lastCoordinate.latitude,
        longitude: lastCoordinate.longitude,
        imageUri: newNoteImage,
        createdAt: Date.now()
      };
      addItemToCategory(targetCategoryId, newItem);
      updatedItems = [...items, newItem];
    }

    setItems(updatedItems);
    webViewRef.current.postMessage(JSON.stringify({ type: 'syncMarkers', items: updatedItems }));
    setIsNoteModalVisible(false);
  };

  const handleSelectCategory = (id) => {
    setTempCategoryId(id);
    setIsCategoryModalVisible(false);
    prepareNoteModal(false);
  };

  const handleCreateNewCategoryFromMap = () => {
    setIsCategoryModalVisible(false);
    setNewCategoryName('');
    setIsNewCategoryModalVisible(true);
  };

  const confirmCreateCategoryFromMap = () => {
    if (!newCategoryName.trim()) {
      setErrorHeader("ERROR");
      setErrorMessage("EL NOMBRE ES REQUERIDO");
      setIsErrorModalVisible(true);
      return;
    }
    const newId = `cat_${Date.now()}`;
    useStore.getState().addCategory({ id: newId, title: newCategoryName.trim(), items: [] });
    handleSelectCategory(newId);
    setIsNewCategoryModalVisible(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: currentColors.background }]}>
      {locationPermission === false && (
        <View style={[styles.warningBanner, { backgroundColor: currentColors.text }]}>
          <Text style={[styles.warningText, { color: currentColors.background }]}>
            PERMISO DE UBICACIÓN DENEGADO
          </Text>
        </View>
      )}

      {isLoaderVisible && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={currentColors.text} />
          <Text style={{ marginTop: 10, color: currentColors.text, fontWeight: 'bold' }}>CARGANDO MAPA...</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        onMessage={onMessage}
        style={{ flex: 1, opacity: isLoaderVisible ? 0 : 1 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />

      <View style={[
        styles.footer,
        {
          borderColor: currentColors.border,
          backgroundColor: currentColors.background,
          paddingBottom: Math.max(insets.bottom, 12)
        }
      ]}>
        <Text style={[styles.footerTitle, { color: currentColors.text }]}>
          {title ? title : 'EXPLORADOR DE MAPA'}
        </Text>
        <Text style={[styles.footerCount, { color: currentColors.text }]}>
          {items ? `${items.length} MARCADORES` : '0 MARCADORES'}
        </Text>
      </View>

      <BrutalistModal
        visible={isNoteModalVisible}
        onClose={() => setIsNoteModalVisible(false)}
        title={isEditing ? 'EDITAR NOTA' : 'NUEVA NOTA'}
        actions={[
          { title: 'CANCELAR', onPress: () => setIsNoteModalVisible(false) },
          { title: 'GUARDAR', onPress: handleSaveNote, primary: true }
        ]}
      >
        <TextInput
          style={[styles.modalInput, { color: currentColors.text, borderColor: currentColors.border }]}
          placeholder="TÍTULO"
          placeholderTextColor={`${currentColors.text}80`}
          value={newNoteTitle}
          onChangeText={setNewNoteTitle}
          autoFocus={true}
        />
        <TextInput
          style={[styles.modalInput, styles.textArea, { color: currentColors.text, borderColor: currentColors.border }]}
          placeholder="INFORMACIÓN ADICIONAL..."
          placeholderTextColor={`${currentColors.text}80`}
          value={newNoteDesc}
          onChangeText={setNewNoteDesc}
          multiline={true}
          numberOfLines={4}
        />
        <View style={styles.imagePickerArea}>
          {newNoteImage && (
            <Image source={{ uri: newNoteImage }} style={[styles.previewImage, { borderColor: currentColors.border }]} />
          )}
          <BrutalistButton
            title={newNoteImage ? "CAMBIAR FOTO" : "AÑADIR FOTO"}
            onPress={pickImage}
          />
          {newNoteImage && (
            <TouchableOpacity onPress={() => setNewNoteImage(null)} style={{ marginTop: 10 }}>
              <Text style={[styles.deleteLinkText, { color: '#FF0000', textAlign: 'center' }]}>QUITAR FOTO</Text>
            </TouchableOpacity>
          )}
        </View>
      </BrutalistModal>

      <BrutalistModal
        visible={isCategoryModalVisible}
        onClose={() => setIsCategoryModalVisible(false)}
        title="SELECCIONAR CARPETA"
        scrollable={true}
        forceColumn={true}
        actions={[
          { title: 'CANCELAR', onPress: () => setIsCategoryModalVisible(false) },
          { title: '+ NUEVA CARPETA', onPress: handleCreateNewCategoryFromMap, primary: true, autoClose: false }
        ]}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.catOption, { borderColor: currentColors.border }]}
            onPress={() => handleSelectCategory(cat.id)}
          >
            <Text style={[styles.catOptionText, { color: currentColors.text }]}>
              {cat.title.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </BrutalistModal>

      <BrutalistModal
        visible={isOptionsModalVisible}
        onClose={() => setIsOptionsModalVisible(false)}
        title="OPCIONES"
        message={selectedItem ? `¿QUÉ DESEAS HACER CON "${selectedItem.title.toUpperCase()}"?${selectedItem.dateDisplay || ''}` : ''}
        actions={[
          { title: 'GPS', onPress: handleOpenGPS },
          { title: 'COMPARTIR', onPress: handleShareItem },
          { title: 'EDITAR', onPress: startEditMarker },
          { title: 'ELIMINAR', onPress: confirmDeleteMarker, primary: false },
          { title: 'CANCELAR', onPress: () => setIsOptionsModalVisible(false) }
        ]}
      >
        {selectedItem && selectedItem.imageUri && (
          <Image
            source={{ uri: selectedItem.imageUri }}
            style={[styles.markerImage, { borderColor: currentColors.border }]}
          />
        )}
        <View style={{ height: 10 }} />
      </BrutalistModal>

      <BrutalistModal
        visible={isErrorModalVisible}
        onClose={() => setIsErrorModalVisible(false)}
        title={errorHeader}
        message={errorMessage}
        actions={[
          { title: 'ACEPTAR', onPress: () => setIsErrorModalVisible(false), primary: true }
        ]}
      />

      <BrutalistModal
        visible={isNewCategoryModalVisible}
        onClose={() => setIsNewCategoryModalVisible(false)}
        title="NUEVA CARPETA"
        actions={[
          { title: 'CANCELAR', onPress: () => setIsNewCategoryModalVisible(false) },
          { title: 'CREAR', onPress: confirmCreateCategoryFromMap, primary: true }
        ]}
      >
        <TextInput
          style={[styles.modalInput, { color: currentColors.text, borderColor: currentColors.border }]}
          placeholder="NOMBRE DE CARPETA..."
          placeholderTextColor={`${currentColors.text}80`}
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          autoFocus={true}
        />
      </BrutalistModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 1, backgroundColor: 'white' },
  warningBanner: { padding: 10, alignItems: 'center' },
  warningText: { fontWeight: 'bold', fontSize: 12 },
  footer: { padding: 12, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerTitle: { fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  footerCount: { fontSize: 12, fontWeight: 'bold' },
  modalInput: { borderWidth: 1, padding: 15, fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  textArea: { height: 100, textAlignVertical: 'top' },
  catOption: { borderWidth: 1, padding: 15, marginHorizontal: 20, marginVertical: 10 },
  catOptionText: { fontWeight: 'bold', fontSize: 16 },
  imagePickerArea: { marginTop: 10 },
  previewImage: { width: '100%', height: 120, marginBottom: 10, borderWidth: 1 },
  markerImage: { width: '100%', height: 150, borderWidth: 1 },
  deleteLinkText: { fontSize: 12, fontWeight: 'bold', textDecorationLine: 'underline' }
});

