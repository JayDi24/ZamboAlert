# ZamboAlert backend

## Gmail email verification

Signup and login verification codes are sent through Gmail SMTP. Configure a Gmail
account with 2-Step Verification enabled, then create a Google App Password for
this backend. Do not use your regular Gmail password or commit the App Password.

Set these environment variables in the shell that runs the backend:

- `GMAIL_USER`: the Gmail address used to send verification emails
- `GMAIL_APP_PASSWORD`: the 16-character Google App Password

For PowerShell:

```powershell
$env:GMAIL_USER = "your-sender@gmail.com"
$env:GMAIL_APP_PASSWORD = "your-16-character-app-password"
```

## LoRa gateway telemetry

The gateway posts reports to `POST /api/telemetry`; the dashboard reads recent
reports from `GET /api/telemetry`. Configure a long random `GATEWAY_API_KEY` in
the backend's private `.env` file and set the exact same value in
`firmware/zamboalert-gateway/include/config.h`. The endpoint rejects missing or
incorrect keys and keeps each pod's latest report for 90 seconds.

The server listens on port `3000` by default and binds to the LAN so an ESP32
can reach it. Set `PORT` in `.env` to override the port. For a local hardware
test, set the gateway URL to
`http://<backend-computer-LAN-IP>:3000/api/telemetry`, permit inbound traffic to
that port on the trusted private network, and do not expose the shared-key HTTP
endpoint to the public Internet.

Create `.env` from [`backend/.env.example`](./.env.example), then install
dependencies and start the server from the repository root:

```powershell
npm --prefix backend install
npm start
```

Verification codes expire after 10 minutes. The backend stores only a SHA-256
hash of each verification code; codes are never returned to the mobile app.
Signup is rejected if Gmail delivery is not configured or the verification
email cannot be sent. Gmail SMTP connections have bounded timeouts so a
temporary mail-server delay returns an error instead of leaving login hanging.
