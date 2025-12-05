import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import getCurrentUser from "@/app/actions/getCurrentUser";

/**
 * GET - Lấy danh sách kiến thức AI
 */
export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const knowledge = await prisma.aiKnowledge.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(knowledge);
  } catch (error) {
    console.error("[AI_KNOWLEDGE_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * POST - Thêm kiến thức mới
 */
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { topic, content } = body;

    if (!topic || !content) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const newKnowledge = await prisma.aiKnowledge.create({
      data: {
        topic,
        content,
      },
    });

    return NextResponse.json(newKnowledge);
  } catch (error) {
    console.error("[AI_KNOWLEDGE_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

/**
 * DELETE - Xóa kiến thức
 */
export async function DELETE(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new NextResponse("Missing knowledge ID", { status: 400 });
    }

    await prisma.aiKnowledge.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AI_KNOWLEDGE_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
