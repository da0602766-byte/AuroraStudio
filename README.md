# Aurora Studio — site e agenda online

Site do estúdio com agendamento sem cadastro, sinal via Pix e painel de gestão para a proprietária.

**Tecnologia:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma · PostgreSQL.

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

## Instalação local

Requisitos: Node.js 18.18 ou mais novo e um banco PostgreSQL (local ou gratuito no Neon/Supabase).

```bash
npm install
cp .env.example .env        # preencha os valores
npm run db:push             # cria as tabelas
npm run db:seed             # serviços, horários, regras e acesso da proprietária
npm run dev                 # http://localhost:3000  e  http://localhost:3000/admin
```

Antes de publicar, confira:

```bash
npm run typecheck
npm run build
```

## Publicação (sugestão: Vercel + Neon + Vercel Blob)

1. Crie o banco no [Neon](https://neon.tech) e copie a URL de conexão *pooled*.
2. Envie o projeto para um repositório no GitHub e importe na [Vercel](https://vercel.com).
3. Na Vercel, em **Storage**, crie um **Blob Store** e conecte ao projeto (isso cria `BLOB_READ_WRITE_TOKEN`).
4. Em **Settings → Environment Variables**, cadastre `DATABASE_URL`, `AUTH_SECRET` (gere com `openssl rand -base64 48`) e `NEXT_PUBLIC_SITE_URL`.
5. No computador, com a `DATABASE_URL` de produção no `.env`, rode `npm run db:push` e `npm run db:seed`.
6. Faça o deploy e conecte o domínio.

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
