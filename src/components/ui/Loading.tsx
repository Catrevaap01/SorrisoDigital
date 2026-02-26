/**
 * Componente Loading reutilizável
 * Indicador de carregamento padronizado
 */

import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Modal,
} from 'react-native';
import { COLORS, SIZES } from '../../styles/theme';

export interface LoadingProps {
  visible?: boolean;
  message?: string;
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  visible = false,
  message = 'Carregando...',
  fullScreen = false,
}) => {
  if (!visible && !fullScreen) return null;

  const content = (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator color={COLORS.primary} size="large" />
      {message && <Text style={styles.text}>{message}</Text>}
    </View>
  );

  if (fullScreen) {
    return (
      <Modal transparent visible={visible} statusBarTranslucent>
        <View style={styles.overlay}>{content}</View>
      </Modal>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SIZES.lg,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: SIZES.md,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
});

export default Loading;
