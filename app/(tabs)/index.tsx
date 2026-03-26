import { View, Text, StyleSheet } from 'react-native';

export default function TabsIndex() {
  return (
    <View style={styles.container}>
      <Text>Pantalla Principal (Tabs) - ¡Sesión Activa!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
