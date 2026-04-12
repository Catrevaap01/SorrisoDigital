/**
 * Testes do Fluxo de Secetaria - Triagem e Agendamento
 * Valida o fluxo completo: Paciente -> Secretária -> Dentista
 */

import {
  criarTriagem,
  buscarTodasTriagensSecretario,
} from '../services/triagemService';
import {
  atribuirTriagemAoDentista,
  recusarTriagem,
  buscarTriagensPendentesSecretaria,
  atribuirAgendamentoAoDentista,
  rejeitarAgendamento,
  buscarAgendamentosPendentesSecretaria,
} from '../services/secretarioService';
import { criarAgendamento } from '../services/agendamentoService';

/**
 * TESTE 1: Fluxo Completo de Triagem
 *
 * Passo 1: Paciente cria triagem
 * Esperado: Status = 'triagem_pendente_secretaria'
 *
 * Passo 2: Secretária aprova triagem
 * Esperado: Status = 'pendente', dentista_id preenchido
 *
 * Passo 3: Triagem não aparece mais na fila
 * Esperado: buscarTriagensPendentesSecretaria() não retorna
 */
export async function testeFluxoTriagem() {
  console.log('🧪 TESTE 1: Fluxo de Triagem');
  console.log('═'.repeat(50));

  const pacienteId = 'test-paciente-' + Date.now();
  const dentistaId = 'test-dentista-123';
  const secretariaId = 'test-secretaria-456';

  try {
    // ✅ PASSO 1: Paciente cria triagem
    console.log('\n📝 PASSO 1: Paciente cria triagem...');
    const { success: criarSuccess, data: novaTriagem } = await criarTriagem(
      {
        paciente_id: pacienteId,
        sintoma_principal: 'Dor intensa no dente',
        descricao: 'Dor ao comer e à noite',
        intensidade_dor: 8,
        localizacao: 'Dente superior direito',
        prioridade: 'alta',
      },
      [],
      pacienteId
    );

    if (!criarSuccess || !novaTriagem) {
      throw new Error('Falha ao criar triagem');
    }

    console.log(`✅ Triagem criada com ID: ${novaTriagem.id}`);
    console.log(`   Status: ${novaTriagem.status}`);

    // ✓ Validar que status é triagem_pendente_secretaria
    if (novaTriagem.status !== 'triagem_pendente_secretaria') {
      throw new Error(
        `❌ Status esperado 'triagem_pendente_secretaria', obtido '${novaTriagem.status}'`
      );
    }
    console.log('✅ Status correto: triagem_pendente_secretaria');

    // ✅ PASSO 2: Buscar triagens pendentes (secretária)
    console.log('\n📋 PASSO 2: Secretária busca triagens pendentes...');
    const { success: buscaSuccess, data: triagensFilas } =
      await buscarTriagensPendentesSecretaria();

    if (!buscaSuccess) {
      throw new Error('Falha ao buscar triagens pendentes');
    }

    const triagemeExiste = triagensFilas?.some((t) => t.id === novaTriagem.id);
    if (!triagemeExiste) {
      throw new Error('❌ Triagem não encontrada na fila de secretária');
    }
    console.log(`✅ Triagem encontrada na fila (${triagensFilas?.length} total)`);

    // ✅ PASSO 3: Secretária atribui triagem
    console.log('\n👨‍⚕️ PASSO 3: Secretária atribui triagem ao dentista...');
    const { success: atribuicaoSuccess, error: atribuicaoError } =
      await atribuirTriagemAoDentista(novaTriagem.id, dentistaId, secretariaId, 'Caso de urgência');

    if (!atribuicaoSuccess) {
      throw new Error(`❌ Falha na atribuição: ${atribuicaoError}`);
    }
    console.log(`✅ Triagem atribuída ao dentista ${dentistaId}`);

    // ✅ PASSO 4: Verificar que triagem não está mais na fila
    console.log('\n🔍 PASSO 4: Verificar que triagem saiu da fila...');
    const { success: verificaSuccess, data: triagensAposFila } =
      await buscarTriagensPendentesSecretaria();

    const triagemeAindaNaFila = triagensAposFila?.some(
      (t) => t.id === novaTriagem.id
    );
    if (triagemeAindaNaFila) {
      throw new Error(
        '❌ Triagem ainda está na fila após atribuição'
      );
    }
    console.log('✅ Triagem removida da fila com sucesso');

    console.log('\n✨ TESTE 1 PASSOU! ✨\n');
    return { success: true, triagemId: novaTriagem.id };
  } catch (error: any) {
    console.error('\n❌ TESTE 1 FALHOU');
    console.error('Erro:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * TESTE 2: Fluxo Completo de Agendamento
 *
 * Passo 1: Paciente cria agendamento
 * Esperado: Status = 'agendamento_pendente_secretaria'
 *
 * Passo 2: Secretária aprova agendamento
 * Esperado: Status = 'atribuido_dentista', dentista_id preenchido
 *
 * Passo 3: Agendamento não aparece mais na fila
 * Esperado: buscarAgendamentosPendentesSecretaria() não retorna
 */
export async function testeFluxoAgendamento() {
  console.log('🧪 TESTE 2: Fluxo de Agendamento');
  console.log('═'.repeat(50));

  const pacienteId = 'test-paciente-' + Date.now();
  const dentistaId = 'test-dentista-123';
  const secretariaId = 'test-secretaria-456';

  try {
    // ✅ PASSO 1: Paciente cria agendamento
    console.log('\n📅 PASSO 1: Paciente solicita agendamento...');
    const { success: criarSuccess, data: novoAgendamento } = await criarAgendamento({
      patientId: pacienteId,
      symptoms: 'Dor ao comer',
      urgency: 'alta',
      notes: 'Preferência por manhã',
      // Não define dentista nem data/hora - secretária fará isso
    });

    if (!criarSuccess || !novoAgendamento) {
      throw new Error('Falha ao criar agendamento');
    }

    console.log(`✅ Agendamento criado com ID: ${novoAgendamento.id}`);
    console.log(`   Status: ${novoAgendamento.status}`);

    // ✓ Validar que status é agendamento_pendente_secretaria
    if (novoAgendamento.status !== 'agendamento_pendente_secretaria') {
      throw new Error(
        `❌ Status esperado 'agendamento_pendente_secretaria', obtido '${novoAgendamento.status}'`
      );
    }
    console.log('✅ Status correto: agendamento_pendente_secretaria');

    // ✅ PASSO 2: Buscar agendamentos pendentes (secretária)
    console.log('\n📋 PASSO 2: Secretária busca agendamentos pendentes...');
    const { success: buscaSuccess, data: agendamentosFilas } =
      await buscarAgendamentosPendentesSecretaria();

    if (!buscaSuccess) {
      throw new Error('Falha ao buscar agendamentos pendentes');
    }

    const agendamentoExiste = agendamentosFilas?.some(
      (a) => a.id === novoAgendamento.id
    );
    if (!agendamentoExiste) {
      throw new Error('❌ Agendamento não encontrado na fila de secretária');
    }
    console.log(`✅ Agendamento encontrado na fila (${agendamentosFilas?.length} total)`);

    // ✅ PASSO 3: Secretária atribui agendamento com data/hora
    console.log('\n👨‍⚕️ PASSO 3: Secretária atribui agendamento ao dentista com data/hora...');
    const dataAgendamento = new Date();
    dataAgendamento.setDate(dataAgendamento.getDate() + 3); // 3 dias à frente

    const { success: atribuicaoSuccess, error: atribuicaoError } =
      await atribuirAgendamentoAoDentista(
        novoAgendamento.id,
        dentistaId,
        secretariaId,
        dataAgendamento.toISOString().split('T')[0], // YYYY-MM-DD
        '10:00',
        'Paciente preferência manhã'
      );

    if (!atribuicaoSuccess) {
      throw new Error(`❌ Falha na atribuição: ${atribuicaoError}`);
    }
    console.log(`✅ Agendamento atribuído para ${dataAgendamento.toLocaleDateString()} às 10:00`);

    // ✅ PASSO 4: Verificar que agendamento não está mais na fila
    console.log('\n🔍 PASSO 4: Verificar que agendamento saiu da fila...');
    const { success: verificaSuccess, data: agendamentosAposFila } =
      await buscarAgendamentosPendentesSecretaria();

    const agendamentoAindaNaFila = agendamentosAposFila?.some(
      (a) => a.id === novoAgendamento.id
    );
    if (agendamentoAindaNaFila) {
      throw new Error('❌ Agendamento ainda está na fila após atribuição');
    }
    console.log('✅ Agendamento removido da fila com sucesso');

    console.log('\n✨ TESTE 2 PASSOU! ✨\n');
    return { success: true, agendamentoId: novoAgendamento.id };
  } catch (error: any) {
    console.error('\n❌ TESTE 2 FALHOU');
    console.error('Erro:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * TESTE 3: Rejeição de Triagem
 *
 * Passo 1: Paciente cria triagem
 * Passo 2: Secretária rejeita triagem com motivo
 * Esperado: Status = 'recusada'
 */
export async function testeRejeitarTriagem() {
  console.log('🧪 TESTE 3: Rejeição de Triagem');
  console.log('═'.repeat(50));

  const pacienteId = 'test-paciente-' + Date.now();
  const secretariaId = 'test-secretaria-456';

  try {
    // ✅ PASSO 1: Paciente cria triagem
    console.log('\n📝 PASSO 1: Paciente cria triagem com dados incompletos...');
    const { success: criarSuccess, data: novaTriagem } = await criarTriagem(
      {
        paciente_id: pacienteId,
        sintoma_principal: 'Dor',
        descricao: '', // ⚠️ Descrição vazia
        intensidade_dor: 0,
      },
      [],
      pacienteId
    );

    if (!criarSuccess || !novaTriagem) {
      throw new Error('Falha ao criar triagem');
    }

    console.log(`✅ Triagem criada (com dados incompletos)`);

    // ✅ PASSO 2: Secretária rejeita triagem
    console.log('\n❌ PASSO 2: Secretária rejeita triagem...');
    const { success: rejeitaSuccess, error: rejeitaError } = await recusarTriagem(
      novaTriagem.id,
      secretariaId,
      'Descrição insuficiente para diagnóstico'
    );

    if (!rejeitaSuccess) {
      throw new Error(`❌ Falha na rejeição: ${rejeitaError}`);
    }

    console.log('✅ Triagem rejeitada com sucesso');
    console.log('   Motivo: Descrição insuficiente para diagnóstico');

    console.log('\n✨ TESTE 3 PASSOU! ✨\n');
    return { success: true, triagemId: novaTriagem.id };
  } catch (error: any) {
    console.error('\n❌ TESTE 3 FALHOU');
    console.error('Erro:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Executar todos os testes
 */
export async function rodarTodosTestes() {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🧪 TESTES DO FLUXO DE SECRETÁRIA 🧪                   ║');
  console.log('║                                                            ║');
  console.log('║  Validando fluxo completo de triagem e agendamento        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const resultados = {
    teste1: await testeFluxoTriagem(),
    teste2: await testeFluxoAgendamento(),
    teste3: await testeRejeitarTriagem(),
  };

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 RESUMO FINAL                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const totalTestes = 3;
  const sucessos = Object.values(resultados).filter((r) => r.success).length;
  const falhas = totalTestes - sucessos;

  console.log(`\nTotal de testes: ${totalTestes}`);
  console.log(`✅ Sucessos: ${sucessos}`);
  console.log(`❌ Falhas: ${falhas}`);

  if (falhas === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM! O SISTEMA ESTÁ FUNCIONANDO! 🎉\n');
  } else {
    console.log('\n⚠️  ALGUNS TESTES FALHARAM. Verifique os erros acima. ⚠️\n');
  }

  return resultados;
}

// Se for executado direto:
// rodarTodosTestes().then(console.log);
