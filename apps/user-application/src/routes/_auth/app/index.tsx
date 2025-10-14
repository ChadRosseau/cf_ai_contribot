import { createFileRoute, Navigate } from '@tanstack/react-router'
import { ChatInterface } from '@/components/chat/chat-interface'
import { DashboardView } from '@/components/dashboard/dashboard-view'

export const Route = createFileRoute('/_auth/app/')({
  loader: async ({ context }) => {
    try {
      const response = await fetch('/api/user/preferences', {
        headers: {
          'Cookie': context.request?.headers.get('Cookie') || '',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        return { onboardingComplete: data.onboardingCompleted }
      } else {
        return { onboardingComplete: false }
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error)
      return { onboardingComplete: false }
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { onboardingComplete } = Route.useLoaderData()

  if (onboardingComplete === false) {
    return <Navigate to="/onboarding" />
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Contribot</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Welcome back!</span>
        </div>
      </header>
      
      <div className="flex-1 grid md:grid-cols-2 overflow-hidden">
        <div className="border-r">
          <ChatInterface />
        </div>
        <div>
          <DashboardView />
        </div>
      </div>
    </div>
  )
}
