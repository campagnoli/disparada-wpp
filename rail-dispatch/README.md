# Rail Dispatch (disparada-wpp)

Aplicação Next.js 16 (App Router + Turbopack) para despacho e automação de mensagens operacionais ferroviárias do Centro de Controle Operacional (CCO) via WhatsApp, utilizando a API Google Gemini para padronização e o Supabase como backend relacional com Row Level Security (RLS).

---

## 🏗️ Estrutura do Projeto

```
rail-dispatch/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts         # Login operacional e criação da sessão
│   │   │   │   └── logout/route.ts        # Encerramento da sessão operacional
│   │   │   ├── admin/
│   │   │   │   ├── falhas/route.ts      # CRUD e importação de falhas predefinidas
│   │   │   │   ├── prompt/route.ts      # Gestão dinâmica do prompt do Gemini
│   │   │   │   ├── session/route.ts     # Login/logout e verificação de sessão admin
│   │   │   │   ├── templates/route.ts   # Gestão dinâmica dos modelos de mensagens
│   │   │   │   └── whatsapp/route.ts    # Configuração dinâmica da Evolution API
│   │   │   ├── aprendizado-despachos/route.ts # Persistência do feedback do SCO
│   │   │   ├── disparar-wpp/route.ts    # Despacho de mensagens via Evolution API v2
│   │   │   ├── estacoes/route.ts        # Consulta de estações por linha
│   │   │   ├── gerar-mensagens/route.ts # Geração de 3 mensagens via Gemini API
│   │   │   └── ocorrencias/route.ts     # Registro, histórico e encerramento de ocorrências
│   │   ├── admin-falhas.tsx             # Componente de gerenciamento de falhas
│   │   ├── admin-prompt.tsx             # Edição das instruções de sistema do Gemini
│   │   ├── admin-templates.tsx          # Edição visual dos templates de mensagens
│   │   ├── admin-whatsapp.tsx           # Painel de instâncias, grupos e anti-bloqueio WPP
│   │   ├── globals.css                  # Design System (paleta institucional: Safira, Coral, Jade)
│   │   ├── layout.tsx                   # Layout raiz com fontes e metadados
│   │   ├── login/page.tsx               # Acesso operacional por senha única
│   │   └── page.tsx                     # Formulário principal, visualização, disparo e histórico
│   ├── proxy.ts                         # Proteção global por sessão operacional (Next.js 16)
│   ├── config/
│   │   ├── prompt-gemini.json           # Template base do prompt de sistema do Gemini
│   │   └── templates-mensagem.json      # Modelos padrão e de encerramento dos 3 canais CCO
│   └── lib/
│       ├── admin.ts                     # Criptografia, HMAC e validação de sessão admin
│       ├── classificacao-ocorrencia.ts  # Tipos e formatadores de IN, COPESE e Desembarque
│       ├── gemini-models.ts             # Modelos Gemini homologados e cotas
│       ├── gemini-prompt.ts             # Gerenciamento de prompt ativo e fallback local
│       ├── mensagem-templates-pure.ts   # Formatadores puros, cálculo de duração e encerramento
│       ├── mensagem-templates.ts        # Gerenciamento de templates ativos e fallback
│       ├── mensagens.ts                 # Utilitários de texto e assinatura do responsável
│       ├── supabase.ts                  # Cliente Supabase singleton/lazy seguro
│       ├── supabase-admin.ts            # Cliente Supabase administrativo com service_role
│       └── whatsapp-config.ts           # Configurações de WhatsApp (Web/DB + .env.local)
├── supabase/
│   └── migrations/                      # Migrações SQL versionadas
├── .env.example                         # Exemplo documentado de variáveis de ambiente
├── next.config.ts                       # Configuração Turbopack e Next.js
└── package.json                         # Dependências e scripts
```

As versões originais geradas pelo Gemini e as mensagens finais aprovadas pelo SCO são
registradas na tabela `aprendizado_despachos` no disparo. As mensagens editadas são usadas
como exemplos de estilo em gerações posteriores. A tabela é acessada somente pelo servidor
com `SUPABASE_SERVICE_ROLE_KEY`.

Os grupos são denominados **Operação CCO / Executivo** e **Gerência / Órgão Regulador**.
Ambos usam o padrão de mensagem: *LINHA*, *OCORRÊNCIA*, *COPESE*, *IN*, *LOCAL*, *DATA*,
*HORÁRIO INÍCIO*, *HORÁRIO FIM*, *DESEMBARQUE*, *DESCRITIVO*, *ESTRATÉGIA DE CIRCULAÇÃO*,
*IMPACTO OPERACIONAL* e *#SCO*. *HORÁRIO FIM* só aparece quando a ocorrência foi encerrada
com um horário informado; *DESEMBARQUE* só aparece quando o resultado é positivo. A estratégia
de circulação é exibida acima do impacto operacional somente quando há loops. O grupo
Operação CCO / Executivo usa tom técnico e executivo; o grupo Gerência / Órgão Regulador usa redação institucional,
serena e não alarmista, sem omitir ou distorcer a natureza, gravidade, impactos ou riscos
confirmados. “Fissura no trilho” só deve ser usado quando uma fissura tiver sido confirmada.
A geração também informa `tipoIN`, `copese`, `desembarque` e `descritivo`; a aba Administração
lista as variáveis disponíveis. A aba Comunicação mantém seu modelo narrativo próprio.
Templates operacionais legados identificados pelo formato antigo de Ocorrência/Falha/Impacto/Ações
são substituídos pelo padrão de campos acima ao serem carregados, inclusive quando configurados
anteriormente no banco de dados.
Os campos “Entregue com restrição?” e “Deseja relatar a atuação?” do encerramento são persistidos
na ocorrência e incluídos nas mensagens finais quando marcados. A migração
`supabase/migrations/202610160002_occurrence_closure_details.sql` deve ser aplicada no Supabase.

---

## 🛠️ Comandos Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor local de desenvolvimento em `http://localhost:3000` |
| `npm run typecheck` | Executa o compilador TypeScript (`tsc --noEmit`) para validação estática |
| `npm run lint` | Executa o ESLint para validação de padrões e regras |
| `npm run build` | Compila o projeto em modo de produção otimizado com Turbopack |
| `npm run start` | Inicia a aplicação compilada em modo de produção |

---

## 🔐 Configuração

Copie o arquivo `.env.example` para `.env.local` e preencha as credenciais:

```bash
cp .env.example .env.local
```

Consulte o [README raiz](../README.md) para a lista e descrição completa das variáveis e a ordem das migrações do Supabase.

Defina `APP_ACCESS_PASSWORD` no `.env.local` para desenvolvimento e nas Environment Variables
da Vercel para produção. Essa senha protege a aplicação inteira; após o login, a sessão expira
em 12 horas. Não exponha essa variável usando o prefixo `NEXT_PUBLIC_`.

---

## 🚨 Catálogo de Erros, Causas e Resoluções (SIDO)

A plataforma conta com um sistema universal de tratamento humanizado de erros. Abaixo estão documentados todos os erros mapeados, suas origens técnicas e a ação operacional indicada para resolução:

### 1. Inteligência Artificial (Google Gemini API)

| Código / Sintoma | Causa Técnica | Mensagem no Modal | Ação Recomendada para o Operador / CCO |
| :--- | :--- | :--- | :--- |
| **503 Service Unavailable / Overloaded** | Sobrecarga temporária ou pico de tráfego nos servidores globais do Google Gemini. | *Serviço de IA Temporariamente Ocupado* | O sistema tenta contingência automática. Aguarde de 10 a 20 segundos e clique em gerar novamente. Se persistir, alterne o seletor para o modelo `Gemini 3.5 Flash Lite`. |
| **429 Too Many Requests / Resource Exhausted** | Atingimento do limite de requisições por minuto (RPM) ou de cota de tokens por minuto (TPM) da API. | *Limite de Requisições da IA Atingido* | Aguarde de 30 a 60 segundos para renovação da janela de cota do Gemini antes de disparar uma nova geração. |
| **401 Unauthorized / 403 Forbidden / API Key** | Chave `GEMINI_API_KEY` ausente no `.env.local`, incorreta, expirada ou com restrições no Google Cloud / AI Studio. | *Chave de Acesso da IA Não Autorizada* | Solicite ao suporte de TI a validação da variável de ambiente `GEMINI_API_KEY`. |
| **Falha de Rede / Network Timeout** | Perda de conexão da máquina do operador com a internet ou bloqueio de firewall corporativo. | *Instabilidade de Conexão com o Servidor* | Verifique a conexão com a rede da CPTM/Trivia e confirme se o serviço local ou de hospedagem está ativo. |
| **400 Bad Request / JSON Inválido** | Estrutura de dados da ocorrência com campos incompatíveis ou tipos não conformes. | *Dados Incompletos ou Inválidos* | Revise as etapas do formulário (linhas, vias, estações, horários e informante). |

### 2. Banco de Dados e Ocorrências (Supabase)

| Código / Sintoma | Causa Técnica | Mensagem no Modal | Ação Recomendada para o Operador / CCO |
| :--- | :--- | :--- | :--- |
| **404 Not Found / Ocorrência Inexistente** | Busca no Histórico com código de evento não cadastrado ou com digitação incorreta. | *Ocorrência Não Localizada* | Verifique se o código do evento segue o formato oficial `DDMMAAAALLNNN` (ex: `1410202611001`) ou clique diretamente no item da tabela. |
| **Erro de Gravação / Falha ao Registrar** | Conexão com Supabase instável, violação de constraint ou ausência das 3 mensagens obrigatórias. | *Não Foi Possível Salvar a Ocorrência* | Certifique-se de que as 3 mensagens foram geradas pela IA e revise a conexão com o banco Supabase. |
| **Horário de Fim Ausente ou Inválido** | Tentativa de encerrar uma ocorrência sem preencher o horário ou em formato diferente de `HH:MM`. | *Horário de Encerramento Inválido* | Digite um horário válido no formato de 24 horas (ex: `14:35`) antes de confirmar o encerramento. |
| **Falha na Atualização (PATCH)** | Ocorrência já removida ou erro na procedure SQL de atualização das mensagens no banco. | *Falha ao Atualizar a Ocorrência* | Atualize a listagem do Histórico e tente novamente. Detalhes técnicos ficam disponíveis na gaveta expansível. |

### 3. Módulo Administrativo

| Código / Sintoma | Causa Técnica | Mensagem no Modal | Ação Recomendada para o Operador / CCO |
| :--- | :--- | :--- | :--- |
| **Senha Administrativa Incorreta** | Valor fornecido no login não confere com `ADMIN_PASSWORD` do `.env.local`. | *Não foi possível entrar.* | Digite a senha cadastrada na variável `ADMIN_PASSWORD`. |
| **CSV Vazio ou Corrompido** | Arquivo enviado não contém linhas de dados ou delimitador não identificado. | *O arquivo CSV está vazio.* | Envie um arquivo CSV válido separado por vírgula (`,`) ou ponto e vírgula (`;`). |
| **Impacto Maior que 500 Caracteres** | Descrição do impacto padrão de uma falha excede o limite permitido pelo schema. | *Linha X: o impacto ultrapassa 500 caracteres.* | Reduza o texto do impacto para até 500 caracteres antes de importar. |
| **Colunas Ausentes no CSV** | Cabeçalho do arquivo não inclui `Falha` / `Descrição` e `Impacto`. | *Colunas obrigatórias não localizadas.* | Baixe o modelo oficial clicando em "Baixar modelo CSV" no painel. |
| **Edição de Modelos e Prompt** | Salva regras e modelos de mensagens diretamente pela interface web sem mexer em código-fonte. | *Salvo com Sucesso* | Os novos templates passam a valer instantaneamente para os despachos subsequentes. |
| **Modelos Normal e de Encerramento** | Permite editar separadamente as mensagens normais e os modelos de encerramento para Comunicação, Operação e Gerência. | Os modelos de encerramento usam `{{TITULO}}`, `{{HORA_INICIO}}`, `{{HORA_FIM}}` e `{{DURACAO}}`. | As mensagens encerradas exibem apenas esses quatro dados e mantêm a assinatura do SCO como última linha. |
| **Apoio da MRS em Trem de Carga** | Prefixos com três letras e quatro números solicitam confirmação; se a resposta for “Não”, justificativa de até 500 caracteres é obrigatória e incluída no despacho. | A confirmação e a justificativa ficam antes da assinatura do SCO. | Registre a ciência ou o motivo informado antes de gerar as mensagens. |

### 4. Integração de Mensagens e Disparo (WhatsApp / Evolution API v2)

| Recurso / Sintoma | Funcionamento Técnico | Ação Operacional |
| :--- | :--- | :--- |
| **Salvamento Automático no Histórico** | Ao disparar mensagens (em lote ou canal individual), a ocorrência é gravada/atualizada automaticamente no Supabase e associada ao `codigo_evento`. | O operador não precisa lembrar de salvar manualmente; o sistema exibe o ID gerado e atualiza a listagem. |
| **Painel de Configuração Web** | URL da Evolution, API Key, nome da instância, IDs dos 3 grupos e tempos anti-bloqueio editáveis na aba Administração. | Permite troca de instâncias, números e ajustes de proteção sem necessidade de deploy ou acesso ao servidor. |
| **Mecanismo Anti-Bloqueio** | Simulação visual de status `"digitando..."` e pausas aleatórias inteligentes entre despachos de grupos. | Protege o número institucional contra detecções de spam pelo WhatsApp. |
| **Encerramento e Duração** | No encerramento da ocorrência, o sistema aplica o modelo específico, calcula a duração total (ex: `1h 25min`) e mantém a assinatura do SCO no final. | A mensagem de encerramento contém somente o título, os horários de início e fim, a duração e a assinatura do SCO. |
