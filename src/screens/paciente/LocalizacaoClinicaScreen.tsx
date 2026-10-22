import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

// ─── Dados fixos da clínica ─────────────────────────────────────────────────
const CLINIC = {
  name: 'One Smile Consultória Dentária',
  address: 'Lubango, Huíla – Angola',
  lat: -14.9218,
  lng: 13.492,
  phone: '+244 900 000 000',
  hours: [
    { day: 'Segunda – Sexta', time: '08:00 – 18:00' },
    { day: 'Sábado', time: '08:00 – 13:00' },
    { day: 'Domingo', time: 'Encerrado' },
  ],
  services: [
    '🦷 Limpeza & Profilaxia',
    '🔵 Ortodontia',
    '⚪ Branqueamento',
    '🩺 Consultas de Urgência',
    '📋 Triagem Digital',
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const isWeb = Platform.OS === 'web';

const openInMaps = () => {
  const label = encodeURIComponent(CLINIC.name);
  const { lat, lng } = CLINIC;

  if (isWeb) {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      '_blank'
    );
    return;
  }

  const url = Platform.select({
    ios: `maps:${lat},${lng}?q=${label}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
  }) as string;

  Linking.canOpenURL(url)
    .then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(
          `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        );
      }
    })
    .catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir o mapa. Verifique as permissões.')
    );
};

const callClinic = () => Linking.openURL(`tel:${CLINIC.phone}`);

// ─── Mapa embutido via Google Maps Embed API (funciona em web e WebView) ─────
const MapEmbed: React.FC = () => {
  const { lat, lng } = CLINIC;
  const zoom = 16;

  if (isWeb) {
    return (
      <iframe
        title="Mapa da Clínica"
        width="100%"
        height="220"
        style={{ border: 0, borderRadius: 12 }}
        loading="lazy"
        src={`https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`}
        allowFullScreen
      />
    );
  }

  // Fallback nativo: placeholder estático com botão para abrir mapa externo
  return (
    <View style={styles.mapFallback}>
      <Text style={styles.mapFallbackIcon}>🗺️</Text>
      <Text style={styles.mapFallbackText}>
        Toque em "Ver no Mapa" para abrir{'\n'}
        no Google Maps ou Apple Maps.
      </Text>
      <Text style={styles.mapCoords}>
        📍 {lat.toFixed(4)}, {lng.toFixed(4)}
      </Text>
    </View>
  );
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function LocalizacaoClinicaScreen() {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (isWeb && navigator.clipboard) {
      navigator.clipboard.writeText(CLINIC.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🦷</Text>
        <Text style={styles.headerTitle}>Localização da Clínica</Text>
        <Text style={styles.headerSub}>Encontre-nos facilmente</Text>
      </View>

      {/* ── Mapa ── */}
      <View style={styles.card}>
        <MapEmbed />
      </View>

      {/* ── Info da Clínica ── */}
      <View style={styles.card}>
        <Text style={styles.clinicName}>{CLINIC.name}</Text>

        <TouchableOpacity style={styles.infoRow} onPress={copyAddress} activeOpacity={0.7}>
          <Text style={styles.infoIcon}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoText}>{CLINIC.address}</Text>
          </View>
          {isWeb && (
            <Text style={styles.copyBadge}>{copied ? '✅ Copiado' : 'Copiar'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.infoRow} onPress={callClinic} activeOpacity={0.7}>
          <Text style={styles.infoIcon}>📞</Text>
          <Text style={[styles.infoText, styles.link]}>{CLINIC.phone}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Botões de Ação ── */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={openInMaps}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>🗺️  Ver no Mapa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={callClinic}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: '#1e4db7' }]}>📞  Ligar</Text>
        </TouchableOpacity>
      </View>

      {/* ── Horários ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>⏰ Horário de Atendimento</Text>
        {CLINIC.hours.map((h) => (
          <View key={h.day} style={styles.hoursRow}>
            <Text style={styles.hoursDay}>{h.day}</Text>
            <Text
              style={[
                styles.hoursTime,
                h.time === 'Encerrado' && styles.closed,
              ]}
            >
              {h.time}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Serviços ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>🩺 Serviços Disponíveis</Text>
        {CLINIC.services.map((s) => (
          <Text key={s} style={styles.serviceItem}>
            {s}
          </Text>
        ))}
      </View>

      {/* ── Dica simples para o paciente ── */}
      <View style={[styles.card, styles.tipCard]}>
        <Text style={styles.tipTitle}>💡 Como chegar?</Text>
        <Text style={styles.tipText}>
          Toque em <Text style={{ fontWeight: '700' }}>"Ver no Mapa"</Text> e o teu
          telemóvel abre o Google Maps com a rota direta para a clínica.{'\n'}
          É fácil — como usar um GPS!
        </Text>
      </View>

    </ScrollView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: '#1e4db7',
    paddingTop: 56,
    paddingBottom: 28,
    alignItems: 'center',
  },
  headerIcon: { fontSize: 40, marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 14, color: '#bfdbfe', marginTop: 4 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },

  clinicName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0c1a3a',
    marginBottom: 12,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoIcon: { fontSize: 20, marginRight: 10 },
  infoText: { fontSize: 14, color: '#374151', flex: 1 },
  link: { color: '#1e4db7', fontWeight: '600' },
  copyBadge: {
    fontSize: 12,
    color: '#1e4db7',
    fontWeight: '700',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },

  btnRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#1e4db7' },
  btnSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#1e4db7',
  },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0c1a3a',
    marginBottom: 12,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  hoursDay: { fontSize: 13, color: '#374151', fontWeight: '500' },
  hoursTime: { fontSize: 13, fontWeight: '700', color: '#1e4db7' },
  closed: { color: '#ef4444' },

  serviceItem: {
    fontSize: 13,
    color: '#374151',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  tipCard: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  tipTitle: { fontSize: 14, fontWeight: '800', color: '#1e4db7', marginBottom: 6 },
  tipText: { fontSize: 13, color: '#374151', lineHeight: 20 },

  mapFallback: {
    height: 180,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  mapFallbackIcon: { fontSize: 48, marginBottom: 10 },
  mapFallbackText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22 },
  mapCoords: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
});
