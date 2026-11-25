/**
 * Centraliza o registo de todos os handlers de sincronização offline.
 * Deve ser importado no arranque da app (App.tsx) para garantir que,
 * mesmo quando as telas são carregadas em modo lazy, todas as ações
 * pendentes na fila offline tenham o seu handler disponível.
 */
import './agendamentoService';
import './appointmentsService';
import './messagesService';
import './pacienteService';
import './triagemService';

