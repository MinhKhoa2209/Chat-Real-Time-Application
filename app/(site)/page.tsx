import { Suspense } from "react";
import AuthForm from "./components/AuthForm";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
      </div>
      <Suspense fallback={<div className="flex justify-center"><div className="animate-spin h-8 w-8 border-4 border-sky-500 rounded-full border-t-transparent"></div></div>}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
