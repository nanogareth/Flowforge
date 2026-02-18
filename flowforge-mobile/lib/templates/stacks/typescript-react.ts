export function getStackGitignore(): string {
  return `# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.next/
out/

# TypeScript
*.tsbuildinfo

# Testing
coverage/
`;
}
