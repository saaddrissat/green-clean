import nodemailer from "nodemailer";

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function parseSmtpConfig(raw: {
  host?: string;
  port?: number | string;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}): SmtpConfig {
  const host = raw.host?.trim() || "";
  const portRaw = raw.port == null ? "587" : String(raw.port).trim();
  const user = raw.user?.trim() || "";
  const pass = raw.pass?.trim() || "";
  const from = raw.from?.trim() || "";
  const secureRaw = typeof raw.secure === "boolean" ? String(raw.secure) : "";
  if (!host || !user || !pass || !from) {
    throw new Error(
      "SMTP non configuré. Ajoutez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (mot de passe d’application) et SMTP_FROM dans .env.",
    );
  }
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("SMTP_PORT invalide.");
  }
  const secure = secureRaw === "true" || port === 465;
  return { host, port, secure, user, pass, from };
}

function getSmtpConfig(override?: {
  host?: string;
  port?: number | string;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}): SmtpConfig {
  if (override) {
    return parseSmtpConfig(override);
  }
  const host = process.env.SMTP_HOST?.trim() || "";
  const portRaw = process.env.SMTP_PORT?.trim() || "587";
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || "";
  const from = process.env.SMTP_FROM?.trim() || "";
  const secureRaw = process.env.SMTP_SECURE?.trim()?.toLowerCase() || "";

  if (!host || !user || !pass || !from) {
    throw new Error(
      "SMTP non configuré. Ajoutez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (mot de passe d’application) et SMTP_FROM dans .env.",
    );
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("SMTP_PORT invalide.");
  }

  const secure = secureRaw === "true" || port === 465;
  return { host, port, secure, user, pass, from };
}

export async function sendInvoiceEmail(input: {
  to: string;
  clientName: string;
  orderNumber: string;
  total: number;
  orderDateIso: string;
  smtpOverride?: {
    host?: string;
    port?: number | string;
    secure?: boolean;
    user?: string;
    pass?: string;
    from?: string;
  };
}) {
  const cfg = getSmtpConfig(input.smtpOverride);
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const orderDate = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(input.orderDateIso));

  const total = `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(input.total)} DH`;
  const text = [
    `Bonjour ${input.clientName},`,
    "",
    `Votre facture ${input.orderNumber} est prête.`,
    `Date: ${orderDate}`,
    `Montant: ${total}`,
    "",
    "Merci de votre confiance.",
    "Green Clean",
  ].join("\n");

  const info = await transporter.sendMail({
    from: cfg.from,
    to: input.to,
    subject: `Facture ${input.orderNumber} - Green Clean`,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <p>Bonjour ${input.clientName},</p>
        <p>Votre facture <strong>${input.orderNumber}</strong> est prête.</p>
        <p><strong>Date :</strong> ${orderDate}<br/><strong>Montant :</strong> ${total}</p>
        <p>Merci de votre confiance.<br/>Green Clean</p>
      </div>
    `,
  });

  if (!info.messageId) {
    throw new Error("Envoi SMTP non confirmé (messageId manquant).");
  }
}
