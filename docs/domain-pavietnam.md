# portfolio DNS and HTTPS

Hostname: `phanhoaithu.io.vn`. DNS is managed manually at P.A Vietnam, not Route 53. Run `npm run ops:domain -- plan --ip PUBLIC_IPV4` to print only this application's records. Preserve existing MX, TXT, SPF, DKIM, DMARC, CAA and other records. Do not overwrite another application's DNS or certificate.

Configure the app ingress host and TLS Secret `portfolio-tls` in namespace `portfolio`. Verify public DNS and ports 80/443 before issuing an HTTP-01 certificate. Preview `bash ops/native/install-tls.sh --email you@example.com`; use `--apply` only from your server administrator terminal. This script requests only this app's certificate.

Run `npm run ops:domain -- verify --ip PUBLIC_IPV4 --https` after rollout. Administrator endpoints remain private; DNS and HTTPS do not make a demo production-ready. Cloud/registrar operations are never automatic during npm builds or tests.
