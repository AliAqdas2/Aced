---
name: Admin orders API shape
description: Pagination, filtering, buyer identity, and chunked export added to finance orders endpoints.
---

## GET /v1/admin/orders
Returns `AdminOrdersResponse { data: AdminOrderRow[], totalCount, page, pageSize }`.

Query params: `page` (default 1), `pageSize` (default 50, max 100), `creatorName` (ILIKE), `buyerEmail` (ILIKE).

Each `AdminOrderRow` now includes `buyerEmail` and `buyerName` (JOINed from users + profiles).

**Why:** Finance needed live table filtering and pagination without exporting to CSV every time.

## GET /v1/admin/orders/export
Added `chunk` (0-based integer) param. Each chunk = 10,000 rows. `X-Export-Truncated: true` header still signals more data. Frontend concatenates chunks into one download automatically.

**How to apply:** Any future changes to the orders query must maintain the COUNT(*) pre-query for pagination totalCount, and the chunk OFFSET math.
