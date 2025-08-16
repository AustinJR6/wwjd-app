# Functions Config

Environment variables consumed by Cloud Functions. Required vars must be set in the environment or `.env.functions` when running locally.

## Required
- `STRIPE_SECRET_KEY` – Stripe API secret
- `STRIPE_PUBLISHABLE_KEY` – Stripe publishable key (mobile sheets)
- `STRIPE_SUB_PRICE_ID` – Price ID for subscription purchases

## Optional
- `APP_BASE_URL` – base URL used for redirects (default `https://onevine.app`)
- `FRONTEND_URL` – fallback for `APP_BASE_URL`
- `STRIPE_SUCCESS_URL` – override success redirect (`${APP_BASE_URL}/stripe-success?session_id={CHECKOUT_SESSION_ID}`)
- `STRIPE_CANCEL_URL` – cancel redirect (default `https://example.com/cancel`)
- `STRIPE_20_TOKEN_PRICE_ID` – price ID for 20 token pack
- `STRIPE_50_TOKEN_PRICE_ID` – price ID for 50 token pack
- `STRIPE_100_TOKEN_PRICE_ID` – price ID for 100 token pack
