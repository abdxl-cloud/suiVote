# Contributing to SuiVote

Thank you for considering contributing to SuiVote! We welcome contributions from the community to help make this project better.

## How to Contribute

There are many ways to contribute, including:

*   **Reporting Bugs:** If you find a bug, please open an issue on our GitHub repository. Provide as much detail as possible, including steps to reproduce the bug.
*   **Suggesting Enhancements:** If you have ideas for new features or improvements, feel free to open an issue to discuss them.
*   **Writing Code:** If you'd like to contribute code, please follow the development process outlined below.
*   **Improving Documentation:** Clear and comprehensive documentation is vital. If you see areas for improvement or new sections that could be added, please let us know or submit a pull request.
*   **Community Support:** Helping answer questions from other users in our community channels.

## Development Process

1.  **Fork the Repository:** Start by forking the main SuiVote repository to your own GitHub account.
2.  **Clone Your Fork:** Clone your forked repository to your local machine.
    ```bash
    git clone https://github.com/YOUR_USERNAME/suivote.git
    cd suivote
    ```
3.  **Create a Branch:** Create a new branch for your feature or bug fix.
    ```bash
    git checkout -b my-feature-branch
    ```
4.  **Make Changes:** Implement your changes, ensuring you follow the project's coding style and conventions.
    *   For frontend changes, navigate to the `frontend/` directory.
    *   For contract changes, navigate to the `contracts/` directory.
5.  **Test Your Changes:**
    *   **Frontend:** Run linters and any available tests (`pnpm run lint`, `pnpm run test` if configured).
    *   **Contracts:** Build and test the contracts (`sui move build`, `sui move test` in the `contracts/` directory).
6.  **Commit Your Changes:** Commit your changes with a clear and descriptive commit message.
    ```bash
    git add .
    git commit -m "feat: Add new feature X" 
    # Or "fix: Resolve bug Y"
    ```
7.  **Push to Your Fork:** Push your changes to your forked repository.
    ```bash
    git push origin my-feature-branch
    ```
8.  **Submit a Pull Request (PR):** Open a pull request from your feature branch to the `main` (or `develop`) branch of the original SuiVote repository.
    *   Provide a clear title and description for your PR, explaining the changes and why they are being made.
    *   Link to any relevant issues.

## Coding Conventions

*   **Frontend (TypeScript/Next.js):**
    *   Follow existing code style and patterns.
    *   Use Prettier and ESLint (if configured) for code formatting and linting.
    *   Write clear and concise component names and props.
*   **Contracts (Move):**
    *   Follow standard Move language conventions.
    *   Write clear comments explaining complex logic.

## Issue Tracker

We use GitHub Issues to track bugs and feature requests. Before opening a new issue, please check if a similar one already exists.

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms. (If you have a CODE_OF_CONDUCT.md, link it here).

Thank you for your contributions!