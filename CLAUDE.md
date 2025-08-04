# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the gatsby-source-guru plugin.

## Project Overview

This is a Gatsby source plugin that fetches content from GetGuru knowledge base and creates GraphQL nodes for building static sites. The plugin supports both user authentication and collection-based authentication modes.

## Key Architecture

- **gatsby-node.js**: Main plugin file containing data fetching and GraphQL schema creation
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

```bash
# Run tests
npm test
npm run test:watch
npm run test:coverage

# Linting (currently disabled - needs configuration)
npm run lint

# Clean dependencies
npm run clean
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

## Recent Changes (v1.0.4)

- Enhanced GraphQL schema to expose full board and collection objects
- Changed `boards: [String]` to `boards: [GuruBoard]` 
- Changed `collection: String` to `collection: GuruCollection`
- Enables UI components to group cards by folders/boards
- Maintains backward compatibility for basic fields