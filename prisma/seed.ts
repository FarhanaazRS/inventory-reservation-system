import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Create warehouses
  const mumbai = await prisma.warehouse.create({
    data: { name: "Mumbai Central", location: "Mumbai, Maharashtra" },
  });
  const delhi = await prisma.warehouse.create({
    data: { name: "Delhi North Hub", location: "Delhi, NCR" },
  });
  const bangalore = await prisma.warehouse.create({
    data: { name: "Bangalore Tech Park", location: "Bangalore, Karnataka" },
  });

  // Create products
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

  // Create stock for each product in each warehouse
  const stockData = [
    // Sony Headphones
    { productId: products[0].id, warehouseId: mumbai.id, total: 15, reserved: 0 },
    { productId: products[0].id, warehouseId: delhi.id, total: 8, reserved: 0 },
    { productId: products[0].id, warehouseId: bangalore.id, total: 3, reserved: 0 },
    // AirPods Pro
    { productId: products[1].id, warehouseId: mumbai.id, total: 25, reserved: 0 },
    { productId: products[1].id, warehouseId: delhi.id, total: 12, reserved: 0 },
    { productId: products[1].id, warehouseId: bangalore.id, total: 1, reserved: 0 }, // low stock!
    // Galaxy Watch
    { productId: products[2].id, warehouseId: mumbai.id, total: 20, reserved: 0 },
    { productId: products[2].id, warehouseId: delhi.id, total: 5, reserved: 0 },
    { productId: products[2].id, warehouseId: bangalore.id, total: 10, reserved: 0 },
    // iPad Air
    { productId: products[3].id, warehouseId: mumbai.id, total: 7, reserved: 0 },
    { productId: products[3].id, warehouseId: delhi.id, total: 2, reserved: 0 }, // low stock!
    { productId: products[3].id, warehouseId: bangalore.id, total: 15, reserved: 0 },
    // Logitech Mouse
    { productId: products[4].id, warehouseId: mumbai.id, total: 50, reserved: 0 },
    { productId: products[4].id, warehouseId: delhi.id, total: 30, reserved: 0 },
    { productId: products[4].id, warehouseId: bangalore.id, total: 20, reserved: 0 },
  ];

  await prisma.stock.createMany({ data: stockData });

  console.log("✅ Seed complete!");
  console.log(`   ${products.length} products created`);
  console.log(`   3 warehouses created`);
  console.log(`   ${stockData.length} stock entries created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });