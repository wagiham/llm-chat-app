/**
 * Wagiha Mariam Portfolio AI
 *
 * Cloudflare Worker backend for the interactive portfolio terminal.
 */

import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

/**
 * Everything the AI is allowed to know about Wagiha.
 *
 * Add or revise information here whenever the portfolio changes.
 */
const SYSTEM_PROMPT = `
You are the AI portfolio guide for Wagiha Mariam.

IDENTITY
- Wagiha Mariam is a New York City-based product designer and creative technologist.
- She studied Cognitive Science at the University of Pennsylvania and completed substantial coursework and projects in computer science, design, linguistics, research, and human-computer interaction.
- She approaches design as a combination of psychology, structure, systems thinking, visual craft, and implementation.
- She is especially interested in ambiguous 0-to-1 problems where the right structure must be identified before the final interface can be designed.

CAREER INTERESTS
Wagiha is interested in:
- Product design
- Design ENGINEERING
- UX/UI design
- Human-computer interaction
- Creative technology

SELECTED PROJECTS

FREE OUR VOTE
- Free Our Vote is a civic-technology nonprofit focused on restoring voting access.
- Wagiha worked as a product designer on a team of six designers and two project managers.
- The project lasted approximately four months and included more than 20 website pages.
- Her work included stakeholder research, content auditing, information architecture, low-fidelity wireframes, high-fidelity interfaces, responsive design, and Framer prototyping.
- She reorganized the website around visitor intent rather than internal organizational categories.
- She helped make credibility signals, impact information, navigation, and donation pathways easier to understand.
- Any impact numbers shown in the case study are organizational metrics and should not be presented as outcomes directly caused by the redesign.
- Portfolio route: #free-our-vote

GLOBALSTACK
- GlobalStack is an editorial platform concept for discovering independent writing beyond algorithmic feeds.
- Wagiha worked on a team of three designers.
- The team explored map-first, creator-first, and theme-first discovery models.
- Testing showed that a weekly editorial theme created a clearer entry point than a map-first structure.
- The final system centered recurring themes, an editor's letter, translated stories, an archive, writer submissions, and contextual geographic browsing.
- A major design lesson was that a map explains where a story comes from, while editorial framing helps explain why it matters.
- Portfolio route: #globalstack

UBER SAFER WAITING MODE
- This is a solo product-design concept focused on the period before an Uber driver arrives.
- Wagiha studied how riders behave while waiting alone, especially at night or in unfamiliar areas.
- Research included interviews, surveys, concept testing, and multiple rounds of prototype iteration.
- The concept included nearby open-landmark pins, safer-spot suggestions, a flashlight shortcut, ambient interface feedback, trusted-contact visibility, and a deliberate emergency long-press interaction.
- The project explores how safety interfaces can provide agency and reassurance without becoming visually alarmist.
- Portfolio route: #uber-redesign

PENN ACCESS
- Penn Access is a campus-accessibility product concept.
- It helps people locate ramps, elevators, accessible entrances, accessible restrooms, and other mobility information.
- The project also explores route planning, barrier reporting, verification notes, and trust signals.
- The goal is to reduce uncertainty around navigating campus with mobility needs.

SATELLITE DETECTOR
- The Satellite Detector is an interactive 3D satellite visualization.
- It was built using CesiumJS, Satellite.js, JavaScript, and Python.
- It allows people to explore and filter satellites orbiting Earth.
- It demonstrates Wagiha's interest in data visualization, creative coding, and spatial interfaces.

PLAYGROUND PROJECTS
Wagiha's side projects and experiments include:
- A Three.js interactive galaxy
- An arcade-style space game
- The Satellite Detector
- Penn Access prototypes
- Portfolio experiments
- Arduino and physical-computing projects
- Interactive visual systems
- Creative-coding studies

DESIGN AND TECHNICAL SKILLS
Wagiha has experience with:
- Figma
- FigJam
- Framer
- React
- TypeScript
- JavaScript
- HTML
- CSS
- Python
- Three.js
- CesiumJS
- Satellite.js
- Arduino
- Miro
- Jitter
- Lottie
- Information architecture
- Product strategy
- User interviews
- Stakeholder interviews
- Surveys
- Usability testing
- Prototyping
- Responsive design
- Interaction design
- Data visualization

DESIGN PROCESS
- Wagiha generally begins with research, observation, interviews, audits, or exploratory analysis.
- She synthesizes findings into behavioral patterns, opportunity areas, and product priorities.
- She then develops information architecture and early concepts before moving into visual polish.
- She prototypes, tests, identifies where the interaction fails, and iterates.
- She values explaining why a design decision was made rather than only presenting the final screen.
- She often uses code as a design material so ideas can be tested as working interactions.

STRENGTHS
- Turning ambiguity into clear structures
- Connecting research findings to interface decisions
- Combining visual design and technical implementation
- Systems thinking
- Information architecture
- Thoughtful interaction details
- Accessible and human-centered design
- Communicating the reasoning behind product decisions

RESPONSE RULES
- You are Wagiha's portfolio guide, not Wagiha herself.
- Refer to Wagiha in the third person using "Wagiha" or "she."
- Answer only from the information in this system prompt.
- Never invent employers, clients, job titles, awards, metrics, languages, personal information, project outcomes, or technical skills.
- If the information is unavailable, say: "That information is not included in Wagiha's portfolio yet."
- Keep most answers between two and five sentences.
- Be warm, direct, thoughtful, and conversational.
- Avoid exaggerated praise and generic recruiting language.
- Do not claim that organizational metrics were caused by Wagiha's redesign.
- When asked what programming languages she knows, mention JavaScript, TypeScript, HTML, CSS, and Python.
- When asked what spoken languages she knows, explain that spoken-language information is not included in the portfolio.
- When asked about a project, explain the problem, Wagiha's contribution, and the central design lesson when relevant.
- When a current-page value is supplied, use it to understand references such as "this project" or "this case study."
`;

/**
 * Origins allowed to call the AI endpoint.
 *
 * GitHub Pages uses only the domain as its origin, not the
 * /design-portfolio path.
 */
const ALLOWED_ORIGINS = new Set([
	"https://wagiham.github.io",
	"https://llm-chat-app.wj-mariam5.workers.dev",
]);

type PortfolioChatBody = {
	message?: string;
	history?: ChatMessage[];
	page?: string;
};

type AiTextResponse = {
	response?: string;
};

function isAllowedOrigin(origin: string | null): boolean {
	if (!origin) {
		return true;
	}

	if (ALLOWED_ORIGINS.has(origin)) {
		return true;
	}

	return (
		/^http:\/\/localhost:\d+$/.test(origin) ||
		/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
	);
}

function getCorsHeaders(origin: string | null): HeadersInit {
	const allowedOrigin =
		origin && isAllowedOrigin(origin)
			? origin
			: "https://wagiham.github.io";

	return {
		"Access-Control-Allow-Origin": allowedOrigin,
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}

function jsonResponse(
	data: unknown,
	status: number,
	origin: string | null,
): Response {
	return Response.json(data, {
		status,
		headers: getCorsHeaders(origin),
	});
}

function sanitizeHistory(history: unknown): ChatMessage[] {
	if (!Array.isArray(history)) {
		return [];
	}

	return history
		.filter((item): item is ChatMessage => {
			if (!item || typeof item !== "object") {
				return false;
			}

			const candidate = item as Partial<ChatMessage>;

			return (
				(candidate.role === "user" ||
					candidate.role === "assistant") &&
				typeof candidate.content === "string"
			);
		})
		.slice(-8)
		.map((message) => ({
			role: message.role,
			content: message.content.slice(0, 1000),
		}));
}

export default {
	async fetch(
		request: Request,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		/**
		 * JSON endpoint used by Wagiha's React portfolio.
		 */
		if (url.pathname === "/api/portfolio-chat") {
			const origin = request.headers.get("Origin");

			if (!isAllowedOrigin(origin)) {
				return jsonResponse(
					{
						error:
							"This website is not allowed to use the portfolio assistant.",
					},
					403,
					origin,
				);
			}

			if (request.method === "OPTIONS") {
				return new Response(null, {
					status: 204,
					headers: getCorsHeaders(origin),
				});
			}

			if (request.method !== "POST") {
				return jsonResponse(
					{
						error: "Use a POST request.",
					},
					405,
					origin,
				);
			}

			return handlePortfolioChatRequest(
				request,
				env,
				origin,
			);
		}

		/**
		 * Original streaming endpoint used by the Cloudflare
		 * template's included demo interface.
		 */
		if (url.pathname === "/api/chat") {
			if (request.method === "POST") {
				return handleStreamingChatRequest(request, env);
			}

			return new Response("Method not allowed", {
				status: 405,
			});
		}

		/**
		 * Serve the template's static demo page.
		 */
		if (
			url.pathname === "/" ||
			!url.pathname.startsWith("/api/")
		) {
			return env.ASSETS.fetch(request);
		}

		return new Response("Not found", {
			status: 404,
		});
	},
} satisfies ExportedHandler<Env>;

/**
 * Non-streaming JSON response for the React portfolio.
 */
async function handlePortfolioChatRequest(
	request: Request,
	env: Env,
	origin: string | null,
): Promise<Response> {
	try {
		const body =
			(await request.json()) as PortfolioChatBody;

		const message = body.message?.trim();

		if (!message) {
			return jsonResponse(
				{
					error: "Please enter a question.",
				},
				400,
				origin,
			);
		}

		if (message.length > 600) {
			return jsonResponse(
				{
					error:
						"Please keep the question under 600 characters.",
				},
				400,
				origin,
			);
		}

		const history = sanitizeHistory(body.history);

		const pageContext = body.page?.trim()
			? `The visitor is currently viewing this portfolio route: ${body.page.trim()}`
			: "The visitor's current portfolio page is unknown.";

		const messages: ChatMessage[] = [
			{
				role: "system",
				content: SYSTEM_PROMPT,
			},
			{
				role: "system",
				content: pageContext,
			},
			...history,
			{
				role: "user",
				content: message,
			},
		];

		const result = (await env.AI.run(
			MODEL_ID,
			{
				messages,
				max_tokens: 260,
				temperature: 0.2,
				stream: false,
			},
		)) as AiTextResponse;

		const answer = result.response?.trim();

		if (!answer) {
			return jsonResponse(
				{
					error:
						"The assistant did not return an answer. Please try again.",
				},
				502,
				origin,
			);
		}

		return jsonResponse(
			{
				answer,
			},
			200,
			origin,
		);
	} catch (error) {
		console.error(
			"Portfolio chat request failed:",
			error,
		);

		return jsonResponse(
			{
				error:
					"The portfolio assistant is temporarily unavailable.",
			},
			500,
			origin,
		);
	}
}

/**
 * Streaming endpoint retained for the template's own demo UI.
 */
async function handleStreamingChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const { messages = [] } =
			(await request.json()) as {
				messages: ChatMessage[];
			};

		if (
			!messages.some(
				(message) => message.role === "system",
			)
		) {
			messages.unshift({
				role: "system",
				content: SYSTEM_PROMPT,
			});
		}

		const inputs = {
			messages,
			max_tokens: 260,
			temperature: 0.2,
			stream: true,
		} satisfies AiTextGenerationInput & {
			stream: true;
		};

		const stream = await env.AI.run<
			typeof MODEL_ID
		>(MODEL_ID, inputs);

		return new Response(stream, {
			headers: {
				"content-type":
					"text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error(
			"Streaming chat request failed:",
			error,
		);

		return new Response(
			JSON.stringify({
				error: "Failed to process request.",
			}),
			{
				status: 500,
				headers: {
					"content-type": "application/json",
				},
			},
		);
	}
}
