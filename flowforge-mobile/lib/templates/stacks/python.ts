export function getStackGitignore(): string {
  return `# Python
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
.eggs/

# Virtual environment
.venv/
venv/

# Type checking
.mypy_cache/

# Testing
.pytest_cache/
htmlcov/

# Distribution
dist/
build/
`;
}
