CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📁',
  color text NOT NULL DEFAULT '#7A7168',
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '💳',
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  category text NOT NULL,
  note text NOT NULL DEFAULT '',
  date date NOT NULL,
  timestamp bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  payment_method text NOT NULL DEFAULT 'Efectivo',
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gastos_user_timestamp ON gastos(user_id, timestamp DESC);
