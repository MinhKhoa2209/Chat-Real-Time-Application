import { NextResponse } from "next/server";

export async function GET() {
  const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
  
  return NextResponse.json({
    hasKey: !!GIPHY_API_KEY,
    keyLength: GIPHY_API_KEY?.length || 0,
    keyPreview: GIPHY_API_KEY ? `${GIPHY_API_KEY.substring(0, 4)}...${GIPHY_API_KEY.substring(GIPHY_API_KEY.length - 4)}` : "N/A",
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('GIPHY')),
  });
}
