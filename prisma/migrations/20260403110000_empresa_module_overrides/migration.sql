CREATE TABLE IF NOT EXISTS empresa_module_overrides (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  module TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT empresa_module_overrides_empresa_id_fkey
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS empresa_module_overrides_empresa_id_module_key
  ON empresa_module_overrides(empresa_id, module);

CREATE INDEX IF NOT EXISTS empresa_module_overrides_empresa_id_idx
  ON empresa_module_overrides(empresa_id);