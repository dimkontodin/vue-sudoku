# Contributing

Thanks for your interest! This is a hobby project maintained in spare time, so please keep
the following in mind.

## Ground rules

- **Suggestions and bug reports** are welcome — open an issue.
- **Pull requests** are welcome too. Every PR into `main` needs the owner's approval, and the
  owner merges on their own schedule. There is no response-time guarantee; a quiet PR is not
  a rejected PR.
- For anything non-trivial, open an issue first so you don't spend time on something that
  won't fit the project.
- The app is, and will stay, **free and ad-free**. Changes that add ads, trackers, analytics
  or paywalls will not be accepted.

## Before you open a PR

```sh
pnpm nx run-many -t lint test
pnpm format
```

Keep the game rules in `libs/sudoku-core` (plain TypeScript, unit-tested) and keep Vue
components presentational — see the architecture section of the [README](README.md).

## License of contributions

By submitting a contribution you agree that it is licensed under the project's
[MIT License](LICENSE), and that you have the right to submit it.
