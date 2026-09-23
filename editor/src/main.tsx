import { createRoot } from "react-dom/client";
import App from "./App";
import "./schema-augment";
import "tldraw/tldraw.css";
import "./app.css";
import "./canvas.css";

createRoot(document.getElementById("root")!).render(<App />);
