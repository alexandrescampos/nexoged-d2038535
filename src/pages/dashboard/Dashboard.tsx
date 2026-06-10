import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGED } from "@/hooks/useGED";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  FolderTree, 
  Star, 
  Clock, 
  FileText, 
  AlertCircle,
  Plus,
  ArrowRight,
  Search,
  ChevronRight,
  FileIcon,
  HardDrive,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useTabs } from "@/contexts/TabsContext";
import { useOrganizationStructure } from "@/hooks/useOrganizationStructure";
import { useUserScopes } from "@/hooks/useUserScopes";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export default function OrgDashboard() {
  const { organization, profile } = useAuth();
  const navigate = useNavigate();
  const { openTab } = useTabs();
  const { departments: allDepartments, sectors: allSectors, folders: allFolders, isLoading: isLoadingStructure } = useOrganizationStructure();
  const { scopes } = useUserScopes();

  // Filtragem hierárquica por escopo do usuário
  const folderAncestors = React.useMemo(() => {
    const map = new Map<string, string[]>();
    const byId = new Map(allFolders.map(f => [f.past_id, f]));
    allFolders.forEach(f => {
      const chain: string[] = [];
      let cur: any = f;
      while (cur) { chain.push(cur.past_id); cur = cur.past_id_pai ? byId.get(cur.past_id_pai) : null; }
      map.set(f.past_id, chain);
    });
    return map;
  }, [allFolders]);

  const folderAllowed = (folderId: string, sectorId: string, deptId: string) => {
    if (scopes.unrestricted) return true;
    if (scopes.departmentIds.has(deptId)) return true;
    if (scopes.sectorIds.has(sectorId)) return true;
    return (folderAncestors.get(folderId) || [folderId]).some(id => scopes.folderIds.has(id));
  };
  const sectorAllowed = (sectorId: string, deptId: string) => {
    if (scopes.unrestricted) return true;
    if (scopes.departmentIds.has(deptId) || scopes.sectorIds.has(sectorId)) return true;
    return allFolders.some(f => f.set_id === sectorId && folderAllowed(f.past_id, sectorId, deptId));
  };
  const departmentAllowed = (deptId: string) => {
    if (scopes.unrestricted) return true;
    if (scopes.departmentIds.has(deptId)) return true;
    return allSectors.some(s => s.dept_id === deptId && sectorAllowed(s.set_id, deptId));
  };

  const departments = allDepartments.filter(d => departmentAllowed(d.dept_id));
  const sectors = allSectors.filter(s => sectorAllowed(s.set_id, s.dept_id));
  const folders = allFolders.filter(f => {
    const sec = allSectors.find(s => s.set_id === f.set_id);
    return sec ? folderAllowed(f.past_id, sec.set_id, sec.dept_id) : false;
  });
  const { documents: recentDocuments, isLoading: isLoadingRecent } = useGED(null, false, true);
  const { documents: favoriteDocuments, isLoading: isLoadingFavorites } = useGED(null, true, false);

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    totalDocs: 0,
    usedSpace: 0,
    pendingDocs: 0,
    totalUsers: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!organization?.id) return;
      setIsLoadingStats(true);
      try {
        const [docsCount, spaceUsage, pendingDocs, activeUsers] = await Promise.all([
          supabase.from("ged_documents").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).neq("status", "deleted"),
          supabase.rpc('sum_org_document_size', { p_org_id: organization.id }),
          supabase.from("ged_documents").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).eq("status", "pending"),
          supabase.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).eq("is_active", true),
        ]);

        setStats({
          totalDocs: docsCount.count || 0,
          usedSpace: (spaceUsage.data as number) || 0,
          pendingDocs: pendingDocs.count || 0,
          totalUsers: activeUsers.count || 0
        });
      } catch (err) {
        console.error("Dashboard stats error:", err);
      } finally {
        setIsLoadingStats(false);
      }
    };
    fetchStats();
  }, [organization?.id]);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const renderNavTree = (parentId: string | null = null, sectorId: string | null = null, level: number = 0) => {
    if (level === 0) {
      return (
        <div className="space-y-1">
          {departments.map(dept => (
            <div key={dept.dept_id}>
              <div 
                className="flex items-center hover:bg-accent/50 p-1.5 rounded-md cursor-pointer transition-colors"
                onClick={() => toggleExpand(dept.dept_id)}
              >
                {expandedItems.has(dept.dept_id) ? <ChevronRight className="h-4 w-4 rotate-90 transition-transform" /> : <ChevronRight className="h-4 w-4 transition-transform" />}
                <FolderTree className="h-4 w-4 mr-2 text-primary" />
                <span className="text-sm font-medium truncate">{dept.dept_nm_departamento}</span>
              </div>
              {expandedItems.has(dept.dept_id) && (
                <div className="ml-4 border-l pl-2">
                  {sectors.filter(s => s.dept_id === dept.dept_id).map(sec => (
                    <div key={sec.set_id}>
                      <div 
                        className="flex items-center hover:bg-accent/50 p-1.5 rounded-md cursor-pointer transition-colors"
                        onClick={() => toggleExpand(sec.set_id)}
                      >
                        {expandedItems.has(sec.set_id) ? <ChevronRight className="h-3 w-3 rotate-90 transition-transform" /> : <ChevronRight className="h-3 w-3 transition-transform" />}
                        <span className="text-sm truncate">{sec.set_nm_setor}</span>
                      </div>
                      {expandedItems.has(sec.set_id) && (
                        <div className="ml-4 border-l pl-2">
                          {folders.filter(f => f.set_id === sec.set_id && !f.past_id_pai).map(folder => (
                            <div key={folder.past_id} className="flex items-center hover:bg-accent/50 p-1.5 rounded-md cursor-pointer" onClick={() => {
                              const item = { title: "Documentos", url: "/dashboard/documents", icon: FileText };
                              openTab({
                                id: item.url,
                                title: item.title,
                                icon: item.icon,
                              });
                              navigate(`/dashboard/documents?folder=${folder.past_id}`);
                            }}>
                              <FileText className="h-3.5 w-3.5 mr-2 text-amber-500" />
                              <span className="text-xs truncate">{folder.past_nm_pasta}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Olá, {profile?.full_name?.split(' ')[0] || 'Usuário'}</h1>
          <p className="text-muted-foreground">Aqui está um resumo do seu Nexo GED</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/dashboard/documents?action=new")} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" /> Novo Documento
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-primary/5">
          <CardContent className="p-4 flex flex-col gap-1">
            <HardDrive className="h-5 w-5 text-primary mb-1" />
            <span className="text-xs text-muted-foreground uppercase font-semibold">Espaço</span>
            <span className="text-xl font-bold">{isLoadingStats ? "..." : formatBytes(stats.usedSpace)}</span>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-blue-500/5">
          <CardContent className="p-4 flex flex-col gap-1">
            <FileText className="h-5 w-5 text-blue-500 mb-1" />
            <span className="text-xs text-muted-foreground uppercase font-semibold">Documentos</span>
            <span className="text-xl font-bold">{isLoadingStats ? "..." : stats.totalDocs}</span>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-orange-500/5">
          <CardContent className="p-4 flex flex-col gap-1">
            <AlertCircle className="h-5 w-5 text-orange-500 mb-1" />
            <span className="text-xs text-muted-foreground uppercase font-semibold">Pendentes</span>
            <span className="text-xl font-bold">{isLoadingStats ? "..." : stats.pendingDocs}</span>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-purple-500/5">
          <CardContent className="p-4 flex flex-col gap-1">
            <Users className="h-5 w-5 text-purple-500 mb-1" />
            <span className="text-xs text-muted-foreground uppercase font-semibold">Usuários</span>
            <span className="text-xl font-bold">{isLoadingStats ? "..." : stats.totalUsers}</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <Card className="lg:col-span-1 shadow-sm border-muted">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              Navegação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <ScrollArea className="h-[400px]">
              {isLoadingStructure ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : (
                renderNavTree()
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Favorites */}
            <Card className="shadow-sm border-muted">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                  Favoritos
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => navigate("/dashboard/favorites")}>
                  Ver todos <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[250px]">
                  {isLoadingFavorites ? (
                    <div className="p-4 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                  ) : favoriteDocuments.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground text-xs">Sem favoritos</div>
                  ) : (
                    <div className="divide-y">
                      {favoriteDocuments.slice(0, 5).map(doc => (
                        <div key={doc.id} className="p-3 hover:bg-accent/50 cursor-pointer flex items-center gap-3 transition-colors" onClick={() => navigate(`/dashboard/documents?id=${doc.id}`)}>
                          <div className="bg-primary/10 p-2 rounded-md"><FileText className="h-4 w-4 text-primary" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{doc.title}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{doc.document_type || 'Documento'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Recent Documents */}
            <Card className="shadow-sm border-muted">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Últimos Acessos
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => navigate("/dashboard/recent")}>
                  Ver todos <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[250px]">
                  {isLoadingRecent ? (
                    <div className="p-4 space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                  ) : recentDocuments.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground text-xs">Nenhum acesso recente</div>
                  ) : (
                    <div className="divide-y">
                      {recentDocuments.slice(0, 5).map(doc => (
                        <div key={doc.id} className="p-3 hover:bg-accent/50 cursor-pointer flex items-center gap-3 transition-colors" onClick={() => navigate(`/dashboard/documents?id=${doc.id}`)}>
                          <div className="bg-blue-500/10 p-2 rounded-md"><FileText className="h-4 w-4 text-blue-500" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{doc.title}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(doc.updated_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Pending Alerts */}
          {stats.pendingDocs > 0 && (
            <Card className="border-orange-500/20 bg-orange-500/5 shadow-none">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-orange-500 p-2 rounded-full"><AlertCircle className="h-5 w-5 text-white" /></div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-orange-700">Documentos Pendentes</h4>
                  <p className="text-xs text-orange-600/80">Você possui {stats.pendingDocs} documentos que requerem atenção ou classificação.</p>
                </div>
                <Button size="sm" variant="outline" className="border-orange-500/30 text-orange-700 hover:bg-orange-500/10" onClick={() => navigate("/dashboard/documents?status=pending")}>
                  Resolver Agora
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}