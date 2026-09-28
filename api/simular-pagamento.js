const db = require("../lib/db");
const { enviarMetaPurchase } = require("../lib/meta");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { pedidoId } = req.body || {};

  if (!pedidoId) {
    return res.status(400).json({ error: "ID do pedido é obrigatório." });
  }

  try {
    const pedido = await db.buscarPedidoPorId(pedidoId);
    if (!pedido) {
      return res.status(404).json({ error: "Pedido não encontrado para simulação." });
    }

    const pagoEm = new Date().toISOString();
    const pedidoAtualizado = await db.atualizarStatusPedido(pedidoId, "pago", {
      pago_em: pagoEm
    });

    // Enviar Meta CAPI se configurado
    await enviarMetaPurchase({
      pedidoId: pedido.id,
      totalCentavos: pedido.total,
      cliente: pedido.cliente,
      itens: pedido.itens
    });

    // Automação se configurada
    if (process.env.WEBHOOK_AUTOMACAO_URL) {
      fetch(process.env.WEBHOOK_AUTOMACAO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "pix_pago",
          pedido: pedidoAtualizado || pedido,
          simulado: true
        })
      }).catch((err) => console.error("Erro webhook automacao simulação:", err.message));
    }

    return res.status(200).json({
      success: true,
      message: "Pagamento aprovado com sucesso via simulação!",
      status: "pago",
      pedido: pedidoAtualizado || pedido
    });
  } catch (err) {
    console.error("Erro ao simular pagamento:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao simular pagamento." });
  }
};
