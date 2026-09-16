# DeviceTry Production Deployment & Cloudflare Setup Guide

This document details the configuration and production deployment of **DeviceTry** on **Cloudflare Pages / Workers** with **Cloudflare D1** SQL database and **Stripe UK** billing.

---

## 1. Architectural Highlights

- **Edge-Optimized**: Next.js 15 (App Router) deployed with zero AI or external paid hardware API dependencies.
- **Privacy Architecture**: All media streams (microphones, webcams, audio tones, gamepad poles, keyboard codes) execute 100% locally in the visitor's client browser. No video, audio, or keystrokes ever transmit to your backend servers.
- **Dual Database Mode**:
  - In development / local testing: Uses built-in local persistence adapter.
  - In production Cloudflare Workers: Automatically connects to Cloudflare D1 SQL via `env.DB`.
- **UK Business Entity Stripe Billing**: Pro plan at $9 USD/month with webhook idempotency, customer portal redirection, and account lifecycle automation.

---

## 2. Cloudflare D1 Database Provisioning

### Step 2.1: Install Wrangler and Login
```bash
npm install -g wrangler
wrangler login
```

### Step 2.2: Create the D1 Database
```bash
wrangler d1 create devicetry-db
```
*Note down the `database_id` output by Wrangler.*

### Step 2.3: Execute Schema Migration
Run the initial SQL migration located in this repository:
```bash
wrangler d1 execute devicetry-db --file=./migrations/0001_init.sql
```
For local Wrangler preview testing:
```bash
wrangler d1 execute devicetry-db --local --file=./migrations/0001_init.sql
```

---

## 3. Environment Variables & Secrets Configuration

Configure the following environment variables in your Cloudflare Pages / Workers dashboard (**Settings > Variables & Secrets**):

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `SESSION_SECRET` | 32+ char secret for token encryption | Yes | `e83f982...b321` |
| `STRIPE_SECRET_KEY` | Stripe Secret Key (UK account) | For Pro | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook Signing Secret | For Pro | `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Publishable Key | For Pro | `pk_live_...` |
| `STRIPE_PRO_PRICE_ID` | Price ID for $9 USD/month plan | For Pro | `price_1P...` |
| `NEXT_PUBLIC_APP_URL` | Canonical URL of your app | Yes | `https://devicetry.com` |

---

## 4. Stripe Webhook & Portal Configuration

1. In the **Stripe Dashboard (UK Entity)**:
   - Navigate to **Developers > Webhooks > Add Endpoint**.
   - **Endpoint URL**: `https://devicetry.com/api/stripe/webhook`
   - **Events to Listen For**:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy the **Signing Secret** into `STRIPE_WEBHOOK_SECRET`.
2. In **Billing > Customer Portal**:
   - Enable &quot;Allow customers to cancel subscriptions&quot;.
   - Enable &quot;Allow customers to update payment methods&quot;.

---

## 5. Google AdSense Approval Checklist

DeviceTry was designed to strictly fulfill Google AdSense approval requirements:

1. **Substantial Original Utility**: Functional, free browser diagnostic tools rather than thin affiliate pages.
2. **Authoritative Technical Content**: Dedicated &quot;About & Methodology&quot; page (`/about`), extensive FAQ schema, and hardware diagnostic guides.
3. **Transparent Privacy Policy**: Dedicated `/privacy` disclosing local browser execution, zero audio/video tracking, cookie policies, and UK GDPR adherence.
4. **Accessible Navigation**: Structured navigation bar, language switcher (English, French, Arabic RTL), and contact channels (`/contact`).
5. **Clear Business Terms**: Dedicated `/terms` detailing service limitations and UK entity billing rules.
