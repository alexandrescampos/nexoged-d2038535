import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomField } from "@/types/ged";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CustomFieldsFormProps {
  fields: CustomField[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
}

export function CustomFieldsForm({ fields, values, onChange }: CustomFieldsFormProps) {
  if (!fields || fields.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
      {fields.map((field) => (
        <div key={field.id} className="grid gap-1.5">
          <Label htmlFor={`field-${field.id}`} className="text-xs flex items-center gap-1">
            {field.name}
            {field.is_required && <span className="text-destructive">*</span>}
          </Label>
          <FieldInput 
            field={field} 
            value={values[field.id]} 
            onChange={(val) => onChange(field.id, val)} 
          />
        </div>
      ))}
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: CustomField, value: any, onChange: (val: any) => void }) {
  const { data: listItems = [] } = useQuery({
    queryKey: ["list-items", field.list_id],
    queryFn: async () => {
      if (!field.list_id) return [];
      const { data, error } = await supabase
        .from("list_items")
        .select("*")
        .eq("list_id", field.list_id)
        .order("value", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: field.field_type === 'list' && !!field.list_id,
  });

  switch (field.field_type) {
    case 'boolean':
      return (
        <div className="flex items-center h-8">
          <Switch 
            id={`field-${field.id}`}
            checked={!!value}
            onCheckedChange={onChange}
          />
        </div>
      );
    case 'integer':
      return (
        <Input 
          id={`field-${field.id}`}
          type="number"
          step="1"
          placeholder="Número inteiro"
          className="h-8 text-xs"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
        />
      );
    case 'decimal':
      return (
        <Input 
          id={`field-${field.id}`}
          type="number"
          step="0.01"
          placeholder="0,00"
          className="h-8 text-xs"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
        />
      );
    case 'date':
      return (
        <Input 
          id={`field-${field.id}`}
          type="date"
          className="h-8 text-xs"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
        />
      );
    case 'long_text':
      return (
        <Textarea 
          id={`field-${field.id}`}
          placeholder="Texto longo..."
          className="min-h-[60px] text-xs py-1"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
        />
      );
    case 'list':
      return (
        <Select 
          value={value || ""} 
          onValueChange={onChange}
          required={field.is_required}
        >
          <SelectTrigger id={`field-${field.id}`} className="h-8 text-xs">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {listItems.map((item: any) => (
              <SelectItem key={item.id} value={item.item_value}>{item.item_value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'text':
    default:
      return (
        <Input 
          id={`field-${field.id}`}
          placeholder="Texto"
          className="h-8 text-xs"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          maxLength={255}
        />
      );
  }
}
