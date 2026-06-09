import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { 
  MessageSquare, 
  Search, 
  BarChart3, 
  Users, 
  Building2, 
  Calendar,
  Filter,
  ArrowRight,
  Check,
  ChevronsUpDown,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"];

export default function ChatbotAnalytics() {
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 90), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [orgFilter, setOrgFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [openOrg, setOpenOrg] = useState(false);
  const [openUser, setOpenUser] = useState(false);

  // Fetch unique organizations and users from logs for the comboboxes
  const { data: filterOptions } = useQuery({
    queryKey: ["chatbot-filter-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_chat_logs")
        .select(`
          user_id,
          organization_id,
          user_name,
          organization:organizations(name)
        `);
      
      if (error) throw error;

      const orgMap = new Map<string, { id: string; name: string }>();
      const userMap = new Map<string, { id: string; name: string }>();
      for (const l of (data as any[]) || []) {
        if (l.organization_id && !orgMap.has(l.organization_id)) {
          orgMap.set(l.organization_id, {
            id: l.organization_id,
            name: l.organization?.name || "Global",
          });
        }
        if (l.user_id && !userMap.has(l.user_id)) {
          userMap.set(l.user_id, { id: l.user_id, name: l.user_name || "—" });
        }
      }

      const orgs = Array.from(orgMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      const users = Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      return { orgs, users };
    }
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ["chatbot-analytics", dateFrom, dateTo, orgFilter, userFilter],
    queryFn: async () => {
      let query = supabase
        .from("support_chat_logs")
        .select(`
          *,
          organization:organizations(name)
        `)
        .gte("inserted_at", startOfDay(new Date(dateFrom + "T00:00:00")).toISOString())
        .lte("inserted_at", endOfDay(new Date(dateTo + "T23:59:59")).toISOString())
        .order("inserted_at", { ascending: false });

      if (orgFilter) {
        query = query.eq("organization_id", orgFilter);
      }
      if (userFilter) {
        query = query.eq("user_id", userFilter);
      }

      const { data, error } = await query;
      if (error) {
        toast.error("Erro ao carregar dados do chatbot: " + error.message);
        throw error;
      }
      return data;
    },
  });

  // Calculate statistics
  const stats = {
    totalInteractions: logs?.length || 0,
    uniqueUsers: new Set(logs?.map(l => l.user_id)).size,
    uniqueOrgs: new Set(logs?.map(l => l.organization_id)).size,
    avgTokens: logs?.length ? Math.round(logs.reduce((acc, l) => acc + (l.total_tokens || 0), 0) / logs.length) : 0,
  };

  // Prepare chart data
  const categoryData = logs?.reduce((acc: any[], log) => {
    const category = log.category || "Outros";
    const existing = acc.find(item => item.name === category);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: category, value: 1 });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value);

  const dailyData = logs?.reduce((acc: any[], log) => {
    const day = format(new Date(log.inserted_at), "dd/MM");
    const existing = acc.find(item => item.name === day);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: day, value: 1 });
    }
    return acc;
  }, []).reverse();

  const orgUsageData = logs?.reduce((acc: any[], log) => {
    const orgName = log.organization?.name || "Global";
    const existing = acc.find(item => item.name === orgName);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: orgName, value: 1 });
    }
    return acc;
  }, []).sort((a, b) => b.value - a.value).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-primary" />
            Análise do Nexo Assistente
          </h1>
          <p className="text-muted-foreground">Estatísticas de uso e desempenho do chatbot</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>De</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Até</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2 flex flex-col">
              <Label>Organização</Label>
              <Popover open={openOrg} onOpenChange={setOpenOrg}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openOrg}
                    className="w-full justify-between font-normal"
                  >
                    {orgFilter
                      ? filterOptions?.orgs.find((org) => org.id === orgFilter)?.name
                      : "Selecionar organização..."}
                    <div className="flex items-center">
                      {orgFilter && (
                        <X 
                          className="mr-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrgFilter("");
                          }}
                        />
                      )}
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar organização..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma organização encontrada.</CommandEmpty>
                      <CommandGroup>
                        {filterOptions?.orgs.map((org) => (
                          <CommandItem
                            key={org.id}
                            value={`${org.name}__${org.id}`}
                            onSelect={(currentValue) => {
                              const selectedId = currentValue.split("__").pop() || "";
                              setOrgFilter(selectedId === orgFilter ? "" : selectedId);
                              setOpenOrg(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                orgFilter === org.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {org.name}
                          </CommandItem>
                        ))}

                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2 flex flex-col">
              <Label>Usuário</Label>
              <Popover open={openUser} onOpenChange={setOpenUser}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openUser}
                    className="w-full justify-between font-normal"
                  >
                    {userFilter
                      ? filterOptions?.users.find((user) => user.id === userFilter)?.name
                      : "Selecionar usuário..."}
                    <div className="flex items-center">
                      {userFilter && (
                        <X 
                          className="mr-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setUserFilter("");
                          }}
                        />
                      )}
                      <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar usuário..." />
                    <CommandList>
                      <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                      <CommandGroup>
                        {filterOptions?.users.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={`${user.name}__${user.id}`}
                            onSelect={(currentValue) => {
                              const selectedId = currentValue.split("__").pop() || "";
                              setUserFilter(selectedId === userFilter ? "" : selectedId);
                              setOpenUser(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                userFilter === user.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {user.name}
                          </CommandItem>
                        ))}

                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Interações</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInteractions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usuários Únicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Organizações</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueOrgs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Média de Tokens</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgTokens}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Intenções por Tema */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Intenções por Tema</CardTitle>
            <CardDescription>Distribuição das perguntas por categoria</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Uso Diário */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uso Diário</CardTitle>
            <CardDescription>Volume de interações ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Organizations Table */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Organizações</CardTitle>
            <CardDescription>Organizações que mais utilizam</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orgUsageData?.map((org, index) => (
                <div key={org.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                      {index + 1}
                    </div>
                    <span className="text-sm font-medium truncate max-w-[150px]">{org.name}</span>
                  </div>
                  <Badge variant="secondary">{org.value} interações</Badge>
                </div>
              ))}
              {!orgUsageData?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Interactions Table */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Interações Recentes</CardTitle>
            <CardDescription>Últimas perguntas realizadas ao assistente</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário / Org</TableHead>
                  <TableHead>Pergunta</TableHead>
                  <TableHead>Tema</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : logs?.slice(0, 5).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{log.user_name}</span>
                        <span className="text-xs text-muted-foreground">{log.organization?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={log.user_question}>
                      {log.user_question}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.category || "Outros"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(log.inserted_at), "dd/MM HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
                {!logs?.length && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      Nenhuma interação encontrada no período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
