import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateInZone } from "@/lib/clock";

/** One task with its steps, for the task detail page. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const todo = await prisma.todo.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!todo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [children, parent, categories] = await Promise.all([
    prisma.todo.findMany({
      where: { userId: session.user.id, parentId: todo.id },
      orderBy: { createdAt: "asc" },
    }),
    todo.parentId
      ? prisma.todo.findFirst({
          where: { id: todo.parentId, userId: session.user.id },
          select: { id: true, text: true },
        })
      : Promise.resolve(null),
    prisma.todo.findMany({
      where: { userId: session.user.id },
      distinct: ["title"],
      select: { title: true },
      orderBy: { title: "asc" },
      take: 40,
    }),
  ]);

  return NextResponse.json({
    todo,
    children,
    parent,
    categories: categories.map((c) => c.title),
    today: formatDateInZone(session.user.timezone),
  });
}
