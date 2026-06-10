import React, { useState } from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileText, 
  Building2, 
  Layers,
  MoreVertical,
  Plus,
  Move
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganizationStructure } from "@/hooks/useOrganizationStructure";
import { useGED } from "@/hooks/useGED";
import { Department, Sector, Folder as GedFolder, Document } from "@/types/ged";

interface TreeViewProps {
  onSelectFolder: (folderId: string, folderName: string, path: {id: string, name: string}[]) => void;
  currentFolderId: string | null;
}

type TreeItem = {
  id: string;
  name: string;
  type: 'DEPARTMENT' | 'SECTOR' | 'FOLDER' | 'DOCUMENT';
  parentId?: string | null;
  children?: TreeItem[];
};

export function GedTreeView({ onSelectFolder, currentFolderId }: TreeViewProps) {
  const { departments, sectors, folders, moveItem } = useOrganizationStructure();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [draggedItem, setDraggedItem] = useState<{ id: string, type: string } | null>(null);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const buildTree = () => {
    const tree: TreeItem[] = [];

    departments.forEach(dept => {
      const deptItem: TreeItem = {
        id: dept.dept_id,
        name: dept.dept_nm_departamento,
        type: 'DEPARTMENT',
        children: []
      };

      sectors.filter(s => s.dept_id === dept.dept_id).forEach(sector => {
        const sectorItem: TreeItem = {
          id: sector.set_id,
          name: sector.set_nm_setor,
          type: 'SECTOR',
          parentId: dept.dept_id,
          children: []
        };

        const buildFolderChildren = (parentId: string | null, sectorId: string) => {
          return folders
            .filter(f => f.set_id === sectorId && f.past_id_pai === parentId)
            .map(folder => {
              const folderItem: TreeItem = {
                id: folder.past_id,
                name: folder.past_nm_pasta,
                type: 'FOLDER',
                parentId: parentId || sectorId,
                children: buildFolderChildren(folder.past_id, sectorId)
              };
              return folderItem;
            });
        };

        sectorItem.children = buildFolderChildren(null, sector.set_id);
        deptItem.children?.push(sectorItem);
      });

      tree.push(deptItem);
    });

    return tree;
  };

  const handleDragStart = (e: React.DragEvent, id: string, type: string) => {
    e.dataTransfer.setData("id", id);
    e.dataTransfer.setData("type", type);
    setDraggedItem({ id, type });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: string, targetType: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("id");
    const type = e.dataTransfer.getData("type") as any;

    if (id === targetId) return;

    // Lógica de validação de movimento
    let isValid = false;
    if (type === 'SECTOR' && targetType === 'DEPARTMENT') isValid = true;
    if (type === 'FOLDER' && (targetType === 'SECTOR' || targetType === 'FOLDER')) isValid = true;
    if (type === 'DOCUMENT' && targetType === 'FOLDER') isValid = true;

    if (isValid) {
      moveItem({ type, id, targetId });
    }
    setDraggedItem(null);
  };

  const renderItem = (item: TreeItem, depth: number = 0, path: {id: string, name: string}[] = []) => {
    const isExpanded = expandedItems[item.id];
    const hasChildren = item.children && item.children.length > 0;
    const isSelected = currentFolderId === item.id;
    const currentPath = [...path, { id: item.id, name: item.name }];

    const getIcon = () => {
      switch (item.type) {
        case 'DEPARTMENT': return <Building2 className="h-4 w-4 text-blue-600" />;
        case 'SECTOR': return <Layers className="h-4 w-4 text-indigo-500" />;
        case 'FOLDER': return <Folder className={cn("h-4 w-4 text-amber-500", isSelected && "fill-amber-500/20")} />;
        default: return <FileText className="h-4 w-4 text-gray-500" />;
      }
    };

    return (
      <div key={item.id} className="select-none">
        <div 
          className={cn(
            "group flex items-center py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors",
            isSelected && "bg-accent text-accent-foreground",
            draggedItem?.id === item.id && "opacity-50"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (item.type === 'FOLDER') {
              onSelectFolder(item.id, item.name, currentPath.filter(p => {
                  const it = [...departments, ...sectors, ...folders].find(x => (x as any).dept_id === p.id || (x as any).set_id === p.id || (x as any).past_id === p.id);
                  return it && (it as any).past_id; // Só pastas no breadcrumb principal do GED
              }) as any);
            }
          }}
          draggable
          onDragStart={(e) => handleDragStart(e, item.id, item.type)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, item.id, item.type)}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div 
              className="p-0.5 hover:bg-accent rounded-sm"
              onClick={(e) => hasChildren && toggleExpand(item.id, e)}
            >
              {hasChildren ? (
                isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <div className="w-3.5" />
              )}
            </div>
            {getIcon()}
            <span className="text-sm truncate">{item.name}</span>
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3 w-3" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2"><Move className="h-3.5 w-3.5" /> Mover</DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-destructive">Excluir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {isExpanded && hasChildren && (
          <div className="mt-0.5">
            {item.children?.map(child => renderItem(child, depth + 1, currentPath))}
          </div>
        )}
      </div>
    );
  };

  const treeData = buildTree();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estrutura</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-0.5">
        {treeData.map(item => renderItem(item))}
      </div>
    </div>
  );
}
