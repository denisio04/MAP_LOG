/**
 * PALETA DE COLORES (Brutalista)
 * Definimos dos temas: Claro (light) y Oscuro (dark).
 * Usamos HSL para tener un control preciso del contraste.
 */
export const colors = {
  // Configuración para el modo claro
  light: {
    background: 'hsl(0, 0%, 95%)', // Fondo gris muy claro
    text: 'hsl(0, 0%, 0%)',       // Texto negro puro
    border: 'hsl(0, 0%, 0%)',     // Bordes negros gruesos
    primary: 'hsl(0, 0%, 0%)',    // El color principal es negro
    primaryText: 'hsl(0, 0%, 100%)', // Texto sobre botones principales (blanco)
    overlay: 'rgba(0,0,0,0.5)',   // Fondo semitransparente para modales
  },
  // Configuración para el modo oscuro
  dark: {
    background: 'hsl(0, 0%, 5%)',  // Fondo negro casi total
    text: 'hsl(0, 0%, 100%)',      // Texto blanco puro
    border: 'hsl(0, 0%, 100%)',    // Bordes blancos
    primary: 'hsl(0, 0%, 100%)',   // El color principal es blanco
    primaryText: 'hsl(0, 0%, 0%)', // Texto sobre botones principales (negro)
    overlay: 'rgba(255,255,255,0.2)', // Fondo semitransparente para modales ocultos
  }
};
