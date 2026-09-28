const { v4: uuidv4 } = require("uuid");
const catalogo = require("../../lib/catalogo");
const sigilopay = require("../../lib/sigilopay");
const db = require("../../lib/db");

// Simple rate limiter: max 5 requests per IP per 10 minutes (600_000 ms)
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  if (!ip) return true;
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const maxReqs = 10; // 10 para dar margem a testes

  const userRecord = rateLimitMap.get(ip) || { count: 0, startTime: now };
  if (now - userRecord.startTime > windowMs) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
    return true;
  }

  if (userRecord.count >= maxReqs) {
    return false;
  }

  userRecord.count += 1;
  rateLimitMap.set(ip, userRecord);
  return true;
}

function validarCPF(cpf) {
  if (!cpf) return false;
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(clean.charAt(i), 10) * (10 - i);
  let rest = 11 - (sum % 11);
  const dig1 = rest === 10 || rest === 11 ? 0 : rest;
  if (dig1 !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(clean.charAt(i), 10) * (11 - i);
  rest = 11 - (sum % 11);
  const dig2 = rest === 10 || rest === 11 ? 0 : rest;
  return dig2 === parseInt(clean.charAt(10), 10);
}

function validarEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validarTelefone(tel) {
  const digits = String(tel || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
}

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

  const clientIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1";
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: "Muitas tentativas. Por favor, aguarde alguns minutos." });
  }

  try {
    const { pedidoId: frontPedidoId, cliente, kit, cores, bumps, upsell, metadata } = req.body || {};

    // 1. Validação de dados do cliente
    if (!cliente) {
      return res.status(400).json({ error: "Dados do cliente são obrigatórios." });
    }

    if (!cliente.nome || cliente.nome.trim().length < 3) {
      return res.status(400).json({ error: "Nome completo é obrigatório." });
    }

    if (!validarEmail(cliente.email)) {
      return res.status(400).json({ error: "E-mail inválido." });
    }

    if (!validarTelefone(cliente.whatsapp)) {
      return res.status(400).json({ error: "WhatsApp inválido. Informe DDD + número." });
    }

    if (!validarCPF(cliente.cpf)) {
      return res.status(400).json({ error: "CPF inválido." });
    }

    // 2. Validação de endereço
    const end = cliente.endereco || {};
    const cepClean = String(end.cep || "").replace(/\D/g, "");
    if (cepClean.length !== 8) {
      return res.status(400).json({ error: "CEP inválido." });
    }
    if (!end.logradouro || !end.numero || !end.bairro || !end.cidade || !end.uf) {
      return res.status(400).json({ error: "Endereço de entrega incompleto." });
    }

    // 3. Validação do catálogo & Recálculo estrito no servidor
    if (!kit || !catalogo.kits[kit]) {
      return res.status(400).json({ error: "Kit selecionado é inválido." });
    }

    const calculo = catalogo.calcularPedido({
      kit,
      cores,
      bumps,
      upsell
    });

    const pedidoId = frontPedidoId || (uuidv4 ? uuidv4() : `tonia_${Date.now()}`);

    // 4. Idempotência: verificar se pedido já existe
    const pedidoExistente = await db.buscarPedidoPorId(pedidoId);
    if (pedidoExistente) {
      const expiraEmDate = new Date(pedidoExistente.expira_em);
      const aindaValido = expiraEmDate.getTime() > Date.now();

      if (pedidoExistente.status === "aguardando_pagamento" && aindaValido && pedidoExistente.copia_e_cola) {
        return res.status(200).json({
          id: pedidoExistente.id,
          status: pedidoExistente.status,
          total: pedidoExistente.total,
          subtotal: pedidoExistente.subtotal,
          frete: pedidoExistente.total - pedidoExistente.subtotal,
          copiaECola: pedidoExistente.copia_e_cola,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pedidoExistente.copia_e_cola)}`,
          expiraEm: pedidoExistente.expira_em,
          envio: pedidoExistente.envio,
          itens: pedidoExistente.itens
        });
      }
    }

    // 5. Criar cobrança Pix na SigiloPay (ou simulada em modo teste)
    const host = req.headers.host;
    const protocol = host?.includes("localhost") ? "http" : "https";
    const callbackUrl = process.env.WEBHOOK_CALLBACK_URL || (host ? `${protocol}://${host}/api/webhook-sigilopay` : undefined);

    const cobranca = await sigilopay.criarCobrancaPix({
      valorCentavos: calculo.total,
      pedidoId,
      cliente,
      itens: calculo.itens,
      callbackUrl,
      metadata: {
        ...metadata,
        envio: calculo.envio,
        origem: "checkout-tonia"
      }
    });

    // 6. Gravar o pedido no banco de dados
    const novoPedido = {
      id: pedidoId,
      criado_em: new Date().toISOString(),
      status: "aguardando_pagamento",
      cliente: {
        nome: cliente.nome.trim(),
        email: cliente.email.trim().toLowerCase(),
        whatsapp: cliente.whatsapp.replace(/\D/g, ""),
        cpf: cliente.cpf.replace(/\D/g, ""),
        endereco: {
          cep: cepClean,
          logradouro: end.logradouro.trim(),
          numero: end.numero.trim(),
          complemento: (end.complemento || "").trim(),
          bairro: end.bairro.trim(),
          cidade: end.cidade.trim(),
          uf: end.uf.trim().toUpperCase()
        }
      },
      itens: calculo.itens,
      subtotal: calculo.subtotal,
      total: calculo.total,
      envio: calculo.envio,
      txid: cobranca.txid,
      copia_e_cola: cobranca.copiaECola,
      expira_em: cobranca.expiraEm,
      webhook_token: cobranca.webhookToken,
      metadata: metadata || {}
    };

    await db.salvarPedido(novoPedido);

    // 7. Disparar Webhook de Automação (recuperação de Pix no WhatsApp)
    if (process.env.WEBHOOK_AUTOMACAO_URL) {
      fetch(process.env.WEBHOOK_AUTOMACAO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento: "pix_gerado",
          pedido: novoPedido,
          copiaECola: cobranca.copiaECola,
          expiraEm: cobranca.expiraEm
        })
      }).catch((err) => console.error("Erro webhook automacao pix_gerado:", err.message));
    }

    return res.status(201).json({
      id: pedidoId,
      status: "aguardando_pagamento",
      total: calculo.total,
      subtotal: calculo.subtotal,
      frete: calculo.frete,
      envio: calculo.envio,
      itens: calculo.itens,
      copiaECola: cobranca.copiaECola,
      qrCodeUrl: cobranca.qrCodeUrl,
      qrCodeBase64: cobranca.qrCodeBase64,
      expiraEm: cobranca.expiraEm
    });
  } catch (err) {
    console.error("Erro ao processar pedido:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao processar pedido." });
  }
};
