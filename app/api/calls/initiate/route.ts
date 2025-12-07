import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import getCurrentUser from "@/app/actions/getCurrentUser";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, conversationId, type } = body;

    if (!receiverId || !conversationId || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const call = await prisma.call.create({
      data: {
        type,
        status: "ringing",
        callerId: currentUser.id,
        receiverId,
        conversationId,
      },
    });

    return NextResponse.json(call);
  } catch (error) {
    console.error("CALL_INITIATE_ERROR:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
