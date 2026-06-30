import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Proteção contra crashes recorrentes de DOM (ex.: extensões/tradutores do navegador)
// que removem nós fora do controle do React e disparam "removeChild".
const originalRemoveChild = Node.prototype.removeChild;
Node.prototype.removeChild = function <T extends Node>(child: T): T {
  if (child.parentNode !== this) return child;
  return originalRemoveChild.call(this, child) as T;
};

createRoot(document.getElementById("root")!).render(<App />);
