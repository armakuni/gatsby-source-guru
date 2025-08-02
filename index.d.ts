// Type definitions for gatsby-source-guru
// Project: https://github.com/armakuni/ak-way/tree/main/plugins/gatsby-source-guru

export interface GuruPluginOptions {
  /** Your Guru collection ID (required) */
  collectionId: string

  /** Authentication mode: 'collection' (recommended) or 'user' */
  authMode?: 'collection' | 'user'

  /** Username for collection-based authentication */
  guruUsername?: string

  /** Token for collection-based authentication */
  guruToken?: string

  /** Email for user-based authentication */
  guruEmail?: string

  /** Password for user-based authentication */
  guruPassword?: string

  /** Download card attachments (default: true) */
  downloadAttachments?: boolean

  /** Directory to save downloaded attachments (default: 'static/guru-attachments') */
  attachmentsDir?: string

  /** Convert HTML content to Markdown (default: true) */
  convertToMarkdown?: boolean

  /** Process internal Guru links to local routes (default: true) */
  processInternalLinks?: boolean

  /** Enable verbose logging (default: false) */
  verbose?: boolean
}

export interface GuruUser {
  id: string
  status: string
  email: string
  firstName: string
  lastName: string
  profilePicUrl?: string
}

export interface GuruCollection {
  id: string
  name: string
  color?: string
  collectionType: string
  collectionTypeDetail: string
  publicCardsEnabled: boolean
}

export interface GuruBoard {
  id: string
  title: string
  slug: string
  items: any[]
  numberOfFacts: number
}

export interface GuruVerifier {
  type: string
  user: GuruUser
  id: string
}

export interface GuruAttachment {
  filename: string
  url: string
  localPath?: string
  contentType?: string
  size?: number
}

export interface GuruCard {
  /** Unique card ID */
  id: string

  /** Card title/preferred phrase */
  title: string

  /** URL-friendly slug */
  slug: string

  /** Original HTML content */
  htmlContent: string

  /** Processed content (HTML or Markdown based on settings) */
  content: string

  /** Markdown version of content (if conversion enabled) */
  markdownContent?: string

  /** Card owner information */
  owner: GuruUser

  /** Collection this card belongs to */
  collection: GuruCollection

  /** Card verifiers */
  verifiers: GuruVerifier[]

  /** Boards this card appears on */
  boards: GuruBoard[]

  /** Card creation date */
  dateCreated: string

  /** Last modification date */
  lastModified: string

  /** Last verification date */
  lastVerified?: string

  /** User who last verified */
  lastVerifiedBy?: GuruUser

  /** User who last modified */
  lastModifiedBy?: GuruUser

  /** Next verification date */
  nextVerificationDate?: string

  /** Verification interval in days */
  verificationInterval?: number

  /** Verification type */
  verificationType?: string

  /** Verification state */
  verificationState?: string

  /** Share status */
  shareStatus: string

  /** Comments enabled */
  commentsEnabled: boolean

  /** Card type */
  cardType: string

  /** Content schema version */
  contentSchemaVersion?: string

  /** Downloaded attachments */
  attachments: GuruAttachment[]

  /** Whether user follows this card */
  followed: boolean

  /** Highlighted attachments */
  highlightedAttachments: any[]

  /** Highlighted title content */
  highlightedTitleContent: any[]
}

// Gatsby GraphQL node types
export interface GuruCardNode extends GuruCard {
  /** Gatsby node ID */
  id: string

  /** Gatsby internal fields */
  internal: {
    type: 'GuruCard'
    contentDigest: string
  }

  /** Original Guru card ID */
  guruId: string
}

// Plugin configuration for gatsby-config.js
declare module 'gatsby' {
  interface PluginOptions {
    'gatsby-source-guru'?: GuruPluginOptions
  }
}

// Export the main plugin function signature
export function sourceNodes(
  args: {
    actions: any
    createNodeId: (input: string) => string
    createContentDigest: (input: any) => string
    reporter: any
  },
  options: GuruPluginOptions
): Promise<void>

export function createSchemaCustomization(args: {
  actions: any
}): void