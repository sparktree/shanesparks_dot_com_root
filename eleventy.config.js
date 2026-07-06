import { feedPlugin } from "@11ty/eleventy-plugin-rss";

export default function (eleventyConfig) {
	// Static assets copied through untouched.
	eleventyConfig.addPassthroughCopy("src/css");
	eleventyConfig.addPassthroughCopy("src/js");
	eleventyConfig.addPassthroughCopy("src/fonts");
	eleventyConfig.addPassthroughCopy("src/img");

	// Self-hosted runtimes (Pyodide, Transformers.js) and model weights —
	// live outside src/ because they are vendored, not authored. See PLAN.md Phase 3.
	eleventyConfig.addPassthroughCopy({ vendor: "vendor" });
	eleventyConfig.addPassthroughCopy({ models: "models" });

	// Writings: every Markdown file under src/writings/ is a post.
	eleventyConfig.addCollection("writings", (api) =>
		api.getFilteredByGlob("src/writings/*.md").reverse()
	);

	// A reader can follow the site with no platform in between.
	eleventyConfig.addPlugin(feedPlugin, {
		type: "atom",
		outputPath: "/feed.xml",
		collection: { name: "writings", limit: 10 },
		metadata: {
			language: "en",
			title: "Shane Sparks",
			subtitle:
				"Natural language processing — projects, in-browser demos, and writing.",
			base: "https://shanesparks.com/",
			author: { name: "Shane Sparks" },
		},
	});

	eleventyConfig.addFilter("readableDate", (d) =>
		new Date(d).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			timeZone: "UTC",
		})
	);
	eleventyConfig.addFilter("isoDate", (d) =>
		new Date(d).toISOString().slice(0, 10)
	);

	return {
		dir: {
			input: "src",
			includes: "_includes",
			data: "_data",
			output: "_site",
		},
		templateFormats: ["njk", "md", "html"],
		markdownTemplateEngine: "njk",
		htmlTemplateEngine: "njk",
	};
}
