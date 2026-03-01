export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
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
  Dentistas: undefined;
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
  Pacientes: undefined;
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
  AdminDashboard: {
    pickedEspecialidade?: string;
    pickedProvincia?: string;
    modo?: 'create' | 'edit';
  } | undefined;
  Relatorio: undefined;
  EspecialidadePicker: {
    options: string[];
    selected?: string;
    modo: 'create' | 'edit';
    // warning: do not pass callbacks here (e.g. onSelect) –
    // navigation state must be serializable. earlier versions used
    // an onSelect callback which caused a warning on restore.
    // the type system forbids any extra props by not using index
    // signatures.
  };
  ProvinciaPicker: {
    options: string[];
    selected?: string;
    modo: 'create' | 'edit';
    // same note as above
  };
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ChangePassword: undefined;
  DentistaMain: undefined;
  PacienteMain: undefined;
  AdminMain: undefined;
};
