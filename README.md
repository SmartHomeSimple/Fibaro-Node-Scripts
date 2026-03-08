# Fibaro Scripts

This repository contains a set of Node.js scripts to help with Fibaro Quick App development.

## Features

- **unpack**: Unpacks a `.fqa` (Fibaro Quick App) file into a directory structure for easier editing.
- **pack**: Packs a directory structure back into a `.fqa` file.
- **upload**: Uploads a Quick App to your Fibaro Home Center.
- **download**: Downloads and unpacks a Quick App from your Fibaro Home Center.
- **watch**: Watches for file changes in an unpacked Quick App directory and automatically uploads them.

## Requirements

- Node.js v22 or later.

## Installation

### As a global CLI tool

```bash
npm install -g fibaro-node-scripts
```

After global installation, you can use the commands directly:

```bash
fibaro-pack
fibaro-unpack
fibaro-upload
fibaro-download
fibaro-watch
fibaro-config
```

### As a project dependency

```bash
npm install --save-dev fibaro-node-scripts
```

Then use the scripts via npm:

```bash
npm run pack
npm run unpack
npm run upload
npm run download
npm run watch
npm run config
```

## Project Structure

After unpacking a `.fqa` file, your project directory should look something like this. This is the structure the `pack` script expects.

```
my-quick-app/
├── main.lua
├── device.json
└── images/
    ├── icon_1.png
    ├── icon_2.svg
    └── ...
```

- `main.lua`: The main Lua code for your QuickApp.
- `quick-app.json`: Contains metadata about the QuickApp (formerly `device.json`).
- `images/`: A directory containing all the icons for your QuickApp.

## Configuration

To use any script that interacts with the HC3, you need to create a `fibaro.config.json` file in the root of the project. This file should contain the connection details for your Fibaro Home Center.

**Example `fibaro.config.json`:**

```json
{
  "host": "YOUR_FIBARO_IP_ADDRESS",
  "username": "YOUR_FIBARO_USERNAME",
  "password": "YOUR_FIBARO_PASSWORD",
  "protocol": "http"
}
```

- `protocol` is optional and defaults to `http`. Use `https` if your Home Center is configured for it.

## Usage

All scripts are run via npm. Below are examples for each command.

### `npm run unpack`

To unpack an existing `.fqa` file into a directory:

```bash
npm run unpack
```

### Pack a Quick App

To pack a source directory into a `.fqa` file:

```bash
npm run pack
```

### Download sources from HC3

To download and unpack a Quick App from your Home Center:

```bash
npm run download
```

The script will prompt you to select one of your existing Quick Apps to download.

### Upload source files to HC3

To upload your Quick App source files to your Home Center:

```bash
npm run upload
```

The script will prompt you to select which Quick App you want to update. This will overwrite the existing Quick App on your Home Center with your local changes.

### Watch for changes

To automatically upload your Quick App whenever you save a file:

```bash
npm run watch
```

The script will ask which Quick App to watch. After the initial upload, it will monitor your project files for changes and upload them automatically.

## Using shared files

To use shared files across multiple unpacked QuickApp projects follow these steps:

1. Add the files path to `.gitignore` (so the generated links are not committed).
2. Add the shared file to `_shared` (for example: `_shared/QuickAppChildLibrary.lua`).
3. Add the project folder where the shared file is used to the `projects` array in `setup-links.sh`.
4. Add file exclusions to your workspace VS Code settings (see `.vscode/settings.json`).
5. Run `setup-links.sh` to create hard links in each project folder.

Example `.gitignore` entry:

```gitignore
# ignore generated hard links in unpacked projects
**/_unpacked/**/QuickAppChildLibrary.lua
```

Example `setup-links.sh` projects snippet (add your project names):

```bash
projects=(
  "Ups_Manager"
  "Promill furnice"
  "Mitsubishi Ecodan"
  "Midea Aircon Polling Version"
)
```

Example `.vscode/settings.json` to hide the files in Explorer and search:

```json
{
  "files.exclude": {
    "**/_unpacked/**/QuickAppChildLibrary.lua": true
  },
  "search.exclude": {
    "**/_unpacked/**/QuickAppChildLibrary.lua": true
  }
}
```

Run the link-creation script from the repo root:

```bash
bash setup-links.sh
```

QuickAppChildLibrary example

- Put the shared library at: `_shared/QuickAppChildLibrary.lua`.
- After running `setup-links.sh`, each target project will contain a `QuickAppChildLibrary.lua` file next to its `main.lua`.
- The Quick App runtime loads files from the project root, so the library will be available to the app just like any other source file.

Sample: assume `_unpacked/Ups_Manager/main.lua` expects helper functions from `QuickAppChildLibrary.lua`. With the hard link in place the runtime sees the library file next to `main.lua` and the app can call those functions directly.

Notes

- The script creates hard links on Windows; these appear as regular files in Explorer (not flagged as symlinks). Use the glob patterns above to hide them in VS Code.
- If you prefer symbolic links, adjust `setup-links.sh` accordingly, but Windows requires elevated permissions or Developer Mode for symlinks.

## Development and Publishing

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Make your changes
4. Test the scripts locally

### Publishing to npm

#### Option 1: Manual publish (for maintainers)

On Linux/Mac:

```bash
chmod +x scripts/publish.sh
./scripts/publish.sh [patch|minor|major]
```

On Windows:

```powershell
.\scripts\publish.ps1 [patch|minor|major]
```

This script will:

- Check if you're logged into npm
- Run tests
- Bump the version (patch/minor/major)
- Publish to npm
- Push git changes and tags

#### Option 2: Using GitHub Actions

1. Add your `NPM_TOKEN` as a secret in your GitHub repository:
   - Go to Settings → Secrets and variables → Actions
   - Add a new secret named `NPM_TOKEN` with your npm access token

2. Create a new release on GitHub or manually trigger the publish workflow

3. The GitHub Actions workflow will automatically:
   - Run tests
   - Publish to npm with provenance
   - Make the package publicly available

### Before Publishing

Make sure:

- All tests pass (`npm test`)
- Package.json has correct repository URL
- You're logged into npm (`npm login`)
- Version number is updated appropriately

## License

MIT
