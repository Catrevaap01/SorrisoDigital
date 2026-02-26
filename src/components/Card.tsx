/**
 * Componente Card reutilizável
 * Base para exibir conteúdo em cards
 */

import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';

export interface CardProps {
  title?: string;
  subtitle?: string;
  description?: string;
  onPress?: () => void;
  style?: ViewStyle;
  children?: ReactNode;
  backgroundColor?: string;
  borderColor?: string;
  showBorder?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  description,
  onPress,
  style,
  children,
  backgroundColor = COLORS.surface,
  borderColor = COLORS.border,
  showBorder = true,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor,
            borderColor: showBorder ? borderColor : 'transparent',
          },
          SHADOWS.md,
          style,
        ]}
      >
        {title && (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}

        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}

        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}

        {children && <View style={styles.content}>{children}</View>}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginVertical: SIZES.sm,
    borderWidth: 1,
  },
  title: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  subtitle: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
  },
  description: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  content: {
    marginTop: SIZES.md,
  },
});

export default Card;
