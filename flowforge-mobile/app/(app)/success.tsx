import { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { useStore } from "../../stores/store";
import { cloneAndLaunch } from "../../lib/server-api";
import type { CloneProgress } from "../../lib/server-api";

type Phase =
  | "idle"
  | "cloning"
  | "launching"
  | "initializing"
  | "done"
  | "error";

interface StepInfo {
  label: string;
  phase: Phase;
}

const STEPS: StepInfo[] = [
  { label: "Cloning repository", phase: "cloning" },
  { label: "Launching Claude", phase: "launching" },
  { label: "Running /init", phase: "initializing" },
];

function getPhaseFromMessage(message: string): Phase | null {
  if (
    message.includes("Cloning") ||
    message.includes("Receiving") ||
    message.includes("Resolving")
  ) {
    return "cloning";
  }
  if (message.includes("Launching Claude")) return "launching";
  if (message.includes("Waiting for Claude")) return "launching";
  if (message.includes("Running /init")) return "initializing";
  return null;
}

function phaseIndex(phase: Phase): number {
  switch (phase) {
    case "cloning":
      return 0;
    case "launching":
      return 1;
    case "initializing":
      return 2;
    case "done":
      return 3;
    default:
      return -1;
  }
}

export default function Success() {
  const router = useRouter();
  const {
    lastCreatedRepo,
    resetCreationState,
    homeServerUrl,
    homeServerToken,
    isServerConnected,
  } = useStore();

  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const started = useRef(false);

  const hasServer = !!(homeServerUrl && homeServerToken && isServerConnected);

  if (!lastCreatedRepo) {
    router.replace("/(app)");
    return null;
  }

  const handleCopy = async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAutoClone = async () => {
    if (!homeServerUrl || !homeServerToken || !lastCreatedRepo) return;

    setPhase("cloning");
    setErrorMessage(null);

    try {
      const result = await cloneAndLaunch(
        homeServerUrl,
        homeServerToken,
        lastCreatedRepo.clone_url,
        true,
        true,
        (progress: CloneProgress) => {
          if (progress.type === "progress" && progress.message) {
            const detected = getPhaseFromMessage(progress.message);
            if (detected) setPhase(detected);
          }
        },
      );

      setSessionId(result.sessionId || null);
      setPhase("done");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to clone on server",
      );
      setPhase("error");
    }
  };

  // Auto-start clone+init on mount when server is connected
  useEffect(() => {
    if (hasServer && !started.current) {
      started.current = true;
      handleAutoClone();
    }
  }, [hasServer]);

  const handleOpenTerminal = () => {
    if (sessionId) {
      router.push({
        pathname: "/(app)/server/terminal",
        params: { sessionId },
      });
    }
  };

  const handleRetry = () => {
    started.current = false;
    setPhase("idle");
    setErrorMessage(null);
    handleAutoClone();
  };

  const handleOpenClaudeCode = async () => {
    await WebBrowser.openBrowserAsync("https://claude.ai/code");
  };

  const handleCreateAnother = () => {
    resetCreationState();
    router.replace("/(app)");
  };

  const cloneCommand = `git clone ${lastCreatedRepo.clone_url}`;
  const currentIdx = phaseIndex(phase);

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

        {/* Auto clone+init progress (when server connected) */}
        {hasServer && phase !== "idle" && phase !== "error" && (
          <View className="bg-surface border border-border rounded-lg p-4 mb-6">
            {STEPS.map((step, idx) => {
              const isComplete = currentIdx > idx || phase === "done";
              const isCurrent = currentIdx === idx && phase !== "done";
              const isPending = currentIdx < idx && phase !== "done";

              return (
                <View key={step.phase} className="flex-row items-center py-2">
                  {isComplete && (
                    <Text className="text-primary text-lg mr-3 w-6 text-center">
                      ✓
                    </Text>
                  )}
                  {isCurrent && (
                    <View className="mr-3 w-6 items-center">
                      <ActivityIndicator size="small" color="#238636" />
                    </View>
                  )}
                  {isPending && (
                    <Text className="text-gray-600 text-lg mr-3 w-6 text-center">
                      ○
                    </Text>
                  )}
                  <Text
                    className={`text-base ${
                      isComplete
                        ? "text-gray-300"
                        : isCurrent
                          ? "text-white font-medium"
                          : "text-gray-600"
                    }`}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Error state */}
        {phase === "error" && (
          <View className="bg-surface border border-red-800 rounded-lg p-4 mb-6">
            <Text className="text-red-400 text-sm mb-3">{errorMessage}</Text>
            <Pressable
              onPress={handleRetry}
              className="bg-primary py-2 rounded items-center active:bg-primary-hover"
            >
              <Text className="text-white font-semibold">Retry</Text>
            </Pressable>
          </View>
        )}

        {/* No server: manual instructions */}
        {!hasServer && (
          <>
            <View className="mb-6">
              <Text className="text-white text-base font-medium mb-2">
                Clone your repository
              </Text>
              <Pressable
                onPress={() => handleCopy(cloneCommand, "clone")}
                className="bg-surface border border-border rounded-lg p-4 active:border-primary"
              >
                <Text
                  className="text-gray-300 font-mono text-sm"
                  numberOfLines={2}
                >
                  {cloneCommand}
                </Text>
                <Text className="text-primary text-sm mt-2">
                  {copiedField === "clone" ? "Copied!" : "Tap to copy"}
                </Text>
              </Pressable>
            </View>

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
          </>
        )}

        {/* Actions */}
        <View className="gap-3">
          {phase === "done" && sessionId && (
            <Pressable
              onPress={handleOpenTerminal}
              className="bg-primary py-4 rounded-lg items-center active:bg-primary-hover"
            >
              <Text className="text-white text-lg font-semibold">
                Open Terminal
              </Text>
            </Pressable>
          )}

          {!hasServer && (
            <Pressable
              onPress={handleOpenClaudeCode}
              className="bg-primary py-4 rounded-lg items-center active:bg-primary-hover"
            >
              <Text className="text-white text-lg font-semibold">
                Open Claude Code
              </Text>
            </Pressable>
          )}

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
