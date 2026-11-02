-- DRAFT ONLY: DO NOT APPLY TO PRODUCTION UNTIL RELEASE CHECKLIST IS COMPLETE.
-- Username signup uses an internal Auth alias, not a reachable member email.
-- Users never supply a phone or an email address. Owner adds academy name/address.
-- Existing accounts are preserved; admin keeps the separate legacy login.
-- Prerequisite: Supabase Auth Email provider enabled, Confirm email OFF.

create table if not exists public.member_login_ids (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null unique
    check (login_id ~ '^[a-z][a-z0-9_]{3,19}$'
      and login_id not in ('admin','administrator','support','system','root')),
  created_at timestamptz not null default now()
);
alter table public.member_login_ids enable row level security;

create table if not exists public.parent_children (
  child_id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references public.member_profiles(user_id) on delete cascade,
  child_name text not null check (char_length(btrim(child_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  -- No student ID is assigned at signup: staff verifies enrollment and guardian first.
  verified_student_id uuid
);
alter table public.parent_children enable row level security;

-- Even with a publishable key, child names are not publicly readable.
revoke all on public.member_login_ids from anon, authenticated;
revoke all on public.parent_children from anon, authenticated;
grant select on public.member_login_ids to authenticated;
grant select on public.parent_children to authenticated;

drop policy if exists "Member sees own username; admin sees all" on public.member_login_ids;
create policy "Member sees own username; admin sees all"
on public.member_login_ids for select to authenticated
using (
 user_id=(select auth.uid())
 or exists(select 1 from public.platform_admins where user_id=(select auth.uid()))
);

drop policy if exists "Parent sees own child; admin sees all" on public.parent_children;
create policy "Parent sees own child; admin sees all"
on public.parent_children for select to authenticated
using (
 parent_user_id=(select auth.uid())
 or exists(select 1 from public.platform_admins where user_id=(select auth.uid()))
);
-- No public INSERT/UPDATE/DELETE. Initial row inserted by trusted auth.users trigger;
-- linking a child to an actual student will use a separate, admin-only workflow later.

create or replace function private.create_member_profile()
returns trigger language plpgsql security definer set search_path=''
as $body$
declare
  kind text;
  requested_login_id text;
  requested_child text;
  academy text;
  academy_addr text;
begin
  kind := case when new.raw_user_meta_data->>'account_type' = 'academy_owner'
    then 'academy_owner' else 'parent' end;

  requested_login_id := nullif(lower(btrim(coalesce(new.raw_user_meta_data->>'login_id',''))),'');
  requested_child := nullif(btrim(left(coalesce(new.raw_user_meta_data->>'child_name',''),60)),'');
  academy := nullif(btrim(left(coalesce(new.raw_user_meta_data->>'academy_name',''),120)),'');
  academy_addr := nullif(btrim(left(coalesce(new.raw_user_meta_data->>'academy_address',''),200)),'');
  if requested_login_id is not null then
    if requested_login_id !~ '^[a-z][a-z0-9_]{3,19}$'
      or requested_login_id in ('admin','administrator','support','system','root')
      or new.email is distinct from requested_login_id||'@accounts.conmath.kr'
    then
      raise exception 'Invalid account identifier';
    end if;
    if kind='parent' and requested_child is null then
      raise exception 'Child name is required for parent signup';
    end if;
    if kind='academy_owner' and (academy is null or academy_addr is null) then
      raise exception 'Academy name and address are required';
    end if;
  end if;

  insert into public.member_profiles
    (user_id,email,full_name,phone,account_type,approval_status,academy_name,academy_address)
  values (
    new.id,
    coalesce(new.email,''),
    case when requested_login_id is not null then
      case when kind='parent' then '학부모 회원' else '협력학원 담당자' end
    else coalesce(nullif(btrim(left(coalesce(new.raw_user_meta_data->>'full_name',''),60)),''),'회원정보 미입력') end,
    null,
    kind,
    'pending',
    case when kind='academy_owner' then academy else null end,
    case when kind='academy_owner' then academy_addr else null end
  );

  if requested_login_id is not null then
    insert into public.member_login_ids(user_id,login_id) values(new.id,requested_login_id);
    if kind='parent' then
      insert into public.parent_children(parent_user_id,child_name)
        values(new.id,requested_child);
    end if;
  end if;
  return new;
end;
$body$;

-- Existing legacy member profiles are unchanged.
-- Run RLS abuse and signup rollback tests before deploying these DDL changes.
