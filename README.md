# FollowUp

**Never forget a client follow-up again.**

FollowUp is a mobile-first follow-up reminder manager for busy professionals. The first pilot is intentionally focused: capture a follow-up quickly, surface what needs attention, and make it effortless to complete, snooze, reschedule, or create the next follow-up.

## MVP

- Secure user authentication
- Mobile-first dashboard
- Today, Overdue, Upcoming, and Completed views
- Create and edit follow-ups
- Priority: low, normal, high, urgent
- Done, Snooze, and Reschedule actions
- Prompt to create the next follow-up after completion
- Recurring follow-ups
- Reminder preferences
- Activity history
- Timezone-aware due dates
- Privacy warning for sensitive/confidential information

## Pilot privacy rule

FollowUp is not a banking system and must not be used to store account numbers, balances, passwords, identity documents, transaction details, card data, or other confidential banking information. Use a client/company label and a generic follow-up action only.

## Planned phases

### Phase 1 — Core MVP
Authentication, dashboard, follow-up CRUD, status views, priority, Done/Snooze/Reschedule, and next-follow-up flow.

### Phase 2 — Reminder engine
Morning digest, due reminders, overdue reminders, and end-of-day unfinished-follow-up summary.

### Phase 3 — Pilot polish
PWA/mobile installation, recurrence, settings, and activity history polish.

### Phase 4 — Pilot validation
Measure creation, on-time completion, snoozing, repeat follow-ups, and reminder effectiveness before expanding toward a subscription SaaS.

## Architecture direction

Separate React frontend + Node API + PostgreSQL database. The data model will stay simple for the pilot while leaving room for future multi-tenant SaaS evolution.
