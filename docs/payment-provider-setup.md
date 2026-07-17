# Payment Provider Setup

## Current state

- Checkout initialization is implemented.
- Stripe Checkout is now the active provider when `STRIPE_SECRET_KEY` is set.
- Netikash remains as a fallback only if Stripe is not configured.

## Required backend variables

Add these values in `backend/.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:5173/pages/payment-success.html
STRIPE_CHECKOUT_CANCEL_URL=http://localhost:5173/pages/payment-success.html
STRIPE_CURRENCY=usd
```

## Behavior without keys

- `POST /api/payments/initiate` returns `503`
- response code: `PAYMENT_PROVIDER_NOT_CONFIGURED`
- frontend shows a clean message instead of creating a broken payment attempt

## Remaining work after keys arrive

1. Create the Stripe webhook endpoint and store `whsec_...` in `STRIPE_WEBHOOK_SECRET`.
2. Validate the Checkout flow end to end in test mode.
3. Confirm the order is marked paid after `checkout.session.completed`.
4. Decide later if vendor payouts stay manual or move to Stripe Connect.
