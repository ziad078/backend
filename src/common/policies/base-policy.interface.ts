export interface Actor {
  userId: string
  roles: string[]
  email?: string
}

export interface PolicyResult {
  allowed: boolean
  reason?: string
}

export interface Policy<T> {
  canView(actor: Actor, resource: T): PolicyResult
  canCreate(actor: Actor, resource?: Partial<T>): PolicyResult
  canUpdate(actor: Actor, resource: T): PolicyResult
  canDelete(actor: Actor, resource: T): PolicyResult
}
