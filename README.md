# RevWhoix Web Interface

A beautiful, premium web interface for the RevWhoix tool, allowing you to perform reverse WHOIS lookups using WhoisXML API.

## Features

- Clean, modern UI with smooth animations
- Responsive design that works on all devices
- Real-time domain filtering
- Copy domains to clipboard
- Export domains as CSV
- Pagination for large result sets

## Installation

1. Make sure you have Python installed (3.6+)
2. Install the required dependencies:

```bash
cd api
pip install -r requirements.txt
```

3. Set up your WhoisXML API key in the `.env` file in the api directory

## Local Development

1. Start the web server:

```bash
cd api
python index.py
```

2. Open your browser and navigate to `http://127.0.0.1:5000/`
3. Enter a keyword (organization name, email address, etc.) and click Search
4. View and interact with the domain results

## Deployment to Vercel

This project is configured for easy deployment on Vercel:

1. Fork or clone this repository
2. Create a Vercel account if you don't have one
3. Create a new project in Vercel and link it to your repository
4. Add your WhoisXML API key as an environment variable named `WHOISXML_API_KEY`
5. Deploy the project

## Screenshots

![RevWhoix Web Interface](https://i.imgur.com/placeholder.png)

## Credits

Built on top of the [RevWhoix CLI tool](https://github.com/devanshbatham/revwhoix) by Devansh Batham.
