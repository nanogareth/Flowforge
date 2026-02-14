import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Sentry from "@sentry/react-native";
import { useGitHubAuth, exchangeCodeForToken } from "../lib/auth";
import { useStore } from "../stores/store";

export default function Login() {
  const router = useRouter();
  const { request, response, promptAsync, redirectUri } = useGitHubAuth();
  const { login, isLoading, error, clearError } = useStore();
  const [authError, setAuthError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCodeExchange = useCallback(
    async (code: string, codeVerifier?: string) => {
      try {
        setAuthError(null);
        const token = await exchangeCodeForToken(
          code,
          redirectUri,
          codeVerifier,
        );
        await login(token);
        router.replace("/(app)");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Authentication failed";
        setAuthError(message);
        Sentry.captureException(err);
      }
    },
    [login, redirectUri, router],
  );

  useEffect(() => {
    if (response?.type === "success") {
      const { code } = response.params;
      handleCodeExchange(code, request?.codeVerifier);
    } else if (response?.type === "error") {
      setAuthError(response.error?.message || "OAuth authorization failed");
      Sentry.captureMessage("OAuth error", {
        extra: { error: response.error },
      });
    }
  }, [response, handleCodeExchange]);

  const handleLogin = () => {
    clearError();
    promptAsync();
  };

  return (
    <View className="flex-1 justify-center items-center bg-background px-6">
      {/* Logo/Title */}
      <View className="items-center mb-12">
        <Text className="text-4xl font-bold text-white mb-2">FlowForge</Text>
        <Text className="text-base text-gray-400 text-center">
          Create GitHub repos with CLAUDE.md templates
        </Text>
      </View>

      {/* Error Message */}
      {(error || authError) && (
        <Pressable
          onPress={async () => {
            await Clipboard.setStringAsync(authError || error || "");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="bg-error-bg p-4 rounded-lg mb-6 w-full max-w-sm"
        >
          <Text className="text-error text-center">{authError || error}</Text>
          <Text className="text-gray-500 text-xs text-center mt-2">
            {copied ? "Copied!" : "Tap to copy"}
          </Text>
        </Pressable>
      )}

      {/* Login Button */}
      <Pressable
        onPress={handleLogin}
        disabled={!request || isLoading}
        className={`bg-primary px-8 py-4 rounded-lg ${
          !request || isLoading ? "opacity-50" : "active:bg-primary-hover"
        }`}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-white text-lg font-semibold">
            Sign in with GitHub
          </Text>
        )}
      </Pressable>

      {/* Footer */}
      <Text className="text-gray-500 text-sm mt-8 text-center">
        We only request permissions to create repositories
      </Text>

      {/* Dev: show redirect URI */}
      {__DEV__ && redirectUri && (
        <Pressable
          onPress={async () => {
            await Clipboard.setStringAsync(redirectUri);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="mt-4 p-3 rounded-lg border border-border"
        >
          <Text className="text-gray-500 text-xs text-center" selectable>
            {redirectUri}
          </Text>
          <Text className="text-gray-600 text-xs text-center mt-1">
            {copied ? "Copied!" : "Tap to copy redirect URI"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
