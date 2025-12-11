const mongoose = require("mongoose");

const esquemaEvento = new mongoose.Schema(
  {
    tipo: { type: String, required: true },
    origen: { type: String, default: "desconocido" },
    datos: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    collection: "events",
    timestamps: { createdAt: "creadoEn", updatedAt: "actualizadoEn" },
  }
);

const Event = mongoose.model("Event", esquemaEvento);

module.exports = Event;
