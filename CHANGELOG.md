# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-02

### Added
- Initial release of gatsby-source-guru
- Fetch cards from GetGuru API with collection-based authentication
- Convert HTML content to Markdown using Turndown
- Download and process card attachments
- Convert internal Guru card links to local page routes
- GraphQL schema with typed GuruCard nodes
- TypeScript definitions for better developer experience
- Comprehensive documentation and examples
- Support for both collection and user authentication modes
- Configurable attachment downloading and processing
- Verbose logging option for debugging
- Error handling with detailed reporting

### Features
- **Authentication**: Collection-based (recommended) and user-based auth
- **Content Processing**: HTML to Markdown conversion with Turndown
- **Attachment Handling**: Download images, documents, and other files
- **Link Processing**: Convert internal Guru links to local routes
- **GraphQL Integration**: Fully typed nodes for Gatsby queries
- **Configuration**: Flexible options for different use cases
- **Debugging**: Verbose logging and error reporting

### Technical Details
- Node.js 18+ support
- Gatsby 4.x and 5.x compatibility
- ES modules and CommonJS support
- TypeScript definitions included
- MIT licensed