import { RouterProvider } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { router } from './router'
import { queryClient } from './lib/query-provider'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {import.meta.env.DEV && (
        <>
          <TanStackRouterDevtools router={router} />
          <ReactQueryDevtools initialIsOpen={false} />
        </>
      )}
    </QueryClientProvider>
  )
}

export default App
