import requests
import json
import time
from colorama import Fore, Style, init
from concurrent.futures import ThreadPoolExecutor

init(autoreset=True)

def print_welcome_message():
    print(r"""
          
█▀▀ █░█ ▄▀█ █░░ █ █▄▄ █ █▀▀
█▄█ █▀█ █▀█ █▄▄ █ █▄█ █ ██▄
          """)
    print(Fore.GREEN + Style.BRIGHT + "Onchain BOT")

set_headers = {
        'accept': 'application/json, text/plain, */*',
        'referer': 'https://db4.onchaincoin.io/',
        'Content-Type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36'
}

def get_token(query_id):
    headers = set_headers.copy()
    url = 'https://db4.onchaincoin.io/api/validate'
    data = json.dumps({"hash": query_id})

    response = requests.post(url, headers=headers, data=data)
    if response.status_code == 200:
        try:
            print(Fore.GREEN + f"\rBerhasil mendapatkan token               ", end="", flush=True)
            token = response.json().get('token')
            return token
        except json.JSONDecodeError:
            return {"error": "Tidak ada data JSON yang valid dalam respons"}
    else:
        return None

def activate_rocket(token):
    url = 'https://db4.onchaincoin.io/api/rocketActivation'
    headers = set_headers.copy()
    headers['authorization'] = f'Bearer {token}'
    response = requests.post(url, headers=headers)
    return response.json() if response.status_code == 200 else {"error": f"Error {response.status_code}", "status_code": response.status_code}

def get_info(token):
    url = 'https://db4.onchaincoin.io/api/info'
    headers = set_headers.copy()
    headers['authorization'] = f'Bearer {token}'
    response = requests.get(url, headers=headers)
    return response.json() if response.status_code == 200 else {"error": f"Error {response.status_code}", "status_code": response.status_code}

def send_clicks_with_rocket_boost(token, clicks=100):
    url = 'https://db4.onchaincoin.io/api/clicksWithRocketBoost'
    headers = set_headers.copy()
    headers['authorization'] = f'Bearer {token}'
    data = json.dumps({"clicks": clicks})
    response = requests.post(url, headers=headers, data=data)
    return response.json() if response.status_code == 200 else {"error": f"Error {response.status_code}", "status_code": response.status_code}

def send_clicks(token, total_tap):
    url = 'https://db4.onchaincoin.io/api/klick/myself/click'
    headers = set_headers.copy()
    headers['authorization'] = f'Bearer {token}'
    data = json.dumps({"clicks": total_tap})
    response = requests.post(url, headers=headers, data=data)
    return response.json() if response.status_code == 200 else {"error": f"Error {response.status_code}", "status_code": response.status_code}

def use_energy(token):
    url = 'https://db4.onchaincoin.io/api/boosts/energy'
    headers = set_headers.copy()
    headers['authorization'] = f'Bearer {token}'
    response = requests.post(url, headers=headers)
    return response.json() if response.status_code == 200 else {"error": f"Error {response.status_code}", "status_code": response.status_code}

def handle_query(query_data):
    token = get_token(query_data.strip())
    if not token:
        print(Fore.RED + Style.BRIGHT + f"\rInvalid Query ID", flush=True)
        return

    info_response = get_info(token)
    if 'error' in info_response:
        print(Fore.RED + Style.BRIGHT + f"\rError getting user info. {info_response['error']}", end="", flush=True)
        return

    user_info = info_response.get('user', {})
    coin_balance_before_rocket = user_info.get('coins', 0)
    fullName = user_info.get('fullName', 'Tidak ada user name')
    clicklevel = user_info.get('clickLevel', 0)
    energy_save = user_info['energy']
    print(Fore.YELLOW + Style.BRIGHT + f"\n[ {fullName} ] - [ Balance ] : {coin_balance_before_rocket}")
    energy_save = user_info['energy']
    print(Fore.RED + Style.BRIGHT + f"\r[ Tap ] : energy {int(energy_save)}")
                
    response = activate_rocket(token)
    if response.get('status_code') == 400:
        print(Fore.RED + Style.BRIGHT + f"\r[ Rocket ] : Roket Sudah Aktif             ", flush=True)
    elif response.get('status_code') == 429:
        print(Fore.RED + Style.BRIGHT + f"\r[ Rocket ] : Too many request                ", flush=True)
    else:
        print(Fore.GREEN + Style.BRIGHT + f"\r[ Rocket ] : Roket Aktif            ", flush=True)
        clicks_response = send_clicks_with_rocket_boost(token)
        info_response_after = get_info(token)
        user_info_after = info_response_after.get('user', {})
        coin_balance_after_rocket = user_info_after.get('coins', 0)
        total_coin = coin_balance_after_rocket - coin_balance_before_rocket
        print(Fore.GREEN + Style.BRIGHT + f"\r[ Rocket ] : {clicks_response}        ", end="", flush=True)
        print(Fore.GREEN + Style.BRIGHT + f"\r[ Rocket ] : You got {total_coin}         \n")
       ## print(Fore.GREEN + Style.BRIGHT + f"\r DONE!! TRY AGAIN!!", end="", flush=True)


if __name__ == "__main__":
    print_welcome_message()
    while True:
        with open('query.txt', 'r') as file:
            queries = file.readlines()
        
        with ThreadPoolExecutor(max_workers=99) as executor:
            executor.map(handle_query, queries)
