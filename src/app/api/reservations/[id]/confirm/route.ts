import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ReservationRouteContext = {
  params: Promise<{ id: string }>;
};

type LockedReservation = {
  id: string;
  status: "pending" | "confirmed" | "released";
  expiresAt: Date;
  productId: string;
  warehouseId: string;
  quantity: number;
};

function getIdempotencyKey(req: NextRequest) {
  const key = req.headers.get("Idempotency-Key")?.trim();
  return key ? key.slice(0, 255) : null;
}

async function findConfirmedByKey(idempotencyKey: string) {
  return prisma.reservation.findFirst({
    where: { confirmIdempotencyKey: idempotencyKey },
    include: { product: true, warehouse: true },
  });
}

export async function POST(
  req: NextRequest,
  context: ReservationRouteContext
) {
  const { id } = await context.params;
  const idempotencyKey = getIdempotencyKey(req);

  try {
    if (idempotencyKey) {
      const existing = await findConfirmedByKey(idempotencyKey);

      if (existing) {
        return NextResponse.json(
          existing.id === id
            ? existing
            : { error: "Idempotency-Key was already used for another confirmation" },
          { status: existing.id === id ? 200 : 409 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const reservations = await tx.$queryRaw<LockedReservation[]>`
        SELECT id, status, "expiresAt", "productId", "warehouseId", quantity
        FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `;

      const reservation = reservations[0];

      if (!reservation) {
        return { kind: "notFound" as const };
      }

      if (reservation.status === "confirmed") {
        const confirmed = await tx.reservation.findUniqueOrThrow({
          where: { id },
          include: { product: true, warehouse: true },
        });
        return { kind: "ok" as const, reservation: confirmed };
      }

      if (reservation.status === "released") {
        return { kind: "released" as const };
      }

      if (reservation.expiresAt.getTime() <= Date.now()) {
        await tx.reservation.update({
          where: { id },
          data: { status: "released" },
        });

        await tx.stock.updateMany({
          where: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
            reservedUnits: { gte: reservation.quantity },
          },
          data: {
            reservedUnits: { decrement: reservation.quantity },
          },
        });

        return { kind: "expired" as const };
      }

      const updatedStock = await tx.stock.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
          totalUnits: { gte: reservation.quantity },
          reservedUnits: { gte: reservation.quantity },
        },
        data: {
          totalUnits: { decrement: reservation.quantity },
          reservedUnits: { decrement: reservation.quantity },
        },
      });

      if (updatedStock.count === 0) {
        return { kind: "stockConflict" as const };
      }

      const confirmed = await tx.reservation.update({
        where: { id },
        data: {
          status: "confirmed",
          confirmIdempotencyKey: idempotencyKey,
        },
        include: { product: true, warehouse: true },
      });

      return { kind: "ok" as const, reservation: confirmed };
    });

    if (result.kind === "ok") {
      return NextResponse.json(result.reservation);
    }

    if (result.kind === "notFound") {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (result.kind === "expired") {
      return NextResponse.json(
        { error: "Reservation has expired", code: "RESERVATION_EXPIRED" },
        { status: 410 }
      );
    }

    if (result.kind === "released") {
      return NextResponse.json(
        { error: "Reservation was cancelled or released" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Reservation stock is no longer in a confirmable state" },
      { status: 409 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      idempotencyKey
    ) {
      const existing = await findConfirmedByKey(idempotencyKey);

      if (existing?.id === id) {
        return NextResponse.json(existing);
      }
    }

    console.error("POST /api/reservations/[id]/confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}
