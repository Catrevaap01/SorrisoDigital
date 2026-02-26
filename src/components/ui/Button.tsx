/**
 * Componente Button reutilizável
 * Botão padronizado para toda a aplicação
 */

import React, { ReactNode } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  TouchableOpacityProps,
} from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
  style?: any;
  textStyle?: any;
}

interface VariantStyles {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

interface SizeStyles {
  paddingVertical: number;
  paddingHorizontal: number;
  fontSize: number;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon = null,
  style,
  textStyle,
}) => {
  const getVariantStyles = (): VariantStyles => {
    const variants: Record<ButtonVariant, VariantStyles> = {
      primary: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
        textColor: COLORS.textInverse,
      },
      secondary: {
        backgroundColor: COLORS.secondary,
        borderColor: COLORS.secondary,
        textColor: COLORS.textInverse,
      },
      danger: {
        backgroundColor: COLORS.danger,
        borderColor: COLORS.danger,
        textColor: COLORS.textInverse,
      },
      ghost: {
        backgroundColor: 'transparent',
        borderColor: COLORS.primary,
        textColor: COLORS.primary,
      },
    };

    return variants[variant] || variants.primary;
  };

  const getSizeStyles = (): SizeStyles => {
    const sizes: Record<ButtonSize, SizeStyles> = {
      sm: {
        paddingVertical: SIZES.sm,
        paddingHorizontal: SIZES.md,
        fontSize: SIZES.fontSm,
      },
      md: {
        paddingVertical: SIZES.md,
        paddingHorizontal: SIZES.lg,
        fontSize: SIZES.fontMd,
      },
      lg: {
        paddingVertical: SIZES.lg,
        paddingHorizontal: SIZES.xl,
        fontSize: SIZES.fontLg,
      },
    };

    return sizes[size] || sizes.md;
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={isDisabled ? 1 : 0.7}
      style={[
        styles.button,
        {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
          opacity: isDisabled ? 0.6 : 1,
          width: fullWidth ? '100%' : 'auto',
        },
        sizeStyles,
        style,
      ]}
    >
      <View style={styles.content}>
        {icon && !loading && <View style={styles.icon}>{icon}</View>}

        {loading ? (
          <ActivityIndicator color={variantStyles.textColor} size="small" />
        ) : (
          <Text
            style={[
              styles.text,
              { color: variantStyles.textColor, fontSize: sizeStyles.fontSize },
              textStyle,
            ]}
          >
            {title}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: SIZES.radiusMd,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
  icon: {
    marginRight: SIZES.sm,
  },
});

export default Button;
