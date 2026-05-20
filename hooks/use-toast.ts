import { Alert } from "react-native";

interface ToastOptions {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  const toast = ({ title, description, variant }: ToastOptions) => {
    if (variant === "destructive") {
      Alert.alert(title, description);
    }
    // informational toasts are intentionally silent on mobile
  };
  return { toast };
}
