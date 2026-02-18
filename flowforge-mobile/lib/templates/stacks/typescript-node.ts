export function getStackGitignore(): string {
  return `# Dependencies
node_modules/

# Build
dist/

# TypeScript
*.tsbuildinfo

# Testing
coverage/
`;
}
