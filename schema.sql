-- Tabla de categorías (personalizadas por usuario)
CREATE TABLE IF NOT EXISTS categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  icon text default '📁',
  color text default '#7A7168',
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Tabla de medios de pago (personalizados por usuario)
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  icon text default '💳',
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Habilitar RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Políticas para categories
CREATE POLICY "Users can view own categories" ON categories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para payment_methods
CREATE POLICY "Users can view own payment_methods" ON payment_methods
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payment_methods" ON payment_methods
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payment_methods" ON payment_methods
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payment_methods" ON payment_methods
  FOR DELETE USING (auth.uid() = user_id);

-- Agregar user_id a la tabla gastos
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) on delete cascade;

-- Habilitar RLS en gastos si no está habilitado
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo vean sus propios gastos
CREATE POLICY "Users can view own gastos" ON gastos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gastos" ON gastos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gastos" ON gastos
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gastos" ON gastos
  FOR DELETE USING (auth.uid() = user_id);

-- Insertar categorías y medios de pago por defecto para nuevos usuarios
-- (Esto se hará desde el código al registrarse)
