import { useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useStore } from "../../../stores/store";
import { getTerminalHtml } from "../../../lib/terminal-html";

export default function TerminalScreen() {
  const router = useRouter();
  const { sessionId, cwd, cmd } = useLocalSearchParams<{
    sessionId?: string;
    cwd?: string;
    cmd?: string;
  }>();

  const { homeServerUrl, homeServerToken } = useStore();
  const webViewRef = useRef<WebView>(null);

  if (!homeServerUrl || !homeServerToken) {
    router.replace("/(app)");
    return null;
  }

  // Build WebSocket URL
  const wsBase = homeServerUrl
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:");
  const wsPath = sessionId ? `/terminal/${sessionId}` : "/terminal";
  const params = new URLSearchParams({ token: homeServerToken });
  if (cwd) params.set("cwd", cwd);
  if (cmd) params.set("cmd", cmd);
  const wsUrl = `${wsBase}${wsPath}?${params.toString()}`;

  const html = getTerminalHtml(wsUrl);

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0a]">
      {/* Header Bar */}
      <View className="flex-row items-center px-4 py-2 border-b border-border">
        <Pressable onPress={() => router.back()} className="mr-4">
          <Text className="text-primary text-base">← Back</Text>
        </Pressable>
        <Text className="text-gray-400 text-sm flex-1" numberOfLines={1}>
          {sessionId ? `Session ${sessionId.slice(0, 8)}` : "Terminal"}
        </Text>
      </View>

      {/* Terminal WebView */}
      <WebView
        ref={webViewRef}
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1, backgroundColor: "#0a0a0a" }}
        scrollEnabled={false}
        overScrollMode="never"
        textInteractionEnabled={false}
      />
    </SafeAreaView>
  );
}
