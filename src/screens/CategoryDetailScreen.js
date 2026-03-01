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
  const [editDesc, setEditDesc] = React.useState('');
  const [editImage, setEditImage] = React.useState(null);

  // Estados para ordenación y ubicación
  const [userLocation, setUserLocation] = React.useState(null);
  const [sortByDistance, setSortByDistance] = React.useState(false);

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
    return list;
  }, [category, sortByDistance, userLocation]);

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
    setEditDesc(item.description || '');
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

  // Guarda los cambios realizados en el ítem
  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;

    useStore.getState().updateItem(categoryId, itemToEdit.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
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
      const message = `📍 ${item.title.toUpperCase()}\n\n${item.description || ''}\n\nUbicación: https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`;
      await Share.share({ message });
    } catch (error) {
      console.error(error.message);
    }
  };

  // Define cómo se ve cada "fila" (nota) en la lista
  const renderItem = ({ item }) => (
    <View style={[styles.itemRow, { borderBottomColor: currentColors.border }]}>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemTitle, { color: currentColors.text }]}>- {item.title}</Text>
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
        {item.description ? (
          <Text style={[styles.itemDesc, { color: currentColors.text }]}>{item.description}</Text>
        ) : null}
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
        title="MAPA"
        fullWidth={false}
        textStyle={{ fontSize: 12 }}
        style={{ paddingVertical: 8, paddingHorizontal: 12 }}
        onPress={() => handleViewSingleMap(item)}
      />
    </View>
  );

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
          <TouchableOpacity
            onPress={() => setSortByDistance(!sortByDistance)}
            style={[styles.sortToggle, { borderColor: currentColors.border }]}
          >
            <Text style={[styles.sortToggleText, { color: currentColors.text }]}>
              ORDENAR POR: {sortByDistance ? 'CERCANÍA' : 'RECIENTE'}
            </Text>
          </TouchableOpacity>
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
        title="EDITAR NOTA"
        actions={[
          { title: 'CANCELAR', onPress: () => setIsEditModalVisible(false) },
          { title: 'GUARDAR', onPress: handleSaveEdit, primary: true }
        ]}
      >
        <TextInput
          style={[styles.modalInput, { color: currentColors.text, borderColor: currentColors.border }]}
          placeholder="TÍTULO"
          placeholderTextColor={`${currentColors.text}80`}
          value={editTitle}
          onChangeText={setEditTitle}
          autoFocus={true}
        />
        <TextInput
          style={[styles.modalInput, styles.textArea, { color: currentColors.text, borderColor: currentColors.border }]}
          placeholder="INFORMACIÓN ADICIONAL..."
          placeholderTextColor={`${currentColors.text}80`}
          value={editDesc}
          onChangeText={setEditDesc}
          multiline={true}
          numberOfLines={4}
        />

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
    marginBottom: 10,
    borderWidth: 1,
  }
});

