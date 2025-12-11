function obtenerConfig(req, res) {
  const configActual = req.app.locals.configActual || {};
  res.json({ ok: true, configuracion: configActual });
}

function actualizarConfig(req, res) {
  const nuevaConfig = req.body || {};
  req.app.locals.configActual = {
    ...(req.app.locals.configActual || {}),
    ...nuevaConfig,
  };
  res.json({ ok: true, configuracion: req.app.locals.configActual });
}

module.exports = {
  obtenerConfig,
  actualizarConfig,
};
