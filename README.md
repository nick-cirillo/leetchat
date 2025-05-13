# LeetChat

No more copy-pasting from tab to tab! This Chrome extension is perfect for copiloting LeetCode with your favorite LLM. LeetChat instantly scrapes the problem description, process, user code, and solutions, and seamlessly generates a prompt to explain, debug, or work through the solution to your toughest LeetCode challenges.

## Installation

### Install From Release

There aren't any releases yet, so for now, follow "Install from Source" below. But just for the future:

- Download the latest release from the [Releases](https://github.com/jlumbroso/chrome-extension-text-collector/releases)
- Unzip the downloaded ZIP file
- Open Chrome and navigate to `chrome://extensions`
- Enable "Developer mode"
- Drag and drop the unzipped folder into the extensions page

### Install From Source

1. Clone the repository:

   ```bash
   git clone https://github.com/nick-cirillo/leetchat
   ```

2. Install dependencies:

   ```bash
   cd leetchat
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. Load the extension in Chrome:

   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory from the project

## Development

- Run the development server with hot reloading:

  ```bash
  npm run watch
  ```

- Load the unpacked extension in Chrome from the `dist` directory
- Make changes to the source code and the extension will automatically reload

## Team Contributions

- [Nick Cirillo](https://github.com/nick-cirillo/) - worked on the extension skeleton, UX/flow improvements, and merging/bug fixes/project management.
- [Hanxi (Esther) Guo](https://github.com/hanxi-guo) - worked on the LeetCode scraper, including tricky scraping of user code.
- [Mia Kim](https://github.com/miaqkim) - worked on the prompt box to allow the user to seamlessly copy to an LLM.
- [Amy Zheng](https://github.com/amytangzheng) - worked on the radio buttons and prompt engineering for different prompt types.

## Credits

The initial setup of the Chrome extension skeleton was based on the tutorial by [Harshita Joshi](https://github.com/Harshita-mindfire) on creating a Chrome extension with React and TypeScript. The corresponding Medium article can be found [here](https://medium.com/@tharshita13/creating-a-chrome-extension-with-react-a-step-by-step-guide-47fe9bab24a1). This was then adapted by Professor Jérémie Lumbroso at the University of Pennsylvania, and you can find that repository [here](https://github.com/jlumbroso). We then forked this repository for our project.
