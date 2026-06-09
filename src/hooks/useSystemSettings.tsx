import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSystemSettings() {
  return useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*");
      
      if (error) throw error;
      
      const settings: Record<string, string> = {};
      data?.forEach((item) => {
        if (item.value) settings[item.key] = item.value;
      });
      return settings;
    },
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });
}
