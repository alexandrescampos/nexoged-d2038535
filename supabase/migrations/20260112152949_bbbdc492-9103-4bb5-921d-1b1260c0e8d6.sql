-- Add columns to organizations table for terms acceptance tracking
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_accepted_version TEXT;

-- Insert default terms of service, privacy policy, and version into system_settings
INSERT INTO public.system_settings (key, value) VALUES
('terms_of_service', '# Termos de Uso

## 1. Aceitação dos Termos

Ao acessar e utilizar o Nexo WorkTime, você concorda em cumprir e estar vinculado aos seguintes termos e condições de uso. Se você não concordar com qualquer parte destes termos, não deverá utilizar nosso sistema.

## 2. Descrição do Serviço

O Nexo WorkTime é uma plataforma de gestão de horas trabalhadas que permite:
- Registro e acompanhamento de horas de trabalho
- Gestão de projetos e atividades
- Geração de relatórios e aprovações
- Gestão de equipes e organizações

## 3. Responsabilidades do Usuário

O usuário se compromete a:
- Fornecer informações verdadeiras e atualizadas
- Manter a confidencialidade de suas credenciais de acesso
- Utilizar o sistema de forma ética e legal
- Não tentar acessar áreas restritas do sistema
- Reportar qualquer vulnerabilidade de segurança identificada

## 4. Propriedade Intelectual

Todo o conteúdo do sistema, incluindo software, design, textos e logotipos, é de propriedade exclusiva do Nexo WorkTime e protegido por leis de propriedade intelectual.

## 5. Limitação de Responsabilidade

O Nexo WorkTime não se responsabiliza por:
- Interrupções temporárias do serviço
- Perda de dados devido a falhas técnicas
- Uso indevido do sistema por terceiros
- Danos indiretos resultantes do uso do sistema

## 6. Modificações dos Termos

Reservamo-nos o direito de modificar estes termos a qualquer momento. As alterações entrarão em vigor após a publicação no sistema. O uso continuado do serviço após as modificações constitui aceitação dos novos termos.

## 7. Cancelamento

O usuário pode solicitar o cancelamento de sua conta a qualquer momento. Após o cancelamento, os dados serão tratados conforme nossa Política de Privacidade.

## 8. Legislação Aplicável

Estes termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa será resolvida no foro da comarca da sede da empresa.

## 9. Contato

Para dúvidas sobre estes termos, entre em contato através dos canais oficiais de suporte.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value) VALUES
('privacy_policy', '# Política de Privacidade e Proteção de Dados (LGPD)

Esta Política de Privacidade descreve como o Nexo WorkTime coleta, usa, armazena e protege suas informações pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).

## 1. Dados Coletados

Coletamos os seguintes tipos de dados pessoais:

### 1.1 Dados de Identificação
- Nome completo
- Endereço de e-mail
- Telefone (opcional)

### 1.2 Dados da Organização
- Nome da empresa
- CNPJ
- Endereço comercial

### 1.3 Dados de Uso
- Registros de horas trabalhadas
- Projetos e atividades
- Histórico de acessos

## 2. Finalidade do Tratamento

Seus dados são utilizados para:
- Prestação do serviço de gestão de horas
- Comunicação sobre o serviço
- Melhoria contínua da plataforma
- Cumprimento de obrigações legais
- Segurança e prevenção de fraudes

## 3. Base Legal

O tratamento de dados é realizado com base em:
- Execução de contrato (Art. 7º, V, LGPD)
- Consentimento do titular (Art. 7º, I, LGPD)
- Cumprimento de obrigação legal (Art. 7º, II, LGPD)
- Legítimo interesse (Art. 7º, IX, LGPD)

## 4. Compartilhamento de Dados

Seus dados podem ser compartilhados com:
- Provedores de serviços de infraestrutura
- Processadores de pagamento
- Autoridades quando exigido por lei

Não vendemos ou alugamos seus dados pessoais a terceiros.

## 5. Armazenamento e Segurança

- Dados armazenados em servidores seguros
- Criptografia em trânsito e em repouso
- Controle de acesso baseado em funções
- Monitoramento contínuo de segurança
- Backups regulares

## 6. Direitos do Titular

Você tem direito a:
- **Acesso**: Solicitar cópia dos seus dados
- **Correção**: Atualizar dados incompletos ou incorretos
- **Exclusão**: Solicitar a remoção dos seus dados
- **Portabilidade**: Receber seus dados em formato estruturado
- **Revogação**: Retirar o consentimento a qualquer momento
- **Oposição**: Opor-se ao tratamento em determinadas situações

## 7. Retenção de Dados

Os dados são mantidos pelo período necessário para:
- Prestação do serviço contratado
- Cumprimento de obrigações legais
- Exercício regular de direitos

Após o término da relação, os dados serão eliminados ou anonimizados, salvo obrigação legal de retenção.

## 8. Cookies e Tecnologias Similares

Utilizamos cookies para:
- Manter sua sessão ativa
- Lembrar suas preferências
- Melhorar a experiência de uso

## 9. Alterações nesta Política

Esta política pode ser atualizada periodicamente. Notificaremos sobre alterações significativas através do sistema ou por e-mail.

## 10. Encarregado de Dados (DPO)

Para exercer seus direitos ou esclarecer dúvidas sobre o tratamento de dados, entre em contato com nosso Encarregado de Proteção de Dados através dos canais oficiais de suporte.

## 11. Autoridade Nacional

Você pode registrar reclamações junto à Autoridade Nacional de Proteção de Dados (ANPD) caso considere que seus direitos não foram atendidos.

---

*Última atualização: Janeiro de 2026*')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.system_settings (key, value) VALUES
('terms_version', '1.0')
ON CONFLICT (key) DO NOTHING;