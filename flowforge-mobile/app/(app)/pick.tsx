import { useState, useEffect, useRef } from "react";
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
import type { FrontmatterResult, WorkflowPreset } from "../../lib/types";

const MAX_FILE_SIZE = 500 * 1024; // 500KB

const workflowOptions: { id: WorkflowPreset; label: string }[] = [
  { id: "research", label: "Research" },
  { id: "feature", label: "Feature" },
  { id: "greenfield", label: "New Project" },
  { id: "learning", label: "Learning" },
];

type PickState =
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

  const [state, setState] = useState<PickState | null>(null);
  const [repoName, setRepoName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [workflow, setWorkflow] = useState<WorkflowPreset>("research");
  const launched = useRef(false);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/markdown", "text/plain", "application/octet-stream"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        // If no file was picked yet, go back
        if (!state || state.phase === "error") {
          router.back();
        }
        return;
      }

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
      setWorkflow(frontmatter.workflow);

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

  // Auto-launch file picker on mount
  useEffect(() => {
    if (!launched.current) {
      launched.current = true;
      handlePickFile();
    }
  }, []);

  const handleCreate = async () => {
    if (!token || !state || state.phase !== "picked") return;

    setState({ phase: "creating", status: "Creating repository..." });

    const result = await createRepository(token, {
      name: repoName,
      description: description || undefined,
      isPrivate,
      workflow,
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
    const ccResult = setupClaudeCode();
    setClaudeCodeState(ccResult.configureUrl);

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

        {/* Picked: Review + edit */}
        {state?.phase === "picked" && (
          <View className="gap-5">
            {/* File info */}
            <View className="bg-surface border border-border rounded-lg p-4">
              <Text className="text-gray-400 text-sm mb-1">Selected file</Text>
              <Text className="text-white font-medium">{state.filename}</Text>
            </View>

            {/* Workflow selector */}
            <View>
              <Text className="text-white text-base font-medium mb-2">
                Workflow
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {workflowOptions.map((opt) => (
                  <Pressable
                    key={opt.id}
                    onPress={() => setWorkflow(opt.id)}
                    className={`px-4 py-2 rounded-lg border ${
                      workflow === opt.id
                        ? "bg-primary border-primary"
                        : "bg-surface border-border"
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        workflow === opt.id ? "text-white" : "text-gray-400"
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Stack (read-only, inferred from frontmatter) */}
            <View className="bg-surface border border-border rounded-lg p-3">
              <Text className="text-gray-400 text-xs mb-1">Stack</Text>
              <Text className="text-white font-medium">
                {state.frontmatter.stack}
              </Text>
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
        {state?.phase === "creating" && (
          <View className="flex-1 justify-center items-center py-16">
            <ActivityIndicator size="large" color="#238636" />
            <Text className="text-gray-400 mt-4">{state.status}</Text>
          </View>
        )}

        {/* Error */}
        {state?.phase === "error" && (
          <View className="flex-1 justify-center items-center py-16">
            <CopyableError message={state.message} />
            <Pressable onPress={handlePickFile} className="mt-6 py-3">
              <Text className="text-primary text-base">Try again</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
