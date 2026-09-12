-- Shared work schedule access for authenticated users.
-- Run this in Supabase SQL Editor.

alter table public.work_schedule enable row level security;

drop policy if exists "Authenticated users can view work schedules" on public.work_schedule;
drop policy if exists "Users can view work schedules" on public.work_schedule;
drop policy if exists "Admins can create work schedules" on public.work_schedule;
drop policy if exists "Admins can update work schedules" on public.work_schedule;
drop policy if exists "Admins can delete work schedules" on public.work_schedule;

-- Both admin and normal users can view all shared work schedules.
create policy "Users can view work schedules"
on public.work_schedule
for select
to authenticated
using (true);

create policy "Admins can create work schedules"
on public.work_schedule
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "Admins can update work schedules"
on public.work_schedule
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "Admins can delete work schedules"
on public.work_schedule
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- Allow authenticated workers to change only a job's status without granting
-- them permission to edit the rest of the work schedule row.
create or replace function public.update_work_schedule_status(
  schedule_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if new_status not in ('inprogress', 'complete') then
    raise exception 'Invalid work status';
  end if;

  update public.work_schedule
  set status = new_status
  where id = schedule_id;
end;
$$;

revoke all on function public.update_work_schedule_status(uuid, text) from public;
grant execute on function public.update_work_schedule_status(uuid, text) to authenticated;