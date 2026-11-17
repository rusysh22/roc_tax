export const releaseFeatures = [
  { title: "accounts", body: "accountsBody", available: true },
  { title: "workspaces", body: "workspacesBody", available: true },
  { title: "trial", body: "trialBody", available: true },
  { title: "intake", body: "intakeBody", available: true },
  { title: "review", body: "reviewBody", available: true },
  { title: "export", body: "exportBody", available: true },
  { title: "ocr", body: "ocrBody", available: true },
] as const;
export const documentFamilies = [
  { key: "BPPU", status: "templateVerified" },
  { key: "FAKTUR", status: "verification" },
  { key: "BPNR", status: "unsupported" },
  { key: "BP21", status: "unsupported" },
  { key: "BPMP", status: "unsupported" },
  { key: "BPA1", status: "unsupported" },
  { key: "BPA2", status: "unsupported" },
  { key: "BP26", status: "unsupported" },
] as const;
