import requests
import json

def test_sim():
    url = "http://localhost:8001/api/simulate_multi"
    payload = {
        "tickers": ["SPY", "QQQ", "TLT"],
        "start_date": "2020-01-01",
        "end_date": "2023-12-31"
    }
    print(f"Testing {url} with {payload}...")
    try:
        r = requests.post(url, json=payload)
        if r.status_code == 200:
            data = r.json()
            sim = data.get("simulation", [])
            print(f"Success! Received {len(sim)} simulation points.")
            if sim:
                print("First point sample:")
                print(json.dumps(sim[0], indent=2))
        else:
            print(f"Error: {r.status_code} - {r.text}")
    except Exception as e:
        print(f"Connect failed: {e}")

if __name__ == "__main__":
    test_sim()
