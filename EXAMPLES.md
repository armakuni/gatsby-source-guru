# gatsby-source-guru Examples

This document provides practical examples of using gatsby-source-guru in different scenarios.

## Basic Setup

### Minimal Configuration

```javascript
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-source-guru',
      options: {
        collectionId: 'your-collection-id',
        authMode: 'collection',
        guruUsername: process.env.GURU_USERNAME,
        guruToken: process.env.GURU_TOKEN
      }
    }
  ]
}
```

### Full Configuration

```javascript
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-source-guru',
      options: {
        collectionId: 'your-collection-id',
        authMode: 'collection',
        guruUsername: process.env.GURU_USERNAME,
        guruToken: process.env.GURU_TOKEN,
        downloadAttachments: true,
        attachmentsDir: 'static/guru-files',
        convertToMarkdown: true,
        processInternalLinks: true,
        verbose: true
      }
    }
  ]
}
```

## GraphQL Queries

### List All Cards

```graphql
query AllCards {
  allGuruCard {
    nodes {
      id
      title
      slug
      lastModified
      owner {
        firstName
        lastName
      }
      collection {
        name
      }
    }
  }
}
```

### Card with Full Content

```graphql
query CardDetails($id: String!) {
  guruCard(id: { eq: $id }) {
    id
    title
    content
    markdownContent
    htmlContent
    lastModified
    dateCreated
    owner {
      firstName
      lastName
      email
      profilePicUrl
    }
    verifiers {
      user {
        firstName
        lastName
      }
    }
    attachments {
      filename
      url
      localPath
      contentType
    }
  }
}
```

### Cards by Collection

```graphql
query CardsByCollection($collectionName: String!) {
  allGuruCard(filter: { collection: { name: { eq: $collectionName } } }) {
    nodes {
      id
      title
      slug
      content
    }
  }
}
```

### Recent Cards

```graphql
query RecentCards($limit: Int = 10) {
  allGuruCard(
    sort: { lastModified: DESC }
    limit: $limit
  ) {
    nodes {
      id
      title
      slug
      lastModified
      owner {
        firstName
        lastName
      }
    }
  }
}
```

## Page Creation Examples

### Basic Page Creation

```javascript
// gatsby-node.js
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
        }
      }
    }
  `)
  
  if (result.errors) {
    reporter.panicOnBuild('Error loading Guru cards', result.errors)
    return
  }
  
  const cardTemplate = path.resolve('./src/templates/guru-card.js')
  
  result.data.allGuruCard.nodes.forEach(card => {
    createPage({
      path: `/docs/${card.slug}/`,
      component: cardTemplate,
      context: {
        id: card.id,
        slug: card.slug
      }
    })
  })
}
```

### Paginated Index Pages

```javascript
// gatsby-node.js
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
          collection {
            name
          }
        }
      }
    }
  `)
  
  const cards = result.data.allGuruCard.nodes
  const cardsPerPage = 12
  const numPages = Math.ceil(cards.length / cardsPerPage)
  
  // Create paginated index pages
  Array.from({ length: numPages }).forEach((_, i) => {
    createPage({
      path: i === 0 ? `/docs/` : `/docs/page/${i + 1}/`,
      component: path.resolve('./src/templates/docs-index.js'),
      context: {
        limit: cardsPerPage,
        skip: i * cardsPerPage,
        numPages,
        currentPage: i + 1,
        hasNextPage: i < numPages - 1,
        hasPrevPage: i > 0
      }
    })
  })
  
  // Create individual card pages
  cards.forEach(card => {
    createPage({
      path: `/docs/${card.slug}/`,
      component: path.resolve('./src/templates/guru-card.js'),
      context: {
        id: card.id,
        slug: card.slug
      }
    })
  })
}
```

### Collection-based Organization

```javascript
// gatsby-node.js
exports.createPages = async ({ graphql, actions, reporter }) => {
  const { createPage } = actions
  
  const result = await graphql(`
    query {
      allGuruCard {
        nodes {
          id
          slug
          title
          collection {
            id
            name
          }
        }
        group(field: { collection: { name: SELECT } }) {
          fieldValue
          nodes {
            id
            slug
            title
          }
        }
      }
    }
  `)
  
  // Create collection index pages
  result.data.allGuruCard.group.forEach(collection => {
    const collectionSlug = collection.fieldValue
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    
    createPage({
      path: `/docs/${collectionSlug}/`,
      component: path.resolve('./src/templates/collection.js'),
      context: {
        collectionName: collection.fieldValue,
        cards: collection.nodes
      }
    })
  })
  
  // Create individual card pages with collection context
  result.data.allGuruCard.nodes.forEach(card => {
    const collectionSlug = card.collection.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    
    createPage({
      path: `/docs/${collectionSlug}/${card.slug}/`,
      component: path.resolve('./src/templates/guru-card.js'),
      context: {
        id: card.id,
        slug: card.slug,
        collectionName: card.collection.name
      }
    })
  })
}
```

## Component Templates

### Basic Card Template

```jsx
// src/templates/guru-card.js
import React from 'react'
import { graphql } from 'gatsby'
import Layout from '../components/layout'
import SEO from '../components/seo'

const GuruCardTemplate = ({ data }) => {
  const card = data.guruCard
  
  return (
    <Layout>
      <SEO 
        title={card.title}
        description={card.content.substring(0, 160)}
      />
      
      <article className="guru-card">
        <header>
          <h1>{card.title}</h1>
          <div className="meta">
            <span>By {card.owner.firstName} {card.owner.lastName}</span>
            <span>Updated {new Date(card.lastModified).toLocaleDateString()}</span>
            <span>Collection: {card.collection.name}</span>
          </div>
        </header>
        
        <div 
          className="content"
          dangerouslySetInnerHTML={{ __html: card.content }} 
        />
        
        {card.attachments?.length > 0 && (
          <section className="attachments">
            <h3>Attachments</h3>
            <ul>
              {card.attachments.map(attachment => (
                <li key={attachment.filename}>
                  <a 
                    href={attachment.localPath || attachment.url}
                    download
                  >
                    {attachment.filename}
                  </a>
                </li>
              ))}
            </ul>
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
      dateCreated
      owner {
        firstName
        lastName
        email
      }
      collection {
        name
      }
      attachments {
        filename
        url
        localPath
        contentType
      }
    }
  }
`

export default GuruCardTemplate
```

### Markdown-focused Template

```jsx
// src/templates/guru-card-markdown.js
import React from 'react'
import { graphql } from 'gatsby'
import { MDXProvider } from '@mdx-js/react'
import Layout from '../components/layout'

const GuruCardMarkdownTemplate = ({ data }) => {
  const card = data.guruCard
  
  const components = {
    h1: props => <h1 className="text-3xl font-bold mb-4" {...props} />,
    h2: props => <h2 className="text-2xl font-semibold mb-3" {...props} />,
    p: props => <p className="mb-4 leading-relaxed" {...props} />,
    a: props => <a className="text-blue-600 hover:text-blue-800" {...props} />,
    img: props => <img className="max-w-full h-auto rounded" {...props} />
  }
  
  return (
    <Layout>
      <article className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-4">{card.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <span>By {card.owner.firstName} {card.owner.lastName}</span>
            <span>Updated {new Date(card.lastModified).toLocaleDateString()}</span>
            <span className="px-2 py-1 bg-blue-100 rounded">
              {card.collection.name}
            </span>
          </div>
        </header>
        
        <MDXProvider components={components}>
          <div 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: card.markdownContent || card.content }} 
          />
        </MDXProvider>
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
      }
      collection {
        name
      }
    }
  }
`

export default GuruCardMarkdownTemplate
```

### Collection Index Template

```jsx
// src/templates/collection.js
import React from 'react'
import { Link, graphql } from 'gatsby'
import Layout from '../components/layout'

const CollectionTemplate = ({ data, pageContext }) => {
  const cards = data.allGuruCard.nodes
  const { collectionName } = pageContext
  
  return (
    <Layout>
      <div className="collection-index">
        <header>
          <h1>{collectionName}</h1>
          <p>{cards.length} articles</p>
        </header>
        
        <div className="cards-grid">
          {cards.map(card => (
            <article key={card.id} className="card-preview">
              <h2>
                <Link to={`/docs/${card.slug}/`}>
                  {card.title}
                </Link>
              </h2>
              <div className="meta">
                <span>{card.owner.firstName} {card.owner.lastName}</span>
                <span>{new Date(card.lastModified).toLocaleDateString()}</span>
              </div>
              <p>{card.content.substring(0, 200)}...</p>
            </article>
          ))}
        </div>
      </div>
    </Layout>
  )
}

export const query = graphql`
  query($collectionName: String!) {
    allGuruCard(
      filter: { collection: { name: { eq: $collectionName } } }
      sort: { lastModified: DESC }
    ) {
      nodes {
        id
        title
        slug
        content
        lastModified
        owner {
          firstName
          lastName
        }
      }
    }
  }
`

export default CollectionTemplate
```

## Search Integration

### Algolia Search

```javascript
// gatsby-config.js
const queries = require('./src/utils/algolia-queries')

module.exports = {
  plugins: [
    {
      resolve: 'gatsby-source-guru',
      options: {
        collectionId: process.env.GURU_COLLECTION_ID,
        // ... other options
      }
    },
    {
      resolve: 'gatsby-plugin-algolia',
      options: {
        appId: process.env.GATSBY_ALGOLIA_APP_ID,
        apiKey: process.env.ALGOLIA_ADMIN_KEY,
        queries,
        chunkSize: 10000,
      }
    }
  ]
}
```

```javascript
// src/utils/algolia-queries.js
const guruCardsQuery = `{
  allGuruCard {
    nodes {
      objectID: id
      title
      content
      slug
      lastModified
      owner {
        firstName
        lastName
      }
      collection {
        name
      }
    }
  }
}`

const flatten = arr =>
  arr.map(({ node: { ...rest } }) => ({
    ...rest,
  }))

const settings = { attributesToSnippet: ['content:20'] }

const queries = [
  {
    query: guruCardsQuery,
    transformer: ({ data }) => flatten(data.allGuruCard.nodes),
    indexName: 'GuruCards',
    settings,
  },
]

module.exports = queries
```

## Environment Configuration

### Development

```bash
# .env.development
GURU_USERNAME=your-username
GURU_TOKEN=your-dev-token
GURU_COLLECTION_ID=dev-collection-id
```

### Production

```bash
# .env.production
GURU_USERNAME=your-username
GURU_TOKEN=your-prod-token
GURU_COLLECTION_ID=prod-collection-id
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
env:
  GURU_USERNAME: ${{ secrets.GURU_USERNAME }}
  GURU_TOKEN: ${{ secrets.GURU_TOKEN }}
  GURU_COLLECTION_ID: ${{ secrets.GURU_COLLECTION_ID }}
```

## Performance Optimization

### Incremental Builds

```javascript
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-source-guru',
      options: {
        // ... your config
        
        // Cache downloaded attachments
        downloadAttachments: true,
        attachmentsDir: 'static/guru-attachments',
        
        // Process only when needed
        processInternalLinks: process.env.NODE_ENV === 'production'
      }
    }
  ]
}
```

### Image Optimization

```jsx
// Using gatsby-plugin-image with downloaded attachments
import React from 'react'
import { GatsbyImage, getImage } from 'gatsby-plugin-image'

const CardWithImages = ({ card }) => {
  return (
    <article>
      <h1>{card.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: card.content }} />
      
      {card.attachments?.filter(att => att.contentType?.startsWith('image/')).map(image => {
        const gatsbyImage = getImage(image.localFile)
        return gatsbyImage ? (
          <GatsbyImage 
            key={image.filename}
            image={gatsbyImage} 
            alt={image.filename}
          />
        ) : (
          <img 
            key={image.filename}
            src={image.localPath || image.url} 
            alt={image.filename}
          />
        )
      })}
    </article>
  )
}
```

This covers the most common use cases and patterns for gatsby-source-guru. Each example can be adapted to your specific needs!