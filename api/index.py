from flask import Flask, render_template, request, jsonify
import os
import sys
import json
import logging
import requests
import random
import socket  # For domain validation and IP lookup
import time
import hashlib
from functools import lru_cache
from collections import defaultdict
import threading

# For DNS record lookups - using a different approach that doesn't require dnspython
# Instead of relying on dnspython which seems problematic, we'll use socket for basic DNS lookups
# and implement a simpler DNS query mechanism

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

# Initialize Flask app with correct path to templates and static folders
app = Flask(__name__, 
            template_folder="../templates", 
            static_folder="../static")

def get_api_key():
    """Get API key from environment variable"""
    try:
        api_key = os.environ.get('WHOISXML_API_KEY')
        
        if not api_key or len(api_key) < 2:
            logging.error("❌ API key not found in environment variables or is invalid")
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
            search_terms = {
                "include": [keyword] + words
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
        logging.info(f"🔍 Checking if domains exist for '{keyword}'")
        r = requests.post(url, json=preview_mode, headers=headers)
        
        # Check if the request was successful
        if r.status_code != 200:
            logging.error(f"❌ API returned status code {r.status_code}")
            return False, f"API returned status code {r.status_code}: {r.text}"
        
        # Parse the JSON response
        response_data = r.json()
        domain_count = response_data.get('domainsCount', 0)
        
        logging.info(f"🔢 Preview found {domain_count} domains")
        
        if domain_count > 0:
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
    
    Args:
        domains (list): List of domain names to validate and filter
        keyword (str): Keyword to check relevance against
        
    Returns:
        list: Filtered list of domain names
    """
    if not domains:
        return []
    
    filtered_domains = []
    keyword_parts = keyword.lower().split()
    
    logging.info(f"🔍 Validating {len(domains)} domains for relevance...")
    
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
                # for better recall when searching for organizations
                matches = sum(1 for part in keyword_parts if len(part) > 2 and part in domain_lower)
                is_relevant = matches > 0
        
        if is_relevant:
            # Add domain to filtered results (no need for DNS resolution which might cause timeouts)
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
            # Only include words with length > 2 to avoid noise from short words
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
        logging.info(f"🔍 Searching for domains related to '{keyword}'")
        r = requests.post(url, json=query_data, headers=headers)
        
        # Check if the request was successful
        if r.status_code != 200:
            logging.error(f"❌ API returned status code {r.status_code}")
            return False, f"API returned status code {r.status_code}: {r.text}", None, 0
        
        # Parse the JSON response
        response_data = r.json()
        domains = response_data.get('domainsList', [])
        count = response_data.get('domainsCount', 0)
        
        logging.info(f"📋 Found {count} domains from API")
        
        if not domains or len(domains) == 0:
            return False, "No domains found for this keyword", None, 0
        
        # Validate and filter domains for relevance
        filtered_domains = validate_and_filter_domains(domains, keyword)
        filtered_count = len(filtered_domains)
        
        if filtered_count == 0:
            return False, f"No domains matching '{keyword}' were found", None, 0
            
        logging.info(f"✅ After validation: {filtered_count} relevant domains")
        
        return True, None, filtered_domains, filtered_count
        
    except requests.exceptions.RequestException as e:
        logging.error(f"❌ Request error: {str(e)}")
        return False, f"Request error: {str(e)}", None, 0
    except json.JSONDecodeError as e:
        logging.error(f"❌ Invalid JSON response: {str(e)}")
        return False, f"Invalid JSON response: {str(e)}", None, 0
    except Exception as e:
        logging.error(f"❌ Error occurred while fetching domains: {str(e)}")
        return False, f"Error occurred while fetching domains: {str(e)}", None, 0

def get_domain_ip(domain):
    """Get the IP address for a domain"""
    try:
        # Get IP address
        ip_address = socket.gethostbyname(domain)
        return ip_address
    except Exception as e:
        logging.error(f"Error getting IP for {domain}: {str(e)}")
        return None

def get_geolocation(ip_address):
    """Get geolocation information for an IP address"""
    if not ip_address:
        return None
        
    try:
        # Use a free IP geolocation API
        response = requests.get(f"https://ipapi.co/{ip_address}/json/")
        if response.status_code == 200:
            data = response.json()
            location = {
                'country': data.get('country_name'),
                'region': data.get('region'),
                'city': data.get('city'),
                'postal': data.get('postal'),
                'latitude': data.get('latitude'),
                'longitude': data.get('longitude'),
                'org': data.get('org'),  # Usually contains ISP/hosting info
                'asn': data.get('asn')
            }
            return location
        else:
            return None
    except Exception as e:
        logging.error(f"Error getting geolocation for {ip_address}: {str(e)}")
        return None

def get_dns_records(domain):
    """Get DNS records for a domain using socket instead of dnspython"""
    records = {
        'a': [],
        'aaaa': [],
        'mx': [],
        'txt': [],
        'ns': [],
        'cname': []
    }
    
    try:
        # A records (IPv4)
        try:
            # Use socket for A record lookup
            ip = socket.gethostbyname(domain)
            if ip:
                records['a'].append(ip)
        except Exception as e:
            logging.debug(f"Error getting A record for {domain}: {str(e)}")
            
        # NS records (Name servers) - use a public DNS API
        try:
            response = requests.get(f"https://dns.google/resolve?name={domain}&type=NS")
            if response.status_code == 200:
                data = response.json()
                if 'Answer' in data:
                    for answer in data['Answer']:
                        if answer.get('type') == 2:  # NS record type
                            records['ns'].append(answer.get('data'))
        except Exception as e:
            logging.debug(f"Error getting NS records for {domain}: {str(e)}")
            
        # MX records (Mail servers) - use a public DNS API
        try:
            response = requests.get(f"https://dns.google/resolve?name={domain}&type=MX")
            if response.status_code == 200:
                data = response.json()
                if 'Answer' in data:
                    for answer in data['Answer']:
                        if answer.get('type') == 15:  # MX record type
                            mx_data = answer.get('data', '')
                            parts = mx_data.split(' ', 1)
                            if len(parts) == 2:
                                preference = parts[0]
                                exchange = parts[1]
                                records['mx'].append({'preference': preference, 'exchange': exchange})
        except Exception as e:
            logging.debug(f"Error getting MX records for {domain}: {str(e)}")
            
        # TXT records - use a public DNS API
        try:
            response = requests.get(f"https://dns.google/resolve?name={domain}&type=TXT")
            if response.status_code == 200:
                data = response.json()
                if 'Answer' in data:
                    for answer in data['Answer']:
                        if answer.get('type') == 16:  # TXT record type
                            records['txt'].append(answer.get('data'))
        except Exception as e:
            logging.debug(f"Error getting TXT records for {domain}: {str(e)}")
            
        # AAAA records (IPv6) - use a public DNS API
        try:
            response = requests.get(f"https://dns.google/resolve?name={domain}&type=AAAA")
            if response.status_code == 200:
                data = response.json()
                if 'Answer' in data:
                    for answer in data['Answer']:
                        if answer.get('type') == 28:  # AAAA record type
                            records['aaaa'].append(answer.get('data'))
        except Exception as e:
            logging.debug(f"Error getting AAAA records for {domain}: {str(e)}")
            
        # CNAME records - use a public DNS API
        try:
            response = requests.get(f"https://dns.google/resolve?name={domain}&type=CNAME")
            if response.status_code == 200:
                data = response.json()
                if 'Answer' in data:
                    for answer in data['Answer']:
                        if answer.get('type') == 5:  # CNAME record type
                            records['cname'].append(answer.get('data'))
        except Exception as e:
            logging.debug(f"Error getting CNAME records for {domain}: {str(e)}")
            
        return records
    except Exception as e:
        logging.error(f"Error getting DNS records for {domain}: {str(e)}")
        return records

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
        
        # Default values
        domain_info = {
            'created': None,
            'updated': None,
            'expires': None,
            'registrar': None,
            'nameservers': [],
            'statuses': [],
            'registrant': {
                'name': None,
                'organization': None,
                'email': None,
                'phone': None,
                'country': None,
                'state': None,
                'city': None
            },
            'admin': {
                'name': None,
                'organization': None,
                'email': None,
                'phone': None,
                'country': None,
                'state': None,
                'city': None
            },
            'tech': {
                'name': None,
                'organization': None,
                'email': None,
                'phone': None,
                'country': None,
                'state': None,
                'city': None
            },
            'dnssec': None,
            'rawText': whois_record.get('rawText', None)
        }
        
        # Extract dates with better fallbacks
        try:
            domain_info['created'] = whois_record.get('createdDate')
            domain_info['updated'] = whois_record.get('updatedDate')
            domain_info['expires'] = whois_record.get('expiresDate')
            
            # If not found at top level, look in registryData
            if 'registryData' in whois_record:
                registry = whois_record['registryData']
                if not domain_info['created']:
                    domain_info['created'] = registry.get('createdDate')
                if not domain_info['updated']:
                    domain_info['updated'] = registry.get('updatedDate')
                if not domain_info['expires']:
                    domain_info['expires'] = registry.get('expiresDate')
                    
            # Additional fallbacks for dates
            if not domain_info['created'] and 'createdDateNormalized' in whois_record:
                domain_info['created'] = whois_record.get('createdDateNormalized')
            if not domain_info['updated'] and 'updatedDateNormalized' in whois_record:
                domain_info['updated'] = whois_record.get('updatedDateNormalized')
            if not domain_info['expires'] and 'expiresDateNormalized' in whois_record:
                domain_info['expires'] = whois_record.get('expiresDateNormalized')
                
            # More fallbacks from standardized data if available
            if not domain_info['created'] and 'standardRegCreatedDate' in whois_record:
                domain_info['created'] = whois_record.get('standardRegCreatedDate')
            if not domain_info['updated'] and 'standardRegUpdatedDate' in whois_record:
                domain_info['updated'] = whois_record.get('standardRegUpdatedDate')
            if not domain_info['expires'] and 'standardRegExpiresDate' in whois_record:
                domain_info['expires'] = whois_record.get('standardRegExpiresDate')
                
        except Exception as e:
            logging.error(f"Error extracting dates: {str(e)}")
            pass
        
        # Extract registrar information with better fallbacks
        try:
            domain_info['registrar'] = whois_record.get('registrarName')
            
            # If not found, check registryData
            if not domain_info['registrar'] and 'registryData' in whois_record:
                domain_info['registrar'] = whois_record['registryData'].get('registrarName')
                
            # Try another possible location
            if not domain_info['registrar']:
                if 'registrar' in whois_record and 'name' in whois_record['registrar']:
                    domain_info['registrar'] = whois_record['registrar'].get('name')
                elif 'registrarIANAID' in whois_record:
                    domain_info['registrar'] = f"IANA ID: {whois_record['registrarIANAID']}"
        except Exception:
            pass
        
        # Extract nameservers
        try:
            if 'nameServers' in whois_record:
                ns_data = whois_record['nameServers']
                if 'hostNames' in ns_data:
                    domain_info['nameservers'] = ns_data['hostNames']
                elif isinstance(ns_data, list):
                    domain_info['nameservers'] = ns_data
                
            # If not found, check registryData
            if not domain_info['nameservers'] and 'registryData' in whois_record:
                if 'nameServers' in whois_record['registryData']:
                    ns_data = whois_record['registryData']['nameServers']
                    if 'hostNames' in ns_data:
                        domain_info['nameservers'] = ns_data['hostNames']
                    elif isinstance(ns_data, list):
                        domain_info['nameservers'] = ns_data
        except Exception:
            pass
        
        # Extract domain statuses
        try:
            if 'status' in whois_record:
                domain_info['statuses'] = whois_record['status']
            elif 'registryData' in whois_record and 'status' in whois_record['registryData']:
                domain_info['statuses'] = whois_record['registryData']['status']
                
            # Convert string to list if needed
            if isinstance(domain_info['statuses'], str):
                domain_info['statuses'] = [domain_info['statuses']]
        except Exception:
            pass
        
        # Extract contact information (registrant, admin, technical)
        contacts = ['registrant', 'admin', 'tech']
        for contact_type in contacts:
            try:
                # Try in main record
                contact_key = f"{contact_type}Contact"
                if contact_key in whois_record:
                    contact = whois_record[contact_key]
                    domain_info[contact_type]['name'] = contact.get('name')
                    domain_info[contact_type]['organization'] = contact.get('organization')
                    domain_info[contact_type]['email'] = contact.get('email')
                    domain_info[contact_type]['phone'] = contact.get('telephone')
                    domain_info[contact_type]['country'] = contact.get('country')
                    domain_info[contact_type]['state'] = contact.get('state')
                    domain_info[contact_type]['city'] = contact.get('city')
                
                # Try in registryData
                elif 'registryData' in whois_record and contact_key in whois_record['registryData']:
                    contact = whois_record['registryData'][contact_key]
                    domain_info[contact_type]['name'] = contact.get('name')
                    domain_info[contact_type]['organization'] = contact.get('organization')
                    domain_info[contact_type]['email'] = contact.get('email')
                    domain_info[contact_type]['phone'] = contact.get('telephone')
                    domain_info[contact_type]['country'] = contact.get('country')
                    domain_info[contact_type]['state'] = contact.get('state')
                    domain_info[contact_type]['city'] = contact.get('city')
                    
                # The second-level contacts format 
                elif contact_type in whois_record:
                    contact = whois_record[contact_type]
                    domain_info[contact_type]['name'] = contact.get('name')
                    domain_info[contact_type]['organization'] = contact.get('organization')
                    domain_info[contact_type]['email'] = contact.get('email')
                    domain_info[contact_type]['phone'] = contact.get('telephone')
                    domain_info[contact_type]['country'] = contact.get('country')
                    domain_info[contact_type]['state'] = contact.get('state')
                    domain_info[contact_type]['city'] = contact.get('city')
            except Exception as e:
                logging.error(f"Error extracting {contact_type} contact information: {str(e)}")
                pass  # Continue processing other contacts even if one fails
        
        # DNSSEC information
        try:
            domain_info['dnssec'] = whois_record.get('dnssec')
            if not domain_info['dnssec'] and 'registryData' in whois_record:
                domain_info['dnssec'] = whois_record['registryData'].get('dnssec')
        except Exception:
            pass
            
        # Additional technical information
        ip_address = get_domain_ip(domain)
        domain_info['ip_address'] = ip_address
        domain_info['geolocation'] = get_geolocation(ip_address)
        domain_info['dns_records'] = get_dns_records(domain)
        
        # Check if domain is available (should always be registered if we have WHOIS data)
        domain_info['is_registered'] = True
        
        # Extract important dates from raw text for additional fallback
        if not domain_info['created'] or not domain_info['updated'] or not domain_info['expires']:
            raw_text = domain_info['rawText']
            if raw_text:
                for line in raw_text.split('\n'):
                    line = line.lower()
                    if not domain_info['created'] and ('creation date' in line or 'created on' in line or 'created:' in line):
                        try:
                            domain_info['created'] = line.split(':', 1)[1].strip()
                        except:
                            pass
                    if not domain_info['updated'] and ('updated date' in line or 'updated on' in line or 'updated:' in line):
                        try:
                            domain_info['updated'] = line.split(':', 1)[1].strip()
                        except:
                            pass
                    if not domain_info['expires'] and ('expiration date' in line or 'expires on' in line or 'expires:' in line):
                        try:
                            domain_info['expires'] = line.split(':', 1)[1].strip()
                        except:
                            pass
        
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
                'message': 'API Key not found or invalid. Please check your environment variables.'
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
                        logging.info(f"🔄 Trying alternative search with '{alt_keyword}' after removing TLD")
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
                logging.info(f"🔄 Trying alternative search with '{mod_keyword}'")
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
                'message': 'API Key not found or invalid. Please check your environment variables.'
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

# Handler for Vercel serverless function
def handler(event, context):
    return app(event["body"], context)

if __name__ == '__main__':
    app.run(debug=True)
