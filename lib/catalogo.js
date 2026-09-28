const catalogo = {
  kits: {
    unidade: { nome: "1 Aparelho Tônia", preco: 6790, unidades: 1 }, // centavos (R$ 67,90)
    dupla: { nome: "Kit Dupla (2 Aparelhos)", preco: 11790, unidades: 2 } // centavos (R$ 117,90)
  },
  cores: ["lilas", "rosa", "azul"],
  coresNomes: {
    lilas: "Lilás Suave",
    rosa: "Rosa Quartzo",
    azul: "Azul Céu"
  },
  bumps: [
    {
      id: "prioritario",
      ativo: true,
      nome: "Envio prioritário",
      descricao: "Despacho prioritário em até 24h e envio expresso com código de rastreio VIP.",
      preco: 1990,
      tipo: "frete",
      img: "assets/entrega-express.png"
    },
    {
      id: "bump2",
      ativo: false, // ligar quando o produto for definido
      nome: "[DEFINIR]",
      descricao: "[DEFINIR]",
      preco: null,
      tipo: "produto",
      img: null
    }
  ],
  upsell: {
    ativo: true,
    seUnidade: {
      titulo: "Espera! Leve a 2ª unidade em outra cor por R$ 39,90",
      texto: "Uma pra você e outra pra presentear, no mesmo pacote e sem frete extra. Essa oferta aparece só agora.",
      preco: 3990,
      exigeCor: true
    },
    seDupla: { usarBump2ComDesconto: true, desconto: 0.2 }
  },
  prazos: {
    padrao: "[CONFIRMAR] dias úteis",
    prioritario: "[CONFIRMAR] dias úteis"
  }
};

/**
 * Recalcula o total estritamente no servidor a partir do catálogo.
 * @param {Object} params
 * @param {string} params.kit - "unidade" | "dupla"
 * @param {Array<string>} params.cores - ["lilas"] ou ["lilas", "rosa"]
 * @param {Array<string>} params.bumps - IDs dos bumps selecionados
 * @param {Object} [params.upsell] - { aceito: boolean, cor?: string }
 * @returns {{ subtotal: number, total: number, frete: number, itens: Array, envio: string }}
 */
function calcularPedido(params) {
  const kitInfo = catalogo.kits[params.kit];
  if (!kitInfo) {
    throw new Error(`Kit inválido: ${params.kit}`);
  }

  let subtotal = kitInfo.preco;
  let frete = 0;
  let envio = "padrao";
  const itens = [];

  // Item principal
  itens.push({
    tipo: "kit",
    id: params.kit,
    nome: kitInfo.nome,
    quantidade: kitInfo.unidades,
    cores: params.cores || [],
    precoUnitario: kitInfo.preco,
    total: kitInfo.preco
  });

  // Order Bumps
  const bumpsMarcados = params.bumps || [];
  for (const bumpId of bumpsMarcados) {
    const bumpObj = catalogo.bumps.find((b) => b.id === bumpId && b.ativo);
    if (bumpObj && bumpObj.preco) {
      if (bumpObj.tipo === "frete") {
        frete += bumpObj.preco;
        envio = "prioritario";
      } else {
        subtotal += bumpObj.preco;
      }
      itens.push({
        tipo: "bump",
        id: bumpObj.id,
        nome: bumpObj.nome,
        quantidade: 1,
        precoUnitario: bumpObj.preco,
        total: bumpObj.preco
      });
    }
  }

  // Upsell
  if (params.upsell && params.upsell.aceito) {
    if (params.kit === "unidade" && catalogo.upsell.ativo && catalogo.upsell.seUnidade) {
      const precoUpsell = catalogo.upsell.seUnidade.preco;
      subtotal += precoUpsell;
      itens.push({
        tipo: "upsell",
        id: "upsell-segunda-unidade",
        nome: "2ª Unidade com Desconto Exclusivo",
        quantidade: 1,
        cor: params.upsell.cor || "rosa",
        precoUnitario: precoUpsell,
        total: precoUpsell
      });
    } else if (params.kit === "dupla" && catalogo.upsell.ativo && catalogo.upsell.seDupla && catalogo.upsell.seDupla.usarBump2ComDesconto) {
      const bump2 = catalogo.bumps.find((b) => b.id === "bump2" && b.ativo);
      if (bump2 && bump2.preco && !bumpsMarcados.includes("bump2")) {
        const precoComDesconto = Math.round(bump2.preco * (1 - catalogo.upsell.seDupla.desconto));
        subtotal += precoComDesconto;
        itens.push({
          tipo: "upsell",
          id: "upsell-bump2",
          nome: `${bump2.nome} (Desconto de Upsell)`,
          quantidade: 1,
          precoUnitario: precoComDesconto,
          total: precoComDesconto
        });
      }
    }
  }

  const total = subtotal + frete;

  return {
    subtotal,
    frete,
    total,
    envio,
    itens
  };
}

module.exports = {
  ...catalogo,
  calcularPedido
};
