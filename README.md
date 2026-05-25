# Allo Inventory Reservation System

This is a Next.js inventory reservation system built for the Allo Engineering take-home assessment. It lets users view product stock across warehouses, reserve inventory during checkout, confirm purchases, cancel reservations, and release expired reservations.

The app is designed around correctness for short-lived stock reservations, including atomic reservation creation and safe confirm/release behavior.

---

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma
- PostgreSQL / Supabase
- Tailwind CSS
- Zod
- Vercel

---

## Features

- Product listing with available stock per warehouse
- Warehouse listing API
- Reservation creation
- Checkout/reservation page with countdown timer
- Confirm purchase
- Cancel reservation
- Expired reservation cleanup
- User-visible `409` and `410` errors
- Concurrency-safe reservation logic
- Optional idempotency support for reserve and confirm requests

---

## Database Design

### Product

Stores product information such as name, description, image URL, and timestamps.

### Warehouse

Stores warehouse/location information.

### Stock

Stores stock per product per warehouse.

Important Prisma fields:

- `totalUnits`
- `reservedUnits`
- `productId`
- `warehouseId`

Available stock is calculated as:

```txt
availableStock = totalUnits - reservedUnits
```

Note: the Prisma fields `totalUnits` and `reservedUnits` are mapped to existing PostgreSQL columns named `total` and `reserved`.

### Reservation

Stores temporary inventory holds.

Important fields:

- `productId`
- `warehouseId`
- `quantity`
- `status`
- `expiresAt`
- `idempotencyKey`
- `confirmIdempotencyKey`

Reservation statuses:

- `pending`
- `confirmed`
- `released`

---

## API Routes

### `GET /api/products`

Returns products with available stock per warehouse.

This route also runs lazy cleanup for expired reservations so stale holds do not keep stock reserved forever.

### `GET /api/warehouses`

Returns all warehouses.

### `POST /api/reservations`

Creates a reservation for a product and warehouse.

Returns:

- `201` on success
- `400` for invalid input
- `404` if the product/warehouse stock row does not exist
- `409` if not enough stock is available

### `GET /api/reservations/:id`

Returns reservation details for the checkout page.

### `POST /api/reservations/:id/confirm`

Confirms a pending reservation after payment success.

On success:

- `totalUnits` is reduced by the reserved quantity
- `reservedUnits` is reduced by the reserved quantity
- reservation status becomes `confirmed`

Returns:

- `200` on success
- `404` if reservation is not found
- `409` if the reservation has already been released/cancelled
- `410` if reservation has expired

### `POST /api/reservations/:id/release`

Releases/cancels a pending reservation.

On success:

- `reservedUnits` is reduced by the reservation quantity
- reservation status becomes `released`

Returns:

- `200` on success
- `404` if reservation is not found
- `409` if the reservation is already confirmed

### `GET /api/cron/release-expired`

Releases expired pending reservations.

This route is configured in `vercel.json` as a daily Vercel Cron job for Hobby-plan compatibility.

---

## Concurrency Safety

The reservation endpoint does not use unsafe read-then-write logic. It performs an atomic conditional database update inside a transaction.

Stock is reserved only if:

```txt
totalUnits - reservedUnits >= requestedQuantity
```

The atomic SQL update is:

```sql
UPDATE "Stock"
SET "reserved" = "reserved" + quantity
WHERE "productId" = productId
  AND "warehouseId" = warehouseId
  AND ("total" - "reserved") >= quantity
RETURNING id;
```

PostgreSQL serializes concurrent row updates. If two users try to reserve the last available unit at the same time, only one update can satisfy the condition. The winner receives a reservation and the other request receives `409 Conflict`.

Confirm and release routes also run in database transactions and lock the reservation row with `SELECT ... FOR UPDATE`. This prevents duplicate stock decrements during concurrent confirm/release attempts.

---

## Reservation Expiry

Pending reservations have an `expiresAt` timestamp set to 10 minutes after reservation creation.

Expired reservations are released using:

- Lazy cleanup during API reads/writes
- Vercel Cron backup route

When a reservation expires:

- Its status becomes `released`
- Its reserved quantity is removed from `reservedUnits`
- The stock becomes available again

Cron cleanup route:

```txt
GET /api/cron/release-expired
```

On Vercel Hobby, cron is configured to run once per day. Lazy cleanup is the primary expiry mechanism for normal user traffic.

---

## Idempotency

The reserve and confirm endpoints support the `Idempotency-Key` header.

Supported endpoints:

- `POST /api/reservations`
- `POST /api/reservations/:id/confirm`

The idempotency key is stored on the reservation row:

- `idempotencyKey` for reservation creation
- `confirmIdempotencyKey` for confirmation

If the same request is retried with the same key after the original request succeeded, the server returns the original reservation instead of creating another reservation or confirming twice.

Trade-off: this implementation stores keys on reservation rows instead of a separate idempotency table with a unique database constraint. That keeps the take-home implementation simple and avoids destructive schema changes on the demo database, but a production system should add a dedicated idempotency table with unique keys.

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/FarhanaazRS/inventory-reservation-system.git
cd inventory-reservation-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create environment file

```bash
cp .env.example .env
```

Add required values:

```env
DATABASE_URL=
CRON_SECRET=
```

For Supabase on Vercel, use the Session Pooler connection string. It usually looks like:

```env
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

### 4. Generate Prisma client

```bash
npm run prisma:generate
```

### 5. Push database schema

```bash
npm run prisma:push
```

### 6. Seed database

```bash
npm run prisma:seed
```

### 7. Run development server

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

---

## Deployment on Vercel

1. Push code to GitHub.
2. Import the repository into Vercel.
3. Add environment variables in the Vercel dashboard:
   - `DATABASE_URL`
   - `CRON_SECRET`
4. Use a hosted PostgreSQL database such as Supabase. Do not use SQLite or a local database.
5. Run Prisma setup against the hosted database:

   ```bash
   npm run prisma:push
   npm run prisma:seed
   ```

6. Deploy on Vercel.
7. Verify product listing and the reservation flow.

The build script runs:

```bash
prisma generate && next build
```

This ensures Prisma Client is generated during Vercel builds.

---

## Demo Flow

1. Open the deployed URL.
2. View products and warehouse stock.
3. Select a warehouse with available stock.
4. Click `Reserve now`.
5. See the checkout page with a countdown timer.
6. Click `Confirm purchase`.
7. Return to the product list and verify stock updates.
8. Try reserving an out-of-stock item or race for the last unit to see `409`.
9. Wait for expiry or call `/api/cron/release-expired` to verify stock release.

---

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

---

## Trade-offs

- Expiry cleanup uses lazy cleanup plus Vercel Cron instead of a long-running worker because Vercel does not support persistent background workers.
- Vercel Hobby only supports daily cron jobs, so lazy cleanup is the main production expiry mechanism.
- The UI is intentionally simple and focused on the assessment requirements.
- The seed script resets demo tables before inserting demo data.
- Idempotency is implemented on reservation rows; a production version should use a dedicated idempotency table with unique keys and stored responses.
- The project uses `prisma db push` for setup speed. A production team should use committed Prisma migrations.

---

## Future Improvements

- Add authentication
- Add admin dashboard
- Add automated concurrency tests
- Add payment provider integration
- Add monitoring and structured logging
- Add audit logs for stock movements
- Add better warehouse allocation logic

---

## Final Notes

The app is seeded with demo products, warehouses, and stock rows. After environment variables are configured and the database is seeded, the full flow can be tested directly from the deployed URL.
