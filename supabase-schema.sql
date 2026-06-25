-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Drop existing tables (idempotent reset)
drop table if exists "sessionMedia" cascade;
drop table if exists "clipGroups" cascade;
drop table if exists "clips" cascade;
drop table if exists "sessionGroups" cascade;
drop table if exists "sessions" cascade;

-- SESSIONS
create table "sessions" (
  "id" text primary key,
  "user_id" uuid references auth.users not null,
  "title" text not null,
  "subtitle" text,
  "date" bigint not null,
  "summary" text,
  "notes" text,
  "cardOrder" text[],
  "groupId" text,
  "isDemo" boolean,
  "glossaryId" text,
  "customGlossaryStyle" text,
  "shareId" text,
  "shareMethod" text,
  "shareTimestamp" bigint,
  "sharedContent" jsonb,
  "location" text,
  "equipment" text,
  "cameraSettings" text,
  "generalNotes" text,
  "reviewNotes" text,
  "showGeneralNotesInReview" boolean,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "deleted" boolean default false not null
);

-- CLIPS
create table "clips" (
  "id" text primary key,
  "user_id" uuid references auth.users not null,
  "sessionId" text references sessions("id") on delete cascade not null,
  "title" text not null,
  "startedAt" bigint,
  "endedAt" bigint,
  "markers" jsonb[],
  "notes" text,
  "groupId" text,
  "isResolved" boolean,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "deleted" boolean default false not null
);

-- CLIP GROUPS
create table "clipGroups" (
  "id" text primary key,
  "user_id" uuid references auth.users not null,
  "sessionId" text references sessions("id") on delete cascade not null,
  "title" text not null,
  "order" bigint not null,
  "clipOrder" text[],
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "deleted" boolean default false not null
);

-- SESSION GROUPS
create table "sessionGroups" (
  "id" text primary key,
  "user_id" uuid references auth.users not null,
  "name" text not null,
  "dateCreated" bigint not null,
  "sessionOrder" text[],
  "folderOrder" text[],
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "deleted" boolean default false not null
);

-- SESSION MEDIA
create table "sessionMedia" (
  "id" text primary key,
  "user_id" uuid references auth.users not null,
  "sessionId" text references sessions("id") on delete cascade not null,
  "timestamp" bigint not null,
  "filename" text not null,
  "mimeType" text not null,
  "size" bigint not null,
  "storageMode" text not null,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "deleted" boolean default false not null
);

-- Row Level Security (RLS) — ALWAYS enable on every table
alter table "sessions" enable row level security;
alter table "clips" enable row level security;
alter table "clipGroups" enable row level security;
alter table "sessionGroups" enable row level security;
alter table "sessionMedia" enable row level security;

-- Enable Realtime
alter publication supabase_realtime add table "sessions", "clips", "clipGroups", "sessionGroups", "sessionMedia";

-- Policies
create policy "Users can only see their own sessions" on "sessions" for all using (auth.uid() = user_id);
create policy "Users can only see their own clips" on "clips" for all using (auth.uid() = user_id);
create policy "Users can only see their own clipGroups" on "clipGroups" for all using (auth.uid() = user_id);
create policy "Users can only see their own sessionGroups" on "sessionGroups" for all using (auth.uid() = user_id);
create policy "Users can only see their own sessionMedia" on "sessionMedia" for all using (auth.uid() = user_id);

-- Storage Buckets
insert into storage.buckets (id, name, public) values ('sessionMedia', 'sessionMedia', true) on conflict do nothing;

-- Storage policies for 'sessionMedia'
drop policy if exists "Anyone can view sessionMedia" on storage.objects;
drop policy if exists "Authenticated users can upload sessionMedia" on storage.objects;
drop policy if exists "Users can update their own sessionMedia" on storage.objects;
drop policy if exists "Users can delete their own sessionMedia" on storage.objects;

create policy "Anyone can view sessionMedia" on storage.objects for select using ( bucket_id = 'sessionMedia' );
create policy "Authenticated users can upload sessionMedia" on storage.objects for insert with check ( auth.role() = 'authenticated' and bucket_id = 'sessionMedia' );
create policy "Users can update their own sessionMedia" on storage.objects for update using ( auth.uid() = owner and bucket_id = 'sessionMedia' );
create policy "Users can delete their own sessionMedia" on storage.objects for delete using ( auth.uid() = owner and bucket_id = 'sessionMedia' );
