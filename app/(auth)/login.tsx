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
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { palette } from '../../lib/theme/colors';

WebBrowser.maybeCompleteAuthSession();

const INPUT_BG = '#EEF3E8';
const { height: SCREEN_H } = Dimensions.get('window');
const HERO_H = SCREEN_H * 0.46;

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronDownIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 9L12 15L18 9" stroke={palette.graphiteShaft} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function AppleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 17 20">
      <Path
        d="M14.15 10.62c-.02-2.07 1.7-3.07 1.78-3.12-0.97-1.42-2.49-1.61-3.03-1.64-1.29-.13-2.52.76-3.17.76-.65 0-1.65-.74-2.72-.72-1.4.02-2.69.82-3.41 2.08C1.96 10.52 3 14.09 4.62 16.5c.81 1.18 1.77 2.5 3.03 2.45 1.22-.05 1.68-.79 3.15-.79 1.47 0 1.89.79 3.17.77 1.31-.02 2.14-1.2 2.94-2.38.93-1.36 1.31-2.68 1.33-2.75-.03-.01-2.55-.98-2.57-3.18zM11.81 3.93c.67-.82 1.13-1.95.99-3.09-.97.04-2.14.65-2.83 1.46-.62.71-1.16 1.85-1.02 2.94 1.08.08 2.19-.55 2.86-1.31z"
        fill={palette.graphiteShaft}
      />
    </Svg>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function signInWithApple(): Promise<string | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken!,
    });
    if (error) return error.message;
    return null;
  } catch (e: any) {
    if (e.code === 'ERR_REQUEST_CANCELED') return null;
    return e.message ?? 'Apple Sign-In failed.';
  }
}

async function signInWithGoogle(): Promise<string | null> {
  try {
    const redirectTo = Linking.createURL('/');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return error.message;
    if (!data.url) return 'No OAuth URL returned.';
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') {
      const url = new URL(result.url);
      const access_token = url.searchParams.get('access_token');
      const refresh_token = url.searchParams.get('refresh_token');
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    }
    return null;
  } catch (e: any) {
    return e.message ?? 'Google Sign-In failed.';
  }
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const [view, setView] = useState<'landing' | 'form'>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError('Incorrect email or password. Try again.');
  }

  async function handleApple() {
    setError('');
    const err = await signInWithApple();
    if (err) setError(err);
  }

  async function handleGoogle() {
    setError('');
    const err = await signInWithGoogle();
    if (err) setError(err);
  }

  // ── Landing ────────────────────────────────────────────────────────────────
  if (view === 'landing') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.landingWrap}>
          <Image
            source={require('../../assets/golf-hero.png')}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.landingContent}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.landingLogo}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }} />
            <View style={styles.landingButtons}>
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.socialLandingBtn} onPress={handleApple} activeOpacity={0.85}>
                  <AppleIcon size={18} />
                  <Text style={styles.socialLandingText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.socialLandingBtn} onPress={handleGoogle} activeOpacity={0.85}>
                <GoogleIcon size={18} />
                <Text style={styles.socialLandingText}>Continue with Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.emailLandingBtn} onPress={() => setView('form')} activeOpacity={0.85}>
                <Text style={styles.emailLandingText}>Continue with email</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.loginLinkRow} onPress={() => setView('form')} hitSlop={8}>
              <Text style={styles.loginLinkText}>
                Already have an account?{' '}
                <Text style={styles.loginLinkAccent}>Log In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Email form ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => setView('landing')} hitSlop={8}>
            <ChevronDownIcon size={18} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Log In</Text>
            <Text style={styles.subtitle}>Good to have you back.</Text>
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

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8}>
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#A8B89A"
                value={password}
                onChangeText={t => { setPassword(t); setError(''); }}
                secureTextEntry
                autoComplete="password"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (!email || !password) && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading || !email || !password}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={palette.bunkerSand} />
                : <Text style={styles.primaryBtnText}>Log In</Text>
              }
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              {Platform.OS === 'ios' && (
                <TouchableOpacity style={styles.socialBtn} onPress={handleApple} activeOpacity={0.85}>
                  <AppleIcon size={18} />
                  <Text style={styles.socialBtnText}>Apple</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.socialBtn, Platform.OS !== 'ios' && { flex: 1 }]}
                onPress={handleGoogle}
                activeOpacity={0.85}
              >
                <GoogleIcon size={18} />
                <Text style={styles.socialBtnText}>Google</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.signupLink} onPress={() => router.push('/(auth)/signup')} hitSlop={8}>
              <Text style={styles.signupText}>
                Don't have an account?{' '}
                <Text style={styles.signupAccent}>Sign Up</Text>
              </Text>
            </TouchableOpacity>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.bunkerSand,
  },

  // Landing
  landingWrap: {
    flex: 1,
  },
  heroImage: {
    width: '100%',
    height: HERO_H,
  },
  landingContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
  },
  landingLogo: {
    width: 130,
    height: 52,
    alignSelf: 'center',
  },
  landingButtons: {
    gap: 12,
    marginBottom: 20,
  },
  socialLandingBtn: {
    height: 54,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#C8CEBC',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  socialLandingText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.graphiteShaft,
  },
  emailLandingBtn: {
    height: 54,
    borderRadius: 100,
    backgroundColor: palette.graphiteShaft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailLandingText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.bunkerSand,
  },
  loginLinkRow: {
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#6B7860',
  },
  loginLinkAccent: {
    color: palette.fairwayGreen,
    fontWeight: '700',
  },

  // Form
  scroll: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    flexGrow: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.highVisLime,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  header: {
    marginBottom: 36,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: palette.graphiteShaft,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7860',
  },
  form: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.fairwayGreen,
    letterSpacing: 0.3,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.fairwayGreen,
  },
  input: {
    height: 52,
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: palette.graphiteShaft,
  },
  primaryBtn: {
    height: 56,
    backgroundColor: palette.graphiteShaft,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: palette.bunkerSand,
    fontSize: 17,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D4D8CC',
  },
  dividerText: {
    fontSize: 12,
    color: '#8A9680',
    fontWeight: '500',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C8CEBC',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.graphiteShaft,
  },
  signupLink: {
    alignItems: 'center',
    marginTop: 8,
  },
  signupText: {
    fontSize: 14,
    color: '#6B7860',
  },
  signupAccent: {
    color: palette.fairwayGreen,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FDECEA',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    color: palette.sundayRed,
    textAlign: 'center',
  },
});
