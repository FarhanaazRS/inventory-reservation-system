import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const reservationSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number().min(1),
});

export async function POST(req: NextRequest) {
  try {
    // Parse body
    const body = await req.json();

    // Validate body
    const parsed = reservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // Optional idempotency support
    const idempotencyKey =
      req.headers.get("Idempotency-Key");

    if (idempotencyKey) {
      const cached = await redis.get(idempotencyKey);

      if (cached) {
        return NextResponse.json(cached);
      }
    }

    // Distributed Redis lock
    const lockKey = `lock:${productId}:${warehouseId}`;

    const acquired = await redis.set(
      lockKey,
      "locked",
      {
        nx: true,
        ex: 10,
      }
    );

    if (!acquired) {
      return NextResponse.json(
        {
          error:
            "Another reservation is currently processing",
        },
        { status: 409 }
      );
    }

    try {
      // Atomic transaction
      const reservation = await prisma.$transaction(
        async (tx) => {
          const stock = await tx.stock.findFirst({
            where: {
              productId,
              warehouseId,
            },
          });

          if (!stock) {
            throw new Error("STOCK_NOT_FOUND");
          }

          const available =
            stock.total - stock.reserved;

          if (available < quantity) {
            throw new Error("INSUFFICIENT_STOCK");
          }

          // Increment reserved stock
          await tx.stock.update({
            where: {
              id: stock.id,
            },
            data: {
              reserved: {
                increment: quantity,
              },
            },
          });

          // Create reservation
          return tx.reservation.create({
            data: {
              productId,
              warehouseId,
              quantity,
              status: "PENDING",
              expiresAt: new Date(
                Date.now() + 10 * 60 * 1000
              ),
            },
            include: {
              product: true,
              warehouse: true,
            },
          });
        }
      );

      // Save idempotent response
      if (idempotencyKey) {
        await redis.set(
          idempotencyKey,
          reservation,
          {
            ex: 600,
          }
        );
      }

      return NextResponse.json(reservation);
    } finally {
      // Always release Redis lock
      await redis.del(lockKey);
    }
  } 
  catch (error: unknown) {
  console.error(error);

  if (error instanceof Error) {
    if (error.message === "STOCK_NOT_FOUND") {
      return NextResponse.json(
        {
          error: "Stock not found",
        },
        { status: 404 }
      );
    }

    if (
      error.message === "INSUFFICIENT_STOCK"
    ) {
      return NextResponse.json(
        {
          error:
            "Not enough stock available",
        },
        { status: 409 }
      );
    }
  }

  return NextResponse.json(
    {
      error: "Internal server error",
    },
    { status: 500 }
  );
}
}