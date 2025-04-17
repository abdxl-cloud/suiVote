import {
	type RouteConfig,
	index,
	layout,
	route,
} from "@react-router/dev/routes";

export default [
	layout("./layouts/RootLayout.tsx", [
		index("routes/home.tsx"),
		route("create", "routes/create-poll.tsx"),
		route("dashboard", "routes/dashboard.tsx"),
		route("poll/:id", "routes/poll-detail.tsx"),
	]),
] satisfies RouteConfig;
