/**
 * Constantes de navegação
 * Evita magic strings espalhadas pela app
 */

export const ROUTE_NAMES = {
  // Auth
  LOGIN: 'Login',
  REGISTER: 'Register',

  // Paciente - Tabs
  HOME: 'Início',
  TRIAGEM: 'Triagem',
  EDUCACAO: 'Educação',
  HISTORICO: 'Histórico',
  PERFIL: 'Perfil',

  // Paciente - Stacks
  AGENDAMENTO: 'Agendamento',

  // Dentista - Tabs
  DASHBOARD: 'Dashboard',
  CASOS: 'Casos',
  AGENDA_DENTISTA: 'AgendaDentista',

  // Dentista - Stacks
  CASO_DETALHE: 'CasoDetalhe',
} as const;

export const STACK_NAMES = {
  AUTH_STACK: 'AuthStack',
  PACIENTE_STACK: 'PacienteStack',
  DENTISTA_STACK: 'DentistaStack',
} as const;

export type RouteName = typeof ROUTE_NAMES[keyof typeof ROUTE_NAMES];
export type StackName = typeof STACK_NAMES[keyof typeof STACK_NAMES];

export default { ROUTE_NAMES, STACK_NAMES };
