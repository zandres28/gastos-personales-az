-- Función para migrar datos viejos (llamar una sola vez)
CREATE OR REPLACE FUNCTION migrate_old_data(target_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE gastos SET user_id = target_user_id WHERE user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Categorías por defecto (ya creadas en el código, pero por si acaso)
-- Se crean desde el JS cuando el usuario no tiene categorías

-- Medios de pago por defecto
-- Se crean desde el JS cuando el usuario no tiene medios de pago
