export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
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
};

export type DentistaStackParamList = {
  DentistaTabs: undefined;
  CasoDetalhe: { triagemId: string };
  PacienteHistorico: { pacienteId: string; pacienteNome?: string };
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  AdminReports: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ChangePassword: undefined;
  DentistaMain: undefined;
  PacienteMain: undefined;
  AdminMain: undefined;
  CompleteProfile: { forceEdit?: boolean } | undefined;
};
