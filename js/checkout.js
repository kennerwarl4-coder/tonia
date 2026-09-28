/* =========================================================
   Checkout Transparente Pix SigiloPay - Loja Tônia
   ========================================================= */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => brl.format(v);

// Estado do Checkout
const checkoutState = {
  pedidoId: null,
  kit: "unidade",
  cores: ["lilas"],
  bumps: [],
  upsell: { aceito: false, cor: "rosa" },
  catalogo: {
    kits: {
      unidade: { nome: "1 Aparelho Tônia", preco: 6790, unidades: 1 },
      dupla: { nome: "Kit Dupla (2 Aparelhos)", preco: 11790, unidades: 2 }
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
        descricao: "Despacho prioritário em até 24h úteis e entrega expressa com rastreio VIP.",
        preco: 1990,
        tipo: "frete",
        img: "assets/entrega-express.webp"
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
    }
  },
  cliente: {
    nome: "",
    email: "",
    whatsapp: "",
    cpf: "",
    endereco: {
      cep: "",
      logradouro: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: ""
    }
  },
  pixGerado: null,
  pollInterval: null,
  timerInterval: null
};

/* =========================================================
   1. Inicialização & Catálogo
   ========================================================= */
async function initCheckout() {
  // 1. Gerar ou recuperar ID de idempotência
  let savedPedidoId = sessionStorage.getItem("tonia_pedido_id");
  if (!savedPedidoId) {
    savedPedidoId = `tonia_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    sessionStorage.setItem("tonia_pedido_id", savedPedidoId);
  }
  checkoutState.pedidoId = savedPedidoId;

  // 2. Carregar seleção da página de vendas
  const savedKit = sessionStorage.getItem("tonia_checkout_kit");
  const savedCores = sessionStorage.getItem("tonia_checkout_cores");
  if (savedKit) checkoutState.kit = savedKit;
  if (savedCores) {
    try { checkoutState.cores = JSON.parse(savedCores); } catch (e) {}
  }

  // 3. Tentar carregar catálogo da API
  try {
    const res = await fetch("/api/catalogo");
    if (res.ok) {
      const data = await res.json();
      checkoutState.catalogo = { ...checkoutState.catalogo, ...data };
    }
  } catch (e) {
    console.warn("Usando catálogo local em fallback.");
  }

  // 4. Configurar Meta Pixel InitiateCheckout
  dispararPixelInitiateCheckout();

  // 5. Configurar máscaras e listeners
  setupMasks();
  setupViaCep();
  setupAccordion();
  renderOrderBumps();
  updateSummary();
  setupMobileSummary();
  setupPixCopy();

}

/* =========================================================
   2. Meta Pixel & Rastreamento
   ========================================================= */
function dispararPixelInitiateCheckout() {
  // Guard: dispara no máximo 1x por sessão para evitar duplicatas
  if (!window.fbq || sessionStorage.getItem("tonia_fbq_initcheckout")) return;
  sessionStorage.setItem("tonia_fbq_initcheckout", "1");

  const kitInfo = checkoutState.catalogo.kits[checkoutState.kit] || checkoutState.catalogo.kits.unidade;
  const valor = kitInfo.preco / 100;

  window.fbq("track", "InitiateCheckout", {
    content_ids: [checkoutState.kit],
    content_name: kitInfo.nome,
    num_items: kitInfo.unidades || 1,
    value: valor,
    currency: "BRL"
  });
}

function dispararPixelAddPaymentInfo(totalCentavos) {
  if (window.fbq) {
    window.fbq("track", "AddPaymentInfo", {
      content_ids: [checkoutState.kit],
      value: totalCentavos / 100,
      currency: "BRL"
    });
  }
}

/* =========================================================
   3. Máscaras e Validações em Português
   ========================================================= */
function setupMasks() {
  // Máscara de Telefone: (00) 00000-0000 ou (00) 0000-0000
  const inputWa = $("#inputWhatsapp");
  if (inputWa) {
    inputWa.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 10) {
        v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
      } else if (v.length > 6) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
      } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
      } else if (v.length > 0) {
        v = v.replace(/^(\d{0,2})$/, "($1");
      }
      e.target.value = v;
    });
  }

  // Máscara de CPF: 000.000.000-00
  const inputCpf = $("#inputCpf");
  if (inputCpf) {
    inputCpf.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 9) {
        v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, "$1.$2.$3-$4");
      } else if (v.length > 6) {
        v = v.replace(/^(\d{3})(\d{3})(\d{0,3})$/, "$1.$2.$3");
      } else if (v.length > 3) {
        v = v.replace(/^(\d{3})(\d{0,3})$/, "$1.$2");
      }
      e.target.value = v;
    });
  }

  // Máscara de CEP: 00000-000
  const inputCep = $("#inputCep");
  if (inputCep) {
    inputCep.addEventListener("input", (e) => {
      let v = e.target.value.replace(/\D/g, "");
      if (v.length > 8) v = v.slice(0, 8);
      if (v.length > 5) {
        v = v.replace(/^(\d{5})(\d{1,3})$/, "$1-$2");
      }
      e.target.value = v;
    });
  }
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
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

/* =========================================================
   4. Busca de CEP (ViaCEP)
   ========================================================= */
function setupViaCep() {
  const inputCep = $("#inputCep");
  if (!inputCep) return;

  inputCep.addEventListener("blur", () => buscarCep(inputCep.value));
  inputCep.addEventListener("keyup", (e) => {
    const clean = e.target.value.replace(/\D/g, "");
    if (clean.length === 8) {
      buscarCep(clean);
    }
  });
}

async function buscarCep(cepVal) {
  const clean = cepVal.replace(/\D/g, "");
  if (clean.length !== 8) return;

  const helpEl = $("#cepHelp");
  if (helpEl) helpEl.textContent = "Buscando endereço...";

  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const data = await res.json();

    if (data.erro) {
      showFieldError("fieldCep", "errorCep", "CEP não encontrado. Preencha manualmente.");
      if (helpEl) helpEl.textContent = "Preenchimento automático do endereço.";
      return;
    }

    clearFieldError("fieldCep", "errorCep");
    if (helpEl) helpEl.textContent = "Endereço localizado com sucesso!";

    const inputRua = $("#inputRua");
    const inputBairro = $("#inputBairro");
    const inputCidade = $("#inputCidade");
    const inputUf = $("#inputUf");
    const inputNumero = $("#inputNumero");

    if (inputRua && data.logradouro) inputRua.value = data.logradouro;
    if (inputBairro && data.bairro) inputBairro.value = data.bairro;
    if (inputCidade && data.localidade) inputCidade.value = data.localidade;
    if (inputUf && data.uf) inputUf.value = data.uf;

    if (inputNumero) inputNumero.focus();
  } catch (err) {
    if (helpEl) helpEl.textContent = "Não foi possível buscar o CEP automaticamente.";
  }
}

function showFieldError(fieldId, errorId, msg) {
  const f = $(`#${fieldId}`);
  const err = $(`#${errorId}`);
  if (f) f.classList.add("has-error");
  if (err) {
    if (msg) err.textContent = msg;
    err.style.display = "block";
  }
}

function clearFieldError(fieldId, errorId) {
  const f = $(`#${fieldId}`);
  const err = $(`#${errorId}`);
  if (f) f.classList.remove("has-error");
  if (err) err.style.display = "none";
}

/* =========================================================
   5. Acordeão de Etapas
   ========================================================= */
function setupAccordion() {
  const form1 = $("#formStep1");
  const form2 = $("#formStep2");
  const form3 = $("#formStep3");

  // Validar Etapa 1
  if (form1) {
    form1.addEventListener("submit", (e) => {
      e.preventDefault();
      let hasError = false;

      const nome = $("#inputNome").value.trim();
      const email = $("#inputEmail").value.trim();
      const whatsapp = $("#inputWhatsapp").value.replace(/\D/g, "");
      const cpf = $("#inputCpf").value.replace(/\D/g, "");

      if (!nome || nome.length < 3) {
        showFieldError("fieldNome", "errorNome");
        hasError = true;
      } else {
        clearFieldError("fieldNome", "errorNome");
      }

      if (!validarEmail(email)) {
        showFieldError("fieldEmail", "errorEmail");
        hasError = true;
      } else {
        clearFieldError("fieldEmail", "errorEmail");
      }

      if (whatsapp.length < 10) {
        showFieldError("fieldWhatsapp", "errorWhatsapp");
        hasError = true;
      } else {
        clearFieldError("fieldWhatsapp", "errorWhatsapp");
      }

      if (!validarCPF(cpf)) {
        showFieldError("fieldCpf", "errorCpf");
        hasError = true;
      } else {
        clearFieldError("fieldCpf", "errorCpf");
      }

      if (hasError) return;

      // Salvar dados no estado
      checkoutState.cliente.nome = nome;
      checkoutState.cliente.email = email;
      checkoutState.cliente.whatsapp = whatsapp;
      checkoutState.cliente.cpf = cpf;

      // Concluir Etapa 1 e abrir Etapa 2
      irParaEtapa(2);
    });
  }

  // Validar Etapa 2
  if (form2) {
    form2.addEventListener("submit", (e) => {
      e.preventDefault();
      let hasError = false;

      const cep = $("#inputCep").value.replace(/\D/g, "");
      const rua = $("#inputRua").value.trim();
      const numero = $("#inputNumero").value.trim();
      const complemento = $("#inputComplemento").value.trim();
      const bairro = $("#inputBairro").value.trim();
      const cidade = $("#inputCidade").value.trim();
      const uf = $("#inputUf").value.trim().toUpperCase();

      if (cep.length !== 8) {
        showFieldError("fieldCep", "errorCep");
        hasError = true;
      } else {
        clearFieldError("fieldCep", "errorCep");
      }

      if (!rua) {
        showFieldError("fieldRua", "errorRua");
        hasError = true;
      } else {
        clearFieldError("fieldRua", "errorRua");
      }

      if (!numero) {
        showFieldError("fieldNumero", "errorNumero");
        hasError = true;
      } else {
        clearFieldError("fieldNumero", "errorNumero");
      }

      if (!bairro) {
        showFieldError("fieldBairro", "errorBairro");
        hasError = true;
      } else {
        clearFieldError("fieldBairro", "errorBairro");
      }

      if (!cidade) {
        showFieldError("fieldCidade", "errorCidade");
        hasError = true;
      } else {
        clearFieldError("fieldCidade", "errorCidade");
      }

      if (!uf || uf.length !== 2) {
        showFieldError("fieldUf", "errorUf");
        hasError = true;
      } else {
        clearFieldError("fieldUf", "errorUf");
      }

      if (hasError) return;

      // Salvar endereço no estado
      checkoutState.cliente.endereco = {
        cep,
        logradouro: rua,
        numero,
        complemento,
        bairro,
        cidade,
        uf
      };

      // Concluir Etapa 2 e abrir Etapa 3
      irParaEtapa(3);
    });
  }

  // Botões de Alterar
  $("#step1EditBtn")?.addEventListener("click", () => irParaEtapa(1));
  $("#step2EditBtn")?.addEventListener("click", () => irParaEtapa(2));

  // Submissão da Etapa 3 (Finalizar e Gerar Pix com Upsell intermediário)
  if (form3) {
    form3.addEventListener("submit", (e) => {
      e.preventDefault();
      const terms = $("#termsCheck");
      const errTerms = $("#errorTerms");

      if (!terms || !terms.checked) {
        if (errTerms) errTerms.style.display = "block";
        return;
      }
      if (errTerms) errTerms.style.display = "none";

      // Avaliar Upsell antes de chamar API de pedidos
      processarUpsellOuGerarPix();
    });
  }
}

function irParaEtapa(n) {
  const s1 = $("#step1");
  const s2 = $("#step2");
  const s3 = $("#step3");
  const btnEdit1 = $("#step1EditBtn");
  const btnEdit2 = $("#step2EditBtn");

  const ind1 = $("#stepIndicator1");
  const ind2 = $("#stepIndicator2");
  const ind3 = $("#stepIndicator3");
  const line1 = $("#stepperLine1");
  const line2 = $("#stepperLine2");

  [s1, s2, s3].forEach((el) => { if (el) el.classList.remove("is-active"); });
  [ind1, ind2, ind3].forEach((el) => { if (el) el.classList.remove("is-active", "is-completed"); });
  [line1, line2].forEach((el) => { if (el) el.classList.remove("is-completed"); });

  if (n === 1) {
    s1.classList.add("is-active");
    ind1?.classList.add("is-active");
  } else if (n === 2) {
    s1.classList.add("is-completed");
    if (btnEdit1) btnEdit1.hidden = false;
    s2.classList.add("is-active");
    ind1?.classList.add("is-completed");
    line1?.classList.add("is-completed");
    ind2?.classList.add("is-active");
  } else if (n === 3) {
    s1.classList.add("is-completed");
    s2.classList.add("is-completed");
    if (btnEdit1) btnEdit1.hidden = false;
    if (btnEdit2) btnEdit2.hidden = false;
    s3.classList.add("is-active");
    ind1?.classList.add("is-completed");
    line1?.classList.add("is-completed");
    ind2?.classList.add("is-completed");
    line2?.classList.add("is-completed");
    ind3?.classList.add("is-active");
  }
}

/* =========================================================
   6. Order Bumps & Resumo Dinâmico com Miniatura
   ========================================================= */
function renderOrderBumps() {
  const container = $("#bumpsContainer");
  if (!container) return;

  const bumpsAtivos = (checkoutState.catalogo.bumps || []).filter((b) => b.ativo);
  if (bumpsAtivos.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = bumpsAtivos.map((b) => {
    const isChecked = checkoutState.bumps.includes(b.id);
    const labelTexto = b.id === "prioritario"
      ? "Sim, quero receber mais rápido (+ R$ 19,90)"
      : `${b.nome} (+ ${fmt(b.preco / 100)})`;
    const imgSrc = b.img || (b.id === "prioritario" ? "assets/entrega-express.webp" : "");

    return `
      <label class="bump-card ${isChecked ? 'is-selected' : ''}" data-bump-id="${b.id}">
        <input type="checkbox" value="${b.id}" ${isChecked ? "checked" : ""}>
        ${imgSrc ? `<img src="${imgSrc}" alt="${b.nome}" class="bump-thumb">` : ""}
        <div class="bump-card__content">
          <div class="bump-card__head">
            <span class="bump-card__title">${labelTexto}</span>
            <span class="bump-card__price">+ ${fmt(b.preco / 100)}</span>
          </div>
          <p class="bump-card__desc">${b.descricao.replace("[CONFIRMAR] dia útil", "1 dia útil").replace("[CONFIRMAR transportadora/modalidade]", "Correios Sedex / Transportadora Expressa")}</p>
        </div>
      </label>
    `;
  }).join("");

  container.addEventListener("change", (e) => {
    if (e.target.tagName === "INPUT") {
      const bumpId = e.target.value;
      const card = e.target.closest(".bump-card");
      if (e.target.checked) {
        if (!checkoutState.bumps.includes(bumpId)) checkoutState.bumps.push(bumpId);
        card?.classList.add("is-selected");
      } else {
        checkoutState.bumps = checkoutState.bumps.filter((id) => id !== bumpId);
        card?.classList.remove("is-selected");
      }
      updateSummary();
    }
  });
}

function updateSummary() {
  const itemsContainer = $("#summaryItemsList");
  const subtotalEl = $("#summarySubtotal");
  const freteEl = $("#summaryFrete");
  const totalEl = $("#summaryTotal");
  const headerTotalEl = $("#summaryHeaderTotal");

  const kitInfo = checkoutState.catalogo.kits[checkoutState.kit] || checkoutState.catalogo.kits.unidade;
  const corPrimaria = checkoutState.cores[0] || "lilas";
  const coresNomes = checkoutState.cores.map((c) => checkoutState.catalogo.coresNomes[c] || c).join(" + ");
  const imgSrc = checkoutState.kit === "dupla" ? "assets/img/capa.webp" : `assets/img/produto-${corPrimaria}.webp`;

  let itemsHtml = `
    <div class="summary-item">
      <div class="summary-thumb-box">
        <img src="${imgSrc}" alt="${kitInfo.nome}">
      </div>
      <div class="summary-item__info">
        <strong class="summary-item__name">${kitInfo.nome}</strong>
        <span class="summary-item__qty">Qtd: 1 · Cor: ${coresNomes}</span>
      </div>
      <span class="summary-item__price">${fmt(kitInfo.preco / 100)}</span>
    </div>
  `;

  let subtotalCentavos = kitInfo.preco;
  let freteCentavos = 0;

  // Order Bumps
  for (const bumpId of checkoutState.bumps) {
    const bumpObj = checkoutState.catalogo.bumps.find((b) => b.id === bumpId && b.ativo);
    if (bumpObj) {
      if (bumpObj.tipo === "frete") {
        freteCentavos += bumpObj.preco;
      } else {
        subtotalCentavos += bumpObj.preco;
      }
      itemsHtml += `
        <div class="summary-item">
          <div class="summary-thumb-box" style="background:#F3E8FF;border-color:#DDD6FE;">
            <svg class="icon" width="24" height="24" style="color:var(--accent);"><use href="#i-truck"/></svg>
          </div>
          <div class="summary-item__info">
            <strong class="summary-item__name">${bumpObj.nome}</strong>
            <span class="summary-item__qty">Serviço Adicional</span>
          </div>
          <span class="summary-item__price">+ ${fmt(bumpObj.preco / 100)}</span>
        </div>
      `;
    }
  }

  // Upsell se aceito
  if (checkoutState.upsell.aceito) {
    const precoUpsell = checkoutState.catalogo.upsell.seUnidade.preco;
    subtotalCentavos += precoUpsell;
    const corUpsellNome = checkoutState.catalogo.coresNomes[checkoutState.upsell.cor] || checkoutState.upsell.cor;
    itemsHtml += `
      <div class="summary-item">
        <div class="summary-thumb-box">
          <img src="assets/img/produto-${checkoutState.upsell.cor}.webp" alt="2ª Unidade">
        </div>
        <div class="summary-item__info">
          <strong class="summary-item__name">2ª Unidade (Oferta Especial)</strong>
          <span class="summary-item__qty">Qtd: 1 · Cor: ${corUpsellNome}</span>
        </div>
        <span class="summary-item__price">+ ${fmt(precoUpsell / 100)}</span>
      </div>
    `;
  }

  const totalCentavos = subtotalCentavos + freteCentavos;

  if (itemsContainer) itemsContainer.innerHTML = itemsHtml;
  if (subtotalEl) subtotalEl.textContent = fmt(subtotalCentavos / 100);
  if (freteEl) {
    if (freteCentavos > 0) {
      freteEl.textContent = fmt(freteCentavos / 100);
      freteEl.className = "";
      freteEl.style.color = "var(--ink)";
    } else {
      freteEl.textContent = "Grátis";
      freteEl.className = "text-success";
      freteEl.style.color = "";
    }
  }
  if (totalEl) totalEl.textContent = fmt(totalCentavos / 100);
  if (headerTotalEl) headerTotalEl.textContent = fmt(totalCentavos / 100);
}

function setupMobileSummary() {
  const toggleBtn = $("#summaryToggleBtn");
  const summaryCard = $("#checkoutSummaryCard");
  if (toggleBtn && summaryCard) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = summaryCard.classList.contains("is-open");
      summaryCard.classList.toggle("is-open", !isOpen);
      toggleBtn.setAttribute("aria-expanded", !isOpen ? "true" : "false");
    });
  }
}

/* =========================================================
   7. Fluxo de Upsell Exclusivo
   ========================================================= */
function processarUpsellOuGerarPix() {
  const jaMostrouUpsell = sessionStorage.getItem("tonia_upsell_shown") === "true";

  // Só oferece upsell se for kit unidade e ainda não foi exibido nesta sessão
  if (!jaMostrouUpsell && checkoutState.kit === "unidade" && checkoutState.catalogo.upsell?.ativo) {
    abrirModalUpsell();
  } else {
    gerarCobrancaPix();
  }
}

function abrirModalUpsell() {
  const modal = $("#upsellModal");
  const colorListEl = $("#upsellColorList");
  const colorNameEl = $("#upsellColorName");
  const imgEl = $("#upsellImg");
  if (!modal) {
    gerarCobrancaPix();
    return;
  }

  // Predefinir cor diferente da cor 1 escolhida
  const corEscolhida = checkoutState.cores[0] || "lilas";
  const coresDisponiveis = checkoutState.catalogo.cores || ["lilas", "rosa", "azul"];
  const corSugerida = coresDisponiveis.find((c) => c !== corEscolhida) || "rosa";
  checkoutState.upsell.cor = corSugerida;

  if (colorNameEl) colorNameEl.textContent = checkoutState.catalogo.coresNomes[corSugerida] || corSugerida;
  if (imgEl) imgEl.src = `assets/img/produto-${corSugerida}.webp`;

  // Renderizar swatches de cor do upsell
  if (colorListEl) {
    const variantes = [
      { id: "lilas", nome: "Lilás", cor: "#B9A3E8" },
      { id: "rosa", nome: "Rosa", cor: "#F29BB8" },
      { id: "azul", nome: "Azul", cor: "#9DB4EE" }
    ];

    colorListEl.innerHTML = variantes.map((v) => `
      <label class="swatch">
        <input type="radio" name="upsellCor" value="${v.id}" ${v.id === corSugerida ? "checked" : ""}>
        <span style="--c:${v.cor}" title="${v.nome}"></span>
        <span class="swatch__name">${v.nome}</span>
      </label>
    `).join("");

    colorListEl.addEventListener("change", (e) => {
      checkoutState.upsell.cor = e.target.value;
      const v = variantes.find((x) => x.id === e.target.value);
      if (colorNameEl && v) colorNameEl.textContent = v.nome;
      if (imgEl && v) imgEl.src = `assets/img/produto-${v.id}.webp`;
    });
  }

  modal.hidden = false;

  // Listeners dos botões
  const btnAccept = $("#btnUpsellAccept");
  const btnDecline = $("#btnUpsellDecline");

  const aceitar = () => {
    modal.hidden = true;
    sessionStorage.setItem("tonia_upsell_shown", "true");
    checkoutState.upsell.aceito = true;
    updateSummary();
    gerarCobrancaPix();
  };

  const recusar = () => {
    modal.hidden = true;
    sessionStorage.setItem("tonia_upsell_shown", "true");
    checkoutState.upsell.aceito = false;
    updateSummary();
    gerarCobrancaPix();
  };

  if (btnAccept) btnAccept.onclick = aceitar;
  if (btnDecline) btnDecline.onclick = recusar;
}

/* =========================================================
   8. Geração do Pix e Tela de Pagamento
   ========================================================= */
async function gerarCobrancaPix() {
  const btnFinalizar = $("#btnFinalizar");
  if (btnFinalizar) {
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = "Gerando código Pix seguro...";
  }

  try {
    const payload = {
      pedidoId: checkoutState.pedidoId,
      cliente: checkoutState.cliente,
      kit: checkoutState.kit,
      cores: checkoutState.cores,
      bumps: checkoutState.bumps,
      upsell: checkoutState.upsell
    };

    const res = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Ocorreu um erro ao gerar o Pix. Verifique os dados.");
      if (btnFinalizar) {
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = "Finalizar e gerar Pix";
      }
      return;
    }

    checkoutState.pixGerado = data;

    // Disparar Pixel AddPaymentInfo
    dispararPixelAddPaymentInfo(data.total);

    // Exibir tela do Pix
    exibirTelaPix(data);
  } catch (err) {
    console.error("Erro na requisição de pedidos:", err);
    alert("Falha de conexão ao gerar o Pix. Tente novamente.");
    if (btnFinalizar) {
      btnFinalizar.disabled = false;
      btnFinalizar.textContent = "Finalizar e gerar Pix";
    }
  }
}

function exibirTelaPix(data) {
  // Esconder formulário e mostrar tela do Pix
  const formWrap = $("#checkoutFormWrap");
  const pixWrap = $("#pixScreenWrap");
  if (formWrap) formWrap.hidden = true;
  if (pixWrap) pixWrap.hidden = false;

  // Esconder topo (título, stepper e resumo do pedido) para não distrair o cliente
  const topHeader = $(".checkout-top-header");
  const summaryWrap = $(".checkout-top-summary-wrap");
  if (topHeader) topHeader.style.display = "none";
  if (summaryWrap) summaryWrap.style.display = "none";

  // Atualizar valores
  const totalEl = $("#pixTotalVal");
  if (totalEl) totalEl.textContent = fmt(data.total / 100);

  const qrImg = $("#pixQrImg");
  if (qrImg) qrImg.src = data.qrCodeUrl;

  const copiaInput = $("#pixCopiaInput");
  if (copiaInput) copiaInput.value = data.copiaECola;

  // Iniciar contagem regressiva de expiração
  iniciarContadorExpiracao(data.expiraEm);

  // Iniciar polling de status a cada 5 segundos
  iniciarPollingStatus(data.id);

  // Rolar para o topo da página (tela do Pix)
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setupPixCopy() {
  const btn = $("#btnCopiarPix");
  const label = $("#btnCopiarLabel");
  const input = $("#pixCopiaInput");

  if (!btn || !input) return;

  btn.addEventListener("click", () => {
    if (!input.value) return;
    navigator.clipboard.writeText(input.value).then(() => {
      if (label) label.textContent = "Copiado com sucesso! ✅";
      btn.style.background = "var(--success)";
      setTimeout(() => {
        if (label) label.textContent = "Copiar código Pix";
        btn.style.background = "";
      }, 3000);
    }).catch(() => {
      input.select();
      document.execCommand("copy");
      if (label) label.textContent = "Copiado!";
    });
  });
}

function iniciarContadorExpiracao(expiraEmIso) {
  const timerEl = $("#pixTimer");
  const btnNovo = $("#btnGerarNovoPix");
  if (!timerEl) return;

  if (checkoutState.timerInterval) clearInterval(checkoutState.timerInterval);

  const targetTime = new Date(expiraEmIso).getTime();

  checkoutState.timerInterval = setInterval(() => {
    const diff = targetTime - Date.now();
    if (diff <= 0) {
      clearInterval(checkoutState.timerInterval);
      timerEl.textContent = "Expirado";
      if (btnNovo) {
        btnNovo.hidden = false;
        btnNovo.onclick = () => {
          sessionStorage.removeItem("tonia_pedido_id");
          checkoutState.pedidoId = `tonia_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          sessionStorage.setItem("tonia_pedido_id", checkoutState.pedidoId);
          gerarCobrancaPix();
        };
      }
      return;
    }

    const min = Math.floor(diff / 60000);
    const sec = Math.floor((diff % 60000) / 1000);
    timerEl.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }, 1000);
}

/* =========================================================
   9. Polling de Status & Redirecionamento
   ========================================================= */
function iniciarPollingStatus(pedidoId) {
  if (checkoutState.pollInterval) clearInterval(checkoutState.pollInterval);

  const startTime = Date.now();
  const maxDuration = 30 * 60 * 1000; // 30 minutos

  checkoutState.pollInterval = setInterval(async () => {
    if (Date.now() - startTime > maxDuration) {
      clearInterval(checkoutState.pollInterval);
      return;
    }

    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "pago") {
          clearInterval(checkoutState.pollInterval);
          if (checkoutState.timerInterval) clearInterval(checkoutState.timerInterval);

          // Salvar resumo para página de obrigado
          sessionStorage.setItem("tonia_ultimo_pedido", JSON.stringify({
            id: pedidoId,
            cliente: checkoutState.cliente,
            itens: checkoutState.pixGerado?.itens || [],
            total: checkoutState.pixGerado?.total,
            envio: checkoutState.pixGerado?.envio || "padrao"
          }));

          // Redirecionar para página de obrigado com o ID
          window.location.href = `obrigado.html?id=${pedidoId}`;
        }
      }
    } catch (e) {
      // Ignora falhas pontuais de conexão no polling
    }
  }, 5000);
}

/* =========================================================
   10. Simulação de Pagamento (Modo de Teste)
   ========================================================= */
async function simularPagamento() {
  const btn = $("#btnSimularPagamento");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Processando simulação...";
  }

  try {
    const res = await fetch("/api/simular-pagamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedidoId: checkoutState.pedidoId })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      sessionStorage.setItem("tonia_ultimo_pedido", JSON.stringify({
        id: checkoutState.pedidoId,
        cliente: checkoutState.cliente,
        itens: checkoutState.pixGerado?.itens || [],
        total: checkoutState.pixGerado?.total,
        envio: checkoutState.pixGerado?.envio || "padrao"
      }));
      window.location.href = `obrigado.html?id=${checkoutState.pedidoId}`;
    } else {
      alert("Erro ao simular: " + (data.error || "Tente novamente"));
      if (btn) {
        btn.disabled = false;
        btn.textContent = "⚡ Simular Pagamento Aprovado";
      }
    }
  } catch (err) {
    alert("Erro na simulação: " + err.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = "⚡ Simular Pagamento Aprovado";
    }
  }
}

// Iniciar ao carregar DOM
document.addEventListener("DOMContentLoaded", initCheckout);
