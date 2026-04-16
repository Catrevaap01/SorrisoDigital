import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../styles/theme';
import { listarDentistasPorEspecialidade } from '../services/secretarioService';

interface AssignmentModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (dentistaId: string, observacao?: string) => Promise<void>;
  pacienteNome: string;
  especialidadeSugerida?: string;
  loading?: boolean;
}

const ESPECIALIDADES = [
  'Todas',
  'Clínica Geral',
  'Ortodontia',
  'Endodontia',
  'Periodontia',
  'Odontopediatria',
  'Cirurgia Oral',
  'Implantologia',
  'Estética',
];

const AssignmentModal: React.FC<AssignmentModalProps> = ({
  visible,
  onClose,
  onConfirm,
  pacienteNome,
  especialidadeSugerida,
  loading = false,
}) => {
  const [dentistas, setDentistas] = useState<any[]>([]);
  const [loadingDentistas, setLoadingDentistas] = useState(false);
  const [selectedDentista, setSelectedDentista] = useState<string | null>(null);
  const [especialidadeFiltro, setEspecialidadeFiltro] = useState(especialidadeSugerida || 'Todas');
  const [observacao, setObservacao] = useState('');
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (visible) {
      carregarDentistas();
    }
  }, [visible, especialidadeFiltro]);

  const carregarDentistas = async () => {
    setLoadingDentistas(true);
    const esp = especialidadeFiltro === 'Todas' ? undefined : especialidadeFiltro;
    const res = await listarDentistasPorEspecialidade(esp);
    if (res.success && res.data) {
      setDentistas(res.data);
    }
    setLoadingDentistas(false);
  };

  const handleConfirm = async () => {
    if (!selectedDentista) return;
    setConfirmando(true);
    await onConfirm(selectedDentista, observacao);
    setConfirmando(false);
    onClose();
    // Reset state
    setSelectedDentista(null);
    setObservacao('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Atribuir Dentista</Text>
              <Text style={styles.subtitle}>Paciente: {pacienteNome}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Filtro de Especialidade */}
            <Text style={styles.label}>Filtrar por Especialidade</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.espRow}>
              {ESPECIALIDADES.map((esp) => (
                <TouchableOpacity
                  key={esp}
                  style={[
                    styles.espBtn,
                    especialidadeFiltro === esp && styles.espBtnActive,
                  ]}
                  onPress={() => setEspecialidadeFiltro(esp)}
                >
                  <Text style={[
                    styles.espBtnText,
                    especialidadeFiltro === esp && styles.espBtnTextActive,
                  ]}>
                    {esp}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Seleção de Dentista */}
            <Text style={styles.label}>Selecionar Dentista *</Text>
            {loadingDentistas ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : dentistas.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum dentista encontrado para esta especialidade.</Text>
            ) : (
              <View style={styles.list}>
                {dentistas.map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[
                      styles.dentItem,
                      selectedDentista === d.id && styles.dentItemActive,
                    ]}
                    onPress={() => setSelectedDentista(d.id)}
                  >
                    <View style={styles.dentInfo}>
                      <Text style={[
                        styles.dentName,
                        selectedDentista === d.id && { color: 'white' }
                      ]}>
                        Dr(a). {d.nome}
                      </Text>
                      <Text style={[
                        styles.dentEsp,
                        selectedDentista === d.id && { color: 'rgba(255,255,255,0.8)' }
                      ]}>
                        {d.especialidade || 'Clínica Geral'}
                      </Text>
                    </View>
                    {selectedDentista === d.id && (
                      <Ionicons name="checkmark-circle" size={24} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Observação */}
            <Text style={styles.label}>Observação para o Dentista</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Paciente com dor intensa há 3 dias..."
              value={observacao}
              onChangeText={setObservacao}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!selectedDentista || confirmando) && styles.confirmBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedDentista || confirmando}
            >
              {confirmando ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirmar Atribuição</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    ...SHADOWS.lg,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 10,
  },
  espRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  espBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    marginRight: 8,
    backgroundColor: '#F9F9F9',
  },
  espBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  espBtnText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  espBtnTextActive: {
    color: 'white',
  },
  list: {
    gap: 8,
    marginBottom: 16,
  },
  dentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
  },
  dentItemActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  dentInfo: {
    flex: 1,
  },
  dentName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  dentEsp: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    height: 80,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 20,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginVertical: 20,
    fontSize: 14,
  },
});

export default AssignmentModal;
