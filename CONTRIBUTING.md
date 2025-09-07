# Contributing to OpenRouter Free Models Monitor

We love your input! We want to make contributing to this project as easy and transparent as possible.

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issue tracker](https://github.com/yourusername/openrouter-monitor/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/yourusername/openrouter-monitor/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Development Setup

### Prerequisites

- Node.js 16+
- Cloudflare account with Workers and KV access
- wrangler CLI installed (`npm install -g wrangler`)

### Local Development

1. Clone your fork:
```bash
git clone https://github.com/yourusername/openrouter-monitor.git
cd openrouter-monitor
```

2. Install dependencies:
```bash
npm install
```

3. Set up local environment:
```bash
# Create .dev.vars file for local development
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your test values
```

4. Start development server:
```bash
npm run dev
```

5. Access the local server at `http://localhost:8787`

### Testing

- Test the API endpoints manually using curl or Postman
- Test the web interface in different browsers and screen sizes
- Test push notifications with a real Bark setup
- Verify monitoring functionality with `/api/monitor/run`

### Code Style

- Use modern JavaScript (ES2020+)
- Follow existing code formatting
- Add comments for complex logic
- Keep functions small and focused
- Use descriptive variable names

### Project Structure

```
src/
├── worker/
│   ├── index.js      # Main entry point and routing
│   ├── monitor.js    # Monitoring logic and API calls
│   └── web.js        # Web interface and frontend code
```

## Feature Requests

We welcome feature requests! Please:

1. Check if the feature already exists or is in development
2. Open an issue with the `enhancement` label
3. Describe the feature and its use case
4. Be prepared to help implement it

## Code of Conduct

### Our Pledge

In the interest of fostering an open and welcoming environment, we as contributors and maintainers pledge to making participation in our project and our community a harassment-free experience for everyone.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

### Our Responsibilities

Project maintainers are responsible for clarifying the standards of acceptable behavior and are expected to take appropriate and fair corrective action in response to any instances of unacceptable behavior.

## License

By contributing, you agree that your contributions will be licensed under its MIT License.

## References

This document was adapted from the open-source contribution guidelines for [Facebook's Draft](https://github.com/facebook/draft-js/blob/main/CONTRIBUTING.md)
