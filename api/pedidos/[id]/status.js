const db = require("../../../lib/db");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { id } = req.query || {};

  if (!id) {
    return res.status(400).json({ error: "ID do pedido é obrigatório." });
  }

  try {
    const pedido = await db.buscarPedidoPorId(id);

    if (!pedido) {
      return res.status(404).json({ error: "Pedido não encontrado." });
    }

    // Verificar se já expirou
    if (pedido.status === "aguardando_pagamento" && pedido.expira_em) {
      const expDate = new Date(pedido.expira_em);
      if (expDate.getTime() < Date.now()) {
        await db.atualizarStatusPedido(id, "expirado");
        return res.status(200).json({ status: "expirado", id: pedido.id });
      }
    }

    return res.status(200).json({
      status: pedido.status,
      id: pedido.id,
      pagoEm: pedido.pago_em || null
    });
  } catch (err) {
    console.error("Erro ao consultar status do pedido:", err);
    return res.status(500).json({ error: "Erro ao consultar status." });
  }
};
