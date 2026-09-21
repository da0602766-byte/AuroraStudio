/**
 * Popula o banco com os dados iniciais do estúdio.
 * Pode ser executado mais de uma vez sem duplicar informações.
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORIAS = [
  { slug: "cilios", name: "Cílios", order: 1 },
  { slug: "sobrancelhas", name: "Sobrancelhas", order: 2 },
  { slug: "maquiagem", name: "Maquiagem", order: 3 },
  { slug: "epilacao", name: "Epilação", order: 4 },
  { slug: "micropigmentacao", name: "Micropigmentação", order: 5 },
];

// Preço 0 aparece no site como "sob consulta" até a proprietária definir o valor no painel.
const SERVICOS = [
  { slug: "cilios", name: "Cílios", category: "cilios", durationMinutes: 60, order: 1,
    description: "Olhar marcado e natural, pensado para o formato dos seus olhos." },
  { slug: "design-sobrancelhas-personalizado", name: "Design de sobrancelhas personalizado", category: "sobrancelhas", durationMinutes: 60, order: 2,
    description: "Desenho feito a partir das proporções do seu rosto, para valorizar a sua expressão." },
  { slug: "design-sobrancelhas-henna", name: "Design de sobrancelhas com henna", category: "sobrancelhas", durationMinutes: 60, order: 3,
    description: "Design personalizado com aplicação de henna para preencher falhas e definir o contorno." },
  { slug: "maquiagem", name: "Maquiagem", category: "maquiagem", durationMinutes: 60, order: 4,
    description: "Maquiagem para eventos, ensaios e ocasiões especiais." },
  { slug: "epilacao", name: "Epilação", category: "epilacao", durationMinutes: 60, order: 5,
    description: "Remoção dos pelos com cuidado e higiene." },
  { slug: "micropigmentacao", name: "Micropigmentação", category: "micropigmentacao", durationMinutes: 60, order: 6,
    description: "Pigmentação semipermanente para sobrancelhas com efeito natural e duradouro." },
];

// 0 = domingo … 6 = sábado
const TER_A_SEX = ["09:30", "10:30", "11:30", "14:30", "15:30", "16:30"];
const SABADO = ["08:30", "09:30", "10:30"];

const FAQS = [
  { order: 1, question: "Com quanto tempo de antecedência preciso agendar?",
    answer: "Os agendamentos pelo site ficam disponíveis a partir de 24 horas antes do horário desejado." },
  { order: 2, question: "Como funciona o sinal?",
    answer: "Para confirmar o horário é cobrado um sinal de R$ 15,00 via Pix. Esse valor é descontado do procedimento no dia do atendimento." },
  { order: 3, question: "Posso desmarcar ou remarcar?",
    answer: "Sim, com pelo menos 5 horas de antecedência. Você pode cancelar pelo link da sua reserva ou falar comigo pelo WhatsApp para remarcar." },
  { order: 4, question: "Tenho alergia ou estou gestante. Posso fazer os procedimentos?",
    answer: "Informe no momento do agendamento. Alguns procedimentos precisam de avaliação antes; se for o caso, entro em contato com você." },
];

async function main() {
  // Configurações gerais
  await prisma.businessSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Aurora Studio",
      slogan: "Beleza no detalhe, cuidado em cada traço.",
      about: "Um espaço tranquilo para cuidar do olhar e da pele, com atendimento individual e hora marcada.",
      ownerName: "Nome da proprietária",
      ownerBio: "Escreva aqui um pouco sobre a sua trajetória, formação e jeito de atender.",
      paymentMethods: "Pix, cartão de débito e crédito, dinheiro.",
      cancellationPolicy:
        "Cancelamentos e remarcações devem ser feitos com pelo menos 5 horas de antecedência. Em caso de dúvida sobre o sinal, fale comigo pelo WhatsApp.",
      bookingInstructions:
        "Chegue com alguns minutos de antecedência. Se possível, venha sem maquiagem na região do procedimento.",
      minAdvanceHours: 24,
      cancelMinHours: 5,
      depositEnabled: true,
      depositCents: 1500,
      holdMinutes: 60,
    },
  });

  // Administradora
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no arquivo .env");
  if (password.length < 10) throw new Error("ADMIN_PASSWORD precisa ter pelo menos 10 caracteres");

  const admin = await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      name: process.env.ADMIN_NAME || "Proprietária",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  // Profissional padrão
  let pro = await prisma.professional.findFirst({ where: { isDefault: true } });
  if (!pro) {
    pro = await prisma.professional.create({
      data: { name: admin.name, isDefault: true, adminUserId: admin.id },
    });
  }

  // Horários de atendimento
  const existentes = await prisma.workingSlot.count({ where: { professionalId: pro.id } });
  if (existentes === 0) {
    const slots: { professionalId: string; weekday: number; time: string }[] = [];
    for (const weekday of [2, 3, 4, 5]) for (const time of TER_A_SEX) slots.push({ professionalId: pro.id, weekday, time });
    for (const time of SABADO) slots.push({ professionalId: pro.id, weekday: 6, time });
    await prisma.workingSlot.createMany({ data: slots });
  }

  // Categorias e serviços
  for (const c of CATEGORIAS) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }
  for (const s of SERVICOS) {
    const cat = await prisma.category.findUnique({ where: { slug: s.category } });
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {},
      create: {
        slug: s.slug,
        name: s.name,
        description: s.description,
        durationMinutes: s.durationMinutes,
        order: s.order,
        categoryId: cat?.id,
      },
    });
  }

  if ((await prisma.faq.count()) === 0) await prisma.faq.createMany({ data: FAQS });

  console.log("Dados iniciais prontos. Acesse /admin com", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
