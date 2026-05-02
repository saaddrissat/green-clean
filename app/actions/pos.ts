"use server";

import { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

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
  paymentMethod: "CASH" | "CARD" | "MOBILE_MONEY";
  cashierId: string;
  items: CreateOrderItemInput[];
};

type CreateCategoryInput = {
  name: string;
  icon?: string;
};

type CreateProductInput = {
  name: string;
  basePrice: number;
  categoryId: string;
  optionLabel: string;
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
    const categories = await prisma.category.findMany({
      where: { isActive: true },
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
      icon: category.icon,
      products: category.products.map((product) => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        imageUrl: product.imageUrl,
        basePrice: Number(product.basePrice),
        options: product.options.map((option) => ({
          id: option.id,
          label: option.label,
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
    const clients = await prisma.client.findMany({
      orderBy: [{ totalOrders: "desc" }, { fullName: "asc" }],
      take: 50,
    });

    return clients.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      phone: client.phone,
      email: client.email,
      totalOrders: client.totalOrders,
    }));
  } catch (error) {
    throw toSafeDbError(error, "lecture clients");
  }
}

export async function createOrderAction(input: CreateOrderInput) {
  if (!input.dueDate || input.items.length === 0) {
    throw new Error("Commande invalide: date et articles requis.");
  }

  const dueDate = new Date(input.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    throw new Error("Date de rendu invalide.");
  }

  const total = input.items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
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
    let clientId: string | null = null;
    const clientName = input.clientName?.trim();
    if (clientName) {
      const existing = await tx.client.findFirst({
        where: {
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
            data: { fullName: clientName, totalOrders: 1 },
          });
      clientId = client.id;
    }

    return tx.order.create({
      data: {
        orderNumber,
        status: OrderStatus.RECU,
        paymentMethod,
        total: new Prisma.Decimal(total),
        dueDate,
        cashierId: input.cashierId,
        clientId,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            optionLabel: item.optionLabel,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            lineTotal: new Prisma.Decimal(item.unitPrice * item.quantity),
          })),
        },
      },
    });
  });

  revalidatePath("/caisse");
  revalidatePath("/clients");

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    total: Number(order.total),
  };
}

export async function getOrdersAction() {
  const orders = await prisma.order.findMany({
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
  const current = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });

  if (!current) {
    throw new Error("Commande introuvable.");
  }

  const currentIndex = statusFlow.indexOf(current.status);
  const nextStatus = targetStatus ?? statusFlow[Math.min(currentIndex + 1, statusFlow.length - 1)];

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: nextStatus },
    select: { id: true, status: true },
  });

  revalidatePath("/suivi");
  return updated;
}

export async function createCategoryAction(input: CreateCategoryInput) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Le nom de categorie est requis.");
  }
  try {
    const created = await prisma.category.create({
      data: {
        name,
        icon: input.icon?.trim() || "Package",
        isActive: true,
      },
      select: { id: true, name: true, icon: true },
    });

    revalidatePath("/caisse");
    return created;
  } catch (error) {
    throw toSafeDbError(error, "creation categorie");
  }
}

export async function createProductAction(input: CreateProductInput) {
  const name = input.name.trim();
  const optionLabel = input.optionLabel.trim();
  const imageUrl = input.imageUrl?.trim() || null;

  if (!name || !input.categoryId || !optionLabel) {
    throw new Error("Nom, categorie et option sont requis.");
  }

  if (input.basePrice <= 0) {
    throw new Error("Le prix de base doit etre superieur a 0.");
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
        barcode,
        imageUrl,
        basePrice: new Prisma.Decimal(input.basePrice),
        categoryId: input.categoryId,
        isActive: true,
        options: {
          create: {
            label: optionLabel,
            priceModifier: new Prisma.Decimal(0),
          },
        },
      },
      include: {
        options: true,
      },
    });

    revalidatePath("/caisse");

    return {
      id: created.id,
      name: created.name,
      barcode: created.barcode,
      imageUrl: created.imageUrl,
      basePrice: Number(created.basePrice),
      categoryId: created.categoryId,
      options: created.options.map((option) => ({
        id: option.id,
        label: option.label,
        priceModifier: Number(option.priceModifier),
      })),
    };
  } catch (error) {
    throw toSafeDbError(error, "creation article");
  }
}

export async function createClientAction(input: CreateClientInput) {
  const fullName = input.fullName.trim();
  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;

  if (!fullName) {
    throw new Error("Le nom du client est requis.");
  }

  try {
    const created = await prisma.client.create({
      data: {
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
    };
  } catch (error) {
    throw toSafeDbError(error, "creation client");
  }
}

export async function getClientOrderHistoryAction(clientId: string) {
  if (!clientId?.trim()) {
    throw new Error("Client invalide.");
  }

  try {
    const orders = await prisma.order.findMany({
      where: { clientId },
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

export async function sendClientInvoiceAction(clientId: string) {
  if (!clientId?.trim()) {
    throw new Error("Client invalide.");
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, fullName: true, email: true },
    });

    if (!client) {
      throw new Error("Client introuvable.");
    }
    if (!client.email) {
      throw new Error("Ce client n'a pas d'email.");
    }

    const latestOrder = await prisma.order.findFirst({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      select: { orderNumber: true, total: true, createdAt: true },
    });

    if (!latestOrder) {
      throw new Error("Aucune commande à facturer pour ce client.");
    }

    // Placeholder: simulate invoice delivery until mailing service is wired.
    return {
      ok: true,
      recipient: client.email,
      orderNumber: latestOrder.orderNumber,
      total: Number(latestOrder.total),
    };
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith("Erreur base de donnees")) {
      throw error;
    }
    throw toSafeDbError(error, "envoi facture client");
  }
}

export async function deleteClientAction(clientId: string) {
  if (!clientId?.trim()) {
    throw new Error("Client invalide.");
  }

  try {
    await prisma.client.delete({
      where: { id: clientId },
    });
    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    throw toSafeDbError(error, "suppression client");
  }
}

export async function getRecentClientOrdersAction() {
  try {
    const orders = await prisma.order.findMany({
      where: { clientId: { not: null } },
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
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        orders: {
          where: {
            status: {
              not: OrderStatus.LIVRE,
            },
          },
          select: { total: true },
        },
      },
    });

    return clients.map((client) => ({
      clientId: client.id,
      balanceDue: client.orders.reduce((sum, order) => sum + Number(order.total), 0),
    }));
  } catch (error) {
    throw toSafeDbError(error, "solde clients");
  }
}

export async function getClientDetailsAction(clientId: string) {
  if (!clientId?.trim()) {
    throw new Error("Client invalide.");
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        totalOrders: true,
        createdAt: true,
      },
    });

    if (!client) {
      throw new Error("Client introuvable.");
    }

    const orders = await prisma.order.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const balanceDue = orders
      .filter((order) => order.status !== OrderStatus.LIVRE)
      .reduce((sum, order) => sum + Number(order.total), 0);

    return {
      client: {
        id: client.id,
        fullName: client.fullName,
        phone: client.phone,
        email: client.email,
        totalOrders: client.totalOrders,
        createdAt: client.createdAt.toISOString(),
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
