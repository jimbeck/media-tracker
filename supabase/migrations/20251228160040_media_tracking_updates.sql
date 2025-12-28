-- Media tracking updates: align status naming and completion timestamp.
alter type media_status rename value 'planned' to 'interested';

alter table user_media
  rename column finished_at to completed_at;

alter table user_media
  alter column status set default 'interested';
