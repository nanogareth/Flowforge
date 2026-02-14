import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const GITHUB_CLIENT_ID = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID!;
const TOKEN_ENDPOINT = process.env.EXPO_PUBLIC_TOKEN_ENDPOINT!;
const TOKEN_KEY = "github_access_token";

const discovery = {
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
};

export function useGitHubAuth() {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "flowforge" });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GITHUB_CLIENT_ID,
      scopes: ["repo", "read:user"],
      redirectUri,
    },
    discovery,
  );

  return { request, response, promptAsync, redirectUri };
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  codeVerifier?: string,
): Promise<string> {
  const body: Record<string, string> = { code, redirect_uri: redirectUri };
  if (codeVerifier) body.code_verifier = codeVerifier;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    let message = `Token exchange failed (${response.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed.error) message = parsed.error;
    } catch {
      // Response wasn't JSON (e.g. HTML error page)
      message += ` — endpoint returned non-JSON. Check TOKEN_ENDPOINT in .env`;
    }
    throw new Error(message);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Token endpoint returned invalid JSON. URL: ${TOKEN_ENDPOINT}`,
    );
  }

  if (!data.access_token) {
    throw new Error("No access_token in response");
  }

  return data.access_token;
}

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
