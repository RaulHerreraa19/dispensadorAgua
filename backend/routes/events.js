const express = require("express");
const {
  listarEventos,
  crearEvento,
} = require("../controllers/eventosController");

const router = express.Router();

router.get("/", listarEventos);
router.post("/", crearEvento);

module.exports = router;
