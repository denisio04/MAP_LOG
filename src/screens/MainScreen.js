import React, { useLayoutEffect } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store/useStore';
import { colors } from '../theme/colors';
import BrutalistCard from '../components/BrutalistCard';
import BrutalistButton from '../components/BrutalistButton';
import BrutalistModal from '../components/BrutalistModal';

/**
 * PANTALLA PRINCIPAL (MainScreen)
 * Aquí se muestran todas las carpetas (categorías) y se permite crear nuevas.
 */
export default function MainScreen({ navigation }) {
  // Obtenemos datos y funciones del almacenamiento global (Zustand)
  const categories = useStore((state) => state.categories);
  const deleteCategory = useStore((state) => state.deleteCategory);
  const addCategory = useStore((state) => state.addCategory);
  const theme = useStore((state) => state.theme);
  const currentColors = colors[theme] || colors.light;
  const insets = useSafeAreaInsets(); // Controla los bordes de la pantalla (notch, botones inferiores)

  // Estados locales para los modales y el formulario de nueva carpeta
  const [newCategoryTitle, setNewCategoryTitle] = React.useState('');
  const [isDeleteModalVisible, setIsDeleteModalVisible] = React.useState(false);
  const [isErrorModalVisible, setIsErrorModalVisible] = React.useState(false);
  const [categoryToDelete, setCategoryToDelete] = React.useState(null);

  // Configura la barra superior (Header) al cargar la pantalla
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          style={[styles.headerButton, { borderColor: currentColors.border }]}
        >
          <Text style={[styles.headerButtonText, { color: currentColors.text }]}>
            AJUSTES
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, currentColors]);

  // Prepara la eliminación de una carpeta (abre el modal de confirmación)
  const handleDeleteCategory = (category) => {
    setCategoryToDelete(category);
    setIsDeleteModalVisible(true);
  };

  // Función que se ejecuta cuando el usuario confirma que quiere borrar en el modal
  const confirmDeleteCategory = () => {
    if (categoryToDelete) {
      deleteCategory(categoryToDelete.id);
    }
    setIsDeleteModalVisible(false);
  };

  // Crea una nueva carpeta si el nombre no está vacío
  const handleCreateCategory = () => {
    if (!newCategoryTitle.trim()) {
      setIsErrorModalVisible(true);
      return;
    }

    const newCategory = {
      id: `cat_${Date.now()}`,
      title: newCategoryTitle.trim(),
      items: []
    };

    addCategory(newCategory);
    setNewCategoryTitle(''); // Limpia el campo de texto
  };

  // Define cómo se ve cada tarjeta de carpeta en la lista
  const renderItem = ({ item }) => (
    <BrutalistCard
      title={item.title}
      subtitle={`${item.items.length} ÍTEMS`}
      actionText="VER"
      // Navega al detalle de la categoría seleccionada
      onActionPress={() => navigation.navigate('CategoryDetail', { categoryId: item.id, title: item.title })}
      onPress={() => navigation.navigate('CategoryDetail', { categoryId: item.id, title: item.title })}
      onDeletePress={() => handleDeleteCategory(item)}
    />
  );

  // Recopila todas las notas de todas las carpetas para mostrarlas en el Mapa Global
  const handleGoToMap = () => {
    const allItems = (categories || []).reduce((acc, cat) => {
      if (cat && Array.isArray(cat.items)) {
        return [...acc, ...cat.items];
      }
      return acc;
    }, []);

    navigation.navigate('Map', {
      items: allItems,
      title: 'MAPA GLOBAL'
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: currentColors.background }]}>
      {/* Sección para crear una nueva carpeta */}
      <View style={[styles.createContainer, { borderBottomColor: currentColors.border }]}>
        <TextInput
          style={[styles.input, { color: currentColors.text, borderColor: currentColors.border }]}
          placeholder="NUEVA CARPETA..."
          placeholderTextColor={`${currentColors.text}80`}
          value={newCategoryTitle}
          onChangeText={setNewCategoryTitle}
        />
        <TouchableOpacity
          onPress={handleCreateCategory}
          style={[styles.addButton, { backgroundColor: currentColors.primary, borderColor: currentColors.border }]}
        >
          <Text style={[styles.addButtonText, { color: currentColors.primaryText }]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de carpetas guardadas */}
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      {/* Botón inferior para ir al Mapa Global */}
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

        {/* MODAL: Confirmar eliminación */}
        <BrutalistModal
          visible={isDeleteModalVisible}
          onClose={() => setIsDeleteModalVisible(false)}
          title="ELIMINAR CATEGORÍA"
          message={categoryToDelete ? `¿SEGURO QUE QUIERES ELIMINAR "${categoryToDelete.title.toUpperCase()}"?` : ''}
          actions={[
            { title: 'CANCELAR', onPress: () => setIsDeleteModalVisible(false) },
            { title: 'ELIMINAR', onPress: confirmDeleteCategory, primary: true }
          ]}
        />

        {/* MODAL: Error por nombre vacío */}
        <BrutalistModal
          visible={isErrorModalVisible}
          onClose={() => setIsErrorModalVisible(false)}
          title="ERROR"
          message="NOMBRE DE CARPETA REQUERIDO"
          actions={[
            { title: 'ACEPTAR', onPress: () => setIsErrorModalVisible(false), primary: true }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 20,
  },
  headerButton: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
  },
  headerButtonText: {
    fontWeight: '500',
    fontSize: 12,
    letterSpacing: 1,
  },
  footer: {
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  createContainer: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 45,
    fontWeight: '300',
    fontSize: 14,
  },
  addButton: {
    width: 45,
    height: 45,
    borderWidth: 1,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 24,
    fontWeight: '500',
  }
});

