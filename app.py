from flask import Flask, render_template, request, jsonify
import os
import sys
import json
import logging
import requests
import random
import socket
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
    
    # Use advanced search terms to increase matching chances
    # Check if keyword might be an email
    if '@' in keyword:
        search_terms = {
            "include": [keyword]
        }
    else:
        # For organizations and other keywords, make the search more flexible
        # Split keyword into words to increase match possibilities
        words = keyword.split()
        if len(words) > 1:
            # For multi-word terms, try both exact match and individual words
            filtered_words = [word for word in words if len(word) > 2]
            search_terms = {
                "include": [keyword] + filtered_words
            }
        else:
            search_terms = {
                "include": [keyword]
            }
    
    preview_mode = {
        "apiKey": api_key,
        "searchType": "current",
        "mode": "preview",
        "punycode": True,
        "basicSearchTerms": search_terms
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

def validate_and_filter_domains(domains, keyword):
    """
    Validate and filter domains for relevance and active status.
    """
    if not domains:
        return []
    
    filtered_domains = []
    keyword_parts = keyword.lower().split()
    
    for domain in domains:
        # Skip empty domains
        if not domain:
            continue
            
        domain_lower = domain.lower()
        
        # Check relevance - domain should contain the keyword or parts of it
        is_relevant = False
        
        # Check if the full keyword is in the domain
        if keyword.lower() in domain_lower:
            is_relevant = True
        else:
            # Check if parts of multi-word keywords are in the domain
            if len(keyword_parts) > 1:
                # Consider domain relevant if it contains at least one part of the keyword
                matches = sum(1 for part in keyword_parts if len(part) > 2 and part in domain_lower)
                is_relevant = matches > 0
        
        if is_relevant:
            filtered_domains.append(domain)
    
    return filtered_domains

def fetch_domains(keyword, api_key):
    """Fetch domains without exiting the app on error"""
    url = "https://reverse-whois.whoisxmlapi.com/api/v2"
    
    # Use a modern user agent
    user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    headers = {'User-Agent': user_agent}
    
    # Use advanced search terms to increase matching chances
    # Check if keyword might be an email
    if '@' in keyword:
        search_terms = {
            "include": [keyword]
        }
    else:
        # For organizations and other keywords, make the search more flexible
        # Split keyword into words to increase match possibilities
        words = keyword.split()
        if len(words) > 1:
            # For multi-word terms, try both exact match and individual words
            filtered_words = [word for word in words if len(word) > 2]
            search_terms = {
                "include": [keyword] + filtered_words
            }
        else:
            search_terms = {
                "include": [keyword]
            }
    
    query_data = {
        "apiKey": api_key,
        "searchType": "current",
        "mode": "purchase",
        "punycode": True,
        "basicSearchTerms": search_terms
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

def get_domain_details(domain, api_key):
    """Fetch WHOIS details for a domain"""
    url = f"https://www.whoisxmlapi.com/whoisserver/WhoisService"
    
    params = {
        "apiKey": api_key,
        "domainName": domain,
        "outputFormat": "JSON"
    }
    
    try:
        r = requests.get(url, params=params)
        
        if r.status_code != 200:
            logging.error(f"❌ WHOIS API returned status code {r.status_code}")
            return False, f"API returned status code {r.status_code}: {r.text}", None
        
        response_data = r.json()
        whois_record = response_data.get('WhoisRecord', {})
        
        # Extract relevant information
        created_date = None
        expires_date = None
        registrar_name = None
        nameservers = []
        
        # Try to get dates
        try:
            created_date = whois_record.get('createdDate')
            expires_date = whois_record.get('expiresDate')
            
            # If not found at top level, look in registryData
            if not created_date and 'registryData' in whois_record:
                created_date = whois_record['registryData'].get('createdDate')
                expires_date = whois_record['registryData'].get('expiresDate')
        except Exception:
            pass
        
        # Try to get registrar
        try:
            registrar_name = whois_record.get('registrarName')
            
            # If not found, check other locations
            if not registrar_name and 'registryData' in whois_record:
                registrar_name = whois_record['registryData'].get('registrarName')
        except Exception:
            pass
        
        # Try to get nameservers
        try:
            if 'nameServers' in whois_record:
                ns_data = whois_record['nameServers']
                if 'hostNames' in ns_data:
                    nameservers = ns_data['hostNames']
                
            # If not found, check registryData
            if not nameservers and 'registryData' in whois_record and 'nameServers' in whois_record['registryData']:
                ns_data = whois_record['registryData']['nameServers']
                if 'hostNames' in ns_data:
                    nameservers = ns_data['hostNames']
        except Exception:
            pass
        
        domain_info = {
            'created': created_date,
            'expires': expires_date,
            'registrar': registrar_name,
            'nameservers': nameservers
        }
        
        return True, None, domain_info
    
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ WHOIS Request error: {str(e)}")
        return False, f"Request error: {str(e)}", None
    except json.JSONDecodeError as e:
        logging.error(f"❌ Invalid JSON response from WHOIS API: {str(e)}")
        return False, f"Invalid JSON response: {str(e)}", None
    except Exception as e:
        logging.error(f"❌ Error occurred while fetching WHOIS data: {str(e)}")
        return False, f"Error occurred while fetching domain details: {str(e)}", None

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
        
        # Try alternative search approaches if direct search fails
        try_alternative = data.get('try_alternative', False)
        
        # Check if domains exist
        exists, error_message = preview_domains(keyword, api_key)
        
        if not exists:
            # If this is already an alternative search and it failed, try one more approach
            if try_alternative:
                # Try removing common TLDs that might be part of the keyword
                common_tlds = ['.com', '.org', '.net', '.io', '.co']
                for tld in common_tlds:
                    if keyword.lower().endswith(tld):
                        alt_keyword = keyword[:-len(tld)]
                        alt_exists, alt_error = preview_domains(alt_keyword, api_key)
                        
                        if alt_exists:
                            # Found domains, proceed with fetching
                            success, error, domains, count = fetch_domains(alt_keyword, api_key)
                            if success:
                                return jsonify({
                                    'status': 'success',
                                    'domains': domains,
                                    'count': count,
                                    'keyword': keyword,
                                    'note': f"Results shown are for '{alt_keyword}'"
                                })
                
                # If all alternatives fail
                return jsonify({
                    'status': 'error',
                    'message': 'No domains found even with alternative search methods. Please try a different keyword.'
                }), 404
            
            # Try alternative search approach - if keyword has spaces, remove them
            alternative_keyword = keyword.replace(" ", "")
            if alternative_keyword != keyword:
                logging.info(f"🔄 Trying alternative search with '{alternative_keyword}'")
                alt_exists, alt_error = preview_domains(alternative_keyword, api_key)
                
                if alt_exists:
                    # Found domains with alternative search, proceed with fetching
                    success, error, domains, count = fetch_domains(alternative_keyword, api_key)
                    if success:
                        return jsonify({
                            'status': 'success',
                            'domains': domains,
                            'count': count,
                            'keyword': keyword,
                            'note': f"Results shown are for '{alternative_keyword}'"
                        })
            
            # If no alternative worked, try prefix/suffix modifications
            modifications = [
                f"{keyword}s",  # Try plural
                f"{keyword}app",
                f"{keyword}inc",
                f"my{keyword}",
                f"get{keyword}"
            ]
            
            for mod_keyword in modifications:
                mod_exists, mod_error = preview_domains(mod_keyword, api_key)
                
                if mod_exists:
                    # Found domains with modified keyword, proceed with fetching
                    success, error, domains, count = fetch_domains(mod_keyword, api_key)
                    if success:
                        return jsonify({
                            'status': 'success',
                            'domains': domains,
                            'count': count,
                            'keyword': keyword,
                            'note': f"Results shown are for '{mod_keyword}'"
                        })
            
            # If no alternative worked or no alternatives to try
            return jsonify({
                'status': 'error',
                'message': error_message or 'No domains found for this keyword'
            }), 404
        
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

@app.route('/api/domain-info', methods=['GET'])
def domain_info():
    try:
        domain = request.args.get('domain', '')
        
        if not domain:
            return jsonify({'status': 'error', 'message': 'Domain parameter is required'}), 400
        
        # Get API key
        api_key = get_api_key()
        if not api_key:
            return jsonify({
                'status': 'error',
                'message': 'API Key not found or invalid. Make sure it exists in your .env file'
            }), 400
        
        # Fetch domain info
        success, error, info = get_domain_details(domain, api_key)
        
        if not success:
            return jsonify({
                'status': 'error',
                'message': error or 'Failed to fetch domain information'
            }), 400
        
        return jsonify({
            'status': 'success',
            'info': info,
            'domain': domain
        })
        
    except Exception as e:
        logging.exception("Unexpected error in domain info endpoint")
        return jsonify({
            'status': 'error',
            'message': f'An unexpected error occurred: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
