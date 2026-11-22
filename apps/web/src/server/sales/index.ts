import "server-only";
import { getDatabase } from "../database";
import { getTaxCrypto } from "../intake/crypto";
import { authConfiguration } from "../auth/config";
import { sendMail } from "../auth/mail";
import { salesService } from "./service";

/**
 * Sales-led onboarding. New leads are e-mailed to SALES_NOTIFY_EMAIL when set
 * (otherwise they only appear in Superadmin -> Sales & offers).
 */
export function getSales() {
  const notifyTo = process.env.SALES_NOTIFY_EMAIL?.trim();
  return salesService(getDatabase(), getTaxCrypto(), {
    pepper: authConfiguration().BETTER_AUTH_SECRET,
    notify: notifyTo
      ? (lead) =>
          sendMail({
            to: notifyTo,
            subject: `SerenTax: pendaftaran baru — ${lead.companyName}`,
            text: `Perusahaan: ${lead.companyName}\nPIC: ${lead.picName}\nEmail: ${lead.email}\nTelepon: ${lead.phone}\n\nTindak lanjuti di Superadmin -> Sales & penawaran.`,
          })
      : undefined,
  });
}

/** Client address for rate limiting (trusted ingress header in production). */
export function requesterOf(request: Request) {
  const header = authConfiguration().AUTH_PROXY_IP_HEADER;
  return (
    (header && request.headers.get(header)?.split(",")[0]?.trim()) || "local"
  );
}
