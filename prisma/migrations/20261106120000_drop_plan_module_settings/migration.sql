-- Retira la matriz “módulos por plan”.
--
-- Estrategia comercial vigente: todos los planes incluyen todos los módulos; la diferenciación
-- entre planes vive en la capacidad y el consumo (`plan_limit_settings`). Los módulos solo se
-- restringen por empresa (`empresa_module_overrides`, `module_only_billing`).
--
-- Los valores históricos de la matriz quedan en el historial de migraciones/git.

DROP TABLE IF EXISTS "plan_module_settings";
