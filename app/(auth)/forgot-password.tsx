import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { palette } from '../../lib/theme/colors';

const INPUT_BG = '#EEF3E8';

function ChevronLeftIcon({ size = 18, color = palette.graphiteShaft }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15 18L9 12L15 6" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function CheckCircle() {
  return (
    <View style={styles.checkCircleOuter}>
      <View style={styles.checkCircleInner}>
        <Svg width={32} height={32} viewBox="0 0 24 24">
          <Path d="M5 13L9 17L19 7" stroke={palette.graphiteShaft} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </View>
    </View>
  );
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSend() {
    if (!email) return;
    setLoading(true);
    setError('');
    const redirectTo = 'raffliapp://reset-password';
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  async function handleResend() {
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'raffliapp://reset-password' });
    setLoading(false);
  }

  async function handleOpenMail() {
    const urls = ['message://', 'googlegmail://', 'ms-outlook://'];
    for (const url of urls) {
      const can = await Linking.canOpenURL(url);
      if (can) { Linking.openURL(url); return; }
    }
    Linking.openURL('mailto:');
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.sentContainer}>
          <CheckCircle />
          <Text style={styles.sentTitle}>Check your inbox</Text>
          <Text style={styles.sentBody}>We sent a reset link to {email}</Text>
          <Text style={styles.sentHint}>Didn't get it? Check your spam folder.</Text>

          <View style={styles.sentActions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenMail} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Open Mail App</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleResend} hitSlop={8} disabled={loading}>
              <Text style={styles.resendLink}>{loading ? 'Sending…' : 'Resend Link'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
              <Text style={styles.backLink}>Back to Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
            <ChevronLeftIcon size={18} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Log In</Text>
            <Text style={styles.subtitle}>Enter your email and we'll send a reset link. Expires in 15 minutes.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor="#A8B89A"
                value={email}
                onChangeText={t => { setEmail(t); setError(''); }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, !email && styles.btnDisabled]}
              onPress={handleSend} disabled={loading || !email} activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={palette.bunkerSand} /> : <Text style={styles.primaryBtnText}>Send Reset Link</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.centeredLink} onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.backLink}>Back to Log In</Text>
            </TouchableOpacity>

            <View style={styles.hintBox}>
              <Text style={styles.hintText}>Check spam if you don't see it within 2 minutes.</Text>
            </View>

            {!!error && (
              <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bunkerSand },
  scroll: { paddingHorizontal: 28, paddingBottom: 40, flexGrow: 1 },

  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: palette.highVisLime,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8, marginBottom: 28,
  },

  header: { marginBottom: 36 },
  title: { fontSize: 34, fontWeight: '800', color: palette.graphiteShaft, marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7860', lineHeight: 22 },

  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: palette.fairwayGreen },
  input: {
    height: 52, backgroundColor: INPUT_BG, borderRadius: 12,
    paddingHorizontal: 16, fontSize: 15, color: palette.graphiteShaft,
  },

  primaryBtn: {
    height: 56, backgroundColor: palette.graphiteShaft, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: palette.bunkerSand, fontSize: 17, fontWeight: '700' },

  centeredLink: { alignItems: 'center' },
  backLink: { fontSize: 14, color: palette.graphiteShaft, fontWeight: '600', textDecorationLine: 'underline' },

  hintBox: { backgroundColor: INPUT_BG, borderRadius: 10, padding: 14 },
  hintText: { fontSize: 13, color: '#6B7860', lineHeight: 20 },

  errorBox: { backgroundColor: '#FDECEA', borderRadius: 10, padding: 12 },
  errorText: { fontSize: 13, color: palette.sundayRed, textAlign: 'center' },

  // Sent state
  sentContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 36, gap: 12,
  },
  checkCircleOuter: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(224,229,97,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  checkCircleInner: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: palette.highVisLime,
    alignItems: 'center', justifyContent: 'center',
  },
  sentTitle: { fontSize: 28, fontWeight: '800', color: palette.graphiteShaft, textAlign: 'center' },
  sentBody: { fontSize: 15, color: '#6B7860', textAlign: 'center' },
  sentHint: { fontSize: 13, color: '#8A9680', textAlign: 'center' },
  sentActions: { width: '100%', gap: 16, marginTop: 24 },
  resendLink: { textAlign: 'center', fontSize: 15, color: palette.fairwayGreen, fontWeight: '700' },
});
