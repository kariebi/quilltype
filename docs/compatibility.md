# Compatibility Notes

## OpenAPI 3.0 vs 3.1

Quill Type currently targets common OpenAPI 3.x document shapes and is most heavily exercised against OpenAPI 3.0-style schemas.

Practical guidance:

- OpenAPI 3.0.x should be the safest path today
- OpenAPI 3.1 documents that stay close to common schema patterns should work well
- very advanced JSON Schema 2020-12 features may need extra validation in your project before relying on generated runtime schemas

## Node Support

Quill Type requires Node `>=20`.

Recommended team policy:

- Node 20 or later for local development
- match CI and local Node versions
- keep package consumers on an actively supported Node release
