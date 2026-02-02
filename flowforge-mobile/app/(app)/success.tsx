import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../../stores/store';

export default function Success() {
  const router = useRouter();
  const { lastCreatedRepo, setLastCreatedRepo } = useStore();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!lastCreatedRepo) {
    // Redirect to home if no repo was created
    router.replace('/(app)');
    return null;
  }

  const handleCopy = async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCreateAnother = () => {
    setLastCreatedRepo(null);
    router.replace('/(app)/create');
  };

  const handleGoHome = () => {
    setLastCreatedRepo(null);
    router.replace('/(app)');
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

        {/* Clone Command */}
        <View className="mb-6">
          <Text className="text-white text-base font-medium mb-2">
            Clone your repository
          </Text>
          <Pressable
            onPress={() => handleCopy(cloneCommand, 'clone')}
            className="bg-surface border border-border rounded-lg p-4 active:border-primary"
          >
            <Text className="text-gray-300 font-mono text-sm" numberOfLines={2}>
              {cloneCommand}
            </Text>
            <Text className="text-primary text-sm mt-2">
              {copiedField === 'clone' ? 'Copied!' : 'Tap to copy'}
            </Text>
          </Pressable>
        </View>

        {/* SSH URL */}
        <View className="mb-6">
          <Text className="text-white text-base font-medium mb-2">SSH URL</Text>
          <Pressable
            onPress={() => handleCopy(lastCreatedRepo.ssh_url, 'ssh')}
            className="bg-surface border border-border rounded-lg p-4 active:border-primary"
          >
            <Text className="text-gray-300 font-mono text-sm" numberOfLines={1}>
              {lastCreatedRepo.ssh_url}
            </Text>
            <Text className="text-primary text-sm mt-2">
              {copiedField === 'ssh' ? 'Copied!' : 'Tap to copy'}
            </Text>
          </Pressable>
        </View>

        {/* Quick Start */}
        <View className="bg-surface border border-border rounded-lg p-4 mb-8">
          <Text className="text-white text-base font-medium mb-3">
            Quick Start
          </Text>
          <Text className="text-gray-400 text-sm leading-6">
            1. Clone the repository{'\n'}
            2. Open in your editor{'\n'}
            3. Check CLAUDE.md for project guidelines{'\n'}
            4. Start building!
          </Text>
        </View>

        {/* Actions */}
        <View className="gap-3">
          <Pressable
            onPress={handleCreateAnother}
            className="bg-primary py-4 rounded-lg items-center active:bg-primary-hover"
          >
            <Text className="text-white text-lg font-semibold">
              Create Another Project
            </Text>
          </Pressable>

          <Pressable
            onPress={handleGoHome}
            className="py-4 rounded-lg items-center border border-border active:border-primary"
          >
            <Text className="text-white text-lg">Back to Home</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
