from flask import Flask, render_template, request, jsonify
import os
import sys
import json
import logging
import requests
import random
# Fixed import for python-dotenv
try:
    from dotenv import load_dotenv
except ImportError:
    import subprocess
    import sys
    print("Installing python-dotenv package...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-dotenv"])
    from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging for the web application
logging.basicConfig(level=logging.INFO)

# Add the parent directory to path to import revwhoix
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

app = Flask(__name__, static_folder='static', template_folder='templates')

def get_api_key():
    """Get API key from .env file"""
    try:
        api_key = os.getenv('WHOISXML_API_KEY')
        
        if not api_key or len(api_key) < 2:
            logging.error("❌ API key not found in .env file or is invalid")
            return None
        return api_key
    except Exception as e:
        logging.error(f"❌ Error occurred while reading API key: {str(e)}")
        return None

def preview_domains(keyword, api_key):
    """Check if domains exist without exiting the app on error"""
    url = "https://reverse-whois.whoisxmlapi.com/api/v2"
    
    # Use a modern user agent
    user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    headers = {'User-Agent': user_agent}
    
    preview_mode = {
        "apiKey": api_key,
        "searchType": "current",
        "mode": "preview",
        "punycode": True,
        "basicSearchTerms": {
            "include": [keyword]
        }
    }
    
    try:
        logging.info("🔍 Checking if domains exist")
        r = requests.post(url, json=preview_mode, headers=headers)
        
        # Check if the request was successful
        if r.status_code != 200:
            logging.error(f"❌ API returned status code {r.status_code}")
            return False, f"API returned status code {r.status_code}: {r.text}"
        
        # Parse the JSON response
        response_data = r.json()
        
        if response_data.get('domainsCount', 0) != 0:
            logging.info("✅ Domains exist")
            logging.info("⛏️ Fetching domains\n")
            return True, None
        else:
            logging.info("❌ No domains found")
            return False, "No domains found for this keyword"
            
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ Request error: {str(e)}")
        return False, f"Request error: {str(e)}"
    except json.JSONDecodeError as e:
        logging.error(f"❌ Invalid JSON response: {str(e)}")
        return False, f"Invalid JSON response: {str(e)}"
    except Exception as e:
        logging.error(f"❌ Error occurred while fetching domains: {str(e)}")
        return False, f"Error occurred while fetching domains: {str(e)}"

def fetch_domains(keyword, api_key):
    """Fetch domains without exiting the app on error"""
    url = "https://reverse-whois.whoisxmlapi.com/api/v2"
    
    # Use a modern user agent
    user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    headers = {'User-Agent': user_agent}
    
    query_data = {
        "apiKey": api_key,
        "searchType": "current",
        "mode": "purchase",
        "punycode": True,
        "basicSearchTerms": {
            "include": [keyword]
        }
    }
    
    try:
        r = requests.post(url, json=query_data, headers=headers)
        
        # Check if the request was successful
        if r.status_code != 200:
            logging.error(f"❌ API returned status code {r.status_code}")
            return False, f"API returned status code {r.status_code}: {r.text}", None, 0
        
        # Parse the JSON response
        response_data = r.json()
        domains = response_data.get('domainsList', [])
        count = response_data.get('domainsCount', 0)
        
        return True, None, domains, count
            
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ Request error: {str(e)}")
        return False, f"Request error: {str(e)}", None, 0
    except json.JSONDecodeError as e:
        logging.error(f"❌ Invalid JSON response: {str(e)}")
        return False, f"Invalid JSON response: {str(e)}", None, 0
    except Exception as e:
        logging.error(f"❌ Error occurred while fetching domains: {str(e)}")
        return False, f"Error occurred while fetching domains: {str(e)}", None, 0

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search', methods=['POST'])
def search():
    try:
        data = request.get_json() or {}  # Handle None case by providing empty dict
        keyword = data.get('keyword', '')
        
        if not keyword:
            return jsonify({'status': 'error', 'message': 'Keyword is required'}), 400
        
        # Get API key
        api_key = get_api_key()
        if not api_key:
            return jsonify({
                'status': 'error',
                'message': 'API Key not found or invalid. Make sure it exists at ~/.config/whoisxml.conf'
            }), 400
        
        # Check if domains exist
        exists, error_message = preview_domains(keyword, api_key)
        if not exists:
            return jsonify({
                'status': 'error',
                'message': error_message or 'No domains found for this keyword'
            }), 400
        
        # Fetch domains
        success, error, domains, count = fetch_domains(keyword, api_key)
        if not success:
            return jsonify({
                'status': 'error',
                'message': error or 'An error occurred while fetching domains'
            }), 400
        
        return jsonify({
            'status': 'success',
            'domains': domains,
            'count': count,
            'keyword': keyword
        })
        
    except Exception as e:
        logging.exception("Unexpected error in search endpoint")
        return jsonify({
            'status': 'error',
            'message': f'An unexpected error occurred: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
