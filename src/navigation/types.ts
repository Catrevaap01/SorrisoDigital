/**
 * Tipos de navegação para toda a aplicação
 *
 * Centralizar as definições de params ajuda o TypeScript a verificar
 * as chamadas para navigation.navigate e as props recebidas por cada tela.
 */

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ChangePassword: undefined;
};

export type PacienteTabParamList = {
  'Início': undefined;
  Triagem: undefined;
  Educação: undefined;
  Histórico: undefined;
  Perfil: undefined;
};

export type DentistaTabParamList = {
  Dashboard: undefined;
  Agenda: undefined;
  Perfil: undefined;
};

export type AdminTabParamList = {
  AdminDashboard: undefined;
  Relatorio: undefined;
  Perfil: undefined;
};

export type PacienteStackParamList = {
  PacienteTabs: undefined;
  Agendamento: undefined;
};

export type DentistaStackParamList = {
  DentistaTabs: undefined;
  CasoDetalhe: { triagemId: string };
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  Relatorio: undefined;
};

// O stack raiz combina autenticação e principais fluxos de usuário
// Nota: os stacks aninhados (PacienteStack, DentistaStack, AdminStack) possuem suas próprias param lists
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ChangePassword: undefined;
  DentistaMain: undefined;
  PacienteMain: undefined;
  AdminMain: undefined;
};
