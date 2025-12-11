const Event = require("../models/Event");

async function listarEventos(req, res) {
  try {
    const limite = Number(req.query.limite) || 50;
    const eventos = await Event.find().sort({ creadoEn: -1 }).limit(limite);
    res.json({ ok: true, eventos });
  } catch (error) {
    console.error("Error al listar eventos:", error);
    res.status(500).json({ ok: false, mensaje: "Error al obtener eventos" });
  }
}

async function crearEvento(req, res) {
  try {
    const datosEntrada = req.body || {};
    const nuevoEvento = await Event.create({
      tipo: datosEntrada.tipo || "desconocido",
      origen: datosEntrada.origen || "api",
      datos: datosEntrada.datos || datosEntrada,
    });

    const despacharEvento = req.app.locals.despacharEvento || (() => {});
    despacharEvento(nuevoEvento.toObject());

    res.status(201).json({ ok: true, evento: nuevoEvento });
  } catch (error) {
    console.error("Error al crear evento:", error);
    res.status(500).json({ ok: false, mensaje: "Error al crear evento" });
  }
}

module.exports = {
  listarEventos,
  crearEvento,
};
