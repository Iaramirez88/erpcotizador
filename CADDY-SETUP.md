# HTTPS en 1 servidor (Caddy + Docker Compose)

Si solo quieres probar por IP, puedes usar `http://IP:3000` sin proxy.

Para producción (y sobre todo para Bold callbacks), lo recomendado es tener **dominio + HTTPS**.

## Opción simple: Caddy (recomendado)

1) Apunta tu dominio al servidor (registro A)
- `A  tu-dominio.com  -> <IP_DEL_SERVIDOR>`

2) Abre puertos en el servidor/firewall
- 80/tcp
- 443/tcp

3) Configura Caddy

Este repo incluye `caddy/Caddyfile`. Solo cambia el dominio.

```
tu-dominio.com {
  reverse_proxy app:3000
}
```

En producción, Caddy ya está integrado en `docker-compose.prod.yml`.

Notas:
- En producción no deberías exponer `3000` al público; Caddy publica `80/443` y enruta a `app:3000` internamente.

## Opción: Nginx + Certbot

También sirve, pero es más pasos (certbot + renovaciones). Caddy es más “plug-and-play”.
