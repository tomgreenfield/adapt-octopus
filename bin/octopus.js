#!/usr/bin/env node

const Octopus = require("../index.js");

const octopus = new Octopus(process.argv[2], process.argv[3]);

(async function() {
	try {
		await octopus.start();
	} catch (err) {
		console.error(err);
	}
})();
