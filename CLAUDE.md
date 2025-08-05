# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the gatsby-source-guru plugin.

## Project Overview

This is a Gatsby source plugin that fetches content from GetGuru knowledge base and creates GraphQL nodes for building static sites. The plugin supports both user authentication and collection-based authentication modes.

## Key Architecture

- **gatsby-node.js**: Main plugin file containing data fetching and core logic (445 lines)
- **schema.js**: GraphQL type definitions separated for better maintainability (84 lines)
- **utils.js**: Utility functions and constants for reusability (127 lines)
- **Authentication Modes**: Supports both user auth (username/password) and collection auth (token-based)
- **Content Processing**: Converts HTML to Markdown, handles file downloads, and processes internal links
- **GraphQL Schema**: Creates GuruCard, GuruBoard, GuruCollection, and GuruAttachment nodes

## Core Features

### Data Fetching
- Fetches cards from Guru API using search endpoint (collection mode) or team endpoint (user mode)
- Downloads and localizes attachments/images to static directory
- Converts internal Guru links to local page links
- Processes HTML content to Markdown using Turndown

### GraphQL Schema
- **GuruCard**: Main content nodes with title, content, slug, boards, collection, etc.
- **GuruBoard**: Represents Guru folders/boards with id, title, slug, items
- **GuruCollection**: Collection metadata with name, color, type information
- **GuruAttachment**: Downloaded file information with paths and metadata

## Development Commands

**IMPORTANT: Always use `yarn` instead of `npm` for all package management tasks!**

```bash
# Run tests
yarn test
yarn test:watch
yarn test:coverage
yarn test:verbose
yarn test:ci

# Package Management & Releases
yarn version           # Check current version
yarn version patch     # Bump patch version (1.0.7 → 1.0.8)
yarn version minor     # Bump minor version (1.0.7 → 1.1.0)
yarn version major     # Bump major version (1.0.7 → 2.0.0)

# Linting (currently disabled - needs configuration)
yarn lint

# Clean dependencies
yarn clean
```

## Release Process

**IMPORTANT**: This plugin uses automated releases through GitHub Actions.

1. Make changes and commit to main branch
2. Update version in package.json
3. Create GitHub release with tag (e.g., v1.0.4)
4. CI/CD pipeline automatically publishes to npm
5. DO NOT manually run `npm publish`

### Release Workflow
- Triggered by GitHub release creation
- Runs tests on Node.js 18.x, 20.x, 22.x
- Performs security audit
- Publishes to npm if all checks pass

## Configuration Options

### Authentication Modes
```js
// User auth mode
{
  authMode: "user",
  apiUsername: "username",
  apiPassword: "password", 
  teamName: "team-name"
}

// Collection auth mode (recommended)
{
  authMode: "collection",
  collectionId: "collection-id",
  collectionToken: "token"
}
```

### Optional Features
- `fetchCollections: true` - Fetch collection metadata (user mode only)
- `fetchBoards: true` - Fetch board metadata (user mode only)
- `downloadAttachments: true` - Download and localize files
- `attachmentDir: "static/guru-attachments"` - Directory for downloaded files

## Key Functions

### Content Processing
- `convertInternalLinks()` - Converts Guru URLs to local paths
- `createSlugFromTitle()` - Generates URL-safe slugs
- `downloadFile()` - Downloads and saves attachments

### Schema Creation
- `createSchemaCustomization()` - Defines GraphQL types
- `sourceNodes()` - Creates nodes from Guru data

## Testing

The plugin includes basic tests for:
- GraphQL schema creation
- Authentication utilities  
- Slug generation
- Content processing with Turndown

Run tests before making changes:
```bash
npm test
```

## Dependencies

- **node-fetch**: HTTP requests to Guru API
- **turndown**: HTML to Markdown conversion
- **crypto**: Hashing for unique filenames

## Common Issues

1. **Authentication Errors**: Check credentials and auth mode
2. **File Download Failures**: Verify attachment URLs and permissions
3. **GraphQL Schema Conflicts**: Ensure type definitions are unique
4. **Link Conversion Issues**: Check that all cards are included in the mapping

## Schema Changes

When modifying GraphQL schema:
1. Update type definitions in `createSchemaCustomization()`
2. Ensure data processing matches new schema
3. Test with real Guru data
4. Update version and create release
5. Update consuming projects' GraphQL queries

## Recent Changes

### v1.0.7 - Hierarchical Folder Structure Support
- Added hierarchical folder structure support with parent-child relationships
- Enhanced board fetching to include parent folder information
- Improved GraphQL schema to expose parent folder data

### v1.0.8 - Major Refactoring for Maintainability
- **Modular Architecture**: Split monolithic gatsby-node.js into focused modules
  - `gatsby-node.js`: Core plugin logic (445 lines, down from 752)
  - `schema.js`: GraphQL type definitions (84 lines)
  - `utils.js`: Utility functions and constants (127 lines)
- **Code Improvements**: 
  - Eliminated 160+ lines of duplicated attachment processing code
  - Simplified internal link conversion from 70+ to 25 lines
  - Created reusable utility functions with clear responsibilities
- **Better Organization**: 
  - Centralized configuration constants
  - Consistent error handling patterns
  - Improved testability and maintainability
- **Backward Compatibility**: All existing functionality preserved
- **Performance**: Reduced redundant operations and optimized regex usage

### v1.0.4 - Enhanced GraphQL Schema
- Enhanced GraphQL schema to expose full board and collection objects
- Changed `boards: [String]` to `boards: [GuruBoard]` 
- Changed `collection: String` to `collection: GuruCollection`
- Enables UI components to group cards by folders/boards
- Maintains backward compatibility for basic fields