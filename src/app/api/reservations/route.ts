import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  releaseExpiredReservations,
  RESERVATION_TTL_MS,
} from "@/lib/reservations";

export const runtime = "nodejs";

const reservationSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.coerce.number().int().positive().max(1000),
});

function getIdempotencyKey(req: NextRequest) {
  const key = req.headers.get("Idempotency-Key")?.trim();
  return key ? key.slice(0, 255) : null;
}

async function findReservationByKey(idempotencyKey: string) {
  return prisma.reservation.findFirst({
    where: { idempotencyKey },
    include: { product: true, warehouse: true },
  });
}

export async function POST(req: NextRequest) {
  try {
    await releaseExpiredReservations();

    const body = await req.json().catch(() => null);
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
    const idempotencyKey = getIdempotencyKey(req);

    if (idempotencyKey) {
      const existing = await findReservationByKey(idempotencyKey);

      if (existing) {
        const sameRequest =
          existing.productId === productId &&
          existing.warehouseId === warehouseId &&
          existing.quantity === quantity;

        return NextResponse.json(
          sameRequest
            ? existing
            : { error: "Idempotency-Key was already used for a different reservation" },
          { status: sameRequest ? 200 : 409 }
        );
      }
    }

    const reservation = await prisma.$transaction(async (tx) => {
      const updatedStock = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "Stock"
        SET "reserved" = "reserved" + ${quantity}
        WHERE "productId" = ${productId}
          AND "warehouseId" = ${warehouseId}
          AND ("total" - "reserved") >= ${quantity}
        RETURNING id
      `;

      if (updatedStock.length === 0) {
        const stock = await tx.stock.findUnique({
          where: {
            productId_warehouseId: { productId, warehouseId },
          },
          select: { id: true },
        });

        throw new Error(stock ? "INSUFFICIENT_STOCK" : "STOCK_NOT_FOUND");
      }

      return tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "pending",
          expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          idempotencyKey,
        },
        include: {
          product: true,
          warehouse: true,
        },
      });
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const idempotencyKey = getIdempotencyKey(req);
      const existing = idempotencyKey
        ? await findReservationByKey(idempotencyKey)
        : null;

      if (existing) {
        return NextResponse.json(existing);
      }
    }

    if (error instanceof Error) {
      if (error.message === "STOCK_NOT_FOUND") {
        return NextResponse.json(
          { error: "Stock not found for product and warehouse" },
          { status: 404 }
        );
      }

      if (error.message === "INSUFFICIENT_STOCK") {
        return NextResponse.json(
          { error: "Not enough stock available" },
          { status: 409 }
        );
      }
    }

    console.error("POST /api/reservations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
