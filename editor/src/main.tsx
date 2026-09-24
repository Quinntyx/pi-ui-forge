import { createRoot } from "react-dom/client";
import App from "./App";
import "./schema-augment";
import { installErrorCapture } from "./error-capture";
import "./agent-log";
import "tldraw/tldraw.css";

installErrorCapture();
createRoot(document.getElementById("root")!).render(<App />);
