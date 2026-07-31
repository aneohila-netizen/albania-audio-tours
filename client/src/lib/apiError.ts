// Admin write endpoints answer schema failures with `{ error: <serialized ZodError> }`,
// i.e. `{ error: { issues: [...], name: "ZodError" } }`. Interpolating that into a
// message renders "[object Object]", so unwrap it into readable lines instead.

const FIELD_LABELS: Record<string, string> = {
  slug: "URL Slug",
  nameEn: "English Name",
  nameAl: "Albanian Name",
  nameGr: "Greek Name",
  descEn: "English Description",
  descAl: "Albanian Description",
  descGr: "Greek Description",
  lat: "Latitude",
  lng: "Longitude",
  region: "Region",
  category: "Category",
  difficulty: "Difficulty",
  points: "Points (XP)",
  visitDuration: "Visit Duration",
  imageUrl: "Image URL",
  destinationSlug: "Destination",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}

export function readableError(err: unknown): string {
  if (typeof err === "string") return err;
  if (!err || typeof err !== "object") return "";
  const issues = (err as any).issues ?? (err as any).errors;
  if (Array.isArray(issues) && issues.length > 0) {
    return issues
      .map((i: any) => {
        const path = Array.isArray(i?.path) ? i.path.join(".") : "";
        const message = i?.message || "Invalid value";
        return path ? `${fieldLabel(path)}: ${message}` : message;
      })
      .join("\n");
  }
  if (typeof (err as any).message === "string") return (err as any).message;
  return "";
}

// Turns a failed response body into a message that is always safe to render.
export function saveErrorMessage(body: any, status: number): string {
  return readableError(body?.error) || `Save failed (HTTP ${status})`;
}
