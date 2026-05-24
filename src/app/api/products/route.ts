import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stock: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Shape the response to show available (non-reserved) stock
    const shaped = products.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      stock: product.stock.map((s: any) => ({
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        warehouseLocation: s.warehouse.location,
        total: s.total,
        reserved: s.reserved,
        available: s.total - s.reserved, // ← KEY: what customers can actually buy
      })),
      totalAvailable: product.stock.reduce(
        (sum: number, s: any) => sum + (s.total - s.reserved),
        0
      ),
    }));

    return NextResponse.json(shaped);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}