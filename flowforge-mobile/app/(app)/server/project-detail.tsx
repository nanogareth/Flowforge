import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  SectionList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useStore } from "../../../stores/store";
import {
  fetchProjectDetail,
  type ActiveSession,
  type Conversation,
  type ProjectDetail,
} from "../../../lib/server-api";

function formatRelativeTime(dateOrMs: string | number): string {
  const now = Date.now();
  const then =
    typeof dateOrMs === "number" ? dateOrMs : new Date(dateOrMs).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(then).toLocaleDateString();
}

type SectionItem =
  | { type: "active"; data: ActiveSession | null }
  | { type: "conversation"; data: Conversation | null };

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { name, cloneDir } = useLocalSearchParams<{
    name: string;
    cloneDir: string;
  }>();

  const { homeServerUrl, homeServerToken } = useStore();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (refresh = false) => {
      if (!homeServerUrl || !homeServerToken || !name) return;

      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      try {
        const data = await fetchProjectDetail(
          homeServerUrl,
          homeServerToken,
          name,
        );
        setDetail(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load project",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [homeServerUrl, homeServerToken, name],
  );

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (!homeServerUrl || !homeServerToken) {
    router.replace("/(app)");
    return null;
  }

  const handleNewSession = () => {
    const cwd = `${cloneDir}/${name}`;
    router.push({
      pathname: "/(app)/server/terminal",
      params: { cwd, cmd: "claude" },
    });
  };

  const handleActiveSession = (session: ActiveSession) => {
    router.push({
      pathname: "/(app)/server/terminal",
      params: { sessionId: session.id },
    });
  };

  const handleConversation = (conv: Conversation) => {
    const cwd = `${cloneDir}/${name}`;
    router.push({
      pathname: "/(app)/server/terminal",
      params: { cwd, cmd: `claude --resume ${conv.sessionId}` },
    });
  };

  const sections: Array<{
    title: string;
    data: SectionItem[];
    emptyMessage: string;
  }> = [];

  if (detail) {
    const activeSessions: SectionItem[] = detail.activeSessions
      .filter((s) => !s.exited)
      .map((s) => ({ type: "active" as const, data: s }));

    sections.push({
      title: "Running Sessions",
      data:
        activeSessions.length > 0
          ? activeSessions
          : [{ type: "active" as const, data: null }],
      emptyMessage: "No running sessions",
    });

    const conversations: SectionItem[] = detail.recentConversations.map(
      (c) => ({ type: "conversation" as const, data: c }),
    );

    sections.push({
      title: "Recent Conversations",
      data:
        conversations.length > 0
          ? conversations
          : [{ type: "conversation" as const, data: null }],
      emptyMessage: "No previous conversations",
    });
  }

  const renderItem = ({
    item,
    section,
  }: {
    item: SectionItem;
    section: { emptyMessage: string };
  }) => {
    if (!item.data) {
      return (
        <View className="px-4 py-6">
          <Text className="text-gray-500 text-sm text-center">
            {section.emptyMessage}
          </Text>
        </View>
      );
    }

    if (item.type === "active") {
      const session = item.data;
      return (
        <Pressable
          onPress={() => handleActiveSession(session)}
          className="bg-surface border border-border rounded-lg p-4 mx-4 mb-2 active:border-primary"
        >
          <View className="flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-3" />
            <View className="flex-1">
              <Text className="text-white text-sm font-medium">
                Session {session.id.slice(0, 8)}...
              </Text>
              <Text className="text-gray-500 text-xs mt-0.5">
                Active {formatRelativeTime(session.lastActivity)}
                {session.clientCount > 0
                  ? ` · ${session.clientCount} connected`
                  : ""}
              </Text>
            </View>
            <Text className="text-primary text-sm">Rejoin</Text>
          </View>
        </Pressable>
      );
    }

    const conv = item.data;
    return (
      <Pressable
        onPress={() => handleConversation(conv)}
        className="bg-surface border border-border rounded-lg p-4 mx-4 mb-2 active:border-primary"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text
              className="text-white text-sm font-medium"
              numberOfLines={1}
            >
              {conv.slug || conv.sessionId.slice(0, 8)}
            </Text>
            <View className="flex-row items-center mt-0.5">
              <Text className="text-gray-500 text-xs">
                {formatRelativeTime(conv.timestamp)}
              </Text>
              {conv.gitBranch && (
                <View className="bg-[#1f2937] rounded px-1.5 py-0.5 ml-2">
                  <Text className="text-blue-400 text-[10px]">
                    {conv.gitBranch}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Text className="text-primary text-sm">Resume</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1">
        <View className="px-6 pt-4 pb-2">
          <Pressable onPress={() => router.back()} className="mb-4">
            <Text className="text-primary text-base">← Projects</Text>
          </Pressable>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-white text-2xl font-bold">{name}</Text>
              {detail?.hasClaudeMd && (
                <Text className="text-gray-500 text-xs mt-1">
                  CLAUDE.md configured
                </Text>
              )}
            </View>
            <Pressable
              onPress={handleNewSession}
              className="bg-primary px-4 py-2.5 rounded-lg active:bg-primary-hover"
            >
              <Text className="text-white font-semibold text-sm">
                New Session
              </Text>
            </Pressable>
          </View>
        </View>

        {isLoading && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#238636" size="large" />
          </View>
        )}

        {!isLoading && error && (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-red-400 text-base text-center mb-4">
              {error}
            </Text>
            <Pressable
              onPress={() => loadDetail()}
              className="bg-primary px-6 py-3 rounded-lg active:bg-primary-hover"
            >
              <Text className="text-white font-semibold">Retry</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !error && detail && (
          <SectionList
            sections={sections}
            keyExtractor={(item, index) =>
              item.data
                ? item.type === "active"
                  ? item.data.id
                  : item.data.sessionId
                : `empty-${index}`
            }
            renderItem={renderItem}
            renderSectionHeader={({ section: { title } }) => (
              <View className="px-6 pt-5 pb-2">
                <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  {title}
                </Text>
              </View>
            )}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => loadDetail(true)}
                tintColor="#238636"
              />
            }
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
