/**
 * Constantes da aplicação
 * Inclui status, prioridades, categorias e outras configurações
 */

// Status de Triagem
export const STATUS_TRIAGEM: Record<string, { label: string; color: string; icon: string }> = {
  pendente: {
    label: 'Pendente',
    color: '#FFA726',
    icon: 'time-outline',
  },
  respondido: {
    label: 'Respondido',
    color: '#66BB6A',
    icon: 'checkmark-circle-outline',
  },
  urgente: {
    label: 'Urgente',
    color: '#EF5350',
    icon: 'alert-circle-outline',
  },
  completo: {
    label: 'Finalizado',
    color: '#42A5F5',
    icon: 'checkmark-done-outline',
  },
  realizado: {
    label: 'Realizado',
    color: '#9C27B0',
    icon: 'checkmark-done-outline',
  },
};

// Status de Agendamento
export const STATUS_AGENDAMENTO: Record<string, { label: string; color: string; icon: string }> = {
  pendente: {
    label: 'Pendente',
    color: '#FFA726',
    icon: 'time-outline',
  },
  agendado: {
    label: 'Agendado',
    color: '#42A5F5',
    icon: 'calendar-outline',
  },
  confirmado: {
    label: 'Confirmado',
    color: '#66BB6A',
    icon: 'checkmark-circle-outline',
  },
  cancelado: {
    label: 'Cancelado',
    color: '#EF5350',
    icon: 'close-circle-outline',
  },
  realizado: {
    label: 'Realizado',
    color: '#9C27B0',
    icon: 'checkmark-done-outline',
  },
};

// Prioridades
export const PRIORIDADE: Record<string, { label: string; color: string }> = {
  baixa: {
    label: 'Baixa',
    color: '#66BB6A',
  },
  normal: {
    label: 'Normal',
    color: '#FFA726',
  },
  alta: {
    label: 'Alta',
    color: '#EF5350',
  },
  urgente: {
    label: 'Urgente',
    color: '#D32F2F',
  },
};

// Recomendações
export const RECOMENDACAO: Record<string, { label: string; color: string; icon: string }> = {
  higiene: {
    label: 'Melhorar Higiene',
    color: '#42A5F5',
    icon: 'water-outline',
  },
  consulta: {
    label: 'Agendar Consulta',
    color: '#66BB6A',
    icon: 'calendar-outline',
  },
  tratamento: {
    label: 'Iniciar Tratamento',
    color: '#FFA726',
    icon: 'medical-outline',
  },
  emergencia: {
    label: 'Búsca Emergência',
    color: '#EF5350',
    icon: 'alert-circle-outline',
  },
  prevencao: {
    label: 'Prevenção',
    color: '#9C27B0',
    icon: 'shield-checkmark-outline',
  },
};

// Categorias de Conteúdo Educativo
export const CATEGORIAS_CONTEUDO = [
  {
    id: 'todos',
    label: 'Todos',
    icon: 'document-text-outline',
  },
  {
    id: 'prevencao',
    label: 'Prevenção',
    icon: 'shield-checkmark-outline',
  },
  {
    id: 'higiene',
    label: 'Higiene',
    icon: 'water-outline',
  },
  {
    id: 'doencas',
    label: 'Doenças',
    icon: 'alert-circle-outline',
  },
  {
    id: 'criancas',
    label: 'Crianças',
    icon: 'happy-outline',
  },
  {
    id: 'emergencias',
    label: 'Emergências',
    icon: 'alert-outline',
  },
  {
    id: 'nutricao',
    label: 'Nutrição',
    icon: 'nutrition-outline',
  },
];
// Sintomas comuns
export const SINTOMAS = [
  {
    id: 'dor_espotaneo',
    label: 'Dor Espontânea',
    icon: 'alert-circle-outline',
  },
  {
    id: 'dor_mastigacao',
    label: 'Dor ao Mastigar',
    icon: 'nutrition-outline',
  },
  {
    id: 'sensibilidade',
    label: 'Sensibilidade',
    icon: 'thermometer',
  },
  {
    id: 'inflamacao',
    label: 'Inflamação',
    icon: 'pulse',
  },
  {
    id: 'halitose',
    label: 'Halitose',
    icon: 'leaf-outline',
  },
  {
    id: 'sangramento',
    label: 'Sangramento',
    icon: 'water-outline',
  },
  {
    id: 'mobilidade',
    label: 'Mobilidade',
    icon: 'resize',
  },
  {
    id: 'extracao',
    label: 'Extração de Dente',
    icon: 'remove-circle-outline',
  },
  {
    id: 'outro',
    label: 'Outro',
    icon: 'help-circle-outline',
  },
];

// Duração de sintomas
export const DURACAO_OPTIONS = [
  { id: 'menos_24h', label: 'Menos de 24h' },
  { id: '1_3_dias', label: '1 a 3 dias' },
  { id: '1_semana', label: '1 semana' },
  { id: '1_mes', label: '1 mês' },
  { id: 'mais_mes', label: 'Mais de 1 mês' },
];

// Localização de dentes
export const LOCALIZACAO_DENTE = [
  { id: 'superior_direito', label: 'Superior Direito' },
  { id: 'superior_esquerdo', label: 'Superior Esquerdo' },
  { id: 'superior_centro', label: 'Superior Centro' },
  { id: 'inferior_direito', label: 'Inferior Direito' },
  { id: 'inferior_esquerdo', label: 'Inferior Esquerdo' },
  { id: 'inferior_centro', label: 'Inferior Centro' },
  { id: 'multiplos', label: 'Múltiplos locais' },
];

// Províncias de Angola
export const PROVINCIAS_ANGOLA = [
  'Bengo',
  'Benguela',
  'Bié',
  'Cabinda',
  'Cuando Cubango',
  'Cuanza Norte',
  'Cuanza Sul',
  'Cunene',
  'Huambo',
  'Huíla',
  'Kwando Kubango',
  'Luanda',
  'Lunda Norte',
  'Lunda Sul',
  'Malanje',
  'Moxico',
  'Namibe',
  'Uíge',
  'Zaire',
];

// Tipos de Consulta/Agendamento
export const TIPOS_CONSULTA: Record<string, { label: string; icon: string; color: string }> = {
  consulta: {
    label: 'Consulta de Rotina',
    icon: 'calendar',
    color: '#1976D2',
  },
  avaliacao: {
    label: 'Avaliação Inicial',
    icon: 'search',
    color: '#388E3C',
  },
  retorno: {
    label: 'Retorno',
    icon: 'refresh',
    color: '#FFA000',
  },
  urgencia: {
    label: 'Urgência',
    icon: 'alert-circle',
    color: '#D32F2F',
  },
  raio_x: {
    label: 'Exame de Raio X',
    icon: 'camera',
    color: '#7B1FA2',
  },
  panoramico: {
    label: 'Panorâmico Periapical',
    icon: 'scan',
    color: '#388E3C',
  },
  profilaxia: {
    label: 'Profilaxia',
    icon: 'water',
    color: '#00BCD4',
  },
  branqueamento: {
    label: 'Branqueamento',
    icon: 'sparkles',
    color: '#FF9800',
  },
  canal: {
    label: 'Tratamento de Canal',
    icon: 'git-commit',
    color: '#E91E63',
  },
  ortodontia: {
    label: 'Aparelho Dentário',
    icon: 'construct',
    color: '#3F51B5',
  },
  restauracao: {
    label: 'Restauração',
    icon: 'brush',
    color: '#795548',
  },
};
