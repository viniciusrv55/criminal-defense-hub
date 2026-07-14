import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorLogger } from "./lib/error-logger";

// Proteção contra crashes recorrentes de DOM (ex.: extensões/tradutores do navegador
// como o Google Tradutor) que removem/inserem nós fora do controle do React e disparam
// "removeChild"/"insertBefore" durante o commit do React.
const originalRemoveChild = Node.prototype.removeChild;
Node.prototype.removeChild = function <T extends Node>(child: T): T {
  if (child.parentNode !== this) {
    console.warn('[dom-guard] removeChild: nó não é filho — ignorando');
    return child;
  }
  return originalRemoveChild.call(this, child) as T;
};

const originalInsertBefore = Node.prototype.insertBefore;
Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
  if (referenceNode && referenceNode.parentNode !== this) {
    console.warn('[dom-guard] insertBefore: referência não é filha — usando appendChild');
    return this.appendChild(newNode) as unknown as T;
  }
  return originalInsertBefore.call(this, newNode, referenceNode) as T;
};

installGlobalErrorLogger();

createRoot(document.getElementById("root")!).render(<App />);
