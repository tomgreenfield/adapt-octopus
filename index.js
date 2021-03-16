const fs = require("fs");
const os = require("os");
const path = require("path");

const inputPath = process.argv[2];
const inputId = process.argv[3];
let inputSchema;
let outputSchema;

function read() {
	try {
		if (!inputPath) throw(new Error("No input path specified"));
		if (!inputId) throw(new Error("No ID specified"));

		inputSchema = JSON.parse(fs.readFileSync(inputPath, "utf8"));
		convert();
	} catch (error) {
		console.error(error);
	}
}

function convert() {
	const properties = inputSchema.properties;

	switch (inputSchema.$ref) {
		case "http://localhost/plugins/content/component/model.schema":
			construct("course", {});
			construct("component");
			return;
		case "http://localhost/plugins/content/theme/model.schema":
			construct("theme", { properties: properties.variables });
		default:
			if (properties && properties.pluginLocations) return iterateLocations();

			construct(path.basename(inputPath, ".model.schema"));
	}
}

function iterateLocations() {
	const locations = inputSchema.properties.pluginLocations.properties;

	Object.entries(locations).forEach(([ key, value ]) => construct(key, value));

	// ensure any globals are converted
	if (!Object.keys(locations).includes("course")) construct("course", {});
}

function construct(type, schema = inputSchema) {
	const properties = schema.properties;

	switch (type) {
		case "course":
			if (schema.globals || (schema.globals = inputSchema.globals)) break;
		default:
			if (!properties || !Object.keys(properties).length) return;

			delete schema.globals;
	}

	const isCore = type === inputId;

	outputSchema = {
		$anchor: isCore ? type : `${inputId}-${type}`,
		$schema: "https://json-schema.org/draft/2019-09/schema",
		type: "object",
		$merge: {
			source: { $ref: isCore ? "content" : type },
			with: {
				required: getRequiredFields(schema),
				properties: getProperties(schema)
			}
		}
	};
  
	write(`schema/${type}.schema.json`);
}

function write(outputPath) {
	try {
		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
		fs.writeFileSync(outputPath, JSON.stringify(outputSchema, null, 2) + os.EOL);
		console.log(`Written to ${outputPath}`);
	} catch (error) {
		console.error(error);
	}
}

function stripObject(object) {
	Object.keys(object).forEach(i => object[i] === undefined && delete object[i]);

	if (!Object.keys(object).length) return;

	return object;
}

function getProperties(schema) {
	const originalProperties = schema.properties;
	const originalGlobals = schema.globals;

	if (!originalProperties && !originalGlobals) return;

	let globals = {};
	let properties = {};

	if (originalGlobals) {
		for (const key in originalGlobals) {
			if (originalGlobals.hasOwnProperty(key)) {
				globals[key] = getSchema(key, originalGlobals[key]);
			}
		}

		properties._globals = {
			type: "object",
			default: {},
			properties: {
				[`_${inputId}`]: { type: "object", default: {}, properties: globals }
			}
		};
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
		type: getType(value),
		isObjectId: getIsObjectId(value),
		title: getTitle(value, key),
		description: getDescription(value),
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

function getType(schema) {
	const type = schema.type;

	return type === "objectid" ? "string" : type;
}

function getTitle(schema, key) {
	if (schema.title) return schema.title;
	if (schema.legend) return schema.legend;
	if (key === "pluginLocations") return;

	key = key.replace(/_/g, "").replace(/[A-Z]/g, " $&").toLowerCase();

	return key.charAt(0).toUpperCase() + key.slice(1);
}

function getDescription(schema) {
	if (schema.help) return schema.help;
}

function getDefault(schema) {
	const hasDefault = schema.default !== undefined;

	if (hasDefault) return schema.default;

	const isRequired = schema.validators && schema.validators.includes("required");

	if (!hasDefault && isRequired) return;

	switch (schema.type) {
		case "string":
			return "";
		case "number":
			return 0;
		case "object":
			return {};
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

	return items.properties ?
		{ type: "object", properties: getProperties(items) } :
		{ type: getType(items), isObjectId: getIsObjectId(items) };
}

function getIsObjectId(schema) {
	if (schema.type !== "objectid") return;

	return true;
}

function getAdaptOptions(schema) {
	return stripObject({
		editorOnly: schema.editorOnly,
		isSetting: schema.isSetting,
		translatable: schema.translatable
	});
}

function getBackboneFormsOptions(schema) {
	const getEditor = () => {
		const type = schema.type;

		const recognisedTypes = [
			"string",
			"number",
			"object",
			"array",
			"boolean",
			"objectid"
		];

		const editor = options.type || schema.inputType;

		if (!recognisedTypes.includes(type)) console.log(`Unrecognised type => ${type}`);

		if (editor === "QuestionButton" ||
			type === "string" && editor === "Text" ||
			type === "number" && editor === "Number" ||
			type === "boolean" && editor === "Checkbox") {
			return;
		}

		return editor;
	};

	const getValidators = () => {
		let validators = schema.validators;

		if (!validators) return;

		validators = schema.validators.filter(validator => {
			return validator === "number" ? schema.inputType !== "Number" :
				validator !== "required";
		});

		if (!validators.length) return;

		return validators;
	};

	let options = typeof schema.inputType === "object" ? schema.inputType : {};

	Object.assign(options, {
		type: getEditor(),
		titleHTML: schema.titleHTML,
		validators: getValidators(),
		editorClass: schema.editorClass,
		editorAttrs: schema.editorAttrs,
		fieldClass: schema.fieldClass,
		fieldAttrs: schema.fieldAttrs,
		confirmDelete: schema.confirmDelete
	});

	let splitTypes = options.type && options.type.split(":");

	switch (splitTypes && splitTypes.length > 1 && splitTypes[0]) {
		case "Asset":
			options.type = { type: "Asset", media: splitTypes[1] };
			break;
		case "CodeEditor":
			options.type = { type: "CodeEditor", mode: splitTypes[1] };
	}

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
