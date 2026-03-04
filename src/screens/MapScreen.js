import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TextInput, TouchableOpacity, Linking, Share, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store/useStore';
import { colors } from '../theme/colors';
import BrutalistModal from '../components/BrutalistModal';
import BrutalistButton from '../components/BrutalistButton';

/**
 * PANTALLA: Mapa (MapScreen)
 * Gestiona la visualización de marcadores, creación de notas desde el mapa
 * y la selección de categorías para las nuevas notas.
 */
export default function MapScreen({ route }) {
  // Parámetros recibidos por la navegación (pueden ser todos los ítems o solo algunos)
  const { items: initialItems, title, categoryId } = route.params || {};

  const mapRef = useRef(null); // Referencia para controlar el Mapa (zoom, posición)

  // Datos globales del almacén (useStore)
  const theme = useStore((state) => state.theme);
  const categories = useStore((state) => state.categories);
  const deleteItem = useStore((state) => state.deleteItem);
  const addItemToCategory = useStore((state) => state.addItemToCategory);
  const defaultLocation = useStore((state) => state.defaultLocation);

  const currentColors = colors[theme] || colors.light;
  const insets = useSafeAreaInsets();

  // ESTADOS LOCALES
  const [items, setItems] = useState(initialItems || []); // Marcadores a mostrar
  const [locationPermission, setLocationPermission] = useState(null); // ¿Tenemos permiso de GPS?
  const [isMapReady, setIsMapReady] = useState(false); // ¿El mapa terminó de cargar?

  // Estados para controlar los 5 tipos de modales diferentes
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);       // Crear/Editar nota
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false); // Elegir carpeta
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);   // Opciones al tocar marcador
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);       // Errores
  const [isNewCategoryModalVisible, setIsNewCategoryModalVisible] = useState(false); // Crear carpeta desde mapa

  const [errorHeader, setErrorHeader] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Estados para el formulario de la nota
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteProducts, setNewNoteProducts] = useState([]); // Array de productos
  const [newProductName, setNewProductName] = useState(''); // Input temporal
  const [newProductPrice, setNewProductPrice] = useState(''); // Input temporal
  const [newCategoryName, setNewCategoryName] = useState('');
  const [lastCoordinate, setLastCoordinate] = useState(null); // Dónde pulsaste en el mapa
  const [tempCategoryId, setTempCategoryId] = useState(categoryId || null); // Carpeta destino temporal

  const [newNoteImage, setNewNoteImage] = useState(null); // URI de la imagen de la nota
  const [isPhotoChoiceVisible, setIsPhotoChoiceVisible] = useState(false);

  // Actualiza los ítems si cambian los parámetros de ruta
  useEffect(() => {
    setItems(initialItems || []);
  }, [initialItems]);

  // Solicita permisos de ubicación al entrar a la pantalla
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    })();
  }, []);

  // Lógica para enfocar el mapa cuando hay marcadores o una ubicación por defecto
  useEffect(() => {
    if (isMapReady && items && items.length > 0 && mapRef.current) {
      if (items.length === 1) {
        // Si hay un solo ítem, hacemos zoom sobre él
        const item = items[0];
        mapRef.current.animateToRegion({
          latitude: item.latitude,
          longitude: item.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } else {
        // Si hay varios, ajustamos la vista para que se vean TODOS
        const coordinates = items.map(item => ({
          latitude: item.latitude,
          longitude: item.longitude,
        }));

        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    } else if (isMapReady && defaultLocation && mapRef.current && (!items || items.length === 0)) {
      // Si no hay ítems, vamos a la ubicación guardada por defecto (ej. tu casa)
      mapRef.current.animateToRegion({
        latitude: defaultLocation.latitude,
        longitude: defaultLocation.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    }
  }, [items, defaultLocation, isMapReady]);

  // Se ejecuta al tocar el "botón" de un marcador
  const handleMarkerPress = (item) => {
    // Calculamos la fecha para mostrarla en el modal de opciones
    const dateStr = item.createdAt
      ? `\nFECHA: ${new Date(item.createdAt).toLocaleDateString()} - ${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '';

    setSelectedItem({ ...item, dateDisplay: dateStr });
    setIsOptionsModalVisible(true);
  };

  // Borra un marcador del mapa y de la base de datos
  const confirmDeleteMarker = () => {
    const item = selectedItem;
    // Buscamos a qué categoría pertenece para poder borrarlo
    const category = categories.find(cat => cat.items.some(i => i.id === item.id));
    if (category) {
      deleteItem(category.id, item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
    }
    setIsOptionsModalVisible(false);
  };

  // Prepara el formulario para editar una nota existente
  const startEditMarker = () => {
    const item = selectedItem;
    const category = categories.find(cat => cat.items.some(i => i.id === item.id));

    setEditingItemId(item.id);
    setTempCategoryId(category?.id || null);
    setIsEditing(true);
    setNewNoteTitle(item.title);
    setNewNoteProducts(item.productos || []);
    setNewNoteImage(item.imageUri || null);
    setLastCoordinate({ latitude: item.latitude, longitude: item.longitude });

    setIsOptionsModalVisible(false);
    setIsNoteModalVisible(true);
  };

  // Abre el GPS externo
  const handleOpenGPS = () => {
    if (!selectedItem) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${selectedItem.latitude},${selectedItem.longitude}`;
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    setIsOptionsModalVisible(false);
  };

  // Comparte ubicación nativamente
  const handleShareItem = async () => {
    if (!selectedItem) return;
    try {
      // Generar el desglose de productos para el texto compartido
      let productsText = '';
      if (selectedItem.productos && selectedItem.productos.length > 0) {
        let total = 0;
        selectedItem.productos.forEach(p => {
          productsText += `- ${p.nombre_producto} ($${p.precio})\n`;
          total += Number(p.precio);
        });
        productsText += `\nTOTAL: $${total}`;
      }

      const message = `📍 ${selectedItem.title.toUpperCase()}\n\n${productsText}\n\nUbicación: https://www.google.com/maps/search/?api=1&query=${selectedItem.latitude},${selectedItem.longitude}`;
      await Share.share({ message });
      setIsOptionsModalVisible(false);
    } catch (error) {
      console.error(error.message);
    }
  };

  // Captura la posición donde el usuario deja pulsado el mapa (LongPress)
  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLastCoordinate({ latitude, longitude });

    if (!categoryId) {
      // Si estamos en el Mapa Global, primero pedimos elegir o crear una carpeta
      setIsCategoryModalVisible(true);
    } else {
      // Si ya venimos de una categoría, vamos directo a crear la nota
      setTempCategoryId(categoryId);
      prepareNoteModal(false);
    }
  };

  // Función para abrir la cámara
  const handleCamera = async () => {
    setIsPhotoChoiceVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setErrorHeader("ERROR");
      setErrorMessage("SE REQUIERE PERMISO PARA USAR LA CÁMARA.");
      setIsErrorModalVisible(true);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled) {
      setNewNoteImage(result.assets[0].uri);
    }
  };

  // Función para abrir la galería
  const handleGallery = async () => {
    setIsPhotoChoiceVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setErrorHeader("ERROR");
      setErrorMessage("SE REQUIERE PERMISO PARA ACCEDER A LAS FOTOS.");
      setIsErrorModalVisible(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled) {
      setNewNoteImage(result.assets[0].uri);
    }
  };

  const pickImage = () => {
    setIsPhotoChoiceVisible(true);
  };

  // Limpia el formulario antes de abrir el modal de nota
  const prepareNoteModal = (editing) => {
    setIsEditing(editing);
    if (!editing) {
      setEditingItemId(null);
      setNewNoteTitle('');
      setNewNoteProducts([]);
      setNewProductName('');
      setNewProductPrice('');
      setNewNoteImage(null);
    }
    setIsNoteModalVisible(true);
  };

  // Añadir producto a la lista temporal
  const handleAddProduct = () => {
    if (!newProductName.trim() || !newProductPrice.trim()) {
      setErrorHeader("ERROR");
      setErrorMessage("NOMBRE Y PRECIO DEL PRODUCTO SON REQUERIDOS");
      setIsErrorModalVisible(true);
      return;
    }

    const priceNum = parseFloat(newProductPrice);
    if (isNaN(priceNum)) {
      setErrorHeader("ERROR");
      setErrorMessage("EL PRECIO DEBE SER UN NÚMERO VÁLIDO");
      setIsErrorModalVisible(true);
      return;
    }

    const newProduct = {
      id_producto: `prod_${Date.now()}`,
      nombre_producto: newProductName.trim(),
      precio: priceNum
    };

    setNewNoteProducts(prev => [...prev, newProduct]);
    setNewProductName(''); // Limpiar inputs
    setNewProductPrice('');
  };

  // Quitar producto de la lista temporal
  const handleRemoveProduct = (prodId) => {
    setNewNoteProducts(prev => prev.filter(p => p.id_producto !== prodId));
  };

  // Guarda la nota (Nueva o Editada)
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

    if (isEditing) {
      // Lógica de actualización
      const updatedData = {
        title: newNoteTitle.trim(),
        productos: newNoteProducts,
        imageUri: newNoteImage
      };
      useStore.getState().updateItem(targetCategoryId, editingItemId, updatedData);
      setItems(prev => prev.map(item => item.id === editingItemId ? { ...item, ...updatedData } : item));
    } else {
      // Lógica de creación de nueva nota
      const newId = `item_${Date.now()}`;
      const newItem = {
        id: newId,
        title: newNoteTitle.trim(),
        productos: newNoteProducts,
        latitude: lastCoordinate.latitude,
        longitude: lastCoordinate.longitude,
        imageUri: newNoteImage,
        createdAt: Date.now()
      };

      addItemToCategory(targetCategoryId, newItem);
      setItems(prev => [...prev, newItem]);
    }

    setIsNoteModalVisible(false);
  };

  // Selecciona la carpeta donde se guardará la nota (desde el mapa global)
  const handleSelectCategory = (id) => {
    setTempCategoryId(id);
    setIsCategoryModalVisible(false);
    prepareNoteModal(false);
  };

  // Abre el modal para crear una carpeta nueva desde el mapa
  const handleCreateNewCategoryFromMap = () => {
    setIsCategoryModalVisible(false);
    setNewCategoryName('');
    setIsNewCategoryModalVisible(true);
  };

  // Confirma la creación de la nueva carpeta y la selecciona automáticamente
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
      {/* Banner de aviso si no hay GPS */}
      {locationPermission === false && (
        <View style={[styles.warningBanner, { backgroundColor: currentColors.text }]}>
          <Text style={[styles.warningText, { color: currentColors.background }]}>
            PERMISO DE UBICACIÓN DENEGADO
          </Text>
        </View>
      )}

      {/* COMPONENTE PRINCIPAL: El Mapa */}
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation={locationPermission}
        zoomEnabled={true}
        rotateEnabled={true}
        onMapReady={() => setIsMapReady(true)}
        onLongPress={handleMapPress} // Mantén pulsado para crear una nota
        userInterfaceStyle={theme === 'dark' ? 'dark' : 'light'}
        minZoomLevel={2}
      >
        {/* Renderizamos cada marcador en el mapa */}
        {items && items.map(item => {
          // Generar descripción derivada (Ej: "3 PRODUCTOS - $450")
          let markerDesc = '';
          if (item.productos && item.productos.length > 0) {
            const total = item.productos.reduce((sum, p) => sum + Number(p.precio), 0);
            markerDesc = `${item.productos.length} PRODUCTOS - $${total}`;
          }

          return (
            <Marker
              key={item.id}
              coordinate={{ latitude: item.latitude, longitude: item.longitude }}
              title={item.title}
              description={markerDesc}
              onCalloutPress={() => handleMarkerPress(item)} // Toca el título para ver opciones
            />
          );
        })}
      </MapView>

      {/* Barra inferior informativa */}
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

      {/* MODAL 1: Crear o Editar Nota (POS) */}
      <BrutalistModal
        visible={isNoteModalVisible}
        onClose={() => setIsNoteModalVisible(false)}
        title={isEditing ? 'EDITAR POS' : 'NUEVO POS'}
        scrollable={true}
        actions={[
          { title: 'CANCELAR', onPress: () => setIsNoteModalVisible(false) },
          { title: 'GUARDAR POS', onPress: handleSaveNote, primary: true }
        ]}
      >
        <TextInput
          style={[styles.modalInput, { color: currentColors.text, borderColor: currentColors.border }]}
          placeholder="NOMBRE DEL PUNTO DE VENTA (POS)"
          placeholderTextColor={`${currentColors.text}80`}
          value={newNoteTitle}
          onChangeText={setNewNoteTitle}
        />

        {/* Sección para añadir productos */}
        <View style={[styles.productFormSection, { borderColor: currentColors.border }]}>
          <Text style={[styles.productSectionTitle, { color: currentColors.text }]}>NUEVO PRODUCTO</Text>
          <View style={styles.productInputRow}>
            <TextInput
              style={[styles.modalInput, styles.productNameInput, { color: currentColors.text, borderColor: currentColors.border, marginBottom: 0 }]}
              placeholder="NOMBRE"
              placeholderTextColor={`${currentColors.text}80`}
              value={newProductName}
              onChangeText={setNewProductName}
            />
            <TextInput
              style={[styles.modalInput, styles.productPriceInput, { color: currentColors.text, borderColor: currentColors.border, marginBottom: 0 }]}
              placeholder="$ PRECIO"
              placeholderTextColor={`${currentColors.text}80`}
              value={newProductPrice}
              onChangeText={setNewProductPrice}
              keyboardType="numeric"
            />
          </View>
          <TouchableOpacity
            style={[styles.addProductBtn, { borderColor: currentColors.border, backgroundColor: currentColors.text }]}
            onPress={handleAddProduct}
          >
            <Text style={[styles.addProductBtnText, { color: currentColors.background }]}>+ AÑADIR PRODUCTO</Text>
          </TouchableOpacity>
        </View>

        {/* Lista visual de productos añadidos */}
        {newNoteProducts.length > 0 && (
          <View style={[styles.productsListContainer, { borderColor: currentColors.border }]}>
            {newNoteProducts.map((prod) => (
              <View key={prod.id_producto} style={[styles.productItemRow, { borderBottomColor: currentColors.border }]}>
                <Text style={[styles.productItemName, { color: currentColors.text }]} numberOfLines={1}>
                  {prod.nombre_producto.toUpperCase()}
                </Text>

                {/* Dots separator */}
                <View style={styles.dotsContainer}>
                  <Text style={[styles.dotsText, { color: currentColors.border }]} numberOfLines={1}>
                    ....................................................................
                  </Text>
                </View>

                <Text style={[styles.productItemPrice, { color: currentColors.text }]}>
                  ${prod.precio}
                </Text>
                <TouchableOpacity
                  style={[styles.productDeleteBtn, { borderColor: currentColors.border }]}
                  onPress={() => handleRemoveProduct(prod.id_producto)}
                >
                  <Text style={[styles.productDeleteBtnText, { color: currentColors.text }]}>X</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={[styles.totalText, { color: currentColors.text }]}>TOTAL:</Text>
              <Text style={[styles.totalValue, { color: currentColors.text }]}>
                ${newNoteProducts.reduce((sum, p) => sum + Number(p.precio), 0)}
              </Text>
            </View>
          </View>
        )}

        {/* Image Picker */}
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

      {/* MODAL 2: Seleccionar Carpeta Destino */}
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
      }
      </BrutalistModal>

      {/* MODAL 3: Opciones del Marcador al tocarlo */}
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
  { selectedItem && selectedItem.imageUri && (
    <Image
      source={{ uri: selectedItem.imageUri }}
      style={[styles.markerImage, { borderColor: currentColors.border }]}
    />
  )}
<View style={{ height: 10 }} />
      </BrutalistModal>

      {/* MODAL 4: Mensajes de Error */}
  < BrutalistModal
visible = { isErrorModalVisible }
onClose = {() => setIsErrorModalVisible(false)}
title = { errorHeader }
message = { errorMessage }
actions = { [{ title: 'ACEPTAR', onPress: () => setIsErrorModalVisible(false), primary: true }]}
  />

      {/* Modal para elegir origen de foto */}
  < BrutalistModal
visible = { isPhotoChoiceVisible }
title = "AÑADIR FOTO"
onClose = {() => setIsPhotoChoiceVisible(false)}
actions = { [{ title: 'CANCELAR', onPress: () => setIsPhotoChoiceVisible(false) }]}
  >
  <View style={{ gap: 10 }}>
    <BrutalistButton title="📷 CÁMARA" onPress={handleCamera} />
    <BrutalistButton title="🖼️ GALERÍA" onPress={handleGallery} />
  </View>
      </BrutalistModal>

      {/* MODAL 5: Crear Carpeta Nueva (desde el mapa) */}
  < BrutalistModal
visible = { isNewCategoryModalVisible }
onClose = {() => setIsNewCategoryModalVisible(false)}
title = "NUEVA CARPETA"
actions = {
  [
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
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  warningBanner: {
    padding: 10,
    alignItems: 'center',
  },
  warningText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  footerCount: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    padding: 15,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  // Nuevos estilos para formulado de productos (Fase 7)
  productFormSection: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 15,
  },
  productSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
  },
  productInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  productNameInput: {
    flex: 2,
  },
  productPriceInput: {
    flex: 1,
  },
  addProductBtn: {
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addProductBtnText: {
    fontWeight: '900',
    fontSize: 14,
  },
  productsListContainer: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 15,
  },
  productItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomStyle: 'dashed', // Intentar línea punteada real
  },
  productItemName: {
    fontWeight: 'bold',
    fontSize: 14,
    maxWidth: '40%',
  },
  dotsContainer: {
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  dotsText: {
    fontSize: 14,
    opacity: 0.5,
  },
  productItemPrice: {
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 10,
  },
  productDeleteBtn: {
    borderWidth: 1,
    padding: 5,
    marginLeft: 10,
    width: 30,
    alignItems: 'center',
  },
  productDeleteBtnText: {
    fontWeight: '900',
    fontSize: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 5,
  },
  totalText: {
    fontWeight: '900',
    fontSize: 16,
  },
  totalValue: {
    fontWeight: '900',
    fontSize: 18,
  },
  // Resto de estilos antiguos...
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  catOption: {
    borderWidth: 1,
    padding: 15,
    marginHorizontal: 20,
    marginVertical: 10,
  },
  catOptionText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  imagePickerArea: {
    marginTop: 10,
  },
  previewImage: {
    width: '100%',
    height: 120,
    marginBottom: 10,
    borderWidth: 1,
  },
  markerImage: {
    width: '100%',
    height: 150,
    borderWidth: 1,
  },
  deleteLinkText: {
    fontSize: 12,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  }
});

