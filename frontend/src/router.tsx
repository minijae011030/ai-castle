import { routeTree } from '@/routeTree.gen'
import { createRouter } from '@tanstack/react-router'

export interface RouterContext {
  isAuthenticated: boolean
}

export const router = createRouter({
  routeTree,
  context: {
    isAuthenticated: false,
  },
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
