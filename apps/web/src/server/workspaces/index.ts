import "server-only";
import { getDatabase } from "../database";
import { authConfiguration } from "../auth/config";
import { sendMail } from "../auth/mail";
import { workspaceService } from "./service";
import { mailMessages } from "../../i18n/mail";
export function getWorkspaces() {
  return workspaceService(getDatabase(), async ({ to, token, locale }) => {
    const url = `${authConfiguration().origin}/${locale}/invite#${token}`;
    await sendMail({
      to,
      subject: mailMessages.invitation.subject,
      text: `${mailMessages.invitation.body}\n\n${url}`,
    });
  });
}
