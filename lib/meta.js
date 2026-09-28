const crypto = require("crypto");

function sha256(str) {
  if (!str) return null;
  return crypto.createHash("sha256").update(String(str).trim().toLowerCase()).digest("hex");
}

/**
 * Envia evento Purchase para a Meta Conversions API (CAPI).
 * @param {Object} params
 * @param {string} params.pedidoId - ID único do pedido (usado para deduplicação)
 * @param {number} params.totalCentavos - Valor total do pedido em centavos
 * @param {Object} params.cliente - { email, whatsapp, cpf, nome }
 * @param {Array} [params.itens] - Itens do pedido
 * @param {string} [params.ip] - IP do cliente
 * @param {string} [params.userAgent] - User-Agent do cliente
 */
async function enviarMetaPurchase({ pedidoId, totalCentavos, cliente, itens = [], ip, userAgent }) {
  const pixelId = process.env.META_PIXEL_ID;
  const capiToken = process.env.META_CAPI_TOKEN;

  if (!pixelId || !capiToken) {
    return { skipped: true, reason: "META_PIXEL_ID ou META_CAPI_TOKEN ausente" };
  }

  const phoneDigits = cliente.whatsapp ? cliente.whatsapp.replace(/\D/g, "") : "";
  const phoneFormatted = phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`;
  const cpfDigits = cliente.cpf ? cliente.cpf.replace(/\D/g, "") : "";

  const userData = {
    em: cliente.email ? [sha256(cliente.email)] : [],
    ph: phoneDigits ? [sha256(phoneFormatted)] : [],
    external_id: [sha256(pedidoId)]
  };

  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;

  const eventPayload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: pedidoId, // Mesmo eventID do navegador para deduplicação
        action_source: "website",
        user_data: userData,
        custom_data: {
          currency: "BRL",
          value: Number((totalCentavos / 100).toFixed(2)),
          content_type: "product",
          contents: itens.map((item) => ({
            id: item.id || "tonia",
            quantity: item.quantidade || 1,
            item_price: Number(((item.precoUnitario || item.total || totalCentavos) / 100).toFixed(2))
          }))
        }
      }
    ]
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${capiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventPayload)
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Erro ao enviar Meta CAPI Purchase:", err.message);
    return { error: err.message };
  }
}

module.exports = {
  enviarMetaPurchase,
  sha256
};
