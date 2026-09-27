# Local screenshot reader (optional)

Lets you try "Use a screenshot instead" on your own computer. It reads a picture of a
class schedule with Claude and sends the classes back to Cadence for you to check.
Your Claude API key stays in `local-reader/.env`, which Git ignores. Never put it anywhere else.

1. Install and add your key (paste it after `ANTHROPIC_API_KEY=` and save):
   ```
   cd local-reader
   npm install
   cp .env.example .env
   ```
2. Tell the app where the reader is. In the project folder (not `local-reader`), create a
   file named `.env.development.local` containing this one line:
   ```
   VITE_AUTOMATION_API_URL=http://localhost:8787
   ```
3. Start the reader and leave it running: `cd local-reader && npm start`
4. In another terminal, (re)start the app: `npm run dev`

The screenshot button only appears when steps 2–4 are done. Without them, typing or
pasting class times works as always.
