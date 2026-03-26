import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Restaurar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    // Escuchar cambios de estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (session && inAuthGroup) {
      // Usuario logueado pero intenta acceder al área pública (ej: login) -> Redirigir a tabs
      router.replace('/(tabs)');
    } else if (!session && !inAuthGroup) {
      // Usuario no logueado intenta acceder a rutas protegidas -> Redirigir a login
      router.replace('/(auth)/login');
    }

    // Ocultar el splash screen al finalizar las validaciones
    SplashScreen.hideAsync();
  }, [session, initialized, segments]);

  return <Slot />;
}
