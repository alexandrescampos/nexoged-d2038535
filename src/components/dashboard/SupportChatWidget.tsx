import { useState, useRef, useEffect } from "react";
import {
  MessageCircleQuestion,
  X,
  Trash2,
  Send,
  Loader2,
  Building2,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Shield,
  LayoutDashboard,
  CreditCard,
  Star,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSupportChat } from "@/hooks/useSupportChat";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface FaqCategory {
  icon: React.ElementType;
  title: string;
  questions: string[];
}

const SUPER_ADMIN_FAQ: FaqCategory[] = [
  {
    icon: LayoutDashboard,
    title: "Visão Geral",
    questions: [
      "Onde vejo o total de organizações e usuários do sistema?",
      "Como acompanhar o uso consolidado (páginas e GB)?",
      "Como analisar o uso do chatbot?",
    ],
  },
  {
    icon: Building2,
    title: "Organizações & Planos",
    questions: [
      "Como criar uma nova organização?",
      "Como alterar os limites contratados (páginas e GB) de uma organização?",
      "Como criar ou editar um plano comercial?",
      "Como configurar o Stripe?",
    ],
  },
  {
    icon: Shield,
    title: "Usuários & Segurança",
    questions: [
      "Como gerenciar usuários de qualquer organização?",
      "Como redefinir a senha de um usuário?",
      "Onde consulto a auditoria global do sistema?",
    ],
  },
  {
    icon: FileText,
    title: "Conteúdo & Legal",
    questions: [
      "Como editar os Termos de Uso?",
      "Como editar a Política de Privacidade (LGPD)?",
      "Onde altero as configurações globais do sistema?",
    ],
  },
];

const ORG_ADMIN_FAQ: FaqCategory[] = [
  {
    icon: Building2,
    title: "Cadastros",
    questions: [
      "Como cadastrar um CNPJ/filial?",
      "Como gerenciar usuários da organização?",
      "Como criar um Tipo de Documento?",
      "Como criar uma Lista de Cadastro?",
      "Como configurar Campos Adicionais?",
    ],
  },
  {
    icon: FileText,
    title: "Documentos",
    questions: [
      "Como fazer upload de um documento?",
      "Como fazer upload em lote?",
      "Como funciona o versionamento de documentos?",
      "Como acompanhar a vigência e vencimentos?",
      "Como restaurar um documento da lixeira?",
    ],
  },
  {
    icon: Shield,
    title: "Controle de Acesso",
    questions: [
      "Como criar Perfis de Permissão?",
      "Como definir o escopo de um usuário?",
      "Como usar o Simulador de Acesso?",
      "O que mostra o Dashboard de Segurança?",
    ],
  },
  {
    icon: Settings,
    title: "Configurações",
    questions: [
      "Como alterar o nome, CNPJ ou logo da organização?",
      "Como conectar o Google Drive?",
    ],
  },

  {
    icon: UserCircle,
    title: "Conta & Suporte",
    questions: [
      "Como alterar minha senha?",
      "Onde vejo a versão do sistema?",
      "Onde encontro o telefone de suporte?",
    ],
  },
];

const USER_FAQ: FaqCategory[] = [
  {
    icon: FileText,
    title: "Documentos",
    questions: [
      "Como pesquisar um documento?",
      "Como abrir e baixar um documento?",
      "Como faço upload de um documento (se autorizado)?",
    ],
  },
  {
    icon: Star,
    title: "Vencimentos & Favoritos",
    questions: [
      "Como acompanhar vencimentos dos meus documentos?",
      "Como marcar um documento como favorito?",
      "Onde vejo meus últimos acessos?",
    ],
  },
  {
    icon: UserCircle,
    title: "Minha Conta",
    questions: [
      "Como alterar minha senha?",
      "Como atualizar meus dados pessoais?",
    ],
  },
  {
    icon: Shield,
    title: "Acesso",
    questions: [
      "Não consigo ver um menu ou pasta, o que fazer?",
      "Como solicitar mais permissões?",
    ],
  },
];

export function SupportChatWidget() {
  const { messages, isLoading, isOpen, sendMessage, clearMessages, toggleOpen } = useSupportChat();
  const { isSuperAdmin, isOrgAdmin } = useAuth();
  const faqCategories = isSuperAdmin
    ? SUPER_ADMIN_FAQ
    : isOrgAdmin
      ? ORG_ADMIN_FAQ
      : USER_FAQ;
  const [input, setInput] = useState("");
  const [showFaq, setShowFaq] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    setShowFaq(false);
    sendMessage(text);
  };

  const handleFaqClick = (question: string) => {
    setShowFaq(false);
    sendMessage(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    clearMessages();
    setShowFaq(true);
    setExpandedFaq(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        title="Suporte"
      >
        <MessageCircleQuestion className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[380px] h-[500px] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          <span className="font-semibold text-sm">Nexa Assistente Virtual</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={handleClear}
            title="Limpar conversa"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={toggleOpen}
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as any}>
        {/* FAQ section */}
        {showFaq && messages.length === 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowFaq((v) => !v)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2 hover:text-foreground transition-colors"
            >
              <ChevronDown className="h-3 w-3" />
              Perguntas Frequentes
            </button>
            <div className="space-y-1">
              {faqCategories.map((cat) => {

                const Icon = cat.icon;
                const isExpanded = expandedFaq === cat.title;
                return (
                  <div key={cat.title}>
                    <button
                      onClick={() => setExpandedFaq(isExpanded ? null : cat.title)}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-left">{cat.title}</span>
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="ml-6 space-y-0.5 mt-1 mb-2">
                        {cat.questions.map((q) => (
                          <button
                            key={q}
                            onClick={() => handleFaqClick(q)}
                            className="block w-full text-left text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Welcome message */}
        {messages.length === 0 && !showFaq && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Como posso ajudar?
          </div>
        )}

        {/* Messages */}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border px-3 py-3 flex items-center gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua dúvida..."
          className="flex-1 text-sm"
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="h-9 w-9 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
