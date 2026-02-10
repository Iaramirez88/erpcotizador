-- RenameIndex
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_class c
		JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE c.relkind = 'i'
			AND n.nspname = 'public'
			AND c.relname = 'registration_invites_empresa_email_idx'
	) THEN
		ALTER INDEX "registration_invites_empresa_email_idx" RENAME TO "registration_invites_empresaId_email_idx";
	END IF;
END $$;
