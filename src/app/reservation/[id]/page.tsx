import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface Props {
  params: {
    id: string;
  };
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();

  const styles =
    s === "confirmed" || s === "active"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : s === "expired" || s === "cancelled"
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : "bg-amber-500/10 text-amber-400 border-amber-500/20";

  const dot =
    s === "confirmed" || s === "active"
      ? "bg-emerald-400"
      : s === "expired" || s === "cancelled"
      ? "bg-red-400"
      : "bg-amber-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${styles}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between border-b border-white/5 py-3.5 last:border-0">
      <span className="text-[13px] font-medium text-white/35">
        {label}
      </span>

      <span className="max-w-[60%] text-right text-[13px] text-white/80">
        {value}
      </span>
    </div>
  );
}

export default async function ReservationPage({ params }: Props) {
  const reservation = await prisma.reservation.findUnique({
    where: {
      id: params.id,
    },
    include: {
      product: true,
      warehouse: true,
    },
  });

  if (!reservation) notFound();

  const expiresAt = new Date(reservation.expiresAt);
  const now = new Date();

  const msLeft = expiresAt.getTime() - now.getTime();

  const minutesLeft = Math.max(
    0,
    Math.floor(msLeft / 60000)
  );

  const isExpired = msLeft <= 0;

  return (
    <main className="min-h-screen bg-[#080809] text-white selection:bg-emerald-500/20">
      {/* Grid background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-xl px-6 py-16">
        {/* Back link */}
        <Link
          href="/"
          className="group mb-8 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
        >
          <svg
            className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              d="M10 4L6 8l4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          Back to catalog
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="mb-5 flex items-center gap-2.5">
            {isExpired ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Expired
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />

                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>

                Reserved
              </span>
            )}
          </div>

          <h1 className="mb-2 text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-white">
            Reservation confirmed
          </h1>

          <p className="text-[14px] leading-relaxed text-white/35">
            {isExpired
              ? "This reservation has expired. Return to catalog to reserve again."
              : `You have ${minutesLeft} minute${
                  minutesLeft !== 1 ? "s" : ""
                } left to complete checkout.`}
          </p>
        </div>

        {/* Countdown */}
        {!isExpired && (
          <div className="mb-6 rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[12px] font-medium text-amber-400/80">
                Time remaining
              </span>

              <span className="tabular-nums text-[12px] font-semibold text-amber-400">
                {minutesLeft}m left
              </span>
            </div>

            <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-amber-400/70 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (minutesLeft / 10) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="mb-4 overflow-hidden rounded-2xl border border-white/5 bg-[#0d0d0e]">
          {/* Product image */}
          {reservation.product.imageUrl && (
            <div className="relative h-40 overflow-hidden bg-[#111113]">
              <Image
                src={reservation.product.imageUrl}
                alt={reservation.product.name}
                fill
                className="object-cover opacity-60"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0e] via-[#0d0d0e]/40 to-transparent" />

              <div className="absolute bottom-4 left-5">
                <p className="text-[18px] font-semibold tracking-[-0.02em] text-white">
                  {reservation.product.name}
                </p>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="px-5 py-1">
            {!reservation.product.imageUrl && (
              <div className="border-b border-white/5 py-4">
                <p className="text-[16px] font-semibold tracking-[-0.02em] text-white">
                  {reservation.product.name}
                </p>
              </div>
            )}

            <Row
              label="Reservation ID"
              value={
                <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[12px] text-white/50">
                  {reservation.id}
                </span>
              }
            />

            <Row
              label="Warehouse"
              value={reservation.warehouse.name}
            />

            <Row
              label="Quantity"
              value={reservation.quantity}
            />

            <Row
              label="Status"
              value={
                <StatusBadge status={reservation.status} />
              }
            />

            <Row
              label="Expires at"
              value={
                <span
                  className={
                    isExpired
                      ? "text-red-400/80"
                      : "text-white/80"
                  }
                >
                  {expiresAt.toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              }
            />
          </div>
        </div>

        {/* CTA */}
        {!isExpired && (
          <button className="h-11 w-full rounded-xl bg-emerald-500 text-[13px] font-semibold text-black shadow-[0_0_24px_rgba(52,211,153,0.2)] transition-all duration-150 hover:bg-emerald-400 hover:shadow-[0_0_32px_rgba(52,211,153,0.3)] active:scale-[0.99]">
            Proceed to payment →
          </button>
        )}

        {isExpired && (
          <Link
            href="/"
            className="flex h-11 w-full items-center justify-center rounded-xl bg-white/5 text-[13px] font-medium text-white/60 transition-all duration-150 hover:bg-white/10 hover:text-white/80"
          >
            Return to catalog
          </Link>
        )}

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] leading-relaxed text-white/20">
          Reservations automatically release after 10
          minutes if payment is not completed.
        </p>
      </div>
    </main>
  );
}