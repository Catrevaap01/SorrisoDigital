export type AuthStackParamList = {
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
  AdminReports: undefined;
  AdminPasswordRecovery: undefined;
  AdminProfile: undefined;
};

export type PacienteStackParamList = {
  PacienteTabs: undefined;
  Agendamento: undefined;
  ChooseDentista: undefined; // força paciente escolher dentista antes de triagem/consulta
  Settings: undefined; // tela de configurações do aplicativo
  Notificacoes: undefined;
  NotificacoesDetalhe: undefined;
  Privacidade: undefined;
  TermosUso: undefined;
  Ajuda: undefined;
  TriagemDetalhe: { item: { id: string; tipo: 'triagem' | 'agendamento' } };
};

export type DentistaStackParamList = {
  DentistaTabs: undefined;
  CasoDetalhe: { triagemId: string };
  PacienteHistorico: { pacienteId: string; pacienteNome?: string };
  CadastrarPaciente: undefined;
  Settings: undefined; // mesma tela de configurações usada pelo paciente
  Notificacoes: undefined;
  NotificacoesDetalhe: undefined;
  Privacidade: undefined;
  TermosUso: undefined;
  Ajuda: undefined;
};



export type AdminStackParamList = {
  AdminDashboard: undefined;
  AdminReports: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ChangePassword: undefined;
  DentistaMain: undefined;
  PacienteMain: undefined;
  AdminMain: undefined;
  CompleteProfile: { forceEdit?: boolean } | undefined;
};
