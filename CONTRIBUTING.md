# Contributing to LeaseLens

Thank you for your interest in contributing to LeaseLens. This guide covers the workflow and conventions used in this project.

## Getting Started

1. Fork the repository and clone your fork locally.
2. Follow the [Development Guide](README.md#development-guide) in the README to set up your environment, install dependencies, and initialize the database.
3. Create a new branch from `main` for your work:
   ```bash
   git checkout -b your-name/short-description
   ```

## Development Workflow

1. Make your changes on your feature branch.
2. Run linting and tests before committing:
   ```bash
   npm run lint
   npm test
   ```
3. Write clear, concise commit messages that describe the intent of the change (e.g., `fix: resolve upload race condition on slow connections`).
4. Push your branch and open a pull request against `main`.
5. Describe what your PR does and how to verify it in the PR description.

## Code Style

- **Language:** TypeScript throughout (frontend and backend).
- **Linting:** ESLint with the project configuration. Run `npm run lint` to check.
- **Styling:** Tailwind CSS v4 with shadcn/ui components. Avoid inline style objects.
- **Validation:** Use Zod schemas for request and response validation at API boundaries.
- **Database:** Use Prisma ORM for all database access. Run `npx prisma generate` after schema changes and create migrations with `npx prisma migrate dev`.

## Pull Request Guidelines

- Keep PRs focused on a single concern. Separate unrelated changes into different PRs.
- Include steps to manually verify the change when applicable.
- Ensure all existing tests pass and add new tests for nontrivial logic.
- PRs require at least one approving review before merging.

## Reporting Issues

Open an issue on GitHub with a clear title and description. Include steps to reproduce the problem, expected behavior, and actual behavior. Screenshots or logs are helpful when relevant.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
