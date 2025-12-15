import prisma from "@/app/libs/prismadb";
import { getSession } from "./getSession";
import { cache } from "react";

const getCurrentUser = cache(async () => {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      return null;
    }
    const currentUser = await prisma.user.findUnique({
      where: {
        email: session.user.email as string,
      },
    });
    return currentUser;
  } catch {
    return null;
  }
});
export default getCurrentUser;