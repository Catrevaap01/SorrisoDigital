/**
 * MfaSetupModal — Gestão de Verificação em Duas Etapas (2FA)
 * Suporta primariamente WhatsApp (envio direto e validação de OTP),
 * além de suporte alternativo a TOTP (Google Authenticator).
 *
 * Compatível com Web, Mobile (iOS/Android) e PWA.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  generateAndSendWhatsAppOtp,
  sanitizeWhatsAppPhone,
  sendWhatsAppMessage,
  verifyWhatsAppOtp,
} from '../services/whatsappMfaService';
import { COLORS, SHADOWS, SIZES, TYPOGRAPHY } from '../styles/theme';
import QRLib from 'qrcode';

/* ──────────────────────────────────────────── */
/*  Renderizador de QR Code (para modo TOTP)     */
/* ──────────────────────────────────────────── */

const QrCodeImage: React.FC<{ uri: string }> = ({ uri }) => {
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    QRLib.toDataURL(uri, {
      width: 240,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl: string) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (!qrDataUrl) {
    return (
      <View
        style={{
          width: 200,
          height: 200,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F1F5F9',
          borderRadius: 12,
        }}
      >
        <Ionicons name="qr-code" size={60} color="#CBD5E1" />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <img
        src={qrDataUrl}
        alt="QR Code MFA"
        width={200}
        height={200}
        style={{ borderRadius: 12, border: '2px solid #e2e8f0' }}
      />
    ) as any;
  }

  const { Image } = require('react-native');
  return (
    <Image
      source={{ uri: qrDataUrl }}
      style={{ width: 200, height: 200, borderRadius: 12 }}
      resizeMode="contain"
    />
  );
};

/* ──────────────────────────────────────────── */
/*  Tipos                                        */
/* ──────────────────────────────────────────── */

export type MfaSetupMode = 'enroll' | 'unenroll';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (mode: MfaSetupMode) => void;
}

type ChannelTab = 'whatsapp' | 'totp';
type Step = 'loading' | 'whatsapp_form' | 'qr' | 'verify_totp' | 'done' | 'error';

interface EnrollData {
  factorId: string;
  qrUri: string;
  secret: string;
}

/* ──────────────────────────────────────────── */
/*  Componente Principal                         */
/* ──────────────────────────────────────────── */

const MfaSetupModal: React.FC<Props> = ({ visible, onClose, onSuccess }) => {
  const { user, profile, updateProfile, refreshProfile } = useAuth();

  const [channel, setChannel] = useState<ChannelTab>('whatsapp');
  const [step, setStep] = useState<Step>('loading');
  const [phone, setPhone] = useState(profile?.telefone || '');
  const [code, setCode] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  // Estados TOTP
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [existingTotpId, setExistingTotpId] = useState<string | null>(null);

  const isWhatsAppActive = Boolean(profile?.two_step_enabled);

  /* ── Inicializar estado ── */
  const initStatus = useCallback(async () => {
    setStep('loading');
    setCode('');
    setErrorMsg('');
    setCodeSent(false);
    setPhone(profile?.telefone || '');

    try {
      // Verificar se há TOTP nativo configurado
      const { data } = await supabase.auth.mfa.listFactors();
      const verifiedTotp = [...(data?.totp || []), ...(data?.all || [])].find(
        (f: any) => f.status === 'verified'
      );
      if (verifiedTotp) {
        setExistingTotpId(verifiedTotp.id);
      } else {
        setExistingTotpId(null);
      }

      setStep('whatsapp_form');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar configurações de 2FA.');
      setStep('error');
    }
  }, [profile?.telefone]);

  useEffect(() => {
    if (visible) {
      void initStatus();
    }
  }, [visible, initStatus]);

  /* ── WhatsApp: Enviar Código de Teste / Ativação ── */
  const handleSendWhatsAppCode = async () => {
    if (!user?.id) return;
    const cleanPhone = sanitizeWhatsAppPhone(phone);
    if (!cleanPhone || cleanPhone.length < 9) {
      Toast.show({
        type: 'error',
        text1: 'Telefone inválido',
        text2: 'Introduza um número de WhatsApp válido (ex: 923 000 000).',
      });
      return;
    }

    setLoadingAction(true);
    try {
      const res = await generateAndSendWhatsAppOtp({
        userId: user.id,
        nome: profile?.nome || 'Utilizador',
        telefone: cleanPhone,
      });

      if (!res.success) {
        throw new Error(res.error || 'Falha ao enviar código para o WhatsApp.');
      }

      setCodeSent(true);
      Toast.show({
        type: 'success',
        text1: 'Código enviado via WhatsApp',
        text2: `Abra o WhatsApp (${cleanPhone}) para consultar o seu código de 6 dígitos.`,
        visibilityTime: 5000,
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro ao enviar WhatsApp',
        text2: err?.message || 'Tente novamente.',
      });
    } finally {
      setLoadingAction(false);
    }
  };

  /* ── WhatsApp: Confirmar Código e Ativar 2FA ── */
  const handleVerifyAndActivateWhatsApp = async () => {
    if (!user?.id) return;
    const cleanCode = code.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      Toast.show({
        type: 'error',
        text1: 'Código incompleto',
        text2: 'O código deve conter 6 dígitos numéricos.',
      });
      return;
    }

    setLoadingAction(true);
    try {
      const verifyRes = await verifyWhatsAppOtp(user.id, cleanCode);
      if (!verifyRes.success) {
        throw new Error(verifyRes.error || 'Código incorreto ou expirado.');
      }

      // Ativar no perfil
      const cleanPhone = sanitizeWhatsAppPhone(phone);
      const updateRes = await updateProfile({
        two_step_enabled: true,
        telefone: cleanPhone,
      });

      if (!updateRes.success) {
        throw new Error(updateRes.error?.message || 'Erro ao gravar definição no perfil.');
      }

      await refreshProfile();
      Toast.show({
        type: 'success',
        text1: '2FA via WhatsApp Ativado! 🔒',
        text2: 'A sua conta agora requer confirmação por WhatsApp a cada login.',
        visibilityTime: 5000,
      });

      onSuccess?.('enroll');
      onClose();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro na ativação',
        text2: err?.message || 'Código inválido.',
      });
    } finally {
      setLoadingAction(false);
    }
  };

  /* ── WhatsApp: Desativar 2FA ── */
  const handleDeactivateWhatsApp = async () => {
    setLoadingAction(true);
    try {
      const res = await updateProfile({
        two_step_enabled: false,
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Erro ao desativar 2FA.');
      }

      await refreshProfile();
      Toast.show({
        type: 'info',
        text1: '2FA Desativado',
        text2: 'A verificação em duas etapas via WhatsApp foi desativada.',
      });

      onSuccess?.('unenroll');
      onClose();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Erro ao desativar',
        text2: err?.message || 'Tente novamente.',
      });
    } finally {
      setLoadingAction(false);
    }
  };

  /* ── TOTP: Iniciar Configuração (Fallback) ── */
  const startTotpEnroll = async () => {
    setStep('loading');
    try {
      const { data: listData } = await supabase.auth.mfa.listFactors();
      const unverified = [...(listData?.totp || []), ...(listData?.all || [])].filter(
        (f: any) => f.status === 'unverified'
      );
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'TeOdonto Angola',
      });
      if (error) throw error;

      setEnrollData({
        factorId: data.id,
        qrUri: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setStep('qr');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao iniciar TOTP.');
      setStep('error');
    }
  };

  const handleVerifyTotp = async () => {
    if (!enrollData?.factorId) return;
    const cleanCode = code.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) return;

    setLoadingAction(true);
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: enrollData.factorId,
      });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challengeData.id,
        code: cleanCode,
      });
      if (verifyErr) throw verifyErr;

      Toast.show({
        type: 'success',
        text1: 'Autenticador TOTP Ativado!',
        text2: 'Configuração concluída com sucesso.',
      });
      onSuccess?.('enroll');
      onClose();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Código incorreto',
        text2: err?.message || 'Verifique o autenticador e tente novamente.',
      });
    } finally {
      setLoadingAction(false);
    }
  };

  /* ──────────────── RENDER DO CONTEÚDO ──────────────── */

  const renderWhatsAppView = () => {
    if (isWhatsAppActive) {
      return (
        <ScrollView contentContainerStyle={styles.bodyScroll}>
          <View style={styles.activeBanner}>
            <View style={styles.activeIconWrap}>
              <Ionicons name="logo-whatsapp" size={32} color="#25D366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>2FA via WhatsApp ACTIVA</Text>
              <Text style={styles.activeSubtitle}>
                A sua conta está protegida. Sempre que fizer login, receberá um código no número:
              </Text>
              <Text style={styles.activePhone}>
                {profile?.telefone || 'Telefone não registado'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.testBtn}
            onPress={handleSendWhatsAppCode}
            disabled={loadingAction}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#059669" />
            <Text style={styles.testBtnText}>
              {loadingAction ? 'Enviando...' : 'Testar Envio no WhatsApp'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={handleDeactivateWhatsApp}
            disabled={loadingAction}
          >
            <Ionicons name="shield-outline" size={18} color="#EF4444" />
            <Text style={styles.dangerBtnText}>
              {loadingAction ? 'Desativando...' : 'Desativar Verificação em Duas Etapas'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.bodyScroll} keyboardShouldPersistTaps="handled">
        <View style={styles.stepHeader}>
          <View style={[styles.stepIcon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="logo-whatsapp" size={36} color="#25D366" />
          </View>
          <Text style={styles.stepTitle}>Verificação por WhatsApp</Text>
          <Text style={styles.stepSubtitle}>
            A cada login, o sistema envia um código de 6 dígitos directamente para o seu WhatsApp para proteger a sua conta.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>NÚMERO DE TELEFONE (WHATSAPP)</Text>
          <View style={styles.phoneInputWrap}>
            <Text style={styles.phonePrefix}>🇦🇴 +244</Text>
            <TextInput
              style={styles.phoneTextInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="9XX XXX XXX"
              keyboardType="phone-pad"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        {!codeSent ? (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#25D366' }]}
            onPress={handleSendWhatsAppCode}
            disabled={loadingAction || !phone.trim()}
          >
            {loadingAction ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Enviar Código no WhatsApp</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ marginTop: 10, gap: 14 }}>
            <View style={styles.codeSentInfo}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.codeSentText}>
                Código enviado para o WhatsApp! Introduza abaixo para confirmar.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>CÓDIGO RECEBIDO (6 DÍGITOS)</Text>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                { backgroundColor: '#059669' },
                (loadingAction || code.length !== 6) && styles.disabledBtn,
              ]}
              onPress={handleVerifyAndActivateWhatsApp}
              disabled={loadingAction || code.length !== 6}
            >
              {loadingAction ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Confirmar e Activar 2FA</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendLink}
              onPress={handleSendWhatsAppCode}
              disabled={loadingAction}
            >
              <Ionicons name="refresh" size={16} color={COLORS.primary} />
              <Text style={styles.resendLinkText}>Reenviar código no WhatsApp</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderTotpView = () => {
    if (step === 'qr' && enrollData) {
      return (
        <ScrollView contentContainerStyle={styles.bodyScroll}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="qr-code-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Digitalizar QR Code</Text>
            <Text style={styles.stepSubtitle}>
              Abra o Google Authenticator ou Microsoft Authenticator e aponte a câmara:
            </Text>
          </View>

          <View style={{ alignItems: 'center', marginVertical: 14 }}>
            <QrCodeImage uri={enrollData.qrUri} />
          </View>

          <View style={styles.secretBox}>
            <Text style={styles.secretLabel}>Chave manual de backup:</Text>
            <Text style={styles.secretKey}>{enrollData.secret}</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 14 }]}
            onPress={() => setStep('verify_totp')}
          >
            <Text style={styles.primaryBtnText}>Continuar para validação</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </ScrollView>
      );
    }

    if (step === 'verify_totp') {
      return (
        <View style={styles.bodyScroll}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>Verificar Código TOTP</Text>
            <Text style={styles.stepSubtitle}>
              Introduza o código de 6 dígitos gerado pela sua aplicação autenticadora:
            </Text>
          </View>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />

          <TouchableOpacity
            style={[styles.primaryBtn, (loadingAction || code.length !== 6) && styles.disabledBtn]}
            onPress={handleVerifyTotp}
            disabled={loadingAction || code.length !== 6}
          >
            {loadingAction ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Confirmar e Activar TOTP</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.bodyScroll}>
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>App Autenticador (TOTP)</Text>
          <Text style={styles.stepSubtitle}>
            Compatível com Google Authenticator, Microsoft Authenticator ou 1Password.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={startTotpEnroll}>
          <Ionicons name="qr-code-outline" size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>Configurar com QR Code</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <View style={styles.sheet}>
          {/* Cabeçalho */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconBadge, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="shield-checkmark" size={20} color="#25D366" />
              </View>
              <Text style={styles.sheetTitle}>Verificação em 2 Etapas</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Selector de Canal: WhatsApp (Principal) vs TOTP */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, channel === 'whatsapp' && styles.tabItemActive]}
              onPress={() => {
                setChannel('whatsapp');
                setStep('whatsapp_form');
              }}
            >
              <Ionicons
                name="logo-whatsapp"
                size={18}
                color={channel === 'whatsapp' ? '#25D366' : COLORS.textSecondary}
              />
              <Text
                style={[styles.tabItemText, channel === 'whatsapp' && styles.tabItemTextActive]}
              >
                WhatsApp (Recomendado)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, channel === 'totp' && styles.tabItemActive]}
              onPress={() => setChannel('totp')}
            >
              <Ionicons
                name="key-outline"
                size={18}
                color={channel === 'totp' ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.tabItemText, channel === 'totp' && styles.tabItemTextActive]}>
                App Autenticador
              </Text>
            </TouchableOpacity>
          </View>

          {/* Conteúdo */}
          <View style={styles.sheetBody}>
            {step === 'loading' ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>A verificar segurança...</Text>
              </View>
            ) : channel === 'whatsapp' ? (
              renderWhatsAppView()
            ) : (
              renderTotpView()
            )}
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

/* ──────────────────────────────────────────── */
/*  Estilos                                       */
/* ──────────────────────────────────────────── */

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 16 : 12,
  },
  keyboardWrap: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: '#fff',
    ...SHADOWS.sm,
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabItemTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
  },
  bodyScroll: {
    padding: 20,
    paddingBottom: 28,
    flexGrow: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  stepIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  formGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  phonePrefix: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginRight: 8,
  },
  phoneTextInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  codeInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 8,
    color: COLORS.text,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    ...SHADOWS.sm,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  codeSentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  codeSentText: {
    flex: 1,
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
  },
  resendLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  resendLinkText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 20,
  },
  activeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  activeSubtitle: {
    fontSize: 12,
    color: '#15803D',
    marginTop: 4,
    lineHeight: 17,
  },
  activePhone: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
    marginTop: 6,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  testBtnText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 14,
    borderRadius: 14,
  },
  dangerBtnText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
  },
  secretBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    marginVertical: 10,
  },
  secretLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  secretKey: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
    letterSpacing: 1,
  },
});

export default MfaSetupModal;
