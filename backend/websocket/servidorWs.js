const WebSocket = require("ws");

function iniciarServidorWebSocket({
  puertoWs,
  publicarComandoMqtt,
  registrarLog,
  registrarEvento,
}) {
  // Conjunto de clientes WS conectados
  const clientesWs = new Set();
  const servidorWs = new WebSocket.Server({ port: puertoWs });

  servidorWs.on("connection", (socket) => {
    clientesWs.add(socket);
    registrarLog("Cliente WS conectado. Total:", clientesWs.size);

    // Mensaje de bienvenida al conectar
    socket.send(
      JSON.stringify({
        tipo: "sistema",
        mensaje: "Conexion WebSocket establecida",
      })
    );

    socket.on("message", async (mensaje) => {
      try {
        const contenido = JSON.parse(mensaje.toString());
        const esComando =
          contenido.tipo === "command" || contenido.type === "command";
        if (esComando) {
          registrarLog("Comando recibido por WS:", contenido);
          const comandoNormalizado = { ...contenido, tipo: "command" };
          // Pasamos el comando al canal MQTT
          publicarComandoMqtt(comandoNormalizado);
          if (registrarEvento) {
            try {
              await registrarEvento({
                origen: "ws",
                tipo: "command",
                datos: comandoNormalizado,
              });
            } catch (errReg) {
              registrarLog("No se pudo guardar comando WS", errReg.message);
            }
          }
        }
      } catch (error) {
        registrarLog("Error al procesar mensaje WS", error.message);
      }
    });

    socket.on("close", () => {
      clientesWs.delete(socket);
      registrarLog("Cliente WS desconectado. Total:", clientesWs.size);
    });
  });

  servidorWs.on("listening", () => {
    registrarLog(`WebSocket escuchando en puerto ${puertoWs}`);
  });

  function emitirEventoWs(eventoPlano) {
    // Broadcasting de eventos a todos los clientes WS vivos
    const mensaje = JSON.stringify({ tipo: "evento", datos: eventoPlano });
    for (const cliente of clientesWs) {
      if (cliente.readyState === WebSocket.OPEN) {
        cliente.send(mensaje);
      }
    }
    registrarLog(
      "Evento emitido por WS",
      eventoPlano._id || eventoPlano.id || "nuevo"
    );
  }

  function cerrarWs() {
    try {
      servidorWs.close();
    } catch (_) {}
    for (const cliente of clientesWs) {
      try {
        cliente.terminate();
      } catch (_) {}
    }
    clientesWs.clear();
  }

  return { servidorWs, emitirEventoWs, cerrarWs };
}

module.exports = { iniciarServidorWebSocket };
