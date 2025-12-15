import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { cache } from "react";

export const getSession = cache(async () => {
  return await getServerSession(authOptions);
});