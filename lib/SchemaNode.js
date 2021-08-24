import stripObject from "../utils/stripObject.js";

export default class SchemaNode {

	inputId;
	inputSchema;

	constructor(options) {
		this.inputId = options.inputId;
		this.inputSchema = options.inputSchema;

		switch (options.nodeType) {
			case "root":
				const type = options.schemaType;
				const isCore = type === this.inputId;
				const isExtension = (!isCore || type !== "config") && type !== "theme";

				let schemaInner = {
					required: this.getRequiredFields(),
					properties: this.getProperties()
				};

				if (isExtension) {
					schemaInner = {
						[isCore ? "$merge" : "$patch"]: {
							source: { $ref: isCore ? "content" : type },
							with: schemaInner
						}
					}
				}

				return {
					$anchor: isCore ? type : `${this.inputId}-${type}`,
					$schema: "https://json-schema.org/draft/2020-12/schema",
					type: "object",
					...schemaInner
				};
			case "properties":
				return {
					type: this.inputSchema.type,
					isObjectId: this.getIsObjectId(),
					title: this.getTitle(options.key),
					description: this.getDescription(),
					default: this.getDefault(),
					enum: this.getEnumeratedValues(),
					required: this.getRequiredFields(),
					items: this.getItems(),
					properties: this.getProperties(),
					_adapt: this.getAdaptOptions(),
					_backboneForms: this.getBackboneFormsOptions(),
					_unrecognisedFields: this.getUnrecognisedFields()
				};
			case "items":
				const properties = this.getItemsProperties();

				return {
					type: properties ? this.getType() : "object",
					isObjectId: this.getIsObjectId(),
					properties
				};
		}
	}

	getItemsProperties() {
		const originalItems = this.inputSchema.properties;

		if (!originalItems) return;

		return Object.entries(originalItems).reduce((a, [ key, inputSchema ]) => {
			a[key] = new SchemaNode({ nodeType: "properties", key, inputSchema });

			return a;
		}, {});
	}

	getProperties() {
		const originalProperties = this.inputSchema.properties;
		const originalGlobals = this.inputSchema.globals;

		if (!originalProperties && !originalGlobals) return;

		let globals = {};
		let properties = {};

		if (originalGlobals) {
			for (const [ key, inputSchema ] of Object.entries(originalGlobals)) {
				globals[key] = new SchemaNode({
					nodeType: "properties",
					key,
					inputSchema
				});
			}

			properties._globals = {
				type: "object",
				default: {},
				properties: {
					[`_${this.inputId}`]: {
						type: "object",
						default: {},
						properties: globals
					}
				}
			};
		}

		for (const [ key, inputSchema ] of Object.entries(originalProperties)) {
			properties[key] = new SchemaNode({
				nodeType: "properties",
				key,
				inputSchema
			});
		}

		return properties;
	}

	getType() {
		const type = this.inputSchema.type;

		return type === "objectid" ? "string" : type;
	}

	getTitle(key) {
		const { title, legend } = this.inputSchema;

		if (title) return title;
		if (legend) return legend;
		if (key === "pluginLocations") return;

		key = key.replace(/_/g, "").replace(/[A-Z]/g, " $&").toLowerCase();

		return key.charAt(0).toUpperCase() + key.slice(1);
	}

	getDescription() {
		const help = this.inputSchema.help;

		if (help) return help;
	}

	getDefault() {
		if (this.getIsObjectId()) return;

		const originalDefault = this.inputSchema.default;

		if (originalDefault !== undefined) return originalDefault;
		if (this.inputSchema.validators?.includes("required")) return;

		switch (this.inputSchema.type) {
			case "string":
				return "";
			case "number":
				return 0;
			case "object":
				return {};
			case "array":
				if (!this.inputSchema.items) return [];
				break;
			case "boolean":
				return false;
		}
	}

	getEnumeratedValues() {
		const { originalEnum, inputType } = this.inputSchema;

		if (originalEnum) return originalEnum;
		if (inputType?.type === "Select") return inputType.options;
	}

	getRequiredFields() {
		const properties = this.inputSchema.properties;

		if (!properties) return;

		const requiredFields = Object.entries(properties).reduce((a, [ key, value ]) => {
			if (value.validators?.includes("required")) a.push(key);

			return a;
		}, []);

		if (!requiredFields.length) return;

		return requiredFields;
	}

	getItems() {
		const items = this.inputSchema.items;

		if (items) return new SchemaNode({ nodeType: "items",  inputSchema: items });
	}

	getIsObjectId() {
		const inputType = this.inputSchema.inputType;
		const isAsset = (inputType?.type || inputType)?.startsWith("Asset");

		if (isAsset || this.inputSchema.type === "objectid") return true;
	}

	getAdaptOptions() {
		return stripObject({
			editorOnly: this.inputSchema.editorOnly,
			isSetting: this.inputSchema.isSetting,
			translatable: this.inputSchema.translatable
		});
	}

	getBackboneFormsOptions() {
		const inputType = this.inputSchema.inputType;

		const getEditor = () => {
			const type = this.inputSchema.type;

			const recognisedTypes = [
				"string",
				"number",
				"object",
				"array",
				"boolean",
				"objectid"
			];

			const editor = options.type || inputType;

			if (!recognisedTypes.includes(type)) {
				console.log(`Unrecognised type => ${type}`);
			}

			if (editor === "QuestionButton" ||
				type === "string" && editor === "Text" ||
				type === "number" && editor === "Number" ||
				type === "boolean" && editor === "Checkbox") {
				return;
			}

			return editor;
		};

		const getValidators = () => {
			let validators = this.inputSchema.validators;

			if (!validators) return;

			validators = this.inputSchema.validators.filter(validator => {
				return validator === "number" ? inputType !== "Number" :
					validator !== "required";
			});

			if (!validators.length) return;

			return validators;
		};

		let options = typeof inputType === "object" ? inputType : {};

		Object.assign(options, {
			type: getEditor(),
			titleHTML: this.inputSchema.titleHTML,
			validators: getValidators(),
			editorClass: this.inputSchema.editorClass,
			editorAttrs: this.inputSchema.editorAttrs,
			fieldClass: this.inputSchema.fieldClass,
			fieldAttrs: this.inputSchema.fieldAttrs,
			confirmDelete: this.inputSchema.confirmDelete
		});

		const splitTypes = options.type?.split(":");

		switch (splitTypes?.length > 1 && splitTypes[0]) {
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

	getUnrecognisedFields() {
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

		for (const [ key, value ] of Object.entries(this.inputSchema)) {
			if (recognisedKeys.includes(key)) continue;

			console.log(`Unrecognised field => "${key}": ${JSON.stringify(value)}`);
			unrecognisedFields[key] = value;
		}

		return stripObject(unrecognisedFields);
	}

}
