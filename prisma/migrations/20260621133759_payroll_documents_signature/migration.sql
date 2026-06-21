DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_indexes
		WHERE schemaname = 'public'
			AND indexname = 'payroll_employee_documents_signatureStatus_signatureRequired_id'
	) THEN
		ALTER INDEX "payroll_employee_documents_signatureStatus_signatureRequired_id"
			RENAME TO "payroll_employee_documents_signatureStatus_signatureRequire_idx";
	END IF;
END $$;
