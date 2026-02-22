import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore } from "../../../stores/store";
import { fetchProjects, type Project } from "../../../lib/server-api";

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { homeServerUrl, homeServerToken } = useStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [cloneDir, setCloneDir] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(
    async (refresh = false) => {
      if (!homeServerUrl || !homeServerToken) return;

      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const data = await fetchProjects(homeServerUrl, homeServerToken);
        setCloneDir(data.cloneDir);
        setProjects(data.projects);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load projects",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [homeServerUrl, homeServerToken],
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  if (!homeServerUrl || !homeServerToken) {
    router.replace("/(app)");
    return null;
  }

  const handleProjectPress = (project: Project) => {
    router.push({
      pathname: "/(app)/server/project-detail",
      params: { name: project.name, cloneDir },
    });
  };

  const renderProject = ({ item }: { item: Project }) => (
    <Pressable
      onPress={() => handleProjectPress(item)}
      className="bg-surface border border-border rounded-lg p-4 mb-3 active:border-primary"
    >
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center flex-1 mr-3">
          {item.hasClaudeMd && (
            <View className="w-2.5 h-2.5 rounded-full bg-primary mr-2.5" />
          )}
          <Text className="text-white text-base font-medium" numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <Text className="text-gray-500 text-xs">
          {formatRelativeTime(item.lastModified)}
        </Text>
      </View>
      <Text className="text-gray-500 text-xs" numberOfLines={1}>
        {item.path}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-4">
        {/* Header */}
        <View className="mb-6">
          <Pressable onPress={() => router.back()} className="mb-4">
            <Text className="text-primary text-base">← Back</Text>
          </Pressable>
          <Text className="text-white text-2xl font-bold">Projects</Text>
        </View>

        {/* Loading state */}
        {isLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#238636" size="large" />
            <Text className="text-gray-400 mt-4">Loading projects...</Text>
          </View>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <View className="flex-1 items-center justify-center">
            <Text className="text-red-400 text-base text-center mb-4">
              {error}
            </Text>
            <Pressable
              onPress={() => loadProjects()}
              className="bg-primary px-6 py-3 rounded-lg active:bg-primary-hover"
            >
              <Text className="text-white font-semibold">Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Empty state */}
        {!isLoading && !error && projects.length === 0 && (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-400 text-base text-center">
              No projects found on the server.
            </Text>
            <Text className="text-gray-500 text-sm text-center mt-2">
              Clone a repository first to see it here.
            </Text>
          </View>
        )}

        {/* Projects list */}
        {!isLoading && !error && projects.length > 0 && (
          <FlatList
            data={projects}
            keyExtractor={(item) => item.path}
            renderItem={renderProject}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => loadProjects(true)}
                tintColor="#238636"
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
