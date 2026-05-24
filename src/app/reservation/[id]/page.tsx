import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${styles}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3.5 border-b border-white/[0.05] last:border-0">
      <span className="text-[13px] text-white/35 font-medium">{label}</span>
      <span className="text-[13px] text-white/80 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default async function ReservationPage({ params }: Props) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: { product: true, warehouse: true },
  });

  if (!reservation) notFound();

  const expiresAt = new Date(reservation.expiresAt);
  const now = new Date();
  const msLeft = expiresAt.getTime() - now.getTime();
  const minutesLeft = Math.max(0, Math.floor(msLeft / 60000));
  const isExpired = msLeft <= 0;

  return (
    <main className="min-h-screen bg-[#080809] text-white selection:bg-emerald-500/20">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />

      <div className="relative z-10 max-w-xl mx-auto px-6 py-16">
        {/* Back link */}
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/30 hover:text-white/60 transition-colors mb-10 group"
        >
          <svg
            className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5"
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
        </a>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-5">
            {isExpired ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Expired
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                Reserved
              </span>
            )}
          </div>

          <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-white leading-tight mb-2">
            Reservation confirmed
          </h1>
          <p className="text-[14px] text-white/35 leading-relaxed">
            {isExpired
              ? "This reservation has expired. Return to catalog to reserve again."
              : `You have ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""} left to complete checkout.`}
          </p>
        </div>

        {/* Countdown bar */}
        {!isExpired && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/15">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[12px] text-amber-400/80 font-medium">
                Time remaining
              </span>
              <span className="text-[12px] text-amber-400 font-semibold tabular-nums">
                {minutesLeft}m left
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400/70 transition-all"
                style={{ width: `${Math.min(100, (minutesLeft / 10) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Main card */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d0e] overflow-hidden mb-4">
          {/* Product image strip */}
          {reservation.product.imageUrl && (
            <div className="h-40 overflow-hidden bg-[#111113] relative">
              <img
                src={reservation.product.imageUrl}
                alt={reservation.product.name}
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0e] via-[#0d0d0e]/40 to-transparent" />
              <div className="absolute bottom-4 left-5">
                <p className="text-[18px] font-semibold text-white tracking-[-0.02em]">
                  {reservation.product.name}
                </p>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="px-5 py-1">
            {!reservation.product.imageUrl && (
              <div className="py-4 border-b border-white/[0.05]">
                <p className="text-[16px] font-semibold text-white tracking-[-0.02em]">
                  {reservation.product.name}
                </p>
              </div>
            )}
            <Row label="Reservation ID" value={
              <span className="font-mono text-[12px] text-white/50 bg-white/[0.04] px-2 py-0.5 rounded-md">
                {reservation.id}
              </span>
            } />
            <Row label="Warehouse" value={reservation.warehouse.name} />
            <Row label="Quantity" value={reservation.quantity} />
            <Row label="Status" value={<StatusBadge status={reservation.status} />} />
            <Row
              label="Expires at"
              value={
                <span className={isExpired ? "text-red-400/80" : "text-white/80"}>
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
          <button className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-black text-[13px] font-semibold transition-all duration-150 shadow-[0_0_24px_rgba(52,211,153,0.2)] hover:shadow-[0_0_32px_rgba(52,211,153,0.3)]">
            Proceed to payment →
          </button>
        )}

        {isExpired && (
          <a
            href="/"
            className="flex items-center justify-center w-full h-11 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] text-white/60 hover:text-white/80 text-[13px] font-medium transition-all duration-150"
          >
            Return to catalog
          </a>
        )}

        {/* Footer note */}
        <p className="mt-6 text-center text-[11px] text-white/20 leading-relaxed">
          Reservations automatically release after 10 minutes if payment is not completed.
        </p>
      </div>
    </main>
  );
}