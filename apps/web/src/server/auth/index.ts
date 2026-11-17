import "server-only";
import { getDatabase } from "../database";
import { createAuth } from "./create-auth";
import { sendMail } from "./mail";
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth(getDatabase(), sendMail));
}
