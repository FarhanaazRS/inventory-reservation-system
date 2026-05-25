import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const [mumbai, delhi, bangalore] = await Promise.all([
    prisma.warehouse.create({
      data: { name: "Mumbai Central", location: "Mumbai, Maharashtra" },
    }),
    prisma.warehouse.create({
      data: { name: "Delhi North Hub", location: "Delhi, NCR" },
    }),
    prisma.warehouse.create({
      data: { name: "Bangalore Tech Park", location: "Bangalore, Karnataka" },
    }),
  ]);

  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Sony WH-1000XM5 Headphones",
        description: "Industry-leading noise cancelling with 30-hour battery life",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Apple AirPods Pro (2nd Gen)",
        description: "Active Noise Cancellation and Transparency mode",
        imageUrl: "https://images.unsplash.com/photo-1603351154351-5e2d0600bb77?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Samsung Galaxy Watch 6",
        description: "Advanced health monitoring with 40-hour battery",
        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "iPad Air (5th Gen)",
        description: "Supercharged by M1 chip with USB-C connectivity",
        imageUrl: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Logitech MX Master 3S",
        description: "Advanced wireless mouse with ultra-fast scrolling",
        imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400",
      },
    }),
  ]);

  const stockData = [
    { productId: products[0].id, warehouseId: mumbai.id, totalUnits: 15, reservedUnits: 0 },
    { productId: products[0].id, warehouseId: delhi.id, totalUnits: 8, reservedUnits: 0 },
    { productId: products[0].id, warehouseId: bangalore.id, totalUnits: 3, reservedUnits: 0 },
    { productId: products[1].id, warehouseId: mumbai.id, totalUnits: 25, reservedUnits: 0 },
    { productId: products[1].id, warehouseId: delhi.id, totalUnits: 12, reservedUnits: 0 },
    { productId: products[1].id, warehouseId: bangalore.id, totalUnits: 1, reservedUnits: 0 },
    { productId: products[2].id, warehouseId: mumbai.id, totalUnits: 20, reservedUnits: 0 },
    { productId: products[2].id, warehouseId: delhi.id, totalUnits: 5, reservedUnits: 0 },
    { productId: products[2].id, warehouseId: bangalore.id, totalUnits: 10, reservedUnits: 0 },
    { productId: products[3].id, warehouseId: mumbai.id, totalUnits: 7, reservedUnits: 0 },
    { productId: products[3].id, warehouseId: delhi.id, totalUnits: 2, reservedUnits: 0 },
    { productId: products[3].id, warehouseId: bangalore.id, totalUnits: 15, reservedUnits: 0 },
    { productId: products[4].id, warehouseId: mumbai.id, totalUnits: 50, reservedUnits: 0 },
    { productId: products[4].id, warehouseId: delhi.id, totalUnits: 30, reservedUnits: 0 },
    { productId: products[4].id, warehouseId: bangalore.id, totalUnits: 20, reservedUnits: 0 },
  ];

  await prisma.stock.createMany({ data: stockData });

  console.log("Seed complete.");
  console.log(`${products.length} products created`);
  console.log("3 warehouses created");
  console.log(`${stockData.length} stock entries created`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
