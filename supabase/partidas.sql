begin;
create table if not exists public.fm_partidas (
  jogador uuid primary key references auth.users(id) on delete cascade,
  progresso jsonb not null check (jsonb_typeof(progresso) = 'object'),
  revisao uuid not null
);
alter table public.fm_partidas enable row level security;
revoke all on table public.fm_partidas from public, anon, authenticated;
grant select, insert, update on table public.fm_partidas to authenticated;
drop policy if exists fm_ler on public.fm_partidas;
create policy fm_ler on public.fm_partidas for select to authenticated using (jogador = (select auth.uid()));
drop policy if exists fm_inserir on public.fm_partidas;
create policy fm_inserir on public.fm_partidas for insert to authenticated with check (jogador = (select auth.uid()));
drop policy if exists fm_atualizar on public.fm_partidas;
create policy fm_atualizar on public.fm_partidas for update to authenticated using (jogador = (select auth.uid())) with check (jogador = (select auth.uid()));
commit;

-- Depois de criar e confirmar sua conta, copie o UUID correto em Authentication > Users.
-- Execute separadamente, substituindo o UUID:
-- update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--   || '{"fm_owner":true}'::jsonb where id = 'UUID-DA-SUA-CONTA'::uuid;
-- Entre novamente para carregar a permissão.
