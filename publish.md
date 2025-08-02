# Publishing gatsby-source-guru to npm

## Pre-publication Checklist

- [x] README.md with comprehensive documentation
- [x] package.json with proper metadata and dependencies
- [x] TypeScript definitions (index.d.ts)
- [x] MIT License
- [x] CHANGELOG.md
- [x] CONTRIBUTING.md
- [x] EXAMPLES.md
- [x] Proper file structure

## Files included in npm package

The `files` field in package.json includes:
- `gatsby-node.js` - Main plugin implementation
- `README.md` - Documentation
- `LICENSE` - MIT licence
- `package.json` - Package metadata
- `index.d.ts` - TypeScript definitions

## Publication Steps

### 1. Test the Package Locally

```bash
cd plugins/gatsby-source-guru

# Install dependencies
npm install

# Test package structure
npm pack

# This creates gatsby-source-guru-1.0.0.tgz
# Extract and verify contents:
tar -tzf gatsby-source-guru-1.0.0.tgz
```

### 2. Test in a Real Gatsby Project

```bash
# In your test Gatsby project
npm install /path/to/gatsby-source-guru-1.0.0.tgz

# Or use npm link for development
npm link /path/to/gatsby-source-guru
```

### 3. Verify npm Account and Registry

```bash
# Check you're logged in to npm
npm whoami

# Should show your npm username
# If not logged in:
npm login
```

### 4. Check Package Name Availability

```bash
# Check if 'gatsby-source-guru' is available
npm view gatsby-source-guru

# If it returns 404, the name is available
# If it exists, consider: @armakuni/gatsby-source-guru
```

### 5. Publish to npm

```bash
# Dry run first (see what would be published)
npm publish --dry-run

# If everything looks good, publish
npm publish

# For scoped package (if name is taken):
# npm publish --access public
```

### 6. Verify Publication

```bash
# Check the published package
npm view gatsby-source-guru

# Test installation
npm install gatsby-source-guru
```

## Post-publication Tasks

### 1. Update Repository

```bash
# Add and commit the plugin files
git add plugins/gatsby-source-guru/
git commit -m "Add gatsby-source-guru standalone package

- Comprehensive documentation and examples
- TypeScript definitions for better DX  
- Ready for npm publication
- MIT licensed open source package"

git push
```

### 2. Create GitHub Release

1. Go to https://github.com/armakuni/ak-way/releases
2. Click "Create a new release"
3. Tag: `gatsby-source-guru-v1.0.0`
4. Title: `gatsby-source-guru v1.0.0`
5. Description: Copy from CHANGELOG.md

### 3. Update Main Project

```bash
# Update main project to use published package
cd /path/to/main/project
npm uninstall ./plugins/gatsby-source-guru
npm install gatsby-source-guru
```

### 4. Documentation Updates

- Add link to npm package in main README
- Update any references to local plugin path
- Create blog post or announcement

## Alternative: Scoped Package

If `gatsby-source-guru` is taken, publish as scoped package:

```bash
# Update package.json name
"name": "@armakuni/gatsby-source-guru"

# Publish with public access
npm publish --access public
```

## Version Management

Follow semantic versioning:
- `1.0.x` - Bug fixes
- `1.x.0` - New features (backward compatible)
- `x.0.0` - Breaking changes

```bash
# Update version
npm version patch  # 1.0.1
npm version minor  # 1.1.0  
npm version major  # 2.0.0

# Publish new version
npm publish
```

## Maintenance

### Regular Updates
- Keep dependencies updated
- Add new features based on community feedback
- Maintain compatibility with latest Gatsby versions
- Update documentation and examples

### Community Engagement
- Respond to GitHub issues
- Review and merge pull requests
- Help users with configuration questions
- Gather feedback for future improvements