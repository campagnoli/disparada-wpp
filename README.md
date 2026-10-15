# disparada-wpp

## Falhas e impactos predefinidos

Execute as migrações Supabase em ordem. A migração
`rail-dispatch/supabase/migrations/202610130003_failure_impacts.sql` associa impactos iniciais
às falhas predefinidas. A migração
`rail-dispatch/supabase/migrations/202610130004_occurrence_classification_and_train_fields.sql`
adiciona as classificações de ocorrência, o tipo de IN e os campos separados para ID do trem e
prefixo da viagem.

Esta migração também atualiza a função `registrar_ocorrencia` usada pelo salvamento manual e
automático. Ela precisa estar aplicada no projeto Supabase de produção; caso contrário, a API
retornará um erro informando que a função ou os campos da ocorrência estão desatualizados.

A migração `rail-dispatch/supabase/migrations/202610150006_paese_activation.sql` adiciona os
campos de acionamento PAESE e atualiza a função de gravação para persistir a modalidade e o trecho.
Execute-a no Supabase antes de publicar a versão que inclui o formulário de PAESE.

No formulário podem ser selecionadas várias falhas. A descrição e o impacto de cada uma podem
ser editados para a ocorrência atual; a aba Administração permite adicionar, editar e remover
os padrões compartilhados.

## Configuração administrativa

Configure estas variáveis no ambiente do servidor:

- `SUPABASE_SERVICE_ROLE_KEY`: chave `service_role` do Supabase. Mantenha-a apenas no servidor;
  nunca use o prefixo `NEXT_PUBLIC_`.
- `ADMIN_PASSWORD`: senha usada para entrar na aba Administração.
- `ADMIN_SESSION_SECRET`: segredo aleatório forte usado para assinar a sessão administrativa.