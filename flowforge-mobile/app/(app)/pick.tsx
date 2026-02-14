import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useStore } from "../../stores/store";
import CopyableError from "../../components/CopyableError";
import { parseFrontmatter, filenameToRepoName } from "../../lib/frontmatter";
import { createRepository, isValidRepoName } from "../../lib/github";
import { setupClaudeCode } from "../../lib/claude-code-app";
import type { FrontmatterResult } from "../../lib/types";

const MAX_FILE_SIZE = 500 * 1024; // 500KB

type PickState =
  | { phase: "idle" }
  | {
      phase: "picked";
      filename: string;
      content: string;
      frontmatter: FrontmatterResult;
    }
  | { phase: "creating"; status: string }
  | { phase: "error"; message: string };

export default function PickScreen() {
  const router = useRouter();
  const { token, setLastCreatedRepo, setClaudeCodeState } = useStore();

  const [state, setState] = useState<PickState>({ phase: "idle" });
  const [repoName, setRepoName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/markdown", "text/plain", "application/octet-stream"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      // Validate .md extension
      if (!asset.name.toLowerCase().endsWith(".md")) {
        setState({
          phase: "error",
          message: "Please select a Markdown (.md) file.",
        });
        return;
      }

      // Validate file size
      if (asset.size && asset.size > MAX_FILE_SIZE) {
        setState({
          phase: "error",
          message: "File is too large. Maximum size is 500KB.",
        });
        return;
      }

      // Read file content
      const file = new File(asset.uri);
      const content = await file.text();

      const frontmatter = parseFrontmatter(content);
      const derivedName = filenameToRepoName(asset.name);

      setRepoName(derivedName);
      setDescription(frontmatter.description);
      setIsPrivate(frontmatter.isPrivate);

      setState({
        phase: "picked",
        filename: asset.name,
        content,
        frontmatter,
      });
    } catch {
      setState({
        phase: "error",
        message: "Failed to read file. Please try again.",
      });
    }
  };

  const handleCreate = async () => {
    if (!token || state.phase !== "picked") return;

    setState({ phase: "creating", status: "Creating repository..." });

    const result = await createRepository(token, {
      name: repoName,
      description: description || undefined,
      isPrivate,
      workflow: state.frontmatter.workflow,
      stack: state.frontmatter.stack,
      contextFile: { filename: state.filename, content: state.content },
    });

    if (!result.success || !result.repo) {
      setState({
        phase: "error",
        message: result.error || "Failed to create repository.",
      });
      return;
    }

    setLastCreatedRepo(result.repo);

    // Enable Claude Code (non-blocking)
    if (result.repo.id) {
      setState({ phase: "creating", status: "Enabling Claude Code..." });
      const ccResult = await setupClaudeCode(token, result.repo.id);
      setClaudeCodeState(ccResult.enabled ?? false, ccResult.error ?? null);
    }

    router.replace("/(app)/success");
  };

  const nameValid = repoName.length > 0 && isValidRepoName(repoName);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-6 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-6">
          <Pressable onPress={() => router.back()} className="mb-4">
            <Text className="text-primary text-base">← Back</Text>
          </Pressable>
          <Text className="text-white text-2xl font-bold">
            Import from Obsidian
          </Text>
          <Text className="text-gray-400 mt-2">
            Pick a markdown file to create a project from
          </Text>
        </View>

        {/* Idle: Pick file button */}
        {state.phase === "idle" && (
          <View className="flex-1 justify-center items-center py-16">
            <Pressable
              onPress={handlePickFile}
              className="bg-primary px-12 py-6 rounded-xl active:bg-primary-hover"
            >
              <Text className="text-white text-xl font-semibold text-center">
                Pick a Markdown File
              </Text>
            </Pressable>
            <Text className="text-gray-500 mt-4 text-center px-8">
              Select a .md file from your Obsidian vault or file system
            </Text>
          </View>
        )}

        {/* Picked: Review + edit */}
        {state.phase === "picked" && (
          <View className="gap-5">
            {/* File info */}
            <View className="bg-surface border border-border rounded-lg p-4">
              <Text className="text-gray-400 text-sm mb-1">Selected file</Text>
              <Text className="text-white font-medium">{state.filename}</Text>
            </View>

            {/* Inferred settings */}
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface border border-border rounded-lg p-3">
                <Text className="text-gray-400 text-xs mb-1">Workflow</Text>
                <Text className="text-white font-medium capitalize">
                  {state.frontmatter.workflow}
                </Text>
              </View>
              <View className="flex-1 bg-surface border border-border rounded-lg p-3">
                <Text className="text-gray-400 text-xs mb-1">Stack</Text>
                <Text className="text-white font-medium">
                  {state.frontmatter.stack}
                </Text>
              </View>
            </View>

            {/* Repo name */}
            <View>
              <Text className="text-white text-base font-medium mb-2">
                Repository name
              </Text>
              <TextInput
                value={repoName}
                onChangeText={setRepoName}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-white"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {repoName.length > 0 && !nameValid && (
                <Text className="text-red-400 text-sm mt-1">
                  Lowercase letters, numbers, and hyphens only
                </Text>
              )}
            </View>

            {/* Description */}
            <View>
              <Text className="text-white text-base font-medium mb-2">
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-white"
                placeholderTextColor="#6b7280"
                placeholder="Optional"
                multiline
              />
            </View>

            {/* Private toggle */}
            <View className="flex-row justify-between items-center bg-surface border border-border rounded-lg px-4 py-3">
              <Text className="text-white text-base">Private repository</Text>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: "#374151", true: "#238636" }}
                thumbColor="#ffffff"
              />
            </View>

            {/* Create button */}
            <Pressable
              onPress={handleCreate}
              disabled={!nameValid}
              className={`py-4 rounded-lg items-center ${nameValid ? "bg-primary active:bg-primary-hover" : "bg-gray-700 opacity-50"}`}
            >
              <Text className="text-white text-lg font-semibold">
                Create Repository
              </Text>
            </Pressable>

            {/* Pick different file */}
            <Pressable onPress={handlePickFile} className="py-3 items-center">
              <Text className="text-gray-400">Pick a different file</Text>
            </Pressable>
          </View>
        )}

        {/* Creating: spinner */}
        {state.phase === "creating" && (
          <View className="flex-1 justify-center items-center py-16">
            <ActivityIndicator size="large" color="#238636" />
            <Text className="text-gray-400 mt-4">{state.status}</Text>
          </View>
        )}

        {/* Error */}
        {state.phase === "error" && (
          <View className="flex-1 justify-center items-center py-16">
            <CopyableError message={state.message} />
            <Pressable
              onPress={() => setState({ phase: "idle" })}
              className="mt-6 py-3"
            >
              <Text className="text-primary text-base">Try again</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
