#!/usr/bin/env node
import Octopus from "../lib/Octopus.js";

const octopus = new Octopus({ inputPath: process.argv[2], inputId: process.argv[3] });

octopus.start().catch(error => console.error(error));
