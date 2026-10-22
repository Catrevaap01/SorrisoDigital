// ─────────────────────────────────────────────────────────────────────────────
// src/config/specialtyConfig.ts
// Configuração visual e funcional de cada especialidade do dentista
// Define ícones, cores, tipos de consulta e acções rápidas por especialidade
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interface que define a estrutura de configuração de uma especialidade
 */
export interface EspecialidadeConfig {
  key: string;          // Identificador único da especialidade (ex: 'geral', 'ortodontia')
  label: string;        // Nome visível ao utilizador (ex: 'Clínica Geral')
  icon: string;         // Nome do ícone Ionicons a usar na interface
  color: string;        // Cor principal da especialidade (hexadecimal)
  colorLight: string;   // Cor clara para fundos e badges (hexadecimal)
  descricao: string;    // Descrição curta da especialidade
  tiposConsulta: string[]; // Lista dos tipos de consulta disponíveis para esta especialidade
  acoesRapidas: Array<{ label: string; icon: string; screen?: string }>; // Atalhos no dashboard
  metricas: string[];   // Quais métricas mostrar no dashboard do dentista
}

// Acções rápidas base — partilhadas por todas as especialidades (actualmente vazia)
const BASE_ACOES: Array<{ label: string; icon: string; screen?: string }> = [];

// ── Mapa de todas as especialidades disponíveis no sistema ────────────────────
// Indexado pela chave (key) da especialidade para acesso rápido
export const ESPECIALIDADES: Record<string, EspecialidadeConfig> = {

  // ── Clínica Geral ───────────────────────────────────────────────────────────
  geral: {
    key: 'geral',
    label: 'Clínica Geral',
    icon: 'medkit',              // Ícone de kit médico
    color: '#1E88E5',            // Azul principal
    colorLight: '#E3F2FD',       // Azul claro para fundo
    descricao: 'Atendimento odontológico geral',
    tiposConsulta: ['consulta', 'avaliacao', 'retorno', 'urgencia', 'profilaxia', 'restauracao', 'raio_x'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Triagens', icon: 'medical', screen: 'Dashboard' }, // Acesso rápido às triagens
    ],
    metricas: ['agenda', 'urgentes', 'atrasados', 'realizados', 'financeiro'],
  },

  // ── Ortodontia ──────────────────────────────────────────────────────────────
  ortodontia: {
    key: 'ortodontia',
    label: 'Ortodontia',
    icon: 'git-compare',         // Ícone de comparação/alinhamento
    color: '#7B1FA2',            // Roxo principal
    colorLight: '#F3E5F5',       // Roxo claro para fundo
    descricao: 'Correção de dentes e mordida',
    tiposConsulta: ['ortodontia', 'avaliacao', 'retorno', 'consulta', 'raio_x', 'panoramico'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Evoluções', icon: 'git-compare', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'retornos', 'realizados', 'financeiro'],
  },

  // ── Endodontia (Tratamento de Canal) ───────────────────────────────────────
  endodontia: {
    key: 'endodontia',
    label: 'Endodontia',
    icon: 'flash',               // Ícone de relâmpago (rapidez/precisão)
    color: '#E65100',            // Laranja escuro
    colorLight: '#FFF3E0',       // Laranja claro para fundo
    descricao: 'Tratamento de canal',
    tiposConsulta: ['canal', 'avaliacao', 'retorno', 'raio_x', 'urgencia'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Canais Hoje', icon: 'flash', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'urgentes', 'realizados', 'financeiro'],
  },

  // ── Periodontia (Gengiva) ───────────────────────────────────────────────────
  periodontia: {
    key: 'periodontia',
    label: 'Periodontia',
    icon: 'leaf',                // Ícone de folha (saúde/natural)
    color: '#2E7D32',            // Verde escuro
    colorLight: '#E8F5E9',       // Verde claro para fundo
    descricao: 'Tratamento de gengiva e periodonto',
    tiposConsulta: ['consulta', 'profilaxia', 'avaliacao', 'retorno', 'raio_x'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Profilaxias', icon: 'leaf', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'realizados', 'financeiro'],
  },

  // ── Cirurgia Oral ───────────────────────────────────────────────────────────
  cirurgia: {
    key: 'cirurgia',
    label: 'Cirurgia Oral',
    icon: 'cut',                 // Ícone de tesoura/bisturi
    color: '#C62828',            // Vermelho escuro
    colorLight: '#FFEBEE',       // Vermelho claro para fundo
    descricao: 'Cirurgias e extrações',
    tiposConsulta: ['consulta', 'avaliacao', 'urgencia', 'retorno', 'raio_x', 'panoramico'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Cirurgias', icon: 'cut', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'urgentes', 'realizados', 'financeiro'],
  },

  // ── Odontopediatria (Crianças) ──────────────────────────────────────────────
  odontopediatria: {
    key: 'odontopediatria',
    label: 'Odontopediatria',
    icon: 'happy',               // Ícone de rosto feliz (crianças)
    color: '#00897B',            // Verde-azulado
    colorLight: '#E0F2F1',       // Verde-azulado claro para fundo
    descricao: 'Atendimento infantil',
    tiposConsulta: ['consulta', 'avaliacao', 'profilaxia', 'restauracao', 'retorno', 'urgencia'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Crianças Hoje', icon: 'happy', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'realizados', 'financeiro'],
  },

  // ── Prótese Dentária ────────────────────────────────────────────────────────
  protese: {
    key: 'protese',
    label: 'Prótese Dentária',
    icon: 'construct',           // Ícone de construção/ferramentas
    color: '#4527A0',            // Roxo-índigo escuro
    colorLight: '#EDE7F6',       // Roxo claro para fundo
    descricao: 'Próteses e reabilitação oral',
    tiposConsulta: ['consulta', 'avaliacao', 'retorno', 'raio_x', 'panoramico'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Moldagens', icon: 'construct', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'realizados', 'financeiro'],
  },

  // ── Implantodontia ──────────────────────────────────────────────────────────
  implantodontia: {
    key: 'implantodontia',
    label: 'Implantodontia',
    icon: 'hammer',              // Ícone de martelo (implantação)
    color: '#01579B',            // Azul escuro
    colorLight: '#E1F5FE',       // Azul claro para fundo
    descricao: 'Implantes dentários',
    tiposConsulta: ['consulta', 'avaliacao', 'retorno', 'raio_x', 'panoramico'],
    acoesRapidas: [
      ...BASE_ACOES,
      { label: 'Implantes', icon: 'hammer', screen: 'Dashboard' },
    ],
    metricas: ['agenda', 'realizados', 'financeiro'],
  },

  // ── Estética Dental ─────────────────────────────────────────────────────────
  estetica: {
    key: 'estetica',
    label: 'Estética Dental',
    icon: 'sparkles',            // Ícone de brilho/faíscas
    color: '#AD1457',            // Rosa escuro
    colorLight: '#FCE4EC',       // Rosa claro para fundo
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
 * Retorna a configuração da especialidade pelo nome.
 * Faz correspondência exacta e depois correspondência aproximada (fuzzy).
 * Se não encontrar, retorna a configuração da especialidade "geral".
 *
 * @param especialidade - Nome ou chave da especialidade (pode ser null/undefined)
 * @returns Configuração da especialidade correspondente
 */
export const getEspecialidadeConfig = (especialidade?: string | null): EspecialidadeConfig => {
  // Se não foi fornecida especialidade, usa "geral" como padrão
  if (!especialidade) return ESPECIALIDADES.geral;

  // Normaliza a chave: minúsculas, sem espaços, sem acentos comuns
  const key = especialidade.toLowerCase()
    .replace(/\s+/g, '')   // Remove espaços
    .replace(/í/g, 'i')    // Substitui í por i
    .replace(/é/g, 'e')    // Substitui é por e
    .replace(/ó/g, 'o');   // Substitui ó por o

  // Tenta correspondência directa pelo identificador normalizado
  if (ESPECIALIDADES[key]) return ESPECIALIDADES[key];

  // Tenta correspondência aproximada por label ou key
  const found = Object.values(ESPECIALIDADES).find(
    (e) => e.label.toLowerCase().replace(/\s+/g, '') === key ||
           e.key === key
  );

  // Retorna o resultado encontrado ou fallback para "geral"
  return found || ESPECIALIDADES.geral;
};

/**
 * Lista simplificada de especialidades para usar em dropdowns/selecções
 * Contém apenas: chave, etiqueta, ícone e cor
 */
export const ESPECIALIDADES_LIST = Object.values(ESPECIALIDADES).map((e) => ({
  value: e.key,    // Valor a guardar na base de dados
  label: e.label,  // Texto visível ao utilizador
  icon: e.icon,    // Nome do ícone Ionicons
  color: e.color,  // Cor principal da especialidade
}));
