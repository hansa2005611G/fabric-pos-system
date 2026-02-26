-- Add default system settings for units
INSERT INTO system_settings (setting_key, setting_value) 
VALUES 
  ('default_measurement_unit', '"meter"'),
  ('display_units', '["meter", "yard", "feet"]'),
  ('price_per_unit', '"meter"')
ON CONFLICT (setting_key) DO NOTHING;

-- Add preferred unit to users table (optional - for Phase 2)
-- ALTER TABLE users ADD COLUMN preferred_unit VARCHAR(20) DEFAULT 'meter';