import * as SecureStore from "expo-secure-store";

const SERVER_URL_KEY = "home_server_url";
const SERVER_TOKEN_KEY = "home_server_token";

export async function saveServerCredentials(
  url: string,
  token: string,
): Promise<void> {
  await SecureStore.setItemAsync(SERVER_URL_KEY, url);
  await SecureStore.setItemAsync(SERVER_TOKEN_KEY, token);
}

export async function getServerCredentials(): Promise<{
  url: string;
  token: string;
} | null> {
  const url = await SecureStore.getItemAsync(SERVER_URL_KEY);
  const token = await SecureStore.getItemAsync(SERVER_TOKEN_KEY);
  if (url && token) return { url, token };
  return null;
}

export async function clearServerCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(SERVER_URL_KEY);
  await SecureStore.deleteItemAsync(SERVER_TOKEN_KEY);
}

export async function pairWithServer(
  url: string,
  code: string,
): Promise<string> {
  const normalizedUrl = url.replace(/\/+$/, "");
  const response = await fetch(`${normalizedUrl}/api/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Pairing failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.token) throw new Error("No token in pairing response");
  return data.token;
}

export async function checkHealth(url: string): Promise<boolean> {
  try {
    const normalizedUrl = url.replace(/\/+$/, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${normalizedUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}
