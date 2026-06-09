import { useState, useMemo } from "react";
import { useDepartments } from "@/hooks/useDepartments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  FolderTree, 
  MoreVertical, 
  Pencil, 
  Trash2,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function DepartmentsPage() {
  const { departments, isLoading } = useDepartments();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredDepartments = useMemo(() => {
    return departments.filter(d => 
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [departments, searchTerm]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Departamentos</h1>
          <p className="text-muted-foreground">Gerencie a estrutura organizacional da sua empresa</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Departamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[400px]">Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : filteredDepartments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhum departamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDepartments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-primary" />
                        {dept.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{dept.code || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={dept.is_active ? "default" : "secondary"}>
                        {dept.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
