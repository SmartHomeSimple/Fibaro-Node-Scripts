# Publishing Guide

This guide explains how to publish new versions of the package to npm.

## Prerequisites

1. **npm Account**: You need an npm account. Create one at [npmjs.com](https://www.npmjs.com/signup)

2. **npm Login**: Log in to npm from your terminal:

   ```bash
   npm login
   ```

3. **Repository Access**: You need push access to the GitHub repository

4. **GitHub npm Token** (for automated publishing):
   - Go to [npmjs.com](https://www.npmjs.com) → Account → Access Tokens
   - Create a new "Automation" token
   - Add it as `NPM_TOKEN` secret in GitHub repository settings

## Publishing Methods

### Method 1: Automated with GitHub Actions (Recommended)

1. **Create a GitHub Release**:
   - Go to your repository on GitHub
   - Click "Releases" → "Create a new release"
   - Create a new tag (e.g., `v1.0.1`)
   - Write release notes
   - Click "Publish release"

2. **GitHub Actions will automatically**:
   - Run tests
   - Publish to npm
   - Add provenance information

3. **Or manually trigger the workflow**:
   - Go to Actions → Publish to npm
   - Click "Run workflow"
   - Optionally specify a version

### Method 2: Using the Publish Script

The publish scripts handle version bumping, testing, publishing, and git operations.

**On Linux/Mac**:

```bash
# Make script executable (first time only)
chmod +x scripts/publish.sh

# Publish a patch version (1.0.0 → 1.0.1)
./scripts/publish.sh patch

# Publish a minor version (1.0.0 → 1.1.0)
./scripts/publish.sh minor

# Publish a major version (1.0.0 → 2.0.0)
./scripts/publish.sh major
```

**On Windows (PowerShell)**:

```powershell
# Publish a patch version (1.0.0 → 1.0.1)
.\scripts\publish.ps1 patch

# Publish a minor version (1.0.0 → 1.1.0)
.\scripts\publish.ps1 minor

# Publish a major version (1.0.0 → 2.0.0)
.\scripts\publish.ps1 major
```

The script will:

1. Check if you're logged into npm
2. Display current version
3. Ask for confirmation
4. Run tests
5. Bump version in package.json
6. Publish to npm
7. Push changes and tags to GitHub

### Method 3: Manual Publishing

If you prefer full manual control:

1. **Update version**:

   ```bash
   npm version patch  # or minor, or major
   ```

2. **Run tests**:

   ```bash
   npm test
   ```

3. **Publish**:

   ```bash
   npm publish --access public
   ```

4. **Push changes**:
   ```bash
   git push && git push --tags
   ```

## Version Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **Patch** (1.0.0 → 1.0.1): Bug fixes, small improvements
- **Minor** (1.0.0 → 1.1.0): New features, backward compatible
- **Major** (1.0.0 → 2.0.0): Breaking changes

## Pre-publish Checklist

Before publishing, ensure:

- [ ] All changes are committed
- [ ] Tests pass locally (`npm test`)
- [ ] README is up to date
- [ ] CHANGELOG is updated (if you maintain one)
- [ ] Package.json version is correct
- [ ] You're on the correct branch (usually `main` or `master`)
- [ ] Repository URL in package.json is correct

## Testing Before Publishing

Test the package locally before publishing:

```bash
# Create a tarball
npm pack

# This creates a .tgz file you can install in another project
npm install /path/to/fibaro-node-scripts-1.0.0.tgz
```

Or test installation from the actual package:

```bash
# Dry run to see what would be published
npm publish --dry-run
```

## After Publishing

1. **Verify on npm**: Check [npmjs.com/package/fibaro-node-scripts](https://www.npmjs.com/package/fibaro-node-scripts)

2. **Test installation**:

   ```bash
   npm install -g fibaro-node-scripts
   fibaro-pack --help
   ```

3. **Create Release Notes** on GitHub (if not done already)

4. **Announce** the release (optional):
   - Update documentation
   - Post in relevant communities
   - Update dependent projects

## Troubleshooting

### "You do not have permission to publish"

- Make sure you're logged in: `npm whoami`
- Check if package name is available or if you have access
- Package name might be taken; consider scoping: `@yourname/package-name`

### "Version already exists"

- The version number is already published
- Bump the version: `npm version patch`

### "Git working directory not clean"

- Commit or stash your changes before publishing

### "Tests failed"

- Fix the failing tests before publishing
- Or temporarily modify `prepublishOnly` script in package.json

## Support

For issues or questions:

- Open an issue on GitHub
- Check existing issues for solutions
- Contact maintainers
