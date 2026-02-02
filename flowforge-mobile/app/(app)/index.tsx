import { View, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../stores/store';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Home() {
  const router = useRouter();
  const { user, logout } = useStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-4">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className="text-gray-400 text-sm">Welcome back,</Text>
            <Text className="text-white text-xl font-semibold">
              {user?.name || user?.login}
            </Text>
          </View>
          <Pressable onPress={handleLogout} className="flex-row items-center">
            {user?.avatar_url && (
              <Image
                source={{ uri: user.avatar_url }}
                className="w-10 h-10 rounded-full"
              />
            )}
          </Pressable>
        </View>

        {/* Main Content */}
        <View className="flex-1 justify-center items-center">
          <Text className="text-white text-2xl font-bold mb-2 text-center">
            Create a new project
          </Text>
          <Text className="text-gray-400 text-center mb-8 px-4">
            Set up a GitHub repository with CLAUDE.md and starter files
          </Text>

          {/* New Project Button */}
          <Pressable
            onPress={() => router.push('/(app)/create')}
            className="bg-primary px-12 py-5 rounded-xl active:bg-primary-hover"
          >
            <Text className="text-white text-xl font-semibold">
              + New Project
            </Text>
          </Pressable>
        </View>

        {/* Sign Out */}
        <View className="pb-4">
          <Pressable
            onPress={handleLogout}
            className="py-3 items-center"
          >
            <Text className="text-gray-500">Sign out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
