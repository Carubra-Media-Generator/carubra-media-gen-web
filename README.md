## 1. Project Summary

Carubra Media Gen Web is a Next.js application for AI-assisted media creation and social media workflow management. The app includes user-facing tools for generating images/videos, creating captions, analyzing content, scheduling social posts, connecting social media accounts, and purchasing coin packages. It also includes an admin dashboard for user management, pricing/packages, content monitoring, invoices, transactions, and system logs.

The current project is no longer just a frontend prototype. It has backend API routes inside `app/api`, uses Supabase as the database layer, stores authentication/session-related user data, and integrates with several external services through environment variables.

## 2. Main Changes From The Previous Team

Based on the internal documentation and the existing code, the previous team mainly worked on:

- Migrating the data layer from a MongoDB-style approach to Supabase/PostgreSQL.
- Adding a Supabase helper layer in `lib/supabase.ts` for common database operations like find, insert, update, upsert, delete, and storage upload.
- Moving the backend behavior into Next.js API routes under `app/api`.
- Adding authentication endpoints for register, login, and logout.
- Adding user profile and balance endpoints.
- Adding Image AI and Video AI generation flows.
- Adding generated content history routes.
- Adding content analysis routes and worker-related logic.
- Adding social media OAuth/connect/disconnect flows.
- Adding scheduled post routes and worker logic for publishing.
- Adding Xendit payment/invoice routes and webhook handling.
- Adding admin routes for dashboard data, users, packages, contents, invoices, transactions, monitoring, and logs.
- Adding an Admin Docs Dev page in the admin sidebar that documents database tables, feature architecture, API contracts, and SSO/auth notes.

## 3. Architecture

The app has these main layers:

- Frontend pages in `app/dashboard/...`
- Shared UI components in `components/...`
- Auth/user state in `contexts/...`
- API routes in `app/api/...`
- Supabase helpers in `lib/supabase.ts`
- Auth middleware/helper logic in `middleware/...`
- Background or scheduled logic in `workers/...`
- SQL/schema references in `sql/...` and `.github/modernize/...`

The database is Supabase/PostgreSQL. The app mostly uses snake_case fields in the database, while the UI often expects camelCase or UI-friendly names.

Important Supabase tables mentioned in the Admin Docs Dev page and code include:

- `users`
- `images`
- `videos`
- `generated_contents`
- `image_history`
- `video_history`
- `social_connects`
- `scheduled_posts`
- `transactions`
- `transaction_history`
- `membership_packages`
- `content_analysis`
- `api_error_logs`
- `ai_usage_logs`
- `user_activity_logs`

## 4. Environment Setup Status

Local `.env.local` is now populated and Supabase is linked locally. The required Supabase values are:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Important security note: `SUPABASE_SERVICE_ROLE_KEY` must stay server-side only and must not be exposed as a `NEXT_PUBLIC_` variable.

Other important env groups include:

- JWT/session config
- AI provider API keys and model URLs
- Social OAuth client IDs/secrets and redirect URIs
- Xendit payment key/webhook configuration
- Frontend/base URL values for local and production

## 5. Build And Validation Status

Current status from testing:

- `npm run build` passes.
- Next.js detects `.env.local`.
- The app can run on localhost.
- The project deploys.

## 6. Features I Believe Are Implemented

User/member side:

- Register and login.
- Dashboard access after login.
- Profile page.
- Coin display.
- Image generation page.
- Video generation page.
- Caption generation endpoints.
- Generated content/history screens.
- Content analytics page.
- Social account connection area.
- Auto-upload / scheduled post interface.
- Member/payment area with invoices and packages.

Admin side:

- Admin dashboard.
- User management.
- Role management.
- Coin editing from admin.
- Ban/unban users.
- Reset password flow.
- Package/pricing management.
- Content management.
- Membership/invoice/transaction views.
- System/monitoring/log views.
- Docs Dev page.

## 7. Issues I Already Found

These are the main functional issues I found or still need to prove:

1. Coin deduction is not persistent.

   Example: if a user has 15 coins and uses 1 or 2 coins, the UI may show the reduced balance, but after logout or checking from another device it returns to 15. This suggests the frontend state is changing, but the database source of truth is not being updated correctly.

2. Coins should work from real business flows, not only manual admin input.

   Admin can insert/edit coins, but the actual product flow should also add coins after successful payment and deduct coins after successful AI generation.

3. Chat/history disappears after logout.

   If generated/chat history belongs to the user account, logout should not delete it. The data should be fetched from Supabase again after login, including from another device.

4. Automatic caption behavior in generated image history needs testing.

   When clicking generated images in history, the caption behavior needs to be checked. It may be generating captions but not saving them, saving them but not displaying them, or reading the wrong field.

5. Social media flows need full re-testing.

   Each platform should be tested by disconnecting, reconnecting, verifying token storage, verifying UI state, and testing posting/scheduling if supported.

6. Admin management features are not fully tested.

   Admin pages exist, but management actions need actual verification: user edit, coin edit, ban/unban, package changes, invoices, transactions, content moderation, and monitoring/logs.

7. TypeScript/lint quality is not production-clean yet.

   The app builds, but type checking is currently bypassed for production builds.

## 8. My Suggested Bug Priority

I think the next work should be handled in this order:

1. Fix the coin source-of-truth problem.
2. Confirm payment-to-coin flow works through Xendit/webhook.
3. Confirm AI generation deducts coins in Supabase, not only in local UI state.
4. Fix persistent generated/chat history across logout and devices.
5. Fix image history/caption behavior.
6. Test and fix social media reconnect and publishing flows.
7. Test and fix admin management features.
8. Clean TypeScript errors and restore proper validation.
9. Install/configure ESLint or remove the lint script until it is actually supported.

The coins bug should come first because it affects billing, abuse prevention, user trust, and the main business model of the app.

## 9. Manual Testing Checklist

Authentication:

- Register new user.
- Login existing user.
- Logout.
- Login again and confirm profile/history persists.
- Confirm banned user cannot login.
- Confirm admin user reaches admin pages.

Coins:

- Check initial user coins from Supabase.
- Generate an image and verify coins reduce in Supabase.
- Generate a video and verify coins reduce in Supabase.
- Refresh page and confirm balance is still correct.
- Logout/login and confirm balance is still correct.
- Login from another browser/device and confirm balance is still correct.
- Test failed generation and decide whether coins should be refunded.
- Test successful payment and confirm coins increase automatically.

Image AI:

- Generate image at each supported resolution.
- Confirm result is saved.
- Confirm history item opens correctly.
- Confirm caption generation works.
- Confirm caption is saved and displayed again after refresh/login.
- Confirm delete removes the right item.

Video AI:

- Generate video at each supported resolution.
- Confirm pending/processing/completed status.
- Confirm final video is saved.
- Confirm caption generation works.
- Confirm history survives logout/login.
- Confirm delete removes the right item.

Content analytics:

- Submit a valid content/social URL.
- Confirm analysis job is saved.
- Confirm history opens correctly.
- Confirm null/failed result states do not crash the page.

Social connect / auto-upload:

- Connect Instagram/Facebook/YouTube/TikTok/X depending on available credentials.
- Confirm callback succeeds locally and in production.
- Confirm token/account is saved in `social_connects`.
- Disconnect account.
- Reconnect account.
- Schedule a post.
- Confirm scheduled post is saved in `scheduled_posts`.
- Run/trigger publishing flow if available.
- Confirm success/failure status is recorded.

Payments:

- Load package list.
- Create invoice.
- Complete test payment if using Xendit test mode.
- Confirm transaction status updates.
- Confirm coins are added to the user.
- Confirm invoice page and PDF route work.
- Confirm webhook secret/validation behavior in production.

Admin:

- Open admin dashboard.
- View users.
- Change user role.
- Change user coins.
- Ban/unban user.
- Reset password.
- Manage packages/pricing.
- View content.
- View invoices/transactions.
- View monitoring/system logs.
- Confirm non-admin users cannot access admin APIs/pages.