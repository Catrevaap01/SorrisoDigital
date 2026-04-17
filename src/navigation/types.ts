export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined; // somente pacientes podem usar
  ChangePassword: undefined;
};

export type PacienteTabParamList = {
  Início: undefined;
  Triagem: undefined;
  Educação: undefined;
  Histórico: undefined;
  Mensagens:
    | {
        openConversationId?: string;
        otherUserName?: string;
        otherUserAvatar?: string;
      }
    | undefined;
  Perfil: undefined;
};

export type DentistaTabParamList = {
  Dashboard: undefined;
  Agenda: undefined;
  Pacientes: undefined;
  Relatorio: undefined;
  Mensagens:
    | {
        openConversationId?: string;
        otherUserName?: string;
        otherUserAvatar?: string;
      }
    | undefined;
  Perfil: undefined;
};

export type AdminTabParamList = {
  AdminDashboard: undefined;
  AdminSecretarios: undefined;
  AdminReports: undefined;
  AdminPasswordRecovery: undefined;
  AdminProfile: undefined;
};

export type SecretarioTabParamList = {
  SecretarioDashboard: undefined;
  Agendamentos: undefined;
  Pacientes: undefined;
  Mensagens:
    | {
        openConversationId?: string;
        otherUserName?: string;
        otherUserAvatar?: string;
      }
    | undefined;
  Perfil: undefined;
};

export type SecretarioStackParamList = {
  SecretarioTabs: undefined;
  AtribuirDentista: { triagemId: string; especialidadeSugerida?: string };
  AtribuirAgendamento: { agendamentoId: string; especialidadeSugerida?: string };
  CadastrarPaciente: undefined;
  Settings: undefined;
  Notificacoes: undefined;
  NotificacoesDetalhe: undefined;
  Privacidade: undefined;
  TermosUso: undefined;
  Ajuda: undefined;
};

export type PacienteStackParamList = {
  PacienteTabs: undefined;
  Agendamento: undefined;
  Settings: undefined; // tela de configurações do aplicativo
  Notificacoes: undefined;
  NotificacoesDetalhe: undefined;
  Privacidade: undefined;
  TermosUso: undefined;
  Ajuda: undefined;
};

export type DentistaStackParamList = {
  DentistaTabs: undefined;
  CasoDetalhe: { triagemId: string };
  PacienteHistorico: { pacienteId: string; pacienteNome?: string };
  CadastrarPaciente: undefined;
  Settings: undefined;
  Notificacoes: undefined;
  NotificacoesDetalhe: undefined;
  Privacidade: undefined;
  TermosUso: undefined;
  Ajuda: undefined;
  // Módulo Clínico
  Anamnese: { triagemId: string; pacienteId: string; pacienteNome?: string };
  PlanoTratamento: { triagemId: string; pacienteId: string; pacienteNome?: string };
  Prescricao: { triagemId: string; pacienteId: string; pacienteNome?: string };
  EvolucaoClinica: { triagemId: string; pacienteId: string; pacienteNome?: string };
};




export type AdminStackParamList = {
  AdminDashboard: undefined;
  AdminReports: undefined;
};

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ChangePassword: undefined;
  DentistaMain: undefined;
  PacienteMain: undefined;
  AdminMain: undefined;
  SecretarioMain: undefined;
  CompleteProfile: { forceEdit?: boolean } | undefined;
};
