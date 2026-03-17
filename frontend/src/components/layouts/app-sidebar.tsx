import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { clearAuth } from '@/services/auth-service'
import { useUserStore } from '@/stores/user.store'
import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { CalendarIcon, HomeIcon, LogOutIcon, SettingsIcon, UsersIcon } from 'lucide-react'

interface AppSidebarPropsInterface {
  title: string
  link: string
  icon: React.ReactNode
  is_active: boolean
}

const SIDEBAR_ITEMS: AppSidebarPropsInterface[] = [
  {
    title: '홈',
    link: '/',
    icon: <HomeIcon />,
    is_active: true,
  },
  {
    title: '캘린더',
    link: '/calendar',
    icon: <CalendarIcon />,
    is_active: false,
  },
  {
    title: '에이전트',
    link: '/agents',
    icon: <UsersIcon />,
    is_active: false,
  },
  {
    title: '설정',
    link: '/settings',
    icon: <SettingsIcon />,
    is_active: false,
  },
]

export const AppSidebar = () => {
  const navigate = useNavigate()
  const router_state = useRouterState()
  const pathname = router_state.location.pathname
  const user_info = useUserStore((s) => s.userInfo)

  const handleLogout = () => {
    clearAuth()
    navigate({ to: '/login' })
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-2">
            <span className="font-semibold text-sidebar-foreground">AI Castle</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {SIDEBAR_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.link}>
                    <SidebarMenuButton asChild isActive={pathname === item.link}>
                      <Link to={item.link}>
                        {item.icon}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          {user_info && (
            <p className="px-2 py-1 text-xs text-muted-foreground truncate">
              {user_info.user_name}
            </p>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout}>
                <LogOutIcon />
                <span>로그아웃</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
