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

From the `backend` directory, install dependencies and start the server:

```powershell
npm install --workspaces=false
node src\index.js
```

Verification codes expire after 10 minutes. The backend stores only a SHA-256
hash of each verification code; codes are never returned to the mobile app.
Signup is rejected if Gmail delivery is not configured or the verification
email cannot be sent. Gmail SMTP connections have bounded timeouts so a
temporary mail-server delay returns an error instead of leaving login hanging.
