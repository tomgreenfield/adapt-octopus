const stripObject = require("./utils/stripObject");

class SchemaNode {

	constructor(options) {
		this.inputSchema = options.inputSchema;
		this.outputSchema = {};
		switch (options.nodeType) {
			case "root":
				if (options.defaults) {
					Object.assign(this.outputSchema, options.defaults);
				}
				Object.assign(this.outputSchema, {
					required: this.getRequiredFields(),
					properties: this.getProperties()
				});
				return;
			case "properties":
				const key = options.key;
				const schema = this.inputSchema;
				Object.assign(this.outputSchema, {
					type: schema.type,
					title: this.getTitle(key),
					description: schema.help,
					default: this.getDefault(),
					enum: this.getEnumeratedValues(),
					required: this.getRequiredFields(),
					items: this.getItems(),
					properties: this.getProperties(),
					_adapt: this.getAdaptOptions(),
					_backboneForms: this.getBackboneFormsOptions(),
					_unrecognisedFields: this.getUnrecognisedFields()
				});
				return;
			case "items":
				Object.assign(this.outputSchema, {
					type: "object", 
					properties: this.getItemsProperties() 
				});
				return;
		}
	}

	getItemsProperties() {
		const schema = this.inputSchema;
		const originalItems = schema.properties;

		if (!originalItems) return;

		let itemsProperties = {};

		for (const key in originalItems) {
			itemsProperties[key] = (new SchemaNode({
				nodeType: "properties",
				key,
				inputSchema: originalItems[key]
			})).outputSchema;
		}

		return itemsProperties;
	}

	getProperties() {
		const schema = this.inputSchema;
		const originalProperties = schema.properties;
		const globals = schema.globals;

		if (!originalProperties && !globals) return;

		let properties = {};

		if (globals) {
			properties.globals = {};

			for (const key in globals) {
				properties.globals[key] = (new SchemaNode({
					nodeType: "properties",
					key,
					inputSchema: globals[key]
				})).outputSchema;
			}
		}

		for (const key in originalProperties) {
			properties[key] = (new SchemaNode({
				nodeType: "properties",
				key,
				inputSchema: originalProperties[key]
			})).outputSchema;
		}

		return properties;
	}

	getTitle(key) {
		const schema = this.inputSchema;
		if (schema.title) return schema.title;
		if (schema.legend) return schema.legend;
		if (key === "pluginLocations") return;

		key = key.replace(/_/g, "").replace(/[A-Z]/g, " $&").toLowerCase();

		return key.charAt(0).toUpperCase() + key.slice(1);
	}

	getDefault() {
		const schema = this.inputSchema;
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

	getEnumeratedValues() {
		const schema = this.inputSchema;
		if (schema.enum) return schema.enum;

		const inputType = schema.inputType;

		if (inputType && inputType.type === "Select") return inputType.options;
	}

	getRequiredFields() {
		const schema = this.inputSchema;
		const properties = schema.properties;

		if (!properties) return;

		let requiredFields = [];

		for (const key in properties) {
			const validators = properties[key].validators;

			if (validators && validators.includes("required")) requiredFields.push(key);
		}

		if (!requiredFields.length) return;

		return requiredFields;
	}

	getItems() {
		const schema = this.inputSchema;
		const items = schema.items;

		if (!items) return;

		if (!items.properties) {
			console.log(`Removing unrecognised items: ${JSON.stringify(items)}`);
			return;
		}

		return new SchemaNode({
			nodeType: "items",
			inputSchema: items
		}).outputSchema;
	}

	getAdaptOptions() {
		const schema = this.inputSchema;
		return stripObject({
			editorOnly: schema.editorOnly,
			isSetting: schema.isSetting,
			translatable: schema.translatable
		});
	}

	getBackboneFormsOptions() {
		const schema = this.inputSchema;
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

	getUnrecognisedFields() {
		const schema = this.inputSchema;
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

}

module.exports = SchemaNode;
