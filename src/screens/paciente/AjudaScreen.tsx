import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, TYPOGRAPHY } from '../../styles/theme';

const FAQs = [
  {
    question: 'Como fazer a triagem inicial?',
    answer: '1. Vá para aba "Triagem"\n2. Responda todas as perguntas com cuidado\n3. Tire fotos da boca se solicitado\n4. Envie para análise do dentista\n\nA triagem leva 2-3 minutos e é essencial para seu atendimento.'
  },
  {
    question: 'Como agendar uma consulta?',
    answer: '1. Vá para "Início" ou aba "Agendamento"\n2. Escolha o dentista e especialidade\n3. Selecione data/horário disponível\n4. Confirme pagamento ou seguro\n5. Receba confirmação por notificação'
  },
  {
    question: 'Onde vejo meu histórico?',
    answer: 'Na aba "Histórico" você encontra:\n• Triagens anteriores\n• Consultas realizadas\n• Relatórios dos dentistas\n• Faturas e comprovantes\n\nToque em qualquer item para detalhes completos.'
  },
  {
    question: 'Como enviar mensagens?',
    answer: '1. Vá para aba "Mensagens"\n2. Selecione dentista ou conversa\n3. Digite sua mensagem\n4. Adicione fotos se necessário\n5. Toque "Enviar"\n\nRespostas chegam em até 24h úteis.'
  },
  {
    question: 'Esqueci minha senha',
    answer: '1. Na tela de login, toque "Esqueci senha"\n2. Digite seu email\n3. Verifique inbox/spam\n4. Siga link para criar nova senha\n5. Faça login com nova senha\n\nLink expira em 1 hora.'
  },
  {
    question: 'Meu perfil está incompleto',
    answer: 'O app força completar telefone e província na primeira vez.\n1. Vá para "Perfil"\n2. Preencha telefone e província\n3. Salve alterações\n4. Escolha seu dentista preferido\n\nEsses dados são obrigatórios para contato.'
  },
  {
    question: 'Não recebo notificações',
    answer: '1. Ative notificações nas configurações do celular\n2. No app: Configurações → Notificações\n3. Verifique conexão internet\n4. Reinicie o app\n\nNotificações sobre triagens, consultas e mensagens.'
  },
  {
    question: 'Problemas técnicos?',
    answer: 'Contato imediato:\n📞 +244 912 345 678\n📧 suporte@teodontoangola.com\n\nHorário: Seg-Sex 8h-18h\nEmergências dentárias: ligue imediatamente!'
  }
];

const TUTORIAIS = [
  {
    title: 'Higiene Bucal Diária',
    content: '• Escove 2x ao dia (2 minutos cada)\n• Use fio dental 1x ao dia\n• Enxaguante bucal após refeições\n• Troque escova a cada 3 meses\n• Evite doces entre refeições'
  },
  {
    title: 'Cuidados Pós-Triagem',
    content: '• Não coma 2h após triagem\n• Evite fumo 24h\n• Beba água normalmente\n• Se dor: paracetamol (consulte dentista)\n• Retorne se inchaço ou sangramento'
  },
  {
    title: 'Navegação no App',
    content: '🏠 Início: Notícias e próximas consultas\n🩺 Triagem: Autoavaliação bucal\n📅 Agendamento: Marque sua consulta\n💬 Mensagens: Chat com dentista\n📋 Histórico: Todos seus registros\n👤 Perfil: Seus dados'
  },
  {
    title: 'Preparação Consulta Online',
    content: '1. Boa iluminação para câmera\n2. Ambiente silencioso\n3. Carregador celular pronto\n4. Teste internet antes\n5. Tenha histórico/app aberto\n6. Esteja pronto 5min antes'
  }
];

export default function AjudaScreen() {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [ligarSuporte] = useState(() => () => Linking.openURL('tel:+244912345678'));
  const [enviarEmail] = useState(() => () => Linking.openURL('mailto:suporte@teodontoangola.com?subject=Ajuda TeOdonto&body=Descreva seu problema:'));

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>🦷 Central de Ajuda</Text>
      <Text style={styles.description}>
        Respostas rápidas para usar o Odonto. Toque nas perguntas para expandir.
      </Text>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="help-circle" size={24} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Perguntas Frequentes (8)</Text>
        </View>
        {FAQs.map((faq, index) => (
          <TouchableOpacity
            key={index}
            style={styles.faqItem}
            onPress={() => toggleFAQ(index)}
            activeOpacity={0.7}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <Ionicons 
                name={expandedFAQ === index ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={COLORS.textSecondary} 
              />
            </View>
            {expandedFAQ === index && (
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="videocam" size={24} color={COLORS.secondary} />
          <Text style={styles.sectionTitle}>Tutoriais Rápidos (4)</Text>
        </View>
        {TUTORIAIS.map((tutorial, index) => (
          <View key={index} style={styles.tutorialCard}>
            <Text style={styles.tutorialTitle}>{tutorial.title}</Text>
            <Text style={styles.tutorialContent}>{tutorial.content}</Text>
          </View>
        ))}
      </View>

      <View style={styles.suporteSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="headset" size={24} color={COLORS.danger} />
          <Text style={styles.sectionTitle}>📞 Suporte Direto</Text>
        </View>
        
        <TouchableOpacity style={styles.supportButton} onPress={ligarSuporte}>
          <Ionicons name="call" size={24} color={COLORS.success} />
          <View>
            <Text style={styles.supportLabel}>Ligar Gratuito</Text>
            <Text style={styles.supportText}>+244 912 345 678 </Text>
            <Text style={styles.supportText}>Segunda à Sexta, 8h-18h</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.supportButton} onPress={enviarEmail}>
          <Ionicons name="mail" size={24} color={COLORS.primary} />
          <View>
            <Text style={styles.supportLabel}>Enviar Email</Text>
            <Text style={styles.supportText}>suporte@teodontoangola.com</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SIZES.lg,
  },
  header: {
    fontSize: TYPOGRAPHY.sizes.h1,
    fontWeight: 'bold',
    marginBottom: SIZES.md,
    color: COLORS.text,
  },
  description: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
    marginBottom: SIZES.xl,
    lineHeight: 22,
    textAlign: 'center',
  },
  section: {
    backgroundColor: COLORS.surface,
    marginBottom: SIZES.xl,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: SIZES.sm,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: SIZES.md,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: SIZES.md,
  },
  faqAnswer: {
    marginTop: SIZES.sm,
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    paddingTop: SIZES.sm,
    paddingBottom: SIZES.md,
  },
  tutorialCard: {
    backgroundColor: COLORS.background,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary + '40',
  },
  tutorialTitle: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  tutorialContent: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  suporteSection: {
    backgroundColor: COLORS.danger + '05',
    borderRadius: SIZES.radiusLg,
    padding: SIZES.lg,
    marginBottom: SIZES.xl,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.danger + '20',
  },
  supportLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  supportText: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.text,
    fontWeight: '600',
    marginTop: 2,
  },
});
