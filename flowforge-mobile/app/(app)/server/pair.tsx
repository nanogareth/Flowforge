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
import { discoverServer, buildServerUrl } from "../../../lib/tailscale";
import CopyableError from "../../../components/CopyableError";

export default function PairScreen() {
  const router = useRouter();
  const { setHomeServer } = useStore();

  const [serverUrl, setServerUrl] = useState("");
  const [tailscaleInput, setTailscaleInput] = useState("");
  const [code, setCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveryInfo, setDiscoveryInfo] = useState<string | null>(null);

  const isValid =
    serverUrl.startsWith("http") && serverUrl.length > 10 && code.length === 6;

  const handleDiscover = async () => {
    if (!tailscaleInput.trim()) return;

    setIsDiscovering(true);
    setError(null);
    setDiscoveryInfo(null);

    try {
      const probeUrl = buildServerUrl(tailscaleInput);
      const info = await discoverServer(probeUrl);

      if (info.available && info.ip) {
        const tsUrl = `http://${info.ip}:${info.serverPort}`;
        setServerUrl(tsUrl);
        setDiscoveryInfo(
          `Found: ${info.hostname || info.ip} (${info.ip}:${info.serverPort})`,
        );
      } else {
        setError("Tailscale is not available on this server");
      }
    } catch (err) {
      // Fallback: use the input directly as server URL
      const fallbackUrl = buildServerUrl(tailscaleInput);
      setServerUrl(fallbackUrl);
      setDiscoveryInfo(`Using ${fallbackUrl} (discovery unavailable)`);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handlePair = async () => {
    if (!isValid) return;

    setIsPairing(true);
    setError(null);

    try {
      const token = await pairWithServer(serverUrl, code);
      const normalizedUrl = serverUrl.replace(/\/+$/, "");

      // Auto-discover Tailscale URL for failover
      let tailscaleUrl: string | undefined;
      try {
        const info = await discoverServer(normalizedUrl);
        if (info.available && info.ip) {
          tailscaleUrl = `http://${info.ip}:${info.serverPort}`;
        }
      } catch {
        // Tailscale discovery is optional — ignore errors
      }

      await setHomeServer(normalizedUrl, token, tailscaleUrl);
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
            {/* Tailscale Discovery */}
            <View>
              <Text className="text-white text-base font-medium mb-2">
                Tailscale Hostname or IP
              </Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={tailscaleInput}
                  onChangeText={setTailscaleInput}
                  placeholder="my-pc or 100.64.x.x"
                  placeholderTextColor="#6b7280"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-white text-base"
                />
                <Pressable
                  onPress={handleDiscover}
                  disabled={isDiscovering || !tailscaleInput.trim()}
                  className={`px-4 rounded-lg items-center justify-center ${
                    !isDiscovering && tailscaleInput.trim()
                      ? "bg-primary active:bg-primary-hover"
                      : "bg-gray-700 opacity-50"
                  }`}
                >
                  {isDiscovering ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text className="text-white font-semibold">Discover</Text>
                  )}
                </Pressable>
              </View>
              {discoveryInfo && (
                <Text className="text-green-400 text-sm mt-1">
                  {discoveryInfo}
                </Text>
              )}
              <Text className="text-gray-500 text-xs mt-1">
                Auto-fills server URL via Tailscale, or enter URL manually below
              </Text>
            </View>

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
