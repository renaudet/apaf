# APAF for NPA

APAF stands for All Purpose Application Framework. This is a framework for creating 3-tiers applications an easy way using a built-in application builder "from inside the application itself"

As the project name implies, it is built on top of NPA, the [Node Plugin Architecture](https://github.com/renaudet/Node-Plugin-Architecture) project

## Dependencies

APAF is based on [Node-Plugin-Architecture](https://github.com/renaudet/Node-Plugin-Architecture) and the [npa-ui-tools](https://github.com/renaudet/npa-ui-tools) framework

Given that npa-ui-tools is installed by convention in <install-root>/tools and that a suitable instalation directory for APAF could be  <install-root>/apaf, we could have the appConfig.json file looking as:

```json
{ 
	"sites": [
		{
			"id": "default",
			"location": "./plugins"
		},
		{
			"id": "tools",
			"location": "./tools/plugins"
		},
		{
			"id": "apaf",
			"location": "./apaf/plugins"
		}
	]
}
```

