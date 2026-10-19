import { createElement } from 'react'
import { render } from '@testing-library/react'
import App from '@/App'
import { createQueryClient } from '@/lib/query-client'
import { db } from './fake-backend'

export const renderApp = (path = '/', queryClient = createQueryClient()) => {
  window.history.pushState({}, '', path)
  return render(createElement(App, { queryClient }))
}

/** Start signed in: the browser already holds the httpOnly refresh cookie, so the load-time refresh restores the session. */
export const renderSignedIn = (path: string, queryClient = createQueryClient()) => {
  db.refreshCookie = 'refresh-1'
  return renderApp(path, queryClient)
}
