export type CrmFileItemType = 'folder' | 'image' | 'audio' | 'video' | 'document'
export type CrmExternalFileProvider = 'GOOGLE_DRIVE' | 'ONEDRIVE'

export type CrmFileLinkedEntities = {
  tasks: string[]
  leads: string[]
  opportunities: string[]
}

export type CrmFileAuditAction = 'CREATED' | 'UPLOADED' | 'RENAMED' | 'MOVED' | 'SHARED' | 'LINKED' | 'UNLINKED'

export type CrmFileAuditEntry = {
  id: string
  action: CrmFileAuditAction
  at: string
  actorUserId: string | null
  actorLabel: string | null
  message: string
}

export type CrmFileItem = {
  id: string
  name: string
  path: string
  directoryPath: string
  type: CrmFileItemType
  sizeBytes: number
  updatedAt: string
  url: string | null
  extension: string | null
  mimeType: string | null
  createdAt: string
  createdById: string | null
  sourceProvider?: CrmExternalFileProvider | null
  externalId?: string | null
  isExternal?: boolean
  sharedWithUserIds: string[]
  linkedEntities: CrmFileLinkedEntities
  auditTrail: CrmFileAuditEntry[]
}

export type CrmFolderNode = {
  name: string
  path: string
  children: CrmFolderNode[]
}

export type CrmFilesSnapshot = {
  currentPath: string
  breadcrumbs: Array<{ label: string; path: string }>
  tree: CrmFolderNode
  items: CrmFileItem[]
  recentItems: CrmFileItem[]
  usage: {
    totalBytes: number
    usedBytes: number
    freeBytes: number
    filesCount: number
    foldersCount: number
  }
}

export type CrmFilesTeamUser = {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
  sedeMemberships: Array<{
    sedeId: string
    sedeName: string
    role: string
  }>
}

export type JsonResponse<T> = {
  success?: boolean
  data?: T
  error?: string
}