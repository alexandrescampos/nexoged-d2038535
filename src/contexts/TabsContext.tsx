import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LucideIcon } from "lucide-react";

export interface Tab {
  id: string;
  title: string;
  icon: LucideIcon;
  path?: string;
}

interface TabsContextType {
  openTabs: Tab[];
  activeTab: string | null;
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabPath: (id: string, path: string) => void;
  isClosing: () => boolean;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

const STORAGE_KEY = "dashboard_open_tabs";
const MAX_TABS = 10;

interface TabsProviderProps {
  children: ReactNode;
  storageKey?: string;
}

export function TabsProvider({ children, storageKey = STORAGE_KEY }: TabsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isClosingRef = useRef(false);
  
  const [openTabs, setOpenTabs] = useState<Tab[]>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((t: { id: string; title: string; path?: string }) => ({
          id: t.id,
          title: t.title,
          path: t.path,
          icon: null,
        }));
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  });

  const [activeTab, setActiveTabState] = useState<string | null>(location.pathname);

  // Sync activeTab with current route
  useEffect(() => {
    setActiveTabState(location.pathname);
  }, [location.pathname]);

  // Persist tabs to sessionStorage (without icons)
  useEffect(() => {
    const toStore = openTabs.map((t) => ({ id: t.id, title: t.title, path: t.path }));
    sessionStorage.setItem(storageKey, JSON.stringify(toStore));
  }, [openTabs, storageKey]);

  const isClosing = useCallback(() => isClosingRef.current, []);

  const openTab = useCallback((tab: Tab) => {
    // Don't reopen tab if we're in the process of closing
    if (isClosingRef.current) return;
    
    setOpenTabs((prev) => {
      const existingIndex = prev.findIndex((t) => t.id === tab.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = tab;
        return updated;
      }
      
      if (prev.length >= MAX_TABS) {
        return [...prev.slice(1), tab];
      }
      
      return [...prev, tab];
    });
  }, []);

  const closeTab = useCallback((id: string) => {
    isClosingRef.current = true;
    
    setOpenTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== id);
      const currentActiveTab = location.pathname;
      
      // If closing the active tab, navigate to another one
      if (currentActiveTab === id) {
        if (newTabs.length > 0) {
          const closedIndex = prev.findIndex((t) => t.id === id);
          const nextTab = newTabs[Math.min(closedIndex, newTabs.length - 1)];
          navigate(nextTab.id);
        } else {
          const basePath = id.startsWith("/super-admin") ? "/super-admin" : "/dashboard";
          navigate(basePath);
        }
      }
      
      // Reset flag after a small delay to allow navigation to complete
      setTimeout(() => {
        isClosingRef.current = false;
      }, 100);
      
      return newTabs;
    });
  }, [location.pathname, navigate]);

  const setActiveTab = useCallback((id: string) => {
    setActiveTabState(id);
  }, []);

  const updateTabPath = useCallback((id: string, path: string) => {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return prev;
      if (prev[idx].path === path) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], path };
      return updated;
    });
  }, []);

  return (
    <TabsContext.Provider value={{ openTabs, activeTab, openTab, closeTab, setActiveTab, updateTabPath, isClosing }}>
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("useTabs must be used within a TabsProvider");
  }
  return context;
}
