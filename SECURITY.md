# Security Policy

**English** · [فارسی](SECURITY.fa.md)

## Reporting a Vulnerability

If you find a security vulnerability, **please do not open a public issue.**

Private reporting channels:

1. **GitHub Security Advisory** (preferred): file a private report
   [here](https://github.com/hami9/mira/security/advisories/new).
2. If that is unavailable, message the maintainer on GitHub
   ([@hami9](https://github.com/hami9)) and ask for a private channel.
   **Do not put vulnerability details in a public issue.**

Please include: the affected version, reproduction steps, the impact (what data or
access is at risk) and, if you have one, a suggested fix. You will get a response
within a few business days.

## Scope

Reports in these areas matter most:

- Cross-tenant data leaks (breaking `siteId` multi-tenant isolation)
- Authentication / authorization bypass (JWT, `PermissionGuard`, 2FA)
- Injection (XSS through chat messages, SQL injection)
- Secrets exposed in logs or API responses
- Vulnerabilities in the widget embedded on a customer's website

## Supported Versions

| Version | Status                     |
| ------- | -------------------------- |
| 1.x     | ✅ receives security fixes |
| < 1.0   | ❌                         |
