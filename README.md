# stoatbot.js

# Note: this package is currently in the early stages of development and testing

`stoatbot.js` is a Node.js library for building bots on the Revolt platform. It provides an easy-to-use interface for interacting with Revolt's API, managing events, and handling various bot functionalities. NOTE: node 21 is required to run this
[stoat server](https://stt.gg/cFSwBt4R) [docs](https://jade3375.github.io/stoatbot.js/)

## Installation

```bash
npm install stoatbot.js
```

or

```bash
yarn add stoatbot.js
```

## voice support

voice is supported via ffmpeg, please install before attempting any voice related features
addtional audio processing libaries will be looked into at a future date

## Basic Setup

Below is an example of how to set up a basic bot using `stoatbot.js`:

### Example Code

### typescript

```ts
import { client, MessageStruct } from "stoatbot.js";

const bot = new client({});

bot.on("ready", () => {
  console.log("Bot is ready!");
});

bot.on("message", (message: MessageStruct) => {
  if (message.content === "ping") {
    message.reply("pong");
  }
});

// Handle errors to prevent crashes
bot.on("error", (error) => {
  console.error("Bot error:", error);
});

bot.login("YOUR_BOT_TOKEN");
```

### javascript

```js
const { client } = require("stoatbot.js");

const bot = new client({});

bot.on("ready", () => {
  console.log("Bot is ready!");
});

bot.on("message", (message) => {
  if (message.content === "ping") {
    message.reply("pong");
  }
});

bot.login("YOUR_BOT_TOKEN");
```

## Features

- Event-based architecture for handling messages, server updates, and more.
- Easy-to-use managers for channels, servers, users, and roles.
- Experimental support for 3rd party instances using backend version 0.7 +

## Development

To contribute or modify the library:

1. Clone the repository:

   ```bash
   git clone https://github.com/Jade3375/stoatbot.js.git
   cd stoatbot.js
   ```

2. Install dependencies:

   ```bash
   yarn install
   ```

3. Build the project:

   ```bash
   yarn build
   ```

## Contribution

We welcome contributions to `stoatbot.js`! To contribute, follow these steps:

1. **Fork the Repository**  
   Go to the [repository](https://github.com/Jade3375/stoatbot.js) and click the "Fork" button to create your own copy.

2. **Clone Your Fork**  
   Clone your forked repository to your local machine:

   ```bash
   git clone https://github.com/your-username/stoatbot.js
   cd stoatbot.js
   ```

3. **Create a Branch**  
   Create a new branch for your feature or bug fix:

   ```bash
   git checkout -b feature-or-bugfix-name
   ```

4. **Make Changes**  
   Implement your changes or fixes in the codebase.

5. **Test Your Changes**  
   Ensure your changes work as expected by running the project and any relevant tests:

   ```bash
   yarn test
   ```

6. **Commit Your Changes**  
   Commit your changes with a descriptive message:

   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

7. **Push Your Branch**  
   Push your branch to your forked repository:

   ```bash
   git push origin feature-or-bugfix-name
   ```

8. **Open a Pull Request**  
   Go to the original repository and open a pull request from your branch. Provide a clear description of your changes and why they should be merged.

### Guidelines

- Follow the existing code style and structure.
- Write clear and concise commit messages.
- Add or update documentation if necessary.
- Ensure your changes do not break existing functionality.

Thank you for contributing to `stoatbot.js`!

## License

This project is licensed under the MIT License.
