import { z } from "zod";

import { CsvFormatError, MAX_IMPORT_BYTES } from "@/features/registration-import/csv";
import { previewRegistrationImport } from "@/features/registration-import/server/registration-import";
import { getActiveStaffSession } from "@/lib/staff-session";

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const session = await getActiveStaffSession();
  if (!session) return Response.json({ message: "Sign in required." }, { status: 401 });

  const { eventId } = await context.params;
  if (!z.string().uuid().safeParse(eventId).success) {
    return Response.json({ message: "Invalid Event." }, { status: 400 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_IMPORT_BYTES + 64 * 1024) {
    return Response.json({ message: "The CSV must be 512 KB or smaller." }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ message: "Choose a CSV file." }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_BYTES) {
      return Response.json({ message: "The CSV must be 512 KB or smaller." }, { status: 413 });
    }
    const preview = await previewRegistrationImport(
      eventId,
      session.user.id,
      await file.text(),
    );
    if (!preview) {
      return Response.json({ message: "Organizer access is required." }, { status: 403 });
    }
    return Response.json(preview);
  } catch (error) {
    if (error instanceof CsvFormatError) {
      return Response.json({ message: error.message }, { status: 400 });
    }
    return Response.json(
      { message: "The import preview could not be created." },
      { status: 500 },
    );
  }
}
