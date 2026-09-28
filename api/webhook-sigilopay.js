const sigilopay = require("../lib/sigilopay");
const db = require("../lib/db");
const { enviarMetaPurchase } = require("../lib/meta");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const payload = req.body || {};
    const { event, transaction, client, token } = payload;

    if (!event) {
      return res.status(400).json({ error: "Evento não especificado." });
    }

    // Identificar o pedido correspondente
    const identifier = transaction?.identifier || transaction?.id || payload.identifier || payload.metadata?.orderId;
    let pedido = null;

    if (identifier) {
      pedido = await db.buscarPedidoPorId(identifier);
      if (!pedido) {
        pedido = await db.buscarPedidoPorTxid(identifier);
      }
    }

    // Validação da notificação
    const ehValido = sigilopay.validarWebhook(payload, pedido);
    if (!ehValido && process.env.NODE_ENV === "production") {
      return res.status(401).json({ error: "Assinatura ou token de webhook inválido." });
    }

    // Apenas TRANSACTION_PAID aprova a venda (conforme documentação oficial)
    if (event === "TRANSACTION_PAID") {
      if (pedido) {
        // Idempotência: se já foi marcado como pago, responde 200 sem duplicar ações
        if (pedido.status === "pago") {
          return res.status(200).json({ success: true, message: "Pedido já processado anteriormente." });
        }

        // Conferir valor se disponível na transação
        const valorTransacaoReais = transaction?.amount ? Number(transaction.amount) : null;
        if (valorTransacaoReais !== null) {
          const totalEsperadoReais = pedido.total / 100;
          // Permitir pequena variação de arredondamento de até 1 centavo
          if (Math.abs(valorTransacaoReais - totalEsperadoReais) > 0.05) {
            console.warn(`Divergência de valor no pedido ${pedido.id}: pago R$ ${valorTransacaoReais}, esperado R$ ${totalEsperadoReais}`);
          }
        }

        // Atualizar status para pago
        const pagoEm = transaction?.payedAt || new Date().toISOString();
        const pedidoAtualizado = await db.atualizarStatusPedido(pedido.id, "pago", {
          pago_em: pagoEm,
          txid: transaction?.id || pedido.txid
        });

        // 1. Enviar evento Purchase para Meta Conversions API (CAPI) com deduplicação
        const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
        const userAgent = req.headers["user-agent"];
        await enviarMetaPurchase({
          pedidoId: pedido.id,
          totalCentavos: pedido.total,
          cliente: pedido.cliente,
          itens: pedido.itens,
          ip: clientIp,
          userAgent: userAgent
        });

        // 2. Disparar webhook de automação externa se configurado
        if (process.env.WEBHOOK_AUTOMACAO_URL) {
          fetch(process.env.WEBHOOK_AUTOMACAO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              evento: "pix_pago",
              pedido: pedidoAtualizado || pedido
            })
          }).catch((err) => console.error("Erro webhook automacao pix_pago:", err.message));
        }

        return res.status(200).json({ success: true, status: "pago", id: pedido.id });
      }
    } else if (event === "TRANSACTION_CANCELED" || event === "TRANSACTION_REFUNDED") {
      if (pedido) {
        const novoStatus = event === "TRANSACTION_REFUNDED" ? "reembolsado" : "cancelado";
        await db.atualizarStatusPedido(pedido.id, novoStatus);
      }
    }

    return res.status(200).json({ success: true, event });
  } catch (err) {
    console.error("Erro ao processar webhook SigiloPay:", err);
    return res.status(500).json({ error: err.message || "Erro interno no webhook." });
  }
};
