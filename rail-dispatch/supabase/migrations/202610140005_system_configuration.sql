-- =============================================================================
-- Migração: 202610140005_system_configuration.sql
-- Descrição: Criação da tabela de configurações dinâmicas do sistema (ex: prompt da IA)
-- =============================================================================

create table if not exists public.configuracoes_sistema (
  chave text primary key,
  valor text not null,
  descricao text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

comment on table public.configuracoes_sistema is 'Armazena configurações globais e dinâmicas da plataforma SIDO, como prompts da IA e parâmetros operacionais.';

-- Habilitar Row Level Security (RLS)
alter table public.configuracoes_sistema enable row level security;

-- Política de leitura: qualquer usuário ou cliente da API pode ler as configurações ativas
drop policy if exists "Leitura de configuracoes do sistema" on public.configuracoes_sistema;
create policy "Leitura de configuracoes do sistema"
  on public.configuracoes_sistema
  for select
  using (true);

-- Política de escrita: somente operações com service_role (rotas administrativas) podem alterar ou excluir
drop policy if exists "Modificacao restrita a service_role" on public.configuracoes_sistema;
create policy "Modificacao restrita a service_role"
  on public.configuracoes_sistema
  for all
  using (auth.role() = 'service_role');
