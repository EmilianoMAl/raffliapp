import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_KEY } from './(auth)/onboarding';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // undefined = still loading, null = no session, Session = logged in
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const router = useRouter();
  const segments = useSegments();
  const segmentsRef = useRef<string[]>([]);

  // Keep segments ref current without triggering routing effect
  useEffect(() => {
    segmentsRef.current = segments as string[];
  }, [segments]);

  // Auth state — getSession for guaranteed init, onAuthStateChange for login/logout
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => setSession(prev => prev === undefined ? (data.session ?? null) : prev))
      .catch(() => setSession(prev => prev === undefined ? null : prev));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Routing guard — only re-runs when session changes, NOT on every navigation
  useEffect(() => {
    if (session === undefined) return; // still loading, keep splash

    (async () => {
      try {
        const onboarded = await AsyncStorage.getItem(ONBOARDING_KEY);
        const segs = segmentsRef.current;
        const inAuth = segs[0] === '(auth)';
        const page = segs[1] as string | undefined;

        if (!onboarded) {
          // First ever launch — show onboarding
          if (page !== 'onboarding') router.replace('/(auth)/onboarding');
        } else if (!session) {
          // Not logged in — go to login unless already in auth
          if (!inAuth) router.replace('/(auth)/login');
        } else if (inAuth && page !== 'signup' && page !== 'setup') {
          // Logged in and on an auth screen (e.g. login) — route to app
          try {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', session.user.id)
              .maybeSingle();
            // If table missing or profile has username → go to tabs
            // If profile exists but no username → complete setup first
            if (!error && !profile?.username) {
              router.replace('/(auth)/setup');
            } else {
              router.replace('/(tabs)');
            }
          } catch {
            router.replace('/(tabs)');
          }
        }
        // else: logged in and already in tabs — do nothing
      } finally {
        SplashScreen.hideAsync();
      }
    })();
  }, [session]); // Only session in deps — prevents redirect loops on navigation

  return <Slot />;
}
