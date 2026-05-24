import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const result = await prisma.$transaction(async (tx: any) => {
      // Find and lock the reservation row
      const reservations = await tx.$queryRaw<
        {
          id: string;
          status: string;
          expiresAt: Date;
          productId: string;
          warehouseId: string;
          quantity: number;
        }[]
      >`
        SELECT id, status, "expiresAt", "productId", "warehouseId", quantity
        FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (reservations.length === 0) {
        throw new Error("NOT_FOUND");
      }

      const reservation = reservations[0];

      // Check if already confirmed or released
      if (reservation.status === "CONFIRMED") {
        throw new Error("ALREADY_CONFIRMED");
      }
      if (reservation.status === "RELEASED") {
        throw new Error("ALREADY_RELEASED");
      }

      // Check if expired — return 410 Gone
      if (new Date(reservation.expiresAt) < new Date()) {
        // Release the stock back since it's expired
        await tx.stock.updateMany({
          where: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
          data: { reserved: { decrement: reservation.quantity } },
        });

        // Mark as released
        await tx.reservation.update({
          where: { id },
          data: { status: "RELEASED" },
        });

        throw new Error("EXPIRED");
      }

      // Confirm: decrement total stock (permanently sold)
      await tx.stock.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
        data: {
          total: { decrement: reservation.quantity },
          reserved: { decrement: reservation.quantity },
        },
      });

      // Update reservation status
      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: { product: true, warehouse: true },
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Reservation not found" },
          { status: 404 }
        );
      }
      if (error.message === "EXPIRED") {
        return NextResponse.json(
          { error: "Reservation has expired", code: "RESERVATION_EXPIRED" },
          { status: 410 } // 410 Gone
        );
      }
      if (error.message === "ALREADY_CONFIRMED") {
        return NextResponse.json(
          { error: "Reservation already confirmed" },
          { status: 409 }
        );
      }
      if (error.message === "ALREADY_RELEASED") {
        return NextResponse.json(
          { error: "Reservation was cancelled" },
          { status: 409 }
        );
      }
    }

    console.error("POST /api/reservations/[id]/confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}