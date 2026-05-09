# Payment Provider Setup

## Current state

- Checkout initialization is implemented.
- AvadaPay webhook storage and idempotence are implemented.
- Vendor payout remains manual until the aggregator payout credentials and final API contract are available.

## Required backend variables

Add these values in `backend/.env`:

```env
AVADAPAY_API_BASE_URL=
AVADAPAY_PUBLIC_KEY=
AVADAPAY_SECRET_KEY=
AVADAPAY_WEBHOOK_SECRET=
AVADAPAY_SIGNATURE_HEADER=x-avadapay-signature
AVADAPAY_REDIRECT_URL=http://localhost:5173/pages/payment-success.html
```

## Behavior without keys

- `POST /api/payments/initiate` returns `503`
- response code: `PAYMENT_PROVIDER_NOT_CONFIGURED`
- frontend shows a clean message instead of creating a broken payment attempt

## Remaining work after keys arrive

1. Confirm the exact checkout endpoint path and response shape with the aggregator docs.
2. Validate the real signature header and HMAC format.
3. Validate end-to-end flow: checkout, webhook, order payment processing.
4. Replace manual vendor payout with the provider payout API when available.
