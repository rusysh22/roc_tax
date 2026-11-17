// Prisma's pg adapter requires UTC sessions for unambiguous timestamp round trips.
// Apply to every pool, including tests; the database/host default may be non-UTC.
export function postgresOptions(connectionString: string) {
  const url = new URL(connectionString);
  url.searchParams.set(
    "options",
    `${url.searchParams.get("options") ?? ""} -c timezone=UTC`.trim(),
  );
  return { connectionString: url.toString(), connectionTimeoutMillis: 5000 };
}
