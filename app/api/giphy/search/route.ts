import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limit = searchParams.get("limit") || "20";

    if (!query) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

    console.log("GIPHY_API_KEY exists:", !!GIPHY_API_KEY);

    if (!GIPHY_API_KEY) {
      console.error("Giphy API key not found in environment variables");
      return NextResponse.json(
        { error: "Giphy API key not configured. Please restart the dev server." },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
        query
      )}&limit=${limit}&rating=g`
    );

    if (!response.ok) {
      throw new Error("Giphy API request failed");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Giphy search error:", error);
    return NextResponse.json(
      { error: "Failed to search GIFs" },
      { status: 500 }
    );
  }
}
