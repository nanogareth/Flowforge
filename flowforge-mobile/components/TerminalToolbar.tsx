import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

interface TerminalToolbarProps {
  onSendKey: (data: string) => void;
  bottomInset?: number;
}

const KEYS = [
  { label: "ESC", data: "\x1b" },
  { label: "Tab", data: "\t" },
  { label: "Ctrl", data: "" },
  { label: "/", data: "/" },
  { label: "|", data: "|" },
  { label: "~", data: "~" },
  { label: "\u2190", data: "\x1b[D" },
  { label: "\u2191", data: "\x1b[A" },
  { label: "\u2193", data: "\x1b[B" },
  { label: "\u2192", data: "\x1b[C" },
];

const CTRL_COMBOS = [
  { label: "C", data: "\x03" },
  { label: "D", data: "\x04" },
  { label: "Z", data: "\x1a" },
  { label: "L", data: "\x0c" },
  { label: "A", data: "\x01" },
  { label: "E", data: "\x05" },
];

export default function TerminalToolbar({
  onSendKey,
  bottomInset = 0,
}: TerminalToolbarProps) {
  const [ctrlActive, setCtrlActive] = useState(false);

  const handleKeyPress = (key: (typeof KEYS)[number]) => {
    if (key.label === "Ctrl") {
      setCtrlActive((prev) => !prev);
      return;
    }
    onSendKey(key.data);
  };

  const handleCtrlCombo = (combo: (typeof CTRL_COMBOS)[number]) => {
    onSendKey(combo.data);
    setCtrlActive(false);
  };

  return (
    <View
      className="bg-[#1a1a1a] border-t border-border"
      style={{ paddingBottom: bottomInset }}
    >
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 8,
          paddingVertical: 6,
          gap: 8,
        }}
      >
        {KEYS.map((key) => (
          <Pressable
            key={key.label}
            onPress={() => handleKeyPress(key)}
            className={`px-3 py-2 rounded border ${
              key.label === "Ctrl" && ctrlActive
                ? "bg-primary border-primary"
                : "bg-surface border-border"
            }`}
          >
            <Text className="text-gray-300 text-sm font-mono">{key.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {ctrlActive && (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 8,
            paddingBottom: 6,
            gap: 8,
          }}
        >
          {CTRL_COMBOS.map((combo) => (
            <Pressable
              key={combo.label}
              onPress={() => handleCtrlCombo(combo)}
              className="px-3 py-2 rounded border bg-surface border-border"
            >
              <Text className="text-gray-300 text-sm font-mono">
                Ctrl+{combo.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
