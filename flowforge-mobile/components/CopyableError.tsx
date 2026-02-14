import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";

interface CopyableErrorProps {
  message: string;
  children?: React.ReactNode;
}

export default function CopyableError({
  message,
  children,
}: CopyableErrorProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Pressable onPress={handleCopy} className="bg-error-bg p-4 rounded-lg mb-6">
      <Text className="text-error">{message}</Text>
      {children}
      <Text className="text-gray-500 text-xs mt-2">
        {copied ? "Copied!" : "Tap to copy"}
      </Text>
    </Pressable>
  );
}
