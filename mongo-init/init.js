// Crea base y colección inicial para eventos
const dbEvento = db.getSiblingDB("dispensador_db");
if (!dbEvento.getCollectionNames().includes("events")) {
  dbEvento.createCollection("events");
}
dbEvento.events.createIndex({ creadoEn: -1 });
