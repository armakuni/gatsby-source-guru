# gatsby-source-guru

A Gatsby source plugin for fetching content from [GetGuru](https://www.getguru.com/) knowledge base and creating pages from your cards.

## Features

- 🚀 **Fetch cards** from GetGuru API with collection-based authentication
- 📝 **Convert HTML to Markdown** using Turndown for better Gatsby integration
- 🖼️ **Download attachments** and optimize for static hosting
- 🔗 **Convert internal links** between Guru cards to local page routes
- ⚡ **GraphQL integration** with typed nodes for queries
- 🛡️ **Error handling** with detailed logging and fallbacks

## Installation

```bash
npm install gatsby-source-guru
# or
yarn add gatsby-source-guru
```

## Configuration

Add the plugin to your `gatsby-config.js`:

```javascript
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-source-guru',
      options: {
        // Required: Your Guru collection ID
        collectionId: 'your-collection-id',
        
        // Required: Authentication - choose one method
        
        // Option 1: Collection-based auth (recommended)
        authMode: 'collection',
        collectionToken: process.env.GURU_COLLECTION_TOKEN,
        
        // Option 2: User-based auth  
        // authMode: 'user',
        // apiUsername: process.env.GURU_API_USERNAME,
        // apiPassword: process.env.GURU_API_PASSWORD,
        // teamName: process.env.GURU_TEAM_NAME,
        
        // Optional: Download settings
        downloadAttachments: true,        // Download card attachments
        attachmentsDir: 'static/guru-attachments', // Where to save files
        
        // Optional: Content processing
        convertToMarkdown: true,          // Convert HTML to Markdown
        processInternalLinks: true,       // Convert Guru links to local routes
        
        // Optional: Debugging
        verbose: false                    // Enable detailed logging
      }
    }
  ]
}
```

## Environment Variables

Create a `.env` file in your project root:

```bash
# Collection-based authentication (recommended)
GURU_COLLECTION_TOKEN=your-collection-token

# OR User-based authentication
# GURU_API_USERNAME=your-username
# GURU_API_PASSWORD=your-password
# GURU_TEAM_NAME=your-team-name
```

## Usage

### GraphQL Queries

The plugin creates `GuruCard` nodes that you can query:

```graphql
query {
  allGuruCard {
    nodes {
      id
      title
      content          # Processed content (HTML or Markdown)
      markdownContent  # Markdown version (if enabled)
      htmlContent      # Original HTML content
      slug             # URL-friendly slug
      lastModified
      dateCreated
      owner {
        firstName
        lastName
        email
      }
      collection {
        name
        id
      }
      attachments {
        filename
        url
        localPath      # Path to downloaded file
      }
    }
  }
}
```

### Creating Pages

Use the data in `gatsby-node.js` to create pages:

```javascript
const path = require('path')

exports.createPages = async ({ graphql, actions, reporter }) => {
  const { createPage } = actions
  
  const result = await graphql(`
    query {
      allGuruCard {
        nodes {
          id
          slug
          title
          content
        }
      }
    }
  `)
  
  if (result.errors) {
    reporter.panicOnBuild('Error loading Guru cards', result.errors)
    return
  }
  
  const cardTemplate = path.resolve('./src/templates/card.js')
  
  result.data.allGuruCard.nodes.forEach(card => {
    createPage({
      path: `/pages/${card.slug}/`,
      component: cardTemplate,
      context: {
        id: card.id,
        title: card.title
      }
    })
  })
}
```

### Page Template Example

Create `src/templates/card.js`:

```jsx
import React from 'react'
import { graphql } from 'gatsby'
import Layout from '../components/layout'

const CardTemplate = ({ data }) => {
  const card = data.guruCard
  
  return (
    <Layout>
      <article>
        <header>
          <h1>{card.title}</h1>
          <p>
            By {card.owner.firstName} {card.owner.lastName} • 
            Last updated: {new Date(card.lastModified).toLocaleDateString()}
          </p>
        </header>
        
        <div dangerouslySetInnerHTML={{ __html: card.content }} />
        
        {card.attachments?.length > 0 && (
          <section>
            <h3>Attachments</h3>
            {card.attachments.map(attachment => (
              <a 
                key={attachment.filename} 
                href={attachment.localPath || attachment.url}
                download
              >
                {attachment.filename}
              </a>
            ))}
          </section>
        )}
      </article>
    </Layout>
  )
}

export const query = graphql`
  query($id: String!) {
    guruCard(id: { eq: $id }) {
      id
      title
      content
      markdownContent
      lastModified
      owner {
        firstName
        lastName
        email
      }
      attachments {
        filename
        url
        localPath
      }
    }
  }
`

export default CardTemplate
```

## Authentication Methods

### Collection-Based (Recommended)

Best for CI/CD and team environments:

1. Get your collection ID from Guru dashboard
2. Create a collection token in Guru settings
3. Use username + token authentication

### User-Based

For development or personal use:

1. Use your Guru email and password
2. Less secure, not recommended for production

## Content Processing

### HTML to Markdown Conversion

When `convertToMarkdown: true`, the plugin converts HTML content to Markdown using [Turndown](https://github.com/domchristie/turndown). This provides:

- Better integration with Markdown-based Gatsby workflows
- Cleaner content for search indexing
- Easier content manipulation

### Internal Link Processing

The plugin automatically converts internal Guru card links to local page routes:

```html
<!-- Original Guru link -->
<a href="https://app.getguru.com/card/abc123/My-Card">My Card</a>

<!-- Converted to local route -->
<a href="/pages/my-card/">My Card</a>
```

### Attachment Handling

Files are downloaded and stored locally:

- **Images**: Available for Gatsby image optimization
- **Documents**: Served as static assets
- **Public files**: Direct download links maintained
- **Private files**: Downloaded for local serving

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `collectionId` | string | **required** | Your Guru collection ID |
| `authMode` | string | `'collection'` | Authentication method: `'collection'` or `'user'` |
| `guruUsername` | string | - | Username for collection auth |
| `guruToken` | string | - | Token for collection auth |
| `guruEmail` | string | - | Email for user auth |
| `guruPassword` | string | - | Password for user auth |
| `downloadAttachments` | boolean | `true` | Download card attachments |
| `attachmentsDir` | string | `'static/guru-attachments'` | Directory for downloaded files |
| `convertToMarkdown` | boolean | `true` | Convert HTML to Markdown |
| `processInternalLinks` | boolean | `true` | Process internal Guru links |
| `verbose` | boolean | `false` | Enable detailed logging |

## Troubleshooting

### Authentication Issues

```
Error: Unauthorized (401)
```

- Verify your credentials in `.env`
- Check collection ID is correct
- Ensure token has proper permissions

### Module Not Found

```
Cannot find module 'turndown'
```

- Run `npm install` or `yarn install`
- Ensure `turndown` is in dependencies

### No Cards Found

```
Found 0 cards via search
```

- Verify collection has published cards
- Check collection permissions
- Enable `verbose: true` for detailed logs

### Build Failures

```
Error building static HTML
```

- Check for client-side only code in templates
- Verify GraphQL queries match schema
- Use `gatsby clean` to clear cache

## Development

### Local Development

```bash
# Clone the repository
git clone https://github.com/armakuni/ak-way.git
cd ak-way/plugins/gatsby-source-guru

# Install dependencies
npm install

# Test in a Gatsby project
npm link
cd /path/to/your/gatsby-site
npm link gatsby-source-guru
```

### Testing

```bash
# Run tests
npm test

# Test with different auth methods
GURU_USERNAME=test npm test
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/armakuni/ak-way/tree/main/plugins/gatsby-source-guru)
- 🐛 [Issues](https://github.com/armakuni/ak-way/issues)
- 💬 [Discussions](https://github.com/armakuni/ak-way/discussions)

## Related

- [Gatsby](https://www.gatsbyjs.com/) - Static site generator
- [GetGuru](https://www.getguru.com/) - Knowledge management platform
- [Turndown](https://github.com/domchristie/turndown) - HTML to Markdown converter

---

Built with ❤️ by [Armakuni](https://armakuni.com)