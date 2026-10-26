//#endregion
//#region src/schemas.ts
const toolSchemas = {
	browser: {
		annotations: {
			"title": "Use pen.dev browser",
			"readOnlyHint": false,
			"destructiveHint": false,
			"idempotentHint": false,
			"openWorldHint": true
		},
		description: "\nInteract with a real website loaded in the app's integrated browser: open a URL, reproduce a page (or one element) as editable canvas layers, screenshot it, or pull its DOM/screenshot back into the conversation.\n\nUse it to iterate on real designs: import a live page onto the canvas, take inspiration from a site, or close the loop when generating a design — load the generated page, look at it, and refine.\n\nParameters:\n- action (required):\n  - \"load-page\": load \"url\" in the target browser (opening the sidebar if closed and no \"nodeId\" is given). Returns when the load finishes or fails.\n  - \"import-to-canvas\": reproduce the target as editable Pencil layers on the canvas. The response reports the imported top-level frame's id for use with the execute tool. Each imported node's \"context\" field holds the source element's tag, prefixed with its code component name when detected (e.g. \"Card - div\") — useful for locating the element in the code.\n  - \"screenshot-to-canvas\": place a screenshot of the target on the canvas as an image.\n  - \"return-element\": return the target element's DOM and computed styles as text so you can read/reuse it.\n  - \"return-screenshot\": return a screenshot of the target as an image so you can look at it.\n  - \"cdp\": send one Chrome DevTools Protocol command (\"method\" + \"params\") to the target page and return its result as JSON text (a \"Page.captureScreenshot\" result comes back as an image). Use it to act inside the page: click, type, scroll, navigate.\n- nodeId: the id of a browser node in the document to drive. When omitted, the tool drives the browser sidebar's own page. Browser nodes are canvas nodes of type \"browser\"; find their ids with get_app_state or batch_get.\n- target (default \"full-page\"): what to act on.\n  - \"full-page\": the whole page.\n  - \"selection\": the element the user picked with the browser's element picker (errors if none).\n  - \"query\": the element resolved from \"querySelector\".\n- querySelector: a CSS selector, required when target is \"query\".\n- url: an http(s) or file URL, required (and only used) when action is \"load-page\".\n- method: the CDP method, e.g. \"Input.dispatchMouseEvent\". Required (and only used) when action is \"cdp\".\n- params: the CDP command's parameters, e.g. {\"expression\": \"document.title\", \"returnByValue\": true} for Runtime.evaluate. Used only when action is \"cdp\".\n\nUsage:\n- Call action \"load-page\" before the other actions so a page is loaded and visible.\n- localhost dev servers usually live-reload: when the page is already loaded, skip \"load-page\" and check the result directly (e.g. \"return-screenshot\"); only if your change is not visible, reload with \"load-page\" and check again.\n- Prefer target \"query\" or \"selection\" over \"full-page\" to keep imports and reads focused.\n- Be careful with \"return-element\" on \"body\"/\"html\" or broad selectors: a whole page's DOM can be huge and overflow the context. Query a specific section (e.g. \"header\", \".pricing\", \"#hero\"), or use \"return-screenshot\" to view the whole page cheaply.\n- \"return-screenshot\" is for you to inspect visually; \"screenshot-to-canvas\" and \"import-to-canvas\" put the result in the user's document.\n- Imported pages land as normal canvas nodes. Do NOT think in CSS/HTML afterwards — treat the result as a design and edit it with the execute tool like any other content.\n\nUsing CDP\n- A command that starts a navigation (including a click on a link) returns once the load finishes.\n- Only the DOM, Input, Page, Runtime, Emulation, CSS and Accessibility domains are available.\n- Do not send Escape: the editor intercepts it and deselects the node.\n- Check the result with \"return-screenshot\" or \"return-element\".\n\nExamples:\n- Reproduce a hero section as editable layers: {action: \"load-page\", url: \"https://example.com\"}, then {action: \"import-to-canvas\", target: \"query\", querySelector: \"header.hero\"}.\n- Rebuild a component faithfully: {action: \"return-element\", target: \"query\", querySelector: \".pricing-card\"} to read its DOM and styles, then {action: \"return-screenshot\", target: \"query\", querySelector: \".pricing-card\"} to check your own render against it.\n- Close the loop on a locally served generated page: {action: \"load-page\", url: \"http://localhost:3000\"}, then {action: \"return-screenshot\", target: \"full-page\"}.\n- Open a menu inside the page: locate \"button.menu\" with DOM.querySelector and DOM.getBoxModel, click its centre with Input.dispatchMouseEvent, then {action: \"return-screenshot\"}.\n",
		inputSchema: {
			"properties": {
				"action": {
					"description": "What to do: load-page, import-to-canvas, screenshot-to-canvas, return-element, return-screenshot, or cdp.",
					"enum": [
						"load-page",
						"import-to-canvas",
						"screenshot-to-canvas",
						"return-element",
						"return-screenshot",
						"cdp"
					],
					"type": "string"
				},
				"filePath": {
					"description": "An optional file path to access a .pen file.",
					"type": "string"
				},
				"method": {
					"description": "A Chrome DevTools Protocol method, e.g. \"Input.dispatchMouseEvent\". Required when action is \"cdp\".",
					"type": "string"
				},
				"nodeId": {
					"description": "Id of a browser node in the document to drive. Omit to drive the browser sidebar's own page.",
					"type": "string"
				},
				"params": {
					"additionalProperties": true,
					"description": "The CDP command's parameters for \"method\", e.g. {\"expression\": \"document.title\", \"returnByValue\": true} for Runtime.evaluate. Used when action is \"cdp\".",
					"properties": {},
					"type": "object"
				},
				"querySelector": {
					"description": "A CSS selector executed in the page. Required when target is \"query\".",
					"type": "string"
				},
				"target": {
					"description": "What to act on (default full-page).",
					"enum": [
						"full-page",
						"selection",
						"query"
					],
					"type": "string"
				},
				"url": {
					"description": "An http(s) or file URL to load. Used when action is \"load-page\".",
					"type": "string"
				}
			},
			"required": ["filePath", "action"],
			"type": "object"
		},
		name: "browser"
	},
	execute: {
		annotations: {
			"title": "Edit pen.dev design",
			"readOnlyHint": false,
			"destructiveHint": true,
			"idempotentHint": false,
			"openWorldHint": false
		},
		description: "Use get_app_state if you don't have execute documentation",
		inputSchema: {
			"properties": {
				"description": {
					"description": "Shown to the user as the label of this call. Write it first, before `input` or `edits`. A short, specific phrase of 3-8 words starting with an imperative verb that says what this call does to the design, e.g. \"Add pricing section with 3 tiers\", \"Fix header alignment\", \"Generate hero illustration\". No trailing period.",
					"type": "string"
				},
				"editId": {
					"description": "The id of the failed snippet to patch, as printed in that call's failure message. Send it only together with `edits`, and always use a valid editId that is referencing a failed execute call. Never send it alongside `input`.",
					"type": "string"
				},
				"edits": {
					"description": "When an execute call fails, ALWAYS retry with this instead of resending the snippet in `input`. Each edit replaces `find` with `replace` in the failed snippet, then the patched snippet re-runs from scratch. Edits apply in order: each `find` must match the snippet as already modified by the preceding edits. Requires `editId`; omit `input` when using it. If the patched snippet fails again, keep fixing it with further `edits` under the same editId - `find` must then match the already-patched snippet.",
					"items": {
						"additionalProperties": false,
						"properties": {
							"all": {
								"description": "Replace every occurrence instead of requiring a unique match.",
								"type": "boolean"
							},
							"find": {
								"description": "Exact text in the failed snippet to replace. Must match exactly once unless `all` is true.",
								"type": "string"
							},
							"replace": {
								"description": "The replacement text.",
								"type": "string"
							}
						},
						"required": ["find", "replace"],
						"type": "object"
					},
					"type": "array"
				},
				"filePath": {
					"description": "An optional file path to access a .pen file.",
					"type": "string"
				},
				"input": {
					"description": "The JavaScript snippet to execute. Required unless `edits` is provided.",
					"type": "string"
				}
			},
			"required": ["filePath"],
			"type": "object"
		},
		name: "execute"
	},
	get_app_state: {
		annotations: {
			"title": "Get pen.dev app state",
			"readOnlyHint": true,
			"destructiveHint": false,
			"idempotentHint": true,
			"openWorldHint": false
		},
		description: "Get info about the current state of the pen.dev app., current user selections and other essential information to get started on a task.",
		inputSchema: {
			"properties": {},
			"required": [],
			"type": "object"
		},
		name: "get_app_state"
	},
	get_style: {
		annotations: {
			"title": "Get pen.dev style",
			"readOnlyHint": true,
			"destructiveHint": false,
			"idempotentHint": true,
			"openWorldHint": false
		},
		description: "Load visual style archetypes for working with .pen files. Styles provide configurable fonts, colors, and imagery. Styles do not save variables, they only provide reference values.\n\nUsage:\n1. get_style(): list available styles\n2. get_style({ name }): load style with no params or get required params when required\n3. get_style({ name, params }): load style",
		inputSchema: {
			"properties": {
				"name": {
					"description": "Style name from the listing",
					"type": "string"
				},
				"params": {
					"description": "Key-value pairs for required params returned in step 2",
					"properties": {},
					"type": "object"
				}
			},
			"required": [],
			"type": "object"
		},
		name: "get_style"
	},
	import_website: {
		annotations: {
			"title": "Import website",
			"readOnlyHint": false,
			"destructiveHint": false,
			"idempotentHint": false,
			"openWorldHint": true
		},
		description: "\nImport a live website onto the canvas as editable layers. The whole page at \"url\" is reproduced as one new top-level frame.\n\nUse it to start from a real design: recreate an existing site, take inspiration from it, or redesign it.\n\nParameters:\n- url (required): the http(s) URL of the page to import. A bare domain like \"example.com\" is treated as https.\n\nUsage:\n- The import runs on pen.dev's servers and can take a minute or more for large pages.\n- The response reports the imported frame's id for use with the execute tool.\n- Each imported node's \"context\" field holds the source element's tag, prefixed with its code component name when detected (e.g. \"Card - div\").\n- Imported pages land as normal canvas nodes. Do NOT think in CSS/HTML afterwards — treat the result as a design and edit it with the execute tool like any other content.\n- Only public pages can be imported. Pages behind a sign-in import as their sign-in screen.\n",
		inputSchema: {
			"properties": {
				"filePath": {
					"description": "An optional file path to access a .pen file.",
					"type": "string"
				},
				"url": {
					"description": "The http(s) URL of the page to import.",
					"type": "string"
				}
			},
			"required": ["filePath", "url"],
			"type": "object"
		},
		name: "import_website"
	},
	read_skill: {
		annotations: {
			"title": "Read pen.dev skill",
			"readOnlyHint": true,
			"destructiveHint": false,
			"idempotentHint": true,
			"openWorldHint": false
		},
		description: "Read the pen-dev skill that teaches how to design on the pen.dev canvas.\n\nUsage:\n1. read_skill(): returns the skill's SKILL.md\n2. read_skill({ path }): read a file referenced from SKILL.md (e.g. \"execute.md\", \"guide/web-app.md\")",
		inputSchema: {
			"properties": { "path": {
				"description": "Relative path of a file referenced from SKILL.md. Omit to read SKILL.md itself.",
				"type": "string"
			} },
			"required": [],
			"type": "object"
		},
		name: "read_skill"
	},
	spawn_agents: {
		annotations: {
			"title": "Start pen.dev agents",
			"readOnlyHint": false,
			"destructiveHint": false,
			"idempotentHint": false,
			"openWorldHint": false
		},
		description: "Use this tool to break up design tasks to multiple designer agents to work in parallel. Always create one less designer agent then needed, since the existing agent session will accomplish the last remaining part of the task.\n\n- Use this tool when the task involves creating design with\n	- multiple sections (like in websites),\n	- multiple app screens,\n	- multiple websites, or variations of the same website,\n	- variations of some design,\n	- anytime there is opportunity to split the work up between designer agents.\n- When creating large designs ALWAYS use this tool to break up your main tasks into subtasks for designer agents that can work in parallel and achieve the main task much faster and better.\n- IMPORTANT: When you are splitting up related sections, for example sections of a website, make sure to put the separate section nodes into a parent node first.\n- Designer agents do not inherit guidelines from the parent agent. If you have already picked a guide or a guideline style, include their names and params in each agent's prompt so the agent can fetch them itself.\n- When you know you will spawn designer agents, make sure to create placeholder nodes for them where they can work in. Then pass the node ID of the container node where they should work in as argument in the config array entries.\n- The prompt should be brief and should contain a short summary of what the agent needs to design.\n- IMPORTANT: Make sure the designer agents prompts describe the designs consistently, so if matching styles are needed, they will all look the same based on the prompt.\n- Designer agents can read the design variables in the document, so DO NOT include them into the prompt.\n- IMPORTANT: Design agents can come up with the the design layout themselves, it's important to NOT include any layout information, sizes, colors or variable names in the prompt.\n- Create maximum 8-10 designer agents at once.\n- DO NOT put placeholder on the nodes the agents will work in and also NOT on the parent node if there is any.\n\n## Examples\n\nMain prompt: \"create an iOS app for a bank with 4 screens: a sign in/sign up screen, an overview, a transfer and a profile screen.\"\n\nThinking: \"After checking the editor state, picking the 'Mobile App' guide and creating 4 placeholder nodes for the screens on the canvas, I'm going to use the 'spawn_agents' tool to split the work up between 3 newly spawned designer agents and this session creating each creating one of the screens.\"\n\nTool call:\n{\n	\"config\": [\n		{\n			\"prompt\": \"Implement the sign up screen for an iOS bank app. Use the 'Mobile App' guide\",\n			\"containerNodes\": [\"cde35Sa\"]\n		},\n		{\n			\"prompt\": \"Implement the overview app screen for an iOS bank app. Use the 'Mobile App' guide,\n			\"containerNodes\": [\"dg3tX2\"]\n		},\n		{\n			\"prompt\": \"Implement the transfer app screen for an iOS bank app. Use the 'Mobile App' guide,\n			\"containerNodes\": [\"sh3Z1x\"]\n		}\n	]\n}\n\nAnd now I will implement the last part, the profile screen for an iOS bank app.\n",
		inputSchema: {
			"properties": {
				"config": {
					"description": "The required config for the extra agents that will be spawned and executed in parallel alongside the current agent.",
					"items": {
						"additionalProperties": false,
						"properties": {
							"containerNodes": {
								"description": "The valid node IDs in the document in which the designer agent should accomplish the given task. Make sure to always specify at least one node ID to work in.",
								"type": "array"
							},
							"prompt": {
								"description": "The prompt for the designer agent to run.",
								"type": "string"
							}
						},
						"type": "object"
					},
					"type": "array"
				},
				"filePath": {
					"description": "An optional file path to access a .pen file.",
					"type": "string"
				}
			},
			"required": ["filePath", "config"],
			"type": "object"
		},
		name: "spawn_agents"
	}
};
//#endregion
export { toolSchemas as t };

//# sourceMappingURL=schemas-DvujrUYo.mjs.map