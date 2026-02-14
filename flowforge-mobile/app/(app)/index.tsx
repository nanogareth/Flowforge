import { View, Text, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "../../stores/store";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
  const router = useRouter();
  const { user, logout } = useStore();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
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
        <View className="flex-1 justify-center gap-4">
          <Text className="text-white text-2xl font-bold mb-2 text-center">
            Start a new project
          </Text>
          <Text className="text-gray-400 text-center mb-4 px-4">
            Create a GitHub repo pre-configured for Claude Code
          </Text>

          {/* Primary: Import from Obsidian */}
          <Pressable
            onPress={() => router.push("/(app)/pick")}
            className="bg-primary p-6 rounded-xl active:bg-primary-hover"
          >
            <Text className="text-white text-xl font-semibold mb-1">
              Import from Obsidian
            </Text>
            <Text className="text-green-200 text-sm">
              Pick a markdown file to auto-configure your project
            </Text>
          </Pressable>

          {/* Secondary: Create Manually */}
          <Pressable
            onPress={() => router.push("/(app)/create")}
            className="bg-surface p-6 rounded-xl border border-border active:border-primary"
          >
            <Text className="text-white text-xl font-semibold mb-1">
              Create Manually
            </Text>
            <Text className="text-gray-400 text-sm">
              Choose a template and configure from scratch
            </Text>
          </Pressable>
        </View>

        {/* Sign Out */}
        <View className="pb-4">
          <Pressable onPress={handleLogout} className="py-3 items-center">
            <Text className="text-gray-500">Sign out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
