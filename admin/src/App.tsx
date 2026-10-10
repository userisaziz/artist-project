import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/AppShell'
import { ArtistQueuePage } from '@/features/artists/ArtistQueuePage'
import { ArtistReviewPage } from '@/features/artists/ArtistReviewPage'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { AuthProvider, useAuth } from '@/lib/auth'
import { createQueryClient } from '@/lib/query-client'
import { LoginPage } from '@/pages/LoginPage'

/** Signed-out visitors only ever see the login page; admins get the console. */
function Gate() {
  const { status } = useAuth()
  if (status === 'restoring') return null
  if (status === 'signedOut') return <LoginPage />
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/artists" element={<ArtistQueuePage />} />
        <Route path="/artists/:id" element={<ArtistReviewPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="*" element={<Navigate to="/artists" replace />} />
      </Route>
    </Routes>
  )
}

export default function App({ queryClient = createQueryClient() }: { queryClient?: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  )
}
