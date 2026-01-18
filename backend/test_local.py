from analysis import calculate_overlap_hybrid

def test_overlap():
    print("Testing overlap logic...")
    holdings_data = {} 
    tickers = ["SPY", "QQQ"]
    
    print(f"Calling calculate_overlap_hybrid for {tickers}...")
    try:
        result = calculate_overlap_hybrid(holdings_data, tickers)
        import json
        print("Result:")
        print(json.dumps(result, indent=2, default=str))
    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_overlap()
