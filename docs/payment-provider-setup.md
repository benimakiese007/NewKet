# Payment Provider Setup

## Current state

- Checkout initialization is implemented.
- Netikash pay-in webhook storage and idempotence are implemented.
- Vendor payout remains manual until the aggregator payout credentials and final API contract are available.

## Required backend variables

Add these values in `backend/.env`:

```env
NETIKASH_ACCOUNTS_BASE_URL=https://accounts.netikash.com
NETIKASH_API_BASE_URL=https://api.netikash.com/api/v1/trs
NETIKASH_CLIENT_ID=
NETIKASH_CLIENT_SECRET=
NETIKASH_WEBHOOK_SIGNING_KEY=
NETIKASH_SIGNATURE_HEADER=x-signature
NETIKASH_TIMESTAMP_HEADER=x-timestamp
NETIKASH_REDIRECT_URL=http://localhost:5173/pages/payment-success.html
```

## Behavior without keys

- `POST /api/payments/initiate` returns `503`
- response code: `PAYMENT_PROVIDER_NOT_CONFIGURED`
- frontend shows a clean message instead of creating a broken payment attempt

## Remaining work after keys arrive

1. Create the callback destination in Netikash and store the returned signing key in `NETIKASH_WEBHOOK_SIGNING_KEY`.
2. Validate the live webhook payload shape for amount/currency fields and keep `ref = transaction_id`.
3. Validate end-to-end flow: checkout, webhook, order payment processing.
4. Keep vendor payout manual unless NewKet later decides to automate that part separately.
