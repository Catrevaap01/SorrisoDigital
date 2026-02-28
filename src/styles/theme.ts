/**
 * Temas e estilos globais da aplicação
 */

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  secondaryDark: string;
  secondaryLight: string;
  accent: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
  error: string;
  errorLight: string;
  background: string;
  backgroundSecondary: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textLight: string;
  textInverse: string;
  border: string;
  divider: string;
  shadow: string;
}

export interface ThemeFonts {
  regular: { fontWeight: '400' };
  medium: { fontWeight: '500' };
  semiBold: { fontWeight: '600' };
  bold: { fontWeight: '700' };
}

export interface ThemeSizes {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  radiusXl: number;
  radiusFull: number;
  fontXs: number;
  fontSm: number;
  fontMd: number;
  fontLg: number;
  fontXl: number;
  fontXxl: number;
  fontDisplay: number;
}

export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface ThemeShadows {
  small: ShadowStyle;
  sm: ShadowStyle;
  md: ShadowStyle;
  lg: ShadowStyle;
}

export const COLORS: ThemeColors = {
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

export const FONTS: ThemeFonts = {
  regular: {
    fontWeight: '400',
  },
  medium: {
    fontWeight: '500',
  },
  semiBold: {
    fontWeight: '600',
  },
  bold: {
    fontWeight: '700',
  },
};

export const SIZES: ThemeSizes = {
  // Spacing
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  
  // Border Radius
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 24,
  radiusFull: 999,
  
  // Font sizes
  fontXs: 10,
  fontSm: 12,
  fontMd: 14,
  fontLg: 16,
  fontXl: 18,
  fontXxl: 24,
  fontDisplay: 32,
};

export const SHADOWS: ThemeShadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
};
// Espaçamento - usado para padding, margin, gap
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Tipografia - tamanhos e estilos de fontes
export const TYPOGRAPHY = {
  sizes: {
    xs: 10,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    h1: 32,
    h2: 24,
    h3: 20,
    h4: 18,
    body: 16,
    bodySmall: 14,
    small: 12,
    xsmall: 10,
  },
  weights: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
};
