import { NextResponse } from "next/server";
import prisma from "@/app/libs/prismadb";
import getCurrentUser from "@/app/actions/getCurrentUser";

interface IParams {
  callId: string;
}

export async function POST(request: Request, { params }: { params: Promise<IParams> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { callId } = await params;

    const existingCall = await prisma.call.findUnique({
      where: { id: callId },
    });

    if (!existingCall) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Calculate duration if call was answered
    let duration = null;
    if (existingCall.answeredAt) {
      duration = Math.floor((new Date().getTime() - existingCall.answeredAt.getTime()) / 1000);
    }

    const call = await prisma.call.update({
      where: { id: callId },
      data: {
        status: "ended",
        endedAt: new Date(),
        duration,
        endReason: existingCall.answeredAt ? "completed" : "missed",
      },
    });

    return NextResponse.json(call);
  } catch (error) {
    console.error("CALL_END_ERROR:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
