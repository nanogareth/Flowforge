import { useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useStore } from "../../stores/store";

export default function Success() {
  const router = useRouter();
  const {
    lastCreatedRepo,
    claudeCodeEnabled,
    claudeCodeError,
    resetCreationState,
  } = useStore();
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
        {claudeCodeEnabled ? (
          <View className="bg-green-900/30 border border-green-800 rounded-lg p-4 mb-6">
            <Text className="text-green-400 font-medium">
              ✓ Claude Code enabled for this repository
            </Text>
          </View>
        ) : claudeCodeError ? (
          <Pressable
            onPress={() => Linking.openURL("https://github.com/apps/claude")}
            className="bg-surface border border-border rounded-lg p-4 mb-6 active:border-primary"
          >
            <Text className="text-gray-300 font-medium mb-1">
              Claude Code not yet enabled
            </Text>
            <Text className="text-primary text-sm">
              Tap to install the Claude Code GitHub App →
            </Text>
          </Pressable>
        ) : null}

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
          <Pressable
            onPress={handleOpenClaudeCode}
            className="bg-primary py-4 rounded-lg items-center active:bg-primary-hover"
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
