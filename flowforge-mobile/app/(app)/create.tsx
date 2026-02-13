import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

interface TemplateOption {
  id: string; // encoded as "workflow--stack"
  title: string;
  description: string;
  icon: string;
}

const templates: TemplateOption[] = [
  {
    id: 'greenfield--typescript-react',
    title: 'Web App',
    description: 'React, Next.js, or similar web applications',
    icon: '🌐',
  },
  {
    id: 'greenfield--typescript-node',
    title: 'CLI Tool',
    description: 'Command-line applications and utilities',
    icon: '⌨️',
  },
];

export default function CreateProject() {
  const router = useRouter();

  const handleSelectTemplate = (id: string) => {
    router.push(`/(app)/create/${id}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-4">
        {/* Header */}
        <View className="mb-8">
          <Pressable
            onPress={() => router.back()}
            className="mb-4"
          >
            <Text className="text-primary text-base">← Back</Text>
          </Pressable>
          <Text className="text-white text-2xl font-bold">
            Choose a template
          </Text>
          <Text className="text-gray-400 mt-2">
            Select the type of project you want to create
          </Text>
        </View>

        {/* Template Grid */}
        <View className="gap-4">
          {templates.map((template) => (
            <Pressable
              key={template.id}
              onPress={() => handleSelectTemplate(template.id)}
              className="bg-surface p-6 rounded-xl border border-border active:border-primary"
            >
              <Text className="text-4xl mb-3">{template.icon}</Text>
              <Text className="text-white text-xl font-semibold mb-2">
                {template.title}
              </Text>
              <Text className="text-gray-400">{template.description}</Text>
            </Pressable>
          ))}
        </View>

        {/* Coming Soon */}
        <View className="mt-8 p-4 rounded-lg border border-border border-dashed">
          <Text className="text-gray-500 text-center">
            More workflows coming soon: Research, Feature, Learning
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
