# CDK Zod Agent

This project is a TypeScript AWS CDK application that provisions an internal, IAM-authorized API and generates a Zod schema-based API client. The API client is designed for seamless integration with LangChain and LangGraph ReAct agents, enabling secure, schema-validated interactions in LLM-powered workflows.

## Features

- **AWS CDK Infrastructure**: Deploys an internal API with IAM authorization.
- **Zod Schema API Client**: Auto-generates a TypeScript client for type-safe, schema-validated API calls.
- **LangChain/LangGraph Integration**: The API client is ready to use in LangChain and LangGraph ReAct agents.
- **Developer Experience**: TypeScript-first, with clear interfaces and helpers for rapid prototyping.

## Getting Started

### Prerequisites
- Node.js (>= 18)
- AWS CLI configured
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html) installed globally

### Install Dependencies

```bash
npm install
```

### Build the Project

```bash
npm run build
```

### Deploy the Stack

```bash
npx cdk deploy
```

### Run Tests

```bash
npm run test
```

## LangGraph WebUI

You can start the LangGraph WebUI for local development and testing with:

```bash
npx @langchain/langgraph-cli@latest dev
```

> **Note:** The LangGraph WebUI does **not** work in Safari or Brave. Please use Chrome, Firefox, or Edge for the best experience.

## Project Structure

- `lib/` — CDK stack, constructs, and Lambda definitions
- `lambda/` — Lambda route handlers
- `package/` — Generated Zod schema API client and helpers
- `test/` — Jest unit tests

## Example Usage

The generated API client can be imported and used in your LangChain or LangGraph ReAct agent to make secure, schema-validated calls to your internal API.

## About

This project is featured in a blog post on [martzmakes.com](https://martzmakes.com/).
