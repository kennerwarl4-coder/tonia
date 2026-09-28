# Documentação SigiloPay — Referência Oficial

Compilado do que foi fornecido pela documentação oficial. URL base e autenticação valem para todos os endpoints.

- **URL base:** `https://app.sigilopay.com.br/api/v1`
- **Só HTTPS.** Requisições HTTP sem criptografia não são suportadas.
- **Localização:** a API só aceita requisições vindas de Brasil, EUA, Portugal e outros locais considerados seguros (firewall AWS WAF/CloudFront). De outros locais, retorna uma **página HTML 403** em vez de JSON. Não há whitelist de IP.

---

## Autenticação

Todo endpoint protegido exige dois cabeçalhos:

| Header | Descrição |
|---|---|
| `x-public-key` | Chave pública da API do produtor |
| `x-secret-key` | Chave secreta da API do produtor |

- Geradas no painel: **Integrações → API → Gerar credenciais**. São exibidas uma única vez.
- `GET /ping` (status) é público e não exige os headers.
- Trate a chave secreta como senha. Nunca no front-end nem no código versionado.

---

## Endpoint: Receber pix

Recebe pagamentos via Pix. **Requer autenticação.**

```
POST /gateway/pix/receive
```

### Body (application/json)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|:---:|---|
| `identifier` | string | ✅ | Identificador único da transação, criado pela sua aplicação. Único por transação. |
| `amount` | number | ✅ | Valor total em reais (ex: 67.90). |
| `shippingFee` | number | | Frete (R$). |
| `extraFee` | number | | Outras taxas (R$). |
| `discount` | number | | Desconto (R$). |
| `client` | object | ✅ | Dados do cliente (`name`, `email`, `phone`, `document`). |
| `products` | array | | Lista de produtos (`id`, `name`, `quantity`, `price`). |
| `dueDate` | string | | Vencimento, formato `YYYY-MM-DD`. |
| `metadata` | object/string | | Metadados livres. Ex.: `{ "orderId": "..." }`. |
| `callbackUrl` | string | | URL para notificação de mudança de status (webhook). |

### Retorno 200 OK

| Campo | Tipo | Descrição |
|---|---|---|
| `transactionId` | string | ID único da transação. |
| `status` | enum | `OK` · `FAILED` · `PENDING`. |
| `transactionStatus` | enum | `PENDING` · `COMPLETED` · `FAILED`. |
| `webhookToken` | string | Token para validar o webhook. |
| `fee` | number | Taxa cobrada. |
| `order` | object | `id`, `url`, `receiptUrl`. |
| `pix` | object | `code` (copia e cola), `image` (URL do QR), `expiresAt`. |

---

## Webhook — Notificação de Pagamento

Enviado via POST para a `callbackUrl`.

- Evento de aprovação: `TRANSACTION_PAID`
- Validação: campo `token` igual ao `webhookToken` retornado na criação da transação ou secret configurado.
