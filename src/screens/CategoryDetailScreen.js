import React from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, TextInput, Linking, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { colors } from '../theme/colors';
import BrutalistButton from '../components/BrutalistButton';
import BrutalistCard from '../components/BrutalistCard';
import BrutalistModal from '../components/BrutalistModal';
import { getDistance, formatDistance } from '../utils/geoUtils';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

/**
 * PANTALLA: Detalle de Categoría (CategoryDetailScreen)
 * Muestra la lista de notas (ítems) guardadas dentro de una carpeta específica.
 */
export default function CategoryDetailScreen({ route, navigation }) {
  // Obtenemos el ID de la categoría que pasamos desde la pantalla anterior
  const { categoryId } = route.params;

  // Datos y funciones globales
  const categories = useStore((state) => state.categories);
  const deleteItem = useStore((state) => state.deleteItem);
  const theme = useStore((state) => state.theme);
  const currentColors = colors[theme] || colors.light;
  const insets = useSafeAreaInsets();

  // Buscamos la categoría específica en nuestra lista global
  const category = categories.find(c => c.id === categoryId);

  // Estados para el modal de borrado
  const [isDeleteModalVisible, setIsDeleteModalVisible] = React.useState(false);
  const [itemToDelete, setItemToDelete] = React.useState(null);
  const [isPhotoChoiceVisible, setIsPhotoChoiceVisible] = React.useState(false);

  // Estados para el modal de edición
  const [isEditModalVisible, setIsEditModalVisible] = React.useState(false);
  const [itemToEdit, setItemToEdit] = React.useState(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editProducts, setEditProducts] = React.useState([]); // Cambio a array
  const [editProductName, setEditProductName] = React.useState(''); // Input temp
  const [editProductPrice, setEditProductPrice] = React.useState(''); // Input temp
  const [editImage, setEditImage] = React.useState(null);

  // Estados para ordenación y ubicación
  const [userLocation, setUserLocation] = React.useState(null);
  const [sortByDistance, setSortByDistance] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortOrder, setSortOrder] = React.useState(null); // 'ASC' o null

  // Obtener ubicación del usuario para calcular distancias
  React.useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        setUserLocation(location.coords);
      }
    })();
  }, []);

  // Preparar lista ordenada
  const itemsToShow = React.useMemo(() => {
    if (!category || !category.items) return [];
    let list = [...category.items];

    const query = searchQuery.trim().toLowerCase();

    // 1. Filtrar por búsqueda de producto
    if (query) {
      list = list.filter(item =>
        item.productos && item.productos.some(p => p.nombre_producto.toLowerCase().includes(query))
      );

      // 2. Ordenar por precio del producto coincidente si sortOrder === 'ASC'
      if (sortOrder === 'ASC') {
        list.sort((a, b) => {
          const matchingProductA = a.productos.find(p => p.nombre_producto.toLowerCase().includes(query));
          const matchingProductB = b.productos.find(p => p.nombre_producto.toLowerCase().includes(query));
          const priceA = matchingProductA ? Number(matchingProductA.precio) : Infinity;
          const priceB = matchingProductB ? Number(matchingProductB.precio) : Infinity;
          return priceA - priceB;
        });
      }
    } else {
      // Ordenamiento por defecto si no hay búsqueda
      if (sortByDistance && userLocation) {
        list.sort((a, b) => {
          const distA = getDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
          const distB = getDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude);
          return distA - distB;
        });
      } else {
        // Por defecto ordenamos por fecha (más reciente arriba)
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
    }

    return list;
  }, [category, sortByDistance, userLocation, searchQuery, sortOrder]);

  // Navega al mapa mostrando TODOS los ítems de esta categoría
  const handleGoToMap = () => {
    navigation.navigate('Map', {
      items: category.items || [],
      title: `MAPA: ${category.title.toUpperCase()}`,
      categoryId: category.id
    });
  };

  // Navega al mapa centrándose solo en un ítem específico
  const handleViewSingleMap = (item) => {
    navigation.navigate('Map', {
      items: [item],
      title: `MAPA: ${item.title.toUpperCase()}`,
      categoryId: category.id
    });
  };

  // Abre el modal de confirmación para borrar una nota
  const handleDeleteItem = (item) => {
    setItemToDelete(item);
    setIsDeleteModalVisible(true);
  };

  // Ejecuta el borrado real del ítem
  const confirmDeleteItem = () => {
    if (itemToDelete) {
      deleteItem(categoryId, itemToDelete.id);
    }
    setIsDeleteModalVisible(false);
  };

  // Abre el modal de edición con los datos actuales del ítem
  const handleEditItem = (item) => {
    setItemToEdit(item);
    setEditTitle(item.title);
    setEditProducts(item.productos || []);
    setEditImage(item.imageUri || null);
    setIsEditModalVisible(true);
  };

  // Función para abrir la cámara
  const handleCamera = async () => {
    setIsPhotoChoiceVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("ERROR", "SE REQUIERE PERMISO PARA USAR LA CÁMARA.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled) {
      setEditImage(result.assets[0].uri);
    }
  };

  // Función para abrir la galería
  const handleGallery = async () => {
    setIsPhotoChoiceVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("ERROR", "SE REQUIERE PERMISO PARA ACCEDER A LAS FOTOS.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });

    if (!result.canceled) {
      setEditImage(result.assets[0].uri);
    }
  };

  const pickImage = () => {
    setIsPhotoChoiceVisible(true);
  };

  // Añadir producto a la lista temporal
  const handleAddProduct = () => {
    if (!editProductName.trim() || !editProductPrice.trim()) {
      return;
    }

    const priceNum = parseFloat(editProductPrice);
    if (isNaN(priceNum)) {
      return;
    }

    const newProduct = {
      id_producto: `prod_${Date.now()}`,
      nombre_producto: editProductName.trim(),
      precio: priceNum
    };

    setEditProducts(prev => [...prev, newProduct]);
    setEditProductName('');
    setEditProductPrice('');
  };

  // Quitar producto de la lista temporal
  const handleRemoveProduct = (prodId) => {
    setEditProducts(prev => prev.filter(p => p.id_producto !== prodId));
  };

  // Guarda los cambios realizados en el ítem
  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;

    useStore.getState().updateItem(categoryId, itemToEdit.id, {
      title: editTitle.trim(),
      productos: editProducts,
      imageUri: editImage,
    });
    setIsEditModalVisible(false);
  };

  // Abre el GPS externo (Google Maps / Apple Maps)
  const handleOpenGPS = (item) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  // Comparte la ubicación y descripción vía Share nativo
  const handleShareItem = async (item) => {
    try {
      let productsText = '';
      if (item.productos && item.productos.length > 0) {
        let total = 0;
        item.productos.forEach(p => {
          productsText += `- ${p.nombre_producto} ($${p.precio})\n`;
          total += Number(p.precio);
        });
        productsText += `\nTOTAL: $${total}`;
      }

      const message = `📍 ${item.title.toUpperCase()}\n\n${productsText}\n\nUbicación: https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;
      await Share.share({ message });
    } catch (error) {
      console.error(error.message);
    }
  };

  // Define cómo se ve cada "fila" (nota) en la lista
  const renderItem = ({ item }) => {
    const query = searchQuery.trim().toLowerCase();

    return (
      <View style={[styles.itemRow, { borderBottomColor: currentColors.border, flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={[styles.itemInfo, { paddingRight: 0 }]}>
          <Text style={[styles.itemTitle, { color: currentColors.text }]}>{item.title.toUpperCase()}</Text>
          <View style={styles.metadataRow}>
            {item.createdAt && (
              <Text style={[styles.itemDate, { color: currentColors.text }]}>
                {new Date(item.createdAt).toLocaleDateString()} - {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
            {userLocation && (
              <Text style={[styles.itemDistance, { color: currentColors.text }]}>
                {formatDistance(getDistance(userLocation.latitude, userLocation.longitude, item.latitude, item.longitude))}
              </Text>
            )}
          </View>

          {/* Renderizado de Productos (POS) */}
          {item.productos && item.productos.length > 0 && (
            <View style={[styles.posListContainer, { borderColor: currentColors.border }]}>
              {item.productos.map(p => {
                const isMatch = query && p.nombre_producto.toLowerCase().includes(query);
                return (
                  <View
                    key={p.id_producto}
                    style={[
                      styles.posRow,
                      isMatch && { backgroundColor: currentColors.text, paddingHorizontal: 5, marginHorizontal: -5 }
                    ]}
                  >
                    <Text style={[styles.posName, { color: isMatch ? currentColors.background : currentColors.text }, isMatch && { fontWeight: '900' }]} numberOfLines={1}>
                      {p.nombre_producto.toUpperCase()}
                    </Text>

                    <View style={styles.dotsContainer}>
                      <Text style={[styles.dotsText, { color: isMatch ? currentColors.background : currentColors.border }]} numberOfLines={1}>
                        ....................................................................
                      </Text>
                    </View>

                    <Text style={[styles.posPrice, { color: isMatch ? currentColors.background : currentColors.text }, isMatch && { fontWeight: '900', fontSize: 16 }]}>
                      ${p.precio}
                    </Text>
                  </View>
                );
              })}
              <View style={[styles.posTotalRow, { borderTopColor: currentColors.border }]}>
                <Text style={[styles.posTotalText, { color: currentColors.text }]}>TOTAL:</Text>
                <Text style={[styles.posTotalValue, { color: currentColors.text }]}>
                  ${item.productos.reduce((sum, p) => sum + Number(p.precio), 0)}
                </Text>
              </View>
            </View>
          )}

          {item.imageUri && (
            <Image
              source={{ uri: item.imageUri }}
              style={[styles.itemImage, { borderColor: currentColors.border }]}
            />
          )}
          {/* Enlaces para editar o borrar este ítem específico */}
          <View style={styles.actionLinks}>
            <TouchableOpacity onPress={() => handleEditItem(item)} style={styles.editLink}>
              <Text style={[styles.deleteLinkText, { color: currentColors.primary }]}>EDITAR</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleOpenGPS(item)} style={styles.editLink}>
              <Text style={[styles.deleteLinkText, { color: currentColors.text }]}>GPS</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleShareItem(item)} style={styles.editLink}>
              <Text style={[styles.deleteLinkText, { color: currentColors.text }]}>COMPARTIR</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteItem(item)} style={styles.deleteLink}>
              <Text style={[styles.deleteLinkText, { color: '#FF0000' }]}>ELIMINAR</Text>
            </TouchableOpacity>
          </View>
        </View>

        <BrutalistButton
          title="[ VER EN MAPA ]"
          fullWidth={true}
          textStyle={{ fontSize: 14, fontWeight: '900' }}
          style={{ paddingVertical: 12, marginTop: 15, borderWidth: 2 }}
          onPress={() => handleViewSingleMap(item)}
        />
      </View>
    );
  };

  // Si por alguna razón la categoría no existe, mostramos un aviso
  if (!category) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: currentColors.background }]}>
        <Text style={{ color: currentColors.text }}>Categoría no encontrada</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentColors.background }]}>
      {/* Lista de notas de la carpeta */}
      <FlatList
        data={itemsToShow}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={() => (
          <View style={styles.listHeaderContainer}>
            <TextInput
              style={[styles.searchInput, { color: currentColors.text, borderColor: currentColors.border }]}
              placeholder="[ BUSCAR PRODUCTO... ]"
              placeholderTextColor={`${currentColors.text}80`}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <View style={styles.sortButtonsRow}>
              <TouchableOpacity
                onPress={() => setSortByDistance(!sortByDistance)}
                style={[styles.sortToggle, { borderColor: currentColors.border, flex: 1, marginRight: 5, backgroundColor: sortByDistance ? currentColors.text : 'transparent' }]}
              >
                <Text style={[styles.sortToggleText, { color: sortByDistance ? currentColors.background : currentColors.text }]}>
                  {sortByDistance ? '[ DISTANCIA: ON ]' : '[ DISTANCIA: OFF ]'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSortOrder(sortOrder === 'ASC' ? null : 'ASC')}
                style={[styles.sortToggle, { borderColor: currentColors.border, flex: 1, marginLeft: 5, backgroundColor: sortOrder === 'ASC' ? currentColors.text : 'transparent' }]}
              >
                <Text style={[styles.sortToggleText, { color: sortOrder === 'ASC' ? currentColors.background : currentColors.text }]}>
                  {sortOrder === 'ASC' ? '[ ORDEN: PRECIO MENOR v ]' : '[ ORDEN: NORMAL ]'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Botón inferior para ver todos los puntos de esta carpeta en el mapa */}
      <View style={[
        styles.footer,
        {
          borderTopColor: currentColors.border,
          paddingBottom: Math.max(insets.bottom, 20)
        }
      ]}>
        <BrutalistButton
          title="IR AL MAPA"
          primary={true}
          onPress={handleGoToMap}
        />
      </View>

      {/* Modal de confirmación para eliminar nota */}
      <BrutalistModal
        visible={isDeleteModalVisible}
        onClose={() => setIsDeleteModalVisible(false)}
        title="ELIMINAR ÍTEM"
        message={itemToDelete ? `¿SEGURO QUE QUIERES ELIMINAR "${itemToDelete.title.toUpperCase()}"?` : ''}
        actions={[{ title: 'BORRAR', onPress: confirmDeleteItem, primary: true }, { title: 'CANCELAR', onPress: () => setIsDeleteModalVisible(false) }]}
      />

      {/* Modal para elegir origen de foto */}
      <BrutalistModal
        visible={isPhotoChoiceVisible}
        title="AÑADIR FOTO"
        onClose={() => setIsPhotoChoiceVisible(false)}
        actions={[{ title: 'CANCELAR', onPress: () => setIsPhotoChoiceVisible(false) }]}
      >
        <View style={{ gap: 10 }}>
          <BrutalistButton title="📷 CÁMARA" onPress={handleCamera} />
          <BrutalistButton title="🖼️ GALERÍA" onPress={handleGallery} />
        </View>
      </BrutalistModal>

      {/* Modal para editar nota */}
      <BrutalistModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        title="EDITAR POS"
        scrollable={true}
        actions={[
          { title: 'CANCELAR', onPress: () => setIsEditModalVisible(false) },
          { title: 'GUARDAR POS', onPress: handleSaveEdit, primary: true }
        ]}
      >
        <TextInput
          style={[styles.modalInput, { color: currentColors.text, borderColor: currentColors.border }]}
          placeholder="NOMBRE DEL PUNTO DE VENTA (POS)"
          placeholderTextColor={`${currentColors.text}80`}
          value={editTitle}
          onChangeText={setEditTitle}
          autoFocus={true}
        />

        {/* Sección para añadir productos */}
        <View style={[styles.productFormSection, { borderColor: currentColors.border }]}>
          <Text style={[styles.productSectionTitle, { color: currentColors.text }]}>AÑADIR PRODUCTO</Text>
          <View style={styles.productInputRow}>
            <TextInput
              style={[styles.modalInput, styles.productNameInput, { color: currentColors.text, borderColor: currentColors.border, marginBottom: 0 }]}
              placeholder="NOMBRE"
              placeholderTextColor={`${currentColors.text}80`}
              value={editProductName}
              onChangeText={setEditProductName}
            />
            <TextInput
              style={[styles.modalInput, styles.productPriceInput, { color: currentColors.text, borderColor: currentColors.border, marginBottom: 0 }]}
              placeholder="$ PRECIO"
              placeholderTextColor={`${currentColors.text}80`}
              value={editProductPrice}
              onChangeText={setEditProductPrice}
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
        {editProducts.length > 0 && (
          <View style={[styles.productsListContainer, { borderColor: currentColors.border }]}>
            {editProducts.map((prod) => (
              <View key={prod.id_producto} style={[styles.productItemRow, { borderBottomColor: currentColors.border }]}>
                <Text style={[styles.productItemName, { color: currentColors.text }]} numberOfLines={1}>
                  {prod.nombre_producto.toUpperCase()}
                </Text>

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
                ${editProducts.reduce((sum, p) => sum + Number(p.precio), 0)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.imagePickerArea}>
          {editImage && (
            <Image source={{ uri: editImage }} style={[styles.previewImage, { borderColor: currentColors.border }]} />
          )}
          <BrutalistButton
            title={editImage ? "CAMBIAR FOTO" : "AÑADIR FOTO"}
            onPress={pickImage}
          />
          {editImage && (
            <TouchableOpacity onPress={() => setEditImage(null)} style={{ marginTop: 10 }}>
              <Text style={[styles.deleteLinkText, { color: '#FF0000', textAlign: 'center' }]}>QUITAR FOTO</Text>
            </TouchableOpacity>
          )}
        </View>
      </BrutalistModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  topAction: {
    padding: 20,
    borderBottomWidth: 1,
  },
  list: {
    paddingHorizontal: 25,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  itemInfo: {
    flex: 1,
    paddingRight: 10,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  itemDate: {
    fontSize: 10,
    fontWeight: 'bold',
    opacity: 0.6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  itemDistance: {
    fontSize: 10,
    fontWeight: '900',
    marginLeft: 10,
    backgroundColor: '#00000020',
    paddingHorizontal: 4,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  itemDesc: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.8,
  },
  actionLinks: {
    flexDirection: 'row',
    marginTop: 8,
  },
  editLink: {
    marginRight: 15,
  },
  deleteLink: {
    // Sin margen extra
  },
  deleteLinkText: {
    fontSize: 12,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  modalInput: {
    borderWidth: 1,
    padding: 15,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  footer: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  itemImage: {
    width: '100%',
    height: 150,
    marginTop: 10,
    borderWidth: 1,
  },
  imagePickerArea: {
    marginTop: 10,
  },
  previewImage: {
    width: '100%',
    height: 120,
  }, // <-- Falta coma de separación aquí
  // ESTILOS DE PRODUCTOS (POS)
  posListContainer: {
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  posRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  posName: {
    fontSize: 14,
    fontWeight: 'normal',
    maxWidth: '50%',
  },
  posPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  posTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 5,
    borderTopWidth: 1,
    borderTopStyle: 'dashed',
  },
  posTotalText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  posTotalValue: {
    fontWeight: '900',
    fontSize: 16,
  },

  // ESTILOS DEL MODAL DE EDICIÓN
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
    marginBottom: 0,
  },
  productPriceInput: {
    flex: 1,
    marginBottom: 0,
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
    borderBottomStyle: 'dashed',
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
  listHeaderContainer: {
    paddingVertical: 15,
  },
  searchInput: {
    borderWidth: 2,
    padding: 15,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sortButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sortToggle: {
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortToggleText: {
    fontWeight: '900',
    fontSize: 12,
  }
});

