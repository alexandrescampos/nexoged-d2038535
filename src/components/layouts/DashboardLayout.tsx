import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  LayoutDashboard,
  Calendar,
  Search,
  Star,
  Clock,
  Plus,
  Users,
  Settings,
  Settings2,
  LogOut,
  ChevronDown,
  UserCircle,
  CreditCard,
  Shield,
  FileText,
  Building2,
  LucideIcon,
  RefreshCw,
  Info,
  Copy,
  Share2,
  FolderTree,
} from "lucide-react";
import { TabsProvider, useTabs } from "@/contexts/TabsContext";
import { TabsBar } from "@/components/TabsBar";
import { SupportChatWidget } from "@/components/dashboard/SupportChatWidget";

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  userAllowed?: boolean;
  hideForUser?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Geral",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Pesquisar", url: "/dashboard/documents?action=search", icon: Search, userAllowed: true },
    ],
  },
  {
    label: "Acesso Rápido",
    items: [
      { title: "Favoritos", url: "/dashboard/favorites", icon: Star, userAllowed: true },
      { title: "Últimos Acessos", url: "/dashboard/recent", icon: Clock, userAllowed: true },
      { title: "Vencimentos", url: "/dashboard/expiration-report", icon: Calendar, userAllowed: true },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Documentos", url: "/dashboard/documents", icon: FileText, userAllowed: true },
      { title: "Tipos de Documento", url: "/dashboard/document-types", icon: Settings2, adminOnly: true },
      
      { title: "Usuários", url: "/dashboard/users", icon: Users, adminOnly: true },
      { title: "Controle de Acesso", url: "/dashboard/access-control", icon: Shield, adminOnly: true },
    ],

  },
  {
    label: "Configurações",
    items: [
      { title: "Configurações", url: "/dashboard/settings", icon: Settings, hideForUser: true },
      { title: "Sobre", url: "/dashboard/about", icon: Info },
    ],
  },
];

// Helper to get all items for lookup
const allMenuItems = menuGroups.flatMap(group => group.items);

// Find menu item by URL
function findMenuItem(url: string): MenuItem | undefined {
  return allMenuItems.find((item) => item.url === url);
}

function DashboardSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { organization, profile, signOut, isOrgAdmin, isUser } = useAuth();
  const { state } = useSidebar();
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
      .slice(0, 2) || "U";

  const orgInitials =
    organization?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "ORG";

  const roleLabel = isOrgAdmin ? "Administrador" : isUser ? "Usuário" : "Usuário";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center">
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-sidebar-foreground truncate">{organization?.name || "Nexo GED"}</h1>
              <p className="text-xs text-sidebar-muted">Gestão Eletrônica de Documentos</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {menuGroups.map((group) => {
          const filteredItems = group.items.filter((item) => {
            if (item.adminOnly && !isOrgAdmin && !(item.userAllowed && isUser)) return false;
            if (item.hideForUser && isUser && !isOrgAdmin) return false;
            return true;
          });

          if (filteredItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label} className="py-2">
              <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider font-semibold px-4 mb-2">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredItems.map((item) => (
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
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || "Usuário"}</p>
              <p className="text-xs text-sidebar-muted">{roleLabel}</p>
            </div>
          )}
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-8 w-8 text-sidebar-muted hover:text-destructive"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function DashboardHeader() {
  const { profile, signOut, isOrgAdmin, isUser } = useAuth();
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
      .slice(0, 2) || "U";

  const roleLabel = isOrgAdmin ? "Administrador" : isUser ? "Usuário" : "Usuário";

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <span className="text-sm text-muted-foreground hidden sm:inline">{roleLabel}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline text-sm font-medium">{profile?.full_name || "Usuário"}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/dashboard/profile")}>
            <UserCircle className="mr-2 h-4 w-4" />
            Meu Perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/dashboard/terms")}>
            <FileText className="mr-2 h-4 w-4" />
            Termos de Uso
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/dashboard/privacy")}>
            <Shield className="mr-2 h-4 w-4" />
            Política de Privacidade
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

function DashboardContent() {
  const location = useLocation();
  const { openTab, openTabs, isClosing } = useTabs();
  const { organization } = useAuth();

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
      <TopBrandBar 
        isSuperAdmin={false}
        organizationLogo={organization?.logo_url}
        organizationName={organization?.name}
      />
      <DashboardHeader />
      <TabsBar />
      <main className="flex-1 p-6 bg-background overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default function DashboardLayout() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.must_reset_password) {
      navigate("/reset-password");
    }
  }, [profile, navigate]);

  return (
    <SidebarProvider>
      <TabsProvider storageKey="dashboard_tabs">
        <div className="min-h-screen flex w-full">
          <DashboardSidebar />
          <DashboardContent />
        </div>
        <SupportChatWidget />
      </TabsProvider>
    </SidebarProvider>
  );
}
