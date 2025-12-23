"use client";
import { Toaster } from "react-hot-toast";

const ToasterContext = () => {
  return (
    <Toaster
      toastOptions={{
        duration: 3000,
        success: { duration: 3000 },
        error: { duration: 3000 },
      }}
    />
  );
};

export default ToasterContext;