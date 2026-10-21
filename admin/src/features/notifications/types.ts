/** Mirrors backend app/notification/schemas.py (the signed-in user's inbox; admins get console links). */
export interface AdminNotification {
  id: string
  kind: string
  title: string
  body: string
  /** An admin console path, e.g. "/artists/<id>" or "/support?ticket=<id>". */
  link: string | null
  read_at: string | null
  created_at: string
}

export interface NotificationPage {
  items: AdminNotification[]
  next_cursor: string | null
}
