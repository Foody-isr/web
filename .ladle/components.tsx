import "../app/globals.css";
import "../lib/themes/generated/themes.css";
import type { GlobalProvider } from "@ladle/react";
import { useEffect } from "react";

export const Provider: GlobalProvider = ({ children, globalState }) => {
  useEffect(() => {
    document.documentElement.setAttribute("dir", globalState.rtl ? "rtl" : "ltr");
  }, [globalState.rtl]);
  return <>{children}</>;
};
