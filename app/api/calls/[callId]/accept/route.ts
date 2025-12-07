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

    const call = await prisma.call.update({
      where: { id: callId },
      data: {
        status: "ongoing",
        answeredAt: new Date(),
      },
    });

    return NextResponse.json(call);
  } catch (error) {
    console.error("CALL_ACCEPT_ERROR:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
