export type WorkflowPreset = 'research' | 'feature' | 'greenfield' | 'learning';
export type StackPreset = 'typescript-react' | 'typescript-node' | 'python' | 'rust' | 'custom';

export interface CreateRepoOptions {
  name: string;
  description?: string;
  isPrivate: boolean;
  workflow: WorkflowPreset;
  stack: StackPreset;
}

export interface CreateRepoResult {
  success: boolean;
  repo?: CreatedRepo;
  error?: string;
  partialRepo?: string;
}

export interface CreatedRepo {
  full_name: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  workflow: WorkflowPreset;
  stack: StackPreset;
  createdAt: string;
}

export interface FileToCreate {
  path: string;
  content: string;
}

export interface WorkflowMeta {
  id: WorkflowPreset;
  title: string;
  description: string;
  icon: string;
}

export interface StackMeta {
  id: StackPreset;
  title: string;
  description: string;
  icon: string;
}
