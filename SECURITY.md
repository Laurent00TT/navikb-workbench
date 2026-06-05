# Security Policy

NaviKB Workbench is the **early-alpha** companion UI to the
[NaviKB core](https://github.com/Laurent00TT/navikb). It is a thin client with
no backend of its own — most security-relevant behavior (auth, audit, data
access) lives in the core, so please read the
[core's security policy](https://github.com/Laurent00TT/navikb/blob/main/SECURITY.md)
first.

## Reporting

- **UI-specific issues** (e.g. token handling in the browser, or an injection
  vector in how the workbench renders core responses): if it is not sensitive,
  open an issue here; if it is, use GitHub Private Vulnerability Reporting on
  this repo if it is enabled, or email the maintainer (address on the GitHub
  profile).
- **Anything about auth, the API surface, or data handling** belongs on the
  core repo.

Please do not open a public issue for an undisclosed vulnerability.
