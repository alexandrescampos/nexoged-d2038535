import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useOrganizationStructure } from "@/hooks/useOrganizationStructure";
import { useAuth } from "@/hooks/useAuth";

export type QuickCreateMode =
  | { type: "DEPARTMENT" }
  | { type: "SECTOR"; dept_id: string }
  | { type: "FOLDER"; set_id: string; past_id_pai: string | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: QuickCreateMode | null;
}

const titles: Record<string, string> = {
  DEPARTMENT: "Novo Departamento",
  SECTOR: "Novo Setor",
  FOLDER: "Nova Pasta",
};

export function GedQuickCreateDialog({ open, onOpenChange, mode }: Props) {
  const { organization } = useAuth();
  const { createDepartment, createSector, createFolder } = useOrganizationStructure();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
    }
  }, [open]);

  if (!mode) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !organization?.id) return;
    setSaving(true);
    try {
      if (mode.type === "DEPARTMENT") {
        createDepartment({
          organization_id: organization.id,
          dept_nm_departamento: name.trim(),
          dept_ds_departamento: description.trim() || null,
          dept_in_ativo: true,
        } as any);
      } else if (mode.type === "SECTOR") {
        createSector({
          organization_id: organization.id,
          dept_id: mode.dept_id,
          set_nm_setor: name.trim(),
          set_ds_setor: description.trim() || null,
          set_in_ativo: true,
        } as any);
      } else if (mode.type === "FOLDER") {
        createFolder({
          organization_id: organization.id,
          set_id: mode.set_id,
          past_id_pai: mode.past_id_pai,
          past_nm_pasta: name.trim(),
          past_ds_pasta: description.trim() || null,
          past_in_ativa: true,
          past_in_restrita: false,
          past_in_permite_subpastas: true,
        } as any);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titles[mode.type]}</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para criar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || saving}>
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
