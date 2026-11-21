-- Agregar proveedores nativos de TikTok (migración no destructiva; no altera los existentes).
ALTER TYPE "CrmChannelProvider" ADD VALUE 'TIKTOK_LEADS';
ALTER TYPE "CrmChannelProvider" ADD VALUE 'TIKTOK_MESSAGING';
