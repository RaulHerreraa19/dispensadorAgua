const express = require("express");
const {
  obtenerConfig,
  actualizarConfig,
} = require("../controllers/configController");

const router = express.Router();

router.get("/", obtenerConfig);
router.put("/", actualizarConfig);

module.exports = router;
