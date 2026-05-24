import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const result = await prisma.$transaction(async (tx) => {
      const reservations = await tx.$queryRaw<
        {
          id: string;
          status: string;
          productId: string;
          warehouseId: string;
          quantity: number;
        }[]
      >`
        SELECT id, status, "productId", "warehouseId", quantity
        FROM "Reservation"
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (reservations.length === 0) {
        throw new Error("NOT_FOUND");
      }

      const reservation = reservations[0];

      if (reservation.status === "RELEASED") {
        throw new Error("ALREADY_RELEASED");
      }
      if (reservation.status === "CONFIRMED") {
        throw new Error("ALREADY_CONFIRMED");
      }

      // Give stock back to available pool
      await tx.stock.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
        data: { reserved: { decrement: reservation.quantity } },
      });

      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "RELEASED" },
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
      if (error.message === "ALREADY_RELEASED") {
        return NextResponse.json(
          { error: "Reservation already released" },
          { status: 409 }
        );
      }
      if (error.message === "ALREADY_CONFIRMED") {
        return NextResponse.json(
          { error: "Cannot cancel a confirmed reservation" },
          { status: 409 }
        );
      }
    }

    console.error("POST /api/reservations/[id]/release error:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}