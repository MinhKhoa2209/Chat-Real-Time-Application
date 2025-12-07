"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
        <p className="text-gray-700 mb-4">
          Error: <span className="font-mono text-sm">{error || "Unknown error"}</span>
        </p>
        <a
          href="/"
          className="inline-block px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
