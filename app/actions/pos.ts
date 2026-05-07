"use server";

import { NotificationCategory, NotificationPriority, OrderStatus, PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { notifyInvoiceSentAction } from "@/app/actions/notifications";
import { getSessionUser } from "@/lib/auth/get-session";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail } from "@/lib/smtp-mailer";

async function requireAccountUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Non authentifié.");
  }
  return user.id;
}

type CreateOrderItemInput = {
  productId: string;
  productName: string;
  optionLabel: string;
  quantity: number;
  unitPrice: number;
};

type CreateOrderInput = {
  clientName?: string;
  dueDate: string;
  paymentMethod: "CASH" | "CARD" | "CREDIT";
  expressFee?: number;
  items: CreateOrderItemInput[];
};

type CreateCategoryInput = {
  name: string;
  icon?: string;
  nameAr?: string;
};

type CreateProductInput = {
  name: string;
  basePrice: number;
  categoryId: string;
  optionLabel: string;
  optionLabelAr?: string;
  nameAr?: string;
  imageUrl?: string;
};

type CreateClientInput = {
  fullName: string;
  phone?: string;
  email?: string;
};

const statusFlow: OrderStatus[] = [
  OrderStatus.RECU,
  OrderStatus.EN_COURS,
  OrderStatus.TERMINE,
  OrderStatus.LIVRE,
];

function toSafeDbError(error: unknown, context: string) {
  const message = error instanceof Error ? error.message : "Erreur base de donnees inconnue.";
  if (message.includes("P1010") || message.includes("denied access")) {
    return new Error(`Acces base refuse (${context}). Verifiez DATABASE_URL et les droits PostgreSQL.`);
  }
  if (message.includes("P1001") || message.includes("connect")) {
    return new Error(`Base temporairement indisponible (${context}). Reessayez dans quelques secondes.`);
  }
  return new Error(`Erreur base de donnees (${context}): ${message}`);
}

export async function getPosCatalogAction() {
  try {
    const userId = await requireAccountUserId();
    const categories = await prisma.category.findMany({
      where: { isActive: true, userId },
      orderBy: { name: "asc" },
      include: {
        products: {
          where: { isActive: true },
          include: { options: true },
          orderBy: { name: "asc" },
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      nameAr: category.nameAr,
      icon: category.icon,
      products: category.products.map((product) => ({
        id: product.id,
        name: product.name,
        nameAr: product.nameAr,
        barcode: product.barcode,
        imageUrl: product.imageUrl,
        basePrice: Number(product.basePrice),
        options: product.options.map((option) => ({
          id: option.id,
          label: option.label,
          labelAr: option.labelAr,
          priceModifier: Number(option.priceModifier),
        })),
      })),
    }));
  } catch (error) {
    throw toSafeDbError(error, "lecture catalogue");
  }
}

export async function getClientsAction() {
  try {
    const userId = await requireAccountUserId();
    const clients = await prisma.client.findMany({
      where: { userId },
      orderBy: [{ totalOrders: "desc" }, { fullName: "asc" }],
      take: 50,
    });

    return clients.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
      totalOrders: client.totalOrders,
      storeCredit: Number(client.storeCredit),
    }));
  } catch (error) {
    throw toSafeDbError(error, "lecture clients");
  }
}

export async function createOrderAction(input: CreateOrderInput) {
  if (!input.dueDate || input.items.length === 0) {
    throw new Error("Commande invalide: date et articles requis.");
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    throw new Error("Non authentifié.");
  }
  const userId = sessionUser.id;
  const dueDate = new Date(input.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    throw new Error("Date de rendu invalide.");
  }

  const baseTotal = input.items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const expressFee = Number.isFinite(input.expressFee) ? Math.max(0, Number(input.expressFee)) : 0;
  const total = baseTotal + expressFee;
  const year = new Date().getFullYear();
  let orderNumber = "";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const candidate = `BL-${year}-${randomPart}`;
    const existing = await prisma.order.findUnique({
      where: { orderNumber: candidate },
      select: { id: true },
    });
    if (!existing) {
      orderNumber = candidate;
      break;
    }
  }
  if (!orderNumber) {
    orderNumber = `BL-${year}-${Date.now().toString().slice(-4)}`;
  }
  const paymentMethod = input.paymentMethod as PaymentMethod;

  const order = await prisma.$transaction(async (tx) => {
    for (const item of input.items) {
      const productOk = await tx.product.findFirst({
        where: { id: item.productId, category: { userId } },
        select: { id: true },
      });
      if (!productOk) {
        throw new Error("Article invalide ou catalogue expire : rechargez la caisse.");
      }
    }

    let clientId: string | null = null;
    const clientName = input.clientName?.trim();
    if (clientName) {
      const existing = await tx.client.findFirst({
        where: {
          userId,
          fullName: {
            equals: clientName,
            mode: "insensitive",
          },
        },
      });
      const client = existing
        ? await tx.client.update({
            where: { id: existing.id },
            data: { totalOrders: { increment: 1 } },
          })
        : await tx.client.create({
            data: { userId, fullName: clientName, totalOrders: 1 },
          });
      clientId = client.id;
    }

    return tx.order.create({
      data: {
        userId,
        orderNumber,
        status: OrderStatus.RECU,
        paymentMethod,
        total,
        dueDate,
        cashierId: userId,
        clientId,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            optionLabel: item.optionLabel,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.unitPrice * item.quantity,
          })),
        },
      },
    });
  });

  revalidatePath("/");
  revalidatePath("/caisse");
  revalidatePath("/clients");
  revalidatePath("/calendrier");
  revalidatePath("/notifications");

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
  };
}

export async function getCalendarOrderEventsAction() {
  const userId = await requireAccountUserId();
  const orders = await prisma.order.findMany({
    where: { userId, status: { not: OrderStatus.ANNULE } },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      orderNumber: true,
      dueDate: true,
      status: true,
      total: true,
      client: {
        select: {
          fullName: true,
        },
      },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    dueDate: order.dueDate.toISOString(),
    status: order.status,
    total: Number(order.total),
    clientName: order.client?.fullName ?? null,
  }));
}

export async function getOrdersAction() {
  const userId = await requireAccountUserId();
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      client: true,
      items: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    total: Number(order.total),
    dueDate: order.dueDate.toISOString(),
    createdAt: order.createdAt.toISOString(),
    cashierId: order.cashierId,
    client: order.client
      ? {
          id: order.client.id,
          fullName: order.client.fullName,
          phone: order.client.phone,
          email: order.client.email,
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      optionLabel: item.optionLabel,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
  }));
}

export async function updateOrderStatusAction(orderId: string, targetStatus?: OrderStatus) {
  const userId = await requireAccountUserId();
  const current = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, status: true },
  });

  if (!current) {
    throw new Error("Commande introuvable.");
  }
  if (current.status === OrderStatus.ANNULE) {
    throw new Error("Commande annulée : statut non modifiable.");
  }

  const currentIndex = statusFlow.indexOf(current.status);
  const nextStatus = targetStatus ?? statusFlow[Math.min(currentIndex + 1, statusFlow.length - 1)];

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: nextStatus },
    select: { id: true, status: true },
  });

  revalidatePath("/");
  revalidatePath("/suivi");
  revalidatePath("/notifications");
  return updated;
}

type CancelOrderInput = {
  orderId: string;
  reason: string;
};

export async function cancelOrderAction(input: CancelOrderInput) {
  const userId = await requireAccountUserId();
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("La raison d'annulation est obligatoire.");
  }

  const order = await prisma.order.findFirst({
    where: { id: input.orderId, userId },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
    },
  });

  if (!order) {
    throw new Error("Commande introuvable.");
  }
  if (order.status === OrderStatus.LIVRE) {
    throw new Error("Impossible d'annuler une commande déjà livrée.");
  }
  if (order.status === OrderStatus.ANNULE) {
    throw new Error("Commande déjà annulée.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.ANNULE },
    });
    await tx.cancelledOrderAudit.create({
      data: {
        userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason,
        actorId: userId,
        lostAmount: Number(order.total),
      },
    });
  });

  await createNotification({
    userId,
    type: NotificationCategory.SECURITY_AUDIT,
    priority: NotificationPriority.CRITICAL,
    title: "Commande annulée",
    message: `${order.orderNumber} annulée. Raison : ${reason}. Montant perdu : ${Number(order.total).toFixed(0)} DH.`,
    link: "/notifications/commandes-annulees",
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      reason,
      lostAmount: Number(order.total),
      actorId: userId,
    },
  });

  revalidatePath("/");
  revalidatePath("/suivi");
  revalidatePath("/notifications");
  revalidatePath("/notifications/commandes-annulees");
  return { ok: true as const, orderNumber: order.orderNumber };
}

export async function listCancelledOrdersAuditAction() {
  const userId = await requireAccountUserId();
  const rows = await prisma.cancelledOrderAudit.findMany({
    where: { userId },
    orderBy: { cancelledAt: "desc" },
    take: 500,
  });
  return rows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    reason: row.reason,
    actorId: row.actorId,
    lostAmount: Number(row.lostAmount),
    cancelledAt: row.cancelledAt.toISOString(),
  }));
}

export async function createCategoryAction(input: CreateCategoryInput) {
  const userId = await requireAccountUserId();
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom de categorie est requis.");
  }
  const nameAr = input.nameAr?.trim() || null;
  try {
    const created = await prisma.category.create({
      data: {
        userId,
        name,
        nameAr,
        icon: input.icon?.trim() || "Package",
        isActive: true,
      },
      select: { id: true, name: true, nameAr: true, icon: true },
    });

    revalidatePath("/caisse");
    revalidatePath("/categories");
    return created;
  } catch (error) {
    throw toSafeDbError(error, "creation categorie");
  }
}

export async function createProductAction(input: CreateProductInput) {
  const name = input.name.trim();
  const nameAr = input.nameAr?.trim() || null;
  const optionLabel = input.optionLabel.trim();
  const optionLabelAr = input.optionLabelAr?.trim() || null;
  const imageUrl = input.imageUrl?.trim() || null;

  if (!name || !input.categoryId || !optionLabel) {
    throw new Error("Nom, categorie et option sont requis.");
  }

  if (input.basePrice <= 0) {
    throw new Error("Le prix de base doit etre superieur a 0.");
  }

  const userId = await requireAccountUserId();
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, userId },
    select: { id: true },
  });
  if (!category) {
    throw new Error("Categorie introuvable.");
  }

  if (imageUrl) {
    const isDataImage = imageUrl.startsWith("data:image/");
    if (!isDataImage) {
      try {
        const parsed = new URL(imageUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("invalid protocol");
        }
      } catch {
        throw new Error("L'image doit etre une URL valide (http/https) ou un fichier image.");
      }
    }
  }

  try {
    const year = new Date().getFullYear();
    let barcode = "";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      const candidate = `PRD-${year}-${randomPart}`;
      const existing = await prisma.product.findUnique({
        where: { barcode: candidate },
        select: { id: true },
      });
      if (!existing) {
        barcode = candidate;
        break;
      }
    }
    if (!barcode) {
      barcode = `PRD-${year}-${Date.now().toString().slice(-4)}`;
    }

    const created = await prisma.product.create({
      data: {
        name,
        nameAr,
        barcode,
        imageUrl,
        basePrice: input.basePrice,
        categoryId: input.categoryId,
        isActive: true,
        options: {
          create: {
            label: optionLabel,
            labelAr: optionLabelAr,
            priceModifier: 0,
          },
        },
      },
      include: {
        options: true,
      },
    });

    revalidatePath("/caisse");
    revalidatePath("/categories");

    return {
      id: created.id,
      name: created.name,
      nameAr: created.nameAr,
      barcode: created.barcode,
      imageUrl: created.imageUrl,
      basePrice: Number(created.basePrice),
      categoryId: created.categoryId,
      options: created.options.map((option) => ({
        id: option.id,
        label: option.label,
        labelAr: option.labelAr,
        priceModifier: Number(option.priceModifier),
      })),
    };
  } catch (error) {
    throw toSafeDbError(error, "creation article");
  }
}

type UpdateCategoryInput = { id: string; name: string; icon?: string; nameAr?: string | null };

export async function updateCategoryAction(input: UpdateCategoryInput) {
  const userId = await requireAccountUserId();
  const name = input.name.trim();
  if (!input.id || !name) {
    throw new Error("Categorie invalide.");
  }
  try {
    const updated = await prisma.category.updateMany({
      where: { id: input.id, userId },
      data: {
        name,
        nameAr: input.nameAr === undefined ? undefined : input.nameAr?.trim() || null,
        icon: input.icon?.trim() || "Package",
      },
    });
    if (updated.count === 0) {
      throw new Error("Categorie introuvable.");
    }
    revalidatePath("/caisse");
    revalidatePath("/categories");
  } catch (error) {
    throw toSafeDbError(error, "modification categorie");
  }
}

export async function archiveCategoryAction(categoryId: string) {
  if (!categoryId?.trim()) {
    throw new Error("Categorie invalide.");
  }
  const userId = await requireAccountUserId();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { categoryId, category: { userId } },
        data: { isActive: false },
      });
      await tx.category.updateMany({
        where: { id: categoryId, userId },
        data: { isActive: false },
      });
    });
    revalidatePath("/caisse");
    revalidatePath("/categories");
  } catch (error) {
    throw toSafeDbError(error, "suppression categorie");
  }
}

export async function updateProductAction(input: {
  id: string;
  name: string;
  basePrice: number;
  nameAr?: string | null;
  optionLabelAr?: string | null;
}) {
  const userId = await requireAccountUserId();
  const name = input.name.trim();
  if (!input.id || !name) {
    throw new Error("Article invalide.");
  }
  if (!Number.isFinite(input.basePrice) || input.basePrice <= 0) {
    throw new Error("Le prix doit etre superieur a 0.");
  }
  try {
    const owned = await prisma.product.findFirst({
      where: { id: input.id, category: { userId } },
      select: { id: true },
    });
    if (!owned) {
      throw new Error("Article introuvable.");
    }
    await prisma.product.update({
      where: { id: owned.id },
      data: {
        name,
        basePrice: input.basePrice,
        nameAr: input.nameAr === undefined ? undefined : input.nameAr?.trim() || null,
      },
    });
    if (input.optionLabelAr !== undefined) {
      const firstOption = await prisma.productServiceOption.findFirst({
        where: { productId: owned.id },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (firstOption) {
        await prisma.productServiceOption.update({
          where: { id: firstOption.id },
          data: { labelAr: input.optionLabelAr?.trim() || null },
        });
      }
    }
    revalidatePath("/caisse");
    revalidatePath("/categories");
  } catch (error) {
    throw toSafeDbError(error, "modification article");
  }
}

export async function archiveProductAction(productId: string) {
  if (!productId?.trim()) {
    throw new Error("Article invalide.");
  }
  const userId = await requireAccountUserId();
  try {
    const owned = await prisma.product.findFirst({
      where: { id: productId, category: { userId } },
      select: { id: true },
    });
    if (!owned) {
      throw new Error("Article introuvable.");
    }
    await prisma.product.update({
      where: { id: owned.id },
      data: { isActive: false },
    });
    revalidatePath("/caisse");
    revalidatePath("/categories");
  } catch (error) {
    throw toSafeDbError(error, "suppression article");
  }
}

export async function createClientAction(input: CreateClientInput) {
  const userId = await requireAccountUserId();
  const fullName = input.fullName.trim();
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;

  if (!fullName) {
    throw new Error("Le nom du client est requis.");
  }

  try {
    if (phone) {
      const dupPhone = await prisma.client.findFirst({
        where: { userId, phone },
        select: { id: true },
      });
      if (dupPhone) {
        throw new Error("Un client avec ce numero existe deja.");
      }
    }
    if (email) {
      const dupEmail = await prisma.client.findFirst({
        where: { userId, email },
        select: { id: true },
      });
      if (dupEmail) {
        throw new Error("Un client avec cet email existe deja.");
      }
    }

    const created = await prisma.client.create({
      data: {
        userId,
        fullName,
        phone,
        email,
        totalOrders: 0,
      },
    });

    revalidatePath("/clients");
    return {
      id: created.id,
      fullName: created.fullName,
      phone: created.phone,
      email: created.email,
      totalOrders: created.totalOrders,
      storeCredit: Number(created.storeCredit),
    };
  } catch (error) {
    throw toSafeDbError(error, "creation client");
  }
}

type UpdateClientInput = {
  clientId: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  storeCredit: number;
};

export async function updateClientAction(input: UpdateClientInput) {
  const userId = await requireAccountUserId();
  const fullName = input.fullName.trim();
  if (!fullName) {
    throw new Error("Le nom du client est requis.");
  }
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;

  if (!Number.isFinite(input.storeCredit)) {
    throw new Error("Le montant de credit magasin est invalide.");
  }

  try {
    const existing = await prisma.client.findFirst({
      where: { id: input.clientId, userId },
      select: { id: true, fullName: true, storeCredit: true },
    });
    if (!existing) {
      throw new Error("Client introuvable.");
    }
    const previousCredit = Number(existing.storeCredit);

    if (phone) {
      const dupPhone = await prisma.client.findFirst({
        where: {
          userId,
          phone,
          id: { not: input.clientId },
        },
        select: { id: true },
      });
      if (dupPhone) {
        throw new Error("Un autre client utilise ce numero.");
      }
    }
    if (email) {
      const dupEmail = await prisma.client.findFirst({
        where: {
          userId,
          email,
          id: { not: input.clientId },
        },
        select: { id: true },
      });
      if (dupEmail) {
        throw new Error("Un autre client utilise cet email.");
      }
    }

    await prisma.client.update({
      where: { id: input.clientId },
      data: {
        fullName,
        phone,
        email,
        storeCredit: input.storeCredit,
      },
    });

    if (previousCredit !== input.storeCredit) {
      await createNotification({
        userId,
        type: NotificationCategory.SECURITY_AUDIT,
        priority: NotificationPriority.CRITICAL,
        title: "Modification du solde client",
        message: `${existing.fullName} : crédit magasin ${previousCredit.toFixed(0)} → ${input.storeCredit.toFixed(0)} DH (hors paiement ticket).`,
        link: "/clients",
        metadata: {
          clientId: input.clientId,
          previousCredit,
          nextCredit: input.storeCredit,
        },
      });
    }

    revalidatePath("/clients");
    revalidatePath("/notifications");
    return { ok: true as const };
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith("Erreur base de donnees")) {
      throw error;
    }
    throw toSafeDbError(error, "modification client");
  }
}

export async function getClientOrderHistoryAction(clientId: string) {
  if (!clientId?.trim()) {
    throw new Error("Client invalide.");
  }

  try {
    const userId = await requireAccountUserId();
    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
      select: { id: true },
    });
    if (!client) {
      throw new Error("Client introuvable.");
    }

    const orders = await prisma.order.findMany({
      where: { clientId, userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      total: Number(order.total),
      createdAt: order.createdAt.toISOString(),
      dueDate: order.dueDate.toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        optionLabel: item.optionLabel,
        quantity: item.quantity,
      })),
    }));
  } catch (error) {
    throw toSafeDbError(error, "historique commandes client");
  }
}

export async function sendClientInvoiceAction(input: {
  clientId: string;
  smtpOverride?: {
    host?: string;
    port?: number | string;
    secure?: boolean;
    user?: string;
    pass?: string;
    from?: string;
  };
}) {
  if (!input.clientId?.trim()) {
    throw new Error("Client invalide.");
  }

  try {
    const userId = await requireAccountUserId();
    const data = await getClientLatestInvoiceAction(input.clientId);
    if (!data.email) {
      throw new Error("Ce client n'a pas d'email.");
    }

    await sendInvoiceEmail({
      to: data.email,
      clientName: data.clientName,
      orderNumber: data.orderNumber,
      total: data.total,
      orderDateIso: data.orderDateIso,
      smtpOverride: input.smtpOverride,
    });

    const session = await getSessionUser();
    if (session) {
      await notifyInvoiceSentAction({
        channel: "EMAIL",
        clientName: data.clientName,
        orderNumber: data.orderNumber,
        recipient: data.email,
      });
    }

    revalidatePath("/notifications");

    return {
      ok: true,
      recipient: data.email,
      orderNumber: data.orderNumber,
      total: data.total,
    };
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith("Erreur base de donnees")) {
      if (/Invalid login|auth|EAUTH|535|Username and Password not accepted/i.test(error.message)) {
        throw new Error(
          "Échec SMTP: authentification refusée. Utilisez un mot de passe d’application dans SMTP_PASS.",
        );
      }
      throw error;
    }
    throw toSafeDbError(error, "envoi facture client");
  }
}

export async function getClientLatestInvoiceAction(clientId: string) {
  if (!clientId?.trim()) {
    throw new Error("Client invalide.");
  }
  try {
    const userId = await requireAccountUserId();
    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
      select: { id: true, fullName: true, email: true, phone: true },
    });
    if (!client) {
      throw new Error("Client introuvable.");
    }
    const latestOrder = await prisma.order.findFirst({
      where: { clientId, userId },
      orderBy: { createdAt: "desc" },
      select: { orderNumber: true, total: true, createdAt: true },
    });
    if (!latestOrder) {
      throw new Error("Aucune commande à facturer pour ce client.");
    }
    return {
      clientId: client.id,
      clientName: client.fullName,
      email: client.email,
      phone: client.phone,
      orderNumber: latestOrder.orderNumber,
      total: Number(latestOrder.total),
      orderDateIso: latestOrder.createdAt.toISOString(),
    };
  } catch (error) {
    throw toSafeDbError(error, "recuperation facture client");
  }
}

export async function deleteClientAction(clientId: string) {
  if (!clientId?.trim()) {
    throw new Error("Client invalide.");
  }

  try {
    const userId = await requireAccountUserId();
    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
      select: { id: true, fullName: true },
    });
    if (!client) {
      throw new Error("Client introuvable.");
    }
    await prisma.client.delete({ where: { id: client.id } });

    await createNotification({
      userId,
      type: NotificationCategory.SECURITY_AUDIT,
      priority: NotificationPriority.CRITICAL,
      title: "Client supprimé",
      message: `Le profil client "${client.fullName}" a été supprimé.`,
      link: "/clients",
      metadata: { clientId: client.id },
    });

    revalidatePath("/clients");
    revalidatePath("/notifications");
    return { ok: true };
  } catch (error) {
    throw toSafeDbError(error, "suppression client");
  }
}

export async function getRecentClientOrdersAction() {
  try {
    const userId = await requireAccountUserId();
    const orders = await prisma.order.findMany({
      where: { userId, clientId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        client: {
          select: { id: true, fullName: true },
        },
      },
    });

    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      total: Number(order.total),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      client: order.client
        ? {
            id: order.client.id,
            fullName: order.client.fullName,
          }
        : null,
    }));
  } catch (error) {
    throw toSafeDbError(error, "dernieres commandes clients");
  }
}

export async function getClientBalancesAction() {
  try {
    const userId = await requireAccountUserId();
    const clients = await prisma.client.findMany({
      where: { userId },
      select: {
        id: true,
        storeCredit: true,
        orders: {
          where: {
            userId,
            status: {
              not: OrderStatus.LIVRE,
            },
          },
          select: { total: true },
        },
      },
    });

    return clients.map((client) => {
      const storeCredit = Number(client.storeCredit);
      const ordersOwed = client.orders.reduce((sum, order) => sum + Number(order.total), 0);
      const balanceDue = Math.max(0, ordersOwed - storeCredit);
      return {
        clientId: client.id,
        storeCredit,
        balanceDue,
      };
    });
  } catch (error) {
    throw toSafeDbError(error, "solde clients");
  }
}

export async function getClientDetailsAction(clientId: string) {
  if (!clientId?.trim()) {
    throw new Error("Client invalide.");
  }

  try {
    const userId = await requireAccountUserId();
    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        totalOrders: true,
        storeCredit: true,
        createdAt: true,
      },
    });

    if (!client) {
      throw new Error("Client introuvable.");
    }

    const orders = await prisma.order.findMany({
      where: { clientId, userId },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const ordersOwed = orders
      .filter((order) => order.status !== OrderStatus.LIVRE)
      .reduce((sum, order) => sum + Number(order.total), 0);
    const storeCredit = Number(client.storeCredit);
    const balanceDue = Math.max(0, ordersOwed - storeCredit);

    return {
      client: {
        id: client.id,
        fullName: client.fullName,
        phone: client.phone,
        email: client.email,
        totalOrders: client.totalOrders,
        createdAt: client.createdAt.toISOString(),
        storeCredit,
        ordersOwed,
        balanceDue,
      },
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMethod: order.paymentMethod,
        total: Number(order.total),
        createdAt: order.createdAt.toISOString(),
        dueDate: order.dueDate.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          optionLabel: item.optionLabel,
          quantity: item.quantity,
          lineTotal: Number(item.lineTotal),
        })),
      })),
    };
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith("Erreur base de donnees")) {
      throw error;
    }
    throw toSafeDbError(error, "details client");
  }
}
