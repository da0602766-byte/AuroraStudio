# Aurora Studio — site e agenda online

Site do estúdio com agendamento sem cadastro, sinal via Pix e painel de gestão para a proprietária.

**Tecnologia:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS · Prisma · PostgreSQL.

## O que já funciona (Fase 1 completa + partes das Fases 2 e 3)

Área pública (sem login):
- Página inicial com serviços, preços, duração, trabalhos, profissional, avaliações, horários, formas de pagamento, políticas e dúvidas.
- Página de cada serviço com fotos relacionadas.
- Galeria com filtro por categoria.
- Agendamento em 4 etapas: serviço → dia e horário (calendário com disponibilidade real, horários ocupados aparecem riscados) → dados e ficha de segurança (alergia e gestação) → confirmação.
- Sinal de R$ 15,00 via Pix (chave exibida com botão copiar) e envio do comprovante pelo WhatsApp.
- Link individual da reserva: acompanhar situação, cancelar (até 5 h antes), pedir remarcação, avaliar depois do atendimento.
- Consulta de reserva por código + WhatsApp.
- Política de privacidade (LGPD) e consentimento para dados de saúde.

Painel (`/admin`):
- Início: atendimentos do dia, próxima cliente, sinais a conferir, números do mês, horários livres dos próximos 7 dias, clientes para retorno.
- Agenda por dia, semana e mês; reservar direto num horário livre.
- Reservas: filtros, busca, detalhes, confirmar sinal, concluir, falta, cancelar, reabrir, reagendar, registrar pagamentos, mensagens prontas de WhatsApp, histórico completo.
- Reserva manual e encaixe.
- Clientes: ficha com histórico, total pago, faltas, cancelamentos, observações internas, exclusão de dados (LGPD).
- Serviços e categorias, preço promocional, sinal por serviço, prazo de retorno.
- Portfólio com envio de fotos (reduzidas no próprio celular antes do envio).
- Avaliações: moderação, destaque e cadastro de depoimentos recebidos por fora.
- Folgas, férias e bloqueios de horário.
- Configurações: dados do estúdio, fotos, Pix, regras (antecedência, cancelamento, sinal, prazo do sinal), horários de atendimento, dúvidas e troca de senha.
- Registro de auditoria das ações administrativas.

## Regras de agendamento

| Regra | Valor inicial | Onde mudar |
|---|---|---|
| Antecedência mínima para agendar | 24 horas | Configurações → Agendamento |
| Antecedência mínima para cancelar | 5 horas | Configurações → Agendamento |
| Sinal | R$ 15,00, descontado do procedimento | Configurações (padrão) ou em cada serviço |
| Prazo para pagar o sinal | 60 minutos | Configurações → Agendamento |
| Terça a sexta | 9h30, 10h30, 11h30, 14h30, 15h30, 16h30 | Configurações → Horários |
| Sábado | 8h30, 9h30, 10h30 | Configurações → Horários |

Como o sinal funciona na Fase 1 (sem gateway):
1. A cliente reserva e o horário fica segurado pelo prazo do sinal.
2. Ela paga o Pix e toca em “Enviar comprovante pelo WhatsApp”. A partir daí o horário não expira mais sozinho.
3. A proprietária confere e toca em “Recebi o sinal” no painel. A reserva vira **Confirmada**.
4. Se a cliente não pagar nem avisar dentro do prazo, a reserva é cancelada automaticamente e o horário volta a ficar livre.

## Segurança

- Reserva dupla impossível: cada reserva é gravada dentro de uma trava exclusiva da agenda no PostgreSQL (`pg_advisory_xact_lock`), e a disponibilidade é conferida de novo dentro da trava.
- Horários e preços são sempre validados no servidor.
- Link da reserva com token aleatório de 192 bits; páginas de reserva e do painel não aparecem no Google.
- Senha com bcrypt; sessão em cookie `httpOnly`; trocar a senha encerra as outras sessões.
- Limite de tentativas no login, no agendamento e na consulta; campo-armadilha contra robôs.
- Fotos verificadas pelo conteúdo do arquivo, não só pela extensão.
- Sessão verificada com algoritmo fixo (HS256) e mesmo segredo mínimo na middleware e no servidor.
- Cabeçalhos `Content-Security-Policy` e `Strict-Transport-Security`; painel e página da reserva com `no-store`.
- Reabrir uma reserva ou confirmar o sinal de uma reserva cancelada refaz a checagem de conflito dentro da trava da agenda.

## Instalação local

Requisitos: Node.js 20.9 ou mais novo e um banco PostgreSQL (local ou gratuito no Neon/Supabase).

```bash
npm install
cp .env.example .env        # preencha os valores (as duas URLs do banco)
npm run db:migrate          # cria as tabelas a partir das migrations
npm run db:seed             # serviços, horários, regras e acesso da proprietária
npm run dev                 # http://localhost:3000  e  http://localhost:3000/admin
```

Antes de publicar, confira:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

## Testes

```bash
npm run test          # roda uma vez
npm run test:watch    # reexecuta ao salvar
```

Cobrem a lógica pura, que é onde um erro passa despercebido: conversão de fuso
(`time.ts`), montagem da disponibilidade (`availability.ts`), dinheiro e
telefone (`format.ts`) e o agrupamento dos horários exibidos (`schedule.ts`).
Os testes de disponibilidade usam um banco de mentira, então rodam sem
PostgreSQL. Ficam em `src/lib/__tests__/`, no runner do próprio Node.

## Cache do site

As páginas públicas são geradas uma vez e servidas prontas pelo CDN, em vez de
montadas no servidor a cada clique. Quem decide isso é o `revalidate` do
`(site)/layout.tsx`; páginas que precisam de dados ao vivo declaram
`dynamic = "force-dynamic"` no próprio arquivo:

| Página | Como é servida | Por quê |
|---|---|---|
| Inicial, privacidade, consulta | Pronta, do CDN | Conteúdo igual para todo mundo |
| Cada serviço | Cache de 5 minutos | Abre qualquer novo serviço sem depender do próximo build |
| Agendar | Cache de 5 minutos | Catálogo em cache; disponibilidade permanece em tempo real |
| Galeria | Cache de 5 minutos | Cache separado por categoria e página |
| Reserva pelo link | A cada pedido | Dados de uma cliente específica |

Toda ação do painel chama `revalidatePath("/", "layout")` e `revalidateTag`,
então a proprietária vê a alteração na hora. Os 5 minutos do `revalidate` são
só a rede de segurança.

As consultas também ficam guardadas (`src/lib/cache.ts`), o que ajuda as
páginas dinâmicas. Ao criar uma consulta nova para o site público, use
`cacheSite(...)` e garanta que a ação que altera esses dados passe por
`revalidateSite()` / `done()`.

## Endereço do site

`src/lib/site-url.ts` resolve o endereço público. Ele usa
`NEXT_PUBLIC_SITE_URL` quando existe e, na falta dela, a variável `URL` que a
Netlify publica sozinha — assim o site continua correto mesmo se o projeto for
renomeado. **Na Netlify, o mais seguro é não cadastrar `NEXT_PUBLIC_SITE_URL`.**

## Mudanças no banco

O schema é versionado em `prisma/migrations`. Para mudar uma tabela, edite
`prisma/schema.prisma` e rode `npx prisma migrate dev --name descricao-curta`:
o Prisma gera o SQL, aplica no banco local e guarda o arquivo no repositório.
Em produção, `npm run db:migrate` aplica o que ainda faltar.

`npm run db:push` continua existindo para experimentar num banco descartável,
mas não deixa registro — não use em produção.

**Banco que já existe e foi criado com `db:push`:** marque a migration inicial
como aplicada uma única vez, senão o Prisma tenta recriar tudo:

```bash
npx prisma migrate resolve --applied 0_init
```

## Publicação (Netlify + Neon + Cloudinary — tudo em plano gratuito)

Somente o build de produção aplica migrations e o primeiro carregamento. Os
Deploy Previews compilam o projeto sem alterar o banco:

```
npm run build:production
```

1. Crie o banco no [Neon](https://neon.tech) e copie as duas URLs de conexão
   (Connect → Postgres database): a agrupada tem `-pooler` no endereço, a
   direta não.
2. Envie o projeto para um repositório no GitHub e importe na
   [Netlify](https://netlify.com). O `netlify.toml` já traz o comando de build
   e o plugin do Next.js.
3. Crie uma conta no [Cloudinary](https://cloudinary.com) e pegue os três
   valores em **Settings → API Keys**.
4. Em **Site configuration → Environment variables**, cadastre:

   | Variável | Onde obter |
   |---|---|
   | `DATABASE_URL` | Neon, conexão **com** `-pooler` |
   | `DATABASE_URL_UNPOOLED` | Neon, conexão **sem** `-pooler` |
   | `AUTH_SECRET` | Gere com `openssl rand -base64 48` |
   | `NEXT_PUBLIC_SITE_URL` | O endereço do site, sem barra no final |
   | `ADMIN_EMAIL` | Seu e-mail de acesso ao painel |
   | `ADMIN_PASSWORD` | Senha do primeiro acesso, mínimo 10 caracteres |
   | `ADMIN_NAME` | Seu nome |
   | `CLOUDINARY_CLOUD_NAME` | Cloudinary |
   | `CLOUDINARY_API_KEY` | Cloudinary |
   | `CLOUDINARY_API_SECRET` | Cloudinary |

5. Faça o deploy e conecte o domínio.
6. Entre em `/admin`, troque a senha e preencha o conteúdo real.

### Sobre os planos gratuitos

Os três serviços permitem uso comercial no plano gratuito, ao contrário da
Vercel, cujo plano Hobby é restrito a uso pessoal — um site que anuncia
serviços e movimenta sinal não se enquadra ali.

Para rodar na Vercel seria preciso o plano Pro, trocar o Cloudinary pelo Vercel
Blob em `src/lib/storage.ts` e remover o `binaryTargets` do `schema.prisma`.

Se alguma variável faltar, o deploy falha com erro em vez de publicar um site
quebrado. É proposital.

> O seed roda a cada publicação, mas só faz algo na primeira: depois que o
> estúdio está configurado, ele não toca em nada. Um serviço removido pelo
> painel não volta.

> Deploys de preview não aplicam migrations nem executam o seed. Quando houver
> um banco separado para previews, configure as variáveis no contexto
> `deploy-preview` da Netlify.

> Atenção: o plano gratuito (Hobby) da Vercel é apenas para uso não comercial. Para o site de um negócio, use o plano Pro ou outra hospedagem compatível com Next.js (Railway, Render, Netlify).

## Primeiros passos no painel

1. Entre em `/admin` com o e-mail e a senha definidos no `.env` e troque a senha.
2. **Configurações → Estúdio:** nome, textos, WhatsApp, Instagram, endereço ou região, fotos.
3. **Configurações → Agendamento:** chave Pix e nome do titular.
4. **Serviços:** preço e duração de cada um (enquanto o preço for 0, o site mostra “sob consulta”). Serviços mais longos que 1 hora bloqueiam os horários seguintes automaticamente.
5. **Trabalhos:** envie as fotos autorizadas e marque os destaques.
6. **Avaliações:** cadastre os feedbacks que você já tem.

## Pontos para confirmar com a proprietária

- **Nome do estúdio:** o site sai como “Aurora Studio” até ser trocado em Configurações → Estúdio.
- **Sábado (8h30 às 12h):** foram cadastrados os inícios 8h30, 9h30 e 10h30. Se ela quiser 11h ou 11h30, basta ajustar em Configurações → Horários.
- **Preços e durações:** todos os serviços começam com 1 hora e valor “sob consulta”.
- **O que acontece com o sinal em cancelamentos dentro do prazo:** o texto da política pode ser ajustado em Configurações → Agendamento.

## Testes antes de divulgar

- [ ] Reserva normal pelo celular do início ao fim.
- [ ] Horário ocupado aparece riscado e não pode ser escolhido.
- [ ] Duas pessoas tentando o mesmo horário ao mesmo tempo: só uma consegue; a outra volta para a escolha de horário com aviso.
- [ ] Reserva sem sinal expira depois do prazo e o horário volta a aparecer.
- [ ] “Enviar comprovante” impede a expiração; “Recebi o sinal” confirma.
- [ ] Agendamento com menos de 24 h não é oferecido; cancelamento com menos de 5 h é bloqueado no link.
- [ ] Reagendar, cancelar, concluir e registrar falta no painel.
- [ ] Bloqueio de dia inteiro remove os horários do site.
- [ ] Serviço de 2 horas ocupa dois horários seguidos.
- [ ] Links de WhatsApp abrem com a mensagem preenchida.
- [ ] Envio de foto pelo celular no portfólio.

## Próximas fases (ainda não incluídas)

- Pagamento automático do sinal (Mercado Pago, Asaas ou Pagar.me) com confirmação por webhook.
- Lembretes automáticos por WhatsApp/e-mail (exige API oficial do WhatsApp ou serviço de e-mail).
- Lista de espera, promoções com período de validade, relatórios detalhados e exportação em planilha.
- Mais de uma profissional (o banco já está preparado: tabela `Professional`).

## Estrutura

```
prisma/            schema do banco e dados iniciais
src/app/(site)/    páginas públicas
src/app/admin/     painel e ações administrativas
src/app/api/       disponibilidade e reservas
src/lib/           regras de agenda, reservas, autenticação, datas, armazenamento
src/components/    componentes do site, do agendamento e do painel
```
