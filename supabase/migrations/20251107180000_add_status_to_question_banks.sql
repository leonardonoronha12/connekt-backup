-- Add status column to persist activation permanently
alter table question_banks
  add column if not exists status text
  check (status in ('draft','active'))
  default 'draft';

-- Backfill status based on completeness of main fields
update question_banks
set status = case
  when coalesce(trim(name),'') <> ''
   and coalesce(trim(description),'') <> ''
   and coalesce(trim(category),'') <> ''
  then 'active'
  else 'draft'
end
where status is null
   or status not in ('draft','active');

-- Ensure not null going forward
alter table question_banks
  alter column status set not null;