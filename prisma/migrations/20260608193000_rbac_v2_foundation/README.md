Migracion base de RBAC v2.

Crea:
- domain_entitlements
- capability_entitlements
- user_capability_grants
- enums RbacScopeType y RbacGrantSource

Objetivo: convivir con UserModuleAccess y EmpresaModuleOverride mientras el resolver migra gradualmente a dominio/capacidad/scope.
