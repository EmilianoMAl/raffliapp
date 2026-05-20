/**
 * Profile setup for users who signed in with Apple/Google
 * and haven't set their username + handicap yet.
 */
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
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { palette } from '../../lib/theme/colors';

const INPUT_BG = '#EEF3E8';

export default function SetupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = name/username, 1 = handicap

  // Step 0 state
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle');
  const [step0Error, setStep0Error] = useState('');
  const [step0Loading, setStep0Loading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 1 state
  const [handicap, setHandicap] = useState<number | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [step1Loading, setStep1Loading] = useState(false);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

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

  function handleUsernameChange(v: string) {
    const clean = cleanUsername(v);
    setUsername(clean);
    setStep0Error('');
    checkUsername(clean);
  }

  async function handleStep0() {
    if (!displayName.trim()) { setStep0Error('Please enter your name.'); return; }
    if (username.length < 3) { setStep0Error('Username must be at least 3 characters.'); return; }
    if (usernameStatus === 'taken') { setStep0Error('That username is taken.'); return; }
    if (usernameStatus === 'checking') { setStep0Error('Wait for username check.'); return; }
    setStep0Loading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('profiles').upsert({ id: session.user.id, display_name: displayName.trim(), username });
    }
    setStep0Loading(false);
    setStep(1);
  }

  async function handleStep1() {
    setStep1Loading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('profiles').update({ handicap_index: isNew ? null : handicap, is_new_to_golf: isNew }).eq('id', session.user.id);
    }
    setStep1Loading(false);
    router.replace('/(tabs)');
  }

  const canStep0 = !!displayName.trim() && username.length >= 3 && usernameStatus === 'available';

  if (step === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.progressRow}>
              <Text style={styles.stepLabel}>Step 1 of 2</Text>
              <View style={styles.progressBar}><View style={[styles.progressFill, { width: '50%' }]} /></View>
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>What should we{'\n'}call you, golfer?</Text>
              <Text style={styles.subtitle}>Shown on your profile, scorecard, and rivalry feed.</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput style={styles.input} placeholder="John Doe" placeholderTextColor="#A8B89A"
                  value={displayName} onChangeText={t => { setDisplayName(t); setStep0Error(''); }}
                  autoCapitalize="words" textContentType="name" autoComplete="name" />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Username</Text>
                <TextInput style={styles.input} placeholder="johndoe1" placeholderTextColor="#A8B89A"
                  value={username} onChangeText={handleUsernameChange}
                  autoCapitalize="none" autoCorrect={false} textContentType="username" autoComplete="username" />
                {usernameStatus === 'taken' && (
                  <View style={styles.feedbackError}><Text style={styles.feedbackErrorText}>Handle '{username}' is taken.</Text></View>
                )}
                {usernameStatus === 'available' && (
                  <View style={styles.feedbackSuccess}><Text style={styles.feedbackSuccessText}>Your handle: @{username}</Text></View>
                )}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, !canStep0 && styles.btnDisabled, { marginTop: 16 }]}
                onPress={handleStep0} disabled={step0Loading || !canStep0} activeOpacity={0.85}
              >
                {step0Loading ? <ActivityIndicator color={palette.bunkerSand} /> : <Text style={styles.primaryBtnText}>Continue</Text>}
              </TouchableOpacity>

              {!!step0Error && <View style={styles.errorBox}><Text style={styles.errorText}>{step0Error}</Text></View>}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.progressRow}>
          <Text style={styles.stepLabel}>Step 2 of 2</Text>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: '100%' }]} /></View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>What's your{'\n'}handicap?</Text>
          <Text style={styles.subtitle}>Honest game only.{'\n'}You can update this anytime.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => setHandicap(h => Math.max(-10, (h ?? 1) - 1))} disabled={isNew} activeOpacity={0.7}>
              <Text style={styles.stepperSymbol}>−</Text>
            </TouchableOpacity>
            <View style={styles.stepperDisplay}>
              <Text style={styles.stepperValue}>{isNew || handicap === null ? '- -' : String(handicap)}</Text>
            </View>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => setHandicap(h => Math.min(54, (h ?? -1) + 1))} disabled={isNew} activeOpacity={0.7}>
              <Text style={styles.stepperSymbol}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.stepperLabel}>Handicap Index</Text>

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

          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 24 }]} onPress={handleStep1} disabled={step1Loading} activeOpacity={0.85}>
            {step1Loading ? <ActivityIndicator color={palette.bunkerSand} /> : <Text style={styles.primaryBtnText}>Continue</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bunkerSand },
  scroll: { paddingHorizontal: 28, paddingBottom: 40, flexGrow: 1 },
  progressRow: { marginTop: 16, marginBottom: 28, gap: 8 },
  stepLabel: { fontSize: 12, fontWeight: '600', color: palette.fairwayGreen },
  progressBar: { height: 4, backgroundColor: '#D8DDD0', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: palette.highVisLime, borderRadius: 2 },
  header: { marginBottom: 36 },
  title: { fontSize: 34, fontWeight: '800', color: palette.graphiteShaft, lineHeight: 40, marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7860', lineHeight: 22 },
  form: { gap: 16 },
  fieldGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: palette.fairwayGreen },
  input: { height: 52, backgroundColor: INPUT_BG, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: palette.graphiteShaft },
  feedbackError: { backgroundColor: '#FDECEA', borderRadius: 8, padding: 10, marginTop: 4 },
  feedbackErrorText: { fontSize: 13, color: palette.sundayRed },
  feedbackSuccess: { backgroundColor: '#EEF5E4', borderRadius: 8, padding: 10, marginTop: 4 },
  feedbackSuccessText: { fontSize: 13, color: palette.fairwayGreen, fontWeight: '600' },
  primaryBtn: { height: 56, backgroundColor: palette.graphiteShaft, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: palette.bunkerSand, fontSize: 17, fontWeight: '700' },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 10, padding: 12 },
  errorText: { fontSize: 13, color: palette.sundayRed, textAlign: 'center' },
  stepperRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  stepperBtn: { width: 80, height: 80, borderRadius: 12, borderWidth: 1.5, borderColor: '#C8CEBC', backgroundColor: INPUT_BG, alignItems: 'center', justifyContent: 'center' },
  stepperSymbol: { fontSize: 28, fontWeight: '300', color: palette.graphiteShaft },
  stepperDisplay: { flex: 1, height: 80, borderRadius: 12, borderWidth: 1.5, borderColor: '#C8CEBC', backgroundColor: INPUT_BG, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontSize: 32, fontWeight: '700', color: palette.graphiteShaft },
  stepperLabel: { fontSize: 12, color: '#8A9680', textAlign: 'center', marginTop: 8 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: INPUT_BG, borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: '#C8CEBC' },
  toggleText: { fontSize: 14, color: palette.graphiteShaft, fontWeight: '500', flex: 1 },
});
