import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	root: import.meta.dirname,
	base: "./",
	plugins: [react()],
	build: {
		outDir: "dist",
		emptyOutDir: true,
		target: "es2022",
	},
	server: {
		proxy: {
			"/app": "http://127.0.0.1:7717",
			"/ws": { target: "ws://127.0.0.1:7717", ws: true },
			"/__forge": "http://127.0.0.1:7717",
		},
	},
});
