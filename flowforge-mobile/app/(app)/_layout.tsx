import { Stack, Redirect } from "expo-router";
import { useStore } from "../../stores/store";
import { View, ActivityIndicator } from "react-native";

export default function AppLayout() {
  const { token, isLoading } = useStore();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // Redirect to login if not authenticated
  if (!token) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0a0a0a" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="pick" />
      <Stack.Screen name="create/[type]" />
      <Stack.Screen name="success" />
      <Stack.Screen name="server/index" />
      <Stack.Screen name="server/pair" />
      <Stack.Screen name="server/terminal" />
    </Stack>
  );
}
