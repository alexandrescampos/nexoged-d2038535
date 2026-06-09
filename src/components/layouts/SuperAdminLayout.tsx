import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TopBrandBar } from "@/components/TopBrandBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Building2, CreditCard, Users, Settings, LogOut, HelpCircle, ChevronDown, User, FileText, Shield, LucideIcon, Info, Database, MessageSquare } from "lucide-react";
import { TabsProvider, useTabs } from "@/contexts/TabsContext";
import { TabsBar } from "@/components/TabsBar";
import { SupportChatWidget } from "@/components/dashboard/SupportChatWidget";

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", url: "/super-admin", icon: LayoutDashboard },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Organizações", url: "/super-admin/organizations", icon: Building2 },
      { title: "Usuários", url: "/super-admin/users", icon: Users },
      { title: "Documentos Legais", url: "/super-admin/legal", icon: FileText },
      { title: "Auditoria", url: "/super-admin/audit", icon: Shield },
      { title: "Base CAEPI", url: "/super-admin/caepi", icon: Database },
      { title: "Análise Chatbot", url: "/super-admin/chatbot-analytics", icon: MessageSquare },
    ],
  },
  {
    label: "Pagamentos",
    items: [
      { title: "Planos", url: "/super-admin/plans", icon: CreditCard },
      { title: "Stripe", url: "/super-admin/stripe", icon: CreditCard },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Meu Perfil", url: "/super-admin/profile", icon: User },
      { title: "Configurações", url: "/super-admin/settings", icon: Settings },
      { title: "Sobre", url: "/super-admin/about", icon: Info },
    ],
  },
];

const allMenuItems = menuGroups.flatMap(group => group.items);

// Find menu item by URL
function findMenuItem(url: string): MenuItem | undefined {
  return allMenuItems.find((item) => item.url === url);
}

function SuperAdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { profile, roles, signOut } = useAuth();
  const { openTab } = useTabs();
  const isCollapsed = state === "collapsed";

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleMenuClick = (item: MenuItem) => {
    openTab({
      id: item.url,
      title: item.title,
      icon: item.icon,
    });
    navigate(item.url);
  };

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const primaryRole = roles.includes("super_admin")
    ? "Super Admin"
    : roles.includes("org_admin")
      ? "Admin Org"
      : roles.includes("manager")
        ? "Gestor"
        : "Usuário";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-8 w-8 text-sidebar-primary" />
          {!isCollapsed && (
            <div>
              <h1 className="font-bold text-sidebar-foreground">Nexo EPI</h1>
              <p className="text-xs text-sidebar-muted">Super Admin</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {menuGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-2">
            <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider font-semibold px-4 mb-2">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={location.pathname === item.url}
                      tooltip={item.title}
                      onClick={() => handleMenuClick(item)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || "Usuário"}</p>
              <p className="text-xs text-sidebar-muted">{primaryRole}</p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start mt-2 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        )}
        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="w-full mt-2 text-muted-foreground hover:text-destructive"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function SuperAdminHeader() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "SA";

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <span className="text-sm text-muted-foreground hidden sm:inline">Painel de Administração Global</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline text-sm font-medium">{profile?.full_name || "Super Admin"}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/super-admin/profile")}>
            <User className="mr-2 h-4 w-4" />
            Meu Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/super-admin/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/super-admin/legal")}>
            <FileText className="mr-2 h-4 w-4" />
            Documentos Legais
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function SuperAdminContent() {
  const location = useLocation();
  const { openTab, openTabs, isClosing } = useTabs();

  // Sync current URL with tabs (handles direct URL navigation)
  useEffect(() => {
    // Skip if we're in the process of closing a tab
    if (isClosing()) return;
    
    const menuItem = findMenuItem(location.pathname);
    // Only open tab if it doesn't already exist
    const tabExists = openTabs.some((t) => t.id === location.pathname);
    if (menuItem && !tabExists) {
      openTab({
        id: menuItem.url,
        title: menuItem.title,
        icon: menuItem.icon,
      });
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 flex flex-col">
      <TopBrandBar isSuperAdmin={true} />
      <SuperAdminHeader />
      <TabsBar />
      <main className="flex-1 p-6 bg-background overflow-auto">
        <Outlet />
      </main>
      <SupportChatWidget />
    </div>
  );
}

export default function SuperAdminLayout() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.must_reset_password) {
      navigate("/reset-password");
    }
  }, [profile, navigate]);

  return (
    <SidebarProvider>
      <TabsProvider storageKey="super_admin_tabs">
        <div className="min-h-screen flex w-full">
          <SuperAdminSidebar />
          <SuperAdminContent />
        </div>
      </TabsProvider>
    </SidebarProvider>
  );
}
