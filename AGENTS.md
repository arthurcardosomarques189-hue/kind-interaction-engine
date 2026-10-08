<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep account privileges in protected user_roles, not profiles; unique owner and service-only provisioning prevent self-promotion.
- Enforce credit deductions and admin mutations transactionally in database functions; client state is never authorization.
- Public home contains only a locked administrative overview; private data is fetched only after authentication and server owner validation.
- Processing and payment integrations are not simulated; operational metrics read real stored events and payments.
- Map database clip fields to the browser clip model explicitly; database snake_case must not be cast into camelCase playback values.
- Reserve processing credits per project in an authenticated database transaction and keep refunds service-only and idempotent; this prevents double charges and caller-created credits.
