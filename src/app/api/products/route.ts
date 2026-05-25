import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/reservations";

export const runtime = "nodejs";

export async function GET() {
  try {
    await releaseExpiredReservations();

    const products = await prisma.product.findMany({
      include: {
        stock: {
          include: { warehouse: true },
          orderBy: { warehouse: { name: "asc" } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const response = products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      stock: product.stock.map((stock) => ({
        warehouseId: stock.warehouseId,
        warehouseName: stock.warehouse.name,
        warehouseLocation: stock.warehouse.location,
        totalUnits: stock.totalUnits,
        reservedUnits: stock.reservedUnits,
        availableStock: stock.totalUnits - stock.reservedUnits,
      })),
      totalAvailable: product.stock.reduce(
        (sum, stock) => sum + stock.totalUnits - stock.reservedUnits,
        0
      ),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
