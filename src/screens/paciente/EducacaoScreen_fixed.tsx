import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { buscarConteudos, Conteudo } from '../../services/conteudoService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { CATEGORIAS_CONTEUDO } from '../../utils/constants';

const EducacaoScreen: React.FC = () => {
  const [conteudos, setConteudos] = useState<Conteudo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoriaAtiva, setCategoriaAtiva] = useState<'todos' | string>('todos');
  const [conteudoSelecionado, setConteudoSelecionado] = useState<Conteudo | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const carregarConteudos = async (categoria: string | null = null) => {
    setLoading(true);
    try {
      const result = await buscarConteudos(categoria);
      if (result.success && result.data) {
        setConteudos(result.data);
      } else if (result.error) {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Erro ao carregar conteúdos:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro ao carregar conteúdos',
        text2: error.message || 'Verifique sua conexão',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarConteudos(categoriaAtiva === 'todos' ? null : categoriaAtiva);
  }, [categoriaAtiva]);

  const getIconeCategoria = (categoria?: string): React.ComponentProps<typeof Ionicons>['name'] => {
    if (!categoria || categoria === 'todos') return 'document-text-outline' as const;
    const cat = CATEGORIAS_CONTEUDO.find(c => c.id === categoria);
    return (cat?.icon || 'document-text-outline') as React.ComponentProps<typeof Ionicons>['name'];
  };

  const getCorCategoria = (categoria?: string): string => {
    if (!categoria || categoria === 'todos') return COLORS.primary;
    const cores: Record<string, string> = {
      prevencao: '#4CAF50',
      higiene: '#2196F3',
      doencas: '#FF9800',
      criancas: '#E91E63',
      emergencias: '#F44336',
      nutricao: '#9C27B0',
    };
    return cores[categoria] || COLORS.primary;
  };

  const abrirConteudo = (conteudo: Conteudo) => {
    setConteudoSelecionado(conteudo);
    setModalVisible(true);
  };

  const renderConteudo = (conteudo: Conteudo) => {
    const categoria = conteudo.categoria || 'todos';
    const cor = getCorCategoria(categoria);
    
    const categoriaLabel = CATEGORIAS_CONTEUDO.find((c) => c.id === categoria)?.label || categoria || 'Geral';
    
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => abrirConteudo(conteudo)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardIconContainer, { backgroundColor: `${cor}20` }]}>
          <Ionicons name={getIconeCategoria(categoria)} size={28} color={cor} />
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.cardTitulo} numberOfLines={2}>{conteudo.titulo}</Text>
          <Text style={styles.cardDescricao} numberOfLines={2}>{conteudo.descricao}</Text>
          
          <View style={styles.cardFooter}>
            <View style={[styles.categoriaBadge, { backgroundColor: `${cor}20` }]}>
              <Text style={[styles.categoriaText, { color: cor }]}>
                {categoriaLabel}
              </Text>
            </View>
            
            <View style={styles.viewsContainer}>
              <Ionicons name="eye-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.viewsText}>{conteudo.visualizacoes || 0}</Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
      </TouchableOpacity>
    );
  };

  const renderModal = () => {
    if (!conteudoSelecionado) return null;

    const categoria = conteudoSelecionado.categoria || 'todos';
    const cor = getCorCategoria(categoria);

    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { backgroundColor: cor }]}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.modalHeaderContent}>
              <View style={styles.modalIconContainer}>
                <Ionicons 
                  name={getIconeCategoria(categoria)} 
                  size={32} 
                  color="#fff" 
                />
              </View>
              <Text style={styles.modalTitulo}>{conteudoSelecionado.titulo}</Text>
            </View>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {conteudoSelecionado.descricao && (
              <Text style={styles.modalDescricao}>{conteudoSelecionado.descricao}</Text>
            )}

            <View style={styles.modalConteudo}>
              <Text style={styles.modalConteudoText}>
                {conteudoSelecionado.conteudo}
              </Text>
            </View>

            <View style={styles.modalAviso}>
              <Ionicons name="information-circle" size={18} color={COLORS.primary} />
              <Text style={styles.modalAvisoText}>
                Este conteúdo é educativo e não substitui orientação profissional. Em caso de dúvidas, consulte um dentista.
              </Text>
            </View>

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.categoriasContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {CATEGORIAS_CONTEUDO.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoriaButton,
                categoriaAtiva === cat.id && styles.categoriaButtonActive,
              ]}
              onPress={() => setCategoriaAtiva(cat.id as 'todos' | string)}
            >
              <Ionicons
                name={cat.icon as React.ComponentProps<typeof Ionicons>['name']}
                size={18}
                color={categoriaAtiva === cat.id ? COLORS.textInverse : COLORS.primary}
              />
              <Text
                style={[
                  styles.categoriaButtonText,
                  categoriaAtiva === cat.id && styles.categoriaButtonTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando conteúdos...</Text>
        </View>
      ) : conteudos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyText}>Nenhum conteúdo encontrado</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => carregarConteudos(categoriaAtiva === 'todos' ? null : categoriaAtiva)}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.listaContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.destaqueContainer}>
            <Text style={styles.destaqueTitle}>📚 Aprenda sobre Saúde Bucal</Text>
            <Text style={styles.destaqueSubtitle}>
              Conteúdos educativos para você cuidar melhor dos seus dentes
            </Text>
          </View>

          {conteudos.map((conteudo) => renderConteudo(conteudo))}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {renderModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  categoriasContainer: {
    backgroundColor: COLORS.surface,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.sm,
    ...SHADOWS.sm,
  },
  categoriaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusFull,
    backgroundColor: '#E3F2FD',
    marginRight: SIZES.sm,
  },
  categoriaButtonActive: {
    backgroundColor: COLORS.primary,
  },
  categoriaButtonText: {
    marginLeft: SIZES.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },
  categoriaButtonTextActive: {
    color: COLORS.textInverse,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SIZES.md,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: SIZES.md,
    color: COLORS.textSecondary,
    fontSize: SIZES.fontLg,
  },
  retryButton: {
    marginTop: SIZES.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
  },
  retryText: {
    color: COLORS.textInverse,
    fontWeight: '600',
  },
  listaContainer: {
    flex: 1,
  },
  destaqueContainer: {
    backgroundColor: COLORS.primary,
    margin: SIZES.md,
    padding: SIZES.lg,
    borderRadius: SIZES.radiusMd,
  },
  destaqueTitle: {
    fontSize: SIZES.fontXl,
    fontWeight: 'bold',
    color: COLORS.textInverse,
  },
  destaqueSubtitle: {
    fontSize: SIZES.fontMd,
    color: COLORS.textInverse,
    opacity: 0.9,
    marginTop: SIZES.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.sm,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    ...SHADOWS.sm,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: SIZES.md,
    marginRight: SIZES.sm,
  },
  cardTitulo: {
    fontSize: SIZES.fontMd,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  cardDescricao: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SIZES.sm,
  },
  categoriaBadge: {
    paddingHorizontal: SIZES.sm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusSm,
  },
  categoriaText: {
    fontSize: SIZES.fontXs,
    fontWeight: '600',
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewsText: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    paddingTop: 50,
    paddingBottom: SIZES.lg,
    paddingHorizontal: SIZES.md,
  },
  modalBackButton: {
    marginBottom: SIZES.md,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitulo: {
    flex: 1,
    fontSize: SIZES.fontXl,
    fontWeight: 'bold',
    color: COLORS.textInverse,
    marginLeft: SIZES.md,
  },
  modalBody: {
    flex: 1,
    padding: SIZES.md,
  },
  modalDescricao: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: SIZES.md,
    lineHeight: 22,
  },
  modalConteudo: {
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    ...SHADOWS.sm,
  },
  modalConteudoText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    lineHeight: 24,
  },
  modalAviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    marginTop: SIZES.lg,
  },
  modalAvisoText: {
    flex: 1,
    marginLeft: SIZES.sm,
    fontSize: SIZES.fontSm,
    color: COLORS.primary,
    lineHeight: 18,
  },
});

export default EducacaoScreen;
