import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Sentry from '@sentry/react-native';
import { createRepository, deleteRepository } from '../../../lib/github';
import { setupClaudeCode } from '../../../lib/claude-code-app';
import type { WorkflowPreset, StackPreset } from '../../../lib/types';
import { useStore } from '../../../stores/store';
import CopyableError from '../../../components/CopyableError';

const schema = z.object({
  name: z
    .string()
    .min(1, 'Repository name is required')
    .max(100, 'Name too long')
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/,
      'Use lowercase letters, numbers, and hyphens only'
    ),
  description: z.string().max(500, 'Description too long').optional(),
  isPrivate: z.boolean(),
});

type FormData = z.infer<typeof schema>;

function parseTypeParam(type: string): { workflow: WorkflowPreset; stack: StackPreset } {
  const [workflow, stack] = type.split('--') as [WorkflowPreset, StackPreset];
  return { workflow: workflow || 'greenfield', stack: stack || 'custom' };
}

const workflowTitles: Record<WorkflowPreset, string> = {
  research: 'Research',
  feature: 'Feature',
  greenfield: 'New Project',
  learning: 'Learning',
};

export default function CreateForm() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();
  const { token, setLastCreatedRepo, setClaudeCodeState } = useStore();

  const { workflow, stack } = parseTypeParam(type || 'greenfield--custom');
  const templateTitle = workflowTitles[workflow] || 'Project';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialRepo, setPartialRepo] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      isPrivate: true,
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!token || !type) return;

    setIsSubmitting(true);
    setError(null);
    setPartialRepo(null);

    try {
      const result = await createRepository(token, {
        name: data.name,
        description: data.description,
        isPrivate: data.isPrivate,
        workflow,
        stack,
      });

      if (result.success && result.repo) {
        setLastCreatedRepo(result.repo);

        // Configure Claude Code access
        const ccResult = setupClaudeCode();
        setClaudeCodeState(ccResult.configureUrl);

        router.replace('/(app)/success');
      } else {
        setError(result.error || 'Failed to create repository');
        if (result.partialRepo) {
          setPartialRepo(result.partialRepo);
        }
      }
    } catch (err) {
      Sentry.captureException(err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePartialRepo = async () => {
    if (!token || !partialRepo) return;

    setIsSubmitting(true);
    const deleted = await deleteRepository(token, partialRepo);
    setIsSubmitting(false);

    if (deleted) {
      setPartialRepo(null);
      setError('Repository deleted. You can try again.');
    } else {
      setError('Failed to delete repository. Please delete it manually on GitHub.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6 pt-4">
          {/* Header */}
          <View className="mb-8">
            <Pressable onPress={() => router.back()} className="mb-4">
              <Text className="text-primary text-base">← Back</Text>
            </Pressable>
            <Text className="text-white text-2xl font-bold">
              Create {templateTitle}
            </Text>
            <Text className="text-gray-400 mt-2">
              Enter the details for your new repository
            </Text>
          </View>

          {/* Error Message */}
          {error && (
            <CopyableError message={error}>
              {partialRepo && (
                <Pressable
                  onPress={handleDeletePartialRepo}
                  disabled={isSubmitting}
                  className="mt-2"
                >
                  <Text className="text-primary underline">
                    Delete partial repository and retry
                  </Text>
                </Pressable>
              )}
            </CopyableError>
          )}

          {/* Form */}
          <View className="gap-6">
            {/* Name Input */}
            <View>
              <Text className="text-white text-base font-medium mb-2">
                Repository Name *
              </Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="my-awesome-project"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-white text-base"
                  />
                )}
              />
              {errors.name && (
                <Text className="text-error text-sm mt-1">
                  {errors.name.message}
                </Text>
              )}
            </View>

            {/* Description Input */}
            <View>
              <Text className="text-white text-base font-medium mb-2">
                Description
              </Text>
              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="A short description of your project"
                    placeholderTextColor="#666"
                    multiline
                    numberOfLines={3}
                    className="bg-surface border border-border rounded-lg px-4 py-3 text-white text-base min-h-[80px]"
                    textAlignVertical="top"
                  />
                )}
              />
              {errors.description && (
                <Text className="text-error text-sm mt-1">
                  {errors.description.message}
                </Text>
              )}
            </View>

            {/* Private Toggle */}
            <View className="flex-row justify-between items-center bg-surface p-4 rounded-lg border border-border">
              <View className="flex-1 mr-4">
                <Text className="text-white text-base font-medium">
                  Private Repository
                </Text>
                <Text className="text-gray-400 text-sm mt-1">
                  Only you can see this repository
                </Text>
              </View>
              <Controller
                control={control}
                name="isPrivate"
                render={({ field: { onChange, value } }) => (
                  <Switch
                    value={value}
                    onValueChange={onChange}
                    trackColor={{ false: '#333', true: '#238636' }}
                    thumbColor="#fff"
                  />
                )}
              />
            </View>
          </View>

          {/* Submit Button */}
          <View className="mt-8 mb-8">
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className={`bg-primary py-4 rounded-lg items-center ${
                isSubmitting ? 'opacity-50' : 'active:bg-primary-hover'
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-lg font-semibold">
                  Create Repository
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
