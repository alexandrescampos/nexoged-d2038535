import { useNavigate } from "react-router-dom";
import { useTabs, Tab } from "@/contexts/TabsContext";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface TabsBarProps {
  className?: string;
}

export function TabsBar({ className }: TabsBarProps) {
  const { openTabs, activeTab, closeTab } = useTabs();
  const navigate = useNavigate();

  if (openTabs.length === 0) {
    return null;
  }

  const handleTabClick = (tab: Tab) => {
    navigate(tab.path ?? tab.id);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  return (
    <div className={cn("border-b border-border bg-muted/30", className)}>
      <ScrollArea className="w-full">
        <div className="flex items-center gap-1 px-2 py-1">
          {openTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            
            return (
              <div
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "group flex items-center gap-2 px-3 py-1.5 rounded-t-md cursor-pointer transition-colors min-w-0 max-w-[180px]",
                  "hover:bg-muted",
                  isActive
                    ? "bg-background border-b-2 border-b-primary text-foreground shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                {IconComponent && (
                  <IconComponent className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="text-sm truncate">{tab.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-4 w-4 p-0 rounded-sm flex-shrink-0",
                    "opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive",
                    isActive && "opacity-60"
                  )}
                  onClick={(e) => handleCloseTab(e, tab.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
    </div>
  );
}
