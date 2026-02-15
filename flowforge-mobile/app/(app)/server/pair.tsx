import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore } from "../../../stores/store";
import { pairWithServer } from "../../../lib/server-auth";
import CopyableError from "../../../components/CopyableError";

export default function PairScreen() {
  const router = useRouter();
  const { setHomeServer } = useStore();

  const [serverUrl, setServerUrl] = useState("");
  const [code, setCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    serverUrl.startsWith("http") && serverUrl.length > 10 && code.length === 6;

  const handlePair = async () => {
    if (!isValid) return;

    setIsPairing(true);
    setError(null);

    try {
      const token = await pairWithServer(serverUrl, code);
      await setHomeServer(serverUrl.replace(/\/+$/, ""), token);
      router.replace("/(app)/server");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to pair with server",
      );
    } finally {
      setIsPairing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-4">
          {/* Header */}
          <View className="mb-8">
            <Pressable onPress={() => router.back()} className="mb-4">
              <Text className="text-primary text-base">← Back</Text>
            </Pressable>
            <Text className="text-white text-2xl font-bold">
              Connect Home Server
            </Text>
            <Text className="text-gray-400 mt-2">
              Enter your server's address and the pairing code shown on the
              server console
            </Text>
          </View>

          {/* Error */}
          {error && <CopyableError message={error} />}

          {/* Form */}
          <View className="gap-5">
            {/* Server URL */}
            <View>
              <Text className="text-white text-base font-medium mb-2">
                Server URL
              </Text>
              <TextInput
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://100.64.x.x:7433"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                className="bg-surface border border-border rounded-lg px-4 py-3 text-white text-base"
              />
            </View>

            {/* Pairing Code */}
            <View>
              <Text className="text-white text-base font-medium mb-2">
                Pairing Code
              </Text>
              <TextInput
                value={code}
                onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ""))}
                placeholder="000000"
                placeholderTextColor="#6b7280"
                keyboardType="number-pad"
                maxLength={6}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-white text-2xl text-center tracking-[12px] font-mono"
              />
            </View>

            {/* Connect Button */}
            <Pressable
              onPress={handlePair}
              disabled={!isValid || isPairing}
              className={`py-4 rounded-lg items-center mt-4 ${
                isValid && !isPairing
                  ? "bg-primary active:bg-primary-hover"
                  : "bg-gray-700 opacity-50"
              }`}
            >
              {isPairing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-lg font-semibold">
                  Connect
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
