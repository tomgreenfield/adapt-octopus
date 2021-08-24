export default function stripObject(object) {
	Object.keys(object).forEach(i => object[i] === undefined && delete object[i]);

	if (Object.keys(object).length) return object;
};
