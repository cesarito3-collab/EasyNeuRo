# Servidor de NeuroVisor (Cloudflare Workers)

Cuentas de médicos (Lite / PRO) y la red entrenada de puntas de NeuroVisor PRO v3.12.

## Qué hay acá

| Archivo | Qué hace |
|---|---|
| `index.js` | El servidor: entrar con correo y código, ver el plan, analizar tramos con la red, página de administración (`/api/admin/...`). |
| `red.js` | El cálculo de la red (el mismo de NeuroVisor v3.11). **Los pesos no están en este repositorio**: se cargan en la base D1. |
| `../public/admin.html` | Página `/admin` para crear cuentas, pasar a Lite o PRO, desactivar, cambiar códigos y ver el uso. |
| `pruebas/` | Pruebas sin internet: base D1 imitada con SQLite (`node:sqlite`, Node 22 o más). |

Bases D1 (en `wrangler.jsonc`): `neurovisor` para producción (rama `main`) y `neurovisor-pruebas` para las vistas previas
de las otras ramas. Nunca se mezclan.

## Cómo funciona

- El administrador crea la cuenta en `/admin` y le pasa al médico su correo y el código (`NV-XXXX-XXXX-XXXX-XXXX`).
  El código se muestra una sola vez; en la base queda solo su huella (SHA-256).
- El visor PRO entra con correo y código y recibe una sesión de 60 días que se renueva sola mientras se usa.
- Cada tramo que manda el visor (19 canales × 64 s a 128 Hz, en números sin unidades, sin nombre ni fechas) se analiza
  en memoria y se descarta. Antes de cada tramo se vuelve a leer la cuenta: si se pasa a Lite, se desactiva o vence,
  deja de funcionar en el acto.
- Se anota solo cuántos segundos de EEG se analizaron por cuenta y por día (para el límite diario y para el panel).
- Los registros de Cloudflare guardan solo los errores del servidor, no los encabezados (que llevan el token y la clave).

## Puesta en marcha (una sola vez por base)

1. Plan **Workers Paid** (5 USD/mes) en Cloudflare: el plan gratis corta cada pedido a los 10 ms de CPU y la red
   necesita unos 300-450 ms por tramo.
2. Crear las tablas y la clave de administrador (lo hace Claude con el conector de Cloudflare, o a mano con el SQL de
   `ESQUEMA` en `index.js` y `INSERT INTO ajustes (clave, valor) VALUES ('admin_hash', '<sha256 de "admin:" + clave>')`).
3. Cargar la red: `curl -X PUT --data-binary @spikenet-w.js -H "X-Admin-Clave: ADM-..." https://<servidor>/api/admin/modelo`
   (el archivo `spikenet-w.js` está en la copia privada del visor, `src/spikenet-w.js`).
4. Entrar a `/admin`, cambiar la clave de administrador y crear las cuentas.

## Pruebas

```
node server/pruebas/probar-servidor.mjs <spikenet-w.js> [<spikenet.js de v3.11>]   # 41 pruebas, red bit a bit igual a v3.11
node server/pruebas/probar-admin.mjs server -                                    # 14 pruebas de la página /admin
```

## Lo que NO resuelve

- El resto del detector (crisis por reglas, filtro IFCN y de artefactos), los patrones y el sueño siguen dentro del
  HTML del visor. El Básico también lleva el detector por reglas (bloqueado solo en la interfaz).
- Las demás funciones PRO se bloquean en el navegador: alguien con conocimientos puede destrabarlas. Lo único que no se
  puede destrabar es la red, porque decide el servidor.
- No cobra: el pago (PayPal) y el alta automática de cuentas son otro paso.
- Este repositorio es público: el código del servidor y la arquitectura de la red se ven; los pesos no.
- Quien tenga una cuenta PRO podría intentar copiar la red mandándole muchos tramos; lo limita el tope de horas por día.
