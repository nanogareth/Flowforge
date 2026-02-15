import { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore } from "../../../stores/store";

export default function ServerSettings() {
  const router = useRouter();
  const {
    homeServerUrl,
    isServerConnected,
    clearHomeServer,
    checkServerHealth,
  } = useStore();

  useEffect(() => {
    checkServerHealth();
  }, []);

  if (!homeServerUrl) {
    router.replace("/(app)");
    return null;
  }

  const handleDisconnect = async () => {
    await clearHomeServer();
    router.replace("/(app)");
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-4">
        {/* Header */}
        <View className="mb-8">
          <Pressable onPress={() => router.back()} className="mb-4">
            <Text className="text-primary text-base">← Back</Text>
          </Pressable>
          <Text className="text-white text-2xl font-bold">Home Server</Text>
        </View>

        {/* Server Status */}
        <View className="bg-surface border border-border rounded-lg p-4 mb-6">
          <View className="flex-row items-center mb-2">
            <View
              className={`w-3 h-3 rounded-full mr-3 ${
                isServerConnected ? "bg-primary" : "bg-red-500"
              }`}
            />
            <Text className="text-white text-base font-medium">
              {isServerConnected ? "Connected" : "Disconnected"}
            </Text>
          </View>
          <Text className="text-gray-400 text-sm">{homeServerUrl}</Text>
        </View>

        {/* Actions */}
        <View className="gap-3">
          <Pressable
            onPress={() => router.push("/(app)/server/terminal")}
            className="bg-primary py-4 rounded-lg items-center active:bg-primary-hover"
          >
            <Text className="text-white text-lg font-semibold">
              Open Terminal
            </Text>
          </Pressable>

          <Pressable
            onPress={checkServerHealth}
            className="py-4 rounded-lg items-center border border-border active:border-primary"
          >
            <Text className="text-white text-lg">Refresh Status</Text>
          </Pressable>

          <Pressable
            onPress={handleDisconnect}
            className="py-4 rounded-lg items-center border border-red-900 active:border-red-500 mt-4"
          >
            <Text className="text-red-400 text-lg">Disconnect Server</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
