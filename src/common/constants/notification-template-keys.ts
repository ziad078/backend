export const NotificationTemplateKeys = {
  PARENT_WELCOME_TITLE: 'notifications.templates.parentWelcome.title',
  PARENT_WELCOME_MESSAGE: 'notifications.templates.parentWelcome.message',
  CHILD_LIMIT_REACHED_TITLE: 'notifications.templates.childLimitReached.title',
  CHILD_LIMIT_REACHED_MESSAGE: 'notifications.templates.childLimitReached.message',
  PARENT_CHILD_LIMIT_REACHED_TITLE: 'notifications.templates.parentChildLimitReached.title',
  PARENT_CHILD_LIMIT_REACHED_MESSAGE: 'notifications.templates.parentChildLimitReached.message',
} as const

export const NotificationTypes = {
  ACCOUNT_WELCOME: 'account_welcome',
  CHILD_LIMIT: 'child_limit_reached',
} as const
