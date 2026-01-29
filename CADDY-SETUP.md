# HTTPS en 1 droplet (opcional)

Si solo quieres probar por IP, puedes usar `http://IP:3000` sin proxy.

Para producción (y sobre todo para Bold callbacks), lo recomendado es tener **dominio + HTTPS**.

## Opción simple: Caddy (recomendado)

1) Apunta tu dominio al droplet (registro A)
- `A  tu-dominio.com  -> <IP_DEL_DROPLET>`

2) Abre puertos en el droplet/firewall
- 80/tcp
- 443/tcp

3) Añade un reverse proxy (ejemplo)

Crea un archivo `caddy/Caddyfile` con:

```
tu-dominio.com {
  reverse_proxy app:3000
}
```

Y en tu compose agrega un servicio Caddy (si quieres lo integro en el compose).

## Opción: Nginx + Certbot

También sirve, pero es más pasos (certbot + renovaciones). Caddy es más “plug-and-play”.
