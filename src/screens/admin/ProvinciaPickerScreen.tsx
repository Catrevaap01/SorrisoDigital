import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../../navigation/types';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<AdminStackParamList, 'ProvinciaPicker'>;

const ProvinciaPickerScreen: React.FC<Props> = ({ route, navigation }) => {
  const { options, selected, modo } = route.params;

  React.useEffect(() => {
    if ((route.params as any).onSelect) {
      navigation.setParams({ onSelect: undefined } as any);
    }
  }, []);

  const handleChoose = (value: string) => {
    navigation.navigate('AdminDashboard', { pickedProvincia: value, modo });
    navigation.goBack();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Selecionar Província</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {options.length === 0 ? (
            <Text style={styles.empty}>Nenhuma província definida</Text>
          ) : (
            options.map((prov) => {
              const isSelected = selected === prov;
              return (
                <TouchableOpacity
                  key={prov}
                  style={[styles.item, isSelected && styles.itemActive]}
                  onPress={() => handleChoose(prov)}
                >
                  <Text style={[styles.itemText, isSelected && styles.itemTextActive]}>
                    {prov}
                  </Text>
                  {isSelected && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  list: {
    paddingHorizontal: SPACING.lg,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemActive: {
    backgroundColor: '#E3F2FD',
  },
  itemText: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.text,
  },
  itemTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
});

export default ProvinciaPickerScreen;
