const fs = require("fs");
const os = require("os");

let inputSchema;
let outputSchema;

function read() {
	const inputPath = process.argv[2];

	if (!inputPath) throw(new Error("No input path specified."));

	fs.readFile(inputPath, "utf8", (error, data) => {
		if (error) throw error;

		inputSchema = JSON.parse(data);
		convert();
	});
}

function convert() {
	outputSchema = {
	  $id: "https://www.adaptlearning.org",
	  $schema: "http://json-schema.org/draft-07/schema#",
	  type: "object",
	  required: getRequiredFields(inputSchema),
	  properties: getProperties(inputSchema)
	};

	write();
}

function write() {
	const outputPath = process.argv[3] || "schema.json";

	fs.writeFile(outputPath, JSON.stringify(outputSchema, null, 2) + os.EOL, error => {
		if (error) throw error;

		console.log("Written schema.");
	});
}

function stripObject(object) {
	Object.keys(object).forEach(i => object[i] === undefined && delete object[i]);

	if (!Object.keys(object).length) return;

	return object;
}

function getProperties(schema) {
	const originalProperties = schema.properties;
	const globals = schema.globals;

	if (!originalProperties && !globals) return;

	let properties = {};

	if (globals) {
		properties.globals = {};

		for (const key in globals) {
			if (globals.hasOwnProperty(key)) {
				properties.globals[key] = getSchema(key, globals[key]);
			}
		}
	}

	for (const key in originalProperties) {
		if (originalProperties.hasOwnProperty(key)) {
			properties[key] = getSchema(key, originalProperties[key]);
		}
	}

	return properties;
}

function getSchema(key, value) {
	return {
		type: value.type,
		title: getTitle(value, key),
		description: value.help,
		default: getDefault(value),
		enum: getEnumeratedValues(value),
		required: getRequiredFields(value),
		items: getItems(value),
		properties: getProperties(value),
		_adapt: getAdaptOptions(value),
		_backboneForms: getBackboneFormsOptions(value),
		_unrecognisedFields: getUnrecognisedFields(value)
	};
}

function getTitle(schema, key) {
	if (schema.title) return schema.title;
	if (schema.legend) return schema.legend;
	if (key === "pluginLocations") return;

	key = key.replace(/_/g, "").replace(/[A-Z]/g, " $&").toLowerCase();

	return key.charAt(0).toUpperCase() + key.slice(1);
}

function getDefault(schema) {
	if (schema.default !== undefined) return schema.default;

	switch (schema.type) {
		case "string":
			return "";
		case "number":
			return 0;
		case "object":
			if (!schema.properties) return {};
			break;
		case "array":
			if (!schema.items) return [];
			break;
		case "boolean":
			return false;
	}
}

function getEnumeratedValues(schema) {
	if (schema.enum) return schema.enum;

	const inputType = schema.inputType;

	if (inputType && inputType.type === "Select") return inputType.options;
}

function getRequiredFields(schema) {
	const properties = schema.properties;

	if (!properties) return;

	let requiredFields = [];

	for (const key in properties) {
		if (!properties.hasOwnProperty(key)) continue;

		const validators = properties[key].validators;

		if (validators && validators.includes("required")) requiredFields.push(key);
	}

	if (!requiredFields.length) return;

	return requiredFields;
}

function getItems(schema) {
	const items = schema.items;

	if (!items) return;

	if (!items.properties) {
		console.log(`Removing unrecognised items: ${JSON.stringify(items)}`);
		return;
	}

	return { type: "object", properties: getProperties(items) };
}

function getAdaptOptions(schema) {
	return stripObject({
		editorOnly: schema.editorOnly,
		isSetting: schema.isSetting,
		translatable: schema.translatable
	});
}

function getBackboneFormsOptions(schema) {
	const getType = () => {
		const type = schema.type;
		const recognisedTypes = [ "string", "number", "object", "array", "boolean" ];
		const editor = options.type || schema.inputType;

		if (!recognisedTypes.includes(type)) console.log(`Unrecognised type => ${type}`);

		if (type === "string" && editor === "Text" ||
			type === "number" && editor === "Number" ||
			type === "boolean" && editor === "Checkbox") {
			return;
		}

		return editor;
	};

	const getValidators = () => {
		let validators = schema.validators;

		if (!validators) return;

		validators = schema.validators.filter(validator => validator !== "required");

		if (!validators.length) return;

		return validators;
	};

	let options = typeof schema.inputType === "object" ? schema.inputType : {};

	Object.assign(options, {
		type: getType(),
		titleHTML: schema.titleHTML,
		validators: getValidators(),
		editorClass: schema.editorClass,
		editorAttrs: schema.editorAttrs,
		fieldClass: schema.fieldClass,
		fieldAttrs: schema.fieldAttrs,
		confirmDelete: schema.confirmDelete
	});

	if (options.type === "Select") delete options.options;

	options = stripObject(options);

	return options && Object.keys(options).length === 1 && options.type || options;
}

function getUnrecognisedFields(schema) {
	const recognisedKeys = [
		"confirmDelete",
		"default",
		"description",
		"editorAttrs",
		"editorClass",
		"editorOnly",
		"enum",
		"fieldAttrs",
		"fieldClass",
		"help",
		"inputType",
		"items",
		"isSetting",
		"legend",
		"properties",
		"required",
		"title",
		"titleHTML",
		"translatable",
		"type",
		"validators"
	];

	let unrecognisedFields = {};

	Object.keys(schema).forEach(key => {
		if (recognisedKeys.includes(key)) return;

		console.log(`Unrecognised field => "${key}": ${JSON.stringify(schema[key])}`);
		unrecognisedFields[key] = schema[key];
	});

	return stripObject(unrecognisedFields);
}

module.exports.read = read;
