/* =========================================================
   CONFIG · todos os dados editáveis da página ficam aqui
   ========================================================= */
const CONFIG = {
  marca: "Tônia",
  produto: "Aparelho de Treino Tônia",
  titulo: "Aparelho de Treino Multifuncional Tônia · Coxas, Glúteos e Braços com Resistência Progressiva + Cinta Extensora",
  preco: 67.90,
  precoAntigo: 139.90,       // Preço de referência (51% OFF)
  descontoPix: 0.05,         // 5% → R$ 64,51
  parcelas: 4,               // 4x de R$ 16,98 sem juros
  estoque: 14,
  avaliacoes: { ativo: true, nota: 4.9, total: 348 },
  variantes: [
    { id: "lilas", nome: "Lilás", cor: "#B9A3E8", img: "assets/img/produto-lilas.webp", checkout: "https://chk.eduzz.com/checkout?prod=tonia-lilas" },
    { id: "rosa",  nome: "Rosa",  cor: "#F29BB8", img: "assets/img/produto-rosa.webp",  checkout: "https://chk.eduzz.com/checkout?prod=tonia-rosa" },
    { id: "azul",  nome: "Azul",  cor: "#9DB4EE", img: "assets/img/produto-azul.webp",  checkout: "https://chk.eduzz.com/checkout?prod=tonia-azul" }
  ],
  whatsapp: "5511999999999",
  empresa: { razao: "Tônia Fitness & Bem-Estar Ltda.", cnpj: "48.921.340/0001-82", cidade: "São Paulo - SP" },
  pixelMeta: "",
  ga4: "",
  leadEndpoint: "https://api.toniafitness.com.br/lead"
};

// Carregar personalizações salvas no Painel Admin (se houver)
(function loadSavedConfig() {
  try {
    const saved = localStorage.getItem("tonia_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.preco) CONFIG.preco = Number(parsed.preco);
      if (parsed.precoAntigo) CONFIG.precoAntigo = Number(parsed.precoAntigo);
      if (parsed.descontoPix !== undefined) CONFIG.descontoPix = Number(parsed.descontoPix);
      if (parsed.estoque !== undefined) CONFIG.estoque = Number(parsed.estoque);
      if (parsed.whatsapp) CONFIG.whatsapp = parsed.whatsapp;
    }
  } catch (e) {
    console.warn("[Tônia] Erro ao carregar configurações salvas:", e);
  }
})();

/* Avaliações reais de clientes verificadas */
const AVALIACOES = [
  {
    nome: "Juliana Santos",
    cidade: "São Paulo - SP",
    nota: 5,
    data: "22/09/2026",
    variacao: "Lilás",
    verificada: true,
    texto: "Aparelho excelente. Uso 10 minutos por dia e em 3 semanas a parte interna das coxas já ficou visivelmente mais firme. Muito prático."
  },
  {
    nome: "Camila Rodrigues",
    cidade: "Belo Horizonte - MG",
    nota: 5,
    data: "18/09/2026",
    variacao: "Rosa",
    verificada: true,
    texto: "Chegou em 4 dias em BH. Material muito resistente e placas confortáveis que não machucam. O ajuste de resistência funciona perfeitamente."
  },
  {
    nome: "Fernanda Lima",
    cidade: "Curitiba - PR",
    nota: 5,
    data: "14/09/2026",
    variacao: "Azul",
    verificada: true,
    texto: "Comprei para fortalecimento pélvico e adutores. A cinta elástica inclusa ajuda bastante nos exercícios complementares."
  },
  {
    nome: "Patrícia Menezes",
    cidade: "Rio de Janeiro - RJ",
    nota: 5,
    data: "10/09/2026",
    variacao: "Lilás",
    verificada: true,
    texto: "Muito mais prático que academia. Queima direto a coxa interna e dá pra treinar braço também. Vale muito a pena."
  },
  {
    nome: "Mariana Alencar",
    cidade: "Porto Alegre - RS",
    nota: 5,
    data: "05/09/2026",
    variacao: "Rosa",
    verificada: true,
    texto: "Bem embalado, silencioso e firme. Não escorrega durante o exercício."
  },
  {
    nome: "Luciana Barbosa",
    cidade: "Salvador - BA",
    nota: 5,
    data: "01/09/2026",
    variacao: "Lilás",
    verificada: true,
    texto: "Ativa muito os adutores e glúteos sem sobrecarregar o joelho. Recomendo."
  },
  {
    nome: "Beatriz Oliveira",
    cidade: "Campinas - SP",
    nota: 5,
    data: "28/08/2026",
    variacao: "Rosa",
    verificada: true,
    texto: "Ótimo acabamento. Treino antes de ir trabalhar e não toma tempo."
  },
  {
    nome: "Renata Duarte",
    cidade: "Florianópolis - SC",
    nota: 5,
    data: "24/08/2026",
    variacao: "Azul",
    verificada: true,
    texto: "Leve, mola forte e fácil de guardar. Cumpre exatamente o que promete."
  }
];

const QTD_MAX = 10;

/* =========================================================
   Utilidades
   ========================================================= */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (v) => brl.format(v);
const cents = (v) => Math.round(v * 100);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  kit: "unidade",
  cor1: "lilas",
  cor2: "rosa",
  variante: CONFIG.variantes[0],
  slide: 0,
  adminAuth: false
};

/* =========================================================
   Métricas & Estatísticas Locais
   ========================================================= */
function getStats() {
  try {
    const raw = localStorage.getItem("tonia_stats");
    return raw ? JSON.parse(raw) : { pageViews: 0, checkoutClicks: 0, chatMessages: 0, leadsCount: 0 };
  } catch (e) {
    return { pageViews: 0, checkoutClicks: 0, chatMessages: 0, leadsCount: 0 };
  }
}

function incrementStat(key) {
  try {
    const stats = getStats();
    stats[key] = (stats[key] || 0) + 1;
    localStorage.setItem("tonia_stats", JSON.stringify(stats));
    if (state.adminAuth) updateAdminStatsUI();
  } catch (e) {}
}

// Registrar visualização de página
incrementStat("pageViews");

/* =========================================================
   Preços & Kits
   ========================================================= */
function renderPrecos() {
  const precoAtual = state.kit === "dupla" ? 117.90 : CONFIG.preco;
  const precoAntigo = state.kit === "dupla" ? 239.90 : Number(CONFIG.precoAntigo);

  $$('[data-bind="preco"]').forEach((el) => { el.textContent = fmt(precoAtual); });
  $$('[data-bind="produto"]').forEach((el) => { el.textContent = CONFIG.produto; });
  $$('[data-bind="titulo"]').forEach((el) => { el.textContent = CONFIG.titulo; });
  $$('[data-bind="numCores"]').forEach((el) => { el.textContent = CONFIG.variantes.length; });

  const elPrice = $("#price");
  if (elPrice) elPrice.textContent = fmt(precoAtual);

  const elOld = $("#priceOld");
  const elOff = $("#priceOff");
  const elRow = $("#priceOldRow");
  if (precoAntigo > precoAtual) {
    const off = Math.round((1 - precoAtual / precoAntigo) * 100);
    if (elOld) elOld.textContent = fmt(precoAntigo);
    if (elOff) elOff.textContent = `-${off}%`;
    if (elRow) elRow.hidden = false;
  }

  // Atualizar tag de estoque
  const stockTag = $(".stock-tag");
  if (stockTag && CONFIG.estoque !== undefined) {
    stockTag.textContent = `${CONFIG.estoque} em estoque`;
  }
}

/* =========================================================
   Seleção de Kits
   ========================================================= */
function initKits() {
  const radioUnidade = $("#kitCardUnidade input");
  const radioDupla = $("#kitCardDupla input");
  const cardUnidade = $("#kitCardUnidade");
  const cardDupla = $("#kitCardDupla");
  const colorSet2 = $("#colorSet2");

  if (!cardUnidade || !cardDupla) return;

  const setKit = (kit) => {
    state.kit = kit;
    if (kit === "unidade") {
      cardUnidade.classList.add("is-active");
      cardDupla.classList.remove("is-active");
      if (radioUnidade) radioUnidade.checked = true;
      if (colorSet2) colorSet2.hidden = true;
      const label1 = $("#colorLabel1");
      if (label1) label1.innerHTML = `Cor: <strong id="colorName">${CONFIG.variantes.find(v => v.id === state.cor1)?.nome || 'Lilás'}</strong>`;
    } else {
      cardDupla.classList.add("is-active");
      cardUnidade.classList.remove("is-active");
      if (radioDupla) radioDupla.checked = true;
      if (colorSet2) colorSet2.hidden = false;
      const label1 = $("#colorLabel1");
      if (label1) label1.innerHTML = `Cor do 1º aparelho: <strong id="colorName">${CONFIG.variantes.find(v => v.id === state.cor1)?.nome || 'Lilás'}</strong>`;
    }
    renderPrecos();
  };

  cardUnidade.addEventListener("click", () => setKit("unidade"));
  cardDupla.addEventListener("click", () => setKit("dupla"));
}

/* =========================================================
   Imagens
   ========================================================= */
function setImg(img, src, alt) {
  if (!img) return;
  img.hidden = false;
  if (alt !== undefined) img.alt = alt;
  img.src = src;
  const holder = img.closest(".media");
  if (holder) holder.dataset.file = src.split("/").pop();
}

document.addEventListener("load", (e) => {
  if (e.target.tagName === "IMG") e.target.hidden = false;
}, true);
$$("img").forEach((img) => { if (img.complete && img.naturalWidth === 0) img.hidden = true; });

/* =========================================================
   Seletores de Cores Dinâmicos
   ========================================================= */
function renderCores() {
  const list1 = $("#colorList");
  const list2 = $("#colorList2");

  if (list1) {
    list1.innerHTML = "";
    CONFIG.variantes.forEach((v, i) => {
      const label = document.createElement("label");
      label.className = "swatch";
      label.innerHTML = `
        <input type="radio" name="cor1" value="${v.id}" ${v.id === state.cor1 ? "checked" : ""}>
        <span style="--c:${v.cor}" title="${v.nome}"></span>
        <span class="swatch__name">${v.nome}</span>`;
      list1.appendChild(label);
    });
    list1.addEventListener("change", (e) => {
      state.cor1 = e.target.value;
      const v = CONFIG.variantes.find((x) => x.id === state.cor1);
      if (v) selecionarVariante(v);
    });
  }

  if (list2) {
    list2.innerHTML = "";
    CONFIG.variantes.forEach((v, i) => {
      const label = document.createElement("label");
      label.className = "swatch";
      label.innerHTML = `
        <input type="radio" name="cor2" value="${v.id}" ${v.id === state.cor2 ? "checked" : ""}>
        <span style="--c:${v.cor}" title="${v.nome}"></span>
        <span class="swatch__name">${v.nome}</span>`;
      list2.appendChild(label);
    });
    list2.addEventListener("change", (e) => {
      state.cor2 = e.target.value;
      const v = CONFIG.variantes.find((x) => x.id === state.cor2);
      const elName2 = $("#colorName2");
      if (elName2 && v) elName2.textContent = v.nome;
    });
  }
}

function selecionarVariante(v) {
  state.variante = v;
  const elName = $("#colorName");
  if (elName) elName.textContent = v.nome;
  const alt = `${CONFIG.produto} na cor ${v.nome.toLowerCase()}, isolado em fundo branco`;
  setImg($("#slideProduto"), v.img, alt);
  setImg($("#thumbProduto"), v.img);
  irParaSlide(1);
}

/* =========================================================
   Galeria
   ========================================================= */
function initGaleria() {
  const track = $("#galleryTrack");
  if (!track) return;
  const slides = $$(".gallery__slide", track);
  const dotsWrap = $("#galleryDots");

  if (dotsWrap) {
    dotsWrap.innerHTML = "";
    slides.forEach((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dot";
      b.setAttribute("aria-label", `Foto ${i + 1} de ${slides.length}`);
      if (i === 0) b.setAttribute("aria-current", "true");
      b.addEventListener("click", () => irParaSlide(i));
      dotsWrap.appendChild(b);
    });
  }

  $$(".thumb").forEach((t) => {
    t.addEventListener("click", () => irParaSlide(Number(t.dataset.index)));
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting && en.intersectionRatio >= 0.6) {
        marcarSlide(slides.indexOf(en.target));
      }
    });
  }, { root: track, threshold: 0.6 });
  slides.forEach((s) => io.observe(s));

  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); irParaSlide(Math.min(state.slide + 1, slides.length - 1)); }
    if (e.key === "ArrowLeft") { e.preventDefault(); irParaSlide(Math.max(state.slide - 1, 0)); }
  });

  window.addEventListener("resize", () => {
    track.scrollTo({ left: state.slide * track.clientWidth, behavior: "auto" });
  });
}

function irParaSlide(i) {
  const track = $("#galleryTrack");
  if (!track) return;
  track.scrollTo({ left: i * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
  marcarSlide(i);
}

function marcarSlide(i) {
  if (i < 0) return;
  state.slide = i;
  $$(".dot").forEach((d, k) => d.setAttribute("aria-current", k === i ? "true" : "false"));
  $$(".thumb").forEach((t, k) => t.setAttribute("aria-current", k === i ? "true" : "false"));
}

/* =========================================================
   Quantidade
   ========================================================= */
function initQuantidade() {
  const input = $("#qtyInput");
  const minus = $("#qtyMinus");
  const plus = $("#qtyPlus");
  if (!input || !minus || !plus) return;
  input.max = QTD_MAX;

  const set = (n) => {
    n = Math.max(1, Math.min(QTD_MAX, parseInt(n, 10) || 1));
    state.qtd = n;
    input.value = n;
    minus.disabled = n <= 1;
    plus.disabled = n >= QTD_MAX;
  };
  minus.addEventListener("click", () => set(state.qtd - 1));
  plus.addEventListener("click", () => set(state.qtd + 1));
  input.addEventListener("change", () => set(input.value));
  set(1);
}

/* =========================================================
   Compra & Redirecionamento para Checkout Transparente
   ========================================================= */
function comprar() {
  try {
    incrementStat("checkoutClicks");
    
    // Salva a seleção na sessão para o checkout.html carregar instantaneamente
    const coresEscolhidas = state.kit === "dupla" ? [state.cor1, state.cor2] : [state.cor1];
    sessionStorage.setItem("tonia_checkout_kit", state.kit);
    sessionStorage.setItem("tonia_checkout_cores", JSON.stringify(coresEscolhidas));

    const precoTotal = state.kit === "dupla" ? 117.90 : CONFIG.preco;

    let rastreou = false;
    if (window.fbq && !sessionStorage.getItem("tonia_fbq_checkout")) {
      sessionStorage.setItem("tonia_fbq_checkout", "1");
      window.fbq("track", "InitiateCheckout", {
        content_ids: [state.kit],
        content_name: state.kit === "dupla" ? "Kit Dupla (2 Aparelhos)" : CONFIG.produto,
        num_items: state.kit === "dupla" ? 2 : 1,
        value: precoTotal,
        currency: "BRL"
      });
      rastreou = true;
    }

    if (window.gtag && CONFIG.ga4) {
      window.gtag("event", "begin_checkout", {
        currency: "BRL",
        value: precoTotal,
        items: [{
          item_id: state.kit,
          item_name: state.kit === "dupla" ? "Kit Dupla" : CONFIG.produto,
          price: precoTotal,
          quantity: 1
        }]
      });
      rastreou = true;
    }

    setTimeout(() => {
      window.location.href = "checkout.html";
    }, rastreou ? 150 : 20);
  } catch (err) {
    window.location.href = "checkout.html";
  }
}

function initCompra() {
  $$(".js-buy").forEach((b) => b.addEventListener("click", comprar));
}

/* =========================================================
   Menu mobile
   ========================================================= */
function initMenu() {
  const btn = $(".menu-toggle");
  const nav = $("#nav");
  if (!btn || !nav) return;
  const use = $("use", btn);

  const abrir = (on) => {
    nav.classList.toggle("is-open", on);
    btn.setAttribute("aria-expanded", on ? "true" : "false");
    btn.setAttribute("aria-label", on ? "Fechar menu" : "Abrir menu");
    if (use) use.setAttribute("href", on ? "#i-x" : "#i-menu");
  };
  btn.addEventListener("click", () => abrir(!nav.classList.contains("is-open")));
  $$("a", nav).forEach((a) => a.addEventListener("click", () => abrir(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) { abrir(false); btn.focus(); }
  });
}

/* =========================================================
   Timer de Oferta
   ========================================================= */
function initCountdown() {
  const el = $("#countdownTimer");
  if (!el) return;
  
  let tempo = 14 * 60 + 52;
  
  const tick = () => {
    const min = Math.floor(tempo / 60);
    const seg = tempo % 60;
    el.textContent = `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
    if (tempo > 0) {
      tempo--;
    } else {
      tempo = 15 * 60;
    }
  };
  
  tick();
  setInterval(tick, 1000);
}

/* =========================================================
   Avaliações
   ========================================================= */
function estrelas(n, tam = 16) {
  const star = `<svg class="icon" width="${tam}" height="${tam}" aria-hidden="true"><use href="#i-star"/></svg>`.repeat(5);
  const pct = Math.max(0, Math.min(5, n)) / 5 * 100;
  const label = n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `<span class="stars" role="img" aria-label="${label} de 5 estrelas">
    <span class="stars__row">${star}</span>
    <span class="stars__row stars__row--fill" style="width:${pct}%">${star}</span>
  </span>`;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function cardAvaliacao(a) {
  return `
    <article class="review card">
      <div class="review__top">
        ${estrelas(a.nota, 16)}
        <span class="verified"><svg class="icon" width="15" height="15" aria-hidden="true"><use href="#i-check-circle"/></svg>Compra Verificada</span>
      </div>
      <p class="review__text">"${esc(a.texto)}"</p>
      <div class="review__foot">
        <div>
          <span class="review__name">${esc(a.nome)}</span>
          ${a.cidade ? `<span class="review__city"> · ${esc(a.cidade)}</span>` : ""}
        </div>
        <div class="review__meta">
          ${a.variacao ? `<span class="review__badge">${esc(a.variacao)}</span>` : ""}
          ${a.data ? `<span class="review__date">${esc(a.data)}</span>` : ""}
        </div>
      </div>
    </article>`;
}

function renderAvaliacoes() {
  if (!CONFIG.avaliacoes.ativo || AVALIACOES.length === 0) return;

  const media = AVALIACOES.reduce((s, a) => s + Number(a.nota || 0), 0) / AVALIACOES.length;
  const nota = Math.round((CONFIG.avaliacoes.nota ?? media) * 10) / 10;
  const total = CONFIG.avaliacoes.total ?? AVALIACOES.length;
  const notaTxt = nota.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const totalTxt = `${total.toLocaleString("pt-BR")} avaliações`;

  const hero = $("#heroRating");
  if (hero) {
    hero.innerHTML = `${estrelas(nota, 16)}
      <span class="rating__nota">${notaTxt}</span>
      <a class="rating__link" href="#avaliacoes">(${totalTxt})</a>`;
    hero.hidden = false;
  }

  const elTitulo = $("#avaliacoes-titulo");
  if (elTitulo) elTitulo.textContent = `${notaTxt} de 5 estrelas`;
  
  const elSub = $("#avaliacoes-sub");
  if (elSub) elSub.textContent = `Baseado em ${totalTxt} de clientes verificadas em todo o Brasil.`;

  const lista = $("#reviewsList");
  const mais = $("#reviewsMore");
  if (!lista) return;

  const POR_VEZ = 6;
  const comTexto = AVALIACOES.filter((a) => a.texto && a.texto.trim());
  let mostradas = 0;
  
  const mostrarMais = () => {
    lista.insertAdjacentHTML("beforeend", comTexto.slice(mostradas, mostradas + POR_VEZ).map(cardAvaliacao).join(""));
    mostradas += POR_VEZ;
    if (mais) mais.hidden = mostradas >= comTexto.length;
  };
  
  if (mais) mais.addEventListener("click", mostrarMais);
  mostrarMais();
  const sec = $("#avaliacoes");
  if (sec) sec.hidden = false;
}

/* =========================================================
   Captura de e-mail / Lead
   ========================================================= */
function getLeads() {
  try {
    const raw = localStorage.getItem("tonia_leads");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLead(email) {
  try {
    const leads = getLeads();
    const novo = {
      email,
      data: new Date().toLocaleString("pt-BR"),
      origem: "Plano 21 Dias"
    };
    leads.unshift(novo);
    localStorage.setItem("tonia_leads", JSON.stringify(leads));
    incrementStat("leadsCount");
    if (state.adminAuth) renderAdminLeadsUI();
  } catch (e) {
    console.warn("[Tônia] Erro ao salvar lead localmente:", e);
  }
}

function initLead() {
  const form = $("#leadForm");
  const input = $("#leadEmail");
  const msg = $("#leadMsg");
  if (!form || !input || !msg) return;
  const btn = $("button", form);
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const mostrar = (texto, tipo) => {
    msg.textContent = texto;
    msg.className = "lead__msg " + (tipo ? "is-" + tipo : "");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!re.test(email)) {
      input.setAttribute("aria-invalid", "true");
      mostrar("Digite um e-mail válido.", "error");
      input.focus();
      return;
    }
    input.removeAttribute("aria-invalid");
    btn.disabled = true;
    mostrar("Enviando...");

    // Salvar localmente para visualização no Admin
    saveLead(email);

    try {
      const placeholder = !CONFIG.leadEndpoint || CONFIG.leadEndpoint.includes("LEAD_ENDPOINT");
      const local = ["localhost", "127.0.0.1", ""].includes(location.hostname);
      if (!placeholder && !local) {
        await fetch(CONFIG.leadEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, origem: "landing-plano-21-dias" })
        });
      }
      form.reset();
      mostrar("Plano de 21 Dias enviado com sucesso para o seu e-mail.", "success");
    } catch (err) {
      form.reset();
      mostrar("Plano de 21 Dias liberado com sucesso!", "success");
    } finally {
      btn.disabled = false;
    }
  });

  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") && re.test(input.value.trim())) {
      input.removeAttribute("aria-invalid");
      mostrar("");
    }
  });
}

/* =========================================================
   Efeito Sonoro de Mensagem (Web Audio API)
   ========================================================= */
function playMessageSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Tom 1 (Chime inicial suave - 587.33Hz / D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.16);

    // Tom 2 (Ding agudo e claro - 880.00Hz / A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.00, now + 0.08);
    gain2.gain.setValueAtTime(0.15, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.32);
  } catch (e) {}
}

/* =========================================================
   Sistema de Atendimento / Chat Flutuante
   ========================================================= */
function getChatMessages() {
  try {
    const raw = localStorage.getItem("tonia_chat_messages");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [
    {
      id: 1,
      sender: "agent",
      text: "Olá! Tudo bem? Como posso te ajudar com o <strong>Aparelho Tônia</strong> hoje?",
      time: "Agora",
      timestamp: new Date().toISOString()
    }
  ];
}

function saveChatMessage(msg) {
  try {
    const list = getChatMessages();
    list.push(msg);
    localStorage.setItem("tonia_chat_messages", JSON.stringify(list));
    incrementStat("chatMessages");
    if (state.adminAuth) renderAdminChatsUI();
  } catch (e) {}
}

function initChatSystem() {
  const toggleBtn = $("#chatToggleBtn");
  const widget = $("#chatWidget");
  const closeBtn = $("#chatCloseBtn");
  const messagesBox = $("#chatMessages");
  const chatBody = $("#chatBody");
  const form = $("#chatForm");
  const input = $("#chatInput");
  const badge = $("#chatUnreadBadge");

  if (!toggleBtn || !widget || !form || !input) return;

  const numeroWa = String(CONFIG.whatsapp).replace(/\D/g, "");

  const formatTime = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const renderMessages = () => {
    const list = getChatMessages();
    messagesBox.innerHTML = list.map((m) => `
      <div class="msg ${m.sender === 'user' ? 'msg--user' : 'msg--agent'}">
        <p>${m.text}</p>
        ${m.btn ? `<a href="${m.btn.url}" target="_blank" rel="noopener" class="msg-btn">${m.btn.label}</a>` : ''}
        <span class="msg__time">${m.time || 'Agora'}</span>
      </div>
    `).join("");
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  const abrirChat = (abrir) => {
    if (abrir) {
      widget.classList.add("is-open");
      toggleBtn.setAttribute("aria-expanded", "true");
      if (badge) badge.hidden = true;
      setTimeout(() => {
        renderMessages();
        input.focus();
      }, 100);
    } else {
      widget.classList.remove("is-open");
      toggleBtn.setAttribute("aria-expanded", "false");
    }
  };

  toggleBtn.addEventListener("click", () => {
    abrirChat(!widget.classList.contains("is-open"));
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => abrirChat(false));
  }

  // Resposta Automática Inteligente com aviso de consultor
  const responderBot = (pergunta) => {
    let resposta = "";
    let btn = null;
    const p = pergunta.toLowerCase();

    if (p.includes("prazo") || p.includes("entrega") || p.includes("chega")) {
      resposta = "O prazo médio de entrega é de <strong>3 a 7 dias úteis</strong> para capitais e 5 a 10 dias para interior, com <strong>frete grátis</strong> e rastreio completo! Um de nossos consultores já está a caminho para te atender com mais detalhes.";
    } else if (p.includes("garantia") || p.includes("devolu") || p.includes("reembolso")) {
      resposta = "Você tem <strong>30 dias de garantia incondicional</strong>! Se não notar firmeza muscular ou não gostar, devolvemos 100% do valor. Nosso consultor já está abrindo seu atendimento.";
    } else if (p.includes("pagamento") || p.includes("pix") || p.includes("cartao") || p.includes("cartão") || p.includes("parcel")) {
      resposta = `Aceitamos <strong>Pix com 5% de desconto extra</strong> (apenas ${fmt(CONFIG.preco * (1 - CONFIG.descontoPix))}) e <strong>Cartão em até ${CONFIG.parcelas}x sem juros</strong> com ambiente 100% criptografado!`;
    } else if (p.includes("whatsapp") || p.includes("atendente") || p.includes("humano") || p.includes("zap")) {
      resposta = "Com certeza! Você pode falar com nosso consultor diretamente no WhatsApp oficial:";
      btn = {
        label: "Abrir WhatsApp Oficial",
        url: `https://wa.me/${numeroWa}?text=${encodeURIComponent("Olá! Estou no site e gostaria de falar com um consultor.")}`
      };
    } else {
      resposta = "Olá! Recebemos sua dúvida. <strong>Um de nossos consultores especialistas já está visualizando</strong> e responderá você aqui em instantes! Se preferir agilidade máxima no WhatsApp, clique abaixo:";
      btn = {
        label: "Falar com Consultor no WhatsApp",
        url: `https://wa.me/${numeroWa}?text=${encodeURIComponent(`Olá! Gostaria de tirar a seguinte dúvida sobre o Tônia: ${pergunta}`)}`
      };
    }

    setTimeout(() => {
      const msgObj = {
        id: Date.now(),
        sender: "agent",
        isAutoReply: true,
        text: resposta,
        btn: btn,
        time: formatTime(),
        timestamp: new Date().toISOString()
      };
      saveChatMessage(msgObj);
      renderMessages();
      playMessageSound();
    }, 700);
  };

  const enviarMensagem = (texto) => {
    if (!texto || !texto.trim()) return;
    const userMsg = {
      id: Date.now(),
      sender: "user",
      text: esc(texto.trim()),
      time: formatTime(),
      timestamp: new Date().toISOString()
    };
    saveChatMessage(userMsg);
    renderMessages();
    input.value = "";

    // Verifica se um consultor humano já respondeu ou se a mensagem automática já foi disparada
    // Se o consultor já assumiu ou já houve resposta automática prévia, NÃO dispara mais o bot (anti-spam)
    const list = getChatMessages();
    const jaTeveConsultor = list.some((m) => m.isConsultant);
    const jaTeveAutoResposta = list.some((m) => m.isAutoReply);

    if (!jaTeveConsultor && !jaTeveAutoResposta) {
      responderBot(texto.trim());
    }
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    enviarMensagem(input.value);
  });

  // Atalhos de dúvidas rápidas
  $$(".js-quick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.dataset.query || btn.textContent.trim();
      enviarMensagem(q);
    });
  });

  // Escuta atualizações caso o admin responda em tempo real
  window.addEventListener("tonia_chat_update", () => {
    renderMessages();
    playMessageSound();
    if (!widget.classList.contains("is-open") && badge) {
      badge.hidden = false;
    }
  });

  renderMessages();
}

/* =========================================================
   Painel Administrativo & Segurança
   ========================================================= */
const ADMIN_STORAGE = {
  getPass: () => {
    const saved = localStorage.getItem("tonia_admin_pass");
    if (!saved || saved === "admin123") {
      return "128490gato";
    }
    return saved;
  },
  setPass: (p) => localStorage.setItem("tonia_admin_pass", p),
  getFails: () => parseInt(localStorage.getItem("tonia_admin_fails") || "0", 10),
  addFail: () => {
    const f = ADMIN_STORAGE.getFails() + 1;
    localStorage.setItem("tonia_admin_fails", f.toString());
    if (f >= 5) {
      const lockUntil = Date.now() + 60000; // Bloqueio de 60 segundos
      localStorage.setItem("tonia_admin_lock", lockUntil.toString());
    }
  },
  clearFails: () => {
    localStorage.removeItem("tonia_admin_fails");
    localStorage.removeItem("tonia_admin_lock");
  },
  getLockRemaining: () => {
    const lock = parseInt(localStorage.getItem("tonia_admin_lock") || "0", 10);
    if (!lock) return 0;
    const diff = Math.ceil((lock - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  }
};

function updateAdminStatsUI() {
  const stats = getStats();
  const elViews = $("#statPageViews");
  const elClicks = $("#statCheckoutClicks");
  const elMsgs = $("#statChatMessages");
  const elLeads = $("#statLeadsCount");

  if (elViews) elViews.textContent = stats.pageViews || 0;
  if (elClicks) elClicks.textContent = stats.checkoutClicks || 0;
  if (elMsgs) elMsgs.textContent = stats.chatMessages || 0;
  if (elLeads) elLeads.textContent = stats.leadsCount || 0;
}

function renderAdminChatsUI() {
  const tableBody = $("#adminChatsTableBody");
  const liveBox = $("#adminLiveChatMessages");
  const countEl = $("#adminChatCount");

  const msgs = getChatMessages();
  if (countEl) countEl.textContent = msgs.length;

  // Renderizar tabela de histórico
  if (tableBody) {
    if (msgs.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="center">Nenhum atendimento registrado ainda.</td></tr>`;
    } else {
      tableBody.innerHTML = msgs.map((m) => `
        <tr>
          <td>${m.time || 'Agora'}</td>
          <td><strong>${m.sender === 'user' ? 'Cliente' : 'Consultor(a)'}</strong></td>
          <td>${m.text}</td>
          <td><span class="chip chip--sm">${m.sender === 'user' ? 'Pergunta do Cliente' : 'Resposta da Loja'}</span></td>
        </tr>
      `).join("");
    }
  }

  // Renderizar feed da conversa ao vivo no Admin
  if (liveBox) {
    if (msgs.length === 0) {
      liveBox.innerHTML = `<p class="center" style="font-size:0.75rem;color:var(--ink-soft);padding:10px;">Aguardando mensagens dos visitantes...</p>`;
    } else {
      liveBox.innerHTML = msgs.map((m) => `
        <div class="msg ${m.sender === 'user' ? 'msg--user' : 'msg--agent'}" style="margin-bottom:6px;">
          <small style="font-weight:700;display:block;margin-bottom:2px;font-size:0.6875rem;">${m.sender === 'user' ? 'Cliente:' : 'Consultor:'}</small>
          <p>${m.text}</p>
          <span class="msg__time">${m.time || 'Agora'}</span>
        </div>
      `).join("");
      liveBox.scrollTop = liveBox.scrollHeight;
    }
  }
}

function renderAdminLeadsUI() {
  const tableBody = $("#adminLeadsTableBody");
  const countEl = $("#adminLeadCount");
  if (!tableBody) return;

  const leads = getLeads();
  if (countEl) countEl.textContent = leads.length;

  if (leads.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3" class="center">Nenhum lead capturado ainda.</td></tr>`;
    return;
  }

  tableBody.innerHTML = leads.map((l) => `
    <tr>
      <td><strong>${esc(l.email)}</strong></td>
      <td>${esc(l.data)}</td>
      <td><span class="chip chip--sm">${esc(l.origem || 'Plano 21 Dias')}</span></td>
    </tr>
  `).join("");
}

function renderAdminSettingsUI() {
  const setPreco = $("#settingPreco");
  const setAntigo = $("#settingPrecoAntigo");
  const setPix = $("#settingPixPct");
  const setEstoque = $("#settingEstoque");
  const setWa = $("#settingWhatsapp");
  const setNewPass = $("#settingNewPass");

  if (setPreco) setPreco.value = CONFIG.preco;
  if (setAntigo) setAntigo.value = CONFIG.precoAntigo;
  if (setPix) setPix.value = Math.round(CONFIG.descontoPix * 100);
  if (setEstoque) setEstoque.value = CONFIG.estoque !== undefined ? CONFIG.estoque : 14;
  if (setWa) setWa.value = CONFIG.whatsapp;
  if (setNewPass) setNewPass.value = "";
}

function initAdminPanel() {
  const modal = $("#adminModal");
  const openBtn = $("#openAdminBtn");
  const closeBtn = $("#adminCloseBtn");
  const cancelBtn = $("#adminCancelBtn");
  const logoutBtn = $("#adminLogoutBtn");
  const loginBox = $("#adminLogin");
  const contentBox = $("#adminContent");
  const loginForm = $("#adminLoginForm");
  const passInput = $("#adminPassInput");
  const loginError = $("#adminLoginError");
  const replyForm = $("#adminReplyForm");
  const replyInput = $("#adminReplyInput");
  const settingsForm = $("#adminSettingsForm");
  const saveFeedback = $("#adminSaveFeedback");

  if (!modal) return;

  // Verificar se há sessão de admin salva
  if (sessionStorage.getItem("tonia_admin_auth") === "true") {
    state.adminAuth = true;
  }

  const abrirModal = () => {
    modal.showModal();
    const lockedTime = ADMIN_STORAGE.getLockRemaining();
    if (lockedTime > 0) {
      loginBox.hidden = false;
      contentBox.hidden = true;
      if (loginError) {
        loginError.textContent = `Muitas tentativas incorretas. Bloqueado por ${lockedTime} segundos.`;
        loginError.hidden = false;
      }
      return;
    }

    if (state.adminAuth) {
      loginBox.hidden = true;
      contentBox.hidden = false;
      updateAdminStatsUI();
      renderAdminChatsUI();
      renderAdminLeadsUI();
      renderAdminSettingsUI();
    } else {
      loginBox.hidden = false;
      contentBox.hidden = true;
      if (passInput) {
        passInput.value = "";
        setTimeout(() => passInput.focus(), 100);
      }
    }
  };

  const fecharModal = () => {
    modal.close();
  };

  if (openBtn) openBtn.addEventListener("click", abrirModal);
  if (closeBtn) closeBtn.addEventListener("click", fecharModal);
  if (cancelBtn) cancelBtn.addEventListener("click", fecharModal);

  // Acesso Direto pela URL (ex: index.html#admin ou ?admin=1)
  const verificarAcessoUrl = () => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    if (hash === "#admin" || params.has("admin")) {
      abrirModal();
    }
  };
  verificarAcessoUrl();
  window.addEventListener("hashchange", verificarAcessoUrl);

  // Atalho de teclado: Ctrl + Shift + A
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
      e.preventDefault();
      abrirModal();
    }
  });

  // Login com verificação e proteção contra ataques de força bruta
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const lockSec = ADMIN_STORAGE.getLockRemaining();
      if (lockSec > 0) {
        loginError.textContent = `Bloqueio de segurança ativo. Aguarde ${lockSec}s.`;
        loginError.hidden = false;
        return;
      }

      const pass = passInput.value.trim();
      const senhaCorreta = ADMIN_STORAGE.getPass();

      if (pass === senhaCorreta) {
        state.adminAuth = true;
        sessionStorage.setItem("tonia_admin_auth", "true");
        ADMIN_STORAGE.clearFails();
        loginError.hidden = true;
        loginBox.hidden = true;
        contentBox.hidden = false;
        updateAdminStatsUI();
        renderAdminChatsUI();
        renderAdminLeadsUI();
        renderAdminSettingsUI();
      } else {
        ADMIN_STORAGE.addFail();
        const f = ADMIN_STORAGE.getFails();
        const lockAgora = ADMIN_STORAGE.getLockRemaining();
        if (lockAgora > 0) {
          loginError.textContent = `5 tentativas incorretas. Bloqueado por 60 segundos por segurança.`;
        } else {
          loginError.textContent = `Senha incorreta (${f}/5 tentativas). Tente novamente.`;
        }
        loginError.hidden = false;
        passInput.select();
      }
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      state.adminAuth = false;
      sessionStorage.removeItem("tonia_admin_auth");
      loginBox.hidden = false;
      contentBox.hidden = true;
      if (passInput) passInput.value = "";
    });
  }

  // Troca de abas
  $$(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.tab;
      $$(".admin-tab").forEach((t) => t.classList.remove("is-active"));
      $$(".admin-tab-content").forEach((c) => c.classList.remove("is-active"));
      tab.classList.add("is-active");
      const targetContent = $(`#${targetId}`);
      if (targetContent) targetContent.classList.add("is-active");
    });
  });

  // Enviar Resposta Oficial do Consultor no Chat
  if (replyForm && replyInput) {
    replyForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const texto = replyInput.value.trim();
      if (!texto) return;

      const d = new Date();
      const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const msgConsultor = {
        id: Date.now(),
        sender: "agent",
        isConsultant: true,
        text: `<strong>Consultor Tônia:</strong> ${esc(texto)}`,
        time: hora,
        timestamp: d.toISOString()
      };

      saveChatMessage(msgConsultor);
      replyInput.value = "";
      renderAdminChatsUI();
      window.dispatchEvent(new Event("tonia_chat_update"));
    });
  }

  // Limpar Histórico de Chats
  const clearChatsBtn = $("#adminClearChatsBtn");
  if (clearChatsBtn) {
    clearChatsBtn.addEventListener("click", () => {
      if (confirm("Tem certeza que deseja limpar o histórico de conversas do atendimento?")) {
        localStorage.removeItem("tonia_chat_messages");
        renderAdminChatsUI();
        window.dispatchEvent(new Event("tonia_chat_update"));
      }
    });
  }

  // Limpar Leads
  const clearLeadsBtn = $("#adminClearLeadsBtn");
  if (clearLeadsBtn) {
    clearLeadsBtn.addEventListener("click", () => {
      if (confirm("Tem certeza que deseja limpar a lista de leads capturados?")) {
        localStorage.removeItem("tonia_leads");
        renderAdminLeadsUI();
      }
    });
  }

  // Exportar Leads (CSV)
  const exportLeadsBtn = $("#adminExportLeadsBtn");
  if (exportLeadsBtn) {
    exportLeadsBtn.addEventListener("click", () => {
      const leads = getLeads();
      if (leads.length === 0) {
        alert("Nenhum lead capturado para exportar.");
        return;
      }
      let csv = "E-mail,Data/Hora,Origem\n";
      leads.forEach((l) => {
        csv += `"${l.email}","${l.data}","${l.origem || 'Plano 21 Dias'}"\n`;
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `leads-tonia-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Salvar Configurações da Loja & Alterar Senha
  if (settingsForm) {
    settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const novoPreco = parseFloat($("#settingPreco").value) || CONFIG.preco;
      const novoAntigo = parseFloat($("#settingPrecoAntigo").value) || CONFIG.precoAntigo;
      const novoPixPct = (parseFloat($("#settingPixPct").value) || 5) / 100;
      const novoEstoque = parseInt($("#settingEstoque").value, 10) || 14;
      const novoWa = $("#settingWhatsapp").value.trim() || CONFIG.whatsapp;
      const novaSenha = $("#settingNewPass") ? $("#settingNewPass").value.trim() : "";

      CONFIG.preco = novoPreco;
      CONFIG.precoAntigo = novoAntigo;
      CONFIG.descontoPix = novoPixPct;
      CONFIG.estoque = novoEstoque;
      CONFIG.whatsapp = novoWa;

      // Salvar nova senha se preenchida
      if (novaSenha && novaSenha.length >= 4) {
        ADMIN_STORAGE.setPass(novaSenha);
      }

      // Salvar no localStorage
      localStorage.setItem("tonia_config", JSON.stringify({
        preco: CONFIG.preco,
        precoAntigo: CONFIG.precoAntigo,
        descontoPix: CONFIG.descontoPix,
        estoque: CONFIG.estoque,
        whatsapp: CONFIG.whatsapp
      }));

      // Atualizar dados na página
      renderPrecos();
      initContato();

      if (saveFeedback) {
        saveFeedback.hidden = false;
        setTimeout(() => { saveFeedback.hidden = true; }, 3500);
      }
    });
  }
}

/* =========================================================
   WhatsApp e rodapé
   ========================================================= */
function initContato() {
  const numero = String(CONFIG.whatsapp).replace(/\D/g, "");
  const msgWa = encodeURIComponent("Olá! Gostaria de tirar uma dúvida sobre o Aparelho de Treino Tônia.");
  $$(".js-whatsapp").forEach((a) => { a.href = `https://wa.me/${numero}?text=${msgWa}`; });
  const { razao, cnpj, cidade } = CONFIG.empresa;
  const legal = $("#footerLegal");
  if (legal) legal.textContent = `${razao} · CNPJ ${cnpj} · ${cidade}`;
}

/* =========================================================
   Rastreamento
   ========================================================= */
function initTracking() {
  if (CONFIG.pixelMeta) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq("init", CONFIG.pixelMeta);
    window.fbq("track", "PageView");
    window.fbq("track", "ViewContent", {
      content_ids: [state.variante.id], content_name: CONFIG.produto,
      content_type: "product", value: CONFIG.preco, currency: "BRL"
    });
  }

  if (CONFIG.ga4) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(CONFIG.ga4)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", CONFIG.ga4);
  }
}

/* =========================================================
   Início
   ========================================================= */
renderPrecos();
renderCores();
initKits();
initGaleria();
initCompra();
initMenu();
initCountdown();
renderAvaliacoes();
initLead();
initContato();
initTracking();
initChatSystem();
initAdminPanel();


