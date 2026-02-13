export interface ClaudeMdSection {
  heading: string;
  content: string;
  order: number;
  source: 'platform' | 'workflow' | 'stack';
}

export function assembleClaudeMd(
  name: string,
  description: string,
  sections: ClaudeMdSection[]
): string {
  const sorted = [...sections].sort((a, b) => a.order - b.order);

  const header = `# ${name}\n\n${description}\n`;
  const body = sorted
    .map((s) => `${s.heading}\n\n${s.content}`)
    .join('\n\n---\n\n');

  return `${header}\n${body}\n`;
}
