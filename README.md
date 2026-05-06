# financas

Site/app local de controle financeiro pessoal para Windows, com foco inicial em conta e cartao Caixa. O projeto roda localmente, sem login e sem nuvem, usando frontend e backend separados.

## Stack atual

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Estilo: Tailwind CSS, com base preparada para shadcn/ui
- Graficos: Recharts
- Banco local: SQLite + Prisma
- Dados locais sugeridos: `C:\Financeiro`
- Banco SQLite sugerido: `C:\Financeiro\data\financas.db`
- Backups locais atuais: `C:\Financeiro\backups`

## Estrutura

```txt
financas/
  backend/
    prisma/
      migrations/
      schema.prisma
      seed.ts
    src/
      routes/
      services/
      lib/
  frontend/
    src/
      components/
      config/
      hooks/
      lib/
      pages/
  package.json
  README.md
```

## Instalacao

Na raiz do projeto:

```bash
npm install
```

## Configurar ambiente

Crie `backend/.env` a partir de `backend/.env.example`:

```env
PORT=3333
FRONTEND_URL=http://localhost:5173
DATABASE_URL="file:C:/Financeiro/data/financas.db"
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

`OPENAI_API_KEY` e opcional. Sem essa chave, o sistema continua funcionando normalmente e os recursos de IA ficam desativados com mensagem amigavel. A chave fica apenas no backend e nunca e enviada ao frontend.

O formato `file:C:/...` evita problemas comuns com barras invertidas no Windows. A pasta do banco pode ser criada manualmente se necessario:

```powershell
New-Item -ItemType Directory -Force -Path C:\Financeiro\data
```

O frontend tambem aceita `frontend/.env` com:

```env
VITE_API_BASE_URL=
```

Em desenvolvimento, o Vite usa proxy para `/api`, entao o valor pode ficar vazio.

## Banco local

Gerar Prisma Client:

```bash
npm run db:generate
```

Rodar migrations:

```bash
npm run db:migrate
```

Rodar seed inicial:

```bash
npm run db:seed
```

O seed cria categorias padrao e configuracoes iniciais:

- `appName = financas`
- `cardClosingDay = 25`
- `cardDueDay = 10`
- `cardName = Caixa`
- `dataDirectory = C:\Financeiro`

## Como rodar localmente

Rodar frontend e backend juntos:

```bash
npm run dev
```

Rodar apenas o frontend:

```bash
npm run dev:frontend
```

Rodar apenas o backend:

```bash
npm run dev:backend
```

URLs padrao:

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:3333>
- Health check: <http://localhost:3333/api/health>

## Como testar a importacao OFX

Existem fixtures OFX Caixa ficticias e anonimizadas em:

```txt
backend/fixtures/caixa-ofx-anonimizado.ofx
backend/fixtures/caixa-ofx-abril-2026-anonimizado.ofx
```

Roteiro manual:

1. Rode `npm run dev`.
2. Acesse <http://localhost:5173/importar>.
3. Escolha o modo `OFX da conta Caixa`.
4. Selecione `backend/fixtures/caixa-ofx-abril-2026-anonimizado.ofx`.
5. Na previa, confira banco `104`, conta, periodo e os 4 lancamentos.
6. Edite pelo menos uma descricao limpa e uma categoria, mantendo outros itens em `A revisar` se desejar.
7. Confirme a importacao.
8. O resumo deve mostrar total lido, importados, duplicados ignorados e itens a revisar.
9. Clique em `Ver lancamentos desta importacao`; a tela Lancamentos deve abrir filtrada pelo `importBatchId`, sem depender do mes atual.
10. Clique em `Ver resumo deste mes`; a tela Inicio deve abrir em abril de 2026.
11. Clique em abril no seletor de mes e confirme que a tela nao quebra.
12. Importe o mesmo OFX novamente: a previa deve marcar os itens como possiveis duplicados e a confirmacao nao deve criar lancamentos repetidos.

A fixture nao contem dados reais sensiveis. Ela cobre `FITID` presente e ausente; quando o `FITID` nao vem no arquivo, o backend gera um `externalId` estavel a partir de banco, conta, data, valor e memo.

Para diagnostico controlado do fluxo de importacao, rode o backend com:

```powershell
$env:IMPORT_DEBUG="true"
npm run dev:backend
```

Com essa variavel ativa, o backend imprime etapas discretas de preview e confirmacao: arquivo recebido, linhas lidas, selecionadas, duplicadas, importadas e pendentes de revisao. Sem `IMPORT_DEBUG=true`, esses logs nao aparecem.

## Como testar a importacao PDF da fatura

Use um PDF de fatura Caixa com texto selecionavel, sem compartilhar ou versionar dados reais sensiveis.

Roteiro manual:

1. Rode `npm run dev`.
2. Acesse <http://localhost:5173/importar>.
3. Escolha o modo `PDF da fatura Caixa`.
4. Selecione o PDF local.
5. Na previa, confira total do PDF, total calculado, diferenca, categorias e duplicados.
6. Edite categorias quando necessario e confirme a importacao.
7. O resumo deve mostrar total lido, importados, duplicados ignorados e itens a revisar.
8. Use `Ver fatura criada` ou acesse `Fatura Caixa` para conferir a fatura.
9. Acesse `Lancamentos` para ver os lancamentos com origem `PDF fatura`.
10. Acesse `Inicio` e selecione o mes da fatura para conferir o impacto no dashboard.
11. Importe o mesmo PDF novamente: a previa deve marcar possiveis duplicados e a confirmacao nao deve criar lancamentos repetidos.

## Estado atual do MVP

- Base visual: implementada
- Backend: implementado
- Banco SQLite/Prisma: implementado
- OFX: implementado parcialmente, precisa correcao/validacao com arquivos reais Caixa
- PDF fatura: implementado parcialmente, precisa robustez e validacao com PDFs reais Caixa
- Dashboard: real, calcula por `direction` e assume `amount` positivo
- Lancamentos: real, com edicao basica e revisao
- Regras: implementadas, precisam refinamento de UX e aplicacao em massa
- IA: opcional, implementada, precisa teste real com `OPENAI_API_KEY`
- Backup: implementado, precisa respeitar `dataDirectory` em etapa futura

## Modulos implementados

- Estrutura local com frontend e backend separados.
- Rotas basicas de categorias, configuracoes, lancamentos e faturas.
- Prisma + SQLite local.
- Seed de categorias e configuracoes.
- Tela Inicio conectada ao dashboard real.
- Tela Importar com preview e confirmacao para OFX e PDF.
- Tela Lancamentos conectada ao banco, com filtros, edicao de categoria/nome limpo e revisao.
- Cadastro manual de lancamentos.
- Tela Fatura Caixa conectada a faturas importadas.
- Regras simples de categoria.
- IA assistiva opcional para sugestoes e resumo mensal.
- Backup manual do SQLite.

## Modulos parciais ou que precisam validacao

- OFX: parser e fluxo existem, mas precisam ser testados com arquivos reais da Caixa e revisados quanto a sinal de valor, duplicidade, categorias e contagem de itens a revisar.
- PDF fatura: parser e fluxo existem, mas dependem de PDF com texto selecionavel e precisam validacao com layouts reais da Caixa.
- Dashboard: consome dados reais, mas a confiabilidade depende da normalizacao de `amount`, `direction` e `paymentMethod`.
- Fatura Caixa: mostra dados reais, mas nacional/internacional/taxas ainda dependem de classificacao por texto em alguns pontos.
- Regras: CRUD existe, mas ainda precisa melhorar aplicacao em massa e seguranca contra regras amplas demais.
- IA: integrada de forma opcional, mas nao foi validada com chave real neste ambiente.
- Backup: cria arquivos em `C:\Financeiro\backups`, mas ainda nao usa a configuracao `dataDirectory` como fonte do diretorio.

## Rotas principais

- `GET /api/health`
- `GET /api/ai/status`
- `POST /api/ai/suggest-transactions`
- `POST /api/ai/monthly-summary`
- `GET /api/backups`
- `POST /api/backups/create`
- `GET /api/categories`
- `GET /api/category-rules`
- `POST /api/category-rules`
- `PATCH /api/category-rules/:id`
- `DELETE /api/category-rules/:id`
- `POST /api/category-rules/apply-preview`
- `POST /api/category-rules/apply`
- `GET /api/dashboard?month=MM&year=YYYY`
- `GET /api/settings`
- `PATCH /api/settings/:key`
- `GET /api/transactions`
- `POST /api/transactions`
- `PATCH /api/transactions/:id`
- `PATCH /api/transactions/:id/review`
- `DELETE /api/transactions/:id`
- `GET /api/invoices`
- `GET /api/invoices/:id`
- `PATCH /api/invoices/:id`
- `GET /api/invoices/:id/summary`
- `POST /api/import/ofx/preview`
- `POST /api/import/ofx/confirm`
- `POST /api/import/pdf-invoice/preview`
- `POST /api/import/pdf-invoice/confirm`
- `GET /api/import-batches`

## Scripts uteis

```bash
npm run typecheck
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run data:normalize-amounts
```

## Observacoes tecnicas

- Regra oficial de valores: `Transaction.amount` deve ser sempre positivo.
- `Transaction.direction` define o significado financeiro: `income` para entrada, `expense` para saida e `neutral` para transferencia/ajuste/neutro.
- `Transaction.paymentMethod` define a forma operacional: `credit`, `debit`, `account` ou `adjustment`.
- Novas transacoes manuais, OFX e PDF devem ser gravadas com `amount` positivo.
- Dados antigos podem ser normalizados manualmente com `npm run data:normalize-amounts`. O script nao apaga transacoes, apenas converte `amount` negativo para positivo e registra no console cada alteracao.
- Nenhuma funcionalidade de login, nuvem, Vercel, Supabase ou Firebase faz parte do MVP.
- A IA nao deve salvar automaticamente sem revisao do usuario.
- Restore de backup ainda nao foi implementado.

## Como validar a regra de valores

Para verificar se ainda existem lancamentos antigos com `amount` negativo, use uma consulta direta no SQLite, se o utilitario `sqlite3` estiver instalado:

```powershell
sqlite3 C:\Financeiro\data\financas.db "select id, direction, amount, source, descriptionClean from 'Transaction' where amount < 0;"
```

Para normalizar dados antigos sem apagar nada:

```bash
npm run data:normalize-amounts
```

O script altera apenas `amount < 0` para o valor positivo equivalente, preserva `direction`, `source`, categorias e vinculos, e imprime no console cada transacao ajustada.
