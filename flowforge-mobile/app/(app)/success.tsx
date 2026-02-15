import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useStore } from "../../stores/store";
import { cloneAndLaunch } from "../../lib/server-api";

export default function Success() {
  const router = useRouter();
  const {
    lastCreatedRepo,
    claudeCodeConfigureUrl,
    resetCreationState,
    homeServerUrl,
    homeServerToken,
    isServerConnected,
  } = useStore();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  if (!lastCreatedRepo) {
    router.replace("/(app)");
    return null;
  }

  const handleCopy = async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenClaudeCode = async () => {
    await WebBrowser.openBrowserAsync("https://claude.ai/code");
  };

  const handleCreateAnother = () => {
    resetCreationState();
    router.replace("/(app)");
  };

  const handleCloneOnServer = async () => {
    if (!homeServerUrl || !homeServerToken || !lastCreatedRepo) return;

    setIsCloning(true);
    setCloneError(null);

    try {
      const result = await cloneAndLaunch(
        homeServerUrl,
        homeServerToken,
        lastCreatedRepo.clone_url,
        true,
      );
      router.push({
        pathname: "/(app)/server/terminal",
        params: { sessionId: result.sessionId },
      });
    } catch (err) {
      setCloneError(
        err instanceof Error ? err.message : "Failed to clone on server",
      );
    } finally {
      setIsCloning(false);
    }
  };

  const cloneCommand = `git clone ${lastCreatedRepo.clone_url}`;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-4 justify-center">
        {/* Success Icon */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-4">
            <Text className="text-4xl">✓</Text>
          </View>
          <Text className="text-white text-2xl font-bold text-center">
            Repository Created!
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            {lastCreatedRepo.full_name}
          </Text>
        </View>

        {/* Claude Code Status */}
        {claudeCodeConfigureUrl && (
          <Pressable
            onPress={() => Linking.openURL(claudeCodeConfigureUrl)}
            className="bg-surface border border-border rounded-lg p-4 mb-6 active:border-primary"
          >
            <Text className="text-gray-300 font-medium mb-1">
              Add this repo to Claude Code
            </Text>
            <Text className="text-primary text-sm">
              Tap to configure the Claude GitHub App →
            </Text>
          </Pressable>
        )}

        {/* Clone Command */}
        <View className="mb-6">
          <Text className="text-white text-base font-medium mb-2">
            Clone your repository
          </Text>
          <Pressable
            onPress={() => handleCopy(cloneCommand, "clone")}
            className="bg-surface border border-border rounded-lg p-4 active:border-primary"
          >
            <Text className="text-gray-300 font-mono text-sm" numberOfLines={2}>
              {cloneCommand}
            </Text>
            <Text className="text-primary text-sm mt-2">
              {copiedField === "clone" ? "Copied!" : "Tap to copy"}
            </Text>
          </Pressable>
        </View>

        {/* Quick Start */}
        <View className="bg-surface border border-border rounded-lg p-4 mb-8">
          <Text className="text-white text-base font-medium mb-3">
            Quick Start
          </Text>
          <Text className="text-gray-400 text-sm leading-6">
            1. Open Claude Code{"\n"}
            2. Select this repository{"\n"}
            3. Run /init{"\n"}
            4. Start building!
          </Text>
        </View>

        {/* Actions */}
        <View className="gap-3">
          {homeServerUrl && isServerConnected && (
            <Pressable
              onPress={handleCloneOnServer}
              disabled={isCloning}
              className={`bg-primary py-4 rounded-lg items-center ${
                isCloning ? "opacity-50" : "active:bg-primary-hover"
              }`}
            >
              {isCloning ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-lg font-semibold">
                  Clone & Launch on Server
                </Text>
              )}
            </Pressable>
          )}

          {cloneError && (
            <Text className="text-red-400 text-sm text-center">
              {cloneError}
            </Text>
          )}

          <Pressable
            onPress={handleOpenClaudeCode}
            className={`py-4 rounded-lg items-center ${
              homeServerUrl && isServerConnected
                ? "border border-border active:border-primary"
                : "bg-primary active:bg-primary-hover"
            }`}
          >
            <Text className="text-white text-lg font-semibold">
              Open Claude Code
            </Text>
          </Pressable>

          <Pressable
            onPress={handleCreateAnother}
            className="py-4 rounded-lg items-center border border-border active:border-primary"
          >
            <Text className="text-white text-lg">Create Another Project</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
