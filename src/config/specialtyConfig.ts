/**
 * Configuração de Especialidades do Dentista
 * Define visual, ações e tipos de consulta por especialidade
 */

export interface EspecialidadeConfig {
  key: string;
  label: string;
  icon: string; // Ionicons name
  color: string;
  colorLight: string;
  descricao: string;
  tiposConsulta: string[];
  acoesRapidas: Array<{ label: string; icon: string; screen?: string }>;
  metricas: string[]; // quais métricas mostrar no dashboard
}

const BASE_ACOES: Array<{ label: string; icon: string; screen?: string }> = [];

export const ESPECIALIDADES: Record<string, EspecialidadeConfig> = {
  geral: {
    key: 'geral',
    label: 'Clínica Geral',
    icon: 'medkit',
    color: '#1E88E5',
    colorLight: '#E3F2FD',
    descricao: 'Atendimento odontológico geral',
    tiposConsulta: ['consulta', 'avaliacao', 'retorno', 'urgencia', 'profilaxia', 'restauracao', 'raio_x'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Triagens', icon: 'medical', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'urgentes', 'atrasados', 'realizados', 'financeiro'],
  },
  ortodontia: {
    key: 'ortodontia',
    label: 'Ortodontia',
    icon: 'git-compare',
    color: '#7B1FA2',
    colorLight: '#F3E5F5',
    descricao: 'Correção de dentes e mordida',
    tiposConsulta: ['ortodontia', 'avaliacao', 'retorno', 'consulta', 'raio_x', 'panoramico'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Evoluções', icon: 'git-compare', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'retornos', 'realizados', 'financeiro'],
  },
  endodontia: {
    key: 'endodontia',
    label: 'Endodontia',
    icon: 'flash',
    color: '#E65100',
    colorLight: '#FFF3E0',
    descricao: 'Tratamento de canal',
    tiposConsulta: ['canal', 'avaliacao', 'retorno', 'raio_x', 'urgencia'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Canais Hoje', icon: 'flash', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'urgentes', 'realizados', 'financeiro'],
  },
  periodontia: {
    key: 'periodontia',
    label: 'Periodontia',
    icon: 'leaf',
    color: '#2E7D32',
    colorLight: '#E8F5E9',
    descricao: 'Tratamento de gengiva e periodonto',
    tiposConsulta: ['consulta', 'profilaxia', 'avaliacao', 'retorno', 'raio_x'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Profilaxias', icon: 'leaf', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'realizados', 'financeiro'],
  },
  cirurgia: {
    key: 'cirurgia',
    label: 'Cirurgia Oral',
    icon: 'cut',
    color: '#C62828',
    colorLight: '#FFEBEE',
    descricao: 'Cirurgias e extrações',
    tiposConsulta: ['consulta', 'avaliacao', 'urgencia', 'retorno', 'raio_x', 'panoramico'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Cirurgias', icon: 'cut', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'urgentes', 'realizados', 'financeiro'],
  },
  odontopediatria: {
    key: 'odontopediatria',
    label: 'Odontopediatria',
    icon: 'happy',
    color: '#00897B',
    colorLight: '#E0F2F1',
    descricao: 'Atendimento infantil',
    tiposConsulta: ['consulta', 'avaliacao', 'profilaxia', 'restauracao', 'retorno', 'urgencia'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Crianças Hoje', icon: 'happy', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'realizados', 'financeiro'],
  },
  protese: {
    key: 'protese',
    label: 'Prótese Dentária',
    icon: 'construct',
    color: '#4527A0',
    colorLight: '#EDE7F6',
    descricao: 'Próteses e reabilitação oral',
    tiposConsulta: ['consulta', 'avaliacao', 'retorno', 'raio_x', 'panoramico'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Moldagens', icon: 'construct', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'realizados', 'financeiro'],
  },
  implantodontia: {
    key: 'implantodontia',
    label: 'Implantodontia',
    icon: 'hammer',
    color: '#01579B',
    colorLight: '#E1F5FE',
    descricao: 'Implantes dentários',
    tiposConsulta: ['consulta', 'avaliacao', 'retorno', 'raio_x', 'panoramico'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Implantes', icon: 'hammer', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'realizados', 'financeiro'],
  },
  estetica: {
    key: 'estetica',
    label: 'Estética Dental',
    icon: 'sparkles',
    color: '#AD1457',
    colorLight: '#FCE4EC',
    descricao: 'Branqueamento e estética',
    tiposConsulta: ['branqueamento', 'consulta', 'avaliacao', 'retorno', 'restauracao'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Branqueamentos', icon: 'sparkles', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'realizados', 'financeiro'],
  },
};

/**
 * Retorna a configuração da especialidade. Fallback para "geral".
 */
export const getEspecialidadeConfig = (especialidade?: string | null): EspecialidadeConfig => {
  if (!especialidade) return ESPECIALIDADES.geral;
  const key = especialidade.toLowerCase().replace(/\s+/g, '').replace(/í/g, 'i').replace(/é/g, 'e').replace(/ó/g, 'o');
  
  // try direct match
  if (ESPECIALIDADES[key]) return ESPECIALIDADES[key];
  
  // fuzzy match
  const found = Object.values(ESPECIALIDADES).find(
    (e) => e.label.toLowerCase().replace(/\s+/g, '') === key ||
           e.key === key
  );
  
  return found || ESPECIALIDADES.geral;
};

/**
 * Lista de especialidades para seleção
 */
export const ESPECIALIDADES_LIST = Object.values(ESPECIALIDADES).map((e) => ({
  value: e.key,
  label: e.label,
  icon: e.icon,
  color: e.color,
}));
