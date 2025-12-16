/* Servidor principal del backend: API REST, WebSocket y MQTT */
const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const mqtt = require("mqtt");

const Event = require("./models/Event");
const rutasEventos = require("./routes/events");
const rutasConfig = require("./routes/config");
const { iniciarServidorWebSocket } = require("./websocket/servidorWs");

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Puertos/URIs básicos de servicio
const puertoHttp = Number(process.env.PORT) || 3000;
const puertoWs = Number(process.env.WS_PORT) || 1883;
const mongoUri =
  process.env.MONGO_URI || "mongodb://mongo:27017/dispensador_db";
const mqttUrl = process.env.MQTT_URL || "mqtt://test.mosquitto.org";
// Topics MQTT alineados con el firmware Wokwi
const mqttTopicEventos = process.env.MQTT_TOPIC_EVENTS || "/TX_ESLI"; // eventos publicados por el ESP32
const mqttTopicComandos = process.env.MQTT_TOPIC_COMMANDS || "/RX_ESLI"; // comandos hacia el ESP32

app.locals.configActual = { modo: "auto", intensidad: 1 };
app.locals.despacharEvento = () => {};
app.locals.publicarEventoMqtt = () => {};

function registrarLog(...args) {
  const nivel = process.env.LOG_NIVEL || "info";
  if (nivel === "silencio") return;
  console.log("[backend]", ...args);
}
let emitirEventoWs = () => {};
let cerrarWs = () => {};
// Huellas para evitar reenviar a Mongo/WS lo mismo que acabamos de publicar en MQTT
const huellasPublicadasLocalmente = new Set();
const TTL_HUELLA_MS = 5000;

app.use("/api/events", rutasEventos);
app.use("/api/config", rutasConfig);
app.get("/api/health", (req, res) => {
  res.json({ ok: true, estado: "saludable" });
});

const servidorHttp = http.createServer(app);

let clienteMqtt;

async function registrarEvento({ origen, tipo, datos }) {
  const evento = await Event.create({
    tipo: tipo || "evento",
    origen: origen || "desconocido",
    datos: datos || {},
  });
  emitirEventoWs(evento.toObject());
  return evento;
}

function inicializarMqtt() {
  clienteMqtt = mqtt.connect(mqttUrl);

  clienteMqtt.on("connect", () => {
    registrarLog("Conectado a MQTT en", mqttUrl);
    clienteMqtt.subscribe([mqttTopicEventos, mqttTopicComandos], (err) => {
      if (err) {
        registrarLog("Error al suscribirse a topics MQTT", err.message);
      } else {
        registrarLog(
          "Suscripciones MQTT activas:",
          [mqttTopicEventos, mqttTopicComandos].join(", ")
        );
      }
    });
  });

  // Manejo de mensajes entrantes desde MQTT
  clienteMqtt.on("message", async (topic, payload) => {
    try {
      const texto = payload.toString();
      registrarLog("Mensaje MQTT recibido", topic, texto);
      if (huellasPublicadasLocalmente.has(texto)) {
        huellasPublicadasLocalmente.delete(texto);
        registrarLog("Ignorando eco MQTT de mensaje publicado por el backend");
        return;
      }
      let cuerpo = {};
      try {
        cuerpo = JSON.parse(texto);
      } catch (_) {
        cuerpo = { crudo: texto };
      }

      if (topic === mqttTopicEventos) {
        await registrarEvento({
          origen: "mqtt",
          tipo: cuerpo.tipo || "mqtt",
          datos: cuerpo,
        });
      }
    } catch (error) {
      registrarLog("Error manejando mensaje MQTT", error.message);
    }
  });

  clienteMqtt.on("error", (error) => {
    registrarLog("Error MQTT", error.message);
  });
}

function publicarComandoMqtt(comando) {
  if (!clienteMqtt || !clienteMqtt.connected) {
    registrarLog("MQTT no disponible para publicar");
    return;
  }
  const mensaje = JSON.stringify(comando);
  // Enviamos comandos hacia el ESP32
  clienteMqtt.publish(mqttTopicComandos, mensaje, { qos: 0 }, (err) => {
    if (err) {
      registrarLog("Error publicando comando MQTT", err.message);
    } else {
      registrarLog("Comando reenviado a MQTT", mqttTopicComandos, mensaje);
    }
  });
}

function publicarEventoMqtt(payloadEvento) {
  if (!clienteMqtt || !clienteMqtt.connected) {
    registrarLog("MQTT no disponible para publicar evento");
    return;
  }
  const mensaje =
    typeof payloadEvento === "string"
      ? payloadEvento
      : JSON.stringify(payloadEvento || {});

  // Guardamos huella breve para no reprocesar el eco del broker
  huellasPublicadasLocalmente.add(mensaje);
  setTimeout(() => huellasPublicadasLocalmente.delete(mensaje), TTL_HUELLA_MS);

  clienteMqtt.publish(mqttTopicEventos, mensaje, { qos: 0 }, (err) => {
    if (err) {
      registrarLog("Error publicando evento MQTT", err.message);
    } else {
      registrarLog("Evento reenviado a MQTT", mqttTopicEventos, mensaje);
    }
  });
}

async function iniciar() {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    registrarLog("Conectado a Mongo", mongoUri);

    servidorHttp.listen(puertoHttp, () => {
      registrarLog(`API HTTP escuchando en puerto ${puertoHttp}`);
    });

    // Arranca servidor WS y expone callbacks en locals
    const instanciaWs = iniciarServidorWebSocket({
      puertoWs,
      publicarComandoMqtt,
      registrarLog,
      registrarEvento,
    });
    emitirEventoWs = instanciaWs.emitirEventoWs;
    cerrarWs = instanciaWs.cerrarWs;
    app.locals.despacharEvento = emitirEventoWs;
    app.locals.publicarEventoMqtt = publicarEventoMqtt;

    inicializarMqtt();
  } catch (error) {
    console.error("Fallo al iniciar el servicio:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  registrarLog("Apagando por SIGINT...");
  cerrarWs();
  servidorHttp.close(() => process.exit(0));
});

iniciar();
