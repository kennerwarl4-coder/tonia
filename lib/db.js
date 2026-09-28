const { createClient } = require("@supabase/supabase-js");

// Armazenamento em memória / fallback para desenvolvimento ou quando Supabase não estiver configurado
const memoryStore = new Map();

class Database {
  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.isUsingSupabase = true;
    } else {
      this.supabase = null;
      this.isUsingSupabase = false;
    }
  }

  /**
   * Busca um pedido pelo ID (UUID).
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async buscarPedidoPorId(id) {
    if (this.isUsingSupabase && this.supabase) {
      const { data, error } = await this.supabase
        .from("pedidos")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) return null;
      return data;
    }

    return memoryStore.get(id) || null;
  }

  /**
   * Busca um pedido pelo txid ou identifier.
   * @param {string} txid
   * @returns {Promise<Object|null>}
   */
  async buscarPedidoPorTxid(txid) {
    if (this.isUsingSupabase && this.supabase) {
      const { data, error } = await this.supabase
        .from("pedidos")
        .select("*")
        .eq("txid", txid)
        .single();

      if (error || !data) return null;
      return data;
    }

    for (const pedido of memoryStore.values()) {
      if (pedido.txid === txid || pedido.id === txid) {
        return pedido;
      }
    }
    return null;
  }

  /**
   * Salva um novo pedido no banco de dados.
   * @param {Object} pedido
   * @returns {Promise<Object>}
   */
  async salvarPedido(pedido) {
    const payload = {
      id: pedido.id,
      criado_em: pedido.criado_em || new Date().toISOString(),
      status: pedido.status || "aguardando_pagamento",
      cliente: pedido.cliente,
      itens: pedido.itens,
      subtotal: pedido.subtotal,
      total: pedido.total,
      envio: pedido.envio || "padrao",
      txid: pedido.txid,
      copia_e_cola: pedido.copia_e_cola,
      expira_em: pedido.expira_em,
      pago_em: pedido.pago_em || null,
      webhook_token: pedido.webhook_token || null,
      metadata: pedido.metadata || {}
    };

    if (this.isUsingSupabase && this.supabase) {
      const { data, error } = await this.supabase
        .from("pedidos")
        .upsert(payload)
        .select()
        .single();

      if (error) {
        console.error("Erro ao salvar no Supabase, usando fallback:", error.message);
        memoryStore.set(payload.id, payload);
        return payload;
      }
      return data;
    }

    memoryStore.set(payload.id, payload);
    return payload;
  }

  /**
   * Atualiza o status do pedido (ex: para 'pago').
   * @param {string} id
   * @param {string} status
   * @param {Object} [extra]
   * @returns {Promise<Object|null>}
   */
  async atualizarStatusPedido(id, status, extra = {}) {
    const updateData = {
      status,
      ...extra
    };

    if (this.isUsingSupabase && this.supabase) {
      const { data, error } = await this.supabase
        .from("pedidos")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Erro ao atualizar no Supabase:", error.message);
      } else if (data) {
        memoryStore.set(id, data);
        return data;
      }
    }

    const pedido = memoryStore.get(id);
    if (pedido) {
      const atualizado = { ...pedido, ...updateData };
      memoryStore.set(id, atualizado);
      return atualizado;
    }

    return null;
  }
}

module.exports = new Database();
