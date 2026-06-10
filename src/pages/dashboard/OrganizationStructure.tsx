import { useState } from "react";
import { 
  FolderTree, 
  Building2, 
  Layers, 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Plus, 
  GripVertical,
  MoreVertical,
  FileText
} from "lucide-react";
import { useOrganizationStructure } from "@/hooks/useOrganizationStructure";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function OrganizationStructurePage() {
  const { departments, sectors, folders, isLoading, moveItem } = useOrganizationStructure();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const renderTree = () => {
    return (
      <div className="space-y-2">
        {departments
          .filter(dept => dept.dept_nm_departamento.toLowerCase().includes(searchTerm.toLowerCase()))
          .map(dept => (
            <div key={dept.dept_id} className="space-y-1">
              <div className="flex items-center group hover:bg-accent/50 p-1 rounded-md transition-colors cursor-pointer" onClick={() => toggleExpand(dept.dept_id)}>
                <div className="w-6 flex items-center justify-center">
                  {expandedItems.has(dept.dept_id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
                <Building2 className="h-4 w-4 mr-2 text-primary" />
                <span className="font-medium text-sm">{dept.dept_nm_departamento}</span>
                <Badge variant="outline" className="ml-2 text-[10px] h-4">DEP</Badge>
                <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-3 w-3" /></Button>
                </div>
              </div>

              {expandedItems.has(dept.dept_id) && (
                <div className="ml-6 border-l pl-2 space-y-1">
                  {sectors
                    .filter(sec => sec.dept_id === dept.dept_id)
                    .map(sec => (
                      <div key={sec.set_id} className="space-y-1">
                        <div className="flex items-center group hover:bg-accent/50 p-1 rounded-md transition-colors cursor-pointer" onClick={() => toggleExpand(sec.set_id)}>
                          <div className="w-6 flex items-center justify-center">
                            {expandedItems.has(sec.set_id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                          <Layers className="h-4 w-4 mr-2 text-blue-500" />
                          <span className="text-sm">{sec.set_nm_setor}</span>
                          <Badge variant="outline" className="ml-2 text-[10px] h-4">SET</Badge>
                          <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-3 w-3" /></Button>
                          </div>
                        </div>

                        {expandedItems.has(sec.set_id) && (
                          <div className="ml-6 border-l pl-2 space-y-1">
                            {folders
                              .filter(f => f.set_id === sec.set_id && !f.past_id_pai)
                              .map(f => renderFolder(f))}
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
  };

  const renderFolder = (folder: any) => {
    const subfolders = folders.filter(f => f.past_id_pai === folder.past_id);
    const hasChildren = subfolders.length > 0;

    return (
      <div key={folder.past_id} className="space-y-1">
        <div 
          className="flex items-center group hover:bg-accent/50 p-1 rounded-md transition-colors cursor-pointer" 
          onClick={() => toggleExpand(folder.past_id)}
        >
          <div className="w-6 flex items-center justify-center">
            {hasChildren ? (expandedItems.has(folder.past_id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
          </div>
          <Folder className={`h-4 w-4 mr-2 ${folder.past_in_restrita ? 'text-red-400' : 'text-amber-500'}`} />
          <span className="text-sm">{folder.past_nm_pasta}</span>
          <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-3 w-3" /></Button>
          </div>
        </div>
        {expandedItems.has(folder.past_id) && hasChildren && (
          <div className="ml-6 border-l pl-2 space-y-1">
            {subfolders.map(sub => renderFolder(sub))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estrutura Organizacional</h1>
          <p className="text-muted-foreground">Visualize e gerencie a hierarquia de armazenamento do GED</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" /> Novo Setor
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Nova Pasta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hierarquia */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Árvore Hierárquica
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Filtrar estrutura..." 
                className="pl-8 h-8 text-xs" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-muted-foreground">Carregando estrutura...</p>
                </div>
              ) : (
                renderTree()
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detalhes / Conteúdo Selecionado */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Detalhes da Seleção</CardTitle>
          </CardHeader>
          <CardContent className="h-[600px] flex flex-col items-center justify-center text-center text-muted-foreground">
            <div className="max-w-xs space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Search className="h-8 w-8" />
              </div>
              <p>Selecione um item na árvore para visualizar detalhes, permissões e documentos contidos.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}