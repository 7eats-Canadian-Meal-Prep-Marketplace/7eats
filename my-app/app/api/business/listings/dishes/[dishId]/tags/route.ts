import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCookId,
  notFound,
  unauthorized,
} from "@/app/api/business/listings/_lib/cook-auth";
import { db } from "@/db";
import { dishes, dishTags, tags } from "@/db/schema";

const attachTagSchema = z
  .object({
    tagId: z.uuid(),
  })
  .strict();

type Params = { params: Promise<{ dishId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const cookId = await getCookId(req.headers);
  if (!cookId) return unauthorized();

  const { dishId } = await params;

  const [dish] = await db
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.cookId, cookId)))
    .limit(1);

  if (!dish) return notFound("Dish");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed = attachTagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validation failed." },
      { status: 400 },
    );
  }

  const { tagId } = parsed.data;

  const [tag] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1);

  if (!tag) return notFound("Tag");

  try {
    await db.insert(dishTags).values({ dishId, tagId });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "Tag already attached." },
        { status: 409 },
      );
    }
    console.error("[dishes/tags]", err);
    return NextResponse.json(
      { error: "Failed to attach tag." },
      { status: 500 },
    );
  }
}
