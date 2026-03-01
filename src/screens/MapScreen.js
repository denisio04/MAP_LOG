import React, { useEffect, useRef, useState, useCallback } from 'react';
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
 * PANTALLA: Mapa (MapScreen) - VERSIÓN PREMIUM (MapLibre + Vector Tiles)
 * 
 * Experiencia similar a Google Maps: rotación, zoom suave, estilo limpio.
 * Sin necesidad de API Keys.
 */
export default function MapScreen({ route }) {
  const { items: initialItems, title, categoryId } = route.params || {};
  const webViewRef = useRef(null);

  const theme = useStore((state) => state.theme);
  const categories = useStore((state) => state.categories);
  const deleteItem = useStore((state) => state.deleteItem);
  const addItemToCategory = useStore((state) => state.addItemToCategory);
  const addCategory = useStore((state) => state.addCategory);
  const defaultLocation = useStore((state) => state.defaultLocation);

  const currentColors = colors[theme] || colors.light;
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState(initialItems || []);
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [isLoaderVisible, setIsLoaderVisible] = useState(true);

  // Modales
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [isNewCategoryModalVisible, setIsNewCategoryModalVisible] = useState(false);

  // Formulario de Nota
  const [selectedItem, setSelectedItem] = useState(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteDesc, setNewNoteDesc] = useState('');
  const [newNoteImage, setNewNoteImage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [lastCoordinate, setLastCoordinate] = useState(null);
  const [tempCategoryId, setTempCategoryId] = useState(categoryId || null);
  const [newCategoryName, setNewCategoryName] = useState('');

  // 1. Obtener ubicación del usuario en tiempo real
  useEffect(() => {
    let locationWatcher = null;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');

      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLocation(coords);

          locationWatcher = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
            (newLoc) => {
              const updatedCoords = { latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude };
              setUserLocation(updatedCoords);
              webViewRef.current?.postMessage(JSON.stringify({ type: 'userLocationUpdate', ...updatedCoords }));
            }
          );
        } catch (e) {
          console.log("Error obteniendo ubicación:", e);
        }
      }
    })();
    return () => locationWatcher?.remove();
  }, []);

  // 2. HTML del Mapa (MapLibre GL JS)
  const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
        <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
        <style>
          body { margin: 0; padding: 0; }
          #map { height: 100vh; width: 100vw; background: ${currentColors.background}; }
          .user-marker {
            width: 20px; height: 20px; border-radius: 50%;
            background: #007AFF; border: 3px solid white;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
          }
          .brutalist-marker {
            width: 30px; height: 30px;
            background: #F8D800; border: 3px solid black;
            box-shadow: 4px 4px 0px 0px #000;
            display: flex; align-items: center; justify-content: center;
            font-weight: 900; font-size: 16px; cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = new maplibregl.Map({
            container: 'map',
            style: {
              version: 8,
              sources: {
                'voyager': {
                  type: 'raster',
                  tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'],
                  tileSize: 256,
                  attribution: '© OSM'
                }
              },
              layers: [{ id: 'base-layer', type: 'raster', source: 'voyager' }]
            },
            center: [${defaultLocation?.longitude || 0}, ${defaultLocation?.latitude || 0}],
            zoom: 14,
            maxZoom: 20,
            attributionControl: false
          });

          map.on('load', () => {
             if ('${theme}' === 'dark') {
              map.setPaintProperty('base-layer', 'raster-brightness-max', 0.6);
            }
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
          });

          const markers = {};
          let userMarker = null;

          function updateMarkers(items) {
            Object.values(markers).forEach(m => m.remove());
            items.forEach(item => {
              const el = document.createElement('div');
              el.className = 'brutalist-marker';
              el.innerHTML = '📌';
              el.onclick = () => window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', item }));
              markers[item.id] = new maplibregl.Marker(el).setLngLat([item.longitude, item.latitude]).addTo(map);
            });
            if (items.length > 0) {
              const bounds = new maplibregl.LngLatBounds();
              items.forEach(i => bounds.extend([i.longitude, i.latitude]));
              map.fitBounds(bounds, { padding: 50, maxZoom: 16 });
            }
          }

          map.on('contextmenu', (e) => {
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'mapLongPress', 
              coordinate: { lat: e.lngLat.lat, lng: e.lngLat.lng } 
            }));
          });

          window.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'syncMarkers') updateMarkers(data.items);
            if (data.type === 'centerOnUser') map.flyTo({ center: [data.longitude, data.latitude], zoom: 17, duration: 1000 });
            if (data.type === 'userLocationUpdate') {
              if (!userMarker) {
                const el = document.createElement('div');
                el.className = 'user-marker';
                userMarker = new maplibregl.Marker(el).setLngLat([data.longitude, data.latitude]).addTo(map);
              } else {
                userMarker.setLngLat([data.longitude, data.latitude]);
              }
            }
          });
        </script>
      </body>
    </html>
  `;

  // 3. Comunicación WebView <-> React Native
  const onMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        setIsLoaderVisible(false);
        webViewRef.current?.postMessage(JSON.stringify({ type: 'syncMarkers', items }));
        if (userLocation) webViewRef.current?.postMessage(JSON.stringify({ type: 'userLocationUpdate', ...userLocation }));
      } else if (data.type === 'markerPress') {
        const item = data.item;
        const dateStr = item.createdAt ? `\nFECHA: ${new Date(item.createdAt).toLocaleDateString()}` : '';
        setSelectedItem({ ...item, dateDisplay: dateStr });
        setIsOptionsModalVisible(true);
      } else if (data.type === 'mapLongPress') {
        const coords = { latitude: data.coordinate.lat, longitude: data.coordinate.lng };
        setLastCoordinate(coords);
        if (!categoryId) setIsCategoryModalVisible(true);
        else { setTempCategoryId(categoryId); prepareNoteModal(false); }
      }
    } catch (e) {
      console.error("WebView error:", e);
    }
  }, [items, userLocation, categoryId]);

  const centerOnUser = () => {
    if (userLocation) webViewRef.current?.postMessage(JSON.stringify({ type: 'centerOnUser', ...userLocation }));
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) setNewNoteImage(result.assets[0].uri);
  };

  const handleSaveNote = () => {
    if (!newNoteTitle.trim()) return;
    const targetCatId = tempCategoryId;
    let updatedItems = [];
    if (isEditing) {
      const updatedData = { title: newNoteTitle.trim(), description: newNoteDesc.trim(), imageUri: newNoteImage };
      useStore.getState().updateItem(targetCatId, editingItemId, updatedData);
      updatedItems = items.map(i => i.id === editingItemId ? { ...i, ...updatedData } : i);
    } else {
      const newItem = {
        id: `item_${Date.now()}`,
        title: newNoteTitle.trim(),
        description: newNoteDesc.trim(),
        latitude: lastCoordinate.latitude,
        longitude: lastCoordinate.longitude,
        imageUri: newNoteImage,
        createdAt: Date.now()
      };
      addItemToCategory(targetCatId, newItem);
      updatedItems = [...items, newItem];
    }
    setItems(updatedItems);
    setIsNoteModalVisible(false);
  };

  const prepareNoteModal = (editing) => {
    setIsEditing(editing);
    if (!editing) {
      setNewNoteTitle(''); setNewNoteDesc(''); setNewNoteImage(null);
    } else if (selectedItem) {
      setNewNoteTitle(selectedItem.title);
      setNewNoteDesc(selectedItem.description || '');
      setNewNoteImage(selectedItem.imageUri || null);
      setEditingItemId(selectedItem.id);
    }
    setIsNoteModalVisible(true);
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    const newId = `cat_${Date.now()}`;
    addCategory({ id: newId, title: newCategoryName.trim(), items: [] });
    setTempCategoryId(newId);
    setIsNewCategoryModalVisible(false);
    prepareNoteModal(false);
  };

  useEffect(() => {
    if (!isLoaderVisible) webViewRef.current?.postMessage(JSON.stringify({ type: 'syncMarkers', items }));
  }, [items, isLoaderVisible]);

  return (
    <View style={[styles.container, { backgroundColor: currentColors.background }]}>
      {isLoaderVisible && (
        <View style={[styles.loader, { backgroundColor: currentColors.background }]}>
          <ActivityIndicator size="large" color={currentColors.text} />
          <Text style={[styles.loaderText, { color: currentColors.text }]}>PRECISIÓN VECTORIAL...</Text>
        </View>
      )}

      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        onMessage={onMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        style={{ flex: 1, opacity: isLoaderVisible ? 0 : 1 }}
      />

      <TouchableOpacity onPress={centerOnUser} style={[styles.fab, { backgroundColor: '#F8D800' }]}>
        <Text style={{ fontSize: 24, fontWeight: '900' }}>⦿</Text>
      </TouchableOpacity>

      <View style={[styles.footer, { borderColor: currentColors.border, backgroundColor: currentColors.background, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={[styles.footerText, { color: currentColors.text }]}>{title || 'MAPA GLOBAL'}</Text>
        <Text style={[styles.footerCount, { color: currentColors.text }]}>{items.length} NOTAS</Text>
      </View>

      {/* MODALES */}
      <BrutalistModal
        visible={isNoteModalVisible}
        onClose={() => setIsNoteModalVisible(false)}
        title={isEditing ? 'EDITAR NOTA' : 'NUEVA NOTA'}
        actions={[{ title: 'CANCELAR', onPress: () => setIsNoteModalVisible(false) }, { title: 'GUARDAR', onPress: handleSaveNote, primary: true }]}
      >
        <TextInput style={[styles.input, { color: currentColors.text, borderColor: currentColors.border }]} placeholder="TÍTULO" placeholderTextColor={`${currentColors.text}80`} value={newNoteTitle} onChangeText={setNewNoteTitle} />
        <TextInput style={[styles.input, styles.textArea, { color: currentColors.text, borderColor: currentColors.border }]} placeholder="DETALLES..." placeholderTextColor={`${currentColors.text}80`} value={newNoteDesc} onChangeText={setNewNoteDesc} multiline />
        <View style={styles.imageSection}>
          {newNoteImage && <Image source={{ uri: newNoteImage }} style={[styles.preview, { borderColor: currentColors.border }]} />}
          <BrutalistButton title={newNoteImage ? 'CAMBIAR FOTO' : 'AÑADIR FOTO'} onPress={pickImage} />
        </View>
      </BrutalistModal>

      <BrutalistModal
        visible={isOptionsModalVisible}
        onClose={() => setIsOptionsModalVisible(false)}
        title="UBICACIÓN"
        actions={[
          { title: 'GPS', onPress: () => { Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${selectedItem.latitude},${selectedItem.longitude}`); setIsOptionsModalVisible(false); } },
          { title: 'EDITAR', onPress: () => { setIsOptionsModalVisible(false); prepareNoteModal(true); } },
          { title: 'BORRAR', onPress: () => { deleteItem(tempCategoryId || categoryId, selectedItem.id); setItems(items.filter(i => i.id !== selectedItem.id)); setIsOptionsModalVisible(false); } },
          { title: 'CERRAR', onPress: () => setIsOptionsModalVisible(false) }
        ]}
      >
        <Text style={{ fontWeight: 'bold', color: currentColors.text, fontSize: 18 }}>{selectedItem?.title.toUpperCase()}</Text>
        <Text style={{ color: currentColors.text, marginTop: 5 }}>{selectedItem?.description}</Text>
        {selectedItem?.imageUri && <Image source={{ uri: selectedItem.imageUri }} style={[styles.itemImage, { borderColor: currentColors.border }]} />}
      </BrutalistModal>

      <BrutalistModal
        visible={isCategoryModalVisible}
        onClose={() => setIsCategoryModalVisible(false)}
        title="CARPETA"
        actions={[{ title: '+ NUEVA', onPress: () => { setIsCategoryModalVisible(false); setIsNewCategoryModalVisible(true); }, primary: true }, { title: 'CERRAR', onPress: () => setIsCategoryModalVisible(false) }]}
      >
        {categories.map(cat => (
          <TouchableOpacity key={cat.id} style={[styles.catItem, { borderColor: currentColors.border }]} onPress={() => { setTempCategoryId(cat.id); setIsCategoryModalVisible(false); prepareNoteModal(false); }}>
            <Text style={{ fontWeight: '900', color: currentColors.text }}>{cat.title.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </BrutalistModal>

      <BrutalistModal
        visible={isNewCategoryModalVisible}
        onClose={() => setIsNewCategoryModalVisible(false)}
        title="NUEVA CARPETA"
        actions={[{ title: 'CREAR', onPress: handleCreateCategory, primary: true }, { title: 'VOLVER', onPress: () => setIsNewCategoryModalVisible(false) }]}
      >
        <TextInput style={[styles.input, { color: currentColors.text, borderColor: currentColors.border }]} placeholder="NOMBRE..." placeholderTextColor={`${currentColors.text}80`} value={newCategoryName} onChangeText={setNewCategoryName} />
      </BrutalistModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  loaderText: { marginTop: 15, fontWeight: '900', letterSpacing: 1 },
  fab: { position: 'absolute', right: 20, bottom: 90, width: 60, height: 60, borderWidth: 4, borderColor: 'black', justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 6, height: 6 }, shadowOpacity: 1, shadowRadius: 0 },
  footer: { padding: 15, borderTopWidth: 3, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 16, fontWeight: '900' },
  footerCount: { fontSize: 14, fontWeight: 'bold' },
  input: { borderWidth: 3, padding: 15, fontSize: 18, fontWeight: '900', marginBottom: 15 },
  textArea: { height: 100, textAlignVertical: 'top' },
  imageSection: { marginTop: 10 },
  preview: { width: '100%', height: 150, borderWidth: 3, marginBottom: 10 },
  itemImage: { width: '100%', height: 200, borderWidth: 3, marginTop: 15 },
  catItem: { borderWidth: 3, padding: 16, marginVertical: 6 },
});
