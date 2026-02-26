/**
 * Funções auxiliares para obter cores dinâmicas baseado no tema (light/dark)
 */

export const LIGHT_COLORS = {
  primary: '#1E88E5',
  primaryDark: '#1565C0',
  primaryLight: '#64B5F6',

  secondary: '#43A047',
  secondaryDark: '#2E7D32',
  secondaryLight: '#81C784',

  accent: '#FF9800',

  danger: '#E53935',
  warning: '#FFC107',
  success: '#4CAF50',
  info: '#2196F3',
  error: '#D32F2F',
  errorLight: '#FFEBEE',

  background: '#F5F5F5',
  backgroundSecondary: '#EEEEEE',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  text: '#212121',
  textSecondary: '#757575',
  textLight: '#BDBDBD',
  textInverse: '#FFFFFF',

  border: '#E0E0E0',
  divider: '#EEEEEE',

  shadow: 'rgba(0, 0, 0, 0.1)',
};

export const DARK_COLORS = {
  primary: '#64B5F6',
  primaryDark: '#1E88E5',
  primaryLight: '#90CAF9',

  secondary: '#81C784',
  secondaryDark: '#43A047',
  secondaryLight: '#A5D6A7',

  accent: '#FFB74D',

  danger: '#EF5350',
  warning: '#FDD835',
  success: '#66BB6A',
  info: '#42A5F5',
  error: '#E53935',
  errorLight: '#B71C1C',

  background: '#121212',
  backgroundSecondary: '#1E1E1E',
  surface: '#1E1E1E',
  card: '#2C2C2C',

  text: '#FFFFFF',
  textSecondary: '#BDBDBD',
  textLight: '#757575',
  textInverse: '#212121',

  border: '#424242',
  divider: '#313131',

  shadow: 'rgba(0, 0, 0, 0.4)',
};

/**
 * Retorna as cores baseado se está em dark mode ou não
 */
export const getColors = (isDarkMode: boolean) => {
  return isDarkMode ? DARK_COLORS : LIGHT_COLORS;
};
