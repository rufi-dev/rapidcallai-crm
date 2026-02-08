import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toaster
      theme="dark"
      position="top-right"
      toastOptions={{
        style: { background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" },
      }}
    />
    <App />
  </StrictMode>
);
