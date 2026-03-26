import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
// import { supabase } from '../../lib/supabase'; // Lo usaremos en el Paso 2

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!isTermsAccepted) {
      Alert.alert('Acción requerida', 'Debes aceptar los Términos y Condiciones para crear una cuenta.');
      return;
    }
    
    // Aquí irá la lógica de Supabase en el siguiente paso
    Alert.alert('Éxito', 'Flujo de registro listo para conectar a Supabase.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido a Raffli</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      {/* Checkbox de Términos y Condiciones */}
      <TouchableOpacity 
        style={styles.checkboxContainer} 
        onPress={() => setIsTermsAccepted(!isTermsAccepted)}
        activeOpacity={0.8}
      >
        <View style={[styles.checkbox, isTermsAccepted && styles.checkboxChecked]}>
          {isTermsAccepted && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.termsText}>
          Acepto los <Text style={styles.link}>Términos y Condiciones</Text> y la <Text style={styles.link}>Política de Privacidad</Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, (!email || !password) && styles.buttonDisabled]} 
        onPress={handleSignUp}
        disabled={loading || !email || !password}
      >
        <Text style={styles.buttonText}>Crear Cuenta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    gap: 16,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    paddingRight: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0284C7',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0284C7',
  },
  checkmark: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  termsText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  link: {
    color: '#0284C7',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#0284C7',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});