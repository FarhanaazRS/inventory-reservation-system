import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ReservationRouteContext = {
  params: Promise<{ id: string }>;
};

type LockedReservation = {
  id: string;
  status: "pending" | "confirmed" | "released";
  productId: string;
  warehouseId: string;
  quantity: number;
};

export async function POST(_req: Request, context: ReservationRouteContext) {
  const { id } = await context.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservations = await tx.$queryRaw<LockedReservation[]>`
        SELECT id, status, "productId", "warehouseId", quantity
        FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `;

      const reservation = reservations[0];

      if (!reservation) {
        return { kind: "notFound" as const };
      }

      if (reservation.status === "confirmed") {
        return { kind: "confirmed" as const };
      }

      if (reservation.status === "pending") {
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

        await tx.reservation.update({
          where: { id },
          data: { status: "released" },
        });
      }

      const released = await tx.reservation.findUniqueOrThrow({
        where: { id },
        include: { product: true, warehouse: true },
      });

      return { kind: "ok" as const, reservation: released };
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

    return NextResponse.json(
      { error: "Cannot release a confirmed reservation" },
      { status: 409 }
    );
  } catch (error) {
    console.error("POST /api/reservations/[id]/release error:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
