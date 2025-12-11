# Dispensador en tiempo real

Proyecto completo en contenedores con MongoDB, backend Node.js (Express + WebSocket + MQTT) y frontend estático.

## Requisitos previos

- Docker y Docker Compose instalados.

## Puertos expuestos

- Backend HTTP: 3000
- Backend WebSocket: 8080
- MongoDB: 27017
- Frontend: 5173

## Cómo levantar todo

1. Copia `.env.example` a `.env` dentro de `backend/` y ajusta valores si lo necesitas.
2. Ejecuta:
  ```bash
  docker-compose up -d --build
  ```
3. Abre el frontend en tu navegador: http://localhost:5173

## Endpoints backend

- `GET /api/events` — lista eventos (query `limite` opcional)
- `POST /api/events` — crea evento
- `GET /api/config` — devuelve configuración en memoria
- `PUT /api/config` — actualiza configuración en memoria
- `GET /api/health` — estado del servicio

## Flujo WebSocket y MQTT

- El backend abre WebSocket en puerto 8080 para UI y dispositivos.
- El backend se conecta a `mqtt://test.mosquitto.org` y se suscribe a:
  - `dispensador/events` (solo estos eventos se guardan y se emiten a la UI)
  - `dispensador/commands` (solo se reenvía, no se vuelve a guardar para evitar duplicados)
- Si llega un evento por MQTT → se guarda en MongoDB y se hace broadcast por WS a la UI.
- Si el frontend envía un comando por WS (JSON `{ "tipo": "command", "cmd": "dispense", "cup": 1 }`) → se reenvía al topic MQTT `dispensador/commands` y se registra como comando de origen `ws`.
- La UI muestra: alerta de envío, lista de comandos enviados y tabla de eventos guardados en BD en tiempo real.

## Modelo de datos

- Base: `dispensador_db`
- Colección: `events`
- Modelo Mongoose: `Event` con campos `tipo`, `origen`, `datos` y timestamps.

## Logs

El backend escribe logs simples en consola. Ajusta `LOG_NIVEL` en `.env` para silenciar con `silencio` si lo necesitas. Consulta con:

```bash
docker logs -f dispensador_backend
```
