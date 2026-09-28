const SIGILOPAY_BASE_URL = process.env.SIGILOPAY_BASE_URL || "https://app.sigilopay.com.br/api/v1";

/**
 * Adaptador oficial da SigiloPay com suporte a Modo de Teste e Produção.
 */
class SigiloPayAdapter {
  constructor() {
    this.publicKey = process.env.SIGILOPAY_PUBLIC_KEY || process.env.SIGILOPAY_API_KEY || "aristocrata-black_0pzb5olxerkw1e4r";
    this.secretKey = process.env.SIGILOPAY_SECRET_KEY || process.env.SIGILOPAY_PRIVATE_KEY || "a246am3u4rtqxfnjnnjszpzaqcybcknw6xei3xez7kbrpas0f4a2snzjq1sar4vu";
    this.isTestMode = process.env.MODO_TESTE === "true" || (!process.env.SIGILOPAY_PUBLIC_KEY && process.env.NODE_ENV === "development");
  }

  /**
   * Cria uma cobrança Pix na SigiloPay ou simula em modo de teste.
   * @param {Object} params
   * @param {number} params.valorCentavos - Valor total em centavos
   * @param {string} params.pedidoId - Identificador único da transação
   * @param {Object} params.cliente - { nome, email, whatsapp, cpf }
   * @param {Array} [params.itens] - Lista de itens comprados
   * @param {string} [params.callbackUrl] - URL do webhook
   * @param {Object} [params.metadata] - Metadados adicionais
   * @returns {Promise<{ txid: string, qrCodeBase64: string, qrCodeUrl: string, copiaECola: string, expiraEm: string, webhookToken: string }>}
   */
  async criarCobrancaPix({ valorCentavos, pedidoId, cliente, itens = [], callbackUrl, metadata = {} }) {
    const valorReais = Number((valorCentavos / 100).toFixed(2));

    // Se estiver em modo teste explícito ou sem credenciais
    if (process.env.MODO_TESTE === "true") {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const mockTxid = `test_${pedidoId}_${Date.now()}`;
      const mockCopiaECola = `00020101021226840014br.gov.bcb.pix2562sigilopay.com.br/pix/${mockTxid}520400005303986540${valorReais.toFixed(2)}5802BR5915LOJA TONIA6009SAO PAULO62070503***6304TEST`;
      const mockQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(mockCopiaECola)}`;

      return {
        txid: mockTxid,
        qrCodeBase64: "",
        qrCodeUrl: mockQrUrl,
        copiaECola: mockCopiaECola,
        expiraEm: expiresAt,
        webhookToken: `token_test_${pedidoId}`
      };
    }

    // Montagem do payload conforme documentação SigiloPay
    // SigiloPay exige dueDate MAIOR que a data atual — usamos +2 dias para segurança
    const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const productsPayload = (itens || []).map((item, idx) => ({
      id: item.id || `item_${idx + 1}`,
      name: item.nome || "Aparelho Tônia",
      quantity: item.quantidade || 1,
      price: Number(((item.precoUnitario || item.total || valorCentavos) / 100).toFixed(2))
    }));

    const cleanPhone = (cliente.whatsapp || cliente.phone || "").replace(/\D/g, "");
    const cleanDoc = (cliente.cpf || cliente.document || "").replace(/\D/g, "");

    const body = {
      identifier: pedidoId,
      amount: valorReais,
      client: {
        name: cliente.nome || cliente.name,
        email: cliente.email,
        phone: cleanPhone,
        document: cleanDoc
      },
      products: productsPayload.length > 0 ? productsPayload : [
        { id: "tonia-prod", name: "Aparelho Tônia", quantity: 1, price: valorReais }
      ],
      dueDate,
      metadata: {
        orderId: pedidoId,
        provider: "ToniaStore",
        ...metadata
      }
    };

    if (callbackUrl || process.env.WEBHOOK_CALLBACK_URL) {
      body.callbackUrl = callbackUrl || process.env.WEBHOOK_CALLBACK_URL;
    }

    const res = await fetch(`${SIGILOPAY_BASE_URL}/gateway/pix/receive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-public-key": this.publicKey,
        "x-secret-key": this.secretKey
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok || (data.status && data.status === "FAILED")) {
      const errMsg = data.message || data.errorDescription || data.errorCode || "Erro ao gerar Pix na SigiloPay";
      throw new Error(errMsg);
    }

    const pixData = data.pix || {};
    const expiraEm = pixData.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const copiaECola = pixData.code || "";
    const qrCodeUrl = pixData.image || (copiaECola ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(copiaECola)}` : "");

    return {
      txid: data.transactionId || data.identifier || pedidoId,
      qrCodeBase64: pixData.base64 || "",
      qrCodeUrl: qrCodeUrl,
      copiaECola: copiaECola,
      expiraEm: expiraEm,
      webhookToken: data.webhookToken || ""
    };
  }

  /**
   * Valida se a notificação do webhook é autêntica.
   * @param {Object} payload - Corpo da requisição do webhook
   * @param {Object} [pedido] - Dados do pedido salvo no banco
   * @returns {boolean}
   */
  validarWebhook(payload, pedido) {
    if (!payload || !payload.event) return false;

    // Em modo de teste aceita webhook local
    if (process.env.MODO_TESTE === "true") {
      return true;
    }

    // Se o pedido tiver webhook_token salvo, compara com o token recebido
    if (pedido && pedido.webhook_token && payload.token) {
      if (pedido.webhook_token === payload.token) {
        return true;
      }
    }

    // Se houver SIGILOPAY_WEBHOOK_SECRET configurado
    if (process.env.SIGILOPAY_WEBHOOK_SECRET && payload.token) {
      return payload.token === process.env.SIGILOPAY_WEBHOOK_SECRET;
    }

    // Validação padrão pela estrutura
    return Boolean(payload.event && payload.transaction);
  }

  /**
   * Consulta o status de uma cobrança na SigiloPay se necessário (reconciliação).
   * @param {string} txid
   */
  async consultarCobranca(txid) {
    if (process.env.MODO_TESTE === "true") {
      return { status: "PENDING" };
    }

    const res = await fetch(`${SIGILOPAY_BASE_URL}/gateway/transactions/${txid}`, {
      method: "GET",
      headers: {
        "x-public-key": this.publicKey,
        "x-secret-key": this.secretKey
      }
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  }
}

module.exports = new SigiloPayAdapter();
