// GraphQL schema definitions for gatsby-source-guru

const typeDefs = `
  type GuruCard implements Node {
    id: ID!
    content: String
    contentHtml: String
    title: String
    collection: GuruCollection
    collectionId: String
    boards: [GuruBoardInfo]
    boardIds: [String]
    owner: String
    lastModified: Date
    lastModifiedBy: String
    lastVerifiedBy: String
    dateCreated: Date
    lastVerified: Date
    nextVerificationDate: Date
    verificationState: String
    verificationInterval: Int
    verificationType: String
    shareStatus: String
    tags: [String]
    slug: String!
    attachedFiles: [GuruAttachment]
  }
  
  type GuruBoardInfo {
    id: String!
    title: String!
    slug: String
    items: [String]
    numberOfFacts: Int
    parentFolder: GuruParentFolder
  }
  
  type GuruBoard {
    id: String!
    title: String!
    slug: String
    items: [String]
    numberOfFacts: Int
    parentFolder: GuruBoard
  }
  
  type GuruUser {
    id: String!
    firstName: String
    lastName: String
    email: String
  }
  
  type GuruCollection {
    id: String!
    name: String!
    color: String
    collectionType: String
    publicCardsEnabled: Boolean
    collectionTypeDetail: String
  }

  type GuruAttachment {
    filename: String!
    filepath: String!
    originalUrl: String!
    size: Int!
    mimeType: String!
  }

  type GuruCollection implements Node {
    id: ID!
    name: String
    description: String
    colour: String
    publicCardsEnabled: Boolean
    dateCreated: String
    stats: GuruCollectionStats
  }

  type GuruCollectionStats {
    cards: Int
    boards: Int
    boardSections: Int
  }

  type GuruBoard implements Node {
    id: ID!
    title: String
    description: String
    collection: String
    collectionId: String
    dateCreated: String
    lastModified: String
    owner: String
    parentFolder: GuruParentFolder
  }
  
  type GuruParentFolder {
    id: String
    title: String
    slug: String
  }
`

module.exports = { typeDefs }