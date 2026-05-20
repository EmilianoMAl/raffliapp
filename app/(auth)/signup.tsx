import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { palette } from '../../lib/theme/colors';

const INPUT_BG = '#EEF3E8';

function ChevronDownIcon({ size = 18, color = palette.graphiteShaft }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 9L12 15L18 9" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// ─── Step 0: Create account ───────────────────────────────────────────────────

function StepAccount({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError("Passwords don't match"); return; }
    if (!agreed) { setError('Please agree to the Terms of Service.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onCreated();
  }

  const canSubmit = !!email && password.length >= 8 && !!confirm && agreed;

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={8}>
        <ChevronDownIcon size={18} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Create your{'\n'}account</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} placeholder="you@email.com" placeholderTextColor="#A8B89A"
            value={email} onChangeText={t => { setEmail(t); setError(''); }}
            autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} placeholder="Min. 8 characters" placeholderTextColor="#A8B89A"
            value={password} onChangeText={t => { setPassword(t); setError(''); }}
            secureTextEntry autoComplete="new-password" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput style={styles.input} placeholder="Re-enter password" placeholderTextColor="#A8B89A"
            value={confirm} onChangeText={t => { setConfirm(t); setError(''); }}
            secureTextEntry autoComplete="new-password" />
        </View>

        {/* Terms */}
        <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.7}>
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.termsText}>I agree to the Terms of Service and Privacy Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, !canSubmit && styles.btnDisabled]}
          onPress={handleCreate} disabled={loading || !canSubmit} activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color={palette.bunkerSand} /> : <Text style={styles.primaryBtnText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchLink} onPress={onBack} hitSlop={8}>
          <Text style={styles.switchText}>Already have an account? <Text style={styles.switchAccent}>Log In</Text></Text>
        </TouchableOpacity>

        {!!error && (
          <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Step 1: Name + Username ──────────────────────────────────────────────────

function StepProfile({
  onNext,
}: {
  onNext: (displayName: string, username: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);

  const checkUsername = useCallback((val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase.from('profiles').select('id').eq('username', val).maybeSingle();
      setUsernameStatus(data ? 'taken' : 'available');
    }, 500);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function handleUsernameChange(v: string) {
    const clean = cleanUsername(v);
    setUsername(clean);
    setError('');
    checkUsername(clean);
  }

  async function handleContinue() {
    if (!displayName.trim()) { setError('Please enter your name.'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (usernameStatus === 'taken') { setError('That username is taken.'); return; }
    if (usernameStatus === 'checking') { setError('Wait for username check to complete.'); return; }
    setLoading(true);
    setError('');
    try {
      await onNext(displayName.trim(), username);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Try again.');
    }
    setLoading(false);
  }

  const canSubmit = !!displayName.trim() && username.length >= 3 && usernameStatus === 'available';

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.progressRow}>
        <Text style={styles.stepLabel}>Step 1 of 2</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '50%' }]} />
        </View>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>What should we{'\n'}call you, golfer?</Text>
        <Text style={styles.subtitle}>Shown on your profile, scorecard, and rivalry feed.</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor="#A8B89A"
            value={displayName} onChangeText={t => { setDisplayName(t); setError(''); }}
            autoCapitalize="words" textContentType="name" autoComplete="name" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput style={styles.input} placeholder="johndoe1" placeholderTextColor="#A8B89A"
            value={username} onChangeText={handleUsernameChange}
            autoCapitalize="none" autoCorrect={false} textContentType="username" autoComplete="username" />
          {usernameStatus === 'taken' && (
            <View style={styles.feedbackBox}>
              <Text style={styles.feedbackError}>Handle '{username}' is taken.</Text>
            </View>
          )}
          {usernameStatus === 'available' && (
            <View style={[styles.feedbackBox, styles.feedbackSuccess]}>
              <Text style={styles.feedbackSuccessText}>Your handle: @{username}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, !canSubmit && styles.btnDisabled, { marginTop: 16 }]}
          onPress={handleContinue} disabled={loading || !canSubmit} activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color={palette.bunkerSand} /> : <Text style={styles.primaryBtnText}>Continue</Text>}
        </TouchableOpacity>

        {!!error && (
          <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Step 2: Handicap ─────────────────────────────────────────────────────────

function StepHandicap({
  onFinish,
}: {
  onFinish: (handicap: number | null, isNew: boolean) => Promise<void>;
}) {
  const [handicap, setHandicap] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);

  function increment() {
    if (isNew) return;
    setHandicap(h => Math.min(54, (h ?? -1) + 1));
  }
  function decrement() {
    if (isNew) return;
    setHandicap(h => Math.max(-10, (h ?? 1) - 1));
  }

  async function handleContinue() {
    setLoading(true);
    await onFinish(isNew ? null : handicap, isNew);
    setLoading(false);
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.progressRow}>
        <Text style={styles.stepLabel}>Step 2 of 2</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>What's your{'\n'}handicap?</Text>
        <Text style={styles.subtitle}>Honest game only.{'\n'}You can update this anytime.</Text>
      </View>

      <View style={styles.form}>
        {/* Stepper */}
        <View style={styles.stepperRow}>
          <TouchableOpacity style={styles.stepperBtn} onPress={decrement} disabled={isNew} activeOpacity={0.7}>
            <Text style={styles.stepperSymbol}>−</Text>
          </TouchableOpacity>
          <View style={styles.stepperDisplay}>
            <Text style={styles.stepperValue}>{isNew || handicap === null ? '- -' : String(handicap)}</Text>
          </View>
          <TouchableOpacity style={styles.stepperBtn} onPress={increment} disabled={isNew} activeOpacity={0.7}>
            <Text style={styles.stepperSymbol}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.stepperLabel}>Handicap Index</Text>

        {/* New to golf toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>New to golf / No official index</Text>
          <Switch
            value={isNew}
            onValueChange={v => { setIsNew(v); if (v) setHandicap(null); }}
            trackColor={{ false: '#D0D8C8', true: palette.highVisLime }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D0D8C8"
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { marginTop: 24 }]}
          onPress={handleContinue} disabled={loading} activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color={palette.bunkerSand} /> : <Text style={styles.primaryBtnText}>Continue</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export default function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const pendingProfileRef = useRef<{ displayName: string; username: string } | null>(null);

  async function handleProfileStep(displayName: string, username: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Session expired. Please sign in again.');
    await supabase.from('profiles').upsert({ id: session.user.id, display_name: displayName, username });
    pendingProfileRef.current = { displayName, username };
    setStep(2);
  }

  async function handleHandicapStep(handicap: number | null, isNew: boolean) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('profiles').update({ handicap_index: handicap, is_new_to_golf: isNew }).eq('id', session.user.id);
    }
    router.replace('/(tabs)');
  }

  if (step === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <StepAccount
            onBack={() => router.back()}
            onCreated={() => setStep(1)}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (step === 1) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <StepProfile
            onNext={handleProfileStep}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StepHandicap
        onFinish={handleHandicapStep}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bunkerSand },
  scroll: { paddingHorizontal: 28, paddingBottom: 40, flexGrow: 1 },

  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: palette.highVisLime,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 8, marginBottom: 28,
  },

  progressRow: { marginTop: 16, marginBottom: 28, gap: 8 },
  stepLabel: { fontSize: 12, fontWeight: '600', color: palette.fairwayGreen },
  progressBar: { height: 4, backgroundColor: '#D8DDD0', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: palette.highVisLime, borderRadius: 2 },

  header: { marginBottom: 36 },
  title: { fontSize: 34, fontWeight: '800', color: palette.graphiteShaft, lineHeight: 40, marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7860', lineHeight: 22 },

  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: palette.fairwayGreen, letterSpacing: 0.3 },
  input: {
    height: 52, backgroundColor: INPUT_BG, borderRadius: 12,
    paddingHorizontal: 16, fontSize: 15, color: palette.graphiteShaft,
  },
  feedbackBox: { backgroundColor: '#FDECEA', borderRadius: 8, padding: 10, marginTop: 4 },
  feedbackError: { fontSize: 13, color: palette.sundayRed },
  feedbackSuccess: { backgroundColor: '#EEF5E4' },
  feedbackSuccessText: { fontSize: 13, color: palette.fairwayGreen, fontWeight: '600' },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: '#C8CEBC',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: palette.graphiteShaft, borderColor: palette.graphiteShaft },
  checkmark: { color: palette.bunkerSand, fontSize: 12, fontWeight: '800' },
  termsText: { flex: 1, fontSize: 13, color: '#6B7860', lineHeight: 20 },

  primaryBtn: {
    height: 56, backgroundColor: palette.graphiteShaft, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: palette.bunkerSand, fontSize: 17, fontWeight: '700' },

  switchLink: { alignItems: 'center', marginTop: 4 },
  switchText: { fontSize: 14, color: '#6B7860' },
  switchAccent: { color: palette.fairwayGreen, fontWeight: '700' },

  errorBox: { backgroundColor: '#FDECEA', borderRadius: 10, padding: 12, marginTop: 4 },
  errorText: { fontSize: 13, color: palette.sundayRed, textAlign: 'center' },

  // Stepper
  stepperRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  stepperBtn: {
    width: 80, height: 80, borderRadius: 12, borderWidth: 1.5, borderColor: '#C8CEBC',
    backgroundColor: INPUT_BG, alignItems: 'center', justifyContent: 'center',
  },
  stepperSymbol: { fontSize: 28, fontWeight: '300', color: palette.graphiteShaft },
  stepperDisplay: {
    flex: 1, height: 80, borderRadius: 12, borderWidth: 1.5, borderColor: '#C8CEBC',
    backgroundColor: INPUT_BG, alignItems: 'center', justifyContent: 'center',
  },
  stepperValue: { fontSize: 32, fontWeight: '700', color: palette.graphiteShaft },
  stepperLabel: { fontSize: 12, color: '#8A9680', textAlign: 'center', marginTop: 8 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: INPUT_BG, borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: '#C8CEBC',
  },
  toggleText: { fontSize: 14, color: palette.graphiteShaft, fontWeight: '500', flex: 1 },
});
