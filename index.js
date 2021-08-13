const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const SchemaNode = require("./SchemaNode");

class Octopus {

	constructor(inputPath, inputId) {
		this.inputSchema = null;
		this.outputSchema = null;
		this.inputPath = inputPath;
		this.inputId = inputId;
	}

	async start() {
		if (!this.inputPath) throw(new Error("No input path specified"));
		if (!this.inputId) throw(new Error("No ID specified"));

		this.inputSchema = JSON.parse(await fs.readFile(this.inputPath, "utf8"));
		await this.convert();
	}

	async convert() {
		const properties = this.inputSchema.properties;

		switch (this.inputSchema.$ref) {
			case "http://localhost/plugins/content/component/model.schema":
				await this.construct("course", {});
				await this.construct("component");
				return;
			case "http://localhost/plugins/content/theme/model.schema":
				await this.construct("theme", { properties: properties.variables });
			default:
				if (properties && properties.pluginLocations) return await this.iterateLocations();
	
				await this.construct(path.basename(this.inputPath, ".model.schema"));
		}
	}

	async iterateLocations() {
		const locations = this.inputSchema.properties.pluginLocations.properties;

		for (const location of Object.entries(locations)) {
			await this.construct(...location);
		}

		// ensure any globals are converted
		if (!Object.keys(locations).includes("course")) await this.construct("course", {});
	}

	async construct(type, schema = this.inputSchema) {
		const properties = schema.properties;

		switch (type) {
			case "course":
				if (schema.globals || (schema.globals = this.inputSchema.globals)) break;
			default:
				if (!properties || !Object.keys(properties).length) return;

				delete schema.globals;
		}

		const isCore = type === this.inputId;

		this.outputSchema = new SchemaNode({
			nodeType: 'root',
			isCore,
			schemaType: type,
			defaults: {
				$anchor: isCore ? type : `${this.inputId}-${type}`,
				$schema: "https://json-schema.org/draft/2020-12/schema",
				type: "object"
			},
			inputId: this.inputId,
			inputSchema: schema
		}).outputSchema;

		await this.write(`schema/${type}.schema.json`);
	}

	async write(outputPath) {
		await fs.mkdir(path.dirname(outputPath), { recursive: true });
		await fs.writeFile(outputPath, JSON.stringify(this.outputSchema, null, 2) + os.EOL);
		console.log(`Written to ${outputPath}`);
	}

}

module.exports = Octopus;
