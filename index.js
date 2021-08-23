const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const SchemaNode = require("./SchemaNode");

class Octopus {

	inputPath;
	outputPath;
	inputId;
	inputSchema;
	outputSchema;

	constructor({ inputPath, inputId }) {
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
				if (properties?.pluginLocations) return await this.iterateLocations();
	
				await this.construct(path.basename(this.inputPath, ".model.schema"));
		}
	}

	async iterateLocations() {
		const locations = this.inputSchema.properties.pluginLocations.properties;

		for (const location of Object.entries(locations)) {
			await this.construct(...location);
		}

		// ensure any globals are converted
		if (!Object.keys(locations).includes("course")) {
			await this.construct("course", {});
		}
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

		this.outputSchema = new SchemaNode({
			nodeType: 'root',
			schemaType: type,
			inputId: this.inputId,
			inputSchema: schema
		});

		this.outputPath = `schema/${type}.schema.json`;
		await this.write();
	}

	async write() {
		const json = JSON.stringify(this.outputSchema, null, 2) + os.EOL;

		await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
		await fs.writeFile(this.outputPath, json);
		console.log(`Written to ${this.outputPath}`);
	}

}

module.exports = Octopus;
