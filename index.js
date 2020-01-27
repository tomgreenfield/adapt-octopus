const fs = require("fs-extra");
const os = require("os");
const SchemaNode = require("./SchemaNode");

class Octopus {

	constructor(inputPath, outputPath) {
		this.inputSchema = null;
		this.outputSchema = null;
		this.inputPath = inputPath;
		this.outputPath = outputPath;
	}

	async start() {
		if (!this.inputPath) throw(new Error("No input path specified."));
		this.inputSchema = JSON.parse(await fs.readFile(this.inputPath, "utf8"));
		await this.convert();
	}

	async convert() {
		this.outputSchema = new SchemaNode({
			nodeType: 'root',
			defaults: {
			  $id: "https://www.adaptlearning.org",
			  $schema: "http://json-schema.org/draft-07/schema#",
			  type: "object"
			},
			inputSchema: this.inputSchema
		}).outputSchema;
		await this.write();
	}

	async write() {
		const outputPath = this.outputPath || "schema.json";
		await fs.writeFile(outputPath, JSON.stringify(this.outputSchema, null, 2) + os.EOL);
		console.log("Written schema.");
	}

}

module.exports = Octopus;
