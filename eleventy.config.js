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
