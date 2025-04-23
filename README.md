# RevWhoix Web Interface

A beautiful, premium web interface for the RevWhoix tool, allowing you to perform reverse WHOIS lookups using WhoisXML API.

![RevWhoix Web Interface](https://i.imgur.com/6FZF0Ka.png)

## Features

- Clean, modern UI with smooth animations and 3D interactions
- Responsive design that works on all devices
- Real-time domain filtering and search
- Copy domains to clipboard individually or in bulk
- Export domains as CSV
- Pagination for large result sets
- Beautiful visualization of search results

## Installation

1. Make sure you have Python installed (3.6+)
2. Clone this repository:

```bash
git clone https://github.com/yourusername/revwhoix-web.git
cd revwhoix-web
```

3. Install the required dependencies:

```bash
pip install -r requirements.txt
```

4. Set up your WhoisXML API key:
   - Get an API key from [WhoisXML API](https://www.whoisxmlapi.com/)
   - Create or edit the `.env` file in the root directory:
   ```
   WHOISXML_API_KEY=your_api_key_here
   ```

## Local Development

1. Start the web server:

```bash
python app.py
```

2. Open your browser and navigate to `http://127.0.0.1:5000/`
3. Enter a keyword (organization name, email address, etc.) and click Search
4. View and interact with the domain results

## Deployment to Vercel

This project is configured for easy deployment on Vercel:

1. Fork or clone this repository
2. Create a Vercel account if you don't have one
3. Install the Vercel CLI: `npm install -g vercel`
4. Run `vercel login` and follow the prompts
5. From the project directory, run `vercel`
6. Add your WhoisXML API key as an environment variable named `WHOISXML_API_KEY` in the Vercel dashboard
7. Deploy the project with `vercel --prod`

## How It Works

1. Enter a search term related to an organization or person
2. The app queries the WhoisXML API to find domains registered with that information
3. Results are displayed in a clean, filterable grid
4. You can copy domains, visit them, or export the entire list

## Security Note

This application requires your WhoisXML API key. Always keep your API key secure and never commit it directly to public repositories.

## Credits

Built on top of the [RevWhoix CLI tool](https://github.com/devanshbatham/revwhoix) by Devansh Batham.

## License

MIT License
