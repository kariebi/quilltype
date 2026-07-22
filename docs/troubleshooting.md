# Troubleshooting

## `check` says generated output is stale

Run:

```bash
quilltype generate
```

Then commit the regenerated files if your workflow keeps them tracked.

## Remote schema watch keeps retrying

Check:

- the URL is reachable
- required headers are present
- `watch.pollIntervalMs` and `watch.retryDelayMs` are sensible for your environment

## Generated output imports a package you do not have

Some output modes assume app-level dependencies:

- `react-query` -> `@tanstack/react-query`
- `axios-client` -> `axios`
- `swr` -> `swr`
- `zod` -> `zod`

Install the dependency in the consuming project.

## Config validation fails

Run:

```bash
quilltype config validate
quilltype doctor
```

These usually reveal the exact field or source problem.

## Breaking-change report is too noisy

- keep `breaking.against` pointed at the right baseline
- set `breaking.includeWarnings` to `false` if you only want hard failures
- write JSON or Markdown reports when you want post-processing instead of terminal-only output
