import { NextResponse } from "next/server";
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
    console.log("[CALL_ACCEPT] Call accepted:", callId, "by user:", currentUser.id);
    return NextResponse.json({ success: true, callId });
  } catch (error) {
    console.error("CALL_ACCEPT_ERROR:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
