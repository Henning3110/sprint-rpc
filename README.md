#  SprintRPC

SprintRPC is a light-weight, simple, and premium gRPC desktop client built with **Electron**, **React**, and **TypeScript**, styled using a sleek and high-performance **Material UI** theme. Designed for fast developer feedback loops, it automates request construction using dynamic schema rendering.

More information can be found on the [website](sprintrpc.eu).

---

## Key Features

* **📦 Dynamic Form Builder**: Automatically parses `.proto` message definitions recursively and generates responsive input forms for all primitive types, repeated array lists, and nested submessages.
* **🌐 Zero-Config Server Reflection**: Instantly fetches packages, services, and methods from active gRPC servers without needing to manually import or compile proto files.
* **🧼 Clean Payload & Deep Pruning**: Avoids server validation errors. Cleared fields and empty submessages are recursively pruned and completely omitted from the raw JSON payload instead of pre-populating with empty strings or zeroes.
* **⏱️ Timezone-Aware Timestamps**: Full support for `google.protobuf.Timestamp` fields via timezone-aware datetime pickers that sync bidirectionally with `{ seconds, nanos }` JSON payloads.
* **📝 Monaco JSON Editor & Metadata**: A secondary raw JSON tab with syntax support, combined with a flexible metadata editor for request-level authentication or tracing headers.

---

## 🚀 Quick Start

### Prerequisites
* **Node.js**: Version 18 or higher.
* **npm**: Installed with Node.

### Run Locally

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Henning3110/sprint-rpc.git
   cd sprint-rpc
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

---

## 🧪 Testing & Validation

Maintain project quality with strict TypeScript compilation and unit tests:

* **Run Typecheck**:
  ```bash
  npm run typecheck
  ```
* **Run Vitest Suite**:
  ```bash
  npm run test
  ```

---

## 📦 Production Packaging

Compile and build native desktop installers for Windows, macOS, or Linux using **Electron Builder**:

* **macOS (.dmg)**:
  ```bash
  npm run build:mac
  ```
* **Windows (.exe)**:
  ```bash
  npm run build:win
  ```
* **Linux (.AppImage, .deb)**:
  ```bash
  npm run build:linux
  ```

Binaries will be outputted directly in the root `/dist` or `/out` folders.

---

## 📄 License

This project is licensed under the permissive **MIT License**. See the [LICENSE](LICENSE) file for details.
