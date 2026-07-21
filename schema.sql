create table gastos (
  id uuid default gen_random_uuid() primary key,
  amount numeric not null,
  category text not null,
  note text default '',
  date date not null,
  timestamp bigint not null,
  created_at timestamptz default now()
);

-- Habilitar acceso público (sin auth)
alter table gastos enable row level security;

create policy "Allow public access" on gastos
  for all
  using (true)
  with check (true);
