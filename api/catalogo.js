const catalogo = require("../lib/catalogo");

module.exports = async (req, res) => {
  // Configurar CORS e Cache se aplicável
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Devolver apenas os dados públicos do catálogo
  const dadosPublicos = {
    kits: catalogo.kits,
    cores: catalogo.cores,
    coresNomes: catalogo.coresNomes,
    bumps: catalogo.bumps.filter((b) => b.ativo),
    upsell: {
      ativo: catalogo.upsell.ativo,
      seUnidade: catalogo.upsell.seUnidade,
      seDupla: catalogo.upsell.seDupla
    },
    prazos: catalogo.prazos
  };

  return res.status(200).json(dadosPublicos);
};
