# `@mischnic/parcel-resolver-root`

Change what `/` and `~` resolve to.

**Requires parcel@2.0.0-nightly.585 or newer**

## Usage:

Add a `.parcelrc` into your root directory (next to `package.json`):

```json
{
	"extends": "@parcel/config-default",
	"resolvers": ["@mischnic/parcel-resolver-root", "..."]
}
```

You can set what `~` and `/` resolve to like this:

```json
{
	"private": true,
	"name": "example",
	"version": "0.0.0",
	"scripts": {
		"build": "parcel build src/index.js"
	},
	"devDependencies": {
		"@mischnic/parcel-resolver-root": "0.1.0",
		"parcel": "2.0.0-nightly.574"
	},
	"@mischnic/parcel-resolver-root": {
		"/": "./src/a",
		"~": "./src/b"
	}
}
```

`./src/a` is relative to package.json.
