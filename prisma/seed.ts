import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categorySeeds = [
  { name: "Chemises", icon: "Shirt" },
  { name: "Pantalons", icon: "Package" },
  { name: "Costumes", icon: "Briefcase" },
  { name: "Linge Maison", icon: "Bed" },
  { name: "Premium", icon: "Sparkles" },
];

const productSeeds = [
  {
    name: "Chemise",
    barcode: "GC1001",
    basePrice: 2500,
    category: "Chemises",
    options: [
      { label: "Lavage + Repassage", priceModifier: 0 },
      { label: "Repassage seul", priceModifier: -700 },
    ],
  },
  {
    name: "Chemise delicate",
    barcode: "GC1002",
    basePrice: 3200,
    category: "Chemises",
    options: [
      { label: "Lavage main + Repassage", priceModifier: 600 },
      { label: "Repassage seul", priceModifier: -900 },
    ],
  },
  {
    name: "Pantalon",
    barcode: "GC2001",
    basePrice: 2800,
    category: "Pantalons",
    options: [
      { label: "Lavage + Repassage", priceModifier: 0 },
      { label: "Repassage seul", priceModifier: -600 },
    ],
  },
  {
    name: "Jean",
    barcode: "GC2002",
    basePrice: 3000,
    category: "Pantalons",
    options: [
      { label: "Lavage + Repassage", priceModifier: 0 },
      { label: "Lavage seul", priceModifier: -500 },
    ],
  },
  {
    name: "Costume 2 pieces",
    barcode: "GC3001",
    basePrice: 8500,
    category: "Costumes",
    options: [
      { label: "Nettoyage complet", priceModifier: 0 },
      { label: "Vapeur + Repassage", priceModifier: -2000 },
    ],
  },
  {
    name: "Veste",
    barcode: "GC3002",
    basePrice: 5200,
    category: "Costumes",
    options: [
      { label: "Nettoyage complet", priceModifier: 0 },
      { label: "Repassage seul", priceModifier: -1200 },
    ],
  },
  {
    name: "Drap",
    barcode: "GC4001",
    basePrice: 2200,
    category: "Linge Maison",
    options: [
      { label: "Lavage + Pliage", priceModifier: 0 },
      { label: "Repassage seul", priceModifier: -500 },
    ],
  },
  {
    name: "Couette",
    barcode: "GC4002",
    basePrice: 9000,
    category: "Linge Maison",
    options: [
      { label: "Nettoyage standard", priceModifier: 0 },
      { label: "Desinfection anti-acariens", priceModifier: 1500 },
    ],
  },
  {
    name: "Robe de soiree",
    barcode: "GC5001",
    basePrice: 12000,
    category: "Premium",
    options: [
      { label: "Traitement premium complet", priceModifier: 0 },
      { label: "Retouche legere", priceModifier: 2000 },
    ],
  },
  {
    name: "Boubou",
    barcode: "GC5002",
    basePrice: 7000,
    category: "Premium",
    options: [
      { label: "Lavage + Repassage", priceModifier: 0 },
      { label: "Repassage seul", priceModifier: -1500 },
    ],
  },
];

async function main() {
  const categoryByName = new Map<string, string>();
  for (const category of categorySeeds) {
    const saved = await prisma.category.upsert({
      where: { name: category.name },
      update: { icon: category.icon, isActive: true },
      create: category,
    });
    categoryByName.set(category.name, saved.id);
  }

  for (const product of productSeeds) {
    const categoryId = categoryByName.get(product.category);
    if (!categoryId) {
      continue;
    }

    const savedProduct = await prisma.product.upsert({
      where: { barcode: product.barcode },
      update: {
        name: product.name,
        basePrice: product.basePrice,
        categoryId,
        isActive: true,
      },
      create: {
        name: product.name,
        barcode: product.barcode,
        basePrice: product.basePrice,
        categoryId,
      },
    });

    await prisma.productServiceOption.deleteMany({
      where: { productId: savedProduct.id },
    });

    await prisma.productServiceOption.createMany({
      data: product.options.map((option) => ({
        productId: savedProduct.id,
        label: option.label,
        priceModifier: option.priceModifier,
      })),
    });
  }

  await prisma.client.upsert({
    where: { phone: "+221700000001" },
    update: { fullName: "Client Walk-in" },
    create: {
      fullName: "Client Walk-in",
      phone: "+221700000001",
      email: "walkin@green-clean.local",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
