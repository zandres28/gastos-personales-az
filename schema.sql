-- Agregar columna payment_method a tabla existente
ALTER TABLE gastos ADD COLUMN payment_method text default 'Efectivo';
