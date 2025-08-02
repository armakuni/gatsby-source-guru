# Contributing to gatsby-source-guru

We love your input! We want to make contributing to gatsby-source-guru as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

### Local Development

```bash
# Clone the repository
git clone https://github.com/armakuni/ak-way.git
cd ak-way/plugins/gatsby-source-guru

# Install dependencies
npm install

# Test the plugin locally
npm link

# In your test Gatsby project
cd /path/to/test-project
npm link gatsby-source-guru
```

### Testing

```bash
# Run existing tests
npm test

# Test with different configurations
GURU_USERNAME=test GURU_TOKEN=test npm test

# Test with verbose logging
DEBUG=true npm test
```

## Code Style

- Use meaningful variable names
- Add comments for complex logic
- Follow existing code patterns
- Keep functions focused and small

## Bug Reports

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

### Bug Report Template

```markdown
**Environment:**
- gatsby-source-guru version: 
- Gatsby version:
- Node version:
- OS:

**Expected Behavior:**
What should happen?

**Actual Behavior:**
What actually happens?

**Steps to Reproduce:**
1. Configure plugin with...
2. Run `gatsby develop`
3. See error...

**Configuration:**
```javascript
// Your gatsby-config.js plugin configuration
```

**Error Messages:**
```
Paste any error messages here
```

**Additional Context:**
Add any other context about the problem here.
```

## Feature Requests

We welcome feature requests! Please:

1. Check if the feature already exists
2. Explain the use case clearly
3. Provide examples of how it would work
4. Consider implementation complexity

### Feature Request Template

```markdown
**Problem Statement:**
What problem does this solve?

**Proposed Solution:**
How should this feature work?

**Alternatives Considered:**
What other approaches did you consider?

**Use Cases:**
Who would use this and how?

**Implementation Notes:**
Any technical considerations?
```

## Coding Guidelines

### Code Structure

```javascript
// Good: Clear function names and documentation
/**
 * Downloads a file from Guru API and saves it locally
 * @param {string} url - The file URL
 * @param {string} filepath - Local save path
 * @returns {Promise<boolean>} Success status
 */
async function downloadFile(url, filepath) {
  // Implementation...
}

// Bad: Unclear purpose and no documentation
async function dlFile(u, f) {
  // Implementation...
}
```

### Error Handling

```javascript
// Good: Specific error handling with context
try {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json()
} catch (error) {
  reporter.error(`Failed to fetch from Guru API: ${error.message}`)
  throw error
}

// Bad: Generic error handling
try {
  return await fetch(url).then(r => r.json())
} catch (e) {
  console.log('error', e)
}
```

### Configuration Validation

```javascript
// Good: Clear validation with helpful messages
function validateOptions(options) {
  if (!options.collectionId) {
    throw new Error('gatsby-source-guru: collectionId is required')
  }
  
  if (options.authMode === 'collection' && !options.guruToken) {
    throw new Error('gatsby-source-guru: guruToken is required for collection auth mode')
  }
}
```

## Documentation

- Update README.md for new features
- Add TypeScript definitions for new options
- Include usage examples
- Update CHANGELOG.md

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to open an issue with the `question` label or reach out to the maintainers.