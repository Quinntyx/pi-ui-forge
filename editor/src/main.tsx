import "tldraw/tldraw.css";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./schema-augment";
import { installErrorCapture } from "./error-capture";
import "./agent-log";
import "./forge.css";

installErrorCapture();
createRoot(document.getElementById("root")!).render(<App />);
