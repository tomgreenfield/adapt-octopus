# adapt-octopus

Command line helper for converting old Adapt schema into conformant JSON schema.

## Installation

Note: requires [Node.js](http://nodejs.org) to be installed.

From the command line, run:

```console
npm install -g github:tomgreenfield/adapt-octopus
```

## Usage

```console
adapt-octopus <inputPath> <id>
```

* ID should match the value of the _component/extension/menu/theme_ attribute in a plugin’s bower.json.
