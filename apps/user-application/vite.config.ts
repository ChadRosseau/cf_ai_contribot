import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

const config = defineConfig({
	plugins: [
		// this is the plugin that enables path aliases
		viteTsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		tailwindcss(),
		tanstackStart({
			srcDirectory: "src",
			start: { entry: "./start.tsx" },
			server: { entry: "./server.ts" },
		}),
		viteReact(),
		cloudflare({
			viteEnvironment: {
				name: "ssr",
			},
		}),
	],
	server: {
		proxy: {
			// Forward WebSocket requests to agent service
			"/agents": {
				target: process.env.VITE_AGENT_SERVICE_URL || "http://localhost:8787",
				ws: true, // Enable WebSocket proxying
				changeOrigin: true,
				// Don't rewrite the path - the Agents SDK expects /agents/...
				configure: (proxy, _options) => {
					proxy.on("error", (err, _req, _res) => {
						console.log("Proxy error:", err);
					});
					proxy.on("proxyReq", (proxyReq, req, _res) => {
						console.log(
							"Proxying request:",
							req.method,
							req.url,
							"->",
							proxyReq.path,
						);
					});
					proxy.on("proxyReqWs", (_proxyReq, req, _socket, options, _head) => {
						console.log("Proxying WebSocket:", req.url, "->", options.target);
					});
				},
			},
		},
	},
});

export default config;
