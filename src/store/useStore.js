import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';


/**
 * ALMACENAMIENTO GLOBAL (Zustand)
 * Aquí gestionamos todo el estado de la aplicación: temas, categorías, notas y ubicación.
 */
export const useStore = create((set, get) => ({
  theme: 'light', // Tema actual: 'light' o 'dark'
  categories: [], // Lista de carpetas y sus notas
  defaultLocation: null, // Ubicación central del mapa si no hay notas
  isLoaded: false, // Indica si ya se cargaron los datos del teléfono

  // Cambia el tema (claro/oscuro) y lo guarda en el dispositivo
  setTheme: (theme) => {
    set({ theme });
    AsyncStorage.setItem('@app_theme', theme).catch(console.error);
  },

  // Alterna entre los dos temas disponibles
  toggleTheme: () => {
    const currentTheme = get().theme;
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    set({ theme: newTheme });
    AsyncStorage.setItem('@app_theme', newTheme).catch(console.error);
  },

  // Guarda la ubicación predeterminada para el mapa
  setDefaultLocation: (location) => {
    set({ defaultLocation: location });
    AsyncStorage.setItem('@default_location', JSON.stringify(location)).catch(console.error);
  },

  // Añade una nueva carpeta de categorías
  addCategory: (category) => {
    set((state) => {
      const newCategories = [...state.categories, category];
      // Guardamos la lista actualizada en el almacenamiento local
      AsyncStorage.setItem('@categories', JSON.stringify(newCategories)).catch(console.error);
      return { categories: newCategories };
    });
  },

  // Elimina una carpeta completa por su ID
  deleteCategory: (categoryId) => {
    set((state) => {
      const newCategories = state.categories.filter(cat => cat.id !== categoryId);
      AsyncStorage.setItem('@categories', JSON.stringify(newCategories)).catch(console.error);
      return { categories: newCategories };
    });
  },

  // Añade una nota (item) a una carpeta específica
  addItemToCategory: (categoryId, item) => {
    set((state) => {
      // Añadimos marca de tiempo de creación si no existe
      const itemWithTimestamp = {
        ...item,
        createdAt: item.createdAt || Date.now()
      };

      const newCategories = state.categories.map(cat =>
        cat.id === categoryId ? { ...cat, items: [...cat.items, itemWithTimestamp] } : cat
      );
      AsyncStorage.setItem('@categories', JSON.stringify(newCategories)).catch(console.error);
      return { categories: newCategories };
    });
  },

  // Elimina una nota individual dentro de una carpeta
  deleteItem: (categoryId, itemId) => {
    set((state) => {
      const newCategories = state.categories.map(cat =>
        cat.id === categoryId
          ? { ...cat, items: cat.items.filter(item => item.id !== itemId) }
          : cat
      );
      AsyncStorage.setItem('@categories', JSON.stringify(newCategories)).catch(console.error);
      return { categories: newCategories };
    });
  },

  // Actualiza los datos de una nota existente (título, descripción, etc.)
  updateItem: (categoryId, itemId, updatedItem) => {
    set((state) => {
      const newCategories = state.categories.map(cat =>
        cat.id === categoryId
          ? {
            ...cat,
            items: cat.items.map(item => item.id === itemId ? { ...item, ...updatedItem } : item)
          }
          : cat
      );
      AsyncStorage.setItem('@categories', JSON.stringify(newCategories)).catch(console.error);
      return { categories: newCategories };
    });
  },

  // Reemplaza todos los datos actuales por unos nuevos (para restauración de backup)
  importData: (categories, defaultLocation) => {
    set({ categories, defaultLocation });
    AsyncStorage.setItem('@categories', JSON.stringify(categories)).catch(console.error);
    if (defaultLocation) {
      AsyncStorage.setItem('@default_location', JSON.stringify(defaultLocation)).catch(console.error);
    }
  },

  // Carga todos los datos guardados en el almacenamiento local al iniciar la app
  loadState: async () => {
    try {
      const theme = await AsyncStorage.getItem('@app_theme');
      const savedCategories = await AsyncStorage.getItem('@categories');
      const defaultLocation = await AsyncStorage.getItem('@default_location');

      set({
        theme: theme || 'light',
        // Si hay categorías guardadas las usamos, si no, empezamos vacío
        categories: savedCategories ? JSON.parse(savedCategories) : [],
        defaultLocation: defaultLocation ? JSON.parse(defaultLocation) : null,
        isLoaded: true,
      });
    } catch (e) {
      console.error('Failed to load state', e);
      set({ isLoaded: true });
    }
  }
}));

