/**
 * AuditLogScreen — Painel de Auditoria do Sistema
 * TeOdonto Angola — Organizado, intuitivo e de fácil manuseio.
 * 
 * Permite aos Administradores monitorizar todas as acções, acessos,
 * alterações e segurança em tempo real com filtros rápidos, pesquisa
 * inteligente e visualização detalhada de dados e diffs.
 */

import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { auditService, AuditEntry, AuditAcao } from '../../services/auditService';
import { COLORS } from '../../styles/theme';

// ─── Metadados por Acção ───────────────────────────────────────────────────

interface AcaoMeta {
  cor: string;
  icone: keyof typeof Ionicons.glyphMap;
  label: string;
  categoria: 'auth' | 'security' | 'user' | 'clinic' | 'crud';
}

const ACAO_META: Record<string, AcaoMeta> = {
  LOGIN: {
    cor: '#1E88E5',
    icone: 'log-in-outline',
    label: 'Login Realizado',
    categoria: 'auth',
  },
  LOGOUT: {
    cor: '#546E7A',
    icone: 'log-out-outline',
    label: 'Terminou Sessão',
    categoria: 'auth',
  },
  LOGIN_FAIL: {
    cor: '#E53935',
    icone: 'alert-circle-outline',
    label: 'Falha de Login',
    categoria: 'auth',
  },
  RESET_PASSWORD: {
    cor: '#FB8C00',
    icone: 'key-outline',
    label: 'Recuperação de Senha',
    categoria: 'security',
  },
  ALTERAR_SENHA: {
    cor: '#F57C00',
    icone: 'lock-closed-outline',
    label: 'Senha Alterada',
    categoria: 'security',
  },
  CRIAR_UTILIZADOR: {
    cor: '#2E7D32',
    icone: 'person-add-outline',
    label: 'Novo Utilizador',
    categoria: 'user',
  },
  APAGAR_UTILIZADOR: {
    cor: '#D32F2F',
    icone: 'person-remove-outline',
    label: 'Utilizador Removido',
    categoria: 'user',
  },
  ATRIBUIR_DENTISTA: {
    cor: '#7B1FA2',
    icone: 'medkit-outline',
    label: 'Dentista Atribuído',
    categoria: 'clinic',
  },
  RECUSAR_TRIAGEM: {
    cor: '#E64A19',
    icone: 'close-circle-outline',
    label: 'Triagem Recusada',
    categoria: 'clinic',
  },
  REJEITAR_AGENDAMENTO: {
    cor: '#D84315',
    icone: 'calendar-clear-outline',
    label: 'Agendamento Rejeitado',
    categoria: 'clinic',
  },
  INSERT: {
    cor: '#43A047',
    icone: 'add-circle-outline',
    label: 'Registo Criado',
    categoria: 'crud',
  },
  UPDATE: {
    cor: '#0288D1',
    icone: 'create-outline',
    label: 'Registo Actualizado',
    categoria: 'crud',
  },
  DELETE: {
    cor: '#C62828',
    icone: 'trash-outline',
    label: 'Registo Eliminado',
    categoria: 'crud',
  },
};

const DEFAULT_META: AcaoMeta = {
  cor: '#78909C',
  icone: 'receipt-outline',
  label: 'Operação do Sistema',
  categoria: 'crud',
};

const getMeta = (acao: string): AcaoMeta => ACAO_META[acao] ?? DEFAULT_META;

// ─── Categorias Rápidas ────────────────────────────────────────────────────

interface CategoriaFiltro {
  id: string;
  label: string;
  icone: keyof typeof Ionicons.glyphMap;
  acoes: AuditAcao[];
}

const CATEGORIAS_FILTRO: CategoriaFiltro[] = [
  { id: 'TODOS', label: 'Todos', icone: 'apps-outline', acoes: [] },
  {
    id: 'LOGINS',
    label: 'Logins & Sessões',
    icone: 'log-in-outline',
    acoes: ['LOGIN', 'LOGOUT'],
  },
  {
    id: 'FALHAS',
    label: 'Alertas / Falhas',
    icone: 'alert-circle-outline',
    acoes: ['LOGIN_FAIL'],
  },
  {
    id: 'SEGURANCA',
    label: 'Segurança & Senhas',
    icone: 'lock-closed-outline',
    acoes: ['ALTERAR_SENHA', 'RESET_PASSWORD'],
  },
  {
    id: 'UTILIZADORES',
    label: 'Utilizadores',
    icone: 'people-outline',
    acoes: ['CRIAR_UTILIZADOR', 'APAGAR_UTILIZADOR'],
  },
  {
    id: 'CLINICA',
    label: 'Clínica & Triagens',
    icone: 'fitness-outline',
    acoes: ['ATRIBUIR_DENTISTA', 'RECUSAR_TRIAGEM', 'REJEITAR_AGENDAMENTO'],
  },
  {
    id: 'MODIFICACOES',
    label: 'Modificações (BD)',
    icone: 'sync-outline',
    acoes: ['INSERT', 'UPDATE', 'DELETE'],
  },
];

const TABELAS_FILTRO = [
  'profiles',
  'agendamentos',
  'triagens',
  'fichas_clinicas',
  'planos_tratamento',
  'audit_log',
];

// ─── Sanitização de dados sensíveis ────────────────────────────────────────

const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /senha/i,
  /token/i,
  /secret/i,
  /key/i,
  /auth/i,
  /session/i,
  /refresh/i,
  /otp/i,
  /mfa/i,
  /codigo/i,
  /pin/i,
];

const shouldHideAuditValue = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0);

const sanitizeAuditValue = (key: string, value: unknown): unknown => {
  if (SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(key))) {
    return '•••••••• [oculto por segurança]';
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) => sanitizeAuditValue(`${key}_${index}`, item))
      .filter((item) => !shouldHideAuditValue(item));
  }

  if (value && typeof value === 'object') {
    return sanitizeAuditData(value as Record<string, unknown>);
  }

  if (typeof value === 'string' && value.length > 500) {
    return `${value.slice(0, 500)}...`;
  }

  return value;
};

const sanitizeAuditData = (data?: Record<string, unknown> | null): Record<string, unknown> | null => {
  if (!data) return null;

  const entries = Object.entries(data)
    .map(([key, value]) => [key, sanitizeAuditValue(key, value)] as const)
    .filter(([, value]) => !shouldHideAuditValue(value));

  return entries.length > 0 ? Object.fromEntries(entries) : null;
};

// ─── Formatadores ──────────────────────────────────────────────────────────

const formatDateTime = (iso: string): { data: string; hora: string; amigavel: string } => {
  try {
    const d = new Date(iso);
    const agora = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const data = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

    const diffMinutos = Math.floor((agora.getTime() - d.getTime()) / 60000);

    let amigavel = data;
    if (diffMinutos < 1) {
      amigavel = 'Agora mesmo';
    } else if (diffMinutos < 60) {
      amigavel = `Há ${diffMinutos} min`;
    } else if (
      d.getDate() === agora.getDate() &&
      d.getMonth() === agora.getMonth() &&
      d.getFullYear() === agora.getFullYear()
    ) {
      amigavel = `Hoje às ${hora}`;
    } else {
      const ontem = new Date(agora);
      ontem.setDate(ontem.getDate() - 1);
      if (
        d.getDate() === ontem.getDate() &&
        d.getMonth() === ontem.getMonth() &&
        d.getFullYear() === ontem.getFullYear()
      ) {
        amigavel = `Ontem às ${hora}`;
      }
    }

    return { data, hora, amigavel };
  } catch {
    return { data: iso, hora: '', amigavel: iso };
  }
};

const getRoleBadge = (tipo?: string | null): { label: string; cor: string } => {
  const role = (tipo ?? '').toLowerCase();
  if (role.includes('admin')) return { label: 'ADMIN', cor: '#E53935' };
  if (role.includes('dentista') || role.includes('medico')) return { label: 'DENTISTA', cor: '#1E88E5' };
  if (role.includes('secret')) return { label: 'SECRETARIA', cor: '#FB8C00' };
  if (role.includes('paciente')) return { label: 'PACIENTE', cor: '#43A047' };
  return { label: role ? role.toUpperCase() : 'SISTEMA', cor: '#78909C' };
};

// ─── Componente Card do Log ────────────────────────────────────────────────

interface AuditCardProps {
  item: AuditEntry;
  onPress: (entry: AuditEntry) => void;
}

const AuditCard: React.FC<AuditCardProps> = ({ item, onPress }) => {
  const meta = getMeta(item.acao);
  const time = formatDateTime(item.created_at);
  const role = getRoleBadge(item.user_tipo);

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: meta.cor }]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Log ${meta.label} por ${item.user_email ?? 'Sistema'}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.cardIconBubble, { backgroundColor: meta.cor + '18' }]}>
            <Ionicons name={meta.icone} size={18} color={meta.cor} />
          </View>
          <View style={styles.cardTitleBox}>
            <Text style={[styles.cardActionLabel, { color: meta.cor }]}>{meta.label}</Text>
            <View style={styles.cardMetaRow}>
              {item.tabela ? (
                <View style={styles.tableBadge}>
                  <Text style={styles.tableBadgeText}>{item.tabela}</Text>
                </View>
              ) : null}
              {item.registo_id ? (
                <Text style={styles.recordIdSnippet} numberOfLines={1}>
                  #{item.registo_id.slice(0, 8)}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.cardTimeBox}>
          <Text style={styles.cardTimeFriendly}>{time.amigavel}</Text>
          <Text style={styles.cardTimeExact}>{time.hora || time.data}</Text>
        </View>
      </View>

      {item.descricao ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.descricao}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <View style={styles.userInfoRow}>
          <Ionicons name="person-circle-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.userEmailText} numberOfLines={1}>
            {item.user_email || 'Sistema / Anon'}
          </Text>
          <View style={[styles.roleTag, { backgroundColor: role.cor + '15' }]}>
            <Text style={[styles.roleTagText, { color: role.cor }]}>{role.label}</Text>
          </View>
        </View>

        <View style={styles.viewDetailsRow}>
          <Text style={styles.viewDetailsText}>Detalhes</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Componente Principal ──────────────────────────────────────────────────

const AuditLogScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('TODOS');
  const [filtroTabela, setFiltroTabela] = useState<string>('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [modalTab, setModalTab] = useState<'info' | 'dados'>('info');

  // Carregar dados
  const carregarDados = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await auditService.listar({
        limit: 250,
      });
      if (res.success && res.data) {
        setEntries(res.data);
      }
    } catch {
      // Ignora erro silenciosamente
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [carregarDados])
  );

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await carregarDados(true);
  };

  // Configuração do Header de navegação
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Registo de Auditoria',
      headerLeft: () => (
        <View style={styles.headerLeft}>
          <Ionicons name="shield-checkmark" size={24} color="#fff" />
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleRefresh}
            accessibilityRole="button"
            accessibilityLabel="Atualizar registos"
          >
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => setShowFilterModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Filtros avançados"
          >
            <Ionicons name="filter" size={20} color="#fff" />
            {filtroTabela ? <View style={styles.filterActiveDot} /> : null}
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, filtroTabela]);

  // Contadores para KPIs Rápidos
  const kpiStats = useMemo(() => {
    const total = entries.length;
    let logins = 0;
    let alertas = 0;
    let alteracoes = 0;

    for (const e of entries) {
      if (e.acao === 'LOGIN' || e.acao === 'LOGOUT') logins++;
      else if (
        e.acao === 'LOGIN_FAIL' ||
        e.acao === 'ALTERAR_SENHA' ||
        e.acao === 'RESET_PASSWORD'
      )
        alertas++;
      else if (e.acao === 'INSERT' || e.acao === 'UPDATE' || e.acao === 'DELETE')
        alteracoes++;
    }

    return { total, logins, alertas, alteracoes };
  }, [entries]);

  // Filtragem dinâmica
  const entriesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const categoriaConfig = CATEGORIAS_FILTRO.find((c) => c.id === categoriaAtiva);
    const acoesPermitidas = categoriaConfig?.acoes ?? [];

    return entries.filter((e) => {
      // Filtro de categoria rápida
      if (acoesPermitidas.length > 0 && !acoesPermitidas.includes(e.acao as AuditAcao)) {
        return false;
      }

      // Filtro de tabela específica
      if (filtroTabela && e.tabela !== filtroTabela) {
        return false;
      }

      // Filtro de pesquisa de texto
      if (q) {
        const meta = getMeta(e.acao);
        const emailMatch = e.user_email?.toLowerCase().includes(q);
        const tipoMatch = e.user_tipo?.toLowerCase().includes(q);
        const descMatch = e.descricao?.toLowerCase().includes(q);
        const acaoMatch = e.acao?.toLowerCase().includes(q) || meta.label.toLowerCase().includes(q);
        const tabelaMatch = e.tabela?.toLowerCase().includes(q);
        const idMatch = e.registo_id?.toLowerCase().includes(q);

        if (!emailMatch && !tipoMatch && !descMatch && !acaoMatch && !tabelaMatch && !idMatch) {
          return false;
        }
      }

      return true;
    });
  }, [entries, busca, categoriaAtiva, filtroTabela]);

  const limparTodosFiltros = () => {
    setBusca('');
    setCategoriaAtiva('TODOS');
    setFiltroTabela('');
  };

  const temFiltroAtivo = categoriaAtiva !== 'TODOS' || !!filtroTabela || !!busca.trim();

  return (
    <View style={styles.container}>
      {/* ─── Cartões de KPI Rápidos ─── */}
      <View style={styles.kpiContainer}>
        <TouchableOpacity
          style={[
            styles.kpiCard,
            categoriaAtiva === 'TODOS' && styles.kpiCardSelected,
          ]}
          onPress={() => setCategoriaAtiva('TODOS')}
          activeOpacity={0.8}
        >
          <View style={styles.kpiTopRow}>
            <Ionicons name="layers-outline" size={16} color="#546E7A" />
            <Text style={styles.kpiValue}>{kpiStats.total}</Text>
          </View>
          <Text style={styles.kpiTitle}>Total Geral</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.kpiCard,
            categoriaAtiva === 'LOGINS' && styles.kpiCardSelected,
          ]}
          onPress={() => setCategoriaAtiva('LOGINS')}
          activeOpacity={0.8}
        >
          <View style={styles.kpiTopRow}>
            <Ionicons name="log-in-outline" size={16} color="#1E88E5" />
            <Text style={[styles.kpiValue, { color: '#1E88E5' }]}>{kpiStats.logins}</Text>
          </View>
          <Text style={styles.kpiTitle}>Acessos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.kpiCard,
            categoriaAtiva === 'FALHAS' && styles.kpiCardSelected,
          ]}
          onPress={() => setCategoriaAtiva('FALHAS')}
          activeOpacity={0.8}
        >
          <View style={styles.kpiTopRow}>
            <Ionicons name="alert-circle-outline" size={16} color="#E53935" />
            <Text style={[styles.kpiValue, { color: '#E53935' }]}>{kpiStats.alertas}</Text>
          </View>
          <Text style={styles.kpiTitle}>Alertas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.kpiCard,
            categoriaAtiva === 'MODIFICACOES' && styles.kpiCardSelected,
          ]}
          onPress={() => setCategoriaAtiva('MODIFICACOES')}
          activeOpacity={0.8}
        >
          <View style={styles.kpiTopRow}>
            <Ionicons name="sync-outline" size={16} color="#43A047" />
            <Text style={[styles.kpiValue, { color: '#43A047' }]}>{kpiStats.alteracoes}</Text>
          </View>
          <Text style={styles.kpiTitle}>Edições</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Barra de Pesquisa Rápida ─── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9E9E9E" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Pesquisar por email, acção, tabela, id..."
            placeholderTextColor="#9E9E9E"
            value={busca}
            onChangeText={setBusca}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {busca ? (
            <TouchableOpacity onPress={() => setBusca('')} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={18} color="#757575" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.filterBtn, (filtroTabela || showFilterModal) && styles.filterBtnActive]}
          onPress={() => setShowFilterModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Abrir filtros"
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={filtroTabela ? '#fff' : COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      {/* ─── Pílulas de Categoria Horizontal ─── */}
      <View style={styles.categoryBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {CATEGORIAS_FILTRO.map((cat) => {
            const isSelected = categoriaAtiva === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryPill, isSelected && styles.categoryPillSelected]}
                onPress={() => setCategoriaAtiva(cat.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cat.icone}
                  size={14}
                  color={isSelected ? '#fff' : '#616161'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[styles.categoryPillText, isSelected && styles.categoryPillTextSelected]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── Indicador de Filtros Activos & Contador ─── */}
      <View style={styles.resultsInfoRow}>
        <Text style={styles.resultsCountText}>
          Exibindo <Text style={styles.resultsCountBold}>{entriesFiltradas.length}</Text> registos
          {temFiltroAtivo ? ' filtrados' : ''}
        </Text>

        {temFiltroAtivo ? (
          <TouchableOpacity
            style={styles.clearAllFiltersBtn}
            onPress={limparTodosFiltros}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle-outline" size={14} color={COLORS.danger} />
            <Text style={styles.clearAllFiltersText}>Limpar filtros</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ─── Lista de Registos de Auditoria ─── */}
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingTitle}>A carregar auditoria...</Text>
          <Text style={styles.loadingSubtitle}>A recolher eventos mais recentes do sistema</Text>
        </View>
      ) : entriesFiltradas.length === 0 ? (
        <View style={styles.centerBox}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="file-tray-outline" size={44} color="#9E9E9E" />
          </View>
          <Text style={styles.emptyTitle}>Nenhum registo encontrado</Text>
          <Text style={styles.emptySubtitle}>
            {temFiltroAtivo
              ? 'Nenhuma entrada coincide com a pesquisa ou filtros selecionados.'
              : 'Ainda não existem registos de auditoria registados no sistema.'}
          </Text>
          {temFiltroAtivo ? (
            <TouchableOpacity style={styles.resetSearchBtn} onPress={limparTodosFiltros}>
              <Ionicons name="refresh-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.resetSearchBtnText}>Mostrar todos os registos</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={entriesFiltradas}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AuditCard
              item={item}
              onPress={(entry) => {
                setSelectedEntry(entry);
                setModalTab('info');
              }}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ─── Modal de Detalhes da Entrada ─── */}
      <Modal
        visible={!!selectedEntry}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEntry(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedEntry && (
              <>
                {/* Cabeçalho do Modal */}
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderInfo}>
                    <View
                      style={[
                        styles.modalHeaderIconBox,
                        { backgroundColor: getMeta(selectedEntry.acao).cor + '20' },
                      ]}
                    >
                      <Ionicons
                        name={getMeta(selectedEntry.acao).icone}
                        size={22}
                        color={getMeta(selectedEntry.acao).cor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>
                        {getMeta(selectedEntry.acao).label}
                      </Text>
                      <Text style={styles.modalSubtitle}>
                        {formatDateTime(selectedEntry.created_at).data} às{' '}
                        {formatDateTime(selectedEntry.created_at).hora}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedEntry(null)}
                  >
                    <Ionicons name="close" size={24} color="#424242" />
                  </TouchableOpacity>
                </View>

                {/* Abas do Modal */}
                <View style={styles.modalTabsRow}>
                  <TouchableOpacity
                    style={[styles.modalTabBtn, modalTab === 'info' && styles.modalTabBtnActive]}
                    onPress={() => setModalTab('info')}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={modalTab === 'info' ? COLORS.primary : '#757575'}
                    />
                    <Text
                      style={[
                        styles.modalTabText,
                        modalTab === 'info' && styles.modalTabTextActive,
                      ]}
                    >
                      Informações Gerais
                    </Text>
                  </TouchableOpacity>

                  {(selectedEntry.dados_antes || selectedEntry.dados_depois) && (
                    <TouchableOpacity
                      style={[styles.modalTabBtn, modalTab === 'dados' && styles.modalTabBtnActive]}
                      onPress={() => setModalTab('dados')}
                    >
                      <Ionicons
                        name="code-slash-outline"
                        size={16}
                        color={modalTab === 'dados' ? COLORS.primary : '#757575'}
                      />
                      <Text
                        style={[
                          styles.modalTabText,
                          modalTab === 'dados' && styles.modalTabTextActive,
                        ]}
                      >
                        Dados & Alterações
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Conteúdo do Modal */}
                <ScrollView style={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
                  {modalTab === 'info' ? (
                    <View style={styles.infoTabContainer}>
                      {/* Cartão de Operador */}
                      <View style={styles.detailSectionCard}>
                        <Text style={styles.detailSectionTitle}>Operador / Utilizador</Text>
                        <DetailItem
                          icon="mail-outline"
                          label="Email"
                          value={selectedEntry.user_email || 'Não autenticado / Sistema'}
                        />
                        <DetailItem
                          icon="person-outline"
                          label="Perfil de Acesso"
                          value={
                            selectedEntry.user_tipo ? selectedEntry.user_tipo.toUpperCase() : 'N/A'
                          }
                          badgeColor={getRoleBadge(selectedEntry.user_tipo).cor}
                        />
                        {selectedEntry.user_id ? (
                          <DetailItem
                            icon="finger-print-outline"
                            label="ID do Utilizador"
                            value={selectedEntry.user_id}
                            isMonospace
                          />
                        ) : null}
                      </View>

                      {/* Cartão de Alvo / Registo */}
                      <View style={styles.detailSectionCard}>
                        <Text style={styles.detailSectionTitle}>Contexto do Registo</Text>
                        <DetailItem
                          icon="hardware-chip-outline"
                          label="Acção"
                          value={`${getMeta(selectedEntry.acao).label} (${selectedEntry.acao})`}
                        />
                        <DetailItem
                          icon="layers-outline"
                          label="Tabela Alvo"
                          value={selectedEntry.tabela || 'Geral / Auth'}
                        />
                        {selectedEntry.registo_id ? (
                          <DetailItem
                            icon="key-outline"
                            label="ID do Registo"
                            value={selectedEntry.registo_id}
                            isMonospace
                          />
                        ) : null}
                      </View>

                      {/* Descrição se houver */}
                      {selectedEntry.descricao ? (
                        <View style={styles.detailSectionCard}>
                          <Text style={styles.detailSectionTitle}>Descrição da Operação</Text>
                          <Text style={styles.descriptionFullText}>{selectedEntry.descricao}</Text>
                        </View>
                      ) : null}

                      {/* Metadados Técnicos */}
                      {(selectedEntry.ip || selectedEntry.user_agent) && (
                        <View style={styles.detailSectionCard}>
                          <Text style={styles.detailSectionTitle}>Rastreio Técnico</Text>
                          {selectedEntry.ip ? (
                            <DetailItem
                              icon="globe-outline"
                              label="Endereço IP"
                              value={selectedEntry.ip}
                              isMonospace
                            />
                          ) : null}
                          {selectedEntry.user_agent ? (
                            <DetailItem
                              icon="laptop-outline"
                              label="Navegador / Dispositivo"
                              value={selectedEntry.user_agent}
                            />
                          ) : null}
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.dataTabContainer}>
                      <Text style={styles.dataTabNotice}>
                        Valores sensíveis (como palavras-passe e tokens) são mascarados
                        automaticamente por protecção de dados.
                      </Text>

                      {selectedEntry.dados_antes && (
                        <View style={[styles.jsonCard, { borderLeftColor: '#E53935' }]}>
                          <View style={styles.jsonCardHeader}>
                            <Ionicons name="arrow-undo-outline" size={16} color="#E53935" />
                            <Text style={[styles.jsonCardTitle, { color: '#E53935' }]}>
                              Dados Anteriores (Antes da Alteração)
                            </Text>
                          </View>
                          <Text style={styles.jsonCardContent}>
                            {JSON.stringify(sanitizeAuditData(selectedEntry.dados_antes), null, 2)}
                          </Text>
                        </View>
                      )}

                      {selectedEntry.dados_depois && (
                        <View style={[styles.jsonCard, { borderLeftColor: '#43A047' }]}>
                          <View style={styles.jsonCardHeader}>
                            <Ionicons name="arrow-redo-outline" size={16} color="#43A047" />
                            <Text style={[styles.jsonCardTitle, { color: '#43A047' }]}>
                              Dados Novos (Depois da Alteração)
                            </Text>
                          </View>
                          <Text style={styles.jsonCardContent}>
                            {JSON.stringify(sanitizeAuditData(selectedEntry.dados_depois), null, 2)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── Modal de Filtros Avançados ─── */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalBox}>
            <View style={styles.filterModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="filter" size={20} color={COLORS.primary} />
                <Text style={styles.filterModalTitle}>Filtros Avançados</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={22} color="#757575" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.filterSectionHeader}>Filtrar por Tabela / Entidade</Text>
              <View style={styles.tableFilterGrid}>
                <TouchableOpacity
                  style={[
                    styles.tableFilterChip,
                    filtroTabela === '' && styles.tableFilterChipActive,
                  ]}
                  onPress={() => setFiltroTabela('')}
                >
                  <Text
                    style={[
                      styles.tableFilterChipText,
                      filtroTabela === '' && styles.tableFilterChipTextActive,
                    ]}
                  >
                    Todas as tabelas
                  </Text>
                </TouchableOpacity>

                {TABELAS_FILTRO.map((tbl) => {
                  const isActive = filtroTabela === tbl;
                  return (
                    <TouchableOpacity
                      key={tbl}
                      style={[styles.tableFilterChip, isActive && styles.tableFilterChipActive]}
                      onPress={() => setFiltroTabela(tbl)}
                    >
                      <Text
                        style={[
                          styles.tableFilterChipText,
                          isActive && styles.tableFilterChipTextActive,
                        ]}
                      >
                        {tbl}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.filterSectionHeader, { marginTop: 16 }]}>
                Ações Rápidas
              </Text>
              <TouchableOpacity
                style={styles.filterResetActionBtn}
                onPress={() => {
                  limparTodosFiltros();
                  setShowFilterModal(false);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#D32F2F" />
                <Text style={styles.filterResetActionText}>Restaurar Todos os Filtros</Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={styles.filterApplyButton}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={styles.filterApplyButtonText}>Ver Resultados</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Sub-Componente de Item de Detalhe ──────────────────────────────────────

const DetailItem: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isMonospace?: boolean;
  badgeColor?: string;
}> = ({ icon, label, value, isMonospace, badgeColor }) => (
  <View style={styles.detailItemRow}>
    <View style={styles.detailItemLabelBox}>
      <Ionicons name={icon} size={15} color="#757575" style={{ marginRight: 6 }} />
      <Text style={styles.detailItemLabel}>{label}</Text>
    </View>

    {badgeColor ? (
      <View style={[styles.detailItemBadge, { backgroundColor: badgeColor + '18' }]}>
        <Text style={[styles.detailItemBadgeText, { color: badgeColor }]}>{value}</Text>
      </View>
    ) : (
      <Text
        style={[styles.detailItemValue, isMonospace && styles.detailItemValueMono]}
        numberOfLines={2}
        selectable
      >
        {value}
      </Text>
    )}
  </View>
);

// ─── Folha de Estilos ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },

  // Header da Navegação
  headerLeft: {
    marginLeft: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 12,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFEB3B',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },

  // KPIs
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 860,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#ECEFF1',
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 6px rgba(0,0,0,0.04)' } : {}),
  },
  kpiCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0F7FF',
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#263238',
  },
  kpiTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78909C',
  },

  // Pesquisa
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 10,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 860,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    ...(Platform.OS === 'web' ? { boxShadow: '0 1px 4px rgba(0,0,0,0.03)' } : {}),
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#212121',
    height: '100%',
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  // Categorias Horizontais
  categoryBarContainer: {
    paddingVertical: 4,
    marginBottom: 4,
  },
  categoryScrollContent: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryPillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#616161',
  },
  categoryPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Info de Resultados
  resultsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 860,
  },
  resultsCountText: {
    fontSize: 12,
    color: '#757575',
  },
  resultsCountBold: {
    fontWeight: '800',
    color: '#212121',
  },
  clearAllFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clearAllFiltersText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.danger,
  },

  // Lista
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 40,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 860,
  },

  // Cartão de Log
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#ECEFF1',
    elevation: 2,
    ...(Platform.OS === 'web' ? { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' } : {}),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cardIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleBox: {
    flex: 1,
  },
  cardActionLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  tableBadge: {
    backgroundColor: '#ECEFF1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tableBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#455A64',
  },
  recordIdSnippet: {
    fontSize: 10,
    color: '#9E9E9E',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cardTimeBox: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  cardTimeFriendly: {
    fontSize: 11,
    fontWeight: '700',
    color: '#424242',
  },
  cardTimeExact: {
    fontSize: 10,
    color: '#9E9E9E',
    marginTop: 1,
  },
  cardDescription: {
    fontSize: 13,
    color: '#424242',
    lineHeight: 18,
    marginBottom: 10,
    backgroundColor: '#F8F9FA',
    padding: 8,
    borderRadius: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  userEmailText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#37474F',
    maxWidth: 180,
  },
  roleTag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Estados Vazios e Loading
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginTop: 14,
  },
  loadingSubtitle: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#212121',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#757575',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
    lineHeight: 18,
  },
  resetSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 18,
  },
  resetSearchBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // Modal de Detalhes
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    padding: Platform.OS === 'web' ? 20 : 0,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderRadius: Platform.OS === 'web' ? 20 : undefined,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 760 : undefined,
    maxHeight: Platform.OS === 'web' ? '88%' : '90%',
    paddingBottom: 24,
    ...(Platform.OS === 'web' ? { boxShadow: '0 20px 50px rgba(0,0,0,0.25)' } : {}),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalHeaderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#212121',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  modalTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingHorizontal: 16,
  },
  modalTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modalTabBtnActive: {
    borderBottomColor: COLORS.primary,
  },
  modalTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#757575',
  },
  modalTabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  modalScrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  infoTabContainer: {
    gap: 14,
    paddingBottom: 20,
  },
  detailSectionCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#546E7A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detailItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailItemLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailItemLabel: {
    fontSize: 12,
    color: '#616161',
  },
  detailItemValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#212121',
    maxWidth: '55%',
    textAlign: 'right',
  },
  detailItemValueMono: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#37474F',
  },
  detailItemBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  detailItemBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  descriptionFullText: {
    fontSize: 13,
    color: '#212121',
    lineHeight: 19,
  },

  // Aba de Dados / JSON
  dataTabContainer: {
    gap: 14,
    paddingBottom: 20,
  },
  dataTabNotice: {
    fontSize: 11,
    color: '#757575',
    backgroundColor: '#F5F5F5',
    padding: 10,
    borderRadius: 8,
    lineHeight: 16,
  },
  jsonCard: {
    backgroundColor: '#263238',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
  },
  jsonCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  jsonCardTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  jsonCardContent: {
    color: '#80CBC4',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
    ...(Platform.OS === 'web' ? ({ wordBreak: 'break-word' } as any) : {}),
  },

  // Modal de Filtros Avançados
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  filterModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxWidth: 420,
    padding: 20,
    elevation: 8,
    ...(Platform.OS === 'web' ? { boxShadow: '0 16px 40px rgba(0,0,0,0.2)' } : {}),
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  filterModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#212121',
  },
  filterSectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#37474F',
    marginBottom: 10,
  },
  tableFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tableFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tableFilterChipActive: {
    backgroundColor: COLORS.primary + '18',
    borderColor: COLORS.primary,
  },
  tableFilterChipText: {
    fontSize: 12,
    color: '#616161',
    fontWeight: '600',
  },
  tableFilterChipTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  filterResetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFEBEE',
    marginTop: 8,
  },
  filterResetActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D32F2F',
  },
  filterApplyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  filterApplyButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});

export default AuditLogScreen;
